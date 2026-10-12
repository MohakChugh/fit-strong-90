/**
 * What the coach says, and when (spec §6.3–§6.4). Each step yields cues
 * anchored to a segment (so "+15 s" and pauses shift them correctly) with a
 * priority:
 *   P0 safety · P1 timed (begin, sides, counts, rest/next) ·
 *   P2 instruction (how, breathing, feel, why) · P3 encouragement.
 * Every cue is also shown as a caption.
 */

import type { Coaching } from '@/types/catalog';
import type { SessionPlan, Segment, Step } from '@/types/plan';
import type { UserProfile } from '@/types/profile';
import { segmentsFor } from '@/engine/timing';
import { deriveHealth } from '@/engine/health';
import { fluidLimit, glucoseLevel } from '@/engine/readiness';
import { getStrength, nameOf } from '@/data/catalog';

/**
 * Water, said only as this profile may be told it (contract H-DIZZY; Codex
 * re-audit F13), in the words the rest's own line on screen uses: never with
 * a fluid limit, and only conditionally when the question is unanswered.
 * Each variant is a recorded sentence (scripts/voice/catalog.ts).
 */
const REST_RECOVERY: Record<ReturnType<typeof fluidLimit>, string> = {
  limited: 'Shake out your arms and legs, breathe slowly, and keep to your fluid plan.',
  free: 'Shake out your arms and legs, breathe slowly, and sip some water.',
  unknown: 'Shake out your arms and legs, breathe slowly, and sip some water unless you have a fluid limit.',
};
const TO_FIRST_STATION: Record<ReturnType<typeof fluidLimit>, string> = {
  limited: 'Keep to your fluid plan, and walk to your first station.',
  free: 'Take a sip of water and walk to your first station.',
  unknown: 'Take a sip of water unless you have a fluid limit, and walk to your first station.',
};

export type Priority = 0 | 1 | 2 | 3;

export interface Cue {
  id: string;
  text: string;
  priority: Priority;
  /** Segment index within the step this cue is anchored to. */
  seg: number;
  /** Milliseconds from the segment start (or before its end when `align: 'end'`). */
  offsetMs: number;
  align?: 'start' | 'end';
  /** Shorter wording, used when the full line won't fit before the next timed cue. */
  short?: string;
  /** Drop if it cannot start within this many ms of its anchor. */
  staleAfterMs?: number;
  /** Spoken wording when it differs from the caption (keeps speech pre-recordable). */
  say?: string;
}

export type Detail = 'detailed' | 'standard' | 'minimal';

export interface ScriptContext {
  profile: UserProfile;
  plan: SessionPlan;
  coaching: (id: string) => Coaching | undefined;
  /** Earlier sessions that included this exercise. */
  exposures: (exerciseId: string) => number;
}

export function detailFor(profile: UserProfile, seenBefore: number): Detail {
  const v = profile.voice.verbosity;
  if (v === 'auto') return seenBefore < 2 ? 'detailed' : 'standard';
  return v;
}

const sideWord = (s?: 'left' | 'right') => (s === 'left' ? 'left' : s === 'right' ? 'right' : '');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const join = (...parts: (string | undefined | false)[]) => parts.filter(Boolean).join(' ');

/** Words for the two phases of a rep, by movement. */
function phaseWords(exerciseId: string): { down: string; up: string } {
  const p = getStrength(exerciseId)?.patterns ?? [];
  if (p.includes('vPull') || p.includes('hPull') || p.includes('rearDelt')) return { down: 'And return slowly', up: 'Exhale and pull' };
  if (p.includes('biceps') || p.includes('kneeFlexion')) return { down: 'Lower with control', up: 'Exhale and curl' };
  if (p.includes('triceps')) return { down: 'Return slowly', up: 'Exhale and press' };
  if (p.includes('sideDelt')) return { down: 'Lower slowly', up: 'Exhale and raise' };
  if (p.includes('chestFly')) return { down: 'Open slowly', up: 'Exhale and hug' };
  if (p.includes('calf')) return { down: 'Lower your heels', up: 'Exhale and rise' };
  if (p.includes('hinge') || p.includes('backExtension')) return { down: 'Hips back, lower with control', up: 'Exhale and drive your hips through' };
  if (p.includes('hPush') || p.includes('vPush')) return { down: 'Lower with control', up: 'Exhale and press' };
  if (p.includes('antiExtension') || p.includes('antiRotation') || p.includes('rotation')) return { down: 'And back', up: 'Exhale and reach' };
  return { down: 'Lower with control', up: 'Exhale and drive up' };
}

