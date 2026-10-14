# FitStrong v2 Plan 2: Hubs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every registry category except Food a real hub:
- one frame for all of them, with the opener's Back, the category's colour and the shared safety surface;
- movement hubs (Workout, Stretch, Walk) that read the shared gate exactly as Home does;
- reading hubs (Glucose, Blood pressure, Steps, Back & leg, Weight, Water, Sleep, Waist, Labs) with Latest, Add reading, This week, History with corrections, and See trends;
- the Learn hub.

A weekly goal change applies from the next Monday.

**Architecture:**
- **One hub frame** (`src/screens/hub/HubFrame.tsx`) over v1's `Screen`:
  - Back comes from the navigation stack: the opener, or Home with nothing to pop to.
  - A solid category wash sits behind the bar. It is the far end of the tile's morph (M3).
  - The shell's safety surface comes first, as on every screen.
- **Movement hubs read the gate the way Home's Right now card does** (`gateOf`) and use the tile's own words for it (`movementLine`).
  - A pure `movementCard()` turns that into the card's words and actions (journey §7.5, "In its hub").
  - A pure `actionTarget()` sends every action that could start movement through `useStartMovement().start`. A hub decides nothing (§4.2).
- **Reading hubs share one pure model** (`src/screens/hub/reading.ts`) built on v1's tested parts:
  - `metricRows` for history with corrections;
  - `metricNotes` and the interpreters for what a value means;
  - `QuickLog` opened straight onto the metric's form;
  - the cadence model's new `nextCheck()`.
- **v1's screens are kept where they already do the job**, and move into the hubs with `git mv` where a hub replaces them:
  - Your plan;
  - the exercise library;
  - the Workout Log (now at `/hub/workout/log`);
  - the Stretch builder;
  - the walk setup's options;
  - Back & leg's D21 chart;
  - Guide's topics.
- **Rules live in pure modules** with unit tests. Cards are driven through `@/test/host` in caller tests. Screens are proven by the acceptance suite and headless Chromium.

**Tech stack:**
- React 19 and TypeScript (strict, `erasableSyntaxOnly`);
- Vite 8 and Tailwind v4;
- the React Router 7.13 hash data router;
- the IndexedDB store;
- Vitest in the node environment, plus the `@/test/host` node renderer;
- the Playwright-core acceptance suite (`npm run e2e:acceptance`).

**Spec:**
- `docs/superpowers/specs/2026-10-08-fitstrong-v2-journey-design.md` (cited as J§). In particular:
  - §4, the safety contracts;
  - §5.1, the registry;
  - §7.5, the tile copy;
  - §8, the hubs;
  - §9.6, Steps;
  - §16, Goals;
  - §17, the journeys V-J01, 04, 05, 06, 09, 12, 14 and 15;
  - §19 and §20;
  - §25's amendments, which override earlier text. Those that bind here are B-02, B-03, B-04, B-08, B-09, B-10, B-14, B-16, B-20 and B-30.
- `docs/superpowers/specs/2026-10-08-fitstrong-v2-motion-design.md` (cited as M-numbers; M3, M4, M8, M12, M16, M24).
- The roadmap: `docs/superpowers/plans/2026-10-08-fitstrong-v2-roadmap.md`.
- The style model: `docs/superpowers/plans/2026-10-08-fitstrong-v2-plan-1-shell-home.md`.

Read the spec sections above before starting.

**Scope:**
- **In:**
  - the hub frame and the hub states (§8.1, §8.4);
  - the Workout hub:
    - enrolled and not enrolled ("Join the 12-week programme", "Stretch instead");
    - Your plan, Find an exercise, Log a workout (`/hub/workout/log`, B-14) and Weekly goal;
  - the Stretch hub (v1's approved routines through its builder, D36);
  - the Walk hub's setup:
    - Start walk;
    - B-09's after-meal button;
    - the options After a meal, Walk with a target, and How walks are measured;
  - the reading hubs:
    - Steps: Add today's steps with Paste, and the daily step goal;
    - Weight, with BMI derived;
    - Labs, with `?metric=`;
  - "Add reading" opening the metric's own form;
  - history with corrections;
  - "See trends" (to `/trends/:id`, interim until Plan 3);
  - the Learn hub;
  - weekly goal changes from the next Monday (B-16);
  - the A-34 saved stretch → flare → resume case (B-30).
- **Out:**
  - the Trends tab and charts (Plan 3). `/trends/:id` stays v1's interim, which this plan only stops dead-ending;
  - Browse and Me (Plan 4);
  - setup (Plan 5);
  - the live walk, consents, map, routes and energy (Plan 6);
  - the Food hub's content and logging (Plan 7). The interim `/hub/food…` routes stay;
  - Recently deleted and restore (Plan 8).

**Done when** (roadmap):
- every registry category opens a real hub. Food stays interim until Plan 7;
- V-J01, V-J04, V-J05, V-J06, V-J09, V-J12, V-J14 and V-J15 pass, plus B-30's resume case;
- J01–J20 and S01 pass, with changes only to how they navigate and to the names of the screens and controls Plan 2 renames;
- Codex and Kiro have reviewed the plan's diff.

## Global Constraints

- **Branch:** work on `feat/v2-journey`, after Plan 1's review is reconciled (Task 1 checks). Never push to `main`. Make one commit per task, with a conventional message.
- **Local-only:** no new network requests, no new dependency, and no API keys.
- **Safety: the engine alone decides** (J§4.1, §4.2).
  - Every Start, Check in & start, Carry on, Start anyway, rest-day mobility, Just a walk, B-09's button and Review today's check-in calls `useStartMovement().start(mode, href, label)`. Nothing navigates to `/session` or `/walk/live` itself.
  - A hub reads its mode with `gateOf(permissionFor(mode), guided.checkIn, profileGap)`, the same reading as Home's card, and words it with `movementLine(...)`.
  - A hub never computes permission, freshness or status rules.
- **Urgent first (motion rule 2):**
  - The shell's safety surface is first in every hub, through `Screen`'s `ScreenTopContext`.
  - A hub on a hold or a stop names nothing for a view transition.
  - A held tile already skips its transition (`skipNextTransition`).
- **Status never blocks on its own (L-04):**
  - Away or Unwell reads "Paused while you’re away" or "Paused while you’re unwell".
  - "Change status" is the primary action, with a quiet "Start anyway" that goes through the gate.
  - During a flare only a stretch can be carried on (A-34).
- **One primary action per region,** worded as a verb. At most 5 main choices per region (J§20.4 rules 4 and 13, B-08).
- **Targets and text:**
  - every tappable thing is at least 44×44 px;
  - primary buttons are at least 60 px tall (`min-h-[60px]`);
  - body text uses `--text-body` (17 px);
  - text up to 200% must work.
- **Day strips:** seven columns at 375 CSS px and wider with text at 130% or less. Otherwise seven rows (K-42), the same rule as Home's tile columns (`tileColumns`).
- **Reduced motion** is the system setting or `settings.display.reduceMotion`. Under it the M3 morph and the skeleton shimmer don't run.
- **Glass** stays on the navigation layer only. The hub's category wash is a solid colour layer, never a blur.
- **Measured values** show their measured date and time, unit and context (J§4.10). Clinical values never animate (M16).
- **Copy:** Indian English, sentence case, and verbs on buttons. The exact strings are given in each task.
- **Acceptance edits are navigation and naming only (A-76).** A journey's clinical assertions never change. Where a hub moves or renames a control (Move → Workout, Guide → Learn, "Start stretch" → the card's start), only the way the journey reaches it changes.
- **Tests:**
  - pure rules in `src/**/*.test.ts` (Vitest, node);
  - components through `@/test/host` (caller tests) or `react-dom/server` markup;
  - screens by the acceptance suite.
- **Gates before every commit:** `npx tsc -b`, `npm run lint` and `npx vitest run` must all pass.
- **The acceptance suite between Task 6 and Task 15:** expect it to fail, because the hubs replace v1's Move rows that its helpers use. Task 15 restores it. Don't run the full suite in between, except targeted cases you have already migrated.

## Review Focus

These are failure modes the spec implies but no task's ordinary tests would exercise. Each has its test in the task that owns the code.

1. **A quiet button that starts movement round the gate.** "Start anyway" (Unwell), "Stretch instead", "Review today’s check-in", "Continue stretch", rest-day mobility, "Just a walk" and B-09's button must each reach movement only through `start(...)`. No refused state may offer a start-kind action. Task 4 has the tests: `movementCard` never offers `start` while the gate refuses, `actionTarget` sends every movement action through `gate`, and a caller test of the card's "Start anyway".
2. **A weekly goal changed mid-week.** This week's ring must keep the goal it started with, and the change starts on Monday. A removal, two changes in one week, and choosing this week's goal again must all behave. Task 2 has the tests.
3. **Steps entered for a past day, then a walk on that day.** A past day's total is stamped at noon. It must never become "at least" by adding walks after noon: the total was typed after the day and already includes them. Only a total with a real entry time, followed by a FitStrong walk, reads "at least" (§9.6, D10). A total corrected later counts walks only from the correction, so no walk is counted twice. Task 12 has the tests.
4. **Pasted step counts in real formats:**
   - pasted text that reads as one number: "6,050", "6,050 steps", "Steps: 6 050", "1,00,000" (Indian grouping), "\n 4210 \n", and thousands grouped with a no-break space (U+00A0) or a narrow one (U+202F);
   - text that doesn't: "", "abc", "6.5k", "6.050", "6,050 steps, 4.2 km", "6050 4000", "06:30" and a pasted date with the count.

   Each must give the integer or nothing, never a guess. Task 12 has the tests.
5. **The after-meal suggestion at the edges of the day (B-09):**
   - a dinner usually finished at 22:30, opened at 00:20, is "I had dinner at 10:30 pm", last night's;
   - a lunch whose usual time is still to come, or more than two hours ago, is "now".

   It's never a time in the future. Task 8 has the tests.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/screens/track/weeklyGoal.ts` (new), `weeklyGoal.test.ts` (new) | The weekly goal by the week (B-16) |
| `src/screens/track/goalSheet.callers.test.ts` (new) | The weekly goal sheet over the real store |
| `src/screens/hub/frame.ts` (new), `frame.test.ts` (new) | Hub frame rules: Back, the morph name, the loading title, trend links, the strip layout, the wash strength |
| `src/screens/hub/HubFrame.tsx` (new) | `HubFrame`, `HubSection`, `SeeTrends` |
| `src/screens/hub/HubSkeleton.tsx` (new) | A hub still loading (§8.4, M24) |
| `src/screens/hub/hooks.ts` (new) | `useHubGate(mode)`, `useHubOrigin(label)` |
| `src/screens/hub/movement.ts` (new), `movement.test.ts` (new) | `movementCard`, `actionTarget`, `runAction`, `resumeAllowed`, `restDayOf`, `sessionParts`, `stretchReason` |
| `src/screens/hub/MovementCard.tsx` (new), `MovementCard.callers.test.ts` (new) | The Right now card |
| `src/screens/hub/week.ts` (new), `week.test.ts` (new) | `modeWeek`, `goalLine`, `movementHistory` |
| `src/screens/hub/WeekStrip.tsx`, `HistoryList.tsx` (new) | This week and History |
| `src/screens/hub/WorkoutHub.tsx` (new) | The Workout hub |
| `src/screens/hub/StretchHub.tsx` (moved from `src/screens/move/StretchScreen.tsx`) | The Stretch hub |
| `src/screens/hub/WalkHub.tsx` (moved from `src/screens/walk/WalkSetup.tsx`) | The Walk hub |
| `src/screens/hub/reading.ts` (new), `reading.test.ts` (new) | The reading hub model |
| `src/screens/hub/ReadingHub.tsx` (new) | Glucose, Blood pressure, Weight, Water, Sleep, Waist, Labs |
| `src/screens/hub/StepsHub.tsx` (new) | Steps |
| `src/screens/hub/BackHub.tsx` (moved from `src/screens/track/BackLeg.tsx`) | Back & leg |
| `src/screens/track/stepsDay.ts` (new), `stepsDay.test.ts` (new) | The day's steps figure (§9.6) and pasted text |
| `src/health/cadence.ts`, `cadence.test.ts` (modify) | `nextCheck()`; due items open their hub's form |
| `src/walk/plan.ts`, `plan.test.ts` (modify) | `afterMealSuggestion()` (B-09) |
| `src/components/hig/Screen.tsx` (modify) | An optional `wash` layer |
| `src/screens/home/Tile.tsx` (modify), `src/design/motion.ts` (modify), `src/main.tsx` (modify), `src/index.css` (modify) | The M3 morph's page fade, the spring token, the skeleton |
| `src/design/tokens.node.test.ts` (modify) | Text on the wash; the spring token |
| `src/screens/home/HomeScreen.tsx`, `src/screens/track/MyDay.tsx`, `src/screens/track/GoalSheet.tsx` (modify) | Read the goal by the week |
| `src/screens/home/week.ts`, `week.test.ts` (modify) | Home's steps line through `stepsDayFigure` |
| `src/screens/track/QuickLog.tsx` (modify) | Paste for steps; Workout row to `/hub/workout/log` |
| `src/screens/track/MetricDetail.tsx` (modify) | The interim `/trends/:id` never dead-ends for a category with a trend |
| `src/types/index.ts`, `src/store/importCheck.ts` (modify) | `weeklyMovementGoalHistory` |
| `src/routes.tsx`, `src/redirects.ts`, `src/redirects.test.ts` (modify) | Hub routes, the skeleton, `/hub/workout/log`, `/track/workout` → the log |
| `src/screens/move/routes.tsx`, `PlanScreen.tsx`, `ExercisesScreen.tsx`, `ExerciseScreen.tsx` (modify) | The Workout hub's routes; `?join=1`; v2 links and Back |
| `src/screens/workout/TodayWorkoutScreen.tsx`, `RecordScreen.tsx` (modify) | The log's Back and links |
| `src/screens/walk/routes.tsx` (modify) | The Walk hub at the index |
| `src/screens/guide/*.tsx`, `src/content/search.ts`, `src/content/schema.ts` (modify) | The Learn hub and its v2 links |
| `src/screens/today/model.ts`, `model.test.ts` (modify) | The chooser's Learn row at `/hub/learn` |
| `src/content/audit.test.ts`, `src/content/personalise.test.ts`, `src/components/hig/shell.node.test.ts` (modify) | Routes named by `ROUTES`; the Learn card's opener |
| `scripts/e2e/acceptance/lib/hub.mjs` (new) | The movement hubs as the acceptance suite reaches and reads them |
| `scripts/e2e/acceptance/lib/*.mjs`, `journeys/*.mjs`, `run.mjs` (modify) | Navigation through the hubs |
| `scripts/e2e/acceptance/journeys/v01.mjs`, `v04.mjs`, `v05.mjs`, `v06.mjs`, `v09.mjs`, `v12.mjs`, `v14.mjs`, `v15.mjs` (new) | The Plan 2 journeys |
| `docs/reimagine/BOARD.md` (modify) | Decisions and the result |

---

### Task 1: Baseline and board decisions

**Files:**
- Modify: `docs/reimagine/BOARD.md` (append)

**Interfaces:** none.

- [ ] **Step 1: Check the baseline.** Plan 1's review (its Task 12) must be committed, with its board entry.

```bash
git checkout feat/v2-journey
git status --short            # clean, except untracked docs
git log --oneline -n 15       # Plan 1's review fixes are in
npx tsc -b && npm run lint && npx vitest run
```

Then confirm the names this plan builds on still exist. Each `grep` must print a line:

```bash
grep -n "export function movementLine" src/screens/home/tileLine.ts
grep -n "export function workoutNormal" src/screens/home/tileLine.ts
grep -n "export function normalLine\|export const FROM_HOME\|export function tileColumns" src/screens/home/model.ts
grep -n "export function gateOf\|export function recommend\|export function nextBoundary\|export function resumeHref\|export function savedRun\|export function isEnrolled\|export function mealWalkNow\|export function isProgrammeSession\|export function activitiesFrom\|export const HREF" src/health/recommend.ts
grep -n "export function recommendSources\|export function withEffectiveToday\|export const UrgentContext" src/screens/home/urgent.ts
grep -n "export function useStartMovement" src/components/checkin/useStartMovement.tsx
grep -n "export function defaultStartLabel\|export function headline" src/components/checkin/copy.ts
grep -n "export function startLabelFor" src/screens/today/model.ts
grep -n "trend?: string" src/categories.ts
grep -n "navTitle" src/components/hig/Screen.tsx
```

If a name has moved, use it where it now lives, and keep this plan's behaviour. If `movementLine`'s parameters have changed, pass what it now asks for. The hubs must call it exactly as `HomeScreen`'s `lineOf` does.

- [ ] **Step 2: Append the decisions to the board.** Add the text below, exactly, at the end of `docs/reimagine/BOARD.md`. D47–D55 are the numbers set aside for Plan 2. The later plans number theirs from D56, so keep these as they are.

```markdown
### 2026-10-10 — [claude] v2 Plan 2 (hubs): decisions recorded before building

| # | Decision | Reason |
| --- | --- | --- |
| D47 | A hub reads its mode's gate with `gateOf`, as Home's Right now card does, and words it with the tile's `movementLine`. A pure `movementCard` maps that to the card; a pure `actionTarget` sends every action that could start movement through `useStartMovement().start` | J§4.2, K-04, A-08: a hub can never offer what its tile or Home would refuse |
| D48 | A weekly goal change, or its removal, applies from the next Monday; the week under way keeps its goal. A first goal, in a week that had none, applies at once. v1's undated goal keeps no date (`from: ''`) and holds for every week before the first dated change | B-16, J§12.5; J07 sets a first goal and reads it the same week |
| D49 | In a hub, a hold that only today's check-in answers reads "Check in & start" (J§7.5). A hold, a re-check or a stop is titled with the gate's own headline (`headline(p)`: "No walk for now", "Check again before you start"), as Home's card and the check-in say it; the tile keeps its shorter line, and the card adds a re-check's time from it. A profile gap uses Home's titles ("Your diabetes medicines"). Every refusal offers today's check-in beside the gate's words, so a mistaken answer can be put right (S-15): v1's "Review today’s check-in", or "Enter a new reading" while a treated low waits for its re-check | J§7.5 hub column; J§8.4, the gate's card the same as Home's; v1's setup contract |
| D50 | B-09's button names the meal's usual finish time today (or last night's, for a dinner after midnight), or now when that is still to come or more than two hours ago. Once tapped, that time is the walk's meal time in v1's existing field (`mealStartedAt`, which v1's summary calls "started"). Plan 6, which owns the walk summary and records, decides whether to keep a finish time apart | B-09; no new walk record shape in Plan 2 |
| D51 | Logging a manual workout lives at `/hub/workout/log`; v1's `/track/workout` (its logging screen) redirects there with its query. `/trends/workout` belongs to Trends, and goes to `/trends` until Plan 3 builds it | B-14 |
| D52 | Steps: a day with an entered total reads "at least" only when that total has a real entry time and a FitStrong walk started after it. A past day's total, stamped at noon, never adds walks. A corrected total counts walks only from its correction (`editedAt`, as `compareStatements` orders statements) | J§9.6, D10, D14 |
| D53 | Back & leg: "Add reading" records pain scores, through v1's form. How far the symptoms reach, and the red flags, are asked by today's check-in, where the engine reads them ("Update today’s check-in" on the hub). Plan 2 adds no clinical question to any form | V-J09; the check-in is unchanged in what it asks (J§10) |
| D54 | "How to copy your steps" (the Shortcut help) is not shipped until it has been checked on an iPhone | J§9.6 |
| D55 | The Learn hub is v1's Guide under its v2 name, with v2 addresses in its links and in the Guide content's actions. Due items and Guide cards that add a reading open that metric's hub with its form (`/hub/bp?add=bloodPressure`). A reading saved in a hub says v1's "Saved on this device: Glucose 112 mg/dL.", as Today's log does, and its History row shows v1's brief highlight (M16) | J§8.2, J§19.2; one confirmation wording across the app (M16, B-24) |

Left for later, on purpose:
- M3's Back is a plain fade only when the tile is still on screen; checking that needs layout after scroll restoration, so it moves to Plan 8's device pass.
- The Shortcut help (D54) waits for a device.
- Food's interim screens (Meal ideas, a meal, Sample week) keep v1's Back to "Guide" until Plan 7 rebuilds them; the address still lands on Learn.
```

- [ ] **Step 3: Commit**

```bash
git add docs/reimagine/BOARD.md
git commit -m "docs: Record the v2 hubs decisions on the board"
```

---

### Task 2: The weekly goal by the week (B-16)

