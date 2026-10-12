import { describe, expect, it } from 'vitest';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import { parseAddParam } from '@/screens/track/logKinds';
import { interpretPressure } from '@/screens/track/targets';
import { BACK_RED_FLAGS, CARDS } from './cards';
import { CLAIMS } from './claims';
import { checkCitations, checkSafety } from './integrity';
import { cardsInTopic, claimIdsOfCard, getCard, getClaim, getMeal, getTopic, sourcesFor } from './library';
import { MEAL_INTRO } from './meals';
import { cardBlocks, cardsForTopic, contextFromProfile, contextOf, isForYou, resolveGroups, type GuideContext } from './personalise';
import { ROUTES } from './schema';
import { search } from './search';
import { SOURCES } from './sources';
import { isAvoided } from './week';

/**
 * Checks at home, sciatica's course and search (codex-acceptance J06, J12,
 * J16). The patterns below are the ones the acceptance runner applies to the
 * rendered Guide, checked here on the content the screens render.
 */

const profile = (input: ProfileInput) => createDefaultProfile(input);
/** A diabetes profile whose medicine answers were given, so only what is set here counts. */
const answered = (health: ProfileInput['health'], extra: Omit<ProfileInput, 'health'> = {}) =>
  contextFromProfile(profile({ ...extra, health: { diabetes: 'type2', medicinesReviewed: true, ...health } }));

const metforminOnly = answered({ metformin: true });
const sulfonylurea = answered({ metformin: true, sulfonylureaOrMeglitinide: true });
const basal = answered({ insulin: 'injections_or_pump', insulinRegimen: 'basalOnly', metformin: true });
const multipleDaily = answered({ insulin: 'injections_or_pump', insulinRegimen: 'multipleDaily' });
const pump = answered({ insulin: 'injections_or_pump', insulinRegimen: 'pump' });
const unknown = contextOf(['healthUnknown']);

/** Everything a card shows this person, as the screen reads it: title, question and every sentence. */
function shown(cardId: string, ctx: GuideContext): string {
  const card = getCard(cardId)!;
  const sentences = cardBlocks(card, ctx).flatMap(b => ('claims' in b
    ? b.claims.flatMap(s => [s.claim.statement, ...s.attached.map(a => a.statement)])
    : [b.action.label]));
  return [card.title, card.question, ...sentences].join(' ');
}

/** A topic's rows as the topic screen lists them: title and question. */
const topicRows = (ctx: GuideContext) => cardsForTopic('food-diabetes', ctx).map(c => `${c.title} ${c.question}`).join(' ');
/** Search result rows as the Guide lists them: title and second line. */
const resultRows = (query: string, ctx: GuideContext) => search(query, ctx).map(r => `${r.title} ${r.detail}`);

const GLUCOSE_CARDS = ['card-glucose-checks', 'card-glucose-basal', 'card-glucose-meals', 'card-glucose-record'];
/** A fixed number of checks a day, which no guideline sets for everyone (J12 step 8). */
const DAILY_COUNT = /\b(\d+|one|two|three|four|six|ten)\s*(to\s*\d+\s*)?(times|checks|tests) (a|per|each) day\b|\b(6|six) to (10|ten)\b/i;
/** A daily fasting check given to someone who doesn't need one (J06 step 1). */
const DAILY_FASTING = /(every|each) (day|morning)[^.]*fasting|daily fasting (check|test|reading)/i;

