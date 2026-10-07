import { describe, it, expect, vi } from 'vitest';
import { chunkText, rankVoices, pickVoice, SpeechNarrator, type VoiceLike } from './speech';
import { CaptionNarrator, type Narrator, type PlayResult } from './narrator';
import { CueScheduler, type TimedCue } from './scheduler';
import { estimateSpeechMs, PLANNER_RATE } from './estimate';
import { ClipNarrator, type VoiceManifest, type VoiceTrouble } from './clips';
import { clipKey } from './sentences';

describe('chunkText', () => {
  it('keeps every chunk at or under 140 characters', () => {
    const long = 'Push your hips back and slide the bar down your thighs, keeping it close, while your chest stays proud and your back stays long and neutral the whole way down to mid-shin. Then stand.';
    for (const c of chunkText(long)) expect(c.length).toBeLessThanOrEqual(140);
    expect(chunkText(long).join(' ')).toContain('Then stand.');
  });
});

describe('voice ranking', () => {
  const v = (name: string, lang = 'en-US', localService = true): VoiceLike => ({ name, lang, localService, voiceURI: name });

  it('prefers natural, premium and enhanced voices and drops novelty voices', () => {
    const ranked = rankVoices([v('Zarvox'), v('Samantha'), v('Microsoft Aria Online (Natural)', 'en-US', false), v('Ava (Enhanced)'), v('Grandma')]);
    expect(ranked.map(x => x.name)).toEqual(['Microsoft Aria Online (Natural)', 'Ava (Enhanced)', 'Samantha']);
  });

  it('drops network voices when offline and honours a saved choice', () => {
    const voices = [v('Microsoft Aria Online (Natural)', 'en-US', false), v('Samantha'), v('Daniel', 'en-GB')];
    expect(pickVoice(voices, undefined, false)?.name).toBe('Samantha');
    expect(pickVoice(voices, { name: 'Daniel' })?.name).toBe('Daniel');
  });
});

/** A fake speechSynthesis that can be told to never fire onend. */
function fakeSynth(opts: { fireEnd: boolean }) {
  const spoken: string[] = [];
  const synth = {
    speaking: false,
    getVoices: () => [],
    cancel: vi.fn(),
    speak(u: { text: string; onend?: () => void }) {
      spoken.push(u.text);
      if (opts.fireEnd) setTimeout(() => u.onend?.(), 10);
    },
  };
  class Utt { text: string; rate = 1; pitch = 1; volume = 1; lang = ''; voice = null; onend?: () => void; onerror?: () => void; constructor(t: string) { this.text = t; } }
  return { synth: synth as unknown as SpeechSynthesis, Utt: Utt as unknown as typeof SpeechSynthesisUtterance, spoken };
}

describe('SpeechNarrator', () => {
  it('speaks long lines in chunks', async () => {
    const { synth, Utt, spoken } = fakeSynth({ fireEnd: true });
    const n = new SpeechNarrator(synth, 1, Utt);
    const r = await n.say('One sentence here. Another sentence there.', new AbortController().signal);
    expect(r).toBe('ended');
    expect(spoken).toEqual(['One sentence here.', 'Another sentence there.']);
  });

  it('resolves via the watchdog when onend never fires (Review Focus #5)', async () => {
    vi.useFakeTimers();
    const { synth, Utt } = fakeSynth({ fireEnd: false });
    const n = new SpeechNarrator(synth, 1, Utt);
    const p = n.say('Hold, and keep breathing.', new AbortController().signal);
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(p).resolves.toBe('ended');
    vi.useRealTimers();
  });

  it('aborts when the signal fires', async () => {
    const { synth, Utt } = fakeSynth({ fireEnd: false });
    const n = new SpeechNarrator(synth, 1, Utt);
    const c = new AbortController();
    const p = n.say('First. Second. Third.', c.signal);
    c.abort();
    expect(['aborted', 'ended']).toContain(await p);
    expect(synth.cancel).toHaveBeenCalled();
  });
});

class FakeNarrator implements Narrator {
  readonly kind = 'speech' as const;
  said: string[] = [];
  stops = 0;
  /** By default `say` never resolves, so the scheduler stays busy on the line. */
  private readonly instant: boolean;
  constructor(instant = false) { this.instant = instant; }
  estimateMs(text: string) { return estimateSpeechMs(text, 1); }
  say(text: string): Promise<PlayResult> {
    this.said.push(text);
    return this.instant ? Promise.resolve('ended') : new Promise(() => {});
  }
  stop() { this.stops++; }
}

