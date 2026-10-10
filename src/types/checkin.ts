/**
 * Daily check-in and the readiness decision it produces (spec §3.2, §4.5–§4.7;
 * docs/research/clinical-tracking-protocols.md, Safety contract).
 *
 * Records are stored, so every field added after v4 is optional and an older
 * record still evaluates: absent means "not asked", never "answered no".
 */

/** Most restrictive wins: green < amber < recovery < red < urgent. */
export type Outcome = 'green' | 'amber' | 'recovery' | 'red' | 'urgent';

export const OUTCOME_ORDER: Outcome[] = ['green', 'amber', 'recovery', 'red', 'urgent'];

/**
 * The contract's actions (Safety contract, precedence rule): emergency help
 * now, help today, hold, adjust, reassure. Most restrictive last.
 */
export type Disposition = 'emergency' | 'today' | 'hold' | 'adjust' | 'reassure';

export const DISPOSITION_ORDER: Disposition[] = ['reassure', 'adjust', 'hold', 'today', 'emergency'];

/** The movement a Start button begins (board D30). */
export type Mode = 'guided' | 'stretch' | 'walk';

/**
 * Session modifiers (diabetes-hypertension-exercise.md §0) plus MINUS_SET
 * (one set fewer per exercise on low-sleep / low-energy days).
 */
export type Modifier =
  | 'INT'
  | 'LOAD'
  | 'HEAD'
  | 'IMPACT'
  | 'FOOT'
  | 'COOL'
  | 'HYPO'
  | 'HEAT'
  | 'MINUS_SET';

/**
 * "Right now, any of these?" Each one alone means emergency help now,
 * whatever the readings say (contract rows E-CARDIAC to E-OTHER).
 */
export type EmergencyFlag =
  /** Chest pain or pressure, or a racing heartbeat at rest (E-CARDIAC). */
  | 'chest'
  /** Face drooping, arm or leg weakness, slurred speech, sudden vision change (E-CARDIAC). */
  | 'stroke'
  /** Collapsed and not back to normal (E-CARDIAC). */
  | 'collapse'
  /** Severe breathlessness that is new (E-CARDIAC). */
  | 'breathless'
  /** Cannot pee, or new loss of bladder or bowel control (E-CES). */
  | 'bladderBowel'
  /** New numbness around the genitals or bottom, or new sexual problems with back pain down a leg (E-CES). */
  | 'saddle'
  /** New weakness or numbness in both legs (E-BILATERAL). */
  | 'bothLegs'
  /** A low the person cannot treat themselves, or cannot swallow safely (E-HYPO). */
  | 'lowCantTreat'
  /** Vomiting with tummy pain, deep or unusual breathing, fruity breath, marked drowsiness or confusion (E-DKA-SYMPTOM). */
  | 'dka'
  /** Hurt in a serious accident (E-OTHER). */
  | 'accident'
  /** Confused or hard to wake in the heat (E-OTHER). */
  | 'heatConfusion';

export type NewsItem =
  /** Unwell, feverish or shivery. */
  | 'unwell'
  /** Vomiting, or cannot keep fluids down (T-ILLNESS). */
  | 'vomiting'
  /** High glucose that will not come down with the usual plan (T-ILLNESS). */
  | 'highNotFalling'
  /** Shaky, sweaty or feeling a low coming on (H-DATA: symptoms that a sensor may not show yet). */
  | 'lowSymptoms'
  | 'lowOne'
  | 'lowTwoPlus'
  /** A low in the last 24 hours that needed someone else's help: a past level 3, not present inability to swallow. */
  | 'lowSevere'
  /** Fainted today and recovered. Not recovering is the `collapse` emergency. */
  | 'fainted'
  /** Dizzy or faint on standing or during activity (H-DIZZY). */
  | 'dizzy'
  /** New foot blister or sore. */
  | 'footProblem'
  /** A foot that is newly hot, red or swollen (H-FOOT). */
  | 'hotSwollenFoot'
  | 'steroid'
  | 'hot'
  | 'unusualFatigue';

export type SymptomReach = 'back' | 'buttock' | 'thigh' | 'belowKnee' | 'foot';

export type GlucoseTrend = 'rising' | 'flat' | 'slowFall' | 'fastFall';

export type GlucoseUnit = 'mg/dL' | 'mmol/L';

/** A fingerstick meter or a continuous sensor; they behave differently during exercise. */
export type GlucoseSource = 'meter' | 'sensor';

