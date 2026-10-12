# Safety re-audit, round 3

Reviewed on 8 October 2026 against `codex-safety-reaudit.md` F01 through F15, its ten final retest cases, the clinical Safety contract, and BOARD D28, D29, D30 and D34.

**Release verdict: do not ship.** The numerical rules and several important integration fixes work. The complete movement gate still gives false clearance for a severe BP symptom report, applies an old episode resolution to a new incident, bypasses required checks on actual restarts, and permits safety dialogs to be dismissed without settling their reports. Passing the supplied tests does not establish these paths.

## Method and executed checks

I executed the current test bodies in memory using the installed TypeScript compiler, actual repository modules, real Chai assertions with the installed Vitest assertion extensions, and the tests' lifecycle hooks. This was not a Vitest CLI invocation. Final result: **331 executed, 331 passed**.

| Test file | Cases passed |
|---|---:|
| `src/engine/reaudit.test.ts` | 19 |
| `src/engine/contract.test.ts` | 65 |
| `src/engine/permission.test.ts` | 21 |
| `src/engine/readiness.test.ts` | 86 |
| `src/engine/health.test.ts` | 21 |
| `src/components/checkin/form.test.ts` | 25 |
| `src/components/checkin/start.test.ts` | 5 |
| `src/walk/gate.test.ts` | 8 |
| `src/walk/live.test.ts` | 39 |
| `src/screens/workout/gate.test.ts` | 8 |
| `src/hooks/useGuided.test.ts` | 3 |
| `src/session/runner.test.ts` | 29 |
| `src/hooks/guidedSession.test.ts` | 2 |

Additional probes executed the actual compiled `CheckInBody`, `Player`, `ReadingDialog`, `SymptomsDialog`, `SessionPage`, `ProfileWizard`, `useGuided().saveCheckIn`, Walk controller, and runner logic. React hooks, time, persistence and write results were controlled in memory. JSX event handlers were exercised without mounting a browser DOM. The probes below identify the exact inputs and outcomes.

Other agents changed Walk, Workout, Today and ProfileWizard during the review. I refreshed those sources, reran the affected tests and Walk probes, and checked the cited safety paths again. An intermediate Walk failure read removed `gpsFixes` and `distanceM` segment fields; the agent updated that test during the review, and the final run passes. I found no remaining supplied-test failure.

The implementer's historical claim that 14 mutations were caught and ten journeys were driven in Chromium was not independently reproduced. The named retest tests frequently exercise helpers, not their actual component callers. For example, `reaudit.test.ts:54` implements its own `saveThrough`; case 7 fills the missing BP component before asserting emergency at `:212`.

All source references below are repository paths and line numbers from the refreshed working tree. Probe labels identify this audit's in-memory executions, not new test files.

## Reconciliation of the three gates

The definitions in `src/session/gate.ts` are correct:

* `arrivalGate`, line 31, calls full `permission` for both a fresh opening and restored progress.
* `startGate`, line 37, calls full `permission` at physical Start.
* `liveGate`, line 42, calls the permission for movement already under way and returns a refusal when a current clinical or profile condition requires one.

`permission.ts:258` requires the current check-in and applicable glucose freshness. `resumePermission`, `permission.ts:271`, deliberately omits those two starting requirements. Its comment at `:269` correctly says a restart must use `permission`.

That distinction must reach the callers. A continuously running session does not need to be interrupted solely because its starting glucose becomes 31 minutes old. A paused, restored or returning Walk that starts recording again is a restart. A saved workout's `begun` flag proves that something was logged previously, not that the owner is still exercising now.

## F01 through F15

