# Track re-check, round 3

Reviewed on 8 October 2026. Source and existing tests were read only. This report is the only file added.

The requested fixes substantially improve immediate guidance and counting, but a saved correction of a check-in BP reading still fails to reach the movement gates. Track can show 190/80 and advise against exercise while the effective check-in remains 130/80 and the shared Start gate allows walking. That is the release blocker. Opening the new BP time picker also changes an acquisition timestamp without an edit, allowing a 30-second pair to count as a completed one-minute sitting.

## Verification and limits

Executed **396 existing test cases in 20 files, all passing**, using the read-only, in-memory TypeScript runner and the existing assertion library. The runner exercised the actual modules and test bodies. It was not a native Vitest CLI run.

| Area | Existing files executed | Passing cases |
| --- | --- | ---: |
| Track | `units.test.ts`, `records.test.ts`, `periods.test.ts`, `timeline.test.ts`, `params.test.ts`, `saving.test.ts`, `plausible.test.ts`, `targets.test.ts`, `Guidance.test.ts`, `logKinds.test.ts`, `format.test.ts`, `metrics.test.ts`, `backLegSeries.test.ts`, `movement.test.ts`, `escalation.test.ts` | 224 |
| Health | `cadence.test.ts`, `cadence.node.test.ts`, `aggregate.test.ts`, `review.test.ts` | 127 |
| Workout | `model.test.ts` | 45 |

Additional probes exercised the real correction component callbacks, the public store with fake IndexedDB and a subsequent database reload, and the actual Track UI in Chromium at 430 × 932, light, with the device timezone set to Asia/Kolkata. The browser used isolated synthetic data. A watch-free Vite server used only port 5241, with its generated dependency cache outside the repository.

Browser checks included a delayed transaction acknowledgment, an injected `QuotaExceededError`, retry and a physical double tap on Retry, the historical-reading questions, a check-in BP correction, and opening the first BP acquisition-time picker. Holding IndexedDB's completion callback simulated a slow acknowledgment, rather than proving that the underlying transaction remained uncommitted.

The source discrepancy was also checked against the actual shared Start gate and `effectiveCheckIns`. This was a trace of Track's data reaching those APIs, rather than a new audit of the safety engine's clinical rules.

## Claimed fixes

