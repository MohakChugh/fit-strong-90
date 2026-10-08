import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { glucoseEscalation, pressureEscalation } from './escalation';
import { Guidance } from './Guidance';

/** The text a person sees in the first frame, before any answer or settled write. */
const text = (shown: Parameters<typeof Guidance>[0]['shown']) =>
  renderToStaticMarkup(createElement(Guidance, { shown, onDone: () => {} })).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('Guidance, as first shown', () => {
  it('shows the emergency steps while the write is still pending, and does not claim it saved (F01)', () => {
    const shown = { figure: '600', unit: 'mg/dL', escalation: glucoseEscalation(600, 'mg/dL')!, pending: new Promise<string | undefined>(() => {}) };
    const t = text(shown);
    expect(t).toContain('Get emergency medical help now.');
    expect(t).toContain('Saving on this device…');
    expect(t).not.toContain('Saved on this device');
  });

  it('asks when an extreme reading was taken while holding the help action, not a conditional one (R03)', () => {
    const t = text({ figure: '600', unit: 'mg/dL', escalation: glucoseEscalation(600, 'mg/dL')!, ask: true, pending: new Promise<string | undefined>(() => {}) });
    expect(t).toContain('Is this reading from just now?');
    expect(t).toContain('needs emergency medical help now, unless a clinician has checked you since');
    expect(t).not.toContain('If you feel unwell now');
  });

  it('does the same for a severe blood pressure', () => {
    const t = text({ figure: '186/92', unit: 'mmHg', escalation: pressureEscalation(186, 92)!, ask: true });
    expect(t).toContain('contact your doctor today, unless a clinician has checked you since');
  });

  it('says why nothing was saved when there was nothing to save', () => {
    const t = text({ figure: 'HI', unit: '', escalation: glucoseEscalation(600, 'mg/dL')!, label: 'Not saved: HI and LO are not numbers' });
    expect(t).toContain('Not saved: HI and LO are not numbers');
  });
});
