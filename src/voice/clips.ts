/**
 * Pre-recorded neural narration (spec §7.2 phase 1): every sentence the coach
 * can say is rendered at build time; the phone just plays audio through one
 * reused <audio> element, so it sounds the same, human and calm, everywhere.
 *
 * Audio health (spec §7.3): a clip that never actually played — autoplay
 * blocked, a decode or network error, playback that does not start — is handed
 * to the next narrator in the chain and reported, never counted as spoken.
 */

import type { Narrator, PlayResult } from './narrator';
import { clipKey, splitSentences } from './sentences';
import { estimateSpeechMs, PLANNER_RATE } from './estimate';
import { packPace } from './packs';

export interface VoiceManifest {
  voice: string;
  engine: string;
  /** The renderer's speed knob, not a speech rate: never estimate with it. */
  speed: number;
  format: 'm4a';
  /** clip key → duration in ms */
  lines: Record<string, number>;
}

/**
 * Why the coach went quiet: blocked needs a tap, failed demotes the voice to
 * the phone's own, silent means neither could speak (captions only).
 */
export type VoiceTrouble = 'blocked' | 'failed' | 'silent';

/** 20 ms of silent 8-bit WAV, played inside a tap to unlock audio on iOS (not zero-length, which a decoder may refuse). */
const SILENCE = 'data:audio/wav;base64,UklGRsQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YaAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';

/**
 * Unlock an <audio> element: call synchronously inside a tap. iOS lets an
 * element that has played once in a gesture play again later, so the session
 * keeps one element and unlocks it on Start even before the voice pack arrives.
 * Returns whether the browser allowed it (false only for a refusal).
 */
export function primeAudio(audio: HTMLAudioElement): Promise<boolean> {
  audio.src = SILENCE;
  return audio.play().then(() => true, (err: unknown) => (err as { name?: string } | null)?.name !== 'NotAllowedError');
}

/** Playback must have started by now, or the clip is treated as failed (spec §7.3). */
const STALL_MS = 1500;

export async function loadManifest(baseUrl: string, signal?: AbortSignal): Promise<VoiceManifest | null> {
  try {
    const res = await fetch(`${baseUrl}manifest.json`, { signal });
    if (!res.ok) return null;
    const m = (await res.json()) as VoiceManifest;
    return m && m.lines && Object.keys(m.lines).length > 0 ? m : null;
  } catch {
    return null;
  }
}

export class ClipNarrator implements Narrator {
  readonly kind = 'clips' as const;
  readonly manifest: VoiceManifest;
  /** Next narrator in the chain: device speech, else captions. Set as voices load. */
  fallback: Narrator | null;
  private readonly baseUrl: string;
  private readonly audio: HTMLAudioElement;
  private readonly gapMs: number;
  /** Recorded length relative to the planner's estimate (packs.ts). */
  private readonly pace: number;
  private readonly onTrouble?: (trouble: VoiceTrouble | null) => void;
  private readonly urls = new Map<string, string>();
  private current: (() => void) | null = null;
  private trouble: VoiceTrouble | null = null;

  constructor(manifest: VoiceManifest, baseUrl: string, opts: { gapMs?: number; fallback?: Narrator | null; audio?: HTMLAudioElement; pace?: number; onTrouble?: (trouble: VoiceTrouble | null) => void } = {}) {
    this.manifest = manifest;
    this.baseUrl = baseUrl;
    this.gapMs = opts.gapMs ?? 750;
    this.fallback = opts.fallback ?? null;
    this.pace = opts.pace ?? packPace(manifest.voice) ?? 1;
    this.onTrouble = opts.onTrouble;
    this.audio = opts.audio ?? new Audio();
    this.audio.preload = 'auto';
  }

  has(sentence: string): boolean {
    return clipKey(sentence) in this.manifest.lines;
  }

  /** Share of sentences in `texts` that have a recorded clip (0–1). */
  coverage(texts: string[]): number {
    const s = texts.flatMap(splitSentences);
    return s.length ? s.filter(x => this.has(x)).length / s.length : 1;
  }

  estimateMs(text: string): number {
    const sentences = splitSentences(text);
    return sentences.reduce((t, s, i) => {
      // Unrecorded lines fall back to the planner's estimate at this pack's
      // measured pace, so gap fitting and step sizing agree.
      const d = this.manifest.lines[clipKey(s)] ?? Math.round(estimateSpeechMs(s, PLANNER_RATE) * this.pace);
      return t + d + (i < sentences.length - 1 ? this.gapMs : 0);
    }, 0);
  }

