import { describe, expect, it } from 'vitest';
import type { VoiceManifest } from '@/voice/clips';
import { clipKey } from '@/voice/sentences';
import { WALK_CUES } from './cues';
import { createCuePlayer } from './voice';

const LINE = WALK_CUES[0].line;
const MANIFEST: VoiceManifest = { voice: 'af_heart', engine: 'kokoro-82m', speed: 0.72, format: 'm4a', lines: { [clipKey(LINE)]: 1400 } };

/**
 * An <audio> element: what it played, and the two ways it stops by itself.
 * `queued`: its own pause() fires "pause" a moment later, as a browser does,
 * rather than not at all.
 */
function fakeAudio(opts: { blocked?: boolean; queued?: boolean } = {}) {
  const onPause = new Set<() => void>();
  const firePause = () => { for (const fn of onPause) fn(); };
  const a = {
    src: '', currentTime: 0, preload: '', paused: true, ended: false,
    onended: null as null | (() => void), onerror: null as null | (() => void), onplaying: null as null | (() => void),
    played: [] as string[],
    play() {
      if (opts.blocked) return Promise.reject(Object.assign(new Error('gesture required'), { name: 'NotAllowedError' }));
      a.paused = false;
      a.ended = false;
      a.played.push(a.src);
      if (!a.src.startsWith('data:')) a.onplaying?.();
      return Promise.resolve();
    },
    pause() {
      const was = a.paused;
      a.paused = true;
      if (opts.queued && !was) setTimeout(firePause, 0);
    },
    addEventListener(type: string, fn: () => void) { if (type === 'pause') onPause.add(fn); },
    removeEventListener(type: string, fn: () => void) { if (type === 'pause') onPause.delete(fn); },
    /** The system takes the audio: a call, or headphones out. */
    interrupt() { a.paused = true; firePause(); },
    /** The clip plays to its end: the element pauses, then ends. */
    finish() { a.ended = true; a.paused = true; firePause(); a.onended?.(); },
  };
  return a;
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

async function ready(audio = fakeAudio(), manifest: VoiceManifest | null = MANIFEST) {
  const voice = createCuePlayer({ audio: audio as unknown as HTMLAudioElement, manifest: () => Promise.resolve(manifest), baseUrl: pack => `/voice/${pack}/` });
  await voice.unlock('af_heart');
  await flush();
  return { voice, audio };
}

describe('the walk’s cue player (journey §9.2, B-01)', () => {
  it('unlocks its one element inside the tap, before anything is awaited', () => {
    const audio = fakeAudio();
    const voice = createCuePlayer({ audio: audio as unknown as HTMLAudioElement, manifest: () => Promise.resolve(MANIFEST), baseUrl: p => `/voice/${p}/` });
    void voice.unlock('af_heart');
    expect(audio.played).toHaveLength(1);
    expect(audio.played[0]).toMatch(/^data:audio\/wav/);
  });

  it('plays a recorded cue through that element', async () => {
    const { voice, audio } = await ready();
    expect(voice.status).toBe('ready');
    const said = voice.say(LINE);
    expect(audio.played.at(-1)).toBe(`/voice/af_heart/${clipKey(LINE)}.m4a`);
    audio.finish();
    expect(await said).toBe('ended');
  });

  it('skips a line with no recording, never reading it in the phone’s own voice (A-72)', async () => {
    const { voice, audio } = await ready();
    const before = audio.played.length;
    expect(await voice.say('A line nobody recorded.')).toBe('skipped');
    expect(audio.played).toHaveLength(before);
  });

  it('drops a cue the system interrupts, and never resumes it', async () => {
    const { voice, audio } = await ready();
    const said = voice.say(LINE);
    audio.interrupt();
    expect(await said).toBe('aborted');
  });

  it('stops at once when asked: pause, a hold, Finish, leaving the screen', async () => {
    const { voice, audio } = await ready();
    const said = voice.say(LINE);
    voice.cancel();
    expect(await said).toBe('aborted');
    expect(audio.paused).toBe(true);
  });

  it('lets a new cue cut off one still playing', async () => {
    const { voice, audio } = await ready();
    const first = voice.say(LINE);
    const second = voice.say(LINE);
    expect(await first).toBe('aborted');
    audio.finish();
    expect(await second).toBe('ended');
  });

  it('is not cut off by the pause it caused itself, which a browser reports a moment later', async () => {
    const { voice, audio } = await ready(fakeAudio({ queued: true }));
    const first = voice.say(LINE);
    const second = voice.say(LINE);
    expect(await first).toBe('aborted');
    // The first clip's own pause arrives now, with the second one playing.
    await flush();
    audio.finish();
    expect(await second).toBe('ended');
  });

  it('says when the browser refused the audio, so the screen can ask for a tap', async () => {
    const { voice } = await ready(fakeAudio({ blocked: true }));
    expect(voice.trouble).toBe('blocked');
  });

  it('is unavailable when its pack can’t be had, as offline before it was ever loaded', async () => {
    const { voice } = await ready(fakeAudio(), null);
    expect(voice.status).toBe('unavailable');
    expect(await voice.say(LINE)).toBe('skipped');
  });
});