**Files:**
- Create: `src/screens/track/weeklyGoal.ts`
- Create: `src/screens/track/weeklyGoal.test.ts`
- Create: `src/screens/track/goalSheet.callers.test.ts`
- Modify: `src/types/index.ts` (`UserSettings.weeklyMovementGoalHistory`)
- Modify: `src/store/importCheck.ts` (validate it)
- Modify: `src/screens/track/GoalSheet.tsx` (`GoalForm` writes through `withWeeklyGoal`; the hint)
- Modify: `src/screens/home/HomeScreen.tsx` (the week's goal)
- Modify: `src/screens/track/MyDay.tsx` (the week's goal, at both reads)

**Interfaces:**
- Produces:
  - `type WeeklyGoalSettings = Pick<UserSettings, 'weeklyMovementGoalMinutes' | 'weeklyMovementGoalHistory'>`;
  - `weeklyGoalOn(settings: WeeklyGoalSettings | undefined, day: string): number | undefined`, the goal for the week holding `day`;
  - `pendingWeeklyGoal(settings: WeeklyGoalSettings | undefined, day: string): { from: string; goal?: number } | undefined`;
  - `weeklyGoalChanges(settings: WeeklyGoalSettings | undefined): { from: string; goal?: number }[]`, the valid stored changes, oldest first (Plan 4's Goals lists them);
  - `withWeeklyGoal(settings: WeeklyGoalSettings | undefined, goal: number | undefined, day: string): WeeklyGoalSettings`;
  - `UserSettings.weeklyMovementGoalHistory?: { from: string; goal?: number }[]`.
- Consumes: `mondayOf` and `addDays` from `@/screens/track/periods`, and `isDay` from `@/health/observation`.
- `settings.weeklyMovementGoalMinutes` stays the goal last chosen, which may be waiting for Monday. J07 reads it. Every screen that draws a week reads `weeklyGoalOn(settings, day)`.

- [ ] **Step 1: Write the failing test** `src/screens/track/weeklyGoal.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { pendingWeeklyGoal, weeklyGoalChanges, weeklyGoalOn, withWeeklyGoal, type WeeklyGoalSettings } from './weeklyGoal';

// Thursday 8 October 2026: its week runs from Monday 5 to Sunday 11 October.
const MON = '2026-10-05';
const THU = '2026-10-08';
const SUN = '2026-10-11';
const NEXT_MON = '2026-10-12';

describe('the weekly goal by the week (B-16, journey §12.5)', () => {
  it('a first goal applies from this week; earlier weeks keep having none', () => {
    const s = withWeeklyGoal({}, 150, THU);
    expect(s.weeklyMovementGoalMinutes).toBe(150);
    expect(s.weeklyMovementGoalHistory).toEqual([{ from: MON, goal: 150 }]);
    expect(weeklyGoalOn(s, MON)).toBe(150);
    expect(weeklyGoalOn(s, THU)).toBe(150);
    expect(weeklyGoalOn(s, '2026-10-04')).toBeUndefined();
  });

  it('a change mid-week waits for Monday, and this week keeps its goal (Review Focus 2)', () => {
    const s = withWeeklyGoal(withWeeklyGoal({}, 150, '2026-10-06'), 200, THU);
    expect(weeklyGoalOn(s, THU)).toBe(150);
    expect(weeklyGoalOn(s, SUN)).toBe(150);
    expect(weeklyGoalOn(s, NEXT_MON)).toBe(200);
    expect(pendingWeeklyGoal(s, THU)).toEqual({ from: NEXT_MON, goal: 200 });
    expect(s.weeklyMovementGoalMinutes).toBe(200);
  });

  it('removing a goal mid-week also waits for Monday', () => {
    const s = withWeeklyGoal(withWeeklyGoal({}, 150, MON), undefined, THU);
    expect(weeklyGoalOn(s, THU)).toBe(150);
    expect(weeklyGoalOn(s, NEXT_MON)).toBeUndefined();
    expect(pendingWeeklyGoal(s, THU)).toEqual({ from: NEXT_MON });
    expect(s.weeklyMovementGoalMinutes).toBeUndefined();
  });

  it('a second change before Monday replaces the first; choosing this week’s goal again cancels it', () => {
    const twice = withWeeklyGoal(withWeeklyGoal(withWeeklyGoal({}, 150, MON), 200, THU), 250, '2026-10-09');
    expect(twice.weeklyMovementGoalHistory).toEqual([{ from: MON, goal: 150 }, { from: NEXT_MON, goal: 250 }]);
    const back = withWeeklyGoal(twice, 150, '2026-10-10');
    expect(back.weeklyMovementGoalHistory).toEqual([{ from: MON, goal: 150 }]);
    expect(pendingWeeklyGoal(back, '2026-10-10')).toBeUndefined();
    expect(back.weeklyMovementGoalMinutes).toBe(150);
  });

  it('v1’s undated goal holds for every earlier week, and is given no date', () => {
    const legacy: WeeklyGoalSettings = { weeklyMovementGoalMinutes: 120 };
    expect(weeklyGoalOn(legacy, '2025-01-01')).toBe(120);
    const s = withWeeklyGoal(legacy, 180, THU);
    expect(s.weeklyMovementGoalHistory).toEqual([{ from: '', goal: 120 }, { from: NEXT_MON, goal: 180 }]);
    expect(weeklyGoalOn(s, '2025-01-01')).toBe(120);
    expect(weeklyGoalOn(s, THU)).toBe(120);
    expect(weeklyGoalOn(s, NEXT_MON)).toBe(180);
  });

  it('ignores history this app could not have written (an imported file)', () => {
    const s = {
      weeklyMovementGoalMinutes: 150,
      weeklyMovementGoalHistory: [{ from: '2026-10-07', goal: 90 }, { from: 'soon', goal: 60 }, { from: MON, goal: -5 }],
    } as unknown as WeeklyGoalSettings;
    // Not a Monday, not a day, not a goal: none is usable, so the stored goal stands as v1's did.
    expect(weeklyGoalOn(s, THU)).toBe(150);
    expect(weeklyGoalChanges(s)).toEqual([]);
  });

  it('weeklyGoalChanges: the valid changes, oldest first, v1’s undated goal first of all', () => {
    const s = { weeklyMovementGoalHistory: [{ from: NEXT_MON }, { from: '', goal: 120 }, { from: MON, goal: 150 }] } as WeeklyGoalSettings;
    expect(weeklyGoalChanges(s)).toEqual([{ from: '', goal: 120 }, { from: MON, goal: 150 }, { from: NEXT_MON }]);
    expect(weeklyGoalChanges(undefined)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/screens/track/weeklyGoal.test.ts`
Expected: FAIL, "Cannot find module './weeklyGoal'".

- [ ] **Step 3: Add the setting.** In `src/types/index.ts`, inside `UserSettings`, straight after `weeklyMovementGoalMinutes`:

```ts
  /**
   * v2 (B-16): each change to the weekly goal and the Monday it took effect,
   * oldest first. `from: ''` is a goal v1 set before goals were dated: it
   * holds for every week before the first dated change. An entry with no
   * `goal` removed it.
   */
  weeklyMovementGoalHistory?: { from: string; goal?: number }[];
```

In `src/store/importCheck.ts`, in `SETTINGS_SPEC`, after `weeklyMovementGoalMinutes`:

```ts
  weeklyMovementGoalHistory: listOf(shape({ from: x => x === '' || day(x), goal: num(1, 10080) }, ['from'])),
```

- [ ] **Step 4: Write the module** `src/screens/track/weeklyGoal.ts`

```ts
/**
 * The weekly movement goal, kept by the week (journey §12.5, B-16).
 *
 * A change applies from the next Monday: the week under way keeps the goal
 * it started with, so its ring never moves under someone mid-week (B-32 keys
 * the ring by the goal it is drawn against). A first goal, set in a week that
 * had none, applies at once: there is nothing to keep. Past weeks keep
 * theirs. A goal v1 set before goals were dated has no date, and none is
 * invented: it holds for every week before the first dated change.
 */
import { isDay } from '@/health/observation';
import type { UserSettings } from '@/types';
import { addDays, mondayOf } from './periods';

export type WeeklyGoalSettings = Pick<UserSettings, 'weeklyMovementGoalMinutes' | 'weeklyMovementGoalHistory'>;
type Change = { from: string; goal?: number };

const isGoal = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;
/** A Monday, or '' for the goal v1 kept with no date. */
const isFrom = (v: unknown): v is string => v === '' || (typeof v === 'string' && isDay(v) && mondayOf(v) === v);

/**
 * The changes as stored, oldest first, keeping only what this app could have
 * written: settings can arrive in an imported file. Me's Goals lists them
 * (Plan 4).
 */
export function weeklyGoalChanges(settings: WeeklyGoalSettings | undefined): Change[] {
  const h: unknown = settings?.weeklyMovementGoalHistory;
  if (!Array.isArray(h)) return [];
  return h
    .filter((c): c is Change => typeof c === 'object' && c !== null && isFrom((c as Change).from) && ((c as Change).goal === undefined || isGoal((c as Change).goal)))
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
}

/** The goal in force for the week holding `day`. */
export function weeklyGoalOn(settings: WeeklyGoalSettings | undefined, day: string): number | undefined {
  const history = weeklyGoalChanges(settings);
  if (history.length === 0) return isGoal(settings?.weeklyMovementGoalMinutes) ? settings.weeklyMovementGoalMinutes : undefined;
  const week = mondayOf(day);
  let goal: number | undefined;
  for (const h of history) if (h.from <= week) goal = h.goal;
  return goal;
}

/** The change waiting for a later Monday, if there is one: what the goal sheet and the Workout hub say. */
export function pendingWeeklyGoal(settings: WeeklyGoalSettings | undefined, day: string): Change | undefined {
  const week = mondayOf(day);
  return weeklyGoalChanges(settings).find(h => h.from > week);
}

/**
 * The settings with `goal` chosen on `day` (`undefined` removes it). A first
 * goal applies from this week; a change or a removal from next Monday. A
 * second change before then replaces the first, and choosing this week's goal
 * again cancels it. `weeklyMovementGoalMinutes` is the goal last chosen.
 */
export function withWeeklyGoal(settings: WeeklyGoalSettings | undefined, goal: number | undefined, day: string): WeeklyGoalSettings {
  const week = mondayOf(day);
  const now = weeklyGoalOn(settings, day);
  const dated = weeklyGoalChanges(settings);
  const undated: Change[] = dated.length === 0 && isGoal(settings?.weeklyMovementGoalMinutes) ? [{ from: '', goal: settings.weeklyMovementGoalMinutes }] : [];
  const kept = [...undated, ...dated].filter(h => h.from <= week);
  const from = now === undefined ? week : addDays(week, 7);
  const history = goal === now ? kept : [...kept.filter(h => h.from !== from), { from, ...(goal !== undefined ? { goal } : {}) }];
  return { weeklyMovementGoalMinutes: goal, weeklyMovementGoalHistory: history };
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/screens/track/weeklyGoal.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: The sheet writes by the week.** In `src/screens/track/GoalSheet.tsx`:
  - add `import { format, parseISO } from 'date-fns';`, `import { useStore } from '@/store/useStore';` (beside `setSettings, update`), `import { addDays, mondayOf } from './periods';` (beside `today`) and `import { weeklyGoalOn, withWeeklyGoal } from './weeklyGoal';`;
  - drop `setSettings` from the store import if nothing else in the file uses it (`StepsGoalForm` uses `update`).

Replace `GoalForm`'s `write`:

```tsx
  // Built inside the store's queue from the latest settings, so a change made elsewhere is not lost.
  const write = async (minutes: number | undefined) => {
    setBusy(true);
    const result = await update(prev => ({ ...prev, settings: { ...prev.settings, ...withWeeklyGoal(prev.settings, minutes, today()) } }));
    setBusy(false);
    if (!result.ok) return setError(result.failure.message);
    onDone();
  };
```

At the top of `GoalForm`:

```tsx
  const { settings } = useStore();
  const day = today();
  const thisWeek = weeklyGoalOn(settings, day);
  const monday = format(parseISO(addDays(mondayOf(day), 7)), 'EEEE d MMMM');
```

Directly after the opening `<p>` paragraph:

```tsx
      {thisWeek !== undefined && (
        <Hint>A change starts on {monday}. This week keeps its goal of {thisWeek} minutes.</Hint>
      )}
```

- [ ] **Step 7: The screens read the week's goal.**
  - **`HomeScreen.tsx`:**
    - import `weeklyGoalOn` from `@/screens/track/weeklyGoal`;
    - replace `const goal = settings.weeklyMovementGoalMinutes;` with `const goal = weeklyGoalOn(settings, today);`;
    - pass the sheet the goal last chosen: `<GoalSheet … goal={settings.weeklyMovementGoalMinutes} />`.
  - **`MyDay.tsx`:**
    - import `weeklyGoalOn` from `./weeklyGoal`;
    - in the day view, replace `const goal = settings.weeklyMovementGoalMinutes;` with `const goal = weeklyGoalOn(settings, day);`;
    - in the trends view, replace the same line with `const goal = weeklyGoalOn(settings, current);`;
    - leave `<GoalSheet … goal={state.settings.weeklyMovementGoalMinutes} />` as it is.

  Find all three with `grep -n "weeklyMovementGoalMinutes" src/screens`. No other screen reads the goal.

- [ ] **Step 8: Write the caller test** `src/screens/track/goalSheet.callers.test.ts`. It uses the same setup as `stepsGoal.callers.test.ts` (the mocked Sheet, the in-memory `localStorage`, the fake IndexedDB).

```ts
/**
 * The weekly goal through the real sheet over the real store (B-16): a first
 * goal counts this week; a change on Thursday waits for Monday, and the sheet
 * says so before it is saved.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render } from '@/test/host';

vi.mock('@/components/hig/Sheet', async () => {
  const { createElement: h } = await import('react');
  return { Sheet: ({ open, children }: { open: boolean; children?: unknown }) => (open ? h('div', { role: 'dialog' }, children as never) : null) };
});

const m = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k),
  clear: () => m.clear(), key: (i: number) => [...m.keys()][i] ?? null, get length() { return m.size; },
} as Storage;
Object.assign(globalThis, { document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} } });

const store = await import('@/store/useStore');
const { GoalSheet } = await import('./GoalSheet');
const { weeklyGoalOn } = await import('./weeklyGoal');

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
});

async function save(value: string) {
  const host = render(createElement(GoalSheet, { open: true, onOpenChange: vi.fn(), goal: store.getState().settings.weeklyMovementGoalMinutes }));
  await host.settle();
  const before = host.text();
  await host.change(host.field('Minutes each week'), { value });
  await host.click(host.button('Save goal'));
  host.unmount();
  return before;
}

describe('the weekly goal sheet (B-16)', () => {
  it('a first goal counts this week; a change on Thursday waits for Monday, and the sheet says so first', async () => {
    vi.setSystemTime(new Date(2026, 9, 6, 9));
    const first = await save('150');
    expect(first).not.toContain('This week keeps');
    expect(weeklyGoalOn(store.getState().settings, '2026-10-06')).toBe(150);

    vi.setSystemTime(new Date(2026, 9, 8, 9));
    const second = await save('200');
    expect(second).toContain('A change starts on Monday 12 October. This week keeps its goal of 150 minutes.');
    const settings = store.getState().settings;
    expect(weeklyGoalOn(settings, '2026-10-08')).toBe(150);
    expect(weeklyGoalOn(settings, '2026-10-12')).toBe(200);
    expect(settings.weeklyMovementGoalMinutes).toBe(200);
  });
});
```

Run: `npx vitest run src/screens/track/goalSheet.callers.test.ts`
Expected: PASS. If `host.field` can't find "Minutes each week", look at how `stepsGoal.callers.test.ts` finds "Steps a day", and use the same lookup.

- [ ] **Step 9: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/track/weeklyGoal.ts src/screens/track/weeklyGoal.test.ts src/screens/track/goalSheet.callers.test.ts src/screens/track/GoalSheet.tsx src/screens/track/MyDay.tsx src/screens/home/HomeScreen.tsx src/types/index.ts src/store/importCheck.ts
git commit -m "feat: Start a changed weekly goal on the next Monday"
```

---
### Task 3: The hub frame, its loading state and the morph's far end

**Files:**
- Create: `src/screens/hub/frame.ts`
- Create: `src/screens/hub/frame.test.ts`
- Create: `src/screens/hub/HubFrame.tsx`
- Create: `src/screens/hub/HubSkeleton.tsx`
- Modify: `src/components/hig/Screen.tsx` (an optional `wash` layer)
- Modify: `src/design/motion.ts` (`markMorph`)
- Modify: `src/screens/home/Tile.tsx` (mark the morph on a tap that animates)
- Modify: `src/main.tsx` (clear the mark)
- Modify: `src/index.css` (`--spring-smooth`, the M3 rules, the skeleton)
- Modify: `src/design/tokens.node.test.ts` (text on the wash; the spring token)
- Modify: `src/routes.tsx` (the skeleton as each hub's loading state)
- Modify: `src/screens/track/MetricDetail.tsx` (the interim `/trends/:id` never dead-ends for a category with a trend)

**Interfaces:**
- Produces, in `frame.ts`:
  - `HUB_BACK = { to: '/home', label: 'Home' }`;
  - `HUB_WASH = 14` (percent);
  - `HISTORY_PREVIEW = 3`;
  - `morphNamed(i: { transitioning: boolean; fromHome: boolean; urgent: boolean; held: boolean }): boolean`;
  - `hubCategory(pathname: string): Category | undefined`;
  - `skeletonTitle(pathname: string): string`;
  - `trendHref(category: Pick<Category, 'trend'>, search?: string): string | undefined`;
  - `stripLayout(columns: 1 | 2 | 3 | 4): 'strip' | 'list'`.
- Produces, in `HubFrame.tsx`:
  - `HubFrame({ category, held?, trailing?, children })`;
  - `HubSection({ title, footer?, children })`, a region named by its visible heading;
  - `SeeTrends({ category, search?, origin })`.
- Produces `HubSkeleton()`.
- Produces `markMorph(): void` (in `@/design/motion`).
- Produces `Screen`'s new prop: `wash?: { background: string; name?: string }`.
- Consumes:
  - `CATEGORIES`, `Category` (with `trend?`);
  - `UrgentContext` (`@/screens/home/urgent`);
  - `FROM_HOME` (`@/screens/home/model`);
  - `originOf` (`@/components/hig/navigation`).

- [ ] **Step 1: Write the failing test** `src/screens/hub/frame.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { categoryById } from '@/categories';
import { HUB_BACK, hubCategory, morphNamed, skeletonTitle, stripLayout, trendHref } from './frame';

describe('the hub frame (journey §8.1, §8.4; M3)', () => {
  it('goes Home with nothing below it to pop to (journey §19.1)', () => {
    expect(HUB_BACK).toEqual({ to: '/home', label: 'Home' });
  });

  it('names the wash for the morph only from a Home tile, and never beside a stop or a hold (motion rule 2)', () => {
    const base = { transitioning: true, fromHome: true, urgent: false, held: false };
    expect(morphNamed(base)).toBe(true);
    expect(morphNamed({ ...base, transitioning: false })).toBe(false);
    expect(morphNamed({ ...base, fromHome: false })).toBe(false);
    expect(morphNamed({ ...base, urgent: true })).toBe(false);
    expect(morphNamed({ ...base, held: true })).toBe(false);
  });

  it('knows a hub’s category from its address, sub-pages included', () => {
    expect(hubCategory('/hub/glucose')?.id).toBe('glucose');
    expect(hubCategory('/hub/workout/plan')?.id).toBe('workout');
    expect(hubCategory('/hub/nope')).toBeUndefined();
    expect(hubCategory('/home')).toBeUndefined();
  });

  it('calls a loading hub by its category, and anything else "Loading"', () => {
    expect(skeletonTitle('/hub/bp')).toBe('Blood pressure');
    expect(skeletonTitle('/hub/nope')).toBe('Loading');
  });

  it('links each category to its own trend, with the query that names which; Learn has none (B-14)', () => {
    expect(trendHref(categoryById('glucose'))).toBe('/trends/glucose');
    expect(trendHref(categoryById('labs'), '?metric=b12')).toBe('/trends/labs?metric=b12');
    expect(trendHref(categoryById('learn'))).toBeUndefined();
  });

  it('draws a day strip as rows wherever Home’s tiles are one column (K-42)', () => {
    expect(stripLayout(1)).toBe('list');
    expect(stripLayout(2)).toBe('strip');
    expect(stripLayout(4)).toBe('strip');
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/screens/hub/frame.test.ts`
Expected: FAIL, "Cannot find module './frame'".

- [ ] **Step 3: Write** `src/screens/hub/frame.ts`

```ts
/**
 * The hub frame's rules (journey §8.1, §8.4; motion M3, M24): where Back goes
 * with nothing to pop to, when the category wash takes part in the tile's
 * morph, what a loading hub is called, the trend a hub links to, and how a
 * day strip lays out.
 */
import { CATEGORIES, type Category } from '@/categories';

/** With nothing below it to pop to, a hub goes Home (journey §19.1: a deep link's Back goes to Home). */
export const HUB_BACK = { to: '/home', label: 'Home' } as const;

/** How strongly the category colour washes the top of a hub, in percent. Text on it is checked in `tokens.node.test.ts`. */
export const HUB_WASH = 14;

/** History shows the last 3 entries, then "Show all" (journey §8.2). */
export const HISTORY_PREVIEW = 3;

/**
 * The far end of the tile's morph (M3, B-27): the wash takes the tile's
 * `hub-card-bg` name only during the router's transition from a Home tile,
 * and never while an urgent decision stands or the hub opens on a hold or a
 * stop (motion rule 2).
 */
export function morphNamed({ transitioning, fromHome, urgent, held }: { transitioning: boolean; fromHome: boolean; urgent: boolean; held: boolean }): boolean {
  return transitioning && fromHome && !urgent && !held;
}

/** The category a hub address belongs to: `/hub/{id}` and anything under it. */
export function hubCategory(pathname: string): Category | undefined {
  const id = /^\/hub\/([^/?#]+)/.exec(pathname)?.[1];
  return CATEGORIES.find(c => c.id === id);
}

/** What a loading hub is called: its category, or "Loading" for an address that names none. */
export function skeletonTitle(pathname: string): string {
  return hubCategory(pathname)?.title ?? 'Loading';
}

/** "See trends": the category's own trend, with a query that names which (Labs keeps its kind, B-14). */
export function trendHref(category: Pick<Category, 'trend'>, search = ''): string | undefined {
  return category.trend ? `${category.trend}${search}` : undefined;
}

/** Seven columns, or seven rows below 375 px or above 130% text (K-42): rows wherever Home's tiles are one column. */
export function stripLayout(columns: 1 | 2 | 3 | 4): 'strip' | 'list' {
  return columns === 1 ? 'list' : 'strip';
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/screens/hub/frame.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: The wash layer in `Screen`.** In `src/components/hig/Screen.tsx`, add a prop after `className`:

```ts
  /**
   * A solid layer behind the bar and the large title, such as a hub's
   * category wash (journey §8.1). `name` makes it a view-transition element
   * while it is set (M3's `hub-card-bg`, B-27). Never glass (journey §20.1).
   */
  wash?: { background: string; name?: string };
```

Destructure it, change the root to `<div className={cn('relative isolate bg-grouped-bg', className)}>`, and make this its first child:

```tsx
      {wash && (
        <div
          aria-hidden
          data-wash
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-56"
          style={{ background: wash.background, ...(wash.name ? { viewTransitionName: wash.name } : {}) }}
        />
      )}
```

`isolate` keeps the `-z-10` layer above the root's background and below the content.

- [ ] **Step 6: Write** `src/screens/hub/HubFrame.tsx`

```tsx
import { useContext, useId, type ReactNode } from 'react';
import { Link, useLocation, useViewTransitionState } from 'react-router-dom';
import type { Category } from '@/categories';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { originOf, type Origin } from '@/components/hig/navigation';
import { FROM_HOME } from '@/screens/home/model';
import { UrgentContext } from '@/screens/home/urgent';
import { HUB_BACK, HUB_WASH, morphNamed, trendHref } from './frame';

/**
 * The frame every hub shares (journey §8.1).
 * - Back names the screen that opened it and returns there. With nothing to
 *   pop to it goes Home (the stack's `backTarget`, through `Screen`).
 * - The category's colour washes softly behind the bar. The wash is solid
 *   and never blurred, and it is the far end of the tile's morph (M3).
 * - The shell's safety surface comes first, through `Screen`'s
 *   `ScreenTopContext`, on every hub (B-02).
 */
export function HubFrame({ category, held = false, trailing, children }: {
  category: Category;
  /** The hub opens on a hold or a stop for its mode: nothing is named for a transition (motion rule 2). */
  held?: boolean;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  const location = useLocation();
  const urgent = useContext(UrgentContext) !== undefined;
  const transitioning = useViewTransitionState(category.hub);
  const fromHome = originOf(location.state)?.path === FROM_HOME.path;
  const name = morphNamed({ transitioning, fromHome, urgent, held }) ? 'hub-card-bg' : undefined;
  const background = `linear-gradient(to bottom, color-mix(in oklab, var(${category.colour}) ${HUB_WASH}%, var(--grouped-bg)), var(--grouped-bg))`;
  return (
    <Screen title={category.title} back={HUB_BACK} wash={{ background, ...(name ? { name } : {}) }} {...(trailing ? { trailing } : {})}>
      {children}
    </Screen>
  );
}

/** A region of a hub, named by its visible heading ("Right now", "Latest", "This week", "History"). */
export function HubSection({ title, footer, children }: { title: string; footer?: ReactNode; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col">
      <h2 id={id} className="px-4 pb-2 text-[length:var(--text-footnote)] font-medium uppercase tracking-wide text-muted-foreground [overflow-wrap:break-word]">
        {title}
      </h2>
      {children}
      {footer && <p className="px-4 pt-2 text-[length:var(--text-footnote)] leading-snug text-muted-foreground [overflow-wrap:break-word]">{footer}</p>}
    </section>
  );
}

/** "See trends": the category's own trend (journey §8.2; interim until Plan 3), opened as a push from here. */
export function SeeTrends({ category, search, origin }: { category: Category; search?: string; origin: Origin }) {
  const to = trendHref(category, search);
  if (!to) return null;
  return (
    <Group>
      <Row as={Link} to={to} state={origin} viewTransition label="See trends" chevron />
    </Group>
  );
}
```

If `Origin` isn't exported from `navigation.ts` under that name, use the `{ path, label, search? }` type it exports for `originOf`. That's the same shape `track/useOrigin.ts` imports from `MyDay`.

- [ ] **Step 7: Write** `src/screens/hub/HubSkeleton.tsx`

```tsx
import { useLocation } from 'react-router-dom';
import { Screen } from '@/components/hig/Screen';
import { HUB_BACK, skeletonTitle } from './frame';

/**
 * A hub still loading (journey §8.4, A-71; M24). The bar, the title and Back
 * are there at once, so navigation stays usable. Content-shaped placeholders
 * appear after 150 ms, still under Reduce motion, with a shimmer of at most
 * three cycles otherwise (B-29). A screen reader hears "Loading" once.
 */
export function HubSkeleton() {
  const { pathname } = useLocation();
  return (
    <Screen title={skeletonTitle(pathname)} back={HUB_BACK}>
      <div aria-busy="true" className="flex flex-col gap-4">
        <p role="status" className="sr-only">Loading</p>
        {[0, 1, 2].map(i => <div key={i} aria-hidden className="hub-skeleton h-28 rounded-2xl bg-grouped-card" />)}
      </div>
    </Screen>
  );
}
```

- [ ] **Step 8: The morph's page fade.**
  - **`src/design/motion.ts`:** after `transitionSkipped`, add:

    ```ts
    /**
     * The next view transition is a tile opening its hub (M3): the page fades
     * while the tile's background grows into the hub's wash. Cleared when the
     * transition ends, or by a navigation that doesn't animate (`main.tsx`).
     */
    export function markMorph(): void {
      if (typeof document !== 'undefined') document.documentElement.dataset.morph = '';
    }
    ```

  - **`src/screens/home/Tile.tsx`:** import `markMorph` beside `skipNextTransition`. In the link's `onClick`, replace `if (urgent || opensOnHold()) skipNextTransition();` with:

    ```tsx
        if (urgent || opensOnHold()) skipNextTransition();
        else markMorph();
    ```

  - **`src/main.tsx`:**
    - In the `startViewTransition` wrapper's `finished.finally`, clear the morph mark beside `vtRunning`:

      ```ts
          .finally(() => {
            if (latest !== transition) return
            delete document.documentElement.dataset.vtRunning
            delete document.documentElement.dataset.morph
          })
      ```

    - Make the `router.navigate` wrapper clear the mark when it navigates without a transition:

      ```ts
      router.navigate = ((to: Parameters<typeof navigate>[0], opts?: Parameters<typeof navigate>[1]) => {
        const plain = typeof to === 'number' || (opts?.replace && !backPending())
          || !shouldAnimate({ systemReduced: reduceMotion.matches, appReduced: document.documentElement.dataset.reduceMotion !== undefined })
        // A tile's morph (M3) belongs to an animated push; a plain navigation leaves no mark behind.
        if (plain) delete document.documentElement.dataset.morph
        return plain ? navigate(to as never, opts) : navigate(to, { viewTransition: true, ...opts })
      }) as typeof router.navigate
      ```

- [ ] **Step 9: The CSS.** Append to `src/index.css`:

```css
/* ==========================================================================
   Hubs (journey §8.1, §8.4; motion M3, M24).
   ========================================================================== */
/* The spring at 0.4 s, bounce 0, as a CSS curve (motion spec §3.1; design research §4.1). */
:root { --spring-smooth: linear(0, 0.058, 0.18, 0.321, 0.455, 0.573, 0.671, 0.75, 0.812, 0.86, 0.897, 0.924, 0.945, 0.96, 0.971, 0.979, 0.985, 0.989, 0.992, 0.994, 0.996, 0.997, 0.998, 0.999, 1); }

@keyframes fs-hub-in {
  from { opacity: 0; transform: translate3d(0, 8px, 0); }
  to   { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: no-preference) {
  /* The tile's plain background grows into the hub's wash; text stays out of it and cross-fades (M3, B-27). */
  ::view-transition-group(hub-card-bg) { animation-duration: 588ms; animation-timing-function: var(--spring-smooth); }
  ::view-transition-old(hub-card-bg),
  ::view-transition-new(hub-card-bg) { height: 100%; }
  /* The rest of the page fades rather than slides; the hub's content rises 8 px once the morph is half done. */
  :root[data-morph]::view-transition-old(root) { animation: fs-nav-fade-out 0.2s linear both; }
  :root[data-morph]::view-transition-new(root) { animation: fs-hub-in 0.3s var(--ease-out-quart) 0.29s both; }
}

/* Loading placeholders: after 150 ms, a shimmer of at most three cycles, and still under Reduce motion (B-29). */
.hub-skeleton { opacity: 0; animation: fs-fade-in 0.2s linear 150ms both, hub-shimmer 1.2s ease-in-out 350ms 3; }
@keyframes hub-shimmer { 50% { background-color: color-mix(in oklab, var(--grouped-card) 60%, var(--grouped-bg)); } }
:root[data-reduce-motion] .hub-skeleton { animation: fs-fade-in 0.01ms linear 150ms both; }
```

The system's reduced-motion block already cuts every animation to 0.01 ms, and the delay stays, so the placeholders still wait 150 ms.

- [ ] **Step 10: Test the wash and the token.** Add this to `src/design/tokens.node.test.ts`:
  - import `HUB_WASH` from `@/screens/hub/frame`;
  - import `springLinear` from `./motion`.

```ts
/** `a` mixed into `b` by `t` in OKLab, as `color-mix(in oklab, a t, b)` mixes them, back as [L, C, h]. */
function mixOklab(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  const lab = ([L, C, h]: [number, number, number]) => [L, C * Math.cos((h * Math.PI) / 180), C * Math.sin((h * Math.PI) / 180)];
  const [L1, a1, b1] = lab(a);
  const [L2, a2, b2] = lab(b);
  const L = L1 * t + L2 * (1 - t);
  const A = a1 * t + a2 * (1 - t);
  const B = b1 * t + b2 * (1 - t);
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}

describe('hub washes (journey §8.1, §20.3)', () => {
  for (const [selector, theme] of THEMES) {
    const bg = token(selector, '--grouped-bg');
    const tint = token(selector, '--tint');
    const fg = token(selector, '--foreground', '--foreground');
    for (const c of CATEGORIES.map(x => x.id)) {
      it(`${c} in ${theme}: Back and the large title keep 4.5:1 on the wash at its strongest`, () => {
        const wash = mixOklab(token(selector, `--cat-${c}`), bg, HUB_WASH / 100);
        expect(contrast(tint, wash)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(fg, wash)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe('the spring curve token (motion spec §3.1)', () => {
  it('is the curve springLinear(0) draws, within 0.01 at each step', () => {
    const m = /--spring-smooth:\s*linear\(([^)]+)\)/.exec(css);
    expect(m).not.toBeNull();
    const css24 = m![1].split(',').map(Number);
    const mine = springLinear(0).slice('linear('.length, -1).split(',').map(Number);
    expect(css24).toHaveLength(mine.length);
    css24.forEach((v, i) => expect(Math.abs(v - mine[i])).toBeLessThan(0.01));
  });
});
```

Run: `npx vitest run src/design src/screens/hub`
Expected: PASS.
- If a category fails the wash test, lower `HUB_WASH` by 2 until every pair passes. Keep it at 8 or more, so the wash still reads as the category's.
- If `token(selector, '--foreground', '--foreground')` finds two blocks, pass the property the shadcn block also declares beside it (for example `'--card-foreground'`) as its `holding` argument.

- [ ] **Step 11: Each hub's loading state is the skeleton.** In `src/routes.tsx`:

```tsx
import { lazy, Suspense, type ReactNode } from 'react';
import { HubSkeleton } from '@/screens/hub/HubSkeleton';

/** A hub's own loading state (journey §8.4): its bar and Back at once, placeholders after 150 ms. */
const hub = (element: ReactNode) => <Suspense fallback={<HubSkeleton />}>{element}</Suspense>;
```

Wrap every `/hub/…` route's element in `hub(…)`: Workout, Stretch, Walk, Learn, Food, Back, and `/hub/:id`. For example: `<Route path="/hub/stretch" element={hub(<StretchScreen />)} />`. The shell's own Suspense stays as it is for the other areas.

Every hub's "See trends" opens its category's `trend`. Until Plan 3, `/trends/:id` is v1's metric screen, and a category with no v1 chart (Stretch, Back & leg) would land on "That page has moved". In `src/screens/track/MetricDetail.tsx`'s `MetricFor`, send such a category to the Trends tab instead. Import `CATEGORIES` from `@/categories`:

```tsx
  if (!metric) {
    const declared = trend && CATEGORIES.some(c => c.id === id && c.trend !== undefined);
    return <Navigate to={declared ? '/trends' : '/home?moved=1'} replace />;
  }
```

- [ ] **Step 12: Check by eye.** Run `npm run dev`. At 428×926, light and dark:
  - tap a Home tile and watch the morph: the tile grows into the wash, and the text cross-fades;
  - throttle the network to Slow 3G in DevTools and open `/hub/glucose` cold: the bar and Back show at once, and the placeholders appear after about 150 ms;
  - with the in-app Reduce motion on (`settings.display.reduceMotion`), nothing moves and the placeholders still appear;
  - `/trends/stretch` and `/trends/back` open the Trends tab, and `/trends/nonsense` goes Home with "That page has moved".

- [ ] **Step 13: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/hub/frame.ts src/screens/hub/frame.test.ts src/screens/hub/HubFrame.tsx src/screens/hub/HubSkeleton.tsx src/components/hig/Screen.tsx src/design/motion.ts src/design/tokens.node.test.ts src/screens/home/Tile.tsx src/main.tsx src/index.css src/routes.tsx src/screens/track/MetricDetail.tsx
git commit -m "feat: Frame every hub with its opener, its colour and a loading state"
```

---

### Task 4: The movement card, read from the shared gate

**Files:**
- Create: `src/screens/hub/movement.ts`
- Create: `src/screens/hub/movement.test.ts`
- Create: `src/screens/hub/hooks.ts`
- Create: `src/screens/hub/MovementCard.tsx`
- Create: `src/screens/hub/MovementCard.callers.test.ts`

**Interfaces:**
- Produces, in `movement.ts`:
  - `type HubActionKind = 'start' | 'continue' | 'review' | 'anyway' | 'mobility' | 'justWalk' | 'profile' | 'join' | 'stretch' | 'status' | 'otherTime'`;
  - `interface HubAction { kind: HubActionKind; label: string; disabled?: boolean }`;
  - `type CardState = 'go' | 'checkIn' | 'resume' | 'rest' | 'join' | 'held' | 'gap' | 'stopped' | 'paused'`;
  - `interface HubCard { state; tone: 'normal' | 'caution' | 'stop' | 'quiet'; title: string; detail?: string; today?: string; reason?: string; reasons: string[]; release?: string; restrictions: string[]; primary?: HubAction; secondary: HubAction[]; note?: string }`;
  - `interface CardInput { mode; permission; gate; status; line; title; detail?; reason?; gaps; stretchOpen; enrolled?; recovery?; rest?; saved?; blocked?; waiting?; afterMeal? }`;
  - `movementCard(i: CardInput): HubCard`;
  - `type ActionTarget = { via: 'gate'; mode: Mode; href: string; label: string } | { via: 'go'; to: string } | { via: 'status' } | { via: 'local' }`;
  - `interface ActionContext { mode: Mode; href: string; startLabel: string; resumeHref?: string; plainHref?: string; recovery?: boolean }`;
  - `actionTarget(kind: HubActionKind, c: ActionContext): ActionTarget`;
  - `runAction(t: ActionTarget, fx: { start(mode, href, label): void; go(to): void; status(): void; local(): void }): void`;
  - `JOIN_HREF = '/hub/workout/plan?join=1'`;
  - `resumeAllowed(status: Status, mode: Mode): boolean`;
  - `restDayOf(plan: Pick<SessionPlan, 'kind' | 'focus'>): { mobility: boolean } | undefined`;
  - `sessionParts(plan: Pick<SessionPlan, 'blockStarts'>): string | undefined`;
  - `stretchReason(i: { chosen: boolean; flare: boolean; focus: StretchFocus; yesterday?: { pain?: number; legPain?: number }; fromLast: boolean; focusSetting?: UserSettings['focus'] }): string | undefined`.
- Produces, in `hooks.ts`:
  - `useHubGate(mode: Mode)`, which returns `{ guided, state, now, today, status, enrolled, gaps, gate, line, permission, stretchOpen, recommendation, start, sheet, hour12 }`;
  - `useHubOrigin(label: string): { path: string; label: string; search?: string }`.
- Produces `MovementCard({ card: HubCard; onAction: (kind: HubActionKind) => void })`.
- Consumes:
  - `gateOf`, `recommend`, `nextBoundary`, `isEnrolled`, `HREF` and `type Gate` (`@/health/recommend`);
  - `movementLine` and `type TileLine` (`@/screens/home/tileLine`);
  - `normalLine` (`@/screens/home/model`);
  - `recommendSources` and `withEffectiveToday` (`@/screens/home/urgent`);
  - `useClock` and `useWakeAt` (`@/screens/today/clock`);
  - `profileGaps` (`@/engine/health`);
  - `useStartMovement`;
  - `defaultStartLabel` and `headline` (`@/components/checkin/copy`);
  - `startLabelFor` (`@/screens/today/model`);
  - `HubSection` (Task 3).

- [ ] **Step 1: Write the failing test** `src/screens/hub/movement.test.ts`

```ts
import { describe, expect, it, vi } from 'vitest';
import { PERMISSION_TEXT, type Permission } from '@/engine/permission';
import type { TileLine } from '@/screens/home/tileLine';
import {
  JOIN_HREF, actionTarget, movementCard, restDayOf, resumeAllowed, runAction, sessionParts, stretchReason,
  type CardInput, type HubActionKind, type HubCard,
} from './movement';

const ok: Permission = { mode: 'stretch', allowed: true, disposition: 'reassure', reasons: [], restrictions: [], needsCheckIn: false };
const line = (text: string, tone: TileLine['tone'] = 'normal'): TileLine => ({ text, tone });
const input = (over: Partial<CardInput> = {}): CardInput => ({
  mode: 'stretch', permission: ok, gate: 'go', status: 'normal', line: line('Back & hips · 10 min'),
  title: 'Back & hips · 10 min', gaps: { healthUnreviewed: false, medicinesUnknown: false }, stretchOpen: true, ...over,
});
const kinds = (c: HubCard) => [c.primary?.kind, ...c.secondary.map(a => a.kind)].filter(Boolean);
const held = (mode: Permission['mode'], reasons: string[], over: Partial<Permission> = {}): Permission =>
  ({ ...ok, mode, allowed: false, disposition: 'hold', reasons, needsCheckIn: false, ...over });

describe('movementCard: the hub column of the copy table (journey §7.5)', () => {
  it('allowed: Start, in the mode’s own words', () => {
    const c = movementCard(input());
    expect(c.state).toBe('go');
    expect(c.primary).toEqual({ kind: 'start', label: 'Start stretch' });
    expect(movementCard(input({ mode: 'guided', permission: { ...ok, mode: 'guided' }, title: 'Full Body B · 45 min', enrolled: true, recovery: true })).primary?.label).toBe('Start recovery session');
  });

  it('allowed with changes: Start, with the changes listed', () => {
    const p = { ...ok, disposition: 'adjust' as const, restrictions: ['Gentle range only.'] };
    const c = movementCard(input({ permission: p }));
    expect(c.today).toBe('With changes for today');
    expect(c.restrictions).toEqual(['Gentle range only.']);
  });

  it('only a check-in needed: "Check in & start", which the gate turns into the check-in', () => {
    const p = held('stretch', [PERMISSION_TEXT.noCheckIn], { needsCheckIn: true });
    expect(movementCard(input({ permission: p, gate: 'checkIn' })).primary).toEqual({ kind: 'start', label: 'Check in & start' });
  });

  it('a hold: the gate’s own headline and reasons, no Start, and today’s check-in to put a mistake right', () => {
    const p = held('walk', [PERMISSION_TEXT.footWalk], { release: 'Walking is back once your foot has healed or a clinician says it is fine.' });
    const c = movementCard(input({ mode: 'walk', permission: p, gate: 'hold', title: 'Just a walk', line: line('No walking for now', 'caution') }));
    expect(c.state).toBe('held');
    // The gate's card, as Home's and the check-in's (§8.4): the tile's shorter line stays on the tile.
    expect(c.title).toBe('No walk for now');
    expect(c.reasons).toEqual([PERMISSION_TEXT.footWalk]);
    expect(c.release).toMatch(/foot has healed/);
    expect(c.primary).toBeUndefined();
    expect(kinds(c)).toEqual(['review', 'stretch']);
  });

  it('a re-check waiting: the gate’s headline, when it is due, and "Enter a new reading", which is the check-in', () => {
    const p = held('stretch', ['Treat the low and re-check.'], { needsCheckIn: true, release: 'Re-check your glucose in 15 minutes.' });
    const c = movementCard(input({ permission: p, gate: 'recheck', line: line('Waiting for your re-check at 9:15 am', 'caution') }));
    expect(c.title).toBe('Check again before you start');
    expect(c.detail).toBe('Waiting for your re-check at 9:15 am');
    expect(c.primary).toEqual({ kind: 'review', label: 'Enter a new reading' });
  });

  it('a hold the tile can only point at ("Not now: open to see why") still says the gate’s headline here', () => {
    const p = held('stretch', ['Something new the tile has no headline for.']);
    expect(movementCard(input({ permission: p, gate: 'hold', line: line('Not now: open to see why', 'caution') })).title).toBe('No stretch for now');
  });

  it('a profile gap names the chapter; no check-in can answer it', () => {
    const p = held('stretch', [PERMISSION_TEXT.medicinesUnknown]);
    const c = movementCard(input({ permission: p, gate: 'hold', gaps: { healthUnreviewed: false, medicinesUnknown: true }, line: line('Finish setting up · your medicines', 'caution') }));
    expect(c.state).toBe('gap');
    expect(c.title).toBe('Your diabetes medicines');
    expect(c.primary).toEqual({ kind: 'profile', label: 'Answer the questions about your medicines' });
    expect(kinds(c)).toContain('review');
  });

  it('an emergency or a stop for today: the stop, the same headline as Home’s card, with no Start', () => {
    const p: Permission = { ...ok, allowed: false, disposition: 'emergency', reasons: ['Call your local emergency number now.'], needsCheckIn: false };
    const c = movementCard(input({ permission: p, gate: 'emergency', line: line('Not today', 'stop') }));
    expect(c).toMatchObject({ state: 'stopped', tone: 'stop', title: PERMISSION_TEXT.emergencyTitle });
    expect(kinds(c)).toEqual(['review']);
  });

  it('Away or Unwell: paused, Change status first, and a quiet Start anyway (L-04)', () => {
    const c = movementCard(input({ status: 'unwell', line: line('Paused', 'quiet') }));
    expect(c).toMatchObject({ state: 'paused', title: 'Paused while you’re unwell', primary: { kind: 'status', label: 'Change status' } });
    expect(c.secondary).toEqual([{ kind: 'anyway', label: 'Start anyway' }]);
    expect(movementCard(input({ status: 'away' })).title).toBe('Paused while you’re away');
  });

  it('a stop still outranks status, as on the tile', () => {
    const p: Permission = { ...ok, allowed: false, disposition: 'today', reasons: ['Get advice today.'], needsCheckIn: false };
    expect(movementCard(input({ permission: p, gate: 'today', status: 'away' })).state).toBe('stopped');
  });

  it('Workout outside the programme: Join, and Stretch instead; during a flare the stretch comes first (D35)', () => {
    const base = input({ mode: 'guided', permission: { ...ok, mode: 'guided' }, enrolled: false, title: 'x' });
    const c = movementCard(base);
    expect(c.state).toBe('join');
    expect(c.primary).toEqual({ kind: 'join', label: 'Join the 12-week programme' });
    expect(kinds(c)).toEqual(['join', 'stretch']);
    const flare = movementCard({ ...base, status: 'flare' });
    expect(flare.primary).toEqual({ kind: 'stretch', label: 'Stretch instead' });
    expect(flare.secondary).toEqual([{ kind: 'join', label: 'Join the 12-week programme' }]);
  });

  it('a run saved today carries on, through the gate', () => {
    expect(movementCard(input({ saved: { minutesLeft: 6, label: 'Back & hips stretch' } }))).toMatchObject({
      state: 'resume', title: 'Continue your stretch', detail: '6 min left · Back & hips stretch', primary: { kind: 'continue', label: 'Continue stretch' },
    });
    expect(movementCard(input({ gate: 'checkIn', saved: { minutesLeft: 6, label: 'x' } })).primary?.label).toBe('Check in & continue');
  });

  it('Workout on a rest day: Stretch instead, with the optional rest-day mobility', () => {
    const c = movementCard(input({ mode: 'guided', permission: { ...ok, mode: 'guided' }, enrolled: true, rest: { mobility: true } }));
    expect(c).toMatchObject({ state: 'rest', title: 'Rest day', primary: { kind: 'stretch', label: 'Stretch instead' } });
    expect(c.secondary).toEqual([{ kind: 'mobility', label: 'Start rest-day mobility' }]);
  });

  it('a flare: the tile’s flare words, never "check in first", which the button says', () => {
    const p = held('stretch', [PERMISSION_TEXT.noCheckIn], { needsCheckIn: true });
    expect(movementCard(input({ permission: p, gate: 'checkIn', status: 'flare', line: line('Gentle stretch · check in first') })).today).toBe('Gentle stretch');
    const walk = movementCard(input({ mode: 'walk', permission: { ...ok, mode: 'walk' }, status: 'flare', title: 'Just a walk', line: line('Just a walk · Stretch is suggested today') }));
    expect(walk.today).toBe('Stretch is suggested today');
    expect(kinds(walk)).toEqual(['start', 'stretch']);
  });

  it('a routine the builder can’t make today says so, with no Start', () => {
    const c = movementCard(input({ blocked: 'This routine cannot be put together safely today. Try another area or length.' }));
    expect(c.state).toBe('held');
    expect(c.primary).toBeUndefined();
  });

  it('B-09: the after-meal button states the time, with Different time and Just a walk', () => {
    const c = movementCard(input({ mode: 'walk', permission: { ...ok, mode: 'walk' }, title: 'Just a walk', afterMeal: { title: 'A walk after lunch', label: 'I had lunch at 1:10 pm: walk now' } }));
    expect(c.title).toBe('A walk after lunch');
    expect(c.primary).toEqual({ kind: 'start', label: 'I had lunch at 1:10 pm: walk now' });
    expect(kinds(c)).toEqual(['start', 'otherTime', 'justWalk']);
    const first = movementCard(input({ mode: 'walk', gate: 'checkIn', permission: held('walk', [PERMISSION_TEXT.noCheckIn], { needsCheckIn: true }), title: 'x', afterMeal: { title: 'A walk after lunch', label: 'I had lunch at 1:10 pm: walk now' } }));
    expect(first.note).toBe('A short check-in comes first.');
  });

  it('a start that waits for a choice is shown, not usable, and says why', () => {
    const c = movementCard(input({ waiting: 'Choose the meal to start.' }));
    expect(c.primary).toMatchObject({ kind: 'start', disabled: true });
    expect(c.note).toBe('Choose the meal to start.');
  });

  it('never offers a start-kind action while the gate refuses (Review Focus 1)', () => {
    const refusals: Partial<CardInput>[] = [
      { gate: 'hold', permission: held('stretch', ['A hold.']) },
      { gate: 'recheck', permission: held('stretch', ['A low.'], { needsCheckIn: true }) },
      { gate: 'today', permission: { ...ok, allowed: false, disposition: 'today', reasons: ['x'], needsCheckIn: false } },
      { gate: 'emergency', permission: { ...ok, allowed: false, disposition: 'emergency', reasons: ['x'], needsCheckIn: false } },
      { gate: 'hold', permission: held('stretch', [PERMISSION_TEXT.healthUnreviewed]), gaps: { healthUnreviewed: true, medicinesUnknown: false } },
    ];
    for (const r of refusals) {
      for (const extra of [{}, { saved: { minutesLeft: 3, label: 'x' } }, { afterMeal: { title: 't', label: 'l' } }]) {
        const c = movementCard(input({ ...r, ...extra }));
        expect(kinds(c), `${r.gate}`).not.toContain('start');
        expect(kinds(c), `${r.gate}`).not.toContain('continue');
      }
    }
  });
});

describe('actionTarget: every way a hub can start movement goes through the gate (§4.1, §4.2; Review Focus 1)', () => {
  const ctx = {
    mode: 'stretch' as const, href: '/session?mode=stretch&focus=backHips&minutes=10', startLabel: 'Start stretch',
    resumeHref: '/session?mode=stretch&focus=backHips&minutes=10&resume=1', plainHref: '/walk/live?id=abcd-1234',
  };

  it('Start, Start anyway, Review, Continue, rest-day mobility and Just a walk are all gate starts', () => {
    for (const kind of ['start', 'anyway', 'review', 'continue', 'mobility', 'justWalk'] as HubActionKind[]) expect(actionTarget(kind, ctx).via, kind).toBe('gate');
    expect(actionTarget('continue', ctx)).toEqual({ via: 'gate', mode: 'stretch', href: ctx.resumeHref, label: 'Continue stretch' });
    expect(actionTarget('mobility', ctx)).toMatchObject({ via: 'gate', mode: 'guided', href: '/session' });
    expect(actionTarget('justWalk', { ...ctx, mode: 'walk' })).toMatchObject({ via: 'gate', mode: 'walk', href: ctx.plainHref });
  });

  it('everything else only navigates or opens a sheet, and never to the player or a live walk', () => {
    for (const kind of ['profile', 'join', 'stretch', 'status', 'otherTime'] as HubActionKind[]) {
      const t = actionTarget(kind, ctx);
      expect(t.via, kind).not.toBe('gate');
      if (t.via === 'go') expect(t.to).not.toMatch(/^\/(session|walk\/live)/);
    }
    expect(actionTarget('join', ctx)).toEqual({ via: 'go', to: JOIN_HREF });
  });

  it('runAction starts only through `start`', () => {
    const fx = { start: vi.fn(), go: vi.fn(), status: vi.fn(), local: vi.fn() };
    runAction(actionTarget('anyway', ctx), fx);
    expect(fx.start).toHaveBeenCalledWith('stretch', ctx.href, 'Start stretch');
    expect(fx.go).not.toHaveBeenCalled();
    runAction(actionTarget('status', ctx), fx);
    expect(fx.status).toHaveBeenCalledTimes(1);
  });
});

describe('the smaller rules', () => {
  it('resumeAllowed: never while Away or Unwell, and only a stretch during a flare (A-34)', () => {
    expect(resumeAllowed('normal', 'guided')).toBe(true);
    expect(resumeAllowed('flare', 'stretch')).toBe(true);
    expect(resumeAllowed('flare', 'guided')).toBe(false);
    expect(resumeAllowed('unwell', 'stretch')).toBe(false);
    expect(resumeAllowed('away', 'stretch')).toBe(false);
  });

  it('restDayOf: a rest day, with its optional mobility when the plan has one', () => {
    expect(restDayOf({ kind: 'restDay', focus: 'rest' })).toEqual({ mobility: true });
    expect(restDayOf({ kind: 'none', focus: 'rest' })).toEqual({ mobility: false });
    expect(restDayOf({ kind: 'full', focus: 'upperA' })).toBeUndefined();
  });

  it('sessionParts: the blocks today’s session holds', () => {
    expect(sessionParts({ blockStarts: { mobility: 0, strength: 4, cardio: 12 } })).toBe('mobility, strength and cardio');
    expect(sessionParts({ blockStarts: { mobility: 0 } })).toBe('mobility');
    expect(sessionParts({ blockStarts: {} })).toBeUndefined();
  });

  it('stretchReason: only real inputs, and none for a routine the person chose (§8.3)', () => {
    const r = (over: Partial<Parameters<typeof stretchReason>[0]>) => stretchReason({ chosen: false, flare: false, focus: 'backHips', fromLast: false, ...over });
    expect(r({ chosen: true, flare: true })).toBeUndefined();
    expect(r({ flare: true })).toBe('Your back is in a flare-up, so this is the gentler routine.');
    expect(r({ yesterday: { pain: 3 } })).toBe('Your check-in yesterday said back pain 3 of 10.');
    expect(r({ yesterday: { pain: 0 } })).toBeUndefined();
    expect(r({ focus: 'hipsLegs', yesterday: { legPain: 2 } })).toBe('Your check-in yesterday said leg pain 2 of 10.');
    expect(r({ fromLast: true })).toBe('The routine you did last time.');
    expect(r({ focusSetting: 'stretch' })).toBe('You chose stretching as your focus.');
  });
});
```

The `focus: 'upperA'` in `restDayOf`'s test must be a real `DayFocus`. If it isn't, use any training-day focus from `src/types/plan.ts`.

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/screens/hub/movement.test.ts`
Expected: FAIL, "Cannot find module './movement'".

- [ ] **Step 3: Write** `src/screens/hub/movement.ts`

```ts
/**
 * A movement hub's Right now card (journey §7.5, "In its hub"; §8.3, §8.4).
 *
 * It reads the shared gate as Home's Right now card does (`gateOf`) and says
 * it in the tile's own words (`movementLine`), so a hub can never offer what
 * its tile or Home would refuse (§4.2, K-04, A-08). It decides nothing: an
 * action that could start movement is a `gate` target (`actionTarget`), which
 * the hub sends through `useStartMovement().start`, where the gate is asked
 * again at the tap.
 */
import { defaultStartLabel, headline } from '@/components/checkin/copy';
import type { Mode, Permission } from '@/engine/permission';
import { HREF, type Gate } from '@/health/recommend';
import type { Status } from '@/health/status';
import type { UserSettings } from '@/types';
import type { SessionPlan, StretchFocus } from '@/types/plan';
import type { TileLine } from '@/screens/home/tileLine';
import { startLabelFor } from '@/screens/today/model';

export type HubActionKind =
  | 'start' | 'continue' | 'review' | 'anyway' | 'mobility' | 'justWalk'
  | 'profile' | 'join' | 'stretch' | 'status' | 'otherTime';

export interface HubAction {
  kind: HubActionKind;
  label: string;
  /** Shown but not usable yet; the card's `note` says why. */
  disabled?: boolean;
}

export type CardState = 'go' | 'checkIn' | 'resume' | 'rest' | 'join' | 'held' | 'gap' | 'stopped' | 'paused';

export interface HubCard {
  state: CardState;
  tone: 'normal' | 'caution' | 'stop' | 'quiet';
  title: string;
  /** What it is: "mobility, strength and cardio", "6 min left · Back & hips stretch". */
  detail?: string;
  /** Today's word for it, when it adds something: "Gentle only today", "With changes for today". */
  today?: string;
  /** Why this, from real inputs only (D20). */
  reason?: string;
  /** The gate's own sentences while it refuses, said in a status region. */
  reasons: string[];
  release?: string;
  /** Allowed with changes: each one (§7.5, "Start, with the changes listed"). */
  restrictions: string[];
  primary?: HubAction;
  secondary: HubAction[];
  /** Under the primary button: "A short check-in comes first." */
  note?: string;
}

export interface CardInput {
  mode: Mode;
  /** The gate's answer for this mode now (`useStartMovement().permissionFor`). */
  permission: Permission;
  /** That answer read as Home's card reads it (`gateOf`). */
  gate: Gate;
  status: Status;
  /** The tile's line for this mode (`movementLine`), word for word. */
  line: TileLine;
  /** What is on offer: "Back & hips · 10 min", "Full Body B · 45 min", "Just a walk". */
  title: string;
  detail?: string;
  reason?: string;
  /** Unanswered profile questions, as the gate reads them (`profileGaps`). */
  gaps: { healthUnreviewed: boolean; medicinesUnknown: boolean };
  /** The stretch gate allows a start, or needs only a check-in: "Stretch instead" is honest. */
  stretchOpen: boolean;
  /** Workout: in the programme (D35). */
  enrolled?: boolean;
  /** Workout: today's session is the recovery one. */
  recovery?: boolean;
  /** Workout: today is a rest day; `mobility` when it offers the optional rest-day session. */
  rest?: { mobility: boolean };
  /** A run saved today that the status allows to continue (`resumeAllowed`). */
  saved?: { minutesLeft: number; label: string };
  /** Stretch: the routine can't be put together today, in the builder's words. */
  blocked?: string;
  /** The start waits for a choice on this screen, in words: "Choose the meal to start." */
  waiting?: string;
  /** Walk, B-09: "A walk after lunch" and "I had lunch at 1:10 pm: walk now". */
  afterMeal?: { title: string; label: string };
}

const REVIEW: HubAction = { kind: 'review', label: 'Review today’s check-in' };
const PAUSED: Record<'away' | 'unwell', string> = { away: 'Paused while you’re away', unwell: 'Paused while you’re unwell' };
const NOUN: Record<Mode, string> = { guided: 'session', stretch: 'stretch', walk: 'walk' };

/**
 * The card, in the copy table's order. A stop outranks status, and status
 * outranks the programme and every hold. A profile gap outranks the other
 * holds. Only then is anything offered (journey §7.5, as `movementLine`).
 */
export function movementCard(i: CardInput): HubCard {
  const p = i.permission;
  const empty = { reasons: [] as string[], restrictions: [] as string[], secondary: [] as HubAction[] };
  const refusal = { reasons: p.reasons, ...(p.release ? { release: p.release } : {}) };
  const instead: HubAction[] = i.mode !== 'stretch' && i.stretchOpen ? [{ kind: 'stretch', label: 'Stretch instead' }] : [];

  if (i.gate === 'emergency' || i.gate === 'today') {
    return { ...empty, ...refusal, state: 'stopped', tone: 'stop', title: headline(p).title, secondary: [REVIEW] };
  }
  if (i.status === 'away' || i.status === 'unwell') {
    return {
      ...empty, state: 'paused', tone: 'quiet', title: PAUSED[i.status], detail: i.title,
      primary: { kind: 'status', label: 'Change status' }, secondary: [{ kind: 'anyway', label: 'Start anyway' }],
    };
  }
  if (i.mode === 'guided' && i.enrolled === false) {
    const join: HubAction = { kind: 'join', label: 'Join the 12-week programme' };
    const flare = i.status === 'flare' && instead.length > 0;
    return {
      ...empty, state: 'join', tone: 'normal', title: 'The 12-week programme', detail: 'Not joined. Stretch and Walk work without it.',
      ...(flare ? { today: 'Stretch is suggested today', primary: instead[0], secondary: [join] } : { primary: join, secondary: instead }),
    };
  }
  if (!p.allowed && (i.gaps.healthUnreviewed || i.gaps.medicinesUnknown)) {
    const chapter = i.gaps.healthUnreviewed ? 'your health' : 'your medicines';
    return {
      // Home's card for the same gap (`profileFirst`), so the two never disagree.
      ...empty, ...refusal, state: 'gap', tone: 'caution', title: i.gaps.healthUnreviewed ? 'Finish your health profile' : 'Your diabetes medicines',
      primary: { kind: 'profile', label: `Answer the questions about ${chapter}` }, secondary: [REVIEW],
    };
  }
  if (i.gate === 'hold' || i.gate === 'recheck') {
    const recheck = i.gate === 'recheck';
    return {
      // The gate's own headline, as Home's card and the check-in say it; a re-check adds when it is due, in the tile's words.
      ...empty, ...refusal, state: 'held', tone: 'caution', title: headline(p).title, ...(recheck ? { detail: i.line.text } : {}),
      ...(recheck ? { primary: { kind: 'review', label: 'Enter a new reading' } as HubAction } : {}),
      secondary: [...(recheck ? [] : [REVIEW]), ...instead],
    };
  }
  if (i.blocked) {
    return { ...empty, state: 'held', tone: 'caution', title: i.title, reasons: [i.blocked] };
  }
  const go = i.gate === 'go';
  if (i.saved) {
    return {
      ...empty, state: 'resume', tone: 'normal', title: `Continue your ${NOUN[i.mode]}`, detail: `${i.saved.minutesLeft} min left · ${i.saved.label}`,
      reason: 'You stopped part-way through. It picks up where you left off.',
      primary: { kind: 'continue', label: go ? `Continue ${NOUN[i.mode]}` : 'Check in & continue' },
    };
  }
  if (i.rest) {
    return {
      ...empty, state: 'rest', tone: 'normal', title: 'Rest day', ...(i.detail ? { detail: i.detail } : {}),
      ...(instead.length > 0 ? { primary: instead[0] } : {}),
      secondary: i.rest.mobility ? [{ kind: 'mobility', label: 'Start rest-day mobility' }] : [],
    };
  }
  // A flare's own words, as on the tile; the button already says a check-in comes first.
  const flare = i.status !== 'flare' ? undefined : i.mode === 'walk' ? 'Stretch is suggested today' : i.line.text.replace(/ · check in first$/, '');
  const changed = go && p.disposition === 'adjust' && p.restrictions.length > 0;
  const label = i.afterMeal?.label ?? (go ? defaultStartLabel(i.mode, i.recovery === true) : 'Check in & start');
  const note = i.waiting ?? (i.afterMeal && !go ? 'A short check-in comes first.' : undefined);
  return {
    ...empty, state: go ? 'go' : 'checkIn', tone: 'normal', title: i.afterMeal?.title ?? i.title,
    ...(i.detail ? { detail: i.detail } : {}),
    ...(flare ? { today: flare } : changed ? { today: 'With changes for today' } : {}),
    ...(i.reason ? { reason: i.reason } : {}),
    restrictions: changed ? p.restrictions : [],
    primary: { kind: 'start', label, ...(i.waiting ? { disabled: true } : {}) },
    ...(note ? { note } : {}),
    secondary: [
      ...(i.afterMeal ? [{ kind: 'otherTime', label: 'Different time' } as HubAction, { kind: 'justWalk', label: 'Just a walk' } as HubAction] : []),
      ...(i.status === 'flare' ? instead : []),
    ],
  };
}

/** Where a card's action leads. Only `gate` targets can start movement, and only through `start`. */
export type ActionTarget =
  | { via: 'gate'; mode: Mode; href: string; label: string }
  | { via: 'go'; to: string }
  | { via: 'status' }
  | { via: 'local' };

export interface ActionContext {
  mode: Mode;
  /** Where Start leads once the gate allows it: the player, or the live walk for what is chosen. */
  href: string;
  /** The check-in sheet's Start, when the gate asks for a check-in first. */
  startLabel: string;
  /** A saved run's own address (`resumeHref`). */
  resumeHref?: string;
  /** Walk: an ordinary walk's address, for "Just a walk". */
  plainHref?: string;
  recovery?: boolean;
}

/** The Workout hub's Join: the programme's own flow, opened at once (D35). */
export const JOIN_HREF = '/hub/workout/plan?join=1';

export function actionTarget(kind: HubActionKind, c: ActionContext): ActionTarget {
  switch (kind) {
    case 'start':
    case 'review':
    case 'anyway':
      return { via: 'gate', mode: c.mode, href: c.href, label: c.startLabel };
    case 'continue': {
      const href = c.resumeHref ?? c.href;
      return { via: 'gate', mode: c.mode, href, label: startLabelFor(c.mode, href, c.recovery === true) };
    }
    case 'mobility':
      return { via: 'gate', mode: 'guided', href: HREF.guided, label: defaultStartLabel('guided', false) };
    case 'justWalk':
      return { via: 'gate', mode: 'walk', href: c.plainHref ?? c.href, label: c.startLabel };
    case 'profile':
      return { via: 'go', to: HREF.profile };
    case 'join':
      return { via: 'go', to: JOIN_HREF };
    case 'stretch':
      return { via: 'go', to: HREF.stretch };
    case 'status':
      return { via: 'status' };
    case 'otherTime':
      return { via: 'local' };
  }
}

/** Carry a target out. A start goes only through `start`, which asks the gate at the tap (§4.1). */
export function runAction(t: ActionTarget, fx: {
  start: (mode: Mode, href: string, label: string) => void;
  go: (to: string) => void;
  status: () => void;
  local: () => void;
}): void {
  if (t.via === 'gate') fx.start(t.mode, t.href, t.label);
  else if (t.via === 'go') fx.go(t.to);
  else if (t.via === 'status') fx.status();
  else fx.local();
}

/** Whether a run saved today may be carried on under this status, as `recommend` offers it (A-34): never while Away or Unwell, and only a stretch during a flare. */
export function resumeAllowed(status: Status, mode: Mode): boolean {
  if (status === 'away' || status === 'unwell') return false;
  return status !== 'flare' || mode === 'stretch';
}

/** Today is the programme's rest day; `mobility` when the plan offers the optional rest-day session. */
export function restDayOf(plan: Pick<SessionPlan, 'kind' | 'focus'>): { mobility: boolean } | undefined {
  if (plan.kind === 'restDay') return { mobility: true };
  if (plan.kind === 'none' && plan.focus === 'rest') return { mobility: false };
  return undefined;
}

/** "mobility, strength and cardio": the blocks today's session holds (journey §8.3). */
export function sessionParts(plan: Pick<SessionPlan, 'blockStarts'>): string | undefined {
  const names = (['mobility', 'strength', 'cardio'] as const).filter(b => plan.blockStarts[b] !== undefined);
  if (names.length === 0) return undefined;
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * Why this routine, from real inputs only (journey §8.3): a flare that makes
 * it the gentler one, yesterday's own pain answer for the area it serves, the
 * routine last done, or the focus chosen in setup. Nothing for a routine the
 * person picked themselves, and nothing invented.
 */
export function stretchReason({ chosen, flare, focus, yesterday, fromLast, focusSetting }: {
  chosen: boolean;
  /** A flare-up with a back history: the builder makes it the gentler routine. */
  flare: boolean;
  focus: StretchFocus;
  /** Yesterday's check-in's back answers, when there was one. */
  yesterday?: { pain?: number; legPain?: number };
  /** A stretch is on record, so the routine is the one last done (`lastStretch`). */
  fromLast: boolean;
  focusSetting?: UserSettings['focus'];
}): string | undefined {
  if (chosen) return undefined;
  if (flare) return 'Your back is in a flare-up, so this is the gentler routine.';
  const back = yesterday?.pain ?? 0;
  const leg = yesterday?.legPain ?? 0;
  if (focus === 'backHips' && back >= 1) return `Your check-in yesterday said back pain ${back} of 10.`;
  if (focus === 'hipsLegs' && leg >= 1) return `Your check-in yesterday said leg pain ${leg} of 10.`;
  if (fromLast) return 'The routine you did last time.';
  if (focusSetting === 'stretch') return 'You chose stretching as your focus.';
  return undefined;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/screens/hub/movement.test.ts`
Expected: PASS.

- [ ] **Step 5: Write** `src/screens/hub/hooks.ts`

```ts
/**
 * What every movement hub asks of the app, once (journey §4.2, §7.5): the
 * shared gate for its mode, read as Home's card reads it (`gateOf`); the
 * tile's own words for it (`movementLine`, called exactly as Home's `lineOf`
 * calls it); status and enrolment; and the one way to start
 * (`useStartMovement`). Worked out again at each time boundary, as Home is,
 * so the words never go stale (L-07, B-20).
 */
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { useStartMovement } from '@/components/checkin/useStartMovement';
import { profileGaps } from '@/engine/health';
import type { Mode } from '@/engine/permission';
import { gateOf, isEnrolled, nextBoundary, recommend } from '@/health/recommend';
import { periodOn, type Status } from '@/health/status';
import { useGuided } from '@/hooks/useGuided';
import { prefersHour12 } from '@/lib/time';
import { normalLine } from '@/screens/home/model';
import { movementLine } from '@/screens/home/tileLine';
import { recommendSources, withEffectiveToday } from '@/screens/home/urgent';
import { useClock, useWakeAt } from '@/screens/today/clock';
import { useStore } from '@/store/useStore';

/** The device's clock preference does not change while the app is open. */
const HOUR12 = prefersHour12();

export function useHubGate(mode: Mode) {
  const state = useStore();
  const guided = useGuided();
  const { start, sheet, permissionFor } = useStartMovement();
  const { now } = useClock();
  const checkIns = useMemo(() => withEffectiveToday(state.checkIns, guided.checkIn), [state.checkIns, guided.checkIn]);
  useWakeAt(nextBoundary(now, { ...(guided.checkIn ? { checkIn: guided.checkIn } : {}), ...(state.settings.habits ? { habits: state.settings.habits } : {}) }));
  const permissions = { guided: permissionFor('guided'), stretch: permissionFor('stretch'), walk: permissionFor('walk') };
  const today = format(now, 'yyyy-MM-dd');
  const status: Status = periodOn(state.settings.statusPeriods, today)?.kind ?? 'normal';
  const enrolled = isEnrolled(state.settings, state.profile);
  const gaps = profileGaps(guided.profile);
  const profileGap = gaps.healthUnreviewed || gaps.medicinesUnknown;
  const recommendation = recommend({ ...recommendSources({ now, state, plan: guided.plan, checkIns }), permissions });
  const gate = gateOf(permissions[mode], guided.checkIn, profileGap);
  const stretchGate = gateOf(permissions.stretch, guided.checkIn, profileGap);
  const recheckAt = guided.checkIn?.readiness.recheckAt;
  const line = movementLine({
    mode, permission: permissions[mode], status, enrolled, normal: normalLine(mode, { recommendation, enrolled, plan: guided.plan }),
    ...(recheckAt ? { recheckAt } : {}), now, hour12: HOUR12,
  });
  return {
    guided, state, now, today, status, enrolled, gaps, gate, line, recommendation, start, sheet, hour12: HOUR12,
    permission: permissions[mode],
    stretchOpen: stretchGate === 'go' || stretchGate === 'checkIn',
  };
}

/** Where a hub's rows say they were opened from, so the screen each opens goes Back to this hub, named after it. */
export function useHubOrigin(label: string): { path: string; label: string; search?: string } {
  const { pathname, search } = useLocation();
  return { path: pathname, label, ...(search ? { search } : {}) };
}
```

Compare the `movementLine({...})` call with `HomeScreen`'s `lineOf` (`grep -n "movementLine({" -A 3 src/screens/home/HomeScreen.tsx`). If Home passes another argument, pass it here too.

`useStartMovement` already wakes at `nextBoundary(now, { checkIn })`, so `permissionFor` is asked again when a reading goes stale (c9948de). The hub's own `useWakeAt` adds the meal-walk habits' boundaries, which the recommendation's words follow. Two timers for one moment do no harm.

- [ ] **Step 6: Write** `src/screens/hub/MovementCard.tsx`

```tsx
import { SirenIcon, TriangleAlertIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HubSection } from './HubFrame';
import type { HubActionKind, HubCard } from './movement';

/**
 * A movement hub's Right now card (journey §8.2): what is on offer and why,
 * or, while the gate refuses, its words and the safe action (§7.5). The gate's
 * sentences sit in a status region. Urgent ink and the safe action are there
 * in the first frame, with no entrance (motion rule 2). One primary action,
 * at least 60 px tall; the quieter ones at least 48 px.
 */
export function MovementCard({ card, onAction }: { card: HubCard; onAction: (kind: HubActionKind) => void }) {
  const Icon = card.tone === 'stop' ? SirenIcon : card.tone === 'caution' ? TriangleAlertIcon : undefined;
  const primary = card.primary;
  return (
    <HubSection title="Right now">
      <div data-hub-card={card.state} className="flex flex-col gap-3 rounded-2xl bg-grouped-card p-4">
        <h3 className={cn(
          'flex items-start gap-2 text-[length:var(--text-title-2)] font-bold leading-tight [overflow-wrap:break-word]',
          card.tone === 'stop' && 'text-stop', card.tone === 'caution' && 'text-caution',
        )}>
          {Icon && <Icon className="mt-0.5 size-6 shrink-0" aria-hidden />}
          <span className="min-w-0">{card.title}</span>
        </h3>
        {card.detail && <p className="text-[length:var(--text-subhead)] leading-snug text-muted-foreground [overflow-wrap:break-word]">{card.detail}</p>}
        {card.today && <p className="text-[length:var(--text-body)] font-medium leading-snug [overflow-wrap:break-word]">{card.today}</p>}
        {card.reason && (
          <p className="text-[length:var(--text-subhead)] leading-snug [overflow-wrap:break-word]">
            <span className="font-semibold">Why this? </span>{card.reason}
          </p>
        )}
        {(card.reasons.length > 0 || card.release) && (
          <div role="status" className="flex flex-col gap-2 text-[length:var(--text-body)] leading-snug [overflow-wrap:break-word]">
            {card.reasons.map(r => <p key={r}>{r}</p>)}
            {card.release && <p className="text-muted-foreground">{card.release}</p>}
          </div>
        )}
        {card.restrictions.length > 0 && (
          <ul aria-label="Changes for today" className="flex list-disc flex-col gap-1.5 pl-5 text-[length:var(--text-body)] leading-snug">
            {card.restrictions.map(r => <li key={r}>{r}</li>)}
          </ul>
        )}
        {primary && (
          <button
            type="button"
            disabled={primary.disabled}
            onClick={() => onAction(primary.kind)}
            className="press-feedback flex min-h-[60px] w-full items-center justify-center rounded-xl bg-tint px-4 text-center text-[length:var(--text-body)] font-semibold text-on-tint disabled:opacity-50"
          >
            {primary.label}
          </button>
        )}
        {card.note && <p className="text-center text-[length:var(--text-footnote)] leading-snug text-muted-foreground">{card.note}</p>}
        {card.secondary.map(a => (
          <button
            key={a.kind}
            type="button"
            onClick={() => onAction(a.kind)}
            className="press-feedback flex min-h-12 w-full items-center justify-center rounded-xl bg-tint/10 px-4 text-center text-[length:var(--text-body)] font-semibold text-tint"
          >
            {a.label}
          </button>
        ))}
      </div>
    </HubSection>
  );
}
```

- [ ] **Step 7: Write the caller test** `src/screens/hub/MovementCard.callers.test.ts`

```ts
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

  it('a Start that waits for a choice cannot be pressed, and says why', () => {
    const host = render(createElement(MovementCard, {
      card: card({ primary: { kind: 'start', label: 'Start walk', disabled: true }, note: 'Choose the meal to start.' }),
      onAction: vi.fn(),
    }));
    expect(host.button('Start walk').props.disabled).toBe(true);
    expect(host.text()).toContain('Choose the meal to start.');
  });
});
```

Run: `npx vitest run src/screens/hub/MovementCard.callers.test.ts`
Expected: PASS.

- [ ] **Step 8: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/hub/movement.ts src/screens/hub/movement.test.ts src/screens/hub/hooks.ts src/screens/hub/MovementCard.tsx src/screens/hub/MovementCard.callers.test.ts
git commit -m "feat: Read a movement hub's Right now from the shared gate, in the tile's words"
```

---

### Task 5: This week and History for the movement hubs

**Files:**
- Create: `src/screens/hub/week.ts`
- Create: `src/screens/hub/week.test.ts`
- Create: `src/screens/hub/WeekStrip.tsx`
- Create: `src/screens/hub/HistoryList.tsx`

**Interfaces:**
- Produces, in `week.ts`:
  - `type HubDayState = 'done' | 'rest' | 'status' | 'none'`;
  - `interface HubDay { day; letter; name; state; words; today; future }`;
  - `modeWeek(i: { mode: Mode; today: string; sessions; observations; statusPeriods?; programme?: readonly WeekDay[] }): HubDay[]`;
  - `goalLine(minutes: number, goal: number | undefined): { text: string; reached: boolean }`;
  - `interface HistoryRow { key: string; label: string; detail: string; ref: RecordRef; at: string }`;
  - `movementHistory(mode, sessions, observations, prefs, current): HistoryRow[]`.
- Produces `WeekStrip({ days, goal })`.
- Produces `HistoryList({ rows: readonly { key; label: ReactNode; detail?: ReactNode; ref: RecordRef; ids?: readonly string[] }[]; origin; empty; title?; fresh?: readonly string[] })`. A row whose `ids` include one in `fresh` shows v1's brief highlight (M16).
- Consumes:
  - `weekView`, `STATUS_TEXT` and `type WeekDay` (`@/screens/move/plan`);
  - `activitiesFrom` and `isProgrammeSession` (`@/health/recommend`);
  - `walkRecords` (`@/walk/record`);
  - `statusOn` and `STATUS_LABEL` (`@/health/status`);
  - `recordPath` (`@/screens/track/timeline`);
  - `tileColumns` (`@/screens/home/model`);
  - `scaleFromRoot` (`@/lib/textSize`);
  - `stripLayout` and `HISTORY_PREVIEW` (Task 3).

- [ ] **Step 1: Write the failing test** `src/screens/hub/week.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from '@/types';
import { newObservation } from '@/health/observation';
import { DEFAULT_PREFS } from '@/screens/track/format';
import { goalLine, modeWeek, movementHistory } from './week';

// Thursday 8 October 2026; the week runs from Monday 5 to Sunday 11 October.
const TODAY = '2026-10-08';
const session = (over: Partial<WorkoutSession>): WorkoutSession => ({
  id: 's', date: '2026-10-06', dayOfWeek: 'tuesday', muscleGroup: 'fullBody', phase: 'foundation', week: 1,
  status: 'completed', sets: [], startedAt: '2026-10-06T07:30:00+05:30', ...over,
} as WorkoutSession);
const stretch = session({ id: 'st1', planKind: 'stretch', planId: 'stretch:2026-10-06:backHips:10:green:', guided: true });
const walk = [
  newObservation({ id: 'w1d', kind: 'walkDuration', value: 12, unit: 'min', scope: 'sessionObserved', source: 'measured', at: '2026-10-07T07:40:00.000+05:30', context: 'walk:w1', coverageMs: 720000 }),
  newObservation({ id: 'w1m', kind: 'movementMinutes', value: 12, unit: 'min', scope: 'sessionObserved', source: 'measured', at: '2026-10-07T07:40:00.000+05:30', context: 'walk:w1', coverageMs: 720000 }),
];

describe('modeWeek (journey §8.2, This week)', () => {
  it('stretch: the days with a stretch, a status day, and days still to come, Monday first', () => {
    const days = modeWeek({ mode: 'stretch', today: TODAY, sessions: [stretch], observations: [], statusPeriods: [{ kind: 'flare', from: '2026-10-05', to: '2026-10-05' }] });
    expect(days.map(d => d.letter)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    expect(days[0]).toMatchObject({ name: 'Monday', state: 'status', words: 'Flare-up' });
    expect(days[1]).toMatchObject({ state: 'done', words: 'Stretched' });
    expect(days[2]).toMatchObject({ state: 'none', words: 'No stretch' });
    expect(days[3]).toMatchObject({ today: true, future: false });
    expect(days[4]).toMatchObject({ future: true, words: 'Still to come' });
  });

  it('walk: the minutes walked on the day the walk started', () => {
    const days = modeWeek({ mode: 'walk', today: TODAY, sessions: [], observations: walk });
    expect(days[2]).toMatchObject({ state: 'done', words: '12 min walked' });
    expect(days[1].words).toBe('No walk');
  });

  it('workout outside the programme: a day with a recorded workout is done', () => {
    const days = modeWeek({ mode: 'guided', today: TODAY, sessions: [session({ id: 'g1', planKind: 'full', guided: true })], observations: [] });
    expect(days[1]).toMatchObject({ state: 'done', words: 'Done' });
    expect(days[2].words).toBe('No workout');
  });

  it('workout in the programme: the week as Your plan counts it, rest days marked', () => {
    const programme = [
      { date: '2026-10-05', day: 'monday', isToday: false, focus: 'upperA', status: 'done' },
      { date: '2026-10-06', day: 'tuesday', isToday: false, focus: 'rest', status: 'rest' },
    ] as Parameters<typeof modeWeek>[0]['programme'];
    const days = modeWeek({ mode: 'guided', today: TODAY, sessions: [], observations: [], programme });
    expect(days[0]).toMatchObject({ state: 'done', words: 'Done' });
    expect(days[1]).toMatchObject({ state: 'rest', words: 'Rest' });
  });
});

describe('goalLine (D31, B-16)', () => {
  it('reads against the week’s goal, or plainly with none', () => {
    expect(goalLine(64, 150)).toEqual({ text: '64 of 150 min this week', reached: false });
    expect(goalLine(150, 150).reached).toBe(true);
    expect(goalLine(64, undefined)).toEqual({ text: '64 min moved this week', reached: false });
  });
});

describe('movementHistory (journey §8.2, History)', () => {
  it('stretches, newest first, each opening its own record', () => {
    const older = { ...stretch, id: 'st0', date: '2026-10-01', startedAt: '2026-10-01T07:30:00+05:30' };
    const rows = movementHistory('stretch', [older, stretch, session({ id: 'g1', planKind: 'full', guided: true })], [], DEFAULT_PREFS, TODAY);
    expect(rows.map(r => r.key)).toEqual(['session:st1', 'session:st0']);
    expect(rows[0]).toMatchObject({ label: 'Back & hips · 10 min', ref: { type: 'session', id: 'st1' } });
    expect(rows[0].detail).toMatch(/^Tue 6 Oct · Completed/);
  });

  it('walks: one row a walk, with its minutes', () => {
    const rows = movementHistory('walk', [], walk, DEFAULT_PREFS, TODAY);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: 'walk:w1', label: '12 min', ref: { type: 'walk', id: 'w1' } });
  });

  it('workouts: programme sessions only, never a stretch, and a hand-logged one opens the Workout Log', () => {
    const logged = session({ id: 'm1', guided: false, planKind: 'full' });
    const rows = movementHistory('guided', [stretch, logged], [], DEFAULT_PREFS, TODAY);
    expect(rows.map(r => r.ref)).toEqual([{ type: 'workout', id: 'm1' }]);
  });
});
```

The fixtures follow v1's types. If `WorkoutSession` or `newObservation` needs another field, add the smallest valid value, and keep each test's intent. Find an existing fixture with `grep -rn "planKind: 'stretch'" src --include=*.test.ts | head`.

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/screens/hub/week.test.ts`
Expected: FAIL, "Cannot find module './week'".

- [ ] **Step 3: Write** `src/screens/hub/week.ts`

```ts
/**
 * A movement hub's This week and History (journey §8.2):
 * - the Monday–Sunday strip for the hub's own mode;
 * - the week's minutes against this week's goal (B-16);
 * - the last entries, each a way to its record, where it is corrected.
 * Plain functions over the records, using the same counts as Home and
 * Today's log.
 */
import { format } from 'date-fns';
import type { StatusPeriod, WorkoutSession } from '@/types';
import type { Mode } from '@/engine/permission';
import { STRETCH_FOCUS_LABEL, specFromPlanId } from '@/engine/stretch';
import type { Observation } from '@/health/observation';
import { activitiesFrom, isProgrammeSession } from '@/health/recommend';
import { STATUS_LABEL, statusOn } from '@/health/status';
import { STATUS_TEXT, type WeekDay } from '@/screens/move/plan';
import { formatClock, formatObservation, tagLabel, type DisplayPrefs } from '@/screens/track/format';
import { addDays, weekOf } from '@/screens/track/periods';
import type { RecordRef } from '@/screens/track/timeline';
import { STATUS_LABEL as SESSION_STATUS, sessionTitle, sourceLabel as sessionSource } from '@/screens/workout/summary';
import { walkRecords } from '@/walk/record';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const NOTHING: Record<Mode, string> = { guided: 'No workout', stretch: 'No stretch', walk: 'No walk' };

export type HubDayState = 'done' | 'rest' | 'status' | 'none';

export interface HubDay {
  day: string;
  /** "M", "T", …: the strip's visible label. */
  letter: string;
  /** "Monday": for the list, and for a screen reader before the words. */
  name: string;
  state: HubDayState;
  /** What the day holds, in words, never colour alone: "Done", "Stretched", "12 min walked", "Rest", "Flare-up". */
  words: string;
  today: boolean;
  future: boolean;
}

const did = (s: WorkoutSession) => s.status === 'completed' || s.status === 'partial';

export function modeWeek({ mode, today, sessions, observations, statusPeriods, programme }: {
  mode: Mode;
  today: string;
  sessions: readonly WorkoutSession[];
  observations: readonly Observation[];
  statusPeriods?: readonly StatusPeriod[];
  /** Workout, in the programme: the week as Your plan counts it (`weekView`). */
  programme?: readonly WeekDay[];
}): HubDay[] {
  const { from } = weekOf(today);
  const stretched = new Set(activitiesFrom(sessions, []).filter(a => a.mode === 'stretch').map(a => a.day));
  const walked = new Map<string, number>();
  for (const w of walkRecords(observations)) walked.set(w.day, (walked.get(w.day) ?? 0) + w.minutes);
  return LETTERS.map((letter, i): HubDay => {
    const day = addDays(from, i);
    const future = day > today;
    const base = { day, letter, name: NAMES[i], today: day === today, future };
    const planned = mode === 'guided' ? programme?.find(p => p.date === day) : undefined;
    if (planned) {
      const s = planned.status;
      const state: HubDayState = s === 'done' || s === 'partial' || s === 'recovery' ? 'done'
        : s === 'rest' ? 'rest' : s === 'flare' || s === 'unwell' || s === 'away' ? 'status' : 'none';
      return { ...base, state, words: STATUS_TEXT[s] };
    }
    if (mode === 'guided' && sessions.some(s => s.date === day && isProgrammeSession(s) && did(s))) return { ...base, state: 'done', words: 'Done' };
    if (mode === 'stretch' && stretched.has(day)) return { ...base, state: 'done', words: 'Stretched' };
    const minutes = mode === 'walk' ? walked.get(day) ?? 0 : 0;
    if (minutes > 0) return { ...base, state: 'done', words: `${Math.round(minutes)} min walked` };
    const status = statusOn(statusPeriods, day);
    if (status !== 'normal') return { ...base, state: 'status', words: STATUS_LABEL[status] };
    return { ...base, state: 'none', words: future ? 'Still to come' : NOTHING[mode] };
  });
}

/** "64 of 150 min this week", or "64 min moved this week" with no goal (D31). */
export function goalLine(minutes: number, goal: number | undefined): { text: string; reached: boolean } {
  if (goal === undefined) return { text: `${minutes} min moved this week`, reached: false };
  return { text: `${minutes} of ${goal} min this week`, reached: minutes >= goal };
}

export interface HistoryRow {
  key: string;
  label: string;
  detail: string;
  ref: RecordRef;
  /** When it happened, for newest-first order. */
  at: string;
}

const join = (...parts: (string | undefined | false)[]) => parts.filter((p): p is string => !!p).join(' · ');
function dayLabel(day: string, current: string): string {
  return format(new Date(`${day}T12:00:00`), day.slice(0, 4) === current.slice(0, 4) ? 'EEE d MMM' : 'EEE d MMM yyyy');
}
const isStretch = (s: WorkoutSession) => s.planKind === 'stretch' || (s.planId?.startsWith('stretch:') ?? false);
const newest = (a: { at: string }, b: { at: string }) => Date.parse(b.at) - Date.parse(a.at);

/** The hub's records, newest first, each opening its record, where it can be corrected. */
export function movementHistory(
  mode: Mode, sessions: readonly WorkoutSession[], observations: readonly Observation[], prefs: DisplayPrefs, current: string,
): HistoryRow[] {
  if (mode === 'walk') {
    return walkRecords(observations).map(w => ({
      key: `walk:${w.id}`,
      label: formatObservation({ kind: 'walkDuration', value: w.minutes, unit: 'min' }, prefs),
      detail: join(
        dayLabel(w.day, current), formatClock(w.at, prefs.hour12), w.mealStartedAt !== undefined && tagLabel('afterMeal'),
        w.distanceKm !== undefined && formatObservation({ kind: 'walkDistance', value: w.distanceKm, unit: 'km' }, prefs),
      ),
      ref: { type: 'walk' as const, id: w.id },
      at: w.at,
    })).sort(newest);
  }
  return sessions
    .filter(s => s.status !== 'not_started' && (mode === 'stretch' ? isStretch(s) : isProgrammeSession(s)))
    .map(s => {
      const spec = mode === 'stretch' ? specFromPlanId(s.planId) : null;
      return {
        key: `session:${s.id}`,
        label: spec ? `${STRETCH_FOCUS_LABEL[spec.focus]} · ${spec.minutes} min` : sessionTitle(s),
        detail: join(dayLabel(s.date, current), SESSION_STATUS[s.status], mode === 'guided' && sessionSource(s)),
        // As Today's log opens them: a guided run's summary, or a hand-logged workout in the Workout Log.
        ref: s.guided ? { type: 'session' as const, id: s.id } : { type: 'workout' as const, id: s.id },
        at: s.startedAt ?? `${s.date}T12:00:00`,
      };
    })
    .sort(newest);
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/screens/hub/week.test.ts`
Expected: PASS.

- [ ] **Step 5: Write** `src/screens/hub/WeekStrip.tsx`

```tsx
import { useSyncExternalStore } from 'react';
import { scaleFromRoot } from '@/lib/textSize';
import { cn } from '@/lib/utils';
import { tileColumns } from '@/screens/home/model';
import { stripLayout } from './frame';
import { HubSection } from './HubFrame';
import type { HubDay } from './week';

/** How each day is marked; the words beside or under it always say it too (journey §20.3). */
const MARK: Record<HubDay['state'], string> = {
  done: 'bg-cat-move text-white',
  rest: 'border border-separator text-muted-foreground',
  status: 'border-2 border-dashed border-muted-foreground/60',
  none: 'border border-separator',
};

function columnsNow() {
  return tileColumns({ width: window.innerWidth, scale: scaleFromRoot(parseFloat(getComputedStyle(document.documentElement).fontSize)) });
}
function onResize(changed: () => void): () => void {
  window.addEventListener('resize', changed);
  document.addEventListener('visibilitychange', changed);
  return () => {
    window.removeEventListener('resize', changed);
    document.removeEventListener('visibilitychange', changed);
  };
}

/**
 * This week (journey §8.2): the week's minutes against this week's goal, and
 * the Monday–Sunday strip for the hub's mode. Below 375 px, or above 130%
 * text, the strip becomes seven rows (K-42).
 */
export function WeekStrip({ days, goal }: { days: readonly HubDay[]; goal: { text: string; reached: boolean } }) {
  const layout = stripLayout(useSyncExternalStore(onResize, columnsNow, () => 1 as const));
  return (
    <HubSection title="This week">
      <div className="flex flex-col gap-3 rounded-2xl bg-grouped-card p-4">
        <p className="text-[length:var(--text-body)] font-semibold leading-snug">{goal.text}</p>
        {goal.reached && <p className="text-[length:var(--text-subhead)] leading-snug">Weekly goal reached</p>}
        {layout === 'strip' ? (
          <ol aria-label="Days this week" className="grid grid-cols-7 gap-1">
            {days.map(d => (
              <li key={d.day} aria-current={d.today ? 'date' : undefined} className="flex flex-col items-center gap-1">
                <span aria-hidden className={cn('text-[length:var(--text-footnote)] font-medium text-muted-foreground', d.today && 'text-foreground')}>{d.letter}</span>
                <span aria-hidden className={cn('flex size-7 items-center justify-center rounded-full text-[length:var(--text-footnote)] font-semibold', MARK[d.state])}>
                  {d.state === 'rest' ? 'R' : ''}
                </span>
                <span className="sr-only">{d.name}: {d.words}</span>
              </li>
            ))}
          </ol>
        ) : (
          <ul aria-label="Days this week" className="flex flex-col [&>*+*]:border-t [&>*+*]:border-separator">
            {days.map(d => (
              <li key={d.day} aria-current={d.today ? 'date' : undefined} className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 py-2">
                <span className={cn('text-[length:var(--text-body)]', d.today && 'font-semibold')}>{d.name}</span>
                <span className="text-[length:var(--text-subhead)] text-muted-foreground">{d.words}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </HubSection>
  );
}
```

`--cat-move` is Plan 1's Move colour, registered for Tailwind as `bg-cat-move`. If the class is missing, use `bg-tint` and log the swap on the board.

- [ ] **Step 6: Write** `src/screens/hub/HistoryList.tsx`

```tsx
import { useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Link } from 'react-router-dom';
import { Group, Row } from '@/components/hig/List';
import { recordPath, type RecordRef } from '@/screens/track/timeline';
import { HISTORY_PREVIEW } from './frame';
import { HubSection } from './HubFrame';

/**
 * History (journey §8.2): the last three entries, then "Show all". Each row
 * opens its record, where it is corrected or deleted with Undo (§13, B-04);
 * the record's Back returns here. A record just saved here shows with v1's
 * brief highlight that fades (M16).
 */
export function HistoryList({ rows, origin, empty, title = 'History', fresh = [] }: {
  rows: readonly { key: string; label: ReactNode; detail?: ReactNode; ref: RecordRef; ids?: readonly string[] }[];
  origin: { path: string; label: string; search?: string };
  /** What an empty history says ("No stretches yet. Each one shows here."). */
  empty: string;
  title?: string;
  /** The ids just saved from this hub (`SavedResult.ids`). */
  fresh?: readonly string[];
}) {
  const [all, setAll] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const shown = all ? rows : rows.slice(0, HISTORY_PREVIEW);
  // The first newly shown row takes the focus, so the button going doesn't drop it.
  const expand = () => {
    flushSync(() => setAll(true));
    list.current?.querySelectorAll<HTMLElement>('a[href]')[HISTORY_PREVIEW]?.focus();
  };
  return (
    <HubSection title={title}>
      {rows.length === 0 ? (
        <p className="px-4 text-[length:var(--text-body)] leading-snug text-muted-foreground">{empty}</p>
      ) : (
        <div ref={list}>
          <Group>
            {shown.map(r => {
              const isNew = r.ids?.some(id => fresh.includes(id)) ?? false;
              const label = isNew ? <span className="inline-block animate-in fade-in zoom-in-110 duration-500">{r.label}</span> : r.label;
              return <Row key={r.key} as={Link} to={recordPath(r.ref)} state={origin} viewTransition label={label} detail={r.detail} chevron />;
            })}
            {!all && rows.length > HISTORY_PREVIEW && <Row label={<span className="text-tint">Show all {rows.length}</span>} onClick={expand} />}
          </Group>
        </div>
      )}
    </HubSection>
  );
}
```

- [ ] **Step 7: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/hub/week.ts src/screens/hub/week.test.ts src/screens/hub/WeekStrip.tsx src/screens/hub/HistoryList.tsx
git commit -m "feat: Show a movement hub's week against its goal, and its history"
```

---
### Task 6: The Workout hub, its pages and the Workout Log at its own address

**Files:**
- Create: `src/screens/hub/WorkoutHub.tsx`
- Modify: `src/screens/move/routes.tsx` (the hub at the index; v1's `MoveHome` goes)
- Modify: `src/screens/move/PlanScreen.tsx` (`?join=1` opens Join; Back says "Workout")
- Modify: `src/screens/move/ExercisesScreen.tsx`, `src/screens/move/ExerciseScreen.tsx` (links at `/hub/workout/exercises/…`; Back says "Workout")
- Modify: `src/screens/workout/TodayWorkoutScreen.tsx` (Back to the Workout hub)
- Modify: `src/screens/workout/RecordScreen.tsx` (its links to the log)
- Modify: `src/screens/track/QuickLog.tsx` (the Workout row opens the log)
- Modify: `src/screens/track/routes.tsx` (comment only)
- Modify: `src/redirects.ts`, `src/redirects.test.ts` (`/track/workout` → `/hub/workout/log`, B-14)
- Modify: `src/routes.tsx` (`/hub/workout/log/*`; `/trends/workout` → `/trends`)

**Interfaces:**
- Consumes:
  - `useHubGate`, `useHubOrigin`, `movementCard`, `actionTarget`, `runAction`, `restDayOf`, `resumeAllowed`, `sessionParts` and `MovementCard` (Task 4);
  - `modeWeek`, `goalLine`, `movementHistory`, `WeekStrip` and `HistoryList` (Task 5);
  - `HubFrame`, `HubSection` and `SeeTrends` (Task 3);
  - `weeklyGoalOn`, `pendingWeeklyGoal` and `GoalSheet` (Task 2);
  - `workoutNormal` (`@/screens/home/tileLine`);
  - `weekView` and `programmeWeek` (`@/screens/move/plan`);
  - `weekMovement` (`@/screens/today/model`);
  - `StatusSheet`;
  - `savedRun` and `resumeHref`;
  - `loadProgress` and `minutesLeft`.
- Produces:
  - `WorkoutHub` (default export), at `/hub/workout`;
  - the address `/hub/workout/log`, for the v1 Workout Log (`TodayWorkoutScreen`).

- [ ] **Step 1: The redirect first, as a failing test.** In `src/redirects.test.ts`:
  - change the case `['/track/workout', '', '/trends/workout']` to `['/track/workout', '', '/hub/workout/log']`;
  - change `['/workout', '', '/trends/workout']` to `['/workout', '', '/hub/workout/log']`;
  - in the query test, expect `/hub/workout/log?date=2026-10-05` for both `/track/workout?date=…` and `/workout?date=…`.

Run: `npx vitest run src/redirects.test.ts`
Expected: FAIL on those three cases.

- [ ] **Step 2: Make it pass.** In `src/redirects.ts`, replace the `/track/workout` line with:

```ts
  // v1's Workout Log was its logging screen: logging a workout is the Workout hub's, its trend Trends' (B-14).
  if (p === '/track/workout') return keep('/hub/workout/log', search);
```

Run: `npx vitest run src/redirects.test.ts`
Expected: PASS.

- [ ] **Step 3: Mount the log and stop the trend's interim showing it.** In `src/routes.tsx`, inside the shell, before the `/hub/workout/*` route:

```tsx
const TodayWorkoutScreen = lazy(() => import('@/screens/workout/TodayWorkoutScreen'));
// …
        {/* Logging a workout (B-14); its trend is Trends' (Plan 3). Past workouts keep their record address, /track/workout/:id. */}
        <Route path="/hub/workout/log" element={hub(<TodayWorkoutScreen />)} />
        <Route path="/hub/workout/log/*" element={<Navigate to="/hub/workout/log" replace />} />
```

Only the log's index is mounted here, so no third address for a past workout appears for `places.ts` to recognise. `TodayWorkoutScreen` reads its own `?date=`.

Then replace the single `/trends/workout/*` route with the two below. The log's past records stay at `/track/workout/:id`.

```tsx
        {/* Trends' own address. Until Plan 3 builds it, Trends; the log moved to /hub/workout/log (D51). */}
        <Route path="/trends/workout" element={<Navigate to="/trends" replace />} />
        <Route path="/trends/workout/*" element={<WorkoutRoutes />} />
```

In `src/screens/track/routes.tsx`, change the header comment's "the Workout Log to `/trends/workout`" to "the Workout Log to `/hub/workout/log`".

- [ ] **Step 4: Links to the log.**
  - **`TodayWorkoutScreen.tsx`:** `back={{ to: '/hub/workout', label: 'Workout' }}`.
  - **`RecordScreen.tsx`:**
    - "Continue this workout": `to="/hub/workout/log"`;
    - "Add the sets you did": ``to={`/hub/workout/log?date=${session.date}`}``.
  - **`QuickLog.tsx`:** the Workout row navigates to ``pastDay ? `/hub/workout/log?date=${pastDay}` : '/hub/workout/log'``.

  Leave the screens' Back to `/track` (v1 Track) and the record addresses `/track/workout/:id` as they are.

- [ ] **Step 5: The plan's Join from the hub.** In `src/screens/move/PlanScreen.tsx`:
  - import `useSearchParams` and `isEnrolled` (it's already imported) and `useEffect` (already imported);
  - start the Join flow open when the address asks for it and the person isn't in the programme;
  - then take the request out of the address, as Home does with its sheets:

```tsx
export function PlanScreen() {
  const { data, update, date } = useGuided();
  const [params, setParams] = useSearchParams();
  // "Join the 12-week programme" on the Workout hub opens the Join flow at once (D35): read on arrival, then taken out of the address.
  const [flow, dispatch] = useReducer(joinFlow, params.get('join') === '1' && !isEnrolled(data.settings, data.profile) ? { ...JOIN_CLOSED, open: true } : JOIN_CLOSED);
  useEffect(() => {
    if (!params.has('join')) return;
    setParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('join');
      return next;
    }, { replace: true });
  }, [params, setParams]);
```

Change its `back` to `{ to: '/hub/workout', label: 'Workout' }`.

- [ ] **Step 6: The library at its v2 address.**
  - **`ExercisesScreen.tsx`:**
    - `back={{ to: '/hub/workout', label: 'Workout' }}`;
    - the legacy `?ex=` hand-off goes to ``/hub/workout/exercises/${encodeURIComponent(legacy)}``;
    - each row links to ``/hub/workout/exercises/${ex.id}``.
  - **`ExerciseScreen.tsx`:** its related rows link to ``/hub/workout/exercises/${r.id}``. Keep its `state={{ from: origin, path: location.pathname, label: ex.name }}` exactly: `shell.node.test.ts` checks it.
  - Run `npx vitest run src/screens/move`. `libraryReturn` already accepts both addresses.

- [ ] **Step 7: The routes.** Replace `src/screens/move/routes.tsx`:

```tsx
import { Navigate, Route, Routes } from 'react-router-dom';
import WorkoutHub from '@/screens/hub/WorkoutHub';
import { ExerciseScreen } from './ExerciseScreen';
import { ExercisesScreen } from './ExercisesScreen';
import { PlanScreen } from './PlanScreen';

/**
 * The Workout hub and its pages (journey §8.3, §19.2): the hub at the index,
 * Your plan, and the exercise library. Logging a workout is the workout
 * area's, at `/hub/workout/log` (src/routes.tsx, B-14). v1's `stretch` path
 * stays listed, for the redirect inventory, and goes to the Stretch hub.
 */
export default function MoveRoutes() {
  return (
    <Routes>
      <Route index element={<WorkoutHub />} />
      <Route path="stretch" element={<Navigate to="/hub/stretch" replace />} />
      <Route path="plan" element={<PlanScreen />} />
      <Route path="exercises" element={<ExercisesScreen />} />
      <Route path="exercises/:id" element={<ExerciseScreen />} />
      {/* A mistyped or retired address lands on the Workout hub rather than an empty shell. */}
      <Route path="*" element={<Navigate to="/hub/workout" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 8: Write** `src/screens/hub/WorkoutHub.tsx`

```tsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { CalendarDaysIcon, ClipboardListIcon, SearchIcon, TargetIcon } from 'lucide-react';
import { categoryById } from '@/categories';
import { Group, Row } from '@/components/hig/List';
import { defaultStartLabel } from '@/components/checkin/copy';
import { HREF, resumeHref, savedRun } from '@/health/recommend';
import { loadProgress, minutesLeft, type SavedProgress } from '@/session/persistence';
import { workoutNormal } from '@/screens/home/tileLine';
import { programmeWeek, weekView } from '@/screens/move/plan';
import { weekMovement } from '@/screens/today/model';
import { StatusSheet } from '@/screens/today/StatusSheet';
import { GoalSheet } from '@/screens/track/GoalSheet';
import { displayPrefs } from '@/screens/track/logKinds';
import { pendingWeeklyGoal, weeklyGoalOn } from '@/screens/track/weeklyGoal';
import { HistoryList } from './HistoryList';
import { HubFrame, HubSection, SeeTrends } from './HubFrame';
import { useHubGate, useHubOrigin } from './hooks';
import { MovementCard } from './MovementCard';
import { actionTarget, movementCard, restDayOf, resumeAllowed, runAction, sessionParts, type HubActionKind } from './movement';
import { goalLine, modeWeek, movementHistory } from './week';
import { WeekStrip } from './WeekStrip';

const REFUSED = new Set(['held', 'stopped', 'gap']);

/**
 * The Workout hub (journey §8.3).
 * - In the programme: today's session, or the rest day with "Stretch instead".
 * - Outside it: the way in, never a session (D35).
 * - Options: Your plan, Find an exercise, Log a workout and Weekly goal.
 * - Then the programme's week against this week's goal, the last workouts,
 *   and the trend.
 */
export default function WorkoutHub() {
  const category = categoryById('workout');
  const g = useHubGate('guided');
  const { guided, state, today, status, enrolled } = g;
  const navigate = useNavigate();
  const origin = useHubOrigin(category.title);
  const [goalOpen, setGoalOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const plan = guided.plan;
  const recovery = plan.kind === 'recovery';
  const runs = [loadProgress(Date.now(), 'guided')].filter((p): p is SavedProgress => p !== null);
  const savedToday = savedRun(runs, today, 'today');
  const saved = savedToday && resumeAllowed(status, 'guided') ? savedToday : undefined;
  const rest = enrolled ? restDayOf(plan) : undefined;
  const parts = sessionParts(plan);
  const card = movementCard({
    mode: 'guided', permission: g.permission, gate: g.gate, status, line: g.line, enrolled, recovery,
    title: workoutNormal({ enrolled: true, label: plan.label, minutes: Math.round(plan.totalSeconds / 60) }),
    ...(parts ? { detail: parts } : {}),
    ...(g.recommendation.action.mode === 'guided' && g.recommendation.reason ? { reason: g.recommendation.reason } : {}),
    gaps: g.gaps, stretchOpen: g.stretchOpen,
    ...(rest ? { rest } : {}),
    ...(saved ? { saved: { minutesLeft: minutesLeft(saved), label: saved.plan.label } } : {}),
  });
  const ctx = { mode: 'guided' as const, href: HREF.guided, startLabel: defaultStartLabel('guided', recovery), recovery, ...(saved ? { resumeHref: resumeHref(saved) } : {}) };
  const act = (kind: HubActionKind) => runAction(actionTarget(kind, ctx), {
    start: g.start,
    go: to => navigate(to, { viewTransition: true, state: origin }),
    status: () => setStatusOpen(true),
    local: () => {},
  });

  const week = programmeWeek(state.settings.startDate, today);
  const planDetail = !enrolled ? 'Not joined yet' : week.startsOn ? 'Starts soon' : `Week ${week.week} of 12`;
  const goal = weeklyGoalOn(state.settings, today);
  const pending = pendingWeeklyGoal(state.settings, today);
  const goalDetail = pending
    ? `${pending.goal !== undefined ? `${pending.goal} min` : 'No goal'} from ${format(parseISO(pending.from), 'EEEE d MMMM')}`
    : 'Minutes of recorded movement a week, yours to choose';
  const minutes = weekMovement(today, state.observations, state.sessions).minutes;
  const prefs = displayPrefs(state.settings, state.profile, state.observations);
  const programme = enrolled ? weekView(guided.data, guided.profile, today) : undefined;

  return (
    <HubFrame category={category} held={REFUSED.has(card.state)}>
      <MovementCard card={card} onAction={act} />

      <HubSection title="Options">
        <Group>
          <Row as={Link} to="/hub/workout/plan" state={origin} viewTransition icon={<CalendarDaysIcon />} label="Your plan" detail={planDetail} chevron />
          <Row as={Link} to="/hub/workout/exercises" state={origin} viewTransition icon={<SearchIcon />} label="Find an exercise" detail="Every stretch and exercise, with its demo" chevron />
          <Row as={Link} to="/hub/workout/log" state={origin} viewTransition icon={<ClipboardListIcon />} label="Log a workout" detail="Sets you did on your own, marked as logged by you" chevron />
          <Row as="button" type="button" onClick={() => setGoalOpen(true)} icon={<TargetIcon />} label="Weekly goal" value={goal !== undefined ? `${goal} min` : 'Not set'} detail={goalDetail} chevron />
        </Group>
      </HubSection>

      <WeekStrip
        days={modeWeek({
          mode: 'guided', today, sessions: state.sessions, observations: state.observations,
          ...(state.settings.statusPeriods ? { statusPeriods: state.settings.statusPeriods } : {}),
          ...(programme ? { programme } : {}),
        })}
        goal={goalLine(minutes, goal)}
      />
      <HistoryList rows={movementHistory('guided', state.sessions, state.observations, prefs, today)} origin={origin} empty="No workouts yet. Each one shows here, with its sets." />
      <SeeTrends category={category} origin={origin} />

      {g.sheet}
      <StatusSheet open={statusOpen} onOpenChange={setStatusOpen} today={today} periods={state.settings.statusPeriods} startDate={state.settings.startDate} />
      <GoalSheet open={goalOpen} onOpenChange={setGoalOpen} goal={state.settings.weeklyMovementGoalMinutes} />
    </HubFrame>
  );
}
```

- [ ] **Step 9: Check by eye.** Run `npm run dev`. Seed the acceptance personas with the fixture loader: `node scripts/e2e/acceptance/run.mjs --list` shows the journeys, and a journey's `persona('P01')` blob can be pasted into `localStorage['fit-strong-90-data']` before the app loads. At 428×926 and 320×568:
  - **P01 (enrolled, Thursday 09:00):**
    - Right now is "<today's session> · N min", with "mobility, strength and cardio" and "Check in & start";
    - Options read "Your plan · Week 3 of 12", Find an exercise, Log a workout, and Weekly goal "Not set";
    - the strip marks Monday's and Saturday's training days as they stand, and the planned rest days "R";
    - "Check in & start" opens the check-in, with "Start session" in its outcome.
  - **P02 (not enrolled):** "The 12-week programme", "Join the 12-week programme" (which opens the Join wizard at once), and "Stretch instead".
  - **A flare (set from Home):**
    - P01's Workout hub says "Gentle only today" with "Start recovery session" (or "Check in & start");
    - P02's offers "Stretch instead" first.
  - **Weekly goal:** set 150 on Tuesday. On Thursday change it to 200: the row says "200 min from Monday 12 October", and the strip's line still says "of 150 min".
  - **320 px or 200% text:** the strip becomes seven rows.

- [ ] **Step 10: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/hub/WorkoutHub.tsx src/screens/move src/screens/workout/TodayWorkoutScreen.tsx src/screens/workout/RecordScreen.tsx src/screens/track/QuickLog.tsx src/screens/track/routes.tsx src/redirects.ts src/redirects.test.ts src/routes.tsx
git commit -m "feat: Make the Workout hub, and log workouts at the hub's own address"
```

---

### Task 7: The Stretch hub

**Files:**
- Modify: `src/engine/stretch.test.ts` (B-30: a stretch saved before a flare, resumed during it)
- Move: `src/screens/move/StretchScreen.tsx` → `src/screens/hub/StretchHub.tsx` (`git mv`, then rewrite)
- Modify: `src/routes.tsx` (`/hub/stretch` → `StretchHub`)

**Interfaces:**
- Consumes:
  - Tasks 3–5;
  - `stretchPlanFor`, `readStretchSpec`, `lastStretch`, `specFromPlanId`, `offeredSpec`, `stretchOffered`, `stretchHref`, `STRETCH_FOCI`, `STRETCH_MINUTES` and `STRETCH_FOCUS_LABEL` (`@/engine/stretch`);
  - `previewRows`, `kitLine`, `talkSeconds`, `todayLine` and `clock` (`@/screens/move/preview`);
  - `ChoiceRows`, `Segmented` and `Wrap` (`@/screens/move/controls`);
  - `shiftDay` (`@/health/status`);
  - `reconcilePlan` (`@/session/gate`), in the test only.
- Produces: `StretchHub` (default export), at `/hub/stretch`. It keeps v1's address contract (`?focus=&minutes=`), its radiogroups "Area" and "Length", and its "In this routine" group, which the acceptance suite reads.

- [ ] **Step 1: Pin B-30 first.** A stretch saved before a flare, then resumed during it, must run only the gentler routine's work (B-30; the audit's A-34 left this untested). v1 already does it: `SessionPage` holds a resumed plan to a fresh one through `reconcilePlan`, and `stretchPlanFor` builds that fresh plan gentler during a flare. Pin it before the hub's "Continue stretch" leans on it. Append to `src/engine/stretch.test.ts`, and add `import { reconcilePlan } from '@/session/gate';` to its imports:

```ts
describe('B-30: a stretch saved before a flare and resumed during it (A-34)', () => {
  const flare = { statusPeriods: [{ kind: 'flare' as const, from: DATE }] };
  const data = (settings: object) =>
    ({ settings: { startDate: START, ...settings }, sessions: [], checkIns: [] }) as unknown as Parameters<typeof stretchPlanFor>[0];
  const moves = (steps: readonly Step[]) => steps.filter(s => s.kind === 'hold' || s.kind === 'drill') as (Step & { exerciseId: string })[];
  const avoided = (id: string) => { const m = getMeta(id); return m?.kind === 'mobility' && m.status === 'avoidWhenIrritable'; };

  it('the remaining work follows the gentler routine: nothing it leaves out runs', () => {
    const profile = createDefaultProfile(BACK);
    let leftOut = 0;
    for (const focus of STRETCH_FOCI) {
      const spec = { focus, minutes: 10 as const };
      const saved = stretchPlanFor(data({}), profile, DATE, spec);
      const now = stretchPlanFor(data(flare), profile, DATE, spec);
      // Saved just after it began, so almost all of it is still to run.
      const at = 1;
      const { plan, refused } = reconcilePlan(saved, at, now, { profile, now: new Date(2026, 9, 8, 9, 0), recent: [] });
      const gentle = new Set(moves(now.steps).map(s => s.exerciseId));
      for (const s of moves(plan.steps.slice(at)).filter(x => !refused.has(x.id))) {
        expect(gentle.has(s.exerciseId), `${focus}: ${s.exerciseId} is not in the gentler routine`).toBe(true);
        expect(avoided(s.exerciseId), `${focus}: ${s.exerciseId}`).toBe(false);
      }
      const dropped = moves(saved.steps.slice(at)).filter(s => avoided(s.exerciseId));
      for (const s of dropped) expect(refused.has(s.id), `${focus}: ${s.exerciseId} still runs after the flare`).toBe(true);
      leftOut += dropped.length;
    }
    // The rule was exercised: some routine held a movement a flare leaves out.
    expect(leftOut).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/engine/stretch.test.ts`
Expected: PASS, since this is v1's behaviour. Two other outcomes:
- If `leftOut` is 0, no 10-minute routine for this profile holds a movement a flare leaves out. Use `minutes: 15 as const` too (loop over `STRETCH_MINUTES`), and note the fixture choice on the board.
- If a dropped movement still runs, that's a real bug. Fix `reconcilePlan` so a step with no twin in the fresh plan is refused before anything else is done, and commit the fix with this test, before the hub.

- [ ] **Step 3: Move the file**

```bash
git mv src/screens/move/StretchScreen.tsx src/screens/hub/StretchHub.tsx
```

In `src/routes.tsx`, replace the `StretchScreen` lazy import with `const StretchHub = lazy(() => import('@/screens/hub/StretchHub'));`, and route `/hub/stretch` to `hub(<StretchHub />)`. Nothing else imports `StretchScreen`: check with `grep -rn "StretchScreen" src`.

- [ ] **Step 4: Rewrite it as the hub.** Replace the whole file with:

```tsx
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { categoryById } from '@/categories';
import { Group, Row } from '@/components/hig/List';
import {
  lastStretch, offeredSpec, readStretchSpec, specFromPlanId, STRETCH_FOCI, STRETCH_FOCUS_LABEL, STRETCH_MINUTES, stretchHref, stretchOffered,
  stretchPlanFor,
} from '@/engine/stretch';
import { resumeHref, savedRun } from '@/health/recommend';
import { shiftDay } from '@/health/status';
import { loadProgress, minutesLeft, type SavedProgress } from '@/session/persistence';
import { ChoiceRows, Segmented, Wrap } from '@/screens/move/controls';
import { clock, kitLine, previewRows, talkSeconds, todayLine } from '@/screens/move/preview';
import { weekMovement } from '@/screens/today/model';
import { StatusSheet } from '@/screens/today/StatusSheet';
import { displayPrefs } from '@/screens/track/logKinds';
import { weeklyGoalOn } from '@/screens/track/weeklyGoal';
import type { StretchFocus, StretchMinutes, StretchSpec } from '@/types/plan';
import { HistoryList } from './HistoryList';
import { HubFrame, HubSection, SeeTrends } from './HubFrame';
import { useHubGate, useHubOrigin } from './hooks';
import { MovementCard } from './MovementCard';
import { actionTarget, movementCard, resumeAllowed, runAction, stretchReason, type HubActionKind } from './movement';
import { goalLine, modeWeek, movementHistory } from './week';
import { WeekStrip } from './WeekStrip';

const REFUSED = new Set(['held', 'stopped', 'gap']);
const routineTitle = (s: StretchSpec) => `${STRETCH_FOCUS_LABEL[s.focus]} · ${s.minutes} min`;

/**
 * The Stretch hub (journey §8.3, D36).
 * - Right now is the recommended routine, with its area, its length and a
 *   reason from real inputs only, or the gate's words while it refuses.
 * - "In this routine" is what the player will run, built by the same
 *   builder from the same records.
 * - Options are v1's approved routines, through its builder: Back & hips,
 *   Neck & shoulders, Hips & legs or Whole body, at 10 or 15 minutes. The
 *   choice lives in the address (`?focus=&minutes=`), so a reload keeps it.
 * - A run saved today is offered first, as the routine it was. During a
 *   flare it is re-dosed by the player to the gentler routine (A-34, B-30).
 */
export default function StretchHub() {
  const category = categoryById('stretch');
  const g = useHubGate('stretch');
  const { guided, state, today, status } = g;
  const navigate = useNavigate();
  const origin = useHubOrigin(category.title);
  const [params, setParams] = useSearchParams();
  const [statusOpen, setStatusOpen] = useState(false);
  const chosen = params.has('focus') || params.has('minutes');
  const runs = [loadProgress(Date.now(), 'stretch')].filter((p): p is SavedProgress => p !== null);
  const savedToday = savedRun(runs, today, 'today');
  const saved = savedToday && resumeAllowed(status, 'stretch') ? savedToday : undefined;
  const fromSaved = saved ? saved.plan.stretch ?? specFromPlanId(saved.plan.id) : null;
  const { focus, minutes } = fromSaved ?? readStretchSpec(params, lastStretch(state.sessions));
  const spec: StretchSpec = { focus, minutes };
  // The effective check-ins, as the player builds from, so "In this routine" never lists what won't run.
  const plan = useMemo(
    () => stretchPlanFor({ ...guided.data, checkIns: guided.checkIns }, guided.profile, guided.date, { focus, minutes }),
    [guided.data, guided.checkIns, guided.profile, guided.date, focus, minutes],
  );
  const back = guided.profile.pain.areas.includes('lowerBack') || guided.profile.pain.areas.includes('sciatica');
  const yesterday = guided.checkIns.find(c => c.date === shiftDay(today, -1))?.back;
  const fromLast = state.sessions.some(s => s.planKind === 'stretch' && specFromPlanId(s.planId) !== null);
  const reason = stretchReason({
    chosen, flare: status === 'flare' && back, focus, fromLast,
    ...(yesterday ? { yesterday } : {}), ...(state.settings.focus ? { focusSetting: state.settings.focus } : {}),
  });
  const line = todayLine(plan, g.permission);
  const card = movementCard({
    mode: 'stretch', permission: g.permission, gate: g.gate, status, line: g.line, title: routineTitle(spec),
    ...(line && plan.kind !== 'none' ? { detail: line } : {}),
    ...(reason ? { reason } : {}),
    // The gate allows it, but the builder can't make this routine today: say so, and offer the other routines.
    ...(plan.kind === 'none' && g.permission.allowed ? { blocked: line ?? 'This routine cannot be put together safely today. Try another area or length.' } : {}),
    gaps: g.gaps, stretchOpen: g.stretchOpen,
    ...(saved ? { saved: { minutesLeft: minutesLeft(saved), label: saved.plan.label } } : {}),
  });
  const ctx = { mode: 'stretch' as const, href: stretchHref(spec), startLabel: 'Start stretch', ...(saved ? { resumeHref: resumeHref(saved) } : {}) };
  const act = (kind: HubActionKind) => runAction(actionTarget(kind, ctx), {
    start: g.start,
    go: to => navigate(to, { viewTransition: true, state: origin }),
    status: () => setStatusOpen(true),
    local: () => {},
  });
  // Replace, not push: changing a choice is not a place to go Back to. The page stays where it is.
  const choose = (next: StretchSpec) => setParams({ focus: next.focus, minutes: String(next.minutes) }, { replace: true, preventScrollReset: true });
  const offering = !REFUSED.has(card.state) && card.state !== 'join';
  const rows = previewRows(plan);
  const kit = kitLine(plan);
  const talk = Math.round(talkSeconds(plan) / 60);
  const prefs = displayPrefs(state.settings, state.profile, state.observations);

  return (
    <HubFrame category={category} held={REFUSED.has(card.state)}>
      <MovementCard card={card} onAction={act} />

      {offering && rows.length > 0 && (
        <Group
          header="In this routine"
          footer={[kit, talk > 0 ? `Plus about ${talk} ${talk === 1 ? 'minute' : 'minutes'} of welcome and wrap-up.` : null].filter(Boolean).join(' ')}
        >
          {/* Names wrap: a movement's name is the one thing in the row that must not be cut short. */}
          {rows.map(r => <Row key={r.id} label={<Wrap>{r.name}</Wrap>} detail={r.dose} value={clock(r.seconds)} numeric />)}
        </Group>
      )}

      {offering && !saved && (
        <HubSection title="Options">
          <div className="flex flex-col gap-4">
            <Group header="Area">
              <ChoiceRows<StretchFocus>
                label="Area"
                options={STRETCH_FOCI.map(f => ({ value: f, label: STRETCH_FOCUS_LABEL[f] }))}
                value={focus}
                onChange={f => choose(offeredSpec({ focus: f, minutes }))}
              />
            </Group>
            <section aria-labelledby="stretch-length" className="flex flex-col">
              <h3 id="stretch-length" className="px-4 pb-2 text-[length:var(--text-footnote)] font-medium uppercase tracking-wide text-muted-foreground">Length</h3>
              <Segmented<StretchMinutes>
                label="Length"
                options={STRETCH_MINUTES.map(m => ({ value: m, label: `${m} min`, disabled: !stretchOffered({ focus, minutes: m }) }))}
                value={minutes}
                onChange={m => choose({ focus, minutes: m })}
              />
              {!stretchOffered({ focus, minutes: 10 }) && (
                <p className="px-4 pt-2 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
                  Ten minutes is Back &amp; hips only: every routine starts with the same spine and core basics, and they fill most of it.
                </p>
              )}
            </section>
          </div>
        </HubSection>
      )}

      <WeekStrip
        days={modeWeek({ mode: 'stretch', today, sessions: state.sessions, observations: state.observations, ...(state.settings.statusPeriods ? { statusPeriods: state.settings.statusPeriods } : {}) })}
        goal={goalLine(weekMovement(today, state.observations, state.sessions).minutes, weeklyGoalOn(state.settings, today))}
      />
      <HistoryList rows={movementHistory('stretch', state.sessions, state.observations, prefs, today)} origin={origin} empty="No stretches yet. Each one shows here." />
      <SeeTrends category={category} origin={origin} />
      <p className="px-4 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
        Stop if pain spreads down your leg, or you feel dizzy, short of breath or unwell. General information, not medical advice.
      </p>

      {g.sheet}
      <StatusSheet open={statusOpen} onOpenChange={setStatusOpen} today={today} periods={state.settings.statusPeriods} startDate={state.settings.startDate} />
    </HubFrame>
  );
}
```

`saved.plan.stretch` is the `StretchSpec` the builder writes on a stretch plan. If `SessionPlan` doesn't type `stretch`, `specFromPlanId(saved.plan.id)` alone gives the same spec. `recommend`'s `resumeHref` reads it the same way.

- [ ] **Step 5: Check by eye.** Run `npm run dev`. At 428×926 and 320×568:
  - **P02 (stretch focus):**
    - Right now is "Back & hips · 10 min", with "Why this? You chose stretching as your focus." and "Check in & start";
    - "In this routine" lists the movements;
    - choosing Neck & shoulders makes Length jump to 15 min, and the address shows `?focus=neckShoulders&minutes=15`.
  - **P06 (flare):** "Gentle stretch", the gentler-routine line, and "Your back is in a flare-up, so this is the gentler routine."
  - **P05 (foot):** the stretch reads normally.
  - **A low entered in Glucose:** "Check again before you start", then "Waiting for your re-check at …", with no Start, and "Enter a new reading". The shared "Re-check your glucose" surface sits above the hub.

- [ ] **Step 6: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/engine/stretch.test.ts src/screens/hub/StretchHub.tsx src/routes.tsx
git commit -m "feat: Make the Stretch hub from v1's approved routines and the shared gate"
```

---

### Task 8: The Walk hub, with the after-meal button stating its time (B-09)

**Files:**
- Modify: `src/walk/plan.ts`, `src/walk/plan.test.ts` (`afterMealSuggestion`, `mealMinutesAgo`)
- Modify: `src/health/recommend.ts`, `src/health/recommend.test.ts` (Home's after-meal card states the time through `afterMealSuggestion`)
- Move: `src/screens/walk/WalkSetup.tsx` → `src/screens/hub/WalkHub.tsx` (`git mv`, then rework)
- Modify: `src/screens/walk/routes.tsx` (the hub at the index)

**Interfaces:**
- Produces:
  - `afterMealSuggestion(i: { meal: Meal; finish?: string; now: number; hour12: boolean }): { at: number; title: string; label: string }`;
  - `mealMinutesAgo(at: number, now: number): number`;
  - `WalkHub` (default export), at `/hub/walk`;
  - Home's after-meal card (b870bdd) taking its label and `walk.mealStartedAt` from `afterMealSuggestion`, in place of `recommend.ts`'s private `lastMealTime`.
- Consumes:
  - Tasks 3–5;
  - v1's `setupPlan`, `liveHref`, `newWalkId`, `mealFromSearch`, `MEALS`, `MEAL_LABEL`, `MEAL_STARTED_AGO`, `mealStartedLabel`, `AFTER_MEAL_TARGET`, `TARGETS` and `choiceChanged`;
  - `mealWalkNow` (`@/health/recommend`);
  - `peekWalk` (`@/walk/persist`);
  - `requestLocation`, `requestMotion`, `canLocate` and `canSenseMotion` (`@/walk/browser`);
  - `timeOf` (`@/lib/time`).
- Kept from v1, which the acceptance suite reads:
  - the radiogroup "What kind of walk" (Just a walk, After a meal);
  - the selects "Meal", "Started" and "Target";
  - the switches "Measure distance and pace" and "Count steps";
  - the pending walk's "Return to walk" or "Review and save".

- [ ] **Step 1: Write the failing test.** Append to `src/walk/plan.test.ts`, and add `afterMealSuggestion` and `mealMinutesAgo` to its import:

```ts
describe('afterMealSuggestion: what B-09’s button says, and the meal time it records', () => {
  const at = (h: number, m: number, d = 8) => new Date(2026, 9, d, h, m).getTime();

  it('the usual finish time, once it has passed and within two hours', () => {
    expect(afterMealSuggestion({ meal: 'lunch', finish: '13:10', now: at(13, 40), hour12: true }))
      .toEqual({ at: at(13, 10), title: 'A walk after lunch', label: 'I had lunch at 1:10 pm: walk now' });
  });

  it('now, while the usual time is still to come (Review Focus 5)', () => {
    expect(afterMealSuggestion({ meal: 'lunch', finish: '13:10', now: at(12, 50), hour12: true }).at).toBe(at(12, 50));
  });

  it('now, when the usual time was more than two hours ago', () => {
    expect(afterMealSuggestion({ meal: 'lunch', finish: '13:10', now: at(19, 0), hour12: true }).label).toBe('I had lunch at 7:00 pm: walk now');
  });

  it('last night’s dinner just after midnight, never a time still to come (Review Focus 5)', () => {
    const s = afterMealSuggestion({ meal: 'dinner', finish: '22:30', now: at(0, 20, 9), hour12: true });
    expect(s.at).toBe(at(22, 30, 8));
    expect(s.label).toBe('I had dinner at 10:30 pm: walk now');
  });

  it('now, with no usual time or one that isn’t a time, on a 24-hour clock too', () => {
    expect(afterMealSuggestion({ meal: 'breakfast', now: at(8, 40), hour12: false }).label).toBe('I had breakfast at 08:40: walk now');
    expect(afterMealSuggestion({ meal: 'breakfast', finish: '8.30', now: at(8, 40), hour12: false }).at).toBe(at(8, 40));
  });

  it('whole minutes since the meal, never negative', () => {
    expect(mealMinutesAgo(at(13, 10), at(13, 40))).toBe(30);
    expect(mealMinutesAgo(at(13, 41), at(13, 40))).toBe(0);
  });
});
```

Run: `npx vitest run src/walk/plan.test.ts`
Expected: FAIL, "afterMealSuggestion is not a function" (or an import error).

- [ ] **Step 2: Write them.** In `src/walk/plan.ts`, import `timeOf` from `@/lib/time`, and add after `mealStartedLabel`:

```ts
/** How far back a meal's usual end can be and still be the meal just had: Walk's own longest "Started" choice. */
const MEAL_SUGGEST_MS = 2 * 60 * 60 * 1000;

/**
 * B-09: what the after-meal button says, and the meal time it records once
 * tapped. It is the meal's usual finish time today (or last night's, for a
 * dinner after midnight), or now when that is still to come or more than two
 * hours ago. A usual time is only a suggestion, and the tap is what confirms
 * it (A-10, L-05). It is never a time in the future.
 */
export function afterMealSuggestion({ meal, finish, now, hour12 }: { meal: Meal; finish?: string; now: number; hour12: boolean }): { at: number; title: string; label: string } {
  const at = usualFinish(finish, now) ?? now;
  return { at, title: `A walk after ${meal}`, label: `I had ${meal} at ${timeOf(at, hour12)}: walk now` };
}

/** The latest past moment at a local `HH:MM`, if it is within two hours of `now`. */
function usualFinish(finish: string | undefined, now: number): number | undefined {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(finish ?? '');
  if (!m) return undefined;
  const d = new Date(now);
  const on = (offset: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset, Number(m[1]), Number(m[2])).getTime();
  const last = on(0) > now ? on(-1) : on(0);
  return now - last <= MEAL_SUGGEST_MS ? last : undefined;
}

/** Whole minutes from the meal to now, never negative: what the walk's "Started" choice holds. */
export function mealMinutesAgo(at: number, now: number): number {
  return Math.max(0, Math.round((now - at) / 60_000));
}
```

Run: `npx vitest run src/walk/plan.test.ts`
Expected: PASS.

- [ ] **Step 3: One time for Home's card and the hub.** Home's Right now card already states B-09's time (b870bdd), through a private `lastMealTime` in `src/health/recommend.ts`. Within the after-meal walk's 45 minutes, which is the only time the card offers it, that gives the same moment as `afterMealSuggestion`. Make the card use it, so the two can never drift apart. In `mealWalk`, replace `const had = lastMealTime(habits, meal, ctx.input.now);` and the action's label with:

```ts
  const finish = habits?.mealWalk?.finish?.[meal];
  const said = afterMealSuggestion({ meal, ...(finish ? { finish } : {}), now: ctx.input.now.getTime(), hour12: prefersHour12() });
  const had = said.at;
```

```ts
    action: { label: said.label, to: HREF.liveWalk, mode: 'walk', walk: { meal, mealStartedAt: had } },
```

Then:
- delete `lastMealTime`;
- add `afterMealSuggestion` to the existing `@/walk/plan` import (`walkSetupHref` is already imported from there, so no new dependency appears);
- add `prefersHour12` beside `timeOf` from `@/lib/time`.

Add this case inside `src/health/recommend.test.ts`'s `describe('a walk after a meal (D26; scan J2-07)', …)`, which has the `meal(over, time)` helper and lunch's usual end at 13:30. Add `afterMealSuggestion` to the file's `@/walk/plan` import, and `prefersHour12` to its `@/lib/time` import:

```ts
  it('states the same time as the Walk hub: the card uses afterMealSuggestion (B-09)', () => {
    const r = meal({}, '13:40');
    const said = afterMealSuggestion({ meal: 'lunch', finish: '13:30', now: at(TODAY, '13:40').getTime(), hour12: prefersHour12() });
    expect(r.action.label).toBe(said.label);
    expect(r.action.walk).toEqual({ meal: 'lunch', mealStartedAt: said.at });
  });
```

Run: `npx vitest run src/health/recommend.test.ts src/walk/plan.test.ts`
Expected: PASS. b870bdd's cases keep their labels.

- [ ] **Step 4: Move the setup into the hub**

```bash
git mv src/screens/walk/WalkSetup.tsx src/screens/hub/WalkHub.tsx
```

In `src/screens/walk/routes.tsx`:
- import `WalkHub` from `@/screens/hub/WalkHub`, and route the index to `<WalkHub />`;
- change the catch-all to `<Navigate to="/hub/walk" replace />`;
- update the header comment: "the Walk hub at `/hub/walk` and the summary at `/hub/walk/summary`".

Check that nothing else imports `WalkSetup`: `grep -rn "WalkSetup" src`.

- [ ] **Step 5: Rework it as the hub.** In `src/screens/hub/WalkHub.tsx`, make the component `export default function WalkHub()`. Keep v1's constants (`NO_TARGET`, `LOCATION_NOTE`, `MOTION_NOTE`), its remembered-choice effect, and `chooseKind`, `toggleGps` and `toggleSteps` unchanged.

  Replace the rest as follows.

  **1. The hub's inputs, all before any early return:**

```tsx
  const category = categoryById('walk');
  const g = useHubGate('walk');
  const { state, now, today, status, hour12 } = g;
  const navigate = useNavigate();
  const origin = useHubOrigin(category.title);
  const [params] = useSearchParams();
  const remembered = state.settings.walkDefaults;
  const [statusOpen, setStatusOpen] = useState(false);
  // Read once: a walk under way, or waiting to be saved, comes first.
  const [pending] = useState(() => peekWalk());
  // A meal in view (B-09): one another screen asked about (`?meal=`), or the after-meal walk due now (D26). Read on arrival.
  const [context] = useState(() => {
    const meal = mealFromSearch(params) ?? mealWalkNow(state.settings.habits, new Date());
    if (!meal) return undefined;
    const finish = state.settings.habits?.mealWalk?.finish?.[meal];
    return { meal, ...afterMealSuggestion({ meal, ...(finish ? { finish } : {}), now: Date.now(), hour12 }) };
  });
  const [kind, setKind] = useState<WalkKind>(context ? 'afterMeal' : 'walk');
  // Asked, never assumed from the clock (J10): only a meal in view comes already chosen.
  const [meal, setMeal] = useState<Meal | undefined>(context?.meal);
  // The meal's time: the suggestion's own moment until the person picks another "Started" choice.
  const [mealAt, setMealAt] = useState<number | undefined>(context?.at);
  const [mealAgo, setMealAgo] = useState(0);
  const [target, setTarget] = useState(context ? AFTER_MEAL_TARGET : NO_TARGET);
```

  Keep v1's `targetChosen`, `gps`, `gpsBusy`, `gpsNote`, `steps`, `stepsBusy`, `stepsNote` and `rememberNote` state as they are.

  **2. The card, and what each action does:**

```tsx
  const at = mealAt ?? now.getTime() - mealAgo * 60_000;
  const afterMeal = kind === 'afterMeal' && meal ? { title: `A walk after ${meal}`, label: `I had ${meal} at ${timeOf(at, hour12)}: walk now` } : undefined;
  const card = movementCard({
    mode: 'walk', permission: g.permission, gate: g.gate, status, line: g.line, title: 'Just a walk',
    ...(afterMeal ? { detail: 'About 10 minutes, starting soon after you finish eating.', afterMeal } : {}),
    ...(g.recommendation.action.mode === 'walk' && g.recommendation.reason ? { reason: g.recommendation.reason } : {}),
    ...(kind === 'afterMeal' && !meal ? { waiting: 'Choose the meal to start.' } : {}),
    gaps: g.gaps, stretchOpen: g.stretchOpen,
  });
  // A live walk's address for what is chosen now, built at the tap so its id and its meal time are fresh.
  const hrefFor = (which: WalkKind, tapAt: number) => {
    const plan = setupPlan({
      kind: which, meal: which === 'afterMeal' ? meal : undefined,
      mealAgo: mealAt !== undefined ? mealMinutesAgo(mealAt, tapAt) : mealAgo,
      ...(target !== NO_TARGET ? { targetMinutes: target } : {}), gps, steps,
    }, tapAt);
    return plan ? liveHref(newWalkId(tapAt), plan) : undefined;
  };
  const showTime = () => {
    // "Different time": the meal and its time, in the options, with the focus on when it was.
    flushSync(() => { setKind('afterMeal'); if (context && !meal) setMeal(context.meal); });
    document.getElementById(STARTED_ID)?.focus();
  };
  const act = (k: HubActionKind) => {
    // A remembered "Count steps" still needs this launch's motion permission on an iPhone, and only a tap can ask (B-01): this is that tap.
    if (steps && k !== 'otherTime' && k !== 'status') void requestMotion();
    const tapAt = Date.now();
    const plain = hrefFor('walk', tapAt)!;
    runAction(actionTarget(k, { mode: 'walk', href: hrefFor(kind, tapAt) ?? plain, plainHref: plain, startLabel: 'Start walk' }), {
      start: g.start,
      go: to => navigate(to, { viewTransition: true, state: origin }),
      status: () => setStatusOpen(true),
      local: showTime,
    });
  };
  const offering = card.state === 'go' || card.state === 'checkIn' || card.state === 'paused';
  const prefs = displayPrefs(state.settings, state.profile, state.observations);
  const startedOptions = [
    ...(mealAt !== undefined ? [{ value: -1, label: `${timeOf(mealAt, hour12)} (your usual time)` }] : []),
    ...MEAL_STARTED_AGO.map(m => ({ value: m, label: mealStartedLabel(m) })),
  ];
```

  Declare `const STARTED_ID = 'walk-meal-started';` at the top of the file, and use it as the "Started" select's `id`.

  **3. A pending walk comes first** (v1's early return, now inside the frame):

```tsx
  if (pending) {
    const going = pending.state === 'inProgress';
    return (
      <HubFrame category={category}>
        <HubSection title="Right now">
          <Group footer={going ? 'Nothing is recorded while the walk screen is closed. Return to carry on.' : 'Nothing is in your record until you save it.'}>
            <Row icon={<FootprintsIcon />} label={going ? 'A walk is in progress' : 'A walk is waiting to be saved'} detail={`Started ${timeOfDay(pending.startedAt)}`} />
          </Group>
          <PrimaryButton onClick={() => navigate(pending.href, { viewTransition: true })}>{going ? 'Return to walk' : 'Review and save'}</PrimaryButton>
        </HubSection>
      </HubFrame>
    );
  }
```

  **4. Otherwise, the hub:**

```tsx
  return (
    <HubFrame category={category} held={card.state === 'held' || card.state === 'stopped' || card.state === 'gap'}>
      <MovementCard card={card} onAction={act} />
      {offering && (
        <HubSection title="Options">
          <div className="flex flex-col gap-4">
            <Group header="What kind of walk">
              <div role="radiogroup" aria-label="What kind of walk" className="[&>*+*]:border-t [&>*+*]:border-separator">
                <ChoiceRow label="Just a walk" selected={kind === 'walk'} onSelect={() => chooseKind('walk')} />
                <ChoiceRow label="After a meal" detail="A short walk soon after eating" selected={kind === 'afterMeal'} onSelect={() => chooseKind('afterMeal')} />
              </div>
            </Group>
            {kind === 'afterMeal' && (
              <Group
                header="After a meal"
                footer="In a study of people with type 2 diabetes, walking for 10 minutes after each main meal lowered glucose after the evening meal more than one 30-minute walk a day at the same total (Reynolds, Diabetologia 2016). Research, not a promise. General information, not medical advice."
              >
                <SelectRow id="walk-meal" label="Meal" value={meal} placeholder="Choose a meal" options={MEALS.map(m => ({ value: m, label: MEAL_LABEL[m] }))} onChange={setMeal} />
                <SelectRow
                  id={STARTED_ID}
                  label="Started"
                  value={mealAt !== undefined ? -1 : mealAgo}
                  options={startedOptions}
                  onChange={v => { if (v !== -1) { setMealAgo(v); setMealAt(undefined); } }}
                />
              </Group>
            )}
            <Group header="Walk with a target">
              <SelectRow
                id="walk-target"
                label="Target"
                detail={kind === 'afterMeal' ? '10 minutes is suggested after a meal' : 'Optional'}
                value={target}
                options={[{ value: NO_TARGET, label: 'No target' }, ...TARGETS.map(t => ({ value: t, label: `${t} min` }))]}
                onChange={t => { setTarget(t); setTargetChosen(true); }}
              />
            </Group>
            <Group
              header="How walks are measured"
              footer={<>
                A walk is recorded only while this screen is open and your phone is unlocked. If you lock the phone or switch apps, recording pauses until you come back.
                {rememberNote && <span role="status" className="mt-1 block text-stop">{rememberNote}</span>}
              </>}
            >
              <SwitchRow label="Measure distance and pace" detail={gpsBusy ? 'Asking for your location…' : gpsNote ?? 'Uses GPS. Your route is never stored.'} checked={gps} busy={gpsBusy} onToggle={() => void toggleGps()} />
              <SwitchRow label="Count steps" detail={stepsBusy ? 'Asking for motion access…' : stepsNote ?? 'Uses the motion sensor, with the phone in your hand or pocket.'} checked={steps} busy={stepsBusy} onToggle={() => void toggleSteps()} />
            </Group>
          </div>
        </HubSection>
      )}
      <WeekStrip
        days={modeWeek({ mode: 'walk', today, sessions: state.sessions, observations: state.observations, ...(state.settings.statusPeriods ? { statusPeriods: state.settings.statusPeriods } : {}) })}
        goal={goalLine(weekMovement(today, state.observations, state.sessions).minutes, weeklyGoalOn(state.settings, today))}
      />
      <HistoryList rows={movementHistory('walk', state.sessions, state.observations, prefs, today)} origin={origin} empty="No walks yet. Each one shows here, with its time." />
      <SeeTrends category={category} origin={origin} />
      {g.sheet}
      <StatusSheet open={statusOpen} onOpenChange={setStatusOpen} today={today} periods={state.settings.statusPeriods} startDate={state.settings.startDate} />
    </HubFrame>
  );
```

  **5. Delete what the card now does:**
  - v1's `walk.allowed && walk.restrictions` "For today" group (the card lists the changes);
  - v1's whole refusal branch, with its "No walk today", "Stretch instead", "Open your health profile" and "Review today’s check-in" (the card says each, in the copy table's words);
  - v1's `beginWalk`, `needsMeal` and the bottom `PrimaryButton`.

  **6. The imports.** The file has moved out of `src/screens/walk/`, so v1's `./parts` becomes `@/screens/walk/parts`. The file's imports are then:

```tsx
import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FootprintsIcon } from 'lucide-react';
import { categoryById } from '@/categories';
import { Group, Row } from '@/components/hig/List';
import { mealWalkNow } from '@/health/recommend';
import { timeOf } from '@/lib/time';
import { displayPrefs } from '@/screens/track/logKinds';
import { weeklyGoalOn } from '@/screens/track/weeklyGoal';
import { weekMovement } from '@/screens/today/model';
import { StatusSheet } from '@/screens/today/StatusSheet';
import { ChoiceRow, PrimaryButton, SelectRow, SwitchRow } from '@/screens/walk/parts';
import { setSettings } from '@/store/useStore';
import type { Meal } from '@/types/habits';
import type { WalkKind } from '@/walk/clock';
import { canLocate, canSenseMotion, requestLocation, requestMotion } from '@/walk/browser';
import { timeOfDay } from '@/walk/format';
import { peekWalk } from '@/walk/persist';
import {
  AFTER_MEAL_TARGET, MEAL_LABEL, MEAL_STARTED_AGO, MEALS, TARGETS, afterMealSuggestion, choiceChanged, liveHref, mealFromSearch,
  mealMinutesAgo, mealStartedLabel, newWalkId, setupPlan,
} from '@/walk/plan';
import { HistoryList } from './HistoryList';
import { HubFrame, HubSection, SeeTrends } from './HubFrame';
import { useHubGate, useHubOrigin } from './hooks';
import { MovementCard } from './MovementCard';
import { actionTarget, movementCard, runAction, type HubActionKind } from './movement';
import { goalLine, modeWeek, movementHistory } from './week';
import { WeekStrip } from './WeekStrip';
```

  Keep `setSettings`, `choiceChanged`, `canLocate`, `canSenseMotion` and `requestLocation` only if v1's kept handlers still use them (`chooseKind`, `toggleGps`, `toggleSteps` and the remembered-choice effect do). Drop v1's `Screen`, `useStartMovement`, `useGuided`, `profileGaps`, `PERMISSION_TEXT`, `cn`, `SecondaryButton` and `TriangleAlertIcon`. `tsc -b` and lint confirm the list. `SelectRow`'s value type is `number` here, which `-1` satisfies.

  The "Started" select keeps v1's label and choices, so J10 can still pick "20 minutes ago". The usual-time choice is added first only when a meal was in view.

- [ ] **Step 6: Check by eye.** Run `npm run dev`. At 428×926 and 320×568:
  - **`/hub/walk?meal=lunch` at 13:40, with the after-meal walk's lunch finish at 13:10** (set it in Me → Reminders, or seed `habits.mealWalk`):
    - the card says "A walk after lunch" and "I had lunch at 1:10 pm: walk now";
    - below that come "Different time" (which opens the meal options with the focus on "Started", showing "1:10 pm (your usual time)") and "Just a walk".
  - **Tapping the time button:**
    - opens the check-in, when one is due, whose Start says "Start walk";
    - the live walk's address carries `meal=lunch` and `mealAt` at 13:10.
  - **P05 (foot):**
    - "No walk for now", with the foot reason and its release;
    - "Review today’s check-in" and "Stretch instead";
    - no Start, and no options.
  - **A walk left in progress:** its card comes first, with "Return to walk".

- [ ] **Step 7: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/walk/plan.ts src/walk/plan.test.ts src/health/recommend.ts src/health/recommend.test.ts src/screens/hub/WalkHub.tsx src/screens/walk/routes.tsx
git commit -m "feat: Make the Walk hub, with the after-meal button stating its time"
```

---
### Task 9: When to check next, from the cadence model

**Files:**
- Modify: `src/health/cadence.ts` (`nextCheck`; the two blood pressure sources as constants; `b12Why`)
- Modify: `src/health/cadence.test.ts`

**Interfaces:**
- Produces:
  - `interface NextCheck { due: boolean; title: string; detail: string; source: string }`;
  - `nextCheck(input: CadenceInput, what: 'bloodPressure' | 'hba1c' | 'b12'): NextCheck | undefined`.
- Consumes the module's own `bloodPressureItem`, `hba1cItem`, `b12Item`, `byDay`, `fullDay`, `latest`, `hba1cIntervalMonths`, `clinicianHba1cGoal` and `latestStart`.
- Nothing else in the module changes behaviour. `dueItems` and every existing test stay as they are.

- [ ] **Step 1: Write the failing tests.** Append to `src/health/cadence.test.ts`, and add `nextCheck` to its import. The file's own fixtures (`input`, `owner`, `checkDay`, `lab`, `NOW` = Thursday 8 October 2026, 09:00) are used.

```ts
describe('nextCheck: when a hub says the next check comes (journey §8.2)', () => {
  it('a blood pressure check day today is the item itself', () => {
    expect(nextCheck(input(), 'bloodPressure')).toMatchObject({ due: true, title: 'Blood pressure check day' });
  });

  it('after a complete check day, the next is a week on, with the routine’s source', () => {
    const r = nextCheck(input({ observations: checkDay('2026-10-06') }), 'bloodPressure');
    expect(r).toMatchObject({ due: false, title: 'Next check day' });
    expect(r?.detail).toBe('Tuesday 13 October: two readings in the morning and two in the evening, a minute apart.');
    expect(r?.source).toMatch(/European Society of Hypertension/);
  });

  it('nothing to schedule without a home monitor or high blood pressure', () => {
    expect(nextCheck(input({ profile: owner({ bpMonitor: false }) }), 'bloodPressure')).toBeUndefined();
    expect(nextCheck(input({ profile: owner({ hypertension: 'none' }) }), 'bloodPressure')).toBeUndefined();
  });

  it('an untreated block on record: repeats are the clinician’s call', () => {
    const block = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'].flatMap(checkDay);
    expect(nextCheck(input({ profile: owner({ hypertension: 'untreated' }), observations: block }), 'bloodPressure'))
      .toMatchObject({ due: false, title: 'Your home readings are on record' });
  });

  it('HbA1c within goal: the month it is usually due, six months on', () => {
    const r = nextCheck(input({ observations: [lab('hba1c', '2026-07-01', 6.5)] }), 'hba1c');
    expect(r).toMatchObject({ due: false, title: 'Next HbA1c test' });
    expect(r?.detail).toBe('Usually due in January 2027: about every 6 months while it is within your goal.');
  });

  it('HbA1c missing or due: the item itself; nothing for someone without diabetes', () => {
    expect(nextCheck(input(), 'hba1c')).toMatchObject({ due: true, title: 'Add your last HbA1c' });
    expect(nextCheck(input({ observations: [lab('hba1c', '2026-03-01', 7.5)] }), 'hba1c')).toMatchObject({ due: true, title: 'HbA1c due' });
    expect(nextCheck(input({ profile: owner({ diabetes: 'none' }), observations: [lab('hba1c', '2026-07-01', 5.6)] }), 'hba1c')).toBeUndefined();
  });

  it('B12 after more than 4 years of metformin: a year after the last result; nothing without metformin', () => {
    const p = owner({ metformin: true, metforminSince: '2019' });
    const r = nextCheck(input({ profile: p, observations: [lab('b12', '2026-03-01', 320)] }), 'b12');
    expect(r).toMatchObject({ due: false, title: 'Next vitamin B12 check' });
    expect(r?.detail).toBe('Usually due in March 2027: once a year is usual after more than 4 years on metformin.');
    expect(nextCheck(input(), 'b12')).toBeUndefined();
  });
});
```

Run: `npx vitest run src/health/cadence.test.ts`
Expected: FAIL, "nextCheck is not a function" (or an import error).

- [ ] **Step 2: Name the two blood pressure sources once.** In `src/health/cadence.ts`, above `bloodPressureItem`:

```ts
/** Where the weekly check day comes from (`weeklyCheck`, `nextCheck`). */
const ESH_WEEKLY = 'Once a week is a low-effort routine within the European Society of Hypertension’s home monitoring advice (2021).';
/** Where the diagnostic block comes from (`diagnosticWeek`, `nextCheck`). */
const NICE_BLOCK = 'NICE guideline NG136, 1.2.7: readings at home over at least 4 days, ideally 7, which your clinician then reviews.';
```

In `weeklyCheck` and `diagnosticWeek`, replace the two `source:` string literals with `ESH_WEEKLY` and `NICE_BLOCK`. The strings are unchanged.

- [ ] **Step 3: Say why B12 is checked in one place.** Above `b12Item`:

```ts
/** Why B12 is checked once a year for this person, or nothing when it isn't (ADA 3.10). */
function b12Why(profile: UserProfile, today: string): string | undefined {
  if (profile.health.metformin !== true) return undefined;
  const start = latestStart(profile.health.metforminSince);
  const longTerm = start !== undefined && format(addYears(parseISO(start), 4), 'yyyy-MM-dd') < today;
  if (longTerm) return 'after more than 4 years on metformin';
  return profile.food?.pattern === 'vegan' ? 'on metformin with a vegan diet' : undefined;
}
```

Rewrite the start of `b12Item` to use it. The rest of `b12Item` is unchanged.

```ts
function b12Item(input: CadenceInput, profile: UserProfile): DueItem | undefined {
  const today = dayOf(input.now);
  const why = b12Why(profile, today);
  if (!why) return undefined;
  const last = latest(input.observations, 'b12');
  if (last && format(addMonths(parseISO(last.day), 12), 'yyyy-MM-dd') > today) return undefined;
  return {
    kind: 'b12',
    title: 'Vitamin B12 check',
    detail: `Once a year is usual ${why}. ${last
      ? `Your last result was ${Math.round(last.value)} ${last.unit} on ${spoken(last.day, today)}.`
      : 'No result recorded yet.'}`,
    source: 'ADA Standards of Care 2026, recommendation 3.10.',
    action: { label: 'Add a result', to: TRACK_ADD.b12 },
  };
}
```

- [ ] **Step 4: Write** `nextCheck`. At the end of the module:

```ts
// ============================================================================
// When a hub says the next check comes
// ============================================================================

export interface NextCheck {
  /** Due today: the item itself. Otherwise, when the model next asks for it. */
  due: boolean;
  title: string;
  detail: string;
  /** Where the interval comes from, in plain words. */
  source: string;
}

/**
 * When a check comes round next, for its hub (journey §8.2, "When to check
 * next"): today's item when one is due, otherwise when the model next asks
 * for it. Nothing for a check the model doesn't schedule: glucose without a
 * clinician's plan, vitamin D, weight.
 */
export function nextCheck(input: CadenceInput, what: 'bloodPressure' | 'hba1c' | 'b12'): NextCheck | undefined {
  const { profile } = input;
  if (!profile) return undefined;
  const today = dayOf(input.now);
  const asItem = (item: DueItem): NextCheck => ({ due: true, title: item.title, detail: item.detail, source: item.source });

  if (what === 'bloodPressure') {
    const { hypertension, bpMonitor } = profile.health;
    if (hypertension === 'none' || !bpMonitor) return undefined;
    const due = bloodPressureItem(input, profile);
    if (due) return asItem(due.item);
    const days = byDay(pairBloodPressure([...input.observations]));
    if (hypertension !== 'treated') {
      const complete = [...days.keys()].some(d => [0, 1, 2, 3].every(i => fullDay(days.get(shiftDay(d, i)))));
      return complete
        ? { due: false, title: 'Your home readings are on record', detail: 'Your clinician decides whether you need another block of readings.', source: NICE_BLOCK }
        : { due: false, title: 'Blood pressure week', detail: 'Today’s readings are done. Carry on tomorrow: at least 4 days in a row, ideally 7.', source: NICE_BLOCK };
    }
    const last = [...days].filter(([d, s]) => d <= today && fullDay(s)).map(([d]) => d).sort().at(-1);
    if (last === undefined) return undefined;
    return {
      due: false, title: 'Next check day',
      detail: `${format(parseISO(shiftDay(last, 7)), 'EEEE d MMMM')}: two readings in the morning and two in the evening, a minute apart.`,
      source: ESH_WEEKLY,
    };
  }

  if (what === 'hba1c') {
    const item = hba1cItem(input, profile);
    if (item) return asItem(item);
    const { diabetes } = profile.health;
    if (diabetes !== 'type1' && diabetes !== 'type2' && diabetes !== 'other') return undefined;
    const last = latest(input.observations, 'hba1c');
    if (!last) return undefined;
    const target = clinicianHba1cGoal(profile);
    const months = hba1cIntervalMonths(last, target !== undefined ? { value: target, unit: '%' } : ADA_HBA1C_GOAL);
    return {
      due: false, title: 'Next HbA1c test',
      detail: `Usually due in ${format(addMonths(parseISO(last.day), months), 'MMMM yyyy')}: about every ${months} months ${months === 6 ? 'while it is within your goal' : 'until it is within your goal'}.`,
      source: `${HBA1C_CADENCE_CITATION}.`,
    };
  }

  const item = b12Item(input, profile);
  if (item) return asItem(item);
  const why = b12Why(profile, today);
  const last = latest(input.observations, 'b12');
  if (!why || !last) return undefined;
  return {
    due: false, title: 'Next vitamin B12 check',
    detail: `Usually due in ${format(addMonths(parseISO(last.day), 12), 'MMMM yyyy')}: once a year is usual ${why}.`,
    source: 'ADA Standards of Care 2026, recommendation 3.10.',
  };
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/health`
Expected: PASS, including the unchanged `dueItems` tests.

- [ ] **Step 6: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/health/cadence.ts src/health/cadence.test.ts
git commit -m "feat: Say when each scheduled check comes round next"
```

---

### Task 10: The reading hub model

**Files:**
- Create: `src/screens/hub/reading.ts`
- Create: `src/screens/hub/reading.test.ts`

**Interfaces:**
- Produces:
  - `type ReadingHubId = 'glucose' | 'bp' | 'weight' | 'water' | 'sleep' | 'waist' | 'labs'`;
  - `interface ReadingSpec { id: ReadingHubId; metric: MetricId; add: AddRequest; addLabel: string; first: string; why: string }`;
  - `readingSpec(id: string, metric?: string | null): ReadingSpec | undefined`;
  - `labFrom(value: string | null | undefined): LabKind`;
  - `hubAdd(spec: ReadingSpec, add: string | null | undefined): AddRequest | undefined`;
  - `interface Latest { value: string; when: string; context?: string; source: string; flag?: string; reading?: Interpretation; ref: RecordRef }`;
  - `latestFor(spec, observations, ctx: { prefs: DisplayPrefs; profile: UserProfile | undefined; current: string }): Latest | undefined`;
  - `interface WeekValue { day: string; name: string; text: string; entered: boolean }`;
  - `weekValues(spec, observations, prefs, current): WeekValue[]`;
  - `historyRange(spec: Pick<ReadingSpec, 'metric'>, observations, current): { from: string; to: string }`.
- Consumes v1's:
  - `METRICS` and `MetricId`;
  - `parseAddParam`, `AddRequest` and `LabKind`;
  - `pairBloodPressure`, `summariseDay` and `entryFor`;
  - `compareObservations` and `isBpKind`;
  - `formatObservation`, `formatClock`, `formatDayRelative`, `hasClockTime`, `inDisplayUnit`, `sourceLabel` and `tagLabel`;
  - `glucoseFlag` and `pressureFlag`;
  - `interpretGlucose`, `interpretPressure` and `clinicianOverrides`;
  - `formatPressure` and `RecordRef`;
  - `weekOf` and `addDays`.

- [ ] **Step 1: Write the failing test** `src/screens/hub/reading.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { bpContext, newObservation, type Observation } from '@/health/observation';
import { DEFAULT_PREFS } from '@/screens/track/format';
import { historyRange, hubAdd, labFrom, latestFor, readingSpec, weekValues } from './reading';

// Thursday 8 October 2026.
const TODAY = '2026-10-08';
const g = (id: string, day: string, time: string, value: number, tag?: Observation['tag']) =>
  newObservation({ id, kind: 'glucose', value, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: `${day}T${time}:00.000+05:30`, ...(tag ? { tag } : {}) });
const bp = (id: string, day: string, time: string, s: number, d: number): Observation[] => {
  const shared = { at: `${day}T${time}:00.000+05:30`, scope: 'pointInTime' as const, source: 'manual' as const, context: bpContext(id) };
  return [
    newObservation({ ...shared, id: `${id}:s`, kind: 'bloodPressureSystolic', value: s }),
    newObservation({ ...shared, id: `${id}:d`, kind: 'bloodPressureDiastolic', value: d }),
  ];
};
const ctx = { prefs: { ...DEFAULT_PREFS, hour12: true }, profile: undefined, current: TODAY };

describe('readingSpec and labFrom (journey §8.2, B-14)', () => {
  it('knows each reading hub, and nothing else', () => {
    expect(readingSpec('glucose')?.add).toEqual({ kind: 'glucose' });
    expect(readingSpec('bp')?.metric).toBe('bloodPressure');
    expect(readingSpec('steps')).toBeUndefined();
    expect(readingSpec('nope')).toBeUndefined();
  });
  it('Labs keeps its kind', () => {
    expect(readingSpec('labs', 'b12')).toMatchObject({ metric: 'b12', add: { kind: 'lab', lab: 'b12' } });
    expect(labFrom('vitd')).toBe('vitaminD');
    expect(labFrom('nonsense')).toBe('hba1c');
    expect(labFrom(null)).toBe('hba1c');
  });
});

describe('hubAdd: a link opens this hub’s own form, never another’s', () => {
  it('opens the form asked for only when it is this hub’s', () => {
    const glucose = readingSpec('glucose')!;
    expect(hubAdd(glucose, 'glucose')).toEqual({ kind: 'glucose' });
    expect(hubAdd(glucose, 'bloodPressure')).toBeUndefined();
    expect(hubAdd(glucose, null)).toBeUndefined();
    expect(hubAdd(readingSpec('bp')!, 'bloodPressureSystolic')).toEqual({ kind: 'bloodPressure' });
    expect(hubAdd(readingSpec('labs', 'b12')!, 'b12')).toEqual({ kind: 'lab', lab: 'b12' });
    expect(hubAdd(readingSpec('labs', 'hba1c')!, 'b12')).toBeUndefined();
  });
});

describe('latestFor (journey §8.2 Latest, §4.10)', () => {
  it('glucose: the latest reading, with when, context and source, the contract’s word and v1’s reading of it', () => {
    const l = latestFor(readingSpec('glucose')!, [g('a', '2026-10-07', '08:00', 140, 'fasting'), g('b', TODAY, '09:05', 62, 'beforeExercise')], ctx);
    expect(l).toMatchObject({ value: '62 mg/dL', when: 'Today · 9:05 am', context: 'Before exercise', source: 'Manual entry', flag: 'Low', ref: { type: 'reading', id: 'b' } });
    expect(l?.reading?.text).toMatch(/^A low \(ADA level 1\)/);
  });

  it('blood pressure: the latest reading, put back together from its halves', () => {
    const l = latestFor(readingSpec('bp')!, [...bp('r1', TODAY, '07:30', 132, 84), ...bp('r2', TODAY, '07:31', 128, 82)], ctx);
    expect(l).toMatchObject({ value: '128/82 mmHg', when: 'Today · 7:31 am', ref: { type: 'pressure' } });
  });

  it('water: the last day with a total', () => {
    const w = newObservation({ id: 'w', kind: 'water', value: 1500, unit: 'ml', scope: 'dayTotal', source: 'manual', at: '2026-10-06T10:00:00.000+05:30' });
    expect(latestFor(readingSpec('water')!, [w], ctx)).toMatchObject({ value: '1,500 ml', when: 'Tuesday, 6 October' });
  });

  it('nothing yet: no Latest', () => {
    expect(latestFor(readingSpec('weight')!, [], ctx)).toBeUndefined();
  });
});

describe('weekValues (journey §8.2 This week, D14)', () => {
  it('Monday to today, a line a day, each value with its unit, and "Not entered" on a day with none', () => {
    const obs = [g('a', '2026-10-06', '07:00', 112, 'fasting'), g('b', '2026-10-06', '13:30', 168, 'afterMeal'), g('c', '2026-10-06', '20:00', 130)];
    const week = weekValues(readingSpec('glucose')!, obs, DEFAULT_PREFS, TODAY);
    expect(week.map(d => d.name)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday']);
    expect(week[0]).toMatchObject({ text: 'Not entered', entered: false });
    expect(week[1].text).toBe('112 mg/dL fasting, 168 mg/dL after a meal and 1 more');
  });

  it('blood pressure reads as pairs', () => {
    expect(weekValues(readingSpec('bp')!, bp('r1', '2026-10-05', '07:30', 132, 84), DEFAULT_PREFS, TODAY)[0].text).toBe('132/84 mmHg');
  });
});

describe('historyRange', () => {
  it('runs from the first record of the hub’s kinds to today', () => {
    expect(historyRange({ metric: 'glucose' }, [g('a', '2026-01-02', '08:00', 100)], TODAY)).toEqual({ from: '2026-01-02', to: TODAY });
    expect(historyRange({ metric: 'glucose' }, [], TODAY)).toEqual({ from: TODAY, to: TODAY });
  });
});
```

If v1's formatting differs in a detail, for example `formatDayRelative` writing "Tuesday 6 October", change the expected string to v1's. Don't change the formatter.

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/screens/hub/reading.test.ts`
Expected: FAIL, "Cannot find module './reading'".

- [ ] **Step 3: Write** `src/screens/hub/reading.ts`

```ts
/**
 * The reading hubs (journey §8.2), for Glucose, Blood pressure, Weight,
 * Water, Sleep, Waist and Labs:
 * - Latest, with when it was measured and what it means;
 * - "Add reading", straight into that metric's own form;
 * - this week's values;
 * - every record, each opening where it is corrected.
 * Steps and Back & leg have their own hubs, on the same parts. Plain
 * functions over v1's tested pieces, so a hub only lays them out.
 */
import { entryFor, pairBloodPressure, summariseDay } from '@/health/aggregate';
import { compareObservations, isBpKind, type Observation, type ObservationKind } from '@/health/observation';
import type { UserProfile } from '@/types/profile';
import { glucoseFlag, pressureFlag } from '@/screens/track/escalation';
import {
  formatClock, formatDayRelative, formatObservation, hasClockTime, inDisplayUnit, sourceLabel, tagLabel, type DisplayPrefs,
} from '@/screens/track/format';
import { parseAddParam, type AddRequest, type LabKind } from '@/screens/track/logKinds';
import { METRICS, type MetricId } from '@/screens/track/metrics';
import { addDays, weekOf } from '@/screens/track/periods';
import { clinicianOverrides, interpretGlucose, interpretPressure, type Interpretation } from '@/screens/track/targets';
import { formatPressure, type RecordRef } from '@/screens/track/timeline';
import type { GlucoseUnit } from '@/screens/track/units';

export type ReadingHubId = 'glucose' | 'bp' | 'weight' | 'water' | 'sleep' | 'waist' | 'labs';

export interface ReadingSpec {
  id: ReadingHubId;
  /** v1's metric: its kinds, record rows, notes and trend. For Labs, the lab `?metric=` names. */
  metric: MetricId;
  /** The form "Add reading" opens (QuickLog's `initial`). */
  add: AddRequest;
  addLabel: string;
  /** "Add your first …", with why (journey §8.4, "Nothing recorded yet"). */
  first: string;
  why: string;
}

const SPECS: Record<ReadingHubId, Omit<ReadingSpec, 'id'>> = {
  glucose: { metric: 'glucose', add: { kind: 'glucose' }, addLabel: 'Add reading', first: 'Add your first glucose reading', why: 'Each reading shows here with when it was taken and what it means. A reading from today also counts in today’s check-in.' },
  bp: { metric: 'bloodPressure', add: { kind: 'bloodPressure' }, addLabel: 'Add reading', first: 'Add your first blood pressure reading', why: 'Readings show here with their time, so you and your clinician can see the pattern.' },
  weight: { metric: 'weight', add: { kind: 'weight' }, addLabel: 'Add reading', first: 'Add your first weight', why: 'Weight shows here with its date, and your BMI once your height is known.' },
  water: { metric: 'water', add: { kind: 'water' }, addLabel: 'Add water', first: 'Add water', why: 'Each glass adds to the day’s total.' },
  sleep: { metric: 'sleep', add: { kind: 'sleep' }, addLabel: 'Add sleep', first: 'Add last night’s sleep', why: 'Your best estimate is fine. Each night counts on the day you woke up.' },
  waist: { metric: 'waist', add: { kind: 'waist' }, addLabel: 'Add reading', first: 'Add your first waist measurement', why: 'Measurements show here with their date.' },
  labs: { metric: 'hba1c', add: { kind: 'lab', lab: 'hba1c' }, addLabel: 'Add a result', first: 'Add a result', why: 'Results show here with their test date, and when the next test is usually due.' },
};

/** Labs keeps its kind (B-14): `?metric=b12` or `vitaminD`, and HbA1c otherwise. */
export function labFrom(value: string | null | undefined): LabKind {
  if (value === 'b12') return 'b12';
  if (value === 'vitaminD' || value === 'vitd') return 'vitaminD';
  return 'hba1c';
}

/** The hub for `/hub/{id}`, or nothing for an id that is no reading hub here. */
export function readingSpec(id: string, metric?: string | null): ReadingSpec | undefined {
  if (!Object.hasOwn(SPECS, id)) return undefined;
  const hub = id as ReadingHubId;
  if (hub !== 'labs') return { id: hub, ...SPECS[hub] };
  const lab = labFrom(metric);
  return { id: hub, ...SPECS.labs, metric: lab, add: { kind: 'lab', lab } };
}

/** The form a link's `?add=` asks for on arrival (v1's parameter, `parseAddParam`): this hub's own, never another's. */
export function hubAdd(spec: ReadingSpec, add: string | null | undefined): AddRequest | undefined {
  const asked = parseAddParam(add);
  if (!asked || asked.kind !== spec.add.kind) return undefined;
  if (asked.kind === 'lab' && asked.lab !== undefined && asked.lab !== spec.add.lab) return undefined;
  return spec.add;
}

export interface Latest {
  /** "112 mg/dL", "132/84 mmHg", "1,500 ml". */
  value: string;
  /** "Today · 9:05 am", "Yesterday", or the long date. */
  when: string;
  /** "Fasting", "Morning". */
  context?: string;
  /** "Manual entry", "From your check-in". */
  source: string;
  /** The safety contract's word for it, never colour alone: "Low", "Very high". */
  flag?: string;
  /** v1's reading of this one value, with its framework. */
  reading?: Interpretation;
  /** The record behind it, where it is corrected. */
  ref: RecordRef;
}

const whenOf = (o: Pick<Observation, 'day' | 'at' | 'context' | 'kind'>, prefs: DisplayPrefs, current: string) =>
  `${formatDayRelative(o.day, current)}${hasClockTime(o) ? ` · ${formatClock(o.at, prefs.hour12)}` : ''}`;
const latestOf = (observations: readonly Observation[], kinds: readonly ObservationKind[]) =>
  observations.filter(o => kinds.includes(o.kind) && o.scope === 'pointInTime').sort(compareObservations).at(-1);

/** The latest value, as Latest shows it (journey §8.2, §4.10), or nothing yet. */
export function latestFor(
  spec: ReadingSpec, observations: readonly Observation[], { prefs, profile, current }: { prefs: DisplayPrefs; profile: UserProfile | undefined; current: string },
): Latest | undefined {
  const kinds = METRICS[spec.metric].kinds;
  if (spec.id === 'bp') {
    const r = pairBloodPressure(observations.filter(o => isBpKind(o.kind))).sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).at(-1);
    if (!r) return undefined;
    const first = r.halves[0];
    const severe = r.systolic !== null && r.diastolic !== null ? interpretPressure(r.systolic, r.diastolic) : undefined;
    const flag = pressureFlag(r.systolic, r.diastolic);
    return {
      value: formatPressure(r), when: whenOf({ ...first, at: r.at }, prefs, current), source: sourceLabel(first),
      ...(r.tag !== undefined ? { context: tagLabel(r.tag) } : {}), ...(flag ? { flag } : {}), ...(severe ? { reading: severe } : {}),
      ref: { type: 'pressure', id: r.id },
    };
  }
  if (spec.id === 'water' || spec.id === 'sleep') {
    const kind = kinds[0];
    const day = [...new Set(observations.filter(o => o.kind === kind && o.scope === 'dayTotal').map(o => o.day))].sort().at(-1);
    const e = day ? entryFor(summariseDay(day, observations), kind, 'dayTotal') : undefined;
    if (!e || e.total === null) return undefined;
    return {
      value: formatObservation({ kind, value: e.total, unit: e.unit ?? e.latest.unit }, prefs), when: formatDayRelative(e.latest.day, current),
      source: sourceLabel(e.latest), ref: { type: 'reading', id: e.latest.id },
    };
  }
  const o = latestOf(observations, kinds);
  if (!o) return undefined;
  const base: Latest = {
    value: formatObservation(o, prefs), when: whenOf(o, prefs, current), source: sourceLabel(o),
    ...(o.tag !== undefined ? { context: tagLabel(o.tag) } : {}), ref: { type: 'reading', id: o.id },
  };
  if (spec.id !== 'glucose') return base;
  const flag = glucoseFlag(o.value, o.unit as GlucoseUnit);
  const timing = { at: o.at, ...(o.mealStartedAt ? { mealStartedAt: o.mealStartedAt } : {}) };
  return { ...base, ...(flag ? { flag } : {}), reading: interpretGlucose(inDisplayUnit(o, prefs).value, prefs.glucose, o.tag, timing, clinicianOverrides(profile)) };
}

export interface WeekValue {
  day: string;
  /** "Monday". */
  name: string;
  /** The day's values in words, with their units, or "Not entered" (D14). */
  text: string;
  entered: boolean;
}

const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
/** Two in full, then how many more: a day's line stays a line. */
const some = (parts: string[]) => (parts.length <= 2 ? parts.join(', ') : `${parts.slice(0, 2).join(', ')} and ${parts.length - 2} more`);

/** This week, Monday to today, one line a day (journey §8.2). Labs have none: they are dated points (A-45). */
export function weekValues(spec: ReadingSpec, observations: readonly Observation[], prefs: DisplayPrefs, current: string): WeekValue[] {
  const { from } = weekOf(current);
  const kinds = METRICS[spec.metric].kinds;
  const out: WeekValue[] = [];
  for (let i = 0; i < 7; i++) {
    const day = addDays(from, i);
    if (day > current) break;
    const own = observations.filter(o => o.day === day && kinds.includes(o.kind));
    let text: string | undefined;
    if (spec.id === 'bp') {
      const pairs = pairBloodPressure(own).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
      if (pairs.length) text = some(pairs.map(formatPressure));
    } else if (spec.id === 'water' || spec.id === 'sleep') {
      const e = entryFor(summariseDay(day, observations), kinds[0], 'dayTotal');
      if (e && e.total !== null) text = formatObservation({ kind: kinds[0], value: e.total, unit: e.unit ?? e.latest.unit }, prefs);
    } else if (spec.id === 'glucose') {
      const readings = own.filter(o => o.scope === 'pointInTime').sort(compareObservations);
      if (readings.length) text = some(readings.map(o => `${formatObservation(o, prefs)}${o.tag ? ` ${tagLabel(o.tag).toLowerCase()}` : ''}`));
    } else {
      const last = own.filter(o => o.scope === 'pointInTime').sort(compareObservations).at(-1);
      if (last) text = formatObservation(last, prefs);
    }
    out.push({ day, name: NAMES[i], text: text ?? 'Not entered', entered: text !== undefined });
  }
  return out;
}

/** Every day with a record of the hub's kinds, up to today: the range History lists (journey §8.2). */
export function historyRange(spec: Pick<ReadingSpec, 'metric'>, observations: readonly Observation[], current: string): { from: string; to: string } {
  const kinds = METRICS[spec.metric].kinds;
  let from = current;
  for (const o of observations) if (kinds.includes(o.kind) && o.day < from) from = o.day;
  return { from, to: current };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/screens/hub/reading.test.ts`
Expected: PASS.

- [ ] **Step 5: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/hub/reading.ts src/screens/hub/reading.test.ts
git commit -m "feat: Model a reading hub: Latest, its own form, this week and history"
```

---

### Task 11: The reading hubs, and links that open their forms

**Files:**
- Create: `src/screens/hub/ReadingHub.tsx`
- Modify: `src/routes.tsx` (`/hub/:id` → `ReadingHub`; `/hub/steps` on v1's metric screen until Task 12)
- Modify: `src/health/cadence.ts` (`TRACK_ADD` opens the check's hub with its form)
- Modify: `src/content/schema.ts` (`ROUTES.add*` the same way)

**Interfaces:**
- Consumes:
  - Task 10's model;
  - `nextCheck` (Task 9);
  - `metricNotes`, `metricRows`, `METRICS` and `LAB_OPTIONS`;
  - `QuickLog`;
  - `displayPrefs`;
  - `useToday`;
  - `Interpretation` and `Segmented` (`@/screens/track/ui`);
  - `HubFrame`, `HubSection`, `SeeTrends`, `HistoryList` and `useHubOrigin`;
  - `categoryById`.
- Produces:
  - `ReadingHub` (default export), at `/hub/glucose`, `/hub/bp`, `/hub/weight`, `/hub/water`, `/hub/sleep`, `/hub/waist` and `/hub/labs?metric=…`;
  - a `?add=<kind>` on any of them, which opens that hub's own form once on arrival.

- [ ] **Step 1: Write** `src/screens/hub/ReadingHub.tsx`

```tsx
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2Icon, PlusIcon } from 'lucide-react';
import { categoryById } from '@/categories';
import { Group, Row } from '@/components/hig/List';
import { nextCheck } from '@/health/cadence';
import { useStore } from '@/store/useStore';
import { displayPrefs, LAB_OPTIONS } from '@/screens/track/logKinds';
import { METRICS, metricNotes, metricRows } from '@/screens/track/metrics';
import { QuickLog } from '@/screens/track/QuickLog';
import { Interpretation, Segmented } from '@/screens/track/ui';
import { useToday } from '@/screens/track/useToday';
import { HistoryList } from './HistoryList';
import { HubFrame, HubSection, SeeTrends } from './HubFrame';
import { useHubOrigin } from './hooks';
import { historyRange, hubAdd, latestFor, readingSpec, weekValues, type ReadingSpec } from './reading';

/**
 * A reading hub (journey §8.2), for Glucose, Blood pressure, Weight, Water,
 * Sleep, Waist and Labs:
 * - Latest: the value with when it was taken, its unit and context, v1's
 *   reading of it, and the notes the metric always carries;
 * - "When to check next", from the cadence model;
 * - "Add reading", straight into the metric's own form;
 * - this week's values;
 * - History, each record opening where it is corrected;
 * - the trend.
 * With nothing recorded yet it says "Add your first …", and why (§8.4).
 */
export default function ReadingHub() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const spec = readingSpec(id, params.get('metric'));
  if (!spec) return <Navigate to="/home?moved=1" replace />;
  return <ReadingScreen key={`${spec.id}:${spec.metric}`} spec={spec} />;
}

function ReadingScreen({ spec }: { spec: ReadingSpec }) {
  const category = categoryById(spec.id);
  const { observations, profile, settings } = useStore();
  const current = useToday();
  const origin = useHubOrigin(category.title);
  const [params, setParams] = useSearchParams();
  const prefs = useMemo(() => displayPrefs(settings, profile, observations), [settings, profile, observations]);
  // A link's `?add=` opens this hub's own form on arrival, once, then leaves the address (D55).
  const [logOpen, setLogOpen] = useState(() => hubAdd(spec, params.get('add')) !== undefined);
  useEffect(() => {
    if (!params.has('add')) return;
    setParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('add');
      return next;
    }, { replace: true });
  }, [params, setParams]);
  const [notice, setNotice] = useState<string>();
  const [fresh, setFresh] = useState<readonly string[]>([]);
  // A brief confirmation, as on Today's log; the reading itself stays in the list.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(undefined), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const own = useMemo(() => observations.filter(o => METRICS[spec.metric].kinds.includes(o.kind)), [observations, spec.metric]);
  const latest = useMemo(() => latestFor(spec, observations, { prefs, profile, current }), [spec, observations, prefs, profile, current]);
  const notes = metricNotes(spec.metric, own, { prefs, profile, habits: settings.habits, glucoseView: 'all', current });
  const scheduled = spec.id === 'bp' ? 'bloodPressure' : spec.metric === 'hba1c' || spec.metric === 'b12' ? spec.metric : undefined;
  const next = scheduled ? nextCheck({ now: new Date(), ...(profile ? { profile } : {}), observations }, scheduled) : undefined;
  const week = spec.id === 'labs' ? [] : weekValues(spec, observations, prefs, current);
  const rows = useMemo(
    () => metricRows(spec.metric, observations, historyRange(spec, observations, current), prefs, current),
    [spec, observations, prefs, current],
  );
  const lab = spec.id === 'labs' ? spec.metric : undefined;

  return (
    <HubFrame category={category}>
      {lab && (
        <Segmented
          label="Which result"
          options={LAB_OPTIONS.map(o => ({ id: o.kind, label: o.title }))}
          value={lab}
          onChange={k => setParams({ metric: k }, { replace: true, preventScrollReset: true })}
        />
      )}

      <div role="status" aria-live="polite" className="empty:hidden">
        {notice && (
          <p className="flex items-start gap-2 rounded-xl bg-grouped-card px-4 py-3 text-[length:var(--text-subhead)]">
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-tint" aria-hidden />
            <span>{notice}</span>
          </p>
        )}
      </div>

      <HubSection title="Latest">
        <div className="flex flex-col gap-3 rounded-2xl bg-grouped-card p-4">
          {latest ? (
            <>
              <p className="numeric text-[length:var(--text-title-2)] font-bold leading-tight">
                {latest.value}
                {latest.flag && <span className="ml-2 text-[length:var(--text-body)] font-semibold text-stop">{latest.flag}</span>}
              </p>
              <p className="text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{[latest.when, latest.context, latest.source].filter(Boolean).join(' · ')}</p>
            </>
          ) : (
            <>
              <p className="text-[length:var(--text-title-2)] font-semibold leading-tight">{spec.first}</p>
              <p className="text-[length:var(--text-body)] leading-snug text-muted-foreground">{spec.why}</p>
            </>
          )}
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            className="press-feedback flex min-h-[60px] w-full items-center justify-center gap-2 rounded-xl bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint"
          >
            <PlusIcon className="size-5" aria-hidden />
            {spec.addLabel}
          </button>
        </div>
      </HubSection>

      {latest?.reading && <Interpretation text={latest.reading.text} tone={latest.reading.tone} framework={latest.reading.framework} />}
      {notes.map(n => (
        <Interpretation
          key={n.key}
          text={n.reading.text}
          tone={n.reading.tone}
          framework={n.reading.framework}
          extra={n.extra ? <p className="text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{n.extra}</p> : undefined}
        />
      ))}

      {spec.id === 'weight' && (
        // BMI is worked out, not entered: it changes with the weight here and the height in the profile (journey §5.1).
        <Group>
          <Row as={Link} to="/me/profile" state={origin} viewTransition label="Your height" detail={profile?.heightCm ? `${profile.heightCm} cm` : 'Not entered: BMI needs it'} chevron />
        </Group>
      )}

      {next && (
        <HubSection title="When to check next" footer={`${next.source} General information, not medical advice.`}>
          <div className="flex flex-col gap-1 rounded-2xl bg-grouped-card p-4">
            <p className={next.due ? 'text-[length:var(--text-body)] font-semibold leading-snug text-caution' : 'text-[length:var(--text-body)] font-semibold leading-snug'}>{next.title}</p>
            <p className="text-[length:var(--text-body)] leading-snug">{next.detail}</p>
          </div>
        </HubSection>
      )}

      {week.length > 0 && (
        <HubSection title="This week">
          <Group>{week.map(d => <Row key={d.day} label={d.name} detail={d.text} />)}</Group>
        </HubSection>
      )}

      <HistoryList
        title={lab ? 'Results' : 'History'}
        rows={rows.map(r => ({ key: r.key, label: r.label, detail: r.detail, ref: r.ref, ids: r.ids }))}
        origin={origin}
        empty="Nothing here yet. Each one shows here once it is added."
        fresh={fresh}
      />
      <SeeTrends category={category} {...(lab ? { search: `?metric=${lab}` } : {})} origin={origin} />

      <QuickLog open={logOpen} onOpenChange={setLogOpen} initial={spec.add} onSaved={r => { setFresh(r.ids); setNotice(`Saved on this device: ${r.summary}.`); }} prefs={prefs} />
    </HubFrame>
  );
}
```

If `Segmented`'s option field is called `value` rather than `id` in `src/screens/track/ui.tsx`, match it, as v1's `MetricDetail` does.

- [ ] **Step 2: Mount it.** In `src/routes.tsx`:
  - replace the `MetricFor` element at `/hub/:id` with `hub(<ReadingHub />)`, using `const ReadingHub = lazy(() => import('@/screens/hub/ReadingHub'));`;
  - until Task 12 builds the Steps hub, keep Steps on v1's metric screen, before `/hub/:id`:

    ```tsx
    const MetricDetail = lazy(() => import('@/screens/track/MetricDetail').then(m => ({ default: m.MetricDetail })));
    // …
            <Route path="/hub/steps" element={hub(<MetricDetail kind="steps" />)} />
    ```

  - `/trends/:id` keeps `MetricFor trend`.

- [ ] **Step 3: Each reading's trend.** "See trends" on each reading hub opens `/trends/<id>`, which is v1's metric screen for it until Plan 3 (`MetricFor trend`). Labs carries its `?metric=`. A category with no v1 chart goes to Trends (Task 3).

- [ ] **Step 4: Links that add a reading open its hub with the form.**
  - **`src/health/cadence.ts`:**

    ```ts
    /** Where each item's action lands: that check's hub, with its own form open (journey §8.2, D55). */
    export const TRACK_ADD = {
      bloodPressure: '/hub/bp?add=bloodPressure',
      hba1c: '/hub/labs?metric=hba1c&add=hba1c',
      b12: '/hub/labs?metric=b12&add=b12',
    } as const;
    ```

  - **`src/content/schema.ts`,** in `ROUTES`:

    ```ts
      /** A reading's hub, with its own form open on arrival (`?add=`, `parseAddParam`). */
      addGlucose: '/hub/glucose?add=glucose',
      addBloodPressure: '/hub/bp?add=bloodPressure',
      addWaist: '/hub/waist?add=waist',
    ```

  - Run `npx vitest run src/health src/content`. The tests name the routes through `TRACK_ADD` and `ROUTES`, and `checks.test.ts` parses their `?add=`, so they pass unchanged.

- [ ] **Step 5: Check by eye.** Run `npm run dev`. With P01:
  - **`/hub/glucose`:** "Add your first glucose reading", with why.
  - **Add reading:**
    - opens the Glucose form at once (the sheet titled "Glucose", not the list of kinds);
    - enter 112, Fasting, and Save;
    - the hub shows "Saved on this device: Glucose 112 mg/dL.";
    - Latest reads "112 mg/dL · Today · <time> · Fasting · Manual entry", with v1's ADA line;
    - History has the row, and the row opens the reading's detail, whose Back says "Glucose".
  - **`/hub/bp`:** "When to check next · Blood pressure check day", and "Two readings this morning and two this evening, a minute apart."
  - **`/hub/labs?metric=b12`:** the segmented "Which result" is on Vitamin B12. See trends goes to `/trends/labs?metric=b12`.
  - **`/hub/bp?add=bloodPressure`:** opens the BP form once. Close it, and reload: it doesn't open again.
  - **`/hub/glucose?add=bloodPressure`:** opens nothing.
  - **`/hub/weight`:** the BMI line, with "ICMR-NIN 2024 … above 27.5", and the "Your height" row.

- [ ] **Step 6: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/hub/ReadingHub.tsx src/routes.tsx src/health/cadence.ts src/content/schema.ts
git commit -m "feat: Make the reading hubs, and open a reading's own form from any link to add one"
```

---
### Task 12: The Steps hub, with Paste and the daily step goal

**Files:**
- Create: `src/screens/track/stepsDay.ts`
- Create: `src/screens/track/stepsDay.test.ts`
- Create: `src/screens/hub/StepsHub.tsx`
- Modify: `src/screens/home/week.ts`, `src/screens/home/week.test.ts` (Home's steps line through `stepsDayFigure`)
- Modify: `src/screens/track/QuickLog.tsx` (`TotalForm`: Paste, for steps)
- Modify: `src/routes.tsx` (`/hub/steps` → `StepsHub`)

**Interfaces:**
- Produces:
  - `interface StepsFigure { kind: 'entered' | 'atLeast' | 'walks' | 'none'; value?: string; source: string; steps?: number }`;
  - `stepsDayFigure(day: string, observations: readonly Observation[], hour12: boolean): StepsFigure`;
  - `stepsFromText(text: string): number | undefined`;
  - `StepsHub` (default export), at `/hub/steps`.
- Consumes:
  - `summariseDay` and `entryFor` (a day total's `contributed` is the statement behind it);
  - `compareStatements` (`@/health/observation`: a correction is stated at its `editedAt`);
  - `walkRecords` (each walk's `day`, `at` and `steps`);
  - `formatClock`, `hasClockTime` and `formatNumber` (Indian grouping);
  - `currentStepsGoal`, `stepsGoalOn`, `stepsProgress` and `StepsGoalSheet` (v1);
  - `STEPS_NOTE`;
  - `metricRows`;
  - `historyRange` (Task 10);
  - the hub parts (Tasks 3 and 5).

- [ ] **Step 1: Write the failing test** `src/screens/track/stepsDay.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { newObservation, type Observation } from '@/health/observation';
import { stepsDayFigure, stepsFromText } from './stepsDay';

const DAY = '2026-10-08';
const entered = (value: number, at: string) => newObservation({ id: `e${at}`, kind: 'steps', value, unit: 'steps', scope: 'dayTotal', source: 'manual', at });
const walk = (id: string, start: string, steps: number, minutes = 20) => [
  newObservation({ id: `${id}d`, kind: 'walkDuration', value: minutes, unit: 'min', scope: 'sessionObserved', source: 'measured', at: start, context: `walk:${id}`, coverageMs: minutes * 60_000 }),
  newObservation({ id: `${id}s`, kind: 'steps', value: steps, unit: 'steps', scope: 'sessionObserved', source: 'measured', at: start, context: `walk:${id}`, coverageMs: minutes * 60_000 }),
];

describe('stepsDayFigure (journey §9.6; D10, D14, D52)', () => {
  it('an entered total, with when it was entered', () => {
    expect(stepsDayFigure(DAY, [entered(6050, `${DAY}T18:00:00.000+05:30`)], true)).toEqual({ kind: 'entered', value: '6,050', steps: 6050, source: 'entered at 6:00 pm' });
  });

  it('walks only: what they counted, never called the day’s total', () => {
    expect(stepsDayFigure(DAY, walk('w1', `${DAY}T07:40:00.000+05:30`, 4210), true))
      .toEqual({ kind: 'walks', value: '4,210', steps: 4210, source: 'in FitStrong walks · day total not entered' });
  });

  it('a FitStrong walk after an entered total: at least both, with both sources', () => {
    const obs = [entered(6050, `${DAY}T12:00:05.000+05:30`), ...walk('w1', `${DAY}T17:00:00.000+05:30`, 1250)];
    expect(stepsDayFigure(DAY, obs, true))
      .toEqual({ kind: 'atLeast', value: 'at least 7,300', steps: 7300, source: '6,050 entered at 12:00 pm + 1,250 in walks after 12:00 pm' });
  });

  it('a walk before the entered total is already in it', () => {
    expect(stepsDayFigure(DAY, [...walk('w1', `${DAY}T07:40:00.000+05:30`, 1250), entered(6050, `${DAY}T18:00:00.000+05:30`)], true).kind).toBe('entered');
  });

  it('a past day’s total, stamped at noon, never adds the walks after noon (Review Focus 3)', () => {
    const obs = [entered(9000, `${DAY}T12:00:00.000+05:30`), ...walk('w1', `${DAY}T17:00:00.000+05:30`, 1200)];
    expect(stepsDayFigure(DAY, obs, true)).toEqual({ kind: 'entered', value: '9,000', steps: 9000, source: 'entered' });
  });

  it('a newer entered total replaces the earlier one', () => {
    const obs = [entered(6050, `${DAY}T12:00:05.000+05:30`), ...walk('w1', `${DAY}T17:00:00.000+05:30`, 1250), entered(8200, `${DAY}T21:00:00.000+05:30`)];
    expect(stepsDayFigure(DAY, obs, true)).toMatchObject({ kind: 'entered', value: '8,200' });
  });

  it('a total corrected later counts walks only from the correction, so nothing is counted twice', () => {
    const fixed: Observation = { ...entered(6050, `${DAY}T12:00:05.000+05:30`), value: 8200, editedAt: `${DAY}T21:00:00.000+05:30` };
    const obs = [fixed, ...walk('w1', `${DAY}T17:00:00.000+05:30`, 1250), ...walk('w2', `${DAY}T21:30:00.000+05:30`, 400)];
    expect(stepsDayFigure(DAY, obs, true))
      .toEqual({ kind: 'atLeast', value: 'at least 8,600', steps: 8600, source: '8,200 changed at 9:00 pm + 400 in walks after 9:00 pm' });
  });

  it('nothing at all: "Not entered"', () => {
    expect(stepsDayFigure(DAY, [], true)).toEqual({ kind: 'none', source: 'Not entered' });
  });
});

describe('stepsFromText (journey §9.6, Paste; Review Focus 4)', () => {
  it('the one number in the text, grouped either way', () => {
    const cases: [string, number][] = [
      ['6050', 6050], ['6,050', 6050], ['6,050 steps', 6050], ['Steps: 6 050', 6050], ['1,00,000', 100000], ['\n 4210 \n', 4210],
      // iOS and other locales group thousands with a no-break or a narrow no-break space.
      ['6\u00a0050', 6050], ['6\u202f050 steps', 6050],
    ];
    for (const [text, n] of cases) expect(stepsFromText(text), JSON.stringify(text)).toBe(n);
  });

  it('nothing rather than a guess', () => {
    for (const text of ['', 'abc', '6.5k', '6.050', '6,050 steps, 4.2 km', '12,34', '6,050, 4,000', '6050 4000', '06:30', '8 Oct 2026, 6,050 steps']) {
      expect(stepsFromText(text), JSON.stringify(text)).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/screens/track/stepsDay.test.ts`
Expected: FAIL, "Cannot find module './stepsDay'".

- [ ] **Step 3: Write** `src/screens/track/stepsDay.ts`

```ts
/**
 * A day's steps, said with where they came from (journey §9.6; D10, D14):
 * - with an entered total: that total, "entered at 6:00 pm";
 * - with walks only: "4,210 in FitStrong walks · day total not entered";
 * - when a FitStrong walk started after the total was stated at a real
 *   time: "at least 7,300", with both sources. A past day's total is
 *   stamped at midday and typed after the day, so it never adds walks
 *   (D52); a corrected total counts from its correction.
 * It is never presented as complete, and a day with nothing says so.
 */
import { entryFor, summariseDay } from '@/health/aggregate';
import { compareStatements, type Observation } from '@/health/observation';
import { walkRecords } from '@/walk/record';
import { formatClock, hasClockTime } from './format';
import { formatNumber } from './units';

export interface StepsFigure {
  kind: 'entered' | 'atLeast' | 'walks' | 'none';
  /** "6,050", or "at least 7,300". Absent with nothing recorded. */
  value?: string;
  /** Where it came from: "entered at 6:00 pm", "in FitStrong walks · day total not entered". */
  source: string;
  /** The steps the figure stands for, at least. */
  steps?: number;
}

export function stepsDayFigure(day: string, observations: readonly Observation[], hour12: boolean): StepsFigure {
  const summary = summariseDay(day, observations);
  const entered = entryFor(summary, 'steps', 'dayTotal');
  if (entered && entered.total !== null) {
    // The statement behind the total, and when it was stated: a correction counts from when it was made (D10).
    const stated = [...entered.contributed].sort(compareStatements).at(-1) ?? entered.latest;
    const asOf = stated.editedAt ?? stated.at;
    // A total typed for a past day is stamped at midday (`atOnDay`): its clock time is a stand-in, not when it was entered.
    const standIn = !stated.editedAt && stated.source === 'manual' && stated.at.slice(11, 23) === '12:00:00.000';
    const at = hasClockTime(stated) && !standIn ? formatClock(asOf, hour12) : undefined;
    const said = stated.editedAt ? 'changed' : 'entered';
    // Only walks that started after the total was stated are surely not in it, so the sum is a floor.
    const walked = at === undefined ? 0 : walkRecords(observations)
      .filter(w => w.day === day && w.steps !== undefined && Date.parse(w.at) > Date.parse(asOf))
      .reduce((n, w) => n + (w.steps ?? 0), 0);
    if (walked > 0) {
      const steps = entered.total + walked;
      return { kind: 'atLeast', value: `at least ${formatNumber(steps)}`, steps, source: `${formatNumber(entered.total)} ${said} at ${at} + ${formatNumber(walked)} in walks after ${at}` };
    }
    return { kind: 'entered', value: formatNumber(entered.total), steps: entered.total, source: at ? `${said} at ${at}` : 'entered' };
  }
  const walks = entryFor(summary, 'steps', 'sessionObserved');
  if (walks && walks.total !== null && walks.total > 0) {
    return { kind: 'walks', value: formatNumber(walks.total), steps: walks.total, source: 'in FitStrong walks · day total not entered' };
  }
  return { kind: 'none', source: 'Not entered' };
}

/** Thousands separators a pasted count may carry: comma, space, no-break space, narrow no-break space. */
const GROUP = '[, \\u00a0\\u202f]';
const TOKEN = new RegExp(`\\d(?:[\\d.]|${GROUP})*\\d|\\d`, 'g');
const INTERNATIONAL = new RegExp(`^\\d{1,3}(?:${GROUP}\\d{3})+$`);
/** 1,00,000: the Indian grouping, in twos above the thousands. */
const INDIAN = /^\d{1,2}(?:,\d{2})*,\d{3}$/;

/**
 * A step count from pasted text (journey §9.6, "Paste"): the one number in
 * it, its thousands grouped the Indian or the international way. Text with
 * no number, a decimal, or more than one number gives nothing, and the
 * person types the number instead: the app never guesses.
 */
export function stepsFromText(text: string): number | undefined {
  const tokens = text.match(TOKEN) ?? [];
  if (tokens.length !== 1) return undefined;
  const t = tokens[0];
  return /^\d+$/.test(t) || INTERNATIONAL.test(t) || INDIAN.test(t) ? Number(t.replace(/\D/g, '')) : undefined;
}
```

If `formatNumber` (`src/screens/track/units.ts`) takes a second argument for decimals, pass `0`. The figures are whole steps.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/screens/track/stepsDay.test.ts`
Expected: PASS.

- [ ] **Step 5: Home says the same.** In `src/screens/home/week.ts`, import `stepsDayFigure` from `@/screens/track/stepsDay`, and replace `stepsLine`'s body with:

```ts
export function stepsLine(day: string, observations: readonly Observation[], hour12: boolean): string {
  const f = stepsDayFigure(day, observations, hour12);
  if (f.kind === 'none') return 'Steps: not entered';
  if (f.kind === 'walks') return `Steps today: ${f.value} in FitStrong walks`;
  return f.kind === 'atLeast' ? `Steps today: ${f.value} (${f.source})` : `Steps today: ${f.value} ${f.source}`;
}
```

Drop `stepsLine`'s now-unused imports. In `src/screens/home/week.test.ts`, keep the existing `stepsLine` cases, which give the same strings, and add one:

```ts
  it('a FitStrong walk after an entered total reads "at least", with both sources (journey §9.6)', () => {
    const at = (time: string) => `2026-10-08T${time}.000+05:30`;
    const obs = [
      newObservation({ id: 'e', kind: 'steps', value: 6050, unit: 'steps', scope: 'dayTotal', source: 'manual', at: at('12:00:05') }),
      newObservation({ id: 'wd', kind: 'walkDuration', value: 20, unit: 'min', scope: 'sessionObserved', source: 'measured', at: at('17:00:00'), context: 'walk:w', coverageMs: 1_200_000 }),
      newObservation({ id: 'ws', kind: 'steps', value: 1250, unit: 'steps', scope: 'sessionObserved', source: 'measured', at: at('17:00:00'), context: 'walk:w', coverageMs: 1_200_000 }),
    ];
    expect(stepsLine('2026-10-08', obs, true)).toBe('Steps today: at least 7,300 (6,050 entered at 12:00 pm + 1,250 in walks after 12:00 pm)');
  });
```

Run: `npx vitest run src/screens/home`
Expected: PASS. If an existing case read `toLocaleString()`'s grouping, which is the same as `formatNumber`'s below 1,00,000, it is unchanged.

- [ ] **Step 6: Paste, in the steps form.** In `src/screens/track/QuickLog.tsx`'s `TotalForm`, import `stepsFromText` from `./stepsDay`. Directly under the `NumberField`, for steps only, and only where the browser can read the clipboard:

```tsx
      {kind === 'steps' && typeof navigator !== 'undefined' && typeof navigator.clipboard?.readText === 'function' && (
        <button
          type="button"
          onClick={() => {
            // Asked from the tap, as iOS requires; nothing is read until the person taps Paste.
            void navigator.clipboard.readText().then(
              text => {
                const n = stepsFromText(text);
                if (n === undefined) setError('Nothing to paste: copy the step count first, then tap Paste.');
                else { setRaw(String(n)); setError(undefined); }
              },
              () => setError('Paste isn’t available here. Type the number instead.'),
            );
          }}
          className="press-feedback min-h-11 self-start rounded-full bg-tint/10 px-4 text-[length:var(--text-body)] font-semibold text-tint"
        >
          Paste
        </button>
      )}
```

Pasting fills the field and saves nothing. The person still taps Save.

- [ ] **Step 7: Write** `src/screens/hub/StepsHub.tsx`

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2Icon, PlusIcon } from 'lucide-react';
import { categoryById } from '@/categories';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { useStore } from '@/store/useStore';
import { StepsGoalSheet } from '@/screens/track/GoalSheet';
import { displayPrefs, parseAddParam } from '@/screens/track/logKinds';
import { metricRows } from '@/screens/track/metrics';
import { addDays, weekOf } from '@/screens/track/periods';
import { QuickLog } from '@/screens/track/QuickLog';
import { stepsDayFigure } from '@/screens/track/stepsDay';
import { currentStepsGoal, stepsGoalOn, stepsProgress } from '@/screens/track/stepsGoal';
import { STEPS_NOTE } from '@/screens/track/targets';
import { Interpretation } from '@/screens/track/ui';
import { formatNumber } from '@/screens/track/units';
import { useToday } from '@/screens/track/useToday';
import { HistoryList } from './HistoryList';
import { HubFrame, HubSection, SeeTrends } from './HubFrame';
import { useHubOrigin } from './hooks';
import { historyRange } from './reading';

const NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * The Steps hub (journey §8.2, §9.6).
 * - Today's figure, with where it came from.
 * - "Add today’s steps", the form with a big number field and Paste.
 * - Options: "Daily step goal", which changes by the day (B-16), and "How
 *   steps are counted".
 * - Then the week, every record, and the trend.
 * Steps can't be read from Apple Health by a web app. The Shortcut help
 * waits for a device check (D54).
 */
export default function StepsHub() {
  const category = categoryById('steps');
  const { observations, settings, profile } = useStore();
  const current = useToday();
  const origin = useHubOrigin(category.title);
  const [params, setParams] = useSearchParams();
  const prefs = useMemo(() => displayPrefs(settings, profile, observations), [settings, profile, observations]);
  const [logOpen, setLogOpen] = useState(() => parseAddParam(params.get('add'))?.kind === 'steps');
  useEffect(() => {
    if (!params.has('add')) return;
    setParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('add');
      return next;
    }, { replace: true });
  }, [params, setParams]);
  const [goalOpen, setGoalOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [fresh, setFresh] = useState<readonly string[]>([]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(undefined), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const today = stepsDayFigure(current, observations, prefs.hour12);
  const goal = currentStepsGoal(settings);
  const progress = today.steps !== undefined ? stepsProgress(today.steps, stepsGoalOn(settings, current)) : undefined;
  const { from } = weekOf(current);
  const week = NAMES.map((name, i) => ({ name, day: addDays(from, i) })).filter(d => d.day <= current).map(d => {
    const f = stepsDayFigure(d.day, observations, prefs.hour12);
    const p = f.steps !== undefined ? stepsProgress(f.steps, stepsGoalOn(settings, d.day)) : undefined;
    return { ...d, text: f.value ? [`${f.value} steps`, d.day === current ? f.source : undefined, p].filter(Boolean).join(' · ') : 'Not entered' };
  });
  const rows = useMemo(() => metricRows('steps', observations, historyRange({ metric: 'steps' }, observations, current), prefs, current), [observations, prefs, current]);

  return (
    <HubFrame category={category}>
      <div role="status" aria-live="polite" className="empty:hidden">
        {notice && (
          <p className="flex items-start gap-2 rounded-xl bg-grouped-card px-4 py-3 text-[length:var(--text-subhead)]">
            <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-tint" aria-hidden />
            <span>{notice}</span>
          </p>
        )}
      </div>

      <HubSection title="Today">
        <div className="flex flex-col gap-3 rounded-2xl bg-grouped-card p-4">
          <p className="numeric text-[length:var(--text-title-2)] font-bold leading-tight">{today.value ? `${today.value} steps` : 'Not entered'}</p>
          {today.kind !== 'none' && <p className="text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{today.source}</p>}
          {progress && <p className="text-[length:var(--text-subhead)] leading-snug">{progress}</p>}
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            className="press-feedback flex min-h-[60px] w-full items-center justify-center gap-2 rounded-xl bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint"
          >
            <PlusIcon className="size-5" aria-hidden />
            Add today’s steps
          </button>
        </div>
      </HubSection>
      <Interpretation text={STEPS_NOTE.text} tone={STEPS_NOTE.tone} framework={STEPS_NOTE.framework} />

      <HubSection title="Options">
        <Group footer="Optional, and yours to change. Each day keeps the goal it had.">
          <Row as="button" type="button" label="Daily step goal" value={goal !== undefined ? `${formatNumber(goal)} steps` : 'Not set'} chevron onClick={() => setGoalOpen(true)} />
          <Row as="button" type="button" label="How steps are counted" chevron onClick={() => setHowOpen(true)} />
        </Group>
      </HubSection>

      <HubSection title="This week">
        <Group>{week.map(d => <Row key={d.day} label={d.name} detail={d.text} />)}</Group>
      </HubSection>

      <HistoryList rows={rows.map(r => ({ key: r.key, label: r.label, detail: r.detail, ref: r.ref, ids: r.ids }))} origin={origin} empty="Nothing here yet. Each day’s total and each walk’s steps show here." fresh={fresh} />
      <SeeTrends category={category} origin={origin} />

      <QuickLog open={logOpen} onOpenChange={setLogOpen} initial={{ kind: 'steps' }} onSaved={r => { setFresh(r.ids); setNotice(`Saved on this device: ${r.summary}.`); }} prefs={prefs} />
      <StepsGoalSheet open={goalOpen} onOpenChange={setGoalOpen} goal={goal} />
      <Sheet open={howOpen} onOpenChange={setHowOpen} title="How steps are counted" detent="large">
        <div className="flex flex-col gap-3 px-1 text-[length:var(--text-body)] leading-snug">
          <p>FitStrong counts steps only while it’s open on the screen.</p>
          <p>A total you enter from your phone’s Health app is the whole day’s so far. A new total for the day replaces the one before; it is never added to it.</p>
          <p>Walks you record here count their own steps, shown as “in FitStrong walks”.</p>
          <p>If you walk with FitStrong after entering a total, the day reads “at least” the two together, until you enter a new total.</p>
          <p>Distance and energy count only recorded walks.</p>
        </div>
      </Sheet>
    </HubFrame>
  );
}
```

`J07`'s steps-goal locator looks for exactly one control matching `/(steps?\b.*\bgoal|\bgoal\b.*\bsteps?|daily goal)/i`. "Daily step goal" is the only one. Keep it that way: no other button or link here may say "goal" with "step".

- [ ] **Step 8: Mount it.** In `src/routes.tsx`:
  - replace Task 11's interim `/hub/steps` route with `hub(<StepsHub />)`, using `const StepsHub = lazy(() => import('@/screens/hub/StepsHub'));`;
  - drop the now-unused `MetricDetail` lazy import if nothing else uses it.

- [ ] **Step 9: Check by eye.** Run `npm run dev`:
  - **`/hub/steps`:**
    - "Not entered";
    - "Add today’s steps" opens the Steps form, with Paste;
    - copy "6,050 steps" to the clipboard and tap Paste: the field shows 6050. Save;
    - Today reads "6,050 steps · entered at <time>".
  - **Daily step goal:** 7,500 shows "80% of the 7,500 goal".
  - **A FitStrong walk recorded later:** "at least …", with both sources.
  - **Home's This week line** says the same.

- [ ] **Step 10: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/track/stepsDay.ts src/screens/track/stepsDay.test.ts src/screens/hub/StepsHub.tsx src/screens/home/week.ts src/screens/home/week.test.ts src/screens/track/QuickLog.tsx src/routes.tsx
git commit -m "feat: Make the Steps hub, with Paste, the daily goal and honest totals"
```

---

### Task 13: The Back & leg hub

**Files:**
- Move: `src/screens/track/BackLeg.tsx` → `src/screens/hub/BackHub.tsx` (`git mv`, then rework)
- Modify: `src/routes.tsx` (`/hub/back` → `BackHub`)

**Interfaces:**
- Consumes:
  - v1's `assembleBackLeg`, `BackLegChart`, `PAIN_DAYS_NEEDED`, `metricRows('backLeg', …)`, `QuickLog` (`{ kind: 'backLeg' }`) and `EmergencySigns`;
  - `CheckInSheet` (answers only, as Home's "Today’s check-in · Update" uses it);
  - `useGuided`;
  - `formatClock`, `formatDayRelative`, `hasClockTime` and `compareObservations` (the order Task 10's `latestFor` uses);
  - `historyRange` (Task 10);
  - the hub parts (Tasks 3 and 5).
- Produces: `BackHub` (default export), at `/hub/back`. It keeps v1's readings ("Back pain 3 of 10"), which J16 reads.

- [ ] **Step 1: Move the file**

```bash
git mv src/screens/track/BackLeg.tsx src/screens/hub/BackHub.tsx
```

- In `src/routes.tsx`, replace the `BackLeg` lazy import with `const BackHub = lazy(() => import('@/screens/hub/BackHub'));`, and route `/hub/back` to `hub(<BackHub />)`.
- Fix its relative imports (`./backLegSeries`, `./BackLegChart`, `./format`, `./logKinds`, `./metrics`, `./periods`, `./QuickLog`, `./ui`, `./useToday`) to `@/screens/track/…`.
- `grep -rn "BackLeg\b" src` must show no other importer.

- [ ] **Step 2: Rework it as the hub.** Make the component `export default function BackHub()`. Then:
  - **The frame:**
    - replace `<Screen title="Back & leg" back={back} trailing={…}>` with `<HubFrame category={categoryById('back')}>`. The nav bar's "+" goes: Add reading is in Latest;
    - drop `useOrigin`;
    - use `const origin = useHubOrigin('Back & leg');` for the rows.
  - **Latest:** add it first, under v1's descriptive paragraph:

```tsx
  const { profile: guidedProfile, date, checkIn, checkIns: recent, saveCheckIn } = useGuided();
  const [updating, setUpdating] = useState(false);
  // Today's check-in stamps its pain scores when it is answered, so they order with the ones added here.
  const latestOf = (kind: 'backPain' | 'legPain') => observations.filter(o => o.kind === kind && o.scope === 'pointInTime').sort(compareObservations).at(-1);
  const pain = latestOf('backPain');
  const leg = latestOf('legPain');
  const whenOf = (o: Observation) => `${formatDayRelative(o.day, current)}${hasClockTime(o) ? ` · ${formatClock(o.at, prefs.hour12)}` : ''}`;
```

```tsx
      <HubSection title="Latest">
        <div className="flex flex-col gap-3 rounded-2xl bg-grouped-card p-4">
          {pain || leg ? (
            <>
              {pain && <p className="text-[length:var(--text-body)] leading-snug"><span className="font-semibold">Back pain {pain.value} of 10</span> · {whenOf(pain)}</p>}
              {leg && <p className="text-[length:var(--text-body)] leading-snug"><span className="font-semibold">Leg pain {leg.value} of 10</span> · {whenOf(leg)}</p>}
            </>
          ) : (
            <>
              <p className="text-[length:var(--text-title-2)] font-semibold leading-tight">Add your first pain scores</p>
              <p className="text-[length:var(--text-body)] leading-snug text-muted-foreground">Back and leg pain, 0 to 10, from your check-ins and from here.</p>
            </>
          )}
          <button
            type="button"
            onClick={() => setLogOpen(true)}
            className="press-feedback flex min-h-[60px] w-full items-center justify-center gap-2 rounded-xl bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint"
          >
            <PlusIcon className="size-5" aria-hidden />
            Add reading
          </button>
        </div>
      </HubSection>
      {/* How far it reaches, and the red flags, are the check-in's questions, where the engine reads them (D53). */}
      <Group footer="Pain spreading further, new numbness or weakness: today’s check-in asks, and says what to do.">
        <Row label="How far it reaches, or new weakness" detail="Update today’s check-in" onClick={() => setUpdating(true)} chevron />
      </Group>
```

  - **The chart and the ladder:** keep v1's period control, chart (or its "needs more days" card) and loading ladder, unchanged, inside `<HubSection title="Pain and loading">`. Their own "Add back and leg pain" button may stay.
  - **History:** replace v1's period-bound `readings`, and its `Group` with "Show all", by every record, newest first:

    ```tsx
    const history = useMemo(
      () => metricRows('backLeg', observations, historyRange({ metric: 'backLeg' }, observations, current), prefs, current),
      [observations, prefs, current],
    );
    ```

    ```tsx
    <HistoryList rows={history.map(r => ({ key: r.key, label: r.label, detail: r.detail, ref: r.ref, ids: r.ids }))} origin={origin} empty="No pain scores yet." fresh={fresh} />
    ```

    The rows keep v1's labels ("Back pain 3 of 10"). v1's `fresh` state stays, set by its `onSaved` as before, and now goes to `HistoryList`.
  - **Imports to add:**
    - `compareObservations` and `type Observation` (`@/health/observation`);
    - `formatClock`, `formatDayRelative` and `hasClockTime` (`@/screens/track/format`);
    - `categoryById` (`@/categories`), `CheckInSheet` (`@/components/checkin/CheckInSheet`) and `useGuided` (`@/hooks/useGuided`);
    - `HistoryList`, `HubFrame`, `HubSection`, `SeeTrends`, `useHubOrigin` and `historyRange` (`./HistoryList`, `./HubFrame`, `./hooks`, `./reading`).

    Drop `Screen`, `useOrigin`, `LIST_PREVIEW`, `recordPath`, `Link`, `useLocation`, `useRef` and `flushSync` once nothing uses them.
  - **After History:**
    - `<SeeTrends category={categoryById('back')} origin={origin} />`;
    - v1's emergency signs footer, unchanged;
    - the check-in sheet, answers only (no Start), as Home's "Update" uses it:

```tsx
      <CheckInSheet open={updating} onOpenChange={setUpdating} profile={guidedProfile} date={date} {...(checkIn ? { initial: checkIn } : {})} recent={recent} onSave={saveCheckIn} />
```

  - **Delete** v1's `expand`, `showAll`, `list` and `here`. `HistoryList` does that work now, the `fresh` highlight included.

- [ ] **Step 3: Check by eye.** With P01:
  - **`/hub/back`:** Latest shows the check-in's pain scores.
  - **Add reading:** opens the pain form ("Back pain", "Leg pain"). Back 6 and Leg 4 save, and Latest reads "Back pain 6 of 10 · Today · <time>".
  - **"How far it reaches, or new weakness":** opens today's check-in.
  - **The chart:** reads as v1's.

- [ ] **Step 4: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/hub/BackHub.tsx src/routes.tsx
git commit -m "feat: Make the Back & leg hub around D21's chart, with pain scores and today's check-in"
```

---

### Task 14: The Learn hub

**Files:**
- Modify: `src/screens/guide/GuideScreen.tsx` (the Learn hub)
- Modify: `src/screens/guide/TopicScreen.tsx`, `CardScreen.tsx`, `SourcesScreen.tsx`, `routes.tsx` (v2 addresses, Back to "Learn")
- Modify: `src/content/search.ts`, `src/content/schema.ts` (v2 addresses in results and card actions)
- Modify: `src/screens/today/model.ts`, `src/screens/today/model.test.ts` (the chooser's Learn row)
- Modify: `src/content/audit.test.ts`, `src/content/personalise.test.ts`, `src/components/hig/shell.node.test.ts` (routes named through `ROUTES`; the card's opener)

**Interfaces:**
- Consumes: `HubFrame` and `categoryById('learn')`.
- Produces: the Learn hub at `/hub/learn`, titled "Learn", with its search named "Search Learn". Its pages are at `/hub/learn/topic/:id`, `/hub/learn/card/:id` and `/hub/learn/sources`, and each links to the others at those addresses. The Guide content's actions open v2 places.

- [ ] **Step 1: The hub.** In `GuideScreen.tsx`:
  - replace `<Screen title="Guide" back={{ to: '/home', label: 'Home' }}>` with `<HubFrame category={categoryById('learn')}>`;
  - change the search field's `aria-label` to "Search Learn";
  - change the topic rows' links to ``/hub/learn/topic/${id}``;
  - change "Meal ideas" to `/hub/food/ideas` (Food's, still interim until Plan 7);
  - change "Sources" to `/hub/learn/sources`.

  The order stays as v1's, which is §8.2's: "For you" topics first, then every topic, with search at the top.

- [ ] **Step 2: Its pages.**
  - **`TopicScreen.tsx`:**
    - `back={{ to: '/hub/learn', label: 'Learn' }}`;
    - its fallback `<Navigate to="/hub/learn" replace />`;
    - "Meal ideas" → `/hub/food/ideas`;
    - each card → ``/hub/learn/card/${card.id}``.
  - **`CardScreen.tsx`:**
    - the not-found fallback goes to `/hub/learn`;
    - Back from a search result is `{ to: '/hub/learn', label: 'Learn' }`;
    - a card's topic is ``{ to: `/hub/learn/topic/${home.id}`, label: home.title }``;
    - related cards link to ``/hub/learn/card/${c.id}`` with ``state={{ path: `/hub/learn/card/${from.id}`, label: from.title }}``.
  - **`SourcesScreen.tsx`:** `back={{ to: '/hub/learn', label: 'Learn' }}`.
  - **`routes.tsx`:** the catch-all `<Navigate to="/hub/learn" replace />`. Leave the meal routes in this file as they are: they stay listed for the redirect inventory, and Food's interim screens are Plan 7's.

- [ ] **Step 3: The content's addresses.**
  - **`src/content/search.ts`:**
    - topic results ``to: `/hub/learn/topic/${t.id}` ``;
    - card results ``to: `/hub/learn/card/${c.id}` ``;
    - meal results ``to: `/hub/food/ideas/${m.id}` ``.
  - **`src/content/schema.ts`,** `ROUTES`:
    - `walk: '/hub/walk'`;
    - `stretch: '/hub/stretch'`;
    - `reminders: '/me/reminders'`;
    - `meals: '/hub/food/ideas'`;
    - `week: '/hub/food/week'`.

    The `add*` entries are Task 11's. `personalise.ts` reads `ROUTES.walk` and `ROUTES.stretch` by name, so it is unchanged.
  - **`src/content/audit.test.ts`:** `firstMovement`'s `b.action.to === '/walk' || b.action.to === '/move/stretch'` becomes `b.action.to === ROUTES.walk || b.action.to === ROUTES.stretch`, with `ROUTES` imported from `./schema`.
  - **`src/content/personalise.test.ts`:** `toBe('/walk')` becomes `toBe(ROUTES.walk)`.
  - **`src/screens/today/model.ts`:** the chooser's Learn row `to: '/hub/learn'`. In `model.test.ts`, its case becomes `['learn', '/hub/learn', undefined]`.
  - **`src/components/hig/shell.node.test.ts`:** the related-card assertion becomes ``expect(read('src/screens/guide/CardScreen.tsx')).toContain('state={{ path: `/hub/learn/card/${from.id}`, label: from.title }}');``.

  Then find what's left with `grep -rn "'/guide\|\`/guide" src --include=*.ts --include=*.tsx | grep -v "redirects\|test"`. Only the Food screens (`MealIdeasScreen`, `MealDetailScreen`, `SampleWeekScreen`) may still name `/guide`: they are Plan 7's.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/content src/screens/today src/components/hig src/redirects.test.ts`
Expected: PASS.

- [ ] **Step 5: Check by eye.**
  - **Browse → Learn:**
    - "Learn", with the Learn wash;
    - "For you" first, for P01;
    - searching "dal" lists results whose links are `/hub/learn/…` or `/hub/food/ideas/…`.
  - **A topic → a card → a related card:** Back names the card, then the topic, then "Learn".
  - **A card's "Start a gentle stretch":** opens `/hub/stretch` directly, with no redirect hop.

- [ ] **Step 6: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/guide src/content src/screens/today/model.ts src/screens/today/model.test.ts src/components/hig/shell.node.test.ts
git commit -m "feat: Make Learn a hub at v2's addresses"
```

---
### Task 15: Acceptance navigation through the hubs, then the full run

The hubs replace v1's Move screen and its setups, so the suite's ways in change. Its checks don't. Navigation, locators and titles change. Every clinical assertion stays word for word (A-76). Another agent may be editing the suite at the same time, so find each call site with the `grep` given rather than by line number.

**Files:**
- Create: `scripts/e2e/acceptance/lib/hub.mjs`
- Modify: `scripts/e2e/acceptance/lib/ui.mjs` (`LEGACY` titles)
- Modify: `scripts/e2e/acceptance/lib/move.mjs` (`enter`, `setupRefusal`)
- Modify: `scripts/e2e/acceptance/lib/walk.mjs` (`openSetup`, `start`)
- Modify: `scripts/e2e/acceptance/lib/player.mjs` (`runStretchToEnd` and `saveStretch`, moved from J08)
- Modify: `scripts/e2e/acceptance/lib/safety-a.mjs` (`openCheckIn`, `attempt`, `surface`'s walk branch, `throughSetup`, the Learn title)
- Modify: `scripts/e2e/acceptance/lib/safety-b.mjs` (`enterFromMove`)
- Modify: `scripts/e2e/acceptance/lib/safety-c.mjs` (`openGuided`, `STARTERS`)
- Modify: `scripts/e2e/acceptance/journeys/j01.mjs`, `j06.mjs`, `j07.mjs`, `j08.mjs`, `j10.mjs`, `j12.mjs`, `j15.mjs`, `j16.mjs`, `j17.mjs`, `j20.mjs`, `s01.mjs` (navigation and names only)
- Modify: `scripts/e2e/acceptance/run.mjs` (the warm-up list)
- Modify: `docs/reimagine/BOARD.md` (each journey change)

**Interfaces:**
- Produces, in `lib/hub.mjs`:
  - `HUB: Record<'guided' | 'stretch' | 'walk', { title: string; path: string }>`;
  - `START: RegExp`, every label a card's start-kind action can have;
  - `STARTERS: RegExp`, `START` plus the card's quiet "Just a walk";
  - `card(page)`, the hub's "Right now" region;
  - `start(page)`, the card's start-kind button;
  - `tile(page, title)`, Home's tile link for a category;
  - `openHub(t, title, path)` and `open(t, mode)`;
  - `refusal(page)`, which gives `undefined` while a start is offered, or else `{ title, reasons, text, review, recheck, profile, stretchInstead, join }`;
  - `begin(t)`, which gives `{ sheet?, route }`;
  - `urgent(page)`, which gives `{ kind, headline, text } | undefined`.
- Produces, in `lib/player.mjs`: `runStretchToEnd(t, maxSteps = 30): Promise<{ ran: number; seen: string[] }>` and `saveStretch(t): Promise<void>`.
- Consumes the DOM contract of Tasks 3–14:
  - the region "Right now", with an `h3` title;
  - the gate's sentences in its `role="status"`;
  - "Review today’s check-in", "Enter a new reading", "Answer the questions about your health/medicines", "Stretch instead" and "Join the 12-week programme";
  - the pending walk's "Return to walk" and "Review and save" inside the same region;
  - the safety surface as `section[data-urgent-kind]` (Plan 1).

- [ ] **Step 1: Write** `scripts/e2e/acceptance/lib/hub.mjs`

```js
/**
 * v2's hubs (journey §8; Plan 2), the way a person reaches them, and what a
 * movement hub's Right now card says. Home's tile for a category opens its
 * hub. Browse lists every category, for a tile Home doesn't show. The card is
 * a region named "Right now", with an h3 title, the gate's sentences in a
 * status region while it refuses, and at most one start-kind action. Every
 * start-kind action goes through the gate, so a tap opens the check-in when
 * one is due (§4.1, §4.2).
 */
import * as ui from './ui.mjs';

/** Each mode's hub. */
export const HUB = {
  guided: { title: 'Workout', path: '/hub/workout' },
  stretch: { title: 'Stretch', path: '/hub/stretch' },
  walk: { title: 'Walk', path: '/hub/walk' },
};

/**
 * Every label a card's start-kind action can have (journey §7.5, §8.4,
 * B-09); one shows at a time. "Start anyway" is the quiet start while Away or
 * Unwell, which still goes through the gate (L-04).
 */
export const START = /^(Start session|Start recovery session|Start rest-day mobility|Start stretch|Start walk|Start anyway|Check in & start|Check in & continue|Continue session|Continue stretch|I had \S+ at .+: walk now)$/;

/** Anything on a hub that would begin movement, the card's quiet "Just a walk" included: none may show while the gate refuses. */
export const STARTERS = /^(Start session|Start recovery session|Start rest-day mobility|Start stretch|Start walk|Start anyway|Check in & start|Check in & continue|Continue session|Continue stretch|Just a walk|I had \S+ at .+: walk now)$/;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();

/** The hub's Right now card. */
export const card = page => page.getByRole('main').getByRole('region', { name: 'Right now', exact: true });

/** The card's start-kind action, if it offers one. */
export const start = page => card(page).getByRole('button', { name: START });

/** Home's tile for a category. */
export const tile = (page, title) => ui.row(page.getByRole('main').getByRole('region', { name: 'What would you like to do?', exact: true }), title, 'link');

/** Home → the category's tile → its hub, or Browse → the category when Home doesn't show the tile. */
export async function openHub(t, title, path) {
  const page = t.page;
  await ui.tab(page, 'Home');
  if (await tile(page, title).count()) {
    await ui.tap(tile(page, title));
  } else {
    await ui.tab(page, 'Browse');
    await ui.tap(ui.row(page.getByRole('main'), title, 'link'));
  }
  const ok = await page.waitForFunction(({ path, title }) => {
    const hash = location.hash.replace(/^#/, '').split('?')[0];
    const h1 = [...document.querySelectorAll('main h1')].map(h => h.textContent.trim());
    return hash === path && (h1.includes(title) || h1.includes('This screen didn’t load'));
  }, { path, title }, { timeout: 15000 }).then(() => true, () => false);
  if (!ok) throw new Error(`Home → ${title} did not reach ${path} (at ${new URL(page.url()).hash || '/'})`);
  await page.waitForTimeout(250);
}

/** A movement hub, with its card up. */
export async function open(t, mode) {
  await openHub(t, HUB[mode].title, HUB[mode].path);
  await card(t.page).waitFor({ timeout: 15000 });
}

/**
 * What the card says while it offers no start-kind action, or undefined when
 * it offers one: its title, the gate's sentences, the card's whole text (its
 * title included, as v1 Walk's refusal had its heading in its text) and the
 * safe actions on offer (journey §7.5, §8.4).
 */
export async function refusal(page) {
  const c = card(page);
  await c.waitFor({ timeout: 15000 }).catch(() => {});
  if (await start(page).count()) return undefined;
  const h3 = c.getByRole('heading', { level: 3 });
  const status = c.getByRole('status');
  const has = async name => (await ui.button(c, name).count()) > 0;
  return {
    title: (await h3.count()) === 1 ? flat(await h3.innerText()) : undefined,
    reasons: (await status.count()) === 1 ? (await status.locator('p').allInnerTexts()).map(flat).filter(Boolean) : [],
    text: flat(await c.innerText()),
    // A way to today's check-in: "Review today’s check-in", or "Enter a new reading" while a re-check waits.
    review: (await has('Review today’s check-in')) || (await has('Enter a new reading')),
    recheck: await has('Enter a new reading'),
    profile: (await c.getByRole('button', { name: /^Answer the questions about your (health|medicines)$/ }).count()) > 0,
    stretchInstead: await has('Stretch instead'),
    join: await has('Join the 12-week programme'),
  };
}

/** Tap the card's start-kind action: the check-in sheet when one opened, and where the person is. */
export async function begin(t) {
  const page = t.page;
  await ui.tap(start(page));
  await page.waitForTimeout(500);
  const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
  return (await sheet.count()) ? { sheet, route: await t.route() } : { route: await t.route() };
}

/** The shell's safety surface on this screen, when one stands (journey §4.7, B-02). */
export async function urgent(page) {
  const s = page.getByRole('main').locator('section[data-urgent-kind]');
  if ((await s.count()) !== 1) return undefined;
  return { kind: await s.getAttribute('data-urgent-kind'), headline: flat(await s.locator('h2').innerText()), text: flat(await s.innerText()) };
}
```

- [ ] **Step 2: v1's places in `lib/ui.mjs`.** In `LEGACY`:
  - Move's `title: 'Move'` becomes `title: 'Workout'`;
  - Guide's `title: 'Guide'` becomes `title: 'Learn'`.

  In the comment above `LEGACY`, change "each still the v1 screen it was until Plans 2–4 rebuild it" to "Move is now the Workout hub and Guide the Learn hub (Plan 2); Track is Today's log (Plan 1)".

- [ ] **Step 3: `lib/move.mjs`.** Add `import * as hub from './hub.mjs';`. Then:
  - Update the header comment's `move` entry to "the mode's hub from Home (`hub.open`) → its start".
  - In `enter`, replace the whole `if (via === 'move') { … }` branch with:

```js
  if (via === 'move') {
    // v1's Move → mode → Start is now Home's tile for the mode → its hub's start (Plan 2).
    await hub.open(t, mode);
    // A card that refuses offers no start: the caller reads what it says (`setupRefusal`).
    if (await hub.start(page).count()) await ui.tap(hub.start(page));
  }
```

  - In `enter`'s `direct` branch, replace `const start = ui.button(main, 'Start stretch'); if (mode === 'stretch' && await start.count()) await ui.tap(start);` with:

```js
    if (mode === 'stretch' && await hub.start(page).count()) await ui.tap(hub.start(page));
```

  - Replace `setupRefusal`'s body with `return hub.refusal(page);`, keeping its signature and updating its comment to "What a movement hub's card shows while the engine refuses (journey §8.4)".
  - `reviewFromSetup` opens today's check-in from the card. It uses "Review today’s check-in", or "Enter a new reading" while a re-check waits:

```js
export async function reviewFromSetup(page) {
  const c = hub.card(page);
  const review = ui.button(c, 'Review today’s check-in');
  await ui.tap((await review.count()) ? review : ui.button(c, 'Enter a new reading'));
  const sheet = checkInSheet(page);
  await sheet.waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
  return sheet;
}
```

- [ ] **Step 4: `lib/walk.mjs`.** Add `import * as hub from './hub.mjs';`. Then:
  - replace `openSetup`'s body with `await hub.open(t, 'walk');`, with the comment "Home → the Walk tile → the Walk hub (v1's Move → Walk setup)";
  - in `start`, replace `await ui.tap(ui.button(page.getByRole('main'), 'Start walk'));` with `await ui.tap(hub.start(page));`. That start says "Start walk", "Check in & start" or B-09's "I had … at …: walk now".

- [ ] **Step 5: `lib/player.mjs`.** Move J08's `runToEnd` and `save` here, exported. The run also records what it showed, for B-30:

```js
/**
 * Let each timed step run to its end: advance the clock by what the step has
 * left, so the runner completes it itself. Returns the time advanced and
 * each step title shown, in order.
 */
export async function runStretchToEnd(t, maxSteps = 30) {
  const page = t.page;
  let ran = 0;
  const seen = [];
  for (let i = 0; i < maxSteps; i++) {
    if (await page.getByRole('heading', { level: 1, name: /complete$/ }).count() && !(await control(page, 'Pause').count())) return { ran, seen };
    const left = await stepRemainingMs(page);
    if (left === undefined) {
      if (await page.getByRole('heading', { level: 1, name: /^(Stretch|Session) complete$/ }).count()) return { ran, seen };
      throw new Error(`no step timer on “${(await where(page)).title}”`);
    }
    const before = await where(page);
    if (seen.at(-1) !== before.title) seen.push(before.title);
    await t.advance(left + 300);
    ran += left + 300;
    await page.waitForTimeout(150);
    const after = await page.getByRole('heading', { level: 1 }).innerText().catch(() => '');
    if (after.trim() === before.title && (await stepRemainingMs(page)) !== undefined) {
      // The tick that lands after the boundary may need one more beat.
      await t.advance(300);
      ran += 300;
    }
  }
  throw new Error('the stretch never reached its end');
}

/** The summary's "Save and finish", once "Saved" shows. */
export async function saveStretch(t) {
  const page = t.page;
  await page.getByRole('heading', { level: 1, name: /complete$/ }).waitFor();
  await ui.tap(page.getByRole('button', { name: /Save and finish/ }));
  await page.getByText('Saved', { exact: true }).waitFor({ timeout: 8000 });
}
```

  In `j08.mjs`:
  - delete `runToEnd` and `save`;
  - use `(await player.runStretchToEnd(t)).ran` where it added `await runToEnd(t)`;
  - call `await t.checkpoint('stretch-summary'); await player.saveStretch(t);` where it called `save(t)`.

- [ ] **Step 6: `lib/safety-a.mjs`.** Add `import * as hub from './hub.mjs';`.

  **`openCheckIn`.** Replace its `if (via === 'move') { … }` branch:

```js
  if (via === 'move') {
    await hub.open(t, mode);
    const c = hub.card(page);
    const review = ui.button(c, 'Review today’s check-in');
    const reading = ui.button(c, 'Enter a new reading');
    if (await hub.start(page).count()) await ui.tap(hub.start(page));
    else if (await review.count()) await ui.tap(review);
    else if (await reading.count()) await ui.tap(reading);
    else throw new Error(`the ${mode} hub offers neither a start nor a way to today’s check-in`);
  }
```

  **`attempt`.** Replace the `if (via === 'move') { … }` block inside it:

```js
    if (via === 'move') {
      await hub.open(t, mode);
      const r = await hub.refusal(page);
      if (mode === 'guided' && r?.join) {
        // Outside the programme the hub offers to join it, never a session (D35).
        return { mode, via, where: 'not offered', route: await t.route(), title: undefined, text: r.text, start: false };
      }
      setup = await throughSetup(t, mode);
    }
```

  **`surface`.** Replace the walk branch (`if (route.startsWith('/hub/walk')) { … }`):

```js
  // v1's Walk setup is the Walk hub (journey §19.2): its card refuses with the gate's headline.
  if (route.startsWith('/hub/walk')) {
    const r = await hub.refusal(page);
    // The hub's own start opens the check-in when one is due: it is not permission to move (spec).
    return { where: r ? 'walk refusal' : 'walk setup', route, title: r?.title, text, start: false, setupStart: (await hub.start(page).count()) > 0 };
  }
```

  **`throughSetup`.** Replace its first branch:

```js
  if (!refusal) {
    const start = hub.start(page);
    if (await start.count() && !(await start.isDisabled())) await ui.tap(start);
    return undefined;
  }
```

  Its comment becomes "On a movement hub: its start, when it offers one. Otherwise the hub has refused before any tap (S-15)…".

- [ ] **Step 7: `lib/safety-b.mjs`.** Add `import * as hub from './hub.mjs';`, and replace `enterFromMove`'s body:

```js
export async function enterFromMove(t, mode) {
  const page = t.page;
  await hub.open(t, mode);
  const c = hub.card(page);
  // A walk left in progress is offered back first; going back to it is a resume.
  const pending = c.getByRole('button', { name: /^(Return to walk|Review and save)$/ });
  if (mode === 'walk' && await pending.count()) {
    await ui.tap(pending);
    await page.waitForTimeout(600);
    return { route: await t.route(), pending: true };
  }
  const start = hub.start(page);
  if (!(await start.count()) || await start.isDisabled()) {
    const r = await hub.refusal(page);
    if (mode === 'guided' && r?.join) {
      // Not in the programme: the hub offers to join it rather than a session, so
      // the session is attempted through its own address (a direct player route).
      await t.goto('/session');
      return { route: await t.route(), direct: true };
    }
    // S-15: while the engine refuses, the hub shows the reason and offers the check-in instead of a start.
    return { refusedOnSetup: true, route: await t.route(), title: r?.title, text: r?.text ?? flat(await c.innerText()), review: !!r?.review };
  }
  await ui.tap(start);
  await page.waitForTimeout(500);
  const sheet = checkInSheet(page);
  if (await sheet.count()) return { sheet, route: await t.route() };
  return { route: await t.route() };
}
```

  Update its comment: "Open a mode's hub the way a person does. A hub that refuses on its own (no start, the gate's words) is an answer, not a missing control."

  In `modeAnswer`'s `r.refusedOnSetup` branch, replace the tap on "Review today’s check-in" and the sheet wait after it with `const sheet = await reviewFromSetup(page);`, imported from `./move.mjs`. The card's way to the check-in can be either button.

- [ ] **Step 8: `lib/safety-c.mjs`.** Add `import * as hub from './hub.mjs';`.
  - Extend `STARTERS` with the hub's own starts:

```js
export const STARTERS = /^(Start|Start walk|Start stretch|Start session|Start recovery session|Start rest-day mobility|Start anyway|Resume|Continue|Continue walking|Continue session|Continue stretch|Check in & (start|continue|stretch|walk)|Just a walk|I had \S+ at .+: walk now|I am fine: carry on walking|Keep going|Keep walking)$/;
```

  - Replace `openGuided`'s body:

```js
export async function openGuided(t) {
  const page = t.page;
  await hub.open(t, 'guided');
  const c = hub.card(page);
  const start = hub.start(page);
  if (await start.count()) {
    await ui.tap(start);
    await page.waitForTimeout(500);
    const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
    if (await sheet.count()) return { sheet, route: await t.route(), viaProgramme: false };
    return { route: await t.route(), viaProgramme: false };
  }
  const r = await hub.refusal(page);
  if (r?.join) return { route: await t.route(), viaProgramme: true, programmeText: r.text };
  // The hub refuses on its own (a hold or a stop): what it says is the answer.
  return { route: await t.route(), viaProgramme: false, setupRefusal: true };
}
```

  - Its comment changes to "Into the guided session from the Workout hub (v1's Move)…". Outside the programme the card offers "Join the 12-week programme", so this returns `viaProgramme` with the card's text.

- [ ] **Step 9: The journeys, navigation only.** List the call sites with:

  ```bash
  grep -n "legacyTab(page, 'Move')\|legacyTab(t.page, 'Move')\|'Start stretch')\|'Start walk')\|row(main, 'Stretch', 'link')\|row(main, 'Walk', 'link')\|'Guide', 'Guide'\|'Move', 'Move'\|name: 'Guide'\|=== 'Guide'\|Search Guide\|hub/labs?metric=hba1c" scripts/e2e/acceptance/journeys/*.mjs scripts/e2e/acceptance/lib/*.mjs
  ```

  Then apply these rules, and only these:

  | Where | What it was | What it becomes |
  | --- | --- | --- |
  | Any journey | `ui.legacyTab(page, 'Move')` followed by `ui.tap(ui.row(main, 'Stretch' \| 'Walk', 'link'))` and its heading wait | `await hub.open(t, 'stretch' \| 'walk')` |
  | J15 `inspectStretch`, J17 step 7 | `t.goto('/hub/workout')` or `t.hash('/hub/workout')`, then the Stretch row | `await hub.open(t, 'stretch')`. J17 needs no reload, and `hub.open` taps through the tabs |
  | Any journey | `ui.button(main, 'Start stretch' \| 'Start walk')` on a hub, tapped or counted | `hub.start(page)`. It is the same button in every state, "Check in & start" included |
  | J10 step 2 | `ui.button(main, 'Start walk').isEnabled()` | `hub.start(page).isEnabled()`. After "After a meal", Breakfast and "20 minutes ago", it reads "I had breakfast at 8:40 am: walk now" |
  | J01 step 5; `safety-a.mjs`'s Guide check | `heading … name: 'Guide'`, and "Guide did not open" | `name: 'Learn'`, and "Learn did not open" |
  | J06, J07, J12, S01 | `getByRole('searchbox', { name: 'Search Guide' })` | `{ name: 'Search Learn' }` (Task 14) |
  | J20, after the download | `await h1Text(page) === 'Guide'`, and its message | `=== 'Learn'`, and "Learn shows …" |
  | J20 | `PLACES = [['Move', 'Move'], ['Track', 'My Day'], ['Guide', 'Guide']]` | `[['Move', 'Workout'], ['Track', 'My Day'], ['Guide', 'Learn']]` |
  | J06 step 3 of the HbA1c case | `t.goto('/hub/labs?metric=hba1c')`, then the Period radio | `t.goto('/trends/labs?metric=hba1c')`: the period control is the trend's (§12), and v1's chart stays there until Plan 3. Its comment becomes "HbA1c's chart is its trend's (Plan 3; v1's chart until then)" |
  | J08 | `runToEnd(t)` and `save(t)` | `player.runStretchToEnd(t)` and `player.saveStretch(t)` (Step 5) |

  Add `import * as hub from '../lib/hub.mjs';` to each journey changed. Don't change any `t.check` or `t.must` condition or message. The one exception is a message that names a button which no longer exists: say "the Stretch hub's start" for "Start stretch" where the check is about the hub's own button.

- [ ] **Step 10: The warm-up list.** In `run.mjs`'s `warm`, add `/hub/steps`, `/hub/bp`, `/hub/labs?metric=hba1c` and `/hub/workout/log` after `/hub/glucose`. Leave `/trends/workout` in the list: it now opens Trends, which is a screen with an `h1`.

- [ ] **Step 11: Run what changed first, then everything**

Run: `npm run e2e:acceptance -- --only=J01,J06,J08,J10,J15,J16,J17,J20 --projects=large-light > /tmp/fit-checks/accept-v2-p2-nav.log 2>&1; tail -n 30 /tmp/fit-checks/accept-v2-p2-nav.log`
Expected: every case passes.

Run: `npm run e2e:acceptance > /tmp/fit-checks/accept-v2-p2.log 2>&1; tail -n 40 /tmp/fit-checks/accept-v2-p2.log`
Expected: every J and S case passes, in all four projects.

For each failure, decide which it is:
- **A navigation change:** fix the journey's steps, and only them.
- **A real regression:** fix the app with a failing unit test first. A hub that says less than v1's setup said is one of these.

Record each journey change in the board's v2 log: journey, step, before, after, and why.

- [ ] **Step 12: Commit**

```bash
git add scripts/e2e/acceptance docs/reimagine/BOARD.md
git commit -m "test: Walk the acceptance journeys through the hubs"
```

---

### Task 16: The Plan 2 journeys (V-J01, V-J04, V-J05, V-J06, V-J09, V-J12, V-J14, V-J15)

Each journey in §17 becomes an acceptance case (§17, §21.3), with exact steps, written against Tasks 2–15. The suite's clock is frozen at Thursday 8 October 2026, 09:00 IST (`lib/env.mjs`). So a reading taken "now" is at 9:00 am, and a low's re-check is at 9:15 am.

**Files:**
- Create: `scripts/e2e/acceptance/journeys/v01.mjs`, `v04.mjs`, `v05.mjs`, `v06.mjs`, `v09.mjs`, `v12.mjs`, `v14.mjs`, `v15.mjs`
- Modify: `scripts/e2e/acceptance/run.mjs` (the file filter)
- Modify: `docs/reimagine/BOARD.md` (the result)

**Interfaces:**
- Consumes:
  - `lib/hub.mjs`, `runStretchToEnd` and `saveStretch` (Task 15);
  - `ui.answerCheckIn`, `ui.normalAnswers`, `ui.rightNow`, `ui.BACK_FLAG`, `ui.EMERGENCY`, `ui.section`, `ui.back`, `ui.heading` and `ui.HOME_TITLE`;
  - `move.checkInSheet`, `move.sheetStart` and `move.outcome`;
  - `player.begin`, `player.control` and `player.stepRemainingMs`;
  - `saveForm` (`lib/data.mjs`);
  - `setStatus` (`lib/guide.mjs`);
  - `stretchPreview` (`lib/safety-c.mjs`);
  - `persona` (`fixtures/personas.mjs`).
- Produces: journeys with ids `VJ01`, `VJ04`, `VJ05`, `VJ06`, `VJ09`, `VJ12`, `VJ14` and `VJ15`, selectable with `--only=VJ01,…`.

- [ ] **Step 1: The runner picks them up.** In `run.mjs`, change the filter to `/^[jsv]\d\d\.mjs$/`.

Run: `npm run e2e:acceptance -- --list`
Expected: the J and S journeys, unchanged. The V files don't exist yet.

- [ ] **Step 2: Write** `scripts/e2e/acceptance/journeys/v01.mjs`

```js
/**
 * V-J01, the first morning (journey §17.1): diabetes, blood pressure and back
 * pain. Launch → Home → Right now "Check in & stretch", with its reason →
 * the check-in, with two blood pressure readings a minute apart → Go ahead →
 * the stretch player → its summary → Home, where the week has 10 more
 * minutes and "Stretched 1 day". P01 with stretching as the stated focus and
 * not in the programme, so Right now's suggestion is the stretch.
 */
import { persona } from '../fixtures/personas.mjs';
import * as move from '../lib/move.mjs';
import * as player from '../lib/player.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ01';
export const title = 'The first morning: check in, stretch, and see the week move';
export const safety = false;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const moved = text => Number(/(\d+) min moved this week/.exec(text)?.[1] ?? 0);

export const cases = [{
  name: 'Right now → check-in → stretch → Home',
  async run(t) {
    const page = await t.open({ seed: persona('P01', { patch: { settings: { startDate: '', focus: 'stretch' } } }), route: '' });
    const main = page.getByRole('main');
    let before = 0;

    await t.step(1, 'Launch: Home, with Right now offering the stretch and its reason', async () => {
      await t.must(/^\/home/.test(await t.route()), `launch opened ${await t.route()}, not Home`);
      const card = ui.rightNow(page);
      await t.must(await card.count() === 1, 'Home has no Right now card');
      const text = flat(await card.innerText());
      await t.check(/stretch/i.test(text) && /Why this\?/.test(text), `Right now does not suggest a stretch with its reason: ${text.slice(0, 200)}`);
      await t.check(await card.getByRole('button', { name: 'Check in & stretch', exact: true }).count() === 1, `Right now's button is not "Check in & stretch": ${text.slice(0, 200)}`);
      before = moved(flat(await main.innerText()));
      await t.checkpoint('first-morning-home');
    });

    await t.step(2, 'Tap it: the check-in, two readings a minute apart, then Go ahead', async () => {
      await ui.tap(ui.rightNow(page).getByRole('button', { name: 'Check in & stretch', exact: true }));
      const sheet = move.checkInSheet(page);
      await sheet.waitFor({ timeout: 15000 });
      await ui.answerCheckIn(t, sheet, ui.normalAnswers('P01'));
      const { title: outcome } = await move.outcome(page);
      await t.checkpoint('first-morning-outcome');
      await t.check(outcome === 'Good to go' || outcome === 'Go ahead, with changes', `the check-in reads “${outcome}”, not Go ahead`);
      await t.must(await move.sheetStart(sheet).count() === 1, 'the check-in offers no way on to the stretch');
      await ui.tap(move.sheetStart(sheet));
      await page.waitForURL(/#\/session/, { timeout: 15000 });
    }, { input: 'normal answers; BP 124/78, then 122/76 a minute later' });

    await t.step(3, 'The stretch player, to its summary, saved', async () => {
      await player.begin(page);
      const { ran } = await player.runStretchToEnd(t);
      t.note(`the stretch ran ${Math.round(ran / 60000)} min on the test clock`);
      await t.checkpoint('first-morning-summary');
      await player.saveStretch(t);
    });

    await t.step(4, 'Home: 10 more minutes this week, and "Stretched 1 day"', async () => {
      await page.waitForFunction(() => location.hash.startsWith('#/home'), null, { timeout: 15000 });
      await ui.heading(page, ui.HOME_TITLE);
      const text = flat(await main.innerText());
      const after = moved(text);
      await t.checkpoint('first-morning-week');
      // The routine is 10 minutes; whole minutes are counted, so the change is 10 within a minute's rounding.
      await t.check(Math.abs(after - before - 10) <= 1, `the week moved from ${before} to ${after} min, not by 10`);
      await t.check(/Stretched 1 day\b/.test(text), `Home does not say “Stretched 1 day”: ${text.match(/Stretch[^.]{0,40}/)?.[0] ?? 'nothing'}`);
    });
  },
}];
```

If P01 with this patch gets a suggestion other than a stretch, look at `recommend` first, before the journey. A stated stretch focus, with no programme, must give the stretch (D20). Don't patch the persona until it does.

- [ ] **Step 3: Write** `scripts/e2e/acceptance/journeys/v04.mjs`

```js
/**
 * V-J04, a low (journey §17.1): the Glucose tile → its hub → Add reading →
 * 62 → "This is a low. Treat it now.", with v1's steps. Home then stands in
 * the re-check state, "Re-check at 9:15 am", and the Workout, Stretch and
 * Walk tiles read "Waiting for your re-check at 9:15 am". The Stretch hub
 * shows the gate's card with no start. P03, on a sulfonylurea, at 09:00.
 */
import { persona } from '../fixtures/personas.mjs';
import { saveForm } from '../lib/data.mjs';
import * as hub from '../lib/hub.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ04';
export const title = 'A low entered in its hub, and every movement tile waiting for the re-check';
export const safety = true;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const WAITING = 'Waiting for your re-check at 9:15 am';

export const cases = [{
  name: 'Glucose 62 at 9:00 am',
  async run(t) {
    const page = await t.open({ seed: persona('P03'), route: '/home' });
    const main = page.getByRole('main');

    await t.step(1, 'Glucose tile → hub → Add reading opens the Glucose form at once', async () => {
      await hub.openHub(t, 'Glucose', '/hub/glucose');
      await ui.tap(ui.button(main, 'Add reading'));
      const form = page.getByRole('dialog', { name: 'Glucose' });
      await form.waitFor({ timeout: 10000 });
      await t.check(await form.getByRole('textbox', { name: 'Reading', exact: true }).count() === 1, 'Add reading did not open the Glucose form itself');
      await ui.type(form.getByRole('textbox', { name: 'Reading', exact: true }), '62');
      await t.must(await saveForm(t, form) === 'guidance', 'a reading of 62 saved without the low guidance');
    }, { input: 'Glucose 62 mg/dL, time Now' });

    await t.step(2, '"This is a low. Treat it now.", with the steps, until read', async () => {
      const guidance = page.getByRole('dialog', { name: /^(Saved|What to do)$/ });
      const text = flat(await guidance.innerText());
      await t.checkpoint('low-guidance');
      await t.check(text.includes('This is a low. Treat it now.'), `the guidance does not say “This is a low. Treat it now.”: ${text.slice(0, 200)}`);
      await t.check(/15 ?g/.test(text) && /15 minutes/.test(text), `the treat-and-re-check steps are missing: ${text.slice(0, 300)}`);
      const now = ui.button(guidance, 'Yes, just now');
      if (await now.count()) await ui.tap(now);
      await ui.tap(ui.button(guidance, 'Done'));
      await guidance.waitFor({ state: 'hidden' });
    });

    await t.step(3, 'Home: the re-check state, with its time', async () => {
      await ui.tab(page, 'Home');
      const u = await hub.urgent(page);
      await t.checkpoint('low-home');
      await t.must(!!u, 'Home shows no safety surface after a low');
      await t.check(u.kind === 'recheck' || u.kind === 'low', `the surface is “${u.kind}”, not the re-check`);
      await t.check(/Re-check at 9:15 am/.test(u.text), `the surface does not say “Re-check at 9:15 am”: ${u.text}`);
    });

    await t.step(4, 'Workout, Stretch and Walk tiles: waiting for the re-check', async () => {
      for (const name of ['Workout', 'Stretch', 'Walk']) {
        const tile = hub.tile(page, name);
        await t.must(await tile.count() === 1, `Home has no ${name} tile`);
        const text = flat(await tile.innerText());
        await t.check(text.includes(WAITING), `the ${name} tile reads “${text}”, not “${WAITING}”`);
      }
    });

    await t.step(5, 'The Stretch hub: the gate’s card, no start, and a new reading', async () => {
      await hub.open(t, 'stretch');
      const r = await hub.refusal(page);
      await t.checkpoint('low-stretch-hub');
      await t.must(!!r, 'the Stretch hub still offers a start during the re-check');
      await t.check(r.title === 'Check again before you start', `the card reads “${r.title}”`);
      await t.check(r.text.includes(WAITING), `the card does not say “${WAITING}”: ${r.text.slice(0, 200)}`);
      await t.check(r.recheck, 'the card offers no “Enter a new reading”');
      const starts = (await hub.card(page).getByRole('button').allInnerTexts()).map(flat).filter(l => hub.STARTERS.test(l));
      await t.check(starts.length === 0, `the card offers ${JSON.stringify(starts)}`);
    });
  },
}];
```

- [ ] **Step 4: Write** `scripts/e2e/acceptance/journeys/v05.mjs`

```js
/**
 * V-J05, a blood pressure check day (journey §17.1): the BP tile says "Check
 * day" → the hub says when to check → Add reading → two readings with the
 * guided minute → saved → the hub shows them with NICE's reading of home
 * blood pressure. P01: treated, with a monitor, no full day in the last week.
 */
import { persona } from '../fixtures/personas.mjs';
import { saveForm } from '../lib/data.mjs';
import * as hub from '../lib/hub.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ05';
export const title = 'A blood pressure check day, from the tile to the hub’s reading';
export const safety = false;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();

export const cases = [{
  name: 'two morning readings a minute apart',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/home' });
    const main = page.getByRole('main');

    await t.step(1, 'The BP tile says "Check day"; its hub says when and how', async () => {
      const tile = hub.tile(page, 'Blood pressure');
      await t.must(await tile.count() === 1, 'P01’s Home has no Blood pressure tile');
      await t.check(flat(await tile.innerText()).includes('Check day'), `the BP tile does not say “Check day”: ${flat(await tile.innerText())}`);
      await hub.openHub(t, 'Blood pressure', '/hub/bp');
      const next = ui.section(main, 'When to check next');
      await t.must(await next.count() === 1, 'the BP hub has no “When to check next”');
      const text = flat(await next.innerText());
      await t.checkpoint('bp-check-day-hub');
      await t.check(/Blood pressure check day/.test(text) && /two readings/i.test(text) && /a minute apart/.test(text), `when to check next says: ${text.slice(0, 200)}`);
      await t.check(/European Society of Hypertension/.test(text), 'the check day does not name its source');
    });

    await t.step(2, 'Add reading → two readings, the second after the guided minute', async () => {
      await ui.tap(ui.button(main, 'Add reading'));
      const form = page.getByRole('dialog', { name: 'Blood pressure' });
      await form.waitFor({ timeout: 10000 });
      await ui.type(form.getByRole('textbox', { name: 'Top (systolic)', exact: true }), '124');
      await ui.type(form.getByRole('textbox', { name: 'Bottom (diastolic)', exact: true }), '78');
      await ui.tap(ui.button(form, 'Add a second reading'));
      await t.check(/Sit quietly\. Take the second reading in a minute\./.test(flat(await form.innerText())), 'the minute between readings is not guided');
      await t.advance(60_000);
      await page.waitForTimeout(400);
      const second = form.getByRole('group', { name: 'Second reading' });
      await ui.type(second.getByRole('textbox', { name: 'Top (systolic)', exact: true }), '122');
      await ui.type(second.getByRole('textbox', { name: 'Bottom (diastolic)', exact: true }), '76');
      await t.checkpoint('bp-two-readings');
      await t.must(await saveForm(t, form) === 'closed', 'the two readings did not save');
    }, { input: '124/78, then 122/76 a minute later' });

    await t.step(3, 'Saved: Latest, its time, and NICE’s reading of home blood pressure', async () => {
      const latest = ui.section(main, 'Latest');
      const text = flat(await latest.innerText());
      await t.checkpoint('bp-saved');
      await t.check(/122\/76 mmHg/.test(text) && /9:01 am/.test(text), `Latest reads: ${text.slice(0, 200)}`);
      const page_ = flat(await main.innerText());
      await t.check(/NICE judges home blood pressure on the average of readings over 4 to 7 days, not on one reading\./.test(page_), 'the hub does not say how NICE reads home blood pressure');
      const history = ui.section(main, 'History');
      await t.check(await history.getByRole('link').count() >= 1, 'History lists no reading');
      await t.check(/Saved on this device: Blood pressure/.test(page_), 'no confirmation that it saved on this device');
    });
  },
}];
```

Each pair in the BP form is a `fieldset` with its legend: "Reading", which becomes "First reading", and "Second reading". The first pair is typed before the second exists, so its locators are unique. The second is scoped by its legend.

- [ ] **Step 5: Write** `scripts/e2e/acceptance/journeys/v06.mjs`

```js
/**
 * V-J06, a guided workout (journey §17.1, B-30): the Workout tile → Right
 * now, today's session in the tile's own words → Check in & start → the
 * check-in → the player → its summary → back where it was started from, the
 * Workout hub. P01, in the programme, on a training day.
 */
import { persona } from '../fixtures/personas.mjs';
import * as hub from '../lib/hub.mjs';
import * as move from '../lib/move.mjs';
import * as player from '../lib/player.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ06';
export const title = 'A guided workout from its hub, back to the hub';
export const safety = false;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();

export const cases = [{
  name: 'Workout tile → session → back to the Workout hub',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/home' });
    let tileWords = '';

    await t.step(1, 'The Workout tile and its hub say the same session', async () => {
      tileWords = flat(await hub.tile(page, 'Workout').innerText());
      await hub.open(t, 'guided');
      const card = hub.card(page);
      const heading = flat(await card.getByRole('heading', { level: 3 }).innerText());
      await t.checkpoint('workout-hub');
      await t.check(heading.length > 0 && tileWords.includes(heading.split(' · ')[0]), `the hub's Right now (“${heading}”) is not the tile's session (“${tileWords}”)`);
      await t.check(await hub.start(page).count() === 1 && flat(await hub.start(page).innerText()) === 'Check in & start', `the hub's start reads “${await hub.start(page).allInnerTexts()}”`);
    });

    await t.step(2, 'Check in & start → the check-in → the player', async () => {
      const r = await hub.begin(t);
      await t.must(!!r.sheet, `Check in & start opened ${r.route}, not the check-in`);
      await ui.answerCheckIn(t, r.sheet, ui.normalAnswers('P01'));
      await t.must(await move.sheetStart(r.sheet).count() === 1, `the check-in does not allow the session: ${(await move.outcome(page)).title}`);
      await ui.tap(move.sheetStart(r.sheet));
      await page.waitForURL(/#\/session/, { timeout: 15000 });
      await player.begin(page);
      await t.checkpoint('workout-player');
    }, { input: 'normal answers; BP 124/78, then 122/76' });

    await t.step(3, 'End early → the summary → Save and finish → the Workout hub', async () => {
      await ui.tap(player.control(page, 'End session'));
      const leave = page.getByRole('dialog', { name: 'Leave the session?' });
      await leave.waitFor();
      await ui.tap(ui.button(leave, 'Finish now'));
      await page.getByRole('heading', { level: 1, name: /complete$/ }).waitFor();
      await t.checkpoint('workout-summary');
      await ui.tap(page.getByRole('button', { name: /Save and finish/ }));
      await page.getByText('Saved', { exact: true }).waitFor({ timeout: 8000 });
      await page.waitForFunction(() => location.hash.replace(/^#/, '').split('?')[0] === '/hub/workout', null, { timeout: 15000 }).catch(() => {});
      await t.check(await t.route() === '/hub/workout', `after the summary the app went to ${await t.route()}, not back to the Workout hub (B-30)`);
      const history = ui.section(page.getByRole('main'), 'History');
      await t.check(await history.getByRole('link').count() >= 1, 'the Workout hub’s History does not list the session');
    });
  },
}];
```

The session runs only long enough to be ended. The player's own journeys (J02, J13, J15) cover each step's content. V-J06 covers the way in and the way back.

- [ ] **Step 6: Write** `scripts/e2e/acceptance/journeys/v09.mjs`

```js
/**
 * V-J09, back hurts more (journey §17.1, §4.7): the Back & leg tile → its hub
 * → Add reading → pain scores → Latest says them. Then how far it reaches,
 * and a red flag, through today's check-in, where the engine reads them
 * (D53) → the stop, everywhere: every tab shows the safety surface, and no
 * movement hub offers a start. P01.
 */
import { persona } from '../fixtures/personas.mjs';
import { saveForm } from '../lib/data.mjs';
import * as hub from '../lib/hub.mjs';
import * as move from '../lib/move.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ09';
export const title = 'Back hurts more: pain scores in the hub, then a red flag stops movement everywhere';
export const safety = true;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const STOP = 'Call emergency services now';

export const cases = [{
  name: 'pain 6 and 5, then new loss of bladder control',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/home' });
    const main = page.getByRole('main');

    await t.step(1, 'Back & leg tile → hub → Add reading → 6 and 5 → Latest', async () => {
      await hub.openHub(t, 'Back & leg', '/hub/back');
      await ui.tap(ui.button(main, 'Add reading'));
      const form = page.getByRole('dialog', { name: 'Back & leg pain' });
      await form.waitFor({ timeout: 10000 });
      await ui.type(form.getByRole('textbox', { name: 'Back pain', exact: true }), '6');
      await ui.type(form.getByRole('textbox', { name: 'Leg pain', exact: true }), '5');
      await saveForm(t, form);
      const latest = flat(await ui.section(main, 'Latest').innerText());
      await t.checkpoint('back-latest');
      await t.check(/Back pain 6 of 10 · Today · 9:00 am/.test(latest) && /Leg pain 5 of 10 · Today · 9:00 am/.test(latest), `Latest reads: ${latest}`);
    }, { input: 'Back pain 6, leg pain 5' });

    await t.step(2, 'How far it reaches, and a red flag: today’s check-in', async () => {
      await ui.tap(ui.row(main, 'How far it reaches, or new weakness'));
      const sheet = move.checkInSheet(page);
      await sheet.waitFor({ timeout: 10000 });
      await ui.answerCheckIn(t, sheet, { emergency: [ui.EMERGENCY.bladderBowel] });
      await page.waitForTimeout(600);
      const { title: outcome, text } = await move.outcome(page);
      await t.checkpoint('back-red-flag');
      await t.check(outcome === STOP, `the check-in reads “${outcome}”, not “${STOP}”`);
      await t.check(await move.sheetStart(sheet).count() === 0, 'the check-in still offers a start');
      await t.check(/emergency|help now/i.test(text), `no emergency direction: ${text.slice(0, 200)}`);
      await ui.tap(ui.button(sheet, 'Close'));
    }, { input: 'Right now: new loss of bladder or bowel control' });

    await t.step(3, 'The stop on every tab', async () => {
      for (const tab of ['Home', 'Trends', 'Browse', 'Me']) {
        await ui.tab(page, tab);
        const u = await hub.urgent(page);
        await t.checkpoint(`back-stop-${tab.toLowerCase()}`);
        await t.check(!!u && u.kind === 'emergency' && u.headline === STOP, `${tab} shows ${u ? `“${u.headline}” (${u.kind})` : 'no safety surface'}`);
      }
    });

    await t.step(4, 'Every movement hub: the same stop, with no start', async () => {
      for (const mode of ['guided', 'stretch', 'walk']) {
        await hub.open(t, mode);
        const r = await hub.refusal(page);
        await t.check(!!r && r.title === STOP, `the ${mode} hub reads “${r?.title}”${r ? '' : ' and offers a start'}`);
        const starts = (await main.getByRole('button').allInnerTexts()).map(flat).filter(l => hub.STARTERS.test(l));
        await t.check(starts.length === 0, `the ${mode} hub offers ${JSON.stringify(starts)}`);
      }
    });
  },
}];
```

P01's Home always has the Back & leg tile (lower back and sciatica, journey §5.1). Opening Walk for P01 is through its tile. P05 isn't used here, so no hub is reached through Browse.

- [ ] **Step 7: Write** `scripts/e2e/acceptance/journeys/v12.mjs`

```js
/**
 * V-J12, customise Home (journey §17.1, §7.6), then every category opens its
 * real hub (Plan 2). P02's default Home has Sleep and no Water or Labs (no
 * water habit, no diabetes), so Water is added before it is moved: Edit Home
 * → Sleep "Hide" → "+ Add" → Water "Add" → Water "Move up" → "+ Add" → Labs
 * "Add" → Done. The layout holds over a reload, and the Labs tile opens the
 * Labs hub.
 */
import { persona } from '../fixtures/personas.mjs';
import * as hub from '../lib/hub.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ12';
export const title = 'Customise Home, and every category opens its hub';
export const safety = false;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const checkTiles = async page => (await page.getByRole('main').getByRole('region', { name: 'Check', exact: true }).getByRole('link').allInnerTexts()).map(s => flat(s).split(' ')[0]);

/** What shows that a hub is the real one (Plan 2), not v1's interim screen. */
const REAL = {
  Workout: { path: '/hub/workout', has: page => hub.card(page) },
  Stretch: { path: '/hub/stretch', has: page => hub.card(page) },
  Walk: { path: '/hub/walk', has: page => hub.card(page) },
  Steps: { path: '/hub/steps', has: page => ui.button(page.getByRole('main'), 'Add today’s steps') },
  Glucose: { path: '/hub/glucose', has: page => ui.button(page.getByRole('main'), 'Add reading') },
  'Blood pressure': { path: '/hub/bp', has: page => ui.button(page.getByRole('main'), 'Add reading') },
  'Back & leg': { path: '/hub/back', has: page => ui.button(page.getByRole('main'), 'Add reading') },
  Weight: { path: '/hub/weight', has: page => ui.button(page.getByRole('main'), 'Add reading') },
  Water: { path: '/hub/water', has: page => ui.button(page.getByRole('main'), 'Add water') },
  Sleep: { path: '/hub/sleep', has: page => ui.button(page.getByRole('main'), 'Add sleep') },
  Waist: { path: '/hub/waist', has: page => ui.button(page.getByRole('main'), 'Add reading') },
  Labs: { path: '/hub/labs', has: page => ui.button(page.getByRole('main'), 'Add a result') },
  Learn: { path: '/hub/learn', has: page => page.getByRole('main').getByRole('searchbox', { name: 'Search Learn' }) },
};

export const cases = [
  {
    name: 'hide, add, move up, add, done',
    async run(t) {
      const page = await t.open({ seed: persona('P02'), route: '/home' });
      const main = page.getByRole('main');
      const edit = async () => { await ui.tap(ui.row(main, 'Edit Home')); await main.getByRole('heading', { level: 2, name: 'Edit Home' }).waitFor(); };
      const add = async name => {
        await ui.tap(ui.button(main, 'Add a tile to Home'));
        const sheet = page.getByRole('dialog', { name: 'Add to Home' });
        await sheet.waitFor();
        await ui.tap(ui.button(sheet, `Add, ${name}`));
        // The sheet may stay open, saying "Added" (journey §7.6): close it if it does.
        if (await sheet.isVisible()) await ui.tap(ui.button(sheet, 'Close'));
        await sheet.waitFor({ state: 'hidden' });
      };

      await t.step(1, 'Edit Home: Sleep Hide, add Water, Water Move up, add Labs, Done', async () => {
        await t.must((await checkTiles(page)).includes('Sleep'), `P02’s Check tiles are ${JSON.stringify(await checkTiles(page))}, with no Sleep`);
        await edit();
        await ui.tap(ui.button(main, 'Hide, Sleep'));
        await add('Water');
        await ui.tap(ui.button(main, 'Move up, Water'));
        await add('Labs');
        await t.checkpoint('edit-home-done');
        // The Done at the end of the list (there is another beside the heading).
        await ui.tap(main.locator('button[data-flip="done"]'));
        await ui.heading(page, ui.HOME_TITLE);
      }, { input: 'Hide Sleep; Add Water; Move up Water; Add Labs; Done' });

      await t.step(2, 'Home keeps the layout, over a reload too', async () => {
        const want = ['Water', 'Weight', 'Labs'];
        await t.check(JSON.stringify(await checkTiles(page)) === JSON.stringify(want), `Check reads ${JSON.stringify(await checkTiles(page))}, not ${JSON.stringify(want)}`);
        await t.reload();
        await ui.heading(page, ui.HOME_TITLE);
        await t.check(JSON.stringify(await checkTiles(page)) === JSON.stringify(want), `after a reload Check reads ${JSON.stringify(await checkTiles(page))}`);
        await t.checkpoint('home-customised');
      });

      await t.step(3, 'The Labs tile opens the Labs hub, and Back returns Home', async () => {
        await hub.openHub(t, 'Labs', '/hub/labs');
        await t.check(await REAL.Labs.has(page).count() === 1, 'the Labs hub has no “Add a result”');
        await ui.tap(ui.back(page, 'Home'));
        await page.waitForFunction(() => location.hash.startsWith('#/home'), null, { timeout: 10000 });
      });
    },
  },
  {
    name: 'every category opens its real hub',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home' });
      await t.step(1, 'Browse → each category → its hub', async () => {
        for (const [title, { path, has }] of Object.entries(REAL)) {
          await ui.tab(page, 'Browse');
          await ui.tap(ui.row(page.getByRole('main'), title, 'link'));
          await page.waitForFunction(p => location.hash.replace(/^#/, '').split('?')[0] === p, path, { timeout: 15000 }).catch(() => {});
          const h1 = flat(await page.getByRole('main').getByRole('heading', { level: 1 }).innerText());
          await t.check(await t.route() === path || (await t.route()).startsWith(`${path}?`), `${title} opened ${await t.route()}, not ${path}`);
          await t.check(h1 === title && await has(page).count() === 1, `${title}'s hub reads “${h1}” and lacks its own first action`);
        }
        await t.checkpoint('every-hub');
      });
    },
  },
];
```

Food isn't in `REAL`: its interim Meal ideas screen stays until Plan 7. If Browse names a category differently from the registry's title, use the registry's title. Browse is built from `CATEGORIES` (Plan 1).

- [ ] **Step 8: Write** `scripts/e2e/acceptance/journeys/v14.mjs`

```js
/**
 * V-J14, set a flare (journey §17.1), with B-30's resume case.
 * - Flare-up → Home: Workout "Gentle only today" and Stretch "Gentle
 *   stretch", as are their hubs. Back to Normal two days later → the offer to
 *   move the plan, as v1.
 * - B-30: a Normal stretch saved part-way, then a flare, then Continue → what
 *   is left follows the gentler routine: nothing the flare leaves out runs.
 * P01, whose back history makes a flare change the routine (D36).
 */
import { persona } from '../fixtures/personas.mjs';
import * as g from '../lib/guide.mjs';
import * as hub from '../lib/hub.mjs';
import * as move from '../lib/move.mjs';
import * as player from '../lib/player.mjs';
import { stretchPreview } from '../lib/safety-c.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ14';
export const title = 'Set a flare: the gentler words and routine everywhere, and a saved stretch resumed gentler';
export const safety = false;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const IST = s => Date.parse(`${s}+05:30`);

/** Flare-up from Home's status row, then the sheet closed, whatever it offered. */
async function flare(t) {
  const sheet = await g.setStatus(t, 'Flare-up');
  await sheet.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  if (await sheet.isVisible()) await ui.tap(ui.button(sheet, 'Close'));
  await sheet.waitFor({ state: 'hidden' });
}

export const cases = [
  {
    name: 'flare words, then back to normal',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home' });
      const main = page.getByRole('main');

      await t.step(1, 'How are you today? → Flare-up', async () => {
        await flare(t);
        await t.checkpoint('flare-set');
      });

      await t.step(2, 'Home: Workout "Gentle only today", Stretch "Gentle stretch"', async () => {
        await ui.tab(page, 'Home');
        await t.check(flat(await hub.tile(page, 'Workout').innerText()).includes('Gentle only today'), `the Workout tile reads “${flat(await hub.tile(page, 'Workout').innerText())}”`);
        await t.check(flat(await hub.tile(page, 'Stretch').innerText()).includes('Gentle stretch'), `the Stretch tile reads “${flat(await hub.tile(page, 'Stretch').innerText())}”`);
      });

      await t.step(3, 'Their hubs say the same, with the flare-adjusted options', async () => {
        await hub.open(t, 'guided');
        const w = flat(await hub.card(page).innerText());
        await t.check(w.includes('Gentle only today'), `the Workout hub does not say “Gentle only today”: ${w.slice(0, 200)}`);
        await hub.open(t, 'stretch');
        const s = flat(await hub.card(page).innerText());
        await t.checkpoint('flare-stretch-hub');
        await t.check(s.includes('Gentle stretch') && s.includes('Your back is in a flare-up, so this is the gentler routine.'), `the Stretch hub reads: ${s.slice(0, 240)}`);
      });

      await t.step(4, 'Two days later, Back to normal: the offer to move the plan', async () => {
        await t.setTime(IST('2026-10-10T09:00:00'));
        await t.reload();
        await g.setStatus(t, 'Normal');
        const offer = flat(await page.getByRole('dialog', { name: 'Status' }).innerText().catch(() => main.innerText()));
        await t.checkpoint('flare-back-to-normal');
        await t.check(/Move my plan back \d+ days?/.test(offer) && /Keep my plan as it is/.test(offer), `returning offers no plan shift: ${offer.slice(0, 200)}`);
      });
    },
  },
  {
    name: 'B-30: a stretch saved before the flare resumes gentler',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home' });
      let normal = [];

      await t.step(1, 'Normal: the Stretch hub’s routine, Check in & start, two steps, Save and exit', async () => {
        await hub.open(t, 'stretch');
        normal = await stretchPreview(page);
        await t.must(normal.length > 0, 'the Stretch hub lists no routine');
        const r = await hub.begin(t);
        if (r.sheet) {
          await ui.answerCheckIn(t, r.sheet, ui.normalAnswers('P01'));
          await ui.tap(move.sheetStart(r.sheet));
        }
        await page.waitForURL(/#\/session/, { timeout: 15000 });
        await player.begin(page);
        for (let i = 0; i < 2; i++) await t.advance(((await player.stepRemainingMs(page)) ?? 0) + 300);
        await ui.tap(player.control(page, 'End session'));
        const leave = page.getByRole('dialog', { name: 'Leave the session?' });
        await leave.waitFor();
        await ui.tap(ui.button(leave, 'Save and exit'));
        await page.waitForFunction(() => location.hash.startsWith('#/hub/stretch'), null, { timeout: 15000 });
        await t.checkpoint('b30-saved');
      }, { input: 'normal answers; two steps; End session → Save and exit' });

      await t.step(2, 'Flare-up; the Stretch hub offers to continue, with the gentler routine listed', async () => {
        await flare(t);
        await hub.open(t, 'stretch');
        const c = flat(await hub.card(page).innerText());
        await t.check(/Continue your stretch/.test(c) && await hub.start(page).count() === 1, `the Stretch hub does not offer to continue during the flare: ${c.slice(0, 200)}`);
      });

      await t.step(3, 'Continue: nothing the flare leaves out runs', async () => {
        const gentle = await stretchPreview(page);
        const leftOut = normal.filter(n => !gentle.includes(n));
        t.note(`left out by the flare: ${JSON.stringify(leftOut)}`);
        const r = await hub.begin(t);
        if (r.sheet) await ui.tap(move.sheetStart(r.sheet));
        await page.waitForURL(/#\/session/, { timeout: 15000 });
        const resume = player.control(page, 'Resume').or(player.control(page, 'Start'));
        if (await resume.count()) await ui.tap(resume);
        const { seen } = await player.runStretchToEnd(t);
        await t.checkpoint('b30-resumed');
        const ran = seen.filter(s => leftOut.includes(s));
        await t.check(ran.length === 0, `after the flare the resumed stretch still ran ${JSON.stringify(ran)} (B-30)`);
        await t.check(seen.filter(s => normal.includes(s)).every(s => gentle.includes(s)), `a movement outside the gentler routine ran: ${JSON.stringify(seen)}`);
      });
    },
  },
];
```

The engine test in Task 7 proves that something is left out for some routine. This journey proves the device follows it for P01's routine. When `leftOut` is empty for P01's last routine, its note says so, and the check still holds: every movement that ran is in the gentler routine.

- [ ] **Step 9: Write** `scripts/e2e/acceptance/journeys/v15.mjs`

```js
/**
 * V-J15, a stop from a tile (journey §17.1, §4.7): the Stretch tile → its hub
 * → Check in & start → the check-in reports new leg weakness → the stop, and
 * the safety surface on every tab. The Stretch hub then shows the same stop,
 * with no start, while Learn and a reading hub still open and still add.
 * P01.
 */
import { persona } from '../fixtures/personas.mjs';
import * as hub from '../lib/hub.mjs';
import * as move from '../lib/move.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'VJ15';
export const title = 'A stop from a tile, on every tab, with Learn and readings still open';
export const safety = true;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const STOP = 'No exercise today. Get medical advice today.';

export const cases = [{
  name: 'new leg weakness in the Stretch check-in',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/home' });
    const main = page.getByRole('main');

    await t.step(1, 'Stretch tile → hub → Check in & start → new leg weakness', async () => {
      await hub.open(t, 'stretch');
      const r = await hub.begin(t);
      await t.must(!!r.sheet, `Check in & start opened ${r.route}, not the check-in`);
      await ui.answerCheckIn(t, r.sheet, ui.normalAnswers('P01', { back: { pain: 3, leg: 4, reach: 'Below knee', flags: [ui.BACK_FLAG.newWeakness] } }));
      await page.waitForTimeout(600);
      const { title: outcome } = await move.outcome(page);
      await t.checkpoint('tile-stop-outcome');
      await t.check(outcome === STOP, `the check-in reads “${outcome}”, not “${STOP}”`);
      await t.check(await move.sheetStart(r.sheet).count() === 0, 'the check-in still offers a start');
      await ui.tap(ui.button(r.sheet, 'Close'));
    }, { input: 'normal answers, with back 3, leg 4 below the knee, and new foot drop or a leg getting weaker' });

    await t.step(2, 'The stop and the safety surface on every tab', async () => {
      for (const tab of ['Home', 'Trends', 'Browse', 'Me']) {
        await ui.tab(page, tab);
        const u = await hub.urgent(page);
        await t.check(!!u && u.kind === 'seekHelp' && u.headline === STOP, `${tab} shows ${u ? `“${u.headline}” (${u.kind})` : 'no safety surface'}`);
      }
      await t.checkpoint('tile-stop-tabs');
    });

    await t.step(3, 'The Stretch hub: the same stop, with no start', async () => {
      await hub.open(t, 'stretch');
      const r = await hub.refusal(page);
      await t.checkpoint('tile-stop-stretch-hub');
      await t.check(!!r && r.title === STOP, `the Stretch hub reads “${r?.title}”`);
      await t.check(!!r?.review, 'the stop offers no “Review today’s check-in” to put a mistaken answer right');
      const starts = (await main.getByRole('button').allInnerTexts()).map(flat).filter(l => hub.STARTERS.test(l));
      await t.check(starts.length === 0, `the Stretch hub offers ${JSON.stringify(starts)}`);
    });

    await t.step(4, 'Learn and a reading hub still open, and a reading can still be added', async () => {
      await hub.openHub(t, 'Learn', '/hub/learn');
      await t.check(await main.getByRole('searchbox', { name: 'Search Learn' }).count() === 1, 'Learn does not open during the stop');
      await hub.openHub(t, 'Glucose', '/hub/glucose');
      await ui.tap(ui.button(main, 'Add reading'));
      const form = page.getByRole('dialog', { name: 'Glucose' });
      await form.waitFor({ timeout: 10000 });
      await t.check(await form.getByRole('textbox', { name: 'Reading', exact: true }).count() === 1, 'the Glucose form does not open during the stop');
      await ui.tap(ui.button(form, 'Close'));
      await t.checkpoint('tile-stop-still-open');
    });
  },
}];
```

P01's Home has a Learn tile only when there is room (it doesn't by default), so `openHub` reaches Learn through Browse.

- [ ] **Step 10: Run the new journeys**

Run: `npm run e2e:acceptance -- --only=VJ01,VJ04,VJ05,VJ06,VJ09,VJ12,VJ14,VJ15 > /tmp/fit-checks/accept-v2-p2-vj.log 2>&1; tail -n 40 /tmp/fit-checks/accept-v2-p2-vj.log`
Expected: every case passes, in all four projects.

For each failure, find which side it is on:
- **The journey's locator is wrong:** fix the journey to the DOM contract (Task 15's `hub.mjs`).
- **The app doesn't do what §17 says:** fix the app with a failing unit test first, and say so on the board.

Never weaken a clinical check to make one pass.

- [ ] **Step 11: The full run**

Run: `npm run e2e:acceptance > /tmp/fit-checks/accept-v2-p2-all.log 2>&1; tail -n 40 /tmp/fit-checks/accept-v2-p2-all.log`
Expected: every J, S and VJ case passes.

- [ ] **Step 12: The board's result entry.** Append under the Task 1 entry:

```markdown
### 2026-10-10 — [claude] v2 Plan 2 (hubs): result

- Every registry category opens a real hub, except Food, whose interim Meal ideas stays until Plan 7. Each movement hub reads the shared gate in the tile's words, and starts only through it.
- V-J01, V-J04, V-J05, V-J06, V-J09, V-J12, V-J14 and V-J15 pass in all four projects, as does B-30's resume case. The J and S journeys pass, with these navigation changes: <one line per journey changed in Task 15, from the board's v2 log>.
- The weekly goal changes from next Monday (B-16), and a day's step goal by the day.
- Steps say "at least" only after a total entered at a real time (D52). Paste reads one number, or nothing.
- Left for later: <each Review Focus line or finding that Task 17 defers, with its plan>.
```

Fill the two placeholders in angle brackets from the board's log and Task 17's findings when you write the entry. They are records of what happened, not decisions to make now.

- [ ] **Step 13: Commit**

```bash
git add scripts/e2e/acceptance/journeys/v01.mjs scripts/e2e/acceptance/journeys/v04.mjs scripts/e2e/acceptance/journeys/v05.mjs scripts/e2e/acceptance/journeys/v06.mjs scripts/e2e/acceptance/journeys/v09.mjs scripts/e2e/acceptance/journeys/v12.mjs scripts/e2e/acceptance/journeys/v14.mjs scripts/e2e/acceptance/journeys/v15.mjs scripts/e2e/acceptance/run.mjs docs/reimagine/BOARD.md
git commit -m "test: Add the Plan 2 journeys, V-J01 to V-J15, and B-30's resume case"
```

---

### Task 17: Review and reconcile

**Files:** whatever the findings touch.

- [ ] **Step 1: Codex.** Plan 2's work starts at Task 1's commit, so its parent is the base:

  ```bash
  BASE=$(git log --format=%H -1 --grep='Record the v2 hubs decisions on the board')^
  ```

  Build a static bundle in `/tmp/fit-checks/v2p2-prompt.md`. It holds:
  - this plan;
  - journey §4, §7.5, §8, §9.6, §16 (Goals), §17 (the eight V-Js) and §25 (B-09, B-14, B-16, B-30);
  - `git diff "$BASE"..HEAD -- src scripts/e2e/acceptance`;
  - every new file in full.

  Ask for findings, each with a reproduction:
  - a start that bypasses the gate;
  - a hub that disagrees with its tile or with Home's card;
  - a weekly goal that moves inside a week;
  - a steps figure that counts anything twice;
  - a hub that dead-ends;
  - copy that breaks §20.

  Then run:

```bash
codex exec -m openai.gpt-6.1-sol -c model_reasoning_effort='"max"' -c 'model_providers.amazon-bedrock.aws.region="us-east-1"' -s read-only -C "$PWD" -o /tmp/fit-checks/v2p2-codex.md - < /tmp/fit-checks/v2p2-prompt.md
```

- [ ] **Step 2: Kiro.** Run it on the same diff, read-only:

```bash
kiro-cli chat --no-interactive --trust-tools=fs_read --model claude-opus-5.5 "Review FitStrong v2 Plan 2 (hubs). Read docs/superpowers/plans/2026-10-10-fitstrong-v2-plan-2-hubs.md, then the diff with: git diff $BASE..HEAD -- src scripts/e2e/acceptance. Report every way a hub can start movement without the shared gate, disagree with its Home tile, move a weekly goal inside the week, count steps twice, or dead-end, each with the file, line and a reproduction."
```

- [ ] **Step 3: Reconcile.** For each finding:
  - reproduce it with a failing test (unit, or an acceptance case);
  - fix it;
  - log it on the board with its reviewer's id (V2-…, KV2-…).

  A finding that is wrong gets a one-line reason on the board, rather than silence.

- [ ] **Step 4: Gates, the full suite, commit**

```bash
npx tsc -b && npm run lint && npx vitest run
npm run e2e:acceptance > /tmp/fit-checks/accept-v2-p2-final.log 2>&1; tail -n 20 /tmp/fit-checks/accept-v2-p2-final.log
git add -A src scripts/e2e/acceptance docs/reimagine/BOARD.md
git commit -m "fix: Close the Plan 2 review findings"
```

---

## Acceptance cases added

| Case | Persona | Steps | Pins |
| --- | --- | --- | --- |
| VJ01 | P01, stretch focus, not enrolled | Home → Right now "Check in & stretch" → check-in, two BP readings a minute apart → Go ahead → player → summary → Home | +10 min this week, "Stretched 1 day" (§17 V-J01) |
| VJ04 | P03 | Glucose tile → hub → Add reading → 62 → guidance → Home → tiles → Stretch hub | "This is a low. Treat it now.", "Re-check at 9:15 am", three tiles "Waiting for your re-check at 9:15 am", no start (§17 V-J04, §4.2) |
| VJ05 | P01 | BP tile "Check day" → hub "When to check next" → Add reading → 124/78, the minute, 122/76 → Save | ESH weekly check day, the guided minute, Latest 122/76 at 9:01 am, NICE's averaging note (§17 V-J05, §8.2) |
| VJ06 | P01, enrolled | Workout tile → hub → Check in & start → check-in → player → End session → summary → Save and finish | Hub and tile name the same session; Back to `/hub/workout` (§17 V-J06, B-30) |
| VJ09 | P01 | Back & leg tile → hub → Add reading 6 and 5 → "How far it reaches, or new weakness" → bladder or bowel emergency | Latest wording, the emergency on all four tabs and all three movement hubs (§17 V-J09, §4.7, D53) |
| VJ12 (two cases) | P02; P01 | Edit Home: Hide Sleep, Add Water, Move up Water, Add Labs, Done, reload, Labs tile → hub → Back. Then Browse → each category | Layout kept; every category but Food opens its real hub (§17 V-J12, §7.6, roadmap) |
| VJ14 (two cases) | P01 | Flare-up → tiles → Workout and Stretch hubs → two days later Back to normal. Then a Normal stretch saved part-way → Flare-up → Continue | "Gentle only today", "Gentle stretch", the shift offer; the resumed run never shows what the flare leaves out (§17 V-J14, B-30, A-34) |
| VJ15 | P01 | Stretch tile → hub → Check in & start → new leg weakness → tabs → Stretch hub → Learn → Glucose → Add reading | "No exercise today. Get medical advice today." on all four tabs, no start, Learn and readings still open (§17 V-J15, §4.7) |

---

## Self-review against the spec

**Spec coverage.** Each requirement in scope, and the task that builds it:

- **§4.1–4.2, one gate (no hub-local safety decision):**
  - Task 4: `movementCard` reads `gateOf`, and every action that can move is a `gate` target, sent through `useStartMovement().start`;
  - Tasks 6–8: each hub passes its starts through `runAction`;
  - Review Focus 1;
  - c9948de's clock wake keeps the words fresh.
- **§4.7, B-02, one safety surface:**
  - `HubFrame` renders inside `Screen`, so Plan 1's `ScreenTopContext` surface heads every hub (Task 3);
  - a hub opened on a hold or a stop names nothing for the morph (`held`);
  - VJ09 and VJ15 check it on every tab.
- **§5.1, the registry:** every category's `hub`, and its `trend` where declared. Tasks 6–14 make each hub real; VJ12's second case opens all of them; Learn declares no trend, so its hub has no "See trends".
- **§7.5, one copy table:**
  - Task 4's tests walk every row: allowed, adjust, check-in only, hold, profile gap, not enrolled, stop, Away or Unwell, and flare;
  - hold titles are the gate's own headline (§8.4: the gate's card, the same as Home's);
  - `movementLine` gives the tile's words, which the card reuses for the flare and the re-check time.
- **§8.1, shared navigation:**
  - Back names the opener (`HUB_BACK`, `backTarget`), or Home for a direct link (Task 3, J20);
  - the category tint (`HUB_WASH`, with its contrast tested);
  - one primary action per region (`MovementCard`, and the reading hubs' "Add reading").
- **§8.2, the variants:**
  - movement: Right now, Options, This week (`WeekStrip`, a list below 375 px or above 130%), History (3 rows, then "Show all") and See trends (Tasks 4–8);
  - reading: Latest, "When to check next", "Add reading" in one tap, This week, History and See trends (Tasks 9–11, 13);
  - Steps: "Add today’s steps", "Daily step goal" and "How steps are counted" (Task 12);
  - Learn: "For you" first, then all topics, and search (Task 14).
- **§8.3, hub contents:**
  - **Workout:** enrolled or not, rest day, the four options, and `?join=1` (Task 6).
  - **Stretch:** v1's four areas at 10 or 15 minutes, a reason from real inputs only (`stretchReason`), and "In this routine" (Task 7).
  - **Walk:** "Start walk", the kind chosen by context, the options and "How walks are measured" (Task 8). Map and Save route are Plan 6's.
- **§8.4, hub states:**
  - Normal, held, Away or Unwell (Task 4);
  - nothing recorded yet ("Add your first …", Tasks 10–13);
  - loading (`HubSkeleton`, Task 3);
  - failed (v1's "This screen didn't load" stays from Plan 1's `ErrorBoundary`).
- **§9.6, steps:**
  - entered, walks only and "at least", with both sources, and a stand-in noon total that adds nothing (Review Focus 3);
  - a corrected total counted from its correction;
  - Paste reads one number or nothing (Review Focus 4);
  - "FitStrong counts steps only while it's open on the screen" (B-24) in "How steps are counted" (Task 12).
- **§16, Goals:**
  - B-16: the weekly goal changes from next Monday, and this week keeps its goal; a first goal applies at once (Task 2, Review Focus 2);
  - the daily step goal changes by the day (v1's `stepsGoalOn`, Task 12).

  The goals' place in Me is Plan 4's. The hubs open the same sheets.
- **§17:** V-J01, V-J04, V-J05, V-J06, V-J09, V-J12, V-J14 and V-J15 (Task 16).
- **§19, addresses:**
  - `/hub/:id` for each category;
  - `/hub/labs?metric=` (B-14);
  - `/hub/workout/log` and `/track/workout` → the log (Task 6, D51);
  - `?add=` opens a hub's own form (Task 11, D55);
  - an interim `/trends/:id` never dead-ends (Task 3).
- **§20, design language:**
  - text on the wash meets contrast (Task 3's token test);
  - targets of 60 px for primaries and 48 px for the quieter actions;
  - status words in a status region;
  - one primary action per region.
- **The amendments:**
  - B-03: sheets keep their owner, since the hubs reuse v1's sheets;
  - B-04: History rows open the record, where Undo lives;
  - B-08: Options and the Length control keep to five choices;
  - B-09: Task 8 and Review Focus 5;
  - B-10: "Add reading" is one tap to the form;
  - B-14: Task 6 and Task 11;
  - B-16: Task 2;
  - B-20: the hubs wake at `nextBoundary`, as Home does;
  - B-30: Task 7's engine test, and VJ14's second case;
  - M3: Task 3's `markMorph`, the `hub-card-bg` far end and the content's rise once the morph is half done; skipped when the hub opens on a hold (`held`, `skipNextTransition`);
  - M4: History rows push with a view transition, and their Back names the hub (Plan 1's stack restores scroll and focus);
  - M8: every form is v1's sheet;
  - M12: a summary returns to where the task began (VJ06);
  - M16: the form opens at once, guidance replaces it in the first frame (v1), and the new row shows a brief highlight (D55);
  - M24: the skeleton after 150 ms, static under Reduce motion;
  - motion rule 2: urgent ink has no entrance (`MovementCard`).

**Gaps, each deferred on purpose and logged in Task 1:**
- M3's Back off-screen refinement goes to Plan 8.
- The Shortcut help for steps waits for a device check (D54).
- The Walk hub's map and route chips, and the live walk itself, are Plan 6's.
- Food is Plan 7's. Its hub stays the interim Meal ideas.
- Trends' own trend screens are Plan 3's. See trends opens the interim `/trends/:id`, or Trends.
- Me's Goals section is Plan 4's.
- Food's interim screens keep v1's Back to "Guide" until Plan 7. The address still lands on Learn.

**Placeholder scan.** The only angle-bracket text left is in the board's result entry (Task 16 Step 12). It is filled from the board's log and the review's findings when the task runs, not decided now. The review's base commit comes from `git log` (Task 17 Step 1). The `<time>` in the check-by-eye steps stands for the clock at the moment of the check.

Every code step has its code. Where a step depends on the code at the time, it gives the `grep` that finds it and the rule to apply.

**Type consistency:**
- `HubCard`, `HubAction`, `HubActionKind`, `CardInput`, `ActionTarget` and `ActionContext` are defined in Task 4, and used under those names in Tasks 6–8.
- `HistoryRow` and `HistoryList`'s rows (`key`, `label`, `detail`, `ref`) are defined in Task 5. Tasks 11–13 pass `metricRows`' `ListRow` through the same four fields.
- `historyRange(spec, observations, current)` is defined in Task 10, and used in Tasks 11–13.
- `stepsDayFigure` and `stepsFromText` are defined in Task 12, and used by Home's `stepsLine` and `QuickLog`.
- `weeklyGoalOn` and `pendingWeeklyGoal` are defined in Task 2, and used in Tasks 6–8. `weeklyGoalChanges` and the setting `weeklyMovementGoalHistory` keep the names Plan 4's Goals screen consumes.
- `hub.START`, `hub.STARTERS`, `card`, `start`, `open`, `openHub`, `refusal`, `begin` and `urgent` are defined in Task 15, and used in Task 16.

**Review Focus.** Each of the five lines has its test in the owning task:
1. gate-bypassing quiet buttons: Task 4's `movementCard` and `actionTarget` tests, and the card's caller test;
2. a weekly goal changed mid-week: Task 2;
3. a stand-in noon steps total, and a corrected total: Task 12;
4. pasted step formats: Task 12;
5. the after-meal suggestion across midnight and outside its window: Task 8.
