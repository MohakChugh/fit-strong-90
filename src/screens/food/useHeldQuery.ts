import { useState, type FocusEvent } from 'react';

/**
 * M15: the results update as the person types, but stay put while a finger is
 * down on the list or a row in it has focus, so a row never moves under a tap.
 * `shown` is false while another page hides the list: an element removed with
 * focus sends no blur, so nothing can stay held then.
 */
export function useHeldQuery(query: string, shown: boolean) {
  const [down, setDown] = useState(false);
  const [focused, setFocused] = useState(false);
  const [frozen, setFrozen] = useState(query);
  if (!shown && (down || focused)) {
    setDown(false);
    setFocused(false);
  }
  const held = shown && (down || focused);
  // While rendering, not in an effect, so the frame that lets go already shows the newest results.
  if (!held && frozen !== query) setFrozen(query);
  return {
    shownQuery: held ? frozen : query,
    listProps: {
      onPointerDown: () => setDown(true),
      onPointerUp: () => setDown(false),
      onPointerCancel: () => setDown(false),
      onFocus: () => setFocused(true),
      onBlur: (e: FocusEvent<HTMLElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      },
    },
  };
}
