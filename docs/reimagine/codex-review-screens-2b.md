# Screens re-check, part 2

Reviewed on 8 October 2026. **Walk should not ship yet.** Its gates now distinguish starting, restarting and continuing correctly, including refused emergency saves and emergencies crossing midnight. However, tapping **I feel low** never reports that symptom to those gates. A subsequent walk can therefore start against the reading taken before the symptom. There are also reproducible failures in walk save retries, midnight step allocation, restore controls and the profile weight-unit selector.

You and Welcome should ship after the listed control and unit fixes. Reminders should ship after the clock-boundary fix. The two changes explicitly permitted to remain pending, banner placement/auto-hide and complete backup revision coverage, are listed separately.

## Scope and evidence

This is a re-check of the requested findings in [the original screen audit](codex-review-screens.md), the Walk callers for B03/B04 and wizard B08 in [the safety audit](codex-safety-reaudit-3.md), and the reminder consumers for R03 in [the content re-check](codex-review-content-2.md). Context is [BOARD](BOARD.md), [BUILD-BRIEF](BUILD-BRIEF.md) and [the acceptance suite](codex-acceptance.md), particularly D8, D10, D13, D16, D17, D18, D25, D30, D34 and D35.

Source review covered Walk, its measurement and persistence modules, You, Welcome, Reminders and the relevant wizard and shared movement-total helpers. The shared check-in and gate paths were traced where necessary to establish what their Walk callers actually send and read. This is not another audit of the Guide's clinical claims or the entire safety engine.

Executed **460 existing cases across 30 test files, all passing**, through an in-memory runner using the installed TypeScript compiler and Chai/Vitest assertion plugins. This was not a native Vitest CLI run.

| Test group | Files | Cases |
| --- | ---: | ---: |
| `src/walk/` | 11 | 198 |
| `src/reminders/` | 10 | 137 |
| `src/screens/you/` | 6 | 57 |
| Welcome flow | 1 | 22 |
| Profile wizard helpers | 1 | 30 |
| Shared Track movement accounting, bounded to F17/F18 | 1 | 16 |
| Total | 30 | 460 |

Additional probes executed the actual controller, producer/consumer helpers and component handlers with synthetic records, controlled React hook state, clocks, sensor callbacks and deferred store promises. Store-write probes used the real public store API backed by the repository's fake IndexedDB, entirely in memory. Component probes establish callback and rendered-prop behaviour, not browser layout, focus or native API delivery.

Backup revision interfaces and tests changed during the review. The latest `BackupSheet` callback was re-probed after that change, and the refreshed revision, backup-settings and durable You-write tests passed. Earlier observation-sequence-only backup results are superseded. Complete revision coverage remains an explicitly permitted pending item.

**NEW PROBLEM means newly identified in this re-check.** It does not assert which commit introduced a defect unless the relevant replacement path is identified below.

## Findings ledger

### Walk and the B03/B04 callers