const cue = (id: string, startAt: number, priority: 0 | 1 | 2 | 3, text: string, extra: Partial<TimedCue> = {}): TimedCue =>
  ({ id, startAt, priority, text, seg: 0, offsetMs: 0, ...extra });

describe('CueScheduler', () => {
  it('lets a timed cue preempt an instruction', () => {
    const n = new FakeNarrator();
    const s = new CueScheduler(n);
    s.load([cue('a', 0, 2, 'A long instruction about breathing slowly.'), cue('b', 10_000, 1, 'Switch sides.')]);
    s.tick(0);
    s.tick(10_000);
    expect(n.said).toEqual(['A long instruction about breathing slowly.', 'Switch sides.']);
    expect(n.stops).toBe(1);
  });

  it('drops stale timed cues', () => {
    const n = new FakeNarrator();
    const s = new CueScheduler(n);
    s.load([cue('a', 0, 1, 'Three, two, one.', { staleAfterMs: 1000 })]);
    s.tick(5000);
    expect(n.said).toEqual([]);
  });

  it('keeps a stale window in real time when the clock runs fast (?timescale)', () => {
    // At 30× one 250 ms tick is 7.5 s of clock time; unscaled, a 2.5 s window
    // would drop nearly every timed cue in an end-to-end run.
    const line = 'Switch to your right side.';
    const said = (timescale: number | undefined, lateMs: number) => {
      const n = new FakeNarrator();
      const s = new CueScheduler(n, {}, { timescale });
      s.load([cue('a', 0, 1, line, { staleAfterMs: 2500 })]);
      s.tick(lateMs);
      return n.said;
    };
    expect(said(30, 7500)).toEqual([line]);       // one fast tick late: still spoken
    expect(said(30, 2500 * 30 + 1)).toEqual([]);  // past the scaled window: dropped
    expect(said(undefined, 7500)).toEqual([]);    // real speed exactly as before…
    expect(said(1, 2500)).toEqual([line]);        // …including the edge of the window
  });

  it('uses the short variant, or captions only, when an instruction will not fit', () => {
    const n = new FakeNarrator();
    const captions: string[] = [];
    const s = new CueScheduler(n, { onCaption: t => captions.push(t) });
    const longText = 'Breathe in through your nose for four, and out slowly for six. Sink a little deeper on each breath out, letting your shoulders soften.';
    s.load([cue('a', 0, 2, longText, { short: 'In for four, out for six.' }), cue('b', 4000, 1, 'Switch sides.')]);
    s.tick(0);
    expect(n.said).toEqual(['In for four, out for six.']);
    expect(captions[0]).toBe(longText);
  });

  it('shows captions but stays silent when muted', () => {
    const n = new FakeNarrator();
    const captions: string[] = [];
    const s = new CueScheduler(n, { onCaption: t => captions.push(t) });
    s.setMuted(true);
    s.load([cue('a', 0, 1, 'Begin.')]);
    s.tick(10);
    expect(n.said).toEqual([]);
    expect(captions).toEqual(['Begin.']);
  });

  it('repeats a step on a new visit but not when the schedule is re-anchored', () => {
    const n = new FakeNarrator();
    const captions: string[] = [];
    const s = new CueScheduler(n, { onCaption: t => captions.push(t) });
    // Cue ids are deterministic per step (script.ts), so the same id comes back.
    const c = cue('hold-1-0', 0, 1, 'Begin. Ease into it.');
    s.load([c], { epoch: 1, stepId: 'hold-1' });
    s.tick(0);
    s.stop();
    // A tick, a resume or "+15 s" re-anchors the same visit: stay quiet.
    s.load([c], { epoch: 1, stepId: 'hold-1' });
    s.tick(10);
    expect(n.said).toEqual(['Begin. Ease into it.']);
    // The user taps Previous: this step is being done again, so say it again.
    s.load([{ ...c, startAt: 20 }], { epoch: 2, stepId: 'hold-1' });
    s.tick(20);
    expect(n.said).toEqual(['Begin. Ease into it.', 'Begin. Ease into it.']);
    expect(captions).toEqual(['Begin. Ease into it.', 'Begin. Ease into it.']);
  });

  it('drops out-of-date cues and says one catch-up line when the page comes back', () => {
    const n = new FakeNarrator();
    const captions: string[] = [];
    const s = new CueScheduler(n, { onCaption: t => captions.push(t), catchUpLine: () => 'Welcome back. Treadmill walk.' });
    s.load([
      cue('cardio-0', 60_000, 1, 'Now settle into a steady pace.'),
      cue('cardio-1', 180_000, 3, 'Stand tall, let your arms swing.'),
      cue('cardio-2', 300_000, 3, 'Relax your shoulders.'),
      cue('cardio-3', 600_000, 1, 'Cool-down. Slow right down.'),
    ]);
    s.tick(50_000);
    expect(n.said).toEqual([]);
    s.tick(650_000); // screen locked for ten minutes
    s.stop();
    s.tick(650_250);
    s.stop();
    s.tick(650_500);
    expect(n.said).toEqual(['Welcome back. Treadmill walk.']);
    expect(captions).toEqual(['Welcome back. Treadmill walk.']);
  });

  it('keeps queued instructions through a blink, drops them after a real gap', () => {
    const n = new FakeNarrator();
    const s = new CueScheduler(n);
    s.load([
      cue('setup-0', 0, 1, 'Next: trap bar deadlift.'),
      cue('setup-1', 500, 2, 'Step into the middle of the bar, feet hip-width.'),
      cue('setup-2', 1000, 2, 'Push your hips back and grip the high handles.'),
    ]);
    s.tick(0);
    // Two seconds of pause must not lose the rest of the setup instructions.
    s.resync(30_000, 2000);
    s.stop();
    s.tick(30_100);
    expect(n.said).toEqual(['Next: trap bar deadlift.', 'Step into the middle of the bar, feet hip-width.']);
    // Ten minutes away, and the last instruction is out of date.
    s.resync(60_000, 600_000);
    s.stop();
    s.tick(60_100);
    expect(n.said).toHaveLength(2);
  });

  it('never drops a P0 safety cue when the page comes back', () => {
    const n = new FakeNarrator();
    const s = new CueScheduler(n);
    s.load([cue('low', 300_000, 0, 'If you feel shaky or sweaty, tap I feel low.')]);
    s.tick(1000);
    s.tick(650_000);
    expect(n.said).toEqual(['If you feel shaky or sweaty, tap I feel low.']);
  });

  it('waits for the reload instead of speaking the previous step\'s cues', () => {
    const n = new FakeNarrator();
    const s = new CueScheduler(n);
    s.load([cue('hold-1-3', 1000, 2, 'Keep your ribs down.')], { stepId: 'hold-1' });
    s.tick(1000, 'rest-2'); // the clock has moved into the next step already
    expect(n.said).toEqual([]);
    s.load([cue('rest-2-0', 1000, 1, 'Rest sixty seconds.')], { stepId: 'rest-2' });
    s.tick(1250, 'rest-2');
    expect(n.said).toEqual(['Rest sixty seconds.']);
  });

  it('says the catch-up line through to the user as a caption even when muted', () => {
    const n = new FakeNarrator();
    const captions: string[] = [];
    const s = new CueScheduler(n, { onCaption: t => captions.push(t), catchUpLine: () => 'Welcome back. Resting now.' });
    s.setMuted(true);
    s.load([cue('rest-0', 0, 1, 'Rest sixty seconds.')]);
    s.tick(1000);
    s.tick(650_000);
    expect(n.said).toEqual([]);
    expect(captions).toEqual(['Rest sixty seconds.', 'Welcome back. Resting now.']);
  });

  it('caption narrator resolves after the estimated duration', async () => {
    vi.useFakeTimers();
    const n = new CaptionNarrator(1);
    const p = n.say('Begin.', new AbortController().signal);
    await vi.advanceTimersByTimeAsync(5000);
    await expect(p).resolves.toBe('ended');
    vi.useRealTimers();
  });
});

