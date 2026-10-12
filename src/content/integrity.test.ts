import { describe, expect, it } from 'vitest';
import { CARDS } from './cards';
import { CLAIMS } from './claims';
import {
  allTexts, checkCards, checkClaims, checkFurtherReading, checkHabits, checkMeals, checkNoDoses,
  checkNoOrphanClaims, checkSafety, checkSources, checkUniqueIds, hasDoseAdvice, isNhs,
} from './integrity';
import { MEALS } from './meals';
import type { Claim, GuidanceCard, MealTemplate, Source } from './schema';
import { FURTHER_READING, SOURCES } from './sources';

describe('content integrity', () => {
  it('has no duplicate ids', () => {
    expect(checkUniqueIds()).toEqual([]);
  });

  it('cites only sources that exist, each with a locator, and never the NHS', () => {
    expect(checkClaims()).toEqual([]);
  });

  it('gives every source a URL, a locator, an organisation and a reading record, with no orphans', () => {
    expect(checkSources()).toEqual([]);
  });

  it('builds every card from existing claims and links only to existing cards and topics', () => {
    expect(checkCards()).toEqual([]);
  });

  it('builds every meal from existing claims and sourced measures', () => {
    expect(checkMeals()).toEqual([]);
  });

  it('ties every habit to existing claims and a card', () => {
    expect(checkHabits()).toEqual([]);
  });

  it('keeps further reading separate from sources', () => {
    expect(checkFurtherReading()).toEqual([]);
  });

  it('shows every claim somewhere', () => {
    expect(checkNoOrphanClaims()).toEqual([]);
  });

  it('gives every claim a reviewed date', () => {
    expect(CLAIMS.filter(c => !/^\d{4}-\d{2}-\d{2}$/.test(c.reviewedDate))).toEqual([]);
  });

  it('contains no dosing advice anywhere', () => {
    expect(checkNoDoses()).toEqual([]);
    // The guard must actually be looking at the library's text.
    expect(allTexts().length).toBeGreaterThan(CLAIMS.length);
  });

  it('never cites an NHS page, which may only be further reading (board D32)', () => {
    const nhsSources = SOURCES.filter(s => isNhs(s.url, s.organisation)).map(s => s.id);
    expect(nhsSources).toEqual([]);
    const nhsCitations = CLAIMS.filter(c => c.support.some(({ sourceId }) => {
      const s = SOURCES.find(x => x.id === sourceId);
      return !s || isNhs(s.url, s.organisation);
    }));
    expect(nhsCitations).toEqual([]);
    // NHS pages do exist in the app, as further reading only.
    expect(FURTHER_READING.some(f => isNhs(f.url, f.organisation))).toBe(true);
  });
});

describe('the dose guard', () => {
  it('catches supplement and insulin dosing', () => {
    expect(hasDoseAdvice('Take 1000 mcg of B12 tablets daily.')).toBe(true);
    expect(hasDoseAdvice('A vitamin D sachet of 60,000 IU once a week.')).toBe(true);
    expect(hasDoseAdvice('Increase insulin by 2 units.')).toBe(true);
    expect(hasDoseAdvice('Metformin 500mg twice a day.')).toBe(true);
    expect(hasDoseAdvice('1.5 µg of vitamin B12 a day is the RDA.')).toBe(true);
  });

  it('lets food limits and household measures through', () => {
    expect(hasDoseAdvice('WHO advises less than 2,000 mg of sodium a day.')).toBe(false);
    expect(hasDoseAdvice('Keep salt below 5 g a day, about one level teaspoon.')).toBe(false);
    expect(hasDoseAdvice('1 small steel glass, about 100 ml')).toBe(false);
    expect(hasDoseAdvice('Ask your doctor whether B12 tablets or injections suit you.')).toBe(false);
  });

  it('judges each sentence on its own', () => {
    expect(hasDoseAdvice('Keep sodium under 2,000 mg a day. Ask about vitamin tests.')).toBe(false);
  });
});

