import { deriveHealth, profileRules, takes } from '@/engine/health';
import { fluidRestriction } from '@/reminders/water';
import type { HabitSettings } from '@/types/habits';
import type { FoodPreferences, UserProfile } from '@/types/profile';
import { CARDS } from './cards';
import { HABITS } from './habits';
import { cardsInTopic, claims, getCard, getClaim } from './library';
import { ROUTES, type Claim, type GuidanceCard, type Habit, type InAppAction, type Predicate, type Topic, type TopicId } from './schema';
import { TOPICS } from './topics';

/**
 * What the Guide knows about the person, and why. Built only from answers the
 * person gave: a missing answer is not a "no" and never becomes a guess.
 */
export interface GuideContext {
  facts: ReadonlySet<Predicate>;
  /** The person's own answer restated, e.g. "You have type 2 diabetes". */
  because: ReadonlyMap<Predicate, string>;
  food?: FoodPreferences;
}

/** A context from explicit facts: for tests, and for callers without a profile. */
export function contextOf(facts: Predicate[] = [], food?: FoodPreferences, because: [Predicate, string][] = []): GuideContext {
  return { facts: new Set(facts), because: new Map(because), food };
}

const MEDICINES_UNKNOWN = 'You haven’t told us your diabetes medicines yet';

/**
 * Read the profile into facts, each with the person's own answer as the
 * reason. "Not sure" stays "not sure" in the reason while counting as yes for
 * safety, as everywhere in the app. Metformin is taken as answered: "yes" is
 * `metformin`; "not sure", or no answer yet from someone whose condition it
 * treats, is `metforminUnknown`, and the B12 copy is written for that.
 *
 * The fluid-limit answer is read exactly as reminders read it — the profile's
 * `health.fluidRestriction` first, an answer kept the old way in
 * `habits.fluidLimit` only when the profile has none — so Guide and reminders
 * never disagree (Codex content audit F01).
 */