| Claim | Result | Evidence and result |
| --- | --- | --- |
| **F01, guidance appears when a new save starts** | **CONFIRMED** | `src/screens/track/saving.ts:34` starts `write()` and calls `show(pending)` without awaiting it. Glucose uses this path at `QuickLog.tsx:254`; BP uses it at `QuickLog.tsx:470`, after judging both readings at lines 446 to 448. `saving.test.ts:8` tests an unresolved write. `Guidance.test.ts:12` tests emergency guidance on the first pending frame. In Chromium, saving 600 mg/dL showed the emergency action and “Saving on this device…” while the transaction acknowledgment was held. |
| **F01, accurate saving, saved and refused states, with Retry** | **CONFIRMED for the status transitions; PARTIAL for the retry journey** | `saving.ts:25` defines the new-reading words; `Guidance.tsx:51` settles the pending promise and `Guidance.tsx:75` renders its status. `saving.test.ts:16`, `:30` and `:36` cover refusal, wording and rejected promises. Chromium showed “Saved on this device” after acknowledgment, and “Not saved: There is not enough space on this device to save that…” with “Try saving again” after an injected quota refusal. Retrying persisted one record. A fast double tap on Retry also closed the emergency guidance, T3-05. |
| **F01, corrections use the same immediate-guidance path and BP halves use one `putBloodPressure` call** | **PARTIAL** | Glucose correction uses `saveWithGuidance` at `EditSheets.tsx:144`. BP correction calls `putBloodPressure` once at `EditSheets.tsx:257` and shows guidance through `saveWithGuidance` at `:273`. Correction words are defined at `saving.ts:26`. Chromium showed “Corrected on this device” and the 190/80 guidance. Both observation halves were corrected together and retained their identities. However, the raw and effective check-in were not corrected, T3-01; unknown acquisition-time metadata was lost, T3-03. Atomic observation writes alone do not make this correction safe. |
| **F01, guidance scrolls into view and receives focus** | **CONFIRMED for the guidance alert container** | `Guidance.tsx:64` scrolls its top ref into view and focuses it with `preventScroll`. The ref is on the `role="alert"`, `tabIndex={-1}` container at `:82`, which contains the figure and clinical guidance. The browser's active element was that alert during the pending 600 mg/dL save. The separate sheet heading is not the element receiving focus. |
| **R03, earlier extreme glucose or severe BP needs the clinician question before review** | **CONFIRMED** | `escalation.ts:190` identifies readings needing this second question. `guidanceView` at `:274` keeps the help action while either question is open; only an assessed answer selects the review path at `earlierEscalation`, `:206`. `Guidance.tsx:103` and `:104` capture the two answers. `escalation.test.ts:176`, `:183`, `:191` and `:198`, plus `Guidance.test.ts:20` and `:27`, cover these paths. In Chromium, historical 600 followed by “No, it was earlier” displayed the clinician question while retaining emergency help; “No, not yet” retained the full emergency and no-exercise instructions. |
| **R03, a passed low keeps F03 review without a second question** | **CONFIRMED** | The historical-low path at `escalation.ts:227` and the question-selection test at `escalation.test.ts:198` distinguish it from extreme glucose and BP. Chromium, historical 53 mg/dL followed by “No, it was earlier”, showed “That was a serious low.” and care-team review, without the clinician-assessment question or an unconditional instruction to consume carbohydrate now. |
| **F24, all interpretation notes use the shared ordering for tied results** | **CONFIRMED** | `metrics.ts:410` filters point-in-time observations, sorts with `compareObservations` and selects the last. `MetricDetail.tsx:362` uses this helper for the actual panel. `metrics.test.ts:235` verifies tied HbA1c values in both input orders. Additional probes covered HbA1c, B12, vitamin D and weight/BMI using equal instants encoded as `12:00+05:30` and `06:30Z`, with commit sequences 3 and 4, in both array orders. Every interpretation selected sequence 4: 9% against an 8% clinician goal, B12 400 pg/mL, vitamin D 40 ng/mL and BMI 29.3 for 90 kg at 175 cm. |
| **R01, hand-entered active minutes stay unplaced on the recorded day, without overlap exclusion** | **CONFIRMED** | `movement.ts:92` refuses to fabricate an interval for a non-guided workout. `enteredTotal` at `:112` reads its entered active duration, and `recordedMovement` at `:214` selects it by `session.date`. It adds these minutes outside the placed-interval overlap calculation at `:231`. `movement.test.ts:117` verifies a five-minute entered workout spanning four hours plus a measured three-minute walk: total eight, entered five, no overlap exclusion, no manual interval, and nothing credited on another recorded day. |
| **R01, `mayRepeat` and My Day's active-time-only row** | **CONFIRMED in the helper and render path** | `movement.ts:223` sets `mayRepeat` when an entered workout's recorded span intersects contributed measured movement. `MyDay.tsx:201` reads it and `:295` renders the warning that entered minutes might include the recorded walk or session. `timeline.ts:221` and `:230` use `durationSeconds` for the row, without falling back to elapsed time between start and finish. The existing movement and timeline tests passed. The complete My Day DOM journey was not repeated before the probe process exited. |
| **F23 form, first timestamp captured on Add second, second timestamp captured on Save** | **PARTIAL** | `QuickLog.tsx:425` captures `firstEntered` on “Add a second reading”. `repeatTimes` at `logKinds.ts:244` preserves it when untouched and resolves the second reading at Save. `logKinds.test.ts:144`, `:151`, `:155` and `:160` cover captured times, a short interval, typed times across midnight, and invalid or future times. However, merely opening the captured first time changes it to minute precision and removes the wait guide, T3-02. |
| **F23 form, one-minute guide, countdown announced once, typed times retained, atomic pair save** | **CONFIRMED in the normal untouched path; PARTIAL overall** | `RepeatWait` at `QuickLog.tsx:391` derives the wait from the first timestamp. The changing count is `aria-hidden` at `:401`; the polite region at `:402` is empty until the single ready message. `repeatTimes` keeps explicitly typed first and second times, rather than synthesising spacing. `QuickLog.tsx:454` constructs both pairs and `:463` sends all four halves through one `addObservations` call. The Chromium picker probe saved two distinct complete pairs in one operation. The picker regression defeats the interval's accuracy, T3-02. The actual spoken announcement was not checked with VoiceOver. |
| **Workout's active-time test updated for R01** | **CONFIRMED** | `src/screens/workout/model.test.ts:330` now asserts entered active time as an unplaced contribution; the reload case follows at `:344`. All 45 model cases passed. The serializer at `model.ts:660` stores entered minutes as seconds and does not substitute the wall-clock span when that field is empty. |

