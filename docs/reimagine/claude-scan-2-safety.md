# Claude scan 2: adversarial safety review

Reviewed 8 October 2026 against the working tree on `fix/voice-start-and-audit` (HEAD `f21db7a` plus uncommitted changes). Line numbers are as of 16:15 IST. Another agent edited `SessionPage.tsx`, `form.ts`, `LiveWalkScreen.tsx`, `walk/gate.ts`, `pending.ts` and `useStore.ts` during the review. I re-read each edit: none changes a finding, and the references here are updated to the edited files. Scope: the readiness engine and every surface that starts, continues or advises on movement. Read first: BOARD D28–D30, D35, D36; `codex-safety-gap.md`; `codex-safety-reaudit-3.md`; `docs/research/clinical-tracking-protocols.md` (the Safety contract).

## Summary

The engine is in good shape. Every boundary I attacked holds, in both units: glucose 53.9/54, 69.9/70, 89.9/90, 300/300.1, 600; BP 160/100 against 161/80 and 150/101, 180/80, 120/120; ketones 1.5, 3.0 and urine moderate; freshness 30.00 against 30.01 minutes and the 2-minute future slack. Codex's round 3 items B01–B09 are fixed at the engine and form level (list below). The 15 safety test files pass: 456 tests.

The problems now are at the edges of the engine. These are places where a clinical fact never reaches the gate, or reaches it for one day only, or where a screen next to the gate says something different:

- **Track is invisible to every gate.** A glucose of 50 mg/dL logged in Track as "Before exercise" makes Track say "This is a serious low… Do not exercise". Today then shows it, and Start walk goes straight into a recording walk. The same happens with a BP of 192/104 and both Stretch and Walk (browser run, X2-01).
- **Day-scoped questions drop ongoing red flags.** A new foot drop, new sudden severe back pain or a new foot sore each block movement on the day they are reported. Whether someone was assessed or the foot healed is never asked: the next morning's check-in asks "since your last check-in", says nothing about it, and lets the person walk. The stated release ("until a clinician has checked your leg", "once your foot has healed") is never enforced (X2-02, X2-03).
- **The player's safety screens can be talked over.** Earphone or lock-screen Play restarts the session underneath "Stop: something's wrong" and "That exercise stops here" (X2-04). A low measured at the pre-cardio glucose check gets no rescue instruction, keeps promising "Cardio starts once it is in", and has no way to say symptoms have gone (X2-05).

Counts: **8 safety, 5 wrong advice, 4 inconsistency, 3 polish.**

### How each finding was reproduced

- **In-memory:** scripts ran the real modules with `TZ=Asia/Kolkata npx tsx --tsconfig tsconfig.app.json` against synthetic profiles. They called `permission`, `resumePermission`, `liveGate`, `evaluateCheckIn`, the sheet's own `buildCheckIn` / `answerEpisode` / `visibleQuestions`, `buildSessionPlan`, `buildStretchPlan` and `planFor`.
- **Browser:** the repository's own acceptance harness was imported read-only (`scripts/e2e/acceptance/lib`, personas P01, P02, P04 and P04 + `ENROLLED`). It ran in headless Chromium at 430×932 light against a watch-free Vite dev server, with the clock frozen at Thursday 2026-10-08 09:00 IST. Every action was a tap or a typed entry in the real UI.
- **Earphones:** for X2-04 an init script recorded the handlers the app registers with `navigator.mediaSession`, and the test then called the `play` handler the way the operating system would.

All scratch scripts lived in `/tmp/claude-scan2-safety/` and have been deleted.

---

## Findings

### X2-01. A reading logged in Track never reaches the movement gate

**Severity: safety (wrong clearance).**

**Where:**
- `src/screens/track/QuickLog.tsx:267`, `:277` (glucose: escalation shown, then `addObservation` only)
- `QuickLog.tsx:551`, `:565` (BP: `addObservations` only)
- `src/screens/track/logKinds.ts:112` offers the tag "Before exercise"
- `src/screens/track/escalation.ts:19–22` says "the movement gate owns" exercise holds
- The gate's input has no observations at all: `src/engine/permission.ts:32–38`, `:210`. The same is true of `src/walk/gate.ts:53–68`, `src/screens/workout/gate.ts:84–87` and `src/components/checkin/useStartMovement.tsx:36`.
- The store lifts check-in readings into observations, one way only: `src/store/useStore.ts:1202–1216`, `src/store/project.ts:193`.
- Today displays the Track reading: `src/screens/today/TodayScreen.tsx:323–324`.

