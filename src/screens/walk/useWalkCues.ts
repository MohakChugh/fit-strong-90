import { useEffect, useRef } from 'react';
import { cueDue, cuesSaidBy } from '@/walk/cues';
import type { LiveSnapshot } from '@/walk/live';
import { walkVoice } from '@/walk/voice';

/**
 * The cues at 10, 20, 30, 45 and 60 minutes while the walk is recording and
 * the voice isn't muted (journey §9.2). A screen opened on a walk already past
 * a cue starts from there, so none is said twice. A pause, a hold, mute,
 * Finish and leaving the screen stop whatever is playing (B-01).
 */
export function useWalkCues(snapshot: LiveSnapshot | null, muted: boolean): void {
  const said = useRef<Set<number> | null>(null);
  const known = snapshot !== null;
  const recording = !!snapshot && snapshot.walk.status === 'running' && !snapshot.blocked;
  const observed = snapshot?.observedMs ?? 0;

  useEffect(() => {
    if (!known) return;
    said.current ??= cuesSaidBy(observed);
    const voice = walkVoice();
    if (!recording || muted) {
      voice.cancel();
      return;
    }
    const cue = cueDue(observed, said.current);
    if (!cue) return;
    said.current.add(cue.minute);
    void voice.say(cue.line);
  }, [known, recording, muted, observed]);

  useEffect(() => () => walkVoice().cancel(), []);
}
