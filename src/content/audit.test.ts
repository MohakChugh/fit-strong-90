import { describe, expect, it } from 'vitest';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import { CARDS } from './cards';
import { CLAIMS } from './claims';
import { checkCitations, checkMeals, checkSafety } from './integrity';
import { cardsInTopic, claimIdsOfCard, getCard, getClaim, getMeal, sourcesFor } from './library';
import { MEAL_INTRO, SLOT_NOTES } from './meals';
import {
  cardBlocks, cardsForTopic, contextFromProfile, contextOf, habitAdvice, isCardVisible, relatedCards, resolveGroups,
  type CardBlock,
} from './personalise';
import type { Claim } from './schema';
import { search } from './search';
import { normalise } from './text';
import { componentsFor, isAvoided, mealsFor, unmatchedAvoid } from './week';

/**
 * Regression cases for Codex's content audit (docs/reimagine/codex-review-content.md,
 * findings F01–F25). Each would fail on the library as it was before the fixes.
 */

const profile = (input: ProfileInput) => createDefaultProfile(input);
/** A profile whose medicine answers were given, so only what is set here counts. */
const answered = (health: ProfileInput['health'], extra: Omit<ProfileInput, 'health'> = {}) =>
  contextFromProfile(profile({ ...extra, health: { medicinesReviewed: true, ...health } }));
const unknown = contextOf(['healthUnknown']);

const shownIds = (blocks: CardBlock[]) =>
  blocks.flatMap(b => ('claims' in b ? b.claims.flatMap(s => [s.claim.id, ...s.attached.map(a => a.id)]) : []));
const kinds = (blocks: CardBlock[]) => blocks.map(b => b.kind);
const shown = (cardId: string, ctx = unknown) => shownIds(cardBlocks(getCard(cardId)!, ctx));
const statement = (id: string) => getClaim(id)!.statement;

describe('F01 a recorded fluid limit reaches Guide', () => {
  const limited = contextFromProfile(profile({ health: { fluidRestriction: true } }));
  const water = getCard('card-water-amount')!;

  it('withholds generic water advice everywhere for a fluid limit kept in the profile', () => {
    expect(limited.because.get('fluidCaution')).toBe('You told us your care team has asked you to limit fluids');
    expect(isCardVisible(water, limited)).toBe(false);
    expect(cardsForTopic('water', limited).map(c => c.id)).not.toContain(water.id);
    expect(search('water', limited).map(r => r.id)).not.toContain(water.id);
    expect(relatedCards(getCard('card-drinks')!, limited).map(c => c.id)).not.toContain(water.id);
    expect(habitAdvice('water', limited)?.offered).toBe(false);
  });

  it('treats "not sure" as a limit, and says so', () => {
    const unsure = contextFromProfile(profile({ health: { fluidRestriction: 'unsure' } }));
    expect(unsure.because.get('fluidCaution')).toBe('You weren’t sure whether your care team wants you to limit fluids');
    expect(isCardVisible(water, unsure)).toBe(false);
  });

  it('reads an answer kept the old way only when the profile has none', () => {
    const legacyUnsure = contextFromProfile(profile({}), undefined, { fluidLimit: 'unsure' as never });
    expect(legacyUnsure.facts.has('fluidCaution')).toBe(true);
    const newerNo = contextFromProfile(profile({ health: { fluidRestriction: false } }), undefined, { fluidLimit: true });
    expect(newerNo.facts.has('fluidCaution')).toBe(false);
    expect(isCardVisible(water, newerNo)).toBe(true);
  });

  it('keeps the kidney and heart safeguards whatever the fluid answer', () => {
    expect(contextFromProfile(profile({ health: { fluidRestriction: false, kidneyDisease: 'ckd' } })).facts.has('fluidCaution')).toBe(true);
    expect(contextFromProfile(profile({ health: { fluidRestriction: false, heartOrVascularDisease: true } })).facts.has('fluidCaution')).toBe(true);
  });

  it('offers no water reminder before the health questions are answered, as reminders do', () => {
    expect(habitAdvice('water', contextFromProfile(undefined))?.offered).toBe(false);
    expect(habitAdvice('water', contextFromProfile(profile({ needsHealthReview: true })))?.offered).toBe(false);
    expect(habitAdvice('water', answered({}))?.offered).toBe(true);
  });
});

