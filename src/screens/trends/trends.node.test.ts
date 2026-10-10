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
