import type { KeyboardEvent } from 'react';

const STEP: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

/**
 * A radio group's keyboard, as WAI-ARIA's radio group pattern has it (H5-23;
 * board D160): one tab stop, on the chosen option or else the first, and the
 * arrow keys move to the next or previous option, wrapping, and choose it.
 * Enter and Space are each button's own. The radios are found in their
 * group, so each may sit in a row with other buttons, as the Voices card's do.
 */
export function radioKeys<T extends string>(options: readonly { value: T }[], value: T | undefined, onChange: (value: T) => void) {
  const chosen = options.findIndex(o => o.value === value);
  const stop = chosen >= 0 ? chosen : 0;
  return (i: number) => ({
    tabIndex: i === stop ? 0 : -1,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      const step = STEP[e.key];
      if (step === undefined) return;
      e.preventDefault();
      const next = (i + step + options.length) % options.length;
      onChange(options[next].value);
      e.currentTarget.closest('[role="radiogroup"]')?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
    },
  });
}
