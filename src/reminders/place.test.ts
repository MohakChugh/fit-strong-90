import { describe, expect, it } from 'vitest';
import { AUTO_HIDE_MS, bannerPlace, skipsReminders } from './place';

describe('bannerPlace', () => {
  it('sits just above the tab bar on every screen that has one', () => {
    for (const path of ['/move/stretch', '/walk', '/walk/history', '/track/glucose', '/guide', '/you/habits']) {
      expect(bannerPlace(path), path).toBe('aboveTabBar');
    }
  });

  it('does not float on Today, which shows the waiting reminder in its own place', () => {
    expect(bannerPlace('/today')).toBe('hidden');
    expect(skipsReminders('/today')).toBe(false);
  });

  it('is not shown during a session or a live walk, where reminders that come due are skipped', () => {
    for (const path of ['/session', '/walk/live', '/walk/live/summary']) {
      expect(bannerPlace(path), path).toBe('hidden');
      expect(skipsReminders(path), path).toBe(true);
    }
    expect(skipsReminders('/walk')).toBe(false);
  });

  it('sits above the bottom safe area on a screen without a tab bar', () => {
    expect(bannerPlace('/welcome/keep')).toBe('aboveSafeArea');
    expect(bannerPlace('/todayish')).toBe('aboveSafeArea');
  });

  it('hides itself after about eight seconds', () => {
    expect(AUTO_HIDE_MS).toBe(8000);
  });
});