export function contextFromProfile(
  profile?: UserProfile,
  food: FoodPreferences | undefined = profile?.food,
  habits?: Pick<HabitSettings, 'fluidLimit'>,
): GuideContext {
  const facts = new Set<Predicate>();
  const because = new Map<Predicate, string>();
  const add = (p: Predicate, reason: string) => {
    facts.add(p);
    if (!because.has(p)) because.set(p, reason);
  };

  // Without a profile, or before its health answers are confirmed, a "no" is
  // a placeholder: every conditional precaution stays visible.
  if (!profile || profile.needsHealthReview) add('healthUnknown', 'You haven’t answered the health questions yet');

  const limit = fluidRestriction(profile, habits);
  if (limit === true) add('fluidCaution', 'You told us your care team has asked you to limit fluids');
  if (limit === 'unsure') add('fluidCaution', 'You weren’t sure whether your care team wants you to limit fluids');

  if (profile) {
    const h = profile.health;
    const d = deriveHealth(h);
    const diabetesReason = {
      type1: 'You have type 1 diabetes',
      type2: 'You have type 2 diabetes',
      other: 'You have diabetes',
      prediabetes: 'You have prediabetes',
      none: undefined,
    }[h.diabetes];
    if (h.diabetes === 'type1') add('type1', diabetesReason!);
    if (h.diabetes === 'type2') add('type2', diabetesReason!);
    if (h.diabetes === 'other') add('otherDiabetes', diabetesReason!);
    if (h.diabetes === 'prediabetes') add('prediabetes', diabetesReason!);
    if (d.diabetic) add('diabetes', diabetesReason!);

    // A clear "no" is believed. Without an answer, the conditions metformin
    // treats keep it "unknown" rather than becoming an assumption either way.
    if (h.metformin === true) add('metformin', 'You take metformin');
    else if (h.metformin === 'unsure') add('metforminUnknown', 'You weren’t sure about metformin');
    else if (h.metformin === undefined && (h.diabetes === 'type2' || h.diabetes === 'prediabetes' || h.diabetes === 'other')) {
      add('metforminUnknown', diabetesReason!);
    }

    if (d.hypoRisk) {
      add('hypoRisk', h.diabetes === 'type1' ? 'You have type 1 diabetes'
        : h.insulin === 'unsure' ? 'You weren’t sure about insulin'
          : h.insulin !== 'none' ? 'You use insulin'
            : h.sulfonylureaOrMeglitinide === 'unsure' ? 'You weren’t sure about a sulfonylurea or meglitinide'
              : 'You take a sulfonylurea or meglitinide');
    }
    if (h.sglt2i === true) add('sglt2i', 'You take an SGLT2 inhibitor');
    if (h.sglt2i === 'unsure') add('sglt2i', 'You weren’t sure about an SGLT2 inhibitor');
    // Unanswered medicine questions are not "no insulin" (contract H-DATA):
    // the precautions for both medicine classes stay in view.
    if (d.diabetic && h.medicinesReviewed !== true) {
      add('hypoRisk', MEDICINES_UNKNOWN);
      add('sglt2i', MEDICINES_UNKNOWN);
    }

    // Which glucose-check advice is the person's own (ADA 7.11): set only from
    // answers given, so an unknown regimen or class marks none of them.
    if (d.diabetic) {
      if (h.insulin === 'injections_or_pump' && h.insulinRegimen === 'basalOnly') add('basalInsulin', 'You take long-acting insulin only');
      if (h.insulin === 'injections_or_pump' && h.insulinRegimen === 'multipleDaily') add('mealtimeInsulin', 'You take insulin several times a day');
      if ((h.insulin === 'injections_or_pump' && h.insulinRegimen === 'pump') || h.insulin === 'automated_delivery') add('mealtimeInsulin', 'You use an insulin pump');
      if (takes(h.sulfonylureaOrMeglitinide)) {
        add('sulfonylurea', h.sulfonylureaOrMeglitinide === 'unsure'
          ? 'You weren’t sure about a sulfonylurea or meglitinide'
          : 'You take a sulfonylurea or meglitinide');
      }
      // A clear "none of these", never an untouched default (a missing answer is not "metformin only").
      if (!d.hypoRisk && h.medicinesReviewed === true && profile.needsHealthReview !== true) {
        add('noHypoMedicine', 'You don’t take insulin, a sulfonylurea or a meglitinide');
      }
    }

    if (h.hypertension === 'treated') add('hypertension', 'You’re treated for high blood pressure');
    if (h.hypertension === 'untreated') add('hypertension', 'You have high blood pressure');
    if (h.hypertension === 'unsure') add('bpUnsure', 'You weren’t sure about your blood pressure');

    if (h.kidneyDisease !== 'none') {
      const reason = h.kidneyDisease === 'unsure' ? 'You weren’t sure about a kidney condition' : 'You told us about a kidney condition';
      add('kidney', reason);
      add('fluidCaution', reason);
    }
    if (h.heartOrVascularDisease) {
      // Includes heart failure, where a fluid limit is common; the profile
      // cannot tell heart failure apart, so the cautious branch applies.
      const reason = 'You told us about a heart or circulation condition';
      add('heart', reason);
      add('fluidCaution', reason);
    }
    if (h.diuretic) add('diuretic', 'You take a water pill (diuretic)');

    if (h.peripheralNeuropathy === 'yes') add('neuropathy', 'You told us about nerve damage in your feet');
    if (h.peripheralNeuropathy === 'unsure') add('neuropathy', 'You weren’t sure about nerve damage in your feet');
    // The readiness engine owns this rule; the Guide only follows its outcome.
    if (profileRules(profile).modifiers.includes('FOOT')) add('footWound', 'You told us about an open foot wound or active Charcot foot');

    const areas = profile.pain.areas;
    if (areas.includes('sciatica')) add('sciatica', 'You told us about sciatica');
    if (areas.includes('sciatica')) add('backPain', 'You told us about sciatica');
    if (areas.includes('lowerBack')) add('backPain', 'You told us about back pain');
  }

  if (food) {
    const reason = {
      vegetarian: 'You eat vegetarian food',
      eggetarian: 'You eat vegetarian food and eggs',
      vegan: 'You eat vegan food',
      nonVegetarian: 'You eat meat or fish',
    }[food.pattern];
    add(food.pattern, reason);
    if (food.pattern !== 'nonVegetarian') add('lowAnimalFood', reason);
  }

  return { facts, because, food };
}

