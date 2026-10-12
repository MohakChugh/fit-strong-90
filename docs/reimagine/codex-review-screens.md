# Finished screens, bug hunt round 1

Reviewed on 8 October 2026. **Do not ship the screens together yet.** The release blockers are clinical guidance suppressed by failed writes, water advice surviving a fluid restriction, and incomplete recovery of walks and workouts. Passing unit tests do not cover these combinations of user actions, delayed writes and reloads.

This review covers Today, Track, Workout, Walk and its measurement modules, You, Welcome, Reminders, Move, `engine/stretch.ts`, and `health/recommend.ts`, `cadence.ts` and `status.ts`. It uses [BUILD-BRIEF](BUILD-BRIEF.md), [BOARD](BOARD.md), [codex-vision](codex-vision.md) and [codex-acceptance](codex-acceptance.md), particularly D8, D10, D13, D18, D25, D27, D30, D31 and the D34 release gate.

The readiness engine, permission engine, check-in components, session player page and content data were excluded from source review as requested. Where a screen imports them, their existing interfaces were executed or replaced with explicit inputs for the screen probe. Findings about a caller do not assert a defect in those excluded implementations.

## Verification

* Read 174 files in the requested areas, including their tests.
* Executed **906 existing test cases across 54 files, all passing**, using the installed TypeScript compiler and Chai/Vitest assertion plugins in an in-memory runner. The runner registered and executed test bodies and their hooks. This was not a native Vitest CLI run.
* `screens/you/summaries.ts` changed during the audit to mark unreviewed BP medicines as unconfirmed. Refreshed that helper and reran its **20 tests, all passing**. The findings below do not depend on its previous medicine wording.
* Ran **30 additional probes** against the actual pure functions and component handlers. Component probes supplied deterministic React hook state, router values and controlled store promises. They establish handler behaviour, not browser layout, focus or native API delivery.
* For the workout race, the controlled store port serialised writes in their submitted order. For the walk failures, the ports committed a specified observation and failed or delayed the next. These probes isolate the screen's request sequence without changing application files.
* Used synthetic profiles and records. No application code, test file, configuration or existing document was changed.

Representative results:

| Probe | Observed result |
| --- | --- |
| Current glucose `600 mg/dL`, write returns a storage failure | Input survives, but the guidance callback is never called |
| Water banner pending, then `health.fluidRestriction = true` | Future schedule becomes empty; the existing water banner remains visible |
| Finish workout, then log another set while finalisation is pending | Writes commit as autosave, finish, autosave; final record is `in_progress`, with empty notes and no completion time |
| First walk observation commits, reload before the next, then Discard | No removal is requested; `walkDuration` remains in the record |
| Delete walk duration successfully, fail the next deletion | Movement and distance remain; detail renders `Gone` and hides the error and retry |
| Edit an untouched Delhi timestamp on a Los Angeles device | `09:00 +05:30` becomes `09:00 -07:00`, a 12.5-hour shift |
| GPS unavailable from second 60 to second 120 | Distance rises from about 55 m to 120 m; GPS coverage stays at 60 seconds |
| Save a five-minute walk with four minutes of GPS and 500 m | Summary pace is 8 min/km; saved detail pace is 10 min/km |
| Sunday 23:59 to Monday 00:02 walk | Sunday and the previous week receive all three minutes; Monday receives none |
| Choose backup B while backup A is still being read | B's preview appears, then A's late result replaces it |

## Advice that can mislead the owner

### F01. A failed write suppresses guidance for a dangerous current reading

