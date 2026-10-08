# Claude scan 2: journeys across feature boundaries

**Summary:** 14 open verified findings: 2 safety, 3 wrong advice, 4 broken journey, 5 polish. No data-loss or new accessibility finding. Three more were reproduced during the scan and fixed by other agents before it ended; they were re-measured as fixed and are listed under "Checked and fine". The worst open ones:
- J2-01: two lows the app itself recorded in the last 24 hours do not stop the next morning's walk when the check-in's question is answered "None".
- J2-02: "Stop: something's wrong" during a lift records no worsening, and the next checkpoint files "Same" against the lift just left out. The loading ladder therefore counts the provoking hinge as a calm exposure.
- J2-06: any lab test that is due takes Today's only prompt slot. For people with diabetes, that hides the water row and every reminder they turned on.

## Scope, method and code state

- **Code:** the working tree of `fix/voice-start-and-audit` (HEAD `f21db7a` plus uncommitted changes), 8 October 2026, 15:05 to 17:15 IST.
  - Other agents edited the engine, store, player, walk, Track and Welcome files throughout.
  - My watch-free server serves a module as it was when first requested, so I restarted it at 16:21, 16:47 and 17:01.
  - Every finding below was re-run on the 17:01 server (see "Final pass").
  - Line numbers are as of 17:12.
- **Browser:**
  - `playwright-core` headless Chromium, through `scripts/e2e/acceptance/lib/env.mjs`, against my own `vite --config scripts/e2e/vite.nowatch.config.mjs --port 5281` server.
  - Context 430×932, `deviceScaleFactor` 3, `isMobile`, `hasTouch`, `timezoneId: Asia/Kolkata`, `locale: en-IN`.
  - Key screens repeated at 320×568 and in dark mode.
- **Personas:**
  - P01, P04 and P06 from `scripts/e2e/acceptance/fixtures/personas.mjs`, seeded once into `localStorage['fit-strong-90-data']` by a guarded init script. P07 (no data) for the first runs.
  - Variants are named where used. Every mutation went through the UI.
- **Time:**
  - `page.clock` was installed, then moved with `setFixedTime` and `fastForward`, through mornings, after meals, midnight and the following days.
  - Days were joined by saving `storageState({ indexedDB: true })` and opening the next day in a new context from it.
- **Overlap with the parallel scans:** J2-03 partly overlaps X2-05 in `claude-scan-2-safety.md`, which covers the walk's hold card. I say what it adds.
- **Clean-up:** scratch scripts, states, backups and screenshots lived in `/tmp/claude-scan2-journeys/` and are deleted. My server is stopped.

## Findings

### J2-01 · safety · Two lows the app recorded in the last 24 hours do not stop the next morning's walk

**Persona and day:** the first-run person on long-acting insulin (P07: type 2 diabetes, basal insulin and metformin, meter, cleared for moderate exercise). Thursday 8 to Friday 9 October.

**Steps:**
1. Thursday 07:38: on the after-breakfast walk, tap "I feel low" and enter 62 mg/dL on the walk screen. My Day shows "Glucose 62 mg/dL, Low".
2. Thursday 21:30: Track → Add → Glucose → 64, "Bedtime". My Day shows "64 mg/dL · At bedtime · Low".
3. Friday 07:00: Today → "Check in & walk". The sheet asks "Lows in the last 24 hours", with nothing pre-selected and no mention of the two lows it holds. Answer "None", glucose 118.
4. Outcome: "Go ahead, with changes", then "Continue to walk".

The same morning, answered "Two or more", gives "No walk for now. Two or more lows in the last 24 hours: no exercise today".

**Expected:** the app's own record of two lows within 24 hours counts towards that rule. At the least, the question is pre-filled from it, or the person is told what the app holds.

**Actual:** the rule reads only the person's answer.
- `src/engine/readiness.ts:414`: `lowTwoPlus` and `lowOne` come from `news` alone.
- `src/components/checkin/CheckInSheet.tsx:507`: the question is filled from the form alone.
- Earlier days carry only serious readings (`carriedRules`, `src/engine/readiness.ts:1323`), so a level 1 low is never carried.

