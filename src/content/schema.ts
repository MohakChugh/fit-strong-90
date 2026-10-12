/**
 * The Guide's content model (PLAN.md Task 7, codex-vision.md §8).
 *
 * Health guidance is typed data rather than prose so that every sentence a
 * person reads can be traced to a claim, every claim to a source and a
 * locator inside it, and the whole library can be checked by a test instead
 * of by care. `integrity.test.ts` enforces the rules written here.
 */

import type { FoodPreferences } from '@/types/profile';

/** Local calendar date, YYYY-MM-DD. */
export type IsoDate = string;

/** Shown beside every piece of guidance, not only in settings (BUILD-BRIEF). */
export const DISCLAIMER = 'General information, not medical advice.';

/**
 * A document we cite. Never an NHS page: NHS terms forbid citing the NHS as
 * the source of adapted text (board D32), so NHS pages appear only as
 * `FurtherReading`.
 */
export interface Source {
  id: string;
  /** Who published it, written out. */
  organisation: string;
  /** A short name for compact rows, e.g. "ICMR-NIN". */
  short: string;
  title: string;
  /** Edition, year or the page's own review date. */
  edition: string;
  /** The original. Opened only on an explicit tap, never with a query string. */
  url: string;
  /** Where in the document the material this app uses sits. */
  locator: string;
  /** Where the guidance comes from, so UK or US advice is never mistaken for Indian. */
  jurisdiction: string;
  /** Who the document is written for. */
  population: string;
  accessed: IsoDate;
  kind: 'guideline' | 'factsheet' | 'study' | 'label';
  /** Attribution the licence asks for, shown with the source. */
  licence?: string;
  /**
   * Cited by recommendation number only (board D32: the ADA Standards). The
   * claim keeps its full locator as the editorial record; screens show only
   * the recommendation numbers in it.
   */
  citeBy?: 'recommendation';
}

/** A page worth reading that is not the basis of any claim. */
export interface FurtherReading {
  id: string;
  organisation: string;
  title: string;
  url: string;
  /** Why a reader should take care with it, e.g. that it describes UK services. */
  note: string;
}

/**
 * Facts about the person that change what is relevant. Derived from the
 * profile in `personalise.ts`, only from answers the person actually gave.
 */
export type Predicate =
  | 'type1'
  | 'type2'
  | 'otherDiabetes'
  | 'prediabetes'
  /** Type 1, type 2 or other diabetes. */
  | 'diabetes'
  /** Insulin or a sulfonylurea/meglitinide, as the readiness engine defines it. */
  | 'hypoRisk'
  /** Diabetes, with long-acting (basal) insulin only as the profile records it. Sets the glucose-check advice; never a dose. */
  | 'basalInsulin'
  /** Diabetes, with insulin at meals: several injections a day, a pump or automated delivery. */
  | 'mealtimeInsulin'
  /** Diabetes, with a sulfonylurea or meglitinide, taken or "not sure". */
  | 'sulfonylurea'
  /**
   * Diabetes, with the medicine answers given and none that cause lows: no
   * insulin, sulfonylurea or meglitinide. Never inferred from an unanswered
   * profile (a missing answer is not "metformin only").
   */
  | 'noHypoMedicine'
  | 'sglt2i'
  /** Treated or untreated high blood pressure. */
  | 'hypertension'
  /** Answered "not sure" about blood pressure. */
  | 'bpUnsure'
  /** Any kidney disease, including "not sure". */
  | 'kidney'
  | 'heart'
  /** A fluid limit (or not sure), or a kidney or heart condition: generic "drink more" advice is withheld. */
  | 'fluidCaution'
  | 'diuretic'
  /** Known to take metformin. */
  | 'metformin'
  /** "Not sure" about metformin, or a condition it treats with no answer yet. */
  | 'metforminUnknown'
  | 'vegetarian'
  | 'eggetarian'
  | 'vegan'
  | 'nonVegetarian'
  /** Vegetarian, eggetarian or vegan: little or no meat or fish. */
  | 'lowAnimalFood'
  /** Lower back pain or sciatica. */
  | 'backPain'
  | 'sciatica'
  /** Nerve damage in the feet, or not sure. */
  | 'neuropathy'
  /** The readiness engine's FOOT rule: no weight-bearing exercise. */
  | 'footWound'
  /**
   * No profile, or one whose health answers are unconfirmed defaults: a "no"
   * in it is not an answer, so every conditional precaution is shown.
   */
  | 'healthUnknown';

export interface Support {
  sourceId: string;
  /** Section, recommendation, table or page inside that source. */
  locator: string;
}

export interface Verification {
  /** `fetched`: read at the primary source. `research-doc`: taken from a cited research file. */
  method: 'research-doc' | 'fetched';
  /** What was actually read. */
  urls: string[];
  /** How, when it was not a plain page load. */
  via?: string;
}

