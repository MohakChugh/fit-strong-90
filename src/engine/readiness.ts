/**
 * Daily readiness: turns the morning check-in plus the profile into one
 * outcome (green / amber / recovery / red / urgent), session modifiers,
 * reasons, and things to do before starting.
 *
 * Rules: spec §4.5 (back), §4.6 (diabetes), §4.7 (blood pressure); thresholds
 * from docs/research/diabetes-hypertension-exercise.md and
 * back-sciatica-mobility.md. Every rule contributes; the most restrictive
 * outcome wins and modifiers accumulate.
 */

import type { UserProfile } from '@/types/profile';
import type { BackLight, DailyCheckIn, Modifier, Outcome, Readiness, Reason } from '@/types/checkin';
import { OUTCOME_ORDER } from '@/types/checkin';
import { deriveHealth, profileRules, type DerivedHealth } from './health';

export const MGDL_PER_MMOL = 18;

export type GlucoseSanity = 'ok' | 'ambiguousLow' | 'suspectUnit' | 'implausible';

export function toMgdl(value: number, unit: 'mg/dL' | 'mmol/L'): number {
  return unit === 'mg/dL' ? value : Math.round(value * MGDL_PER_MMOL);
}

/**
 * Catch readings typed in the other unit before they trigger the wrong rule
 * (Review Focus #1): 5.5 "mg/dL" is almost certainly 5.5 mmol/L, and 99
 * "mmol/L" is almost certainly 99 mg/dL.
 */
export function glucoseSanity(value: number, unit: 'mg/dL' | 'mmol/L'): GlucoseSanity {
  if (!Number.isFinite(value) || value <= 0) return 'implausible';
  if (unit === 'mg/dL') {
    // Under 34 mg/dL is either a severe low or a mmol/L reading typed with the
    // wrong unit. It is treated as the low: a real one needs carbs now, and
    // treating a mis-typed 30 mmol/L as a low costs only a snack and a re-check.
    if (value < 34) return 'ambiguousLow';
    return value <= 600 ? 'ok' : 'implausible';
  }
  // Above 34 mmol/L (612 mg/dL) is almost certainly a mg/dL reading; it is high,
  // not urgent, so the check-in asks before accepting it.
  if (value > 34) return 'suspectUnit';
  return value >= 1.1 ? 'ok' : 'implausible';
}

interface Contribution {
  outcome: Outcome;
  modifiers?: Modifier[];
  reason?: Reason;
  actions?: string[];
  notices?: string[];
  recheckMinutes?: number;
  nerveFlag?: boolean;
  back?: BackLight;
  capHeavy?: boolean;
}

const R = (code: string, message: string, outcome: Outcome): Reason => ({ code, message, outcome });

function backRules(p: UserProfile, c: DailyCheckIn): Contribution[] {
  // Answers already given are always honoured: editing the profile later must
  // not turn a cauda equina flag, or any reported pain, back into a green day.
  // The profile only decides whether the questions get asked.
  void p;
  if (!c.back) return [];
  const b = c.back;
  const out: Contribution[] = [];
  const legReach = b.reach === 'thigh' || b.reach === 'belowKnee' || b.reach === 'foot';
  const nerveFlag = b.newNeuro || (b.legPain ?? 0) > 0 || legReach;

  if (b.caudaEquinaFlag) {
    out.push({
      outcome: 'urgent',
      reason: R('caudaEquina', 'Numbness around the groin or new bladder or bowel changes need emergency care now. Call your emergency number; do not drive yourself.', 'urgent'),
    });
    return out;
  }
  if (b.newNeuro) {
    out.push({
      outcome: 'recovery', back: 'red', nerveFlag: true,
      reason: R('newNeuro', 'New or worse numbness, tingling or weakness: gentle recovery session today. If leg weakness is getting worse, contact your doctor today.', 'recovery'),
    });
  }
  const worst = Math.max(b.pain, b.legPain ?? 0);
  if (worst > 5) {
    out.push({
      outcome: 'recovery', back: 'red', nerveFlag,
      reason: R('painRed', 'Pain above 5 out of 10: walking, gentle mobility and nerve glides today, no lifting. See a clinician if it lasts 3 or more days.', 'recovery'),
    });
  } else if (worst >= 3) {
    out.push({
      outcome: 'amber', back: 'amber', nerveFlag,
      reason: R('painAmber', 'Pain 3 to 5 out of 10: same plan, no progression today, and smaller range on anything that provokes it.', 'amber'),
    });
  } else {
    out.push({ outcome: 'green', back: 'green', nerveFlag });
  }
  if (nerveFlag && worst <= 5 && !b.newNeuro) {
    out.push({
      outcome: 'green', nerveFlag: true,
      notices: ['Leg symptoms today: nerve sliders only, no long hamstring holds, and stop anything that sends symptoms further down the leg.'],
    });
  }
  return out;
}