| Finding | Result | Test and traced code path | Observed result and remaining issue |
|---|---|---|---|
| **F01, unchanged glucose retimed and correction creates a historical low** | **VERIFIED** | `reaudit.test.ts:64`, case 1. `sheetState.afterSave`, `src/components/checkin/sheetState.ts:77`, rebuilds with `formFromRecord`. `form.glucoseFromForm`, `form.ts:357`, preserves an unchanged reading; `:364` recognizes the same-measurement unit correction. `CheckInSheet.tsx:159` uses `afterSave`. | Actual sheet probes saved `140` at 09:00, changed answers and resubmitted at 09:31: both records retained 09:00, permission was hold and required a new check. An actual `5.5 mg/dL` save corrected within the same opening to mmol/L became reassurance with no earlier low. |
| **F02, resume bypasses required data or profile holds** | **STILL BROKEN** | `reaudit.test.ts:94` and `:301` verify the gate functions; `permission.decide`, `permission.ts:189`, now includes profile-only holds. Actual callers: `src/pages/SessionPage.tsx:356`, `:374`; `src/hooks/useGuidedSession.ts:254`, `:290`; `src/walk/gate.ts:23`; `src/screens/workout/gate.ts:38`. | The recent-eye-treatment omission is fixed. Full arrival and ready-screen Start are fixed. A paused insulin user's actual Resume tap with `140` measured 31 minutes earlier still dispatches resume and becomes running. Walk restoration/resume and restored Workout logging use the live permission and similarly allow stale or missing starting data. Details in B03. |
| **F03, player permission frozen at arrival** | **VERIFIED** | `reaudit.test.ts:94`, case 2. `SessionPage.tsx:104` rebuilds its input when profile/check-in changes; `:119` asks `liveGate`; `Player` at `:218` silences voice and pauses on a refusal; `:242` asks `startGate` with a fresh clock. | Actual ready-screen Start at 09:31 stayed ready and rendered `SessionGate`, hold, new reading required. A new chest flag delivered to the mounted Player rendered emergency `SessionGate`, called `stopVoice`, and paused the runner. Resume controls are the separate F02 failure. |
| **F04, sheet evaluates its own unmerged answer** | **STILL BROKEN** | `reaudit.test.ts:115`, case 3, verifies `afterSave` on a merged result. `useGuided.ts:115`, `:122` merge against saved readings. `CheckInBody`, `CheckInSheet.tsx:126`, initializes local record once; `:143` and `:211` decide from that local record. `:158` awaits a save and `:159` accepts every completion. | Post-save hydration of the merged record is fixed. Before a resubmit, changing the actual component's incoming `initial` from an old normal record to a new `50 mg/dL` record leaves its banner at adjust and still calls `onStart`. An older normal save can also complete after a chest answer and replace the form and banner with a normal result. B02. |
| **F05, failed safety write disappears** | **STILL BROKEN** | `reaudit.test.ts:115` and `:329` test `effectiveCheckIn` directly. `useGuided.ts:32`, `:88`, `:125` retain and expose a refused write. But `:122` recomputes against the store alone and `:125` replaces the pending record even on another failure. Walk uses `src/walk/gate.ts:39`; Workout uses `TodayWorkoutScreen.tsx:49`. | One refused stop survives through the hook, and its failed-save notice works. A second stale normal save that also fails replaces an unstored `50` with `110`, losing the low and changing today to reassurance. Walk and Workout do not consume the effective record, so a retained failed chest answer can coexist with their allowed results. B04. |
| **F06, saved Walk ignores emergency refusal** | **STILL BROKEN** | `reaudit.test.ts:139` tests four permission helpers. The W01 tests in `src/walk/live.test.ts:657`, `:675`, `:689` exercise restoration, Resume and return refusal. `src/walk/live.ts:423`, `:460`, `:510` now enforce `mayRun` on return, restoration and Resume. | A chest answer present in the store now prevents restoration, Resume and automatic return, with progress kept. A chest answer retained only after a failed write is invisible to the Walk gate. While already running, a newly available clinical stop is never asked about by `tick`, `live.ts:392`, or by a clinical-data effect in `LiveWalkScreen`. B03 and B04. |
| **F07, archived work violates current restrictions** | **STILL BROKEN** | `reaudit.test.ts:153` and `:314`. `blockedSteps`, `src/session/gate.ts:81`, asks `evaluateFlags` but uses only `.excluded` at `:90`. `Player`, `SessionPage.tsx:209`, skips the returned ids and `:203` names skipped work. | Foot-bearing and excluded eye movements are now filtered. Current caps, intensity limits and cool-down changes are not applied. A real archived Upper B interval plan keeps five fast segments under current `INT`, `LOAD`, `HEAD`, `capHeavy` and `COOL` restrictions. Its cardio step is not blocked. B05. |
| **F08, player low/checkpoint bypasses recovery** | **STILL BROKEN** | `reaudit.test.ts:178`, case 6, starts with a low already in the record. `readiness.ts:549` correctly refuses unknown low timing. Actual UI: `SessionPage.tsx:266`, `:335`, `:381`, `:389`; `ReadingDialog` at `:589`; runner `awaitsAnswer`, `src/session/runner.ts:107`. | Numerical recovery rules now work for a recorded low. The actual I feel low dialog can be closed and Resume pressed with no saved symptom or reading. Enter my glucose records `answer='measured'` before a reading exists; close the dialog, Resume and Next reach cardio with zero readings saved. A normal checkpoint also jumps directly to cool-down. B06. |
| **F09, severe BP history loses escalation and partial BP hides symptoms** | **STILL BROKEN** | `reaudit.test.ts:195` and `:341`. `bpRules`, `readiness.ts:817`, `:833`, `:843` combine retained/current severe readings. `form.anySevereComponent`, `form.ts:213`, exposes the question for a partial severe reading. Actual auto-save is `CheckInSheet.tsx:196`; `formReadings`, `form.ts:223`, drops an incomplete pair. | Cross-save complete severe readings now give today and a lower repeat does not erase that obligation. But `190 / blank` plus the high-BP symptom toggle produces a record with no BP and gives reassurance and Start. Old BP resolution also suppresses a new severe incident. B01 and B07. |
| **F10, genuine extreme glucose or high mmol/L cannot be acted on** | **NEW PROBLEM** | `reaudit.test.ts:216` and `:351`. `glucoseSanity`, `readiness.ts:54`, honors confirmed units. `glucoseRules`, `:479`, preserves an unresolved earlier extreme; `:527` handles a current extreme. Resolution lookup is `episode`, `:97`. | The original unresolved `600` replaced by normal now remains emergency; confirmed `650/18 mmol/L` reaches the same extreme rule as `650 mg/dL`. New failure: resolving an earlier typo as mistake also resolves a later genuine `650` when it enters history. A date change also clears an unresolved real extreme. B01. |
| **F11, urgent/positive earlier ketones are softened** | **NEW PROBLEM** | `reaudit.test.ts:216`, case 8. `ketoneRules`, `readiness.ts:730`, `:740`, `:746`, `:757`, preserve emergency and escalate earlier positive ketones with illness. | A fresh unresolved earlier `3.0` remains emergency; earlier `0.8` plus unwell gives today. New failure: the resolution of an old ketone typo applies to a subsequent genuine `3.1` episode, which becomes reassurance after a normal result. B01. |
| **F12, SGLT2 risk cannot be captured without diabetes** | **STILL BROKEN** | `reaudit.test.ts:237`, case 9. `visibleQuestions`, `form.ts:258`, permits ketone entry for a known risk profile; `CheckInSheet.tsx:351` renders it outside glucose. Profile question: `ProfileWizard.tsx:469`. Required-answer logic: `:107`, `:108`; `wizardSteps.finalProfile`, `wizardSteps.ts:146`; `health.profileGaps`, `health.ts:46`. | Known SGLT2 use without diabetes is fixed: the actual sheet saved blood ketones `3.0`, showed emergency and offered no Start. However, an unanswered non-diabetic SGLT2 question still saves the default `false`, clears health review, yields no medicine gap, and hides ketone/DKA questions. B08. |
| **F13, nonrenal fluid restriction ignored** | **VERIFIED** | `reaudit.test.ts:237`, case 9. `fluidLimit`, `readiness.ts:789`, recognizes true/unsure independently of kidney disease; `fluidLine`, `:798`, applies that result. `ProfileWizard.tsx:481` asks and stores the restriction. | The nonrenal prescribed-limit fixture gives no extra-fluid advice for dizziness/low BP and refers to the fluid plan. Unknown restrictions remain conditional. This verifies the safety guidance; it does not validate every Guide card or reminder. |
| **F14, worse-back checkpoint does not stop provoking work or capture red flags** | **STILL BROKEN** | `reaudit.test.ts:257`, case 10. `afterSymptomReport`, `src/session/gate.ts:59`, gives a halt or skip. `SessionPage.tsx:340`, `:399`, `:409`, `:415` collect and use answers. `SymptomsDialog`, `:645`, has only three questions. | Submitted spread, weakness and saddle answers reach the engine. Dismissing the dialog leaves no report or skip; Previous then Resume replays the provoking set. Rapidly worsening or bilateral weakness cannot be expressed in this dialog and is saved as ordinary new weakness, today, instead of emergency. B09. |
| **F15, saved Stretch evaluated as Guided** | **VERIFIED** | `reaudit.test.ts:153`, case 5. `SessionPage.tsx:62`, `:63`, `:64`, `:75`, `:112` preserve the URL's stretch mode and use the stretch slot. `stretch.parseStretchSpec`, `src/engine/stretch.ts:314`. | An actual saved Stretch route with a sensory-only sciatica report loaded the stretch slot and rendered Player with `mode='stretch'`, `plan.kind='stretch'`, and no guided refusal. A direct guided request with the same report still refuses. Remaining step caps and symptom-dialog failures are F07/F14. |

