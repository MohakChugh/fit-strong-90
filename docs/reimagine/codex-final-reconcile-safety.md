# Codex final reconciliation — safety (static review of pasted source, 8 Oct 2026)

Static reconciliation: several engine fixes are present, but the supplied code still contains unsafe clearance paths and lost emergency obligations. Most screen and persistence findings cannot be closed from this bundle. Verdict: do not ship.

This review uses only the pasted source. References below identify functions and distinctive code, since the earlier reports’ line numbers do not apply reliably to this bundle. An **AGREE-FIXED** verdict establishes the fix in the supplied code, without claiming runtime verification.

| Finding id | Verdict | Evidence against the current source |
|---|---|---|
| **X2-01** | **AGREE-FIXED** | The missing input is now supplied. `pending.ts::effectiveCheckIns` attaches observations as `logged`; `readiness.ts::withLogged` incorporates glucose and BP into the evaluated timeline. `useGuided` and `walk/gate.ts::deviceClinical` pass observations into that projection. `permission.ts` also calls `freshness(withLogged(checkIn), now)`. |
| **X2-02** | **NOT-FIXED** | `carriedRules` now preserves named back red flags across days, so the original next-morning “None” sequence is blocked. However, same-day replacement answers can erase the flag before it becomes historical, and the carried flag branch accepts any settled resolution, including `resolved`, without requiring assessment. See **R5-01**. |
| **X2-03** | **NOT-FIXED** | Historical foot problems now carry `FOOT` and refuse walking. However, ordinary same-day news replacement can remove the obligation. A carried hot, swollen foot also accepts `resolved`, despite its message requiring clinician clearance. See **R5-01**. |
| **X2-04** | **CANNOT-TELL** | `SessionPage.tsx` and `useGuidedSession.ts` are missing. `startGate` alone does not establish whether media Play is blocked while a safety question is open. |
| **X2-05** | **CANNOT-TELL** | The engine supplies `TREAT` in `oral`, and `merge` places it in `actions`. The deciding renderers, `SessionPage.tsx::ReadingScreen` and `LiveWalkScreen.tsx`, are missing, so treatment display, checkpoint wording and recovery controls cannot be verified. |
| **X2-06** | **AGREE-FIXED** | `readiness.ts::bpRules` now includes `newSensory`, `newWeakness` and legacy `newNeuro` in `newNerve`, then includes `newNerve` in `acute`. A valid severe reading with those answers reaches `bpEmergency`. A separate invalid-component case remains, **R5-06**. |
| **X2-07** | **CANNOT-TELL** | `answerEpisode` still accepts an array of reading ids, but it also supports a singleton array. Only the missing `CheckInSheet.tsx` can establish whether questions now call it separately for each reading. |
| **X2-08** | **AGREE-FIXED** | For the reported engine sequences, `glucoseRules` now constructs `all = [...prior, ...today]`, with `prior` supplied by `leadIn` from the previous day. Repeated-low timing and the `lowRecovered` requirement therefore survive midnight. The player’s cool-down selection remains unverified under **M-02**. |
| **X2-09** | **CANNOT-TELL** | `stop.ts::legReport` now accepts `movement` and records it in `provoked`; `backRules` refuses walking for walking ids. The missing live-walk caller must actually pass that id. |
| **X2-10** | **AGREE-FIXED** | `carriedRules` changes readings older than `CARRY_URGENT_HOURS` to a hold asking what happened, rather than an immediate emergency. It permits `resolved` for those old readings. Untimed reading ids now include the record day through `stampOf`. |
| **X2-11** | **CANNOT-TELL** | The current Track escalation and Guide content are missing. The engine’s severe-low and BP rules are visible, but their agreement with Track cannot be checked. |
| **X2-12** | **CANNOT-TELL** | `useGuided().checkIn` now re-evaluates readiness against the current profile. However, `effectiveRecord` still returns the stored record unchanged when there is no pending record. The missing sheet, `sheetState.ts` and `OutcomeBanner.tsx` determine which readiness supplies the displayed actions. |
| **X2-13** | **CANNOT-TELL** | `WalkSummary.tsx` and its guidance renderer are missing. The engine’s timestamp does not prove that the summary uses it or avoids repeating “now”. |
| **X2-14** | **CANNOT-TELL** | The engine message and shared `WORSENING` constant now say “over hours or days”. The actual check-in and stop-screen renderers are missing, so all displayed questions cannot be verified. |
| **X2-15** | **CANNOT-TELL** | `glucoseFromForm` still uses `measuredAt: at ?? stamp`. The deciding code is the missing glucose input handler in `CheckInSheet.tsx`, which must set `glucoseAt` when the reading is entered. |
| **X2-16** | **CANNOT-TELL** | `useGuided.ts::planFor` now passes `flare: true`. `engine/session.ts::buildSessionPlan` is missing, so its response, including actual loading, cannot be established. |
| **X2-17** | **CANNOT-TELL** | `CANNOT_SWALLOW` now exists as shared content, but the missing player renderer must display it alongside treatment. Exporting the text alone does not close the finding. |
| **X2-18** | **CANNOT-TELL** | `walk/low.ts::typedReading` withholds a reading unless sanity is `ok`, supporting unit confirmation. The player and walk capture renderers are missing, so their use of this helper and their confirmation controls cannot be verified. |
| **X2-19** | **NOT-FIXED** | Most glucose wording now uses `level(..., u)` and `lowBand(u)`. However, `glucoseRules` still emits the literal message **“Your glucose was still under 70 when you re-checked”** for `lowRepeat`. That threshold is not expressed in the person’s unit. |
| **X2-20** | **CANNOT-TELL** | The current `QuickLog.tsx`, `BackLeg.tsx` and relevant copy are missing. |
| **M-01** | **CANNOT-TELL** | The supplied helpers fix the fabricated-answer and wrong-date mechanisms: `applyReport` adds no sleep, energy or emergency answer to a new day; `checkedIn` requires an emergency-question answer; `useGuided.reportSymptoms` dates the report from `at`. `restartCapture` also distinguishes a full check-in from a reading. The missing player determines whether it actually uses that routing and avoids asking glucose of the wrong person. |
| **M-02** | **CANNOT-TELL** | The deciding `lowSince`, restart-flow timestamp and cool-down logic in `SessionPage.tsx` are missing. |
| **M-03** | **CANNOT-TELL** | `useGuidedSession.ts` media handlers and `session/runner.ts` finished-state transitions are missing. |
| **M-04** | **CANNOT-TELL** | The Workout gate, model, hook and screen are missing. There is no supplied evidence of how an idle interval or hidden page ends a sitting. |
| **M-05** | **CANNOT-TELL** | `lowReading(..., neededHelp)` now maps help to `news: ['lowSevere']`. The missing `LowFollowUp` renderer must offer the control and pass its value. |
| **M-06** | **CANNOT-TELL** | The player’s save and progress-deletion code, plus the store’s durable-save implementation, are missing. |
| **M-07** | **CANNOT-TELL** | The walk and guided summaries, `walk/record.ts`, and memory-only store behavior are missing. |
| **M-08** | **CANNOT-TELL** | The earlier-session banking code and progress-key overwrite behavior are missing. |
| **M-09** | **CANNOT-TELL** | The player’s finished-state rendering order and End-session handler are missing. |
| **M-10** | **CANNOT-TELL** | `StretchScreen.tsx` is missing. `useGuided` exposes effective `checkIns`, but that does not establish what the preview passes to its builder. |
| **M-11** | **CANNOT-TELL** | The capture screens’ DOM, focus effects and accessibility roles are missing. |
| **J2-01** | **AGREE-FIXED** | `recordedLows` scans the rolling 24-hour window across check-in and logged readings, groups re-checks into episodes, and excludes readings answered as mistakes. `newsRules` uses `Math.max(answered, recorded.length)`, so “None” cannot override two recorded lows. |
| **J2-02** | **CANNOT-TELL** | The player’s stop callback, session symptom logging, progression logic and Back & leg series are missing. `legReport` recording `provoked` does not prove that a session also records `worse`. |
| **J2-03** | **NOT-FIXED** | Today still uses `detail: recheck.release ?? recheckWhen(ctx) ?? ''`. A release therefore hides the due time. Also, `merge` retains the first release of equal rank, so the suspected-low release can continue to override the confirmed-low release. The current walk renderer cannot be judged. |
| **J2-04** | **AGREE-FIXED** | `recommend.ts::statusSuggestion` now returns “Rest for the rest of the day” after a stretch with real work. Separately, `backRules` adds `provokedStretch`, and `permission` refuses another stretch start after reported distal spread. |
| **J2-05** | **AGREE-FIXED** | `recommend` now evaluates `night(ctx)` before movement suggestions. From midnight until 04:00 it returns “Rest well” with no movement action, including after an evening activity. The timeline’s date presentation remains outside this bundle. |
| **J2-06** | **CANNOT-TELL** | `today/model.ts::pickPrompt`, reminder placement and cadence logic are missing. |
| **J2-07** | **CANNOT-TELL** | The supplied recommendation now gives meal walks priority over focus and checks completion per meal. It calls `walkSetupHref(meal)`. However, that helper, Walk setup and `ReminderBanner.tsx` are missing, so the finding about every link preserving the meal cannot be closed. |
| **J2-08** | **CANNOT-TELL** | `MetricDetail.tsx` filter initialization and the Today metric-row link are missing. |
| **J2-09** | **CANNOT-TELL** | `recommend` now treats an absent profile as unreviewed, and `permission` makes profile gaps a settled refusal rather than a check-in request. The missing Today screen and `useStartMovement` determine the actual first-run journey and whether the full check-in is avoided. |
| **J2-10** | **CANNOT-TELL** | The summary, Today totals, movement totals and Track formatting implementations are missing. |
| **J2-11** | **CANNOT-TELL** | `programmeWeek`, the plan-week list and Today’s weekly count are missing. |
| **J2-12** | **CANNOT-TELL** | The plan list’s status handling and Status sheet wording are missing. |
| **J2-13** | **CANNOT-TELL** | `track/trends.ts` is missing. |
| **J2-14** | **NOT-FIXED** | The exact two-low example is improved by `dayOver`, but that flag is set only by `c.release === RELEASE.tomorrow`. A single severe BP uses a different release containing “No exercise today either way”; its disposition is `hold`, so glucose exercise preparation can still be appended beside that refusal. The three screen time formats are unverified. |

