/**
 * The days the engine's rules can reach on a day (C2-05), as the engine reads
 * them: moved here from the walk's gate so the store can ask it too (a Replace
 * keeps this device's open incidents, H6-03) without the store depending on
 * the walk. Nothing else changed.
 */
import type { CheckInRecord } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import { answeredCheckIn, profileOnlyReadiness, stoppedIn } from './readiness';

const dayAfter = (date: string, n: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/**
 * Whether a day holds a serious reading the engine carries into later days —
 * a severe or extreme glucose, a low that needed help, high ketones, a
 * confirmed severe pressure — asked of the engine's own carried rules, with
 * the day's answers left out so it can only say yes too often, never too
 * rarely. Records do not change once made, so each is asked once.
 */
const carries = new WeakMap<CheckInRecord, boolean>();
function mayCarry(record: CheckInRecord, profile: UserProfile): boolean {
  let known = carries.get(record);
  if (known === undefined) {
    const { resolutions: _answers, ...bare } = record;
    void _answers;
    known = (profileOnlyReadiness(profile, { date: dayAfter(record.date, 1), recent: [bare] }).episodes?.length ?? 0) > 0;
    carries.set(record, known);
  }
  return known;
}

/**
 * The days the engine's rules can reach on `today` (C2-05), in their order:
 * today itself; the latest earlier day (yesterday's, when there is one, for
 * "two days running"); the last record that answered the check-in, whose
 * answers stand until a newer one answers them, past any day holding only
 * readings or a report (R5-07); the last day with a reach, for symptoms
 * spreading; every
 * day with a serious reading the engine carries; and every day holding
 * answers about readings. The engine reads nothing else, so the answers are
 * the same as from the whole history — at the cost of a handful of days, not
 * thousands, every second of a walk.
 */
export function reachableHistory(checkIns: readonly CheckInRecord[], today: string, profile: UserProfile): CheckInRecord[] {
  const keep = new Set<CheckInRecord>();
  let last: CheckInRecord | undefined;
  let lastAnswered: CheckInRecord | undefined;
  let lastReach: CheckInRecord | undefined;
  for (const c of checkIns) {
    if (c.date > today) continue;
    if (c.date === today) { keep.add(c); continue; }
    if (!last || c.date >= last.date) last = c;
    // The check-in whose answers stand, past any day with only readings or a report (R5-07).
    if (answeredCheckIn(c) && (!lastAnswered || c.date >= lastAnswered.date)) lastAnswered = c;
    if (c.back?.reach && (!lastReach || c.date >= lastReach.date)) lastReach = c;
    // A stop never answered holds from its day on (H6R-01).
    if (c.resolutions?.length || stoppedIn(c) || mayCarry(c, profile)) keep.add(c);
  }
  if (last) keep.add(last);
  if (lastAnswered) keep.add(lastAnswered);
  if (lastReach) keep.add(lastReach);
  return checkIns.filter(c => keep.has(c));
}

