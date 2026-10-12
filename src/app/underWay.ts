/**
 * What is under way in this window, which a restart would lose (board D106,
 * Codex P8S-12): a write not yet stored, a change to the phone's clock not
 * yet stored (Plan 6's H6F-02), a walk not yet saved or discarded, a
 * guided session or a stretch begun and not finished, or a manual workout
 * begun and not finished. A session's run is the progress it keeps as it goes
 * (`loadProgress`: real, unfinished and still resumable); while it stands,
 * the session is the person's to finish or discard before any restart.
 */
import { clockChangeWaiting, getState } from '@/store/useStore';
import { loadProgress } from '@/session/persistence';
import { peekWalk } from '@/walk/persist';
import { workoutUnderWay } from '@/screens/workout/underWay';

const sessionUnderWay = (now: number): boolean => loadProgress(now, 'guided') !== null || loadProgress(now, 'stretch') !== null;

export const underWay = (): boolean =>
  getState().saving || clockChangeWaiting() || peekWalk() !== null || sessionUnderWay(Date.now()) || workoutUnderWay();