## Concrete remaining failures and fixes

### B01. Episode resolution is by kind, not by incident

**Severity: critical. A new event can lose its clinical action.**

`DailyCheckIn.resolved`, `src/types/checkin.ts:217`, is a map from kind to mistake/assessed. It contains no reading identity, episode identity or assessment time. `episode`, `readiness.ts:97`, applies that one value to the entire kind. `buildCheckIn`, `form.ts:473`, always merges previous resolutions into new answers.

| Probe | Concrete sequence | Observed | Expected |
|---|---|---|---|
| P01 | Save a mistaken `190/80`, replace it with `120/80`, mark severeBp as mistake. Later enter a genuine `192/82` at a new time. | Full permission is allowed, reassure. `bpRules`, `readiness.ts:851`, returns before handling even the new current severe reading. | The new reading is an unresolved severe incident, at least hold and proper repeat, followed by today if confirmed. |
| P02 | Settle an old `600` typo. Later save genuine `650`, then `110`, without settling the new incident. | Current `650` initially gives emergency. After `110`, the retained `650` is suppressed by the old mistake resolution; reassurance. | Emergency assessment remains required for the new unresolved extreme. |
| P03 | Settle an old `3.0` ketone typo. Later record genuine `3.1`, then `0.1`, without another resolution. | Emergency at `3.1`, reassurance after `0.1`. | The new unresolved episode remains emergency. |
| P04 | Build a new form with an old resolved extreme and remove its resolution, the representation used for Not settled yet. | `form.ts:473` reinstates the previous mistake value. | An explicit return to unresolved must be representable and honored. |
| P28 | Record genuine `600` at 23:59 on 9 October. At 00:01 on 10 October, save `110`; pass the prior record in `recent`, with no correction or assessment. | Permission is allowed, reassure, two minutes after the unresolved extreme. | Crossing midnight and obtaining a lower number do not establish clinical resolution. |

The midnight failure is at `permission.decide`, `permission.ts:184`, which takes only today's check-in as current; `glucoseRules`, `readiness.ts:398`, reads earlier glucose only from that current record. `carryForward`, `form.ts:506`, intentionally stops at a date change. None of these paths transfers an unresolved emergency to the new day's decision.

**Fix:** Bind each resolution to the specific incident/readings it resolves and record when it was given. A later incident must be unresolved by default. Let the user reverse an incorrect resolution. Preserve unresolved clinical obligations across a date change. Distinguish that obligation from D29's attempt/day exercise restrictions after an assessed event; this is not a proposal to keep every historical severe reading as a permanent emergency.

### B02. Sheet permission is stale while incoming data or writes change

**Severity: critical. A stop can be replaced on screen by Start.**

`CheckInBody` initializes `sheet.record` from `initial` once, `CheckInSheet.tsx:126`. Both the banner and Start use this local record at `:143` and `:211`. An updated incoming record is not incorporated while the sheet remains open.

**P32:** Open the actual component on insulin glucose `110`. Deliver a new `initial` containing `50`. The incoming record says today, but the displayed permission remains adjust, Start is shown, and clicking it calls `onStart`. The receiving player can still catch a refusal at arrival; that does not make the sheet's reassurance or permission correct.

The new awaited-write path introduces another race:

