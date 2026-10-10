import { describe, expect, it } from 'vitest';
import {
  checkInSays, earlierEscalation, glucoseEscalation, glucoseFlag, guidanceView, holdLine, meterEscalation, mostUrgent, pressureEscalation, pressureFlag,
} from './escalation';
import { evaluateCheckIn } from '@/engine/readiness';
import { createDefaultProfile } from '@/profile/defaults';
import type { DailyCheckIn } from '@/types/checkin';

const ruleOf = (value: number, unit: 'mg/dL' | 'mmol/L') => glucoseEscalation(value, unit)?.rule;

describe('glucose escalation: boundaries in mg/dL (contract operators)', () => {
  it('level 2 is strictly under 54; exactly 54 is level 1', () => {
    expect(ruleOf(53, 'mg/dL')).toBe('T-HYPO-LEVEL-2');
    expect(ruleOf(53.99, 'mg/dL')).toBe('T-HYPO-LEVEL-2');
    expect(ruleOf(54, 'mg/dL')).toBe('H-HYPO');
  });

  it('level 1 is strictly under 70; exactly 70 is not a low', () => {
    expect(ruleOf(69, 'mg/dL')).toBe('H-HYPO');
    expect(ruleOf(69.99, 'mg/dL')).toBe('H-HYPO');
    expect(ruleOf(70, 'mg/dL')).toBeUndefined();
  });

  it('600 or more is an emergency; just under is not', () => {
    expect(ruleOf(599, 'mg/dL')).toBeUndefined();
    expect(ruleOf(599.99, 'mg/dL')).toBeUndefined();
    expect(ruleOf(600, 'mg/dL')).toBe('E-EXTREME-GLUCOSE');
  });

  it('says nothing about a reading in between', () => {
    for (const v of [70, 90, 112, 180, 250, 300, 450]) expect(ruleOf(v, 'mg/dL')).toBeUndefined();
  });
});

describe('glucose escalation: the same boundaries in mmol/L, converted at 18 unrounded', () => {
  it('3.0 mmol/L is exactly 54 mg/dL, so level 1; 2.9 is level 2', () => {
    expect(ruleOf(2.99, 'mmol/L')).toBe('T-HYPO-LEVEL-2');
    expect(ruleOf(3.0, 'mmol/L')).toBe('H-HYPO');
  });

  it('3.8 mmol/L (68.4) is a low; 3.9 (70.2) is not', () => {
    expect(ruleOf(3.8, 'mmol/L')).toBe('H-HYPO');
    expect(ruleOf(3.88, 'mmol/L')).toBe('H-HYPO');
    expect(ruleOf(3.9, 'mmol/L')).toBeUndefined();
  });

  it('33.3 mmol/L is 599.4 mg/dL, under the boundary; 33.34 is over it', () => {
    expect(ruleOf(33.3, 'mmol/L')).toBeUndefined();
    expect(ruleOf(600 / 18, 'mmol/L')).toBe('E-EXTREME-GLUCOSE');
    expect(ruleOf(33.34, 'mmol/L')).toBe('E-EXTREME-GLUCOSE');
  });
});

describe('glucose escalation: the acceptance script’s exact mmol/L strings (J13)', () => {
  it('compares String(mg / 18) at full precision: 54, 70 and 600 land on their own side', () => {
    expect(ruleOf(Number('3'), 'mmol/L')).toBe('H-HYPO');
    expect(ruleOf(Number('3.888888888888889'), 'mmol/L')).toBeUndefined();
    expect(ruleOf(Number('33.333333333333336'), 'mmol/L')).toBe('E-EXTREME-GLUCOSE');
    expect(ruleOf(599.9, 'mg/dL')).toBeUndefined();
    expect(ruleOf(600.1, 'mg/dL')).toBe('E-EXTREME-GLUCOSE');
  });
});