describe('how often to check glucose', () => {
  it('is found by every way of asking for it, ahead of any topic row that could pass for it', () => {
    for (const q of ['glucose', 'glucose monitoring', 'diabetes monitoring', 'how often check glucose', 'blood sugar test', 'sugar test', 'glucometer']) {
      expect(search(q, metforminOnly).map(r => r.id), q).toContain('card-glucose-checks');
    }
    // The runner opens the first result that names sugar and checking: it must be the answer, not a topic.
    const hits = search('glucose monitoring', metforminOnly)
      .filter(r => /glucose|blood sugar|sugar/i.test(`${r.title} ${r.detail}`) && /monitor|check|test|how often|reading/i.test(`${r.title} ${r.detail}`));
    expect(hits[0]?.id).toBe('card-glucose-checks');
  });

  it('tells a person on metformin alone that daily checks are often not needed, and gives no daily fasting check', () => {
    const text = shown('card-glucose-checks', metforminOnly);
    expect(text).toMatch(/often don’t need to check every day/);
    expect(text).not.toMatch(DAILY_FASTING);
    expect(isForYou(getClaim('gl-no-hypo-meds')!, metforminOnly)).toBe(true);
    for (const id of ['gl-su', 'gl-basal', 'gl-mealtime']) expect(isForYou(getClaim(id)!, metforminOnly), id).toBe(false);
    // HbA1c is the main measure, on ADA 6.2's conditional schedule.
    expect(text).toMatch(/HbA1c/);
    expect(sourcesFor(['gl-hba1c']).find(c => c.source.id === 'ada-soc-2026-s6')?.locators).toEqual(['Recommendations 6.1 and 6.2']);
  });

  it('distinguishes basal insulin, a sulfonylurea and several injections on the one answer everyone sees', () => {
    const text = shown('card-glucose-checks', metforminOnly);
    expect(text).toMatch(/basal/i);
    expect(text).toMatch(/sulfonylurea|gliclazide|glimepiride/i);
    expect(text).toMatch(/several injections|multiple (daily )?injections|mealtime insulin/i);
  });

  it('marks each person’s own medicine For you, and none for medicines never answered', () => {
    expect(isForYou(getClaim('gl-su')!, sulfonylurea)).toBe(true);
    expect(isForYou(getClaim('gl-basal')!, basal)).toBe(true);
    expect(isForYou(getClaim('gl-mealtime')!, multipleDaily)).toBe(true);
    expect(isForYou(getClaim('gl-mealtime')!, pump)).toBe(true);
    const unreviewed = contextFromProfile(profile({ health: { diabetes: 'type2' } }));
    for (const fact of ['noHypoMedicine', 'basalInsulin', 'mealtimeInsulin', 'sulfonylurea'] as const) {
      expect(unreviewed.facts.has(fact), fact).toBe(false);
    }
    // Not knowing is not "metformin only": the low-sugar help stays in view.
    expect(shown('card-glucose-checks', unreviewed)).toMatch(/emergency help straight away/);
    expect(contextFromProfile(profile({ needsHealthReview: true, health: { diabetes: 'type2', medicinesReviewed: true } })).facts.has('noHypoMedicine')).toBe(false);
  });

  it('restates the person’s own answer as the reason', () => {
    expect(basal.because.get('basalInsulin')).toBe('You take long-acting insulin only');
    expect(multipleDaily.because.get('mealtimeInsulin')).toBe('You take insulin several times a day');
    expect(pump.because.get('mealtimeInsulin')).toBe('You use an insulin pump');
    expect(answered({ insulin: 'automated_delivery', insulinRegimen: 'pump' }).because.get('mealtimeInsulin')).toBe('You use an insulin pump');
    expect(sulfonylurea.because.get('sulfonylurea')).toBe('You take a sulfonylurea or meglitinide');
    expect(answered({ sulfonylureaOrMeglitinide: 'unsure' }).because.get('sulfonylurea')).toBe('You weren’t sure about a sulfonylurea or meglitinide');
    expect(metforminOnly.because.get('noHypoMedicine')).toBe('You don’t take insulin, a sulfonylurea or a meglitinide');
    expect(answered({ sulfonylureaOrMeglitinide: 'unsure' }).facts.has('noHypoMedicine')).toBe(false);
  });

  it('changes what the diabetes topic lists when the regimen changes from basal to several injections (J12 step 8)', () => {
    const basalList = topicRows(basal);
    const multiList = topicRows(multipleDaily);
    expect(cardsForTopic('food-diabetes', basal).map(c => c.id)).toContain('card-glucose-basal');
    expect(cardsForTopic('food-diabetes', basal).map(c => c.id)).not.toContain('card-glucose-meals');
    expect(cardsForTopic('food-diabetes', multipleDaily).map(c => c.id)).toContain('card-glucose-meals');
    expect(cardsForTopic('food-diabetes', multipleDaily).map(c => c.id)).not.toContain('card-glucose-basal');
    expect(cardsForTopic('food-diabetes', metforminOnly).map(c => c.id)).not.toEqual(expect.arrayContaining(['card-glucose-basal']));
    expect(multiList).not.toBe(basalList);
    expect(multiList).toMatch(/before (meals|you eat)|bedtime|before (activity|exercise)|several (times|checks)|check(s|ing)? (more often|before)/i);
    expect(basalList).toMatch(/care team|clinician/i);
    for (const [who, ctx] of [['basal', basal], ['several injections', multipleDaily]] as const) {
      const visible = `${topicRows(ctx)} ${resultRows('insulin', ctx).join(' ')}`;
      expect(visible, who).not.toMatch(/\b(stop|skip|pause|hold|reduce|increase|double|halve|change|adjust)\b[^.]{0,40}\b(insulin|metformin|gliclazide|glimepiride|sulfonylurea|medicine|medication|tablet|dose)\b|\b\d+\s?(units?|iu)\b|titrat/i);
      expect(visible, who).not.toMatch(DAILY_COUNT);
    }
  });

  it('gives several injections before-meal, bedtime and activity checks, and basal a fasting check on the care team’s plan', () => {
    const multi = shown('card-glucose-meals', multipleDaily);
    expect(multi).toContain(getClaim('gl-mealtime')!.statement);
    // The claim itself, not just the card's question, carries each check ADA 7.11 lists.
    for (const words of [/before meals and snacks/, /at bedtime/, /before, during and after activity/, /after treating a low/, /before you drive/]) {
      expect(getClaim('gl-mealtime')!.statement).toMatch(words);
    }
    const basalText = shown('card-glucose-basal', basal);
    expect(basalText).toMatch(/basal/i);
    expect(basalText).toMatch(/fasting checks/);
    expect(basalText).toMatch(/care team|your plan/);
    expect(basalText).not.toMatch(DAILY_FASTING);
  });

  it('never sets a number of checks or a dose, on any glucose card, for anyone', () => {
    for (const ctx of [metforminOnly, sulfonylurea, basal, multipleDaily, pump, unknown]) {
      for (const id of GLUCOSE_CARDS) {
        const card = getCard(id)!;
        if (card.showWhen && !ctx.facts.has(card.showWhen)) continue;
        const text = shown(id, ctx);
        expect(text, id).not.toMatch(DAILY_COUNT);
        expect(text, id).not.toMatch(/titrat|\b\d+\s?(units?|iu)\b/i);
      }
    }
    expect(getClaim('gl-no-change')!.policy).toBe(true);
  });

  it('covers what to write down and when to call, with lows first and the same-day call labelled as this app’s rule', () => {
    const text = shown('card-glucose-record', basal);
    expect(text).toMatch(/date, the time and the result/);
    expect(text).toMatch(/before or after a meal/);
    expect(text).toMatch(/when you started eating/);
    expect(text).toMatch(/often above or below the range/);
    const kinds = cardBlocks(getCard('card-glucose-record')!, basal).map(b => b.kind);
    expect(kinds.slice(0, 3)).toEqual(['answer', 'emergency', 'soon']);
    expect(getClaim('gl-serious-low')).toMatchObject({ urgency: 'soon', policy: true });
    expect(getClaim('gl-severe-low')!.urgency).toBe('emergency');
    // The serious-low line is the level the check-in calls a level 2 low.
    expect(getClaim('gl-serious-low')!.statement).toMatch(/under 54 mg\/dL \(3\.0 mmol\/L\)/);
  });

  it('cites every clinical number with an edition, and ADA by recommendation number only', () => {
    for (const id of GLUCOSE_CARDS) {
      for (const { source, locators } of sourcesFor(claimIdsOfCard(getCard(id)!))) {
        expect(`${source.title} ${source.edition}`, `${id} ${source.id}`).toMatch(/\d{4}|edition|Published|reviewed|updated/i);
        if (source.citeBy === 'recommendation') {
          for (const l of locators) expect(l, `${id} ${source.id}`).toMatch(/^Recommendations? \d+\.\d+((, | and )\d+\.\d+)*$/);
        }
      }
    }
    expect(checkCitations()).toEqual([]);
  });
});

