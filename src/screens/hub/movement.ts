/**
 * A movement hub's Right now card (journey §7.5, "In its hub"; §8.3, §8.4).
 *
 * It reads the shared gate as Home's Right now card does (`gateOf`) and says
 * it in the tile's own words (`movementLine`), so a hub can never offer what
 * its tile or Home would refuse (§4.2, K-04, A-08). It decides nothing: an
 * action that could start movement is a `gate` target (`actionTarget`), which
 * the hub sends through `useStartMovement().start`, where the gate is asked
 * again at the tap.
 */
import { walkingHeldForFeet } from '@/categories';
import { defaultStartLabel, headline } from '@/components/checkin/copy';
import { PERMISSION_TEXT, type Mode, type Permission } from '@/engine/permission';
import { HREF, type Gate } from '@/health/recommend';
import type { Status } from '@/health/status';
import type { UserSettings } from '@/types';
import type { SessionPlan, StretchFocus } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { checkInOnly, type TileLine } from '@/screens/home/tileLine';
import { startLabelFor } from '@/screens/today/model';

export type HubActionKind =
  | 'start' | 'continue' | 'review' | 'anyway' | 'mobility' | 'justWalk'
  | 'profile' | 'join' | 'stretch' | 'status' | 'otherTime'
  /** Walk: the walk still on this device, carried on (a restart, through the gate), reviewed and saved, or ended there and reviewed. */
  | 'carryOn' | 'saveWalk' | 'finishWalk'
  /** Stretch: back to the area and length, when the builder can't make this routine today. */
  | 'chooseRoutine'
  /** Workout, after the twelve weeks: Your plan's two choices (D116). */
  | 'next';

export interface HubAction {
  kind: HubActionKind;
  label: string;
  /** Shown but not usable yet; the card's `note` says why. */
  disabled?: boolean;
}

export type CardState = 'go' | 'checkIn' | 'resume' | 'rest' | 'join' | 'held' | 'gap' | 'stopped' | 'paused' | 'unsaved' | 'unbuildable' | 'done';

export interface HubCard {
  state: CardState;
  tone: 'normal' | 'caution' | 'stop' | 'quiet';
  title: string;
  /** What it is: "mobility, strength and cardio", "6 min left · Back & hips stretch". */
  detail?: string;
  /** Today's word for it, when it adds something: "Gentle only today", "With changes for today". */
  today?: string;
  /** Why this, from real inputs only (D20). */
  reason?: string;
  /** The gate's own sentences while it refuses, said in a status region. */
  reasons: string[];
  release?: string;
  /** Allowed with changes: each one (§7.5, "Start, with the changes listed"). */
  restrictions: string[];
  primary?: HubAction;
  secondary: HubAction[];
  /** Under the primary button: "A short check-in comes first." */
  note?: string;
}

export interface CardInput {
  mode: Mode;
  /** The gate's answer for this mode now (`useStartMovement().permissionFor`). */
  permission: Permission;
  /** That answer read as Home's card reads it (`gateOf`). */
  gate: Gate;
  status: Status;
  /** The tile's line for this mode (`movementLine`), word for word. */
  line: TileLine;
  /** What is on offer: "Back & hips · 10 min", "Full Body B · 45 min", "Just a walk". */
  title: string;
  detail?: string;
  reason?: string;
  /**
   * Unanswered profile questions, as the gate reads them (`profileGaps`), and
   * while setup is unfinished the safety chapter it still asks, in words
   * (`askAbout`: "Answer 2 questions about your back and feet"; K5-07).
   */
  gaps: { healthUnreviewed: boolean; medicinesUnknown: boolean; ask?: string };
  /** The stretch gate allows a start, or needs only a check-in: "Stretch instead" is honest. */
  stretchOpen: boolean;
  /** Workout: in the programme (D35). */
  enrolled?: boolean;
  /** Workout: the twelve weeks are over (D116). */
  done?: boolean;
  /** Workout: today's session is the recovery one. */
  recovery?: boolean;
  /** Workout: today is a rest day; `mobility` when it offers the optional rest-day session. */
  rest?: { mobility: boolean };
  /** A run saved today that the status allows to continue (`resumeAllowed`): what is left of it as it would run now (`carriedOn`). */
  saved?: { minutesLeft: number; label: string };
  /** Stretch: the routine can't be put together today, in the builder's words. */
  blocked?: string;
  /** The start waits for a choice on this screen, in words: "Choose the meal to start." */
  waiting?: string;
  /** Walk, B-09: "A walk after lunch" and "I had lunch at 1:10 pm: walk now". */
  afterMeal?: { title: string; label: string };
}

