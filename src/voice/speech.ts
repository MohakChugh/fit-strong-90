/**
 * Device speech (Web Speech API) with the workarounds from
 * docs/research/voice-narration.md §2: ranked voice choice, ≤ 140-character
 * chunks (Chrome's ~14 s cut-off), strong utterance references (Chrome GC),
 * a watchdog per utterance (lost events), and pause = cancel (Android).
 */

import type { Narrator, PlayResult } from './narrator';
import { estimateSpeechMs, SENTENCE_GAP_MS } from './estimate';

const NOVELTY = new Set(['Albert', 'Bad News', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos', 'Good News',
  'Jester', 'Organ', 'Superstar', 'Trinoids', 'Whisper', 'Wobble', 'Zarvox']);
const VERY_LOW = new Set(['Eddy', 'Flo', 'Grandma', 'Grandpa', 'Jacques', 'Reed', 'Rocko', 'Sandy', 'Shelley',
  'Fred', 'Junior', 'Kathy', 'Ralph']);
const APPLE_OK = new Set(['Samantha', 'Daniel', 'Karen', 'Moira', 'Tessa', 'Rishi', 'Ava', 'Zoe', 'Serena', 'Jamie', 'Allison', 'Susan', 'Tom']);
const norm = (l: string) => l.replace(/_/g, '-').toLowerCase();

export interface VoiceLike {
  name: string;
  lang: string;
  localService: boolean;
  voiceURI: string;
  default?: boolean;
}

export function loadVoices(synth: SpeechSynthesis, timeoutMs = 3000): Promise<SpeechSynthesisVoice[]> {
  if (synth.getVoices().length) return Promise.resolve(synth.getVoices());
  return new Promise(resolve => {
    const finish = () => {
      clearInterval(poll);
      clearTimeout(timer);
      synth.removeEventListener?.('voiceschanged', check);
      resolve(synth.getVoices());
    };
    const check = () => { if (synth.getVoices().length) finish(); };
    const poll = setInterval(check, 250);
    const timer = setTimeout(finish, timeoutMs);
    synth.addEventListener?.('voiceschanged', check);
  });
}

export function voiceScore<V extends VoiceLike>(v: V, lang = 'en-US', online = true): number {
  const want = norm(lang);
  const family = want.split('-')[0];
  const vl = norm(v.lang);
  const first = v.name.split(' (')[0].trim();
  if (!vl.startsWith(family) || NOVELTY.has(first) || VERY_LOW.has(first) || /espeak/i.test(v.name)) return -1;
  if (!v.localService && !online) return -1;
  let s = vl === want ? 20 : 10;
  if (/\bNatural\b/i.test(v.name)) s += 60;
  else if (/\bPremium\b/i.test(v.name)) s += 50;
  else if (/\bEnhanced\b/i.test(v.name)) s += 40;
  else if (/^Google\b/.test(v.name)) s += 30;
  else if (APPLE_OK.has(first)) s += 15;
  return s;
}

export function rankVoices<V extends VoiceLike>(voices: V[], lang = 'en-US', online = true): V[] {
  return voices
    .map(v => ({ v, s: voiceScore(v, lang, online) }))
    .filter(x => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .map(x => x.v);
}

export function pickVoice<V extends VoiceLike>(voices: V[], saved?: { uri?: string; name?: string }, online = true): V | null {
  const ranked = rankVoices(voices, 'en-US', online);
  return ranked.find(v => (saved?.uri && v.voiceURI === saved.uri) || (saved?.name && v.name === saved.name)) ?? ranked[0] ?? null;
}

/** Sentence chunks of at most `max` characters. */
export function chunkText(text: string, max = 140): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const out: string[] = [];
  for (let s of sentences.map(x => x.trim()).filter(Boolean)) {
    while (s.length > max) {
      const punct = Math.max(s.lastIndexOf(', ', max), s.lastIndexOf('; ', max));
      let at = punct > max * 0.4 ? punct + 1 : s.lastIndexOf(' ', max);
      if (at <= 0) at = max;
      out.push(s.slice(0, at).trim());
      s = s.slice(at).trim();
    }
    if (s) out.push(s);
  }
  return out;
}

export class SpeechNarrator implements Narrator {
  readonly kind = 'speech' as const;
  voice: SpeechSynthesisVoice | null = null;
  private readonly live = new Set<SpeechSynthesisUtterance>();
  private generation = 0;
  private readonly synth: SpeechSynthesis;
  private readonly Utterance: typeof SpeechSynthesisUtterance;
  rate: number;

  constructor(synth: SpeechSynthesis, rate = 0.85, Utterance: typeof SpeechSynthesisUtterance = globalThis.SpeechSynthesisUtterance) {
    this.synth = synth;
    this.rate = rate;
    this.Utterance = Utterance;
  }

  estimateMs(text: string): number {
    return estimateSpeechMs(text, this.rate);
  }

  /** Call synchronously inside the Start tap: iOS ignores speech until one starts in a gesture. */
  unlock(line = ' '): void {
    const u = new this.Utterance(line);
    u.volume = line.trim() ? 1 : 0;
    this.synth.speak(u);
  }

  async say(text: string, signal: AbortSignal): Promise<PlayResult> {
    const gen = ++this.generation;
    const onAbort = () => this.stop();
    signal.addEventListener('abort', onAbort, { once: true });
    try {
      const chunks = chunkText(text);
      for (const [i, chunk] of chunks.entries()) {
        if (signal.aborted || gen !== this.generation) return 'aborted';
        const r = await this.utter(chunk, gen);
        if (r === 'failed') return 'failed';
        // A calm pause between sentences (no SSML on the web).
        if (i < chunks.length - 1) await new Promise(res => setTimeout(res, SENTENCE_GAP_MS));
      }
      return signal.aborted ? 'aborted' : 'ended';
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
  }

  stop(): void {
    this.generation++;
    this.synth.cancel();
  }

  private utter(text: string, gen: number): Promise<PlayResult> {
    return new Promise(resolve => {
      const u = new this.Utterance(text);
      if (this.voice) { u.voice = this.voice; u.lang = this.voice.lang; }
      u.rate = this.rate;
      u.pitch = 1;
      let settled = false;
      const done = (r: PlayResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        this.live.delete(u);
        resolve(r);
      };
      u.onend = () => done('ended');
      u.onerror = (e: SpeechSynthesisErrorEvent | Event) => {
        const err = (e as SpeechSynthesisErrorEvent).error;
        done(err === 'interrupted' || err === 'canceled' ? 'aborted' : 'failed');
      };
      // Watchdog: events get lost (GC, suspension, queued after cancel()).
      const watchdog = setTimeout(() => {
        if (gen === this.generation && this.synth.speaking) this.synth.cancel();
        done('ended');
      }, this.estimateMs(text) * 1.5 + 2500);
      this.live.add(u);
      this.synth.speak(u);
    });
  }
}
