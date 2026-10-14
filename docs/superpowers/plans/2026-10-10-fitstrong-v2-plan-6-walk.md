# FitStrong v2 Plan 6: Walk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make walking v2's. The first walk asks two separate consents (keep the route on this phone; show map pictures). Every start unlocks motion and audio inside the tap that finally starts the walk, waits, and asks the gate again before anything moves (B-01). The live walk draws its route as separate SVG lines on a plain grid, never with map pictures, and speaks recorded cues at fixed minutes. A durable journal survives a crash, segments survive clock changes and midnight, and the summary and detail show an "about" energy figure and an opt-in static OpenStreetMap map. All of it sits on one storage foundation: IndexedDB 2 and schema 6, which also creates Plan 7's food stores.

**Architecture:**
- **Task 1 lays the shared storage.** IndexedDB goes from version 1 to 2 and creates every v2 store at once: `routes` (this plan), `meals`, `savedMeals` and `customFoods` (Plan 7), and `walkJournal` (this plan's crash recovery, outside the record).
  - A registry, `src/store/records.ts`, gives each record store its key, limit, validator and backup rule.
  - The snapshot, the deletion records (D-06), backups, merges, replace and import validation all work from that registry. Plan 7 only fills in its three rules.
- **The rules are pure modules, each with its own tests:** the route record, route geometry, segment accrual (B-19), the journal, energy, the start sequence, consents, cues, tiles and recovery.
- **The live controller (`src/walk/live.ts`) still owns the walk.** It gains a monotonic port, route lines and a journal port. Screens only lay out what the pure readouts return.
- **Every walk starts through one place.** Plan 2's contract is that every start calls `useStartMovement().start(mode, href, label)`. Task 8 gives that hook a walk path: for an href to `/walk/live`, it runs the first-walk questions and B-01's sequence in place of navigating, so the Walk hub, B-09's button, the chooser and the check-in sheet all get them with no change to their callers.
- **Map pictures are our own small static map:** `<img>` tiles for the current view, under our own SVG drawing. There's no map library (journey §22).

**Tech stack:** React 19, TypeScript (strict, `erasableSyntaxOnly`), Vite 8, Tailwind v4, React Router 7.13 hash router, the hand-rolled IndexedDB store, Vitest (node environment, with `@/test/host` for caller tests), Kokoro voice packs, and the Playwright-core acceptance suite (`npm run e2e:acceptance`).

**Spec:** `docs/superpowers/specs/2026-10-08-fitstrong-v2-journey-design.md` (cited as J§): §9 entire, §12.4, §18.2–18.3, §22 and §25 (B-01, B-05, B-17, B-18, B-19, B-23, B-24, B-26, B-29; §25 overrides earlier sections). Also `docs/superpowers/specs/2026-10-08-fitstrong-v2-motion-design.md` M10, M13 and M14. Read both before starting. The roadmap is `docs/superpowers/plans/2026-10-08-fitstrong-v2-roadmap.md`, and `docs/superpowers/plans/2026-10-08-fitstrong-v2-plan-1-shell-home.md` shows how Plan 1 left Home, routes and the acceptance helpers.

**Depends on:** Plans 1 and 2 (roadmap). Plan 2 leaves these in place, and this plan builds on them:
- **The Walk hub,** `src/screens/hub/WalkHub.tsx` (moved from v1's `WalkSetup`), at `/hub/walk`. Its Start, "Just a walk" and B-09's after-meal button ("I had lunch at 1:10 pm: walk now", from `afterMealSuggestion()` in `src/walk/plan.ts`) all call `useStartMovement().start('walk', liveHref(...), label)`.
- **Home's Right now card** (Plan 1, K-32) starts a walk directly, B-09's included ("I had lunch at 1:10 pm: walk now"), through `start('walk', directWalkHref(…), 'Start walk')`. V-J02 begins there.
- **The day's steps figure** and its labels (J§9.6), through Plan 2's `stepsDayFigure` and its board decision D52. This plan doesn't touch them. It owns only the walk's own steps wording: live, summary and detail.

If a name has moved, find it with `grep -rn "start('walk'" src/screens` and `grep -rn "afterMealSuggestion" src`, and keep this plan's behaviour.

**Out of scope:** the hubs' layout (Plan 2), Trends (Plan 3), Me's layout (Plan 4), food (Plan 7), and Recently deleted (Plan 8). Plan 8's deletion payloads must lose their route coordinates in "Erase all routes" (D93, Task 14). V-J41 (a time-zone change mid-walk) is Plan 8's acceptance case; its rules are built and unit-tested here (Task 3).

## Global Constraints

- **Branch and commits:** work on `feat/v2-journey`. Never push to `main`. Make one commit per task, with a conventional message.
- **The only new network request** is `https://tile.openstreetmap.org/{z}/{x}/{y}.png` (J§22, B-23).
  - It's an `<img>`, only on a finished walk's summary or a saved walk's detail, only for a kept route, only while this phone's map pictures are on and the phone is online, and only for the tiles of the current view.
  - It's never made during a live walk, never prefetched, and never cached or precached by the service worker.
  - It keeps ordinary browser HTTP caching and the page's Referer, so there's never `referrerpolicy="no-referrer"` on a tile.
  - The CSP adds exactly `https://tile.openstreetmap.org` to `img-src`, and nothing else.
- **Attribution:** every map shows a visible link, "© OpenStreetMap contributors", to `https://www.openstreetmap.org/copyright`, from the first tile on. It's never behind a toggle.
- **No new dependency.** There's no map library, no WebGL while tracking (D18), and the live drawing redraws at most once a second (K-08).
- **Safety:** the engine alone decides.
  - The final Start asks the gate again after the motion and audio outcomes arrive (B-01, J§4.1).
  - A stored, journalled or recovered walk is never permission to move.
- **B-01, in this order:**
  1. In the tap's own handler, request motion permission and unlock audio, synchronously.
  2. Wait for those outcomes.
  3. Run the final gate.
  4. Start once, with Pause and Stop already usable.

  Pending audio is cancelled on pause, stop, exit, an interruption (a call or headphones) and a stale cue generation.
- **Voice:** only recorded Kokoro lines are spoken. Cues come at 10, 20, 30, 45 and 60 minutes of recorded time, with no composed numbers (A-72). After adding lines, run the catalogue and render the packs; `src/voice/packs.node.test.ts` must pass.
- **Routes** are stored only after this phone's "Yes". They are:
  - never written to `sessionStorage`;
  - in a backup only when the person includes them (J§18.3);
  - erased by B-05's "Erase all routes" from routes, walk journals, in-memory buffers and deletion payloads.
- **Imports** never switch map pictures or route keeping on (B-26). This device's own consent is kept, and a new device asks.
- **Energy:** active kcal = (MET − 1) × kg × hours (J§12.4). It's rounded to the nearest 10, labelled "about", and shown on summaries and details only, never live.
  - Ages 19–59 use the 2024 Adult Compendium.
  - 60 and over get a figure only after Task 6 confirms the Older Adult Compendium values. Until then there's no figure (B-18).
- **Copy:**
  - The B-24 strings are used exactly.
  - Indian English and sentence case; verbs on buttons; a unit on every number.
  - The exact strings are given in each task.
- **Labels and size** (Plan 1's constraints still hold):
  - every control has a visible text label;
  - tappable things are at least 44×44 px, and primary buttons at least 56 px tall (`PrimaryButton` is `min-h-14`);
  - body text is 17 px, and text up to 200% must work.
- **Reduce Motion** (system setting or in-app):
  - the live view stays fixed, with a manual "Show whole route" (B-29);
  - the live view never pans or zooms with animation (M13);
  - map tiles appear without fading (M14).
- **Tests:**
  - Vitest runs in the node environment.
  - A test that imports `node:fs` must be named `*.node.test.ts`.
  - Components are driven through `@/test/host` only where a task says so. Everything else on screen is proven by the acceptance suite.
- **Gates before every commit:** `npx tsc -b`, `npm run lint` and `npx vitest run` must all pass.
- **Repo text** (code, comments, fixtures, docs) describes synthetic personas only, never a real person's health.

## Review Focus

These are failure modes the spec implies that no single task's tests would naturally exercise. Each has a test added to the task that owns its code.

1. **A v1 phone's first v2 launch.** Schema 5, with v1's v4 blob still in `localStorage` (it's never deleted, by design), must only be stamped 6. If the v4 → v5 move ran again, it would replace the settings with the old blob's. Task 1 tests this with the blob present.
2. **Home offering to save a walk that is still being recorded.** It must not offer to save a walk another tab is recording, or one this tab still holds in its draft. Two taps on Save must write the walk once. Task 13 tests all three.
3. **A borderline birth year, or none.** A birth year that makes the person 59-or-60, or 18-or-19, this year must give no energy figure, with its reason, never the adult figure by default (B-31 with B-18). So must a missing birth year. Task 5 tests each.
4. **A backup's routes against this phone's consent.**
   - A file's routes are never added to a phone that said "No" to keeping routes.
   - Replacing from a file without routes says, before anything happens, that this phone's routes will go.

   Task 1 tests the store rules, and Task 14 tests the words the restore preview shows.
5. **A refused final Start keeps the consents.** When the gate changes while the person answers (V-J19), the answers already given are kept, and the next Start goes straight to the gate. Task 8 tests this.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/store/records.ts` (new) | The v2 record stores: names, keys, limits, validators, backup and import rules |
| `src/store/records.test.ts` (new) | The rules, and `prepare` for records and the journal |
| `src/walk/routeRecord.ts` (new) | The `routes` store's record: `RouteLine`, `RouteRecord`, its validator and box |
| `src/store/db.ts` (modify) | IndexedDB 2: every v2 store and `walkJournal`; `Rows.records` |
| `src/store/snapshot.ts` (modify) | `Snapshot.records`, `Change.records`, `Change.journal`, deletion records per store |
| `src/store/migrate.ts` (modify) | Schema 6; the v4 move's own done-marker; `migrateToV6` |
| `src/store/importCheck.ts` (modify) | Read `walk` and `deleted.records` from a file field by field |
| `src/store/transfer.ts` (modify) | Backups list their stores; routes are opt-in; validation, limits, merge, replace, preview; B-26 |
| `src/store/useStore.ts` (modify) | `records` in the state; record actions; the journal; `saveWalk`, `removeWalk`, `eraseRoutes` |
| `src/types/index.ts` (modify) | `UserSettings.walk`, `UserSettings.deleted.records` |
| `src/walk/gps.ts` (modify) | Route points at each counted move, and a new line at every break (B-17) |
| `src/walk/route.ts` (new) | Web Mercator view, fit, live stepping, paths, grid, splits |
| `src/walk/time.ts` (new) | `offsetAt`, `isoAt`, `nextMidnightAt` |
| `src/walk/clock.ts` (modify) | Accrued time, day and offset per segment; the clock-change split (B-19) |
| `src/walk/record.ts` (modify) | Records from accrued time, at each segment's own offset; energy on the walk record |
| `src/walk/persist.ts` (modify) | Validate and upgrade the new walk fields |
| `src/walk/gate.ts` (modify) | Untimed readings after a clock change; the store's start permission |
| `src/walk/journal.ts` (new) | Journal entries, checkpoints, staleness |
| `src/walk/journalPort.ts` (new) | The browser's journal port and its in-page cache |
| `src/walk/live.ts` (modify) | Monotonic accrual, route lines, checkpoints, `forgetRoute` |
| `src/walk/browser.ts` (modify) | The real ports: monotonic clock, `mayRun` with the clock change, the journal; every tab forgets its route on an erase |
| `src/walk/save.ts` (new) | What saving a walk writes |
| `src/walk/energy.ts` (new) | Compendium bands, age bands, the weight at the time, the estimate |
| `src/health/observation.ts`, `src/screens/track/format.ts` (modify) | The `activeEnergy` kind |
| `src/walk/start.ts` (new) | The B-01 starter |
| `src/walk/plan.ts` (modify) | The new plan fields, carried in the live walk's address; B-09's walks marked "had at" (`setupPlan`, `directWalkHref`) |
| `src/walk/consent.ts` (new) | Preflight pages and the consent copy |
| `src/screens/walk/PreflightSheet.tsx`, `useWalkFlow.tsx`, `walkStart.callers.test.ts` (new) | The first-walk questions and the start flow, proven through `useStartMovement` |
| `src/components/checkin/useStartMovement.tsx` (modify) | The walk path: questions and B-01 for every start to `/walk/live` |
| `src/screens/hub/WalkHub.tsx` (modify, Plan 2's) | B-09's walk marked "had at"; the route note; no early motion request; the Routes and Map pictures rows |
| `src/screens/home/tileLine.ts` (modify) | `holdHeadline`, shared with the preflight's refusal |
| `src/walk/cues.ts`, `src/walk/voice.ts` (new) | Cue minutes and lines; the cue player |
| `scripts/voice/catalog.ts`, `scripts/voice/lines.json`, `public/voice/*` (modify) | The cue lines in the catalogue, rendered in every pack |
| `src/voice/packs.node.test.ts` (modify) | Every cue recorded in every pack |
| `src/screens/walk/RouteView.tsx`, `useWalkCues.ts` (new) | The SVG route drawing and the live view; the cues on the live walk |
| `src/screens/walk/LiveWalkScreen.tsx` (modify) | The v2 live walk |
| `src/walk/readout.ts` (modify) | Live and summary words |
| `src/walk/tiles.ts` (new) | Viewport tiles, their URLs, attribution |
| `src/walk/tilePolicy.node.test.ts` (new) | The CSP and the service worker's policy for tiles |
| `src/screens/walk/StaticMap.tsx`, `RouteFrame.tsx`, `RouteThumb.tsx`, `useWalkRoute.ts` (new) | Map pictures, the summary and detail frame, history thumbnails |
| `vite.config.ts` (modify) | CSP `img-src` |
| `src/screens/walk/WalkSummary.tsx` (modify) | The v2 summary |
| `src/screens/track/RecordDetails.tsx`, `timeline.ts`, `MyDay.tsx` (modify) | The v2 walk detail; thumbnails and the after-meal tag in Today's log |
| `src/walk/recovery.ts`, `src/screens/home/WalkRecoveryRow.tsx`, `recovery.callers.test.ts` (new) | Interrupted walks on Home |
| `src/screens/home/HomeScreen.tsx` (modify) | The recovery row under Right now; Home's direct walk without an early motion request |
| `src/screens/you/DataScreen.tsx`, `DataSheets.tsx`, `RestoreFlow.tsx`, `summaries.ts` (modify) | Plan 4's "Walks and maps" group filled in, erasing routes, backups with routes, the restore preview, B-24's full privacy line |
| `scripts/e2e/acceptance/lib/inpage.mjs`, `lib/walk.mjs`, `run.mjs` (modify) | Motion, audio and tap emulation; consent answers; walking time; the `v` journeys |
| `scripts/e2e/acceptance/journeys/j10.mjs`, `j11.mjs` (modify); `v02.mjs`, `v16.mjs`, `v19.mjs`, `v20.mjs`, `v33.mjs`, `v34.mjs` (new) | Acceptance |
| `docs/reimagine/BOARD.md` (modify) | Decisions, the Compendium record, device-only checks |

---

### Task 1: Storage foundation (IndexedDB 2, schema 6, every v2 store)

This is the foundation Plan 7 builds on.

**Files:**
- Create: `src/walk/routeRecord.ts`, `src/walk/routeRecord.test.ts`
- Create: `src/store/records.ts`, `src/store/records.test.ts`
- Modify: `src/types/index.ts` (`UserSettings.walk`, `UserSettings.deleted.records`)
- Modify: `src/store/db.ts`, `src/store/db.test.ts`
- Modify: `src/store/snapshot.ts`
- Modify: `src/store/migrate.ts`, `src/store/migrate.test.ts`
- Modify: `src/store/importCheck.ts`
- Modify: `src/store/transfer.ts`, `src/store/transfer.test.ts`, `src/store/merge.test.ts:749`
- Modify: `src/store/useStore.ts`, `src/store/useStore.test.ts`
- Modify: `src/screens/you/DataSheets.tsx:60-63` (the backup's `version` list)

**Interfaces:**

These are the generic API, named exactly. Plan 7 uses these names.

- **`src/store/records.ts`:**
  - `RECORD_STORES = ['routes', 'meals', 'savedMeals', 'customFoods'] as const`;
  - `type RecordStore = (typeof RECORD_STORES)[number]`;
  - `type StoredRecord = Record<string, unknown>`;
  - `type Records = Record<RecordStore, StoredRecord[]>`;
  - `interface RecordRule`:
    - `keyPath: 'id' | 'walkId'`;
    - `label: { one: string; many: string }`;
    - `limit: number` (the most a file may hold);
    - `backup: 'always' | 'optIn'`;
    - `problem(record: StoredRecord): string | undefined`;
    - `newer?(here: StoredRecord, file: StoredRecord): number`: >0 takes the file's copy, <0 keeps this device's, 0 is a conflict;
    - `accepts?(device: UserSettings | undefined): boolean`: whether this device takes the store's records from a file at all;
  - `RECORD_RULES: Record<RecordStore, RecordRule>`;
  - `DEFAULT_BACKUP_STORES: readonly RecordStore[]`;
  - `isRecordStore(x: unknown): x is RecordStore`;
  - `emptyRecords(): Records`;
  - `recordKey(store: RecordStore, record: StoredRecord): string`;
  - `recordProblem(store: RecordStore, record: unknown): string | undefined`;
  - `sortRecords(store: RecordStore, list: readonly StoredRecord[]): StoredRecord[]`.
- **`src/store/db.ts`:**
  - `DB_VERSION = 2`;
  - `CORE_STORES = ['observations', 'sessions', 'settings', 'content-state'] as const`;
  - `JOURNAL_STORE = 'walkJournal'`;
  - `STORE_NAMES` = core + record stores + journal;
  - `Rows.records: Record<RecordStore, unknown[]>`. The journal is never in `Rows`;
  - the new stores have **no indexes**: the store reads every row into its snapshot, and adding an index later would need IndexedDB version 3.
- **`src/store/snapshot.ts`:**
  - `Snapshot.records: Records`;
  - `Change.records?: Partial<Record<RecordStore, { put?: StoredRecord[]; remove?: string[] }>>`;
  - `Change.journal?: { put?: { id: string }[]; remove?: string[] }`;
  - a removed key is remembered in `settings.deleted.records[store]`, and forgotten when it's written again;
  - `reset` clears every store, the journal included.
- **`src/store/migrate.ts`:**
  - `SCHEMA_VERSION = 6`;
  - `V5_SCHEMA = 5`;
  - `migrateToV6(db: Db): Promise<StoreResult<{ from: number; alreadyDone: boolean }>>`.
- **`src/store/transfer.ts`:**
  - `TransferDoc.stores?: RecordStore[]`;
  - `TransferDoc.records?: Partial<Record<RecordStore, StoredRecord[]>>`;
  - `interface ExportOptions { include?: readonly RecordStore[] }`;
  - `toTransferDoc(snapshot, exportedAt?, options?: ExportOptions)`;
  - `collect(db, options?: ExportOptions)`;
  - `CollectionCounts` and `IMPORT_LIMITS` gain one key per record store;
  - `ImportPreview.records?: Partial<Record<RecordStore, number>>`, `refusedStores?: RecordStore[]` and `replaceRemoves?: Partial<Record<RecordStore, number>>`;
  - `ImportReport.records?: Partial<Record<RecordStore, number>>`;
  - `withDeviceConsent(file: UserSettings | undefined, device: UserSettings | undefined): UserSettings | undefined`.
- **`src/store/useStore.ts`:**
  - `StoreState.records: Readonly<Records>`;
  - `putRecords(store: RecordStore, records: readonly StoredRecord[]): Promise<StoreResult>`;
  - `removeRecords(store: RecordStore, keys: readonly string[]): Promise<StoreResult>`;
  - `exportRecord(options?: ExportOptions)`;
  - `ExportedRecord.stores: RecordStore[]`.
- **`src/types/index.ts`:**
  - `UserSettings.walk?: { saveRoutes: boolean | 'unasked'; map: 'on' | 'off' | 'unasked'; stepCardSeen?: boolean }`;
  - `UserSettings.deleted.records?: Partial<Record<RecordStore, string[]>>`.
- **`src/walk/routeRecord.ts`:**
  - `type LatLon = [number, number]`;
  - `interface RouteLine { start: number; end: number; coords: LatLon[]; ms: number[] }`;
  - `type Bbox = [number, number, number, number]`;
  - `interface RouteRecord { walkId: string; version: 1; startedAt: string; segments: RouteLine[]; bbox: Bbox }`;
  - `ROUTE_LIMITS = { lines: 1000, points: 20000 }`;
  - `roundCoord(d: number): number`;
  - `bboxOf(lines): Bbox | undefined`;
  - `capLines(lines, limit?): RouteLine[]`;
  - `lineProblem(x: unknown): string | undefined`;
  - `routeProblem(r: StoredRecord): string | undefined`;
  - `routeRecord(walkId: string, startedAt: string, lines: readonly RouteLine[]): RouteRecord | undefined`.

**For Plan 7:**
- Replace the three food rules in `RECORD_RULES` (`problem`, `label`, `limit`, `newer`). Nothing else in the store changes.
- Write linked records in one `Change`: a meal and its edits go in `records: { meals: { put } }` alongside any `observations`.
- Food stores are `backup: 'always'`.
- Deletion records, merges, replace, limits and preview counts follow automatically.

- [ ] **Step 1: Write the failing test** `src/walk/routeRecord.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { bboxOf, capLines, routeProblem, routeRecord, ROUTE_LIMITS, type LatLon, type RouteLine } from './routeRecord';

const line = (start: number, pts: LatLon[], stepMs = 10_000): RouteLine => ({
  start, end: start + (pts.length - 1) * stepMs, coords: pts, ms: pts.map((_, i) => i * stepMs),
});
const A = line(1_760_000_000_000, [[12.97, 77.59], [12.9705, 77.5902], [12.971, 77.5905]]);
const B = line(1_760_000_300_000, [[12.98, 77.6], [12.9801, 77.6003]]);
const AT = '2026-10-08T09:00:00.000+05:30';
const ID = 'k8f0a1-abc12345';

describe('a route record (journey §18.2, B-17)', () => {
  it('keeps the lines with two points or more, with their box', () => {
    const r = routeRecord(ID, AT, [A, B, line(1_760_000_600_000, [[1, 1]])])!;
    expect(r.segments).toHaveLength(2);
    expect(r.bbox).toEqual([12.97, 77.59, 12.98, 77.6003]);
    expect(routeProblem(r as unknown as Record<string, unknown>)).toBeUndefined();
  });

  it('is nothing when no line has two points', () => {
    expect(routeRecord(ID, AT, [line(1, [[1, 1]])])).toBeUndefined();
  });

  it('refuses anything a walk could not have recorded', () => {
    const good = routeRecord(ID, AT, [A])! as unknown as Record<string, unknown>;
    const bad = (patch: Record<string, unknown>) => routeProblem({ ...good, ...patch });
    expect(bad({ walkId: 'no spaces allowed' })).toMatch(/walk/);
    expect(bad({ version: 2 })).toMatch(/version/);
    expect(bad({ startedAt: '2026-10-08 09:00' })).toMatch(/startedAt/);
    expect(bad({ segments: [{ ...A, coords: [[91, 0], [0, 0], [0, 0]] }] })).toMatch(/coordinate/);
    expect(bad({ segments: [{ ...A, ms: [0, 20_000, 10_000] }] })).toMatch(/time/);
    expect(bad({ segments: [{ ...A, ms: [0, 10_000] }] })).toMatch(/time/);
    expect(bad({ bbox: [0, 0, 1, 1] })).toMatch(/box/);
  });

  it('refuses more points than one walk could hold', () => {
    const many = line(0, Array.from({ length: ROUTE_LIMITS.points + 1 }, (_, i): LatLon => [12 + i * 1e-6, 77]), 1000);
    const r = { walkId: ID, version: 1, startedAt: AT, segments: [many], bbox: bboxOf([many]) };
    expect(routeProblem(r)).toMatch(/points/);
  });

  it('keeps the earliest points when a walk runs past the limit', () => {
    const capped = capLines([A, B], 4);
    expect(capped.map(l => l.coords.length)).toEqual([3]);
    expect(capLines([A, B], 5).map(l => l.coords.length)).toEqual([3, 2]);
    expect(capLines([A], 2)[0]).toMatchObject({ coords: A.coords.slice(0, 2), ms: [0, 10_000], end: A.start + 10_000 });
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/walk/routeRecord.test.ts`
Expected: FAIL, "Cannot find module './routeRecord'".

- [ ] **Step 3: Write the module** `src/walk/routeRecord.ts`

```ts
/**
 * A walk's route as the `routes` store keeps it (journey §18.2, B-17).
 *
 * One line per unbroken stretch of counted GPS movement, never joined across
 * a gap: a dropout, a screen lock or a jump no walker could make each starts
 * a new line, so the drawing never invents a path. Every point keeps its
 * time, so splits read distance and time off the same intervals. Kept only
 * when the person said yes to keeping routes on this phone (§9.1).
 */
import { isAt } from '@/health/observation';
import { isWalkId } from './plan';

/** [latitude, longitude] in degrees, kept to 6 decimal places (about 0.1 m). */
export type LatLon = [number, number];

export interface RouteLine {
  /** Epoch ms of the first point and of the last. */
  start: number;
  end: number;
  coords: LatLon[];
  /** For each point, ms after `start`: 0 first, never decreasing, `end - start` last. */
  ms: number[];
}

/** [south, west, north, east], in degrees. */
export type Bbox = [number, number, number, number];

export interface RouteRecord {
  walkId: string;
  version: 1;
  /** The walk's first observed moment, ISO with its offset. */
  startedAt: string;
  segments: RouteLine[];
  bbox: Bbox;
}

/** The most one route holds: about 100 km of walking at a point every 5 m. */
export const ROUTE_LIMITS = { lines: 1_000, points: 20_000 } as const;

const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** A coordinate as the store keeps it. */
export const roundCoord = (d: number): number => Math.round(d * 1e6) / 1e6;

/** The box around every point, or nothing when there are none. */
export function bboxOf(lines: readonly RouteLine[]): Bbox | undefined {
  let s = Infinity, w = Infinity, n = -Infinity, e = -Infinity;
  for (const line of lines) {
    for (const [lat, lon] of line.coords) {
      s = Math.min(s, lat); n = Math.max(n, lat);
      w = Math.min(w, lon); e = Math.max(e, lon);
    }
  }
  return Number.isFinite(s) ? [s, w, n, e] : undefined;
}

/**
 * At most `limit` points in all, the earliest kept: a walk longer than the
 * limit keeps its first 100 km. Lines left with fewer than two points go.
 */
export function capLines(lines: readonly RouteLine[], limit: number = ROUTE_LIMITS.points): RouteLine[] {
  const out: RouteLine[] = [];
  let left = limit;
  for (const l of lines) {
    if (left < 2 || out.length >= ROUTE_LIMITS.lines) break;
    if (l.coords.length <= left) {
      out.push(l);
      left -= l.coords.length;
      continue;
    }
    out.push({ start: l.start, end: l.start + l.ms[left - 1], coords: l.coords.slice(0, left), ms: l.ms.slice(0, left) });
    break;
  }
  return out.filter(l => l.coords.length >= 2);
}

/** Why one line is not one a walk could have recorded, or nothing. */
export function lineProblem(x: unknown): string | undefined {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return 'a route line is not an object';
  const l = x as Record<string, unknown>;
  if (!finite(l.start) || !finite(l.end) || l.start < 0 || l.end < l.start) return 'a route line has impossible times';
  if (!Array.isArray(l.coords) || !Array.isArray(l.ms) || l.coords.length !== l.ms.length || l.coords.length < 2) {
    return 'a route line needs at least two timed points';
  }
  for (const p of l.coords) {
    if (!Array.isArray(p) || p.length !== 2 || !finite(p[0]) || !finite(p[1]) || Math.abs(p[0]) > 90 || Math.abs(p[1]) > 180) {
      return 'a route point has an impossible coordinate';
    }
  }
  let last = 0;
  for (const [i, t] of l.ms.entries()) {
    if (!finite(t) || (i === 0 ? t !== 0 : t < last)) return 'a route line has points out of time order';
    last = t;
  }
  if (last !== l.end - l.start) return 'a route line’s times do not match its span';
  return undefined;
}

/** Why a stored or imported route cannot be read, or nothing (journey §18.3). */
export function routeProblem(r: Record<string, unknown>): string | undefined {
  if (!isWalkId(r.walkId)) return 'a route needs the walk it belongs to';
  if (r.version !== 1) return 'a route of an unknown version';
  if (!isAt(r.startedAt)) return 'a route needs its startedAt, ISO with an offset';
  if (!Array.isArray(r.segments) || r.segments.length === 0 || r.segments.length > ROUTE_LIMITS.lines) {
    return `a route needs between 1 and ${ROUTE_LIMITS.lines} lines`;
  }
  let points = 0;
  for (const line of r.segments) {
    const problem = lineProblem(line);
    if (problem) return problem;
    points += (line as RouteLine).coords.length;
  }
  if (points > ROUTE_LIMITS.points) return `a route holds more than ${ROUTE_LIMITS.points} points`;
  const box = bboxOf(r.segments as RouteLine[])!;
  if (!Array.isArray(r.bbox) || r.bbox.length !== 4 || r.bbox.some((v, i) => !finite(v) || Math.abs(v - box[i]) > 1e-9)) {
    return 'a route’s box does not match its points';
  }
  return undefined;
}

/** The route kept for a walk: its lines of two points or more, within the limits. Nothing when none is left. */
export function routeRecord(walkId: string, startedAt: string, lines: readonly RouteLine[]): RouteRecord | undefined {
  const segments = capLines(lines);
  const bbox = bboxOf(segments);
  return bbox ? { walkId, version: 1, startedAt, segments, bbox } : undefined;
}
```

- [ ] **Step 4: Run it**

Run: `npx vitest run src/walk/routeRecord.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: The settings types.** In `src/types/index.ts`:
  - add `import type { RecordStore } from '@/store/records';` at the top. It's a type-only import, so the cycle with `records.ts` is harmless;
  - add `walk` inside `UserSettings`, after `display`;
  - add `records` inside `deleted`, after `readings`.

```ts
  /**
   * v2 (journey §9.1, §18.1): this phone's own walk choices. Each starts
   * unasked and is asked once, on the first walk that needs it. An import
   * never switches either on (B-26).
   */
  walk?: {
    /** "Keep a record of your route on this phone?" */
    saveRoutes: boolean | 'unasked';
    /** "Show map pictures under your saved routes?" */
    map: 'on' | 'off' | 'unasked';
    /** The one-time card on how steps are counted has been shown (K-29, B-24). */
    stepCardSeen?: boolean;
  };
```

```ts
    /** The v2 record stores' deleted keys, by store (Plan 6 Task 1), kept for the same reason. */
    records?: Partial<Record<RecordStore, string[]>>;
```

- [ ] **Step 6: Write the failing test** `src/store/records.test.ts`. The `prepare` cases fail until Step 10.

```ts
import { describe, expect, it } from 'vitest';
import type { UserSettings } from '@/types';
import { routeRecord, type RouteLine } from '@/walk/routeRecord';
import { DEFAULT_BACKUP_STORES, RECORD_RULES, RECORD_STORES, emptyRecords, recordKey, recordProblem, type StoredRecord } from './records';
import { emptySnapshot, prepare } from './snapshot';

const LINE: RouteLine = { start: 1_760_000_000_000, end: 1_760_000_020_000, coords: [[12.97, 77.59], [12.9705, 77.5902], [12.971, 77.5905]], ms: [0, 10_000, 20_000] };
const route = (walkId: string): StoredRecord => routeRecord(walkId, '2026-10-08T09:00:00.000+05:30', [LINE])! as unknown as StoredRecord;
const settings = (walk: UserSettings['walk']) => ({ walk }) as UserSettings;

describe('the v2 record stores', () => {
  it('are the four the journey names, each with a key, a limit and a backup rule', () => {
    expect([...RECORD_STORES]).toEqual(['routes', 'meals', 'savedMeals', 'customFoods']);
    expect(RECORD_RULES.routes).toMatchObject({ keyPath: 'walkId', backup: 'optIn' });
    for (const s of ['meals', 'savedMeals', 'customFoods'] as const) expect(RECORD_RULES[s]).toMatchObject({ keyPath: 'id', backup: 'always' });
    expect(DEFAULT_BACKUP_STORES).toEqual(['meals', 'savedMeals', 'customFoods']);
  });

  it('read a route by its walk, and refuse a record with no key', () => {
    expect(recordKey('routes', route('walk-aaaa'))).toBe('walk-aaaa');
    expect(recordProblem('routes', { version: 1 })).toMatch(/walkId/);
    expect(recordProblem('routes', 'a string')).toMatch(/object/);
    expect(recordProblem('routes', route('walk-aaaa'))).toBeUndefined();
  });

  it('refuse food records until Plan 7 gives them their rules', () => {
    expect(recordProblem('meals', { id: 'm1' })).toMatch(/cannot read meals yet/);
  });

  it('take a file’s routes only onto a phone that has not said No (Review Focus 4)', () => {
    const accepts = RECORD_RULES.routes.accepts!;
    expect(accepts(undefined)).toBe(true);
    expect(accepts(settings({ saveRoutes: 'unasked', map: 'unasked' }))).toBe(true);
    expect(accepts(settings({ saveRoutes: true, map: 'off' }))).toBe(true);
    expect(accepts(settings({ saveRoutes: false, map: 'off' }))).toBe(false);
  });
});

describe('prepare, for records and the journal', () => {
  it('puts, replaces by key and removes, keeping each store in key order', () => {
    let s = prepare(emptySnapshot(), { records: { routes: { put: [route('walk-bbbb'), route('walk-aaaa')] } } }).next;
    expect(s.records.routes.map(r => r.walkId)).toEqual(['walk-aaaa', 'walk-bbbb']);
    s = prepare(s, { records: { routes: { remove: ['walk-aaaa'] } } }).next;
    expect(s.records.routes.map(r => r.walkId)).toEqual(['walk-bbbb']);
  });

  it('remembers a removed key as deleted, and forgets it when the key is written again (D-06)', () => {
    let s = prepare(emptySnapshot(), { records: { routes: { put: [route('walk-aaaa')] } } }).next;
    s = prepare(s, { records: { routes: { remove: ['walk-aaaa'] } } }).next;
    expect(s.settings?.deleted?.records?.routes).toEqual(['walk-aaaa']);
    s = prepare(s, { records: { routes: { put: [route('walk-aaaa')] } } }).next;
    expect(s.settings?.deleted).toBeUndefined();
  });

  it('writes exactly the rows it changed, the journal included, in one change', () => {
    const { writes } = prepare(emptySnapshot(), {
      records: { routes: { put: [route('walk-aaaa')] } },
      journal: { remove: ['walk-aaaa'] },
    });
    expect(writes.filter(w => w.store === 'routes').map(w => w.op)).toEqual(['put']);
    expect(writes).toContainEqual({ op: 'delete', store: 'walkJournal', key: 'walk-aaaa' });
  });

  it('keeps the records the same object when a change does not touch them', () => {
    const base = prepare(emptySnapshot(), { records: { routes: { put: [route('walk-aaaa')] } } }).next;
    expect(prepare(base, { content: { put: { a: 1 } } }).next.records).toBe(base.records);
  });

  it('clears every store, the journal too, on a reset', () => {
    const { writes } = prepare(emptySnapshot(), { reset: true });
    for (const store of ['observations', 'sessions', 'settings', 'content-state', ...RECORD_STORES, 'walkJournal']) {
      expect(writes).toContainEqual({ op: 'clear', store });
    }
  });

  it('starts empty', () => {
    expect(emptySnapshot().records).toEqual(emptyRecords());
  });
});
```

- [ ] **Step 7: Run it to check it fails**

Run: `npx vitest run src/store/records.test.ts`
Expected: FAIL, "Cannot find module './records'".

- [ ] **Step 8: Write the registry** `src/store/records.ts`

```ts
/**
 * The v2 record stores (journey §18.2–18.3): one registry, so the snapshot,
 * the deletion records (D-06), backups, merges and import validation treat a
 * route and a meal the same way. Each store's own rule says how its records
 * are keyed, read, merged and backed up. Plan 7 fills in the food stores'
 * rules; nothing else in the store changes for them.
 */
import type { UserSettings } from '@/types';
import { routeProblem } from '@/walk/routeRecord';

export const RECORD_STORES = ['routes', 'meals', 'savedMeals', 'customFoods'] as const;
export type RecordStore = (typeof RECORD_STORES)[number];

/** A stored v2 record: a plain object, keyed by its store's key path. */
export type StoredRecord = Record<string, unknown>;
export type Records = Record<RecordStore, StoredRecord[]>;

export interface RecordRule {
  /** The IndexedDB key path, and the field that names a record in merges and deletion records. */
  keyPath: 'id' | 'walkId';
  /** For counts and refusals: "1 walk route", "12 walk routes". */
  label: { one: string; many: string };
  /** The most a backup file may hold, checked before anything in it is read. */
  limit: number;
  /** In every backup, or only when the person includes it (routes, §18.3). */
  backup: 'always' | 'optIn';
  /** Why a record from a file or the store can't be read; nothing when it can. Runs after the key check. */
  problem(record: StoredRecord): string | undefined;
  /** Two different copies of one record: >0 takes the file's, <0 keeps this device's, 0 is a conflict. Absent: always a conflict. */
  newer?(here: StoredRecord, file: StoredRecord): number;
  /** Whether this device takes the store's records from a file at all. Absent: always. */
  accepts?(device: UserSettings | undefined): boolean;
}

const notYet = (what: string) => (): string => `This version of the app cannot read ${what} yet.`;

export const RECORD_RULES: Record<RecordStore, RecordRule> = {
  routes: {
    keyPath: 'walkId',
    label: { one: 'walk route', many: 'walk routes' },
    limit: 100_000,
    backup: 'optIn',
    problem: routeProblem,
    // Saved routes never change; two different copies are a conflict, and this phone's is kept.
    // A phone whose person said No to keeping routes never takes them from a file (§9.1, Review Focus 4).
    accepts: device => device?.walk?.saveRoutes !== false,
  },
  // Plan 7 replaces these three with its record types and rules.
  meals: { keyPath: 'id', label: { one: 'meal', many: 'meals' }, limit: 200_000, backup: 'always', problem: notYet('meals') },
  savedMeals: { keyPath: 'id', label: { one: 'saved meal', many: 'saved meals' }, limit: 10_000, backup: 'always', problem: notYet('saved meals') },
  customFoods: { keyPath: 'id', label: { one: 'custom food', many: 'custom foods' }, limit: 10_000, backup: 'always', problem: notYet('custom foods') },
};

/** The stores a backup holds unless the person chooses otherwise. */
export const DEFAULT_BACKUP_STORES: readonly RecordStore[] = RECORD_STORES.filter(s => RECORD_RULES[s].backup === 'always');

export const isRecordStore = (x: unknown): x is RecordStore => typeof x === 'string' && (RECORD_STORES as readonly string[]).includes(x);

export function emptyRecords(): Records {
  return { routes: [], meals: [], savedMeals: [], customFoods: [] };
}

/** A record's key in its store; empty when it has none. */
export function recordKey(store: RecordStore, record: StoredRecord): string {
  const key = record[RECORD_RULES[store].keyPath];
  return typeof key === 'string' ? key : '';
}

/** Why a record can't be kept in its store, or nothing. */
export function recordProblem(store: RecordStore, record: unknown): string | undefined {
  if (typeof record !== 'object' || record === null || Array.isArray(record)) return 'A record must be an object.';
  const rule = RECORD_RULES[store];
  const key = (record as StoredRecord)[rule.keyPath];
  if (typeof key !== 'string' || key === '') return `A ${rule.label.one} needs its ${rule.keyPath}.`;
  return rule.problem(record as StoredRecord);
}

/** By key, so a store's order never depends on when a row was written. */
export function sortRecords(store: RecordStore, list: readonly StoredRecord[]): StoredRecord[] {
  return [...list].sort((a, b) => {
    const x = recordKey(store, a);
    const y = recordKey(store, b);
    return x < y ? -1 : x > y ? 1 : 0;
  });
}
```

Run: `npx vitest run src/store/records.test.ts -t "the v2 record stores"`
Expected: PASS (4 tests). The `prepare` group still fails.

- [ ] **Step 9: IndexedDB 2.** In `src/store/db.ts`:
  - add `import { RECORD_RULES, RECORD_STORES, type RecordStore } from './records';`;
  - replace `DB_VERSION` and `STORE_NAMES`;
  - make `upgrade` create the new stores;
  - add `records` to `Rows`;
  - make `readAll` read the record stores.

```ts
export const DB_VERSION = 2;

/** v1's four stores. */
export const CORE_STORES = ['observations', 'sessions', 'settings', 'content-state'] as const;
/**
 * A walk's recovery state while it is recorded (Plan 6): retired in the
 * transaction that saves the walk, never part of the record or a backup.
 */
export const JOURNAL_STORE = 'walkJournal';
export const STORE_NAMES = [...CORE_STORES, ...RECORD_STORES, JOURNAL_STORE] as const;
```

```ts
export interface Rows {
  observations: unknown[];
  sessions: unknown[];
  /** `{ key, value }` documents, including `schemaVersion` and `revision`. */
  settings: unknown[];
  content: unknown[];
  /** The v2 record stores (Plan 6 Task 1). Never the journal: it is not the record. */
  records: Record<RecordStore, unknown[]>;
}
```

At the end of `upgrade`:

```ts
  // IndexedDB 2 (journey §18.3): every v2 store at once, additive, and no indexes.
  // The store reads every row into its snapshot; an index added later would need version 3.
  for (const store of RECORD_STORES) {
    if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: RECORD_RULES[store].keyPath });
  }
  if (!db.objectStoreNames.contains(JOURNAL_STORE)) db.createObjectStore(JOURNAL_STORE, { keyPath: 'id' });
```

In `readAll`:
  - open the transaction over `[...CORE_STORES, ...RECORD_STORES]` instead of `STORE_NAMES`;
  - create `const records = {} as Record<RecordStore, unknown[]>`;
  - for each record store, add `const req = tx.objectStore(store).getAll(); req.onsuccess = () => { records[store] = req.result; };`;
  - resolve with `{ ...(rows as Omit<Rows, 'records'>), records }`.

`transact` keeps `STORE_NAMES`, so one transaction can retire the journal with a save.

- [ ] **Step 10: The snapshot.** In `src/store/snapshot.ts`:
  - import `CORE_STORES`, `JOURNAL_STORE` and `STORE_NAMES` from `./db`;
  - import `RECORD_STORES`, `emptyRecords`, `recordKey`, `sortRecords`, `type RecordStore`, `type Records` and `type StoredRecord` from `./records`;
  - make the edits below. `CORE_STORES` is used by `readAllIn`.

  - `Snapshot` gains `/** The v2 record stores, each in key order. */ records: Records;`, and `emptySnapshot()` returns `records: emptyRecords()`.
  - `Change` gains:

```ts
  /** v2 records, store by store: the last put of a key wins, and a removal is remembered (D-06). */
  records?: Partial<Record<RecordStore, { put?: StoredRecord[]; remove?: string[] }>>;
  /** Walk recovery state (`walkJournal`): written in the same transaction, never part of the snapshot. */
  journal?: { put?: { id: string }[]; remove?: string[] };
```

  - Replace `type Ids` and `withDeleted` with:

```ts
type Ids = {
  observations: readonly string[];
  sessions: readonly string[];
  readings: readonly string[];
  records: Partial<Record<RecordStore, readonly string[]>>;
};

function withDeleted(settings: UserSettings | undefined, gone: Ids, written: Ids): UserSettings | undefined {
  const was = settings?.deleted;
  const recordsGone = RECORD_STORES.some(s => (gone.records[s]?.length ?? 0) > 0);
  if (!was && gone.observations.length === 0 && gone.sessions.length === 0 && gone.readings.length === 0 && !recordsGone) return settings;
  const step = (list: readonly string[] | undefined, add: readonly string[], back: readonly string[]) => {
    const out = new Set(list);
    for (const id of back) out.delete(id);
    for (const id of add) out.add(id);
    return out.size > 0 ? [...out] : undefined;
  };
  const same = (a: readonly string[] | undefined, b: readonly string[] | undefined) =>
    (a?.length ?? 0) === (b?.length ?? 0) && (a ?? []).every((id, i) => id === b?.[i]);
  const observations = step(was?.observations, gone.observations, written.observations);
  const sessions = step(was?.sessions, gone.sessions, written.sessions);
  const readings = step(was?.readings, gone.readings, written.readings);
  const records: Partial<Record<RecordStore, string[]>> = {};
  for (const s of RECORD_STORES) {
    const list = step(was?.records?.[s], gone.records[s] ?? [], written.records[s] ?? []);
    if (list) records[s] = list;
  }
  const unchanged = same(observations, was?.observations) && same(sessions, was?.sessions) && same(readings, was?.readings)
    && RECORD_STORES.every(s => same(records[s], was?.records?.[s]));
  if (unchanged) return settings;
  const next = { ...(settings ?? {}) } as UserSettings;
  const anyRecords = Object.keys(records).length > 0;
  if (observations || sessions || readings || anyRecords) {
    next.deleted = {
      ...(observations ? { observations } : {}), ...(sessions ? { sessions } : {}), ...(readings ? { readings } : {}),
      ...(anyRecords ? { records } : {}),
    };
  } else delete next.deleted;
  return next;
}
```

  - In `prepare`, after `const sessionRemoves = …`, add the record block:

```ts
  // v2 record stores (Plan 6 Task 1): by key, the last of each key in a change winning.
  let records = from.records;
  const recordGone: Partial<Record<RecordStore, string[]>> = {};
  const recordWritten: Partial<Record<RecordStore, string[]>> = {};
  const recordWrites: Write[] = [];
  if (change.records) {
    records = { ...from.records };
    for (const store of RECORD_STORES) {
      const c = change.records[store];
      if (!c) continue;
      const byKey = new Map<string, StoredRecord>();
      for (const r of c.put ?? []) byKey.set(recordKey(store, r), r);
      const removes = (c.remove ?? []).filter(k => !byKey.has(k));
      const drop = new Set([...removes, ...byKey.keys()]);
      records[store] = sortRecords(store, [...from.records[store].filter(r => !drop.has(recordKey(store, r))), ...byKey.values()]);
      recordGone[store] = removes;
      recordWritten[store] = [...byKey.keys()];
      for (const key of removes) recordWrites.push({ op: 'delete', store, key });
      for (const value of byKey.values()) recordWrites.push({ op: 'put', store, value });
    }
  }
```

  - Pass the records ids to `withDeleted`: add `records: recordGone` to its second argument and `records: recordWritten` to its third.
  - Add `records` to `next`.
  - In the `reset` branch, replace the list of four cleared stores with `for (const store of STORE_NAMES) writes.push({ op: 'clear', store });`, and add `for (const store of RECORD_STORES) for (const value of next.records[store]) writes.push({ op: 'put', store, value });`.
  - In the other branch, after the content writes:

```ts
    writes.push(...recordWrites);
    for (const key of change.journal?.remove ?? []) writes.push({ op: 'delete', store: JOURNAL_STORE, key });
    for (const value of change.journal?.put ?? []) writes.push({ op: 'put', store: JOURNAL_STORE, value });
```

  - In `fromRows`, before the `return`, build the records, then add `records` to the returned object:

```ts
  const records = emptyRecords();
  for (const store of RECORD_STORES) {
    const found = (rows.records?.[store] ?? []).filter((r): r is StoredRecord => isRecord(r) && recordKey(store, r as StoredRecord) !== '');
    records[store] = sortRecords(store, found);
  }
```

  - Replace `readAllIn` with:

```ts
function readAllIn(tx: TxHandle, then: (rows: Rows) => void): void {
  const rows: Partial<Omit<Rows, 'records'>> = {};
  const records = {} as Rows['records'];
  let left = CORE_STORES.length + RECORD_STORES.length;
  const done = () => { left -= 1; if (left === 0) then({ ...(rows as Omit<Rows, 'records'>), records }); };
  tx.getAll('observations', found => { rows.observations = found; done(); });
  tx.getAll('sessions', found => { rows.sessions = found; done(); });
  tx.getAll('settings', found => { rows.settings = found; done(); });
  tx.getAll('content-state', found => { rows.content = found; done(); });
  for (const store of RECORD_STORES) tx.getAll(store, found => { records[store] = found; done(); });
}
```

Run: `npx vitest run src/store/records.test.ts`
Expected: PASS (10 tests). If `tsc` reports a `Snapshot` literal in a test without `records`, spread `emptySnapshot()` into it.

- [ ] **Step 11: The upgrade test.** Append to `src/store/db.test.ts`, and import `DB_VERSION` and `JOURNAL_STORE` from `./db` and `RECORD_STORES` from `./records`:

```ts
/** A v1 build's database: its four stores and one reading, as a phone holds it today. */
async function v1Database(factory: IDBFactory): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = factory.open('fit-strong', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      const o = db.createObjectStore('observations', { keyPath: 'id' });
      o.createIndex('kind', 'kind');
      o.createIndex('day', 'day');
      db.createObjectStore('sessions', { keyPath: 'id' });
      db.createObjectStore('settings', { keyPath: 'key' });
      db.createObjectStore('content-state', { keyPath: 'key' });
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(['observations'], 'readwrite');
      tx.objectStore('observations').put(glucose('a', '2026-10-08', 112));
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onabort = () => reject(tx.error);
    };
    req.onerror = () => reject(req.error);
  });
}

describe('IndexedDB version 2 (journey §18.3)', () => {
  it('upgrades a version 1 database in place: every row kept, every v2 store added, empty', async () => {
    const factory = fakeIndexedDB();
    await v1Database(factory);
    const db = await openDb(factory);
    expect(DB_VERSION).toBe(2);
    expect(await db.getAll('observations')).toHaveLength(1);
    for (const store of [...RECORD_STORES, JOURNAL_STORE] as const) expect(await db.getAll(store)).toEqual([]);
    const rows = await db.readAll();
    expect(Object.keys(rows.records).sort()).toEqual([...RECORD_STORES].sort());
    expect(JOURNAL_STORE in rows).toBe(false);
    db.close();
  });

  it('asks an open v1 copy to close, then opens: the bump never deadlocks with an old tab', async () => {
    const factory = fakeIndexedDB();
    await v1Database(factory);
    const old = await new Promise<IDBDatabase>(resolve => {
      const req = factory.open('fit-strong', 1);
      req.onsuccess = () => resolve(req.result);
    });
    // What v1's own handler does with a versionchange: close (src/store/db.ts, openDb).
    old.onversionchange = () => old.close();
    const db = await openDb(factory);
    expect(await db.getAll('routes')).toEqual([]);
    db.close();
  });
});
```

Run: `npx vitest run src/store/db.test.ts`
Expected: PASS.

- [ ] **Step 12: Schema 6, never re-running the v4 move (Review Focus 1).** Append to `src/store/migrate.test.ts`, and import `doc` from `./db` and `migrateToV6` from the dynamic import of `./migrate`:

```ts
describe('schema 5 → 6 (Plan 6; journey §18.3)', () => {
  beforeEach(() => local.clear());

  it('stamps 6 on a device at 5 and rewrites nothing, with v1’s old v4 copy still in localStorage (Review Focus 1)', async () => {
    // Every v1 phone still holds its v4 blob: the move never deletes it.
    local.set(V4_KEY, JSON.stringify(v4()));
    const db = await openDb(fakeIndexedDB());
    await db.put('settings', [doc('schemaVersion', 5), doc('settings', { theme: 'light', defaultRestSeconds: 60 })]);
    const v5 = await migrateToV5(db);
    expect(v5.ok && v5.value.alreadyDone).toBe(true);
    const v6 = await migrateToV6(db);
    expect(v6.ok && v6.value).toEqual({ from: 5, alreadyDone: false });
    expect(await readDoc(db, 'schemaVersion')).toBe(6);
    expect(await readDoc(db, 'settings')).toEqual({ theme: 'light', defaultRestSeconds: 60 });
    expect(await db.getAll('sessions')).toEqual([]);
    expect(await db.getAll('observations')).toEqual([]);
  });

  it('moves a v4 device straight to 6, and then there is nothing to do', async () => {
    const db = await openDb(fakeIndexedDB());
    expect((await migrateToV5(db, JSON.stringify(v4()))).ok).toBe(true);
    expect(await readDoc(db, 'schemaVersion')).toBe(6);
    const again = await migrateToV6(db);
    expect(again.ok && again.value.alreadyDone).toBe(true);
  });

  it('writes nothing to a device already at 6', async () => {
    const db = await openDb(fakeIndexedDB());
    await db.put('settings', [doc('schemaVersion', 6)]);
    const before = await readDoc<number>(db, 'revision');
    expect((await migrateToV6(db)).ok).toBe(true);
    expect(await readDoc<number>(db, 'revision')).toBe(before);
  });
});
```

Run: `npx vitest run src/store/migrate.test.ts`
Expected: FAIL. `migrateToV6` doesn't exist, and the v4 move still writes 5.

- [ ] **Step 13: The migration.** In `src/store/migrate.ts`:
  - replace `export const SCHEMA_VERSION = 5;` with the two constants below;
  - change `isDone` to use `V5_SCHEMA`;
  - append `migrateToV6`.

  `planMigration` keeps writing `SCHEMA_VERSION`, so a v4 device moves straight to 6.

```ts
/** The data schema (journey §18.3): 6 adds the v2 record stores, which IndexedDB 2 creates empty. */
export const SCHEMA_VERSION = 6;
/**
 * The marker the v4 → v5 move first wrote. A device at or past it has moved,
 * whatever the current schema is: running the move again would replace the
 * record with v1's v4 blob, which is never deleted (Review Focus 1).
 */
export const V5_SCHEMA = 5;
```

```ts
const isDone = (marker: unknown) => typeof marker === 'number' && marker >= V5_SCHEMA;
```

```ts
/**
 * Schema 5 → 6, once (Plan 6 Task 1). Additive: the v2 stores were created
 * empty by IndexedDB 2, so only the marker is written. Asked of the marker
 * first, so an upgraded device reads nothing else on start.
 */
export async function migrateToV6(db: Db): Promise<StoreResult<{ from: number; alreadyDone: boolean }>> {
  let marker: unknown;
  try {
    marker = await readDoc<number>(db, 'schemaVersion');
  } catch (error) {
    return { ok: false, failure: toFailure(error, 'readFailed') };
  }
  if (typeof marker !== 'number' || marker >= SCHEMA_VERSION) return { ok: true, value: { from: typeof marker === 'number' ? marker : 0, alreadyDone: true } };
  const committed = await commitChange(db, undefined, base =>
    typeof base.schemaVersion === 'number' && base.schemaVersion >= V5_SCHEMA && base.schemaVersion < SCHEMA_VERSION
      ? { change: { schemaVersion: SCHEMA_VERSION } }
      : null);
  if (!committed.ok) return { ok: false, failure: committed.failure };
  return { ok: true, value: { from: marker, alreadyDone: committed.value.resolution === null } };
}
```

Run: `npx vitest run src/store/migrate.test.ts`
Expected: PASS.

- [ ] **Step 14: Read the new settings from a file.** In `src/store/importCheck.ts`:
  - import `RECORD_STORES` from `./records`;
  - add `walk` to `SETTINGS_SPEC`;
  - replace its `deleted` entry with the one below, so a damaged list can't break a merge.

```ts
  walk: shape({ saveRoutes: oneOf(true, false, 'unasked'), map: oneOf('on', 'off', 'unasked'), stepCardSeen: bool }, ['saveRoutes', 'map']),
```

```ts
  deleted: { observations: listOf(text), sessions: listOf(text), readings: listOf(text), records: recordOf(oneOf(...RECORD_STORES), listOf(text)) },
```

- [ ] **Step 15: Backups, merges and validation.** In `src/store/transfer.ts`, import:
  - `DEFAULT_BACKUP_STORES`, `RECORD_RULES`, `RECORD_STORES`, `isRecordStore`, `recordKey`, `recordProblem`, `type RecordStore` and `type StoredRecord` from `./records`;
  - `type UserSettings` from `@/types` (it's already imported).

  Then make the changes below.

  - `TransferDoc` gains:

```ts
  /** The v2 record stores this file holds (journey §18.3: a backup lists what it includes). Absent in older files: none. */
  stores?: RecordStore[];
  /** Their rows, by store: only the stores in `stores`. */
  records?: Partial<Record<RecordStore, StoredRecord[]>>;
```

  - `IMPORT_LIMITS` gains the record stores' limits, after `contentState`:

```ts
  ...(Object.fromEntries(RECORD_STORES.map(s => [s, RECORD_RULES[s].limit])) as Record<RecordStore, number>),
```

  - `CollectionCounts` becomes `export interface CollectionCounts extends Record<RecordStore, number> { … }`, keeping its seven fields.
  - `zero()` adds `...(Object.fromEntries(RECORD_STORES.map(s => [s, 0])) as Record<RecordStore, number>)`.
  - Add `ExportOptions`, and give `toTransferDoc` and `collect` an `options` argument:

```ts
export interface ExportOptions {
  /** The v2 record stores to include. By default, every store a backup always holds; routes only when the person includes them (§18.3). */
  include?: readonly RecordStore[];
}

export function toTransferDoc(snapshot: Snapshot, exportedAt: string = nowAt(), options: ExportOptions = {}): TransferDoc {
  const stores = [...new Set(options.include ?? DEFAULT_BACKUP_STORES)].filter(isRecordStore);
  return {
    // …every field as before, then:
    stores,
    records: Object.fromEntries(stores.map(s => [s, snapshot.records[s]])),
  };
}

export async function collect(db: Db, options: ExportOptions = {}): Promise<StoreResult<TransferDoc>> {
  try {
    return { ok: true, value: toTransferDoc(await readSnapshot(db), nowAt(), options) };
  } catch (error) {
    return { ok: false, failure: toFailure(error, 'readFailed') };
  }
}
```

  - Add `withDeviceConsent` after `toTransferDoc`:

```ts
/**
 * This device's own walk consents, whatever a file says (B-26): an import
 * never switches map pictures or route keeping on here. A device that has
 * none of its own starts unasked, and asks on its first walk.
 */
export function withDeviceConsent(file: UserSettings | undefined, device: UserSettings | undefined): UserSettings | undefined {
  if (file === undefined) return undefined;
  const { walk: theirs, ...rest } = file;
  const walk = device?.walk ?? (theirs
    ? { saveRoutes: 'unasked' as const, map: 'unasked' as const, ...(theirs.stepCardSeen ? { stepCardSeen: true } : {}) }
    : undefined);
  return { ...rest, ...(walk ? { walk } : {}) } as UserSettings;
}
```

  - In `parse`, after the `overrides` check, read the stores the file names:

```ts
  // v2 record stores (Plan 6 Task 1): a file names the stores it holds; a name this build doesn't know is a newer build's.
  const named = source.stores === undefined ? [] : Array.isArray(source.stores) ? source.stores : null;
  if (named === null || !named.every(isRecordStore)) {
    return { ok: false, reason: 'That file holds records this version of the app cannot read. Update the app and try again.' };
  }
  const stores = [...new Set(named)];
  const recordsIn = isRecord(source.records) ? source.records : {};
  const recordLists: Partial<Record<RecordStore, unknown[]>> = {};
  for (const store of stores) {
    const list = array(recordsIn[store]);
    if (list === null) return { ok: false, reason: `That file's ${RECORD_RULES[store].label.many} are not a list. It may be damaged.` };
    recordLists[store] = list;
  }
```

    Add `...Object.fromEntries(RECORD_STORES.map(s => [s, recordLists[s]?.length ?? 0]))` to `counts`, so the existing limit loop refuses an oversized store before anything is read.

    Then, after `unique` is defined, add:

```ts
  const records: Partial<Record<RecordStore, StoredRecord[]>> = {};
  for (const store of stores) {
    const good = keep(recordLists[store]!, (x): x is StoredRecord => recordProblem(store, x) === undefined, store);
    records[store] = unique(good, r => recordKey(store, r), store);
  }
```

    Add `stores, records,` to the returned `file`.
  - `ImportBase` adds `'records'` to its `Pick`.
  - In `planMerge`, after `const learnedReadings = …`, add:

```ts
  // v2 record stores: by key, as sessions are, with each store's own `newer` and `accepts` (Plan 6 Task 1).
  const recordPuts: Partial<Record<RecordStore, StoredRecord[]>> = {};
  for (const store of file.stores ?? []) {
    const rule = RECORD_RULES[store];
    if (rule.accepts && !rule.accepts(base.settings)) continue;
    const here = new Map((base.records?.[store] ?? []).map(r => [recordKey(store, r), r]));
    const goneKeys = new Set(base.settings?.deleted?.records?.[store] ?? []);
    const puts: StoredRecord[] = [];
    for (const r of file.records?.[store] ?? []) {
      const key = recordKey(store, r);
      const held = here.get(key);
      if (!held && goneKeys.has(key)) { deletedHere += 1; continue; }
      if (!held) { puts.push(r); continue; }
      if (sameValue(held, r)) continue;
      const verdict = rule.newer?.(held, r) ?? 0;
      if (verdict === 0) conflicts[store] += 1;
      if (verdict > 0 || (verdict === 0 && takeFile)) puts.push(r);
    }
    if (puts.length > 0) recordPuts[store] = puts;
  }
  // The file's deletions of records this device doesn't hold, for every store, included in the file or not.
  const learnedRecords: Partial<Record<RecordStore, string[]>> = {};
  for (const store of RECORD_STORES) {
    const mine = new Set(base.settings?.deleted?.records?.[store] ?? []);
    const holds = new Set((base.records?.[store] ?? []).map(r => recordKey(store, r)));
    const learnedKeys = learn(mine, theirs?.records?.[store], k => holds.has(k));
    if (learnedKeys.length > 0) learnedRecords[store] = [...mine, ...learnedKeys];
  }
```

    Replace the `learned` constant with:

```ts
  const recordsLearned = Object.keys(learnedRecords).length > 0;
  const learned = learnedObservations.length + learnedSessions.length + learnedReadings.length > 0 || recordsLearned
    ? {
      observations: [...goneHere.observations, ...learnedObservations],
      sessions: [...goneHere.sessions, ...learnedSessions],
      readings: [...goneHere.readings, ...learnedReadings],
      ...(recordsLearned || base.settings?.deleted?.records ? { records: { ...(base.settings?.deleted?.records ?? {}), ...learnedRecords } } : {}),
    }
    : undefined;
```

    In `change`:
    - add `...(Object.keys(recordPuts).length > 0 ? { records: Object.fromEntries(Object.entries(recordPuts).map(([s, put]) => [s, { put }])) } : {})`;
    - replace `{ settings: { replace: file.settings } }` with `{ settings: { replace: withDeviceConsent(file.settings, undefined)! } }`;
    - add `records: Object.fromEntries(Object.entries(recordPuts).map(([s, put]) => [s, put!.length]))` to `counts`. `MergePlan.counts` gains `records: Partial<Record<RecordStore, number>>`.

    `conflicts` is a `CollectionCounts`, so `conflicts[store]` is typed.
  - In `planImport`'s replace branch:
    - the settings become `{ settings: { replace: withDeviceConsent(file.settings, base.settings)! } }`;
    - the change gains `records`, below;
    - `report` gains `records: Object.fromEntries((file.stores ?? []).map(s => [s, file.records?.[s]?.length ?? 0]))`.

```ts
        records: Object.fromEntries((file.stores ?? [])
          .filter(s => !RECORD_RULES[s].accepts || RECORD_RULES[s].accepts!(base.settings))
          .map(s => [s, { put: file.records?.[s] ?? [] }])),
```

    The merge branch's `report` gains `records: merge.counts.records`, and `ImportReport` gains `records?: Partial<Record<RecordStore, number>>`.
  - In `previewImport`:
    - before `return`, add the three counts below;
    - add `records, refusedStores, replaceRemoves,` to the result;
    - add `&& Object.values(records).every(n => n === 0)` to `isEmpty`.

```ts
  // v2 record stores: what the file holds, what this device won't take, and what Replace would remove here (Review Focus 4).
  const records = Object.fromEntries((file.stores ?? []).map(s => [s, file.records?.[s]?.length ?? 0])) as Partial<Record<RecordStore, number>>;
  const refusedStores = (file.stores ?? []).filter(s => (records[s] ?? 0) > 0 && RECORD_RULES[s].accepts !== undefined && !RECORD_RULES[s].accepts(base.settings));
  const replaceRemoves = Object.fromEntries(RECORD_STORES.map(s => [s, base.records?.[s]?.length ?? 0]).filter(([, n]) => (n as number) > 0)) as Partial<Record<RecordStore, number>>;
```

    `ImportPreview` gains:

```ts
  /** The v2 record stores in the file, and how many records of each. Always set by `previewImport`. */
  records?: Partial<Record<RecordStore, number>>;
  /** Stores in the file this device won't take (`RecordRule.accepts`): a merge or replace leaves them out. */
  refusedStores?: RecordStore[];
  /** This device's v2 records, by store, that Replace removes (it leaves only the file's). */
  replaceRemoves?: Partial<Record<RecordStore, number>>;
```

- [ ] **Step 16: Write the failing transfer tests.** Append to `src/store/transfer.test.ts`, with these imports:
  - `emptySnapshot` and `prepare` from `./snapshot`;
  - `routeRecord` and `type RouteLine` from `@/walk/routeRecord`;
  - `type StoredRecord` from `./records`;
  - `toTransferDoc`, `withDeviceConsent` and `type TransferDoc` from `./transfer`;
  - `type UserSettings` from `@/types`.

```ts
describe('v2 record stores in a backup (Plan 6 Task 1)', () => {
  const LINE: RouteLine = { start: 1_760_000_000_000, end: 1_760_000_020_000, coords: [[12.97, 77.59], [12.9705, 77.5902], [12.971, 77.5905]], ms: [0, 10_000, 20_000] };
  const route = (walkId: string, shift = 0): StoredRecord => routeRecord(walkId, '2026-10-08T09:00:00.000+05:30',
    [{ ...LINE, coords: LINE.coords.map(([a, b]): [number, number] => [a + shift, b]) }])! as unknown as StoredRecord;
  const file = (over: Partial<TransferDoc> = {}) => ({ ...toTransferDoc(emptySnapshot()), ...over });
  const withRoutes = (...routes: StoredRecord[]) => file({ stores: ['routes'], records: { routes } });
  const holding = (...routes: StoredRecord[]) => prepare(emptySnapshot(), { records: { routes: { put: routes } } }).next;
  const south = (r: StoredRecord) => (r.bbox as number[])[0];

  it('leaves routes out unless they are included, and lists the stores it holds', () => {
    const snap = holding(route('walk-aaaa'));
    expect(toTransferDoc(snap).stores).toEqual(['meals', 'savedMeals', 'customFoods']);
    expect(toTransferDoc(snap).records?.routes).toBeUndefined();
    expect(toTransferDoc(snap, undefined, { include: ['routes'] }).records?.routes).toHaveLength(1);
  });

  it('restores routes exactly with Replace', () => {
    const plan = planImport(withRoutes(route('walk-aaaa')), 'replace', emptySnapshot());
    expect(prepare(emptySnapshot(), plan.change).next.records.routes).toEqual([route('walk-aaaa')]);
    expect(plan.report.records).toEqual({ routes: 1 });
  });

  it('merges by walk: a new route is added, and a different copy is a conflict that keeps this phone’s unless told', () => {
    const here = holding(route('walk-aaaa'));
    const plan = planImport(withRoutes(route('walk-aaaa', 0.01), route('walk-bbbb')), 'merge', here);
    expect(plan.report.conflicts?.routes).toBe(1);
    const merged = prepare(here, plan.change).next.records.routes;
    expect(merged.map(r => r.walkId)).toEqual(['walk-aaaa', 'walk-bbbb']);
    expect(south(merged[0])).toBe(12.97);
    const taken = prepare(here, planImport(withRoutes(route('walk-aaaa', 0.01)), 'merge', here, { onConflict: 'takeFile' }).change).next.records.routes;
    expect(south(taken[0])).toBeCloseTo(12.98, 9);
  });

  it('never brings back a route deleted here, learns the file’s deletions, and never lets one remove a route held here', () => {
    const deleted = prepare(holding(route('walk-aaaa')), { records: { routes: { remove: ['walk-aaaa'] } } }).next;
    expect(prepare(deleted, planImport(withRoutes(route('walk-aaaa')), 'merge', deleted).change).next.records.routes).toEqual([]);
    expect(previewImport(withRoutes(route('walk-aaaa')), deleted)).toMatchObject({ ok: true, deletedHere: 1 });
    const told = file({ settings: { deleted: { records: { routes: ['walk-cccc'] } } } as UserSettings });
    expect(prepare(deleted, planImport(told, 'merge', deleted).change).next.settings?.deleted?.records?.routes).toEqual(['walk-aaaa', 'walk-cccc']);
    const kept = holding(route('walk-dddd'));
    const deleting = file({ settings: { deleted: { records: { routes: ['walk-dddd'] } } } as UserSettings });
    expect(prepare(kept, planImport(deleting, 'merge', kept).change).next.records.routes).toHaveLength(1);
  });

  it('refuses a damaged route unless asked to import the rest', () => {
    const damaged = withRoutes(route('walk-aaaa'), { ...route('walk-bbbb'), bbox: [0, 0, 1, 1] });
    expect(previewImport(damaged)).toMatchObject({ ok: true, rejected: { routes: 1 } });
    expect(() => planImport(damaged, 'merge', emptySnapshot())).toThrow(/could not be read/);
    const rest = planImport(damaged, 'merge', emptySnapshot(), { allowRejected: true });
    expect(prepare(emptySnapshot(), rest.change).next.records.routes.map(r => r.walkId)).toEqual(['walk-aaaa']);
  });

  it('refuses a store this build does not know, and more routes than a lifetime holds, before reading them', () => {
    expect(previewImport(file({ stores: ['routes', 'diaries'] as never }))).toMatchObject({ ok: false, reason: expect.stringMatching(/cannot read/) });
    const huge = withRoutes(...Array.from({ length: 100_001 }, () => ({}) as StoredRecord));
    expect(previewImport(huge)).toMatchObject({ ok: false, reason: expect.stringMatching(/more routes/) });
  });

  it('adds no routes to a phone that said No to keeping them, and says so first (Review Focus 4)', () => {
    const no = prepare(emptySnapshot(), { settings: { patch: { walk: { saveRoutes: false, map: 'off' } } } }).next;
    expect(previewImport(withRoutes(route('walk-aaaa')), no)).toMatchObject({ ok: true, records: { routes: 1 }, refusedStores: ['routes'] });
    expect(prepare(no, planImport(withRoutes(route('walk-aaaa')), 'merge', no).change).next.records.routes).toEqual([]);
    expect(prepare(no, planImport(withRoutes(route('walk-aaaa')), 'replace', no).change).next.records.routes).toEqual([]);
  });

  it('says before a Replace that this phone’s routes will go, when the file has none (Review Focus 4)', () => {
    const here = holding(route('walk-aaaa'), route('walk-bbbb'));
    expect(previewImport(file(), here)).toMatchObject({ ok: true, replaceRemoves: { routes: 2 } });
    expect(prepare(here, planImport(file(), 'replace', here).change).next.records.routes).toEqual([]);
  });

  it('never switches map pictures or route keeping on from a file (B-26)', () => {
    const theirs = { theme: 'dark', walk: { saveRoutes: true, map: 'on', stepCardSeen: true } } as UserSettings;
    expect(withDeviceConsent(theirs, { walk: { saveRoutes: false, map: 'off' } } as UserSettings)?.walk).toEqual({ saveRoutes: false, map: 'off' });
    expect(withDeviceConsent(theirs, undefined)?.walk).toEqual({ saveRoutes: 'unasked', map: 'unasked', stepCardSeen: true });
    const replaced = prepare(emptySnapshot(), planImport(file({ settings: theirs }), 'replace', emptySnapshot()).change).next;
    expect(replaced.settings?.walk).toEqual({ saveRoutes: 'unasked', map: 'unasked', stepCardSeen: true });
  });

  it('refuses food records until Plan 7 can read them', () => {
    expect(previewImport(file({ stores: ['meals'], records: { meals: [{ id: 'm1' }] } }))).toMatchObject({ ok: true, rejected: { meals: 1 } });
  });
});
```

Run: `npx vitest run src/store/transfer.test.ts`
Expected: FAIL first. After Step 15's changes, PASS.

Then fix the two assertions that pin the stamped marker to 5, because the app now writes `SCHEMA_VERSION`:
- `src/store/transfer.test.ts:84`: `expect(exported.schemaVersion).toBe(5)` becomes `toBe(SCHEMA_VERSION)`. Import `SCHEMA_VERSION` from `./migrate`.
- `transfer.test.ts:254`: `doc('schemaVersion', 5)` becomes `doc('schemaVersion', SCHEMA_VERSION)`.

Leave the test files that say `schemaVersion: 5` alone: they're older backups that must still import.

In `src/store/merge.test.ts:749`, add `routes: 0, meals: 0, savedMeals: 0, customFoods: 0` to `none`.

- [ ] **Step 17: The store.** In `src/store/useStore.ts`:
  - **State:** `StoreState` gains `/** The v2 record stores (Plan 6 Task 1). */ records: Readonly<Records>;`, and `toState` adds `records: s.records`.
  - **Boot:** in `boot`, right after the `if (!migrated.ok) { … }` block, add the schema 6 stamp below.
  - **Actions:** add `putRecords` and `removeRecords` after `setContentState`, below.
  - **Export:** `exportRecord(options: ExportOptions = {})`:
    - builds `const doc = toTransferDoc(snap, exportedAt, options)`, then `encode(doc)`;
    - returns `stores: doc.stores ?? []` in its value;
    - `ExportedRecord` gains `/** The v2 record stores the file holds. */ stores: RecordStore[];`.

```ts
  // Schema 5 → 6 (Plan 6): additive. A device that can't stamp it now keeps working, and tries again next start.
  await migrateToV6(handle);
  if (mine !== generation) { handle.close(); return; }
```

```ts
/** One store's records, as one change; a single invalid record refuses the batch. */
export function putRecords(store: RecordStore, records: readonly StoredRecord[]): Promise<StoreResult> {
  return enqueue<void>({
    plan: () => {
      const refused: FailureDetail[] = [];
      records.forEach((r, index) => {
        const problem = recordProblem(store, r);
        if (problem) refused.push({ index, ...(recordKey(store, r) ? { id: recordKey(store, r) } : {}), reason: problem });
      });
      if (refused.length > 0) {
        throw new StoreFailure('invalid', `Nothing was saved. ${refused.map(d => `${RECORD_RULES[store].label.one} ${d.index + 1}: ${d.reason}`).join('; ')}`, undefined, refused);
      }
      return { change: records.length ? { records: { [store]: { put: [...records] } } as Change['records'] } : null, result: () => undefined };
    },
  });
}

/** Remove records by key, remembered as deleted (D-06). Keys no longer stored are passed over. */
export function removeRecords(store: RecordStore, keys: readonly string[]): Promise<StoreResult> {
  const wanted = new Set(keys);
  return enqueue<void>({
    plan: base => {
      const present = base.records[store].map(r => recordKey(store, r)).filter(k => wanted.has(k));
      return { change: present.length ? { records: { [store]: { remove: present } } as Change['records'] } : null, result: () => undefined };
    },
  });
}
```

  The imports are:
  - `migrateToV6` from `./migrate`;
  - `RECORD_RULES`, `recordKey`, `recordProblem`, `type RecordStore`, `type Records` and `type StoredRecord` from `./records`;
  - `type ExportOptions` from `./transfer`.

- [ ] **Step 18: Store tests.** Append to `src/store/useStore.test.ts`, importing `openDb` and `readDoc` from `./db`:

```ts
describe('the v2 record stores (Plan 6 Task 1)', () => {
  const LINE = { start: 1_760_000_000_000, end: 1_760_000_020_000, coords: [[12.97, 77.59], [12.9705, 77.5902], [12.971, 77.5905]] as [number, number][], ms: [0, 10_000, 20_000] };
  const route = (walkId: string) => ({ walkId, version: 1, startedAt: '2026-10-08T09:00:00.000+05:30', segments: [LINE], bbox: [12.97, 77.59, 12.971, 77.5905] });

  it('stamps schema 6 when it starts', async () => {
    const fake = await booted();
    const db = await openDb(fake);
    expect(await readDoc(db, 'schemaVersion')).toBe(6);
    db.close();
  });

  it('puts, keeps across a restart and removes routes, remembering the removal', async () => {
    const fake = await booted();
    expect((await store.putRecords('routes', [route('walk-aaaa')])).ok).toBe(true);
    expect(store.getState().records.routes.map(r => r.walkId)).toEqual(['walk-aaaa']);
    store.resetForTests();
    await store.start({ factory: fake, broadcast: null });
    expect(store.getState().records.routes).toHaveLength(1);
    expect((await store.removeRecords('routes', ['walk-aaaa'])).ok).toBe(true);
    expect(store.getState().records.routes).toEqual([]);
    expect(store.getState().settings.deleted?.records?.routes).toEqual(['walk-aaaa']);
  });

  it('refuses a record its store cannot read, writing nothing', async () => {
    await booted();
    const result = await store.putRecords('routes', [{ walkId: 'walk-aaaa', version: 9 }]);
    expect(!result.ok && result.failure.code).toBe('invalid');
    expect(store.getState().records.routes).toEqual([]);
  });

  it('backs up routes only when asked, and says which stores the file holds', async () => {
    await booted();
    await store.putRecords('routes', [route('walk-aaaa')]);
    const plain = await store.exportRecord();
    const withRoutes = await store.exportRecord({ include: ['routes'] });
    expect(plain.ok && plain.value.stores).not.toContain('routes');
    expect(withRoutes.ok && withRoutes.value.stores).toEqual(['routes']);
    if (!withRoutes.ok) return;
    const doc = (await decode(withRoutes.value.bytes)) as { records: { routes: unknown[] } };
    expect(doc.records.routes).toHaveLength(1);
  });
});
```

Run: `npx vitest run src/store`
Expected: PASS.

- [ ] **Step 19: The backup sheet follows the records.** In `src/screens/you/DataSheets.tsx`, add `state.records` to both arrays of the `version` memo (the array and its dependency list). A prepared file is then rebuilt when a record changes.

- [ ] **Step 20: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/store src/walk/routeRecord.ts src/walk/routeRecord.test.ts src/types/index.ts src/screens/you/DataSheets.tsx
git commit -m "feat: Add IndexedDB 2 and schema 6 with every v2 store and generic record plumbing"
```

---
### Task 2: Route capture in the GPS track, and route geometry

**Files:**
- Modify: `src/walk/gps.ts`, `src/walk/gps.test.ts`
- Create: `src/walk/route.ts`, `src/walk/route.test.ts`

**Interfaces:**
- **Consumes** (Task 1): `RouteLine`, `LatLon`, `Bbox`, `ROUTE_LIMITS` and `roundCoord`.
- **Produces, in `gps.ts`:**
  - `interface TrackOptions { route?: boolean; maxPoints?: number }`;
  - `createTrack(segmentStart: number, options?: TrackOptions): Track`;
  - `Track.lines: RouteLine[]` (copies), `Track.here: LatLon | undefined` and `Track.forgetPoints(): void`;
  - the polyline of the points kept is exactly the distance the track counted, because a point is kept at each counted move and a line breaks at every uncounted move.
- **Produces, in `route.ts`:**
  - `TILE_PX = 256`, `ZOOM = { min: 3, max: 18 }` and `VIEW_SIZE = { w: 400, h: 300 }`;
  - `interface View { z: number; cx: number; cy: number; w: number; h: number }`;
  - `worldPx(lat, lon, z): { x: number; y: number }`;
  - `fitView(box: Bbox, w: number, h: number, pad?: number): View`;
  - `toView(lat, lon, v: View): { x: number; y: number }`;
  - `holds(v: View, box: Bbox, pad?: number): boolean`;
  - `zoomed(v: View, by: 1 | -1): View`;
  - `withPoint(box: Bbox | undefined, p: LatLon | undefined): Bbox | undefined`;
  - `liveView(prev: View | undefined, box: Bbox | undefined, mode: 'auto' | 'fixed', size?): View | undefined`;
  - `linePaths(lines: readonly RouteLine[], v: View): string[]`;
  - `gridLines(v: View, every?: number): { x: number[]; y: number[] }`;
  - `interface Split { km: number; ms: number }`;
  - `splitsOf(lines: readonly RouteLine[]): Split[]`.

- [ ] **Step 1: Write the failing test.** Append to `src/walk/gps.test.ts`, which already has `path`, `play`, `offset` and `START`. Import `lineProblem` and `type RouteLine` from `./routeRecord`.

```ts
describe('the route, when asked for (B-17)', () => {
  const length = (l: RouteLine) => l.coords.slice(1)
    .reduce((t, p, i) => t + metresBetween({ lat: l.coords[i][0], lon: l.coords[i][1] }, { lat: p[0], lon: p[1] }), 0);

  it('keeps no points unless asked, but always knows where the walker is', () => {
    const track = createTrack(T0);
    play(track, path({ seconds: 60, speed: 1.3, noise: 0 }));
    expect(track.lines).toEqual([]);
    expect(track.here).toBeDefined();
  });

  it('draws each run of signal as its own line, never joined, exactly as long as the distance counted', () => {
    const track = createTrack(T0, { route: true });
    play(track, path({ seconds: 60, speed: 1.3, noise: 0 }));
    play(track, path({ from: 120, seconds: 60, speed: 1.3, noise: 0, origin: offset(START, 300, 0) }));
    expect(track.lines).toHaveLength(2);
    expect(length(track.lines[0]) + length(track.lines[1])).toBeCloseTo(track.distanceM, 3);
    for (const l of track.lines) expect(lineProblem(l)).toBeUndefined();
  });

  it('breaks the line at a jump no walker could make, and never draws the jump', () => {
    const track = createTrack(T0, { route: true });
    play(track, path({ seconds: 60, speed: 1.3, noise: 0 }));
    const far = offset(START, 2000, 0);
    // Three fixes that agree with each other, 2 km away: the track starts again there, counting nothing between.
    play(track, [0, 1, 2].map(i => ({ ...far, accuracy: 5, timestamp: T0 + 61_000 + i * 1000 })));
    play(track, path({ from: 64, seconds: 30, speed: 1.3, noise: 0, origin: far }));
    expect(track.lines).toHaveLength(2);
    expect(track.lines[1].coords[0][0]).toBeCloseTo(far.lat, 5);
    expect(length(track.lines[0]) + length(track.lines[1])).toBeCloseTo(track.distanceM, 3);
  });

  it('keeps every point to 6 decimal places', () => {
    const track = createTrack(T0, { route: true });
    play(track, path({ seconds: 30, speed: 1.3, noise: 2, seed: 7 }));
    for (const [lat, lon] of track.lines.flatMap(l => l.coords)) {
      expect(Math.round(lat * 1e6) / 1e6).toBe(lat);
      expect(Math.round(lon * 1e6) / 1e6).toBe(lon);
    }
  });

  it('stops keeping points at its limit, and forgets them on request, keeping the distance (B-05)', () => {
    const track = createTrack(T0, { route: true, maxPoints: 5 });
    play(track, path({ seconds: 120, speed: 1.3, noise: 0 }));
    expect(track.lines.reduce((n, l) => n + l.coords.length, 0)).toBe(5);
    const walked = track.distanceM;
    track.forgetPoints();
    expect(track.lines).toEqual([]);
    expect(track.distanceM).toBe(walked);
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/walk/gps.test.ts -t "the route"`
Expected: FAIL. `createTrack` takes no options, and `lines` doesn't exist.

- [ ] **Step 3: Keep points in the track.** In `src/walk/gps.ts`:
  - import `ROUTE_LIMITS`, `roundCoord`, `type LatLon` and `type RouteLine` from `./routeRecord`;
  - add the options;
  - add the three members to `Track` and keep the route inside `createTrack`. Every existing line stays as it is.

```ts
export interface TrackOptions {
  /** Keep the route as lines of counted positions, for the live drawing and, with consent, the saved route (B-17). */
  route?: boolean;
  /** The most points one track keeps. */
  maxPoints?: number;
}
```

In `interface Track`:

```ts
  /** The route so far, one line per stretch of counted movement, when asked for. Copies. */
  readonly lines: RouteLine[];
  /** The last counted position: the live view's "you are here" dot. */
  readonly here: LatLon | undefined;
  /** Drop every point kept so far (B-05). The distance stays. */
  forgetPoints(): void;
```

Change the signature to `export function createTrack(segmentStart: number, options: TrackOptions = {}): Track {`, and add after `const runs: GpsRun[] = [];`:

```ts
  const keepRoute = options.route === true;
  const maxPoints = options.maxPoints ?? ROUTE_LIMITS.points;
  let lines: RouteLine[] = [];
  let points = 0;
  let here: LatLon | undefined;

  /** A new line from this position: after a first fix, a gap, or a jump that was not walked. */
  function beginLine(lat: number, lon: number, t: number) {
    here = [roundCoord(lat), roundCoord(lon)];
    if (!keepRoute || points >= maxPoints) return;
    lines.push({ start: t, end: t, coords: [here], ms: [0] });
    points += 1;
  }

  /** The line goes on to this counted position, so the line is as long as the distance counted. */
  function extendLine(lat: number, lon: number, t: number) {
    here = [roundCoord(lat), roundCoord(lon)];
    const line = lines[lines.length - 1];
    if (!keepRoute || !line || points >= maxPoints) return;
    line.coords.push(here);
    line.end = Math.max(line.end, t);
    line.ms.push(line.end - line.start);
    points += 1;
  }
```

- In `startFrom`, after `runs.push({ start, end: start, distanceM: 0 });`, add `beginLine(fix.lat, fix.lon, start);`.
- In `accept`, replace the counting `if` with the version below.
- Add the members to the returned object.

```ts
    if (seconds > 0 && moved / seconds <= GPS.maxSpeedMps) {
      distance += moved;
      run.distanceM += moved;
      moves += 1;
      extendLine(p.lat, p.lon, fix.timestamp);
    } else {
      // Not walked: the line breaks here, so the drawing never shows the jump (B-17).
      beginLine(p.lat, p.lon, fix.timestamp);
    }
```

```ts
    get lines() {
      return lines.map(l => ({ ...l, coords: [...l.coords], ms: [...l.ms] }));
    },
    get here() {
      return here;
    },
    forgetPoints() {
      lines = [];
      points = 0;
    },
```

Run: `npx vitest run src/walk/gps.test.ts`
Expected: PASS, the existing tests included.

- [ ] **Step 4: Write the failing test** `src/walk/route.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { fitView, gridLines, holds, linePaths, liveView, splitsOf, toView, VIEW_SIZE, withPoint, worldPx, zoomed, ZOOM } from './route';
import type { Bbox, LatLon, RouteLine } from './routeRecord';

const R = 6_371_008.8;
const north = (lat: number, lon: number, m: number): LatLon => [lat + (m / R) * (180 / Math.PI), lon];

/** A straight line north: a point every `step` metres, every `dt` ms. */
function walkLine(start: number, from: LatLon, metres: number, step = 100, dt = 60_000): RouteLine {
  const n = Math.round(metres / step);
  const coords = Array.from({ length: n + 1 }, (_, i) => north(from[0], from[1], i * step));
  return { start, end: start + n * dt, coords, ms: coords.map((_, i) => i * dt) };
}

const BOX: Bbox = [12.97, 77.59, 12.975, 77.6];

describe('Web Mercator, the tiles’ own space', () => {
  it('puts 0°, 0° at the centre of the world tile', () => {
    expect(worldPx(0, 0, 0)).toEqual({ x: 128, y: 128 });
    expect(worldPx(0, 0, 1)).toEqual({ x: 256, y: 256 });
  });
});

describe('the view', () => {
  it('fits a route at the largest zoom that holds it, centred', () => {
    const v = fitView(BOX, 400, 300);
    expect(holds(v, BOX)).toBe(true);
    expect(holds(zoomed(v, 1), BOX, 24)).toBe(false);
    expect(toView((BOX[0] + BOX[2]) / 2, (BOX[1] + BOX[3]) / 2, v).x).toBeCloseTo(200, 0);
  });

  it('steps in and out about the same centre, within the zoom range', () => {
    const v = fitView(BOX, 400, 300);
    expect(zoomed(v, 1).z).toBe(Math.min(v.z + 1, ZOOM.max));
    expect(zoomed(zoomed(v, 1), -1)).toEqual(v);
  });

  it('steps out only when the route no longer fits, and never moves while fixed (M13, B-29)', () => {
    const small: Bbox = [12.97, 77.59, 12.9705, 77.5905];
    const v = liveView(undefined, small, 'auto')!;
    expect(liveView(v, small, 'auto')).toBe(v);
    const grown: Bbox = [12.97, 77.59, 12.99, 77.62];
    expect(liveView(v, grown, 'auto')!.z).toBeLessThan(v.z);
    expect(liveView(v, grown, 'fixed')).toBe(v);
  });

  it('grows the box to hold the walker', () => {
    expect(withPoint(undefined, [1, 2])).toEqual([1, 2, 1, 2]);
    expect(withPoint([0, 0, 1, 1], [2, -1])).toEqual([0, -1, 2, 1]);
    expect(withPoint([0, 0, 1, 1], undefined)).toEqual([0, 0, 1, 1]);
  });
});

describe('drawing', () => {
  it('draws each line on its own and never joins two (A-48)', () => {
    const a = walkLine(0, [12.97, 77.59], 300);
    const b = walkLine(600_000, [12.98, 77.59], 300);
    const v = fitView([12.97, 77.59, 12.983, 77.59], 400, 300);
    const paths = linePaths([a, b, { start: 0, end: 0, coords: [[1, 1]], ms: [0] }], v);
    expect(paths).toHaveLength(2);
    for (const p of paths) expect(p.match(/M/g)).toHaveLength(1);
  });

  it('lays a plain grid across the whole view', () => {
    const g = gridLines(fitView(BOX, VIEW_SIZE.w, VIEW_SIZE.h));
    expect(g.x.length).toBeGreaterThanOrEqual(6);
    expect(g.y.every(y => y >= 0 && y <= VIEW_SIZE.h)).toBe(true);
  });
});

describe('splits (journey §9.5, B-17)', () => {
  it('gives each complete kilometre its time, and nothing for the one under way', () => {
    const splits = splitsOf([walkLine(0, [12.97, 77.59], 2400)]);
    expect(splits.map(s => s.km)).toEqual([1, 2]);
    for (const s of splits) expect(s.ms).toBeCloseTo(600_000, -3);
  });

  it('leaves out a dropout’s time, as its distance is left out', () => {
    const a = walkLine(0, [12.97, 77.59], 600, 100, 36_000);
    const b = walkLine(3_600_000, [12.99, 77.59], 700, 100, 60_000);
    const [first] = splitsOf([a, b]);
    // The kilometre ends 400 m into the second line: 216 s, then 240 s. The hour between isn't walking.
    expect(first.ms).toBeCloseTo(456_000, -3);
  });
});
```

- [ ] **Step 5: Run it to check it fails**

Run: `npx vitest run src/walk/route.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 6: Write the module** `src/walk/route.ts`

```ts
/**
 * Drawing a route (journey §9.2, §9.5; motion M13, M14), in Web Mercator
 * pixels: the space OpenStreetMap's tiles use, so our own drawing and the
 * map pictures under it line up. Pure; the screens lay out what this returns.
 */
import { metresBetween } from './gps';
import type { Bbox, LatLon, RouteLine } from './routeRecord';

export const TILE_PX = 256;
export const ZOOM = { min: 3, max: 18 } as const;
/** The drawing's own size, in its own pixels; it scales to the screen. */
export const VIEW_SIZE = { w: 400, h: 300 } as const;

/** What is on screen: a zoom, its centre in world pixels at that zoom, and a size. */
export interface View { z: number; cx: number; cy: number; w: number; h: number }

const MAX_LAT = 85.05112878;

export function worldPx(lat: number, lon: number, z: number): { x: number; y: number } {
  const scale = TILE_PX * 2 ** z;
  const phi = (Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * scale,
    y: ((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * scale,
  };
}

/** The largest zoom at which the box fits the view with `pad` px to spare, centred on it. */
export function fitView(box: Bbox, w: number, h: number, pad = 24): View {
  const [s, west, n, e] = box;
  const at = (z: number): View => {
    const a = worldPx(n, west, z);
    const b = worldPx(s, e, z);
    return { z, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, w, h };
  };
  for (let z = ZOOM.max; z > ZOOM.min; z--) {
    const a = worldPx(n, west, z);
    const b = worldPx(s, e, z);
    if (b.x - a.x <= w - 2 * pad && b.y - a.y <= h - 2 * pad) return at(z);
  }
  return at(ZOOM.min);
}

/** Where a point sits in the view, in view pixels. */
export function toView(lat: number, lon: number, v: View): { x: number; y: number } {
  const p = worldPx(lat, lon, v.z);
  return { x: p.x - v.cx + v.w / 2, y: p.y - v.cy + v.h / 2 };
}

/** Whether the box sits inside the view with `pad` px to spare. */
export function holds(v: View, box: Bbox, pad = 12): boolean {
  const a = toView(box[2], box[1], v);
  const b = toView(box[0], box[3], v);
  return a.x >= pad && a.y >= pad && b.x <= v.w - pad && b.y <= v.h - pad;
}

/** One step in or out, about the same centre. */
export function zoomed(v: View, by: 1 | -1): View {
  const z = Math.max(ZOOM.min, Math.min(ZOOM.max, v.z + by));
  const f = 2 ** (z - v.z);
  return { ...v, z, cx: v.cx * f, cy: v.cy * f };
}

/** The box, grown to hold one more point: the walker, in the live view. */
export function withPoint(box: Bbox | undefined, p: LatLon | undefined): Bbox | undefined {
  if (!p) return box;
  if (!box) return [p[0], p[1], p[0], p[1]];
  return [Math.min(box[0], p[0]), Math.min(box[1], p[1]), Math.max(box[2], p[0]), Math.max(box[3], p[1])];
}

/**
 * The live view (M13, B-29). It keeps the whole route in view by stepping its
 * scale, never by animating, and only when the route no longer fits. Fixed
 * (under Reduce Motion, or after Zoom in or Zoom out), it stays where it is
 * until "Show whole route".
 */
export function liveView(prev: View | undefined, box: Bbox | undefined, mode: 'auto' | 'fixed', size: { w: number; h: number } = VIEW_SIZE): View | undefined {
  if (!box) return prev;
  if (!prev) return fitView(box, size.w, size.h);
  if (mode === 'fixed' || holds(prev, box)) return prev;
  return fitView(box, size.w, size.h);
}

/** One SVG path per line of two points or more. Lines are never joined (A-48). */
export function linePaths(lines: readonly RouteLine[], v: View): string[] {
  return lines
    .filter(l => l.coords.length >= 2)
    .map(l => l.coords.map(([lat, lon], i) => {
      const p = toView(lat, lon, v);
      return `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    }).join(''));
}

/** The plain grid under the drawing: a line every `every` world px, so it moves with the map's own squares. */
export function gridLines(v: View, every = 64): { x: number[]; y: number[] } {
  const left = v.cx - v.w / 2;
  const top = v.cy - v.h / 2;
  const x: number[] = [];
  const y: number[] = [];
  for (let at = Math.ceil(left / every) * every; at <= left + v.w; at += every) x.push(at - left);
  for (let at = Math.ceil(top / every) * every; at <= top + v.h; at += every) y.push(at - top);
  return { x, y };
}

export interface Split { km: number; ms: number }

/**
 * The time of each complete kilometre (journey §9.5, B-17): distance and time
 * are read off the same lines, so a dropout's distance and its time are both
 * left out. A kilometre still under way is not a split.
 */
export function splitsOf(lines: readonly RouteLine[]): Split[] {
  const out: Split[] = [];
  let metres = 0;
  let covered = 0;
  let mark = 0;
  for (const line of lines) {
    for (let i = 1; i < line.coords.length; i++) {
      const [aLat, aLon] = line.coords[i - 1];
      const [bLat, bLon] = line.coords[i];
      const d = metresBetween({ lat: aLat, lon: aLon }, { lat: bLat, lon: bLon });
      const dt = line.ms[i] - line.ms[i - 1];
      while (d > 0 && metres + d >= (out.length + 1) * 1000) {
        const into = (out.length + 1) * 1000 - metres;
        const at = covered + dt * (into / d);
        out.push({ km: out.length + 1, ms: Math.round(at - mark) });
        mark = at;
      }
      metres += d;
      covered += dt;
    }
  }
  return out;
}
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/walk/route.test.ts src/walk/gps.test.ts`
Expected: PASS.

- [ ] **Step 8: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/walk/gps.ts src/walk/gps.test.ts src/walk/route.ts src/walk/route.test.ts
git commit -m "feat: Keep a walk's route as separate lines and lay it out in map space"
```

---
### Task 3: Walk time that survives clock changes (B-19)

**Files:**
- Create: `src/walk/time.ts`, `src/walk/time.test.ts`
- Modify: `src/walk/clock.ts`, `src/walk/clock.test.ts`
- Modify: `src/walk/record.ts`, `src/walk/record.test.ts`
- Modify: `src/walk/persist.ts`, `src/walk/persist.test.ts`
- Modify: `src/walk/gate.ts`, `src/walk/gate.test.ts`
- Modify: `src/walk/live.ts`, `src/walk/live.test.ts`, `src/walk/browser.ts`
- Modify: `src/walk/readout.ts` (`clockLine`), `src/screens/walk/LiveWalkScreen.tsx` (the refusal reads the change)

**Interfaces:**
- **Produces, in `time.ts`:**
  - `offsetAt(t: number): number` (minutes east of UTC on this device);
  - `isoAt(t: number, offsetMin: number): string` (ISO with that offset, `Z` for 0);
  - `nextMidnightAt(t: number, offsetMin: number): number`.
- **Produces, in `clock.ts`:**
  - `CLOCK_JUMP_MS = 120_000`;
  - `Segment` gains `accruedMs: number`, `accruedAt: number`, `day: string` and `offsetMin: number`;
  - `SegmentEnd` gains `'clockChange'`;
  - `Walk` gains `clockChangedAt?: number`;
  - `interface Clocks { wall: number; mono: number }`;
  - `stepOf(from: Clocks, to: Clocks): { ms: number; jumped: boolean }`;
  - `accrueOpen(walk: Walk, ms: number, wall: number): Walk`;
  - `splitAtClockChange(walk: Walk, wall: number, ms: number): Walk`.
- **Produces, in `live.ts`:**
  - `LivePorts.monotonic?(): number`;
  - `LivePorts.mayRun(intent: WalkIntent, walk?: Walk): boolean`.
- **Produces, in `gate.ts`:**
  - `untimedBefore(c: CheckInRecord, at: number): CheckInRecord`;
  - `walkInput(clinical: Clinical, now: Date, clockChangedAt?: number): PermissionInput`;
  - `deviceGate(...)` and `storeGate` return `(intent: WalkIntent, clockChangedAt?: number) => boolean`.
- **Produces, in `readout.ts`:** `clockLine(walk: Pick<Walk, 'clockChangedAt'>): string | undefined`.

**How time accrues.** Each tick adds the device clock's step to the open segment. When that step and the monotonic clock's step disagree by more than two minutes, the clock was changed. Then:
- the monotonic step is counted instead;
- the segment closes at the change (`endedBy: 'clockChange'`), with no gap;
- the next segment opens at the new time;
- GPS starts a fresh track;
- the walk notes `clockChangedAt`, so a restart asks for a fresh glucose reading (the conservative path).

Two reasons for using the device clock's step in the ordinary case:
- every record's interval stays in device-clock time, which overlap detection (F19) compares;
- the acceptance harness freezes `Date` between its steps while `performance.now()` keeps running, and agreement within two minutes absorbs that.

- [ ] **Step 1: Write the failing test** `src/walk/time.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { isoAt, nextMidnightAt, offsetAt } from './time';

describe('instants at a fixed offset (B-19)', () => {
  it('writes an instant at the offset it was recorded in, as `nowAt` does', () => {
    const t = Date.parse('2026-10-08T03:30:00Z');
    expect(isoAt(t, 330)).toBe('2026-10-08T09:00:00.000+05:30');
    expect(isoAt(t, -300)).toBe('2026-10-07T22:30:00.000-05:00');
    expect(isoAt(t, 0)).toBe('2026-10-08T03:30:00.000Z');
  });

  it('finds the next local midnight at that offset, after a moment already at midnight too', () => {
    expect(nextMidnightAt(Date.parse('2026-10-08T23:50:00+05:30'), 330)).toBe(Date.parse('2026-10-09T00:00:00+05:30'));
    expect(nextMidnightAt(Date.parse('2026-10-09T00:00:00+05:30'), 330)).toBe(Date.parse('2026-10-10T00:00:00+05:30'));
  });

  it('reads this device’s offset', () => {
    const t = Date.parse('2026-10-08T03:30:00Z');
    expect(offsetAt(t)).toBe(-new Date(t).getTimezoneOffset());
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/walk/time.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write** `src/walk/time.ts`

```ts
/**
 * Instants at a fixed offset (B-19): a walk's records carry the day and the
 * offset each segment was recorded in, so changing the phone's time zone
 * between walking and saving never moves a record to another day.
 */

const DAY_MS = 86_400_000;

/** Minutes east of UTC at that instant, on this device. */
export const offsetAt = (t: number): number => -new Date(t).getTimezoneOffset();

/** ISO 8601 with milliseconds at `offsetMin`, as `nowAt` writes it: `Z` for 0. */
export function isoAt(t: number, offsetMin: number): string {
  const d = new Date(t + offsetMin * 60_000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const zone = offsetMin === 0
    ? 'Z'
    : `${offsetMin > 0 ? '+' : '-'}${pad(Math.floor(Math.abs(offsetMin) / 60))}:${pad(Math.abs(offsetMin) % 60)}`;
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}${zone}`;
}

/** The first local midnight after `t` at that offset. */
export function nextMidnightAt(t: number, offsetMin: number): number {
  const local = t + offsetMin * 60_000;
  return local - (((local % DAY_MS) + DAY_MS) % DAY_MS) + DAY_MS - offsetMin * 60_000;
}
```

Run: `npx vitest run src/walk/time.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the failing clock test.** Append to `src/walk/clock.test.ts`. Add `CLOCK_JUMP_MS`, `accrueOpen`, `nextMidnight`, `splitAtClockChange`, `splitAtMidnight` and `stepOf` to its import from `./clock`, and import `toDateString` from `@/lib/utils`.

```ts
describe('time under a changed clock (B-19)', () => {
  it('takes the device clock’s step while the two clocks agree, even with the device clock frozen between steps', () => {
    expect(stepOf({ wall: s(0), mono: 0 }, { wall: s(1), mono: 1000 })).toEqual({ ms: 1000, jumped: false });
    expect(stepOf({ wall: s(0), mono: 0 }, { wall: s(60), mono: 1000 })).toEqual({ ms: 60_000, jumped: false });
    expect(stepOf({ wall: s(0), mono: 0 }, { wall: s(0), mono: 900 })).toEqual({ ms: 0, jumped: false });
  });

  it('takes the monotonic step, and says the clock changed, when they disagree by more than two minutes', () => {
    expect(CLOCK_JUMP_MS).toBe(120_000);
    expect(stepOf({ wall: s(0), mono: 0 }, { wall: s(-3600), mono: 1000 })).toEqual({ ms: 1000, jumped: true });
    expect(stepOf({ wall: s(0), mono: 0 }, { wall: s(3600), mono: 1000 })).toEqual({ ms: 1000, jumped: true });
  });

  it('closes the segment at a change of clock and opens the next at the new time, with no gap and nothing lost', () => {
    let w = accrueOpen(walkFor(), 600_000, s(600));
    w = splitAtClockChange(w, s(600) - 3_600_000, 1000);
    expect(w.segments.map(x => [x.endedBy, x.accruedMs])).toEqual([['clockChange', 601_000], [undefined, 0]]);
    expect(w.segments[1].start).toBe(s(600) - 3_600_000);
    expect(w.gaps).toEqual([]);
    expect(w.clockChangedAt).toBe(s(600) - 3_600_000);
    expect(observedMs(w, s(600) - 3_600_000 + 5000)).toBe(606_000);
  });

  it('accrues tick by tick, so a close adds only what came after the last tick', () => {
    let w = accrueOpen(walkFor(), 10_000, s(10));
    w = pauseWalk(w, s(12));
    expect(w.segments[0].accruedMs).toBe(12_000);
  });

  it('stamps each segment with the local day and offset it began in', () => {
    const w = walkFor();
    expect(w.segments[0].day).toBe(toDateString(new Date(s(0))));
    expect(w.segments[0].offsetMin).toBe(-new Date(s(0)).getTimezoneOffset());
  });

  it('moves time accrued past midnight into the new day’s segment', () => {
    const mid = nextMidnight(T);
    let w = startWalk('abc-123', PLAN, mid - 60_000);
    w = accrueOpen(w, 90_000, mid + 30_000);
    w = splitAtMidnight(w, mid + 30_000);
    expect(w.segments.map(x => x.accruedMs)).toEqual([60_000, 30_000]);
    expect(w.segments[1].day).not.toBe(w.segments[0].day);
  });
});
```

- [ ] **Step 5: Run it to check it fails**

Run: `npx vitest run src/walk/clock.test.ts`
Expected: FAIL. `stepOf` doesn't exist.

- [ ] **Step 6: The clock.** In `src/walk/clock.ts`, import `toDateString` from `@/lib/utils` and `offsetAt` from `./time`, then make these changes.

  - `SegmentEnd` becomes `'paused' | 'hidden' | 'left' | 'interrupted' | 'midnight' | 'clockChange' | 'finished'`.
  - `Segment` gains:

```ts
  /** Time observed in this segment (B-19), accrued tick by tick: a change to the clock never stretches or shrinks it. */
  accruedMs: number;
  /** The device-clock moment the accrual has reached. */
  accruedAt: number;
  /** The local day the segment began on and its UTC offset in minutes (B-19, F17): what its records carry, wherever they are saved. */
  day: string;
  offsetMin: number;
```

  - `Walk` gains `/** B-19: when this walk saw the phone's clock change. A restart then asks for a fresh reading. */ clockChangedAt?: number;`.
  - Add, after `REMOUNT_GRACE_MS`:

```ts
/** B-19: the device clock and the monotonic one disagreeing by more than this in one step is a change to the clock. */
export const CLOCK_JUMP_MS = 120_000;

/** The two clocks at one moment. */
export interface Clocks { wall: number; mono: number }

/**
 * One accrual step (B-19): the device clock's step while the two clocks agree,
 * or the monotonic step when they don't — and then the clock was changed.
 */
export function stepOf(from: Clocks, to: Clocks): { ms: number; jumped: boolean } {
  const wall = to.wall - from.wall;
  const mono = to.mono - from.mono;
  if (Math.abs(wall - mono) > CLOCK_JUMP_MS) return { ms: Math.max(0, mono), jumped: true };
  return { ms: Math.max(0, wall), jumped: false };
}
```

  - Replace `emptySegment`, `closeOpen` and `segmentMs`:

```ts
function emptySegment(start: number): Segment {
  return { start, gps: [], steps: 0, motion: false, accruedMs: 0, accruedAt: start, day: toDateString(new Date(start)), offsetMin: offsetAt(start) };
}

/** A segment closed at `at`: its accrual reaches `at` from where the last tick left it. */
function closed(s: Segment, at: number, endedBy: SegmentEnd): Segment {
  // A clock that stepped backwards must not produce a negative segment.
  return { ...s, end: Math.max(s.start, at), endedBy, accruedMs: s.accruedMs + Math.max(0, at - s.accruedAt), accruedAt: Math.max(s.accruedAt, at) };
}

function closeOpen(walk: Walk, at: number, endedBy: SegmentEnd): Segment[] {
  return walk.segments.map((s, i) => (i === walk.segments.length - 1 && s.end === undefined ? closed(s, at, endedBy) : s));
}

function segmentMs(s: Segment, now: number): number {
  return s.end !== undefined ? s.accruedMs : s.accruedMs + Math.max(0, now - s.accruedAt);
}
```

  - Add after `updateOpenSegment`:

```ts
/** Add `ms` to the segment being recorded, its accrual reaching `wall` (B-19). */
export function accrueOpen(walk: Walk, ms: number, wall: number): Walk {
  return updateOpenSegment(walk, s => ({ ...s, accruedMs: s.accruedMs + ms, accruedAt: wall }));
}

/**
 * The phone's clock changed (B-19): the open segment closes at the change, in
 * the clock it was recorded by, with `ms` (the monotonic step) counted; the
 * next opens at the new time. No gap: the walk was watched throughout.
 */
export function splitAtClockChange(walk: Walk, wall: number, ms: number): Walk {
  const open = walk.status === 'running' ? openSegment(walk) : undefined;
  if (!open) return walk;
  const end = open.accruedAt + ms;
  const before: Segment = { ...open, end: Math.max(open.start, end), endedBy: 'clockChange', accruedMs: open.accruedMs + ms, accruedAt: end };
  return { ...walk, clockChangedAt: walk.clockChangedAt ?? wall, segments: [...walk.segments.slice(0, -1), before, emptySegment(wall)] };
}
```

  - Replace the body of `splitAtMidnight`'s loop with:

```ts
    const open = next.status === 'running' ? openSegment(next) : undefined;
    if (!open) return next;
    const boundary = nextMidnight(open.start);
    if (boundary > now) return next;
    // Time accrued past midnight belongs to the new day's segment.
    const reached = open.accruedMs + Math.max(0, boundary - open.accruedAt);
    const excess = Math.min(reached, Math.max(0, open.accruedAt - boundary));
    const before: Segment = { ...open, end: boundary, endedBy: 'midnight', accruedMs: reached - excess, accruedAt: boundary };
    const after: Segment = { ...emptySegment(boundary), accruedMs: excess, accruedAt: Math.max(boundary, open.accruedAt) };
    next = { ...next, segments: [...next.segments.slice(0, -1), before, after] };
```

  `returnToWalk`'s reopen (the remount grace) keeps the closed segment's `accruedMs` and `accruedAt`, so the accrual carries on from where it stopped. Nothing else in the file changes: every transition goes through `closeOpen`.

- [ ] **Step 7: Run the clock tests**

Run: `npx vitest run src/walk/clock.test.ts`
Expected: PASS, every existing test included. With no accrual between transitions, a close adds the whole span, as before.

- [ ] **Step 8: Records at each segment's own offset.** In `src/walk/record.ts`, import `isoAt` and `nextMidnightAt` from `./time`, then:
  - `const segmentMs = (s: Segment) => s.accruedMs;`. Import `type Segment` from `./clock`. `summarise` adds up `s.accruedMs`;
  - `byDay(start, end, offsetMin)` and `crossesMidnight(start, end, offsetMin)` use `nextMidnightAt(from, offsetMin)` in place of `nextMidnight(from)`;
  - in `walkObservations`, per segment:
    - skip it when `s.accruedMs < MIN_RECORD_MS`;
    - make its pieces with the code below;
    - every `at` becomes `isoAt(…, s.offsetMin)`;
    - the steps record's `coverageMs` becomes `s.accruedMs`;
  - gaps take the offset of the segment before them: `const offsetOf = (t: number) => (walk.segments.filter(x => x.start <= t).at(-1) ?? walk.segments[0]).offsetMin;`. Use it in `byDay` and `isoAt` for each gap;
  - `mealStartedAt` becomes `isoAt(walk.plan.meal.startedAt, walk.segments[0].offsetMin)`.

```ts
    const end = s.end ?? s.start;
    // Cut at each local midnight of the offset the segment was recorded in (F17, B-19); a segment
    // whose accrued time and span disagree (it can't, since clock changes split segments) is one record.
    const pieces = Math.abs((end - s.start) - s.accruedMs) <= 1000 ? byDay(s.start, end, s.offsetMin) : [{ start: s.start, end: s.start + s.accruedMs }];
```

Append to `src/walk/record.test.ts`, and import `isoAt` from `./time`:

```ts
describe('records at the offset each segment was recorded in (B-19)', () => {
  it('dates a segment’s records at its own offset, wherever they are saved', () => {
    let w = startWalk('mgh3k2x1-1a2b3c4d', { kind: 'walk', gps: false, steps: false }, s(0));
    w = { ...w, segments: w.segments.map(x => ({ ...x, offsetMin: 330 })) };
    w = finishWalk(w, s(600), 'finish');
    const [duration] = byKind(walkObservations(w), 'walkDuration');
    expect(duration.at).toBe(isoAt(s(0), 330));
    expect(duration.at?.endsWith('+05:30')).toBe(true);
    expect(duration.coverageMs).toBe(600_000);
  });
});
```

Run: `npx vitest run src/walk/record.test.ts`
Expected: PASS.

- [ ] **Step 9: Keep and upgrade the new fields.** In `src/walk/persist.ts`, import `isDay` from `@/health/observation`, `toDateString` from `@/lib/utils` and `offsetAt` from `./time`, then:
  - add `'clockChange'` to `SEGMENT_ENDS`;
  - in `isSegment`, before its `return`, add the checks below;
  - add `upgraded`, below;
  - `parseWalk` refuses a `clockChangedAt` that isn't `isTime`, and returns `{ ...(raw as unknown as Walk), segments: segments.map(s => upgraded(s, raw.seenAt as number)) }`.

```ts
  // B-19's fields, when present. A draft from an older build has none; `upgraded` fills them in.
  if (v.accruedMs !== undefined && !isAmount(v.accruedMs)) return false;
  if (v.accruedAt !== undefined && !isTime(v.accruedAt)) return false;
  if (v.day !== undefined && !isDay(v.day)) return false;
  if (v.offsetMin !== undefined && !(Number.isInteger(v.offsetMin) && Math.abs(v.offsetMin as number) <= 14 * 60)) return false;
```

```ts
/** A segment kept before B-19: its accrual is its span, its day and offset this device's. */
function upgraded(s: Segment, seenAt: number): Segment {
  const old = s as Partial<Segment> & Pick<Segment, 'start'>;
  const reached = s.end ?? Math.max(s.start, seenAt);
  return {
    ...s,
    accruedMs: old.accruedMs ?? reached - s.start,
    accruedAt: old.accruedAt ?? reached,
    day: old.day ?? toDateString(new Date(s.start)),
    offsetMin: old.offsetMin ?? offsetAt(s.start),
  };
}
```

Append to `src/walk/persist.test.ts`, and import `type Segment` from `./clock`:

```ts
describe('walks kept before B-19', () => {
  const strip = (x: Segment) => {
    const { accruedMs, accruedAt, day, offsetMin, ...rest } = x;
    void accruedMs; void accruedAt; void day; void offsetMin;
    return rest;
  };

  it('are read with their accrued time, day and offset filled in', () => {
    const w = aWalk();
    const back = parseWalk(JSON.parse(JSON.stringify({ ...w, segments: w.segments.map(strip) })))!;
    expect(back.segments[0].accruedMs).toBe(300_000);
    expect(back.segments[1].accruedAt).toBe(w.seenAt);
    expect(back.segments[0].day).toBe(w.segments[0].day);
  });

  it('refuse an accrual that cannot be read', () => {
    const w = aWalk();
    expect(parseWalk({ ...w, segments: [{ ...w.segments[0], accruedMs: -1 }, w.segments[1]] })).toBeNull();
  });
});
```

Run: `npx vitest run src/walk/persist.test.ts`
Expected: PASS.

- [ ] **Step 10: The conservative gate.** In `src/walk/gate.ts`:
  - add `untimedBefore`, below;
  - give `walkInput` a third argument;
  - give `deviceGate`'s returned function a second parameter, `(intent: WalkIntent, clockChangedAt?: number)`, passed to `walkInput(memo.clinical, at, clockChangedAt)`;
  - make the same change in `clinicalGate`.

```ts
/**
 * B-19: once a walk has seen the phone's clock change, a glucose reading timed
 * before the change has no age the app can trust. The engine is asked as if
 * its time were unknown, which with insulin or a sulfonylurea asks for a fresh
 * reading; for anyone else nothing changes.
 */
export function untimedBefore(c: CheckInRecord, at: number): CheckInRecord {
  const g = c.glucose;
  if (!g?.measuredAt || !(Date.parse(g.measuredAt) < at)) return c;
  const { measuredAt: _untimed, ...rest } = g;
  void _untimed;
  return { ...c, glucose: rest };
}

/** The engine's input at `now`: today's effective record as the check-in, every day's as the earlier ones. */
export function walkInput(clinical: Clinical, now: Date, clockChangedAt?: number): PermissionInput {
  const today = toDateString(now);
  const found = clinical.checkIns.find(c => c.date === today);
  const checkIn = found && clockChangedAt !== undefined ? untimedBefore(found, clockChangedAt) : found;
  return { profile: clinical.profile, now, ...(checkIn ? { checkIn } : {}), recent: [...clinical.checkIns] };
}
```

Append to `src/walk/gate.test.ts`, which already has `onInsulin`, `checkIn`, `NOW` and `minutesBefore`. Import `PERMISSION_TEXT` from `@/engine/permission`.

```ts
describe('a change to the phone’s clock mid-walk (B-19, the conservative path)', () => {
  const clinical = {
    profile: onInsulin,
    checkIns: [checkIn({ glucose: { value: 140, unit: 'mg/dL', measuredAt: minutesBefore(NOW, 10), source: 'meter' } })],
  };

  it('lets a restart go on a reading taken 10 minutes ago', () => {
    expect(walkRefusal(walkInput(clinical, NOW), 'restart')).toBeUndefined();
  });

  it('treats a reading taken before the change as untimed, so a restart asks for a fresh one', () => {
    expect(walkRefusal(walkInput(clinical, NOW, NOW.getTime() - 60_000), 'restart')?.reasons).toContain(PERMISSION_TEXT.staleNoTime);
  });

  it('leaves walking under way alone: the starting checks are not the live question', () => {
    expect(walkRefusal(walkInput(clinical, NOW, NOW.getTime() - 60_000), 'live')).toBeUndefined();
  });

  it('keeps a reading taken after the change', () => {
    expect(walkRefusal(walkInput(clinical, NOW, NOW.getTime() - 20 * 60_000), 'restart')).toBeUndefined();
  });
});
```

Run: `npx vitest run src/walk/gate.test.ts`
Expected: PASS.

- [ ] **Step 11: The controller accrues.** In `src/walk/live.ts`, import `accrueOpen`, `splitAtClockChange` and `stepOf` from `./clock`, then:
  - `LivePorts.mayRun` becomes `mayRun(intent: WalkIntent, walk?: Walk): boolean`;
  - `LivePorts` gains `/** The monotonic clock, ms (B-19). Absent: the device clock, so no change is ever seen. */ monotonic?(): number;`;
  - inside `createLiveWalk`, add the code below;
  - replace every call to `catchUpMidnight(now)` (in `onFix`, `onSample`, `holdBack`, `tick`, `onVisibility`, `detach`, `pause` and `finish`) with `advance(now)`. Find them with `grep -n "catchUpMidnight(now)" src/walk/live.ts`;
  - at the start of `startSensors`, after its `if (!walk || !segment) return;`, add `monoAt = mono();`;
  - the private `mayRun` asks `ports.mayRun(intent, walk ?? undefined)`, and so does `reconsider`'s held branch.

```ts
  const mono = () => ports.monotonic?.() ?? ports.now();
  /** The monotonic reading at the moment the open segment's accrual last reached `accruedAt`. */
  let monoAt: number | undefined;

  /**
   * Bring the open segment's time up to now (B-19). A step on which the device
   * clock and the monotonic clock disagree is a change to the clock: the
   * monotonic step counts, the segment closes at the change, and GPS starts a
   * fresh track from the new time, since fixes now carry it.
   */
  function accrueNow(now: number) {
    const open = walk && walk.status === 'running' ? openSegment(walk) : undefined;
    if (!walk || !open) return;
    const m = mono();
    const step = stepOf({ wall: open.accruedAt, mono: monoAt ?? m }, { wall: now, mono: m });
    monoAt = m;
    if (!step.jumped) {
      walk = accrueOpen(walk, step.ms, now);
      return;
    }
    walk = splitAtClockChange(walk, now, step.ms);
    if (track) {
      track = createTrack(now);
      trackBase = [];
    }
  }

  /** What every sensor callback and transition does first: accrue, then split at local midnight. Says whether a segment closed (either split opens a new one). */
  function advance(now: number): boolean {
    const before = walk?.segments.length ?? 0;
    accrueNow(now);
    catchUpMidnight(now);
    return (walk?.segments.length ?? 0) !== before;
  }
```

- [ ] **Step 12: The fake world keeps a monotonic clock.** In `src/walk/live.test.ts`'s `world()`, time now passes on a monotonic clock, as `setTimeout` does:
  - add `let skew = 0;`;
  - add `monotonic: () => now - skew,` to `ports`;
  - `later` stores `at: now - skew + ms`;
  - `advance` compares and runs timers on `now - skew`. Its `end` is `now - skew + ms`, it sets `now = Math.max(now, due.at + skew)` before each timer, and `now = end + skew` at the end;
  - `mayRun` also records `asked.push(intent)` with the walk, in a new `const askedWith: (number | undefined)[] = []` that holds `walk?.clockChangedAt`;
  - return `jumpClock(ms: number) { now += ms; skew += ms; }` and `get askedWith() { return askedWith; }`.

  Then append:

```ts
describe('a change to the phone’s clock mid-walk (B-19)', () => {
  it('keeps the time recorded right, splits the segment at the change, and takes fixes in the new clock', () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    walkFor(w, 60, 0);
    w.jumpClock(-3_600_000);
    w.advance(1000);
    walkFor(w, 30, 80);
    const snap = live.getSnapshot()!;
    expect(snap.observedMs).toBe(91_000);
    expect(snap.walk.segments.map(s => s.endedBy)).toEqual(['clockChange', undefined]);
    expect(snap.walk.clockChangedAt).toBeDefined();
    expect(snap.walk.segments[1].gps.length).toBeGreaterThan(0);
  });

  it('asks the gate about a restart with the change it saw', () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    w.advance(30_000);
    w.jumpClock(3_600_000);
    w.advance(1000);
    live.pause();
    live.resume();
    expect(w.asked.at(-1)).toBe('restart');
    expect(w.askedWith.at(-1)).toBeDefined();
  });
});
```

Run: `npx vitest run src/walk/live.test.ts`
Expected: PASS, every existing test included. With no jump the two clocks agree, so accrual equals the old timestamp arithmetic.

- [ ] **Step 13: The real ports.** In `src/walk/browser.ts`'s `browserPorts`:

```ts
    mayRun: (intent, walk) => storeGate(intent, walk?.clockChangedAt),
    monotonic: () => performance.now(),
```

- [ ] **Step 14: Say so on a held walk.** In `src/walk/readout.ts`:

```ts
/** On a held walk after a change to the phone's clock (B-19). */
export function clockLine(walk: Pick<Walk, 'clockChangedAt'>): string | undefined {
  return walk.clockChangedAt === undefined
    ? undefined
    : 'Your phone’s clock changed during this walk, so a reading from before the change can’t be timed. Check your glucose again to carry on.';
}
```

In `src/screens/walk/LiveWalkScreen.tsx`:
- the refusal becomes `walkRefusal(walkInput(clinical, new Date(snapshot.now), snapshot.walk.clockChangedAt), question)`;
- inside the hold card, after the release line, add `{clockLine(snapshot.walk) && <p className="text-muted-foreground">{clockLine(snapshot.walk)}</p>}`.

- [ ] **Step 15: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/walk src/screens/walk/LiveWalkScreen.tsx
git commit -m "feat: Accrue walk time across clock changes and date records at their own offset"
```

---
### Task 4: The journal, the live route, and saving a walk in one transaction

**Files:**
- Create: `src/walk/journal.ts`, `src/walk/journal.test.ts`
- Create: `src/walk/journalPort.ts`
- Create: `src/walk/save.ts`, `src/walk/save.test.ts`
- Modify: `src/walk/clock.ts` (`WalkPlan.keepRoute`), `src/walk/plan.ts`, `src/walk/plan.test.ts`, `src/walk/persist.ts`
- Modify: `src/walk/live.ts`, `src/walk/live.test.ts`, `src/walk/browser.ts`
- Modify: `src/store/useStore.ts`, `src/store/useStore.test.ts`

**Interfaces:**
- **Consumes:**
  - `JOURNAL_STORE` and `Change.journal` (Task 1);
  - `routeRecord`, `RouteLine` and `LatLon` (Task 1);
  - `createTrack(start, { route: true })`, `Track.lines`, `Track.here` and `Track.forgetPoints()` (Task 2);
  - `isoAt` (Task 3).
- **Produces, in `journal.ts`:**
  - `JOURNAL_VERSION = 1`, `CHECKPOINT_MS = 15_000` and `JOURNAL_STALE_MS = 120_000`;
  - `interface JournalEntry { id: string; version: 1; at: number; walk: Walk; route?: RouteLine[] }`;
  - `journalEntry(walk: Walk, at: number, route?: readonly RouteLine[]): JournalEntry`;
  - `checkpointDue(last: number | undefined, now: number): boolean`;
  - `parseJournalEntry(raw: unknown): JournalEntry | null`.
- **Produces, in `live.ts`:**
  - `interface JournalPort { checkpoint(entry: JournalEntry): Promise<StoreResult>; read(id: string): Promise<JournalEntry | undefined> }`;
  - `LivePorts.journal?: JournalPort`;
  - `LiveSnapshot.route: RouteLine[]`, `LiveSnapshot.here?: LatLon` and `LiveSnapshot.journalFull: boolean`;
  - `LiveWalk.forgetRoute(): void`.
- **Produces, in `clock.ts` and `plan.ts`:**
  - `WalkPlan.keepRoute?: boolean`;
  - `liveHref` writes `route=1`, and `walkFromSearch` reads it (only with `gps=1`).
- **Produces, in `useStore.ts`:**
  - `putWalkJournal(entry: JournalEntry): Promise<StoreResult>`;
  - `readWalkJournals(): Promise<StoreResult<JournalEntry[]>>`;
  - `retireWalkJournals(ids: readonly string[]): Promise<StoreResult>`;
  - `interface SaveWalkInput { walkId: string; observations: readonly WalkInput[]; route?: RouteRecord }`;
  - `saveWalk(input: SaveWalkInput): Promise<StoreResult>`;
  - `removeWalk(walkId: string, observationIds: readonly string[]): Promise<StoreResult>`.
- **Produces, in `journalPort.ts`:**
  - `journalPort(): JournalPort`;
  - `cachedJournal(id: string): JournalEntry | undefined`;
  - `forgetCachedRoutes(): void`.
- **Produces, in `save.ts`:** `walkSave(walk: Walk, extra?: { route?: readonly RouteLine[]; energy?: WalkInput }): SaveWalkInput`.

**How it fits together:**
- The tab's draft (`sessionStorage`, v1) still carries the walk across a reload of the same tab. It never holds a position.
- The journal (IndexedDB `walkJournal`) carries the walk across an app that was closed or crashed. Its route is there only when the person keeps routes.
- The journal is written straight to its store, outside the record, so it moves no revision and reaches no other tab or backup.
- `saveWalk` retires it in the transaction that writes the walk and its route, so a crash leaves the journal or the saved walk, never both and never neither (A-55, V-J34).

- [ ] **Step 1: The plan carries the consent.** In `src/walk/clock.ts`, add to `WalkPlan`:

```ts
  /** The person keeps routes on this phone (§9.1): the route is journalled while walking and saved with the walk. */
  keepRoute?: boolean;
```

Then:
- in `src/walk/plan.ts`'s `liveHref`, add `if (plan.keepRoute) q.set('route', '1');`;
- in `walkFromSearch`'s returned plan, add `...(search.get('route') === '1' && search.get('gps') === '1' ? { keepRoute: true } : {})`;
- in `src/walk/persist.ts`'s `isPlan`, before `return true`, add `if (v.keepRoute !== undefined && typeof v.keepRoute !== 'boolean') return false;`.

Append to `src/walk/plan.test.ts`:

```ts
describe('keeping the route (§9.1)', () => {
  it('travels in the live walk’s address, and only with GPS', () => {
    const href = liveHref('mgh3k2x1-1a2b3c4d', { kind: 'walk', gps: true, steps: false, keepRoute: true });
    expect(href).toContain('route=1');
    const back = walkFromSearch(new URLSearchParams(href.split('?')[1]), Date.now());
    expect(back?.plan.keepRoute).toBe(true);
    expect(walkFromSearch(new URLSearchParams('id=mgh3k2x1-1a2b3c4d&route=1'), Date.now())?.plan.keepRoute).toBeUndefined();
  });
});
```

- [ ] **Step 2: Write the failing test** `src/walk/journal.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { finishWalk, startWalk } from './clock';
import { CHECKPOINT_MS, checkpointDue, journalEntry, parseJournalEntry } from './journal';
import type { RouteLine } from './routeRecord';

const T = Date.UTC(2026, 9, 8, 13, 0, 0);
const W = startWalk('mgh3k2x1-1a2b3c4d', { kind: 'walk', gps: true, steps: false, keepRoute: true }, T);
const LINE: RouteLine = { start: T, end: T + 20_000, coords: [[12.97, 77.59], [12.9705, 77.5902], [12.971, 77.5905]], ms: [0, 10_000, 20_000] };

describe('the walk journal (journey §9.4, §18.2)', () => {
  it('checkpoints at once the first time, then every 15 seconds', () => {
    expect(checkpointDue(undefined, T)).toBe(true);
    expect(checkpointDue(T, T + CHECKPOINT_MS - 1)).toBe(false);
    expect(checkpointDue(T, T + CHECKPOINT_MS)).toBe(true);
  });

  it('round-trips an entry with its route, leaving out lines too short to draw', () => {
    const entry = journalEntry(W, T + 5000, [LINE, { start: T, end: T, coords: [[1, 1]], ms: [0] }]);
    expect(entry.route).toHaveLength(1);
    expect(parseJournalEntry(JSON.parse(JSON.stringify(entry)))).toEqual(entry);
  });

  it('keeps no route for a walk whose route is not kept', () => {
    expect('route' in journalEntry(W, T)).toBe(false);
  });

  it('drops anything it cannot trust, rather than guessing', () => {
    const entry = journalEntry(W, T, [LINE]);
    expect(parseJournalEntry({ ...entry, version: 2 })).toBeNull();
    expect(parseJournalEntry({ ...entry, id: 'another-walk' })).toBeNull();
    expect(parseJournalEntry({ ...entry, route: [{ ...LINE, ms: [0] }] })).toBeNull();
    expect(parseJournalEntry({ ...entry, walk: { ...W, segments: [] } })).toBeNull();
    expect(parseJournalEntry(finishWalk(W, T + 1, 'finish'))).toBeNull();
  });
});
```

Run: `npx vitest run src/walk/journal.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write** `src/walk/journal.ts`

```ts
/**
 * A walk's recovery state, kept in IndexedDB while it is recorded (journey
 * §9.4, §18.2). It always holds the walk's clock and totals, and holds its
 * route only when the person keeps routes. It isn't part of the record and is
 * never in a backup. It is retired in the transaction that saves the walk
 * (A-55), so a crash leaves the journal or the saved walk, never both.
 */
import type { Walk } from './clock';
import { parseWalk } from './persist';
import { lineProblem, type RouteLine } from './routeRecord';

export const JOURNAL_VERSION = 1;
/** Written at least this often while the walk screen is open, and at every change of state. */
export const CHECKPOINT_MS = 15_000;
/** Older than this, nothing is recording the walk: a desktop tab in the background still writes about once a minute. */
export const JOURNAL_STALE_MS = 120_000;

export interface JournalEntry {
  /** The walk's id. */
  id: string;
  version: 1;
  /** The device-clock moment of this checkpoint. */
  at: number;
  walk: Walk;
  /** Only while the person keeps routes. */
  route?: RouteLine[];
}

const copy = (l: RouteLine): RouteLine => ({ ...l, coords: [...l.coords], ms: [...l.ms] });

export function journalEntry(walk: Walk, at: number, route?: readonly RouteLine[]): JournalEntry {
  return { id: walk.id, version: JOURNAL_VERSION, at, walk, ...(route ? { route: route.filter(l => l.coords.length >= 2).map(copy) } : {}) };
}

export const checkpointDue = (last: number | undefined, now: number): boolean => last === undefined || now - last >= CHECKPOINT_MS;

/** A stored checkpoint, or nothing if any part of it can't be trusted. */
export function parseJournalEntry(raw: unknown): JournalEntry | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.version !== JOURNAL_VERSION || typeof r.at !== 'number' || !Number.isFinite(r.at)) return null;
  const walk = parseWalk(r.walk);
  if (!walk || walk.id !== r.id) return null;
  if (r.route !== undefined && !(Array.isArray(r.route) && r.route.every(l => lineProblem(l) === undefined))) return null;
  return { id: walk.id, version: JOURNAL_VERSION, at: r.at, walk, ...(r.route ? { route: r.route as RouteLine[] } : {}) };
}
```

Run: `npx vitest run src/walk/journal.test.ts`
Expected: PASS.

- [ ] **Step 4: The journal and the save in the store.** In `src/store/useStore.ts`:
  - import `JOURNAL_STORE` from `./db`;
  - import `parseJournalEntry` and `type JournalEntry` from `@/walk/journal`;
  - import `type RouteRecord` from `@/walk/routeRecord`;
  - import `type WalkInput` from `@/walk/record`;
  - add the functions below after `removeRecords`.

```ts
// ============================================================================
// A walk: its recovery journal, and saving it with its route (journey §9.4, §18.3)
// ============================================================================

/**
 * A walk's recovery checkpoint, written straight to the journal store: outside
 * the record, so it moves no revision and reaches no other tab or backup.
 * Nothing is kept while storage is unavailable.
 */
export function putWalkJournal(entry: JournalEntry): Promise<StoreResult> {
  const handle = db;
  if (!handle) return Promise.resolve({ ok: false, failure: unavailableFailure() });
  return handle.transact(tx => tx.put(JOURNAL_STORE, entry));
}

/** Every readable checkpoint on this device. One that can't be read is left out, never guessed. */
export async function readWalkJournals(): Promise<StoreResult<JournalEntry[]>> {
  const handle = db;
  if (!handle) return { ok: true, value: [] };
  try {
    const rows = await handle.getAll<unknown>(JOURNAL_STORE);
    return { ok: true, value: rows.map(parseJournalEntry).filter((e): e is JournalEntry => e !== null) };
  } catch (error) {
    return { ok: false, failure: toFailure(error, 'readFailed') };
  }
}

/** Retire checkpoints whose walks are already saved: tidying, never a walk. */
export function retireWalkJournals(ids: readonly string[]): Promise<StoreResult> {
  const handle = db;
  if (!handle || ids.length === 0) return Promise.resolve({ ok: true, value: undefined });
  return handle.transact(tx => { for (const id of ids) tx.delete(JOURNAL_STORE, id); });
}

export interface SaveWalkInput {
  walkId: string;
  /** Every record of the walk, with stable ids (`walkObservations`). Those already stored are left as they are. */
  observations: readonly WalkInput[];
  /** Only when the person keeps routes. */
  route?: RouteRecord;
}

/**
 * A walk, its route and the retirement of its recovery state, in one
 * transaction (journey §18.3, A-55). A retry, or a second tap, writes only
 * what is missing; the journal goes either way.
 */
export function saveWalk(input: SaveWalkInput): Promise<StoreResult> {
  const fixed = input.observations.map(o => ({ ...o, at: o.at ?? nowAt() }));
  return enqueue<void>({
    plan: base => {
      const wanted = new Set(fixed.map(o => o.id));
      const held = new Set(base.observations.filter(o => wanted.has(o.id)).map(o => o.id));
      const records = fixed.filter(o => !held.has(o.id)).map(o => newObservation(o));
      let route: StoredRecord | undefined;
      if (input.route) {
        const problem = recordProblem('routes', input.route);
        if (problem) throw new StoreFailure('invalid', `The route could not be saved: ${problem}.`);
        if (!base.records.routes.some(r => r.walkId === input.walkId)) route = input.route as unknown as StoredRecord;
      }
      return {
        change: {
          ...(records.length > 0 ? { observations: { put: records } } : {}),
          ...(route ? { records: { routes: { put: [route] } } } : {}),
          journal: { remove: [input.walkId] },
        },
        result: () => undefined,
      };
    },
  });
}

/** A walk, its route and its recovery state gone in one transaction (F09). Only the observations named go; the walk's pain ratings can stay. */
export function removeWalk(walkId: string, observationIds: readonly string[]): Promise<StoreResult> {
  const wanted = new Set(observationIds);
  return enqueue<void>({
    plan: base => {
      const present = base.observations.filter(o => wanted.has(o.id)).map(o => o.id);
      const route = base.records.routes.some(r => r.walkId === walkId);
      return {
        change: {
          ...(present.length > 0 ? { observations: { remove: present } } : {}),
          ...(route ? { records: { routes: { remove: [walkId] } } } : {}),
          journal: { remove: [walkId] },
        },
        result: () => undefined,
      };
    },
  });
}
```

- [ ] **Step 5: Store tests.** Append to `src/store/useStore.test.ts`, importing:
  - `finishWalk` and `startWalk` from `@/walk/clock`;
  - `journalEntry` from `@/walk/journal`;
  - `walkObservations` from `@/walk/record`.

```ts
describe('saving a walk with its route and its journal (journey §18.3, A-55)', () => {
  const WALK = 'mgh3k2x1-1a2b3c4d';
  const T = Date.UTC(2026, 9, 8, 3, 30, 0);
  const LINE = { start: T, end: T + 20_000, coords: [[12.97, 77.59], [12.9705, 77.5902], [12.971, 77.5905]] as [number, number][], ms: [0, 10_000, 20_000] };
  const ROUTE = { walkId: WALK, version: 1 as const, startedAt: '2026-10-08T09:00:00.000+05:30', segments: [LINE], bbox: [12.97, 77.59, 12.971, 77.5905] as [number, number, number, number] };
  const walked = () => finishWalk(startWalk(WALK, { kind: 'walk', gps: true, steps: false, keepRoute: true }, T), T + 600_000, 'finish');
  const ofWalk = () => store.getState().observations.filter(o => o.context === `walk:${WALK}`);

  it('writes the records and the route, and retires the journal, together and once', async () => {
    await booted();
    expect((await store.putWalkJournal(journalEntry(walked(), T + 600_000))).ok).toBe(true);
    const input = { walkId: WALK, observations: walkObservations(walked()), route: ROUTE };
    expect((await store.saveWalk(input)).ok).toBe(true);
    expect((await store.saveWalk(input)).ok).toBe(true);
    expect(ofWalk()).toHaveLength(walkObservations(walked()).length);
    expect(store.getState().records.routes.map(r => r.walkId)).toEqual([WALK]);
    const left = await store.readWalkJournals();
    expect(left.ok && left.value).toEqual([]);
  });

  it('leaves everything as it was when the save fails: no records, no route, the journal kept (V-J34)', async () => {
    await booted({ quotaAfter: 0, quotaStore: 'routes' });
    await store.putWalkJournal(journalEntry(walked(), T));
    const result = await store.saveWalk({ walkId: WALK, observations: walkObservations(walked()), route: ROUTE });
    expect(!result.ok && result.failure.code).toBe('quotaExceeded');
    expect(ofWalk()).toEqual([]);
    expect(store.getState().records.routes).toEqual([]);
    const left = await store.readWalkJournals();
    expect(left.ok && left.value.map(e => e.id)).toEqual([WALK]);
  });

  it('removes a walk, its route and its journal together', async () => {
    await booted();
    await store.saveWalk({ walkId: WALK, observations: walkObservations(walked()), route: ROUTE });
    await store.putWalkJournal(journalEntry(walked(), T));
    expect((await store.removeWalk(WALK, ofWalk().map(o => o.id))).ok).toBe(true);
    expect(ofWalk()).toEqual([]);
    expect(store.getState().records.routes).toEqual([]);
    const left = await store.readWalkJournals();
    expect(left.ok && left.value).toEqual([]);
  });
});
```

Run: `npx vitest run src/store/useStore.test.ts`
Expected: PASS.

- [ ] **Step 6: What saving writes.** Write the failing test `src/walk/save.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { finishWalk, startWalk, updateOpenSegment } from './clock';
import { walkObservations } from './record';
import { walkSave } from './save';
import type { RouteLine } from './routeRecord';

const T = Date.UTC(2026, 9, 8, 13, 0, 0);
const LINE: RouteLine = { start: T + 1000, end: T + 21_000, coords: [[12.97, 77.59], [12.9705, 77.5902], [12.971, 77.5905]], ms: [0, 10_000, 20_000] };
const walked = (keepRoute: boolean) => finishWalk(
  updateOpenSegment(startWalk('mgh3k2x1-1a2b3c4d', { kind: 'walk', gps: true, steps: false, keepRoute }, T), s => ({ ...s, gps: [{ start: T + 1000, end: T + 21_000, distanceM: 120 }] })),
  T + 600_000, 'finish');

describe('what saving a walk writes (journey §18.3)', () => {
  it('writes the walk’s records, and its route only when the person keeps routes', () => {
    const kept = walkSave(walked(true), { route: [LINE] });
    expect(kept.observations).toEqual(walkObservations(walked(true)));
    expect(kept.route).toMatchObject({ walkId: 'mgh3k2x1-1a2b3c4d', segments: [LINE] });
    expect(walkSave(walked(false), { route: [LINE] }).route).toBeUndefined();
    expect(walkSave(walked(true)).route).toBeUndefined();
  });
});
```

Write `src/walk/save.ts`:

```ts
/**
 * What saving a walk writes (journey §18.3): its records, its route when the
 * person keeps routes, and its energy estimate when one can be made (Task 5).
 * One shape for the summary's Save and Home's recovery row, so both save the
 * same walk the same way.
 */
import type { SaveWalkInput } from '@/store/useStore';
import type { Walk } from './clock';
import { walkObservations, type WalkInput } from './record';
import { routeRecord, type RouteLine } from './routeRecord';
import { isoAt } from './time';

export function walkSave(walk: Walk, extra: { route?: readonly RouteLine[]; energy?: WalkInput } = {}): SaveWalkInput {
  const first = walk.segments[0];
  const route = walk.plan.keepRoute && extra.route ? routeRecord(walk.id, isoAt(first.start, first.offsetMin), extra.route) : undefined;
  return {
    walkId: walk.id,
    observations: [...walkObservations(walk), ...(extra.energy ? [extra.energy] : [])],
    ...(route ? { route } : {}),
  };
}
```

Run: `npx vitest run src/walk/save.test.ts`
Expected: PASS.

- [ ] **Step 7: Write the failing live test.** Append to `src/walk/live.test.ts`, importing:
  - `type JournalEntry` from `./journal`;
  - `type JournalPort` from `./live`;
  - `StoreFailure` and `type StoreResult` from `@/store/db`.

```ts
describe('the route and the journal (journey §9.2, §9.4, §18.2)', () => {
  function journal() {
    const entries: JournalEntry[] = [];
    let answer: StoreResult = { ok: true, value: undefined };
    const port: JournalPort = {
      checkpoint: async e => { entries.push(e); return answer; },
      read: async id => entries.filter(e => e.id === id).at(-1),
    };
    return { port, entries, fail(failure: StoreFailure) { answer = { ok: false, failure }; } };
  }
  const KEEP = { id: START.id, plan: { ...PLAN, keepRoute: true } };

  it('draws the walk as it goes, one line per stretch of signal, never across a gap', () => {
    const w = world();
    const live = createLiveWalk(w.ports);
    live.attach(START);
    walkFor(w, 30, 0);
    w.hide();
    w.advance(60_000);
    w.show();
    walkFor(w, 30, 200);
    const snap = live.getSnapshot()!;
    expect(snap.route).toHaveLength(2);
    expect(snap.here).toBeDefined();
  });

  it('checkpoints at the start, every 15 seconds and at every change, with the route only when it is kept', async () => {
    const kept = journal();
    const w = world();
    const live = createLiveWalk({ ...w.ports, journal: kept.port });
    live.attach(KEEP);
    walkFor(w, 31, 0);
    live.pause();
    await flush();
    expect(kept.entries.length).toBeGreaterThanOrEqual(4);
    expect(kept.entries.at(-1)!.walk.status).toBe('paused');
    expect(kept.entries.at(-1)!.route?.[0].coords.length).toBeGreaterThan(1);

    const plain = journal();
    const w2 = world();
    createLiveWalk({ ...w2.ports, journal: plain.port }).attach(START);
    walkFor(w2, 20, 0);
    expect(plain.entries.length).toBeGreaterThan(0);
    expect(plain.entries.every(e => e.route === undefined)).toBe(true);
  });

  it('says when the phone is out of space for the journal', async () => {
    const full = journal();
    full.fail(new StoreFailure('quotaExceeded', 'full'));
    const w = world();
    const live = createLiveWalk({ ...w.ports, journal: full.port });
    live.attach(KEEP);
    await flush();
    w.advance(1000);
    expect(live.getSnapshot()!.journalFull).toBe(true);
  });

  it('brings a kept route back after the page reloads', async () => {
    const kept = journal();
    const w = world();
    const live = createLiveWalk({ ...w.ports, journal: kept.port });
    live.attach(KEEP);
    walkFor(w, 30, 0);
    live.pause();
    await flush();
    w.kill();
    const again = createLiveWalk({ ...w.ports, journal: kept.port });
    again.attach();
    await flush();
    expect(again.getSnapshot()!.route.length).toBeGreaterThanOrEqual(1);
  });

  it('forgets every point on request, and keeps no route from then on (B-05)', async () => {
    const kept = journal();
    const w = world();
    const live = createLiveWalk({ ...w.ports, journal: kept.port });
    live.attach(KEEP);
    walkFor(w, 30, 0);
    live.forgetRoute();
    await flush();
    expect(live.getSnapshot()!.route).toEqual([]);
    expect(live.getSnapshot()!.walk.plan.keepRoute).toBe(false);
    expect(kept.entries.at(-1)!.route).toBeUndefined();
  });
});
```

Run: `npx vitest run src/walk/live.test.ts -t "the route and the journal"`
Expected: FAIL. `route` isn't in the snapshot.

- [ ] **Step 8: The controller draws, checkpoints and forgets.** In `src/walk/live.ts`:
  - import `checkpointDue`, `journalEntry` and `type JournalEntry` from `./journal`;
  - import `type LatLon` and `type RouteLine` from `./routeRecord`;
  - import `type StoreResult` from `@/store/db`;
  - add the types below;
  - add the state and helpers below inside `createLiveWalk`;
  - wire them in as listed after the code.

```ts
export interface JournalPort {
  /** Keep this checkpoint (journey §9.4). Resolves whether it was kept. */
  checkpoint(entry: JournalEntry): Promise<StoreResult>;
  /** The latest checkpoint kept for a walk, if any. */
  read(id: string): Promise<JournalEntry | undefined>;
}
```

`LivePorts` gains `/** Where the walk is kept against a closed or crashed app (journey §9.4). */ journal?: JournalPort;`.

`LiveSnapshot` gains:

```ts
  /** Every line of the route so far in this page, never joined (B-17): for the drawing, whether or not it is kept. */
  route: RouteLine[];
  /** The walker, while GPS is measuring. */
  here?: LatLon;
  /** The last checkpoint was refused for want of space (journey §9.4). */
  journalFull: boolean;
```

`LiveWalk` gains `/** Erase every point kept for this walk and keep none from now on (B-05). */ forgetRoute(): void;`.

```ts
  /** Lines from tracks already ended in this page (B-17). */
  let routeBase: RouteLine[] = [];
  let lastCheckpoint: number | undefined;
  let journalFull = false;

  const allLines = (): RouteLine[] => [...routeBase, ...(track?.lines ?? [])];

  /** A fresh track from `start`, the ended one's lines kept for the drawing. */
  function newTrack(start: number): Track {
    if (track) routeBase = [...routeBase, ...track.lines];
    return createTrack(start, { route: true });
  }
```

- Replace `persist()` with the version below. `tick` calls `persist(split ? 'now' : 'due')`, where `const split = advance(now);` replaces its `advance(now)` call. Every other call stays `persist()`.

```ts
  /** The tab's draft every time; the journal at every change and every 15 s (journey §9.4). */
  function persist(checkpoint: 'now' | 'due' = 'now') {
    if (!walk) return;
    draftKept = storeWalk(ports.storage, walk);
    const now = ports.now();
    if (!ports.journal || (checkpoint === 'due' && !checkpointDue(lastCheckpoint, now))) return;
    lastCheckpoint = now;
    const entry = journalEntry(walk, now, walk.plan.keepRoute ? allLines() : undefined);
    void ports.journal.checkpoint(entry).then(result => {
      const full = !result.ok && result.failure.code === 'quotaExceeded';
      if (full === journalFull) return;
      journalFull = full;
      emit();
    });
  }
```

- Every `track = createTrack(…)` becomes `track = newTrack(…)`. That's in `startSensors`, `catchUpMidnight` and `accrueNow`.
- `stopSensors` and `onGeoError`'s denied branch add `if (track) routeBase = [...routeBase, ...track.lines];` before `track = null;`.
- `emit` adds `route: allLines()`, `...(track?.here ? { here: track.here } : {})` and `journalFull` to the snapshot. The one hand-built snapshot, `snapshot()` in `src/walk/readout.test.ts`, gains `route: [], journalFull: false` (`grep -rn "draftKept:" src` finds any other). ponytail: the lines are copied on each emit, O(points) at 1 Hz; upgrade to a version-keyed cache if profiling ever shows it.
- `detach`, after `walk = null`, resets `routeBase = []`, `lastCheckpoint = undefined` and `journalFull = false`.
- In `attach`, right after `walk = restoreWalk(stored, now);`, bring a kept route back:

```ts
        const id = walk.id;
        if (walk.plan.keepRoute && ports.journal) {
          void ports.journal.read(id).then(entry => {
            if (!entry?.route || walk?.id !== id || !walk.plan.keepRoute) return;
            const known = new Set(allLines().map(l => l.start));
            routeBase = [...entry.route.filter(l => !known.has(l.start)), ...routeBase];
            emit();
          });
        }
```

- Add `forgetRoute` to the returned object:

```ts
    forgetRoute() {
      if (!walk) return;
      routeBase = [];
      track?.forgetPoints();
      walk = { ...walk, plan: { ...walk.plan, keepRoute: false } };
      persist();
      emit();
    },
```

Run: `npx vitest run src/walk/live.test.ts`
Expected: PASS, every existing test included.

- [ ] **Step 9: The browser's journal.** Create `src/walk/journalPort.ts`, then add `journal: journalPort(),` to `browserPorts()` in `src/walk/browser.ts`.

```ts
/**
 * The live walk's journal as the browser keeps it: IndexedDB through the
 * store, and this page's latest checkpoint per walk in memory, so the
 * summary finds its route at once, even when nothing can be stored.
 */
import { putWalkJournal, readWalkJournals } from '@/store/useStore';
import type { JournalEntry } from './journal';
import type { JournalPort } from './live';

const latest = new Map<string, JournalEntry>();

export function cachedJournal(id: string): JournalEntry | undefined {
  return latest.get(id);
}

/** B-05: this page forgets every kept route too. */
export function forgetCachedRoutes(): void {
  for (const [id, entry] of latest) {
    const { route: _erased, ...rest } = entry;
    void _erased;
    latest.set(id, rest);
  }
}

export function journalPort(): JournalPort {
  return {
    checkpoint(entry) {
      latest.set(entry.id, entry);
      return putWalkJournal(entry);
    },
    async read(id) {
      const here = latest.get(id);
      if (here) return here;
      const kept = await readWalkJournals();
      return kept.ok ? kept.value.find(e => e.id === id) : undefined;
    },
  };
}
```

`src/screens/walk/live.callers.test.ts` mocks `@/walk/browser`. Its hand-built ports need no journal: the port is optional.

- [ ] **Step 10: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/walk src/store/useStore.ts src/store/useStore.test.ts
git commit -m "feat: Journal a walk as it goes and save it with its route in one transaction"
```

---
### Task 5: About how much energy a walk used (J§12.4, B-17, B-18)

**Files:**
- Create: `src/walk/energy.ts`, `src/walk/energy.test.ts`
- Modify: `src/health/observation.ts` (the `activeEnergy` kind), `src/screens/track/format.ts` (its title)
- Modify: `src/walk/record.ts` (`WalkRecord.energyKcal`, `energyNote`, `afterMeal`), `src/walk/record.test.ts`
- Modify: `src/walk/save.test.ts`

**Interfaces:**
- **Consumes:** `measuredRuns` and `Walk` (clock); `isoAt` (Task 3); `WalkInput` (record).
- **Produces, in `energy.ts`:**
  - `interface MetBand { fromMph: number; met: number; code: string }`;
  - `ADULT_WALKING: readonly MetBand[]`, `ADULT_NO_DISTANCE: MetBand` and `MAX_WALK_MPH = 5`;
  - `interface OlderTable { bands: readonly MetBand[]; noDistance: MetBand; restingFactor: number }`;
  - `OLDER_ADULT_WALKING: OlderTable | undefined`. It's `undefined` until Task 6 confirms the source;
  - `MPH_PER_MPS`;
  - `type AgeBand = 'adult' | 'older' | 'young' | 'unknown'`;
  - `ageBand(birthYear: number | undefined, year: number): AgeBand`;
  - `walkingMet(mph: number, bands: readonly MetBand[]): MetBand | undefined`;
  - `interface WeightUsed { kg: number; from: 'reading' | 'profile'; day?: string }`;
  - `weightAt(observations, atMs, profileKg): WeightUsed | undefined`;
  - `type EnergyNone = 'noWeight' | 'unknownAge' | 'young' | 'olderUnconfirmed' | 'tooFast' | 'tooShort'`;
  - `type EnergyEstimate = { kind: 'about'; kcal: number; rounded: number; coveredMs: number; uncoveredMs: number; kg: number } | { kind: 'none'; reason: EnergyNone }`;
  - `estimateEnergy(input: { runs: readonly { ms: number; metres: number }[]; observedMs: number; kg?: number; band: AgeBand }, tables?: { older?: OlderTable }): EnergyEstimate`;
  - `roundKcal(kcal: number): number | undefined`;
  - `energyText(e: EnergyEstimate, weight?: WeightUsed): { value: string; detail: string }`;
  - `walkEnergy(walk: Walk, ctx: { birthYear?: number; observations: readonly Observation[]; profileKg?: number }): { estimate: EnergyEstimate; weight?: WeightUsed; input?: WalkInput }`.
- **Produces, in `observation.ts`:** `ObservationKind` gains `'activeEnergy'` (unit `kcal`, `sessionObserved` only).
- **Produces, in `record.ts`:** `WalkRecord.energyKcal?: number`, `energyNote?: string` and `afterMeal: boolean`.

**The rules:**
- **Active energy** is (MET − 1) × kg × hours, worked out per covered interval (B-17). Each GPS run of at least 60 s and 100 m is one interval, at its measured speed's band.
- **Time without a usable speed** counts at the slow-pace value: Adult code 17152, 2.8 (J§12.4). The words say how much did.
- **Bands are half-open from their own lower speed,** so every speed below 5 mph has exactly one band. A gap between two Compendium rows takes the slower row's value. At 5 mph or faster there's no estimate (B-18).
- **The weight** is the latest dated weight reading at or before the walk's start (A-36). Only when there's none does the profile's weight count, and then the words say it came from the profile, with no invented date (B-16).
- **The estimate is stored as one `activeEnergy` record** with the walk, its note naming the weight it used. Later weight changes never rewrite it (B-16, V-J10).
- **Age** (B-18, B-31): 19–59 for certain this year uses the Adult Compendium.
  - A birth year that makes the person 59-or-60 uses the Older Adult values, which give no figure until Task 6 confirms them.
  - 18-or-19, or no birth year, gives no figure, and says why (Review Focus 3).

- [ ] **Step 1: Write the failing test** `src/walk/energy.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { newObservation } from '@/health/observation';
import { finishWalk, startWalk } from './clock';
import {
  ADULT_WALKING, MPH_PER_MPS, ageBand, energyText, estimateEnergy, roundKcal, walkEnergy, walkingMet, weightAt,
} from './energy';

const at3mph = (ms: number) => ({ ms, metres: (3 / MPH_PER_MPS) * (ms / 1000) });
const T = Date.parse('2026-10-08T03:30:00Z');
const weight = (at: string, kg: number) => newObservation({ kind: 'weight', value: kg, scope: 'pointInTime', source: 'manual', at });
const tenMinutes = () => finishWalk(startWalk('mgh3k2x1-1a2b3c4d', { kind: 'walk', gps: false, steps: false }, T), T + 600_000, 'finish');

describe('the 2024 Adult Compendium’s walking bands (J§12.4)', () => {
  it('cover every speed from a standstill to 5 mph, a gap between rows taking the slower row’s value', () => {
    const met = (mph: number) => walkingMet(mph, ADULT_WALKING)?.met;
    expect([0.5, 1.99, 2.0, 2.4, 2.45, 2.5, 2.7, 2.8, 3.4, 3.45, 3.5, 3.9, 4.0, 4.4, 4.5, 4.9].map(met))
      .toEqual([2.3, 2.3, 2.8, 2.8, 2.8, 3.0, 3.0, 3.8, 3.8, 3.8, 4.8, 4.8, 5.5, 5.5, 7.0, 7.0]);
    expect(ADULT_WALKING.map(b => b.code)).toEqual(['17151', '17152', '17170', '17190', '17200', '17220', '17230']);
  });

  it('give no value at 5 mph or faster, or for a speed that isn’t one (B-18)', () => {
    expect(walkingMet(5.0, ADULT_WALKING)).toBeUndefined();
    expect(walkingMet(Number.NaN, ADULT_WALKING)).toBeUndefined();
    expect(walkingMet(-1, ADULT_WALKING)).toBeUndefined();
  });
});

describe('active energy (V7, A-50, B-17)', () => {
  it('works the spec’s example: 70 kg, 30 min at 3 mph, about 100 kcal', () => {
    const e = estimateEnergy({ runs: [at3mph(1_800_000)], observedMs: 1_800_000, kg: 70, band: 'adult' });
    expect(e).toMatchObject({ kind: 'about', rounded: 100, coveredMs: 1_800_000, uncoveredMs: 0 });
    if (e.kind === 'about') expect(e.kcal).toBeCloseTo(98, 5);
  });

  it('counts time without distance at the slow-pace value, and says how much did', () => {
    const e = estimateEnergy({ runs: [], observedMs: 600_000, kg: 78, band: 'adult' });
    expect(e).toMatchObject({ kind: 'about', rounded: 20, uncoveredMs: 600_000 });
    expect(energyText(e, { kg: 78, from: 'profile' })).toEqual({
      value: 'about 20 kcal',
      detail: 'From 10 min without distance, counted at an easy pace. Using 78 kg, from your profile.',
    });
  });

  it('treats a run too thin for a speed as time without distance', () => {
    expect(estimateEnergy({ runs: [{ ms: 30_000, metres: 40 }], observedMs: 600_000, kg: 78, band: 'adult' }))
      .toMatchObject({ kind: 'about', coveredMs: 0, uncoveredMs: 600_000 });
  });

  it('gives no estimate when part of the walk was faster than walking', () => {
    expect(estimateEnergy({ runs: [{ ms: 600_000, metres: 1600 }], observedMs: 600_000, kg: 78, band: 'adult' }))
      .toEqual({ kind: 'none', reason: 'tooFast' });
  });

  it('rounds to the nearest 10, and calls a walk too short for one below 5 kcal', () => {
    expect([4.9, 5, 14, 15, 98].map(roundKcal)).toEqual([undefined, 10, 10, 20, 100]);
    expect(estimateEnergy({ runs: [], observedMs: 120_000, kg: 78, band: 'adult' })).toEqual({ kind: 'none', reason: 'tooShort' });
  });

  it('asks for a weight when there is none', () => {
    expect(estimateEnergy({ runs: [], observedMs: 600_000, band: 'adult' })).toEqual({ kind: 'none', reason: 'noWeight' });
    expect(energyText({ kind: 'none', reason: 'noWeight' }).detail).toBe('Add your weight for an estimate.');
  });
});

describe('who an estimate is for (B-18, B-31; Review Focus 3)', () => {
  it('uses the Adult Compendium only for someone certainly 19 to 59 this year', () => {
    expect(ageBand(1982, 2026)).toBe('adult');
    expect(ageBand(2006, 2026)).toBe('adult');
    expect(ageBand(1967, 2026)).toBe('adult');
  });

  it('treats a borderline year conservatively, and no birth year as unknown', () => {
    expect(ageBand(2007, 2026)).toBe('young');
    expect(ageBand(1966, 2026)).toBe('older');
    expect(ageBand(undefined, 2026)).toBe('unknown');
  });

  it('gives no figure for 60 and over until the Older Adult values are confirmed, and none for the young or unknown', () => {
    const input = { runs: [], observedMs: 600_000, kg: 70 };
    expect(estimateEnergy({ ...input, band: 'older' }, { older: undefined })).toEqual({ kind: 'none', reason: 'olderUnconfirmed' });
    expect(estimateEnergy({ ...input, band: 'young' })).toEqual({ kind: 'none', reason: 'young' });
    expect(estimateEnergy({ ...input, band: 'unknown' })).toEqual({ kind: 'none', reason: 'unknownAge' });
    expect(energyText({ kind: 'none', reason: 'olderUnconfirmed' }).detail).toBe('Estimates for ages 60 and over aren’t available yet.');
  });
});

describe('a walk’s estimate (A-36, B-16)', () => {
  it('uses the weight in effect when the walk began, and records the weight it used', () => {
    const walk = tenMinutes();
    const r = walkEnergy(walk, {
      birthYear: 1982,
      observations: [weight('2026-10-01T08:00:00+05:30', 80), weight('2026-10-09T08:00:00+05:30', 70)],
      profileKg: 75,
    });
    expect(r.weight).toEqual({ kg: 80, from: 'reading', day: '2026-10-01' });
    expect(r.input).toMatchObject({ id: `${walk.id}:activeEnergy`, kind: 'activeEnergy', scope: 'sessionObserved', source: 'measured', coverageMs: 600_000, context: `walk:${walk.id}` });
    expect(r.input?.note).toMatch(/Using 80 kg, your weight on 1 Oct\./);
  });

  it('falls back to the profile’s weight, which has no date of its own', () => {
    expect(weightAt([], T, 75)).toEqual({ kg: 75, from: 'profile' });
    expect(weightAt([], T, undefined)).toBeUndefined();
  });

  it('records nothing when there is no figure', () => {
    expect(walkEnergy(tenMinutes(), { birthYear: undefined, observations: [], profileKg: 75 }).input).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/walk/energy.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: The `activeEnergy` kind.**
  - In `src/health/observation.ts`, add `| 'activeEnergy'` to `ObservationKind`, and to `KINDS`: `activeEnergy: { units: ['kcal'], scopes: ['sessionObserved'], label: 'Active energy (estimate)' },`.
  - In `src/screens/track/format.ts`, add `activeEnergy: 'Active energy',` to `TITLES`.
  - Run `npx tsc -b`, and add the kind to any other table the compiler names as exhaustive.

  The kind is never summed into a day's movement, and Today's log shows it only inside its walk's row, because every observation with a `walk:` context belongs to that row (`timeline.ts`).

- [ ] **Step 4: Write** `src/walk/energy.ts`

```ts
/**
 * About how much energy a walk used (journey §12.4, V7, A-50, B-17, B-18).
 *
 * Active energy, the energy above resting: (MET − 1) × kg × hours, from the
 * 2024 Compendium of Physical Activities by measured speed, worked out per
 * covered interval. Shown as "about", to the nearest 10, on summaries and
 * details only. Never a gross figure, never live.
 */
import { format } from 'date-fns';
import type { Observation } from '@/health/observation';
import { measuredRuns, type Walk } from './clock';
import type { WalkInput } from './record';
import { isoAt } from './time';

export interface MetBand {
  /** The band runs from this speed to the next band's. */
  fromMph: number;
  met: number;
  /** The Compendium's activity code. */
  code: string;
}

/** 2024 Adult Compendium, level walking, firm surface (pacompendium.com, read 2026-10-10; confirmed in Task 6). */
export const ADULT_WALKING: readonly MetBand[] = [
  { fromMph: 0, met: 2.3, code: '17151' },
  { fromMph: 2.0, met: 2.8, code: '17152' },
  { fromMph: 2.5, met: 3.0, code: '17170' },
  { fromMph: 2.8, met: 3.8, code: '17190' },
  { fromMph: 3.5, met: 4.8, code: '17200' },
  { fromMph: 4.0, met: 5.5, code: '17220' },
  { fromMph: 4.5, met: 7.0, code: '17230' },
];
/** Time without a usable speed (journey §12.4: "Without it, the walk uses 2.8"). */
export const ADULT_NO_DISTANCE: MetBand = { fromMph: 2.0, met: 2.8, code: '17152' };
/** At this speed or faster it isn't a walk for this app: no estimate (B-18). */
export const MAX_WALK_MPH = 5;

export interface OlderTable {
  bands: readonly MetBand[];
  noDistance: MetBand;
  /** MET60+ values are read against an older adult's lower resting rate: kcal scale by this. */
  restingFactor: number;
}
/** The 2024 Older Adult Compendium's walking values. Undefined until Task 6 confirms them at the source (B-18): no figure for 60 and over. */
export const OLDER_ADULT_WALKING: OlderTable | undefined = undefined;

export const MPH_PER_MPS = 2.236936;
/** Thinner than either, a run has no speed worth a band (the same floor as the average pace). */
const RUN_MIN_MS = 60_000;
const RUN_MIN_M = 100;

export type AgeBand = 'adult' | 'older' | 'young' | 'unknown';

/**
 * Which Compendium (B-18), from a birth year alone, conservatively (B-31): the
 * person may or may not have had this year's birthday, so both ages count.
 */
export function ageBand(birthYear: number | undefined, year: number): AgeBand {
  if (birthYear === undefined || !Number.isFinite(birthYear)) return 'unknown';
  const youngest = year - birthYear - 1;
  const oldest = year - birthYear;
  if (youngest < 19) return 'young';
  if (oldest >= 60) return 'older';
  return 'adult';
}

/** The band a speed falls in, or nothing for a speed this app can't estimate. */
export function walkingMet(mph: number, bands: readonly MetBand[]): MetBand | undefined {
  if (!(mph >= 0) || mph >= MAX_WALK_MPH) return undefined;
  let found: MetBand | undefined;
  for (const band of bands) if (mph >= band.fromMph) found = band;
  return found;
}

export interface WeightUsed {
  kg: number;
  from: 'reading' | 'profile';
  /** The reading's day, for a dated reading. */
  day?: string;
}

/** The weight in effect at `atMs` (A-36): the latest dated reading at or before it, else the profile's. */
export function weightAt(observations: readonly Observation[], atMs: number, profileKg: number | undefined): WeightUsed | undefined {
  let best: Observation | undefined;
  for (const o of observations) {
    if (o.kind !== 'weight' || !(o.value > 0)) continue;
    const t = Date.parse(o.at);
    if (!(t <= atMs)) continue;
    const b = best ? Date.parse(best.at) : -Infinity;
    if (t > b || (t === b && (o.seq ?? 0) > (best?.seq ?? 0))) best = o;
  }
  if (best) return { kg: best.value, from: 'reading', day: best.day };
  return profileKg !== undefined && profileKg > 0 ? { kg: profileKg, from: 'profile' } : undefined;
}

export type EnergyNone = 'noWeight' | 'unknownAge' | 'young' | 'olderUnconfirmed' | 'tooFast' | 'tooShort';
export type EnergyEstimate =
  | { kind: 'about'; kcal: number; rounded: number; coveredMs: number; uncoveredMs: number; kg: number }
  | { kind: 'none'; reason: EnergyNone };

/** To the nearest 10; under 5 kcal there's no estimate worth the words. */
export function roundKcal(kcal: number): number | undefined {
  if (!(kcal >= 5)) return undefined;
  return Math.max(10, Math.round(kcal / 10) * 10);
}

const ADULT: OlderTable = { bands: ADULT_WALKING, noDistance: ADULT_NO_DISTANCE, restingFactor: 1 };

export function estimateEnergy(
  input: { runs: readonly { ms: number; metres: number }[]; observedMs: number; kg?: number; band: AgeBand },
  tables: { older?: OlderTable } = { older: OLDER_ADULT_WALKING },
): EnergyEstimate {
  if (input.band === 'unknown') return { kind: 'none', reason: 'unknownAge' };
  if (input.band === 'young') return { kind: 'none', reason: 'young' };
  const table = input.band === 'adult' ? ADULT : tables.older;
  if (!table) return { kind: 'none', reason: 'olderUnconfirmed' };
  if (input.kg === undefined || !(input.kg > 0)) return { kind: 'none', reason: 'noWeight' };
  const kg = input.kg;
  let kcal = 0;
  let covered = 0;
  for (const run of input.runs) {
    if (run.ms < RUN_MIN_MS || run.metres < RUN_MIN_M) continue;
    const band = walkingMet((run.metres / (run.ms / 1000)) * MPH_PER_MPS, table.bands);
    if (!band) return { kind: 'none', reason: 'tooFast' };
    kcal += (band.met - 1) * table.restingFactor * kg * (run.ms / 3_600_000);
    covered += run.ms;
  }
  const uncovered = Math.max(0, input.observedMs - covered);
  kcal += (table.noDistance.met - 1) * table.restingFactor * kg * (uncovered / 3_600_000);
  const rounded = roundKcal(kcal);
  if (rounded === undefined) return { kind: 'none', reason: 'tooShort' };
  return { kind: 'about', kcal, rounded, coveredMs: covered, uncoveredMs: uncovered, kg };
}

const WHY_NOT: Record<EnergyNone, string> = {
  noWeight: 'Add your weight for an estimate.',
  unknownAge: 'Add your birth year for an estimate.',
  young: 'Estimates are for ages 19 and over.',
  olderUnconfirmed: 'Estimates for ages 60 and over aren’t available yet.',
  tooFast: 'No estimate: part of this walk was faster than walking pace.',
  tooShort: 'Too short for an energy estimate.',
};

/** The words for an estimate: its figure, and what it was worked out from (B-17), with the weight it used (B-16). */
export function energyText(e: EnergyEstimate, weight?: WeightUsed): { value: string; detail: string } {
  if (e.kind === 'none') return { value: 'No estimate', detail: WHY_NOT[e.reason] };
  const min = (ms: number) => Math.round(ms / 60_000);
  const covered = min(e.coveredMs);
  const uncovered = min(e.uncoveredMs);
  const basis = covered > 0 && uncovered > 0
    ? `From ${covered} min with distance and ${uncovered} min without it, counted at an easy pace.`
    : covered > 0 ? `From ${covered} min with distance.` : `From ${uncovered} min without distance, counted at an easy pace.`;
  const kg = Math.round(e.kg * 10) / 10;
  const from = weight?.from === 'reading' && weight.day
    ? `, your weight on ${format(new Date(`${weight.day}T12:00:00`), 'd MMM')}`
    : ', from your profile';
  return { value: `about ${e.rounded} kcal`, detail: `${basis} Using ${kg} kg${from}.` };
}

/** A finished walk's estimate, and the record it is kept as, with the weight it used (B-16). */
export function walkEnergy(
  walk: Walk,
  ctx: { birthYear?: number; observations: readonly Observation[]; profileKg?: number },
): { estimate: EnergyEstimate; weight?: WeightUsed; input?: WalkInput } {
  const first = walk.segments[0];
  const band = ageBand(ctx.birthYear, Number(first.day.slice(0, 4)));
  const weight = weightAt(ctx.observations, first.start, ctx.profileKg);
  const runs = walk.plan.gps ? walk.segments.flatMap(measuredRuns).map(r => ({ ms: r.end - r.start, metres: r.distanceM })) : [];
  const observedMs = walk.segments.reduce((t, s) => t + s.accruedMs, 0);
  const estimate = estimateEnergy({ runs, observedMs, ...(weight ? { kg: weight.kg } : {}), band });
  if (estimate.kind !== 'about' || !weight) return { estimate, ...(weight ? { weight } : {}) };
  return {
    estimate,
    weight,
    input: {
      id: `${walk.id}:activeEnergy`, kind: 'activeEnergy', value: Math.round(estimate.kcal * 10) / 10,
      scope: 'sessionObserved', source: 'measured', at: isoAt(first.start, first.offsetMin), coverageMs: observedMs,
      context: `walk:${walk.id}`, note: energyText(estimate, weight).detail,
    },
  };
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/walk/energy.test.ts`
Expected: PASS.

- [ ] **Step 6: The saved walk reads its estimate.** In `src/walk/record.ts`'s `walkRecords`:
  - `WalkRecord` gains `/** Tagged after a meal, whether or not its start was recorded (B-09). */ afterMeal: boolean;`, `/** The walk's active-energy estimate, unrounded, and what it was worked out from (J§12.4, B-16). */ energyKcal?: number; energyNote?: string;`;
  - each record gets `afterMeal: group.some(o => o.tag === 'afterMeal')` and, from `group.find(o => o.kind === 'activeEnergy')`, `energyKcal` (its `value`) and `energyNote` (its `note`).

Append to `src/walk/record.test.ts`:

```ts
describe('a saved walk’s estimate (J§12.4)', () => {
  it('reads the estimate back with the walk, never into its minutes', () => {
    const w = afterDinner();
    const energy = newObservation({ id: `${w.id}:activeEnergy`, kind: 'activeEnergy', value: 41.6, scope: 'sessionObserved', source: 'measured', at: walkObservations(w)[0].at!, coverageMs: 1_080_000, context: `walk:${w.id}`, note: 'From 18 min with distance. Using 78 kg, from your profile.' });
    const saved = walkObservations(w).map(i => newObservation(i));
    const [record] = walkRecords([...saved, energy]);
    expect(record).toMatchObject({ energyKcal: 41.6, energyNote: 'From 18 min with distance. Using 78 kg, from your profile.', afterMeal: true });
    expect(record.minutes).toBe(walkRecords(saved)[0].minutes);
  });
});
```

Append to `src/walk/save.test.ts`:

```ts
it('adds the energy estimate as one more record of the walk', () => {
  const energy = { id: 'mgh3k2x1-1a2b3c4d:activeEnergy', kind: 'activeEnergy' as const, value: 42, scope: 'sessionObserved' as const, source: 'measured' as const, coverageMs: 600_000 };
  expect(walkSave(walked(false), { energy }).observations.at(-1)).toBe(energy);
});
```

Run: `npx vitest run src/walk`
Expected: PASS.

- [ ] **Step 7: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/walk src/health/observation.ts src/screens/track/format.ts
git commit -m "feat: Estimate a walk's active energy from the Compendium and the weight at the time"
```

---

### Task 6: Confirm the Older Adult Compendium walking values (B-18)

**Files:**
- Modify: `docs/reimagine/BOARD.md` (append)
- Modify, only if every value is confirmed: `src/walk/energy.ts` (`OLDER_ADULT_WALKING`), `src/walk/energy.test.ts`

**Interfaces:**
- **Consumes:** `OlderTable`, `MetBand`, `estimateEnergy` and `MPH_PER_MPS` (Task 5).
- **Produces:** `OLDER_ADULT_WALKING` set, or left `undefined` with the reason on the board.

B-18 allows a figure for 60 and over only once the Older Adult Compendium's walking values are confirmed at the source. This task does that, and records it either way.

The planner read the values below on 2026-10-10 through a page summary, not from the PDF, so they are unconfirmed until this task checks each one.

| Code | As read on the page | MET60+ |
| --- | --- | --- |
| 1715160 | Walking, less than 1.0 mph, level, strolling, very slow | 3.0 |
| 1715260 | Walking, 1.0 to 1.9 mph, level, slow pace, firm surface | 4.0 |
| 1715360 | Walking, 2.0 mph, level, slow pace, firm surface | 3.8 |
| 1717060 | Walking, 2.2 to 2.7 mph, level, firm surface | 4.5 |
| 1719060 | Walking, 2.8 to 3.2 mph, level, moderate pace, firm surface | 5.3 |
| 1720060 | Walking, 3.3 to 3.7 mph, level, brisk, firm surface, walking for exercise | 6.0 |
| 1722060 | Walking, 4.0 to 4.2 mph, level, firm surface, very brisk pace | 7.3 |
| 1723060 | Walking, 4.5 mph, level, firm surface, very, very brisk | 9.0 |

The same reading gave two more facts to check:
- MET60+ values are relative to a resting rate of 2.7 mL·kg⁻¹·min⁻¹, not 3.5. So active kcal for 60 and over is (MET60+ − 1) × (2.7 ÷ 3.5) × kg × hours.
- As printed, the 1.0–1.9 mph row (4.0) is higher than the 2.0 mph row (3.8).

The home page, read the same day, gives the citations and the terms:
- "Please cite the Compendium website or publication(s)."
- "The Adult, Older Adult, and Wheelchair Compendia are free to use for commercial purposes."
- "Please do not change MET values or combine activities with different MET levels."

- [ ] **Step 1: Read the source.** Open https://pacompendium.com/older-adult-compendium/ and its PDF, https://pacompendium.com/wp-content/uploads/2024/02/2_2024-older-adult-compendium_1_2024.pdf. Check each row above against the PDF: its code, its description and its MET. Find where the PDF or the paper (Willis EA et al., J Sport Health Sci 2024;13(1):13–17) defines MET60+ and its resting rate.

- [ ] **Step 2: Check the Adult rows and the terms.** On https://pacompendium.com/walking/, check that the rows Task 5 uses still read: 17151 2.3, 17152 2.8, 17170 3.0, 17190 3.8, 17200 4.8, 17220 5.5, 17230 7.0. On https://pacompendium.com/, check the citations and the "Using the Compendium" terms quoted above.

- [ ] **Step 3: Record it on the board.** Append the entry below to `docs/reimagine/BOARD.md`.
  - In the **Source** column, write "Confirmed" for each row the PDF shows as above, or the PDF's own value or wording where it differs.
  - Write the day the check was done in the heading.
  - Plan 6's decisions are numbered D85 to D94: the plans written together share the board's numbers (Plan 2 records D47 to D55, Plan 4 D56 to D67). This entry is D85, and Task 18's are D86 onwards.

```markdown
### 2026-10-10 — [claude] Energy: the Compendium values, checked at the source (B-18)

Checked at pacompendium.com: the 2024 Adult Compendium's walking page, the 2024 Older Adult Compendium page and its PDF.

| Compendium | Code | Description | MET | Source |
| --- | --- | --- | --- | --- |
| Adult | 17151 | Walking, less than 2.0 mph, level, strolling, very slow | 2.3 | Confirmed |
| Adult | 17152 | Walking, 2.0 to 2.4 mph, level, slow pace, firm surface | 2.8 | Confirmed |
| Adult | 17170 | Walking, 2.5 mph, firm, level surface | 3.0 | Confirmed |
| Adult | 17190 | Walking, 2.8 to 3.4 mph, level, moderate pace, firm surface | 3.8 | Confirmed |
| Adult | 17200 | Walking, 3.5 to 3.9 mph, level, brisk, firm surface, walking for exercise | 4.8 | Confirmed |
| Adult | 17220 | Walking, 4.0 to 4.4 mph, level, firm surface, very brisk pace | 5.5 | Confirmed |
| Adult | 17230 | Walking, 4.5 to 4.9 mph, level, firm surface, very, very brisk | 7.0 | Confirmed |
| Older Adult | 1715160 | Walking, less than 1.0 mph, level, strolling, very slow | 3.0 | Confirmed |
| Older Adult | 1715260 | Walking, 1.0 to 1.9 mph, level, slow pace, firm surface | 4.0 | Confirmed |
| Older Adult | 1715360 | Walking, 2.0 mph, level, slow pace, firm surface | 3.8 | Confirmed |
| Older Adult | 1717060 | Walking, 2.2 to 2.7 mph, level, firm surface | 4.5 | Confirmed |
| Older Adult | 1719060 | Walking, 2.8 to 3.2 mph, level, moderate pace, firm surface | 5.3 | Confirmed |
| Older Adult | 1720060 | Walking, 3.3 to 3.7 mph, level, brisk, firm surface, walking for exercise | 6.0 | Confirmed |
| Older Adult | 1722060 | Walking, 4.0 to 4.2 mph, level, firm surface, very brisk pace | 7.3 | Confirmed |
| Older Adult | 1723060 | Walking, 4.5 mph, level, firm surface, very, very brisk | 9.0 | Confirmed |

| # | Decision | Reason |
| --- | --- | --- |
| D85 | Energy for 60 and over uses the Older Adult rows above, as printed (the 1.0–1.9 mph row is higher than the 2.0 mph row; the Compendium asks that its values aren't changed), against its own resting rate: active kcal = (MET60+ − 1) × 2.7 ÷ 3.5 × kg × hours. Time without a usable speed counts at 1715360 (3.8), the slow-pace row, as 17152 does for adults | B-18; MET60+ is defined against 2.7 mL·kg⁻¹·min⁻¹ |

- **Speed bands:** each band runs from its own lower speed to the next row's. A gap between two rows, such as 2.4 to 2.5 mph, takes the slower row's value. At 5 mph or faster there is no estimate.
- **Ages:** 19–59 this year, for certain, use the Adult Compendium. A birth year that makes someone 59-or-60 uses the Older Adult rows (B-31). 18-or-19, or no birth year, gives no figure.
- **Citations:**
  - Herrmann SD, Willis EA, Ainsworth BE, et al. 2024 Adult Compendium of Physical Activities: A third update of the energy costs of human activities. J Sport Health Sci 2024;13(1):6–12.
  - Willis EA, Herrmann SD, Hastert M, et al. Older Adult Compendium of Physical Activities: Energy costs of human activities in adults aged 60 and older. J Sport Health Sci 2024;13(1):13–17.
- **Terms:** free to use for commercial purposes; the MET values are not changed or combined. Learn's sources list both citations.
```

If any Older Adult row, or the 2.7 resting rate, can't be confirmed from the PDF:
- write in its Source cell what the PDF shows, or "Not found in the PDF";
- replace D85's decision with "Energy for 60 and over: no figure. The Older Adult walking values could not be confirmed at the source (rows: …)";
- skip Steps 4 and 5. `OLDER_ADULT_WALKING` stays `undefined`, and 60 and over see "Estimates for ages 60 and over aren’t available yet."

- [ ] **Step 4: Only if every row and the resting rate are confirmed.** Write the failing test. Append to `src/walk/energy.test.ts`, and import `OLDER_ADULT_WALKING`:

```ts
describe('60 and over (B-18, Task 6)', () => {
  it('uses the Older Adult Compendium’s values, as printed, against its own resting rate', () => {
    expect(OLDER_ADULT_WALKING?.bands.map(b => [b.fromMph, b.met, b.code])).toEqual([
      [0, 3.0, '1715160'], [1.0, 4.0, '1715260'], [2.0, 3.8, '1715360'], [2.2, 4.5, '1717060'],
      [2.8, 5.3, '1719060'], [3.3, 6.0, '1720060'], [4.0, 7.3, '1722060'], [4.5, 9.0, '1723060'],
    ]);
    // (5.3 − 1) × 2.7/3.5 × 70 kg × 0.5 h ≈ 116 → about 120.
    expect(estimateEnergy({ runs: [at3mph(1_800_000)], observedMs: 1_800_000, kg: 70, band: 'older' })).toMatchObject({ kind: 'about', rounded: 120 });
  });
});
```

Run `npx vitest run src/walk/energy.test.ts`. Expected: FAIL (`OLDER_ADULT_WALKING` is undefined). Then, in `src/walk/energy.ts`, replace the constant:

```ts
/** The 2024 Older Adult Compendium's walking values, as printed (MET60+, read against 2.7 mL/kg/min), confirmed at the source on the board (B-18, D85). */
export const OLDER_ADULT_WALKING: OlderTable | undefined = {
  bands: [
    { fromMph: 0, met: 3.0, code: '1715160' },
    { fromMph: 1.0, met: 4.0, code: '1715260' },
    { fromMph: 2.0, met: 3.8, code: '1715360' },
    { fromMph: 2.2, met: 4.5, code: '1717060' },
    { fromMph: 2.8, met: 5.3, code: '1719060' },
    { fromMph: 3.3, met: 6.0, code: '1720060' },
    { fromMph: 4.0, met: 7.3, code: '1722060' },
    { fromMph: 4.5, met: 9.0, code: '1723060' },
  ],
  noDistance: { fromMph: 2.0, met: 3.8, code: '1715360' },
  restingFactor: 2.7 / 3.5,
};
```

If the PDF printed a different value for a row, the board says so: use that value, and in the test above.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/walk/energy.test.ts`
Expected: PASS. The "until confirmed" test in Task 5 still passes, because it passes `{ older: undefined }` itself.

- [ ] **Step 6: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add docs/reimagine/BOARD.md src/walk/energy.ts src/walk/energy.test.ts
git commit -m "docs: Record the Compendium values checked at the source for walk energy"
```

---
### Task 7: The start sequence (B-01), and what the plan carries

**Files:**
- Create: `src/walk/start.ts`, `src/walk/start.test.ts`
- Modify: `src/walk/clock.ts` (`WalkPlan.stepsDenied`, `from`, `meal.basis`), `src/walk/plan.ts`, `src/walk/plan.test.ts`
- Modify: `src/walk/persist.ts`, `src/walk/persist.test.ts`
- Modify: `src/walk/record.ts`, `src/walk/record.test.ts` (an after-meal walk "had at")
- Modify: `src/walk/readout.ts`, `src/walk/readout.test.ts` (its summary row)
- Modify: `src/walk/gate.ts` (`storeStartPermission`)

**Interfaces:**
- **Consumes:** `Permission` (engine); `allowsMovement`, `startGate`, `deviceClinical` and `reachableHistory` (`gate.ts`).
- **Produces, in `start.ts`:**
  - `type MotionAnswer = 'granted' | 'denied' | 'unsupported'`;
  - `interface StartPorts { requestMotion(): Promise<MotionAnswer>; unlockAudio(): Promise<boolean>; gate(): Permission; go(plan: WalkPlan): void }`;
  - `type StartOutcome = { kind: 'started'; plan: WalkPlan } | { kind: 'refused'; permission: Permission } | { kind: 'busy' }`;
  - `createStarter(ports: StartPorts): { tap(plan: WalkPlan, wants: { voice: boolean }): Promise<StartOutcome> }`.
- **Produces, in `clock.ts`:**
  - `WalkPlan.stepsDenied?: boolean`;
  - `WalkPlan.from?: WalkOrigin`;
  - `WalkPlan.meal.basis?: 'had'`;
  - `type WalkOrigin = '/home' | '/hub/walk'`.
- **Produces, in `plan.ts`:**
  - the address carries `steps=denied`, `from=home|walk` and `mealBasis=had`;
  - `originOf(pathname: string): WalkOrigin`;
  - `walkPlanOf(href: string, now?: number): WalkPlan | undefined` (the plan in a `/walk/live?…` address).
- **Produces, in `gate.ts`:** `storeStartPermission(now?: Date): Permission`. This is B-01's final gate, asked of what the device holds at that moment.

**B-09's meal time.** A walk started from B-09's button ("I had lunch at 1:10 pm: walk now") knows when the person had the meal, not when it started. Plan 2 (its D50) left this plan to decide.
- The plan marks it `meal.basis: 'had'`.
- Its records are tagged `afterMeal` with no `mealStartedAt`, so D26's matching still works.
- Its note and summary say "had at", never "started".

- [ ] **Step 1: Write the failing test** `src/walk/start.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { Permission } from '@/engine/permission';
import type { WalkPlan } from './clock';
import { createStarter, type StartPorts } from './start';

const PLAN: WalkPlan = { kind: 'walk', gps: true, steps: true };
const ALLOWED: Permission = { mode: 'walk', allowed: true, disposition: 'reassure', reasons: [], restrictions: [], codes: [], needsCheckIn: false };
const STALE: Permission = { ...ALLOWED, allowed: false, disposition: 'hold', reasons: ['With insulin or a sulfonylurea, check your glucose within 30 minutes of starting.'], needsCheckIn: true };

function ports(over: Partial<StartPorts> = {}) {
  const calls: string[] = [];
  const started: WalkPlan[] = [];
  const p: StartPorts = {
    requestMotion: () => { calls.push('motion'); return Promise.resolve('granted'); },
    unlockAudio: () => { calls.push('audio'); return Promise.resolve(true); },
    gate: () => { calls.push('gate'); return ALLOWED; },
    go: plan => { calls.push('go'); started.push(plan); },
    ...over,
  };
  return { p, calls, started };
}

describe('the start sequence (B-01)', () => {
  it('asks for motion and unlocks audio before the tap’s handler returns, and does nothing else yet', () => {
    const calls: string[] = [];
    const { p } = ports({
      requestMotion: () => { calls.push('motion'); return new Promise(() => {}); },
      unlockAudio: () => { calls.push('audio'); return new Promise(() => {}); },
      gate: () => { calls.push('gate'); return ALLOWED; },
    });
    void createStarter(p).tap(PLAN, { voice: true });
    expect(calls).toEqual(['motion', 'audio']);
  });

  it('waits for both answers, then asks the gate, then starts once', async () => {
    const { p, calls, started } = ports();
    expect(await createStarter(p).tap(PLAN, { voice: true })).toEqual({ kind: 'started', plan: PLAN });
    expect(calls).toEqual(['motion', 'audio', 'gate', 'go']);
    expect(started).toEqual([PLAN]);
  });

  it('asks for nothing it doesn’t need: no motion without steps, no audio without the voice', async () => {
    const { p, calls } = ports();
    await createStarter(p).tap({ ...PLAN, steps: false }, { voice: false });
    expect(calls).toEqual(['gate', 'go']);
  });

  it('shows the gate’s new answer instead of starting, when it changed meanwhile (J§4.1, V-J19)', async () => {
    const { p, started } = ports({ gate: () => STALE });
    expect(await createStarter(p).tap(PLAN, { voice: false })).toEqual({ kind: 'refused', permission: STALE });
    expect(started).toEqual([]);
  });

  it('starts once however many times the button is tapped', async () => {
    const { p, started } = ports();
    const starter = createStarter(p);
    const first = starter.tap(PLAN, { voice: false });
    expect(await starter.tap(PLAN, { voice: false })).toEqual({ kind: 'busy' });
    await first;
    expect(await starter.tap(PLAN, { voice: false })).toEqual({ kind: 'busy' });
    expect(started).toHaveLength(1);
  });

  it('can be tried again after a refusal', async () => {
    let answer = STALE;
    const { p, started } = ports({ gate: () => answer });
    const starter = createStarter(p);
    await starter.tap(PLAN, { voice: false });
    answer = ALLOWED;
    expect((await starter.tap(PLAN, { voice: false })).kind).toBe('started');
    expect(started).toHaveLength(1);
  });

  it('walks without counting steps when motion is refused, and says so (§9.1)', async () => {
    const { p, started } = ports({ requestMotion: () => Promise.resolve('denied') });
    await createStarter(p).tap(PLAN, { voice: false });
    expect(started[0]).toMatchObject({ steps: false, stepsDenied: true });
  });

  it('still starts when the audio can’t be unlocked: cues are optional', async () => {
    const { p } = ports({ unlockAudio: () => Promise.reject(new Error('NotAllowedError')) });
    expect((await createStarter(p).tap(PLAN, { voice: true })).kind).toBe('started');
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/walk/start.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write** `src/walk/start.ts`

```ts
/**
 * Starting a walk (B-01, motion M10), in one order:
 * 1. in the tap's own handler, ask for motion and unlock audio, synchronously,
 *    because iOS accepts both only there (A-53, L-02);
 * 2. wait for both answers: a person may take a while over the system prompt;
 * 3. ask the gate again: the decision may have changed meanwhile (J§4.1);
 * 4. start once.
 * Refused, nothing starts and the new answer is shown instead.
 */
import type { Permission } from '@/engine/permission';
import type { WalkPlan } from './clock';
import { allowsMovement } from './gate';

export type MotionAnswer = 'granted' | 'denied' | 'unsupported';

export interface StartPorts {
  /** iOS's motion permission. Must be called from the tap. */
  requestMotion(): Promise<MotionAnswer>;
  /** The cue player's one audio element, unlocked. Must be called from the tap. */
  unlockAudio(): Promise<boolean>;
  /** The final gate, asked once the answers are in, never cached from the screen. */
  gate(): Permission;
  go(plan: WalkPlan): void;
}

export type StartOutcome =
  | { kind: 'started'; plan: WalkPlan }
  | { kind: 'refused'; permission: Permission }
  | { kind: 'busy' };

export function createStarter(ports: StartPorts): { tap(plan: WalkPlan, wants: { voice: boolean }): Promise<StartOutcome> } {
  let busy = false;
  return {
    tap(plan, wants) {
      if (busy) return Promise.resolve({ kind: 'busy' });
      busy = true;
      // (1) Before anything is awaited.
      const motion = plan.steps ? ports.requestMotion() : Promise.resolve<MotionAnswer>('unsupported');
      const audio = wants.voice ? ports.unlockAudio() : Promise.resolve(false);
      // (2), (3), (4).
      return Promise.all([motion.catch((): MotionAnswer => 'denied'), audio.catch(() => false)]).then(([m]): StartOutcome => {
        const permission = ports.gate();
        if (!allowsMovement(permission)) {
          busy = false;
          return { kind: 'refused', permission };
        }
        const started: WalkPlan = m === 'denied' ? { ...plan, steps: false, stepsDenied: true } : plan;
        ports.go(started);
        return { kind: 'started', plan: started };
      });
    },
  };
}
```

Run: `npx vitest run src/walk/start.test.ts`
Expected: PASS.

- [ ] **Step 4: What the plan carries.** In `src/walk/clock.ts`:

```ts
/** Where a walk was started from, for Done to return there (motion M12). */
export type WalkOrigin = '/home' | '/hub/walk';
```

`WalkPlan` gains these, and `meal` becomes `meal?: { which: Meal; startedAt: number; basis?: 'had' }`:

```ts
  /** Motion access was turned down at the start (B-01): steps aren't counted, and the walk says so. */
  stepsDenied?: boolean;
  /** Where Done returns to. */
  from?: WalkOrigin;
```

Comment `basis`: `/** 'had': the person said when they had the meal (B-09), not when it started. Absent: when it started. */`

In `src/walk/plan.ts`:

```ts
/** The origin a start was made from (motion M12): the Walk hub, or Home for everything else. */
export function originOf(pathname: string): WalkOrigin {
  return pathname.startsWith('/hub/walk') ? '/hub/walk' : '/home';
}

/** The plan in a live walk's address, or nothing for any other address. */
export function walkPlanOf(href: string, now: number = Date.now()): WalkPlan | undefined {
  const prefix = '/walk/live?';
  if (!href.startsWith(prefix)) return undefined;
  return walkFromSearch(new URLSearchParams(href.slice(prefix.length)), now)?.plan;
}
```

- In `liveHref`:
  - write `steps` as `if (plan.stepsDenied) q.set('steps', 'denied'); else if (plan.steps) q.set('steps', '1');`;
  - add `if (plan.from) q.set('from', plan.from === '/hub/walk' ? 'walk' : 'home');`;
  - inside the meal branch, add `if (plan.meal.basis === 'had') q.set('mealBasis', 'had');`.
- In `walkFromSearch`:
  - the meal is `{ which, startedAt: Math.min(at, now), ...(search.get('mealBasis') === 'had' ? { basis: 'had' as const } : {}) }`;
  - add `...(search.get('steps') === 'denied' ? { stepsDenied: true } : {})`;
  - add `...(search.get('from') === 'walk' ? { from: '/hub/walk' as const } : search.get('from') === 'home' ? { from: '/home' as const } : {})`.

  `steps` stays `search.get('steps') === '1'`.

In `src/walk/persist.ts`'s `isPlan`, before `return true`:

```ts
  if (v.stepsDenied !== undefined && v.stepsDenied !== true) return false;
  if (v.from !== undefined && v.from !== '/home' && v.from !== '/hub/walk') return false;
  if (isObject(v.meal) && v.meal.basis !== undefined && v.meal.basis !== 'had') return false;
```

Append to `src/walk/plan.test.ts`:

```ts
describe('the plan in the address (B-01, B-09, M12)', () => {
  it('carries a refused motion, the origin and an after-meal time the person stated', () => {
    const plan = { kind: 'afterMeal' as const, meal: { which: 'lunch' as const, startedAt: Date.now() - 600_000, basis: 'had' as const }, gps: false, steps: false, stepsDenied: true, from: '/hub/walk' as const };
    const back = walkPlanOf(liveHref('mgh3k2x1-1a2b3c4d', plan));
    expect(back).toMatchObject({ stepsDenied: true, steps: false, from: '/hub/walk', meal: { which: 'lunch', basis: 'had' } });
  });

  it('finds a plan only in a live walk’s address', () => {
    expect(walkPlanOf('/hub/walk?meal=lunch')).toBeUndefined();
    expect(originOf('/hub/walk')).toBe('/hub/walk');
    expect(originOf('/home')).toBe('/home');
    expect(originOf('/browse')).toBe('/home');
  });
});
```

Append to `src/walk/persist.test.ts`:

```ts
it('refuses a plan field this build does not know the shape of', () => {
  const w = aWalk();
  expect(parseWalk({ ...w, plan: { ...w.plan, from: '/elsewhere' } })).toBeNull();
  expect(parseWalk({ ...w, plan: { ...w.plan, meal: { ...w.plan.meal, basis: 'ate' } } })).toBeNull();
  expect(parseWalk({ ...w, plan: { ...w.plan, stepsDenied: true } })).not.toBeNull();
});
```

- [ ] **Step 5: "Had at", never "started".** In `src/walk/record.ts`:
  - `walkObservations`' `meal` spread becomes:

```ts
  const meal = walk.plan.kind === 'afterMeal' && walk.plan.meal
    ? { tag: 'afterMeal' as const, ...(walk.plan.meal.basis === 'had' ? {} : { mealStartedAt: isoAt(walk.plan.meal.startedAt, walk.segments[0].offsetMin) }) }
    : {};
```

  - `noteFor`'s meal sentence becomes `` `${afterMealTitle(walk.plan.meal.which)}, which ${walk.plan.meal.basis === 'had' ? 'you had' : 'started'} at ${time(walk.plan.meal.startedAt)}.` ``.

In `src/walk/readout.ts`'s `summaryRows`, the meal row becomes:

```ts
  if (meal) {
    rows.push(meal.basis === 'had'
      ? { label: afterMealTitle(meal.which), value: `Had at ${time(meal.startedAt)}`, detail: 'When you had the meal' }
      : { label: afterMealTitle(meal.which), value: `Started ${time(meal.startedAt)}`, detail: 'When the meal started' });
  }
```

Append to `src/walk/record.test.ts`:

```ts
it('records a walk after a meal the person had at a time they stated, tagged but with no start (B-09)', () => {
  const w = afterDinner({ kind: 'afterMeal', meal: { which: 'dinner', startedAt: s(-1200), basis: 'had' } });
  const records = walkObservations(w, { time });
  expect(records.every(r => r.tag === 'afterMeal' && r.mealStartedAt === undefined)).toBe(true);
  expect(byKind(records, 'walkDuration')[0].note).toBe('After dinner, which you had at 7:10 pm.');
});
```

Append to `src/walk/readout.test.ts`'s `summary rows`:

```ts
it('says "had at" for a meal time the person stated (B-09)', () => {
  const w = finishWalk(startWalk('abcd-1234', { kind: 'afterMeal', meal: { which: 'lunch', startedAt: T - 600_000, basis: 'had' }, gps: false, steps: false }, T), T + 600_000, 'finish');
  expect(summaryRows(w, summarise(w), { time })[0]).toEqual({ label: 'After lunch', value: 'Had at 7:10 pm', detail: 'When you had the meal' });
});
```

- [ ] **Step 6: B-01's final gate, asked of the device.** In `src/walk/gate.ts`, import `type Permission` from `@/engine/permission` (already imported), and add:

```ts
/**
 * B-01's final gate: the start question at this moment, asked of what the
 * device holds now (answers waiting to be stored included), never of a
 * screen's copy from before a system prompt.
 */
export function storeStartPermission(now: Date = new Date()): Permission {
  const all = deviceClinical(getState());
  const clinical: Clinical = { profile: all.profile, checkIns: reachableHistory(all.checkIns, toDateString(now), all.profile) };
  return startGate(walkInput(clinical, now), 'walk');
}
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/walk`
Expected: PASS.

- [ ] **Step 8: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/walk
git commit -m "feat: Start a walk by B-01's order, and carry its origin and meal time in the plan"
```

---
### Task 8: The first-walk questions, and every walk through one start

**Files:**
- Create: `src/walk/consent.ts`, `src/walk/consent.test.ts`
- Create: `src/screens/walk/PreflightSheet.tsx`, `src/screens/walk/useWalkFlow.tsx`
- Create: `src/screens/walk/walkStart.callers.test.ts`
- Modify: `src/components/checkin/useStartMovement.tsx` (the walk path)
- Modify: `src/screens/home/tileLine.ts` (export `holdHeadline`)
- Modify: `src/screens/hub/WalkHub.tsx` (B-09's walk is "had at"; the GPS switch's words; no early motion request)
- Modify: `src/screens/home/HomeScreen.tsx` and `src/walk/plan.ts` (Home's direct walk: "had at", and no early motion request)
- Modify: `src/components/checkin/sheet.callers.test.ts` and any other test whose `react-router-dom` mock now needs `useLocation`

**Interfaces:**
- **Consumes:**
  - `UserSettings.walk` (Task 1);
  - `createStarter`, `walkPlanOf`, `originOf` and `storeStartPermission` (Task 7);
  - `walkVoice().unlock(pack)` (Task 9 builds it). Until then, Step 6 gives the minimal `src/walk/voice.ts` this task needs.
- **Produces, in `consent.ts`:**
  - `type WalkSettings = NonNullable<UserSettings['walk']>`;
  - `UNASKED: WalkSettings`;
  - `walkSettings(s: Pick<UserSettings, 'walk'>): WalkSettings`;
  - `type PreflightPage = 'keepRoute' | 'mapPictures' | 'stepCard'`;
  - `preflightPages(walk: WalkSettings, plan: Pick<WalkPlan, 'gps' | 'steps'>): PreflightPage[]`;
  - `type PreflightAnswer = { page: 'keepRoute'; keep: boolean } | { page: 'mapPictures'; show: boolean } | { page: 'stepCard' }`;
  - `answered(walk: WalkSettings, a: PreflightAnswer): WalkSettings`;
  - `withConsent(plan: WalkPlan, walk: WalkSettings): WalkPlan`;
  - `routeNote(walk: WalkSettings): string`;
  - `CONSENT`: the exact words.
- **Produces, in `useWalkFlow.tsx`:** `useWalkFlow(onCheckIn: (plan: WalkPlan) => void): { begin(plan: WalkPlan): void; ui: ReactNode }`.
- **Produces, in `PreflightSheet.tsx`:** `interface PreflightStage { plan: WalkPlan; walk: WalkSettings; refusal?: Permission }` and `PreflightSheet({ stage, onAnswer, onCheckIn, onClose })`.
- **Produces, in `useStartMovement`:** the same signature. Every `start(mode, href, label)` whose href is a `/walk/live?…` address goes through `useWalkFlow` in place of `navigate`. Its `sheet` now also renders the preflight sheet.
- **Produces, in `tileLine.ts`:** `holdHeadline(p: Permission): string | undefined`.

**The flow, from the tap that asks for a walk:**
1. **The gate at the tap** (as before). If a check-in is due, the check-in sheet opens.
2. **The first-walk questions,** while any are unanswered: "Keep a record of your route on this phone?", then "Show map pictures under your saved routes?" (only while routes may be kept), then the step card (only when counting steps).
   - Each answer is stored at once.
   - The last answer's tap is the tap that starts the walk.
3. **B-01's sequence,** in that last tap. A refusal shows the gate's headline and reasons in the same sheet, with "Check in" when a check-in answers it. Starting again asks no question twice.

- [ ] **Step 1: Write the failing test** `src/walk/consent.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { CONSENT, UNASKED, answered, preflightPages, routeNote, walkSettings, withConsent } from './consent';

const GPS = { gps: true, steps: false };

describe('the first-walk questions (journey §9.1)', () => {
  it('asks both route questions on the first walk with location; the map one only while routes may be kept', () => {
    expect(preflightPages(UNASKED, GPS)).toEqual(['keepRoute', 'mapPictures']);
    expect(preflightPages(answered(UNASKED, { page: 'keepRoute', keep: false }), GPS)).toEqual([]);
    expect(preflightPages(answered(UNASKED, { page: 'keepRoute', keep: true }), GPS)).toEqual(['mapPictures']);
  });

  it('asks nothing about routes on a walk without location', () => {
    expect(preflightPages(UNASKED, { gps: false, steps: false })).toEqual([]);
  });

  it('shows the step card once, before motion is asked for (K-29, B-24)', () => {
    expect(preflightPages(UNASKED, { gps: false, steps: true })).toEqual(['stepCard']);
    expect(preflightPages(answered(UNASKED, { page: 'stepCard' }), { gps: false, steps: true })).toEqual([]);
  });

  it('asks nothing once everything is answered', () => {
    expect(preflightPages({ saveRoutes: true, map: 'off', stepCardSeen: true }, { gps: true, steps: true })).toEqual([]);
    expect(walkSettings({})).toEqual(UNASKED);
  });

  it('keeps the route only on this phone’s yes, and only with location', () => {
    expect(withConsent({ kind: 'walk', gps: true, steps: false, keepRoute: true }, UNASKED).keepRoute).toBeUndefined();
    expect(withConsent({ kind: 'walk', gps: true, steps: false }, { saveRoutes: true, map: 'off' }).keepRoute).toBe(true);
    expect(withConsent({ kind: 'walk', gps: false, steps: false }, { saveRoutes: true, map: 'off' }).keepRoute).toBeUndefined();
  });

  it('says on the location switch what happens to the route', () => {
    expect(routeNote(UNASKED)).toBe('Uses GPS. You’ll be asked whether to keep your route.');
    expect(routeNote({ saveRoutes: true, map: 'off' })).toBe('Uses GPS. Your route is kept on this phone.');
    expect(routeNote({ saveRoutes: false, map: 'off' })).toBe('Uses GPS. Your route isn’t kept.');
  });

  it('words the questions exactly as the journey does (§9.1, B-24; the privacy sentence is Task 14’s)', () => {
    expect(CONSENT.keepRoute.title).toBe('Keep a record of your route on this phone?');
    expect(CONSENT.mapPictures.title).toBe('Show map pictures under your saved routes?');
    expect(CONSENT.mapPictures.detail).toBe('Map pictures come from OpenStreetMap. When you open a walk, they receive your internet address and the map squares for that area, so they can tell roughly where you walked. Your readings and your route file are never sent.');
    expect([CONSENT.mapPictures.yes, CONSENT.mapPictures.no]).toEqual(['Show map pictures', 'No pictures']);
    expect(CONSENT.stepCard.detail).toBe('FitStrong counts steps only while it’s open on the screen.');
  });
});
```

Run: `npx vitest run src/walk/consent.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 2: Write** `src/walk/consent.ts`

```ts
/**
 * The first walk's questions (journey §9.1, A-51, K-09): two separate route
 * consents and the one-time step card, each asked once and answerable later
 * in Me → Data. This phone's own answers, never switched on by an import (B-26).
 */
import type { UserSettings } from '@/types';
import type { WalkPlan } from './clock';

export type WalkSettings = NonNullable<UserSettings['walk']>;

export const UNASKED: WalkSettings = { saveRoutes: 'unasked', map: 'unasked' };

export function walkSettings(s: Pick<UserSettings, 'walk'>): WalkSettings {
  return s.walk ?? UNASKED;
}

export type PreflightPage = 'keepRoute' | 'mapPictures' | 'stepCard';

/** What this walk still has to ask, in order. The map question waits on the route one; the step card comes last, just before motion is asked for. */
export function preflightPages(walk: WalkSettings, plan: Pick<WalkPlan, 'gps' | 'steps'>): PreflightPage[] {
  const pages: PreflightPage[] = [];
  if (plan.gps && walk.saveRoutes === 'unasked') pages.push('keepRoute');
  if (plan.gps && walk.saveRoutes !== false && walk.map === 'unasked') pages.push('mapPictures');
  if (plan.steps && !walk.stepCardSeen) pages.push('stepCard');
  return pages;
}

export type PreflightAnswer = { page: 'keepRoute'; keep: boolean } | { page: 'mapPictures'; show: boolean } | { page: 'stepCard' };

export function answered(walk: WalkSettings, a: PreflightAnswer): WalkSettings {
  switch (a.page) {
    case 'keepRoute': return { ...walk, saveRoutes: a.keep };
    case 'mapPictures': return { ...walk, map: a.show ? 'on' : 'off' };
    case 'stepCard': return { ...walk, stepCardSeen: true };
  }
}

/** The plan as it finally starts: the route kept only on this phone's yes, and only with location (§9.1). */
export function withConsent(plan: WalkPlan, walk: WalkSettings): WalkPlan {
  const { keepRoute: _asked, ...rest } = plan;
  void _asked;
  return { ...rest, ...(plan.gps && walk.saveRoutes === true ? { keepRoute: true } : {}) };
}

/** Under the "Measure distance and pace" switch. */
export function routeNote(walk: WalkSettings): string {
  if (walk.saveRoutes === true) return 'Uses GPS. Your route is kept on this phone.';
  if (walk.saveRoutes === false) return 'Uses GPS. Your route isn’t kept.';
  return 'Uses GPS. You’ll be asked whether to keep your route.';
}

export const CONSENT = {
  keepRoute: {
    title: 'Keep a record of your route on this phone?',
    detail: 'Routes are kept only on this phone. You can change this later in Me → Data.',
    yes: 'Yes, keep routes',
    no: 'No, don’t keep routes',
  },
  mapPictures: {
    title: 'Show map pictures under your saved routes?',
    detail: 'Map pictures come from OpenStreetMap. When you open a walk, they receive your internet address and the map squares for that area, so they can tell roughly where you walked. Your readings and your route file are never sent.',
    yes: 'Show map pictures',
    no: 'No pictures',
  },
  stepCard: {
    title: 'Counting steps',
    detail: 'FitStrong counts steps only while it’s open on the screen.',
    go: 'Start walk',
  },
} as const;
```

Run: `npx vitest run src/walk/consent.test.ts`
Expected: PASS.

- [ ] **Step 3: The gate's headline, shared.** In `src/screens/home/tileLine.ts`, after `HOLD_HEADLINE`:

```ts
/** The gate's short headline for a refusal it knows (journey §7.5), as tiles say it: the walk's preflight uses it when the final gate refuses (Plan 6). */
export function holdHeadline(p: Permission): string | undefined {
  return HOLD_HEADLINE.find(([reason]) => p.reasons.some(r => r.startsWith(reason)))?.[1];
}
```

In `movementLine`, `const known = HOLD_HEADLINE.find(([reason]) => said(reason))?.[1];` becomes `const known = holdHeadline(p);`. It is the same match, so `npx vitest run src/screens/home` stays green.

- [ ] **Step 4: Write** `src/screens/walk/PreflightSheet.tsx`

```tsx
import { Sheet } from '@/components/hig/Sheet';
import { PERMISSION_TEXT, type Permission } from '@/engine/permission';
import { holdHeadline } from '@/screens/home/tileLine';
import type { WalkPlan } from '@/walk/clock';
import { CONSENT, preflightPages, type PreflightAnswer, type WalkSettings } from '@/walk/consent';
import { PrimaryButton, SecondaryButton } from './parts';

const refusalTitle = (p: Permission) => holdHeadline(p) ?? (p.disposition === 'emergency' ? PERMISSION_TEXT.emergencyTitle : 'Not now');
const TEXT = 'text-[length:var(--text-body)] leading-snug';

export interface PreflightStage {
  plan: WalkPlan;
  /** This walk's answers so far: the store may not have written the last one yet. */
  walk: WalkSettings;
  refusal?: Permission;
}

/**
 * The first walk's questions, one page at a time (journey §9.1), and the
 * gate's own answer in their place when it refuses the start (J§4.1). Each
 * page's title is the sheet's name, so VoiceOver reads the question first.
 */
export function PreflightSheet({ stage, onAnswer, onCheckIn, onClose }: {
  /** The walk asked for, the answers given so far, and the gate's refusal if it refused. */
  stage: PreflightStage | null;
  onAnswer: (a: PreflightAnswer) => void;
  onCheckIn: () => void;
  onClose: () => void;
}) {
  const page = stage && !stage.refusal ? preflightPages(stage.walk, stage.plan)[0] : undefined;
  const title = stage?.refusal ? refusalTitle(stage.refusal) : page ? CONSENT[page].title : 'Walk';
  return (
    <Sheet open={stage !== null} onOpenChange={o => { if (!o) onClose(); }} title={title} detent="large">
      {stage?.refusal ? (
        <div role="status" className={`flex flex-col gap-3 ${TEXT}`}>
          {stage.refusal.reasons.map(r => <p key={r}>{r}</p>)}
          {stage.refusal.release && <p className="text-muted-foreground">{stage.refusal.release}</p>}
          {stage.refusal.needsCheckIn
            ? <PrimaryButton onClick={onCheckIn}>Check in</PrimaryButton>
            : <PrimaryButton onClick={onClose}>Close</PrimaryButton>}
        </div>
      ) : page === 'keepRoute' ? (
        <div className="flex flex-col gap-3">
          <p className={TEXT}>{CONSENT.keepRoute.detail}</p>
          <PrimaryButton onClick={() => onAnswer({ page, keep: true })}>{CONSENT.keepRoute.yes}</PrimaryButton>
          <SecondaryButton onClick={() => onAnswer({ page, keep: false })}>{CONSENT.keepRoute.no}</SecondaryButton>
        </div>
      ) : page === 'mapPictures' ? (
        <div className="flex flex-col gap-3">
          <p className={TEXT}>{CONSENT.mapPictures.detail}</p>
          <PrimaryButton onClick={() => onAnswer({ page, show: true })}>{CONSENT.mapPictures.yes}</PrimaryButton>
          <SecondaryButton onClick={() => onAnswer({ page, show: false })}>{CONSENT.mapPictures.no}</SecondaryButton>
        </div>
      ) : page === 'stepCard' ? (
        <div className="flex flex-col gap-3">
          <p className={TEXT}>{CONSENT.stepCard.detail}</p>
          <PrimaryButton onClick={() => onAnswer({ page })}>{CONSENT.stepCard.go}</PrimaryButton>
        </div>
      ) : null}
    </Sheet>
  );
}
```

- [ ] **Step 5: Write** `src/screens/walk/useWalkFlow.tsx`

```tsx
import { useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGuided } from '@/hooks/useGuided';
import { getState, setSettings } from '@/store/useStore';
import { requestMotion } from '@/walk/browser';
import type { WalkPlan } from '@/walk/clock';
import { answered, preflightPages, walkSettings, withConsent, type PreflightAnswer, type WalkSettings } from '@/walk/consent';
import { storeStartPermission } from '@/walk/gate';
import { liveHref, newWalkId, originOf } from '@/walk/plan';
import { createStarter } from '@/walk/start';
import { walkVoice } from '@/walk/voice';
import { PreflightSheet, type PreflightStage } from './PreflightSheet';

/**
 * A walk's start, from the tap that asked for it (journey §9.1, B-01): the
 * first-walk questions while any are unanswered, then the start sequence in
 * the tap that finally starts the walk. `useStartMovement` hands it every
 * start to `/walk/live`, so every screen that starts a walk gets the same.
 */
export function useWalkFlow(onCheckIn: (plan: WalkPlan) => void): { begin(plan: WalkPlan): void; ui: ReactNode } {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { profile } = useGuided();
  const [stage, setStage] = useState<PreflightStage | null>(null);
  const pack = profile.voice.pack ?? 'af_heart';

  const starter = useMemo(() => createStarter({
    requestMotion,
    unlockAudio: () => walkVoice().unlock(pack),
    gate: () => storeStartPermission(),
    go: plan => navigate(liveHref(newWalkId(Date.now()), plan), { viewTransition: true }),
  }), [navigate, pack]);

  /**
   * The tap that finally starts the walk: B-01's sequence, inside this
   * handler. `walk` is this walk's answers, passed on rather than read back
   * from the store, which may not have written the last one yet.
   */
  const final = (plan: WalkPlan, walk: WalkSettings) => {
    const ready = withConsent({ ...plan, from: plan.from ?? originOf(pathname) }, walk);
    void starter.tap(ready, { voice: profile.voice.muted !== true }).then(outcome => {
      if (outcome.kind === 'refused') setStage({ plan, walk, refusal: outcome.permission });
      if (outcome.kind === 'started') setStage(null);
    });
  };

  const begin = (plan: WalkPlan) => {
    const walk = walkSettings(getState().settings);
    if (preflightPages(walk, plan).length > 0) setStage({ plan, walk });
    else final(plan, walk);
  };

  const answer = (a: PreflightAnswer) => {
    if (!stage) return;
    const next = answered(stage.walk, a);
    // Stored at once, whatever the gate says next: a refused start never asks again (Review Focus 5).
    void setSettings({ walk: next });
    if (preflightPages(next, stage.plan).length > 0) setStage({ plan: stage.plan, walk: next });
    else final(stage.plan, next);
  };

  const ui = (
    <PreflightSheet
      stage={stage}
      onAnswer={answer}
      onCheckIn={() => { const s = stage; setStage(null); if (s) onCheckIn(s.plan); }}
      onClose={() => setStage(null)}
    />
  );
  return { begin, ui };
}
```

- [ ] **Step 6: The voice port this task needs.** Create `src/walk/voice.ts` with only the shape below. Task 9 fills in the player and keeps every name and type here.

```ts
/** The walk's spoken cues (Task 9 fills this in). */
import type { VoiceTrouble } from '@/voice/clips';
import type { PlayResult } from '@/voice/narrator';

export type CueResult = PlayResult | 'skipped';
export type VoiceStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface WalkVoice {
  unlock(pack: string): Promise<boolean>;
  say(line: string): Promise<CueResult>;
  cancel(): void;
  readonly trouble: VoiceTrouble | null;
  readonly status: VoiceStatus;
  subscribe(listener: () => void): () => void;
}

const SILENT: WalkVoice = {
  unlock: () => Promise.resolve(false),
  say: () => Promise.resolve('skipped'),
  cancel() {},
  trouble: null,
  status: 'idle',
  subscribe: () => () => {},
};

export function walkVoice(): WalkVoice {
  return SILENT;
}
```

- [ ] **Step 7: Every walk through one start.** In `src/components/checkin/useStartMovement.tsx`:
  - import `useWalkFlow` from `@/screens/walk/useWalkFlow`, and `liveHref`, `newWalkId` and `walkPlanOf` from `@/walk/plan`;
  - add the walk path below;
  - change `start` and the check-in sheet's `onStart` to call `go`;
  - render `walk.ui` after the `CheckInSheet` inside `sheet`, wrapping both in a fragment.

  Keep the hook's name, signature and comment. Add a line to the comment: "A start to `/walk/live` is a walk: its first-walk questions and B-01's start sequence run in place of the navigation (Plan 6)."

```tsx
  // A walk's questions and start sequence (journey §9.1, B-01). A refusal that a check-in answers opens the sheet below.
  const walk = useWalkFlow(plan => setTarget({ mode: 'walk', href: liveHref(newWalkId(Date.now()), plan), startLabel: 'Start walk' }));

  /** Where an allowed start goes: a walk through its own flow, in this tap; anything else straight to its screen. */
  const go = (href: string) => {
    const plan = walkPlanOf(href);
    if (plan) walk.begin(plan);
    else navigate(href, { viewTransition: true });
  };

  const start = (mode: Mode, href: string, startLabel: string) => {
    if (startDecision(permissionFor(mode)) === 'go') go(href);
    else setTarget({ mode, href, startLabel });
  };
```

The `CheckInSheet`'s `onStart` becomes `() => { const t = target; setTarget(null); if (t) go(t.href); }`. Drop `useCallback` from `start` if the linter asks for `walk` in its dependencies; callers don't depend on its identity. Check with `grep -rn "useEffect.*start\b" src/screens src/components`.

- [ ] **Step 8: The Walk hub's own pieces.** In Plan 2's `src/screens/hub/WalkHub.tsx`, inside its `HubFrame` sections. v1's `WalkSetup` is gone by then; build on the hub's own state (`useHubGate('walk')`'s `state`, `start` and `sheet`) and never on v1's:
  - **B-09's walk.** B-09's time is when the person had the meal, so its plan says so.
    - In `src/walk/plan.ts`, `SetupChoice` gains `/** 'had': the time is when the person had the meal (B-09's button), not when it started. */ mealBasis?: 'had';`.
    - `setupPlan`'s meal becomes `{ which: c.meal, startedAt: now - c.mealAgo * 60_000, ...(c.mealBasis ? { basis: c.mealBasis } : {}) }`.
    - In `WalkHub.tsx`'s `hrefFor` (Plan 2's), pass `...(mealAt !== undefined ? { mealBasis: 'had' as const } : {})` to `setupPlan`. `mealAt` is the suggestion's own time, until the person picks a "Started" choice. Find it with `grep -n "setupPlan({" src/screens/hub/WalkHub.tsx`.
    - Append to `src/walk/plan.test.ts`:

```ts
it('marks a meal time the person stated as "had" (B-09), and a "Started" choice as the start', () => {
  const now = Date.now();
  expect(setupPlan({ kind: 'afterMeal', meal: 'lunch', mealAgo: 30, mealBasis: 'had', gps: false, steps: false }, now)?.meal).toEqual({ which: 'lunch', startedAt: now - 1_800_000, basis: 'had' });
  expect(setupPlan({ kind: 'afterMeal', meal: 'lunch', mealAgo: 20, gps: false, steps: false }, now)?.meal).toEqual({ which: 'lunch', startedAt: now - 1_200_000 });
});
```
  - **No early motion request.** In the hub's `act`, delete `if (steps && k !== 'otherTime' && k !== 'status') void requestMotion();` (Plan 2's), and any other `requestMotion()` made right before `start(...)`. B-01 asks for motion in the tap that finally starts the walk, which may be the check-in sheet's or a question's.
  - **The location switch's words.** The "Measure distance and pace" switch's detail becomes `gpsBusy ? 'Asking for your location…' : gpsNote ?? routeNote(walkSettings(state.settings))` in place of "Your route is never stored." (`state` is `useHubGate('walk')`'s store state.) Import `routeNote` and `walkSettings` from `@/walk/consent`.
  - **Home's direct walk** (K-32). The Right now card starts B-09's walk itself, through `directWalkHref` in `src/walk/plan.ts`, with the time the person had the meal as `mealStartedAt`: Plan 2's `afterMealSuggestion(…).at`, which replaces `recommend.ts`'s old `lastMealTime`.
    - `directWalkHref`'s meal becomes `{ which: walk.meal, startedAt: walk.mealStartedAt, basis: 'had' }`.
    - In `src/screens/home/HomeScreen.tsx`'s `act`, delete `if (measure.steps) void requestMotion();` and drop `requestMotion` from its import. The walk path asks in the tap that finally starts the walk, which may be the check-in's.
    - Append to `src/walk/plan.test.ts`: `it('marks Home’s after-meal walk as "had at" (B-09)', () => { expect(walkPlanOf(directWalkHref({ meal: 'lunch', mealStartedAt: Date.now() - 1_800_000 }, Date.now(), { gps: false, steps: false }))?.meal?.basis).toBe('had'); });`, adding `directWalkHref` and `walkPlanOf` to its import.
  - **Location refused** (journey §9.4). `LOCATION_NOTE.denied` becomes `'Walk without location: this walk is timed only, with steps if you count them. To measure distance, allow location for this app in your device’s settings.'`.
  - **The step card comes before the system's question** (K-29). In `toggleSteps`, ask for motion only once the card has been seen: wrap its `requestMotion()` call in `if (walkSettings(state.settings).stepCardSeen) { … }`. Before that, turning "Count steps" on only sets the switch, and the card and the system's question come at Start, in that order.

- [ ] **Step 9: Write the failing caller test** `src/screens/walk/walkStart.callers.test.ts`

```ts
/**
 * A walk's start through its real callers (B-01, journey §9.1, Review Focus 5):
 * `useStartMovement` and its walk path, the preflight sheet, and the real
 * store over a fake IndexedDB. Replaced are the router, the vendored sheet,
 * and the two platform calls, which record when they are made.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import type { CheckInRecord, DailyCheckIn } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import type { UserSettings } from '@/types';
import { createDefaultProfile, type ProfileInput } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host } from '@/test/host';

const router = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('react-router-dom', () => ({
  useNavigate: () => router.navigate,
  useLocation: () => ({ pathname: '/hub/walk', search: '', state: null, key: 'k0' }),
}));
vi.mock('@/components/ui/sheet', async () => {
  const { createElement: h, Fragment } = await import('react');
  return {
    Sheet: ({ open, children }: { open: boolean; children?: ReactNode }) => (open ? h(Fragment, null, children) : null),
    SheetContent: ({ children }: { children?: ReactNode }) => h('div', { role: 'dialog' }, children),
    SheetTitle: ({ children }: { children?: ReactNode }) => h('h2', null, children),
    SheetClose: ({ children }: { children?: ReactNode }) => h('button', { type: 'button' }, children),
  };
});
const platform = vi.hoisted(() => ({ motion: vi.fn(), audio: vi.fn() }));
vi.mock('@/walk/browser', () => ({ requestMotion: platform.motion }));
vi.mock('@/walk/voice', () => ({ walkVoice: () => ({ unlock: platform.audio, say: async () => 'skipped', cancel() {}, trouble: null, status: 'idle', subscribe: () => () => {} }) }));

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;
Object.assign(globalThis, {
  window: globalThis,
  document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {}, getElementById: () => null },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
});

const store = await import('@/store/useStore');
const { useStartMovement } = await import('@/components/checkin/useStartMovement');
const { evaluateCheckIn } = await import('@/engine/readiness');
const { liveHref } = await import('@/walk/plan');
const { resetPendingCheckInsForTests } = await import('@/components/checkin/pending');

const known = { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' as const, glucoseMonitor: 'meter' as const, glucoseUnit: 'mg/dL' as const };
const PLAIN = { health: known, voice: { muted: false } } satisfies ProfileInput;
const INSULIN = { health: { ...known, diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly' } } satisfies ProfileInput;
const DAY = '2026-10-09';
const iso = (h: number, m = 0) => new Date(2026, 9, 9, h, m, 0).toISOString();
const clock = (h: number, m = 0) => vi.setSystemTime(new Date(2026, 9, 9, h, m, 0));
const tap = (h: Host, name: string) => (h.button(name, { exact: true }).props.onClick as (e: unknown) => void)({ preventDefault() {}, stopPropagation() {} });

let host: Host | undefined;
let plan = { kind: 'walk' as const, gps: true, steps: true };

function Harness() {
  const { start, sheet } = useStartMovement();
  return createElement('div', null,
    createElement('button', { type: 'button', onClick: () => start('walk', liveHref('mgh3k2x1-1a2b3c4d', plan), 'Start walk') }, 'Begin'),
    sheet);
}

async function seeded(p: UserProfile, walk?: UserSettings['walk']) {
  const morning: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(9), source: 'meter' } };
  const rec: CheckInRecord = { ...morning, readiness: evaluateCheckIn(p, morning) };
  await store.update(prev => ({ ...prev, profile: p, checkIns: [rec], settings: { ...prev.settings, ...(walk ? { walk } : {}) } }));
  host = render(createElement(Harness));
  await host.settle();
  return host;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  clock(9, 5);
  local.clear();
  store.resetForTests();
  resetPendingCheckInsForTests();
  router.navigate = vi.fn();
  platform.motion.mockReset().mockResolvedValue('granted');
  platform.audio.mockReset().mockResolvedValue(true);
  plan = { kind: 'walk', gps: true, steps: true };
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  vi.useRealTimers();
});

describe('starting a walk (B-01)', () => {
  it('asks for motion and unlocks audio inside the tap that starts the walk, then starts it once', async () => {
    const h = await seeded(createDefaultProfile(PLAIN), { saveRoutes: false, map: 'off', stepCardSeen: true });
    tap(h, 'Begin');
    // Synchronously, before the handler's work is awaited.
    expect(platform.motion).toHaveBeenCalledTimes(1);
    expect(platform.audio).toHaveBeenCalledTimes(1);
    await h.settle();
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate.mock.calls[0][0]).toMatch(/^\/walk\/live\?.*from=walk/);
  });

  it('asks the first-walk questions first, and makes the last answer the tap that starts', async () => {
    const h = await seeded(createDefaultProfile(PLAIN));
    tap(h, 'Begin');
    await h.settle();
    expect(h.text()).toContain('Keep a record of your route on this phone?');
    expect(platform.motion).not.toHaveBeenCalled();
    tap(h, 'Yes, keep routes');
    await h.settle();
    tap(h, 'No pictures');
    await h.settle();
    expect(h.text()).toContain('FitStrong counts steps only while it’s open on the screen.');
    expect(platform.motion).not.toHaveBeenCalled();
    tap(h, 'Start walk');
    expect(platform.motion).toHaveBeenCalledTimes(1);
    await h.settle();
    expect(router.navigate.mock.calls[0][0]).toMatch(/route=1/);
    expect(store.getState().settings.walk).toEqual({ saveRoutes: true, map: 'off', stepCardSeen: true });
  });
});

describe('a start refused at the last moment (J§4.1, V-J19, Review Focus 5)', () => {
  it('shows the gate’s new answer, keeps the answers given, and asks no question twice', async () => {
    plan = { kind: 'walk', gps: true, steps: false };
    const h = await seeded(createDefaultProfile(INSULIN));
    tap(h, 'Begin');
    await h.settle();
    expect(h.text()).toContain('Keep a record of your route on this phone?');
    // The person takes their time: the 09:00 reading is no longer fresh.
    clock(9, 31);
    tap(h, 'No, don’t keep routes');
    await h.settle();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(h.text()).toContain('Check glucose first');
    expect(store.getState().settings.walk?.saveRoutes).toBe(false);
    tap(h, 'Check in');
    await h.settle();
    // The check-in asks for a fresh reading; the route question is not asked again.
    expect(h.buttons('No, don’t keep routes')).toHaveLength(0);
    expect(() => h.field('Glucose reading')).not.toThrow();
  });
});
```

Run: `npx vitest run src/screens/walk/walkStart.callers.test.ts`
Expected: FAIL before Step 7, PASS after it.

Then run `npx vitest run`. Fix any test whose `react-router-dom` mock lacks `useLocation` and now renders `useStartMovement`; it fails with "useLocation is not a function". Add `useLocation: () => ({ pathname: '/home', search: '', state: null, key: 'k0' })` to that mock. `src/components/checkin/sheet.callers.test.ts` is one.

- [ ] **Step 10: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/walk/consent.ts src/walk/consent.test.ts src/walk/voice.ts src/walk/plan.ts src/walk/plan.test.ts src/screens/walk src/components/checkin src/screens/home/tileLine.ts src/screens/home/HomeScreen.tsx src/screens/hub/WalkHub.tsx
git commit -m "feat: Ask the first walk's consents and start every walk through B-01's sequence"
```

---
### Task 9: Recorded cues at fixed minutes (J§9.2, A-72, B-01)

**Files:**
- Create: `src/walk/cues.ts`, `src/walk/cues.test.ts`
- Modify: `src/walk/voice.ts` (Task 8's port becomes the player), Create: `src/walk/voice.test.ts`
- Modify: `scripts/voice/catalog.ts`; regenerate `scripts/voice/lines.json` and the clips in `public/voice/*/`
- Modify: `src/voice/packs.node.test.ts`

**Interfaces:**
- **Consumes:** `ClipNarrator`, `loadManifest`, `primeAudio`, `VoiceManifest` and `VoiceTrouble` (`src/voice/clips.ts`); `PlayResult` (`src/voice/narrator.ts`); `splitSentences` and `clipKey` (`src/voice/sentences.ts`).
- **Produces, in `cues.ts`:**
  - `interface WalkCue { minute: number; line: string }`;
  - `WALK_CUES: readonly WalkCue[]`;
  - `CUE_GRACE_MS = 65_000`;
  - `cueDue(observedMs: number, said: ReadonlySet<number>): WalkCue | undefined`;
  - `cuesSaidBy(observedMs: number): Set<number>`.
- **Produces, in `voice.ts`** (Task 8's names and types, unchanged):
  - `type CueResult`, `type VoiceStatus`, `interface WalkVoice` and `walkVoice(): WalkVoice`;
  - `interface CuePlayerDeps { audio: HTMLAudioElement; manifest(pack: string): Promise<VoiceManifest | null>; baseUrl(pack: string): string }`;
  - `createCuePlayer(deps: CuePlayerDeps): WalkVoice`.

**What the voice does:**
- One audio element for the page, unlocked by the tap that starts the walk (Task 8 calls `unlock` there). The live screen plays through it later.
- Recorded lines only. A line with no clip is skipped, never read by the phone's own voice (A-72, and the coach's voice rule).
- Anything playing stops on pause, a hold, Finish, leaving the screen, mute, and when the system takes the audio (a call, headphones out). It's dropped, never resumed (B-01).
- The cues' clips are fetched when the pack loads, so the service worker's voice cache can play them offline later (V-J16).

- [ ] **Step 1: Write the failing test** `src/walk/cues.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { splitSentences } from '@/voice/sentences';
import { CUE_GRACE_MS, WALK_CUES, cueDue, cuesSaidBy } from './cues';

const MIN = 60_000;

describe('the walk’s cues (journey §9.2, A-72)', () => {
  it('come at 10, 20, 30, 45 and 60 minutes', () => {
    expect(WALK_CUES.map(c => c.minute)).toEqual([10, 20, 30, 45, 60]);
  });

  it('are one recorded sentence each, with no number composed into it', () => {
    for (const c of WALK_CUES) {
      expect(splitSentences(c.line)).toEqual([c.line]);
      expect(c.line).not.toMatch(/\d/);
    }
  });

  it('are due once their minute is reached, and only once', () => {
    expect(cueDue(10 * MIN - 1, new Set())).toBeUndefined();
    expect(cueDue(10 * MIN, new Set())).toEqual({ minute: 10, line: 'Ten minutes of walking.' });
    expect(cueDue(10 * MIN + 30_000, new Set([10]))).toBeUndefined();
  });

  it('are dropped once their moment is long past, as after a reload or a long hold', () => {
    expect(cueDue(10 * MIN + CUE_GRACE_MS - 1, new Set())?.minute).toBe(10);
    expect(cueDue(10 * MIN + CUE_GRACE_MS, new Set())).toBeUndefined();
    expect(cueDue(75 * MIN, new Set())).toBeUndefined();
  });

  it('count the cues a walk already past them has had, so a reopened walk repeats none', () => {
    expect([...cuesSaidBy(0)]).toEqual([]);
    expect([...cuesSaidBy(10 * MIN + 1)]).toEqual([10]);
    expect([...cuesSaidBy(46 * MIN)]).toEqual([10, 20, 30, 45]);
  });
});
```

Run: `npx vitest run src/walk/cues.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 2: Write** `src/walk/cues.ts`

```ts
/**
 * The walk's spoken cues (journey §9.2, A-72): fixed lines at fixed minutes
 * of recorded time, each one recorded sentence, so nothing is ever composed
 * from a number.
 */

export interface WalkCue {
  /** Minutes of recorded walking time. */
  minute: number;
  line: string;
}

export const WALK_CUES: readonly WalkCue[] = [
  { minute: 10, line: 'Ten minutes of walking.' },
  { minute: 20, line: 'Twenty minutes of walking.' },
  { minute: 30, line: 'Thirty minutes of walking.' },
  { minute: 45, line: 'Forty-five minutes of walking.' },
  { minute: 60, line: 'One hour of walking.' },
];

/**
 * A cue is said within 65 s of its minute. The screen redraws every second,
 * but a phone that slept, or a test clock moving a minute at a time, can step
 * past the exact moment. Later than that, the cue is dropped.
 */
export const CUE_GRACE_MS = 65_000;

const at = (c: WalkCue) => c.minute * 60_000;

/** The cue due now, if one is and it hasn't been said. */
export function cueDue(observedMs: number, said: ReadonlySet<number>): WalkCue | undefined {
  return WALK_CUES.find(c => !said.has(c.minute) && observedMs >= at(c) && observedMs < at(c) + CUE_GRACE_MS);
}

/** The cues a walk already past them has had: what a reopened live screen starts from. */
export function cuesSaidBy(observedMs: number): Set<number> {
  return new Set(WALK_CUES.filter(c => at(c) < observedMs).map(c => c.minute));
}
```

Run: `npx vitest run src/walk/cues.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing test** `src/walk/voice.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { VoiceManifest } from '@/voice/clips';
import { clipKey } from '@/voice/sentences';
import { WALK_CUES } from './cues';
import { createCuePlayer } from './voice';

const LINE = WALK_CUES[0].line;
const MANIFEST: VoiceManifest = { voice: 'af_heart', engine: 'kokoro-82m', speed: 0.72, format: 'm4a', lines: { [clipKey(LINE)]: 1400 } };

/** An <audio> element: what it played, and the two ways it stops by itself. */
function fakeAudio(opts: { blocked?: boolean } = {}) {
  const onPause = new Set<() => void>();
  const a = {
    src: '', currentTime: 0, preload: '', paused: true, ended: false,
    onended: null as null | (() => void), onerror: null as null | (() => void), onplaying: null as null | (() => void),
    played: [] as string[],
    play() {
      if (opts.blocked) return Promise.reject(Object.assign(new Error('gesture required'), { name: 'NotAllowedError' }));
      a.paused = false;
      a.ended = false;
      a.played.push(a.src);
      if (!a.src.startsWith('data:')) a.onplaying?.();
      return Promise.resolve();
    },
    pause() { a.paused = true; },
    addEventListener(type: string, fn: () => void) { if (type === 'pause') onPause.add(fn); },
    removeEventListener(type: string, fn: () => void) { if (type === 'pause') onPause.delete(fn); },
    /** The system takes the audio: a call, or headphones out. */
    interrupt() { a.paused = true; for (const fn of onPause) fn(); },
    /** The clip plays to its end: the element pauses, then ends. */
    finish() { a.ended = true; a.paused = true; for (const fn of onPause) fn(); a.onended?.(); },
  };
  return a;
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

async function ready(audio = fakeAudio(), manifest: VoiceManifest | null = MANIFEST) {
  const voice = createCuePlayer({ audio: audio as unknown as HTMLAudioElement, manifest: () => Promise.resolve(manifest), baseUrl: pack => `/voice/${pack}/` });
  await voice.unlock('af_heart');
  await flush();
  return { voice, audio };
}

describe('the walk’s cue player (journey §9.2, B-01)', () => {
  it('unlocks its one element inside the tap, before anything is awaited', () => {
    const audio = fakeAudio();
    const voice = createCuePlayer({ audio: audio as unknown as HTMLAudioElement, manifest: () => Promise.resolve(MANIFEST), baseUrl: p => `/voice/${p}/` });
    void voice.unlock('af_heart');
    expect(audio.played).toHaveLength(1);
    expect(audio.played[0]).toMatch(/^data:audio\/wav/);
  });

  it('plays a recorded cue through that element', async () => {
    const { voice, audio } = await ready();
    expect(voice.status).toBe('ready');
    const said = voice.say(LINE);
    expect(audio.played.at(-1)).toBe(`/voice/af_heart/${clipKey(LINE)}.m4a`);
    audio.finish();
    expect(await said).toBe('ended');
  });

  it('skips a line with no recording, never reading it in the phone’s own voice (A-72)', async () => {
    const { voice, audio } = await ready();
    const before = audio.played.length;
    expect(await voice.say('A line nobody recorded.')).toBe('skipped');
    expect(audio.played).toHaveLength(before);
  });

  it('drops a cue the system interrupts, and never resumes it', async () => {
    const { voice, audio } = await ready();
    const said = voice.say(LINE);
    audio.interrupt();
    expect(await said).toBe('aborted');
  });

  it('stops at once when asked: pause, a hold, Finish, leaving the screen', async () => {
    const { voice, audio } = await ready();
    const said = voice.say(LINE);
    voice.cancel();
    expect(await said).toBe('aborted');
    expect(audio.paused).toBe(true);
  });

  it('lets a new cue cut off one still playing', async () => {
    const { voice, audio } = await ready();
    const first = voice.say(LINE);
    const second = voice.say(LINE);
    expect(await first).toBe('aborted');
    audio.finish();
    expect(await second).toBe('ended');
  });

  it('says when the browser refused the audio, so the screen can ask for a tap', async () => {
    const { voice } = await ready(fakeAudio({ blocked: true }));
    expect(voice.trouble).toBe('blocked');
  });

  it('is unavailable when its pack can’t be had, as offline before it was ever loaded', async () => {
    const { voice } = await ready(fakeAudio(), null);
    expect(voice.status).toBe('unavailable');
    expect(await voice.say(LINE)).toBe('skipped');
  });
});
```

Run: `npx vitest run src/walk/voice.test.ts`
Expected: FAIL. Task 8's port is silent, so the first test finds nothing played.

- [ ] **Step 4: Write the player.** Replace `src/walk/voice.ts` with:

```ts
/**
 * The walk's spoken cues (journey §9.2, A-72, B-01): recorded Kokoro lines
 * only, through one audio element that the tap starting the walk unlocks
 * (Task 8). A line with no recording is skipped. Anything playing stops on
 * pause, a hold, Finish, leaving the screen, or when the system takes the
 * audio (a call, headphones out), and is never resumed.
 */
import { ClipNarrator, loadManifest, primeAudio, type VoiceManifest, type VoiceTrouble } from '@/voice/clips';
import type { PlayResult } from '@/voice/narrator';
import { WALK_CUES } from './cues';

export type CueResult = PlayResult | 'skipped';
export type VoiceStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface WalkVoice {
  /** Call synchronously in the tap that starts the walk: unlocks the element, then loads the pack. Resolves whether audio was allowed. */
  unlock(pack: string): Promise<boolean>;
  /** Say one recorded line now, cutting off any still playing. */
  say(line: string): Promise<CueResult>;
  /** Stop and drop whatever is playing. */
  cancel(): void;
  /** Why the voice is quiet, if it is. `blocked` needs a tap on "Turn the voice on". */
  readonly trouble: VoiceTrouble | null;
  readonly status: VoiceStatus;
  subscribe(listener: () => void): () => void;
}

export interface CuePlayerDeps {
  audio: HTMLAudioElement;
  /** The pack's manifest, or null when it can't be had. */
  manifest(pack: string): Promise<VoiceManifest | null>;
  baseUrl(pack: string): string;
}

export function createCuePlayer(deps: CuePlayerDeps): WalkVoice {
  let narrator: ClipNarrator | null = null;
  let pack: string | undefined;
  let status: VoiceStatus = 'idle';
  let trouble: VoiceTrouble | null = null;
  let current: AbortController | null = null;
  const listeners = new Set<() => void>();
  const changed = () => { for (const l of listeners) l(); };
  const report = (t: VoiceTrouble | null) => {
    if (t === trouble) return;
    trouble = t;
    changed();
  };

  function cancel() {
    const playing = current;
    current = null;
    playing?.abort();
    narrator?.stop();
  }

  // The system pausing the element mid-line drops the cue. A clip that simply
  // ended pauses too, with `ended` set, and isn't an interruption.
  deps.audio.addEventListener('pause', () => {
    if (current && !deps.audio.ended) cancel();
  });

  function load(next: string) {
    if (pack === next && status !== 'unavailable') return;
    pack = next;
    status = 'loading';
    changed();
    void deps.manifest(next).then(m => {
      if (pack !== next) return;
      narrator = m ? new ClipNarrator(m, deps.baseUrl(next), { audio: deps.audio, fallback: null, onTrouble: report }) : null;
      status = m ? 'ready' : 'unavailable';
      changed();
      // Five short clips, fetched now: the voice cache then plays them offline (V-J16).
      void narrator?.prefetch(WALK_CUES.map(c => c.line));
    });
  }

  return {
    unlock(next) {
      // A line playing proves the element is unlocked, and silence would cut it off.
      const allowed = current ? Promise.resolve(true) : primeAudio(deps.audio);
      load(next);
      return allowed.then(ok => {
        report(ok ? null : 'blocked');
        return ok;
      });
    },
    say(line) {
      if (!narrator?.has(line)) return Promise.resolve<CueResult>('skipped');
      cancel();
      const c = new AbortController();
      current = c;
      return narrator.say(line, c.signal).finally(() => {
        if (current === c) current = null;
      });
    },
    cancel,
    get trouble() { return trouble; },
    get status() { return status; },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

const SILENT: WalkVoice = {
  unlock: () => Promise.resolve(false),
  say: () => Promise.resolve('skipped'),
  cancel() {},
  trouble: null,
  status: 'idle',
  subscribe: () => () => {},
};

let player: WalkVoice | undefined;

/** The page's one cue player. With no audio element (tests, an old browser), it stays silent. */
export function walkVoice(): WalkVoice {
  if (player) return player;
  if (typeof Audio === 'undefined') return SILENT;
  const baseUrl = (pack: string) => `${import.meta.env.BASE_URL}voice/${pack}/`;
  player = createCuePlayer({ audio: new Audio(), manifest: pack => loadManifest(baseUrl(pack)), baseUrl });
  return player;
}
```

Run: `npx vitest run src/walk/voice.test.ts src/walk/cues.test.ts`
Expected: PASS.

- [ ] **Step 5: The lines are recorded.** In `scripts/voice/catalog.ts`, import `{ WALK_CUES } from '@/walk/cues'`. After `for (const line of Object.values(LOAD_LINES)) add(line);`, add:

```ts
// The walk's cues at fixed minutes (journey §9.2, Plan 6).
for (const cue of WALK_CUES) add(cue.line);
```

Append to `src/voice/packs.node.test.ts`:

```ts
describe('the walk’s cues (journey §9.2)', () => {
  it('are recorded in every pack', async () => {
    const { WALK_CUES } = await import('@/walk/cues');
    for (const id of deployed) {
      const m = read(id);
      expect(WALK_CUES.map(c => c.line).filter(l => !(clipKey(l) in m.lines)), id).toEqual([]);
    }
  });
});
```

Run:

```bash
npx tsx --tsconfig tsconfig.app.json scripts/voice/catalog.ts
sh scripts/voice/render-all.sh
npx vitest run src/voice/packs.node.test.ts
```

Expected: the catalogue reports 5 more unique sentences (fewer if any line was already there); the render tops up both packs; the pack tests PASS. Listen to the five new clips in each pack (`public/voice/af_heart/<key>.m4a`, with the key from `node -e "import('./scripts/voice/key.mjs').then(m => console.log(m.clipKey('Ten minutes of walking.')))"`). They should sound unhurried and warm. Re-render any that don't before committing.

- [ ] **Step 6: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/walk/cues.ts src/walk/cues.test.ts src/walk/voice.ts src/walk/voice.test.ts scripts/voice/catalog.ts scripts/voice/lines.json src/voice/packs.node.test.ts public/voice
git commit -m "feat: Speak recorded walk cues at fixed minutes through the unlocked element"
```

---
### Task 10: The live walk: its route drawing, figures, cues and warnings (J§9.2, M13, B-29)

**Files:**
- Create: `src/screens/walk/RouteView.tsx` (`RouteView`, `LiveRoute`)
- Create: `src/screens/walk/useWalkCues.ts`
- Modify: `src/walk/readout.ts`, `src/walk/readout.test.ts`
- Modify: `src/screens/walk/LiveWalkScreen.tsx`

**Interfaces:**
- **Consumes:**
  - `LiveSnapshot.route`, `here` and `journalFull` (Task 4);
  - `View`, `fitView`, `gridLines`, `linePaths`, `liveView`, `toView`, `withPoint` and `zoomed` (Task 2); `bboxOf`, `LatLon` and `RouteLine` (Task 1);
  - `WalkPlan.stepsDenied` (Task 7);
  - `walkVoice()`, `VoiceStatus` (Tasks 8 and 9); `cueDue` and `cuesSaidBy` (Task 9).
- **Produces, in `RouteView.tsx`:**
  - `RouteView({ view, lines, here?, ends?, grid?, label, className?, transitionName?, children? })`, the SVG drawing that the summary, the detail and the map reuse (Tasks 11 and 12);
  - `LiveRoute({ lines, here?, waiting })`.
- **Produces, in `useWalkCues.ts`:** `useWalkCues(snapshot: LiveSnapshot | null, muted: boolean): void`.
- **Produces, in `readout.ts`:**
  - `wakeHint` in the journey's words, "Keep this screen on to keep tracking.";
  - `STEPS_DENIED: Figure`;
  - `journalLine(s: Pick<LiveSnapshot, 'journalFull'>): string | undefined`;
  - `cueLine(voice: { status: VoiceStatus; trouble: VoiceTrouble | null }, online: boolean): { text: string; unlock: boolean } | undefined`;
  - `routePlaceholder(gps: LiveSnapshot['gps']): string`.

**The screen, top to bottom** (J§9.2):
1. The recording line, then any warning: the screen may sleep, the draft or the journal can't be kept, or the voice is off.
2. The hold card or the gap notice, as v1.
3. With location on, the route on a plain grid, with "Zoom in", "Zoom out" and "Show whole route". There are no map pictures, and no request leaves for one.
4. The time, the largest figure.
5. The solid figures panel: pace (only with distance), distance, and steps or "Steps not counted".
6. The stop buttons, then Pause or Resume and Finish, as v1.

- [ ] **Step 1: Write the failing test.** Append to `src/walk/readout.test.ts`, adding `STEPS_DENIED`, `cueLine`, `journalLine` and `routePlaceholder` to its import from `./readout`:

```ts
describe('the live walk’s v2 lines (journey §9.2, §9.4)', () => {
  it('asks to keep the screen on in the journey’s words', () => {
    expect(wakeHint({ wake: 'unavailable', walk: snapshot().walk, blocked: null })).toBe('Keep this screen on to keep tracking.');
  });

  it('says when the phone is out of space for the walk in progress', () => {
    expect(journalLine({ journalFull: false })).toBeUndefined();
    expect(journalLine({ journalFull: true })).toBe('This phone is out of space. Your walk is kept on this screen; free some space and tap Save.');
  });

  it('says steps aren’t counted when motion was turned down at the start', () => {
    expect(STEPS_DENIED).toEqual({ value: 'Steps not counted', note: 'Motion access was turned down when this walk started.' });
  });

  it('offers the voice after the screen was reopened, and says when cues need a connection', () => {
    expect(cueLine({ status: 'ready', trouble: null }, true)).toBeUndefined();
    expect(cueLine({ status: 'idle', trouble: null }, true)).toEqual({ text: 'Voice cues are off until you turn them on.', unlock: true });
    expect(cueLine({ status: 'ready', trouble: 'blocked' }, true)?.unlock).toBe(true);
    expect(cueLine({ status: 'unavailable', trouble: null }, false)).toEqual({ text: 'Voice cues need a connection.', unlock: false });
    expect(cueLine({ status: 'unavailable', trouble: null }, true)).toEqual({ text: 'Voice cues aren’t available right now.', unlock: false });
  });

  it('waits for a location before drawing, and says when there is none', () => {
    expect(routePlaceholder({ state: 'acquiring' })).toBe('Finding your location…');
    expect(routePlaceholder({ state: 'denied' })).toBe('Location is off, so no route is drawn.');
  });
});
```

In the existing `wakeHint` test, change the expected string to `'Keep this screen on to keep tracking.'`.

Run: `npx vitest run src/walk/readout.test.ts`
Expected: FAIL. The new names aren't exported.

- [ ] **Step 2: The words.** In `src/walk/readout.ts`, import `type VoiceTrouble` from `@/voice/clips` and `type VoiceStatus` from `./voice`. Change `wakeHint`'s string to `'Keep this screen on to keep tracking.'`, and add:

```ts
/** Steps, when motion access was turned down at the start (journey §9.1). */
export const STEPS_DENIED: Figure = { value: 'Steps not counted', note: 'Motion access was turned down when this walk started.' };

/** When the phone refused the walk's last checkpoint for want of space (journey §9.4). */
export function journalLine(s: Pick<LiveSnapshot, 'journalFull'>): string | undefined {
  return s.journalFull ? 'This phone is out of space. Your walk is kept on this screen; free some space and tap Save.' : undefined;
}

/**
 * The voice's line on the live walk (journey §9.2, V-J16). A screen opened
 * without the tap that starts a walk (a reload, a link) has a locked audio
 * element, and only a tap unlocks it.
 */
export function cueLine(voice: { status: VoiceStatus; trouble: VoiceTrouble | null }, online: boolean): { text: string; unlock: boolean } | undefined {
  if (voice.trouble === 'blocked' || voice.status === 'idle') return { text: 'Voice cues are off until you turn them on.', unlock: true };
  if (voice.status === 'unavailable') return { text: online ? 'Voice cues aren’t available right now.' : 'Voice cues need a connection.', unlock: false };
  return undefined;
}

/** Where the route will be, before there is one to draw. */
export function routePlaceholder(gps: LiveSnapshot['gps']): string {
  return gps.state === 'denied' || gps.state === 'unsupported' ? 'Location is off, so no route is drawn.' : 'Finding your location…';
}
```

Run: `npx vitest run src/walk/readout.test.ts`
Expected: PASS.

- [ ] **Step 3: Write** `src/screens/walk/RouteView.tsx`

```tsx
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';
import { fitView, gridLines, linePaths, liveView, toView, withPoint, zoomed, type View } from '@/walk/route';
import { bboxOf, type LatLon, type RouteLine } from '@/walk/routeRecord';

const CONTROL = 'press-feedback min-h-11 rounded-lg bg-grouped-card px-2 text-[length:var(--text-subhead)] font-semibold text-tint';

/**
 * Our own drawing of a route (journey §9.2, §9.5; M13, M14): one path per
 * line, never joined across a gap (A-48), on a plain grid or over the map
 * pictures passed as `children`.
 */
export function RouteView({ view, lines, here, ends = false, grid = true, label, className, transitionName, children }: {
  view: View;
  lines: readonly RouteLine[];
  /** The walker, on a live walk. */
  here?: LatLon;
  /** Start and end markers, once the walk is finished (M13). */
  ends?: boolean;
  /** The plain grid, when no map pictures lie under the drawing. */
  grid?: boolean;
  label: string;
  className?: string;
  /** The shared element the history's thumbnail grows into (M14). */
  transitionName?: string;
  children?: ReactNode;
}) {
  const g = grid ? gridLines(view) : undefined;
  const drawn = lines.filter(l => l.coords.length >= 2);
  const at = (p: LatLon) => toView(p[0], p[1], view);
  const first = drawn[0]?.coords[0];
  const last = drawn.at(-1)?.coords.at(-1);
  const dot = here ? at(here) : undefined;
  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-xl bg-grouped-card', className)}
      style={{ aspectRatio: `${view.w} / ${view.h}`, ...(transitionName ? { viewTransitionName: transitionName } : {}) }}
    >
      {children}
      <svg viewBox={`0 0 ${view.w} ${view.h}`} role="img" aria-label={label} className="absolute inset-0 size-full">
        {g && (
          <g className="stroke-separator" strokeWidth={1}>
            {g.x.map(x => <line key={`x${x}`} x1={x} x2={x} y1={0} y2={view.h} />)}
            {g.y.map(y => <line key={`y${y}`} x1={0} x2={view.w} y1={y} y2={y} />)}
          </g>
        )}
        {linePaths(drawn, view).map((d, i) => (
          <path key={drawn[i].start} d={d} fill="none" className="stroke-tint" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {ends && first && <circle cx={at(first).x} cy={at(first).y} r={6} className="fill-grouped-card stroke-tint" strokeWidth={3} />}
        {ends && last && <rect x={at(last).x - 6} y={at(last).y - 6} width={12} height={12} rx={2} className="fill-tint" />}
        {dot && <circle cx={dot.x} cy={dot.y} r={7} className="fill-tint stroke-grouped-card" strokeWidth={3} />}
      </svg>
    </div>
  );
}

/** `value`, changed at most once a second (K-08): the live drawing is redrawn no faster. */
function useEverySecond<T>(value: T): T {
  const [shown, setShown] = useState(value);
  const last = useRef(0);
  useEffect(() => {
    const wait = Math.max(0, last.current + 1000 - performance.now());
    const id = setTimeout(() => {
      last.current = performance.now();
      setShown(value);
    }, wait);
    return () => clearTimeout(id);
  }, [value]);
  return shown;
}

/**
 * The live walk's route (journey §9.2, M13, B-29): the whole route kept in
 * view by stepping the scale, never by animating. Zoom in and Zoom out fix
 * the view where it is, and "Show whole route" fits it again. Under Reduce
 * Motion the view only moves on that button. Nothing here fetches a map
 * picture (D18).
 */
export function LiveRoute({ lines, here, waiting }: { lines: readonly RouteLine[]; here?: LatLon; waiting: string }) {
  const reduce = useReducedMotion();
  const shown = useEverySecond(useMemo(() => ({ lines, here }), [lines, here]));
  const [byHand, setByHand] = useState(false);
  const [view, setView] = useState<View>();
  const box = withPoint(bboxOf(shown.lines), shown.here);
  const next = liveView(view, box, reduce || byHand ? 'fixed' : 'auto');
  // Worked out from the last view, as the route grows: React's "information from previous renders" pattern.
  if (next !== view) setView(next);

  if (!next) {
    return (
      <p className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-grouped-card px-4 text-center text-[length:var(--text-subhead)] text-muted-foreground">
        {waiting}
      </p>
    );
  }
  const zoom = (by: 1 | -1) => {
    setByHand(true);
    setView(zoomed(next, by));
  };
  const whole = () => {
    setByHand(false);
    if (box) setView(fitView(box, next.w, next.h));
  };
  return (
    <div className="flex flex-col gap-2">
      <RouteView view={next} lines={shown.lines} {...(shown.here ? { here: shown.here } : {})} label="Your route so far" />
      <div className="grid grid-cols-3 gap-2">
        <button type="button" className={CONTROL} onClick={() => zoom(1)}>Zoom in</button>
        <button type="button" className={CONTROL} onClick={() => zoom(-1)}>Zoom out</button>
        <button type="button" className={CONTROL} onClick={whole}>Show whole route</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write** `src/screens/walk/useWalkCues.ts`

```ts
import { useEffect, useRef } from 'react';
import { cueDue, cuesSaidBy } from '@/walk/cues';
import type { LiveSnapshot } from '@/walk/live';
import { walkVoice } from '@/walk/voice';

/**
 * The cues at 10, 20, 30, 45 and 60 minutes while the walk is recording and
 * the voice isn't muted (journey §9.2). A screen opened on a walk already past
 * a cue starts from there, so none is said twice. A pause, a hold, mute,
 * Finish and leaving the screen stop whatever is playing (B-01).
 */
export function useWalkCues(snapshot: LiveSnapshot | null, muted: boolean): void {
  const said = useRef<Set<number> | null>(null);
  const known = snapshot !== null;
  const recording = !!snapshot && snapshot.walk.status === 'running' && !snapshot.blocked;
  const observed = snapshot?.observedMs ?? 0;

  useEffect(() => {
    if (!known) return;
    said.current ??= cuesSaidBy(observed);
    const voice = walkVoice();
    if (!recording || muted) {
      voice.cancel();
      return;
    }
    const cue = cueDue(observed, said.current);
    if (!cue) return;
    said.current.add(cue.minute);
    void voice.say(cue.line);
  }, [known, recording, muted, observed]);

  useEffect(() => () => walkVoice().cancel(), []);
}
```

- [ ] **Step 5: The screen.** In `src/screens/walk/LiveWalkScreen.tsx`:
  - **Imports:** `useSyncExternalStore` from `react`; `LiveRoute` from `./RouteView`; `useWalkCues` from `./useWalkCues`; `walkVoice` from `@/walk/voice`; and `STEPS_DENIED`, `cueLine`, `journalLine` and `routePlaceholder` from `@/walk/readout`.
  - **After `const steps = …`**, replace that line and add:

```tsx
  const steps = snapshot.walk.plan.stepsDenied ? STEPS_DENIED : stepsFigure(snapshot.stepsState, snapshot.steps);
  const full = journalLine(snapshot);
  const cue = profile.voice.muted ? undefined : cueLine({ status: voiceStatus, trouble: voiceTrouble }, typeof navigator === 'undefined' || navigator.onLine);
```

  - **Before the early `if (!snapshot || finished) return …`**, so the hooks run on every render:

```tsx
  const player = walkVoice();
  const voiceTrouble = useSyncExternalStore(player.subscribe, () => player.trouble);
  const voiceStatus = useSyncExternalStore(player.subscribe, () => player.status);
  useWalkCues(snapshot, profile.voice.muted);
```

  - **Under the draft note**, in the first column:

```tsx
            {full && <p role="status" className="text-[length:var(--text-subhead)] font-medium leading-snug text-caution">{full}</p>}
            {cue && (
              <div className="flex flex-wrap items-center gap-x-3">
                <p role="status" className="text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{cue.text}</p>
                {cue.unlock && (
                  // In this tap: iOS unlocks audio only inside one (A-53).
                  <button type="button" onClick={() => void player.unlock(profile.voice.pack ?? 'af_heart')} className="min-h-11 text-[length:var(--text-subhead)] font-semibold text-tint">
                    Turn the voice on
                  </button>
                )}
              </div>
            )}
```

  - **Between the `aria-live` hold/notice block and the timer**, the route, with location on only:

```tsx
          {snapshot.walk.plan.gps && (
            <LiveRoute lines={snapshot.route} {...(snapshot.here ? { here: snapshot.here } : {})} waiting={routePlaceholder(snapshot.gps)} />
          )}
```

  - **Paused, the time dims** (M13, A-67): the `role="timer"` wrapper gets `className={cn(!running && 'opacity-60')}`, with no pulse or animation.

  The figures panel stays `bg-grouped-card`: solid, never glass (A-68, K-28). Steps now show whenever `steps` is set, so a walk whose motion was turned down says "Steps not counted".

Run: `npx vitest run src/screens/walk src/walk`
Expected: PASS. In node there's no `Audio`, so `walkVoice()` is the silent player: its status is `idle`, and the screen shows "Voice cues are off until you turn them on." A caller test that compares the whole screen's text needs that line added.

- [ ] **Step 6: Check by eye.** Run `npm run dev`, and in Chrome's DevTools set Sensors → Location to a custom position. At 428×926 and 320×568, in light and dark:
  - start a walk with "Measure distance and pace" on. The grid shows "Finding your location…" until the first fix, then a dot;
  - change the position in small steps: the line grows, and the view steps out only when the line reaches its edge. It never slides;
  - Zoom in, then move on: the view stays put. "Show whole route" fits the whole line again;
  - turn on Reduce motion (Me → Display, or the system setting) and reload: the view stays fixed as the line grows, until "Show whole route";
  - DevTools → Network shows no request to `tile.openstreetmap.org`;
  - at 200% text, the three buttons wrap their labels and stay at least 44 px tall.

- [ ] **Step 7: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/walk/RouteView.tsx src/screens/walk/useWalkCues.ts src/screens/walk/LiveWalkScreen.tsx src/walk/readout.ts src/walk/readout.test.ts
git commit -m "feat: Draw the live route on a plain grid and speak cues on the live walk"
```

---
### Task 11: Map pictures, the route frame and history thumbnails (J§9.5, M14, B-23)

**Files:**
- Create: `src/walk/tiles.ts`, `src/walk/tiles.test.ts`
- Create: `src/walk/tilePolicy.node.test.ts`
- Create: `src/screens/walk/StaticMap.tsx`, `src/screens/walk/RouteFrame.tsx`, `src/screens/walk/RouteThumb.tsx`, `src/screens/walk/useWalkRoute.ts`
- Modify: `vite.config.ts` (CSP `img-src`, and its comment)

**Interfaces:**
- **Consumes:** `TILE_PX`, `View`, `fitView`, `linePaths`, `zoomed` and `VIEW_SIZE` (Task 2); `RouteView` (Task 10); `RouteLine`, `RouteRecord` and `Bbox` (Task 1); `cachedJournal` and `journalPort` (Task 4).
- **Produces, in `tiles.ts`:**
  - `TILE_ORIGIN = 'https://tile.openstreetmap.org'`;
  - `ATTRIBUTION = { text: '© OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright' }`;
  - `interface Tile { z: number; x: number; y: number; url: string; left: number; top: number }`;
  - `tileUrl(z, x, y): string`;
  - `viewTiles(v: View): Tile[]`;
  - `mapUnavailable(offline: boolean): string`.
- **Produces, in the screens:**
  - `StaticMap({ view, onFail })`: the tiles only, laid under a `RouteView`;
  - `RouteFrame({ walkId, lines, bbox, mapOn })`;
  - `RouteThumb({ walkId, route })`, our own drawing, never a tile (B-23);
  - `useWalkRoute(walkId: string, kept: boolean): RouteLine[] | undefined`: the saved route, or before saving, the journalled one.

**When a tile is requested** (all of these, or none): a finished walk's summary or a saved walk's detail; a kept route; this phone's map pictures on; online; the route not hidden; and only the current view's tiles. Never during a live walk, never in the history list, never prefetched, never by the service worker.

- [ ] **Step 1: Write the failing test** `src/walk/tiles.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { TILE_PX } from './route';
import { ATTRIBUTION, mapUnavailable, tileUrl, viewTiles } from './tiles';

describe('map pictures (journey §9.5, J§22, B-23)', () => {
  const v = { z: 15, cx: 1000 * TILE_PX, cy: 500 * TILE_PX, w: 400, h: 300 };

  it('asks only for the tiles the view shows, each placed where it sits', () => {
    const tiles = viewTiles(v);
    expect(tiles.map(t => `${t.x}/${t.y}`)).toEqual(['999/499', '1000/499', '999/500', '1000/500']);
    expect(tiles[0]).toMatchObject({ z: 15, left: -56, top: -106, url: 'https://tile.openstreetmap.org/15/999/499.png' });
  });

  it('never asks for more than nine tiles at the drawing’s size, wherever the view sits', () => {
    for (const dx of [0, 37, 128, 255]) {
      for (const dy of [0, 64, 200, 255]) expect(viewTiles({ ...v, cx: v.cx + dx, cy: v.cy + dy }).length).toBeLessThanOrEqual(9);
    }
  });

  it('wraps across the date line, and never asks for a row outside the world', () => {
    const tiles = viewTiles({ z: 3, cx: 100, cy: 100, w: 400, h: 300 });
    expect(tiles.every(t => t.x >= 0 && t.x < 8 && t.y >= 0 && t.y < 8)).toBe(true);
    expect(tiles.map(t => t.x)).toEqual([7, 0, 1]);
  });

  it('uses the standard tile address, and credits OpenStreetMap with a link', () => {
    expect(tileUrl(18, 1, 2)).toBe('https://tile.openstreetmap.org/18/1/2.png');
    expect(ATTRIBUTION).toEqual({ text: '© OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright' });
  });

  it('says why there are no pictures (journey §9.4, V-J16)', () => {
    expect(mapUnavailable(true)).toBe('Map pictures unavailable. Needs a connection.');
    expect(mapUnavailable(false)).toBe('Map pictures unavailable.');
  });
});
```

Run: `npx vitest run src/walk/tiles.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 2: Write** `src/walk/tiles.ts`

```ts
/**
 * Map pictures (journey §9.5, J§22, B-23): OpenStreetMap's standard tiles,
 * only those the current view shows, as plain <img>s. No prefetching, no
 * offline copies and no bulk download, as the tile usage policy asks; the
 * browser's ordinary HTTP cache and the page's Referer.
 */
import { TILE_PX, type View } from './route';

export const TILE_ORIGIN = 'https://tile.openstreetmap.org';

export const ATTRIBUTION = { text: '© OpenStreetMap contributors', href: 'https://www.openstreetmap.org/copyright' } as const;

export interface Tile {
  z: number;
  x: number;
  y: number;
  url: string;
  /** Where the tile's top-left corner sits in the view, in view pixels. */
  left: number;
  top: number;
}

export const tileUrl = (z: number, x: number, y: number): string => `${TILE_ORIGIN}/${z}/${x}/${y}.png`;

/** The tiles covering the view, wrapped across the date line and clipped to the world's rows. */
export function viewTiles(v: View): Tile[] {
  const n = 2 ** v.z;
  const left = v.cx - v.w / 2;
  const top = v.cy - v.h / 2;
  const x0 = Math.floor(left / TILE_PX);
  const x1 = Math.floor((left + v.w - 1) / TILE_PX);
  const y0 = Math.max(0, Math.floor(top / TILE_PX));
  const y1 = Math.min(n - 1, Math.floor((top + v.h - 1) / TILE_PX));
  const out: Tile[] = [];
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const x = ((tx % n) + n) % n;
      out.push({ z: v.z, x, y: ty, url: tileUrl(v.z, x, ty), left: tx * TILE_PX - left, top: ty * TILE_PX - top });
    }
  }
  return out;
}

/** In place of the pictures, when they can't be shown (journey §9.4, V-J16). */
export function mapUnavailable(offline: boolean): string {
  return offline ? 'Map pictures unavailable. Needs a connection.' : 'Map pictures unavailable.';
}
```

Run: `npx vitest run src/walk/tiles.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing policy test** `src/walk/tilePolicy.node.test.ts`

```ts
/**
 * The tile request's network policy, read from the files that set it
 * (J§22, B-23): the CSP admits OpenStreetMap's tile server for images and
 * nothing else new; the Referer stays valid; the service worker never
 * touches another origin; the map never prefetches.
 */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const config = fs.readFileSync('vite.config.ts', 'utf8');
const worker = fs.readFileSync('public/sw.js', 'utf8');
const map = fs.readFileSync('src/screens/walk/StaticMap.tsx', 'utf8');
const directives = [...config.matchAll(/"([a-z-]+-src [^"]*)"/g)].map(m => m[1]);

describe('map pictures and the network (J§22, B-23)', () => {
  it('admits images from the tile server, and no other origin anywhere', () => {
    expect(directives).toContain("img-src 'self' data: blob: https://tile.openstreetmap.org");
    expect(directives.filter(d => /https?:/.test(d))).toEqual(["img-src 'self' data: blob: https://tile.openstreetmap.org"]);
    expect(directives).toContain("connect-src 'self'");
  });

  it('keeps a valid Referer on every tile', () => {
    expect(config).toContain("content: 'strict-origin-when-cross-origin'");
    expect(map).not.toMatch(/referrer/i);
  });

  it('leaves tiles to the browser’s own cache: the worker passes other origins by and precaches no tile', () => {
    expect(worker).toContain('url.origin !== self.location.origin');
    expect(worker).not.toMatch(/openstreetmap|tile/i);
  });

  it('never prefetches a tile', () => {
    expect(map).not.toMatch(/prefetch|preload|new Image\(|fetch\(/);
  });
});
```

Run: `npx vitest run src/walk/tilePolicy.node.test.ts`
Expected: FAIL. `StaticMap.tsx` doesn't exist, and the CSP has no tile server.

- [ ] **Step 4: The CSP.** In `vite.config.ts`:
  - `"img-src 'self' data: blob:",` becomes:

```ts
  // Opt-in map pictures under a kept route (journey §9.5, J§22): OpenStreetMap's standard tiles, and nothing else.
  "img-src 'self' data: blob: https://tile.openstreetmap.org",
```

  - the comment above `CSP`, "Everything loads from our own origin; health data never leaves it.", becomes "Everything loads from our own origin except the opt-in map pictures, which are OpenStreetMap tiles; health data never leaves it."

- [ ] **Step 5: Write** `src/screens/walk/StaticMap.tsx`

```tsx
import { useState } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';
import { TILE_PX, type View } from '@/walk/route';
import { viewTiles } from '@/walk/tiles';

const pct = (px: number, of: number) => `${(px / of) * 100}%`;

/**
 * The map pictures under a finished walk's route (journey §9.5, M14, B-23):
 * the current view's tiles as plain <img>s, behind our own drawing. Each
 * fades in once it has loaded, at once under Reduce Motion. The frame shows
 * the attribution from the first tile. The browser's own cache and the page's
 * Referer apply; nothing here is fetched ahead.
 */
export function StaticMap({ view, onFail }: { view: View; onFail: () => void }) {
  const reduce = useReducedMotion();
  const [ready, setReady] = useState<ReadonlySet<string>>(() => new Set());
  return (
    <div aria-hidden className="absolute inset-0">
      {viewTiles(view).map(t => (
        <img
          key={t.url}
          src={t.url}
          alt=""
          width={TILE_PX}
          height={TILE_PX}
          decoding="async"
          draggable={false}
          onLoad={() => setReady(prev => new Set(prev).add(t.url))}
          onError={onFail}
          className={cn('absolute max-w-none select-none', !reduce && 'transition-opacity duration-300', ready.has(t.url) ? 'opacity-100' : 'opacity-0')}
          style={{ left: pct(t.left, view.w), top: pct(t.top, view.h), width: pct(TILE_PX, view.w), height: pct(TILE_PX, view.h) }}
        />
      ))}
    </div>
  );
}
```

Run: `npx vitest run src/walk/tilePolicy.node.test.ts`
Expected: PASS.

- [ ] **Step 6: Write** `src/screens/walk/RouteFrame.tsx`

```tsx
import { useMemo, useState } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { fitView, zoomed, VIEW_SIZE, type View } from '@/walk/route';
import type { Bbox, RouteLine } from '@/walk/routeRecord';
import { ATTRIBUTION, mapUnavailable } from '@/walk/tiles';
import { RouteView } from './RouteView';
import { StaticMap } from './StaticMap';

const CONTROL = 'press-feedback min-h-11 rounded-lg bg-grouped-card px-2 text-[length:var(--text-subhead)] font-semibold text-tint';

/**
 * A finished walk's route (journey §9.5, M14): our drawing with its start and
 * end, fitted to the whole route, with Zoom in, Zoom out and Recentre. With
 * this phone's map pictures on and a connection, the view's tiles lie under
 * it. "Hide map" hides the route and every location (A-51), and nothing is
 * requested while it's hidden.
 */
export function RouteFrame({ walkId, lines, bbox, mapOn }: { walkId: string; lines: readonly RouteLine[]; bbox: Bbox; mapOn: boolean }) {
  const reduce = useReducedMotion();
  const fit = useMemo(() => fitView(bbox, VIEW_SIZE.w, VIEW_SIZE.h), [bbox]);
  const [view, setView] = useState<View>(fit);
  const [hidden, setHidden] = useState(false);
  const [failed, setFailed] = useState(false);
  const online = typeof navigator === 'undefined' || navigator.onLine;
  const pictures = mapOn && online && !failed;

  if (hidden) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-grouped-card p-4">
        <p className="text-[length:var(--text-body)] text-muted-foreground">Map hidden</p>
        <button type="button" className={CONTROL} onClick={() => setHidden(false)}>Show map</button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <RouteView view={view} lines={lines} ends grid={!pictures} label="Your route" {...(reduce ? {} : { transitionName: `route-${walkId}` })}>
        {pictures && <StaticMap view={view} onFail={() => setFailed(true)} />}
      </RouteView>
      {pictures && (
        <a href={ATTRIBUTION.href} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center self-end px-1 text-[length:var(--text-footnote)] text-tint underline">
          {ATTRIBUTION.text}
        </a>
      )}
      {mapOn && !pictures && <p role="status" className="text-[length:var(--text-footnote)] text-muted-foreground">{mapUnavailable(!online)}</p>}
      <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-4">
        <button type="button" className={CONTROL} onClick={() => setView(zoomed(view, 1))}>Zoom in</button>
        <button type="button" className={CONTROL} onClick={() => setView(zoomed(view, -1))}>Zoom out</button>
        <button type="button" className={CONTROL} onClick={() => setView(fit)}>Recentre</button>
        <button type="button" className={CONTROL} onClick={() => setHidden(true)}>Hide map</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Write** `src/screens/walk/RouteThumb.tsx` and `src/screens/walk/useWalkRoute.ts`

```tsx
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { fitView, linePaths } from '@/walk/route';
import type { RouteRecord } from '@/walk/routeRecord';

/**
 * A walk's route in the history (journey §9.5, B-23): our own small drawing,
 * never a map picture. It grows into the detail's frame (M14), except under
 * Reduce Motion, where neither carries the shared name, as Home's tiles do.
 */
export function RouteThumb({ walkId, route }: { walkId: string; route: Pick<RouteRecord, 'segments' | 'bbox'> }) {
  const reduce = useReducedMotion();
  const view = fitView(route.bbox, 64, 64, 6);
  return (
    <svg viewBox="0 0 64 64" aria-hidden className="size-7" style={reduce ? undefined : { viewTransitionName: `route-${walkId}` }}>
      {linePaths(route.segments, view).map((d, i) => (
        <path key={route.segments[i]?.start ?? i} d={d} fill="none" className="stroke-tint" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
```

```ts
import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { cachedJournal, journalPort } from '@/walk/journalPort';
import type { RouteLine, RouteRecord } from '@/walk/routeRecord';

/**
 * A walk's route: the saved one, or, before the walk is saved, the one
 * journalled as it was walked (this page's copy first, then IndexedDB).
 * Nothing for a walk whose route isn't kept.
 */
export function useWalkRoute(walkId: string, kept: boolean): RouteLine[] | undefined {
  const { records } = useStore();
  const saved = records.routes.find(r => r.walkId === walkId) as RouteRecord | undefined;
  const [journalled, setJournalled] = useState<RouteLine[] | undefined>(() => cachedJournal(walkId)?.route);
  useEffect(() => {
    if (saved || !kept || journalled) return;
    let current = true;
    void journalPort().read(walkId).then(entry => {
      if (current && entry?.route) setJournalled(entry.route);
    });
    return () => { current = false; };
  }, [walkId, kept, saved, journalled]);
  return saved?.segments ?? (kept ? journalled : undefined);
}
```

`RouteThumb`'s paths come from `linePaths`, which drops lines of fewer than two points, as the record never holds (Task 1's `routeRecord`).

- [ ] **Step 8: Gates and commit.** The frame and the thumbnail are placed in Task 12 and checked by eye there.

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/walk/tiles.ts src/walk/tiles.test.ts src/walk/tilePolicy.node.test.ts src/screens/walk/StaticMap.tsx src/screens/walk/RouteFrame.tsx src/screens/walk/RouteThumb.tsx src/screens/walk/useWalkRoute.ts vite.config.ts
git commit -m "feat: Show opt-in OpenStreetMap pictures under a kept route, viewport tiles only"
```

---
### Task 12: The summary, the walk's detail and its history row (J§9.5, M12, M13, M14)

**Files:**
- Modify: `src/walk/record.ts`, `src/walk/record.test.ts` (`WalkSummary.coveredMs` and `stepsCoveredMs`)
- Modify: `src/walk/readout.ts`, `src/walk/readout.test.ts` (`summaryRows` v2, `splitRows`, `noRouteLine`)
- Modify: `src/screens/walk/WalkSummary.tsx`, `src/screens/walk/LiveWalkScreen.tsx` (the move into the summary)
- Modify: `src/screens/track/RecordDetails.tsx` (`WalkDetail`), `src/screens/track/timeline.ts`, `src/screens/track/timeline.test.ts`, `src/screens/track/MyDay.tsx`

**Interfaces:**
- **Consumes:**
  - `saveWalk`, `removeWalk` and `removeRecords` (Tasks 1 and 4); `walkSave` (Task 4);
  - `walkEnergy`, `energyText` and `roundKcal` (Task 5); `WalkRecord.afterMeal`, `energyKcal` and `energyNote` (Task 5);
  - `splitsOf` and `Split` (Task 2); `bboxOf` (Task 1);
  - `RouteFrame`, `RouteThumb` and `useWalkRoute` (Task 11); `walkSettings` (Task 8); `STEPS_DENIED` (Task 10).
- **Produces, in `record.ts`:** `WalkSummary.coveredMs?: number` (time GPS measured; absent when GPS was off) and `WalkSummary.stepsCoveredMs?: number` (time steps were counted; absent when steps were off).
- **Produces, in `readout.ts`:**
  - `summaryRows(walk, summary, options?: { locale?: string; time?: (t: number) => string; energy?: { value: string; detail: string } }): SummaryRow[]`;
  - `splitRows(splits: readonly Split[]): SummaryRow[]`;
  - `noRouteLine(plan?: Pick<WalkPlan, 'gps' | 'keepRoute'>): string`.

**The summary, top to bottom** (J§9.5):
1. The time recorded, with the walk's span.
2. The route frame with start and end, or the line saying why there's no route.
3. The rows: the meal, distance with the time it covers, average pace (only with distance), steps with the time they cover, the energy estimate, any added time and any gap.
4. Splits for each complete kilometre, from the kept route.
5. The back-and-leg question, then Save walk, as v1.

Done returns to where the walk started (M12). The detail shows the same, read from the saved records; its route can be deleted on its own.

- [ ] **Step 1: Write the failing tests.** Append to `src/walk/record.test.ts`'s `summary` describe:

```ts
  it('says how much of the walk GPS covered and steps were counted (journey §9.5)', () => {
    let w = startWalk('abcd-1234', { kind: 'walk', gps: true, steps: true }, T);
    w = updateOpenSegment(w, x => ({ ...x, gps: [{ start: T, end: T + 90_000, distanceM: 120 }], steps: 180, motion: true }));
    w = returnToWalk(leaveWalk(w, s(120), 'hidden'), s(180)).walk;
    w = finishWalk(w, s(240), 'finish');
    const summary = summarise(w);
    expect(summary.coveredMs).toBe(90_000);
    expect(summary.stepsCoveredMs).toBe(120_000);
    expect(summarise(afterDinner({ gps: false, steps: false }))).not.toHaveProperty('coveredMs');
  });
```

Import `leaveWalk` and `returnToWalk` from `./clock` if the file doesn't already.

In `src/walk/readout.test.ts`'s `summary rows`, the first test's expected rows become:

```ts
      { label: 'After dinner', value: 'Started 7:10 pm', detail: 'When the meal started' },
      { label: 'Distance', value: '1.30 km', detail: 'Measured by GPS for 17 min of 18 min' },
      { label: 'Average pace', value: '12:49 min/km', detail: 'GPS estimate' },
      { label: 'Steps', value: '2,015', detail: 'Counted while the screen was on: 18 of 18 min' },
      { label: 'Not recorded', value: '5 min', detail: 'The app was away, so this time is not counted' },
```

Then append, adding `splitRows` and `noRouteLine` to the import:

```ts
describe('the v2 summary (journey §9.5)', () => {
  const done = (plan: Partial<WalkPlan>, seconds: number, gps?: { ms: number; m: number }) => {
    let w = startWalk('abcd-1234', { kind: 'walk', gps: true, steps: false, ...plan }, T);
    if (gps) w = updateOpenSegment(w, x => ({ ...x, gps: [{ start: T, end: T + gps.ms, distanceM: gps.m }] }));
    return finishWalk(w, T + seconds * 1000, 'finish');
  };

  it('states the covered time to the second on a short walk, where minutes would hide a dropout', () => {
    const w = done({}, 120, { ms: 90_000, m: 90 });
    expect(summaryRows(w, summarise(w), { time })[0].detail).toBe('Measured by GPS for 1 min 30 s of 2 min. The signal dropped out for part of the walk, so this may be short.');
  });

  it('says steps weren’t counted when motion was turned down at the start', () => {
    const w = done({ gps: false, stepsDenied: true }, 600);
    expect(summaryRows(w, summarise(w), { time })).toContainEqual({ label: 'Steps', value: 'Not counted', detail: 'Motion access was turned down when this walk started.' });
  });

  it('adds the energy estimate with what it was worked out from', () => {
    const w = done({ gps: false }, 600);
    const energy = { value: 'about 20 kcal', detail: 'From 10 min without distance, counted at an easy pace. Using 78 kg, from your profile.' };
    expect(summaryRows(w, summarise(w), { time, energy })).toContainEqual({ label: 'Energy (estimate)', ...energy });
  });

  it('lists each complete kilometre, and says why a walk has no route', () => {
    expect(splitRows([{ km: 1, ms: 725_000 }, { km: 2, ms: 690_000 }])).toEqual([
      { label: 'Kilometre 1', value: '12:05 min' },
      { label: 'Kilometre 2', value: '11:30 min' },
    ]);
    expect(noRouteLine({ gps: false })).toBe('No route: location was off for this walk.');
    expect(noRouteLine({ gps: true })).toBe('No route: routes aren’t kept on this phone.');
    expect(noRouteLine({ gps: true, keepRoute: true })).toBe('No route: no location was found during this walk.');
    expect(noRouteLine()).toBe('No route kept for this walk.');
  });
});
```

Import `type WalkPlan` from `./clock` if it isn't already.

Append to `src/screens/track/timeline.test.ts`, inside the describe that holds "shows a walk as one record":

```ts
  it('tags a walk after a meal even when only the time the meal was had is known (B-09)', () => {
    const at = '2026-10-08T13:40:00.000+05:30';
    const view = assembleDay(day, {
      ...empty,
      observations: [obs({ id: 'd', kind: 'walkDuration', unit: 'min', value: 10, scope: 'sessionObserved', source: 'measured', coverageMs: 600_000, context: 'walk:w1', tag: 'afterMeal', at })],
    }, DEFAULT_PREFS);
    expect(view.rows[0].detail).toContain('After a meal');
  });
```

Run: `npx vitest run src/walk/record.test.ts src/walk/readout.test.ts src/screens/track/timeline.test.ts`
Expected: FAIL.

- [ ] **Step 2: The covered times.** In `src/walk/record.ts`, `WalkSummary` gains:

```ts
  /** Time GPS measured, in ms (journey §9.5). Absent when GPS was off. */
  coveredMs?: number;
  /** Time steps were counted, in ms: the segments that had motion. Absent when steps were off. */
  stepsCoveredMs?: number;
```

`summarise` adds `...(walk.plan.gps ? { coveredMs } : {})` and `...(walk.plan.steps ? { stepsCoveredMs: counted.reduce((t, s) => t + segmentMs(s), 0) } : {})` to its result.

- [ ] **Step 3: The rows.** In `src/walk/readout.ts`, import `type Split` from `./route` and `type WalkPlan` from `./clock`. Add the helper and the two functions, and change `summaryRows` as listed after them.

```ts
/** "1 min 30 s" or "18 min": to the second under 10 minutes, where rounding to a minute would hide a dropout. */
function coverSpan(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s >= 600 || s % 60 === 0) return span(ms);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

/** One row for each complete kilometre (journey §9.5). A kilometre still under way isn't a split. */
export function splitRows(splits: readonly Split[]): SummaryRow[] {
  return splits.map(s => ({ label: `Kilometre ${s.km}`, value: `${pace(s.ms / 1000)} min` }));
}

/** In place of a route (journey §9.5, V-J20). Without the walk's plan, as on a saved walk's detail, the plain line. */
export function noRouteLine(plan?: Pick<WalkPlan, 'gps' | 'keepRoute'>): string {
  if (!plan) return 'No route kept for this walk.';
  if (!plan.gps) return 'No route: location was off for this walk.';
  if (!plan.keepRoute) return 'No route: routes aren’t kept on this phone.';
  return 'No route: no location was found during this walk.';
}
```

In `summaryRows`:
- the options type gains `energy?: { value: string; detail: string }`;
- the distance row's `detail` becomes:

```ts
        detail: `Measured by GPS for ${coverSpan(summary.coveredMs ?? 0)} of ${coverSpan(summary.observedMs)}${short ? '. The signal dropped out for part of the walk, so this may be short.' : ''}`,
```

- the steps block becomes:

```ts
  if (walk.plan.stepsDenied) {
    rows.push({ label: 'Steps', value: 'Not counted', detail: STEPS_DENIED.note });
  } else if (walk.plan.steps) {
    rows.push(summary.steps !== undefined
      ? { label: 'Steps', value: count(summary.steps, options.locale), detail: `Counted while the screen was on: ${wholeMinutes(summary.stepsCoveredMs ?? 0)} of ${wholeMinutes(summary.observedMs)} min` }
      : { label: 'Steps', value: 'Not counted', detail: 'No motion data arrived' });
  }
  if (options.energy) rows.push({ label: 'Energy (estimate)', ...options.energy });
```

Run: `npx vitest run src/walk/record.test.ts src/walk/readout.test.ts`
Expected: PASS.

- [ ] **Step 4: The history row.** In `src/screens/track/timeline.ts`'s `walkRow`, `w.mealStartedAt !== undefined && tagLabel('afterMeal')` becomes `w.afterMeal && tagLabel('afterMeal')`.

In `src/screens/track/MyDay.tsx`:
- import `RouteThumb` from `@/screens/walk/RouteThumb`, and `type RouteRecord` from `@/walk/routeRecord`;
- read `const { records } = useStore();` beside the screen's other store reads (add `useStore` to its import if it isn't there), and build `const routeOf = new Map(records.routes.map(r => [r.walkId as string, r as unknown as RouteRecord]));`;
- in the "Records" group's `Row`, add `icon={r.ref.type === 'walk' && routeOf.has(r.ref.id) ? <RouteThumb walkId={r.ref.id} route={routeOf.get(r.ref.id)!} /> : undefined}`.

Run: `npx vitest run src/screens/track`
Expected: PASS.

- [ ] **Step 5: The summary.** In `src/screens/walk/WalkSummary.tsx`:
  - **Imports:** `saveWalk as saveWalkToStore` and `removeWalk` from `@/store/useStore` (drop `addObservations` and `removeObservations`); `walkSave` from `@/walk/save`; `energyText` and `walkEnergy` from `@/walk/energy`; `splitsOf` from `@/walk/route`; `bboxOf` from `@/walk/routeRecord`; `walkSettings` from `@/walk/consent`; `noRouteLine` and `splitRows` from `@/walk/readout`; `RouteFrame` from './RouteFrame'; `useWalkRoute` from './useWalkRoute'; `useReducedMotion` from `@/hooks/useReducedMotion`. `saveObservations` is no longer used here.
  - **Before the early returns:** `const lines = useWalkRoute(walk?.id ?? '', walk?.plan.keepRoute === true);`, and read `settings` from `useStore()` beside `observations` and `status`.
  - **After `const summary = summarise(walk);`**, replace `const rows = …` with:

```tsx
  const energy = walkEnergy(walk, {
    observations,
    ...(profile.birthYear !== undefined ? { birthYear: profile.birthYear } : {}),
    ...(profile.weightKg > 0 ? { profileKg: profile.weightKg } : {}),
  });
  const rows = summaryRows(walk, summary, { energy: energyText(energy.estimate, energy.weight) });
  const box = lines ? bboxOf(lines) : undefined;
  const splits = lines ? splitRows(splitsOf(lines)) : [];
  const mapOn = walkSettings(settings).map === 'on';
  const origin = walk.plan.from ?? '/home';
```

  - **`saveWalk`** becomes:

```tsx
  const saveWalk = async () => {
    setSave({ kind: 'saving' });
    // One transaction: the records, the route and the journal's retirement (journey §18.3). A retry writes only what is missing.
    const result = await saveWalkToStore(walkSave(walk, { ...(lines ? { route: lines } : {}), ...(energy.input ? { energy: energy.input } : {}) }));
    const outcome = saveOutcome(result, getState().status === 'unavailable');
    if (outcome.kind === 'saved') clearWalk(storage);
    setSave(outcome);
  };
```

  - **`discard`** calls `removeWalk(walk.id, walkObservationIds(walk.id, getState().observations))` in place of `removeObservations(…)`, and navigates to `walk.plan.from ?? '/hub/walk'`. The early `<Navigate to="/walk" replace />` becomes `<Navigate to="/hub/walk" replace />`.
  - **`done`** becomes `() => navigate(origin, { viewTransition: true })` (M12). The `Screen`'s `back` becomes `{ to: origin, label: origin === '/hub/walk' ? 'Walk' : 'Home' }`.
  - **The first section** gets `style={reduce ? undefined : { viewTransitionName: 'walk-stats' }}`, with `const reduce = useReducedMotion();` among the hooks. Then, right after it:

```tsx
      {lines && box ? (
        <RouteFrame walkId={walk.id} lines={lines} bbox={box} mapOn={mapOn} />
      ) : (
        <p className="px-1 text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{noRouteLine(walk.plan)}</p>
      )}
```

  - **After the rows' `Group`:**

```tsx
      {splits.length > 0 && (
        <Group header="Splits" footer="Each complete kilometre, worked out from your route.">
          {splits.map(r => <Row key={r.label} label={r.label} value={r.value} numeric />)}
        </Group>
      )}
```

- [ ] **Step 6: Into the summary (M13).** In `src/screens/walk/LiveWalkScreen.tsx`:
  - the navigation to the summary becomes `navigate('/walk/summary', { replace: true, viewTransition: !reduce })`, with `const reduce = useReducedMotion();` among the hooks before the early return, importing `useReducedMotion` from `@/hooks/useReducedMotion`. Add `reduce` to that effect's dependencies;
  - the figures panel (`grid grid-cols-2 overflow-hidden rounded-xl bg-grouped-card`) gets `style={reduce ? undefined : { viewTransitionName: 'walk-stats' }}`.

  `finish()` writes the draft synchronously before the snapshot says "finished", so the move happens after the walk is kept. The panel grows into the summary's first section, and the route frame's start and end markers come with it. Under Reduce Motion it's a plain change.

- [ ] **Step 7: The detail.** In `src/screens/track/RecordDetails.tsx`'s `WalkDetail`:
  - **Imports:** `removeRecords` and `removeWalk` from `@/store/useStore`; `RouteFrame` from `@/screens/walk/RouteFrame`; `noRouteLine` from `@/walk/readout`; `roundKcal` from `@/walk/energy`; `walkSettings` from `@/walk/consent`; and `type RouteRecord` from `@/walk/routeRecord`.
  - **Reads:** `const { observations, records, settings } = useStore();`, then, after `walk` is found, `const route = records.routes.find(r => r.walkId === id) as RouteRecord | undefined;` (keep it before `if (!walk) return …`), and `const [droppingRoute, setDroppingRoute] = useState(false);` beside `confirming`.
  - **`remove`** calls `removeWalk(walk.id, doomed.map(o => o.id))`: the walk, its route and any journal go together.
  - **After the `Stat`:**

```tsx
      {route ? <RouteFrame walkId={walk.id} lines={route.segments} bbox={route.bbox} mapOn={walkSettings(settings).map === 'on'} /> : <p className="px-1 text-[length:var(--text-subhead)] text-muted-foreground">{noRouteLine()}</p>}
```

  - **In the first `Group`, after Steps:**

```tsx
        {walk.energyKcal !== undefined && roundKcal(walk.energyKcal) !== undefined && (
          <Row label="Energy (estimate)" value={`about ${roundKcal(walk.energyKcal)} kcal`} {...(walk.energyNote ? { detail: walk.energyNote } : {})} />
        )}
```

  - **In the last `Group`, before "Delete this walk":**

```tsx
        {route && <Row label={<span className="text-stop">Delete this route</span>} detail="The walk’s time and distance stay." onClick={() => { setError(undefined); setDroppingRoute(true); }} />}
```

  - **Beside the existing `ConfirmSheet`:**

```tsx
      <ConfirmSheet
        open={droppingRoute}
        onOpenChange={setDroppingRoute}
        title="Delete this route?"
        detail="Its locations are removed from this device. The walk’s time, distance and steps stay. This cannot be undone."
        confirm="Delete route"
        onConfirm={() => void removeRecords('routes', [walk.id]).then(r => (r.ok ? setDroppingRoute(false) : setError(`The route was not deleted: ${r.failure.message}`)))}
        error={error}
      />
```

  The "Delete this walk?" sheet's detail adds " Its route goes too." when `route` is set.

- [ ] **Step 8: Check by eye.** Run `npm run dev`. With Sensors → Location set, keep routes and turn map pictures on at the first walk's questions. Walk about 1.2 km in small steps (DevTools positions), then Finish. At 428×926 and 320×568, in light and dark:
  - the summary shows the route frame with start and end markers, the tiles fading in under it, and "© OpenStreetMap contributors" below it;
  - Network shows only `tile.openstreetmap.org/{z}/{x}/{y}.png` requests, at most nine per view; Zoom in requests the new view's tiles only;
  - "Hide map" leaves "Map hidden" and "Show map", and no tile request is made while hidden;
  - DevTools offline: reopen the summary. There are no tile requests, and "Map pictures unavailable. Needs a connection." shows under the drawing;
  - the rows say how much time GPS covered and steps were counted, and the estimate says "about … kcal" with what it used;
  - Splits shows "Kilometre 1";
  - Save walk, Done: back where the walk started. In Today's log the walk has its small route drawing; tapping it grows into the detail's frame;
  - the detail's "Delete this route" leaves the walk with "No route kept for this walk."

- [ ] **Step 9: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/walk/record.ts src/walk/record.test.ts src/walk/readout.ts src/walk/readout.test.ts src/screens/walk/WalkSummary.tsx src/screens/walk/LiveWalkScreen.tsx src/screens/track/RecordDetails.tsx src/screens/track/timeline.ts src/screens/track/timeline.test.ts src/screens/track/MyDay.tsx
git commit -m "feat: Show the route, coverage, splits and energy on a walk's summary and detail"
```

---
### Task 13: Home's row for a walk the app lost mid-way (J§9.4, V-J34, A-57, B-19)

**Files:**
- Create: `src/walk/recovery.ts`, `src/walk/recovery.test.ts`
- Modify: `src/walk/clock.ts` (`EndedBy` gains `'interrupted'`), `src/walk/persist.ts` (`ENDINGS`), `src/walk/readout.ts` and `src/walk/readout.test.ts` (`endingLine`)
- Create: `src/screens/home/WalkRecoveryRow.tsx`, `src/screens/home/recovery.callers.test.ts`
- Modify: `src/screens/home/HomeScreen.tsx` (the row under the Right now card)

**Interfaces:**
- **Consumes:** `readWalkJournals`, `retireWalkJournals` and `saveWalk` (Task 4); `JournalEntry` and `JOURNAL_STALE_MS` (Task 4); `walkSave` (Task 4); `walkEnergy` (Task 5); `peekWalk` (v1's `persist.ts`).
- **Produces, in `recovery.ts`:**
  - `interruptedWalk(walk: Walk): Walk`: finished where the last checkpoint left it, `endedBy: 'interrupted'`;
  - `interface Recoverable { entry: JournalEntry; walk: Walk; minutes: number }`;
  - `interface RecoveryInput { entries: readonly JournalEntry[]; now: number; observations: readonly Observation[]; draftId?: string }`;
  - `recoveryPlan(input: RecoveryInput): { offer: Recoverable[]; retire: string[]; wakeAt?: number }`;
  - `recoveryText(r: Recoverable, now: number): string`.
- **Produces, in `WalkRecoveryRow.tsx`:** `WalkRecoveryRow()`, with no props.

**What Home offers** (Review Focus 2):
- **Offered:** a journalled walk with something to save, quiet for at least two minutes (`JOURNAL_STALE_MS`), and not held by this tab's draft.
- **Left alone:** a walk this tab's draft holds, since the Walk hub offers it already. A walk whose journal is fresher than two minutes may be another tab's walk in progress; Home looks again once it would be stale.
- **Retired quietly:** a journal whose walk is already saved, or holds nothing to save.
- **Saved:** the walk ends at its last checkpoint (B-19). It's saved with its route and its energy estimate, retiring the journal, in one transaction, once however often Save is tapped.

- [ ] **Step 1: Write the failing test** `src/walk/recovery.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { newObservation } from '@/health/observation';
import { accrueOpen, startWalk } from './clock';
import { JOURNAL_STALE_MS, journalEntry } from './journal';
import { walkObservations } from './record';
import { interruptedWalk, recoveryPlan, recoveryText } from './recovery';

const MIN = 60_000;
const START = new Date(2026, 9, 8, 8, 0).getTime();

/** A walk journalled after `minutes` of recording, then nothing: the app went away. */
function lost(id: string, minutes: number, start = START) {
  const walk = accrueOpen(startWalk(id, { kind: 'walk', gps: false, steps: false }, start), minutes * MIN, start + minutes * MIN);
  return journalEntry(walk, start + minutes * MIN);
}

describe('a walk the app lost mid-way (journey §9.4, V-J34)', () => {
  it('ends at its last checkpoint, not when the app opened again (B-19)', () => {
    const e = lost('walk-aaaa', 18);
    const w = interruptedWalk(e.walk);
    expect(w).toMatchObject({ status: 'finished', endedBy: 'interrupted' });
    expect(w.segments[0]).toMatchObject({ end: e.at, accruedMs: 18 * MIN });
  });

  it('is offered once its journal has been quiet for two minutes', () => {
    const e = lost('walk-aaaa', 18);
    const plan = recoveryPlan({ entries: [e], now: e.at + JOURNAL_STALE_MS, observations: [] });
    expect(plan.offer.map(r => [r.entry.id, r.minutes])).toEqual([['walk-aaaa', 18]]);
    expect(plan.retire).toEqual([]);
  });

  it('is left alone while another tab may still be recording it, and looked at again once it would be stale (Review Focus 2)', () => {
    const e = lost('walk-aaaa', 18);
    const plan = recoveryPlan({ entries: [e], now: e.at + 30_000, observations: [] });
    expect(plan).toEqual({ offer: [], retire: [], wakeAt: e.at + JOURNAL_STALE_MS });
  });

  it('is left alone while this tab’s draft holds it: the Walk hub offers it already (Review Focus 2)', () => {
    const e = lost('walk-aaaa', 18);
    expect(recoveryPlan({ entries: [e], now: e.at + 10 * MIN, observations: [], draftId: 'walk-aaaa' })).toEqual({ offer: [], retire: [] });
  });

  it('retires the journal of a walk already saved, and of one with nothing to save', () => {
    const saved = lost('walk-aaaa', 18);
    const empty = lost('walk-bbbb', 0);
    const records = walkObservations(interruptedWalk(saved.walk)).map(i => newObservation(i));
    const plan = recoveryPlan({ entries: [saved, empty], now: saved.at + 10 * MIN, observations: records });
    expect(plan.offer).toEqual([]);
    expect([...plan.retire].sort()).toEqual(['walk-aaaa', 'walk-bbbb']);
  });

  it('says when the walk was, as a person would', () => {
    const tuesday = new Date(2026, 9, 6, 18, 0).getTime();
    const r = recoveryPlan({ entries: [lost('walk-aaaa', 18, tuesday)], now: tuesday + 3 * MIN * 60, observations: [] }).offer[0];
    expect(recoveryText(r, tuesday + 60 * MIN)).toBe('Your walk today was interrupted at 18 min. Save it?');
    expect(recoveryText(r, new Date(2026, 9, 7, 9, 0).getTime())).toBe('Your walk yesterday was interrupted at 18 min. Save it?');
    expect(recoveryText(r, new Date(2026, 9, 8, 9, 0).getTime())).toBe('Your walk on Tuesday was interrupted at 18 min. Save it?');
    expect(recoveryText(r, new Date(2026, 9, 20, 9, 0).getTime())).toBe('Your walk on 6 Oct was interrupted at 18 min. Save it?');
  });
});
```

Run: `npx vitest run src/walk/recovery.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 2: A walk can end by being interrupted.** In `src/walk/clock.ts`, `EndedBy` becomes `'finish' | 'stop' | 'low' | 'emergency' | 'stale' | 'interrupted'`. In `src/walk/persist.ts`, `ENDINGS` adds `'interrupted'`. In `src/walk/readout.ts`'s `endingLine`, before the `emergency` line:

```ts
  if (walk.endedBy === 'interrupted') {
    return `The app closed during this walk, so it ends at ${time(walk.finishedAt ?? walk.seenAt)}, when it was last kept. Here is what was recorded.`;
  }
```

Append to `src/walk/readout.test.ts`:

```ts
it('says a walk the app lost ends where it was last kept (B-19)', () => {
  const w = { ...finishWalk(startWalk('abcd-1234', { kind: 'walk', gps: false, steps: false }, T), T + 600_000, 'interrupted') };
  expect(endingLine(w, time)).toBe('The app closed during this walk, so it ends at 7:10 pm, when it was last kept. Here is what was recorded.');
});
```

Import `endingLine` there if it isn't already.

- [ ] **Step 3: Write** `src/walk/recovery.ts`

```ts
/**
 * Walks Home offers to save after the app was closed or crashed mid-walk
 * (journey §9.4, V-J34, A-57). They come from the journal, never from a draft
 * this tab still holds or a walk another tab may still be recording, and
 * never twice: a journal whose walk is saved is only tidied away.
 */
import { differenceInCalendarDays, format } from 'date-fns';
import type { Observation } from '@/health/observation';
import { finishWalk, openSegment, type Walk } from './clock';
import { JOURNAL_STALE_MS, type JournalEntry } from './journal';
import { hasRecord, summarise, walkObservationIds } from './record';

/** Finished where the last checkpoint left it (B-19): an interrupted segment ends at its last checkpoint. */
export function interruptedWalk(walk: Walk): Walk {
  if (walk.status === 'finished') return walk;
  const open = openSegment(walk);
  return finishWalk(walk, open ? open.accruedAt : walk.seenAt, 'interrupted');
}

export interface Recoverable {
  entry: JournalEntry;
  walk: Walk;
  /** Recorded minutes, at least 1. */
  minutes: number;
}

export interface RecoveryInput {
  entries: readonly JournalEntry[];
  now: number;
  observations: readonly Observation[];
  /** The walk this tab's draft holds. */
  draftId?: string;
}

export function recoveryPlan(input: RecoveryInput): { offer: Recoverable[]; retire: string[]; wakeAt?: number } {
  const offer: Recoverable[] = [];
  const retire: string[] = [];
  let wakeAt: number | undefined;
  for (const entry of input.entries) {
    if (entry.id === input.draftId) continue;
    if (walkObservationIds(entry.id, input.observations).length > 0) {
      retire.push(entry.id);
      continue;
    }
    if (input.now - entry.at < JOURNAL_STALE_MS) {
      wakeAt = Math.min(wakeAt ?? Infinity, entry.at + JOURNAL_STALE_MS);
      continue;
    }
    const walk = interruptedWalk(entry.walk);
    if (!hasRecord(walk)) {
      retire.push(entry.id);
      continue;
    }
    offer.push({ entry, walk, minutes: Math.max(1, Math.round(summarise(walk).observedMs / 60_000)) });
  }
  offer.sort((a, b) => a.walk.startedAt - b.walk.startedAt);
  return { offer, retire, ...(wakeAt !== undefined ? { wakeAt } : {}) };
}

/** "Your walk on Tuesday was interrupted at 18 min. Save it?" (journey §9.4). */
export function recoveryText(r: Recoverable, now: number): string {
  const start = new Date(r.walk.segments[0].start);
  const days = differenceInCalendarDays(new Date(now), start);
  const when = days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 7 ? `on ${format(start, 'EEEE')}` : `on ${format(start, 'd MMM')}`;
  return `Your walk ${when} was interrupted at ${r.minutes} min. Save it?`;
}
```

Run: `npx vitest run src/walk/recovery.test.ts src/walk/readout.test.ts src/walk/persist.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the failing caller test** `src/screens/home/recovery.callers.test.ts`

```ts
/**
 * Home's recovery row through its real callers (journey §9.4, V-J34, Review
 * Focus 2): the row, the real store over a fake IndexedDB, and its journal.
 * Nothing is replaced but the browser globals node lacks.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host } from '@/test/host';

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;
Object.assign(globalThis, {
  window: globalThis,
  document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {}, getElementById: () => null },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
});

const store = await import('@/store/useStore');
const { WalkRecoveryRow } = await import('./WalkRecoveryRow');
const { accrueOpen, startWalk } = await import('@/walk/clock');
const { journalEntry } = await import('@/walk/journal');

const ID = 'mgh3k2x1-1a2b3c4d';
const MIN = 60_000;
const START = new Date(2026, 9, 8, 8, 0).getTime();
const LINE = { start: START, end: START + 20_000, coords: [[12.97, 77.59], [12.9705, 77.5902], [12.971, 77.5905]] as [number, number][], ms: [0, 10_000, 20_000] };
const tap = (h: Host, name: string) => (h.button(name, { exact: true }).props.onClick as (e: unknown) => void)({ preventDefault() {}, stopPropagation() {} });
const ofWalk = () => store.getState().observations.filter(o => o.context === `walk:${ID}`);
let host: Host | undefined;

/** Eighteen minutes recorded with its route kept, then the app went away. */
async function lost() {
  const walk = accrueOpen(startWalk(ID, { kind: 'walk', gps: true, steps: false, keepRoute: true }, START), 18 * MIN, START + 18 * MIN);
  await store.putWalkJournal(journalEntry(walk, START + 18 * MIN, [LINE]));
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START + 30 * MIN);
  local.clear();
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  vi.useRealTimers();
});

describe('Home’s recovery row (journey §9.4, V-J34)', () => {
  it('saves the walk with its route once, however often Save is tapped, and retires the journal (Review Focus 2)', async () => {
    await lost();
    const h = (host = render(createElement(WalkRecoveryRow)));
    await h.settle();
    expect(h.text()).toContain('Your walk today was interrupted at 18 min. Save it?');
    tap(h, 'Save');
    tap(h, 'Save');
    await h.settle();
    expect(ofWalk().length).toBeGreaterThan(0);
    expect(new Set(ofWalk().map(o => o.id)).size).toBe(ofWalk().length);
    expect(store.getState().records.routes.map(r => r.walkId)).toEqual([ID]);
    const left = await store.readWalkJournals();
    expect(left.ok && left.value).toEqual([]);
    expect(h.text()).toContain('Walk saved.');
    expect(h.text()).not.toContain('was interrupted');
  });

  it('discards on request, keeping nothing of the walk', async () => {
    await lost();
    const h = (host = render(createElement(WalkRecoveryRow)));
    await h.settle();
    tap(h, 'Discard');
    await h.settle();
    tap(h, 'Discard walk');
    await h.settle();
    expect(ofWalk()).toEqual([]);
    const left = await store.readWalkJournals();
    expect(left.ok && left.value).toEqual([]);
    expect(h.text()).not.toContain('was interrupted');
  });

  it('offers nothing while the walk may still be recording in another tab (Review Focus 2)', async () => {
    await lost();
    vi.setSystemTime(START + 18 * MIN + 30_000);
    const h = (host = render(createElement(WalkRecoveryRow)));
    await h.settle();
    expect(h.text()).not.toContain('was interrupted');
  });
});
```

Run: `npx vitest run src/screens/home/recovery.callers.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 5: Write** `src/screens/home/WalkRecoveryRow.tsx`

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { getState, readWalkJournals, retireWalkJournals, saveWalk, useStore } from '@/store/useStore';
import { walkEnergy } from '@/walk/energy';
import type { JournalEntry } from '@/walk/journal';
import { peekWalk } from '@/walk/persist';
import { recoveryPlan, recoveryText, type Recoverable } from '@/walk/recovery';
import { walkSave } from '@/walk/save';
import { PrimaryButton, SecondaryButton } from '@/screens/walk/parts';

const TEXT = 'text-[length:var(--text-body)] leading-snug';

/**
 * Home's inline row for a walk the app lost mid-way (journey §9.4, V-J34):
 * "Your walk on Tuesday was interrupted at 18 min. Save it?" with Save and
 * Discard. It sits under the Right now card, so any urgent card ranks above
 * it (A-57). Save writes the walk, its route and the journal's retirement in
 * one transaction, once however often it's tapped.
 */
export function WalkRecoveryRow() {
  const { observations } = useStore();
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [draftId] = useState(() => peekWalk()?.id);
  const [confirming, setConfirming] = useState<string>();
  const [message, setMessage] = useState<string>();
  const saving = useRef(false);

  useEffect(() => {
    let current = true;
    void readWalkJournals().then(r => { if (current) setEntries(r.ok ? r.value : []); });
    return () => { current = false; };
  }, [checkedAt]);

  const plan = useMemo(
    () => (entries ? recoveryPlan({ entries, now: checkedAt, observations, ...(draftId ? { draftId } : {}) }) : undefined),
    [entries, checkedAt, observations, draftId],
  );

  // Tidying only: journals of walks already saved, or with nothing in them.
  useEffect(() => {
    if (plan && plan.retire.length > 0) void retireWalkJournals(plan.retire);
  }, [plan]);

  // A journal still fresh may be another tab's walk in progress: look again once it would be stale.
  const wakeAt = plan?.wakeAt;
  useEffect(() => {
    if (wakeAt === undefined) return;
    const id = setTimeout(() => setCheckedAt(Date.now()), Math.max(0, wakeAt - Date.now()));
    return () => clearTimeout(id);
  }, [wakeAt]);

  const save = async (r: Recoverable) => {
    // One save, however many taps arrive before the next render (Review Focus 2).
    if (saving.current) return;
    saving.current = true;
    const { profile, observations: now } = getState();
    const energy = walkEnergy(r.walk, {
      observations: now,
      ...(profile?.birthYear !== undefined ? { birthYear: profile.birthYear } : {}),
      ...(profile && profile.weightKg > 0 ? { profileKg: profile.weightKg } : {}),
    }).input;
    const result = await saveWalk(walkSave(r.walk, { ...(r.entry.route ? { route: r.entry.route } : {}), ...(energy ? { energy } : {}) }));
    saving.current = false;
    setMessage(result.ok ? 'Walk saved.' : `The walk did not save. ${result.failure.message} It is kept, so you can try again.`);
    if (result.ok) setCheckedAt(Date.now());
  };

  const discard = async (r: Recoverable) => {
    const result = await retireWalkJournals([r.entry.id]);
    setConfirming(undefined);
    setMessage(result.ok ? undefined : `The walk was not discarded. ${result.failure.message}`);
    if (result.ok) setCheckedAt(Date.now());
  };

  if (!plan) return null;
  return (
    <div aria-live="polite" className="flex flex-col gap-3">
      {plan.offer.map(r => (
        <section key={r.entry.id} className="flex flex-col gap-3 rounded-xl bg-grouped-card p-4">
          {confirming === r.entry.id ? (
            <>
              <p className={TEXT}>Discard this walk? It can’t be brought back.</p>
              <SecondaryButton onClick={() => void discard(r)} className="text-stop">Discard walk</SecondaryButton>
              <PrimaryButton onClick={() => setConfirming(undefined)}>Keep it</PrimaryButton>
            </>
          ) : (
            <>
              <p className={TEXT}>{recoveryText(r, checkedAt)}</p>
              <p className="text-[length:var(--text-footnote)] text-muted-foreground">Nothing is in your record until you save it.</p>
              <div className="grid grid-cols-2 gap-3">
                <PrimaryButton onClick={() => void save(r)}>Save</PrimaryButton>
                <SecondaryButton onClick={() => setConfirming(r.entry.id)}>Discard</SecondaryButton>
              </div>
            </>
          )}
        </section>
      ))}
      {message && <p role="status" className="px-1 text-[length:var(--text-subhead)]">{message}</p>}
    </div>
  );
}
```

`useStore().profile` may be `undefined` before setup, which the energy call allows for.

Run: `npx vitest run src/screens/home/recovery.callers.test.ts`
Expected: PASS.

- [ ] **Step 6: On Home.** In `src/screens/home/HomeScreen.tsx`, import `WalkRecoveryRow` from `./WalkRecoveryRow`, and render `<WalkRecoveryRow />` right after the `RIGHT_NOW_ID` block (the Right now card and "Something else"). An urgent surface stays above it, and the row moves nothing on the card.

Run: `npx vitest run src/screens/home`
Expected: PASS. In node the store isn't started there, so `readWalkJournals()` answers `[]` and the row renders nothing.

- [ ] **Step 7: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/walk/recovery.ts src/walk/recovery.test.ts src/walk/clock.ts src/walk/persist.ts src/walk/readout.ts src/walk/readout.test.ts src/screens/home/WalkRecoveryRow.tsx src/screens/home/recovery.callers.test.ts src/screens/home/HomeScreen.tsx
git commit -m "feat: Offer an interrupted walk on Home and save it once with its route"
```

---
### Task 14: Walks and maps in Me → Data: the consents, erasing every route, routes in backups (J§9.1, §18.3, B-05, B-24, B-26)

**Files:**
- Modify: `src/types/index.ts` (`UserSettings.walk.routesErasedAt`), `src/store/importCheck.ts`
- Modify: `src/store/useStore.ts` (`eraseRoutes`; `saveWalk` never keeps a route from before an erase), `src/store/useStore.test.ts`
- Modify: `src/walk/browser.ts` (the live walk forgets its route on an erase, in any tab)
- Modify: `src/screens/walk/useWalkRoute.ts`, `src/screens/home/WalkRecoveryRow.tsx` (nothing erased is shown again)
- Modify: `src/walk/consent.ts`, `src/walk/consent.test.ts` (`consentSummary`)
- Modify: `src/screens/you/summaries.ts`, `src/screens/you/summaries.test.ts` (`privacyLine` with B-24's map sentence, `RecordCounts.routes`, `routeNotes`)
- Modify: `src/screens/you/DataScreen.tsx` (fills Plan 4's "Walks and maps" group), `src/screens/you/DataSheets.tsx`, `src/screens/you/RestoreFlow.tsx`
- Modify: `src/screens/hub/WalkHub.tsx` (what's chosen, with a way to change it)

**Interfaces:**
- **Consumes:** `RECORD_RULES.routes`, `exportRecord({ include })`, `ImportPreview.records`, `refusedStores` and `replaceRemoves` (Task 1); `readWalkJournals` and `Change.journal` (Tasks 1 and 4); `LiveWalk.forgetRoute` and `forgetCachedRoutes` (Task 4); `CONSENT` and `walkSettings` (Task 8).
- **Produces:**
  - `UserSettings.walk.routesErasedAt?: number`: when every route was last erased on this phone. An import never carries it (`withDeviceConsent` keeps this device's `walk`);
  - `eraseRoutes(): Promise<StoreResult>` in `useStore.ts`;
  - `consentSummary(walk: WalkSettings): { routes: string; map: string }` in `consent.ts`;
  - `RecordCounts.routes?: number` and `routeNotes(preview: Pick<ImportPreview, 'records' | 'refusedStores' | 'replaceRemoves'>): string[]` in `summaries.ts`;
  - `privacyLine(device: string): string` in `summaries.ts` (Plan 4 Task 7's), now with B-24's sentence about map pictures.

**Plan 4's Data screen.** Plan 4 (Task 11) gives Me → Data a "Walks and maps" group holding one placeholder row, commented "Plan 6 replaces this group", and uses `privacyLine(device)` as the footer of Me's privacy group and of Data's "On this {device}" group. This task fills that group and finishes that sentence. If Plan 4 hasn't run yet, this task adds both where Plan 4 would: the group just before the delete group, and `privacyLine` as the "On this {device}" footer.

**Erasing every route (B-05)**, in one transaction:
- the `routes` store is emptied, its keys remembered as deleted (D-06), so a merge of an older backup can't bring them back;
- every journal entry is rewritten without its route;
- `settings.walk.routesErasedAt` is set. Every tab's live walk watches it and forgets the route it's recording, and the in-page journal cache forgets too;
- the store refuses, from then on, to keep a route whose walk started before that moment, whichever screen tries;
- this build's deletion records hold ids only (D-06), so there are no payload coordinates to clear. Plan 8 must clear its own payloads here when it adds them (board entry, Task 18).

- [ ] **Step 1: Write the failing store tests.** Append inside Task 4's `describe('saving a walk with its route and its journal …')` in `src/store/useStore.test.ts`, which has `WALK`, `T`, `LINE`, `ROUTE`, `walked` and `ofWalk`:

```ts
  const another = () => startWalk('mgh3k2x2-2b3c4d5e', { kind: 'walk', gps: true, steps: false, keepRoute: true }, T + 3_600_000);

  it('erases every route for good, keeps the walks, and leaves no coordinate anywhere (B-05)', async () => {
    await booted();
    await store.saveWalk({ walkId: WALK, observations: walkObservations(walked()), route: ROUTE });
    await store.putWalkJournal(journalEntry(another(), T + 3_660_000, [LINE]));
    expect((await store.eraseRoutes()).ok).toBe(true);
    expect(store.getState().records.routes).toEqual([]);
    expect(store.getState().settings.deleted?.records?.routes).toEqual([WALK]);
    expect(ofWalk().length).toBeGreaterThan(0);
    const left = await store.readWalkJournals();
    expect(left.ok && left.value.map(e => [e.id, e.route])).toEqual([['mgh3k2x2-2b3c4d5e', undefined]]);
    expect(store.getState().settings.walk?.routesErasedAt).toEqual(expect.any(Number));
    expect(JSON.stringify({ state: store.getState(), journals: left.ok ? left.value : [] })).not.toMatch(/12\.97|77\.59/);
  });

  it('never keeps a route of a walk that started before the erase, whichever screen saves it (B-05)', async () => {
    await booted();
    await store.eraseRoutes();
    const erasedAt = store.getState().settings.walk!.routesErasedAt!;
    const route = { ...ROUTE, startedAt: isoAt(erasedAt - 60_000, 330) };
    expect((await store.saveWalk({ walkId: WALK, observations: walkObservations(walked()), route })).ok).toBe(true);
    expect(ofWalk().length).toBeGreaterThan(0);
    expect(store.getState().records.routes).toEqual([]);
  });
```

Import `isoAt` from `@/walk/time`.

Run: `npx vitest run src/store/useStore.test.ts -t "erase"`
Expected: FAIL (`eraseRoutes` is not a function).

- [ ] **Step 2: The setting.** In `src/types/index.ts`, `UserSettings.walk` gains:

```ts
    /** When "Erase all routes" last ran on this phone (B-05): no route of a walk started before it is kept. */
    routesErasedAt?: number;
```

In `src/store/importCheck.ts`, the `walk` shape adds `routesErasedAt: num(0, 8.64e15)` to its fields (not to the required list).

- [ ] **Step 3: Erase, and the save's guard.** In `src/store/useStore.ts`, after `removeWalk`:

```ts
/**
 * B-05: every route on this device erased for good, in one transaction:
 * the saved routes (remembered as deleted, so no merge brings them back), the
 * routes in walk journals, and, through `routesErasedAt`, which every tab's
 * live walk watches, the route a walk is recording now. The walks stay.
 * Deletion records hold ids only in this build (D-06); Plan 8 clears its
 * payloads here when it adds them.
 */
export async function eraseRoutes(): Promise<StoreResult> {
  const kept = await readWalkJournals();
  if (!kept.ok) return kept;
  const stripped = kept.value.filter(e => e.route !== undefined).map(({ route: _erased, ...rest }) => {
    void _erased;
    return rest;
  });
  return enqueue<void>({
    plan: base => {
      const keys = base.records.routes.map(r => recordKey('routes', r));
      const walk = base.settings.walk ?? { saveRoutes: 'unasked' as const, map: 'unasked' as const };
      return {
        change: {
          ...(keys.length > 0 ? { records: { routes: { remove: keys } } } : {}),
          ...(stripped.length > 0 ? { journal: { put: stripped } } : {}),
          settings: { patch: { walk: { ...walk, routesErasedAt: Date.now() } } },
        },
        result: () => undefined,
      };
    },
  });
}
```

In `saveWalk`'s plan, the route is kept only when it began after the last erase:

```ts
      const erasedAt = base.settings.walk?.routesErasedAt;
      const erased = input.route !== undefined && erasedAt !== undefined && Date.parse(input.route.startedAt) <= erasedAt;
      if (input.route && !erased) {
```

That `if` replaces `if (input.route) {`. The block inside it is unchanged.

Run: `npx vitest run src/store`
Expected: PASS.

- [ ] **Step 4: Every screen forgets.**
  - **The live walk.** In `src/walk/browser.ts`, import `getState` and `subscribe` from `@/store/useStore` and `forgetCachedRoutes` from `./journalPort`. `liveWalk()` becomes:

```ts
export function liveWalk(): LiveWalk {
  if (shared) return shared;
  const live = createLiveWalk(browserPorts());
  shared = live;
  // B-05: "Erase all routes", in this tab or another, erases the route of the walk being recorded here too.
  let erased = getState().settings.walk?.routesErasedAt;
  subscribe(() => {
    const at = getState().settings.walk?.routesErasedAt;
    if (at === undefined || at === erased) return;
    erased = at;
    forgetCachedRoutes();
    live.forgetRoute();
  });
  return live;
}
```

  - **The summary's route.** In `src/screens/walk/useWalkRoute.ts`, read `const erasedAt = useStore().settings.walk?.routesErasedAt;` and `const [erasedAtOpen] = useState(erasedAt);`. The journalled lines count only while `erasedAt === erasedAtOpen`: the return becomes `saved?.segments ?? (kept && erasedAt === erasedAtOpen ? journalled : undefined)`.
  - **Home's row.** In `src/screens/home/WalkRecoveryRow.tsx`, read `settings` from `useStore()` beside `observations`, and add `settings.walk?.routesErasedAt` to the journal-reading effect's dependencies. An erase in another tab then re-reads the stripped journals.

- [ ] **Step 5: Write the failing tests for the words.** Append to `src/walk/consent.test.ts`, adding `consentSummary` to its import:

```ts
describe('what this phone keeps, as the Walk hub and Me say it (journey §9.1)', () => {
  it('says each choice, and what an unasked one waits for', () => {
    expect(consentSummary(UNASKED)).toEqual({ routes: 'Asked on your first walk with location', map: 'Asked on your first walk with location' });
    expect(consentSummary({ saveRoutes: true, map: 'on' })).toEqual({ routes: 'Kept on this phone', map: 'On' });
    expect(consentSummary({ saveRoutes: false, map: 'off' })).toEqual({ routes: 'Not kept', map: 'Off' });
  });
});
```

Append to `src/screens/you/summaries.test.ts`, adding `routeNotes` to its import:

```ts
describe('routes in a restore (journey §18.3, B-26, Review Focus 4)', () => {
  it('says before anything happens that a phone that keeps no routes won’t take the file’s', () => {
    expect(routeNotes({ records: { routes: 3 }, refusedStores: ['routes'], replaceRemoves: {} })).toEqual(['The file’s 3 routes won’t be added, because this phone doesn’t keep routes.']);
  });

  it('says that replacing from a file without routes removes this phone’s', () => {
    expect(routeNotes({ records: {}, refusedStores: [], replaceRemoves: { routes: 2 } })).toEqual(['Replacing removes this phone’s 2 routes, which the file doesn’t hold.']);
  });

  it('says nothing when the file’s routes are simply added', () => {
    expect(routeNotes({ records: { routes: 1 }, refusedStores: [], replaceRemoves: {} })).toEqual([]);
  });

  it('counts routes with the record', () => {
    expect(countsSentence({ readings: 2, sessions: 0, checkIns: 0, bodyMetrics: 0, personalRecords: 0, routes: 1 })).toBe('2 readings and 1 route');
  });
});

describe('privacyLine, with map pictures (B-24)', () => {
  it('says the standard privacy copy in full', () => {
    expect(privacyLine('iPhone')).toBe('Your records are stored on this iPhone. Optional map pictures share the area shown and your internet address with OpenStreetMap. Backups and calendar files leave only when you share them.');
  });
});
```

Plan 4's own `privacyLine (B-24)` test expects the sentence without maps: change its expected string to the one above. Import `privacyLine` if the file doesn't already.

Run: `npx vitest run src/walk/consent.test.ts src/screens/you/summaries.test.ts`
Expected: FAIL.

- [ ] **Step 6: The words.** In `src/walk/consent.ts`:

```ts
/** This phone's two walk choices in words, for the Walk hub and Me → Data. */
export function consentSummary(walk: WalkSettings): { routes: string; map: string } {
  const unasked = 'Asked on your first walk with location';
  return {
    routes: walk.saveRoutes === 'unasked' ? unasked : walk.saveRoutes ? 'Kept on this phone' : 'Not kept',
    map: walk.map === 'unasked' ? unasked : walk.map === 'on' ? 'On' : 'Off',
  };
}
```

In `src/screens/you/summaries.ts`:
- `RecordCounts` gains `/** Kept walk routes (Plan 6). */ routes?: number;`;
- `recordCounts`' parameter gains `records?: { routes: readonly unknown[] }`, and its result `routes: state.records?.routes.length ?? 0`;
- `countsSentence` adds `(counts.routes ?? 0) > 0 && plural(counts.routes ?? 0, 'route'),` after personal records;
- `privacyLine` becomes the following. Add it as it is if Plan 4 hasn't:

```ts
/** B-24's privacy sentence for this device, with map pictures since Plan 6. */
export function privacyLine(device: string): string {
  return `Your records are stored on this ${device}. Optional map pictures share the area shown and your internet address with OpenStreetMap. Backups and calendar files leave only when you share them.`;
}
```

- add `routeNotes`, importing `type ImportPreview` from `@/store/transfer` if it isn't already:

```ts
/** What a restore does with routes, said before anything changes (journey §18.3, B-26, Review Focus 4). */
export function routeNotes(preview: Pick<ImportPreview, 'records' | 'refusedStores' | 'replaceRemoves'>): string[] {
  const inFile = preview.records?.routes ?? 0;
  const here = preview.replaceRemoves?.routes ?? 0;
  const notes: string[] = [];
  if (inFile > 0 && preview.refusedStores?.includes('routes')) notes.push(`The file’s ${plural(inFile, 'route')} won’t be added, because this phone doesn’t keep routes.`);
  if (here > 0 && inFile === 0) notes.push(`Replacing removes this phone’s ${plural(here, 'route')}, which the file doesn’t hold.`);
  return notes;
}
```

Run: `npx vitest run src/walk/consent.test.ts src/screens/you/summaries.test.ts`
Expected: PASS.

- [ ] **Step 7: Me → Data.** In `src/screens/you/DataScreen.tsx`:
  - **Imports:** `MapIcon` and `RouteIcon` from `lucide-react`; `Toggle` from `./controls`; `CONSENT`, `consentSummary` and `walkSettings` from `@/walk/consent`; `eraseRoutes` and `setSettings` from `@/store/useStore`; `privacyLine` and `plural` from `./summaries` (Plan 4 may have dropped `plural`). `Open` gains `'erase'`.
  - **The privacy line (B-24).** The "On this {device}" group's footer is `privacyLine(device)` (Plan 4's; set it if Plan 4 hasn't). v1's "No account, no server, nothing sent anywhere" isn't true once map pictures exist, so it must not remain anywhere: `grep -rn "nothing sent anywhere" src` finds nothing.
  - **The "Walks and maps" group.** Replace Plan 4's placeholder group (find it with `grep -n "Plan 6 replaces this group" src/screens/you/DataScreen.tsx`), comment included, with the group below, in the same place. Without Plan 4, put it just before the delete group.

```tsx
      <Group
        header="Walks and maps"
        footer="Routes stay on this phone. They go into a backup only when you include them."
      >
        <Row
          icon={<RouteIcon />}
          label="Keep walk routes"
          detail={walk.saveRoutes === false ? 'New walks don’t keep their route. Routes already kept stay until you erase them.' : consentSummary(walk).routes}
          accessory={<Toggle label="Keep walk routes" checked={walk.saveRoutes === true} onChange={on => void setSettings({ walk: { ...walk, saveRoutes: on } })} />}
        />
        <Row
          icon={<MapIcon />}
          label="Map pictures under routes"
          detail={CONSENT.mapPictures.detail}
          accessory={<Toggle label="Map pictures under routes" checked={walk.map === 'on'} onChange={on => void setSettings({ walk: { ...walk, map: on ? 'on' : 'off' } })} />}
        />
        <Row
          onClick={() => setOpen('erase')}
          label={<span className="text-stop">Erase all routes</span>}
          detail={routes > 0 ? `${plural(routes, 'route')} kept. Walks keep their time, distance and steps.` : 'No saved routes. Erasing also clears a walk not yet saved.'}
        />
      </Group>
```

  with `const walk = walkSettings(settings);` and `const routes = state.records.routes.length;` beside `counts`.
  - **The erase sheet**, beside the others:

```tsx
      <Sheet open={open === 'erase'} onOpenChange={next => setOpen(next ? 'erase' : undefined)} title="Erase all routes?" detent="medium">
        <p className="px-1 text-[length:var(--text-body)] leading-snug">
          Every route on this {device} is erased: from saved walks, from a walk not yet saved, and from one you’re on now. The walks keep their time, distance and steps. This cannot be undone.
        </p>
        {eraseError && <Notice tone="error">{eraseError}</Notice>}
        <PlainButton tone="stop" onClick={() => void eraseRoutes().then(r => (r.ok ? (setOpen(undefined), setEraseError(undefined)) : setEraseError(`The routes were not erased. ${r.failure.message}`)))}>
          Erase routes
        </PlainButton>
      </Sheet>
```

  with `const [eraseError, setEraseError] = useState<string>();`, and `Notice` and `PlainButton` imported from `./controls`.

- [ ] **Step 8: Routes in a backup, only when asked.** In `src/screens/you/DataSheets.tsx`'s `BackupBody`:
  - add `const [withRoutes, setWithRoutes] = useState(false);` and `const routes = state.records.routes.length;`;
  - add `withRoutes` to the `version` memo's array and its dependency list;
  - the effect calls `exportRecord(withRoutes ? { include: ['routes'] } : {})`;
  - the first paragraph's counts become `countsSentence({ ...recordCounts(state), routes: withRoutes ? routes : 0 })`;
  - below the paragraphs, when `routes > 0`:

```tsx
        <Group footer="A backup with routes shows where you walked to anyone who has the file.">
          <Row
            label="Include your routes"
            detail={plural(routes, 'route')}
            accessory={<Toggle label="Include your routes" checked={withRoutes} onChange={setWithRoutes} />}
          />
        </Group>
```

  Import `Group` and `Row` from `@/components/hig/List`, `Toggle` from `./controls` and `plural` from `./summaries`.

- [ ] **Step 9: The restore preview.** In `src/screens/you/RestoreFlow.tsx`:
  - import `routeNotes` from `./summaries`;
  - in `PreviewBody`, after the `unreadable` notice, add `{routeNotes(preview).map(n => <Notice key={n}>{n}</Notice>)}`;
  - in the `confirmReplace` stage, after "It cannot be undone.", add `{(stage.preview.replaceRemoves?.routes ?? 0) > 0 && ` Your ${plural(stage.preview.replaceRemoves?.routes ?? 0, 'route')} on this ${device} go too.`}`.

  This phone's consents are kept whichever way the file is restored, and a new phone stays unasked (Task 1's `withDeviceConsent`, B-26).

- [ ] **Step 10: The Walk hub says what's chosen.** In `src/screens/hub/WalkHub.tsx`, in the "How walks are measured" group (Plan 2's), after the switches:

```tsx
          <Row as={Link} to="/me/data" viewTransition label="Routes" value={consentSummary(walkSettings(state.settings)).routes} chevron />
          <Row as={Link} to="/me/data" viewTransition label="Map pictures" value={consentSummary(walkSettings(state.settings)).map} chevron />
```

  Import `consentSummary` from `@/walk/consent`, and `Link` from `react-router-dom` if it isn't already imported.

- [ ] **Step 11: Check by eye.** Run `npm run dev`. At 428×926 and 320×568, with a saved walk that kept its route:
  - Me → Data shows the B-24 line, "Walks and maps" and its two switches;
  - "Erase all routes" → "Erase routes": the walk's detail shows "No route kept for this walk.", and the Walk hub's "Routes" still says "Kept on this phone" (erasing isn't turning off);
  - Back up: "Include your routes" appears only with routes kept, and the file's size grows when it's on;
  - at 200% text, each switch row keeps its label beside or above the switch.

- [ ] **Step 12: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/types/index.ts src/store src/walk/browser.ts src/walk/consent.ts src/walk/consent.test.ts src/screens/walk/useWalkRoute.ts src/screens/home/WalkRecoveryRow.tsx src/screens/you src/screens/hub/WalkHub.tsx
git commit -m "feat: Let Me change walk consents, erase every route for good, and back routes up on request"
```

---
### Task 15: The acceptance harness walks v2's way, and J10 and J11 follow

**Files:**
- Modify: `scripts/e2e/acceptance/lib/inpage.mjs` (`sensorInit`: motion as iOS has it, gait samples, every `play()` with the event it ran in)
- Modify: `scripts/e2e/acceptance/lib/walk.mjs` (the first walk's questions; walking time in steps of a minute; clips, routes and journals)
- Modify: `scripts/e2e/acceptance/run.mjs` (the `v` journeys)
- Modify: `scripts/e2e/acceptance/journeys/j10.mjs`, `scripts/e2e/acceptance/journeys/j11.mjs`

**Interfaces:**
- **Produces, in the page (`window.__acc`):**
  - `t.open({ sensors: { geo, motion } })`, where `motion` is `'absent'` (the default: no permission API, as Chromium), `'grant'` or `'deny'`. With `grant` or `deny`, `DeviceMotionEvent.requestPermission` exists as on iOS;
  - `calls.motionRequests: (string | null)[]`: for each request, the type of the event it ran inside (`'click'` for a tap's handler), or `null`;
  - `calls.play: { src: string; during: string | null }[]`: every `HTMLMediaElement.play()`;
  - `emitGait({ seconds?, stepHz?, amplitude?, hz? }): number`: walking samples, stamped on their own clock.
- **Produces, in `walk.mjs`:**
  - `answerQuestions(t, { keep?: boolean; map?: boolean }): Promise<string[]>`: the first walk's questions as they come; returns their titles;
  - `start(t, answers, consents?)`: the check-in when it opens, then the questions, then the live walk;
  - `elapse(t, ms)`: time passing in steps of at most 60 s;
  - `played(page): Promise<{ src: string; during: string | null }[]>` and `cueHeard(page, line): Promise<boolean>`;
  - `routesIn(snap)` and `journalsIn(snap)`;
  - `drawnLines(page, label?): Promise<number>`: the paths in the route drawing.

**Why time passes a minute at a time.** The harness freezes `Date` and moves it with `t.advance`. A step longer than B-19's 120 s, with the walk recording, could look like a change to the phone's clock. So walking time always passes in steps of at most a minute. That's also why `CUE_GRACE_MS` is 65 s (Task 9).

- [ ] **Step 1: Motion, gait and audio in the page.** In `scripts/e2e/acceptance/lib/inpage.mjs`, `sensorInit` takes `{ geo = 'deny', motion = 'absent' } = {}`, its `calls` gains `motionRequests: []` and `play: []`, and this goes at the end of the function:

```js
  // Motion as iOS has it (journey §9.1, B-01): a permission asked for from a tap, and samples the test sends.
  const m = (acc.motion = { mode: motion, clock: undefined });
  if (motion !== 'absent' && typeof DeviceMotionEvent !== 'undefined') {
    DeviceMotionEvent.requestPermission = () => {
      calls.motionRequests.push(window.event?.type ?? null);
      return Promise.resolve(m.mode === 'grant' ? 'granted' : 'denied');
    };
  }
  /**
   * `seconds` of walking at `stepHz` steps a second, as the phone's sensor
   * reports it (src/walk/steps.test.ts's gait), sent at once. Each sample
   * carries its own time on a clock that only this moves, because the step
   * detector reads `timeStamp`, not the moment it's sent.
   */
  acc.emitGait = ({ seconds = 10, stepHz = 2, amplitude = 2.5, hz = 50 } = {}) => {
    m.clock ??= performance.now();
    let sent = 0;
    for (let i = 0; i < seconds * hz; i++) {
      const s = i / hz;
      const z = 9.80665 + amplitude * Math.sin(2 * Math.PI * stepHz * s) + 0.4 * amplitude * Math.sin(2 * Math.PI * 2 * stepHz * s + 0.7);
      const e = new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x: 0, y: 0, z }, interval: 1000 / hz });
      Object.defineProperty(e, 'timeStamp', { value: m.clock + s * 1000 });
      window.dispatchEvent(e);
      sent++;
    }
    m.clock += seconds * 1000;
    return sent;
  };
  // Every play() of an <audio>, with the event it ran inside: a tap's own handler shows as "click" (B-01, A-53).
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    calls.play.push({ src: String(this.src).slice(0, 160), during: window.event?.type ?? null });
    return play.apply(this, args);
  };
```

- [ ] **Step 2: Walking helpers.** In `scripts/e2e/acceptance/lib/walk.mjs`, add `import { clipKey } from '../../../voice/key.mjs';`. Replace `start` and add the rest:

```js
const QUESTIONS = [
  'Keep a record of your route on this phone?',
  'Show map pictures under your saved routes?',
  'Counting steps',
];

/** The first walk's questions (journey §9.1), answered as they come; the step card is tapped through. Returns the titles asked. */
export async function answerQuestions(t, { keep = false, map = false } = {}) {
  const page = t.page;
  const asked = [];
  for (let i = 0; i < QUESTIONS.length; i++) {
    const open = [];
    for (const q of QUESTIONS) if (await page.getByRole('dialog', { name: q }).count()) open.push(q);
    if (!open.length) break;
    const title = open[0];
    const sheet = page.getByRole('dialog', { name: title });
    asked.push(title);
    if (title === QUESTIONS[0]) await ui.tap(ui.button(sheet, keep ? 'Yes, keep routes' : 'No, don’t keep routes'));
    else if (title === QUESTIONS[1]) await ui.tap(ui.button(sheet, map ? 'Show map pictures' : 'No pictures'));
    else await ui.tap(ui.button(sheet, 'Start walk'));
    await page.waitForTimeout(400);
  }
  return asked;
}

/** Tap Start walk; answer the check-in if it opens, then the first walk's questions; land on the live walk. */
export async function start(t, answers, consents = {}) {
  const page = t.page;
  await ui.tap(ui.button(page.getByRole('main'), 'Start walk'));
  await page.waitForTimeout(400);
  const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
  if (await sheet.count()) {
    await ui.answerCheckIn(t, sheet, answers);
    await page.waitForTimeout(400);
    await t.checkpoint('walk-check-in-outcome');
    const go = sheetStart(sheet);
    await t.must(await go.count() === 1, `the check-in does not allow the walk: ${(await sheet.innerText()).replace(/\s+/g, ' ').slice(0, 300)}`);
    await ui.tap(go);
    await page.waitForTimeout(400);
  }
  t.asked = await answerQuestions(t, consents);
  await page.waitForURL(/#\/walk\/live/);
  await t.ready();
}

/** Time passing on a recording walk, a minute at a time at most: B-19 reads a longer step as a change to the clock. */
export async function elapse(t, ms, step = 60_000) {
  for (let left = ms; left > 0; left -= step) await t.advance(Math.min(step, left));
}

/** Every play() of an <audio> so far, with the event it ran inside. */
export const played = page => page.evaluate(() => [...window.__acc.calls.play]);

/** Whether a recorded line's clip was played (Task 9's cue player plays `<pack>/<key>.m4a`). */
export async function cueHeard(page, line) {
  return (await played(page)).some(p => p.src.includes(`/${clipKey(line)}.m4a`) || p.src.startsWith('blob:'));
}

/** The kept routes, and the walk journals, in a database snapshot. */
export const routesIn = snap => snap.routes ?? [];
export const journalsIn = snap => snap.walkJournal ?? [];

/** How many lines the route drawing shows now (one SVG path per line, A-48). */
export async function drawnLines(page, label = 'Your route so far') {
  await page.waitForTimeout(1300); // the live drawing redraws at most once a second (K-08)
  return page.locator(`svg[role="img"][aria-label="${label}"] path`).count();
}
```

A clip fetched ahead plays from a `blob:` URL (Task 9's prefetch), which carries no key, so `cueHeard` counts a `blob:` play too. Each journey that checks a cue checks that the clip played around the cue's minute, by reading `played` before and after.

If `openSetup` still goes through v1's Move tab, its body becomes:

```js
  await t.hash('/hub/walk');
  await ui.heading(t.page, 'Walk');
```

- [ ] **Step 3: The runner takes the `v` journeys.** In `scripts/e2e/acceptance/run.mjs`, if the journey filter still reads `/^[js]\d\d\.mjs$/` (Plan 4 widens it), make it `/^[jmsv]\d\d\.mjs$/`.

- [ ] **Step 4: J10, location denied.** In `scripts/e2e/acceptance/journeys/j10.mjs`:
  - **Step 3**, after `await walk.start(t, ui.normalAnswers('P03'));`:

```js
      // Location was refused and steps are off: nothing to ask on the first walk, and no motion request (journey §9.1).
      await t.check(t.asked.length === 0, `the walk asked ${t.asked.join(' | ')}`);
      const c0 = await walk.calls(page);
      await t.check(c0.motionRequests.length === 0, `motion was asked for with steps off (${c0.motionRequests.join(', ')})`);
      // The voice's one audio element, unlocked inside the tap that started the walk (B-01, A-53).
      const unlock = (await walk.played(page)).find(p => p.src.startsWith('data:audio/wav'));
      await t.check(unlock?.during === 'click', `audio was not unlocked inside the tap that started the walk: ${JSON.stringify(unlock)}`);
```

  - **Step 4**, after the summary's meal check:

```js
      await t.check(/No route: location was off for this walk\./.test(summary), `the summary does not say why there is no route: ${summary.replace(/\n/g, ' ⏎ ').slice(0, 300)}`);
      // Two minutes: about 5 kcal, too little to state (J§12.4).
      await t.check(/Energy \(estimate\)[^]{0,80}?No estimate/.test(summary) && /Too short for an energy estimate\./.test(summary), `the summary does not say the walk was too short for an estimate: ${summary.replace(/\n/g, ' ⏎ ').slice(0, 300)}`);
```

  - **Step 5:** the positions check stays. Add, after it:

```js
      await t.check(walk.routesIn(snap).length === 0 && walk.journalsIn(snap).length === 0, `a route or a journal is left: ${walk.routesIn(snap).length} routes, ${walk.journalsIn(snap).length} journals`);
```

  The detail's `!/calorie|kcal/i` check stays: a walk too short for an estimate stores none.

- [ ] **Step 5: J11, location on, routes not kept.** In `scripts/e2e/acceptance/journeys/j11.mjs`:
  - **`startGpsWalk`** ends with `await walk.start(t, ui.normalAnswers('P03'), { keep: false });`, then:

```js
  // The first walk with location asks to keep the route; with "No" it asks nothing about map pictures (journey §9.1).
  await t.check(t.asked.join(' | ') === 'Keep a record of your route on this phone?', `the first walk asked ${t.asked.join(' | ') || 'nothing'}`);
```

  - **The live drawing.** Step 1, after the distance check:

```js
        await t.check(await walk.drawnLines(page) === 1, `the route is not drawn as one line: ${await walk.drawnLines(page)}`);
        await t.check(!t.requests.some(r => r.url.includes('tile.openstreetmap.org')), 'a map picture was requested during a live walk (D18)');
```

    Step 3, after the second segment's check: `await t.check(await walk.drawnLines(page) === 2, 'the gap is drawn joined, or a segment is missing (A-48)');`.
  - **Step 4.** The walk now has an energy estimate too: 2 minutes at about 2.1 mph and 1 minute at about 4.1 mph give (2.8 − 1) × 78 × 2/60 + (5.5 − 1) × 78 × 1/60 ≈ 10.5 kcal. `obs.length === 6` becomes 7, and before it:

```js
        const energy = obs.filter(o => o.kind === 'activeEnergy');
        await t.check(energy.length === 1 && near(energy[0].value, 10.5, 0.2) && energy[0].coverageMs === 180000 && /From 3 min with distance\./.test(energy[0].note ?? ''),
          `activeEnergy: ${JSON.stringify(energy.map(o => [o.value, o.coverageMs, o.note]))}`);
        await t.check(/Energy \(estimate\)[^]{0,120}?about 10 kcal/.test(summary), `the summary does not say about 10 kcal: ${summary.slice(0, 400)}`);
```

  - **Step 7** stays: with routes not kept, nothing anywhere holds a position. Add `await t.check(walk.routesIn(snap).length === 0, 'a route was kept after “No”');` after its first check.

- [ ] **Step 6: Run them**

Run: `npm run e2e:acceptance -- --only=J10,J11`
Expected: PASS in all four projects.

- [ ] **Step 7: Commit**

```bash
git add scripts/e2e/acceptance/lib/inpage.mjs scripts/e2e/acceptance/lib/walk.mjs scripts/e2e/acceptance/run.mjs scripts/e2e/acceptance/journeys/j10.mjs scripts/e2e/acceptance/journeys/j11.mjs
git commit -m "test: Walk v2's way in the acceptance suite, and bring J10 and J11 up to date"
```

---
### Task 16: Acceptance V-J02, V-J19 and V-J20

**Files:**
- Create: `scripts/e2e/acceptance/journeys/v02.mjs`, `v19.mjs`, `v20.mjs`

**Interfaces:**
- **Consumes:** Task 15's helpers (`walk.start`, `answerQuestions`, `elapse`, `played`, `cueHeard`, `routesIn`, `journalsIn`, `calls`, `emitGait`); `ui.rightNow`, `ui.answerCheckIn`, `ui.normalAnswers` and `sheetStart` (v1's helpers).
- **Produces:** the journeys `V02`, `V19` and `V20`, run by `npm run e2e:acceptance -- --only=V02,V19,V20`.

- [ ] **Step 1: Write** `scripts/e2e/acceptance/journeys/v02.mjs`

```js
/**
 * V-J02, P03: after lunch, from Home's Right now to a saved walk and back
 * (journey §17.1 #2; B-01, B-09; motion M10, M12). Right now states the
 * time and starts the walk itself: the check-in, then the live walk, with
 * no screen in between (K-32).
 */
import { MINUTE } from '../lib/env.mjs';
import { persona } from '../fixtures/personas.mjs';
import { sheetStart } from '../lib/player.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';

export const id = 'V02';
export const title = 'After lunch, from Right now to a saved walk';
export const safety = false;

const AT = Date.parse('2026-10-08T13:40:00+05:30');
const LUNCH = Date.parse('2026-10-08T13:10:00+05:30');
const SEED = persona('P03', { patch: { settings: { habits: { mealWalk: { enabled: true, meals: ['lunch'], finish: { lunch: '13:10' } } } } } });

export const cases = [{
  name: 'a walk after lunch',
  async run(t) {
    const page = await t.open({ seed: SEED, route: '/home', time: AT });
    const main = page.getByRole('main');

    await t.step(1, 'Home at 1:40 pm: Right now offers the walk after lunch, with the time stated', async () => {
      const card = ui.rightNow(page);
      await t.must(await card.count() === 1, 'there is no Right now card');
      const text = (await card.innerText()).replace(/\s+/g, ' ');
      await t.check(/A walk after lunch/.test(text), `Right now is not the walk after lunch: ${text.slice(0, 200)}`);
      await t.must(await card.getByRole('button', { name: /^I had lunch at 1:10\s?pm: walk now$/i }).count() === 1, `Right now does not state the time: ${text.slice(0, 200)}`);
      await t.checkpoint('right-now-after-lunch');
    });

    await t.step(2, 'Tap it, check in, Start walk: the live walk, with no screen in between', async () => {
      await page.evaluate(() => { window.__hashes = []; addEventListener('hashchange', () => window.__hashes.push(location.hash)); });
      await ui.tap(ui.rightNow(page).getByRole('button', { name: /^I had lunch at/i }));
      await page.waitForTimeout(400);
      const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
      await t.must(await sheet.count() === 1, 'the tap did not open the check-in');
      await ui.answerCheckIn(t, sheet, ui.normalAnswers('P03'));
      await page.waitForTimeout(400);
      await ui.tap(sheetStart(sheet));
      await page.waitForURL(/#\/walk\/live/, { timeout: 10000 });
      await t.ready();
      const hashes = await page.evaluate(() => window.__hashes);
      await t.check(!hashes.some(h => h.startsWith('#/hub/')), `the walk passed through ${hashes.join(' → ')}: K-32 has no hub step`);
      const unlock = (await walk.played(page)).find(p => p.src.startsWith('data:audio/wav'));
      await t.check(unlock?.during === 'click', `audio was not unlocked inside the Start tap (B-01): ${JSON.stringify(unlock)}`);
      const live = await walk.stored(page);
      await t.check(live?.plan.kind === 'afterMeal' && live.plan.meal?.which === 'lunch' && live.plan.meal.startedAt === LUNCH && live.plan.meal.basis === 'had',
        `the walk does not carry lunch had at 1:10 pm: ${JSON.stringify(live?.plan)}`);
      await t.checkpoint('live-after-lunch');
    }, { input: 'tap “I had lunch at 1:10 pm: walk now”; normal answers, glucose 110 mg/dL now; Start walk' });

    await t.step(3, 'Ten minutes, a minute at a time: the timer, and the ten-minute cue on its own', async () => {
      const before = (await walk.played(page)).length;
      await walk.elapse(t, 10 * MINUTE);
      await page.waitForTimeout(1500);
      await t.check(await walk.timer(page) === '10:00', `the timer reads ${await walk.timer(page)}, not 10:00`);
      const heard = (await walk.played(page)).slice(before);
      await t.check(heard.length > 0 && heard.every(p => p.during === null), `no cue played by itself at ten minutes: ${JSON.stringify(heard)}`);
      await t.check(await walk.cueHeard(page, 'Ten minutes of walking.'), `the clip played was not “Ten minutes of walking.”: ${JSON.stringify(heard)}`);
      await t.checkpoint('ten-minutes');
    }, { input: '+60 s ten times' });

    await t.step(4, 'Finish and save: after lunch, had at 1:10 pm, never “started”', async () => {
      await walk.finish(t);
      const summary = (await main.innerText()).replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ');
      await t.checkpoint('summary-after-lunch');
      await t.check(/After lunch/.test(summary) && /Had at 1:10\s?pm/i.test(summary) && /When you had the meal/.test(summary), `the summary does not say lunch was had at 1:10 pm: ${summary.slice(0, 300)}`);
      await t.check(!/Started 1:10/i.test(summary), 'the summary calls the time lunch was had its start (B-09)');
      const snap = await walk.save(t);
      const dur = walk.walkObservations(snap).filter(o => o.kind === 'walkDuration');
      await t.check(dur.length === 1 && dur[0].value === 10 && dur[0].tag === 'afterMeal' && dur[0].mealStartedAt === undefined && /which you had at 1:10/.test(dur[0].note ?? ''),
        `walkDuration: ${JSON.stringify(dur.map(o => [o.value, o.tag, o.mealStartedAt, o.note]))}`);
    });

    await t.step(5, 'Done: back to Home, where the walk counts and Right now moves on (M12)', async () => {
      await ui.tap(ui.button(main, 'Done'));
      await page.getByRole('heading', { level: 1, name: ui.HOME_TITLE }).waitFor();
      await t.check((await t.route()).startsWith('/home'), `Done went to ${await t.route()}, not Home`);
      const home = (await main.innerText()).replace(/\s+/g, ' ');
      await t.check(/\b10 min moved this week/.test(home), `This week does not count the walk: ${home.slice(0, 300)}`);
      const card = (await ui.rightNow(page).innerText()).replace(/\s+/g, ' ');
      await t.check(!/A walk after lunch/.test(card), `Right now still offers the walk after lunch: ${card.slice(0, 200)}`);
      await t.checkpoint('home-after-walk');
    });
  },
}];
```

- [ ] **Step 2: Write** `scripts/e2e/acceptance/journeys/v19.mjs`

```js
/**
 * V-J19, P04: the decision lapses during the first walk's questions
 * (journey §17.2 #19; §4.1, B-01; Review Focus 5). A fresh reading starts the
 * questions; 31 minutes later the last answer's tap asks the gate again, and
 * "Check glucose first" shows in place of a walk. The answer given is kept,
 * so the next Start asks nothing twice.
 */
import { MINUTE } from '../lib/env.mjs';
import { persona } from '../fixtures/personas.mjs';
import { sheetStart } from '../lib/player.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';

export const id = 'V19';
export const title = 'The decision lapses during the first walk’s questions';
export const safety = true;

const KEEP = 'Keep a record of your route on this phone?';

export const cases = [{
  name: 'thirty-one minutes over the route question',
  async run(t) {
    const page = await t.open({ seed: persona('P04'), route: '', sensors: { geo: 'grant' } });
    const main = page.getByRole('main');

    await t.step(1, 'Walk hub: location on; Start walk; check in with 110 now; the first question', async () => {
      await walk.openSetup(t);
      await walk.emit(page, 12.97, 77.59);
      await ui.tap(walk.gpsSwitch(page));
      await page.waitForFunction(() => document.querySelector('[role="switch"][aria-checked="true"]') !== null, null, { timeout: 5000 });
      await ui.tap(ui.button(main, 'Start walk'));
      const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
      await sheet.waitFor();
      await ui.answerCheckIn(t, sheet, ui.normalAnswers('P04'));
      await page.waitForTimeout(400);
      await ui.tap(sheetStart(sheet));
      await page.getByRole('dialog', { name: KEEP }).waitFor({ timeout: 10000 });
      await t.check(!(await t.route()).startsWith('/walk/live'), 'the walk started before the question was answered');
      await t.checkpoint('first-question');
    }, { input: 'glucose 110 mg/dL meter, now (09:00)' });

    await t.step(2, 'Thirty-one minutes pass with the question open', async () => {
      await walk.elapse(t, 31 * MINUTE);
      await t.must(await page.getByRole('dialog', { name: KEEP }).count() === 1, 'the question went away by itself');
    }, { input: '+31 min (09:31)' });

    await t.step(3, '“No, don’t keep routes”: the gate’s new answer, and no walk', async () => {
      await ui.tap(ui.button(page.getByRole('dialog', { name: KEEP }), 'No, don’t keep routes'));
      await page.waitForTimeout(600);
      const held = page.getByRole('dialog', { name: 'Check glucose first' });
      await t.must(await held.count() === 1, `no “Check glucose first”: ${(await t.visible()).slice(0, 300)}`);
      const text = (await held.innerText()).replace(/\s+/g, ' ');
      await t.check(/within 30 minutes/.test(text), `the reason is not shown: ${text.slice(0, 300)}`);
      await t.check(await ui.button(held, 'Check in').count() === 1, 'no “Check in” on the refusal');
      await t.check(!(await t.route()).startsWith('/walk/live') && (await walk.stored(page)) === null, 'a walk started on a stale reading');
      await t.checkpoint('check-glucose-first');
    });

    await t.step(4, 'Check in with 112: Start walk goes straight to the walk, and asks nothing twice', async () => {
      await ui.tap(ui.button(page.getByRole('dialog', { name: 'Check glucose first' }), 'Check in'));
      const again = page.getByRole('dialog', { name: ui.CHECKIN });
      await again.waitFor();
      await t.check(/Last reading: 110 mg\/dL/.test(await again.innerText()), 'the check-in does not ask for a new reading after the old one');
      await ui.answerCheckIn(t, again, ui.normalAnswers('P04', { glucose: { value: '112', unit: 'mg/dL' } }));
      await page.waitForTimeout(400);
      await ui.tap(sheetStart(again));
      const asked = await walk.answerQuestions(t);
      await t.check(asked.length === 0, `the walk asked again: ${asked.join(' | ')}`);
      await page.waitForURL(/#\/walk\/live/, { timeout: 10000 });
      const live = await walk.stored(page);
      await t.check(live && live.plan.gps === true && live.plan.keepRoute === undefined, `the walk does not follow the answer given: ${JSON.stringify(live?.plan)}`);
      await t.checkpoint('walk-after-recheck');
    }, { input: 'glucose 112 mg/dL meter, now (09:31)' });
  },
}];
```

- [ ] **Step 3: Write** `scripts/e2e/acceptance/journeys/v20.mjs`

```js
/**
 * V-J20, P02: the first walk, with location refused and motion allowed
 * (journey §17.2 #20; §9.1, K-29, B-01, B-24). Time and steps, "No route"
 * said plainly, and the step card before the system's question, which is
 * asked from the tap that starts the walk.
 */
import { persona } from '../fixtures/personas.mjs';
import { sheetStart } from '../lib/player.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';

export const id = 'V20';
export const title = 'First walk with location refused and motion allowed';
export const safety = false;

const stepsIn = text => Number((text.match(/([\d,]+)\s*steps?\b/) ?? [, 'NaN'])[1].replace(/,/g, ''));

export const cases = [{
  name: 'time and steps, no route',
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '', sensors: { geo: 'deny', motion: 'grant' } });
    const main = page.getByRole('main');

    await t.step(1, 'Walk hub: location refused; Count steps on, and the sensor not asked yet', async () => {
      await walk.openSetup(t);
      await ui.tap(walk.gpsSwitch(page));
      await page.waitForTimeout(400);
      await t.check(await walk.gpsSwitch(page).getAttribute('aria-checked') === 'false', 'distance and pace stays on after the refusal');
      await t.check(/Walk without location: this walk is timed only/.test(await main.innerText()), 'no “Walk without location” after the refusal (journey §9.4)');
      await ui.tap(walk.stepsSwitch(page));
      await page.waitForTimeout(300);
      await t.check(await walk.stepsSwitch(page).getAttribute('aria-checked') === 'true', 'Count steps did not turn on');
      await t.check((await walk.calls(page)).motionRequests.length === 0, 'motion was asked for before the step card (K-29)');
      await t.checkpoint('setup-no-location');
    }, { input: 'Measure distance and pace → denied; Count steps on' });

    await t.step(2, 'Start walk; check in; the step card; motion asked from its tap', async () => {
      await ui.tap(ui.button(main, 'Start walk'));
      const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
      await sheet.waitFor();
      await ui.answerCheckIn(t, sheet, ui.normalAnswers('P02'));
      await page.waitForTimeout(400);
      await ui.tap(sheetStart(sheet));
      const card = page.getByRole('dialog', { name: 'Counting steps' });
      await card.waitFor({ timeout: 10000 });
      await t.check((await card.innerText()).includes('FitStrong counts steps only while it’s open on the screen.'), 'the step card does not say it in B-24’s words');
      await t.check((await walk.calls(page)).motionRequests.length === 0, 'motion was asked for before the step card was answered');
      await t.checkpoint('step-card');
      await ui.tap(ui.button(card, 'Start walk'));
      await page.waitForURL(/#\/walk\/live/, { timeout: 10000 });
      await t.ready();
      const requests = (await walk.calls(page)).motionRequests;
      await t.check(requests.length === 1 && requests[0] === 'click', `motion was not asked for once, inside the tap (B-01): ${JSON.stringify(requests)}`);
    });

    await t.step(3, 'A minute of walking at two steps a second', async () => {
      for (let i = 0; i < 6; i++) {
        await page.evaluate(() => window.__acc.emitGait({ seconds: 10 }));
        await t.advance(10_000);
      }
      await page.waitForTimeout(1300);
      const text = (await main.innerText()).replace(/[\u00a0\u202f]/g, ' ');
      const n = stepsIn(text);
      await t.check(n >= 100 && n <= 130, `the live walk counts ${n} steps for 120 taken`);
      await t.check(await walk.timer(page) === '1:00', `the timer reads ${await walk.timer(page)}, not 1:00`);
      await t.check(await page.locator('svg[aria-label="Your route so far"]').count() === 0, 'a route drawing shows on a walk without location');
      await t.checkpoint('live-steps');
    }, { input: 'gait at 2 Hz for 10 s, then +10 s, six times' });

    await t.step(4, 'Finish and save: time and steps, “No route” said plainly, and no position anywhere', async () => {
      await walk.finish(t);
      const summary = (await main.innerText()).replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ');
      await t.checkpoint('summary-no-route');
      await t.check(/No route: location was off for this walk\./.test(summary), `the summary does not say why there is no route: ${summary.slice(0, 300)}`);
      await t.check(/Counted while the screen was on: 1 of 1 min/.test(summary), `the steps’ coverage is not stated: ${summary.slice(0, 300)}`);
      await t.check(!/\bDistance\b/.test(summary), 'a distance row shows on a walk without location');
      const snap = await walk.save(t);
      const steps = walk.walkObservations(snap).filter(o => o.kind === 'steps');
      await t.check(steps.length === 1 && steps[0].value >= 100 && steps[0].value <= 130 && steps[0].scope === 'sessionObserved', `steps: ${JSON.stringify(steps.map(o => [o.value, o.scope]))}`);
      const leaks = [...walk.positionsIn(snap, 'db'), ...walk.positionsIn(await t.storage(), 'web')];
      await t.check(walk.routesIn(snap).length === 0 && !leaks.length, `a position was kept: ${leaks.slice(0, 4).join(', ')}`);
    });
  },
}];
```

- [ ] **Step 4: Run them**

Run: `npm run e2e:acceptance -- --only=V02,V19,V20`
Expected: PASS in all four projects. A failure names its step and leaves a screenshot and a database snapshot in the run's artifact folder.

- [ ] **Step 5: Commit**

```bash
git add scripts/e2e/acceptance/journeys/v02.mjs scripts/e2e/acceptance/journeys/v19.mjs scripts/e2e/acceptance/journeys/v20.mjs
git commit -m "test: Add acceptance V-J02, V-J19 and V-J20"
```

---
### Task 17: Acceptance V-J33, V-J34 and V-J16

**Files:**
- Create: `scripts/e2e/acceptance/journeys/v33.mjs`, `v34.mjs`, `v16.mjs`

**Interfaces:**
- **Consumes:** Task 15's helpers; `t.setPageFaults` and `t.allowConsole` (v1's harness); Playwright's `context.route`, used to answer tile requests with a 1×1 PNG so the suite never depends on OpenStreetMap being reachable.
- **Produces:** the journeys `V33`, `V34` and `V16` (production preview).

- [ ] **Step 1: Write** `scripts/e2e/acceptance/journeys/v33.mjs`

```js
/**
 * V-J33, P02: weak GPS, a locked screen and midnight on one walk
 * (journey §17.2 #33; §9.3, F17, A-48, B-17, B-19). Each break makes its own
 * line or segment, nothing is joined across the gap, and each day is
 * credited with its own minutes.
 */
import { persona } from '../fixtures/personas.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';

export const id = 'V33';
export const title = 'Weak GPS, a locked screen and midnight';
export const safety = false;

const SECOND = 1000;
const START = Date.parse('2026-10-08T23:50:00+05:30');
const HIDE = Date.parse('2026-10-08T23:54:00+05:30');
const SHOW = Date.parse('2026-10-08T23:56:00+05:30');
const MIDNIGHT = Date.parse('2026-10-09T00:00:00+05:30');

/** A fix now, then one every 10 s for `seconds`, from `from` to `to` degrees north on longitude 0, at `accuracy` metres. */
async function walkNorth(t, from, to, seconds, accuracy = 3) {
  const steps = seconds / 10;
  await walk.emit(t.page, from, 0, accuracy);
  for (let i = 1; i <= steps; i++) {
    await t.advance(10 * SECOND);
    await walk.emit(t.page, from + ((to - from) * i) / steps, 0, accuracy);
  }
}

export const cases = [{
  name: 'three breaks of three kinds',
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '', time: START, sensors: { geo: 'grant' }, visibility: true });
    const main = page.getByRole('main');

    await t.step(1, 'A first walk at 11:50 pm, keeping its route', async () => {
      await walk.openSetup(t);
      await walk.emit(page, 0, 0);
      await ui.tap(walk.gpsSwitch(page));
      await page.waitForFunction(() => document.querySelector('[role="switch"][aria-checked="true"]') !== null, null, { timeout: 5000 });
      await walk.start(t, ui.normalAnswers('P02'), { keep: true, map: false });
      await t.check(t.asked.join(' | ') === 'Keep a record of your route on this phone? | Show map pictures under your saved routes?', `the first walk asked ${t.asked.join(' | ') || 'nothing'}`);
    });

    await t.step(2, 'Good signal, half a minute of weak signal, good again: two lines (B-17)', async () => {
      await walkNorth(t, 0, 0.001, 120); // 23:50:00 to 23:52:00
      await walkNorth(t, 0.0011, 0.0013, 30, 80); // weak fixes to 23:52:30
      const weak = (await main.innerText()).replace(/\s+/g, ' ');
      await t.check(/Weak GPS signal|No GPS signal/.test(weak), `the weak signal is not said: ${weak.slice(0, 300)}`);
      await walkNorth(t, 0.0015, 0.0025, 90); // 23:52:30 to 23:54:00
      await t.check(await walk.drawnLines(page) === 2, `the dropout did not break the line: ${await walk.drawnLines(page)} lines`);
      await t.checkpoint('two-lines');
    }, { input: 'a fix every 10 s; accuracy 3 m, then 80 m for 30 s, then 3 m' });

    await t.step(3, 'The screen locks at 11:54 pm for two minutes: a gap, not a line', async () => {
      await page.evaluate(() => window.__acc.setVisibility('hidden'));
      await page.waitForTimeout(200);
      // Nothing records while hidden, so one long step can't look like a clock change (B-19).
      await t.advance(120 * SECOND);
      await page.evaluate(() => window.__acc.setVisibility('visible'));
      await page.waitForTimeout(400);
      const text = (await main.innerText()).replace(/\s+/g, ' ');
      await t.check(/Recording paused while the app was away, for 2 min/.test(text), `no gap notice: ${text.slice(0, 300)}`);
      await ui.tap(ui.button(main, 'Continue walking'));
    }, { input: 'hidden at 23:54:00, visible at 23:56:00' });

    await t.step(4, 'Walking on through midnight: a new segment from 12:00 am, with no gap', async () => {
      await walkNorth(t, 0.003, 0.0048, 360); // 23:56:00 to 00:02:00
      await t.check(await walk.drawnLines(page) === 4, `the gap or midnight is drawn joined: ${await walk.drawnLines(page)} lines, not 4`);
      await t.check(await walk.timer(page) === '10:00', `the timer reads ${await walk.timer(page)}, not 10:00`);
      const live = await walk.stored(page);
      const ends = (live?.segments ?? []).map(s => s.endedBy ?? 'open');
      const days = (live?.segments ?? []).map(s => s.day);
      await t.check(ends.join() === 'hidden,midnight,open' && days.join() === '2026-10-08,2026-10-08,2026-10-09', `segments: ${JSON.stringify({ ends, days })}`);
      await t.checkpoint('after-midnight');
    });

    await t.step(5, 'Finish and save: each day credited with its own minutes (F17)', async () => {
      await walk.finish(t);
      const summary = (await main.innerText()).replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ');
      await t.check(/Time recorded 10:00/.test(summary) && /Not recorded .{0,80}?2 min/.test(summary), `the summary: ${summary.slice(0, 300)}`);
      const snap = await walk.save(t);
      const byDay = {};
      for (const o of walk.walkObservations(snap).filter(x => x.kind === 'walkDuration')) byDay[o.at.slice(0, 10)] = (byDay[o.at.slice(0, 10)] ?? 0) + o.value;
      await t.check(byDay['2026-10-08'] === 8 && byDay['2026-10-09'] === 2, `minutes by day: ${JSON.stringify(byDay)}`);
      const [route] = walk.routesIn(snap);
      const lines = route?.segments ?? [];
      await t.check(lines.length === 4, `the kept route has ${lines.length} lines, not 4`);
      await t.check(lines.every(l => l.end <= HIDE || l.start >= SHOW), 'a kept line crosses the time the screen was locked (A-48)');
      await t.check(lines[2]?.end <= MIDNIGHT && lines[3]?.start >= MIDNIGHT, 'midnight does not separate two lines');
    });

    await t.step(6, 'Today’s log lists the walk on the day it started (L-10)', async () => {
      await t.goto('/day/2026-10-08');
      const rows = main.getByRole('link', { name: /walk/i });
      await t.check(await rows.count() === 1 && /10 min/.test(await rows.innerText()), `the 8th lists ${await rows.count()} walks`);
      await t.goto('/day/2026-10-09');
      await t.check(await main.getByRole('link', { name: /walk/i }).count() === 0, 'the walk is listed again on the day it ended');
    });
  },
}];
```

- [ ] **Step 2: Write** `scripts/e2e/acceptance/journeys/v34.mjs`

```js
/**
 * V-J34, P02: a crash while a walk and its route are being saved
 * (journey §17.2 #34; §9.4, §18.3, A-55; B-05, B-23; Review Focus 2). The
 * save fails as one transaction, the app closes, and Home's row saves the
 * walk once: no duplicate, no orphan. Then "Erase all routes" leaves no
 * coordinate anywhere.
 */
import { MINUTE } from '../lib/env.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';

export const id = 'V34';
export const title = 'A crash while saving a route, and erasing every route';
export const safety = false;

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

async function walkNorth(t, from, to, seconds) {
  const steps = seconds / 10;
  await walk.emit(t.page, from, 0);
  for (let i = 1; i <= steps; i++) {
    await t.advance(10_000);
    await walk.emit(t.page, from + ((to - from) * i) / steps, 0);
  }
}

export const cases = [{
  name: 'saved once after a crash, then erased',
  async run(t) {
    let page = await t.open({ seed: persona('P02'), route: '', sensors: { geo: 'grant' } });
    const tiles = [];
    await t.context.route('https://tile.openstreetmap.org/**', route => {
      tiles.push({ url: route.request().url(), referer: route.request().headers().referer ?? '' });
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    });
    let id;

    await t.step(1, 'A first walk keeping its route, with map pictures on: three minutes', async () => {
      await walk.openSetup(t);
      await walk.emit(page, 0, 0);
      await ui.tap(walk.gpsSwitch(page));
      await page.waitForFunction(() => document.querySelector('[role="switch"][aria-checked="true"]') !== null, null, { timeout: 5000 });
      await walk.start(t, ui.normalAnswers('P02'), { keep: true, map: true });
      await walkNorth(t, 0, 0.002, 180);
      id = (await walk.stored(page))?.id;
      await t.check(tiles.length === 0, `a map picture was requested during the live walk (D18): ${tiles.length}`);
    });

    await t.step(2, 'Finish: the route drawn, with only the view’s tiles under it and the credit shown', async () => {
      await walk.finish(t);
      await page.waitForTimeout(1000);
      await t.check(await walk.drawnLines(page, 'Your route') === 1, 'the summary does not draw the route');
      await t.check(tiles.length > 0 && tiles.length <= 9 && tiles.every(x => /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/.test(x.url)), `tiles: ${JSON.stringify(tiles.map(x => x.url))}`);
      const origin = new URL(t.base).origin;
      await t.check(tiles.every(x => x.referer.startsWith(origin)), `a tile went without the page’s Referer (B-23): ${JSON.stringify(tiles.map(x => x.referer))}`);
      const credit = page.getByRole('link', { name: '© OpenStreetMap contributors', exact: true });
      await t.check(await credit.count() === 1 && (await credit.getAttribute('href')) === 'https://www.openstreetmap.org/copyright', 'the map has no visible credit link');
      await t.checkpoint('summary-with-map');
    });

    await t.step(3, 'Save, and the save fails part-way: nothing half-written, the journal keeps the walk', async () => {
      t.allowConsole(/acceptance-injected/);
      await t.setPageFaults([{ op: 'put', store: 'routes', action: 'abortAfterQueue', times: 1 }]);
      await ui.tap(ui.button(page.getByRole('main'), 'Save walk'));
      await page.getByText('This walk did not save.', { exact: false }).waitFor({ timeout: 10000 });
      const snap = await t.db();
      await t.check(walk.walkObservations(snap).length === 0 && walk.routesIn(snap).length === 0, 'part of the walk was written');
      const kept = walk.journalsIn(snap);
      await t.check(kept.length === 1 && kept[0].id === id && (kept[0].route?.length ?? 0) === 1, `the journal does not keep the walk and its route: ${JSON.stringify(kept.map(e => [e.id, e.route?.length]))}`);
    }, { input: 'fault: abort the save transaction at the route’s write, once' });

    await t.step(4, 'The app closes; three minutes later Home offers the walk', async () => {
      await t.advance(3 * MINUTE);
      await page.close();
      page = t.page = await t.newPage();
      await page.goto(`${t.base}#/home`, { waitUntil: 'domcontentloaded' });
      await t.ready();
      await t.must(await page.getByText('Your walk today was interrupted at 3 min. Save it?', { exact: true }).count() === 1, `Home does not offer the walk: ${(await page.getByRole('main').innerText()).slice(0, 300)}`);
      await t.checkpoint('home-recovery-row');
    });

    await t.step(5, 'Save, tapped twice: one walk, one route, no journal left', async () => {
      const save = ui.button(page.getByRole('main'), 'Save');
      await save.click();
      await save.click({ timeout: 1000 }).catch(() => {});
      await page.getByText('Walk saved.', { exact: true }).waitFor({ timeout: 10000 });
      const snap = await t.db();
      const obs = walk.walkObservations(snap);
      await t.check(obs.length > 0 && new Set(obs.map(o => o.id)).size === obs.length && obs.every(o => o.context === `walk:${id}`), `the walk’s records: ${JSON.stringify(obs.map(o => o.id))}`);
      const routes = walk.routesIn(snap);
      await t.check(routes.length === 1 && routes[0].walkId === id, `routes: ${JSON.stringify(routes.map(r => r.walkId))}`);
      await t.check(walk.journalsIn(snap).length === 0, 'a journal is left after the save');
      await t.reload();
      await t.check(await page.getByText(/was interrupted at/).count() === 0, 'Home still offers the saved walk');
      await t.goto('/day/today');
      await t.check(await page.getByRole('main').getByRole('link', { name: /walk/i }).count() === 1, 'Today’s log does not list the walk once');
    });

    await t.step(6, 'Me → Data → Erase all routes: the walk stays, and no coordinate is left anywhere (B-05)', async () => {
      await t.goto('/me/data');
      const main = page.getByRole('main');
      await ui.tap(ui.row(main, 'Erase all routes'));
      const sheet = page.getByRole('dialog', { name: 'Erase all routes?' });
      await sheet.waitFor();
      await ui.tap(ui.button(sheet, 'Erase routes'));
      await page.waitForTimeout(600);
      const snap = await t.db();
      await t.check(walk.routesIn(snap).length === 0 && walk.walkObservations(snap).length > 0, 'the routes or the walk are wrong after erasing');
      const leaks = [...walk.positionsIn(snap, 'db'), ...walk.positionsIn(await t.storage(), 'web')];
      await t.check(!leaks.length, `coordinates left after erasing: ${leaks.slice(0, 6).join(', ')}`);
      await t.checkpoint('routes-erased');
    });
  },
}];
```

- [ ] **Step 3: Write** `scripts/e2e/acceptance/journeys/v16.mjs`

```js
/**
 * V-J16, P02: offline (journey §17.1 #16; §9.4, M14, B-23), on the production
 * build with its service worker. After one online visit every hub and Trends
 * opens offline; a check-in and a walk on the plain grid are recorded and
 * saved; and only map pictures, and a voice never downloaded, say they need a
 * connection.
 */
import { persona } from '../fixtures/personas.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';

export const id = 'V16';
export const title = 'Offline: every hub, Trends, a check-in and a walk';
export const safety = false;
export const needs = ['preview'];

const HUBS = ['workout', 'stretch', 'walk', 'steps', 'food', 'glucose', 'bp', 'back', 'weight', 'water', 'sleep', 'waist', 'labs', 'learn'];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const failed = async page => (await page.getByText('This screen didn’t load', { exact: true }).count()) > 0;

/** Record CSP violations, which a meta-tag policy reports as events. */
function cspInit() {
  window.__acc = window.__acc || {};
  window.__acc.csp = [];
  document.addEventListener('securitypolicyviolation', e => window.__acc.csp.push(`${e.violatedDirective} ${e.blockedURI}`));
}

async function walkNorth(t, from, to, seconds) {
  const steps = seconds / 10;
  await walk.emit(t.page, from, 0);
  for (let i = 1; i <= steps; i++) {
    await t.advance(10_000);
    await walk.emit(t.page, from + ((to - from) * i) / steps, 0);
  }
}

export const cases = [{
  name: 'offline after one online visit (production build)',
  preview: true,
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '/home', sensors: { geo: 'grant' }, contextOptions: { serviceWorkers: 'allow' } });
    await t.context.addInitScript(cspInit);
    await t.reload();
    const tiles = [];
    await t.context.route('https://tile.openstreetmap.org/**', route => {
      tiles.push(route.request().url());
      return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    });
    const main = page.getByRole('main');

    await t.step(1, 'Online once: the service worker takes the page; every hub and Trends is visited', async () => {
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 }).catch(() => {});
      if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) await t.reload();
      await t.must(await page.evaluate(() => !!navigator.serviceWorker.controller), 'the service worker never took control of the page');
      for (const route of [...HUBS.map(h => `/hub/${h}`), '/trends', '/me/data', '/home']) {
        await t.hash(route);
        await page.waitForTimeout(500);
      }
    });

    await t.step(2, 'Offline: every hub and Trends opens', async () => {
      await t.context.setOffline(true);
      await t.reload();
      for (const route of [...HUBS.map(h => `/hub/${h}`), '/trends']) {
        await t.hash(route);
        await page.waitForTimeout(600);
        const h1 = (await page.getByRole('heading', { level: 1 }).allInnerTexts()).join(' | ');
        await t.check(!(await failed(page)) && h1.length > 0, `offline ${route} shows “${h1}”${await failed(page) ? ' (the screen did not load)' : ''}`);
      }
      await t.checkpoint('offline-hubs');
    });

    await t.step(3, 'Offline: check in, and walk with location on the plain grid', async () => {
      await t.hash('/hub/walk');
      await ui.heading(page, 'Walk');
      await walk.emit(page, 0, 0);
      await ui.tap(walk.gpsSwitch(page));
      await page.waitForFunction(() => document.querySelector('[role="switch"][aria-checked="true"]') !== null, null, { timeout: 5000 });
      await walk.start(t, ui.normalAnswers('P02'), { keep: true, map: true });
      // The voice pack was never downloaded, so it says it needs a connection; a cached one plays.
      const cached = await page.evaluate(async () => !!(await caches.match(new URL('voice/af_heart/manifest.json', document.baseURI).href)));
      const text = (await main.innerText()).replace(/\s+/g, ' ');
      if (!cached) await t.check(/Voice cues need a connection\./.test(text), `the voice never downloaded doesn’t say it needs a connection: ${text.slice(0, 300)}`);
      else t.note('the voice manifest was cached, so its cues can play offline');
      await walkNorth(t, 0, 0.001, 60);
      await t.check(await walk.drawnLines(page) === 1 && tiles.length === 0, `offline, the walk is not drawn on the plain grid alone (${await walk.drawnLines(page)} lines, ${tiles.length} tiles)`);
      await t.checkpoint('offline-walk');
    });

    await t.step(4, 'Offline: finish and save; the route drawn, map pictures said to need a connection', async () => {
      await walk.finish(t);
      await page.waitForTimeout(800);
      const summary = (await main.innerText()).replace(/\s+/g, ' ');
      await t.check(/Map pictures unavailable\. Needs a connection\./.test(summary), `the summary does not say map pictures need a connection: ${summary.slice(0, 300)}`);
      await t.check(await walk.drawnLines(page, 'Your route') === 1 && tiles.length === 0, 'offline, a map picture was asked for, or the route is not drawn');
      const snap = await walk.save(t);
      await t.check(walk.walkObservations(snap).length > 0 && walk.routesIn(snap).length === 1, 'the walk or its route was not saved offline');
      const violations = await page.evaluate(() => window.__acc.csp ?? []);
      await t.check(violations.length === 0, `CSP violations: ${violations.join('; ')}`);
    });

    await t.step(5, 'Back online: the saved walk’s detail shows its map pictures, credited', async () => {
      await t.context.setOffline(false);
      await t.goto('/day/today');
      await ui.tap(main.getByRole('link', { name: /walk/i }));
      await page.waitForTimeout(1000);
      await t.check(tiles.length > 0 && tiles.length <= 9, `online, the detail asked for ${tiles.length} tiles`);
      await t.check(await page.getByRole('link', { name: '© OpenStreetMap contributors', exact: true }).count() === 1, 'the map has no visible credit');
      await t.check(!/Needs a connection/.test(await main.innerText()), 'online, the detail still says it needs a connection');
    });
  },
}];
```

- [ ] **Step 4: Run them**

Run: `npm run e2e:acceptance -- --only=V33,V34,V16`
Expected: PASS in all four projects. V16 builds and serves the production preview itself.

- [ ] **Step 5: Commit**

```bash
git add scripts/e2e/acceptance/journeys/v33.mjs scripts/e2e/acceptance/journeys/v34.mjs scripts/e2e/acceptance/journeys/v16.mjs
git commit -m "test: Add acceptance V-J33, V-J34 and V-J16"
```

---
### Task 18: The board: Plan 6's decisions, and the checks only a phone can do

**Files:**
- Modify: `docs/reimagine/BOARD.md`

**Interfaces:** none. Task 6's entry is D85. These are D86 to D94, from Plan 6's allocation of D85 to D94.

- [ ] **Step 1: Append the entry.** Write the day it's added in the heading.

```markdown
### 2026-10-10 — [claude] Plan 6 (Walk): decisions, and the device checks before release

| # | Decision | Reason |
| --- | --- | --- |
| D86 | Every start to `/walk/live` goes through `useStartMovement`'s walk path: the first walk's questions (keep routes; map pictures, only while routes are kept; the step card, only when counting steps), then B-01's sequence in the tap that finally starts the walk. Each answer is stored as it's given, so a start the gate refuses keeps them and asks nothing twice | J§9.1, B-01, A-51, K-09, K-29; V-J19 |
| D87 | B-09's walk is recorded as after the meal "had at" the stated time: tagged `afterMeal`, with no `mealStartedAt`; the summary says "Had at", the note "which you had at" | Plan 2's D50 left it to this plan; B-09 |
| D88 | A segment's time accrues from device-clock steps while they agree with the monotonic clock to within 120 s. Past that, the monotonic step counts, the segment closes as `clockChange`, and a reading taken before the change is untimed for the restart question. The acceptance suite moves a recording walk's time at most 60 s at a time, and cues have 65 s of grace for it | B-19, A-75; V-J41 is Plan 8's journey |
| D89 | The walk journal is IndexedDB `walkJournal`, outside the record (no revision, no backup, no other tab). It's written at every change and every 15 s, with the route only when routes are kept, and retired in the save's own transaction. Home offers a walk whose journal has been quiet for 2 minutes and isn't held by this tab's draft | J§9.4, A-55, A-57; V-J34 |
| D90 | A route is one line per GPS run, never joined across a gap or a dropout. It's kept only after this phone's "Yes", at most 1,000 lines and 20,000 points, never in `sessionStorage`, in a backup only with "Include your routes", and an import never switches either consent on | B-17, A-48, J§18.3, B-26 |
| D91 | Map pictures are our own static map: OpenStreetMap's standard tiles for the current view only (at most 9 at 400×300), as plain `<img>`s with the browser's caching and the page's Referer (`strict-origin-when-cross-origin`). The CSP adds `https://tile.openstreetmap.org` to `img-src` and nothing else. None are requested during a live walk, offline, while hidden, or in the history, whose thumbnails are our own SVG. The credit is a visible link under the map | J§9.5, J§22, B-23, M14 |
| D92 | Energy is (MET − 1) × kg × hours, from the 2024 Adult Compendium for those certainly 19 to 59 this year. Time without a usable speed counts at 17152 (2.8). It's rounded to the nearest 10, with no figure under 5 kcal or for a speed of 5 mph and over. The weight is the last reading on or before the walk, else the profile's. It's saved as an `activeEnergy` observation whose note says what it used | J§12.4, B-16, B-17, B-18, B-31 |
| D93 | "Erase all routes" is one transaction: the routes store emptied with its keys remembered (D-06), every journal rewritten without its route, and `routesErasedAt` set. Every tab's live walk watches that and forgets its route, and the store never keeps a route that began before it. Deletion records hold ids only today; **Plan 8 must clear route coordinates from its deletion payloads in this same operation** | B-05 |
| D94 | Cues are five recorded single sentences at 10, 20, 30, 45 and 60 minutes of recorded time, said within 65 s of the minute. They play through one audio element that the start tap unlocks. There's no device-voice fallback, and a cue stops on pause, a hold, Finish, leaving, mute, a call or headphones out, and is never resumed | J§9.2, A-72, B-01 |

**Checks only an iPhone can do** (before release; record the results here, with the phone and iOS version):
1. **Motion permission, every cold launch:** the prompt appears from the tap that finally starts the walk (the hub's Start, the check-in's Start, or the step card's), not before the step card. "Don't Allow" gives a walk that says "Steps not counted".
2. **Steps** over 200 counted steps, each within ±10%: a slow gait (about 1.5 steps a second); with a walking stick; and with the phone in the hand, a trouser pocket, a shirt pocket and on a lanyard. A limping gait counts both legs.
3. **Audio:** the 10-minute cue plays after the start tap. A call, or headphones pulled out mid-cue, stops it, and it doesn't resume. After a reload mid-walk, "Turn the voice on" unlocks it.
4. **Wake Lock,** in Safari and installed: the screen stays on through a 15-minute walk. When it's refused or released, "Keep this screen on to keep tracking." shows.
5. **Map pictures on the deployed site:** each tile request carries the site's Referer and returns 200. The credit link opens OpenStreetMap's copyright page.
6. **A screen lock mid-walk:** "Recording paused while the app was away" on return, and a separate line and segment.
7. **A clock or time-zone change mid-walk** (Settings → General → Date & Time): the recorded time stays right, and a restart asks for a fresh reading.
```

- [ ] **Step 2: Commit**

```bash
git add docs/reimagine/BOARD.md
git commit -m "docs: Record Plan 6's walk decisions and the checks only a phone can do"
```

---

### Task 19: The full run, the reviews and the reconciliation

**Files:** whatever the findings touch; `docs/reimagine/BOARD.md`.

**Interfaces:** none.

- [ ] **Step 1: Every gate, and the production build**

```bash
mkdir -p /tmp/fit-checks
npx tsc -b && npm run lint && npx vitest run > /tmp/fit-checks/unit-v2-p6.log 2>&1; tail -n 15 /tmp/fit-checks/unit-v2-p6.log
npm run build > /tmp/fit-checks/build-v2-p6.log 2>&1; tail -n 15 /tmp/fit-checks/build-v2-p6.log
grep -o "img-src[^;]*" dist/index.html
```

Expected:
- every unit test passes, `src/voice/packs.node.test.ts` and `src/walk/tilePolicy.node.test.ts` included;
- the build succeeds;
- the last line prints `img-src 'self' data: blob: https://tile.openstreetmap.org`.

- [ ] **Step 2: The full acceptance suite**

```bash
npm run e2e:acceptance > /tmp/fit-checks/accept-v2-p6.log 2>&1; tail -n 40 /tmp/fit-checks/accept-v2-p6.log
```

Expected: every case passes in all four projects, V02, V16, V19, V20, V33, V34, J10 and J11 included. For each failure, decide whether a journey's steps no longer match a deliberate change (fix the journey, and say why on the board) or the app regressed (fix the app, with a failing unit test first). Clinical assertions are never loosened (A-76).

- [ ] **Step 3: The bundle and the prompt for Codex**

```bash
BASE=$(git log --format=%H --grep='Add IndexedDB 2 and schema 6' -n 1)^
{ cat docs/superpowers/plans/2026-10-10-fitstrong-v2-plan-6-walk.md; printf '\n\n## The diff\n\n'; git diff "$BASE"...HEAD -- src scripts public vite.config.ts docs/reimagine/BOARD.md; } > /tmp/fit-checks/v2p6-bundle.md
cat > /tmp/fit-checks/v2p6-prompt.md <<'EOF'
Review FitStrong v2 Plan 6 (Walk), statically, at maximum effort. The plan and the diff are in /tmp/fit-checks/v2p6-bundle.md. The spec is docs/superpowers/specs/2026-10-08-fitstrong-v2-journey-design.md (§9, §12.4, §18.2–18.3, §22, and §25's B-01, B-05, B-17, B-18, B-19, B-23, B-24, B-26 and B-29) and docs/superpowers/specs/2026-10-08-fitstrong-v2-motion-design.md (M10, M13, M14). Read every file the diff touches in full. Report each real bug as: id, severity, file:line, what a person would see, and a failing test (Vitest node, or an acceptance step) that would catch it. Look hardest at: a motion request or audio unlock outside the tap's own handler; a refused final gate that still starts anything; time accrued wrongly across a clock change, a reload or midnight; a route or coordinate kept, journalled, backed up or imported without this phone's consent, or left anywhere after "Erase all routes"; a tile requested during a live walk, offline, while hidden, outside the view, or without the page's Referer; a walk saved twice, or a journal left behind; an energy figure for an age, weight or speed the Compendium doesn't support; a v5 database upgraded wrongly to IndexedDB 2. No style comments.
EOF
codex exec -m openai.gpt-6.1-sol -c model_reasoning_effort='"max"' -c 'model_providers.amazon-bedrock.aws.region="us-east-1"' -s read-only -C "$PWD" -o /tmp/fit-checks/v2p6-codex.md - < /tmp/fit-checks/v2p6-prompt.md
```

- [ ] **Step 4: Kiro, on the same diff, read-only**

```bash
kiro-cli chat --no-interactive --trust-tools=fs_read --model claude-opus-5.5 "$(cat /tmp/fit-checks/v2p6-prompt.md) Read the bundle at /tmp/fit-checks/v2p6-bundle.md, and the files it names with git and fs_read. Write nothing." > /tmp/fit-checks/v2p6-kiro.md 2>&1
```

- [ ] **Step 5: Reconcile.** For each finding from either review:
  - reproduce it with a failing test first (unit, or an acceptance step);
  - fix it, and run the gates;
  - or, if it isn't real, write down why.

  Then append to `docs/reimagine/BOARD.md` an entry headed `### <date> — [claude] Plan 6 reviewed by Codex and Kiro, reconciled`. List each finding's id, what it was, and its fix commit or why it was set aside. Re-run Codex on the fix set until a round reports no new bug, as Plans 1 to 5 did.

- [ ] **Step 6: The final run and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
npm run e2e:acceptance > /tmp/fit-checks/accept-v2-p6-final.log 2>&1; tail -n 40 /tmp/fit-checks/accept-v2-p6-final.log
git add -A src scripts public vite.config.ts docs/reimagine/BOARD.md
git commit -m "fix: Reconcile Plan 6's review findings"
```

Expected: every gate is clean and every acceptance case passes. Record the final counts on the board.

---
## Self-review

Run against the spec with the plan finished, as the writing-plans checklist asks.

**1. Spec coverage.** Each requirement, and the task that builds it.

| Spec | What it asks | Task |
| --- | --- | --- |
| J§9.1 | The gate first; two separate route consents, the map one only while routes are kept, each changeable in Me | 8, 14 |
| J§9.1, K-29, B-24 | The one-time step card, in B-24's words, before motion is asked for | 8, V-J20 |
| J§9.1, B-01, A-53, M10 | Motion and audio in the tap that finally starts the walk; wait; the final gate; start once; refused motion means "Steps not counted" | 7, 8, 10, 12, V-J02, V-J19, V-J20, J10 |
| J§9.1, §9.4 | Location refused: "Walk without location", how to turn it on, time and steps kept | 8, V-J20 |
| J§9.2, M13, K-08, A-54 | The route on a plain grid with a "you are here" dot; redrawn at most once a second; the whole route kept in view by stepping; Zoom in, Zoom out, Show whole route | 2, 10 |
| J§9.2, D18 | No map pictures during a live walk | 10, 11, J11, V-J34, V-J16 |
| J§9.2, A-48, A-68 | A solid stats panel; pace only with distance; energy not shown live | 10 |
| J§9.2, A-72, B-01 | Cues at 10, 20, 30, 45 and 60 minutes from recorded lines; cancelled on pause, stop, exit, interruption | 9, 10, V-J02 |
| J§9.2 | Wake Lock, and "Keep this screen on to keep tracking" | 10 |
| J§9.3, F17, B-17 | Segments drawn apart, a gap never joined, a dropout breaking the line; each day credited | 2, 3, 12, V-J33 |
| J§9.3, B-19 | Elapsed time from monotonic deltas; a clock change splits the segment and asks for a fresh reading | 3 |
| J§9.4 | Weak GPS, screen lock, midnight, map pictures unavailable, storage full | 3, 4, 10, 11, V-J33, V-J16 |
| J§9.4, A-55, A-57 | A crashed walk offered on Home under the Right now card, saved once | 4, 13, V-J34 |
| J§9.5, M14 | Our own drawing with start and end; opt-in tiles under it, credited; Zoom in, Zoom out, Recentre; "Hide map"; one opt-in, not a tap per view | 11, 12 |
| J§9.5 | Distance with its covered time, pace, steps with their coverage, about … kcal, the after-meal tag, splits, notes and endings | 12, 13 |
| J§9.5 | History thumbnails; deleting a route on its own, or all routes | 11, 12, 14 |
| J§12.4, B-16, B-17, B-18, B-31 | (MET − 1) × kg × hours with the weight at the time; bands for every speed; by age; 60 and over only once confirmed | 5, 6 |
| J§18.2, §18.3 | IndexedDB 2 and schema 6; the routes record; one transaction; recovery state retired with the commit; routes opt-in in backups; validated imports | 1, 4, 14 |
| J§22, B-23 | No map library; standard tiles for the current view only; HTTP caching and Referer; no precache or offline copies | 11, V-J34 |
| B-05 | "Erase all routes" from routes, journals, buffers and deletion payloads | 14, V-J34 (payloads: Plan 8, D93) |
| B-09 | The stated meal time, recorded as "had at" | 7, 8, 12, V-J02 |
| B-24 | The step card's words; the privacy line with map pictures | 8, 14 |
| B-26 | An import never switches maps or routes on; the restore preview says what happens to routes | 1, 14 |
| B-29 | Under Reduce Motion, a fixed live view with a manual "Show whole route"; tiles without fading | 10, 11 |
| Roadmap | V-J02, V-J16, V-J19, V-J20, V-J33, V-J34 pass; J10 and J11 updated | 15, 16, 17 |
| Board | The Compendium check, the decisions, the device-only checks | 6, 18 |

Two items are left to other plans, as the brief says: the Steps hub's day figure (J§9.6, Plan 2) and V-J41 (Plan 8). V-J41's rules are tested in Task 3.

**2. Placeholder scan.** A search for TBD, TODO, "implement later", "fill in", "similar to Task", "appropriate error handling" and "handle edge cases" finds nothing. "…" appears only in on-screen copy ("Finding your location…") and where a step names existing code it doesn't change (`createTrack(…)`). Every code step has its code. Every test step has its test and its expected result.

**3. Type consistency.** These were checked across tasks, and fixed where they had drifted:
- `WalkVoice`: Task 8's port already has Task 9's exact shape (`say` returns `Promise<CueResult>`; `trouble` and `status`).
- `PreflightStage` carries each walk's answers, so the final tap never reads a setting the store hasn't written yet.
- `RouteView` takes `transitionName`, which Tasks 11 and 12 pass, and only when Reduce Motion is off.
- `WalkSettings` (Task 1's type, through `walkSettings`) gains `routesErasedAt` in Task 14. `withDeviceConsent` keeps a device's own `walk`, so an import can't carry it.
- Store functions keep one signature throughout: `saveWalk(SaveWalkInput)`, `removeWalk(walkId, ids)`, `eraseRoutes()`, `putRecords` and `removeRecords`.
- `walkSave(walk, { route?, energy? })` is called the same way by the summary (Task 12) and the recovery row (Task 13).
- `summaryRows`' `energy` option takes `energyText`'s `{ value, detail }`.
- `LiveSnapshot` gains `route`, `here` and `journalFull` (Task 4). The one hand-built snapshot, in `readout.test.ts`, gains them too.

Every cross-task name has a definition in the plan.

**4. Review Focus.** Each line has its test in the owning task:
1. v1's v4 blob still in `localStorage` on the first v2 launch: Task 1's migration tests.
2. Home and a walk still being recorded, or held in this tab's draft, and Save tapped twice: Task 13's `recovery.test.ts` and `recovery.callers.test.ts`, with V-J34 end to end.
3. A borderline or missing birth year: Task 5's energy tests.
4. A backup's routes against this phone's consent: Task 1's transfer tests and Task 14's `routeNotes` tests.
5. A refused final Start keeps the consents: Task 8's `walkStart.callers.test.ts`, with V-J19 end to end.

**Notes for whoever runs this plan**
- **Order.** Plans 1 and 2 come first. Task 8 edits Plan 2's Walk hub, and Task 14 fills Plan 4's "Walks and maps" group if Plan 4 has run, or adds it.
- **Time in the acceptance suite.** A recording walk's time moves at most a minute at a time (Task 15).
- **Voice.** Task 9 renders new Kokoro clips. That needs the renderer's model on the machine, and the five clips should be listened to before committing.
- **Plan 7** adds its three record rules to Task 1's registry and nothing else in the plumbing. The registry is `RECORD_RULES` in `src/store/records.ts`. Food stores need no IndexedDB index.
