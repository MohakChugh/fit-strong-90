import { describe, expect, it } from 'vitest';
import { BACK_LABEL, EMERGENCY_LABEL, NEWS_LABEL } from '@/components/checkin/copy';
import { LEG_QUESTIONS, legReport, onChoice, REACH_LABEL, STOP_CHOICES, stopReport, type LegAnswers } from './stop';

const none: LegAnswers = { weakness: false, fast: false, bothLegs: false, saddle: false, bladderBowel: false };

describe('"I need to stop": what happened', () => {
  it('asks in the check-in’s own words, most urgent first, with a rest last', () => {
    expect(STOP_CHOICES).toEqual([
      { choice: 'chest', label: EMERGENCY_LABEL.chest },
      { choice: 'stroke', label: EMERGENCY_LABEL.stroke },
      { choice: 'breathless', label: EMERGENCY_LABEL.breathless },
      { choice: 'dizzy', label: NEWS_LABEL.dizzy },
      { choice: 'leg', label: 'Pain travelling down my leg' },
      { choice: 'rest', label: 'Just need a rest' },
    ]);
  });

  it('reports the emergencies as emergency answers, and dizziness as today’s news', () => {
    expect(stopReport('chest')).toEqual({ emergency: ['chest'] });
    expect(stopReport('stroke')).toEqual({ emergency: ['stroke'] });
    expect(stopReport('breathless')).toEqual({ emergency: ['breathless'] });
    expect(stopReport('dizzy')).toEqual({ news: ['dizzy'] });
  });
});

describe('one tap', () => {
  it('reports each answer, asks the leg questions first, and records nothing for a rest', () => {
    for (const hypoRisk of [false, true]) {
      expect(onChoice('chest', hypoRisk)).toEqual({ report: { emergency: ['chest'] }, next: 'close' });
      expect(onChoice('stroke', hypoRisk)).toEqual({ report: { emergency: ['stroke'] }, next: 'close' });
      expect(onChoice('breathless', hypoRisk)).toEqual({ report: { emergency: ['breathless'] }, next: 'close' });
      expect(onChoice('leg', hypoRisk)).toEqual({ next: 'leg' });
      expect(onChoice('rest', hypoRisk)).toEqual({ next: 'close' });
    }
  });

  it('with hypo risk, follows dizziness with "check your glucose now" and the low path', () => {
    expect(onChoice('dizzy', false)).toEqual({ report: { news: ['dizzy'] }, next: 'close' });
    expect(onChoice('dizzy', true)).toEqual({ report: { news: ['dizzy'] }, next: 'dizzy' });
  });
});

describe('pain travelling down a leg, recorded as the player’s "Worse" records it (B09)', () => {
  it('asks the player’s questions, in its words', () => {
    expect(LEG_QUESTIONS.map(q => [q.key, q.label])).toEqual([
      ['weakness', BACK_LABEL.newWeakness],
      ['fast', 'It is getting worse over hours or days'],
      ['bothLegs', EMERGENCY_LABEL.bothLegs],
      ['saddle', EMERGENCY_LABEL.saddle],
      ['bladderBowel', EMERGENCY_LABEL.bladderBowel],
    ]);
    expect(REACH_LABEL).toEqual({ back: 'Back', buttock: 'Buttock', thigh: 'Thigh', belowKnee: 'Below knee', foot: 'Foot' });
  });

  it('records how far it reaches, and that it has spread when that is further than earlier today', () => {
    expect(legReport({ ...none, reach: 'belowKnee' }, 'buttock')).toEqual({ back: { reach: 'belowKnee', spreadToday: true } });
    expect(legReport({ ...none, reach: 'buttock' }, 'belowKnee')).toEqual({ back: { reach: 'buttock' } });
    expect(legReport({ ...none, reach: 'buttock' }, 'buttock')).toEqual({ back: { reach: 'buttock' } });
    expect(legReport({ ...none, reach: 'thigh' }, undefined)).toEqual({ back: { reach: 'thigh' } });
    expect(legReport(none, 'thigh')).toEqual({ back: {} });
  });

  it('records new weakness, and how fast it is getting worse', () => {
    expect(legReport({ ...none, weakness: true }, undefined)).toEqual({ back: { newWeakness: true, newNeuro: true, weaknessFast: false } });
    expect(legReport({ ...none, weakness: true, fast: true }, undefined)).toEqual({ back: { newWeakness: true, newNeuro: true, weaknessFast: true } });
    // "Getting worse quickly" means nothing without the weakness it qualifies.
    expect(legReport({ ...none, fast: true }, undefined)).toEqual({ back: {} });
  });

  it('records both legs, saddle numbness and bladder or bowel change as emergencies', () => {
    expect(legReport({ ...none, bothLegs: true }, undefined)).toEqual({ emergency: ['bothLegs'], back: {} });
    expect(legReport({ ...none, saddle: true }, undefined)).toEqual({ emergency: ['saddle'], back: { caudaEquinaFlag: true } });
    expect(legReport({ ...none, bladderBowel: true }, undefined)).toEqual({ emergency: ['bladderBowel'], back: { caudaEquinaFlag: true } });
    expect(legReport({ ...none, bothLegs: true, saddle: true, bladderBowel: true }, undefined).emergency).toEqual(['bothLegs', 'saddle', 'bladderBowel']);
  });
});

describe('the movement that brought leg symptoms on (scan X2-09)', () => {
  it('is left out for the day when named: on a walk, walking itself', () => {
    expect(legReport({ ...none, spread: true }, 'thigh', 'brisk-walking')).toEqual({ provoked: ['brisk-walking'], back: { spreadToday: true } });
    expect(legReport(none, undefined)).not.toHaveProperty('provoked');
  });
});