**Repro (browser, P04 on basal insulin):**
1. Move → Walk → Start walk opens the check-in. Answer "None of these" and enter glucose 140. The outcome is **"Good to go"**. Close the sheet.
2. At 09:05, Track → Add → Glucose: enter 50 and tag "Before exercise". Guidance: "This is a serious low. Treat it now… Check again in 15 minutes…".
3. Today now shows "Glucose 50 mg/dL · 9:05 am · Manual entry".
4. At 09:07, Move → Walk → Start walk goes **straight to `/walk/live`, "Recording while this screen is open"**, with no check-in sheet and no hold.

The stored check-in still holds only 140 at 09:00. The 50 exists only as an observation.

**Second repro (P01, metformin and treated hypertension):**
1. Check in with BP 124/78 and 122/76. The outcome is "Go ahead, with changes".
2. Track → Add → Blood pressure 192/104. Guidance: "This reading is very high… Do not exercise until you have spoken to your doctor."
3. Start stretch opens the player's ready screen.
4. Start walk goes to a recording walk.

**Expected:**
- T-HYPO-REVIEW and D29(3): a level 2 low ends that session attempt, with no automatic restart.
- H-PRE-LOW and H-HYPO: an insulin user under 90 is held.
- T-BP: a severe resting reading holds movement.
- Escalation.ts itself says Track repeats no holds *because* the gate applies them.

**Actual:** the gate reads only `DailyCheckIn` records. Any reading entered through Track, the screen that invites a "Before exercise" reading, is ignored by Today, Move, Stretch, Walk, the player and the Workout Log.

### X2-02. A new foot drop, or new sudden or feverish back pain, is cleared by the next day's check-in with no assessment

**Severity: safety (wrong clearance).**

**Where:**
- `src/engine/readiness.ts:232–239`: `newWeakness` is "today", with the release "No exercise until a clinician has checked your leg."
- `readiness.ts:252–263`: `backFever` and `backSudden` are "today".
- `readiness.ts:1141–1143`, `:1178`: the last check-in's "today" answers are carried only while today's record has not answered the emergency list. The comment states "Every check-in asks them, so the first one of the new day settles them either way."
- The question is "Since your last check-in, any of these?": `src/components/checkin/CheckInSheet.tsx:455`, labels in `src/components/checkin/copy.ts:20–26`.
- The back answers are not required: `src/components/checkin/form.ts:391–421`.
- Guide: `src/content/claims/daily.ts:220–226` ("stop exercising and get assessed today"; "don't exercise until then").

**Repro (browser, P01 seeded with a 7 October check-in reporting "New foot drop or foot dragging, or a leg getting weaker"):**
1. On 8 October before checking in, Start walk shows "No exercise today. Get medical advice today. From your last check-in on 7 Oct: New foot drop…".
2. Check in: "None of these" (right now), normal BP, pains 2/2 reaching the foot, "None of these" since your last check-in (true: nothing is *new* since then), "None of these" else, sleep and energy.
3. The outcome is **"Go ahead, with changes"**, and **Start walk is offered**.

In memory, the same day 2 gives guided, stretch and walk `allowed=true, adjust`. Skipping the back section entirely gives guided `allowed=true, reassure`.

Sudden severe back pain (pain 7) reported on day 1 gives "today". On day 2, with the same pain no longer "sudden", walk and stretch are allowed and guided runs a recovery session (cardio: recumbent bike).

**Expected:**
- T-NEURO: new foot drop or progressive weakness means stop and seek urgent assessment today.
- T-BACK: hold and seek urgent clinical assessment today.
- The app's own release and Guide make movement conditional on that assessment.
- A new weakness that has not been assessed is still there the next morning.

**Actual:** the next check-in releases it because of how the question is worded and because the section is optional. Nothing records or asks whether a clinician has checked.

### X2-03. A new foot sore or a hot, swollen foot restricts walking for that day only

**Severity: safety (wrong clearance).**

**Where:**
- `src/engine/readiness.ts:378–389`: `footProblem` and `hotSwollenFoot` are adjust-level `refuses: ['walk']`, a day-only answer that is not carried.
- `src/engine/permission.ts:85`: the release says "Walking is back once your foot has healed or a clinician says it is fine."
- Labels "A new blister or sore on a foot" and "A foot that is newly hot, red or swollen": `copy.ts:38–39`.
- Guide: `src/content/claims/food.ts:201–202` ("this app does not offer movement that puts weight through the affected foot until your care team clears it").