type AudioMode = 'plays' | 'blocked' | 'error' | 'silent';

/** The parts of <audio> the clip narrator uses; the mode can change mid-session. */
function fakeAudio(mode: AudioMode | { mode: AudioMode }) {
  const ctl = typeof mode === 'string' ? { mode } : mode;
  const a: Record<string, unknown> = {
    src: '', currentTime: 0, preload: '', paused: true,
    onended: null, onerror: null,
    pause() { a.paused = true; },
  };
  a.play = () => {
    if (ctl.mode === 'blocked') return Promise.reject(Object.assign(new Error('gesture required'), { name: 'NotAllowedError' }));
    if (ctl.mode === 'error') return Promise.reject(new Error('decode failed'));
    if (ctl.mode === 'silent') return Promise.resolve(); // play() resolves but nothing ever advances
    a.paused = false;
    setTimeout(() => (a.onended as (() => void) | null)?.(), 5);
    return Promise.resolve();
  };
  return a as unknown as HTMLAudioElement;
}

const manifest = (lines: Record<string, number>): VoiceManifest =>
  ({ voice: 'af_heart', engine: 'kokoro-82m', speed: 0.72, format: 'm4a', lines });

const LINE = 'Now settle into a steady pace.';

describe('ClipNarrator audio health (spec §7.3)', () => {
  it('plays the recorded clip and reports no trouble', async () => {
    const trouble: (VoiceTrouble | null)[] = [];
    const fb = new FakeNarrator(true);
    const n = new ClipNarrator(manifest({ [clipKey(LINE)]: 2207 }), '/voice/af_heart/', { audio: fakeAudio('plays'), fallback: fb, onTrouble: t => trouble.push(t) });
    expect(await n.say(LINE, new AbortController().signal)).toBe('ended');
    expect(fb.said).toEqual([]);
    expect(trouble).toEqual([]);
  });

  it('hands a blocked clip to the fallback narrator and flags "blocked"', async () => {
    const trouble: (VoiceTrouble | null)[] = [];
    const fb = new FakeNarrator(true);
    const n = new ClipNarrator(manifest({ [clipKey(LINE)]: 2207 }), '/voice/af_heart/', { audio: fakeAudio('blocked'), fallback: fb, onTrouble: t => trouble.push(t) });
    expect(await n.say(LINE, new AbortController().signal)).toBe('ended');
    expect(fb.said).toEqual([LINE]);
    expect(trouble).toEqual(['blocked']);
  });

  it('hands a failed clip to the fallback narrator and flags "failed"', async () => {
    const trouble: (VoiceTrouble | null)[] = [];
    const fb = new FakeNarrator(true);
    const n = new ClipNarrator(manifest({ [clipKey(LINE)]: 2207 }), '/voice/af_heart/', { audio: fakeAudio('error'), fallback: fb, onTrouble: t => trouble.push(t) });
    await n.say(LINE, new AbortController().signal);
    expect(fb.said).toEqual([LINE]);
    expect(trouble).toEqual(['failed']);
  });

  it('falls through when playback never starts, and clears the flag once a clip plays', async () => {
    vi.useFakeTimers();
    const trouble: (VoiceTrouble | null)[] = [];
    const fb = new FakeNarrator(true);
    const ctl = { mode: 'silent' as AudioMode };
    const n = new ClipNarrator(manifest({ [clipKey(LINE)]: 2207 }), '/voice/af_heart/', { audio: fakeAudio(ctl), fallback: fb, onTrouble: t => trouble.push(t) });
    const p = n.say(LINE, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(1600);
    await p;
    expect(fb.said).toEqual([LINE]);
    expect(trouble).toEqual(['failed']);
    // Audio comes back: the same narrator stops flagging trouble.
    vi.useRealTimers();
    ctl.mode = 'plays';
    await n.say(LINE, new AbortController().signal);
    expect(trouble).toEqual(['failed', null]);
  });

  it('does not flag trouble for a line that was never recorded', async () => {
    const trouble: (VoiceTrouble | null)[] = [];
    const fb = new FakeNarrator(true);
    const n = new ClipNarrator(manifest({}), '/voice/af_heart/', { audio: fakeAudio('plays'), fallback: fb, onTrouble: t => trouble.push(t) });
    expect(await n.say(LINE, new AbortController().signal)).toBe('ended');
    expect(fb.said).toEqual([LINE]);
    expect(trouble).toEqual([]);
  });

  it('estimates an unrecorded line at the pack pace, not the renderer speed', () => {
    const n = new ClipNarrator(manifest({}), '/voice/af_heart/', { audio: fakeAudio('plays') });
    // af_heart records at 0.87× the planner's estimate (packs.ts); the manifest's
    // 0.72 is Kokoro's speed knob and overstates every line by a third.
    expect(n.estimateMs('Three, two, one.')).toBe(Math.round(estimateSpeechMs('Three, two, one.', PLANNER_RATE) * 0.87));
    expect(n.estimateMs('Three, two, one.')).toBeLessThan(estimateSpeechMs('Three, two, one.', 0.72));
  });
});