The reports also name earlier findings as fixed. Their reconciliation is:

| Earlier finding id or description | Verdict | Evidence against the current source |
|---|---|---|
| Earlier gap: ketones skipped during a low, urine treated as blood | **AGREE-FIXED** | `evaluateCheckIn` evaluates `ketoneRules` independently of glucose. `ketoneLevel` interprets urine categories on their own scale, with moderate and large urgent. |
| Earlier gap: 600 runnable and glucose boundary rounding | **AGREE-FIXED** | `threshold` compares in the reading’s own unit without rounding. `atLeast(latest, 600)` contributes an emergency; 54, 70, 90 and 300 use the intended strict or inclusive comparisons. |
| Earlier gap: BP averaging hides severity and boundary errors | **AGREE-FIXED** | `bpRules` evaluates raw valid readings. Severe is `sys >= 180 || dia >= 120`; the general hold is `sys > 160 || dia > 100`; exactly 160/100 remains an adjustment. |
| Earlier gap: missing insulin reading and unknown medicines | **CANNOT-TELL** | The `noReading` and profile-gap holds exist. `health.ts::deriveHealth` and `profileGaps` are missing, so medicine-to-risk and unknown-answer classification cannot be verified. |
| Earlier gap: foot drop offered recovery, dizziness runnable | **AGREE-FIXED** | On the reporting day, `backRules` gives weakness `today`; `newsRules` gives dizziness an unconditional hold. Persistence has the separate defects in **R5-01**. |
| Earlier gap: invalid glucose blocks an emergency, profile edit loses cauda flag | **AGREE-FIXED** | `submitBlocked` returns `null` when an emergency item is ticked. `buildCheckIn` retains a saved cauda flag when back questions are hidden, and `backRules` evaluates it independently of the profile. |
| **B01, P01, P02, P03, P28** | **AGREE-FIXED** | Reading ids include measurement identity and time, or the record day when untimed. Answers name ids; later readings are separate incidents. Recent extreme readings also carry across midnight. |
| **B01, P04** | **AGREE-FIXED** | `answerEpisode` appends `reopened` when taking back an earlier answer; `settledAs` honors the latest answer and treats `reopened` as unresolved. |
| **B02** | **CANNOT-TELL** | `sheetState.ts` and current sheet callers are missing. |
| **B03** | **CANNOT-TELL** | The supplied start, arrival and live gates have the intended distinction. Their complete wiring to media controls, background return, Workout and player restart is missing. |
| **B04** | **NOT-FIXED** | Shared pending evidence exists, but `effectiveRecord` compares only disposition rank. Equal-rank records can lose a mode-specific refusal. See **R5-02**. |
| **B05** | **NOT-FIXED** | `reconcilePlan` can retain a longer cardio dose than the fresh plan prescribes. It does not compare ordinary cardio duration. See **R5-04**. |
| **B06** | **CANNOT-TELL** | Full-screen capture, dismissibility, checkpoint logging and normal-reading continuation depend on the missing player. |
| **B07** | **CANNOT-TELL** | `buildCheckIn` retains valid severe partials, and `bpRules` escalates a partial with acute symptoms. However, `submitBlocked` still rejects an incomplete BP unless an emergency flag is ticked. The missing sheet’s automatic urgent-save path decides the reported journey. |
| **B08** | **CANNOT-TELL** | `visibleQuestions` asks DKA and ketones when `d.ketoneRisk` is true. The missing `deriveHealth` determines whether non-diabetic SGLT2 treatment actually sets that risk. |
| **B09** | **CANNOT-TELL** | The engine and shared leg-report model contain the rapid-weakness and bilateral emergency paths. The player’s non-dismissible flow and session logging are missing. |
| **F13** | **AGREE-FIXED** | The supplied fluid-advice path now consults `fluidRestriction`; the limited branch says “Keep to your fluid plan.” The stale-display issue remains unverified under **X2-12**. |
| **F15** | **CANNOT-TELL** | Saved-plan slot selection and restoration in the player and persistence module are missing. |
| **C2-01** | **CANNOT-TELL** | Glucose correction helpers now replace the corresponding check-in reading and request a correction write. The Track caller and store implementation are missing, so the complete correction journey and atomic persistence cannot be verified. |
| **F09**, referenced by M-06 | **CANNOT-TELL** | Durable session storage and deletion of the only progress copy are outside the supplied implementation. |

