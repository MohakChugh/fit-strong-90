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
    expect(host.button('Try again')).toBeDefined();
    await host.click(host.button('Discard changes'));
    await host.settle();
    expect(host.buttons('Discard changes')).toHaveLength(0);
    discardClinical();
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
