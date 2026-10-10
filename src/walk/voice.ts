/**
 * The walk's spoken cues (journey §9.2, A-72, B-01): recorded Kokoro lines
 * only, through one audio element that the tap starting the walk unlocks
 * (Task 8). A line with no recording is skipped. Anything playing stops on
 * pause, a hold, Finish, leaving the screen, or when the system takes the
 * audio (a call, headphones out), and is never resumed.
 */
import { ClipNarrator, loadManifest, primeAudio, type VoiceManifest, type VoiceTrouble } from '@/voice/clips';
import type { PlayResult } from '@/voice/narrator';
import { WALK_CUES } from './cues';

export type CueResult = PlayResult | 'skipped';
export type VoiceStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface WalkVoice {
  /** Call synchronously in the tap that starts the walk: unlocks the element, then loads the pack. Resolves whether audio was allowed. */
  unlock(pack: string): Promise<boolean>;
  /** Say one recorded line now, cutting off any still playing. */
  say(line: string): Promise<CueResult>;
  /** Stop and drop whatever is playing. */
  cancel(): void;
  /** Why the voice is quiet, if it is. `blocked` needs a tap on "Turn the voice on". */
  readonly trouble: VoiceTrouble | null;
  readonly status: VoiceStatus;
  subscribe(listener: () => void): () => void;
}

export interface CuePlayerDeps {
  audio: HTMLAudioElement;
  /** The pack's manifest, or null when it can't be had. */
  manifest(pack: string): Promise<VoiceManifest | null>;
  baseUrl(pack: string): string;
}

export function createCuePlayer(deps: CuePlayerDeps): WalkVoice {
  let narrator: ClipNarrator | null = null;
  let pack: string | undefined;
  let status: VoiceStatus = 'idle';
  let trouble: VoiceTrouble | null = null;
  let current: AbortController | null = null;
  const listeners = new Set<() => void>();
  const changed = () => { for (const l of listeners) l(); };
  const report = (t: VoiceTrouble | null) => {
    if (t === trouble) return;
    trouble = t;
    changed();
  };

  function cancel() {
    const playing = current;
    current = null;
    playing?.abort();
    narrator?.stop();
  }

  // The system pausing the element mid-line drops the cue. A clip that simply
  // ended pauses too, with `ended` set, and isn't an interruption. Nor is a
  // pause this player made itself: a browser reports it a moment later, by
  // which time the next line may be playing, so the element isn't paused.
  deps.audio.addEventListener('pause', () => {
    if (current && deps.audio.paused && !deps.audio.ended) cancel();
  });

  function load(next: string) {
    if (pack === next && status !== 'unavailable') return;
    pack = next;
    status = 'loading';
    changed();
    void deps.manifest(next).then(m => {
      if (pack !== next) return;
      narrator = m ? new ClipNarrator(m, deps.baseUrl(next), { audio: deps.audio, fallback: null, onTrouble: report }) : null;
      status = m ? 'ready' : 'unavailable';
      changed();
      // Five short clips, fetched now: the voice cache then plays them offline (V-J16).
      void narrator?.prefetch(WALK_CUES.map(c => c.line));
    });
  }

  return {
    unlock(next) {
      // A line playing proves the element is unlocked, and silence would cut it off.
      const allowed = current ? Promise.resolve(true) : primeAudio(deps.audio);
      load(next);
      return allowed.then(ok => {
        report(ok ? null : 'blocked');
        return ok;
      });
    },
    say(line) {
      if (!narrator?.has(line)) return Promise.resolve<CueResult>('skipped');
      cancel();
      const c = new AbortController();
      current = c;
      return narrator.say(line, c.signal).finally(() => {
        if (current === c) current = null;
      });
    },
    cancel,
    get trouble() { return trouble; },
    get status() { return status; },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

const SILENT: WalkVoice = {
  unlock: () => Promise.resolve(false),
  say: () => Promise.resolve('skipped'),
  cancel() {},
  trouble: null,
  status: 'idle',
  subscribe: () => () => {},
};

let player: WalkVoice | undefined;

/** The page's one cue player. With no audio element (tests, an old browser), it stays silent. */
export function walkVoice(): WalkVoice {
  if (player) return player;
  if (typeof Audio === 'undefined') return SILENT;
  const baseUrl = (pack: string) => `${import.meta.env.BASE_URL}voice/${pack}/`;
  player = createCuePlayer({ audio: new Audio(), manifest: pack => loadManifest(baseUrl(pack)), baseUrl });
  return player;
}
