# FitStrong v2 Plan 3: Trends Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Trends tab: "Your week" with this week's ring and the last 8 weeks; every category that has data; and one shared category trend (Week · Month · 6 Months · Year) whose statistics, comparisons, spread and words follow per-measure rules, with a chart that can be read by touch, keyboard, list and VoiceOver.

**Architecture:**
- **Every rule is a pure module in `src/screens/trends/`, with its own unit tests:**
  - `periods.ts`: the four windows and the like-for-like ranges;
  - `stats.ts`: statistics, weighting, coverage and comparisons (B-15);
  - `records.ts`: what counts (J§12.3), through v1's aggregation only;
  - `metrics.ts`: the trend for each category, and how its records become figures or readings;
  - `model.ts`: what a trend shows (headline, change, spread, notes, the chart's model and its words);
  - `chart.ts`: the chart's model type and its maths (slots, keys, legend);
  - `yourWeek.ts`: Your week, the rings and the brief.
- **One chart component, `TrendChart`, draws a `ChartModel`** (slots, and series of bars, points or ranges) and computes no statistic. Plan 7 adds Food's kcal and carbs as one more series of the same model.
- **Counting reuses v1's typed aggregation** (`aggregate.series`, `recordedMovement`) and its overlap rules (F17, F19). Nothing adds observations any other way.
- **Plan 2's parts are consumed, never rebuilt:** the dated weekly goal (`weeklyGoalOn`, `pendingWeeklyGoal`), the day's steps figure (`stepsDayFigure`), a movement hub's history (`movementHistory`), and Labs' `?metric=` (`labFrom`). Hubs reach a trend through Plan 2's `SeeTrends` (`trendHref`), passing their origin, so a trend's Back names its hub.
- **`/trends` and `/trends/:id` replace the interim v1 screens.** `/trends/workout` becomes the Workout trend; a past workout keeps `/trends/workout/:id`.

**Tech stack:** React 19, TypeScript (strict, `erasableSyntaxOnly`, `verbatimModuleSyntax`), Vite 8, Tailwind v4 with container queries, React Router 7.13 hash data router, the IndexedDB store, date-fns 4, Vitest 4 in the node environment, and the Playwright-core acceptance suite (`npm run e2e:acceptance`). No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-08-fitstrong-v2-journey-design.md` (cited as J§) and `docs/superpowers/specs/2026-10-08-fitstrong-v2-motion-design.md` (M-numbers). Read J§12 in full, J§1.2 (the 2-tap budget), §4.7 and §4.10, §20.2–20.4, §25's B-10, B-14, B-15, B-16, B-20, B-30 and B-32 (§25 overrides any earlier text it contradicts), and M1, M21. The roadmap is `docs/superpowers/plans/2026-10-08-fitstrong-v2-roadmap.md`; Plan 1 (`…-plan-1-shell-home.md`) is the style model, and Plan 2 (`…-plan-2-hubs.md`) is what this plan builds on.

**Scope:**
- **In:** the Trends root and every category trend at `/trends/:id` (Workout, Stretch, Walk, Steps, Glucose, Blood pressure, Back & leg, Weight, Water, Sleep, Waist, Labs, and Mood for v4 records); the statistics module; the shared `TrendChart`; the weekly rings; Your week and its `weekBrief` prompt on Home; Labs as dated points; D21's chart inside the Back & leg trend; Week first from Trends (B-10); acceptance V-J07, V-J26, V-J27 and B-30's historical-incident case for Trends.
- **Out:** hubs (Plan 2), Browse and Me (Plan 4), walk energy and route thumbnails (Plan 6: rows here leave room for a thumbnail), and Food's trend (Plan 7: its address goes to the Food hub until then).

**Done when** (roadmap): V-J07, V-J26 and V-J27 pass, with B-30's historical case; the statistics have unit tests; J01–J20 and Plan 2's V-journeys still pass; Codex and Kiro have reviewed the diff.

## Global Constraints

- **Branch:** `feat/v2-journey`, after Plan 2 is merged into it and reviewed (Task 1 checks). Never push to `main`. One commit per task, with a conventional message.
- **Local-only:** no new network request, no new dependency ("Charts and rings: v1's own SVG `Ring` and `Chart`, extended. No dependency", J§22), no API keys.
- **Trends decides nothing** (J§4.2). It has no Start and computes no permission. The shell's safety surface is first on every Trends screen, through `Screen` (B-02).
- **Counting** goes through `aggregate.series`, `aggregate.sum` and `recordedMovement` (D10). A trend never adds observations itself.
- **Deltas are neutral:** "Higher than last week · +327 steps a day", in body ink with an arrow. "There's no green or red and no 'better' or 'worse' (A-41, K-41)." The only goal phrase is the weekly ring's minutes against the person's own weekly goal.
- **Comparisons** set a finished period against the whole one before, and the current one against "the same elapsed days of the previous one". They need "at least 3 days with data in both periods", and "the statistic and unit are always named" (J§12.2, A-42).
- **Readings:** "Clinical readings are never excluded for a status day: 'includes 2 Unwell days'". "HI and LO are excluded from the average, shown above it in caution ink", and "a LO in either period hides the change". "The reading count says which readings are numeric" (J§12.2, B-15).
- **Status shading is for movement charts only** (Workout, Stretch, Walk, Steps): "Rest, Away, Unwell and Flare-up days are hatched and labelled, never shown as zero" (K-49).
- **Your week:** "2–4 factual sentences". "Nothing is framed as praise or blame." "They're never shown in a non-Normal status or on a day with a hold, and they never count testing frequency, weight loss or food restriction." "Walking praise is never shown when walking is held for the feet (K-12)."
- **Measured values show when they were measured** (J§4.10): a reading's date, time when it has one, unit and context.
- **Every chart** has "Show as list" (a table) and a text summary for VoiceOver. "Selection uses the whole plot, with arrow keys and a list. The previous period is a pattern as well as a colour, and the selected state's contrast is measured" (B-15).
- **Colour:** graphics at 3:1 and text at 4.5:1 on the card, in light and dark; "Colour is never the only signal" (J§20.3).
- **Grandma rules (J§20.4):** targets at least 48×48 px and never under 44 (`min-h-12`); a visible text label on every control; period paging says "Previous week" and "Next week" (B-08); a unit on every number; text to 200% and 320 px reflow; at most 5 main choices per region, where a radio group counts as one (B-08).
- **Motion (M21):** history is static, so nothing sweeps from zero and rings are drawn set. Changing the period slides the segment indicator (`spring-quick`) and fades the plot over 200 ms; the headline, its statistic and the change update at once, never counting. A chosen slot's callout appears with `spring-quick`. Under Reduce motion (the system's or the app's), nothing moves.
- **Week first** whenever a trend opens without a `?period=` (B-10).
- **Copy:** Indian English, sentence case, verbs on buttons, numbers through `formatNumber` (Indian grouping). Exact strings are given in each task; tests pin them.
- **Tests:** Vitest runs in the node environment (`src/**/*.test.ts`). A test that reads files with `node:fs` is named `*.node.test.ts`. Components aren't unit-rendered here: every rule is a pure function with its own test, and screens are proven by the acceptance suite in headless Chromium.
- **Gates before every commit:** `npx tsc -b`, `npm run lint` and `npx vitest run` must all pass.

## Review Focus

These are failure modes the spec implies that no task's ordinary tests would exercise. Each line's test is in the task that owns the code.

1. **Glucose in two units in one week.** Someone who switched meters, or restored an older backup, has readings in mg/dL and mmol/L. Every reading must be shown, averaged and judged low or high in the person's display unit, never averaged across units. Task 5 has the test.
2. **A day total entered twice.** A corrected steps or water total, or a final steps total in the evening, must count once (the later statement), in the week's average, in the list, and in "at least". Task 4 has the test.
3. **A week with only a meter's HI or LO.** There's no number to average. The trend must say "No numeric readings", show the LO above in caution ink, hide the change, and never show 0 or NaN. Tasks 3 and 8 have the tests.
4. **A record that starts mid-week.** For someone whose first record is Thursday, last week isn't zero: there is no comparison, and Your week says no "fewer than last week". Tasks 3 and 12 have the tests.
5. **Month ends and the year end.** 30 March against February (and a leap February), and 6 Months and Year windows across 1 January, must give the right windows and like-for-like days. Task 2 has the tests.

## Before you start: what Plan 2 left

Plan 3 builds on Plan 2's code. In the worktree, each `grep` below must print a line. If one doesn't, Plan 2 isn't merged yet: stop, and finish Plan 2 first.

```bash
grep -n "export function weeklyGoalOn\|export function pendingWeeklyGoal" src/screens/track/weeklyGoal.ts
grep -n "export function stepsDayFigure\|export interface StepsFigure" src/screens/track/stepsDay.ts
grep -n "export function movementHistory\|export interface HistoryRow" src/screens/hub/week.ts
grep -n "export function labFrom" src/screens/hub/reading.ts
grep -n "export function SeeTrends" src/screens/hub/HubFrame.tsx
grep -n "/hub/workout/log" src/routes.tsx
grep -n "trend?: string" src/categories.ts
grep -n "export function assembleBackLeg" src/screens/track/backLegSeries.ts
grep -n "export function BackLegChart" src/screens/track/BackLegChart.tsx
```

What this plan uses from them, as Plan 2 defines them:
- `weeklyGoalOn(settings, day): number | undefined` is the goal for the week holding `day`. `pendingWeeklyGoal(settings, day): { from: string; goal?: number } | undefined` is a change waiting for a later Monday (B-16). Plan 2 owns the weekly-goal API: the dated history is `settings.weeklyMovementGoalHistory`, which Plan 4 exports as `weeklyGoalChanges`. This plan reads the goal only through `weeklyGoalOn` and `pendingWeeklyGoal`, and never reads or redefines the history.
- `stepsDayFigure(day, observations, hour12): StepsFigure`, where `StepsFigure` is `{ kind: 'entered' | 'atLeast' | 'walks' | 'none'; value?: string; source: string; steps?: number }`. It's the day's steps as J§9.6 says them, and Home's steps line already uses it.
- `movementHistory(mode, sessions, observations, prefs, current): HistoryRow[]`, where `HistoryRow` is `{ key; label; detail; ref: RecordRef; at }`. These are a movement hub's records, newest first.
- `labFrom(value): LabKind` reads Labs' `?metric=`.
- Hubs link here with `SeeTrends`, passing their own origin as navigation state, so a trend's Back names the hub.

If a name moved (Plan 2's review can rename), use it where it now lives, keep this plan's behaviour, and note the new path in the task's commit message.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/screens/trends/periods.ts` (new), `periods.test.ts` (new) | Week, Month, 6 Months, Year; buckets; paging; like-for-like ranges; the words for windows |
| `src/screens/trends/stats.ts` (new), `stats.test.ts` (new) | Daily statistics (counted and stated), readings, labs, comparisons, the day context |
| `src/screens/trends/records.ts` (new), `records.test.ts` (new) | What counts: the first record, sessions by kind, minutes, stretch days (§12.3), walking, day totals, the day's steps, a meter's HI and LO, recent activity |
| `src/screens/trends/metrics.ts` (new), `metrics.test.ts` (new) | The trend for each category (and Mood), units, precision, figures, readings, labs |
| `src/screens/trends/model.ts` (new), `model.test.ts` (new) | `dailyView`, `readingsView`, `labsView`, `trendRow`, `trendContext`: what a trend shows, in figures and words |
| `src/screens/trends/chart.ts` (new), `chart.test.ts` (new) | `ChartModel` and its maths: `domainOf`, `selectable`, `slotAt`, `stepValue`, `legendOf` |
| `src/screens/trends/yourWeek.ts` (new), `yourWeek.test.ts` (new) | Your week's facts and sentences, the rings, when the brief is offered and shown |
| `src/screens/trends/TrendChart.tsx` (new) | The shared chart |
| `src/screens/trends/PeriodControl.tsx` (new) | Week · Month · 6 Months · Year, and the worded pager |
| `src/screens/trends/TrendHeadlines.tsx` (new) | The headline, the change and the meter line |
| `src/screens/trends/CategoryTrend.tsx` (new) | `/trends/:id`, Labs included |
| `src/screens/trends/TrendsScreen.tsx`, `YourWeekCard.tsx`, `WeeklyRings.tsx`, `Sparkline.tsx` (new) | The Trends tab |
| `src/screens/trends/routes.tsx` (new) | `/trends/*` |
| `src/components/hig/StatGrid.tsx` (new) | J§20.2's StatGrid |
| `src/components/hig/useMeasure.ts` (new) | The charts' shared measuring hook (moved out of `Chart.tsx`) |
| `src/components/hig/Chart.tsx`, `src/screens/track/PairChart.tsx`, `src/screens/track/BackLegChart.tsx` (modify) | Import `useMeasure` instead of three copies |
| `src/index.css`, `src/design/tokens.node.test.ts` (modify) | `--trend-previous`; the chart's measured contrasts |
| `src/routes.tsx`, `src/screens/track/MetricDetail.tsx`, `src/screens/track/MyDay.tsx` (modify) | The Trends subtree; the interim trend code goes |
| `src/screens/home/week.ts`, `week.test.ts` (modify) | Stretch days count a session's mobility block (§12.3) |
| `src/screens/today/model.ts`, `model.test.ts` (modify) | The `weekBrief` prompt, ranked last (B-20) |
| `src/screens/home/HomeScreen.tsx` (modify) | Offer "Your week in brief" |
| `scripts/e2e/acceptance/lib/data.mjs`, `run.mjs`, `journeys/s01.mjs` (modify) | `importFixture`; the journey filter takes `v`; S01 sweeps the Trends screens |
| `scripts/e2e/acceptance/journeys/v07.mjs`, `v24.mjs`, `v26.mjs`, `v27.mjs` (new) | The Plan 3 journeys |
| `docs/reimagine/BOARD.md` (modify) | Decisions, then the result |

---

### Task 1: Baseline and board decisions

**Files:**
- Modify: `docs/reimagine/BOARD.md` (append)

**Interfaces:** none.

- [ ] **Step 1: Check the baseline.**

```bash
git checkout feat/v2-journey
git status --short            # clean, except untracked docs
git log --oneline -n 20       # Plan 2's commits and its review fixes are in
npx tsc -b && npm run lint && npx vitest run
```

Then run the greps in "Before you start". Every one must print a line.

- [ ] **Step 2: Append the decisions to the board.** Add the text below, exactly, at the end of `docs/reimagine/BOARD.md`. Decision numbers are allocated per plan so that plans written side by side never collide: Plan 2 has D47–D55, Plan 4 D68–D67, Plan 3 D68–D74, Plan 5 D75–D84, Plan 6 D85–D94 and Plan 7 D95–D104. Check first that D68–D74 are still free (`grep -n 'D6[89]\|D7[0-4]' docs/reimagine/BOARD.md` prints nothing); if one is taken, stop and ask, rather than renumbering on your own.

```markdown
### 2026-10-10 — [claude] v2 Plan 3 (Trends): decisions recorded before building

From journey §12, §20.2–20.4, §25 (B-10, B-14, B-15, B-16, B-20, B-30, B-32) and motion M21. The plan is `docs/superpowers/plans/2026-10-10-fitstrong-v2-plan-3-trends.md`.

| # | Decision | Reason |
| --- | --- | --- |
| D68 | **Statistics by kind of measure (B-15).** *Counted* (minutes of workouts, stretches, walks): a day of the record with nothing is 0, and a day of data; an Away, Unwell or Flare-up day is shaded and is not a day of data, though what was recorded on it counts. Week and Month state the total; 6 Months a week on average (total ÷ days of data × 7); Year a month on average (total ÷ days of data × 30.44). *Stated* (steps, water, sleep): a day without a figure is "Not entered" and not a day of data; every period states a day on average (total ÷ days with a figure), and the 6 Months and Year bars are each week's or month's average a day. *Readings* (glucose, blood pressure, weight, waist, back and leg pain, mood): the average of numeric readings with n, range and lows and highs; 6 Months and Year draw weekly or monthly means with their range. *Labs*: every result, dated, with its interval; no period and no comparison | B-15 asks for each statistic, its weighting and its coverage |
| D69 | **Steps state "a day on average" in Week and Month too,** where §12.2's table says "sum" | §12.2's own example is "+327 steps a day"; a weekly sum would treat a day not entered as a day without steps (D14) |
| D70 | **Comparisons:** a finished period against the whole one before; the current one against the same number of days from the start of the one before ("Mon–Thu vs last Mon–Thu", "1–30 Mar vs 1–28 Feb"); 3 days of data in both; a meter LO anywhere in either period hides a readings change | A-42, K-11, B-15 |
| D71 | **The chosen slot is outlined in body ink, measured at 3:1 or more, and the other bars are not faded** | B-15 overrides M21's "soften to 60%", which can't guarantee 3:1 |
| D72 | **Stretch days count any session whose mobility block was done (§12.3),** on Trends and on Home's This week alike. Stretch minutes are the stretch routines' | §12.3; one count everywhere |
| D73 | **Your week** is shown for the week chosen in the 8 rings (this week by default) and suppressed while the status isn't Normal or the safety surface stands. **"Your week in brief"** is a `weekBrief` prompt for last week, from Monday 04:00 until it's opened or the week ends, ranked last in `pickPrompt`; "seen" is kept in content state (`trends:weekBrief`), so it's backed up; Trends always offers it ("Last week in brief"). Each of the 8 rings is drawn against the goal its week had (Plan 2's `weeklyGoalOn`, B-16), and drawn set, never animated (M21), so B-32's ring identity never has a change to animate here | §12.6, B-16, B-20, B-32, L-18 |
| D74 | **Addresses.** `/trends/workout` is the Workout trend, with the workouts listed under it; a past workout keeps `/trends/workout/:id`. `/trends/food` goes to the Food hub until Plan 7 builds Food's trend. Mood keeps `/trends/mood`, listed under "Other records" only when mood readings exist (they come only from v4 backups); it isn't a category | B-14; B-22, never an empty screen; no record is hidden, and Plan 1 left Mood to Plan 3 |
```

- [ ] **Step 3: Commit**

```bash
git add docs/reimagine/BOARD.md
git commit -m "docs: Record the v2 Trends decisions on the board"
```

---

### Task 2: Period windows and like-for-like ranges

**Files:**
- Create: `src/screens/trends/periods.ts`
- Create: `src/screens/trends/periods.test.ts`

**Interfaces:**
- Consumes: `addDays`, `daysBetween`, `daysIn`, `mondayOf` from `@/screens/track/periods`; `type DayRange` from `@/health/aggregate`.
- Produces:
  - `type TrendPeriod = 'week' | 'month' | 'sixMonths' | 'year'`;
  - `TREND_PERIODS: readonly { id: TrendPeriod; label: string }[]`;
  - `isTrendPeriod(value: unknown): value is TrendPeriod`;
  - `interface TrendWindow { period: TrendPeriod; from: string; to: string; buckets: DayRange[] }`;
  - `monthStart(day: string, offset?: number): string`, `monthEnd(day: string, offset?: number): string`;
  - `windowOf(period: TrendPeriod, anchor: string): TrendWindow`;
  - `previousWindow(w: TrendWindow): TrendWindow`, `nextWindow(w: TrendWindow): TrendWindow`;
  - `isCurrent(w: TrendWindow, today: string): boolean`;
  - `interface CompareRanges { current: DayRange; previous: DayRange; partial: boolean }`;
  - `compareRanges(w: TrendWindow, today: string): CompareRanges | undefined`;
  - `rangeText(range: DayRange, today: string): string`;
  - `windowTitle(w: TrendWindow, today: string): string`;
  - `pagerLabels(period: TrendPeriod): { previous: string; next: string }`;
  - `previousName(w: TrendWindow, today: string): string`;
  - `comparedText(w: TrendWindow, ranges: CompareRanges, today: string): string`.

- [ ] **Step 1: Write the failing test** `src/screens/trends/periods.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { addDays } from '@/screens/track/periods';
import {
  comparedText, compareRanges, isTrendPeriod, monthEnd, monthStart, nextWindow, pagerLabels, previousName, previousWindow,
  rangeText, windowOf, windowTitle,
} from './periods';

// Thursday 8 October 2026.
const TODAY = '2026-10-08';

describe('trend windows (journey §12.2)', () => {
  it('Week: Monday to Sunday, a bucket a day', () => {
    const w = windowOf('week', TODAY);
    expect([w.from, w.to]).toEqual(['2026-10-05', '2026-10-11']);
    expect(w.buckets).toHaveLength(7);
    expect(w.buckets[0]).toEqual({ from: '2026-10-05', to: '2026-10-05' });
  });

  it('Month: the calendar month, a bucket a day, leap Februaries included', () => {
    const w = windowOf('month', TODAY);
    expect([w.from, w.to, w.buckets.length]).toEqual(['2026-10-01', '2026-10-31', 31]);
    expect(windowOf('month', '2028-02-10').buckets).toHaveLength(29);
    expect(windowOf('month', '2026-02-10').buckets).toHaveLength(28);
  });

  it('6 Months: the last 6 calendar months, in Monday–Sunday weeks cut to the window', () => {
    const w = windowOf('sixMonths', TODAY);
    expect([w.from, w.to]).toEqual(['2026-05-01', '2026-10-31']);
    // 1 May 2026 is a Friday: the first week is cut to Friday–Sunday.
    expect(w.buckets[0]).toEqual({ from: '2026-05-01', to: '2026-05-03' });
    expect(w.buckets[1]).toEqual({ from: '2026-05-04', to: '2026-05-10' });
    expect(w.buckets.at(-1)).toEqual({ from: '2026-10-26', to: '2026-10-31' });
    expect(w.buckets).toHaveLength(27);
    expect(w.buckets.every((b, i) => i === 0 || b.from === addDays(w.buckets[i - 1].to, 1))).toBe(true);
  });

  it('Year: the last 12 calendar months, a bucket a month, across the year end (Review Focus 5)', () => {
    const w = windowOf('year', TODAY);
    expect([w.from, w.to, w.buckets.length]).toEqual(['2025-11-01', '2026-10-31', 12]);
    expect(w.buckets[1]).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(w.buckets[3]).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('pages to the window before and after', () => {
    expect(previousWindow(windowOf('week', TODAY)).from).toBe('2026-09-28');
    expect(previousWindow(windowOf('month', '2026-03-31'))).toMatchObject({ from: '2026-02-01', to: '2026-02-28' });
    expect(previousWindow(windowOf('sixMonths', TODAY))).toMatchObject({ from: '2025-11-01', to: '2026-04-30' });
    expect(previousWindow(windowOf('year', TODAY))).toMatchObject({ from: '2024-11-01', to: '2025-10-31' });
    expect(nextWindow(windowOf('week', '2026-09-30')).from).toBe('2026-10-05');
  });

  it('moves months across the year end', () => {
    expect(monthStart('2026-01-15', -1)).toBe('2025-12-01');
    expect(monthEnd('2026-01-15', 1)).toBe('2026-02-28');
    expect(monthEnd('2028-02-01')).toBe('2028-02-29');
  });
});

describe('like-for-like comparisons (A-42, B-15)', () => {
  it('an unfinished week against the same days of last week', () => {
    expect(compareRanges(windowOf('week', TODAY), TODAY)).toEqual({
      current: { from: '2026-10-05', to: '2026-10-08' }, previous: { from: '2026-09-28', to: '2026-10-01' }, partial: true,
    });
  });

  it('a finished week against the whole week before', () => {
    expect(compareRanges(windowOf('week', '2026-09-30'), TODAY)).toEqual({
      current: { from: '2026-09-28', to: '2026-10-04' }, previous: { from: '2026-09-21', to: '2026-09-27' }, partial: false,
    });
  });

  it('30 March against February: the same days, cut to the shorter month (Review Focus 5)', () => {
    expect(compareRanges(windowOf('month', '2026-03-30'), '2026-03-30')?.previous).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(compareRanges(windowOf('month', '2028-03-30'), '2028-03-30')?.previous).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(compareRanges(windowOf('month', '2026-03-08'), '2026-03-08')?.previous).toEqual({ from: '2026-02-01', to: '2026-02-08' });
  });

  it('6 Months counts the same number of days from the start of the window before', () => {
    // 1 May to 8 October is 160 days on from the start; 160 days on from 1 November is 10 April.
    expect(compareRanges(windowOf('sixMonths', TODAY), TODAY)).toEqual({
      current: { from: '2026-05-01', to: '2026-10-08' }, previous: { from: '2025-11-01', to: '2026-04-10' }, partial: true,
    });
  });

  it('nothing to compare for a window that has not started', () => {
    expect(compareRanges(windowOf('week', '2026-10-12'), TODAY)).toBeUndefined();
  });
});

describe('the words for windows', () => {
  it('this week, last week, and other weeks by their dates, with the year only when it isn’t this one', () => {
    expect(windowTitle(windowOf('week', TODAY), TODAY)).toBe('This week');
    expect(windowTitle(windowOf('week', '2026-09-30'), TODAY)).toBe('Last week');
    expect(windowTitle(windowOf('week', '2026-09-23'), TODAY)).toBe('21–27 Sep');
    expect(windowTitle(windowOf('week', '2025-12-31'), TODAY)).toBe('29 Dec 2025 – 4 Jan 2026');
  });

  it('months and the longer windows', () => {
    expect(windowTitle(windowOf('month', TODAY), TODAY)).toBe('This month');
    expect(windowTitle(windowOf('month', '2026-09-10'), TODAY)).toBe('September');
    expect(windowTitle(windowOf('month', '2025-09-10'), TODAY)).toBe('September 2025');
    expect(windowTitle(windowOf('sixMonths', TODAY), TODAY)).toBe('May – Oct 2026');
    expect(windowTitle(windowOf('year', TODAY), TODAY)).toBe('Nov 2025 – Oct 2026');
  });

  it('ranges of days', () => {
    expect(rangeText({ from: '2026-10-05', to: '2026-10-11' }, TODAY)).toBe('5–11 Oct');
    expect(rangeText({ from: '2026-09-28', to: '2026-10-04' }, TODAY)).toBe('28 Sep – 4 Oct');
    expect(rangeText({ from: '2026-10-05', to: '2026-10-05' }, TODAY)).toBe('5 Oct');
    expect(rangeText({ from: '2025-09-28', to: '2025-10-04' }, TODAY)).toBe('28 Sep – 4 Oct 2025');
  });

  it('the pager says where it goes, in words (B-08)', () => {
    expect(pagerLabels('week')).toEqual({ previous: 'Previous week', next: 'Next week' });
    expect(pagerLabels('month')).toEqual({ previous: 'Previous month', next: 'Next month' });
    expect(pagerLabels('sixMonths')).toEqual({ previous: 'Previous 6 months', next: 'Next 6 months' });
    expect(pagerLabels('year')).toEqual({ previous: 'Previous year', next: 'Next year' });
  });

  it('which days were compared', () => {
    const w = windowOf('week', TODAY);
    expect(comparedText(w, compareRanges(w, TODAY)!, TODAY)).toBe('Mon–Thu vs last Mon–Thu');
    const monday = windowOf('week', '2026-10-05');
    expect(comparedText(monday, compareRanges(monday, '2026-10-05')!, '2026-10-05')).toBe('Monday vs last Monday');
    const month = windowOf('month', TODAY);
    expect(comparedText(month, compareRanges(month, TODAY)!, TODAY)).toBe('1–8 Oct vs 1–8 Sep');
    const past = windowOf('week', '2026-09-30');
    expect(comparedText(past, compareRanges(past, TODAY)!, TODAY)).toBe('28 Sep – 4 Oct vs 21–27 Sep');
  });

  it('the window a change is measured against', () => {
    expect(previousName(windowOf('week', TODAY), TODAY)).toBe('last week');
    expect(previousName(windowOf('week', '2026-09-30'), TODAY)).toBe('the week before');
    expect(previousName(windowOf('month', TODAY), TODAY)).toBe('last month');
    expect(previousName(windowOf('month', '2026-09-10'), TODAY)).toBe('the month before');
    expect(previousName(windowOf('sixMonths', TODAY), TODAY)).toBe('the 6 months before');
    expect(previousName(windowOf('year', TODAY), TODAY)).toBe('the 12 months before');
  });

  it('knows its own period ids, and nothing else', () => {
    expect(isTrendPeriod('sixMonths')).toBe(true);
    expect(isTrendPeriod('quarter')).toBe(false);
    expect(isTrendPeriod(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/screens/trends/periods.test.ts`
Expected: FAIL, "Cannot find module './periods'".

- [ ] **Step 3: Write the module** `src/screens/trends/periods.ts`

```ts
/**
 * The windows a trend shows (journey §12.2): Week is Monday to Sunday in
 * days, Month the calendar month in days, 6 Months the last 6 calendar months
 * in Monday–Sunday weeks, and Year the last 12 calendar months in months.
 * Days are local `YYYY-MM-DD` strings, as every record's `day` is, so no
 * clock or time zone enters the arithmetic.
 */
import { format } from 'date-fns';
import type { DayRange } from '@/health/aggregate';
import { addDays, daysBetween, daysIn, mondayOf } from '@/screens/track/periods';

export type TrendPeriod = 'week' | 'month' | 'sixMonths' | 'year';

export const TREND_PERIODS: readonly { id: TrendPeriod; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'sixMonths', label: '6 Months' },
  { id: 'year', label: 'Year' },
];

export function isTrendPeriod(value: unknown): value is TrendPeriod {
  return TREND_PERIODS.some(p => p.id === value);
}

export interface TrendWindow {
  period: TrendPeriod;
  /** The first and last day, inclusive. */
  from: string;
  to: string;
  /** One per bar: a day, a Monday–Sunday week or a calendar month, cut to the window. */
  buckets: DayRange[];
}

const pad = (n: number) => String(n).padStart(2, '0');
const noon = (day: string) => new Date(`${day}T12:00:00`);
const sameYear = (a: string, b: string) => a.slice(0, 4) === b.slice(0, 4);

/** The first day of the month `offset` months after the one `day` is in. */
export function monthStart(day: string, offset = 0): string {
  const d = new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`;
}

/** The last day of that month. */
export function monthEnd(day: string, offset = 0): string {
  return addDays(monthStart(day, offset + 1), -1);
}

const dayBuckets = (from: string, to: string): DayRange[] => daysIn({ from, to }).map(d => ({ from: d, to: d }));

function weekBuckets(from: string, to: string): DayRange[] {
  const out: DayRange[] = [];
  for (let monday = mondayOf(from); monday <= to; monday = addDays(monday, 7)) {
    const sunday = addDays(monday, 6);
    out.push({ from: monday < from ? from : monday, to: sunday > to ? to : sunday });
  }
  return out;
}

function monthBuckets(from: string, to: string): DayRange[] {
  const out: DayRange[] = [];
  for (let start = from; start <= to; start = monthStart(start, 1)) {
    const end = monthEnd(start);
    out.push({ from: start, to: end > to ? to : end });
  }
  return out;
}

/** The window of `period` that holds `anchor`. */
export function windowOf(period: TrendPeriod, anchor: string): TrendWindow {
  switch (period) {
    case 'week': {
      const from = mondayOf(anchor);
      const to = addDays(from, 6);
      return { period, from, to, buckets: dayBuckets(from, to) };
    }
    case 'month': {
      const from = monthStart(anchor);
      const to = monthEnd(anchor);
      return { period, from, to, buckets: dayBuckets(from, to) };
    }
    case 'sixMonths': {
      const from = monthStart(anchor, -5);
      const to = monthEnd(anchor);
      return { period, from, to, buckets: weekBuckets(from, to) };
    }
    case 'year': {
      const from = monthStart(anchor, -11);
      const to = monthEnd(anchor);
      return { period, from, to, buckets: monthBuckets(from, to) };
    }
  }
}

/** The window just before: last week, last month, the 6 or 12 months before. */
export function previousWindow(w: TrendWindow): TrendWindow {
  return windowOf(w.period, addDays(w.from, -1));
}

/** The window just after. */
export function nextWindow(w: TrendWindow): TrendWindow {
  return windowOf(w.period, addDays(w.to, 1));
}

/** The window holds today. */
export function isCurrent(w: TrendWindow, today: string): boolean {
  return w.from <= today && today <= w.to;
}

export interface CompareRanges {
  current: DayRange;
  previous: DayRange;
  /** An unfinished window, set against the same number of days of the one before. */
  partial: boolean;
}

/**
 * What a comparison sets side by side (A-42): a finished window against the
 * whole one before it; the current one, unfinished, against the same number
 * of days from the start of the one before ("Mon–Thu vs last Mon–Thu"), cut
 * to that window's end (30 March against all of February). Nothing for a
 * window that hasn't started.
 */
export function compareRanges(w: TrendWindow, today: string): CompareRanges | undefined {
  if (w.from > today) return undefined;
  const prev = previousWindow(w);
  if (w.to <= today) return { current: { from: w.from, to: w.to }, previous: { from: prev.from, to: prev.to }, partial: false };
  const to = addDays(prev.from, daysBetween(w.from, today));
  return { current: { from: w.from, to: today }, previous: { from: prev.from, to: to > prev.to ? prev.to : to }, partial: true };
}

/** "5–11 Oct", "28 Sep – 4 Oct", "28 Dec 2025 – 3 Jan 2026": the year only when it isn't today's. */
export function rangeText({ from, to }: DayRange, today: string): string {
  const year = !sameYear(from, to) || !sameYear(to, today);
  const end = format(noon(to), year ? 'd MMM yyyy' : 'd MMM');
  if (from === to) return end;
  if (from.slice(0, 7) === to.slice(0, 7)) return `${Number(from.slice(8, 10))}–${end}`;
  if (sameYear(from, to)) return `${format(noon(from), 'd MMM')} – ${end}`;
  return `${format(noon(from), 'd MMM yyyy')} – ${end}`;
}

/** The pager's title: "This week", "Last week", "21–27 Sep"; "This month", "September"; "May – Oct 2026". */
export function windowTitle(w: TrendWindow, today: string): string {
  const current = isCurrent(w, today);
  if (w.period === 'week') {
    if (current) return 'This week';
    return isCurrent(nextWindow(w), today) ? 'Last week' : rangeText(w, today);
  }
  if (w.period === 'month') return current ? 'This month' : format(noon(w.from), sameYear(w.from, today) ? 'MMMM' : 'MMMM yyyy');
  const end = format(noon(w.to), 'MMM yyyy');
  return sameYear(w.from, w.to) ? `${format(noon(w.from), 'MMM')} – ${end}` : `${format(noon(w.from), 'MMM yyyy')} – ${end}`;
}

const PAGE: Record<TrendPeriod, string> = { week: 'week', month: 'month', sixMonths: '6 months', year: 'year' };

/** The pager's buttons say where they go, not only an arrow (B-08). */
export function pagerLabels(period: TrendPeriod): { previous: string; next: string } {
  return { previous: `Previous ${PAGE[period]}`, next: `Next ${PAGE[period]}` };
}

/** What a change is measured against: "last week", "the week before", "the 6 months before". */
export function previousName(w: TrendWindow, today: string): string {
  const current = isCurrent(w, today);
  switch (w.period) {
    case 'week': return current ? 'last week' : 'the week before';
    case 'month': return current ? 'last month' : 'the month before';
    case 'sixMonths': return 'the 6 months before';
    case 'year': return 'the 12 months before';
  }
}