1. From a normal record, tap Change answers and See today's plan. Keep that normal save pending.
2. Open the emergency list and select chest pain. Keep its save pending too.
3. Before either finishes, the actual sheet passes its old reassuring permission to the emergency banner, `CheckInSheet.tsx:243`.
4. Complete the older normal save first.
5. `:159` applies `afterSave` without a generation check. The chest answer is cleared, the view becomes a normal outcome, Start appears and its handler calls `onStart`.

P21/P22 reproduced all five steps with the actual component callbacks. Completing the emergency save afterward restores emergency, and a failed completion shows the unsaved notice, P23. That later correction does not make the interval safe.

**Fix:** Display and gate the most restrictive current clinical record, including incoming and pending answers, immediately. Retain active form edits without ignoring incoming stops. Sequence save completions so an older normal reply cannot replace a newer clinical report. An urgent answer must not wait for persistence before its urgent text and local stop take effect.

### B03. Restart callers still ask the live question

**Severity: high. Required pre-session data checks are bypassed.**

**P13, Player:** Use a paused insulin session with `140` at `N-31 minutes`. Full `startGate` says hold. The actual Resume handler, `SessionPage.tsx:356`, calls `act.resume` directly and the actual runner becomes running. Keep going at `:374` has the same omission. Earphone Play calls the same ungated method, `useGuidedSession.ts:290`.

**P09/P10, Walk:** Start with a fresh insulin reading, pause, move the clock forward 31 minutes, resume. The current controller becomes running, `blocked=false`. Detach, remove today's check-in, reattach stored progress: it again becomes running. `walkPermission`, `src/walk/gate.ts:23`, maps every resume intent to `resumePermission`. Restoration at `live.ts:460`, Resume at `:510`, and automatic return at `:423` therefore all ask the wrong question for a new recording segment.

**P08, Workout:** `logGate` with `begun=true` and a 31-minute-old insulin reading returns log/reassure; it also returns log/reassure with no current check-in. Restoring an in-progress workout retains `begun`, `useWorkout.ts:41`. It does not prove uninterrupted exercise.

**P11, live Walk:** Start a permitted walk, replace its clinical input with a chest emergency, then execute its next tick. It remains running, `blocked=false`, and records another second. The gate was asked only at start. `live.ts:392` updates the clock and persistence without a clinical check; `LiveWalkScreen.tsx:116` has an attachment effect, but no effect stops movement on clinical/profile changes.

**Fix:** Route Player Resume, Keep going and media Play through full restart permission at action time. Use full permission for every Walk transition into recording, including restoration and automatic return. Track Workout lifecycle separately from the durable `begun` flag so restoring a live workout asks the full question. While truly running, reevaluate the live gate on current clinical/profile changes without enforcing the starting-reading age. Keep progress viewable and savable during a refusal.

### B04. The refused safety record is neither lossless nor shared by all callers

**Severity: critical. A reported emergency can be absent from a movement gate.**

The single-failure improvement works: an actual `saveCheckIn` returning `{stored:false}` for glucose `50` leaves `useGuided().checkIn` at today, P05. The pure `effectiveCheckIn` protection of a stored stop also works.

Two remaining paths fail:

* **P06b:** Capture two normal `saveCheckIn` callbacks from the same loaded hook module before either save. Refuse the first write of `50`; the hook reports today. Refuse the second stale callback's write of `110`. In the update callback, `useGuided.ts:122` rebuilds against the rolled-back store, not the pending `50`. Line `:125` replaces `unstored` with the second failed normal record. The effective record becomes reassure, with no retained low.
* **P07:** Refuse a chest emergency save while the durable record remains normal. `useGuided().checkIn` gives emergency. `permissionInput`, `src/walk/gate.ts:39`, reads only `state.checkIns`; Walk allows start. `TodayWorkoutScreen.tsx:49` derives `todayCheckIn` from raw `data.checkIns`, not the hook's effective record; `logGate` returns log/reassure. `LiveWalkScreen.tsx:101` calls `useGuided` but takes only `profile`, so subscribing to that hook does not repair its gate input.

**Fix:** Keep pending safety records in a shared source that every gate can read, including the non-React Walk controller. Merge retained readings against both pending and durable records at the point of every save, not only before calling the adapter. A subsequent failed or stale save must not delete an unresolved failed low. Clear pending state only when its relevant clinical history is acknowledged durably or explicitly resolved.

The notice that memory-only answers can be lost when the app closes is honest. The confirmed defect is loss and bypass within the same running app, not a demand that a refused IndexedDB write become magically durable.

### B05. Archived restrictions filter exclusions but leave forbidden doses and intervals

**Severity: high. The movement performed contradicts the permission granted.**

`blockedSteps`, `src/session/gate.ts:90`, discards the rest of `evaluateFlags`' result. That result includes caps and neural-gate requirements, `src/engine/safety.ts:89`, `:190`. There is no adaptation of the archived cardio format or cool-down.

**P38:** Build the actual Upper B plan for a reviewed insulin user with fresh glucose `140`, no BP restriction and vigorous clearance. Save it. Change the profile to treated hypertension with a clinician exercise ceiling `170/105`, and enter BP `165/95`. Current permission allows only an adjusted session with `HEAD`, `INT`, `LOAD`, `capHeavy` and `COOL`, including the literal restriction **No intervals**.

The archived `ccardio` still contains five 30-second fast parts and is not in `blockedSteps`. A newly built plan for the same current input contains no fast parts. `Player`, `SessionPage.tsx:320`, displays intensity directly from the unchanged archived segment. `cardio.intervalsAllowed`, `src/engine/cardio.ts:68`, refuses intervals under `INT` only when building a plan.

