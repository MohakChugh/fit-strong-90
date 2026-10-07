/**
 * Daily check-in and the readiness decision it produces (spec §3.2, §4.5–§4.7).
 */

/** Most restrictive wins: green < amber < recovery < red < urgent. */
export type Outcome = 'green' | 'amber' | 'recovery' | 'red' | 'urgent';

export const OUTCOME_ORDER: Outcome[] = ['green', 'amber', 'recovery', 'red', 'urgent'];

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

export type NewsItem =
  | 'unwell'
  | 'lowOne'
  | 'lowTwoPlus'
  | 'lowSevere'
  | 'fainted'
  | 'dizzy'
  | 'footProblem'
  | 'steroid'
  | 'hot'
  | 'unusualFatigue';

export type SymptomReach = 'back' | 'buttock' | 'thigh' | 'belowKnee' | 'foot';

export type GlucoseTrend = 'rising' | 'flat' | 'slowFall' | 'fastFall';

export interface DailyCheckIn {
  /** YYYY-MM-DD */
  date: string;
  /** Chest pain, unusual breathlessness, racing heartbeat, stroke signs, sudden vision change. */
  urgentSymptoms: boolean;
  back?: {
    pain: number;
    legPain?: number;
    reach?: SymptomReach;
    /** New or worse numbness, tingling or weakness. */
    newNeuro: boolean;
    /** Saddle numbness or new bladder/bowel change. */
    caudaEquinaFlag: boolean;
  };
  news: NewsItem[];
  glucose?: {
    value: number;
    unit: 'mg/dL' | 'mmol/L';
    trend?: GlucoseTrend;
    rapidInsulinLast2h?: boolean;
  };
  ketones?: { value: number; kind: 'blood' | 'urine' };
  /** Average of two readings. */
  bp?: { sys: number; dia: number };
  sleep: 'lt5' | '5to7' | 'gt7';
  energy: 1 | 2 | 3 | 4 | 5;
}

/** Back-pain traffic light for today (back-sciatica-mobility.md §2). */
export type BackLight = 'none' | 'green' | 'amber' | 'red';

export interface Reason {
  code: string;
  message: string;
  outcome: Outcome;
}

export interface Readiness {
  outcome: Outcome;
  modifiers: Modifier[];
  back: BackLight;
  /** Leg nerve symptoms today: sliders only, no static hamstring holds > 30 s. */
  nerveFlag: boolean;
  reasons: Reason[];
  /** Things to do before starting, e.g. "Take 10 g of fast-acting carbohydrate now." */
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
}

/** A check-in plus the readiness the app computed for it. */
export interface CheckInRecord extends DailyCheckIn {
  readiness: Readiness;
}
