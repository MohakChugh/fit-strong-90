import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve('src');
const rel = (file: string) => path.relative(path.resolve('.'), file).split(path.sep).join('/');

/** The file an import names, as Vite resolves it here: `@/` is `src/`. Packages are left out. */
function resolve(from: string, spec: string): string | undefined {
  const base = spec.startsWith('@/') ? path.join(SRC, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(from), spec) : undefined;
  if (!base) return undefined;
  for (const ending of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const file = base + ending;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  return undefined;
}

/** Every file the first screen loads: static imports from `src/main.tsx`, never `import()` or `import type`. */
function firstScreen(): Set<string> {
  const seen = new Set<string>();
  const todo = [path.join(SRC, 'main.tsx')];
  while (todo.length > 0) {
    const file = todo.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!/\.tsx?$/.test(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/^\s*(?:import|export)\s+(type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm)) {
      if (m[1]) continue;
      const next = resolve(file, m[2]);
      if (next) todo.push(next);
    }
  }
  return new Set([...seen].map(rel));
}

/** Every source file under these folders, tests left out. */
function sources(...dirs: string[]): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(file);
    }
  };
  for (const d of dirs) walk(path.join(SRC, d));
  return out;
}

/** Anything that shows a nutrition figure, or an energy figure from movement. */
const SHOWS_FIGURE = /\bkcal\b|activeEnergy|energyText\(|energyKcal|\b(?:itemEstimate|totalsLines|mealRowDetail|foodRowDetail|careTeamLine|kcalText|carbsText|dayLine|dailyNutrition)\(/;
/** Asking the gate: the person's level decides (B-11). */
const ASKS = /\bcountsFree\(|\bnumbersView\(/;
/**
 * Files that only word figures for a caller that asks the gate, each with
 * that caller. Add one here only with the caller that gates it.
 */
const WORDS_ONLY: Record<string, string> = {
  'src/screens/track/timeline.ts': 'MyDay.tsx passes numbersView() and countsFree() in DayData',
  'src/screens/food/parts.tsx': 'LogMealSheet.tsx passes numbersView() to every part',
  'src/screens/track/format.ts': 'only titles activeEnergy: its figure shows with its walk, in WalkSummary.tsx, RecordDetails.tsx and MyDay.tsx, which ask countsFree()',
  'src/screens/track/metrics.ts': 'gives activeEnergy no metric: its figure is its walk’s, in RecordDetails.tsx, which asks countsFree()',
  'src/screens/trends/food.ts': 'CategoryTrend.tsx and TrendsScreen.tsx pass numbersView() and draw no Food trend without it',
  'src/screens/trends/metrics.ts': 'names Food’s unit only: Food’s figures are food.ts’s, which CategoryTrend.tsx and TrendsScreen.tsx gate with numbersView()',
};

describe('the food table stays out of the first screen (Global Constraints)', () => {
  it('is never loaded by anything src/main.tsx imports statically', () => {
    const loaded = firstScreen();
    expect(loaded.has('src/main.tsx')).toBe(true);
    expect(loaded.has('src/screens/home/HomeScreen.tsx')).toBe(true);
    expect([...loaded].filter(f => f === 'src/food/data.ts' || f.startsWith('src/data/food/'))).toEqual([]);
  });
});

describe('counts-free hides every figure (B-11)', () => {
  it('every screen that shows a nutrition or energy figure asks numbersView() or countsFree()', () => {
    const offenders = sources('screens', 'components', 'pages', 'reminders')
      .filter(file => {
        const text = fs.readFileSync(file, 'utf8');
        return SHOWS_FIGURE.test(text) && !ASKS.test(text) && !(rel(file) in WORDS_ONLY);
      })
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