| Finding | Result | Test and code path traced |
| --- | --- | --- |
| **F08, refused walk draft writes** | **FIXED.** A refused sessionStorage update is visible in Live and Summary, latest progress remains in page memory, and later ticks retry. This fixes the silent failure; it cannot make a rejected write survive reload. | `src/walk/live.test.ts:1055`, “says so as soon as a write is refused”; `:1084`, no storage. `src/walk/live.ts:229` propagates the result; `:455` retries on ticks. `src/walk/persist.ts:152` checks whether the latest draft is durable. `src/screens/walk/WalkSummary.tsx:42`, `:64` and `src/screens/walk/LiveWalkScreen.tsx:175` expose the warning. The actual summary probe rendered “This phone would not store this unsaved walk, so a reload would lose it. Save it now.” |
| **F09, recovery/discard after a partial save** | **FIXED for the original reload/discard trigger.** Save discovers existing IDs, and Discard discovers records by context rather than trusting the draft's saved list. **N02 is a new failure in the replacement retry helper**, so complete walk-save correctness is not approved. | `src/walk/record.test.ts:202`, whole batch; `:211`, failed batch and retry; `:224`, complete an older partial save; `:235`, one conflict; `:245`, context discovery. `src/screens/walk/WalkSummary.tsx:78` reads fresh store IDs, `:79` uses `addObservations`, and `:92` uses `removeObservations(walkObservationIds(...))`. `src/walk/record.ts:242` finds all records belonging to the walk. |
| **F15, distance bridging a GPS outage** | **FIXED.** A stale signal begins another run without crediting the jump between the last old fix and the first new fix. | `src/walk/gps.test.ts:179`, silence and reacquisition; `:194`, separate runs; `:213`, pace warming up again. `src/walk/gps.ts:322` detects the stale gap and starts from the new fix. `src/walk/record.ts:165` emits distance separately for each measured run. |
| **F16, summary pace versus saved pace** | **FIXED.** Both use the distance and the time GPS actually measured. Manual or incomplete distance intervals do not acquire a fabricated pace. | `src/walk/record.test.ts:264` verifies five minutes of walking, four minutes of GPS and 500 m produce **480 seconds/km** in both representations. `:282` and `:291` omit an unusable basis. `src/walk/record.ts:77` derives summary pace from measured runs; `:165` stores their coverage; `:307` reconstructs saved pace from those intervals. |
| **F17, midnight and week allocation** | **STILL BROKEN overall.** The original minute-allocation case is fixed, including manually added gap time. Sensor callbacks before the next clock tick can still put steps on the previous day. See **N03**. | `src/walk/record.test.ts:328` verifies Sunday one minute/Monday two; `:347` splits manual gap time; `:336` preserves genuinely undivided metrics without guessing. `src/walk/live.test.ts:1093` verifies the time split, but supplies no motion callback between midnight and the next timer. `src/walk/live.ts:295` updates the open segment without first splitting midnight; `:451` performs that split only when the tick arrives. |
| **F18, multiple intervals from one walk omitted** | **FIXED.** Distinct segments count independently, while matching duration/movement counterparts count once. | `src/screens/track/movement.test.ts:97` covers several segments with one context. `src/screens/track/movement.ts:158` deduplicates by interval identity at `:162` and `:169`, then clips at `:193`; `:205` totals the retained intervals. The actual Walk producer feeding this consumer returned **five minutes** for two-minute and three-minute segments, including when only the first segment had a stored movement counterpart. |
| **F34, a late wake-lock grant held after leaving** | **FIXED at the ownership layer.** A stale grant is released, and an older request cannot release a newer lock. Native iPhone wake-lock delivery remains a device check. | `src/walk/wakeLock.test.ts:33`, late grant; `:44`, overlapping ownership; all six cases passed. `src/walk/wakeLock.ts:33` tracks request generations, `:46` releases obsolete grants and `:60` invalidates ownership on release. `src/walk/browser.ts:112` uses this port; `src/walk/live.ts:545` releases it on detach. |
| **Safety B03, restart question and reactive live gate** | **FIXED for the requested gate semantics.** New Start, restored attachment, Resume and return from hidden use starting/restarting requirements. Recording uses the live question and reacts to changed clinical inputs. Age alone does not stop an uninterrupted walk. **N06 is the missing UI route to answer a restart hold.** | `src/walk/gate.test.ts:91`, missing check-in; `:99`, insulin freshness at 30 versus 31 minutes. `src/walk/gate.ts:40` maps live to `liveGate`, Start to `startGate`, restart to `arrivalGate`. `src/walk/live.ts:506`, `:519`, `:571` and `:481` gate transitions into recording; `:389` reacts to clinical changes and `:455` rechecks while recording. `src/walk/browser.ts:146` wires the real gate and subscription. |
| **Safety B04, effective answers and midnight emergency** | **FIXED for inputs reaching the shared check-in path.** Both the screen and controller read stored plus refused-save answers, across all days. A 23:59 unresolved emergency still refuses live/restart at 00:01 without a new-day check-in. **N01 is a separate action that never creates that clinical input.** | `src/walk/gate.test.ts:146`, refused emergency; `:158`, refused late emergency; `:180`, both subscriptions. `src/walk/live.test.ts:977`, immediate pause; `:996`, stored emergency at midnight; `:1016`, refused emergency at midnight. `src/hooks/useGuided.ts:68` subscribes to pending answers and returns effective `checkIns` at `:94`; `src/screens/walk/LiveWalkScreen.tsx:104` consumes them. `src/walk/gate.ts:65` uses `effectiveCheckIns`, `:83` subscribes to store and pending changes, and `:53` passes every day's records as `recent`. |

