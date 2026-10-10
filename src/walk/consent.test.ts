import { describe, expect, it } from 'vitest';
import { CONSENT, UNASKED, answered, consentSummary, preflightPages, routeNote, walkSettings, withConsent } from './consent';

const GPS = { gps: true, steps: false };

describe('the first-walk questions (journey §9.1)', () => {
  it('asks both route questions on the first walk with location; the map one only while routes may be kept', () => {
    expect(preflightPages(UNASKED, GPS)).toEqual(['keepRoute', 'mapPictures']);
    expect(preflightPages(answered(UNASKED, { page: 'keepRoute', keep: false }), GPS)).toEqual([]);
    expect(preflightPages(answered(UNASKED, { page: 'keepRoute', keep: true }), GPS)).toEqual(['mapPictures']);
  });

  it('asks nothing about routes on a walk without location', () => {
    expect(preflightPages(UNASKED, { gps: false, steps: false })).toEqual([]);
  });

  it('shows the step card once, before motion is asked for (K-29, B-24)', () => {
    expect(preflightPages(UNASKED, { gps: false, steps: true })).toEqual(['stepCard']);
    expect(preflightPages(answered(UNASKED, { page: 'stepCard' }), { gps: false, steps: true })).toEqual([]);
  });

  it('asks nothing once everything is answered', () => {
    expect(preflightPages({ saveRoutes: true, map: 'off', stepCardSeen: true }, { gps: true, steps: true })).toEqual([]);
    expect(walkSettings({})).toEqual(UNASKED);
  });

  it('keeps the route only on this phone’s yes, and only with location', () => {
    expect(withConsent({ kind: 'walk', gps: true, steps: false, keepRoute: true }, UNASKED).keepRoute).toBeUndefined();
    expect(withConsent({ kind: 'walk', gps: true, steps: false }, { saveRoutes: true, map: 'off' }).keepRoute).toBe(true);
    expect(withConsent({ kind: 'walk', gps: false, steps: false }, { saveRoutes: true, map: 'off' }).keepRoute).toBeUndefined();
    expect(withConsent({ kind: 'walk', gps: true, steps: false, keepRoute: true }, { saveRoutes: false, map: 'off' }).keepRoute).toBeUndefined();
  });

  it('records each answer as this phone’s own', () => {
    expect(answered(UNASKED, { page: 'mapPictures', show: true })).toEqual({ saveRoutes: 'unasked', map: 'on' });
    expect(answered(UNASKED, { page: 'mapPictures', show: false })).toEqual({ saveRoutes: 'unasked', map: 'off' });
    expect(answered(UNASKED, { page: 'keepRoute', keep: true })).toEqual({ saveRoutes: true, map: 'unasked' });
    expect(answered(UNASKED, { page: 'stepCard' })).toEqual({ saveRoutes: 'unasked', map: 'unasked', stepCardSeen: true });
  });

  it('says on the location switch what happens to the route', () => {
    expect(routeNote(UNASKED)).toBe('Uses GPS. You’ll be asked whether to keep your route.');
    expect(routeNote({ saveRoutes: true, map: 'off' })).toBe('Uses GPS. Your route is kept on this phone.');
    expect(routeNote({ saveRoutes: false, map: 'off' })).toBe('Uses GPS. Your route isn’t kept.');
  });

  it('words the questions exactly as the journey does (§9.1, B-24; the privacy sentence is Task 14’s)', () => {
    expect(CONSENT.keepRoute.title).toBe('Keep a record of your route on this phone?');
    expect(CONSENT.mapPictures.title).toBe('Show map pictures under your saved routes?');
    expect(CONSENT.mapPictures.detail).toBe('Map pictures come from OpenStreetMap. When you open a walk, they receive your internet address and the map squares for that area, so they can tell roughly where you walked. Your readings and your route file are never sent.');
    expect([CONSENT.mapPictures.yes, CONSENT.mapPictures.no]).toEqual(['Show map pictures', 'No pictures']);
    expect(CONSENT.stepCard.detail).toBe('FitStrong counts steps only while it’s open on the screen.');
  });
});

describe('what this phone keeps, as the Walk hub and Me say it (journey §9.1)', () => {
  it('says each choice, and what an unasked one waits for', () => {
    expect(consentSummary(UNASKED)).toEqual({ routes: 'Asked on your first walk with location', map: 'Asked on your first walk with location' });
    expect(consentSummary({ saveRoutes: true, map: 'on' })).toEqual({ routes: 'Kept on this phone', map: 'On' });
    expect(consentSummary({ saveRoutes: false, map: 'off' })).toEqual({ routes: 'Not kept', map: 'Off' });
  });
});