## New findings

### T3-01, a corrected check-in BP reading does not reach the movement gate

**Severity: wrong advice, safety blocker.**

**Location:** `src/screens/track/EditSheets.tsx:257`; `src/store/useStore.ts:862` and `:890`; `src/hooks/useGuided.ts:70`; `src/screens/track/RecordDetails.tsx:245`.

**Reproduction:**

1. Use a reviewed type-2, metformin-only profile with treated hypertension, a home BP monitor and reviewed medicine answers.
2. Save today's normal check-in with no emergency symptoms or news, glucose 140 mg/dL measured now, and a single BP acquisition of 130/80 measured now. Its `bp` summary and `bpReadings[0]` both contain 130/80. The Walk Start gate allows movement.
3. Open that reading through Track's BP detail, choose “Correct this”, change systolic to 190 and save.
4. Answer “Yes, just now” in correction guidance. It displays “Corrected on this device”, 190/80, and “Do not exercise until you have spoken to your doctor.”
5. Inspect the saved record and call the shared Start gate using the effective check-in, exactly as a movement caller obtains it.

**Actual:** the paired Track observation is 190/80, but both the durable check-in acquisition and the acquisition returned by `effectiveCheckIns` remain 130/80. The shared gate still returns `allowed: true`, `needsCheckIn: false`, with only the BP cool-down adjustment. Substituting 190/80 into the same gate input returns `allowed: false`, disposition `hold`.

This was reproduced through the actual Chromium correction UI, and independently through the actual correction component and public store followed by a fake-IndexedDB reload. The discrepancy survives persistence.

**Expected:** a correction accepted as the current acquisition must reach the effective clinical input. A current single 190/80 acquisition without associated emergency symptoms must refuse starting movement, even after the guidance sheet is dismissed.

**Cause:** `putBloodPressure` changes the observation collection but not the corresponding check-in acquisition. `useGuided` constructs effective check-ins from the check-in records and pending answers, not from corrected observations. The detail screen and the gate therefore read different clinical facts.

**Suggested fix:** make correction of a check-in acquisition a coordinated operation that updates the corresponding clinical input and both observation halves. Preserve acquisition identity and the explicit handling of retained serious episodes. A genuine earlier high must not silently disappear when a later reading is entered. Add a regression that saves through the real correction path, reloads, and checks both the displayed BP and the shared Start/live gate inputs.

### T3-02, opening the first-time picker invents spacing and falsely completes the BP sitting

**Severity: wrong data and wrong advice.**

**Location:** `src/screens/track/QuickLog.tsx:502` and `:510`; `src/screens/track/logKinds.ts:248`; `src/health/cadence.ts:163`.