describe('F02 movement precautions travel with every movement directive', () => {
  const directives = CLAIMS.filter(c => c.movement);

  it('marks the walking, standing and activity prompts and gives each its precautions', () => {
    expect(directives.map(c => c.id)).toEqual(expect.arrayContaining([
      'walk-meals-try', 'sit-30', 'sit-hourly', 'sit-nin-tips', 'desk-ways-to-change',
      'act-who', 'act-start-small', 'act-talk-test', 'steps-build', 'back-normal-activities',
    ]));
    for (const c of directives) {
      expect(c.cautionIds, c.id).toEqual(expect.arrayContaining(['walk-carry-sugar', 'walk-foot-wound']));
      if (c.movement === 'weightBearing') {
        expect(c.cautionIds, c.id).toContain('walk-feet');
        expect(c.swap?.when, c.id).toBe('footWound');
      }
    }
  });

  const sulfonylurea = answered({ diabetes: 'type2', sulfonylureaOrMeglitinide: true });
  it.each(CARDS.map(c => [c.id]))('shows the low-sugar precaution wherever %s shows a movement prompt to someone on a sulfonylurea', id => {
    const ids = shown(id, sulfonylurea);
    if (ids.some(x => getClaim(x)?.movement)) expect(ids).toContain('walk-carry-sugar');
  });

  it('says to check before, during and after activity as the care plan says, with no interval of its own', () => {
    expect(statement('walk-carry-sugar')).toMatch(/before, during and after/);
    expect(statement('walk-carry-sugar')).toMatch(/care plan/);
    expect(statement('walk-carry-sugar')).not.toMatch(/\d/);
  });

  it('shows the after-meal walk on the supplements card only with its precautions', () => {
    const ids = shown('card-supplements');
    expect(ids).toContain('walk-meals-try');
    expect(ids).toEqual(expect.arrayContaining(['walk-carry-sugar', 'walk-foot-wound', 'walk-feet']));
  });

  it('does not repeat a precaution the card already shows', () => {
    for (const card of CARDS) {
      const ids = shown(card.id);
      expect(new Set(ids).size, card.id).toBe(ids.length);
    }
  });

  const wound = answered({ diabetes: 'type2', footStatus: 'current_wound_or_active_charcot' });
  it('replaces every standing or walking prompt for an open foot wound, and says why', () => {
    for (const card of CARDS) {
      const ids = shown(card.id, wound);
      expect(ids.filter(id => getClaim(id)?.movement === 'weightBearing'), card.id).toEqual([]);
      const hadPrompt = [...card.answer, ...card.notes, ...card.actions].some(id => getClaim(id)?.movement === 'weightBearing');
      if (hadPrompt) expect(ids, card.id).toContain('walk-foot-wound');
    }
    expect(kinds(cardBlocks(getCard('card-sitting-breaks')!, wound))).not.toContain('action');
  });

  it('offers a seated alternative instead of the sitting-break reminder', () => {
    expect(habitAdvice('sittingBreak', wound)).toMatchObject({ offered: false, instead: { id: 'desk-seated-change' } });
    expect(habitAdvice('sittingBreak', answered({ diabetes: 'type2' }))?.offered).toBe(true);
  });

  it('carries the sun-and-skin warning with the vitamin D sunlight action', () => {
    expect(getClaim('d-get-outside')!.cautionIds).toContain('d-sun-skin');
    expect(shown('card-d-test')).toContain('d-sun-skin');
  });
});