describe('a meter that shows HI or LO (H-DATA)', () => {
  it('treats LO as the severe low it reports, in the form’s unit', () => {
    const e = meterEscalation('LO', 'mmol/L');
    expect(e.rule).toBe('T-HYPO-LEVEL-2');
    expect(e.disposition).toBe('today');
    expect(e.steps.join(' ')).toMatch(/15 g/);
    expect(e.steps.join(' ')).toMatch(/3\.9 mmol\/L/);
    expect(e.steps.join(' ')).toMatch(/care team today/);
  });

  it('asks for HI to be checked again, then urgent advice, with the emergency signs, and no exercise', () => {
    const e = meterEscalation('HI', 'mg/dL');
    expect(e.rule).toBe('H-DATA');
    expect(e.steps[0]).toMatch(/check again/);
    expect(e.steps[1]).toMatch(/still says HI.*urgent care now/);
    expect(e.steps.join(' ')).toMatch(/emergency services/);
    expect(e.steps.at(-1)).toBe('Do not exercise.');
    expect(e.steps.join(' ')).not.toMatch(/insulin|dose|medicine/i);
  });
});

describe('glucose escalation: what it says', () => {
  it('an emergency says get help now and no exercise', () => {
    const e = glucoseEscalation(612, 'mg/dL')!;
    expect(e.disposition).toBe('emergency');
    expect(e.steps[0]).toMatch(/emergency/i);
    expect(e.steps.join(' ')).toMatch(/Do not exercise/);
    expect(e.basis).toMatch(/ADA/);
  });

  it('a low says treat it now, with the 15 g and 15 minute loop, in the reading’s own unit', () => {
    const mg = glucoseEscalation(62, 'mg/dL')!;
    expect(mg.disposition).toBe('treatNow');
    expect(mg.steps.join(' ')).toMatch(/15 g/);
    expect(mg.steps.join(' ')).toMatch(/15 minutes/);
    expect(mg.steps.join(' ')).toMatch(/70 mg\/dL/);
    const mmol = glucoseEscalation(3.4, 'mmol/L')!;
    expect(mmol.steps.join(' ')).toMatch(/3\.9 mmol\/L/);
    // Track's own steps are in the reading's unit; the check-in's line is quoted as the check-in says it.
    const own = mmol.steps.filter(step => step !== checkInSays({ glucose: { value: 3.4, unit: 'mmol/L', measuredAt: new Date().toISOString() } }, 'low', undefined));
    expect(own).toHaveLength(mmol.steps.length - 1);
    expect(own.join(' ')).not.toMatch(/mg\/dL/);
  });

  it('a serious low adds contacting the care team today', () => {
    const e = glucoseEscalation(48, 'mg/dL')!;
    expect(e.disposition).toBe('today');
    expect(e.steps.join(' ')).toMatch(/care team today/);
  });

  it('every low says what to do if the person cannot swallow, and gives no food then', () => {
    for (const v of [40, 60]) {
      const text = glucoseEscalation(v, 'mg/dL')!.steps.join(' ');
      // The check-in's own swallow line, word for word.
      expect(text).toMatch(/cannot swallow safely/);
      expect(text).toMatch(/do not eat or drink, and ask someone nearby for help/i);
    }
  });

  it('never mentions a medicine or a dose', () => {
    for (const v of [40, 60, 650]) {
      expect(glucoseEscalation(v, 'mg/dL')!.steps.join(' ')).not.toMatch(/insulin|dose|medicine|medication|glucagon/i);
    }
  });

  it('ignores a non-number', () => {
    expect(glucoseEscalation(Number.NaN, 'mg/dL')).toBeUndefined();
  });
});

describe('blood pressure escalation (T-BP, either number, inclusive)', () => {
  it('180 systolic is enough on its own, whatever the bottom number', () => {
    expect(pressureEscalation(180, 80)?.rule).toBe('T-BP');
    expect(pressureEscalation(179, 80)).toBeUndefined();
  });

  it('120 diastolic is enough on its own', () => {
    expect(pressureEscalation(150, 120)?.rule).toBe('T-BP');
    expect(pressureEscalation(150, 119)).toBeUndefined();
    expect(pressureEscalation(120, 120)?.rule).toBe('T-BP');
  });

  it('a raised but not severe reading gets no immediate guidance; the movement gate owns 160/100', () => {
    expect(pressureEscalation(160, 100)).toBeUndefined();
    expect(pressureEscalation(175, 110)).toBeUndefined();
  });

  it('says what the check-in says: no exercise today, re-measure after 5 minutes, contact today, and the emergency signs', () => {
    const e = pressureEscalation(186, 92)!;
    expect(e.disposition).toBe('today');
    const text = e.steps.join(' ');
    expect(text).toMatch(/no exercise today/);
    expect(text).toMatch(/Sit quietly for 5 minutes and measure again/);
    expect(text).toMatch(/contact your clinician today/);
    expect(text).toMatch(/chest or back pain/);
    expect(text).toMatch(/Call emergency services/);
    expect(text).not.toMatch(/tablet|dose/i);
    // One sentence a step.
    expect(e.steps.length).toBeGreaterThan(1);
    expect(e.basis).toMatch(/NICE NG136/);
  });
});