The B03/B04 probe also used the real store/pending subscriptions rather than only the gate test's controlled subscription port. An insulin user started at 23:58 with `140 mg/dL`. At 23:59 the real check-in save path received chest pain and returned a quota failure. The controller immediately became `paused`, `blocked='live'`, retaining exactly 60,000 observed milliseconds. At 00:01 there was no check-in for the new day, yet both live and restart still returned emergency, and Resume remained refused.

### You and Welcome

| Finding | Result | Test and code path traced |
| --- | --- | --- |
| **F07, lost profile answers on a refused save** | **FIXED.** The wizard stays mounted and busy while saving, then retains its answers and displays the refusal. It closes only on acknowledgment. | `src/screens/you/write.test.ts:163`, “reports a failed write and stores nothing of it”. `src/screens/you/ProfileScreen.tsx:47` prevents closing while saving; `:51` awaits the write; `:57` keeps the editor open on failure. The actual callback probe retained the cover both while pending and after “That did not save. Storage full”. `src/screens/welcome/HealthStep.tsx:27` follows the same acknowledgment ordering. |
| **F11, prepared backup falsely covering later records** | **FIXED in the current screen path.** A changed record invalidates the prepared file; late preparation cannot replace its newer generation. Delivery records the file snapshot's time and revision. Complete revision coverage is the separate permitted F27 work. | `src/screens/you/DataSheets.tsx:60` tracks every backed-up collection/profile/settings identity; `:67` cancels obsolete preparation; `:83` disables stale delivery; `:94` records `exportedAt` and `revision`. `src/screens/you/write.test.ts:50`, snapshot mark; `:57`, no borrowed old revision. `src/screens/you/backupFile.test.ts:8`, backup metadata does not stale its own file. The refreshed component probe ignored the late zero-reading file, delivered the one-reading file, and recorded its **09:02 snapshot/revision 41**, rather than delivery time. |
| **F12, competing restore selections** | **STILL BROKEN.** Late file A no longer replaces newer file B. But closing the sheet during import resets the state that blocks new selections; a later completion can overwrite another file's preview. See **N04**. | `src/screens/you/latest.test.ts:5` and `:14` passed. `src/screens/you/RestoreFlow.tsx:65` gives reads tokens and `:69`/`:73` ignore stale success/error. The actual A/B callback probe kept B after A completed. However `:104` closes unconditionally and `:55` blocks selection only while the visible stage remains `importing`. |
| **F28, programme start-date edit dropped** | **FIXED.** An about/all programme edit persists the submitted date; a health-only edit cannot reset it. | `src/screens/you/write.test.ts:148`, changed programme date; `:157`, an edit that did not ask the date. `src/screens/you/ProfileScreen.tsx:39` decides whether the flow asks the date; `:55` passes that decision. `src/screens/you/write.ts:68` writes `result.startDate` only when asked. |
| **F29, implicit enrolment and absent Join/Leave** | **FIXED in You and Welcome.** Canonical membership is start date plus training days, independent of Focus. Explicit Join/Leave retain history, wait for acknowledgment and preserve failed join answers. | `src/screens/you/write.test.ts:178`, Join; `:189`, Focus does not enrol; `:198`, Leave retains history. `src/screens/welcome/welcome.test.ts:43`, non-strength onboarding stays out. `src/screens/you/FocusScreen.tsx:35` calls canonical `isEnrolled`; `:37`/`:48` await Join/Leave; `:79`/`:85` provide the actions. `src/screens/you/write.ts:74` and `:79` use shared `withJoined`/`withLeft`. `src/screens/welcome/assemble.ts:51` keeps non-strength start dates empty. Actual refused Join retained its wizard and error. This re-check does not repeat the Move review completed in part 2a. |
| **F30, Explore first forced health questions** | **FIXED.** Explore completes Focus and Keep without inventing a profile or programme membership. Movement still needs the relevant safety setup. | `src/screens/welcome/welcome.test.ts:158`, flow order; `:167`, unanswered health; `:179`, direct-step guards. `src/screens/welcome/assemble.ts:64` allows Explore completion without a profile, `:87` skips Health and `:112` redirects an irrelevant direct Health link. The actual Focus/Keep handlers reached `/welcome/keep`, stored `onboardingComplete=true`, retained no profile and an empty start date, and movement remained refused for health review. |

