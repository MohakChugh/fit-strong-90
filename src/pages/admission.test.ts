/**
 * Whether a guided session opens after the twelve weeks (D116, Codex P8-19):
 * decided once, when the page opens; only a run saved part-way and still
 * resumable is exempt, and a run admitted before midnight stays admitted.
 */
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { render } from '@/test/host';

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;

const page = vi.hoisted(() => ({ date: '2026-10-08', search: '' }));
vi.mock('@/hooks/useGuided', () => ({ useGuided: () => ({ data: { settings: { startDate: '2026-07-17' } }, date: page.date }) }));
vi.mock('react-router-dom', () => ({ useSearchParams: () => [new URLSearchParams(page.search)] }));

const { admits, useAdmission } = await import('./admission');
const { RESUME_WINDOW_MS, loadProgress, saveProgress } = await import('@/session/persistence');

const JULY = '2026-07-17';
const AFTER = '2026-10-09';
const saved = (date: string) => ({ plan: { date } }) as never;

describe('a guided session after the twelve weeks (J§17.2 #42, D116, P8-19)', () => {
  it('opens a stretch, always', () => {
    expect(admits({ stretch: true, resume: false, saved: null, startDate: JULY, date: AFTER })).toBe(true);
  });

  it('opens nothing new: `?resume=1` with nothing saved opens the choice', () => {
    expect(admits({ stretch: false, resume: true, saved: null, startDate: JULY, date: AFTER })).toBe(false);
    expect(admits({ stretch: false, resume: false, saved: null, startDate: JULY, date: AFTER })).toBe(false);
  });

  it('treats progress past its window as none, as `loadProgress` does', () => {
    local.clear();
    saveProgress({ id: 'p', kind: 'full', date: '2026-10-08', steps: [] } as never, { status: 'paused' } as never, 0, Date.now() - RESUME_WINDOW_MS - 60_000);
    expect(loadProgress(Date.now(), 'guided')).toBeNull();
    expect(admits({ stretch: false, resume: true, saved: loadProgress(Date.now(), 'guided'), startDate: JULY, date: AFTER })).toBe(false);
  });

  it('opens a run saved part-way, when asked to resume it, or when it is today’s', () => {
    expect(admits({ stretch: false, resume: true, saved: saved('2026-10-08'), startDate: JULY, date: AFTER })).toBe(true);
    expect(admits({ stretch: false, resume: false, saved: saved(AFTER), startDate: JULY, date: AFTER })).toBe(true);
    expect(admits({ stretch: false, resume: false, saved: saved('2026-10-08'), startDate: JULY, date: AFTER })).toBe(false);
  });

  it('keeps a run opened on week 12’s last day open past midnight', async () => {
    function Probe() {
      return createElement('p', null, useAdmission() ? 'admitted' : 'choice');
    }
    page.date = '2026-10-08';
    const h = render(createElement(Probe));
    await h.settle();
    expect(h.text()).toBe('admitted');
    page.date = AFTER;
    h.update(createElement(Probe));
    await h.settle();
    expect(h.text()).toBe('admitted');
    h.unmount();
    expect(render(createElement(Probe)).text()).toBe('choice');
  });
});
