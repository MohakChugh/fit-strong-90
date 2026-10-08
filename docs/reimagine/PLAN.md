# Implementation plan — holistic health app

Authoritative build document. Decisions live in `BOARD.md` (D1–D24); do not contradict them. Research: `docs/research/frontend-only-health-platform.md` (platform truth), `market-analysis-health-apps.md` (product evidence), `clinical-tracking-protocols.md` (guideline cadence), `docs/reimagine/codex-vision.md` (UX proposal).

**Non-negotiable:** front-end only, local-only, iPhone 13 Pro Max first and 320 px wide at minimum, no assistant, production quality with zero known bugs.

## Architecture

```
src/
  store/        NEW  IndexedDB, reactive, append-only series, migration, export
  health/       NEW  observation kinds, scopes, aggregation, cadence rules
  content/      NEW  Source / Claim / GuidanceCard / Food / MealTemplate / Habit
  walk/         NEW  geolocation session, pace smoothing, gap stamping
  reminders/    NEW  in-app scheduler, badge, .ics generation
  components/
    hig/        NEW  Screen, Group, Row, TabBar, Sheet, Ring, QuickLog, charts
  screens/      NEW  today/ move/ track/ guide/ you/
  engine/ session/ voice/ motion/ data/ profile/   UNCHANGED — call, do not rewrite
  pages/        DELETED at the end, once every route is replaced
```

**Rule:** the domain tier (`engine`, `session`, `voice`, `motion`, `data`) is called, never reimplemented. The readiness engine in particular encodes audited safety rules and has tests; a new screen that needs a safety decision asks it.

## Task 1 — Data layer (`src/store`, `src/health`) · blocks everything

**Why:** `localStorage` is 5 MiB and synchronous (D13). A lifelong record needs IndexedDB.

- `src/health/observation.ts` — the one record type for every measurement:
  ```ts
  type Scope = 'pointInTime' | 'dayTotal' | 'sessionObserved';
  interface Observation {
    id: string; kind: ObservationKind; at: string /* ISO with offset */; day: string /* YYYY-MM-DD local */;
    value: number; unit: string; scope: Scope;
    source: 'manual' | 'measured' | 'imported'; context?: string; note?: string;
    coverageMs?: number; editedAt?: string;
  }
  ```
  `ObservationKind`: `glucose | bloodPressureSystolic | bloodPressureDiastolic | weight | waist | steps | walkDistance | walkDuration | movementMinutes | water | sleep | backPain | legPain | mood | hba1c | b12 | vitaminD`.
- `src/health/aggregate.ts` — **the only place observations are summed.** Refuses to sum across scopes (D10): a `dayTotal` replaces the previous `dayTotal` of the same kind and source; `sessionObserved` intervals that overlap are flagged, not added. Exported `summarise(day)` and `series(kind, range)`.
- `src/store/db.ts` — IndexedDB via a thin wrapper (no new dependency; `idb` is optional — prefer hand-rolled, it is ~80 lines). Stores: `observations` (index on `kind`, `day`), `sessions`, `settings`, `content-state`. Every write handles `QuotaExceededError` and surfaces it (D16).
- `src/store/useStore.ts` — **one** reactive store with subscriptions, not a per-hook snapshot. This is the bug we hit today with Clear-all-data.
- `src/store/migrate.ts` — v4 `localStorage` → v5 IndexedDB. Lifts glucose and BP out of `checkIns[]` into observations, keeps `sessions`, `personalRecords`, `bodyMetrics`, `profile`, `checkIns`, `focusOverrides`. Idempotent. **Must not lose a single existing record**; a test asserts round-trip equality on a realistic v4 blob.
- `src/store/transfer.ts` — export: one JSON doc, gzipped with `CompressionStream`, offered through `navigator.share({ files })` with `<a download>` fallback behind `canShare()` (D17). Import previews counts per kind and asks merge-or-replace before writing.
- Call `navigator.storage.persist()` on first run (D16).

**Tests:** scope-mixing refusal, day-total replacement, overlap flagging, migration fidelity, quota failure path, export/import round trip.

## Task 2 — Design system (`src/components/hig`) · partly done

Done: `Screen` (collapsing large title), `Group`/`Row` (grouped inset list), `TabBar` (four tabs).

Remaining:
- `Sheet` wrapper over the existing base-ui sheet with web "detents" (medium/large layout states), a labelled close, focus handling and a predictable return.
- `Ring` — one progress ring for the user-chosen recorded-movement-minutes goal, with the figure beside it ("12 of 20 chosen minutes"). Not Apple's three-ring contract (we cannot observe calories or standing).
- `QuickLog` — a sheet that takes one observation: kind, value, unit, date/time, source, Save. Numeric keypad, `inputMode`, 17 px minimum to avoid iOS focus zoom.
- `Chart` primitives — a line/band chart and a bar chart in plain SVG (no chart dependency): axis, "normal range" band, missing-data gaps shown as gaps, accessible `<table>` alternative. Used by Metric Detail and the signature chart.
- `Stat` — a big tabular-numeral readout for timers, pace and readings.
- Motion: `view-transition-name` on the row→detail pairing so Track rows expand into their detail; everything behind `prefers-reduced-motion` (D12 and the motion position in the board).