**Reproduction, exercised in Chromium with a fixed browser clock:**

1. At `2026-10-08T07:42:30+05:30`, enter first BP 130/80 and tap “Add a second reading”. The captured timestamp is 07:42:30.
2. Tap “First reading’s time” to inspect it. Do not change the picker value.
3. Enter second BP 132/82 and tap Save at 07:43:00.

**Actual:** opening the row sets the form's explicit time to `2026-10-08T07:42`. The wait guide disappears. The saved pairs are stamped 07:42:00 and 07:43:00, so an actual 30-second interval becomes 60 seconds.

The resulting cadence item says:

> Two more readings this evening, a minute apart.

With the real first timestamp retained, the same cadence helper instead says:

> Your two readings this morning were less than a minute apart. Take one more, a minute after the last, then two this evening.

**Expected:** inspecting a captured time must preserve its seconds and must not turn viewing the picker into a new acquisition-time statement. The 30-second sitting must remain incomplete.

**Cause:** opening the row writes `toLocalInput(firstEntered)` into `time`. That minute-precision value takes priority over the captured timestamp in `repeatTimes`. The wait guide is conditional on `time === undefined`.

**Suggested fix:** separate opening the picker from editing the timestamp. Preserve `firstEntered` unless the user actually changes the input. Keep the guide tied to the captured acquisition when its time is still untouched. Test the actual PressureForm transition, rather than only `repeatTimes` with preconstructed arguments, at 30-second and 59-second boundaries.

### T3-03, a value-only BP correction fabricates a clock time for an older check-in

**Severity: wrong data.**

**Location:** `src/screens/track/EditSheets.tsx:257`; `src/store/useStore.ts:876` and `:885`; `src/health/observation.ts:395`; `src/screens/track/RecordDetails.tsx:276`.

**Reproduction:**

1. Start with a legacy check-in that has `bp: { sys: 130, dia: 80 }` but no acquisition timestamp.
2. Its lifted BP observations have `timeUnknown: true`. Their date-preserving noon timestamp is a storage anchor. The detail screen correctly shows “Time: Not recorded”.
3. Correct only systolic to 135 through the actual BP correction form, without editing time, and reload the store.

**Actual:** both original observation identities and their noon anchor are retained, but `timeUnknown` is absent on both rebuilt halves. The detail screen now presents 12:00 as a recorded measurement time.

**Expected:** a numeric correction preserves the fact that acquisition time was not recorded. The UI must continue to show “Not recorded”.

**Cause:** the new atomic BP upsert rebuilds existing halves with `newObservation`; its shared input omits the prior `timeUnknown` metadata. `newObservation` preserves that flag only when explicitly supplied.

**Suggested fix:** preserve each existing half's metadata during a correction, including `timeUnknown`. Clear the flag only when a real acquisition time is explicitly provided through an allowed time-edit path. Add a value-only correction and reload test for a legacy unknown-time pair.

### T3-04, clearing a BP timing tag does not persist

**Severity: wrong data.**

**Location:** `src/screens/track/EditSheets.tsx:220`, `:260` and `:298`; `src/store/useStore.ts:874`.

**Reproduction:**

1. Save a standalone manual BP reading tagged `morning`.
2. Open its correction sheet and toggle off the selected Morning chip, leaving neither timing category selected.
3. Save the correction and reload.

**Actual:** the form clears its selection, but the stored reading still has `tag: 'morning'`. This was reproduced through the real form callback and public store. The edit form omits an unset tag; `putBloodPressure` interprets omission as “keep the previous tag”.

**Expected:** explicitly clearing the category must clear it on both halves. A later display or cadence grouping must not continue to use the category the user removed.

**Suggested fix:** distinguish unchanged, set and cleared tag values in the BP upsert API, consistent with the existing observation patch convention. For example, use `undefined` for unchanged and `null` for clear, and submit the explicit clear from a rewritable standalone BP form. Preserve the check-in timing category on paths that intentionally cannot edit it.