  /** Fetch clips ahead of time (a few MB per session) so playback never waits on the network. */
  async prefetch(texts: string[], signal?: AbortSignal, concurrency = 4): Promise<number> {
    const keys = [...new Set(texts.flatMap(splitSentences).map(clipKey))].filter(k => k in this.manifest.lines && !this.urls.has(k));
    let done = 0;
    const worker = async () => {
      while (keys.length && !signal?.aborted) {
        const k = keys.shift()!;
        try {
          const res = await fetch(`${this.baseUrl}${k}.${this.manifest.format}`, { signal });
          if (res.ok) {
            this.urls.set(k, URL.createObjectURL(await res.blob()));
            done++;
          }
        } catch {
          // Offline or aborted: playback falls back to the network URL or captions.
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    return done;
  }

  /** Call synchronously inside a user gesture (iOS blocks audio otherwise). */
  unlock(): void {
    // A line is playing or loading: the element is already unlocked, and
    // swapping in silence would cut it off.
    if (this.current) return;
    // Refused even inside a tap: the user needs to be asked to turn audio on.
    // Any other rejection (a clip superseding the silence) is not a block.
    void primeAudio(this.audio).then(ok => this.report(ok ? null : 'blocked'));
  }

  async say(text: string, signal: AbortSignal): Promise<PlayResult> {
    const sentences = splitSentences(text);
    let unheard = false;
    for (const [i, s] of sentences.entries()) {
      if (signal.aborted) return 'aborted';
      const key = clipKey(s);
      const recorded = key in this.manifest.lines ? await this.play(key, signal) : 'failed';
      // Nothing was heard: pass the line down the chain rather than skipping it.
      const r = recorded === 'failed' ? await this.speakFallback(s, signal) : recorded;
      if (r === 'aborted') return 'aborted';
      // Captions are silent too. A block stays reported: one tap fixes it.
      const voiced = recorded !== 'failed' || (r !== 'failed' && !!this.fallback && this.fallback.kind !== 'captions');
      if (!voiced) {
        unheard = true;
        if (this.trouble !== 'blocked') this.report('silent');
      }
      if (i < sentences.length - 1 && (await this.wait(this.gapMs, signal)) === 'aborted') return 'aborted';
    }
    return unheard ? 'failed' : 'ended';
  }

  stop(): void {
    this.current?.();
    this.current = null;
    try { this.audio.pause(); } catch { /* ignore */ }
    this.fallback?.stop();
  }

  private speakFallback(sentence: string, signal: AbortSignal): Promise<PlayResult> {
    return this.fallback
      ? this.fallback.say(sentence, signal)
      : this.wait(this.estimateMs(sentence), signal);
  }

  private report(trouble: VoiceTrouble | null): void {
    if (trouble === this.trouble) return;
    this.trouble = trouble;
    this.onTrouble?.(trouble);
  }

  private play(key: string, signal: AbortSignal): Promise<PlayResult> {
    return new Promise(resolve => {
      const a = this.audio;
      let settled = false;
      let blocked = false;
      const finish = (r: PlayResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        clearTimeout(stall);
        a.onended = null;
        a.onerror = null;
        a.onplaying = null;
        signal.removeEventListener('abort', onAbort);
        if (this.current === cancel) this.current = null;
        if (r === 'failed') {
          try { a.pause(); } catch { /* ignore */ }
          // A block lasts until sound actually plays (or a tap unlocks it): a
          // later load error mustn't hide the button that fixes it.
          this.report(blocked || this.trouble === 'blocked' ? 'blocked' : 'failed');
        } else if (r === 'ended') {
          this.report(null);
        }
        resolve(r);
      };
      const cancel = () => finish('aborted');
      const onAbort = () => { try { a.pause(); } catch { /* ignore */ } finish('aborted'); };
      this.current = cancel;
      signal.addEventListener('abort', onAbort, { once: true });
      let started = false;
      a.onended = () => finish('ended');
      a.onerror = () => finish('failed');
      // Sound is actually coming out: any earlier "tap to turn the voice on" is stale.
      a.onplaying = () => { started = true; this.report(null); };
      // Watchdog: never stall a session on a lost "ended" event.
      const watchdog = setTimeout(() => finish('ended'), (this.manifest.lines[key] ?? 4000) + 2500);
      // Health check: playback that never starts falls through to the next
      // narrator. `paused` turns false as soon as play() is called, even while
      // the clip is still buffering, so judge by progress instead.
      const stall = setTimeout(() => { if (!started && !a.currentTime) finish('failed'); }, STALL_MS);
      a.src = this.urls.get(key) ?? `${this.baseUrl}${key}.${this.manifest.format}`;
      a.currentTime = 0;
      void a.play().catch((err: unknown) => {
        blocked = (err as { name?: string } | null)?.name === 'NotAllowedError';
        finish('failed');
      });
    });
  }

  private wait(ms: number, signal: AbortSignal): Promise<PlayResult> {
    return new Promise(resolve => {
      if (signal.aborted) return resolve('aborted');
      const t = setTimeout(() => resolve('ended'), ms);
      signal.addEventListener('abort', () => { clearTimeout(t); resolve('aborted'); }, { once: true });
    });
  }
}