export interface GlucoseReading {
  value: number;
  unit: GlucoseUnit;
  trend?: GlucoseTrend;
  rapidInsulinLast2h?: boolean;
  /** When it was measured (ISO 8601 with offset). Required for a release after a low and for freshness. */
  measuredAt?: string;
  source?: GlucoseSource;
  /**
   * The person confirmed the unit when the number looked like the other one
   * (Codex re-audit F10). Without it a surprising number is held, not read.
   */
  unitConfirmed?: boolean;
}

/** The device showed HI or LO instead of a number. HI is never given a number: devices differ. */
export interface GlucoseDisplayReading {
  display: 'HI' | 'LO';
  measuredAt?: string;
  source?: GlucoseSource;
}

export type GlucoseEntry = GlucoseReading | GlucoseDisplayReading;

/** Urine strips are read on their own scale, never converted to blood mmol/L. */
export type UrineKetoneCategory = 'negative' | 'trace' | 'small' | 'moderate' | 'large';

export type KetoneReading =
  | { kind: 'blood'; value: number; measuredAt?: string }
  /**
   * `category` is the strip's own marking. Records saved before v5 hold only
   * `value`, the number the old sheet stored for each strip colour (0, 5, 15,
   * 40, 80); that is decoded back to its category, not to blood ketones.
   */
  | { kind: 'urine'; category?: UrineKetoneCategory; value?: number; measuredAt?: string };

export interface BpReading {
  sys: number;
  dia: number;
  /** When it was taken (ISO 8601 with offset). */
  at?: string;
}

/**
 * A serious reading from earlier today that still decides what is safe
 * (board D29(3), re-audit decision 3). It stays in force until the person
 * says what happened to it; a later ordinary reading is not an answer.
 */
export type EpisodeKind = 'extremeGlucose' | 'severeBp' | 'ketones' | 'severeLow' | 'redFlag' | 'foot' | 'news';

/** A red flag or a foot problem, by what was reported (scan X2-02, X2-03, R5-01). */
export type RedFlag = 'newWeakness' | 'backFever' | 'backSudden' | 'footProblem' | 'hotSwollenFoot';

/**
 * How an earlier serious reading, red flag or foot problem was settled.
 * - `mistake` — a reading typed wrongly, or a flag ticked by mistake, so it
 *   never happened.
 * - `assessed` — a clinician has seen it. For a reading: no emergency call,
 *   and still no exercise on the day of the answer. For a red flag or a foot
 *   problem: their advice now applies (scan X2-02, X2-03).
 * - `resolved` — it was real and it is over: a sore that has healed, or a
 *   reading more than a day old that was dealt with at the time (X2-10).
 *   Never an answer to a reading less than a day old, nor to a red flag or a
 *   hot, swollen foot, which need a clinician (R5-01).
 */
export type EpisodeResolution = 'mistake' | 'assessed' | 'resolved';

/**
 * One answer about specific readings (re-audit round 3, B01).
 *
 * It names the readings it settles, so a reading recorded later is a new
 * incident and is unresolved until answered on its own. Removing an answer
 * from the list is how the person takes it back.
 */
export interface EpisodeAnswer {
  kind: EpisodeKind;
  /** The readings it settles, by the ids the engine gives them (`Readiness.episodes`). */
  readings: string[];
  /**
   * `reopened` takes back an earlier answer: the readings are unresolved again.
   * The latest answer counts. The app adds one itself when an item an answer
   * released is reported again the same day, dated just after that answer.
   */
  resolution: EpisodeResolution | 'reopened';
  /** When the answer was given (ISO 8601). */
  at: string;
}

/** A serious reading, red flag or foot problem still deciding today's answer, and what has been said about it. */
export interface EpisodeReading {
  /** Stable for the reading: its kind, its time and its value; for a flag, what was reported and on which day. */
  id: string;
  /** How the sheet names it, e.g. "650 mg/dL at 23:59 yesterday". */
  label: string;
  settled?: EpisodeResolution;
  /** More than about a day old: asked whether it was settled, and "dealt with at the time" is an answer (X2-10). */
  old?: true;
  /** The answers that settle it, when not every one does: a red flag needs a clinician, a sore may also heal (R5-01). */
  accepts?: EpisodeResolution[];
}

/** The serious readings of one kind that the sheet must ask about. */
export interface EpisodeSummary {
  kind: EpisodeKind;
  readings: EpisodeReading[];
}

