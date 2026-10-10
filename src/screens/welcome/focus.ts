import type { UserSettings } from '@/types';

export type Focus = NonNullable<UserSettings['focus']>;

export interface FocusChoice {
  value: Focus;
  label: string;
  detail: string;
}

/**
 * "What would you most like to do?" (journey §6.2 ch. 6, K-20): setup's
 * movement page, and its line in Profile & health's "Your movement". The
 * words describe what the app will lead with, not who the person is.
 */
export const FOCUS_CHOICES: readonly FocusChoice[] = [
  { value: 'stretch', label: 'Stretch more', detail: 'Short, gentle routines for your back and hips.' },
  { value: 'move', label: 'Walk more', detail: 'Walks and everyday movement, at your own pace.' },
  { value: 'strength', label: 'Get stronger', detail: 'A guided programme that looks after your back.' },
  { value: 'explore', label: 'Not sure yet', detail: 'Look around before you choose.' },
];