### J2-02 · safety · "Stop: something's wrong" during a lift records no worsening, and the next checkpoint files "Same" against the lift just left out

**Persona and day:** the person with low back pain and left sciatica, in the programme (P01), Thursday 8 October. The chart half was also seen for the person in a flare (P06).

**Steps:**
1. Start Full Body B. At the Trap Bar Deadlift warm-up set, tap "Stop: something's wrong".
2. Choose reach "Thigh", tick "Symptoms reach further down my leg than before", then tap "Save, and leave this movement out today".
3. Resume. The player says "Left out today, because of your check-in: Trap Bar Deadlift".
4. The next step asks "How does your back feel? Compared with before that exercise…", still about the deadlift. Answer "Same" and finish.
5. The stored session holds `symptomChecks: {"trap-bar-deadlift": "same"}` and status "completed". The check-in holds `spreadToday: true` and `provoked: ["trap-bar-deadlift"]`.

For P06, after the same stop during Prone Press-Up, Track → Back & leg lists 8 October as "Worse during a session: No".

**Expected:** a movement that sent symptoms further down the leg is recorded as worse (A-BACK). The Back & leg screen says so itself: "The ladder steps down after a session where symptoms got worse". The D21 chart marks it.

**Actual:**
- The stop control's leg path reports into the check-in only. It logs no "worse" for the session (`src/pages/SessionPage.tsx:454-457`). Only the checkpoint's own "Worse" does (`:415`, `:608`).
- The checkpoint after a left-out exercise is still asked, and its answer is filed against that exercise (`:609`; `src/session/logging.ts:63-68`).
- The ladder and the chart read only `symptomChecks`:
  - The ladder does not step down, and the provoking hinge counts as one of the four clean exposures that promote it (`src/engine/progression.ts:98-127`).
  - The chart shows no worsening (`src/screens/track/backLegSeries.ts:174`).

### J2-03 · wrong advice · After a confirmed low on a walk, the walk and Today never state the treatment, and Today never gives the re-check time

**Persona and day:** P07, Thursday 07:36 to 07:54.

**Steps:**
1. On the walk, tap "I feel low". The hold card says "If you cannot check, treat it as a low: Take 15 g of fast-acting carbohydrate now, re-check in 15 minutes".
2. Enter 62 and save. The card now says only:
   - "Glucose 62 mg/dL… is a low. Start only when you are 90 mg/dL or above"
   - "Check with a meter, treat a low by your plan…"

   The 15 g step and any time are gone.
3. Finish and save. On the 17:01 tree the summary says "Re-check at 7:53 am · After treating the low at 7:38 am…", still without the treatment itself.
4. Back on Today: "Re-check your glucose · Check with a meter, treat a low by your plan…". It shows no time at 07:39 or at 07:54, and asks for a meter check although the reading is in.
5. For comparison, the player's low screen for the same 62 (P04, a stretch) says "take 15 g of fast-acting carbohydrate, wait 15 minutes, then measure again. Measure again in 15 minutes, at 09:16 am".

**Expected:** one set of words for one state, wherever it is shown. After a confirmed level 1 low: treat it with 15 g, and re-check at a stated time.

**Actual:**
- The walk card renders the reasons and the release, never `actions` (`src/screens/walk/LiveWalkScreen.tsx:230-231`).
- Today's re-check detail is `recheck.release ?? recheckWhen(ctx)`. A release always exists, so the time is never shown (`src/health/recommend.ts:441`, `:493`).
- The merge keeps the first release of equal rank (`src/engine/readiness.ts:1537`). That is the suspected-low text, "Check with a meter…" (`:403`), not the confirmed low's "Treat it, then re-check in 15 minutes".

**Overlap:** X2-05 notes the walk card's missing actions. This finding adds Today's card, and the disagreement with the player.

