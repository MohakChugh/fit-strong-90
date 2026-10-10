/**
 * Me → Display (journey §16; M23): theme, text size, Reduce motion and Reduce
 * transparency. The device's settings come first where the browser reports
 * them. The app adds to them, and never undoes them.
 */
import { flushSync } from 'react-dom';
import { TEXT_SCALES, isTextScale, type TextScale } from '@/lib/textSize';
import type { Theme } from '@/store/useStore';
import type { UserSettings } from '@/types';

export interface SystemDisplay {
  reducedMotion: boolean;
  /** Only Chromium reports it; Safari doesn't, so the app's own switch exists (journey §20.1). */
  reducedTransparency: boolean;
  moreContrast: boolean;
}

export interface DisplayChoice {
  on: boolean;
  /** The device asks for it, so the app's switch can't turn it off. */
  bySystem: boolean;
}

export function displayChoices(display: UserSettings['display'], system: SystemDisplay): { reduceMotion: DisplayChoice; reduceTransparency: DisplayChoice } {
  return {
    reduceMotion: system.reducedMotion ? { on: true, bySystem: true } : { on: display?.reduceMotion === true, bySystem: false },
    reduceTransparency: system.reducedTransparency || system.moreContrast
      ? { on: true, bySystem: true }
      : { on: display?.reduceTransparency === true, bySystem: false },
  };
}

export function readSystemDisplay(win: Pick<Window, 'matchMedia'> = window): SystemDisplay {
  const asks = (query: string) => typeof win.matchMedia === 'function' && win.matchMedia(query).matches;
  return {
    reducedMotion: asks('(prefers-reduced-motion: reduce)'),
    reducedTransparency: asks('(prefers-reduced-transparency: reduce)'),
    moreContrast: asks('(prefers-contrast: more)'),
  };
}

const TEXT_NAME: Record<TextScale, { label: string; detail: string; line: string }> = {
  1: { label: 'Standard', detail: 'As this device sets it', line: 'Standard text' },
  1.15: { label: 'Large', detail: '115%', line: 'Large text' },
  1.3: { label: 'Larger', detail: '130%', line: 'Larger text' },
  1.6: { label: 'Extra large', detail: '160%', line: 'Extra large text' },
  2: { label: 'Largest', detail: '200%', line: 'Largest text' },
};

export const TEXT_SIZE_CHOICES: { value: `${TextScale}`; label: string; detail: string }[] =
  TEXT_SCALES.map(scale => ({ value: `${scale}` as `${TextScale}`, label: TEXT_NAME[scale].label, detail: TEXT_NAME[scale].detail }));

const THEME_NAME: Record<Theme, string> = { system: 'Automatic', light: 'Light', dark: 'Dark' };

/** Me's Display row: "Dark · Larger text · Reduce motion". */
export function displayLine(settings: Pick<UserSettings, 'theme' | 'display'>): string {
  const scale = isTextScale(settings.display?.textScale) ? settings.display.textScale : 1;
  return [
    THEME_NAME[settings.theme],
    TEXT_NAME[scale].line,
    settings.display?.reduceMotion && 'Reduce motion',
    settings.display?.reduceTransparency && 'Reduce transparency',
  ].filter(Boolean).join(' · ');
}

/**
 * M23: a new theme fades in over the page through a root view transition,
 * with the plain hand-over a tab change uses (`data-nav="tab"`, index.css).
 *
 * `change` stores the theme. App's theme effect then draws it, and puts the
 * stored one back if the write is refused. It runs inside the transition,
 * after the old frame is captured; `flushSync` lets that effect run before
 * the new frame is. Stored first, the effect a click flushes at once would
 * leave nothing to fade.
 *
 * Under Reduce Motion it changes at once. An urgent decision skips the
 * transition (main.tsx), and the change still happens.
 */
export function fadeTheme(change: () => void, reduced: boolean, doc: Document = document): void {
  if (reduced || typeof doc.startViewTransition !== 'function') {
    change();
    return;
  }
  doc.documentElement.dataset.nav = 'tab';
  doc.startViewTransition(() => flushSync(change));
}