### Reminders and wizard B08

| Finding | Result | Test and code path traced |
| --- | --- | --- |
| **F02, a queued water banner survives contraindication** | **FIXED.** Profile, habit, Status and intake changes immediately filter rendering and prune pending entries and badge contributions. Water records themselves survive. | `src/reminders/schedule.test.ts:333`, Status/banners; `:347`, fluid Yes/Not sure; `:355`, goal met. `src/reminders/ReminderHost.tsx:44` reads current context, `:76` filters before effects, `:78` prunes and `:125` updates the badge. Actual host probes removed the water banner before effects for fluid Yes, Not sure, disabled banners, disabled habit and goal met; pending and badge became zero. The entered water record remained present in the goal-met case. Away, Unwell and Flare also removed it. |
| **F26, unsafe catch-up after suspension** | **FIXED for the original catch-up cases.** Eligibility is evaluated against the actual return time/day before emission. **N07 is a residual display-clock boundary issue for an already visible banner.** | `src/reminders/schedule.test.ts:370`, resumed inside quiet hours; `:376`, yesterday's prompt on today's paused Status; `:382`, old prompt on a Normal new day. `src/reminders/schedule.ts:181` checks current eligibility; `:257` filters catch-up. `src/reminders/runner.ts:54` uses current wall time; `src/reminders/ReminderHost.tsx:97` checks on return. Actual 09:55/10:01 and 23:55/00:02 scheduler probes emitted nothing. |
| **F27, backdated data not counted by backup reminders** | **FIXED in the newly landed, retested revision scenarios; complete coverage remains pending as permitted.** Event dates no longer decide freshness when the backup/current revisions are available. Profile and settings changes now have passing store-backed cases. No full-store revision certification is implied. | `src/reminders/backup.test.ts:85`, changed revision despite old dates; `:90`, backup metadata itself is not new data; `:100`, a foreign database's watermark; `:107`, legacy fallback. `src/screens/you/write.test.ts:64` exports, records its mark, then changes the profile through the real fake-IDB store; the nudge becomes due. `:81` covers settings. `src/reminders/backup.ts:59` accepts the current revision and `:79` compares it; `src/screens/you/DataScreen.tsx:40` supplies `state.revision`; `src/screens/you/DataSheets.tsx:94` stamps the file snapshot revision. |
| **Content R03, movement reminder precautions** | **FIXED at the requested consumer boundary.** Existing standing/walking habits produce no new prompts or calendar events with an active foot wound/Charcot profile. Pending movement prompts disappear when that profile changes. For insulin/secretagogue users, both banner and calendar note carry the Guide's care-plan checks and fast sugar precaution. | `src/reminders/advice.test.ts:15` and `:29`; `src/reminders/schedule.test.ts:400` and `:405`; `src/reminders/ics.test.ts:243`. `src/reminders/advice.ts:17` consumes `habitAdvice`; `:49` checks whether offered; `:63` returns precautions. `src/reminders/schedule.ts:125` filters movement habits; `src/reminders/ics.ts:126` shares that schedule and `:135` adds the precautions. `src/reminders/ReminderHost.tsx:152` passes them to the banner. Actual foot-wound probes produced no standing/walking times or events and removed two already pending prompts; insulin and secretagogue calendar notes both contained the glucose checks and sugar precaution. |
| **Wizard B08, non-diabetic SGLT2 and relevant BP medicines** | **FIXED.** Untouched default No is visibly unanswered and does not satisfy the required SGLT2 question. Heart/kidney profiles without hypertension also require explicit beta-blocker/diuretic answers. This does not require unrelated insulin questions for non-diabetic users. | `src/components/profile/wizardSteps.test.ts:206`, SGLT2 alone; `:214`, heart/kidney BP questions; `:221`, untouched default; `:229`, reviewed answers. `src/components/profile/wizardSteps.ts:76` uses `bpMedicinesAsked` and always includes non-diabetic SGLT2; `:93` distinguishes unreviewed defaults. `src/components/profile/ProfileWizard.tsx:98` tracks answered questions and `:105` gates completion. Actual heart and separate CKD wizard probes initially disabled Save with all three unanswered, then allowed it after explicit No answers, saving both review flags. **N05 affects the shared wizard's weight input, separately from B08.** |

