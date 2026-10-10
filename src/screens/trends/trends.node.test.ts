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