describe('measuring blood pressure at home', () => {
  const owner = contextFromProfile(profile({ health: { diabetes: 'type2', hypertension: 'treated', medicinesReviewed: true, metformin: true } }));
  const measuring = /measur|check(ing)? (your )?(blood )?pressure|monitor|cuff|reading/i;

  it('is found by searching for blood pressure or BP, as an answer about measuring', () => {
    for (const q of ['blood pressure', 'bp', 'BP machine', 'how to check bp']) {
      expect(search(q, owner).map(r => r.id), q).toContain('card-bp-measure');
    }
    const rows = search('blood pressure', owner).filter(r => measuring.test(`${r.title} ${r.detail}`)).map(r => r.id);
    expect(rows).toEqual(expect.arrayContaining(['card-bp-measure', 'card-bp-numbers']));
  });

  it('gives the whole protocol (J06 step 2)', () => {
    const text = `${shown('card-bp-measure', owner)} ${shown('card-bp-numbers', owner)}`;
    const required: [string, RegExp][] = [
      ['a validated upper-arm cuff', /validated[^.]*(upper[- ]arm|cuff)|upper[- ]arm[^.]*(cuff|monitor)/i],
      ['a bare arm', /bare (upper )?arm|sleeve/i],
      ['the arm at heart level', /heart level|level (with|of) (your|the) heart/i],
      ['a 5-minute rest', /5 minutes|five minutes/i],
      ['back supported', /back (is )?supported|support(ed)? (your )?back|lean back/i],
      ['feet flat', /feet flat|flat on the floor/i],
      ['legs uncrossed', /legs uncrossed|uncross/i],
      ['no talking', /no talking|don.t talk|without talking|not talk/i],
      ['nothing with caffeine, no exercise or smoking for 30 minutes', /30 minutes[^.]*smoke[^.]*exercise[^.]*caffeine/i],
      ['two readings at least one minute apart', /two readings[^.]*(a|one|1) minute apart/i],
      ['morning and evening', /morning and again in the evening/i],
    ];
    expect(required.filter(([, re]) => !re.test(text)).map(([name]) => name)).toEqual([]);
  });

  it('distinguishes NICE home 135/85 and clinic 140/90 from ADA’s 130/80 goal for diabetes, saying which applies to what', () => {
    const text = shown('card-bp-numbers', owner);
    expect(text).toMatch(/135\/85/);
    expect(text).toMatch(/140\/90/);
    expect(text).toMatch(/130\/80/);
    expect(getClaim('bpn-ada')!.statement).toMatch(/^For people with diabetes, ADA/);
    expect(getClaim('bpn-ada')!.statement).toMatch(/if that can be reached safely/);
    expect(getClaim('bpn-which')!.statement).toMatch(/135\/85 is for an average of home readings, its 140\/90 is for clinic readings, and ADA’s 130\/80 is for people with diabetes/);
    expect(sourcesFor(['bpn-ada']).find(c => c.source.id === 'ada-soc-2026-s10')?.locators).toEqual(['Recommendations 10.1 and 10.4']);
    expect(sourcesFor(['bpn-nice'])[0].source.id).toBe('nice-ng136');
  });

  it('treats chest pain and stroke signs as emergencies at any reading, before the advice, on both cards', () => {
    for (const id of ['card-bp-measure', 'card-bp-numbers']) {
      const blocks = cardBlocks(getCard(id)!, owner);
      const emergency = blocks.find(b => b.kind === 'emergency');
      expect(emergency && 'claims' in emergency ? emergency.claims.map(s => s.claim.id) : [], id)
        .toEqual(expect.arrayContaining(['emergency-heart', 'stroke-signs', 'bp-severe-emergency']));
      expect(blocks.findIndex(b => b.kind === 'emergency'), id).toBeLessThan(blocks.findIndex(b => b.kind === 'actions'));
    }
    expect(checkSafety()).toEqual([]);
  });

  it('draws the very-high line where Track and the check-in do: 180 or more, or 120 or more, either number', () => {
    for (const id of ['bp-severe-emergency', 'bp-severe-recheck']) {
      expect(getClaim(id)!.statement, id).toMatch(/top number is 180 or more, or the bottom number 120 or more/);
    }
    expect(interpretPressure(180, 70)?.tone).toBe('stop');
    expect(interpretPressure(150, 120)?.tone).toBe('stop');
    expect(interpretPressure(179, 119)).toBeUndefined();
    expect(getClaim('bp-severe-recheck')).toMatchObject({ urgency: 'soon', policy: true });
  });
});

