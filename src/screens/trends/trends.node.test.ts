import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Trends' wiring, read from the source: what a screen hands the pure models
 * and writes to its address, where a rendered check would need the whole
 * store and router.
 */
const read = (file: string) => fs.readFileSync(path.resolve(__dirname, file), 'utf8');

describe('a category trend’s pager (H3-10)', () => {
  it('writes the window it goes to as that window’s own anchor, and none for today’s', () => {
    const trend = read('CategoryTrend.tsx');
    expect(trend).toContain('onPrevious={() => change({ at: anchorOf(earlier, today) })}');
    expect(trend).toContain('onNext={() => change({ at: anchorOf(nextWindow(w), today) })}');
    expect(trend).toContain("if (next.at === null) p.delete('at');");
    expect(trend).not.toMatch(/at: (earlier|nextWindow\(w\))\.from/);
  });
});

describe('Your week goes quiet on Home’s own verdict (H3-03, KT-04, journey §12.6)', () => {
  it('Trends pauses on a hold as well as on the safety surface and the status', () => {
    const trends = read('TrendsScreen.tsx');
    expect(trends).toContain('const held = useHeld();');
    expect(trends).toContain('const pause = briefPause({ status: statusOn(state.settings.statusPeriods, today), urgent: urgent !== undefined, held });');
  });

  it('one set of kinds is a hold, for Home’s quiet branch and for Trends', () => {
    const home = read('../home/HomeScreen.tsx');
    expect(home).not.toMatch(/new Set<Recommendation\['kind'\]>\(\['emergency', 'seekHelp', 'recheck', 'hold'\]\)/);
    expect(home).toContain('held: SAFETY_KINDS.has(recommendation.kind) && !stopped,');
    const urgent = read('../home/urgent.ts');
    expect(urgent).toContain("export const SAFETY_KINDS: ReadonlySet<RecommendationKind> = new Set(['emergency', 'seekHelp', 'recheck', 'hold']);");
    expect(urgent).toContain('return SAFETY_KINDS.has(recommend({ ...recommendSources({ now, state, plan: guided.plan, checkIns }), permissions: gatesNow(guided) }).kind);');
  });
});

describe('Your week’s line when there is nothing to sum up (H3-21)', () => {
  it('is worked out from the week’s records, never assumed from the sentences', () => {
    expect(read('TrendsScreen.tsx')).toContain('empty={emptyLine(facts)}');
    const card = read('YourWeekCard.tsx');
    expect(card).not.toContain('Nothing recorded');
    expect(card).toContain('{empty}</p>');
  });
});

describe('Labs show when the latest was measured (H3-05)', () => {
  it('the headline’s line under the value is the model’s, with its date', () => {
    expect(read('CategoryTrend.tsx')).toContain('<TrendHeadlines headline={view.headline} change={view.change} />');
  });
});

describe('Your week keeps the goal its own week had, whichever week it is (H3-14, B-16)', () => {
  it('reads it for the chosen week, not from the 8 rings on screen', () => {
    const trends = read('TrendsScreen.tsx');
    expect(trends).toContain('const goal = weeklyGoalOn(state.settings, week);');
    expect(trends).not.toContain('rings.find(r => r.week === week)?.goal');
  });
});

describe('the Labs row opens the lab it names (H3-20)', () => {
  it('the row carries its lab, and Labs opened without one shows the latest, by the same rule', () => {
    expect(read('TrendsScreen.tsx')).toContain('to={`/trends/${row.id}${row.search ?? \'\'}`}');
    expect(read('CategoryTrend.tsx')).toContain("const lab: LabKind = asked !== null ? labFrom(asked) : latestLab(state.observations, prefs)?.lab ?? 'hba1c';");
  });
});

describe('the chart keeps pinch zoom (H3-18, journey §20.4 rule 7)', () => {
  it('lets the page scroll and pinch-zoom over the plot, which keeps its own taps and drags', () => {
    const chart = read('TrendChart.tsx');
    const slider = chart.slice(chart.indexOf('role="slider"'), chart.indexOf('<svg width={width}'));
    expect(slider).toMatch(/className="[^"]*\btouch-pan-y touch-pinch-zoom\b/);
  });
});

describe('the list reflows when its columns have no room (H3-17, journey §20.4 rule 7)', () => {
  const table = {
    columns: ['Week', 'Readings', 'Range', 'Average'],
    rows: [['21–27 Sep', '1', '104–104 mg/dL', '104 mg/dL'], ['5–11 Oct · Meter', 'LO on Tue 6 Oct at 1:00 pm', 'Below what the meter can show', '']],
  };

  it('narrower than 5 rem a column, each row is a block of labelled values; wider, the table; never both at once', async () => {
    const { createElement } = await import('react');
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { TrendTable } = await import('./TrendChart');
    const html = renderToStaticMarkup(createElement(TrendTable, { id: 'l', caption: 'Glucose, May – Oct 2026', table }));
    expect(html).toMatch(/<div id="l" class="@container[^"]*">/);
    expect(html).toMatch(/<table class="[^"]*@max-\[20rem\]:hidden/);
    expect(html).toMatch(/<ul aria-label="Glucose, May – Oct 2026" class="[^"]*@min-\[20rem\]:hidden/);
    // Every value with its column's name; an empty cell is left out.
    expect(html).toContain('<dt class="inline text-muted-foreground">Readings: </dt><dd class="inline">1</dd>');
    expect(html).toContain('<dt class="inline text-muted-foreground">Range: </dt><dd class="inline">Below what the meter can show</dd>');
    expect(html).not.toContain('Average: </dt><dd class="inline"></dd>');
    const three = renderToStaticMarkup(createElement(TrendTable, { id: 'd', caption: 'Steps', table: { columns: ['Day', 'This week', 'Last week'], rows: [] } }));
    expect(three).toMatch(/<table class="[^"]*@max-\[15rem\]:hidden/);
    expect(three).toContain('Nothing recorded in this period.');
  });
});