/** Spoken during a hold or drill's prep segment (shared with the planner's timing). */
export function mobilityPrepText(name: string, firstSide: 'left' | 'right' | undefined, c: Coaching | undefined, detail: Detail): string {
  if (detail === 'minimal') return `${name}.`;
  // Only how to get into position here; the remaining steps are spoken once the hold starts.
  return join(`${name}.`, firstSide ? `${cap(sideWord(firstSide))} side first.` : '', ...(c ? c.steps.slice(0, detail === 'detailed' ? 2 : 1) : []));
}

export interface SetupRx {
  sets: number;
  targetReps: number;
  rir: number;
  holdSeconds?: number;
  carrySeconds?: number;
  load?: { kg: number | null; note: string };
}

/**
 * What the coach says about today's weight, by the planner's note. Exported so
 * the voice catalogue records every one: a returning person's notes only
 * appear with a history, which the catalogue's plans do not have.
 */
export const LOAD_LINES = {
  firstTime: 'Pick a weight you could lift a few more times than asked, then log it after the first set.',
  increase: 'You earned a little more weight today. The new weight is on your screen.',
  decrease: 'Go a little lighter today. The weight is on your screen.',
  same: 'Same weight as last time.',
} as const;

/** Lines spoken during a strength setup step, in order (shared with the planner's timing). */
export function setupLines(exerciseId: string, name: string, rx: SetupRx | undefined, c: Coaching | undefined, detail: Detail): { priority: Priority; text: string; short?: string }[] {
  const unilateral = getStrength(exerciseId)?.unilateral ?? false;
  const count = (one: string, many: string) => `${rx?.sets} ${rx?.sets === 1 ? one : many}`;
  const volume = !rx ? ''
    : rx.holdSeconds ? `${count('round', 'rounds')} of ${rx.holdSeconds} second holds${unilateral ? ' on each side' : ''}.`
      : rx.carrySeconds ? `${count('carry', 'carries')} of ${rx.carrySeconds} seconds${unilateral ? ' per hand' : ''}.`
        : `${count('set', 'sets')} of ${rx.targetReps}${unilateral ? ' on each side' : ''}.`;
  const load = rx?.load;
  const loadLine = !load ? ''
    : load.note === 'firstTime' || load.note === 'increase' || load.note === 'decrease' ? LOAD_LINES[load.note]
      : load.note === 'same' && load.kg ? LOAD_LINES.same : '';
  const lines: { priority: Priority; text: string; short?: string }[] = [{ priority: 1, text: `Next: ${name}.` }];
  if (detail !== 'minimal' && c) {
    lines.push({ priority: 2, text: join(detail === 'detailed' ? c.summary : '', ...(detail === 'detailed' ? c.setup : c.setup.slice(0, 2))), short: c.setup[0] });
    lines.push({ priority: 2, text: join(volume, loadLine, rx && rx.rir >= 3 ? `Stop with ${rx.rir} reps left in the tank.` : '') });
    if (detail === 'detailed') {
      lines.push({ priority: 2, text: join(c.why, c.breathing), short: c.breathing.split('. ')[0] + '.' });
      if (c.mistakes[0]) lines.push({ priority: 3, text: `Avoid ${c.mistakes[0].mistake.toLowerCase()}: ${c.mistakes[0].fix}` });
    }
  } else if (volume) {
    lines.push({ priority: 2, text: volume });
  }
  return lines.filter(l => l.text.trim());
}

const COUNT = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen'];

function countdown(seg: number, durationMs: number, id: string): Cue[] {
  if (durationMs < 8000) return [];
  return [{ id: `${id}-cd`, text: 'Three, two, one.', priority: 1, seg, offsetMs: 0, align: 'end', staleAfterMs: 1500 }];
}

