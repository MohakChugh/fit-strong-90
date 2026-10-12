/**
 * `useLocalDay` through a caller (codex H4-06): the local day from the shared
 * clock, a new one at midnight while the screen stays open, without waiting
 * for the minute's tick.
 */
import { createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from '@/test/host';
import { useLocalDay } from './clock';

function Day() {
  const { day } = useLocalDay();
  return createElement('output', { 'data-day': day });
}
const dayOf = (host: ReturnType<typeof render>) => host.all().find(n => n.type === 'output')!.props['data-day'];

afterEach(() => vi.useRealTimers());

describe('useLocalDay', () => {
  it('Sunday at 23:59:50 becomes Monday at midnight, while the screen stays open', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    vi.setSystemTime(new Date(2026, 9, 11, 23, 59, 50));
    const host = render(createElement(Day));
    expect(dayOf(host)).toBe('2026-10-11');
    // Ten seconds on: past midnight, well before the next minute's tick.
    await vi.advanceTimersByTimeAsync(10_100);
    host.flush();
    expect(dayOf(host)).toBe('2026-10-12');
    host.unmount();
  });
});
