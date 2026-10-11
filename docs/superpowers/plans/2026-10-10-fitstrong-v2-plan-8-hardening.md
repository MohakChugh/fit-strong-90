# FitStrong v2 Plan 8: Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make v2 hold up when things go wrong, then prove all of it. The last recovery journeys become acceptance cases. An update installs whole, under names its own bytes give, and waits, as the platform's own service worker lifecycle has it, until no window of FitStrong still runs the release in use; nothing ever reloads by itself, and Home offers a restart only when nothing is under way and no other window is open, behind a cover that lets no new work in. Storage lost while the app runs leaves every screen as it was, read-only. No delete, retime or correction lifts a hold the engine hasn't released: it is refused, whoever asks, with v1's "It was a mistake" as the way out for exactly the reading typed wrongly, and a correction keeps what it replaced. Backups have published limits, and a file past one is refused in plain words before it is read or converted, with nothing changed. A routine delete happens at once with Undo and stays in "Recently deleted" for 7 days, and "Erase all routes" clears every copy. Own foods can be edited, Food gets its trend and Browse its food results, the programme ends cleanly after week 12, every control is a target a finger can find (48 px, 60 for a main target, 12 px apart, never two under one finger) on every screen, and the performance budget is measured. Then every journey passes at both sizes in light and dark, the whole of v2 is reviewed, and it's offered as a draft PR.

**Architecture:**
- **Updates are the platform's own** (`public/sw.js`, `src/app/updates.ts`, `src/screens/home/UpdateRow.tsx`, `src/app/RestartCover.tsx`). The worker never skips waiting by itself, and takes a page over only as the first release on a device, so a new release waits until no window still runs the old one; it serves each window from its own release only, its own shell included, and lets an older-numbered release's cache go only at a later one's activation. The page reloads only at the person's own "Restart to update", which the worker allows only while that window is FitStrong's only one, behind a cover that lets no new work in (D106). No lock, no busy protocol, no automatic reload.
- **Each release is atomic** (`src/app/release.ts`, `vite.config.ts`): every file of it precached under a name its own bytes give, fetched past the HTTP cache, stamped by every byte and the worker's code, numbered after every release before it, installed whole or not at all (D120).
- **Upgrades need nothing more** (`src/store/useStore.ts`, `src/store/successor.ts`, `src/store/writable.ts`): a migration runs at the new release's start, when no old window is open; a copy meeting a newer database says so in true words and saves nothing; one that loses its storage while it runs keeps every screen, read-only, and starts nothing new; the suite's successor build makes two real releases (D107, D121).
- **No change lifts a hold** (`src/store/holds.ts`, asked by the store's `planOn` for every change). Every change that takes away or alters a clinical measurement is asked of the engine before and after, for every mode now and the day's answer today and tomorrow; one that would loosen anything is refused, with nothing written, unless each measurement it takes away, by the engine's own name for it, has been answered as typed wrongly; and while the phone's clock change holds the device, every such change is refused. `HeldProblem` says so beside the control, and "It was a mistake" answers exactly those measurements, as v1 does, before the change goes through. A correction keeps what it replaced on its record (D119).
- **Backups' limits live in one module** (`src/store/limits.ts`), checked on the file's size before it is read, on the raw document before any legacy conversion, and on the converted one after; the walk over a document keeps a frame per level and no call stack, its memory bounded by the file-size limit. Me → Data lists them word for word, and an export past one warns and still keeps everything.
- **Recently deleted is a pure module** (`src/store/recent.ts`): a deletion's plan, everything that belongs to the record in one entry, and a restore's plan, with fresh ids, references rewritten, this device's own lineage and each statement's own `order`, which keeps two said at one instant in their order on every device. Entries, lineage and expiry's clock are content rows that never leave the device, and a Replace keeps the lineage and the clock; expiry happens in one place, at a start, on a return and on time while the page runs, and a restore is checked as it commits (D109, D110).
- **Undo is one module** (`src/components/hig/undo.ts`, moved from Plan 7's food Undo), scoped by provenance: the screen it was offered on and the record details opened from it, followed through router state. Any edit the store commits ends it, and what a tap did is said in place, never on a timer (D113).
- **Food's trend is one more view** (`src/screens/trends/food.ts`) that produces Plan 3's `TrendView` and `ChartModel`. Browse's food rows are a separate pure module, so the food table stays off the first screen. Own foods are edited in Me → Food (D111).
- **Targets are measured, not assumed** (`scripts/e2e/acceptance/lib/targets.mjs`, journey S02). One in-page reading of every control on a screen, and one pure judgement of it against J§20.4 rule 1 with its exceptions listed, run on every screen S01 visits, every task screen and Plan 8's own, at 100% and 200% text (D122).
- **The acceptance suite** gains the clock jump, a time-zone change, an earphone press, a driven worker, a second tab, two real releases served at one origin with their workers, a WebGL draw counter, and a strict release mode; then the ten journeys, the target sweep and a budget journey.

**Tech stack:** React 19, TypeScript (strict, `erasableSyntaxOnly`, `verbatimModuleSyntax`), Vite 8, Tailwind v4, React Router 7.13 hash data router, the hand-rolled IndexedDB store, the Service Worker and Cache APIs, date-fns 4, sonner, Vitest (node environment), and the Playwright-core acceptance suite (`npm run e2e:acceptance`, headless Chromium). No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-08-fitstrong-v2-journey-design.md` (cited as J§): §1.2, §2, §4 (4.4–4.6), §13, §17.2, §18, §20.4, §21 and §25 (B-04, B-05, B-11, B-19, B-21, B-22, B-26, B-27 and B-30; §25 overrides earlier text). Also `docs/superpowers/specs/2026-10-08-fitstrong-v2-motion-design.md` §7 (the performance budget) and M19, and `docs/superpowers/specs/2026-10-08-fitstrong-v2-audit-log.md` (A-05, A-56, A-58, A-60, A-75, A-76). The roadmap is `docs/superpowers/plans/2026-10-08-fitstrong-v2-roadmap.md`. Read J§4.6, §17.2, §18.1, §21.2 and §25 before starting.

**Depends on:** Plans 1 to 7, merged into `feat/v2-journey` and reviewed, including Plan 3's fix for H3-19 (Track's shared `Segmented` at 48 px, which Task 13 measures and never touches), Plan 6's fix for H6-03 (Replace and both Merge policies keep this device's open and answered incidents, `openIncidents` in `src/store/transfer.ts`) and its `eraseRoutes` (one transaction across routes, journals, buffers, a live walk and the other tabs), Plan 6's fix for H6R-02 (board D174: the phone's clock change is the device's own hold, `settings.walk.clock`, marked by `markClockChange`), and Plan 7's fix for H7-09, which K7-11's edit needs (board D134: each meal item keeps a full snapshot of its own food, its name, portion `per`, `basis` and `version`, the food's `updatedAt` when logged). Plan 8 runs last and builds on what they left; it changes their code only where a task says so. Task 1 checks every name below against the code. This plan uses:
- **The engine and check-ins (v1, kept by Plans 2 and 6):** `effectiveCheckIns` (with Plan 6's `clock`), `loggedReadings`, `withReadingRemoved`, `removeCheckInReading`, `reviseCheckIn`, `saveWith`, `pendingCheckIn`, `type CheckInReading` (`src/components/checkin/pending.ts`); `evaluateCheckIn`, `profileOnlyReadiness`, `glucoseReadingId`, `bpReadingId`, `bpPartialId`, `ketoneReadingId`, `standingAnswer`, `toMgdl`, `withLogged` (`src/engine/readiness.ts`); `arrivalGate`, `startGate`, `liveGate` (`src/session/gate.ts`); `permission`, `readinessFor` (`src/engine/permission.ts`); `deviceClinical`, `walkInput` (`src/walk/gate.ts`); `useGuided` (`src/hooks/useGuided.ts`); `peekWalk`, `storeWalk` (`src/walk/persist.ts`), `startWalk` (`src/walk/clock.ts`).
- **Plan 3 (Trends):** `TRENDS`, `trendDef`, `TREND_ORDER`, `hasData` (`src/screens/trends/metrics.ts`); `TrendData` (`records.ts`); `TrendView`, `Headline`, `StatItem`, `trendRow`, `TrendRowView`, and the private `slotLabel` and `slotName`, which Task 9 exports (`model.ts`); `ChartModel`, `Slot`, `ChartSeries` (`chart.ts`); `windowOf`, `windowTitle`, `rangeText`, `TrendWindow` (`periods.ts`); `DayContext` (`stats.ts`); `CategoryTrend.tsx`, `TrendsScreen.tsx`, and `routes.tsx` with its `FoodHub` redirect (D74).
- **Plan 4 (Browse and Me):** `browse`, `BrowseRow`, `BrowseResults` (`src/screens/browse/browse.ts`); `BrowseRows` (`BrowseList.tsx`); `RestoreFlow.tsx`'s "Records that differ"; `previewLines` (`src/screens/you/summaries.ts`); `DataScreen.tsx`'s Backups group; `BackupBody` (`DataSheets.tsx`).
- **Plan 6 (Walk):** IndexedDB 2 and schema 6, `RECORD_RULES` (with `keeps`), `Change.records` and `Change.journal`; `saveWalk`, `removeWalk`, `eraseRoutes` (Task 14, D93) and `markClockChange` (H6R-02) in `src/store/useStore.ts`; `ClockHold` (`src/types/checkin.ts`); `openIncidents`, `ImportPreview.keepsOpen` (H6-03) in `src/store/transfer.ts`; `RouteRecord`, `routeRecord` (`src/walk/routeRecord.ts`); `newWalkId`, `isWalkId` (`src/walk/plan.ts`); the acceptance helpers `walk.start`, `walk.elapse`, `walk.played`, `walk.cueHeard`, `walk.emit`, `walk.stored`, `walk.timer`, `walk.gpsSwitch`, and the `play()` wrapper and `emitPosition` in `lib/inpage.mjs`.
- **Plan 5 (Workout):** `useWorkout`'s in-memory workout (`memory.live` in `src/screens/workout/useWorkout.ts`).
- **Plan 7 (Food):** `mealsIn`, `customFoodsIn`, `savedMealsIn` (`src/food/records.ts`); `saveMeal`, `deleteMeal`, `restoreMeal`, `deleteUsual`, `restoreUsual` (`src/food/store.ts`); `freshId` (exported from `src/store/useStore.ts`); `CustomFood` (its `updatedAt` is the version of its definition), `CustomItem` (with its fix's snapshot: `per`, `basis` and `version`, the food's `updatedAt` when logged), `MealRecord`, `SavedMeal` (`src/food/types.ts`); `customItem` (`src/food/estimate.ts`); `OwnFoodPage` (`src/screens/food/parts.tsx`); `FOOD_COPY` (`src/food/copy.ts`); `offerFoodUndo`, `endFoodUndos`, `useFoodUndoScope` (`src/screens/food/undo.ts`); `TOAST_STYLE`, `UNDO_STYLE` (`src/components/hig/toast.ts`); `searchFoods`; `foodRowDetail`, `kcalText`, `carbsText`, `SLOT_LABEL`, `itemsLine`; `totalsOf`; `numbersView`, `NumbersView`, `countsFree`; `logHref`; `FOODS`; `FoodScreen.tsx` (Me → Food); `WORDS_ONLY` in `src/food/boundaries.node.test.ts`; `lib/food.mjs`; and V-J31's pending check for Food's trend.

If a name has moved, use it where it now lives, keep this plan's behaviour, and name the new path in the task's commit message.

**What other plans already prove, and so isn't redone here** (checked against `docs/reimagine/codex-acceptance.md` and every plan's acceptance task):
- V-J24 (Plan 3), V-J35 and V-J39 (Plan 4, its D64), and Plan 6's V-J34 crash and route erasure stay with their plans. The roadmap's "V-J21 to V-J25, V-J32, V-J35, V-J36, V-J38 to V-J42" is therefore V-J21, V-J22, V-J23, V-J25, V-J32, V-J36, V-J38, V-J40, V-J41 and V-J42.
- **V-J25's** plan-shift offer, accepted and declined, is J07 steps 5–6. V-J25 here proves "no Carry on while away", with B-30's Unwell variant, and accepts the offer once.
- **V-J38's** "storage full during a log" is J17 steps 1–2 (a reading) and V-J03's refused-save case (a meal). V-J38 here proves the update half, B-21's two copies and interrupted upgrade, and two real releases.
- **V-J21's** "I feel low" in a running stretch is in J13 step 4. V-J21 here proves what J13 doesn't: leaving the low guidance by its own button, and earphone Play, held until the release.
- **V-J32** follows B-05, not its own wording: §25 overrides "with its deletion record removed" (D112).
- **Imports and open incidents** are Plan 6's (H6-03). Plan 8 keeps nothing on the side for a deleted reading: a reading that holds can't be deleted (D119), and Task 6 checks an older backup merged and replaced over a held low leaves it holding.

## Global Constraints

- **Branch and commits:** work on `feat/v2-journey`. One commit per task, with a conventional message. Never push to `main`. "`feat/v2-journey` merges only after Plans 1–8 pass" (B-22); the PR Task 18 opens is a draft, and nothing in this plan merges it.
- **Local-only** (J§2): "IndexedDB on the device, with no account, no server, no paid API and no API key. Health data never leaves the device." No new network request and no new dependency. The suite fails any request that leaves the origin.
- **Updates** (J§21.2, verbatim): "The service worker caches each release atomically, with a version stamp." "New lazy screens and data are precached." "An update never reloads during a session, a walk or a sheet with answers. It waits, then shows 'Updated' on the next Home."
- **B-21, verbatim:** "Updates are coordinated across tabs. The app handles `blocked` and `versionchange` (v1 closes the connection), and defers migration and activation until active tasks are saved or discarded. A test covers two tabs and an interrupted upgrade."
- **B-26, verbatim:** "Import limits are published in Plan 8: file size, record and point counts, text lengths. Every store gets a conflict preview, and Replace and Merge are each one transaction. An imported map setting never switches maps on: this device's own consent is kept, and a new device asks."
- **B-04, verbatim:** "The two latest Undo actions are kept within the screen they came from and its details. Another delete stacks a second one, and restoring one keeps the other. Leaving that screen, or an unrelated edit, ends the toast; 'Recently deleted' remains. Routine deletes happen at once, with no confirmation."
- **B-05, verbatim:** "Restoring a deleted record is merge-safe. It's restored under a fresh id with `restoredFrom`. The original's deletion record is kept, so an older backup can't delete it again, and references are rewritten in one transaction. A deletion keeps its dependent records for the 7 days. Erasing routes permanently is its own confirmed operation: it clears coordinates from routes, walk journals, buffers and deletion payloads."
- **J§20.4 rule 6:** "Today's log has a 'Recently deleted' row listing what was deleted in the last 7 days, each with 'Restore'." Undo is never on a timer (M19).
- **Safety** (J§4.6, A-05, verbatim): "Undo, delete, retiming, imports and later normal readings never resolve a real low, stop or flag. Corrections keep their history, and resolution follows each incident's own rule, as v1 does." A change that would lift a hold the engine hasn't released is refused (D119). The engine alone decides; nothing here computes a permission.
- **Food figures** (J§11.4, B-11): "No red, no 'over', and no judgement. 'Estimated' before every figure." "Partial totals are labelled 'in logged foods'. Unknown nutrients stay unknown, never zero." Counts-free "hides nutrition numbers and activity-energy figures everywhere (current screens, history, search, trends)". Every food figure goes through `numbersView()` or `countsFree()`, as Plan 7's boundary test checks.
- **Sizes** (J§2, §21.3): "The iPhone 13 Pro Max on iOS 27 (Safari 27) is the reference: 428×926 CSS px portrait." "320×568 and text at 200% must work." Acceptance runs "J01–J20 updated for navigation only, plus V-J01–V-J42, at both sizes and in light and dark."
- **No regressions** (J§1.2): "Where v2 changes how someone gets somewhere, only the navigation steps change in the test; the clinical outcomes it asserts stay the same (A-76)." Clinical assertions are never loosened.
- **Grandma rules** (J§20.4 rule 1, verbatim): "everything tappable is at least 48×48 px and never under 44, with at least 12 px between bezelled controls. Primary buttons and other main targets are at least 60 px tall." Task 13 measures it on every screen (D122). Every control has a visible text label. Body text is 17 px, and 200% text must reflow. Nothing the app says is on a timer (rule 8), and an error stays next to its cause (rule 9).
- **Copy:** Indian English, sentence case, verbs on buttons, a unit on every number, numbers in Indian grouping (`toLocaleString('en-IN')` or `formatNumber`). The exact strings are in each task, and tests pin them.
- **Tests:** Vitest runs in the node environment. A test that reads files with `node:fs` is named `*.node.test.ts`. Pure rules get unit tests; a caller is driven through the real store, engine and components (`@/test/host`, a fake IndexedDB, a fake service worker container), never a re-implementation; screens are proved by the acceptance suite in headless Chromium.
- **Gates before every commit:** `npx tsc -b`, `npm run lint` and `npx vitest run` must all pass.
- **Decisions** are D105 to D122 (D47–D104 belong to Plans 2–7, D123–D131 to Plan 3's review fixes, D132 onward to Plan 7's).
- **Repo text** (code, comments, fixtures, docs) describes synthetic personas only, with they/them pronouns, and never a real person's health.

## Review Focus

These are the failure modes the spec implies that no single task's ordinary tests would exercise. Each one's test is added to the task that owns the code.

1. **A dangerous reading deleted, retimed or corrected.** A standalone 52 mg/dL low, a 186/98 moved to yesterday, the 52 corrected to 152, a check-in's own low corrected, a check-in's 52 corrected through the store's own `update`, and a check-in holding an LO or a top number of 186 alone removed: each must be refused while the walk gate's `permission` refuses, with nothing written, late in the day and after midnight alike; "It was a mistake" then lets each go, answering exactly the measurement it takes away, so of two severe readings the other still holds; a current single reading has that way out too; while the phone's clock change holds the device, nothing clinical changes, the clock a day on and back; a correction the hold allows keeps what it replaced; and an older backup merged and replaced over a held low leaves it holding. Task 6 tests each through the real store and `permission`; V-J32 (Task 15) refuses a delete and a correction on screen, then answers and deletes.
2. **A merge after a restore.** An older backup still holds a record deleted here and restored under a fresh id, or a reference to it: a walk's pain rating, a meal's own food. Merging it, or a newer one that recorded the deletion, or one that knows only some other deletion, under either policy and after repeated cycles, must leave one copy, its references on the surviving record, this device's lineage untouched, and two water entries said at the same moment in their own order, here, on a device that had neither, and on one already holding the later of the two (P8R-06); and a Replace from this device's own backup keeps its lineage for the merges after it (P8S-08). And a dependent deleted on its own and restored before or after its walk names the walk that came back, or stands alone. Task 5 tests it through `planImport`.
3. **"Erase all routes" with a deleted walk in Recently deleted, and a `settings.deleted.recent` planted by a file.** No coordinate may remain in the store, its raw rows or the next backup, and restoring the walk later brings it back without a route. Task 5 tests the store and its raw rows.
4. **An update while a walk, a manual workout, a typed form or the profile's edit cover is open, or while another window is open.** Nothing reloads by itself in any of them, on screen or with the phone locked; a new release applies only when no old window is left, a first visit's included, or at the person's own Restart, which is offered only with nothing under way and no other window, and lets in no new work while the worker answers; a window keeps its own release's files, offline too, while a newer one waits, and no release's cache goes while one installs after it; and storage lost to a newer copy keeps the app on screen, read-only. Task 2 and Task 3 test the worker, the page and the store; V-J38 (Task 15) checks each path, and two real releases end to end.
5. **A hostile file:** one enormous text, nesting no app writes, a broad array, an object with 2,00,000 keys, a small gzip that unpacks past the limit, a file too large to read, or a legacy backup past a limit. Each must be refused with its own words before any record is read or converted, with a frame per level of nesting, memory bounded by the file-size limit, and nothing changed. Task 4 tests every one.

---

## File map

| File | Responsibility |
| --- | --- |
| `docs/reimagine/BOARD.md` (modify) | D105–D122, with D109's spec amendment; the device checklist; the results |
| `scripts/perf/first-screen.mjs`, `scripts/perf/budget.json` (new); `package.json` (modify) | The first screen's JavaScript, measured against the size recorded at the start |
| `scripts/e2e/acceptance/lib/ids.mjs` (new); `scripts/e2e/acceptance/run.mjs` (modify, Task 1) | One id form for `--only`, and no selector that matches nothing |
| `public/sw.js`, `vite.config.ts`, `index.html` (modify); `src/app/release.ts`, `release.test.ts`, `sw.node.test.ts`, `src/motion/models.ts` (new); `public/models/*.bin`, `public/favicon.svg`, `public/apple-touch-icon.png` (moved under `src/assets/`); `MotionView.tsx`, `src/motion/lab.ts`, `scripts/character/build.mjs`, `scripts/motion/probe.ts`, `clips.node.test.ts`, `shell.node.test.ts` (modify) | Each release cached whole, every file named by its bytes and fetched past the HTTP cache, stamped and numbered; the worker that waits, takes over only a first visit, answers `windows` and `restart`, serves each window its own release, and retires only older releases |
| `src/app/updates.ts`, `updates.test.ts`, `underWay.ts`, `RestartCover.tsx`, `restart.callers.test.ts`, `src/screens/workout/underWay.ts` (new); `useWorkout.ts`, `useStore.ts` (`holdNewWork`, `whenSettled`) (modify); `src/screens/home/UpdateRow.tsx` (new), `HomeScreen.tsx` (modify) | The page's side of an update: a waiting release found, windows counted, what is under way, Restart to update behind its cover, "Updated" until dismissed |
| `src/main.tsx`, `src/App.tsx` (modify) | Starts the updates; no automatic reload; the restart's cover over an inert app; Undo follows the route; edits end the Undos |
| `src/components/hig/ErrorBoundary.tsx` (modify), `ErrorBoundary.test.ts` (new) | Words that are true, and a way back to an unsaved walk |
| `src/store/successor.ts`, `successor.test.ts`, `upgrade.test.ts`, `writable.ts`, `src/vite-env.d.ts` (new); `src/store/db.ts`, `migrate.ts`, `useStore.ts`, `useStore.test.ts`, `src/session/gate.ts`, `src/App.tsx` (modify) | The successor build's versions; true words for a newer or an older copy; a newer schema stops this copy; storage lost mid-use keeps the app, read-only, and starts nothing new; Try again restarts onto a waiting release |
| `src/store/limits.ts`, `limits.test.ts` (new) | B-26's limits, their refusals, the export warning and the published lines |
| `src/store/transfer.ts`, `transfer.test.ts`, `review.test.ts` (modify) | Limits before reading and converting; this device's own rows never in or out; a merge reads a file through this device's lineage |
| `src/store/holds.ts`, `holds.test.ts`, `holds.callers.test.ts` (new); `src/store/db.ts`, `useStore.ts`, `src/health/observation.ts` (modify) | A change that would lift a hold refused before anything is written, asked for every change whoever makes it; exactly the measurements it takes away answerable; the clock change's hold; a correction's history |
| `src/components/checkin/HeldProblem.tsx` (new); `pending.ts`, `pending.test.ts` (modify) | The refusal beside its control, "It was a mistake"; a check-in's reading taken out and put back, with its rows |
| `src/screens/track/EditSheets.tsx` (modify) | A refused correction or retime, said in the sheet |
| `src/store/recent.ts`, `recent.test.ts`, `recent.store.test.ts` (new); `snapshot.ts`, `src/types/index.ts` (modify) | Recently deleted; restores under fresh ids, checked as they commit; lineage, kept through a Replace; each statement's own order; expiry in one place, on time; every carrier, through the real store |
| `src/health/observation.ts`, `observation.test.ts`, `src/walk/routeRecord.ts`, `src/food/types.ts` (modify) | `restoredFrom` on a reading, a route and an own food; `order` on every statement |
| `src/screens/workout/deletion.ts` (new); `records.ts`, `records.test.ts`, `RecordScreen.tsx`, `sheets.tsx` (modify) | A workout deleted at once with what was recorded with it, restored as it was, its personal records worked out again; `DeleteSheet` goes |
| `src/components/hig/undoScope.ts`, `undoScope.test.ts`, `undo.ts`, `undo.test.ts` (new) | Undo, two deep, by provenance, said in place |
| `src/screens/food/undo.ts`, `undo.callers.test.ts` (Plan 7's file, rewritten; new test), `undo.test.ts` (Plan 7's, deleted: its cases moved to `src/components/hig/undo.test.ts`); `src/food/store.ts`, `src/food/store.test.ts`, `src/screens/food/LogMealSheet.tsx`, `UsualMealsScreen.tsx`, `FoodHubScreen.tsx`, `parts.tsx` (modify, Plan 7's) | Food deletes through Recently deleted, on the one Undo stack (H7-15); an own food edited as a new version (K7-11) |
| `src/screens/you/OwnFoodsScreen.tsx` (new); `src/screens/you/routes.tsx`, `FoodScreen.tsx` (modify) | Me → Food → "Your own foods", each with Edit and Delete |
| `src/screens/track/RecordDetails.tsx`, `MyDay.tsx` (modify); `restoreEntry.ts`, `deletes.callers.test.ts` (new) | Routine deletes at once with Undo, a held one refused in place; the Recently deleted row; one restore for every kind |
| `src/screens/track/recentRows.ts`, `recentRows.test.ts`, `recentRows.store.test.ts`, `RecentlyDeleted.tsx` (new) | Recently deleted's words and its sheet, counts-free as the person's choice is now |
| `src/screens/you/summaries.ts`, `summaries.test.ts`, `RestoreFlow.tsx`, `DataScreen.tsx`, `DataSheets.tsx` (modify); `preview.test.ts` (new) | Every collection in the preview and in its conflicts; "What a backup can hold"; the export warning |
| `src/screens/trends/food.ts`, `food.test.ts` (new); `metrics.ts`, `metrics.test.ts`, `records.ts`, `model.ts`, `CategoryTrend.tsx`, `TrendsScreen.tsx`, `routes.tsx` (modify, Plan 3's) | Food's trend |
| `src/food/boundaries.node.test.ts` (modify, Plan 7's) | The new figure files and the callers that gate them |
| `scripts/e2e/acceptance/journeys/v31.mjs`, `v08.mjs` (modify) | Food's trend checked, not pending; Browse's food row |
| `src/screens/browse/foods.ts`, `foods.test.ts` (new); `browse.ts`, `BrowseList.tsx`, `BrowseScreen.tsx` (modify, Plan 4's) | Browse's food rows |
| `src/lib/utils.ts`, `utils.test.ts`; `src/health/recommend.ts`, `recommend.test.ts`; `src/screens/hub/movement.ts`, `movement.test.ts`, `WorkoutHub.tsx`, `hooks.ts`; `src/screens/home/model.ts`, `model.test.ts`, `HomeScreen.tsx`; `src/screens/move/plan.ts`, `plan.test.ts`, `PlanScreen.tsx`; `src/pages/SessionPage.tsx`, `admission.ts`, `admission.test.ts` (modify, new) | After week 12 |
| `scripts/e2e/acceptance/lib/env.mjs`, `run.mjs`, `harness.mjs`, `inpage.mjs` (modify); `lib/recovery.mjs`, `lib/releases.mjs`, `lib/budget.mjs` (new) | 428×926, the clock and zone, earphones, a driven worker that can answer slowly, a second tab, two numbered real releases and a broken copy, draw counts, release cases one at a time, `--strict` |
| `scripts/e2e/acceptance/lib/targets.mjs`, `targets.check.mjs`, `journeys/s02.mjs` (new); `journeys/s01.mjs` (modify) | J§20.4 rule 1 measured on every screen, with its exceptions; no overlaps; words that fit; landmarks and headings (D122) |
| The controls under the rule (modify, Task 13 Step 6): `src/App.tsx`; `src/components/checkin/CheckInSheet.tsx`, `OutcomeBanner.tsx`, `SessionGate.tsx`, `parts.tsx`; `src/components/hig/ActionMenu.tsx`, `Screen.tsx`, `Sheet.tsx`, `StorageBanner.tsx`, `TabBar.tsx`, `toast.ts`; `src/components/motion/FormDemo.tsx`, `MotionView.tsx`; `src/components/profile/ChipGroup.tsx`, `ProfileWizard.tsx`, `VoiceSettingsCard.tsx`; `src/components/session/InfoSheet.tsx`; `src/components/ui/dialog.tsx`; `src/pages/SessionPage.tsx`; `src/reminders/ReminderBanner.tsx`; `src/screens/guide/FoodPicker.tsx`, `GuideScreen.tsx`, `parts.tsx`; `src/screens/home/HomeScreen.tsx`, `UpdateRow.tsx`; `src/screens/move/ExercisesScreen.tsx`, `controls.tsx`; `src/screens/today/RecommendationCard.tsx`, `StatusSheet.tsx`; `src/screens/track/EditSheets.tsx`, `MetricDetail.tsx`, `QuickLog.tsx`, `WhenRows.tsx`, `ui.tsx`; `src/screens/walk/LiveWalkScreen.tsx`, `RouteFrame.tsx`, `RouteView.tsx`, `StopSheet.tsx`, `guidance.tsx`, `parts.tsx`; `src/screens/welcome/FocusStep.tsx`; `src/screens/workout/TodayWorkoutScreen.tsx`, `parts.tsx`; `src/screens/you/FoodScreen.tsx`, `HabitSheets.tsx`, `RestoreFlow.tsx`, `controls.tsx` | 48 px targets, 60 px main targets, 12 px between bezelled controls, none overlapping |
| `docs/reimagine/codex-acceptance.md` (modify) | The projects' sizes (D105), the strict release run (D121), the target rule (D122) |
| `scripts/e2e/acceptance/journeys/v21.mjs`, `v22.mjs`, `v23.mjs`, `v25.mjs`, `v32.mjs`, `v36.mjs`, `v38.mjs`, `v40.mjs`, `v41.mjs`, `v42.mjs`, `p01.mjs` (new) | Plan 8's journeys, and `PERF01`, the budget journey |
| `src/screens/walk/RouteThumb.tsx` (modify, Plan 6's) | A route thumbnail named only while its walk opens (D117) |
| `src/components/ui/sheet.tsx`, `dialog.tsx`, `src/components/motion/MotionView.tsx` (modify) | No full-page blur behind a sheet or a dialog, and no glass on the 3D demo's button (D117) |
| `scripts/journeys-inventory.mjs` (new) | Every J and V journey there once, or the release stops |

---

### Task 1: Baseline, the dependency check, one journey id, the first screen's size and the decisions

**Files:**
- Create: `scripts/perf/first-screen.mjs`, `scripts/perf/budget.json`
- Create: `scripts/e2e/acceptance/lib/ids.mjs`
- Modify: `scripts/e2e/acceptance/run.mjs` (`--only` reads every id form; a selector that matches nothing fails)
- Modify: `package.json` (the `perf:first-screen` script)
- Modify: `docs/reimagine/BOARD.md` (append)

**Interfaces:**
- Consumes: the names in "Depends on".
- Produces:
  - `norm(id: string): string` (`lib/ids.mjs`): `V-J21`, `VJ21` and `V21` are `V21`; anything else is upper-cased as it is;
  - `--only=V-J21`, `--only=VJ21` and `--only=V21` select the same journey; `--only` naming one that no journey has exits 2, before anything runs, saying which;
  - `npm run perf:first-screen`, and `npm run perf:first-screen -- --record`;
  - `scripts/perf/budget.json`: `{ firstScreenGzipBytes: number; recordedOn: string; files: number; margin: 1.1 }`, the size Plans 1–7 left;
  - the board entry with D105–D122, which every later task follows.

- [ ] **Step 1: The baseline**

```bash
git checkout feat/v2-journey
git status --short            # clean, except untracked docs
git log --oneline -n 60       # Plans 3, 5, 6 and 7's commits and their review fixes are in
npx tsc -b && npm run lint && npx vitest run
```

Expected: every gate passes. If one fails, stop: Plan 8 starts from a green branch.

- [ ] **Step 2: Check what Plans 3 to 7 left.** Each `grep` prints at least one line.

```bash
# The engine, check-ins and gates
grep -n "export function effectiveCheckIns\|export function loggedReadings\|export function withReadingRemoved\|export function removeCheckInReading\|async function reviseCheckIn\|export type CheckInReading" src/components/checkin/pending.ts
grep -n "export function evaluateCheckIn\|export function profileOnlyReadiness\|export function glucoseReadingId\|export function bpReadingId\|export function standingAnswer" src/engine/readiness.ts
grep -n "export function permission\|export function readinessFor" src/engine/permission.ts
grep -n "async function saveWith\|export function pendingCheckIn" src/components/checkin/pending.ts
grep -n "export function deviceClinical\|export function walkInput" src/walk/gate.ts
grep -n "effectiveCheckIns(" src/hooks/useGuided.ts
# Plan 3
grep -n "export const TRENDS\|export function trendDef\|export const TREND_ORDER\|export function hasData" src/screens/trends/metrics.ts
grep -n "export function dailyView\|export function trendRow\|export interface TrendView\|export interface TrendRowView" src/screens/trends/model.ts
grep -n "export interface ChartModel\|export interface Slot\|export interface BarSeries\|export interface RangeSeries" src/screens/trends/chart.ts
grep -n "export interface TrendData" src/screens/trends/records.ts
grep -n "function FoodHub" src/screens/trends/routes.tsx
# Plan 3's slot helpers, private there: Task 9 exports them (Codex P8R-18). Two lines.
grep -n "function slotLabel(\|function slotName(" src/screens/trends/model.ts
# Plan 4
grep -n "export function browse\|export type BrowseRow" src/screens/browse/browse.ts
grep -n "Records that differ" src/screens/you/RestoreFlow.tsx
grep -n "export function previewLines" src/screens/you/summaries.ts
grep -n "function BackupBody" src/screens/you/DataSheets.tsx
# Plan 6, including H6-03: Replace and both merges keep this device's incidents
grep -n "export function eraseRoutes" src/store/useStore.ts
grep -n "export function saveWalk\|export function removeWalk" src/store/useStore.ts
grep -n "export function openIncidents\|keepsOpen" src/store/transfer.ts
grep -n "export function startWalk" src/walk/clock.ts
# Plan 6's device clock hold (H6R-02, board D174), under which Task 6 refuses every clinical change
grep -n "export function markClockChange" src/store/useStore.ts
grep -n "export interface ClockHold" src/types/checkin.ts
grep -n "clock?: ClockHold" src/components/checkin/pending.ts
# Plan 5's manual workout, held in memory between screens (Task 2 asks whether one is under way)
grep -n "const memory: { live?" src/screens/workout/useWorkout.ts
grep -n "export function storeWalk\|export function peekWalk" src/walk/persist.ts
grep -n "H6-03" src/store/transfer.test.ts
grep -n "keeps" src/store/records.ts
grep -n "export function newWalkId\|export function isWalkId" src/walk/plan.ts
grep -n "export function routeRecord\|export interface RouteRecord" src/walk/routeRecord.ts
grep -n "export async function answerQuestions\|export async function elapse\|export const played\|export async function cueHeard\|export const emit" scripts/e2e/acceptance/lib/walk.mjs
grep -n "calls.play.push\|acc.emitPosition" scripts/e2e/acceptance/lib/inpage.mjs
# Plan 7
grep -n "export function freshId" src/store/useStore.ts
grep -n "export const deleteMeal\|export async function restoreMeal\|export const deleteUsual\|export async function restoreUsual" src/food/store.ts
grep -n "export interface CustomFood\|export interface CustomItem\|export interface MealRecord\|export interface SavedMeal" src/food/types.ts
# Plan 7's fix (H7-09, board D134), which K7-11's edit needs: each meal item keeps its own snapshot of the food. Prints 2.
sed -n '/^export interface CustomItem/,/^}$/p' src/food/types.ts | grep -c "basis:\|version:"
grep -n "export function customItem" src/food/estimate.ts
grep -n "export function OwnFoodPage" src/screens/food/parts.tsx
grep -n "deleted:\|removed:\|restored:" src/food/copy.ts
grep -n "export const mealsIn\|export const customFoodsIn\|export const savedMealsIn" src/food/records.ts
grep -n "export function offerFoodUndo\|export function endFoodUndos\|export function useFoodUndoScope" src/screens/food/undo.ts
grep -n "export const TOAST_STYLE\|export const UNDO_STYLE" src/components/hig/toast.ts
grep -n "export function searchFoods" src/food/search.ts
grep -n "export function foodRowDetail\|export function kcalText\|export function carbsText" src/food/format.ts
grep -n "export function totalsOf" src/food/estimate.ts
grep -n "export function numbersView\|export type NumbersView" src/food/level.ts
grep -n "function FoodScreen" src/screens/you/FoodScreen.tsx
grep -n "const WORDS_ONLY" src/food/boundaries.node.test.ts
grep -n "Food’s trend is out of Plan 7" scripts/e2e/acceptance/journeys/v31.mjs
# Plan 3's H3-19: Track's shared Segmented at 48 px (Task 13 measures it, and never touches it)
sed -n '/^export function Segmented/,/^}$/p' src/screens/track/ui.tsx | grep -c "min-h-12"
```

If one prints nothing (or `0`), that plan isn't merged, or its review fix isn't in: stop, and finish it first. Plan 8's import tests (Tasks 5 and 6) rely on H6-03, its own foods' edit (Task 7, K7-11) on Plan 7's H7-09 fix (each meal item's own snapshot of the food), and its target sweep (Task 13) on H3-19.

- [ ] **Step 3: Check the decision numbers are free**

```bash
grep -c "^| D10[0-4] " docs/reimagine/BOARD.md                         # Plan 7's last numbers: at least 1
grep -n "^| D10[5-9] \|^| D11[0-9] \|^| D12[0-2] " docs/reimagine/BOARD.md  # prints nothing
```

If any of D105–D122 is taken, stop and ask the coordinator; don't renumber.

- [ ] **Step 4: One id form, and no selector that matches nothing (D105).** Plans 2, 3, 4, 6 and 7 wrote journey ids three ways (`VJ07`, `V-J08`, `V21`), and the runner matches them exactly, so a selector in the wrong form is silently skipped while the others run. This comes first: Task 9 is the first to select Plan 3's journeys. Write `scripts/e2e/acceptance/lib/ids.mjs`:

```js
/**
 * One journey, one id (board D105): `V-J21`, `VJ21` and `V21` are `V21`, since
 * Plans 2, 3, 4, 6 and 7 wrote ids three ways. Anything else, upper-cased.
 */
export const norm = id => String(id).trim().toUpperCase().replace(/^V-?J?(\d\d)$/, 'V$1');
```

In `scripts/e2e/acceptance/run.mjs`, import `norm` from `./lib/ids.mjs`; the `only` line becomes:

```js
const wanted = args.only ? args.only.split(',').map(s => s.trim()).filter(Boolean) : undefined;
const only = wanted ? new Set(wanted.map(norm)) : undefined;
```

the file filter becomes `/^[jmpsv]\d\d\.mjs$/` (Task 13 adds `s02.mjs`, Task 16 `p01.mjs`), the loop's test becomes `if (only && !only.has(norm(mod.id))) continue;`, and after the loop, before `if (!journeys.length)`:

```js
// A selector that matches no journey is a mistake, even when the others match (P8-20).
if (wanted) {
  const found = new Set(journeys.map(j => norm(j.id)));
  const missing = wanted.filter(w => !found.has(norm(w)));
  if (missing.length) {
    console.error(`No journey matches ${missing.join(', ')}.`);
    process.exit(2);
  }
}
```

Run:

```bash
npm run e2e:acceptance -- --only=V-J05,VJ05,V05 --list
npm run e2e:acceptance -- --only=VJ07,V-J26,V27 --list
npm run e2e:acceptance -- --only=V-J05,V-J99 --list; echo "exit $?"
```

Expected: the first lists the one V-J05 journey once; the second lists Plan 3's three Trends journeys; the third prints "No journey matches V-J99." and `exit 2`.

- [ ] **Step 5: Write** `scripts/perf/first-screen.mjs`

```js
#!/usr/bin/env node
/**
 * The first screen's JavaScript (board D117): the entry script and every
 * module the built index.html preloads, gzipped as a server would send them,
 * against the size recorded when Plan 8 began. `--record` writes the size;
 * otherwise the run fails past the budget's margin.
 *
 *   npm run build && npm run perf:first-screen -- --record
 *   npm run build && npm run perf:first-screen
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DIST = path.join(ROOT, 'dist');
const BUDGET = path.join(ROOT, 'scripts/perf/budget.json');
const BASE = '/fit-strong-90/';
const MARGIN = 1.1;

const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const urls = [
  ...[...html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g)].map(m => m[1]),
  ...[...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)].map(m => m[1]),
];
const files = [...new Set(urls)].map(u => path.join(DIST, u.startsWith(BASE) ? u.slice(BASE.length) : u.replace(/^\//, '')));
if (files.length === 0) throw new Error('dist/index.html names no module script: run npm run build first');
const bytes = files.reduce((total, file) => total + zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length, 0);
const kib = n => `${(n / 1024).toFixed(1)} KiB`;

if (process.argv.includes('--record')) {
  const budget = { firstScreenGzipBytes: bytes, recordedOn: new Date().toISOString().slice(0, 10), files: files.length, margin: MARGIN };
  fs.writeFileSync(BUDGET, `${JSON.stringify(budget, null, 2)}\n`);
  console.log(`Recorded the first screen: ${kib(bytes)} gzipped, in ${files.length} files.`);
} else {
  const budget = JSON.parse(fs.readFileSync(BUDGET, 'utf8'));
  const limit = Math.round(budget.firstScreenGzipBytes * budget.margin);
  console.log(`The first screen: ${kib(bytes)} gzipped, in ${files.length} files. Budget ${kib(limit)}: ${kib(budget.firstScreenGzipBytes)} on ${budget.recordedOn}, plus 10%.`);
  if (bytes > limit) {
    console.error('Over the first screen’s budget (board D117).');
    process.exit(1);
  }
}
```

In `package.json`'s `scripts`, add `"perf:first-screen": "node scripts/perf/first-screen.mjs",`.

- [ ] **Step 6: Record the size Plans 1–7 left**

```bash
npm run build > /tmp/fit-checks/build-v2-p8-base.log 2>&1; tail -n 5 /tmp/fit-checks/build-v2-p8-base.log
npm run perf:first-screen -- --record
cat scripts/perf/budget.json
```

Expected: "Recorded the first screen: … KiB gzipped, in N files.", and `budget.json` holds that size and today's date.

- [ ] **Step 7: Append the decisions to the board.** Add the text below at the end of `docs/reimagine/BOARD.md`. Write the day it's added in the heading.

```markdown
### 2026-10-1x — [claude] v2 Plan 8 (Hardening): decisions recorded before building

From `docs/superpowers/plans/2026-10-10-fitstrong-v2-plan-8-hardening.md`, against journey §4.6, §17.2, §18, §20.4, §21 and §25 (B-04, B-05, B-11, B-19, B-21, B-22, B-26, B-27, B-30), audit A-05, and motion §7. D109 amends J§18.1, and the owner should confirm it.

| # | Decision | Reason |
| --- | --- | --- |
| D105 | The suite's large projects are 428×926, the reference iPhone's CSS size, in place of 430×932; the small ones stay 320×568. `--only` reads `V-J21`, `VJ21` and `V21` alike, since Plans 2, 3, 4, 6 and 7 named their journeys three ways, and a selector that matches no journey stops the run | J§2, A-60; §21.3 "at both sizes" |
| D106 | **Updates, the platform's own way.** A new release installs whole and waits, as every service worker does, until no window of FitStrong still runs the release in use: it applies the next time FitStrong opens. The worker never skips waiting by itself, and takes a page over by itself only as the very first release on a device, so no window is left uncontrolled for a later release to slip past (Codex P8S-11). Nothing in the app reloads by itself: no reload at a takeover, for a screen that didn't load, or when another copy holds the database. Home says "An update is ready. It applies the next time FitStrong opens." While nothing is under way in that window (no walk still to save or discard, no manual workout begun and not finished, no write still queued) and the waiting worker finds that window is FitStrong's only one, Home offers "Restart to update". The tap puts up "Restarting to update…" over an app made inert, lets in no new work, and only then asks the worker, which takes over, and the page reloads once; if the worker says no, the cover goes and nothing under it has changed (P8S-12, P8S-13). With another window open, Home says "Close FitStrong’s other windows to update now." The first Home after an update says "Updated. FitStrong is on its latest version." until it is dismissed, never on a timer | J§21.2, B-21, A-58; Kiro K8-02, K8-03, K8-10; Codex P8R-07, P8R-08, P8R-12, P8S-11 to P8S-13 |
| D107 | **Upgrades and migrations at the new release's start.** A data migration runs as the new release starts, which is only once no window of the old one is open, or at the restart of FitStrong's only window (D106), so nothing locks or defers it; each is transactional and idempotent, and one interrupted runs again at the next start. A copy that meets a database a newer copy has upgraded (`VersionError`), or is open when one upgrades it (`versionchange`, which closes v1's connection), saves nothing from then on, keeps what is on screen, and says "FitStrong is open somewhere else with a newer version. Close this window and open FitStrong again."; its Try again restarts onto a waiting release when it is the only window, and reloads otherwise. A newer copy whose upgrade waits behind an old connection (`blocked`) says "Close FitStrong’s other tabs" and carries on by itself once that connection closes. A schema newer than this build's stops this copy the same way: its migrations don't know that shape. A copy that loses its storage while it runs isn't a failed open: every screen stays, its typed answers and its guidance included, read-only: nothing more is written, a reading entered meanwhile still counts for every gate in that window, and no new walk, session or workout starts there. Only a first open that can't reach the records shows the storage screen (Codex P8S-04) | B-21; Codex P8R-09, P8R-17, P8S-04 |
| D108 | What a restore takes (B-26), listed in Me → Data → "What a backup can hold": 128 MB as a file and unpacked; readings 10,00,000; sessions, check-ins, body measurements, workout swaps and Learn progress entries, 1,00,000 each; personal records 10,000; walk routes 1,00,000; meals 2,00,000; usual meals and own foods 10,000 each; route points 50,00,000 in all; any one text 1,00,000 characters. Nesting deeper than 32 levels is refused too, in words of its own ("built in a way this app never writes"), and isn't listed: no file this app writes comes near it. They're checked in this order: the file's size, before it is read; its size unpacked; its texts and nesting, by one walk with a frame per level and no call stack, whose memory the file-size limit bounds (`JSON.parse` has already put the whole document in memory); a legacy backup's own counts, before it is converted, and the converted counts after; route points; and only then the records. A refusal names the limit and the file's own figure, and says "Nothing was changed." No backup is promised to fit: an export past a limit still holds every record, and says so plainly | B-26, J§18.3, A-56; Codex P8-16 (P8R-13 rejected, with its reason in the self-review); Kiro K8-11 |
| D109 | **Spec amendment, overriding J§18.1's `deleted.recent?: { at, store, record }[]` in the settings.** Recently deleted keeps one entry per deletion, with everything that belongs to it (a walk's records, the pain and energy recorded with it, its route and its journal), as one content-state row, `recent:<id>`, for 7 days, with no count limit. The settings document travels in every backup, and a deleted walk's route would ride in it. Entries, the restore lineage (`lineage:<old>`) and expiry's clock (`recent-clock`) are this device's own: a backup leaves them out, an import never brings them in, Merge keeps all three, and Replace clears Recently deleted's entries, the recovery payloads, with the records they describe, and keeps the lineage and the clock, this device's history (Codex P8S-08), so no file can change them. Expiry happens in one place: at every start, on every return to the app, and at the moment the next entry's 7 days end while the page runs; never while the clock reads earlier than the last time it ran. A clock set forward can end an entry early, which costs a convenience, never safety: a reading that holds can't be deleted (D119). Every restore checks, inside the transaction that commits it, that its entry is still within its 7 days, never from a plan made earlier (Codex P8S-09). `settings.deleted.recent` is never written; one that arrives (an older build kept a file's) is dropped at start, on import, on export and by "Erase all routes" | J§18.1, §20.4 rule 6, B-05; Codex P8R-04, P8R-14, P8S-08, P8S-09; Kiro K8-01 |
| D110 | A restore, from Undo or Recently deleted, writes fresh ids with `restoredFrom`, rewrites what the entry names inside itself, and drops the entry, in one transaction; the originals' deletion records stay. A walk comes back under a new walk id, every record recorded with it renamed and moved to it, its route rekeyed with `restoredFrom`; a session with everything recorded with it, as it was when deleted, a pain score corrected since included, and the session saying that same score, so nothing works the old one out again (Codex P8S-06); an own food under a new id, with every meal and usual meal that names it rewritten. Each renaming is kept as this device's lineage (`lineage:walk:<old>` → `walk:<new>`, and the same for `customFood:` and `session:`), which a merge reads a file's references through before it compares anything. A reading deleted on its own and restored later names its walk or session through the lineage, or stands alone when that is gone. A check-in's reading comes back into its check-in, and into the series under fresh row ids, a blood pressure's under a check-in event `checkInDayOf` reads as that day's (P8S-07): what was measured is its identity, apart from any row's id. Every statement carries `order`, the moment it was said, given as it is made, a correction included, and kept through every restore, backup and merge; two statements said at the same instant are ordered by it before any database's commit order, so a device holding the later of two never takes the earlier, restored elsewhere, for the later (Codex P8R-06). Statements from before this release have none, and their commit order decides between them, as it always has (`order.test.ts`'s J05 file). A correction made on another device to a record deleted and restored here stays with the original, whose deletion record keeps it out | B-05; Codex P8R-03, P8R-05, P8R-06, P8S-06, P8S-07 |
| D111 | Every kind of record a person adds can be removed at once, with Undo, and waits in Recently deleted: readings and day totals, blood pressure readings, a check-in's readings and pain scores, sessions and manual workouts (their personal records worked out again either way), walks with everything recorded with them, meals, usual meals and own foods. Me → Food → "Your own foods" (new) lists the own foods, each with Edit and Delete: an edit is a new version of the food's definition (a new `updatedAt`), and each meal item keeps its own snapshot of the food as it was logged, with the version it was (Plan 7's fix, board D134), so only meals logged afterwards take it. A reading that holds movement is refused instead (D119), never deleted behind a confirmation. Three deletions aren't routine, and keep their confirmation: deleting one walk's route is B-05's permanent erase of its coordinates, so a route only ever comes back with its walk; "Discard walk" ends a walk before it is saved; "Delete all data" erases everything. A check-in itself has no delete: it's corrected by answering again | B-04, J§20.4 rule 6, A-05; Kiro K7-11 |
| D112 | V-J32's "with its deletion record removed" is superseded by B-05 (§25 overrides earlier text): the record returns under a fresh id, and the original's deletion record stays | §25 |
| D113 | An Undo belongs to the screen it was offered on (Today's log is one screen, whichever day it shows) and to the record details opened from that screen, or from one of those, as router state (`useOrigin`'s origin) or the navigation stack records it, so it stands while another detail is opened from there and closed again (H7-15). Any other place ends it, a tab switch included, and a tab that later reopens a detail doesn't bring it back. Any change the store commits ends every Undo, except a delete (which stacks), a restore (which keeps the other), and background writes (expiry, reading progress, the walk's journal). What an Undo's tap did is said in its own toast, in place, until it is closed or its screen is left: "… restored"; "… It wasn’t restored." with the reason and Undo again beside it; or, for a check-in reading with nothing to put back, "Already back in your check-in." or "Your newer answer stays.". Nothing is said on a timer, and nothing that went right is called a failure. Plan 7's food Undo moves to `src/components/hig/undo.ts`, one stack for every kind | B-04, M19; Codex H7-15; Kiro K8-03, K8-06 |
| D114 | Food's trend exists only while estimates are on (`numbersView().show`). It's a stated measure: a day with meals logged has its estimate, and any other day says "Not logged". "Estimated" comes before every figure and "in logged foods" after it; partial days are named; kcal is rounded to the nearest 10; carbs are a range with insulin, a sulfonylurea or a meglitinide (K-22). There's no comparison with another period, no target and no "highest day". Without estimates, `/trends/food` opens the Food hub (D74 kept) and Trends lists no Food row | J§11.4–11.5, B-11, K-22 |
| D115 | Browse lists the food table's matches (Plan 7's `searchFoods`), at most 6, under Eat after the categories and meal ideas. Each opens "Log a meal" at that food's portion page, and counts-free shows no figure | J§14, B-11 |
| D116 | After the twelve weeks, no session is planned. Home's Right now, the Workout tile and its hub say "The 12 weeks are done", and "Choose what’s next" opens Your plan's two choices, under "What next?": "Start the 12 weeks again" (week 1 from today, on the same training days) or "Leave the programme". Stretch and Walk are unchanged. Week 12's own sessions stay through its last day. Whether a guided session may open is decided once, when it opens: after week 12 only progress saved part-way and still resumable (`loadProgress`) opens one, and a run already under way when the programme ends at midnight stays until it is saved or discarded | J§17.2 #42; Kiro K8-05 |
| D117 | The performance budget's automated parts run in the suite and the build: at most two blurred surfaces at once, each a bar or a sheet's header and none larger than a fifth of the screen; at most one animated shared element in a view transition, beyond the page and the stationary navigation snapshots (`app-nav`, `app-header`, B-27), so a route thumbnail carries its name only while its walk opens; the live route redrawn at most once in any second (its busiest second, timed while five fixes it accepts move it in half a second, and shown to fail with the route's throttle taken out); the 3D demo's own drawing stopping while the app is hidden and while the demo is off screen; and the first screen's JavaScript within 10% of the size recorded at the start of Plan 8 (`npm run perf:first-screen`). The journey `PERF01` checks the first four. Frames, Low Power Mode and a warm phone are on the device checklist | motion §7, B-27; Codex P8R-15 |
| D118 | Journeys another plan already proves stay there: V-J25's plan-shift accept and decline (J07 steps 5–6), and V-J38's storage-full log (J17 steps 1–2, and V-J03's refused save). V-J25 proves there's no Carry on while Away or Unwell (B-30's variant), and V-J38 proves the update, upgrade and migration rules | the coordinator's brief |
| D119 | **A change never lifts a hold.** Every change that takes away or alters a clinical measurement (a glucose or blood pressure reading, Track's or a check-in's, a half-entered blood pressure, a ketone result), or removes a check-in, is asked of the engine before it is shown or written, whichever caller asks for it, the store's own `update` included (Codex P8S-03). The measurements it takes away are named the engine's own way, and the engine is asked before and after, against what is stored: every mode's permission now, and the day's answer today and tomorrow. If the change would let any mode do more, or stop the engine asking about a serious reading, it is refused with "This reading is keeping movement on hold, so it can’t be changed or removed yet. If it was typed wrongly, choose ‘It was a mistake’.", and nothing is written, unless each measurement it takes away has been answered as typed wrongly, by the engine's own reading of the answers. "It was a mistake" answers exactly those measurements, never one that only stops being asked about once its partner goes (P8S-01), in today's check-in, as v1's check-in sheet does; the change then goes through, and the answer stays with the reading's history. A correction the hold allows keeps what it replaced on the record it corrected: the earlier value, its time and when it was corrected (P8S-05). While the phone's clock change holds the device (Plan 6's `settings.walk.clock`, board D174), every such change is refused: "Your phone’s clock changed, so FitStrong can’t be sure when your readings were taken. For now, readings can’t be changed or removed. You can still add a new one." (P8S-02). A refusal with no measurement to answer, such as a check-in removed for its answers alone, says the engine's own release in place of the second sentence. Once the engine has released a reading by its own rule, the same change goes through. Adding a reading is never refused (a re-check is how the engine releases), nor is "Delete all data". Every gate reads the record as it always has: nothing is kept on the side, and imports keep this device's open incidents (Plan 6's H6-03). The engine alone decides | J§4.6, A-05; Codex P8-01, P8R-01, P8R-02, P8S-01 to P8S-03, P8S-05; Kiro K8-07, K8-08 |
| D120 | **Each release is one thing.** Every file it caches is named by its bytes (Vite's own names, the 3D models and the icons included) or, for its own copy of index.html, by the release (`shell-<stamp>.html`), and fetched past the HTTP cache, so no cached URL can hold another release's bytes, however a deploy moves on under a slow install (Codex P8S-15). Its stamp is a hash of every byte it ships and of the worker's code; its cache is `fitstrong-<number>-<stamp>`, the number higher for every later release. It is installed whole or not at all: a failed install deletes the cache it began, and leaves the release in use as it was. A window is served from its own release only: a navigation gets that release's shell, cache first, online or not, and every other file comes from that release's cache. Nothing is written at run time but the voice clips. Activation deletes only the caches of releases numbered lower, and v1's, never one installing or waiting behind it (P8S-14); it comes once no window runs the release before it (D106), or at the restart of its only window. The first release with this worker replaces v1's, whose own worker keeps serving the windows already open on it until they close | J§21.2, A-58; Codex P8R-10, P8R-11, P8S-14, P8S-15 |
| D121 | **Real releases, and a strict run.** A build made with `VITE_ACCEPTANCE_SUCCESSOR=1` is the suite's next release: its database and schema versions are one higher, with an empty migration, and nothing else reads the variable. The suite serves two such releases at one origin with their workers allowed, numbered 100 and 200 (`FITSTRONG_RELEASE_NUMBER`), and a later copy of the first whose install fails. `npm run e2e:acceptance -- --strict` is the release run: it fails on a pending case, and on any journey's case that hasn't passed in all four projects; a case that declares its projects (PERF01, large light) is held to those. `node scripts/journeys-inventory.mjs` fails when a J or V journey is missing or claimed twice | B-21, B-22 |
| D122 | **J§20.4 rule 1, measured.** Every control a finger can reach is at least 48 × 48 CSS px, in rem so it grows with the text, a checkbox or radio measured by its label; a main target (a control filled with the tint or the shared `Button`'s primary fill that isn't a choice, and those marked `data-main`: I feel low, I need to stop, a toast's Undo and Close, Restore, Your plan's choices after week 12, Restart to update) is at least 60 px tall; bezelled controls (a background, border or shadow of their own) are at least 12 px apart; no two controls overlap unless the inner one is marked `data-embedded` by the control it sits in; a control's words fit it; every screen has one main landmark and one level-1 heading, and every open sheet or menu a heading of its own. Excused, and nothing else: a link inside running text; the segments of one segmented control; a control marked as drawn inside another; a control that can't be tapped now. The journey S02 holds S01's inventory, the screens a task runs on and Plan 8's own screens to it, at 100% and 200% text, and fails on any finding; every journey's sweep keeps reporting the 44 px floor. Track's shared `Segmented` is Plan 3's (H3-19) | J§20.4 rule 1, L-16; Codex P8R-16; Kiro K8-04; Plan 6's open items |

The first screen's JavaScript, as Plans 1–7 left it, is in `scripts/perf/budget.json`.
```

- [ ] **Step 8: Commit**

```bash
git add scripts/perf/first-screen.mjs scripts/perf/budget.json scripts/e2e/acceptance/lib/ids.mjs scripts/e2e/acceptance/run.mjs package.json docs/reimagine/BOARD.md
git commit -m "docs: Record the Plan 8 decisions, read every journey id form, and keep the first screen's starting size"
```

---

### Task 2: An update installs whole and waits for FitStrong's windows to close, the platform's own way, and Home says so

**Files:**
- Modify: `public/sw.js` (installs whole, past the HTTP cache, and waits; the first release on a device takes its page over; answers `windows` and `restart`; navigations from its own release's shell; only older releases' caches go at activation)
- Modify: `vite.config.ts` (the precache list is every file the build names by its bytes, and the release's own shell; the stamp hashes every byte; every release a number higher than the last)
- Move: `public/models/coach-female.bin` and `coach-male.bin` to `src/assets/models/`, `public/favicon.svg` and `public/apple-touch-icon.png` to `src/assets/`; Modify: `index.html` (the two icons through the build); Create: `src/motion/models.ts`; Modify: `src/components/motion/MotionView.tsx`, `src/motion/lab.ts`, `scripts/character/build.mjs`, `scripts/motion/probe.ts`, `src/motion/clips/clips.node.test.ts`, `src/components/hig/shell.node.test.ts` (the files' new places)
- Create: `src/app/release.ts`, `src/app/release.test.ts`, `src/app/sw.node.test.ts`
- Create: `src/app/updates.ts`, `src/app/updates.test.ts`, `src/app/underWay.ts`, `src/app/RestartCover.tsx`, `src/app/restart.callers.test.ts`
- Create: `src/screens/workout/underWay.ts`; Modify: `src/screens/workout/useWorkout.ts` (a manual workout says when it is under way)
- Modify: `src/store/useStore.ts` (`holdNewWork`, `whenSettled`)
- Create: `src/screens/home/UpdateRow.tsx`; Modify: `src/screens/home/HomeScreen.tsx` (the row)
- Modify: `src/main.tsx` (starts the updates; the automatic reload on `vite:preloadError` goes); `src/App.tsx` (the restart's cover, over an app made inert)
- Modify: `src/components/hig/ErrorBoundary.tsx` ("Your saved records are safe."; "Back to your walk"); Create: `src/components/hig/ErrorBoundary.test.ts`

**Interfaces:**
- Consumes: `peekWalk(): WalkPeek | null` and its `href` (`src/walk/persist.ts`, v1's); `useStore().saving`, `getState()` (`src/store/useStore.ts`); the manual workout's in-memory state (`memory.live` in `src/screens/workout/useWorkout.ts`, Plan 5's); `Group`, `Row` (`src/components/hig/List.tsx`); `render` (`@/test/host`).
- Produces:
  - `public/sw.js`: a worker that never calls `skipWaiting()` by itself, and calls `clients.claim()` only as the very first release on a device, when no release cache came before it (Codex P8S-11). Its cache is `fitstrong-<number>-<stamp>`; activation deletes only caches of a lower number, and v1's, never one installing or waiting behind it (P8S-14). A page's `{ type: 'windows' }` or `{ type: 'restart' }`, sent with a `MessagePort`, is answered on it with `{ build, windows, restarting }`; `restart` makes a waiting worker take over only while the asking window is FitStrong's only one. Task 12's driven worker, `lib/releases.mjs` and V-J38 rely on all of it;
  - `src/app/release.ts`: `releaseFiles(files)`, `releaseStamp(read, files, worker): Promise<string>`;
  - `src/app/updates.ts`: `WorkerLike`, `InstallingLike`, `RegistrationLike`, `ContainerLike`, `WorkerAnswer`, `UpdateState`, `UpdateDeps` (with `underWay`, `hold` and `settled`), `UpdateLine`; `BUILD_KEY`, `UPDATE_READY`, `CLOSE_OTHERS`, `RESTART`, `RESTARTING = 'Restarting to update…'`, `UPDATED`, `DISMISS`, `TAKEOVER_MS`; `startUpdates(deps)`, `countWindows()`, `restartToUpdate(): Promise<'restarting' | 'others' | 'busy' | 'none'>`, `dismissUpdated()`, `updateState()`, `subscribeUpdates(listener)`, `useUpdates()`, `updateLine(state, underWay)`, `resetUpdatesForTests()`;
  - `src/app/underWay.ts`: `underWay(): boolean`; `src/screens/workout/underWay.ts`: `workoutUnderWay()`, `noteWorkout(underWay)`;
  - `useStore.ts`: `holdNewWork(): () => void`, `whenSettled(): Promise<void>`, `RESTARTING_REFUSAL`;
  - `RestartCover()` (`src/app/RestartCover.tsx`); `UpdateRow()` (`src/screens/home/UpdateRow.tsx`);
  - `MODEL_URL` (`src/motion/models.ts`);
  - `<html data-build="…">`: the stamp of the release this page runs, once its worker has answered (V-J38 reads it);
  - `Fallback` exported from `ErrorBoundary.tsx`, `({ onRetry?, download? })`.

**The platform does the waiting** (D106, D120; Codex P8R-07 to P8R-12, P8S-11 to P8S-15, P8S-17; Kiro K8-02, K8-03, K8-09, K8-10). A service worker that never skips waiting already does what J§21.2 asks: a new release installs beside the one in use and waits until no window still runs that one, so nothing is replaced under a walk, a session or a sheet in any window, hidden ones included, with no lock, no busy protocol and no reload of any kind. Waiting counts only the windows a release controls, so the very first release on a device takes over the page it was installed from: no window is ever left uncontrolled for a later release to slip past (P8S-11). The worker serves every window from its own release only, its own copy of index.html included, and every file it caches is named by its bytes and fetched past the HTTP cache, so a release's cache can never hold another release's bytes, however a deploy moves on under a slow install (P8S-15). An old release's cache goes only when a later-numbered release activates, which happens only once no window still runs it; a release installing or waiting behind it is never touched (P8S-14). The one way to apply an update sooner is the person's own "Restart to update" on Home: offered while nothing is under way in that window (a walk, a manual workout, a write still queued; P8S-12), and only when the waiting worker finds that window is FitStrong's only one. The tap first puts up "Restarting to update…" over the whole app, inert beneath it, and lets in no new work; then it asks the worker, which takes over, and the page reloads once. If the worker says no, the cover goes and nothing under it has changed (P8S-13). A data migration needs nothing more: it runs as the new release starts, and the new release starts only when no window of the old one is left (Task 3).

- [ ] **Step 1: Write the failing release tests** `src/app/release.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { releaseFiles, releaseStamp } from './release';

const enc = (s: string) => new TextEncoder().encode(s);
/** What Vite emits: every file under a name that changes with its bytes, but index.html; and the worker, copied from public/. */
const BUNDLE = [
  'index.html', 'assets/index-a1b2c3d4.js', 'assets/index-a1b2c3d4.js.map', 'assets/index-e5f6a7b8.css',
  'assets/coach-female-0f1e2d3c.bin', 'assets/apple-touch-icon-4b5a6978.png', 'assets/favicon-9a8b7c6d.svg', 'sw.js',
];

function stamp(over: Record<string, string> = {}, worker = 'worker code') {
  const bytes: Record<string, string> = {
    'index.html': '<html>A</html>', 'assets/index-a1b2c3d4.js': 'console.log(1)', 'assets/index-e5f6a7b8.css': 'body{}',
    'assets/coach-female-0f1e2d3c.bin': 'BIN-A', 'assets/apple-touch-icon-4b5a6978.png': 'PNG', 'assets/favicon-9a8b7c6d.svg': '<svg/>', ...over,
  };
  return releaseStamp(f => enc(bytes[f]), [...releaseFiles(BUNDLE), 'index.html'], worker);
}

describe('one release, one stamp (J§21.2, D120)', () => {
  it('is Vite’s own files once, sorted, each named by its bytes: never index.html’s fixed name, a source map or the worker (P8S-15)', () => {
    expect(releaseFiles([...BUNDLE, 'assets/index-a1b2c3d4.js'])).toEqual([
      'assets/apple-touch-icon-4b5a6978.png', 'assets/coach-female-0f1e2d3c.bin', 'assets/favicon-9a8b7c6d.svg', 'assets/index-a1b2c3d4.js', 'assets/index-e5f6a7b8.css',
    ]);
  });

  it('is the same for the same files, in any order', async () => {
    expect(await stamp()).toMatch(/^[0-9a-f]{12}$/);
    expect(await stamp()).toBe(await stamp());
    const list = releaseFiles(BUNDLE);
    expect(await releaseStamp(enc, [...list].reverse(), 'w')).toBe(await releaseStamp(enc, list, 'w'));
  });

  it('changes with any file’s bytes, index.html’s and the worker’s included (P8-07)', async () => {
    const base = await stamp();
    expect(await stamp({ 'assets/coach-female-0f1e2d3c.bin': 'BIN-B' })).not.toBe(base);
    expect(await stamp({ 'index.html': '<html>B</html>' })).not.toBe(base);
    expect(await stamp({ 'assets/apple-touch-icon-4b5a6978.png': 'PNG2' })).not.toBe(base);
    expect(await stamp({}, 'worker code, changed')).not.toBe(base);
  });
});
```

- [ ] **Step 2: Write the failing worker tests** `src/app/sw.node.test.ts`: `public/sw.js` itself, run as a browser runs a worker, over a stand-in network, HTTP cache and Cache API.

```ts
import fs from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const ORIGIN = 'https://example.test';
const BASE = '/fit-strong-90/';
const pathOf = (r: { url: string } | string) => (typeof r === 'string' ? new URL(r, ORIGIN).pathname : new URL(r.url).pathname);
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

/** A release's files, as the build names them (P8S-15): each under a name that changes with its bytes, its own copy of index.html among them. */
function filesOf(build: string) {
  const tag = build.slice(0, 8);
  const names = {
    shell: `${BASE}shell-${build}.html`, main: `${BASE}assets/index-${tag}.js`, lazy: `${BASE}assets/WalkSummary-${tag}.js`,
    model: `${BASE}assets/coach-female-${tag}.bin`, icon: `${BASE}assets/apple-touch-icon-${tag}.png`,
  };
  const list = Object.values(names);
  return { names, list, bodies: new Map(list.map(u => [u, `${build} ${u}`] as const)) };
}
type Files = ReturnType<typeof filesOf>;

/** A same-origin response as a browser hands one to its worker: of type `basic`, which `new Response` in Node is not (P8S-17). */
const basic = (body: string, status = 200): Response => Object.defineProperty(new Response(body, { status }), 'type', { value: 'basic' });

/** The server: what it holds now, whether the phone can reach it, the HTTP cache in front of it, and a slow line a request can wait on. */
function network(files: Map<string, string>) {
  const net = {
    online: true,
    files,
    /** What the browser's HTTP cache still holds, by URL: handed back unless a request goes past it. */
    http: new Map<string, string>(),
    /** Every request: its path, and what it asked of the HTTP cache. */
    asked: [] as { path: string; cache?: string }[],
    holding: false,
    waiting: [] as (() => void)[],
    release() {
      net.holding = false;
      for (const go of net.waiting.splice(0)) go();
    },
    async fetch(r: { url: string; cache?: string } | string): Promise<Response> {
      const path = pathOf(r);
      const cache = typeof r === 'string' ? undefined : r.cache;
      net.asked.push({ path, ...(cache ? { cache } : {}) });
      if (net.holding) await new Promise<void>(resolve => net.waiting.push(resolve));
      if (!net.online) throw new TypeError('offline');
      const body = (cache === 'reload' ? undefined : net.http.get(path)) ?? net.files.get(path);
      return body === undefined ? basic('missing', 404) : basic(body);
    },
  };
  return net;
}
type Net = ReturnType<typeof network>;

/** One origin's Cache API: named caches; `addAll` stores every file or none, as the real one does; a cache deleted under an open handle is that handle's alone. */
function cacheStorage(net: Net) {
  const stores = new Map<string, Map<string, string>>();
  const cache = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const rows = stores.get(name)!;
    return {
      async addAll(requests: ({ url: string; cache?: string } | string)[]) {
        const got: [string, string][] = [];
        for (const r of requests) {
          const res = await net.fetch(r);
          if (!res.ok) throw new TypeError(`${pathOf(r)}: ${res.status}`);
          got.push([pathOf(r), await res.text()]);
        }
        for (const [u, body] of got) rows.set(u, body);
      },
      async put(r: { url: string } | string, res: Response) { rows.set(pathOf(r), await res.text()); },
      async match(r: { url: string } | string) { const body = rows.get(pathOf(r)); return body === undefined ? undefined : new Response(body); },
      async keys() { return [...rows.keys()].map(u => ({ url: ORIGIN + u })); },
    };
  };
  return {
    stores,
    caches: {
      open: async (name: string) => cache(name),
      keys: async () => [...stores.keys()],
      delete: async (name: string) => stores.delete(name),
    },
  };
}
type Store = ReturnType<typeof cacheStorage>;

const SOURCE = fs.readFileSync('public/sw.js', 'utf8');
type Window = { id: string; url: string };
const app = (id: string): Window => ({ id, url: `${ORIGIN}${BASE}#/home` });

/** public/sw.js as one release, numbered `number`: the test fires its events, as a browser does, and counts what it asked for. */
function release(build: string, number: number, files: Files, net: Net, store: Store, windows: Window[] = []) {
  const listeners = new Map<string, (event: unknown) => void>();
  const calls = { skipWaiting: 0, claim: 0 };
  const self = {
    location: new URL(`${ORIGIN}${BASE}sw.js`),
    addEventListener: (type: string, fn: (event: unknown) => void) => void listeners.set(type, fn),
    skipWaiting: () => { calls.skipWaiting += 1; return Promise.resolve(); },
    clients: {
      claim: () => { calls.claim += 1; return Promise.resolve(); },
      matchAll: async () => [...windows],
    },
  };
  const code = SOURCE.replace('[/* __PRECACHE__ */]', JSON.stringify(files.list))
    .replace("'__BUILD__'", JSON.stringify(build)).replace("'__NUMBER__'", JSON.stringify(String(number)));
  vm.runInNewContext(code, { self, caches: store.caches, fetch: (r: { url: string } | string) => net.fetch(r), URL, Request, Response, Headers });
  const fire = async (type: 'install' | 'activate' | 'message', extra: object = {}) => {
    const waits: Promise<unknown>[] = [];
    listeners.get(type)?.({ waitUntil: (p: Promise<unknown>) => void waits.push(p), ...extra });
    await Promise.all(waits);
  };
  /** A page's question, on a port of its own: the answer, or undefined when there is none. */
  const ask = async (type: string, from: Window) => {
    const answers: unknown[] = [];
    await fire('message', { data: { type }, source: from, ports: [{ postMessage: (m: unknown) => void answers.push(m) }] });
    return answers[0];
  };
  /** A request through the worker: its answer's body, or 'error'. */
  const get = async (path: string, mode: 'navigate' | 'no-cors' = 'no-cors') => {
    let answer: Promise<Response> | undefined;
    const waits: Promise<unknown>[] = [];
    const request = { url: ORIGIN + path, method: 'GET', mode, headers: new Headers() };
    listeners.get('fetch')?.({ request, respondWith: (p: Promise<Response>) => { answer = p; }, waitUntil: (p: Promise<unknown>) => void waits.push(p) });
    if (!answer) return undefined;
    const res = await answer.catch(() => Response.error());
    await Promise.all(waits);
    return res.type === 'error' ? 'error' : res.text();
  };
  return { calls, fire, ask, get, cache: `fitstrong-${number}-${build}`, windows };
}

/** Release `build`, numbered `number`, deployed, installed and active. */
async function active(build: string, number: number, net: Net, store: Store, windows: Window[] = []) {
  const files = filesOf(build);
  net.files = files.bodies;
  const r = release(build, number, files, net, store, windows);
  await r.fire('install');
  await r.fire('activate');
  return { ...r, files };
}

describe('the worker waits, and takes a page over by itself only as the first release on a device (J§21.2, D106, P8S-11)', () => {
  it('the first release takes over the page it was installed from; every later one waits; none skips waiting', async () => {
    const net = network(new Map());
    const store = cacheStorage(net);
    const a = await active('aaaaaaaaaaaa', 100, net, store);
    expect(a.calls).toEqual({ skipWaiting: 0, claim: 1 });
    const b = await active('bbbbbbbbbbbb', 200, net, store);
    expect(b.calls).toEqual({ skipWaiting: 0, claim: 0 });
  });

  it('on a device v1’s worker served, the first of these releases takes nothing over', async () => {
    const net = network(new Map());
    const store = cacheStorage(net);
    await (await store.caches.open('fitstrong90-app-0123456789ab')).put(`${BASE}index.html`, basic('v1'));
    const a = await active('aaaaaaaaaaaa', 100, net, store);
    expect(a.calls.claim).toBe(0);
  });

  it('says its release and FitStrong’s windows, and takes over at a restart only from FitStrong’s only window', async () => {
    const one = app('w1');
    const net = network(new Map());
    const store = cacheStorage(net);
    await active('aaaaaaaaaaaa', 100, net, store);
    const files = filesOf('bbbbbbbbbbbb');
    net.files = files.bodies;
    const b = release('bbbbbbbbbbbb', 200, files, net, store, [one]);
    await b.fire('install');
    expect(await b.ask('windows', one)).toEqual({ build: 'bbbbbbbbbbbb', windows: 1, restarting: false });
    expect(b.calls.skipWaiting).toBe(0);
    // A second window of FitStrong: no takeover, and the count says why.
    b.windows.push(app('w2'));
    expect(await b.ask('restart', one)).toEqual({ build: 'bbbbbbbbbbbb', windows: 2, restarting: false });
    expect(b.calls.skipWaiting).toBe(0);
    // Another site on the same origin isn't FitStrong's.
    b.windows.splice(1, 1, { id: 'w3', url: `${ORIGIN}/another-site/` });
    expect(await b.ask('restart', one)).toEqual({ build: 'bbbbbbbbbbbb', windows: 1, restarting: true });
    expect(b.calls.skipWaiting).toBe(1);
    // Nothing else moves it.
    await b.fire('message', { data: { type: 'activate' }, source: one, ports: [] });
    await b.fire('message', { data: null, source: one, ports: [] });
    expect(b.calls.skipWaiting).toBe(1);
  });
});

describe('each release is whole, named by its bytes, and its windows’ own (J§21.2, D120, P8R-10, P8R-11, P8S-14, P8S-15)', () => {
  it('answers a navigation with its own copy of index.html, online, though the server now has a newer one', async () => {
    const net = network(new Map());
    const a = await active('aaaaaaaaaaaa', 100, net, cacheStorage(net));
    net.files = filesOf('bbbbbbbbbbbb').bodies;
    expect(await a.get(`${BASE}#/home`, 'navigate')).toBe(`aaaaaaaaaaaa ${a.files.names.shell}`);
    expect(await a.get(`${BASE}?from=home`, 'navigate')).toBe(`aaaaaaaaaaaa ${a.files.names.shell}`);
  });

  it('keeps every file of its own release, a model and a screen not yet loaded included, after a newer one installs, offline too', async () => {
    const net = network(new Map());
    const store = cacheStorage(net);
    const a = await active('aaaaaaaaaaaa', 100, net, store);
    const files = filesOf('bbbbbbbbbbbb');
    net.files = files.bodies;
    const b = release('bbbbbbbbbbbb', 200, files, net, store);
    await b.fire('install');
    expect([...store.stores.keys()].sort()).toEqual([a.cache, b.cache].sort());
    net.online = false;
    expect(await a.get(a.files.names.model)).toBe(`aaaaaaaaaaaa ${a.files.names.model}`);
    expect(await a.get(a.files.names.lazy)).toBe(`aaaaaaaaaaaa ${a.files.names.lazy}`);
    expect(await a.get(BASE, 'navigate')).toBe(`aaaaaaaaaaaa ${a.files.names.shell}`);
    // The waiting release answers with its own, for the window it will run.
    expect(await b.get(BASE, 'navigate')).toBe(`bbbbbbbbbbbb ${files.names.shell}`);
  });

  it('fetches every file past the HTTP cache, so a stale copy there never becomes part of a release (P8S-15)', async () => {
    const net = network(new Map());
    const store = cacheStorage(net);
    await active('aaaaaaaaaaaa', 100, net, store);
    const files = filesOf('bbbbbbbbbbbb');
    net.files = files.bodies;
    // The browser's HTTP cache still holds another copy under the model's name.
    net.http.set(files.names.model, 'stale model');
    const b = release('bbbbbbbbbbbb', 200, files, net, store);
    await b.fire('install');
    expect(net.asked.filter(r => files.list.includes(r.path)).every(r => r.cache === 'reload')).toBe(true);
    net.online = false;
    expect(await b.get(files.names.model)).toBe(`bbbbbbbbbbbb ${files.names.model}`);
  });

  it('refuses an install the deploy moved on under, deletes its cache, and leaves the release in use as it was, offline too (P8S-15)', async () => {
    const net = network(new Map());
    const store = cacheStorage(net);
    const a = await active('aaaaaaaaaaaa', 100, net, store);
    const files = filesOf('bbbbbbbbbbbb');
    net.files = files.bodies;
    net.holding = true;
    const b = release('bbbbbbbbbbbb', 200, files, net, store);
    const installing = b.fire('install');
    await settle();
    // The site moves on to the next deploy while B's install waits on the line: B's files are gone from it.
    net.files = filesOf('cccccccccccc').bodies;
    net.release();
    await expect(installing).rejects.toThrow(/404/);
    expect([...store.stores.keys()]).toEqual([a.cache]);
    net.online = false;
    expect(await a.get(a.files.names.lazy)).toBe(`aaaaaaaaaaaa ${a.files.names.lazy}`);
    expect(await a.get(BASE, 'navigate')).toBe(`aaaaaaaaaaaa ${a.files.names.shell}`);
  });

  it('lets only the releases before it go at its activation, never one installing after it, which then activates and serves offline (P8S-14)', async () => {
    const one = app('w1');
    const net = network(new Map());
    const store = cacheStorage(net);
    const a = await active('aaaaaaaaaaaa', 100, net, store);
    const bFiles = filesOf('bbbbbbbbbbbb');
    net.files = bFiles.bodies;
    const b = release('bbbbbbbbbbbb', 200, bFiles, net, store, [one]);
    await b.fire('install');
    // C deployed, its install slow on the line, while B waits.
    const cFiles = filesOf('cccccccccccc');
    net.files = cFiles.bodies;
    net.holding = true;
    const c = release('cccccccccccc', 300, cFiles, net, store, [one]);
    const installing = c.fire('install');
    await settle();
    // FitStrong's only window restarts onto B: B activates, and only A, before it, goes.
    expect(await b.ask('restart', one)).toMatchObject({ restarting: true });
    await b.fire('activate');
    expect([...store.stores.keys()].sort()).toEqual([b.cache, c.cache].sort());
    net.release();
    await installing;
    await c.fire('activate');
    expect([...store.stores.keys()]).toEqual([c.cache]);
    net.online = false;
    expect(await c.get(cFiles.names.lazy)).toBe(`cccccccccccc ${cFiles.names.lazy}`);
    expect(await c.get(BASE, 'navigate')).toBe(`cccccccccccc ${cFiles.names.shell}`);
  });

  it('lets v1’s caches go at its activation, and keeps the voice clips', async () => {
    const net = network(new Map());
    const store = cacheStorage(net);
    await (await store.caches.open('fitstrong90-app-0123456789ab')).put(`${BASE}voice/en/old.mp3`, basic('old clip'));
    await (await store.caches.open('fitstrong90-voice')).put(`${BASE}voice/en/hello.mp3`, basic('clip'));
    const a = await active('aaaaaaaaaaaa', 100, net, store);
    expect([...store.stores.keys()].sort()).toEqual([a.cache, 'fitstrong90-voice'].sort());
    expect([...store.stores.get('fitstrong90-voice')!.keys()].sort()).toEqual([`${BASE}voice/en/hello.mp3`, `${BASE}voice/en/old.mp3`]);
  });

  it('writes nothing at run time but the voice clips, which a real same-origin response lets it keep (P8S-17)', async () => {
    const net = network(new Map());
    const store = cacheStorage(net);
    const a = await active('aaaaaaaaaaaa', 100, net, store);
    net.files.set(`${BASE}assets/not-in-the-release.js`, 'stray');
    net.files.set(`${BASE}voice/en/hello.mp3`, 'clip');
    expect(await a.get(`${BASE}assets/not-in-the-release.js`)).toBe('stray');
    expect(await a.get(`${BASE}voice/en/hello.mp3`)).toBe('clip');
    await settle();
    expect([...store.stores.get(a.cache)!.keys()].sort()).toEqual([...a.files.list].sort());
    expect([...store.stores.get('fitstrong90-voice')!.keys()]).toEqual([`${BASE}voice/en/hello.mp3`]);
  });
});
```

Run: `npx vitest run src/app/release.test.ts src/app/sw.node.test.ts`
Expected: FAIL. `./release` doesn't exist; the worker skips waiting at install and claims at every activation, answers no question, fetches navigations from the network, goes to the HTTP cache, leaves an empty cache when an install fails, and deletes every other app cache at activation.

- [ ] **Step 3: Write** `src/app/release.ts`

```ts
/**
 * What one release is made of (J§21.2, board D120), and its stamp. Every
 * file the build emits is named by its bytes, the 3D models and the icons
 * included, so a precached URL can never answer with another release's
 * bytes (P8S-15); index.html, the one fixed name, is copied to the release's
 * own `shell-<stamp>.html` by the build. The stamp still hashes every byte,
 * index.html's and the worker's code included, so any change at all is a new
 * release with a cache of its own (P8-07). Pure: the build reads the files and
 * hands them in.
 */

/** The release's files, once and sorted: what Vite emits, each named by its bytes; never index.html, a source map, or the worker itself. */
export function releaseFiles(files: readonly string[]): string[] {
  return [...new Set(files.filter(f => !f.endsWith('.map') && f !== 'sw.js' && f !== 'index.html'))].sort();
}

/** The release's stamp: 12 hex digits of SHA-256 over every file's name and bytes, then the worker's code. */
export async function releaseStamp(read: (file: string) => Uint8Array, files: readonly string[], worker: string): Promise<string> {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  for (const file of [...files].sort()) parts.push(encoder.encode(`${file}\u0000`), read(file), encoder.encode('\u0000'));
  parts.push(encoder.encode(worker));
  const all = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.byteLength;
  }
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', all));
  return [...digest.slice(0, 6)].map(b => b.toString(16).padStart(2, '0')).join('');
}
```

In `vite.config.ts`, add `import { releaseFiles, releaseStamp } from './src/app/release'` and replace `precacheList` with:

```ts
/**
 * Fill the service worker's precache list with every file of the release
 * (board D120): what Vite emits, each under a name that changes with its
 * bytes, the 3D models and the icons included, and this release's own copy
 * of index.html, `shell-<stamp>.html`, under a name no other release has, so
 * no precached URL ever answers with another release's bytes (P8S-15). The
 * stamp is every byte the release ships; the number is its place in order,
 * higher than every release before it (P8S-14).
 */
const precacheList = (base: string): Plugin => ({
  name: 'precache-list',
  apply: 'build',
  async writeBundle(options, bundle) {
    const dir = options.dir ?? 'dist';
    const files = releaseFiles(Object.keys(bundle));
    const sw = path.join(dir, 'sw.js');
    const src = fs.readFileSync(sw, 'utf8');
    for (const mark of ['[/* __PRECACHE__ */]', "'__BUILD__'", "'__NUMBER__'"]) {
      if (!src.includes(mark)) throw new Error(`sw.js is missing ${mark}`);
    }
    const build = await releaseStamp(f => new Uint8Array(fs.readFileSync(path.join(dir, f))), [...files, 'index.html'], src);
    const shell = `shell-${build}.html`;
    fs.copyFileSync(path.join(dir, 'index.html'), path.join(dir, shell));
    const number = Number(process.env.FITSTRONG_RELEASE_NUMBER ?? Date.now());
    if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`FITSTRONG_RELEASE_NUMBER must be a whole number, not ${process.env.FITSTRONG_RELEASE_NUMBER}`);
    fs.writeFileSync(sw, src
      .replace('[/* __PRECACHE__ */]', JSON.stringify([...files, shell].map(f => base + f)))
      .replace("'__BUILD__'", JSON.stringify(build))
      .replace("'__NUMBER__'", JSON.stringify(String(number))));
  },
});
```

The `node:crypto` import stays, for the security meta's hashes.

  The files the build must name by their bytes, which `public/` would copy under fixed names:
  - `git mv public/models/coach-female.bin src/assets/models/coach-female.bin` and the same for `coach-male.bin`; `git mv public/favicon.svg src/assets/favicon.svg`; `git mv public/apple-touch-icon.png src/assets/apple-touch-icon.png`;
  - write `src/motion/models.ts`:

```ts
/**
 * The coach's two 3D models, as the build names them: under a name that
 * changes with their bytes, so every release's cache holds its own copy, and
 * none can ever be another release's (board D120, Codex P8S-15).
 */
import female from '@/assets/models/coach-female.bin?url';
import male from '@/assets/models/coach-male.bin?url';

export const MODEL_URL = { female, male } as const;
```

  - `src/components/motion/MotionView.tsx`: import `MODEL_URL` from `@/motion/models`; `{ modelUrl: `${import.meta.env.BASE_URL}models/coach-${figure}.bin` }` becomes `{ modelUrl: MODEL_URL[figure] }`. `src/motion/lab.ts` the same, with `MODEL_URL[sex]`;
  - `index.html`: the icon's `href="/fit-strong-90/favicon.svg"` becomes `href="/src/assets/favicon.svg"`, and the Home Screen icon's `href="/fit-strong-90/apple-touch-icon.png"` becomes `href="/src/assets/apple-touch-icon.png"`, which the build names by their bytes. `manifest.webmanifest` and its own icons stay in `public/`: the system reads them as it adds the app to the Home Screen, and the release never caches them;
  - `grep -rln "public/models\|public/apple-touch-icon" scripts src` names `scripts/character/build.mjs`, `scripts/motion/probe.ts`, `src/motion/clips/clips.node.test.ts` and `src/components/hig/shell.node.test.ts`: each path becomes the file's new one under `src/assets/`. In `shell.node.test.ts`, "Home Screen icons (S-22)"'s `size` reads `path.join(ROOT, file)` and is given `src/assets/apple-touch-icon.png`, `public/pwa-192x192.png`, `public/pwa-512x512.png` and `public/pwa-maskable-512x512.png`, and its `index.html` line expects `href="/src/assets/apple-touch-icon.png"`.

- [ ] **Step 4: The worker.** `public/sw.js` becomes:

```js
// Offline app shell and static-file cache (J§21.2; board D106, D120). Health
// data lives in IndexedDB and never passes through here; only the app's own
// static files are cached.

// Filled in at build (vite.config.ts): PRECACHE, every file of this release,
// each under a name that changes with its bytes, the 3D models and the icons
// included, and this release's own copy of index.html, `shell-<BUILD>.html`;
// BUILD, a hash of all their bytes and of this worker's code; and NUMBER,
// this release's place in order, higher for every later release (P8S-14,
// P8S-15).
const PRECACHE = [/* __PRECACHE__ */];
const BUILD = '__BUILD__';
const NUMBER = Number('__NUMBER__');
const CACHE = `fitstrong-${NUMBER}-${BUILD}`;
// v1's caches, and the voice clips', which outlive releases: they're large, and
// only change when a pack is re-rendered, which network-first picks up.
const V1 = 'fitstrong90-';
const MEDIA = `${V1}voice`;
const BASE = new URL('./', self.location).pathname;
const SHELL = `${BASE}shell-${BUILD}.html`;
/** A release cache's place in order, or undefined for any other cache. */
const numberOf = (name) => {
  const m = /^fitstrong-(\d+)-/.exec(name);
  return m ? Number(m[1]) : undefined;
};

// A release is cached whole or not at all, every file fetched afresh past the
// HTTP cache: `addAll` stores nothing if any file fails, and the empty cache it
// began is deleted, so a failed install leaves the release in use as it was.
// Each file's name changes with its bytes, so a deploy that moves on under a
// slow install can only make a file missing, never another release's (P8S-15).
// Then it waits, as every service worker does, until no window still runs the
// release before it: the next time FitStrong opens. It never skips waiting by
// itself (D106).
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE)
    .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(new URL(url, self.location.href), { cache: 'reload' }))))
    .catch(async (error) => {
      await caches.delete(CACHE);
      throw error;
    }));
});

// A page asks two things, each answered on the port it sends. 'windows': this
// release, and how many windows of FitStrong are open, the asking one
// included. 'restart' (Home's "Restart to update"): take over now, which a
// waiting worker does only while the asking window is FitStrong's only one;
// that page then reloads once. Nothing else makes it take over.
self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  const port = event.ports && event.ports[0];
  if ((type !== 'windows' && type !== 'restart') || !port) return;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // The origin may hold other sites: only this app's windows count.
    const windows = all.filter((w) => new URL(w.url).pathname.startsWith(BASE));
    const alone = windows.length === 1 && !!event.source && windows[0].id === event.source.id;
    const restarting = type === 'restart' && alone;
    if (restarting) await self.skipWaiting();
    port.postMessage({ build: BUILD, windows: windows.length, restarting });
  })());
});

// Voice clips cached by v1's worker (one shared cache) move to the voice
// cache, so an update doesn't silently drop the offline coach.
async function keepVoice(from) {
  const [old, media] = await Promise.all([caches.open(from), caches.open(MEDIA)]);
  for (const request of await old.keys()) {
    if (!new URL(request.url).pathname.startsWith(BASE + 'voice/')) continue;
    const hit = await old.match(request);
    if (hit) await media.put(request, hit);
  }
}

// Activation comes only once no window runs the release before it, or when
// FitStrong's only window asked to restart and is reloading. Only the releases
// before this one go, by their place in order: never one installing or waiting
// behind it (P8S-14). v1's go too, their voice clips kept. The very first
// release on a device, with none before it, takes over the page it was
// installed from, so no window of FitStrong is ever left uncontrolled for a
// later release to slip past (P8S-11); every later release waits.
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const v1 = keys.filter((k) => k.startsWith(V1) && k !== MEDIA);
    for (const k of v1) await keepVoice(k);
    const before = keys.filter((k) => v1.includes(k) || (numberOf(k) !== undefined && numberOf(k) < NUMBER));
    await Promise.all(before.map((k) => caches.delete(k)));
    if (before.length === 0) await self.clients.claim();
  })());
});

// Only complete same-origin 200s: a 206 (partial audio) or an opaque response can't be cached safely.
function keep(cacheName, request, response) {
  if (response.status === 200 && response.type === 'basic') {
    const copy = response.clone();
    caches.open(cacheName).then((cache) => cache.put(request, copy)).catch(() => {});
  }
  return response;
}

// Matched by URL alone: a `Vary: Origin` reply would otherwise miss for module
// scripts, which Chrome requests with an Origin header. Only ever this
// release's own cache: a window runs the release whose worker controls it, and
// reads that release's files, its shell and models included (P8R-10).
const OPTS = { ignoreVary: true };
const own = async (request, name = CACHE) => (await caches.open(name)).match(request, OPTS);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  // Range requests (audio playback and seeking) go straight to the network.
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('range')) return;

  if (request.mode === 'navigate') {
    // This release's own copy of index.html, online or not: a newer release
    // reaches a window by installing and waiting, never through a navigation.
    event.respondWith(own(SHELL).then((hit) => hit || fetch(request)));
    return;
  }

  if (url.pathname.startsWith(BASE + 'voice/')) {
    // Voice clips and manifests: network first (a re-rendered pack replaces old clips), cache for offline.
    event.respondWith(fetch(request).then((res) => keep(MEDIA, request, res))
      .catch(() => own(request, MEDIA).then((hit) => hit || Response.error())));
    return;
  }

  // Everything else: this release's copy, else the network, and nothing written.
  event.respondWith(own(request).then((hit) => hit || fetch(request)));
});
```

Run: `npx vitest run src/app/release.test.ts src/app/sw.node.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing page-side tests** `src/app/updates.test.ts`

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BUILD_KEY, CLOSE_OTHERS, UPDATED, UPDATE_READY, countWindows, dismissUpdated, resetUpdatesForTests, restartToUpdate,
  startUpdates, updateLine, updateState, type ContainerLike, type RegistrationLike, type WorkerLike,
} from './updates';

type FakeWorker = WorkerLike & { asked: string[]; state: string; changed: (() => void)[]; held: (() => void)[]; addEventListener(t: 'statechange', fn: () => void): void };

/**
 * A worker of this app: answers on the port it is sent, as public/sw.js
 * does, counting FitStrong's windows as it answers. `silent`: one from before
 * Plan 8, which never answers. `slow`: a restart answered only when the test
 * lets it (`held`).
 */
function worker(build: string, world: { windows: number }, { silent = false, slow = false } = {}): FakeWorker {
  const w: FakeWorker = {
    asked: [], state: 'installed', changed: [], held: [],
    postMessage(message, transfer) {
      const type = (message as { type: string }).type;
      w.asked.push(type);
      if (silent) return;
      // The page closes its end once answered, or once it stops waiting, which closes both.
      const answer = () => (transfer[0] as MessagePort).postMessage({ build, windows: world.windows, restarting: type === 'restart' && world.windows === 1 });
      if (slow && type === 'restart') w.held.push(answer);
      else answer();
    },
    addEventListener: (_t, fn) => void w.changed.push(fn),
  };
  return w;
}

function browser(own: WorkerLike | null) {
  const world = { windows: 1 };
  const changes: (() => void)[] = [];
  const found: (() => void)[] = [];
  const registration: { -readonly [K in keyof RegistrationLike]: RegistrationLike[K] } = {
    waiting: null, installing: null, addEventListener: (_t, fn) => void found.push(fn),
  };
  const container: { -readonly [K in keyof ContainerLike]: ContainerLike[K] } = {
    controller: own, register: async () => registration, addEventListener: (_t, fn) => void changes.push(fn),
  };
  /** A new release finishes installing while this page runs. */
  const install = (build: string, opts: { slow?: boolean } = {}) => {
    const next = worker(build, world, opts);
    registration.installing = next;
    for (const fn of found) fn();
    registration.installing = null;
    registration.waiting = next;
    for (const fn of next.changed) fn();
    return next;
  };
  /** The waiting worker takes over, as a real one does once it has skipped waiting. */
  const takeOver = () => {
    container.controller = registration.waiting;
    registration.waiting = null;
    for (const fn of changes) fn();
  };
  /** The very first release's worker takes over this page, which no worker controlled (P8S-11). */
  const claim = (w: WorkerLike) => {
    container.controller = w;
    for (const fn of changes) fn();
  };
  return { world, registration, container, install, takeOver, claim };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));
function storage() {
  const rows = new Map<string, string>();
  return { getItem: (k: string) => rows.get(k) ?? null, setItem: (k: string, v: string) => void rows.set(k, v), rows };
}

afterEach(() => {
  resetUpdatesForTests();
  vi.useRealTimers();
});

describe('a new release waits for this window, and nothing reloads by itself (J§21.2, D106)', () => {
  it('found while the page runs: waiting, with FitStrong’s windows counted, and no reload', async () => {
    const b = browser(worker('aaa', { windows: 1 }));
    const reload = vi.fn();
    await startUpdates({ container: b.container, swUrl: '/sw.js', reload });
    expect(updateState().waiting).toBe(false);
    b.install('bbb');
    await settle();
    expect(updateState()).toMatchObject({ waiting: true, windows: 1, restarting: false });
    // A takeover nobody asked for here (the worker never does one) still reloads nothing.
    b.takeOver();
    expect(reload).not.toHaveBeenCalled();
  });

  it('found waiting from an earlier open, too', async () => {
    const b = browser(worker('aaa', { windows: 1 }));
    b.registration.waiting = worker('bbb', b.world);
    await startUpdates({ container: b.container, swUrl: '/sw.js', reload: vi.fn() });
    await settle();
    expect(updateState().waiting).toBe(true);
  });

  it('a first visit, until its release’s first worker takes it over, has nothing waiting for it', async () => {
    const b = browser(null);
    b.registration.waiting = worker('bbb', b.world);
    await startUpdates({ container: b.container, swUrl: '/sw.js', reload: vi.fn() });
    expect(updateState().waiting).toBe(false);
  });

  it('taken over by its release’s first worker, a first visit reloads nothing, and a later release then waits for it (P8S-11)', async () => {
    const b = browser(null);
    const reload = vi.fn();
    await startUpdates({ container: b.container, swUrl: '/sw.js', reload });
    b.claim(worker('aaa', b.world));
    await settle();
    expect(reload).not.toHaveBeenCalled();
    b.install('bbb');
    await settle();
    expect(updateState()).toMatchObject({ waiting: true, windows: 1 });
  });
});

describe('Restart to update (D106, P8S-12, P8S-13)', () => {
  it('as FitStrong’s only window: the cover first and new work held, then the worker asked once the queued work is done; one reload, at the takeover', async () => {
    const b = browser(worker('aaa', { windows: 1 }));
    const reload = vi.fn();
    const order: string[] = [];
    const resume = vi.fn();
    let done!: () => void;
    await startUpdates({
      container: b.container, swUrl: '/sw.js', reload,
      hold: () => { order.push('hold'); return resume; },
      settled: () => new Promise<void>(resolve => { order.push('settled'); done = resolve; }),
    });
    const next = b.install('bbb');
    const how = restartToUpdate();
    await settle();
    expect(updateState().restarting).toBe(true);
    expect(order).toEqual(['hold', 'settled']);
    expect(next.asked).not.toContain('restart');
    done();
    expect(await how).toBe('restarting');
    expect(next.asked).toContain('restart');
    expect(resume).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    b.takeOver();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('a slow answer saying another window opened meanwhile: the cover goes, work is let in again, and nothing reloads', async () => {
    const b = browser(worker('aaa', { windows: 1 }));
    const reload = vi.fn();
    const resume = vi.fn();
    await startUpdates({ container: b.container, swUrl: '/sw.js', reload, hold: () => resume });
    const next = b.install('bbb', { slow: true });
    const how = restartToUpdate();
    await settle();
    expect(updateState().restarting).toBe(true);
    b.world.windows = 2;
    for (const answer of next.held) answer();
    expect(await how).toBe('others');
    expect(updateState()).toMatchObject({ restarting: false, windows: 2 });
    expect(resume).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it('with something under way when it is tapped: nothing is put up, held or asked (P8S-12)', async () => {
    const b = browser(worker('aaa', { windows: 1 }));
    const hold = vi.fn(() => () => undefined);
    let busy = true;
    await startUpdates({ container: b.container, swUrl: '/sw.js', reload: vi.fn(), hold, underWay: () => busy });
    const next = b.install('bbb');
    expect(await restartToUpdate()).toBe('busy');
    expect(updateState().restarting).toBe(false);
    expect(hold).not.toHaveBeenCalled();
    expect(next.asked).not.toContain('restart');
    busy = false;
    expect(await restartToUpdate()).toBe('restarting');
  });

  it('with another window open: nothing changes but the count, and nothing reloads', async () => {
    const b = browser(worker('aaa', { windows: 1 }));
    const reload = vi.fn();
    await startUpdates({ container: b.container, swUrl: '/sw.js', reload });
    b.install('bbb');
    b.world.windows = 2;
    expect(await restartToUpdate()).toBe('others');
    expect(updateState()).toMatchObject({ windows: 2, restarting: false });
    b.world.windows = 1;
    await countWindows();
    expect(updateState().windows).toBe(1);
    expect(reload).not.toHaveBeenCalled();
  });

  it('a takeover that never comes: the restart the person asked for reloads all the same, once', async () => {
    const b = browser(worker('aaa', { windows: 1 }));
    const reload = vi.fn();
    await startUpdates({ container: b.container, swUrl: '/sw.js', reload });
    b.install('bbb');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    expect(await restartToUpdate()).toBe('restarting');
    await vi.advanceTimersByTimeAsync(9_000);
    expect(reload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});

describe('"Updated" once the release changed, until dismissed (K8-03)', () => {
  it('compares this page’s release with the last open’s, and keeps the line until it is dismissed, however long', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const kept = storage();
    const marks: string[] = [];
    await startUpdates({ container: browser(worker('aaa', { windows: 1 })).container, swUrl: '/sw.js', reload: vi.fn(), storage: kept, mark: b => void marks.push(b) });
    expect(updateState().updated).toBe(false);
    expect(kept.rows.get(BUILD_KEY)).toBe('aaa');
    resetUpdatesForTests();
    await startUpdates({ container: browser(worker('bbb', { windows: 1 })).container, swUrl: '/sw.js', reload: vi.fn(), storage: kept, mark: b => void marks.push(b) });
    expect(updateState().updated).toBe(true);
    expect(marks).toEqual(['aaa', 'bbb']);
    vi.setSystemTime(Date.now() + 24 * 60 * 60 * 1000);
    expect(updateState().updated).toBe(true);
    dismissUpdated();
    expect(updateState().updated).toBe(false);
  });

  it('says nothing when the worker in charge is one from before Plan 8, which never answers', async () => {
    const kept = storage();
    await startUpdates({ container: browser(worker('old', { windows: 1 }, { silent: true })).container, swUrl: '/sw.js', reload: vi.fn(), storage: kept, answerMs: 20 });
    expect(updateState().updated).toBe(false);
    expect(kept.rows.size).toBe(0);
  });
});

describe('Home’s line, in words (D106)', () => {
  const s = (over: object) => ({ waiting: false, restarting: false, updated: false, ...over });

  it('offers the restart only with nothing under way and no other window open', () => {
    expect(updateLine(s({ waiting: true, windows: 1 }), false)).toEqual({ text: UPDATE_READY, action: 'restart' });
    expect(updateLine(s({ waiting: true, windows: 1 }), true)).toEqual({ text: UPDATE_READY });
    expect(updateLine(s({ waiting: true }), false)).toEqual({ text: UPDATE_READY });
    expect(updateLine(s({ waiting: true, windows: 2 }), false)).toEqual({ text: UPDATE_READY, detail: CLOSE_OTHERS });
  });

  it('says Updated, to dismiss, when nothing newer waits; and nothing otherwise', () => {
    expect(updateLine(s({ updated: true }), true)).toEqual({ text: UPDATED, action: 'dismiss' });
    expect(updateLine(s({ updated: true, waiting: true, windows: 1 }), false)).toEqual({ text: UPDATE_READY, action: 'restart' });
    expect(updateLine(s({}), false)).toBeUndefined();
  });
});
```

Run: `npx vitest run src/app/updates.test.ts`
Expected: FAIL, "Cannot find module './updates'".

- [ ] **Step 6: Write** `src/app/updates.ts`

```ts
/**
 * Updates, the platform's own way (J§21.2, B-21; board D106). A new release
 * installs beside this one and waits, as every service worker does, until no
 * window still runs this one: it applies the next time FitStrong opens, and
 * Home says so. Nothing here reloads by itself (K8-02, K8-10). The person can
 * apply it sooner with Home's "Restart to update", offered only while nothing
 * is under way in this window and the waiting worker finds this window is
 * FitStrong's only one; with another open, Home asks for it to be closed. The
 * restart is one transition: the cover first, no new work let in, then the
 * worker asked; if it says no, the cover goes (P8S-13). After an update, the
 * first Home says "Updated" until it is dismissed.
 */
import { useSyncExternalStore } from 'react';

export interface WorkerLike {
  postMessage(message: unknown, transfer: Transferable[]): void;
}

export interface InstallingLike extends WorkerLike {
  readonly state: string;
  addEventListener(type: 'statechange', listener: () => void): void;
}

export interface RegistrationLike {
  readonly waiting: WorkerLike | null;
  readonly installing: InstallingLike | null;
  addEventListener(type: 'updatefound', listener: () => void): void;
}

export interface ContainerLike {
  readonly controller: WorkerLike | null;
  register(url: string): Promise<RegistrationLike>;
  addEventListener(type: 'controllerchange', listener: () => void): void;
}

/** What this app's worker says when asked (public/sw.js). */
export interface WorkerAnswer {
  /** Its release's stamp. */
  build: string;
  /** FitStrong's open windows, the asking one included. */
  windows: number;
  /** It is taking over now, at the asking window's restart. */
  restarting: boolean;
}

export interface UpdateState {
  /** A new release has installed, and waits for this release's windows to close. */
  waiting: boolean;
  /** FitStrong's open windows, as the waiting worker counts them; unknown until it answers. */
  windows?: number;
  /** "Restart to update" was tapped: the cover is up, and the new release is being asked to take over. */
  restarting: boolean;
  /** This open is the first on a new release, and the person hasn't dismissed it. */
  updated: boolean;
}

export interface UpdateDeps {
  container: ContainerLike;
  swUrl: string;
  /** Where the last release seen is kept; absent where web storage is refused. */
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  /** The one reload: after the person's own "Restart to update". */
  reload: () => void;
  /** The page has loaded: the worker registers after it, so it never competes with the first screen. */
  loaded?: Promise<void>;
  /** Told this page's release (`data-build`, which the acceptance suite reads). */
  mark?: (build: string) => void;
  /** How long a worker has to answer before it counts as one from before Plan 8, which never will. */
  answerMs?: number;
  /** Anything under way in this window that a restart would lose (`src/app/underWay.ts`): no restart then (P8S-12). */
  underWay?: () => boolean;
  /** Stops new work for the restart, and gives back what lets it in again (the store's `holdNewWork`, P8S-13). */
  hold?: () => () => void;
  /** Resolves once the work already queued is done (the store's `whenSettled`). */
  settled?: () => Promise<void>;
}

export const BUILD_KEY = 'fit-strong-90-build';
export const UPDATE_READY = 'An update is ready. It applies the next time FitStrong opens.';
export const CLOSE_OTHERS = 'Close FitStrong’s other windows to update now.';
export const RESTART = 'Restart to update';
export const RESTARTING = 'Restarting to update…';
export const UPDATED = 'Updated. FitStrong is on its latest version.';
export const DISMISS = 'Dismiss';
/** How long a takeover the worker agreed to has, before the restart reloads all the same. */
export const TAKEOVER_MS = 10_000;

const IDLE: UpdateState = { waiting: false, restarting: false, updated: false };
let state: UpdateState = IDLE;
let deps: UpdateDeps | undefined;
let registration: RegistrationLike | undefined;
let fallback: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function set(patch: Partial<UpdateState>): void {
  state = { ...state, ...patch };
  for (const listener of [...listeners]) listener();
}

/** One question to one worker, answered on a channel of its own; undefined when it doesn't answer in time. */
function ask(worker: WorkerLike, type: 'windows' | 'restart'): Promise<WorkerAnswer | undefined> {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      resolve(undefined);
    }, deps?.answerMs ?? 2000);
    channel.port1.onmessage = event => {
      clearTimeout(timer);
      channel.port1.close();
      resolve(event.data as WorkerAnswer);
    };
    worker.postMessage({ type }, [channel.port2]);
  });
}

/** This page's release: one different from the last open's is an update, said on Home until dismissed (K8-03). */
function noteRelease(build: string): void {
  deps?.mark?.(build);
  let before: string | null;
  try {
    before = deps?.storage?.getItem(BUILD_KEY) ?? null;
    deps?.storage?.setItem(BUILD_KEY, build);
  } catch {
    return; // web storage refused: there is nothing to compare with
  }
  if (before !== null && before !== build) set({ updated: true });
}

/** Watch for a new release (main.tsx, production only): registered once the page has loaded. */
export async function startUpdates(d: UpdateDeps): Promise<void> {
  deps = d;
  // A waiting release, known to this page: one left by an earlier open, or one that finishes
  // installing while this page runs. A page no worker controls yet has nothing waiting for it.
  const check = () => {
    if (!registration?.waiting || !d.container.controller) return;
    set({ waiting: true });
    void countWindows();
  };
  // This page's release, as its worker says it.
  const adopt = async () => {
    const mine = d.container.controller;
    const own = mine ? await ask(mine, 'windows') : undefined;
    if (own) noteRelease(own.build);
    check();
  };
  d.container.addEventListener('controllerchange', () => {
    // Only the restart the person asked for reloads the page (D106).
    if (state.restarting) {
      if (fallback !== undefined) clearTimeout(fallback);
      fallback = undefined;
      d.reload();
      return;
    }
    // A first visit taken over by its release's first worker (P8S-11): now that release's,
    // waiting like any other window for whatever comes next. Nothing reloads.
    void adopt();
  });
  await d.loaded;
  registration = await d.container.register(d.swUrl).catch(() => undefined);
  await adopt();
  const reg = registration;
  if (!reg) return;
  reg.addEventListener('updatefound', () => {
    const next = reg.installing;
    next?.addEventListener('statechange', () => {
      if (next.state === 'installed') check();
    });
  });
}

/** FitStrong's windows, as the waiting worker counts them: asked when one is found, when Home shows, and on every return. */
export async function countWindows(): Promise<void> {
  const waiting = registration?.waiting;
  if (!waiting) return;
  const answer = await ask(waiting, 'windows');
  if (answer) set({ windows: answer.windows });
}

/**
 * "Restart to update" (D106). Asked again at the tap: with anything under way
 * now, nothing happens (P8S-12). Otherwise one transition (P8S-13): the
 * cover goes up over an app made inert, no new work is let in, and the work
 * already queued finishes; only then is the waiting worker asked. It takes
 * over only while this window is FitStrong's only one, and the page reloads
 * once, at the takeover (`controllerchange`), or after `TAKEOVER_MS` should
 * that never come. If it says no, or doesn't answer, the cover goes and work
 * is let in again, with nothing under it changed.
 */
export async function restartToUpdate(): Promise<'restarting' | 'others' | 'busy' | 'none'> {
  const waiting = registration?.waiting;
  if (!waiting || state.restarting) return 'none';
  if (deps?.underWay?.()) return 'busy';
  set({ restarting: true });
  const resume = deps?.hold?.();
  await deps?.settled?.();
  const answer = await ask(waiting, 'restart');
  if (answer?.restarting) {
    const reload = deps?.reload;
    fallback = setTimeout(() => {
      fallback = undefined;
      if (state.restarting) reload?.();
    }, TAKEOVER_MS);
    return 'restarting';
  }
  resume?.();
  set({ restarting: false, ...(answer ? { windows: answer.windows } : {}) });
  return answer ? 'others' : 'none';
}

/** The person has read "Updated". */
export function dismissUpdated(): void {
  set({ updated: false });
}

export const updateState = (): UpdateState => state;

export function subscribeUpdates(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export const useUpdates = (): UpdateState => useSyncExternalStore(subscribeUpdates, updateState, updateState);

export interface UpdateLine {
  text: string;
  /** A second sentence, under it. */
  detail?: string;
  action?: 'restart' | 'dismiss';
}

/**
 * Home's line (pure): from the state, and whether anything is under way in
 * this window (`src/app/underWay.ts`). A waiting release comes before the
 * "Updated" note.
 */
export function updateLine(s: UpdateState, underWay: boolean): UpdateLine | undefined {
  if (s.waiting) {
    if ((s.windows ?? 0) > 1) return { text: UPDATE_READY, detail: CLOSE_OTHERS };
    return s.windows === 1 && !underWay ? { text: UPDATE_READY, action: 'restart' } : { text: UPDATE_READY };
  }
  return s.updated ? { text: UPDATED, action: 'dismiss' } : undefined;
}

/** Tests only. */
export function resetUpdatesForTests(): void {
  if (fallback !== undefined) clearTimeout(fallback);
  fallback = undefined;
  state = IDLE;
  deps = undefined;
  registration = undefined;
  listeners.clear();
}
```

Run: `npx vitest run src/app/release.test.ts src/app/sw.node.test.ts src/app/updates.test.ts`
Expected: PASS.

- [ ] **Step 7: What is under way, and new work held for the restart** (P8S-12, P8S-13).
  - Write `src/screens/workout/underWay.ts`:

```ts
/**
 * Whether a manual workout is begun and not finished in this window (board
 * D106, Codex P8S-12): its rest timer and the exercise in front of the person
 * live only in memory, and a reload starts it again from the stored record,
 * without them. Kept apart from the workout's own code, so Home can ask
 * without loading it.
 */
let live = false;

export const workoutUnderWay = (): boolean => live;

/** Told by `useWorkout` whenever its workout changes. */
export function noteWorkout(underWay: boolean): void {
  live = underWay;
}
```

  - In `src/screens/workout/useWorkout.ts`, import `noteWorkout` from `./underWay`, and the effect `useEffect(() => { memory.live = { key, state }; }, [key, state]);` becomes:

```ts
  useEffect(() => {
    memory.live = { key, state };
    // Outlives the screen, as the workout does: a look at Home mid-rest is still mid-workout (P8S-12).
    noteWorkout(state.begun && state.status === 'in_progress');
  }, [key, state]);
```

  - Write `src/app/underWay.ts`:

```ts
/**
 * What is under way in this window, which a restart would lose (board D106,
 * Codex P8S-12): a write not yet stored, a walk not yet saved or discarded,
 * or a manual workout begun and not finished.
 */
import { getState } from '@/store/useStore';
import { peekWalk } from '@/walk/persist';
import { workoutUnderWay } from '@/screens/workout/underWay';

export const underWay = (): boolean => getState().saving || peekWalk() !== null || workoutUnderWay();
```

  - In `src/store/useStore.ts`, after `enqueueTask`:

```ts
let admitting = true;
export const RESTARTING_REFUSAL = 'FitStrong is restarting to update, so this wasn’t saved.';

/**
 * Lets in no new work while FitStrong restarts to update (board D106, Codex
 * P8S-13): every mutation asked for from now is refused at once, with nothing
 * shown or written, until the function this gives back is called. Work
 * already queued carries on (`whenSettled`).
 */
export function holdNewWork(): () => void {
  admitting = false;
  return () => { admitting = true; };
}

/** Resolves once every write queued before it has been stored or refused. */
export const whenSettled = (): Promise<void> => enqueueTask(async () => undefined);
```

    `enqueue`'s promise begins `if (!admitting) { resolve({ ok: false, failure: new StoreFailure('unavailable', RESTARTING_REFUSAL) }); return; }`, before anything is planned, and `resetForTests()` adds `admitting = true;`.

  - Write the failing test `src/app/restart.callers.test.ts`, through the real Workout Log and store, with the stand-ins `src/screens/workout/workout.callers.test.ts` uses:

```ts
/**
 * Home's restart, through its real callers (D106; Codex P8S-12, P8S-13): a
 * manual workout under way keeps Restart off Home, its rest running, until
 * it is finished and saved; and a restart whose worker answers slowly lets in
 * no new work meanwhile, then, told no, lets it in again with nothing changed.
 * Replaced: the router, the dialog primitives and the 3D figure.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement as h, type ReactNode } from 'react';
import type { CheckInRecord, DailyCheckIn } from '@/types/checkin';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host } from '@/test/host';
import type { ContainerLike, RegistrationLike, WorkerLike } from './updates';

const router = vi.hoisted(() => ({ navigate: vi.fn(), params: new URLSearchParams() }));
vi.mock('react-router-dom', async () => {
  const { createElement } = await import('react');
  return {
    useNavigate: () => router.navigate,
    useSearchParams: () => [router.params],
    useLocation: () => ({ pathname: '/trends/workout', search: '', state: null, key: 'k0' }),
    useRouteError: () => undefined,
    Link: ({ children, to, onClick }: { children?: ReactNode; to: string; onClick?: () => void }) => createElement('a', { href: `#${to}`, onClick }, children),
  };
});
vi.mock('@/components/ui/sheet', async () => {
  const { createElement, Fragment } = await import('react');
  return {
    Sheet: ({ open, children }: { open: boolean; children?: ReactNode }) => (open ? createElement(Fragment, null, children) : null),
    SheetContent: ({ children }: { children?: ReactNode }) => createElement('div', { 'data-slot': 'sheet-content', role: 'dialog' }, children),
    SheetTitle: ({ children }: { children?: ReactNode }) => createElement('h2', null, children),
    SheetClose: ({ children }: { children?: ReactNode }) => createElement('button', { type: 'button' }, children),
  };
});
vi.mock('@/components/exercise/ExerciseFigure', () => ({ ExerciseFigure: () => null }));

const local = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
    removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: () => null, get length() { return local.size; },
  },
  window: globalThis,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  scrollTo() {},
  ...(typeof globalThis.addEventListener === 'function' ? {} : { addEventListener() {}, removeEventListener() {} }),
  document: {
    title: '', visibilityState: 'visible', activeElement: null, addEventListener() {}, removeEventListener() {},
    getElementById: () => null, querySelector: () => null, documentElement: { dataset: {} }, body: { nodeType: 1 },
  },
  requestAnimationFrame: (f: () => void) => setTimeout(f, 0),
});

const store = await import('@/store/useStore');
const { evaluateCheckIn } = await import('@/engine/readiness');
const { UrgentProvider } = await import('@/screens/home/UrgentBanner');
const { default: TodayWorkoutScreen } = await import('@/screens/workout/TodayWorkoutScreen');
const updates = await import('./updates');
const { underWay } = await import('./underWay');

const DAY = '2026-10-08';
const profile = createDefaultProfile({ health: { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous', glucoseMonitor: 'none', glucoseUnit: 'mg/dL' } });
const answered: DailyCheckIn = {
  date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4,
  back: { pain: 0, legPain: 0, reach: 'back', newNeuro: false, caudaEquinaFlag: false },
};
const WAITING = { waiting: true, windows: 1, restarting: false, updated: false };
let host: Host | undefined;
const h0 = () => host!;
const settle = () => h0().settle(12);

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 8, 9, 0, 0));
  local.clear();
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
  const record: CheckInRecord = { ...answered, readiness: evaluateCheckIn(profile, answered, []) };
  await store.update(prev => ({ ...prev, profile, settings: { ...prev.settings, startDate: '2026-09-24' }, checkIns: [record] }));
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  updates.resetUpdatesForTests();
  vi.useRealTimers();
});

describe('a manual workout under way keeps Restart off Home until it is finished (P8S-12)', () => {
  it('a set logged and its rest running, Home: the update named with no Restart; the workout finished and saved: Restart', async () => {
    host = render(h(UrgentProvider, null, h(TodayWorkoutScreen)));
    await settle();
    await h0().click(h0().button('Done set', { exact: true }));
    await settle();
    // Its write stored and its rest running: only the workout's own memory says it is under way.
    expect(store.getState().saving).toBe(false);
    host.unmount();
    host = undefined;
    expect(underWay()).toBe(true);
    expect(updates.updateLine(WAITING, underWay())).toEqual({ text: updates.UPDATE_READY });
    host = render(h(UrgentProvider, null, h(TodayWorkoutScreen)));
    await settle();
    await h0().click(h0().button('Finish workout', { exact: true }));
    await settle();
    await h0().click(h0().button('Save workout', { exact: true }));
    await settle();
    host.unmount();
    host = undefined;
    expect(underWay()).toBe(false);
    expect(updates.updateLine(WAITING, underWay())).toEqual({ text: updates.UPDATE_READY, action: 'restart' });
  });
});

describe('a restart lets in no new work until its worker answers (P8S-13)', () => {
  it('a slow answer: a write asked for meanwhile is refused with nothing stored; told no, the app takes work again', async () => {
    const world = { windows: 1 };
    const pending: (() => void)[] = [];
    const worker = (build: string): WorkerLike => ({
      postMessage(message, transfer) {
        const type = (message as { type: string }).type;
        const answer = () => (transfer[0] as MessagePort).postMessage({ build, windows: world.windows, restarting: type === 'restart' && world.windows === 1 });
        if (type === 'restart') pending.push(answer);
        else answer();
      },
    });
    const registration: RegistrationLike = { waiting: worker('bbb'), installing: null, addEventListener() {} };
    const container: ContainerLike = { controller: worker('aaa'), register: async () => registration, addEventListener() {} };
    await updates.startUpdates({ container, swUrl: '/sw.js', reload: vi.fn(), underWay, hold: store.holdNewWork, settled: store.whenSettled });
    expect(updates.updateState().waiting).toBe(true);
    const how = updates.restartToUpdate();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(updates.updateState().restarting).toBe(true);
    const water = { kind: 'water', value: 250, scope: 'dayTotal', source: 'manual' } as const;
    expect((await store.addObservation(water)).ok).toBe(false);
    expect(store.getState().observations.some(o => o.kind === 'water')).toBe(false);
    // Another window opened while it waited: the worker says no.
    world.windows = 2;
    for (const answer of pending) answer();
    expect(await how).toBe('others');
    expect(updates.updateState().restarting).toBe(false);
    expect((await store.addObservation(water)).ok).toBe(true);
  });
});
```

  Run: `npx vitest run src/app/restart.callers.test.ts`. Expected: FAIL first (`./underWay` doesn't exist, and a write is let in during the restart), PASS once this step's files are written.

- [ ] **Step 8: Home's line, the cover, and the start.**
  - Write `src/screens/home/UpdateRow.tsx`:

```tsx
/**
 * Home's update line (J§21.2, board D106; `src/app/updates.ts`): "An update is
 * ready. It applies the next time FitStrong opens." "Restart to update" only
 * with nothing under way in this window and no other window of FitStrong
 * open; with one open, it says to close it. After an update, "Updated" until
 * it is dismissed: never on a timer (K8-03).
 */
import { useEffect } from 'react';
import { RefreshCwIcon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { DISMISS, RESTART, countWindows, dismissUpdated, restartToUpdate, updateLine, useUpdates } from '@/app/updates';
import { underWay } from '@/app/underWay';
import { useStore } from '@/store/useStore';

export function UpdateRow() {
  const s = useUpdates();
  // Drawn again as a write starts or ends; a walk or a workout changes only on its own screen, before Home.
  const { saving } = useStore();
  // Counted again on every return to the app: a window closed elsewhere lets the restart in.
  useEffect(() => {
    if (!s.waiting) return;
    const again = () => {
      if (document.visibilityState === 'visible') void countWindows();
    };
    void countWindows();
    document.addEventListener('visibilitychange', again);
    return () => document.removeEventListener('visibilitychange', again);
  }, [s.waiting]);
  const line = updateLine(s, saving || underWay());
  if (!line) return null;
  return (
    <Group>
      <Row role="status" icon={<RefreshCwIcon />} label={line.text} {...(line.detail ? { detail: line.detail } : {})} />
      {line.action === 'restart' && (
        <Row onClick={() => void restartToUpdate()} label={<span className="font-semibold text-tint">{RESTART}</span>} />
      )}
      {line.action === 'dismiss' && <Row onClick={dismissUpdated} label={<span className="text-tint">{DISMISS}</span>} />}
    </Group>
  );
}
```

    In `src/screens/home/HomeScreen.tsx`, import `UpdateRow` from `./UpdateRow`, and add `<UpdateRow />` straight after `<WalkRecoveryRow />`, under Right now, so an urgent surface always ranks above it.
  - Write `src/app/RestartCover.tsx`:

```tsx
/**
 * "Restarting to update…" (board D106, Codex P8S-13): up the moment Restart
 * is tapped, over the whole app, which is inert beneath it (`App.tsx`), so
 * nothing new can start while the waiting release is asked to take over. It
 * goes if the worker says no: nothing under it has changed.
 */
import { RefreshCwIcon } from 'lucide-react';
import { RESTARTING, useUpdates } from './updates';

export function RestartCover() {
  const { restarting } = useUpdates();
  if (!restarting) return null;
  return (
    <div role="alertdialog" aria-modal="true" aria-label={RESTARTING}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-grouped-bg px-6 text-center">
      <RefreshCwIcon className="size-8 animate-spin text-tint motion-reduce:animate-none" aria-hidden />
      <p className="text-[length:var(--text-title-3)] font-semibold">{RESTARTING}</p>
    </div>
  );
}
```

  - In `src/App.tsx`, import `RestartCover` from `@/app/RestartCover` and `useUpdates` from `@/app/updates`; in `App`, `const { restarting } = useUpdates();`, and both returns that draw the app (the storage screen's and the routes') are wrapped: `<><div inert={restarting} className="contents">{…}</div><RestartCover /></>`, so under the cover nothing can be tapped, typed or reached by keyboard or VoiceOver;
  - in `src/main.tsx`, delete the `vite:preloadError` block. A window reads only its own release's files, which stay until its last window closes, so a screen that can't load is a real failure: the error screen says so, and its Try again is the person's own (K8-02, K8-10). The `if (import.meta.env.PROD && 'serviceWorker' in navigator) { … }` block becomes:

```tsx
// Updates the platform's own way (J§21.2, B-21; board D106): a new release installs and
// waits until no window runs this one, and Home says so. Nothing reloads by itself.
// Production only: in development a cached module would mask code changes.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void startUpdates({
    container: navigator.serviceWorker as unknown as ContainerLike,
    swUrl: `${import.meta.env.BASE_URL}sw.js`,
    storage: localStorage,
    reload: () => window.location.reload(),
    loaded: new Promise<void>(resolve => {
      if (document.readyState === 'complete') resolve()
      else window.addEventListener('load', () => resolve(), { once: true })
    }),
    mark: build => { document.documentElement.dataset.build = build },
    underWay,
    hold: holdNewWork,
    settled: whenSettled,
  })
}
```

    with `import { startUpdates, type ContainerLike } from '@/app/updates'`, `import { underWay } from '@/app/underWay'` and `holdNewWork`, `whenSettled` beside the store's other names.

  `grep -rn "location.reload()" src | grep -v "\.test\."` then prints `main.tsx` (the one reload `startUpdates` is handed), `ErrorBoundary.tsx`'s two buttons, `App.tsx`'s storage screen's "Try again", and `clearAllAndRestart` ("Delete all data", which empties the store first). Each is the person's own tap.

- [ ] **Step 9: The error screen's words, and a way back to a walk** (P8-28, K8-14). Write the failing test `src/components/hig/ErrorBoundary.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { render } from '@/test/host';

const walk = vi.hoisted(() => ({ peek: null as null | { href: '/walk/live' | '/walk/summary' } }));
vi.mock('@/walk/persist', () => ({ peekWalk: () => walk.peek }));
const { Fallback } = await import('./ErrorBoundary');

afterEach(() => { walk.peek = null; });

describe('a screen that didn’t load (P8-28, K8-14)', () => {
  it('promises only what is true, and offers the way back to an unsaved walk', () => {
    walk.peek = { href: '/walk/summary' };
    const h = render(createElement(Fallback, { download: true }));
    expect(h.text()).toContain('Your saved records are safe.');
    expect(h.text()).not.toContain('Nothing you entered has been lost');
    expect(h.all().find(n => n.type === 'a')?.props.href).toBe('#/walk/summary');
    h.unmount();
  });

  it('with no walk under way, has no such link', () => {
    const h = render(createElement(Fallback, {}));
    expect(h.all().some(n => n.type === 'a')).toBe(false);
    h.unmount();
  });
});
```

  Run: `npx vitest run src/components/hig/ErrorBoundary.test.ts`. Expected: FAIL: `Fallback` isn't exported, and its words are the old ones.

  Then in `src/components/hig/ErrorBoundary.tsx`, import `peekWalk` from `@/walk/persist`, and `Fallback` becomes:

```tsx
/**
 * What a screen shows when it fails to render — a screen's code that could
 * not be downloaded, or one that broke as it drew. Suspense only covers the
 * wait; a failed import is an error, and without a boundary React would
 * unmount everything, tab bar included. Answers typed into a sheet on the
 * failed screen go with it, so it promises only the saved records (K8-14).
 * An unsaved walk keeps its way back (P8-28).
 */
export function Fallback({ onRetry, download = false }: { onRetry?: () => void; download?: boolean }) {
  const walk = peekWalk();
  return (
    <div role="alert" className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <TriangleAlertIcon className="size-8 text-caution" aria-hidden />
      <div className="flex flex-col gap-1">
        <h1 className="text-[length:var(--text-title-2)] font-semibold">This screen didn’t load</h1>
        <p className="max-w-xs text-[length:var(--text-subhead)] text-muted-foreground">
          Usually a weak connection or an app update. Your saved records are safe.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {/* For a screen whose code never arrived, Try again is the reload that fetches it afresh. A main action: 60 px tall (J§20.4 rule 1). */}
        {(download || onRetry) && (
          <button type="button" onClick={download ? () => window.location.reload() : onRetry}
            className="press-feedback min-h-[3.75rem] rounded-xl bg-tint px-5 text-[length:var(--text-body)] font-semibold text-on-tint">
            Try again
          </button>
        )}
        {/* When Try again is itself a reload, a second button would only repeat it. */}
        {!download && (
          <button type="button" onClick={() => window.location.reload()}
            className="press-feedback min-h-12 rounded-xl px-5 text-[length:var(--text-body)] text-tint">
            Reload the app
          </button>
        )}
        {walk && (
          <a href={`#${walk.href}`} className="press-feedback flex min-h-12 items-center justify-center rounded-xl px-5 text-[length:var(--text-body)] font-semibold text-tint">
            Back to your walk
          </a>
        )}
      </div>
    </div>
  );
}
```

  In `ErrorBoundary.render`, `<Fallback onRetry={() => window.location.reload()} retryReloads />` becomes `<Fallback download />`; `RootError` renders `<Fallback download={isChunkLoadError(error)} />`.

  Run: `npx vitest run src/components/hig`. Expected: PASS.

- [ ] **Step 10: Run the tests**

Run: `npx vitest run src/app src/components src/screens/home src/screens/workout src/store src/motion`
Expected: PASS.

- [ ] **Step 11: Check by eye, with two windows.** `npm run build && npx vite preview --port 4173`.
  - Every precached URL is named by its bytes but the release's own shell, which is named by the release:

```bash
node -e "const s=require('fs').readFileSync('dist/sw.js','utf8');const l=JSON.parse(s.match(/const PRECACHE = (\[.*?\]);/)[1]);const bad=l.filter(u=>!/-[\w-]{8,}\.\w+$/.test(u));if(bad.length)throw new Error('named by no bytes: '+bad.join(', '));console.log(l.length+' files, every one named by its bytes')"
```

  - In a fresh Chromium profile, open the app: once DevTools → Application → Service workers shows the worker activated, `navigator.serviceWorker.controller` in the console is that worker, with no reload: the first release took its page over;
  - open a second tab; change a string in `src/screens/home/HomeScreen.tsx`, `npm run build` again (its number is higher, so its cache is `fitstrong-<later number>-…`), and reload tab 2 once: the new worker shows "waiting to activate", and both tabs' Home say "An update is ready. It applies the next time FitStrong opens." and "Close FitStrong’s other windows to update now.", with no Restart;
  - in tab 1 start a walk and leave it walking; close tab 2: tab 1's walk carries on and nothing reloads; open `#/home` in tab 1: the line, still without Restart, because the walk is under way;
  - save the walk, tap Done, then Home: "Restart to update". Tap it: "Restarting to update…" covers the app, which takes no tap beneath it; the tab reloads once and shows the changed string, and Home says "Updated. FitStrong is on its latest version." with Dismiss, which stays until it is tapped. Application → Cache storage then holds the new release's cache and the voice clips' only;
  - put back the string.

- [ ] **Step 12: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/app public/sw.js vite.config.ts index.html src/assets src/motion src/main.tsx src/App.tsx src/store/useStore.ts src/components/motion/MotionView.tsx src/components/hig/ErrorBoundary.tsx src/components/hig/ErrorBoundary.test.ts src/components/hig/shell.node.test.ts src/screens/home/UpdateRow.tsx src/screens/home/HomeScreen.tsx src/screens/workout/underWay.ts src/screens/workout/useWorkout.ts scripts/character/build.mjs scripts/motion/probe.ts public
git commit -m "feat: Let an update install whole under names that change with its bytes, wait for FitStrong's windows, and restart from Home behind a cover"
```

---

### Task 3: An older copy meeting a newer database says so and saves nothing, and an interrupted upgrade costs nothing (B-21)

**Files:**
- Create: `src/store/successor.ts`, `src/store/successor.test.ts`, `src/vite-env.d.ts` (the successor build's variable)
- Modify: `src/store/db.ts`, `src/store/migrate.ts` (the successor build's versions)
- Modify: `src/store/useStore.ts` (a newer schema stops this copy; the words for `stale` and `blocked`; `StoreState.readOnly` once storage is lost while the app runs)
- Create: `src/store/writable.ts` (whether this window's storage went read-only while it ran); Modify: `src/session/gate.ts` (nothing new starts then)
- Modify: `src/store/useStore.test.ts` (the `stale` words it pins)
- Modify: `src/App.tsx` (only a first open that can't reach the records shows the storage screen; its Try again restarts onto a waiting release)
- Create: `src/store/upgrade.test.ts`

**Interfaces:**
- Consumes: `openDb`, `DB_NAME`, `toFailure` (`src/store/db.ts`: `VersionError` is already `stale`, and `onBlocked` already waits); `migrateToV5`, `migrateToV6` (`migrate.ts`); the fake database's `versionchange`, `blocked`, `VersionError` and `failWrite` (`src/store/fakeIdb.ts`); `startWalk` (`src/walk/clock.ts`), `storeWalk`, `peekWalk` (`src/walk/persist.ts`); Task 2's `restartToUpdate`.
- Produces:
  - `SUCCESSOR: 0 | 1` (`src/store/successor.ts`); `DB_VERSION = 2 + SUCCESSOR`, `SCHEMA_VERSION = 6 + SUCCESSOR`;
  - `storageNotice()` for `stale`: title "A newer version of FitStrong is open", detail beginning "FitStrong is open somewhere else with a newer version. Close this window and open FitStrong again."; for `blocked`: title "Close FitStrong’s other tabs";
  - a copy that finds a schema newer than its own on the device saves nothing, as `stale`;
  - `StoreState.readOnly: boolean`; `storageReadOnly()`, `setStorageReadOnly(on)` (`src/store/writable.ts`); `READ_ONLY_REASON`, `READ_ONLY_RELEASE` (`src/session/gate.ts`).

**What is left to coordinate** (D107; Codex P8R-08, P8R-09, P8R-17). Task 2 makes a new release start only once no window of the old one is left, or at the restart of FitStrong's only window, so a data migration runs at the new release's start with nothing of the old release open, and a database upgrade finds no old connection to wait for. Nothing here holds or defers anything. What remains is the safety net for a copy that isn't the worker's: a tab opened past the worker, as a forced reload does on a computer. IndexedDB already handles both sides: a copy that finds the database upgraded past its own version can't open it (`VersionError`), and one still open when another upgrades it lets go at once (v1's `versionchange`); either way it saves nothing from then on, keeps what was on screen, and says so in words that are true. A newer copy whose upgrade waits behind an old connection says so too, and carries on by itself once that connection closes. A schema newer than this build's, at the same database version, stops this copy the same way, since its migrations don't know that shape. Storage lost while the app runs is not a failed open (Codex P8S-04): every screen stays as it was, its typed answers and its guidance included, with `UrgentProvider` still above them, and the window becomes read-only: nothing more is written, a reading entered meanwhile still counts for every gate in this window, and no new walk, session or workout starts. Only a first open that can't reach the records shows the storage screen.

- [ ] **Step 1: Write the failing tests** `src/store/upgrade.test.ts`

```ts
/**
 * B-21's other copies and an interrupted upgrade, through the real store
 * (board D107). Each copy is its own module instance, built as the app is or
 * as the suite's successor (D121), over one fake IndexedDB: an older copy
 * meeting a database a newer one upgraded (P8R-09); one open while it is
 * upgraded; a newer copy waiting for an old connection; a newer schema; and a
 * migration interrupted, with a walk still to recover, finished at the next
 * start (P8R-08). One that loses its storage while it runs goes read-only,
 * and starts nothing new (P8S-04). The readers open the database at whatever
 * version it has (P8R-17). A real browser's upgrade given up half-way, and
 * the whole app kept on screen through one, are V-J38's (Task 15).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import { startWalk } from '@/walk/clock';
import { peekWalk, storeWalk } from '@/walk/persist';
import { DB_NAME } from './db';
import { fakeIndexedDB } from './fakeIdb';

function memory(): Storage {
  const rows = new Map<string, string>();
  return {
    getItem: (k: string) => rows.get(k) ?? null, setItem: (k: string, v: string) => void rows.set(k, v),
    removeItem: (k: string) => void rows.delete(k), clear: () => rows.clear(), key: (i: number) => [...rows.keys()][i] ?? null,
    get length() { return rows.size; },
  } as Storage;
}
globalThis.localStorage = memory();

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const glucose = (value: number) => ({ kind: 'glucose', value, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: '2026-10-08T09:00:00+05:30' }) as const;
const STALE = 'FitStrong is open somewhere else with a newer version. Close this window and open FitStrong again.';
const copies: { resetForTests(): void }[] = [];

/** A copy of the app: its own store module, as the app builds it, or as the suite's successor (D121). */
async function copy(factory: IDBFactory, build: 'this' | 'successor' = 'this') {
  vi.resetModules();
  if (build === 'successor') vi.stubEnv('VITE_ACCEPTANCE_SUCCESSOR', '1');
  else vi.unstubAllEnvs();
  const store = await import('./useStore');
  const { DB_VERSION } = await import('./db');
  const { SCHEMA_VERSION } = await import('./migrate');
  const gate = await import('@/session/gate');
  copies.push(store);
  return { store, gate, DB_VERSION, SCHEMA_VERSION, started: store.start({ factory, broadcast: null }) };
}

/** The database as it stands, at whatever version it has: a reader never asks for an older one (P8R-17). */
function rawOpen(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function rawAll(factory: IDBFactory, store: string): Promise<Record<string, unknown>[]> {
  const db = await rawOpen(factory);
  const rows = await new Promise<Record<string, unknown>[]>(resolve => {
    const req = db.transaction(store).objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as Record<string, unknown>[]);
  });
  db.close();
  return rows;
}

async function rawPut(factory: IDBFactory, store: string, row: Record<string, unknown>) {
  const db = await rawOpen(factory);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

const marker = async (factory: IDBFactory) => (await rawAll(factory, 'settings')).find(r => r.key === 'schemaVersion')?.value;
const values = async (factory: IDBFactory) => (await rawAll(factory, 'observations')).map(o => o.value);

beforeEach(() => { globalThis.localStorage.clear(); });
afterEach(() => {
  for (const c of copies.splice(0)) c.resetForTests();
  vi.unstubAllEnvs();
});

describe('an older copy meets a database a newer one upgraded (B-21, D107, P8R-09)', () => {
  it('says so, saves nothing, and keeps what it is told for this window only; trying again changes nothing, with no loop', async () => {
    const fake = fakeIndexedDB();
    const newer = await copy(fake, 'successor');
    await newer.started;
    expect(newer.DB_VERSION).toBe(3);
    newer.store.resetForTests();

    const older = await copy(fake);
    await older.started;
    // A first open that can't reach the records: the storage screen's, never a read-only app.
    expect(older.store.getState()).toMatchObject({ status: 'unavailable', failure: { code: 'stale' }, readOnly: false });
    expect(older.store.storageNotice()).toMatchObject({ tone: 'warning', title: 'A newer version of FitStrong is open', detail: expect.stringContaining(STALE) });
    const low = await older.store.addObservation(glucose(52));
    expect(low.ok).toBe(false);
    expect(older.store.getState().observations.map(o => o.value)).toEqual([52]);
    expect(await values(fake)).toEqual([]);

    // Try again is a fresh start of the same build: the same words, and still nothing written.
    older.store.resetForTests();
    const again = await copy(fake);
    await again.started;
    expect(again.store.getState().failure?.code).toBe('stale');
    expect(await values(fake)).toEqual([]);
  });

  it('one open while a newer copy upgrades lets go at once, keeps what it saved, goes read-only, and starts nothing new (P8S-04)', async () => {
    const fake = fakeIndexedDB();
    const older = await copy(fake);
    await older.started;
    expect((await older.store.addObservation(glucose(112))).ok).toBe(true);
    const newer = await copy(fake, 'successor');
    await newer.started;
    expect(newer.store.getState().status).toBe('ready');
    expect(older.store.getState()).toMatchObject({ status: 'unavailable', failure: { code: 'stale' }, readOnly: true });
    expect(older.store.getState().observations.map(o => o.value)).toEqual([112]);
    // A reading entered now is kept for this window's gates, and nowhere else.
    expect((await older.store.addObservation(glucose(52))).ok).toBe(false);
    expect(older.store.getState().observations.map(o => o.value)).toEqual([112, 52]);
    expect(await values(fake)).toEqual([112]);
    // Nothing new starts here, whatever the engine would say.
    const input = { profile: createDefaultProfile({ health: { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous' } }), now: new Date() };
    for (const mode of ['guided', 'stretch', 'walk'] as const) {
      expect(older.gate.arrivalGate(input, mode, false)).toMatchObject({ allowed: false, reasons: [older.gate.READ_ONLY_REASON] });
      expect(older.gate.startGate(input, mode)).toMatchObject({ allowed: false, reasons: [older.gate.READ_ONLY_REASON] });
    }
    expect((await newer.store.addObservation(glucose(130))).ok).toBe(true);
  });
});

describe('a newer copy waits for an old connection (B-21, D107)', () => {
  it('says to close the other tabs, saves nothing meanwhile, and carries on by itself once it closes', async () => {
    const fake = fakeIndexedDB();
    const first = await copy(fake);
    await first.started;
    first.store.resetForTests();
    // An old tab that hasn't let go: frozen in the background, it never ran its `versionchange`.
    const held = await rawOpen(fake);
    held.onversionchange = () => undefined;
    const newer = await copy(fake, 'successor');
    await delay(5);
    expect(newer.store.getState()).toMatchObject({ status: 'unavailable', failure: { code: 'blocked' } });
    expect(newer.store.storageNotice()?.title).toBe('Close FitStrong’s other tabs');
    held.close();
    await newer.started;
    expect(newer.store.getState().status).toBe('ready');
    expect((await newer.store.addObservation(glucose(112))).ok).toBe(true);
  });
});

describe('a newer schema, and an interrupted migration (B-21, D107, P8R-08)', () => {
  it('a copy that finds a schema newer than its own saves nothing, and says so', async () => {
    const fake = fakeIndexedDB();
    const first = await copy(fake);
    await first.started;
    first.store.resetForTests();
    await rawPut(fake, 'settings', { key: 'schemaVersion', value: first.SCHEMA_VERSION + 1 });
    const next = await copy(fake);
    await next.started;
    expect(next.store.getState()).toMatchObject({ status: 'unavailable', failure: { code: 'stale' } });
    expect((await next.store.addObservation(glucose(112))).ok).toBe(false);
    expect(await marker(fake)).toBe(first.SCHEMA_VERSION + 1);
  });

  it('keeps working where it was, a walk still recoverable, and the next start finishes it', async () => {
    let failing = false;
    const fake = fakeIndexedDB({
      failWrite: (store, row) => (failing && store === 'settings' && row.key === 'schemaVersion' ? new DOMException('The write was stopped.', 'AbortError') : undefined),
    });
    const first = await copy(fake);
    await first.started;
    first.store.resetForTests();
    await rawPut(fake, 'settings', { key: 'schemaVersion', value: first.SCHEMA_VERSION - 1 });
    // Unfinished work to recover: a walk's draft in this window, and its checkpoint on the device (Plan 6's journal).
    const W = 'mgh3k2x1-1a2b3c4d';
    const drafts = memory();
    storeWalk(drafts, startWalk(W, { kind: 'walk', gps: false, steps: false, keepRoute: false }, Date.now()));
    await rawPut(fake, 'walkJournal', { id: W, walkId: W });
    failing = true;
    const interrupted = await copy(fake);
    await interrupted.started;
    expect(interrupted.store.getState().status).toBe('ready');
    expect(await marker(fake)).toBe(first.SCHEMA_VERSION - 1);
    interrupted.store.resetForTests();
    failing = false;
    const again = await copy(fake);
    await again.started;
    expect(await marker(fake)).toBe(first.SCHEMA_VERSION);
    expect((await rawAll(fake, 'walkJournal')).map(r => r.id)).toEqual([W]);
    expect(peekWalk(drafts)?.id).toBe(W);
  });
});
```

And `src/store/successor.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DB_VERSION } from './db';
import { SCHEMA_VERSION } from './migrate';
import { SUCCESSOR } from './successor';

describe('the suite’s successor build (D121)', () => {
  it('is no build but the suite’s: every other has IndexedDB 2 and schema 6', () => {
    expect(SUCCESSOR).toBe(0);
    expect(DB_VERSION).toBe(2);
    expect(SCHEMA_VERSION).toBe(6);
  });
});
```

- [ ] **Step 2: Run them to check they fail**

Run: `npx vitest run src/store/upgrade.test.ts src/store/successor.test.ts`
Expected: FAIL. `./successor` doesn't exist, the successor copy opens at version 2, the words are v1's, and a newer schema is written over.

- [ ] **Step 3: The successor build's versions (D121).** Write `src/store/successor.ts`:

```ts
/**
 * The suite's next release (board D121): a build made with
 * `VITE_ACCEPTANCE_SUCCESSOR=1` has database and schema versions one higher,
 * with an empty migration, so the acceptance suite can serve two real
 * releases at one origin and prove one upgrades from the other (B-21). Every
 * other build, the app's included: 0.
 */
export const SUCCESSOR: 0 | 1 = import.meta.env.VITE_ACCEPTANCE_SUCCESSOR === '1' ? 1 : 0;
```

  - `src/store/db.ts`: import `SUCCESSOR` from `./successor`; `export const DB_VERSION = 2;` becomes `export const DB_VERSION = 2 + SUCCESSOR;`. Its `upgrade` creates whatever store is missing, so version 3 needs nothing more.
  - `src/store/migrate.ts`: import `SUCCESSOR`; `export const SCHEMA_VERSION = 6;` becomes `export const SCHEMA_VERSION = 6 + SUCCESSOR;`. `migrateToV6` stamps `SCHEMA_VERSION` over any marker from 5 up to it, so 6 → 7 is the successor's empty migration.
  - Create `src/vite-env.d.ts` (the app's env types come from `vite/client`, which `tsconfig.app.json` already names):

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Board D121: '1' only in the acceptance suite's successor build. */
  readonly VITE_ACCEPTANCE_SUCCESSOR?: string;
}
```

  `grep -rn "VITE_ACCEPTANCE_SUCCESSOR" src | grep -v "\.test\."` prints `successor.ts` and `vite-env.d.ts`, nothing else.

- [ ] **Step 4: A newer schema stops this copy.** In `src/store/useStore.ts`'s `boot`, the line `const migrated = await migrateToV5(handle);` becomes:

```ts
  // A newer build has been here: this one writes nothing in its shape (D107). Its
  // migrations know only the shapes before it; FitStrong opened again is the newer build.
  const marker = await schemaMarker(handle);
  if (stopped()) { handle.close(); return; }
  if (typeof marker === 'number' && marker > SCHEMA_VERSION) {
    handle.close();
    enterMemory(new StoreFailure('stale', 'FitStrong was updated in another window.'));
    return;
  }
  const migrated = await migrateToV5(handle);
```

  and after `boot`:

```ts
/** The schema marker as stored, or nothing when there is none or it can't be read (`migrateToV5` then says why). */
async function schemaMarker(handle: Db): Promise<unknown> {
  try {
    return (await handle.get<Doc>('settings', 'schemaVersion'))?.value;
  } catch {
    return undefined;
  }
}
```

  with `SCHEMA_VERSION` imported from `./migrate` beside `migrateToV5` if it isn't already.

- [ ] **Step 5: The words, true for each side.** In `storageNotice`:
  - `case 'blocked':` returns (this copy is the newer one: an older connection hasn't let go):

```ts
        return {
          tone: 'warning',
          title: 'Close FitStrong’s other tabs',
          detail: 'Another tab or window still has an older version of FitStrong open, so nothing is being saved here yet. Close the other tabs of FitStrong, and this one carries on by itself.',
        };
```

  - `case 'stale':` returns (this copy is the older one):

```ts
        return {
          tone: 'warning',
          title: 'A newer version of FitStrong is open',
          detail: 'FitStrong is open somewhere else with a newer version. Close this window and open FitStrong again. Nothing is saved here until then; your saved records are safe.',
        };
```

  `review.test.ts`'s "tells the user to close other tabs" (`/close (the )?other tabs/i`) and `useStore.test.ts`'s "waits for a v1 tab still holding the database" (`/other tabs/`) match the new `blocked` words as they are. In `useStore.test.ts`, "lets go at once when another copy upgrades while it is still starting, and asks for a reload" becomes "…, and says to open FitStrong again", its last word check `expect(store.storageNotice()?.detail).toMatch(/reload/i);` becoming `expect(store.storageNotice()?.detail).toMatch(/Close this window and open FitStrong again/);`.

- [ ] **Step 6: Storage lost while the app runs keeps the app, read-only** (D107, Codex P8S-04).
  - Write `src/store/writable.ts`:

```ts
/**
 * Whether this window's storage went read-only while it ran (board D107,
 * Codex P8S-04): another copy upgraded the database under it. Set by the
 * store; read by the movement gates, which import nothing of the store.
 */
let readOnly = false;

export const storageReadOnly = (): boolean => readOnly;

export function setStorageReadOnly(on: boolean): void {
  readOnly = on;
}
```

  - In `src/store/useStore.ts`, import `setStorageReadOnly` from `./writable`; `StoreState` gains `/** Storage was lost while the app ran: every screen stays, nothing more is saved, and nothing new starts (P8S-04). A first open that fails is never this. */ readOnly: boolean;`, which `toState` sets as `readOnly: mode === 'memory' && wentReadOnly`, from `let wentReadOnly = false;`. `leave()`, the one way a working store loses its storage, sets `wentReadOnly = true;` and calls `setStorageReadOnly(true);` before its `enterMemory(…)`; `resetForTests()` sets `wentReadOnly = false;` and calls `setStorageReadOnly(false);`.
  - In `src/session/gate.ts`, import `storageReadOnly` from `@/store/writable`, and:

```ts
/** A start in a window that can't save any more (P8S-04): nothing new starts, and the words say why. */
export const READ_ONLY_REASON = 'FitStrong can’t save in this window any more, so nothing new can start here.';
export const READ_ONLY_RELEASE = 'Close this window and open FitStrong again.';
const readOnlyHold = (mode: Mode): Permission => ({ mode, allowed: false, disposition: 'hold', reasons: [READ_ONLY_REASON], release: READ_ONLY_RELEASE, restrictions: [], needsCheckIn: false });
```

    `arrivalGate` returns `storageReadOnly() ? readOnlyHold(mode) : permission(input, mode)`, and `startGate` `storageReadOnly() ? readOnlyHold(mode) : onScreenPermission(input, mode)`. `liveGate` is unchanged: a walk or a session already under way isn't stopped by it, and says it didn't save when it finishes.
  - In `src/App.tsx`, `const { status, settings, profile } = useStore();` becomes `const { status, settings, profile, readOnly } = useStore();`, and the storage screen's line becomes:

```tsx
  // Only a first open that can't reach the records shows the storage screen. Storage lost while the app
  // runs keeps every screen, its answers and its guidance, read-only (D107, P8S-04).
  if (status === 'unavailable' && !readOnly && !continueUnsaved) return …;
```

    Every screen already says what the store's notice says (the storage banner), so a read-only window names the newer copy, and every save in it says it didn't save.

- [ ] **Step 7: Try again restarts onto a waiting release.** In `src/App.tsx`, import `restartToUpdate` from `@/app/updates`; `StorageUnavailable`'s "Try again" becomes:

```tsx
        {/* With a newer release waiting and this FitStrong's only window, Try again restarts onto it (D107);
            otherwise it reloads, as it always has. */}
        <button type="button" onClick={() => { void restartToUpdate().then(how => { if (how !== 'restarting') window.location.reload(); }); }}
          className="press-feedback min-h-[3.75rem] rounded-xl bg-tint text-[length:var(--text-body)] font-semibold text-on-tint">
          Try again
        </button>
```

  A main action, 60 px tall (J§20.4 rule 1). "Continue without saving" becomes `min-h-12`. `restartToUpdate` puts its cover up while it asks (Task 2), and a restart refused or impossible leaves the reload Try again has always been.

- [ ] **Step 8: Run the store's tests**

Run: `npx vitest run src/store src/session`
Expected: PASS, the new files and every existing case.

- [ ] **Step 9: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/store/useStore.ts src/store/useStore.test.ts src/store/upgrade.test.ts src/store/successor.ts src/store/successor.test.ts src/store/writable.ts src/store/db.ts src/store/migrate.ts src/session/gate.ts src/vite-env.d.ts src/App.tsx
git commit -m "feat: Say plainly when another copy holds a newer database, keep every screen read-only when it happens mid-use, and leave a newer schema alone"
```

---

### Task 4: What a restore takes, refused in plain words before anything is read, and every collection's conflicts (B-26)

**Files:**
- Create: `src/store/limits.ts`, `src/store/limits.test.ts`
- Modify: `src/store/transfer.ts` (`IMPORT_LIMITS` moves to `limits.ts`; `decode` and `parse` refuse in their words and in their order; `encode` says the unpacked size)
- Modify: `src/store/transfer.test.ts`, `src/store/review.test.ts` (the counts' new words; `encode`'s new field)
- Modify: `src/store/useStore.ts` (`exportRecord` warns past a limit)
- Modify: `src/screens/you/RestoreFlow.tsx` (the size before the read; each collection's conflicts, by name)
- Modify: `src/screens/you/DataSheets.tsx` (the backup's warning), `src/screens/you/DataScreen.tsx` ("What a backup can hold")
- Modify: `src/screens/you/summaries.ts`, `src/screens/you/summaries.test.ts` (`previewLines` holds every collection; `conflictLines`)
- Create: `src/screens/you/preview.test.ts` (every collection, through the real preview and merge)

**Interfaces:**
- Consumes: `RECORD_RULES`, `RECORD_STORES`, `type RecordStore` (`src/store/records.ts`, with Plan 7's labels: "walk routes", "meals", "usual meals", "own foods"); `StoreFailure` (`db.ts`); `CollectionCounts`, `ImportPreview`, `previewImport`, `planImport`, `decode`, `encode`, `toTransferDoc` (`transfer.ts`); `migrateData` (`@/services/storage`) and `projectV4` (`migrate.ts`), the legacy conversion; `PreviewLine` and `previewLines` (`summaries.ts`); `type Open` in `DataScreen.tsx` (Plan 4's, with Plan 6's `'erase'`); `BackupBody`'s `Prepared` (`DataSheets.tsx`).
- Produces, in `src/store/limits.ts`:
  - `IMPORT_LIMITS` (D108): `bytes`, the eleven counts, `routePoints: 5_000_000`, `textChars: 100_000`, `depth: 32`. `transfer.ts` re-exports it, so `import { IMPORT_LIMITS } from './transfer'` keeps working;
  - `type CountLimit` (the eleven count names, `keyof CollectionCounts`); `COUNT_NAMES: Record<CountLimit, string>`; `countLabel(name)`;
  - `type Excess` (`bytes` | `unpacked` | `count` | `points` | `text` | `depth`); `refusal(e)`, ending "Nothing was changed."; `exportWarning(e)`; the shorthands `tooLarge(bytes, max?)`, `unpacksTooLarge(max?)`, `tooMany(name, count)`, `tooManyPoints(count)`, `textTooLong(chars)`, `tooDeep()`; `sizeText(bytes)`;
  - `interface ShapeStats { frames: number }`; `shapeExcess(root, stats?)` and `shapeProblem(root, stats?)`, walked with a frame per level and no call stack, its memory bounded by the file-size limit (P8R-13, rejected: see the self-review); `legacyExcess(raw)`; `countExcess(counts)`; `routePoints(routes)`; `exportExcess(doc, { packed, unpacked })`;
  - `interface BackupFile { size; arrayBuffer() }`; `readBackupFile(file, max?): Promise<ArrayBuffer>`;
  - `limitLines(): { label: string; value: string }[]`, the 14 lines Me → Data shows.
- Produces, in `transfer.ts`: `EncodedTransfer.textBytes: number`. In `useStore.ts`: `ExportedRecord.warning?: string`. In `summaries.ts`: `previewLines` also lists workout swaps, Learn progress entries, walk routes, meals, usual meals and own foods; `conflictLines(preview: Pick<ImportPreview, 'conflicts'>): PreviewLine[]`. One plain name for the content-state count everywhere: "Learn progress entries" (K8-11).

**Order of the checks** (D108, Review Focus 5). The file's size, from `File.size`, before a byte is read (`readBackupFile`); its size unpacked (`decode`); then, in `parse`, one walk over the whole raw document for a too-long text or too-deep nesting, a frame per level and no call stack, so no document is deep enough to overflow it; `JSON.parse` has already put the whole document in memory, so the walk adds at most memory in proportion to it, and the file-size limit bounds that; for a legacy backup, its own counts, before `migrateData` and `projectV4` make readings of them; the counts of the document as it now stands, converted ones included; the route points; and only then any record. A hostile file is refused before any of it is read as a record or converted, and nothing is written, because `planImport` throws before `commitChange` begins. Nothing promises a backup fits (Codex P8-17): an export past a limit still holds every record, and says so.

- [ ] **Step 1: Write the failing test** `src/store/limits.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newObservation } from '@/health/observation';
import { emptySnapshot, prepare, type Snapshot } from './snapshot';

// The legacy conversion, counted: a file past a limit must be refused before it is entered (P8-15).
const spies = vi.hoisted(() => ({ migrated: 0, projected: 0 }));
vi.mock('@/services/storage', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/storage')>();
  return { ...actual, migrateData: (...args: Parameters<typeof actual.migrateData>) => { spies.migrated += 1; return actual.migrateData(...args); } };
});
vi.mock('./migrate', async importOriginal => {
  const actual = await importOriginal<typeof import('./migrate')>();
  return { ...actual, projectV4: (...args: Parameters<typeof actual.projectV4>) => { spies.projected += 1; return actual.projectV4(...args); } };
});

const {
  IMPORT_LIMITS, exportExcess, exportWarning, limitLines, readBackupFile, routePoints, shapeExcess, shapeProblem, sizeText,
  textTooLong, tooDeep, tooLarge, tooMany, tooManyPoints, unpacksTooLarge,
} = await import('./limits');
const { decode, encode, planImport, previewImport, toTransferDoc } = await import('./transfer');

const AT = '2026-10-08T09:00:00.000+05:30';
const nested = (levels: number, inner: unknown = 1, wrap: (x: unknown) => unknown = x => [x]) => {
  let value = inner;
  for (let i = 0; i < levels; i++) value = wrap(value);
  return value;
};
const session = (id: string, notes = '') => ({
  id, date: '2026-10-01', dayOfWeek: 'thursday', muscleGroup: 'lower', phase: 'foundation', week: 1,
  status: 'completed', sets: [], startedAt: null, completedAt: null, notes, totalVolume: 0,
});
/** A backup from the previous version of the app (Settings → Export), as `fromLegacyBackup` reads one. */
const legacy = (over: Record<string, unknown> = {}) => ({
  version: 4,
  settings: {
    startDate: '2026-09-28', currentWeight: 82, targetGoal: 'Pain-free back', defaultRestSeconds: 90, useMetric: true, theme: 'system', onboardingComplete: true,
    gymDays: { monday: 'legs', tuesday: 'back', wednesday: 'rest', thursday: 'chest', friday: 'arms', saturday: 'core', sunday: 'rest' },
  },
  sessions: [session('legacy-1')], bodyMetrics: [], personalRecords: [], checkIns: [], focusOverrides: {},
  ...over,
});

beforeEach(() => {
  spies.migrated = 0;
  spies.projected = 0;
});

describe('what a restore takes, in words (B-26, D108)', () => {
  it('sizes a file as Files shows it', () => {
    expect(sizeText(900)).toBe('1 KB');
    expect(sizeText(1_363_149)).toBe('1.3 MB');
    expect(sizeText(IMPORT_LIMITS.bytes)).toBe('128 MB');
    expect(sizeText(129 * 1024 * 1024)).toBe('129 MB');
  });

  it('refuses with the limit, the file’s own figure, and that nothing changed', () => {
    expect(tooLarge(129 * 1024 * 1024)).toBe('That file is too large to restore: it is 129 MB, and a restore takes at most 128 MB. Nothing was changed.');
    expect(unpacksTooLarge()).toBe('That file is too large to restore: it unpacks to over 128 MB, and a restore takes at most 128 MB. Nothing was changed.');
    expect(tooMany('observations', 1_000_001)).toBe('That file holds 10,00,001 readings, and a restore takes at most 10,00,000. Nothing was changed.');
    expect(tooMany('routes', 100_001)).toBe('That file holds 1,00,001 walk routes, and a restore takes at most 1,00,000. Nothing was changed.');
    expect(tooManyPoints(5_020_000)).toBe('That file holds 50,20,000 route points, and a restore takes at most 50,00,000. Nothing was changed.');
    expect(textTooLong(100_001)).toBe('That file holds a text 1,00,001 characters long, and a restore takes none longer than 1,00,000. Nothing was changed.');
    expect(tooDeep()).toBe('That file is built in a way this app never writes. Nothing was changed.');
  });

  it('lists every limit in Me → Data’s words', () => {
    expect(limitLines()).toEqual([
      { label: 'File size', value: '128 MB, packed or unpacked' },
      { label: 'Readings', value: '10,00,000' },
      { label: 'Sessions', value: '1,00,000' },
      { label: 'Check-ins', value: '1,00,000' },
      { label: 'Personal records', value: '10,000' },
      { label: 'Body measurements', value: '1,00,000' },
      { label: 'Workout swaps', value: '1,00,000' },
      { label: 'Learn progress entries', value: '1,00,000' },
      { label: 'Walk routes', value: '1,00,000' },
      { label: 'Meals', value: '2,00,000' },
      { label: 'Usual meals', value: '10,000' },
      { label: 'Own foods', value: '10,000' },
      { label: 'Route points, all routes together', value: '50,00,000' },
      { label: 'Longest single text', value: '1,00,000 characters' },
    ]);
  });
});

describe('the walk over a document (Review Focus 5)', () => {
  it('finds a text too long, or nesting too deep, anywhere, a key included', () => {
    expect(shapeProblem(toTransferDoc(emptySnapshot()))).toBeUndefined();
    expect(shapeProblem({ sessions: [{ notes: 'x'.repeat(100_001) }] })).toBe(textTooLong(100_001));
    expect(shapeProblem({ ['k'.repeat(100_001)]: 1 })).toBe(textTooLong(100_001));
    expect(shapeProblem({ observations: nested(40) })).toBe(tooDeep());
    // Deeper than any call stack: still answered.
    expect(shapeProblem(nested(200_000, 1, x => ({ a: x })))).toBe(tooDeep());
  });

  it('holds a frame per level, not per item, however broad the document (P8-16)', () => {
    const broad = { frames: 0 };
    expect(shapeExcess({ ...toTransferDoc(emptySnapshot()), unknownField: new Array(1_000_000).fill(7) }, broad)).toBeUndefined();
    expect(broad.frames).toBeLessThanOrEqual(3);
    const wide: Record<string, number> = {};
    for (let i = 0; i < 200_000; i++) wide[`k${i}`] = i;
    const keys = { frames: 0 };
    expect(shapeExcess({ ...toTransferDoc(emptySnapshot()), unknownField: wide }, keys)).toBeUndefined();
    expect(keys.frames).toBeLessThanOrEqual(3);
    const deep = { frames: 0 };
    expect(shapeExcess(nested(IMPORT_LIMITS.depth - 1), deep)).toBeUndefined();
    expect(deep.frames).toBe(IMPORT_LIMITS.depth - 1);
  });

  it('reads a broad file with nothing the app knows in it, and changes nothing', () => {
    const broad = { ...toTransferDoc(emptySnapshot()), unknownField: new Array(1_000_000).fill(7) };
    expect(previewImport(broad).ok).toBe(true);
    const base = emptySnapshot();
    const plan = planImport(broad, 'merge', base);
    expect(plan.report.observations + plan.report.sessions + plan.report.checkIns).toBe(0);
    expect(prepare(base, plan.change).next.observations).toEqual([]);
  });

  it('counts every route’s points together, whatever else the file holds', () => {
    expect(routePoints([{ segments: [{ coords: [[1, 2], [3, 4]] }, { coords: [[5, 6]] }] }, { segments: 'damaged' }, null, 7])).toBe(3);
    expect(routePoints(undefined)).toBe(0);
  });
});

describe('a file past a limit is refused before any record is read or converted (B-26, Review Focus 5)', () => {
  const file = (over: Record<string, unknown> = {}) => ({ ...toTransferDoc(emptySnapshot()), ...over });

  it('a file larger than the limit, by its size, before it is read (P8-15)', async () => {
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(8));
    await expect(readBackupFile({ size: IMPORT_LIMITS.bytes + 1, arrayBuffer })).rejects.toThrow(tooLarge(IMPORT_LIMITS.bytes + 1));
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(await readBackupFile({ size: 8, arrayBuffer })).toBeInstanceOf(ArrayBuffer);
  });

  it('bytes handed in past the limit, named by their size', async () => {
    await expect(decode(new Uint8Array(2048), { maxBytes: 1024 })).rejects.toThrow(tooLarge(2048, 1024));
  });

  it('a small gzip that unpacks past the limit', async () => {
    const bomb = new Uint8Array(await new Response(new Blob([new Uint8Array(4 * 1024 * 1024)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    expect(bomb.byteLength).toBeLessThan(64 * 1024);
    await expect(decode(bomb, { maxBytes: 1024 * 1024 })).rejects.toThrow(unpacksTooLarge(1024 * 1024));
  });

  it('one enormous text, named by its length', () => {
    const reading = { id: 'g1', kind: 'glucose', value: 100, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: '2026-10-08T09:00:00+05:30', day: '2026-10-08', note: 'x'.repeat(100_001) };
    expect(previewImport(file({ observations: [reading] }))).toEqual({ ok: false, reason: textTooLong(100_001) });
  });

  it('nesting no app writes', () => {
    expect(previewImport(file({ focusOverrides: { '2026-10-08': nested(40) } }))).toEqual({ ok: false, reason: tooDeep() });
  });

  it('more routes than a restore takes, before any is read', () => {
    expect(previewImport(file({ stores: ['routes'], records: { routes: new Array(100_001).fill(null) } }))).toEqual({ ok: false, reason: tooMany('routes', 100_001) });
  });

  it('more route points than a restore takes, before any route is read', () => {
    const coords = new Array(20_000).fill([12.97, 77.59]);
    const routes = Array.from({ length: 251 }, (_, i) => ({ walkId: `walk-${i}`, segments: [{ coords }] }));
    expect(previewImport(file({ stores: ['routes'], records: { routes } }))).toEqual({ ok: false, reason: tooManyPoints(5_020_000) });
  });

  it('a legacy backup past a limit, a text too long or nesting too deep, before it is converted (P8-15)', () => {
    expect(previewImport(legacy({ sessions: new Array(100_001).fill(session('same')) }))).toEqual({ ok: false, reason: tooMany('sessions', 100_001) });
    expect(previewImport(legacy({ sessions: [session('s1', 'x'.repeat(100_001))] }))).toEqual({ ok: false, reason: textTooLong(100_001) });
    expect(previewImport(legacy({ focusOverrides: { '2026-10-02': nested(40) } }))).toEqual({ ok: false, reason: tooDeep() });
    expect([spies.migrated, spies.projected]).toEqual([0, 0]);
  });

  it('a legacy backup within every limit is converted, a long note no textarea capped included', () => {
    expect(previewImport(legacy({ sessions: [session('s1', 'x'.repeat(50_000))] })).ok).toBe(true);
    expect(spies.migrated).toBeGreaterThan(0);
  });
});

describe('an export past a limit keeps everything, and says so (D108, P8-17)', () => {
  it('names the limit and the record’s own figure, and the same file is refused in the same terms', async () => {
    const lifts = Array.from({ length: IMPORT_LIMITS.personalRecords + 1 }, (_, i) => ({ exerciseId: `exercise-${i}`, weight: 20, reps: 5, date: '2026-10-01', volume: 100 }));
    const doc = toTransferDoc({ ...emptySnapshot(), personalRecords: lifts } as Snapshot, AT);
    const made = await encode(doc);
    const excess = exportExcess(doc, { packed: made.bytes.byteLength, unpacked: made.textBytes });
    expect(excess).toEqual({ kind: 'count', name: 'personalRecords', count: 10_001 });
    expect(exportWarning(excess!)).toBe('This backup holds everything, but it holds 10,001 personal records, and a restore takes at most 10,000, so this version of the app can’t restore it. Keep it: nothing was left out of it.');
    const back = await decode(made.bytes);
    expect((back as { personalRecords: unknown[] }).personalRecords).toHaveLength(10_001);
    expect(previewImport(back)).toEqual({ ok: false, reason: tooMany('personalRecords', 10_001) });
  });

  it('a record within every limit exports, reads back and restores whole', async () => {
    const water = newObservation({ id: 'water-1', kind: 'water', value: 500, scope: 'dayTotal', source: 'manual', at: AT });
    const snap: Snapshot = {
      ...emptySnapshot(),
      observations: [water],
      sessions: [session('s1', 'A steady one')] as unknown as Snapshot['sessions'],
      bodyMetrics: [{ date: '2026-10-01', weight: 82, waist: 96, notes: '' }] as Snapshot['bodyMetrics'],
      content: { 'guide:read:walking': { readAt: AT } },
      records: {
        routes: [], meals: [{ id: 'meal-1', at: AT, day: '2026-10-08', meal: 'lunch', items: [{ kind: 'quick', size: 'normal', name: 'Normal plate' }], level: 'meals', loggedAt: AT, edits: [] }],
        savedMeals: [{ id: 'usual-1', name: 'Weekday lunch', items: [{ kind: 'quick', size: 'normal', name: 'Normal plate' }], savedAt: AT, updatedAt: AT }],
        customFoods: [{ id: 'food-1', name: 'Bhel puri', per: { qty: 1, unit: 'plate' }, createdAt: AT, updatedAt: AT }],
      },
    };
    const doc = toTransferDoc(snap, AT);
    const made = await encode(doc);
    expect(exportExcess(doc, { packed: made.bytes.byteLength, unpacked: made.textBytes })).toBeUndefined();
    const raw = await decode(made.bytes);
    expect(previewImport(raw).ok).toBe(true);
    const restored = prepare(emptySnapshot(), planImport(raw, 'replace', emptySnapshot()).change).next;
    expect(restored.observations.map(o => [o.id, o.value])).toEqual([['water-1', 500]]);
    expect(restored.sessions.map(s => s.id)).toEqual(['s1']);
    expect(restored.content['guide:read:walking']).toEqual({ readAt: AT });
    expect([restored.records.meals.length, restored.records.savedMeals.length, restored.records.customFoods.length]).toEqual([1, 1, 1]);
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/store/limits.test.ts`
Expected: FAIL, "Cannot find module './limits'".

- [ ] **Step 3: Write** `src/store/limits.ts`

```ts
/**
 * What a restore takes (B-26, board D108), in one place. `transfer.ts`
 * refuses a file past any of these before reading its records or converting
 * it; Me → Data lists them in these words; and an export says plainly when
 * the record it writes is past one. Each refusal names the limit and the
 * file's own figure, and says nothing was changed, because nothing was.
 *
 * Sized from a lifetime: a heavy day is about twenty readings, 7,300 a year
 * and under half a million in sixty, about 100 MB of text; 128 MB covers it
 * and stays below what an iPhone's web content process can parse. Route
 * points are bounded by that size too: as this app writes them, 128 MB holds
 * fewer than 50,00,000. No text the app writes comes near 1,00,000
 * characters. None of this promises that every record fits: one past a
 * limit still exports whole, and says so (D108).
 */
import { StoreFailure } from './db';
import { RECORD_RULES, RECORD_STORES, type RecordStore } from './records';

export const IMPORT_LIMITS = {
  bytes: 128 * 1024 * 1024,
  observations: 1_000_000,
  sessions: 100_000,
  checkIns: 100_000,
  personalRecords: 10_000,
  bodyMetrics: 100_000,
  focusOverrides: 100_000,
  contentState: 100_000,
  ...(Object.fromEntries(RECORD_STORES.map(s => [s, RECORD_RULES[s].limit])) as Record<RecordStore, number>),
  /** Every route's points together. */
  routePoints: 5_000_000,
  /** The longest single text anywhere in a file, a key included. */
  textChars: 100_000,
  /** How deep a file's lists and objects nest. This app's own go about 8 deep. */
  depth: 32,
} as const;

export type CountLimit = 'observations' | 'sessions' | 'checkIns' | 'personalRecords' | 'bodyMetrics' | 'focusOverrides' | 'contentState' | RecordStore;

const COUNTS: readonly CountLimit[] = ['observations', 'sessions', 'checkIns', 'personalRecords', 'bodyMetrics', 'focusOverrides', 'contentState', ...RECORD_STORES];

/** What each count is called, in a refusal and in Me → Data. */
export const COUNT_NAMES: Record<CountLimit, string> = {
  observations: 'readings',
  sessions: 'sessions',
  checkIns: 'check-ins',
  personalRecords: 'personal records',
  bodyMetrics: 'body measurements',
  focusOverrides: 'workout swaps',
  // The content-state store, as a backup holds it: what has been read in Learn. This device's own rows
  // (Recently deleted, the lineage, expiry's clock) never travel (D109), so they are never counted here.
  contentState: 'Learn progress entries',
  ...(Object.fromEntries(RECORD_STORES.map(s => [s, RECORD_RULES[s].label.many])) as Record<RecordStore, string>),
};

export const countLabel = (name: CountLimit): string => `${COUNT_NAMES[name].charAt(0).toUpperCase()}${COUNT_NAMES[name].slice(1)}`;

export const NOTHING_CHANGED = 'Nothing was changed.';

const n = (x: number) => x.toLocaleString('en-IN');

/** "1 KB", "1.3 MB", "128 MB": a file's size near enough as Files shows it. */
export function sizeText(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${n(Math.max(1, Math.ceil(bytes / 1024)))} KB`;
  return `${n(Number(mb.toFixed(1)))} MB`;
}

/** What a file, or a record about to be written as one, holds past a limit. */
export type Excess =
  | { kind: 'bytes'; bytes: number; max: number }
  | { kind: 'unpacked'; max: number }
  | { kind: 'count'; name: CountLimit; count: number }
  | { kind: 'points'; count: number }
  | { kind: 'text'; chars: number }
  | { kind: 'depth' };

/** The excess in words, after "it". */
function past(e: Excess): string {
  switch (e.kind) {
    case 'bytes': return `is ${sizeText(e.bytes)}, and a restore takes at most ${sizeText(e.max)}`;
    case 'unpacked': return `unpacks to over ${sizeText(e.max)}, and a restore takes at most ${sizeText(e.max)}`;
    case 'count': return `holds ${n(e.count)} ${COUNT_NAMES[e.name]}, and a restore takes at most ${n(IMPORT_LIMITS[e.name])}`;
    case 'points': return `holds ${n(e.count)} route points, and a restore takes at most ${n(IMPORT_LIMITS.routePoints)}`;
    case 'text': return `holds a text ${n(e.chars)} characters long, and a restore takes none longer than ${n(IMPORT_LIMITS.textChars)}`;
    case 'depth': return 'is built in a way this app never writes';
  }
}

/** A file refused (B-26): "That file holds 10,00,001 readings, and a restore takes at most 10,00,000. Nothing was changed." */
export function refusal(e: Excess): string {
  const lead = e.kind === 'bytes' || e.kind === 'unpacked' ? 'That file is too large to restore: it' : 'That file';
  return `${lead} ${past(e)}. ${NOTHING_CHANGED}`;
}

/** A backup past a limit, said when it is made (D108, P8-17): it still holds every record. */
export function exportWarning(e: Excess): string {
  return `This backup holds everything, but it ${past(e)}, so this version of the app can’t restore it. Keep it: nothing was left out of it.`;
}

export const tooLarge = (bytes: number, max: number = IMPORT_LIMITS.bytes): string => refusal({ kind: 'bytes', bytes, max });
export const unpacksTooLarge = (max: number = IMPORT_LIMITS.bytes): string => refusal({ kind: 'unpacked', max });
export const tooMany = (name: CountLimit, count: number): string => refusal({ kind: 'count', name, count });
export const tooManyPoints = (count: number): string => refusal({ kind: 'points', count });
export const textTooLong = (chars: number): string => refusal({ kind: 'text', chars });
export const tooDeep = (): string => refusal({ kind: 'depth' });

/** Every route's points, from whatever a file holds: a damaged route counts none, and validation refuses it later. */
export function routePoints(routes: unknown): number {
  if (!Array.isArray(routes)) return 0;
  let points = 0;
  for (const route of routes) {
    const segments = (route as { segments?: unknown } | null | undefined)?.segments;
    if (!Array.isArray(segments)) continue;
    for (const segment of segments) {
      const coords = (segment as { coords?: unknown } | null | undefined)?.coords;
      if (Array.isArray(coords)) points += coords.length;
    }
  }
  return points;
}

/** What the walk held: a test's proof that it keeps one frame per level, however broad the document (P8-16). */
export interface ShapeStats {
  /** The most frames it held at once: one per level. */
  frames: number;
}

type Frame = { list: readonly unknown[]; at: number; depth: number } | { object: Record<string, unknown>; keys: readonly string[]; at: number; depth: number };

/**
 * A text too long, or nesting too deep, anywhere in a document (Review Focus
 * 5). One frame per level, each going through its list by index or its
 * object's keys in turn, with no call stack, so no document is deep enough to
 * overflow it (P8-16). `JSON.parse` has already put the whole document in
 * memory, so the walk adds at most memory in proportion to it, which the
 * file-size limit bounds (P8R-13, rejected with that reason).
 */
export function shapeExcess(root: unknown, stats?: ShapeStats): Excess | undefined {
  const look = (value: unknown, depth: number): Excess | Frame | undefined => {
    if (typeof value === 'string') return value.length > IMPORT_LIMITS.textChars ? { kind: 'text', chars: value.length } : undefined;
    if (typeof value !== 'object' || value === null) return undefined;
    if (depth > IMPORT_LIMITS.depth) return { kind: 'depth' };
    return Array.isArray(value) ? { list: value, at: 0, depth } : { object: value as Record<string, unknown>, keys: Object.keys(value), at: 0, depth };
  };
  const first = look(root, 1);
  if (!first || 'kind' in first) return first;
  const stack: Frame[] = [first];
  if (stats) stats.frames = 1;
  while (stack.length > 0) {
    const top = stack[stack.length - 1];
    let child: unknown;
    if ('list' in top) {
      if (top.at >= top.list.length) { stack.pop(); continue; }
      child = top.list[top.at++];
    } else {
      if (top.at >= top.keys.length) { stack.pop(); continue; }
      const key = top.keys[top.at++];
      if (key.length > IMPORT_LIMITS.textChars) return { kind: 'text', chars: key.length };
      child = top.object[key];
    }
    const next = look(child, top.depth + 1);
    if (!next) continue;
    if ('kind' in next) return next;
    stack.push(next);
    if (stats && stack.length > stats.frames) stats.frames = stack.length;
  }
  return undefined;
}

export const shapeProblem = (root: unknown, stats?: ShapeStats): string | undefined => {
  const e = shapeExcess(root, stats);
  return e ? refusal(e) : undefined;
};

/** The first count past its limit. */
export function countExcess(counts: Readonly<Partial<Record<CountLimit, number>>>): Excess | undefined {
  for (const name of COUNTS) {
    const count = counts[name] ?? 0;
    if (count > IMPORT_LIMITS[name]) return { kind: 'count', name, count };
  }
  return undefined;
}

/**
 * A legacy (v4) backup's own counts, before it is converted (P8-15): the
 * conversion makes readings out of its sessions and check-ins, so one past a
 * limit is refused before any of that work begins.
 */
export function legacyExcess(raw: Readonly<Record<string, unknown>>): Excess | undefined {
  const length = (x: unknown) => (Array.isArray(x) ? x.length : 0);
  const overrides = raw.focusOverrides;
  return countExcess({
    sessions: length(raw.sessions),
    checkIns: length(raw.checkIns),
    personalRecords: length(raw.personalRecords),
    bodyMetrics: length(raw.bodyMetrics),
    focusOverrides: typeof overrides === 'object' && overrides !== null ? Object.keys(overrides).length : 0,
  });
}

/** The parts of a backup document the limits read. */
export interface CountedDoc {
  observations: readonly unknown[];
  sessions: readonly unknown[];
  checkIns: readonly unknown[];
  personalRecords: readonly unknown[];
  bodyMetrics: readonly unknown[];
  focusOverrides: Readonly<Record<string, unknown>>;
  contentState?: readonly unknown[];
  records?: Partial<Record<RecordStore, readonly unknown[]>>;
}

/** A record about to be written as a backup, against the same limits a restore applies (D108, P8-17). */
export function exportExcess(doc: CountedDoc, size: { packed: number; unpacked: number }): Excess | undefined {
  if (size.packed > IMPORT_LIMITS.bytes) return { kind: 'bytes', bytes: size.packed, max: IMPORT_LIMITS.bytes };
  if (size.unpacked > IMPORT_LIMITS.bytes) return { kind: 'unpacked', max: IMPORT_LIMITS.bytes };
  const counted = countExcess({
    observations: doc.observations.length,
    sessions: doc.sessions.length,
    checkIns: doc.checkIns.length,
    personalRecords: doc.personalRecords.length,
    bodyMetrics: doc.bodyMetrics.length,
    focusOverrides: Object.keys(doc.focusOverrides).length,
    contentState: doc.contentState?.length ?? 0,
    ...(Object.fromEntries(RECORD_STORES.map(s => [s, doc.records?.[s]?.length ?? 0])) as Record<RecordStore, number>),
  });
  if (counted) return counted;
  const points = routePoints(doc.records?.routes);
  if (points > IMPORT_LIMITS.routePoints) return { kind: 'points', count: points };
  return shapeExcess(doc);
}

/** The part of a `File` a restore reads. */
export interface BackupFile {
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** A chosen file's bytes, refused by its size before a byte of it is read (P8-15). */
export async function readBackupFile(file: BackupFile, max: number = IMPORT_LIMITS.bytes): Promise<ArrayBuffer> {
  if (file.size > max) throw new StoreFailure('invalid', tooLarge(file.size, max));
  return file.arrayBuffer();
}

/** Me → Data's "What a backup can hold", in this order. */
export function limitLines(): { label: string; value: string }[] {
  return [
    { label: 'File size', value: `${sizeText(IMPORT_LIMITS.bytes)}, packed or unpacked` },
    ...COUNTS.map(name => ({ label: countLabel(name), value: n(IMPORT_LIMITS[name]) })),
    { label: 'Route points, all routes together', value: n(IMPORT_LIMITS.routePoints) },
    { label: 'Longest single text', value: `${n(IMPORT_LIMITS.textChars)} characters` },
  ];
}
```

- [ ] **Step 4: Apply them in** `src/store/transfer.ts`:
  - delete `IMPORT_LIMITS` and its doc comment (the reasoning now heads `limits.ts`), and add:

```ts
import {
  IMPORT_LIMITS, countExcess, legacyExcess, refusal, routePoints, shapeExcess, tooLarge, tooManyPoints, unpacksTooLarge, type CountLimit,
} from './limits';

export { IMPORT_LIMITS } from './limits';
```

  - delete `const TOO_LARGE = …`; in `gunzip`, `throw new StoreFailure('invalid', TOO_LARGE);` becomes `throw new StoreFailure('invalid', unpacksTooLarge(max));`; in `decode`, `if (bytes.byteLength > max) throw new StoreFailure('invalid', TOO_LARGE);` becomes `if (bytes.byteLength > max) throw new StoreFailure('invalid', tooLarge(bytes.byteLength, max));`;
  - `EncodedTransfer` gains `/** The JSON's own size, before any gzip: what a restore unpacks it to. */ textBytes: number;`, and `encode` adds `textBytes: json.byteLength` to both the plain and the gzipped result;
  - in `parse`, after `if (!isRecord(raw)) return …;`:

```ts
  // Every text and every level of nesting, before anything in the file is read or converted (B-26, Review Focus 5).
  const shape = shapeExcess(raw);
  if (shape) return { ok: false, reason: refusal(shape) };
```

    and inside `if (raw.format !== TRANSFER_FORMAT) {`, first:

```ts
    // A legacy backup's own counts, before converting it makes readings of them (P8-15).
    const over = legacyExcess(raw);
    if (over) return { ok: false, reason: refusal(over) };
```

  - the counts loop (`for (const [name, n] of Object.entries(counts) …) { if (n > IMPORT_LIMITS[name]) return …; }`) becomes:

```ts
  // The document as it now stands, a legacy one's converted records included.
  const over = countExcess(counts as Record<CountLimit, number>);
  if (over) return { ok: false, reason: refusal(over) };
  const points = routePoints(recordLists.routes);
  if (points > IMPORT_LIMITS.routePoints) return { ok: false, reason: tooManyPoints(points) };
```

- [ ] **Step 5: The old tests' words.** In `src/store/transfer.test.ts`, "refuses a store this build does not know, and more routes than a lifetime holds" expects `expect.stringMatching(/holds 1,00,001 walk routes/)` in place of `/more routes/`. `review.test.ts`'s `/too large/i` cases match the new words as they are. A test that compares `encode`'s whole result with `toEqual` adds `textBytes: expect.any(Number)`.

- [ ] **Step 6: Run the store's tests**

Run: `npx vitest run src/store`
Expected: PASS.

- [ ] **Step 7: The restore reads the size first; the export warns.**
  - `src/screens/you/RestoreFlow.tsx`: import `readBackupFile` from `@/store/limits`; in `read`, `const raw = await decode(await file.arrayBuffer());` becomes `const raw = await decode(await readBackupFile(file));`.
  - `src/store/useStore.ts`: import `exportExcess` and `exportWarning` from `./limits`. `ExportedRecord` gains `/** The record is past a limit a restore applies: it still holds everything (D108). */ warning?: string;`. In `exportRecord`, after `const file = await encode(doc);`:

```ts
      const excess = exportExcess(doc, { packed: file.bytes.byteLength, unpacked: file.textBytes });
```

    and the value becomes `{ ...file, revision: snap.revision, exportedAt, stores: doc.stores ?? [], ...(excess ? { warning: exportWarning(excess) } : {}) }`.
  - `src/screens/you/DataSheets.tsx`: `Prepared` gains `warning?: string`; in `BackupBody`'s effect, `const { bytes, name, type, exportedAt, revision } = made.value;` becomes `const { bytes, name, type, exportedAt, revision, warning } = made.value;` and `setPrepared({ …, version, ...(warning ? { warning } : {}) })`; above the `PrimaryButton`, add `{ready?.warning && <Notice tone="status">{ready.warning}</Notice>}`.

- [ ] **Step 8: Write the failing tests for the preview.** Append to `src/screens/you/summaries.test.ts`, adding `conflictLines` to its import:

```ts
describe('conflicts by collection, in words (B-26)', () => {
  it('says nothing when nothing differs', () => {
    expect(conflictLines({})).toEqual([]);
  });
});
```

And write `src/screens/you/preview.test.ts`:

```ts
/**
 * Every collection a file can hold, through the preview and the merge a
 * restore really makes (B-26, P8-18): what "In this file" lists, what
 * "Records that differ" names, and what each choice keeps.
 */
import { describe, expect, it } from 'vitest';
import { newObservation } from '@/health/observation';
import type { StoredRecord } from '@/store/records';
import { emptySnapshot, prepare, type Snapshot } from '@/store/snapshot';
import { planImport, previewImport, toTransferDoc } from '@/store/transfer';
import { routeRecord } from '@/walk/routeRecord';
import { conflictLines, previewLines } from './summaries';

const AT = '2026-10-01T09:00:00.000+05:30';
const W = 'mgh3k2x1-1a2b3c4d';
const readiness = { outcome: 'green', modifiers: [], back: 'green', nerveFlag: false, reasons: [], actions: [], vigorousLocked: false, capHeavy: false, rpeOnly: true, notices: [] };
const quick = (name: string) => ({ kind: 'quick', size: 'normal', name });

/** One record in every collection, each saying `word`, all stated at the same moment. */
function saying(word: 'here' | 'file', lat: number): Snapshot {
  const route = routeRecord(W, AT, [{ start: 0, end: 20_000, coords: [[lat, 77.59], [lat + 0.001, 77.5905]], ms: [0, 20_000] }]) as unknown as StoredRecord;
  const here = word === 'here';
  return {
    ...emptySnapshot(),
    settings: { walk: { saveRoutes: true, map: 'off' } } as Snapshot['settings'],
    observations: [newObservation({ id: 'water-1', kind: 'water', value: here ? 500 : 750, scope: 'dayTotal', source: 'manual', at: AT })],
    sessions: [{ id: 's1', date: '2026-10-01', dayOfWeek: 'thursday', muscleGroup: 'lower', phase: 'foundation', week: 1, status: 'completed', sets: [], startedAt: null, completedAt: null, notes: word, totalVolume: 0 }] as unknown as Snapshot['sessions'],
    checkIns: [{ date: '2026-10-01', urgentSymptoms: false, news: [], sleep: here ? 'gt7' : '5to7', energy: 4, readiness }] as unknown as Snapshot['checkIns'],
    bodyMetrics: [{ date: '2026-10-01', weight: 82, waist: here ? 96 : 97, notes: '' }] as Snapshot['bodyMetrics'],
    personalRecords: [{ exerciseId: 'goblet-squat', weight: here ? 20 : 24, reps: 8, date: '2026-10-01', volume: here ? 160 : 192 }] as Snapshot['personalRecords'],
    focusOverrides: { '2026-10-02': here ? 'legs' : 'back' } as unknown as Snapshot['focusOverrides'],
    content: { 'guide:read:walking': { readAt: AT, word } },
    records: {
      routes: [route],
      meals: [{ id: 'meal-1', at: AT, day: '2026-10-01', meal: 'lunch', items: [quick(`${word} plate`)], level: 'meals', loggedAt: AT, edits: [] }],
      savedMeals: [{ id: 'usual-1', name: `${word} lunch`, items: [quick('Normal plate')], savedAt: AT, updatedAt: AT }],
      customFoods: [{ id: 'food-1', name: `${word} bhel`, per: { qty: 1, unit: 'plate' }, createdAt: AT, updatedAt: AT }],
    },
  };
}

const here = saying('here', 12.97);
const file = toTransferDoc(saying('file', 12.98), AT, { include: ['routes'] });
const COLLECTIONS = ['observations', 'sessions', 'checkIns', 'bodyMetrics', 'focusOverrides', 'contentState', 'routes', 'meals', 'savedMeals', 'customFoods'] as const;

describe('every collection in a restore’s preview, through the real preview (B-26, P8-18)', () => {
  it('lists what the file holds, workout swaps and Learn progress included', () => {
    const preview = previewImport(file);
    if (!preview.ok) throw new Error(preview.reason);
    const added = ['Sessions', 'Check-ins', 'Body measurements', 'Personal records', 'Workout swaps', 'Learn progress entries', 'Walk routes', 'Meals', 'Usual meals', 'Own foods'];
    expect(previewLines(preview).filter(l => added.includes(l.label))).toEqual(added.map(label => ({ label, count: 1 })));
  });

  it('counts one conflict in each collection that can differ, and none in personal records, which keep the heavier lift', () => {
    const preview = previewImport(file, here);
    if (!preview.ok) throw new Error(preview.reason);
    for (const c of COLLECTIONS) expect(preview.conflicts?.[c], c).toBe(1);
    expect(preview.conflicts?.personalRecords).toBe(0);
    expect(conflictLines(preview).map(l => l.label)).toEqual([
      'Readings', 'Sessions', 'Check-ins', 'Body measurements', 'Workout swaps', 'Learn progress entries', 'Walk routes', 'Meals', 'Usual meals', 'Own foods',
    ]);
  });

  it('keeps this device’s copy of each with keepDevice, and the file’s with takeFile', () => {
    const keep = prepare(here, planImport(file, 'merge', here, { onConflict: 'keepDevice' }).change).next;
    const take = prepare(here, planImport(file, 'merge', here, { onConflict: 'takeFile' }).change).next;
    const said = (s: Snapshot) => [
      s.observations.find(o => o.id === 'water-1')?.value,
      s.sessions[0]?.notes,
      (s.checkIns[0] as unknown as { sleep: string }).sleep,
      s.bodyMetrics[0]?.waist,
      (s.focusOverrides as Record<string, string>)['2026-10-02'],
      (s.content['guide:read:walking'] as { word: string }).word,
      (s.records.routes[0] as unknown as { segments: { coords: number[][] }[] }).segments[0].coords[0][0],
      (s.records.meals[0] as unknown as { items: { name: string }[] }).items[0].name,
      (s.records.savedMeals[0] as unknown as { name: string }).name,
      (s.records.customFoods[0] as unknown as { name: string }).name,
    ];
    expect(said(keep)).toEqual([500, 'here', 'gt7', 96, 'legs', 'here', 12.97, 'here plate', 'here lunch', 'here bhel']);
    expect(said(take)).toEqual([750, 'file', '5to7', 97, 'back', 'file', 12.98, 'file plate', 'file lunch', 'file bhel']);
    // A personal record keeps the heavier lift, whichever is chosen.
    expect([keep, take].map(s => s.personalRecords[0]?.weight)).toEqual([24, 24]);
  });
});
```

Run: `npx vitest run src/screens/you`
Expected: FAIL: `conflictLines` is not exported, and `previewLines` lists neither workout swaps, reading progress nor the record stores.

- [ ] **Step 9: Write them.** In `src/screens/you/summaries.ts`, import `countLabel` and `type CountLimit` from `@/store/limits` and `RECORD_STORES` from `@/store/records`, and:
  - in `previewLines`, the `lines.push(…)` of sessions, check-ins, body measurements and personal records gains, after personal records:

```ts
    { label: 'Workout swaps', count: preview.focusOverrides },
    { label: countLabel('contentState'), count: preview.contentState },
    ...RECORD_STORES.map(store => ({ label: countLabel(store), count: preview.records?.[store] ?? 0 })),
```

  - and add:

```ts
const CONFLICT_ORDER: readonly CountLimit[] = ['observations', 'sessions', 'checkIns', 'personalRecords', 'bodyMetrics', 'focusOverrides', 'contentState', ...RECORD_STORES];

/** Each collection with records both here and in the file that differ, by name (B-26): the merge choice covers all of them. */
export function conflictLines(preview: Pick<ImportPreview, 'conflicts'>): PreviewLine[] {
  const c = preview.conflicts;
  if (!c) return [];
  return CONFLICT_ORDER.filter(name => c[name] > 0).map(name => ({ label: countLabel(name), count: c[name] }));
}
```

Run: `npx vitest run src/screens/you`
Expected: PASS.

- [ ] **Step 10: Show them.** In `src/screens/you/RestoreFlow.tsx`, import `conflictLines` from `./summaries`. Inside the "Records that differ" `Group`, before `<ChoiceRows`:

```tsx
              {conflictLines(preview).map(line => <Row key={line.label} label={line.label} value={line.count.toLocaleString('en-IN')} numeric />)}
```

In `src/screens/you/DataScreen.tsx`:
  - import `ListIcon` from `lucide-react` and `limitLines` from `@/store/limits`; `Open` gains `'limits'`;
  - in the Backups group, after "Restore from a backup":

```tsx
        <Row onClick={() => setOpen('limits')} icon={<ListIcon />} label="What a backup can hold" detail="A file past these is refused, and nothing changes." chevron />
```

  - beside the other sheets:

```tsx
      <Sheet open={open === 'limits'} onOpenChange={next => setOpen(next ? 'limits' : undefined)} title="What a backup can hold" detent="large">
        <Group footer="A file past any of these is refused before anything in it is read, and nothing on this device changes. A backup made of a record past one still holds everything, and says so when it’s made.">
          {limitLines().map(line => <Row key={line.label} label={line.label} value={line.value} numeric />)}
        </Group>
      </Sheet>
```

- [ ] **Step 11: Check by eye.** `npm run dev`, at 428×926 and 320×568, 100% and 200% text:
  - Me → Data → "What a backup can hold": 14 rows, each value beside or under its label;
  - restore a file whose readings differ from this device's: "Records that differ" names "Readings" and the count, above the choice.

- [ ] **Step 12: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/store/limits.ts src/store/limits.test.ts src/store/transfer.ts src/store/transfer.test.ts src/store/review.test.ts src/store/useStore.ts src/screens/you
git commit -m "feat: Refuse a file past a published limit before reading or converting it, warn on such an export, and name every collection's conflicts"
```

---

### Task 5: Recently deleted: one entry per deletion, kept 7 days, restored under fresh ids with its references and its order (B-04, B-05)

**Files:**
- Create: `src/store/recent.ts`, `src/store/recent.test.ts`, `src/store/recent.store.test.ts`
- Modify: `src/store/snapshot.ts` (`Change.observations.keepSeq`)
- Modify: `src/health/observation.ts`, `src/health/observation.test.ts` (`Observation.restoredFrom`; `Observation.order`, `nextOrder`, and `compareStatements` reading it, P8R-06)
- Modify: `src/walk/routeRecord.ts` (`RouteRecord.restoredFrom`), `src/food/types.ts` (`CustomFood.restoredFrom`), `src/types/index.ts` (`WorkoutSession.restoredFrom`)
- Modify: `src/store/useStore.ts` (`deleteRecord`, `restoreDeleted`, `expireDeleted`, and expiry at start, on return and on time; `Mutation.timed`, planned again at its commit; `update`'s `content`, `entry`, `restored`, `edit`, and `removeObservations` read from what is stored; `eraseRoutes` clears every carrier)
- Modify: `src/store/transfer.ts` (this device's own rows never in or out, and its lineage and expiry's clock kept through a Replace; `settings.deleted.recent` stripped; a merge reads a file through this device's lineage; `isSessionRecord` reads `restoredFrom`)
- Modify: `src/components/checkin/pending.ts`, `src/components/checkin/pending.test.ts` (`takenOut`, `withReadingPutBack`, `KeptReading`; a check-in reading's entry; `restoreCheckInReading` puts its rows back)
- Create: `src/screens/workout/deletion.ts`; Modify: `src/screens/workout/records.ts`, `records.test.ts` (`withWorkoutBack`)

**Interfaces:**
- Consumes: `prepare`, `Change`, `Snapshot` (`src/store/snapshot.ts`; `prepare` already drops a measurement's deletion record when a row with that measurement is put again, and keeps every id's); `RECORD_RULES` (with Plan 6's `keeps`), `recordKey`, `recordProblem` (`records.ts`); `observationProblem`, `checkInDayOf`, `bpReadingId`, `isBpKind` (`src/health/observation.ts`); `bpPartialId` (`src/engine/readiness.ts`); `freshId`, `nowAt`, `enqueue`, `update`, `getState` (`useStore.ts`); `newWalkId` (`src/walk/plan.ts`); Plan 6's `eraseRoutes` (one transaction across routes, journals, buffers, a live walk and the other tabs, D93) and `settings.walk.routesErasedAt`; Plan 7's `CustomItem` (`kind: 'custom'`, `customId`, its own snapshot of the food, per Plan 7's fix); `withoutWorkout`, `repRecords` (`src/screens/workout/records.ts`); `generateId` (`@/lib/utils`).
- Produces, in `src/store/recent.ts`:
  - `RECENT_DAYS = 7`, `RECENT_MS`, `RECENT_PREFIX = 'recent:'`, `LINEAGE_PREFIX = 'lineage:'`, `RECENT_CLOCK = 'recent-clock'`;
  - `type RecentKind = 'reading' | 'pressure' | 'walk' | 'meal' | 'usualMeal' | 'ownFood' | 'session' | 'checkInReading'`;
  - `interface RecentDeletion { id; at; kind; of; observations?; records?; session?; day?; kept? }`;
  - `type DeleteRequest = { kind: 'reading'; id } | { kind: 'pressure'; readingId } | { kind: 'walk'; walkId } | { kind: 'meal'; id } | { kind: 'usualMeal'; id } | { kind: 'ownFood'; id }`;
  - `interface Restored { kind: RecentKind; id: string }`;
  - `recentKey(id)`, `isRecentKey(key)`, `lineageKey(ref)`, `isLocalKey(key)`, `asRecent(value)`, `recentEntries(content, now)`, `restorable(content, id, now)`, `staleKeys(content, now)`, `expiryPlan(content, now)`, `nextExpiry(content)`;
  - `planDeletion(request, base, meta: { entry; at })`, `planRestore(entryId, base, fresh: { stem; walkId }, now)`;
  - `sessionEntry(session, meta, observations?)`, `checkInReadingEntry(meta, day, kept, observations)`;
  - `deviceHistory(content)`: the lineage and expiry's clock, which a Replace keeps (P8S-08);
  - `recentWithoutRoutes(content)`, `withoutRecentCarrier(settings)`;
  - `canonical(lineage, ref)`, `lineageIn(content)`, `throughLineage(file, lineage)`;
  - the refusals `CHECK_IN_READING`, `NOT_RECENT`, `OWN_SCREEN`.
- Produces, in `useStore.ts`: `deleteRecord(request): Promise<StoreResult<string>>` (the entry's id); `restoreDeleted(entryId): Promise<StoreResult<Restored>>`; `expireDeleted(): Promise<StoreResult>`; `UpdateOptions.content(base)`, `.entry`, `.restored`, `.edit`, and `.removeObservations` as a list or a function of what is stored; `Mutation.edit?: false`; `Mutation.timed?: true`.
- Produces, in `src/health/observation.ts`: `Observation.order?: number`; `nextOrder(now?)`.
- Produces, in `pending.ts`: `type KeptReading`; `takenOut(record, r)`; `withReadingPutBack(record, kept)`; `removeCheckInReading(r, ids, deps, recent?)`; `restoreCheckInReading(entry, deps)`; `ALREADY_BACK`, `NEWER_STAYS`; `CorrectionResult.unchanged?: 'already' | 'newer'`.
- Produces, in `src/screens/workout/`: `withWorkoutBack(data, session, id, painAfter?)` (`records.ts`); `deleteWorkout(sessionId)`, `restoreWorkout(entryId)` (`deletion.ts`).

**What a deletion takes, and what a restore rewrites** (D110, D111):
- a reading or a day-total entry: itself. Back under a fresh id with its own `at`, `editedAt`, `order` and `seq`, so two statements said at the same moment keep their order here and on every device a backup takes them to (Review Focus 2, P8R-06). Deleted on its own, a walk's pain rating or a session's comes back naming the walk or session that bears its record now, through this device's lineage, or standing alone when that is gone (P8R-05);
- a blood pressure reading: both halves, back under a new reading id: halves `reading-<stem>:<kind>`, context `bp:reading-<stem>`;
- a walk: everything that belongs to it, as one entry: its measured records, the pain and energy recorded with it (`walk:<id>`), its route and its journal. Back under a new walk id: every record renamed `<new>:…` with its context `walk:<new>`, the route rekeyed with `restoredFrom` unless "Erase all routes" ran after the walk began, and the renaming kept as this device's lineage, `lineage:walk:<old>`;
- a meal, a usual meal or an own food: itself alone. Each meal keeps its own copy of an own food (Plan 7's fix), so a food's deletion changes no meal. Back as `meal-<stem>`, `usual-<stem>` or `food-<stem>` with `restoredFrom`; an own food names itself again in every meal and usual meal that named it, its earlier versions included, with lineage `lineage:customFood:<old>`; a meal names, through the lineage, the food that came back for one it named;
- a session or manual workout: the session and everything recorded with it (`session:<id>`), its pain score as it is now, corrected since or not; its personal records worked out again. Back under a fresh id with `restoredFrom`, its records moved to the new id as they were, their `editedAt` and `order` kept, and the session saying the same pain score, so nothing works the old one out again from the session (Codex P8S-06); lineage `lineage:session:<old>` (`deletion.ts`, through `update`);
- a check-in's reading or pain score: out of its check-in and the series, with where it stood; back into its check-in where it stood, and its rows back into the series under fresh ids with `restoredFrom` (P8R-03), a blood pressure's under a check-in event `checkInDayOf` reads as that day's (letters and digits only, Codex P8S-07). What was measured is its identity, apart from any row's id (R5-01): `prepare` drops the measurement's deletion record as its row returns, and keeps the old id's.

A route is never deleted on its own here: deleting one walk's route is Plan 6's confirmed, permanent erase (B-05's own operation), so a route only ever comes back with its walk (D111, P8-08).

**This device's own rows** (D109; Codex P8R-04, P8R-14, P8S-08, P8S-09; Kiro K8-01, K8-06). Recently deleted's entries (`recent:<id>`), the lineage (`lineage:<old>`) and expiry's clock (`recent-clock`) are content-state rows that never leave the device: a backup leaves them out, and an import never takes them. Merge touches none of them. Replace clears Recently deleted's entries, the recovery payloads, with the records they describe, and keeps the lineage and the clock, which are this device's history, so no import, Replace included, can erase a renaming this device made (P8S-08). Expiry happens in one place, `expiryPlan`, run at every start, on every return and, while the page runs, at the moment the next entry's 7 days end; never while the clock reads earlier than the last time it ran. Every restore, of every kind, asks `restorable` as its transaction commits: a restore is `timed`, so the store plans it again at its commit rather than reusing a plan made earlier, and an entry whose 7 days end while it waits behind another write is refused, with nothing restored (P8S-09).

- [ ] **Step 1: Write the failing test** `src/store/recent.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { entryFor, summariseDay } from '@/health/aggregate';
import { newObservation, type Observation } from '@/health/observation';
import { routeRecord } from '@/walk/routeRecord';
import type { Records, RecordStore, StoredRecord } from './records';
import { emptySnapshot, prepare, type Change, type Snapshot } from './snapshot';
import { planImport, toTransferDoc } from './transfer';
import {
  NOT_RECENT, OWN_SCREEN, RECENT_CLOCK, RECENT_MS, canonical, expiryPlan, lineageIn, lineageKey, nextExpiry, planDeletion, planRestore,
  recentEntries, recentKey, recentWithoutRoutes, restorable, sessionEntry, staleKeys, withoutRecentCarrier, type DeleteRequest,
} from './recent';

const NOW = Date.parse('2026-10-08T09:00:00+05:30');
const AT = '2026-10-08T09:00:00.000+05:30';
const fresh = { stem: 'fresh1', walkId: 'mgh9zzzz-99999999' };
const apply = (base: Snapshot, change: Change) => prepare(base, change).next;
const holding = (observations: Observation[], records: Partial<Records> = {}) => apply(emptySnapshot(), {
  observations: { put: observations },
  records: Object.fromEntries(Object.entries(records).map(([store, rows]) => [store as RecordStore, { put: rows ?? [] }])),
});
const del = (base: Snapshot, request: DeleteRequest, entry = 'deleted-1', at = AT) => planDeletion(request, base, { entry, at });
const glucose = (id: string, value: number, at = '2026-10-08T08:00:00+05:30', context?: string) =>
  newObservation({ id, kind: 'glucose', value, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at, ...(context ? { context } : {}) });
const water = (id: string, value: number, at: string, editedAt?: string) =>
  ({ ...newObservation({ id, kind: 'water', value, scope: 'dayTotal', source: 'manual', at }), ...(editedAt ? { editedAt } : {}) });

const W = 'mgh3k2x1-1a2b3c4d';
const measured = (kind: 'walkDuration' | 'movementMinutes') =>
  newObservation({ id: `${W}:s0:${kind}`, kind, value: 20, scope: 'sessionObserved', source: 'measured', at: AT, coverageMs: 1_200_000, context: `walk:${W}` });
const walked = [measured('walkDuration'), measured('movementMinutes')];
const energy = newObservation({ id: `${W}:activeEnergy`, kind: 'activeEnergy', value: 85, scope: 'sessionObserved', source: 'measured', at: AT, coverageMs: 1_200_000, context: `walk:${W}` });
const pain = newObservation({ id: `${W}:backPain`, kind: 'backPain', value: 2, scope: 'pointInTime', source: 'manual', at: '2026-10-08T09:25:00+05:30', context: `walk:${W}` });
const route = routeRecord(W, AT, [{ start: NOW, end: NOW + 20_000, coords: [[12.97, 77.59], [12.971, 77.5905]], ms: [0, 20_000] }])! as unknown as StoredRecord;
const contexts = (s: Snapshot, kind: string) => s.observations.filter(o => o.kind === kind).map(o => o.context);

describe('a reading deleted, then restored (B-04, B-05, D110)', () => {
  it('goes at once, waits 7 days, and comes back under a fresh id, its deletion record kept', () => {
    const base = holding([glucose('g1', 62)]);
    const { change, entry } = del(base, { kind: 'reading', id: 'g1' });
    const gone = apply(base, change);
    expect(gone.observations).toEqual([]);
    expect(gone.settings?.deleted?.observations).toEqual(['g1']);
    expect(entry).toMatchObject({ kind: 'reading', of: 'g1', observations: [expect.objectContaining({ id: 'g1', value: 62 })] });
    expect(recentEntries(gone.content, NOW)).toEqual([entry]);
    const r = planRestore(entry.id, gone, fresh, NOW + 60_000);
    expect(r.restored).toEqual({ kind: 'reading', id: 'fresh1' });
    const back = apply(gone, r.change);
    expect(back.observations).toEqual([expect.objectContaining({ id: 'fresh1', value: 62, at: base.observations[0].at, restoredFrom: 'g1' })]);
    expect(back.settings?.deleted?.observations).toEqual(['g1']);
    expect(recentEntries(back.content, NOW)).toEqual([]);
  });

  it('comes back once, and not after 7 days, whoever asks (P8R-14)', () => {
    const base = holding([glucose('g1', 62)]);
    const { change, entry } = del(base, { kind: 'reading', id: 'g1' });
    const gone = apply(base, change);
    expect(restorable(gone.content, entry.id, NOW + RECENT_MS - 1)).toEqual(entry);
    expect(restorable(gone.content, entry.id, NOW + RECENT_MS)).toBeUndefined();
    const back = apply(gone, planRestore(entry.id, gone, fresh, NOW).change);
    expect(() => planRestore(entry.id, back, fresh, NOW)).toThrow(NOT_RECENT);
    expect(() => planRestore(entry.id, gone, fresh, NOW + RECENT_MS)).toThrow(NOT_RECENT);
  });

  it('leaves a check-in’s own reading to its check-in, and a session to its own screen', () => {
    const base = holding([glucose('c1', 112, '2026-10-08T07:30:00+05:30', 'checkIn:2026-10-08')]);
    expect(() => del(base, { kind: 'reading', id: 'c1' })).toThrow(/belongs to a check-in/);
    const s = apply(emptySnapshot(), { content: { put: { [recentKey('deleted-9')]: sessionEntry({ id: 's1' } as never, { entry: 'deleted-9', at: AT }) } } });
    expect(() => planRestore('deleted-9', s, fresh, NOW)).toThrow(OWN_SCREEN);
  });
});

describe('a blood pressure reading, a walk and an own food, each with what belongs to it (D110)', () => {
  it('puts a reading’s two halves back together, under a new reading id', () => {
    const halves = (['bloodPressureSystolic', 'bloodPressureDiastolic'] as const).map((kind, i) =>
      newObservation({ id: `reading-r1:${kind}`, kind, value: [186, 98][i], scope: 'pointInTime', source: 'manual', at: AT, context: 'bp:reading-r1' }));
    const base = holding(halves);
    const { change, entry } = del(base, { kind: 'pressure', readingId: 'reading-r1' });
    const gone = apply(base, change);
    expect(gone.observations).toEqual([]);
    const r = planRestore(entry.id, gone, fresh, NOW);
    expect(r.restored).toEqual({ kind: 'pressure', id: 'reading-fresh1' });
    expect(apply(gone, r.change).observations.map(o => [o.id, o.context, o.value, o.restoredFrom]).sort()).toEqual([
      ['reading-fresh1:bloodPressureDiastolic', 'bp:reading-fresh1', 98, 'reading-r1:bloodPressureDiastolic'],
      ['reading-fresh1:bloodPressureSystolic', 'bp:reading-fresh1', 186, 'reading-r1:bloodPressureSystolic'],
    ]);
  });

  it('takes a walk with its pain, energy, route and journal as one entry, and restores all of it under a new walk id', () => {
    const base = holding([...walked, energy, pain], { routes: [route] });
    const { change, entry } = del(base, { kind: 'walk', walkId: W });
    expect(change.journal).toEqual({ remove: [W] });
    const gone = apply(base, change);
    expect(gone.observations).toEqual([]);
    expect(gone.records.routes).toEqual([]);
    expect(entry.observations?.map(o => o.id).sort()).toEqual([`${W}:activeEnergy`, `${W}:backPain`, `${W}:s0:movementMinutes`, `${W}:s0:walkDuration`]);
    expect(entry.records?.routes).toEqual([route]);
    const r = planRestore(entry.id, gone, fresh, NOW);
    expect(r.restored).toEqual({ kind: 'walk', id: fresh.walkId });
    const back = apply(gone, r.change);
    expect(back.observations.map(o => [o.id, o.context, o.restoredFrom]).sort()).toEqual([
      [`${fresh.walkId}:activeEnergy`, `walk:${fresh.walkId}`, `${W}:activeEnergy`],
      [`${fresh.walkId}:backPain`, `walk:${fresh.walkId}`, `${W}:backPain`],
      [`${fresh.walkId}:s0:movementMinutes`, `walk:${fresh.walkId}`, `${W}:s0:movementMinutes`],
      [`${fresh.walkId}:s0:walkDuration`, `walk:${fresh.walkId}`, `${W}:s0:walkDuration`],
    ]);
    // The route under the walk it belongs to now, saying where it came from; the original's deletion record kept (P8-08).
    expect(back.records.routes).toEqual([expect.objectContaining({ walkId: fresh.walkId, restoredFrom: W })]);
    expect(back.settings?.deleted?.records?.routes).toEqual([W]);
    expect(lineageIn(back.content)).toEqual({ [`walk:${W}`]: `walk:${fresh.walkId}` });
  });

  it('restores an own food under a fresh id, naming it again in the meals and usual meals that named it', () => {
    // Each item with its own snapshot of the food, as Plan 7's fix stores it (board D134).
    const custom = (customId: string) => ({ kind: 'custom', customId, count: 1, name: 'Bhel puri', per: { qty: 1, unit: 'plate' }, basis: {}, version: AT });
    const food = { id: 'food-1', name: 'Bhel puri', per: { qty: 1, unit: 'plate' }, createdAt: AT, updatedAt: AT };
    const meal = { id: 'meal-1', at: AT, day: '2026-10-08', meal: 'lunch', items: [custom('food-1')], level: 'meals', loggedAt: AT, edits: [] };
    const usual = { id: 'usual-1', name: 'Snack', items: [custom('food-1')], savedAt: AT, updatedAt: AT };
    const base = holding([], { customFoods: [food], meals: [meal], savedMeals: [usual] });
    const older = toTransferDoc(base, AT);
    const { change, entry } = del(base, { kind: 'ownFood', id: 'food-1' });
    expect(Object.keys(entry.records ?? {})).toEqual(['customFoods']);
    const gone = apply(base, change);
    // A meal keeps its own copy of the food, so it stays as it was.
    expect(gone.records.meals).toEqual([meal]);
    const back = apply(gone, planRestore(entry.id, gone, fresh, NOW).change);
    const named = (s: Snapshot, store: 'meals' | 'savedMeals') => (s.records[store][0].items as { customId: string }[])[0].customId;
    expect(back.records.customFoods).toEqual([expect.objectContaining({ id: 'food-fresh1', restoredFrom: 'food-1' })]);
    expect([named(back, 'meals'), named(back, 'savedMeals')]).toEqual(['food-fresh1', 'food-fresh1']);
    expect(lineageIn(back.content)).toEqual({ 'customFood:food-1': 'customFood:food-fresh1' });
    // An older backup's meal still names the old id: the merge reads it through this device's lineage (P8-09).
    for (const onConflict of ['keepDevice', 'takeFile'] as const) {
      const merged = apply(back, planImport(older, 'merge', back, { onConflict }).change);
      expect(merged.records.customFoods.map(f => f.id)).toEqual(['food-fresh1']);
      expect(named(merged, 'meals')).toBe('food-fresh1');
    }
  });
});

describe('a merge after a restore (Review Focus 2, P8-08, P8-09, P8R-04)', () => {
  it('leaves one copy of a reading, from an older backup or a newer one', () => {
    const base = holding([glucose('g1', 62)]);
    const older = toTransferDoc(base);
    const { change, entry } = del(base, { kind: 'reading', id: 'g1' });
    const gone = apply(base, change);
    const newer = toTransferDoc(gone);
    const back = apply(gone, planRestore(entry.id, gone, fresh, NOW).change);
    for (const onConflict of ['keepDevice', 'takeFile'] as const) {
      expect(apply(back, planImport(older, 'merge', back, { onConflict }).change).observations.map(o => o.id)).toEqual(['fresh1']);
      expect(apply(back, planImport(newer, 'merge', back, { onConflict }).change).observations.map(o => o.id)).toEqual(['fresh1']);
    }
  });

  it('keeps a restored walk, its route and its pain on it, against older, corrected, deletion-bearing and unrelated backups, either policy, after repeated cycles', () => {
    // The pain rating went and came back with its walk, so an older file's copy of it, corrected or not, is the deleted original: kept out by its deletion record.
    const base = holding([...walked, pain], { routes: [route] });
    const older = toTransferDoc(base, AT, { include: ['routes'] });
    // The same older backup, its pain rating corrected after everything here.
    const corrected = { ...older, observations: older.observations.map(o => (o.id === pain.id ? { ...o, value: 3, editedAt: '2026-10-09T09:00:00.000+05:30' } : o)) };
    let s = base;
    let walkId = W;
    let deletionBearing = older;
    for (const [i, next] of ['mgh9zzzz-99999991', 'mgh9zzzz-99999992'].entries()) {
      const d = del(s, { kind: 'walk', walkId }, `deleted-${i}`);
      s = apply(s, d.change);
      deletionBearing = toTransferDoc(s, AT, { include: ['routes'] });
      s = apply(s, planRestore(d.entry.id, s, { stem: `fresh${i}`, walkId: next }, NOW).change);
      walkId = next;
    }
    expect(canonical(lineageIn(s.content), `walk:${W}`)).toBe(`walk:${walkId}`);
    // A file that knows of some other deletion, and nothing of this walk's renaming (P8R-04).
    const unrelated = { ...toTransferDoc(emptySnapshot()), settings: { deleted: { observations: ['someone-else'] } } };
    for (const onConflict of ['keepDevice', 'takeFile'] as const) {
      const after = apply(s, planImport(unrelated, 'merge', s, { onConflict }).change);
      expect(lineageIn(after.content)).toEqual(lineageIn(s.content));
      for (const file of [older, corrected, deletionBearing]) {
        const merged = apply(after, planImport(file, 'merge', after, { onConflict }).change);
        expect(contexts(merged, 'backPain')).toEqual([`walk:${walkId}`]);
        expect(merged.observations.filter(o => o.scope === 'sessionObserved').map(o => o.context)).toEqual([`walk:${walkId}`, `walk:${walkId}`]);
        expect(merged.records.routes.map(r => r.walkId)).toEqual([walkId]);
      }
    }
    const kept = apply(s, planImport(corrected, 'merge', s, { onConflict: 'takeFile' }).change);
    expect(kept.observations.filter(o => o.kind === 'backPain')).toEqual([expect.objectContaining({ value: 2, context: `walk:${walkId}` })]);
  });
});

describe('a dependent deleted on its own, restored after its walk or before it (P8R-05)', () => {
  // Pain rated after the walk, deleted first; then the walk.
  const twoDeletes = () => {
    let s = holding([...walked, pain], { routes: [route] });
    const p = del(s, { kind: 'reading', id: pain.id }, 'deleted-pain');
    s = apply(s, p.change);
    const w = del(s, { kind: 'walk', walkId: W }, 'deleted-walk');
    s = apply(s, w.change);
    return { s, pain: p.entry.id, walk: w.entry.id };
  };

  it('restored after its walk, it names the walk that came back', () => {
    let { s, pain: p, walk: w } = twoDeletes();
    s = apply(s, planRestore(w, s, fresh, NOW).change);
    s = apply(s, planRestore(p, s, { ...fresh, stem: 'pain-back' }, NOW).change);
    expect(contexts(s, 'backPain')).toEqual([`walk:${fresh.walkId}`]);
    // And it goes with that walk when it is deleted again, and comes back with it.
    const again = del(s, { kind: 'walk', walkId: fresh.walkId }, 'deleted-again');
    expect(again.entry.observations?.some(o => o.kind === 'backPain')).toBe(true);
    s = apply(apply(s, again.change), planRestore('deleted-again', apply(s, again.change), { stem: 'x', walkId: 'mgh9zzzz-99999993' }, NOW).change);
    expect(contexts(s, 'backPain')).toEqual(['walk:mgh9zzzz-99999993']);
  });

  it('restored while its walk is still deleted, it stands alone, and stays so when the walk comes back', () => {
    let { s, pain: p, walk: w } = twoDeletes();
    s = apply(s, planRestore(p, s, { ...fresh, stem: 'pain-back' }, NOW).change);
    expect(contexts(s, 'backPain')).toEqual([undefined]);
    expect(s.observations.find(o => o.kind === 'backPain')).toMatchObject({ id: 'pain-back', restoredFrom: pain.id, value: 2 });
    s = apply(s, planRestore(w, s, fresh, NOW).change);
    expect(contexts(s, 'backPain')).toEqual([undefined]);
    expect(s.observations.filter(o => o.context === `walk:${fresh.walkId}`)).toHaveLength(2);
  });
});

describe('two day totals said at the same moment, and one Undo (Review Focus 2, P8-10)', () => {
  // A past day's taps share its stand-in time, so only the order they were said in tells them apart.
  const PAST = '2026-10-06T12:00:00.000+05:30';
  const total = (s: Snapshot) => entryFor(summariseDay('2026-10-06', s.observations), 'water')?.total;
  for (const edited of [undefined, '2026-10-07T08:00:00.000+05:30']) {
    for (const order of [['w2', 'w1'], ['w1', 'w2']] as const) {
      it(`keeps the day at what was said last, restoring ${order.join(' then ')}${edited ? ', both corrected at the same moment' : ''}`, () => {
        // Two commits, so two places in the order: 250 ml said first, 500 ml after it.
        let s = apply(emptySnapshot(), { observations: { put: [water('w1', 250, PAST, edited)] } });
        s = apply(s, { observations: { put: [water('w2', 500, PAST, edited)] } });
        expect(total(s)).toBe(500);
        const entries: Record<string, string> = {};
        for (const id of ['w2', 'w1']) {
          const d = del(s, { kind: 'reading', id }, `deleted-${id}`);
          s = apply(s, d.change);
          entries[id] = d.entry.id;
        }
        expect(total(s)).toBeUndefined();
        s = apply(s, planRestore(entries[order[0]], s, { ...fresh, stem: `back-${order[0]}` }, NOW).change);
        s = apply(s, planRestore(entries[order[1]], s, { ...fresh, stem: `back-${order[1]}` }, NOW).change);
        expect(total(s)).toBe(500);
        // And on a device that has neither, through a backup: the file keeps that order.
        const elsewhere = apply(emptySnapshot(), planImport(toTransferDoc(s), 'merge', emptySnapshot()).change);
        expect(total(elsewhere)).toBe(500);
      });
    }
  }

  it('on a device that already holds the later one, the earlier, restored elsewhere, stays the earlier, either policy (P8R-06)', () => {
    const w1 = water('w1', 250, PAST);
    const w2 = water('w2', 500, PAST);
    // Elsewhere: both said, then the earlier deleted and restored under a fresh id.
    let there = apply(apply(emptySnapshot(), { observations: { put: [w1] } }), { observations: { put: [w2] } });
    const d = del(there, { kind: 'reading', id: 'w1' }, 'deleted-w1');
    there = apply(there, d.change);
    there = apply(there, planRestore(d.entry.id, there, { ...fresh, stem: 'w1-back' }, NOW).change);
    // Here: only the later one, stored long before the file arrives, so the file's copy gets a later commit.
    const here = apply(emptySnapshot(40), { observations: { put: [w2] } });
    for (const onConflict of ['keepDevice', 'takeFile'] as const) {
      const merged = apply(here, planImport(toTransferDoc(there), 'merge', here, { onConflict }).change);
      expect(merged.observations.find(o => o.id === 'w1-back')!.seq!).toBeGreaterThan(merged.observations.find(o => o.id === 'w2')!.seq!);
      expect(total(merged)).toBe(500);
    }
  });
});

describe('how long (D109, P8-12, K8-01)', () => {
  it('keeps every deletion for its 7 days, however many', () => {
    let s = holding(Array.from({ length: 150 }, (_, i) => glucose(`g${i}`, 100 + i)));
    for (let i = 0; i < 150; i++) s = apply(s, del(s, { kind: 'reading', id: `g${i}` }, `deleted-${i}`, new Date(NOW + i * 1000).toISOString()).change);
    expect(recentEntries(s.content, NOW + 150_000)).toHaveLength(150);
    expect(expiryPlan(s.content, NOW + 150_000)).toBeUndefined();
    expect(nextExpiry(s.content)).toBe(NOW + RECENT_MS);
  });

  it('ends what is past 7 days, and anything unreadable, and moves its clock on with them', () => {
    const content = {
      [recentKey('old')]: { id: 'old', at: new Date(NOW - RECENT_MS).toISOString(), kind: 'reading', of: 'g' },
      [recentKey('new')]: { id: 'new', at: AT, kind: 'reading', of: 'g' },
      [recentKey('bad')]: { kind: 'something' },
      [lineageKey('walk:W')]: { to: 'walk:W2', at: AT },
    };
    expect(staleKeys(content, NOW).sort()).toEqual([recentKey('bad'), recentKey('old')]);
    expect(expiryPlan(content, NOW)).toEqual({ remove: [recentKey('old'), recentKey('bad')].sort(), put: { [RECENT_CLOCK]: { at: NOW } } });
  });

  it('never ends anything while the clock reads earlier than the last time it ran (K8-01)', () => {
    const content = {
      [recentKey('old')]: { id: 'old', at: new Date(NOW - RECENT_MS - 60_000).toISOString(), kind: 'reading', of: 'g' },
      [RECENT_CLOCK]: { at: NOW + 24 * 60 * 60 * 1000 },
    };
    expect(expiryPlan(content, NOW)).toBeUndefined();
    expect(expiryPlan(content, NOW + 24 * 60 * 60 * 1000)?.remove).toEqual([recentKey('old')]);
  });
});

describe('this device’s own rows never leave it (D109, P8-11, P8R-04)', () => {
  it('Recently deleted, the lineage and expiry’s clock are left out of a backup and never taken from one; Merge keeps all three, Replace all but the entries (P8S-08)', () => {
    const base = holding([glucose('g1', 62), glucose('g2', 70)]);
    let s = apply(base, del(base, { kind: 'reading', id: 'g1' }).change);
    s = apply(s, { content: { put: { [lineageKey('walk:W')]: { to: 'walk:W2', at: AT }, [RECENT_CLOCK]: { at: NOW } } } });
    const doc = toTransferDoc(s);
    expect(JSON.stringify(doc)).not.toMatch(/recent:|lineage:|recent-clock/);
    const planted = { ...doc, contentState: [...(doc.contentState ?? []),
      { key: recentKey('planted'), value: { id: 'planted', at: AT, kind: 'reading', of: 'x' } },
      { key: lineageKey('walk:W'), value: { to: 'walk:FROM-A-FILE', at: AT } },
    ] };
    const local = (snap: Snapshot) => Object.keys(snap.content).filter(k => /^(recent:|lineage:|recent-clock)/.test(k)).sort();
    const merged = apply(s, planImport(planted, 'merge', s).change);
    expect(local(merged)).toEqual([lineageKey('walk:W'), RECENT_CLOCK, recentKey('deleted-1')].sort());
    expect(lineageIn(merged.content)).toEqual({ 'walk:W': 'walk:W2' });
    const replaced = apply(s, planImport(planted, 'replace', s).change);
    expect(local(replaced)).toEqual([lineageKey('walk:W'), RECENT_CLOCK].sort());
    expect(lineageIn(replaced.content)).toEqual({ 'walk:W': 'walk:W2' });
  });

  it('keeps the lineage through a Replace from this device’s own backup, so an older file’s unknown pain rating still finds its walk (P8S-08)', () => {
    // An older file, from before the walk was deleted here, holding a pain rating this device never had.
    const unknown = newObservation({ id: 'pain-from-elsewhere', kind: 'backPain', value: 3, scope: 'pointInTime', source: 'manual', at: '2026-10-08T09:26:00+05:30', context: `walk:${W}` });
    const older = toTransferDoc(holding([...walked, unknown], { routes: [route] }), AT, { include: ['routes'] });
    const base = holding([...walked], { routes: [route] });
    let s = apply(base, del(base, { kind: 'walk', walkId: W }).change);
    s = apply(s, planRestore('deleted-1', s, fresh, NOW).change);
    // Backed up, and the device replaced from that backup.
    const replaced = apply(s, planImport(toTransferDoc(s, AT, { include: ['routes'] }), 'replace', s).change);
    expect(lineageIn(replaced.content)).toEqual({ [`walk:${W}`]: `walk:${fresh.walkId}` });
    for (const onConflict of ['keepDevice', 'takeFile'] as const) {
      const merged = apply(replaced, planImport(older, 'merge', replaced, { onConflict }).change);
      expect(merged.observations.find(o => o.id === 'pain-from-elsewhere')?.context).toBe(`walk:${fresh.walkId}`);
      expect(merged.observations.filter(o => o.scope === 'sessionObserved').map(o => o.context)).toEqual([`walk:${fresh.walkId}`, `walk:${fresh.walkId}`]);
    }
  });

  it('drops a `settings.deleted.recent` a file carries, on import and on export, and keeps every other deletion record', () => {
    const carrier = { observations: ['gone-1'], recent: [{ at: AT, store: 'routes', record: route }] };
    expect(withoutRecentCarrier({ deleted: carrier } as never)).toEqual({ deleted: { observations: ['gone-1'] } });
    const file = { ...toTransferDoc(emptySnapshot()), settings: { deleted: carrier } };
    const imported = apply(emptySnapshot(), planImport(file, 'replace', emptySnapshot()).change);
    expect(JSON.stringify(imported.settings)).not.toMatch(/12\.97|recent/);
    expect(imported.settings?.deleted?.observations).toEqual(['gone-1']);
    const leaked = { ...emptySnapshot(), settings: { deleted: carrier } } as unknown as Snapshot;
    expect(JSON.stringify(toTransferDoc(leaked))).not.toMatch(/12\.97|"recent"/);
  });
});

describe('"Erase all routes" reaches Recently deleted (B-05, D93, Review Focus 3)', () => {
  it('takes the route out of a deleted walk, which comes back without one', () => {
    const base = holding([...walked, pain], { routes: [route] });
    const s = apply(base, del(base, { kind: 'walk', walkId: W }).change);
    const erased = apply(s, { content: recentWithoutRoutes(s.content)! });
    expect(JSON.stringify(erased.content)).not.toMatch(/12\.97|77\.59/);
    expect(recentWithoutRoutes(erased.content)).toBeUndefined();
    const back = apply(erased, planRestore('deleted-1', erased, fresh, NOW).change);
    expect(back.records.routes).toEqual([]);
    expect(back.observations.filter(o => o.restoredFrom)).toHaveLength(3);
  });
});
```

Append to `src/health/observation.test.ts`, inside its `observationProblem` describe, adding `observationProblem`, `newObservation`, `reviseObservation` and `compareStatements` to its import if missing:

```ts
  it('takes a restored record’s `restoredFrom`, and only as the id it came from (B-05)', () => {
    const o = newObservation({ id: 'g2', kind: 'glucose', value: 90, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: '2026-10-08T09:00:00+05:30' });
    expect(observationProblem({ ...o, restoredFrom: 'g1' })).toBeUndefined();
    expect(observationProblem({ ...o, restoredFrom: '' })).toMatch(/restoredFrom/);
  });

  it('gives each statement its place as it is said, a correction a later one, and orders two said at one instant by it (P8R-06)', () => {
    const at = '2026-10-06T12:00:00+05:30';
    const first = newObservation({ id: 'z', kind: 'water', value: 250, scope: 'dayTotal', source: 'manual', at });
    const later = newObservation({ id: 'a', kind: 'water', value: 500, scope: 'dayTotal', source: 'manual', at });
    expect(later.order!).toBeGreaterThan(first.order!);
    expect(reviseObservation(first, { value: 300 }, '2026-10-06T12:00:00+05:30').order!).toBeGreaterThan(later.order!);
    // Neither its id nor this database's commit order decides it while both have a place.
    expect(compareStatements({ ...later, seq: 1 }, { ...first, seq: 9 })).toBeGreaterThan(0);
    // One said before this release has none: the commit order decides, as it always has (J05).
    expect(compareStatements({ ...later, order: undefined, seq: 1 }, { ...first, seq: 9 })).toBeLessThan(0);
    expect(observationProblem({ ...first, order: -1 })).toMatch(/order/);
  });
```

- [ ] **Step 2: Run them to check they fail**

Run: `npx vitest run src/store/recent.test.ts src/health/observation.test.ts`
Expected: FAIL, "Cannot find module './recent'", `restoredFrom: ''` passes, and a statement has no `order`.

- [ ] **Step 3: The record types.**
  - `src/health/observation.ts`: `Observation` gains, after `timeUnknown`:

```ts
  /** Restored from Recently deleted (B-05): the id it had before it was deleted. */
  restoredFrom?: string;
```

    and `observationProblem` adds, before `return undefined;`:

```ts
  if (o.restoredFrom !== undefined && (typeof o.restoredFrom !== 'string' || o.restoredFrom === '')) return 'restoredFrom names the record it came from';
  if (o.order !== undefined && !(Number.isSafeInteger(o.order) && o.order >= 0)) return 'order must be a whole number';
```

  - `src/walk/routeRecord.ts`: `RouteRecord` gains `/** Restored with its walk (B-05): the walk id it had. */ restoredFrom?: string;`.
  - `src/food/types.ts`: `CustomFood` gains `/** Brought back from Recently deleted: the deleted food's id (B-05). */ restoredFrom?: string;`.
  - `src/types/index.ts`: `WorkoutSession` gains `/** Brought back from Recently deleted: the deleted session's id (B-05). */ restoredFrom?: string;`.
  - `src/store/transfer.ts`'s `isSessionRecord` adds `&& optional(x.restoredFrom, isText)`.

- [ ] **Step 4: Each statement keeps its order, everywhere it goes** (P8-10, P8R-06). In `src/health/observation.ts`:
  - `Observation` gains, after `seq`:

```ts
  /**
   * When it was said: a number this device gives a statement as it is made,
   * a correction included, which every copy keeps through a restore, a backup
   * and a merge (board D110, Codex P8R-06). It orders two statements said at
   * the same instant on whichever device they meet; `seq`, one database's
   * commit order, decides only between statements that lack it, made before
   * this release.
   */
  order?: number;
```

  - after `randomId`:

```ts
let lastOrder = 0;

/** A statement's place (P8R-06): the time it is said, in microseconds, and always later than the last one here. */
export function nextOrder(now: number = Date.now()): number {
  lastOrder = Math.max(now * 1000, lastOrder + 1);
  return lastOrder;
}
```

  - `newObservation`'s record gains `order: nextOrder(),` after `source,`, and `reviseObservation` sets `next.order = nextOrder();` beside `delete next.seq;`: a correction is a new statement;
  - `compareStatements` reads it after the statement's instant, before the commit order:

```ts
/** When it was said, when both records know it (P8R-06). */
function byOrder(a: Observation, b: Observation): number {
  return a.order !== undefined && b.order !== undefined ? order(a.order, b.order) : 0;
}

export function compareStatements(a: Observation, b: Observation): number {
  return (
    order(Date.parse(a.editedAt ?? a.at), Date.parse(b.editedAt ?? b.at)) ||
    byOrder(a, b) ||
    bySeq(a, b) ||
    order(Date.parse(a.at), Date.parse(b.at)) ||
    byId(a, b)
  );
}
```

  `order.test.ts`'s J05 file holds statements without an `order`, so its commit order decides, never its ids, as before. A test that compares a whole new observation with `toEqual` gains `order: expect.any(Number)`.

  In `src/store/snapshot.ts`, for a restore made on this device of a statement from before this release, which has no `order`:
  - `Change.observations` becomes `{ put?: Observation[]; remove?: string[]; keepOrder?: boolean; keepSeq?: boolean }`, its doc comment adding: "`keepSeq`: each put keeps its own `seq`, the place it had when first said (a restore, D110), so two statements made at one moment keep their order; one with none takes this commit's.";
  - in `prepare`, `const steps = change.observations?.keepOrder ? … : [];` becomes:

```ts
  const keepSeq = change.observations?.keepSeq === true;
  const steps = !keepSeq && change.observations?.keepOrder ? [...new Set(given.map(o => o.seq ?? -1))].sort((a, b) => a - b) : [];
```

    and `const puts = given.map(o => ({ ...o, seq: … }));` becomes:

```ts
  const puts = given.map(o => (keepSeq && o.seq !== undefined ? o : { ...o, seq: steps.length ? base.revision + 1 + rank.get(o.seq ?? -1)! : revision }));
```

  A merge still gives what it takes from a file this commit's `seq`, as it must for a record new to this device; `order` is what keeps two statements said at one instant in the order they were said, whichever device holds the later one first (D110).

- [ ] **Step 5: Write** `src/store/recent.ts`

```ts
/**
 * Recently deleted (journey §20.4 rule 6; B-04, B-05; board D109, D110,
 * D111). A routine delete removes the record and everything that belongs to
 * it in one change, and keeps all of it as one entry for 7 days: a
 * content-state row, `recent:<id>`, which never leaves the device (D109
 * amends J§18.1's place for it). A restore puts it back under fresh ids with
 * `restoredFrom`, its references rewritten, and drops the entry, in one
 * change; the originals' deletion records (D-06) stay, so an older backup
 * can't bring them back beside their copies. Each renaming is kept as this
 * device's own lineage, `lineage:<old>` rows, which never leave it either; a
 * merge reads a file's references through them. Pure: the store runs each
 * plan as one change. A session and a check-in's reading are deleted and
 * restored by their own modules (`src/screens/workout/deletion.ts`,
 * `src/components/checkin/pending.ts`), into entries made here.
 */
import type { KeptReading } from '@/components/checkin/pending';
import { bpReadingId, checkInDayOf, isBpKind, observationProblem, type Observation } from '@/health/observation';
import type { UserSettings, WorkoutSession } from '@/types';
import { StoreFailure } from './db';
import { RECORD_RULES, recordKey, recordProblem, type RecordStore, type StoredRecord } from './records';
import type { Change, Snapshot } from './snapshot';
import type { TransferDoc } from './transfer';

export const RECENT_DAYS = 7;
export const RECENT_MS = RECENT_DAYS * 24 * 60 * 60 * 1000;
export const RECENT_PREFIX = 'recent:';
export const LINEAGE_PREFIX = 'lineage:';
/** The last time expiry ran: it never runs on a clock that reads earlier (K8-01). */
export const RECENT_CLOCK = 'recent-clock';

export type RecentKind = 'reading' | 'pressure' | 'walk' | 'meal' | 'usualMeal' | 'ownFood' | 'session' | 'checkInReading';

export interface RecentDeletion {
  id: string;
  /** When it was deleted, ISO with offset. */
  at: string;
  kind: RecentKind;
  /** The deleted thing's own id: the reading's, the blood pressure reading's, the walk's, the meal's, the food's, the session's; a check-in reading's first row. */
  of: string;
  observations?: Observation[];
  records?: Partial<Record<RecordStore, StoredRecord[]>>;
  /** A session or manual workout, whole. */
  session?: WorkoutSession;
  /** A check-in's reading: the check-in's day, and what was taken out of it, where it stood. */
  day?: string;
  kept?: KeptReading;
}

export type DeleteRequest =
  | { kind: 'reading'; id: string }
  | { kind: 'pressure'; readingId: string }
  | { kind: 'walk'; walkId: string }
  | { kind: 'meal'; id: string }
  | { kind: 'usualMeal'; id: string }
  | { kind: 'ownFood'; id: string };

export interface Restored {
  kind: RecentKind;
  /** The restored thing's id now. */
  id: string;
}

export const CHECK_IN_READING = 'This reading belongs to a check-in: it’s deleted from the check-in.';
export const NOT_RECENT = 'That’s no longer in Recently deleted: anything deleted more than 7 days ago is gone for good.';
export const OWN_SCREEN = 'That’s restored by its own record.';

export const recentKey = (id: string): string => `${RECENT_PREFIX}${id}`;
export const isRecentKey = (key: string): boolean => key.startsWith(RECENT_PREFIX);
export const lineageKey = (ref: string): string => `${LINEAGE_PREFIX}${ref}`;
/** This device's own rows: never in a backup, never taken from one (D109, P8R-04). */
export const isLocalKey = (key: string): boolean => isRecentKey(key) || key.startsWith(LINEAGE_PREFIX) || key === RECENT_CLOCK;

const KINDS: readonly RecentKind[] = ['reading', 'pressure', 'walk', 'meal', 'usualMeal', 'ownFood', 'session', 'checkInReading'];
const STORE_OF: Partial<Record<RecentKind, RecordStore>> = { meal: 'meals', usualMeal: 'savedMeals', ownFood: 'customFoods' };
const PREFIX_OF: Partial<Record<RecentKind, string>> = { meal: 'meal', usualMeal: 'usual', ownFood: 'food' };
const gone = (what: string) => new StoreFailure('invalid', `${what} is no longer on this device.`);
const newestFirst = (a: RecentDeletion, b: RecentDeletion) => Date.parse(b.at) - Date.parse(a.at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** A content row's value as an entry, or nothing when it can't be one. */
export function asRecent(value: unknown): RecentDeletion | undefined {
  if (!isObject(value)) return undefined;
  const e = value as Partial<RecentDeletion>;
  if (typeof e.id !== 'string' || typeof e.at !== 'string' || Number.isNaN(Date.parse(e.at)) || typeof e.of !== 'string') return undefined;
  if (!KINDS.includes(e.kind as RecentKind)) return undefined;
  if (e.observations !== undefined && !Array.isArray(e.observations)) return undefined;
  if (e.records !== undefined && !isObject(e.records)) return undefined;
  if (e.kind === 'session' && !isObject(e.session)) return undefined;
  if (e.kind === 'checkInReading' && (typeof e.day !== 'string' || !isObject(e.kept))) return undefined;
  return e as RecentDeletion;
}

const within = (e: RecentDeletion, now: number) => now - Date.parse(e.at) < RECENT_MS;

/** The entries still within 7 days, newest first. */
export function recentEntries(content: Readonly<Record<string, unknown>>, now: number): RecentDeletion[] {
  const out: RecentDeletion[] = [];
  for (const [key, value] of Object.entries(content)) {
    if (!isRecentKey(key)) continue;
    const e = asRecent(value);
    if (e && within(e, now)) out.push(e);
  }
  return out.sort(newestFirst);
}

/** The one test every restore asks, of what is stored when it is written (P8R-14): the entry, still within its 7 days, or nothing. */
export function restorable(content: Readonly<Record<string, unknown>>, entryId: string, now: number): RecentDeletion | undefined {
  const e = asRecent(content[recentKey(entryId)]);
  return e && within(e, now) ? e : undefined;
}

/** The rows past their 7 days, or unreadable. Every deletion is kept its 7 days, however many there are (P8-12). */
export function staleKeys(content: Readonly<Record<string, unknown>>, now: number): string[] {
  const drop: string[] = [];
  for (const [key, value] of Object.entries(content)) {
    if (!isRecentKey(key)) continue;
    const e = asRecent(value);
    if (!e || !within(e, now)) drop.push(key);
  }
  return drop.sort();
}

const clockOf = (content: Readonly<Record<string, unknown>>) => {
  const v = content[RECENT_CLOCK];
  return isObject(v) && typeof v.at === 'number' && Number.isFinite(v.at) ? v.at : undefined;
};

/**
 * Expiry, the one place it happens (D109, K8-01): what has passed its 7 days
 * goes, with the clock it ran at. Nothing at all while the clock reads
 * earlier than the last time it ran, so a clock set back never ends anything.
 * Undefined: nothing to do.
 */
export function expiryPlan(content: Readonly<Record<string, unknown>>, now: number): { remove: string[]; put: Record<string, unknown> } | undefined {
  const last = clockOf(content);
  if (last !== undefined && now < last) return undefined;
  const remove = staleKeys(content, now);
  return remove.length > 0 ? { remove, put: { [RECENT_CLOCK]: { at: now } } } : undefined;
}

/** When the next entry's 7 days end: what the store's timer waits for while the page runs (P8R-14). */
export function nextExpiry(content: Readonly<Record<string, unknown>>): number | undefined {
  let next: number | undefined;
  for (const [key, value] of Object.entries(content)) {
    if (!isRecentKey(key)) continue;
    const e = asRecent(value);
    const due = e ? Date.parse(e.at) + RECENT_MS : undefined;
    if (due !== undefined && (next === undefined || due < next)) next = due;
  }
  return next;
}

/** A session's entry, made by `deleteWorkout` in the change that removes it: the session, and what was recorded with it as it is now (P8S-06). */
export function sessionEntry(session: WorkoutSession, meta: { entry: string; at: string }, observations: readonly Observation[] = []): RecentDeletion {
  return { id: meta.entry, at: meta.at, kind: 'session', of: session.id, session, ...(observations.length > 0 ? { observations: [...observations] } : {}) };
}

/**
 * This device's history, which no import changes, a Replace included
 * (P8S-08): its lineage, and expiry's clock. Recently deleted's entries
 * aren't history but recovery payloads, and a Replace clears them with the
 * records they describe.
 */
export function deviceHistory(content: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(content).filter(([key]) => key.startsWith(LINEAGE_PREFIX) || key === RECENT_CLOCK));
}

/** A check-in reading's entry, made by `removeCheckInReading` in the change that takes it out. */
export function checkInReadingEntry(meta: { entry: string; at: string }, day: string, kept: KeptReading, observations: readonly Observation[]): RecentDeletion {
  return { id: meta.entry, at: meta.at, kind: 'checkInReading', of: observations[0]?.id ?? `${day}:${kept.kind}`, day, kept, observations: [...observations] };
}

/**
 * A routine delete as one change (B-04, D111): the record, everything that
 * belongs to it, and the entry that keeps them for 7 days. A check-in's own
 * reading is refused: its check-in removes it (`removeCheckInReading`).
 */
export function planDeletion(request: DeleteRequest, base: Snapshot, meta: { entry: string; at: string }): { change: Change; entry: RecentDeletion } {
  let of: string;
  let observations: Observation[] = [];
  const records: Partial<Record<RecordStore, StoredRecord[]>> = {};
  let journal: string[] | undefined;
  switch (request.kind) {
    case 'reading': {
      const o = base.observations.find(x => x.id === request.id);
      if (!o) throw gone('That record');
      const reading = isBpKind(o.kind) ? bpReadingId(o.context) : undefined;
      if (reading !== undefined) return planDeletion({ kind: 'pressure', readingId: reading }, base, meta);
      if (checkInDayOf(o) !== undefined) throw new StoreFailure('invalid', CHECK_IN_READING);
      observations = [o];
      of = o.id;
      break;
    }
    case 'pressure': {
      observations = base.observations.filter(o => bpReadingId(o.context) === request.readingId);
      if (observations.length === 0) throw gone('That reading');
      if (observations.some(o => checkInDayOf(o) !== undefined)) throw new StoreFailure('invalid', CHECK_IN_READING);
      of = request.readingId;
      break;
    }
    case 'walk': {
      // Everything recorded with the walk, as one entry (D110): its measurements, the energy
      // worked out from them, the pain rated after it, its route and its journal.
      observations = base.observations.filter(o => o.context === `walk:${request.walkId}`);
      const route = base.records.routes.filter(r => recordKey('routes', r) === request.walkId);
      if (observations.length === 0 && route.length === 0) throw gone('That walk');
      if (route.length > 0) records.routes = route;
      journal = [request.walkId];
      of = request.walkId;
      break;
    }
    case 'meal':
    case 'usualMeal':
    case 'ownFood': {
      const store = STORE_OF[request.kind]!;
      const found = base.records[store].filter(r => recordKey(store, r) === request.id);
      if (found.length === 0) throw gone(`That ${RECORD_RULES[store].label.one}`);
      records[store] = found;
      of = request.id;
      break;
    }
  }
  const entry: RecentDeletion = {
    id: meta.entry, at: meta.at, kind: request.kind, of,
    ...(observations.length > 0 ? { observations } : {}),
    ...(Object.keys(records).length > 0 ? { records } : {}),
  };
  const removes = Object.fromEntries(Object.entries(records).map(([store, rows]) => [store, { remove: rows.map(r => recordKey(store as RecordStore, r)) }]));
  return {
    entry,
    change: {
      ...(observations.length > 0 ? { observations: { remove: observations.map(o => o.id) } } : {}),
      ...(Object.keys(removes).length > 0 ? { records: removes } : {}),
      ...(journal ? { journal: { remove: journal } } : {}),
      content: { put: { [recentKey(entry.id)]: entry } },
    },
  };
}

/** A reference through the lineage to the record that bears it now: `walk:W` → `walk:W3` after two restores. */
export function canonical(lineage: Readonly<Record<string, string>>, ref: string): string {
  let at = ref;
  const seen = new Set<string>();
  while (Object.hasOwn(lineage, at) && !seen.has(at)) {
    seen.add(at);
    at = lineage[at];
  }
  return at;
}

/** This device's renamings, old reference to new, from its own rows. */
export function lineageIn(content: Readonly<Record<string, unknown>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(content)) {
    if (key.startsWith(LINEAGE_PREFIX) && isObject(value) && typeof value.to === 'string') out[key.slice(LINEAGE_PREFIX.length)] = value.to;
  }
  return out;
}

/** Whether a walk or a session a reference names is on the device now. */
const lives = (base: Snapshot, ref: string) => (ref.startsWith('walk:')
  ? base.observations.some(o => o.context === ref && o.scope === 'sessionObserved') || base.records.routes.some(r => `walk:${recordKey('routes', r)}` === ref)
  : base.sessions.some(s => `session:${s.id}` === ref));

/**
 * A restored reading's walk or session (P8R-05): the one that bears its
 * record now, through this device's lineage; none when that is gone, so the
 * reading stands on its own in the log rather than under a record that isn't
 * there.
 */
function relinked(o: Observation, base: Snapshot, lineage: Readonly<Record<string, string>>): Observation {
  const ref = o.context;
  if (ref === undefined || !(ref.startsWith('walk:') || ref.startsWith('session:'))) return o;
  const now = canonical(lineage, ref);
  if (lives(base, now)) return now === ref ? o : { ...o, context: now };
  const { context: _gone, ...alone } = o;
  void _gone;
  return alone as Observation;
}

const renamedItems = (items: unknown, rename: (id: string) => string | undefined) =>
  (Array.isArray(items) ? items.map(i => {
    if (!isObject(i) || i.kind !== 'custom' || typeof i.customId !== 'string') return i;
    const to = rename(i.customId);
    return to === undefined || to === i.customId ? i : { ...i, customId: to };
  }) : items);
const named = (items: unknown, id: string) => Array.isArray(items) && items.some(i => isObject(i) && i.kind === 'custom' && i.customId === id);
/** A meal's or a usual meal's items, each own food named as the one that bears it now. */
const withItems = (r: StoredRecord, rename: (id: string) => string | undefined): StoredRecord => ({
  ...r,
  items: renamedItems(r.items, rename),
  ...(Array.isArray(r.edits) ? { edits: r.edits.map(e => (isObject(e) ? { ...e, items: renamedItems(e.items, rename) } : e)) } : {}),
});

/**
 * Put an entry back (B-05, D110): fresh ids with `restoredFrom`, each
 * record's own times and commit order kept, what it names rewritten through
 * this device's lineage, the renaming kept as lineage, and the entry dropped,
 * in one change. `fresh.stem` names a reading, a blood pressure reading, a
 * meal, a usual meal or an own food; `fresh.walkId` a walk.
 */
export function planRestore(entryId: string, base: Snapshot, fresh: { stem: string; walkId: string }, now: number): { change: Change; restored: Restored } {
  const entry = restorable(base.content, entryId, now);
  if (!entry) throw new StoreFailure('invalid', NOT_RECENT);
  const lineage = lineageIn(base.content);
  // `order` and `seq` are kept: the place each was said in, here and on any device (P8-10, P8R-06).
  const back = (o: Observation, id: string, context?: string): Observation => ({ ...o, id, ...(context !== undefined ? { context } : {}), restoredFrom: o.id });
  const links: Record<string, unknown> = {};
  const link = (from: string, to: string) => { links[lineageKey(from)] = { to, at: new Date(now).toISOString() }; };
  const foodNow = (id: string) => {
    const to = canonical(lineage, `customFood:${id}`).slice('customFood:'.length);
    return base.records.customFoods.some(f => recordKey('customFoods', f) === to) ? to : undefined;
  };
  let observations: Observation[] = [];
  const records: Partial<Record<RecordStore, StoredRecord[]>> = {};
  let restored: Restored;
  switch (entry.kind) {
    case 'reading': {
      observations = (entry.observations ?? []).map(o => relinked(back(o, fresh.stem), base, lineage));
      restored = { kind: 'reading', id: fresh.stem };
      break;
    }
    case 'pressure': {
      const reading = `reading-${fresh.stem}`;
      observations = (entry.observations ?? []).map(o => back(o, `${reading}:${o.kind}`, `bp:${reading}`));
      restored = { kind: 'pressure', id: reading };
      break;
    }
    case 'walk': {
      const was = entry.of;
      const to = fresh.walkId;
      const renamed = (id: string) => (id.startsWith(`${was}:`) ? `${to}:${id.slice(was.length + 1)}` : `${to}:${id}`);
      observations = (entry.observations ?? []).map(o => back(o, renamed(o.id), `walk:${to}`));
      // A route from before the last "Erase all routes" never comes back (Plan 6's rule, B-05).
      const routes = (entry.records?.routes ?? []).filter(r => RECORD_RULES.routes.keeps?.(base.settings, r) ?? true);
      if (routes.length > 0) records.routes = routes.map(r => ({ ...r, walkId: to, restoredFrom: was }));
      link(`walk:${was}`, `walk:${to}`);
      restored = { kind: 'walk', id: to };
      break;
    }
    case 'meal':
    case 'usualMeal':
    case 'ownFood': {
      const store = STORE_OF[entry.kind]!;
      const id = `${PREFIX_OF[entry.kind]}-${fresh.stem}`;
      // A meal names the own food that came back for one it named (P8R-05); one still gone stays named
      // as it was, so the food's own restore, within its 7 days, names itself in it again.
      records[store] = (entry.records?.[store] ?? []).map(r => ({ ...(entry.kind === 'ownFood' ? r : withItems(r, foodNow)), id, restoredFrom: entry.of }));
      if (entry.kind === 'ownFood') {
        const rename = (x: string) => (x === entry.of ? id : undefined);
        const meals = base.records.meals.filter(m => named(m.items, entry.of) || (Array.isArray(m.edits) && m.edits.some(e => isObject(e) && named(e.items, entry.of))));
        if (meals.length > 0) records.meals = meals.map(m => withItems(m, rename));
        const usual = base.records.savedMeals.filter(u => named(u.items, entry.of));
        if (usual.length > 0) records.savedMeals = usual.map(u => withItems(u, rename));
        link(`customFood:${entry.of}`, `customFood:${id}`);
      }
      restored = { kind: entry.kind, id };
      break;
    }
    case 'session':
    case 'checkInReading':
      throw new StoreFailure('invalid', OWN_SCREEN);
  }
  for (const o of observations) {
    const problem = observationProblem(o);
    if (problem) throw new StoreFailure('invalid', `That can’t be restored: ${problem}`);
  }
  for (const [store, rows] of Object.entries(records) as [RecordStore, StoredRecord[]][]) {
    for (const r of rows) {
      const problem = recordProblem(store, r);
      if (problem) throw new StoreFailure('invalid', `That can’t be restored: ${RECORD_RULES[store].label.one}: ${problem}`);
    }
  }
  return {
    restored,
    change: {
      ...(observations.length > 0 ? { observations: { put: observations, keepSeq: true } } : {}),
      ...(Object.keys(records).length > 0 ? { records: Object.fromEntries(Object.entries(records).map(([store, rows]) => [store, { put: rows }])) } : {}),
      content: { put: links, remove: [recentKey(entryId)] },
    },
  };
}

/**
 * "Erase all routes" (B-05, D93): every entry without its route, and an entry
 * that can't be read, gone. No coordinate stays in a deletion. Nothing to do:
 * undefined.
 */
export function recentWithoutRoutes(content: Readonly<Record<string, unknown>>): { put: Record<string, unknown>; remove: string[] } | undefined {
  const put: Record<string, unknown> = {};
  const remove: string[] = [];
  for (const [key, value] of Object.entries(content)) {
    if (!isRecentKey(key)) continue;
    const e = asRecent(value);
    if (!e) {
      remove.push(key);
      continue;
    }
    if (!e.records?.routes) continue;
    const { records, ...rest } = e;
    const others = Object.fromEntries(Object.entries(records ?? {}).filter(([store]) => store !== 'routes'));
    put[key] = Object.keys(others).length > 0 ? { ...rest, records: others } : rest;
  }
  return Object.keys(put).length > 0 || remove.length > 0 ? { put, remove } : undefined;
}

/**
 * The settings without a `deleted.recent` (D109): this app never writes one,
 * so one that is there came from a file, and is never this device's to
 * restore. Every other deletion record stays. The same settings back when
 * there is none.
 */
export function withoutRecentCarrier(settings: UserSettings | undefined): UserSettings | undefined {
  const deleted = settings?.deleted as (Record<string, unknown> | undefined);
  if (!deleted || !Object.hasOwn(deleted, 'recent')) return settings;
  const { recent: _carried, ...rest } = deleted;
  void _carried;
  return { ...settings, deleted: rest } as UserSettings;
}

/**
 * A file's references read through this device's lineage, before a merge
 * compares anything (B-05, D110, P8-09): a pain rating after a walk, and a
 * meal's own food, name the record that survives here. A record's own key
 * isn't a reference: an older file's deleted original stays deleted by its
 * deletion record.
 */
export function throughLineage(file: TransferDoc, lineage: Readonly<Record<string, string>>): TransferDoc {
  if (Object.keys(lineage).length === 0) return file;
  const context = (c: string | undefined) => (c !== undefined && (c.startsWith('walk:') || c.startsWith('session:')) ? canonical(lineage, c) : c);
  const food = (id: string) => canonical(lineage, `customFood:${id}`).slice('customFood:'.length);
  const records = file.records;
  return {
    ...file,
    observations: file.observations.map(o => {
      const c = context(o.context);
      return c === o.context ? o : { ...o, context: c! };
    }),
    ...(records ? {
      records: {
        ...records,
        ...(records.meals ? { meals: records.meals.map(m => withItems(m, food)) } : {}),
        ...(records.savedMeals ? { savedMeals: records.savedMeals.map(u => withItems(u, food)) } : {}),
      },
    } : {}),
  };
}
```

- [ ] **Step 6: Run the pure tests**

Run: `npx vitest run src/store/recent.test.ts src/health/observation.test.ts`
Expected: PASS, except the cases that need the transfer's part ("this device's own rows never leave it", the lineage kept through a Replace, and the own food's and the walk's merges): the transfer doesn't yet leave this device's rows out, keep its history through a Replace, strip the carrier, or read through the lineage.

- [ ] **Step 7: Never in a backup, never from one; merges read through this device's lineage, and a Replace keeps it.** In `src/store/transfer.ts`, import `deviceHistory`, `isLocalKey`, `lineageIn`, `throughLineage` and `withoutRecentCarrier` from `./recent`, and:
  - in `toTransferDoc`, `...(snapshot.settings !== undefined ? { settings: snapshot.settings } : {})` becomes `...(snapshot.settings !== undefined ? { settings: withoutRecentCarrier(snapshot.settings)! } : {})`, and `contentState: Object.entries(snapshot.content).map(…)` becomes `contentState: Object.entries(snapshot.content).filter(([key]) => !isLocalKey(key)).map(([key, value]) => ({ key, value }))`;
  - in `parse`, `const contentState = keep(lists.contentState!, isContentRow, 'contentState');` becomes:

```ts
  // Recently deleted, the lineage and expiry's clock are this device's own (D109, P8R-04): a file's are never taken.
  const contentState = keep(lists.contentState!, isContentRow, 'contentState').filter(r => !isLocalKey(r.key));
```

    and where `parse` reads the file's settings (`readSettings`), the settings it keeps pass through `withoutRecentCarrier` first;
  - at the start of `planMerge`, before anything is compared:

```ts
  // A file's references to records restored here under new ids name those records (B-05, D110, P8-09),
  // through this device's own lineage, which no file can change (P8R-04).
  file = throughLineage(file, lineageIn(base.content));
```

    (`file` becomes a `let` parameter);
  - in `planImport`'s Replace branch, `content: { put: Object.fromEntries((file.contentState ?? []).map(r => [r.key, r.value])) },` becomes:

```ts
        // This device's history stays through a Replace, as through every import (P8S-08): its lineage and
        // expiry's clock. Recently deleted's entries go with the records they describe.
        content: { put: { ...Object.fromEntries((file.contentState ?? []).map(r => [r.key, r.value])), ...deviceHistory(base.content) } },
```

  Replace starts from an empty store (`reset: true`), so it clears Recently deleted's entries with the records they describe and keeps only what `deviceHistory` gives back; a merge never removes content rows, so it keeps them all.

Run: `npx vitest run src/store/recent.test.ts`
Expected: PASS.

- [ ] **Step 8: The store's actions, and expiry at a start, on a return and on time.** In `src/store/useStore.ts`, import `expiryPlan`, `isRecentKey`, `nextExpiry`, `planDeletion`, `planRestore`, `recentKey`, `recentWithoutRoutes`, `restorable`, `withoutRecentCarrier`, `NOT_RECENT`, `type DeleteRequest`, `type Restored` from `./recent` and `newWalkId` from `@/walk/plan`, and:
  - `Mutation` gains `/** Not an edit the person made (D113): a delete, a restore, background work. Only edits end an Undo (Task 7). */ edit?: false;` and:

```ts
  /**
   * What it may do depends on the time: a restore, which an entry past its 7
   * days may no longer make, and expiry (P8S-09). Planned again when its turn
   * comes, inside the transaction that commits it, never from a plan made
   * earlier against the same snapshot.
   */
  timed?: true;
```

  - in `planOn`, `if (!read && m.cached && m.cached.on === base && !m.cached.read) return m.cached;` becomes `if (!read && !m.timed && m.cached && m.cached.on === base && !m.cached.read) return m.cached;`, and in `commit`, the plan `commitChange` is handed reuses the cached one only when `!m.journal && !m.timed && !refreshed && m.cached && m.cached.on === base`;
  - `UpdateOptions.removeObservations` becomes `readonly string[] | ((base: Snapshot) => readonly string[])`, its doc comment adding "or worked out from what is stored when the change is planned", and in `update`'s plan `const doomed = new Set((options.removeObservations ?? []).filter(id => findObservation(base, id)));` becomes:

```ts
      const removing = typeof options.removeObservations === 'function' ? options.removeObservations(base) : options.removeObservations ?? [];
      const doomed = new Set(removing.filter(id => findObservation(base, id)));
```

  - `UpdateOptions` gains:

```ts
  /**
   * Content-state rows written in the same transaction (Plan 8): a Recently
   * deleted entry, a lineage row. Asked after the updater, with the snapshot
   * the change is planned on, so it can hold what the updater found and what
   * is stored with it.
   */
  content?: (base: Snapshot) => { put?: Record<string, unknown>; remove?: readonly string[] } | undefined;
  /**
   * The Recently deleted entry this change restores (B-05): still restorable
   * when the change is stored, or nothing is written (P8R-14); used up in the
   * same change.
   */
  entry?: string;
  /**
   * Rows a restore brings back as they are, under their fresh ids (D110).
   * Asked after the updater; one the updater's own lifting would make under
   * the same id is this row instead, so nothing is worked out again from an
   * older field (P8S-06).
   */
  restored?: () => readonly Observation[];
  /** Not an edit the person made: a delete or a restore (D113). */
  edit?: false;
```

  - in `update`, the enqueued mutation gains `...(options.edit === false ? { edit: false as const } : {}),` and `...(options.entry !== undefined ? { timed: true as const } : {}),`; its plan starts with:

```ts
      if (options.entry !== undefined && !restorable(base.content, options.entry, Date.now())) throw new StoreFailure('invalid', NOT_RECENT);
```

    and ends, in place of each `return { change, result: () => undefined };` (the `removeObservations` branch builds its `change` as it does now, then ends the same way), with:

```ts
      const extra = options.content?.(base);
      const used = options.entry !== undefined ? [recentKey(options.entry)] : [];
      const rows = options.restored?.() ?? [];
      const back = new Set(rows.map(o => o.id));
      const contentChange = extra || used.length > 0 ? {
        put: { ...(change?.content?.put ?? {}), ...(extra?.put ?? {}) },
        remove: [...(change?.content?.remove ?? []), ...(extra?.remove ?? []), ...used],
      } : undefined;
      const withExtra: Change | null = contentChange || rows.length > 0 ? {
        ...(change ?? {}),
        ...(contentChange ? { content: contentChange } : {}),
        ...(rows.length > 0 ? {
          observations: {
            ...change?.observations,
            put: [...(change?.observations?.put ?? []).filter(o => !back.has(o.id)), ...rows],
            remove: (change?.observations?.remove ?? []).filter(id => !back.has(id)),
          },
        } : {}),
      } : change;
      return { change: withExtra, result: () => undefined };
```

  - after `removeWalk`, add:

```ts
/**
 * A routine delete (B-04, D109, D111): the record and everything that belongs
 * to it go in one change, kept for 7 days as one Recently deleted entry.
 * Resolves with the entry's id, which Undo and Recently deleted restore by.
 */
export function deleteRecord(request: DeleteRequest): Promise<StoreResult<string>> {
  const entry = freshId('deleted-');
  const at = nowAt();
  return enqueue<string>({
    edit: false,
    plan: base => ({ change: planDeletion(request, base, { entry, at }).change, result: () => entry }),
  });
}

/** Undo, or Restore in Recently deleted (B-05, D110): fresh ids, references rewritten, the entry dropped, in one change. */
export function restoreDeleted(entryId: string): Promise<StoreResult<Restored>> {
  const fresh = { stem: freshId(), walkId: newWalkId(Date.now()) };
  return enqueue<Restored>({
    edit: false,
    timed: true,
    plan: base => {
      const planned = planRestore(entryId, base, fresh, Date.now());
      return { change: planned.change, result: () => planned.restored };
    },
  });
}

/**
 * Recently deleted's expiry, and the carrier it never writes (D109, P8-11,
 * P8-12, K8-01), in one transaction: at every start, on every return to the
 * app, and at the moment the next entry's 7 days end while the page runs, so
 * nothing outlives its 7 days whatever else happens or doesn't. Background
 * work: no Undo ends for it.
 */
export function expireDeleted(): Promise<StoreResult> {
  return enqueue<void>({
    edit: false,
    timed: true,
    plan: base => {
      const due = expiryPlan(base.content, Date.now());
      const settings = withoutRecentCarrier(base.settings);
      const change: Change = {
        ...(due ? { content: due } : {}),
        ...(settings !== base.settings ? { settings: { patch: { deleted: settings?.deleted } as Partial<UserSettings> } } : {}),
      };
      return { change: Object.keys(change).length > 0 ? change : null, result: () => undefined };
    },
  });
}

let expiryTimer: ReturnType<typeof setTimeout> | undefined;

/** Waits, while the page runs, for the next entry's 7 days to end, then expires it with nothing else needed (P8R-14). */
function armExpiry(): void {
  if (expiryTimer !== undefined) clearTimeout(expiryTimer);
  expiryTimer = undefined;
  const due = mode === 'ready' ? nextExpiry(committed.content) : undefined;
  if (due === undefined) return;
  expiryTimer = setTimeout(() => {
    expiryTimer = undefined;
    void expireDeleted();
  }, Math.max(1000, due - Date.now()));
}
```

  - in `commit`, after `committed = durable = outcome.value.next;`, add `armExpiry();`; at the end of `boot`, after `publish();`, add `armExpiry();` and `void expireDeleted();`; in `coordinate`, its `onVisible` becomes `() => { if (document.visibilityState === 'visible') { void checkOutside(); void expireDeleted(); } }`; `resetForTests()` adds `if (expiryTimer !== undefined) clearTimeout(expiryTimer); expiryTimer = undefined;`;
  - in `eraseRoutes`' plan (Plan 6's, D93: one transaction across routes, journals, buffers, a live walk and the other tabs), after `const walk = …`, add:

```ts
      // Every carrier of a coordinate, in this same transaction (B-05, D109): Recently deleted's
      // entries, and a `settings.deleted.recent` a file once left here.
      const recent = recentWithoutRoutes(base.content);
      const carried = withoutRecentCarrier(base.settings);
```

    and its `change` gains `...(recent ? { content: recent } : {}),`, with `settings: { patch: { walk: … } }` becoming `settings: { patch: { walk: …, ...(carried !== base.settings ? { deleted: carried?.deleted } : {}) } }`. Its doc comment's sentence about deletion payloads becomes "Recently deleted's entries lose their routes in the same transaction, and a `settings.deleted.recent` goes (D93, D109)."

  `isRecentKey` is for Task 7's test of edits; drop it from the import if lint says nothing here uses it.

- [ ] **Step 9: A session, and a check-in's reading.**
  - `src/screens/workout/records.ts`, after `withoutWorkout`:

```ts
/**
 * A deleted workout put back (B-05, D110, D111): under a fresh id with
 * `restoredFrom`, its personal records worked out again from every set, and
 * saying the pain score its own record came back with, corrected since or
 * not (P8S-06). The ladder is left as it is, as a delete left it.
 */
export function withWorkoutBack(data: AppData, session: WorkoutSession, id: string, painAfter?: number): AppData {
  const back = { ...session, id, restoredFrom: session.id, ...(painAfter !== undefined ? { painAfter } : {}) };
  const sessions = [back, ...data.sessions.filter(s => s.id !== id)].sort(byDateDescending);
  return { ...data, sessions, personalRecords: repRecords(sessions, data.personalRecords) };
}
```

    Append to `src/screens/workout/records.test.ts`'s `describe('deleting a workout', …)`, adding `withWorkoutBack` to its import:

```ts
  it('puts a deleted workout back under a fresh id, with the records its sets set (D110)', () => {
    const d = withWorkout(withWorkout(data([]), session('early', '2026-09-28', [set('a', { weight: 20 })])),
      session('best', '2026-10-05', [set('b', { weight: 30 })]));
    const best = d.sessions.find(s => s.id === 'best')!;
    const back = withWorkoutBack(withoutWorkout(d, 'best'), best, 'best-again');
    expect(back.sessions.map(s => [s.id, s.restoredFrom])).toEqual([['best-again', 'best'], ['early', undefined]]);
    expect(back.personalRecords).toEqual([record('goblet-squat', 30, 10, '2026-10-05')]);
    expect(back.profile).toBe(d.profile);
    expect(withWorkoutBack(withoutWorkout(d, 'best'), best, 'best-again', 4).sessions[0].painAfter).toBe(4);
  });
```

  - write `src/screens/workout/deletion.ts`:

```ts
/**
 * A workout deleted at once, and put back (B-04, B-05; board D110, D111),
 * through the store's `update`: the session and the personal records its
 * sets set change together, as `withWorkout` and `withoutWorkout` have them,
 * and everything recorded with it goes and comes back with it, as it is when
 * deleted, a pain score corrected since included (Codex P8S-06). The Recently
 * deleted entry is written in the same change. A restore is checked against
 * what is stored as it commits, and keeps the renaming as lineage, so a pain
 * rating deleted on its own and restored later finds it (P8R-05).
 */
import { generateId } from '@/lib/utils';
import { StoreFailure, type StoreResult } from '@/store/db';
import { NOT_RECENT, lineageKey, recentKey, restorable, sessionEntry, type Restored } from '@/store/recent';
import type { Snapshot } from '@/store/snapshot';
import { freshId, getState, update } from '@/store/useStore';
import { nowAt, type Observation } from '@/health/observation';
import type { WorkoutSession } from '@/types';
import { withWorkoutBack, withoutWorkout } from './records';

/** What was recorded with a session (`session:<id>`), as it is stored now. */
const recordedWith = (sessionId: string) => (base: Snapshot): Observation[] => base.observations.filter(o => o.context === `session:${sessionId}`);

/** One of a session's records, moved to the session's new id with `restoredFrom`; its value, times, `editedAt` and `order` as they were. */
function movedTo(o: Observation, from: string, to: string): Observation {
  const own = `session:${from}:`;
  return { ...o, id: o.id.startsWith(own) ? `session:${to}:${o.id.slice(own.length)}` : `session:${to}:${o.id}`, context: `session:${to}`, restoredFrom: o.id };
}

/** Delete a workout at once; resolves with the entry's id. */
export async function deleteWorkout(sessionId: string): Promise<StoreResult<string>> {
  const entry = freshId('deleted-');
  const at = nowAt();
  const rows = recordedWith(sessionId);
  let doomed: WorkoutSession | undefined;
  const result = await update(prev => {
    doomed = prev.sessions.find(s => s.id === sessionId);
    return withoutWorkout(prev, sessionId);
  }, {
    edit: false,
    removeObservations: base => rows(base).map(o => o.id),
    content: base => (doomed ? { put: { [recentKey(entry)]: sessionEntry(doomed, { entry, at }, rows(base)) } } : undefined),
  });
  if (!result.ok) return result;
  return doomed ? { ok: true, value: entry } : { ok: false, failure: new StoreFailure('invalid', 'That workout is no longer on this device.') };
}

/** Undo, or Restore in Recently deleted: back under a fresh id with what was recorded with it, the entry used up, in one change. */
export async function restoreWorkout(entryId: string): Promise<StoreResult<Restored>> {
  const entry = restorable(getState().contentState, entryId, Date.now());
  if (!entry || entry.kind !== 'session' || !entry.session) return { ok: false, failure: new StoreFailure('invalid', NOT_RECENT) };
  const session = entry.session;
  const id = generateId();
  const rows = (entry.observations ?? []).map(o => movedTo(o, session.id, id));
  // The session says the score its record came back with, so nothing works the old one out again (P8S-06).
  const pain = rows.find(o => o.kind === 'backPain')?.value;
  const result = await update(prev => withWorkoutBack(prev, session, id, pain), {
    edit: false,
    entry: entryId,
    restored: () => rows,
    content: () => ({ put: { [lineageKey(`session:${session.id}`)]: { to: `session:${id}`, at: nowAt() } } }),
  });
  return result.ok ? { ok: true, value: { kind: 'session', id } } : result;
}
```

  - `src/components/checkin/pending.ts`: import `bpPartialId` from `@/engine/readiness`, `checkInReadingEntry` and `recentKey` from `@/store/recent`, `freshId` is not imported here (the caller makes the entry id), and `type Observation` if not already. `StoreUpdate`'s options become the store's own `UpdateOptions` (`import type { UpdateOptions } from '@/store/useStore'`), which now carries `content`, `entry`, `restored` and `edit`. `withReadingRemoved` becomes `takenOut`, which says what it took and where it stood, with `withReadingRemoved` kept as its record:

```ts
/** What a check-in reading's delete took out, and where it stood, so a restore can put it back as it was (D110). */
export type KeptReading =
  | { kind: 'glucose'; slot: 'current' | 'earlier'; entry: GlucoseReading }
  | { kind: 'pressure'; slot: 'readings' | 'earlier' | 'summary'; entry: BpReading; halves: BpPartialReading[] }
  | { kind: 'backPain' | 'legPain'; value: number };

/**
 * The record with one reading taken out, and what it took; undefined when it
 * holds no such reading. What deleting it in Track means, so the record cannot
 * bring it back. Deleting the latest glucose makes the one before it the
 * latest again, as it was before that reading was entered; deleting a current
 * blood-pressure reading works the day's average out again from the rest.
 */
export function takenOut(record: DailyCheckIn, r: CheckInReading): { record: DailyCheckIn; kept: KeptReading } | undefined {
  if (r.kind === 'glucose') {
    const where = findGlucose(record, r);
    if (!where) return undefined;
    const { glucose: _gone, glucoseEarlier: _list, ...rest } = record;
    void _gone; void _list;
    if ('earlier' in where) {
      const entry = record.glucoseEarlier![where.earlier] as GlucoseReading;
      const glucoseEarlier = record.glucoseEarlier!.filter((_, j) => j !== where.earlier);
      return { record: { ...rest, ...(record.glucose ? { glucose: record.glucose } : {}), ...(glucoseEarlier.length ? { glucoseEarlier } : {}) }, kept: { kind: 'glucose', slot: 'earlier', entry } };
    }
    // The latest went; with no HI or LO shown after it, the one before it is the latest again.
    const earlier = [...(record.glucoseEarlier ?? [])];
    const before = record.glucoseDisplay ? undefined : earlier.pop();
    const promoted = before === undefined ? {} : 'display' in before ? { glucoseDisplay: before } : { glucose: before };
    return { record: { ...rest, ...promoted, ...(earlier.length ? { glucoseEarlier: earlier } : {}) }, kept: { kind: 'glucose', slot: 'current', entry: record.glucose! } };
  }

  if (r.kind === 'pressure') {
    const halves = record.bpPartial ?? [];
    const said = (b: BpReading) => b.sys === r.sys && b.dia === r.dia;
    const tests: ((b: BpReading) => boolean)[] = [b => sameInstant(b.at, r.at) && said(b), b => b.at === undefined && said(b), b => sameInstant(b.at, r.at)];
    for (const test of tests) {
      const i = record.bpReadings?.findIndex(test) ?? -1;
      if (i >= 0) {
        const bpReadings = record.bpReadings!.filter((_, j) => j !== i);
        const { bp: _bp, bpReadings: _all, ...rest } = record;
        void _bp; void _all;
        const entry = record.bpReadings![i];
        return { record: halvesWith(bpReadings.length ? { ...rest, bpReadings, bp: average(bpReadings) } : rest, entry), kept: { kind: 'pressure', slot: 'readings', entry, halves } };
      }
      const k = record.bpEarlier?.findIndex(test) ?? -1;
      if (k >= 0) {
        const bpEarlier = record.bpEarlier!.filter((_, j) => j !== k);
        const { bpEarlier: _list, ...rest } = record;
        void _list;
        const entry = record.bpEarlier![k];
        return { record: halvesWith(bpEarlier.length ? { ...rest, bpEarlier } : rest, entry), kept: { kind: 'pressure', slot: 'earlier', entry, halves } };
      }
    }
    // An older record kept its one reading only as the day's summary.
    if (!record.bpReadings?.length && record.bp && said(record.bp)) {
      const { bp: _bp, ...rest } = record;
      void _bp;
      return { record: halvesWith(rest, record.bp), kept: { kind: 'pressure', slot: 'summary', entry: record.bp, halves } };
    }
    return undefined;
  }

  const field = r.kind === 'backPain' ? 'pain' : 'legPain';
  if (record.back?.[field] !== r.value) return undefined;
  const { [field]: _score, ...back } = record.back;
  void _score;
  const { back: _back, ...rest } = record;
  void _back;
  return { record: Object.keys(back).length ? { ...rest, back } : rest, kept: { kind: r.kind, value: r.value } };
}

export function withReadingRemoved(record: DailyCheckIn, r: CheckInReading): DailyCheckIn | undefined {
  return takenOut(record, r)?.record;
}

/**
 * A reading a delete took out, put back where it stood (D110): the latest
 * again if it was, with the one promoted when it went back before it; a blood
 * pressure reading among the day's again, its average worked out again and
 * its half-entered numbers relinked. 'already' when the record holds it
 * already; 'newer' when a pain score has been answered again since: that
 * answer is the day's own (K8-06).
 */
export function withReadingPutBack(record: DailyCheckIn, k: KeptReading): DailyCheckIn | 'already' | 'newer' {
  if (k.kind === 'glucose') {
    const same = (e: GlucoseEntry) => !('display' in e) && e.value === k.entry.value && e.unit === k.entry.unit
      && (sameInstant(e.measuredAt, k.entry.measuredAt) || (e.measuredAt === undefined && k.entry.measuredAt === undefined));
    if ([...(record.glucoseEarlier ?? []), ...(record.glucose ? [record.glucose] : [])].some(same)) return 'already';
    if (k.slot === 'current' && !record.glucoseDisplay) {
      const earlier = [...(record.glucoseEarlier ?? []), ...(record.glucose ? [record.glucose] : [])];
      return { ...record, glucose: k.entry, ...(earlier.length ? { glucoseEarlier: earlier } : {}) };
    }
    return { ...record, glucoseEarlier: [...(record.glucoseEarlier ?? []), k.entry] };
  }
  if (k.kind === 'pressure') {
    const same = (b: BpReading) => b.sys === k.entry.sys && b.dia === k.entry.dia && (sameInstant(b.at, k.entry.at) || (b.at === undefined && k.entry.at === undefined));
    if ([...(record.bpReadings ?? []), ...(record.bpEarlier ?? []), ...(record.bp && !record.bpReadings?.length ? [record.bp] : [])].some(same)) return 'already';
    const byId = new Map((record.bpPartial ?? []).map(h => [bpPartialId(h, record.date), h] as const));
    for (const h of k.halves) byId.set(bpPartialId(h, record.date), h);
    const withHalves = byId.size ? { bpPartial: [...byId.values()] } : {};
    if (k.slot === 'earlier') return { ...record, bpEarlier: [...(record.bpEarlier ?? []), k.entry], ...withHalves };
    if (k.slot === 'summary' && !record.bpReadings?.length && !record.bp) return { ...record, bp: k.entry, ...withHalves };
    const bpReadings = [...(record.bpReadings ?? []), k.entry];
    return { ...record, bpReadings, bp: average(bpReadings), ...withHalves };
  }
  const field = k.kind === 'backPain' ? 'pain' : 'legPain';
  if (record.back?.[field] === k.value) return 'already';
  if (record.back?.[field] !== undefined) return 'newer';
  return { ...record, back: { ...(record.back ?? {}), [field]: k.value } };
}

export const ALREADY_BACK = 'Already back in your check-in.';
export const NEWER_STAYS = 'Your newer answer stays.';
```

    `CorrectionResult` gains `/** A restore that had nothing to put back (K8-06): the check-in holds it already, or has a newer answer. */ unchanged?: 'already' | 'newer';`. `removeCheckInReading` gains a fourth, optional parameter, and writes its entry with it:

```ts
export function removeCheckInReading(
  r: CheckInReading,
  observationIds: readonly string[],
  deps: { profile: UserProfile; update: StoreUpdate; date: string },
  /** A routine delete (D111): kept in Recently deleted for 7 days, with the readings as Track showed them. */
  recent?: { entry: string; at: string; observations: readonly Observation[] },
): Promise<CorrectionResult> {
  let kept: KeptReading | undefined;
  return reviseCheckIn(record => {
    const out = takenOut(record, r);
    kept = out?.kept;
    return out?.record;
  }, deps, {
    removeObservations: observationIds,
    ...(recent ? {
      edit: false as const,
      content: () => (kept ? { put: { [recentKey(recent.entry)]: checkInReadingEntry(recent, deps.date, kept, recent.observations) } } : undefined),
    } : {}),
  });
}

/**
 * A check-in's reading put back from Recently deleted (B-05, D110, D111,
 * P8R-03): into its day's check-in where it stood, and its rows into the
 * series under fresh ids with `restoredFrom`, the entry used up, in one
 * write. What was measured is its identity, apart from any row's id (R5-01):
 * `prepare` drops the measurement's deletion record as its row returns, and
 * keeps the old id's, so an older backup can't bring the old row back beside
 * it. When the check-in holds it already, or has a newer pain answer, nothing
 * is put back and the entry goes all the same, with words to say so (K8-06).
 */
export async function restoreCheckInReading(
  entry: { id: string; kept: KeptReading; observations?: readonly Observation[] },
  deps: { profile: UserProfile; update: StoreUpdate; date: string },
): Promise<CorrectionResult> {
  let unchanged: 'already' | 'newer' | undefined;
  // One stem for the whole reading, so a blood pressure's two halves stay one reading: letters and digits
  // only, the token `checkInDayOf` reads after `#`, so the rows stay the check-in's (P8S-07).
  const stem = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.replace(/[^0-9a-z]/g, '');
  const rows = (entry.observations ?? []).map(o => ({
    ...o,
    id: `${stem}:${o.kind}`,
    ...(o.context?.startsWith('bp:') ? { context: `bp:checkIn:${deps.date}#${stem}` } : {}),
    restoredFrom: o.id,
  }));
  const result = await reviseCheckIn(record => {
    const next = withReadingPutBack(record, entry.kept);
    unchanged = typeof next === 'string' ? next : undefined;
    return typeof next === 'string' ? undefined : next;
  }, deps, {
    readings: 'append',
    edit: false,
    entry: entry.id,
    restored: () => (unchanged ? [] : rows),
  });
  // Nothing to put back: the entry was still used up, in that same write.
  return unchanged ? { ...result, matched: true, unchanged } : result;
}
```

    Its blood pressure halves keep one fresh context, `bp:checkIn:<day>#<stem>`, the stem letters and digits only, which `checkInDayOf` reads as that check-in's (never `freshId`, whose hyphens it doesn't: Codex P8S-07), so they pair with each other and with no other reading, and the check-in's own correction and delete find them. `reviseCheckIn`'s `options` parameter takes `NonNullable<Parameters<StoreUpdate>[1]>`, passed through to `update` as it is. In `src/screens/track/RecordDetails.tsx` (Plan 2's), the one caller of `withReadingRemoved` is unchanged. Append to `src/components/checkin/pending.test.ts`, adding `takenOut` and `withReadingPutBack` to its import:

```ts
describe('a check-in reading taken out and put back as it was (D110, D111, K8-06)', () => {
  const day = '2026-10-08';
  const g = (value: number, hhmm: string) => ({ value, unit: 'mg/dL' as const, measuredAt: `${day}T${hhmm}:00.000+05:30`, source: 'meter' as const });
  const rec = { date: day, urgentSymptoms: false, news: [], glucoseEarlier: [g(60, '08:00')], glucose: g(110, '08:20'), bpReadings: [{ sys: 190, dia: 100, at: `${day}T08:30:00.000+05:30` }], bp: { sys: 190, dia: 100 }, back: { pain: 6 } };

  it('puts the latest glucose back as the latest, the one promoted back before it', () => {
    const out = takenOut(rec, { kind: 'glucose', at: g(110, '08:20').measuredAt, value: 110, unit: 'mg/dL' })!;
    expect(out.record.glucose?.value).toBe(60);
    expect(withReadingPutBack(out.record, out.kept)).toMatchObject({ glucose: { value: 110 }, glucoseEarlier: [{ value: 60 }] });
  });

  it('puts a blood pressure reading back with its average, and a pain score unless it is there or answered again', () => {
    const bp = takenOut(rec, { kind: 'pressure', at: rec.bpReadings[0].at, sys: 190, dia: 100 })!;
    expect(bp.record.bpReadings).toBeUndefined();
    expect(withReadingPutBack(bp.record, bp.kept)).toMatchObject({ bpReadings: [{ sys: 190, dia: 100 }], bp: { sys: 190, dia: 100 } });
    const pain = takenOut(rec, { kind: 'backPain', value: 6 })!;
    expect(withReadingPutBack(pain.record, pain.kept)).toMatchObject({ back: { pain: 6 } });
    expect(withReadingPutBack({ ...pain.record, back: { pain: 2 } }, pain.kept)).toBe('newer');
    expect(withReadingPutBack(rec, pain.kept)).toBe('already');
    expect(withReadingPutBack(rec, bp.kept)).toBe('already');
  });
});
```

- [ ] **Step 10: The store's own tests:** every carrier, the raw rows, expiry in every way it happens, every restore's eligibility as it commits, a check-in reading's rows back, and a session with what was recorded with it. Write `src/store/recent.store.test.ts`:

```ts
/**
 * Recently deleted through the real store, read back from IndexedDB itself:
 * "Erase all routes" with a deleted walk and a planted `settings.deleted.recent`
 * (Review Focus 3, D93, D109, P8-11); expiry at a start, on a return and on
 * time while the page runs, with nothing else deleted, and never on a clock
 * set back (P8-12, P8R-14, K8-01); every kind of restore refusing an entry
 * past its 7 days, one whose 7 days end while it waits behind another write
 * included (P8R-14, P8S-09); a check-in's reading back in its check-in and in
 * the series under fresh ids (P8R-03), a blood pressure's still that day's
 * for its detail's correction and delete (P8S-07), or, with nothing to put
 * back, its entry gone with words to say so (K8-06); and a session's pain
 * score, corrected since, back as it was (P8S-06).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyCheckIn } from '@/types/checkin';
import { createDefaultProfile } from '@/profile/defaults';
import { routeRecord } from '@/walk/routeRecord';
import { DB_NAME, STORE_NAMES } from './db';
import { fakeIndexedDB } from './fakeIdb';
import { RECENT_MS, isRecentKey } from './recent';
import type { StoredRecord } from './records';

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;
const heard: (() => void)[] = [];
const doc = { visibilityState: 'visible', addEventListener: (_t: string, fn: () => void) => void heard.push(fn), removeEventListener() {} };
Object.assign(globalThis, { document: doc });

const store = await import('./useStore');
const { decode } = await import('./transfer');
const { evaluateCheckIn } = await import('@/engine/readiness');
const { ALREADY_BACK, correctCheckInPressure, removeCheckInReading, resetPendingCheckInsForTests, restoreCheckInReading } = await import('@/components/checkin/pending');
const { checkInDayOf } = await import('@/health/observation');
const { asRecent, recentKey } = await import('./recent');
const { deleteWorkout, restoreWorkout } = await import('@/screens/workout/deletion');

const NOW = new Date('2026-10-08T09:00:00+05:30');
const AT = '2026-10-08T09:00:00.000+05:30';
const DAY = '2026-10-08';
const W = 'mgh3k2x1-1a2b3c4d';
const ROUTE = routeRecord(W, AT, [{ start: NOW.getTime(), end: NOW.getTime() + 20_000, coords: [[12.97, 77.59], [12.971, 77.5905]], ms: [0, 20_000] }])! as unknown as StoredRecord;
const walked = (['walkDuration', 'movementMinutes'] as const).map(kind =>
  ({ id: `${W}:s0:${kind}`, kind, value: 20, scope: 'sessionObserved' as const, source: 'measured' as const, at: AT, coverageMs: 1_200_000, context: `walk:${W}` }));
const PROFILE = createDefaultProfile({ health: { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous', glucoseMonitor: 'meter', glucoseUnit: 'mg/dL', diabetes: 'type2' } });
let fake: ReturnType<typeof fakeIndexedDB>;

/** Every row of every store, as IndexedDB holds them now, at whatever version it has. */
async function rawRows(): Promise<Record<string, unknown[]>> {
  const db = await new Promise<IDBDatabase>(resolve => {
    const req = fake.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
  });
  const out: Record<string, unknown[]> = {};
  for (const name of STORE_NAMES) {
    out[name] = await new Promise<unknown[]>(resolve => {
      const req = db.transaction(name).objectStore(name).getAll();
      req.onsuccess = () => resolve(req.result as unknown[]);
    });
  }
  db.close();
  return out;
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const recentRows = async () => (await rawRows())['content-state'].filter(r => isRecentKey((r as { key: string }).key));
const DAY_MS = 24 * 60 * 60 * 1000;
const reading = (i: number) => ({ kind: 'glucose' as const, value: 100 + i, unit: 'mg/dL', scope: 'pointInTime' as const, source: 'manual' as const, at: `2026-10-08T0${i % 9}:00:00+05:30`, id: `g${i}` });

async function boot() {
  store.resetForTests();
  resetPendingCheckInsForTests();
  fake = fakeIndexedDB();
  await store.start({ factory: fake, broadcast: null });
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  local.clear();
  heard.length = 0;
  await boot();
});
afterEach(() => {
  store.resetForTests();
  vi.useRealTimers();
});

describe('"Erase all routes" reaches every carrier (Review Focus 3, D93, D109, P8-11)', () => {
  it('leaves no coordinate in the store, its raw rows or the next backup, and the walk comes back without one', async () => {
    expect((await store.setSettings({ walk: { saveRoutes: true, map: 'off' } } as never)).ok).toBe(true);
    expect((await store.addObservations(walked)).ok).toBe(true);
    expect((await store.putRecords('routes', [ROUTE])).ok).toBe(true);
    const deleted = await store.deleteRecord({ kind: 'walk', walkId: W });
    if (!deleted.ok) throw deleted.failure;
    // A file an older build kept: coordinates under settings.deleted.recent, where this app never writes.
    await store.setSettings({ deleted: { ...store.getState().settings.deleted, recent: [{ at: AT, store: 'routes', record: ROUTE }] } } as never);
    expect(JSON.stringify((await rawRows()).settings)).toMatch(/12\.97/);
    expect(JSON.stringify((await rawRows())['content-state'])).toMatch(/12\.97/);
    expect((await store.eraseRoutes()).ok).toBe(true);
    expect(JSON.stringify(await rawRows())).not.toMatch(/12\.97|77\.59/);
    expect(JSON.stringify(store.getState())).not.toMatch(/12\.97|77\.59/);
    const backup = await store.exportRecord({ include: ['routes'] });
    if (!backup.ok) throw backup.failure;
    expect(JSON.stringify(await decode(backup.value.bytes))).not.toMatch(/12\.97|77\.59/);
    const back = await store.restoreDeleted(deleted.value);
    if (!back.ok) throw back.failure;
    expect(store.getState().records.routes).toEqual([]);
    expect(store.getState().observations.filter(o => o.context === `walk:${back.value.id}`)).toHaveLength(2);
  });

  it('drops a planted `settings.deleted.recent` at the next start, and keeps every other deletion record', async () => {
    await store.setSettings({ deleted: { observations: ['gone-1'], recent: [{ at: AT, store: 'routes', record: ROUTE }] } } as never);
    store.resetForTests();
    await store.start({ factory: fake, broadcast: null });
    await settle();
    const settings = (await rawRows()).settings.find(r => (r as { key: string }).key === 'settings') as { value: { deleted?: Record<string, unknown> } };
    expect(settings.value.deleted).toEqual({ observations: ['gone-1'] });
  });
});

describe('every deletion is kept its 7 days, and not a moment longer (D109, P8-12, P8R-14, K8-01)', () => {
  it('drops an entry past 7 days at the next start, with nothing else deleted, from IndexedDB itself', async () => {
    expect((await store.addObservation(reading(1))).ok).toBe(true);
    expect((await store.deleteRecord({ kind: 'reading', id: 'g1' })).ok).toBe(true);
    store.resetForTests();
    vi.setSystemTime(new Date(NOW.getTime() + RECENT_MS + 60_000));
    await store.start({ factory: fake, broadcast: null });
    await settle();
    expect(await recentRows()).toEqual([]);
  });

  it('drops it on a return to the app, too', async () => {
    expect((await store.addObservation(reading(2))).ok).toBe(true);
    expect((await store.deleteRecord({ kind: 'reading', id: 'g2' })).ok).toBe(true);
    vi.setSystemTime(new Date(NOW.getTime() + RECENT_MS + 60_000));
    for (const fn of heard) fn();
    await settle();
    expect(await recentRows()).toEqual([]);
  });

  it('drops it when its 7 days end while the page runs, with nothing else happening', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(NOW);
    await boot();
    expect((await store.addObservation(reading(3))).ok).toBe(true);
    expect((await store.deleteRecord({ kind: 'reading', id: 'g3' })).ok).toBe(true);
    await vi.advanceTimersByTimeAsync(RECENT_MS - 60_000);
    expect(await recentRows()).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(await recentRows()).toEqual([]);
  });

  it('never ends anything while the clock reads earlier than the last time expiry ran', async () => {
    expect((await store.addObservation(reading(4))).ok).toBe(true);
    expect((await store.deleteRecord({ kind: 'reading', id: 'g4' })).ok).toBe(true);
    // The clock set a month ahead: g4's entry ends, and expiry runs at that time.
    vi.setSystemTime(new Date(NOW.getTime() + 30 * DAY_MS));
    for (const fn of heard) fn();
    await settle();
    expect(await recentRows()).toEqual([]);
    // Set back, a reading deleted, and the clock a week and a day on: still behind that run, so nothing ends.
    vi.setSystemTime(new Date(NOW.getTime() + 60 * 60 * 1000));
    expect((await store.addObservation(reading(5))).ok).toBe(true);
    expect((await store.deleteRecord({ kind: 'reading', id: 'g5' })).ok).toBe(true);
    vi.setSystemTime(new Date(NOW.getTime() + 8 * DAY_MS));
    for (const fn of heard) fn();
    await settle();
    expect((await recentRows()).map(r => (r as { value: { of: string } }).value.of)).toEqual(['g5']);
    // Past that run again, it ends as it should.
    vi.setSystemTime(new Date(NOW.getTime() + 31 * DAY_MS));
    for (const fn of heard) fn();
    await settle();
    expect(await recentRows()).toEqual([]);
  });

  it('is refused by every kind of restore once its 7 days are over, though expiry hasn’t run yet', async () => {
    const day: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 118, unit: 'mg/dL', measuredAt: '2026-10-08T08:50:00.000+05:30', source: 'meter' } };
    await store.update(prev => ({ ...prev, profile: PROFILE, checkIns: [{ ...day, readiness: evaluateCheckIn(PROFILE, day, []) }] }));
    expect((await store.addObservation(reading(7))).ok).toBe(true);
    const reading7 = await store.deleteRecord({ kind: 'reading', id: 'g7' });
    expect((await store.putSession({ id: 's1', date: DAY, dayOfWeek: 'thursday', muscleGroup: 'lower', phase: 'foundation', week: 1, status: 'completed', sets: [], startedAt: AT, completedAt: AT, notes: '', totalVolume: 0 } as never)).ok).toBe(true);
    const workout = await deleteWorkout('s1');
    const lifted = store.getState().observations.find(o => o.kind === 'glucose' && checkInDayOf(o) === DAY)!;
    const deps = { profile: PROFILE, update: store.update, date: DAY };
    await removeCheckInReading({ kind: 'glucose', at: lifted.at, value: 118, unit: 'mg/dL' }, [lifted.id], deps, { entry: 'deleted-ci', at: AT, observations: [lifted] });
    if (!reading7.ok || !workout.ok) throw new Error('not deleted');
    vi.setSystemTime(new Date(NOW.getTime() + RECENT_MS + 1));
    expect(await store.restoreDeleted(reading7.value)).toMatchObject({ ok: false, failure: { message: expect.stringMatching(/no longer in Recently deleted/) } });
    expect(await restoreWorkout(workout.value)).toMatchObject({ ok: false });
    const entry = asRecent(store.getState().contentState[recentKey('deleted-ci')])!;
    expect(await restoreCheckInReading({ id: entry.id, kept: entry.kept!, observations: entry.observations }, deps)).toMatchObject({ stored: false, failure: expect.stringMatching(/no longer in Recently deleted/) });
    expect(store.getState().checkIns[0].glucose).toBeUndefined();
    expect(await recentRows()).toHaveLength(3);
  });

  it('is refused as it commits when its 7 days end while it waits behind another write, whichever kind it is (P8S-09)', async () => {
    const day: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 118, unit: 'mg/dL', measuredAt: '2026-10-08T08:50:00.000+05:30', source: 'meter' } };
    await store.update(prev => ({ ...prev, profile: PROFILE, checkIns: [{ ...day, readiness: evaluateCheckIn(PROFILE, day, []) }] }));
    expect((await store.addObservation(reading(6))).ok).toBe(true);
    const plain = await store.deleteRecord({ kind: 'reading', id: 'g6' });
    expect((await store.putSession({ id: 's2', date: DAY, dayOfWeek: 'thursday', muscleGroup: 'lower', phase: 'foundation', week: 1, status: 'completed', sets: [], startedAt: AT, completedAt: AT, notes: '', totalVolume: 0 } as never)).ok).toBe(true);
    const workout = await deleteWorkout('s2');
    const lifted = store.getState().observations.find(o => o.kind === 'glucose' && checkInDayOf(o) === DAY)!;
    const deps = { profile: PROFILE, update: store.update, date: DAY };
    await removeCheckInReading({ kind: 'glucose', at: lifted.at, value: 118, unit: 'mg/dL' }, [lifted.id], deps, { entry: 'deleted-ci2', at: AT, observations: [lifted] });
    if (!plain.ok || !workout.ok) throw new Error('not deleted');
    const entry = asRecent(store.getState().contentState[recentKey('deleted-ci2')])!;
    // A minute before the 7 days end: a write held just before it commits, and every restore asked for behind it.
    vi.setSystemTime(new Date(NOW.getTime() + RECENT_MS - 60_000));
    fake.control.hold();
    const held = store.addObservation(reading(8));
    const restores = Promise.all([
      store.restoreDeleted(plain.value),
      restoreWorkout(workout.value),
      restoreCheckInReading({ id: entry.id, kept: entry.kept!, observations: entry.observations }, deps),
    ]);
    await settle();
    // The 7 days end while they wait.
    vi.setSystemTime(new Date(NOW.getTime() + RECENT_MS + 60_000));
    fake.control.release();
    expect((await held).ok).toBe(true);
    const [one, two, three] = await restores;
    expect(one).toMatchObject({ ok: false, failure: { message: expect.stringMatching(/no longer in Recently deleted/) } });
    expect(two).toMatchObject({ ok: false });
    expect(three).toMatchObject({ stored: false });
    expect(store.getState().observations.some(o => o.restoredFrom)).toBe(false);
    expect(store.getState().sessions.some(s => s.restoredFrom)).toBe(false);
    expect(store.getState().checkIns[0].glucose).toBeUndefined();
  });
});

describe('a check-in’s reading, out and back (D110, P8R-03, K8-06)', () => {
  const checkIn: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 118, unit: 'mg/dL', measuredAt: '2026-10-08T08:50:00.000+05:30', source: 'meter' } };

  it('comes back into its check-in and into the series under a fresh id, the entry used up, in IndexedDB itself', async () => {
    await store.update(prev => ({ ...prev, profile: PROFILE, checkIns: [{ ...checkIn, readiness: evaluateCheckIn(PROFILE, checkIn, []) }] }));
    const lifted = store.getState().observations.find(o => o.kind === 'glucose' && checkInDayOf(o) === DAY)!;
    const deps = { profile: PROFILE, update: store.update, date: DAY };
    const removed = await removeCheckInReading({ kind: 'glucose', at: lifted.at, value: 118, unit: 'mg/dL' }, [lifted.id], deps, { entry: 'deleted-ci', at: AT, observations: [lifted] });
    expect(removed.stored).toBe(true);
    expect(store.getState().observations.some(o => o.kind === 'glucose' && checkInDayOf(o) === DAY)).toBe(false);
    const entry = asRecent(store.getState().contentState[recentKey('deleted-ci')])!;
    const back = await restoreCheckInReading({ id: entry.id, kept: entry.kept!, observations: entry.observations }, deps);
    expect(back).toMatchObject({ matched: true, stored: true });
    expect(store.getState().checkIns[0].glucose).toMatchObject({ value: 118 });
    const rows = (await rawRows()).observations as { id: string; kind: string; value: number; context?: string; restoredFrom?: string }[];
    const series = rows.filter(o => o.kind === 'glucose' && o.context === `checkIn:${DAY}`);
    expect(series).toEqual([expect.objectContaining({ value: 118, restoredFrom: lifted.id })]);
    expect(series[0].id).not.toBe(lifted.id);
    expect(await recentRows()).toEqual([]);
  });

  it('with nothing to put back, drops the entry and says so, never that it didn’t save', async () => {
    await store.update(prev => ({ ...prev, profile: PROFILE, checkIns: [{ ...checkIn, readiness: evaluateCheckIn(PROFILE, checkIn, []) }] }));
    const lifted = store.getState().observations.find(o => o.kind === 'glucose' && checkInDayOf(o) === DAY)!;
    const deps = { profile: PROFILE, update: store.update, date: DAY };
    await removeCheckInReading({ kind: 'glucose', at: lifted.at, value: 118, unit: 'mg/dL' }, [lifted.id], deps, { entry: 'deleted-ci', at: AT, observations: [lifted] });
    const entry = asRecent(store.getState().contentState[recentKey('deleted-ci')])!;
    // The same reading answered again in the check-in meanwhile.
    await store.update(prev => ({ ...prev, checkIns: [{ ...checkIn, readiness: evaluateCheckIn(PROFILE, checkIn, []) }] }));
    const back = await restoreCheckInReading({ id: entry.id, kept: entry.kept!, observations: entry.observations }, deps);
    expect(back).toMatchObject({ matched: true, stored: true, unchanged: 'already' });
    expect(ALREADY_BACK).toBe('Already back in your check-in.');
    expect(await recentRows()).toEqual([]);
  });

  it('a blood pressure out and back is that day’s again: its detail corrects and deletes it as the check-in’s, and nothing brings it back (P8S-07)', async () => {
    const bpDay: DailyCheckIn = { ...checkIn, bp: { sys: 124, dia: 78 }, bpReadings: [{ sys: 124, dia: 78, at: '2026-10-08T08:52:00.000+05:30' }] };
    await store.update(prev => ({ ...prev, profile: PROFILE, checkIns: [{ ...bpDay, readiness: evaluateCheckIn(PROFILE, bpDay, []) }] }));
    const halves = () => store.getState().observations.filter(o => (o.kind === 'bloodPressureSystolic' || o.kind === 'bloodPressureDiastolic') && checkInDayOf(o) === DAY);
    const values = () => halves().map(o => o.value).sort((a, b) => a - b);
    const deps = { profile: PROFILE, update: store.update, date: DAY };
    const at = halves()[0].at;
    expect((await removeCheckInReading({ kind: 'pressure', at, sys: 124, dia: 78 }, halves().map(o => o.id), deps, { entry: 'deleted-bp', at: AT, observations: halves() })).stored).toBe(true);
    expect(halves()).toEqual([]);
    const entry = asRecent(store.getState().contentState[recentKey('deleted-bp')])!;
    expect((await restoreCheckInReading({ id: entry.id, kept: entry.kept!, observations: entry.observations }, deps)).stored).toBe(true);
    // Both halves read as that day's check-in's, under one context: one reading.
    expect(halves()).toHaveLength(2);
    expect(halves().every(o => checkInDayOf(o) === DAY && o.context === halves()[0].context && o.restoredFrom)).toBe(true);
    // Its detail's correction finds them: the check-in and the series corrected together, still one reading.
    expect((await correctCheckInPressure({ at, was: { sys: 124, dia: 78 }, to: { sys: 126, dia: 78 } }, deps)).stored).toBe(true);
    expect(store.getState().checkIns[0].bpReadings).toEqual([expect.objectContaining({ sys: 126, dia: 78 })]);
    expect(values()).toEqual([78, 126]);
    // And its delete takes it out of both, so a later save of the check-in brings nothing back.
    expect((await removeCheckInReading({ kind: 'pressure', at, sys: 126, dia: 78 }, halves().map(o => o.id), deps)).stored).toBe(true);
    await store.update(prev => ({ ...prev, checkIns: prev.checkIns.map(c => ({ ...c, energy: 3 })) }));
    expect(halves()).toEqual([]);
    expect(store.getState().checkIns[0].bpReadings ?? []).toEqual([]);
  });
});

describe('a session and what was recorded with it, out and back as they were (P8S-06)', () => {
  it('a pain score corrected since comes back corrected, under the session’s new id, with its own times and place, and no later save undoes it', async () => {
    const earlier = { id: 's9', date: '2026-10-06', dayOfWeek: 'tuesday', muscleGroup: 'lower', phase: 'foundation', week: 1, status: 'completed', sets: [], startedAt: '2026-10-06T08:00:00.000+05:30', completedAt: '2026-10-06T08:40:00.000+05:30', notes: '', totalVolume: 0, painAfter: 2 };
    const pain = () => store.getState().observations.filter(o => o.kind === 'backPain');
    expect((await store.putSession(earlier as never)).ok).toBe(true);
    expect(pain()).toEqual([expect.objectContaining({ id: 'session:s9:backPain', value: 2 })]);
    // Corrected in Track since: the session itself still says 2.
    vi.setSystemTime(new Date(NOW.getTime() + 60_000));
    expect((await store.editObservation('session:s9:backPain', { value: 4 })).ok).toBe(true);
    const corrected = pain()[0];
    const deleted = await deleteWorkout('s9');
    if (!deleted.ok) throw deleted.failure;
    expect(pain()).toEqual([]);
    const back = await restoreWorkout(deleted.value);
    if (!back.ok) throw back.failure;
    expect(pain()).toEqual([expect.objectContaining({
      id: `session:${back.value.id}:backPain`, context: `session:${back.value.id}`, value: 4, restoredFrom: 'session:s9:backPain',
      editedAt: corrected.editedAt, order: corrected.order, was: corrected.was,
    })]);
    const again = store.getState().sessions.find(s => s.id === back.value.id)!;
    expect(again.painAfter).toBe(4);
    // Saved again, the session works out nothing new from an older score.
    expect((await store.putSession({ ...again, notes: 'felt fine' })).ok).toBe(true);
    expect(pain()).toEqual([expect.objectContaining({ value: 4, editedAt: corrected.editedAt })]);
  });
});
```

Run: `npx vitest run src/store src/components/checkin src/screens/workout`
Expected: PASS.

- [ ] **Step 11: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/store src/types/index.ts src/health/observation.ts src/health/observation.test.ts src/walk/routeRecord.ts src/food/types.ts src/components/checkin/pending.ts src/components/checkin/pending.test.ts src/screens/workout/records.ts src/screens/workout/records.test.ts src/screens/workout/deletion.ts
git commit -m "feat: Keep every deletion 7 days as one entry, and restore it under fresh ids with its references, lineage and order"
```

---

### Task 6: A change never lifts a hold: refused before anything is written, with v1's way out for a reading typed wrongly (J§4.6, A-05)

Codex P8-01, P8R-01 and P8S-01 to P8S-05, Kiro K8-07 and K8-08: the gates read standalone readings through `effectiveCheckIns` (`pending.ts`, `useGuided.ts`, `gate.ts`), so deleting a standalone 52 mg/dL low, retiming a 186/98 to yesterday or correcting the 52 to 152 turned a stop into an allowed walk, with no trace of the reading left. J§4.6 says "Undo, delete, retiming, imports and later normal readings never resolve a real low, stop or flag. Corrections keep their history, and resolution follows each incident's own rule, as v1 does." This task makes the store refuse such a change outright, so nothing has to be kept on the side: the reading stays in its record, every gate goes on reading it as it always has, and once the engine has released it by its own rule, or the person has said it was typed wrongly, the same change goes through.

**Files:**
- Create: `src/store/holds.ts`, `src/store/holds.test.ts`, `src/store/holds.callers.test.ts`
- Create: `src/components/checkin/HeldProblem.tsx`
- Modify: `src/store/db.ts` (`FailureCode` gains `'held'`; `HoldFailure`, `isHeld`, `HOLD_REFUSAL`, `MISTAKE_HINT`, `CLOCK_REFUSAL`, `type HeldReading`)
- Modify: `src/store/useStore.ts` (`planOn` asks the engine about every change that takes away or alters a clinical measurement or removes a check-in, whoever asks for it; `Mutation.erasesAll` for "Delete all data"; a refusal is never the storage banner's)
- Modify: `src/health/observation.ts`, `src/health/observation.test.ts` (`reviseObservation` keeps what a correction replaced: `Observation.was`)
- Modify: `src/components/checkin/pending.ts` (a refused correction or removal gives back what was waiting; `CorrectionResult.held`; `answerMistakes`)
- Modify: `src/screens/track/EditSheets.tsx` (a refused correction or retime shows `HeldProblem`)

**Interfaces:**
- Consumes: `permission`, `readinessFor`, `type Permission`, `type PermissionInput` (`src/engine/permission.ts`); `glucoseReadingId`, `bpReadingId`, `bpPartialId`, `ketoneReadingId`, `standingAnswer`, `toMgdl`, `withLogged` (`src/engine/readiness.ts`: the engine's own names for a measurement, and its own reading of an answer); `effectiveCheckIns(stored, profile, observations, clock?)`, `saveWith` (inside `pending.ts`), `pendingCheckIn` (`pending.ts`); Plan 6's device clock hold (board D174, H6R-02): `settings.walk.clock` (`ClockHold { generation, days }`) and `markClockChange(days)` (`useStore.ts`); `createDefaultProfile` (`@/profile/defaults`); `toDateString` (`@/lib/utils`); `DISPOSITION_ORDER`, `Readiness`, `EpisodeAnswer`, `EpisodeKind`, `Mode` (`src/types/checkin.ts`); `deviceClinical`, `walkInput` (`src/walk/gate.ts`, for the tests); Task 5's `deleteRecord`, `restoreDeleted` and `isRecentKey`; Plan 6's H6-03 (`importRecord`'s Replace and both merges keep this device's open incidents).
- Produces:
  - in `src/store/db.ts`: `HOLD_REFUSAL = 'This reading is keeping movement on hold, so it can’t be changed or removed yet.'`; `MISTAKE_HINT = 'If it was typed wrongly, choose ‘It was a mistake’.'`; `CLOCK_REFUSAL`; `interface HeldReading { kind: EpisodeKind; id: string }`; `class HoldFailure extends StoreFailure { held; release? }` (code `'held'`), built `new HoldFailure(held, release?, said?)`; `isHeld(failure): failure is HoldFailure`;
  - in `src/store/holds.ts`: `interface Clinical`; `clinicalOf(snapshot)`; `measurements(clinical): Map<string, HeldReading>`; `touchesClinical(change, base)`; `clockHoldOn(settings, now)`; `looser(before, after)` (two `Permission`s); `loosens(before, after)` (two `Readiness`es); `holdLifted(before, after, now, { clock?, removedDays? }): { held; release?; said? } | undefined`;
  - in `useStore.ts`: `Mutation.erasesAll?: true`;
  - in `src/health/observation.ts`: `Observation.was?: { value; unit; at; editedAt? }[]`, `MAX_CORRECTIONS = 50`;
  - in `pending.ts`: `CorrectionResult.held?: HoldFailure`; `answerMistakes(held, deps, now?): Promise<SaveResult>`;
  - `HeldProblem({ failure, profile, onAnswered })` and `MISTAKE_LABEL = 'It was a mistake'` (`src/components/checkin/HeldProblem.tsx`).

**The rule, in one place** (D119). Every change the store is asked for that takes away or alters a clinical measurement (a glucose or blood pressure reading, Track's or a check-in's, a half-entered blood pressure, a ketone result) or removes a check-in is asked of the engine before it is shown or written, whoever asks for it: `planOn` runs the question for every mutation, the public `update` included, so no caller has to remember it (Codex P8S-03). A change that only adds, an answer or a re-check, takes nothing away and isn't asked. The measurements a change takes away are named the engine's own way (`glucoseReadingId`, `bpReadingId`, `bpPartialId`, `ketoneReadingId`), and those, and only those, are what "It was a mistake" answers: never a reading that merely stops being asked about once its partner goes (Codex P8S-01). The engine is asked before and after, against what is stored: every mode's `permission` now, and the day's answer today and tomorrow (K8-08). If the change would let any mode do more, or stop the engine asking about a serious reading, it is refused and nothing is written, unless each measurement it takes away has been answered as typed wrongly, as the engine's `standingAnswer` reads every answer. "It was a mistake" gives that answer, for exactly those measurements, in today's check-in, as the check-in sheet's "I typed it wrongly" does; the change is then tried again and goes through, and the answer stays with the reading's history. A correction the hold allows keeps what it replaced on the record it corrected: the earlier value, its time and when it was corrected (Codex P8S-05). While the phone's clock change holds the device (Plan 6's `settings.walk.clock`, board D174), nothing clinical is changed or removed at all, since no reading's age can be known (Codex P8S-02). "Delete all data" isn't asked: it is the person's confirmed choice to erase everything (`Mutation.erasesAll`).

- [ ] **Step 1: Write the failing tests** `src/store/holds.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { Permission } from '@/engine/permission';
import { bpReadingId } from '@/engine/readiness';
import type { Readiness } from '@/types/checkin';
import { emptySnapshot } from './snapshot';
import { clockHoldOn, loosens, looser, measurements, touchesClinical } from './holds';

const ready = (over: Partial<Readiness>): Readiness => ({ outcome: 'green', modifiers: [], back: 'green', nerveFlag: false, reasons: [], actions: [], vigorousLocked: false, capHeavy: false, rpeOnly: true, notices: [], ...over });
const allowed = (over: Partial<Permission> = {}): Permission => ({ mode: 'walk', allowed: true, disposition: 'reassure', reasons: [], restrictions: [], codes: [], needsCheckIn: false, ...over });
const refused = (over: Partial<Permission> = {}): Permission => allowed({ allowed: false, disposition: 'hold', ...over });

describe('what lets a mode do more, as the engine says it (D119)', () => {
  it('a refusal gone, a gentler disposition, or a restriction gone', () => {
    expect(looser(refused(), allowed())).toBe(true);
    expect(looser(refused({ disposition: 'today' }), refused({ disposition: 'hold' }))).toBe(true);
    expect(looser(allowed({ disposition: 'adjust', codes: ['capHeavy'] }), allowed())).toBe(true);
    expect(looser(allowed({ codes: ['INT', 'capHeavy'] }), allowed({ codes: ['INT'] }))).toBe(true);
    expect(looser(allowed(), refused())).toBe(false);
    expect(looser(refused({ disposition: 'hold' }), refused({ disposition: 'today' }))).toBe(false);
    expect(looser(allowed({ codes: ['INT'] }), allowed({ codes: ['INT', 'capHeavy'] }))).toBe(false);
  });
});

describe('what makes the day’s answer less strict (D119)', () => {
  const hold = { code: 'severeLow', message: '', outcome: 'red' as const, disposition: 'today' as const };
  it('a restriction gone, a serious reading no longer asked about, a mode or cap lifted, or a re-check sooner', () => {
    expect(loosens(ready({ reasons: [hold] }), ready({}))).toBe(true);
    expect(loosens(ready({}), ready({ reasons: [hold] }))).toBe(false);
    expect(loosens(ready({ reasons: [{ ...hold, disposition: 'reassure' }] }), ready({}))).toBe(false);
    expect(loosens(ready({ episodes: [{ kind: 'severeLow', readings: [{ id: 'g:1', label: '' }] }] }), ready({}))).toBe(true);
    expect(loosens(ready({ episodes: [{ kind: 'severeLow', readings: [{ id: 'g:1', label: '', settled: 'mistake' }] }] }), ready({}))).toBe(false);
    expect(loosens(ready({ refusedModes: ['walk'] }), ready({}))).toBe(true);
    expect(loosens(ready({ modifiers: ['INT'] }), ready({}))).toBe(true);
    expect(loosens(ready({ capHeavy: true }), ready({}))).toBe(true);
    expect(loosens(ready({ recheckAt: '2026-10-08T09:15:00+05:30' }), ready({ recheckAt: '2026-10-08T09:10:00+05:30' }))).toBe(true);
    expect(loosens(ready({ recheckAt: '2026-10-08T09:10:00+05:30' }), ready({ recheckAt: '2026-10-08T09:15:00+05:30' }))).toBe(false);
  });
});

describe('which changes are asked about, and what they take away (D119, P8S-01, P8S-03)', () => {
  it('a change to a reading or a check-in, whoever makes it; never one that touches neither', () => {
    const base = { ...emptySnapshot(), observations: [{ id: 'g1', kind: 'glucose' }, { id: 'w1', kind: 'water' }] } as never;
    expect(touchesClinical({ observations: { remove: ['g1'] } }, base)).toBe(true);
    expect(touchesClinical({ observations: { put: [{ id: 'g2', kind: 'glucose' }] } } as never, base)).toBe(true);
    expect(touchesClinical({ checkIns: [] }, base)).toBe(true);
    expect(touchesClinical({ reset: true }, base)).toBe(true);
    expect(touchesClinical({ observations: { remove: ['w1'] } }, base)).toBe(false);
    expect(touchesClinical({ content: { put: { a: 1 } } }, base)).toBe(false);
  });

  it('names each measurement the engine’s own way, so a change takes away only the one it removes', () => {
    const at = (m: number) => `2026-10-08T09:0${m}:00.000+05:30`;
    const day = (bp: { sys: number; dia: number; at: string }[]) => ({ profile: {} as never, checkIns: [{ date: '2026-10-08', urgentSymptoms: false, news: [], logged: { bp } } as never] });
    const before = measurements(day([{ sys: 186, dia: 98, at: at(1) }, { sys: 181, dia: 96, at: at(2) }]));
    const after = measurements(day([{ sys: 181, dia: 96, at: at(2) }]));
    expect([...before.values()].filter(m => !after.has(m.id))).toEqual([{ kind: 'severeBp', id: bpReadingId({ sys: 186, dia: 98, at: at(1) }, '2026-10-08') }]);
  });

  it('the phone’s clock change holds on its days, and not after them (P8S-02)', () => {
    const settings = { walk: { saveRoutes: 'unasked', map: 'unasked', clock: { generation: 1, days: ['2026-10-08', '2026-10-09'] } } } as never;
    expect(clockHoldOn(settings, new Date(2026, 9, 9, 9))).toBe(true);
    expect(clockHoldOn(settings, new Date(2026, 9, 10, 9))).toBe(false);
    expect(clockHoldOn(undefined, new Date(2026, 9, 9, 9))).toBe(false);
  });
});
```

- [ ] **Step 2: Write the callers' test, Review Focus 1** `src/store/holds.callers.test.ts`

```ts
/**
 * Review Focus 1 (journey §4.6, A-05; Codex P8-01, P8R-01, P8R-02, P8S-01,
 * P8S-02, P8S-03, P8S-05; Kiro K8-07, K8-08), through the real store, a fake
 * IndexedDB, and the gate a walk start asks (`deviceClinical`, `walkInput`,
 * `permission`): a 52 mg/dL low deleted, the same 186/98 retimed to
 * yesterday, a 52 corrected to 152, a check-in's own low corrected, and a
 * check-in holding an LO or a top number of 186 alone removed. Each is
 * refused while the reading holds, with nothing written, and goes through
 * once v1's "It was a mistake" has answered exactly the measurement it takes
 * away. Then two severe readings with one of them answered; a current single
 * reading's way out; the phone's clock moved a day on and back; a correction
 * through the store's own `update`, outside every caller; and a correction
 * the hold allows, keeping what it replaced. Nothing here re-implements a
 * delete, an edit, an import or a gate.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyCheckIn } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import { createDefaultProfile } from '@/profile/defaults';
import { DB_NAME } from './db';
import { fakeIndexedDB } from './fakeIdb';

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;
Object.assign(globalThis, { document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} } });

const store = await import('./useStore');
const { CLOCK_REFUSAL, HOLD_REFUSAL, MISTAKE_HINT, isHeld } = await import('./db');
const { bpReadingId: measured, evaluateCheckIn } = await import('@/engine/readiness');
const { permission, readinessFor } = await import('@/engine/permission');
const { deviceClinical, walkInput } = await import('@/walk/gate');
const { answerMistakes, correctCheckInGlucose, correctCheckInPressure, pendingCheckIn, resetPendingCheckInsForTests } = await import('@/components/checkin/pending');
const { bpReadingId } = await import('@/health/observation');
const { decode } = await import('./transfer');
const { isRecentKey } = await import('./recent');

const DAY = '2026-10-08';
const NEXT = '2026-10-09';
const iso = (h: number, m = 0, day = 8) => new Date(2026, 9, day, h, m, 0).toISOString();
const clock = (h: number, m = 0, day = 8) => vi.setSystemTime(new Date(2026, 9, day, h, m, 0));
const PROFILE: UserProfile = createDefaultProfile({
  health: {
    medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous', glucoseMonitor: 'meter', glucoseUnit: 'mg/dL',
    diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly', bpMonitor: true, hypertension: 'treated', bpMedicinesReviewed: true, betaBlocker: false, diuretic: false,
  },
});
const day = (date: string, h: number): DailyCheckIn => ({
  date, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4,
  glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(h, 50, Number(date.slice(8))), source: 'meter' },
  bp: { sys: 124, dia: 78 }, bpReadings: [{ sys: 124, dia: 78, at: iso(h, 52, Number(date.slice(8))) }],
});
const low = { kind: 'glucose', value: 52, unit: 'mg/dL', scope: 'pointInTime', source: 'manual' } as const;
const deps = { profile: PROFILE, update: store.update };
let fake: ReturnType<typeof fakeIndexedDB>;

/** What a walk start asks, of everything this device holds. */
const walk = () => permission(walkInput(deviceClinical(store.getState()), new Date()), 'walk');
/** The day's answer, as every gate reads it. */
const codes = () => readinessFor(walkInput(deviceClinical(store.getState()), new Date())).reasons.map(r => r.code);
const recent = () => Object.keys(store.getState().contentState).filter(isRecentKey);
/** The observations as IndexedDB holds them. */
async function stored(): Promise<Record<string, unknown>[]> {
  const db = await new Promise<IDBDatabase>(resolve => {
    const req = fake.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
  });
  const rows = await new Promise<Record<string, unknown>[]>(resolve => {
    const req = db.transaction('observations').objectStore('observations').getAll();
    req.onsuccess = () => resolve(req.result as Record<string, unknown>[]);
  });
  db.close();
  return rows;
}

/** A store of its own, over a fresh IndexedDB, holding one day's check-in: a setup never changes what an earlier one held. */
async function fresh(c: DailyCheckIn = day(DAY, 8)) {
  store.resetForTests();
  resetPendingCheckInsForTests();
  local.clear();
  fake = fakeIndexedDB();
  await store.start({ factory: fake, broadcast: null });
  const seeded = await store.update(prev => ({ ...prev, profile: PROFILE, checkIns: [{ ...c, readiness: evaluateCheckIn(PROFILE, c, []) }] }));
  if (!seeded.ok) throw seeded.failure;
}
/** The blood pressure reading holding 186 now, by its reading id. */
const severe = () => bpReadingId(store.getState().observations.find(o => o.kind === 'bloodPressureSystolic' && o.value === 186)!.context)!;
async function ok<T>(p: Promise<{ ok: true; value: T } | { ok: false; failure: Error }>): Promise<T> {
  const r = await p;
  if (!r.ok) throw r.failure;
  return r.value;
}
/** The refusal a result carries, or a failed test. */
function heldBy(r: { ok: boolean; failure?: unknown }) {
  if (r.ok || !isHeld(r.failure)) throw new Error(`not refused as held: ${JSON.stringify(r)}`);
  return r.failure;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  clock(9);
  await fresh();
});
afterEach(() => vi.useRealTimers());

describe('a serious low can’t be deleted or corrected away while it holds (Review Focus 1, P8-01, K8-07)', () => {
  it('a delete is refused in words, writes nothing, and goes through once the 52 is answered as typed wrongly', async () => {
    expect(walk().allowed).toBe(true);
    const reading = await ok(store.addObservation({ ...low, at: iso(8, 58) }));
    expect(walk().allowed).toBe(false);
    const refusal = heldBy(await store.deleteRecord({ kind: 'reading', id: reading.id }));
    expect(refusal.message).toBe(`${HOLD_REFUSAL} ${MISTAKE_HINT}`);
    expect(refusal.held).toEqual([{ kind: 'severeLow', id: expect.stringMatching(/52/) }]);
    expect(store.getState().observations.some(o => o.id === reading.id)).toBe(true);
    expect(recent()).toEqual([]);
    // Said where it was asked, never as the storage banner.
    expect(store.getState().failure).toBeUndefined();
    // A later normal reading resolves nothing (J§4.6).
    clock(9, 5);
    await ok(store.addObservation({ ...low, value: 120, at: iso(9, 5) }));
    expect(walk().allowed).toBe(false);
    clock(9, 6);
    expect((await answerMistakes(refusal.held, deps)).stored).toBe(true);
    expect(walk().allowed).toBe(true);
    expect((await store.deleteRecord({ kind: 'reading', id: reading.id })).ok).toBe(true);
    expect(walk().allowed).toBe(true);
  });

  it('52 corrected to 152 is refused; answered as typed wrongly, the correction goes through, and the record keeps the 52', async () => {
    const reading = await ok(store.addObservation({ ...low, at: iso(8, 58) }));
    const refusal = heldBy(await store.editObservation(reading.id, { value: 152 }));
    expect(store.getState().observations.find(o => o.id === reading.id)?.value).toBe(52);
    expect((await answerMistakes(refusal.held, deps)).stored).toBe(true);
    expect((await store.editObservation(reading.id, { value: 152 })).ok).toBe(true);
    // The correction's history (J§4.6): what was measured, on the record, and what was said about it.
    expect(store.getState().observations.find(o => o.id === reading.id)).toMatchObject({ value: 152, was: [expect.objectContaining({ value: 52 })] });
    expect(store.getState().checkIns.find(c => c.date === DAY)?.resolutions).toEqual([
      expect.objectContaining({ kind: 'severeLow', resolution: 'mistake', readings: [expect.stringMatching(/52/)] }),
    ]);
    expect(walk().allowed).toBe(true);
  });

  it('a check-in’s own low corrected is refused, and nothing is left waiting that a gate could read differently', async () => {
    await fresh({ ...day(DAY, 8), glucose: { value: 46, unit: 'mg/dL', measuredAt: iso(8, 50), source: 'meter' } });
    expect(walk().allowed).toBe(false);
    const result = await correctCheckInGlucose({ at: iso(8, 50), was: { value: 46, unit: 'mg/dL' }, to: { value: 146, unit: 'mg/dL' } }, { ...deps, date: DAY });
    expect(result).toMatchObject({ matched: true, stored: false });
    expect(result.held?.code).toBe('held');
    expect(store.getState().checkIns[0].glucose?.value).toBe(46);
    expect(pendingCheckIn(DAY)).toBeUndefined();
    expect(walk().allowed).toBe(false);
  });
});

describe('a severe blood pressure can’t be retimed or halved away (P8R-01)', () => {
  it('the same 186/98 moved to yesterday is refused, and so is taking one of its halves', async () => {
    await ok(store.putBloodPressure({ systolic: 186, diastolic: 98, at: iso(8, 59) }));
    const readingId = severe();
    expect(walk().allowed).toBe(false);
    heldBy(await store.putBloodPressure({ readingId, systolic: 186, diastolic: 98, at: iso(20, 0, 7) }));
    expect(store.getState().observations.filter(o => o.context === `bp:${readingId}`).every(o => Date.parse(o.at) === Date.parse(iso(8, 59)))).toBe(true);
    const bottom = store.getState().observations.find(o => o.kind === 'bloodPressureDiastolic' && o.context === `bp:${readingId}`)!;
    heldBy(await store.removeObservation(bottom.id));
    heldBy(await store.removeReading(readingId));
    expect(walk().allowed).toBe(false);
  });

  it('a pair late in the day, judged for tomorrow too, and still the next morning when it is yesterday’s (K8-08)', async () => {
    clock(23, 58);
    await fresh(day(DAY, 23));
    await ok(store.putBloodPressure({ systolic: 186, diastolic: 98, at: iso(23, 55) }));
    await ok(store.putBloodPressure({ systolic: 182, diastolic: 97, at: iso(23, 56) }));
    heldBy(await store.deleteRecord({ kind: 'pressure', readingId: severe() }));
    // Past midnight the pair is yesterday's, and the engine still asks about it today.
    clock(0, 5, 9);
    heldBy(await store.deleteRecord({ kind: 'pressure', readingId: severe() }));
  });
});

describe('exactly the measurement a change takes away (P8S-01)', () => {
  it('two severe readings, one of them deleted: only that one is answered, and the other still holds after a normal reading', async () => {
    await ok(store.putBloodPressure({ systolic: 186, diastolic: 98, at: iso(8, 58) }));
    await ok(store.putBloodPressure({ systolic: 181, diastolic: 96, at: iso(9, 0) }));
    expect(walk().allowed).toBe(false);
    const first = severe();
    const named = measured({ sys: 186, dia: 98, at: iso(8, 58) }, DAY);
    const refusal = heldBy(await store.deleteRecord({ kind: 'pressure', readingId: first }));
    // Deleting one of the two ends the pair the engine carries to tomorrow: the other is still never named.
    expect(refusal.held).toEqual([{ kind: 'severeBp', id: named }]);
    expect((await answerMistakes(refusal.held, deps)).stored).toBe(true);
    expect((await store.deleteRecord({ kind: 'pressure', readingId: first })).ok).toBe(true);
    clock(9, 10);
    await ok(store.putBloodPressure({ systolic: 124, diastolic: 78, at: iso(9, 10) }));
    expect(walk().allowed).toBe(false);
    expect(store.getState().checkIns.flatMap(c => c.resolutions ?? []).flatMap(a => a.readings)).toEqual([named]);
  });

  it('a current single reading: its way out is “It was a mistake”, and then it goes', async () => {
    await ok(store.putBloodPressure({ systolic: 186, diastolic: 98, at: iso(8, 59) }));
    expect(walk().allowed).toBe(false);
    const refusal = heldBy(await store.deleteRecord({ kind: 'pressure', readingId: severe() }));
    expect(refusal.message).toBe(`${HOLD_REFUSAL} ${MISTAKE_HINT}`);
    expect(refusal.held).toEqual([{ kind: 'severeBp', id: measured({ sys: 186, dia: 98, at: iso(8, 59) }, DAY) }]);
    expect((await answerMistakes(refusal.held, deps)).stored).toBe(true);
    expect((await store.deleteRecord({ kind: 'pressure', readingId: severe() })).ok).toBe(true);
    expect(walk().allowed).toBe(true);
  });
});

describe('while the phone’s clock change holds the device, nothing clinical is changed or removed (P8S-02)', () => {
  /** The clock a day on, which a walk under way sees (Plan 6's `markClockChange`, board D174); a delete; the clock back. */
  async function overTheJump(request: () => Parameters<typeof store.deleteRecord>[0], code: string) {
    expect(walk().allowed).toBe(false);
    const asked = request();
    const held = store.getState().observations.length;
    clock(9, 0, 9);
    await ok(store.markClockChange([DAY, NEXT]));
    const refusal = heldBy(await store.deleteRecord(asked));
    expect(refusal.message).toBe(CLOCK_REFUSAL);
    expect(refusal.held).toEqual([]);
    clock(9, 10);
    expect(store.getState().observations).toHaveLength(held);
    expect(walk().allowed).toBe(false);
    expect(codes()).toContain(code);
  }

  it('a single severe blood pressure', async () => {
    await ok(store.putBloodPressure({ systolic: 186, diastolic: 98, at: iso(8, 59) }));
    await overTheJump(() => ({ kind: 'pressure', readingId: severe() }), 'bpSevereUnconfirmed');
  });

  it('a mild low', async () => {
    const reading = await ok(store.addObservation({ ...low, value: 68, at: iso(8, 59) }));
    await overTheJump(() => ({ kind: 'reading', id: reading.id }), 'low');
  });
});

describe('every clinical shape a check-in holds, whoever changes it (P8R-02, P8S-03)', () => {
  for (const [what, shown] of [
    ['a check-in showing LO', { glucoseDisplay: { display: 'LO' as const, measuredAt: iso(8, 55), source: 'meter' as const } }],
    ['a top number of 186 entered alone', { bpPartial: [{ sys: 186, at: iso(8, 55) }] }],
  ] as const) {
    it(`${what} can’t be removed while it holds`, async () => {
      await fresh({ ...day(DAY, 8), ...shown });
      expect(walk().allowed).toBe(false);
      heldBy(await store.removeCheckIn(DAY));
      expect(store.getState().checkIns.map(c => c.date)).toEqual([DAY]);
      expect(walk().allowed).toBe(false);
    });
  }

  it('a check-in’s 52 corrected to 152 through the store’s own `update`, outside every caller, is refused the same way', async () => {
    await fresh({ ...day(DAY, 8), glucose: { value: 52, unit: 'mg/dL', measuredAt: iso(8, 50), source: 'meter' } });
    expect(walk().allowed).toBe(false);
    const result = await store.update(prev => ({
      ...prev, checkIns: prev.checkIns.map(c => (c.date === DAY && c.glucose ? { ...c, glucose: { ...c.glucose, value: 152 } } : c)),
    }), { readings: 'correct' });
    heldBy(result);
    expect(store.getState().checkIns[0].glucose?.value).toBe(52);
    expect(store.getState().checkIns[0].resolutions ?? []).toEqual([]);
    expect(walk().allowed).toBe(false);
  });
});

describe('a correction the hold allows keeps what it replaced (J§4.6, P8S-05)', () => {
  it('186/98 corrected to 190/98: as strict as before, so it goes through, and the stored reading keeps 186, its time and when it was corrected', async () => {
    await ok(store.putBloodPressure({ systolic: 186, diastolic: 98, at: iso(8, 59) }));
    const readingId = severe();
    clock(9, 5);
    await ok(store.putBloodPressure({ readingId, systolic: 190, diastolic: 98 }));
    expect(walk().allowed).toBe(false);
    const halves = (await stored()).filter(o => o.context === `bp:${readingId}`);
    expect(halves.find(o => o.kind === 'bloodPressureSystolic')).toMatchObject({ value: 190, editedAt: expect.any(String), was: [expect.objectContaining({ value: 186, at: iso(8, 59) })] });
    // The bottom number didn't change, so it has nothing to keep.
    expect(halves.find(o => o.kind === 'bloodPressureDiastolic')?.was).toBeUndefined();
  });

  it('the same in a check-in, kept on its reading in the series', async () => {
    await fresh({ ...day(DAY, 8), bp: { sys: 186, dia: 98 }, bpReadings: [{ sys: 186, dia: 98, at: iso(8, 52) }] });
    clock(9, 5);
    const result = await correctCheckInPressure({ at: iso(8, 52), was: { sys: 186, dia: 98 }, to: { sys: 190, dia: 98 } }, { ...deps, date: DAY });
    expect(result).toMatchObject({ matched: true, stored: true });
    expect((await stored()).find(o => o.kind === 'bloodPressureSystolic' && o.value === 190)?.was).toEqual([expect.objectContaining({ value: 186 })]);
  });
});

describe('what holds nothing goes at once, and an older backup changes nothing (H6-03)', () => {
  it('a normal reading deletes and restores with no refusal', async () => {
    const normal = await ok(store.addObservation({ ...low, value: 130, at: iso(8, 59) }));
    const entry = await ok(store.deleteRecord({ kind: 'reading', id: normal.id }));
    expect(walk().allowed).toBe(true);
    expect((await store.restoreDeleted(entry)).ok).toBe(true);
    expect(walk().allowed).toBe(true);
  });

  it('a backup from before the low, merged either way or replaced over it, leaves it holding', async () => {
    const made = await store.exportRecord();
    if (!made.ok) throw made.failure;
    const older = await decode(made.value.bytes);
    await ok(store.addObservation({ ...low, at: iso(8, 58) }));
    for (const onConflict of ['keepDevice', 'takeFile'] as const) {
      await ok(store.importRecord(older, 'merge', { onConflict }));
      expect(walk().allowed).toBe(false);
    }
    await ok(store.importRecord(older, 'replace'));
    expect(walk().allowed).toBe(false);
  });
});
```

- [ ] **Step 3: Run them to check they fail**

Run: `npx vitest run src/store/holds.test.ts src/store/holds.callers.test.ts`
Expected: FAIL, "Cannot find module './holds'", `isHeld` isn't exported from `./db`, and nothing is refused.

- [ ] **Step 4: The refusal.** In `src/store/db.ts`, import `type { EpisodeKind } from '@/types/checkin'`; `FailureCode` gains, after `'stale'`:

```ts
  /** A change to a clinical record refused: it would lift a hold the engine hasn't released, or the phone's clock changed (D119). Nothing was written. */
  | 'held'
```

  and after `StoreFailure`:

```ts
export const HOLD_REFUSAL = 'This reading is keeping movement on hold, so it can’t be changed or removed yet.';
export const MISTAKE_HINT = 'If it was typed wrongly, choose ‘It was a mistake’.';
/** While the phone's clock change holds the device (Plan 6, board D174): no reading's age can be known (P8S-02). */
export const CLOCK_REFUSAL = 'Your phone’s clock changed, so FitStrong can’t be sure when your readings were taken. For now, readings can’t be changed or removed. You can still add a new one.';

/** A measurement, by the name the engine gives it (`glucoseReadingId`, `bpReadingId`, …), and the kind of incident it would be. */
export interface HeldReading {
  kind: EpisodeKind;
  id: string;
}

/**
 * A change refused because it would lift a hold (board D119). `held`: the
 * measurements it takes away that "It was a mistake" can answer; none when
 * the phone's clock change holds everything (`said` then gives the words),
 * or when nothing it takes away is a measurement, as a check-in removed for
 * its answers alone (`release`, the engine's own words, then follows).
 */
export class HoldFailure extends StoreFailure {
  readonly held: readonly HeldReading[];
  readonly release?: string;

  constructor(held: readonly HeldReading[], release?: string, said?: string) {
    super('held', said ?? [HOLD_REFUSAL, held.length > 0 ? MISTAKE_HINT : release].filter(Boolean).join(' '));
    this.held = held;
    if (release !== undefined) this.release = release;
  }
}

export const isHeld = (failure: unknown): failure is HoldFailure => failure instanceof HoldFailure;
```

- [ ] **Step 5: Write** `src/store/holds.ts`

```ts
/**
 * A change never lifts a hold (J§4.6, A-05; board D119). Every change that
 * takes away or alters a clinical measurement, or removes a check-in, is
 * asked of the engine before and after: every mode's permission now, and
 * the day's answer today and tomorrow (K8-08). One that would let any mode
 * do more, or stop the engine asking about a serious reading, is refused
 * (`useStore`'s `planOn`), unless each measurement it takes away has been
 * answered as typed wrongly; while the phone's clock change holds the device,
 * every such change is. The engine decides, and names the measurements;
 * nothing here computes a permission. Pure.
 */
import { permission, readinessFor, type Permission, type PermissionInput } from '@/engine/permission';
import { bpPartialId, bpReadingId, glucoseReadingId, ketoneReadingId, standingAnswer, toMgdl, withLogged } from '@/engine/readiness';
import { effectiveCheckIns } from '@/components/checkin/pending';
import type { Observation } from '@/health/observation';
import { toDateString } from '@/lib/utils';
import { createDefaultProfile } from '@/profile/defaults';
import type { UserSettings } from '@/types';
import { DISPOSITION_ORDER, type CheckInRecord, type Disposition, type Mode, type Readiness } from '@/types/checkin';
import type { UserProfile } from '@/types/profile';
import { CLOCK_REFUSAL, type HeldReading } from './db';
import type { Change, Snapshot } from './snapshot';

/** What the engine reads of the device, as `deviceClinical` builds it. */
export interface Clinical {
  profile: UserProfile;
  checkIns: readonly CheckInRecord[];
}

const MODES: readonly Mode[] = ['guided', 'stretch', 'walk'];
const DAY_MS = 24 * 60 * 60 * 1000;
const CLINICAL_KINDS = new Set(['glucose', 'bloodPressureSystolic', 'bloodPressureDiastolic']);
const rank = (d: Disposition | undefined) => DISPOSITION_ORDER.indexOf(d ?? 'reassure');
const lost = (before: readonly string[], after: readonly string[]) => before.some(x => !after.includes(x));

/**
 * The device as every gate reads it: the stored check-ins with any answer
 * still waiting, Track's readings attached, and the phone's clock changes
 * (`deviceClinical`'s rule; the gate itself reads the store, so the store
 * can't import it).
 */
export function clinicalOf(s: Pick<Snapshot, 'profile' | 'checkIns' | 'observations' | 'settings'>): Clinical {
  const profile = s.profile ?? createDefaultProfile({ weightKg: s.settings?.currentWeight || 0, needsHealthReview: true });
  return { profile, checkIns: effectiveCheckIns(s.checkIns, profile, s.observations as readonly Observation[], s.settings?.walk?.clock) };
}

/** Whether a change can touch a clinical measurement or a check-in: only then is the engine asked (P8S-03). */
export function touchesClinical(change: Change, base: Pick<Snapshot, 'observations'>): boolean {
  if (change.reset || change.checkIns !== undefined) return true;
  const o = change.observations;
  if (!o) return false;
  if ((o.put ?? []).some(x => CLINICAL_KINDS.has(x.kind))) return true;
  const gone = new Set(o.remove ?? []);
  return gone.size > 0 && base.observations.some(x => gone.has(x.id) && CLINICAL_KINDS.has(x.kind));
}

/** Every clinical measurement the engine reads, by the name it gives it: what an answer names (P8S-01). */
export function measurements(c: Clinical): Map<string, HeldReading> {
  const out = new Map<string, HeldReading>();
  const add = (kind: HeldReading['kind'], id: string) => out.set(id, { kind, id });
  for (const record of c.checkIns) {
    const v = withLogged(record);
    for (const e of [...(v.glucoseEarlier ?? []), v.glucose, v.glucoseDisplay]) {
      if (!e) continue;
      const high = 'display' in e ? e.display === 'HI' : toMgdl(e.value, e.unit) >= 600;
      add(high ? 'extremeGlucose' : 'severeLow', glucoseReadingId(e, v.date));
    }
    for (const r of [...(v.bpReadings?.length ? v.bpReadings : v.bp ? [v.bp] : []), ...(v.bpEarlier ?? [])]) add('severeBp', bpReadingId(r, v.date));
    for (const h of v.bpPartial ?? []) add('severeBp', bpPartialId(h, v.date));
    for (const k of [...(v.ketonesEarlier ?? []), ...(v.ketones ? [v.ketones] : [])]) add('ketones', ketoneReadingId(k, v.date));
  }
  return out;
}

/** The phone's clock change holds the device (Plan 6's `settings.walk.clock`, board D174): on the days either side of it. */
export function clockHoldOn(settings: Pick<UserSettings, 'walk'> | undefined, now: Date): boolean {
  const days = settings?.walk?.clock?.days;
  return Array.isArray(days) && days.includes(toDateString(now));
}

/** The engine's input at `now`, as `walkInput` makes it. */
function inputAt(c: Clinical, now: Date): PermissionInput {
  const today = toDateString(now);
  const checkIn = c.checkIns.find(x => x.date === today);
  return { profile: c.profile, now, ...(checkIn ? { checkIn } : {}), recent: [...c.checkIns] };
}

/** How much a mode may do: refused below allowed, a stricter disposition lower. */
const freedom = (p: Permission) => (p.allowed ? 10 : 0) - rank(p.disposition);

/** The mode may do more after than before: allowed where it was refused, a gentler disposition, or a restriction gone. */
export function looser(before: Permission, after: Permission): boolean {
  if (freedom(after) !== freedom(before)) return freedom(after) > freedom(before);
  return lost(before.codes ?? [], after.codes ?? []);
}

/** The serious readings the answer still asks about. */
const open = (r: Readiness) => (r.episodes ?? []).flatMap(e => e.readings.filter(x => !x.settled).map(x => x.id));

/** The day's answer is less strict after than before: a restriction gone, a serious reading no longer asked about, a mode, modifier or cap lifted, or a re-check due sooner. */
export function loosens(before: Readiness, after: Readiness): boolean {
  const restrictive = (r: Readiness) => r.reasons.filter(x => rank(x.disposition) >= rank('adjust')).map(x => x.code);
  const recheck = (r: Readiness) => (r.recheckAt ? Date.parse(r.recheckAt) : -Infinity);
  return lost(restrictive(before), restrictive(after)) || lost(open(before), open(after))
    || lost(before.refusedModes ?? [], after.refusedModes ?? []) || lost(before.modifiers, after.modifiers)
    || (before.capHeavy && !after.capHeavy) || (before.vigorousLocked && !after.vigorousLocked)
    || recheck(after) < recheck(before);
}

/**
 * Why a change may not be written, or nothing (D119). Only a change that
 * takes a measurement away, or removes a check-in, is judged. While the
 * phone's clock change holds the device: always refused (`said`). Otherwise
 * refused when it would lift a hold, unless each measurement it takes away
 * has been answered as typed wrongly by the engine's own reading of the
 * answers; `held` is exactly those still unanswered, and `release` the
 * engine's own words for a hold that is no measurement's.
 */
export function holdLifted(
  before: Clinical, after: Clinical, now: Date, opts: { clock?: boolean; removedDays?: readonly string[] } = {},
): { held: HeldReading[]; release?: string; said?: string } | undefined {
  const still = measurements(after);
  const touched = [...measurements(before).values()].filter(m => !still.has(m.id));
  if (touched.length === 0 && !opts.removedDays?.length) return undefined;
  if (opts.clock) return { held: [], said: CLOCK_REFUSAL };
  const tomorrow = new Date(now.getTime() + DAY_MS);
  const b = inputAt(before, now);
  const a = inputAt(after, now);
  const was = MODES.map(mode => permission(b, mode));
  const lifts = MODES.some((mode, i) => looser(was[i], permission(a, mode)))
    || loosens(readinessFor(b), readinessFor(a)) || loosens(readinessFor(inputAt(before, tomorrow)), readinessFor(inputAt(after, tomorrow)));
  if (!lifts) return undefined;
  const answers = after.checkIns.flatMap(c => c.resolutions ?? []);
  const held = touched.filter(m => standingAnswer(answers, m.id)?.resolution !== 'mistake');
  if (touched.length > 0 && held.length === 0) return undefined;
  const release = was.find(p => !p.allowed && p.release)?.release;
  return { held, ...(release ? { release } : {}) };
}
```

  `// ponytail: the engine is asked ten times per change that takes a measurement away, over every day Track holds readings for. Upgrade: ask only `reachableHistory`'s days (gate.ts) if such a tap is ever slow on a phone.` goes above `holdLifted`.

- [ ] **Step 6: The store asks, for every change.** In `src/store/useStore.ts`, import `HoldFailure` from `./db` (beside the existing names) and `clinicalOf`, `clockHoldOn`, `holdLifted`, `touchesClinical` from `./holds`, and:
  - `Mutation` gains:

```ts
  /**
   * "Delete all data" (D119): the person's confirmed choice to erase
   * everything, the one change the engine isn't asked about.
   */
  erasesAll?: true;
```

  - in `planOn`, after `const prepared: Prepared = …;` and before `m.cached = …`:

```ts
  if (change !== null && !m.erasesAll && touchesClinical(change, base)) {
    // Asked of what is really there, before and after, for every change that can take a clinical
    // measurement away, whichever function or caller asked for it (D119, P8S-03).
    const now = new Date();
    const removedDays = base.checkIns.map(c => c.date).filter(d => !prepared.next.checkIns.some(c => c.date === d));
    const refused = holdLifted(clinicalOf(base), clinicalOf(prepared.next), now, { clock: clockHoldOn(base.settings, now), removedDays });
    if (refused) throw new HoldFailure(refused.held, refused.release, refused.said);
  }
```

  - a refusal is said where it was asked, never as the storage banner: in `enqueue`'s `catch`, `note(failure);` becomes `if (failure.code !== 'held') note(failure);`, and in `commit`'s `if (!outcome.ok)` branch, `lastFailure = outcome.failure;` becomes `if (outcome.failure.code !== 'held') lastFailure = outcome.failure;`;
  - `clearAll`'s enqueued mutation gains `erasesAll: true,`. Nothing else is marked: adding a reading takes nothing away, so it isn't judged, and a re-check is how the engine releases.

- [ ] **Step 7: A correction keeps what it replaced** (J§4.6, P8S-05). In `src/health/observation.ts`:
  - `Observation` gains, after `editedAt`:

```ts
  /**
   * What earlier corrections replaced, oldest first: each version's value,
   * unit and time, and when that version was itself corrected. Kept on the
   * record it corrected, so the history is the reading's own (J§4.6).
   */
  was?: { value: number; unit: string; at: string; editedAt?: string }[];
```

  - after `ObservationRevision`: `/** A record keeps this many earlier versions; the oldest go first beyond it. */ export const MAX_CORRECTIONS = 50;`;
  - in `reviseObservation`, after `const next: Observation = { ...existing };`:

```ts
  // A changed measurement keeps the version it replaces (P8S-05); a note or a tag alone changes no measurement.
  const changes = (patch.value !== undefined && patch.value !== existing.value) || (patch.unit !== undefined && patch.unit !== existing.unit)
    || (typeof patch.at === 'string' && Date.parse(patch.at) !== Date.parse(existing.at));
  if (changes) {
    const prior = { value: existing.value, unit: existing.unit, at: existing.at, ...(existing.editedAt ? { editedAt: existing.editedAt } : {}) };
    next.was = [...(existing.was ?? []), prior].slice(-MAX_CORRECTIONS);
  }
```

  - `observationProblem` adds, before `return undefined;`:

```ts
  if (o.was !== undefined && !(Array.isArray(o.was) && o.was.length <= MAX_CORRECTIONS
    && o.was.every(v => typeof v === 'object' && v !== null && Number.isFinite(v.value) && typeof v.unit === 'string' && isAt(v.at) && (v.editedAt === undefined || isAt(v.editedAt))))) {
    return 'was lists the versions a correction replaced';
  }
```

  Append to `src/health/observation.test.ts`, adding `reviseObservation` to its import if missing:

```ts
describe('a correction keeps what it replaced (J§4.6, P8S-05)', () => {
  it('each changed measurement keeps its earlier version, oldest first; a note alone keeps none', () => {
    const o = newObservation({ id: 'g1', kind: 'glucose', value: 52, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: '2026-10-08T08:58:00+05:30' });
    const once = reviseObservation(o, { value: 152 }, '2026-10-08T09:06:00+05:30');
    expect(once.was).toEqual([{ value: 52, unit: 'mg/dL', at: o.at }]);
    const twice = reviseObservation(once, { at: '2026-10-08T08:59:00+05:30' }, '2026-10-08T09:07:00+05:30');
    expect(twice.was).toEqual([{ value: 52, unit: 'mg/dL', at: o.at }, { value: 152, unit: 'mg/dL', at: o.at, editedAt: '2026-10-08T09:06:00+05:30' }]);
    expect(reviseObservation(twice, { note: 'after lunch' }).was).toEqual(twice.was);
    expect(observationProblem({ ...o, was: [{ value: 52, unit: 'mg/dL', at: 'yesterday' }] })).toMatch(/was/);
  });
});
```

- [ ] **Step 8: The check-in's own corrections, and v1's way out.** In `src/components/checkin/pending.ts`:
  - import `isHeld` and `type HoldFailure`, `type HeldReading` from `@/store/db`, `toDateString` from `@/lib/utils`, and `type EpisodeAnswer` beside the other `@/types/checkin` types;
  - `CorrectionResult` gains `/** Refused: it would lift a hold the engine hasn't released, or the phone's clock changed (D119). Nothing changed. */ held?: HoldFailure;`;
  - `reviseCheckIn` remembers what waited before and gives it back when refused. Before `const written = update(…)`: `const had = waiting.get(date);`. After `const result = await written;`:

```ts
  if (isHeld(result.failure)) {
    // Refused before anything was written (D119): what waited before waits again, and nothing else moved.
    if (record && waiting.get(date) === record) {
      if (had) waiting.set(date, had);
      else waiting.delete(date);
    }
    publish();
    return { matched: record !== undefined, stored: false, failure: result.failure.message, held: result.failure };
  }
```

  - `correctCheckInPressure` does the same: `const had = waiting.get(date);` before its `update`, and the same block after its `await written`;
  - after `saveWith`:

```ts
/**
 * "It was a mistake" (board D119): each held measurement, exactly as the
 * refusal named it, answered as typed wrongly in today's check-in, as the
 * check-in sheet's "I typed it wrongly" answers one. A later day's answer
 * settles an earlier day's reading too, as the engine reads them, and it is
 * kept like any answer: the reading's history is what was measured and what
 * was said about it (J§4.6, K8-07).
 */
export function answerMistakes(held: readonly HeldReading[], deps: { profile: UserProfile; update: StoreUpdate }, now: Date = new Date()): Promise<SaveResult> {
  const date = toDateString(now);
  const at = now.toISOString();
  const answers: EpisodeAnswer[] = held.map(h => ({ kind: h.kind, readings: [h.id], resolution: 'mistake', at }));
  return saveWith(date, today => {
    const base: DailyCheckIn = today ?? { date, urgentSymptoms: false, news: [] };
    return { ...base, resolutions: [...(base.resolutions ?? []), ...answers] };
  }, deps);
}
```

  Write `src/components/checkin/HeldProblem.tsx`:

```tsx
/**
 * A change refused because the reading still holds movement (board D119):
 * the refusal next to what was tapped (J§20.4 rule 9), and v1's way out for a
 * reading typed wrongly: "It was a mistake" answers exactly the measurements
 * the refusal named, in today's check-in, then the change is tried again. A
 * refusal with no measurement to answer, a hold of its own or the phone's
 * clock change, says its own words instead.
 */
import { useState } from 'react';
import type { HoldFailure } from '@/store/db';
import { update } from '@/store/useStore';
import type { UserProfile } from '@/types/profile';
import { answerMistakes } from './pending';

export const MISTAKE_LABEL = 'It was a mistake';

export function HeldProblem({ failure, profile, onAnswered }: { failure: HoldFailure; profile: UserProfile | undefined; onAnswered: () => void }) {
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const answer = async () => {
    if (!profile || busy) return;
    setBusy(true);
    setProblem(undefined);
    const saved = await answerMistakes(failure.held, { profile, update });
    setBusy(false);
    if (!saved.stored) return setProblem('Your answer didn’t save, so nothing was changed. Try again.');
    onAnswered();
  };
  return (
    <div role="alert" className="flex flex-col gap-2 px-4">
      <p className="text-[length:var(--text-body)]">{failure.message}</p>
      {failure.held.length > 0 && profile && (
        <button type="button" onClick={() => void answer()}
          className="press-feedback min-h-12 self-start rounded-xl px-4 text-[length:var(--text-body)] font-semibold text-tint">
          {MISTAKE_LABEL}
        </button>
      )}
      {problem && <p className="text-[length:var(--text-subhead)] text-stop">{problem}</p>}
    </div>
  );
}
```

- [ ] **Step 9: The edit sheets say it, and offer the way out.** In `src/screens/track/EditSheets.tsx`, import `HeldProblem` from `@/components/checkin/HeldProblem` and `isHeld`, `type HoldFailure` from `@/store/db`. In both `EditReadingSheet` and `EditPressureSheet`:
  - `const [held, setHeld] = useState<HoldFailure>();` beside `error`;
  - each `return result.ok ? undefined : result.failure.message;` after `editObservation` or `putBloodPressure` becomes `if (result.ok) return undefined; if (isHeld(result.failure)) setHeld(result.failure); return result.failure.message;`, and after a check-in correction (`correctInCheckIn`, `correctCheckInPressure`) `if (!result.stored) return result.failure;` becomes `if (!result.stored) { if (result.held) setHeld(result.held); return result.failure; }`;
  - every `setError(undefined)` also clears it (`setHeld(undefined)`), so a changed value is judged afresh;
  - `{error && <ErrorText id={errorId}>{error}</ErrorText>}` becomes:

```tsx
      {held
        ? <HeldProblem failure={held} profile={profile} onAnswered={() => { setHeld(undefined); void save(); }} />
        : error && <ErrorText id={errorId}>{error}</ErrorText>}
```

  `EditPressureSheet` reads `profile` as `EditReadingSheet` does (`useStore().profile`) if it doesn't already.

- [ ] **Step 10: Run them**

Run: `npx vitest run src/store src/health src/components/checkin src/screens/track src/walk src/hooks`
Expected: PASS. A test elsewhere that deletes, retimes or corrects a dangerous reading through the store and then expects the gate to allow movement tested what P8-01 closes: its expectation becomes the refusal, naming D119. A test that compares a whole corrected observation with `toEqual` gains its `was`.

- [ ] **Step 11: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/store/db.ts src/store/holds.ts src/store/holds.test.ts src/store/holds.callers.test.ts src/store/useStore.ts src/health/observation.ts src/health/observation.test.ts src/components/checkin/pending.ts src/components/checkin/HeldProblem.tsx src/screens/track/EditSheets.tsx
git commit -m "fix: Refuse any change that would lift a hold, answer exactly the readings it takes away, and keep what a correction replaced"
```

---

### Task 7: Every routine delete at once, with one Undo stack that follows where each screen was opened from, and own foods edited (B-04, M19)

**Files:**
- Create: `src/components/hig/undoScope.ts`, `src/components/hig/undoScope.test.ts`, `src/components/hig/undo.ts`, `src/components/hig/undo.test.ts`
- Modify: `src/screens/food/undo.ts` (Plan 7's: its stack moves to `@/components/hig/undo`, and what stays is food's deletes with Undo); Create: `src/screens/food/undo.callers.test.ts` (H7-15); Delete: `src/screens/food/undo.test.ts` (Plan 7's: its cases are `src/components/hig/undo.test.ts`'s now)
- Modify: `src/store/useStore.ts` (`subscribeEdits`; `setContentState` is no edit)
- Modify: `src/main.tsx` (Undo follows each navigation's provenance; an edit ends the Undos)
- Modify: `src/food/store.ts`, `src/food/store.test.ts` (Plan 7's: deletes through Recently deleted; `deleteOwnFood`, `editOwnFood`)
- Modify: `src/screens/food/LogMealSheet.tsx`, `UsualMealsScreen.tsx`, `FoodHubScreen.tsx`, `parts.tsx` (`OwnFoodPage` edits a food), `src/screens/track/MyDay.tsx` (Plan 7's callers)
- Create: `src/screens/you/OwnFoodsScreen.tsx`; Modify: `src/screens/you/routes.tsx`, `src/screens/you/FoodScreen.tsx` ("Your own foods", with Edit and Delete)
- Modify: `src/screens/track/RecordDetails.tsx` (readings, a check-in's readings, blood pressure and walks at once; a reading that holds movement refused in place)
- Modify: `src/screens/workout/RecordScreen.tsx`, `src/screens/workout/sheets.tsx` (a workout at once; `DeleteSheet` goes)
- Create: `src/screens/track/deletes.callers.test.ts`

**Interfaces:**
- Consumes: `deleteRecord`, `restoreDeleted`, `deleteWorkout`, `restoreWorkout`, `removeCheckInReading`, `restoreCheckInReading`, `ALREADY_BACK`, `NEWER_STAYS`, `NOT_RECENT`, `asRecent`, `recentKey` (Task 5); `isHeld`, `HoldFailure`, `HeldProblem`, `MISTAKE_LABEL`, `HOLD_REFUSAL`, `MISTAKE_HINT` (Task 6); `TOAST_STYLE`, `UNDO_STYLE` (Plan 7's `src/components/hig/toast.ts`); `cameFrom`, `originOf` (`src/components/hig/navigation.ts`); `useOrigin()`'s `origin`, `back`, `leave` (`src/screens/track/useOrigin.ts`); `customFoodsIn`, `mealsIn`, `savedMealsIn` (Plan 7's `src/food/records.ts`); `customItem` (Plan 7's `src/food/estimate.ts`, which after Plan 7's fix, H7-09, gives a meal item a full snapshot of its food: its name, its portion `per`, what one portion held, `basis`, and `version`, the food's `updatedAt` when it was logged); `CustomFood`'s `createdAt` and `updatedAt` (its `updatedAt` is the version of its definition); `OwnFoodPage` (Plan 7's `src/screens/food/parts.tsx`); `numbersView` (`src/food/level.ts`); `FOOD_COPY.deleted`, `.removed`, `.restored` (Plan 7's `src/food/copy.ts`).
- Produces:
  - `src/components/hig/undoScope.ts`: `interface Place { path; from? }`; `interface Scope { root; inside }`; `pathOf(route)`; `isDetail(route)`; `scopeOf(root)`; `follow(scope, place): Scope | undefined`;
  - `src/components/hig/undo.ts`: `UNDO_LABEL = 'Undo'`; `CLOSE_LABEL = 'Close'`; `NOT_RESTORED = 'It wasn’t restored.'`; `type UndoOutcome = { done: true; said?: string } | { done: false; problem: string }`; `offerUndo({ text, restored, scope, entry?, undo })`, whose restore says what it did only while that same offer still stands (P8S-16); `endUndos()`; `dismissUndoFor(entry)`; `followPlace(place)`; `resetUndosForTests()`;
  - `src/screens/food/undo.ts`: `deleteMealWithUndo(meal, scope)`, `deleteUsualWithUndo(usual, scope)`, `deleteOwnFoodWithUndo(food, scope)`, each `Promise<string | undefined>` (what went wrong, in words);
  - `useStore.ts`: `subscribeEdits(listener): () => void`, told after every stored change the person made: not a delete, a restore, expiry or reading progress (`edit: false`);
  - `src/food/store.ts`: `deleteMeal(id)`, `deleteUsual(id)`, `deleteOwnFood(id)`, each `Promise<StoreResult<string>>` (the entry's id); `editOwnFood(food): Promise<StoreResult>`. `restoreMeal` and `restoreUsual` go: `restoreDeleted(entry)` does every kind but sessions and check-in readings;
  - `OwnFoodPage` gains `food?: CustomFood` (the food being edited) and `action?: string` (its button's words), and `onBack` becomes optional;
  - `OwnFoodsScreen` at `/me/food/own`.

**Why the scope follows provenance, and why nothing is said on a timer.** Codex P8-14: a list of detail routes let a glucose Undo survive opening a walk from anywhere. An Undo now belongs to its screen and to the record details opened from it, or from one of those, as `useOrigin`'s router state says (or the navigation stack, where a link carries none); `isDetail` is only the app's table of record routes. So an Undo offered on Today's log stands while another meal's detail is opened from the log and closed again, which Plan 7's screen-held Undo didn't (H7-15). An edit ends the Undos wherever it is made, because the store says so after every edit it stores (`subscribeEdits`). And what an Undo says afterwards is said in its own toast, in place, until it is closed or its screen is left: "Water 500 ml restored", a restore that didn't save with its reason and Undo again beside it, or a check-in reading that is already back. Nothing is on a timer (M19, Kiro K8-03), and a restore with nothing to do isn't called a failure (K8-06).

- [ ] **Step 1: Write the failing tests** `src/components/hig/undoScope.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { follow, isDetail, pathOf, scopeOf } from './undoScope';

describe('where an Undo belongs, by where each screen was opened from (B-04, D113, P8-14)', () => {
  it('stays on its screen, with any query, and Today’s log is one screen whichever day it shows', () => {
    const s = scopeOf('/day/today');
    expect(follow(s, { path: '/day/today' })).toBe(s);
    expect(follow(s, { path: '/day/2026-10-07' })).toBe(s);
    expect(follow(scopeOf('/hub/glucose'), { path: '/hub/glucose?add=glucose' })).toEqual(scopeOf('/hub/glucose'));
  });

  it('stays on a record detail opened from it, on one opened from that, and back again', () => {
    const s = scopeOf('/day/today');
    const reading = follow(s, { path: '/track/reading/g1', from: '/day/today' })!;
    expect(reading.inside).toEqual(['/track/reading/g1']);
    const walk = follow(reading, { path: '/track/walk/W', from: '/track/reading/g1' })!;
    expect(walk.inside).toEqual(['/track/reading/g1', '/track/walk/W']);
    expect(follow(walk, { path: '/track/reading/g1' })).toBe(walk);
    expect(follow(walk, { path: '/day/today' })).toBe(walk);
  });

  it('ends on a detail opened from somewhere else: a glucose Undo doesn’t survive a walk opened from Today’s log', () => {
    expect(follow(scopeOf('/hub/glucose'), { path: '/track/walk/W', from: '/day/today' })).toBeUndefined();
    expect(follow(scopeOf('/hub/glucose'), { path: '/track/walk/W' })).toBeUndefined();
  });

  it('ends on a screen that is no record’s, though opened from it: the hub’s See trends', () => {
    expect(follow(scopeOf('/hub/glucose'), { path: '/trends/glucose', from: '/hub/glucose' })).toBeUndefined();
    expect(follow(scopeOf('/day/today'), { path: '/home', from: '/day/today' })).toBeUndefined();
  });

  it('knows the app’s record screens and Log a meal, and reads a path without its query or hash', () => {
    expect(['/track/reading/g1', '/track/pressure/r1', '/track/walk/W', '/track/session/s1', '/track/workout/s1', '/track/check-in/2026-10-08', '/hub/food/log'].every(isDetail)).toBe(true);
    expect(['/track/reading/', '/trends/glucose', '/hub/food/usual', '/day/today'].some(isDetail)).toBe(false);
    expect(pathOf('/hub/food/log?edit=meal-1')).toBe('/hub/food/log');
    expect(pathOf('')).toBe('/');
  });
});
```

And `src/components/hig/undo.test.ts`, the real toast manager over a stand-in for sonner, which updates a toast in place when it is shown again under its id:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UndoOutcome } from './undo';

type Shown = { text: string; id?: string; duration?: number; onDismiss?: () => void; action?: { label: string; onClick: (e: { preventDefault(): void }) => void } };
const sonner = vi.hoisted(() => ({ shown: [] as Shown[], dismissed: [] as string[] }));
vi.mock('sonner', () => ({
  toast: Object.assign((text: string, options: Record<string, unknown> = {}) => { sonner.shown.push({ text, ...options } as Shown); return options.id; }, {
    dismiss: (id: string) => void sonner.dismissed.push(id),
  }),
}));

const { NOT_RESTORED, dismissUndoFor, endUndos, followPlace, offerUndo, resetUndosForTests } = await import('./undo');

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
/** What a toast says now: its latest showing. */
const latest = (id: string) => [...sonner.shown].reverse().find(s => s.id === id)!;
const ids = () => [...new Set(sonner.shown.map(s => s.id!))];
const standing = () => ids().filter(id => !sonner.dismissed.includes(id) && latest(id).action?.label === 'Undo');
const press = async (id: string) => {
  latest(id).action!.onClick({ preventDefault() {} });
  await tick();
};
const offer = (text: string, scope: string, undo: () => Promise<UndoOutcome> = async () => ({ done: true }), entry?: string) =>
  offerUndo({ text: `${text} deleted`, restored: `${text} restored`, scope, ...(entry ? { entry } : {}), undo });

afterEach(() => {
  resetUndosForTests();
  sonner.shown.length = 0;
  sonner.dismissed.length = 0;
});

describe('Undo, two deep, never on a timer (B-04, M19, D113)', () => {
  it('stacks a second, and a third ends the oldest', () => {
    offer('Water 500 ml', '/day/today');
    offer('Water 250 ml', '/day/today');
    expect(standing()).toHaveLength(2);
    offer('Glucose 140 mg/dL', '/day/today');
    expect(standing()).toEqual(ids().slice(1));
  });

  it('restoring one keeps the other, and says so in its place until it is closed (K8-03)', async () => {
    offer('Water 500 ml', '/day/today');
    offer('Water 250 ml', '/day/today');
    const [first, second] = ids();
    await press(first);
    expect(standing()).toEqual([second]);
    expect(latest(first)).toMatchObject({ text: 'Water 500 ml restored', action: { label: 'Close' } });
    expect(sonner.dismissed).not.toContain(first);
  });

  it('keeps the Undo in place, with why, when the restore didn’t save (K8-03)', async () => {
    offer('Water 500 ml', '/day/today', async () => ({ done: false, problem: 'This device is full.' }));
    const [first] = ids();
    await press(first);
    expect(latest(first)).toMatchObject({ text: `Water 500 ml deleted. ${NOT_RESTORED} This device is full.`, action: { label: 'Undo' } });
    expect(standing()).toEqual([first]);
  });

  it('says what happened, never a failure, when there was nothing to put back (K8-06)', async () => {
    offer('Glucose 118 mg/dL', '/day/today', async () => ({ done: true, said: 'Already back in your check-in.' }));
    const [first] = ids();
    await press(first);
    expect(latest(first).text).toBe('Already back in your check-in.');
    expect(sonner.shown.some(s => /didn’t save|wasn’t restored/.test(s.text))).toBe(false);
  });

  it('asks once for a second tap while the first restore is saving', async () => {
    let asked = 0;
    offer('Water 500 ml', '/day/today', async () => { asked += 1; return { done: true }; });
    const [first] = ids();
    latest(first).action!.onClick({ preventDefault() {} });
    latest(first).action!.onClick({ preventDefault() {} });
    await tick();
    expect(asked).toBe(1);
  });

  it('puts nothing on a timer', async () => {
    offer('Water 500 ml', '/day/today');
    offer('Water 250 ml', '/day/today', async () => ({ done: false, problem: 'No space.' }));
    for (const id of ids()) await press(id);
    expect(sonner.shown.every(s => s.duration === Infinity)).toBe(true);
  });

  it('says nothing when a restore settles after its Undo has ended, by leaving, an edit or a swipe, and the Undo that stands now stays (P8S-16)', async () => {
    const waits: ((o: UndoOutcome) => void)[] = [];
    const slow = () => new Promise<UndoOutcome>(resolve => waits.push(resolve));
    const ends: [string, (first: string) => void, UndoOutcome][] = [
      ['its screen left', () => followPlace({ path: '/home' }), { done: true }],
      ['an edit stored', () => endUndos(), { done: false, problem: 'No space.' }],
      ['swiped away', first => latest(first).onDismiss!(), { done: true }],
    ];
    for (const [how, end, outcome] of ends) {
      resetUndosForTests();
      sonner.shown.length = 0;
      sonner.dismissed.length = 0;
      waits.length = 0;
      offer('Water 500 ml', '/day/today', slow);
      const [first] = ids();
      // Undo tapped: its restore is still saving.
      latest(first).action!.onClick({ preventDefault() {} });
      end(first);
      offer('Water 250 ml', '/home');
      const [, second] = ids();
      const said = sonner.shown.filter(x => x.id === first).length;
      waits[0](outcome);
      await tick();
      expect(sonner.shown.filter(x => x.id === first).length, how).toBe(said);
      expect(standing(), how).toContain(second);
    }
  });

  it('forgets a toast the person swiped away, so it no longer counts towards the two', () => {
    offer('Water 500 ml', '/day/today');
    offer('Water 250 ml', '/day/today');
    latest(ids()[0]).onDismiss!();
    offer('Glucose 140 mg/dL', '/day/today');
    // The one swiped away left room: nothing else is ended to make it.
    expect(sonner.dismissed).toEqual([]);
  });

  it('follows where each screen was opened from, and a tab that later reopens a detail doesn’t bring it back (P8-14)', () => {
    offer('Water 500 ml', '/day/today');
    followPlace({ path: '/track/reading/g1', from: '/day/today' });
    followPlace({ path: '/track/walk/W', from: '/track/reading/g1' });
    followPlace({ path: '/day/today' });
    expect(standing()).toHaveLength(1);
    followPlace({ path: '/home' });
    expect(standing()).toEqual([]);
    followPlace({ path: '/track/reading/g1', from: '/day/today' });
    expect(standing()).toEqual([]);
  });

  it('ends on a detail opened from another screen, and a restored line goes when its screen is left', async () => {
    offer('Glucose 140 mg/dL', '/hub/glucose');
    followPlace({ path: '/track/walk/W', from: '/day/today' });
    expect(standing()).toEqual([]);
    offer('Water 500 ml', '/day/today');
    const water = ids()[1];
    await press(water);
    followPlace({ path: '/home' });
    expect(sonner.dismissed).toContain(water);
  });

  it('ends every Undo on an edit, and one whose entry was restored from Recently deleted', () => {
    offer('Water 500 ml', '/day/today', undefined, 'deleted-1');
    offer('Water 250 ml', '/day/today', undefined, 'deleted-2');
    dismissUndoFor('deleted-1');
    expect(standing()).toEqual([ids()[1]]);
    endUndos();
    expect(standing()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them to check they fail**

Run: `npx vitest run src/components/hig/undoScope.test.ts src/components/hig/undo.test.ts`
Expected: FAIL, "Cannot find module './undoScope'" and "./undo".

- [ ] **Step 3: Write** `src/components/hig/undoScope.ts`

```ts
/**
 * Where an Undo belongs (B-04, board D113): the screen it was offered on —
 * Today's log is one screen, whichever day it shows — and the record details
 * opened from that screen, or from one of those. Where a screen was opened
 * from is its router state's origin (`useOrigin`), or the screen below it on
 * the navigation stack where a link carries none. Pure, so the rule is
 * tested without a router.
 */
export interface Place {
  /** The route on screen now, with or without its query. */
  path: string;
  /** Where this screen was opened from. */
  from?: string;
}

export interface Scope {
  /** The screen the Undo was offered on. */
  root: string;
  /** The record details opened within it so far. */
  inside: readonly string[];
}

/** The app's record screens (`recordPath`) and Log a meal: the screens that can be a record's detail at all. */
const RECORD_SCREENS = ['/track/reading/', '/track/pressure/', '/track/walk/', '/track/session/', '/track/workout/', '/track/check-in/'];
const MEAL_SCREEN = '/hub/food/log';

/** A route's path, without its query or hash. */
export const pathOf = (route: string): string => route.split(/[?#]/)[0] || '/';

export const isDetail = (route: string): boolean => {
  const path = pathOf(route);
  return path === MEAL_SCREEN || RECORD_SCREENS.some(r => path.startsWith(r) && path.length > r.length);
};

const sameScreen = (a: string, b: string) => a === b || (a.startsWith('/day/') && b.startsWith('/day/'));

export const scopeOf = (root: string): Scope => ({ root: pathOf(root), inside: [] });

/** The scope after a navigation, or undefined when the place is outside it, and the Undo ends. */
export function follow(scope: Scope, place: Place): Scope | undefined {
  const path = pathOf(place.path);
  if (sameScreen(path, scope.root) || scope.inside.includes(path)) return scope;
  const from = place.from === undefined ? undefined : pathOf(place.from);
  const opened = from !== undefined && (sameScreen(from, scope.root) || scope.inside.includes(from));
  return opened && isDetail(path) ? { ...scope, inside: [...scope.inside, path] } : undefined;
}
```

- [ ] **Step 4: Write** `src/components/hig/undo.ts`

```ts
/**
 * Undo, for every routine delete (B-04, M19; board D113): at most two
 * standing, the newer stacked above the older, and restoring one keeps the
 * other. Never on a timer. Leaving the screen it was offered on and the
 * details opened from it, or any edit the store stores, ends it; Recently
 * deleted remains. What happens after a tap is said in the same toast, in
 * place, until it is closed or its screen is left (K8-03): a restore, a
 * restore that didn't save beside Undo to try again, or one with nothing to
 * put back, which is no failure (K8-06). Plan 7's food Undo, moved here, so
 * every kind shares one stack.
 */
import { toast } from 'sonner';
import { TOAST_STYLE, UNDO_STYLE } from './toast';
import { follow, scopeOf, type Place, type Scope } from './undoScope';

interface Offer {
  key: string;
  scope: Scope;
  /** The Recently deleted entry it restores, when it has one. */
  entry?: string;
  /** Still an Undo; once its record is back, a line saying so. */
  undo: boolean;
}

export const UNDO_LABEL = 'Undo';
export const CLOSE_LABEL = 'Close';
export const NOT_RESTORED = 'It wasn’t restored.';

/** What an Undo's restore did: back (with words of its own, when it had nothing to put back), or not, and why. */
export type UndoOutcome = { done: true; said?: string } | { done: false; problem: string };

let offers: Offer[] = [];
let seq = 0;
/** Moves on whenever every offer ends at once, so a restore that settles after its offer was ended can tell (P8S-16). */
let generation = 0;

const forget = (key: string) => {
  offers = offers.filter(o => o.key !== key);
};
const drop = (key: string) => {
  toast.dismiss(key);
  forget(key);
};

/** Offer Undo. `undo` puts the record back, and says why when it couldn't. */
export function offerUndo({ text, restored, scope, entry, undo }: {
  text: string;
  /** Said in its place once it is back: "Water 500 ml restored". */
  restored: string;
  /** The screen it is offered on: where the person is, or is going back to. */
  scope: string;
  entry?: string;
  undo: () => Promise<UndoOutcome>;
}): void {
  const key = `undo-${++seq}`;
  const born = generation;
  /** This offer still stands: the same one, on a screen it belongs to. */
  const standing = () => born === generation && offers.some(o => o.key === key);
  offers = [...offers, { key, scope: scopeOf(scope), undo: true, ...(entry ? { entry } : {}) }];
  // Two at most, the newer stacked above the older; restoring one keeps the other (B-04).
  for (const old of offers.filter(o => o.undo).slice(0, -2)) drop(old.key);
  // One restore at a time: a second tap while the first saves would ask for the entry twice.
  let saving = false;
  const tap = (event: { preventDefault(): void }) => {
    // The toast stays until the record is stored back (as Edit Home's Undo does).
    event.preventDefault();
    if (saving) return;
    saving = true;
    void undo().then(outcome => {
      saving = false;
      // Ended while it saved (its screen left, an edit stored, closed or swiped away): it says
      // nothing now, on a screen it no longer belongs to, and every other offer stays (P8S-16).
      if (!standing()) return;
      if (!outcome.done) {
        // The error stays next to its cause, with Undo to try again (J§20.4 rule 9).
        show(`${text}. ${NOT_RESTORED} ${outcome.problem}`, 'undo');
        return;
      }
      offers = offers.map(o => (o.key === key ? { ...o, undo: false } : o));
      show(outcome.said ?? restored, 'close');
    });
  };
  const show = (words: string, kind: 'undo' | 'close') => toast(words, {
    id: key, duration: Infinity, style: TOAST_STYLE, actionButtonStyle: UNDO_STYLE,
    action: kind === 'undo' ? { label: UNDO_LABEL, onClick: tap } : { label: CLOSE_LABEL, onClick: () => forget(key) },
    onDismiss: () => forget(key),
  });
  show(text, 'undo');
}

/** Ends every Undo, and every line one left: an edit was stored (B-04). */
export function endUndos(): void {
  for (const o of offers) toast.dismiss(o.key);
  offers = [];
  generation += 1;
}

/** Ends the Undo for an entry restored another way, from Recently deleted; the other stays. */
export function dismissUndoFor(entry: string): void {
  for (const o of offers) if (o.entry === entry) toast.dismiss(o.key);
  offers = offers.filter(o => o.entry !== entry);
}

/** After every navigation (`main.tsx`): an Undo, or its line, whose screen and details were left ends. */
export function followPlace(place: Place): void {
  offers = offers.flatMap(o => {
    const scope = follow(o.scope, place);
    if (scope) return [{ ...o, scope }];
    toast.dismiss(o.key);
    return [];
  });
}

/** Tests only. */
export function resetUndosForTests(): void {
  offers = [];
  seq = 0;
  generation += 1;
}
```

Run: `npx vitest run src/components/hig`
Expected: PASS.

- [ ] **Step 5: An edit the store stores ends the Undos.** In `src/store/useStore.ts`:
  - beside the other listeners:

```ts
const editListeners = new Set<() => void>();

/**
 * Told after every change the person made is stored (B-04, D113): what ends
 * an Undo, wherever it was made, a manual workout's sets included. A delete,
 * a restore, expiry and reading progress pass `edit: false`, and aren't.
 */
export function subscribeEdits(listener: () => void): () => void {
  editListeners.add(listener);
  return () => void editListeners.delete(listener);
}
```

  - in `pump`, after `job.m.settle(result);`: `if (result.ok && job.m.edit !== false) for (const listener of [...editListeners]) listener();`;
  - `setContentState`'s mutation gains `edit: false,`: what has been read in Learn is no edit;
  - `resetForTests()` adds `editListeners.clear();`.

  In `src/main.tsx`, import `followPlace` and `endUndos` from `@/components/hig/undo`, `cameFrom` and `originOf` beside `followRouter`, and `subscribeEdits` beside `getState`; after `followRouter(router)` (whose subscription records the stack first, so `cameFrom()` is the screen below):

```tsx
// An Undo belongs to its screen and the details opened from it (B-04, D113), and an edit ends it.
router.subscribe(state => followPlace({ path: state.location.pathname, from: originOf(state.location.state)?.path ?? cameFrom() }))
subscribeEdits(endUndos)
```

  Append to `src/store/recent.store.test.ts`:

```ts
describe('what an edit is, to Undo (B-04, D113)', () => {
  it('a stored edit is heard, a manual workout’s set included; a delete, a restore and expiry are not', async () => {
    let edits = 0;
    store.subscribeEdits(() => { edits += 1; });
    expect((await store.addObservation({ kind: 'water', value: 250, scope: 'dayTotal', source: 'manual', at: AT, id: 'w1' })).ok).toBe(true);
    expect(edits).toBe(1);
    const gone = await store.deleteRecord({ kind: 'reading', id: 'w1' });
    if (!gone.ok) throw gone.failure;
    expect((await store.restoreDeleted(gone.value)).ok).toBe(true);
    expect((await store.expireDeleted()).ok).toBe(true);
    expect(edits).toBe(1);
    const set = { id: 'a', exerciseId: 'goblet-squat', setNumber: 1, plannedReps: 10, actualReps: 10, weight: 20, status: 'completed', rpe: null };
    expect((await store.putSession({ id: 's1', date: '2026-10-08', dayOfWeek: 'thursday', muscleGroup: 'lower', phase: 'foundation', week: 1, status: 'in_progress', sets: [set], startedAt: AT, completedAt: null, notes: '', totalVolume: 0 } as never)).ok).toBe(true);
    expect(edits).toBe(2);
  });
});
```

- [ ] **Step 6: Food deletes through Recently deleted, and an own food edited (K7-11).** In `src/food/store.ts`, import `deleteRecord` from `@/store/useStore` and `nowAt` from `@/health/observation`, and replace `deleteMeal`, `restoreMeal`, `deleteUsual` and `restoreUsual` with:

```ts
/** A meal deleted at once and kept in Recently deleted for 7 days (B-04, B-05, D109). Resolves with the entry's id; `restoreDeleted` brings it back. */
export const deleteMeal = (id: string): Promise<StoreResult<string>> => deleteRecord({ kind: 'meal', id });

/** A usual meal, the same way. */
export const deleteUsual = (id: string): Promise<StoreResult<string>> => deleteRecord({ kind: 'usualMeal', id });

/** One of the person's own foods, the same way (D111). Each meal keeps its own copy of the food, so none changes. */
export const deleteOwnFood = (id: string): Promise<StoreResult<string>> => deleteRecord({ kind: 'ownFood', id });

/**
 * An own food edited (K7-11): a new version of its definition, under the
 * same id. Its `updatedAt` is the version, so a merge takes the copy changed
 * last. Each meal item keeps its own snapshot of the food and the version it
 * was (Plan 7's fix, board D134), so only meals logged from now on take the
 * change. One deleted since, on another screen or in another tab, is never
 * brought back by an edit: only its Restore does that.
 */
export function editOwnFood(food: CustomFood): Promise<StoreResult> {
  return writeRecords(records => {
    if (!customFoodsIn(records).some(f => f.id === food.id)) {
      throw new StoreFailure('conflict', 'That food was deleted elsewhere, so this wasn’t saved. Nothing was changed.');
    }
    return { put: { customFoods: [stored({ ...food, updatedAt: nowAt() })] } };
  });
}
```

`customFoodsIn` joins the `./records` import. Drop the imports nothing uses now (`npm run lint` names them: `restored`, `putRecords` and `removeRecords`). In `src/food/store.test.ts`, "deletes at once, remembers the deletion, and brings the meal back under a fresh id" becomes the first case below, and the second is added after it, with `customItem` imported from `./estimate`; in `describe('usual meals')`, "are removed at once and come back under a fresh id" becomes the third, since `restoreUsual` goes:

```ts
  it('deletes at once into Recently deleted, and brings the meal back under a fresh id (B-05, D110)', async () => {
    await booted();
    await food.saveMeal(meal('meal-1'));
    const deleted = await food.deleteMeal('meal-1');
    if (!deleted.ok) throw deleted.failure;
    expect(store.getState().settings.deleted?.records?.meals).toEqual(['meal-1']);
    const back = await store.restoreDeleted(deleted.value);
    if (!back.ok) throw back.failure;
    expect(back.value.kind).toBe('meal');
    expect(mealsIn(store.getState().records)).toEqual([expect.objectContaining({ id: back.value.id, restoredFrom: 'meal-1', items: meal('meal-1').items })]);
    // The original's deletion record stays, so an older backup can't bring it back beside its copy (B-05).
    expect(store.getState().settings.deleted?.records?.meals).toEqual(['meal-1']);
  });

  it('an own food edited is a new version of it, and changes only the meals logged after (K7-11)', async () => {
    await booted();
    const bhel: CustomFood = { id: 'food-1', name: 'Bhel puri', per: { qty: 1, unit: 'plate' }, kcal: 300, createdAt: AT, updatedAt: AT };
    await food.saveMeal({ ...meal('meal-1'), items: [customItem(bhel, 1)] }, { customFoods: [bhel] });
    expect((await food.editOwnFood({ ...bhel, name: 'Bhel puri, small plate', kcal: 220 })).ok).toBe(true);
    const edited = customFoodsIn(store.getState().records)[0];
    // A new version of the same food: its `updatedAt` moves on, so a merge takes this copy over an older one.
    expect(edited).toMatchObject({ id: 'food-1', name: 'Bhel puri, small plate', kcal: 220, createdAt: AT });
    expect(Date.parse(edited.updatedAt)).toBeGreaterThan(Date.parse(AT));
    // The meal logged before keeps its own snapshot, and the version it was.
    expect(mealsIn(store.getState().records)[0].items[0]).toMatchObject({ name: 'Bhel puri', basis: { kcal: 300 }, kcal: 300, version: AT });
    // One logged now takes the new version.
    await food.saveMeal({ ...meal('meal-2'), items: [customItem(edited, 1)] });
    expect(mealsIn(store.getState().records).find(m => m.id === 'meal-2')!.items[0])
      .toMatchObject({ name: 'Bhel puri, small plate', basis: { kcal: 220 }, kcal: 220, version: edited.updatedAt });
    // One deleted since is never brought back by an edit.
    const gone = await food.deleteOwnFood('food-1');
    if (!gone.ok) throw gone.failure;
    const late = await food.editOwnFood({ ...edited, kcal: 250 });
    expect(!late.ok && late.failure.code).toBe('conflict');
    expect(customFoodsIn(store.getState().records)).toEqual([]);
  });

  it('are removed at once into Recently deleted and come back under a fresh id', async () => {
    await booted();
    const usual: SavedMeal = { id: 'usual-1', name: 'Weekday lunch', meal: 'lunch', items: [roti], savedAt: AT, updatedAt: AT };
    await food.saveMeal(meal('meal-1'), { usual });
    const deleted = await food.deleteUsual('usual-1');
    if (!deleted.ok) throw deleted.failure;
    expect(savedMealsIn(store.getState().records)).toEqual([]);
    const back = await store.restoreDeleted(deleted.value);
    if (!back.ok) throw back.failure;
    expect(savedMealsIn(store.getState().records)).toEqual([expect.objectContaining({ id: back.value.id, restoredFrom: 'usual-1', name: 'Weekday lunch' })]);
    expect(back.value.id).toMatch(/^usual-/);
    expect(food.newMealId()).toMatch(/^meal-/);
    expect(food.newCustomId()).toMatch(/^food-/);
  });
```

  (`AT`, `roti` and `meal` are the file's own fixtures.)

- [ ] **Step 7: Food's deletes with Undo, and Plan 7's callers.** `src/screens/food/undo.ts` becomes:

```ts
/**
 * Food's deletes, at once with Undo (B-04, B-05; board D111, D113): each
 * kept 7 days in Recently deleted, its Undo on the one stack every delete
 * shares (`@/components/hig/undo`), scoped to the screen the delete goes back
 * to, so it stands while a detail opened from there comes and goes (H7-15).
 * Resolves with what went wrong, in words, or nothing.
 */
import { offerUndo, type UndoOutcome } from '@/components/hig/undo';
import { FOOD_COPY } from '@/food/copy';
import { SLOT_LABEL } from '@/food/format';
import { deleteMeal, deleteOwnFood, deleteUsual } from '@/food/store';
import type { CustomFood, MealRecord, SavedMeal } from '@/food/types';
import type { StoreResult } from '@/store/db';
import { restoreDeleted } from '@/store/useStore';

const restoring = (entry: string) => async (): Promise<UndoOutcome> => {
  const back = await restoreDeleted(entry);
  return back.ok ? { done: true } : { done: false, problem: back.failure.message };
};

async function withUndo(deleting: Promise<StoreResult<string>>, text: string, restored: string, scope: string): Promise<string | undefined> {
  const result = await deleting;
  if (!result.ok) return result.failure.message;
  offerUndo({ text, restored, scope, entry: result.value, undo: restoring(result.value) });
  return undefined;
}

export const deleteMealWithUndo = (meal: MealRecord, scope: string) =>
  withUndo(deleteMeal(meal.id), FOOD_COPY.deleted(SLOT_LABEL[meal.meal]), FOOD_COPY.restored(SLOT_LABEL[meal.meal]), scope);

export const deleteUsualWithUndo = (usual: SavedMeal, scope: string) =>
  withUndo(deleteUsual(usual.id), FOOD_COPY.removed(usual.name), FOOD_COPY.restored(usual.name), scope);

export const deleteOwnFoodWithUndo = (food: CustomFood, scope: string) =>
  withUndo(deleteOwnFood(food.id), FOOD_COPY.deleted(food.name), FOOD_COPY.restored(food.name), scope);
```

  - `src/screens/food/LogMealSheet.tsx`: its import of `endFoodUndos` and `offerFoodUndo` becomes `import { deleteMealWithUndo } from './undo';`, and `deleteMeal`, `restoreMeal` leave the `@/food/store` import. Delete each `endFoodUndos()` call: a stored save ends the Undos by itself now (`subscribeEdits`). In `remove`, `const result = await deleteMeal(editing.id);` through the `offerFoodUndo({ … });` call become:

```tsx
    // The screen the sheet goes back to: Today's log, or the hub.
    const problem = await deleteMealWithUndo(editing, cameFrom() ?? '/hub/food');
    busy.current = false;
    setSaving(false);
    if (problem) {
      stay();
      setError(`${FOOD_COPY.didNotSave} ${problem}`);
      return;
    }
```

  and the `leave();` after it stays.

  - `src/screens/food/UsualMealsScreen.tsx`: `import { offerFoodUndo, useFoodUndoScope } from './undo';` becomes `import { deleteUsualWithUndo } from './undo';`; `deleteUsual` and `restoreUsual` leave their import; delete `useFoodUndoScope('/hub/food/usual');`; `remove`'s body becomes `const problem = await deleteUsualWithUndo(u, '/hub/food/usual'); if (problem) setError(…)`, with the words its failure already shows.
  - `src/screens/food/FoodHubScreen.tsx` and `src/screens/track/MyDay.tsx`: delete `useFoodUndoScope(…);` and its import.
  - `src/screens/food/parts.tsx`, `OwnFoodPage`: its props become `{ name: typed, numbers, onBack, onAdd, food, action }` with `onBack?: () => void`, `food?: CustomFood` and `action?: string`; `<BackToMeal onBack={onBack} />` renders only `{onBack && …}`; the fields start from the food being edited (`useState(food?.name ?? typed)`, `String(food?.per.qty ?? 1)`, `food?.per.unit ?? 'plate'`, `food?.kcal !== undefined ? String(food.kcal) : ''`, the same for carbs, and the allergens as they were answered: `food?.allergens === undefined ? [] : food.allergens.length > 0 ? [...food.allergens] : ['none']`, since an empty list is "None of these" (H7-04)); `onAdd`'s food keeps the edited one's identity, and nothing else of it, so a cleared figure is gone. Its new `updatedAt` is the new version (board D134):

```tsx
      onAdd({
        id: food?.id ?? newCustomId(), name: name.trim().slice(0, 60), per: { qty: q, unit: unit.trim().slice(0, 20) },
        ...(k !== undefined ? { kcal: k } : {}), ...(c !== undefined ? { carbsG: c } : {}),
        ...(allergens.length > 0 ? { allergens: allergens.filter((a): a is AllergenId => a !== 'none') } : {}), createdAt: food?.createdAt ?? now, updatedAt: now,
      });
```

    and its button reads `{action ?? FOOD_COPY.addToMeal}`.

  - Delete `src/screens/food/undo.test.ts`. What it proved of the stack is `src/components/hig/undo.test.ts`'s now: two at most with the oldest ended, nothing on a timer, ended by leaving and by an edit, kept with why on a refusal, stored once however often Undo is tapped, and a toast swiped away forgotten. Its two cases about a screen mounting and remounting go with the mount counting, since an Undo follows where its screen was opened from now (D113).

  `grep -rn "offerFoodUndo\|endFoodUndos\|useFoodUndoScope\|holdFoodUndoScope\|restoreMeal\|restoreUsual" src` prints nothing.

- [ ] **Step 8: The H7-15 caller test.** Write `src/screens/food/undo.callers.test.ts`:

```ts
/**
 * H7-15 (B-04, D113): Plan 7's food Undo ended when a detail opened from
 * Today's log, or the usual-meal logging detail, closed. Through the real
 * store, the food deletes Plan 7's screens call, and the one Undo stack, with
 * sonner a stand-in and each navigation told to `followPlace` as `main.tsx`'s
 * router subscription tells it: two meals deleted from details opened from
 * Today's log stand together back on the log, either restored first; and the
 * same for two usual meals around a logging detail opened from Usual meals.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeIndexedDB } from '@/store/fakeIdb';

type Shown = { text: string; id?: string; action?: { label: string; onClick: (e: { preventDefault(): void }) => void } };
const sonner = vi.hoisted(() => ({ shown: [] as Shown[], dismissed: [] as string[] }));
vi.mock('sonner', () => ({
  toast: Object.assign((text: string, options: Record<string, unknown> = {}) => { sonner.shown.push({ text, ...options } as Shown); return options.id; }, {
    dismiss: (id: string) => void sonner.dismissed.push(id),
  }),
}));

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;
Object.assign(globalThis, { document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} } });

const store = await import('@/store/useStore');
const { deleteMealWithUndo, deleteUsualWithUndo } = await import('./undo');
const { followPlace, resetUndosForTests } = await import('@/components/hig/undo');
const { saveMeal } = await import('@/food/store');
const { mealsIn, savedMealsIn } = await import('@/food/records');

const AT = '2026-10-08T13:10:00.000+05:30';
const meal = (id: string, slot: 'lunch' | 'dinner') => ({
  id, at: AT, day: '2026-10-08', meal: slot, items: [{ kind: 'quick' as const, size: 'normal' as const, name: 'Normal plate' }], level: 'meals' as const, loggedAt: AT, edits: [],
});
const usual = (id: string, name: string) => ({ id, name, items: [{ kind: 'quick' as const, size: 'normal' as const, name: 'Normal plate' }], savedAt: AT, updatedAt: AT });
const latest = (id: string) => [...sonner.shown].reverse().find(s => s.id === id)!;
const standing = () => [...new Set(sonner.shown.map(s => s.id!))].filter(id => !sonner.dismissed.includes(id) && latest(id).action?.label === 'Undo');
const press = async (id: string) => {
  latest(id).action!.onClick({ preventDefault() {} });
  await new Promise(resolve => setTimeout(resolve, 0));
};

beforeEach(async () => {
  local.clear();
  sonner.shown.length = 0;
  sonner.dismissed.length = 0;
  resetUndosForTests();
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
});
afterEach(() => store.resetForTests());

describe('food’s Undo stands while details come and go (H7-15, B-04)', () => {
  for (const first of [0, 1]) {
    it(`two meals deleted from details opened from Today’s log both stand, and either comes back first (${first === 0 ? 'lunch' : 'dinner'} first)`, async () => {
      expect((await saveMeal(meal('meal-lunch', 'lunch'))).ok).toBe(true);
      expect((await saveMeal(meal('meal-dinner', 'dinner'))).ok).toBe(true);
      followPlace({ path: '/day/today' });
      // Lunch's detail, opened from the log, deleted: the sheet goes back to the log.
      followPlace({ path: '/hub/food/log?edit=meal-lunch', from: '/day/today' });
      expect(await deleteMealWithUndo(meal('meal-lunch', 'lunch'), '/day/today')).toBeUndefined();
      followPlace({ path: '/day/today' });
      // Another meal's detail, opened and closed, and deleted too.
      followPlace({ path: '/hub/food/log?edit=meal-dinner', from: '/day/today' });
      expect(standing()).toHaveLength(1);
      expect(await deleteMealWithUndo(meal('meal-dinner', 'dinner'), '/day/today')).toBeUndefined();
      followPlace({ path: '/day/today' });
      expect(standing()).toHaveLength(2);
      expect(mealsIn(store.getState().records)).toEqual([]);
      const [lunch, dinner] = standing();
      await press(first === 0 ? lunch : dinner);
      expect(standing()).toEqual([first === 0 ? dinner : lunch]);
      await press(standing()[0]);
      expect(standing()).toEqual([]);
      expect(mealsIn(store.getState().records).map(m => m.restoredFrom).sort()).toEqual(['meal-dinner', 'meal-lunch']);
    });
  }

  it('two usual meals deleted around a logging detail opened from Usual meals both stand, either first', async () => {
    expect((await store.putRecords('savedMeals', [usual('usual-1', 'Weekday lunch'), usual('usual-2', 'Sunday lunch')])).ok).toBe(true);
    followPlace({ path: '/hub/food/usual' });
    expect(await deleteUsualWithUndo(usual('usual-1', 'Weekday lunch'), '/hub/food/usual')).toBeUndefined();
    // The usual meal's logging detail, opened from the list and closed.
    followPlace({ path: '/hub/food/log?usual=usual-2', from: '/hub/food/usual' });
    followPlace({ path: '/hub/food/usual' });
    expect(await deleteUsualWithUndo(usual('usual-2', 'Sunday lunch'), '/hub/food/usual')).toBeUndefined();
    expect(standing()).toHaveLength(2);
    const [weekday, sunday] = standing();
    await press(sunday);
    expect(standing()).toEqual([weekday]);
    await press(weekday);
    expect(savedMealsIn(store.getState().records).map(u => u.restoredFrom).sort()).toEqual(['usual-1', 'usual-2']);
  });
});
```

- [ ] **Step 9: "Your own foods" in Me → Food, with Edit and Delete** (D111, K7-11). Write `src/screens/you/OwnFoodsScreen.tsx`:

```tsx
/**
 * Me → Food → "Your own foods" (board D111, K7-11): the foods the person
 * added while logging. Edit makes a new version of a food's definition, for
 * the meals logged from then on; Delete removes it at once, with Undo, kept
 * in Recently deleted for 7 days. Each meal keeps the food as it was when it
 * was logged, so neither changes a meal already logged. Words only in the
 * list: a food's portion, never a figure (B-11).
 */
import { useState } from 'react';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { Sheet } from '@/components/hig/Sheet';
import { numbersView } from '@/food/level';
import { customFoodsIn } from '@/food/records';
import { editOwnFood } from '@/food/store';
import type { CustomFood } from '@/food/types';
import { OwnFoodPage } from '@/screens/food/parts';
import { deleteOwnFoodWithUndo } from '@/screens/food/undo';
import { useStore } from '@/store/useStore';

const HERE = '/me/food/own';

export function OwnFoodsScreen() {
  const { records, profile } = useStore();
  const foods = customFoodsIn(records);
  const numbers = numbersView(profile);
  const [editing, setEditing] = useState<CustomFood>();
  const [problem, setProblem] = useState<string>();

  const remove = async (f: CustomFood) => {
    setProblem(undefined);
    const why = await deleteOwnFoodWithUndo(f, HERE);
    if (why) setProblem(`${f.name} was not deleted: ${why}`);
  };
  const save = async (edited: CustomFood) => {
    const result = await editOwnFood(edited);
    if (!result.ok) return setProblem(`${edited.name} was not changed: ${result.failure.message}`);
    setEditing(undefined);
  };

  return (
    <Screen title="Your own foods" back={{ to: '/me/food', label: 'Food' }}>
      <Group footer="Foods you added while logging a meal. Each meal keeps a food as it was when you logged it, so changing or deleting one here changes no meal you’ve logged.">
        {foods.length === 0 && <Row label="No foods of your own yet" />}
        {foods.map(f => (
          <Row
            key={f.id}
            label={f.name}
            detail={`One portion: ${f.per.qty.toLocaleString('en-IN')} ${f.per.unit}`}
            accessory={(
              <div className="flex shrink-0 gap-3">
                <button type="button" aria-label={`Edit ${f.name}`} onClick={() => { setProblem(undefined); setEditing(f); }}
                  className="press-feedback min-h-12 rounded-full px-4 text-[length:var(--text-body)] font-semibold text-tint">
                  Edit
                </button>
                <button type="button" aria-label={`Delete ${f.name}`} onClick={() => void remove(f)}
                  className="press-feedback min-h-12 rounded-full px-4 text-[length:var(--text-body)] font-semibold text-stop">
                  Delete
                </button>
              </div>
            )}
          />
        ))}
      </Group>
      {problem && <p role="alert" className="px-4 text-[length:var(--text-subhead)] text-stop">{problem}</p>}
      <Sheet open={editing !== undefined} onOpenChange={open => { if (!open) setEditing(undefined); }} title="Edit your food" detent="large">
        {editing && <OwnFoodPage name={editing.name} food={editing} numbers={numbers} action="Save changes" onAdd={edited => void save(edited)} />}
      </Sheet>
    </Screen>
  );
}
```

  In `src/screens/you/routes.tsx`, add `<Route path="food/own" element={<OwnFoodsScreen />} />` beside `food`; in `src/screens/you/FoodScreen.tsx`, a row `<Row as={Link} to="/me/food/own" viewTransition label="Your own foods" detail="Foods you added while logging" chevron />` in its first group.

- [ ] **Step 10: Readings, a check-in's readings, blood pressure and walks at once.** In `src/screens/track/RecordDetails.tsx`, import `deleteRecord`, `restoreDeleted`, `getState` and `update` from `@/store/useStore` (beside the existing names), `restoreCheckInReading`, `ALREADY_BACK` and `NEWER_STAYS` beside `removeCheckInReading`, `freshId` and `nowAt` where they aren't, `NOT_RECENT`, `asRecent` and `recentKey` from `@/store/recent`, `isHeld` and `type HoldFailure` from `@/store/db`, `HeldProblem` from `@/components/checkin/HeldProblem`, and `offerUndo` and `type UndoOutcome` from `@/components/hig/undo`, and add above `ReadingDetail`:

```tsx
/** "Not deleted: …", under the record's actions, for a delete that went at once and failed. */
function DeleteProblem({ message }: { message?: string }) {
  return message ? <p role="alert" className="px-4 text-[length:var(--text-subhead)] text-stop">Not deleted: {message}</p> : null;
}

/** A routine delete's Undo (B-04): offered on the screen the person goes back to. */
function undoFor(entry: string, said: string, scope: string, undo: () => Promise<UndoOutcome>): void {
  offerUndo({ text: `${said} deleted`, restored: `${said} restored`, scope, entry, undo });
}
const restoring = (entry: string) => async (): Promise<UndoOutcome> => {
  const back = await restoreDeleted(entry);
  return back.ok ? { done: true } : { done: false, problem: back.failure.message };
};
/** Undo for a check-in's reading: back into its check-in, where it stood, and into the series (D110, K8-06). */
const checkInRestore = (entry: string, deps: Parameters<typeof restoreCheckInReading>[1]) => async (): Promise<UndoOutcome> => {
  const row = asRecent(getState().contentState[recentKey(entry)]);
  if (!row?.kept) return { done: false, problem: NOT_RECENT };
  const back = await restoreCheckInReading({ id: entry, kept: row.kept, ...(row.observations ? { observations: row.observations } : {}) }, deps);
  if (back.unchanged) return { done: true, said: back.unchanged === 'already' ? ALREADY_BACK : NEWER_STAYS };
  return back.stored && back.matched ? { done: true } : { done: false, problem: back.failure ?? 'the device did not keep it.' };
};
```

  - **`ReadingDetail`.** Beside `error`: `const [held, setHeld] = useState<HoldFailure>();`. `remove` becomes, and the `confirming` state and its `ConfirmSheet` go:

```tsx
  // Every reading goes at once, with Undo, and waits in Recently deleted (B-04, D111). One
  // that still holds movement is refused, with v1's way out for one typed wrongly (D119).
  const remove = async () => {
    setError(undefined);
    setHeld(undefined);
    const said = `${kindTitle(o.kind)} ${formatObservation(o, prefs)}`;
    if (inCheckIn && checkInDay && profile) {
      const entry = freshId('deleted-');
      const deps = { profile, update, date: checkInDay };
      const result = await removeCheckInReading(inCheckIn, [o.id], deps, { entry, at: nowAt(), observations: [o] });
      if (result.held) return setHeld(result.held);
      if (!result.stored) return setError(result.failure ?? 'the device did not keep it.');
      undoFor(entry, said, origin.path, checkInRestore(entry, deps));
    } else {
      const result = await deleteRecord({ kind: 'reading', id: o.id });
      if (!result.ok) return isHeld(result.failure) ? setHeld(result.failure) : setError(result.failure.message);
      undoFor(result.value, said, origin.path, restoring(result.value));
    }
    leave();
  };
```

    `Actions`' `onDelete` becomes `onDelete={() => void remove()}`, and after `<Actions … />` come `{held && <HeldProblem failure={held} profile={profile} onAnswered={() => { setHeld(undefined); void remove(); }} />}` and `<DeleteProblem message={error} />`.
  - **`PressureView`.** `const { back, leave } = useOrigin();` becomes `const { origin, back, leave } = useOrigin();`, with `held` beside `error` as above. `remove` becomes, with its `ConfirmSheet` and `confirming` state gone:

```tsx
  const remove = async () => {
    setError(undefined);
    setHeld(undefined);
    const said = `Blood pressure ${formatPressure(reading)}`;
    // A check-in's reading leaves its record too, in the same write (C2-01), and waits in Recently deleted.
    if (checkInDay && profile && reading.systolic !== null && reading.diastolic !== null) {
      const timed = !reading.halves.some(h => h.timeUnknown);
      const entry = freshId('deleted-');
      const deps = { profile, update, date: checkInDay };
      const result = await removeCheckInReading(
        { kind: 'pressure', ...(timed ? { at: reading.at } : {}), sys: reading.systolic, dia: reading.diastolic },
        reading.halves.map(h => h.id), deps, { entry, at: nowAt(), observations: reading.halves },
      );
      if (result.held) return setHeld(result.held);
      if (!result.stored) return setError(result.failure ?? 'the device did not keep it.');
      undoFor(entry, said, origin.path, checkInRestore(entry, deps));
      return leave();
    }
    // Both halves go together: one alone would be a reading nobody can read.
    const result = await deleteRecord(paired ? { kind: 'pressure', readingId } : { kind: 'reading', id: first.id });
    if (!result.ok) return isHeld(result.failure) ? setHeld(result.failure) : setError(result.failure.message);
    undoFor(result.value, said, origin.path, restoring(result.value));
    leave();
  };
```

    `onDelete` becomes `onDelete={() => void remove()}`; add the same `HeldProblem` and `<DeleteProblem message={error} />` after `Actions`. `removeReading` and `removeObservation` leave the store import.
  - **`WalkDetail`.** `const { back, leave } = useOrigin();` becomes `const { origin, back, leave } = useOrigin();`. `remove` becomes:

```tsx
  // A walk goes at once, with everything recorded with it, and waits in Recently deleted (B-04, D110, D111).
  const remove = async () => {
    setError(undefined);
    const result = await deleteRecord({ kind: 'walk', walkId: walk.id });
    if (!result.ok) return setError(`This walk was not deleted: ${result.failure.message}`);
    undoFor(result.value, 'Walk', origin.path, restoring(result.value));
    leave();
  };
```

    The walk's row `onClick` becomes `() => void remove()`. Delete the walk's `ConfirmSheet`, the `confirming` state and `doomed` (`deleteRecord` finds the walk's records itself). "Delete this route" keeps its `ConfirmSheet`: it is Plan 6's permanent erase of that route's coordinates (B-05, D111), never a routine delete. Add `{error && <p role="alert" className="px-4 text-[length:var(--text-subhead)] text-stop">{error}</p>}` after the last `Group`. `removeWalk` leaves the store import.
  - The file's header comment's last sentence becomes "A routine delete happens at once, with Undo, and waits in Recently deleted; one that would lift a hold is refused in place (D119); deleting a route is its own confirmed erase."

- [ ] **Step 11: A workout at once.** In `src/screens/workout/RecordScreen.tsx`, import `deleteWorkout` and `restoreWorkout` from `./deletion`, `offerUndo` from `@/components/hig/undo` and `useOrigin` from `@/screens/track/useOrigin`. In `RecordScreen`, `const { origin, leave } = useOrigin();`, and `onDeleted` becomes `onDeleted={() => { setGone(true); leave(); }}`. In `Record`, the delete row becomes:

```tsx
      <Group>
        <Row onClick={() => {
          setFailure(null);
          void deleteWorkout(session.id).then(result => {
            if (!result.ok) return setFailure(result.failure.message);
            const entry = result.value;
            // The workout and the records its sets set go at once, and wait in Recently deleted (B-04, D111).
            offerUndo({
              text: 'Workout deleted', restored: 'Workout restored', scope: undoScope, entry,
              undo: async () => {
                const back = await restoreWorkout(entry);
                return back.ok ? { done: true } : { done: false, problem: back.failure.message };
              },
            });
            onDeleted();
          });
        }} label={<span className="text-stop">Delete workout</span>} />
      </Group>
```

  with `Record` taking `undoScope: string` from `RecordScreen` (`undoScope={origin.path}`). Delete the `DeleteSheet`, its `deleting` state and its import; in `src/screens/workout/sheets.tsx`, delete `DeleteSheet`, which nothing uses now.

- [ ] **Step 12: Write the callers' test** `src/screens/track/deletes.callers.test.ts`

```ts
/**
 * Routine deletes through their real screens (B-04, D111, D119, P8-13): a
 * standalone reading and a check-in's reading go at once from their Track
 * screen, with no confirmation, offer Undo through the real toast manager,
 * and Undo puts each back; a 52 mg/dL low that holds movement is refused in
 * place, and "It was a mistake" lets it go. The store, the engine and a fake
 * IndexedDB are real; sonner and the router are stand-ins.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import type { DailyCheckIn } from '@/types/checkin';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { render, type Host } from '@/test/host';

type Shown = { text: string; id?: string; action?: { label: string; onClick: (e: { preventDefault(): void }) => void } };
const sonner = vi.hoisted(() => ({ shown: [] as Shown[], dismissed: [] as string[] }));
vi.mock('sonner', () => ({
  toast: Object.assign((text: string, options: Record<string, unknown> = {}) => { sonner.shown.push({ text, ...options } as Shown); return options.id; }, {
    dismiss: (id: string) => void sonner.dismissed.push(id),
  }),
}));
const router = vi.hoisted(() => ({ id: '', navigate: vi.fn() }));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: router.id }),
  useLocation: () => ({ pathname: `/track/reading/${router.id}`, search: '', state: { path: '/day/today', label: 'My Day' } }),
  useNavigate: () => router.navigate,
  Link: () => null,
  Navigate: () => null,
}));
vi.mock('@/components/hig/Screen', async () => {
  const { createElement: h } = await import('react');
  return { Screen: ({ title, children }: { title: string; children?: unknown }) => h('main', null, h('h1', null, title), children as never) };
});
vi.mock('@/components/hig/Sheet', async () => {
  const { createElement: h } = await import('react');
  return { Sheet: ({ open, children }: { open: boolean; children?: unknown }) => (open ? h('div', { role: 'dialog' }, children as never) : null) };
});

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;
Object.assign(globalThis, { document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} } });

const store = await import('@/store/useStore');
const { ReadingDetail } = await import('./RecordDetails');
const { resetPendingCheckInsForTests } = await import('@/components/checkin/pending');
const { evaluateCheckIn } = await import('@/engine/readiness');
const { resetUndosForTests } = await import('@/components/hig/undo');
const { HOLD_REFUSAL, MISTAKE_HINT } = await import('@/store/db');
const { MISTAKE_LABEL } = await import('@/components/checkin/HeldProblem');
const { checkInDayOf } = await import('@/health/observation');

const DAY = '2026-10-08';
const iso = (h: number, m = 0) => new Date(2026, 9, 8, h, m, 0).toISOString();
const PROFILE = createDefaultProfile({ health: { medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous', glucoseMonitor: 'meter', glucoseUnit: 'mg/dL', diabetes: 'type2' } });
const ON_INSULIN = createDefaultProfile({
  health: {
    medicinesReviewed: true, currentlyActive: true, clearance: 'vigorous', glucoseMonitor: 'meter', glucoseUnit: 'mg/dL',
    diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly', bpMonitor: true, hypertension: 'treated', bpMedicinesReviewed: true, betaBlocker: false, diuretic: false,
  },
});
let host: Host | undefined;

const latest = (id: string) => [...sonner.shown].reverse().find(s => s.id === id)!;
const undoOffers = () => [...new Set(sonner.shown.map(s => s.id!))].filter(id => !sonner.dismissed.includes(id) && latest(id).action?.label === 'Undo').map(latest);
async function open(id: string) {
  host?.unmount();
  router.id = id;
  host = render(createElement(ReadingDetail));
  await host.settle();
  return host;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 8, 9, 0));
  local.clear();
  sonner.shown.length = 0;
  sonner.dismissed.length = 0;
  router.navigate.mockClear();
  resetUndosForTests();
  store.resetForTests();
  resetPendingCheckInsForTests();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
});
afterEach(() => {
  host?.unmount();
  host = undefined;
  vi.useRealTimers();
});

describe('a reading deleted from its own screen (B-04, D111)', () => {
  it('goes at once, with no confirmation, offers Undo on the screen it came from, and Undo puts it back', async () => {
    const saved = await store.addObservation({ kind: 'weight', value: 82, unit: 'kg', scope: 'pointInTime', source: 'manual', at: iso(8) });
    if (!saved.ok) throw saved.failure;
    const h = await open(saved.value.id);
    await h.click(h.button('Delete this reading'));
    expect(h.all().some(n => n.props.role === 'dialog')).toBe(false);
    expect(store.getState().observations.some(o => o.kind === 'weight')).toBe(false);
    expect(router.navigate).toHaveBeenCalled();
    const [offer] = undoOffers();
    expect(offer.text).toMatch(/^Weight .+ deleted$/);
    offer.action!.onClick({ preventDefault() {} });
    await h.settle();
    expect(store.getState().observations).toEqual([expect.objectContaining({ kind: 'weight', value: 82, restoredFrom: saved.value.id })]);
  });

  it('a check-in’s reading the same way, out of its check-in and back into it, and into the series', async () => {
    const c: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 118, unit: 'mg/dL', measuredAt: iso(8, 50), source: 'meter' } };
    await store.update(prev => ({ ...prev, profile: PROFILE, checkIns: [{ ...c, readiness: evaluateCheckIn(PROFILE, c, []) }] }));
    const lifted = store.getState().observations.find(o => o.kind === 'glucose' && checkInDayOf(o) === DAY)!;
    const h = await open(lifted.id);
    await h.click(h.button('Delete this reading'));
    expect(store.getState().checkIns[0].glucose).toBeUndefined();
    const [offer] = undoOffers();
    offer.action!.onClick({ preventDefault() {} });
    await h.settle();
    expect(store.getState().checkIns[0].glucose).toMatchObject({ value: 118 });
    expect(store.getState().observations.filter(o => o.kind === 'glucose' && checkInDayOf(o) === DAY)).toEqual([expect.objectContaining({ value: 118, restoredFrom: lifted.id })]);
  });

  it('a 52 that holds movement isn’t deleted: it says why in place, and It was a mistake lets it go (D119)', async () => {
    const c: DailyCheckIn = { date: DAY, urgentSymptoms: false, emergency: [], news: [], sleep: 'gt7', energy: 4, glucose: { value: 140, unit: 'mg/dL', measuredAt: iso(8, 50), source: 'meter' } };
    await store.update(prev => ({ ...prev, profile: ON_INSULIN, checkIns: [{ ...c, readiness: evaluateCheckIn(ON_INSULIN, c, []) }] }));
    const low = await store.addObservation({ kind: 'glucose', value: 52, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: iso(8, 58) });
    if (!low.ok) throw low.failure;
    const h = await open(low.value.id);
    await h.click(h.button('Delete this reading'));
    expect(store.getState().observations.some(o => o.id === low.value.id)).toBe(true);
    expect(h.text()).toContain(`${HOLD_REFUSAL} ${MISTAKE_HINT}`);
    expect(undoOffers()).toEqual([]);
    expect(router.navigate).not.toHaveBeenCalled();
    await h.click(h.button(MISTAKE_LABEL));
    await h.settle();
    expect(store.getState().observations.some(o => o.id === low.value.id)).toBe(false);
    expect(undoOffers()).toHaveLength(1);
  });
});
```

Run: `npx vitest run src/components src/food src/screens/food src/screens/track src/screens/workout src/screens/you src/store`
Expected: PASS.

- [ ] **Step 13: Check by eye.** `npm run dev`, P01 seeded, 428×926 and 320×568:
  - Today's log → Water 250 ml, then 250 ml again (a 500 ml statement) → the Water row → "Delete this entry": back on Today's log at once, "Water 500 ml deleted" with Undo; the total reads 250 ml;
  - the Water row again → delete the 250 ml entry: two toasts, the newer above;
  - Undo on "Water 500 ml deleted": that toast now reads "Water 500 ml restored" with Close, the total is 500 ml, and the other toast still stands; a minute later both are still there; tap Home: both go;
  - lunch from Today's log → Delete; dinner from Today's log → Delete: back on the log, both Undos stand, and Undo on either brings its meal back (H7-15);
  - Me → Food → Your own foods → Edit on one: its sheet with its name and portion; change the name, Save changes: the list shows the new name, and a meal logged earlier with it still shows the old one; Delete on one: gone at once, with Undo.

- [ ] **Step 14: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/components/hig src/main.tsx src/store/useStore.ts src/store/recent.store.test.ts src/food src/screens/food src/screens/track src/screens/workout src/screens/you
git commit -m "feat: Delete every kind of record at once with one provenance-scoped Undo, nothing on a timer, and let own foods be edited"
```

---

### Task 8: "Recently deleted" in Today's log, every kind with Restore (J§20.4 rule 6)

**Files:**
- Create: `src/screens/track/recentRows.ts`, `src/screens/track/recentRows.test.ts`, `src/screens/track/recentRows.store.test.ts`
- Create: `src/screens/track/restoreEntry.ts`, `src/screens/track/RecentlyDeleted.tsx`
- Modify: `src/screens/track/MyDay.tsx` (the row, on today's log)

**Interfaces:**
- Consumes: `recentEntries`, `type RecentDeletion` (Task 5); `restoreDeleted`, `restoreWorkout`, `restoreCheckInReading`, `ALREADY_BACK`, `NEWER_STAYS` (Task 5); `dismissUndoFor` (Task 7); `kindTitle`, `formatObservation`, `formatClock`, `formatDayRelative`, `type DisplayPrefs` (`format.ts`); `formatPressure` (`timeline.ts`); `formatNumber` (`units.ts`); `sessionTitle` (`src/screens/workout/summary.ts`); `SLOT_LABEL`, `itemsLine` (Plan 7's `src/food/format.ts`, words only); `countsFree` (Plan 7's `src/food/level.ts`); `useClock` (`src/screens/today/clock.ts`).
- Produces:
  - `recentRow(e, prefs, today, countsFree?): { id: string; title: string; detail: string }`: an energy figure from movement named without its figure while counts-free is chosen, whenever the entry was made (Codex P8S-10);
  - `restoreEntry(e, profile): Promise<{ said?: string; problem?: string }>`: every kind's restore, with words of its own when there was nothing to put back (K8-06), or what went wrong;
  - `RecentlyDeleted(props: { prefs: DisplayPrefs; today: string })`: a row "Recently deleted" with the count, opening a sheet of the same name; each entry has a "Restore" button named `Restore <title>`. Nothing is shown when nothing was deleted in the last 7 days.

Every restore asks Task 5's `restorable` of what is stored when it is written, so an entry past its 7 days is refused however it is reached, and the sheet lists only `recentEntries`' (P8R-14). A reading that holds movement is never in the list: it can't be deleted until the engine has released it (D119).

- [ ] **Step 1: Write the failing test** `src/screens/track/recentRows.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { newObservation } from '@/health/observation';
import type { RecentDeletion } from '@/store/recent';
import { kindTitle, type DisplayPrefs } from './format';
import { recentRow } from './recentRows';

const prefs: DisplayPrefs = { glucose: 'mg/dL', mass: 'kg', length: 'cm', hba1c: '%', b12: 'pg/mL', vitaminD: 'ng/mL', hour12: true };
const entry = (over: Partial<RecentDeletion>): RecentDeletion => ({ id: 'deleted-1', at: '2026-10-08T09:05:00.000+05:30', kind: 'reading', of: 'x', ...over });
const DAY = '2026-10-08';

describe('Recently deleted, in words (J§20.4 rule 6)', () => {
  it('names a reading by its value, and says when it went', () => {
    const water = newObservation({ id: 'w2', kind: 'water', value: 500, scope: 'dayTotal', source: 'manual', at: '2026-10-08T08:05:00+05:30' });
    expect(recentRow(entry({ observations: [water] }), prefs, DAY)).toEqual({ id: 'deleted-1', title: 'Water 500 ml', detail: 'Deleted today at 9:05 am' });
    expect(recentRow(entry({ at: '2026-10-07T18:10:00.000+05:30', observations: [water] }), prefs, DAY).detail).toBe('Deleted yesterday at 6:10 pm');
  });

  it('names a blood pressure reading by both numbers, a walk by its minutes, and a check-in’s reading as its check-in’s', () => {
    const half = (kind: 'bloodPressureSystolic' | 'bloodPressureDiastolic', value: number) =>
      newObservation({ id: `reading-r1:${kind}`, kind, value, scope: 'pointInTime', source: 'manual', at: '2026-10-08T08:00:00+05:30', context: 'bp:reading-r1' });
    expect(recentRow(entry({ kind: 'pressure', observations: [half('bloodPressureSystolic', 142), half('bloodPressureDiastolic', 88)] }), prefs, DAY).title).toBe('Blood pressure 142/88 mmHg');
    const walked = newObservation({ id: 'w:s0:walkDuration', kind: 'walkDuration', value: 20, scope: 'sessionObserved', coverageMs: 1_200_000, source: 'measured', at: '2026-10-08T07:00:00+05:30', context: 'walk:w' });
    const pain = newObservation({ id: 'w:backPain', kind: 'backPain', value: 2, scope: 'pointInTime', source: 'manual', at: '2026-10-08T07:25:00+05:30', context: 'walk:w' });
    expect(recentRow(entry({ kind: 'walk', observations: [walked, pain] }), prefs, DAY).title).toBe('Walk, 20 min');
    const lifted = newObservation({ id: 'ci-1', kind: 'glucose', value: 118, unit: 'mg/dL', scope: 'pointInTime', source: 'manual', at: '2026-10-08T08:50:00+05:30', context: `checkIn:${DAY}` });
    expect(recentRow(entry({ kind: 'checkInReading', day: DAY, kept: { kind: 'glucose', slot: 'current', entry: { value: 118, unit: 'mg/dL', measuredAt: lifted.at } }, observations: [lifted] }), prefs, DAY).title)
      .toBe('Glucose 118 mg/dL, from your check-in');
  });

  it('names an energy figure from movement without its figure once counts-free is chosen, though it was deleted with estimates on (P8S-10)', () => {
    const energy = newObservation({ id: 'e1', kind: 'activeEnergy', value: 85, scope: 'sessionObserved', coverageMs: 1_200_000, source: 'measured', at: '2026-10-08T07:00:00+05:30' });
    const e = entry({ observations: [energy] });
    expect(recentRow(e, prefs, DAY).title).toMatch(/85/);
    const row = recentRow(e, prefs, DAY, true);
    expect(row.title).toBe(kindTitle('activeEnergy'));
    expect(`${row.title} ${row.detail}`).not.toMatch(/85|kcal/);
  });

  it('names a meal, a usual meal and an own food by their words, never a figure (B-11), and a workout by its kind', () => {
    const meal = { id: 'meal-1', at: '2026-10-08T13:10:00.000+05:30', day: DAY, meal: 'lunch', items: [{ kind: 'quick', size: 'normal', name: 'Normal plate' }], level: 'meals', loggedAt: '2026-10-08T13:10:00.000+05:30', edits: [] };
    expect(recentRow(entry({ kind: 'meal', records: { meals: [meal] } }), prefs, DAY).title).toBe('Lunch: Normal plate');
    expect(recentRow(entry({ kind: 'usualMeal', records: { savedMeals: [{ id: 'usual-1', name: 'Weekday lunch' }] } }), prefs, DAY).title).toBe('Usual meal: Weekday lunch');
    expect(recentRow(entry({ kind: 'ownFood', records: { customFoods: [{ id: 'food-1', name: 'Bhel puri' }] } }), prefs, DAY).title).toBe('Your own food: Bhel puri');
    expect(recentRow(entry({ kind: 'session', session: { id: 's1', date: DAY, muscleGroup: 'lower', guided: false } as never }), prefs, DAY).title).toMatch(/workout|session/i);
  });
});
```

  And `src/screens/track/recentRows.store.test.ts`, the choice changed after the deletion, through the real store:

```ts
/**
 * Codex P8S-10, through the real store: an energy entry deleted with
 * estimates on, then counts-free chosen. Recently deleted's row, Restore's
 * name and what Restore says all come from `recentRow`, read with the
 * person's choice as it is now (`RecentlyDeleted` reads `countsFree(profile)`
 * as it draws).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { countsFree } from '@/food/level';
import { createDefaultProfile } from '@/profile/defaults';
import { fakeIndexedDB } from '@/store/fakeIdb';
import type { DisplayPrefs } from './format';

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;

const store = await import('@/store/useStore');
const { recentEntries } = await import('@/store/recent');
const { recentRow } = await import('./recentRows');

const prefs: DisplayPrefs = { glucose: 'mg/dL', mass: 'kg', length: 'cm', hba1c: '%', b12: 'pg/mL', vitaminD: 'ng/mL', hour12: true };
/** What Recently deleted shows now: each row's title and detail, from the choice as it is now. */
const shown = () => recentEntries(store.getState().contentState, Date.now())
  .map(e => recentRow(e, prefs, '2026-10-08', countsFree(store.getState().profile)))
  .map(r => `${r.title} ${r.detail}`).join(' | ');

beforeEach(async () => {
  local.clear();
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
});

describe('Recently deleted follows counts-free as it is now (P8S-10)', () => {
  it('an energy entry deleted with estimates on shows no figure once counts-free is chosen', async () => {
    const profile = createDefaultProfile({ food: { level: 'estimates' } } as never);
    expect((await store.setProfile(profile)).ok).toBe(true);
    const energy = await store.addObservation({ kind: 'activeEnergy', value: 85, scope: 'sessionObserved', coverageMs: 1_200_000, source: 'measured', at: '2026-10-08T07:00:00+05:30' });
    if (!energy.ok) throw energy.failure;
    expect((await store.deleteRecord({ kind: 'reading', id: energy.value.id })).ok).toBe(true);
    expect(shown()).toMatch(/85/);
    expect((await store.setProfile({ ...profile, food: { ...profile.food, level: 'meals' } })).ok).toBe(true);
    expect(shown()).not.toMatch(/85|kcal/);
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/screens/track/recentRows.test.ts src/screens/track/recentRows.store.test.ts`
Expected: FAIL, "Cannot find module './recentRows'".

- [ ] **Step 3: Write** `src/screens/track/recentRows.ts`

```ts
/**
 * Recently deleted's words (J§20.4 rule 6, board D109): what each entry was,
 * and when it went. A meal, a usual meal and an own food are named by their
 * words, never a figure, and an energy figure from movement by its kind
 * alone while counts-free is chosen, as the log shows it, whenever it was
 * deleted (B-11, Codex P8S-10). The row, Restore's name and what Restore
 * says all come from this one title.
 */
import { SLOT_LABEL, itemsLine } from '@/food/format';
import type { MealRecord, SavedMeal } from '@/food/types';
import type { Observation } from '@/health/observation';
import type { RecentDeletion } from '@/store/recent';
import { sessionTitle } from '@/screens/workout/summary';
import { formatClock, formatDayRelative, formatObservation, kindTitle, type DisplayPrefs } from './format';
import { formatPressure } from './timeline';
import { formatNumber } from './units';

export interface RecentRow {
  id: string;
  title: string;
  detail: string;
}

const half = (obs: readonly Observation[], kind: 'bloodPressureSystolic' | 'bloodPressureDiastolic') => obs.find(o => o.kind === kind)?.value ?? null;

function titleOf(e: RecentDeletion, prefs: DisplayPrefs, countsFree: boolean): string {
  const obs = e.observations ?? [];
  switch (e.kind) {
    case 'reading':
      if (obs[0] && countsFree && obs[0].kind === 'activeEnergy') return kindTitle(obs[0].kind);
      return obs[0] ? `${kindTitle(obs[0].kind)} ${formatObservation(obs[0], prefs)}` : 'A reading';
    case 'checkInReading':
      if (e.kept?.kind === 'pressure') return `Blood pressure ${formatPressure({ systolic: e.kept.entry.sys, diastolic: e.kept.entry.dia })}, from your check-in`;
      return obs[0] ? `${kindTitle(obs[0].kind)} ${formatObservation(obs[0], prefs)}, from your check-in` : 'A check-in reading';
    case 'pressure':
      return `Blood pressure ${formatPressure({ systolic: half(obs, 'bloodPressureSystolic'), diastolic: half(obs, 'bloodPressureDiastolic') })}`;
    case 'walk': {
      const minutes = obs.filter(o => o.kind === 'walkDuration').reduce((t, o) => t + o.value, 0);
      return minutes > 0 ? `Walk, ${formatNumber(Math.round(minutes))} min` : 'Walk';
    }
    case 'meal': {
      const meal = e.records?.meals?.[0] as MealRecord | undefined;
      return meal ? `${SLOT_LABEL[meal.meal]}: ${itemsLine(meal.items)}` : 'A meal';
    }
    case 'usualMeal': {
      const usual = e.records?.savedMeals?.[0] as SavedMeal | undefined;
      return usual ? `Usual meal: ${usual.name}` : 'A usual meal';
    }
    case 'ownFood': {
      const food = e.records?.customFoods?.[0] as { name?: string } | undefined;
      return food?.name ? `Your own food: ${food.name}` : 'One of your own foods';
    }
    case 'session':
      return e.session ? sessionTitle(e.session) : 'A workout';
  }
}

/** One entry: "Water 500 ml", "Deleted today at 9:05 am". `countsFree`: the person's choice now, not when it was deleted. */
export function recentRow(e: RecentDeletion, prefs: DisplayPrefs, today: string, countsFree = false): RecentRow {
  const day = formatDayRelative(e.at.slice(0, 10), today);
  const when = day === 'Today' || day === 'Yesterday' ? day.toLowerCase() : `on ${day}`;
  return { id: e.id, title: titleOf(e, prefs, countsFree), detail: `Deleted ${when} at ${formatClock(e.at, prefs.hour12)}` };
}
```

Run: `npx vitest run src/screens/track/recentRows.test.ts src/screens/track/recentRows.store.test.ts`
Expected: PASS.

- [ ] **Step 4: Write** `src/screens/track/restoreEntry.ts` and `src/screens/track/RecentlyDeleted.tsx`

```ts
/**
 * Restore, for every kind in Recently deleted (B-05, D110): each through the
 * module that holds its rules, each checked against what is stored when it is
 * written (P8R-14). A session's personal records are worked out again
 * (`restoreWorkout`); a check-in's reading goes back into its check-in and
 * the series (`restoreCheckInReading`), or, when the check-in holds it
 * already or has a newer answer, says so and leaves the list (K8-06);
 * everything else is the store's (`restoreDeleted`).
 */
import { ALREADY_BACK, NEWER_STAYS, restoreCheckInReading } from '@/components/checkin/pending';
import type { RecentDeletion } from '@/store/recent';
import { restoreDeleted, update } from '@/store/useStore';
import { restoreWorkout } from '@/screens/workout/deletion';
import type { UserProfile } from '@/types/profile';

export async function restoreEntry(e: RecentDeletion, profile: UserProfile | undefined): Promise<{ said?: string; problem?: string }> {
  if (e.kind === 'session') {
    const back = await restoreWorkout(e.id);
    return back.ok ? {} : { problem: back.failure.message };
  }
  if (e.kind === 'checkInReading') {
    if (!profile || !e.day || !e.kept) return { problem: 'It needs your profile to go back into its check-in.' };
    const back = await restoreCheckInReading({ id: e.id, kept: e.kept, ...(e.observations ? { observations: e.observations } : {}) }, { profile, update, date: e.day });
    if (back.unchanged) return { said: back.unchanged === 'already' ? ALREADY_BACK : NEWER_STAYS };
    return back.stored && back.matched ? {} : { problem: back.failure ?? 'The device did not keep it.' };
  }
  const back = await restoreDeleted(e.id);
  return back.ok ? {} : { problem: back.failure.message };
}
```

```tsx
/**
 * Today's log's "Recently deleted" (J§20.4 rule 6, board D109): what was
 * deleted in the last 7 days, newest first, each with Restore. A restore is
 * merge-safe (B-05): the record comes back under a fresh id. What a restore
 * did is said under the list until the sheet closes: never on a timer.
 */
import { useMemo, useState } from 'react';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { dismissUndoFor } from '@/components/hig/undo';
import { countsFree } from '@/food/level';
import { useClock } from '@/screens/today/clock';
import { recentEntries } from '@/store/recent';
import { useStore } from '@/store/useStore';
import type { DisplayPrefs } from './format';
import { recentRow } from './recentRows';
import { restoreEntry } from './restoreEntry';

export function RecentlyDeleted({ prefs, today }: { prefs: DisplayPrefs; today: string }) {
  const { contentState, profile } = useStore();
  const { now } = useClock();
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const entries = useMemo(() => recentEntries(contentState, now.getTime()), [contentState, now]);
  // Read now, so a choice made after the deletion still keeps its figure off every row, name and outcome (P8S-10).
  const noFigures = countsFree(profile);
  if (entries.length === 0 && !open) return null;
  const routes = entries.some(e => (e.records?.routes?.length ?? 0) > 0);

  const restore = async (id: string, title: string) => {
    setProblem(undefined);
    setSaid(undefined);
    const e = entries.find(x => x.id === id);
    const done = e ? await restoreEntry(e, profile) : { problem: 'That’s no longer in Recently deleted.' };
    if (done.problem) {
      setProblem(`${title} wasn’t restored. ${done.problem}`);
      return;
    }
    // Its Undo, if one still stands, has nothing left to undo; any other stays (B-04).
    dismissUndoFor(id);
    setSaid(done.said ?? `${title} restored.`);
  };

  return (
    <>
      <Group>
        <Row onClick={() => { setSaid(undefined); setProblem(undefined); setOpen(true); }} label="Recently deleted" value={entries.length.toLocaleString('en-IN')} numeric chevron />
      </Group>
      <Sheet open={open} onOpenChange={setOpen} title="Recently deleted" detent="large">
        <Group footer={[
          'Each is kept on this device for 7 days after it was deleted, then removed for good.',
          routes ? 'Erase all routes, in Me → Data, removes the routes here at once.' : '',
        ].filter(Boolean).join(' ')}>
          {entries.length === 0 && <Row label="Nothing deleted in the last 7 days" />}
          {entries.map(e => {
            const row = recentRow(e, prefs, today, noFigures);
            return (
              <Row
                key={e.id}
                label={row.title}
                detail={row.detail}
                accessory={(
                  <button
                    type="button"
                    data-main=""
                    aria-label={`Restore ${row.title}`}
                    onClick={() => void restore(e.id, row.title)}
                    className="press-feedback min-h-[3.75rem] shrink-0 rounded-full px-4 text-[length:var(--text-body)] font-semibold text-tint"
                  >
                    Restore
                  </button>
                )}
              />
            );
          })}
        </Group>
        {said && <p role="status" className="px-4 text-[length:var(--text-body)]">{said}</p>}
        {problem && <p role="alert" className="px-4 text-[length:var(--text-subhead)] text-stop">{problem}</p>}
      </Sheet>
    </>
  );
}
```

  Restore is this sheet's main target, `data-main` and 60 px tall (Task 13, K8-04).

- [ ] **Step 5: Place it.** In `src/screens/track/MyDay.tsx`, import `RecentlyDeleted` from `./RecentlyDeleted`. In `TimelineView`, add `{day === current && <RecentlyDeleted prefs={prefs} today={current} />}` as the last child of both returns: after the "Add a record" block of the empty day, and after the "Records" group. A day emptied by deleting its records is when the row matters most.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/screens/track`
Expected: PASS.

- [ ] **Step 7: Check by eye.** `npm run dev`. Delete a water entry, a glucose reading and a meal from Today's log, then tap Home and come back:
  - "Recently deleted 3" sits at the end of the log, in light and dark, at 320×568 and 200% text;
  - its sheet lists them newest first, each with Restore beside or below it;
  - Restore on the water entry: "Water … restored." under the list until the sheet closes, and the row leaves the list; the log shows it again;
  - delete a check-in's glucose reading from Track, answer the check-in again with the same number, then Restore it here: "Already back in your check-in.", and the row leaves the list;
  - with VoiceOver's rotor (or the accessibility tree in DevTools) each button reads "Restore Water … ml".

- [ ] **Step 8: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/track/recentRows.ts src/screens/track/recentRows.test.ts src/screens/track/recentRows.store.test.ts src/screens/track/restoreEntry.ts src/screens/track/RecentlyDeleted.tsx src/screens/track/MyDay.tsx
git commit -m "feat: List what was deleted in the last 7 days in Today's log, every kind with Restore"
```

---

### Task 9: Food's trend, only with estimates (J§11.4–11.5, §12; B-11, K-22)

Plan 3 left `/trends/food` on the Food hub, saying Plan 7 would add the trend (D74). Plan 7 left it out: its `dailyNutrition()` is a series for a trend it doesn't build, and V-J31 marks Food's trend pending. It's built here.

**Files:**
- Create: `src/screens/trends/food.ts`, `src/screens/trends/food.test.ts`
- Modify: `src/screens/trends/metrics.ts` (`TrendId` gains `'food'`; `TRENDS.food`; `hasData`), `src/screens/trends/records.ts` (`TrendData.meals`, `TrendData.numbers`)
- Modify: `src/screens/trends/model.ts` (export `slotLabel` and `slotName`)
- Modify: `src/screens/trends/CategoryTrend.tsx` (`FoodTrend`), `src/screens/trends/routes.tsx` (`FoodHub` goes), `src/screens/trends/TrendsScreen.tsx` (Food's row)
- Modify: `src/food/boundaries.node.test.ts` (Plan 7's `WORDS_ONLY`)
- Modify: `scripts/e2e/acceptance/journeys/v31.mjs` (the pending item becomes a check)

**Interfaces:**
- Consumes: Plan 3's `TrendView`, `Headline`, `StatItem`, `TrendRowView`, `ChartModel`, `ChartSeries`, `Slot`, `TrendWindow`, `windowOf`, `windowTitle`, `DayContext`, `TRENDS`, `useTrendData`, `HubLinks`, `PeriodControl`, `TrendHeadlines`, `TrendChart`, `StatGrid`, `Segmented`; Plan 7's `mealsOn` (`src/food/days.ts`), `totalsOf`, `type Totals` (`estimate.ts`), `kcalText`, `carbsText` (`format.ts`), `FOOD_COPY.roughCarbs`, `numbersView`, `type NumbersView` (`level.ts`), `mealsIn` (`records.ts`), `type MealRecord`; `shiftDay` (`src/health/status.ts`).
- Produces, in `src/screens/trends/food.ts`:
  - `type FoodMetric = 'kcal' | 'carbs'`; `FOOD_METRICS: readonly { id: FoodMetric; label: string }[]` ("Energy", "Carbs"); `isFoodMetric(x: unknown): x is FoodMetric`;
  - `FOOD_TREND_COPY`: `statistic`, `noCompare`, `notLogged`, `noEstimate`, `stillToCome`, `partial(n)`;
  - `interface FoodInput { metric: FoodMetric; window: TrendWindow; meals: readonly MealRecord[]; ranges: boolean; ctx: DayContext }`;
  - `foodView(input: FoodInput): TrendView`; `foodRow(input: Omit<FoodInput, 'metric' | 'window'>): TrendRowView`.
- Produces, in Plan 3's files: `TRENDS.food` (`family: 'stated'`, coverage "day(s) with meals logged"); `hasData('food', data)` is true only with `data.numbers.show` and a meal; `TrendData.meals?: readonly MealRecord[]` and `TrendData.numbers?: NumbersView`; `/trends/food?metric=kcal|carbs&period=…&at=…`.

- [ ] **Step 1: Write the failing test** `src/screens/trends/food.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { MealItem, MealRecord } from '@/food/types';
import { foodRow, foodView } from './food';
import { hasData } from './metrics';
import { windowOf } from './periods';
import type { DayContext } from './stats';

const ctx: DayContext = { today: '2026-10-08', since: '2026-09-01', statusOn: () => 'normal', restOn: () => false };
const roti: MealItem = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40, kcal: 204, carbsG: 43.2, carbsLowG: 31.1, carbsHighG: 57 };
const bhel: MealItem = { kind: 'custom', customId: 'food-1', name: 'Bhel puri', count: 1 };
const meal = (id: string, day: string, items: MealItem[]): MealRecord =>
  ({ id, at: `${day}T13:10:00.000+05:30`, day, meal: 'lunch', items, level: 'estimates', loggedAt: `${day}T13:10:00.000+05:30`, edits: [] });
const MEALS = [meal('m1', '2026-10-05', [roti]), meal('m2', '2026-10-06', [roti, roti]), meal('m3', '2026-10-07', [roti, bhel])];
const week = windowOf('week', '2026-10-08');

describe('Food’s trend (journey §11.4, §12; B-11; D114)', () => {
  it('says “Estimated” before the figure and “in logged foods” after it, to the nearest 10 kcal, with no comparison', () => {
    const v = foodView({ metric: 'kcal', window: week, meals: MEALS, ranges: false, ctx });
    expect(v.headline).toEqual({ statistic: 'Estimated, a day on average', coverage: '3 days with meals logged', value: '270', unit: 'kcal in logged foods' });
    expect(v.change).toEqual({ text: 'Shown as logged, with no comparison to another period.' });
    expect(v.stats).toEqual([{ label: 'Days with meals logged', value: '3' }, { label: 'Meals logged', value: '3' }]);
    expect(v.notes).toEqual(['1 day has a food with no estimate: its figure is for the logged foods that have one.']);
    expect(JSON.stringify(v)).not.toMatch(/Highest|Higher than|Lower than|target|\bover\b/i);
  });

  it('gives each day its own words, and “Not logged” for a day with no meals', () => {
    const v = foodView({ metric: 'kcal', window: week, meals: MEALS, ranges: false, ctx });
    expect(v.table).toEqual({
      columns: ['Day', 'This week'],
      rows: [
        ['Monday, 5 October', 'Estimated 200 kcal in logged foods'],
        ['Tuesday, 6 October', 'Estimated 410 kcal in logged foods'],
        ['Wednesday, 7 October', 'Estimated 200 kcal in logged foods (a food has no estimate)'],
        ['Thursday, 8 October', 'Not logged'],
      ],
    });
    expect(v.chart.series).toEqual([expect.objectContaining({ kind: 'bars', values: [204, 408, 204, null, null, null, null] })]);
    expect(v.chart.slots.filter(s => s.future).map(s => s.key)).toEqual(['2026-10-09', '2026-10-10', '2026-10-11']);
  });

  it('gives carbs as a range with insulin, a sulfonylurea or a meglitinide, and says they are rough (K-22)', () => {
    const v = foodView({ metric: 'carbs', window: week, meals: MEALS, ranges: true, ctx });
    expect(v.headline).toMatchObject({ value: 'about 40–80', unit: 'g carbs in logged foods' });
    expect(v.chart.series[0].kind).toBe('ranges');
    expect(v.notes).toContain('Carb figures are rough estimates. Follow your care team’s plan.');
    expect(foodView({ metric: 'carbs', window: week, meals: MEALS, ranges: false, ctx }).headline).toMatchObject({ value: '60', unit: 'g carbs in logged foods' });
  });

  it('says a week with nothing logged in words, on its row too', () => {
    expect(foodView({ metric: 'kcal', window: week, meals: [], ranges: false, ctx }).headline).toEqual({ statistic: 'Estimated, a day on average', coverage: '0 days with meals logged', value: 'Not logged' });
    expect(foodRow({ meals: [], ranges: false, ctx }).value).toBe('Not logged this week');
    expect(foodRow({ meals: MEALS, ranges: false, ctx })).toMatchObject({ id: 'food', title: 'Food', value: 'Estimated, a day on average this week: 270 kcal in logged foods', spark: [204, 408, 204, null, null, null, null] });
  });

  it('is listed only while estimates are on and a meal is logged (B-11)', () => {
    const data = (meals: MealRecord[], show: boolean) => ({ observations: [], sessions: [], checkIns: [], meals, numbers: show ? { show: true as const, ranges: false } : { show: false as const } });
    expect(hasData('food', data(MEALS, true))).toBe(true);
    expect(hasData('food', data(MEALS, false))).toBe(false);
    expect(hasData('food', data([], true))).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/screens/trends/food.test.ts`
Expected: FAIL, "Cannot find module './food'".

- [ ] **Step 3: Food in Plan 3's registry.**
  - `src/screens/trends/records.ts`: `TrendData` gains

```ts
  /** Food (Plan 7), read only while estimates are on (D114). */
  meals?: readonly MealRecord[];
  /** `numbersView()`: whether food figures are shown at all (B-11). */
  numbers?: NumbersView;
```

    with `import type { MealRecord } from '@/food/types';` and `import type { NumbersView } from '@/food/level';`.
  - `src/screens/trends/metrics.ts`: `TrendId` gains `'food'`; `TRENDS` gains, after `steps`:

```ts
  food: fromRegistry('food', { family: 'stated', movement: false, unit: () => 'kcal', decimals: () => 0, per: 'day', coverage: days('day with meals logged', 'days with meals logged') }),
```

    `hasData` begins with `if (id === 'food') return data.numbers?.show === true && (data.meals?.length ?? 0) > 0;`; and `trendDef`'s doc comment loses "Food's comes in Plan 7".
  - `src/screens/trends/model.ts` (Plan 3's): `function slotLabel(` and `function slotName(` become `export function slotLabel(` and `export function slotName(`. They are private in Plan 3's plan (Codex P8R-18); this is the one change Food's trend makes to that file, and `grep -n "^export function slotLabel(\|^export function slotName(" src/screens/trends/model.ts` then prints two lines.

`TREND_ORDER` takes Food from the registry by itself: its category declares `/trends/food`.

- [ ] **Step 4: Write** `src/screens/trends/food.ts`

```ts
/**
 * Food's trend (journey §11.4–11.5, §12; B-11, K-22; board D114). Only while
 * estimates are on. A stated measure: a day with meals logged has its
 * estimate, and any other day says "Not logged". "Estimated" before every
 * figure and "in logged foods" after it; a day with a food that has no
 * estimate says so. No comparison with another period, no target and no
 * "highest day". kcal to the nearest 10; carbs a range with insulin, a
 * sulfonylurea or a meglitinide. It makes Plan 3's `TrendView`, so the chart,
 * its list and its words take it as they are.
 */
import { FOOD_COPY } from '@/food/copy';
import { mealsOn } from '@/food/days';
import { totalsOf, type Totals } from '@/food/estimate';
import { carbsText, kcalText } from '@/food/format';
import type { MealRecord } from '@/food/types';
import { shiftDay } from '@/health/status';
import { formatNumber } from '@/screens/track/units';
import type { ChartModel, ChartSeries, Slot } from './chart';
import { TRENDS } from './metrics';
import { slotLabel, slotName, type Headline, type StatItem, type TrendRowView, type TrendView } from './model';
import { windowOf, windowTitle, type TrendWindow } from './periods';
import type { DayContext } from './stats';

export type FoodMetric = 'kcal' | 'carbs';

export const FOOD_METRICS: readonly { id: FoodMetric; label: string }[] = [
  { id: 'kcal', label: 'Energy' },
  { id: 'carbs', label: 'Carbs' },
];

export const isFoodMetric = (x: unknown): x is FoodMetric => x === 'kcal' || x === 'carbs';

export const FOOD_TREND_COPY = {
  statistic: 'Estimated, a day on average',
  noCompare: 'Shown as logged, with no comparison to another period.',
  notLogged: 'Not logged',
  noEstimate: 'Logged, with no estimate',
  stillToCome: 'Still to come',
  partial: (n: number) => `${formatNumber(n)} ${n === 1 ? 'day has' : 'days have'} a food with no estimate: its figure is for the logged foods that have one.`,
} as const;

export interface FoodInput {
  metric: FoodMetric;
  window: TrendWindow;
  meals: readonly MealRecord[];
  /** Carbs as a range (K-22): `numbersView().ranges`. */
  ranges: boolean;
  ctx: DayContext;
}

type Range = TrendWindow['buckets'][number];
interface Figure { mean: number; low: number; high: number; partial: boolean }

const average = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** A day's figure, or nothing when none of its logged foods has one. */
function figureOf(t: Totals, metric: FoodMetric): Figure | undefined {
  if (metric === 'kcal') return t.withKcal > 0 ? { mean: t.kcal, low: t.kcal, high: t.kcal, partial: t.missing.some(m => m.kcal) } : undefined;
  return t.withCarbs > 0 ? { mean: t.carbsG, low: t.carbsLowG, high: t.carbsHighG, partial: t.missing.some(m => m.carbs) } : undefined;
}

/** Several days as one: the average day of those with a figure. */
function averaged(fs: readonly Figure[]): Figure | undefined {
  if (fs.length === 0) return undefined;
  return { mean: average(fs.map(f => f.mean)), low: average(fs.map(f => f.low)), high: average(fs.map(f => f.high)), partial: fs.some(f => f.partial) };
}

export function foodView({ metric, window: w, meals, ranges, ctx }: FoodInput): TrendView {
  const def = TRENDS.food;
  const unit = metric === 'kcal' ? 'kcal' : 'g carbs';
  const text = (f: Figure) => (metric === 'kcal' ? kcalText(f.mean) : carbsText({ carbsG: f.mean, carbsLowG: f.low, carbsHighG: f.high }, ranges));
  const bare = (f: Figure) => text(f).replace(/ (kcal|g carbs)$/, '');
  const said = (f: Figure) => `Estimated ${text(f)} in logged foods`;
  const daysIn = (range: Range) => {
    const out: { day: string; meals: number; f?: Figure }[] = [];
    for (let day = range.from; day <= range.to && day <= ctx.today; day = shiftDay(day, 1)) {
      const list = mealsOn(meals, day);
      const f = list.length > 0 ? figureOf(totalsOf(list.flatMap(m => m.items)), metric) : undefined;
      out.push({ day, meals: list.length, ...(f ? { f } : {}) });
    }
    return out;
  };

  const logged = daysIn({ from: w.from, to: w.to }).filter(d => d.meals > 0);
  const avg = averaged(logged.flatMap(d => (d.f ? [d.f] : [])));
  const title = windowTitle(w, ctx.today);
  const [one, many] = def.coverage;
  const headline: Headline = {
    statistic: FOOD_TREND_COPY.statistic,
    coverage: `${formatNumber(logged.length)} ${logged.length === 1 ? one : many}`,
    ...(avg ? { value: bare(avg), unit: `${unit} in logged foods` } : { value: FOOD_TREND_COPY.notLogged }),
  };
  const stats: StatItem[] = [
    { label: 'Days with meals logged', value: formatNumber(logged.length) },
    { label: 'Meals logged', value: formatNumber(logged.reduce((t, d) => t + d.meals, 0)) },
  ];
  const partialDays = logged.filter(d => !d.f || d.f.partial).length;
  const notes = [
    ...(partialDays > 0 ? [FOOD_TREND_COPY.partial(partialDays)] : []),
    ...(metric === 'carbs' && ranges ? [FOOD_COPY.roughCarbs] : []),
  ];

  const dayly = w.period === 'week' || w.period === 'month';
  const cells = w.buckets.map(b => {
    if (b.from > ctx.today) return { value: null, range: null, text: FOOD_TREND_COPY.stillToCome };
    const inBucket = daysIn(b).filter(d => d.meals > 0);
    const f = averaged(inBucket.flatMap(d => (d.f ? [d.f] : [])));
    if (!f) return { value: null, range: null, text: inBucket.length > 0 ? FOOD_TREND_COPY.noEstimate : FOOD_TREND_COPY.notLogged };
    return {
      value: f.mean,
      range: { min: f.low, max: f.high, mean: f.mean },
      text: `${said(f)}${dayly ? '' : ', on an average day'}${f.partial ? ' (a food has no estimate)' : ''}`,
    };
  });
  const slots: Slot[] = w.buckets.map((b, i) => {
    const name = slotName(w.period, b, ctx.today);
    const future = b.from > ctx.today;
    return {
      key: b.from, label: slotLabel(w.period, b), name, range: b,
      ...(future ? { future: true as const } : {}),
      ...(dayly && !future ? { day: b.from } : {}),
      text: `${name}: ${cells[i].text}.`,
    };
  });
  const colour = `var(${def.colour})`;
  const series: ChartSeries[] = metric === 'carbs' && ranges
    ? [{ kind: 'ranges', id: 'current', label: title, colour, values: cells.map(c => c.range) }]
    : [{ kind: 'bars', id: 'current', label: title, colour, values: cells.map(c => c.value) }];
  const chart: ChartModel = {
    slots, series, lines: [], unit, decimals: 0,
    ...(avg ? { average: { value: avg.mean, label: `Estimated ${text(avg)} a day on average` } } : {}),
  };
  const head = dayly ? 'Day' : w.period === 'sixMonths' ? 'Week' : 'Month';
  const rows = w.buckets.flatMap((b, i) => (b.from > ctx.today ? [] : [[slots[i].name, cells[i].text]]));
  return {
    title, headline, change: { text: FOOD_TREND_COPY.noCompare }, stats, notes, chart,
    table: { columns: [head, title], rows },
    summary: `${def.title}, ${title}. ${headline.statistic}, ${headline.coverage}: ${headline.value}${headline.unit ? ` ${headline.unit}` : ''}. ${[FOOD_TREND_COPY.noCompare, ...notes].join(' ')}`,
  };
}

/** Food's row on the Trends tab: this week's average day, the figure's words as the trend's own. */
export function foodRow({ meals, ranges, ctx }: Omit<FoodInput, 'metric' | 'window'>): TrendRowView {
  const view = foodView({ metric: 'kcal', window: windowOf('week', ctx.today), meals, ranges, ctx });
  const h = view.headline;
  const bars = view.chart.series.find(s => s.kind === 'bars');
  return {
    id: 'food', title: TRENDS.food.title, colour: TRENDS.food.colour,
    value: h.unit ? `${h.statistic} this week: ${h.value} ${h.unit}` : `${h.value} this week`,
    spark: bars?.kind === 'bars' ? bars.values : [],
  };
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/screens/trends`
Expected: PASS, the new file and Plan 3's.

- [ ] **Step 6: The screen.** In `src/screens/trends/CategoryTrend.tsx`, import `numbersView` from `@/food/level`, `mealsIn` from `@/food/records` and `FOOD_METRICS`, `foodView`, `isFoodMetric`, `type FoodMetric` from `./food`. `CategoryTrend`'s return becomes:

```tsx
  if (def.family === 'labs') return <LabsTrend def={def} />;
  return def.id === 'food' ? <FoodTrend def={def} /> : <PeriodTrend key={def.id} def={def} />;
```

and, after `PeriodTrend`:

```tsx
/**
 * Food's trend (D114): Energy or Carbs, with the period and its pager, and
 * no comparison. Without estimates its address opens the Food hub (D74).
 */
function FoodTrend({ def }: { def: TrendDef }) {
  const { state, today, ctx } = useTrendData();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const numbers = numbersView(state.profile);
  const show = numbers.show;
  const ranges = numbers.show && numbers.ranges;
  const meals = useMemo(() => mealsIn(state.records), [state.records]);
  const asked = params.get('period');
  const period: TrendPeriod = isTrendPeriod(asked) ? asked : 'week';
  const at = params.get('at');
  const anchor = at !== null && isDay(at) && at <= today ? at : today;
  const chosen = params.get('metric');
  const metric: FoodMetric = isFoodMetric(chosen) ? chosen : 'kcal';
  const w = useMemo(() => windowOf(period, anchor), [period, anchor]);
  const view = useMemo(() => (show ? foodView({ metric, window: w, meals, ranges, ctx }) : undefined), [show, metric, w, meals, ranges, ctx]);
  if (!view) return <Navigate to={{ pathname: '/hub/food', search: location.search }} replace state={location.state} />;
  const change = (next: { period?: TrendPeriod; at?: string; metric?: FoodMetric }) => {
    markInPlace();
    setParams(prev => {
      const p = new URLSearchParams(prev);
      if (next.period) p.set('period', next.period);
      if (next.at) p.set('at', next.at);
      if (next.metric) p.set('metric', next.metric);
      return p;
    }, { replace: true });
  };
  const earlier = previousWindow(w);
  // Back as far as the first meal or the first record, whichever came first.
  const since = [ctx.since, ...meals.map(m => m.day)].filter((d): d is string => d !== undefined).sort()[0];
  const origin: Origin = { path: location.pathname, label: def.title, ...(location.search ? { search: location.search } : {}) };

  return (
    <Screen title={def.title} back={{ to: '/trends', label: 'Trends' }}>
      <Segmented label="What to show" options={FOOD_METRICS.map(m => ({ id: m.id, label: m.label }))} value={metric} onChange={m => change({ metric: m })} />
      <PeriodControl
        period={period}
        onPeriod={p => change({ period: p })}
        title={view.title}
        labels={pagerLabels(period)}
        canPrevious={since !== undefined && earlier.to >= since}
        canNext={!isCurrent(w, today)}
        onPrevious={() => change({ at: earlier.from })}
        onNext={() => change({ at: nextWindow(w).from })}
      />
      <TrendHeadlines headline={view.headline} change={view.change} />
      <section aria-label={`${def.title} chart`} className="rounded-xl bg-grouped-card p-4">
        <TrendChart model={view.chart} label={`${def.title}, ${view.title}`} summary={view.summary} table={view.table} view={`${metric}:${period}:${w.from}`} origin={origin} />
      </section>
      <StatGrid items={view.stats} />
      {view.notes.length > 0 && (
        <div className="flex flex-col gap-1 px-1">
          {view.notes.map(note => <p key={note} className="text-[length:var(--text-footnote)] leading-snug text-muted-foreground">{note}</p>)}
        </div>
      )}
      <HubLinks def={def} origin={origin} />
    </Screen>
  );
}
```

In `src/screens/trends/routes.tsx`, delete `FoodHub`, its route and `useLocation` if nothing else uses it; the header comment's sentence about Food becomes "Food's trend is `:id` too, and opens the Food hub without estimates (D74, D114)."

In `src/screens/trends/TrendsScreen.tsx`, import `numbersView`, `mealsIn` and `foodRow` (from `./food`); the `data` memo adds `meals: mealsIn(state.records), numbers: numbersView(state.profile)` with `state.records` and `state.profile` in its dependencies; and `rows` becomes:

```tsx
  const rows = useMemo(() => TREND_ORDER.filter(id => hasData(id, data)).map(id => (id === 'food'
    ? foodRow({ meals: data.meals, ranges: data.numbers.show && data.numbers.ranges, ctx })
    : trendRow(TRENDS[id], data, prefs, ctx))), [data, prefs, ctx]);
```

- [ ] **Step 7: The boundary test.** In `src/food/boundaries.node.test.ts` (Plan 7's), `WORDS_ONLY` gains:

```ts
  'src/screens/trends/food.ts': 'CategoryTrend.tsx and TrendsScreen.tsx pass numbersView() and draw no Food trend without it',
```

Run: `npx vitest run src/food/boundaries.node.test.ts`
Expected: PASS. `CategoryTrend.tsx` and `TrendsScreen.tsx` ask `numbersView()` themselves.

- [ ] **Step 8: V-J31 checks the trend.** In `scripts/e2e/acceptance/journeys/v31.mjs`, step 3's `t.pending('Food’s trend is out of Plan 7: …');` becomes:

```js
      // Food's trend (Plan 8, D114): 28 September in September's list, "Estimated", the corrected figure, "in logged foods".
      const kcal = lunch.items.reduce((sum, i) => sum + (i.kcal ?? 0), 0);
      const want = `Estimated ${(Math.round(kcal / 10) * 10).toLocaleString('en-IN')} kcal in logged foods`;
      await t.goto(`/trends/food?period=month&at=${DAY}`);
      await ui.heading(page, 'Food');
      const main = page.getByRole('main');
      await ui.tap(ui.button(main, 'Show as list'));
      const table = main.getByRole('table', { name: 'Food, September' });
      await table.waitFor();
      const row = (await table.getByRole('row').filter({ has: page.getByRole('rowheader', { name: 'Monday, 28 September' }) }).innerText()).replace(/\s+/g, ' ');
      await t.check(row.includes(want), `28 September in Food’s trend reads “${row}”, not “${want}”`);
      const text = (await main.innerText()).replace(/\s+/g, ' ');
      await t.check(/Shown as logged, with no comparison to another period\./.test(text) && !/Highest|Higher than|Lower than/.test(text), `Food’s trend compares or ranks: ${text.slice(0, 300)}`);
      await t.checkpoint('food-trend-september');
```

- [ ] **Step 9: Run V-J31 and the Trends journeys**

```bash
npm run e2e:acceptance -- --only=V-J31,V-J07,V-J26,V-J27,S01
```

Expected: PASS in all four projects, with no pending item. Task 1 made `--only` read every id form and stop on a selector that matches nothing, so this runs Plan 3's `VJ07`, `VJ26` and `VJ27` (Codex P8-20), not just V-J31.

- [ ] **Step 10: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/trends src/food/boundaries.node.test.ts scripts/e2e/acceptance/journeys/v31.mjs
git commit -m "feat: Show Food's trend with estimates, in logged foods and with no comparison"
```

---

### Task 10: Browse's food results (J§14, B-11)

**Files:**
- Create: `src/screens/browse/foods.ts`, `src/screens/browse/foods.test.ts`
- Modify: `src/screens/browse/browse.ts` (`BrowseRow` gains the food row), `BrowseList.tsx` (draws it), `BrowseScreen.tsx` (asks for it)
- Modify: `src/food/boundaries.node.test.ts` (`WORDS_ONLY`)
- Modify: `scripts/e2e/acceptance/journeys/v08.mjs` (two cases)

**Interfaces:**
- Consumes: `browse`, `BrowseRow`, `BrowseResults`, `BROWSE_GROUPS` (Plan 4); Plan 7's `searchFoods(query, foods, customs): { customs; foods }`, `foodRowDetail(food, view)`, `logHref({ food })`, `FOODS` (`src/food/data.ts`), `numbersView`, `logsMeals`.
- Produces: `FOOD_ROWS_MAX = 6`; `foodRows(query: string, foods: readonly Food[], view: NumbersView): Extract<BrowseRow, { kind: 'food' }>[]`; `withFoods(results: BrowseResults, rows: readonly BrowseRow[]): BrowseResults`; `BrowseRow` gains `{ kind: 'food'; id: string; title: string; detail: string; to: string }`.

Food rows show only when the person logs meals (`logsMeals`): a row opens "Log a meal", which "ideas only" doesn't have.

- [ ] **Step 1: Write the failing test** `src/screens/browse/foods.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { FOODS } from '@/food/data';
import type { BrowseResults } from './browse';
import { FOOD_ROWS_MAX, foodRows, withFoods } from './foods';

describe('Browse’s food rows (journey §14, D115)', () => {
  it('finds the roti for “chapatti”, opening “Log a meal” at its portion', () => {
    const [roti] = foodRows('chapatti', FOODS, { show: false });
    expect(roti).toMatchObject({ kind: 'food', id: 'roti', to: '/hub/food/log?food=roti' });
    expect(roti.detail).not.toMatch(/kcal|carbs|Estimated/);
    expect(foodRows('chapatti', FOODS, { show: true, ranges: false })[0].detail).toMatch(/· Estimated \d+ kcal$/);
  });

  it('lists at most 6, and none for nothing typed', () => {
    expect(foodRows('a', FOODS, { show: false }).length).toBeLessThanOrEqual(FOOD_ROWS_MAX);
    expect(foodRows('  ', FOODS, { show: false })).toEqual([]);
  });

  it('adds them under Eat, in Browse’s group order, and changes nothing without them', () => {
    const results: BrowseResults = { groups: [{ id: 'learn', title: 'Learn', rows: [{ kind: 'shortcut', id: 'today-log', title: 'Today’s log', to: '/day/today' }] }], partial: false };
    const rows = foodRows('chapatti', FOODS, { show: false });
    const merged = withFoods(results, rows);
    expect(merged.groups.map(g => g.id)).toEqual(['eat', 'learn']);
    expect(merged.groups[0].rows).toEqual(rows);
    expect(withFoods(results, [])).toBe(results);
  });
});
```

`BROWSE_GROUPS` is Move, Eat, Check, Learn, then Your data (`src/categories.ts`), so Eat comes before Learn.

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/screens/browse/foods.test.ts`
Expected: FAIL, "Cannot find module './foods'".

- [ ] **Step 3: The row.** In `src/screens/browse/browse.ts`, `BrowseRow` gains a fourth member:

```ts
  /** A food from the food table (D115), to log: Browse's food rows (`foods.ts`). */
  | { kind: 'food'; id: string; title: string; detail: string; to: string }
```

- [ ] **Step 4: Write** `src/screens/browse/foods.ts`

```ts
/**
 * Browse's food rows (journey §14, board D115): the food table's matches for
 * what is typed, at most 6, each opening "Log a meal" at that food's portion
 * page. A figure only with estimates on (B-11): the caller passes
 * `numbersView()`. Apart from browse.ts, so the food table loads with Browse,
 * never with the first screen.
 */
import { BROWSE_GROUPS } from '@/categories';
import { foodRowDetail } from '@/food/format';
import type { NumbersView } from '@/food/level';
import { logHref } from '@/food/links';
import { searchFoods } from '@/food/search';
import type { Food } from '@/food/types';
import type { BrowseResults, BrowseRow } from './browse';

export const FOOD_ROWS_MAX = 6;

export function foodRows(query: string, foods: readonly Food[], view: NumbersView): Extract<BrowseRow, { kind: 'food' }>[] {
  return searchFoods(query, foods, []).foods.slice(0, FOOD_ROWS_MAX).map(food => ({
    kind: 'food', id: food.id, title: food.name, detail: foodRowDetail(food, view), to: logHref({ food: food.id }),
  }));
}

const CONTENT: ReadonlySet<BrowseRow['kind']> = new Set(['meal', 'topic', 'card']);

/** The food rows under Eat, after its categories and meal ideas. A food with every word typed is an answer, so part-matches go, as beside a category. */
export function withFoods(results: BrowseResults, rows: readonly BrowseRow[]): BrowseResults {
  if (rows.length === 0) return results;
  const kept = results.partial ? results.groups.map(g => ({ ...g, rows: g.rows.filter(r => !CONTENT.has(r.kind)) })) : results.groups;
  const eatTitle = BROWSE_GROUPS.find(g => g.id === 'eat')!.title;
  const eat = kept.find(g => g.id === 'eat') ?? { id: 'eat' as const, title: eatTitle, rows: [] };
  const order = BROWSE_GROUPS.map(g => g.id);
  const groups = [...kept.filter(g => g.id !== 'eat'), { ...eat, rows: [...eat.rows, ...rows] }]
    .filter(g => g.rows.length > 0)
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return { groups, partial: false };
}
```

- [ ] **Step 5: Draw and ask for them.**
  - `src/screens/browse/BrowseList.tsx`, in `BrowseRows`, before the content row's `return`:

```tsx
            if (r.kind === 'food') return <Row key={`food-${r.id}`} as={Link} to={r.to} state={origin} viewTransition label={r.title} detail={r.detail} chevron />;
```

  - `src/screens/browse/BrowseScreen.tsx`: import `FOODS` from `@/food/data`, `logsMeals` and `numbersView` from `@/food/level`, `useStore` from `@/store/useStore`, and `foodRows`, `withFoods` from `./foods`. Replace `const results = useMemo(() => browse(query, ctx), [query, ctx]);` with:

```tsx
  const { profile } = useStore();
  // Foods to log only for someone who logs meals; a figure only with estimates (B-11, D115).
  const logs = logsMeals(profile?.food);
  const numbers = numbersView(profile);
  const show = numbers.show;
  const ranges = numbers.show && numbers.ranges;
  const results = useMemo(() => {
    const found = browse(query, ctx);
    return logs ? withFoods(found, foodRows(query, FOODS, show ? { show: true, ranges } : { show: false })) : found;
  }, [query, ctx, logs, show, ranges]);
```

  - `src/food/boundaries.node.test.ts`'s `WORDS_ONLY` gains `'src/screens/browse/foods.ts': 'BrowseScreen.tsx passes numbersView()',`.

Run: `npx vitest run src/screens/browse src/food`
Expected: PASS.

- [ ] **Step 6: V-J08's food row.** Append to `scripts/e2e/acceptance/journeys/v08.mjs`'s `cases`:

```js
  {
    name: 'chapatti lists the roti to log, with its estimate only when estimates are on',
    async run(t) {
      const page = await t.open({ seed: persona('P01', { patch: { profile: { food: { pattern: 'vegetarian', avoid: [], level: 'estimates', hardBefore: 'no' } } } }), route: '/home' });
      const main = page.getByRole('main');
      await t.step(1, 'Browse → “chapatti”: the roti under Eat, after the meal idea, with its estimate', async () => {
        await searchBrowse(t, 'chapatti');
        const names = (await ui.section(main, 'Eat').getByRole('link').allInnerTexts()).map(flat);
        const idea = names.findIndex(n => n.startsWith('Roti, dal and sabzi'));
        const food = names.findIndex(n => n.startsWith('Roti (whole-wheat)'));
        await t.must(food >= 0, `Eat lists no roti to log: ${JSON.stringify(names)}`);
        await t.check(idea >= 0 && idea < food, `the food is not after the meal idea: ${JSON.stringify(names)}`);
        await t.check(/Estimated \d+ kcal/.test(names[food]), `the roti row has no estimate: “${names[food]}”`);
        await t.checkpoint('browse-food-row');
      }, { input: 'chapatti' });
      await t.step(2, 'The row opens “Log a meal” at the roti’s portion', async () => {
        await ui.tap(ui.section(main, 'Eat').getByRole('link', { name: /^Roti \(whole-wheat\)/ }));
        await page.waitForFunction(() => location.hash.startsWith('#/hub/food/log'), null, { timeout: 10000 });
        const sheet = page.getByRole('dialog', { name: 'Log a meal' });
        await sheet.waitFor({ timeout: 10000 });
        await t.check(/Roti \(whole-wheat\)/.test(await sheet.innerText()), 'the sheet did not open at the roti');
        await t.checkpoint('browse-food-log');
      });
    },
  },
  {
    name: 'counts-free, the food row has no figure',
    async run(t) {
      const page = await t.open({ seed: persona('P01', { patch: { profile: { food: { pattern: 'vegetarian', avoid: [], level: 'meals' } } } }), route: '/home' });
      const main = page.getByRole('main');
      await t.step(1, 'Browse → “chapatti”: the roti with its portion, and no figure (B-11)', async () => {
        await searchBrowse(t, 'chapatti');
        const text = flat(await ui.section(main, 'Eat').innerText());
        await t.check(/Roti \(whole-wheat\)/.test(text), `Eat lists no roti: ${text}`);
        await t.check(!/kcal|carbs|Estimated/.test(text), `counts-free shows a figure: ${text}`);
        await t.checkpoint('browse-food-counts-free');
      }, { input: 'chapatti' });
    },
  },
```

The first case's P01 has no food level, so its Eat group stays as Plan 4 tested it.

Run: `npm run e2e:acceptance -- --only=V-J08`
Expected: PASS, five cases in all four projects.

- [ ] **Step 7: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/browse src/food/boundaries.node.test.ts scripts/e2e/acceptance/journeys/v08.mjs
git commit -m "feat: List the food table's matches in Browse, to log, with a figure only with estimates"
```

---

### Task 11: After week 12, nothing is invented (J§17.2 #42)

**Files:**
- Modify: `src/lib/utils.ts`, `src/lib/utils.test.ts` (`programmeDone`)
- Modify: `src/health/recommend.ts`, `src/health/recommend.test.ts` (`finished`; `HREF.next`)
- Modify: `src/screens/hub/movement.ts`, `src/screens/hub/movement.test.ts` (`done`; the `next` action), `src/screens/hub/WorkoutHub.tsx`, `src/screens/hub/hooks.ts`
- Modify: `src/screens/home/model.ts`, `src/screens/home/model.test.ts` (`normalLine`'s `done`), `src/screens/home/HomeScreen.tsx`
- Modify: `src/screens/move/plan.ts`, `src/screens/move/plan.test.ts` (`withRestart`), `src/screens/move/PlanScreen.tsx` (its "What next?" group)
- Modify: `src/pages/SessionPage.tsx` (a stale link to the guided session goes to the choice)
- Create: `src/pages/admission.ts`, `src/pages/admission.test.ts` (a guided session admitted once, when it opens)

**Interfaces:**
- Consumes: `TOTAL_WEEKS`, `parseDateString` (`utils.ts`); `programmeWeek(...).finished` (`src/screens/move/plan.ts`); `movementCard`, `actionTarget` (`movement.ts`); `withLeft` and the leave sheet (`PlanScreen.tsx`).
- Produces:
  - `programmeDone(startDate: string, today: string): boolean` (`utils.ts`): 84 days or more since the start;
  - `HREF.next = '/hub/workout/plan?next=1'`; a `plan` recommendation, "The 12 weeks are done", before the scheduled session;
  - `CardInput.done?: boolean`, `CardState` `'done'`, `HubActionKind` `'next'`, whose target is `{ via: 'go', to: HREF.next }`;
  - `normalLine(mode, { recommendation, enrolled, plan, done? })`;
  - `withRestart(today: string): (data: AppData) => AppData` (`plan.ts`);
  - `interface Admission { stretch; resume; saved; startDate; date }`, `admits(a): boolean` and `useAdmission(): boolean` (`src/pages/admission.ts`).

- [ ] **Step 1: Write the failing tests.** Append to `src/lib/utils.test.ts`, adding `programmeDone` to its import:

```ts
describe('programmeDone (J§17.2 #42, D116)', () => {
  it('is over once the 84 days have passed, not on week 12’s last day', () => {
    expect(programmeDone('2026-07-17', '2026-10-08')).toBe(false);
    expect(programmeDone('2026-07-17', '2026-10-09')).toBe(true);
  });

  it('is never over without a real start date', () => {
    expect(programmeDone('', '2027-01-01')).toBe(false);
    expect(programmeDone('someday', '2027-01-01')).toBe(false);
  });
});
```

Append to `src/health/recommend.test.ts`:

```ts
describe('6b. after the twelve weeks (J§17.2 #42, D116)', () => {
  const july = settings({ startDate: '2026-07-17' });

  it('plans week 12’s session on its last day', () => {
    expect(recommend(input({ settings: july, permissions: every(allowed), checkIns: [checkIn()] })).kind).toBe('scheduled');
  });

  it('then plans nothing, says so, and leaves the choice to the person', () => {
    const day = '2026-10-09';
    const r = recommend(input({ now: at(day, '09:00'), settings: july, plan: plan({ date: day }), permissions: every(allowed), checkIns: [checkIn({}, day)] }));
    expect(r).toEqual({
      kind: 'plan',
      title: 'The 12 weeks are done',
      detail: 'Stretch and Walk carry on as before.',
      reason: 'Your 12-week programme has ended, so no new session is planned.',
      action: { label: 'Choose what’s next', to: HREF.next },
    });
  });

  it('on a rest day too, never “A rest day in your plan”', () => {
    const day = '2026-10-10';
    expect(recommend(input({ now: at(day, '09:00'), settings: july, plan: restDay(), permissions: every(allowed) })).title).toBe('The 12 weeks are done');
  });

  it('still gives way to safety', () => {
    const day = '2026-10-09';
    const permissions = { ...every(allowed), walk: held('walk', { disposition: 'emergency', reasons: ['You reported chest pain.'], release: undefined }) };
    expect(recommend(input({ now: at(day, '09:00'), settings: july, permissions })).kind).toBe('emergency');
  });
});
```

Append to `src/screens/hub/movement.test.ts`, adding `actionTarget` to its import if missing:

```ts
describe('the Workout card after the twelve weeks (D116)', () => {
  it('offers the choice, and no session', () => {
    const c = movementCard(input({ mode: 'guided', permission: { ...ok, mode: 'guided' }, enrolled: true, done: true }));
    expect(c).toMatchObject({ state: 'done', title: 'The 12 weeks are done', primary: { kind: 'next', label: 'Choose what’s next' } });
    expect(actionTarget('next', { mode: 'guided', href: '/session', startLabel: 'Start session' })).toEqual({ via: 'go', to: '/hub/workout/plan?next=1' });
  });
});
```

Append to `src/screens/home/model.test.ts`'s `describe('normalLine', …)`:

```ts
  it('says the twelve weeks are done on the Workout tile, never a week-12 session (D116)', () => {
    expect(normalLine('guided', { recommendation: suggests({ mode: 'stretch' }), enrolled: true, plan, done: true })).toBe('The 12 weeks are done');
    expect(normalLine('stretch', { recommendation: suggests({ mode: 'stretch' }), enrolled: true, plan, done: true })).toBe('A morning stretch');
  });
```

Append to `src/screens/move/plan.test.ts`, adding `withRestart` to its import:

```ts
describe('Start the 12 weeks again (D116)', () => {
  it('starts week 1 today, and changes nothing recorded', () => {
    const before = { settings: { startDate: '2026-07-17', focus: 'strength' }, sessions: [{ id: 's1' }] } as unknown as AppData;
    const after = withRestart('2026-10-09')(before);
    expect(after.settings.startDate).toBe('2026-10-09');
    expect(after.settings.focus).toBe('strength');
    expect(after.sessions).toBe(before.sessions);
  });
});
```


And write `src/pages/admission.test.ts`:

```ts
/**
 * Whether a guided session opens after the twelve weeks (D116, Codex P8-19):
 * decided once, when the page opens; only a run saved part-way and still
 * resumable is exempt, and a run admitted before midnight stays admitted.
 */
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { render } from '@/test/host';

const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null, setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k), clear: () => local.clear(), key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;

const page = vi.hoisted(() => ({ date: '2026-10-08', search: '' }));
vi.mock('@/hooks/useGuided', () => ({ useGuided: () => ({ data: { settings: { startDate: '2026-07-17' } }, date: page.date }) }));
vi.mock('react-router-dom', () => ({ useSearchParams: () => [new URLSearchParams(page.search)] }));

const { admits, useAdmission } = await import('./admission');
const { RESUME_WINDOW_MS, loadProgress, saveProgress } = await import('@/session/persistence');

const JULY = '2026-07-17';
const AFTER = '2026-10-09';
const saved = (date: string) => ({ plan: { date } }) as never;

describe('a guided session after the twelve weeks (J§17.2 #42, D116, P8-19)', () => {
  it('opens a stretch, always', () => {
    expect(admits({ stretch: true, resume: false, saved: null, startDate: JULY, date: AFTER })).toBe(true);
  });

  it('opens nothing new: `?resume=1` with nothing saved opens the choice', () => {
    expect(admits({ stretch: false, resume: true, saved: null, startDate: JULY, date: AFTER })).toBe(false);
    expect(admits({ stretch: false, resume: false, saved: null, startDate: JULY, date: AFTER })).toBe(false);
  });

  it('treats progress past its window as none, as `loadProgress` does', () => {
    local.clear();
    saveProgress({ id: 'p', kind: 'full', date: '2026-10-08', steps: [] } as never, { status: 'paused' } as never, 0, Date.now() - RESUME_WINDOW_MS - 60_000);
    expect(loadProgress(Date.now(), 'guided')).toBeNull();
    expect(admits({ stretch: false, resume: true, saved: loadProgress(Date.now(), 'guided'), startDate: JULY, date: AFTER })).toBe(false);
  });

  it('opens a run saved part-way, when asked to resume it, or when it is today’s', () => {
    expect(admits({ stretch: false, resume: true, saved: saved('2026-10-08'), startDate: JULY, date: AFTER })).toBe(true);
    expect(admits({ stretch: false, resume: false, saved: saved(AFTER), startDate: JULY, date: AFTER })).toBe(true);
    expect(admits({ stretch: false, resume: false, saved: saved('2026-10-08'), startDate: JULY, date: AFTER })).toBe(false);
  });

  it('keeps a run opened on week 12’s last day open past midnight', async () => {
    function Probe() {
      return createElement('p', null, useAdmission() ? 'admitted' : 'choice');
    }
    page.date = '2026-10-08';
    const h = render(createElement(Probe));
    await h.settle();
    expect(h.text()).toBe('admitted');
    page.date = AFTER;
    h.update(createElement(Probe));
    await h.settle();
    expect(h.text()).toBe('admitted');
    h.unmount();
    expect(render(createElement(Probe)).text()).toBe('choice');
  });
});
```

- [ ] **Step 2: Run them to check they fail**

Run: `npx vitest run src/lib/utils.test.ts src/health/recommend.test.ts src/screens/hub/movement.test.ts src/screens/home/model.test.ts src/screens/move/plan.test.ts src/pages/admission.test.ts`
Expected: FAIL: `programmeDone`, `HREF.next`, `done`, `withRestart` and `./admission` don't exist, and day 84 still plans week 12.

- [ ] **Step 3: The rule.** In `src/lib/utils.ts`, after `getWeekNumber`:

```ts
/**
 * Whether the 12-week programme is over on `today` (J§17.2 #42, board D116):
 * its 84 days from the start date have passed. Week 12's own days are still
 * the programme. Rounded, so a day of 23 or 25 hours counts as one.
 */
export function programmeDone(startDate: string, today: string): boolean {
  if (!startDate) return false;
  const start = parseDateString(startDate).getTime();
  const now = parseDateString(today).getTime();
  if (Number.isNaN(start) || Number.isNaN(now)) return false;
  return Math.round((now - start) / 86_400_000) >= TOTAL_WEEKS * 7;
}
```

- [ ] **Step 4: Today's recommendation.** In `src/health/recommend.ts`:
  - import `programmeDone` from `@/lib/utils`;
  - `HREF` gains `/** After the twelve weeks: Your plan's two choices (D116). */ next: '/hub/workout/plan?next=1',`;
  - point 8 of the header list gains "Once the twelve weeks are over, nothing is planned: the choice of what next is the person's.";
  - the chain becomes `… ?? habit(ctx) ?? finished(ctx) ?? scheduled(ctx) ?? gentle(ctx) ?? fallback(ctx);`;
  - before `scheduled`:

```ts
/**
 * Priority 8, once the twelve weeks are over (J§17.2 #42, board D116): no
 * session is planned, and nothing is invented after week 12. What comes next
 * is the person's choice. Stretch and Walk carry on as before.
 */
function finished(ctx: Context): Recommendation | undefined {
  if (!ctx.enrolled || !programmeDone(ctx.input.settings.startDate, ctx.today)) return undefined;
  return {
    kind: 'plan',
    title: 'The 12 weeks are done',
    detail: 'Stretch and Walk carry on as before.',
    reason: 'Your 12-week programme has ended, so no new session is planned.',
    action: { label: 'Choose what’s next', to: HREF.next },
  };
}
```

- [ ] **Step 5: The Workout tile, its hub and the session's address.**
  - `src/screens/home/model.ts`: `normalLine`'s options gain `/** The twelve weeks are over (D116). */ done?: boolean`, destructured as `done = false`, and its first line is `if (mode === 'guided' && enrolled && done) return 'The 12 weeks are done';`.
  - `src/screens/home/HomeScreen.tsx` and `src/screens/hub/hooks.ts`: import `programmeDone` from `@/lib/utils`; the `normalLine(mode, { … })` call adds `done: programmeDone(settings.startDate, today)` (`state.settings.startDate` in `hooks.ts`).
  - `src/screens/hub/movement.ts`: `HubActionKind` gains `'next'`; `CardState` gains `'done'`; `CardInput` gains `/** Workout: the twelve weeks are over (D116). */ done?: boolean;`; `actionTarget` gains `case 'next': return { via: 'go', to: HREF.next };`; and in `movementCard`, after the `if (i.saved) { … }` block:

```ts
  if (i.mode === 'guided' && i.done) {
    // After the twelve weeks nothing is planned or started here; the choice is the person's (D116).
    return {
      ...empty, state: 'done', tone: 'normal', title: 'The 12 weeks are done', detail: 'Stretch and Walk carry on as before.',
      primary: { kind: 'next', label: 'Choose what’s next' }, secondary: instead,
    };
  }
```

  - `src/screens/hub/WorkoutHub.tsx`: move `const week = programmeWeek(state.settings.startDate, today);` above `const card = movementCard({`, add `done: enrolled && week.finished,` to the card's input, and `planDetail` becomes `!enrolled ? 'Not joined yet' : week.startsOn ? 'Starts soon' : week.finished ? 'The 12 weeks are done' : \`Week ${week.week} of 12\``.
  - write `src/pages/admission.ts`:

```ts
/**
 * Whether a guided session may open (J§17.2 #42, board D116), decided once,
 * when the session page opens (Codex P8-19). A stretch always may. After the
 * twelve weeks, a guided run opens only as progress saved part-way that
 * `loadProgress` still finds resumable, asked for by `?resume=1` or saved
 * today; `?resume=1` alone admits nothing. A run admitted before midnight
 * stays admitted: the question isn't asked again while the page is up.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseStretchSpec } from '@/engine/stretch';
import { useGuided } from '@/hooks/useGuided';
import { programmeDone } from '@/lib/utils';
import { loadProgress, type SavedProgress } from '@/session/persistence';

export interface Admission {
  stretch: boolean;
  /** `?resume=1`. */
  resume: boolean;
  /** Guided progress, as `loadProgress` reads it: real, unfinished and within its window, or nothing. */
  saved: Pick<SavedProgress, 'plan'> | null;
  startDate: string;
  date: string;
}

export function admits(a: Admission): boolean {
  if (a.stretch) return true;
  const resumes = a.saved !== null && (a.resume || a.saved.plan.date === a.date);
  return resumes || !programmeDone(a.startDate, a.date);
}

/** Asked once, when the session page opens. */
export function useAdmission(): boolean {
  const { data, date } = useGuided();
  const [params] = useSearchParams();
  const [admitted] = useState(() => admits({
    stretch: parseStretchSpec(params) !== null,
    resume: params.get('resume') === '1',
    saved: loadProgress(Date.now(), 'guided'),
    startDate: data.settings.startDate,
    date,
  }));
  return admitted;
}
```

  - `src/pages/SessionPage.tsx`: rename `export default function SessionPage()` to `function SessionRun()`, import `Navigate` from `react-router-dom`, `HREF` from `@/health/recommend` and `useAdmission` from `./admission`, and add above it:

```tsx
/**
 * After the twelve weeks no guided session is planned (D116): a stale link or
 * bookmark to one opens Your plan's choice instead. Decided once, when the
 * page opens: a stretch, and a run saved part-way and still resumable, open
 * as before, and a run under way at midnight stays (P8-19).
 */
export default function SessionPage() {
  return useAdmission() ? <SessionRun /> : <Navigate to={HREF.next} replace />;
}
```


- [ ] **Step 6: "What next?" in Your plan.** The button that leads here is a verb, "Choose what’s next" (J§20.4 rule 4, Kiro K8-05); the group it opens keeps the question as its header. In `src/screens/move/plan.ts`:

```ts
/** "Start the 12 weeks again" (D116): week 1 from today, on the same training days. Nothing recorded changes. */
export const withRestart = (today: string) => (data: AppData): AppData => ({ ...data, settings: { ...data.settings, startDate: today } });
```

In `src/screens/move/PlanScreen.tsx`:
  - import `withRestart`; in `PlanScreen`, read `?next=1` on arrival as `join` is read: `const [nextAsked] = useState(() => params.get('next') === '1');`. The existing effect takes both out of the address: its guard becomes `if (!params.has('join') && !params.has('next')) return;`, and inside it `next.delete('join');` is followed by `next.delete('next');`. Pass `focusOnArrival={switched || nextAsked}` to `MemberPlan`;
  - in `MemberPlan`, add `const [restartOpen, setRestartOpen] = useState(false);` and:

```tsx
  const restart = async () => {
    if (saving) return;
    setSaving(true);
    setProblem(null);
    const result = await update(withRestart(date));
    setSaving(false);
    if (result.ok) setRestartOpen(false);
    else setProblem(result.failure.message);
  };
```

  - the standing line reads `{week.startsOn ? \`Starts ${longDate(week.startsOn)}\` : week.finished ? 'The 12 weeks are done' : \`Week ${week.week} of 12\`}`, and the `{week.finished && (<p …>The 12 weeks are done. The plan stays on its final week.</p>)}` paragraph goes;
  - after the standing `section`, add:

```tsx
      {week.finished && (
        <Group header="What next?" footer="Your sessions and history stay either way. Stretch and Walk carry on as before.">
          {/* The region's two main targets (D122, K8-04): marked, so the target sweep holds them to 60 px. */}
          <Row data-main="" className="min-h-[3.75rem]" onClick={() => { setProblem(null); setRestartOpen(true); }} label={<span className="whitespace-normal text-tint">Start the 12 weeks again</span>} detail="Week 1 from today, on the same training days" />
          <Row data-main="" className="min-h-[3.75rem]" onClick={() => { setProblem(null); setLeaveOpen(true); }} label={<span className="whitespace-normal text-stop">Leave the programme</span>} />
        </Group>
      )}
```

  - the "This week" group, the swap row and the bottom "Leave the programme" group render only when `!week.finished`: nothing is planned to show;
  - beside the leave sheet:

```tsx
      <Sheet open={restartOpen} dismissible={!saving} onOpenChange={open => { if (!saving) setRestartOpen(open); }} title="Start the 12 weeks again?">
        <p className="px-4 text-[length:var(--text-body)] leading-snug">
          Week 1 starts today, on your training days, at the gentlest phase. Every session and check-in so far stays on this device.
        </p>
        <PrimaryButton disabled={saving} onClick={() => { void restart(); }}>Start the 12 weeks again</PrimaryButton>
        {problem && <p role="alert" className="px-4 text-[length:var(--text-subhead)] text-stop">That did not save. {problem}</p>}
      </Sheet>
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run src/lib src/health src/screens/hub src/screens/home src/screens/move src/pages`
Expected: PASS.

- [ ] **Step 8: Check by eye.** `npm run dev`. Print P01 with its start 83 days before today, `node -e "import('./scripts/e2e/acceptance/fixtures/personas.mjs').then(m => console.log(JSON.stringify(m.persona('P01', { patch: { settings: { startDate: new Date(Date.now() - 83 * 864e5).toISOString().slice(0, 10) } } }))))"`, and in a fresh browser profile on the app's address run `localStorage.setItem('fit-strong-90-data', '<the blob>')` in the console, then reload. At 428×926 and 320×568:
  - the Workout hub reads "Week 12 of 12" and offers its session;
  - seeded again with the start 84 days before today: Home's Right now says "The 12 weeks are done" with "Choose what’s next"; the Workout tile and hub say the same, with no Start; Stretch and Walk still offer theirs; `#/session` opens Your plan;
  - "Choose what’s next" opens Your plan with "The 12 weeks are done" focused, and its two choices under "What next?"; "Start the 12 weeks again" → its sheet → "Week 1 of 12".

- [ ] **Step 9: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/lib src/health src/screens/hub src/screens/home src/screens/move src/pages/SessionPage.tsx src/pages/admission.ts src/pages/admission.test.ts
git commit -m "feat: End the programme after week 12, with what's next chosen explicitly and nothing invented"
```

---

### Task 12: The acceptance harness for recovery: 428×926, the clock and zone, earphones, a driven worker, two real releases, draw counts and a strict run

**Files:**
- Modify: `scripts/e2e/acceptance/lib/env.mjs` (428×926)
- Modify: `scripts/e2e/acceptance/run.mjs` (the warm-up's size; release cases, one at a time; `--strict`)
- Modify: `scripts/e2e/acceptance/lib/harness.mjs` (`open({ media, updates, draws, zoneByCdp })`, `jumpClock`, `setTimezone`)
- Modify: `scripts/e2e/acceptance/lib/inpage.mjs` (`mediaInit`, `updateInit`, `drawInit`, `lastAudio`)
- Create: `scripts/e2e/acceptance/lib/recovery.mjs`, `scripts/e2e/acceptance/lib/releases.mjs`, `scripts/e2e/acceptance/lib/budget.mjs`
- Modify: `docs/reimagine/codex-acceptance.md` (the projects' sizes; the strict release run)

**Interfaces:**
- Consumes: Plan 6's `play()` wrapper in `sensorInit`; `visibilityInit`'s `__acc.setVisibility`; the `Case` class; `BASE_PATH`, `REPO` (`env.mjs`); `VITE_ACCEPTANCE_SUCCESSOR` (Task 3, D121).
- Produces:
  - `PROJECTS`: `large-light` and `large-dark` at 428×926 (D105);
  - `t.open({ media: true })`: `window.__acc.media[action]` holds each media session handler the app sets;
  - `t.open({ updates: true })`: `navigator.serviceWorker` is a fake the test drives, speaking Task 2's two questions: `__acc.sw.offerUpdate()` installs a new release, which waits; `__acc.sw.windows` is how many windows of FitStrong its worker counts (1 unless a case sets it); `restart` from a lone window makes it take over and fires `controllerchange`; `__acc.sw.messages` holds every question the page asked; `__acc.sw.loads` is this page's load count, kept with the release it runs under `sessionStorage['__acceptance:sw']`;
  - `t.open({ draws: true })`: `window.__acc.draws`, the number of WebGL draw calls the page has made;
  - `t.open({ zoneByCdp: 'Asia/Kolkata' })` and `t.setTimezone(zone)`; `t.jumpClock(ms)`, forwards or back: `Date` jumps, timers and `performance.now()` don't;
  - `window.__acc.lastAudio`: the last element `play()` was called on;
  - `lib/recovery.mjs`: `toast(page, text)`, `toasts(page)`, `undoIn(page, text)`, `openRecentlyDeleted(t)`, `media(page, action)`, `captureMedia(page, action)`, `pressCaptured(page)`, `offerUpdate(page)`, `setWindows(page, n)`, `setRestartDelay(page, ms)`, `swMessages(page)`, `loads(page)`, `updateLine(page)`, `newerTab(t, version, { abort })`, `dragSheetDown(page, sheet)`;
  - `lib/releases.mjs`: `releaseServer(port, logDir)` → `{ url, use(name), broken(from, name), build(name), cache(name), entry(name), close() }`, serving release `A` (this build, number 100) and `B` (its successor, D121, number 200) at one origin, and a copy whose install fails; a case with `releases: true` gets it as `run(t, { releases })`, on the server's origin, and opens with `contextOptions: { serviceWorkers: 'allow' }` (P8-21). Beside it, what a page knows of its real worker: `controlled(page)`, `installNext(page): Promise<'installed' | 'redundant'>`, `checkForUpdate(page)`, `hasWaiting(page)`, `cacheNames(page)`, `buildOf(page)` (Task 2's `data-build`), `mark(page)` and `sameDocument(page)`, and `until(page, fn, what, ms)`;
  - `lib/budget.mjs`: `busiestSecond(times, windowMs?)` and `withinRedrawBudget(times): boolean` (D117, P8R-15): the most redraws timed within any 950 ms, held to one;
  - `npm run e2e:acceptance -- --strict`: exits 1 on any pending case, and on any journey's case that hasn't passed in each of its projects, all four unless the case names its own (D121, P8-27).

- [ ] **Step 1: The reference size (D105).** In `scripts/e2e/acceptance/lib/env.mjs`, both large projects become `width: 428, height: 926`. In `run.mjs`, `warm`'s context is `{ viewport: { width: 428, height: 926 } }`. In `docs/reimagine/codex-acceptance.md`, the projects table reads `428 × 926` for Large light and Large dark, and the horizontal layout check reads "at 320 and 428".

- [ ] **Step 2: The page's shims.** In `scripts/e2e/acceptance/lib/inpage.mjs`:
  - in `sensorInit`'s `play()` wrapper (Plan 6's), add `acc.lastAudio = this;` before `return play.apply(this, args);`;
  - add:

```js
/** Earphone and lock-screen buttons (V-J21): every media session handler the app sets, for the test to press. */
export function mediaInit() {
  const acc = (window.__acc = window.__acc || {});
  if (acc.mediaInstalled || !navigator.mediaSession) return;
  acc.mediaInstalled = true;
  acc.media = {};
  const set = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
  navigator.mediaSession.setActionHandler = (action, handler) => {
    if (handler) acc.media[action] = handler;
    else delete acc.media[action];
    return set(action, handler);
  };
}

/**
 * A service worker the test drives (V-J38's quick cases), speaking Task 2's
 * two questions on the port each is sent with: `windows` (this release, and
 * how many windows of FitStrong are open: `__acc.sw.windows`, 1 unless a case
 * sets it) and `restart` (take over, only while that count is 1, counted as it
 * answers, after `__acc.sw.restartDelayMs` when a case slows it). `offerUpdate()`
 * installs a new release, which waits; a restart makes it take over and fires
 * `controllerchange`, as a real one does, and the release it brings is kept
 * for the reload that follows. Each load is counted under the test's own
 * key. Two real releases are `lib/releases.mjs`'s.
 */
export function updateInit() {
  if (!location.pathname.startsWith('/fit-strong-90')) return;
  const acc = (window.__acc = window.__acc || {});
  const KEY = '__acceptance:sw';
  let saved = { loads: 0, build: 'release-a' };
  try { saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') ?? saved; } catch { /* the first load */ }
  saved.loads += 1;
  const keep = () => { try { sessionStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* no storage: this load only */ } };
  keep();
  const messages = [];
  const container = new EventTarget();
  const registration = new EventTarget();
  let waiting = null;
  const worker = build => {
    const w = new EventTarget();
    w.state = 'activated';
    w.postMessage = (data, transfer = []) => {
      messages.push(data?.type);
      const answer = () => {
        const restarting = data?.type === 'restart' && w === waiting && acc.sw.windows === 1;
        transfer[0]?.postMessage({ build, windows: acc.sw.windows, restarting });
        if (!restarting) return;
        setTimeout(() => {
          waiting = null;
          saved.build = build;
          keep();
          container.controller = w;
          container.dispatchEvent(new Event('controllerchange'));
        }, 0);
      };
      // A slow worker (P8S-13): the restart answered only after the delay a case sets.
      if (data?.type === 'restart' && acc.sw.restartDelayMs > 0) setTimeout(answer, acc.sw.restartDelayMs);
      else answer();
    };
    return w;
  };
  registration.installing = null;
  Object.defineProperty(registration, 'waiting', { get: () => waiting });
  container.controller = worker(saved.build);
  container.register = () => Promise.resolve(registration);
  container.getRegistration = () => Promise.resolve(registration);
  container.ready = Promise.resolve(registration);
  try { Object.defineProperty(navigator, 'serviceWorker', { configurable: true, get: () => container }); } catch { /* keep the real one */ }
  acc.sw = {
    loads: saved.loads,
    messages,
    windows: 1,
    restartDelayMs: 0,
    offerUpdate() {
      const next = worker(`${saved.build}-next`);
      next.state = 'installing';
      registration.installing = next;
      registration.dispatchEvent(new Event('updatefound'));
      registration.installing = null;
      waiting = next;
      next.state = 'installed';
      next.dispatchEvent(new Event('statechange'));
    },
  };
}

/**
 * The 3D demo's own drawing (PERF01, D117): every WebGL draw call the page
 * makes, counted. Only the demo draws with WebGL in this app, so this counts
 * what it renders, whatever drives its loop.
 */
export function drawInit() {
  const acc = (window.__acc = window.__acc || {});
  if (acc.drawsInstalled) return;
  acc.drawsInstalled = true;
  acc.draws = 0;
  for (const proto of [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype]) {
    if (!proto) continue;
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) {
      const draw = proto[name];
      if (typeof draw !== 'function') continue;
      proto[name] = function counted(...args) {
        acc.draws += 1;
        return draw.apply(this, args);
      };
    }
  }
}
```

- [ ] **Step 3: The harness.** In `scripts/e2e/acceptance/lib/harness.mjs`, import `drawInit`, `mediaInit` and `updateInit` from `./inpage.mjs`, and:
  - `open`'s options gain `media = false, updates = false, draws = false, zoneByCdp`; the context's `timezoneId` line becomes

```js
      // A case that changes the zone mid-way sets it through its own CDP session (`setTimezone`):
      // Chromium takes one zone override per page, and Playwright's own would be the one in force.
      ...(zoneByCdp ? {} : { timezoneId: contextOptions.timezoneId ?? 'Asia/Kolkata' }),
```

  - after `if (capabilities) …`: `if (media) await this.context.addInitScript(mediaInit);`, `if (updates) await this.context.addInitScript(updateInit);` and `if (draws) await this.context.addInitScript(drawInit);`;
  - between `this.page = await this.newPage();` and `this.page.goto(…)`:

```js
    if (zoneByCdp) {
      this.cdp = await this.context.newCDPSession(this.page);
      await this.cdp.send('Emulation.setTimezoneOverride', { timezoneId: zoneByCdp });
    }
```

  - after `setTime`:

```js
  /** The phone's clock set by hand, forwards or back (B-19, V-J41): `Date` jumps; timers and `performance.now()` keep their own time. */
  async jumpClock(ms) {
    this.time += ms;
    await this.context.clock.setFixedTime(this.time);
    // A second and a half of real time, so the walk's ticks see the jump.
    await this.page.waitForTimeout(1500);
  }

  /** The phone moves to another time zone (V-J41). Only for a case opened with `zoneByCdp`. */
  async setTimezone(zone) {
    if (!this.cdp) throw new Error('open the case with zoneByCdp to change its time zone');
    await this.cdp.send('Emulation.setTimezoneOverride', { timezoneId: zone });
    await this.page.waitForTimeout(300);
  }
```

- [ ] **Step 4: Write** `scripts/e2e/acceptance/lib/recovery.mjs` and `scripts/e2e/acceptance/lib/budget.mjs`

```js
/**
 * Plan 8's recovery journeys' helpers (journey §17.2): toasts and their Undo,
 * Recently deleted, the earphone buttons, a driven worker, a second tab
 * running a newer build, and a sheet closed by a swipe.
 */
import * as ui from './ui.mjs';

/** A toast on screen holding this text. */
export const toast = (page, text) => page.locator('#toasts [data-sonner-toast]').filter({ hasText: text });

/** Every toast's words. */
export const toasts = async page => (await page.locator('#toasts [data-sonner-toast]').allInnerTexts()).map(s => s.replace(/\s+/g, ' ').trim());

/** Undo, on the toast holding this text. */
export async function undoIn(page, text) {
  await ui.tap(toast(page, text).getByRole('button', { name: 'Undo', exact: true }));
}

/** Today's log → Recently deleted; its sheet. */
export async function openRecentlyDeleted(t) {
  await ui.tap(ui.row(t.page.getByRole('main'), 'Recently deleted'));
  const sheet = t.page.getByRole('dialog', { name: 'Recently deleted' });
  await sheet.waitFor();
  return sheet;
}

/** Press an earphone or lock-screen button; false when the app handles none for it. */
export const media = (page, action) => page.evaluate(a => {
  const handler = window.__acc.media?.[a];
  if (!handler) return false;
  handler({ action: a });
  return true;
}, action);

/** Keep the handler the app has set now, to press after the app has let it go (V-J21). False when there is none. */
export const captureMedia = (page, action) => page.evaluate(a => {
  window.__acc.captured = window.__acc.media?.[a];
  return typeof window.__acc.captured === 'function';
}, action);

/** Press the kept handler, as a stray earphone press would. */
export const pressCaptured = page => page.evaluate(() => window.__acc.captured?.({ action: 'play' }));

export const offerUpdate = page => page.evaluate(() => window.__acc.sw.offerUpdate());
/** How many windows of FitStrong the driven worker counts from now on. */
export const setWindows = (page, n) => page.evaluate(count => { window.__acc.sw.windows = count; }, n);
/** How long the driven worker takes to answer a restart from now on (P8S-13). */
export const setRestartDelay = (page, ms) => page.evaluate(delay => { window.__acc.sw.restartDelayMs = delay; }, ms);
export const swMessages = page => page.evaluate(() => [...window.__acc.sw.messages]);
export const loads = page => page.evaluate(() => window.__acc.sw.loads);

/** Home's update line (Task 2's `UpdateRow`): its words, and its button's, or nothing. */
export async function updateLine(page) {
  const main = page.getByRole('main');
  const line = main.getByRole('status').filter({ hasText: /An update is ready|Updated\. FitStrong/ });
  if (!(await line.count())) return undefined;
  // Only the update line has these on Home.
  const button = main.getByRole('button', { name: /^(Restart to update|Dismiss)$/ });
  return { text: (await line.first().innerText()).replace(/\s+/g, ' ').trim(), button: (await button.count()) ? (await button.first().innerText()).trim() : undefined };
}

/**
 * A second tab running a newer build (B-21): it opens the app's database at
 * `version`. With `abort`, it gives the upgrade up as it begins, so the
 * database stays at this build's version for the reload that follows: an
 * interrupted upgrade. `seen()` is what it met, in order: `blocked`,
 * `upgrade`, `aborted` or `opened`.
 *
 * While it waits, no other open of the database can finish, `t.db()` and
 * `t.checkpoint()` (and so `t.step`'s own snapshot) included. Call none of
 * them until `seen()` has gone past `blocked`.
 */
export async function newerTab(t, version, { abort = true } = {}) {
  const tab = await t.newPage();
  await tab.goto(`${t.base}manifest.webmanifest`);
  await tab.evaluate(([v, giveUp]) => {
    window.__newer = [];
    const open = window.__acc?.orig?.open ?? IDBFactory.prototype.open;
    const req = open.call(indexedDB, 'fit-strong', v);
    req.onblocked = () => window.__newer.push('blocked');
    req.onupgradeneeded = () => {
      window.__newer.push('upgrade');
      if (giveUp) req.transaction.abort();
    };
    req.onsuccess = () => {
      window.__newer.push('opened');
      req.result.close();
    };
    req.onerror = e => {
      e.preventDefault();
      window.__newer.push(req.error?.name === 'AbortError' ? 'aborted' : `error:${req.error?.name}`);
    };
  }, [version, abort]);
  return { page: tab, seen: () => tab.evaluate(() => [...window.__newer]) };
}

/** Close a sheet the way a finger does: a swipe down from its title bar (Sheet.tsx's `useSwipeToDismiss`). */
export async function dragSheetDown(page, sheet) {
  const box = await sheet.getByRole('heading').first().boundingBox();
  if (!box) throw new Error('the sheet has no title to drag');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 420, { steps: 12 });
  await page.mouse.up();
}
```

```js
/**
 * The live route's budget, as one check the journey proves first that it can
 * fail (PERF01, board D117, Codex P8-25, P8R-15): the most redraws timed
 * within any 950 ms, so a burst can't hide inside an average over a longer
 * time. The window is a little under a second for the throttle's own timer.
 */
export const busiestSecond = (times, windowMs = 950) => times.reduce((most, t0) => Math.max(most, times.filter(t => t >= t0 && t < t0 + windowMs).length), 0);
export const withinRedrawBudget = times => busiestSecond(times) <= 1;
```

- [ ] **Step 5: Two real releases at one origin (D121, P8-21).** Write `scripts/e2e/acceptance/lib/releases.mjs`:

```js
/**
 * Two real releases of the app at one origin, with their service workers
 * (B-21, board D121, Codex P8-21): `A`, this build, numbered 100, and `B`,
 * its successor, numbered 200, built with `VITE_ACCEPTANCE_SUCCESSOR=1`
 * (database and schema one higher, an empty migration). The server serves
 * one at a time, switched with `use`, as a deploy switches a site; `broken`
 * makes a later release whose worker names a file the server hasn't got, so
 * its install fails. Built in temp directories outside the repository, as the
 * preview build is.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { BASE_PATH, REPO } from './env.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.bin': 'application/octet-stream',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.woff2': 'font/woff2',
};

function build(name, env, logDir) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), `fit-acceptance-release-${name}-`));
  return new Promise((resolve, reject) => {
    const b = spawn('npx', ['vite', 'build', '--outDir', outDir, '--emptyOutDir'], { cwd: REPO, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    const log = fs.createWriteStream(path.join(logDir, `release-${name}.log`));
    b.stdout.pipe(log);
    b.stderr.pipe(log);
    b.on('exit', code => (code === 0 ? resolve(outDir) : reject(new Error(`release ${name} did not build (${code}); see ${path.join(logDir, `release-${name}.log`)}`))));
  });
}

export async function releaseServer(port, logDir = os.tmpdir()) {
  const dirs = {
    A: await build('A', { FITSTRONG_RELEASE_NUMBER: '100' }, logDir),
    B: await build('B', { VITE_ACCEPTANCE_SUCCESSOR: '1', FITSTRONG_RELEASE_NUMBER: '200' }, logDir),
  };
  const sw = name => fs.readFileSync(path.join(dirs[name], 'sw.js'), 'utf8');
  let current = 'A';
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    if (!url.pathname.startsWith(BASE_PATH)) { res.writeHead(404); res.end(); return; }
    const root = dirs[current];
    const file = path.join(root, decodeURIComponent(url.pathname.slice(BASE_PATH.length)) || 'index.html');
    const target = fs.existsSync(file) && fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
    if (!target.startsWith(root) || !fs.existsSync(target)) { res.writeHead(404); res.end('missing'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(target)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    fs.createReadStream(target).pipe(res);
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${port}${BASE_PATH}`,
    /** Serve this release from now on, as a deploy does. */
    use(name) {
      if (!dirs[name]) throw new Error(`no release ${name}`);
      current = name;
    },
    /**
     * A later copy of `from` (its number 50 more) whose worker is new and
     * names a file this server hasn't got: its install must fail. Made once.
     */
    broken(from, name) {
      if (dirs[name]) return;
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), `fit-acceptance-release-${name}-`));
      fs.cpSync(dirs[from], dir, { recursive: true });
      const file = path.join(dir, 'sw.js');
      const src = fs.readFileSync(file, 'utf8')
        .replace(/const BUILD = "([0-9a-f]+)"/, (_, b) => `const BUILD = "${b}broken"`)
        .replace(/const NUMBER = Number\("(\d+)"\)/, (_, n) => `const NUMBER = Number("${Number(n) + 50}")`)
        .replace('const PRECACHE = [', `const PRECACHE = ["${BASE_PATH}assets/not-on-this-server.js",`);
      fs.writeFileSync(file, src);
      dirs[name] = dir;
    },
    /** A release's stamp, as its worker says it. */
    build(name) {
      const stamp = sw(name).match(/const BUILD = "([^"]+)"/);
      if (!stamp) throw new Error(`release ${name} has no stamp`);
      return stamp[1];
    },
    /** A release's cache: `fitstrong-<number>-<stamp>` (public/sw.js). */
    cache(name) {
      const number = sw(name).match(/const NUMBER = Number\("(\d+)"\)/);
      if (!number) throw new Error(`release ${name} has no number`);
      return `fitstrong-${number[1]}-${this.build(name)}`;
    },
    /** The script a release's own index.html loads first: what tells two releases' shells apart. */
    entry(name) {
      const html = fs.readFileSync(path.join(dirs[name], 'index.html'), 'utf8');
      const src = html.match(/<script type="module"[^>]*src="([^"]+)"/);
      if (!src) throw new Error(`release ${name} has no entry script`);
      return src[1];
    },
    close() { server.close(); },
  };
}

/** Polls `fn` in the page until it returns something truthy, through reloads; that value. */
export async function until(page, fn, what, ms = 60000) {
  const end = Date.now() + ms;
  for (;;) {
    const got = await page.evaluate(fn).catch(() => undefined);
    if (got) return got;
    if (Date.now() > end) throw new Error(`${what} (after ${Math.round(ms / 1000)} s)`);
    await page.waitForTimeout(500);
  }
}

/** The page's real worker in charge: a first install takes the page over once it has cached its release whole. */
export const controlled = page => until(page, () => !!navigator.serviceWorker.controller, 'no worker took the page over', 90000);

/**
 * The registration's next release, followed to the end of its install:
 * 'installed' (it waits, or takes over at once) or 'redundant' (it failed).
 * One already installing or waiting counts.
 */
export async function installNext(page, ms = 90000) {
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const seen = (window.__install = []);
    const follow = w => {
      seen.push(w.state);
      w.addEventListener('statechange', () => seen.push(w.state));
    };
    if (reg.waiting) seen.push('installed');
    else if (reg.installing) follow(reg.installing);
    else {
      reg.addEventListener('updatefound', () => follow(reg.installing), { once: true });
      await reg.update().catch(() => undefined);
    }
  });
  return until(page, () => window.__install?.find(s => s === 'installed' || s === 'redundant'), 'the next release never finished installing', ms);
}

/** Ask for the next release, as the app does on a return; the page may reload under it. */
export const checkForUpdate = page => page.evaluate(async () => {
  await (await navigator.serviceWorker.getRegistration())?.update().catch(() => undefined);
}).catch(() => undefined);

export const hasWaiting = page => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting);
export const cacheNames = page => page.evaluate(() => caches.keys());
/** The release this page runs, as its worker told it (Task 2's `data-build`). */
export const buildOf = page => until(page, () => document.documentElement.dataset.build, 'the page never learned its release', 30000);

/** This document, marked: a reload takes the mark with it. */
export const mark = page => page.evaluate(() => { window.__sameDocument = true; });
export const sameDocument = page => page.evaluate(() => window.__sameDocument === true).catch(() => false);
```

  In `scripts/e2e/acceptance/run.mjs`, import `releaseServer` from `./lib/releases.mjs`. Beside the preview server:

```js
const releasePort = Number(args['release-port'] ?? devPort + 2);
let releases;
if (tasks.some(task => task.c.releases)) {
  console.log('Building two releases for the update cases …');
  releases = await releaseServer(releasePort, root);
}
const releaseOrigin = releases ? new URL(releases.url).origin : undefined;
```

  The server serves one release at a time, so a release case runs alone, after the rest. `let next = 0;`, `worker` and the `await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));` line become:

```js
/** One case in one project: its own context, its result recorded and printed. */
async function runCase({ j, c, project }) {
  const t = new Case({
    journey: j.id, name: c.name, project, browser, root,
    origin: c.releases ? releaseOrigin : c.preview ? previewOrigin : origin,
    log: verbose ? m => console.log(m) : m => { if (m.includes('FAIL')) console.log(m); },
  });
  try {
    if (c.preview && !previewOrigin) throw new Error('this case needs the production preview server');
    if (c.releases && !releases) throw new Error('this case needs the release server');
    await c.run(t, { project, devUrl, previewUrl, releases });
  } catch (e) {
    await t.fail(`journey error outside a step: ${String(e?.stack ?? e).split('\n').slice(0, 4).join(' | ')}`);
  }
  const r = await t.close();
  r.safety = !!j.safety;
  r.title = j.title;
  results.push(r);
  const mark = r.status === 'pass' ? 'pass' : r.status === 'pending' ? 'PEND' : 'FAIL';
  console.log(`${mark.padEnd(4)} ${j.id} ${project.id.padEnd(11)} ${c.name}${r.failures.length ? ` — ${r.failures.length} failure(s), first at step ${r.failures[0].step}: ${r.failures[0].message.slice(0, 140)}` : ''} (${Math.round(r.durationMs / 1000)}s)`);
}

/** `list`, `width` cases at a time. */
async function pool(list, width) {
  let next = 0;
  const lane = async () => { while (next < list.length) await runCase(list[next++]); };
  await Promise.all(Array.from({ length: Math.min(width, list.length) }, lane));
}

await pool(tasks.filter(task => !task.c.releases), concurrency);
await pool(tasks.filter(task => task.c.releases), 1);
```

  and after `stopServers();`, `releases?.close();`.

- [ ] **Step 6: A strict release run (D121, P8-27).** In `scripts/e2e/acceptance/run.mjs`, after the results are written, before the `process.exit`:

```js
// The release run (D121): nothing pending, and every case of every journey passed in each of its projects:
// all four, unless the case names its own (PERF01, large light).
if (args.strict !== undefined) {
  const problems = results.filter(r => r.status === 'pending').map(r => `${r.journey} ${r.project} ${r.case}: pending`);
  for (const j of journeys) {
    for (const c of j.cases) {
      for (const p of PROJECTS.filter(p => !c.projects || c.projects.includes(p.id))) {
        if (!results.some(r => r.journey === j.id && r.case === c.name && r.project === p.id && r.status === 'pass')) problems.push(`${j.id} ${p.id} ${c.name}: not passed`);
      }
    }
  }
  if (problems.length) {
    console.error(`Strict run: ${problems.length} problem(s).\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
}
```

  `--strict` with `--projects` naming fewer than four fails by that rule, as it should: a release run is all four. In `docs/reimagine/codex-acceptance.md`, "Execution and pass criteria" gains a seventh rule: "7. The release run is `npm run e2e:acceptance -- --strict`. A pending case fails it, and so does any case not passed in each of its projects: all four, unless the case names its own, as PERF01 does (D121)."

- [ ] **Step 7: Nothing else moved.** Run:

```bash
npm run e2e:acceptance -- --only=S01,J01,J05,V-J05
npm run e2e:acceptance -- --only=V-J05 --strict --projects=small-light; echo "exit $?"
```

Expected: the first passes in all four projects at 428×926 and 320×568; the second exits 1, naming the three projects not run. A layout finding at 428 that 430 hid is fixed in the app, not the journey.

- [ ] **Step 8: Commit**

```bash
git add scripts/e2e/acceptance/lib docs/reimagine/codex-acceptance.md scripts/e2e/acceptance/run.mjs
git commit -m "test: Run the suite at 428 by 926, drive the clock, zone, earphones and worker, serve two real releases, and add a strict run"
```

---

### Task 13: Every target a finger can find: 48 px, main targets 60 px, 12 px apart, nothing under one finger twice (J§20.4 rule 1)

**Files:**
- Create: `scripts/e2e/acceptance/lib/targets.mjs`, `scripts/e2e/acceptance/lib/targets.check.mjs`
- Create: `scripts/e2e/acceptance/journeys/s02.mjs` (journey `S02`)
- Modify: `scripts/e2e/acceptance/journeys/s01.mjs` (`inventory` exported)
- Modify: `docs/reimagine/codex-acceptance.md` ("Checks on every screen and sheet": the rule, its exceptions, S02)
- Modify: `src/components/hig/toast.ts` (Plan 7's `UNDO_STYLE`: a main target, 60 px tall), `src/components/hig/ActionMenu.tsx` (its title is a heading)
- Modify, the controls S02 finds short (Step 6's tables): `src/App.tsx`; `src/components/checkin/CheckInSheet.tsx`, `OutcomeBanner.tsx`, `SessionGate.tsx`, `parts.tsx`; `src/components/hig/Screen.tsx`, `Sheet.tsx`, `StorageBanner.tsx`, `TabBar.tsx`; `src/components/motion/FormDemo.tsx`, `MotionView.tsx`; `src/components/profile/ChipGroup.tsx`, `ProfileWizard.tsx`, `VoiceSettingsCard.tsx`; `src/components/session/InfoSheet.tsx`; `src/components/ui/dialog.tsx`; `src/pages/SessionPage.tsx`; `src/reminders/ReminderBanner.tsx`; `src/screens/guide/FoodPicker.tsx`, `GuideScreen.tsx`, `parts.tsx`; `src/screens/home/HomeScreen.tsx`, `UpdateRow.tsx`; `src/screens/move/ExercisesScreen.tsx`, `controls.tsx`; `src/screens/today/RecommendationCard.tsx`, `StatusSheet.tsx`; `src/screens/track/EditSheets.tsx`, `MetricDetail.tsx`, `QuickLog.tsx`, `WhenRows.tsx`, `ui.tsx` (not its `Segmented`); `src/screens/walk/LiveWalkScreen.tsx`, `RouteFrame.tsx`, `RouteView.tsx`, `StopSheet.tsx`, `guidance.tsx`, `parts.tsx`; `src/screens/welcome/FocusStep.tsx`; `src/screens/workout/TodayWorkoutScreen.tsx`, `parts.tsx`; `src/screens/you/FoodScreen.tsx`, `HabitSheets.tsx`, `RestoreFlow.tsx`, `controls.tsx`

**Interfaces:**
- Consumes: S01's route inventory (`journeys/s01.mjs`); `t.open({ textScale, sensors, updates })`; Plan 6's `walk.answerQuestions`, `walk.emit`, `walk.gpsSwitch`; `lib/hub.mjs` (`open`, `begin`, `start`); `lib/move.mjs` (`sheetStart`); `lib/ui.mjs`; `lib/data.mjs` (`logWater`, `logGlucose`, `writeFixture`, `transferDoc`, `chooseRestore`, `merge`); Plan 7's `lib/food.mjs` (`meal`, `ROTI`, `DAL`); Task 12's `rec.offerUpdate`, `rec.newerTab`; the `data-main` and `data-embedded` marks this task adds.
- Produces:
  - `TARGET_RULES = { min: 48, main: 60, gap: 12 }` and `EXCEPTIONS` (`lib/targets.mjs`), board D122;
  - `collect()`: in the page, every control a finger can reach on the screen as it stands (an open sheet's or menu's, while one is open): `{ what, x, y, w, h, inline, bezel, main, track, embedded, clipped }`;
  - `structure()`: in the page, `{ dialog: boolean; mains: number; h1s: number; unheaded: string[] }`;
  - `problems(controls, rules?)` and `structureProblems(s)`: what breaks J§20.4 rule 1, or the screen's structure, in words, or nothing;
  - the journey `S02`, failing on every finding, in all four projects, at 100% and 200% text.

**The rule, measured** (J§20.4 rule 1, verbatim: "everything tappable is at least 48×48 px and never under 44, with at least 12 px between bezelled controls. Primary buttons and other main targets are at least 60 px tall"). A *control* is anything a finger can reach: a button, a link, a field, a summary, or an element with a control's role; a checkbox or a radio is measured by its label's box, which is what a finger presses. A *main target* is a control filled with the app's tint, or with the shared `Button`'s primary fill, that isn't a choice (the region's one primary action, rule 4), and the named ones the spec calls "other main targets", each marked `data-main`: "I feel low", "I need to stop", a toast's Undo and Close, Recently deleted's Restore, Your plan's two choices after week 12, and Home's "Restart to update" (Kiro K8-04). A *bezelled* control has an edge of its own, a background, a border or a shadow, on itself or on the layer that fills it. Two controls never overlap, partly or wholly, unless the inner one's owner marks it as drawn inside it (`data-embedded`, a search field's Clear button): ownership is said, never guessed from rectangles (Codex P8R-16). A control's words fit it (Plan 6's open item: the live walk's Pause at 200% on a 320 px phone, whose label spills out of its half-width slot). Every screen has one main landmark and one level-1 heading, and every open sheet or menu a heading of its own (Plan 6's open item: Browse's More menu). The per-screen sweep keeps its 44 px floor, which every journey reports; S02 holds every screen to the whole rule and fails. Track's shared `Segmented` is Plan 3's fix (H3-19), not this task's.

- [ ] **Step 1: Plan 3's Segmented first.** S02 measures Track's shared `Segmented`, which Plan 3's review fix H3-19 raises to 48 px:

```bash
sed -n '/^export function Segmented/,/^}$/p' src/screens/track/ui.tsx | grep -c "min-h-11"
```

Expected: `0`. If it prints more, H3-19 isn't merged: stop, and finish Plan 3's fixes first. This task never touches that component.

- [ ] **Step 2: Write the failing self-check** `scripts/e2e/acceptance/lib/targets.check.mjs`

```js
#!/usr/bin/env node
/**
 * The target rule's own check (J§20.4 rule 1, board D122): each rule fails
 * when it should, and each exception excuses only what it names.
 *
 *   node scripts/e2e/acceptance/lib/targets.check.mjs
 */
import assert from 'node:assert/strict';
import { problems, structureProblems } from './targets.mjs';

const c = over => ({ what: 'button “x”', x: 0, y: 0, w: 120, h: 48, inline: false, bezel: false, main: false, track: null, embedded: false, clipped: false, ...over });

assert.deepEqual(problems([c({})]), []);
assert.match(problems([c({ h: 44 })])[0], /120 × 44 px, under 48 × 48/);
assert.match(problems([c({ w: 44, h: 48 })])[0], /44 × 48 px/);
// An inline link in running text is the text's size (WCAG 2.5.8).
assert.deepEqual(problems([c({ w: 40, h: 22, inline: true })]), []);
assert.match(problems([c({ main: true, h: 56 })])[0], /a main target 56 px tall, under 60/);
assert.deepEqual(problems([c({ main: true, h: 60 })]), []);
// Bezelled neighbours: 8 px apart side by side, 6 px one above the other; 12 is enough.
assert.match(problems([c({ bezel: true }), c({ bezel: true, x: 128 })])[0], /8 px apart side by side, under 12/);
assert.deepEqual(problems([c({ bezel: true }), c({ bezel: true, x: 132 })]), []);
assert.match(problems([c({ bezel: true }), c({ bezel: true, y: 54 })])[0], /6 px apart, one above the other, under 12/);
// Neighbours without an edge of their own aren't spaced.
assert.deepEqual(problems([c({}), c({ x: 124 })]), []);
// The segments of one segmented control are one control; two controls' segments aren't.
assert.deepEqual(problems([c({ bezel: true, track: 0 }), c({ bezel: true, track: 0, x: 124 })]), []);
assert.equal(problems([c({ bezel: true, track: 0 }), c({ bezel: true, track: 1, x: 124 })]).length, 1);
// Two controls under one finger, partly or wholly, are a finding, edged or not (P8R-16).
assert.match(problems([c({ bezel: true, w: 48 }), c({ bezel: true, w: 48, x: 40 })])[0], /overlap by 8 × 48 px/);
assert.match(problems([c({ bezel: true }), c({ bezel: true })])[0], /overlap by 120 × 48 px/);
assert.match(problems([c({}), c({ x: 60 })])[0], /overlap/);
// A control its owner marks as drawn inside it, such as a search field's Clear button, is spaced by that field.
assert.deepEqual(problems([c({ bezel: true, w: 300 }), c({ bezel: true, x: 252, w: 48, embedded: true })]), []);
// Inside, but not marked: a finding.
assert.match(problems([c({ bezel: true, w: 300 }), c({ bezel: true, x: 252, w: 48 })])[0], /overlap/);
// A control whose words don't fit it.
assert.match(problems([c({ clipped: true })])[0], /its words don’t fit it/);
// A screen's landmark and heading, and an open sheet's or menu's own heading.
assert.deepEqual(structureProblems({ dialog: false, mains: 1, h1s: 1, unheaded: [] }), []);
assert.match(structureProblems({ dialog: false, mains: 0, h1s: 1, unheaded: [] })[0], /no main landmark/);
assert.match(structureProblems({ dialog: false, mains: 1, h1s: 0, unheaded: [] })[0], /no level-1 heading/);
assert.match(structureProblems({ dialog: true, mains: 1, h1s: 1, unheaded: ['menu “More”'] })[0], /menu “More” has no heading of its own/);
console.log('targets: every rule fails when it should, and every exception excuses only its own.');
```

Run: `node scripts/e2e/acceptance/lib/targets.check.mjs`
Expected: FAIL, "Cannot find module … targets.mjs".

- [ ] **Step 3: Write** `scripts/e2e/acceptance/lib/targets.mjs`

```js
/**
 * J§20.4 rule 1, measured (board D122): "everything tappable is at least
 * 48×48 px and never under 44, with at least 12 px between bezelled
 * controls. Primary buttons and other main targets are at least 60 px tall."
 * And no two controls under one finger (Codex P8R-16), words that fit their
 * control, and each screen's landmark and heading. `collect` and `structure`
 * read the screen in the page; `problems` and `structureProblems` judge it,
 * anywhere.
 */

export const TARGET_RULES = { min: 48, main: 60, gap: 12 };

/** What the rule doesn't ask of, and nothing else (D122). */
export const EXCEPTIONS = [
  'A link inside running text (an inline link in a paragraph or a list item) is the size of its text, as WCAG 2.5.8 allows.',
  'The segments of one segmented control (radios or tabs inside one radiogroup or tablist that has an edge of its own) are one control: the 12 px are between it and its neighbours, not between its segments. Each segment is still 48 × 48.',
  'A control its owner marks as drawn inside it (`data-embedded`), such as a search field’s Clear button, is spaced by the control it sits in.',
  'A control that can’t be tapped now (disabled, hidden, or behind an open sheet) is measured when it can be.',
];

/**
 * In the page: every control a finger can reach on the screen as it stands,
 * the open sheet's or menu's while one is open, with what the rule asks
 * about each. Self-contained, for `page.evaluate`.
 */
export function collect() {
  const SEL = 'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role="slider"], [role="menuitem"], [role="option"]';
  const layer = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"],[role="menu"]')].find(d => d.getBoundingClientRect().height > 0);
  const alpha = c => {
    if (!c || c === 'transparent') return 0;
    const slash = /\/\s*([\d.]+)(%?)\s*\)\s*$/.exec(c);
    if (slash) return Number(slash[1]) / (slash[2] ? 100 : 1);
    const rgba = /^rgba\((?:[^,]+,){3}\s*([\d.]+)\s*\)$/.exec(c);
    return rgba ? Number(rgba[1]) : 1;
  };
  const edged = s => alpha(s.backgroundColor) > 0.05
    || ['Top', 'Right', 'Bottom', 'Left'].some(side => parseFloat(s[`border${side}Width`]) >= 1 && alpha(s[`border${side}Color`]) > 0.05)
    || (!!s.boxShadow && s.boxShadow !== 'none');
  // An edge of its own, or of the layer that fills it: a tile draws its card on an inner layer.
  const bezelled = (el, r) => edged(getComputedStyle(el)) || [...el.querySelectorAll('*')].some(d => {
    const b = d.getBoundingClientRect();
    return b.width * b.height >= 0.9 * r.width * r.height && edged(getComputedStyle(d));
  });
  const fill = css => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = css;
    document.body.append(probe);
    const resolved = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return resolved;
  };
  const fills = new Set([fill('var(--tint)'), fill('var(--primary)')]);
  const shown = el => {
    const r = el.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1) return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    }
    const s = getComputedStyle(el);
    return s.clip !== 'rect(0px, 0px, 0px, 0px)' && s.clipPath !== 'inset(50%)';
  };
  // Words wider than their own control: they spill out of it, or are cut off.
  const clipped = el => !el.matches('input, select, textarea') && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1;
  const tracks = [];
  const seen = new Set();
  return [...(layer ?? document).querySelectorAll(SEL)].flatMap(el => {
    if (el.closest('[aria-hidden="true"],[inert]') || !shown(el)) return [];
    if (el.disabled || el.getAttribute('aria-disabled') === 'true') return [];
    // A checkbox or a radio is pressed by its label: that is its target.
    const box = el.matches('input[type="checkbox"], input[type="radio"]') ? (el.labels?.[0] ?? el.closest('label') ?? el) : el;
    if (seen.has(box)) return [];
    seen.add(box);
    const s = getComputedStyle(el);
    const r = box.getBoundingClientRect();
    const role = el.getAttribute('role') ?? '';
    const choice = ['radio', 'checkbox', 'switch', 'tab', 'option'].includes(role) || el.matches('input[type="checkbox"], input[type="radio"]')
      || el.hasAttribute('aria-pressed') || el.hasAttribute('aria-checked') || el.hasAttribute('aria-selected');
    const group = el.closest('[role="radiogroup"], [role="tablist"]');
    let track = null;
    if (group && edged(getComputedStyle(group))) {
      if (!tracks.includes(group)) tracks.push(group);
      track = tracks.indexOf(group);
    }
    const name = (el.getAttribute('aria-label') || box.textContent || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 50);
    // The spec's "other main targets", each marked where it is drawn, and a toast's action (UNDO_STYLE).
    const named = el.closest('[data-main]') !== null || el.matches('[data-sonner-toast] [data-button]');
    return [{
      what: `${el.tagName.toLowerCase()}${role ? `[${role}]` : ''} “${name}”`,
      x: r.left, y: r.top, w: r.width, h: r.height,
      inline: el.tagName === 'A' && s.display === 'inline' && !!el.closest('p, li'),
      bezel: bezelled(box, r),
      main: !choice && (fills.has(s.backgroundColor) || named),
      track,
      embedded: el.hasAttribute('data-embedded'),
      clipped: clipped(box),
    }];
  });
}

/** In the page: the screen's main landmark and level-1 heading, and whether an open sheet or menu has a heading of its own. */
export function structure() {
  const open = [...document.querySelectorAll('[role="dialog"],[role="alertdialog"],[role="menu"]')].filter(d => d.getBoundingClientRect().height > 0);
  const unheaded = open.filter(d => !d.querySelector('h1, h2, h3, [role="heading"]'))
    .map(d => `${d.getAttribute('role')} “${(d.getAttribute('aria-label') || d.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30)}”`);
  return { dialog: open.length > 0, mains: document.querySelectorAll('main, [role="main"]').length, h1s: document.querySelectorAll('h1').length, unheaded };
}

const px = n => Math.round(n);
const inside = (a, b) => a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.w <= b.x + b.w + 0.5 && a.y + a.h <= b.y + b.h + 0.5;

/** Where `controls` break the rule, in words; nothing when they keep it. */
export function problems(controls, rules = TARGET_RULES) {
  const out = [];
  for (const c of controls) {
    if (c.inline) continue;
    if (c.w < rules.min - 0.5 || c.h < rules.min - 0.5) out.push(`${c.what} is ${px(c.w)} × ${px(c.h)} px, under ${rules.min} × ${rules.min}`);
    else if (c.main && c.h < rules.main - 0.5) out.push(`${c.what} is a main target ${px(c.h)} px tall, under ${rules.main}`);
    if (c.clipped) out.push(`${c.what}: its words don’t fit it`);
  }
  const reached = controls.filter(c => !c.inline);
  for (let i = 0; i < reached.length; i++) {
    for (let j = i + 1; j < reached.length; j++) {
      const a = reached[i];
      const b = reached[j];
      const apartX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
      const apartY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
      if (apartX < -0.5 && apartY < -0.5) {
        // Under one finger, unless the inner one is marked as drawn inside the other (P8R-16).
        if ((b.embedded && inside(b, a)) || (a.embedded && inside(a, b))) continue;
        out.push(`${a.what} and ${b.what} overlap by ${px(-apartX)} × ${px(-apartY)} px`);
        continue;
      }
      if (!a.bezel || !b.bezel || (a.track !== null && a.track === b.track)) continue;
      if (apartY < 0 && apartX >= 0 && apartX < rules.gap - 0.5) out.push(`${a.what} and ${b.what} are ${px(apartX)} px apart side by side, under ${rules.gap}`);
      if (apartX < 0 && apartY >= 0 && apartY < rules.gap - 0.5) out.push(`${a.what} and ${b.what} are ${px(apartY)} px apart, one above the other, under ${rules.gap}`);
    }
  }
  return out;
}

/** Where the screen's structure falls short, in words. */
export function structureProblems(s) {
  const out = [];
  if (s.mains !== 1) out.push(s.mains === 0 ? 'the screen has no main landmark' : `the screen has ${s.mains} main landmarks`);
  if (s.h1s < 1) out.push('the screen has no level-1 heading');
  for (const u of s.unheaded) out.push(`the open ${u} has no heading of its own`);
  return out;
}
```

Run: `node scripts/e2e/acceptance/lib/targets.check.mjs`
Expected: "targets: every rule fails when it should, and every exception excuses only its own."

- [ ] **Step 4: Write** `scripts/e2e/acceptance/journeys/s02.mjs`, and in `scripts/e2e/acceptance/journeys/s01.mjs` make `async function inventory(` read `export async function inventory(`.

```js
/**
 * S02 (journey §20.4 rule 1, board D122): every control a finger can reach,
 * on every screen and sheet S01's inventory visits, on the screens a task
 * runs on (Me's habit sheets, a walk with its stop sheet and its low
 * guidance, its record, a stretch's player and the low's reading screen, a
 * manual workout, a guided session's sets, the check-in on insulin), and on
 * Plan 8's own (an Undo, Recently deleted, a held reading's refusal, what a
 * backup can hold, your own foods and their edit sheet, Food's trend,
 * Browse's food rows, Home's update line, the error screen, after week 12,
 * and the storage screen a newer copy causes), at 100% and 200% text: at
 * least 48 × 48 CSS px, a main target at least 60 px tall, at least 12 px
 * between bezelled controls, none under one finger with another, words that
 * fit, and each screen's landmark and heading, but for the exceptions
 * `lib/targets.mjs` lists. Every finding fails the case, naming the screen,
 * the control and its measure.
 */
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as food from '../lib/food.mjs';
import * as hub from '../lib/hub.mjs';
import * as mv from '../lib/move.mjs';
import * as rec from '../lib/recovery.mjs';
import { collect, problems, structure, structureProblems } from '../lib/targets.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';
import { inventory } from './s01.mjs';

export const id = 'S02';
export const title = 'Every target at least 48 px, main targets 60 px, bezelled controls 12 px apart, none overlapping';
export const safety = false;

const AT = '2026-10-08T09:00:00.000+05:30';
const ESTIMATES = { patch: { profile: { food: { pattern: 'vegetarian', avoid: [], level: 'estimates', hardBefore: 'no' } } } };
const JULY = { patch: { settings: { startDate: '2026-07-17' } } };
const NEXT_DAY = Date.parse('2026-10-09T09:00:00+05:30');
const BHEL = { id: 'food-s02', name: 'Bhel puri', per: { qty: 1, unit: 'plate' }, kcal: 300, createdAt: AT, updatedAt: AT };

/** Every checkpoint the case takes measures its screen as well; each finding fails the case. */
function measuring(t) {
  const take = t.checkpoint.bind(t);
  t.checkpoint = async (name, options = {}) => {
    const snapshot = await take(name, options);
    const page = options.page ?? t.page;
    const found = [...problems(await page.evaluate(collect)), ...structureProblems(await page.evaluate(structure))];
    await t.check(found.length === 0, `${name}: ${found.slice(0, 6).join('; ')}${found.length > 6 ? `; and ${found.length - 6} more` : ''}`);
    return snapshot;
  };
}

/** A sheet, measured, then closed by its Close. */
async function sheetAt(t, name, open) {
  const page = t.page;
  await open();
  const dialog = page.getByRole('dialog').first();
  await dialog.waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);
  await t.checkpoint(name);
  await ui.tap(ui.button(dialog, 'Close'));
  await dialog.waitFor({ state: 'hidden' }).catch(() => {});
}

/** From a hub's start, through its check-in, onto the session's own screen. */
async function intoSession(t, mode, persona) {
  const page = t.page;
  await hub.open(t, mode);
  const { sheet } = await hub.begin(t);
  if (sheet) {
    await ui.answerCheckIn(t, sheet, ui.normalAnswers(persona));
    await ui.tap(mv.sheetStart(sheet));
  }
  await page.waitForURL(/#\/session/, { timeout: 15000 });
  await t.ready();
}

/** A walk from its hub, through its check-in and questions, live. */
async function intoWalk(t, persona, { keep = true } = {}) {
  const page = t.page;
  await hub.open(t, 'walk');
  await walk.emit(page, 12.97, 77.59);
  if (await walk.gpsSwitch(page).getAttribute('aria-checked') !== 'true') await ui.tap(walk.gpsSwitch(page));
  await ui.tap(hub.start(page));
  const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
  await sheet.waitFor({ timeout: 10000 });
  await ui.answerCheckIn(t, sheet, ui.normalAnswers(persona));
  await ui.tap(mv.sheetStart(sheet));
  await walk.answerQuestions(t, { keep });
  await page.waitForURL(/#\/walk\/live/);
  await t.ready();
}

/** A serious reading's guidance, closed by its Close. */
async function closeGuidance(page) {
  const guidance = page.getByRole('dialog', { name: /^(Saved|What to do)$/ });
  if (!(await guidance.count())) return;
  await ui.tap(ui.button(guidance, 'Close'));
  await guidance.waitFor({ state: 'hidden' });
}

/** Records a backup would carry, merged in as Restore merges them (Plan 7's `seedMeals`, for any store). */
async function seedRecords(t, records) {
  const file = data.writeFixture(t, 'records.json', data.transferDoc({ schemaVersion: 6, stores: Object.keys(records), records }));
  const sheet = await data.chooseRestore(t, file);
  await data.merge(t, sheet);
  await ui.tap(ui.button(sheet, 'Done'));
  await sheet.waitFor({ state: 'hidden' });
}

/** The screens a task runs on, which S01's inventory doesn't open. */
async function tasks(t, { textScale } = {}) {
  const scale = textScale ? { textScale } : {};
  let page = await t.open({ seed: persona('P03'), route: '/me/reminders', sensors: { geo: 'grant' }, ...scale });
  let main = page.getByRole('main');

  await t.step(1, 'Me → Reminders, with its Water and Sitting breaks sheets', async () => {
    await ui.heading(page, 'Reminders');
    await t.checkpoint('reminders');
    for (const name of ['Water', 'Sitting breaks']) {
      await sheetAt(t, `habit-${name.toLowerCase().replace(/\W+/g, '-')}`, () => ui.tap(ui.row(main, name)));
    }
  });

  await t.step(2, 'A walk: its setup and picker, the live walk with its route, the stop sheet and its questions, paused, finishing, and its summary', async () => {
    await hub.open(t, 'walk');
    await t.checkpoint('walk-setup');
    await intoWalk(t, 'P03');
    for (let i = 1; i <= 6; i++) {
      await t.advance(10_000);
      await walk.emit(page, 12.97 + i * 0.0002, 77.59);
    }
    await page.waitForTimeout(1300);
    await t.checkpoint('walk-live');
    await sheetAt(t, 'walk-stop', () => ui.tap(ui.button(main, 'I need to stop')));
    await ui.tap(ui.button(main, 'Pause'));
    await t.checkpoint('walk-paused');
    await ui.tap(ui.button(main, 'Finish'));
    const finish = page.getByRole('dialog', { name: 'Finish walk' });
    await finish.waitFor();
    await t.checkpoint('walk-finish');
    await ui.tap(ui.button(finish, 'Finish walk'));
    await page.getByRole('heading', { level: 1, name: 'Your walk' }).waitFor();
    await t.checkpoint('walk-summary');
    await ui.tap(ui.button(main, 'Save walk'));
    await page.getByText('Saved on this device', { exact: true }).waitFor({ timeout: 10000 });
    await t.checkpoint('walk-saved');
    await ui.tap(ui.button(main, 'Done'));
  }, { input: 'P03, a walk with its route kept' });

  await t.step(3, 'The walk’s record, with its route', async () => {
    await ui.legacyTab(page, 'Track');
    await ui.tap(ui.row(ui.section(main, 'Records'), 'Walk', 'link'));
    await ui.heading(page, 'Walk');
    await t.checkpoint('walk-detail');
  });

  await t.step(4, 'The walk’s low guidance, from “I feel low” on a walk under way (Plan 6’s open item)', async () => {
    await intoWalk(t, 'P03', { keep: false });
    await ui.tap(ui.button(main, 'I feel low'));
    await page.getByText(/Treat the low first|Glucose now/).first().waitFor({ timeout: 15000 });
    await t.checkpoint('walk-low-guidance');
  });

  await t.context.close();
  page = await t.open({ seed: persona('P03'), route: '/home', ...scale });
  main = page.getByRole('main');

  await t.step(5, 'A stretch: its start screen, the player, its exit sheet, and the low’s reading screen', async () => {
    await intoSession(t, 'stretch', 'P03');
    await t.checkpoint('session-start');
    await ui.tap(page.getByRole('button', { name: 'Start', exact: true }));
    await page.getByRole('button', { name: 'Pause', exact: true }).waitFor({ timeout: 10000 });
    await t.checkpoint('session-player');
    await ui.tap(page.getByRole('button', { name: 'End session', exact: true }));
    const keep = page.getByRole('button', { name: 'Keep going', exact: true });
    await keep.waitFor();
    await t.checkpoint('session-exit');
    await ui.tap(keep);
    await ui.tap(page.getByRole('button', { name: 'I feel low', exact: true }));
    await page.getByText('Treat the low first', { exact: true }).waitFor({ timeout: 15000 });
    await t.checkpoint('session-low');
  });

  await t.context.close();
  page = await t.open({ seed: persona('P01'), route: '/hub/workout/log', ...scale });

  await t.step(6, 'A manual workout, then a guided session at its first set', async () => {
    await t.checkpoint('workout-log');
    await intoSession(t, 'guided', 'P01');
    await ui.tap(page.getByRole('button', { name: 'Start', exact: true }));
    // Past the warm-up to a set: its weight and reps steppers.
    const done = page.getByRole('button', { name: /^Done — next$/ });
    for (let i = 0; i < 20 && !(await done.count()); i++) await ui.tap(page.getByRole('button', { name: 'Next', exact: true }));
    await t.must(await done.count() === 1, 'no set came up in the guided session');
    await t.checkpoint('session-set');
  });

  await t.context.close();
  page = await t.open({ seed: persona('P04'), route: '/home', ...scale });

  await t.step(7, 'The check-in on insulin, with its switch for rapid-acting insulin', async () => {
    await ui.tap(ui.rightNow(page).getByRole('button').first());
    const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
    await sheet.waitFor({ timeout: 10000 });
    await t.must(await sheet.getByRole('switch', { name: 'Rapid-acting insulin in the last 2 hours' }).count() === 1, 'the check-in on insulin asks nothing about rapid-acting insulin');
    await t.checkpoint('check-in-insulin');
  });
}

/** Plan 8's own screens (Kiro K8-04), on the production build so Home's update line is there. */
async function ownScreens(t, { textScale } = {}) {
  const scale = textScale ? { textScale } : {};
  let page = await t.open({ seed: persona('P04', ESTIMATES), route: '/day/today', updates: true, ...scale });
  let main = page.getByRole('main');

  await t.step(1, 'Today’s log: a water entry deleted, its Undo standing, and Recently deleted', async () => {
    await data.logWater(t, 250);
    await ui.tap(ui.row(ui.section(main, 'Day totals'), 'Water', 'link'));
    await ui.tap(ui.row(main, 'Delete this entry'));
    await rec.toast(page, 'deleted').first().waitFor({ timeout: 10000 });
    await t.checkpoint('undo-toast');
    await sheetAt(t, 'recently-deleted', () => ui.tap(ui.row(main, 'Recently deleted')));
  });

  await t.step(2, 'A 52 that holds movement, refused in place with It was a mistake', async () => {
    await data.logGlucose(t, { value: 52 });
    await closeGuidance(page);
    await ui.legacyTab(page, 'Track');
    await ui.tap(ui.section(main, 'Records').getByRole('link').filter({ hasText: '52' }).first());
    await ui.tap(ui.row(main, 'Delete this reading'));
    await page.getByRole('button', { name: 'It was a mistake', exact: true }).waitFor({ timeout: 10000 });
    await t.checkpoint('held-refusal');
  }, { input: 'Glucose 52 mg/dL, on insulin' });

  await t.step(3, 'Me → Data → What a backup can hold', async () => {
    await t.goto('/me/data');
    await sheetAt(t, 'backup-limits', () => ui.tap(ui.row(main, 'What a backup can hold')));
  });

  await t.step(4, 'Me → Food → Your own foods, and a food’s edit sheet', async () => {
    await seedRecords(t, { customFoods: [BHEL], meals: [food.meal('meal-s02', '2026-10-07T13:05:00.000+05:30', 'lunch', [food.ROTI, food.DAL], 'estimates')] });
    await t.goto('/me/food/own');
    await ui.heading(page, 'Your own foods');
    await t.checkpoint('own-foods');
    await sheetAt(t, 'own-food-edit', () => ui.tap(page.getByRole('button', { name: 'Edit Bhel puri', exact: true })));
  });

  await t.step(5, 'Food’s trend, and Browse’s food rows', async () => {
    await t.goto('/trends/food');
    await ui.heading(page, 'Food');
    await t.checkpoint('food-trend');
    await ui.tab(page, 'Browse');
    await ui.type(main.getByRole('searchbox').first(), 'dal');
    await main.getByText('Toor dal').first().waitFor({ timeout: 10000 });
    await t.checkpoint('browse-food');
  });

  await t.step(6, 'Home’s update line, with its Restart', async () => {
    await rec.offerUpdate(page);
    await ui.tab(page, 'Home');
    await page.getByRole('button', { name: 'Restart to update', exact: true }).waitFor({ timeout: 10000 });
    await t.checkpoint('update-line');
  });

  await t.step(7, 'The error screen, for a screen whose code can’t be fetched', async () => {
    const chunks = /\/fit-strong-90\/assets\/.+\.js$/;
    await page.route(chunks, route => route.abort());
    try {
      await t.goto('/hub/learn');
      await page.getByRole('heading', { name: 'This screen didn’t load' }).waitFor({ timeout: 15000 });
      await t.checkpoint('error-screen');
    } finally {
      await page.unroute(chunks);
    }
  });

  await t.context.close();
  page = await t.open({ seed: persona('P01', JULY), route: '/home', time: NEXT_DAY, ...scale });
  main = page.getByRole('main');

  await t.step(8, 'After week 12: Your plan’s two choices, and the restart sheet', async () => {
    await ui.tap(ui.button(ui.rightNow(page), 'Choose what’s next'));
    await ui.section(main, 'What next?').waitFor({ timeout: 10000 });
    await t.checkpoint('what-next');
    await sheetAt(t, 'restart-sheet', () => ui.tap(ui.row(ui.section(main, 'What next?'), 'Start the 12 weeks again')));
  });

  await t.step(9, 'A newer copy takes the database: the storage screen', async () => {
    const version = (await t.db()).version;
    const newer = await rec.newerTab(t, version + 1, { abort: false });
    try {
      await page.bringToFront();
      await page.getByText('A newer version of FitStrong is open', { exact: true }).waitFor({ timeout: 15000 });
      await t.checkpoint('storage-newer');
    } finally {
      await newer.page.close();
    }
  });
}

export const cases = [
  { name: 'the inventory at normal text', run: t => { measuring(t); return inventory(t); } },
  { name: 'the inventory at 200% text', run: t => { measuring(t); return inventory(t, { textScale: 2 }); } },
  { name: 'the task screens at normal text', run: t => { measuring(t); return tasks(t); } },
  { name: 'the task screens at 200% text', run: t => { measuring(t); return tasks(t, { textScale: 2 }); } },
  { name: 'Plan 8’s own screens at normal text', preview: true, run: t => { measuring(t); return ownScreens(t); } },
  { name: 'Plan 8’s own screens at 200% text', preview: true, run: t => { measuring(t); return ownScreens(t, { textScale: 2 }); } },
];
```

  `t.goto(route)` is the harness's own navigation (`lib/harness.mjs`). Where a step needs a helper Plan 6's or Plan 7's suite names otherwise (the Browse search field's role, the walk's low guidance's words), use that name, and keep the step's checkpoint.

- [ ] **Step 5: Run it to see where the app falls short**

```bash
npm run e2e:acceptance -- --only=S02 > /tmp/fit-checks/accept-s02-before.log 2>&1; tail -n 40 /tmp/fit-checks/accept-s02-before.log
```

Expected: S02 fails in all four projects. Among its findings, each read from the code on `feat/v2-journey` at e334e91 or from Plan 6's and Plan 8's own open items:
  - Me → Reminders → Water and Sitting breaks: the "Glass size" and "Remind me every" segments, 44 px tall (Me's own `Segmented`, `src/screens/you/controls.tsx`);
  - the check-in sheet: on insulin, its "Rapid-acting insulin in the last 2 hours" `Toggle` (44 × 44, `src/components/checkin/parts.tsx`); its answer buttons and number boxes (44 px); "See today’s plan", a main action 52 px tall (`CheckInSheet.tsx`'s `primary`);
  - the live walk (Plan 6's open items; the rest of the walk is at the rule's sizes already, through `TARGET`): Pause, whose words at 200% text on a 320 px phone don't fit its half-width slot; the hold's one button ("Say what happened", "Change status", "Check in" or "Health questions"), filled with the tint, a main target 48 px tall; the stop sheet's reach chips (44 px, 6 px apart) and its questions, 20 px checkboxes in 44 px rows (measured by their rows); the walk's low guidance, its unit choices (8 px apart), reading box, unit button, "Meter shows HI or LO?" and question rows (44 px); the walk's picker and its pain choices (44 px, the choices 6 px apart);
  - the session: End session and Back (44 × 44), Mute (44 px), the low screen's unit button and "Meter shows HI or LO?" (44 px), its "Save this reading" (a main action 48 px tall), and the set's Fewer and More (44 × 44);
  - Blood pressure's When chips, 8 px apart (Track's `ChoiceChips`);
  - every `PrimaryButton` but the walk's, 52 or 56 px tall (Me, Move and Track's, and the workout's `primary`), and the check-in's own primary (52 px);
  - every screen's Back, and every sheet's Close (44 px);
  - Plan 8's own: a toast's Undo (`UNDO_STYLE`, 48 px: a main target under 60), and Recently deleted's Restore and Home's "Restart to update" until they are marked and sized; the search field's Clear button, overlapping its field until it is marked as drawn inside it;
  - Browse's More menu, and every `ActionMenu`: its title is a paragraph, so the open menu has no heading of its own (Plan 6's open item).

- [ ] **Step 6: Make every target the rule's size.** Classes are in rem, so each still grows with the text. Each finding S02 names is one of four kinds, fixed one way:

  **A. Under 48 × 48** — `min-h-11` becomes `min-h-12`, `h-11` becomes `h-12`, `size-11` becomes `size-12` and `min-w-11` becomes `min-w-12`, on the control itself (and on a bar that holds it, so it fits):

| File | Controls |
| --- | --- |
| `src/App.tsx` | the storage screen's second button |
| `src/components/checkin/parts.tsx` | `Toggle` (`min-h-12 min-w-12`, the known offender), the answer buttons, the number box (`h-12`) |
| `src/components/checkin/CheckInSheet.tsx` | "Change answers" and its siblings, the unit button, the three unit choices, the reading box (`h-12`) |
| `src/components/checkin/OutcomeBanner.tsx` | its profile link |
| `src/components/hig/Screen.tsx` | the bar (`h-12`) and its Back button (`min-h-12 min-w-12`) |
| `src/components/hig/Sheet.tsx` | the title bar and its Close |
| `src/components/hig/StorageBanner.tsx` | the banner's button |
| `src/components/hig/TabBar.tsx` | the wide screen's sidebar items (`lg:min-h-12`) |
| `src/components/motion/FormDemo.tsx`, `src/components/profile/ChipGroup.tsx` | their chips |
| `src/components/motion/MotionView.tsx` | the Play or Pause demonstration button (`size-12`) |
| `src/components/profile/ProfileWizard.tsx` | every number and date box (`h-12`), the kg and lb segments (`min-w-12`, the segmented control's track `min-h-12`), the choice cards |
| `src/components/profile/VoiceSettingsCard.tsx` | each voice's choice and its preview button (`size-12`) |
| `src/components/session/InfoSheet.tsx` | "Sources" (`summary`) |
| `src/components/ui/dialog.tsx` | the dialog's own close button (`size-12`) |
| `src/pages/SessionPage.tsx` | End session and Back (`size-12`, and the header's spacer `size-12` to keep the title centred), "I feel low", the strength block's button, Fewer and More (`size-12`), the reading box (`h-12`), the unit button and `UNIT_CHOICE`, "Meter shows HI or LO?", the reach chips (`min-h-12 min-w-12`), Mute (`h-12`), the back-pain keys (`h-12 min-w-12`, their grid's `minmax(2.75rem,1fr)` becoming `minmax(3rem,1fr)`, and its comment "never narrower than 48 px") |
| `src/screens/food/LogMealSheet.tsx`, `src/screens/food/parts.tsx` (Plan 7's) | `FIELD` (`h-12`), the portion's `STEP` buttons (`min-h-12 min-w-12`) and `BackToMeal`'s button |
| `src/screens/food/UsualMealsScreen.tsx` (Plan 7's) | each usual meal's remove button (`size-12`) |
| `src/screens/guide/GuideScreen.tsx` | the search field (`h-12`, `pr-12`) and its Clear button (`size-12`) |
| `src/screens/guide/FoodPicker.tsx` | the search field (`h-12`) |
| `src/screens/guide/parts.tsx` | the source link's inner line (`min-h-12`) |
| `src/screens/move/ExercisesScreen.tsx` | the filter button, the search field's label, "Clear filters" |
| `src/screens/move/controls.tsx` | Move's choice buttons |
| `src/screens/today/StatusSheet.tsx` | the until-date field, the Welcome back buttons' `button` |
| `src/screens/track/EditSheets.tsx`, `MetricDetail.tsx` | the note field, the metric's text button |
| `src/screens/track/QuickLog.tsx` | the back link, the paste and second-reading buttons beside the existing `min-h-12` ones, the number boxes |
| `src/screens/track/WhenRows.tsx` | `INPUT` |
| `src/screens/track/ui.tsx` | the full-width secondary button (not `Segmented`: Plan 3's) |
| `src/screens/walk/StopSheet.tsx` | the reach chips (`min-h-12 min-w-12`), the question rows (`min-h-12`: each checkbox is pressed by its row) |
| `src/screens/walk/guidance.tsx` | the low guidance's controls: `UNIT_CHOICE`, the reading box (`h-12`), the unit button, "Meter shows HI or LO?", the two question rows |
| `src/screens/walk/parts.tsx` | the walk's picker (the meal-time picker), the pain choices, the side button |
| `src/screens/welcome/FocusStep.tsx` | "Choose for me" |
| `src/screens/workout/parts.tsx` | `quiet` |
| `src/screens/you/FoodScreen.tsx` | the remove button (`size-12`), the add field and its submit |
| `src/screens/you/HabitSheets.tsx` | the glass size field |
| `src/screens/you/RestoreFlow.tsx` | the cancel button |
| `src/screens/you/controls.tsx` | `PlainButton`, `Segmented`'s segments (the known offender), `TimeField`'s field |

  **B. A main action under 60 px tall** — its height becomes `min-h-[3.75rem]` (`h-[3.75rem]` where the shared `Button` sets `h-12`):

| File | Controls |
| --- | --- |
| `src/screens/you/controls.tsx`, `src/screens/move/controls.tsx`, `src/screens/track/ui.tsx` | each `PrimaryButton` (the walk's, in `src/screens/walk/parts.tsx`, is `TARGET.primary` already) |
| `src/screens/workout/parts.tsx` | `primary` |
| `src/components/checkin/CheckInSheet.tsx`, `src/components/checkin/SessionGate.tsx` | the check-in's `primary`, the gate's button |
| `src/screens/today/RecommendationCard.tsx` | `primaryButton` |
| `src/screens/today/StatusSheet.tsx` | Apply (`cn(buttonBase, 'min-h-[3.75rem] bg-tint text-on-tint')`) |
| `src/reminders/ReminderBanner.tsx` | the filled primary (`'flex-1 min-h-[3.75rem] bg-tint text-on-tint'`) |
| `src/screens/home/HomeScreen.tsx` | the filled button in the card at its foot |
| `src/screens/guide/FoodPicker.tsx`, `src/screens/guide/parts.tsx` | their filled buttons (`min-h-[3.125rem]` today) |
| `src/App.tsx` | the storage screen's Try again |
| `src/screens/walk/LiveWalkScreen.tsx` | the hold's one button, whichever it shows ("Say what happened", "Change status", "Check in", "Health questions"): its `TARGET.tap` becomes `TARGET.primary` |
| `src/components/profile/ProfileWizard.tsx` | `FOOTER_BUTTON` (`min-h-[3.75rem]`: Back stays as tall as Next beside it) |
| `src/pages/SessionPage.tsx` | each filled `Button` at `h-12` (Back, Keep going, Enter my glucose, Save this reading, "Save, and carry on without it", the leg save) and the summary's save at `h-14`; "I feel low", marked `data-main` |
| `src/screens/walk/LiveWalkScreen.tsx` (again) | "I need to stop" and "I feel low", each marked `data-main` |
| `src/components/hig/toast.ts` (Plan 7's) | `UNDO_STYLE`'s `minHeight: '3rem'` becomes `'3.75rem'`: a toast's Undo and Close are main targets (K8-04) |
| `src/screens/home/UpdateRow.tsx` | "Restart to update", marked `data-main`, with `className="min-h-[3.75rem]"` |

  The error screen's Try again is already 60 px, and so are Recently deleted's Restore and Your plan's two choices after week 12: Tasks 2, 8 and 11 wrote them so, marked.

  **C. Bezelled controls closer than 12 px** — the gap of the group that holds them (`gap-1`, `gap-1.5`, `gap-2` or `gap-2.5`) becomes `gap-3`:

| File | Group |
| --- | --- |
| `src/screens/track/ui.tsx` | `ChoiceChips`' row (the When chips, the known offender) |
| `src/screens/walk/StopSheet.tsx`, `src/pages/SessionPage.tsx` | the reach chips |
| `src/screens/walk/parts.tsx`, `src/pages/SessionPage.tsx` | the pain choices, the back-pain keys |
| `src/screens/walk/guidance.tsx`, `src/components/checkin/CheckInSheet.tsx`, `src/pages/SessionPage.tsx` | the unit choices |
| `src/screens/workout/TodayWorkoutScreen.tsx`, `src/screens/workout/parts.tsx` | Better, Same and Worse; `NumberStepper`'s row |
| `src/pages/SessionPage.tsx` | the checkpoint's answers; each reading, check-in, symptoms, stop and dizziness screen's `mt-auto flex flex-col gap-2`; the exit sheet's footer |
| `src/screens/home/HomeScreen.tsx` | the unfinished run's Finish it and its partner |
| `src/components/motion/FormDemo.tsx`, `src/components/profile/ChipGroup.tsx` | their chips |

  **D. Under one finger, words that don't fit, and a menu with no heading:**

| File | Change |
| --- | --- |
| `src/screens/guide/GuideScreen.tsx` | the search field's Clear button gains `data-embedded`: it is drawn inside the field on purpose |
| `src/screens/walk/LiveWalkScreen.tsx` | the Pause and Finish row's `mx-auto grid max-w-2xl grid-cols-2 gap-3` becomes `mx-auto flex max-w-2xl flex-wrap gap-3`, and its two buttons (Pause or Resume, and Finish) gain `className="min-w-[min(100%,10rem)] flex-1 whitespace-normal"`, so at 200% text a long label wraps inside its own button, or the two stack, rather than sticking out of a half-width slot |
| `src/components/hig/ActionMenu.tsx` | the title's `<p id={titleId} …>` becomes `<h2 id={titleId} …>` with the same classes: every menu, Browse's More included, has a heading of its own |

  Run `npm run e2e:acceptance -- --only=S02` after each file, as each table's rows shrink the findings. A finding S02 names that no row covers is fixed by the rule of its kind (the shared `TARGET` classes in `src/components/hig/targets.ts` say the same sizes), and its file joins that table in the commit message.

- [ ] **Step 7: The rule in the acceptance doc.** In `docs/reimagine/codex-acceptance.md`, "Checks on every screen and sheet", the Controls row's "Minimum 44 × 44 CSS-pixel target" becomes: "Targets at least 48 × 48 CSS px (44 is the floor every journey's sweep reports), a main target at least 60 px tall (a filled primary, or one marked `data-main`: I feel low, I need to stop, a toast's Undo and Close, Restore, Your plan's choices, Restart to update), at least 12 px between bezelled controls, no two controls overlapping unless the inner one is marked `data-embedded`, and every control's words fitting it (J§20.4 rule 1, D122). Every screen has one main landmark and one level-1 heading, and every open sheet or menu a heading of its own. S02 holds every screen of S01's inventory, the screens a task runs on and Plan 8's own to it at 100% and 200% text, and fails on any finding. Excused, and nothing else: a link inside running text; the segments of one segmented control; a control marked as drawn inside another; a control that can't be tapped now."

- [ ] **Step 8: Run them**

```bash
node scripts/e2e/acceptance/lib/targets.check.mjs
npm run e2e:acceptance -- --only=S02,S01,M01,M02,J01,J05,J10,J11,J13,V-J05,V-J12
```

Expected: the self-check passes; S02 passes in all four projects at both text sizes, its last two cases on the production build; the rest still pass. A layout that no longer fits at 320×568 with 200% text (S01's overflow check, and S02's own) is fixed in the layout, never by shrinking a target back.

- [ ] **Step 9: Check by eye.** `npm run dev` at 320×568 and 428×926, 100% and 200% text: Home, a hub with its nav bar scrolled, a sheet, the check-in, a walk with its Pause and Finish at 200% on the small phone, the session's player, a toast's Undo, and Browse's More menu with VoiceOver's rotor on Headings. Nothing overlaps, every title still fits beside its Back, the bars look as they did, a little taller, and the menu's title is read as a heading.

- [ ] **Step 10: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add scripts/e2e/acceptance/lib/targets.mjs scripts/e2e/acceptance/lib/targets.check.mjs scripts/e2e/acceptance/journeys/s01.mjs scripts/e2e/acceptance/journeys/s02.mjs docs/reimagine/codex-acceptance.md src
git commit -m "fix: Make every target 48 px, every main target 60 px and every bezelled pair 12 px apart, with none overlapping, measured on every screen (J§20.4 rule 1)"
```

---

### Task 14: Acceptance V-J21, V-J22, V-J23 and V-J25

**Files:**
- Create: `scripts/e2e/acceptance/journeys/v21.mjs`, `v22.mjs`, `v23.mjs`, `v25.mjs`

**Interfaces:**
- Consumes: Task 12's `media`, `captureMedia`, `pressCaptured` and `open({ media })`; `lib/safety-a.mjs` (`openCheckIn`, `noneRightNow`, `typeGlucose`, `typeBp`, `setPain`, `noneSince`, `noneElse`, `sleepEnergy`, `submit`, `surface`); `lib/safety-b.mjs` (`openSheet`, `readSheet`, `START`); `lib/hub.mjs`; `lib/data.mjs` (`saveForm`); `lib/guide.mjs` (`setStatus`); `lib/move.mjs` (`checkInSheet`, `sheetStart`); `docs` (`lib/harness.mjs`); a stretch's saved progress, `localStorage['fit-strong-90-stretch']` (`src/session/persistence.ts`).
- Produces: four journeys, each case passing in all four projects.

**What V-J21 proves, and how (Codex P8-23).** J§17.2 #21's "close the sheet" is, in this app, the player's low guidance: a full screen ("Treat the low first", `SessionPage.tsx`'s `ReadingScreen`), left by its own "Leave, and come back later". The journey requires that exit to happen, rather than closing something if it happens to be there. Earphone Play is pressed through the handler the app set, and the press must exist; what proves it moved nothing is the run's saved progress (its status, step and active time), not only the absence of Pause. After the screen is left, the session's handlers must be gone, and the one captured before leaving, pressed as a stray earphone press would, still moves nothing (`useGuidedSession.ts`'s handler lifecycle). The session's own Resume, where it shows, and the `/session?resume=1` link a bookmark or Carry on gives, are tried while the low holds too, and move nothing (Kiro K8-13).

- [ ] **Step 1: Write** `scripts/e2e/acceptance/journeys/v21.mjs`

```js
/**
 * V-J21 (journey §17.2 #21): a low during a session → its guidance left by
 * its own way out → Resume and earphone Play stay held until the release.
 * P04, on insulin, at 90 mg/dL, runs a stretch; "I feel low" and 65 mg/dL
 * hold it. Earphone Play on the guidance, and a stray press of the handler
 * kept from before it was left, move nothing: the run's saved progress stays
 * where it was. A re-check 15 minutes later reads 110 mg/dL with the symptoms
 * gone, and Play moves the run again. J13 step 4 proves the hold itself.
 */
import { persona } from '../fixtures/personas.mjs';
import * as hub from '../lib/hub.mjs';
import * as rec from '../lib/recovery.mjs';
import * as s from '../lib/safety-a.mjs';
import * as sb from '../lib/safety-b.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J21';
export const title = 'A low in a session holds Resume and earphone Play until the release';
export const safety = true;

const flat = x => (x ?? '').replace(/\s+/g, ' ').trim();
const LOW = 'Treat the low first';
const BUTTONS = ['play', 'pause', 'nexttrack', 'previoustrack'];
/** The player moving: the controls only a running player has. */
const running = page => page.getByRole('main').getByRole('button', { name: /^(Pause|Next)$/ });
const handlers = page => page.evaluate(() => Object.keys(window.__acc.media ?? {}));
/** Where the stretch is, as it saved itself (src/session/persistence.ts). */
const progress = page => page.evaluate(() => {
  const raw = localStorage.getItem('fit-strong-90-stretch');
  if (!raw) return null;
  const { state } = JSON.parse(raw);
  return { status: state.status, index: state.index, activeMs: state.activeMs ?? 0 };
});
const same = (a, b) => !!a && !!b && a.status === b.status && a.index === b.index && a.activeMs === b.activeMs;

export const cases = [{
  name: 'stretch, 65 mg/dL, then 110 mg/dL',
  async run(t) {
    const page = await t.open({ seed: persona('P04'), route: '/home', media: true });
    let held;

    await t.step(1, 'P04 at 90 mg/dL: a stretch running, with earphone buttons', async () => {
      const sheet = await s.openCheckIn(t, 'stretch', 'move');
      await s.noneRightNow(sheet);
      await s.typeGlucose(sheet, '90', 'mg/dL');
      if (await ui.section(sheet, 'Blood pressure').count()) await s.typeBp(t, sheet, [[124, 78], [122, 76]]);
      if (await ui.section(sheet, 'Back and legs').count()) {
        await s.setPain(sheet, { back: 0, leg: 0, reach: 'Back' });
        await s.noneSince(sheet);
      }
      await s.noneElse(sheet);
      await s.sleepEnergy(sheet);
      await s.submit(sheet);
      await ui.tap(sheet.getByRole('button', { name: /^(Start stretch|Continue to stretch|Continue)$/ }));
      await ui.tap(page.getByRole('button', { name: 'Start', exact: true }));
      await page.getByRole('button', { name: 'Pause', exact: true }).waitFor();
      await t.advance(30_000);
      await t.must((await handlers(page)).includes('play'), `the session set no earphone Play: ${(await handlers(page)).join(', ')}`);
      await t.checkpoint('stretch-running');
    }, { input: 'P04, glucose 90 mg/dL, a stretch started' });

    await t.step(2, '“I feel low” → 65 mg/dL: the guidance stays, and earphone Play on it moves nothing', async () => {
      await ui.tap(page.getByRole('button', { name: 'I feel low', exact: true }));
      await page.getByText(LOW, { exact: true }).waitFor({ timeout: 15000 });
      await ui.type(page.getByRole('textbox', { name: 'Glucose now', exact: true }), '65');
      await ui.tap(page.getByRole('button', { name: 'Save this reading', exact: true }));
      await page.waitForTimeout(1000);
      await t.must(await page.getByText(LOW, { exact: true }).count() === 1, 'the low’s guidance left the screen after 65 mg/dL');
      held = await progress(page);
      await t.must(held?.status === 'paused', `the stretch saved itself as ${JSON.stringify(held)}, not paused`);
      await t.must(await rec.media(page, 'play'), 'the held session has no earphone Play to press: the hold can’t be shown to hold');
      await t.advance(10_000);
      const after = await progress(page);
      await t.checkpoint('held-after-play');
      await t.check(same(held, after), `earphone Play moved the run: ${JSON.stringify(held)} → ${JSON.stringify(after)}`);
      await t.check(await running(page).count() === 0, 'the player runs after earphone Play');
      await t.check(await page.getByText(LOW, { exact: true }).count() === 1, 'earphone Play took the guidance off the screen');
      // The session's own Resume, as a finger might find it (K8-13): absent, or it moves nothing.
      const resume = page.getByRole('main').getByRole('button', { name: 'Resume', exact: true });
      if (await resume.count()) {
        await ui.tap(resume.first());
        await t.advance(10_000);
        await t.check(same(held, await progress(page)), 'the session’s own Resume moved the run while the low holds');
      }
      await t.check(await running(page).count() === 0, 'the player runs after Resume');
    }, { input: 'I feel low; 65 mg/dL; earphone Play; Resume, if it is there' });

    await t.step(3, '“Leave, and come back later”: the guidance closes, its earphone buttons go, and a stray press moves nothing', async () => {
      await t.must(await rec.captureMedia(page, 'play'), 'no earphone Play to keep before leaving');
      const leave = page.getByRole('button', { name: 'Leave, and come back later', exact: true });
      await t.must(await leave.count() === 1, 'the low’s guidance has no way to leave it and come back');
      await ui.tap(leave);
      await page.waitForFunction(() => !location.hash.startsWith('#/session'), null, { timeout: 15000 });
      await t.ready();
      const left = (await handlers(page)).filter(a => BUTTONS.includes(a));
      await t.check(left.length === 0, `the session’s earphone buttons outlived it: ${left.join(', ')}`);
      await rec.pressCaptured(page);
      await t.advance(10_000);
      const after = await progress(page);
      await t.check(same(held, after), `a stray earphone press moved the run after it was left: ${JSON.stringify(held)} → ${JSON.stringify(after)}`);
      // The resume link a bookmark or Carry on gives (K8-13): still held, the run where it was.
      await t.goto('/session?resume=1');
      await t.ready();
      await t.advance(10_000);
      await t.check(same(held, await progress(page)), 'the resume link moved the run while the low holds');
      await t.check(await running(page).count() === 0, 'the resume link runs the player while the low holds');
      await hub.open(t, 'stretch');
      await t.check(!!(await hub.refusal(page)), 'the Stretch hub offers a start while the low holds');
      const starts = (await hub.card(page).getByRole('button').allInnerTexts()).map(flat).filter(l => hub.STARTERS.test(l));
      await t.check(starts.length === 0, `the Stretch hub offers ${JSON.stringify(starts)}`);
      await t.checkpoint('left-and-held');
    }, { input: 'Leave, and come back later; the earphones’ Play pressed again; /session?resume=1' });

    await t.step(4, 'Fifteen minutes on: 110 mg/dL, the symptoms gone → released, and Play moves the session again', async () => {
      await t.advanceMinutes(15);
      const sheet = await sb.openSheet(t, 'stretch');
      await ui.tap(ui.button(sheet, (await ui.button(sheet, 'Enter a new reading').count()) ? 'Enter a new reading' : 'Change answers'));
      await ui.answerCheckIn(t, sheet, { glucose: { value: '110', unit: 'mg/dL' }, lowRecovered: true });
      const answer = await sb.readSheet(sheet);
      await t.checkpoint('released');
      await t.must(answer.start, `110 mg/dL with the symptoms gone does not release the stretch: “${answer.title}” ${answer.bannerText}`);
      await ui.tap(sheet.getByRole('button', { name: sb.START }).first());
      await page.waitForURL(/#\/session/, { timeout: 15000 });
      await t.ready();
      await page.getByRole('main').getByRole('button', { name: /^(Start|Resume)$/ }).first().waitFor({ timeout: 15000 });
      await t.must(await rec.media(page, 'play'), 'the released session has no earphone Play');
      await page.getByRole('button', { name: 'Pause', exact: true }).waitFor({ timeout: 10000 });
      await t.advance(6_000);
      const moving = await progress(page);
      await t.check(moving?.status === 'running', `after the release, Play left the run ${JSON.stringify(moving)}`);
      await t.checkpoint('play-after-release');
    }, { input: '110 mg/dL at 9:15 am, symptoms gone' });
  },
}];
```

- [ ] **Step 2: Write** `scripts/e2e/acceptance/journeys/v22.mjs`

```js
/**
 * V-J22 (journey §17.2 #22, J§4.5): a dangerous reading while storage fails →
 * the guidance shows at once, the write fails → "Try saving again". Nothing
 * says "Saved". With space again, one tap saves it once. P03 on a
 * sulfonylurea, Glucose hub, 52 mg/dL (a serious low).
 */
import { persona } from '../fixtures/personas.mjs';
import { saveForm } from '../lib/data.mjs';
import * as hub from '../lib/hub.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J22';
export const title = 'A dangerous reading while storage fails: the guidance at once, and no “Saved”';
export const safety = true;

const MARK = 'acceptance-injected';
const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const guidanceOf = page => page.getByRole('dialog', { name: /^(Saved|What to do)$/ });
const lows = snap => (snap.observations ?? []).filter(o => o.kind === 'glucose' && o.value === 52);

export const cases = [{
  name: 'glucose 52 with every observation write refused',
  async run(t) {
    const page = await t.open({ seed: persona('P03'), route: '/home' });
    const main = page.getByRole('main');
    t.allowConsole(MARK);

    await t.step(1, 'Storage fails; Glucose hub → Add reading → 52 → Save', async () => {
      await hub.openHub(t, 'Glucose', '/hub/glucose');
      await t.setPageFaults([{ op: 'put', store: 'observations', action: 'quotaDom' }]);
      await ui.tap(ui.button(main, 'Add reading'));
      const form = page.getByRole('dialog', { name: 'Glucose' });
      await form.waitFor({ timeout: 10000 });
      await ui.type(form.getByRole('textbox', { name: 'Reading', exact: true }), '52');
      await t.must(await saveForm(t, form) === 'guidance', 'a reading of 52 showed no guidance while its write failed');
    }, { input: 'Glucose 52 mg/dL; every observation write refused (quota)' });

    await t.step(2, 'The guidance at once; “Not saved” and “Try saving again”; never “Saved”', async () => {
      const guidance = guidanceOf(page);
      await guidance.getByText(/Not saved/).first().waitFor({ timeout: 10000 });
      const text = flat(await guidance.innerText());
      await t.checkpoint('low-unsaved');
      await t.check(/This is a serious low\. Treat it now\./.test(text), `the guidance does not say “This is a serious low. Treat it now.”: ${text.slice(0, 300)}`);
      await t.check(/15 ?g/.test(text), `the treatment steps are missing: ${text.slice(0, 300)}`);
      await t.check(!/Saved on this device/.test(text), 'the guidance says Saved while the write failed');
      await t.check(await ui.button(guidance, 'Try saving again').count() === 1, 'no “Try saving again”');
      await t.check((await t.faultLog()).some(f => f.store === 'observations'), 'the write fault never fired');
      await t.check(lows(await t.db()).length === 0, 'the reading was stored despite the fault');
    });

    await t.step(3, 'Space again: “Try saving again” saves it once', async () => {
      await t.setPageFaults(null);
      const guidance = guidanceOf(page);
      await ui.tap(ui.button(guidance, 'Try saving again'));
      await guidance.getByText(/Saved on this device/).first().waitFor({ timeout: 10000 });
      const snap = await t.checkpoint('low-saved');
      await t.check(lows(snap).length === 1, `the reading is stored ${lows(snap).length} times`);
    });
  },
}];
```

- [ ] **Step 3: Write** `scripts/e2e/acceptance/journeys/v23.mjs`

```js
/**
 * V-J23 (journey §17.2 #23, J§4.4): a severe first blood pressure with the
 * second left empty → the guidance at once, not after the guided minute; the
 * first reading is kept and acts alone. P01, Blood pressure hub, 186/98.
 */
import { persona } from '../fixtures/personas.mjs';
import { saveForm } from '../lib/data.mjs';
import * as hub from '../lib/hub.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J23';
export const title = 'A severe first blood pressure with an empty second: guidance at once, the first kept';
export const safety = true;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const halves = snap => (snap.observations ?? []).filter(o => o.kind.startsWith('bloodPressure') && o.day === '2026-10-08');

export const cases = [{
  name: '186/98, second empty',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/home' });
    const main = page.getByRole('main');

    await t.step(1, 'BP hub → Add reading → 186/98 → Add a second reading, left empty', async () => {
      await hub.openHub(t, 'Blood pressure', '/hub/bp');
      await ui.tap(ui.button(main, 'Add reading'));
      const form = page.getByRole('dialog', { name: 'Blood pressure' });
      await form.waitFor({ timeout: 10000 });
      await ui.type(form.getByRole('textbox', { name: 'Top (systolic)', exact: true }), '186');
      await ui.type(form.getByRole('textbox', { name: 'Bottom (diastolic)', exact: true }), '98');
      await ui.tap(ui.button(form, 'Add a second reading'));
      await t.check(/Sit quietly\. Take the second reading in a minute\./.test(flat(await form.innerText())), 'the minute between readings is not guided');
      await t.checkpoint('first-severe');
    }, { input: '186/98; the second reading left empty' });

    await t.step(2, 'Save before the minute is up: the guidance now', async () => {
      const form = page.getByRole('dialog', { name: 'Blood pressure' });
      // No clock moves between the tap and the guidance: it never waits for the minute.
      await t.must(await saveForm(t, form) === 'guidance', 'a severe first reading saved without its guidance');
      const guidance = page.getByRole('dialog', { name: /^(Saved|What to do)$/ });
      const text = flat(await guidance.innerText());
      await t.checkpoint('severe-guidance');
      await t.check(/This reading is very high\./.test(text), `the guidance does not say “This reading is very high.”: ${text.slice(0, 300)}`);
      await guidance.getByText(/Saved on this device/).first().waitFor({ timeout: 10000 });
    });

    await t.step(3, 'The first reading is kept, whole and alone, and Home acts on it', async () => {
      const snap = await t.db();
      const h = halves(snap);
      await t.check(h.length === 2 && h.some(o => o.kind === 'bloodPressureSystolic' && o.value === 186) && h.some(o => o.kind === 'bloodPressureDiastolic' && o.value === 98),
        `stored: ${JSON.stringify(h.map(o => [o.kind, o.value]))}`);
      await t.check(new Set(h.map(o => o.context)).size === 1, 'the two numbers are not one reading');
      const guidance = page.getByRole('dialog', { name: /^(Saved|What to do)$/ });
      const now = ui.button(guidance, 'Yes, just now');
      if (await now.count()) await ui.tap(now);
      await ui.tap(ui.button(guidance, 'Done'));
      await ui.tab(page, 'Home');
      await t.check(!!(await hub.urgent(page)), 'Home shows no safety surface after a severe reading');
      await t.checkpoint('severe-home');
    });
  },
}];
```

- [ ] **Step 4: Write** `scripts/e2e/acceptance/journeys/v25.mjs`

```js
/**
 * V-J25 (journey §17.2 #25, B-30): Away (and B-30's Unwell variant), then back
 * to Normal → no "Carry on" while paused → the plan-shift offer → accept or
 * decline. J07 steps 5–6 prove the offer's dates; this proves a run saved
 * while paused isn't offered until the status is Normal again (D118). P01,
 * paused since 5 October; the stretch is started with "Start anyway".
 */
import { persona } from '../fixtures/personas.mjs';
import * as g from '../lib/guide.mjs';
import { docs } from '../lib/harness.mjs';
import * as hub from '../lib/hub.mjs';
import * as mv from '../lib/move.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J25';
export const title = 'Away or Unwell, then Normal: no Carry on while paused, then the plan-shift offer';
export const safety = false;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const PAUSED = { away: 'Paused while you’re away', unwell: 'Paused while you’re unwell' };
const CARRY_ON = /^(Continue|Check in & continue)/;

function pausedCase(kind, accept) {
  return {
    name: `${kind}, then Normal, ${accept ? 'accepting' : 'declining'} the shift`,
    async run(t) {
      const page = await t.open({ seed: persona('P01', { patch: { settings: { statusPeriods: [{ kind, from: '2026-10-05' }] } } }), route: '/home' });
      const main = page.getByRole('main');

      await t.step(1, `The Stretch hub while ${kind}: paused, with Change status and Start anyway`, async () => {
        await hub.open(t, 'stretch');
        const card = hub.card(page);
        const text = flat(await card.innerText());
        await t.checkpoint(`stretch-${kind}`);
        await t.check(text.includes(PAUSED[kind]), `the card reads “${text.slice(0, 200)}”, not “${PAUSED[kind]}”`);
        await t.check(await ui.button(card, 'Change status').count() === 1 && await ui.button(card, 'Start anyway').count() === 1, `the paused card's actions: ${text.slice(0, 200)}`);
      });

      await t.step(2, 'Start anyway → the check-in → a stretch → End session → Save and exit', async () => {
        await ui.tap(ui.button(hub.card(page), 'Start anyway'));
        const sheet = mv.checkInSheet(page);
        await sheet.waitFor({ timeout: 10000 });
        await ui.answerCheckIn(t, sheet, ui.normalAnswers('P01'));
        await ui.tap(mv.sheetStart(sheet));
        await ui.tap(main.getByRole('button', { name: 'Start', exact: true }));
        await t.advance(30_000);
        await ui.tap(main.getByRole('button', { name: 'End session', exact: true }));
        await ui.tap(page.getByRole('button', { name: 'Save and exit', exact: true }));
        await page.waitForTimeout(800);
        await t.must(!!(await page.evaluate(() => localStorage.getItem('fit-strong-90-stretch'))), 'no resumable stretch was saved');
      }, { input: 'normal check-in; a stretch for 30 s, saved part-way' });

      await t.step(3, `Still ${kind}: no Carry on, on Home or a hub`, async () => {
        await ui.tab(page, 'Home');
        const right = flat(await ui.rightNow(page).innerText());
        await t.check(!/Continue/.test(right), `while ${kind}, Home offers to carry on: “${right.slice(0, 200)}”`);
        for (const mode of ['stretch', 'guided']) {
          await hub.open(t, mode);
          const labels = (await hub.card(page).getByRole('button').allInnerTexts()).map(flat);
          await t.check(!labels.some(l => CARRY_ON.test(l)), `while ${kind}, the ${mode} hub offers ${JSON.stringify(labels)}`);
        }
        await t.checkpoint(`no-carry-on-${kind}`);
      });

      await t.step(4, `Back to normal → the shift offer → ${accept ? 'Move my plan back 3 days' : 'Keep my plan as it is'}`, async () => {
        await g.setStatus(t, 'Normal');
        const status = page.getByRole('dialog', { name: 'Status' });
        const scope = (await status.count()) ? status : main;
        const offer = flat(await scope.innerText());
        await t.check(/Move my plan back 3 days/.test(offer) && /Keep my plan as it is/.test(offer), `no 3-day shift offered: ${offer.slice(0, 200)}`);
        await ui.tap(ui.button(scope, accept ? 'Move my plan back 3 days' : 'Keep my plan as it is'));
        await page.waitForTimeout(500);
        const snap = await t.checkpoint(`after-offer-${kind}`);
        await t.check(docs(snap).settings?.startDate === (accept ? '2026-09-27' : '2026-09-24'), `startDate is ${docs(snap).settings?.startDate}`);
      });

      await t.step(5, 'Normal again: the stretch carries on', async () => {
        await hub.open(t, 'stretch');
        const go = hub.start(page);
        await t.check(await go.count() === 1 && CARRY_ON.test(flat(await go.innerText())), `the Stretch hub offers ${flat(await hub.card(page).innerText()).slice(0, 200)}`);
        await t.checkpoint(`carry-on-${kind}`);
      });
    },
  };
}

export const cases = [pausedCase('away', true), pausedCase('unwell', false)];
```

- [ ] **Step 5: Run them**

```bash
npm run e2e:acceptance -- --only=V-J21,V-J22,V-J23,V-J25
```

Expected: every case passes in all four projects. A failure shows the app falling short of the spec: fix the app, and change the journey only where it asks for something the spec doesn't.

- [ ] **Step 6: Commit**

```bash
git add scripts/e2e/acceptance/journeys/v21.mjs scripts/e2e/acceptance/journeys/v22.mjs scripts/e2e/acceptance/journeys/v23.mjs scripts/e2e/acceptance/journeys/v25.mjs
git commit -m "test: Add acceptance V-J21, V-J22, V-J23 and V-J25"
```

---

### Task 15: Acceptance V-J32, V-J36 and V-J38, with two real releases

**Files:**
- Create: `scripts/e2e/acceptance/journeys/v32.mjs`, `v36.mjs`, `v38.mjs`

**Interfaces:**
- Consumes: Task 12's `toast`, `toasts`, `undoIn`, `openRecentlyDeleted`, `offerUpdate`, `setWindows`, `setRestartDelay`, `swMessages`, `loads`, `updateLine`, `newerTab`, `dragSheetDown`, `open({ updates, visibility })`, `releaseServer`'s `use`, `broken`, `build`, `cache` and `entry`, and the page-side helpers in `lib/releases.mjs` (`controlled`, `installNext`, `hasWaiting`, `cacheNames`, `buildOf`, `mark`, `sameDocument`, `until`); `lib/data.mjs` (`logWater`, `transferDoc`, `obs`, `writeFixture`, `decodeBackup`, `backup`, `openData`, `chooseRestore`, `chooseAnother`, `waitOutcome`, `merge`, `sameSnapshot`, `saveForm`, `waitDb`); `docs` (`lib/harness.mjs`); `lib/hub.mjs`; Plan 7's `lib/food.mjs` (`meal`, `ROTI`); Plan 6's `lib/walk.mjs` (`openSetup`, `start`, `elapse`, `finish`, `walkObservations`); Task 8's words ("Recently deleted", `Restore <title>`); Task 7's toasts (`<what> deleted`, `<what> restored`, in place); Task 6's refusal (`HOLD_REFUSAL`, `MISTAKE_HINT`, "It was a mistake"); Task 4's refusals and "What a backup can hold"; Task 3's words for a newer copy; Task 2's update line ("An update is ready. It applies the next time FitStrong opens.", "Close FitStrong’s other windows to update now.", "Restart to update", "Restarting to update…", "Updated. FitStrong is on its latest version.", "Dismiss").
- Produces: three journeys. V-J38's first three cases run against the production preview (`preview: true`) with Task 12's driven worker; its fourth and tenth on the dev server; its fifth to ninth against two real releases (`releases: true`, D121), with their workers.

**What V-J38's cases prove** (J§21.2, B-21; D106, D107, D120; Codex P8R-07 to P8R-12, P8S-04, P8S-11, P8S-13 to P8S-15; Kiro K8-02, K8-03, K8-10):

| Case | Proves |
| --- | --- |
| 1 | A walk: nothing reloads, on screen or with the phone locked; Home names the update with no Restart while the walk is under way; the walk saved, Restart on Home reloads once, and "Updated" stays until it is dismissed |
| 2 | A typed form away from Home, closed by Close, Escape, a swipe, Save or Back, or left open with the phone locked, and the profile's edit cover with an answer changed: nothing reloads under any of them; Restart offered on Home and left untapped reloads nothing either |
| 3 | Another window of FitStrong open: "Close FitStrong’s other windows to update now." and no Restart; Restart once this is the only one; a window opened just before the tap stops it, and nothing reloads; with a slow worker, "Restarting to update…" covers the app at the tap, real taps and keys under it do nothing, and when the worker says no the cover goes with nothing written (P8S-13) |
| 4 | A newer copy takes the database: this copy lets go at once, says so in true words and saves nothing; the newer copy's upgrade given up as it began, Try again opens the database where it was (B-21's interrupted upgrade) |
| 5 | Two real releases: B installs whole and waits while a second window is open, both windows saying so; with both closed, FitStrong opened again is B, its migration run at its start, every record kept once, "Updated" on Home, and only B's cache left (P8S-14) |
| 6 | Two real releases: a walk holds the restart back; saved, Restart on Home reloads FitStrong's only window once onto B, the database and schema one up, the walk once |
| 7 | Two real releases: a release that fails to install leaves no cache, offers nothing and reloads nothing; the release in use opens a screen it hadn't loaded, offline, and saves |
| 8 | Two real releases: with B installed and waiting, every file of each under names its own bytes give, the window keeps its own: the walk's summary, never loaded, opens offline from A, and a reload offline brings A's own shell (P8R-10, P8R-12, P8S-15) |
| 9 | Two real releases: a first visit no worker controls starts a walk; A's first worker takes the page over with no reload, so B, deployed, waits behind it, and a new window opens on A, the database untouched, while the walk saves once (P8S-11) |
| 10 | Storage lost while the app runs: a newer copy upgrades the database under an open form; every screen stays, the form keeps its typed answer, the storage notice names the newer copy, a 52 typed and saved then still shows the low's guidance and the safety surface, with no "Saved", and nothing is written (P8S-04) |

**Reading the database while a newer tab is open.** An open at a higher version that is `blocked` holds every other open of the database, `t.db()`, `t.checkpoint()` and `t.step`'s own snapshot included, until it goes through or its tab closes. So case 4's and case 10's waits are one step each, with no snapshot inside them, and the newer tab is closed before anything is read.

- [ ] **Step 1: Write** `scripts/e2e/acceptance/journeys/v32.mjs`

```js
/**
 * V-J32 (journey §17.2 #32, B-04, B-05; D112, D119): two deletes in a row →
 * both Undo toasts stay, stacked → Undo the first → it returns under a fresh
 * id, its deletion record kept (B-05 supersedes "removed") → the day's total
 * is right. Leaving ends the other toast; Recently deleted still has it, and
 * its restore keeps the total right. And a serious low can't be deleted or
 * corrected while it holds the walk: refused in place, nothing changed, until
 * "It was a mistake" answers it as typed wrongly; then it goes with its Undo,
 * and comes back still answered (A-05, Codex P8-01, P8R-01, Kiro K8-07).
 * P01's water at 9:00 and 9:01; P03's 52 mg/dL, on a sulfonylurea.
 */
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import { content, docs } from '../lib/harness.mjs';
import * as hub from '../lib/hub.mjs';
import * as rec from '../lib/recovery.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J32';
export const title = 'Two deletes in a row, one Undo, and Recently deleted; a serious low can’t be deleted while it holds';
export const safety = true;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const waterOf = snap => (snap.observations ?? []).filter(o => o.kind === 'water').sort((a, b) => a.at.localeCompare(b.at));
const lowsOf = snap => (snap.observations ?? []).filter(o => o.kind === 'glucose' && o.value === 52);
const REFUSED = 'This reading is keeping movement on hold, so it can’t be changed or removed yet. If it was typed wrongly, choose ‘It was a mistake’.';
const MISTAKE = 'It was a mistake';

export const cases = [
  {
    name: 'water 250 ml twice, both entries deleted, one undone, one restored',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/day/today' });
      const main = page.getByRole('main');
      const waterRow = () => ui.row(ui.section(main, 'Day totals'), 'Water', 'link');
      let ids = [];

      const deleteCounting = async said => {
        await ui.tap(waterRow());
        await ui.heading(page, 'Water');
        await ui.tap(ui.row(main, 'Delete this entry'));
        await page.getByRole('heading', { level: 1, name: 'My Day', exact: true }).waitFor({ timeout: 15000 });
        await rec.toast(page, said).waitFor({ timeout: 10000 });
      };

      await t.step(1, 'Water 250 ml, and 250 ml more a minute later: 500 ml for the day', async () => {
        await data.logWater(t, 250);
        await t.advanceMinutes(1);
        await data.logWater(t, 250);
        const water = waterOf(await t.db());
        ids = water.map(o => o.id);
        await t.must(water.map(o => o.value).join(',') === '250,500', `water statements: ${water.map(o => o.value).join(', ')}`);
        await t.check(/500 ml/.test(flat(await waterRow().innerText())), 'the day total is not 500 ml');
      }, { input: 'Water 250 ml at 9:00, 250 ml more at 9:01' });

      await t.step(2, 'Delete the 500 ml entry, then the 250 ml one: each at once, each with its Undo', async () => {
        await deleteCounting('Water 500 ml deleted');
        await t.check(/250 ml/.test(flat(await waterRow().innerText())), 'after the 500 ml goes, the day does not count the 250 ml');
        await deleteCounting('Water 250 ml deleted');
        const shown = await rec.toasts(page);
        await t.checkpoint('two-undos');
        await t.check(shown.some(s => s.startsWith('Water 500 ml deleted')) && shown.some(s => s.startsWith('Water 250 ml deleted')), `both Undo toasts are not standing: ${JSON.stringify(shown)}`);
        const snap = await t.db();
        await t.check(waterOf(snap).length === 0, 'a water entry is still stored');
        await t.check(ids.every(id => (docs(snap).settings?.deleted?.observations ?? []).includes(id)), 'a deletion was not recorded (D-06)');
      });

      await t.step(3, 'Undo the 500 ml: back under a fresh id, its deletion record kept, said in its own toast; the other Undo still standing', async () => {
        await rec.undoIn(page, 'Water 500 ml deleted');
        await rec.toast(page, 'Water 500 ml restored').waitFor({ timeout: 10000 });
        await t.check(await rec.toast(page, 'Water 250 ml deleted').count() === 1, 'restoring one ended the other Undo (B-04)');
        const snap = await t.checkpoint('undo-500');
        const water = waterOf(snap);
        await t.check(water.length === 1 && water[0].value === 500 && water[0].restoredFrom === ids[1] && water[0].id !== ids[1], `after Undo: ${JSON.stringify(water.map(o => [o.id, o.value, o.restoredFrom]))}`);
        await t.check((docs(snap).settings?.deleted?.observations ?? []).includes(ids[1]), 'the original’s deletion record went (B-05)');
        await t.check(/500 ml/.test(flat(await waterRow().innerText())), 'the day total is not 500 ml after Undo');
        // Said until it is closed or its screen is left, never on a timer (K8-03).
        await t.advanceMinutes(5);
        await t.check(await rec.toast(page, 'Water 500 ml restored').count() === 1, '“Water 500 ml restored” went on a timer');
      });

      await t.step(4, 'Leave Today’s log: the remaining Undo ends; Recently deleted brings the 250 ml back, and 500 ml still counts', async () => {
        await ui.tab(page, 'Home');
        await t.check(await rec.toast(page, 'Water 250 ml deleted').count() === 0, 'the Undo outlived its screen (B-04)');
        await ui.legacyTab(page, 'Track');
        const sheet = await rec.openRecentlyDeleted(t);
        await t.checkpoint('recently-deleted');
        await ui.tap(sheet.getByRole('button', { name: 'Restore Water 250 ml', exact: true }));
        await sheet.getByText('Water 250 ml restored.', { exact: true }).waitFor({ timeout: 10000 });
        await ui.tap(ui.button(sheet, 'Close'));
        const snap = await t.checkpoint('restored-250');
        const water = waterOf(snap);
        await t.check(water.map(o => o.value).join(',') === '250,500' && water.every(o => o.restoredFrom), `after Restore: ${JSON.stringify(water.map(o => [o.value, o.restoredFrom]))}`);
        await t.check(/500 ml/.test(flat(await waterRow().innerText())), 'restoring the earlier entry changed the day total (Review Focus 2)');
      });
    },
  },
  {
    name: 'a serious low can’t be deleted or corrected while it holds; answered as typed wrongly, it goes, and comes back still answered (D119)',
    async run(t) {
      const page = await t.open({ seed: persona('P03'), route: '/home' });
      const main = page.getByRole('main');
      const SAID = 'Glucose 52 mg/dL';
      let first;

      const walkHeld = async when => {
        await hub.open(t, 'walk');
        const starts = (await hub.card(page).getByRole('button').allInnerTexts()).map(flat).filter(l => hub.STARTERS.test(l));
        await t.check(starts.length === 0, `${when}: the Walk hub offers ${JSON.stringify(starts)}`);
      };
      const openLow = async () => {
        await ui.legacyTab(page, 'Track');
        await ui.tap(ui.section(main, 'Records').getByRole('link').filter({ hasText: '52' }).first());
        await ui.heading(page, 'Glucose');
      };

      await t.step(1, 'Glucose hub → Add reading → 52: the serious low’s guidance, and the walk held', async () => {
        await hub.openHub(t, 'Glucose', '/hub/glucose');
        await ui.tap(ui.button(main, 'Add reading'));
        const form = page.getByRole('dialog', { name: 'Glucose' });
        await form.waitFor({ timeout: 10000 });
        await ui.type(form.getByRole('textbox', { name: 'Reading', exact: true }), '52');
        await t.must(await data.saveForm(t, form) === 'guidance', 'a reading of 52 showed no guidance');
        const guidance = page.getByRole('dialog', { name: /^(Saved|What to do)$/ });
        await guidance.getByText(/Saved on this device/).first().waitFor({ timeout: 10000 });
        await ui.tap(ui.button(guidance, 'Close'));
        await guidance.waitFor({ state: 'hidden' });
        await walkHeld('after the low');
        const snap = await t.checkpoint('low-saved');
        await t.must(lowsOf(snap).length === 1, `the 52 mg/dL reading is stored ${lowsOf(snap).length} times`);
        first = lowsOf(snap)[0].id;
      }, { input: 'Glucose 52 mg/dL' });

      await t.step(2, 'Delete this reading: refused in place, in words, with nothing deleted, no Undo and nothing in Recently deleted', async () => {
        await openLow();
        await ui.tap(ui.row(main, 'Delete this reading'));
        await main.getByText(REFUSED, { exact: true }).waitFor({ timeout: 10000 });
        await t.check(await main.getByRole('button', { name: MISTAKE, exact: true }).count() === 1, 'the refusal offers no “It was a mistake”');
        await t.check(await rec.toast(page, `${SAID} deleted`).count() === 0, 'an Undo was offered for a delete that was refused');
        const snap = await t.checkpoint('delete-refused');
        await t.check(lowsOf(snap).length === 1 && lowsOf(snap)[0].id === first, 'the 52 is not as it was');
        await t.check(!Object.keys(content(snap)).some(k => k.startsWith('recent:')), 'a refused delete left an entry in Recently deleted');
      });

      await t.step(3, 'Corrected to 152 instead: refused the same way, in the sheet; the 52 stays, and the walk is held', async () => {
        await ui.tap(ui.row(main, 'Correct this'));
        const sheet = page.getByRole('dialog').first();
        await sheet.waitFor({ timeout: 10000 });
        await ui.type(sheet.getByRole('textbox', { name: 'Value', exact: true }), '152');
        await ui.tap(ui.button(sheet, 'Save correction'));
        await sheet.getByText(REFUSED, { exact: true }).waitFor({ timeout: 10000 });
        await t.checkpoint('correction-refused');
        await t.check(lowsOf(await t.db()).length === 1, 'the correction went through');
        await ui.tap(ui.button(sheet, 'Close'));
        await walkHeld('after the refused correction');
      }, { input: '52 corrected to 152' });

      await t.step(4, 'It was a mistake: answered as typed wrongly, the delete goes through at once, with its Undo, and the walk is no longer held by the low', async () => {
        await openLow();
        await ui.tap(ui.row(main, 'Delete this reading'));
        await ui.tap(main.getByRole('button', { name: MISTAKE, exact: true }));
        await page.getByRole('heading', { level: 1, name: 'My Day', exact: true }).waitFor({ timeout: 15000 });
        await rec.toast(page, `${SAID} deleted`).waitFor({ timeout: 10000 });
        const snap = await t.checkpoint('answered-and-deleted');
        await t.check(lowsOf(snap).length === 0, 'the 52 is still stored after its answer and delete');
        const answers = (snap.checkIns ?? []).flatMap(c => c.resolutions ?? []);
        await t.check(answers.some(a => a.resolution === 'mistake' && a.readings.some(id => id.includes('52'))), `no answer names the 52 as typed wrongly: ${JSON.stringify(answers)}`);
        await hub.open(t, 'walk');
        const refusal = (await hub.refusal(page))?.text ?? '';
        await t.check(!/52|low/i.test(refusal), `the Walk hub still holds for the low: ${refusal}`);
      });

      await t.step(5, 'Its Undo ended with the screen; Recently deleted brings the 52 back under a fresh id, still answered, so the walk stays as the engine had it', async () => {
        await ui.legacyTab(page, 'Track');
        const sheet = await rec.openRecentlyDeleted(t);
        await ui.tap(sheet.getByRole('button', { name: `Restore ${SAID}`, exact: true }));
        await sheet.getByText(`${SAID} restored.`, { exact: true }).waitFor({ timeout: 10000 });
        await ui.tap(ui.button(sheet, 'Close'));
        const snap = await t.checkpoint('restored-answered');
        await t.check(lowsOf(snap).length === 1 && lowsOf(snap)[0].restoredFrom === first && lowsOf(snap)[0].id !== first, `after Restore: ${JSON.stringify(lowsOf(snap).map(o => [o.id, o.restoredFrom]))}`);
        // The answer names what was measured, not the row: the copy under its fresh id is still answered.
        await hub.open(t, 'walk');
        const refusal = (await hub.refusal(page))?.text ?? '';
        await t.check(!/52|low/i.test(refusal), `the restored 52, answered as typed wrongly, holds the walk again: ${refusal}`);
      });
    },
  },
];
```

- [ ] **Step 2: Write** `scripts/e2e/acceptance/journeys/v36.mjs`

```js
/**
 * V-J36 (journey §17.2 #36, B-26; D108): a malformed or oversized backup → a
 * specific refusal, with the data untouched → a valid file → merge, with each
 * collection's differing records named first. Six files past a published
 * limit, each refused in its own words before anything in it is read or
 * converted (Review Focus 5): a file too large to read, a small gzip that
 * unpacks past the limit, one enormous text, nesting no app writes, more
 * usual meals than a restore takes, and a backup from the previous version
 * past a count of its own. Me → Data lists the limits; and a record past one
 * backs up whole, saying a restore can't take it (Codex P8-15 to P8-18). J19
 * covers truncated files, bad gzip, other apps' files and unreadable records.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as food from '../lib/food.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J36';
export const title = 'A file past a published limit is refused in its own words; a valid one merges; a record past one backs up whole';
export const safety = false;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const MB = 1024 * 1024;
const AT = '2026-10-07T13:05:00.000+05:30';
const nested = levels => {
  let value = 1;
  for (let i = 0; i < levels; i++) value = [value];
  return value;
};
/** A file larger than a restore takes, made without writing its bytes: it must be refused by its size alone. */
function sparse(t, name, bytes) {
  const file = path.join(t.dir, 'fixtures', name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, 'w');
  fs.ftruncateSync(fd, bytes);
  fs.closeSync(fd);
  return file;
}
/** A backup from the previous version of the app (Settings → Export), as `limits.test.ts`'s fixture is. */
const legacy = over => ({
  version: 4,
  settings: {
    startDate: '2026-09-28', currentWeight: 82, targetGoal: 'Pain-free back', defaultRestSeconds: 90, useMetric: true, theme: 'system', onboardingComplete: true,
    gymDays: { monday: 'legs', tuesday: 'back', wednesday: 'rest', thursday: 'chest', friday: 'arms', saturday: 'core', sunday: 'rest' },
  },
  sessions: [], bodyMetrics: [], personalRecords: [], checkIns: [], focusOverrides: {},
  ...over,
});
const lifts = n => Array.from({ length: n }, (_, i) => ({ exerciseId: 'goblet-squat', weight: 20 + (i % 5), reps: 8, date: '2026-09-01', volume: 8 * (20 + (i % 5)) }));
const quick = name => ({ kind: 'quick', size: 'normal', name });

const REFUSALS = [
  {
    name: 'is larger than a restore takes',
    file: t => sparse(t, 'huge.json', 129 * MB),
    says: 'That file is too large to restore: it is 129 MB, and a restore takes at most 128 MB. Nothing was changed.',
  },
  {
    name: 'unpacks past 128 MB',
    file: t => data.writeFixture(t, 'bomb.json.gz', zlib.gzipSync(Buffer.alloc(129 * MB))),
    says: 'That file is too large to restore: it unpacks to over 128 MB, and a restore takes at most 128 MB. Nothing was changed.',
  },
  {
    name: 'holds a text 1,00,001 characters long',
    file: t => data.writeFixture(t, 'long-note.json', data.transferDoc({ observations: [data.obs({ id: 'g-long', kind: 'glucose', value: 110, at: '2026-10-07T08:00:00+05:30', note: 'x'.repeat(100_001) })] })),
    says: 'That file holds a text 1,00,001 characters long, and a restore takes none longer than 1,00,000. Nothing was changed.',
  },
  {
    name: 'nests deeper than this app writes',
    file: t => data.writeFixture(t, 'deep.json', data.transferDoc({ focusOverrides: { '2026-10-07': nested(40) } })),
    says: 'That file is built in a way this app never writes. Nothing was changed.',
  },
  {
    name: 'holds more usual meals than a restore takes',
    file: t => data.writeFixture(t, 'usual.json', data.transferDoc({ stores: ['meals', 'savedMeals', 'customFoods'], records: { meals: [], savedMeals: new Array(10_001).fill({}), customFoods: [] } })),
    says: 'That file holds 10,001 usual meals, and a restore takes at most 10,000. Nothing was changed.',
  },
  {
    name: 'is the previous version’s backup, past a count of its own',
    file: t => data.writeFixture(t, 'legacy.json', legacy({ personalRecords: lifts(10_001) })),
    says: 'That file holds 10,001 personal records, and a restore takes at most 10,000. Nothing was changed.',
  },
];

export const cases = [
  {
    name: 'the published limits, six hostile files, then a valid one',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home' });
      let before;
      let sheet;

      await t.step(1, 'Me → Data → What a backup can hold: every limit, in Indian grouping', async () => {
        const main = await data.openData(t);
        await ui.tap(ui.row(main, 'What a backup can hold'));
        const limits = page.getByRole('dialog', { name: 'What a backup can hold' });
        await limits.waitFor();
        const text = flat(await limits.innerText());
        await t.checkpoint('limits');
        for (const line of ['File size 128 MB, packed or unpacked', 'Readings 10,00,000', 'Usual meals 10,000', 'Route points, all routes together 50,00,000', 'Longest single text 1,00,000 characters']) {
          await t.check(text.includes(line), `“What a backup can hold” lacks “${line}”: ${text.slice(0, 300)}`);
        }
        await ui.tap(ui.button(limits, 'Close'));
      });

      await t.step(2, 'A glucose reading of this phone’s own, then the record as it stands', async () => {
        await data.logGlucose(t, { value: 118 });
        before = await t.checkpoint('before-files');
      }, { input: 'Glucose 118 mg/dL' });

      for (const [i, r] of REFUSALS.entries()) {
        await t.step(3 + i, `A file that ${r.name}: refused in its own words, nothing changed`, async () => {
          const file = r.file(t);
          if (i === 0) sheet = await data.chooseRestore(t, file);
          else await data.chooseAnother(t, sheet, file);
          await data.waitOutcome(t, sheet);
          const text = flat(await sheet.innerText());
          await t.checkpoint(`refused-${i + 1}`);
          await t.check(text.includes(r.says), `the refusal reads “${text.slice(0, 300)}”, not “${r.says}”`);
          const diffs = data.sameSnapshot(before, await t.db());
          await t.check(diffs.length === 0, `the record changed: ${diffs.slice(0, 5).join(' | ')}`);
        }, { input: r.name });
      }

      await t.step(9, 'A valid file: this phone’s reading with another figure, a meal, a usual meal and an own food → each named → Merge', async () => {
        const mine = (before.observations ?? []).find(o => o.kind === 'glucose' && o.value === 118);
        await t.must(!!mine, 'the 118 mg/dL reading is not stored');
        const valid = data.transferDoc({
          observations: [{ ...mine, value: 121 }],
          stores: ['meals', 'savedMeals', 'customFoods'],
          records: {
            meals: [food.meal('meal-from-file', AT, 'lunch', [food.ROTI], 'meals')],
            savedMeals: [{ id: 'usual-from-file', name: 'Weekday lunch', items: [quick('Normal plate')], savedAt: AT, updatedAt: AT }],
            customFoods: [{ id: 'food-from-file', name: 'Bhel puri', per: { qty: 1, unit: 'plate' }, createdAt: AT, updatedAt: AT }],
          },
        });
        await data.chooseAnother(t, sheet, data.writeFixture(t, 'valid.json', valid));
        const differ = ui.section(sheet, 'Records that differ');
        await differ.waitFor({ timeout: 10000 });
        const differs = flat(await differ.innerText());
        const holds = flat(await ui.section(sheet, 'In this file').innerText());
        await t.checkpoint('valid-preview');
        await t.check(/Readings\s*1/.test(differs), `“Records that differ” does not name the readings: ${differs.slice(0, 200)}`);
        for (const line of ['Meals 1', 'Usual meals 1', 'Own foods 1']) await t.check(holds.includes(line), `“In this file” lacks “${line}”: ${holds.slice(0, 300)}`);
        await data.merge(t, sheet);
        const snap = await t.checkpoint('merged');
        await t.check(/Merged\./.test(flat(await sheet.innerText())), 'the merge did not say Merged.');
        const glucose = (snap.observations ?? []).filter(o => o.id === mine.id);
        await t.check(glucose.length === 1 && glucose[0].value === 118, `the merge did not keep this phone’s reading: ${JSON.stringify(glucose.map(o => o.value))}`);
        for (const [store, id] of [['meals', 'meal-from-file'], ['savedMeals', 'usual-from-file'], ['customFoods', 'food-from-file']]) {
          await t.check((snap[store] ?? []).some(r => r.id === id), `the file’s ${id} was not added`);
        }
      }, { input: 'the same reading at 121 mg/dL; a lunch, a usual meal and an own food' });
    },
  },
  {
    name: 'a record past a limit backs up whole, and says a restore can’t take it',
    async run(t) {
      await t.open({ seed: persona('P01', { patch: { personalRecords: lifts(10_001) } }), route: '/home' });
      let made;

      await t.step(1, 'Back up your record: the warning, and every personal record in the file', async () => {
        made = await data.backup(t);
        await t.checkpoint('backed-up');
        const warning = 'This backup holds everything, but it holds 10,001 personal records, and a restore takes at most 10,000, so this version of the app can’t restore it. Keep it: nothing was left out of it.';
        await t.check(made.said.includes(warning), `the backup sheet does not warn: ${made.said.slice(0, 400)}`);
        await t.must(made.bytes?.length > 0, `no backup left the app (${made.via})`);
        await t.check(data.decodeBackup(made.bytes).personalRecords?.length === 10_001, 'the backup left personal records out (D108)');
      }, { input: '10,001 personal records on this phone' });

      await t.step(2, 'That backup, restored: refused in its own words, nothing changed', async () => {
        const before = await t.db();
        const sheet = await data.chooseRestore(t, data.writeFixture(t, made.name ?? 'backup.json.gz', made.bytes));
        await data.waitOutcome(t, sheet);
        const text = flat(await sheet.innerText());
        await t.checkpoint('own-backup-refused');
        await t.check(text.includes('That file holds 10,001 personal records, and a restore takes at most 10,000. Nothing was changed.'), `the refusal reads “${text.slice(0, 300)}”`);
        const diffs = data.sameSnapshot(before, await t.db());
        await t.check(diffs.length === 0, `the record changed: ${diffs.slice(0, 5).join(' | ')}`);
      });
    },
  },
];
```


- [ ] **Step 3: Write** `scripts/e2e/acceptance/journeys/v38.mjs`

```js
/**
 * V-J38 (journey §17.2 #38, J§21.2, B-21; D106, D107, D120, D121): an app
 * update arriving during a walk → the task is preserved; nothing reloads by
 * itself, and the update applies when FitStrong opens again, or at the
 * person's own Restart on Home once nothing is under way; the next Home says
 * "Updated" until it is dismissed. The same for a typed form however it
 * closes and for the profile's edit cover; another window holds the restart
 * back. Then B-21's two copies and an interrupted upgrade, and two real
 * releases served at one origin with their workers: one waiting while a
 * second window is open, a walk holding the restart, a release that fails to
 * install, a window keeping its own release's files, offline, and a first
 * visit taken over by its release's first worker; then storage lost while the
 * app runs, read-only. Storage full during a log is J17 steps 1–2 and V-J03's
 * refused save (D118).
 */
import { MINUTE } from '../lib/env.mjs';
import { docs } from '../lib/harness.mjs';
import * as data from '../lib/data.mjs';
import * as rec from '../lib/recovery.mjs';
import * as rel from '../lib/releases.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';
import { persona } from '../fixtures/personas.mjs';

export const id = 'V-J38';
export const title = 'An update waits for FitStrong’s windows, never reloads by itself, and two real releases hand over cleanly';
export const safety = false;

const READY = 'An update is ready. It applies the next time FitStrong opens.';
const CLOSE_OTHERS = 'Close FitStrong’s other windows to update now.';
const UPDATED = 'Updated. FitStrong is on its latest version.';
const RESTARTING = 'Restarting to update…';
const STALE_TITLE = 'A newer version of FitStrong is open';
const STALE = 'FitStrong is open somewhere else with a newer version. Close this window and open FitStrong again.';
const WORKERS = { contextOptions: { serviceWorkers: 'allow' } };
const walksIn = snap => new Set(walk.walkObservations(snap).filter(o => o.kind === 'walkDuration').map(o => o.context));
const homeTab = page => ui.link(page.getByRole('navigation', { name: 'Main' }), 'Home');
const restart = page => page.getByRole('main').getByRole('button', { name: 'Restart to update', exact: true });
const restarts = async page => (await rec.swMessages(page)).filter(m => m === 'restart').length;
const appCaches = async page => (await rel.cacheNames(page)).filter(n => n.startsWith('fitstrong-'));

/** Every reading and session from before still there, and nothing added but the walk's: an update keeps each record once (P8-21). */
function keptOnce(before, after) {
  const was = new Set((before.observations ?? []).map(o => o.id));
  const now = after.observations ?? [];
  const gone = [...was].filter(id => !now.some(o => o.id === id));
  const extra = now.filter(o => !was.has(o.id) && !o.context?.startsWith('walk:'));
  const sessions = (after.sessions ?? []).length - (before.sessions ?? []).length;
  return [...gone.map(id => `${id} is gone`), ...extra.map(o => `${o.id} (${o.kind}) appeared`), ...(sessions ? [`${sessions} sessions more`] : [])];
}

/** Browse → Glucose → Add reading, with `value` typed: a form with an answer, away from Home. */
async function typedOnHub(page, value) {
  const main = page.getByRole('main');
  if (!(await page.getByRole('heading', { level: 1, name: 'Glucose', exact: true }).count())) {
    await ui.tab(page, 'Browse');
    await ui.tap(main.getByRole('link', { name: 'Glucose', exact: true }));
    await ui.heading(page, 'Glucose');
  }
  await ui.tap(ui.button(main, 'Add reading'));
  const form = page.getByRole('dialog', { name: 'Glucose' });
  await form.waitFor({ timeout: 10000 });
  await ui.type(form.getByRole('textbox', { name: 'Reading', exact: true }), value);
  return form;
}

/** The phone locked, and opened again. */
async function lockAndReturn(page) {
  await page.evaluate(() => window.__acc.setVisibility('hidden'));
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__acc.setVisibility('visible'));
  await page.waitForTimeout(800);
}

export const cases = [
  {
    name: 'an update during a walk: nothing reloads, Home names it, and Restart waits for the walk',
    preview: true,
    async run(t) {
      const page = await t.open({ seed: persona('P03'), route: '/home', updates: true, visibility: true });
      const main = page.getByRole('main');

      await t.step(1, 'A walk under way, and a new version installed', async () => {
        await walk.openSetup(t);
        await walk.start(t, ui.normalAnswers('P03'));
        await rec.offerUpdate(page);
        await page.waitForTimeout(500);
      });

      await t.step(2, 'On screen and with the phone locked: nothing reloads, and nothing asks the new version to take over', async () => {
        await lockAndReturn(page);
        await walk.elapse(t, 2 * MINUTE);
        await t.check(await rec.loads(page) === 1, 'the page reloaded during the walk');
        await t.check(await restarts(page) === 0, 'the page asked the new version to take over during the walk');
        await t.checkpoint('walk-held-update');
      });

      await t.step(3, 'Home while the walk is still under way: the update named, with no Restart', async () => {
        await t.goto('/home');
        await t.ready();
        await main.getByText(READY, { exact: true }).waitFor({ timeout: 10000 });
        await t.check(await restart(page).count() === 0, 'Home offers Restart while the walk is under way');
        await t.goto('/walk/live');
        await t.ready();
      });

      await t.step(4, 'The walk saved: Restart on Home; tapped, the page reloads once, and Home says Updated until it is dismissed', async () => {
        await walk.finish(t);
        await ui.tap(ui.button(main, 'Save walk'));
        await page.getByText('Saved on this device', { exact: true }).waitFor({ timeout: 10000 });
        await ui.tap(ui.button(main, 'Done'));
        await ui.tap(homeTab(page));
        await restart(page).waitFor({ timeout: 10000 });
        await t.check(await rec.loads(page) === 1, 'the page reloaded before Restart was tapped');
        const reloaded = page.waitForEvent('load', { timeout: 20000 });
        await ui.tap(restart(page));
        await reloaded;
        await t.ready();
        await t.check(await rec.loads(page) === 2, `the page loaded ${await rec.loads(page)} times`);
        await page.getByText(UPDATED, { exact: true }).waitFor({ timeout: 10000 });
        await t.advanceMinutes(5);
        await t.check(await page.getByText(UPDATED, { exact: true }).count() === 1, '“Updated” went on a timer (K8-03)');
        const snap = await t.checkpoint('updated-home');
        await t.check(walksIn(snap).size === 1, `the walk is saved ${walksIn(snap).size} times`);
        await ui.tap(ui.button(main, 'Dismiss'));
        await t.check(await page.getByText(UPDATED, { exact: true }).count() === 0, 'Dismiss left “Updated” on Home');
      });
    },
  },
  {
    name: 'a typed form away from Home, and the profile’s edit cover: nothing reloads under them, however they close or the phone locks',
    preview: true,
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home', updates: true, visibility: true });
      const reading = form => form.getByRole('textbox', { name: 'Reading', exact: true });
      const stored = snap => (snap.observations ?? []).filter(o => o.kind === 'glucose' && [118, 119, 121, 124, 130].includes(o.value)).map(o => o.value);
      const nothingMoved = async how => {
        await page.waitForTimeout(1500);
        await t.check(await rec.loads(page) === 1, `${how}: the page reloaded`);
        await t.check(await restarts(page) === 0, `${how}: the page asked the new version to take over`);
      };

      await t.step(1, 'Browse → Glucose → Add reading → 118 typed; a new version installed; the phone locked and opened: nothing moves, and the answer stays', async () => {
        const form = await typedOnHub(page, '118');
        await rec.offerUpdate(page);
        await lockAndReturn(page);
        await nothingMoved('with the form open');
        await t.check(await reading(form).inputValue() === '118', `the typed answer is now “${await reading(form).inputValue()}”`);
        await t.checkpoint('form-open-update-waiting');
      }, { input: 'Glucose 118 typed, not saved' });

      await t.step(2, 'Closed with Close, with Escape and with a swipe down: nothing moves', async () => {
        let form = page.getByRole('dialog', { name: 'Glucose' });
        await ui.tap(ui.button(form, 'Close'));
        await form.waitFor({ state: 'hidden' });
        await nothingMoved('closed with Close');
        form = await typedOnHub(page, '119');
        await page.keyboard.press('Escape');
        await form.waitFor({ state: 'hidden' });
        await nothingMoved('closed with Escape');
        form = await typedOnHub(page, '121');
        await rec.dragSheetDown(page, form);
        await form.waitFor({ state: 'hidden', timeout: 5000 });
        await nothingMoved('closed with a swipe');
      }, { input: '119 and 121 typed, each closed unsaved' });

      await t.step(3, 'Saved: the one reading stored, and nothing moves', async () => {
        const form = await typedOnHub(page, '124');
        await t.must(await data.saveForm(t, form) === 'closed', 'the reading did not save');
        await nothingMoved('after Save');
        const snap = await t.checkpoint('saved-on-hub');
        await t.check(stored(snap).join(',') === '124', `stored: ${stored(snap).join(', ')}`);
      }, { input: 'Glucose 124 saved' });

      await t.step(4, 'Left by the browser’s Back with an answer typed: Browse, and nothing moves', async () => {
        const form = await typedOnHub(page, '130');
        await page.goBack();
        await form.waitFor({ state: 'hidden', timeout: 10000 });
        await ui.heading(page, 'Browse');
        await nothingMoved('left by Back');
      }, { input: '130 typed, then Back' });

      await t.step(5, 'Home: Restart offered; left untapped, with the phone locked and opened, nothing reloads (K8-10)', async () => {
        await ui.tap(homeTab(page));
        await restart(page).waitFor({ timeout: 10000 });
        await lockAndReturn(page);
        await nothingMoved('Restart left untapped');
        await t.checkpoint('restart-offered');
      });

      await t.step(6, 'Me → Profile → Edit: an answer changed in the cover, the phone locked and opened: nothing reloads, and the answer stays (K8-02)', async () => {
        await t.goto('/me/profile');
        await t.ready();
        await ui.tap(page.getByRole('main').getByRole('button', { name: /^Edit / }).first());
        const cover = page.getByRole('dialog', { name: 'Edit your answers' });
        await cover.waitFor({ timeout: 10000 });
        const box = cover.getByRole('textbox').first();
        await ui.type(box, '7');
        const typed = await box.inputValue();
        await lockAndReturn(page);
        await nothingMoved('with the profile’s edit cover open');
        await t.check(await box.inputValue() === typed, `the cover’s answer is now “${await box.inputValue()}”, not “${typed}”`);
        await t.checkpoint('profile-cover-held');
      }, { input: 'A profile answer changed, not saved' });
    },
  },
  {
    name: 'another window open: Home says to close it, and Restart only once this is the only one',
    preview: true,
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home', updates: true, visibility: true });
      const main = page.getByRole('main');

      await t.step(1, 'A new version, with FitStrong open in another window: Close FitStrong’s other windows, and no Restart', async () => {
        await rec.setWindows(page, 2);
        await rec.offerUpdate(page);
        await main.getByText(CLOSE_OTHERS, { exact: true }).waitFor({ timeout: 10000 });
        await t.check((await rec.updateLine(page))?.text.startsWith(READY), 'the update line does not say an update is ready');
        await t.check(await restart(page).count() === 0, 'Restart is offered with another window open');
        await t.checkpoint('other-window');
      });

      await t.step(2, 'The other window closed, and back to the app: Restart', async () => {
        await rec.setWindows(page, 1);
        await lockAndReturn(page);
        await restart(page).waitFor({ timeout: 10000 });
        await t.check(await main.getByText(CLOSE_OTHERS, { exact: true }).count() === 0, 'Home still asks for other windows to close');
      });

      await t.step(3, 'Another window opened just before the tap: the worker says so, nothing reloads, and Home asks for it to be closed', async () => {
        await rec.setWindows(page, 2);
        await ui.tap(restart(page));
        await main.getByText(CLOSE_OTHERS, { exact: true }).waitFor({ timeout: 10000 });
        await page.waitForTimeout(1000);
        await t.check(await rec.loads(page) === 1, 'the page reloaded with another window open');
        await t.check(await restarts(page) === 1, `the page asked to restart ${await restarts(page)} times`);
        await t.check(await restart(page).count() === 0, 'Restart is still offered with another window open');
      });

      await t.step(4, 'A slow worker, and Restart tapped: “Restarting to update…” covers the app, real taps and keys under it do nothing, and when another window opens before it answers, the cover goes with nothing written (P8S-13)', async () => {
        await rec.setWindows(page, 1);
        await lockAndReturn(page);
        await restart(page).waitFor({ timeout: 10000 });
        await rec.setRestartDelay(page, 1500);
        const before = await t.checkpoint('before-slow-restart');
        await ui.tap(restart(page));
        const cover = page.getByRole('alertdialog', { name: RESTARTING });
        await cover.waitFor({ timeout: 5000 });
        // Real taps where the Browse tab is, and the keyboard: the cover takes them all.
        const browse = await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Browse' }).boundingBox();
        await page.mouse.click(browse.x + browse.width / 2, browse.y + browse.height / 2);
        await page.keyboard.press('Tab');
        await page.keyboard.press('Enter');
        await t.check(await page.evaluate(() => location.hash) === '#/home', 'a tap under the cover left Home');
        // Another window opens before the worker answers: it says no.
        await rec.setWindows(page, 2);
        await cover.waitFor({ state: 'hidden', timeout: 10000 });
        await main.getByText(CLOSE_OTHERS, { exact: true }).waitFor({ timeout: 10000 });
        await t.check(await rec.loads(page) === 1, 'the page reloaded though the worker said no');
        const diffs = data.sameSnapshot(before, await t.checkpoint('after-slow-restart'));
        await t.check(diffs.length === 0, `something was written under the cover: ${diffs.slice(0, 3).join(' | ')}`);
      });
    },
  },
  {
    name: 'a newer copy takes the database: this one says so and saves nothing; its upgrade given up, Try again opens it here again',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home' });
      let before;
      let saw = '';

      await t.step(1, 'Water 250 ml saved, at this build’s database version', async () => {
        await data.logWater(t, 250);
        before = await t.checkpoint('before-newer');
      });

      // One step for the whole wait (see "Reading the database while a newer tab is open").
      await t.step(2, 'A newer copy opens the database one version up, and gives the upgrade up as it begins: this one lets go at once, and says so in true words', async () => {
        const newer = await rec.newerTab(t, before.version + 1);
        try {
          await page.bringToFront();
          await page.getByText(STALE_TITLE, { exact: true }).waitFor({ timeout: 15000 });
          await t.check(await page.getByText(STALE, { exact: false }).count() >= 1, 'the words don’t say to close this window and open FitStrong again');
          saw = (await newer.seen()).join(',');
        } finally {
          await newer.page.close();
        }
        await t.check(saw === 'upgrade,aborted', `the newer copy saw ${saw}`);
      });

      await t.step(3, 'Try again: one reload, the database where it was, every record kept, and a new entry saves', async () => {
        const reloaded = page.waitForEvent('load', { timeout: 20000 });
        await ui.tap(page.getByRole('button', { name: 'Try again', exact: true }));
        await reloaded;
        await t.ready();
        const snap = await t.checkpoint('after-try-again');
        await t.check(snap.version === before.version, `the database is at version ${snap.version}, not ${before.version}`);
        const lost = keptOnce(before, snap);
        await t.check(lost.length === 0, `records not kept once: ${lost.slice(0, 5).join('; ')}`);
        await data.logWater(t, 250);
        await data.waitDb(t, s => (s.observations ?? []).filter(o => o.kind === 'water').length === 2, 'the second entry was not saved after Try again');
      });
    },
  },
  {
    name: 'two real releases: the new one waits while a second window is open, and applies the next time FitStrong opens',
    releases: true,
    async run(t, { releases }) {
      releases.use('A');
      const page = await t.open({ seed: persona('P01'), route: '/home', ...WORKERS });
      let before;
      let second;

      await t.step(1, 'Release A in charge of two windows', async () => {
        await rel.controlled(page);
        before = await t.checkpoint('release-a');
        second = await t.newPage();
        await second.goto(`${t.base}#/home`);
        await rel.controlled(second);
        await rel.mark(page);
        await rel.mark(second);
        await t.check(await rel.buildOf(page) === releases.build('A'), 'the first window doesn’t run release A');
      });

      await t.step(2, 'Release B deployed: it installs whole and waits; both windows say so, with Close FitStrong’s other windows, and neither reloads', async () => {
        releases.use('B');
        await t.must(await rel.installNext(page) === 'installed', 'release B did not install');
        for (const w of [page, second]) {
          await w.bringToFront();
          await w.getByText(CLOSE_OTHERS, { exact: true }).waitFor({ timeout: 20000 });
          await t.check(await restart(w).count() === 0, 'Restart is offered with another window open');
        }
        await page.waitForTimeout(3000);
        await t.check(await rel.hasWaiting(page), 'release B took over with a window of release A open');
        await t.check(await rel.sameDocument(page) && await rel.sameDocument(second), 'a window reloaded for a release that is waiting');
        await t.checkpoint('b-waiting', { page });
      });

      await t.step(3, 'Both windows closed, and FitStrong opened again: release B, its migration run at its start, every record kept once, and Updated on Home', async () => {
        await second.close();
        await page.goto('about:blank');
        await page.goto(`${t.base}#/home`);
        await t.ready();
        await t.check(await rel.buildOf(page) === releases.build('B'), 'FitStrong opened again isn’t release B');
        await t.check(JSON.stringify(await appCaches(page)) === JSON.stringify([releases.cache('B')]), `the caches left are ${JSON.stringify(await appCaches(page))}`);
        const snap = await t.checkpoint('release-b');
        await t.check(snap.version === before.version + 1, `the database is at version ${snap.version}, not ${before.version + 1}`);
        await t.check(docs(snap).schemaVersion === docs(before).schemaVersion + 1, `the schema is ${docs(snap).schemaVersion}`);
        const lost = keptOnce(before, snap);
        await t.check(lost.length === 0, `records not kept once: ${lost.slice(0, 5).join('; ')}`);
        await page.getByText(UPDATED, { exact: true }).waitFor({ timeout: 20000 });
      });
    },
  },
  {
    name: 'two real releases: FitStrong’s only window restarts onto the new one from Home, once its walk is saved',
    releases: true,
    async run(t, { releases }) {
      releases.use('A');
      const page = await t.open({ seed: persona('P03'), route: '/home', ...WORKERS });
      const main = page.getByRole('main');
      let before;

      await t.step(1, 'Release A in charge; a walk under way', async () => {
        await rel.controlled(page);
        before = await t.checkpoint('release-a');
        await walk.openSetup(t);
        await walk.start(t, ui.normalAnswers('P03'));
        await rel.mark(page);
      });

      await t.step(2, 'Release B deployed: it installs and waits; the walk carries on; Home mid-walk names the update, with no Restart', async () => {
        releases.use('B');
        await t.must(await rel.installNext(page) === 'installed', 'release B did not install');
        await walk.elapse(t, MINUTE);
        await t.check(await rel.hasWaiting(page), 'release B took over during the walk');
        await t.check(await rel.sameDocument(page), 'the walking window reloaded during the walk');
        await t.goto('/home');
        await t.ready();
        await main.getByText(READY, { exact: true }).waitFor({ timeout: 20000 });
        await t.check(await restart(page).count() === 0, 'Restart is offered while the walk is under way');
        await t.goto('/walk/live');
        await t.ready();
      }, { input: 'release B deployed mid-walk' });

      await t.step(3, 'The walk saved; Restart on Home: one reload onto release B, the database and schema one up, the walk once, every record kept, and Updated', async () => {
        await walk.finish(t);
        await ui.tap(ui.button(main, 'Save walk'));
        await page.getByText('Saved on this device', { exact: true }).waitFor({ timeout: 10000 });
        await ui.tap(ui.button(main, 'Done'));
        await ui.tap(homeTab(page));
        await restart(page).waitFor({ timeout: 20000 });
        const reloaded = page.waitForEvent('load', { timeout: 30000 });
        await ui.tap(restart(page));
        await reloaded;
        await t.ready();
        await t.check(!(await rel.sameDocument(page)), 'Restart didn’t reload the window');
        await t.check(await rel.buildOf(page) === releases.build('B'), 'the window isn’t on release B after Restart');
        const snap = await t.checkpoint('release-b');
        await t.check(snap.version === before.version + 1, `the database is at version ${snap.version}`);
        await t.check(docs(snap).schemaVersion === docs(before).schemaVersion + 1, `the schema is ${docs(snap).schemaVersion}`);
        await t.check(walksIn(snap).size === 1, `the walk is saved ${walksIn(snap).size} times`);
        const lost = keptOnce(before, snap);
        await t.check(lost.length === 0, `records not kept once: ${lost.slice(0, 5).join('; ')}`);
        await page.getByText(UPDATED, { exact: true }).waitFor({ timeout: 20000 });
      });
    },
  },
  {
    name: 'two real releases: one that fails to install changes nothing, and the release in use works whole, offline too',
    releases: true,
    async run(t, { releases }) {
      releases.use('A');
      releases.broken('A', 'A2');
      const page = await t.open({ seed: persona('P01'), route: '/home', ...WORKERS });

      await t.step(1, 'Release A, its worker in charge', async () => {
        await rel.controlled(page);
        await rel.mark(page);
      });

      await t.step(2, 'A release with a file missing: its install fails, its cache goes, nothing is offered, and nothing reloads', async () => {
        releases.use('A2');
        await t.must(await rel.installNext(page) === 'redundant', 'a release with a missing file installed');
        await page.waitForTimeout(1500);
        await t.check(!(await rel.hasWaiting(page)), 'a broken release waits to take over');
        await t.check(!(await rel.cacheNames(page)).includes(releases.cache('A2')), 'the failed install left its cache behind (D120)');
        await t.check(await rel.sameDocument(page), 'the page reloaded for a release that never installed');
        await t.check(await rec.updateLine(page) === undefined, 'Home offers an update that never installed');
      });

      await t.step(3, 'Offline, release A opens a screen it hadn’t loaded, and saves', async () => {
        await t.context.setOffline(true);
        try {
          await t.goto('/me/data');
          await ui.heading(page, 'Data');
          await t.checkpoint('offline-unloaded-screen');
          await t.goto('/day/today');
          await data.logWater(t, 250);
          await data.waitDb(t, s => (s.observations ?? []).some(o => o.kind === 'water' && o.value === 250), 'release A could not save offline');
        } finally {
          await t.context.setOffline(false);
        }
        await t.check(await rel.buildOf(page) === releases.build('A'), 'the window left release A');
      });
    },
  },
  {
    name: 'two real releases: a window keeps its own release, its shell and unloaded screens, after a newer one installs, offline too',
    releases: true,
    async run(t, { releases }) {
      releases.use('A');
      const page = await t.open({ seed: persona('P03'), route: '/home', ...WORKERS });
      const main = page.getByRole('main');
      const entry = () => page.evaluate(() => document.querySelector('script[type="module"][src]')?.getAttribute('src'));

      await t.step(1, 'Release A in charge; a walk under way', async () => {
        await rel.controlled(page);
        await walk.openSetup(t);
        await walk.start(t, ui.normalAnswers('P03'));
      });

      await t.step(2, 'Release B, its files under names their own bytes give, installs and waits beside A', async () => {
        releases.use('B');
        await t.must(await rel.installNext(page) === 'installed', 'release B did not install');
        await t.check(await rel.hasWaiting(page), 'release B took over during the walk');
        const caches = (await appCaches(page)).sort();
        await t.check(JSON.stringify(caches) === JSON.stringify([releases.cache('A'), releases.cache('B')].sort()), `the caches are ${JSON.stringify(caches)}`);
      });

      await t.step(3, 'Offline: the walk’s summary, never loaded, opens from release A, the walk saves, and a reload brings release A’s own shell (P8R-10, P8R-12)', async () => {
        await t.context.setOffline(true);
        try {
          await walk.finish(t);
          await ui.tap(ui.button(main, 'Save walk'));
          await page.getByText('Saved on this device', { exact: true }).waitFor({ timeout: 10000 });
          await ui.tap(ui.button(main, 'Done'));
          await t.checkpoint('summary-offline');
          await t.reload();
          await t.ready();
          await t.check(await entry() === releases.entry('A'), `a reload brought another release’s shell: ${await entry()}`);
          await t.check(await rel.buildOf(page) === releases.build('A'), 'the window left release A');
        } finally {
          await t.context.setOffline(false);
        }
      });
    },
  },
  {
    name: 'two real releases: a first visit, taken over by its release’s first worker, holds a later release back while its walk goes on (P8S-11)',
    releases: true,
    async run(t, { releases }) {
      releases.use('A');
      const page = await t.open({ seed: persona('P03'), route: '/home', ...WORKERS });
      let before;

      await t.step(1, 'A first visit, which no worker controls yet, starts a walk at once', async () => {
        await t.check(!(await page.evaluate(() => !!navigator.serviceWorker.controller)), 'a worker controlled the first visit before any had installed');
        await rel.mark(page);
        await walk.openSetup(t);
        await walk.start(t, ui.normalAnswers('P03'));
        before = await t.checkpoint('first-visit-walking');
      }, { input: 'a walk started on a first visit' });

      await t.step(2, 'Release A’s first worker takes the page over, with no reload, the walk under way', async () => {
        await rel.controlled(page);
        await t.check(await rel.sameDocument(page), 'the first visit reloaded when its worker took it over');
        await t.check(await rel.buildOf(page) === releases.build('A'), 'the page doesn’t run release A');
      });

      await t.step(3, 'Release B deployed: it installs and waits behind the walking window; a new window opens on release A, the database untouched', async () => {
        releases.use('B');
        await t.must(await rel.installNext(page) === 'installed', 'release B did not install');
        await walk.elapse(t, MINUTE);
        await t.check(await rel.hasWaiting(page), 'release B took over with the first visit open');
        const second = await t.newPage();
        try {
          await second.goto(`${t.base}#/home`);
          await rel.controlled(second);
          await t.check(await rel.buildOf(second) === releases.build('A'), 'the new window opened on release B while release A’s walk went on');
          const snap = await t.checkpoint('second-window', { page: second });
          await t.check(snap.version === before.version, `the database moved to version ${snap.version} under the walk`);
        } finally {
          await second.close();
        }
      });

      await t.step(4, 'The walk carries on, and saves once, on release A', async () => {
        await t.check(await rel.sameDocument(page), 'the walking window reloaded');
        await walk.finish(t);
        await ui.tap(ui.button(page.getByRole('main'), 'Save walk'));
        await page.getByText('Saved on this device', { exact: true }).waitFor({ timeout: 10000 });
        const snap = await t.checkpoint('walk-saved');
        await t.check(walksIn(snap).size === 1, `the walk is saved ${walksIn(snap).size} times`);
        await t.check(snap.version === before.version, `the database is at version ${snap.version}`);
      });
    },
  },
  {
    name: 'storage lost while FitStrong runs: every screen stays, read-only; a form keeps its answer, a low saved then still guides, and nothing is written (P8S-04)',
    async run(t) {
      const page = await t.open({ seed: persona('P03'), route: '/home' });
      const reading = form => form.getByRole('textbox', { name: 'Reading', exact: true });
      let before;
      let form;

      await t.step(1, 'Browse → Glucose → Add reading, 118 typed, not saved', async () => {
        before = await t.checkpoint('before-loss');
        form = await typedOnHub(page, '118');
      }, { input: 'Glucose 118 typed, not saved' });

      // One step for the whole wait (see "Reading the database while a newer tab is open").
      await t.step(2, 'A newer copy upgrades the database under it: the form, its answer and the screen stay, and the notice names the newer copy', async () => {
        const newer = await rec.newerTab(t, before.version + 1, { abort: false });
        try {
          await page.bringToFront();
          await page.getByText(STALE_TITLE, { exact: true }).waitFor({ timeout: 15000 });
          await t.check(await form.isVisible(), 'the form went when the storage did');
          await t.check(await reading(form).inputValue() === '118', `the typed answer is now “${await reading(form).inputValue()}”`);
          await t.check(await page.getByRole('navigation', { name: 'Main' }).count() === 1, 'the app gave way to a storage screen');
        } finally {
          await newer.page.close();
        }
      });

      await t.step(3, 'The answer made 52 and saved: the low’s guidance and the safety surface, with no “Saved”, and nothing written', async () => {
        await ui.type(reading(form), '52');
        await t.must(await data.saveForm(t, form) === 'guidance', 'a reading of 52 showed no guidance');
        const guidance = page.getByRole('dialog', { name: /^(Saved|What to do)$/ });
        await t.check(await guidance.getByText(/Saved on this device/).count() === 0, 'the guidance says the reading was saved where nothing is saved');
        await t.check(await page.locator('[data-urgent-kind]').count() >= 1, 'the low isn’t on the safety surface');
        const snap = await t.checkpoint('read-only-low');
        await t.check(!(snap.observations ?? []).some(o => o.kind === 'glucose' && o.value === 52), 'the 52 was written from a read-only window');
        const diffs = data.sameSnapshot(before, snap);
        await t.check(diffs.length === 0, `the record changed: ${diffs.slice(0, 3).join(' | ')}`);
      }, { input: 'Glucose 52, saved in a read-only window' });
    },
  },
];
```

- [ ] **Step 4: Run them**

```bash
npm run e2e:acceptance -- --only=V-J32,V-J36,V-J38
```

Expected: every case passes in all four projects. The runner builds the production bundle for V-J38's first three cases, and the two releases for its fifth to ninth, saying so; the release cases run one at a time, after the rest. A failure is the app falling short: fix the app, and change the journey only where it asks for something the spec doesn't.

- [ ] **Step 5: Commit**

```bash
git add scripts/e2e/acceptance/journeys/v32.mjs scripts/e2e/acceptance/journeys/v36.mjs scripts/e2e/acceptance/journeys/v38.mjs
git commit -m "test: Add acceptance V-J32, V-J36 and V-J38, with two real releases"
```

---

### Task 16: Acceptance V-J40, V-J41 and V-J42, and the budget journey

**Files:**
- Create: `scripts/e2e/acceptance/journeys/v40.mjs`, `v41.mjs`, `v42.mjs`, `p01.mjs` (journey `PERF01`)
- Modify: `src/screens/walk/RouteThumb.tsx` (named only while its walk opens)
- Modify: `src/components/ui/sheet.tsx`, `src/components/ui/dialog.tsx` (no full-page blur behind a sheet or a dialog)
- Modify: `src/components/motion/MotionView.tsx` (the demo's own button isn't glass)

**Interfaces:**
- Consumes: Task 12's `open({ textScale, zoneByCdp, visibility, draws })`, `setTimezone`, `jumpClock` (forwards or back), `lastAudio`, `busiestSecond`, `withinRedrawBudget`, `openRecentlyDeleted`; Task 6's refusal words; Plan 6's `walk.played`, `walk.cueHeard`, `walk.elapse`, `walk.timer`, `walk.stored`, `walk.emit`, `walk.gpsSwitch`; Task 11's words and `admits`' rule; `useViewTransitionState` (React Router 7.13); `recordPath` (`src/screens/track/timeline.ts`); a guided run's saved progress, `localStorage['fit-strong-90-guided']` (`src/session/persistence.ts`, `RESUME_WINDOW_MS` 18 hours).
- Produces: three journeys and `PERF01`, the motion budget's checks a browser can make (D117), run in the large light project only: none of them depends on size or colour.

**What changed from earlier drafts, and why** (Codex P8-19, P8-24 to P8-26, P8R-15; Kiro K8-01, K8-05, K8-15). V-J41 crosses a date with its time-zone change (Kolkata to Auckland, where it is already the next day), so a history regrouped by the new zone would show; it sets the clock *back*, so the old reading would look fresh by the wall clock and only the clock-change rule can hold it; and a third case sets the clock a day on and back with a serious low on the device, which can't be deleted at any of those times, and an entry in Recently deleted, which a clock set back never ends. V-J42 opens `?resume=1` with nothing saved and with progress past its window, resumes progress that is real, keeps a run open across midnight, and finishes week 12's last session and crosses into the next day in one run; its button reads "Choose what’s next". PERF01 checks each blurred surface's size and kind, leaves out every stationary navigation snapshot, counts the 3D demo's own WebGL draw calls (hidden, and off screen), and times every redraw of the live route while the walk takes five fixes, each moving it, in under half a second, holding the busiest second to one redraw; Step 5 proves the same case fails with the route's own throttle taken out.

- [ ] **Step 1: Write** `scripts/e2e/acceptance/journeys/v40.mjs`

```js
/**
 * V-J40 (journey §17.2 #40, J§20.4; B-30): with text at 200%, a blood
 * pressure reading logged with the keyboard up → the minute's announcement
 * doesn't move focus → Save → focus back on the button that opened the form.
 * And B-30's interrupted audio cue: a walk cue the system cuts off is never
 * resumed, and the next one still plays. VoiceOver itself is on the device
 * checklist (Task 17).
 */
import { MINUTE } from '../lib/env.mjs';
import { persona } from '../fixtures/personas.mjs';
import { saveForm } from '../lib/data.mjs';
import * as hub from '../lib/hub.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';

export const id = 'V-J40';
export const title = 'Text at 200%: focus stays through the minute and comes back; an interrupted cue stays stopped';
export const safety = false;

const focusName = page => page.evaluate(() => {
  const el = document.activeElement;
  return el ? (el.getAttribute('aria-label') || el.textContent || el.id || el.tagName).trim() : '';
});

export const cases = [
  {
    name: 'blood pressure at 200% text',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home', textScale: 2 });
      const main = page.getByRole('main');
      const form = page.getByRole('dialog', { name: 'Blood pressure' });
      const second = form.getByRole('group', { name: 'Second reading' });

      await t.step(1, 'BP hub → Add reading → 124/78 → Add a second reading → its Top field, keyboard up', async () => {
        await hub.openHub(t, 'Blood pressure', '/hub/bp');
        await ui.tap(ui.button(main, 'Add reading'));
        await form.waitFor({ timeout: 10000 });
        await ui.type(form.getByRole('textbox', { name: 'Top (systolic)', exact: true }), '124');
        await ui.type(form.getByRole('textbox', { name: 'Bottom (diastolic)', exact: true }), '78');
        await ui.tap(ui.button(form, 'Add a second reading'));
        await second.getByRole('textbox', { name: 'Top (systolic)', exact: true }).focus();
        await page.evaluate(() => { window.__accFocused = document.activeElement; });
        await t.check(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'the page scrolls sideways at 200% text');
        await t.checkpoint('second-field-200');
      }, { input: '124/78; text at 200%' });

      await t.step(2, 'The minute passes: it is announced, and focus stays in the field', async () => {
        await t.advance(60_000);
        const live = form.locator('[aria-live="polite"]').filter({ hasText: 'A minute has passed: you can take the second reading now.' });
        await t.check(await live.count() === 1, 'the minute is not announced');
        await t.check(await page.evaluate(() => document.activeElement === window.__accFocused), `the announcement moved focus to “${await focusName(page)}”`);
      });

      await t.step(3, '122/76 → Save: the sheet closes, and focus is back on Add reading', async () => {
        await second.getByRole('textbox', { name: 'Top (systolic)', exact: true }).fill('122');
        await second.getByRole('textbox', { name: 'Bottom (diastolic)', exact: true }).fill('76');
        await t.must(await saveForm(t, form) === 'closed', 'the two readings did not save');
        await page.waitForTimeout(500);
        await t.check(await focusName(page) === 'Add reading', `focus went to “${await focusName(page)}”, not back to Add reading`);
        await t.checkpoint('saved-200');
      }, { input: '122/76' });
    },
  },
  {
    name: 'a walk cue the system cuts off is never resumed (B-30)',
    async run(t) {
      const page = await t.open({ seed: persona('P03', { patch: { profile: { voice: { muted: false } } } }), route: '/home' });
      let plays = 0;

      await t.step(1, 'A walk, nine minutes in', async () => {
        await walk.openSetup(t);
        await walk.start(t, ui.normalAnswers('P03'));
        await walk.elapse(t, 9 * MINUTE);
      });

      await t.step(2, 'The 10-minute cue starts, and the system takes the audio at once', async () => {
        const before = (await walk.played(page)).length;
        await walk.elapse(t, MINUTE);
        await page.waitForFunction(n => window.__acc.calls.play.length > n, before, { timeout: 10000 });
        await page.evaluate(() => window.__acc.lastAudio?.pause());
        plays = (await walk.played(page)).length;
        await t.checkpoint('cue-interrupted');
      });

      await t.step(3, 'Never resumed: nothing plays for the rest of the cue’s grace', async () => {
        await walk.elapse(t, 50_000, 10_000);
        const after = await walk.played(page);
        await t.check(after.length === plays, `the interrupted cue played again: ${JSON.stringify(after.slice(plays))}`);
      });

      await t.step(4, 'The 20-minute cue still plays', async () => {
        await walk.elapse(t, 9 * MINUTE + 10_000);
        await t.check(await walk.cueHeard(page, 'Twenty minutes of walking.'), 'no cue played after an interrupted one');
        await t.check((await walk.played(page)).length > plays, 'the 20-minute cue never played');
        await t.checkpoint('next-cue');
      });
    },
  },
];
```

- [ ] **Step 2: Write** `scripts/e2e/acceptance/journeys/v41.mjs`

```js
/**
 * V-J41 (journey §17.2 #41, B-19, A-75; D88): a time-zone change mid-walk →
 * the elapsed time is right (a monotonic clock); history keeps its days; and
 * a clock jump makes no reading "fresh". The zone change crosses a date
 * (Kolkata to Auckland, where it is already the 9th), so a history regrouped
 * by the new zone would show. The clock is set back 20 minutes, so a reading
 * already too old to restart on would look fresh again by the wall clock:
 * only the clock-change rule holds P03, on a sulfonylurea, for a new reading
 * (Codex P8-24). Plan 6 Task 3 built the rules; this walks them. And a
 * clock set a day on and back leaves a serious low and Recently deleted as
 * they were (A-75, B-19, Kiro K8-01).
 */
import { MINUTE } from '../lib/env.mjs';
import { persona } from '../fixtures/personas.mjs';
import { content } from '../lib/harness.mjs';
import * as data from '../lib/data.mjs';
import * as hub from '../lib/hub.mjs';
import * as rec from '../lib/recovery.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';

export const id = 'V-J41';
export const title = 'A time-zone change across a date, the clock set back mid-walk, and a clock jump with a serious low on the device';
export const safety = true;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const zone = page => page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
/** The page's own date, in its zone now. */
const localDay = page => page.evaluate(() => new Date().toLocaleDateString('en-CA'));
const minutesShown = async page => Number((await walk.timer(page)).split(':')[0]);
const walkRow = main => ui.row(ui.section(main, 'Records'), 'Walk', 'link');
const DAY = 24 * 60 * MINUTE;
const REFUSED = 'This reading is keeping movement on hold, so it can’t be changed or removed yet.';
const lowsOf = snap => (snap.observations ?? []).filter(o => o.kind === 'glucose' && o.value === 52);
/** A serious reading's guidance, closed by its Close. */
async function closeGuidance(page) {
  const guidance = page.getByRole('dialog', { name: /^(Saved|What to do)$/ });
  if (!(await guidance.count())) return;
  await ui.tap(ui.button(guidance, 'Close'));
  await guidance.waitFor({ state: 'hidden' });
}

export const cases = [
  {
    name: 'Kolkata to Auckland, into the next day, mid-walk',
    async run(t) {
      const page = await t.open({ seed: persona('P03'), route: '/home', zoneByCdp: 'Asia/Kolkata', time: Date.parse('2026-10-08T16:55:00+05:30') });
      const main = page.getByRole('main');
      let before;

      await t.step(1, 'A walk in Kolkata’s time zone at 4:55 pm on the 8th, 5 minutes in', async () => {
        await t.must(await zone(page) === 'Asia/Kolkata', `the page runs in ${await zone(page)}`);
        await walk.openSetup(t);
        await walk.start(t, ui.normalAnswers('P03'));
        before = await t.db();
        await walk.elapse(t, 5 * MINUTE);
        await t.check(await minutesShown(page) === 5, `the timer reads ${await walk.timer(page)}`);
      });

      await t.step(2, 'The phone moves to Auckland’s time zone, where it is already the 9th: the time walked stays right, and nothing recorded moves', async () => {
        await t.setTimezone('Pacific/Auckland');
        await t.must(await zone(page) === 'Pacific/Auckland', `the zone did not change: ${await zone(page)}`);
        await t.must(await localDay(page) === '2026-10-09', `in Auckland the page says it is ${await localDay(page)}: the change crosses no date`);
        await walk.elapse(t, 5 * MINUTE);
        await t.check(await minutesShown(page) === 10, `after the zone change the timer reads ${await walk.timer(page)}`);
        const stored = await walk.stored(page);
        const first = stored?.segments?.[0];
        await t.check(first?.day === '2026-10-08' && first?.offsetMin === 330, `the walk’s first segment: ${JSON.stringify({ day: first?.day, offsetMin: first?.offsetMin })}`);
        const after = await t.checkpoint('after-zone-change');
        const moved = (before.observations ?? []).filter(o => {
          const now = (after.observations ?? []).find(x => x.id === o.id);
          return !now || now.day !== o.day || now.at !== o.at;
        });
        await t.check(moved.length === 0, `records moved with the zone: ${JSON.stringify(moved.map(o => [o.kind, o.day, o.at]))}`);
      }, { input: 'time zone Asia/Kolkata → Pacific/Auckland at 5:00 pm IST' });

      await t.step(3, 'Finish and save: each of the walk’s records keeps the day and the offset it was walked in', async () => {
        await walk.finish(t);
        await ui.tap(ui.button(main, 'Save walk'));
        await page.getByText('Saved on this device', { exact: true }).waitFor({ timeout: 10000 });
        const snap = await t.checkpoint('walk-saved');
        const records = walk.walkObservations(snap);
        await t.check(records.length > 0 && records.every(o => o.day === '2026-10-08' && o.at.endsWith('+05:30')), `the walk’s records: ${JSON.stringify(records.map(o => [o.kind, o.day, o.at]))}`);
        const minutes = records.filter(o => o.kind === 'walkDuration').reduce((sum, o) => sum + o.value, 0);
        await t.check(minutes >= 10 && minutes < 12, `the saved walk is ${minutes} min, not about 10`);
      });

      await t.step(4, 'Today’s log in Auckland: the 9th holds no walk, and the 8th holds it', async () => {
        await ui.tap(ui.button(main, 'Done'));
        await ui.legacyTab(page, 'Track');
        await t.check(await walkRow(main).count() === 0, 'the walk shows on the 9th, the day the new zone would give it');
        await ui.trackDay(page, '2026-10-08');
        await t.check(await walkRow(main).count() === 1, 'the 8th does not show the walk');
        await t.checkpoint('log-keeps-days');
      });
    },
  },
  {
    name: 'the clock set back 20 minutes mid-walk, past the reading’s 30',
    async run(t) {
      const page = await t.open({ seed: persona('P03'), route: '/home' });
      const main = page.getByRole('main');

      await t.step(1, 'A walk from 9:00, its glucose taken at 9:00; 35 minutes in, past the 30 a restart allows', async () => {
        await walk.openSetup(t);
        await walk.start(t, ui.normalAnswers('P03'));
        await walk.elapse(t, 35 * MINUTE);
        await t.check(await minutesShown(page) === 35, `the timer reads ${await walk.timer(page)}`);
      });

      await t.step(2, 'The clock set back to 9:15: the reading would look 15 minutes old, but the walk counts real time and notes the change', async () => {
        await t.jumpClock(-20 * MINUTE);
        const shown = await minutesShown(page);
        await t.check(shown >= 35 && shown < 37, `after the change the timer reads ${await walk.timer(page)}`);
        const stored = await walk.stored(page);
        await t.check((stored?.segments ?? []).some(s => s.endedBy === 'clockChange') && typeof stored?.clockChangedAt === 'number',
          `the walk did not note the change: ${JSON.stringify((stored?.segments ?? []).map(s => s.endedBy))}`);
      }, { input: 'the phone’s clock set from 9:35 to 9:15' });

      await t.step(3, 'Pause, then Resume: held for a new reading, never carried on by the old one', async () => {
        await ui.tap(ui.button(main, 'Pause'));
        await page.waitForTimeout(500);
        const text = flat(await main.innerText());
        await t.checkpoint('held-after-change');
        await t.check(/Your phone’s clock changed during this walk/.test(text), `the paused walk does not ask for a new reading: ${text.slice(0, 300)}`);
        await ui.tap(ui.button(main, 'Resume'));
        await page.waitForTimeout(800);
        await t.check(await ui.button(main, 'Pause').count() === 0, 'Resume carried on with a reading the clock change leaves untimed');
      });

      await t.step(4, 'A new reading, 118 mg/dL: Carry on walking, and the walk runs again', async () => {
        await ui.tap(ui.button(main, 'Check in'));
        const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
        await sheet.waitFor({ timeout: 10000 });
        await ui.tap(ui.button(sheet, (await ui.button(sheet, 'Enter a new reading').count()) ? 'Enter a new reading' : 'Change answers'));
        await ui.answerCheckIn(t, sheet, { glucose: { value: '118', unit: 'mg/dL' } });
        await ui.tap(ui.button(sheet, 'Carry on walking'));
        await ui.button(main, 'Pause').waitFor({ timeout: 10000 });
        await t.checkpoint('walking-again');
      }, { input: 'glucose 118 mg/dL, taken now' });
    },
  },
  {
    name: 'a serious low on the device, the clock a day on and back: never deletable, the walk held, and Recently deleted kept (K8-01)',
    async run(t) {
      const page = await t.open({ seed: persona('P03'), route: '/day/today', visibility: true });
      const main = page.getByRole('main');
      const back = async () => {
        await page.evaluate(() => window.__acc.setVisibility('hidden'));
        await page.waitForTimeout(500);
        await page.evaluate(() => window.__acc.setVisibility('visible'));
        await page.waitForTimeout(800);
      };
      const lowRefused = async when => {
        await ui.legacyTab(page, 'Track');
        await ui.tap(ui.section(main, 'Records').getByRole('link').filter({ hasText: '52' }).first());
        await ui.tap(ui.row(main, 'Delete this reading'));
        await t.check(await main.getByText(REFUSED, { exact: false }).count() >= 1, `${when}: the 52’s delete was not refused`);
        await t.check(lowsOf(await t.db()).length === 1, `${when}: the 52 is gone`);
      };
      const walkHeld = async when => {
        await hub.open(t, 'walk');
        const starts = (await hub.card(page).getByRole('button').allInnerTexts()).map(flat).filter(l => hub.STARTERS.test(l));
        await t.check(starts.length === 0, `${when}: the Walk hub offers ${JSON.stringify(starts)}`);
      };

      await t.step(1, 'Water 250 ml deleted into Recently deleted, and a 52 mg/dL low logged: the walk held, the 52 not deletable', async () => {
        await data.logWater(t, 250);
        await ui.tap(ui.row(ui.section(main, 'Day totals'), 'Water', 'link'));
        await ui.tap(ui.row(main, 'Delete this entry'));
        await rec.toast(page, 'Water 250 ml deleted').waitFor({ timeout: 10000 });
        await data.logGlucose(t, { value: 52 });
        await closeGuidance(page);
        await walkHeld('after the low');
        await lowRefused('at first');
      }, { input: 'Water 250 ml, deleted; glucose 52 mg/dL' });

      await t.step(2, 'The clock set a day on, and the app opened again: the 52 still not deletable, the walk still held', async () => {
        await t.jumpClock(DAY);
        await back();
        await lowRefused('a day on');
        await walkHeld('a day on');
        await t.checkpoint('a-day-on');
      }, { input: 'the phone’s clock set a day ahead' });

      await t.step(3, 'The clock set back a day: the walk still held by the low, and Recently deleted still holds the water', async () => {
        await t.jumpClock(-DAY);
        await back();
        await walkHeld('set back');
        await lowRefused('set back');
        const snap = await t.checkpoint('set-back');
        await t.check(Object.keys(content(snap)).some(k => k.startsWith('recent:')), 'the clock set back ended a Recently deleted entry');
        await ui.legacyTab(page, 'Track');
        const sheet = await rec.openRecentlyDeleted(t);
        await t.check(await sheet.getByRole('button', { name: 'Restore Water 250 ml', exact: true }).count() === 1, 'Recently deleted lost the water');
      }, { input: 'the phone’s clock set back a day' });
    },
  },
];
```

- [ ] **Step 3: Write** `scripts/e2e/acceptance/journeys/v42.mjs`

```js
/**
 * V-J42 (journey §17.2 #42, D116): an upgraded person in programme week 12 →
 * the twelve weeks finish → Stretch and Walk carry on → "What next?", chosen
 * explicitly, from a button that says "Choose what’s next" (Kiro K8-05). Nothing is invented after week 12. Whether a guided session
 * opens is decided once, when it opens (Codex P8-19): `?resume=1` with
 * nothing saved, or with progress past its 18 hours, opens the choice; real
 * progress opens; a run under way at midnight stays until it is saved; and
 * week 12's last session finished, then the next day, in one run (K8-15).
 * P01, a v1 record upgraded on open, started 17 July 2026: Thursday 8 October
 * is week 12's last day.
 */
import { persona } from '../fixtures/personas.mjs';
import { docs } from '../lib/harness.mjs';
import * as hub from '../lib/hub.mjs';
import * as mv from '../lib/move.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J42';
export const title = 'After week 12: nothing invented, Stretch and Walk carry on, what’s next chosen';
export const safety = false;

const flat = s => (s ?? '').replace(/\s+/g, ' ').trim();
const JULY = { patch: { settings: { startDate: '2026-07-17' } } };
const NEXT_DAY = Date.parse('2026-10-09T09:00:00+05:30');
const DONE = 'The 12 weeks are done';
const PLAN = '/hub/workout/plan';
const saved = page => page.evaluate(() => {
  const raw = localStorage.getItem('fit-strong-90-guided');
  return raw ? JSON.parse(raw) : null;
});

/** Week 12's session from the Workout hub, through its check-in, running. */
async function startSession(t) {
  const page = t.page;
  await hub.open(t, 'guided');
  const { sheet } = await hub.begin(t);
  if (sheet) {
    await ui.answerCheckIn(t, sheet, ui.normalAnswers('P01'));
    await ui.tap(mv.sheetStart(sheet));
  }
  await page.waitForURL(/#\/session/, { timeout: 15000 });
  await t.ready();
  await ui.tap(page.getByRole('main').getByRole('button', { name: 'Start', exact: true }));
  await page.getByRole('button', { name: 'Pause', exact: true }).waitFor({ timeout: 10000 });
}

/** End session → Save and exit: the run saved part-way, to resume. */
async function saveAndExit(t) {
  const page = t.page;
  await ui.tap(page.getByRole('main').getByRole('button', { name: 'End session', exact: true }));
  await ui.tap(page.getByRole('button', { name: 'Save and exit', exact: true }));
  await page.waitForFunction(() => !location.hash.startsWith('#/session'), null, { timeout: 15000 });
}

export const cases = [
  {
    name: 'week 12’s last day still plans its session',
    async run(t) {
      const page = await t.open({ seed: persona('P01', JULY), route: '/home' });
      await t.step(1, 'The Workout hub: Week 12 of 12, with its session', async () => {
        await hub.open(t, 'guided');
        const text = flat(await page.getByRole('main').innerText());
        await t.checkpoint('week-12-last-day');
        await t.check(/Week 12 of 12/.test(text), `the hub does not say Week 12 of 12: ${text.slice(0, 300)}`);
        await t.check(await hub.start(page).count() === 1, 'week 12’s last day offers no session');
      });
    },
  },
  {
    name: 'the day after: nothing planned, Choose what’s next, Stretch and Walk carry on',
    async run(t) {
      const page = await t.open({ seed: persona('P01', JULY), route: '/home', time: NEXT_DAY });
      const main = page.getByRole('main');

      await t.step(1, 'Home: Right now and the Workout tile say the twelve weeks are done', async () => {
        const right = ui.rightNow(page);
        const text = flat(await right.innerText());
        await t.checkpoint('home-done');
        await t.check(text.includes(DONE), `Right now reads “${text.slice(0, 200)}”`);
        await t.check(await ui.button(right, 'Choose what’s next').count() === 1, 'Right now has no “Choose what’s next”');
        await t.check(flat(await hub.tile(page, 'Workout').innerText()).includes(DONE), 'the Workout tile still names a session');
      });

      await t.step(2, 'The Workout hub says so too, with no Start; a stale link to the session, and one to resume with nothing saved, open the choice', async () => {
        await hub.open(t, 'guided');
        const card = flat(await hub.card(page).innerText());
        await t.check(card.includes(DONE) && /Choose what’s next/.test(card), `the Workout card reads “${card.slice(0, 200)}”`);
        await t.check(await hub.start(page).count() === 0, 'the Workout hub still starts a session after week 12');
        for (const link of ['/session', '/session?resume=1']) {
          await t.goto(link);
          await t.check((await t.route()).startsWith(PLAN), `${link} opened ${await t.route()}`);
        }
        await t.check(await saved(page) === null, 'a stale link made a run');
      }, { input: '#/session and #/session?resume=1, nothing saved' });

      await t.step(3, 'Stretch and Walk carry on as before', async () => {
        for (const mode of ['stretch', 'walk']) {
          await hub.open(t, mode);
          await t.check(await hub.start(page).count() === 1, `the ${mode} hub offers no start after week 12`);
        }
        await t.checkpoint('stretch-walk-carry-on');
      });

      await t.step(4, 'Choose what’s next → Your plan: two choices under What next? → Leave the programme', async () => {
        await ui.tab(page, 'Home');
        await ui.tap(ui.button(ui.rightNow(page), 'Choose what’s next'));
        await ui.heading(page, 'Your plan');
        const choices = ui.section(main, 'What next?');
        await t.must(await choices.count() === 1, 'Your plan has no “What next?”');
        await t.check(await ui.row(choices, 'Start the 12 weeks again').count() === 1 && await ui.row(choices, 'Leave the programme').count() === 1, `the choices: ${flat(await choices.innerText())}`);
        await ui.tap(ui.row(choices, 'Leave the programme'));
        const sheet = page.getByRole('dialog', { name: 'Leave the programme?' });
        await ui.tap(ui.button(sheet, 'Leave the programme'));
        await sheet.waitFor({ state: 'hidden' });
        const snap = await t.checkpoint('left');
        await t.check(!docs(snap).settings?.startDate, `the start date is still ${docs(snap).settings?.startDate}`);
        await t.check((snap.sessions ?? []).some(s => s.id === 'legacy-strength'), 'leaving lost a session');
      });
    },
  },
  {
    name: 'a session under way at midnight on week 12’s last day stays until it is saved, and reopens only to resume',
    async run(t) {
      const page = await t.open({ seed: persona('P01', JULY), route: '/home', time: Date.parse('2026-10-08T23:50:00+05:30') });

      await t.step(1, '11:50 pm on week 12’s last day: its session started', async () => {
        await startSession(t);
        await t.checkpoint('started-before-midnight');
      }, { input: 'normal check-in at 11:50 pm' });

      await t.step(2, 'Past midnight, the twelve weeks over: the run stays on screen and keeps going', async () => {
        for (let i = 0; i < 15; i++) await t.advance(60_000);
        await t.check((await t.route()).startsWith('/session'), `at 12:05 am the run was taken to ${await t.route()}`);
        await t.check(await page.getByRole('button', { name: /^(Pause|Resume)$/ }).count() >= 1, 'the run’s controls are gone after midnight');
        await t.checkpoint('past-midnight');
      });

      await t.step(3, 'Saved part-way: a fresh link opens the choice, and the link to resume opens the run', async () => {
        await saveAndExit(t);
        const kept = await saved(page);
        await t.must(kept?.plan?.date === '2026-10-08' && kept?.state?.status !== 'done', `the run was not saved part-way: ${JSON.stringify(kept?.state?.status)}`);
        await t.goto('/session');
        await t.check((await t.route()).startsWith(PLAN), `/session opened ${await t.route()}`);
        await t.goto('/session?resume=1');
        await t.check((await t.route()).startsWith('/session'), `/session?resume=1 opened ${await t.route()}, not the saved run`);
        // A new day: the run may first ask for today's check-in (scan M-01), on its own screen.
        const run = page.getByRole('button', { name: /^(Resume|Start)$/ }).or(page.getByRole('heading', { name: /^Check in to (carry on|start)$/ }));
        await t.check(await run.count() >= 1, 'the saved run did not open');
        await t.checkpoint('resumed-after-week-12');
      }, { input: 'End session → Save and exit at 12:05 am; then the links' });
    },
  },
  {
    name: 'week 12’s last session finished, then the next day in the same run: nothing planned, and Choose what’s next (K8-15)',
    async run(t) {
      const page = await t.open({ seed: persona('P01', JULY), route: '/home', time: Date.parse('2026-10-08T09:00:00+05:30') });
      const main = page.getByRole('main');

      await t.step(1, 'Week 12’s last day: its session started, finished and saved', async () => {
        await startSession(t);
        await t.advance(60_000);
        await ui.tap(main.getByRole('button', { name: 'End session', exact: true }));
        await ui.tap(page.getByRole('button', { name: 'Finish now', exact: true }));
        await ui.tap(page.getByRole('button', { name: 'Save and finish', exact: true }));
        await page.waitForFunction(() => !location.hash.startsWith('#/session'), null, { timeout: 15000 }).catch(() => undefined);
        const snap = await t.checkpoint('week-12-finished');
        await t.check((snap.sessions ?? []).some(s => s.date === '2026-10-08' && s.status === 'completed'), 'week 12’s last session was not saved as done');
      }, { input: 'End session → Finish now → Save and finish' });

      await t.step(2, 'The next morning, the app still open: Right now says the twelve weeks are done, with Choose what’s next, and the Workout hub plans nothing', async () => {
        await t.setTime(NEXT_DAY);
        await ui.tab(page, 'Home');
        await t.ready();
        const right = ui.rightNow(page);
        await right.getByText(DONE).first().waitFor({ timeout: 15000 });
        await t.check(await ui.button(right, 'Choose what’s next').count() === 1, 'Right now has no “Choose what’s next”');
        await hub.open(t, 'guided');
        await t.check(await hub.start(page).count() === 0, 'the Workout hub starts a session the day after week 12');
        await t.checkpoint('next-day-same-run');
      });

      await t.step(3, 'Choose what’s next → Your plan, with its two choices', async () => {
        await ui.tab(page, 'Home');
        await ui.tap(ui.button(ui.rightNow(page), 'Choose what’s next'));
        await ui.heading(page, 'Your plan');
        const choices = ui.section(main, 'What next?');
        await t.check(await ui.row(choices, 'Start the 12 weeks again').count() === 1 && await ui.row(choices, 'Leave the programme').count() === 1, `the choices: ${flat(await choices.innerText())}`);
      });
    },
  },
  {
    name: 'progress past its 18 hours opens only the choice',
    async run(t) {
      const page = await t.open({ seed: persona('P01', JULY), route: '/home' });

      await t.step(1, 'Week 12’s last day, 9:00 am: its session started, then saved part-way', async () => {
        await startSession(t);
        await t.advance(60_000);
        await saveAndExit(t);
        await t.must((await saved(page))?.plan?.date === '2026-10-08', 'the run was not saved');
      });

      await t.step(2, 'The next day at 9:05 am, past the 18 hours: the link to resume opens the choice', async () => {
        await t.setTime(Date.parse('2026-10-09T09:05:00+05:30'));
        await t.goto('/session?resume=1');
        await t.check((await t.route()).startsWith(PLAN), `/session?resume=1 opened ${await t.route()} for progress past its window`);
        await t.checkpoint('expired-resume');
      }, { input: '#/session?resume=1, 24 hours after the save' });
    },
  },
  {
    name: 'the day after: Start the 12 weeks again',
    async run(t) {
      const page = await t.open({ seed: persona('P01', JULY), route: '/hub/workout/plan?next=1', time: NEXT_DAY });
      const main = page.getByRole('main');
      await t.step(1, 'Your plan → Start the 12 weeks again → its sheet → Week 1 of 12, from today', async () => {
        await ui.heading(page, 'Your plan');
        await ui.tap(ui.row(ui.section(main, 'What next?'), 'Start the 12 weeks again'));
        const sheet = page.getByRole('dialog', { name: 'Start the 12 weeks again?' });
        await ui.tap(ui.button(sheet, 'Start the 12 weeks again'));
        await sheet.waitFor({ state: 'hidden' });
        const snap = await t.checkpoint('restarted');
        await t.check(docs(snap).settings?.startDate === '2026-10-09', `the start date is ${docs(snap).settings?.startDate}`);
        await t.check(/Week 1 of 12/.test(flat(await main.innerText())), 'Your plan does not say Week 1 of 12');
      });
    },
  },
];
```

- [ ] **Step 4: Write** `scripts/e2e/acceptance/journeys/p01.mjs`

```js
/**
 * PERF01 (motion §7, board D117): the performance budget's parts a browser
 * can check. At most two blurred surfaces at once, each a bar or a sheet's
 * header and none larger than a fifth of the screen. At most one animated
 * shared element in a view transition, beyond the page and the stationary
 * navigation snapshots (B-27), Today's log with two walks included. The live
 * route redrawn no more than once for each second measured, on the page's own
 * clock, while fixes it accepts arrive ten times a second, by a check first
 * shown to fail a faster drawing. The 3D demo's own WebGL drawing stopping
 * while the app is hidden and while the demo is off screen (Codex P8-25,
 * P8-26). Frames, Low Power Mode and a warm phone are the device checklist's
 * (Task 17). One project: none of this depends on size or colour.
 */
import { persona } from '../fixtures/personas.mjs';
import { busiestSecond, withinRedrawBudget } from '../lib/budget.mjs';
import * as hub from '../lib/hub.mjs';
import * as ui from '../lib/ui.mjs';
import * as walk from '../lib/walk.mjs';

export const id = 'PERF01';
export const title = 'The performance budget’s automated parts';
export const safety = false;

/** Snapshots that stay put in a transition (`index.css`'s `animation: none`): the shell, the tab bar, the screen's header. */
const STATIONARY = ['app-shell', 'app-nav', 'app-header'];

/** Every surface on screen drawn over a blur: how much of the screen it covers, and whether it is a bar or a sheet's header. */
const blurred = page => page.evaluate(() => {
  const screen = innerWidth * innerHeight;
  return [...document.querySelectorAll('body *')].flatMap(el => {
    const s = getComputedStyle(el);
    const filter = s.backdropFilter || s.webkitBackdropFilter;
    if (!filter || filter === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return [];
    const r = el.getBoundingClientRect();
    const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
    const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
    if (w === 0 || h === 0) return [];
    let pinned = false;
    for (let at = el; at && !pinned; at = at.parentElement) pinned = ['fixed', 'sticky'].includes(getComputedStyle(at).position);
    const header = !!el.closest('[data-slot="sheet-content"] > :first-child');
    const what = el.getAttribute('aria-label') || `${el.tagName.toLowerCase()}.${String(el.className).split(/\s+/).slice(0, 3).join('.')}`;
    return [{ what, share: (w * h) / screen, bar: (pinned && w >= innerWidth * 0.85) || header }];
  });
});

/** What breaks motion §7's "at most two blurred surfaces at once, all small: the tab bar or nav bar, plus a sheet header". */
function overBlur(found) {
  const problems = found.length > 2 ? [`${found.length} blurred surfaces: ${found.map(f => f.what).join(', ')}`] : [];
  for (const f of found) {
    if (f.share > 0.2) problems.push(`${f.what} blurs ${Math.round(f.share * 100)}% of the screen`);
    if (!f.bar) problems.push(`${f.what} is blurred, and is neither a bar nor a sheet’s header`);
  }
  return problems;
}

/** Every view transition, with the animated names on each side: the page and the stationary snapshots left out. */
function vtProbe(stationary) {
  const acc = (window.__acc = window.__acc || {});
  acc.vt = [];
  const native = document.startViewTransition?.bind(document);
  if (!native) return;
  const named = () => [...document.querySelectorAll('body *')]
    .map(el => getComputedStyle(el).viewTransitionName)
    .filter(n => n && n !== 'none' && !stationary.includes(n));
  document.startViewTransition = update => {
    const before = named();
    const run = typeof update === 'function' ? update : update?.update;
    const wrapped = async () => {
      await run?.();
      acc.vt.push({ before, after: named() });
    };
    return native(update && typeof update === 'object' ? { ...update, update: wrapped } : wrapped);
  };
}

/** A walk with location on and its route kept: north along longitude 0, a fix every 10 s for a minute. */
async function routeWalk(t, fromLat, during) {
  const page = t.page;
  await walk.openSetup(t);
  await walk.emit(page, fromLat, 0);
  if (await walk.gpsSwitch(page).getAttribute('aria-checked') !== 'true') await ui.tap(walk.gpsSwitch(page));
  await walk.start(t, ui.normalAnswers('P03'), { keep: true });
  for (let i = 1; i <= 6; i++) {
    await t.advance(10_000);
    await walk.emit(page, fromLat + i * 0.0002, 0);
  }
  if (during) await during(fromLat + 0.0012);
  await page.waitForTimeout(1200);
  await walk.finish(t);
  await ui.tap(ui.button(page.getByRole('main'), 'Save walk'));
  await page.getByText('Saved on this device', { exact: true }).waitFor({ timeout: 10000 });
  await ui.tap(ui.button(page.getByRole('main'), 'Done'));
  await page.waitForTimeout(500);
}

/**
 * A drawing changed ten times a second, measured the way the live route is:
 * the budget check must refuse it, or it proves nothing (P8-25).
 */
const fastDrawing = page => page.evaluate(() => new Promise(resolve => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  svg.append(line);
  document.body.append(svg);
  const times = [];
  new MutationObserver(() => { times.push(performance.now()); }).observe(svg, { attributes: true, subtree: true });
  let i = 0;
  const id = setInterval(() => {
    i += 1;
    line.setAttribute('d', `M0 0 L${i} ${i}`);
    if (i < 20) return;
    clearInterval(id);
    setTimeout(() => {
      svg.remove();
      resolve({ times });
    }, 50);
  }, 100);
}));

/**
 * The live route under a burst (P8-25, P8R-15): five fixes delivered within
 * half a second of the page's own time, each stamped two seconds after the
 * last on the GPS's clock and 5.6 m further north (2.8 m/s, a brisk walk),
 * so the walk's filter (25 m accuracy, 5 m moved, 3 m/s, 10 s ahead at most)
 * accepts every one and each moves the route: five changes to draw in half a
 * second. Every redraw of the drawing is timed, so the check is on the
 * busiest second, and `grew` is what the drawing holds once it has caught up.
 */
const routeBurst = (page, from) => page.evaluate(async lat => {
  const svg = document.querySelector('svg[role="img"][aria-label="Your route so far"]');
  const points = () => [...svg.querySelectorAll('path')].reduce((n, p) => n + ((p.getAttribute('d') ?? '').match(/[ML]/g)?.length ?? 0), 0);
  const before = points();
  const times = [];
  const observer = new MutationObserver(() => { times.push(performance.now()); });
  observer.observe(svg, { attributes: true, childList: true, subtree: true });
  const stamped = Date.now();
  for (let i = 1; i <= 5; i++) {
    await new Promise(r => setTimeout(r, 80));
    window.__acc.emitPosition({ lat: lat + i * 0.0000504, lon: 0, accuracy: 3, timestamp: stamped + i * 2000 });
  }
  await new Promise(r => setTimeout(r, 2200));
  observer.disconnect();
  return { times, grew: points() - before };
}, from);

const lastVt = page => page.evaluate(() => window.__acc.vt.at(-1));
const drawsIn = (page, ms) => page.evaluate(async wait => {
  const at = window.__acc.draws;
  await new Promise(r => setTimeout(r, wait));
  return window.__acc.draws - at;
}, ms);

export const cases = [{
  name: 'blur, shared elements, the live route and the 3D demo',
  projects: ['large-light'],
  async run(t) {
    const page = await t.open({ seed: persona('P03'), route: '/home', sensors: { geo: 'grant' }, visibility: true, draws: true });
    await t.context.addInitScript(vtProbe, STATIONARY);
    await t.reload();
    const main = page.getByRole('main');
    const blurHolds = async where => {
      const problems = overBlur(await blurred(page));
      await t.check(problems.length === 0, `${where}: ${problems.join('; ')}`);
    };

    await t.step(1, 'Blur: Home and a hub scrolled under their bars, and a sheet open, each within the budget', async () => {
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(400);
      await blurHolds('Home, scrolled');
      await hub.open(t, 'stretch');
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(400);
      await blurHolds('the Stretch hub, scrolled');
      await ui.tab(page, 'Home');
      await ui.tap(main.getByRole('button', { name: /^How are you today\? / }));
      await page.getByRole('dialog', { name: 'Status' }).waitFor();
      await page.waitForTimeout(400);
      await blurHolds('with a sheet open');
      await ui.tap(ui.button(page.getByRole('dialog', { name: 'Status' }), 'Close'));
    });

    await t.step(2, 'A tile’s morph animates one shared element', async () => {
      await ui.tap(hub.tile(page, 'Walk'));
      await ui.heading(page, 'Walk');
      const vt = await lastVt(page);
      await t.check(!!vt && vt.before.length <= 1 && vt.after.length <= 1, `the morph named ${JSON.stringify(vt)}`);
    });

    await t.step(3, 'The live route: five changes in half a second, redrawn at most once in any second, by a check that refuses a faster drawing', async () => {
      const fast = await fastDrawing(page);
      await t.must(fast.times.length >= 15 && !withinRedrawBudget(fast.times), `the budget check let ${busiestSecond(fast.times)} redraws within a second pass`);
      await routeWalk(t, 0, async lat => {
        await t.must(await page.locator('svg[role="img"][aria-label="Your route so far"]').count() === 1, 'the live walk draws no route: nothing to measure');
        const live = await routeBurst(page, lat);
        t.note(`the live route: ${live.times.length} redraws, at most ${busiestSecond(live.times)} within a second, ${live.grew} points more`);
        await t.must(live.grew >= 4, `the burst grew the route by ${live.grew} points: its fixes weren’t accepted, so nothing was measured`);
        await t.check(live.times.length >= 1 && withinRedrawBudget(live.times), `the live route redrew ${busiestSecond(live.times)} times within one second`);
      });
      await routeWalk(t, 0.01);
    });

    await t.step(4, 'Today’s log with two route thumbnails: opening one walk names that one alone', async () => {
      await ui.legacyTab(page, 'Track');
      await t.check((await page.evaluate(() => [...document.querySelectorAll('svg')].filter(el => getComputedStyle(el).viewTransitionName.startsWith('route-')).length)) === 0,
        'Today’s log names its route thumbnails at rest');
      await ui.tap(ui.section(main, 'Records').getByRole('link', { name: /Walk/ }).first());
      await ui.heading(page, 'Walk');
      const vt = await lastVt(page);
      await t.check(!!vt && vt.before.length <= 1 && vt.after.length <= 1, `opening a walk named ${JSON.stringify(vt)}`);
      await t.checkpoint('walk-detail-morph');
    });

    await t.step(5, 'The 3D demo: drawing while shown, none while the app is hidden or the demo is off screen; its page blurs only its bars', async () => {
      await t.goto('/hub/workout/exercises/goblet-squat');
      const demo = page.locator('[role="img"][aria-label^="3D demonstration"]').first();
      await demo.waitFor({ timeout: 30000 });
      await page.waitForTimeout(1500);
      const shown = await drawsIn(page, 1000);
      await t.must(shown > 5, `the demo made ${shown} draw calls in a second while shown: it can’t be measured here`);
      await blurHolds('the exercise’s page');
      await page.evaluate(() => window.__acc.setVisibility('hidden'));
      await page.waitForTimeout(500);
      const hidden = await drawsIn(page, 1000);
      await page.evaluate(() => window.__acc.setVisibility('visible'));
      await page.waitForTimeout(500);
      // A short screen, scrolled to the end, takes the demo out of view while it stays mounted.
      await page.setViewportSize({ width: t.project.width, height: 360 });
      await page.mouse.move(t.project.width / 2, 200);
      await page.mouse.wheel(0, 6000);
      await page.waitForTimeout(800);
      const box = await demo.boundingBox();
      await t.must(!!box && box.y + box.height <= 0, `the demo is still in view after scrolling: ${JSON.stringify(box)}`);
      const off = await drawsIn(page, 1000);
      await page.setViewportSize({ width: t.project.width, height: t.project.height });
      t.note(`3D demo draw calls in a second: ${shown} shown, ${hidden} hidden, ${off} off screen`);
      await t.check(hidden === 0, `the demo made ${hidden} draw calls in a second while the app was hidden`);
      await t.check(off === 0, `the demo made ${off} draw calls in a second while off screen`);
    });
  },
}];
```

- [ ] **Step 5: Run them to see where the app falls short**

```bash
npm run e2e:acceptance -- --only=V-J40,V-J41,V-J42,PERF01
```

Expected: V-J40, V-J41 and V-J42 pass in all four projects. PERF01 fails in three places, each a real gap in motion §7, read from the code:
  - step 1, "with a sheet open": the sheet's backdrop blurs the whole screen (`supports-backdrop-filter:backdrop-blur-xs` on `SheetOverlay` in `src/components/ui/sheet.tsx`, and the same on `DialogOverlay` in `dialog.tsx`), against "No full-page blur";
  - step 4: every route thumbnail in Today's log carries its shared name at rest (`route-<walkId>`), so a transition from the log captures two;
  - step 5: the demo's Pause button is blurred glass (`backdrop-blur` in `src/components/motion/MotionView.tsx`), and is neither a bar nor a sheet's header.

  A failure anywhere else is the app falling short too: fix the app, and change the journey only where it asks for something motion §7 doesn't.

  Then prove PERF01's route check can fail through the app's own drawing (Codex P8R-15): in `src/screens/walk/RouteView.tsx`, `LiveRoute`'s `const shown = useEverySecond(useMemo(() => ({ lines, here }), [lines, here]));` becomes `const shown = useMemo(() => ({ lines, here }), [lines, here]);` for one run of `npm run e2e:acceptance -- --only=PERF01`. Expected: step 3 fails with "the live route redrew N times within one second", N at least 3. Put the line back exactly; the step passes again. Nothing of this is committed.

- [ ] **Step 6: No blur behind a sheet or a dialog, and none on the demo's button.**
  - `src/components/ui/sheet.tsx`: `SheetOverlay`'s class string loses ` supports-backdrop-filter:backdrop-blur-xs`, and keeps its `bg-black/10` dim;
  - `src/components/ui/dialog.tsx`: `DialogOverlay`'s loses ` supports-backdrop-filter:backdrop-blur-xs`;
  - `src/components/motion/MotionView.tsx`: the Play/Pause demonstration button's `bg-background/80 shadow backdrop-blur` becomes `bg-background/90 shadow`.

- [ ] **Step 7: Name a thumbnail only while its walk opens.** `src/screens/walk/RouteThumb.tsx` becomes:

```tsx
import { useViewTransitionState } from 'react-router-dom';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { recordPath } from '@/screens/track/timeline';
import { fitView, linePaths } from '@/walk/route';
import type { RouteRecord } from '@/walk/routeRecord';

/**
 * A walk's route in the history (journey §9.5, B-23): our own small drawing,
 * never a map picture. It grows into the detail's frame (M14), except under
 * Reduce Motion. It carries the shared name only while the router moves to or
 * from its walk's detail, as Home's tiles do, so a day of walks names one
 * thumbnail, never all (motion §7, D117). A list row draws its icon at 20 px,
 * so the line is 8 of the drawing's 64 units (about 2.5 px) to stay legible.
 */
export function RouteThumb({ walkId, route }: { walkId: string; route: Pick<RouteRecord, 'segments' | 'bbox'> }) {
  const reduce = useReducedMotion();
  const named = useViewTransitionState(recordPath({ type: 'walk', id: walkId })) && !reduce;
  const view = fitView(route.bbox, 64, 64, 6);
  return (
    <svg viewBox="0 0 64 64" aria-hidden className="size-7" style={named ? { viewTransitionName: `route-${walkId}` } : undefined}>
      {linePaths(route.segments, view).map((d, i) => (
        <path key={route.segments[i]?.start ?? i} d={d} fill="none" className="stroke-tint" strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  );
}
```

Run: `npm run e2e:acceptance -- --only=PERF01,V-J33,J11,M01`
Expected: PASS. The thumbnail still grows into the detail's frame (M14), and a sheet still dims what's behind it: check both once by eye in `npm run dev` (Today's log → a walk with a route; Home → "How are you today?"), in light and dark.

- [ ] **Step 8: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add scripts/e2e/acceptance/journeys/v40.mjs scripts/e2e/acceptance/journeys/v41.mjs scripts/e2e/acceptance/journeys/v42.mjs scripts/e2e/acceptance/journeys/p01.mjs src/screens/walk/RouteThumb.tsx src/components/ui/sheet.tsx src/components/ui/dialog.tsx src/components/motion/MotionView.tsx
git commit -m "test: Add acceptance V-J40, V-J41, V-J42 and the budget journey; no full-page blur, and one route thumbnail named at a time"
```

---

### Task 17: The performance budget's results, and the checks only an iPhone can do (J§21.3, motion §7)

**Files:**
- Modify: `docs/reimagine/BOARD.md`

**Interfaces:** none. This is the release checklist J§21.3 asks for ("glass in transitions, Wake Lock, motion steps, Safari to installed data, VoiceOver, and older-adult sessions"), with background GPS, the update path, two tabs, Plan 2's M3 Back and Plan 6's seven checks folded in, so one list holds every device-only check v2 has.

- [ ] **Step 1: Measure the first screen again**

```bash
npm run build > /tmp/fit-checks/build-v2-p8.log 2>&1; tail -n 5 /tmp/fit-checks/build-v2-p8.log
npm run perf:first-screen
```

Expected: within the budget Task 1 recorded, plus 10%. Over it: find what joined the first screen (`npx vite build --mode production` prints the chunks; Plan 7's `boundaries.node.test.ts` names static imports from `src/main.tsx`), and move it behind the screen that needs it. Never raise the budget to fit.

- [ ] **Step 2: Append the entry.** Fill each "Result" cell as the run reported it. The device rows stay "Not run yet" until someone runs them on the phone; each result names the phone, its iOS version, and the build's commit.

```markdown
### 2026-10-1x — [claude] v2 Plan 8 (Hardening): the budget, and the checks only an iPhone can do

**Measured here** (D117, D121, motion §7):

| Check | How | Result |
| --- | --- | --- |
| First screen's JavaScript | `npm run perf:first-screen`: the entry and its preloads, gzipped, within 10% of `scripts/perf/budget.json` | |
| At most two blurred surfaces, each a bar or a sheet's header, none over a fifth of the screen | PERF01 steps 1 and 5: Home and a hub scrolled under their bars, a sheet open, an exercise's page | |
| One animated shared element per view transition, beyond the page and the stationary navigation snapshots | PERF01 steps 2 and 4: a tile's morph; Today's log with two route thumbnails | |
| The live route redrawn at most once in any second, while five fixes it accepts move it in half a second | PERF01 step 3, after the same check refuses a drawing changed ten times a second, and fails with the route's own throttle taken out (Task 16, Step 5) | |
| The 3D demo's drawing stops while the app is hidden, and while the demo is off screen | PERF01 step 5: its WebGL draw calls, counted | |
| An update waiting for FitStrong's windows, a restart from Home, a migration at the new release's start, a failed install, a window keeping its own release offline, and a first visit taken over by its release's first worker, between two real releases | V-J38 cases 5 to 9, in Chromium, with the releases' own workers | |

**Only an iPhone can show these.** The reference phone is an iPhone 13 Pro Max on iOS 27 with Safari 27; repeat on the oldest iPhone that runs iOS 27 where a row says so. The app is the deployed build, installed from Safari unless a row says Safari. Each row: its steps, then what must be seen.

| # | Check | Steps | Must see | Result |
| --- | --- | --- | --- | --- |
| 1 | Glass in transitions (M3, WebKit 302256) | Home → the Workout tile → its hub → Back. Then Trends → scroll a chart under the nav bar. Then Settings → Accessibility → Display & Text Size → Reduce Transparency on, and again with Increase Contrast on | The nav and tab bars are drawn solid while a transition runs, with no flash or smear; over a busy page the tab labels stay readable; with Reduce Transparency every glass surface is solid; with Increase Contrast they have a 1 px border; a sheet dims the page behind it, without blurring it | Not run yet |
| 2 | M3's Back with the tile off screen (Plan 2's deferral) | Settings → Accessibility → Display & Text Size → Larger Text at its largest. Home: scroll until the Workout tile is the last visible → open it → Back. Then open the Workout hub from Browse instead, and Back | With the tile on screen, the hub's card shrinks into it; from Browse (no tile on screen), a plain fade, never a shrink into nothing | Not run yet |
| 3 | Frames (motion §7) | Mac Safari → Develop → the iPhone → the app; Timelines → Rendering Frames. The phone in Low Power Mode (Settings → Battery), text at 200%, after 10 minutes of use. Record M3 (tile → hub), M4, M5, M8 (Undo) and M10 (the live walk's start) | Fewer than 5% of frames over 16.7 ms in each. Over budget: that motion falls back to its Reduce Motion version, as a board decision | Not run yet |
| 4 | Wake Lock, in Safari and installed (Plan 6 #4) | Settings → Display & Brightness → Auto-Lock 30 seconds. Start a walk; leave the phone face up, untouched, for 15 minutes. Then turn Low Power Mode on and start another | The screen stays on through the first walk; when the lock is refused or released, "Keep this screen on to keep tracking." shows | Not run yet |
| 5 | Background GPS and the screen lock (Plan 6 #6) | Location allowed, routes kept. Walk 5 minutes outdoors, lock the phone for 2 minutes while walking, unlock, walk 3 more, Finish | "Recording paused while the app was away" on return; the route shows two lines with the gap unjoined; the recorded time leaves the locked minutes out | Not run yet |
| 6 | Motion steps (Plan 6 #1, #2) | Each cold launch, start a walk with steps on. Count 200 steps by hand: a slow gait (about 1.5 steps a second), with a walking stick, and with the phone in the hand, a trouser pocket, a shirt pocket and on a lanyard; once with a limping gait | The permission prompt appears from the tap that starts the walk, not before; "Don't Allow" gives "Steps not counted"; each count within ±10%, a limp counting both legs | Not run yet |
| 7 | Audio cues (Plan 6 #3, B-30) | A walk with the voice on. At 10 minutes, let the cue start, then take a call (or pull the headphones out) mid-cue. Carry on to 20 minutes. Reload mid-walk once | The 10-minute cue plays after the start tap; the call stops it and it never resumes; the 20-minute cue plays; after the reload, "Turn the voice on" unlocks it | Not run yet |
| 8 | The clock and the time zone (Plan 6 #7, V-J41) | At 4:55 pm, start a walk. Settings → General → Date & Time → Set Automatically off, Time Zone to Auckland; back to the walk for 2 minutes; then the time set back 20 minutes | The walked time stays right through both; Today's log puts the walk on the day it was started; after the time change, a restart asks for a fresh glucose reading | Not run yet |
| 9 | Map pictures on the deployed site (Plan 6 #5) | Map pictures on; save a walk with a route; open its summary; Safari's Web Inspector → Network | Each tile request carries the site's Referer and returns 200; none during the live walk; the credit link opens OpenStreetMap's copyright page | Not run yet |
| 10 | VoiceOver, at 200% text (V-J40) | Settings → Accessibility → VoiceOver on, Larger Text at 200%. Blood pressure → Add reading → two readings, the second after the guided minute → Save. Then Today's log → Recently deleted → swipe to a Restore button | "A minute has passed: you can take the second reading now." is spoken without moving the cursor out of the field; after Save the cursor is on "Add reading"; each Restore button is read as "Restore" and what it restores; the rotor lists each tab's headings | Not run yet |
| 11 | Safari to installed, with the data (V-J37) | In Safari, set up a synthetic record (a reading, a stretch, a walk, a meal); Me → Data → Back up your record → Save to Files. Share → Add to Home Screen. Open the installed app → Restore from a backup → that file | The installed app shows every record: the reading, the session, the walk, the meal. Afterwards, Settings → Apps → Safari → Advanced → Website Data removes the Safari copy | Not run yet |
| 12 | An update during a walk, on the phone (V-J38) | Installed app on build A; start a walk. Deploy build B. Walk 2 more minutes, lock and unlock once, then Finish, Save, Done, Home. Then swipe the app away in the app switcher and open it again | No reload during the walk or the summary; Home says "An update is ready. It applies the next time FitStrong opens." with "Restart to update"; opened again, build B, with "Updated. FitStrong is on its latest version." on Home until Dismiss; the walk is in Today's log once | Not run yet |
| 13 | Two windows and an update, in Safari (B-21, V-J38) | Safari, build A, two tabs. Start a walk in the first. Deploy build B; reload the second tab | Neither tab reloads by itself; both tabs' Home say "Close FitStrong’s other windows to update now.", with no Restart; once the walk is saved and the second tab closed, the first tab's Home offers "Restart to update": tapped, "Restarting to update…" covers the app, which takes no tap, and it reloads once onto B; the walk is in Today's log once | Not run yet |
| 14 | Older-adult sessions (A-76, J§21.3) | Three volunteers aged 60 or over, each on the reference phone, consent recorded outside the repository. Tasks: V-J01 (the first morning), V-J05 (a blood pressure check day), V-J32 (delete and Undo), and finding Recently deleted unaided | Each task finished without help, or the first point help was needed. Record per participant: "Participant 1–3", task, finished or not, time, and where they hesitated. No names, ages or health details | Not run yet |

v2 isn't released until every row above has a result, and each fault found is fixed or recorded here as a decision.
```

- [ ] **Step 3: Commit**

```bash
git add docs/reimagine/BOARD.md
git commit -m "docs: Record Plan 8's budget results and the checks only an iPhone can do"
```

---

### Task 18: Every journey at both sizes, light and dark, strictly; the whole-v2 reviews; and the draft PR

**Files:**
- Create: `scripts/journeys-inventory.mjs`
- Modify: whatever the findings touch; `docs/reimagine/BOARD.md`

**Interfaces:**
- Consumes: `norm` (Task 1's `scripts/e2e/acceptance/lib/ids.mjs`); `npm run e2e:acceptance -- --strict` (Task 12, D121).
- Produces: `node scripts/journeys-inventory.mjs`, which exits 1 when a J or V journey is missing or listed twice (Codex P8-27).

- [ ] **Step 1: Every gate, and the production build**

```bash
mkdir -p /tmp/fit-checks
npx tsc -b && npm run lint && npx vitest run > /tmp/fit-checks/unit-v2-p8.log 2>&1; tail -n 15 /tmp/fit-checks/unit-v2-p8.log
npm run build > /tmp/fit-checks/build-v2-p8.log 2>&1; tail -n 15 /tmp/fit-checks/build-v2-p8.log
npm run perf:first-screen
```

Expected: every unit test passes, the build succeeds, and the first screen is within its budget.

- [ ] **Step 2: Every journey is there, once.** V-J01 to V-J42 belong to Plans 2 to 8, and J01 to J20 to the suite since v1. Write `scripts/journeys-inventory.mjs`:

```js
#!/usr/bin/env node
/**
 * Every J and V journey in the acceptance suite exactly once, by its
 * normalised id (board D105, D121; Codex P8-27): J01–J20 and V-J01–V-J42.
 * Exits 1 on any missing or doubled id, so a release can't go ahead short of
 * one or with two journeys claiming the same.
 *
 *   node scripts/journeys-inventory.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { norm } from './e2e/acceptance/lib/ids.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'e2e/acceptance/journeys');
const pad = n => String(n).padStart(2, '0');
const want = [...Array.from({ length: 20 }, (_, i) => `J${pad(i + 1)}`), ...Array.from({ length: 42 }, (_, i) => `V${pad(i + 1)}`)];

const found = [];
for (const file of fs.readdirSync(DIR).filter(f => /^[jmpsv]\d\d\.mjs$/.test(f)).sort()) {
  const { id } = await import(pathToFileURL(path.join(DIR, file)).href);
  found.push({ file, id: norm(id) });
}
const missing = want.filter(w => !found.some(f => f.id === w));
const twice = [...new Set(found.map(f => f.id))].filter(id => found.filter(f => f.id === id).length > 1);

for (const id of twice) console.error(`${id} is claimed by ${found.filter(f => f.id === id).map(f => f.file).join(' and ')}.`);
if (missing.length) console.error(`Missing: ${missing.join(', ')}.`);
if (missing.length || twice.length) process.exit(1);
console.log(`All of J01–J20 and V-J01–V-J42 are in the suite, each once (${found.length} journeys in all).`);
```

Run:

```bash
node scripts/journeys-inventory.mjs; echo "exit $?"
```

Expected: "All of J01–J20 and V-J01–V-J42 are in the suite, each once (… journeys in all).", and `exit 0`. A missing one belongs to the plan the roadmap gave it: stop, and finish that plan's acceptance task first. Two files claiming one id (`VJ07` and `V-J07`, say) is a mistake in one of them: fix its `id`.

```bash
git add scripts/journeys-inventory.mjs
git commit -m "test: Stop the release when a journey is missing or claimed twice"
```

- [ ] **Step 3: The whole suite, at both sizes, in light and dark, strictly**

```bash
npm run e2e:acceptance -- --strict > /tmp/fit-checks/accept-v2-p8.log 2>&1; echo "exit $?"; tail -n 60 /tmp/fit-checks/accept-v2-p8.log
```

Expected: `exit 0`: every case passed in all four projects (428×926 and 320×568, each light and dark), J01–J20, V-J01–V-J42, M01, M02, S01 and S02, and PERF01 in large light, the one project it names; nothing pending (V-J31's was the last, and Task 9 closed it). A non-zero exit names each case not passed and each pending one. For each failure, decide whether a journey's steps no longer match a deliberate change (fix the journey, and say why on the board) or the app regressed (fix the app, with a failing unit test first). Clinical assertions are never loosened (A-76).

- [ ] **Step 4: The bundle and the prompt for the whole-v2 review**

```bash
git diff --stat main...HEAD > /tmp/fit-checks/v2-stat.txt
{ cat docs/superpowers/plans/2026-10-08-fitstrong-v2-roadmap.md docs/superpowers/plans/2026-10-10-fitstrong-v2-plan-8-hardening.md; printf '\n\n## The files v2 changed\n\n'; cat /tmp/fit-checks/v2-stat.txt; } > /tmp/fit-checks/v2-bundle.md
cat > /tmp/fit-checks/v2-prompt.md <<'EOF'
Review FitStrong v2 as a whole, statically, at maximum effort: the branch feat/v2-journey against main (git diff main...HEAD). The roadmap, Plan 8 and the changed files are listed in /tmp/fit-checks/v2-bundle.md. The spec is docs/superpowers/specs/2026-10-08-fitstrong-v2-journey-design.md (§25 overrides earlier text), with the motion spec and the audit log beside it; decisions are on docs/reimagine/BOARD.md. Read every file the diff touches in full. Report each real bug as: id, severity, file:line, what a person would see, and a failing test (Vitest node, or an acceptance step) that would catch it. Look hardest at: anything that starts movement without the shared gate, or lets a later reading, an import, a delete, a retime, a correction, an Undo or a restore resolve a real low, stop or flag, any change to a reading or a check-in the store's own judgement doesn't see, a mistake answer naming a reading the person didn't, a clinical change made while the phone's clock change holds the device, or a correction that loses what it replaced (J§4.6, D119); a service worker that takes over by itself other than a first visit, an automatic reload of any kind, a Restart offered with a walk, a manual workout or a write under way or another window open, new work let in while the restart waits, a data migration run while a window of the older release is open, or storage lost mid-use taking the screen with it (B-21, D106, D107); a release cached in part, a cached URL that could hold another release's bytes, a window served another release's shell, model or screens, or a release's cache deleted while a window still runs it or one installs after it (D120); a backup refused that this app wrote, or a hostile file read or converted before its limits are checked (B-26, D108); a restore that brings a deleted record back twice, loses its references, its order or what was recorded with it, restores an entry past its 7 days, keeps a coordinate after "Erase all routes", lets a file or a Replace change this device's lineage, or survives a merge through a renamed id (B-05, D109, D110); an Undo that outlives its screen, survives an edit, ends another's, or says anything on a timer (B-04, D113); a food figure, or an activity-energy figure, shown counts-free, or without "Estimated" (B-11); a time zone or clock change that moves a record's day or makes a reading fresh (B-19); a control under 48 × 48 px, a main target under 60 px tall, bezelled controls closer than 12 px, or two controls under one finger (J§20.4 rule 1, D122); health data leaving the device. No style comments.
EOF
codex exec -m openai.gpt-6.1-sol -c model_reasoning_effort='"max"' -c 'model_providers.amazon-bedrock.aws.region="us-east-1"' -s read-only -C "$PWD" -o /tmp/fit-checks/v2-codex.md - < /tmp/fit-checks/v2-prompt.md
```

A max-effort run over the whole branch takes a long time: run it in the background, and don't change the repository while it reads.

- [ ] **Step 5: Kiro, on the same branch, read-only**

```bash
kiro-cli chat --no-interactive --trust-tools=fs_read --model claude-opus-5.5 "$(cat /tmp/fit-checks/v2-prompt.md) Read the bundle at /tmp/fit-checks/v2-bundle.md, and the files it names with git and fs_read. Write nothing." > /tmp/fit-checks/v2-kiro.md 2>&1
```

- [ ] **Step 6: Reconcile.** For each finding from either review:
  - reproduce it with a failing test first (unit, or an acceptance step);
  - fix it, and run the gates;
  - or, if it isn't real, write down why.

  Then append to `docs/reimagine/BOARD.md` an entry headed `### <date> — [claude] v2 reviewed whole by Codex and Kiro, reconciled`, listing each finding's id, what it was, and its fix commit or why it was set aside. Re-run Codex on the fix set until a round reports no new bug, as Plans 1 to 7 did.

- [ ] **Step 7: The final run, and the results on the board**

```bash
npx tsc -b && npm run lint && npx vitest run
node scripts/journeys-inventory.mjs
npm run e2e:acceptance -- --strict > /tmp/fit-checks/accept-v2-final.log 2>&1; echo "exit $?"; tail -n 60 /tmp/fit-checks/accept-v2-final.log
git add -A src scripts public docs/reimagine/BOARD.md
git commit -m "fix: Reconcile the whole-v2 review findings"
```

Expected: every gate passes, the inventory and the strict run both exit 0. Append the counts to the board entry: unit tests, and acceptance cases passed per project, with the report's path.

```markdown
### 2026-10-1x — [claude] v2 Plan 8 (Hardening): acceptance

| Journey | What it proves | Result |
| --- | --- | --- |
| V-J21 | A low in a running stretch: its guidance left by its own way out, earphone Play on it and a stray press after it moving nothing the run saved, until a 15-minute re-check releases it | |
| V-J22 | A serious low while every write fails: the guidance at once, "Not saved", "Try saving again", never "Saved"; then saved once | |
| V-J23 | 186/98 with an empty second reading: the guidance before the minute; one reading kept; Home acts on it | |
| V-J25 | Away, and Unwell (B-30): no Carry on while paused; the 3-day shift accepted, then declined; Carry on back | |
| V-J32 | Two deletes, two Undos; one undone under a fresh id with its deletion record kept, said in place; the other from Recently deleted; 500 ml throughout. A serious low's delete and correction refused in place while it holds; "It was a mistake", then deleted with its Undo, and restored still answered | |
| V-J36 | The limits listed; six files past them, each refused in its own words with nothing changed; a valid one merged with each collection named; a record past a limit backed up whole, with its warning, and refused on restore | |
| V-J38 | Nothing reloads by itself, under a walk, a typed form however it closes, the profile's edit cover, or a phone locked; Restart on Home only with nothing under way and no other window, behind a cover that takes no tap while a slow worker answers; "Updated" until dismissed; a newer copy's database said in true words, its upgrade interrupted and reopened; storage lost mid-use keeping the app, read-only; two real releases: one waiting while a second window is open and applying at the next open, a restart from Home after a walk, a failed install changing nothing, a window keeping its own release's files offline, and a first visit taken over by its release's first worker | |
| V-J40 | At 200% text: the minute's announcement keeps focus, Save returns it; an interrupted cue never resumes | |
| V-J41 | A time-zone change into the next day and the clock set back, mid-walk: the right time, each record's day and offset, a hold for a new reading; a clock a day on and back with a serious low and an entry in Recently deleted: neither changed | |
| V-J42 | After week 12: nothing planned, stale and empty resume links open the choice, real progress resumes, a run at midnight stays; week 12's last session finished and the next day in one run; Stretch and Walk carry on; "Choose what’s next" with both choices | |
| PERF01 | The automated parts of motion §7 | |
| Every journey | J01–J20 and V-J01–V-J42 at 428×926 and 320×568, light and dark, `--strict`, nothing pending | |
```

- [ ] **Step 8: The draft PR (B-22).** Ask the owner before pushing: the branch goes to GitHub only with their yes. Then:

```bash
cat > /tmp/fit-checks/v2-pr.md <<'EOF'
FitStrong v2: the journey redesign, Plans 1 to 8.

**Do not merge yet.** This branch merges into main only after all eight plans pass (B-22): every unit test, every acceptance journey at 428×926 and 320×568 in light and dark with the strict release run, the whole-v2 Codex and Kiro reviews reconciled, and every row of the device checklist on docs/reimagine/BOARD.md run on an iPhone with a result.

What it holds:
- Home with tiles and one Right now card, every category's hub, Trends, Browse, Me (Plans 1–4);
- setup and the v1 upgrade (Plan 5); walks with routes and maps by consent (Plan 6); food logging with estimates only when chosen (Plan 7);
- hardening (Plan 8): updates that install whole and wait for FitStrong's windows to close, with Restart to update on Home; no change that would lift a hold; published backup limits; Undo and Recently deleted; own foods edited; Food's trend, Browse's food rows, the end of the programme, every target sized, and the performance budget.

Health data stays on the device: no account, no server, no API key.
EOF
git push -u origin feat/v2-journey
gh pr create --draft --base main --head feat/v2-journey --title "FitStrong v2: the journey redesign (Plans 1–8)" --body-file /tmp/fit-checks/v2-pr.md
```

Expected: a draft PR. Nothing in this plan marks it ready or merges it.

---

## Self-review

Run against the spec with the plan finished, as the writing-plans checklist asks.

**1. Spec coverage.** Each requirement, and the task that builds or proves it.

| Spec | What it asks | Task |
| --- | --- | --- |
| J§17.2 #21 | A low during a session → close the sheet → Resume and earphone Play held until the release | 12, 14 (V-J21: the guidance left by its own way out; Play's handler pressed, and a stray one after leaving; the session's own Resume and `?resume=1` tried; the run's saved progress unmoved); J13 step 4 keeps the hold itself |
| J§17.2 #22, J§4.5 | A dangerous reading while storage fails → guidance, "Try again", no "Saved" | 14 (V-J22); 15 (V-J38 case 10, storage lost while the app runs) |
| J§17.2 #23, J§4.4 | A severe first BP with an empty second → guidance at once; the first kept | 14 (V-J23) |
| J§17.2 #25, B-30 | Away, then Normal → no Carry on while away → the shift offer; the Unwell variant | 14 (V-J25); J07 steps 5–6 keep the offer's dates |
| J§17.2 #32, B-04, B-05 | Two deletes, both Undos stacked; Undo the first under a fresh id, its deletion record kept (D112); totals right | 5, 7, 8, 15 (V-J32) |
| J§4.6, A-05 | Undo, delete, retiming, imports and later readings never resolve a real low, stop or flag; corrections keep their history | 6 (D119: every change that takes a clinical measurement away judged, whoever asks; "It was a mistake" for exactly those measurements; the clock change's hold; a correction's history on its record), 7 (refused in place), 15 (V-J32's second case), 16 (V-J41's third case) |
| J§17.2 #36, B-26 | A malformed or oversized file → a specific refusal, data untouched → a valid file → merge | 4, 15 (V-J36); J19 keeps the malformed-format cases |
| J§17.2 #38, J§21.2, B-21 | An update during a walk or a sheet never reloads; "Updated" on the next Home; two tabs; an interrupted upgrade | 2, 3, 12, 15 (V-J38's ten cases, five of them on two real releases); storage full is J17 steps 1–2 and V-J03 (D118) |
| J§17.2 #40, B-30 | 200% text, the minute's announcement keeps focus, focus restored; an interrupted cue | 12, 16 (V-J40); VoiceOver on the device (17, row 10) |
| J§17.2 #41, A-75, B-19 | A time-zone change mid-walk: right elapsed time, days kept, nothing made fresh by a clock jump | 12, 16 (V-J41: a zone change across a date, the clock set back, and a clock a day on and back with a serious low); 6 (no clinical change under the clock change's hold); Plan 6's rules |
| J§17.2 #42 | Week 12 finishes; Stretch and Walk carry on; "What next?" chosen; nothing invented | 11, 16 (V-J42, the chain from week 12's last session into the next day included) |
| J§21.2, A-58 | Each release cached atomically with a version stamp; lazy screens precached; no reload during a task; "Updated" on the next Home | 2 (D106, D120: every file named by its bytes, fetched past the HTTP cache; numbered caches), 15 |
| B-21 | `blocked` and `versionchange` handled; migration and activation deferred until active tasks are saved or discarded; two tabs and an interrupted upgrade | 2 (activation only once no old window is left, a first visit's included, or at a lone window's restart behind its cover), 3 (`upgrade.test.ts`; storage lost mid-use read-only), 12 (two real releases), 15 (V-J38 cases 3 to 6, 9 and 10) |
| B-26 | Limits published; every store's conflict preview; Replace and Merge one transaction (`applyImport`'s one `commitChange`, unchanged); map consent kept (Plan 6) | 4, 15 |
| J§18.1 `deleted.recent` (amended by D109), J§20.4 rule 6 | 7 days; "Recently deleted" in Today's log, each with Restore | 5, 8 |
| B-05 | Fresh id with `restoredFrom`; the deletion record kept; references rewritten in one transaction; dependents kept 7 days; "Erase all routes" clears deletion payloads | 5 (D110, D111) |
| B-04, M19 | Two Undos within the screen and its details; another delete stacks; restoring one keeps the other; leaving or an unrelated edit ends it; routine deletes at once; never on a timer | 7 (D113) |
| J§11.4–11.5, B-11, K-22 | Food's trend: "Estimated", "in logged foods", unknowns unknown, counts-free shows none, carbs as ranges, no judgement; counts-free everywhere, history included | 9 (D114), 8 (Recently deleted as the choice is now) |
| J§14 | Browse's food results | 10 (D115) |
| J§20.4 rules 1, 4, 8, 9 | 48 × 48 targets, 12 px between bezelled controls, main targets 60 px tall; a verb on each primary; nothing on a timer; errors beside their cause | 13 (D122, S02), 11 (K8-05), 2, 7, 8 (K8-03), 6 (`HeldProblem`) |
| Motion §7 | The budget: blur, shared elements, the live route, the 3D demo; frames on the device | 1, 16 (PERF01, D117), 17 |
| J§21.3 | Device-only checks: glass in transitions, Wake Lock, motion steps, Safari to installed data, VoiceOver, older-adult sessions | 17 |
| J§2, A-60 | 428×926 CSS px, and 320×568 | 12, 18 |
| J§1.2, A-76 | Navigation-only changes to old journeys; clinical assertions never loosened | 12, 18 |
| B-22 | `feat/v2-journey` merges only after Plans 1–8 pass | 18 (a draft PR, never merged here) |
| Roadmap, Plan 8 | Every V-J and J at both sizes, light and dark; Codex and Kiro whole-v2 reviews; the v2 PR draft | 18 (`--strict`, D121) |

Deliberate changes from the spec's letter, each a board decision the owner should confirm:
- **D109 amends J§18.1.** J§18.1 keeps `deleted.recent` in the settings; Plan 8 keeps each deletion as its own content-state row, never in a backup, because the settings document travels in every backup and a deleted walk's route would ride in it. A `settings.deleted.recent` that arrives is dropped at start, on import, on export and by "Erase all routes". The behaviour J§18.1 and §20.4 ask for is unchanged.
- **D112 follows B-05 over V-J32's wording:** the original's deletion record stays.
- **D119 refuses where a confirmation might have been asked.** A change that would lift a hold is refused until the engine releases it, or until exactly the measurements it takes away are answered as typed wrongly; while the phone's clock change holds the device, no clinical change is made at all. Nothing is deleted behind a confirmation, and nothing is kept on the side.
- **D106 applies an update at the next open, not on the next Home.** J§21.2's "It waits, then shows 'Updated' on the next Home" holds: the first Home on the new release says it. Applying sooner is the person's own Restart on Home. The very first release on a device takes over the page it was installed from; nothing else takes a page over.
- **V-J21's "close the sheet"** is the player's full-screen low guidance, left by its own "Leave, and come back later": the app has no sheet there, and the journey requires that exit (Task 14).

**2. Placeholder scan.** No "TBD", "TODO", "implement later", "similar to Task N" or step without its code. Every code step has its code. Where a step edits a file Plans 3, 4, 5, 6 or 7 write, it names the exact line or block to change. Task 13's fix tables name every control the code audit, Plan 6's open items and Plan 7's food screens found short; the one rule for a finding S02 names beyond them is stated with its fix, not left open.

**3. Type consistency.**
- `releaseFiles`, `releaseStamp` (Task 2) are what `vite.config.ts` uses; `public/sw.js`'s cache `fitstrong-<NUMBER>-<BUILD>`, its shell `shell-<BUILD>.html`, its placeholders `[/* __PRECACHE__ */]`, `'__BUILD__'` and `'__NUMBER__'`, its `windows` and `restart` questions and their answer `{ build, windows, restarting }` are what `vite.config.ts`, `sw.node.test.ts`, `updates.ts`, Task 12's driven worker, `releases.build`, `releases.cache`, `releases.broken` and V-J38 read. `MODEL_URL` (Task 2) is what `MotionView.tsx` and `lab.ts` load.
- `startUpdates`, `countWindows`, `restartToUpdate` (`'restarting' | 'others' | 'busy' | 'none'`), `dismissUpdated`, `useUpdates`, `updateLine`, `UpdateDeps`' `underWay`, `hold` and `settled`, `TAKEOVER_MS` and the words `UPDATE_READY`, `CLOSE_OTHERS`, `RESTART`, `RESTARTING`, `UPDATED`, `DISMISS` (Task 2) are what `main.tsx`, `UpdateRow.tsx`, `RestartCover.tsx`, `App.tsx`'s Try again (Task 3), Task 12's `rec.updateLine` and V-J38 use; `underWay` (`src/app/underWay.ts`), `workoutUnderWay` and `noteWorkout` (`src/screens/workout/underWay.ts`), and the store's `holdNewWork`, `whenSettled` and `RESTARTING_REFUSAL` are what `main.tsx`, `UpdateRow.tsx`, `useWorkout.ts` and `restart.callers.test.ts` use.
- `SUCCESSOR`, `DB_VERSION = 2 + SUCCESSOR`, `SCHEMA_VERSION = 6 + SUCCESSOR`, the notices "A newer version of FitStrong is open" and "Close FitStrong’s other tabs", `StoreState.readOnly`, `storageReadOnly`, `setStorageReadOnly` (`src/store/writable.ts`), `READ_ONLY_REASON` and `READ_ONLY_RELEASE` (`src/session/gate.ts`) (Task 3) are what `App.tsx`, the movement gates, V-J38, S02 and Task 12's successor build use.
- `IMPORT_LIMITS`, `COUNT_NAMES`, `countLabel`, `refusal`, `exportWarning`, `tooLarge`, `unpacksTooLarge`, `tooMany`, `tooManyPoints`, `textTooLong`, `tooDeep`, `shapeExcess`, `ShapeStats { frames }`, `legacyExcess`, `countExcess`, `exportExcess`, `readBackupFile`, `limitLines` and `conflictLines` (Task 4) are what `transfer.ts`, `summaries.ts`, `RestoreFlow.tsx`, `DataScreen.tsx`, `DataSheets.tsx`, `useStore.ts` and V-J36's expected words use.
- `RecentDeletion`, `DeleteRequest`, `Restored`, `recentKey`, `isRecentKey`, `lineageKey`, `isLocalKey`, `asRecent`, `recentEntries`, `restorable`, `staleKeys`, `expiryPlan`, `nextExpiry`, `planDeletion`, `planRestore`, `sessionEntry(session, meta, observations?)`, `deviceHistory`, `withoutRecentCarrier`, `recentWithoutRoutes`, `canonical`, `lineageIn`, `throughLineage`, `NOT_RECENT` (Task 5) are what `deleteRecord`, `restoreDeleted`, `expireDeleted`, `armExpiry`, `update`'s `entry`, `eraseRoutes`, `transfer.ts`, `deletion.ts`, `pending.ts`, Task 7's screens and Task 8's rows use; `deleteRecord` resolves with the entry id every `restoreDeleted`, `offerUndo` and `dismissUndoFor` call takes. `Mutation.timed`, `UpdateOptions.content(base)`, `.restored`, `.entry`, `.edit` and `.removeObservations` as a list or a function, `Observation.order`, `nextOrder` and `withWorkoutBack(data, session, id, painAfter?)` (Task 5) are what `restoreDeleted`, `expireDeleted`, `deletion.ts`, `pending.ts`, `compareStatements` and the tests use.
- `KeptReading`, `takenOut`, `withReadingPutBack` (`DailyCheckIn | 'already' | 'newer'`), `restoreCheckInReading`, `CorrectionResult.unchanged`, `ALREADY_BACK`, `NEWER_STAYS` (Task 5) are what Tasks 7 and 8 read.
- `HoldFailure` (`held`, `release`, built with an optional `said`), `isHeld`, `HOLD_REFUSAL`, `MISTAKE_HINT`, `CLOCK_REFUSAL`, `HeldReading` (`db.ts`), `clinicalOf`, `measurements`, `touchesClinical`, `clockHoldOn`, `looser`, `loosens`, `holdLifted(before, after, now, { clock, removedDays })` (`holds.ts`), `Mutation.erasesAll`, `Observation.was`, `MAX_CORRECTIONS`, `CorrectionResult.held`, `answerMistakes` and `HeldProblem`, `MISTAKE_LABEL` (Task 6) are what the store's `planOn` and `clearAll`, `reviseObservation`, `pending.ts`, `EditSheets.tsx`, `RecordDetails.tsx` (Task 7), S02 and V-J32 use.
- `offerUndo`, `UndoOutcome`, `UNDO_LABEL`, `CLOSE_LABEL`, `NOT_RESTORED`, `endUndos`, `dismissUndoFor`, `followPlace`, `follow`, `scopeOf`, `isDetail` and `subscribeEdits` (Task 7) replace Plan 7's `offerFoodUndo`, `endFoodUndos`, `holdFoodUndoScope` and `useFoodUndoScope` everywhere; `deleteMealWithUndo`, `deleteUsualWithUndo`, `deleteOwnFoodWithUndo`, `editOwnFood` and `OwnFoodPage`'s `food` and `action` are what `LogMealSheet.tsx`, `UsualMealsScreen.tsx` and `OwnFoodsScreen.tsx` call; `grep -rn "FoodUndo" src` prints nothing after Task 7.
- `recentRow(e, prefs, today, countsFree?)`, `restoreEntry` (`{ said?, problem? }`) and `RecentlyDeleted` (Task 8) match their tests, `MyDay.tsx` and V-J32's words.
- `foodView`, `foodRow`, `FOOD_METRICS`, `isFoodMetric`, `FOOD_TREND_COPY` and the exported `slotLabel`, `slotName` (Task 9) match `CategoryTrend.tsx`, `TrendsScreen.tsx` and the tests; `TrendData.meals` and `.numbers` are optional, so Plan 3's own callers still compile.
- `foodRows`, `withFoods`, `FOOD_ROWS_MAX` and the `food` `BrowseRow` (Task 10) match `BrowseList.tsx` and `BrowseScreen.tsx`.
- `programmeDone`, `HREF.next`, `CardInput.done`, the `next` action labelled "Choose what’s next", `normalLine`'s `done`, `withRestart`, `admits` and `useAdmission` (Task 11) match every caller, S02 and V-J42.
- Task 12's `rec.*` helpers (`setWindows`, `setRestartDelay` and `updateLine` among them), `releaseServer` with `use`, `broken`, `build`, `cache` and `entry`, the page-side `controlled`, `installNext`, `checkForUpdate`, `hasWaiting`, `cacheNames`, `buildOf`, `mark`, `sameDocument`, `until`, `busiestSecond`, `withinRedrawBudget(times)`, and `t.open({ media, updates, draws, zoneByCdp })`, `t.jumpClock`, `t.setTimezone` are the names Tasks 13 to 16 call.
- `TARGET_RULES`, `EXCEPTIONS`, `collect`, `structure`, `problems` and `structureProblems` (Task 13) are what S02 and its self-check use; S01's `inventory` is exported for S02; `data-main` and `data-embedded` are set where Steps 6 B and D, and Tasks 8 and 11, say.
- D105 to D122 are defined once (Task 1) and cited by number. Of the numbers from D123 on, only Plan 7's D134 (each meal item's own snapshot of an own food, H7-09) and Plan 6's D174 (the device's clock change hold, H6R-02) are cited, as theirs; none is defined here.

**What the simpler designs removed** (from round 2): `src/app/busy.ts`, `taskLock.ts`, `fakeLocks.ts`, `update.ts` and their tests; the modal's and the session's update holds; `persist.ts`'s busy notices; the walk summary's prefetch and its node test; the automatic reload on `vite:preloadError` and the reload gap; the coordinator's `requestReload`; `leaveWhenIdle`, `migrateWhenIdle`, `StoreState.upgradeWaiting`, `wantReload` and the notices "A newer version is waiting" and "Waiting for the app’s other tabs"; both `evidence.ts` modules and their four tests, `Mutation.evidence`, `effectiveCheckIns`' evidence parameter, `ImportPreview.evidence`, the preview's "Deleted readings kept for safety", Task 7's `keptCount` and Task 8's `stillCounts`; `settings.deleted.lineage`, `Change.lineage` and `importCheck.ts`'s lineage spec; Task 12's `takeoverMs`. And in round 4: `Mutation.guard`, `UpdateOptions.guard` and `holds.node.test.ts`'s check of which callers pass them (the store judges every change now); the `for…in` key walker and `ShapeStats.keys` (P8R-13, rejected); `releases.variant`, `releases.size` and `fetchedSize` (a file can no longer change under its name); the "Restarting…" label on Home's row (the cover says it).

**4. Review Focus.** Each line's test, in the task that owns the code:
1. A dangerous reading deleted, retimed or corrected: Task 6, `holds.callers.test.ts`, through the real store and `permission` (a 52's delete and its correction, a check-in's own low corrected, a check-in's 52 corrected through `update` itself, a 186/98 retimed and halved, a pair late in the day and after midnight, a check-in's LO and a top number of 186 alone, two severe readings with one answered and the other still holding, a current single reading's way out, the clock a day on and back with a severe blood pressure and with a mild low, 186/98 corrected to 190/98 keeping 186 on its record, and older backups merged and replaced over a held low); on screen, V-J32's second case (Task 15) and Task 7's `deletes.callers.test.ts`.
2. A merge after a restore: Task 5, `recent.test.ts` "a merge after a restore (Review Focus 2, P8-08, P8-09, P8R-04)", "a dependent deleted on its own, restored after its walk or before it (P8R-05)", "two day totals said at the same moment, and one Undo" (with the device that already holds the later one, P8R-06) and the lineage kept through a Replace (P8S-08), through `planImport`; V-J32 step 4 on screen.
3. "Erase all routes" with a deleted walk and a planted `settings.deleted.recent`: Task 5, `recent.test.ts` "'Erase all routes' reaches Recently deleted" (pure) and `recent.store.test.ts` "'Erase all routes' reaches every carrier" (the store, its raw rows and the next backup).
4. An update under a walk, a manual workout, a typed form, the profile's edit cover, or with another window open: Task 2, `sw.node.test.ts` (no takeover by itself but a first visit's; a restart only from a lone window; each window its own release, offline too, while another waits; every file fetched past the HTTP cache; an install the deploy moved on under refused; only older releases' caches go, never one installing after) and `updates.test.ts` (nothing reloads but the person's own Restart; the cover and the hold before the worker is asked; the restart refused with something under way or another window open), `restart.callers.test.ts` (a manual workout's rest; no new work let in while a slow worker answers); Task 3, `upgrade.test.ts` (storage lost mid-use read-only, nothing new starting); end to end, V-J38's ten cases (Task 15).
5. A hostile file: Task 4, `limits.test.ts` "the walk over a document" (a frame per level, however broad, a 2,00,000-key object included) and "a file past a limit is refused before any record is read or converted", with the legacy conversion's spies; on screen, V-J36's six refusals.

Two inputs the spec implies are tested beyond the five: a backup the app wrote itself past a limit, which still holds everything and says so (Task 4, V-J36's second case), and a stale bookmark, or an empty or expired `?resume=1`, to the guided session after week 12 (Task 11's `admission.test.ts`, V-J42).

**5. Every finding, and where it is resolved now.** Steps are this plan's. "Removed" means the simpler design leaves nothing for the finding to be about, and says why. Rows Codex marked resolved in its round-3 check are as they were, but for a step number that moved.

Codex's first review (P8-01 to P8-28):

| Finding | What it found | Resolved in |
| --- | --- | --- |
| P8-01 | Deleting a dangerous standalone reading could lift its stop | Task 6, Steps 4–6 (every change that takes a clinical measurement away, or removes a check-in, judged by the store for whoever asks; refused if it would loosen a mode's permission, or the day's answer today or tomorrow, unless exactly the measurements it takes away are answered as typed wrongly; nothing clinical changed under the clock change's hold) and Step 2 (through `permission`: delete, retime, halves, correction, a check-in's own correction, a correction through `update`, LO, a top number alone, a pair with one answered, a current single reading, the clock jump); Task 7, Step 10 (refused in place); Task 15, V-J32's second case; D119 |
| P8-02 | The import path wasn't safe under J§4.6 | Header "Depends on" (Plan 6's H6-03); Task 1, Step 2 (its names checked); Task 6, Step 2 ("a backup from before the low, merged either way or replaced over it, leaves it holding") |
| P8-03 | Activation was coordinated only within the asking tab | Task 2: the platform's own lifecycle, across every window at once (a waiting worker activates only when no window of the release in use is left), every window controlled from a first visit on (Step 4, P8S-11), and the only takeover, `restart`, which the worker grants only to FitStrong's only window, behind a cover that lets no new work in (Steps 4, 6–8; P8S-13); Task 15, V-J38 cases 3, 5 and 9; D106 |
| P8-04 | The reload after activation bypassed the busy rule | Task 2: nothing reloads by itself; the one reload follows the person's own Restart, offered only with nothing under way and no other window, asked again at the tap, with no new work let in while the worker answers (Steps 5–8); V-J38 cases 1 to 3 |
| P8-05 | Some things a tab is busy with weren't counted | Task 2, Step 7 (`underWay`: a walk not saved or discarded, a manual workout begun and not finished, its rest included (P8S-12), or a write still queued keeps Restart off Home, and is asked again at the tap); a session or a sheet can't be under it, since a session's page isn't Home and a sheet makes Home inert; nothing else applies an update while any window is open |
| P8-06 | `versionchange` couldn't defer data migrations | Task 3: a migration runs at the new release's start, which comes only once no window of the old one is open, a first visit's included (D107, P8S-11); `upgrade.test.ts` covers a copy outside the worker meeting a newer database, an old connection blocking a newer copy, a newer schema, an interrupted migration, and storage lost while the app runs, read-only with nothing new starting (Step 6, P8S-04); V-J38 cases 4 to 6, 9 and 10 |
| P8-07 | The kept worker didn't make a release atomic and isolated | Task 2, Steps 1–4 (every file named by its bytes and fetched past the HTTP cache; stamped by every byte; installed whole or its cache deleted, a deploy that moves on under it included; each window served its own release, its own shell included; nothing written at run time; only older-numbered caches go at activation; P8S-14, P8S-15); V-J38 cases 7 and 8; D120 |
| P8-08 | Route-only restoration couldn't be merge-safe | Task 5, Step 5 (a walk and its route come back together under a new walk id with `restoredFrom`, its deletion records kept; no route is restored alone) |
| P8-09 | References weren't rewritten through restores | Task 5, Steps 5 and 7 (this device's lineage, read through by every merge and by every later restore, and kept through a Replace; P8R-04, P8R-05, P8S-08) |
| P8-10 | Equal-time statements changed order after Undo | Task 5, Step 4 (`order` on every statement, kept through a restore and a merge, ordering two said at one instant before any commit order; `keepSeq` for statements from before this release); P8R-06 |
| P8-11 | `settings.deleted.recent` could carry coordinates | Task 5, Steps 5, 7, 8 and 10 (stripped at start, on import, on export and by "Erase all routes"; raw rows and the next backup read) |
| P8-12 | A count cap, and no expiry in time | Task 5 (no cap; `expiryPlan` at start, on return and on time while the page runs; a restore checked as it commits, P8S-09; the store test reads IndexedDB itself) |
| P8-13 | Some kinds couldn't be deleted or restored | Tasks 5, 7 and 8 (every kind, a check-in's reading back into its check-in and its series under a context its check-in reads (P8R-03, P8S-07), a session with everything recorded with it (P8S-06)); every shape the engine reads is judged by D119 whatever it is (P8R-02) |
| P8-14 | Undo's scope was a list of routes | Task 7, Steps 1–5 (provenance through router state; a restore that settles after its offer ended says nothing, P8S-16); Step 8 (H7-15) |
| P8-15 | Limits were checked after reading and converting | Task 4, Steps 1, 3, 4 and 7 (unchanged from round 2, resolved) |
| P8-16 | The walk over a document allocated by breadth | Task 4, Steps 1 and 3 (a frame per level and no call stack, its memory bounded by the file-size limit; P8R-13 rejected, below) |
| P8-17 | A backup was promised to fit | Task 4, Steps 3, 7 and 10 (unchanged, resolved) |
| P8-18 | Some collections were missing from the preview | Task 4, Steps 8–10 (unchanged, resolved) |
| P8-19 | Admission after week 12 was decided more than once | Task 11, Steps 1 and 5; Task 16, V-J42 (unchanged, resolved) |
| P8-20 | Journey ids were matched in one form | Task 1, Step 4 (unchanged, resolved) |
| P8-21 | No real deployment or successor upgrade was proved | Task 3, Step 3 (the successor build); Task 12, Step 5 (two numbered real releases at one origin, and a broken copy); Task 15, V-J38 cases 5 to 9 |
| P8-22 | A typed form's closing paths weren't tried | Task 15, V-J38 case 2 (Close, Escape, a swipe, Save, Back, the phone locked) |
| P8-23 | V-J21 didn't press the earphone's own handler | Task 14 (unchanged, resolved) |
| P8-24 | V-J41 crossed no date and set no clock back | Task 16, V-J41 (unchanged, resolved) |
| P8-25 | The route budget could pass a fast drawing | Task 12, Step 4 (`busiestSecond`); Task 16, Steps 4 and 5 (P8R-15) |
| P8-26 | The draw counts weren't the demo's own | Task 12, Steps 2–3; Task 16, Steps 4–7 (unchanged, resolved) |
| P8-27 | Pending cases passed a release run | Task 12, Step 6; Task 18, Steps 2, 3 and 7 (unchanged, resolved) |
| P8-28 | Some reloads bypassed the coordinator | Removed: there is no automatic reload anywhere (Task 2, Step 8: `vite:preloadError`'s goes, and the grep lists only the person's own reloads); the error screen's words and "Back to your walk" (Step 9); the walk's summary always loads from its window's own release, offline too (V-J38 case 8) |

Codex's re-check (P8R-01 to P8R-18):

| Finding | What it found | Resolved in |
| --- | --- | --- |
| P8R-01 | Retiming was exempted from evidence | Task 6: there is no exemption and no evidence; a retime takes the measurement away under its old time, and is judged like any change; Step 2's "the same 186/98 moved to yesterday is refused, and so is taking one of its halves" |
| P8R-02 | LO displays and partial blood pressures had no type | Task 6: the store judges every change by the engine's own answers and its own names for each measurement, a half-entered blood pressure and a meter's LO included, so every shape it reads is covered with no type of its own; Step 2's "a check-in showing LO" and "a top number of 186 entered alone", each refused, through `removeCheckIn` |
| P8R-03 | A check-in reading's restore left no visible row | Task 5, Step 9 (`restoreCheckInReading` writes the rows under fresh ids with `restoredFrom` through `update`'s `restored`, a blood pressure's under a check-in event its check-in reads; `prepare` drops the measurement's deletion record as its row returns and keeps the old id's); Step 10 reads the raw rows; Task 7, Step 12 on screen |
| P8R-04 | An unrelated deletion-bearing merge erased the lineage | Task 5: the lineage moved out of `settings.deleted` into this device's own content rows, which a merge never touches, an import never takes, and a Replace keeps (Steps 5 and 7); Step 1's "unrelated" file across repeated cycles and both policies |
| P8R-05 | A dependent restored later named its deleted parent | Task 5, Step 5 (`relinked`, `withItems`: through the lineage to the record that bears it now, or standing alone); Step 1's tests in both orders and a repeated cycle |
| P8R-06 | A merge still reversed equal-time totals | Task 5, Step 4: every statement carries `order`, the moment it was said, given as it is made, a correction included, and kept through every restore, backup and merge; `compareStatements` orders two said at the same instant by it before any database's commit order. Step 1's "on a device that already holds the later one, the earlier, restored elsewhere, stays the earlier, either policy" and the order test in `observation.test.ts`. J05's file has no `order`, so its commit order decides, never its ids, as before. Statements from before this release have none, and stay as they were; D110 |
| P8R-07 | The shared lock didn't admit tasks | Removed with the lock: the platform activates nothing while any window of the release in use is open, every window controlled from a first visit on (Task 2, D106); the restart itself lets no new work in while it waits (P8S-13) |
| P8R-08 | A recovered walk deadlocked its own migration | Removed with the lock: a migration waits for nothing (Task 3); Step 1's "keeps working where it was, a walk still recoverable, and the next start finishes it" |
| P8R-09 | An old build opening an upgraded database never recovered | Task 3, Steps 1, 5 and 7 (`VersionError` said in true words, nothing saved, no reload loop; Try again restarts onto a waiting release when it's the only window); V-J38 case 4; a compatible build is FitStrong opened again, which the platform serves from the newest release (D107) |
| P8R-10 | The worker served mixed releases | Task 2, Steps 3 and 4 (navigations from the window's own release's shell, cache first; every file named by its bytes, models included, and from that release's cache; a first visit controlled by its release from the start, P8S-11; nothing in a cache another release's, P8S-15); Step 2's worker tests; V-J38 cases 8 and 9 |
| P8R-11 | A third release deleted a cache an open tab needed | Task 2, Step 4 (a cache goes only at the activation of a release numbered after it, which happens only once no window runs it; one installing or waiting after it never goes, P8S-14); Step 2's "lets only the releases before it go at its activation" |
| P8R-12 | The walk summary's prefetch could fail mid-walk | Removed with the prefetch: the window's own release keeps every screen until the window closes; V-J38 case 8 opens the summary offline after a newer release installed |
| P8R-13 | Objects still listed every key | **Rejected**, with this reason: `JSON.parse` has already put the whole document in memory by the time the walk begins, so enumerating an object's keys adds memory in proportion to the document at most, and the published file-size limit (128 MB, checked before a byte is read) bounds that. Task 4 makes no "memory follows depth" claim any more: its walk keeps a frame per level and no call stack, its memory bounded by the file-size limit, and it walks each object's `Object.keys`. The `for…in` generator, `ShapeStats.keys` and the spy test that couldn't see the engine's own enumeration are gone |
| P8R-14 | Expiry and eligibility differed by entry point | Task 5 (`expiryPlan`, the one place, at start, on return and on time through `armExpiry`; `restorable`, asked by every restore inside the transaction that commits it, `timed`, never from a plan made earlier, P8S-09); Step 10's timer test, an expired entry refused by every restore path, and one whose 7 days end while it waits behind another write |
| P8R-15 | The route budget passed without the throttle | Task 12, Step 4 (`busiestSecond`); Task 16, Step 4 (five accepted fixes, each moving the route, within half a second; every redraw timed) and Step 5 (the same case fails with `useEverySecond` taken out) |
| P8R-16 | The target checker accepted overlapping controls | Task 13, Steps 2–3 (any two controls overlapping are a finding unless the inner one's owner marks it `data-embedded`; partial and identical overlaps in the self-check); Step 6 D (the search field's Clear marked) |
| P8R-17 | Two upgrade tests read the database at an old version | Task 3, Step 1 (`rawOpen` asks for no version) |
| P8R-18 | Food's trend imported Plan 3's private helpers | Task 9, Step 3 (exported, with a check); Task 1, Step 2 (Plan 3's helpers checked). Round 2 already exported them in Task 9; what was missing was the dependency check |

Kiro's review (K8-01 to K8-15):

| Finding | What it found | Resolved in |
| --- | --- | --- |
| K8-01 | A clock jump could drop a deleted low's evidence | Removed with the evidence: a reading that holds can't be deleted, so nothing is kept to drop; while the phone's clock change holds the device, no clinical measurement is changed or removed at all (Task 6, Step 2's clock a day on and back, with a severe blood pressure and a mild low; P8S-02); Recently deleted never expires on a clock behind its last run (Task 5, Steps 1 and 10); Task 16, V-J41's third case (a serious low, the clock a day on and back; the water kept in Recently deleted) |
| K8-02 | Some full-screen forms didn't hold updates | Removed: nothing reloads by itself, so no form needs to hold anything (Task 2); Task 15, V-J38 case 2, step 6 (the profile's edit cover, with the phone locked) |
| K8-03 | Some messages vanished on a timer | Task 2 ("Updated" until dismissed), Task 7 (an Undo's outcome said in its own toast, with Close; "puts nothing on a timer"), Task 8 (said under the list until the sheet closes); V-J32 and V-J38 look again minutes later |
| K8-04 | Main targets were only filled buttons, and S02 skipped Plan 8's screens | Task 13 (`data-main` for the named main targets; `UNDO_STYLE` at 60 px; S02's "Plan 8’s own screens" case: an Undo toast, Recently deleted, a held reading's refusal, what a backup can hold, your own foods and their edit sheet, Food's trend, Browse's food rows, Home's update line, the error screen, after week 12 and its restart sheet, and the storage screen); Tasks 8 and 11 mark and size Restore and Your plan's choices |
| K8-05 | "What next?" isn't a verb | Task 11 ("Choose what’s next" on the button; the group keeps the question); Task 16, V-J42; D116 |
| K8-06 | A restore with nothing to do looked like a failure | Task 5 (`withReadingPutBack`'s `'already'` and `'newer'`; the entry used up in the same write; `unchanged`), Task 7 (said in place, never as a failure), Task 8 (said under the list, the row gone); `recent.store.test.ts` |
| K8-07 | A correction kept no trace of the dangerous reading | Task 6: a correction that would lift a hold is refused; "It was a mistake" records the answer about exactly the measurement it takes away, and the correction then goes through; every correction keeps the version it replaced on its own record, the hold's or not (Step 7, P8S-05); Step 2's "52 corrected to 152" and "186/98 corrected to 190/98" |
| K8-08 | Only today's answer was judged | Task 6, Step 5 (`holdLifted` asks the engine for today and tomorrow); Step 2's "a pair late in the day, judged for tomorrow too, and still the next morning when it is yesterday’s" |
| K8-09 | A forgotten tab could block a migration for good | Removed: no migration waits on another window (D107); a newer copy blocked by an old connection says "Close FitStrong’s other tabs" and carries on by itself once it closes; a copy that loses its storage while it runs keeps every screen, its answers and its guidance, read-only (Task 3, Steps 1 and 6, P8S-04; V-J38 case 10). Safari and the Home Screen app don't share storage on iOS, so they can't block each other |
| K8-10 | A blocked reload was never retried | Removed: there is no automatic reload, so nothing waits to retry (Task 2); V-J38 case 2, step 5 (Restart left untapped, nothing reloads) |
| K8-11 | Two names for the content-state count | Task 4 ("Learn progress entries", one name everywhere; the safety entries are gone with the evidence) |
| K8-12 | A held delete's Undo said the wrong release | Removed: a reading that holds isn't deleted, so no Undo says it "still counts"; the refusal says why, beside the control, and names v1's way out (Tasks 6 and 7) |
| K8-13 | V-J21 never tried Resume or `?resume=1` | Task 14, V-J21 steps 2 and 3 |
| K8-14 | The error screen promised too much | Task 2, Step 9 ("Your saved records are safe.") |
| K8-15 | V-J42 didn't chain week 12's last session into the next day | Task 16, V-J42's "week 12’s last session finished, then the next day in the same run" |

Codex's round-3 check (P8S-01 to P8S-17):

| Finding | What it found | Resolved in |
| --- | --- | --- |
| P8S-01 | Episodes that disappear aren't the readings the person said were mistakes; a current single reading had no way out | Task 6, Step 5 (`measurements`: what a change takes away, by the engine's own names; `holdLifted` lets the change through once exactly those are answered, by `standingAnswer`, and names only those as `held`); Step 2's "two severe readings, one of them deleted: only that one is answered, and the other still holds after a normal reading" and "a current single reading: its way out is ‘It was a mistake’, and then it goes"; D119 |
| P8S-02 | A forward clock jump made a held reading deletable | Task 6, Steps 4 to 6 (`clockHoldOn`: while Plan 6's device clock hold stands, every change that takes a clinical measurement away is refused, `CLOCK_REFUSAL`); Step 2's "the clock a day on, a delete refused, the clock back" for a single severe blood pressure and a mild low, through `deleteRecord` and `permission`; Task 1, Step 2 checks `markClockChange` and `ClockHold` |
| P8S-03 | The guard was opt-in, and `update` itself unguarded | Task 6, Step 6 (`planOn` judges every change that `touchesClinical`, whichever function asked; only "Delete all data" is exempt, `erasesAll`); Step 2's "a check-in’s 52 corrected to 152 through the store’s own `update`, outside every caller, is refused the same way"; `Mutation.guard`, `UpdateOptions.guard` and the source-pattern test are gone |
| P8S-04 | Stale storage unmounted the app, its answers and its guidance | Task 3, Step 6 (`StoreState.readOnly` after `leave()`; `App.tsx` shows the storage screen only for a first open that fails; `arrivalGate` and `startGate` start nothing in a read-only window, `READ_ONLY_REASON`); Step 1's "goes read-only, and starts nothing new"; V-J38 case 10 with the full App, a typed form, a 52 saved in the read-only window and a newer copy's upgrade; D107 |
| P8S-05 | A correction the hold allowed kept no history | Task 6, Step 7 (`reviseObservation` keeps each replaced version on the record, `Observation.was`: value, unit, time and when it was corrected); Step 2's "186/98 corrected to 190/98" in Track and in a check-in, read from IndexedDB; `observation.test.ts` |
| P8S-06 | A session's restore lost its corrected pain score | Task 5, Step 9 (`deleteWorkout` archives everything recorded with the session as stored; `restoreWorkout` brings it back under the new id with its `editedAt` and `order`, and the session saying the same score; `update`'s `restored` rows win over a lifted one); Step 8 (`restored`); Step 10's "a pain score corrected since comes back corrected" |
| P8S-07 | A restored BP context didn't parse as its check-in's | Task 5, Step 9 (the stem letters and digits only, the token `checkInDayOf` reads); Step 10's "a blood pressure out and back is that day’s again", with the detail's own correction and delete, and a later save bringing nothing back |
| P8S-08 | Replace cleared this device's lineage | Task 5, Steps 5 and 7 (`deviceHistory`: the lineage and expiry's clock kept through a Replace; only Recently deleted's entries go); Step 1's "keeps the lineage through a Replace from this device’s own backup", both policies; D109 |
| P8S-09 | Eligibility ran in a cached plan, not at the commit | Task 5, Step 8 (`Mutation.timed`: a restore and expiry planned again inside the transaction that commits them); Step 10's "is refused as it commits when its 7 days end while it waits behind another write, whichever kind it is"; D109 |
| P8S-10 | Recently deleted showed an energy figure counts-free | Task 8, Steps 1, 3 and 4 (`recentRow`'s `countsFree`, read as `RecentlyDeleted` draws: the row, Restore's name and what it says); the pure test and `recentRows.store.test.ts`, the choice made after the deletion |
| P8S-11 | An uncontrolled first document let a later release slip past | Task 2, Step 4 (the very first release on a device, with no release cache before it, `clients.claim()`s; every later one waits); Step 6 (`controllerchange` without a restart adopts the page, reloading nothing); Steps 2 and 5's tests; V-J38 case 9 (a first visit with a walk, B installing and waiting, a new window on A, the database untouched) |
| P8S-12 | Home offered Restart during a manual workout | Task 2, Step 7 (`noteWorkout` from `useWorkout`, `workoutUnderWay`, in `underWay`; asked when Home draws and again at the tap); `restart.callers.test.ts` (a set, its rest, Home, the workout saved) and `updates.test.ts`'s "with something under way when it is tapped" |
| P8S-13 | Restart didn't stop new work while it waited | Task 2, Steps 6 to 8 (the cover first, `holdNewWork`, `whenSettled`, then the worker; a refusal lifts both; `RestartCover` over an inert app; a takeover that never comes reloads after `TAKEOVER_MS`); `updates.test.ts`, `restart.callers.test.ts` (a write refused with nothing stored while a slow worker answers); V-J38 case 3, step 4 (real taps and keys under the cover); Task 3, Step 7 (Try again uses it) |
| P8S-14 | B's activation deleted C's cache while C installed | Task 2, Steps 3 and 4 (`fitstrong-<number>-<stamp>`, the number higher for every later release; activation deletes only lower numbers and v1's); Step 2's "lets only the releases before it go at its activation, never one installing after it, which then activates and serves offline"; V-J38 cases 5 and 8 |
| P8S-15 | The stamp didn't verify the bytes installed | Task 2, Steps 3 and 4 (every precached URL named by its bytes, the models and icons included, and the release's own shell by the release; `new Request(url, { cache: 'reload' })`); Step 2's stale HTTP-cache copy and a deploy that moves on under a slow install; Step 11's check that every precached name carries its bytes |
| P8S-16 | A late Undo completion could republish after its scope ended | Task 7, Step 4 (`standing()`: the same offer, of this generation, still in place); Step 1's "says nothing when a restore settles after its Undo has ended, by leaving, an edit or a swipe" |
| P8S-17 | The worker test's Response type made its pass impossible | Task 2, Step 2 (`basic`: the network double's responses are of type `basic`, as a browser's same-origin ones are; the worker's own restriction stays); its "writes nothing at run time but the voice clips" |

Deferred to this plan by Plan 7's review, and Plan 6's open items:

| Item | What it is | Resolved in |
| --- | --- | --- |
| H7-15 | Plan 7's food Undo ended when a detail it was offered from closed | Task 7, Step 7 (food's deletes on the one provenance-scoped stack) and Step 8 (`undo.callers.test.ts`: lunch deleted from its detail opened from Today's log, another meal opened and deleted, both Undos standing, either restored first; the same for two usual meals around the usual meal's logging detail) |
| K7-11 | Own foods couldn't be edited | Task 7, Steps 6, 7 and 9 (`editOwnFood`: a new version of the food's definition, its `updatedAt` moved on under the same id, refused for a food deleted since; `OwnFoodPage` edits; Edit beside Delete in Me → Food → "Your own foods"), Step 6's test (a meal logged before keeps its own snapshot and the version it was; one logged after takes the new version; an edit never brings back a deleted food); Task 1, Step 2 (Plan 7's H7-09 snapshot checked); D111 |
| Plan 6: 44 px controls | The stop sheet, the low guidance and the walk's picker | Task 13, Step 4 (S02 opens each) and Step 6 A |
| Plan 6: checkboxes | The stop questions' 20 px checkboxes in 44 px rows | Task 13, Step 3 (a checkbox is measured by its label's row) and Step 6 A (the rows at 48) |
| Plan 6: Pause at 200% | The live walk's Pause spills out of its half-width slot on a 320 px phone | Task 13, Step 3 (words that don't fit are a finding) and Step 6 D (the row wraps) |
| Plan 6: Browse's More menu | No heading of its own | Task 13, Step 3 (`structure`) and Step 6 D (`ActionMenu`'s title a heading) |
| D93 | Route coordinates in deletion payloads | Task 5, Step 8 (built on Plan 6's `eraseRoutes`: Recently deleted's routes and a planted carrier cleared in its one transaction) and Step 10 (raw rows, state and the next backup read) |