### T3-05, a fast double tap on Retry dismisses emergency guidance

**Severity: broken journey.**

**Location:** `src/screens/track/Guidance.tsx:69`, `:123` and `:124`.

**Reproduction, observed in Chromium:**

1. Enter 600 mg/dL.
2. Inject a quota refusal for observation writes. The emergency guidance shows the failed status and “Try saving again”.
3. Restore writing and physically double-click “Try saving again” with 20 ms between taps.

**Actual:** one record is persisted and the save status settles successfully, but the guidance dialog subsequently closes and the app returns to Track. The user did not separately choose Done. There was no duplicate persisted record in this probe.

The retry control is removed as soon as its state changes away from `failed`, while Done remains below it. The controls therefore change during the two-tap gesture. The probe establishes the unintended dismissal; it did not record a pointer-event trace identifying the recipient of each tap.

**Expected:** two taps intended for Retry must not dismiss the clinical help. Retrying storage should leave the guidance present until the user deliberately closes it.

**Suggested fix:** retain the retry control's layout position with an appropriate disabled or saving state, and keep Done from moving into its touch position during the gesture. Add a browser regression with an immediately successful retry and a rapid second tap. Continue to show urgent instructions throughout.

## Checked and correct

- Emergency guidance no longer waits for successful persistence. A refused write retained the help action and exposed the reason and retry control.
- The actual guidance alert received focus during the pending-save browser check. Its document and dialog had no horizontal overflow at the tested 430 px width.
- BP correction makes one public store call for both complete halves. The saved pair retained its identities and corrected numeric values. The remaining issues are clinical-input coordination and omitted metadata, rather than a demonstrated split numeric write.
- The existing unit-conversion, plausibility, target and correction-offset tests passed. The ordering probe also used different offset encodings of the same instant, rather than only identical timestamp strings.
- The tied interpretation result matched the shared commit ordering for all four requested metrics and both input orders.
- Hand-entered workout minutes are no longer disguised as an observed interval or reduced by the interval overlap rule. The existing regression retains the measured walk and exposes possible repetition.
- The BP cadence helper correctly rejects real intervals shorter than one minute. The new failure is the form changing the timestamp before that helper receives it.
- Explicitly typed repeat timestamps, including the midnight case, passed their existing tests. The normal Save path supplies both BP pairs to one batch operation.

## Uncompleted checks and environment limits

- Fresh command launches failed with `sandbox-exec: sandbox_apply: Operation not permitted`, exit 71. No escalation or approval was requested. A later attempt to launch a separate JavaScript kernel failed with the same sandbox error.
- The existing in-memory probe process subsequently exited after an unhandled browser-locator timeout. The Vite server was running inside that process, so its listening socket terminated with the process. A fresh connection check and orderly browser-close verification were unavailable after the launch failures. No other application's port was used or stopped.
- A physical Walk Start journey could not be completed because that separately edited route failed to import `creditSteps` from `src/walk/clock.ts`. This is recorded as an outside-Track integration limit, not a Track finding. The actual effective-check-in and shared-gate calls described in T3-01 were completed before that navigation.
- The 320 × 568 DOM checks, dark-mode checks, enlarged-text layout checks, complete My Day browser journey and an alternate-timezone browser journey were not completed before the process exited. Existing timezone and offset tests passed, but they do not establish those UI results.
- A deliberately refused write halfway through the new BP correction transaction was not separately driven. Immediate guidance on refusal was verified for glucose; BP atomicity was traced through the shared batch path and successful correction.
- VoiceOver announcements, WebKit's native datetime picker, keyboard layout and an installed iPhone PWA need a device check. Chromium and source inspection do not establish their behavior.
- `npm run build` was not run. No finding here attributes other agents' in-progress test or route failures to Track.

**Verdict: do not ship.**