function newsRules(c: DailyCheckIn, d: DerivedHealth): Contribution[] {
  const out: Contribution[] = [];
  const has = (n: DailyCheckIn['news'][number]) => c.news.includes(n);
  if (has('unwell')) {
    out.push({
      outcome: 'red',
      reason: R('unwell', 'Unwell or feverish: rest today and follow your sick-day plan.', 'red'),
      actions: d.ketoneRisk ? ['Check ketones, because illness raises the risk of ketoacidosis.'] : [],
    });
  }
  if (has('lowSevere') || has('lowTwoPlus')) {
    out.push({ outcome: 'red', reason: R('recentLows', 'A severe low or two lows in the last 24 hours: no exercise today; your body is more likely to go low again.', 'red') });
  } else if (has('lowOne')) {
    out.push({ outcome: 'amber', modifiers: ['HYPO', 'INT'], reason: R('oneLow', 'A low in the last 24 hours: moderate effort, fast carbs within reach, and extra glucose checks.', 'amber') });
  }
  if (has('fainted')) {
    out.push({ outcome: 'red', reason: R('fainted', 'You fainted today: no exercise, and get medical advice today.', 'red') });
  } else if (has('dizzy')) {
    out.push({ outcome: 'amber', modifiers: ['COOL', 'INT'], reason: R('dizzy', 'Dizzy on standing: moderate effort, longer cool-down, and rise from the floor in stages.', 'amber') });
  }
  if (has('footProblem')) {
    out.push({
      outcome: 'amber', modifiers: ['FOOT'],
      reason: R('foot', 'New foot problem: seated and floor work only today. A hot, swollen foot or an open wound needs a clinician promptly.', 'amber'),
    });
  }
  if (has('unusualFatigue')) {
    out.push({ outcome: 'red', reason: R('fatigue', 'Unusually tired or breathless in everyday activities: rest and check with your clinician before training.', 'red') });
  }
  if (has('hot')) {
    out.push({ outcome: 'green', modifiers: ['HEAT'], notices: ['Hot or humid: shorter, easier cardio, extra fluids, and the coolest spot you can find.'] });
  }
  if (has('steroid') && d.diabetic) {
    out.push({ outcome: 'green', actions: ['Steroids raise glucose: check before and after the session.'] });
  }
  return out;
}

/**
 * Blood-equivalent mmol/L for a ketone reading. Blood meters read mmol/L
 * directly; urine strips are marked in mg/dL (negative 0, trace 5, small 15,
 * moderate 40, large 80+), so reading a strip on blood thresholds would call a
 * routine "small" result an emergency.
 */
export function ketonesMmol(k: { value: number; kind: 'blood' | 'urine' }): number {
  if (k.kind === 'blood') return k.value;
  const scale: [number, number][] = [[0, 0], [5, 0.6], [15, 1.0], [40, 1.6], [80, 3.0], [160, 4.0]];
  if (k.value <= 0) return 0;
  for (let i = 1; i < scale.length; i++) {
    const [hi, hiM] = scale[i];
    const [lo, loM] = scale[i - 1];
    if (k.value <= hi) return loM + ((k.value - lo) / (hi - lo)) * (hiM - loM);
  }
  return 4.0;
}