export function holds(ctx: GuideContext, p: Predicate | undefined): boolean {
  return p !== undefined && ctx.facts.has(p);
}

/** Whether a claim is about this person: marked "For you" where it appears. */
export function isForYou(claim: Claim, ctx: GuideContext): boolean {
  return (claim.appliesTo ?? []).some(p => ctx.facts.has(p));
}

const FOOD_FACTS: ReadonlySet<Predicate> = new Set(['vegetarian', 'eggetarian', 'vegan', 'nonVegetarian', 'lowAnimalFood']);

/**
 * Whether a conditional claim could apply to this person: it is about them,
 * or the answer that would rule it out was never given. Travelling cautions
 * and conditional emergencies are shown on this test, so a "no" the person
 * never said cannot hide a precaution.
 */
export function isRelevant(claim: Claim, ctx: GuideContext): boolean {
  const about = claim.appliesTo ?? [];
  if (about.length === 0) return true;
  return about.some(p => ctx.facts.has(p) || (FOOD_FACTS.has(p) ? ctx.food === undefined : ctx.facts.has('healthUnknown')));
}

export function isCardVisible(card: GuidanceCard, ctx: GuideContext): boolean {
  if (card.showWhen && !holds(ctx, card.showWhen)) return false;
  if (card.hideWhen && holds(ctx, card.hideWhen)) return false;
  return true;
}

export function visibleCards(ctx: GuideContext): GuidanceCard[] {
  return CARDS.filter(card => isCardVisible(card, ctx));
}

export function cardsForTopic(topicId: TopicId, ctx: GuideContext): GuidanceCard[] {
  return cardsInTopic(topicId).filter(card => isCardVisible(card, ctx));
}

/** A card's related cards that this person may see. */
export function relatedCards(card: GuidanceCard, ctx: GuideContext): GuidanceCard[] {
  return card.related.flatMap(id => {
    const c = getCard(id);
    return c && isCardVisible(c, ctx) ? [c] : [];
  });
}

/** The card's hand-off, unless the person's own answers rule it out. */
export function actionFor(card: GuidanceCard, ctx: GuideContext): InAppAction | undefined {
  const action = card.action;
  if (!action) return undefined;
  return holds(ctx, action.hideWhen) ? undefined : action;
}

/** A claim as shown, with the cautions that travel with it and are not already on the screen. */
export interface ShownClaim {
  claim: Claim;
  attached: Claim[];
}

/**
 * Resolve the claim lists of one screen, in reading order. A claim swapped out
 * for this person (a walking prompt with an open foot wound) is replaced; a
 * claim already shown higher up is not repeated; and each claim's travelling
 * cautions that could apply to the person are attached beneath it the first
 * time they come up. Pure, so every screen and test resolves alike.
 */
export function resolveGroups(groups: readonly (readonly string[])[], ctx: GuideContext): ShownClaim[][] {
  const shown = new Set<string>();
  const resolve = (id: string): Claim[] => {
    const c = getClaim(id);
    if (!c) return [];
    if (c.swap && holds(ctx, c.swap.when)) return c.swap.with.flatMap(resolve);
    return [c];
  };
  return groups.map(ids => ids.flatMap(resolve).flatMap(claim => {
    if (shown.has(claim.id)) return [];
    shown.add(claim.id);
    const attached = (claim.cautionIds ?? []).flatMap(resolve).filter(a => !shown.has(a.id) && isRelevant(a, ctx));
    for (const a of attached) shown.add(a.id);
    return [{ claim, attached }];
  }));
}

export type CardBlock =
  | { kind: 'answer' | 'emergency' | 'soon' | 'notes' | 'actions' | 'cautions'; claims: ShownClaim[] }
  | { kind: 'action'; action: InAppAction };

/** A hand-off that starts movement, rather than a page to read. */
const MOVES: ReadonlySet<string> = new Set([ROUTES.walk, ROUTES.stretch]);