The following remaining findings are static traces using synthetic records.

**R5-01, high severity safety: persistent red flags can still disappear without their stated release**

Files and functions: `src/components/checkin/form.ts::buildCheckIn`, `carryForward`; `src/components/checkin/pending.ts::saveWith`; `src/engine/readiness.ts::carriedRules`.

The deciding code writes current answers directly:

```ts
newWeakness: f.newWeakness,
```

```ts
news: [...form.news],
```

`carryForward` preserves readings, partial BP evidence, provoking movements and the low-report timestamp. It does not preserve a replaced weakness, feverish-back, sudden-back or foot flag. `saveWith` then replaces that date’s record:

```ts
checkIns: [...list.filter(x => x.date !== date), record]
```

Meanwhile, the flag ledger in `carriedRules` scans only records where `x.date < date`.

**Failing sequence:** the person reports new foot drop at 09:00. At 10:00 they complete another check-in with the back flags answered “None”. `buildCheckIn` writes `newWeakness: false`; the previous same-day flag is not retained. With otherwise normal inputs, permission can allow movement without any clinician assessment. The equivalent sequence removes a same-day foot sore by replacing `news`.

A second release gap exists for historical flags. Their branch does:

```ts
if (settled) continue;
```

That accepts `resolved` for new weakness or a hot, swollen foot, even though the corresponding messages say “No exercise until a clinician has checked your leg” and “until a clinician has cleared it”.