function ketoneRules(c: DailyCheckIn, mg: number, d: DerivedHealth): Contribution[] {
  const k = c.ketones;
  if (!k) {
    // Anyone who can make ketones at a high glucose (type 1, or an SGLT2
    // inhibitor, which does it even at normal glucose) needs the test before
    // training; without it, recovery work only.
    if (d.ketoneRisk) {
      return [{
        outcome: 'recovery',
        reason: R('noKetones', 'Glucose 250 or higher without a ketone test: recovery only today. Test ketones before harder exercise.', 'recovery'),
        actions: ['Test ketones if you can.'],
      }];
    }
    return [{
      outcome: 'amber', modifiers: ['INT', 'LOAD'],
      reason: R('highGlucoseNoKetones', 'Glucose is high and ketones are untested: lighter, mostly aerobic work, plenty of water, and only if you feel well.', 'amber'),
      actions: ['Test ketones if you can, drink water, and stop if you feel unwell.'],
    }];
  }
  const kv = ketonesMmol(k);
  if (kv >= 3) {
    return [{ outcome: 'urgent', reason: R('ketonesUrgent', 'Ketones 3.0 or higher: contact your care team or emergency services now.', 'urgent') }];
  }
  if (kv >= 1.5) {
    return [{ outcome: 'red', reason: R('ketonesHigh', 'Ketones 1.5 or higher: no exercise; follow your ketone plan and contact your care team.', 'red') }];
  }
  if (kv >= 0.6) {
    return [{ outcome: 'red', reason: R('ketonesTrace', 'Ketones 0.6 to 1.4: no exercise today; follow your ketone plan and re-check.', 'red') }];
  }
  if (mg > 270 && d.diabetic) {
    return [{ outcome: 'amber', modifiers: ['INT', 'LOAD'], reason: R('veryHighGlucose', 'Glucose above 270 with negative ketones: lighter, mostly aerobic work today.', 'amber') }];
  }
  return [{ outcome: 'green' }];
}

function glucoseRules(p: UserProfile, c: DailyCheckIn, d: DerivedHealth): Contribution[] {
  const diabetesKnown = d.diabetic || p.health.diabetes === 'prediabetes';
  if (!diabetesKnown) return [];
  const g = c.glucose;
  if (!g) {
    return d.hypoRisk
      ? [{ outcome: 'amber', modifiers: ['HYPO', 'INT'], reason: R('noReading', 'No glucose reading: moderate effort, fast carbs within reach, and a check before cardio.', 'amber') }]
      : [];
  }
  const sanity = glucoseSanity(g.value, g.unit);
  if (sanity === 'ambiguousLow') {
    return [{
      outcome: 'red',
      reason: R('severeLow', `A reading of ${g.value} is a severe low: treat it now with 15 g of fast carbs, then eat. No exercise today.`, 'red'),
      actions: [
        'Take 15 g of fast-acting carbohydrate now, re-check in 15 minutes, repeat if still low, then eat.',
        `If you meant ${g.value} mmol/L, change the unit and check in again.`,
      ],
    }];
  }
  if (sanity !== 'ok') {
    return [{
      outcome: d.hypoRisk ? 'amber' : 'green',
      modifiers: d.hypoRisk ? ['HYPO', 'INT'] : [],
      reason: R('readingCheck', 'That glucose reading looks unusual: check the unit and measure again.', d.hypoRisk ? 'amber' : 'green'),
    }];
  }
  const mg = toMgdl(g.value, g.unit);
  // Impaired hypo awareness or a recent severe low needs a higher start target
  // (spec §4.6), unless a clinician has set their own.
  const startMin = p.health.clinicianTargets?.glucoseStartMin ?? (p.health.highHypoRisk ? 145 : 90);
  const out: Contribution[] = [];

  if (mg < 54) {
    return [{
      outcome: 'red',
      reason: R('severeLow', 'Glucose below 54 mg/dL: treat the low now with 15 g of fast carbs, then eat. No exercise today.', 'red'),
      actions: ['Take 15 g of fast-acting carbohydrate now, re-check in 15 minutes, repeat if still low, then eat.'],
    }];
  }
  if (mg < 70) {
    return [{
      outcome: 'amber', modifiers: ['HYPO', 'INT'], recheckMinutes: 15,
      reason: R('low', 'Glucose 54 to 69: treat it first. Start only when you are 90 or above and feel fine.', 'amber'),
      actions: ['Take 15 g of fast-acting carbohydrate, wait 15 minutes, then re-check.'],
    }];
  }

  if (d.hypoRisk) {
    const carbBelow = p.health.highHypoRisk ? 162 : 126;
    if (mg < startMin) {
      out.push({
        outcome: 'green', modifiers: ['HYPO'], recheckMinutes: 15,
        reason: R('belowStart', `Glucose under ${startMin}: have 10 to 20 g of fast carbs and start once you are ${startMin} or above.`, 'green'),
        actions: ['Take 10 to 20 g of fast-acting carbohydrate, wait 15 minutes, then re-check.'],
      });
    } else if (mg < carbBelow) {
      out.push({
        outcome: 'green', modifiers: ['HYPO'],
        actions: [`Have about 10 g of carbohydrate now; take 15 to 20 g more before cardio if you are still under ${carbBelow}.`],
      });
    } else if (mg > 180 && mg < 250) {
      out.push({ outcome: 'green', actions: ['Drink water; strength work can push glucose a little higher.'] });
    }
    if ((g.trend === 'slowFall' || g.trend === 'fastFall') && mg < 126) {
      out.push({
        outcome: 'green', modifiers: ['HYPO'], recheckMinutes: 15,
        actions: ['Your glucose is falling: add 5 to 10 g of carbs and wait 15 minutes before starting.'],
      });
    }
    if (g.rapidInsulinLast2h) {
      out.push({
        outcome: 'green', modifiers: ['HYPO'],
        actions: ['Rapid-acting insulin in the last 2 hours makes lows more likely: use the larger carb amounts and check before cardio.'],
      });
    }
  }

  // A ketone reading always counts: an SGLT2 inhibitor can cause ketoacidosis
  // at a normal glucose. A missing one only matters at a high glucose.
  if (c.ketones || (mg >= 250 && d.ketoneRisk)) {
    out.push(...ketoneRules(c, mg, d));
  } else if (mg > 300) {
    out.push({
      outcome: 'amber', modifiers: ['INT', 'LOAD'],
      reason: R('high', 'Glucose above 300: go only if you feel well and are hydrated; lighter work today, and re-check afterwards.', 'amber'),
    });
  }
  return out;
}