describe('waist', () => {
  const text = shown('card-waist', contextOf());

  it('sets RSSDI’s 90 or more beside ICMR-NIN’s more than 90, and explains the one place they differ (J06 step 5)', () => {
    expect(getClaim('waist-rssdi')!.statement).toMatch(/90 cm or more in men, or 80 cm or more in women/);
    expect(getClaim('waist-nin')!.statement).toMatch(/more than 90 cm in men, or more than 80 cm in women/);
    expect(getClaim('waist-same-line')!.statement).toMatch(/exactly 90 cm meets RSSDI’s cut-off but not ICMR-NIN’s/);
    expect(getClaim('waist-rssdi')!.support[0].sourceId).toBe('rssdi-esi-2020');
    expect(getClaim('waist-nin')!.support[0]).toEqual({ sourceId: 'nin-dgi-2024', locator: 'Guideline 9, rationale (p. 62) and waist circumference (p. 64)' });
  });

  it('states both sexes’ lines and never applies one to the person', () => {
    expect(text).toMatch(/women/);
    expect(text).not.toMatch(/(you|your waist)[^.]*(are|is) (at|above)[^.]*(men|male)/i);
  });

  it('measures the way Track asks, and names BMI frameworks without merging them', () => {
    expect(getClaim('waist-measure')!.statement).toMatch(/lowest rib and the top of your hip bone/);
    expect(getClaim('waist-measure')!.statement).toMatch(/end of a normal breath out/);
    expect(getClaim('bmi-indian')!.statement).toMatch(/RSSDI counts 23 to 24\.9 as overweight and 25 or more as obesity; ICMR-NIN counts over 23 to 27\.5 as overweight and above 27\.5 as obesity/);
  });

  it('is found by searching waist, and by common words for the tummy', () => {
    expect(search('waist', contextOf())[0].id).toBe('card-waist');
    for (const q of ['pet', 'tummy', 'belly fat', 'कमर']) expect(search(q, contextOf()).map(r => r.id), q).toContain('card-waist');
  });
});

