/** The walk's spoken cues (Task 9 fills this in). */
import type { VoiceTrouble } from '@/voice/clips';
import type { PlayResult } from '@/voice/narrator';

export type CueResult = PlayResult | 'skipped';
export type VoiceStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface WalkVoice {
  unlock(pack: string): Promise<boolean>;
  say(line: string): Promise<CueResult>;
  cancel(): void;
  readonly trouble: VoiceTrouble | null;
  readonly status: VoiceStatus;
  subscribe(listener: () => void): () => void;
}

const SILENT: WalkVoice = {
  unlock: () => Promise.resolve(false),
  say: () => Promise.resolve('skipped'),
  cancel() {},
  trouble: null,
  status: 'idle',
  subscribe: () => () => {},
};

export function walkVoice(): WalkVoice {
  return SILENT;
}