describe('F03 the foot-wound rule is stated as this app’s own rule', () => {
  it('covers a wound or active Charcot foot, says what the app does, and offers no swimming', () => {
    const rule = getClaim('walk-foot-wound')!;
    expect(rule.policy).toBe(true);
    expect(rule.statement).toMatch(/open foot wound or active Charcot foot/);
    expect(rule.statement).toMatch(/this app does not offer movement that puts weight through the affected foot/);
    expect(rule.statement).not.toMatch(/may suit|swim/i);
    const ctx = contextFromProfile(profile({ health: { footStatus: 'current_wound_or_active_charcot' } }));
    expect(ctx.because.get('footWound')).toBe('You told us about an open foot wound or active Charcot foot');
  });

  it('keeps general foot care, not a ban on walking, after an ulcer has healed', () => {
    const healed = answered({ diabetes: 'type2', footStatus: 'past_ulcer_or_charcot', peripheralNeuropathy: 'yes' });
    expect(healed.facts.has('footWound')).toBe(false);
    expect(shown('card-after-meal-walk', healed)).toEqual(expect.arrayContaining(['walk-meals-try', 'walk-feet']));
  });
});

/** The back red flags every back card shows, emergencies first (F04, R01, R02). */
const BACK_FLAGS = ['back-ces', 'stroke-signs', 'back-both-legs', 'back-weakness-fast', 'back-leg-weakness', 'back-fever'];

/** Where movement first appears on a card: a block holding a movement prompt, or a hand-off to walk or stretch. */
const firstMovement = (blocks: CardBlock[]) => blocks.findIndex(b => ('claims' in b
  ? b.claims.some(s => s.claim.movement)
  : b.action.to === '/walk' || b.action.to === '/move/stretch'));
const firstUrgent = (blocks: CardBlock[]) => blocks.findIndex(b => b.kind === 'emergency' || b.kind === 'soon');

/** People the back cards must keep safe, from no answers to an open foot wound. */
const PEOPLE: [string, ReturnType<typeof contextOf>][] = [
  ['no answers', unknown],
  ['sciatica', answered({ diabetes: 'type2' }, { pain: { areas: ['lowerBack', 'sciatica'] } })],
  ['sulfonylurea', answered({ diabetes: 'type2', sulfonylureaOrMeglitinide: true }, { pain: { areas: ['sciatica'] } })],
  ['open foot wound', answered({ diabetes: 'type2', footStatus: 'current_wound_or_active_charcot' }, { pain: { areas: ['sciatica'] } })],
];

describe('R01 urgent help comes before any movement, on every back card', () => {
  const backCards = cardsInTopic('back');

  it('covers every card in the back topic, including How much activity?', () => {
    expect(backCards.map(c => c.id)).toEqual(expect.arrayContaining(['card-keep-moving', 'card-walking-back', 'card-activity', 'card-steps']));
    for (const card of backCards) expect(card.emergencies, card.id).toEqual(expect.arrayContaining(BACK_FLAGS));
  });

  it.each(backCards.flatMap(card => PEOPLE.map(([who, ctx]) => [card.id, who, ctx] as const)))(
    '%s shows its red flags before any movement, answer included, for %s', (id, _, ctx) => {
      const blocks = cardBlocks(getCard(id)!, ctx);
      const urgent = firstUrgent(blocks);
      expect(urgent).toBeGreaterThan(-1);
      expect(shownIds(blocks)).toEqual(expect.arrayContaining(BACK_FLAGS));
      const moving = firstMovement(blocks);
      if (moving > -1) expect(urgent).toBeLessThan(moving);
    });

  it.each(CARDS.map(c => [c.id] as const))('keeps urgent help ahead of any movement on %s', id => {
    for (const [, ctx] of PEOPLE) {
      const blocks = cardBlocks(getCard(id)!, ctx);
      const urgent = firstUrgent(blocks);
      const moving = firstMovement(blocks);
      if (urgent > -1 && moving > -1) expect(urgent).toBeLessThan(moving);
    }
  });
});

