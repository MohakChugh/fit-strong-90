/**
 * X2-20: Track's back and leg emergency note lists the check-in's own signs,
 * in its own words, and shows all of them where pain is logged.
 */

import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BACK_LABEL, EMERGENCY_LABEL } from '@/components/checkin/copy';
import { LEG_QUESTIONS } from '@/components/checkin/stop';
import { BACK_EMERGENCY_SIGNS } from './redFlags';

vi.mock('react-router-dom', () => ({
  useNavigate: () => () => {},
  Link: () => null,
  useLocation: () => ({ pathname: '/track/back', search: '', state: null }),
  useSearchParams: () => [new URLSearchParams(), () => {}],
}));
vi.mock('@/components/hig/Screen', async () => {
  const { createElement: h } = await import('react');
  return { Screen: ({ title, children }: { title: string; children?: unknown }) => h('main', null, h('h1', null, title), children as never) };
});
vi.mock('@/components/hig/Sheet', async () => {
  const { createElement: h } = await import('react');
  return { Sheet: ({ open, children }: { open: boolean; children?: unknown }) => (open ? h('div', { role: 'dialog' }, children as never) : null) };
});

describe('the back and leg emergency signs (X2-20)', () => {
  it('are the check-in’s own: saddle and sexual problems, bladder or bowel, both legs, and one leg weakening fast', () => {
    expect(BACK_EMERGENCY_SIGNS).toContain(EMERGENCY_LABEL.saddle);
    expect(EMERGENCY_LABEL.saddle).toMatch(/sexual problems/);
    expect(BACK_EMERGENCY_SIGNS).toContain(EMERGENCY_LABEL.bladderBowel);
    expect(BACK_EMERGENCY_SIGNS).toContain(EMERGENCY_LABEL.bothLegs);
    // The stop control's own question, whatever its words are now.
    const fast = LEG_QUESTIONS.find(q => q.key === 'fast')!.label;
    expect(BACK_EMERGENCY_SIGNS.at(-1)).toBe(`${BACK_LABEL.newWeakness}, when ${fast.charAt(0).toLowerCase()}${fast.slice(1)}`);
    expect(BACK_EMERGENCY_SIGNS.at(-1)).toMatch(/a leg getting weaker, when it is getting worse/);
  });

  it('are all shown under the Back & leg chart', async () => {
    const { BackLeg } = await import('./BackLeg');
    const html = renderToStaticMarkup(createElement(BackLeg)).replace(/&#x27;|’/g, '’');
    for (const sign of BACK_EMERGENCY_SIGNS) expect(html).toContain(sign.replace(/'/g, '’'));
  });

  it('are all shown in Quick Log’s back and leg form', async () => {
    const { QuickLog } = await import('./QuickLog');
    const { DEFAULT_PREFS } = await import('./format');
    const html = renderToStaticMarkup(createElement(QuickLog, { open: true, onOpenChange: () => {}, initial: { kind: 'backLeg' }, onSaved: () => {}, prefs: DEFAULT_PREFS }))
      .replace(/&#x27;|’/g, '’');
    for (const sign of BACK_EMERGENCY_SIGNS) expect(html).toContain(sign.replace(/'/g, '’'));
  });
});
