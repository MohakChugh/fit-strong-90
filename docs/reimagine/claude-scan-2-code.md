# Claude scan 2: code review of the riskiest modules

**Summary:** 10 verified findings: 1 safety, 6 wrong behaviour, 2 performance, 1 maintainability. No data-loss finding in the strict sense, though C2-02 erases a stored answer and C2-01 silently undoes a correction.

The three that matter most:

- **C2-01 (safety).** Correcting a check-in's glucose reading in Track changes only the chart. The check-in record, which every movement gate reads, keeps the old number. A 146 typed in error and corrected to 46 still lets a walk start. The next save of that day then puts 146 back into the chart. Readings deleted in Track come back the same way, under the same ids within a visit. Blood pressure was fixed for this in T3-01. Glucose and deletes were not.
- **C2-02 (wrong behaviour).** After a reload, a waiting check-in update that was never stored takes back today's stored "None of these". Every start then asks for a check-in again. The next report saved that day erases the answer from the device.
- **C2-03 (wrong behaviour).** A guided session resumed under today's restrictions runs the re-dosed plan. History records the plan as it was saved: the old reps, holds, cardio minutes and "intervals" instead of the steady cardio that was done.

## Scope, method and code state

- **Reviewed:** 8 October 2026, against the working tree on top of `f21db7a`. The full unit suite passed (139 files, 4,494 tests) before I started.
- **Read in full:** `src/store/*` (except `fakeIdb.ts`, which I skimmed), `src/health/observation.ts`, `src/health/aggregate.ts`, `src/components/checkin/{pending,form,sheetState}.ts`, `CheckInSheet.tsx`, `src/hooks/useGuided.ts`, `src/hooks/useGuidedSession.ts`, `src/session/*`, `src/pages/SessionPage.tsx`, `src/walk/*`, `src/screens/walk/LiveWalkScreen.tsx`, `src/components/hig/{navigation.ts,Screen,Sheet,TabBar}.tsx`, `src/places.ts`, `src/main.tsx`, `src/App.tsx` and `src/reminders/*`. I also followed calls into `screens/track/{RecordDetails,EditSheets,records}`, `screens/today/TodayScreen.tsx`, `screens/you/{write,CalendarSheet,DataSheets,RestoreFlow}`, `screens/welcome/*`, `screens/walk/WalkSummary.tsx`, `services/storage.ts`, `profile/defaults.ts` and `engine/readiness.ts`.
- **How:** Vitest probes in `/tmp/claude-scan2-code`, run with `npx vitest run --config /tmp/claude-scan2-code/vitest.config.mjs <name>`. The config is a plain object with `root` set to the repo, the `@` alias, and `test.dir` set to the scratch folder. The probes drive the real store over the repository's fake IndexedDB. The player probe reuses the harness of `src/pages/session.callers.test.ts`, with its bare-package mocks pointed at absolute `node_modules` paths. Timings are from an Apple-silicon Mac; a phone will be slower. The scratch folder has been deleted.

## Findings

### C2-01. A check-in reading corrected or deleted in Track: the gates keep the old number, and the next save of that day puts it back

**Severity:** safety.

**Location:**
- `src/screens/track/RecordDetails.tsx:124`, `:191`: a check-in glucose reading is editable. `editBlock` (`records.ts:18`) blocks only measured or imported records, walks and blood pressure.
- `src/screens/track/EditSheets.tsx:140`: the correction is `editObservation(o.id, patch)` and nothing else. Compare `:256-270` for blood pressure: since T3-01 it goes through `correctCheckInPressure`, which corrects the check-in record and its readings in one write.
- `src/screens/track/records.ts:25-31`: `rewritable` refuses to re-time a check-in's blood pressure, because "the check-in finds its readings again by the time they were taken, so a moved one would be recorded a second time". The glucose form (`EditSheets.tsx:85`, `timed`) offers the time anyway.
- `src/screens/track/RecordDetails.tsx:132`, `:267`: delete is `removeObservation` or `removeReading`. Again only the series changes.
- `src/store/project.ts:270-277`: on the next save, a stored reading at the same instant with a different number is "a correction of it". It is revised back to the number the record holds.
- `src/store/project.ts:288-294`, `:326-334`, `:220-228`: a reading the record holds and the series lacks is created again. Within the same visit, `free()` hands out the same id again, because the deleted id is no longer "used"; after a reload the copy token differs and the id is new. Writing it again then drops its tombstone (`snapshot.ts:153-157`).

