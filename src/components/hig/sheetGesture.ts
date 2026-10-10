/**
 * Swipe-to-dismiss for a sheet, as iOS does it: the sheet follows the finger
 * down, and on release it closes when it was pulled far enough or flicked,
 * and otherwise settles back. Upward it barely gives, since there is no
 * taller detent to drag it to.
 */

/** Pulled down this far — a share of the sheet, or this many pixels on a tall one — it closes. */
const DISMISS_SHARE = 0.3;
const DISMISS_MAX_PX = 200;
/** A flick: downward speed in px/ms, over at least a short pull. */
const FLICK_SPEED = 0.6;
const FLICK_MIN_PX = 16;
/** A finger held still before letting go is not a flick. */
const STILL_MS = 100;
/** Up, the sheet moves a sixth of the drag, and no more than this. */
const UP_MAX_PX = 16;

/** While the sheet cannot be dismissed, down gives no more than this. */
const HELD_MAX_PX = 24;

/**
 * Where the sheet sits for a drag of `dy` (down positive). A sheet that cannot
 * be dismissed right now gives a little either way, so the drag says "not now".
 */
export function dragOffset(dy: number, dismissible = true): number {
  if (dy < 0) return -Math.min(UP_MAX_PX, -dy / 6);
  return dismissible ? dy : Math.min(HELD_MAX_PX, dy / 6);
}

/** The speed to judge a release by: the last movement's, unless the finger then rested. */
export function releaseVelocity(velocity: number, msSinceLastMove: number): number {
  return msSinceLastMove > STILL_MS ? 0 : velocity;
}

/** Whether letting go closes the sheet. */
export function shouldDismiss({ distance, velocity, height }: { distance: number; velocity: number; height: number }): boolean {
  if (distance <= 0) return false;
  if (distance >= Math.min(height * DISMISS_SHARE, DISMISS_MAX_PX)) return true;
  return velocity >= FLICK_SPEED && distance >= FLICK_MIN_PX;
}

/** Smoothed speed from the previous estimate and the latest movement. */
export function nextVelocity(previous: number, dy: number, dt: number): number {
  if (dt <= 0) return previous;
  return 0.8 * (dy / dt) + 0.2 * previous;
}

/** What a drag moves: the sheet, and the dimmed page behind it when there is one. */
export interface SwipeTarget {
  panel: { style: { transform: string; transition: string }; offsetHeight: number };
  backdrop: { style: { opacity: string; transition: string } } | null;
}

export interface SwipeOptions {
  /** Ask the sheet to close: its `onOpenChange(false)`, which may refuse. */
  dismiss(): void;
  /** Whether the sheet is still open once it has answered. */
  isOpen(): boolean;
  /** False while the sheet must stay, such as while it saves. */
  dismissible(): boolean;
  /** Runs `answered` once what `dismiss` set off has been drawn. */
  afterAnswer(answered: () => void): void;
}

/** The drag itself, kept apart from the DOM so it can be tested. */
export function createSwipe(options: SwipeOptions) {
  let drag: (SwipeTarget & { id: number; startY: number; lastY: number; lastT: number; velocity: number }) | null = null;
  const settle = (d: SwipeTarget, away: boolean) => {
    d.panel.style.transition = '';
    d.panel.style.transform = away ? 'translate3d(0, 100%, 0)' : '';
    if (d.backdrop) {
      d.backdrop.style.transition = '';
      d.backdrop.style.opacity = away ? '0' : '';
    }
  };
  const take = (id: number) => {
    const d = drag?.id === id ? drag : null;
    if (d) drag = null;
    return d;
  };
  return {
    start(id: number, y: number, t: number, target: SwipeTarget) {
      drag = { ...target, id, startY: y, lastY: y, lastT: t, velocity: 0 };
      target.panel.style.transition = 'none';
      if (target.backdrop) target.backdrop.style.transition = 'none';
    },
    move(id: number, y: number, t: number) {
      const d = drag?.id === id ? drag : null;
      if (!d) return;
      d.velocity = nextVelocity(d.velocity, y - d.lastY, t - d.lastT);
      d.lastY = y;
      d.lastT = t;
      const offset = dragOffset(y - d.startY, options.dismissible());
      d.panel.style.transform = `translate3d(0, ${offset}px, 0)`;
      // The page behind brightens as the sheet goes, as it will when it closes.
      if (d.backdrop) d.backdrop.style.opacity = String(Math.max(0, 1 - Math.max(0, offset) / d.panel.offsetHeight));
    },
    end(id: number, y: number, t: number) {
      const d = take(id);
      if (!d) return;
      const asked = options.dismissible()
        && shouldDismiss({ distance: y - d.startY, velocity: releaseVelocity(d.velocity, t - d.lastT), height: d.panel.offsetHeight });
      if (!asked) {
        settle(d, false);
        return;
      }
      // Ask first, and go only on a yes. A sheet that will not close yet — one
      // saving — settles back in view, rather than sliding away while it stays
      // open over an inert page with its result unseen (review C2-07).
      options.dismiss();
      options.afterAnswer(() => settle(d, !options.isOpen()));
    },
    cancel(id: number) {
      const d = take(id);
      if (d) settle(d, false);
    },
  };
}