const REVIEW: HubAction = { kind: 'review', label: 'Review today’s check-in' };
const PAUSED: Record<'away' | 'unwell', string> = { away: 'Paused while you’re away', unwell: 'Paused while you’re unwell' };
const NOUN: Record<Mode, string> = { guided: 'session', stretch: 'stretch', walk: 'walk' };

/**
 * The card, in the copy table's order. A stop outranks status, and status
 * outranks every hold. A profile gap comes next, then any other hold or
 * re-check, both before the programme's Join, so the Workout tile and its hub
 * always say them alike (§4.2). A hold only today's check-in answers leaves
 * the Join in place, as the tile names no check-in outside the programme.
 * Only then is anything offered (journey §7.5, as `movementLine`).
 */
export function movementCard(i: CardInput): HubCard {
  const p = i.permission;
  const empty = { reasons: [] as string[], restrictions: [] as string[], secondary: [] as HubAction[] };
  const refusal = { reasons: p.reasons, ...(p.release ? { release: p.release } : {}) };
  const instead: HubAction[] = i.mode !== 'stretch' && i.stretchOpen ? [{ kind: 'stretch', label: 'Stretch instead' }] : [];

  if (i.gate === 'emergency' || i.gate === 'today') {
    return { ...empty, ...refusal, state: 'stopped', tone: 'stop', title: headline(p).title, secondary: [REVIEW] };
  }
  if (i.status === 'away' || i.status === 'unwell') {
    return {
      ...empty, state: 'paused', tone: 'quiet', title: PAUSED[i.status], detail: i.title,
      primary: { kind: 'status', label: 'Change status' }, secondary: [{ kind: 'anyway', label: 'Start anyway' }],
    };
  }
  if (!p.allowed && (i.gaps.healthUnreviewed || i.gaps.medicinesUnknown)) {
    const chapter = i.gaps.healthUnreviewed ? 'your health' : 'your medicines';
    return {
      // Home's card for the same gap (`profileFirst`), and before the programme's Join, as the tile says it (§4.2).
      ...empty, ...refusal, state: 'gap', tone: 'caution', title: i.gaps.healthUnreviewed ? 'Finish your health profile' : 'Your diabetes medicines',
      primary: { kind: 'profile', label: i.gaps.ask ?? `Answer the questions about ${chapter}` }, secondary: [REVIEW],
    };
  }
  // Outside the programme nothing starts and there is nothing to check in for (D35): any hold the tile says is the card's.
  const outsideHold = i.mode === 'guided' && i.enrolled === false && !p.allowed && !checkInOnly(p);
  if (i.gate === 'hold' || i.gate === 'recheck' || outsideHold) {
    const recheck = i.gate === 'recheck';
    return {
      // The gate's own headline, as Home's card and the check-in say it; a re-check adds when it is due, in the tile's words.
      // Before the programme's Join too, so the Workout tile and its hub always say the hold alike (§4.2).
      ...empty, ...refusal, state: 'held', tone: 'caution', title: headline(p).title, ...(recheck ? { detail: i.line.text } : {}),
      ...(recheck ? { primary: { kind: 'review', label: 'Enter a new reading' } as HubAction } : {}),
      secondary: [...(recheck ? [] : [REVIEW]), ...instead],
    };
  }
  if (i.mode === 'guided' && i.enrolled === false) {
    const join: HubAction = { kind: 'join', label: 'Join the 12-week programme' };
    const flare = i.status === 'flare' && instead.length > 0;
    return {
      ...empty, state: 'join', tone: 'normal', title: 'The 12-week programme', detail: 'Not joined. Stretch and Walk work without it.',
      ...(flare ? { today: 'Stretch is suggested today', primary: instead[0], secondary: [join] } : { primary: join, secondary: instead }),
    };
  }
  if (i.blocked) {
    // Not a refusal: the gate allows a stretch, and another area or length may be made, so the choices stay (kiro KH-01).
    return { ...empty, state: 'unbuildable', tone: 'caution', title: i.title, reasons: [i.blocked], secondary: [{ kind: 'chooseRoutine', label: 'Choose another routine' }] };
  }
  const go = i.gate === 'go';
  // A flare's own words, as on the tile; the button already says a check-in comes first.
  const flare = i.status !== 'flare' ? undefined : i.mode === 'walk' ? 'Stretch is suggested today' : i.line.text.replace(/ · check in first$/, '');
  const changed = go && p.disposition === 'adjust' && p.restrictions.length > 0;
  const today = flare ? { today: flare } : changed ? { today: 'With changes for today' } : {};
  if (i.saved) {
    // Carried on, it runs under today's words and changes, as a new start would (codex H2-02): the minutes are what is left as re-dosed now.
    return {
      ...empty, state: 'resume', tone: 'normal', title: `Continue your ${NOUN[i.mode]}`, detail: `${i.saved.minutesLeft} min left · ${i.saved.label}`,
      ...today,
      reason: 'You stopped part-way through. It picks up where you left off.',
      restrictions: changed ? p.restrictions : [],
      primary: { kind: 'continue', label: go ? `Continue ${NOUN[i.mode]}` : 'Check in & continue' },
    };
  }
  if (i.mode === 'guided' && i.done) {
    // After the twelve weeks nothing is planned or started here; the choice is the person's (D116).
    return {
      ...empty, state: 'done', tone: 'normal', title: 'The 12 weeks are done', detail: 'Stretch and Walk carry on as before.',
      primary: { kind: 'next', label: 'Choose what’s next' }, secondary: instead,
    };
  }
  if (i.rest) {
    return {
      ...empty, state: 'rest', tone: 'normal', title: 'Rest day', ...(i.detail ? { detail: i.detail } : {}),
      ...(instead.length > 0 ? { primary: instead[0] } : {}),
      secondary: i.rest.mobility ? [{ kind: 'mobility', label: 'Start rest-day mobility' }] : [],
    };
  }
  const label = i.afterMeal?.label ?? (go ? defaultStartLabel(i.mode, i.recovery === true) : 'Check in & start');
  const note = i.waiting ?? (i.afterMeal && !go ? 'A short check-in comes first.' : undefined);
  return {
    ...empty, state: go ? 'go' : 'checkIn', tone: 'normal', title: i.afterMeal?.title ?? i.title,
    ...(i.detail ? { detail: i.detail } : {}),
    ...today,
    ...(i.reason ? { reason: i.reason } : {}),
    restrictions: changed ? p.restrictions : [],
    primary: { kind: 'start', label, ...(i.waiting ? { disabled: true } : {}) },
    ...(note ? { note } : {}),
    secondary: [
      ...(i.afterMeal ? [{ kind: 'otherTime', label: 'Different time' } as HubAction, { kind: 'justWalk', label: 'Just a walk' } as HubAction] : []),
      ...(i.status === 'flare' ? instead : []),
    ],
  };
}