**Repro:**
1. Browser, P01 with neuropathy, seeded with a 7 October check-in ticking "A new blister or sore on a foot". On 8 October, check in with nothing new ticked. The outcome is **"Go ahead, with changes", Start walk offered**.
2. In memory, the same day 2 gives walk `allowed=true`. The 15-minute Hips & legs stretch then contains the weight-bearing `march-in-place`, `side-plank` and `soleus-stretch`.
3. The hot, swollen foot case behaves the same.

**Expected:** H-FOOT says that with an active ulcer, or a new hot, swollen foot in neuropathy, the app refuses weight-bearing exercise and the person seeks prompt care. The app's own release names healing or clinician clearance as the condition.

**Actual:** walking and standing work return the next day unless the person ticks a "new" sore again, which an existing sore is not. Only a profile `footStatus` change makes it lasting.

### X2-04. Earphone or lock-screen Play restarts the session under "Stop: something's wrong" and "That exercise stops here"

**Severity: safety (a stop control can be overridden).**

**Where:**
- The media handlers stay registered until the session is done: `src/hooks/useGuidedSession.ts:303–312`.
- `resume` checks only `mayResume`: `useGuidedSession.ts:264–277`.
- `mayResume` is `startGate` alone: `src/pages/SessionPage.tsx:303–311`. It does not know that a safety question is on screen.
- The stop screen pauses (`SessionPage.tsx:418–423`), as does "Worse" (`:397–403`), but both screens are rendered regardless of runner status (`:462–464`, `:486`).

**Repro (browser, P01 in the programme, normal check-in, Start session, Start):**
1. Tap "Stop: something's wrong". The runner status is `paused` and the heading is "Stop: something's wrong".
2. Call the registered media `play` handler and advance 3 minutes. The runner status is **`running`**, the step index went **0 → 3**, and the heading still says "Stop: something's wrong".
3. Separately, at "How does your back feel?" answer **Worse**. The heading is "That exercise stops here" and the status is `paused`.
4. Media Play, then 3 minutes. Status **`running`**, step **18 → 22**, while the screen is still asking the bilateral, saddle and bladder questions.

With the voice on, cue loading resumes with the running status (`useGuidedSession.ts:179–183`), so the coach narrates the next exercises.

**Expected:** the contract interrupts movement when the person reports a change. B03 and B09 require that a stop is settled by answering it, or the session is ended. Starting again is the restart question, asked of what the person reported.

**Actual:** an accidental AirPods tap, a headset reconnect or a lock-screen Play resumes movement before the person has said what is wrong.

### X2-05. A low measured at the pre-cardio glucose check, or at the restart check, gets no rescue instruction and no way to release it

**Severity: safety (missing rescue instruction).**

**Where:**
- On a refusal, the checkpoint flow stays open as kind `checkpoint`: `src/pages/SessionPage.tsx:376`.
- The reading screen shows only the first two reasons, with no `readiness.actions` and no release text: `:835`.
- The 15 g line is rendered only for kind `low`: `:836`.
- The "My symptoms have gone…" box is hidden for kind `checkpoint`: `:846–851`.
- The title and lead stay "Check your glucose / Measure now and enter the reading. Cardio starts once it is in." (`:824–829`).
- The walk's hold card likewise shows reasons and release but not the actions: `src/screens/walk/LiveWalkScreen.tsx:223–257`.

**Repro (browser, P04 in the programme):**
1. Check in at 140 and Start session. Tap Next until "Glucose check", then "Enter my glucose" and type **60**.
2. The screen reads: "Check your glucose. Measure now and enter the reading. Cardio starts once it is in. Glucose 60 mg/dL, from 54 to 69 mg/dL, is a low. Start only when you are 90 mg/dL or above and feel fine. Measure again in 15 minutes, at 09:15 am." It does **not mention 15 g of carbohydrate** or any treatment.
3. 16 minutes later, 95 gives "Start only once your symptoms have gone and your care plan allows exercise after a treated low". There is no control on the screen to say so.
4. Another 16 minutes, 110: the same. The flow can only be ended or left.