describe('the checks themselves', () => {
  // Each rule is exercised against a deliberately broken record, so a check
  // that silently stopped working would fail here.
  const claim = (over: Partial<Claim>): Claim => ({ ...CLAIMS[0], id: 'x', ...over });
  const source = (over: Partial<Source>): Source => ({ ...SOURCES[0], id: 'y', ...over });

  it('reports a claim citing a missing source or an NHS page', () => {
    expect(checkClaims([claim({ support: [{ sourceId: 'nope', locator: 'p. 1' }] })])).toContain('Claim x cites a missing source nope');
    expect(checkClaims([claim({ support: [] })])).toContain('Claim x cites no source');
    expect(checkClaims([claim({ support: [{ sourceId: SOURCES[0].id, locator: ' ' }] })]).join()).toMatch(/no locator/);
    expect(checkClaims([claim({ statement: 'They say “eat less salt”.' })]).join()).toMatch(/quotes its source/);
    expect(checkClaims([claim({ reviewedDate: '' })]).join()).toMatch(/no reviewed date/);
  });

  it('reports a source with no URL, locator or organisation, or an NHS source', () => {
    expect(checkSources([source({ url: 'http://example.org' })]).join()).toMatch(/plain https URL/);
    expect(checkSources([source({ url: 'https://example.org/x?q=diabetes' })]).join()).toMatch(/plain https URL/);
    expect(checkSources([source({ locator: '' })]).join()).toMatch(/no locator/);
    expect(checkSources([source({ organisation: '' })]).join()).toMatch(/no organisation/);
    expect(checkSources([source({ url: 'https://www.nhs.uk/conditions/sciatica/' })]).join()).toMatch(/NHS page/);
    expect(checkSources([source({ id: 'orphan' })]).join()).toMatch(/orphan is not cited/);
  });

  it('reports a card with missing claims, the wrong number of actions or a broken link', () => {
    const base: GuidanceCard = { ...CARDS[0], id: 'z' };
    expect(checkCards([{ ...base, answer: ['missing'] }]).join()).toMatch(/missing claim missing/);
    expect(checkCards([{ ...base, actions: base.actions.slice(0, 2) }]).join()).toMatch(/2 actions/);
    expect(checkCards([{ ...base, related: ['card-nowhere'] }]).join()).toMatch(/missing card card-nowhere/);
    expect(checkCards([{ ...base, cautions: ['fd-plate-method'] }]).join()).toMatch(/not a caution/);
  });

  it('reports a meal with a missing claim or an unsourced measure', () => {
    const base: MealTemplate = { ...MEALS[0], id: 'm' };
    expect(checkMeals([{ ...base, swaps: ['missing'] }]).join()).toMatch(/missing claim missing/);
    expect(checkMeals([{ ...base, components: [{ name: '2 rotis', group: 'grains', measure: 'twoRotis' }] }]).join()).toMatch(/unknown measure twoRotis/);
  });

  it('reports a meal whose search words name a food some eaters do not get', () => {
    const dal = MEALS.find(m => m.id === 'l-roti-dal-sabzi')!;
    expect(checkMeals([{ ...dal, aliases: [...dal.aliases, 'dahi'] }]).join()).toMatch(/alias “dahi” names a food vegan eaters do not get/);
  });

  it('reports a meal title naming a dropped food, a plate with no protein, and raw sprouts', () => {
    const salad = MEALS.find(m => m.id === 's-salad-seeds')!;
    expect(checkMeals([{ ...salad, name: 'Salad with seeds and curd' }]).join()).toMatch(/title names “curd”, which vegan eaters do not get/);
    const upma = MEALS.find(m => m.id === 'b-upma')!;
    expect(checkMeals([{ ...upma, components: upma.components.filter(c => c.group !== 'pulses') }]).join()).toMatch(/b-upma has no protein for vegan eaters/);
    const chaat = MEALS.find(m => m.id === 's-sprouts-chaat')!;
    expect(checkMeals([{ ...chaat, components: [{ name: 'Moong sprouts', group: 'pulses' }] }]).join()).toMatch(/sprouts without saying they are cooked/);
    expect(checkMeals([{ ...chaat, claimIds: ['fd-healthy-snacks'] }]).join()).toMatch(/not the food-safety note/);
  });

  it('reports an urgent claim among routine cautions, an unlabelled app rule and a prompt without its precautions', () => {
    const keepMoving = CARDS.find(c => c.id === 'card-keep-moving')!;
    expect(checkSafety(CLAIMS, [{ ...keepMoving, cautions: ['back-ces'] }]).join()).toMatch(/urgent back-ces under cautions/);
    expect(checkSafety(CLAIMS, [{ ...keepMoving, emergencies: ['back-ces'] }]).join()).toMatch(/without back-both-legs first/);
    const activity = CARDS.find(c => c.id === 'card-activity')!;
    expect(checkSafety(CLAIMS, [{ ...activity, emergencies: undefined }]).join()).toMatch(/card-activity shows movement without back-ces first/);
    const rule = CLAIMS.find(c => c.id === 'walk-foot-wound')!;
    expect(checkSafety([{ ...rule, statement: 'Non-weight-bearing exercise may suit you better.' }], []).join()).toMatch(/does not say so/);
    const walk = CLAIMS.find(c => c.id === 'walk-meals-try')!;
    expect(checkSafety([{ ...walk, cautionIds: [] }], []).join()).toMatch(/does not carry walk-carry-sugar/);
    expect(checkSafety([{ ...walk, swap: undefined }], []).join()).toMatch(/does not give way with an open foot wound/);
  });
});