### J2-04 · wrong advice · In a flare, right after a stretch that sent symptoms to the foot, Today offers the same stretch again: "Both are fine today"

**Persona and day:** the person in a sciatica flare (P06), Thursday 8 October, about 08:20.

**Steps:**
1. With Flare-up set, check in with back 4 and leg 5 below the knee, and start the Back & hips stretch.
2. During Prone Press-Up: "Stop: something's wrong", reach "Foot", "Symptoms reach further down my leg than before".
3. Finish the stretch and save it with back pain 5.
4. Today: "A gentle stretch, or rest · Gentle mobility for your back and hips, or simply rest. Both are fine today." with a one-tap "Gentle stretch". Nothing mentions the worsening.

**Expected:** a routine done today is not pushed a second time, as `preference` already ensures for a stretch focus. After symptoms spread during it, rest is the suggestion.

**Actual:** the status suggestion has no done-today or worse-today check (`src/health/recommend.ts:569-581`; compare `:634`).

### J2-05 · wrong advice · Around midnight Today suggests a walk, including straight after one

**Persona and day:** P07, Thursday night into Friday 9 October. P04, the same night.

**Steps:**
1. P07 leaves Today open past midnight. At 00:02 it reads "Friday, 9 October · An evening walk · Check in & walk". This person is on insulin and had a low that morning. The app's own Guide card says activity "can lower your sugar while you move and for hours afterwards".
2. P04 checks in at 23:45 and walks 25 minutes, to 00:10. After saving, Today at 00:10 again says "An evening walk · You chose moving more as your focus".
3. My Day for Thursday shows "Walk · 11:45 pm · 25 min". Friday's My Day says "Nothing recorded yet today". Track's Walking chart shows 15 min on 8 October and 10 min on 9 October.

**Expected:** no prompt to go for a walk in the small hours, and none straight after a walk the person has just saved. One day's figures agree across Track.

**Actual:**
- 00:00 to 03:59 count as "evening" (`src/health/recommend.ts:119-123`), and the focus suggestion has no hour guard (`:635`).
- A walk counts as done only on the day it started, from its first observation (`:199`).
- The same rule keeps the walk off Friday's timeline (`src/screens/track/timeline.ts:315`), while D10 correctly splits its minutes by day.

### J2-06 · broken journey · Any lab test that is due takes Today's only prompt, so water and every waiting reminder vanish from Today for people with diabetes

**Persona and day:** P07, Thursday 11:00. Water reminders are on, every 2 hours from 09:00, and so are walks after meals. P01 and P02 were given the same water habit for comparison.

**Steps:**
1. At 11:00, with Today open, the water reminder fires. Today shows nothing: by design no banner floats on Today, and its own slot shows "Add your last HbA1c".
2. Switch to Track. The banner "Time for a glass of water · I had a glass · Later" is there.
3. Back on Today, there is still only "Add your last HbA1c".
4. P01, on metformin for more than 4 years, gets "Vitamin B12 check" in that slot, with the same result.
5. P02, without diabetes, sees "Water today · Not entered · Add 250 ml", and at 11:00 the reminder inline on Today.

**Expected:** the reminders a person turned on show on the screen they use most. A standing lab nudge does not hide them. By the app's own ranking, a missing first HbA1c is "the least urgent of all".

**Actual:**
- `pickPrompt` returns any due item before a waiting reminder or the water row (`src/screens/today/model.ts:194-197`).
- The floating banner is hidden on Today (`src/reminders/place.ts:25`).
- "Add your last HbA1c" stays due until a result is entered (`src/health/cadence.ts:73`, `:302`). For a new person with diabetes, that is from the first minute.

### J2-07 · broken journey · The after-meal walk (D26) is not offered to a "Move more" person, is suppressed for the day by any walk, and every link to it forgets the meal

**Persona and day:** P07, Thursday 13:31, with walks after breakfast (08:30), lunch (13:30) and dinner (20:30). P04 variants with focus "Move more" and "Stretch", same habit.

