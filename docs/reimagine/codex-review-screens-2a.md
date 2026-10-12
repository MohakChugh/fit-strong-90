# Screens re-check, part 1

Reviewed on 8 October 2026 against the working tree, with `HEAD` at `f21db7a`. **Twenty-one of the 24 requested findings are fixed; F01, F23 and F24 remain incomplete. Four additional problems are reproduced below.** Today, Track, Workout and Move need the listed fixes before release. The shared timed-set volume and personal-record fix passes.

The scope is Today, Track, Workout, Move, `health/recommend`, `health/cadence`, `health/status`, and the requested shared logging helpers and atomic observation calls. Decisions D8, D10, D20, D29, D30 and D34, the build brief, vision, acceptance suite, original screen audit and safety re-audit supply the contracts. Movement callers were checked against the supplied permission interface; this is not a new audit of the safety engine or the other areas excluded from this review.

**Verification**

Executed **705 existing test cases, all passing**, by transpiling TypeScript in memory and running the existing test bodies with their assertions and hooks. This was not a normal Vitest CLI run. The selected cases were:

| Tests | Cases | Result |
| --- | ---: | --- |
| Today model | 36 | Pass |
| Health recommendation, cadence, cadence Node import and Status | 189 | Pass |
| Track, 13 test files | 204 | Pass |
| Workout, nine test files | 125 | Pass |
| Move preview, plan and library | 56 | Pass |
| `lib/utils` and `session/logging` | 87 | Pass |
| Eight selected atomic-batch coordinator cases in `store/review.test.ts` | 8 | Pass |
| **Total** | **705** | **Pass** |

Workout's gate, screen and tests changed during the review. I refreshed the module cache, reran the selected tests, and repeated the affected screen probes against the newer `gateInputFor` implementation.

Additional probes compiled the actual component functions, drove their real callbacks with controlled hook and store dependencies, and inspected returned element props and state. Real store probes used the project's in-memory IndexedDB implementation, including quota and delete failures and reloads. These establish callback and data behaviour, not browser rendering, focus, geometry or WebKit behaviour. No application, test or existing documentation file was changed.

## Reconciliation of the requested findings

Each row covers the original finding. A fixed original trigger can have a separate newly discovered regression, identified as R01 to R04 below.

