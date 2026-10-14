import { describe, expect, it } from 'vitest';
import { AUTO_HIDE_MS, bannerPlace, skipsReminders } from './place';

describe('bannerPlace', () => {
  it('sits just above the tab bar on every screen that has one', () => {
    for (const path of ['/hub/stretch', '/hub/walk', '/day/today', '/trends', '/track/reading/r1', '/browse', '/me/reminders']) {
      expect(bannerPlace(path), path).toBe('aboveTabBar');
    }
  });

  it('does not float on Home, which shows the waiting reminder in its own place', () => {
    expect(bannerPlace('/home')).toBe('hidden');
    expect(skipsReminders('/home')).toBe(false);
  });

  it('is not shown during a session or a live walk, where reminders that come due are skipped', () => {
    for (const path of ['/session', '/walk/live', '/walk/live/summary']) {
      expect(bannerPlace(path), path).toBe('hidden');
      expect(skipsReminders(path), path).toBe(true);
    }
    expect(skipsReminders('/hub/walk')).toBe(false);
  });

  it('sits above the bottom safe area on a screen without a tab bar', () => {
    expect(bannerPlace('/setup/keep')).toBe('aboveSafeArea');
    // A finished walk's summary is a task outside the tabs.
    expect(bannerPlace('/walk/summary')).toBe('aboveSafeArea');
    expect(bannerPlace('/homeish')).toBe('aboveSafeArea');
  });

  it('hides itself after about eight seconds', () => {
    expect(AUTO_HIDE_MS).toBe(8000);
  });
});