/** One statement shown to a person, exactly as written, with its basis. */
export interface Claim {
  id: string;
  /** Plain English, in our own words. Never a quotation of the source. */
  statement: string;
  support: Support[];
  /** Who the claim is about. Absent: most adults. Drives the "For you" mark. */
  appliesTo?: Predicate[];
  /** A boundary or a reason to check with a clinician. */
  caution?: boolean;
  /**
   * Claims shown directly beneath this one wherever it appears, because it is
   * unsafe for someone without them. Shown when they could apply to the person.
   */
  cautionIds?: readonly string[];
  /**
   * Seek help without waiting: `emergency` is emergency help now, `soon` is a
   * clinician the same day or as the care plan says. Shown in a card's
   * `emergencies`, before anything to do, never among routine cautions.
   */
  urgency?: 'emergency' | 'soon';
  /**
   * A prompt to move. `weightBearing`: standing or walking. Every one carries
   * the low-sugar and foot precautions in `cautionIds`.
   */
  movement?: 'weightBearing' | 'general';
  /** For people this holds for, show these claims instead (none: withhold it). */
  swap?: { when: Predicate; with: readonly string[] };
  /**
   * This app's own rule, stricter than the cited source's wording. The
   * statement says so ("this app…"), so it is never mistaken for the source's.
   */
  policy?: boolean;
  verification: Verification;
  reviewedDate: IsoDate;
}

export type TopicId =
  | 'food-diabetes'
  | 'food-bp'
  | 'b12'
  | 'vitamin-d'
  | 'desk'
  | 'water'
  | 'sleep'
  | 'back'
  | 'habits';

export interface Topic {
  id: TopicId;
  title: string;
  /** The second line on the Guide root. */
  summary: string;
  aliases: string[];
  /** Profile facts that put this topic under "For you", strongest first. */
  relevantWhen: Predicate[];
  /** Whether Meal ideas belong at the top of this topic. */
  meals?: boolean;
}

/** In-app destinations a card may hand off to. */
export const ROUTES = {
  walk: '/walk',
  stretch: '/move/stretch',
  reminders: '/you/habits',
  meals: '/guide/meals',
  week: '/guide/meals/week',
  /** Track's own add forms, opened by its `add` parameter (`parseAddParam`). */
  addGlucose: '/track?add=glucose',
  addBloodPressure: '/track?add=bloodPressure',
  addWaist: '/track?add=waist',
} as const;
export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

export interface InAppAction {
  label: string;
  to: AppRoute;
  /** Not offered when this holds, e.g. no walk for an open foot wound. */
  hideWhen?: Predicate;
}

export interface GuidanceCard {
  id: string;
  /** The first is the card's home; the rest list it too. */
  topics: TopicId[];
  title: string;
  /** The question the card answers, in the person's words. */
  question: string;
  /** Extra search terms, including Hindi food names. */
  aliases: string[];
  /** One or two claims, read together as the answer. */
  answer: string[];
  /** Up to three claims worth knowing that are not actions, e.g. who is most at risk. */
  notes: string[];
  /** Three to five claims: what you can do. */
  actions: string[];
  /** At least one claim: check with your doctor if… */
  cautions: string[];
  /** Claims with an `urgency`: shown right after the answer, before anything to do. */
  emergencies?: string[];
  related: string[];
  action?: InAppAction;
  furtherReading?: string[];
  /** Shown only when this holds. */
  showWhen?: Predicate;
  /** Hidden when this holds, e.g. generic water advice with a kidney condition. */
  hideWhen?: Predicate;
  reviewedDate: IsoDate;
}

export type Pattern = FoodPreferences['pattern'];
export type Region = NonNullable<FoodPreferences['region']>;
export type Slot = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export type FoodGroup = 'vegetables' | 'grains' | 'pulses' | 'dairy' | 'eggsMeatFish' | 'nutsSeeds' | 'fruit' | 'fats';

/**
 * A household measure with the claim that supports it. Components can only
 * use these, so an unsourced portion ("2 rotis") cannot be written at all.
 */
export interface Measure {
  text: string;
  /** The claims that support it, shown with the meal. */
  claimIds: string[];
}

export interface MealComponent {
  name: string;
  group: FoodGroup;
  /** A key of `MEASURES`. Absent when no source supports a portion. */
  measure?: string;
  /** Other words for it, so a "leave out" entry such as "curd" or "nuts" finds it. */
  aliases?: string[];
  /** Left out for these patterns, e.g. dahi for vegans. */
  notFor?: Pattern[];
}

export interface MealTemplate {
  id: string;
  slot: Slot;
  name: string;
  aliases: string[];
  /** Where the dish is most familiar. Absent: eaten across India. */
  regions?: Region[];
  /** Eating patterns the meal suits once `notFor` components are dropped. */
  patterns: Pattern[];
  components: MealComponent[];
  /** Claims that support how the meal is put together. */
  claimIds: string[];
  /** Claims: swaps worth knowing. */
  swaps: string[];
  /** Claims about salt in this meal. */
  salt: string[];
  /** Claims about sugar in this meal. */
  sugar: string[];
  reviewedDate: IsoDate;
}

/** A habit the reminders area can offer (Task 8). */
export interface Habit {
  id: 'water' | 'sittingBreak' | 'mealWalk' | 'sleepWindDown';
  title: string;
  /** Claims: why it helps. */
  claimIds: string[];
  /** The sourced cue, e.g. "at least every 30 minutes", as a claim. */
  cueClaimId?: string;
  cardId: string;
  /** Not offered as a generic prompt when any of these holds. */
  withheldWhen?: Predicate[];
  /** What to show instead when withheld. */
  withheldClaimId?: string;
}