function bpRules(c: DailyCheckIn): Contribution[] {
  const bp = c.bp;
  if (!bp) return [];
  const { sys, dia } = bp;
  const dizzy = c.news.includes('dizzy') || c.news.includes('fainted');
  // High thresholds come first: on BP medication a high systolic with a low
  // diastolic is common (190/55), and that is a stop, not a longer cool-down.
  // The message names the number that actually tripped: on BP medication only
  // one of the two is often high, and citing both reads as a mistake.
  const which = (hiSys: number, hiDia: number) =>
    sys >= hiSys && dia >= hiDia ? `Blood pressure ${sys} over ${dia}`
      : sys >= hiSys ? `Your top number is ${sys}`
        : `Your bottom number is ${dia}`;
  if (sys > 180 || dia > 120) {
    return [{ outcome: 'red', reason: R('bpSevere', `${which(181, 121)}: no exercise. Contact your clinician today; call emergency services if you have chest pain, breathlessness, weakness or vision changes.`, 'red') }];
  }
  if (sys >= 180 || dia >= 110) {
    return [{ outcome: 'red', reason: R('bpRed', `${which(180, 110)}: no exercise today. Re-check after resting, and talk to your clinician.`, 'red') }];
  }
  if (sys >= 160 || dia >= 100) {
    return [{
      outcome: 'amber', modifiers: ['INT', 'LOAD', 'HEAD', 'COOL'], capHeavy: true,
      reason: R('bpAmberHigh', `${which(160, 100)}: light work, no head-down positions, and a longer cool-down. Consider a clinician check.`, 'amber'),
    }];
  }
  if (sys < 90 || dia < 60) {
    return dizzy
      ? [{ outcome: 'red', reason: R('lowBpDizzy', 'Low blood pressure with dizziness: sit or lie down and drink fluids. No exercise today; tell your clinician if it happens again.', 'red') }]
      : [{ outcome: 'amber', modifiers: ['COOL'], reason: R('lowBp', 'Blood pressure is on the low side: a longer cool-down and rising slowly.', 'amber') }];
  }
  if (sys >= 140 || dia >= 90) {
    return [{
      outcome: 'amber', modifiers: ['INT'], capHeavy: true,
      reason: R('bpAmber', 'Blood pressure 140 over 90 or higher: no intervals and no heavy lifts today.', 'amber'),
    }];
  }
  return [{ outcome: 'green' }];
}