**Reproduction (store over the fake, three probes):**
1. An insulin profile has a check-in stored at 09:00 with glucose 146 mg/dL (meter, 08:55). Correcting that reading to 46 with `editObservation` leaves the chart at `[46]`. The check-in record still says 146. The walk gate (`permission(..., 'walk')`) returns `allowed: true, reassure`. At 09:10, `reportSymptoms({ news: ['dizzy'] })` saves the day again, and the chart is back to `[146]`.
2. The time of a check-in glucose reading of 64 at 08:00 is corrected to 07:30. After the next report that day the series holds `64 at 07:30` and `64 at 08:00`.
3. A check-in with glucose 410 and blood pressure 210/125 has both readings deleted in Track, which leaves 0 observations. After the next report that day all three are back, with the ids they had before.

**Expected:** Correcting or deleting a check-in's reading in Track changes what every gate reads, and stays done. That is the T3-01 rule, and blood pressure already follows it.

**Actual:** The person sees the corrected number. Every start reads the old one. In the dangerous direction (a typed-high reading corrected down to a real low), movement is allowed during a low. Track's own guidance for 46 says to treat it.

**Suggested fix:** Give glucose the same path as blood pressure. Add a `correctCheckInGlucose` beside `correctCheckInPressure` that finds the entry by `measuredAt` and value, rewrites it in the record (current or earlier list), and lifts the readings with `readings: 'correct'`, all in one `update`. Until that exists, block re-timing of check-in glucose as `rewritable` does for blood pressure. A delete of a check-in reading should remove it from the record too, through the same updater, or be refused with "Change it in today's check-in".

### C2-02. After a reload, a waiting update takes back today's stored "None of these", and the next save erases it

**Severity:** wrong behaviour. A stored answer is erased.

**Location:**
- `src/components/checkin/pending.ts:101-107`: `asRestored` strips `emergency` from a restored record whenever the stored record does not cover it, even when the stored record has that answer.
- `pending.ts:180-183`: on a tie, `effectiveRecord` picks `theirs`, the pending-led merge. `carryForward` (`form.ts:633-669`) copies readings from the saved record, never its `emergency`.
- `pending.ts:296-302`: `saveWith` builds from that effective record and stores it.
- `pending.ts:398`: `correctCheckInPressure` reads `waiting.get(date)` (unstripped) where `saveWith` reads `waitingFor(date, mine)`, and never clears `restored`. These are two copies of the rule that disagree.

**Reproduction (store over the fake, `failWrite` refusing `checkIns` rows on demand):**
1. A check-in is stored at 09:00: "None of these", glucose 110.
2. At 09:30, `reportSymptoms({ glucose: 150 })` is refused (quota). The record is waiting and still counts. Before any reload, `effectiveCheckIns` still shows the day checked in.
3. Reload: `resetForTests`, `start` again, `restorePendingCheckInsForTests`. The stored record still has `emergency: []`, but the effective record has `emergency: undefined`. The walk gate returns `allowed: false, needsCheckIn: true` ("Check in first, so today's movement fits how you are.").
4. Writes work again, and `reportSymptoms({ news: ['dizzy'] })` is stored. The stored record now has no `emergency`, and `checkedIn` is false.

**Expected:** "Answers the device never stored do not stand in for today's check-in." An answer the device did store keeps counting.

**Actual:** Today's real check-in stops counting on every screen. The next successful save deletes the stored answer.

**Suggested fix:** In `asRestored`, keep the stored record's `emergency` (and `urgentSymptoms`) when it has one: strip only an emergency answer the device never stored. Make `correctCheckInPressure` use `waitingFor` and clear `restored`, as `saveWith` does. Add the probe above as a test beside J17 step 9.

### C2-03. The session is recorded from the plan as it was saved, not the re-dosed plan that ran

**Severity:** wrong behaviour.

**Location:**
- `src/pages/SessionPage.tsx:100-101`: `saveSession` calls `toWorkoutSession(plan, …)` with the `plan` from `useState` at `:78-91`.
- `SessionPage.tsx:148-152`, `:181`, `:196`: the player runs `reconciled.plan`, and `onSave={saveSession}`.
- `src/session/gate.ts:208`, `:228`, `:233`, `:251`: reconciliation replaces steps with today's doses (`{ ...twin, id: st.id }`) and today's cardio (`cardio: fresh.cardio`).
- `src/session/logging.ts:47`, `:59`, `:79-80`, `:109`: planned reps, mobility seconds, completion and the cardio record (minutes and `format`) come from the plan passed in.