**Severity: wrong advice.** [QuickLog.tsx:257](../../src/screens/track/QuickLog.tsx#L257), glucose failure return at line 263 and escalation at line 268. BP has the same ordering at lines 413 to 416; a second-reading failure returns at lines 431 to 441.

**Trigger:** Enter a current glucose of `600 mg/dL`; make `addObservation` return `{ ok: false, failure: { message: 'Storage full' } }`; tap Save. Another concrete case is first BP `130/80`, second BP `180/80`, with the second `putBloodPressure` failing.

**Observed:** The glucose component shows the storage error and retains `600`, but never emits clinical guidance. The BP branch considers only the successfully saved first reading on failure, so a severe second reading receives no guidance. A severe first reading followed by a failed second write is already handled correctly.

**Expected:** Valid current inputs must produce their safety instructions even when persistence fails. The person must see both the clinical instruction and the fact that the reading was not saved. This follows the safety journeys in acceptance J03/J04 and J17.

**Fix:** Evaluate current-reading escalation before awaiting persistence, and give it a separate presentation path from the saved confirmation. Preserve the draft and offer retry. For BP, evaluate both valid entered readings independently of which writes committed. Do not route a failed write through copy that claims it was saved.

### F02. An existing water banner survives a newly saved fluid restriction

**Severity: wrong advice.** [ReminderHost.tsx:80](../../src/reminders/ReminderHost.tsx#L80), schedule restart at lines 80 to 86, unconditional pending selection/render at lines 94 to 105; [pending.ts:37](../../src/reminders/pending.ts#L37).

**Trigger:** Let the 11:00 water reminder appear. Before answering it, set the fluid-limit answer to Yes or Not sure in You. Return to a screen that shows reminders.

**Observed:** `waterBlock` correctly blocks the new schedule, and the fluid-answer setter can turn water reminders off. Neither action removes the already pending reminder. The actual host probe still renders `ReminderBanner` after the profile changes. Its drink action remains available.

**Expected:** A fluid restriction must silence water encouragement immediately, including queued banners and their badge contribution. The same stale-queue problem occurs when reminders are turned off, Status becomes Away/Unwell/Flare, or a water goal has been met.

**Fix:** Revalidate and prune pending reminders whenever profile, habits, Status, current day, quiet hours or water totals change, and before rendering or accepting their actions. Keep the user's recorded water total. Restarting the future scheduler alone does not clear its old output.

### F03. Adding a historical low tells the person to treat it now

**Severity: wrong advice.** [QuickLog.tsx:248](../../src/screens/track/QuickLog.tsx#L248), selectable reading time, and line 268, unconditional glucose escalation. Compare the existing recency handling in [EditSheets.tsx:23](../../src/screens/track/EditSheets.tsx#L23).

**Trigger:** On 8 October, log a resolved `53 mg/dL` episode from 1 October through Quick Log.

**Observed:** The component emits `T-HYPO-LEVEL-2` with **“This is a serious low. Treat it now.”** Its steps say to take 15 g now, recheck in 15 minutes and contact the care team today. The entered historical timestamp does not qualify that instruction. Historical BP entry similarly uses the current-reading escalation path.

**Expected:** Recording a past episode should preserve its seriousness and offer review of that episode. Immediate treatment instructions require a current reading or current symptoms. An emergency reported now must still take priority regardless of the record's date.

**Fix:** Make current versus historical context explicit in Quick Log's guidance path. Ask about current symptoms/recovery when needed, and use past-episode copy for resolved history. Reconcile this with the correction flow. Do not invent a clinical expiry interval to solve a UI-context problem.

### F04. HbA1c targets disagree between cadence, chart and record detail

**Severity: wrong advice.** [MetricDetail.tsx:323](../../src/screens/track/MetricDetail.tsx#L323), default chart reference; line 376, default interpretation; [RecordDetails.tsx:214](../../src/screens/track/RecordDetails.tsx#L214). [cadence.ts:53](../../src/health/cadence.ts#L53) already reads `health.clinicianTargets.hba1cPercent`.

**Trigger:** Seed a clinician HbA1c goal of `8%` and a latest result of `7.5%`. Open the HbA1c chart and the reading detail.

**Observed:** Cadence treats the result as below the personal goal and uses its six-month interval. Track draws the default `7%` target and says the result is at or above the ADA goal. The interpretation helper already accepts the personal override, but these callers omit it.

**Expected:** The clinician's validated target leads in all three places, as BUILD-BRIEF explicitly requires. A less stringent individual goal must not be displayed as personal failure against a different default.

**Fix:** Pass the same validated clinician goal to the chart reference, metric notes and reading-detail interpretation, with its framework labelled. Convert the reference for `%`/`mmol/mol` display consistently.

### F05. Track's Water screen ignores the fluid-limit answer

**Severity: wrong advice.** [MetricDetail.tsx:372](../../src/screens/track/MetricDetail.tsx#L372); [targets.ts:412](../../src/screens/track/targets.ts#L412).

**Trigger:** Set `health.kidneyDisease = 'none'` and `health.fluidRestriction = true` or `'unsure'`, for example after a clinician limits fluids for a heart condition. Open Track > Water.

**Observed:** The caller passes only kidney disease to `waterNote`. The screen still gives the generic healthy-adult line about approximately two litres per day. Reminder setup correctly suppresses water encouragement for this same profile.

**Expected:** The fluid answer and relevant heart/renal context must qualify advice wherever it appears. A recorded intake is still a fact the person may enter.

**Fix:** Use the canonical fluid-answer/`waterBlock` logic for Water's explanatory copy and goal presentation. Retain logs, suppress generic intake encouragement in the restricted/uncertain state, and put the clinician's fluid plan first without inventing an amount.

## Lost work and incomplete records

### F06. Logging during pending workout finalisation overwrites the finished record

**Severity: data loss.** [useWorkout.ts:79](../../src/screens/workout/useWorkout.ts#L79), finish snapshot and write at lines 80 to 90; autosave at line 71; [sheets.tsx:127](../../src/screens/workout/sheets.tsx#L127), enabled Keep going; [TodayWorkoutScreen.tsx:199](../../src/screens/workout/TodayWorkoutScreen.tsx#L199).

**Trigger:** Log one set. Tap Save workout. Delay the final `update` write. Tap Keep going, which remains enabled, and log another set before the finish resolves.

**Observed:** The finish captures the earlier state. The second set submits a whole-record `in_progress` autosave behind the finish. The serial queue correctly commits requests in order:

1. First-set autosave.
2. Finished snapshot, with completion time and notes.
3. Second-set autosave, still `in_progress`, with null completion time and empty notes.

The finish promise returns a successful partial record and the screen navigates to its detail, but the later autosave replaces that record. The probe's final stored status was `in_progress`.

**Expected:** A successful finish must be the final committed state of that workout, or an explicitly cancelled finish must keep the person editing without a false success. Notes and completion metadata must survive. Acceptance J17 requires recovery of the task on delayed/failed writes.

**Fix:** Prevent closing/editing/logging while finalisation is pending, or implement explicit cancellation and revision reconciliation. Move the hook to its finished state after success and prevent later autosaves from an older editing state.

### F07. A failed profile save destroys the editor's draft

**Severity: data loss.** [ProfileScreen.tsx:37](../../src/screens/you/ProfileScreen.tsx#L37), `setEditing(undefined)` at line 38 before the awaited write.

**Trigger:** Edit several profile answers and complete the wizard. Delay `update`, then return a quota failure.

**Observed:** The wizard cover closes and its draft unmounts while the write is pending. The parent later shows “That did not save. Storage full”. Reopening the wizard starts from the old saved profile. The actual component probe showed the cover disappearing before resolution.

**Expected:** Failed-save answers remain available for correction or retry, as they do in the habit editors. A failure message alone cannot recover a destroyed draft.

**Fix:** Keep the editor and its answers mounted until success. Show the failure inside the editing flow, block duplicate submission while busy, and close only after the store acknowledges the result.

### F08. Walk draft storage failure is silently ignored

**Severity: data loss.** [persist.ts:129](../../src/walk/persist.ts#L129); ignored boolean in [live.ts:196](../../src/walk/live.ts#L196) and [WalkSummary.tsx:56](../../src/screens/walk/WalkSummary.tsx#L56).

**Trigger:** A walk's initial sessionStorage write succeeds. Subsequent `setItem` throws `QuotaExceededError`; continue for five minutes and pause or answer the summary, then reload.

**Observed:** `storeWalk` returns false and retains the new walk only in its module memory. Both callers ignore false. The probe showed five minutes in the current page, but a fresh module after reload restored the old running draft with zero recorded minutes. There is no draft-durability error on screen.

**Expected:** A draft that cannot survive reload must be identified as such, and its updates must not be described as recoverable without qualification. The final IndexedDB write's failure notice does not cover this separate sessionStorage failure.

**Fix:** Propagate the storage result through live and summary state. Use a durable draft store with handled errors where possible, preserve an explicit retry path, and give an accurate warning when only page memory holds progress.

### F09. Reload during a partial walk save defeats Discard's cleanup

**Severity: wrong data.** [WalkSummary.tsx:68](../../src/screens/walk/WalkSummary.tsx#L68), progress persisted only after the complete save loop; discard uses only `walk.saved` at line 85; [record.ts:161](../../src/walk/record.ts#L161).

**Trigger:** Finish a walk and tap Save walk. Commit its first `walkDuration` observation. Delay the second write, then reload. On the restored summary, choose Discard walk.

**Observed:** The first observation is in IndexedDB, but the persisted draft still has `saved: []`. Discard requests no removals, clears the draft and leaves the duration behind. This was reproduced through the actual summary handlers.

**Expected:** Discard removes all observations belonging to this unsaved/partly saved walk. Retrying Save should also discover exactly what already committed. Acceptance J17 requires no orphan records.

**Fix:** Discover committed records by the walk's stable context/IDs when recovering or discarding, and preserve commit progress after each acknowledgment if writes remain separate. Prefer a single transaction for the logical walk.

### F10. Partial walk deletion hides its own error and retry

**Severity: wrong data.** [RecordDetails.tsx:332](../../src/screens/track/RecordDetails.tsx#L332), `Gone` return at line 334 and sequential deletion at lines 343 to 349; [record.ts:234](../../src/walk/record.ts#L234).

**Trigger:** Delete a one-segment saved walk. Successfully delete its `walkDuration`, then fail deletion of `movementMinutes`, leaving movement and distance observations.

**Observed:** `walkRecords` requires a duration to construct the walk. After that duration disappears, the next render returns `Gone` before rendering the deletion error or confirmation controls. The probe retained `movementMinutes` and `walkDistance`; the error existed in hook state but no confirmation/retry was visible. The orphan movement still affects the weekly total.

**Expected:** Deletion is atomic, or the remaining records stay reachable with a retry that completes the original deletion. A smaller valid walk is not guaranteed by deleting its identifying duration first.

**Fix:** Delete the walk's activity observations as one store operation, or retain its identity and deletion plan until all removals succeed. Continue to preserve post-walk point-in-time pain ratings, which the UI explicitly promises.

### F11. A backup prepared earlier is stamped as covering newer data

**Severity: wrong data.** [DataSheets.tsx:45](../../src/screens/you/DataSheets.tsx#L45), one-time preparation; line 62, delivery-time backup stamp; line 73, live counts.

**Trigger:** Open Backup at 09:00. While the sheet remains open, another tab saves a glucose reading at 09:02. Share/download the already prepared file at 09:03.

**Observed:** The file still holds the 09:00 snapshot, while the description can show the newer live record count. `recordExport(nowAt())` records 09:03. The component probe produced a file with zero readings, a description backed by one current reading, and the 09:03 stamp. `backupNudge` subsequently treats the 09:02 reading as protected.

**Expected:** Counts and backup coverage describe the actual file. Records committed after its snapshot remain eligible for a later backup nudge.

**Fix:** Retain the file snapshot's export time/revision and counts. Invalidate and reprepare it after relevant store changes, preserving the fresh-tap requirement for iOS sharing. Stamp the snapshot coverage on delivery rather than assuming the delivery time describes its contents.

### F12. A late file read replaces the backup the user selected most recently

**Severity: broken.** [RestoreFlow.tsx:49](../../src/screens/you/RestoreFlow.tsx#L49) and lines 54 to 65.

**Trigger:** Choose a large backup A. While “Reading the file…” is visible, use the still available restore trigger to choose smaller backup B. Let B finish first, then A.

**Observed:** Both reads unconditionally call `setStage`. B's preview appears, then A's late result overwrites it. The actual handler probe produced preview B followed by preview A. Restore can therefore apply a different selection than the latest one.

**Expected:** Only the active file-selection request can change the preview or error state. Pending import should also prevent a competing selection from replacing its state.

**Fix:** Give each selection a generation token, ignore stale decode results/errors, and disable competing actions while an import is committing. Keep the existing explicit Replace confirmation.

## Incorrect times, totals and provenance

### F13. Editing a note after travel changes an untouched reading's instant

**Severity: wrong data.** [logKinds.ts:144](../../src/screens/track/logKinds.ts#L144) and line 153; [EditSheets.tsx:91](../../src/screens/track/EditSheets.tsx#L91), time resolution at lines 109 to 112 and patch at line 129. The pressure editor uses the same helpers.

**Trigger:** A reading is stored as `2026-10-08T09:00:00+05:30`. Travel to Los Angeles, or restore that backup there. Correct only its note and save without touching the time control.

**Observed:** `toLocalInput` strips the offset and displays `09:00`. `fromLocalInput` reparses that wall time in the current zone. The probe rewrote it as `2026-10-08T09:00:00-07:00`, shifting the instant by 12.5 hours. Glucose freshness, ordering and meal timing can all change.

**Expected:** An untouched timestamp remains byte-for-byte/instant-equivalent to its saved value. If a timestamp is displayed in the current device zone, its control must represent that converted instant consistently.

**Fix:** Track whether the time field was actually edited. Preserve `o.at` otherwise, or initialise the control from the instant converted to the device zone and resolve edits with explicit zone semantics.

### F14. BP's “one minute apart” repeat is recorded one millisecond apart

**Severity: wrong data.** [QuickLog.tsx:361](../../src/screens/track/QuickLog.tsx#L361), `justAfter`, and its use at line 430. Instructions at lines 461 and 478 say one minute apart.

**Trigger:** Record a first reading at 23:59 on 8 October and an actual repeat at 00:00 on 9 October using the two-reading form.

**Observed:** The repeat is saved at `2026-10-08T23:59:00.001+05:30`, one millisecond later and on the wrong day. The normal 09:00/09:01 case likewise becomes a one-millisecond interval. This is ordering metadata presented as acquisition time.

**Expected:** Each BP acquisition has its actual declared time. Sequence should resolve ordering without fabricating an interval.

**Fix:** Capture the repeat's time separately, with an explicit repeat-time control or confirmed interval. Use `seq`/IDs for deterministic ordering. This finding concerns the recorded timestamps, not the excluded engine's BP-spacing policy.

### F15. GPS silence creates an unobserved distance bridge

**Severity: wrong data.** [gps.ts:236](../../src/walk/gps.ts#L236), coverage increment at line 237, retained distance anchor at lines 243 to 260, and acceptance at lines 272 to 291.

**Trigger:** Supply accurate one-metre-per-second fixes through second 60. Supply no fixes for the next minute. At second 120, deliver a fresh accurate fix 120 metres from the start.

**Observed:** The readout correctly becomes lost during the gap. On return, the old anchor is still used: distance increases from approximately 55 m to 120 m, while `coveredMs` remains 60,000. The intervening distance is added without matching GPS time. The screen's “distance is not being measured” statement did not stop it being counted on reconnection.

**Expected:** An outage creates a measurement gap. D18's prohibition on bridging unknown gaps should apply to GPS distance as well as app visibility. The app cannot reconstruct the route or pace from two distant endpoints.

**Fix:** Reset/reanchor distance and pace after a signal gap, preserving totals already measured. Track matching GPS spans so later distance and coverage describe the same observations.

### F16. Average pace changes when the same walk is opened from history

**Severity: wrong data.** [record.ts:58](../../src/walk/record.ts#L58), summary uses GPS coverage; lines 115 to 120 save full segment coverage without GPS duration; [RecordDetails.tsx:314](../../src/screens/track/RecordDetails.tsx#L314).

**Trigger:** Finish a five-minute foreground walk with four minutes of usable GPS and 500 m measured distance. Save it and open its Track detail.

**Observed:** The summary says 8 min/km using four GPS minutes. The saved detail says 10 min/km using all five walk minutes. Having one distance observation per segment does not prove that GPS covered the whole segment.

**Expected:** The saved record preserves the summary's measurement basis and limitations, or explicitly reports that pace cannot be recovered. Reload must not invent a different pace from the same observations.

**Fix:** Persist matching GPS duration/coverage information with distance and use the same pace calculation in both views. Omit pace when the persisted record cannot establish that basis.

### F17. A walk crossing midnight credits all movement to its starting day

**Severity: wrong data.** [record.ts:115](../../src/walk/record.ts#L115), one observation per segment stamped at its start; [movement.ts:70](../../src/screens/track/movement.ts#L70), inclusion based only on `o.day`.

**Trigger:** Walk continuously from Sunday 11 October 23:59 to Monday 12 October 00:02.

**Observed:** The generated movement observation has Sunday's day and value three minutes. Sunday's total and the previous weekly ring receive three minutes; Monday and the new week receive zero. The probe reproduced both day totals.

**Expected:** Daily/weekly movement allocation is one minute before midnight and two after it. Showing the whole activity once in a timeline on its starting day is reasonable; allocating all its movement there is a separate error.

**Fix:** Split the time contribution at local-day boundaries while retaining the common walk identity. For steps/distance, preserve real per-day samples if available or identify allocation as unknown instead of guessing proportional measured totals.

### F18. Walk fallback drops every segment after the first

**Severity: wrong data.** [movement.ts:72](../../src/screens/track/movement.ts#L72), context-wide covered set, skip at line 78 and add at line 90.

**Trigger:** Restore two nonoverlapping `walkDuration` records with the same `walk:` context, lasting two and three minutes, without parallel `movementMinutes` records. Another valid path is a partly saved multi-segment walk with a movement record for its first segment but only a duration for its second.

**Observed:** The first fallback marks the entire walk context covered. The second duration is skipped. The probe counted two minutes instead of five; a movement record for one segment can suppress the other segment's fallback completely.

**Expected:** Copies of the same interval are deduplicated, while distinct intervals belonging to the same activity are all counted.

**Fix:** Match coverage by segment/interval, not just activity context. Exclude the corresponding duration fallback only when its own interval is represented, then let the central overlap resolver handle genuinely overlapping intervals.

### F19. A completed session's movement changes day when the device changes timezone

**Severity: wrong data.** [movement.ts:46](../../src/screens/track/movement.ts#L46), especially `nowAt(new Date(start))` at line 58.

**Trigger:** Complete a ten-minute session in Delhi on Monday 12 October from 00:05 to 00:15. Its `session.date` is `2026-10-12`, and `startedAt` is `2026-10-11T18:35:00Z`. Open the same record on a Los Angeles device.

**Observed:** The session interval is reconstructed as Sunday 11 October 11:35 with the Los Angeles offset. The Monday session contributes movement to Sunday and the previous week. The probe produced `movementDay = '2026-10-11'` from `recordDate = '2026-10-12'`.

**Expected:** Historical daily/weekly totals follow the recorded local day, with any timezone reinterpretation being explicit. Travelling should not silently rescore last week's ring.

**Fix:** Persist capture-zone/offset information for session intervals. For legacy records, honour the saved `session.date` in a documented fallback instead of reassigning it using the current device zone.

### F20. A manual workout credits hours of phone inactivity as movement

**Severity: wrong data.** [model.ts:492](../../src/screens/workout/model.ts#L492), first-set start time; finish time at line 587; [movement.ts:48](../../src/screens/track/movement.ts#L48), elapsed fallback via [logging.ts:195](../../src/session/logging.ts#L195).

**Trigger:** Log one manual set at 09:00, leave the app/lock the phone, and finish the workout at 13:00 without further exercise.

**Observed:** No active-duration value is recorded. The wall-clock fallback produces 240 movement minutes, source `manual`. The probe with the actual workout reducer and serializer reproduced this. The duration was neither measured as activity nor entered by the person.

**Expected:** The four-hour elapsed span may be useful session metadata, but it must not silently satisfy the recorded-movement goal. D31 and `movement.ts`'s own contract concern activity time, with provenance that distinguishes entered minutes from measurement.

**Fix:** Keep elapsed session time separate from movement credit. Record active intervals, or ask the person for activity minutes when they cannot be recovered. Do not impose an invented idle-time cutoff or relabel inferred elapsed time as entered activity.

### F21. A loaded carry's seconds become kilograms lifted

**Severity: wrong data.** [summary.ts:135](../../src/screens/workout/summary.ts#L135), volume at line 143; [model.ts:626](../../src/screens/workout/model.ts#L626); [RecordScreen.tsx:125](../../src/screens/workout/RecordScreen.tsx#L125).

**Trigger:** Complete one suitcase-carry set lasting 30 seconds with 20 kg.

**Observed:** The set line correctly says `30 s · 20 kg`, and rep count correctly excludes the carry. Volume still multiplies `20 × 30` and the detail presents **“Total lifted 600 kg”**. Stored `totalVolume` uses the same computation.

**Expected:** Seconds are not repetitions. A time-under-load quantity, if useful, needs its own definition and unit; it cannot be added to repetition-based lifting volume as kilograms.

**Fix:** Exclude timed sets from repetition-based tonnage, or calculate and label a separate `kg·s` measure. Correct both stored and displayed totals. The existing totals test at `summary.test.ts:72` covers an unweighted plank, so it misses this loaded case.

### F22. Track displays a guided hold's stored planner count as actual repetitions

**Severity: wrong data.** [RecordDetails.tsx:467](../../src/screens/track/RecordDetails.tsx#L467) to line 477. Correct handling exists in [summary.ts:107](../../src/screens/workout/summary.ts#L107).

**Trigger:** Open a guided session detail containing a completed plank whose legacy/planner count is `actualReps: 7`, with `guided: true`.

**Observed:** The actual `ExerciseList` renders `1 of 1 set done · 7 reps`. The Workout formatter explicitly recognises that this guided hold count is a planner target, not measured seconds, and correctly renders Done. Track bypasses it. This list also hardcodes kg instead of the chosen display units.

**Expected:** A completed hold may say Done without inventing a count or duration. Real timed manual sets use seconds; real rep sets use reps; weights follow the display preference.

**Fix:** Reuse the existing timed/guided-aware `setLine` formatting, or an equivalent common formatter, with the user's unit preferences.

## Cadence, Status and reminder timing

### F23. An incomplete BP block is marked complete

**Severity: wrong advice.** [cadence.ts:181](../../src/health/cadence.ts#L181), completion at lines 188 to 193 and morning completion at line 197. Weekly treated monitoring has a related one-reading completion at line 159.

**Trigger:** For untreated/unconfirmed hypertension, enter one full BP reading in the morning and one in the evening on 1, 3, 5 and 7 October, eight readings total. Open cadence on 8 October.

**Observed:** Each day becomes a “full” day merely because morning and evening exist. Four such days within a week end the diagnostic prompt. The probe returned no BP due item, although each measurement session contains half the readings the UI requests and the dates do not meet its “in a row” instruction.

**Expected:** Completion matches the protocol the screen cites and asks the person to follow: two acquisitions per measurement session, morning and evening. NICE NG136 section 1.2.7 requires consecutive measurements at least one minute apart within a session. The app also explicitly promises a consecutive-day block.

**Fix:** Count distinct acquisitions in each session, validate the required block, and reconcile any unknown timing rather than claiming completion. Apply the same session-completion definition to the stable treated check day; do not ask for endless daily checking after a genuinely completed diagnostic block.

### F24. Same-day lab ordering uses the older result for cadence

**Severity: wrong advice.** [cadence.ts:97](../../src/health/cadence.ts#L97), strict string `>`; same-date noon lab stamping in [QuickLog.tsx:816](../../src/screens/track/QuickLog.tsx#L816). Similar tie handling exists in [metrics.ts:219](../../src/screens/track/metrics.ts#L219) and `MetricDetail.tsx:364`.

**Trigger:** Add HbA1c `6.5%` for 8 June, then add `9%` for the same lab date. Both get the date-only noon timestamp. In the tested store they receive increasing sequences, 3 then 4. Check due items on 8 October.

**Observed:** `latest` retains the first record when timestamps tie. Cadence uses `6.5%`, chooses the six-month path and returns no due HbA1c item. The later `9%` result requires the app's three-month path and is already due. A lab display-unit tie can likewise retain the older statement's unit.

**Expected:** All latest-result consumers apply the same deterministic statement order, including sequence/edit semantics when acquisition time is equal. Lexicographic offset-bearing timestamps are also not a universal chronological comparator.

**Fix:** Use the central observation ordering/comparison with parsed instants and a deterministic tie-breaker for cadence, notes and lab-unit selection. Treat a genuine correction as a correction rather than depending on array order.

### F25. “Back to Normal” does not clear accepted overlapping Status periods

**Severity: wrong data.** [status.ts:88](../../src/health/status.ts#L88), latest covering period; [status.ts:147](../../src/health/status.ts#L147) to line 171, only that period closed.

**Trigger:** Restore accepted settings containing an open Flare from 1 October and an open Unwell from 3 October. On 8 October, choose Back to Normal.

**Observed:** Only Unwell ends on 7 October. Flare is still open and becomes today's active Status. The real store accepted these periods; the pure-function probe returned Flare after the Normal action. Gentle/rest recommendations, paused prompts and consistency exclusions continue.

**Expected:** Normal means no period covers today. A valid import must not make the user's attempt to return to Normal ineffective.

**Fix:** Canonicalise overlapping imported periods, or end/remove every period covering today when returning to Normal, preserving earlier history. If overlaps are disallowed, reject them explicitly during preview rather than accepting settings the UI cannot clear.

### F26. Catch-up reminders can fire during quiet hours or on a newly paused day

**Severity: wrong advice.** [schedule.ts:136](../../src/reminders/schedule.ts#L136), quiet filtering at scheduled time only; lines 186 to 190, occurrence-day Status; lines 236 to 240, catch-up.

**Trigger A:** Water schedule includes 09:55. Quiet hours are 10:00 to 11:00. Suspend the app at 09:54 and resume at 10:01.

**Observed A:** `tick` fires the 09:55 water occurrence during quiet hours, because its scheduled minute was outside them.

**Trigger B:** Yesterday is Normal; today's scheduled Status is Unwell. Suspend at 23:54 and resume at 00:02 after a 23:55 reminder became due.

**Observed B:** `tick` fires yesterday's reminder on today's Unwell screen. Both outputs were reproduced with the actual scheduler.

**Expected:** Catch-up must respect the current wall clock's quiet hours and current day's Status, not only the eligibility of the original occurrence.

**Fix:** Apply current eligibility before emitting/rendering catch-up results. Skip reminders that are now quieted or contraindicated. Use F02's pending revalidation for reminders already emitted.

### F27. Backdated records never count as new data for the backup nudge

**Severity: wrong data.** [backup.ts:53](../../src/reminders/backup.ts#L53), source fields; lines 70 to 82, event-time span; comparison at line 48.

**Trigger:** Back up on 8 October at 10:00. At 11:00, enter an old lab result dated 8 June. Make no later dated observation. Check backup nudges on 8 November.

**Observed:** `recordSpan` examines acquisition/event dates, not when the record was added. Its latest date remains before the export stamp. The probe returned `{ due: false, daysSince: 31 }` even though the backup omits the newly added result.

**Expected:** A new record or correction added since the snapshot counts as unprotected, regardless of the clinical event's date. Profile/settings changes also need a coverage definition rather than reliance on event dates.

**Fix:** Track the store revision or actual mutation time covered by each export. Compare that watermark with later committed mutations. The observation schema has `seq`, but no general recorded-at timestamp to substitute silently.

## Broken journeys and platform behaviour

### F28. Editing the programme start date reports success but ignores the change

**Severity: broken.** [ProfileScreen.tsx:39](../../src/screens/you/ProfileScreen.tsx#L39) to line 46.

**Trigger:** For an enrolled user, complete the programme/about editor with `WizardResult.startDate = '2026-10-05'` instead of the stored `2026-09-28`.

**Observed:** The parent writes the profile, weight and display-unit preference but drops `result.startDate`. The probe applied the old date; the success path still says “Saved. Today uses your new answers.”

**Expected:** A date offered as editable must persist and drive programme week/day selection.

**Fix:** Save the submitted programme date for the sections that actually edit it. Do not let a health-only edit accidentally reset it.

### F29. Programme entry/exit controls are absent, while changing Focus can enrol

**Severity: broken.** [routes.tsx:25](../../src/screens/move/routes.tsx#L25) and lines 34 to 39; [PlanScreen.tsx:49](../../src/screens/move/PlanScreen.tsx#L49) and lines 77 to 87; [FocusScreen.tsx:18](../../src/screens/you/FocusScreen.tsx#L18); [recommend.ts:267](../../src/health/recommend.ts#L267).

**Trigger:** Finish Stretch onboarding with an empty programme start date and the profile's default training days. Open Move > Your plan, or change Focus to Build strength in You.

**Observed:** Move shows a programme week and training schedule without an enrolment-aware Join view. There are no Join/Leave actions in the Move routes. You says changing Focus “does not start or stop” the programme and directs the person to Move, under Your plan. Yet `isEnrolled` returns true for Strength plus training days even when the start date is empty. The probe confirmed this; the profile screen's separate `startDate !== ''` definition can still regard the same person as outside it.

**Expected:** D8 makes programme entry optional and explicit. Focus selects what Today leads with. Programme membership has one definition, and the place the UI names for joining/leaving actually provides those actions.

**Fix:** Add an explicit join/start-date flow and a leave/pause action preserving history. Use one canonical membership definition across Today, Move and You. Changing presentation focus must not substitute for joining.

### F30. “Explore first” still forces the full safety questionnaire before browsing

**Severity: broken.** [FocusStep.tsx:32](../../src/screens/welcome/FocusStep.tsx#L32), shared next step; [assemble.ts:33](../../src/screens/welcome/assemble.ts#L33), lines 60 to 62 and 79 to 80; [HealthStep.tsx:39](../../src/screens/welcome/HealthStep.tsx#L39).

**Trigger:** Fresh installed app, choose Explore first, and try to reach Guide or enter a historical record without answering health questions.

**Observed:** Every focus uses a Welcome sequence containing Health. Explore's wizard asks body, health and summary, and `finished` refuses to complete without a profile. There is no browsing-only completion path.

**Expected:** Acceptance J01/P07 explicitly allows browsing and logging without initial medical/gym answers, then requires safety answers before the first movement. D34 adopts that acceptance suite; the vision also says profile questions belong at the relevant first action.

**Fix:** Complete the Explore installation/focus path with health explicitly unreviewed or absent. Offer the health setup when movement first needs it through the existing gate. Do not fabricate negative health answers to get past onboarding.

### F31. A query arriving while Today is mounted is consumed without opening its sheet

**Severity: broken.** [TodayScreen.tsx:127](../../src/screens/today/TodayScreen.tsx#L127) to line 136.

**Trigger:** Today is already mounted with no sheet. Navigate the same router to `/today?checkin=1`, or another supported sheet query, without remounting the screen.

**Observed:** `useState(() => sheetFrom(params))` runs only on mount. The effect notices the new query and deletes it, but never updates `sheet`. The component probe ended with an empty query and `CheckInSheet.open = false`.

**Expected:** An explicit supported incoming query opens its requested sheet once, then is removed so Back does not reopen it. Initial deep links already work.

**Fix:** Decode changed incoming sheet parameters into state before replacing the URL. Distinguish consumption of an incoming request from ordinary local sheet closure.

### F32. Today's frozen card does not reflect changed permission requirements

**Severity: wrong advice.** [TodayScreen.tsx:102](../../src/screens/today/TodayScreen.tsx#L102) to line 120; [recommend.ts:753](../../src/health/recommend.ts#L753), freeze key.

**Trigger:** Keep Today open. At 09:00 its passed Walk permission is allowed. At 09:31 the supplied permission requires a new check-in, for example because an exercise reading has become stale. Keep the same day, visit, saved check-in, start date and Status.

**Observed:** Permissions are read inside `work`, which is not rerun for this clock change. The actual component keeps “Walk now”. Running the actual recommender with the updated, valid hold/`needsCheckIn` permissions gives “Check in & walk”. The start handler still uses the shared movement gate; this finding is misleading presentation, not a demonstrated permission bypass.

**Expected:** D20's stable ordinary recommendation can remain in place, but its current safety requirement and CTA must reflect D30's per-mode permission. BUILD-BRIEF/vision require medical stop states to replace movement encouragement.

**Fix:** Freeze the activity choice separately from live safety/permission presentation. Refresh those permissions on relevant clock/store changes, and apply their latest instructions and CTA to the frozen choice.

### F33. The exercise detail's on-screen Back loses search and filters

**Severity: polish.** [ExercisesScreen.tsx:32](../../src/screens/move/ExercisesScreen.tsx#L32) to line 44, filters in URL; link at line 101; [ExerciseScreen.tsx:13](../../src/screens/move/ExerciseScreen.tsx#L13), fixed Back.

**Trigger:** Search/filter the exercise library, open an exercise, then tap the detail screen's Exercises back link.

**Observed:** The link always navigates to `/move/exercises` without the original query. The list resets, despite its explicit promise at lines 27 to 29 that Back returns to the same list. Browser history Back can retain the old URL; the visible app back control does not.

**Expected:** Return to the originating filtered library. Direct exercise links still need a sensible unfiltered fallback.

**Fix:** Carry the originating library path and search in navigation state, or use a validated history return with a deep-link fallback. Keep that return origin when following related exercises.

### F34. A late Wake Lock grant escapes release after leaving Walk

**Severity: polish.** [browser.ts:122](../../src/walk/browser.ts#L122) to line 136; [live.ts:320](../../src/walk/live.ts#L320), stale answer ignored, and detach release at line 453.

**Trigger:** Start Walk, delay `navigator.wakeLock.request('screen')`, then leave the walk screen while the SPA remains visible. Resolve the pending request after detach called `release`.

**Observed:** The platform wrapper releases its currently null sentinel, then assigns the late sentinel after the await. The live controller's token prevents a stale UI update but does not release that resource. The actual wrapper probe reported the late grant as successful and recorded zero releases of that sentinel.

**Expected:** Leaving Walk cancels its request's ownership. A late grant must be released so the app does not keep the screen awake unexpectedly.

**Fix:** Add cancellation/generation ownership to the wrapper and release grants belonging to superseded requests. Ensure cancelling an old request cannot release a newer valid lock. This async resource race is code-verified; actual iPhone dimming behaviour still needs a device pass.

## Checked and correct

These checks cover the stated paths, rather than granting blanket approval to an area.

* **Clinical targets and units:** Track's unit helpers convert glucose with factor 18, convert pounds/inches to canonical kg/cm, and preserve an untouched value across a display-unit change. Home versus clinic BP frameworks are named. Asian/Indian BMI guidance is distinguished from WHO defaults. All-glucose charts omit a misleading universal meal-context band; step guidance does not mandate 10,000 steps; vitamin D does not get an invented routine testing interval. Personal HbA1c targets remain the F04 exception.
* **Day totals and missing values:** Manual step totals replace the day's manual statement rather than adding another total. Walk/session steps remain activity observations. Missing chart slots are gaps, and absent sensor data is not saved as zero. Water's add-to-total operation handles simultaneous increments through the serial store operation.
* **BP pairing:** Each `putBloodPressure` saves systolic/diastolic halves together. Missing historical halves are described rather than filled in. A severe first acquisition still produces guidance if a second acquisition fails. F01 covers the opposite ordering.
* **Habit/profile setters:** The seven `you/write.test.ts` cases use the fake IndexedDB implementation and pass. Concurrent habit changes preserve each other. Fluid restriction is stored on the profile; answering Yes/Not sure and disabling future water reminders is one update. Failed habit-sheet saves keep their draft and sheet open. Food preferences deduplicate case-insensitively and retain failed input.
* **Water eligibility for new output:** The canonical resolver honours `health.fluidRestriction`, including Not sure, before the old habit copy. New in-app schedules and newly generated calendar files omit blocked water prompts. Kidney/heart conditions and unreviewed profiles are treated conservatively. F02 and F05 concern old output and another caller.
* **Today and movement entry:** The fixed alternative chooser offers the intended modes. Movement entry calls the shared start API. The pure recommender gives emergency/today/recheck precedence using the permissions it receives. Ordinary stale presentation is F32, not evidence that a start bypasses the gate.
* **Status's ordinary path:** Inclusive date handling, a single nonoverlapping active period, and the explicit plan-shift offer behave as intended in tested cases. Dismissing that offer does not silently shift the programme. Status days are excluded from the intended consistency display. Imported overlap is F25.
* **Stretch and Move preview:** Offered stretch durations, equipment/profile cases and preview calculations pass. Choices survive through their URL parameters. Preview derives its timing from the generated plan. Starts use the shared movement interface. No independent defect was established in `engine/stretch.ts`.
* **Walk visibility lifecycle:** Hiding/leaving closes the observed segment; return creates a gap and a new segment. Distance does not bridge an app-hidden gap. Added gap time is stored as manual, separate from measured time. GPS denial permits a timed walk, and absent GPS/motion does not create fabricated distance or step observations. A GPS signal outage inside a visible segment is F15.
* **Walk privacy and retries:** Drafts and saved records do not persist raw GPS coordinates or a route. Stable observation IDs let a completed retry skip records already on the device without duplication. The last-started guard prevents Back to an old live URL from starting the same walk again. These protections do not fix F09's Discard path.
* **Workout record handling:** Canonical loads, set edits, swaps and rest-deadline arithmetic pass. A past workout entered after the fact has no invented live start/end/rest clock. Editing/deleting a workout rederives its personal records in the same AppData update. Guided and manual timed-set wording is correct in the Workout formatter, with the F21/F22 caller/volume exceptions.
* **Restore and clear controls:** Malformed decode results are caught before import. Preview exposes accepted/rejected records and conflict choices. Replace asks explicitly, including its second confirmation when existing records are held. Failed import results are shown. Delete everything is explicitly destructive, handles its store result and does not claim success before it succeeds. Actual cross-tab/reload clearing is reserved for browser validation.
* **Backup delivery:** A prepared file preserves iOS's fresh-tap sharing opportunity, and cancelled sharing does not update the backup date. Share/download failures are shown. F11 concerns the snapshot coverage attached to successful delivery.
* **Calendar serialization:** Existing tests cover CRLF output, escaping, UTF-8 line folding, floating local start times, UTC stamps, daily recurrence and display alarms. The serializer does not by itself prove iOS Calendar accepts or updates the file. The UI already explains that an exported calendar cannot follow later app Status changes.

## Needs a device check and skipped checks

No command requiring approval was run. Fresh shell execution was unavailable because sandbox initialisation returned `sandbox_apply: Operation not permitted`; no escalation was requested. Reads and probes used the existing Node process and wrote nothing to the repository. Native Vitest CLI, a dev server, Playwright, screenshots and build/cache-producing commands were not run. This is not a completed D34 browser release pass.

* Run the acceptance journeys at 430×932 and 320×568 in light/dark Chromium, including all failure and reload paths above. Horizontal overflow, keyboard obstruction, sheet focus, screen-reader announcements and tappability were not established by the handler probes.
* On an installed iPhone PWA, deny/revoke location and motion, lock during Walk/Workout, return through background suspension and page restoration, and kill/reopen during partial writes. Confirm the recorded time, gap wording, drafts and history against an IndexedDB snapshot.
* Verify actual motion sampling and step accuracy with a stationary phone, slow walking, a bag/pocket, and interrupted sensor delivery. Unit tests of signal filtering cannot establish device accuracy or whether a stopped stream is labelled appropriately.
* Check native wake-lock support, loss and reacquisition, including F34's navigation race. Web API feature detection and the controlled sentinel probe do not establish OS behaviour.
* Import the generated `.ics` in iOS Calendar. Verify quiet windows, a midnight-crossing schedule, travel/DST recurrence and reimport after changing the number of events. Establish whether removed old events remain and how the UI should tell the user to remove them. No rejection or cancellation behaviour is asserted without that check.
* Check spring-forward and repeated local hours in the real reminder runner and calendar hand-off. Pure wall-clock tests alone do not verify browser timer suspension, alarm delivery or every timezone transition.
* Verify Safari's actual quota/unavailable-storage behaviours, cross-tab Replace/Clear and termination while writes are pending. Review native share/download/File handling and the CompressionStream fallback with a real backup. Those browser effects were not inferred from successful fake IndexedDB tests.
* Exported calendar events are independent copies. Test the existing explanatory copy when fluid restrictions or Status change after export; the app cannot revoke events already imported into another application.

## Verdict per area

Verdicts apply to the reviewed scope. They do not certify the excluded safety engine, session player or content changes.

| Area | Verdict | Required action |
| --- | --- | --- |
| Today | **ship after fixes** | F31/F32; verify shared movement totals after F17 to F20 |
| Track | **do not ship** | Current/historical guidance and fluid/personal-target advice, F01/F03/F04/F05; deletion, times and numeric display, F10/F13/F14/F22 |
| Workout | **do not ship** | Finalisation race F06; elapsed movement and carry totals F20/F21 |
| Walk screens and `src/walk` | **do not ship** | Draft/recovery F08/F09; GPS/pace/day allocation F15/F16/F17; resource cleanup F34; Track deletion F10 |
| You | **do not ship** | Failed profile draft, backup coverage and restore selection, F07/F11/F12; ignored date F28; programme membership F29 |
| Welcome | **ship after fixes** | Explore-first journey F30, then the real installation/restore pass |
| Reminders | **do not ship** | Pending fluid-limit advice F02; current quiet/Status eligibility F26; backup change tracking F27 |
| Move screens | **ship after fixes** | Explicit programme entry/exit F29 and library return origin F33 |
| `engine/stretch.ts` | **ship** | No independent defect found in reviewed generation/preview cases; validate its consumers with the separately fixed shared gate |
| `health/recommend.ts` | **ship after fixes** | Canonical enrolment F29 and coordinated live-permission presentation F32 |
| `health/cadence.ts` | **ship after fixes** | BP completion F23 and deterministic latest-result selection F24 |
| `health/status.ts` | **ship after fixes** | Accepted overlapping periods and return to Normal, F25 |