export function scriptFor(step: Step, ctx: ScriptContext): Cue[] {
  const segs = segmentsFor(step);
  const cues: Cue[] = [];
  const health = deriveHealth(ctx.profile.health);
  const hypertensive = ctx.profile.health.hypertension !== 'none' || health.onBpMeds;
  const exId = 'exerciseId' in step ? step.exerciseId : undefined;
  const c = exId ? ctx.coaching(exId) : undefined;
  const detail = exId ? detailFor(ctx.profile, ctx.exposures(exId)) : 'standard';
  const name = c?.name ?? (exId ? nameOf(exId) : step.title);
  const add = (cue: Omit<Cue, 'id'> & { id?: string }) => cues.push({ id: cue.id ?? `${step.id}-${cues.length}`, ...cue });

  switch (step.kind) {
    case 'talk':
      return talkCues(step, ctx, hypertensive);

    case 'setup': {
      const rx = ctx.plan.exercises.find(e => e.exerciseId === step.exerciseId)?.rx;
      setupLines(step.exerciseId, name, rx, c, detail).forEach((l, i) => {
        add({ seg: 0, offsetMs: i * 500, priority: l.priority, text: l.text, ...(l.short ? { short: l.short } : {}), ...(i === 0 ? { staleAfterMs: 4000 } : {}) });
      });
      add({ seg: 0, offsetMs: 0, align: 'end', priority: 1, text: 'Get into position.', staleAfterMs: 2000 });
      return cues;
    }

    case 'set': {
      const words = phaseWords(step.exerciseId);
      const label = step.ramp ? `Warm-up set ${step.set}, light and easy.` : `Set ${step.set} of ${step.of}.`;
      // Spec §4.6 asks for this on every strength set for anyone with diabetes,
      // raised blood pressure or eye disease — breath-holding spikes both
      // blood pressure and eye pressure.
      const breath = hypertensive || ctx.profile.health.retinopathy !== 'none_or_mild' || ctx.profile.health.diabetes !== 'none'
        ? 'Breathe out as you push. Never hold your breath.'
        : '';
      add({ seg: 0, offsetMs: 0, priority: 1, text: join(label, step.sides ? `Start with your ${sideWord(step.sides[0])} side.` : '', breath), staleAfterMs: 3000 });
      segs.forEach((s, i) => {
        if (s.kind === 'switch') add({ seg: i, offsetMs: 0, priority: 1, text: `Switch to your ${sideWord(segs[i + 1]?.side)} side.`, staleAfterMs: 3000 });
        if (s.kind === 'hold') {
          add({ seg: i, offsetMs: 0, priority: 1, text: join(s.side ? `${cap(sideWord(s.side))} side.` : '', 'Hold, and keep breathing.'), staleAfterMs: 3000 });
          if (c?.cues[0]) add({ seg: i, offsetMs: Math.max(3000, s.seconds * 400), priority: 3, text: c.cues[0] });
          cues.push(...countdown(i, s.seconds * 1000, `${step.id}-${i}`));
        }
        if (s.kind === 'work') {
          add({ seg: i, offsetMs: 0, priority: 1, text: join(s.side ? `${cap(sideWord(s.side))} hand.` : '', 'Walk tall, and keep breathing.'), staleAfterMs: 3000 });
          if (c?.cues[0]) add({ seg: i, offsetMs: s.seconds * 450, priority: 3, text: c.cues[0] });
          cues.push(...countdown(i, s.seconds * 1000, `${step.id}-${i}`));
        }
        if (s.kind !== 'rep' || !s.rep) return;
        const isLift = s.repPhase === 'lift';
        const isLower = s.repPhase === 'lower';
        const total = step.reps;
        if (isLift) {
          const n = s.rep;
          const text = n === 1
            ? words.up + '.'
            : n === total ? `${COUNT[n] ?? n}. Last one.`
              : n === total - 1 && total >= 6 ? `${COUNT[n] ?? n}. Two more.`
                : `${COUNT[n] ?? n}.`;
          add({ seg: i, offsetMs: 0, priority: 1, text, staleAfterMs: 800 });
          if (!step.ramp && c?.cues.length && (n === 3 || n === 6) && n < total) {
            add({ seg: i, offsetMs: 300, priority: 3, text: c.cues[(n / 3 - 1) % c.cues.length] });
          }
        }
        if (isLower && s.rep === 1 && s.seconds >= 2) add({ seg: i, offsetMs: 0, priority: 2, text: `${words.down}, ${COUNT[2].toLowerCase()}, ${COUNT[3].toLowerCase()}.`, short: words.down + '.', staleAfterMs: 800 });
      });
      return cues;
    }

    case 'rest': {
      const next = ctx.plan.steps[ctx.plan.steps.indexOf(step) + 1];
      const nextText = next?.kind === 'set'
        ? next.exerciseId === findPrevSet(ctx.plan, step)?.exerciseId
          ? `Next: set ${next.set} of ${next.of}.`
          : `Next: ${nameOf(next.exerciseId)}.`
        : next?.kind === 'setup' ? `Next: ${nameOf(next.exerciseId)}.` : '';
      const recovery = step.seconds >= 60 ? REST_RECOVERY[fluidLimit(ctx.profile.health)] : 'Breathe slowly.';
      add({ seg: 0, offsetMs: 500, priority: 1, text: `Rest ${step.seconds} seconds. ${recovery}`, short: `Rest ${step.seconds} seconds.`, staleAfterMs: 4000 });
      if (step.seconds >= 25) add({ seg: 0, offsetMs: 10_000, align: 'end', priority: 1, text: join('Ten seconds.', nextText, 'Get back into position.'), short: 'Ten seconds.', staleAfterMs: 3000 });
      return cues;
    }

    case 'checkpoint':
      if (step.question === 'backSymptoms') {
        add({ seg: 0, offsetMs: 0, priority: 0, text: 'Quick check. Compared with before that exercise, does your back or leg feel better, the same, or worse? Tap your answer.' });
      } else {
        const below = ctx.profile.health.highHypoRisk ? 162 : 126;
        // In the person's unit, the check-in's own number (scan X2-19): 7.0 or
        // 9.0 mmol/L, said whole, since a decimal point would split the
        // recorded sentence in two. The mg/dL line is as it was.
        const under = ctx.profile.health.glucoseUnit === 'mmol/L' ? glucoseLevel(below, 'mmol/L').replace('.0 ', ' ') : String(below);
        add({ seg: 0, offsetMs: 0, priority: 0, text: `Time to check your glucose before cardio. If you are under ${under}, have 15 to 20 grams of fast carbs first.` });
      }
      return cues;

    case 'hold':
    case 'drill':
      return mobilityCues(step, segs, c, detail, name, ctx);

    case 'cardio':
      return cardioCues(step, segs, c, detail, ctx, hypertensive || !!ctx.profile.health.betaBlocker);
  }
}

