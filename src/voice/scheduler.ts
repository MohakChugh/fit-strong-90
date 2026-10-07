/**
 * One voice channel, many cues (spec §7.3):
 *   P0 safety preempts everything; P1 timed cues preempt P2/P3 and are
 *   dropped when stale; P2 plays only if it fits before the next P1 (else its
 *   short variant, else caption-only); P3 fills leftover gaps.
 * Captions are emitted for every cue that becomes due, spoken or not.
 *
 * Cue ids are deterministic per step, so "already said" is keyed by the step's
 * visit as well: re-anchoring a schedule (a tick, a resume, "+15 s") never
 * repeats a line, while deliberately repeating or re-entering a step does.
 *
 * Coming back from a locked screen or a throttled tab drops everything whose
 * moment has passed and says one catch-up line: a burst of out-of-date
 * instructions in the earphones is worse than silence. P0 safety cues stay.
 */

import type { Cue } from '@/session/script';
import type { Narrator } from './narrator';

export interface TimedCue extends Cue {
  /** Absolute clock time the cue should start. */
  startAt: number;
}

export interface SchedulerEvents {
  onCaption?(text: string, cue: TimedCue): void;
  onSpeaking?(speaking: boolean): void;
  /**
   * The one line to say after the page was away, or null to stay quiet.
   * `awayMs` is the gap, in clock time.
   */
  catchUpLine?(now: number, awayMs: number): string | null;
}

/** Which step's cues are loaded, and which visit of it. */
export interface CueBatch {
  epoch?: number;
  stepId?: string;
}

const FIT_MARGIN_MS = 500;
/** A gap this long between ticks means the page was away (lock, throttling). */
const AWAY_MS = 4000;
/** Back from a gap: a cue whose moment passed this long ago is out of date. */
const STALE_ON_RETURN_MS = 1500;

export class CueScheduler {
  private queue: TimedCue[] = [];
  private current: { cue: TimedCue; controller: AbortController; endsAt: number } | null = null;
  private spoken = new Set<string>();
  private muted = false;
  private narrator: Narrator;
  private readonly events: SchedulerEvents;
  /** Visit number of the step whose cues are loaded. */
  private epoch = 0;
  private stepId: string | undefined;
  private lastTickAt: number | null = null;
  /** Non-safety cues anchored before this are out of date. */
  private horizon = -Infinity;
  /** Clock ms per real ms: 1 in production, more under a dev `?timescale`. */
  private readonly scale: number;
  private readonly awayMs: number;
  private readonly staleOnReturnMs: number;

  constructor(narrator: Narrator, events: SchedulerEvents = {}, opts: { timescale?: number } = {}) {
    this.narrator = narrator;
    this.events = events;
    // Windows and gaps are written in real time (cues' `staleAfterMs` in
    // script.ts too). Dev and end-to-end runs speed the clock up, so measure
    // them in clock time: unscaled, a 2.5 s window is shorter than one 4 Hz
    // tick at 30× and nearly every timed cue would be dropped.
    this.scale = opts.timescale && opts.timescale > 0 ? opts.timescale : 1;
    this.awayMs = AWAY_MS * this.scale;
    this.staleOnReturnMs = STALE_ON_RETURN_MS * this.scale;
  }

  setNarrator(n: Narrator): void {
    this.stop();
    this.narrator = n;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (m) this.stop();
  }

  /**
   * Replace pending cues (new step, pause/resume re-anchor, "+15 s"). A new
   * `epoch` means the user is visiting this step again, so its lines may repeat.
   */
  load(cues: TimedCue[], batch: CueBatch = {}): void {
    if (batch.epoch !== undefined && batch.epoch !== this.epoch) {
      this.stop(); // whatever is playing belongs to the previous visit
      this.epoch = batch.epoch;
    }
    this.stepId = batch.stepId;
    this.queue = cues
      .filter(c => !this.spoken.has(this.key(c.id)) && (c.priority === 0 || c.startAt >= this.horizon))
      .sort((a, b) => a.startAt - b.startAt || a.priority - b.priority);
  }

  /** Forget history (new session). */
  reset(): void {
    this.stop();
    this.queue = [];
    this.spoken.clear();
    this.horizon = -Infinity;
    this.lastTickAt = null;
  }