**Reproduction (player probe on the `session.callers.test.ts` harness):** The archived interval plan of release condition 6 is saved, then resumed under today's 165/95 reading (INT, LOAD and COOL apply). The player's plan is `zone2` with re-dosed sets; the saved plan was `intervals`. End session, then Finish now. The stored record has six sets with `plannedReps 9` that the player ran as 11 reps, for example `s3-lat-pulldown-s1: ran 11 reps, recorded plannedReps 9`. With the cardio completed, `logging.ts:109` would record `format: 'intervals'`.

**Expected:** History records what was done.

**Actual:** History records the saved plan's doses. The cardio is called intervals after the app replaced it with steady cardio because of a blood-pressure limit. Hold seconds and completion are judged on the old durations.

**Suggested fix:** Let the player hand back the plan it ran. Call `onSave(state, painAfter)` with `reconciled.plan`, or keep it in a ref that `saveSession` reads, and build the session from that.

### C2-04. Restoring a backup is quadratic in its readings

**Severity:** performance (a frozen main thread on a long record).

**Location:** `src/store/snapshot.ts:179`, `:183`. With `keepOrder`, each put looks its `seq` up with `steps.indexOf`. A real export has about one distinct `seq` per commit, so this is O(readings × commits). It runs for every replace import (`transfer.ts:920`) and merge (`:740`). The work is synchronous, inside `enqueue` (`useStore.ts:294`), and again at commit if another tab wrote (`:378`).

**Reproduction (probe of `prepare` with one reading per commit):**

| Readings | `prepare` time |
|---|---|
| 5,000 | 29 ms |
| 20,000 | 217 ms |
| 40,000 | 654 ms |
| 100,000 | 3,509 ms |

`IMPORT_LIMITS` plans for half a million readings. On this curve that is minutes of frozen screen on a phone after tapping Restore.

**Suggested fix:** Build `const rank = new Map(steps.map((s, i) => [s, i]))` once and use `rank.get(o.seq ?? -1)`.

### C2-05. During a walk, every second asks the engine about the whole check-in history, and that cost grows with the square of the history

**Severity:** performance (battery and responsiveness on the heaviest screen, growing with years of use).

**Location:**
- `src/walk/live.ts:465`: every tick asks `mayRun('live')`.
- `src/walk/gate.ts:53-57`, `:76`: `walkInput` passes every check-in ever stored as `recent`.
- `src/engine/readiness.ts:1146-1153`: `carriedRules` calls `answersFor(record, earlier.slice(i + 1))` for every earlier day.
- `readiness.ts:1176-1181`: it then evaluates the last check-in again against all the days before it.
- The same full list goes to `useGuided` (`planFor`, `effectiveCheckIns`) and `SessionPage` (`input.recent`).