function findPrevSet(plan: SessionPlan, step: Step) {
  const i = plan.steps.indexOf(step);
  for (let j = i - 1; j >= 0; j--) {
    const s = plan.steps[j];
    if (s.kind === 'set') return s;
  }
  return undefined;
}

function talkCues(step: Extract<Step, { kind: 'talk' }>, ctx: ScriptContext, hypertensive: boolean): Cue[] {
  const p = ctx.plan;
  const health = deriveHealth(ctx.profile.health);
  const cues: Cue[] = [];
  const add = (priority: Priority, text: string, offsetMs = 0) => cues.push({ id: `${step.id}-${cues.length}`, text, priority, seg: 0, offsetMs });
  if (step.topic === 'welcome') {
    // No cardio to do (a foot problem, no machine): say what takes its place.
    // No minutes: they are on the screen, and every spoken variant must be in
    // the recorded packs, which a number per plan would multiply past
    // covering (an unrecorded line falls back to the device's voice).
    const kind = p.kind === 'full'
      ? `Today is ${p.label}: mobility, then strength, then ${p.cardio ? 'cardio' : 'an easy seated and floor flow in place of cardio'}.`
      : p.kind === 'recovery'
        ? (p.cardio ? 'Today is a gentle recovery session: mobility, nerve glides and an easy walk.' : 'Today is a gentle recovery session: mobility and nerve glides.')
        : (p.cardio ? 'Today is an easy mobility and walking session.' : 'Today is an easy mobility session.');
    add(1, `Welcome. ${kind}`);
    add(2, 'I will guide every step. Pause any time with the button or your earphones. Stop if pain travels down your leg, or if you feel dizzy, short of breath or unwell.', 1500);
    if (p.changes.length) {
      cues.push({ id: `${step.id}-${cues.length}`, priority: 2, seg: 0, offsetMs: 3000,
        text: `Today's adjustments: ${p.changes.slice(0, 2).join(' ')}`,
        say: 'I have adjusted today’s plan for how you feel. The details are on your screen.' });
    }
    if (health.hypoRisk) add(0, 'Keep fast-acting carbs within reach. If you feel shaky, sweaty or confused, tap I feel low.', 4000);
  } else if (step.topic === 'blockIntro') {
    add(1, 'No cardio today, so an easy seated and floor flow takes its place. Stay seated or on the floor the whole time.');
  } else if (step.topic === 'transition') {
    const last = p.steps[p.steps.indexOf(step) + 1]?.block === 'wrapUp';
    if (step.block === 'mobility') add(1, last ? 'That is the flow done. Rise slowly if you were on the floor.' : `Mobility complete. Nicely done. ${TO_FIRST_STATION[fluidLimit(ctx.profile.health)]} Rise slowly if you were on the floor.`);
    else add(1, p.cardio ? `Strength complete. Great work. Head to the ${nameOf(p.cardio.modality).toLowerCase()} for your cardio.` : 'Strength complete. Great work. Next, an easy seated and floor flow in place of cardio.');
  } else if (step.topic === 'wrapUp') {
    const reminders = [
      health.hypoRisk ? 'Check your glucose now and again within ninety minutes. Lows can happen up to a day later, often overnight.' : '',
      ctx.profile.health.peripheralNeuropathy !== 'no' ? 'Check your feet for any rubbing or blisters.' : '',
      hypertensive ? 'Take a minute before you rush off; let your blood pressure settle.' : '',
      'A ten minute walk after your next meal will help your glucose and your back.',
    ].filter(Boolean);
    add(1, 'That is your session done. Well done for showing up.');
    add(2, reminders.join(' '), 1500);
    add(1, 'How does your back feel now? Tap a number from zero to ten.', 3000);
  }
  return cues;
}