describe('a reading from earlier (F03): a low that has passed is reviewed, never "treat it now"', () => {
  const NOW_WORDS = /treat it now|take 15 g|check again in 15 minutes/i;

  it('keeps the rule and the tone, and puts what to do if it is happening now first', () => {
    for (const e of [glucoseEscalation(53, 'mg/dL')!, glucoseEscalation(62, 'mg/dL')!]) {
      const past = earlierEscalation(e);
      expect(past.rule).toBe(e.rule);
      expect(past.disposition).toBe(e.disposition);
      expect(`${past.title} ${past.steps.join(' ')}`).not.toMatch(NOW_WORDS);
      expect(past.steps[0]).toBe('If you feel low now, check your glucose and treat it straight away.');
      expect(past.steps.join(' ')).toMatch(/care team/);
    }
  });
});

describe('earlier is when, not settled (R03)', () => {
  const extreme = glucoseEscalation(600, 'mg/dL')!;
  const severe = pressureEscalation(186, 92)!;

  it('keeps the unconditional help action for an extreme glucose or severe BP that has not been settled', () => {
    expect(earlierEscalation(extreme, 'open').steps[0]).toBe('Get emergency medical help now.');
    expect(earlierEscalation(extreme, 'open').steps.join(' ')).toMatch(/Do not exercise/);
    expect(earlierEscalation(severe, 'open').steps.join(' ')).toMatch(/contact your clinician today/);
    expect(earlierEscalation(severe, 'open').steps.join(' ')).not.toMatch(/^If /);
  });

  it('reviews it only once a clinician has checked the person since', () => {
    const assessed = earlierEscalation(extreme, 'assessed');
    expect(assessed.steps.join(' ')).not.toMatch(/^Get emergency medical help now\./);
    expect(assessed.steps[0]).toMatch(/^If you feel unwell now/);
    expect(assessed.steps.join(' ')).toMatch(/clinician who checked you/);
    expect(earlierEscalation(severe, 'assessed').steps.join(' ')).toMatch(/clinician who checked you/);
  });

  it('holds the help action, not a conditional one, while the questions are open', () => {
    expect(holdLine(extreme)).toMatch(/needs emergency medical help now, unless a clinician has checked you since/);
    expect(holdLine(extreme)).not.toMatch(/^If you feel/);
    expect(holdLine(severe)).toMatch(/contact your doctor today, unless a clinician has checked you since/);
    expect(holdLine(glucoseEscalation(53, 'mg/dL')!)).toBe('If you feel low now, check your glucose and treat it straight away.');
  });

  it('asks when, then, for what stays in force until settled, whether it was settled', () => {
    expect(guidanceView(extreme, false, undefined)).toEqual({ escalation: extreme });
    expect(guidanceView(extreme, true, undefined)).toEqual({ question: 'when', hold: holdLine(extreme) });
    expect(guidanceView(extreme, true, { when: 'now' })).toEqual({ escalation: extreme });
    expect(guidanceView(extreme, true, { when: 'earlier' })).toEqual({ question: 'settled', hold: holdLine(extreme) });
    expect(guidanceView(extreme, true, { when: 'earlier', settled: 'open' })).toEqual({ escalation: earlierEscalation(extreme, 'open') });
    expect(guidanceView(extreme, true, { when: 'earlier', settled: 'assessed' })).toEqual({ escalation: earlierEscalation(extreme, 'assessed') });
    expect(guidanceView(severe, true, { when: 'earlier' })).toMatchObject({ question: 'settled' });
    // A low that has passed needs no settling question: its review path is the answer.
    const low = glucoseEscalation(53, 'mg/dL')!;
    expect(guidanceView(low, true, { when: 'earlier' })).toEqual({ escalation: earlierEscalation(low) });
  });
});