The engine's own `actions` hold "Take 15 g of fast-acting carbohydrate, wait 15 minutes, then re-check." The screen never shows them.

**Expected:** H-HYPO says glucose under 70 means stop and use the 15 g, 15-minute treatment. The release is symptom resolution and plan permission, and the screen asking for the reading must be able to record it.

**Actual:** the treatment instruction is dropped, the screen promises cardio, and the session is stuck.

### X2-06. Severe BP with new numbness or weakness, reported in the same check-in, is not an emergency

**Severity: safety (missed emergency).**

**Where:**
- `src/engine/readiness.ts:912–913`: `acute` counts the BP-symptom toggle, `back.suddenSevere` and chest, stroke or breathless, but not `back.newSensory` or `back.newWeakness`.
- The unconfirmed-severe message at `:959` itself says "Call emergency services if you get … weakness, numbness…".
- Guide: `src/content/claims/checks.ts:152–155` (BP ≥180/≥120 with numbness or weakness: get emergency help straight away).

**Repro (in memory, P01-like profile):**
1. BP 186/96, BP-symptom toggle answered "no", and in the back section "New or worse tingling or numbness". Stretch: `allowed=false, **hold**`.
2. The same with "New foot drop… or a leg getting weaker": `**today**`.

**Expected:** E-BP says SBP ≥180 or DBP ≥120 **and** new … weakness, numbness … means emergency help now. The engine already combines one back answer (`suddenSevere`) with a severe reading.

**Actual:** the person reports both facts in one check-in. They are told to call emergency services *if* they get numbness or weakness, which they have just reported.

### X2-07. One answer settles every open serious reading of a kind, so a typo answer can erase a genuine emergency

**Severity: safety (an emergency obligation is lost).**

**Where:**
- The sheet renders one question per kind and answers it with every listed reading's id: `src/components/checkin/CheckInSheet.tsx:318–332`, `src/components/checkin/form.ts:368–380`.
- The engine settles by id: `src/engine/readiness.ts:119–123`.
- The comment at `CheckInSheet.tsx:318` says "Each listed reading is answered for itself".

**Repro (in memory, through the real `formFromRecord` → `visibleQuestions` → `answerEpisode` → `buildCheckIn`):**
1. The day holds 600 mg/dL at 07:00 (a typo), a genuine 650 at 09:00, and 110 now. Permission: **emergency**.
2. The sheet asks one question for ["600 mg/dL at 07:00", "650 mg/dL at 09:00"]. Answering "I typed it wrongly" saves `readings: [both ids], resolution: 'mistake'`.
3. Permission: **reassure**.

**Expected:** B01 requires each incident to be resolved on its own. Codex's P01–P03 are fixed for a reading recorded *after* an answer. Two open readings of one kind must still be answerable separately.

**Actual:** the person can only answer truthfully for both or neither. A truthful "typo" for one removes the other's emergency.

### X2-08. A low that straddles midnight loses its release rules

**Severity: safety (edge-case wrong clearance).**

**Where:**
- Reports and readings are filed under the date of the moment they are made: `src/hooks/useGuided.ts:95–96`.
- `glucoseRules` reads only the current record's readings: `src/engine/readiness.ts:442–450`.
- That covers the repeated-low rule at `:564–571` and the "symptoms gone and plan allows" hold at `:656–662`.
- Only extreme glucose, severe lows, high ketones and confirmed BP pairs cross the date (`:1087–1116`).
- The player's cool-down-only check reads only the record just saved: `src/pages/SessionPage.tsx:254–264`, `:377`.

**Repro (in memory, basal insulin):**
1. Within one day: 62 at 21:56, still 64 at the 15-minute re-check, then 95 with symptoms gone. Result: hold, "That ends exercise for today" (D29(3)).
2. The same readings across midnight: 62 at 23:56 lands in day D, then 64 at 00:12 and 95 at 00:28 land in day D+1. At 00:12 the result is an ordinary first low (re-check hold). At 00:28 it is **allowed, adjust**.
3. Variant: 62 at 23:56 then 75 at 00:12 and 92 at 00:28. That is allowed at 00:28 and again after the restart check-in. Within one day the same sequence holds with "Start only once your symptoms have gone and your care plan allows exercise after a treated low".
4. In the player, `lowSince` then sees no low, so the session resumes in full rather than cool-down only.