## Remaining and newly identified problems

### N01. Walk's “I feel low” never becomes a clinical answer

**Classification: NEW PROBLEM. Severity: wrong advice, safety blocker.**

**Location:** `src/screens/walk/LiveWalkScreen.tsx:248`, especially the handler at `:249`; `src/walk/live.ts:589`; `src/walk/record.ts:112`.

**Trigger:**

1. Use a reviewed basal-insulin profile with a meter and a normal check-in containing `140 mg/dL`, measured at 19:00.
2. Start a permitted walk. At 19:05 tap the actual **I feel low** button.
3. Save the ended walk and attempt another walk while the 19:00 reading is still fresh.

**Observed:** The handler calls only `live.finish('low')`. The walk becomes finished with `endedBy='low'`, and its record note describes the ending. Neither stored nor pending effective check-ins receives the low-symptom report. The actual starting gate therefore still permits the next walk against the earlier `140`.

The probe returned:

```text
walk.status = finished
walk.endedBy = low
effective check-in.lowSymptomsAt = absent
new walk start refusal = absent
same input with lowSymptomsAt = 19:05 -> hold
```

**Expected:** Reporting a suspected low must affect movement permission immediately. The earlier normal reading cannot settle symptoms reported five minutes later. The existing receiving path already supports this: `src/types/checkin.ts:272` defines `lowSymptomsAt`; `src/engine/readiness.ts:549` requires a subsequent reading and at `:554` returns a hold with “Check your glucose now and enter the reading.”

**Fix:** Report the low-symptom news item and its timestamp through the shared check-in save/effective-pending path when the button is tapped, before relying on a finished-walk note. Preserve it when persistence is refused. Offer the required follow-up collection and let shared permission decide release. Keep symptom onset and any actual readings distinct; do not fabricate a biochemical low from the button.

**Missing regression:** Actual button tap, summary save and next movement attempt, with both successful and refused clinical saves. `src/walk/live.test.ts:1113` currently checks that `finish('low')` stops/persists the walk, not that the symptom reaches later gates.

### N02. Two consecutive save conflicts return success with distance missing

**Classification: NEW PROBLEM in the replacement F09 helper. Severity: data loss.**

**Location:** `src/walk/record.ts:227` limits retries to two; `:234` returns success unconditionally after exhaustion. `src/screens/walk/WalkSummary.tsx:80` clears the draft on that success.

**Concrete sequence, reproduced with real store APIs and fake IndexedDB:**

1. A finished GPS walk produces stable-ID observations D, M and X: `walkDuration`, `movementMinutes`, `walkDistance`.
2. `saveObservations` discovers none stored.
3. Before its first `addObservations([D,M,X])`, another writer commits `addObservation(D)`. The batch returns conflict D and commits no other record.
4. The helper removes D from the missing list.
5. Before its retry `addObservations([M,X])`, that writer commits `addObservation(M)`. The batch returns conflict M and commits no X.
6. The helper removes M, exhausts its two attempts and returns `{ok:true}` with X still missing.

This models another copy/partial writer completing individual stable-ID records. It does not assume that two normal atomic saves themselves partially commit.

After reloading the fake database, the actual probe found:

```text
save result = {ok:true}
batch attempts = 2
durable kinds = walkDuration, movementMinutes
missing kind = walkDistance
```

**Observed:** Summary treats the operation as saved and clears the remaining walk draft. The unpersisted distance no longer has a recovery source.

**Expected:** Success only when all logical walk records are acknowledged, either previously stored or committed by this operation. Retry exhaustion must retain the draft and present a retryable failure.

**Fix:** If the bounded retry loop exits with `missing.length > 0`, return an explicit conflict/retry result. A fresh store rescan can reconcile already committed IDs before retrying. Never equate exhausting retries with successful persistence.

**Test gap:** `src/walk/record.test.ts:235` covers one intervening conflict and a successful second batch. Add the second-conflict/exhaustion case and assert both the durable set and draft survival.

### N03. Post-midnight motion is appended before the clock splits the day

**Classification: remaining F17 failure. Severity: wrong data.**