describe('mostUrgent', () => {
  it('picks the most urgent of several readings, keeping the first on a tie', () => {
    const a = glucoseEscalation(60, 'mg/dL');
    const b = glucoseEscalation(650, 'mg/dL');
    expect(mostUrgent([a, undefined, b])?.rule).toBe('E-EXTREME-GLUCOSE');
    const first = pressureEscalation(185, 90);
    const second = pressureEscalation(190, 95);
    expect(mostUrgent([first, second])).toBe(first);
    expect(mostUrgent([undefined, undefined])).toBeUndefined();
  });
});

describe('flags for lists', () => {
  it('names glucose the contract singles out, at the same boundaries', () => {
    expect(glucoseFlag(53, 'mg/dL')).toBe('Serious low');
    expect(glucoseFlag(54, 'mg/dL')).toBe('Low');
    expect(glucoseFlag(70, 'mg/dL')).toBeUndefined();
    expect(glucoseFlag(3.8, 'mmol/L')).toBe('Low');
    expect(glucoseFlag(600, 'mg/dL')).toBe('Extremely high');
    expect(glucoseFlag(599, 'mg/dL')).toBeUndefined();
  });

  it('names a very high blood pressure from either number, even with one missing', () => {
    expect(pressureFlag(180, 70)).toBe('Very high');
    expect(pressureFlag(140, 120)).toBe('Very high');
    expect(pressureFlag(181, null)).toBe('Very high');
    expect(pressureFlag(179, 119)).toBeUndefined();
    expect(pressureFlag(null, null)).toBeUndefined();
  });
});

describe('X2-11: Track says about exercise exactly what the check-in says, from the engine itself', () => {
  const day = () => new Date().toLocaleDateString('en-CA');
  /** The engine's own reason for one reading, worked out here independently of Track. */
  const engine = (reading: Partial<DailyCheckIn>, code: string, profile = createDefaultProfile()) =>
    evaluateCheckIn(profile, { date: day(), urgentSymptoms: false, emergency: [], news: [], ...reading }).reasons.find(r => r.code === code)?.message;
  const g = (value: number, unit: 'mg/dL' | 'mmol/L' = 'mg/dL') => ({ glucose: { value, unit, measuredAt: new Date().toISOString() } });
  const OLD = /until you have recovered and your plan says|until your symptoms have gone|in a minute|until you have spoken to your doctor/;

  it('a severe low: no exercise today, as the check-in says it', () => {
    const says = engine(g(46), 'severeLow')!;
    expect(says).toMatch(/No exercise today/);
    expect(glucoseEscalation(46, 'mg/dL')!.steps).toContain(says);
    expect(glucoseEscalation(46, 'mg/dL')!.steps.join(' ')).not.toMatch(OLD);
    const lo = engine({ glucoseDisplay: { display: 'LO', measuredAt: new Date().toISOString() } }, 'severeLow')!;
    expect(meterEscalation('LO', 'mg/dL').steps).toContain(lo);
  });

  it('a level 1 low: the start level the check-in names, the care team’s own included', () => {
    expect(glucoseEscalation(60, 'mg/dL')!.steps).toContain(engine(g(60), 'low'));
    expect(glucoseEscalation(60, 'mg/dL')!.steps.join(' ')).toMatch(/Start only when you are 90 mg\/dL or above and feel fine/);
    const careful = createDefaultProfile({ health: { ...createDefaultProfile().health, highHypoRisk: true } });
    expect(glucoseEscalation(60, 'mg/dL', careful)!.steps).toContain(engine(g(60), 'low', careful));
    expect(glucoseEscalation(60, 'mg/dL', careful)!.steps.join(' ')).toMatch(/145 mg\/dL or above/);
    expect(glucoseEscalation(60, 'mg/dL')!.steps.join(' ')).not.toMatch(OLD);
  });

  it('a severe blood pressure: the check-in’s re-measure and its no exercise today, sentence by sentence', () => {
    const says = engine({ bpReadings: [{ sys: 186, dia: 92, at: new Date().toISOString() }], bp: { sys: 186, dia: 92 } }, 'bpSevereUnconfirmed')!;
    expect(pressureEscalation(186, 92)!.steps.join(' ')).toBe(says);
    expect(says).toMatch(/5 minutes/);
    expect(pressureEscalation(186, 92)!.steps.join(' ')).not.toMatch(OLD);
  });

  it('falls back to the engine’s plainest stop if it ever gives no such reason', () => {
    expect(checkInSays(g(120), 'severeLow', undefined)).toBe('No exercise today.');
  });
});
