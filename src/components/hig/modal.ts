/**
 * Every modal has one owner (B-03): while any sheet or menu is open, the
 * page behind it is inert, out of the tab order, the accessibility tree and
 * the pointer's reach, as behind an iOS sheet, and so are the toasts. They
 * wait, hidden, until it closes, and come back as they were, both Undos
 * included (codex V1-13). Counted, so a modal closing while another opens
 * never wakes the page. Returns the release, which only counts once.
 */
let open = 0;

export function claimModal(): () => void {
  if (open++ === 0) hold(true);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--open === 0) hold(false);
  };
}

function hold(held: boolean): void {
  const app = document.getElementById('app');
  if (app) app.inert = held;
  // `#toasts` in main.tsx; `data-held` hides it (index.css).
  const toasts = document.getElementById('toasts');
  if (!toasts) return;
  toasts.inert = held;
  if (held) toasts.dataset.held = '';
  else delete toasts.dataset.held;
}