**P16:** The same restriction change retains an archived working set of 9 reps where the current matrix requires at least 10, and a 60-second cool-down where the current builder produces 300 seconds. `cardioBlock`, `cardio.ts:93`, implements the longer cool-down for a fresh plan; the archived plan never reaches that builder.

Those figures describe the app's actual plans and caps, not new clinical thresholds proposed by this audit.

**Fix:** Reconcile all remaining work with the current restrictions, including cardio intensity, load/hold caps, cue requirements, neural gates and cool-down. Preserve already completed work and stable logs. Adapt a remaining step safely or refuse/skip it explicitly when adaptation cannot be established. Checking only exclusion flags cannot enforce an allowed mode's restrictions.

### B06. Low and glucose-checkpoint dialogs can be abandoned, and a normal check skips cardio

**Severity: critical for bypass; usability defect for unnecessary cool-down.**

**P15:** In the actual Player, tap I feel low, close the dialog, then Resume. No symptom or glucose reading is saved. The runner becomes running. `SessionPage.tsx:266` only pauses and opens the dialog; `:382` lets closing it clear local state. The shared live gate cannot act on a symptom it never received.

**P14b:** At `c-glucose`, click the actual Enter my glucose button. `SessionPage.tsx:335` logs the checkpoint completed with `answer='measured'` before collection. Close the dialog, Resume, then Next. The actual runner reaches `ccardio`, running, with no saved glucose readings. `runner.ts:107` holds only until any answer string exists; `:165` correctly prevents skipping a genuinely unanswered checkpoint, but the premature measured answer defeats that protection.

**P26, capture limitation:** I feel low presents treatment instructions and collects only Glucose now afterward. A reader who saw `50` at symptom onset but follows the dialog and enters the recovered `95` is never asked for the initial measurement or level 3 assistance. In the probe, only `95`, the old pre-session `140`, and `lowRecovered=true` reached the engine. It resumed into cool-down, with no low episode to evaluate.

This is not a claim that a normal meter reading always requires a 15-minute wait. If a suspected low is checked promptly, glucose is normal and symptoms have resolved, the contract does not invent a biochemical low. The bug is that dismissal requires no check at all, and the UI cannot reliably represent the treated episode whose recovery it claims to validate.

**P27:** At a routine checkpoint, save a normal meter reading `140`. The engine says reassure. `SessionPage.tsx:394` nevertheless seeks the cool-down segment and sets `coolDownFrom`, bypassing the permitted steady cardio. The routine dialog says the session carries on from the reading, but the handler always follows the low-recovery route.

**Fix:** Save the suspected-low stop when reported and keep it active until a usable check and symptom resolution settle it. Capture an initial low and its time where a treated episode is reported, including the level 2/3 facts the engine needs. Do not complete a glucose checkpoint until its actual reading is accepted. Closing or cancelling should leave the required check pending or end the session. Distinguish a normal routine checkpoint from recovery after a low; use the low cool-down route only for the latter.

### B07. Partial severe BP plus acute symptoms becomes reassurance

**Severity: critical. This is an actual emergency-to-Start path.**

**P18/P20:** In the actual sheet for a profile with home BP monitoring:

1. Answer None of these in the general emergency list.
2. Enter `190` in Reading 1, top number, and leave the bottom number blank.
3. Report a new vision change by enabling Symptoms with the high reading.
4. Let the automatic save complete.

The partial severe number correctly exposes the question, `form.ts:218`, `:274`. But `setBpSymptoms`, `CheckInSheet.tsx:200`, saves without the complete-pair validator. `formReadings`, `form.ts:223`, emits no reading. The saved record has `bpSymptoms:true` and no BP. `bpRules`, `readiness.ts:823`, enters its emergency branch only when a complete severe reading exists.

Observed: green/reassure, Start session visible. Expected: emergency help now, without waiting for the other number or a repeat. The Safety contract's E-BP condition is SBP at least 180 **or** DBP at least 120 with the relevant acute symptoms. It does not require the other component.

`reaudit.test.ts:211` checks question visibility with the blank bottom number, but `:212` changes it to `110` before testing emergency. That misses the failing auto-save path.

**Fix:** Preserve and evaluate the known severe component and symptom report immediately. Represent the incomplete measurement honestly, keep normal save validation where appropriate, and never fabricate the other BP component as zero. An incomplete form must not prevent the independently established emergency action.

### B08. The new non-diabetic SGLT2 question remains optional and defaults to No

**Severity: high. Medicine risk can be silently misclassified.**

**P33:** Open the actual health-only ProfileWizard in edit mode for a non-diabetic heart patient whose SGLT2 question has never been answered. The question is displayed with `answered=false`, `value=false`. Leave it unanswered and click the enabled Save button.

Observed:

* `health.sglt2i=false` is saved from the untouched default.
* `needsHealthReview=false`.
* `profileGaps` reports neither unreviewed health nor unknown medicines.
* `deriveHealth().ketoneRisk=false`.
* Check-in shows neither ketones nor the DKA emergency item.
* A completed ordinary check-in permits movement.

The cause is `ProfileWizard.tsx:107`: required medicine answers are checked only when `diabetic` is true. The non-diabetic question at `:470` is not part of that condition. `wizardSteps.ts:146` still completes health review; `health.profileGaps`, `health.ts:48`, checks medicine review only for diabetes.

**Fix:** Require an explicit SGLT2 Yes, No or Not sure in the relevant non-diabetic health flow, or preserve an unknown answer and apply its appropriate risk handling. Do not turn unanswered into No. This does not require insulin questions or routine glucose testing for every non-diabetic user.