**Steps:**
1. P07 walked after breakfast. At 13:31 Today says "A gentle stretch, if you like · You have already moved today", with nothing about lunch.
2. P04 with focus "Move more", no walk yet, at 13:35: "An afternoon walk · You chose moving more as your focus". With focus "Stretch": "An afternoon stretch".
3. Today's "Walk now" and the banner's "Start a walk" both open Walk on "Just a walk", with no meal. The person must choose "After a meal" and the meal again. Left as it opens, the walk is saved without the meal.

**Expected:** D26. The after-meal walk is its own thing, offered within 45 minutes of the chosen meal's finish. Each meal's walk is separate, and a link from an after-meal prompt opens Walk on that meal.

**Actual:**
- The meal walk lives only in `gentle()`, which comes after the focus preference (`src/health/recommend.ts:383`). For a "Move more" person the preference always answers first (`:635`).
- `gentle()` skips the meal walk once any walk is done today (`:697`).
- Its action and the banner's link go to `/walk` with no `meal` (`src/health/recommend.ts:703`; `src/reminders/ReminderBanner.tsx:105`).
- Walk reads `?meal=`. The comment there names an after-dinner prompt link that does not exist (`src/walk/plan.ts:131`).

### J2-08 · broken journey · Tapping Today's "Glucose 64 mg/dL" opens a chart that hides that reading and the day's lows

**Persona and day:** P07, Thursday 21:35. The day's readings: check-in 140, 62 and 95; a "Before a meal" 108; a "Bedtime" 64.

**Steps:**
1. Today shows "Glucose · 64 mg/dL · 9:30 pm". Tap it.
2. Glucose opens on "Before", "Showing readings before meals and fasting". The chart and the list hold only the 108, with a target band.
3. The 64, and the 62 low, appear only after choosing "Other" or "All".

**Expected:** the screen a row opens shows the number on the row.

**Actual:**
- The view defaults to "Before" whenever any before-meal reading exists (`src/screens/track/MetricDetail.tsx:119`).
- Today's row links without a group (`src/screens/today/TodayScreen.tsx:323`).
- Untagged check-in readings fall in "Other" (`src/screens/track/targets.ts:79-83`).

### J2-09 · broken journey · After "Explore first", Today never says the health questions are missing, and choosing Walk runs the whole check-in only to refuse

**Persona and day:** a first run (P07) choosing "Explore first", Thursday 09:00.

**Steps:**
1. Welcome → Explore first → Start. Today asks "What would you like to do?". There is no "Finish your health profile" row.
2. Choose something else → Walk. The full check-in opens. Answer it.
3. Outcome: "No walk for now · Finish the health questions in your profile first".

**Expected:** Today says up front that movement needs the health questions, as it does for a stored profile with gaps. The check-in is not asked first.

**Actual:**
- Today and `recommend` treat "no profile yet" as "no gap" (`src/screens/today/TodayScreen.tsx:230`; `src/health/recommend.ts:360`).
- The gate uses a default profile marked unreviewed (`src/hooks/useGuided.ts:69`).

### J2-10 · polish · The same session is 39 minutes on its summary and in Track, and 38 on Today

**Persona and day:** P01, Thursday. Full Body B, 2,312 s of active time. Also P06's 10-minute stretch, which Today counts as 9.

**Steps:** the summary says "Full Body B · 39 minutes" and Track's row says "39 min". Today says "38 min of movement recorded this week".

**Actual:**
- Today and the weekly ring floor the minutes (`src/screens/today/model.ts:90`; `src/screens/track/movement.ts:240-242`).
- The summary and the Track row round them (`src/pages/SessionPage.tsx:1189`; `src/screens/track/format.ts:219`).

### J2-11 · polish · "Week 3 of 12" counts from the start date, but "This week" counts Monday to Sunday

**Persona and day:** P01, whose start date is Thursday 24 September. Monday 12 October.

