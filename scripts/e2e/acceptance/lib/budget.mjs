/**
 * The live route's budget, as one check the journey proves first that it can
 * fail (PERF01, board D117, Codex P8-25, P8R-15): the most redraws timed
 * within any 950 ms, so a burst can't hide inside an average over a longer
 * time. The window is a little under a second for the throttle's own timer.
 */
export const busiestSecond = (times, windowMs = 950) => times.reduce((most, t0) => Math.max(most, times.filter(t => t >= t0 && t < t0 + windowMs).length), 0);
export const withinRedrawBudget = times => busiestSecond(times) <= 1;