export interface PendingWalkInput {
  /** `inProgress`: not finished, so carrying it on is a restart. `unsaved`: finished, waiting to be saved. */
  state: 'inProgress' | 'unsaved';
  /** When it started, as the clock reads it: "9:00 am". */
  started: string;
  permission: Permission;
  gate: Gate;
  status: Status;
  gaps: CardInput['gaps'];
  stretchOpen: boolean;
}

const SAVE_WALK: HubAction = { kind: 'saveWalk', label: 'Review and save' };
/** The walk ended where it stopped recording, then its summary: nothing more is recorded (the screen was closed). */
const FINISH_WALK: HubAction = { kind: 'finishWalk', label: 'Review and save' };
const CHANGE_STATUS: HubAction = { kind: 'status', label: 'Change status' };
const KEPT = 'Nothing has been recorded since the walk screen closed. Save what was recorded, or discard it.';

/**
 * The Walk hub's card while a walk is still on this device, before any new
 * walk (codex W-04). Saving is never movement, so a walk waiting to be saved
 * is always offered for review. Carrying one on is a restart, so status
 * comes first, as v1's resume policy says (journey §4.8, A-34,
 * `resumeAllowed`): no Carry on while Away or Unwell, and during a flare only
 * a stretch is carried on. Then the gate's own answer, in the copy table's
 * order (a stop, a profile gap, a hold), and only then "Return to walk",
 * which the hub still sends through the gate at the tap (§4.1). Whenever it
 * can't be carried on, what was recorded can still be reviewed and saved.
 */