function mobilityCues(step: Extract<Step, { kind: 'hold' | 'drill' }>, segs: Segment[], c: Coaching | undefined, detail: Detail, name: string, ctx: ScriptContext): Cue[] {
  const cues: Cue[] = [];
  const add = (cue: Omit<Cue, 'id'>) => cues.push({ id: `${step.id}-${cues.length}`, ...cue });
  const firstSide = step.sides?.[0];
  const nerve = step.exerciseId.startsWith('sciatic-nerve-glide');
  const prepText = mobilityPrepText(name, firstSide, c, detail);
  add({ seg: 0, offsetMs: 0, priority: 1, text: prepText, short: `${name}.`, staleAfterMs: 4000 });
  // Caps the drill's own safety flags earned (hold limits, range cues) come first.
  for (const cap of step.caps ?? []) add({ seg: 0, offsetMs: 300, priority: 0, text: cap });
  if (nerve || detail === 'detailed') {
    if (c) add({ seg: 0, offsetMs: 500, priority: nerve ? 0 : 2, text: c.shouldNotFeel, short: nerve ? 'Mild pull at most, never tingling.' : undefined });
  }

  let holdsSeen = 0;
  segs.forEach((s, i) => {
    if (s.kind === 'switch') {
      add({ seg: i, offsetMs: 0, priority: 1, text: s.label === 'Switch sides' ? `Switch to your ${sideWord(segs[i + 1]?.side)} side.` : 'Relax for a moment.', staleAfterMs: 2500 });
      return;
    }
    if (s.kind === 'hold') {
      holdsSeen++;
      add({ seg: i, offsetMs: 0, priority: 1, text: holdsSeen === 1 ? 'Begin. Ease into it.' : 'And again, ease in.', staleAfterMs: 2500 });
      if (detail === 'detailed' && holdsSeen === 1 && c && c.steps.length > 2) add({ seg: i, offsetMs: 1800, priority: 2, text: c.steps.slice(2, 4).join(' '), short: c.steps[2] });
      if (s.seconds >= 15) add({ seg: i, offsetMs: 2500, priority: 2, text: 'Breathe in through your nose for four, and out slowly for six. Sink a little deeper on each breath out.', short: 'In for four, out for six.' });
      if (c && holdsSeen === 1 && detail !== 'minimal') add({ seg: i, offsetMs: s.seconds * 350, priority: 2, text: c.feel, short: c.cues[0] });
      if (c?.cues.length && s.seconds >= 25) add({ seg: i, offsetMs: s.seconds * 650, priority: 3, text: c.cues[holdsSeen % c.cues.length] });
      if (detail === 'detailed' && holdsSeen === 1 && c && s.seconds >= 40) add({ seg: i, offsetMs: s.seconds * 800, priority: 3, text: c.why });
      cues.push(...countdown(i, s.seconds * 1000, `${step.id}-${i}`));
      return;
    }
    if (s.kind === 'work' && s.breath) {
      add({ seg: i, offsetMs: 0, priority: 1, text: s.breath === 'in' ? 'Breathe in.' : 'And out, slowly.', staleAfterMs: 1200 });
      return;
    }
    if (s.kind === 'work') {
      add({ seg: i, offsetMs: 0, priority: 1, text: join(s.side ? `${cap(sideWord(s.side))} side.` : '', 'Begin, slow and smooth.'), staleAfterMs: 2500 });
      if (detail === 'detailed' && i === segs.findIndex(x => x.kind === 'work') && c && c.steps.length > 2) add({ seg: i, offsetMs: 1500, priority: 2, text: c.steps[2], short: c.cues[0] });
      if (c?.cues[0]) add({ seg: i, offsetMs: Math.min(6000, s.seconds * 300), priority: 2, text: c.cues[0] });
      if (c?.cues[1] && s.seconds >= 20) add({ seg: i, offsetMs: s.seconds * 600, priority: 3, text: c.cues[1] });
      if (s.seconds >= 12) add({ seg: i, offsetMs: 4000, align: 'end', priority: 1, text: 'Last one.', staleAfterMs: 1500 });
    }
  });
  void ctx;
  return cues;
}