function sleepRules(c: DailyCheckIn, recent: DailyCheckIn[]): Contribution[] {
  const low = (x: DailyCheckIn) => x.sleep === 'lt5' || x.energy <= 2;
  if (!low(c)) return [];
  const yesterday = previousDay(c.date);
  const lowYesterday = recent.some(r => r.date === yesterday && low(r));
  return lowYesterday
    ? [{ outcome: 'recovery', reason: R('lowTwoDays', 'Low sleep or energy two days running: a recovery session today.', 'recovery') }]
    : [{ outcome: 'amber', modifiers: ['INT', 'MINUS_SET'], reason: R('lowSleep', 'Short sleep or low energy: one set fewer per exercise and moderate effort.', 'amber') }];
}

function previousDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - 1));
  return dt.toISOString().slice(0, 10);
}

/** Evaluate today's check-in. `recent` holds earlier check-ins (any order). */
export function evaluateCheckIn(profile: UserProfile, checkIn: DailyCheckIn, recent: DailyCheckIn[] = []): Readiness {
  const d = deriveHealth(profile.health);
  const pr = profileRules(profile);

  const contributions: Contribution[] = [
    { outcome: pr.outcome, modifiers: pr.modifiers, notices: pr.notices, capHeavy: pr.capHeavy },
    ...pr.reasons.map(r => ({ outcome: r.outcome === 'red' ? 'red' as const : 'green' as const, reason: r })),
  ];
  if (checkIn.urgentSymptoms) {
    contributions.push({
      outcome: 'urgent',
      reason: R('urgentSymptoms', 'Chest pain, unusual breathlessness, a racing heartbeat, sudden weakness or vision change need help now. Call your emergency number.', 'urgent'),
    });
  }
  contributions.push(
    ...backRules(profile, checkIn),
    ...newsRules(checkIn, d),
    ...glucoseRules(profile, checkIn, d),
    ...bpRules(checkIn),
    ...sleepRules(checkIn, recent),
  );

  return merge(contributions, pr.vigorousLocked, pr.rpeOnly);
}

function merge(cs: Contribution[], vigorousLocked: boolean, rpeOnly: boolean): Readiness {
  let outcome: Outcome = 'green';
  const modifiers: Modifier[] = [];
  const reasons: Reason[] = [];
  const actions: string[] = [];
  const notices: string[] = [];
  let recheckMinutes: number | undefined;
  let nerveFlag = false;
  let back: BackLight = 'none';
  let capHeavy = false;
  const backRank: BackLight[] = ['none', 'green', 'amber', 'red'];

  for (const c of cs) {
    if (OUTCOME_ORDER.indexOf(c.outcome) > OUTCOME_ORDER.indexOf(outcome)) outcome = c.outcome;
    for (const m of c.modifiers ?? []) if (!modifiers.includes(m)) modifiers.push(m);
    if (c.reason && !reasons.some(r => r.code === c.reason!.code)) reasons.push(c.reason);
    for (const a of c.actions ?? []) if (!actions.includes(a)) actions.push(a);
    for (const n of c.notices ?? []) if (!notices.includes(n)) notices.push(n);
    if (c.recheckMinutes) recheckMinutes = Math.max(recheckMinutes ?? 0, c.recheckMinutes);
    if (c.nerveFlag) nerveFlag = true;
    if (c.back && backRank.indexOf(c.back) > backRank.indexOf(back)) back = c.back;
    if (c.capHeavy) capHeavy = true;
  }
  reasons.sort((a, b) => OUTCOME_ORDER.indexOf(b.outcome) - OUTCOME_ORDER.indexOf(a.outcome));

  return {
    outcome, modifiers, back, nerveFlag, reasons, actions, notices,
    ...(recheckMinutes ? { recheckMinutes } : {}),
    vigorousLocked, capHeavy, rpeOnly,
  };
}

/** Readiness when the user skips the check-in: profile rules only. */
export function profileOnlyReadiness(profile: UserProfile): Readiness {
  const pr = profileRules(profile);
  return merge(
    [
      { outcome: pr.outcome, modifiers: pr.modifiers, notices: pr.notices, capHeavy: pr.capHeavy },
      ...pr.reasons.map(r => ({ outcome: r.outcome === 'red' ? 'red' as const : 'green' as const, reason: r })),
    ],
    pr.vigorousLocked,
    pr.rpeOnly,
  );
}