describe('R02 the back exceptions match the safety contract', () => {
  /** The sentence of a claim that names NICE: it must not promise more than NICE says. */
  const niceSentence = (id: string) => statement(id).split(/(?<=[.;])\s+/).find(s => /NICE/.test(s)) ?? '';

  it('treats one leg getting weaker over hours or days as an emergency, without attributing that to NICE', () => {
    const fast = getClaim('back-weakness-fast')!;
    expect(fast.urgency).toBe('emergency');
    expect(fast.policy).toBe(true);
    expect(fast.statement).toMatch(/one leg/);
    expect(fast.statement).toMatch(/hours or days/);
    expect(niceSentence('back-weakness-fast')).toMatch(/referral for investigation/);
    expect(niceSentence('back-weakness-fast')).not.toMatch(/emergency/);
  });

  it('treats new symptoms in both legs as an emergency even without weakness', () => {
    const both = getClaim('back-both-legs')!;
    expect(both.urgency).toBe('emergency');
    expect(both.policy).toBe(true);
    expect(both.statement).toMatch(/numbness, tingling or weakness in both legs/);
    expect(both.statement).toMatch(/even without weakness/);
    expect(niceSentence('back-both-legs')).not.toMatch(/emergency/);
  });

  it('keeps ordinary new weakness in one leg as a check today, and points to the emergency if it is getting worse fast', () => {
    const leg = getClaim('back-leg-weakness')!;
    expect(leg.urgency).toBe('soon');
    expect(leg.statement).toMatch(/foot that drops/);
    expect(leg.statement).toMatch(/today/);
    expect(leg.statement).toMatch(/getting worse quickly.*emergency/);
  });

  it('treats feeling unwell or shivery without a measured fever, or severe sudden or fast-worsening pain, as a check today', () => {
    const unwell = getClaim('back-fever')!;
    expect(unwell.urgency).toBe('soon');
    for (const words of [/fever/, /shivering/, /generally unwell/, /taken your temperature/, /severe and sudden/, /getting worse quickly/]) {
      expect(unwell.statement).toMatch(words);
    }
  });

  it('keeps the sensory-only rule off the B12 cards, where slow tingling is a routine check', () => {
    for (const id of ['card-b12-why', 'card-b12-test']) {
      expect(getCard(id)!.emergencies, id).not.toContain('back-both-legs');
      expect(getCard(id)!.emergencies, id).toContain('back-weakness');
    }
  });
});

describe('F04 back red flags are complete', () => {
  it('treats bladder, bowel, sexual or saddle changes as an emergency even with mild pain, and says whose rule that is', () => {
    const ces = getClaim('back-ces')!;
    expect(ces.urgency).toBe('emergency');
    expect(ces.policy).toBe(true);
    for (const words of [/bladder/, /bowels/, /sexual function/, /genitals or back passage/, /even if the pain is mild/, /NICE/]) {
      expect(ces.statement).toMatch(words);
    }
  });

  it('covers sudden weakness on one side', () => {
    expect(getClaim('stroke-signs')!.urgency).toBe('emergency');
    expect(statement('stroke-signs')).toMatch(/one side/);
  });

  it('covers back pain with a fever from an allowed source', () => {
    expect(getClaim('back-fever')!.urgency).toBe('soon');
    expect(statement('back-fever')).toMatch(/fever/);
    expect(getClaim('back-fever')!.support.map(s => s.sourceId)).toContain('niams-back-pain');
  });

  it('keeps routine checks apart from emergencies', () => {
    for (const card of CARDS) {
      expect(card.cautions.filter(id => getClaim(id)?.urgency), card.id).toEqual([]);
    }
    expect(checkSafety()).toEqual([]);
  });
});

describe('F05 severe breathlessness is an emergency ahead of fluid advice', () => {
  it('opens the fluid-limit card with emergency help, then prompt contact', () => {
    const blocks = cardBlocks(getCard('card-water-limit')!, answered({ heartOrVascularDisease: true }));
    expect(kinds(blocks).slice(0, 3)).toEqual(['answer', 'emergency', 'soon']);
    expect(shownIds([blocks[1]])).toEqual(expect.arrayContaining(['emergency-heart', 'stroke-signs']));
    expect(statement('emergency-heart')).toMatch(/breathless/);
    expect(shownIds([blocks[2]])).toContain('fluid-swelling');
    expect(statement('fluid-swelling')).toMatch(/promptly/);
    expect(statement('fluid-swelling')).not.toMatch(/\d/);
  });
});