## Task 3 — Shell and routing

- Routes: `/today`, `/move`, `/track`, `/guide`, plus `/you` and detail routes. `/session` keeps its full-screen player.
- `AppLayout` renders `TabBar`; old routes redirect to the new ones so a bookmark still works.
- First run: initial-focus question (three choices + Explore first), **install-to-Home-Screen step with the data-durability explanation** (D16), and only the safety-relevant profile questions before guided movement.

## Task 4 — Today

One adaptive recommendation with **always-visible** "Why this?" (D20), `Choose something else` in a fixed position opening the five modes (D6), a compact day summary, one plan row when enrolled, at most one opted-in habit prompt. Priority order exactly as `codex-vision.md` §2 sets it: safety/recheck → resumable session → explicit preference → repeated habit → scheduled session → post-session or rest → too little history. The recommendation freezes while the screen is open.

## Task 5 — Move

- **Stretch** — a composed short routine. **Must go through `mobilityBlock`** with the safety-flag matrix, irritability swaps and the spinal-loading ladder. If it cannot reuse that, it does not ship.
- **Walk** — `src/walk`: `watchPosition` with accuracy filtering and jitter smoothing, `visibilitychange` gap stamping and a new segment on return (D18), `Screen Wake Lock` feature-detected (D24), no WebGL while tracking, ~1 Hz re-render. Timed walking works with location denied. A foot-ulcer or neuropathy flag must not be offered a weight-bearing walk.
- **Guided Session** — existing player, reached through one setup rather than two confirmations.
- **Your Plan** — this week first, phases collapsed; UI says **"Week N of 12"** (D11).
- **Find an exercise** — the existing library, filters in a sheet.

## Task 6 — Track

- **My Day** — date, Add, Timeline/Trends, every record for the day with its source label.
- **Quick Log** — one fact at a time.
- **Workout Log** — what `WorkoutPage` should have been: one exercise at a time, no coached Start, no builder toolbar.
- **Trends / Metric Detail** — one chart at a time, with units, source and missing data shown honestly.
- **The signature screen (D21)** — pain and leg symptoms against the spinal-loading ladder over time, annotated with sessions and "worse" checkpoints. Nothing on the market has this.

## Task 7 — Guide and the content system

`src/content` with the record types from `codex-vision.md` §8, minus `Question Flow` and `Response Template` (no assistant). Every claim carries source IDs with section locators, applicable population, reviewer and reviewed date. Screens: Guide (search + topics), Topic/Article, Meal Ideas/Meal Detail, Sources.

Initial topics: Indian food for diabetes and blood pressure; vitamin B12; vitamin D; desk setup and sitting; hydration; sleep; movement and back care. **No nutrient database** (D22) — authored guidance, named portions, cited.

## Task 8 — You, habits and reminders

Grouped: Profile & Health, Food Preferences, Habits & Reminders, Voice & Demos, Appearance & Text, Data & Offline. `src/reminders`: in-app scheduling while open, `setAppBadge` for outstanding items, and **generated `.ics`** for anything that must fire when the app is closed (D15), with honest copy about which is which.

## Task 9 — Delete the old surface

Remove `ProgressPage`, `HistoryPage`, `SettingsPage`, `DashboardPage`, `WorkoutPage`, `PlanPage` once replaced. Keep `SessionPage`, `LibraryPage` (as a child), `OnboardingPage` (shortened), `ProfilePage`'s data.

## Task 10 — Validation (C9: zero known bugs)

1. `npm test` — every new module unit-tested; the existing 2,110 must still pass.
2. `tsc -b`, `npm run lint`, `npm run build` clean.
3. **Independent bug scans:** at least two Codex passes at max reasoning over the diff, plus one fresh Claude reviewer, each hunting bugs rather than confirming the design. Every finding either fixed or recorded on the board with a reason.
4. **e2e:** journey at 430×932 and 320×568; the existing `autoplay`, `voice-start` and `offline` checks must still pass; new checks for the walk session (permission denied, backgrounded mid-walk), Quick Log round trip, migration from a real v4 blob, and export/import.
5. Screenshots at 430×932 reviewed by eye for the Apple-esque bar.

## Sequence

Task 1 and 2 first (1 blocks everything). Then 3. Then 4–8 in parallel. Then 9, then 10. Nothing is handed back to the owner until Task 10 passes (C8).
