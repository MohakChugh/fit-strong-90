/**
 * Runs a SessionPlan: wall-clock runner + cue scheduler + narrator chain,
 * with wake lock, earphone controls, persistence and logging (spec §6, §7).
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { SessionPlan, StepLog } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { createRunner, initialState, position, segmentsWithExtra, type RunnerState } from '@/session/runner';
import { createClock, devTimescale } from '@/session/clock';
import { saveProgress, clearProgress } from '@/session/persistence';
import { catchUpText, scriptFor } from '@/session/script';
import { CueScheduler, type TimedCue } from '@/voice/scheduler';
import { CaptionNarrator, type Narrator } from '@/voice/narrator';
import { SpeechNarrator, loadVoices, pickVoice } from '@/voice/speech';
import { ClipNarrator, loadManifest, type VoiceTrouble } from '@/voice/clips';
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

export function useGuidedSession({ plan, profile, sessions, resumeState }: GuidedSessionOptions) {
  const clock = useMemo(() => createClock({ timescale: devTimescale(import.meta.env.DEV, window.location.href) }), []);
  const runner = useMemo(() => createRunner(plan), [plan]);
  const [state, dispatch] = useReducer(runner.reduce, resumeState ?? initialState(plan));
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
  /** Audio and speech only unlock inside a tap; remember that one has happened. */
  const gestured = useRef(false);
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
        fallback: speechRef.current ?? captionsRef.current,
        onTrouble: setVoiceTrouble,
      });
      clipRef.current = clip;
      // The pack usually arrives after the Start tap: unlock now, or iOS keeps
      // the whole hour silent because playback never began inside a gesture.
      if (gestured.current) clip.unlock();
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
    if (state.status === 'done') { clearProgress(); return; }
    const save = () => saveProgress(plan, stateRef.current, clock.now());
    save();
    const id = window.setInterval(save, 5000);
    const onHide = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onHide); };
  }, [state.status, state.index, plan, clock]);

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

  const act = useMemo(() => ({
    /** Must run inside the Start tap so iOS allows audio and speech. */
    start: () => {
      gestured.current = true;
      setAudioSession(profile.voice.mode);
      clipRef.current?.unlock();
      if (!clipRef.current) speechRef.current?.unlock(' ');
      dispatch({ type: 'start', now: clock.now() });
    },
    pause: () => dispatch({ type: 'pause', now: clock.now() }),
    resume: () => {
      gestured.current = true;
      if (clipRef.current) clipRef.current.unlock(); else speechRef.current?.unlock(' ');
      const t = clock.now();
      const pausedAt = stateRef.current.pausedAt;
      dispatch({ type: 'resume', now: t });
      // A long pause is a gap like a locked screen: out-of-date cues go, one
      // catch-up line comes. Runs before the reload, so the drop applies to it.
      scheduler.resync(t, pausedAt === undefined ? 0 : Math.max(0, t - pausedAt));
    },
    /** For a "Tap to resume audio" prompt: must run inside the tap. */
    unlockAudio: () => {
      gestured.current = true;
      setAudioSession(profile.voice.mode);
      if (clipRef.current) clipRef.current.unlock(); else speechRef.current?.unlock(' ');
    },
    next: (reason?: 'skip' | 'doneEarly') => dispatch({ type: 'next', now: clock.now(), reason }),
    previous: () => dispatch({ type: 'previous', now: clock.now() }),
    addTime: (seconds = 15) => dispatch({ type: 'addTime', now: clock.now(), seconds }),
    log: (entry: Omit<StepLog, 'at'>) => dispatch({ type: 'log', entry: { ...entry, at: clock.now() } }),
    finish: () => dispatch({ type: 'finish', now: clock.now() }),
    setMuted,
  }), [clock, profile.voice.mode, scheduler]);

  // Earphone / lock-screen buttons where supported.
  useEffect(() => {
    const ms = navigator.mediaSession;
    if (!ms) return;
    const set = (a: MediaSessionAction, h: MediaSessionActionHandler | null) => { try { ms.setActionHandler(a, h); } catch { /* unsupported */ } };
    set('play', () => act.resume());
    set('pause', () => act.pause());
    set('nexttrack', () => act.next('skip'));
    set('previoustrack', () => act.previous());
    return () => { (['play', 'pause', 'nexttrack', 'previoustrack'] as const).forEach(a => set(a, null)); };
  }, [act]);

  const pos = position(plan, state, state.status === 'running' ? now : clock.now());

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