**Expected versus actual:** the recorded incident should remain until its stated release is recorded. Current-status answers, or a resolution unsuitable for that flag, can remove it.

**Suggested fix:** create persistent incident ids when flags are first reported, including on the current day. Ordinary “None” answers should update current symptoms without closing those incidents. Validate resolution choices by flag: clinician assessment where required, explicit healing where permitted, and a separate typing-mistake correction.

**R5-02, high severity safety: equal disposition ranks can discard a stored refusal**

File and function: `src/components/checkin/pending.ts::effectiveRecord`.

The selection is:

```ts
return rank(ours.readiness) > rank(theirs.readiness) ? ours : theirs;
```

**Failing sequence:** the stored record contains `footProblem`, producing disposition `adjust`, modifier `FOOT` and a walking refusal. A replacement record contains `hot`, but omits `footProblem`; its save is refused.

`carryForward(stored, pending)` produces the pending news list, with `HEAT` and no `FOOT`. The reverse combination retains the foot refusal. Both evaluations have disposition `adjust`, so the tie selects `theirs`, the combination without the foot restriction. Walking can therefore become allowed while the device still holds the foot problem.

**Expected versus actual:** the pending-record contract says that a refused write cannot loosen stored safety. Comparing one global rank does not preserve mode-specific refusals or restrictions.

**Suggested fix:** preserve stored safety obligations until a valid release is durable. Compare or merge per-mode refusals and restrictions, including swallowing safeguards, rather than selecting solely by disposition rank.