/**
 * One box of a blood pressure reading with the other left empty
 * (re-audit round 3, B07). Kept only when the number given is severe on its
 * own: either component is enough for the severe rule, and the missing one is
 * never read as zero or invented.
 */
export interface BpPartialReading {
  sys?: number;
  dia?: number;
  at?: string;
  /**
   * The complete reading of the same measurement, once one was entered
   * (N-04, P-02). The half then stands for nothing while that reading does.
   * A correction of that reading in Track carries this along, and deleting
   * the reading deletes the half with it.
   */
  completion?: BpReading;
}

export interface DailyCheckIn {
  /** YYYY-MM-DD */
  date: string;
  /**
   * Any emergency answer. Records before v5 used this one flag for chest
   * pain, breathlessness, a racing heartbeat, stroke signs and vision change;
   * newer records also set it whenever `emergency` has an entry.
   */
  urgentSymptoms: boolean;
  /**
   * The "Right now" checklist. `[]` means "None of these"; absent on older
   * records, and on a day whose record was started by something said during
   * movement before any check-in: that day has not been checked in yet
   * (`checkedIn`, scan M-01).
   */
  emergency?: EmergencyFlag[];
  /**
   * Back and leg answers. Every field is present only when the person gave
   * it: an untouched control is not an answer, so nothing here is a default
   * standing in for one (acceptance J03, J16).
   */
  back?: {
    pain?: number;
    legPain?: number;
    reach?: SymptomReach;
    /**
     * New or worse numbness, tingling or weakness. Records before v5 asked
     * one question for all three, so an older `true` is read as possible
     * weakness; newer records set it from `newSensory || newWeakness`.
     */
    newNeuro?: boolean;
    /** Saddle numbness or new bladder/bowel change (older records; newer ones also set the emergency flags). */
    caudaEquinaFlag?: boolean;
    /** New or worse tingling or numbness, with no weakness. */
    newSensory?: boolean;
    /** New foot drop, foot dragging or slapping, walking newly impaired by weakness, or a leg getting weaker (T-NEURO). */
    newWeakness?: boolean;
    /** That weakness is getting worse over hours or days. */
    weaknessFast?: boolean;
    /** Back pain with fever, shivering or feeling generally unwell (T-BACK). */
    feverish?: boolean;
    /** Sudden severe back pain, or pain getting worse fast (T-BACK). */
    suddenSevere?: boolean;
    /** Walking or sitting is harder than after the last session (A-BACK). */
    worseFunction?: boolean;
    /** Symptoms reach further down the leg than earlier today: said during a session (A-BACK). */
    spreadToday?: boolean;
  };
  news: NewsItem[];
  /** The latest glucose reading. */
  glucose?: GlucoseReading;
  /** The latest reading when the device showed HI or LO; the newer of this and `glucose` is current. */
  glucoseDisplay?: GlucoseDisplayReading;
  /** Earlier readings today, oldest first. A treated low stays here: a later number never erases it. */
  glucoseEarlier?: GlucoseEntry[];
  ketones?: KetoneReading;
  /** Earlier ketone readings today, oldest first. */
  ketonesEarlier?: KetoneReading[];
  /** Average of the readings below; kept for older screens. Safety rules read each reading. */
  bp?: { sys: number; dia: number };
  /** Every reading, in the order taken. Each is judged on its own before any average. */
  bpReadings?: BpReading[];
  /** Readings replaced earlier today. A severe one still counts: a later lower number is not clearance. */
  bpEarlier?: BpReading[];
  /** With a severe reading: chest or unusual back pain, breathlessness, confusion, weakness, numbness, vision change or trouble speaking (E-BP). */
  bpSymptoms?: boolean;
  /** After a treated low: symptoms have gone and the person's care plan allows exercise after a low (H-HYPO). */
  lowRecovered?: boolean;
  /**
   * Superseded by `resolutions` and ignored: an answer about a whole kind of
   * reading cannot say which reading it meant, so a later one would be lost.
   */
  resolved?: Partial<Record<EpisodeKind, EpisodeResolution>>;
  /** What the person said about specific serious readings. A reading not named here is unresolved. */
  resolutions?: EpisodeAnswer[];
  /** Severe blood pressure numbers entered without their other half. */
  bpPartial?: BpPartialReading[];
  /**
   * When "Feeling like a low is coming" was reported (H-HYPO). With a meter or
   * sensor, only a reading taken after it can settle it; the symptoms going is
   * said by unticking the news item.
   */
  lowSymptomsAt?: string;
  /**
   * Exercises that made back or leg symptoms worse during a session today:
   * left out for the rest of the day (A-BACK). `brisk-walking` is a walk:
   * walking stops for the day (scan X2-09).
   */
  provoked?: string[];
  /**
   * Readings logged outside the check-in on this day — Track's glucose and
   * blood pressure — as every gate must see them (scan X2-01). Attached by
   * `effectiveCheckIns` for the gates only, never stored with the check-in
   * and never shown in its boxes.
   */
  logged?: { glucose?: GlucoseReading[]; bp?: BpReading[] };
  /**
   * A day with no record of its own, made by `effectiveCheckIns` only to
   * carry `logged` readings to the gates. Never stored, and never a check-in.
   */
  readingsOnly?: true;
  /**
   * The record the device has stored for this day, attached by
   * `effectiveRecord` while answers it has not stored yet are merged in
   * (N-01). Every rule reads the day as at least as strict as this alone: a
   * refused or unfinished save can add to what the device holds, never take
   * from it, even with a newer reading. Never stored.
   */
  durable?: DailyCheckIn;
  /**
   * Red flags and foot problems said earlier today and unticked since
   * (R5-01): a later answer is about now, and releases nothing. Each stays
   * until its own release is given in `resolutions`, as on the days after.
   */
  flagsEarlier?: RedFlag[];
  /**
   * News that ends exercise for the day it is said — fainting, a high glucose
   * that will not come down, vomiting with diabetes, a low that needed help —
   * said earlier today and unticked since. A later answer is about now and
   * releases none of it; each holds for the rest of the day unless it is
   * answered as ticked by mistake in `resolutions`, as a red flag is (R5-01).
   */
  newsEarlier?: NewsItem[];
  /** Absent when not answered. */
  sleep?: 'lt5' | '5to7' | 'gt7';
  /** Absent when not answered. */
  energy?: 1 | 2 | 3 | 4 | 5;
}

