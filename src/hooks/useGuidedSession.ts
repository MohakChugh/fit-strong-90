/**
 * Runs a SessionPlan: wall-clock runner + cue scheduler + narrator chain,
 * with wake lock, earphone controls, persistence and logging (spec §6, §7).
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { SessionPlan, StepLog } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { coolDownTarget, createRunner, initialState, position, segmentsWithExtra, type RunnerState } from '@/session/runner';
import { createClock, devTimescale } from '@/session/clock';
import { saveProgress } from '@/session/persistence';
import { catchUpText, scriptFor } from '@/session/script';
import { CueScheduler, type TimedCue } from '@/voice/scheduler';
import { CaptionNarrator, type Narrator } from '@/voice/narrator';
import { SpeechNarrator, loadVoices, pickVoice, primeSpeech } from '@/voice/speech';
import { ClipNarrator, loadManifest, primeAudio, type VoiceTrouble } from '@/voice/clips';
import { getCoaching } from '@/data/coaching';
import { exposureCounter } from '@/engine/speech';
import type { WorkoutSession } from '@/types';
import { useWakeLock } from './useWakeLock';
import { packName } from '@/voice/packs';

export interface GuidedSessionOptions {
  plan: SessionPlan;
  profile: UserProfile;
  sessions: WorkoutSession[];
  /** Resume from saved progress. */
  resumeState?: RunnerState;
  /** The run's History record id, saved with its progress so a resume updates the same record. */
  sessionId?: string;
  /** Step ids today's restrictions refuse: the runner never enters them. */
  refused?: ReadonlySet<string>;
  /**
   * Asked before every resume — the on-screen button, the exit dialog,
   * earphone or lock-screen Play, and the way on after a question. Starting
   * again after a pause is a restart (re-audit round 3 B03): return false to
   * stay paused.
   */
  mayResume?: () => boolean;
  /**
   * There has been a low in this run. From then on every resume goes to the
   * cool-down only, wherever the run stands and whichever way it is resumed
   * (spec §4.6, scan M-02): never back to strength or the cardio's work.
   */
  coolDownOnly?: () => boolean;
  /**
   * A safety question is on screen — a stop, a reading or check-in the
   * session waits on, or a hold. Earphone and lock-screen Play, Next and
   * Previous are then taken and do nothing: only answering it on screen moves
   * the session (scan X2-04).
   */
  held?: boolean;
}

/**
 * Where supported (Safari 16.4+), tell the OS how the coach's voice mixes
 * with music: over it (other audio ducks while the coach speaks) or as the
 * main audio (music pauses).
 */
function setAudioSession(mode: UserProfile['voice']['mode']) {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = mode === 'overMusic' ? 'transient' : 'playback';
}

/** A pause or a locked screen at least this long gets a catch-up line on return. */
const CATCH_UP_AFTER_MS = 8000;

/**
 * Absolute start times for one step's cues. End-aligned lines ask the active
 * narrator how long they take — a recorded clip's length is known from the pack
 * manifest — so "switch" and the countdowns land exactly at zero.
 */
export function anchorCues(
  plan: SessionPlan,
  profile: UserProfile,
  sessions: WorkoutSession[],
  state: RunnerState,
  estimateMs: (text: string) => number,
): TimedCue[] {
  const step = plan.steps[state.index];
  if (!step) return [];
  const seen = exposureCounter(sessions);
  const cues = scriptFor(step, { profile, plan, coaching: getCoaching, exposures: seen });
  const segs = segmentsWithExtra(step, state);
  const starts: number[] = [];
  let t = state.stepStartedAt;
  for (const s of segs) { starts.push(t); t += s.ms; }
  return cues.map(c => {
    const seg = Math.min(c.seg, segs.length - 1);
    const segStart = starts[seg];
    const segEnd = segStart + segs[seg].ms;
    // align 'end' with offset 0: finish speaking exactly at the segment end (countdowns);
    // with an offset: start that many ms before the end ("Ten seconds…").
    const startAt = c.align === 'end'
      ? segEnd - (c.offsetMs > 0 ? c.offsetMs : estimateMs(c.say ?? c.text))
      : segStart + c.offsetMs;
    return { ...c, startAt: Math.max(segStart, startAt) };
  });
}

