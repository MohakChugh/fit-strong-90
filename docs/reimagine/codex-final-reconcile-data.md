# Codex final reconciliation — data and shell (static review of pasted source, 8 Oct 2026)

Review of the pasted source: several reported fixes are visible, but deleted check-in readings can still return, timestamp corrections can become duplicate readings, and a queued deletion can clear the displayed record without deleting the durable record. The critical movement safety fixes remain unverified because their deciding code is missing.

`AGREE-FIXED` below means the pasted source addresses the reported mechanism. These are judgments from code inspection, without executing the app. Where only supporting infrastructure is present, I have used `CANNOT-TELL` rather than assuming the missing caller uses it correctly.

| Finding | Verdict and evidence |
|---|---|
| **D-01, Calendar reminders survive a new precaution** | **CANNOT-TELL.** The bundle omits `src/reminders/ics.ts`, `CalendarSheet.tsx`, `HabitSheets.tsx`, the reminder advice functions, and the habit types. Neither recording exports nor showing persistent removal instructions can be established. |
| **D-02, Two devices’ check-in readings collide during merge** | **AGREE-FIXED for the reported observation loss.** In `src/store/project.ts`, `liveEventId()` includes the copy token, `checkIn:${day}#${COPY}…`. In `src/store/transfer.ts`, `separateCheckInReadings()` separates different measurements under legacy shared IDs and moves blood-pressure partners together. `previewImport()` computes `alreadyHere` using those separated IDs. The original 62 versus 160 example therefore retains both observation rows. A different correction defect in this separation logic is **R5-02**. |
| **D-03, A stale wizard overwrites another copy’s profile changes** | **CANNOT-TELL.** `update()` replans against the latest snapshot, but that does not repair a captured whole-profile draft. The deciding callers, `screens/you/write.ts`, `screens/move/plan.ts`, and `screens/welcome/assemble.ts`, are absent. `setProfile()` still replaces the whole profile, so its existence does not establish a section-level merge. |
| **D-04, A refused Welcome health save loses the answers** | **CANNOT-TELL.** `src/store/useStore.ts` now exposes `UpdateOptions.hold`, and held mutations remain out of the optimistic view. However, `HealthStep.tsx`, `App.tsx`, and the routing code are absent. It cannot be established that the finishing Welcome save passes `{ hold: true }` or keeps its form mounted. |
| **D-05, Delete everything leaves the walk draft behind** | **CANNOT-TELL.** `clearAll()` calls `resetData()` after a successful database clear, but the implementation of `src/services/storage.ts` and the keys and cleanup in `src/walk/persist.ts` are missing. Clearing both session-storage walk keys cannot be confirmed. |
| **D-06, Merge brings back deleted readings** | **NOT-FIXED, partial remediation.** The original direct observation import is protected by `planMerge()`’s `if (!here && goneHere.observations.has(o.id)) … continue`. However, check-in summaries are imported separately, and a later `liftCheckIn()` can recreate a deleted measurement from the restored summary. **R5-01** gives the complete sequence. |
| **D-07, A profile and settings backup is called empty** | **AGREE-FIXED at the preview calculation.** In `src/store/transfer.ts`, `previewImport()` now requires both `file.settings === undefined` and `file.profile === undefined` before setting `isEmpty`. A readable profile or settings document makes the backup nonempty even with no readings. |
| **D-08, Malformed settings are accepted and break screens** | **CANNOT-TELL.** `parse()` now invokes `readSettings()` and `readProfile()`, exposes `unreadableFields`, and `planImport()` refuses unreadable fields unless `allowRejected` is selected. The deciding validators in `src/store/importCheck.ts` are absent, so rejection of `statusPeriods: "flare"` and malformed nested profile fields cannot be confirmed. |
| **D-09, Welcome Restore and Start route away before acknowledgement** | **CANNOT-TELL for the complete finding.** `importRecord()` now has `hold: true`, which addresses optimistic publication of an imported finishing flag. `KeepStep.tsx`, `RestoreFlow.tsx`, `App.tsx`, and routes are missing, so Start’s options and display of restore success or refusal remain unverified. |
| **D-10, Primary controls overflow at 200% text** | **CANNOT-TELL.** The wizard, voice settings card, time-field controls, button styles, and relevant CSS are absent. |
| **D-11, A window crossing midnight is described as all day** | **CANNOT-TELL.** `schedule.ts`, `habitLine()` in `summaries.ts`, and the Calendar summary are absent. |
| **C2-01, Track corrections and deletions leave check-in gates reading the old value** | **CANNOT-TELL, critical safety uncertainty.** `editObservation()`, `removeObservation()`, and `removeReading()` still change the observation series alone. `update()` now supports `readings: 'correct'` and `removeObservations`, which could support synchronized changes. The deciding correction helpers and callers in `pending.ts`, `EditSheets.tsx`, and `RecordDetails.tsx` are missing. This bundle does not prove that correcting 146 to 46 changes every movement gate’s input. |
| **C2-02, Restored pending work erases a durable “None of these” answer** | **CANNOT-TELL.** `pending.ts` and `form.ts`, including `asRestored()`, `waitingFor()`, `effectiveRecord()`, and the pressure correction helper, are absent. |
| **C2-03, History records the archived plan instead of the re-dosed plan** | **AGREE-FIXED for the reported wrong-plan argument.** In `src/pages/SessionPage.tsx`, `ran.current = reconciled.plan`; `saveSession()` reads `const done = ran.current` and calls `toWorkoutSession(done, state, …)`. `Player` receives that same `reconciled.plan`. The logged plan argument now matches the plan supplied to the player. |
| **C2-04, Restore preparation is quadratic in observations** | **AGREE-FIXED for the reported bottleneck.** `src/store/snapshot.ts:prepare()` builds `const rank = new Map(steps.map((step, i) => [step, i]))` and uses `rank.get()`, replacing repeated `indexOf()` searches. `mergeObservations()` also merges sorted lists in one pass instead of inserting each observation individually. A separate quadratic check-in merge remains, **R5-04**. |
| **C2-05, Live movement repeatedly evaluates quadratic check-in history** | **CANNOT-TELL.** `SessionPage` still supplies `recent: checkIns` without bounding the list. However, `carriedRules()` in `engine/readiness.ts`, the walk gate and live controller, and `useGuided.ts` are absent. The engine may have been indexed or otherwise changed; the reported cost cannot be inferred from this caller alone. |
| **C2-06, Clearing BP row 1 re-times and duplicates row 2** | **CANNOT-TELL.** `formReadings()`, `buildCheckIn()`, and `CheckInSheet.setBp()` are absent. |
| **C2-07, A refused swipe dismissal hides an open sheet** | **CANNOT-TELL.** `Sheet.tsx`, its gesture implementation, and the parent dismissal contracts are absent. |
| **C2-08, Delete everything in memory mode changes data while reporting refusal** | **AGREE-FIXED for the reported invocation while storage is already unavailable.** `clearAll()`’s planner throws when `!db`, before its reset is enqueued. The no-database branch of `commit()` also no longer runs `after`. A distinct race when storage disappears after planning remains, **R5-03**. |
| **C2-09, Loading waits for the persistence permission answer** | **AGREE-FIXED.** `src/store/useStore.ts:boot()` uses `void requestPersistence(options.navigator).then(…)`, then proceeds to migration and reading without awaiting that permission answer. |
| **C2-10, Unreachable recovery and duplicate check-in write paths** | **CANNOT-TELL for the complete finding.** The pasted `useStore.ts` has removed `retry()`, memory replay, and `putCheckIn()`. It still exports `removeCheckIn()`. The complete caller graph is absent, so its reachability and any remaining divergence cannot be established. |
| **S-01, Storage banner covers the app at large text** | **CANNOT-TELL.** `Screen.tsx` and `StorageBanner.tsx` are missing. The store’s notice text does not establish the banner’s placement or height. |
| **S-02, First navigation drops focus to body** | **CANNOT-TELL.** `navigation.ts:followRouter()` now records navigation synchronously, and `takeFocusRequest()` consumes a request once. That addresses the ordering problem if installed and consumed correctly. `main.tsx`, `App.tsx`, and `Screen.tsx` are missing, so that wiring cannot be confirmed. |
| **S-03, Large-text rows split words into fragments** | **CANNOT-TELL.** `List.tsx`, sheet layout, and CSS are absent. |
| **S-04, Large-text sheet titles are cut off** | **CANNOT-TELL.** The sheet title layout is absent. |
| **S-05, Input text remains fixed at 16 px** | **CANNOT-TELL.** `index.css` and the relevant input rules are absent. |
| **S-06, Source rows clip long words** | **CANNOT-TELL.** `screens/guide/parts.tsx:ExternalRow()` and its styles are absent. |
| **S-07, Dark safety chips fail contrast** | **CANNOT-TELL.** `FormDemo.tsx`, `MotionView.tsx`, and the current color tokens are absent. |
| **S-08, Desktop Safari scales the app to 80%** | **CANNOT-TELL.** `src/lib/textSize.ts` is absent. |
| **S-09, Second Back replaces rather than pops** | **CANNOT-TELL for the rendered behavior.** `navigation.ts` now stores entries by history index, and `backTarget()` returns `{ pop: true }` for the preceding entry in the same tab. That replaces the reported single-previous-path design. The router installation and `Screen` Back handler are absent, so actual use of this algorithm cannot be confirmed. |
| **S-10, Back from Today’s rows lands in another tab** | **CANNOT-TELL.** `record()` can inherit the opener’s tab on a push, and `backTarget()` can pop to the preceding screen. Today’s rows, the chooser, and their destination screens’ Back handlers are absent. |
| **S-11, Related links return to an unvisited parent** | **CANNOT-TELL.** `backTarget()` can prefer the actual preceding entry and its title. `CardScreen.tsx`, `ExerciseScreen.tsx`, related links, and `Screen.tsx` are missing. |
| **S-12, Accessible name is “Back to Back”** | **CANNOT-TELL.** `navigation.ts` has label selection and `backLabelFit()`, but `Screen.tsx`’s accessible-name construction and Guide’s `backLabel()` formatter are absent. |
| **S-13, Try again cannot recover a rejected lazy import** | **CANNOT-TELL.** `isChunkLoadError()` is present in `navigation.ts`, but classification alone does not implement recovery. `ErrorBoundary.tsx`, lazy route definitions, and the retry handler are absent. |
| **S-14, Meal ideas gives diabetes framing without diabetes** | **CANNOT-TELL.** The meal screen, introductions, and food claims are absent. |
| **S-15, Emergency screens still offer movement as the next action** | **CANNOT-TELL, critical safety uncertainty.** `StretchScreen.tsx`, Today’s chooser/model, and Move’s rows are absent. The gated session page does not establish that these entry screens suppress Start actions during an emergency. |
| **S-16, Navigation visibly smooth-scrolls from the old offset** | **CANNOT-TELL.** Global scroll CSS and router scroll restoration are absent. |
| **S-17, App theme disagrees with native controls and browser chrome** | **CANNOT-TELL.** The store mirrors the saved theme, but `App.tsx`, `useTheme.ts`, `index.html`, and Toaster configuration are absent. |
| **S-18, Switching tabs discards each tab’s place** | **CANNOT-TELL for the actual tab buttons.** `navigation.ts` now keeps `places` and `roots`, and `tabLink()` restores the remembered path, search, state, and scroll key. `TabBar.tsx` and the router wiring are absent. |
| **S-19, Sheet grabber cannot be dragged** | **CANNOT-TELL.** The sheet and gesture code are absent. |
| **S-20, Title collapse leaves a gap with no title** | **CANNOT-TELL.** `Screen.tsx` and its sentinels are absent. |
| **S-21, Search misses common spellings and sciatica** | **CANNOT-TELL.** Content aliases and `filterExercises()` are absent. |
| **S-22, iPhone icon is SVG only** | **CANNOT-TELL.** `index.html`, the manifest, and icon assets are absent. |
| **S-23, Action tint colors noninteractive labels** | **CANNOT-TELL.** The affected Guide and chooser components and their styles are absent. |
| **S-24, Back uses the same animation as a push** | **CANNOT-TELL.** `navigation.ts` now records a direction and assigns `document.documentElement.dataset.nav`. Direction-specific animation CSS and the transition wrapper in `main.tsx` are missing. |

