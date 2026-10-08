# Safety engine re-audit

**Release verdict: do not ship.** The rebuilt engine passes its supplied contract and regression fixtures, including the glucose boundaries in both units. The app can nevertheless start or resume movement after a refusal, manufacture a fresh glucose timestamp, lose a saved emergency answer after a failed write, and execute an archived plan that violates current restrictions. These are reproducible safety failures, not objections to the design.

Reviewed on 8 October 2026 against [the Safety contract](../research/clinical-tracking-protocols.md#safety-contract), [the original audit](codex-safety-gap.md), and [BOARD D28, D29 and D30](BOARD.md). D29 supersedes the original contract's demand for same-day contact after every repeated level 1 low. Its decision is to end that attempt, continue rescue under the existing plan, and tell the team if lows keep happening. Level 2 or 3 still requires contact today.

Source files changed during this review. I refreshed the changed safety files and reran the tests and affected probes. The final cited snapshot has SHA-256 prefixes `f3351f4e7dce` for `src/engine/readiness.ts`, `f82bf59ffd86` for `src/engine/permission.ts`, `b358cb491c59` for `src/pages/SessionPage.tsx`, `22bb0608e72a` for `src/components/checkin/CheckInSheet.tsx`, and `f2b35b8e4448` for `src/hooks/useGuided.ts`. The critical reviewed files were unchanged at the final comparison before writing. I did not audit the in-progress `mobility.ts` nerve-gate change.

## What I executed

I transpiled the checked source and test files in memory, registered their actual `describe`, `it` and `it.each` bodies, and executed them using the installed Vitest assertion plugins and Chai. These specifications use no Vitest mocks or lifecycle hooks that the runner would need to reproduce. No source, test, cache or temporary file was written by the probes.

| Test file | Current cases executed | Passed | Failed |
|---|---:|---:|---:|
| `src/engine/contract.test.ts` | 65 | 65 | 0 |
| `src/engine/permission.test.ts` | 17 | 17 | 0 |
| `src/engine/readiness.test.ts` | 86 | 86 | 0 |
| `src/components/checkin/form.test.ts` | 25 | 25 | 0 |
| `src/components/checkin/start.test.ts` | 5 | 5 | 0 |
| Subtotal for the implementer's claimed group | 198 | 198 | 0 |
| `src/engine/health.test.ts` | 21 | 21 | 0 |
| **Total** | **219** | **219** | **0** |

The first snapshot had the claimed 196 cases, and all passed. Two permission tests were added during the review, producing the current 198 plus 21 health tests. I did not reproduce the claim that 104 cases failed on the old revision, because that comparison revision was not established here.

Independent probes called the real engine and form functions. Component probes transpiled the actual `CheckInBody`, `useGuided` save callback, `SessionPage` arrival branch and low dialog, with controlled React hooks, clock, router and persistence/store ports. The walk probe used the actual live-walk controller with storage in a JavaScript `Map`. These are function and event-handler observations, **not a rendered browser, React effect, Safari or real IndexedDB failure test**. The failed-write probe models the rollback that the actual store code implements.

Probe fixtures use the contract tests' date, **9 October 2026, 09:00 IST**. Below, `N` means that instant, and `N-3m` means three minutes earlier. Unless stated otherwise, the profile is a reviewed type 2 profile on metformin, with no insulin, sulfonylurea, eye restriction or active foot wound; the check-in has no emergency/news flags, sleep `gt7` and energy `4`. BP entries use `{sys, dia, at}`, glucose uses `{value, unit, measuredAt}`, and blood ketones use `{kind: 'blood', value, measuredAt}`.

## Release-blocking findings

### F01. An unchanged reading acquires a new time, and a unit correction can become a fictitious past low

**Severity: high. NEW PROBLEM in the rebuilt timestamp/capture path.**

**Location:** `CheckInSheet.tsx:117` to `123`, `:136`, `:166` and `:196`; `form.ts:306`, `:322` to `330`.

**Trigger and observation, UI03:** A basal-insulin user enters `140 mg/dL` with the default time unset and saves at 09:00. Leave the same sheet open until 09:31. Its Start handler correctly refuses the stale reading. Tap **Change answers**, leave `140` unchanged, and tap **See today’s plan**. The time input is still blank. The new saved reading is `140` at 09:31, permission becomes `reassure`, and Start calls `onStart`.

The `save` handler updates `record`, but never hydrates `form` with the timestamp assigned by `buildCheckIn`. Thus `sameGlucose` fails against the saved timestamp and line 330 uses the submission time again. Reopening the sheet correctly clears stale glucose, but changing answers within the same opening does not.

**Related trigger, UI04:** Enter `5.5` with the wrong mg/dL unit, save, change answers in the same opening, and use **I meant 5.5 mmol/L**. The form's time remains `null`, so the correction condition at `form.ts:325` fails. The old `5.5 mg/dL` is retained as a level 2 event, and the corrected `99 mg/dL` reading still produces `today`. The pure form correction test starts with `formFromRecord(saved)`; the actual component does not do that after its first save.

**Required:** Preserve the measurement identity and assigned timestamp in the editable form after saving. An unchanged measurement must never refresh its time. A recorded correction must replace that measurement without fabricating a historical severe low. Request a genuinely new reading to release stale data.

### F02. Resume removes required data checks and can even discard a profile-only hold

**Severity: critical. NEW PROBLEM in the new resume permission path.**

**Location:** `permission.ts:179`, `:182`, `:212` to `217`, `:235` to `244`, and `:258` to `259`.

**Triggers and observations:**

| Probe | Input | Observed | Required |
|---|---|---|---|
| R01 | Basal insulin, today's glucose `140 mg/dL` at `N-180m`, saved session | `resumePermission`: allowed, `reassure` | Hold before restarting movement, request a usable current check under D29(6). |
| R02 | Same insulin profile, no check-in for today | Allowed, `reassure` | H-DATA, no risk-dependent clearance with the required check absent. |
| R03 | `retinopathy='recent_eye_treatment'`, no check-in for today | Allowed, `reassure` | Profile rule says no exercise until eye-doctor clearance. Apply that hold. |

`resumePermission` deliberately sets both `fresh` and `needToday` to false. With no current record, `decide` constructs `profileOnlyReadiness` **after** collecting blocks and uses only its restrictions and adjust reasons. A profile disposition of `hold` is thereby converted into `reassure`.

`permission.test.ts:111` explicitly expects a 90-minute-old insulin reading to be permitted on resume. That passing test proves the exception, not its safety. Checkpoints later in the player do not supply a glucose check before the restarted movement, and F08 shows that those checkpoints are themselves bypassable.

**Required:** Apply profile holds before the allowed branch. Distinguish uninterrupted exercise from restarting after a pause, background interval or another day. Before a restart, enforce the required check and current unresolved clinical conditions. This does not require automatically cutting off uninterrupted exercise when its starting reading turns 30 minutes old.

### F03. The player freezes permission at route arrival rather than movement start or a new safety report

**Severity: critical. STILL DIVERGES from the contract's evaluation points.**

**Location:** `SessionPage.tsx:100` to `112`, `:178` and `:279`.

**Trigger and observation, P03:** Open a fresh guided session with an insulin user's `140 mg/dL` measured at 09:00. Stay on its ready/start screen until 09:31. Rerendering still selects `Player`; a new call to `permission` returns H-DATA hold. `StartScreen` receives `act.start` directly, with no permission check at the physical Start tap.

**Trigger and observation, P04:** After a runnable arrival, a new current check-in reports `emergency: ['chest']`, for example through a store update from another tab. The component rerenders with that check-in, but its `gate` remains the original `useState` value and it still renders `Player`. A fresh permission call returns `emergency`. The player receives no reactive check-in or gate result that interrupts it.

**Required:** Check permission at actual initial movement start and restart. React to newly reported emergency/today/hold conditions and stop the player immediately. Keep ordinary age expiry during already-running exercise separate from a new symptom, reading or restart.

### F04. The sheet can authorize an unmerged record while the store holds a level 2 low

**Severity: critical. NEW PROBLEM in the rebuilt history-preservation integration.**

**Location:** `useGuided.ts:52` to `64`; `CheckInSheet.tsx:78` to `79`, `:117` to `121`, `:171` to `176`.

**Trigger and observation, UI07:** The sheet opened with an old normal record containing `110 mg/dL`. While it stays open, the current store record acquires `50 mg/dL`, such as a same-day check-in saved in another tab. Resubmit the sheet's old `110`.

The real `saveCheckIn` callback merges the latest store record using `carryForward`, so the saved record contains `glucoseEarlier=[50 mg/dL]` and readiness `today`. It returns **only the readiness**. The sheet sets its local record to `{...unmergedInput, readiness}`. Its `ask` function then reevaluates that input without the `50`.

The component probe observed an OutcomeBanner with **permission `reassure`, allowed true**, alongside **readiness `today`**. The button uses permission and is offered. There is no malicious input or corrupt file in this sequence. The callback's own comment at line 60 anticipates another save landing since render.

**Required:** Return the complete merged record and evaluate that record in the sheet, or make the sheet consume one authoritative store record. Synchronize incoming safety changes during an open sheet. A readiness object attached to a different payload must never authorize movement.

### F05. A failed emergency save can disappear when the sheet reopens

**Severity: critical. NEW PROBLEM in the rebuilt save-to-permission integration.**

**Location:** `useGuided.ts:58` to `64`; `CheckInSheet.tsx:36`, `:117` to `123`; `useLocalStorage.ts:15` to `25`; `useStore.ts:272`, `:289`, `:316` to `321`, `:359` to `366`.

**Trigger and observation, UI06:** Start from a durably saved normal check-in. Tick chest pain. The real save callback calls the adapter's optimistic updater and synchronously returns emergency readiness. The write later returns `{ok:false, failure:{code:'quota', ...}}`, and the store resynchronizes to the old committed record. Close and reopen the sheet.

The fault-port probe observed `returnIsPromise=false`, an optimistic record with `['chest']`, then a reopened sheet using the old `emergency=[]` record and showing allowed `reassure`. The actual store's failure path sets `lastFailure` and rolls the view back; the caller never awaits or handles its `StoreResult`. A storage banner does not preserve a clinical stop.

**Required:** Propagate the write result and the merged record. Keep the unsaved answer/draft and a central pending safety stop until the write is acknowledged or the answer is explicitly corrected. A failed safety write must not close the workflow into apparent success or let an old normal record authorize movement. Report the storage failure as well.

This is a component/callback probe plus a traced store failure path, not a claim that I reproduced Safari quota exhaustion.

### F06. A saved walk resumes even after the screen receives emergency refusal

**Severity: critical. NEW PROBLEM in the new Walk integration.**

**Location:** `LiveWalkScreen.tsx:104` to `109`, `:227`, `:244`; `walk/live.ts:371` to `399`, `:430` to `437`.

**Trigger and observation, W01:** Start a permitted walk, pause and detach it so its progress is saved. Save a current check-in with chest pain. Open the live-walk address again.

The screen computes `permission(..., 'walk')` correctly as emergency refusal, then calls `live.attach(undefined)`. `attach` treats a stored walk as resumable independently of the missing request. The actual controller returned `resumed`, restored a paused walk, and `resume()` changed it to `running`. The screen's Resume and **I am fine, carry on** handlers call that method without another permission check.

**Required:** Restore progress for inspection without authorizing movement. Gate every route arrival, automatic return and Resume action against current permission. On refusal, show the appropriate stop/help state and keep recoverable progress. Supplying no new request must not mean “resume an existing walk anyway”.

### F07. Current restrictions are displayed by permission but not applied to an archived plan

**Severity: critical. NEW PROBLEM in the new permission-to-player integration.**

**Location:** `health.ts:123` to `145`; `permission.ts:196` to `205`, `:235` to `244`; `SessionPage.tsx:61` to `74`, `:106` to `136`.

**Trigger and observation, P02:** Save a standing strength plan before a foot ulcer develops. The new profile has `footStatus='current_wound_or_active_charcot'` and neuropathy; today's otherwise normal check-in exists. Resume the archived plan.

Permission correctly allows a restricted guided mode and returns `FOOT`, seated/floor work only, plus no impact. The arrival branch passes the original saved plan to `Player`, still containing its standing `barbell-squat` step. It neither applies the current restriction codes nor compares the old plan with them. The branch probe used a controlled saved-plan port; the source path copies the same original plan from a real saved run.

**Required:** Before executing an archived plan, validate every remaining step against the current restrictions and rebuild, skip or refuse incompatible work without losing completed progress. Apply the same rule to new eye, load, head-down and nerve restrictions. Allowing a mode with restrictions is only safe if its content respects them.

### F08. In-session low recovery bypasses the rebuilt release rule

**Severity: critical. STILL DIVERGES, although the check-in engine's ordinary timed case passes.**

**Location:** `SessionPage.tsx:266` to `270`, `:304` to `309`, `:427` to `432`, `:445` to `467`; `readiness.ts:499` to `534`.

**Trigger and observation, UI05:** Open **Treat the low first**. With the timer still at `900000` ms, the recovery button is enabled and calls `onRecovered` immediately. There is no numeric reading or explicit care-plan confirmation. The callback seeks the cool-down, so this is **movement before verified recovery**, not a claim that it resumes the full workout.

At the glucose checkpoint, **I had carbs, continue** also advances without recording or evaluating a reading. A user with a measured `65 mg/dL` can select it immediately. The low-dialog text says that a recheck still under 70 should take more carbohydrate and wait again, rather than enforcing D29(3)'s end of that attempt.

**Separate engine trigger, L01:** `glucoseEarlier=[{value:65,unit:'mg/dL'}]` with no old measurement time, current `95 mg/dL` at `N`, and `lowRecovered=true` returns allowed `adjust`. Both timing checks at lines 500 and 507 require `pending.t !== undefined`, so absence of the low's time bypasses the minimum interval.

**Required:** Use the same recorded hypo episode and release rules in the player and sheet. Preserve the low and its times, obtain the usable recheck and symptoms/care-plan answer, and enforce the first 15-minute persistent-low termination. If an old low's time is unknown, request usable episode timing or clinical resolution instead of asserting that 15 minutes elapsed. A timer display alone is not a gate.

### F09. Severe BP history loses escalation, and an incomplete severe component hides the emergency question

**Severity: high. STILL DIVERGES from T-BP and E-BP.**

**Location:** `readiness.ts:697` to `737`, especially `:724`; `form.ts:227` to `238`, `:267`; `CheckInSheet.tsx:115`, `:145` to `147`, `:309` to `314`.

**Triggers and observations:**

| Probe | Input | Observed | Required |
|---|---|---|---|
| B01 | First properly taken `190/80` at `N-3m` is in `bpEarlier`; repeat `186/82` at `N-1m` is the current reading | `hold`, `bpSevereUnconfirmed` | `today`: severe again two minutes later. The user need not enter both measurements in one form submission. |
| B02 | Confirmed severe pair `190/80`, `186/82` is in history; new `120/80`, no recorded assessment/correction | `hold`, try tomorrow; contact only if high again | Preserve the unresolved contact-today requirement from the confirmed pair. |
| B03 | Two current severe readings only six seconds apart | `today` | This is conservative contact advice, but it does not prove the specified one-minute repeat protocol. |
| B04 | No diabetes, BP monitoring on; enter systolic `190` and leave the diastolic box blank; the person reports new confusion | No high-BP symptom control; submit disabled; visible advice only says sit five minutes and remeasure | Let the emergency symptom be captured and shown immediately. Severe **either-component** logic must not wait for the other entry. |

The today branch counts only `severeNow`, not severe readings retained from an earlier save. The raw-history retention is correct, but its escalation is not. The partial-entry alert uses a different completeness condition from `visibleQuestions.bpSymptoms`.

**Required:** Evaluate the severe episode across current and retained readings with their actual times, retain its unresolved disposition, and permit a correction/assessment path. Ask the urgent symptom question whenever a known entered component is severe, independently of completion validation; do not fabricate the missing component as zero.

The original regression #6 passes, but its form fixture at `contract.test.ts:464` has neither `at1` nor `at2`. `buildCheckIn` timestamps both at the same instant. Its title promises a repeat at least one minute later that the test does not actually supply.

### F10. Extreme glucose can be silently cleared, and high mmol/L has no confirmation path

**Severity: critical for unresolved emergency clearance, high for the unit path. STILL DIVERGES.**

**Location:** `readiness.ts:53` to `56`, `:378` to `389`, `:406` to `410`, `:477` to `482`; `CheckInSheet.tsx:243` to `248`.

**Trigger and observation, G01:** Reliable `600 mg/dL` at `N-3m` is retained in `glucoseEarlier`; current `110 mg/dL` at `N`, no recorded typo correction or emergency assessment. Permission is allowed `reassure`. The only extreme-glucose rule evaluates `latest`.

Allowing correction of a typing mistake is necessary. Interpreting every subsequent lower reading as correction or clinical resolution is unsafe. A genuine extreme reading and a mistaken entry need distinct recorded transitions.

**Triggers and observations, G02/G03:** `650 mg/dL` yields emergency. The identical reliable reading `650/18 = 36.111111111111114 mmol/L` yields only a suspect-unit hold and conditional low-rescue advice if the number were mg/dL. The sheet offers **Yes, use mg/dL**, but no way to confirm that this is genuinely mmol/L. This is a sanity-classification failure before comparison, not a factor-18 arithmetic error.

**Required:** Preserve unresolved extreme-reading episodes until an explicit correction or appropriate clinical resolution. For a confirmed unit, apply the same extreme threshold in both units. While the unit remains uncertain, hold and request confirmation without removing the urgent interpretation of a possible extreme high or coercing the reading into mg/dL.

### F11. Replacing ketones lowers the urgency of an unresolved episode

**Severity: high. NEW PROBLEM in the rebuilt retained-ketone rules.**

**Location:** `readiness.ts:627` to `679`, especially `:655`, `:669` and `:674`.

**Trigger and observation, K01:** Reliable blood ketones `3.0 mmol/L` at `N-3m`, then `0.1` at `N`, no recorded correction or clinical assessment. The retained urgent result becomes `today`, with generic care-team advice, rather than emergency assessment. Earlier `urgent` and `high` are deliberately put in the same branch.

**Trigger and observation, K02:** Retained positive `0.8`, current `0.1`, and `news=['unwell']`, without a recorded resolution of the positive episode, produce only `hold`. The illness escalation tests the current ketone level. The app still treats the earlier positive result as an unresolved block, but does not apply its contact-now illness condition.

**Required:** Distinguish a resolved/corrected episode from an unresolved one. Do not erase its required help action merely by replacing the current measurement. If retained positive ketones remain the reason to hold, evaluate illness against that unresolved episode too. An assessed resolved historical episode should not be treated as present DKA forever.

### F12. SGLT2 risk outside diabetes has no usable medicine or ketone entry path

**Severity: high. STILL DIVERGES in capture, despite correct engine evaluation when supplied a ketone.**

**Location:** `ProfileWizard.tsx:294` to `325`; `form.ts:214`, `:217`, `:221`, `:234`; `CheckInSheet.tsx:220`, `:280`; `health.ts:34`.

**Trigger and observation, S01:** A person without diabetes takes an SGLT2 inhibitor for heart or kidney disease. With a seeded `sglt2i=true` profile, derived ketone risk is true and the DKA symptom option is offered. However, `visibleQuestions.glucose=false` and `ketones=null`. Even a form containing blood ketones `3` loses that result in `buildCheckIn`; the resulting no-symptom record receives allowed `reassure`.

The wizard hides the SGLT2 question inside `diabetic`, so a real user cannot establish this risk through that path either. Asking about DKA symptoms alone does not capture an emergency ketone reading before those symptoms occur.

**Required:** Ask the applicable medicine question outside the diabetes-only group, and show ketone entry for ketone-risk users independently of glucose entry. Preserve a supplied ketone result and apply E-KETONE regardless of diabetes status or glucose.

### F13. Kidney disease is an incomplete substitute for a prescribed fluid limit

**Severity: high. STILL DIVERGES from H-DIZZY's fluid caveat.**

**Location:** `HealthProfile`, `profile.ts:34` to `85`; `readiness.ts:251`, `:781` to `787`.

**Trigger and observation, D01:** A person with heart failure and a prescribed fluid restriction has `heartOrVascularDisease=true`, `kidneyDisease='none'`, dizziness and BP `85/55`. The movement hold is correct, but actions include **Have a drink once you are sitting or lying down.** There is no profile field to record the fluid restriction; kidney disease alone determines the instruction.

**Required:** Make fluid advice conditional on an explicit prescribed restriction or existing fluid plan. The engine need not prescribe litres or diagnose a reason for the limit. A heart-disease user with a restriction must not receive unconditional extra-fluid advice.

### F14. A-BACK is not enforced by the in-session checkpoint

**Severity: high. STILL DIVERGES, independently of the in-progress mobility selection fix.**

**Location:** `readiness.ts:207` to `223`; `SessionPage.tsx:265` to `270`, `:436` to `440`.

**Trigger:** A session's back checkpoint is answered **worse** after a movement sends symptoms from the thigh to below the knee. The actual handler logs the answer, shows a “next time” toast, and calls `act.next()` unconditionally. The checkpoint offers only better/same/worse; it cannot distinguish distal spread, new weakness, saddle symptoms or ordinary discomfort.

**Observed code path versus required:** Prior-session function and reach changes correctly produce adjust/no-progression in readiness. The current provoking movement and subsequent load are not stopped or reassessed. The contract requires stopping the provoking movement now and limiting continuation to appropriate previously tolerated activity; new weakness/CES must take the higher pathway.

**Required:** Capture the changed symptom pattern, interrupt provoking work, and apply current permission/restrictions before continuing. Do not solve this with an invented pain threshold or percentage reduction. This finding concerns the player callback, not `mobility.ts` exercise selection.

### F15. A saved Stretch is checked as guided, although a fresh Stretch now uses the right mode

**Severity: moderate, inappropriate refusal and missing mode-specific restriction handling. NEW PROBLEM in the new resume integration.**

**Location:** `SessionPage.tsx:58` to `60`, `:106` to `109`; `permission.ts:258` to `259`.

**Trigger and observation, P07:** Save a stretch, then report new unilateral tingling/numbness without weakness. Resume `/session?mode=stretch&focus=backHips&minutes=10&resume=1`.

`permission(..., 'stretch')` allows adjusted, previously tolerated gentle activity with nerve restrictions. `resumePermission` hardcodes `'guided'`, so the arrival branch renders `SessionGate` and refuses it as guided. The fresh route now correctly asks for stretch permission, confirmed by P06. I am not reporting the earlier fresh-route mode error against the updated code.

**Required:** Supply the actual mode to resume permission and apply that mode's current restrictions to the saved remaining plan. Keep the per-mode distinction through the complete workflow.

## Every Safety contract row

`VERIFIED` means the specified engine case passed and I traced the implementing path. It does not mean every caller enforces that result. F01 to F08 are shared capture/start/resume defects, so even rows with correct pure rules are not end-to-end release clearance. `NEW PROBLEM` below identifies a failure in a newly added permission, history or mode-integration path; I do not claim to have executed an archived revision to date its introduction.

All row tests below are in `src/engine/contract.test.ts`; each cited starting line names the matching row.

| Contract row | Status | Test and traced code path | Result or counterexample |
|---|---|---|---|
| E-CARDIAC | **NEW PROBLEM** | Test `:63` passes; `readiness.emergencyRules`, `readiness.ts:132`; `permission.decide`, `permission.ts:220` | Core flags override numbers correctly. W01/F06 resumes an actual saved walk after emergency refusal; P04/F03 retains a runnable arrival after new chest pain. |
| E-CES | **VERIFIED** | Test `:74`; `emergencyRules :132`, `backRules :168`; `formFromRecord`, `form.ts:114`, `buildCheckIn :382` | Bladder/bowel, saddle/sexual and legacy cauda flags produce emergency at pain zero and normal glucose. UI02 retains them when the profile no longer asks back questions and another answer is saved. |
| E-BILATERAL | **VERIFIED** | Test `:84`; emergency mapping `readiness.ts:125`, `emergencyRules :132` | New bilateral neurological answer refuses all three modes. It is a present flag, separate from historical unilateral symptoms. |
| E-HYPO | **VERIFIED** | Test `:90`; `emergencyRules :132`, `merge :903` | Present inability to swallow/self-treat is emergency; `noOral` suppresses eating/drinking advice. Past level 3 uses the distinct news item and today action. |
| E-BP | **STILL DIVERGES** | Test `:100` passes; `bpRules :711` to `720`; UI capture `form.ts:238` | Complete severe pair plus acute symptom correctly gives emergency before repeat. B04/F09 hides that symptom control when only the severe component has been entered. |
| E-KETONE | **NEW PROBLEM** | Test `:111` passes; `ketoneLevel :612`, `ketoneRules :639`, retained branch `:669` | Current blood `>=3` or urine moderate/large is emergency independent of glucose. K01/F11 silently reduces an unresolved prior urgent result to today. S01/F12 cannot capture the result for a nondiabetic SGLT2 user. |
| E-DKA-SYMPTOM | **VERIFIED** | Test `:121`; DKA mapping `readiness.ts:127`, `emergencyRules :132`; `visibleQuestions`, `form.ts:217` | Explicit DKA symptom flag is emergency with normal glucose or no ketone. SGLT2 risk also exposes this flag outside diabetes, although F12 blocks ketone capture. |
| E-EXTREME-GLUCOSE | **STILL DIVERGES** | Test `:125` passes; `glucoseRules :477` to `482`, sanity `:53` | Current `600` and `600/18` are emergency. G01 clears a reliable prior `600` with `110` absent correction/resolution; G03 gives only hold for reliable `650/18`. F10. |
| E-OTHER | **VERIFIED** | Test `:131`; emergency mapping `readiness.ts:128` to `129`, `emergencyRules :132` | Accident and confused/hard-to-wake heat flags refuse all modes independently. Chest pain also takes E-CARDIAC without requiring a back-pain score. |
| T-BP | **STILL DIVERGES** | Test `:138` passes; `bpRules :708` to `737`, especially `:724` | Two current severe readings give today. B01 counts a retained first severe reading as unconfirmed; B02 loses the confirmed-pair contact requirement. F09. |
| T-NEURO | **VERIFIED** | Test `:144`; `backRules :163` to `182` | New motor weakness/foot drop gives today; rapid progression escalates to emergency; bilateral/CES flags override. Legacy undifferentiated `newNeuro=true` conservatively means possible weakness. |
| T-BACK | **VERIFIED** | Test `:151`; `backRules :194` to `204` | Actual back/leg pain plus unwell, reported feverishness, or sudden/severely worsening pain gives today. A high numeric pain rating alone does not give clinical urgency. |
| T-HYPO-REVIEW | **STILL DIVERGES** | Test `:159` passes; `glucoseRules :427` to `462`; player `SessionPage.tsx:463` | Retained level 2/3 gives today; persistent/recurrent level 1 ends the attempt without an automatic today-contact mandate, correctly following D29(3). F08's player can bypass termination and recovery capture. |
| T-KETONE | **VERIFIED** | Test `:169`; `ketoneLevel :616`, `ketoneRules :644` to `648` | Current blood `>=1.5` and `<3` refuses all modes and contacts today. Historical escalation defect is recorded under E-KETONE/F11. |
| T-ILLNESS | **STILL DIVERGES** | Test `:174` passes; `newsRules :260` and `:272`; `ketoneRules :655` | Current positive ketones plus unwell, diabetic vomiting and explicit high-not-falling give today. K02/F11 keeps an unresolved earlier positive as a block but only says hold when unwell. |
| H-HYPO | **STILL DIVERGES** | Test `:180` passes; `glucoseRules :485` to `534` | Ordinary timed rescue/recheck/confirmation works. L01 permits recovery with the earlier low's time missing; UI05 permits movement while the timer still says 15 minutes. F08. |
| H-PRE-LOW | **VERIFIED** | Test `:194`; `deriveHealth`, `health.ts:27` to `34`; `glucoseStartMin :60`; `glucoseRules :518` | Insulin/SU `70<=g<90` holds without classifying it as biochemical hypo or inventing a carbohydrate dose. Confirmed metformin-only at `80` is permitted. |
| H-HIGH | **VERIFIED** | Test `:204`; independent `evaluateCheckIn`, `readiness.ts:838` to `849`; `ketoneRules :639` to `658` | High glucose never skips ketones. The stronger ketone/illness condition determines the help action, including when glucose is simultaneously low. |
| H-HIGH-UNCHECKED | **VERIFIED** | Test `:209`; `deriveHealth`, `health.ts:34`; `glucoseRules :570` to `576` | At `>=250`, risk plus absent/unusable ketones holds. Basal type 2 insulin alone does not acquire a daily ketone mandate. No clinician-plan bypass is represented; the conservative default is safe. |
| H-T2-HIGH | **VERIFIED** | Test `:218`; `glucoseRules :580` to `584` | `>300`, excluding type 1, holds; `300` does not meet that operator. Broader application to nondiabetic/other profiles is conservative. There is no selectable clinician-authorized light-activity plan. |
| H-LOW-KETONE | **VERIFIED** | Test `:223`; `ketoneLevel :616`; `ketoneRules :649` to `658` | Current blood `0.6<=k<1.5` holds with two-hour recheck; unwell escalates today. Positive urine holds without blood conversion. Recorded clinician-plan release is absent; see policy 3 and F11. |
| H-EXERCISE-BP | **VERIFIED** | Test `:229`; `bpRules :745`, `:755` to `777` | Strict `>160 OR >100` holds every mode under D29(4). Explicit permission must cover every raw reading and cannot lift severe BP. An individual clinician systolic stop uses its documented inclusive `>=`. |
| H-DIZZY | **STILL DIVERGES** | Test `:239` passes; `newsRules :308`; `bpRules :781` to `787` | Dizziness holds even with normal BP, but D01/F13 gives extra-fluid advice despite a nonrenal prescribed restriction. Standing BP numbers are not captured; this does not negate the correctly implemented symptom rule. |
| H-FOOT/EYE | **NEW PROBLEM** | Test `:246` passes; `profileRules`, `health.ts:123` to `145`; `permission.ts:197` | Correct current FOOT/eye restrictions and walk refusal. P02/F07 executes the saved standing plan anyway. R03/F02 loses a profile-only eye-treatment hold when resuming without today's record. |
| H-DATA | **NEW PROBLEM** | Test `:263` passes; `glucoseRules :391` to `424`; `profileGaps`, `health.ts:46`; `permission.ts:161`, `:208` | Ordinary missing/unknown/suspect/HI/sensor-conflict cases hold. R01/R02 bypass required checks on resume; UI03 creates false freshness; UI07 authorizes a payload missing the saved low. F01/F02/F04. |
| A-BACK | **STILL DIVERGES** | Test `:283` passes; `backRules :185`, `:207` to `223`; player `SessionPage.tsx:265` | Pre-session sensory/function/reach changes are recognized, with no pain-based clearance. The actual in-session worse checkpoint does not stop provoking work or capture the red-flag branch. F14. |

## Every boundary and precedence case

The comparisons preserve the factor-18 framework from D29(1). `toMgdl` at `readiness.ts:37` multiplies by 18 without rounding. `threshold`, `below`, `atLeast` and `above` at `:359` to `362` compare a mmol/L value to `mgThreshold/18`, rather than rounding a converted value. That is an equivalent comparison and avoids a floating-point round trip at equality. Display rounding at `:365` to `367` is not used for these decisions.

The unit-table tests at `contract.test.ts:349` to `378` execute each boundary minus `0.1`, equality, and plus `0.1` mg/dL, and each value divided by 18 in mmol/L. They compare disposition, allowed state and reason codes.

| Boundary or precedence condition | Status | Executed result and traced path |
|---|---|---|
| `54 mg/dL`: below is level 2; equality is level 1 | **VERIFIED** | Test `:300` and unit table `:352`: `53.9` gives today; `54` and `54.1` give hypo hold in the low-risk fixture, in both units. `isSevereLow :364`, `glucoseRules :428`, `:485`. |
| `70 mg/dL`: equality is not biochemical hypo | **VERIFIED** | Test `:305`, table `:353`: `69.9` holds, `70` and `70.1` permit a low-risk user in both units. Insulin at `70` has `belowStart`, not `low`. `isLow :363`, start branch `:518`. |
| `90 mg/dL`: insulin/SU pre-exercise boundary | **VERIFIED** | Table `:355`: `89.9` holds; `90` and `90.1` allow adjusted preparation in both units. Personal higher start levels remain applicable. `glucoseRules :518`, `health.glucoseStartMin :60`. |
| `250 mg/dL`: ketone-risk unchecked boundary | **VERIFIED** | Table `:357`: SGLT2 fixture `249.9` adjusts; `250` and `250.1` hold in both units. `glucoseRules :571`. |
| `300 mg/dL`: strict type 2 high gate | **VERIFIED** | Table `:358`: low-risk fixture `299.9` and `300` adjust; `300.1` holds in both units. `glucoseRules :580`. |
| `600 mg/dL`: inclusive extreme gate | **VERIFIED** | Table `:359`: `599.9` holds; `600` and `600.1` are emergency in both units. `glucoseRules :478`. This local boundary pass does not cover G01/G03. |
| Ketones `0.6`, `1.5`, `3.0 mmol/L` | **VERIFIED** | Test `:311`: `0.59` reassures, `0.6` and `1.49` hold, `1.5` and `2.99` give today, `3` gives emergency. `ketoneLevel :616`. |
| BP `180/80` and `120/120`, either component inclusive | **VERIFIED** | Test `:316`: repeated severe gives today; one plus symptoms gives emergency; `179/80` and `120/119` do not meet the severe operator. `severe :686`, `bpRules :717`, `:724`. |
| BP exactly `160/100`, strict EIM hold above it | **VERIFIED** | Test `:325`: equality permits adjusted movement; `161/100` and `160/101` refuse. The equality still carries head/load/intensity/cool-down restrictions. `bpRules :755`, `:773`. |
| A severe raw reading before averaging or discarding | **VERIFIED** | Test `:333`: `190/80` then `150/85` holds despite the lower average. `bpRules :699` reads raw entries; `form.ts:407` preserves them. History escalation remains F09. |
| CES with glucose in target; stroke below severe BP | **VERIFIED** | Test `:339`: saddle plus `110` is emergency; stroke plus `118/76` is emergency. `emergencyRules :132`, independent merge `:842`. |
| Familiar one-sided sciatica/profile cannot cancel new bladder flag | **VERIFIED** | Test `:344`: low pain and familiar unilateral symptoms do not lower emergency. `emergencyRules :132`, `merge :886`. |
| Ketone emergency cannot be masked by low/pre-low glucose | **VERIFIED** | Tests `:383` and `:442`: ketones `3` with glucose `80`, `60` or `50` remain emergency. Exercise preparation and countdown are suppressed; oral rescue remains only when safe. `merge :903` to `908`, `copy.recheckCountdown :76`. |
| Emergency overrides unknown medicines, data hold and gentler-mode offers | **VERIFIED** | `permission.test.ts:62` and contract row tests: `decide :220` sorts by disposition and `:225` shows only emergency reasons. Global integration bypasses remain F03/F06. |

**Reconciliation:** The contract's written `33.3 mmol/L` is rounded educational text, not the exact computational boundary. Under D29(1), exact equality is `600/18 mmol/L`; `33.3` is `599.4 mg/dL`. The engine is right to use the unrounded equivalent. Do not add an inconsistent `>=33.3` comparison.

I independently confirmed freshness equality: `N-30m` allows; `N-30m-1ms` holds. Future tolerance equality `N+2m` allows; `N+2m+1ms` holds for an insulin user (`permission.ts:167` to `168`). The form rejects future entries beyond that tolerance. **The engine's future-time check is only invoked for hypo-risk profiles**: a stored optional metformin reading at `N+3m` still permits. The implementer's “a reading more than two minutes in the future is refused” claim therefore needs that scope qualification or universal stored-data validation.

## Every original regression case

All ten named test cases pass. Their status below is for the specified original input sequence, with additional uncovered paths identified explicitly. A passing helper fixture is not evidence that the actual sheet/player enforced every transition.

| Original case | Status | Test and code trace | Verified result and limit |
|---|---|---|---|
| 1. Emergency answer with `900 mg/dL` or `99 mmol/L` mistakenly entered | **VERIFIED** | `contract.test.ts:403`; `submitBlocked`, `form.ts:253`; `buildCheckIn :353`; `CheckInSheet.tsx:126` to `130`; `emergencyRules :132` | Emergency saves and refuses all modes without unit correction. UI01 ticked chest with invalid glucose, observed immediate save/emergency banner and hidden nonessential numeric inputs. |
| 2. Saved CES at pain zero survives profile edit; urgent saved-plan arrival | **VERIFIED** | Test `:419`; `formFromRecord :114`, saved-back fallback `form.ts:382`; `backRules :168`; `SessionPage.tsx:106` to `112` | UI02 retained the CES answer after back questions disappeared and another emergency was saved. P05 selected SessionGate when the new emergency existed before resumed-player arrival. Updates after arrival and saved Walk are F03/F06. |
| 3. New foot drop, with rapid/bilateral/CES escalation | **VERIFIED** | Test `:432`; `backRules :163` to `182`; emergency mapping `:123` to `125` | Motor/legacy-neuro gives today; fast progression, bilateral flag or saddle flag gives emergency. No recovery session is offered by permission. |
| 4. Low glucose plus SGLT2 and blood ketones exactly `3` | **VERIFIED** | Test `:442`; `evaluateCheckIn :838`; `glucoseRules :427`, `:485`; `ketoneRules :639`; `merge :903` | `60` and `50` retain both ketone and hypo reasons; highest disposition is emergency. Safe-to-swallow rescue is retained without exercise advice. |
| 5. Moderate urine strip/old Moderate chip, no blood conversion | **VERIFIED** | Test `:451`; `urineCategory :605`, `ketoneLevel :618`; `ketonesFromForm`, `form.ts:350` | Current moderate category and legacy chip value `40` give emergency; small gives hold. The category is preserved as urine. |
| 6. `190/80` then `150/121`, no symptoms, raw readings before average | **VERIFIED** | Test `:462`; `buildCheckIn`, `form.ts:407` to `422`; `bpRules :699` to `727` | Both raw severe-component readings survive and give today. The average `170/101` does not determine severity. The named test omits one-minute timestamps; B01/B02 and F09 cover the missed cross-save case. |
| 7. Reliable `600`, `600/18`, or `601` | **VERIFIED** | Test `:473`; `glucoseSanity :53`, threshold `:359`, extreme rule `:478` | All supplied fixtures produce emergency/urgent with no fallback. The uncovered high-mmol sanity limit and later normal replacement are F10. |
| 8. `89.9 mg/dL` and `89.9/18 mmol/L` on insulin | **VERIFIED** | Test `:480`; `below :360`, `glucoseRules :518` | Both hold with usable recheck required; no rounding up to 90. Full neighboring-boundary table also passes. |
| 9. Unknown/unreviewed medicine class; known insulin missing reading; low-risk control | **VERIFIED** | Test `:488`; `profileGaps`, `health.ts:46`; `permission.ts:208` to `217`; `glucoseRules :392` | Ordinary permission holds unknown/unreviewed and missing required data; confirmed metformin/diet-only with no reading remains permitted. The new resume exception and false freshness are F01/F02. |
| 10. Level 2 `50` then `110`; level 1 `65` then `60` at first recheck | **VERIFIED** | Test `:496`; `buildCheckIn`, `form.ts:384`; `carryForward :461`; `glucoseRules :439`, `:446` to `462` | Retained `50` gives today. Persistent level 1 gives hold/end attempt and conditional care-team advice, correctly applying D29(3). The test's title still implies today-contact for both, but its assertion at `:507` is right. The actual concurrent-save mismatch and player termination are F04/F08. |

## Judgment on the eight extra decisions

Each judgment distinguishes the policy from whether the current application actually enforces it. No judgement below authorizes insulin dosing, a medicine change or a newly invented sick-day plan.

| Extra decision | Judgment | Evidence, reconciliation and required treatment |
|---|---|---|
| 1. Reassure only when every given reading is within target; all nonemergency glucose over 180 adjusts | **SAFE as nonblocking movement preparation, with the target claim rejected** | `glucoseRules`, `readiness.ts:567`, only adds preparation and adjust; it does not invent an exercise prohibition. But the “every reading is within target” assertion is false: confirmed metformin at glucose `150` or `180`, or BP `139/89`, can reassure. No fasting/postmeal context or corresponding target exists in this check-in. The contract itself needs to separate **permission without extra restrictions** from **clinical reading in target**. ADA premeal `80..130` and peak postmeal `<180` in the research are context-dependent, not universal exercise-clearance boundaries. Keep nonblocking preparation if useful, label `reassure` as movement permission, and let recorded contextual targets determine reading interpretation. Do not publish the code comment “above 180 is above target” as a universal clinical fact. |
| 2. After a real treated low, everyone needs a recheck at least 15 minutes later, `>=max(90,startMin)`, and symptoms/plan confirmation | **SAFE** | Conservative exercise resumption after an actual hypo, including metformin-only, is reasonable app policy. It does not turn untreated `70..89` on metformin into a hypo. Standard timed fixtures pass at `contract.test.ts:180`; `readiness.ts:387`, `:499` to `534` implement the intended release. F08 violates it for missing old time and player actions; F01's mistaken-unit correction must not masquerade as a genuine hypo. |
| 3. A day's check-in is an attempt; lows/positive ketones/severe BP persist all day, but extreme glucose does not persist | **UNSAFE** | G01 shows a genuine extreme emergency cleared by a normal replacement with no recorded correction/assessment. Preserve event identity and resolution state. Retaining important history is good. Ending every later opportunity for the rest of the calendar day is stricter than D29's “that attempt”, and the lack of a clinician-plan release can cause unnecessary refusal; it must be named as extra product policy rather than a guideline. A day boundary is not proof that an unresolved event is resolved. |
| 4. Two severe readings with last severe give today; otherwise severe BP holds all day; spacing stored but not enforced; only the nonsevere exercise hold can release | **UNSAFE as implemented** | B01 never reaches today when the two properly spaced severe readings straddle saves. B02 downgrades the contact requirement when a confirmed pair moves into history. F09. Same-day refusal after a single severe or lower repeat is conservative, but is stricter than the original repeat protocol; provide an explicit correction/assessment route rather than claim this is mandated. Contact advice after an inadequately spaced pair is safe to keep conservatively, but do not call the protocol verified or fabricate spacing. The specific clinician permission must continue to lift only the nonsevere gate. |
| 5. New sensory symptoms alone refuse guided, permit gentle stretch/walk with nerve restrictions; back-profile unwell counts as T-BACK | **SAFE with precise scope** | Distinguishing sensory-only from new weakness is useful and matches A-BACK, provided previously tolerated movement and stop-on-spread restrictions are actually applied. Rapid weakness/bilateral/CES remains higher priority. The implementation at `readiness.ts:194` requires actual back/leg pain plus unwell, or `feverish`; it does not send every historical back profile with pain zero to T-BACK. That narrower condition is right. The sensory copy's “more than a few days” at `:190` is an unverified delay instruction; source or remove it. F14/F15 prevent claiming complete mode handling. |
| 6. Urine trace/small hold; legacy values decode to the old chips, rounding up | **SAFE** | `urineCategory :605` uses the old application's enum values, not a formula converting urine to blood. Current moderate/large remains emergency. For values between old chip marks, conservative rounding avoids losing a positive result. Do not treat `40` as the universal meaning of every manufacturer's moderate strip, or accept blood mmol/L under the urine path. Current category entry is the correct representation. |
| 7. Unknown-medicine and unreviewed-health holds exist only in permission, not colour | **SAFE** | D30 makes permission the authority. `health.profileGaps :46`, `permission.ts:208` and Wizard explicit-answer tracking correctly prevent defaults looking reviewed. A compatible colour may remain green without authorizing movement. All initial new movement screens use permission, but actual saved Walk/player/resume exceptions still break the authority, F02 to F07. |
| 8. High gate on every non-type-1 profile; one/two HI, LO; legacy start unit; 30-minute/future rules; resume skips freshness; only emergency reasons show | **UNSAFE overall because of resume** | The broadened `>300` hold is safe conservatism; unknown profiles must first satisfy their data hold. One HI requires a usable repeat, repeated HI gives today, and the app invents no HI number. Conservatively treating LO as a possible severe low is safe; confirm with a meter when available and do not assert a device-independent number. The current generic severe-low reason at `readiness.ts:434` says “below 54” even for LO, so that copy needs the distinction. Unitless legacy start targets are mg/dL and implausible values below 70 are ignored. Freshness is inclusive at 30 minutes and future slack is inclusive at two; both independent probes pass. Only emergency reasons show correctly. The future rule is not universal for stored low-risk readings. Skipping freshness and today's required data on restart is unsafe, R01/R02/F02, and no later unvalidated checkpoint cures that. |

The contract's stronger wording for repeated level 1 contact should be reconciled to D29(3). The exact mmol/L extreme boundary should be reconciled to factor 18. Neither correction justifies weakening an unresolved emergency, today-contact obligation or required pre-session check.

## Component capture, emergency precedence and saved-answer survival

The positive checks matter alongside the failures:

1. **Emergency before numeric validation works.** `submitBlocked` returns no block for an explicit emergency (`form.ts:253`). `setEmergency` immediately saves a newly ticked flag (`CheckInSheet.tsx:126` to `130`) and hides nonessential numeric groups. UI01 confirmed this through actual event handlers with `99 mmol/L` entered. `OutcomeBanner` uses permission for its headline, and emergency countdown is suppressed.
2. **Hidden saved back answers survive ordinary resubmission.** `formFromRecord` maps legacy CES into the global list; `buildCheckIn` retains `previous.back` when the edited profile hides the back section (`form.ts:382`). UI02 confirmed emergency retention at pain zero after the profile changed. Removing a profile pain area is not clinical resolution.
3. **Raw BP and glucose/ketone history are stored by the pure form/callback paths.** `form.ts:384`, `:398`, `:407` and `carryForward :461` retain replaced readings and are idempotent for unchanged entries. The integration failures are using a different local payload, missing a write acknowledgement, and weakening disposition after history moves, not wholesale loss in those helpers.
4. **Start in the open sheet is rechecked at the tap.** `CheckInSheet.tsx:171` works for real stale data. UI03 proved the refusal before proving that resubmission can manufacture a new time.
5. **Successful ordinary current emergencies block player arrival.** P05 observed SessionGate before Player for a saved plan with an already-present new chest flag. F03 concerns changes after that initial snapshot; F02 concerns exemptions in the snapshot's resume decision.

An emergency selected while the sheet is open survives locally while the failed-write workflow stays open. That is narrower than durable survival. Closing/reopening after rollback, incoming records during editing, or skipping the refusal in a movement caller are the uncovered failures.

## Does every new screen use permission?

I searched all non-test `src/screens` source for `useStartMovement`, permission imports, `resumePermission`, `readiness.outcome` and `SessionGate`, and traced the resulting callers.

| Entry/caller | Trace | Assessment |
|---|---|---|
| Today recommendations and movement buttons | `TodayScreen.tsx:87`, `:108`; shared `useStartMovement.tsx:34` to `41` | All three modes are asked; the shared start handler rechecks at tap. No independent numeric safety thresholds found here. |
| Move guided start | `screens/move/routes.tsx:23`, `:34` | Shared start path. |
| Stretch | `StretchScreen.tsx:28` to `29`, `:44` to `47`, `:98` | Correct stretch permission; colour also decorates the unavailable/urgent presentation, but is not sole start clearance. Current fresh player mode is corrected; saved mode remains F15. |
| Walk setup | `WalkSetup.tsx:49`; shared start path | Correct initial walk permission. |
| Live Walk | `LiveWalkScreen.tsx:107` to `109`, `:227`, `:244` | Calls permission on opening a request, then fails to enforce refusal for a saved walk and on Resume. F06. |
| Workout logging | `screens/workout/gate.ts:36` to `40` | Fresh live logging asks guided permission; begun logging uses the unsafe resume helper, F02. Logging an already completed historical workout is correctly separated from authorizing current exercise. |
| Session player | `SessionPage.tsx:106` to `112`, `:178`, `:279` | Current arrival asks permission/resume permission, but snapshots it and leaves start/restart/in-session transitions ungated. F02/F03/F08/F14. |
| Colour-only references in Move/Track | `move/plan.ts:176`, `:238`; `track/RecordDetails.tsx:532` | Availability/caption and historical-display uses. I found no separate numeric clearance logic in these references. |

**Conclusion:** The initial starts are centralized. “Every screen calls permission somewhere” is insufficient: saved progress, Resume handlers, movement content and reactive safety reports must obey its result too.

## Medicine classification and precedence

The profile now represents insulin and its regimen, sulfonylurea/meglitinide, SGLT2, metformin/start year and prior DKA/insulin deficiency (`profile.ts:37` to `53`). Wizard tracking requires answers to all five medicine questions for diabetes before continuing (`ProfileWizard.tsx:54` to `71`, `:299` to `325`). Insulin choices preserve basal-only versus multiple daily/pump information; type 1 implies insulin, and “Not sure” is treated conservatively as exposure (`health.ts:27` to `34`, `permission.test.ts:123`).

Confirmed no-insulin/no-secretagogue treatment has no routine pre-session glucose requirement. Old or unreviewed type 2 profiles cannot silently become that class because `medicinesReviewed` is absent and `profileGaps` holds. This is a substantive correction to the original audit. F12 is the remaining medicine-capture hole outside diabetes; F02 is the bypass when required monitoring is omitted on resume.

**The merger and ordinary permission precedence are correct.** `DISPOSITION_ORDER` is `reassure, adjust, hold, today, emergency` (`checkin.ts:20`). `merge` takes the independent maximum disposition at `readiness.ts:886`, separate from the legacy outcome maximum at `:885`. `decide` sorts blocks by disposition at `permission.ts:222`, and an emergency shows only emergency reasons at `:225` to `226`. No tested same-input case lets a lower-priority contribution replace an already-generated higher one.

The remaining masking occurs **before or after that correct merger**: high history rules emit a weaker contribution, profile-only holds miss the block collection, the sheet evaluates an unmerged payload, or a caller ignores a refusal. Changing Outcome's colour ordering would not fix those defects.

## Reconciliation of declared gaps

| Declared gap | Assessment |
|---|---|
| No clinician plan for high glucose | Safe to hold conservatively while the plan is absent. H-HIGH-UNCHECKED and H-T2-HIGH cannot claim to support clinician-authorized light activity or release under that plan. Do not invent a medication/insulin workaround. |
| No lying-to-standing BP | The dizziness symptom rule is present and works independently of absolute BP. The app cannot capture the documented `>=20` systolic or `>=10` diastolic standing fall from the contract, or verify that protocol. This is a measurement capability limit, not evidence that dizziness is completely ungated. |
| No serial glucose trend for T-ILLNESS | `news='highNotFalling'` explicitly gives today (`readiness.ts:272`). The reported condition is captured even without an invented slope calculation. Do not claim that numeric trend detection was validated. |
| In-movement spread left to player checkpoints | It remains a real contract failure. The callback advances and only promises a next-time adjustment, F14. |
| No temperature field | `feverish` and back/leg pain plus unwell already trigger T-BACK. The original contract explicitly says absence of a measured fever does not negate these reports. A thermometer entry is optional capability, not a prerequisite for urgent action. |
| Fluid limit inferred from kidney disease | Incorrect as a complete model. Nonrenal prescribed limits cannot be represented and receive unconditional advice, F13. |

## Checks skipped or not established

- A new sandboxed shell/Node launch was unavailable with `sandbox-exec: sandbox_apply: Operation not permitted`. I did not request escalation or approval. Reads and in-memory execution used the already-running Node session.
- I did not start the Vitest CLI, Vite build, a development server or browser tooling that could create cache/build/profile artifacts. The alternative in-memory test execution is described above, not represented as a Vitest CLI run.
- No real browser, React effect scheduling, screen-reader interaction, iPhone/Safari timing, storage-quota event, private-mode IndexedDB failure or multitab browser scenario was run. Fault and concurrent-record cases used controlled ports and the actual component callbacks, backed by source traces.
- I did not reproduce the old engine's claimed 104 failing tests or perform a historical regression attribution.
- I did not validate the ongoing `mobility.ts` change or its tests, nor claim its planner/filter behavior is correct. Player branch probes used a controlled plan/persistence port; they establish gate choice and use of an unchanged saved plan, not full production-plan serialization.
- ARCC guidance tooling was unavailable in discovery. This local front-end review used standard data-integrity practices and sent no personal health data to a remote service.

## Release verdict and required retest

**Do not ship the safety engine as the gate for real movement yet.** The tested numerical foundation and independent emergency evaluation should be retained. The 219 passes establish that foundation; they do not cover the identified application transitions.

Before changing this verdict, the following cases must fail closed through the actual UI and persisted state:

1. Save `140` at 09:00, wait to 09:31, change another answer and resubmit without a new measurement. The reading must retain 09:00 and an insulin user must remain held. A same-measurement unit correction must not create an earlier low.
2. Resume with required glucose missing/stale, or no current check-in and recent eye treatment. Hold correctly. Check at physical Start and restart; stop on a newly reported emergency while the route stays mounted.
3. Introduce a retained `50 mg/dL` while a sheet is open on an old normal record. Its displayed permission, button state and saved complete record must all say today. Force the emergency save to fail; the answer/draft and clinical refusal must survive closing/reopening until acknowledged or explicitly corrected.
4. Restore a saved walk with emergency refusal. Recover progress but never transition to running. Apply the same check to Resume and automatic return.
5. Resume an archived standing plan after an active foot wound or new eye restriction. No prohibited step may execute. Resume Stretch with stretch permission and its restrictions.
6. Report a low inside the player. No movement before the timed usable recheck and confirmation; persistent level 1 at the first 15-minute recheck ends the attempt; level 2/3 directs contact today. A missing old timestamp must not prove elapsed time.
7. Save severe BP first and its properly timed severe repeat separately. Contact today. A lower later entry cannot silently erase that unresolved obligation. A partially entered severe component must expose emergency symptom capture without forcing a repeat first.
8. Replace a reliable `600 mg/dL` or ketones `3.0` with a normal entry absent correction/assessment. Preserve the unresolved help action. Confirm a genuine high mmol/L reading and obtain the same extreme disposition as its mg/dL equivalent.
9. Record SGLT2 use without diabetes and blood ketones `3.0`; obtain emergency refusal. Respect a nonrenal prescribed fluid limit.
10. Report distal spread or a red flag at a player checkpoint. Stop the provoking work now and choose the correct higher-priority pathway, with no pain-number clearance.

Rerun the contract/unit tests after these fixes, then execute the real-browser acceptance safety families required by BOARD D34. A separate device pass remains necessary for iPhone behavior. No new clinical numerical gate, insulin dose or medicine change is required to repair these failures.

Release verdict: **do not ship** until the listed fixes and acceptance checks pass.