**Location:** `src/walk/live.ts:295`, motion callback; `:277`, GPS callback; `:435`, midnight split; `src/walk/record.ts:177`, segment-based step dating.

**Trigger:** Start a step-counted walk on Sunday 11 October at **23:59:50.500**. Feed a clean 2 Hz walking signal at 50 Hz through Monday 00:00:01.500. The observed-time timer's next post-midnight tick lands at **00:00:00.500**. A detected peak at **00:00:00.160** commits at **00:00:00.300**, before that tick.

**Observed:** `onSample` appends it to the still-open Sunday segment. Only the later tick closes that segment at midnight. Both the real controller and instrumented detector agreed on the total of 20 steps, but the per-day allocation differed:

| Basis | Sunday | Monday |
| --- | ---: | ---: |
| Detector peak timestamps | 17 | 3 |
| Actual walk segments, subsequently saved | 18 | 2 |

The previous peak was at 23:59:59.660 and committed at 23:59:59.800, so this is not merely a pre-midnight step being confirmed later. The wrongly assigned peak itself occurred after midnight.

`onFix` has the same delayed-boundary ordering. A separate accepted-fix probe left a GPS run ending at midnight plus 200 ms inside a segment closed at midnight. `walkObservations` then clamps its interval to the segment end. That probe established an interval mismatch, not extra post-midnight metres; the step example establishes the wrong daily number directly.

**Expected:** Measured samples belong to their actual local-day interval, including the sub-second interval before the next timer. Splitting the timer's minutes correctly does not establish correct sensor allocation.

**Fix:** Reconcile midnight before processing sensor callbacks, using their relevant timestamps and preserving the detector's rhythm. If a detector commits a batch whose peaks cross midnight, retain peak timestamps or explicitly preserve an undivided measurement instead of guessing. Do not reset the step detector and silently lose the walking run.

**Test gap:** `src/walk/live.test.ts:1093` starts on a whole second and advances only the clock. Add the half-second timer phase with a motion callback between midnight and the first tick; assert saved day values, not only segment boundaries.

### N04. Closing Restore while committing disables its busy guard

**Classification: remaining F12 failure. Severity: broken journey.**

**Location:** `src/screens/you/RestoreFlow.tsx:55`, selection guard; `:79`, asynchronous import; `:104`, unconditional close; `:112`, sheet close callback.

**Trigger:**

1. Preview backup B and choose Replace, confirming where required.
2. Hold `importRecord(B)` pending.
3. Close the sheet through its `onOpenChange(false)` path.
4. Choose backup C. Its preview appears.
5. Complete B's import successfully.

**Observed in the refreshed actual component probe:** The import request was for B, C's preview became visible while it was pending, and B's completion replaced that preview with **“Restored. This iPhone now holds what the backup held.”** The sheet can reappear after the user closed it.

`pick` guards only `stage.kind === 'importing'`. `close` changes that stage to `idle` while the write remains active, and the completion unconditionally sets `done`. The latest-read tokens correctly protect decode ordering but do not own the active import.

**Expected:** Closing a sheet must not cancel the busy ownership of an import that is still committing, admit a competing restore, or let an old completion commandeer a newer preview.

**Fix:** Track import ownership/busy state independently of whether the sheet is visible, and fence competing selections until acknowledgment. Either prevent closing while committing or preserve a separate visible/hidden state without releasing the import guard. Give completion an operation token and retire pending read tokens when cancelling a read.

**Missing regression:** Actual close callback during a deferred import, followed by another selection. Keep the existing latest-read tests; they cover a different race. This finding does not allege a partial IndexedDB import.

### N05. Changing kg to lb saves a different physical body weight

**Classification: NEW PROBLEM, introduction not established. Severity: wrong data.**

**Location:** `src/components/profile/ProfileWizard.tsx:89`, initial weight text; `:104`, conversion; `:143`, unit button; `src/screens/you/write.ts:66`, persistence.

**Trigger:** Open the actual about editor with stored `weightKg=80` and metric display. Tap **lb**, change nothing else, then Save.

**Observed:** The text stays `80`; `useMetric` becomes false; the wizard interprets the unchanged text as 80 pounds. Its actual completed result contains **`weightKg=36.3`**. Saving persists that value to both the profile and `settings.currentWeight`. The opposite toggle can inflate weight.