function cardioCues(step: Extract<Step, { kind: 'cardio' }>, segs: Segment[], c: Coaching | undefined, detail: Detail, ctx: ScriptContext, effortOnly: boolean): Cue[] {
  const cues: Cue[] = [];
  const add = (cue: Omit<Cue, 'id'>) => cues.push({ id: `${step.id}-${cues.length}`, ...cue });
  const health = deriveHealth(ctx.profile.health);
  segs.forEach((s, i) => {
    switch (s.intensity) {
      case 'easy':
        if (i === 0) {
          add({ seg: i, offsetMs: 0, priority: 1, text: `${c?.name ?? 'Cardio'}. Start easy for ${Math.round(s.seconds / 60)} minutes.`, staleAfterMs: 15_000 });
          if (c && detail !== 'minimal') add({ seg: i, offsetMs: 2000, priority: 2, text: join(...c.setup.slice(0, detail === 'detailed' ? 3 : 1)) });
          if (effortOnly) add({ seg: i, offsetMs: 20_000, priority: 2, text: 'Go by effort and the talk test, not your heart rate.' });
        } else {
          add({ seg: i, offsetMs: 0, priority: 1, text: 'And ease off. Recover, breathing slowly.', staleAfterMs: 3000 });
        }
        break;
      case 'zone2':
        // Transition lines that can't start within ~20 s are out of date; the caption still shows.
        add({ seg: i, offsetMs: 0, priority: 1, text: 'Now settle into a steady pace. You should be able to talk in full sentences, about 3 to 4 out of 10.', staleAfterMs: 20_000 });
        if (c?.cues.length) {
          const every = 120_000;
          for (let t = every, k = 0; t < s.seconds * 1000 - 30_000; t += every, k++) {
            add({ seg: i, offsetMs: t, priority: 3, text: c.cues[k % c.cues.length] });
          }
        }
        if (health.hypoRisk) add({ seg: i, offsetMs: Math.round(s.seconds * 500), priority: 2, text: 'If you feel shaky, sweaty or light-headed, tap I feel low.' });
        break;
      case 'fast':
        add({ seg: i, offsetMs: 0, priority: 1, text: 'Fast for 30 seconds, about 7 out of 10. Go.', staleAfterMs: 2000 });
        add({ seg: i, offsetMs: 3000, align: 'end', priority: 1, text: 'Three, two, one.', staleAfterMs: 1500 });
        break;
      case 'cooldown':
        add({ seg: i, offsetMs: 0, priority: 1, text: 'Cool-down. Slow right down and let your breathing settle.', staleAfterMs: 20_000 });
        break;
    }
  });
  return cues;
}

/** Spoken after a long pause, so you know where the session picked up. */
export function catchUpText(step: Step, side?: 'left' | 'right'): string | null {
  if (step.kind === 'talk' || step.kind === 'checkpoint') return null;
  if (step.kind === 'rest') return 'Welcome back. Resting now.';
  return join('Welcome back.', `${nameOf(step.exerciseId)}.`, side ? `${cap(sideWord(side))} side.` : '');
}