describe('F06 general meal timing carries the medicine-plan exception', () => {
  it('labels the no-snacking advice as general and attaches the exception to it and to the meal entry points', () => {
    expect(statement('fd-two-three-meals')).toMatch(/general advice/);
    expect(getClaim('fd-two-three-meals')!.cautionIds).toContain('fd-meds-timing');
    expect(getClaim('fd-personal-plan')!.cautionIds).toEqual(expect.arrayContaining(['fd-meds-timing', 'fd-fixed-insulin']));
  });

  it('shows it to someone on insulin wherever meal timing comes up', () => {
    const insulin = answered({ diabetes: 'type2', insulin: 'injections_or_pump' });
    const [snack, intro] = resolveGroups([SLOT_NOTES.snack!, MEAL_INTRO], insulin);
    expect(snack.flatMap(s => s.attached.map(a => a.id))).toContain('fd-meds-timing');
    expect(intro.flatMap(s => s.attached.map(a => a.id))).toContain('fd-fixed-insulin');
  });
});

describe('F07 SGLT2 inhibitors and changes to eating', () => {
  const sglt2 = answered({ diabetes: 'type2', sglt2i: true });

  it.each(['card-plate', 'card-grains', 'card-supplements'])('warns against ketogenic eating on %s, with the ketoacidosis signs', id => {
    expect(shown(id, sglt2)).toEqual(expect.arrayContaining(['sglt2-keto', 'sglt2-dka-signs']));
  });

  it('answers a search for fasting by pointing to the care plan', () => {
    expect(search('fasting', sglt2).map(r => r.id)).toContain('card-fasting');
    expect(shown('card-fasting', sglt2)).toEqual(expect.arrayContaining(['fast-ada', 'sglt2-plan', 'sglt2-dka-signs']));
  });

  it('says ketoacidosis can happen with normal sugar, as an emergency', () => {
    expect(getClaim('sglt2-dka-signs')!.urgency).toBe('emergency');
    expect(statement('sglt2-dka-signs')).toMatch(/normal/);
  });

  it('cites the medicine labels, not an ADA discussion, for alcohol', () => {
    expect(getClaim('alc-sglt2')!.support.map(s => s.sourceId)).toEqual(['label-empagliflozin', 'label-dapagliflozin']);
  });
});

describe('F08 sprouts are cooked, with a food-safety note', () => {
  it('names cooked sprouts and cites the food-safety note wherever sprouts appear', () => {
    let found = 0;
    for (const m of [getMeal('s-sprouts-chaat')!, getMeal('b-poha')!]) {
      const sprouts = m.components.filter(c => /sprout/i.test(c.name));
      found += sprouts.length;
      expect(sprouts.every(c => /cooked/i.test(c.name)), m.id).toBe(true);
      expect(m.claimIds, m.id).toContain('food-safety-sprouts');
    }
    expect(found).toBe(2);
    expect(getClaim('fd-fermented')!.cautionIds).toContain('food-safety-sprouts');
    expect(statement('food-safety-sprouts')).toMatch(/cooked/);
  });
});

describe('F09–F10 kidney protein and water safety', () => {
  it('F09 qualifies more plant protein for kidney disease', () => {
    for (const id of ['fd-plant-protein', 'fd-veg-protein']) expect(getClaim(id)!.cautionIds, id).toContain('ckd-protein');
    expect(shown('card-dal', answered({ kidneyDisease: 'ckd' }))).toContain('ckd-protein');
    expect(statement('ckd-protein')).toMatch(/dialysis/);
    expect(statement('ckd-protein')).not.toMatch(/\d/);
  });

  it('F10 says boiling does not remove chemicals, without inventing a method', () => {
    expect(statement('water-safe')).toMatch(/does not remove chemicals/);
    expect(statement('water-safe')).not.toMatch(/minute|tablet|filter|\d/);
    expect(getClaim('water-safe')!.support.map(s => s.sourceId)).toContain('cdc-water-emergency');
  });
});

