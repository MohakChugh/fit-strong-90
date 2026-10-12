/**
 * The Right now card through its own buttons: a refusal offers no Start and
 * says the gate's words in a status region; each quiet action reaches the
 * hub as its kind, which the hub sends through the gate (Review Focus 1).
 */
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@/test/host';
import { MovementCard } from './MovementCard';
import type { HubCard } from './movement';

const card = (over: Partial<HubCard>): HubCard => ({ state: 'go', tone: 'normal', title: 'Back & hips · 10 min', reasons: [], restrictions: [], secondary: [], ...over });

describe('the Right now card', () => {
  it('a hold: the gate’s words in a status region, no Start, and the check-in to put a mistake right', async () => {
    const onAction = vi.fn();
    const host = render(createElement(MovementCard, {
      card: card({ state: 'held', tone: 'caution', title: 'No walk for now', reasons: ['No walking today: your foot needs protecting.'], secondary: [{ kind: 'review', label: 'Review today’s check-in' }] }),
      onAction,
    }));
    expect(host.buttons(/^Start/)).toHaveLength(0);
    expect(host.all().some(n => n.props.role === 'status')).toBe(true);
    expect(host.text()).toContain('No walking today: your foot needs protecting.');
    await host.click(host.button('Review today’s check-in'));
    expect(onAction).toHaveBeenCalledWith('review');
  });

  it('paused: Change status first, and Start anyway reaches the hub as a start for the gate', async () => {
    const onAction = vi.fn();
    const host = render(createElement(MovementCard, {
      card: card({ state: 'paused', tone: 'quiet', title: 'Paused while you’re unwell', primary: { kind: 'status', label: 'Change status' }, secondary: [{ kind: 'anyway', label: 'Start anyway' }] }),
      onAction,
    }));
    await host.click(host.button('Start anyway'));
    expect(onAction).toHaveBeenCalledWith('anyway');
    await host.click(host.button('Change status'));
    expect(onAction).toHaveBeenLastCalledWith('status');
  });

  it('held while health answers aren’t stored: that said once, with the way out (board D197)', async () => {
    const { discardClinical, saveClinical } = await import('@/setup/effective');
    const { PERMISSION_TEXT } = await import('@/engine/permission');
    const { CLINICAL_UNSAVED_RELEASE } = await import('@/engine/readiness');
    const { StoreFailure } = await import('@/store/db');
    await saveClinical(() => Promise.resolve({ ok: false, failure: new StoreFailure('quotaExceeded', 'Storage is full') }));
    const host = render(createElement(MovementCard, {
      card: card({ state: 'held', tone: 'caution', title: 'Paused: health answers not saved', reasons: [PERMISSION_TEXT.unsaved], release: CLINICAL_UNSAVED_RELEASE }),
      onAction: vi.fn(),
    }));
    expect(host.text().split(PERMISSION_TEXT.unsaved)).toHaveLength(2);
    expect(host.buttons(/^Start/)).toHaveLength(0);
    // Beside an emergency, nothing else.
    const stop = render(createElement(MovementCard, { card: card({ state: 'held', tone: 'stop', title: 'Call now', reasons: [PERMISSION_TEXT.emergencyTitle] }), onAction: vi.fn() }));
    expect(stop.buttons('Discard changes')).toHaveLength(0);
    expect(host.button('Try again')).toBeDefined();
    await host.click(host.button('Discard changes'));
    await host.settle();
    expect(host.buttons('Discard changes')).toHaveLength(0);
    // The hold lifted, the card draws its new answer, and what happened is still said there (H5F-12).
    host.update(createElement(MovementCard, { card: card({ title: 'Back & hips · 10 min', primary: { kind: 'start', label: 'Start' } }), onAction: vi.fn() }));
    await host.settle();
    expect(host.all().some(n => n.props.role === 'status' && JSON.stringify(n.children).includes('Not kept. The health answers stored before stand.'))).toBe(true);
    discardClinical();
  });

  it('so is the day’s answer: the way out while held, what happened once it lifts, and nothing beside an emergency', async () => {
    const { discardClinical, saveClinical } = await import('@/setup/effective');
    const { PERMISSION_TEXT } = await import('@/engine/permission');
    const { CLINICAL_UNSAVED_RELEASE } = await import('@/engine/readiness');
    const { StoreFailure } = await import('@/store/db');
    const { OutcomeBanner } = await import('@/components/checkin/OutcomeBanner');
    const now = new Date('2026-10-10T09:00:00+05:30');
    const held = { mode: 'walk' as const, allowed: false, disposition: 'hold' as const, reasons: [PERMISSION_TEXT.unsaved], release: CLINICAL_UNSAVED_RELEASE, restrictions: [], needsCheckIn: false };
    await saveClinical(() => Promise.resolve({ ok: false, failure: new StoreFailure('quotaExceeded', 'Storage is full') }));
    const emergency = render(createElement(OutcomeBanner, { permission: { ...held, disposition: 'emergency', reasons: [PERMISSION_TEXT.emergencyTitle] }, now }));
    expect(emergency.buttons('Discard changes')).toHaveLength(0);
    const host = render(createElement(OutcomeBanner, { permission: held, now }));
    await host.click(host.button('Discard changes'));
    host.update(createElement(OutcomeBanner, { permission: { ...held, allowed: true, disposition: 'reassure', reasons: [], release: undefined }, now }));
    await host.settle();
    expect(host.text()).toContain('Not kept. The health answers stored before stand.');
    discardClinical();
  });

  it('with no health answers waiting, nothing of it is drawn, not even an empty place', async () => {
    const { UnsavedClinical } = await import('@/components/profile/UnsavedClinical');
    expect(render(createElement(UnsavedClinical)).tree).toEqual([]);
  });

  it('a Start that waits for a choice cannot be pressed, and says why', () => {
    const host = render(createElement(MovementCard, {
      card: card({ primary: { kind: 'start', label: 'Start walk', disabled: true }, note: 'Choose the meal to start.' }),
      onAction: vi.fn(),
    }));
    expect(host.button('Start walk').props.disabled).toBe(true);
    expect(host.text()).toContain('Choose the meal to start.');
  });
});