**Steps:**
1. Thursday 8 October starts Week 3, and Full Body B is done ("1 of 3 sessions this week").
2. On Monday 12 October, still Week 3, Today says "Week 3 of 12 · 0 of 3 sessions this week".
3. Your plan shows "Week 3 of 12", then a "This week" list from Monday 12 to Sunday 18. It leaves out the Week 3 session done on the 8th. It lists Thursday 15 October, which is in Week 4, as "Full Body B · Coming up".

**Actual:**
- The programme week counts from the start date (`programmeWeek`, used at `src/screens/move/PlanScreen.tsx:146` and `:187`; `src/lib/utils.ts:91`).
- The week list and Today's count use Monday weeks (`src/screens/move/plan.ts:111-117`; `src/screens/today/model.ts:133`).

### J2-12 · polish · A Flare-up day reads as a missed session on Your plan, and the Status sheet's "weekly count" is not the count people see

**Persona and day:** P01, in a flare from Saturday 10 to Monday 12 October, back to Normal on Tuesday 13. P06 for the wording.

**Steps:**
1. On Tuesday, after "Move my plan back 3 days", Today says "0 of 2 sessions this week", leaving Monday out (D25). Your plan lists "Monday · Full Body A · Not recorded".
2. The Status sheet says "Days with a status are left out of your weekly count". P06 is not in the programme, so the only weekly count they see is "9 min of movement recorded this week", and it includes the flare day's stretch.

**Actual:**
- Your plan ignores status periods (`src/screens/move/plan.ts:137`).
- Only the plan row's count leaves them out (`src/screens/today/model.ts:134`).
- The wording is at `src/screens/today/StatusSheet.tsx:92`.

### J2-13 · polish · Trends' Back & leg row joins values from different records under one source

**Persona and day:** P06, Thursday. The morning check-in gave back 4 and leg 5. After the stretch, the back was 5.

**Steps:** Track → Trends reads "Back & leg · 2 days recorded this week · After a session · Back 5 · Leg 5". The leg 5 comes from the morning check-in. Nothing about the leg was recorded after the session.

**Actual:** the latest back value and the latest leg value are picked separately, then labelled with the newer one's source (`src/screens/track/trends.ts:74-85`).

### J2-14 · polish · One low journey writes the time three ways, and a no-exercise answer still gives exercise preparation

**Persona and day:** P07 and P04, Thursday. P07 on Friday answering "Two or more" lows.

**Steps and actual:**
- The same kind of moment is written three ways:
  - The walk summary: "Re-check at 7:53 am" (`src/walk/readout.ts:304`).
  - The player: "at 09:16 am" (`src/pages/SessionPage.tsx:845`, `toLocaleTimeString` with two-digit hours).
  - The check-in sheet: "Last reading: 62 mg/dL at 07:38", on a 24-hour clock (`src/components/checkin/sheetState.ts:78`).
- "No walk for now… No more exercise today. Try again tomorrow." is followed under "Now" by "follow your plan for carbs before exercise, and check again before cardio". Preparation is withheld only at "today" and above, so a hold that ends the day still gets it (`src/engine/readiness.ts:1557`).

**Expected:** one time format throughout, and no exercise preparation beside "no more exercise today".

## Final pass

Every check below was re-run on a server started at 17:01, against the tree as it stood then. Results:

