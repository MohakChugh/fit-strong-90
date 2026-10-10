/**
 * The walks the shared start flow has just started (H6-04): the only way a
 * new walk reaches the live screen. The address's fields are choices, never
 * authorisation, so an arrival with no entry here — a link, a typed address,
 * a bookmark, a step back through history — goes through the start flow
 * instead, with its questions and B-01's sequence. Only the latest start is
 * kept, and it is taken once: an earlier tap's address, left in history,
 * starts nothing (KH-14).
 */
import type { WalkPlan } from './clock';
import { liveHref, newWalkId } from './plan';

let latest: { id: string; plan: WalkPlan } | undefined;

/** The live walk's address for a walk the start flow starts now, its id made at this moment (B-01). */
export function startedHref(plan: WalkPlan, now: number = Date.now()): string {
  const id = newWalkId(now);
  latest = { id, plan };
  return liveHref(id, plan);
}

/** The plan the start flow started under this id, once; nothing for any other arrival. */
export function takeStarted(id: string): WalkPlan | undefined {
  if (latest?.id !== id) return undefined;
  const { plan } = latest;
  latest = undefined;
  return plan;
}
