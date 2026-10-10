/**
 * The walks the shared start flow has just started (H6-04): the only way a
 * new walk reaches the live screen. The address's fields are choices, never
 * authorisation, so an arrival with no entry here — a link, a typed address,
 * a bookmark, a step back through history — goes through the start flow
 * instead, with its questions and B-01's sequence. Each entry is taken once.
 */
import type { WalkPlan } from './clock';
import { liveHref, newWalkId } from './plan';

const started = new Map<string, WalkPlan>();

/** The live walk's address for a walk the start flow starts now, its id made at this moment (B-01). */
export function startedHref(plan: WalkPlan, now: number = Date.now()): string {
  const id = newWalkId(now);
  started.set(id, plan);
  return liveHref(id, plan);
}

/** The plan the start flow started under this id, once; nothing for any other arrival. */
export function takeStarted(id: string): WalkPlan | undefined {
  const plan = started.get(id);
  started.delete(id);
  return plan;
}
