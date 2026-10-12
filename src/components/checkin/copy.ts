import type { EmergencyFlag, NewsItem, Readiness, UrineKetoneCategory } from '@/types/checkin';
import { PERMISSION_TEXT, type Disposition, type Mode, type Permission } from '@/engine/permission';
import type { BackAnswers } from './form';

/** Short and concrete: read in a hurry, often by someone who feels unwell. */
export const EMERGENCY_LABEL: Record<EmergencyFlag, string> = {
  chest: 'Chest pain or pressure, or a racing heartbeat at rest',
  stroke: 'Face drooping, arm or leg weakness, slurred speech, or a sudden change in vision',
  breathless: 'Severe breathlessness that is new',
  collapse: 'Collapsed and not back to normal',
  bladderBowel: 'Can’t pee, or new loss of bladder or bowel control',
  saddle: 'New numbness around the genitals or bottom, or new sexual problems with back pain down a leg',
  bothLegs: 'New weakness or numbness in both legs',
  lowCantTreat: 'A low that can’t be treated by mouth: too drowsy or confused, or can’t swallow safely',
  dka: 'Vomiting with tummy pain, deep or unusual breathing, fruity breath, or very drowsy or confused',
  accident: 'Injured in a serious accident, such as a fall or a crash',
  heatConfusion: 'Confused or hard to wake in the heat',
};

export const BACK_LABEL: Record<Exclude<keyof BackAnswers, 'pain' | 'legPain' | 'reach' | 'weaknessFast'>, string> = {
  newWeakness: 'New foot drop or foot dragging, or a leg getting weaker',
  newSensory: 'New or worse tingling or numbness, with no weakness',
  feverish: 'Back pain with fever, shivering or feeling unwell',
  suddenSevere: 'Sudden severe back pain, or pain getting worse fast',
  worseFunction: 'Walking or sitting is harder than after your last session',
};

export const NEWS_LABEL: Record<NewsItem, string> = {
  unwell: 'Unwell, feverish or shivery',
  vomiting: 'Vomiting, or can’t keep fluids down',
  highNotFalling: 'A high glucose that won’t come down with your usual plan',
  lowSymptoms: 'Shaky, sweaty or feeling a low coming on',
  lowOne: 'A low in the last 24 hours',
  lowTwoPlus: 'Two or more lows in the last 24 hours',
  lowSevere: 'A low in the last 24 hours that needed someone’s help',
  dizzy: 'Dizzy or faint on standing or when active',
  fainted: 'Fainted today, and back to normal now',
  footProblem: 'A new blister or sore on a foot',
  hotSwollenFoot: 'A foot that is newly hot, red or swollen',
  steroid: 'Steroid tablets or an injection in the last 3 days',
  hot: 'Hot or humid today',
  unusualFatigue: 'Unusually tired or breathless with everyday things',
};

/** The three "low" answers are one fact at three strengths: choosing one clears the others. */
export const LOW_NEWS: NewsItem[] = ['lowOne', 'lowTwoPlus', 'lowSevere'];

export const URINE_LABEL: Record<UrineKetoneCategory, string> = {
  negative: 'Negative', trace: 'Trace', small: 'Small', moderate: 'Moderate', large: 'Large',
};

const MODE_NAME: Record<Mode, string> = { guided: 'session', stretch: 'stretch', walk: 'walk' };

export function defaultStartLabel(mode: Mode, recovery: boolean): string {
  if (mode === 'guided') return recovery ? 'Start recovery session' : 'Start session';
  return `Start ${MODE_NAME[mode]}`;
}

/** One clear statement per answer (contract precedence: emergency, today, hold, adjust, reassure). */
export function headline(p: Permission): { title: string; tone: 'stop' | 'caution' | 'go' } {
  const byDisposition: Record<Disposition, { title: string; tone: 'stop' | 'caution' | 'go' }> = {
    emergency: { title: PERMISSION_TEXT.emergencyTitle, tone: 'stop' },
    today: { title: 'No exercise today. Get medical advice today.', tone: 'stop' },
    hold: { title: p.needsCheckIn ? 'Check again before you start' : `No ${MODE_NAME[p.mode]} for now`, tone: 'caution' },
    adjust: { title: 'Go ahead, with changes', tone: 'go' },
    reassure: { title: 'Good to go', tone: 'go' },
  };
  return byDisposition[p.disposition];
}

/**
 * Minutes until a glucose re-check is due, or null when no countdown should
 * show. Only a hold counts down: next to an emergency or "no exercise today"
 * a timer would read as "wait, then carry on".
 */
export function recheckCountdown(p: Permission, readiness: Readiness | undefined, now: Date): { due: number; minutes: number } | null {
  const due = readiness?.recheckAt ? Date.parse(readiness.recheckAt) : Number.NaN;
  if (Number.isNaN(due) || due <= now.getTime() || p.disposition !== 'hold') return null;
  return { due, minutes: Math.ceil((due - now.getTime()) / 60_000) };
}