export function useGuidedSession({ plan, profile, sessions, resumeState, sessionId, refused, mayResume, coolDownOnly, held = false }: GuidedSessionOptions) {
  const clock = useMemo(() => createClock({ timescale: devTimescale(import.meta.env.DEV, window.location.href) }), []);
  const runner = useMemo(() => createRunner(plan, refused), [plan, refused]);
  const mayResumeRef = useRef(mayResume);
  mayResumeRef.current = mayResume;
  const coolDownOnlyRef = useRef(coolDownOnly);
  coolDownOnlyRef.current = coolDownOnly;
  const heldRef = useRef(held);
  heldRef.current = held;
  const [state, dispatch] = useReducer(runner.reduce, resumeState ?? initialState(plan));
  // Today's restrictions can change under the run: a stop leaves the movement
  // out, and the back check about it goes with it. A step that is now refused
  // is passed over at once, paused or not, so it is never shown or asked
  // (scan J2-02). Every runner action passes over refused steps; this one
  // changes nothing else.
  useEffect(() => { dispatch({ type: 'tick', now: clock.now() }); }, [runner, clock]);
  const [now, setNow] = useState(() => clock.now());
  const [caption, setCaption] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(profile.voice.muted);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  /** Audio health (spec §7.3): 'blocked' needs a tap, 'failed' demoted the voice. */
  const [voiceTrouble, setVoiceTrouble] = useState<VoiceTrouble | null>(null);
  /** Bumped when the narrator changes, so cue timings re-anchor to its pace. */
  const [voiceGen, setVoiceGen] = useState(0);

  const captionsRef = useRef<Narrator>(new CaptionNarrator(profile.voice.rate));
  const narratorRef = useRef<Narrator>(captionsRef.current);
  const speechRef = useRef<SpeechNarrator | null>(null);
  const clipRef = useRef<ClipNarrator | null>(null);
  /**
   * The one <audio> element the recorded voice plays through. Phones unlock an
   * element only inside a tap, and the voice pack often arrives after Start, so
   * the element exists first and is unlocked by the tap; the pack attaches later.
   */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionAudio = () => (audioRef.current ??= new Audio());
  const stateRef = useRef(state);
  const catchUpRef = useRef<(now: number, awayMs: number) => string | null>(() => null);
  const schedulerRef = useRef<CueScheduler | null>(null);
  if (!schedulerRef.current) {
    schedulerRef.current = new CueScheduler(narratorRef.current, {
      onCaption: text => setCaption(text),
      onSpeaking: s => setSpeaking(s),
      catchUpLine: (at, awayMs) => catchUpRef.current(at, awayMs),
    }, { timescale: clock.scale });
  }
  const scheduler = schedulerRef.current;

  const swapNarrator = useCallback((n: Narrator, name: string | null) => {
    narratorRef.current = n;
    scheduler.setNarrator(n);
    if (name) setVoiceName(name);
    setVoiceGen(g => g + 1);
  }, [scheduler]);

  // Preferred: the pre-recorded neural voice pack. Fallback: device speech. Last: captions.
  const pack = profile.voice.pack ?? 'af_heart';
  useEffect(() => {
    const controller = new AbortController();
    const baseUrl = `${import.meta.env.BASE_URL}voice/${pack}/`;
    void loadManifest(baseUrl, controller.signal).then(manifest => {
      if (!manifest || controller.signal.aborted) return;
      const clip = new ClipNarrator(manifest, baseUrl, {
        audio: sessionAudio(),
        fallback: speechRef.current ?? captionsRef.current,
        onTrouble: setVoiceTrouble,
      });
      clipRef.current = clip;
      swapNarrator(clip, packName(pack));
      // Prefetch this session's lines so playback never waits on the network.
      const texts = plan.steps.flatMap(step => scriptFor(step, { profile, plan, coaching: getCoaching, exposures: exposureCounter(sessions) })
        .flatMap(c => [c.say ?? c.text, ...(c.short && !c.say ? [c.short] : [])]));
      void clip.prefetch(texts, controller.signal);
    });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack, plan, scheduler]);

  useEffect(() => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return;
    let alive = true;
    void loadVoices(synth).then(voices => {
      if (!alive) return;
      const voice = pickVoice(voices, { uri: profile.voice.voiceURI, name: profile.voice.voiceName }, navigator.onLine);
      const n = new SpeechNarrator(synth, profile.voice.rate);
      n.voice = voice;
      speechRef.current = n;
      if (!voice) return;
      // Device speech is the clip narrator's fallback for a line that won't play.
      if (clipRef.current) clipRef.current.fallback = n;
      else swapNarrator(n, n.voice?.name ?? null);
    });
    return () => { alive = false; };
  }, [profile.voice.rate, profile.voice.voiceURI, profile.voice.voiceName, swapNarrator]);

  useEffect(() => { scheduler.setMuted(muted); }, [muted, scheduler]);

  // Reload the current step's cues whenever its timing anchor changes.
  const step = plan.steps[state.index];
  const anchorKey = `${state.index}:${state.stepStartedAt}:${state.status}:${state.visit}:${voiceGen}:${JSON.stringify(state.extraMs[step?.id] ?? {})}`;
  useEffect(() => {
    if (state.status !== 'running') { scheduler.stop(); return; }
    scheduler.load(anchorCues(plan, profile, sessions, state, t => narratorRef.current.estimateMs(t)), { epoch: state.visit, stepId: step?.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchorKey]);

  // UI + runner tick, 4 Hz, from the wall clock.
  useEffect(() => {
    if (state.status !== 'running') return;
    const id = window.setInterval(() => {
      const t = clock.now();
      setNow(t);
      dispatch({ type: 'tick', now: t });
      // The reducer runs after this callback, so tell the scheduler which step
      // the clock is in: its cues may still be the step we have just left.
      scheduler.tick(t, plan.steps[runner.reduce(stateRef.current, { type: 'tick', now: t }).index]?.id);
    }, 250);
    return () => window.clearInterval(id);
  }, [state.status, clock, scheduler, plan, runner]);

  // Back from a locked screen: re-anchor, drop stale cues, one catch-up line.
  useEffect(() => {
    if (state.status !== 'running') return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const t = clock.now();
      setNow(t);
      dispatch({ type: 'tick', now: t });
      scheduler.resync(t);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [state.status, clock, scheduler]);

  // Persist progress every few seconds and when the page hides.
  stateRef.current = state;
  useEffect(() => {
    if (state.status === 'ready') return;
    // A finished run is saved as finished, and kept until the session record
    // is durably stored (the player clears it then). If that save never
    // happens — the phone locks on the summary, the write fails — the next
    // start banks it into History instead of losing the hour.
    if (state.status === 'done') { saveProgress(plan, stateRef.current, clock.now(), Date.now(), sessionId); return; }
    const save = () => saveProgress(plan, stateRef.current, clock.now(), Date.now(), sessionId);
    save();
    const id = window.setInterval(save, 5000);
    const onHide = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onHide); };
  }, [state.status, state.index, plan, clock, sessionId]);

  useWakeLock(state.status === 'running' || state.status === 'paused');

  // Where the session is now, for the one line said after a gap.
  catchUpRef.current = (at, awayMs) => {
    if (awayMs < CATCH_UP_AFTER_MS * clock.scale) return null;
    if (document.visibilityState === 'hidden') return null; // nobody is listening yet
    // Ask the reducer where the clock has taken us (a resume shifts the anchor).
    const live = stateRef.current.status === 'paused' ? runner.reduce(stateRef.current, { type: 'resume', now: at }) : stateRef.current;
    const caught = runner.reduce(live, { type: 'tick', now: at });
    if (caught.status !== 'running') return null;
    const p = position(plan, caught, at);
    return catchUpText(p.step, p.segment.side);
  };

  const act = useMemo(() => {
    /**
     * Inside every tap: phones allow audio and speech to start only from a
     * gesture. Unlocks the session's audio element whether or not the voice
     * pack has arrived, the device voice (the fallback) too, and applies the
     * chosen mix with music the same way on Start and on Resume.
     */
    const prime = () => {
      setAudioSession(profile.voice.mode);
      if (clipRef.current) clipRef.current.unlock();
      else void primeAudio(sessionAudio());
      primeSpeech();
    };
    /**
     * Where a run goes after a low, if it is not there yet (spec §4.6): the
     * cool-down part of the cardio still ahead, else the closing talk, or
     * `finish` when nothing of either is left.
     */
    const coolDown = (t: number): { index: number; segment: number } | 'finish' | undefined => {
      const s = stateRef.current;
      if (s.coolDownFrom || !coolDownOnlyRef.current?.()) return undefined;
      const at = position(plan, s, t, refused);
      return coolDownTarget(plan, at.stepIndex, at.segmentIndex, refused) ?? 'finish';
    };
    return {
      /** Must run inside the Start tap so iOS allows audio and speech. */
      start: () => {
        prime();
        dispatch({ type: 'start', now: clock.now() });
      },
      pause: () => dispatch({ type: 'pause', now: clock.now() }),
      resume: () => {
        // Only a paused session resumes: earphone Play while running must not
        // touch the audio (unlocking would cut off the line being spoken).
        if (stateRef.current.status !== 'paused') return;
        // Starting again is asked about every time, whichever button did it.
        if (mayResumeRef.current && !mayResumeRef.current()) return;
        prime();
        const t = clock.now();
        // After a low in this run, every way back goes to the cool-down only:
        // the lines it passes over are dropped, not caught up on (scan M-02).
        const to = coolDown(t);
        if (to === 'finish') { dispatch({ type: 'finish', now: t }); return; }
        if (to) {
          dispatch({ type: 'seek', now: t, ...to });
          dispatch({ type: 'resume', now: t });
          scheduler.skipPast(t);
          return;
        }
        const pausedAt = stateRef.current.pausedAt;
        dispatch({ type: 'resume', now: t });
        // A long pause is a gap like a locked screen: out-of-date cues go, one
        // catch-up line comes. Runs before the reload, so the drop applies to it.
        scheduler.resync(t, pausedAt === undefined ? 0 : Math.max(0, t - pausedAt));
      },
      /**
       * A paused run reopened after a low: moved, still paused, to its
       * cool-down, so nothing before it is shown or can be stepped back to.
       */
      toCoolDown: () => {
        if (stateRef.current.status !== 'paused') return;
        const t = clock.now();
        const to = coolDown(t);
        if (to && to !== 'finish') dispatch({ type: 'seek', now: t, ...to });
      },
      /** For a "Tap to resume audio" prompt: must run inside the tap. */
      unlockAudio: prime,
      next: (reason?: 'skip' | 'doneEarly') => dispatch({ type: 'next', now: clock.now(), reason }),
      previous: () => dispatch({ type: 'previous', now: clock.now() }),
      addTime: (seconds = 15) => dispatch({ type: 'addTime', now: clock.now(), seconds }),
      log: (entry: Omit<StepLog, 'at'>) => dispatch({ type: 'log', entry: { ...entry, at: clock.now() } }),
      finish: () => dispatch({ type: 'finish', now: clock.now() }),
      setMuted,
    };
  }, [clock, profile.voice.mode, scheduler, plan, refused]);

  // Earphone / lock-screen buttons where supported, while there is a session
  // to control: once it is done they go, so nothing outside the screen can
  // reach a finished run (scan M-03).
  const done = state.status === 'done';
  useEffect(() => {
    const ms = navigator.mediaSession;
    if (!ms || done) return;
    const set = (a: MediaSessionAction, h: MediaSessionActionHandler | null) => { try { ms.setActionHandler(a, h); } catch { /* unsupported */ } };
    // Under a safety question a stray earphone tap, a headset reconnecting or
    // lock-screen Play is acknowledged and changes nothing (scan X2-04). The
    // handler stays registered, so the system has nothing of its own to play.
    const unlessHeld = (f: () => void) => () => {
      if (!heldRef.current) { f(); return; }
      try { ms.playbackState = 'paused'; } catch { /* ignore */ }
    };
    set('play', unlessHeld(() => act.resume()));
    set('pause', () => act.pause());
    set('nexttrack', unlessHeld(() => act.next('skip')));
    set('previoustrack', unlessHeld(() => act.previous()));
    return () => { (['play', 'pause', 'nexttrack', 'previoustrack'] as const).forEach(a => set(a, null)); };
  }, [act, done]);

  const pos = position(plan, state, state.status === 'running' ? now : clock.now(), refused);

  useEffect(() => {
    const ms = navigator.mediaSession;
    if (!ms || typeof MediaMetadata === 'undefined') return;
    try {
      ms.metadata = new MediaMetadata({ title: pos.step.title, artist: 'FitStrong 90', album: plan.label });
      ms.playbackState = state.status === 'running' ? 'playing' : 'paused';
    } catch { /* ignore */ }
  }, [pos.step.title, plan.label, state.status]);

  const stopVoice = useCallback(() => scheduler.reset(), [scheduler]);
  useEffect(() => () => scheduler.reset(), [scheduler]);

  return { state, position: pos, caption, speaking, muted, voiceName, voiceTrouble, act, stopVoice, now };
}