**Expected:** A display-unit change preserves the physical weight. It must not become a body-weight edit unless the person changes the value.

**Fix:** Convert the valid entered number when switching units, or keep canonical kilograms and derive display text. Preserve blank/incomplete input intentionally rather than converting it to zero. Apply the same behaviour in You editing, programme Join and Welcome, which share this wizard.

**Test gap:** Existing wizard tests verify how supplied weights are finalised, not the actual unit-button callback. Add kg/lb/kg round-trip component tests and assert the submitted canonical weight stays 80 kg.

### N06. A correctly held restarted walk has no local re-check-in flow

**Classification: NEW PROBLEM in the user journey around B03. Severity: broken journey.**

**Location:** `src/screens/walk/WalkSetup.tsx:147`, Return to walk; `src/screens/walk/LiveWalkScreen.tsx:188`, hold copy; `:262`, held controls.

**Trigger:** A basal-insulin user has a meter reading at 19:00, records five minutes, pauses for 26 minutes, then taps Resume at 19:31. The real controller refuses restart and returns a permission with `needsCheckIn=true`.

**Observed:** The gate correctly holds. The actual screen's hold branch says the walk is kept and offers **Finish and save**. It has no check-in component or action to enter the fresh reading requested by the release text. Walk setup's pending-walk button navigates directly back to this screen. The raw JSX also contains closed stop/finish-sheet controls; those are not a visible re-check-in route.

The person can leave and discover a check-in elsewhere, but the interrupted task itself offers only ending it. This is a recovery defect, not a permission bypass.

**Expected:** A non-emergency hold caused by starting data should provide the appropriate shared check-in/profile action while preserving the walk so far. A fresh accepted answer should allow another explicit gated Resume.

**Fix:** Add a shared re-check-in action to the held live screen, or make Return/Resume invoke the shared starting question before moving again. Subscribe to the resulting effective answers as already implemented. Preserve emergency help precedence; do not offer a form as a substitute for urgent care.

**Missing regression:** Controller plus real screen, stale insulin reading, enter fresh reading, gated Resume, preserved earlier segment. Current gate tests establish refusal, not an achievable recovery journey.

### N07. A visible reminder crosses quiet hours using its cached clock

**Classification: NEW PROBLEM, residual reminder timing edge. Severity: polish.**

**Location:** `src/reminders/ReminderHost.tsx:17`, 30-second recheck; `:41`, cached wall time; `:64`, unaligned interval; `:76`, filtering against that cache.

**Trigger:** A 09:59 water reminder is visible when the app returns at **09:59:58**. Quiet hours begin at 10:00. Leave the app visible through **10:00:05**, before the next 30-second clock recheck.

**Observed:** The actual host still renders the banner against its cached 09:59 time. Calling `stillDue` with the actual 10:00 time returns false. The new eight-second auto-hide, if mounted at 09:59:58, would expire at 10:00:06 and therefore does not remove this example in time. Focus-retained banners can wait longer.

**Expected:** Display eligibility changes when the configured quiet boundary/current day begins, rather than up to 30 seconds later. This is separate from the original F26 suspension case, which now passes.

**Fix:** Schedule the clock check at the next minute/quiet/day boundary and revalidate using current wall time. Preserve truthful manual water logging; quiet hours suppress prompts, not the person's ability to record a drink.

**Missing regression:** Host mounted just before a quiet boundary with an already pending banner, no visibility event and no new store write. The pure scheduler tests already reject that banner when given fresh time.

## Checked and correct