export function pendingWalkCard(i: PendingWalkInput): HubCard {
  const p = i.permission;
  const empty = { reasons: [] as string[], restrictions: [] as string[], secondary: [] as HubAction[] };
  const started = `Started ${i.started}`;
  if (i.state === 'unsaved') {
    return { ...empty, state: 'unsaved', tone: 'normal', title: 'A walk is waiting to be saved', detail: started, note: 'Nothing is in your record until you save it.', primary: SAVE_WALK };
  }
  const refusal = { reasons: p.reasons, ...(p.release ? { release: p.release } : {}) };
  // Today's check-in leads on to carrying the walk on once it allows, so it is offered only where status would let it.
  const carryOn = resumeAllowed(i.status, 'walk');
  if (i.gate === 'emergency' || i.gate === 'today') {
    return { ...empty, ...refusal, state: 'stopped', tone: 'stop', title: headline(p).title, detail: started, primary: FINISH_WALK, secondary: carryOn ? [REVIEW] : [] };
  }
  if (i.status === 'away' || i.status === 'unwell') {
    const why = `A walk isn’t carried on while you’re ${i.status}.`;
    return { ...empty, state: 'paused', tone: 'quiet', title: PAUSED[i.status], detail: started, reasons: [why, KEPT], primary: FINISH_WALK, secondary: [CHANGE_STATUS] };
  }
  if (!carryOn) {
    return {
      ...empty, state: 'paused', tone: 'quiet', title: 'A walk is in progress', detail: started, today: 'Stretch is suggested today',
      reasons: ['During a flare-up only a stretch is carried on.', KEPT],
      primary: FINISH_WALK, secondary: [...(i.stretchOpen ? [{ kind: 'stretch', label: 'Stretch instead' } as HubAction] : []), CHANGE_STATUS],
    };
  }
  if (!p.allowed && (i.gaps.healthUnreviewed || i.gaps.medicinesUnknown)) {
    const chapter = i.gaps.healthUnreviewed ? 'your health' : 'your medicines';
    return {
      ...empty, ...refusal, state: 'gap', tone: 'caution', title: i.gaps.healthUnreviewed ? 'Finish your health profile' : 'Your diabetes medicines', detail: started,
      // While setup is unfinished, the chapter it still asks, as the hub's own card names it (K5-07).
      primary: FINISH_WALK, secondary: [{ kind: 'profile', label: i.gaps.ask ?? `Answer the questions about ${chapter}` }, REVIEW],
    };
  }
  if (i.gate === 'hold' || i.gate === 'recheck') {
    return {
      ...empty, ...refusal, state: 'held', tone: 'caution', title: headline(p).title, detail: started, primary: FINISH_WALK,
      secondary: [i.gate === 'recheck' ? { kind: 'review', label: 'Enter a new reading' } : REVIEW],
    };
  }
  return {
    ...empty, state: 'resume', tone: 'normal', title: 'A walk is in progress', detail: `${started}. Nothing is recorded while the walk screen is closed.`,
    primary: { kind: 'carryOn', label: 'Return to walk' },
    ...(i.gate === 'checkIn' ? { note: 'A short check-in comes first.' } : {}),
  };
}

/** Where a card's action leads. Only `gate` targets can start movement, and only through `start`. */
export type ActionTarget =
  | { via: 'gate'; mode: Mode; href: string; label: string }
  | { via: 'go'; to: string }
  | { via: 'status' }
  | { via: 'local' };

export interface ActionContext {
  mode: Mode;
  /** Where Start leads once the gate allows it: the player, or the live walk for what is chosen. */
  href: string;
  /** The check-in sheet's Start, when the gate asks for a check-in first. */
  startLabel: string;
  /** A saved run's own address (`resumeHref`). */
  resumeHref?: string;
  /** Walk: an ordinary walk's address, for "Just a walk". */
  plainHref?: string;
  recovery?: boolean;
}

/** The Workout hub's Join: the programme's own flow, opened at once (D35). */
export const JOIN_HREF = '/hub/workout/plan?join=1';

export function actionTarget(kind: HubActionKind, c: ActionContext): ActionTarget {
  switch (kind) {
    case 'start':
    case 'review':
    case 'anyway':
      return { via: 'gate', mode: c.mode, href: c.href, label: c.startLabel };
    case 'continue': {
      const href = c.resumeHref ?? c.href;
      return { via: 'gate', mode: c.mode, href, label: startLabelFor(c.mode, href, c.recovery === true) };
    }
    case 'mobility':
      return { via: 'gate', mode: 'guided', href: HREF.guided, label: defaultStartLabel('guided', false) };
    case 'justWalk':
      return { via: 'gate', mode: 'walk', href: c.plainHref ?? c.href, label: c.startLabel };
    case 'profile':
      return { via: 'go', to: HREF.profile };
    case 'join':
      return { via: 'go', to: JOIN_HREF };
    case 'next':
      return { via: 'go', to: HREF.next };
    case 'stretch':
      return { via: 'go', to: HREF.stretch };
    case 'status':
      return { via: 'status' };
    case 'otherTime':
    case 'finishWalk':
    case 'chooseRoutine':
      return { via: 'local' };
    case 'carryOn':
      return { via: 'gate', mode: c.mode, href: c.resumeHref ?? c.href, label: 'Carry on walking' };
    case 'saveWalk':
      return { via: 'go', to: '/walk/summary' };
  }
}