### B09. Worse-symptoms reporting can be abandoned and misses the urgency qualifiers

**Severity: high; critical for the omitted emergency variants.**

**P17:** At the actual back checkpoint after Trap Bar Deadlift, answer Worse, close the symptoms dialog, tap Previous and Resume. No check-in is saved, no exercise skip is retained, and the actual runner replays `s9-trap-bar-deadlift-s3`. `SessionPage.tsx:400` only clears the dialog state; the skip is created only after save at `:417`.

**P37:** Report new weakness that is rapidly worsening or affects both legs. The actual dialog offers only spread, weakness and saddle/bladder/bowel questions, `SessionPage.tsx:645`. Selecting the matching weakness answer saves `newWeakness=true` but no `weaknessFast` or bilateral emergency flag, `:410`. The saved record gives today. Encoding the same clinical report with `weaknessFast=true` or `emergency=['bothLegs']` gives emergency through the correct engine paths, `readiness.ts:189` and the independent emergency rules.

**Fix:** Stop and retain the provoking-exercise restriction at the Worse answer, before persistence or dismissal. A closed dialog must not settle it. Ask the missing rapid-progression/bilateral qualifiers and route urgent flags through the shared check-in path. Preserve the restriction when progress is restored; a component-local skip alone is insufficient if the report did not alter the durable clinical inputs. No pain score should release these flags.

## The two policy calls

| Policy | Judgment | Evidence and reconciliation |
|---|---|---|
| Closely repeated severe BP escalates even when readings are less than one minute apart; actual times are retained | **SAFE to keep as conservative app policy** | P34 used `190/80` and `186/82` 15 seconds apart and obtained today. `bpRules`, `readiness.ts:833`, keeps/sorts times; `:843` requires two severe entries but does not enforce spacing. Asking for clinician contact after two severe readings is a safe conservative escalation. Do not label the home protocol verified, invent spacing, or claim this is the exact one-minute guideline rule. Correct the contradictory comment at `:828`, which still says at least a minute. B01 and B07 are separate failures, not reasons to weaken the spacing policy. |
| Unknown beta-blocker/diuretic answers tighten talk-test effort, cool-down and fluid advice rather than prohibit movement | **SAFE policy, incompletely applied** | P35, treated hypertension with absent `bpMedicinesReviewed`, produced `rpeOnly=true`, `COOL`, conditional fluids and allowed/adjust. `health.bpMedicinesUnknown`, `health.ts:60`; `profileRules`, `:123`; `fluidLimit`, `readiness.ts:793`. A blanket movement ban solely for missing BP-medicine detail has no demonstrated benefit here; unknown diabetes medicine class remains a separate hold. But the fallback is restricted to `hypertension !== 'none'`. P36, a heart patient with no hypertension diagnosis and unreviewed default beta-blocker/diuretic answers, produced `rpeOnly=false`, no `COOL`, fluidLimit free. The Wizard similarly requires/shows BP medicine questions only for the BP branch, `ProfileWizard.tsx:106`, `:108`. Extend capture/fallback to relevant non-hypertensive heart/kidney users. Archived cool-downs also remain the F07 enforcement failure. |

The permission and readiness precedence themselves remain correct for conditions that reach them. `DISPOSITION_ORDER` orders reassure, adjust, hold, today, emergency; `permission.decide`, `permission.ts:228`, sorts by that order and suppresses lower-priority reasons in an emergency at `:231`. The failures above remove or ignore the higher-priority condition before that merge, or display a superseded result afterward. Changing colour ordering would not fix them.

## Every movement entry

| Entry or transition | Actual gate/input | Assessment |
|---|---|---|
| Today recommendation, chooser and saved session action | `TodayScreen.tsx:180`, `:190`, `:250` call shared `start(mode, ...)`. `useStartMovement.tsx:35` asks full permission at the tap using `useGuided().checkIn`. | **Correct initial gate.** The shared sheet's B02/B07 defects still apply. |
| Move, Guided session | `src/screens/move/routes.tsx:42` uses shared `start('guided', ...)`. | **Correct initial gate.** |
| Stretch start | `StretchScreen.tsx:29` previews stretch permission and `:98` uses shared stretch start. | **Correct initial mode and gate.** |
| Walk setup, fresh Start | `WalkSetup.tsx:131` uses shared `start('walk', ...)`. | **Correct initial gate with the effective check-in.** |
| Fresh live Walk attachment | `LiveWalkScreen.tsx:112` asks start permission; controller `live.ts:448` asks its port again. `browser.ts:170` supplies `storeGate`. | **Correct question, wrong data source for failed saves.** B04. |
| Walk restoration, Resume, return from hidden | `live.ts:460`, `:510`, `:423`; `walk.gate.ts:23` maps these to the live permission. | **Wrong restart question.** Stored current clinical refusals are enforced, but freshness/missing-check-in and pending failed answers are bypassed. B03/B04. |
| Walk while recording | `live.ts:392` ticks; current store rendering alone does not invoke `mayRun` or pause. | **Missing reactive live gate.** B03. |
| Workout, first set | `TodayWorkoutScreen.tsx:54`, `:180` call `logGate`; `gate.ts:38` uses full permission while not begun. | **Correct question, wrong effective input.** The screen derives its current check-in from raw data at `:49`. B04. |
| Workout, uninterrupted subsequent set | `logGate(..., begun=true)` uses the live permission. | **Correct for genuinely ongoing exercise.** |
| Workout restored from in-progress record | `useWorkout.ts:41` restores a begun workout; the same live branch is used. | **Wrong restart question.** B03. |
| Recording an already completed past workout | `logGate(..., afterTheFact=true)`, `gate.ts:37`, permits record entry. | **Correct separation.** Recording completed activity does not authorize new movement. |
| Player arrival, including saved Guided/Stretch | `SessionPage.tsx:112` calls full `arrivalGate` with current mode and effective check-in. | **Verified.** Required starting data and profile holds apply. |
| Player physical ready-screen Start | `SessionPage.tsx:242` calls full `startGate` with the clock at tap. | **Verified.** P30. |
| Player Resume, Keep going, earphone Play | Direct `act.resume`, `SessionPage.tsx:356`, `:374`, `useGuidedSession.ts:290`. | **Missing restart gate.** B03. |
| Player current clinical/profile change | `SessionPage.tsx:119` supplies halt; Player `:218` pauses and silences voice. | **Verified for received input.** P31. |
| Player archived remaining work | `blockedSteps` and Player skip effect, `gate.ts:90`, `SessionPage.tsx:209`. | **Incomplete restrictions.** Exclusions enforced, caps/intervals/cool-down not reconciled. B05. |
| Player glucose checkpoint / I feel low | Reading saved through `onCheckIn`, then `liveGate`, `SessionPage.tsx:389`, `:390`. | **Correct submitted-record path, incomplete workflow.** Closing, premature measured log, missing episode capture and unconditional cool-down remain. B06. |
| Player worse-symptoms checkpoint | Saves through `onCheckIn`, then `afterSymptomReport`, `SessionPage.tsx:404`, `:415`. | **Correct submitted ordinary fields, incomplete workflow and red-flag capture.** B09. |

