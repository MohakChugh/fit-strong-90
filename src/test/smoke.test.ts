import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { render, type Host } from './host';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;

const store = await import('@/store/useStore');
const { useGuided } = await import('@/hooks/useGuided');
const { CheckInBody } = await import('@/components/checkin/CheckInSheet');

let host: Host | undefined;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 9, 9, 0, 0));
  local.clear();
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
});
afterEach(() => { host?.unmount(); vi.useRealTimers(); });

describe('host smoke', () => {
  it('renders the real sheet over the real store and saves through useGuided', async () => {
    const profile = createDefaultProfile({ health: { diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly', medicinesReviewed: true, glucoseMonitor: 'meter', currentlyActive: true, clearance: 'vigorous' } });
    await store.update(prev => ({ ...prev, profile }));
    const onStart = vi.fn();
    function Harness() {
      const g = useGuided();
      return createElement(CheckInBody, { open: true, onOpenChange: () => {}, profile: g.profile, date: g.date, initial: g.checkIn, onSave: g.saveCheckIn, onStart, recent: g.checkIns });
    }
    host = render(createElement(Harness));
    expect(host.text()).toContain('Right now, any of these?');
    await host.click(host.button('None of these'));
    await host.change(host.field('Glucose reading'), { value: '140' });
    await host.click(host.button('See today’s plan'));
    expect(host.text()).toMatch(/Start/);
    await host.click(host.button(/^Start/));
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(store.getState().checkIns.find(c => c.date === '2026-10-09')?.glucose?.value).toBe(140);
  });
});