/**
 * A card as this person sees it, in order. Anything that needs help without
 * waiting — emergencies first, then the same day — comes before any advice to
 * act on (Codex content audit F04, F05). On a card that invites movement
 * anywhere, its answer included, that urgent help leads the whole card, so no
 * movement prose is read before it (re-check R01). Then good to know; what you
 * can do, each movement prompt with its precautions; the hand-off; then
 * routine reasons to see a doctor. Empty sections are left out.
 */
export function cardBlocks(card: GuidanceCard, ctx: GuideContext): CardBlock[] {
  const urgent = (level: 'emergency' | 'soon') =>
    (card.emergencies ?? []).filter(id => {
      const c = getClaim(id);
      return c?.urgency === level && isRelevant(c, ctx);
    });
  const action = actionFor(card, ctx);
  const invitesMovement = (action !== undefined && MOVES.has(action.to))
    || resolveGroups([card.answer, card.notes, card.actions], ctx).flat().some(s => s.claim.movement !== undefined);
  const order = invitesMovement
    ? (['emergency', 'soon', 'answer', 'notes', 'actions', 'cautions'] as const)
    : (['answer', 'emergency', 'soon', 'notes', 'actions', 'cautions'] as const);
  const ids = {
    answer: card.answer,
    emergency: urgent('emergency'),
    soon: urgent('soon'),
    notes: card.notes,
    actions: card.actions,
    cautions: card.cautions,
  };
  const resolved = resolveGroups(order.map(kind => ids[kind]), ctx);
  const blocks: CardBlock[] = order.flatMap((kind, i) => [
    { kind, claims: resolved[i] } as CardBlock,
    ...(kind === 'actions' && action ? [{ kind: 'action', action } as const] : []),
  ]);
  return blocks.filter(b => !('claims' in b) || b.claims.length > 0);
}

/** Every claim id a set of blocks shows, attached cautions included: for its sources and review date. */
export function idsShown(blocks: readonly (readonly ShownClaim[])[]): string[] {
  return blocks.flatMap(group => group.flatMap(s => [s.claim.id, ...s.attached.map(a => a.id)]));
}

export interface TopicForYou {
  topic: Topic;
  /** The person's own answer that makes it relevant. */
  because: string;
}

/**
 * Topics that matter to this person first, under "For you", then the rest in
 * their usual order. With no profile there is no "For you" at all.
 */
export function topicsFor(ctx: GuideContext): { forYou: TopicForYou[]; more: Topic[] } {
  const forYou: TopicForYou[] = [];
  const more: Topic[] = [];
  for (const topic of TOPICS) {
    const reason = topic.relevantWhen.find(p => ctx.facts.has(p));
    if (reason) forYou.push({ topic, because: ctx.because.get(reason) ?? '' });
    else more.push(topic);
  }
  return { forYou, more };
}

export interface HabitAdvice {
  habit: Habit;
  /** False when a generic prompt would be wrong for this person. */
  offered: boolean;
  /** Shown instead when the habit is not offered. */
  instead?: Claim;
  /**
   * The precautions that travel with the habit's prompt and could apply to
   * this person — for a reminder's text or a calendar note, so a movement
   * prompt never reaches someone on insulin without them. Empty when withheld.
   */
  precautions: Claim[];
}

/**
 * For the reminders area: whether to offer a habit prompt. A water reminder
 * is not offered with a fluid limit, a kidney or heart condition, or health
 * answers not yet given (as `reminders/water.ts` decides); standing and
 * walking prompts are not offered with an open foot wound.
 */
export function habitAdvice(id: Habit['id'], ctx: GuideContext): HabitAdvice | undefined {
  const habit = HABITS.find(h => h.id === id);
  if (!habit) return undefined;
  if ((habit.withheldWhen ?? []).some(p => holds(ctx, p))) {
    return { habit, offered: false, instead: habit.withheldClaimId ? getClaim(habit.withheldClaimId) : undefined, precautions: [] };
  }
  const prompts = claims([...habit.claimIds, ...(habit.cueClaimId ? [habit.cueClaimId] : [])]);
  const precautions = claims([...new Set(prompts.flatMap(c => c.cautionIds ?? []))]).filter(c => isRelevant(c, ctx));
  return { habit, offered: true, precautions };
}