describe('how sciatica gets better (J16 step 8)', () => {
  const flare = contextFromProfile(profile({ pain: { areas: ['lowerBack', 'sciatica'] } }));

  it('says it often takes weeks to months, that it can come back, and promises no cure, across the back topic', () => {
    const text = cardsForTopic('back', flare).map(c => shown(c.id, flare)).join(' ');
    expect(text).toMatch(/weeks (to|or) months|several weeks|months/i);
    expect(text).toMatch(/come back|recur|return/i);
    expect(text).not.toMatch(/\bcures?\b|guarantee/i);
  });

  it('says most people get better, and that some still have pain a year on, from NICE NG59 and a review', () => {
    expect(getClaim('sci-gets-better')!.statement).toMatch(/^Most people with a new episode of back pain or sciatica get better/);
    expect(getClaim('sci-some-longer')!.statement).toMatch(/up to about 3 in 10/);
    const cited = sourcesFor(claimIdsOfCard(getCard('card-sciatica-course')!)).map(c => c.source.id);
    expect(cited).toEqual(expect.arrayContaining(['nice-ng59-context', 'koes-2007', 'nice-ng59']));
    expect(isForYou(getClaim('sci-gets-better')!, flare)).toBe(true);
  });

  it('shows the red flags before anything about moving', () => {
    const card = getCard('card-sciatica-course')!;
    expect(cardsInTopic('back').map(c => c.id)).toContain(card.id);
    expect(card.emergencies).toEqual(BACK_RED_FLAGS);
    const kinds = cardBlocks(card, flare).map(b => b.kind);
    expect(kinds.indexOf('emergency')).toBe(0);
    expect(kinds.indexOf('emergency')).toBeLessThan(kinds.indexOf('answer'));
  });
});

describe('search finds the topics people ask about', () => {
  const anyone = contextOf();

  it.each([
    ['glucose', ['food-diabetes', 'card-glucose-checks']],
    ['sugar', ['food-diabetes', 'card-glucose-checks']],
    ['blood sugar', ['food-diabetes', 'card-glucose-checks']],
    ['BP', ['food-bp', 'card-bp-measure']],
    ['blood pressure', ['food-bp', 'card-bp-measure', 'card-bp-numbers']],
    ['B12', ['b12']],
    ['vitamin D', ['vitamin-d']],
    ['sciatica', ['back', 'card-sciatica-course']],
    ['waist', ['card-waist']],
    ['hba1c', ['card-glucose-checks']],
  ])('“%s” finds %o', (query, expected) => {
    const found = search(query, anyone);
    expect(found.map(r => r.id)).toEqual(expect.arrayContaining(expected));
    expect(found.filter(r => expected.includes(r.id)).every(r => r.missing.length === 0)).toBe(true);
  });

  it.each([
    ['ghee', 'card-oil-ghee'], ['tel', 'card-oil-ghee'], ['samosa', 'card-oil-ghee'], ['pakora', 'card-oil-ghee'], ['puri', 'card-oil-ghee'],
    ['jalebi', 'card-drinks'], ['lassi', 'card-drinks'], ['cheeni', 'card-drinks'], ['aam', 'card-drinks'], ['kela', 'card-drinks'],
    ['maida', 'card-grains'], ['suji', 'card-grains'], ['besan', 'card-dal'], ['biryani', 'card-plate'], ['murgi', 'l-chicken-roti'],
    ['roti', 'card-grains'], ['dal', 'card-dal'], ['chawal', 'card-grains'], ['dahi', 'card-b12-food'], ['namak', 'card-salt-limit'],
    ['achar', 'card-hidden-salt'], ['chai', 'card-drinks'], ['mithai', 'card-drinks'], ['घी', 'card-oil-ghee'], ['चीनी', 'card-drinks'],
  ])('the food word “%s” finds %s', (query, id) => {
    expect(search(query, anyone).map(r => r.id)).toContain(id);
  });
});