/** Back-pain traffic light for today (back-sciatica-mobility.md §2). */
export type BackLight = 'none' | 'green' | 'amber' | 'red';

export interface Reason {
  code: string;
  message: string;
  outcome: Outcome;
  /** The contract action this reason asks for. Absent on records saved before v5. */
  disposition?: Disposition;
  /** Modes this reason rules out while others go ahead, e.g. Walk with a foot sore. */
  refuses?: Mode[];
}

export interface Readiness {
  outcome: Outcome;
  modifiers: Modifier[];
  back: BackLight;
  /** Leg nerve symptoms today: sliders only, no static hamstring holds > 30 s. */
  nerveFlag: boolean;
  reasons: Reason[];
  /** Things to do before starting, e.g. "Take 15 g of fast-acting carbohydrate now." */
  actions: string[];
  /** Wait this many minutes and re-check before starting (glucose treat-and-recheck). */
  recheckMinutes?: number;
  /** Intervals and heavy lifts locked until clearance is confirmed. */
  vigorousLocked: boolean;
  /** No heavy or maximal lifts today (BP 140–159/90–99, moderate retinopathy). */
  capHeavy: boolean;
  /** Use effort (RPE / talk test), never heart rate. */
  rpeOnly: boolean;
  /** Non-blocking advice shown with the outcome. */
  notices: string[];
  // Everything below was added in v5 and is absent on older stored records.
  /** The most restrictive contract action among the reasons. */
  disposition?: Disposition;
  /** What would change today's answer, in plain words. */
  release?: string;
  /** The earliest time a valid glucose re-check can be taken (ISO 8601). */
  recheckAt?: string;
  /** A new reading in the check-in can change this answer (a re-check, a missing reading, a ketone test). */
  awaitingReading?: boolean;
  /** Modes refused by a restriction rather than a stop, e.g. Walk with a foot problem. */
  refusedModes?: Mode[];
  /** Kinds of serious reading with at least one reading still unresolved. */
  unresolved?: EpisodeKind[];
  /** Every serious reading the sheet should ask about, today's and yesterday's, settled or not. */
  episodes?: EpisodeSummary[];
}

/** A check-in plus the readiness the app computed for it. */
export interface CheckInRecord extends DailyCheckIn {
  readiness: Readiness;
}