Opening setup, inspecting progress, finishing a held walk or writing down past activity need not constitute a movement start. Each actual transition into movement still needs the appropriate current question.

## The ten required retest cases

The references in the second column are the named cases in `src/engine/reaudit.test.ts`. Each passed. The classifications incorporate the actual caller probes rather than assuming the test title proves its full UI claim.

| Retest from round 2 | Test/code trace | Result and exact outcome |
|---|---|---|
| **1. Same glucose at 09:31; same-measurement unit correction** | Case 1, `:64`; `sheetState.afterSave:77`, `form.glucoseFromForm:357`; actual sheet P19/P24 | **VERIFIED.** `140` keeps 09:00, insulin permission holds at 09:31. Correcting the same `5.5` reading to mmol/L adds no severe-low history. |
| **2. Missing/stale required reading, eye hold, physical Start/restart and mounted emergency** | Case 2, `:94`; `arrivalGate:31`, `startGate:37`, `liveGate:42`; Player P13/P30/P31, Walk P09/P10, Workout P08 | **STILL BROKEN.** Arrival, ready Start, eye hold and received live emergency now work. Actual paused Resume with stale insulin glucose still becomes running; restored Walk/Workout likewise omit starting requirements. |
| **3. Retained 50 during an open sheet; refused emergency survives reopening** | Case 3, `:115`; `afterSave:77`, `useGuided.saveCheckIn:113`; actual P05/P06b/P07/P21/P22/P32 | **STILL BROKEN.** A merged completed save displays today correctly. An incoming `50` before resubmit leaves Start enabled; old asynchronous normal completion clears a chest answer; another failed stale save erases an unstored low; Walk/Workout do not read retained failed emergencies. |
| **4. Saved Walk with emergency; Resume and automatic return** | Case 4, `:139`; W01 in `src/walk/live.test.ts:657`, `:675`, `:689`; controller `live.ts:423`, `:460`, `:510`; actual P12/P39 | **VERIFIED for the original stored-emergency case.** Restored and automatically returning walks remain away/blocked, manual Resume remains refused, and progress is recoverable. The failed-write and newly reported live variants are B03/B04, so this pass is not approval of the whole Walk gate. |
| **5. Archived standing plan after foot/eye change; saved Stretch mode** | Case 5, `:153`, additional F07 test `:314`; `blockedSteps:81`, `SessionPage.tsx:63`; P16/P29/P38 | **STILL BROKEN.** Weight-bearing exclusions, recent-eye hold and saved Stretch mode work. Other current restrictions still leave archived fast intervals and old caps/cool-down executable. |
| **6. Player low, timed recovery, persistent/repeated low, level 2/3, unknown old time** | Case 6, `:178`; `readiness.glucoseRules:495`, `:549`; `newsRules:305`; actual Player P14b/P15/P26/P27 | **STILL BROKEN.** Given the complete episode, engine holds early/untimed recovery, ends persistent level 1 under D29(3), and directs contact today for level 2/3. Actual UI can abandon collection and resume, can bypass the checkpoint after a premature measured log, and does not reliably collect the initial treated episode. |
| **7. Cross-save severe BP, lower repeat, partial severe symptom capture** | Case 7, `:195`, partial-box test `:341`; `readiness.bpRules:833`, `form.anySevereComponent:213`; actual P18/P20/P01 | **STILL BROKEN.** Cross-save full severe readings and retained confirmed obligations work. `190 / blank` plus acute symptoms saves no BP and gives reassurance/Start. Old mistake resolution additionally clears a new severe BP. |
| **8. Unresolved 600/3.0 followed by normal; high mmol/L confirmation** | Case 8, `:216`; `readiness.ts:479`, `:527`, `:746`; P02/P03/P04/P28 | **NEW PROBLEM.** The clean single-episode fixtures and confirmed unit equivalents work. Existing resolution of a different incident clears a later genuine extreme/ketone episode; crossing midnight also clears a recent unresolved extreme. |
| **9. Non-diabetic SGLT2 with 3.0 ketones; nonrenal fluid limit** | Case 9, `:237`; `form.visibleQuestions:258`, `CheckInSheet.tsx:351`, `readiness.fluidLimit:789`; actual P25/P33 | **STILL BROKEN overall.** Explicit SGLT2 Yes enables ketones and `3.0` gives emergency; nonrenal fluid restriction is honored. The real Wizard still accepts the unanswered SGLT2 field as No and completes review. |
| **10. Distal spread / neurological red flag at player checkpoint** | Case 10, `:257`; `afterSymptomReport:59`, `SessionPage.tsx:404`, `:415`; actual P17/P37 | **STILL BROKEN.** Submitted ordinary spread/weakness/saddle inputs reach their correct rules. Closing leaves provoking work available, and the dialog cannot capture rapid or bilateral weakness for emergency escalation. |