/** The days compared, said: "Mon–Thu vs last Mon–Thu", "1–8 Oct vs 1–8 Sep", "28 Sep – 4 Oct vs 21–27 Sep". */
export function comparedText(w: TrendWindow, r: CompareRanges, today: string): string {
  if (w.period === 'week' && r.partial) {
    if (r.current.from === r.current.to) return `${format(noon(r.current.from), 'EEEE')} vs last ${format(noon(r.previous.from), 'EEEE')}`;
    const day = (d: string) => format(noon(d), 'EEE');
    return `${day(r.current.from)}–${day(r.current.to)} vs last ${day(r.previous.from)}–${day(r.previous.to)}`;
  }
  return `${rangeText(r.current, today)} vs ${rangeText(r.previous, today)}`;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/screens/trends/periods.test.ts`
Expected: PASS.

- [ ] **Step 5: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/trends/periods.ts src/screens/trends/periods.test.ts
git commit -m "feat: Add Trends' four windows and their like-for-like ranges"
```

---

### Task 3: Statistics and comparisons

**Files:**
- Create: `src/screens/trends/stats.ts`
- Create: `src/screens/trends/stats.test.ts`

**Interfaces:**
- Consumes: `daysBetween`, `daysIn` from `@/screens/track/periods`; `statusOn`, `weekdayOf`, `type Status` from `@/health/status`; `roundTo` from `@/screens/track/units`; `type TrendPeriod` (Task 2).
- Produces:
  - `type StatusMark = Exclude<Status, 'normal'>`;
  - `interface DayContext { today: string; since?: string; statusOn(day: string): Status; restOn(day: string): boolean }`;
  - `dayContext(input: { today: string; since?: string; statusPeriods?: readonly StatusPeriod[]; restDays: readonly DayOfWeek[]; startDate: string }): DayContext`;
  - `recordDays(range: DayRange, ctx: DayContext): string[]`;
  - `interface DayFigure { day: string; value: number; basis?: 'entered' | 'walks' | 'atLeast'; note?: string }`;
  - `type DailyRule = 'counted' | 'stated'`;
  - `interface DailyStats { sum: number; days: number; recordDays: number; perDay?: number; high?: { day: string; value: number }; status: Partial<Record<StatusMark, number>>; partialDays: number }`;
  - `dailyStats(range: DayRange, figures: readonly DayFigure[], ctx: DayContext, rule: DailyRule): DailyStats`;
  - `type Statistic = 'total' | 'perDay' | 'perWeek' | 'perMonth'`, `DAYS_PER_MONTH`;
  - `statisticFor(rule: DailyRule, period: TrendPeriod): Statistic`, `figureOf(s: DailyStats, statistic: Statistic): number | undefined`;
  - `MIN_DAYS = 3`, `type Direction = 'higher' | 'lower' | 'same'`;
  - `type Comparison = { shown: true; direction: Direction; difference: number } | { shown: false; reason: 'fewDays' | 'meterLo' }`;
  - `change(current: number, previous: number, decimals: number): Comparison`;
  - `compareDaily(current: DailyStats, previous: DailyStats, statistic: Statistic, decimals: number): Comparison`;
  - `interface ReadingPoint { id: string; day: string; at: string; value: number; series: string; low?: true; high?: true }`;
  - `interface MeterReading { day: string; at?: string; display: 'HI' | 'LO' }`;
  - `interface ReadingStats { n: number; mean?: number; min?: number; max?: number; days: number; hi: number; lo: number; lows: number; highs: number; status: Partial<Record<StatusMark, number>> }`;
  - `readingStats(range: DayRange, points: readonly ReadingPoint[], meters: readonly MeterReading[], ctx: DayContext): ReadingStats`;
  - `compareReadings(current: ReadingStats, previous: ReadingStats, decimals: number, otherLo?: number): Comparison`;
  - `interface LabPoint { id: string; day: string; value: number; unit: string }`, `interface LabRow extends LabPoint { interval: string }`;
  - `intervalText(days: number | undefined): string`, `labHistory(points: readonly LabPoint[]): LabRow[]`;
  - `statusList(status: Partial<Record<StatusMark, number>>): string | undefined`.

- [ ] **Step 1: Write the failing test** `src/screens/trends/stats.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import {
  DAYS_PER_MONTH, MIN_DAYS, compareDaily, compareReadings, dailyStats, dayContext, figureOf, intervalText, labHistory,
  readingStats, recordDays, statisticFor, statusList, type DayContext, type DayFigure, type MeterReading, type ReadingPoint,
} from './stats';

// Thursday 8 October 2026; this week is Monday 5 to Sunday 11 October.
const TODAY = '2026-10-08';
const WEEK = { from: '2026-10-05', to: '2026-10-11' };
const LAST = { from: '2026-09-28', to: '2026-10-04' };
const ctx = (over: Partial<DayContext> = {}): DayContext => ({ today: TODAY, since: '2026-09-01', statusOn: () => 'normal', restOn: () => false, ...over });
const fig = (day: string, value: number, basis?: DayFigure['basis']): DayFigure => ({ day, value, ...(basis ? { basis } : {}) });
const awayOn = (...days: string[]) => (day: string) => (days.includes(day) ? 'away' as const : 'normal' as const);
const stated = (days: [string, number][]) =>
  dailyStats({ from: days[0][0], to: days.at(-1)![0] }, days.map(([d, v]) => fig(d, v)), ctx(), 'stated');

describe('the days of the record (early days)', () => {
  it('run from the first record to today, never before it or after today', () => {
    expect(recordDays(WEEK, ctx())).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']);
    expect(recordDays(WEEK, ctx({ since: '2026-10-07' }))).toEqual(['2026-10-07', '2026-10-08']);
    expect(recordDays(LAST, ctx({ since: '2026-10-07' }))).toEqual([]);
    expect(recordDays(WEEK, ctx({ since: undefined }))).toEqual([]);
  });
});

describe('stated measures: steps, water, sleep (B-15, D14)', () => {
  it('average over the days with a figure, not over the week or the days so far', () => {
    const s = dailyStats(WEEK, [fig('2026-10-05', 6000), fig('2026-10-07', 5000)], ctx(), 'stated');
    expect(s).toMatchObject({ sum: 11000, days: 2, perDay: 5500, recordDays: 4, high: { day: '2026-10-05', value: 6000 } });
  });

  it('a figure on an Away day is still a day with data, and the day is named', () => {
    const s = dailyStats(WEEK, [fig('2026-10-06', 3000)], ctx({ statusOn: awayOn('2026-10-06') }), 'stated');
    expect(s).toMatchObject({ days: 1, perDay: 3000, status: { away: 1 } });
  });

  it('counts the days whose figure is a lower bound', () => {
    const s = dailyStats(WEEK, [fig('2026-10-05', 7300, 'atLeast'), fig('2026-10-06', 4210, 'walks'), fig('2026-10-07', 5000, 'entered')], ctx(), 'stated');
    expect(s.partialDays).toBe(2);
  });
});

describe('counted measures: recorded movement (B-15, D25, K-49)', () => {
  it('a day of the record with nothing in it is a 0, and a day of data', () => {
    expect(dailyStats(WEEK, [fig('2026-10-05', 30)], ctx(), 'counted')).toMatchObject({ sum: 30, days: 4, perDay: 7.5 });
  });

  it('a status day is not a day of data, but what was recorded on it still counts', () => {
    const s = dailyStats(WEEK, [fig('2026-10-05', 30), fig('2026-10-06', 10)], ctx({ statusOn: awayOn('2026-10-06', '2026-10-07') }), 'counted');
    expect(s).toMatchObject({ sum: 40, days: 2, perDay: 20, status: { away: 2 } });
  });

  it('days before the first record are not zeros (Review Focus 4)', () => {
    const s = dailyStats(LAST, [], ctx({ since: '2026-10-07' }), 'counted');
    expect(s).toMatchObject({ sum: 0, days: 0, recordDays: 0 });
    expect(s.perDay).toBeUndefined();
  });
});

describe('the statistic each period states (B-15)', () => {
  it('counted: a total for Week and Month, a week on average for 6 Months, a month on average for Year; stated: a day on average', () => {
    expect(statisticFor('counted', 'week')).toBe('total');
    expect(statisticFor('counted', 'month')).toBe('total');
    expect(statisticFor('counted', 'sixMonths')).toBe('perWeek');
    expect(statisticFor('counted', 'year')).toBe('perMonth');
    expect(statisticFor('stated', 'week')).toBe('perDay');
    expect(statisticFor('stated', 'year')).toBe('perDay');
  });

  it('weights by the days of data', () => {
    const s = dailyStats(WEEK, [fig('2026-10-05', 30)], ctx(), 'counted');
    expect(figureOf(s, 'total')).toBe(30);
    expect(figureOf(s, 'perDay')).toBe(7.5);
    expect(figureOf(s, 'perWeek')).toBe(52.5);
    expect(figureOf(s, 'perMonth')).toBeCloseTo(7.5 * DAYS_PER_MONTH, 9);
  });

  it('a total exists for any window of the record, even an Away week with a walk in it; nothing before the record', () => {
    const away = dailyStats(WEEK, [fig('2026-10-06', 15)], ctx({ statusOn: () => 'away' }), 'counted');
    expect(figureOf(away, 'total')).toBe(15);
    expect(figureOf(away, 'perDay')).toBeUndefined();
    expect(figureOf(dailyStats(LAST, [], ctx({ since: '2026-10-07' }), 'counted'), 'total')).toBeUndefined();
  });
});

describe('daily comparisons (A-41, A-42)', () => {
  const cur = stated([['2026-10-05', 6000], ['2026-10-06', 7000], ['2026-10-07', 5500]]);
  const prev = stated([['2026-09-28', 5000], ['2026-09-29', 6000], ['2026-09-30', 5800], ['2026-10-01', 6200]]);

  it('need 3 days of data in both windows', () => {
    expect(MIN_DAYS).toBe(3);
    const two = stated([['2026-10-05', 6000], ['2026-10-06', 7000]]);
    expect(compareDaily(two, prev, 'perDay', 0)).toEqual({ shown: false, reason: 'fewDays' });
    expect(compareDaily(prev, two, 'perDay', 0)).toEqual({ shown: false, reason: 'fewDays' });
  });

  it('say higher or lower by the difference as shown', () => {
    expect(compareDaily(cur, prev, 'perDay', 0)).toEqual({ shown: true, direction: 'higher', difference: 417 });
    expect(compareDaily(prev, cur, 'perDay', 0)).toEqual({ shown: true, direction: 'lower', difference: 417 });
  });

  it('say the same when the figures shown are the same', () => {
    const a = stated([['2026-10-05', 5750.4], ['2026-10-06', 5750.4], ['2026-10-07', 5750.4]]);
    const b = stated([['2026-09-28', 5749.6], ['2026-09-29', 5749.6], ['2026-09-30', 5749.6]]);
    expect(compareDaily(a, b, 'perDay', 0)).toEqual({ shown: true, direction: 'same', difference: 0 });
  });
});

const read = (id: string, day: string, value: number, extra: Partial<ReadingPoint> = {}): ReadingPoint =>
  ({ id, day, at: `${day}T08:00:00+05:30`, value, series: 'beforeMeal', ...extra });
const meter = (day: string, display: 'HI' | 'LO'): MeterReading => ({ day, display });

describe('readings: spread, HI and LO, status days (A-43, A-44, K-11)', () => {
  it('state n, mean, range and the days with a number', () => {
    const s = readingStats(WEEK, [read('a', '2026-10-05', 118), read('b', '2026-10-06', 124), read('c', '2026-10-06', 168), read('d', '2026-09-30', 300)], [], ctx());
    expect(s).toMatchObject({ n: 3, min: 118, max: 168, days: 2, hi: 0, lo: 0 });
    expect(s.mean).toBeCloseTo(136.667, 3);
  });

  it('never average a meter’s HI or LO, and count them with the lows and highs', () => {
    const s = readingStats(WEEK, [read('a', '2026-10-05', 62, { low: true }), read('b', '2026-10-06', 280, { high: true })], [meter('2026-10-07', 'LO'), meter('2026-10-07', 'HI')], ctx());
    expect(s).toMatchObject({ n: 2, mean: 171, lows: 2, highs: 2, hi: 1, lo: 1, days: 2 });
  });

  it('a week with only a meter’s LO: no mean, no 0, no NaN, and no change (Review Focus 3)', () => {
    const s = readingStats(WEEK, [], [meter('2026-10-05', 'LO'), meter('2026-10-06', 'LO')], ctx());
    expect(s).toMatchObject({ n: 0, days: 0, lo: 2, lows: 2 });
    expect(s.mean).toBeUndefined();
    expect(JSON.stringify(s)).not.toMatch(/NaN|null/);
    const before = readingStats(LAST, [read('x', '2026-09-28', 120)], [], ctx());
    expect(compareReadings(s, before, 0)).toEqual({ shown: false, reason: 'meterLo' });
  });

  it('name the status days readings fell on, and leave none of them out', () => {
    const s = readingStats(WEEK, [read('a', '2026-10-05', 118), read('b', '2026-10-06', 124)], [], ctx({ statusOn: d => (d === '2026-10-06' ? 'unwell' : 'normal') }));
    expect(s).toMatchObject({ n: 2, status: { unwell: 1 } });
  });

  it('compare means with 3 days in both, hidden by a LO anywhere in either period', () => {
    const cur = readingStats(WEEK, [read('a', '2026-10-05', 118), read('b', '2026-10-06', 124), read('c', '2026-10-07', 112)], [], ctx());
    const prev = readingStats(LAST, [read('d', '2026-09-28', 120), read('e', '2026-09-29', 118), read('f', '2026-09-30', 122)], [], ctx());
    expect(compareReadings(cur, prev, 0)).toEqual({ shown: true, direction: 'lower', difference: 2 });
    expect(compareReadings(cur, prev, 0, 1)).toEqual({ shown: false, reason: 'meterLo' });
    const oneDay = readingStats(WEEK, [read('a', '2026-10-05', 118), read('b', '2026-10-05', 124)], [], ctx());
    expect(compareReadings(oneDay, prev, 0)).toEqual({ shown: false, reason: 'fewDays' });
  });
});

describe('labs: dated results with their intervals (A-45)', () => {
  it('list every result oldest first, each with how long after the one before', () => {
    const rows = labHistory([
      { id: 'c', day: '2026-10-07', value: 6.9, unit: '%' },
      { id: 'a', day: '2026-03-02', value: 7.4, unit: '%' },
      { id: 'b', day: '2026-06-02', value: 7.1, unit: '%' },
    ]);
    expect(rows.map(r => [r.day, r.interval])).toEqual([
      ['2026-03-02', 'First result'], ['2026-06-02', '3 months after the one before'], ['2026-10-07', '4 months after the one before'],
    ]);
  });

  it('say days under two months, and the same day', () => {
    expect(intervalText(undefined)).toBe('First result');
    expect(intervalText(0)).toBe('The same day as the one before');
    expect(intervalText(1)).toBe('1 day after the one before');
    expect(intervalText(12)).toBe('12 days after the one before');
  });
});

describe('the words for status days, and the day context', () => {
  it('name status days in a fixed order', () => {
    expect(statusList({ unwell: 2, away: 1 })).toBe('2 Unwell days and 1 Away day');
    expect(statusList({ flare: 1 })).toBe('1 Flare-up day');
    expect(statusList({ flare: 1, unwell: 1, away: 3 })).toBe('1 Flare-up day, 1 Unwell day and 3 Away days');
    expect(statusList({})).toBeUndefined();
  });

  it('marks planned rest days only for someone in the programme, from its start', () => {
    const c = dayContext({
      today: TODAY, since: '2026-09-01', restDays: ['tuesday', 'wednesday'], startDate: '2026-09-24',
      statusPeriods: [{ kind: 'away', from: '2026-10-07', to: '2026-10-07' }],
    });
    expect(c.restOn('2026-10-06')).toBe(true);    // a Tuesday
    expect(c.restOn('2026-10-05')).toBe(false);   // a Monday
    expect(c.restOn('2026-09-22')).toBe(false);   // a Tuesday before the start
    expect(c.statusOn('2026-10-07')).toBe('away');
    expect(dayContext({ today: TODAY, restDays: [], startDate: '' }).restOn('2026-10-06')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/screens/trends/stats.test.ts`
Expected: FAIL, "Cannot find module './stats'".

- [ ] **Step 3: Write the module** `src/screens/trends/stats.ts`

```ts
/**
 * The statistics a trend states (journey §12.2, B-15), by kind of measure:
 *
 * - `counted`: recorded movement (minutes of workouts, stretches, walks). The
 *   app records every activity it knows of, so a day of the record with
 *   nothing in it is a real 0, and a day of data. A status day (Away, Unwell,
 *   Flare-up) is shaded and isn't a day of data, though what was recorded on
 *   it still counts (D25, K-49).
 * - `stated`: steps, water and sleep, which the person enters. A day without
 *   a figure is "Not entered", never 0, and isn't a day of data (D14).
 * - readings: each numeric reading counts once, at its measured time. A
 *   meter's HI or LO has no number and is never averaged (K-11). Readings on
 *   status days are never left out, only named (A-43).
 *
 * A comparison needs 3 days of data in both windows, and a LO in either
 * window hides a readings change (B-15). Pure: the caller supplies the days.
 */
import type { DayRange } from '@/health/aggregate';
import { statusOn, weekdayOf, type Status } from '@/health/status';
import { daysBetween, daysIn } from '@/screens/track/periods';
import { roundTo } from '@/screens/track/units';
import type { DayOfWeek, StatusPeriod } from '@/types';
import type { TrendPeriod } from './periods';

export type StatusMark = Exclude<Status, 'normal'>;

export interface DayContext {
  today: string;
  /** The first day of the person's record. Absent: nothing recorded yet. */
  since?: string;
  statusOn: (day: string) => Status;
  /** A rest day in the programme's plan, shaded in movement charts. */
  restOn: (day: string) => boolean;
}

/** The day context from the settings: statuses, and the programme's rest days from its start. */
export function dayContext({ today, since, statusPeriods, restDays, startDate }: {
  today: string;
  since?: string;
  statusPeriods?: readonly StatusPeriod[];
  restDays: readonly DayOfWeek[];
  startDate: string;
}): DayContext {
  return {
    today,
    ...(since ? { since } : {}),
    statusOn: day => statusOn(statusPeriods, day),
    restOn: day => restDays.length > 0 && startDate !== '' && day >= startDate && restDays.includes(weekdayOf(day)),
  };
}

/** The days of `range` that are part of the record: from its first day to today. */
export function recordDays(range: DayRange, ctx: DayContext): string[] {
  if (!ctx.since) return [];
  const from = range.from > ctx.since ? range.from : ctx.since;
  const to = range.to < ctx.today ? range.to : ctx.today;
  return from > to ? [] : daysIn({ from, to });
}

/** One day's figure for a daily trend. */
export interface DayFigure {
  day: string;
  value: number;
  /** Steps (J§9.6): an entered total, FitStrong walks only, or at least the entered total plus walks after it. */
  basis?: 'entered' | 'walks' | 'atLeast';
  /** Where the figure came from, in words: "entered at 6:00 pm". */
  note?: string;
}

export type DailyRule = 'counted' | 'stated';

export interface DailyStats {
  /** Everything recorded on the record's days in the range, status days included. */
  sum: number;
  /** Days of data, by the rule. */
  days: number;
  /** Days of the record in the range. */
  recordDays: number;
  /** `sum ÷ days`; absent with no day of data. */
  perDay?: number;
  /** The highest day of data. */
  high?: { day: string; value: number };
  /** Status days in the range, by kind. */
  status: Partial<Record<StatusMark, number>>;
  /** Days whose figure is a lower bound: steps from walks only, or "at least". */
  partialDays: number;
}

export function dailyStats(range: DayRange, figures: readonly DayFigure[], ctx: DayContext, rule: DailyRule): DailyStats {
  const byDay = new Map(figures.map(f => [f.day, f]));
  const days = recordDays(range, ctx);
  const out: DailyStats = { sum: 0, days: 0, recordDays: days.length, status: {}, partialDays: 0 };
  for (const day of days) {
    const status = ctx.statusOn(day);
    if (status !== 'normal') out.status[status] = (out.status[status] ?? 0) + 1;
    const figure = byDay.get(day);
    if (figure) out.sum += figure.value;
    const isData = rule === 'counted' ? status === 'normal' : figure !== undefined;
    if (!isData) continue;
    out.days += 1;
    const value = figure?.value ?? 0;
    if (figure?.basis === 'walks' || figure?.basis === 'atLeast') out.partialDays += 1;
    if (!out.high || value > out.high.value) out.high = { day, value };
  }
  if (out.days > 0) out.perDay = out.sum / out.days;
  return out;
}

/** What a daily trend's headline states. */
export type Statistic = 'total' | 'perDay' | 'perWeek' | 'perMonth';

/** Days in an average month, so "a month on average" means the same in February and in March. */
export const DAYS_PER_MONTH = 365.25 / 12;

/** Counted: a total for Week and Month, then a week or a month on average. Stated: always a day on average (D68, D69). */
export function statisticFor(rule: DailyRule, period: TrendPeriod): Statistic {
  if (rule === 'stated') return 'perDay';
  return period === 'sixMonths' ? 'perWeek' : period === 'year' ? 'perMonth' : 'total';
}

/** The statistic's value: a total over the record's days; an average over the days of data. Nothing without them. */
export function figureOf(s: DailyStats, statistic: Statistic): number | undefined {
  if (statistic === 'total') return s.recordDays > 0 ? s.sum : undefined;
  if (s.perDay === undefined) return undefined;
  return statistic === 'perDay' ? s.perDay : statistic === 'perWeek' ? s.perDay * 7 : s.perDay * DAYS_PER_MONTH;
}

/** A comparison needs this many days of data in both windows (journey §12.2). */
export const MIN_DAYS = 3;

export type Direction = 'higher' | 'lower' | 'same';

export type Comparison =
  | { shown: true; direction: Direction; difference: number }
  | { shown: false; reason: 'fewDays' | 'meterLo' };

/** The change as shown: both figures rounded as the screen shows them, so "the same" is the same on screen. */
export function change(current: number, previous: number, decimals: number): Comparison {
  const difference = roundTo(roundTo(current, decimals) - roundTo(previous, decimals), decimals);
  return { shown: true, direction: difference > 0 ? 'higher' : difference < 0 ? 'lower' : 'same', difference: Math.abs(difference) };
}

export function compareDaily(current: DailyStats, previous: DailyStats, statistic: Statistic, decimals: number): Comparison {
  const a = figureOf(current, statistic);
  const b = figureOf(previous, statistic);
  if (current.days < MIN_DAYS || previous.days < MIN_DAYS || a === undefined || b === undefined) return { shown: false, reason: 'fewDays' };
  return change(a, b, decimals);
}

/** One numeric reading, in the display unit. */
export interface ReadingPoint {
  id: string;
  day: string;
  at: string;
  value: number;
  /** The series it belongs to: a glucose context, a blood-pressure number, back or leg. */
  series: string;
  /** Past the low or the high line (glucose: under 70 or over 250 mg/dL). */
  low?: true;
  high?: true;
}

/** A meter's HI or LO: no number, so never averaged (K-11). */
export interface MeterReading {
  day: string;
  at?: string;
  display: 'HI' | 'LO';
}

export interface ReadingStats {
  /** Numeric readings. */
  n: number;
  mean?: number;
  min?: number;
  max?: number;
  /** Days with a numeric reading: what a comparison's 3 days count. */
  days: number;
  hi: number;
  lo: number;
  /** Numeric readings past the lines, with the meter's LO and HI, which are past them by definition. */
  lows: number;
  highs: number;
  /** Status days among the days with readings: named, never left out (A-43). */
  status: Partial<Record<StatusMark, number>>;
}

export function readingStats(range: DayRange, points: readonly ReadingPoint[], meters: readonly MeterReading[], ctx: DayContext): ReadingStats {
  const inside = (day: string) => day >= range.from && day <= range.to;
  let n = 0;
  let total = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let lows = 0;
  let highs = 0;
  const numericDays = new Set<string>();
  const seen = new Set<string>();
  // Loops, not Math.min(...values): a year of sensor readings would overflow the call stack.
  for (const p of points) {
    if (!inside(p.day)) continue;
    n += 1;
    total += p.value;
    if (p.value < min) min = p.value;
    if (p.value > max) max = p.value;
    if (p.low) lows += 1;
    if (p.high) highs += 1;
    numericDays.add(p.day);
    seen.add(p.day);
  }
  let hi = 0;
  let lo = 0;
  for (const m of meters) {
    if (!inside(m.day)) continue;
    if (m.display === 'HI') hi += 1;
    else lo += 1;
    seen.add(m.day);
  }
  const status: Partial<Record<StatusMark, number>> = {};
  for (const day of seen) {
    const s = ctx.statusOn(day);
    if (s !== 'normal') status[s] = (status[s] ?? 0) + 1;
  }
  return { n, ...(n > 0 ? { mean: total / n, min, max } : {}), days: numericDays.size, hi, lo, lows: lows + lo, highs: highs + hi, status };
}

/**
 * Means compared, with 3 days with a number in both windows. A LO in either
 * period hides it, because the average would leave the lowest reading out
 * (K-11, B-15): `otherLo` counts LOs in the periods outside the compared days.
 */
export function compareReadings(current: ReadingStats, previous: ReadingStats, decimals: number, otherLo = 0): Comparison {
  if (current.lo + previous.lo + otherLo > 0) return { shown: false, reason: 'meterLo' };
  if (current.days < MIN_DAYS || previous.days < MIN_DAYS || current.mean === undefined || previous.mean === undefined) {
    return { shown: false, reason: 'fewDays' };
  }
  return change(current.mean, previous.mean, decimals);
}

/** One lab result, in the display unit. */
export interface LabPoint {
  id: string;
  day: string;
  value: number;
  unit: string;
}

export interface LabRow extends LabPoint {
  interval: string;
}

/** "First result", "12 days after the one before", "4 months after the one before". */
export function intervalText(days: number | undefined): string {
  if (days === undefined) return 'First result';
  if (days === 0) return 'The same day as the one before';
  if (days < 60) return `${days} ${days === 1 ? 'day' : 'days'} after the one before`;
  return `${Math.round(days / DAYS_PER_MONTH)} months after the one before`;
}

/** Every result, oldest first, with how long after the one before it came (A-45). No 7-day rule applies. */
export function labHistory(points: readonly LabPoint[]): LabRow[] {
  const sorted = [...points].sort((a, b) => a.day.localeCompare(b.day) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return sorted.map((p, i) => ({ ...p, interval: intervalText(i === 0 ? undefined : daysBetween(sorted[i - 1].day, p.day)) }));
}

const STATUS_WORDS: Record<StatusMark, [string, string]> = {
  flare: ['Flare-up day', 'Flare-up days'],
  unwell: ['Unwell day', 'Unwell days'],
  away: ['Away day', 'Away days'],
};

/** "2 Unwell days and 1 Away day", in a fixed order; nothing for none. */
export function statusList(status: Partial<Record<StatusMark, number>>): string | undefined {
  const parts = (['flare', 'unwell', 'away'] as const)
    .filter(k => (status[k] ?? 0) > 0)
    .map(k => `${status[k]} ${STATUS_WORDS[k][status[k] === 1 ? 0 : 1]}`);
  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/screens/trends/stats.test.ts`
Expected: PASS.

- [ ] **Step 5: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/trends/stats.ts src/screens/trends/stats.test.ts
git commit -m "feat: Define Trends' statistics, weighting and comparisons per kind of measure"
```

---

### Task 4: What counts

**Files:**
- Create: `src/screens/trends/records.ts`
- Create: `src/screens/trends/records.test.ts`
- Modify: `src/screens/home/week.ts` (`stretchDays` counts a session's mobility block)
- Modify: `src/screens/home/week.test.ts`

**Interfaces:**
- Consumes:
  - `series` and `type DayRange` from `@/health/aggregate`; `nowAt` and `type Observation` from `@/health/observation`;
  - `activitiesFrom` from `@/health/recommend`; `type Mode` from `@/engine/permission`;
  - `walkRecords` from `@/walk/record`; `addDays` from `@/screens/track/periods`; `type DisplayPrefs` from `@/screens/track/format`;
  - Plan 2's `stepsDayFigure` (`@/screens/track/stepsDay`) and `movementHistory`, `type HistoryRow` (`@/screens/hub/week`);
  - `type DayFigure`, `type MeterReading` (Task 3).
- Produces:
  - `interface TrendData { observations: readonly Observation[]; sessions: readonly WorkoutSession[]; checkIns: readonly CheckInRecord[] }`;
  - `firstRecordDay(data: TrendData): string | undefined`;
  - `sessionsOf(mode: 'programme' | 'stretch', sessions: readonly WorkoutSession[]): WorkoutSession[]`;
  - `sessionMinutes(sessions: readonly WorkoutSession[], range: DayRange): DayFigure[]`;
  - `stretchedDays(sessions: readonly WorkoutSession[]): Set<string>`;
  - `walkFigures(kind: 'walkDuration' | 'walkDistance', range: DayRange, observations: readonly Observation[]): DayFigure[]`;
  - `dayTotals(kind: 'water' | 'sleep', range: DayRange, observations: readonly Observation[]): DayFigure[]`;
  - `stepsDays(range: DayRange, observations: readonly Observation[], hour12: boolean): DayFigure[]`;
  - `meterReadings(checkIns: readonly CheckInRecord[]): MeterReading[]`;
  - `interface ActivityRow extends HistoryRow { kind: 'workout' | 'stretch' | 'walk'; day: string; heading: string }`;
  - `activities(data: TrendData, prefs: DisplayPrefs, current: string): ActivityRow[]`.

- [ ] **Step 1: Write the failing test** `src/screens/trends/records.test.ts`

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { WorkoutSession } from '@/types';
import type { CheckInRecord } from '@/types/checkin';
import { newObservation } from '@/health/observation';
import { DEFAULT_PREFS } from '@/screens/track/format';
import {
  activities, dayTotals, firstRecordDay, meterReadings, sessionMinutes, sessionsOf, stepsDays, stretchedDays, walkFigures,
} from './records';

// A meter's display is placed on this device's clock (`nowAt`), so the zone is pinned, as review.test.ts does.
const zone = process.env.TZ;
beforeAll(() => { process.env.TZ = 'Asia/Kolkata'; });
afterAll(() => { if (zone === undefined) delete process.env.TZ; else process.env.TZ = zone; });

// Thursday 8 October 2026; this week is Monday 5 to Sunday 11 October.
const TODAY = '2026-10-08';
const RANGE = { from: '2026-10-05', to: '2026-10-11' };
let n = 0;
function session(date: string, over: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: `s${++n}`, date, dayOfWeek: 'monday', muscleGroup: 'fullBody', phase: 'foundation', week: 3, status: 'completed', sets: [],
    startedAt: `${date}T07:30:00+05:30`, completedAt: `${date}T08:15:00+05:30`, notes: '', totalVolume: 0, guided: true,
    planKind: 'full', durationSeconds: 2700, ...over,
  };
}
const total = (kind: 'water' | 'steps', value: number, at: string) => newObservation({ kind, value, at, scope: 'dayTotal', source: 'manual' });
const walk = (id: string, at: string, minutes: number, steps?: number) => [
  newObservation({ kind: 'walkDuration', value: minutes, at, scope: 'sessionObserved', source: 'measured', coverageMs: minutes * 60_000, context: `walk:${id}` }),
  ...(steps === undefined ? [] : [newObservation({ kind: 'steps', value: steps, at, scope: 'sessionObserved', source: 'measured', coverageMs: minutes * 60_000, context: `walk:${id}` })]),
];

describe('the record’s first day (J§12.2, early days)', () => {
  it('is the earliest day of any record, or nothing', () => {
    const data = { observations: [total('water', 500, '2026-10-02T09:00:00+05:30')], sessions: [session('2026-09-30')], checkIns: [{ date: '2026-10-01' } as CheckInRecord] };
    expect(firstRecordDay(data)).toBe('2026-09-30');
    expect(firstRecordDay({ observations: [], sessions: [], checkIns: [] })).toBeUndefined();
  });
});

describe('sessions by kind, and their minutes (J§12.3)', () => {
  it('tells programme sessions from stretches, and leaves out skipped runs and a rest day’s optional mobility', () => {
    const full = session('2026-10-05');
    const stretch = session('2026-10-06', { planKind: 'stretch' });
    const skipped = session('2026-10-07', { status: 'skipped' });
    const rest = session('2026-10-08', { planKind: 'restDay' });
    const logged = session('2026-10-08', { guided: false, planKind: undefined, durationSeconds: 1800 });
    const all = [full, stretch, skipped, rest, logged];
    expect(sessionsOf('programme', all).map(s => s.id)).toEqual([full.id, logged.id]);
    expect(sessionsOf('stretch', all).map(s => s.id)).toEqual([stretch.id]);
  });

  it('adds each day’s active minutes as the sessions recorded them; a safety-stopped run keeps its partial minutes', () => {
    const a = session('2026-10-05', { durationSeconds: 1800 });
    const b = session('2026-10-05', { status: 'partial', durationSeconds: 900 });
    const later = session('2026-10-12', { durationSeconds: 600 });
    const untimed = session('2026-10-06', { durationSeconds: undefined });
    expect(sessionMinutes([a, b, later, untimed], RANGE)).toEqual([{ day: '2026-10-05', value: 45 }]);
  });

  it('a day stretched is a stretch routine, or any session whose mobility block was done (§12.3)', () => {
    const sessions = [
      session('2026-10-05', { planKind: 'stretch' }),
      session('2026-10-06', { mobility: [{ exerciseId: 'cat-cow', seconds: 60 }] }),
      session('2026-10-07', { mobility: [{ exerciseId: 'cat-cow', seconds: 0 }] }),
      session('2026-10-08', { status: 'skipped', mobility: [{ exerciseId: 'cat-cow', seconds: 60 }] }),
      session('2026-10-09', { planKind: 'restDay', status: 'partial', mobility: [{ exerciseId: 'cat-cow', seconds: 30 }] }),
    ];
    expect([...stretchedDays(sessions)].sort()).toEqual(['2026-10-05', '2026-10-06', '2026-10-09']);
  });
});

describe('walking and day totals, through v1’s aggregation (D10, F17)', () => {
  it('counts walking minutes once where two records overlap, each on its own day', () => {
    const figures = walkFigures('walkDuration', RANGE, [...walk('a', '2026-10-05T18:00:00+05:30', 20), ...walk('b', '2026-10-05T18:10:00+05:30', 15), ...walk('c', '2026-10-06T07:00:00+05:30', 30)]);
    expect(figures).toEqual([{ day: '2026-10-05', value: 20 }, { day: '2026-10-06', value: 30 }]);
  });

  it('a day total entered twice counts once: the later statement (Review Focus 2)', () => {
    const first = total('water', 1000, '2026-10-05T12:00:00+05:30');
    const later = total('water', 1750, '2026-10-05T20:00:00+05:30');
    expect(dayTotals('water', RANGE, [first, later])).toEqual([{ day: '2026-10-05', value: 1750 }]);
  });
});

describe('the day’s steps, as Plan 2 says them (J§9.6)', () => {
  const day = TODAY;
  it('a figure only for the days with steps, each with where it came from', () => {
    const obs = [total('steps', 6050, `${day}T18:00:00.000+05:30`), ...walk('a', '2026-10-06T07:40:00.000+05:30', 20, 4210)];
    expect(stepsDays(RANGE, obs, true)).toEqual([
      { day: '2026-10-06', value: 4210, basis: 'walks', note: 'in FitStrong walks · day total not entered' },
      { day, value: 6050, basis: 'entered', note: 'entered at 6:00 pm' },
    ]);
  });

  it('at least the total plus the walks after it, with both sources (V-J26)', () => {
    const obs = [total('steps', 6050, `${day}T12:05:00.000+05:30`), ...walk('a', `${day}T15:00:00.000+05:30`, 20, 1250)];
    expect(stepsDays(RANGE, obs, true)).toEqual([
      { day, value: 7300, basis: 'atLeast', note: '6,050 entered at 12:05 pm + 1,250 in walks after 12:05 pm' },
    ]);
  });

  it('a later total replaces the earlier one, and is added to nothing (Review Focus 2)', () => {
    const obs = [total('steps', 6050, `${day}T12:05:00.000+05:30`), ...walk('a', `${day}T15:00:00.000+05:30`, 20, 1250), total('steps', 9800, `${day}T21:00:00.000+05:30`)];
    expect(stepsDays(RANGE, obs, true)).toEqual([{ day, value: 9800, basis: 'entered', note: 'entered at 9:00 pm' }]);
  });

  it('a walk the evening before the range is no figure inside it', () => {
    expect(stepsDays(RANGE, walk('a', '2026-10-04T21:00:00.000+05:30', 20, 3000), true)).toEqual([]);
  });
});

describe('a meter’s HI and LO, from the check-ins (K-11)', () => {
  it('once each, on the day measured; the numbers are the observations’, not here', () => {
    const c = {
      date: '2026-10-07',
      glucose: { value: 140, unit: 'mg/dL', measuredAt: '2026-10-07T09:20:00+05:30' },
      glucoseDisplay: { display: 'HI', measuredAt: '2026-10-07T09:10:00+05:30' },
      glucoseEarlier: [{ display: 'LO', measuredAt: '2026-10-07T03:30:00.000Z' }, { value: 60, unit: 'mg/dL' }, { display: 'HI', measuredAt: '2026-10-07T09:10:00+05:30' }],
    } as unknown as CheckInRecord;
    const untimed = { date: '2026-10-06', glucoseDisplay: { display: 'LO' } } as unknown as CheckInRecord;
    expect(meterReadings([c, untimed]).map(m => [m.day, m.display])).toEqual([['2026-10-07', 'LO'], ['2026-10-07', 'HI'], ['2026-10-06', 'LO']]);
  });
});

describe('recent workouts, stretches and walks (J§12.1)', () => {
  it('merges the three, newest first, each with its own day and a heading for a mixed list', () => {
    const data = {
      observations: walk('w-1', '2026-10-07T18:00:00+05:30', 25),
      sessions: [session('2026-10-05'), session('2026-10-06', { planKind: 'stretch', durationSeconds: 600, startedAt: '2026-10-06T07:00:00+05:30' })],
      checkIns: [],
    };
    const rows = activities(data, DEFAULT_PREFS, TODAY);
    expect(rows.map(r => [r.kind, r.day])).toEqual([['walk', '2026-10-07'], ['stretch', '2026-10-06'], ['workout', '2026-10-05']]);
    expect(rows[0].heading).toBe(`Walk · ${rows[0].label}`);
    expect(rows[0].ref).toEqual({ type: 'walk', id: 'w-1' });
  });
});
```

The `LO` measured at `03:30Z` is 09:00 on 7 October in India: a time kept in UTC still lands on its local day.

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/screens/trends/records.test.ts`
Expected: FAIL, "Cannot find module './records'".

- [ ] **Step 3: Write the module** `src/screens/trends/records.ts`

```ts
/**
 * What counts in Trends (journey §12.3, A-40). Every figure is read through
 * v1's typed aggregation and its overlap rules (D10, F17, F19), or through
 * Plan 2's own readings of a day's steps and of a hub's history, so a figure
 * here is the figure Home, the hubs and Today's log show.
 */
import type { Mode } from '@/engine/permission';
import { series, type DayRange } from '@/health/aggregate';
import { nowAt, type Observation } from '@/health/observation';
import { activitiesFrom } from '@/health/recommend';
import { movementHistory, type HistoryRow } from '@/screens/hub/week';
import type { DisplayPrefs } from '@/screens/track/format';
import { addDays } from '@/screens/track/periods';
import { stepsDayFigure } from '@/screens/track/stepsDay';
import type { WorkoutSession } from '@/types';
import type { CheckInRecord } from '@/types/checkin';
import { walkRecords } from '@/walk/record';
import type { DayFigure, MeterReading } from './stats';

export interface TrendData {
  observations: readonly Observation[];
  sessions: readonly WorkoutSession[];
  checkIns: readonly CheckInRecord[];
}

/** The first day anything was recorded (J§12.2, early days): nothing before it is a day of the record. */
export function firstRecordDay({ observations, sessions, checkIns }: TrendData): string | undefined {
  let first: string | undefined;
  const see = (day: string | undefined) => {
    if (typeof day === 'string' && (first === undefined || day < first)) first = day;
  };
  for (const o of observations) see(o.day);
  for (const s of sessions) see(s.date);
  for (const c of checkIns) see(c.date);
  return first;
}

const did = (s: WorkoutSession) => s.status === 'completed' || s.status === 'partial';

/** Programme sessions or stretches with work in them, as the recommendation counts them (`activitiesFrom`). */
export function sessionsOf(mode: 'programme' | 'stretch', sessions: readonly WorkoutSession[]): WorkoutSession[] {
  const ids = new Set(activitiesFrom(sessions, []).filter(a => a.mode === mode).map(a => a.id));
  return sessions.filter(s => ids.has(`session:${s.id}`));
}

/**
 * Each day's active minutes, as the sessions recorded them (`durationSeconds`,
 * pauses excluded, the figure `sessionInterval` places): a category's own
 * time. A stopped session keeps its partial minutes (§12.3). The week's
 * recorded movement across categories, overlaps resolved (F19), is
 * `recordedMovement`'s, as Home's ring and Your week say it.
 */
export function sessionMinutes(sessions: readonly WorkoutSession[], range: DayRange): DayFigure[] {
  const byDay = new Map<string, number>();
  for (const s of sessions) {
    if (s.date < range.from || s.date > range.to) continue;
    const seconds = s.durationSeconds;
    if (typeof seconds !== 'number' || !(seconds > 0)) continue;
    byDay.set(s.date, (byDay.get(s.date) ?? 0) + seconds / 60);
  }
  return [...byDay].sort(([a], [b]) => (a < b ? -1 : 1)).map(([day, value]) => ({ day, value }));
}

/** §12.3: the days with a stretch routine, or with any session whose mobility block was done. */
export function stretchedDays(sessions: readonly WorkoutSession[]): Set<string> {
  const out = new Set(sessionsOf('stretch', sessions).map(s => s.date));
  for (const s of sessions) if (did(s) && s.mobility?.some(m => m.seconds > 0)) out.add(s.date);
  return out;
}

/** Walking time or distance by day: overlapping walks once, the first kept, each on the day it started (D10, F17). */
export function walkFigures(kind: 'walkDuration' | 'walkDistance', range: DayRange, observations: readonly Observation[]): DayFigure[] {
  return series(kind, range, observations).points.filter(p => p.scope === 'sessionObserved').map(p => ({ day: p.day, value: p.value }));
}

/** A day total (water, sleep) by day: the statement that counts, by the replace rule (D10). */
export function dayTotals(kind: 'water' | 'sleep', range: DayRange, observations: readonly Observation[]): DayFigure[] {
  return series(kind, range, observations).points.filter(p => p.scope === 'dayTotal').map(p => ({ day: p.day, value: p.value }));
}

/**
 * The days of `range` with steps, each as Plan 2's `stepsDayFigure` says it
 * (J§9.6): an entered total, FitStrong walks only, or at least the total
 * plus the walks after it. Only the steps and the walks near the range are
 * read, from the day before (a walk past midnight), so a year of days stays
 * quick.
 */
export function stepsDays(range: DayRange, observations: readonly Observation[], hour12: boolean): DayFigure[] {
  const from = addDays(range.from, -1);
  const near = observations.filter(o => o.day >= from && o.day <= range.to && (o.kind === 'steps' || (o.context?.startsWith('walk:') ?? false)));
  const days = [...new Set(near.filter(o => o.kind === 'steps' && o.day >= range.from).map(o => o.day))].sort();
  return days.flatMap((day): DayFigure[] => {
    const f = stepsDayFigure(day, near, hour12);
    if (f.kind === 'none' || f.steps === undefined) return [];
    return [{ day, value: f.steps, basis: f.kind, note: f.source }];
  });
}

/**
 * A meter's HI and LO, from the check-ins: the only place they are kept,
 * because they have no number (K-11). Each once, on the local day it was
 * measured, or the check-in's day when no time was kept.
 */
export function meterReadings(checkIns: readonly CheckInRecord[]): MeterReading[] {
  const out: MeterReading[] = [];
  for (const c of checkIns) {
    const seen = new Set<string>();
    const entries = [...(Array.isArray(c.glucoseEarlier) ? c.glucoseEarlier : []), ...(c.glucoseDisplay ? [c.glucoseDisplay] : [])];
    for (const e of entries) {
      if (!('display' in e) || (e.display !== 'HI' && e.display !== 'LO')) continue;
      const ms = typeof e.measuredAt === 'string' ? Date.parse(e.measuredAt) : Number.NaN;
      const at = Number.isFinite(ms) ? nowAt(new Date(ms)) : undefined;
      const key = `${e.display}|${at ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ day: at ? at.slice(0, 10) : c.date, ...(at ? { at } : {}), display: e.display });
    }
  }
  return out;
}

export interface ActivityRow extends HistoryRow {
  kind: 'workout' | 'stretch' | 'walk';
  /** The day it counts on: a session's recorded day, or a walk's first. */
  day: string;
  /** What a mixed list calls it: the session's name, or "Walk · 25 min". */
  heading: string;
}

const KINDS: readonly [ActivityRow['kind'], Mode][] = [['workout', 'guided'], ['stretch', 'stretch'], ['walk', 'walk']];

/** Workouts, stretches and walks, newest first, each as its hub's history shows it (Plan 2's `movementHistory`). */
export function activities(data: TrendData, prefs: DisplayPrefs, current: string): ActivityRow[] {
  const sessionDay = new Map(data.sessions.map(s => [`session:${s.id}`, s.date]));
  const walkDay = new Map(walkRecords(data.observations).map(w => [`walk:${w.id}`, w.day]));
  return KINDS.flatMap(([kind, mode]) => movementHistory(mode, data.sessions, data.observations, prefs, current).map((r): ActivityRow => ({
    ...r,
    kind,
    day: sessionDay.get(r.key) ?? walkDay.get(r.key) ?? r.at.slice(0, 10),
    heading: kind === 'walk' ? `Walk · ${r.label}` : r.label,
  }))).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/screens/trends/records.test.ts`
Expected: PASS.

If the steps cases fail on the wording of a source ("entered at 6:00 pm"), Plan 2's `stepsDayFigure` has changed its words. Take its current words into these expectations, since Home and the Steps hub say the same. Don't change `stepsDayFigure`.

- [ ] **Step 5: Home counts stretch days the same way (§12.3, D72).** In `src/screens/home/week.ts`, import `stretchedDays` from `@/screens/trends/records`, and replace `stretchDays`:

```ts
/**
 * The days this week with a stretch done, or a session whose mobility block
 * was done (journey §12.3): the count Trends gives, so the two never disagree.
 */
export function stretchDays(today: string, sessions: readonly WorkoutSession[]): number {
  const { from, to } = weekOf(today);
  return [...stretchedDays(sessions)].filter(d => d >= from && d <= to).length;
}
```

Drop `activitiesFrom` from `week.ts`'s imports if nothing else there uses it. In `src/screens/home/week.test.ts`, inside `describe('Stretched days', …)`, add:

```ts
  it('counts a session whose mobility block was done as a day stretched (journey §12.3)', () => {
    const withBlock = session('2026-10-06', { planKind: 'full', muscleGroup: 'lower', mobility: [{ exerciseId: 'cat-cow', seconds: 60 }] });
    expect(stretchDays(TODAY, [withBlock])).toBe(1);
  });
```

The existing case still gives 2: none of its sessions has a mobility block.

- [ ] **Step 6: Gates and commit**

```bash
npx vitest run src/screens/trends/records.test.ts src/screens/home/week.test.ts
npx tsc -b && npm run lint && npx vitest run
git add src/screens/trends/records.ts src/screens/trends/records.test.ts src/screens/home/week.ts src/screens/home/week.test.ts
git commit -m "feat: Count what Trends counts through the shared aggregation, stretch days included"
```

---

### Task 5: A trend for each category

**Files:**
- Create: `src/screens/trends/metrics.ts`
- Create: `src/screens/trends/metrics.test.ts`

**Interfaces:**
- Consumes:
  - `CATEGORIES`, `categoryById` from `@/categories`; `pairBloodPressure` and `type DayRange` from `@/health/aggregate`;
  - `type Observation`, `type ObservationKind` from `@/health/observation`;
  - `HYPO_LEVEL_1_MGDL`, `glucoseFlag`, `pressureFlag` from `@/screens/track/escalation` (the words v1's lists give a low or an extreme reading);
  - `formatClock`, `hasClockTime`, `inDisplayUnit`, `shownDecimals`, `tagLabel`, `unitLabel`, `type DisplayPrefs` from `@/screens/track/format`;
  - `type LabKind` from `@/screens/track/logKinds`; `glucoseGroup` from `@/screens/track/targets`; `formatPressure` from `@/screens/track/timeline`;
  - `decimalsFor`, `formatNumber`, `glucoseMgdl`, `roundTo`, `type GlucoseUnit` from `@/screens/track/units`;
  - Task 4's `TrendData`, `dayTotals`, `meterReadings`, `sessionMinutes`, `sessionsOf`, `stepsDays`, `stretchedDays`, `walkFigures`;
  - Task 3's `DayFigure`, `LabPoint`, `MeterReading`, `ReadingPoint`.
- Produces:
  - `type TrendId = 'workout' | 'stretch' | 'walk' | 'steps' | 'glucose' | 'bp' | 'back' | 'weight' | 'water' | 'sleep' | 'waist' | 'labs' | 'mood'`;
  - `type Family = 'counted' | 'stated' | 'readings' | 'labs'`;
  - `type Shape = 'circle' | 'square' | 'triangle'`;
  - `interface TrendDef { id: TrendId; title: string; family: Family; movement: boolean; colour: string; unit(prefs: DisplayPrefs): string; decimals(prefs: DisplayPrefs): number; per: 'day' | 'night'; coverage: [string, string]; hub?: string }`;
  - `TRENDS: Record<TrendId, TrendDef>`, `TREND_ORDER: readonly TrendId[]`, `trendDef(id: string | undefined): TrendDef | undefined`;
  - `HIGH_GLUCOSE_MGDL = 250`, `GLUCOSE_LINES: Record<GlucoseUnit, { low: string; high: string }>`;
  - `interface SeriesInfo { id: string; label: string; shape: Shape }`, `interface ReadingText { day: string; at: string; text: string; note?: string }`;
  - `interface Readings { points: ReadingPoint[]; meters: MeterReading[]; series: SeriesInfo[]; texts: ReadingText[] }`;
  - `readingsFor(id: TrendId, range: DayRange, data: TrendData, prefs: DisplayPrefs): Readings`;
  - `figuresFor(id: TrendId, range: DayRange, data: TrendData, prefs: DisplayPrefs): DayFigure[]`;
  - `labPoints(lab: LabKind, observations: readonly Observation[], prefs: DisplayPrefs): LabPoint[]`;
  - `hasData(id: TrendId, data: TrendData): boolean`.

- [ ] **Step 1: Write the failing test** `src/screens/trends/metrics.test.ts`

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { WorkoutSession } from '@/types';
import type { CheckInRecord } from '@/types/checkin';
import { CATEGORIES } from '@/categories';
import { bpContext, newObservation, type Observation } from '@/health/observation';
import { DEFAULT_PREFS } from '@/screens/track/format';
import { TREND_ORDER, figuresFor, hasData, labPoints, readingsFor, trendDef } from './metrics';

// A meter's display is placed on this device's clock (`nowAt`), so the zone is pinned.
const zone = process.env.TZ;
beforeAll(() => { process.env.TZ = 'Asia/Kolkata'; });
afterAll(() => { if (zone === undefined) delete process.env.TZ; else process.env.TZ = zone; });

const RANGE = { from: '2026-10-05', to: '2026-10-11' };
const prefs = { ...DEFAULT_PREFS, hour12: true };
const data = (observations: Observation[], sessions: WorkoutSession[] = [], checkIns: CheckInRecord[] = []) => ({ observations, sessions, checkIns });
const g = (value: number, unit: 'mg/dL' | 'mmol/L', at: string, tag?: 'fasting' | 'afterMeal') =>
  newObservation({ kind: 'glucose', value, unit, at, scope: 'pointInTime', source: 'manual', ...(tag ? { tag } : {}) });

describe('a trend for each category that declares one (B-14)', () => {
  it('every category’s trend address has a trend here, but Food’s, which Plan 7 builds; Learn declares none; Mood is extra', () => {
    for (const c of CATEGORIES) {
      if (c.id === 'food') {
        expect(trendDef('food')).toBeUndefined();
        continue;
      }
      if (c.trend === undefined) {
        expect(c.id).toBe('learn');
        continue;
      }
      expect(trendDef(c.id)?.id, c.id).toBe(c.id);
      expect(c.trend).toBe(`/trends/${c.id}`);
    }
    expect(TREND_ORDER).toEqual(['workout', 'stretch', 'walk', 'steps', 'glucose', 'bp', 'back', 'weight', 'water', 'sleep', 'waist', 'labs', 'mood']);
  });

  it('finds a trend by its address id, and nothing for anything else', () => {
    expect(trendDef('steps')).toMatchObject({ title: 'Steps', family: 'stated', movement: true });
    expect(trendDef('glucose')).toMatchObject({ family: 'readings', movement: false });
    expect(trendDef('walk')).toMatchObject({ family: 'counted', movement: true });
    for (const id of ['food', 'learn', 'nope', 'constructor', undefined]) expect(trendDef(id), String(id)).toBeUndefined();
  });
});

describe('readings in the person’s own unit (Review Focus 1)', () => {
  const both = data([g(112, 'mg/dL', '2026-10-05T07:30:00+05:30', 'fasting'), g(7, 'mmol/L', '2026-10-06T07:30:00+05:30', 'fasting'), g(3.5, 'mmol/L', '2026-10-07T07:30:00+05:30', 'fasting')]);

  it('converts every reading to the unit shown, whatever it was stored in', () => {
    expect(readingsFor('glucose', RANGE, both, { ...prefs, glucose: 'mg/dL' }).points.map(p => p.value)).toEqual([112, 126, 63]);
    expect(readingsFor('glucose', RANGE, both, { ...prefs, glucose: 'mmol/L' }).points.map(p => p.value)).toEqual([6.2, 7, 3.5]);
  });

  it('judges low and high on the reading itself, in either unit', () => {
    const points = readingsFor('glucose', RANGE, both, { ...prefs, glucose: 'mmol/L' }).points;
    expect(points.map(p => p.low === true)).toEqual([false, false, true]);
    const high = readingsFor('glucose', RANGE, data([g(15, 'mmol/L', '2026-10-05T09:00:00+05:30')]), prefs).points[0];
    expect(high.high).toBe(true);
  });

  it('says each reading with its time and context, and names a low', () => {
    const texts = readingsFor('glucose', RANGE, both, { ...prefs, glucose: 'mg/dL' }).texts;
    expect(texts.map(t => [t.text, t.note])).toEqual([
      ['112 mg/dL at 7:30 am, fasting', undefined], ['126 mg/dL at 7:30 am, fasting', undefined], ['63 mg/dL at 7:30 am, fasting', 'Low'],
    ]);
  });
});

describe('glucose by context, with a meter’s HI and LO', () => {
  it('a series for each context present, in a fixed order, and the meter’s displays beside them', () => {
    const obs = [g(168, 'mg/dL', '2026-10-06T14:10:00+05:30', 'afterMeal'), g(118, 'mg/dL', '2026-10-05T07:30:00+05:30', 'fasting')];
    const lo = { date: '2026-10-07', glucoseDisplay: { display: 'LO', measuredAt: '2026-10-07T13:00:00+05:30' } } as unknown as CheckInRecord;
    const r = readingsFor('glucose', RANGE, data(obs, [], [lo]), prefs);
    expect(r.series.map(s => [s.id, s.label, s.shape])).toEqual([['beforeMeal', 'Fasting or before a meal', 'circle'], ['afterMeal', 'After a meal', 'triangle']]);
    expect(r.meters).toEqual([{ day: '2026-10-07', at: '2026-10-07T13:00:00.000+05:30', display: 'LO' }]);
    expect(r.texts.at(-1)).toEqual({ day: '2026-10-07', at: '2026-10-07T13:00:00.000+05:30', text: 'Meter showed LO at 1:00 pm', note: 'Below what the meter can show' });
  });
});

describe('blood pressure: two numbers in one reading', () => {
  const half = (kind: 'bloodPressureSystolic' | 'bloodPressureDiastolic', value: number, at: string, id: string) =>
    newObservation({ kind, value, at, scope: 'pointInTime', source: 'manual', context: bpContext(id) });
  it('each number in its own series; a half with no partner keeps its number; a very high reading is named', () => {
    const obs = [
      half('bloodPressureSystolic', 132, '2026-10-05T07:30:00+05:30', 'r1'), half('bloodPressureDiastolic', 84, '2026-10-05T07:30:00+05:30', 'r1'),
      half('bloodPressureSystolic', 184, '2026-10-06T07:30:00+05:30', 'r2'), half('bloodPressureDiastolic', 96, '2026-10-06T07:30:00+05:30', 'r2'),
      half('bloodPressureSystolic', 128, '2026-10-07T07:30:00+05:30', 'r3'),
    ];
    const r = readingsFor('bp', RANGE, data(obs), prefs);
    expect(r.points.map(p => `${p.series}:${p.value}`)).toEqual(['systolic:132', 'diastolic:84', 'systolic:184', 'diastolic:96', 'systolic:128']);
    expect(r.texts.map(t => t.note)).toEqual([undefined, 'Very high', undefined]);
    expect(r.texts[0].text).toBe('132/84 mmHg at 7:30 am');
  });
});

describe('daily figures and labs', () => {
  const session = (date: string, over: Partial<WorkoutSession>): WorkoutSession => ({
    id: `${date}-${over.planKind}`, date, dayOfWeek: 'monday', muscleGroup: 'fullBody', phase: 'foundation', week: 3, status: 'completed', sets: [],
    startedAt: `${date}T07:30:00+05:30`, completedAt: null, notes: '', totalVolume: 0, guided: true, ...over,
  });
  it('keeps each kind of movement to its own trend', () => {
    const d = data([], [session('2026-10-05', { planKind: 'full', durationSeconds: 2700 }), session('2026-10-06', { planKind: 'stretch', durationSeconds: 600 })]);
    expect(figuresFor('workout', RANGE, d, prefs)).toEqual([{ day: '2026-10-05', value: 45 }]);
    expect(figuresFor('stretch', RANGE, d, prefs)).toEqual([{ day: '2026-10-06', value: 10 }]);
    expect(figuresFor('glucose', RANGE, d, prefs)).toEqual([]);
  });

  it('labs in the unit their lab reports, oldest first', () => {
    const lab = (value: number, unit: '%' | 'mmol/mol', day: string) => newObservation({ kind: 'hba1c', value, unit, at: `${day}T12:00:00+05:30`, scope: 'pointInTime', source: 'manual' });
    expect(labPoints('hba1c', [lab(53, 'mmol/mol', '2026-06-02'), lab(7.4, '%', '2026-03-02')], { ...prefs, hba1c: '%' }).map(p => [p.day, p.value, p.unit]))
      .toEqual([['2026-03-02', 7.4, '%'], ['2026-06-02', 7, '%']]);
  });

  it('knows which categories have data: sessions for Workout and Stretch, records for the rest, a meter’s LO for Glucose', () => {
    const lo = { date: '2026-10-07', glucoseDisplay: { display: 'LO' } } as unknown as CheckInRecord;
    expect(hasData('glucose', data([], [], [lo]))).toBe(true);
    expect(hasData('workout', data([], [session('2026-10-05', { planKind: 'full' })]))).toBe(true);
    expect(hasData('stretch', data([], [session('2026-10-05', { planKind: 'full', mobility: [{ exerciseId: 'cat-cow', seconds: 60 }] })]))).toBe(true);
    expect(hasData('steps', data([]))).toBe(false);
    expect(hasData('mood', data([newObservation({ kind: 'mood', value: 3, at: '2026-09-02T12:00:00+05:30', scope: 'pointInTime', source: 'imported' })]))).toBe(true);
  });
});
```

53 mmol/mol is 7.0% by the IFCC–NGSP conversion (`convert` in `units.ts`), shown to one decimal as `7`.

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/screens/trends/metrics.test.ts`
Expected: FAIL, "Cannot find module './metrics'".

- [ ] **Step 3: Write the module** `src/screens/trends/metrics.ts`

```ts
/**
 * A trend for each category that declares one (journey §5.1, B-14), and for
 * Mood, which v4 backups can carry but no category owns (D74): what kind of
 * measure it is, its unit and precision, and how its records become the day
 * figures or readings the statistics count (`records.ts`, through v1's
 * aggregation only). Food's trend is Plan 7's: its address goes to the Food
 * hub until then (D74).
 */
import { CATEGORIES, categoryById } from '@/categories';
import { pairBloodPressure, type DayRange } from '@/health/aggregate';
import type { Observation, ObservationKind } from '@/health/observation';
import { HYPO_LEVEL_1_MGDL, glucoseFlag, pressureFlag } from '@/screens/track/escalation';
import { formatClock, hasClockTime, inDisplayUnit, shownDecimals, tagLabel, unitLabel, type DisplayPrefs } from '@/screens/track/format';
import type { LabKind } from '@/screens/track/logKinds';
import { glucoseGroup } from '@/screens/track/targets';
import { formatPressure } from '@/screens/track/timeline';
import { decimalsFor, formatNumber, glucoseMgdl, roundTo, type GlucoseUnit } from '@/screens/track/units';
import { dayTotals, meterReadings, sessionMinutes, sessionsOf, stepsDays, stretchedDays, walkFigures, type TrendData } from './records';
import type { DayFigure, LabPoint, MeterReading, ReadingPoint } from './stats';

export type { TrendData } from './records';

export type TrendId = 'workout' | 'stretch' | 'walk' | 'steps' | 'glucose' | 'bp' | 'back' | 'weight' | 'water' | 'sleep' | 'waist' | 'labs' | 'mood';
export type Family = 'counted' | 'stated' | 'readings' | 'labs';
export type Shape = 'circle' | 'square' | 'triangle';

export interface TrendDef {
  id: TrendId;
  title: string;
  family: Family;
  /** Movement charts shade rest and status days (J§12.2). */
  movement: boolean;
  /** The CSS colour token its chart draws in: `--cat-{id}`. */
  colour: string;
  /** The unit after a figure, in the person's own units. */
  unit: (prefs: DisplayPrefs) => string;
  /** Decimals a figure is shown and compared to. */
  decimals: (prefs: DisplayPrefs) => number;
  /** A stated trend's average is "a day" or "a night". */
  per: 'day' | 'night';
  /** What a day of data is called, one and many: "day with steps", "days with steps". */
  coverage: [string, string];
  /** The hub that holds its records and corrections. Mood has none. */
  hub?: string;
}

const days = (one: string, many: string): [string, string] => [one, many];

function fromRegistry(id: Exclude<TrendId, 'mood'>, rest: Omit<TrendDef, 'id' | 'title' | 'colour' | 'hub'>): TrendDef {
  const c = categoryById(id);
  return { id, title: c.title, colour: c.colour, hub: c.hub, ...rest };
}

const MINUTES = { unit: () => 'min', decimals: () => 0, per: 'day' as const, coverage: days('day', 'days') };
const READINGS = { family: 'readings' as const, movement: false, per: 'day' as const, coverage: days('day with readings', 'days with readings') };

export const TRENDS: Record<TrendId, TrendDef> = {
  workout: fromRegistry('workout', { family: 'counted', movement: true, ...MINUTES }),
  stretch: fromRegistry('stretch', { family: 'counted', movement: true, ...MINUTES }),
  walk: fromRegistry('walk', { family: 'counted', movement: true, ...MINUTES }),
  steps: fromRegistry('steps', { family: 'stated', movement: true, unit: () => 'steps', decimals: () => 0, per: 'day', coverage: days('day with steps', 'days with steps') }),
  glucose: fromRegistry('glucose', { ...READINGS, unit: p => p.glucose, decimals: p => decimalsFor('glucose', p.glucose) }),
  bp: fromRegistry('bp', { ...READINGS, unit: () => 'mmHg', decimals: () => 0 }),
  back: fromRegistry('back', { ...READINGS, unit: () => 'of 10', decimals: () => 1 }),
  weight: fromRegistry('weight', { ...READINGS, unit: p => p.mass, decimals: () => 1 }),
  water: fromRegistry('water', { family: 'stated', movement: false, unit: () => 'ml', decimals: () => 0, per: 'day', coverage: days('day with water entered', 'days with water entered') }),
  sleep: fromRegistry('sleep', { family: 'stated', movement: false, unit: () => 'h', decimals: () => 1, per: 'night', coverage: days('night recorded', 'nights recorded') }),
  waist: fromRegistry('waist', { ...READINGS, unit: p => p.length, decimals: () => 1 }),
  labs: fromRegistry('labs', { family: 'labs', movement: false, unit: () => '', decimals: () => 1, per: 'day', coverage: days('result', 'results') }),
  mood: { id: 'mood', title: 'Mood', ...READINGS, colour: '--tint', unit: () => 'of 5', decimals: () => 1 },
};

/** The trend at `/trends/{id}`, or nothing: Food's comes in Plan 7, and Learn has none. */
export function trendDef(id: string | undefined): TrendDef | undefined {
  return id !== undefined && Object.hasOwn(TRENDS, id) ? TRENDS[id as TrendId] : undefined;
}

/** Trends lists them in the registry's order, then Mood (J§12.1). */
export const TREND_ORDER: readonly TrendId[] = [
  ...CATEGORIES.flatMap(c => (c.trend !== undefined && Object.hasOwn(TRENDS, c.id) ? [c.id as TrendId] : [])),
  'mood',
];

/** Glucose under this is low (ADA level 1); over this is the high the check-in asks about. */
export const HIGH_GLUCOSE_MGDL = 250;

/** The lines as ADA writes them in each unit (Table 6.4), and 250 mg/dL as 13.9 mmol/L. */
export const GLUCOSE_LINES: Record<GlucoseUnit, { low: string; high: string }> = {
  'mg/dL': { low: '70 mg/dL', high: '250 mg/dL' },
  'mmol/L': { low: '3.9 mmol/L', high: '13.9 mmol/L' },
};

export interface SeriesInfo {
  id: string;
  label: string;
  shape: Shape;
}

/** One reading in words, for the chart's callout and its list: "112 mg/dL at 7:30 am, fasting". */
export interface ReadingText {
  day: string;
  at: string;
  text: string;
  /** "Low", "Very high", "Below what the meter can show". */
  note?: string;
}

export interface Readings {
  points: ReadingPoint[];
  meters: MeterReading[];
  /** The series present in the range, in a fixed order. */
  series: SeriesInfo[];
  /** Every reading in words, oldest first, a meter's HI and LO among them. */
  texts: ReadingText[];
}

const GLUCOSE_SERIES: readonly SeriesInfo[] = [
  { id: 'beforeMeal', label: 'Fasting or before a meal', shape: 'circle' },
  { id: 'afterMeal', label: 'After a meal', shape: 'triangle' },
  { id: 'other', label: 'Other times', shape: 'square' },
];
const BP_SERIES: readonly SeriesInfo[] = [
  { id: 'systolic', label: 'Top number (systolic)', shape: 'circle' },
  { id: 'diastolic', label: 'Bottom number (diastolic)', shape: 'square' },
];
const PAIN_SERIES: readonly SeriesInfo[] = [
  { id: 'back', label: 'Back pain', shape: 'circle' },
  { id: 'leg', label: 'Leg pain', shape: 'square' },
];
const SINGLE: Partial<Record<TrendId, ObservationKind>> = { weight: 'weight', waist: 'waist', mood: 'mood' };

const inside = (range: DayRange) => (x: { day: string }) => x.day >= range.from && x.day <= range.to;
const byTime = (a: { at: string }, b: { at: string }) => Date.parse(a.at) - Date.parse(b.at);

/** A record's value in the display unit, at the precision it is shown. */
function shown(o: Observation, prefs: DisplayPrefs): { value: number; unit: string; decimals: number } {
  const v = inDisplayUnit(o, prefs);
  const decimals = shownDecimals(v.value, o.kind, v.unit);
  return { value: roundTo(v.value, decimals), unit: v.unit, decimals };
}

const at = (o: Observation, prefs: DisplayPrefs) => (hasClockTime(o) ? ` at ${formatClock(o.at, prefs.hour12)}` : '');

/** A readings trend's readings over `range`: numbers in the display unit, the meter's HI and LO, and each in words. */
export function readingsFor(id: TrendId, range: DayRange, data: TrendData, prefs: DisplayPrefs): Readings {
  const own = data.observations.filter(o => o.scope === 'pointInTime').filter(inside(range));
  const points: ReadingPoint[] = [];
  const texts: ReadingText[] = [];

  if (id === 'glucose') {
    for (const o of own) {
      if (o.kind !== 'glucose') continue;
      const v = shown(o, prefs);
      const mg = glucoseMgdl(o.value, o.unit as GlucoseUnit);
      const low = mg < HYPO_LEVEL_1_MGDL;
      const high = mg > HIGH_GLUCOSE_MGDL;
      points.push({ id: o.id, day: o.day, at: o.at, value: v.value, series: glucoseGroup(o.tag), ...(low ? { low: true as const } : {}), ...(high ? { high: true as const } : {}) });
      // v1's own words for a low and an extreme reading, as Today's log lists them; then the high the check-in asks about.
      const note = glucoseFlag(o.value, o.unit as GlucoseUnit) ?? (high ? `Above ${GLUCOSE_LINES[prefs.glucose].high}` : undefined);
      texts.push({ day: o.day, at: o.at, text: `${formatNumber(v.value, v.decimals)} ${v.unit}${at(o, prefs)}${o.tag ? `, ${tagLabel(o.tag).toLowerCase()}` : ''}`, ...(note ? { note } : {}) });
    }
    const meters = meterReadings(data.checkIns).filter(inside(range));
    for (const m of meters) {
      texts.push({
        day: m.day, at: m.at ?? `${m.day}T12:00:00`, text: `Meter showed ${m.display}${m.at ? ` at ${formatClock(m.at, prefs.hour12)}` : ''}`,
        note: m.display === 'LO' ? 'Below what the meter can show' : 'Above what the meter can show',
      });
    }
    return { points, meters, series: GLUCOSE_SERIES.filter(s => points.some(p => p.series === s.id)), texts: texts.sort(byTime) };
  }

  if (id === 'bp') {
    for (const r of pairBloodPressure(own)) {
      if (r.systolic !== null) points.push({ id: `${r.id}:sys`, day: r.day, at: r.at, value: r.systolic, series: 'systolic' });
      if (r.diastolic !== null) points.push({ id: `${r.id}:dia`, day: r.day, at: r.at, value: r.diastolic, series: 'diastolic' });
      const flag = pressureFlag(r.systolic, r.diastolic);
      const timed = hasClockTime(r.halves[0]) ? ` at ${formatClock(r.at, prefs.hour12)}` : '';
      texts.push({ day: r.day, at: r.at, text: `${formatPressure(r)}${timed}`, ...(flag ? { note: flag } : {}) });
    }
    return { points, meters: [], series: BP_SERIES.filter(s => points.some(p => p.series === s.id)), texts: texts.sort(byTime) };
  }

  if (id === 'back') {
    for (const o of own) {
      if (o.kind !== 'backPain' && o.kind !== 'legPain') continue;
      const series = o.kind === 'backPain' ? 'back' : 'leg';
      points.push({ id: o.id, day: o.day, at: o.at, value: o.value, series });
      texts.push({ day: o.day, at: o.at, text: `${series === 'back' ? 'Back' : 'Leg'} ${o.value} of 10${at(o, prefs)}` });
    }
    return { points, meters: [], series: PAIN_SERIES.filter(s => points.some(p => p.series === s.id)), texts: texts.sort(byTime) };
  }

  const kind = SINGLE[id];
  if (kind) {
    for (const o of own) {
      if (o.kind !== kind) continue;
      const v = shown(o, prefs);
      points.push({ id: o.id, day: o.day, at: o.at, value: v.value, series: 'value' });
      texts.push({ day: o.day, at: o.at, text: `${formatNumber(v.value, v.decimals)} ${unitLabel(v.unit)}${at(o, prefs)}` });
    }
    const label = TRENDS[id].title;
    return { points, meters: [], series: points.length ? [{ id: 'value', label, shape: 'circle' }] : [], texts: texts.sort(byTime) };
  }
  return { points: [], meters: [], series: [], texts: [] };
}

/** A counted or stated trend's day figures over `range`. */
export function figuresFor(id: TrendId, range: DayRange, data: TrendData, prefs: DisplayPrefs): DayFigure[] {
  switch (id) {
    case 'workout': return sessionMinutes(sessionsOf('programme', data.sessions), range);
    case 'stretch': return sessionMinutes(sessionsOf('stretch', data.sessions), range);
    case 'walk': return walkFigures('walkDuration', range, data.observations);
    case 'steps': return stepsDays(range, data.observations, prefs.hour12);
    case 'water': return dayTotals('water', range, data.observations);
    case 'sleep': return dayTotals('sleep', range, data.observations);
    default: return [];
  }
}

/** One lab's results in the unit the person reads that lab in, oldest first. */
export function labPoints(lab: LabKind, observations: readonly Observation[], prefs: DisplayPrefs): LabPoint[] {
  return observations
    .filter(o => o.kind === lab && o.scope === 'pointInTime')
    .map(o => {
      const v = shown(o, prefs);
      return { id: o.id, day: o.day, value: v.value, unit: v.unit };
    })
    .sort((a, b) => a.day.localeCompare(b.day));
}

const KINDS_OF: Partial<Record<TrendId, readonly ObservationKind[]>> = {
  walk: ['walkDuration'], steps: ['steps'], glucose: ['glucose'], bp: ['bloodPressureSystolic', 'bloodPressureDiastolic'],
  back: ['backPain', 'legPain'], weight: ['weight'], water: ['water'], sleep: ['sleep'], waist: ['waist'],
  labs: ['hba1c', 'b12', 'vitaminD'], mood: ['mood'],
};

/** Whether a category has anything to show: Trends lists every category with data, on Home or not (J§12.1, A-29). */
export function hasData(id: TrendId, data: TrendData): boolean {
  if (id === 'workout') return sessionsOf('programme', data.sessions).length > 0;
  if (id === 'stretch') return stretchedDays(data.sessions).size > 0;
  const kinds = KINDS_OF[id] ?? [];
  return data.observations.some(o => kinds.includes(o.kind)) || (id === 'glucose' && meterReadings(data.checkIns).length > 0);
}
```

`formatPressure` writes a missing half as "Not entered", as v1's lists do ("128/Not entered mmHg").

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/screens/trends/metrics.test.ts`
Expected: PASS.

- [ ] **Step 5: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/trends/metrics.ts src/screens/trends/metrics.test.ts
git commit -m "feat: Give every category with a trend its measure, unit and readings"
```

---

### Task 6: The chart's model

**Files:**
- Create: `src/screens/trends/chart.ts`
- Create: `src/screens/trends/chart.test.ts`

**Interfaces:**
- Consumes: `niceDomain`, `niceTicks`, `type LinearDomain` from `@/components/hig/scale`; `type DayRange` from `@/health/aggregate`; `type Shape` (Task 5); `type StatusMark` (Task 3).
- Produces:
  - `type SlotMark = 'rest' | StatusMark`, `MARK_WORDS: Record<SlotMark, string>`;
  - `interface Slot { key: string; label: string; name: string; range: DayRange; mark?: SlotMark; future?: true; text: string; day?: string }`;
  - `interface BarSeries { kind: 'bars'; id: string; label: string; colour: string; values: (number | null)[]; previous?: true }`;
  - `interface PointSeries { kind: 'points'; id: string; label: string; colour: string; shape: Shape; points: { slot: number; at: number; value: number; flag?: 'low' | 'high' }[] }`;
  - `interface RangeSeries { kind: 'ranges'; id: string; label: string; colour: string; values: ({ min: number; max: number; mean: number } | null)[] }`;
  - `type ChartSeries = BarSeries | PointSeries | RangeSeries`;
  - `interface ChartModel { slots: Slot[]; series: ChartSeries[]; average?: { value: number; label: string }; lines: { value: number; label: string }[]; unit: string; decimals: number }`;
  - `domainOf(model: ChartModel): { domain: LinearDomain; ticks: number[] }`;
  - `selectable(model: Pick<ChartModel, 'slots'>): number`;
  - `slotAt(x: number, plot: { left: number; width: number }, count: number): number | undefined`;
  - `stepValue(key: string, value: number, max: number): number | undefined`;
  - `interface LegendItem { id: string; label: string; swatch: 'bar' | 'previous' | 'range' | 'mark' | Shape; colour: string }`, `legendOf(model: ChartModel): LegendItem[]`.

`TrendChart` (Task 10) draws a `ChartModel` and computes no statistic. Plan 7 adds Food's kcal and carbs as one more `BarSeries` in the same model, and the chart, its legend, its list and its slider take it as they are.

- [ ] **Step 1: Write the failing test** `src/screens/trends/chart.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { addDays } from '@/screens/track/periods';
import { domainOf, legendOf, selectable, slotAt, stepValue, type ChartModel, type Slot } from './chart';

const slots = (n: number, future = 0): Slot[] => Array.from({ length: n }, (_, i) => {
  const day = addDays('2026-10-05', i);
  return { key: day, label: day.slice(8), name: day, range: { from: day, to: day }, text: day, ...(i >= n - future ? { future: true as const } : {}) };
});
const model = (over: Partial<ChartModel> = {}): ChartModel => ({ slots: slots(7), series: [], lines: [], unit: 'steps', decimals: 0, ...over });

describe('choosing a slot (B-15: the whole plot, the keys and a list)', () => {
  it('a tap or a drag anywhere across the plot chooses the slot under it, held to the first and the last', () => {
    const plot = { left: 40, width: 280 };
    expect([40, 79, 80, 319].map(x => slotAt(x, plot, 7))).toEqual([0, 0, 1, 6]);
    expect(slotAt(10, plot, 7)).toBe(0);
    expect(slotAt(400, plot, 7)).toBe(6);
    expect(slotAt(100, plot, 0)).toBeUndefined();
  });

  it('the arrow keys move one slot, Home and End jump, Escape puts the choice down', () => {
    expect(stepValue('ArrowRight', 0, 4)).toBe(1);
    expect(stepValue('ArrowRight', 4, 4)).toBe(4);
    expect(stepValue('ArrowLeft', 1, 4)).toBe(0);
    expect(stepValue('ArrowLeft', 0, 4)).toBe(0);
    expect(stepValue('Home', 3, 4)).toBe(1);
    expect(stepValue('End', 0, 4)).toBe(4);
    expect(stepValue('Escape', 3, 4)).toBe(0);
    expect(stepValue('Enter', 2, 4)).toBeUndefined();
    expect(stepValue('Home', 0, 0)).toBe(0);
  });

  it('only the slots up to today can be chosen', () => {
    expect(selectable(model({ slots: slots(7, 3) }))).toBe(4);
  });
});

describe('the value axis', () => {
  it('bars start at zero, and the axis holds the average', () => {
    const { domain, ticks } = domainOf(model({
      series: [
        { kind: 'bars', id: 'previous', label: 'Last week', colour: 'var(--trend-previous)', values: [5000, 6000, 5800, 6200, 4000, 8000, 3500], previous: true },
        { kind: 'bars', id: 'current', label: 'This week', colour: 'var(--cat-steps)', values: [6000, 7000, 5500, null, null, null, null] },
      ],
      average: { value: 18500 / 3, label: 'Average 6,167 steps a day' },
    }));
    expect(domain).toEqual({ min: 0, max: 10000, step: 2500 });
    expect(ticks).toEqual([0, 2500, 5000, 7500, 10000]);
  });

  it('readings sit around their spread, not on a zero line', () => {
    const { domain } = domainOf(model({
      series: [{ kind: 'points', id: 'beforeMeal', label: 'Fasting or before a meal', colour: 'var(--cat-glucose)', shape: 'circle', points: [
        { slot: 0, at: 0.3, value: 112 }, { slot: 1, at: 0.3, value: 126 }, { slot: 2, at: 0.3, value: 63, flag: 'low' },
      ] }],
      unit: 'mg/dL',
    }));
    expect(domain).toEqual({ min: 40, max: 140, step: 20 });
  });

  it('a chart with nothing in it still has a finite axis', () => {
    const { domain, ticks } = domainOf(model());
    expect(domain).toEqual({ min: 0, max: 1, step: 1 });
    expect(ticks.every(Number.isFinite)).toBe(true);
  });
});

describe('the legend (journey §20.3: colour is never the only signal)', () => {
  it('names every series, then each kind of shaded day present, in a fixed order', () => {
    const marked = slots(7).map((s, i) => (i === 2 ? { ...s, mark: 'away' as const } : i === 6 ? { ...s, mark: 'rest' as const } : s));
    const items = legendOf(model({
      slots: marked,
      series: [
        { kind: 'bars', id: 'previous', label: 'Last week', colour: 'var(--trend-previous)', values: [], previous: true },
        { kind: 'bars', id: 'current', label: 'This week', colour: 'var(--cat-walk)', values: [] },
        { kind: 'points', id: 'afterMeal', label: 'After a meal', colour: 'var(--cat-glucose)', shape: 'triangle', points: [] },
      ],
    }));
    expect(items.map(i => [i.label, i.swatch])).toEqual([
      ['Last week', 'previous'], ['This week', 'bar'], ['After a meal', 'triangle'], ['Rest day', 'mark'], ['Away', 'mark'],
    ]);
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/screens/trends/chart.test.ts`
Expected: FAIL, "Cannot find module './chart'".

- [ ] **Step 3: Write the module** `src/screens/trends/chart.ts`

```ts
/**
 * The chart's model (journey §12.2, §20.2; B-15): what `TrendChart` draws,
 * decided by a trend's model and never by the chart, which computes no
 * statistic. A slot is one place along the axis (a day, a week or a month);
 * a series is bars, points or ranges over the slots. Food's kcal and carbs
 * (Plan 7) are one more bars series of this same model: nothing here knows
 * the metric.
 */
import { niceDomain, niceTicks, type LinearDomain } from '@/components/hig/scale';
import type { DayRange } from '@/health/aggregate';
import type { Shape } from './metrics';
import type { StatusMark } from './stats';

/** A day shaded in a movement chart: never drawn as a zero (D25, K-49). */
export type SlotMark = 'rest' | StatusMark;

export const MARK_WORDS: Record<SlotMark, string> = { rest: 'Rest day', flare: 'Flare-up', unwell: 'Unwell', away: 'Away' };

export interface Slot {
  /** The bucket's first day: stable from one render to the next. */
  key: string;
  /** Under the axis: "Mon", "8", "4 May", "Nov". The chart thins them to fit. */
  label: string;
  /** Said and listed: "Tuesday, 6 October", "4–10 May", "November 2025". */
  name: string;
  range: DayRange;
  /** Hatched and labelled, in movement charts only. */
  mark?: SlotMark;
  /** After today: nothing yet, and it can't be chosen. */
  future?: true;
  /** The slot in words, for the callout and the slider: "Tuesday, 6 October: 7,000 steps, entered at 8:00 pm. Last week: 6,000 steps." */
  text: string;
  /** A day slot opens that day in Today's log. */
  day?: string;
}

export interface BarSeries {
  kind: 'bars';
  id: string;
  label: string;
  /** A CSS colour: `var(--cat-steps)`, or `var(--trend-previous)`. */
  colour: string;
  /** One per slot; `null` draws nothing: not entered, shaded, or before the record. */
  values: (number | null)[];
  /** The period before: behind the current bars, full width, grey and striped (B-15). */
  previous?: true;
}

export interface PointSeries {
  kind: 'points';
  id: string;
  label: string;
  colour: string;
  shape: Shape;
  /** Each reading: its slot, how far through the slot its time falls (0–1), and a line it is past. */
  points: { slot: number; at: number; value: number; flag?: 'low' | 'high' }[];
}

export interface RangeSeries {
  kind: 'ranges';
  id: string;
  label: string;
  colour: string;
  /** One per slot: the lowest, the highest and the mean of its numeric readings. */
  values: ({ min: number; max: number; mean: number } | null)[];
}

export type ChartSeries = BarSeries | PointSeries | RangeSeries;

export interface ChartModel {
  slots: Slot[];
  series: ChartSeries[];
  /** The labelled average line (journey §12.2). */
  average?: { value: number; label: string };
  /** Reference lines, labelled, drawn when they fall inside the axis: "70 mg/dL". */
  lines: { value: number; label: string }[];
  unit: string;
  decimals: number;
}

/** Every figure the chart draws. A loop, not a spread: a year of readings would overflow the call stack. */
function figures(model: ChartModel): number[] {
  const out: number[] = [];
  for (const s of model.series) {
    if (s.kind === 'bars') {
      for (const v of s.values) if (v !== null) out.push(v);
    } else if (s.kind === 'points') {
      for (const p of s.points) out.push(p.value);
    } else {
      for (const r of s.values) if (r) out.push(r.min, r.max);
    }
  }
  return out;
}

/** The value axis: bars from zero, readings around their spread, the average always on it. */
export function domainOf(model: ChartModel): { domain: LinearDomain; ticks: number[] } {
  const bars = model.series.some(s => s.kind === 'bars');
  const domain = niceDomain(figures(model), { include: model.average ? [model.average.value] : [], zeroBased: bars });
  return { domain, ticks: niceTicks(domain) };
}

/** How many slots can be chosen: those up to today, which always come first. */
export function selectable(model: Pick<ChartModel, 'slots'>): number {
  let n = 0;
  for (const s of model.slots) if (!s.future) n += 1;
  return n;
}

/** The slot under `x`, anywhere across the plot, held to the first and the last (B-15). */
export function slotAt(x: number, plot: { left: number; width: number }, count: number): number | undefined {
  if (count <= 0 || !(plot.width > 0) || !Number.isFinite(x)) return undefined;
  const i = Math.floor(((x - plot.left) / plot.width) * count);
  return Math.min(count - 1, Math.max(0, i));
}

/**
 * The chart's value as a slider after a key: 0 is nothing chosen, n the nth
 * slot. Undefined for a key the chart leaves to the page.
 */
export function stepValue(key: string, value: number, max: number): number | undefined {
  switch (key) {
    case 'ArrowRight':
    case 'ArrowUp': return Math.min(max, value + 1);
    case 'ArrowLeft':
    case 'ArrowDown': return Math.max(0, value - 1);
    case 'Home': return Math.min(1, max);
    case 'End': return max;
    case 'Escape': return 0;
    default: return undefined;
  }
}

export interface LegendItem {
  id: string;
  label: string;
  swatch: 'bar' | 'previous' | 'range' | 'mark' | Shape;
  colour: string;
}

const MARK_ORDER: readonly SlotMark[] = ['rest', 'flare', 'unwell', 'away'];

/** Each series, then each kind of shaded day present, in words beside its swatch (journey §20.3). */
export function legendOf(model: ChartModel): LegendItem[] {
  const items = model.series.map((s): LegendItem => ({
    id: s.id,
    label: s.label,
    colour: s.colour,
    swatch: s.kind === 'bars' ? (s.previous ? 'previous' : 'bar') : s.kind === 'points' ? s.shape : 'range',
  }));
  const marks = new Set(model.slots.map(s => s.mark));
  for (const m of MARK_ORDER) if (marks.has(m)) items.push({ id: `mark:${m}`, label: MARK_WORDS[m], swatch: 'mark', colour: 'var(--muted-foreground)' });
  return items;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/screens/trends/chart.test.ts`
Expected: PASS.

- [ ] **Step 5: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/trends/chart.ts src/screens/trends/chart.test.ts
git commit -m "feat: Model Trends' chart as slots and series the chart only draws"
```

---

### Task 7: A daily trend's view

**Files:**
- Create: `src/screens/trends/model.ts`
- Create: `src/screens/trends/model.test.ts`

**Interfaces:**
- Consumes:
  - `format` from `date-fns`; `isDay` from `@/health/observation`; `isEnrolled` from `@/health/recommend`; `restDaysOf` from `@/screens/home/week` (Home's rule for planned rest days); `type DayRange` from `@/health/aggregate`;
  - `formatDayLong`, `type DisplayPrefs` from `@/screens/track/format`; `formatNumber` from `@/screens/track/units`; `type UserSettings` from `@/types`; `type UserProfile` from `@/types/profile`;
  - Task 2's `compareRanges`, `comparedText`, `previousName`, `previousWindow`, `rangeText`, `windowTitle`, `TrendPeriod`, `TrendWindow`;
  - Task 3's `compareDaily`, `dailyStats`, `dayContext`, `figureOf`, `statisticFor`, `statusList` and their types;
  - Task 4's `firstRecordDay`, `stretchedDays`, `TrendData`; Task 5's `figuresFor`, `TrendDef`; Task 6's `MARK_WORDS`, `ChartModel`, `ChartSeries`, `Slot`, `SlotMark`.
- Produces:
  - `interface StatItem { label: string; value: string }`;
  - `interface Headline { statistic: string; coverage: string; value: string; unit?: string }`;
  - `interface Change { text: string; direction?: Direction; compared?: string }`;
  - `interface TrendView { title: string; headline: Headline; change: Change; stats: StatItem[]; notes: string[]; meter?: string; chart: ChartModel; table: { columns: string[]; rows: string[][] }; summary: string }`;
  - `interface TrendInput { def: TrendDef; window: TrendWindow; data: TrendData; prefs: DisplayPrefs; ctx: DayContext }`;
  - `countText(n: number, words: readonly [string, string]): string`, `shortDay(day: string): string`, `fewDaysText(period: TrendPeriod): string`, `METER_LO_TEXT`;
  - `dailyView(input: TrendInput): TrendView`;
  - `trendContext(input: { today: string; data: TrendData; settings: Pick<UserSettings, 'startDate' | 'statusPeriods'>; profile: Pick<UserProfile, 'trainingDays'> | undefined }): DayContext`.

- [ ] **Step 1: Write the failing test** `src/screens/trends/model.test.ts`

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { WorkoutSession } from '@/types';
import type { CheckInRecord } from '@/types/checkin';
import { newObservation, type Observation } from '@/health/observation';
import { weekdayOf } from '@/health/status';
import { DEFAULT_PREFS } from '@/screens/track/format';
import { TRENDS } from './metrics';
import { dailyView, trendContext } from './model';
import { windowOf } from './periods';
import type { DayContext } from './stats';

// A meter's display is placed on this device's clock (`nowAt`), so the zone is pinned.
const zone = process.env.TZ;
beforeAll(() => { process.env.TZ = 'Asia/Kolkata'; });
afterAll(() => { if (zone === undefined) delete process.env.TZ; else process.env.TZ = zone; });

// Thursday 8 October 2026.
const TODAY = '2026-10-08';
const prefs = { ...DEFAULT_PREFS, hour12: true };
const data = (observations: Observation[], sessions: WorkoutSession[] = [], checkIns: CheckInRecord[] = []) => ({ observations, sessions, checkIns });
const ctx = (over: Partial<DayContext> = {}): DayContext => ({ today: TODAY, since: '2026-09-28', statusOn: () => 'normal', restOn: () => false, ...over });
const steps = (day: string, value: number, time = '20:00') =>
  newObservation({ kind: 'steps', value, at: `${day}T${time}:00.000+05:30`, scope: 'dayTotal', source: 'manual' });
const walk = (id: string, day: string, minutes: number, { time = '18:00', count }: { time?: string; count?: number } = {}) => {
  const at = `${day}T${time}:00.000+05:30`;
  const common = { at, scope: 'sessionObserved' as const, source: 'measured' as const, coverageMs: minutes * 60_000, context: `walk:${id}` };
  return [
    newObservation({ ...common, kind: 'walkDuration', value: minutes }),
    ...(count === undefined ? [] : [newObservation({ ...common, kind: 'steps', value: count })]),
  ];
};

// V-J07's fortnight: a total entered at 8 pm each evening from 28 September to 7 October.
const STEPS: [string, number][] = [
  ['2026-09-28', 5000], ['2026-09-29', 6000], ['2026-09-30', 5800], ['2026-10-01', 6200], ['2026-10-02', 4000], ['2026-10-03', 8000], ['2026-10-04', 3500],
  ['2026-10-05', 6000], ['2026-10-06', 7000], ['2026-10-07', 5500],
];

describe('a stated measure’s week: Steps (V-J07, B-15)', () => {
  const view = dailyView({ def: TRENDS.steps, window: windowOf('week', TODAY), data: data(STEPS.map(([d, v]) => steps(d, v))), prefs, ctx: ctx() });

  it('states a day on average over the days with steps, and names them', () => {
    expect(view.title).toBe('This week');
    expect(view.headline).toEqual({ statistic: 'A day on average', coverage: '3 days with steps', value: '6,167', unit: 'steps' });
    expect(view.stats).toEqual([{ label: 'Days with steps', value: '3' }, { label: 'Highest', value: '7,000 steps · Tue 6 Oct' }]);
    expect(view.notes).toEqual([]);
  });

  it('compares Monday to Thursday with last Monday to Thursday, never with the whole of last week', () => {
    expect(view.change).toEqual({ text: 'Higher than last week · +417 steps a day', direction: 'higher', compared: 'Mon–Thu vs last Mon–Thu' });
  });

  it('draws last week behind this one, labels the average, and says each day in words', () => {
    const [previous, current] = view.chart.series;
    expect(previous).toMatchObject({ kind: 'bars', previous: true, label: 'Last week', values: [5000, 6000, 5800, 6200, 4000, 8000, 3500] });
    expect(current).toMatchObject({ kind: 'bars', label: 'This week', colour: 'var(--cat-steps)', values: [6000, 7000, 5500, null, null, null, null] });
    expect(view.chart.average).toEqual({ value: 18500 / 3, label: 'Average 6,167 steps a day' });
    expect(view.chart.slots.map(s => s.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(view.chart.slots[1]).toMatchObject({ day: '2026-10-06', text: 'Tuesday, 6 October: 7,000 steps, entered at 8:00 pm. Last week: 6,000 steps.' });
    expect(view.chart.slots[3].text).toBe('Thursday, 8 October: Not entered. Last week: 6,200 steps.');
    expect(view.chart.slots[4]).toMatchObject({ future: true, text: 'Friday, 9 October: Still to come. Last week: 4,000 steps.' });
    expect(view.chart.slots[4].day).toBeUndefined();
  });

  it('lists the days so far, and sums the view up for VoiceOver', () => {
    expect(view.table.columns).toEqual(['Day', 'This week', 'Last week']);
    expect(view.table.rows).toHaveLength(4);
    expect(view.table.rows[1]).toEqual(['Tuesday, 6 October', '7,000 steps, entered at 8:00 pm', '6,000 steps']);
    expect(view.summary).toBe('Steps, This week. A day on average, 3 days with steps: 6,167 steps. Higher than last week, +417 steps a day, Mon–Thu vs last Mon–Thu.');
  });
});

describe('a counted measure: Walk, with Away days and a rest day (B-15, D25, K-49)', () => {
  const WALKS = [
    ...walk('a', '2026-09-21', 20), ...walk('b', '2026-09-23', 30), ...walk('c', '2026-09-25', 10),
    ...walk('d', '2026-09-28', 30), ...walk('e', '2026-09-29', 20), ...walk('f', '2026-10-01', 40), ...walk('g', '2026-10-02', 10), ...walk('h', '2026-10-03', 20),
  ];
  const c = ctx({
    since: '2026-09-21',
    statusOn: d => (d === '2026-09-30' || d === '2026-10-02' ? 'away' : 'normal'),
    restOn: d => weekdayOf(d) === 'sunday',
  });
  const view = dailyView({ def: TRENDS.walk, window: windowOf('week', '2026-09-30'), data: data(WALKS), prefs, ctx: c });

  it('a finished week: its total, against the whole week before', () => {
    expect(view.title).toBe('Last week');
    expect(view.headline).toEqual({ statistic: 'Total', coverage: '7 days', value: '120', unit: 'min' });
    expect(view.change).toEqual({ text: 'Higher than the week before · +60 min', direction: 'higher', compared: '28 Sep – 4 Oct vs 21–27 Sep' });
    expect(view.notes).toEqual(['Includes 2 Away days.']);
    expect(view.stats).toEqual([{ label: 'Days with time recorded', value: '5' }, { label: 'Highest day', value: '40 min · Thu 1 Oct' }]);
  });

  it('shades Away and rest days and never draws them as zero; a walk on an Away day still counts', () => {
    expect(view.chart.series[1].kind === 'bars' && view.chart.series[1].values).toEqual([30, 20, null, 40, 10, 20, null]);
    expect(view.chart.series[0].kind === 'bars' && view.chart.series[0].values).toEqual([20, 0, 30, 0, 10, 0, null]);
    expect(view.chart.slots[2]).toMatchObject({ mark: 'away', text: 'Wednesday, 30 September: Away. The week before: 30 min.' });
    expect(view.chart.slots[4]).toMatchObject({ mark: 'away', text: 'Friday, 2 October: 10 min (Away). The week before: 10 min.' });
    expect(view.chart.slots[6]).toMatchObject({ mark: 'rest', text: 'Sunday, 4 October: Rest day. The week before: Rest day.' });
    expect(view.chart.average).toEqual({ value: 24, label: 'Average 24 min a day' });
  });
});

describe('6 Months: a week on average, weighted by the days of data (B-15)', () => {
  const view = dailyView({
    def: TRENDS.walk, window: windowOf('sixMonths', TODAY), prefs, ctx: ctx(),
    data: data([...walk('d', '2026-09-28', 30), ...walk('e', '2026-09-29', 20), ...walk('f', '2026-10-01', 40), ...walk('h', '2026-10-03', 30)]),
  });
  const slot = (key: string) => view.chart.slots.findIndex(s => s.key === key);

  it('is the total over the days of the record, times seven', () => {
    expect(view.headline).toEqual({ statistic: 'A week on average', coverage: 'from 11 days', value: '76', unit: 'min' });
    expect(view.stats).toEqual([
      { label: 'Days with time recorded', value: '4' }, { label: 'Total', value: '120 min' }, { label: 'Highest day', value: '40 min · Thu 1 Oct' },
    ]);
    expect(view.chart.average?.value).toBeCloseTo((120 / 11) * 7, 9);
    expect(view.chart.average?.label).toBe('Average 76 min a week');
  });

  it('draws each week’s total; a week of the record with nothing is 0, a week before it is nothing', () => {
    const bars = view.chart.series[1];
    expect(bars.kind).toBe('bars');
    if (bars.kind !== 'bars') return;
    expect(bars.values[slot('2026-09-28')]).toBe(120);
    expect(bars.values[slot('2026-10-05')]).toBe(0);
    expect(bars.values[slot('2026-09-21')]).toBeNull();
    expect(view.chart.slots[slot('2026-09-28')].name).toBe('28 Sep – 4 Oct');
  });

  it('waits for 3 days of data in both periods before comparing', () => {
    expect(view.change).toEqual({ text: 'Comparisons start once there are 3 days with data in both periods.' });
  });
});

describe('steps that are a lower bound (J§9.6, V-J26)', () => {
  const obs = [
    steps(TODAY, 6050, '12:05'),
    ...walk('w1', TODAY, 20, { time: '15:00', count: 1250 }),
    ...walk('w0', '2026-10-07', 20, { time: '07:40', count: 4210 }),
  ];
  const view = dailyView({ def: TRENDS.steps, window: windowOf('week', TODAY), data: data(obs), prefs, ctx: ctx({ since: '2026-10-07' }) });

  it('says “at least”, with both sources, and notes how many days are lower bounds', () => {
    expect(view.chart.slots[3].text).toBe('Thursday, 8 October: at least 7,300 steps, 6,050 entered at 12:05 pm + 1,250 in walks after 12:05 pm. Last week: Not entered.');
    expect(view.chart.slots[2].text).toBe('Wednesday, 7 October: 4,210 steps, in FitStrong walks · day total not entered. Last week: Not entered.');
    expect(view.notes).toEqual(['2 days show at least the steps counted: FitStrong walks only, or walks after a total was entered.']);
    expect(view.headline).toEqual({ statistic: 'A day on average', coverage: '2 days with steps', value: '5,755', unit: 'steps' });
  });

  it('a record that starts this week has no comparison yet', () => {
    expect(view.change).toEqual({ text: 'Comparisons start once there are 3 days with data in both weeks.' });
  });
});

describe('the day context from the settings', () => {
  it('rest days are the programme’s days without training, from its start; none outside the programme', () => {
    const d = data([steps('2026-09-28', 5000)]);
    const c = trendContext({
      today: TODAY, data: d, profile: { trainingDays: ['monday', 'thursday', 'saturday'] },
      settings: { startDate: '2026-09-24', statusPeriods: [{ kind: 'away', from: '2026-10-02', to: '2026-10-02' }] },
    });
    expect(c.since).toBe('2026-09-28');
    expect(c.restOn('2026-10-06')).toBe(true);    // a Tuesday
    expect(c.restOn('2026-10-08')).toBe(false);   // a Thursday
    expect(c.restOn('2026-09-22')).toBe(false);   // before the start
    expect(c.statusOn('2026-10-02')).toBe('away');
    expect(trendContext({ today: TODAY, data: d, settings: { startDate: '' }, profile: { trainingDays: ['monday'] } }).restOn('2026-10-06')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/screens/trends/model.test.ts`
Expected: FAIL, "Cannot find module './model'".

- [ ] **Step 3: Write the module** `src/screens/trends/model.ts`

```ts
/**
 * What a trend shows (journey §12.2, B-15), worked out from the records and
 * the window: the headline with its statistic and coverage, the change with
 * the days it compares, the spread, the notes, the chart's model, its list
 * and its words for VoiceOver. Pure: the screen only draws it.
 */
import { format } from 'date-fns';
import type { DayRange } from '@/health/aggregate';
import { isDay } from '@/health/observation';
import { isEnrolled } from '@/health/recommend';
import { restDaysOf } from '@/screens/home/week';
import { formatDayLong, type DisplayPrefs } from '@/screens/track/format';
import { formatNumber } from '@/screens/track/units';
import type { UserSettings } from '@/types';
import type { UserProfile } from '@/types/profile';
import { MARK_WORDS, type ChartModel, type ChartSeries, type Slot, type SlotMark } from './chart';
import { figuresFor, type TrendDef } from './metrics';
import { compareRanges, comparedText, previousName, previousWindow, rangeText, windowTitle, type TrendPeriod, type TrendWindow } from './periods';
import { firstRecordDay, stretchedDays, type TrendData } from './records';
import {
  compareDaily, dailyStats, dayContext, figureOf, statisticFor, statusList,
  type Comparison, type DailyRule, type DayContext, type DayFigure, type Direction, type Statistic,
} from './stats';

export interface StatItem {
  label: string;
  value: string;
}

/** The headline figure, and what it is (B-15). */
export interface Headline {
  /** "A day on average", "Total", "A week on average", "Average", "Latest". */
  statistic: string;
  /** What it covers: "3 days with steps", "7 days", "from 11 days", "5 readings, all with a number". */
  coverage: string;
  /** "6,167"; or words: "Not entered", "Nothing recorded", "No numeric readings". */
  value: string;
  /** Absent when `value` is words, or carries its own unit ("7.1%"). */
  unit?: string;
}

/** The change against the period before, said neutrally (A-41), or why there is none. */
export interface Change {
  text: string;
  /** For the arrow, drawn in body ink. */
  direction?: Direction;
  /** The days compared: "Mon–Thu vs last Mon–Thu" (A-42). */
  compared?: string;
}

export interface TrendView {
  /** The window's title: "This week", "September". */
  title: string;
  headline: Headline;
  change: Change;
  stats: StatItem[];
  notes: string[];
  /** Readings: a meter's HI and LO, said above the average in caution ink (K-11). */
  meter?: string;
  chart: ChartModel;
  table: { columns: string[]; rows: string[][] };
  /** The whole view in a few sentences, for VoiceOver (A-63). */
  summary: string;
}

export interface TrendInput {
  def: TrendDef;
  window: TrendWindow;
  data: TrendData;
  prefs: DisplayPrefs;
  ctx: DayContext;
}

const noon = (day: string) => new Date(`${day}T12:00:00`);
const cap = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`;

/** "Tue 6 Oct". */
export const shortDay = (day: string): string => format(noon(day), 'EEE d MMM');

/** "3 days with steps", "1 reading": a count and its noun. */
export function countText(n: number, [one, many]: readonly [string, string]): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}

const BOTH: Record<TrendPeriod, string> = { week: 'weeks', month: 'months', sixMonths: 'periods', year: 'periods' };

/** "Comparisons start once there are 3 days with data in both weeks." (J§12.2, early days) */
export function fewDaysText(period: TrendPeriod): string {
  return `Comparisons start once there are 3 days with data in both ${BOTH[period]}.`;
}

export const METER_LO_TEXT = 'No change shown: a meter LO has no number, so an average would leave out the lowest reading.';

/** "Higher than last week · +417 steps a day": the direction in words, and the difference with its unit and statistic (A-41). */
function changeOf(c: Comparison, against: string, unit: string, decimals: number, period: TrendPeriod, compared?: string): Change {
  if (!c.shown) return { text: c.reason === 'meterLo' ? METER_LO_TEXT : fewDaysText(period) };
  const by = formatNumber(c.difference, decimals);
  const text = c.direction === 'same' ? `The same as ${against}`
    : c.direction === 'higher' ? `Higher than ${against} · +${by} ${unit}` : `Lower than ${against} · −${by} ${unit}`;
  return { text, direction: c.direction, ...(compared ? { compared } : {}) };
}

/** The view in sentences for VoiceOver: the screen's own words, the dots read as commas. */
function summaryOf(title: string, windowName: string, h: Headline, change: Change, extra: readonly string[]): string {
  const spoken = (t: string) => t.replaceAll(' · ', ', ').replace(/\.$/, '');
  return `${[
    `${title}, ${windowName}`,
    `${h.statistic}, ${h.coverage}: ${h.value}${h.unit ? ` ${h.unit}` : ''}`,
    `${spoken(change.text)}${change.compared ? `, ${change.compared}` : ''}`,
    ...extra.map(spoken),
  ].join('. ')}.`;
}

function statName(statistic: Statistic, def: TrendDef): string {
  switch (statistic) {
    case 'total': return 'Total';
    case 'perDay': return `A ${def.per} on average`;
    case 'perWeek': return 'A week on average';
    case 'perMonth': return 'A month on average';
  }
}

/** What a figure is per: " a day", " a week"; nothing for a total. */
function perWords(statistic: Statistic, def: TrendDef): string {
  switch (statistic) {
    case 'total': return '';
    case 'perDay': return ` a ${def.per}`;
    case 'perWeek': return ' a week';
    case 'perMonth': return ' a month';
  }
}

/** What one slot holds: its figure, its shading, its words in full, and in brief for the period before. */
interface Cell {
  value: number | null;
  mark?: SlotMark;
  text: string;
  brief: string;
}

const words = (text: string): Cell => ({ value: null, text, brief: text });

/** A day's figure, shading and words (Week and Month). */
function dayCell(day: string, f: DayFigure | undefined, { def, prefs, ctx }: TrendInput, rule: DailyRule): Cell {
  if (day > ctx.today) return words('Still to come');
  const unit = def.unit(prefs);
  const d = def.decimals(prefs);
  const status = ctx.statusOn(day);
  // Shading is for movement charts only (J§12.2); a rest day is shaded only when nothing was done on it.
  const mark: SlotMark | undefined = !def.movement ? undefined : status !== 'normal' ? status : !f && ctx.restOn(day) ? 'rest' : undefined;
  if (f) {
    const brief = `${f.basis === 'atLeast' ? 'at least ' : ''}${formatNumber(f.value, d)} ${unit}`;
    return { value: f.value, ...(mark ? { mark } : {}), text: `${brief}${f.note ? `, ${f.note}` : ''}${mark ? ` (${MARK_WORDS[mark]})` : ''}`, brief };
  }
  if (mark) return { ...words(MARK_WORDS[mark]), mark };
  if (rule === 'stated') return words('Not entered');
  // Counted: a day of the record with nothing in it is a real 0 (D68); before the record there is no day at all.
  if (ctx.since === undefined || day < ctx.since) return words('Before your first record');
  return { value: 0, text: `0 ${unit}`, brief: `0 ${unit}` };
}

/** A week's or a month's figure and words (6 Months and Year): the counted total, or the stated average a day (D68). */
function bucketCell(range: DayRange, figures: readonly DayFigure[], { def, prefs, ctx }: TrendInput, rule: DailyRule): Cell {
  if (range.from > ctx.today) return words('Still to come');
  const unit = def.unit(prefs);
  const d = def.decimals(prefs);
  const s = dailyStats(range, figures, ctx, rule);
  if (rule === 'counted') {
    const total = figureOf(s, 'total');
    if (total === undefined) return words('Before your first record');
    const text = `${formatNumber(total, d)} ${unit}`;
    return { value: total, text, brief: text };
  }
  if (s.perDay === undefined) return words('Not entered');
  const brief = `${formatNumber(s.perDay, d)} ${unit} a ${def.per}`;
  return { value: s.perDay, text: `${brief} on average, from ${countText(s.days, def.coverage)}`, brief };
}

function slotLabel(period: TrendPeriod, b: DayRange): string {
  switch (period) {
    case 'week': return format(noon(b.from), 'EEE');
    case 'month': return String(Number(b.from.slice(8, 10)));
    case 'sixMonths': return format(noon(b.from), 'd MMM');
    case 'year': return format(noon(b.from), 'MMM');
  }
}

function slotName(period: TrendPeriod, b: DayRange, today: string): string {
  if (period === 'week' || period === 'month') return formatDayLong(b.from, today);
  return period === 'sixMonths' ? rangeText(b, today) : format(noon(b.from), 'MMMM yyyy');
}

/** A counted or stated trend over its window (B-15; D68, D69, D70). */
export function dailyView(input: TrendInput): TrendView {
  const { def, window: w, data, prefs, ctx } = input;
  const rule: DailyRule = def.family === 'counted' ? 'counted' : 'stated';
  const prev = previousWindow(w);
  const figures = figuresFor(def.id, { from: prev.from, to: w.to }, data, prefs);
  const byDay = new Map(figures.map(f => [f.day, f]));
  const unit = def.unit(prefs);
  const d = def.decimals(prefs);
  const statistic = statisticFor(rule, w.period);
  const s = dailyStats(w, figures, ctx, rule);
  const value = figureOf(s, statistic);
  const title = windowTitle(w, ctx.today);
  const against = previousName(w, ctx.today);

  const headline: Headline = {
    statistic: statName(statistic, def),
    coverage: statistic === 'total' ? countText(s.recordDays, ['day', 'days'])
      : statistic === 'perDay' ? countText(s.days, def.coverage)
        : `from ${countText(s.days, ['day', 'days'])}`,
    ...(value === undefined ? { value: rule === 'stated' ? 'Not entered' : 'Nothing recorded' } : { value: formatNumber(value, d), unit }),
  };

  const ranges = compareRanges(w, ctx.today);
  const comparison: Comparison = ranges
    ? compareDaily(dailyStats(ranges.current, figures, ctx, rule), dailyStats(ranges.previous, figures, ctx, rule), statistic, d)
    : { shown: false, reason: 'fewDays' };
  const change = changeOf(comparison, against, `${unit}${perWords(statistic, def)}`, d, w.period, ranges && comparedText(w, ranges, ctx.today));

  const inWindow = (day: string) => day >= w.from && day <= w.to && day <= ctx.today;
  const stats: StatItem[] = [];
  if (rule === 'stated') {
    if (s.days > 0) stats.push({ label: cap(def.coverage[1]), value: formatNumber(s.days) });
  } else {
    stats.push({ label: 'Days with time recorded', value: formatNumber(figures.filter(f => inWindow(f.day) && f.value > 0).length) });
    if (def.id === 'stretch') stats.push({ label: 'Days stretched', value: formatNumber([...stretchedDays(data.sessions)].filter(inWindow).length) });
    if (statistic !== 'total' && s.recordDays > 0) stats.push({ label: 'Total', value: `${formatNumber(s.sum, d)} ${unit}` });
  }
  if (s.high && s.high.value > 0) {
    stats.push({ label: rule === 'stated' ? 'Highest' : 'Highest day', value: `${formatNumber(s.high.value, d)} ${unit} · ${shortDay(s.high.day)}` });
  }

  const notes: string[] = [];
  const list = statusList(s.status);
  if (list) notes.push(rule === 'counted' && statistic !== 'total' ? `Includes ${list}, not counted as days in the average.` : `Includes ${list}.`);
  if (s.partialDays > 0) {
    notes.push(`${countText(s.partialDays, ['day shows', 'days show'])} at least the steps counted: FitStrong walks only, or walks after a total was entered.`);
  }

  const dayly = w.period === 'week' || w.period === 'month';
  const cellsOf = (win: TrendWindow) => win.buckets.map(b => (dayly ? dayCell(b.from, byDay.get(b.from), input, rule) : bucketCell(b, figures, input, rule)));
  const current = cellsOf(w);
  // A shorter month or 6 months before has fewer slots: those have nothing behind them.
  const before: (Cell | undefined)[] = cellsOf(prev);
  const beforeLabel = cap(against);
  const slots: Slot[] = w.buckets.map((b, i) => {
    const c = current[i];
    const was = before[i];
    const name = slotName(w.period, b, ctx.today);
    const future = b.from > ctx.today;
    return {
      key: b.from,
      label: slotLabel(w.period, b),
      name,
      range: b,
      ...(c.mark ? { mark: c.mark } : {}),
      ...(future ? { future: true as const } : {}),
      ...(dayly && !future ? { day: b.from } : {}),
      text: `${name}: ${c.text}.${was ? ` ${beforeLabel}: ${was.brief}.` : ''}`,
    };
  });
  const series: ChartSeries[] = [
    { kind: 'bars', id: 'previous', label: beforeLabel, colour: 'var(--trend-previous)', values: w.buckets.map((_, i) => before[i]?.value ?? null), previous: true },
    { kind: 'bars', id: 'current', label: title, colour: `var(${def.colour})`, values: current.map(c => c.value) },
  ];
  // Week and Month: the average day. 6 Months and Year: what the bars are, a week's or a month's time, or a stated day.
  const lineStat: Statistic = rule === 'stated' || dayly ? 'perDay' : statistic;
  const average = figureOf(s, lineStat);
  const chart: ChartModel = {
    slots, series, lines: [], unit, decimals: d,
    ...(average !== undefined ? { average: { value: average, label: `Average ${formatNumber(average, d)} ${unit}${perWords(lineStat, def)}` } } : {}),
  };

  const head = dayly ? 'Day' : w.period === 'sixMonths' ? 'Week' : 'Month';
  const rows = w.buckets.flatMap((b, i) => (b.from > ctx.today ? [] : [[slots[i].name, current[i].text, before[i]?.brief ?? '']]));
  return {
    title, headline, change, stats, notes, chart,
    table: { columns: [head, title, beforeLabel], rows },
    summary: summaryOf(def.title, title, headline, change, notes),
  };
}

/** The day context from the record and the settings: its first day, the statuses, and the programme's rest days. */
export function trendContext({ today, data, settings, profile }: {
  today: string;
  data: TrendData;
  settings: Pick<UserSettings, 'startDate' | 'statusPeriods'>;
  profile: Pick<UserProfile, 'trainingDays'> | undefined;
}): DayContext {
  const since = firstRecordDay(data);
  return dayContext({
    today,
    ...(since ? { since } : {}),
    ...(settings.statusPeriods ? { statusPeriods: settings.statusPeriods } : {}),
    // The programme's planned rest days, as Home's week marks them (A-39), from its start; none outside it.
    restDays: restDaysOf(isEnrolled(settings, profile), profile?.trainingDays),
    startDate: isDay(settings.startDate) ? settings.startDate : '',
  });
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/screens/trends/model.test.ts`
Expected: PASS.

- [ ] **Step 5: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/trends/model.ts src/screens/trends/model.test.ts
git commit -m "feat: Work out a daily trend's headline, like-for-like change, shading and words"
```

---

### Task 8: Readings, labs and the Trends rows

**Files:**
- Modify: `src/screens/trends/model.ts`
- Modify: `src/screens/trends/model.test.ts`

**Interfaces:**
- Consumes:
  - `formatValue` from `@/screens/track/format`; `decimalsFor`, `MGDL_PER_MMOL` from `@/screens/track/units`; `daysBetween` from `@/screens/track/periods`; `LAB_OPTIONS`, `type LabKind` from `@/screens/track/logKinds`; `HYPO_LEVEL_1_MGDL` from `@/screens/track/escalation`;
  - Task 2's `monthEnd`, `monthStart`, `windowOf`; Task 3's `compareReadings`, `labHistory`, `readingStats`, `type LabRow`; Task 5's `GLUCOSE_LINES`, `HIGH_GLUCOSE_MGDL`, `TRENDS`, `labPoints`, `readingsFor`, `type TrendId`; Task 6's `type PointSeries`, `type RangeSeries`.
- Produces:
  - `readingCount(n: number, hi: number, lo: number): string`;
  - `readingsView(input: TrendInput): TrendView`;
  - `interface LabView { lab: LabKind; title: string; headline: Headline; rows: LabRow[]; chart: ChartModel; table: { columns: string[]; rows: string[][] }; summary: string }`, `LAB_TITLE: Record<LabKind, string>`;
  - `labsView(lab: LabKind, data: TrendData, prefs: DisplayPrefs, today: string): LabView`;
  - `interface TrendRowView { id: TrendId; title: string; colour: string; value: string; spark: (number | null)[] }`;
  - `trendRow(def: TrendDef, data: TrendData, prefs: DisplayPrefs, ctx: DayContext): TrendRowView`.

- [ ] **Step 1: Add the failing tests.** In `src/screens/trends/model.test.ts`, replace the two imports from `@/health/observation` and `./model` with:

```ts
import { bpContext, newObservation, type Observation } from '@/health/observation';
import { dailyView, labsView, readingCount, readingsView, trendContext, trendRow } from './model';
```

Then add at the end of the file:

```ts
const g = (value: number, at: string, tag?: 'fasting' | 'afterMeal') =>
  newObservation({ kind: 'glucose', value, unit: 'mg/dL', at, scope: 'pointInTime', source: 'manual', ...(tag ? { tag } : {}) });
const GLUCOSE = [
  g(120, '2026-09-28T07:30:00+05:30', 'fasting'), g(118, '2026-09-29T07:30:00+05:30', 'fasting'), g(122, '2026-09-30T07:30:00+05:30', 'fasting'),
  g(118, '2026-10-05T07:30:00+05:30', 'fasting'), g(168, '2026-10-06T14:10:00+05:30', 'afterMeal'),
  g(280, '2026-10-07T13:00:00+05:30', 'afterMeal'), g(62, '2026-10-07T21:30:00+05:30'),
];
const week = windowOf('week', TODAY);

describe('the reading count says which readings are numeric (B-15)', () => {
  it('in words', () => {
    expect(readingCount(5, 0, 0)).toBe('5 readings, all with a number');
    expect(readingCount(1, 0, 0)).toBe('1 reading with a number');
    expect(readingCount(0, 0, 0)).toBe('0 readings');
    expect(readingCount(5, 0, 1)).toBe('6 readings: 5 with a number, 1 meter LO');
    expect(readingCount(0, 1, 2)).toBe('3 readings: none with a number, 2 meter LO and 1 meter HI');
  });
});

describe('a readings trend: Glucose (A-44, K-11)', () => {
  const view = readingsView({ def: TRENDS.glucose, window: week, data: data(GLUCOSE), prefs, ctx: ctx() });

  it('states the average with n, the range, the lows and highs, and each context', () => {
    expect(view.headline).toEqual({ statistic: 'Average', coverage: '4 readings, all with a number', value: '157', unit: 'mg/dL' });
    expect(view.stats).toEqual([
      { label: 'Range', value: '62–280 mg/dL' },
      { label: 'Below 70 mg/dL', value: '1' },
      { label: 'Above 250 mg/dL', value: '1' },
      { label: 'Fasting or before a meal', value: '118 mg/dL on average, 1 reading' },
      { label: 'After a meal', value: '224 mg/dL on average, 2 readings' },
      { label: 'Other times', value: '62 mg/dL on average, 1 reading' },
    ]);
    expect(view.meter).toBeUndefined();
  });

  it('compares means over the same days, with 3 days in both weeks', () => {
    expect(view.change).toEqual({ text: 'Higher than last week · +37 mg/dL', direction: 'higher', compared: 'Mon–Thu vs last Mon–Thu' });
  });

  it('lists each reading with its time, context and what it was', () => {
    expect(view.table).toEqual({
      columns: ['Day', 'Reading', 'Note'],
      rows: [
        ['Monday, 5 October', '118 mg/dL at 7:30 am, fasting', ''],
        ['Tuesday, 6 October', '168 mg/dL at 2:10 pm, after a meal', ''],
        ['Wednesday, 7 October', '280 mg/dL at 1:00 pm, after a meal', 'Above 250 mg/dL'],
        ['Wednesday, 7 October', '62 mg/dL at 9:30 pm', 'Low'],
      ],
    });
    expect(view.chart.slots[2].text).toBe('Wednesday, 7 October: 280 mg/dL at 1:00 pm, after a meal, above 250 mg/dL; 62 mg/dL at 9:30 pm, low.');
  });

  it('draws each context as its own series, flags the lows and highs, and labels the lines and the average', () => {
    expect(view.chart.series.map(s => s.kind === 'points' && [s.id, s.shape, s.points.length])).toEqual([
      ['beforeMeal', 'circle', 1], ['afterMeal', 'triangle', 2], ['other', 'square', 1],
    ]);
    const other = view.chart.series[2];
    expect(other.kind === 'points' && other.points[0]).toEqual({ slot: 2, at: (21 * 60 + 30) / 1440, value: 62, flag: 'low' });
    expect(view.chart.lines).toEqual([{ value: 70, label: '70 mg/dL' }, { value: 250, label: '250 mg/dL' }]);
    expect(view.chart.average).toEqual({ value: 157, label: 'Average 157 mg/dL' });
  });

  it('in mmol/L, the same readings in that unit, and the lines where the mg/dL lines are', () => {
    const mmol = readingsView({ def: TRENDS.glucose, window: week, data: data(GLUCOSE), prefs: { ...prefs, glucose: 'mmol/L' }, ctx: ctx() });
    expect(mmol.headline).toMatchObject({ value: '8.7', unit: 'mmol/L' });
    expect(mmol.chart.lines.map(l => l.label)).toEqual(['3.9 mmol/L', '13.9 mmol/L']);
    expect(mmol.chart.lines[0].value).toBeCloseTo(70 / 18, 9);
  });
});

describe('a week with only a meter’s LO (Review Focus 3)', () => {
  const lo = { date: '2026-10-06', glucoseDisplay: { display: 'LO', measuredAt: '2026-10-06T13:00:00+05:30' } } as unknown as CheckInRecord;
  const view = readingsView({ def: TRENDS.glucose, window: week, data: data(GLUCOSE.slice(0, 3), [], [lo]), prefs, ctx: ctx() });

  it('says no reading had a number, shows the LO above the average, and hides the change', () => {
    expect(view.headline).toEqual({ statistic: 'Average', coverage: '1 reading: none with a number, 1 meter LO', value: 'No numeric readings' });
    expect(view.meter).toBe('Not in the average: 1 LO. The meter showed this instead of a number.');
    expect(view.change).toEqual({ text: 'No change shown: a meter LO has no number, so an average would leave out the lowest reading.' });
    expect(view.stats).toEqual([{ label: 'Below 70 mg/dL', value: '1' }, { label: 'Above 250 mg/dL', value: '0' }]);
    expect(view.chart.slots[1].text).toBe('Tuesday, 6 October: Meter showed LO at 1:00 pm, below what the meter can show.');
  });

  it('never shows a 0 or NaN for a missing average', () => {
    expect(view.chart.average).toBeUndefined();
    expect(JSON.stringify(view)).not.toMatch(/NaN|Infinity/);
  });
});

describe('blood pressure: two numbers, each averaged on its own', () => {
  const half = (kind: 'bloodPressureSystolic' | 'bloodPressureDiastolic', value: number, day: string, id: string) =>
    newObservation({ kind, value, at: `${day}T07:30:00+05:30`, scope: 'pointInTime', source: 'manual', context: bpContext(id) });
  const view = readingsView({
    def: TRENDS.bp, window: week, prefs, ctx: ctx(),
    data: data([
      half('bloodPressureSystolic', 132, '2026-10-05', 'r1'), half('bloodPressureDiastolic', 84, '2026-10-05', 'r1'),
      half('bloodPressureSystolic', 184, '2026-10-06', 'r2'), half('bloodPressureDiastolic', 96, '2026-10-06', 'r2'),
      half('bloodPressureSystolic', 128, '2026-10-07', 'r3'),
    ]),
  });

  it('a headline of both averages, ranges for each, and the readings at 180/120 or higher counted', () => {
    expect(view.headline).toEqual({ statistic: 'Average', coverage: '3 readings, all with a number', value: '148/90', unit: 'mmHg' });
    expect(view.stats).toEqual([
      { label: 'Range, top number', value: '128–184 mmHg' },
      { label: 'Range, bottom number', value: '84–96 mmHg' },
      { label: '180/120 mmHg or higher', value: '1' },
    ]);
    expect(view.table.rows).toEqual([
      ['Monday, 5 October', '132/84 mmHg at 7:30 am', ''],
      ['Tuesday, 6 October', '184/96 mmHg at 7:30 am', 'Very high'],
      ['Wednesday, 7 October', '128/Not entered mmHg at 7:30 am', ''],
    ]);
  });
});

describe('labs: dated results with their intervals (A-45)', () => {
  const lab = (value: number, day: string) => newObservation({ kind: 'hba1c', value, unit: '%', at: `${day}T12:00:00+05:30`, scope: 'pointInTime', source: 'manual' });

  it('one result shows at once, with no daily data needed (V-J27)', () => {
    const view = labsView('hba1c', data([lab(7.1, TODAY)]), prefs, TODAY);
    expect(view.headline).toEqual({ statistic: 'Latest', coverage: '1 result', value: '7.1%' });
    expect(view.table.rows).toEqual([['Thursday, 8 October', '7.1%', 'First result']]);
    expect(view.chart.series[0].kind === 'points' && view.chart.series[0].points).toEqual([{ slot: 0, at: 7.5 / 31, value: 7.1 }]);
  });

  it('each later result says how long after the one before it came, spaced by the months between', () => {
    const view = labsView('hba1c', data([lab(6.9, '2026-10-07'), lab(7.4, '2026-03-02'), lab(7.1, '2026-06-02')]), prefs, TODAY);
    expect(view.rows.map(r => r.interval)).toEqual(['First result', '3 months after the one before', '4 months after the one before']);
    expect(view.chart.slots.map(s => s.label)).toEqual(['Mar 2026', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']);
    expect(view.headline.value).toBe('6.9%');
  });

  it('with none yet, says so', () => {
    expect(labsView('b12', data([]), prefs, TODAY).headline).toEqual({ statistic: 'Latest', coverage: '0 results', value: 'No Vitamin B12 results yet' });
  });
});

describe('a category’s row on the Trends tab (J§12.1)', () => {
  it('daily measures: the week’s figure with its statistic named, and the week’s days', () => {
    const row = trendRow(TRENDS.steps, data(STEPS.map(([d, v]) => steps(d, v))), prefs, ctx());
    expect(row).toEqual({
      id: 'steps', title: 'Steps', colour: '--cat-steps',
      value: 'A day on average this week: 6,167 steps', spark: [6000, 7000, 5500, null, null, null, null],
    });
    expect(trendRow(TRENDS.walk, data(STEPS.map(([d, v]) => steps(d, v))), prefs, ctx()).value).toBe('Total this week: 0 min');
  });

  it('readings: the latest, with when; labs: the latest result of any lab', () => {
    expect(trendRow(TRENDS.glucose, data(GLUCOSE), prefs, ctx())).toMatchObject({
      value: 'Latest: 62 mg/dL at 9:30 pm · Wed 7 Oct', spark: [120, 118, 122, 118, 168, 280, 62],
    });
    const hba1c = newObservation({ kind: 'hba1c', value: 7.1, unit: '%', at: `${TODAY}T12:00:00+05:30`, scope: 'pointInTime', source: 'manual' });
    expect(trendRow(TRENDS.labs, data([hba1c]), prefs, ctx()).value).toBe('Latest HbA1c: 7.1% · Thu 8 Oct');
    expect(trendRow(TRENDS.mood, data([]), prefs, ctx()).value).toBe('No readings yet');
  });
});
```

- [ ] **Step 2: Run them to check they fail**

Run: `npx vitest run src/screens/trends/model.test.ts`
Expected: FAIL, "readingsView is not a function" (and the others).

- [ ] **Step 3: Extend the module.** In `src/screens/trends/model.ts`, replace the import block with:

```ts
import { format } from 'date-fns';
import type { DayRange } from '@/health/aggregate';
import { isDay } from '@/health/observation';
import { isEnrolled } from '@/health/recommend';
import { restDaysOf } from '@/screens/home/week';
import { HYPO_LEVEL_1_MGDL } from '@/screens/track/escalation';
import { formatDayLong, formatValue, type DisplayPrefs } from '@/screens/track/format';
import { LAB_OPTIONS, type LabKind } from '@/screens/track/logKinds';
import { daysBetween } from '@/screens/track/periods';
import { MGDL_PER_MMOL, decimalsFor, formatNumber } from '@/screens/track/units';
import type { UserSettings } from '@/types';
import type { UserProfile } from '@/types/profile';
import { MARK_WORDS, type ChartModel, type ChartSeries, type PointSeries, type RangeSeries, type Slot, type SlotMark } from './chart';
import { GLUCOSE_LINES, HIGH_GLUCOSE_MGDL, TRENDS, figuresFor, labPoints, readingsFor, type TrendDef, type TrendId } from './metrics';
import {
  compareRanges, comparedText, monthEnd, monthStart, previousName, previousWindow, rangeText, windowOf, windowTitle,
  type TrendPeriod, type TrendWindow,
} from './periods';
import { firstRecordDay, stretchedDays, type TrendData } from './records';
import {
  compareDaily, compareReadings, dailyStats, dayContext, figureOf, labHistory, readingStats, statisticFor, statusList,
  type Comparison, type DailyRule, type DayContext, type DayFigure, type Direction, type LabRow, type Statistic,
} from './stats';
```

Then add at the end of the file:

```ts
const READING: readonly [string, string] = ['reading', 'readings'];
const lowerFirst = (s: string) => `${s.charAt(0).toLowerCase()}${s.slice(1)}`;

/** "5 readings, all with a number", "6 readings: 5 with a number, 1 meter LO" (B-15). */
export function readingCount(n: number, hi: number, lo: number): string {
  const total = n + hi + lo;
  const meter = [lo > 0 ? `${formatNumber(lo)} meter LO` : '', hi > 0 ? `${formatNumber(hi)} meter HI` : ''].filter(Boolean).join(' and ');
  if (meter) return `${countText(total, READING)}: ${n === 0 ? 'none' : formatNumber(n)} with a number, ${meter}`;
  if (total === 0) return '0 readings';
  return total === 1 ? '1 reading with a number' : `${countText(total, READING)}, all with a number`;
}

/** A pressure is two numbers and back pain isn't leg pain: each is averaged on its own, the first in the headline. */
const GROUPS: Partial<Record<TrendId, readonly { id: string; words: string }[]>> = {
  bp: [{ id: 'systolic', words: 'top number' }, { id: 'diastolic', words: 'bottom number' }],
  back: [{ id: 'back', words: 'back' }, { id: 'leg', words: 'leg' }],
};

/** A readings trend over its window: the average with n, the spread, the meter's HI and LO, and each reading (A-44, K-11). */
export function readingsView(input: TrendInput): TrendView {
  const { def, window: w, data, prefs, ctx } = input;
  const prev = previousWindow(w);
  const r = readingsFor(def.id, { from: prev.from, to: w.to }, data, prefs);
  const unit = def.unit(prefs);
  const d = def.decimals(prefs);
  const fmt = (v: number) => formatNumber(v, d);
  const title = windowTitle(w, ctx.today);
  const against = previousName(w, ctx.today);
  const groups = GROUPS[def.id];
  const primary = groups?.[0].id;
  const of = (series?: string) => (series === undefined ? r.points : r.points.filter(p => p.series === series));
  const stat = (range: DayRange, series?: string) => readingStats(range, of(series), r.meters, ctx);
  const inside = (day: string) => day >= w.from && day <= w.to;
  const all = stat(w);
  const main = groups ? groups.map(g => stat(w, g.id)) : [all];
  const texts = r.texts.filter(t => inside(t.day));
  // A pressure's two numbers are one reading: count the readings as they're listed, a meter's display among them.
  const numeric = texts.length - all.hi - all.lo;

  const value = def.id === 'bp'
    ? (main.some(s => s.mean !== undefined) ? main.map(s => (s.mean === undefined ? 'Not entered' : fmt(s.mean))).join('/') : undefined)
    : main[0].mean === undefined ? undefined : fmt(main[0].mean);
  const headline: Headline = {
    statistic: def.id === 'back' ? 'Back pain on average' : 'Average',
    coverage: readingCount(numeric, all.hi, all.lo),
    ...(value === undefined ? { value: texts.length === 0 ? 'No readings' : 'No numeric readings' } : { value, unit }),
  };

  const ranges = compareRanges(w, ctx.today);
  const lo = all.lo + stat(prev).lo;
  const comparison: Comparison = !ranges ? { shown: false, reason: 'fewDays' }
    // A LO anywhere in either period hides the change, not only on the days compared (B-15).
    : lo > 0 ? { shown: false, reason: 'meterLo' }
      : compareReadings(stat(ranges.current, primary), stat(ranges.previous, primary), d);
  const change = changeOf(comparison, against, def.id === 'bp' ? `${unit}, top number` : unit, d, w.period, ranges && comparedText(w, ranges, ctx.today));

  const stats: StatItem[] = [];
  (groups ?? [{ id: '', words: '' }]).forEach((g, i) => {
    const s = main[i];
    if (s.min !== undefined && s.max !== undefined) stats.push({ label: g.words ? `Range, ${g.words}` : 'Range', value: `${fmt(s.min)}–${fmt(s.max)} ${unit}` });
  });
  if (def.id === 'back' && main[1].mean !== undefined) stats.push({ label: 'Leg pain on average', value: `${fmt(main[1].mean)} ${unit}` });
  if (def.id === 'glucose') {
    const line = GLUCOSE_LINES[prefs.glucose];
    stats.push({ label: `Below ${line.low}`, value: formatNumber(all.lows) }, { label: `Above ${line.high}`, value: formatNumber(all.highs) });
    const contexts = r.series.flatMap(sr => {
      const s = stat(w, sr.id);
      return s.mean === undefined ? [] : [{ label: sr.label, mean: s.mean, n: s.n }];
    });
    if (contexts.length > 1) for (const c of contexts) stats.push({ label: c.label, value: `${fmt(c.mean)} ${unit} on average, ${countText(c.n, READING)}` });
  }
  if (def.id === 'bp') stats.push({ label: '180/120 mmHg or higher', value: formatNumber(texts.filter(t => t.note === 'Very high').length) });

  const shown = [all.lo > 0 ? `${formatNumber(all.lo)} LO` : '', all.hi > 0 ? `${formatNumber(all.hi)} HI` : ''].filter(Boolean).join(' and ');
  const meter = shown ? `Not in the average: ${shown}. The meter showed ${all.lo + all.hi === 1 ? 'this' : 'these'} instead of a number.` : undefined;
  const notes: string[] = [];
  const list = statusList(all.status);
  if (list) notes.push(`Includes ${list}.`);

  const dayly = w.period === 'week' || w.period === 'month';
  const colour = `var(${def.colour})`;
  const slotOf = (day: string) => w.buckets.findIndex(b => day >= b.from && day <= b.to);
  const series: ChartSeries[] = dayly
    ? r.series.map((sr): PointSeries => ({
      kind: 'points', id: sr.id, label: sr.label, colour, shape: sr.shape,
      points: r.points.filter(p => p.series === sr.id && inside(p.day)).map(p => ({
        slot: slotOf(p.day),
        // Where through its day the reading was taken, on the wall clock it was recorded in.
        at: (Number(p.at.slice(11, 13)) * 60 + Number(p.at.slice(14, 16))) / 1440,
        value: p.value,
        ...(p.low ? { flag: 'low' as const } : p.high ? { flag: 'high' as const } : {}),
      })),
    })).filter(s => s.points.length > 0)
    : (groups ?? [{ id: '', words: '' }]).map((g): RangeSeries => ({
      kind: 'ranges',
      id: g.id || 'all',
      label: r.series.find(sr => sr.id === g.id)?.label ?? def.title,
      colour,
      values: w.buckets.map(b => {
        const s = stat(b, g.id || undefined);
        return s.mean === undefined || s.min === undefined || s.max === undefined ? null : { min: s.min, max: s.max, mean: s.mean };
      }),
    }));
  const mmol = prefs.glucose === 'mmol/L';
  const lines = def.id !== 'glucose' ? [] : [
    { value: mmol ? HYPO_LEVEL_1_MGDL / MGDL_PER_MMOL : HYPO_LEVEL_1_MGDL, label: GLUCOSE_LINES[prefs.glucose].low },
    { value: mmol ? HIGH_GLUCOSE_MGDL / MGDL_PER_MMOL : HIGH_GLUCOSE_MGDL, label: GLUCOSE_LINES[prefs.glucose].high },
  ];
  const average = groups ? undefined : all.mean;

  const said = (b: DayRange): string => {
    if (b.from > ctx.today) return 'Still to come';
    if (dayly) {
      const day = texts.filter(t => t.day === b.from).map(t => `${t.text}${t.note ? `, ${lowerFirst(t.note)}` : ''}`);
      return day.length ? day.join('; ') : 'No readings';
    }
    const s = stat(b, primary);
    return s.mean === undefined || s.min === undefined || s.max === undefined ? 'No readings'
      : `${countText(s.n, READING)}, ${fmt(s.min)} to ${fmt(s.max)} ${unit}, average ${fmt(s.mean)} ${unit}`;
  };
  const slots: Slot[] = w.buckets.map(b => {
    const name = slotName(w.period, b, ctx.today);
    const future = b.from > ctx.today;
    return {
      key: b.from, label: slotLabel(w.period, b), name, range: b,
      ...(future ? { future: true as const } : {}),
      ...(dayly && !future ? { day: b.from } : {}),
      text: `${name}: ${said(b)}.`,
    };
  });

  const table = dayly
    ? { columns: ['Day', 'Reading', 'Note'], rows: texts.map(t => [formatDayLong(t.day, ctx.today), t.text, t.note ?? '']) }
    : {
      columns: [w.period === 'sixMonths' ? 'Week' : 'Month', 'Readings', 'Range', 'Average'],
      rows: w.buckets.flatMap(b => {
        const s = stat(b, primary);
        return s.mean === undefined || s.min === undefined || s.max === undefined ? []
          : [[slotName(w.period, b, ctx.today), formatNumber(s.n), `${fmt(s.min)}–${fmt(s.max)} ${unit}`, `${fmt(s.mean)} ${unit}`]];
      }),
    };

  return {
    title, headline, change, stats, notes, ...(meter ? { meter } : {}),
    chart: { slots, series, lines, unit, decimals: d, ...(average !== undefined ? { average: { value: average, label: `Average ${fmt(average)} ${unit}` } } : {}) },
    table,
    summary: summaryOf(def.title, title, headline, change, [...(meter ? [meter] : []), ...notes]),
  };
}

export const LAB_TITLE = Object.fromEntries(LAB_OPTIONS.map(o => [o.kind, o.title])) as Record<LabKind, string>;

export interface LabView {
  lab: LabKind;
  title: string;
  headline: Headline;
  rows: LabRow[];
  chart: ChartModel;
  table: { columns: string[]; rows: string[][] };
  summary: string;
}

/** One lab's results (A-45): dated points with their intervals, from the first, with no period and no 7-day rule. */
export function labsView(lab: LabKind, data: TrendData, prefs: DisplayPrefs, today: string): LabView {
  const title = LAB_TITLE[lab];
  const rows = labHistory(labPoints(lab, data.observations, prefs));
  const latest = rows.at(-1);
  const shown = (r: LabRow) => formatValue(r.value, lab, r.unit);
  const headline: Headline = {
    statistic: 'Latest',
    coverage: countText(rows.length, ['result', 'results']),
    value: latest ? shown(latest) : `No ${title} results yet`,
  };
  // A slot a month, from the first result's month to this one, so results sit as far apart as they were taken.
  const end = latest && latest.day > today ? latest.day : today;
  const months: DayRange[] = [];
  for (let m = monthStart(rows[0]?.day ?? today); m <= end; m = monthStart(m, 1)) months.push({ from: m, to: monthEnd(m) });
  const slotOf = (day: string) => months.findIndex(b => day >= b.from && day <= b.to);
  const slots: Slot[] = months.map((b, i) => {
    const name = format(noon(b.from), 'MMMM yyyy');
    const here = rows.filter(r => r.day >= b.from && r.day <= b.to);
    return {
      key: b.from, name, range: b,
      label: format(noon(b.from), i === 0 || b.from.endsWith('-01-01') ? 'MMM yyyy' : 'MMM'),
      text: `${name}: ${here.length ? here.map(r => `${shown(r)} on ${format(noon(r.day), 'd MMM')}`).join('; ') : 'No results'}.`,
    };
  });
  const points = rows.map(r => {
    const slot = slotOf(r.day);
    return { slot, at: (Number(r.day.slice(8, 10)) - 0.5) / (daysBetween(months[slot].from, months[slot].to) + 1), value: r.value };
  });
  return {
    lab, title, headline, rows,
    chart: {
      slots, lines: [], unit: latest?.unit ?? '', decimals: latest ? decimalsFor(lab, latest.unit) : 0,
      series: rows.length ? [{ kind: 'points', id: lab, label: title, colour: `var(${TRENDS.labs.colour})`, shape: 'circle', points }] : [],
    },
    table: { columns: ['Date', 'Result', 'Interval'], rows: rows.map(r => [formatDayLong(r.day, today), shown(r), r.interval]) },
    summary: `${title}. ${headline.statistic}, ${headline.coverage}: ${headline.value}.${rows.length > 1 ? ` The first was on ${formatDayLong(rows[0].day, today)}.` : ''}`,
  };
}

export interface TrendRowView {
  id: TrendId;
  title: string;
  colour: string;
  /** The figure with its statistic named: "A day on average this week: 6,167 steps" (J§12.1). */
  value: string;
  /** The small chart's values, oldest first; empty draws none. */
  spark: (number | null)[];
}

/** A category's row on the Trends tab: its week, or its latest reading or result. */
export function trendRow(def: TrendDef, data: TrendData, prefs: DisplayPrefs, ctx: DayContext): TrendRowView {
  const base = { id: def.id, title: def.title, colour: def.colour };
  if (def.family === 'labs') {
    const latest = LAB_OPTIONS
      .flatMap(o => labHistory(labPoints(o.kind, data.observations, prefs)).map(r => ({ lab: o.kind, r })))
      .sort((a, b) => a.r.day.localeCompare(b.r.day))
      .at(-1);
    return {
      ...base,
      value: latest ? `Latest ${LAB_TITLE[latest.lab]}: ${formatValue(latest.r.value, latest.lab, latest.r.unit)} · ${shortDay(latest.r.day)}` : 'No results yet',
      spark: [],
    };
  }
  if (def.family === 'readings') {
    const r = readingsFor(def.id, { from: ctx.since ?? ctx.today, to: ctx.today }, data, prefs);
    const last = r.texts.at(-1);
    const primary = GROUPS[def.id]?.[0].id;
    return {
      ...base,
      value: last ? `Latest: ${last.text} · ${shortDay(last.day)}` : 'No readings yet',
      spark: r.points.filter(p => primary === undefined || p.series === primary).slice(-10).map(p => p.value),
    };
  }
  const view = dailyView({ def, window: windowOf('week', ctx.today), data, prefs, ctx });
  const h = view.headline;
  const bars = view.chart.series.find(s => s.kind === 'bars' && !s.previous);
  return {
    ...base,
    value: h.unit ? `${h.statistic} this week: ${h.value} ${h.unit}` : `${h.value} this week`,
    spark: bars?.kind === 'bars' ? bars.values : [],
  };
}
```

A meter LO's `at` is local time, so these tests pin the zone, as the top of the file does.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/screens/trends/model.test.ts`
Expected: PASS.

- [ ] **Step 5: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/trends/model.ts src/screens/trends/model.test.ts
git commit -m "feat: Show readings with their spread and meter displays, labs as dated results, and each Trends row"
```

---

### Task 9: Chart tokens, one shared measure, and the stat grid

**Files:**
- Modify: `src/index.css` (`--trend-previous`, in both Apple foundation blocks)
- Modify: `src/design/tokens.node.test.ts`
- Create: `src/components/hig/useMeasure.ts`
- Modify: `src/components/hig/Chart.tsx`, `src/screens/track/PairChart.tsx`, `src/screens/track/BackLegChart.tsx` (their three copies of the hook go)
- Create: `src/components/hig/StatGrid.tsx`

**Interfaces:**
- Produces:
  - the CSS custom property `--trend-previous` (light `oklch(0.6 0 0)`, dark `oklch(0.62 0 0)`);
  - `useMeasure<T extends HTMLElement = HTMLElement>(): [RefObject<T | null>, number, number]` (the element, its floored width, its text size);
  - `StatGrid({ items, className }: { items: readonly { label: string; value: string }[]; className?: string })`.
- Consumes: `textSize` from `./scale`; the `token`, `contrast` and `THEMES` helpers already in `tokens.node.test.ts`.

- [ ] **Step 1: Write the failing test.** In `src/design/tokens.node.test.ts`, add after the category colours' `describe`:

```ts
describe('trend charts (B-15, journey §20.3)', () => {
  for (const [selector, theme] of THEMES) {
    const card = token(selector, '--grouped-card');
    it(`in ${theme}: the period before, the hatching and the chosen outline are 3:1 on the card, caution text 4.5:1`, () => {
      expect(contrast(token(selector, '--trend-previous'), card)).toBeGreaterThanOrEqual(3);
      expect(contrast(token(selector, '--muted-foreground'), card)).toBeGreaterThanOrEqual(3);
      expect(contrast(token(selector, '--foreground', '--foreground'), card)).toBeGreaterThanOrEqual(3);
      expect(contrast(token(selector, '--caution'), card)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/design/tokens.node.test.ts`
Expected: FAIL, "--trend-previous not found under :root {".

- [ ] **Step 3: Add the token.** In `src/index.css`, in the `:root {` block that declares `--grouped-card`, after the line `--segment-thumb: oklch(1 0 0);`, add:

```css
  /* Trends (B-15): the period before, drawn behind the current one in grey
     and striped, 3:1 or more on the card (src/design/tokens.node.test.ts). */
  --trend-previous: oklch(0.6 0 0);
```

In the `.dark {` block that declares `--grouped-card`, after the line `--segment-thumb: oklch(0.5 0.004 286);`, add:

```css
  --trend-previous: oklch(0.62 0 0);
```

The charts use it as `var(--trend-previous)` in SVG styles, so it isn't registered with Tailwind.

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/design/tokens.node.test.ts`
Expected: PASS. Light measures 3.9:1 and dark 4.9:1.

- [ ] **Step 5: One measuring hook.** Create `src/components/hig/useMeasure.ts`:

```ts
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { textSize } from './scale';

/**
 * A chart's container width and text size, measured before the first paint,
 * so a chart never flashes at a guessed size. A ResizeObserver keeps both
 * right through rotation and a split view; they change only when the box
 * does, never per frame. Every chart shares this one.
 */
export function useMeasure<T extends HTMLElement = HTMLElement>(): [RefObject<T | null>, number, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  const [fontPx, setFontPx] = useState(13);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = (px: number) => {
      // Floored, never rounded: a chart half a pixel wider than its box is a
      // horizontal scrollbar at 320 px.
      setWidth(Math.floor(px));
      setFontPx(textSize(parseFloat(getComputedStyle(el).fontSize)));
    };
    update(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    // The observer's content box ignores transforms, so a parent's press
    // animation can't leave the chart measured at its scaled-down width.
    const ro = new ResizeObserver(([entry]) => update(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width, fontPx];
}
```

In `src/components/hig/Chart.tsx`, `src/screens/track/PairChart.tsx` and `src/screens/track/BackLegChart.tsx`:
- delete the local `useMeasure` function and its doc comment;
- add `import { useMeasure } from '@/components/hig/useMeasure';` (in `Chart.tsx`: `import { useMeasure } from './useMeasure';`);
- remove the imports that are now unused (`useLayoutEffect`, `useState`, `RefObject`, `textSize`, `useRef` where nothing else uses them). `npx tsc -b` names any that are left.

The call sites stay as they are: `useMeasure()` in the first two and `useMeasure<HTMLDivElement>()` in the third.

- [ ] **Step 6: The stat grid** (J§20.2: "Label, value with unit, and statistic, in 2 columns, or 1 at large text"). Create `src/components/hig/StatGrid.tsx`:

```tsx
import { cn } from '@/lib/utils';

/**
 * Statistics as label and value, the value carrying its unit and the label
 * naming the statistic: two columns, or one when the space is narrow or the
 * text is large. A definition list, so VoiceOver reads each label with its
 * value.
 */
export function StatGrid({ items, className }: { items: readonly { label: string; value: string }[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <div className={cn('@container', className)}>
      <dl className="grid grid-cols-2 gap-2 @max-[22rem]:grid-cols-1">
        {items.map(item => (
          <div key={item.label} className="flex flex-col gap-0.5 rounded-xl bg-grouped-card px-4 py-3">
            <dt className="text-[length:var(--text-footnote)] leading-snug text-muted-foreground [overflow-wrap:break-word]">{item.label}</dt>
            <dd className="numeric text-[length:var(--text-body)] font-semibold leading-snug [overflow-wrap:break-word]">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
```

- [ ] **Step 7: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/index.css src/design/tokens.node.test.ts src/components/hig/useMeasure.ts src/components/hig/Chart.tsx src/screens/track/PairChart.tsx src/screens/track/BackLegChart.tsx src/components/hig/StatGrid.tsx
git commit -m "feat: Add the trend chart's tokens, one shared chart measure, and the stat grid"
```

---

### Task 10: The shared chart and its controls

**Files:**
- Create: `src/screens/trends/TrendChart.tsx`
- Create: `src/screens/trends/PeriodControl.tsx`
- Create: `src/screens/trends/TrendHeadlines.tsx`
- Modify: `src/design/tokens.node.test.ts`

**Interfaces:**
- Consumes:
  - Task 6's `domainOf`, `legendOf`, `selectable`, `slotAt`, `stepValue` and the model types; Task 5's `type Shape`; Task 7's `type Change`, `type Headline`; Task 2's `TREND_PERIODS`, `type TrendPeriod`;
  - `bands`, `barExtent`, `gutterFor`, `labelWidth`, `placeLabels`, `plotFrame`, `plotY`, `thinLabels`, `type LinearDomain`, `type Plot` from `@/components/hig/scale`; Task 9's `useMeasure`;
  - `MOTION`, `springLinear` from `@/design/motion`; `useReducedMotion` from `@/hooks/useReducedMotion`; `formatNumber` from `@/screens/track/units`.
- Produces:
  - `TrendChart({ model, label, summary, table, view, origin }: { model: ChartModel; label: string; summary: string; table: { columns: string[]; rows: string[][] }; view: string; origin: { path: string; label: string; search?: string } })`;
  - `PeriodControl({ period, onPeriod, title, labels, canPrevious, canNext, onPrevious, onNext }: { period: TrendPeriod; onPeriod: (p: TrendPeriod) => void; title: string; labels: { previous: string; next: string }; canPrevious: boolean; canNext: boolean; onPrevious: () => void; onNext: () => void })`;
  - `TrendHeadlines({ headline, change, meter }: { headline: Headline; change: Change; meter?: string })`.

Components aren't unit-rendered here. A source test pins the two drawing rules a reviewer can't see from the model (D71), and Task 15's journeys use the chart in Chromium.

- [ ] **Step 1: Write the failing test.** In `src/design/tokens.node.test.ts`, add:

```ts
describe('the trend chart’s selection and the period before (B-15, D71)', () => {
  it('outlines the chosen slot in body ink, stripes the period before in its token, and fades nothing', () => {
    const chart = readFileSync(path.resolve(__dirname, '../screens/trends/TrendChart.tsx'), 'utf8');
    expect(chart).toContain("stroke: 'var(--foreground)'");
    expect(chart).toContain('<pattern id={`${uid}-previous`}');
    expect(chart).toContain("fill: 'var(--trend-previous)'");
    expect(chart).not.toMatch(/[oO]pacity[^\n]*0?\.6\b/);
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/design/tokens.node.test.ts`
Expected: FAIL, "ENOENT: no such file or directory" for `TrendChart.tsx`.

- [ ] **Step 3: Write** `src/screens/trends/TrendChart.tsx`

```tsx
/**
 * The shared trend chart (journey §12.2, §20.2; B-15; M21). It draws a
 * `ChartModel` and works out no statistic: the period before behind in grey
 * and striped, the current bars in the category colour, readings by shape,
 * weekly or monthly ranges, a dashed average named in the legend, labelled
 * reference lines, and hatched rest and status days.
 *
 * The whole plot is one slider: a tap or a drag anywhere chooses the slot
 * under it, and the arrow keys, Home, End and Escape do the same. The chosen
 * slot is outlined in body ink and nothing else fades (D71); its words
 * appear above the plot, with "See the day" for a day. "Show as list" opens
 * the same figures as a table, and VoiceOver hears the summary.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { bands, barExtent, gutterFor, labelWidth, placeLabels, plotFrame, plotY, thinLabels, type LinearDomain, type Plot } from '@/components/hig/scale';
import { useMeasure } from '@/components/hig/useMeasure';
import { MOTION, springLinear } from '@/design/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { formatNumber } from '@/screens/track/units';
import {
  domainOf, legendOf, selectable, slotAt, stepValue,
  type BarSeries, type ChartModel, type LegendItem, type PointSeries, type RangeSeries,
} from './chart';
import type { Shape } from './metrics';

/** The plot's height, in CSS pixels. Its text follows the person's text size. */
const HEIGHT = 200;

type Y = (value: number) => number;

export function TrendChart({ model, label, summary, table, view, origin }: {
  model: ChartModel;
  /** The slider's name: "Steps, This week". */
  label: string;
  /** The view in sentences, for VoiceOver (A-63). */
  summary: string;
  /** "Show as list" (K-40). */
  table: { columns: string[]; rows: string[][] };
  /** Changes with the period or the window: the plot fades over, and a choice is put down (M21). */
  view: string;
  /** Where "See the day" says it came from. */
  origin: { path: string; label: string; search?: string };
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const reduced = useReducedMotion();
  const [frame, width, fontPx] = useMeasure<HTMLDivElement>();
  const root = useRef<HTMLDivElement>(null);
  const [chosen, setChosen] = useState<{ view: string; index: number }>();
  const [listOpen, setListOpen] = useState(false);
  // A choice belongs to the view it was made in: a new period or window starts with none, with no effect needed.
  const index = chosen?.view === view ? chosen.index : undefined;
  const max = selectable(model);
  const choose = (i: number | undefined) => setChosen(i === undefined ? undefined : { view, index: i });

  // A tap anywhere outside the chart puts the choice down (M21).
  useEffect(() => {
    if (index === undefined) return;
    const away = (e: PointerEvent) => {
      if (e.target instanceof Node && !root.current?.contains(e.target)) setChosen(undefined);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [index]);

  const { domain, ticks } = domainOf(model);
  const tickText = (t: number) => formatNumber(t, Number.isInteger(domain.step) ? 0 : domain.step >= 0.1 ? 1 : 2);
  const sized = gutterFor(ticks, fontPx);
  // Room for the tick labels as written, with their digit grouping ("10,000").
  const gutter = { ...sized, left: Math.max(sized.left, labelWidth(Math.max(1, ...ticks.map(t => tickText(t).length)), fontPx) + 8) };
  const plot = plotFrame(width, HEIGHT, gutter);
  const y: Y = plot ? plotY(domain, plot) : () => Number.NaN;
  const n = model.slots.length;
  const slot = index === undefined ? undefined : model.slots[index];

  const pick = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!plot || max === 0) return;
    const i = slotAt(e.clientX - e.currentTarget.getBoundingClientRect().left, plot, n);
    if (i !== undefined) choose(Math.min(i, max - 1));
  };
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const now = index === undefined ? 0 : index + 1;
    const next = stepValue(e.key, now, max);
    // Escape with nothing chosen is the page's, not the chart's.
    if (next === undefined || (e.key === 'Escape' && now === 0)) return;
    e.preventDefault();
    choose(next === 0 ? undefined : next - 1);
  };
  const appear = reduced ? undefined : { animationDuration: `${MOTION.springQuick.cssMs}ms`, animationTimingFunction: springLinear(0) };
  const fade = reduced ? undefined : { animationDuration: `${MOTION.fade}ms` };

  return (
    <div ref={root} className="flex flex-col gap-3">
      <Patterns uid={uid} />
      {/* The chosen slot in words, above the plot (M21); a hint until one is chosen. */}
      <div className="min-h-[3lh] text-[length:var(--text-subhead)] leading-snug">
        {slot ? (
          <div key={slot.key} className={reduced ? 'flex flex-wrap items-center gap-x-3' : 'flex flex-wrap items-center gap-x-3 animate-in fade-in slide-in-from-bottom-1'} style={appear}>
            <p className="font-medium [overflow-wrap:break-word]">{slot.text}</p>
            {slot.day && <Link to={`/day/${slot.day}`} state={origin} className="press-feedback inline-flex min-h-12 items-center font-semibold text-tint">See the day</Link>}
          </div>
        ) : (
          <p className="text-muted-foreground">Tap or drag across the chart, or use the arrow keys, to read it.</p>
        )}
      </div>
      <div ref={frame} className="relative text-[length:var(--text-footnote)]" style={plot ? { height: HEIGHT } : undefined}>
        {plot && (
          <div
            role="slider"
            tabIndex={0}
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={index === undefined ? 0 : index + 1}
            aria-valuetext={slot?.text ?? 'Nothing chosen'}
            onKeyDown={keys}
            onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); pick(e); }}
            onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e); }}
            className="absolute inset-0 touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-tint"
          >
            <svg width={width} height={HEIGHT} aria-hidden className="block">
              <Grid ticks={ticks} text={tickText} plot={plot} y={y} />
              <g key={view} className={reduced ? undefined : 'animate-in fade-in'} style={fade}>
                <Marks model={model} plot={plot} uid={uid} />
                <Bars model={model} plot={plot} y={y} uid={uid} />
                <Ranges model={model} plot={plot} y={y} />
                <Points model={model} plot={plot} y={y} />
                <Lines model={model} plot={plot} y={y} domain={domain} />
              </g>
              <Labels model={model} plot={plot} width={width} fontPx={fontPx} />
              {index !== undefined && (
                <rect
                  x={plot.left + (index * plot.width) / n + 1} y={plot.top - 2}
                  width={Math.max(2, plot.width / n - 2)} height={plot.height + 4} rx={4}
                  fill="none" style={{ stroke: 'var(--foreground)' }} strokeWidth={2}
                />
              )}
            </svg>
          </div>
        )}
      </div>
      <Legend items={legendOf(model)} {...(model.average ? { average: model.average.label } : {})} uid={uid} />
      {plot && (
        <button
          type="button"
          aria-expanded={listOpen}
          aria-controls={`${uid}-list`}
          onClick={() => setListOpen(open => !open)}
          className="press-feedback min-h-12 self-start rounded-full bg-tint/10 px-4 text-[length:var(--text-subhead)] font-semibold text-tint"
        >
          {listOpen ? 'Hide list' : 'Show as list'}
        </button>
      )}
      {/* With no room for a plot, the list is the chart. */}
      {(listOpen || !plot) && <Table id={`${uid}-list`} caption={label} table={table} />}
      <p className="sr-only">{summary}</p>
    </div>
  );
}

/** The stripes for the period before and the hatching for shaded days, used by the plot and the legend. */
function Patterns({ uid }: { uid: string }) {
  return (
    <svg width="0" height="0" aria-hidden className="absolute">
      <defs>
        <pattern id={`${uid}-previous`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" style={{ fill: 'var(--trend-previous)' }} />
          <line x1="0" y1="0" x2="0" y2="6" style={{ stroke: 'var(--grouped-card)' }} strokeWidth="2" />
        </pattern>
        <pattern id={`${uid}-mark`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <line x1="0" y1="0" x2="0" y2="6" style={{ stroke: 'var(--muted-foreground)' }} strokeWidth="1.5" />
        </pattern>
      </defs>
    </svg>
  );
}

function Grid({ ticks, text, plot, y }: { ticks: number[]; text: (t: number) => string; plot: Plot; y: Y }) {
  return (
    // Tabular digits: every digit the same width, which is what the gutter is sized for.
    <g className="numeric text-muted-foreground">
      {ticks.map(t => (
        <g key={t}>
          <line x1={plot.left} x2={plot.left + plot.width} y1={y(t)} y2={y(t)} stroke="currentColor" strokeWidth={1} className="text-separator" />
          <text x={plot.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fill="currentColor">{text(t)}</text>
        </g>
      ))}
    </g>
  );
}

/** Rest and status days, hatched across the plot: shaded and named, never a zero (K-49). */
function Marks({ model, plot, uid }: { model: ChartModel; plot: Plot; uid: string }) {
  const w = plot.width / model.slots.length;
  return (
    <g>
      {model.slots.map((s, i) => s.mark && (
        <rect key={s.key} x={plot.left + i * w} y={plot.top} width={w} height={plot.height} style={{ fill: `url(#${uid}-mark)` }} />
      ))}
    </g>
  );
}

/** The period before at full width behind, the current bars narrower in front; a recorded 0 is a hairline. */
function Bars({ model, plot, y, uid }: { model: ChartModel; plot: Plot; y: Y; uid: string }) {
  const n = model.slots.length;
  const bars = model.series.filter((s): s is BarSeries => s.kind === 'bars');
  const behind = bars.filter(s => s.previous);
  const front = bars.filter(s => !s.previous);
  const wide = bands(n, plot.width, 0.12);
  const narrow = bands(n, plot.width, 0.45);
  const base = y(0);
  const bottom = plot.top + plot.height;
  return (
    <g>
      {behind.map(s => s.values.map((v, i) => {
        if (v === null || !wide[i]) return null;
        const e = barExtent(y(v), base, plot.top, bottom);
        return (
          <rect
            key={`${s.id}-${i}`} x={plot.left + wide[i].x} y={e.y} width={wide[i].width} height={e.height} rx={2}
            style={{ fill: `url(#${uid}-previous)`, stroke: 'var(--trend-previous)' }} strokeWidth={1}
          />
        );
      }))}
      {front.map((s, j) => s.values.map((v, i) => {
        if (v === null || !narrow[i]) return null;
        const part = narrow[i].width / front.length;
        const e = barExtent(y(v), base, plot.top, bottom);
        return <rect key={`${s.id}-${i}`} x={plot.left + narrow[i].x + j * part} y={e.y} width={part} height={e.height} rx={2} style={{ fill: s.colour }} />;
      }))}
    </g>
  );
}

/** Each reading at its time of day across its slot, by shape; one past a line has a caution ring as well as its words. */
function Points({ model, plot, y }: { model: ChartModel; plot: Plot; y: Y }) {
  const w = plot.width / model.slots.length;
  const series = model.series.filter((s): s is PointSeries => s.kind === 'points');
  return (
    <g>
      {series.map(s => s.points.map((p, i) => {
        const cx = plot.left + (p.slot + Math.min(0.85, Math.max(0.15, p.at))) * w;
        const cy = y(p.value);
        return (
          <g key={`${s.id}-${i}`}>
            {p.flag && <circle cx={cx} cy={cy} r={8} fill="none" style={{ stroke: 'var(--caution)' }} strokeWidth={2} />}
            <ShapeMark shape={s.shape} x={cx} y={cy} size={9} colour={s.colour} />
          </g>
        );
      }))}
    </g>
  );
}

/** A week's or a month's readings: lowest to highest, with the mean marked. */
function Ranges({ model, plot, y }: { model: ChartModel; plot: Plot; y: Y }) {
  const w = plot.width / model.slots.length;
  const series = model.series.filter((s): s is RangeSeries => s.kind === 'ranges');
  return (
    <g>
      {series.map((s, j) => s.values.map((r, i) => {
        if (!r) return null;
        const cx = plot.left + (i + 0.5) * w + (j - (series.length - 1) / 2) * 6;
        return (
          <g key={`${s.id}-${i}`}>
            <line x1={cx} x2={cx} y1={y(r.max)} y2={y(r.min)} style={{ stroke: s.colour }} strokeWidth={3} strokeLinecap="round" />
            <ShapeMark shape={j === 0 ? 'circle' : 'square'} x={cx} y={y(r.mean)} size={7} colour={s.colour} />
          </g>
        );
      }))}
    </g>
  );
}

/** The reference lines that fall on the axis, with their words, and the dashed average the legend names. */
function Lines({ model, plot, y, domain }: { model: ChartModel; plot: Plot; y: Y; domain: LinearDomain }) {
  const inside = (v: number) => v >= domain.min && v <= domain.max;
  return (
    <g>
      {model.lines.filter(l => inside(l.value)).map(l => (
        <g key={l.label}>
          <line x1={plot.left} x2={plot.left + plot.width} y1={y(l.value)} y2={y(l.value)} style={{ stroke: 'var(--caution)' }} strokeWidth={1} />
          <text x={plot.left + 4} y={y(l.value) - 4} style={{ fill: 'var(--caution)', stroke: 'var(--grouped-card)' }} strokeWidth={3} paintOrder="stroke">{l.label}</text>
        </g>
      ))}
      {model.average && inside(model.average.value) && (
        <line
          x1={plot.left} x2={plot.left + plot.width} y1={y(model.average.value)} y2={y(model.average.value)}
          style={{ stroke: 'var(--foreground)' }} strokeWidth={1.5} strokeDasharray="5 4"
        />
      )}
    </g>
  );
}

/** The slots' labels, thinned to fit and held inside the frame (v1's `thinLabels` and `placeLabels`). */
function Labels({ model, plot, width, fontPx }: { model: ChartModel; plot: Plot; width: number; fontPx: number }) {
  const n = model.slots.length;
  const w = plot.width / n;
  const widest = model.slots.reduce((m, s) => Math.max(m, s.label.length), 1);
  const placed = placeLabels(
    thinLabels(n, plot.width, labelWidth(widest, fontPx) + 6).map(i => ({ index: i, centre: plot.left + (i + 0.5) * w, width: labelWidth(model.slots[i].label.length, fontPx) })),
    width,
  );
  return (
    <g className="text-muted-foreground">
      {placed.map(({ index, x }) => (
        <text key={model.slots[index].key} x={x} y={plot.top + plot.height + fontPx + 2} textAnchor="middle" fill="currentColor">{model.slots[index].label}</text>
      ))}
    </g>
  );
}

function ShapeMark({ shape, x, y, size, colour }: { shape: Shape; x: number; y: number; size: number; colour: string }) {
  const h = size / 2;
  const style = { fill: colour, stroke: 'var(--grouped-card)' };
  if (shape === 'square') return <rect x={x - h} y={y - h} width={size} height={size} style={style} strokeWidth={1.5} />;
  if (shape === 'triangle') return <path d={`M${x} ${y - h - 1}L${x + h + 1} ${y + h}L${x - h - 1} ${y + h}Z`} style={style} strokeWidth={1.5} />;
  return <circle cx={x} cy={y} r={h} style={style} strokeWidth={1.5} />;
}

function Swatch({ item, uid }: { item: LegendItem; uid: string }) {
  switch (item.swatch) {
    case 'bar': return <rect x="3" y="2" width="10" height="12" rx="2" style={{ fill: item.colour }} />;
    case 'previous': return <rect x="2" y="2" width="12" height="12" rx="1" style={{ fill: `url(#${uid}-previous)`, stroke: 'var(--trend-previous)' }} />;
    case 'mark': return <rect x="1" y="1" width="14" height="14" style={{ fill: `url(#${uid}-mark)`, stroke: 'var(--muted-foreground)' }} strokeWidth="1" />;
    case 'range': return <line x1="8" x2="8" y1="2" y2="14" style={{ stroke: item.colour }} strokeWidth="3" strokeLinecap="round" />;
    default: return <ShapeMark shape={item.swatch} x={8} y={8} size={10} colour={item.colour} />;
  }
}

/** What each colour, pattern and shape means, in words beside it (journey §20.3), and the average's figure. */
function Legend({ items, average, uid }: { items: LegendItem[]; average?: string; uid: string }) {
  if (items.length === 0 && !average) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
      {items.map(item => (
        <li key={item.id} className="flex items-center gap-1.5">
          <svg width="16" height="16" aria-hidden className="shrink-0"><Swatch item={item} uid={uid} /></svg>
          <span>{item.label}</span>
        </li>
      ))}
      {average && (
        <li className="flex items-center gap-1.5">
          <svg width="16" height="16" aria-hidden className="shrink-0">
            <line x1="1" x2="15" y1="8" y2="8" style={{ stroke: 'var(--foreground)' }} strokeWidth="1.5" strokeDasharray="3 2" />
          </svg>
          <span>{average}</span>
        </li>
      )}
    </ul>
  );
}

function Table({ id, caption, table }: { id: string; caption: string; table: { columns: string[]; rows: string[][] } }) {
  return (
    <div id={id} className="overflow-hidden rounded-xl bg-grouped-card">
      <table className="w-full border-collapse text-left text-[length:var(--text-subhead)]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>{table.columns.map(c => <th key={c} scope="col" className="px-3 py-2 font-semibold text-muted-foreground [overflow-wrap:anywhere]">{c}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.length === 0 && (
            <tr className="border-t border-separator"><td colSpan={table.columns.length} className="px-3 py-2 text-muted-foreground">Nothing recorded in this period.</td></tr>
          )}
          {table.rows.map((row, i) => (
            <tr key={i} className="border-t border-separator">
              {row.map((cell, j) => (j === 0
                ? <th key={j} scope="row" className="px-3 py-2 font-medium [overflow-wrap:anywhere]">{cell}</th>
                : <td key={j} className="px-3 py-2 [overflow-wrap:anywhere]">{cell}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

The plot fades over when the period or the window changes. It doesn't morph bars between periods: ponytail: Week, Month, 6 Months and Year share no bars of the same dates except a week inside its month. Upgrade: key the bars by date and move those heights with `spring` if review asks for it.

- [ ] **Step 4: Write** `src/screens/trends/PeriodControl.tsx`

```tsx
/**
 * Week · Month · 6 Months · Year (K-34), as one radio group whose indicator
 * slides to the choice (`spring-quick`, M21), then the window's title,
 * announced when it changes, and a pager that says where it goes in words:
 * "Previous week", "Next week" (B-08).
 */
import type { KeyboardEvent } from 'react';
import { MOTION, springLinear } from '@/design/motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';
import { TREND_PERIODS, type TrendPeriod } from './periods';

export function PeriodControl({ period, onPeriod, title, labels, canPrevious, canNext, onPrevious, onNext }: {
  period: TrendPeriod;
  onPeriod: (period: TrendPeriod) => void;
  /** "This week", "September". */
  title: string;
  labels: { previous: string; next: string };
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const reduced = useReducedMotion();
  const i = Math.max(0, TREND_PERIODS.findIndex(p => p.id === period));
  // Arrow keys, Home and End move the choice, as a native radio group does; only the chosen one is in the tab order.
  const keys = (e: KeyboardEvent<HTMLButtonElement>) => {
    const n = TREND_PERIODS.length;
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % n
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i - 1 + n) % n
        : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    onPeriod(TREND_PERIODS[next].id);
    e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };
  const pager = 'press-feedback min-h-12 flex-1 rounded-full bg-tint/10 px-3 text-[length:var(--text-subhead)] font-semibold leading-tight text-tint disabled:bg-transparent disabled:text-muted-foreground';
  return (
    <div className="flex flex-col gap-3">
      {/* ponytail: four columns at every size; at 200% text on a 320 px screen "6 Months" wraps inside its segment. Upgrade: two rows below 22 rem, the thumb placed by row and column. */}
      <div role="radiogroup" aria-label="Period" className="relative grid grid-cols-4 rounded-[0.6rem] bg-segment-track p-0.5">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc((100%-0.25rem)/4)] rounded-lg bg-segment-thumb shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)]"
          style={{ transform: `translateX(${i * 100}%)`, transition: reduced ? undefined : `transform ${MOTION.springQuick.cssMs}ms ${springLinear(0)}` }}
        />
        {TREND_PERIODS.map(p => {
          const selected = p.id === period;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onPeriod(p.id)}
              onKeyDown={keys}
              className={cn('relative min-h-12 rounded-lg px-1 py-1 text-[length:var(--text-subhead)] leading-tight text-foreground', selected ? 'font-semibold' : 'font-medium')}
            >
              <span className="block break-words">{p.label}</span>
            </button>
          );
        })}
      </div>
      <h2 aria-live="polite" className="text-center text-[length:var(--text-title-2)] font-semibold leading-tight [overflow-wrap:break-word]">{title}</h2>
      <div className="flex gap-3">
        <button type="button" onClick={onPrevious} disabled={!canPrevious} className={pager}>{labels.previous}</button>
        <button type="button" onClick={onNext} disabled={!canNext} className={pager}>{labels.next}</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Write** `src/screens/trends/TrendHeadlines.tsx`

```tsx
/**
 * A trend's headline (journey §12.2, B-15): a meter's HI and LO first, in
 * caution ink (K-11), then the statistic and what it covers, the figure with
 * its unit, and the change in body ink with an arrow, never green or red
 * (A-41). The figures change at once and never count up (M21).
 */
import { ArrowDownRightIcon, ArrowRightIcon, ArrowUpRightIcon } from 'lucide-react';
import type { Direction } from './stats';
import type { Change, Headline } from './model';

function ChangeArrow({ direction }: { direction: Direction }) {
  const className = 'mt-0.5 size-5 shrink-0';
  if (direction === 'higher') return <ArrowUpRightIcon className={className} aria-hidden />;
  if (direction === 'lower') return <ArrowDownRightIcon className={className} aria-hidden />;
  return <ArrowRightIcon className={className} aria-hidden />;
}

export function TrendHeadlines({ headline, change, meter }: { headline: Headline; change: Change; meter?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {meter && <p className="text-[length:var(--text-subhead)] font-semibold leading-snug text-caution">{meter}</p>}
      <p className="text-[length:var(--text-footnote)] leading-snug text-muted-foreground [overflow-wrap:break-word]">{headline.statistic} · {headline.coverage}</p>
      <p className="leading-tight [overflow-wrap:break-word]">
        <span className="numeric text-[length:var(--text-large-title)] font-semibold">{headline.value}</span>
        {headline.unit && <span className="ml-1.5 text-[length:var(--text-body)] text-muted-foreground">{headline.unit}</span>}
      </p>
      <p className="flex items-start gap-1.5 text-[length:var(--text-body)] leading-snug">
        {change.direction && <ChangeArrow direction={change.direction} />}
        <span className="min-w-0 [overflow-wrap:break-word]">{change.text}</span>
      </p>
      {change.compared && <p className="text-[length:var(--text-footnote)] text-muted-foreground">{change.compared}</p>}
    </div>
  );
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/design/tokens.node.test.ts`
Expected: PASS.

- [ ] **Step 7: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/trends/TrendChart.tsx src/screens/trends/PeriodControl.tsx src/screens/trends/TrendHeadlines.tsx src/design/tokens.node.test.ts
git commit -m "feat: Draw trends in one shared chart, read by touch, keys, list and VoiceOver"
```

---

### Task 11: A category's trend, at its address

**Files:**
- Create: `src/screens/trends/CategoryTrend.tsx`
- Create: `src/screens/trends/routes.tsx`
- Modify: `src/routes.tsx` (one `/trends/*` subtree)
- Modify: `src/screens/track/MetricDetail.tsx` (the interim trend code goes)

**Interfaces:**
- Consumes:
  - Tasks 2–10: `windowOf`, `previousWindow`, `nextWindow`, `isCurrent`, `isTrendPeriod`, `pagerLabels`; `trendDef`, `labPoints`; `dailyView`, `readingsView`, `labsView`, `trendContext`; `activities`; `TrendChart`, `PeriodControl`, `TrendHeadlines`, `StatGrid`;
  - Plan 2's `labFrom` (`@/screens/hub/reading`); D21's `assembleBackLeg` and `BackLegChart`;
  - v1's `displayPrefs`, `LAB_OPTIONS`, `recordPath`, `Segmented`, `useToday`, `markInPlace`, `type Origin`, `Screen`, `Group`, `Row`.
- Produces:
  - `CategoryTrend` (default export), at `/trends/:id`;
  - `TrendsRoutes` (default export), mounted at `/trends/*`. Its index is the interim view until Task 13.
- Addresses (D74):
  - `/trends/:id` for every id in `TRENDS`: Week first, unless `?period=` says `month`, `sixMonths` or `year` (B-10); `?at=YYYY-MM-DD` anchors an earlier window;
  - `/trends/labs?metric=b12` opens that lab (B-14);
  - `/trends/workout` is the Workout trend, and `/trends/workout/:id` stays a past workout's record;
  - `/trends/food` goes to `/hub/food` with its query and state; any other id, or anything deeper, goes to `/home?moved=1`.

- [ ] **Step 1: Write** `src/screens/trends/CategoryTrend.tsx`

```tsx
/**
 * A category's trend, `/trends/:id` (journey §12.2): the period and its
 * pager, the headline and its change, the chart with its list and summary,
 * the spread and the notes, and for movement the records behind it. Week
 * first unless the address says otherwise (B-10). Labs are their results,
 * dated, with no period (A-45). It decides nothing and has no Start
 * (J§4.2): the hub, one tap away, has those.
 */
import { useMemo } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { StatGrid } from '@/components/hig/StatGrid';
import { markInPlace, type Origin } from '@/components/hig/navigation';
import { isDay } from '@/health/observation';
import { labFrom } from '@/screens/hub/reading';
import { BackLegChart } from '@/screens/track/BackLegChart';
import { assembleBackLeg } from '@/screens/track/backLegSeries';
import { LAB_OPTIONS, displayPrefs, type LabKind } from '@/screens/track/logKinds';
import { recordPath } from '@/screens/track/timeline';
import { Segmented } from '@/screens/track/ui';
import { useToday } from '@/screens/track/useToday';
import { useStore } from '@/store/useStore';
import { labPoints, trendDef, type TrendDef, type TrendId } from './metrics';
import { dailyView, labsView, readingsView, trendContext } from './model';
import { PeriodControl } from './PeriodControl';
import { isCurrent, isTrendPeriod, nextWindow, pagerLabels, previousWindow, windowOf, type TrendPeriod } from './periods';
import { activities } from './records';
import { TrendChart } from './TrendChart';
import { TrendHeadlines } from './TrendHeadlines';

/** The records listed under a movement trend, for the window shown. */
const RECORDS: Partial<Record<TrendId, string>> = { workout: 'Workouts', stretch: 'Stretches', walk: 'Walks' };

export default function CategoryTrend() {
  const { id } = useParams();
  const def = trendDef(id);
  // An id with no trend is an address that has moved (journey §19.3).
  if (!def) return <Navigate to="/home?moved=1" replace />;
  return def.family === 'labs' ? <LabsTrend def={def} /> : <PeriodTrend key={def.id} def={def} />;
}

/** The records, the person's units and the day context, as every trend reads them. */
function useTrendData() {
  const state = useStore();
  const today = useToday();
  const data = useMemo(() => ({ observations: state.observations, sessions: state.sessions, checkIns: state.checkIns }), [state.observations, state.sessions, state.checkIns]);
  const prefs = useMemo(() => displayPrefs(state.settings, state.profile, state.observations), [state.settings, state.profile, state.observations]);
  const ctx = useMemo(
    () => trendContext({ today, data, settings: state.settings, profile: state.profile }),
    [today, data, state.settings, state.profile],
  );
  return { state, today, data, prefs, ctx };
}

/** Where the records are added and corrected: the hub, and for Workout, logging one (B-14). */
function HubLinks({ def, origin, search = '' }: { def: TrendDef; origin: Origin; search?: string }) {
  if (!def.hub) return null;
  return (
    <Group>
      {def.id === 'workout' && <Row as={Link} to="/hub/workout/log" state={origin} label="Log a workout" detail="Sets you did on your own" chevron />}
      <Row as={Link} to={`${def.hub}${search}`} state={origin} label={`Go to ${def.title}`} chevron />
    </Group>
  );
}

function PeriodTrend({ def }: { def: TrendDef }) {
  const { state, today, data, prefs, ctx } = useTrendData();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const asked = params.get('period');
  // Week first, wherever the trend was opened from (B-10).
  const period: TrendPeriod = isTrendPeriod(asked) ? asked : 'week';
  const at = params.get('at');
  const anchor = at !== null && isDay(at) && at <= today ? at : today;
  const w = useMemo(() => windowOf(period, anchor), [period, anchor]);
  const view = useMemo(() => (def.family === 'readings' ? readingsView : dailyView)({ def, window: w, data, prefs, ctx }), [def, w, data, prefs, ctx]);
  // D21's chart, for a month or more: a week is too short to show loading against symptoms.
  const backLeg = useMemo(
    () => (def.id === 'back' && period !== 'week' ? assembleBackLeg(w, state.observations, state.sessions, state.checkIns, state.profile) : undefined),
    [def.id, period, w, state.observations, state.sessions, state.checkIns, state.profile],
  );
  const records = useMemo(
    () => (RECORDS[def.id] ? activities(data, prefs, today).filter(r => r.kind === def.id && r.day >= w.from && r.day <= w.to) : []),
    [def.id, data, prefs, today, w],
  );
  // Paging and the period change this screen's address, not the screen: focus stays on the control used.
  const change = (next: { period?: TrendPeriod; at?: string }) => {
    markInPlace();
    setParams(prev => {
      const p = new URLSearchParams(prev);
      if (next.period) p.set('period', next.period);
      if (next.at) p.set('at', next.at);
      return p;
    }, { replace: true });
  };
  const earlier = previousWindow(w);
  const origin: Origin = { path: location.pathname, label: def.title, ...(location.search ? { search: location.search } : {}) };

  return (
    <Screen title={def.title} back={{ to: '/trends', label: 'Trends' }}>
      <PeriodControl
        period={period}
        onPeriod={p => change({ period: p })}
        title={view.title}
        labels={pagerLabels(period)}
        // Back as far as the window holding the first record; forward as far as today's.
        canPrevious={ctx.since !== undefined && earlier.to >= ctx.since}
        canNext={!isCurrent(w, today)}
        onPrevious={() => change({ at: earlier.from })}
        onNext={() => change({ at: nextWindow(w).from })}
      />
      <TrendHeadlines headline={view.headline} change={view.change} {...(view.meter ? { meter: view.meter } : {})} />
      <section aria-label={`${def.title} chart`} className="rounded-xl bg-grouped-card p-4">
        <TrendChart model={view.chart} label={`${def.title}, ${view.title}`} summary={view.summary} table={view.table} view={`${period}:${w.from}`} origin={origin} />
      </section>
      <StatGrid items={view.stats} />
      {view.notes.length > 0 && (
        <div className="flex flex-col gap-1 px-1">
          {view.notes.map(note => <p key={note} className="text-[length:var(--text-footnote)] leading-snug text-muted-foreground">{note}</p>)}
        </div>
      )}
      {backLeg && (
        <Group header="Pain against loading">
          <div className="p-4"><BackLegChart data={backLeg} current={today} /></div>
        </Group>
      )}
      {records.length > 0 && (
        <Group header={RECORDS[def.id]}>
          {records.map(r => <Row key={r.key} as={Link} to={recordPath(r.ref)} state={origin} label={r.label} detail={r.detail} chevron />)}
        </Group>
      )}
      <HubLinks def={def} origin={origin} />
    </Screen>
  );
}

function LabsTrend({ def }: { def: TrendDef }) {
  const { state, today, data, prefs } = useTrendData();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const asked = params.get('metric');
  // The lab the address names (B-14), or the first with results; HbA1c when none has any.
  const lab: LabKind = asked !== null ? labFrom(asked) : LAB_OPTIONS.find(o => labPoints(o.kind, state.observations, prefs).length > 0)?.kind ?? 'hba1c';
  const view = useMemo(() => labsView(lab, data, prefs, today), [lab, data, prefs, today]);
  const choose = (next: LabKind) => {
    markInPlace();
    setParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('metric', next);
      return p;
    }, { replace: true });
  };
  const origin: Origin = { path: location.pathname, label: def.title, ...(location.search ? { search: location.search } : {}) };

  return (
    <Screen title={def.title} back={{ to: '/trends', label: 'Trends' }}>
      <Segmented label="Which result" options={LAB_OPTIONS.map(o => ({ id: o.kind, label: o.title }))} value={lab} onChange={choose} />
      <TrendHeadlines headline={view.headline} change={{ text: view.rows.at(-1)?.interval ?? 'No results yet. Add one in Labs.' }} />
      <section aria-label={`${view.title} chart`} className="rounded-xl bg-grouped-card p-4">
        <TrendChart model={view.chart} label={`${view.title} results`} summary={view.summary} table={view.table} view={lab} origin={origin} />
      </section>
      <HubLinks def={def} origin={origin} search={`?metric=${lab}`} />
    </Screen>
  );
}
```

- [ ] **Step 2: Write** `src/screens/trends/routes.tsx`

```tsx
/**
 * The Trends tab (journey §12): its root, each category's trend at `:id`,
 * and a past workout at `workout/:id`, the address it already had. Food's
 * trend is Plan 7's: until then its address opens the Food hub (D74).
 * Anything else is an address that has moved (§19.3).
 */
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MyDay } from '@/screens/track/MyDay';
import RecordScreen from '@/screens/workout/RecordScreen';
import CategoryTrend from './CategoryTrend';

/** Food's trend address, on to the Food hub with its query and navigation state. */
function FoodHub() {
  const { search, state } = useLocation();
  return <Navigate to={{ pathname: '/hub/food', search }} replace state={state} />;
}

export default function TrendsRoutes() {
  return (
    <Routes>
      {/* Until Task 13 builds the tab's root, My Day's Trends view on its own, as before. */}
      <Route index element={<MyDay view="trends" />} />
      <Route path="workout/:id" element={<RecordScreen />} />
      <Route path="food" element={<FoodHub />} />
      <Route path=":id" element={<CategoryTrend />} />
      <Route path="*" element={<Navigate to="/home?moved=1" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 3: Mount it.** In `src/routes.tsx`:
  - add `const TrendsRoutes = lazy(() => import('@/screens/trends/routes'));` beside the other area imports;
  - replace every route whose path starts `/trends` (`/trends`, `/trends/workout`, `/trends/workout/*` and `/trends/:id`, as Plan 2 left them) with:

```tsx
        {/* The Trends tab (journey §12): its root, each category's trend, and a past workout's record (D74). */}
        <Route path="/trends/*" element={<TrendsRoutes />} />
```

  - delete the lazy imports nothing uses now (`MyDay`, `MetricFor`, and `WorkoutRoutes` if no other route mounts it): `npx tsc -b` names each one;
  - in the comment above `AppRoutes`, take Trends out of the screens that are still v1's.

- [ ] **Step 4: The interim trend code goes.** In `src/screens/track/MetricDetail.tsx`, `MetricFor` existed for `/hub/:id` and `/trends/:id` (B-22). After Plan 2, only the trend route mounts it (`grep -rn "MetricFor" src` prints only this file and `src/routes.tsx`), and the route has just gone. So delete `MetricFor`, `CATEGORY_METRIC`, `TREND_METRIC` and `LABS`, with their doc comments, and any import only they used (Plan 2's `CATEGORIES` among them). If anything else still mounts `MetricFor`, keep it, and delete only its `trend` prop and `TREND_METRIC`.

- [ ] **Step 5: Gates**

```bash
npx tsc -b && npm run lint && npx vitest run
```

- [ ] **Step 6: Check by eye.** Run `npm run dev`. Seed P01 (its 25 September session and check-in) the way the acceptance suite does: print the blob with `node -e "import('./scripts/e2e/acceptance/fixtures/personas.mjs').then(m => console.log(JSON.stringify(m.persona('P01'))))"`, then, in a fresh browser profile on the app's address, run `localStorage.setItem('fit-strong-90-data', '<the blob>')` in the console and reload; the app migrates it on launch. At 428×926 and 320×568, in light and dark, at 100% and 200% text:
  - `/trends/workout`: Week first, "This week", the pager reads "Previous week" and "Next week", "Next week" is unavailable. Page back to the week of 22 September: the 25 September session's bar, its row under "Workouts", and its record opens from the row;
  - tap a bar, drag across the plot, then use the arrow keys: the outline moves, the words above the plot follow, and Escape or a tap outside puts the choice down. "Show as list" opens the table;
  - `/trends/steps?period=month`: "This month", the days shown 1 to 31 and thinned to fit;
  - `/trends/back?period=month`: "Pain against loading" below the stats;
  - `/trends/labs?metric=b12`: the Vitamin B12 segment chosen;
  - `/trends/food` opens the Food hub, `/trends/nope` goes Home with "That page has moved", and `/trends` is still My Day's Trends view.
  - Reduce motion (Me → Display) on: the period indicator jumps and nothing fades.

- [ ] **Step 7: Run the journeys that cross these addresses**

```bash
npm run e2e:acceptance -- --only=S01,J20,J05
```

Expected: pass, as Plan 2 left them. S01's sweep now covers `/trends/workout`. If J20 or J05 still expects the Workout Log at `/trends/workout`, Plan 2 wasn't finished: it moved the log to `/hub/workout/log` (its D51), and those journeys move with it.

- [ ] **Step 8: Commit**

```bash
git add src/screens/trends/CategoryTrend.tsx src/screens/trends/routes.tsx src/routes.tsx src/screens/track/MetricDetail.tsx
git commit -m "feat: Open each category's trend at /trends/:id, Week first, with Labs as dated results"
```

---

### Task 12: Your week

**Files:**
- Create: `src/screens/trends/yourWeek.ts`
- Create: `src/screens/trends/yourWeek.test.ts`

**Interfaces:**
- Consumes:
  - `recordedMovement`, `wholeMinutes` (`@/screens/track/movement`); `addDays`, `mondayOf`, `today`, `weekOf` (`@/screens/track/periods`); `formatNumber`; `type Status` (`@/health/status`); `type DayRange` (`@/health/aggregate`);
  - Plan 2's `weeklyGoalOn`, `pendingWeeklyGoal`, `type WeeklyGoalSettings` (`@/screens/track/weeklyGoal`);
  - Task 3's `dailyStats`, `readingStats`, `type DayContext`; Task 4's `stepsDays`, `stretchedDays`, `type TrendData`; Task 5's `GLUCOSE_LINES`, `readingsFor`; Task 7's `countText`.
- Produces:
  - `interface WeekFacts { week: string; title: string; name: string; minutes: number; before?: number; beforeName: string; stretchDays: number; steps?: { perDay: number; days: number }; glucose?: { numeric: number; lo: number; hi: number; lows: number; highs: number }; pressure?: { readings: number; severe: number } }`;
  - `weekFacts(input: { week: string; data: TrendData; prefs: DisplayPrefs; ctx: DayContext }): WeekFacts`;
  - `weekSentences(facts: WeekFacts, prefs: DisplayPrefs): string[]`;
  - `briefPause(input: { status: Status; urgent: boolean }): 'status' | 'safety' | undefined`;
  - `interface WeekRing { week: string; minutes: number; goal?: number; current: boolean }`, `weekRings(today: string, data: TrendData, settings: WeeklyGoalSettings | undefined): WeekRing[]`, `ringLabel(ring: WeekRing): string`;
  - `pendingGoalText(settings: WeeklyGoalSettings | undefined, today: string): string | undefined`;
  - `WEEK_BRIEF_KEY = 'trends:weekBrief'`, `briefSeen(value: unknown): string[]`, `withSeen(seen: readonly string[], week: string): string[]`;
  - `weekBriefFor(input: { now: Date; seen: readonly string[]; hasFacts: boolean }): { week: string } | undefined`.

The week's minutes are recorded movement (§12.3), as Home's ring counts them (`recordedMovement`), not the sum of each category's own minutes. There is no weight, waist or food sentence, and no sentence is about how often anyone tests (§12.6).

- [ ] **Step 1: Write the failing test** `src/screens/trends/yourWeek.test.ts`

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { WorkoutSession } from '@/types';
import type { CheckInRecord } from '@/types/checkin';
import { bpContext, newObservation, type Observation } from '@/health/observation';
import { DEFAULT_PREFS } from '@/screens/track/format';
import type { DayContext } from './stats';
import {
  WEEK_BRIEF_KEY, briefPause, briefSeen, pendingGoalText, ringLabel, weekBriefFor, weekFacts, weekRings, weekSentences, withSeen,
} from './yourWeek';

// A meter's display and the brief's 04:00 are read on this device's clock, so the zone is pinned.
const zone = process.env.TZ;
beforeAll(() => { process.env.TZ = 'Asia/Kolkata'; });
afterAll(() => { if (zone === undefined) delete process.env.TZ; else process.env.TZ = zone; });

// Thursday 8 October 2026.
const TODAY = '2026-10-08';
const prefs = { ...DEFAULT_PREFS, hour12: true };
const ctx = (over: Partial<DayContext> = {}): DayContext => ({ today: TODAY, since: '2026-09-28', statusOn: () => 'normal', restOn: () => false, ...over });
const data = (observations: Observation[], sessions: WorkoutSession[] = [], checkIns: CheckInRecord[] = []) => ({ observations, sessions, checkIns });
const moved = (id: string, day: string, minutes: number) => newObservation({
  kind: 'movementMinutes', value: minutes, at: `${day}T18:00:00.000+05:30`, scope: 'sessionObserved', source: 'measured', coverageMs: minutes * 60_000, context: `walk:${id}`,
});
let n = 0;
const session = (date: string, over: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id: `y${++n}`, date, dayOfWeek: 'monday', muscleGroup: 'fullBody', phase: 'foundation', week: 3, status: 'completed', sets: [],
  startedAt: `${date}T07:00:00+05:30`, completedAt: null, notes: '', totalVolume: 0, guided: true, planKind: 'stretch', durationSeconds: 600, ...over,
});
const steps = (day: string, value: number) => newObservation({ kind: 'steps', value, at: `${day}T20:00:00.000+05:30`, scope: 'dayTotal', source: 'manual' });
const g = (value: number, at: string) => newObservation({ kind: 'glucose', value, unit: 'mg/dL', at, scope: 'pointInTime', source: 'manual' });
const bp = (sys: number, dia: number, day: string) => {
  const shared = { at: `${day}T07:30:00+05:30`, scope: 'pointInTime' as const, source: 'manual' as const, context: bpContext(`bp-${day}`) };
  return [newObservation({ ...shared, kind: 'bloodPressureSystolic', value: sys }), newObservation({ ...shared, kind: 'bloodPressureDiastolic', value: dia })];
};

const OBS = [
  moved('b', '2026-09-28', 20), moved('c', '2026-10-01', 32), moved('d', '2026-10-02', 40), moved('a', '2026-10-05', 30),
  g(118, '2026-10-05T07:30:00+05:30'), g(62, '2026-10-06T13:00:00+05:30'), g(112, '2026-10-07T07:30:00+05:30'), g(168, '2026-10-07T14:10:00+05:30'), g(124, '2026-10-08T07:30:00+05:30'),
  ...bp(132, 84, '2026-10-05'), ...bp(128, 82, '2026-10-06'), ...bp(182, 96, '2026-10-07'), ...bp(126, 80, '2026-10-08'),
  steps('2026-10-05', 6000), steps('2026-10-06', 7000), steps('2026-10-07', 5500),
];
// A stretch on Tuesday (10 min) and a full session on Wednesday (24 min) whose mobility block was done.
const SESSIONS = [session('2026-10-06'), session('2026-10-07', { planKind: 'full', durationSeconds: 1440, mobility: [{ exerciseId: 'cat-cow', seconds: 60 }] })];
const LO = { date: '2026-10-07', glucoseDisplay: { display: 'LO', measuredAt: '2026-10-07T21:00:00+05:30' } } as unknown as CheckInRecord;

describe('Your week’s facts and sentences (journey §12.1, B-15)', () => {
  const facts = weekFacts({ week: '2026-10-05', data: data(OBS, SESSIONS, [LO]), prefs, ctx: ctx() });

  it('counts recorded movement to today, against the same days of last week', () => {
    expect(facts).toMatchObject({ week: '2026-10-05', title: 'This week', name: 'this week', minutes: 64, before: 52, beforeName: 'by this time last week', stretchDays: 2 });
  });

  it('says up to 4 facts, movement first, then the readings with their context; no praise, no blame', () => {
    expect(weekSentences(facts, prefs)).toEqual([
      'You moved 64 minutes this week, 12 more than by this time last week.',
      'You stretched on 2 days this week.',
      '6 glucose readings this week (5 with a number, 1 meter LO); 2 were below 70 mg/dL.',
      '4 blood pressure readings this week; 1 was 180/120 mmHg or higher.',
    ]);
    expect(weekSentences(facts, prefs).join(' ')).not.toMatch(/great|well done|good job|keep it up|only|better|worse|should|missed/i);
  });

  it('steps, when there is room for them', () => {
    const few = weekFacts({ week: '2026-10-05', data: data([moved('a', '2026-10-05', 30), steps('2026-10-05', 6000), steps('2026-10-06', 7000), steps('2026-10-07', 5500)]), prefs, ctx: ctx({ since: '2026-10-05' }) });
    expect(weekSentences(few, prefs)).toEqual(['You moved 30 minutes this week.', '6,167 steps a day on average this week, from 3 days with steps.']);
  });

  it('a record that starts this Thursday says no “fewer than last week” (Review Focus 4)', () => {
    const first = weekFacts({ week: '2026-10-05', data: data([moved('a', TODAY, 30)]), prefs, ctx: ctx({ since: TODAY }) });
    expect(first.before).toBeUndefined();
    expect(weekSentences(first, prefs)).toEqual(['You moved 30 minutes this week.']);
  });

  it('a finished week is named and compared as one', () => {
    const last = weekFacts({ week: '2026-09-28', data: data(OBS), prefs, ctx: ctx() });
    expect(last).toMatchObject({ title: 'Last week', name: 'last week', minutes: 92, beforeName: 'the week before' });
    // The week before began before the first record, so there is nothing to compare.
    expect(weekSentences(last, prefs)[0]).toBe('You moved 92 minutes last week.');
    expect(weekFacts({ week: '2026-09-21', data: data(OBS), prefs, ctx: ctx({ since: '2026-09-21' }) }).title).toBe('Week of 21 Sep');
  });
});

describe('when Your week is paused (§12.6)', () => {
  it('beside a safety decision, or on a day that isn’t Normal', () => {
    expect(briefPause({ status: 'normal', urgent: false })).toBeUndefined();
    expect(briefPause({ status: 'normal', urgent: true })).toBe('safety');
    for (const status of ['flare', 'unwell', 'away'] as const) expect(briefPause({ status, urgent: false })).toBe('status');
  });
});

describe('the last 8 weeks’ rings (§12.1, B-16)', () => {
  const settings = { weeklyMovementGoalMinutes: 150, weeklyMovementGoalHistory: [{ from: '2026-09-21', goal: 120 }, { from: '2026-10-05', goal: 150 }] };
  const rings = weekRings(TODAY, data(OBS, SESSIONS), settings);

  it('runs oldest first to this week, each against the goal its week had', () => {
    expect(rings.map(r => r.week)).toEqual(['2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05']);
    expect(rings.map(r => r.goal)).toEqual([undefined, undefined, undefined, undefined, undefined, 120, 120, 150]);
    expect(rings.at(-1)).toMatchObject({ minutes: 64, current: true });
  });

  it('names each with its minutes, as its visible date reads', () => {
    expect(ringLabel(rings[7])).toBe('This week: 64 of 150 min');
    expect(ringLabel(rings[6])).toBe('Week of 28 Sep: 92 of 120 min');
    expect(ringLabel(rings[0])).toBe('Week of 17 Aug: 0 min moved');
  });

  it('says a change waiting for Monday', () => {
    const later = { weeklyMovementGoalHistory: [{ from: '2026-10-05', goal: 150 }, { from: '2026-10-12', goal: 200 }] };
    expect(pendingGoalText(later, TODAY)).toBe('From Monday 12 October, your weekly goal is 200 min.');
    expect(pendingGoalText({ weeklyMovementGoalHistory: [{ from: '2026-10-05', goal: 150 }, { from: '2026-10-12' }] }, TODAY)).toBe('From Monday 12 October, no weekly goal.');
    expect(pendingGoalText(settings, TODAY)).toBeUndefined();
  });
});

describe('Your week in brief (B-20, L-18)', () => {
  const at = (iso: string) => new Date(iso);

  it('offers last week from Monday 04:00 until it’s opened or the week is over', () => {
    expect(weekBriefFor({ now: at('2026-10-12T03:59:00+05:30'), seen: [], hasFacts: true })).toBeUndefined();
    expect(weekBriefFor({ now: at('2026-10-12T04:00:00+05:30'), seen: [], hasFacts: true })).toEqual({ week: '2026-10-05' });
    expect(weekBriefFor({ now: at('2026-10-18T23:59:00+05:30'), seen: [], hasFacts: true })).toEqual({ week: '2026-10-05' });
    expect(weekBriefFor({ now: at('2026-10-19T05:00:00+05:30'), seen: [], hasFacts: true })).toEqual({ week: '2026-10-12' });
  });

  it('once opened, stays opened; a week with nothing to say offers nothing', () => {
    expect(weekBriefFor({ now: at('2026-10-13T09:00:00+05:30'), seen: ['2026-10-05'], hasFacts: true })).toBeUndefined();
    expect(weekBriefFor({ now: at('2026-10-13T09:00:00+05:30'), seen: [], hasFacts: false })).toBeUndefined();
  });

  it('keeps what was opened in content state, read defensively and kept short', () => {
    expect(WEEK_BRIEF_KEY).toBe('trends:weekBrief');
    expect(briefSeen(['2026-10-05', 3, null])).toEqual(['2026-10-05']);
    expect(briefSeen('2026-10-05')).toEqual([]);
    expect(withSeen(['2026-09-28', '2026-10-05'], '2026-09-28')).toEqual(['2026-10-05', '2026-09-28']);
    const many = Array.from({ length: 8 }, (_, i) => `2026-08-${String(3 + i * 7).padStart(2, '0')}`);
    expect(withSeen(many, '2026-10-05')).toHaveLength(8);
  });
});
```

The meter LO is on Wednesday at 9 pm in India, so its local day is 7 October. The 7 October session's mobility block makes that a stretch day (D72), but its minutes count once, as recorded movement.

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/screens/trends/yourWeek.test.ts`
Expected: FAIL, "Cannot find module './yourWeek'".

- [ ] **Step 3: Write the module** `src/screens/trends/yourWeek.ts`

```ts
/**
 * Your week (journey §12.1, §12.6; B-15, B-16, B-20): up to 4 factual
 * sentences about a Monday-to-Sunday week, never praise or blame; the rings
 * of the last 8 weeks; and when "Your week in brief" is offered. None of it
 * shows while the status isn't Normal or a safety decision stands. There is
 * no weight, waist or food sentence, and no sentence about how often anyone
 * tests (A-15, K-51).
 */
import { format } from 'date-fns';
import type { DayRange } from '@/health/aggregate';
import type { Status } from '@/health/status';
import type { DisplayPrefs } from '@/screens/track/format';
import { recordedMovement, wholeMinutes } from '@/screens/track/movement';
import { addDays, mondayOf, today as dayOf, weekOf } from '@/screens/track/periods';
import { formatNumber } from '@/screens/track/units';
import { pendingWeeklyGoal, weeklyGoalOn, type WeeklyGoalSettings } from '@/screens/track/weeklyGoal';
import { GLUCOSE_LINES, readingsFor } from './metrics';
import { countText } from './model';
import { stepsDays, stretchedDays, type TrendData } from './records';
import { dailyStats, readingStats, type DayContext } from './stats';

const noon = (day: string) => new Date(`${day}T12:00:00`);

export interface WeekFacts {
  /** The week's Monday. */
  week: string;
  /** "This week", "Last week", "Week of 21 Sep". */
  title: string;
  /** In a sentence: "this week", "last week", "in the week of 21 Sep". */
  name: string;
  /** Recorded movement in whole minutes (§12.3), to today in the current week. */
  minutes: number;
  /** The same days of the week before, when that week is all part of the record. */
  before?: number;
  /** "by this time last week", "the week before". */
  beforeName: string;
  stretchDays: number;
  steps?: { perDay: number; days: number };
  glucose?: { numeric: number; lo: number; hi: number; lows: number; highs: number };
  pressure?: { readings: number; severe: number };
}

export function weekFacts({ week, data, prefs, ctx }: { week: string; data: TrendData; prefs: DisplayPrefs; ctx: DayContext }): WeekFacts {
  const range = weekOf(week);
  const current = range.from <= ctx.today && ctx.today <= range.to;
  const shown: DayRange = { from: range.from, to: current ? ctx.today : range.to };
  const last = range.from === addDays(mondayOf(ctx.today), -7);
  const short = format(noon(range.from), 'd MMM');
  const prior: DayRange = { from: addDays(shown.from, -7), to: addDays(shown.to, -7) };
  const moved = (r: DayRange) => wholeMinutes(recordedMovement(r, data.observations, data.sessions).minutes);
  const steps = dailyStats(shown, stepsDays(shown, data.observations, prefs.hour12), ctx, 'stated');
  const glucose = readingsFor('glucose', shown, data, prefs);
  const g = readingStats(shown, glucose.points, glucose.meters, ctx);
  const pressure = readingsFor('bp', shown, data, prefs).texts;
  return {
    week: range.from,
    title: current ? 'This week' : last ? 'Last week' : `Week of ${short}`,
    name: current ? 'this week' : last ? 'last week' : `in the week of ${short}`,
    minutes: moved(shown),
    // Only a week wholly in the record is compared: before the first record there was nothing to count (Review Focus 4).
    ...(ctx.since !== undefined && ctx.since <= prior.from ? { before: moved(prior) } : {}),
    beforeName: current ? 'by this time last week' : 'the week before',
    stretchDays: [...stretchedDays(data.sessions)].filter(d => d >= shown.from && d <= shown.to).length,
    ...(steps.perDay !== undefined ? { steps: { perDay: steps.perDay, days: steps.days } } : {}),
    ...(g.n + g.hi + g.lo > 0 ? { glucose: { numeric: g.n, lo: g.lo, hi: g.hi, lows: g.lows, highs: g.highs } } : {}),
    ...(pressure.length > 0 ? { pressure: { readings: pressure.length, severe: pressure.filter(t => t.note === 'Very high').length } } : {}),
  };
}

/** At most 4 sentences: movement, stretching, the readings with their context, then steps (§12.1). Facts, never verdicts. */
export function weekSentences(f: WeekFacts, prefs: DisplayPrefs): string[] {
  const out: string[] = [];
  if (f.minutes > 0) {
    const moved = `You moved ${countText(f.minutes, ['minute', 'minutes'])} ${f.name}`;
    const diff = f.before === undefined ? undefined : f.minutes - f.before;
    out.push(diff === undefined ? `${moved}.`
      : diff === 0 ? `${moved}, the same as ${f.beforeName}.`
        : `${moved}, ${formatNumber(Math.abs(diff))} ${diff > 0 ? 'more' : 'fewer'} than ${f.beforeName}.`);
  }
  if (f.stretchDays > 0) out.push(`You stretched on ${countText(f.stretchDays, ['day', 'days'])} ${f.name}.`);
  if (f.glucose) {
    const { numeric, lo, hi, lows, highs } = f.glucose;
    const meter = [lo > 0 ? `${formatNumber(lo)} meter LO` : '', hi > 0 ? `${formatNumber(hi)} meter HI` : ''].filter(Boolean).join(' and ');
    const line = GLUCOSE_LINES[prefs.glucose];
    const past = [
      lows > 0 ? `${formatNumber(lows)} ${lows === 1 ? 'was' : 'were'} below ${line.low}` : '',
      highs > 0 ? `${formatNumber(highs)} ${highs === 1 ? 'was' : 'were'} above ${line.high}` : '',
    ].filter(Boolean).join(' and ');
    out.push(`${countText(numeric + lo + hi, ['glucose reading', 'glucose readings'])} ${f.name}${meter ? ` (${formatNumber(numeric)} with a number, ${meter})` : ''}${past ? `; ${past}` : ''}.`);
  }
  if (f.pressure) {
    const { readings, severe } = f.pressure;
    out.push(`${countText(readings, ['blood pressure reading', 'blood pressure readings'])} ${f.name}${severe > 0 ? `; ${formatNumber(severe)} ${severe === 1 ? 'was' : 'were'} 180/120 mmHg or higher` : ''}.`);
  }
  if (f.steps) out.push(`${formatNumber(f.steps.perDay)} steps a day on average ${f.name}, from ${countText(f.steps.days, ['day with steps', 'days with steps'])}.`);
  return out.slice(0, 4);
}

/** Why Your week is paused today, or nothing: a safety decision stands, or the status isn't Normal (§12.6). */
export function briefPause({ status, urgent }: { status: Status; urgent: boolean }): 'status' | 'safety' | undefined {
  if (urgent) return 'safety';
  return status === 'normal' ? undefined : 'status';
}

export interface WeekRing {
  /** Monday. */
  week: string;
  minutes: number;
  /** The goal the week had (B-16); none drawn without one. */
  goal?: number;
  current: boolean;
}

/** The last 8 weeks, oldest first, each against the goal it had (B-16), drawn set (M21). */
export function weekRings(today: string, data: TrendData, settings: WeeklyGoalSettings | undefined): WeekRing[] {
  const thisWeek = mondayOf(today);
  return Array.from({ length: 8 }, (_, i) => {
    const week = addDays(thisWeek, (i - 7) * 7);
    const goal = weeklyGoalOn(settings, week);
    return {
      week,
      minutes: wholeMinutes(recordedMovement(weekOf(week), data.observations, data.sessions).minutes),
      ...(goal !== undefined ? { goal } : {}),
      current: week === thisWeek,
    };
  });
}

/** A ring's name, with its visible date in it (WCAG 2.5.3): "Week of 21 Sep: 96 of 150 min". */
export function ringLabel(r: WeekRing): string {
  const name = r.current ? 'This week' : `Week of ${format(noon(r.week), 'd MMM')}`;
  return r.goal === undefined ? `${name}: ${formatNumber(r.minutes)} min moved` : `${name}: ${formatNumber(r.minutes)} of ${formatNumber(r.goal)} min`;
}

/** A goal change waiting for Monday, said beside the rings (B-16). */
export function pendingGoalText(settings: WeeklyGoalSettings | undefined, today: string): string | undefined {
  const p = pendingWeeklyGoal(settings, today);
  if (!p) return undefined;
  const on = format(noon(p.from), 'EEEE d MMMM');
  return p.goal === undefined ? `From ${on}, no weekly goal.` : `From ${on}, your weekly goal is ${formatNumber(p.goal)} min.`;
}

/** Content state's key for the weeks whose brief was opened: backed up with the record (B-20: once seen, it stays seen). */
export const WEEK_BRIEF_KEY = 'trends:weekBrief';

/** The Mondays whose brief was opened, read from content state; anything else there is ignored. */
export function briefSeen(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((w): w is string => typeof w === 'string') : [];
}

/** The list with `week` opened, the last 8 kept. */
export function withSeen(seen: readonly string[], week: string): string[] {
  return [...seen.filter(w => w !== week), week].slice(-8);
}

/** Last week's brief, from Monday 04:00 until it's opened or the week is over (B-20, L-18), when last week has something to say. */
export function weekBriefFor({ now, seen, hasFacts }: { now: Date; seen: readonly string[]; hasFacts: boolean }): { week: string } | undefined {
  const day = dayOf(now);
  const monday = mondayOf(day);
  if (day === monday && now.getHours() < 4) return undefined;
  const week = addDays(monday, -7);
  return hasFacts && !seen.includes(week) ? { week } : undefined;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/screens/trends/yourWeek.test.ts`
Expected: PASS.

- [ ] **Step 5: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/trends/yourWeek.ts src/screens/trends/yourWeek.test.ts
git commit -m "feat: Say a week in a few facts, ring the last 8 weeks, and time the brief"
```

---

### Task 13: The Trends tab

**Files:**
- Create: `src/screens/trends/TrendsScreen.tsx`
- Create: `src/screens/trends/YourWeekCard.tsx`
- Create: `src/screens/trends/WeeklyRings.tsx`
- Create: `src/screens/trends/Sparkline.tsx`
- Modify: `src/screens/trends/routes.tsx` (the tab's root)
- Modify: `src/screens/track/MyDay.tsx` (the interim `view` prop goes)
- Modify: `scripts/e2e/acceptance/journeys/s01.mjs` (its Trends note, and two category trends swept)

**Interfaces:**
- Consumes:
  - Task 12's `weekFacts`, `weekSentences`, `briefPause`, `weekRings`, `ringLabel`, `pendingGoalText`, `WEEK_BRIEF_KEY`, `briefSeen`, `withSeen`, `type WeekRing`; Task 8's `trendRow`, `type TrendRowView`; Task 7's `trendContext`; Task 5's `TREND_ORDER`, `TRENDS`, `hasData`; Task 4's `activities`;
  - `GROUPS`, `categoryById`, `type CategoryId` (`@/categories`); `TileIcon` (`@/screens/home/Tile`); `UrgentContext` (`@/screens/home/urgent`); `Ring`, `ringGeometry`; `setContentState`, `useStore`; `statusOn`; `markInPlace`, `type Origin`; `recordPath`; `displayPrefs`; `useToday`; `addDays`, `mondayOf`.
- Produces:
  - `TrendsScreen` (default export), the index of `/trends/*`, reading `?week=YYYY-MM-DD` (a Monday) to show that week;
  - `YourWeekCard(props: { title: string; name: string; minutes: number; goal?: number; sentences: readonly string[]; pause?: 'status' | 'safety'; pending?: string; onLastWeek?: () => void; onThisWeek?: () => void })`;
  - `WeeklyRings(props: { rings: readonly WeekRing[]; chosen: string; onChoose: (week: string) => void })`;
  - `Sparkline(props: { values: readonly (number | null)[]; colour: string; kind: 'bars' | 'line' })`;
  - `MyDay({ day }: { day?: string })`: Today's log only.

- [ ] **Step 1: Write** `src/screens/trends/Sparkline.tsx`

```tsx
/**
 * A category's last days or readings, drawn small beside its row on the
 * Trends tab. The row's words carry the figure, so this is hidden from
 * VoiceOver, and from narrow rows at large text.
 */
export function Sparkline({ values, colour, kind }: { values: readonly (number | null)[]; colour: string; kind: 'bars' | 'line' }) {
  const W = 56;
  const H = 24;
  const shown = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (shown.length === 0) return null;
  let low = kind === 'bars' ? 0 : Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (const v of shown) {
    if (v < low) low = v;
    if (v > high) high = v;
  }
  const span = high - low || 1;
  const y = (v: number) => H - 2 - ((v - low) / span) * (H - 4);
  const step = W / values.length;
  const points = values.flatMap((v, i) => (v === null ? [] : [{ x: (i + 0.5) * step, y: y(v) }]));
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden className="shrink-0 @max-[16rem]:hidden">
      {kind === 'bars'
        ? values.map((v, i) => (v === null ? null : (
          <rect key={i} x={i * step + step * 0.2} y={y(v)} width={step * 0.6} height={Math.max(1, H - 2 - y(v))} rx={1} style={{ fill: colour }} />
        )))
        : points.length === 1
          ? <circle cx={points[0].x} cy={points[0].y} r={2.5} style={{ fill: colour }} />
          : <polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} fill="none" style={{ stroke: colour }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
    </svg>
  );
}
```

- [ ] **Step 2: Write** `src/screens/trends/WeeklyRings.tsx`

```tsx
/**
 * The last 8 weeks as small rings (journey §12.1): one radio group, so it's
 * one choice however many weeks there are (B-08). Each ring is drawn set
 * against the goal its week had (B-16, B-32, M21), and its name gives the
 * minutes in words.
 */
import type { KeyboardEvent } from 'react';
import { format } from 'date-fns';
import { ringGeometry } from '@/components/hig/scale';
import { cn } from '@/lib/utils';
import { ringLabel, type WeekRing } from './yourWeek';

function MiniRing({ minutes, goal }: { minutes: number; goal?: number }) {
  const g = ringGeometry(40);
  // Never past full, as Home's ring (journey §7.3): the words say by how much.
  const filled = goal ? Math.min(1, minutes / goal) : 0;
  return (
    <svg width={g.size} height={g.size} viewBox={`0 0 ${g.size} ${g.size}`} aria-hidden>
      <g transform={`rotate(-90 ${g.centre} ${g.centre})`}>
        <circle cx={g.centre} cy={g.centre} r={g.radius} fill="none" stroke="currentColor" strokeWidth={g.track} className="text-separator" />
        {filled > 0 && (
          <circle
            cx={g.centre} cy={g.centre} r={g.radius} fill="none" stroke="currentColor" strokeWidth={g.track} strokeLinecap="round"
            strokeDasharray={g.circumference} strokeDashoffset={g.circumference * (1 - filled)} className="text-cat-move"
          />
        )}
      </g>
    </svg>
  );
}

export function WeeklyRings({ rings, chosen, onChoose }: { rings: readonly WeekRing[]; chosen: string; onChoose: (week: string) => void }) {
  const i = Math.max(0, rings.findIndex(r => r.week === chosen));
  // Arrow keys, Home and End move the choice, as a native radio group does.
  const keys = (e: KeyboardEvent<HTMLButtonElement>) => {
    const n = rings.length;
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? Math.min(n - 1, i + 1)
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? Math.max(0, i - 1)
        : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    onChoose(rings[next].week);
    e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Week" className="grid grid-cols-4 gap-3">
      {rings.map(r => {
        const selected = r.week === chosen;
        return (
          <button
            key={r.week}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={ringLabel(r)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChoose(r.week)}
            onKeyDown={keys}
            className={cn('press-feedback flex min-h-12 flex-col items-center gap-1 rounded-xl bg-grouped-card px-1 py-2', selected && 'ring-2 ring-tint')}
          >
            <MiniRing minutes={r.minutes} goal={r.goal} />
            <span aria-hidden className="text-[length:var(--text-footnote)] leading-tight [overflow-wrap:anywhere]">
              {r.current ? 'This week' : format(new Date(`${r.week}T12:00:00`), 'd MMM')}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Write** `src/screens/trends/YourWeekCard.tsx`

```tsx
/**
 * Your week (journey §12.1): the week's ring against the goal it had, or its
 * minutes when there was none, then up to 4 factual sentences, paused while
 * the status isn't Normal or a safety decision stands (§12.6). The ring is
 * drawn set, never swept (M21, B-32).
 */
import { useId } from 'react';
import { Ring } from '@/components/hig/Ring';
import { formatNumber } from '@/screens/track/units';

const PAUSED = {
  status: 'Your week’s summary returns when your status is back to Normal.',
  safety: 'Your week’s summary returns once today’s safety advice has passed.',
} as const;

export function YourWeekCard({ title, name, minutes, goal, sentences, pause, pending, onLastWeek, onThisWeek }: {
  /** "This week", "Last week", "Week of 21 Sep". */
  title: string;
  /** In a sentence: "this week", "last week", "in the week of 21 Sep". */
  name: string;
  minutes: number;
  goal?: number;
  sentences: readonly string[];
  pause?: 'status' | 'safety';
  /** A goal change waiting for Monday (B-16). */
  pending?: string;
  onLastWeek?: () => void;
  onThisWeek?: () => void;
}) {
  const id = useId();
  const button = 'press-feedback min-h-12 self-start rounded-full bg-tint/10 px-4 text-[length:var(--text-subhead)] font-semibold text-tint';
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-xl bg-grouped-card p-4">
      <h2 id={id} className="leading-tight">
        <span className="block text-[length:var(--text-title-2)] font-semibold">Your week</span>
        <span className="block text-[length:var(--text-subhead)] text-muted-foreground">{title}</span>
      </h2>
      {goal !== undefined
        ? <Ring value={minutes} goal={goal} label={`Moved ${name}`} unit="min" animate={false} arcClassName="text-cat-move" />
        : <p className="text-[length:var(--text-body)]"><span className="numeric font-semibold">{formatNumber(minutes)}</span> min moved {name}</p>}
      {pause ? (
        <p className="text-[length:var(--text-body)] leading-snug text-muted-foreground">{PAUSED[pause]}</p>
      ) : sentences.length > 0 ? (
        <ul className="flex flex-col gap-1.5 text-[length:var(--text-body)] leading-snug">{sentences.map(s => <li key={s}>{s}</li>)}</ul>
      ) : (
        <p className="text-[length:var(--text-body)] leading-snug text-muted-foreground">Nothing recorded {name}{name === 'this week' ? ' yet' : ''}.</p>
      )}
      {pending && <p className="text-[length:var(--text-footnote)] leading-snug text-muted-foreground">{pending}</p>}
      {onLastWeek && <button type="button" onClick={onLastWeek} className={button}>Last week in brief</button>}
      {onThisWeek && <button type="button" onClick={onThisWeek} className={button}>Back to this week</button>}
    </section>
  );
}
```

- [ ] **Step 4: Write** `src/screens/trends/TrendsScreen.tsx`

```tsx
/**
 * The Trends tab (journey §12.1): Your week, with its ring and the last 8
 * weeks; every category with data, in the registry's order, whether or not
 * it's on Home (A-29, K-33); the recent workouts, stretches and walks; and
 * Today's log. History is drawn at once, never swept in (M21). Trends
 * decides nothing: the safety surface above it is the shell's (B-02).
 */
import { useContext, useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ChevronRightIcon, PlusIcon, SmileIcon } from 'lucide-react';
import { GROUPS, categoryById, type CategoryId } from '@/categories';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { markInPlace, type Origin } from '@/components/hig/navigation';
import { isDay } from '@/health/observation';
import { statusOn } from '@/health/status';
import { TileIcon } from '@/screens/home/Tile';
import { UrgentContext } from '@/screens/home/urgent';
import { displayPrefs } from '@/screens/track/logKinds';
import { addDays, mondayOf } from '@/screens/track/periods';
import { recordPath } from '@/screens/track/timeline';
import { useToday } from '@/screens/track/useToday';
import { setContentState, useStore } from '@/store/useStore';
import { TREND_ORDER, TRENDS, hasData } from './metrics';
import { trendContext, trendRow, type TrendRowView } from './model';
import { activities } from './records';
import { Sparkline } from './Sparkline';
import { WeeklyRings } from './WeeklyRings';
import { YourWeekCard } from './YourWeekCard';
import { WEEK_BRIEF_KEY, briefPause, briefSeen, pendingGoalText, weekFacts, weekRings, weekSentences, withSeen } from './yourWeek';

/** A category's row (§12.1): its icon, its title, its figure with the statistic named, and a small chart. */
function TrendLink({ row, origin }: { row: TrendRowView; origin: Origin }) {
  return (
    <Link to={`/trends/${row.id}`} state={origin} viewTransition className="@container press-feedback block transition-colors active:bg-muted/60">
      <span className="flex min-h-[3.25rem] items-center gap-3 px-4 py-2.5 @max-[16rem]:flex-wrap @max-[16rem]:px-2">
        {row.id === 'mood'
          ? <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-tint/10 text-tint"><SmileIcon className="size-6" strokeWidth={2.1} /></span>
          : <TileIcon category={{ id: row.id as CategoryId, colour: row.colour }} />}
        <span className="min-w-0 flex-1">
          <span className="block text-[length:var(--text-body)] leading-snug [overflow-wrap:break-word]">{row.title}</span>
          <span className="block text-[length:var(--text-subhead)] leading-snug text-muted-foreground [overflow-wrap:break-word]">{row.value}</span>
        </span>
        <Sparkline values={row.spark} colour={`var(${row.colour})`} kind={TRENDS[row.id].family === 'readings' ? 'line' : 'bars'} />
        <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/70" aria-hidden />
      </span>
    </Link>
  );
}

export default function TrendsScreen() {
  const state = useStore();
  const today = useToday();
  const urgent = useContext(UrgentContext);
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const thisWeek = mondayOf(today);
  const lastWeek = addDays(thisWeek, -7);
  const asked = params.get('week');
  // A week from the rings, or from Home's brief; never one still to come.
  const week = asked !== null && isDay(asked) && mondayOf(asked) <= thisWeek ? mondayOf(asked) : thisWeek;

  const data = useMemo(() => ({ observations: state.observations, sessions: state.sessions, checkIns: state.checkIns }), [state.observations, state.sessions, state.checkIns]);
  const prefs = useMemo(() => displayPrefs(state.settings, state.profile, state.observations), [state.settings, state.profile, state.observations]);
  const ctx = useMemo(() => trendContext({ today, data, settings: state.settings, profile: state.profile }), [today, data, state.settings, state.profile]);
  const facts = useMemo(() => weekFacts({ week, data, prefs, ctx }), [week, data, prefs, ctx]);
  const rings = useMemo(() => weekRings(today, data, state.settings), [today, data, state.settings]);
  const rows = useMemo(() => TREND_ORDER.filter(id => hasData(id, data)).map(id => trendRow(TRENDS[id], data, prefs, ctx)), [data, prefs, ctx]);
  const recent = useMemo(() => activities(data, prefs, today).slice(0, 5), [data, prefs, today]);

  const pause = briefPause({ status: statusOn(state.settings.statusPeriods, today), urgent: urgent !== undefined });
  const goal = rings.find(r => r.week === week)?.goal;
  const pending = week === thisWeek ? pendingGoalText(state.settings, today) : undefined;
  const choose = (next: string) => {
    markInPlace();
    // Reading last week here is opening its brief (B-20).
    if (next === lastWeek) void setContentState(WEEK_BRIEF_KEY, withSeen(briefSeen(state.contentState[WEEK_BRIEF_KEY]), next));
    setParams(prev => {
      const p = new URLSearchParams(prev);
      if (next === thisWeek) p.delete('week');
      else p.set('week', next);
      return p;
    }, { replace: true });
  };
  const origin: Origin = { path: location.pathname, label: 'Trends', ...(location.search ? { search: location.search } : {}) };
  const sections = [
    ...GROUPS.filter(g => g.id !== 'learn').map(g => ({ title: g.title, rows: rows.filter(r => r.id !== 'mood' && categoryById(r.id as CategoryId).group === g.id) })),
    // Mood isn't a category: it comes only from v4 backups, and is never hidden (D74).
    { title: 'Other records', rows: rows.filter(r => r.id === 'mood') },
  ].filter(s => s.rows.length > 0);

  if (ctx.since === undefined) {
    return (
      <Screen title="Trends">
        <div className="flex flex-col items-start gap-3 rounded-xl bg-grouped-card p-4">
          <h2 className="text-[length:var(--text-title-2)] font-semibold">Nothing recorded yet</h2>
          <p className="text-[length:var(--text-body)] leading-snug text-muted-foreground">Each reading, walk, stretch and workout you record shows here, week by week.</p>
          <Link to="/day/today?add=" state={origin} className="press-feedback inline-flex min-h-12 items-center gap-2 rounded-full bg-tint px-5 text-[length:var(--text-body)] font-semibold text-on-tint">
            <PlusIcon className="size-5" aria-hidden />
            Add a record
          </Link>
        </div>
      </Screen>
    );
  }

  return (
    <Screen title="Trends">
      <YourWeekCard
        title={facts.title}
        name={facts.name}
        minutes={facts.minutes}
        {...(goal !== undefined ? { goal } : {})}
        sentences={pause ? [] : weekSentences(facts, prefs)}
        {...(pause ? { pause } : {})}
        {...(pending ? { pending } : {})}
        {...(week === thisWeek ? { onLastWeek: () => choose(lastWeek) } : { onThisWeek: () => choose(thisWeek) })}
      />
      <WeeklyRings rings={rings} chosen={week} onChoose={choose} />
      {sections.map(s => (
        <Group key={s.title} header={s.title}>
          {s.rows.map(r => <TrendLink key={r.id} row={r} origin={origin} />)}
        </Group>
      ))}
      {recent.length > 0 && (
        // Plan 6 adds a route's thumbnail to a walk's row.
        <Group header="Recent workouts, stretches and walks">
          {recent.map(r => <Row key={r.key} as={Link} to={recordPath(r.ref)} state={origin} label={r.heading} detail={r.detail} chevron />)}
        </Group>
      )}
      <Group>
        <Row as={Link} to="/day/today" state={origin} label="See today’s log" detail="Every record of today, to correct or delete" chevron />
      </Group>
    </Screen>
  );
}
```

Trends never computes a permission: whether Your week pauses comes from the status and the shell's urgent decision, as Home's own quiet rule does.

- [ ] **Step 5: Mount the root.** In `src/screens/trends/routes.tsx`, replace the `MyDay` import with `import TrendsScreen from './TrendsScreen';`, and the index route and its comment with:

```tsx
      <Route index element={<TrendsScreen />} />
```

- [ ] **Step 6: Today's log is Today's log only.** In `src/screens/track/MyDay.tsx`:
  - in the header comment, delete "and until Plan 3 builds Trends, the Trends tab too (`view="trends"`)", ending the sentence after "(`/day/:date`, the day in the path)";
  - change the signature to `export function MyDay({ day: pathDay }: { day?: string })`, deleting the `view` prop and its comment;
  - replace `const view: View = onlyView ?? (params.get('view') === 'trends' ? 'trends' : 'timeline');` with `const view: View = params.get('view') === 'trends' ? 'trends' : 'timeline';`;
  - replace `const title = onlyView === 'trends' ? 'Trends' : 'My Day';` with `const title = 'My Day';`;
  - in `onSaved`, replace `if (!onlyView) change({ day: result.day, view: 'timeline' });` with `change({ day: result.day, view: 'timeline' });`, and its comment's last sentence ("Trends has no timeline, so it says so and stays.") goes;
  - remove the `{!onlyView && (` wrapper and its closing `)}` around the date stepper and the "Show" control, keeping what's inside.

My Day's own "Show: Timeline · Trends" control stays: J01, J05, J07, J19, J20 and S01 use it.

- [ ] **Step 7: S01 sweeps the new screens.** In `scripts/e2e/acceptance/journeys/s01.mjs`, step 4:
  - change the comment `// The Trends tab's root: My Day's Trends view on its own until Plan 3 (journey §12).` to `// The Trends tab's root (journey §12.1), and two category trends with P01's September records (§12.2).`;
  - after `await visit(t, '/trends', 'trends-tab');`, add:

```js
    await visit(t, '/trends/glucose?period=month&at=2026-09-25', 'trends-glucose-september');
    await visit(t, '/trends/back?period=month&at=2026-09-25', 'trends-back-september');
```

- [ ] **Step 8: Gates**

```bash
npx tsc -b && npm run lint && npx vitest run
```

- [ ] **Step 9: Check by eye.** With P01 seeded (Task 11, Step 6), at 428×926 and 320×568, light and dark, 100% and 200% text:
  - Trends: Your week ("This week", "Nothing recorded this week yet."), the 8 rings in two rows of four, then Move with Workout and Stretch (the 25 September session's mobility block makes that a stretch day, D72), then Check with each reading P01's migration made, in the registry's order, then "See today’s log";
  - tap the ring for the week of 21 September: "Week of 21 Sep", its sentences, and "Back to this week"; Back leaves Trends rather than stepping through the rings (they replace the address);
  - "Last week in brief" shows last week and keeps it as seen (`trends:weekBrief` in content state), which Task 14's row on Home reads;
  - set Away in Home's status, then open Trends: the sentences are replaced by "Your week’s summary returns when your status is back to Normal.";
  - a first run (no record): "Nothing recorded yet" and "Add a record", which opens Today's log with the Add list.

- [ ] **Step 10: Run the journeys that cross these screens**

```bash
npm run e2e:acceptance -- --only=S01,J01,J05,J07,J20
```

Expected: pass. J07 reads Home's ring by the name "Moved this week", inside Home's main region only, so Trends' own ring of that name doesn't collide with it.

- [ ] **Step 11: Commit**

```bash
git add src/screens/trends/TrendsScreen.tsx src/screens/trends/YourWeekCard.tsx src/screens/trends/WeeklyRings.tsx src/screens/trends/Sparkline.tsx src/screens/trends/routes.tsx src/screens/track/MyDay.tsx scripts/e2e/acceptance/journeys/s01.mjs
git commit -m "feat: Build the Trends tab: Your week, 8 weeks of rings, every category with data, and recent activity"
```

---

### Task 14: "Your week in brief" on Home

**Files:**
- Modify: `src/screens/today/model.ts` (`Prompt` and `pickPrompt`)
- Modify: `src/screens/today/model.test.ts`
- Modify: `src/screens/home/HomeScreen.tsx`

**Interfaces:**
- Consumes: Task 12's `weekBriefFor`, `weekFacts`, `weekSentences`, `briefSeen`, `withSeen`, `WEEK_BRIEF_KEY`; Task 7's `trendContext`; `markTab` (`@/components/hig/navigation`); `getState`, `setContentState` (`@/store/useStore`); `displayPrefs`; `addDays`, `mondayOf`.
- Produces:
  - `Prompt` gains `{ kind: 'weekBrief'; week: string }`;
  - `pickPrompt`'s input gains `weekBrief?: { week: string }`, ranked last of all: after the water row, and after a first result never entered (§12.6, B-20, L-18).

Home already wakes at 04:00 (`DAY_EDGES` in `nextBoundary`), so the brief appears on Monday at 04:00 without a timer of its own.

- [ ] **Step 1: Write the failing tests.** In `src/screens/today/model.test.ts`, inside `describe('pickPrompt', …)`, add:

```ts
  it('offers Your week in brief last of all: after a reminder, the water row and a first result never entered (B-20, §12.6)', () => {
    const weekBrief = { week: '2026-09-28' };
    const late = at(TODAY, '22:00');
    const diabetic = profile({ diabetes: 'type2', hypertension: 'none' });
    expect(pickPrompt({ ...base, weekBrief, now: late })).toEqual({ kind: 'weekBrief', week: '2026-09-28' });
    expect(pickPrompt({ ...base, weekBrief })).toEqual({ kind: 'water', goalMl: 2000, glassMl: 300 });
    expect(pickPrompt({ ...base, weekBrief, now: late, waiting: [stand] })).toEqual({ kind: 'reminder', item: stand });
    expect(pickPrompt({ ...base, weekBrief, now: late, profile: diabetic })).toMatchObject({ kind: 'due', item: { kind: 'hba1cFirst' } });
  });

  it('never offers the brief beside a safety decision, or on a day that isn’t Normal (§12.6)', () => {
    const weekBrief = { week: '2026-09-28' };
    const late = at(TODAY, '22:00');
    expect(pickPrompt({ ...base, weekBrief, now: late, held: true })).toBeUndefined();
    expect(pickPrompt({ ...base, weekBrief, now: late, stopped: true })).toBeUndefined();
    for (const status of ['flare', 'unwell', 'away'] as const) expect(pickPrompt({ ...base, weekBrief, now: late, status })).toBeUndefined();
  });
```

- [ ] **Step 2: Run them to check they fail**

Run: `npx vitest run src/screens/today/model.test.ts`
Expected: FAIL: the first case gets `undefined`.

- [ ] **Step 3: Rank it.** In `src/screens/today/model.ts`:
  - add to the `Prompt` union:

```ts
  /** "Your week in brief": last week's, from Monday 04:00 until it's opened (journey §12.6, B-20). */
  | { kind: 'weekBrief'; week: string };
```

  - add to `pickPrompt`'s input, after `waiting`:

```ts
  /** Last week's brief, when `weekBriefFor` offers one. It ranks last of all (L-18). */
  weekBrief?: { week: string };
```

  - replace `const firstOrNothing = first ? { kind: 'due' as const, item: first } : undefined;` with:

```ts
  // Last of all: a first result never entered, then Your week in brief (§12.6, L-18). Neither shows when quiet.
  const brief = input.weekBrief ? { kind: 'weekBrief' as const, week: input.weekBrief.week } : undefined;
  const last = first ? { kind: 'due' as const, item: first } : brief;
```

  - change both `return firstOrNothing;` to `return last;`;
  - in `pickPrompt`'s doc comment, after "then their water habit", add ", then last week's brief".

The quiet branch (`if (quiet) return first ? … : undefined;`) is left alone: a hold, a re-check or a status that isn't Normal never shows the brief.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/screens/today/model.test.ts`
Expected: PASS, the existing cases included.

- [ ] **Step 5: Offer it on Home.** In `src/screens/home/HomeScreen.tsx`:
  - add `CalendarDaysIcon` to the `lucide-react` import, and `setContentState` to the `@/store/useStore` import;
  - add the imports:

```tsx
import { markTab } from '@/components/hig/navigation';
import { displayPrefs } from '@/screens/track/logKinds';
import { addDays, mondayOf } from '@/screens/track/periods';
import { trendContext } from '@/screens/trends/model';
import { WEEK_BRIEF_KEY, briefSeen, weekBriefFor, weekFacts, weekSentences, withSeen } from '@/screens/trends/yourWeek';
```

  - just before `const prompt = pickPrompt({`, add:

```tsx
  // "Your week in brief" (journey §12.6, B-20): last week's, when it has something to say, until it's opened.
  const briefHasFacts = useMemo(() => {
    const data = { observations, sessions, checkIns: state.checkIns };
    const prefs = displayPrefs(settings, profile, observations, HOUR12);
    const ctx = trendContext({ today, data, settings, profile });
    return weekSentences(weekFacts({ week: addDays(mondayOf(today), -7), data, prefs, ctx }), prefs).length > 0;
  }, [observations, sessions, state.checkIns, settings, profile, today]);
  const weekBrief = weekBriefFor({ now, seen: briefSeen(state.contentState[WEEK_BRIEF_KEY]), hasFacts: briefHasFacts });
```

  - in the `pickPrompt({ … })` call, add `...(weekBrief ? { weekBrief } : {}),`;
  - at the top of `PromptRow`, before `if (prompt.kind === 'due')`, add:

```tsx
  if (prompt.kind === 'weekBrief') {
    const { week } = prompt;
    // Opening it is seeing it (B-20): kept in content state, so it stays seen on every device it's restored to.
    const open = () => {
      markTab('trends');
      void setContentState(WEEK_BRIEF_KEY, withSeen(briefSeen(getState().contentState[WEEK_BRIEF_KEY]), week));
    };
    return (
      <Group>
        <Row as={Link} to={`/trends?week=${week}`} viewTransition onClick={open} icon={<CalendarDaysIcon />} label="Your week in brief" detail="Last week, in a few sentences" chevron />
      </Group>
    );
  }
```

  - change `PromptRow`'s doc comment to "The one prompt: a due check with its source, the water habit the person chose, or last week's brief."

`markTab('trends')` makes the screen it opens Trends', as the urgent banner's "What to do" makes Home's: the Trends tab is then selected, and its Back returns to Trends' root.

- [ ] **Step 6: Gates**

```bash
npx tsc -b && npm run lint && npx vitest run
```

- [ ] **Step 7: The clock decides when it shows,** so it's proven by V-J07's "brief" case (Task 15), which opens Home at Monday 04:05 with a fixed clock: Home offers "Your week in brief", it opens Trends at "Last week", and Home doesn't offer it again that week.

- [ ] **Step 8: Commit**

```bash
git add src/screens/today/model.ts src/screens/today/model.test.ts src/screens/home/HomeScreen.tsx
git commit -m "feat: Offer Your week in brief on Home, last of all, until it's opened"
```

---

### Task 15: Acceptance: V-J07, V-J24 with B-30's historical case, V-J26 and V-J27

Each journey in J§17 becomes an acceptance case (J§17, §21.3). The suite's clock is frozen at Thursday 8 October 2026, 09:00 IST (`lib/env.mjs`) unless a case opens at another time, and moves only forward (`t.setTime`). Records that no screen in this plan makes (a fortnight of entered steps, a FitStrong walk) arrive the one way the app accepts them: a canonical backup merged through Me → Data → Restore, as J05 and J18 do.

**Files:**
- Modify: `scripts/e2e/acceptance/lib/data.mjs` (`importFixture`)
- Modify: `scripts/e2e/acceptance/run.mjs` (the file filter, if Plan 2 hasn't widened it)
- Create: `scripts/e2e/acceptance/journeys/v07.mjs`, `v24.mjs`, `v26.mjs`, `v27.mjs`

**Interfaces:**
- Consumes: `transferDoc`, `obs`, `writeFixture`, `chooseRestore`, `merge`, `openForm`, `saveForm`, `logTotal`, `logGlucose`, `logLab` (`lib/data.mjs`); `tabTo` (`lib/guide.mjs`); `tap`, `type`, `row`, `button`, `radio`, `back`, `heading`, `section`, `setDateTime` (`lib/ui.mjs`); `content` (`lib/harness.mjs`); `persona` (`fixtures/personas.mjs`).
- Produces:
  - `importFixture(t, name, doc): Promise<void>` in `lib/data.mjs`;
  - journeys with ids `VJ07`, `VJ24`, `VJ26` and `VJ27`, selectable with `--only=VJ07,…`.

- [ ] **Step 1: One way to merge a fixture.** In `scripts/e2e/acceptance/lib/data.mjs`, after `waitOutcome`, add:

```js
/**
 * Merge a canonical backup into the open app through Me → Data → Restore →
 * Merge, as a person would: the defined setup for records no screen of the
 * journey makes itself. Fails the step if the merge doesn't complete.
 */
export async function importFixture(t, name, doc) {
  const sheet = await chooseRestore(t, writeFixture(t, name, doc));
  await merge(t, sheet);
  const outcome = (await sheet.innerText()).replace(/\s+/g, ' ');
  if (!/Merged\./.test(outcome)) throw new Error(`merging ${name} did not complete: ${outcome.slice(0, 300)}`);
  await ui.tap(ui.button(sheet, 'Done'));
  await sheet.waitFor({ state: 'hidden' });
}
```

- [ ] **Step 2: The runner takes the V journeys.** If `run.mjs` still filters journey files with `/^[js]\d\d\.mjs$/`, change it to `/^[jsv]\d\d\.mjs$/`. Plan 2 does the same, and Plan 4 adds `m`: keep whatever letters are already there, and add `v` only if it's missing.

Run: `npm run e2e:acceptance -- --list`
Expected: the J and S journeys, and any V journeys already written. VJ07, VJ24, VJ26 and VJ27 aren't there yet.

- [ ] **Step 3: Write** `scripts/e2e/acceptance/journeys/v07.mjs`

```js
/**
 * V-J07, see my week (journey §17.1): Trends → Your week → the Steps row →
 * Week bars against last week → back. P02, whose steps were entered at
 * 8 pm each evening for a fortnight. Then B-20's brief: on Monday from
 * 04:00, Home offers "Your week in brief"; it opens Trends at last week, and
 * once opened it isn't offered again.
 */
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as g from '../lib/guide.mjs';
import { content } from '../lib/harness.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ07';
export const title = 'See my week: Your week, then Steps against last week, and the brief on Monday';
export const safety = false;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const STEPS = [
  ['2026-09-28', 5000], ['2026-09-29', 6000], ['2026-09-30', 5800], ['2026-10-01', 6200], ['2026-10-02', 4000], ['2026-10-03', 8000], ['2026-10-04', 3500],
  ['2026-10-05', 6000], ['2026-10-06', 7000], ['2026-10-07', 5500],
];
const fortnight = () => data.transferDoc({
  observations: STEPS.map(([day, value]) => data.obs({ id: `v07-${day}`, kind: 'steps', value, scope: 'dayTotal', source: 'manual', at: `${day}T20:00:00.000+05:30` })),
});

export const cases = [{
  name: 'Trends → Your week → Steps → Week against last week → back',
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '/home' });
    const main = page.getByRole('main');

    await t.step(1, 'Merge the fortnight of steps (the defined setup)', async () => {
      await data.importFixture(t, 'v07-steps.json', fortnight());
      const steps = (await t.db()).observations.filter(o => o.kind === 'steps');
      await t.must(steps.length === 10, `${steps.length} steps totals stored, not 10`);
    }, { input: 'steps entered at 8 pm each day, 28 September to 7 October' });

    await t.step(2, 'Trends: Your week says the week’s steps in words, and shows 8 weeks of rings', async () => {
      await g.tabTo(t, 'Trends');
      const card = main.getByRole('region', { name: /^Your week/ });
      await t.must(await card.count() === 1, 'Trends has no Your week');
      const text = flat(await card.innerText());
      await t.check(text.includes('This week') && text.includes('6,167 steps a day on average this week, from 3 days with steps.'), `Your week reads: ${text.slice(0, 300)}`);
      await t.check(!/great|well done|keep it up|better|worse/i.test(text), `Your week judges: ${text.slice(0, 300)}`);
      await t.check(await main.getByRole('radiogroup', { name: 'Week' }).getByRole('radio').count() === 8, 'Trends does not show 8 weekly rings');
      await t.checkpoint('vj07-your-week');
    });

    await t.step(3, 'The Steps row: Week first, a day on average, against the same days of last week', async () => {
      await ui.tap(main.getByRole('link', { name: /^Steps\b/ }));
      await ui.heading(page, 'Steps');
      await t.check(await t.route() === '/trends/steps', `the Steps row opened ${await t.route()}`);
      await t.check(await ui.radio(main.getByRole('radiogroup', { name: 'Period' }), 'Week').getAttribute('aria-checked') === 'true', 'the trend did not open on Week (B-10)');
      const text = flat(await main.innerText());
      for (const want of ['This week', 'A day on average · 3 days with steps', '6,167', 'Higher than last week · +417 steps a day', 'Mon–Thu vs last Mon–Thu', 'Last week', 'Average 6,167 steps a day']) {
        await t.check(text.includes(want), `the Steps trend does not show “${want}”: ${text.slice(0, 400)}`);
      }
      await t.check(await ui.button(main, 'Previous week').isEnabled() && await ui.button(main, 'Next week').isDisabled(), 'the pager does not read “Previous week” and “Next week”, with no week after this one');
      await t.checkpoint('vj07-steps-week');
    });

    await t.step(4, 'The arrow keys read each day against last week; Escape puts the choice down', async () => {
      const slider = main.getByRole('slider', { name: 'Steps, This week' });
      await slider.focus();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      const said = await slider.getAttribute('aria-valuetext');
      await t.check(said === 'Tuesday, 6 October: 7,000 steps, entered at 8:00 pm. Last week: 6,000 steps.', `Tuesday reads “${said}”`);
      await t.check(flat(await main.innerText()).includes('Tuesday, 6 October: 7,000 steps, entered at 8:00 pm.'), 'the chosen day’s words are not shown above the chart');
      await t.checkpoint('vj07-tuesday');
      await page.keyboard.press('Escape');
      await t.check(await slider.getAttribute('aria-valuenow') === '0', 'Escape did not put the choice down');
    });

    await t.step(5, 'Show as list: the same days in a table', async () => {
      await ui.tap(ui.button(main, 'Show as list'));
      const table = main.getByRole('table', { name: 'Steps, This week' });
      await table.waitFor();
      const tuesday = flat(await table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Tuesday, 6 October' }) }).innerText());
      await t.check(tuesday === 'Tuesday, 6 October 7,000 steps, entered at 8:00 pm 6,000 steps', `Tuesday’s row reads “${tuesday}”`);
      await t.checkpoint('vj07-list');
    });

    await t.step(6, 'Back to Trends', async () => {
      await ui.tap(ui.back(page, 'Trends'));
      await ui.heading(page, 'Trends');
      await t.check(await t.route() === '/trends', `Back went to ${await t.route()}, not /trends`);
    });
  },
}, {
  name: 'Your week in brief on Monday morning, until it’s opened (B-20)',
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '/home', time: Date.parse('2026-10-12T04:05:00+05:30') });
    const main = page.getByRole('main');

    await t.step(1, 'Merge the fortnight of steps; Home offers Your week in brief', async () => {
      await data.importFixture(t, 'v07-steps.json', fortnight());
      await g.tabTo(t, 'Home');
      await t.must(await ui.row(main, 'Your week in brief', 'link').count() === 1, `Home does not offer the brief: ${flat(await main.innerText()).slice(0, 300)}`);
      await t.checkpoint('vj07-brief-offered');
    }, { input: 'Monday 12 October, 4:05 am' });

    await t.step(2, 'Open it: Trends at last week, in a few sentences, kept as seen', async () => {
      await ui.tap(ui.row(main, 'Your week in brief', 'link'));
      await ui.heading(page, 'Trends');
      await t.check(await t.route() === '/trends?week=2026-10-05', `the brief opened ${await t.route()}`);
      const card = flat(await main.getByRole('region', { name: /^Your week/ }).innerText());
      await t.check(card.includes('Last week') && card.includes('6,167 steps a day on average last week, from 3 days with steps.'), `last week’s brief reads: ${card.slice(0, 300)}`);
      await t.check(JSON.stringify(content(await t.db())['trends:weekBrief']) === '["2026-10-05"]', 'opening the brief did not keep it as seen');
      await t.checkpoint('vj07-brief-opened');
    });

    await t.step(3, 'Home no longer offers it this week', async () => {
      await g.tabTo(t, 'Home');
      await t.check(await ui.row(main, 'Your week in brief', 'link').count() === 0, 'Home still offers the brief after it was opened');
    });
  },
}];
```

- [ ] **Step 4: Write** `scripts/e2e/acceptance/journeys/v24.mjs`

```js
/**
 * V-J24 with B-30's historical case (journey §17.2, §4.10): a glucose of 62
 * measured yesterday at 9:30 pm, entered today at 9 am. The guidance asks
 * when it was taken and words it as past; the record keeps its measured
 * time; Trends shows it at that time, named Low, never in the present
 * tense; and the safety surface on Trends is Home's, whatever Home's is.
 * P03, on a sulfonylurea.
 */
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as g from '../lib/guide.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ24';
export const title = 'Yesterday’s low, entered today: its own time, past-tense words, and the same safety surface on Trends';
export const safety = true;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
/** The shell's urgent decision, as `UrgentProvider` puts it on the document (or none). */
const urgentKind = page => page.evaluate(() => document.documentElement.dataset.urgent ?? null);

export const cases = [{
  name: 'yesterday’s low in the guidance, the record and Trends',
  async run(t) {
    const page = await t.open({ seed: persona('P03'), route: '/home' });
    const main = page.getByRole('main');
    let home = null;

    await t.step(1, 'Enter 62 mg/dL measured yesterday at 9:30 pm, and say it was earlier', async () => {
      const form = await data.openForm(t, 'Glucose');
      await ui.type(form.getByRole('textbox', { name: 'Reading', exact: true }), '62');
      await ui.tap(ui.row(form, 'Time'));
      await ui.setDateTime(form.getByLabel('Time', { exact: true }), '2026-10-07T21:30');
      await t.must(await data.saveForm(t, form) === 'guidance', 'a low gave no guidance');
      const dialog = page.getByRole('dialog', { name: /^(Saved|What to do)$/ });
      // Only the questions the guidance asks: when it was taken, then, if it must be settled, whether it has been.
      for (const answer of ['No, it was earlier', 'No, not yet']) {
        const b = ui.button(dialog, answer);
        if (await b.count()) {
          await ui.tap(b);
          await page.waitForTimeout(300);
        }
      }
      const said = flat(await dialog.innerText());
      await t.check(/That was a low\./.test(said) && !/This is a low|Treat it now/.test(said), `the guidance for yesterday’s low isn’t in the past tense: ${said.slice(0, 300)}`);
      await t.checkpoint('vj24-guidance');
      await ui.tap(ui.button(dialog, 'Done'));
      await dialog.waitFor({ state: 'hidden' });
      const stored = (await t.db()).observations.find(o => o.kind === 'glucose' && o.value === 62);
      await t.must(stored?.day === '2026-10-07' && stored.at.startsWith('2026-10-07T21:30'), `the reading is stored at ${stored?.at}, not when it was measured`);
    }, { input: 'glucose 62 mg/dL, time 7 October 9:30 pm; "No, it was earlier"' });

    await t.step(2, 'Home’s safety surface, as it stands', async () => {
      await g.tabTo(t, 'Home');
      home = await urgentKind(page);
      t.note(`Home's urgent state: ${home ?? 'none'}`);
    });

    await t.step(3, 'Trends: the same surface; Your week counts the low in the past tense, or is paused beside the decision', async () => {
      await g.tabTo(t, 'Trends');
      await t.check(await urgentKind(page) === home, `Trends’ urgent state is ${await urgentKind(page)}, Home’s ${home}`);
      const card = flat(await main.getByRole('region', { name: /^Your week/ }).innerText());
      await t.check(home === null
        ? card.includes('1 glucose reading this week; 1 was below 70 mg/dL.')
        : card.includes('Your week’s summary returns once today’s safety advice has passed.'), `Your week reads: ${card.slice(0, 300)}`);
      await t.checkpoint('vj24-trends');
    });

    await t.step(4, 'The Glucose trend: the reading at its measured time, named Low, nothing in the present tense', async () => {
      await ui.tap(main.getByRole('link', { name: /^Glucose\b/ }));
      await ui.heading(page, 'Glucose');
      await t.check(await urgentKind(page) === home, `the Glucose trend’s urgent state is ${await urgentKind(page)}, Home’s ${home}`);
      await ui.tap(ui.button(main, 'Show as list'));
      const row = flat(await main.getByRole('table', { name: 'Glucose, This week' }).getByRole('row')
        .filter({ has: page.getByRole('rowheader', { name: 'Wednesday, 7 October' }) }).innerText());
      await t.check(row === 'Wednesday, 7 October 62 mg/dL at 9:30 pm Low', `the list row reads “${row}”`);
      const text = flat(await main.innerText());
      await t.check(/Below 70 mg\/dL 1\b/.test(text), `the stats don’t count 1 below 70 mg/dL: ${text.slice(0, 400)}`);
      // The trend is the record: what happened, never what to do now. The banner above it is the shell's.
      const chart = flat(await main.getByRole('region', { name: 'Glucose chart' }).innerText());
      await t.check(!/\b(is low|treat it|right now|now)\b/i.test(chart), `the chart speaks in the present tense: ${chart.slice(0, 300)}`);
      await t.checkpoint('vj24-glucose');
    });
  },
}];
```

- [ ] **Step 5: Write** `scripts/e2e/acceptance/journeys/v26.mjs`

```js
/**
 * V-J26, partial steps (journey §17.2, §9.6): 6,050 entered at midday → a
 * FitStrong walk after it → "at least", with both sources, in Trends and on
 * Home → a final total in the evening → it replaces the earlier one and
 * isn't added to it. P02. The walk arrives as the walk screen writes one,
 * merged through Restore: the walk itself is Plan 6's.
 */
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as g from '../lib/guide.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ26';
export const title = 'Partial steps: at least, with both sources, then replaced by the final total';
export const safety = false;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const at = time => `2026-10-08T${time}:00.000+05:30`;
const walk = () => data.transferDoc({
  observations: [
    ...['walkDuration', 'movementMinutes'].map(kind => data.obs({ id: `v26-walk-${kind}`, kind, value: 20, scope: 'sessionObserved', source: 'measured', at: at('15:00'), coverageMs: 1_200_000, context: 'walk:v26-walk' })),
    data.obs({ id: 'v26-walk-steps', kind: 'steps', value: 1250, scope: 'sessionObserved', source: 'measured', at: at('15:00'), coverageMs: 1_200_000, context: 'walk:v26-walk' }),
  ],
});

/** Today in the Steps trend, as VoiceOver hears it: End chooses the last day so far. */
async function todayInSteps(t) {
  const main = t.page.getByRole('main');
  await g.tabTo(t, 'Trends');
  await ui.tap(main.getByRole('link', { name: /^Steps\b/ }));
  await ui.heading(t.page, 'Steps');
  const slider = main.getByRole('slider', { name: 'Steps, This week' });
  await slider.focus();
  await t.page.keyboard.press('End');
  return slider.getAttribute('aria-valuetext');
}

export const cases = [{
  name: 'entered at midday, a walk after it, then the final total',
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '/home' });
    const main = page.getByRole('main');

    await t.step(1, 'At 12:05, enter 6,050 steps for today', async () => {
      await t.setTime(Date.parse(at('12:05')));
      await data.logTotal(t, 'steps', 6050);
      const stored = (await t.db()).observations.filter(o => o.kind === 'steps' && o.scope === 'dayTotal');
      await t.must(stored.length === 1 && stored[0].value === 6050 && stored[0].at.startsWith('2026-10-08T12:05'), `the total is stored as ${JSON.stringify(stored)}`);
    }, { input: '6,050 steps at 12:05 pm' });

    await t.step(2, 'At 3:30 pm, a FitStrong walk from 3:00 pm with 1,250 steps (the defined setup)', async () => {
      await t.setTime(Date.parse(at('15:30')));
      await data.importFixture(t, 'v26-walk.json', walk());
    }, { input: 'a 20-minute walk at 3:00 pm, 1,250 steps' });

    await t.step(3, 'Trends: today is at least 7,300, with both sources; Home says the same', async () => {
      const said = await todayInSteps(t);
      await t.check(said === 'Thursday, 8 October: at least 7,300 steps, 6,050 entered at 12:05 pm + 1,250 in walks after 12:05 pm. Last week: Not entered.', `today reads “${said}”`);
      const text = flat(await main.innerText());
      await t.check(text.includes('1 day shows at least the steps counted'), `the trend doesn’t say today is a lower bound: ${text.slice(0, 300)}`);
      await t.checkpoint('vj26-at-least');
      await g.tabTo(t, 'Home');
      const home = flat(await main.innerText());
      await t.check(home.includes('at least 7,300') && home.includes('6,050 entered at 12:05 pm + 1,250 in walks after 12:05 pm'), `Home’s steps line: ${home.match(/Steps today[^)]{0,120}/)?.[0] ?? 'none'}`);
    });

    await t.step(4, 'At 9 pm, enter the final 9,800: it replaces the total, and the walk isn’t added to it', async () => {
      await t.setTime(Date.parse(at('21:00')));
      await data.logTotal(t, 'steps', 9800);
      const said = await todayInSteps(t);
      await t.check(said === 'Thursday, 8 October: 9,800 steps, entered at 9:00 pm. Last week: Not entered.', `today reads “${said}”`);
      await t.check(!flat(await main.innerText()).includes('11,050'), 'the walk was added to the final total');
      const totals = (await t.db()).observations.filter(o => o.kind === 'steps' && o.scope === 'dayTotal').map(o => o.value).sort((a, b) => a - b);
      await t.check(JSON.stringify(totals) === '[6050,9800]', `the stored statements are ${JSON.stringify(totals)}: both are kept, and the later one counts`);
      await t.checkpoint('vj26-final');
    }, { input: '9,800 steps at 9:00 pm' });
  },
}];
```

- [ ] **Step 6: Write** `scripts/e2e/acceptance/journeys/v27.mjs`

```js
/**
 * V-J27, the first days of trends (journey §17.2, §12.2): one reading → its
 * point shows at once; the comparison waits for 3 days with data in both
 * weeks, then appears, like for like; a lab result needs no daily data.
 * P03, from Monday 28 September, one glucose each morning at 9 am.
 */
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as g from '../lib/guide.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ27';
export const title = 'First days of trends: a point at once, a comparison after 3 days in both weeks, labs at once';
export const safety = false;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const IST = iso => Date.parse(`${iso}+05:30`);

/** The Glucose trend's words, opened from the Trends tab. */
async function glucoseWeek(t) {
  const main = t.page.getByRole('main');
  await g.tabTo(t, 'Trends');
  await ui.tap(main.getByRole('link', { name: /^Glucose\b/ }));
  await ui.heading(t.page, 'Glucose');
  return flat(await main.innerText());
}

export const cases = [{
  name: 'one reading, then 3 days in both weeks, then a lab result',
  async run(t) {
    const page = await t.open({ seed: persona('P03'), route: '/home', time: IST('2026-09-28T09:00:00') });
    const main = page.getByRole('main');

    await t.step(1, 'Monday 28 September: one reading, and its point shows at once', async () => {
      await data.logGlucose(t, { value: 118 });
      const text = await glucoseWeek(t);
      await t.check(text.includes('1 reading with a number') && text.includes('118'), `the first reading isn’t shown as the week’s average: ${text.slice(0, 300)}`);
      await t.check(text.includes('Comparisons start once there are 3 days with data in both weeks.'), `no early-days line: ${text.slice(0, 300)}`);
      await ui.tap(ui.button(main, 'Show as list'));
      const rows = await main.getByRole('table', { name: 'Glucose, This week' }).getByRole('row').count();
      await t.check(rows === 2, `the list has ${rows - 1} readings, not 1`);
      await t.checkpoint('vj27-one-reading');
    }, { input: 'glucose 118 mg/dL at 9:00 am' });

    await t.step(2, 'Tuesday and Wednesday: 112, then 115', async () => {
      for (const [day, value] of [['2026-09-29', 112], ['2026-09-30', 115]]) {
        await t.setTime(IST(`${day}T09:00:00`));
        await data.logGlucose(t, { value });
      }
    }, { input: 'glucose 112 and 115 mg/dL, each at 9:00 am' });

    await t.step(3, 'The next Monday and Tuesday: 124, then 122. Two days this week: still no comparison', async () => {
      for (const [day, value] of [['2026-10-05', 124], ['2026-10-06', 122]]) {
        await t.setTime(IST(`${day}T09:00:00`));
        await data.logGlucose(t, { value });
      }
      const text = await glucoseWeek(t);
      await t.check(text.includes('Comparisons start once there are 3 days with data in both weeks.') && !/Higher than|Lower than/.test(text), `a comparison appeared before 3 days in both weeks: ${text.slice(0, 300)}`);
    }, { input: 'glucose 124 and 122 mg/dL, each at 9:00 am' });

    await t.step(4, 'Wednesday 7 October: 120, and the comparison appears, Monday to Wednesday against Monday to Wednesday', async () => {
      await t.setTime(IST('2026-10-07T09:00:00'));
      await data.logGlucose(t, { value: 120 });
      const text = await glucoseWeek(t);
      await t.check(text.includes('Higher than last week · +7 mg/dL') && text.includes('Mon–Wed vs last Mon–Wed'), `the comparison isn’t Mon–Wed against Mon–Wed: ${text.slice(0, 400)}`);
      await t.check(text.includes('3 readings, all with a number') && text.includes('122'), `this week’s average isn’t 122 from 3 readings: ${text.slice(0, 300)}`);
      await t.checkpoint('vj27-compared');
    }, { input: 'glucose 120 mg/dL at 9:00 am' });

    await t.step(5, 'An HbA1c of 7.1%: Labs shows it at once, as the first result', async () => {
      await data.logLab(t, 'HbA1c', 7.1);
      await g.tabTo(t, 'Trends');
      await ui.tap(main.getByRole('link', { name: /^Labs\b/ }));
      await ui.heading(page, 'Labs');
      const text = flat(await main.innerText());
      await t.check(text.includes('7.1%') && text.includes('First result'), `Labs doesn’t show the first result: ${text.slice(0, 300)}`);
      await t.check(await ui.radio(main.getByRole('radiogroup', { name: 'Which result' }), 'HbA1c').getAttribute('aria-checked') === 'true', 'Labs did not open on HbA1c');
      await t.checkpoint('vj27-labs');
    }, { input: 'HbA1c 7.1%' });
  },
}];
```

- [ ] **Step 7: Run the new journeys**

```bash
npm run e2e:acceptance -- --only=VJ07,VJ24,VJ26,VJ27 > /tmp/fit-checks/accept-v2-p3.log 2>&1; tail -n 20 /tmp/fit-checks/accept-v2-p3.log
```

Expected: 5 cases pass on each project. A failing check names what the screen said. Fix the app, never the expected words: each string here is pinned by a unit test in Tasks 2–12, so the two always agree.

- [ ] **Step 8: The whole suite**

```bash
npm run e2e:acceptance > /tmp/fit-checks/accept-v2-p3-all.log 2>&1; tail -n 20 /tmp/fit-checks/accept-v2-p3-all.log
```

Expected: J01–J20, S01 and every V journey pass, Plan 2's included.

- [ ] **Step 9: Commit**

```bash
git add scripts/e2e/acceptance/lib/data.mjs scripts/e2e/acceptance/run.mjs scripts/e2e/acceptance/journeys/v07.mjs scripts/e2e/acceptance/journeys/v24.mjs scripts/e2e/acceptance/journeys/v26.mjs scripts/e2e/acceptance/journeys/v27.mjs
git commit -m "test: Walk Trends' journeys: see my week, the brief, yesterday's low, partial steps, first days"
```

---

### Task 16: Review, reconcile and record

**Files:** whatever the findings touch; `docs/reimagine/BOARD.md`.

- [ ] **Step 1: Codex.** Plan 3's work starts at Task 1's commit, so its parent is the base:

```bash
BASE=$(git log --format=%H -1 --grep='Record the v2 Trends decisions on the board')^
mkdir -p /tmp/fit-checks
```

  Build a static bundle in `/tmp/fit-checks/v2p3-prompt.md`. It holds:
  - this plan;
  - journey §4.10, §12 in full, §17 (V-J07, V-J24, V-J26, V-J27), §20.2–20.4 and §25 (B-10, B-14, B-15, B-16, B-20, B-30, B-32), and motion M21;
  - `git diff "$BASE"..HEAD -- src scripts/e2e/acceptance`;
  - every new file in full.

  Ask for findings, each with a reproduction:
  - a statistic, weighting or coverage that disagrees with D68–D70;
  - a comparison that isn't like for like, or that shows with fewer than 3 days, or beside a meter LO;
  - a HI or LO averaged, or a reading left out for a status day;
  - a figure counted twice, or counted other than through the shared aggregation;
  - a chart state reachable only by touch, a selection or a period-before that relies on colour, or a contrast under 3:1;
  - Your week praising, blaming, or shown beside a safety decision or a non-Normal status; the brief shown out of its window;
  - copy that breaks §20.4.

  Then run:

```bash
codex exec -m openai.gpt-6.1-sol -c model_reasoning_effort='"max"' -c 'model_providers.amazon-bedrock.aws.region="us-east-1"' -s read-only -C "$PWD" -o /tmp/fit-checks/v2p3-codex.md - < /tmp/fit-checks/v2p3-prompt.md
```

- [ ] **Step 2: Kiro.** Run it on the same diff, read-only:

```bash
kiro-cli chat --no-interactive --trust-tools=fs_read --model claude-opus-5.5 "Review FitStrong v2 Plan 3 (Trends). Read docs/superpowers/plans/2026-10-10-fitstrong-v2-plan-3-trends.md, then the diff with: git diff $BASE..HEAD -- src scripts/e2e/acceptance. Report every way a trend can state a wrong or unnamed statistic, compare unlike days, average a meter HI or LO, count a figure twice, hide a reading on a status day, be read only by touch or colour, or judge the person in Your week, each with the file, line and a reproduction."
```

- [ ] **Step 3: Reconcile.** For each finding:
  - reproduce it with a failing test (unit, or an acceptance case);
  - fix it;
  - log it on the board with its reviewer's id (V3-…, KV3-…).

  A finding that's wrong gets a one-line reason on the board, rather than silence.

- [ ] **Step 4: Record the result.** Append an entry to `docs/reimagine/BOARD.md`, headed `### <today's date> — [claude] v2 Plan 3 (Trends): built and reviewed` with the date written out (`2026-10-14`, say), and four bullets, each stating what the runs printed, not what was hoped:
  - **Built:** the Trends tab (Your week, the last 8 weeks, every category with data, recent activity), each category's trend at `/trends/:id` with one shared chart, Labs as dated results, and "Your week in brief" on Home; D68–D74 as recorded, or which one changed and why;
  - **Tests:** the totals `npx vitest run` printed, and that `npx tsc -b` and `npm run lint` passed;
  - **Acceptance:** each of VJ07 (both cases), VJ24, VJ26 and VJ27 per project, and the full suite's summary line from `/tmp/fit-checks/accept-v2-p3-final.log`;
  - **Review:** each Codex (V3-…) and Kiro (KV3-…) finding by id, with "fixed in <commit>" or its one-line reason for rejection.

- [ ] **Step 5: Gates, the full suite, commit**

```bash
npx tsc -b && npm run lint && npx vitest run
npm run e2e:acceptance > /tmp/fit-checks/accept-v2-p3-final.log 2>&1; tail -n 20 /tmp/fit-checks/accept-v2-p3-final.log
git add -A src scripts/e2e/acceptance docs/reimagine/BOARD.md
git commit -m "fix: Close the Plan 3 review findings, and record the result"
```

---

## Acceptance cases added

| Case | Persona | Steps | Pins |
| --- | --- | --- | --- |
| VJ07 (two cases) | P02, a fortnight of steps entered at 8 pm | Trends → Your week → the Steps row → Week → the arrow keys → Show as list → Back. Then Monday 04:05: Home's "Your week in brief" → Trends at last week → Home | "6,167 steps a day on average this week, from 3 days with steps."; Week first (B-10); "Higher than last week · +417 steps a day", "Mon–Thu vs last Mon–Thu"; Tuesday read by key; the brief offered from 04:00, opened once, kept as seen (B-20) |
| VJ24 | P03 | Today's log → Add → Glucose 62 at 7 October 9:30 pm → "No, it was earlier" → Home → Trends → Glucose → Show as list | "That was a low."; the measured time kept; the row "Wednesday, 7 October · 62 mg/dL at 9:30 pm · Low"; "Below 70 mg/dL 1"; the same urgent state on Home, Trends and the trend (B-30, §4.10) |
| VJ26 | P02 | 6,050 at 12:05 pm → a walk at 3:00 pm with 1,250 steps → Trends → Steps → End → Home → 9,800 at 9:00 pm → Trends → Steps → End | "at least 7,300 steps, 6,050 entered at 12:05 pm + 1,250 in walks after 12:05 pm", on Trends and Home; then "9,800 steps, entered at 9:00 pm", never 11,050; both statements kept (§9.6, D10) |
| VJ27 | P03, from Monday 28 September | One glucose each morning: 118, 112, 115, then 124, 122, 120 the next week → Trends → Glucose each time; then HbA1c 7.1 → Labs | One point at once; "Comparisons start once there are 3 days with data in both weeks." until the third day; then "Higher than last week · +7 mg/dL", "Mon–Wed vs last Mon–Wed"; Labs "7.1%", "First result" (§12.2, A-45) |

---
## Self-review against the spec

**Spec coverage.** Each requirement in scope, and the task that builds it:

- **J§12.1, the Trends tab:**
  - Your week, Monday to Sunday, 2–4 factual sentences, nothing framed as praise or blame, clinical highlights as counts with context ("5 glucose readings this week; 1 was below 70"): Task 12 (`weekFacts`, `weekSentences`, with a test that no judging word appears), Task 13 (`YourWeekCard`);
  - this week's ring and the last 8 weeks as small rings, tap one for that week: Task 12 (`weekRings`, `ringLabel`), Task 13 (`WeeklyRings`, v1's `Ring` drawn set);
  - every category with data, in the registry's order, on Home or not, each with its icon, title, figure with the statistic named, and a small chart: Task 5 (`TREND_ORDER`, `hasData`), Task 8 (`trendRow`), Task 13 (`TrendLink`, `Sparkline`);
  - recent workouts, stretches and walks: Task 4 (`activities`, through Plan 2's `movementHistory`), Task 13. Map thumbnails are Plan 6's; the row leaves room.
- **J§12.2, a category's trend:**
  - Week · Month · 6 Months · Year, with the table's dates, bars and statistics, and paging: Task 2 (`windowOf`, the pager words), Task 3 (`statisticFor`, `figureOf`), Tasks 7–8 (`dailyView`, `readingsView`), Task 10 (`PeriodControl`), Task 11;
  - like-for-like comparisons for an unfinished period, 3 days with data in both, the statistic and unit named: Task 2 (`compareRanges`, `comparedText`), Task 3 (`compareDaily`, `compareReadings`, `MIN_DAYS`), Tasks 7–8 (`changeOf`); D70;
  - neutral deltas in body ink with an arrow: Task 7 (`changeOf`), Task 10 (`TrendHeadlines`);
  - the previous period behind in grey and as a pattern, the current in the category colour, a labelled average, a value on tap or arrow key, "Show as list", a text summary, the selected state's contrast measured: Task 6 (`ChartModel`, `stepValue`, `slotAt`), Task 7 (the series, slot words, list and summary), Task 9 (`--trend-previous` measured at 3:1, body ink at 3:1), Task 10 (`TrendChart`, with its source test); D71;
  - rest and status days hatched and labelled in movement charts, never a zero; clinical readings never left out for a status day, and named: Task 3 (`dailyStats`, `readingStats`), Task 6 (`MARK_WORDS` in the legend), Task 7 (`dayCell`, the notes), Task 8 (`Includes …`), Task 10 (`Marks`);
  - readings' spread: n, range, lows and highs; context as separate series; HI and LO out of the average, said above it in caution ink, and a LO hiding the change: Task 3, Task 5 (`readingsFor`), Task 8, Task 10 (`TrendHeadlines`' meter line);
  - labs as dated points with their interval, from the first, with no 7-day rule: Task 3 (`labHistory`), Task 5 (`labPoints`), Task 8 (`labsView`), Task 11 (`LabsTrend`);
  - early days: a chart from the first record, and "Comparisons start once there are 3 days with data in both weeks": Task 3 (`recordDays`), Task 7 (`fewDaysText`), VJ27.
- **J§12.3, what counts:** recorded movement through `recordedMovement` for Your week and the rings (Task 12); each category's own minutes from its sessions and walks, walks through `aggregate.series` (Task 4); stretch days counting a session's mobility block, on Trends and Home alike (Task 4, D72); steps as J§9.6 says them, through Plan 2's `stepsDayFigure` (Task 4); readings by measured time, with their context (Task 5).
- **J§12.5, goals have dates:** each ring against the goal its week had, and a change waiting for Monday said beside them, through Plan 2's `weeklyGoalOn` and `pendingWeeklyGoal` (Task 12).
- **J§12.6, Your week in brief:** a `weekBrief` prompt, last in `pickPrompt` after the water row, from Monday 04:00 until it's opened, never in a non-Normal status or beside a hold; no testing-frequency, weight or food sentence: Task 12 (`weekBriefFor`, `briefPause`), Task 14, VJ07's second case; D73.
- **J§4.2 and B-02:** Trends has no Start and computes no permission; the safety surface is the shell's, and pauses Your week's words (Tasks 11, 13, 14). VJ24 checks the same urgent state on Home, Trends and a trend.
- **J§4.10:** every reading's text carries its time and context (Task 5), and VJ24 checks yesterday's reading keeps its measured time.
- **J§20.2–20.4:** TrendChart's and StatGrid's contracts (Tasks 9–10); 3:1 graphics and 4.5:1 text measured in both themes (Task 9); targets of `min-h-12`, worded pager buttons, every gesture with keys and a list, text that wraps at 200% and 320 px, and each choice set a single radio group (Tasks 10, 11, 13); S01's sweep runs on the Trends tab and three trends (Tasks 11, 13).
- **J§25:** B-10, Week first (Task 11, VJ07); B-14, the registry's trends, Labs' `?metric=`, logging a workout apart from its trend (Tasks 5, 11); B-15 (Tasks 3, 6–10); B-16 (Task 12); B-20 (Tasks 12, 14); B-30's historical case (VJ24); B-32, rings drawn set (Tasks 12–13).
- **M21:** history drawn at once, nothing counting up; the segment indicator slides (`spring-quick`), the plot fades over (`fade`), the callout appears with `spring-quick`, and none of it under Reduce motion (Task 10). B-15 overrides "soften to 60%" (D71).
- **D21:** the Back & leg trend shows `BackLegChart` for a month or more (Task 11).
- **Plan 7's extension point:** Food's trend is a `BarSeries` added to the same `ChartModel` (Task 6); its address goes to the Food hub until then (Task 11, D74).

What this plan deliberately doesn't do, and why:
- bars don't morph between periods, the plot fades over: ponytail, noted in Task 10 with its upgrade path;
- the period control stays in four columns at every size: ponytail, noted in Task 10;
- the spec allows a reviewed "toward your goal" phrase for movement minutes; the rings' "64 of 150 min" is the only goal wording here, because Your week never praises and a trend's change is neutral;
- route thumbnails (Plan 6) and Food's trend (Plan 7) are out of scope.

**Placeholder scan.** Every code step holds the code. The only words left to fill at run time are Task 16's figures, which come from the runs, and Task 11's seeding command, which pastes the blob the command before it prints.

**Type consistency.** These names are defined once and used with the same signatures throughout:
- `windowOf`, `previousWindow`, `nextWindow`, `compareRanges`, `comparedText`, `windowTitle`, `previousName`, `pagerLabels` (Task 2);
- `dailyStats`, `figureOf`, `statisticFor`, `compareDaily`, `readingStats`, `compareReadings`, `labHistory`, `statusList`, `dayContext`, `DayFigure.basis` (Task 3);
- `stepsDays`, `stretchedDays`, `meterReadings`, `activities`, `firstRecordDay` (Task 4);
- `TRENDS`, `trendDef`, `readingsFor`, `figuresFor`, `labPoints`, `hasData`, `GLUCOSE_LINES` (Task 5);
- `ChartModel`, `stepValue`, `slotAt`, `selectable`, `domainOf`, `legendOf`, `MARK_WORDS` (Task 6);
- `dailyView`, `readingsView`, `labsView`, `trendRow`, and `trendContext({ today, data, settings, profile })` at all four of its call sites (Tasks 7, 8, 11, 13, 14);
- `weekFacts`, `weekSentences`, `briefPause`, `weekRings`, `weekBriefFor`, `WEEK_BRIEF_KEY` (Task 12);
- `Prompt`'s `weekBrief` (Task 14).

Plan 2's names are used as Plan 2 defines them: `weeklyGoalOn`, `pendingWeeklyGoal`, `WeeklyGoalSettings`, `stepsDayFigure`, `movementHistory`, `HistoryRow`, `labFrom`. "Before you start" says what to do if review renamed one.

**Review Focus.** Each line has its test in the task that owns the code:
1. glucose in two units: Task 5, "readings in the person’s own unit (Review Focus 1)", and Task 8's mmol/L case;
2. a day total entered twice: Task 4, the water total and the steps total that replace earlier statements (Review Focus 2);
3. a week with only a meter's LO: Task 3's `readingStats` case and Task 8's "a week with only a meter’s LO" (Review Focus 3);
4. a record that starts mid-week: Task 3's "days before the first record are not zeros", Task 7's steps case, and Task 12's Thursday case (Review Focus 4);
5. month ends and the year end: Task 2's 30 March, leap February, and the 6 Months and Year windows across 1 January (Review Focus 5).

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-10-fitstrong-v2-plan-3-trends.md`. Please review the plan. Which execution approach would you prefer?

- **Subagent-driven:** a fresh subagent implements each task, and a fresh reviewer checks it before the next one starts, then a whole-branch review at the end. Most thorough; costs a fresh context per task and per review.
- **Native:** one session implements every task, the way this harness runs work, then one fresh reviewer on the most capable model checks the whole branch. Cheapest and fastest; no independent review until the end.

For this plan I recommend **subagent-driven**, because its 16 tasks hand exact interfaces from one pure module to the next (periods → stats → records → metrics → chart → model → yourWeek), and a mistake in a shared statistic would show on every trend and in Your week.