The reports also repeat earlier findings and fix claims. Their status in this bundle is:

| Earlier finding or claim | Verdict and evidence |
|---|---|
| **N04, Restore remains locked while writing and rejects stale completion** | **CANNOT-TELL.** `RestoreFlow.tsx` and `restore.ts` are absent. Holding publication of an import does not establish sheet locking or completion-token checks. |
| **N05, Untouched weight-unit switches preserve stored weight** | **CANNOT-TELL.** `ProfileWizard.tsx` and `wizardSteps.ts` are absent. |
| **Wizard footer remains sticky and the form remains reachable** | **CANNOT-TELL.** Wizard layout and styles are absent, including the deciding large-text behavior from D-10. |
| **N07, A displayed reminder leaves exactly at quiet hours** | **CANNOT-TELL.** `ReminderHost.tsx` and its timer/pruning logic are absent. |
| **Today uses an inline reminder instead of a floating banner** | **CANNOT-TELL.** `TodayScreen.tsx` and `src/reminders/place.ts` are absent. The supplied `src/places.ts` concerns remembered record destinations, not reminder placement. |
| **Only session and live walk suppress due reminders** | **CANNOT-TELL.** Reminder route suppression and the host are absent. |
| **Untouched SGLT2 answer remains unanswered without diabetes** | **CANNOT-TELL.** `wizardSteps.ts`, the implementation of `deriveHealth()`, and the profile summaries are absent. |
| **F01, Atomic replacement including failure and interruption** | **CANNOT-TELL for the full guarantee.** `prepare()` constructs the replacement across all four stores and `commitChange()` submits it through one `db.transact()` call. The transaction scope, abort handling, and durability implementation in `src/store/db.ts` are absent. |
| **F02, Two copies preserve interleaved writes** | **CANNOT-TELL for the full guarantee.** Field-level settings patches and revision-based replanning are visible. Actual serialization and transaction behavior depend on the missing database wrapper. |
| **F04, Two copies replan against fresh durable storage** | **CANNOT-TELL for the full guarantee.** `commitChange()` reads revision inside its requested transaction and calls the resolver again after a refresh. Whether the wrapper maintains the required transaction scope is not shown. |
| **F07, Imported schema marker belongs to this build** | **AGREE-FIXED.** `parse()` normalizes the file to `SCHEMA_VERSION`, and replacement in `planImport()` explicitly writes `schemaVersion: SCHEMA_VERSION`. The file’s original marker is not installed as this device’s marker. |
| **F10, Rechecks within one device retain measurements** | **AGREE-FIXED for distinct reading events.** `liftCheckIn()` matches timed readings by instant, retains exact matches, and allocates a new event for a distinct timed reading or an appended untimed changed value. |
| **F12, Content reading state is exported and restored** | **AGREE-FIXED.** `toTransferDoc()` exports `snapshot.content` as `contentState`; replacement rebuilds it with `Object.fromEntries()`, and merge handles its keys individually. |
| **F22, Every record is validated before writing** | **CANNOT-TELL for the complete claim.** Collection validation and rejection counts are present, but `isObservation()` and the settings/profile validators are missing. Several nested session and check-in fields receive only array/object checks, so this bundle does not prove complete consumer-safe validation. |
| **F07, Screen drafts survive refused saves** | **CANNOT-TELL.** The wizard, Welcome form, and their save-result handling are absent. The store’s held-write option alone is insufficient evidence. |
| **Muted dark-mode text contrast was fixed during the scan** | **CANNOT-TELL.** Current CSS tokens and affected components are absent. |
| **Stretch segmented control was increased to the required target size** | **CANNOT-TELL.** The deciding control implementation and styles are absent. |