| Finding | Result | Code path, test and observed result |
| --- | --- | --- |
| **F01, dangerous reading when a write fails** | **STILL BROKEN** | [GlucoseForm](../../src/screens/track/QuickLog.tsx#L265) and [PressureForm](../../src/screens/track/QuickLog.tsx#L439) now evaluate valid inputs independently of write success, including a severe second BP reading. Resolved failure produces correctly labelled unsaved guidance. However, glucose awaits persistence at line 282 and BP at line 463 before presenting that guidance. A pending `600 mg/dL` save showed no clinical instructions. A failed correction to `600` also showed only the storage error, through [EditReadingForm](../../src/screens/track/EditSheets.tsx#L132). Boundary helpers pass [escalation.test.ts](../../src/screens/track/escalation.test.ts#L190); the actual callback probes expose the remaining presentation failures. Details below. |
| **F03, historical low treated as current** | **FIXED** | [GlucoseForm](../../src/screens/track/QuickLog.tsx#L266) marks explicitly timed readings for a context question. [Guidance](../../src/screens/track/QuickLog.tsx#L874) selects [pastEscalation](../../src/screens/track/escalation.ts#L200) when the user answers Earlier. The historical `53` probe rendered “That was a serious low”, conditional advice for symptoms now, and care-team review, without instructing a recovered person to take carbohydrate now. [Past-episode tests](../../src/screens/track/escalation.test.ts#L170) pass. The question does not establish resolution of an extreme episode, which is the separate **R03**. |
| **F04, inconsistent personal HbA1c target** | **FIXED** | [MetricChart](../../src/screens/track/MetricDetail.tsx#L324), [Notes](../../src/screens/track/MetricDetail.tsx#L377) and [reading interpretation](../../src/screens/track/RecordDetails.tsx#L215) pass `clinicianOverrides`, which uses the same validated clinician goal as cadence. With goal `8%` and result `7.5%`, the actual chart target was 8 and both interpretations said “Under 8%, your clinician’s goal”. The cadence interval was six months. [Target tests](../../src/screens/track/targets.test.ts#L176) cover the personal goal and conversion to mmol/mol; [cadence.test.ts:264](../../src/health/cadence.test.ts#L264) covers the interval. |
| **F05, Water ignores the fluid-limit answer** | **FIXED** | [MetricChart](../../src/screens/track/MetricDetail.tsx#L303) suppresses the water goal through `waterAdviceBlocked`; [Notes](../../src/screens/track/MetricDetail.tsx#L373) passes profile and habits to `waterNote`. [targets.ts:427](../../src/screens/track/targets.ts#L427) uses the canonical water block. Actual chart/copy probes for `fluidRestriction: true` and `'unsure'`, with no kidney disease and a stored 2,000 ml goal, had no target and put the care team's advice first. [targets.test.ts:217](../../src/screens/track/targets.test.ts#L217) passes. |
| **F06, autosave overwrites a finished workout** | **FIXED** | [finalise](../../src/screens/workout/finalise.ts#L27) dispatches finish before awaiting outstanding writes, then commits the finished record last. [workoutReducer](../../src/screens/workout/model.ts#L505) refuses subsequent set changes while finished; [useWorkout](../../src/screens/workout/useWorkout.ts#L73) autosaves only in-progress state. [FinishSheet](../../src/screens/workout/sheets.tsx#L150) prevents dismissal and disables Keep going during saving. [finalise.test.ts:48](../../src/screens/workout/finalise.test.ts#L48) reproduces the delayed-write race and passes; its failure case at line 66 also passes. The failure path has a separate restart-state problem, **R04**. |
| **F10, partial walk deletion strands the detail screen** | **FIXED** | [WalkDetail.remove](../../src/screens/track/RecordDetails.tsx#L336) calls `removeObservations` once with all activity observation IDs. It reports refusal before leaving. [removeObservations](../../src/store/useStore.ts#L784) batches removal. [Coordinator tests](../../src/store/review.test.ts#L1332) verify complete deletion and rollback after a middle delete fails. The actual detail/store probe failed deletion of movement after other deletes had been attempted: reload retained duration, movement, distance and the pain rating; the confirmation stayed open with “This walk was not deleted”, and navigation was not called. |
| **F13, note-only edit shifts time after travel** | **FIXED** | [EditReadingForm](../../src/screens/track/EditSheets.tsx#L83) tracks whether time was touched and only patches `at` at line 102 when it was. Untyped numbers also retain their original stored precision. The BP editor retains the original time when untouched. [resolveEditedTime tests](../../src/screens/track/logKinds.test.ts#L102) cover the original offset. Actual note-only editing in Los Angeles of `2026-10-01T10:00:00+05:30` sent only `{ note: 'Added after travel' }`, preserving the instant, day, unit and `123.4567` stored value. |
| **F14, second BP time is invented across midnight** | **FIXED** | [PressureForm](../../src/screens/track/QuickLog.tsx#L432) resolves first and second times independently, with separate [TimeRow controls](../../src/screens/track/QuickLog.tsx#L486). The actual form probe saved four halves in one batch: first pair at `2026-10-07T23:59+05:30`, second at `2026-10-08T00:00+05:30`, with distinct reading contexts and correct separate days. [Datetime parsing tests](../../src/screens/track/logKinds.test.ts#L93) pass. No synthetic one-millisecond repeat remains. The default Now times still matter to **F23**. |
| **F16, detail invents a different average pace** | **FIXED** | [WalkDetail](../../src/screens/track/RecordDetails.tsx#L327) deliberately omits average pace because the saved data cannot recover the live GPS timing basis. The actual detail probe rendered time and distance but no pace row. [Walk listing tests](../../src/screens/track/metrics.test.ts#L198) pass. This is the permitted fix of omitting an unrecoverable measure; it does not verify the excluded live Walk implementation. |
| **F17, midnight walk credited wholly to its first day/week** | **FIXED** | [movement.clip](../../src/screens/track/movement.ts#L113) clips recorded intervals to the requested date range using the observation's offset and apportions minutes by covered time. [movement.test.ts:107](../../src/screens/track/movement.test.ts#L107) covers both day and week boundaries. The three-minute Sunday `23:59+05:30` probe returned one minute on Sunday and two on Monday. |
| **F18, fallback counts only the first walk segment** | **FIXED** | [movementIntervals](../../src/screens/track/movement.ts#L142) deduplicates interval identities, not an entire walk context. [movement.test.ts:97](../../src/screens/track/movement.test.ts#L97) covers two duration segments and a mixed movement/duration fallback. The two-minute plus three-minute probe returned five, including when a movement record also represented the first segment. |
| **F19, legacy guided session changes day after travel** | **FIXED** | [startOnRecordedDay](../../src/screens/track/movement.ts#L64) honours `session.date` when today's device offset would change that day; `sessionInterval` uses it at line 95. [movement.test.ts:35](../../src/screens/track/movement.test.ts#L35) passes. The Delhi Monday `00:05`, stored as Sunday `18:35Z`, counted ten minutes on the saved Monday and zero on Sunday when opened in Los Angeles. This preserves the recorded day; it cannot recover an original zone that the legacy record never stored. |
| **F20, manual workout's idle clock span counts as movement** | **FIXED** | [sessionInterval](../../src/screens/track/movement.ts#L83) requires positive recorded active seconds. [Workout active-time entry](../../src/screens/workout/sheets.tsx#L101) starts blank; [toSession](../../src/screens/workout/model.ts#L625) stores the entered active amount, and [RecordScreen](../../src/screens/workout/RecordScreen.tsx#L128) distinguishes entered active time from the logged clock span. [movement.test.ts:25](../../src/screens/track/movement.test.ts#L25) and [model active-time tests](../../src/screens/workout/model.test.ts#L311) pass. A four-hour span without entered active minutes counts zero. Placing entered minutes in time introduces **R01**. |
| **F21, carry seconds become lifted volume or a personal record** | **FIXED** | [isLoadedRepSet](../../src/lib/utils.ts#L137) rejects `unit: 'seconds'` and legacy IDs dosed in seconds by the planner. `calculateVolume` at line 142 and `deriveRecords` use it; [logging.newRecords](../../src/session/logging.ts#L177) uses it too. New guided timed sets receive the seconds marker. [utils.test.ts:328](../../src/lib/utils.test.ts#L328), [logging.test.ts:234](../../src/session/logging.test.ts#L234), [summary.test.ts:72](../../src/screens/workout/summary.test.ts#L72) and [model.test.ts:377](../../src/screens/workout/model.test.ts#L377) pass. A legacy carry, an explicitly marked timed set and a real `20 × 10` rep set produced eligibility `[false, false, true]`, volume 200 and no timed-set personal records. |
| **F22, Track calls a guided hold's planner count repetitions** | **FIXED** | [ExerciseList](../../src/screens/track/RecordDetails.tsx#L446) uses Workout's `exerciseLogs` and `setLine`, passing timed/guided state and display units. [summary.test.ts:59](../../src/screens/workout/summary.test.ts#L59) covers the guided hold. The actual legacy guided plank with `actualReps: 7` rendered “1 of 1 set done”, without seven reps or an invented duration. A manual 30-second, 20 kg carry in imperial display rendered “30 s · 44.1 lbs”. |
| **F23, incomplete BP protocol marked complete** | **STILL BROKEN** | [cadence.byDay](../../src/health/cadence.ts#L143) now requires distinct complete acquisitions, and [diagnosticWeek](../../src/health/cadence.ts#L215) requires four consecutive full days. The original single-reading, alternate-day case now stays due; [cadence.test.ts:90](../../src/health/cadence.test.ts#L90) and the diagnostic tests pass. However, line 149 counts IDs without checking acquisition spacing. Four days whose morning and evening repeats were only 30 seconds apart produced no BP due item, just like the valid one-minute pairs. Details below. |
| **F24, tied lab timestamps retain the older statement** | **STILL BROKEN** | [cadence.latest](../../src/health/cadence.ts#L102) and Track's lab-unit selection now use the shared observation ordering. [cadence.test.ts:288](../../src/health/cadence.test.ts#L288) passes in both input orders. But [MetricDetail.Notes](../../src/screens/track/MetricDetail.tsx#L365) still keeps the first result when parsed acquisition timestamps tie. Actual notes for `6.5%`, seq 3, followed by `9%`, seq 4, said “Under 8%”; cadence correctly used 9 and said HbA1c was due. Details below. |
| **F25, Back to Normal leaves an overlapping Status active** | **FIXED** | [changeStatus](../../src/health/status.ts#L139), through `endAllBut` at line 163, closes every valid period covering today, including overlaps. [status.test.ts:195](../../src/health/status.test.ts#L195) passes. The open Flare from 1 October and Unwell from 3 October both ended on 7 October; Status on 8 October became Normal. Earlier history and additional period fields are preserved. |
| **F29, implicit enrolment and no explicit Join/Leave** | **FIXED** | [isEnrolled](../../src/health/recommend.ts#L266) is the canonical rule: nonempty programme start date and training days. Focus does not enrol a person. Today and Move import this function; [PlanScreen](../../src/screens/move/PlanScreen.tsx#L82) offers Join or Leave accordingly. [withJoined / withLeft](../../src/screens/move/plan.ts#L254) preserve unrelated records. [recommend.test.ts:559](../../src/health/recommend.test.ts#L559) and [plan.test.ts:256](../../src/screens/move/plan.test.ts#L256) pass. The new Join form's failed-save behaviour is **R02**. |
| **F31, incoming Today query consumed without opening its sheet** | **FIXED** | [TodayScreen](../../src/screens/today/TodayScreen.tsx#L140) handles a changed request before the effect removes consumed keys. [model.test.ts:300](../../src/screens/today/model.test.ts#L300) covers query decoding. Actual mounted-screen navigation from `?keep=alpha` to `?keep=alpha&checkin=1` opened the guided check-in; consuming the request retained `keep=alpha`, used replace, and left the sheet open. |
| **F32, frozen recommendation masks a newer permission** | **FIXED** | [TodayScreen](../../src/screens/today/TodayScreen.tsx#L116) asks for current per-mode permissions each render and overlays them on the frozen choice at line 129. [recommend.test.ts:801](../../src/health/recommend.test.ts#L801) covers real insulin freshness. The actual component probe retained the same choice and freeze key while changing “Walk now” to “Re-check & walk”, adding the current permission's required-reading explanation. The old label did not remain. |
| **F33, exercise Back drops library search and filters** | **FIXED** | [ExercisesScreen](../../src/screens/move/ExercisesScreen.tsx#L105) passes the current list address in route state; [ExerciseScreen](../../src/screens/move/ExerciseScreen.tsx#L48) uses `libraryReturn`, including on missing exercises, and passes the same origin to related links at line 113. [library.test.ts:89](../../src/screens/move/library.test.ts#L89) passes. The actual Goblet Squat detail retained `/move/exercises?q=squat&type=strength` for Back and for its Goblet Box Squat link. Direct links retain the documented full-library fallback. |
| **B03, restored Workout asks the live question** | **FIXED** | [useWorkout.initial](../../src/screens/workout/useWorkout.ts#L45) restores begun work with `live: false`, including the memory route through [resumed](../../src/screens/workout/model.ts#L330). [stageOf / logGate](../../src/screens/workout/gate.ts#L51) route restart through `arrivalGate`. [gate.test.ts:70](../../src/screens/workout/gate.test.ts#L70) and line 79 pass. The actual hook restored `begun: true, live: false`; stale or missing required data returned `checkIn`, while truly live movement returned `log`. **R04** concerns a different route back into movement. |
| **B04, Workout ignores an effective refused check-in** | **FIXED** | The latest [TodayWorkoutScreen](../../src/screens/workout/TodayWorkoutScreen.tsx#L49) passes the hook's effective `checkIns` to [gateInputFor](../../src/screens/workout/gate.ts#L76), which selects today's record and passes the effective list as `recent`. The sheet also receives those effective records at lines 78 to 79. [gate.test.ts:119](../../src/screens/workout/gate.test.ts#L119), line 129 and line 140 cover refused chest pain, midnight and a workout carried over. The actual screen received the refused chest answer instead of durable Normal; start, restart and live all stopped. |

## Remaining original findings

**F01, safety presentation still depends on persistence. Severity: wrong advice.**

There are two reproducible failures:

1. Enter a valid current `600 mg/dL` glucose, tap Save, and hold the `addObservation` promise pending. `GlucoseForm` has computed `E-EXTREME-GLUCOSE`, but [QuickLog.tsx:282](../../src/screens/track/QuickLog.tsx#L282) awaits the result before any `onGuidance` or `onSaved` call. The actual probe recorded one write, busy true and **zero guidance calls**. Resolving the write as refused finally produced the emergency instructions and “Not saved: Storage is full”. The same pending condition occurs for first BP `130/80`, second `180/80`, through [line 463](../../src/screens/track/QuickLog.tsx#L463). Its eventual refusal correctly describes the severe second reading and says neither reading was saved.
2. Open a current glucose record at `120`, correct its value to `600`, and refuse `editObservation`. [EditSheets.tsx:134](../../src/screens/track/EditSheets.tsx#L134) returns with the storage error before evaluating/presenting the corrected value's clinical guidance. The actual form rendered “Storage is full” and emitted zero completion/guidance callbacks.

Expected: show the clinical instructions from valid entered values immediately, independently of a pending or refused write, alongside accurate saving/saved/unsaved status. Retain the input and retry. A store failure must not prevent emergency help instructions, including when correcting a current reading.

Suggested fix: publish the clinical result before awaiting persistence, then update only its persistence status when the write settles. Give correction forms the same independent guidance path. Do not use a “Saved” or “Corrected” confirmation for a refused mutation. Add component tests for a deliberately unresolved write and for a refused dangerous correction; pure escalation tests cannot catch these paths.

**F23, BP cadence counts acquisitions without the protocol interval. Severity: wrong advice.**

Seed an untreated hypertension profile with a home cuff. For each of 1, 2, 3 and 4 October, enter complete `132/84` acquisitions at `07:30:00` and `07:30:30`, tagged morning, and at `20:00:00` and `20:00:30`, tagged evening. All are distinct BP contexts with both halves, `pointInTime`, manual source, mmHg, and `+05:30` acquisition times. Ask cadence on 8 October.

Observed: `dueItems` returns no BP item. [cadence.ts:149](../../src/health/cadence.ts#L149) counts IDs; [line 155](../../src/health/cadence.ts#L155) calls the day full; [line 217](../../src/health/cadence.ts#L217) ends the diagnostic block. Valid 60-second repeats give the same result. Stable treated monitoring uses the same definition of a complete check day.

This has a normal UI route: [PressureForm](../../src/screens/track/QuickLog.tsx#L500) explicitly says both untouched Now fields use the Save moment. The actual two-reading probe gave all four halves the same acquisition instant. Repeating morning/evening entry across four consecutive days therefore satisfies the current counting rule without establishing the requested measurement interval.

Expected: completing the cited NICE NG136 1.2.7 protocol requires consecutive acquisitions at least one minute apart. The original single-reading and nonconsecutive-day omissions are fixed; interval validation is still missing.

Suggested fix: establish measurement-session completion from real acquisition times, or capture an explicit protocol confirmation when those times are unknown. Keep the observations without inventing a timestamp gap. Do not call an unverified session complete. **This is a cadence-completeness check, not a reason to delay clinical escalation for closely repeated severe BP readings.**

**F24, Track's interpretation panel still uses the wrong tied result. Severity: wrong advice.**

Seed, in that order, two HbA1c observations for `2026-06-08T12:00:00+05:30`: `6.5%`, sequence 3, and `9%`, sequence 4. Set the clinician goal to `8%`. Open the metric on 8 October.

Observed: [MetricDetail.tsx:365](../../src/screens/track/MetricDetail.tsx#L365) uses strict `Date.parse(o.at) > Date.parse(a.at)` and retains the first result. Its actual interpretation says **“Under 8%, your clinician’s goal.”** Cadence correctly uses 9 and says the test is due after the three-month interval. The component's `own` array is the store array filtered at [line 116](../../src/screens/track/MetricDetail.tsx#L116), so it does not repair the tie before this reduction. The same reduction serves B12, vitamin D and the latest-weight BMI note.

Expected: all latest-result consumers use the shared parsed-instant, sequence and correction ordering. The interpretation must describe 9%, whatever the input order.

Suggested fix: replace this remaining local reduction with `compareObservations` or a shared latest-observation helper. Keep the new clinician override. Add a component test asserting the actual interpretation text in both input orders; the passing cadence and lab-unit tests do not exercise this panel.

## Additional problems

**R01, entered active minutes manufacture an overlapping interval. NEW PROBLEM. Severity: wrong data.**

Code: [sessionInterval, movement.ts:83](../../src/screens/track/movement.ts#L83), specifically `at` at line 95 and `coverageMs` at line 97; [recordedMovement](../../src/screens/track/movement.ts#L182) then applies the overlap rules. This is the shared consumer used by Track and Today's movement total, with data produced by Workout.

Trigger:

1. Log a workout's first set at 09:00 on 8 October.
2. Exercise for one minute, then take a separate recorded three-minute walk from 09:01 to 09:04.
3. Return to the workout later, do four further active minutes around 12:50, and finish at 13:00.
4. Truthfully enter **five active workout minutes**. The workout stores start `03:30Z`, finish `07:30Z`, recorded date 8 October, and `durationSeconds: 300`. The walk has a measured, session-observed three-minute interval at `09:01+05:30`.

Observed: the helper turns the five-minute workout total into a continuous interval **09:00 to 09:05**. The actual aggregation returned **five minutes, all entered**, excluded the measured walk, and emitted “Two recorded sessions overlap, so only the first is counted.” The user performed eight nonoverlapping minutes; the inferred interval is false. The underlying walk record remains stored, but its measured contribution disappears from the total.

Expected: removing the idle four-hour credit must not create acquisition timing that was never measured or supplied. An active-minute total does not establish which minutes were active.

Suggested fix: keep an unplaced manual workout total as entered time associated with its recorded day, or capture its actual activity intervals. Reconcile possible duplication explicitly before combining it with measured intervals. Do not manufacture continuous coverage from first-set time, and do not loosen D10's overlap check to hide the representation error. If placement cannot be established, display the entered amount separately with that limitation rather than discarding measured walk time.

The current [F20 test](../../src/screens/track/movement.test.ts#L25) proves that idle clock time is no longer counted; it also accepts placing an entered total as an interval. It does not test this separated-activity case.

**R02, a failed programme Join discards the submitted answers. NEW PROBLEM. Severity: data loss of the configuration draft.**

Code: [JoinPlan.join, PlanScreen.tsx:221](../../src/screens/move/PlanScreen.tsx#L221), closing at line 222 before the awaited write at line 224; the wizard's reopening seed is the old stored profile at line 270.

Trigger: begin outside the programme with Monday as the old training day. Tap Join, change the wizard to Tuesday and Thursday, complete it, and make `update` refuse with “Storage is full”. Open Join again.

Observed in the actual callback probe: while the write was still pending, `WizardCover.open` had already become false. The updater received Tuesday and Thursday, but reopening the wizard seeded **Monday**, losing the submitted configuration. The original stored profile is intact; the loss is the user's unsaved work. An isolated mounted Join form showed the failure message.

Expected: a refusal keeps the submitted answers available, clearly unsaved, with a retry that does not require filling the wizard again.

Suggested fix: retain the draft and pending transaction until acknowledgement, keep the form available after refusal, and disable repeat submission while saving. Put the draft/result owner outside the membership-dependent branch if necessary: [PlanScreen.tsx:86](../../src/screens/move/PlanScreen.tsx#L86) switches between Join and Member from store enrolment, so an optimistic start-date publish must not dispose of that owner before commit or rollback.

The passing [join/leave tests](../../src/screens/move/plan.test.ts#L273) verify pure data transformations and preservation of history. They do not exercise the form's save lifecycle.

**R03, “earlier” is treated as “clinically settled”. NEW PROBLEM. Severity: wrong advice.**

Code: [Guidance, QuickLog.tsx:875](../../src/screens/track/QuickLog.tsx#L875), the question and choices at lines 899 to 904; [pastEscalation, escalation.ts:191](../../src/screens/track/escalation.ts#L191).

Trigger: at 09:10, enter a reliable `600 mg/dL` reading taken at 09:00. The person has had no normal recheck or clinical assessment, remains well enough to answer, and correctly chooses “No, it was earlier”.

Observed: the actual component replaces unconditional “Get emergency medical help now” with conditional help only if the person feels unwell now, followed by **“Tell your care team about this reading.”** The form never asked whether the extreme episode was resolved. Its introductory question already uses the conditional version before the user answers.

Expected: the [E-EXTREME-GLUCOSE contract](../research/clinical-tracking-protocols.md#safety-contract) requires emergency assessment for a reliable extreme reading. A clock time earlier than this instant does not establish recovery, a corrected mistake or clinical assessment. A recent unresolved episode must retain the required help action. Conversely, a genuinely managed historical episode should use the historical review path, as F03 now correctly does for the resolved low.

Suggested fix: distinguish when the reading was taken from whether the episode has been settled, and keep current symptom escalation first. Use explicit recovery/assessment context appropriate to the condition before downgrading an unsettled episode. Do not invent an expiry interval. The same two-choice mechanism serves severe BP, so cover a recent persistent severe BP episode as well.

The passing [past-episode test](../../src/screens/track/escalation.test.ts#L170) checks that the word “emergency” appears for an old extreme value. A conditional emergency sentence satisfies that assertion without preserving the unconditional action required by this trigger.

**R04, failed Finish leaves a stopped workout under the live gate. NEW PROBLEM. Severity: wrong advice.**

Code: [finalise.ts:41](../../src/screens/workout/finalise.ts#L41) dispatches `reopen`; [workoutReducer, model.ts:500](../../src/screens/workout/model.ts#L500) restores only status and completion time. `live` remains true from the earlier set at line 525. [stageOf, gate.ts:54](../../src/screens/workout/gate.ts#L54) therefore selects live, and [Workout's physical log callback](../../src/screens/workout/TodayWorkoutScreen.tsx#L238) asks that question again at the tap.

Trigger:

1. An insulin user has glucose `140 mg/dL`, measured at 09:00, and logs a first set.
2. At 09:01, the person ends movement and taps Finish. The save fails.
3. The person remains stopped until 09:31, keeps the screen mounted, dismisses the failure sheet with Keep going and tries another set.

Observed in the refreshed actual screen callback probe: reopened state had `status: 'in_progress'` and **`live: true`**; `stageOf` returned live; the screen gate returned log; the callback dispatched a new `log` action. The same profile, check-in and 09:31 clock passed to the existing **restart** question returned **checkIn**.

Expected: this is a new physical attempt after Finish, not continuously moving exercise. D29(6) and the B03 reconciliation require the insulin user's starting reading to be within 30 minutes. The fix must preserve logged sets and notes while asking restart readiness before another physical set. Truly uninterrupted movement should retain its existing live semantics.

Suggested fix: end live status when finishing, or set `live: false` on the failed-finish reopen, and route subsequent movement through restart. Keep failure recovery and acknowledgement independent of physical clearance. Add this to [finalise.test.ts:66](../../src/screens/workout/finalise.test.ts#L66): it currently checks restored status, notes and direct reducer logging, which bypasses the screen's permission question.

## Atomic calls and checks that are correct

Track now uses the requested atomic APIs in both locations:

| Path | Verification |
| --- | --- |
| Two-reading BP save | [PressureForm](../../src/screens/track/QuickLog.tsx#L448) constructs both contexts and all four halves, then calls `addObservations` once at line 456. With quota allowing only two observation rows, the real store probe refused the batch and reload contained **zero** BP halves. A successful form probe returned all four halves with their separate acquisition days. |
| Walk deletion | [WalkDetail](../../src/screens/track/RecordDetails.tsx#L333) selects every session-observed segment and passes all IDs to `removeObservations`. The actual failed-delete probe retained the whole activity on reload, retained its point-in-time pain rating, kept the confirmation open, exposed the failure and did not navigate away. |
| Batch validation and identity | The eight executed [coordinator cases](../../src/store/review.test.ts#L1269) cover ordered successful insertion, partial-quota rollback, invalid input refusal, existing/repeated ID refusal, empty batches, successful removal, partial-delete rollback and IDs already removed. The entire data layer was not re-audited. |

The original workout finish race is fixed independently of R04: no late set overwrote completion, finish waited behind autosave, and refusal retained sets and notes. Timed loads were excluded by both the explicit seconds marker and the planner's legacy identification; ordinary loaded repetition sets still contributed volume and records. Track reused the correct hold and weight formatter.

Personal HbA1c targets agree across chart, record and cadence. Restricted or uncertain-fluid Water advice suppresses the generic amount and goal. Back to Normal closes all covering Status periods while preserving history. Programme membership no longer follows focus; pure Join/Leave transformations preserve sessions, check-ins and overrides. Exercise detail and related links preserve the filtered library origin.

Movement fallback counts all distinct walk segments, and clipping passes the specified midnight and week-boundary cases. The legacy session test preserves its recorded day after travel. These passes do not establish missing historical timezone metadata or the actual timing of a manual active-minute total.

## Required follow-up tests

These should run through the affected component callback or caller, as well as any helper:

| Input or sequence | Required assertion |
| --- | --- |
| Current `600 mg/dL`, write held pending | Emergency instructions appear before the promise settles; saving state does not claim persistence. |
| BP first `130/80`, second `180/80`, atomic write pending then refused | Severe second-reading guidance appears immediately; neither reading is described as saved. |
| Current glucose correction `120` to `600`, edit refused | Clinical guidance remains available together with refusal and the editable draft. |
| Four consecutive BP days with 30-second morning/evening repeats | The cited diagnostic protocol is not marked complete; valid one-minute repeats can complete it. |
| Tied HbA1c `6.5%` seq 3 and `9%` seq 4, goal `8%`, both array orders | Cadence and the actual interpretation panel both select 9%. |
| Five entered workout minutes spread across a four-hour span plus the separate measured walk | No invented interval suppresses measured walk time or falsely declares overlap. |
| Join with changed training days, save pending then refused | The submitted answers and failure remain available for retry despite optimistic membership changes. |
| Recent unassessed `600`, answer Earlier | Earlier time alone does not downgrade required emergency help. Managed historical context has its separate review path. |
| Insulin user, Finish fails, movement restarts at glucose age 31 minutes | Preserve work but refuse another physical set until restart readiness is satisfied. |
| Effective refused chest answer at 23:59, logging at 00:01 | Continue to pass the effective historical obligation to the shared gate, as the newer B04 test already verifies. |

## Skipped and device-dependent verification

A fresh shell process could not initialise its sandbox, reporting `sandbox-exec: sandbox_apply: Operation not permitted`. I did not escalate or request approval. Read-only inspection and the in-memory runs used the available existing Node process. Normal Vitest CLI, build and browser launches were skipped; none was needed to write this report.

Chromium journeys at both requested sizes/themes, DOM focus and accessibility, actual route-stack behaviour, PWA restoration, iOS keyboard geometry, and real Safari IndexedDB interruption/eviction were not verified here. They remain part of the D34 acceptance and device pass. The callback probes are not screenshots or a substitute for that pass.

## Verdict per area

| Area | Verdict | Required before release |
| --- | --- | --- |
| **Today and health cadence/recommendation/Status** | **Ship after listed fixes** | F23 must stop claiming a complete BP protocol without its required interval. R01 must stop suppressing measured movement in the shared total. The requested recommendation, query, enrolment and Status fixes pass. |
| **Track** | **Ship after listed fixes** | F01, F24, R01 and R03. Atomic BP persistence, atomic walk deletion, time edits, midnight splitting, segment fallback, fluid restrictions and hold formatting pass. |
| **Workout** | **Ship after listed fixes** | R04 must ask restart after a stopped, failed Finish. R01 must represent entered active time honestly. The finish-write race, restored-workout B03 and effective-check-in B04 fixes pass. |
| **Move** | **Ship after listed fixes** | R02 must preserve the Join draft through refusal and optimistic enrolment. Canonical membership, successful Join/Leave transformations and library return paths pass. |
| **Shared timed-set volume and personal-record paths** | **Ship** | The requested `isLoadedRepSet`, new seconds markers, legacy timed-ID handling, volume, current display and record generation paths pass. This verdict is limited to those paths. |
