import { afterEach, describe, expect, it } from 'vitest';
import { claimModal } from './modal';

/** The page and the toasts, as main.tsx draws them: #app, and #toasts beside it. */
function page() {
  const app = { inert: false };
  const toasts = { inert: false, dataset: {} as Record<string, string> };
  Object.assign(globalThis, { document: { getElementById: (id: string) => (id === 'app' ? app : id === 'toasts' ? toasts : null) } });
  return { app, toasts };
}
afterEach(() => { delete (globalThis as { document?: unknown }).document; });

describe('every modal has one owner (B-03, codex V1-13)', () => {
  it('while a sheet or a menu is open, the page is out of reach, and the toasts wait, hidden, Undo and all', () => {
    const { app, toasts } = page();
    const release = claimModal();
    expect(app.inert).toBe(true);
    expect(toasts.inert).toBe(true);
    expect('held' in toasts.dataset).toBe(true);
    release();
    expect(app.inert).toBe(false);
    expect(toasts.inert).toBe(false);
    expect('held' in toasts.dataset).toBe(false);
  });

  it('is counted: one closing while another is open leaves the page asleep, and a second release changes nothing', () => {
    const { app, toasts } = page();
    const first = claimModal();
    const second = claimModal();
    first();
    first();
    expect(app.inert).toBe(true);
    expect(toasts.inert).toBe(true);
    second();
    expect(app.inert).toBe(false);
    expect(toasts.inert).toBe(false);
  });
});