describe('Meal ideas speaks to the person it is for (surface scan S-14)', () => {
  const ctxWith = (health: ProfileInput['health']) => contextFromProfile(profile({ health: { medicinesReviewed: true, ...health } }));
  const neither = ctxWith({});
  const diabetesOnly = ctxWith({ diabetes: 'type2', metformin: true });
  const bpOnly = ctxWith({ hypertension: 'treated', bpMedicinesReviewed: true });
  const both = ctxWith({ diabetes: 'type2', metformin: true, hypertension: 'treated', bpMedicinesReviewed: true });
  const intro = (ctx: GuideContext) => resolveGroups([MEAL_INTRO], ctx)[0];
  const ids = (ctx: GuideContext) => intro(ctx).map(s => s.claim.id);

  it('uses neutral wording for someone with neither diabetes nor high blood pressure', () => {
    expect(ids(neither)).toEqual(['fd-plate-method', 'meal-salt', 'fd-personal-plan']);
    for (const s of intro(neither)) {
      expect(s.claim.statement, s.claim.id).not.toMatch(/diabet/i);
      expect(isForYou(s.claim, neither), s.claim.id).toBe(false);
    }
    expect(getClaim('fd-plate-method')!.statement).toMatch(/the plate method/);
  });

  it('gives diabetes framing only to people with diabetes, marked For you', () => {
    expect(ids(diabetesOnly)).toEqual(['fd-plate-diabetes', 'meal-salt', 'fd-personal-plan-diabetes']);
    expect(isForYou(getClaim('fd-plate-diabetes')!, diabetesOnly)).toBe(true);
    expect(isForYou(getClaim('fd-personal-plan-diabetes')!, diabetesOnly)).toBe(true);
    expect(getClaim('fd-personal-plan-diabetes')!.statement).toMatch(/dietitian who knows diabetes/);
  });

  it('gives blood pressure framing only to people with high blood pressure, marked For you', () => {
    expect(ids(bpOnly)).toEqual(['fd-plate-method', 'meal-salt-bp', 'fd-personal-plan']);
    expect(isForYou(getClaim('meal-salt-bp')!, bpOnly)).toBe(true);
    expect(ids(both)).toEqual(['fd-plate-diabetes', 'meal-salt-bp', 'fd-personal-plan-diabetes']);
    // More fruit and vegetables with kidney disease brings the potassium caution with it.
    const kidney = ctxWith({ hypertension: 'treated', bpMedicinesReviewed: true, kidneyDisease: 'ckd' });
    expect(intro(kidney).flatMap(s => s.attached.map(a => a.id))).toContain('bp-potassium-kidney');
  });

  it('keeps the medicine-timing exceptions wherever a portion line shows, neutral or not (F06)', () => {
    for (const id of ['fd-personal-plan', 'fd-personal-plan-diabetes']) {
      expect(getClaim(id)!.cautionIds, id).toEqual(expect.arrayContaining(['fd-meds-timing', 'fd-fixed-insulin']));
    }
    expect(intro(unknown).flatMap(s => s.attached.map(a => a.id))).toEqual(expect.arrayContaining(['fd-meds-timing', 'fd-fixed-insulin']));
    // The meal detail screen names 'fd-personal-plan' itself; it resolves the same way.
    expect(resolveGroups([['fd-personal-plan']], neither)[0].map(s => s.claim.id)).toEqual(['fd-personal-plan']);
    expect(resolveGroups([['fd-personal-plan']], diabetesOnly)[0].map(s => s.claim.id)).toEqual(['fd-personal-plan-diabetes']);
  });

  it('resolves the plate measures the same way on a meal', () => {
    const meal = getMeal('l-roti-dal-sabzi')!;
    const built = (ctx: GuideContext) => resolveGroups([meal.claimIds], ctx)[0].map(s => s.claim.id);
    expect(built(neither)).toContain('fd-plate-method');
    expect(built(diabetesOnly)).toContain('fd-plate-diabetes');
    expect(built(diabetesOnly)).not.toContain('fd-plate-method');
  });
});