**R5-03, high severity safety: a backdated normal reading can clear a later unsafe reading**

Files and functions: `src/components/checkin/form.ts::buildCheckIn`, `glucoseFromForm`; `src/engine/readiness.ts::glucoseRules`, `bpRules`; `src/engine/permission.ts::freshness`.

The form makes the newly submitted entry current:

```ts
glucose = next.glucose;
```

The displaced reading moves to `glucoseEarlier`. Ordinary glucose above 300 is held only when it is the latest reading:

```ts
if (p.health.diabetes !== 'type1' && above(latest, 300) && below(latest, 600))
```

**Failing sequence:** the person records 320 mg/dL measured at 09:10, which holds exercise. At 09:20 they add a normal 140 mg/dL reading measured at 09:00. The form accepts that past time and makes 140 current. The 320 remains in history, but it is neither an extreme reading nor a low, so its hold is not retained. Even for a person requiring freshness, the 09:00 reading is only 20 minutes old and passes that check.

The BP equivalent is a 170/105 reading at 09:10 followed by submission of an older 120/80 reading from 09:00. `bpRules` considers only severe earlier readings, so the displaced 170/105 no longer holds movement.

**Expected versus actual:** an older measurement cannot demonstrate recovery from a later unsafe measurement. Submission order currently takes precedence over measurement order.

**Suggested fix:** determine the current reading chronologically. Keep later unsafe readings controlling until a valid subsequent measurement or appropriate explicit resolution answers them. Handle unknown or conflicting times conservatively.

**R5-04, high severity safety: archived cardio ignores a shorter dose prescribed by the fresh plan**

File and function: `src/session/gate.ts::reconcilePlan`.

The cardio comparison is limited to:

```ts
const exceeds = (hard(st) && !hard(twin))
  || coolSeconds(twin) > coolSeconds(st)
  || (conditions.foot && twin.exerciseId !== st.exerciseId);
if (!exceeds) return st;
```

**Failing sequence:** a still-allowed archived cardio step contains 20 minutes of ordinary steady work and five minutes of cool-down. The matching fresh step prescribes five minutes of steady work and the same five-minute cool-down. Neither step contains `fast` or `tempo`, and the foot condition is false.

All three comparisons are false. `reconcilePlan` returns the archived 25-minute dose, despite the fresh plan prescribing ten minutes.

**Expected versus actual:** the function promises to make remaining work obey the fresh builder’s current limits. It enforces some intensity and cool-down changes, but omits shorter ordinary cardio duration.

**Suggested fix:** compare the remaining cardio dose, including duration and effort limits, with the fresh prescription. Preserve completed work while applying the current dose to remaining work. The omitted builders are needed to establish which live scenarios produce each shorter prescription, but the reconciliation failure for that input is explicit.

**R5-05, high severity safety: carried emergency ketones receive same-day contact wording**

Files and functions: `src/engine/readiness.ts::seriousReadings`, `carriedRules`, `CARRY_MESSAGE`.

Urgent ketones are correctly classified as an emergency:

```ts
const disposition = level === 'urgent' ? 'emergency'
```

But their carried message is:

```ts
ketones: label => `${label}: no exercise until you have contacted your diabetes team, and contact them today.`,
```

**Failing sequence:** blood ketones of 3.1 mmol/L are recorded at 23:55 and remain unassessed. After midnight the person records normal ketones and answers the current emergency list “None”. The serious ketone incident still contributes disposition `emergency`, but its reason instructs contact with the diabetes team “today”.

**Expected versus actual:** the same unresolved urgent ketone incident should retain the emergency-assessment instruction used by `ketoneRules`, including `CALL`. The carried result has emergency severity paired with a less urgent instruction.

**Suggested fix:** select carried wording by both incident kind and original severity. Urgent ketones must retain emergency assessment now; high ketones can use the same-day contact wording.

**R5-06, high severity safety: an invalid BP component hides the emergency from the valid severe component**

Files and functions: `src/engine/readiness.ts::bpRules`, `validBp`; `src/components/checkin/form.ts::formPartials`, `submitBlocked`.

The engine filters the whole reading before looking for severe values:

```ts
const readings = all.filter(validBp);
const severeNow = readings.filter(severe);
```

`validBp` requires both components to be valid. The form’s partial-reading builder also excludes a row when both boxes contain values:

```ts
if ((sys === undefined) === (dia === undefined)) continue;
```