* A normal uninterrupted insulin-user walk is not stopped merely because the pre-exercise reading ages past 30 minutes. The same reading refuses a fresh Start/restart at 31 minutes. This distinction is intentional and tested.
* Store and refused-save subscriptions both pause recording on received clinical refusal, stop sensor collection, preserve progress and detach when the screen closes. Reattachment restores one subscription rather than accumulating listeners.
* GPS reacquisition creates separate measured runs; saved distance carries their actual intervals, not the full walk's elapsed duration. No GPS position/route is emitted by `walkObservations`.
* A timed-only walk does not invent measured steps or distance. Time explicitly added for an absence is `source='manual'`; observed foreground intervals are `source='measured'`, all with `scope='sessionObserved'` and the stable `walk:<id>` context. Post-walk pain answers remain separate `pointInTime`, manual observations.
* The original Sunday/Monday time case yields one and two minutes in the relevant day/week totals and remains one walk in the timeline. A genuinely unsplittable legacy distance/step interval is kept whole with an across-midnight note, rather than apportioned numerically.
* Profile and habit writers edit the latest nested store state, preserve unrelated settings and surface refused writes. Join/Leave share the canonical programme helpers; selecting Focus alone does not enrol.
* Explore-first completion is browsing/logging with health unanswered. First movement still encounters the missing-health gate.
* Fluid Yes or Not sure disables water encouragement in the same profile/settings update. Pending prompts and badge entries disappear, while entered intake survives. Non-Normal Status and disabled habit/banner settings also suppress pending output.
* Guide-derived movement precautions reach both in-app banners and exported calendar notes. Active foot wound/Charcot profiles suppress both standing and walking prompts, including habits already enabled before the profile changed.
* The `.ics` cases passed escaping, CRLF folding by UTF-8 octets, UTC `DTSTAMP`, local reminder times, stable identities and common scheduling/health exclusions. Actual iOS Calendar import behaviour is not established by those string tests.

## Permitted pending work and skipped checks

**Reminder banner placement and auto-hide:** The current source contains below-content placement above the tab bar and an auto-hide mechanism, and the four placement helper tests passed. Their installed-PWA geometry, focus retention and timing were not certified here. This is the explicitly permitted pending work, not an additional failed completed finding.

**F27 complete revision coverage:** The revision interface landed during this audit. Its 15 reminder helper tests, two backup-settings tests and new durable profile/settings cases passed. The revised BackupSheet handler also passed the stale-preparation probe. Certification that every persisted mutation, failed write, deletion, import/Replace and interleaving during file delivery produces the correct coverage still needs the complete store integration checks. The user explicitly allowed that remaining coverage to be pending.

**Native commands skipped:** The normal command launcher failed before execution with `sandbox-exec: sandbox_apply: Operation not permitted`. No escalation or approval was requested. Native Vitest CLI, build/dev-server startup and browser/device checks were therefore not run. Inspection and in-memory probes continued through the existing Node process without writing a harness, cache or test file.

**Needs a browser or device check:**

* D34 validation at 430×932 and 320×568, both themes, with real sheets, focus, keyboard, Back and accessible headings. Component probes did not render a DOM.
* Installed iPhone motion/location permissions, refusal/regrant, phone lock, background suspension, BFCache return, OS wake-lock revocation and actual sensor accuracy with sciatica gait.
* Safari's actual quota/sessionStorage failure and storage lifecycle, and foreground/background delivery of store changes from another tab.
* iOS fresh-tap sharing, cancelled sharing, Files/Calendar import and recurring event behaviour across timezone/DST changes. A generated calendar file cannot revoke alerts already imported into Calendar; the app must continue explaining replacement/deletion of old calendar entries.
* The two permitted pending items after the implementations settle, including the reminder's quiet-boundary case N07.

## Release verdicts

| Area | Verdict | Required work |
| --- | --- | --- |
| **Walk and `src/walk`** | **do not ship** | Fix the unreported low-symptom action **N01** before safety release. Fix false-success save exhaustion **N02**, sensor day allocation **N03**, and the restart recovery route **N06**. Retain the now-correct start/restart/live and effective-answer semantics. |
| **You** | **ship after fixes** | Fix competing restore control **N04** and canonical body-weight preservation **N05**. Original profile-save, programme and prepared-backup fixes pass the bounded checks. Complete the permitted backup coverage separately. |
| **Welcome** | **ship after fixes** | Fix the shared wizard unit selector **N05**. Explore-first, flow order, acknowledgment and medicine-question checks pass. Restore uses the shared flow and also needs **N04**. |
| **Reminders** | **ship after fixes** | Fix cached display eligibility at a quiet/day boundary **N07**. Fluid, Status, suspension catch-up, foot-wound exclusions and travelling care-plan precautions pass. Banner/device and full F27 integration remain the declared pending checks. |
| **Profile wizard** | **ship after fixes** | B08's required non-diabetic SGLT2 and heart/kidney BP medicine questions pass. Fix the independent weight-unit defect **N05** before shipping the wizard's about flow. |