The following additional failures follow from the pasted code.

**R5-01. A merged check-in summary can recreate a deleted reading**

**Severity:** High, record integrity and wrong data.

**Location:** `src/store/transfer.ts:planMerge()`, `src/store/useStore.ts:describeUpdate()`, and `src/store/project.ts:liftCheckIn()`.

**Evidence:**

- Observation import respects deletion: `if (!here && goneHere.observations.has(o.id)) { deletedHere += 1; continue; }`.
- Check-in import independently restores the file’s summary: `checkIns = [...checkIns, c]`.
- A changed check-in is subsequently passed to `liftCheckIn(record, …)`.
- If its timed reading has no matching stored observation, lifting allocates an event with `const event = free([s.kind])` and creates the observation. It receives no deletion state.

**Failing sequence:**

1. The person saves and exports a check-in containing a timed glucose reading, for example a synthetic 600 mg/dL entry later identified as a typo.
2. A synchronized `update()` removes that glucose entry from the summary and removes its observation through `removeObservations`. The observation ID becomes a tombstone.
3. The person merges the older backup with `onConflict: 'takeFile'` for the conflicting summary. The observation is correctly skipped as deleted, but the old glucose entry is restored inside the check-in.
4. A later update changes that day’s symptoms or another check-in field.
5. `liftCheckIn()` recreates the glucose observation from the restored entry. During the same page lifetime it can reuse the deleted ID; after a reload it can allocate a different ID.

