/**
 * Narrator chain (spec §7.3): clips → device speech → captions only.
 * Every narrator resolves even if the platform never reports completion,
 * so a silent or broken voice can never stall a session (Review Focus #5).
 */

import { estimateSpeechMs } from './estimate';

export type PlayResult = 'ended' | 'aborted' | 'failed';

export interface Narrator {
  readonly kind: 'clips' | 'speech' | 'captions';
  /** Speak one line. Resolves when finished, aborted via the signal, or failed. */
  say(text: string, signal: AbortSignal): Promise<PlayResult>;
  /** Stop anything playing now. */
  stop(): void;
  estimateMs(text: string): number;
}

/** Captions only: "speaks" for the estimated duration so pacing stays identical. */
export class CaptionNarrator implements Narrator {
  readonly kind = 'captions' as const;
  private readonly rate: number;
  private readonly setTimer: typeof setTimeout;

  constructor(rate = 0.85, setTimer: typeof setTimeout = setTimeout) {
    this.rate = rate;
    this.setTimer = setTimer;
  }

  estimateMs(text: string): number {
    return estimateSpeechMs(text, this.rate);
  }

  say(text: string, signal: AbortSignal): Promise<PlayResult> {
    return new Promise(resolve => {
      if (signal.aborted) return resolve('aborted');
      const t = this.setTimer(() => resolve('ended'), this.estimateMs(text));
      signal.addEventListener('abort', () => { clearTimeout(t); resolve('aborted'); }, { once: true });
    });
  }

  stop(): void {}
}
