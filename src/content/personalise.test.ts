import { describe, expect, it } from 'vitest';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import { getCard, getClaim } from './library';
import {
  actionFor, cardsForTopic, contextFromProfile, contextOf, habitAdvice, isForYou, topicsFor, visibleCards,
} from './personalise';
import type { Predicate, TopicId } from './schema';
import { TOPICS } from './topics';

const profile = (input: ProfileInput) => createDefaultProfile(input);
const forYouIds = (facts: Predicate[]) => topicsFor(contextOf(facts)).forYou.map(f => f.topic.id);

/** The owner, as his device holds him today (see store/migrate.test.ts). */
const owner = profile({
  pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' },
  health: { diabetes: 'type2', hypertension: 'treated', sglt2i: true, diuretic: true, glucoseMonitor: 'meter', bpMonitor: true },
});

describe('topics that lead', () => {
  it('puts nothing under "For you" without a profile', () => {
    const { forYou, more } = topicsFor(contextFromProfile(undefined));
    expect(forYou).toEqual([]);
    expect(more.map(t => t.id)).toEqual(TOPICS.map(t => t.id));
  });

  it('leads with the owner’s conditions, each with his own answer as the reason', () => {
    const { forYou } = topicsFor(contextFromProfile(owner));
    expect(forYou.map(f => f.topic.id)).toEqual(['food-diabetes', 'food-bp', 'b12', 'desk', 'back']);
    expect(forYou.find(f => f.topic.id === 'food-diabetes')?.because).toBe('You have type 2 diabetes');
    expect(forYou.find(f => f.topic.id === 'food-bp')?.because).toBe('You’re treated for high blood pressure');
    expect(forYou.find(f => f.topic.id === 'back')?.because).toBe('You told us about sciatica');
  });

  it('never reorders the topics that are not for you', () => {
    const { more } = topicsFor(contextFromProfile(owner));
    const order = TOPICS.map(t => t.id);
    const positions = more.map(t => order.indexOf(t.id));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});

describe('metformin and B12', () => {
  it('leads with B12 for someone known to take metformin', () => {
    expect(forYouIds(['metformin'])).toContain('b12');
    expect(isForYou(getClaim('b12-metformin')!, contextOf(['metformin']))).toBe(true);
  });

  it('does not lead with B12 for someone without metformin who eats meat', () => {
    expect(forYouIds(['nonVegetarian'])).not.toContain('b12');
    expect(isForYou(getClaim('b12-metformin')!, contextOf(['nonVegetarian']))).toBe(false);
  });

  it('treats type 2 diabetes with no metformin answer as "metformin unknown", not as taking it', () => {
    const ctx = contextFromProfile(profile({ health: { diabetes: 'type2' } }));
    expect(ctx.facts.has('metformin')).toBe(false);
    expect(ctx.facts.has('metforminUnknown')).toBe(true);
    // The reason shown is the person's own answer, not a guess about their medicine.
    expect(topicsFor(ctx).forYou.find(f => f.topic.id === 'b12')?.because).toBe('You have type 2 diabetes');
  });

  it('reads a "yes" to metformin from the profile', () => {
    const ctx = contextFromProfile(profile({ health: { diabetes: 'type2', metformin: true } }));
    expect(ctx.facts.has('metformin')).toBe(true);
    expect(ctx.facts.has('metforminUnknown')).toBe(false);
    expect(topicsFor(ctx).forYou.find(f => f.topic.id === 'b12')?.because).toBe('You take metformin');
  });

  it('believes a clear "no" to metformin', () => {
    const ctx = contextFromProfile(profile({ health: { diabetes: 'type2', metformin: false } }));
    expect(ctx.facts.has('metformin')).toBe(false);
    expect(ctx.facts.has('metforminUnknown')).toBe(false);
    expect(topicsFor(ctx).forYou.map(f => f.topic.id)).not.toContain('b12');
    expect(isForYou(getClaim('b12-metformin')!, ctx)).toBe(false);
  });

  it('keeps "not sure" about metformin as unknown, citing that answer', () => {
    const ctx = contextFromProfile(profile({ health: { diabetes: 'type2', metformin: 'unsure' } }));
    expect(ctx.facts.has('metformin')).toBe(false);
    expect(ctx.facts.has('metforminUnknown')).toBe(true);
    expect(topicsFor(ctx).forYou.find(f => f.topic.id === 'b12')?.because).toBe('You weren’t sure about metformin');
  });

  it('does not raise metformin for type 1 diabetes or no diabetes', () => {
    expect(contextFromProfile(profile({ health: { diabetes: 'type1' } })).facts.has('metforminUnknown')).toBe(false);
    expect(contextFromProfile(profile({ health: { diabetes: 'none' } })).facts.has('metforminUnknown')).toBe(false);
  });
});

describe('vegetarian and non-vegetarian eaters', () => {
  it('leads with B12 for a vegetarian, citing what they eat', () => {
    const ctx = contextFromProfile(profile({ health: { diabetes: 'none' } }), { pattern: 'vegetarian', avoid: [] });
    const b12 = topicsFor(ctx).forYou.find(f => f.topic.id === 'b12');
    expect(b12?.because).toBe('You eat vegetarian food');
    expect(isForYou(getClaim('b12-vegetarian-hard')!, ctx)).toBe(true);
  });

  it('does not lead with B12 for a non-vegetarian without diabetes', () => {
    const ctx = contextFromProfile(profile({ health: { diabetes: 'none' } }), { pattern: 'nonVegetarian', avoid: [] });
    expect(topicsFor(ctx).forYou.map(f => f.topic.id)).not.toContain('b12');
    expect(isForYou(getClaim('b12-vegetarian-hard')!, ctx)).toBe(false);
  });

  it('leads with vitamin D only for a vegan', () => {
    expect(forYouIds(['vegan', 'lowAnimalFood'])).toContain('vitamin-d');
    expect(forYouIds(['vegetarian', 'lowAnimalFood'])).not.toContain('vitamin-d');
  });

  it('reads the pattern from the profile’s food preferences', () => {
    const ctx = contextFromProfile(profile({ food: { pattern: 'vegan', avoid: [] } }));
    expect(ctx.facts.has('vegan')).toBe(true);
    expect(ctx.facts.has('lowAnimalFood')).toBe(true);
  });
});

describe('water with a kidney or heart condition', () => {
  const kidney = contextFromProfile(profile({ health: { kidneyDisease: 'ckd' } }));
  const healthy = contextFromProfile(profile({}));

  it('suppresses the generic water card with kidney disease and shows the fluid-limit card', () => {
    const ids = cardsForTopic('water', kidney).map(c => c.id);
    expect(ids).not.toContain('card-water-amount');
    expect(ids).toContain('card-water-limit');
    expect(visibleCards(kidney).map(c => c.id)).not.toContain('card-water-amount');
  });

  it('shows the generic water card without one', () => {
    expect(cardsForTopic('water', healthy).map(c => c.id)).toContain('card-water-amount');
  });

  it('suppresses it too with a heart condition, or when unsure about the kidneys', () => {
    const heart = contextFromProfile(profile({ health: { heartOrVascularDisease: true } }));
    const unsure = contextFromProfile(profile({ health: { kidneyDisease: 'unsure' } }));
    expect(cardsForTopic('water', heart).map(c => c.id)).not.toContain('card-water-amount');
    expect(cardsForTopic('water', unsure).map(c => c.id)).not.toContain('card-water-amount');
    expect(topicsFor(unsure).forYou.find(f => f.topic.id === 'water')?.because).toBe('You weren’t sure about a kidney condition');
  });

  it('suppresses it for a fluid limit given in You, with no kidney or heart condition', () => {
    const limited = contextFromProfile(profile({}), undefined, { fluidLimit: true });
    expect(cardsForTopic('water', limited).map(c => c.id)).not.toContain('card-water-amount');
    expect(habitAdvice('water', limited)?.offered).toBe(false);
    expect(topicsFor(limited).forYou.find(f => f.topic.id === 'water')?.because).toBe('You told us your care team has asked you to limit fluids');
    expect(cardsForTopic('water', contextFromProfile(profile({}), undefined, { fluidLimit: false })).map(c => c.id)).toContain('card-water-amount');
  });

  it('withholds the water reminder and says why', () => {
    const advice = habitAdvice('water', kidney);
    expect(advice?.offered).toBe(false);
    expect(advice?.instead?.id).toBe('water-plan-first');
    expect(habitAdvice('water', healthy)?.offered).toBe(true);
  });

  it('marks the kidney cautions as for this person', () => {
    expect(isForYou(getClaim('water-kidney')!, kidney)).toBe(true);
    expect(isForYou(getClaim('water-kidney')!, healthy)).toBe(false);
  });
});

describe('hand-offs the readiness engine rules out', () => {
  it('offers no walk with an open foot wound, as the engine’s FOOT rule requires', () => {
    const wound = contextFromProfile(profile({ health: { diabetes: 'type2', footStatus: 'current_wound_or_active_charcot' } }));
    expect(wound.facts.has('footWound')).toBe(true);
    expect(actionFor(getCard('card-after-meal-walk')!, wound)).toBeUndefined();
    expect(habitAdvice('mealWalk', wound)?.offered).toBe(false);
  });

  it('offers the walk otherwise', () => {
    const ctx = contextFromProfile(profile({ health: { diabetes: 'type2' } }));
    expect(actionFor(getCard('card-after-meal-walk')!, ctx)?.to).toBe('/walk');
  });
});

describe('every topic stays useful', () => {
  const contexts: [string, ReturnType<typeof contextOf>][] = [
    ['nobody', contextFromProfile(undefined)],
    ['the owner', contextFromProfile(owner)],
    ['kidney and heart', contextFromProfile(profile({ health: { kidneyDisease: 'ckd', heartOrVascularDisease: true } }))],
  ];

  it.each(contexts)('leaves at least one card in every topic for %s', (_, ctx) => {
    for (const t of TOPICS) expect(cardsForTopic(t.id as TopicId, ctx).length).toBeGreaterThan(0);
  });
});