describe('F11–F18 source accuracy', () => {
  it('F11 keeps curd out of the high-fibre list', () => {
    expect(statement('fd-fibre')).not.toMatch(/curd/);
  });

  it('F12 asks for whole or minimally polished grains, not any millet product', () => {
    expect(statement('fd-whole-grains')).toMatch(/whole or minimally polished/);
    expect(statement('fd-whole-grains')).toMatch(/just because it contains millet/);
  });

  it('F13 describes the after-meal walking result as glucose over three hours, on average', () => {
    expect(statement('walk-meals-study')).toMatch(/three hours/);
    expect(statement('walk-meals-study')).not.toMatch(/two-week crossover/);
    expect(statement('walk-meals-limits')).toMatch(/average/);
  });

  it('F14 names the trial’s population and end point', () => {
    expect(statement('back-walkback')).toMatch(/non-specific/);
    expect(statement('back-walkback')).toMatch(/limited their activities/);
    expect(statement('back-walkback-limits')).toMatch(/not evidence that walking treats a flare/);
  });

  it('F15 makes no threshold claim about steps', () => {
    expect(getClaim('steps-floor')).toBeUndefined();
    expect(statement('steps-more')).not.toMatch(/start|floor|\d,\d{3}/);
    expect(statement('steps-ding')).toMatch(/death from any cause/);
    expect(statement('steps-ding')).toMatch(/not a prediction/);
  });

  it('F16 keeps prediabetes and deficiency apart from routine use', () => {
    const d = getClaim('d-diabetes')!;
    expect(d.appliesTo).not.toContain('prediabetes');
    expect(d.statement).toMatch(/prediabetes/);
    expect(d.support.find(s => s.sourceId === 'endocrine-vitamin-d-2024')?.locator).toBe('Recommendation 10');
  });

  it('F17 cites the vitamin D deficiency section for vegans', () => {
    expect(getClaim('d-vegan')!.support[0].locator).toBe('Vitamin D Deficiency');
    expect(statement('d-vegan')).toMatch(/deficiency/);
  });

  it('F18 says many, not all, low-sodium salts contain potassium', () => {
    expect(statement('lsss-what')).toMatch(/many/);
  });
});

describe('F19 ADA Standards are cited by recommendation number only (board D32)', () => {
  const ADA = ['ada-soc-2026-s3', 'ada-soc-2026-s5', 'ada-soc-2026-s10'];

  it('gives every ADA Standards citation a recommendation number', () => {
    expect(checkCitations()).toEqual([]);
  });

  it('shows only recommendation numbers for ADA Standards on every card', () => {
    for (const card of CARDS) {
      for (const { source, locators } of sourcesFor(claimIdsOfCard(card))) {
        if (source.citeBy !== 'recommendation') continue;
        for (const l of locators) expect(l, `${card.id} ${source.id}`).toMatch(/^Recommendations? \d+\.\d+((, | and )\d+\.\d+)*$/);
      }
    }
  });

  it('moves the narrative citations to numbered recommendations or other sources', () => {
    for (const id of ['fd-plate-method', 'fd-plate-size', 'fd-whole-grains', 'fd-portion-refined', 'salt-flavour', 'salt-table', 'alc-no-safe', 'alc-sglt2', 'tob-benefit', 'tob-chewed']) {
      expect(getClaim(id)!.support.some(s => ADA.includes(s.sourceId)), id).toBe(false);
    }
    for (const id of ['d-diabetes', 'tob-vape']) {
      expect(getClaim(id)!.support.find(s => ADA.includes(s.sourceId))?.locator, id).toMatch(/^Recommendation \d/);
    }
  });

  it('reports an ADA citation without a number', () => {
    const bad: Claim = { ...getClaim('salt-ada')!, id: 'x', support: [{ sourceId: 'ada-soc-2026-s5', locator: 'Sodium' }] };
    expect(checkCitations([bad]).join()).toMatch(/recommendation number/);
  });
});