  stop(): void {
    if (this.current) {
      this.current.controller.abort();
      this.current = null;
      this.narrator.stop();
      this.events.onSpeaking?.(false);
    }
  }

  get busy(): boolean {
    return this.current !== null;
  }

  /**
   * Advance the schedule; call on every UI tick. `stepId` is the step the wall
   * clock is in: at a boundary the reducer has moved on while these cues are
   * still the last step's, and speaking them would talk over the new step.
   */
  tick(now: number, stepId?: string): void {
    const away = this.lastTickAt === null ? 0 : now - this.lastTickAt;
    this.lastTickAt = now;
    if (away >= this.awayMs) this.resync(now, away);
    if (stepId !== undefined && this.stepId !== undefined && stepId !== this.stepId) return;

    const due = this.queue.filter(c => c.startAt <= now);
    if (due.length === 0) return;

    // Drop stale timed cues; keep the rest in order.
    const fresh: TimedCue[] = [];
    for (const c of due) {
      const stale = c.staleAfterMs !== undefined && now - c.startAt > c.staleAfterMs * this.scale;
      if (stale) { this.consume(c); continue; }
      fresh.push(c);
    }
    if (fresh.length === 0) return;

    // Highest priority first (lower number), then earliest.
    fresh.sort((a, b) => a.priority - b.priority || a.startAt - b.startAt);
    const next = fresh[0];

    if (this.current) {
      const preempt = next.priority < this.current.cue.priority && next.priority <= 1;
      if (!preempt) return;
      this.stop();
    }

    // Will a P2/P3 line fit before the next timed cue?
    let text = next.say ?? next.text;
    if (next.priority >= 2) {
      const nextTimed = this.queue.find(c => c !== next && c.priority <= 1 && c.startAt > now);
      const room = nextTimed ? nextTimed.startAt - now - FIT_MARGIN_MS : Infinity;
      if (this.narrator.estimateMs(text) > room) {
        if (next.short && !next.say && this.narrator.estimateMs(next.short) <= room) text = next.short;
        else {
          this.events.onCaption?.(next.text, next);
          this.consume(next);
          return;
        }
      }
    }
    this.play(next, text, now);
  }

  /**
   * The session is back after a gap — locked screen, throttled tab, a pause
   * (spec §7.3): drop every cue whose moment has passed, then say one catch-up
   * line. Safety cues (P0) are never dropped. A blink is not a gap: cues keep
   * their place so a two-second pause doesn't lose the rest of an instruction.
   */
  resync(now: number, awayMs = this.lastTickAt === null ? 0 : Math.max(0, now - this.lastTickAt)): void {
    this.lastTickAt = now;
    if (awayMs < this.awayMs) return;
    this.horizon = Math.max(this.horizon, now - this.staleOnReturnMs);
    for (const c of this.queue.filter(c => c.priority > 0 && c.startAt < this.horizon)) this.consume(c);
    // A line that started before the gap is just as out of date.
    if (this.current && this.current.cue.priority > 0 && this.current.cue.startAt < this.horizon) this.stop();
    if (this.current) return; // a safety line is still playing; it matters more
    const line = this.events.catchUpLine?.(now, awayMs);
    if (line) this.play({ id: `catch-up-${now}`, text: line, priority: 1, seg: 0, offsetMs: 0, startAt: now, staleAfterMs: STALE_ON_RETURN_MS }, line, now);
  }

  private key(id: string): string {
    return `${this.epoch}:${id}`;
  }

  private consume(c: TimedCue): void {
    this.spoken.add(this.key(c.id));
    this.queue = this.queue.filter(x => x !== c);
  }

  private play(cue: TimedCue, text: string, now: number): void {
    this.consume(cue);
    this.events.onCaption?.(cue.text, cue);
    if (this.muted) return;
    const controller = new AbortController();
    this.current = { cue, controller, endsAt: now + this.narrator.estimateMs(text) };
    this.events.onSpeaking?.(true);
    this.narrator.say(text, controller.signal).finally(() => {
      if (this.current?.controller === controller) {
        this.current = null;
        this.events.onSpeaking?.(false);
      }
    });
  }
}