**Expected:** D29(3) says a low still under 70 at the first 15-minute re-check ends that session attempt. H-HYPO says never resume just because a reading crosses 70; symptoms and the plan decide. The same session attempt does not end at midnight.

**Actual:** crossing midnight turns a persistent or untreated-recovery low into a fresh day.

### X2-09. The walk carries on after the person reports, during it, that leg symptoms spread further down

**Severity: wrong advice.**

**Where:**
- `src/components/checkin/stop.ts:98–114`: `legReport` sets `spreadToday` but nothing marks walking as the provoking movement.
- `src/screens/walk/LiveWalkScreen.tsx:181–183`: `reportStop` passes the report as is.
- `src/engine/readiness.ts:271–276`: `spreadToday` is adjust.
- The walk restriction shown is "Stop if leg symptoms spread further down your leg": `src/engine/permission.ts:124`.

**Repro (browser, P01):**
1. Check in with pain 1/1 reaching the thigh and Start walk. At 5 minutes: "I need to stop" → Below knee → "Symptoms reach further down my leg than before" → Save leg symptoms.
2. The walk is paused with **Resume offered**. Tapping it gives "Recording while this screen is open".
3. The stored check-in has `reach: 'belowKnee', spreadToday: true` and no exclusion.

The player, by contrast, leaves the provoking exercise out for the day (`provoked`).

**Expected:** A-BACK says that with new distal spread during a movement, the app stops the provoking movement and withholds progression.

**Actual:** the provoking movement is walking itself, and it resumes. The restriction text describes exactly what the person has just reported.

### X2-10. Serious readings from any earlier day never expire, so months-old readings produce emergency and same-day instructions

**Severity: wrong advice (false emergency).**

**Where:**
- `src/engine/readiness.ts:1132–1172` ("Nothing here expires with the date"; every earlier record is scanned) with the messages at `:1125–1130`.
- Untimed readings share an id: `:97–99` (`g:-:<value><unit>`).