describe('F20 meal names and plates match what a pattern keeps', () => {
  it('passes the meal checks, which now include titles and the protein quarter', () => {
    expect(checkMeals()).toEqual([]);
  });

  it('gives a vegan upma a protein quarter and a salad title without curd', () => {
    expect(componentsFor(getMeal('b-upma')!, 'vegan').some(c => c.group === 'pulses')).toBe(true);
    expect(getMeal('s-salad-seeds')!.name).not.toMatch(/curd/i);
    const vegan = contextFromProfile(profile({ food: { pattern: 'vegan', avoid: [] } }));
    expect(search('curd', vegan).map(r => r.id)).not.toContain('s-salad-seeds');
  });
});

describe('F21 other scripts are kept, never silently dropped', () => {
  const anyone = contextOf();

  it('keeps Devanagari when normalising', () => {
    expect(normalise('दाल, रोटी!')).toBe('दाल रोटी');
  });

  it('finds Hindi words written in Devanagari', () => {
    expect(search('मधुमेह', anyone).map(r => r.id)).toContain('food-diabetes');
    expect(search('मधुमेह', anyone).length).toBeLessThan(9);
    expect(search('दाल', anyone).map(r => r.id)).toContain('l-roti-dal-sabzi');
  });

  it('returns nothing, not every topic, for a script it cannot match', () => {
    expect(search('பருப்பு', anyone)).toEqual([]);
  });

  it('leaves out a food named in Devanagari', () => {
    expect(isAvoided(getMeal('b-poha')!, ['मूंगफली'])).toBe(true);
  });

  it('reports leave-out entries it could not match instead of claiming them filtered', () => {
    expect(unmatchedAvoid(['peanuts', 'मूंगफली', 'பருப்பு', 'zzzz'])).toEqual(['பருப்பு', 'zzzz']);
  });
});

describe('R04 a leave-out entry is confirmed only when it hid a meal', () => {
  it('treats a compound food no single meal contains as not matched', () => {
    expect(unmatchedAvoid(['peanut chutney', 'coconut milk'], 'vegetarian')).toEqual(['peanut chutney', 'coconut milk']);
  });

  it('confirms a food only when it hides a meal this pattern would see', () => {
    expect(unmatchedAvoid(['peanuts', 'मूंगफली'], 'vegetarian')).toEqual([]);
    expect(unmatchedAvoid(['curd'], 'vegetarian')).toEqual([]);
    // A vegan never sees the curd, so leaving it out hides nothing for them.
    expect(unmatchedAvoid(['curd'], 'vegan')).toEqual(['curd']);
  });

  it('agrees with the meal filter for every entry it confirms', () => {
    for (const pattern of ['vegetarian', 'eggetarian', 'nonVegetarian', 'vegan'] as const) {
      for (const entry of ['peanuts', 'peanut chutney', 'coconut', 'coconut milk', 'dal', 'roti', 'egg', 'paneer', 'मूंगफली', 'zzzz']) {
        const hides = mealsFor({ pattern, avoid: [entry] }).length < mealsFor({ pattern, avoid: [] }).length;
        expect(unmatchedAvoid([entry], pattern).length === 0, `${pattern} / ${entry}`).toBe(hides);
      }
    }
  });
});

describe('R05 and R07 attribution', () => {
  it('R05 names ADA’s population for the ketogenic advice and keeps the labels’ wider warning', () => {
    const keto = getClaim('sglt2-keto')!;
    expect(keto.statement).toMatch(/^For people with diabetes taking an SGLT2 inhibitor, ADA/);
    expect(keto.statement).toMatch(/labels/);
    expect(keto.appliesTo).toEqual(['sglt2i']);
    expect(keto.support.map(s => s.sourceId)).toEqual(['ada-soc-2026-s5', 'label-empagliflozin', 'label-dapagliflozin']);
  });

  it('R07 cites the printed page for My Plate for the Day', () => {
    const locator = getClaim('fd-whole-grains')!.support[0].locator;
    expect(locator).toMatch(/My Plate for the Day \(p\. 6\)/);
    expect(locator).not.toMatch(/p\. 5\b/);
  });
});