**Expected:** A merge that reports the measurement as deleted leaves it deleted, including through future projection from its source summary.

**Actual:** The merge restores an indirect source of the deleted measurement, and the next changed-day save brings it back.

**Suggested fix:** Apply deletion state to check-in entries during merge as well as to observation rows. Give source entries stable event identities so lifting can recognize a deleted measurement and suppress it under any newly allocated ID.

**R5-02. A genuine timestamp correction imports as an additional reading**

**Severity:** Medium, wrong data and correction fidelity.

**Location:** `src/store/transfer.ts:otherReading()`, `separateCheckInReadings()`, and `planMerge()`; `src/store/useStore.ts:editObservation()`.

**Evidence:**

```ts
return Date.parse(here.at) !== Date.parse(o.at)
  || (here.editedAt === undefined && o.editedAt === undefined);
```

This treats a changed timestamp as a different measurement even when the incoming observation has an `editedAt` and retains the same globally generated ID. `separateCheckInReadings()` then renames it before `planMerge()` can compare statement times under that ID.

**Failing sequence:**

1. Devices A and B hold the same exported check-in glucose observation with the same ID.
2. On A, a timestamp correction uses the supported `editObservation(id, { at: correctedTime })` API. It retains the ID and records `editedAt`.
3. A exports the corrected record; B merges it.
4. `otherReading()` sees the different instant and causes the incoming correction to receive a new ID.
5. B keeps the original observation and adds the corrected one.