**Repro (in memory, metformin-only, today's check-in normal):**
1. With a restored or legacy record from 14 February holding 640 mg/dL, Walk gives **emergency**: "640 mg/dL on 14 Feb: … still needs emergency assessment. Call your local emergency number now."
2. A severe low (50) from 10 January gives "No exercise until you have contacted your care team, and contact them today."
3. A confirmed 184/96 and 182/94 pair from 2 March gives "today".
4. Two untimed 640 readings (10 January and 30 September) get the same id, so one answer settles both.

**Expected:** Codex B01 said to preserve unresolved obligations across a date change, and also: "this is not a proposal to keep every historical severe reading as a permanent emergency." D29(3) frames the level 2 response as a same-day contact.

**Actual:**
- Restoring an old backup or migrating years of history leaves the person facing "Call your local emergency number now" for a reading from months ago.
- To exercise again they must say either "I typed it wrongly" or "A clinician has checked me since", which may be untrue for a real, long-past event.

### X2-11. Track's guidance contradicts the check-in on exercise after a severe low and on a severe BP

**Severity: wrong advice.**

**Where:**
- `src/screens/track/escalation.ts:72–79`, `:140–153`, `:163–178`.
- Check-in: `src/engine/readiness.ts:504–518`, `:955–960`.
- Guide: `src/content/claims/checks.ts:156–158`.
- Sheet alert: `src/components/checkin/CheckInSheet.tsx:427`.

**Repro and actual (code, with the engine output from the probes):**

| Reading | Track says | Check-in says |
|---|---|---|
| Glucose under 54 | "Do not exercise until you have recovered and your plan says you can" | "Glucose below 54 mg/dL is a severe low. **No exercise today**" |
| Level 1 low | "until your symptoms have gone and your plan says you can" | "Start only when you are 90 mg/dL or above and feel fine" |
| Severe BP, re-check | "Sit and rest, then check again **in a minute**" (the Guide also says "rest for a minute") | "Sit quietly for **5 minutes** and measure again" |
| Severe BP, exercise | "Do not exercise **until you have spoken to your doctor**" | "no exercise today"; nothing is carried, so movement is allowed the next day |

**Expected:** one rule per row of the contract. D29(3) says a level 2 low ends the session attempt, with no automatic restart.

### X2-12. After a profile change, the outcome banner's "Now" list still shows the old advice, such as "Drink some water" for a person who has since recorded a fluid limit

**Severity: wrong advice.**

**Where:**
- `src/components/checkin/OutcomeBanner.tsx:24` renders `readiness.actions` from the record it is handed, while the headline and reasons come from a fresh `permission`.
- The sheet hands it the stored record's readiness: `src/components/checkin/CheckInSheet.tsx:283`, `:303`. `sheetGate` keeps the first, stored candidate on a tie: `src/components/checkin/sheetState.ts:143–151`.
- The player's gate does the same: `src/pages/SessionPage.tsx:166`, `:460`.
- Stored records are returned unevaluated when nothing is waiting: `src/components/checkin/pending.ts:192–193`.

**Repro (in memory):**
1. Check in with 320 mg/dL while `fluidRestriction: false`.
2. Record a prescribed fluid limit in the profile.
3. The fresh permission gives hold, "Glucose above 300 mg/dL…". The banner's list is the stored ["Glucose over 300 mg/dL. Drink some water.", "Glucose over 180 mg/dL… Drink some water."]. A fresh evaluation would say "Keep to your fluid plan."

**Expected:** F13 and the H-DIZZY contract row say that where a fluid limit is recorded, the app never suggests extra fluids.

**Actual:** the old advice stands until the person resubmits.

### X2-13. Walk summary after a low counts the re-check from the finish and always says "Take 15 g … now"

**Severity: wrong advice (timing).**

**Where:**
- `src/screens/walk/WalkSummary.tsx:21`, `:107` (`finishedAt + 15 min`).
- `src/screens/walk/guidance.tsx:53–58` ("Treat the low now", `TREAT`).
- The engine times the re-check from the low itself: `src/engine/readiness.ts:607`.

**Repro (code trace):**
1. "I feel low" at 10:00, reading 60 at 10:01. The engine's `recheckAt` is 10:16.
2. The person stays on the hold card and taps "Finish and save" at 10:11.
3. The summary says "Your re-check is due at 10:26" and repeats "Take 15 g of fast-acting carbohydrate now", whatever was entered on the hold card.

**Expected:** H-HYPO says re-check 15 minutes after treatment.

### X2-14. The Guide says one-leg weakness worsening over hours *or days* is an emergency; the check-in and both stop controls ask only "over hours"

**Severity: inconsistency (with safety consequence).**

**Where:**
- `src/content/claims/daily.ts:216–218`.
- `src/components/checkin/CheckInSheet.tsx:459` and `src/components/checkin/stop.ts:79` ("It is getting worse quickly, over hours").

**Repro (code trace and engine):** weakness worsening over two days is not "over hours". With only `newWeakness` the result is "today". With `weaknessFast` it is "emergency" (probe: `weaknessFast` gives emergency).

**Expected:** one definition of rapid progression. T-NEURO sends rapid progression to the emergency rules, and the Guide cites NICE NG127 1.7.4 as hours or days.

### X2-15. Check-in glucose is timed when the sheet is saved, BP when typed, so a reading over an hour old passes the 30-minute rule

**Severity: inconsistency (weakens D29(6)).**

**Where:**
- `src/components/checkin/CheckInSheet.tsx:216`: typing a number clears `glucoseAt`.
- `src/components/checkin/form.ts:472–478`, `:502`: `measuredAt: at ?? stamp`, where `stamp` is the moment of saving.
- BP rows keep the moment they were typed: `CheckInSheet.tsx:224–227`.
- Freshness is checked at `src/engine/permission.ts:176–191`.

**Repro (in memory, real `buildCheckIn`):**
1. Glucose 140 typed when the BP was typed (09:00), sheet saved at 09:40.
2. The saved reading has `measuredAt 09:40` and the BP `at 09:00:30`.
3. At 10:05 the insulin user's walk is **reassure**, 65 minutes after the number was typed.

**Expected:** D29(6) says a pre-session glucose must be from the last 30 minutes, measured at the time of the reading.

### X2-16. A declared Flare-up makes Stretch and Today gentle, but the guided session from Move runs at full loading

**Severity: inconsistency.**

**Where:**
- `src/engine/stretch.ts:222–225`, `:300` treat a flare as an irritable back.
- `planFor` and `buildSessionPlan` take no status: `src/hooks/useGuided.ts:47–58`.
- Today: "Only gentle movement is suggested until you change it": `src/health/recommend.ts:574–579`.
- Status label: "Back or leg worse: gentle movement only": `src/screens/today/StatusSheet.tsx:16`.

**Repro (in memory, back and sciatica history, Flare-up from today, check-in pain 1):**
- Guided: kind `full` with goblet squat (squat level 2), bench press, row, leg curl, dead bug and suitcase carry. Permission **reassure**; the only change is an unrelated swap.
- Stretch the same day: "A gentler routine: your back is in a flare-up."

**Expected:** D25. The stretch builder's own comment says the person "has already said it".

### X2-17. The player's "I feel low" screen gives an unconditional oral instruction, with no line for someone who cannot swallow

**Severity: inconsistency.**

**Where:**
- `src/pages/SessionPage.tsx:824–837`: "If it is low: take 15 g…"; no emergency line.
- The walk's low screen does have it: `src/screens/walk/guidance.tsx:106–109`.
- So do Track's steps: `src/screens/track/escalation.ts:62–63`.

**Repro (code trace):** compare the three screens' text.

**Expected:** E-HYPO says that where the person cannot swallow safely, call emergency help and give no oral instruction. The player is often run with a helper nearby.

### X2-18. The in-session reading screens accept a number in the wrong unit, then say "Get medical advice today"

**Severity: polish (fails safe).**

**Where:**
- The player's and walk's reading screens reject only `implausible`: `src/pages/SessionPage.tsx:810`, `src/screens/walk/guidance.tsx:88`.
- The sheet blocks the same entry and offers confirmation: `src/components/checkin/form.ts:396–397`, `CheckInSheet.tsx:356–369`.
- `suspectUnit` becomes "today": `src/engine/readiness.ts:474–487`.

**Repro (in memory):** a mmol/L profile types 95 (meaning mg/dL). The result is `today`: "95 does not look like mmol/L. If it really is 95 mmol/L … emergency assessment … No exercise until the unit is confirmed." The headline is "No exercise today. Get medical advice today." The screen offers no unit confirmation.

**Expected:** the same unit check as the sheet. H-DATA says confirm ambiguous units.

### X2-19. Check-in messages give mg/dL thresholds to people who use mmol/L

**Severity: polish.**

**Where:**
- `src/engine/readiness.ts:511`, `:526`, `:609`, `:651` (`mgText`, "from 54 to 69 mg/dL", "below 54 mg/dL").
- Track uses the person's unit: `src/screens/track/escalation.ts:56–58`.

**Repro (in memory):** a 3.0 mmol/L reading gives "Glucose 3 mmol/L, from 54 to 69 mg/dL, is a low. Start only when you are 90 mg/dL or above".

**Expected:** D29(1) says both units are first-class. A mmol/L user should be told 5.0, not 90.

### X2-20. Track's red-flag note omits the sexual-dysfunction sign of cauda equina and rapidly worsening one-leg weakness

**Severity: polish.**

**Where:**
- `src/screens/track/QuickLog.tsx:716–726`, `src/screens/track/BackLeg.tsx:165`.
- Compare the check-in's saddle label (`src/components/checkin/copy.ts:12`) and the Guide (`src/content/claims/daily.ts:205`, `:216`).

**Expected:** E-CES lists new sexual dysfunction with back pain radiating into a leg. T-NEURO sends rapid progression to emergency.

---

## Verified fixed from earlier audits

Each row was re-run against the current tree.

| Earlier finding | Now |
|---|---|
| Codex gap: ketones skipped when glucose is low; urine converted to blood | Glucose 60 + blood 3.0 → emergency. Urine "moderate" → emergency on its own scale. |
| Codex gap: 600 runnable; unit rounding at 53.9/69.9/89.9/300.1/600 | All exact and near boundaries agree in mg/dL and `x/18` mmol/L (54 → level 1, 53.9 → today, 70 and 89.9 → pre-low hold for insulin, 300.1 → hold, 600 → emergency). |
| Codex gap: BP averaged before severity; 180/80 and 120/120; >160/>100 | Each reading is judged on its own. 180/80 and 120/120 are severe (hold, re-check). 161/80 and 150/101 hold. 160/100 is adjust. |
| Codex gap: insulin with no reading; unknown medicines | Hold (`noReading`); `medicinesUnknown` hold. |
| Codex gap: foot drop offered recovery; dizzy runnable | Foot drop → today (on its day; see X2-02). Dizzy with 110/70 → hold. |
| Codex gap: emergency blocked by an invalid glucose; cauda flag lost on profile edit | `submitBlocked` returns null with any emergency ticked (`form.ts:392`). Hidden back answers keep `caudaEquinaFlag` (`form.ts:538–540`). |
| B01 P01, P02, P03, P28 | A typo answer no longer settles a later genuine 192/82 (hold), 650 (emergency) or ketones 3.1 (emergency). 600 at 23:59 then 110 at 00:01 → emergency carried. The residuals are X2-07, X2-08 and X2-10. |
| B01 P04 | "Not settled yet" appends `reopened` and is honoured (`form.ts:376–378`). |
| B02 sheet stale on incoming data and out-of-order saves | `sheetGate` takes the strictest of the incoming, saved and optimistic records, and `afterSave` ignores older sequence numbers (`sheetState.ts:110–152`). `sheet.callers.test.ts` passes. |
| B03 restart callers | The player's Resume, Keep going and media Play all go through `mayResume` → `startGate`. Walk restore, Resume and return ask the full question (`walk/gate.ts:40–44`). The Workout Log asks the full question after 30 minutes or a restore (`screens/workout/gate.ts:58–72`). The live walk is asked every second and on every store change. See X2-04 for the remaining gap. |
| B04 refused writes shared by all gates | Walk, Workout, Today and the player read `effectiveCheckIns`. The merge is lossless across a second failed save (`pending.ts:289–321`). Tests pass. |
| B05 archived plans | `reconcilePlan` re-doses or refuses remaining work against fresh builds (tests pass). |
| B06 dismissible low and checkpoint; premature "measured"; normal check → cool-down | Full-screen flows with no close. The checkpoint is logged only after an accepted non-low reading, and a normal reading continues to cardio. See X2-05 for the low branch. |
| B07 partial severe BP + symptoms | "190 / blank" + symptoms is saved as `bpPartial` → emergency. |
| B08 non-diabetic SGLT2 unanswered | `ketoneRisk` true; the DKA emergency item and blood ketones are asked. |
| B09 worse-symptom qualifiers | Rapid weakness and both legs → emergency. The "Worse" screen cannot be dismissed, and the provoking exercise is recorded at the tap. See X2-04 and X2-14. |
| F13 non-renal fluid limit; F15 saved Stretch as Guided | Honoured in the engine (see X2-12 for display). Stretch mode and slot preserved. |

## Checked and fine

- **Every entry asks the same shared `permission`.** This covers:
  - Today's card, the chooser, Move rows, Stretch setup and Walk setup (`useStartMovement`)
  - the live walk's start, restore, return and resume, and its per-second live gate
  - `/session`, `/session?resume=1` and `/session?mode=stretch…` deep links (arrival gate)
  - the ready-screen Start
  - the Workout Log's start, restart and live stages
  - reminder links, which go to Walk setup, not into a walk

  The only bypasses found are X2-01 (inputs never reach it) and X2-04 (asked at the wrong moment).
- **The runner never enters refused steps.** Next, Previous and earphone next or previous all pass over them, and the glucose checkpoint cannot be skipped.
- **A foot wound in the profile:** across fullGym, homeDumbbells and homeNone, six programme days and every Stretch area and length, no weight-bearing step was planned. Walk is held, and the meal-walk and sitting prompts are switched off.
- **Severe BP** escalates across saves and on confirmed pairs. The single-reading and partial paths behave as specified.
- **Emergency wording** names no country's number. A low that cannot be treated by mouth (`lowCantTreat`) suppresses every oral instruction.
- **Test suites:** 15 safety test files, 456 tests, all pass (engine contract, reaudit, permission, readiness, check-in, walk gate and live, workout gate, session).
- **A note, not a finding:** with an active foot wound the catalogue deliberately keeps floor drills such as the glute bridge (`catalog.test.ts`, the `FLOOR` list), which presses through the heels. That is a clinical judgement for the owner's reviewer, not something I could verify against the contract either way.

## Not checked

- Real iPhone behaviour: physical AirPods and lock-screen events (simulated by calling the registered handler), audio interruption, Wake Lock and storage eviction.
- Two open tabs, including whether a refused write held in one tab's memory reaches the other.
- Time-zone travel and DST around a check-in's date.
- The Restore flow through the UI. Its engine effect was tested in memory with restored-style records (X2-10).
- The full acceptance suite (D34) was not run. Only the targeted browser cases above were.
- Clinical accuracy of the food, B12, vitamin D, sleep and desk content, beyond the claims that touch movement gating.