/** Carry a target out. A start goes only through `start`, which asks the gate at the tap (§4.1). */
export function runAction(t: ActionTarget, fx: {
  start: (mode: Mode, href: string, label: string) => void;
  go: (to: string) => void;
  status: () => void;
  local: () => void;
}): void {
  if (t.via === 'gate') fx.start(t.mode, t.href, t.label);
  else if (t.via === 'go') fx.go(t.to);
  else if (t.via === 'status') fx.status();
  else fx.local();
}

/**
 * Whether the Stretch hub lists the routine and its area and length choices
 * under the card: not while the card refuses (a hold, a stop, a profile gap)
 * or the programme's Join is the way in. A routine the builder can't make
 * keeps them, so another can be chosen (kiro KH-01).
 */
export function offersRoutines(state: CardState): boolean {
  return state !== 'held' && state !== 'stopped' && state !== 'gap' && state !== 'join';
}

/**
 * Walking held for the feet (L-09, K-12): a standing foot restriction, or
 * today's own foot hold as the walk's gate says it. The Steps hub then says
 * the hold and gives no walking advice and no step goal; an entered total
 * still saves (kiro KH-02). Undefined while walking isn't held for the feet.
 */
export function feetHold(profile: UserProfile, walk: Permission): { reason: string; release?: string } | undefined {
  if (!walkingHeldForFeet(profile) && !walk.reasons.includes(PERMISSION_TEXT.footWalk)) return undefined;
  return { reason: PERMISSION_TEXT.footWalk, ...(walk.release ? { release: walk.release } : {}) };
}

/** Whether a run saved today may be carried on under this status, as `recommend` offers it (A-34): never while Away or Unwell, and only a stretch during a flare. */
export function resumeAllowed(status: Status, mode: Mode): boolean {
  if (status === 'away' || status === 'unwell') return false;
  return status !== 'flare' || mode === 'stretch';
}

/** Today is the programme's rest day; `mobility` when the plan offers the optional rest-day session. */
export function restDayOf(plan: Pick<SessionPlan, 'kind' | 'focus'>): { mobility: boolean } | undefined {
  if (plan.kind === 'restDay') return { mobility: true };
  if (plan.kind === 'none' && plan.focus === 'rest') return { mobility: false };
  return undefined;
}

/** "mobility, strength and cardio": the blocks today's session holds (journey §8.3). */
export function sessionParts(plan: Pick<SessionPlan, 'blockStarts'>): string | undefined {
  const names = (['mobility', 'strength', 'cardio'] as const).filter(b => plan.blockStarts[b] !== undefined);
  if (names.length === 0) return undefined;
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Why this routine, from real inputs only (journey §8.3): a flare that makes
 * it the gentler one, yesterday's own pain answer for the area it serves, the
 * routine last done, or the focus chosen in setup. Nothing for a routine the
 * person picked themselves, and nothing invented.
 */
export function stretchReason({ chosen, flare, focus, yesterday, fromLast, focusSetting }: {
  chosen: boolean;
  /** A flare-up with a back history: the builder makes it the gentler routine. */
  flare: boolean;
  focus: StretchFocus;
  /** Yesterday's check-in's back answers, when there was one. */
  yesterday?: { pain?: number; legPain?: number };
  /** A stretch is on record, so the routine is the one last done (`lastStretch`). */
  fromLast: boolean;
  focusSetting?: UserSettings['focus'];
}): string | undefined {
  if (chosen) return undefined;
  if (flare) return 'Your back is in a flare-up, so this is the gentler routine.';
  const back = yesterday?.pain ?? 0;
  const leg = yesterday?.legPain ?? 0;
  if (focus === 'backHips' && back >= 1) return `Your check-in yesterday said back pain ${back} of 10.`;
  if (focus === 'hipsLegs' && leg >= 1) return `Your check-in yesterday said leg pain ${leg} of 10.`;
  if (fromLast) return 'The routine you did last time.';
  if (focusSetting === 'stretch') return 'You chose stretching as your focus.';
  return undefined;
}