**Expected:** A newer correction of the same identified event replaces its older copy, including a correction to its time.

**Actual:** The series contains both the original and corrected timestamps. The merge treats the correction as an import rather than a replacement.

**Suggested fix:** Preserve identity for verified edits, including changes to `at`. Limit collision separation to genuinely independent legacy events rather than applying it indiscriminately to shared modern IDs.

**R5-03. A queued clear can empty the displayed record after storage becomes unavailable**

**Severity:** Medium, failed-deletion behavior and misleading record state.

**Location:** `src/store/useStore.ts:clearAll()`, `planOn()`, `leave()`, and `commit()`.

**Evidence:**

- `clearAll()` checks `if (!db)` while planning.
- A cached plan is reused solely by snapshot identity: `if (m.cached && m.cached.on === base) return m.cached`.
- `leave()` sets `db = undefined` and enters memory mode while retaining the snapshot.
- The no-database branch of `commit()` still executes `committed = planned.prepared.next` and then returns `{ ok: false, failure: unavailableFailure() }`.

**Failing sequence:**

1. A task that does not change the snapshot, such as a background revision check, is in progress.
2. `clearAll()` is queued behind it while `db` exists. Its held reset plan is cached against `committed`.
3. The version-change callback runs `leave()`, removing the storage handle without changing that snapshot.
4. The preceding task finishes without replacing the snapshot.
5. The clear reaches `commit()`. `planOn()` reuses its cached plan, so the new `!db` condition is never checked.
6. The reset is applied to `committed` in memory, and deletion reports failure. The durable record remains on disk.