**Failing sequence:** the person reports new numbness and a BP entered as 190/10, with the second number mistyped. The systolic value is within the engine’s accepted range and above its severe threshold. Nevertheless, `validBp` rejects the complete reading because the diastolic value is invalid. No partial is extracted because both values are present.

Although `acute` recognizes the new numbness, the severe-reading branch is never entered. The result is a data hold rather than `bpEmergency`. The ordinary form submission is also blocked by the invalid BP unless an emergency flag is separately ticked.

**Expected versus actual:** a valid severe component accompanied by an acute sign should not lose its emergency escalation because the other component needs correction.

**Suggested fix:** evaluate valid severe components independently, retain them as partial evidence when the other component is invalid, and ensure invalid form data cannot prevent that emergency evidence from reaching the gate.

**R5-07, high severity safety: an evidence-only day can hide the last unanswered emergency**

Files and functions: `src/engine/readiness.ts::carriedRules`; `src/components/checkin/pending.ts::applyReport`; `src/walk/gate.ts::reachableHistory`, `mayCarry`.

The engine chooses the last earlier check-in using:

```ts
const answered = earlier.filter(x => !x.readingsOnly);
const last = answered.at(-1);
```

However, `applyReport` creates a report-only day without `readingsOnly`:

```ts
{ date, urgentSymptoms: false, news: [] }
```

It correctly leaves `emergency` unanswered, but that record still qualifies for the `answered` list above.

**Failing sequence:** day 1 contains a chest emergency. On day 2, only a glucose report is added, with no emergency-question answer. On day 3, there is still no newer answered check-in.

The day-2 report is selected as `last`. Evaluating it internally carries the day-1 chest emergency, but the outer carry loop discards that result because it filters:

```ts
reason.code.startsWith('carried')
```

The emergency obligation disappears. The start question may still request a check-in, but the live question can become allowed.

There is a parallel walk-pruning defect with a Track-only day. `reachableHistory` keeps the latest earlier record regardless of whether it is a check-in. The older chest record can be dropped because `mayCarry` tests only `.episodes?.length`; a carried chest emergency has no reading episode.

**Expected versus actual:** an evidence-only day must not answer or obscure the last actual emergency check-in. Both the full engine and the optimized walk history can lose that obligation.

**Suggested fix:** select the last record that actually answered the emergency question, and preserve it when pruning history. Keep clinical reports as evidence independently of whether they constitute a full check-in. Do not fix this merely by marking all reports `readingsOnly`, since the current flag-carry code skips such records.

**R5-08, medium severity data consistency: Track projection duplicates serious-reading incidents**

Files and functions: `src/engine/readiness.ts::withLogged`, `evaluateCheckIn`, `episodeSummaries`.

`evaluateCheckIn` materializes logged readings:

```ts
const c = withLogged(checkIn);
```

It then passes that materialized record to `episodeSummaries`, which materializes it again:

```ts
const c = withLogged(record);
```

`withLogged` retains `logged` and appends older logged glucose without deduplication:

```ts
out = { ...c, glucoseEarlier: byMeasured([...(c.glucoseEarlier ?? []), ...sorted]) };
```

**Failing sequence:** the record contains a current 140 mg/dL reading at 09:10 and one logged 650 mg/dL reading at 09:00. The first projection adds the 650 to `glucoseEarlier`. The second adds it again.

`episodeSummaries` returns two reading entries with the same incident id and label, although there was one measurement. The BP projection has the equivalent repeated-append behavior.

**Expected versus actual:** one measurement should produce one incident. Repeated projection currently changes the result and duplicates the open-incident model.

**Suggested fix:** make `withLogged` idempotent, deduplicate by measurement identity, and exclude the current measurement from earlier measurements. Alternatively, pass the original record to a summary helper that projects exactly once.

What I could not judge is substantial. The omitted player, runner, sheet, walk capture and summary code determines media-control blocking, cool-down-only resumption, rescue wording, focus management and finished-state rendering. The omitted store and persistence implementations determine durable-save acknowledgements, banking, retry behavior and deletion of recovery copies.

The omitted Today, Track, Reminder, Plan and Status implementations determine prompt priority, chart navigation, rounding, week definitions, source labels and displayed time formats. The omitted health, plan-builder, safety-matrix and catalogue modules determine medicine-risk classification, actual plan doses and exercise exclusions.

No tests, browser journeys, physical-device behavior or storage durability were verified in this review. The code-proven safety defects above are sufficient to block release without relying on those missing checks.

Verdict: **do not ship**.