- **Still reproduce:** J2-01 to J2-14. For J2-03, the walk summary's wording changed while I watched; the finding is stated against the 17:01 wording.
- **Fixed during the scan**, reproduced earlier and re-measured as fixed:
  - **C2-01:** a check-in glucose corrected in Track. On the 15:05 tree, correcting 140 to 60 left the check-in at 140 and let a walk start. On the 16:21 tree, the check-in follows the correction.
  - **X2-01:** a reading logged in Track never reached the gate. On the 15:05 and 16:47 trees:
    - P04: glucose 62 logged in Track at 13:00 after a 12:50 check-in of 140. Track said "Do not exercise", but Today offered "Walk now", and Start walk went straight into a recording walk.
    - P01: BP 186/112 and 184/110 logged in Track after a normal check-in. Today offered "Start session", and the player ran.
    - Today told the person on insulin "Your last reading was 6 hours ago" beside a Track reading 26 minutes old.

    On the 17:01 tree all three are fixed. Today says "Re-check your glucose" or "No exercise today. Get medical advice today". Start walk opens the check-in, and the fresh Track reading counts.
  - **X2-16:** on the 16:47 tree, a declared Flare-up still let Today's own "Choose something else" start "Full Body C · 45 min" at full loading (Hip Thrust, Push-Ups, Assisted Pull-Up). On the 17:01 tree it is the 26-minute recovery session. Move calls it "Recovery · 26 min". Today's chooser still names it "Full Body C · 26 min", a small label mismatch.

## Checked and fine

- **Welcome, first run with type 2 diabetes on long-acting insulin:**
  - The answers are stored as given: `insulinRegimen: basalOnly`, metformin, meter, clearance moderate, `medicinesReviewed`.
  - Start lands on Today with "A morning walk", and a check-in comes before it.
- **Walk "I feel low":** recording stops, and the walk is held until a reading taken afterwards.
  - A 62 holds the walk.
  - A re-check sooner than 15 minutes is refused, with its due time.
  - 95 at 07:54 with symptoms gone gives "Go ahead, with changes", with the after-low limits.
- **Reloads:**
  - A reload in the middle of a walk returns to the running walk, with its time.
  - A stretch left part-way offers "Continue your stretch · 7 min left" the same day, and is banked once, as partly done, the next morning.
  - A guided session saved once shows once in Track, in the plan row and in the week.
- **Midnight:**
  - A walk that crosses midnight splits its minutes by day (D10).
  - Today's date and Glucose row ("Not entered") move to the new day without a reload.
- **High BP and its re-measure:**
  - 168/104 holds the session, with "Rest 5 minutes and measure again properly".
  - Re-measuring at 132/84 and 130/82 releases it, and keeps the first pair as earlier readings.
  - The Workout Log honours the hold.
- **Backup and a new device:**
  - Exported at 20:00 through the download fallback, a 3 KB `.json.gz`, and restored through Welcome in a fresh context.
  - All 32 observations, all 3 sessions and every settings document came back identical, apart from revision bookkeeping.
  - Today on the new device matched.
- **Status:** Flare-up is set from Today. Back at Normal, "Move my plan back 3 days" shifts the start date by three days and records the answer on the period.
- **Stop control in a stretch:** the provoking movement is left out for the day, "Previous" skips it, and the player says why.
- **Navigation:**
  - Re-tapping a tab pops it to its root, and each tab keeps its own place.
  - A Track screen opened from a Today row stays in Today's stack, with "Back to Today".
  - In a three-deep Guide stack, each Back pops one level, with no duplicated history.
- **Guide:** the long-acting insulin and "how often to check" cards agree with the check-in's thresholds: under 54 is a serious low, and the care team is contacted today.
- **320×568, light and dark:** nothing overflows sideways or sits off screen on these screens, and contrast looked right by eye:
  - Today with a BP hold
  - the live walk's hold
  - the walk summary
  - Back & leg
  - Your plan
  - My Day
  - Glucose

## Not checked

- **On-device iOS behaviour:** Wake Lock, audio and voice (the personas are muted), the share sheet, storage eviction, timers in a backgrounded app, real safe-area insets.
- **Sensors and outside services:** GPS and step counting on a walk (location was denied throughout), Apple Health, and Calendar reminding while the app is closed.
- **Display:** large text sizes and VoiceOver.
- **A single continuous week:** days were joined through saved storage states. These keep IndexedDB and web storage, but not in-memory state such as waiting reminders.
- **Other flows:** the Workout Log's set-by-set flow, Meal ideas and Food preferences, editing the profile in the middle of a journey, and a merge restore onto a device that already holds data.
