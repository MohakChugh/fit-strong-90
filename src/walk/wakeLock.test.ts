import { describe, expect, it } from 'vitest';
import { createWakeLockPort, type SentinelLike, type WakeLockApi } from './wakeLock';

/** A platform whose grants arrive only when the test says so. */
function platform() {
  const pending: { resolve: (s: SentinelLike) => void }[] = [];
  const sentinels: { released: number; fire: () => void }[] = [];
  const api: WakeLockApi = {
    request: () => new Promise<SentinelLike>(resolve => pending.push({ resolve })),
  };
  /** Grant the oldest request still waiting. */
  const grant = async () => {
    let onRelease: (() => void) | undefined;
    const record = { released: 0, fire: () => onRelease?.() };
    const sentinel: SentinelLike = {
      release: async () => {
        record.released += 1;
        onRelease?.();
      },
      addEventListener: (_type, listener) => {
        onRelease = listener;
      },
    };
    sentinels.push(record);
    pending.shift()!.resolve(sentinel);
    await Promise.resolve();
    await Promise.resolve();
  };
  return { api, grant, sentinels };
}

describe('wake lock ownership (F34)', () => {
  it('releases a grant that arrives after the walk let go of it', async () => {
    const p = platform();
    const port = createWakeLockPort(p.api, () => true);
    const asked = port.request(() => {});
    // The walk screen closes while the request is still waiting.
    port.release();
    await p.grant();
    expect(await asked).toBe(false);
    expect(p.sentinels[0].released).toBe(1);
  });

  it('never lets an old request release a newer lock', async () => {
    const p = platform();
    const port = createWakeLockPort(p.api, () => true);
    const first = port.request(() => {});
    port.release();
    const second = port.request(() => {});
    // The old grant arrives after the new request was made: it is released,
    // and the new grant, when it comes, is kept.
    await p.grant();
    await p.grant();
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(p.sentinels.map(s => s.released)).toEqual([1, 0]);
  });

  it('keeps a grant that answers the latest request, and lets it go on release', async () => {
    const p = platform();
    const port = createWakeLockPort(p.api, () => true);
    const asked = port.request(() => {});
    await p.grant();
    expect(await asked).toBe(true);
    expect(p.sentinels[0].released).toBe(0);
    port.release();
    expect(p.sentinels[0].released).toBe(1);
  });

  it('tells the walk when the system takes the lock back, but not about a lock it already let go', async () => {
    const p = platform();
    const port = createWakeLockPort(p.api, () => true);
    let lost = 0;
    await Promise.all([port.request(() => { lost += 1; }), p.grant()]);
    p.sentinels[0].fire();
    expect(lost).toBe(1);

    const again = createWakeLockPort(p.api, () => true);
    let lostAgain = 0;
    await Promise.all([again.request(() => { lostAgain += 1; }), p.grant()]);
    again.release();
    expect(lostAgain).toBe(0);
  });

  it('does not ask while the page is hidden', async () => {
    const p = platform();
    const port = createWakeLockPort(p.api, () => false);
    expect(await port.request(() => {})).toBe(false);
    expect(p.sentinels).toHaveLength(0);
  });

  it('answers no when the platform refuses', async () => {
    const port = createWakeLockPort({ request: () => Promise.reject(new DOMException('No', 'NotAllowedError')) }, () => true);
    expect(await port.request(() => {})).toBe(false);
  });
});