**Reproduction (probe of the walk controller's own gate, `clinicalGate(() => deviceClinical(...))('live')`):**

| Stored check-in days | One gate call |
|---|---|
| 1,000 | 19 ms |
| 5,000 | 211 ms |
| 10,000 | 786 ms |

`permission()` alone takes 22, 94 and 445 ms at 2,500, 5,000 and 10,000 days.

**Suggested fix:** Pass only the days the rules can reach (from the oldest unsettled serious reading, else the last few days) from `walkInput`, `useGuided` and `SessionPage`. In `carriedRules`, index answers by reading id once instead of slicing per day.

### C2-06. Clearing blood-pressure reading 1 on "Change answers" re-times reading 2 and records it twice

**Severity:** wrong behaviour.

**Location:**
- `src/components/checkin/form.ts:272-281`: `formReadings` drops empty rows, so the second row becomes index 0.
- `form.ts:568-572`: each typed reading is compared with `prevReadings[i]` and stamped with `ats[i]`, by that compacted index.
- `src/components/checkin/CheckInSheet.tsx:224-227`: `setBp` stamps the row's time on every keystroke, clearing included.
- `src/store/project.ts:312-334`: a pressure whose time changed is a new pair.

**Reproduction (`formFromRecord`, `buildCheckIn`, `carryForward`, then `liftCheckIn`):**
1. The saved check-in has readings 150/95 at 08:00 and 182/100 at 08:02.
2. At 08:30, reading 1's boxes are cleared.
3. The record now holds `bpReadings: [182/100 at 08:30]` and `bpEarlier: [150/95 at 08:00, 182/100 at 08:02]`. The series holds `150/95 08:00`, `182/100 08:02` and `182/100 08:30`.

**Expected:** Reading 2 keeps its time and is recorded once.

**Actual:** A severe reading appears twice. The copy in `bpEarlier` is asked about as an earlier severe reading.

**Suggested fix:** Pair readings by row, not by position in the compacted list. Keep `[row, reading]` pairs in `formReadings`, compare row *k* with the saved reading of row *k*, and stamp with `ats[k]`.

### C2-07. Swiping down a sheet that is refusing to close hides it while it stays open, and the page stays inert

**Severity:** wrong behaviour (broken journey; a save's result or error is never seen).

**Location:**
- `src/components/hig/Sheet.tsx:117-128`: release slides the panel out with `settle(d, true)` *before* asking `onDismiss()`.
- `Sheet.tsx:82-89`: those are inline styles that nothing resets.
- `Sheet.tsx:44-59`: `#app` is inert while `open` stays true.
- Sheets that refuse while saving: `screens/you/RestoreFlow.tsx:118-122` (`close()` returns while `locked`) via `:129`, `screens/workout/sheets.tsx:150`, `screens/move/PlanScreen.tsx:226` and `:243`, `screens/you/FocusScreen.tsx:115`.

**Failing sequence (trace):**
1. The person taps Restore, then swipes the sheet down while the import is being written.
2. The panel is set to `translate3d(0, 100%, 0)`, and the backdrop to opacity 0.
3. `onOpenChange(false)` is ignored, so the sheet stays open off screen, and the page behind it is inert.
4. When the write finishes, "Restored…", or an error such as "That file could not be read", is rendered in the hidden panel.
5. The next tap lands on the invisible backdrop and closes the sheet unseen.

The same happens to the "Finish workout" error, and to the swap and leave errors on Your plan.

**Suggested fix:** Ask first, and settle on the answer. Only slide out when the parent accepts. Otherwise settle back (`settle(d, false)`), for example by giving `useSwipeToDismiss` a `canDismiss()` check, or by resetting the inline styles in an effect whenever `open` is still true after a dismissal.

### C2-08. "Delete everything" while nothing can be saved clears local data and the screen, then says "Nothing was deleted"

**Severity:** wrong behaviour (low; reachable after "Continue without saving").

**Location:**
- `src/store/useStore.ts:357-371`: with no database, `commit` applies the reset to `committed`, runs `after` (`resetData()`, which sweeps every `fit-strong*` key), then returns the `unavailable` failure.
- `useStore.ts:1504`: with that failure, `clearAllAndRestart` does not restart.
- `src/screens/you/DataSheets.tsx:148-152`: the sheet shows "Nothing was deleted."

**Reproduction (store probe, `openFails: 'error'`):** In memory mode, with onboarding complete and two `fit-strong-90-*` keys set, `clearAllAndRestart` returns `ok: false` ("Could not reach this device's storage: Open failed."). Afterwards no `localStorage` keys are left, there were no restart calls, and `onboardingComplete` on screen is false.

**Actual:** The screen falls back to Welcome. The waiting check-ins in `pending.ts` and the walk kept in `walk/persist.ts` page memory survive, because the page never reloads. The message contradicts all of it.

**Suggested fix:** Do not run `after` for a mutation that was not stored. Either refuse Delete everything outright in memory mode ("Nothing is saved on this device; close the app to discard this session"), or treat it as done: run the sweep and reload.

### C2-09. The record stays blank until the browser's storage-persistence question is answered

**Severity:** wrong behaviour (low; browsers that prompt for `persist()`, such as Firefox).

**Location:** `src/store/useStore.ts:515` awaits `requestPersistence` before migrating or reading. `src/store/db.ts:411-412` awaits `storage.persist()`. `src/App.tsx:101` renders a bare background while `loading`.

**Reproduction (store probe):** With a `navigator.storage.persist()` that resolves only when the test answers, the status is `loading` after 200 ms. It is `ready` 50 ms after the answer.

**Suggested fix:** Start the request without awaiting it, read the record, and publish `persisted` when the answer arrives.

### C2-10. Unreachable recovery and duplicate write paths that drift from the live ones

**Severity:** maintainability risk.

**Location:**
- `src/store/useStore.ts:459-464`: `retry()` has no caller. `StorageUnavailable` reloads the page instead.
- `useStore.ts:548-553`: the memory-log replay runs only after a blocked open later succeeds. `onblocked` cannot fire with `DB_VERSION = 1`, and nothing calls `deleteDatabase`. The replay also drops `hold`, and callers already told "not saved" are never told otherwise.
- `useStore.ts:1052-1090`: `putCheckIn` and `removeCheckIn` have no app caller. The app writes check-ins through `update`, whose lifting differs in details (`previous` per date; readings of a removed day).

**Suggested fix:** Delete `retry`, the replay and the unused check-in actions, or wire them up with a test that goes through `App`. As they stand, the tests prove behaviour the app never runs.

## Reviewed and sound

- **Store.**
  - Queue and pump: one transaction per mutation, re-planned only when its base changes. A failure adopts the refreshed snapshot. Tasks wait their turn, and results settle after the view is recomputed. Held mutations stay off screen until stored.
  - `commitChange` reads the revision inside the write transaction, and a throwing plan aborts it through `guard`.
  - Migration is all or nothing, with the marker checked inside the transaction.
  - Tombstones are added on delete, forgotten on rewrite, honoured on merge, learned only for ids not held, and cleared by clear-all.
  - D-02 renaming is stable (digest of reading and instant), and a round trip maps back to the held ids.
  - `importCheck` matches the current `UserSettings`, `HabitSettings` and `UserProfile` field by field.
  - The theme mirror only follows stored values.
  - `isSessionSaved` is only used together with `result.ok`, so it cannot release progress on a stale copy.
- **Health.** `observation.ts`:
  - Validation, offsets and `dayOf`.
  - Ordering by instant, then by statement.
  - Midday stand-ins.

  `aggregate.ts`:
  - The day-total replace rule per source.
  - The overlap sweep across days, memoised on the array.
  - Mixed units flagged.
  - Blood pressure paired by reading id and instant.
- **Check-in.**
  - `saveWith` under two quick saves, and under a refused first save: the waiting record carries forward, and `covers` holds in the common case.
  - Only the latest submission changes the sheet, and the gate takes the strictest of three records.
  - `carryForward` keeps every reading.
  - An emergency answer is never blocked.
  - `useGuided` memo dependencies.
- **Session.**
  - Refused steps are passed in both directions.
  - Previous after done is a no-op.
  - `activeMs` is tracked across pauses and banking.
  - Seek to the cool-down.
  - One slot per kind, set-aside runs and rehydrate.
  - Arrival, start and live gates.
  - The double save at done is idempotent (the second commits nothing).
  - Progress is cleared only after a durable save.
  - Media handlers are removed at done.
  - The stop-flow screen priorities.
- **Walk.**
  - Segments, midnight splits, stale finish and remount grace.
  - Steps credited on the wall clock.
  - GPS filters.
  - The gate is asked at every transition and every tick.
  - Record ids are stable, retries write only what is missing, and memory-only saves read as "kept".
  - Draft validation.
- **Shell.**
  - The idx-keyed stack across reload and a typed hash.
  - Places require a shown title and `placeExists`.
  - Back pops only within its tab.
  - The navigate wrapper and the `startViewTransition` patch.
  - The record mark, and places forgotten while onboarding is incomplete.
- **Reminders.**
  - Windows and quiet hours across midnight.
  - The grace rule after a gap, and a backwards clock.
  - Pruning of waiting reminders on every minute and every context change.
  - The calendar notice expiry.
  - `.ics` folding and escaping.
  - The backup nudge's revision arithmetic, including keep-order imports and no-op commits.

## Not reviewed

- `src/engine/*`, beyond the cost measured in C2-05 and the rules each finding depended on.
- Screens outside the listed modules, except where a finding's call path led into them.
- Voice, narration and 3D.
- `scripts/` and the end-to-end suites, the service worker, and CSS or visual behaviour.
- Real IndexedDB engines and real devices: every store result here is against the repository's fake. Firefox's `persist()` prompt (C2-09) was modelled, not observed.