**Expected:** A refused deletion leaves both the durable record and displayed record intact.

**Actual:** The displayed record becomes empty even though the durable record was not deleted. Holding the optimistic publication does not prevent this later application in memory.

**Suggested fix:** Reject a clear in `commit()` if its required durable storage handle has disappeared, before altering `committed`. A cached reset plan must not serve as authorization to clear after storage becomes unavailable.

**R5-04. Merging a long check-in history still performs quadratic copying**

**Severity:** Medium, performance.

**Location:** `src/store/transfer.ts:planMerge()`, called synchronously by `previewImport()` and import planning.

**Evidence:**

```ts
for (const c of file.checkIns) {
  // ...
  checkIns = [...checkIns, c];
}
```

For a conflicting summary selected from the file, the loop also performs:

```ts
checkIns = checkIns.filter(x => x.date !== c.date);
```

**Failing sequence:**

1. A valid backup contains N daily check-ins whose dates are absent from the destination.
2. The person previews or merges it.
3. Each iteration copies the entire growing check-in array.

**Expected:** Merge planning should fold the incoming daily records into a keyed collection and construct the final array once.

**Actual:** For N new entries and M existing entries, array copying costs `O(N × M + N²)`. The observation preparation fix in C2-04 does not remove this separate synchronous bottleneck. No execution time is claimed here; the repeated copying follows directly from the loop.

**Suggested fix:** Use the existing date map to reconcile entries, then emit and sort the final check-in array once while preserving conflict counts and policy.

I could not judge the following consequential safety and behavior questions from this bundle:

- **Whether Track changes reach every movement gate.** The correction/deletion helpers, `useGuided.ts`, `pending.ts`, `engine/permission.ts`, and `engine/readiness.ts` are needed to close C2-01 and C2-02.
- **Whether a glucose checkpoint can be skipped.** The visible Next control calls `act.next('skip')`; media Next does the same when `held` is false. A checkpoint does not itself appear in the `held` expression until its reading flow is opened. The missing `session/runner.ts` decides whether those actions can advance without a completed reading. This is an unresolved safety check, not a confirmed bypass.
- **Whether merged observations become stricter gate inputs.** `planMerge()` can retain the device’s same-date summary while importing the other device’s low or severe-pressure observations. `SessionPage` passes check-in objects to its gates. Without `useGuided.ts` and the engines, I cannot establish whether those retained observations are reintegrated before movement is authorized.
- **The complete clinical instructions.** The bodies of `evaluateCheckIn()`, the session and walk gates, and the imported `TREAT`, `CANNOT_SWALLOW`, and `PERMISSION_TEXT` constants are missing. Threshold dispatch visible in `escalation.ts` does not establish complete emergency recognition or the correctness of all displayed instructions.
- **Fluid-limit advice during a session.** `SessionPage.subtitleFor()` hard codes `Recover, breathe slowly, sip water` for a rest without `nextStepId`, with no profile argument. The fluid precaution and plan/gate implementations are missing, so I cannot establish whether that subtitle is reachable for the person with a recorded fluid limit. It needs review alongside D-01.
- **Progress retention and deletion cleanup.** `session/persistence.ts`, `session/logging.ts`, `walk/persist.ts`, and `resetData()` are needed to verify banking before an autosave overwrites a slot, and complete removal of local drafts.
- **Rendered behavior and platform claims.** The missing screens, shell components, CSS, entry points, assets, and content prevent verification of the surface findings, including navigation wiring, accessibility, theme behavior, icons, and Calendar notices.

Verdict: do not ship.