The persistent level 1 fixture correctly uses D29(3)'s hold/end-attempt policy. It should not be relabeled as a level 2 episode or require an invented universal emergency action. Similarly, factor 18.0 is the board's canonical conversion; `600/18` is the exact extreme boundary, while the research document's rounded display value is not an additional equality rule.

## Checked and correct

* Current glucose/ketone thresholds and the supplied boundary/precedence tables passed. Confirmed high mmol/L values reach the extreme rule; LO copy no longer invents a universal device limit.
* Unchanged glucose measurement identity survives actual repeated saves; the supported ambiguous-unit correction does not fabricate a severe-low episode.
* An earlier low without a usable timestamp no longer establishes that 15 minutes elapsed. Recorded severe/repeated episodes remain restrictive.
* Complete severe BP readings are assessed individually before averaging and combine across saves. An unresolved confirmed obligation is retained after a lower repeat.
* A fresh unresolved extreme or urgent ketone reading retains emergency when replaced by normal. Earlier positive ketones plus illness escalate.
* Profile-only eye holds apply to the live permission as well as start permission.
* A single refused write is retained in the hook, and the actual sheet displays its failed-save notice once the save returns.
* Ready-screen Start uses the time of the physical tap. A received emergency pauses the mounted Player and silences voice.
* Saved Stretch uses the stretch mode/slot and is not rejected solely because Guided would refuse a sensory-only report.
* Explicit non-diabetic SGLT2 use now exposes ketone entry outside the glucose group. A nonrenal true/unsure fluid restriction reaches the safety fluid rules.
* The runner prevents skipping a genuinely unanswered glucose checkpoint. The failure is logging an answer before completing its collection.
* The new shared gates contain no insulin-dose or medicine-change decision. The proposed fixes require record identity, data flow, capture and gate enforcement, not medication advice.

## Checks skipped or not established

* A fresh shell launch was unavailable with `sandbox-exec: sandbox_apply: Operation not permitted`. I used the already-running Node session and did not request approval or escalation.
* No Vitest CLI, build, development server or browser profile was created. The executed test result is the in-memory run described above.
* No independent replay of the reported 14 historical mutations or Chromium run was performed. A pass of the current helper tests does not validate those historical claims or every UI transition.
* No mounted React DOM scheduling, real Safari/Chromium focus/dismissal behavior, earphone OS events, private-mode IndexedDB failure, actual quota exhaustion or multitab storage synchronization was exercised. Async ordering and refused-write cases used controlled ports and actual compiled callbacks. Dialog dismissal is wired through the actual `onOpenChange`; the standard close button exists in `src/components/ui/dialog.tsx:60`.
* Movement-plan probes used actual builders to establish archived interval/cap differences. This report does not re-audit all exercise selection or mobility advice.

## Release conditions

Before release, add tests that execute the callers and fail on the observed paths:

1. Resolve one typo, report a new genuine severe incident of each kind, and obtain a later normal reading. The new obligation must remain until its own resolution. Repeat an extreme episode across 23:59 to 00:01.
2. Deliver an incoming `50` while a sheet outcome is open. Permission and Start must immediately tighten. Complete an older normal save after a newly selected chest flag; neither form nor banner may soften.
3. Fail a low/emergency write, close/reopen, attempt Walk and Workout, then fail a stale normal write. Every gate must still receive the retained clinical record.
4. Pause and restore each movement mode with insulin glucose at age 30 minutes and just over 30 minutes, with no current check-in, and with a profile hold. Use the same restart gate from UI and earphones. Do not impose freshness expiration on truly uninterrupted exercise.
5. While Walk is running, deliver a current emergency/hold or profile restriction. Stop recording and sensors promptly, retain progress, and display the correct help action.
6. Restore an interval plan under current `INT`, `LOAD`, `COOL`, foot and eye restrictions. No prohibited interval, dose, position or cue may execute.
7. Close the low and glucose-checkpoint dialogs before saving. Keep the check pending or end; do not resume or mark measured. Separately verify normal checkpoint continuation and complete treated-low capture.
8. Save each partial severe BP component with acute symptoms. Emergency must appear without fabricating or waiting for the other component.
9. Attempt to complete non-diabetic health review with SGLT2 unanswered. It must remain unknown or require an explicit answer. Verify unknown BP-medicine guidance for relevant heart/kidney profiles without a hypertension diagnosis.
10. Dismiss a Worse report, restore progress, try Previous/Resume, and report rapid/bilateral weakness or CES symptoms. The provoking restriction and emergency urgency must survive these paths.

After these integration fixes, rerun the supplied tests and the additional cases through the real browser acceptance suite required by D34, followed by the iPhone checks for actual visibility, audio and persistence behavior.

Release verdict: **do not ship**.