describe('common spellings of Indian foods (surface scan S-21)', () => {
  const anyone = contextOf();

  it.each([
    ['chapatti', ['card-grains', 'l-roti-dal-sabzi']],
    ['chappati', ['card-grains', 'l-roti-dal-sabzi']],
    ['channa', ['card-dal', 'l-chana-roti']],
    ['panner', ['card-b12-food', 'l-palak-paneer']],
    ['mutton', ['card-b12-food']],
    ['aloo', ['card-plate']],
    ['methi', ['card-supplements']],
  ])('“%s” finds %o', (query, expected) => {
    expect(search(query, anyone).map(r => r.id)).toEqual(expect.arrayContaining(expected));
  });

  it('keeps a vegan’s results free of paneer however it is spelt, and leaves meals out by any spelling', () => {
    const vegan = contextOf(['vegan', 'lowAnimalFood'], { pattern: 'vegan', avoid: [] });
    expect(search('panner', vegan).filter(r => r.kind === 'meal')).toEqual([]);
    expect(isAvoided(getMeal('l-roti-dal-sabzi')!, ['chapatti'])).toBe(true);
    expect(isAvoided(getMeal('l-chana-roti')!, ['channa'])).toBe(true);
  });
});

describe('hand-offs to Track', () => {
  it('opens the form for the reading each card is about', () => {
    expect(parseAddParam(new URL(ROUTES.addGlucose, 'https://x.invalid').searchParams.get('add'))).toEqual({ kind: 'glucose' });
    expect(parseAddParam(new URL(ROUTES.addBloodPressure, 'https://x.invalid').searchParams.get('add'))).toEqual({ kind: 'bloodPressure' });
    expect(parseAddParam(new URL(ROUTES.addWaist, 'https://x.invalid').searchParams.get('add'))).toEqual({ kind: 'waist' });
    expect(getCard('card-glucose-checks')!.action?.to).toBe(ROUTES.addGlucose);
    expect(getCard('card-bp-measure')!.action?.to).toBe(ROUTES.addBloodPressure);
    expect(getCard('card-waist')!.action?.to).toBe(ROUTES.addWaist);
  });
});

describe('licences of the new sources (board D32)', () => {
  it('attributes RSSDI’s open licence, cites no NHS page and reproduces no source text', () => {
    expect(SOURCES.find(s => s.id === 'rssdi-esi-2020')!.licence).toMatch(/Creative Commons Attribution-NonCommercial-ShareAlike 4\.0/);
    const ids = ['rssdi-esi-2020', 'icmr-t2dm-2018', 'ada-soc-2026-s6', 'ada-soc-2026-s7', 'nice-ng28', 'nice-ng136', 'nice-ng59-context',
      'niddk-managing', 'cdc-low-sugar', 'aha-home-bp', 'aha-bp-911', 'aha-bp-2019', 'who-waist-2011', 'koes-2007'];
    for (const id of ids) expect(SOURCES.find(s => s.id === id), id).toBeDefined();
    for (const id of ['ada-soc-2026-s6', 'ada-soc-2026-s7']) expect(SOURCES.find(s => s.id === id)!.citeBy, id).toBe('recommendation');
    const added = CLAIMS.filter(c => c.support.some(s => ids.includes(s.sourceId)));
    expect(added.length).toBeGreaterThan(40);
    for (const c of added) expect(c.statement, c.id).not.toMatch(/["“”]/);
  });

  it('keeps every new card within the card rules', () => {
    for (const id of [...GLUCOSE_CARDS, 'card-bp-measure', 'card-bp-numbers', 'card-waist', 'card-sciatica-course', 'card-oil-ghee']) {
      const card = CARDS.find(c => c.id === id)!;
      expect(card, id).toBeDefined();
      expect(getTopic(card.topics[0]), id).toBeDefined();
    }
  });
});
