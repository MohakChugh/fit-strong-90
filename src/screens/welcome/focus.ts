import type { Focus } from './assemble';

export interface FocusChoice {
  value: Focus;
  label: string;
  detail: string;
}

/**
 * The first question's answers, shared by Welcome and You. The words describe
 * what the app will lead with, not who the person is: someone who chose
 * Stretch can still start the programme any day.
 */
export const FOCUS_CHOICES: readonly FocusChoice[] = [
  { value: 'strength', label: 'Build strength', detail: 'A guided 12-week programme that looks after your back.' },
  { value: 'stretch', label: 'Stretch comfortably', detail: 'Short, gentle routines for your back and hips.' },
  { value: 'move', label: 'Move more', detail: 'Walks and everyday movement, at your own pace.' },
  { value: 'explore', label: 'Explore first', detail: 'Look around before you choose.' },
];