describe('R03 habit offers carry their precautions for the reminders area', () => {
  it('gives a permitted movement reminder the precautions that apply to the person', () => {
    const insulin = answered({ diabetes: 'type2', insulin: 'injections_or_pump' });
    const walk = habitAdvice('mealWalk', insulin)!;
    expect(walk.offered).toBe(true);
    expect(walk.precautions.map(c => c.id)).toContain('walk-carry-sugar');
    expect(habitAdvice('mealWalk', answered({ diabetes: 'none' }))!.precautions).toEqual([]);
    expect(habitAdvice('sittingBreak', unknown)!.precautions.map(c => c.id)).toEqual(expect.arrayContaining(['walk-carry-sugar', 'walk-foot-wound']));
  });

  it('withholds standing and walking reminders with an open foot wound, with nothing to follow', () => {
    const wound = answered({ diabetes: 'type2', footStatus: 'current_wound_or_active_charcot' });
    for (const id of ['sittingBreak', 'mealWalk'] as const) {
      expect(habitAdvice(id, wound)).toMatchObject({ offered: false, precautions: [] });
    }
  });
});

describe('F22 partial matches say which words matched', () => {
  const anyone = contextOf();

  it('marks results that miss a word, and the words they do match', () => {
    const results = search('insulin zebra', anyone);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => r.missing.includes('zebra') && r.matched.includes('insulin'))).toBe(true);
  });

  it('marks complete matches as complete', () => {
    expect(search('dal', anyone).every(r => r.missing.length === 0)).toBe(true);
  });
});

describe('F23 medicine reasons restate the answer, uncertainty included', () => {
  it.each([
    [{ diabetes: 'type2', sglt2i: 'unsure' }, 'sglt2i', 'You weren’t sure about an SGLT2 inhibitor'],
    [{ diabetes: 'type2', insulin: 'unsure' }, 'hypoRisk', 'You weren’t sure about insulin'],
    [{ diabetes: 'type1' }, 'hypoRisk', 'You have type 1 diabetes'],
    [{ diabetes: 'type2', sulfonylureaOrMeglitinide: 'unsure' }, 'hypoRisk', 'You weren’t sure about a sulfonylurea or meglitinide'],
    [{ diabetes: 'type2', sulfonylureaOrMeglitinide: true }, 'hypoRisk', 'You take a sulfonylurea or meglitinide'],
  ] as const)('%o gives %s the reason “%s”', (health, fact, reason) => {
    expect(answered(health).because.get(fact)).toBe(reason);
  });

  it('says when the diabetes medicine questions have not been answered', () => {
    const ctx = contextFromProfile(profile({ health: { diabetes: 'type2' } }));
    expect(ctx.because.get('hypoRisk')).toBe('You haven’t told us your diabetes medicines yet');
  });
});

describe('F25 B12 testing and food advice fit the person', () => {
  it('explains metformin monitoring on the test card, apart from testing for symptoms', () => {
    expect(shown('card-b12-test')).toEqual(expect.arrayContaining(['b12-when-tested', 'b12-metformin', 'b12-ask-monitoring']));
  });

  it.each(['vegan', 'vegetarian', 'eggetarian'] as const)('gives a %s eater the route that fits, not a variety of animal foods', pattern => {
    const ctx = contextFromProfile(profile({ food: { pattern, avoid: [] } }));
    const ids = shown('card-b12-food', ctx);
    expect(ids).toContain('b12-low-animal-route');
    expect(ids).not.toContain('b12-variety');
  });

  it('keeps the variety of foods for someone who eats meat or fish', () => {
    const ctx = contextFromProfile(profile({ food: { pattern: 'nonVegetarian', avoid: [] } }));
    expect(shown('card-b12-food', ctx)).toContain('b12-variety');
  });

  it('says food may not be enough when absorption is the problem, and that four years is not the only reason', () => {
    for (const id of ['b12-variety', 'b12-low-animal-route']) expect(getClaim(id)!.cautionIds, id).toContain('b12-absorb');
    expect(statement('b12-metformin-yearly')).toMatch(/another risk/);
  });
});
