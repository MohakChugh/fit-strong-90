import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BarChart, LineChart, type ChartPoint } from './Chart';
import { Ring } from './Ring';
import { Stat } from './Stat';
import { MAX_SLOTS } from './scale';

/**
 * Markup checks, rendered on the server: no DOM, no layout and no effects, so
 * a chart here never has a measured width. That is the no-room case, which is
 * exactly the one the fallback tests need.
 */
const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

/** What a sighted person can read: the markup minus everything visually hidden. */
function visibleText(markup: string): string {
  return markup
    .replace(/<div class="sr-only">[\s\S]*?<\/div>/g, ' ')
    .replace(/<span class="sr-only">[\s\S]*?<\/span>/g, ' ')
    .replace(/<[^>]+>/g, ' ');
}

/** The table's value cells, in order. */
function cells(markup: string): string[] {
  return [...markup.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]);
}

const day = (label: string, value: number | null): ChartPoint => ({ label, value });

describe('Stat', () => {
  it('shows caution and stop as words a sighted person can read, not colour alone', () => {
    const caution = html(createElement(Stat, { value: '9.8', unit: 'mmol/L', label: 'Glucose', tone: 'caution' }));
    const stop = html(createElement(Stat, { value: '3.1', unit: 'mmol/L', label: 'Glucose', tone: 'stop' }));
    expect(visibleText(caution)).toContain('Caution');
    expect(visibleText(stop)).toContain('Stop');
  });

  it('pairs the word with a symbol hidden from screen readers, since the word is already read', () => {
    const stop = html(createElement(Stat, { value: '3.1', unit: 'mmol/L', label: 'Glucose', tone: 'stop' }));
    expect(stop).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it('gives the status its own pause when read aloud, as the spacing gives the eye', () => {
    const stop = html(createElement(Stat, { value: '3.1', unit: 'mmol/L', label: 'Glucose', tone: 'stop' }));
    expect(stop.replace(/<[^>]+>/g, '')).toContain('Glucose, Stop.');
  });

  it('adds no status to an ordinary figure', () => {
    const plain = visibleText(html(createElement(Stat, { value: '7:04', unit: 'min', label: 'Elapsed' })));
    expect(plain).not.toContain('Caution');
    expect(plain).not.toContain('Stop');
  });

  it('keeps the figure on a tight line height, which a font-size class must not override', () => {
    const timer = html(createElement(Stat, { value: '7:04', unit: 'min', label: 'Elapsed' }));
    expect(timer).toMatch(/class="[^"]*numeric[^"]*leading-none[^"]*"/);
  });
});

describe('Ring', () => {
  it('never writes NaN or Infinity into the SVG, whatever size it is given', () => {
    for (const size of [Number.NaN, Number.POSITIVE_INFINITY, -1, 0, 1, 1e308]) {
      const markup = html(createElement(Ring, { value: 30, goal: 20, label: 'Movement', unit: 'minutes', size }));
      expect(markup, `size ${size}`).not.toMatch(/NaN|Infinity/);
    }
  });

  it('keeps the lap arcs mounted below the goal, hidden, so crossing the goal animates instead of snapping', () => {
    const markup = html(createElement(Ring, { value: 12, goal: 20, label: 'Movement', unit: 'minutes' }));
    expect(markup.match(/<circle/g)).toHaveLength(4);
    expect(markup.match(/visibility:hidden/g)).toHaveLength(2);
  });

  it('shows the lap once the goal is passed', () => {
    const markup = html(createElement(Ring, { value: 24, goal: 20, label: 'Movement', unit: 'minutes' }));
    expect(markup.match(/<circle/g)).toHaveLength(4);
    expect(markup).not.toContain('visibility:hidden');
  });

  it('draws nothing filled at zero, so an empty ring is not shown as a dot of progress', () => {
    const markup = html(createElement(Ring, { value: 0, goal: 20, label: 'Movement', unit: 'minutes' }));
    expect(markup.match(/visibility:hidden/g)).toHaveLength(3);
  });
});

describe('charts with no room to draw', () => {
  it('show their table, visibly, rather than an empty box', () => {
    const markup = html(createElement(LineChart, {
      points: [day('1 Oct', 5.4), day('2 Oct', 6.1)], unit: 'mmol/L', label: 'Fasting glucose',
    }));
    expect(markup).toContain('<table');
    expect(markup).not.toContain('class="sr-only"');
    expect(visibleText(markup)).toContain('6.1 mmol/L');
  });
});

describe('chart tables', () => {
  it('name an invalid value as invalid, never as "NaN mmol/L", and keep it apart from a missing one', () => {
    const markup = html(createElement(LineChart, {
      points: [day('1 Oct', 5.4), day('2 Oct', Number.NaN), day('3 Oct', Number.POSITIVE_INFINITY), day('4 Oct', null)],
      unit: 'mmol/L', label: 'Fasting glucose',
    }));
    expect(cells(markup)).toEqual(['5.4 mmol/L', 'Invalid value', 'Invalid value', 'No reading']);
    expect(markup).not.toMatch(/NaN|Infinity/);
  });

  it('leave out a target or band that is not a number, rather than describe a line the chart cannot draw', () => {
    const markup = html(createElement(LineChart, {
      points: [day('1 Oct', 5.4)], unit: 'mmol/L', label: 'Fasting glucose',
      band: { from: 4, to: Number.NaN, label: 'Normal range' },
      target: { value: Number.POSITIVE_INFINITY, label: 'Target' },
    }));
    expect(markup).toMatch(/<caption[^>]*>Fasting glucose<\/caption>/);
    expect(markup).not.toMatch(/NaN|Infinity/);
  });

  it('keep a recorded zero, a day not entered and an invalid total apart in a bar chart', () => {
    const markup = html(createElement(BarChart, {
      points: [day('Mon', 0), day('Tue', null), day('Wed', Number.NaN), day('Thu', 8200)],
      unit: 'steps', label: 'Steps this week',
    }));
    expect(cells(markup)).toEqual(['0 steps', 'Not entered', 'Invalid value', '8200 steps']);
  });

  it('say so, visibly, when a series is longer than a chart draws, and keep only the newest', () => {
    const extra = 5;
    const points = Array.from({ length: MAX_SLOTS + extra }, (_, i) => day(`d${i}`, i));
    const markup = html(createElement(BarChart, { points, unit: 'steps', label: 'Steps' }));
    expect(cells(markup)).toHaveLength(MAX_SLOTS);
    expect(markup).toContain(`>d${MAX_SLOTS + extra - 1}<`);
    expect(markup).not.toContain('>d0<');
    expect(visibleText(markup)).toContain(`latest ${MAX_SLOTS.toLocaleString()} days`);
    expect(visibleText(markup)).toContain(`${extra.toLocaleString()} earlier`);
  });
});
