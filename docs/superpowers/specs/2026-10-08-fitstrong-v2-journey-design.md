# FitStrong v2: the end-to-end user journey

**Status:** draft 3, 8 October 2026. Reconciled from two independent audits of draft 2:
- Codex (GPT-6.1 Sol, max effort): findings A-01 to A-78, plus 26 missing journeys;
- Kiro (Opus 5.5): findings K-01 to K-61, with a walkthrough of each persona.

Every finding and what happened to it is in `2026-10-08-fitstrong-v2-audit-log.md`.

**Companions:**
- `2026-10-08-fitstrong-v2-motion-design.md`: how everything moves (M1–M24);
- `docs/research/v2-design-research.md` and `docs/research/v2-feasibility-research.md`: the evidence behind the material, map, food and platform choices.

**Builds on:** the reimagined app on branch `feat/reimagine-holistic-health` (PR #3), its decisions in `docs/reimagine/BOARD.md` (D1–D36), and its safety engine. Where this spec says "as v1", the behaviour and its tests stay exactly as they are.

---

## 1. The brief and how it's measured

### 1.1 What the owner asked for

1. **Set up once.** The first run captures everything the app needs: body, health, medicines, movement, food and habits. After that, every launch opens Home.
2. **Home asks "What would you like to do?"** It shows large tiles in broad groups (move, eat, check, learn), with a "+" to add more.
3. **Each tile opens a hub** that shows what to do right now and the recommendation, with a weekly goal, a day strip and big Start cards.
4. **Trends like Apple Health and Fitness:**
   - rings;
   - period tabs;
   - the average with its change;
   - bars against the previous period;
   - secondary stats;
   - the workouts list;
   - a "keep moving" empty state.
5. **Walks with a map:** route, steps, distance, time and pace, with the history of every walk.
6. **An All Categories list.**
7. **Everything stays in the browser,** with export and import at any time.
8. **Apple Liquid Glass styling** and beautiful, flowing animation. "Even my grandma can use it": intuitive and easy, yet feature-rich.

### 1.2 Success criteria

**Setup** (a measured inventory, not a time promise, A-23 and K-25):
- At most 20 pages on the minimal path (no conditions), and at most 30 on the complex path (diabetes on insulin, treated high blood pressure and sciatica). The programme's Join flow isn't counted, because it's the same flow the Workout hub uses. A test, `setup.pages.test.ts`, counts both paths from the chapter definitions (L-01).
- Every question can be answered by tapping, or in a number field with typing. Where safety allows, a question offers "Not sure".
- Completion time is measured in testing for both paths, never claimed in the app.

**Every later launch** opens on Home with no interstitial (§7).

**Taps from Home.** Each deliberate activation counts: a tile, a button, a stepper press, a Save, a consent choice. Typing digits doesn't count. Two exceptions are stated and counted separately:
- the check-in, when one is due;
- first-use consents.

| Task | Budget | Path that meets it |
| --- | --- | --- |
| Start the recommended activity | 1 | The Right now card's button runs it directly through the gate (§4.1, §7.4) |
| Start a stretch | 2 | Stretch tile → Start |
| Start a walk | 2 | Walk tile → Start walk (repeat use; first use adds the two consent questions, §9.1) |
| Log a glucose reading | 3 + typing | Glucose tile → Add reading (opens the glucose form) → Save |
| Log a usual meal | 4 | Food tile → a "Your usual" meal → Lunch (preselected by time, so a check) → Save |
| See this week's trend for anything | 2 | Trends → the category row (Trends lists every category with data, not just pinned ones) |

**Grandma test:**
- Automated: a script that uses only visible, labelled controls runs §17's tasks on every build.
- Before release: people aged 65 and over complete the same tasks unaided on a real iPhone, using VoiceOver and large text where they normally do (A-76). This is listed as device-only, as D34 does.

**No regressions:** every safety rule and every acceptance journey J01–J20 still passes. Where v2 changes how someone gets somewhere, only the navigation steps change in the test; the clinical outcomes it asserts stay the same (A-76).

## 2. Constraints that don't change

- **Local-only.** IndexedDB on the device, with no account, no server, no paid API and no API key. Health data never leaves the device.
  - The only network requests are the app's own files, plus OpenStreetMap picture tiles when the person has turned on map pictures. Those load only on a saved walk's summary or detail, never during a live walk (§9.1, §9.5).
  - Export and calendar files leave the device only when the person shares them.
- **Devices.** The iPhone 13 Pro Max on iOS 27 (Safari 27) is the reference: 428×926 CSS px portrait, safe areas respected. Supported: iOS 18 and later (same-document view transitions). Older browsers get the same app without transitions.
  - 320×568 and text at 200% must work, with WCAG 1.4.10 reflow at 320 CSS px and desktop at 400% zoom.
  - Design tokens are in CSS px. "pt" in this spec means a logical point, which is the same as a CSS px.
- **Safety engine.** It alone decides every start, resume and continuation (§4). The redesign changes where things are and what they look like, never what is allowed.
- **Clinical content.** Only cited claims are made (D32). There's no dosing advice, no diagnosis, and no generated calorie or carbohydrate target (§11.5).
- **Voice.** Only recorded Kokoro packs are used, and every spoken line is in the catalogue (the packs test enforces this).
- **Language.** Indian English, with Indian food names and portions. Times follow the device clock (`src/lib/time.ts`).
- **Build.** v2 sits behind a development flag until its navigation is complete. Then the launch route and the v1 redirects switch together (A-77).

## 3. Decisions

### 3.1 New, or reversing a board decision (each is recorded on the board with the owner's brief as its reason)

| # | Decision | Reverses or extends |
| --- | --- | --- |
| V1 | One setup flow captures everything. Its first page offers "Look around first" for anyone who wants to explore before answering (J01 kept) | Replaces v1's Welcome flow |
| V2 | Home is a greeting, the "How are you today?" status, the Right now card, "This week", and tiles in groups. The person can show, hide and reorder tiles | Reverses D5's "no icon grid", C5, and the board's rejection of pinning. Keeps D5's one stated recommendation and D20's always-visible reason |
| V3 | Tabs: Home · Trends · Browse · Me, on a floating glass tab bar with labels always visible | Reverses D4 (Today · Move · Track · Guide, with You as a button) |
| V4 | Hubs: one navigation pattern with four variants (movement, reading, food, learn; §8) | New |
| V5 | Optional food logging, with estimates per Indian portion, saved meals, and a counts-free mode | Reverses D9 ("no food diary"), with the guards in §11.5 that answer D9's evidence (hard-to-log Indian food, a narrowing diet) |
| V6 | Optional on-device route saving and an optional online map, each a separate opt-in | Reverses "your route is never stored". D18 is kept (§9.2) |
| V7 | Energy burned is estimated as "about" kcal, with the formula in §12.4 | New |
| V8 | A category colour for each category's icon, chart and ring. The single action tint stays for buttons and links | Extends D12 |

### 3.2 Kept from the board, explicitly

- **D31:** movement counts by the week. The only ring is this week's movement against the person's own weekly goal (§7.3).
- **D19:** no streaks, badges, points or milestones. Draft 2's V9 milestones are dropped; a factual "Your week" summary replaces them (§12.6).
- **D18:** no WebGL while tracking, and the live view re-renders at most once a second.
- **D35:** a guided programme session needs enrolment. A person who isn't enrolled is offered "Join the programme", never an undefined session.
- **D14 and D10:** steps come from in-app walks or an entered total, with the source shown. There's no manufactured total, and a day with nothing reads "Not entered".
- **D16:** installing is explained in the first run. **D17:** backup reminders.
- **D22:** content only with a written licence.
- **D25:** status. Normal · Flare-up · Unwell · Away, set from Home.
- **D26:** the after-meal walk. **D27:** a step goal the person owns.
- **The midnight rules:** each walk segment counts for its own day (F17). The small hours count as the evening before only for suggestions (`dayPartOf`).

## 4. Safety contracts

Every screen, sheet, animation and shortcut in v2 must keep all of these. Each has a caller-level test (§21.3).

1. **Decided at the tap, checked again before moving** (A-01, K-19).
   - Every Start, Carry on, Resume, earphone Play and chooser row asks the shared gate at the moment of the tap.
   - Just before movement actually begins, after a check-in, a permission prompt or a transition, the effective safety state is evaluated once more: restart checks for Start and Resume, continuation checks while moving.
   - If the decision changed since the screen was drawn, the new decision is shown instead of acting.
   - **The words don't go stale either** (L-07). Home and hubs work out their text again at the earliest time boundary among the current permissions: a glucose reading's freshness running out, a re-check's due time, 04:00, midnight, or the app becoming visible again. v1's `freezeKey` gains that boundary as an input, so "Waiting for your re-check at 1:45 pm" is never left on screen after 1:45 pm.
   - This applies to direct links, saved progress, manual workout timers, media controls and anything that runs when an animation ends.
2. **A hub never makes its own decision.** Tiles, hubs, Browse rows and deep links use the same gate for the same mode, so they always agree with Home (K-04, A-08).
   - A movement tile's line comes from `permission(input, mode)`, with the copy in §7.5.
   - A permission for the mode takes precedence over the empty, loading and recommendation states.
3. **Urgent first** (A-02, K-01 to K-03).
   - Urgent text and the safe action render at once, readable in the first frame.
   - Any running transition is cancelled, and no old snapshot is left over it.
   - Surrounding effects may follow; the information never waits for them.
4. **Closing guidance never clears it** (A-03).
   - Tapping "I feel low", "I need to stop" or a stop answer saves the stop or low at once.
   - Closing or swiping away the guidance leaves movement paused and the incident open.
   - Only the engine's own release condition allows Resume.
5. **Durable saves** (A-04).
   - Guidance appears whether or not the write succeeds.
   - "Saved" appears, and a form closes, only after the write is confirmed.
   - If a write fails, the draft, the guidance and the effective safety state are kept, with "Try again", through v1's existing failure recovery.
6. **Corrections don't resolve incidents** (A-05). Undo, delete, retiming, imports and later normal readings never resolve a real low, stop or flag. Corrections keep their history, and resolution follows each incident's own rule, as v1 does.
7. **Urgent is visible everywhere** (A-46).
   - While an emergency or a "get advice today" decision is current, a slim stop-ink banner sits under the nav bar on every screen, Trends and Browse included: "Emergency answer today: what to do".
   - It's never dismissible while the decision stands.
   - Past abnormal records keep their date and their past-tense wording.
8. **Status comes first,** as v1 does: "Carry on" isn't offered while Away or Unwell, and during a flare only a stretch can be resumed (A-34).
9. **Safety is never quietened** (A-74). Quiet hours and reminder preferences never hold a glucose re-check, a stop or a safety deadline. The app says plainly that it can't alert anyone while it's closed (§15).
10. **Measured values show when they were measured** (A-12).
    - A clinical value always shows its measured date and time, unit, and context (fasting, after a meal).
    - Prefill never stamps a new measurement time.
    - HI and LO, the unrounded stored value and the source are kept.

## 5. Information architecture

```
Floating glass tab bar (labels always shown):  Home · Trends · Browse · Me

Home ─┬─ Greeting and date · "How are you today? Normal" (status) · "2 reminders" (only when any)
      ├─ Urgent banner (only while an emergency or "advice today" decision stands)
      ├─ Right now card (one recommendation, its reason, one primary action, "Something else")
      ├─ This week (Move ring against the weekly goal · Stretched N days · Steps today) → Trends
      ├─ "What would you like to do?" tile groups:
      │     Move:  Workout · Stretch · Walk · Steps
      │     Eat:   Food
      │     Check: Glucose · Blood pressure · Back & leg · Weight · Water · Sleep · (Waist · Labs)
      │     Learn: Learn
      ├─ "See today's log" → Today's log (§13)
      └─ Edit Home

Hubs (§8): /hub/{id} for every category in the registry (§5.1)
Today's log (§13): /day/:date, every record of a day, correctable
Trends (§12): Your week · This week's ring · every category with data → its trend
Browse (§14): Search · every category, grouped · pick mode for "+ Add"
Me (§16): Finish setting up · Profile & health by chapter · Goals · Food · Reminders · Voice ·
          Display (theme, text size, Reduce motion, Reduce transparency) · Data · About
```

**Full-screen tasks** have no tab bar: setup, the guided or stretch player, and the live walk. Sheets (the check-in, Add reading, Log a meal, status, the chooser) open over the current screen.

**Desktop (1024 px and wider):** the tab bar becomes a glass sidebar, tiles flow into 3–4 columns, and hubs put their history in a second column.

### 5.1 The category registry (one source for tiles, hubs, trends, Browse and routes)

`src/categories.ts` defines each category once (A-28, K-14). Every surface reads from it, and a test checks that every entry has a working hub, trend and Browse row.

| id | Title | Group | Hub variant | Default tile when | Movement mode | Trend |
| --- | --- | --- | --- | --- | --- | --- |
| workout | Workout | Move | movement | always | guided | sessions, minutes |
| stretch | Stretch | Move | movement | always | stretch | minutes, days |
| walk | Walk | Move | movement | always, unless walking is held by a standing foot restriction | walk | minutes, distance |
| steps | Steps | Move | reading | a step goal is set, or steps have ever been recorded, unless walking is held by a standing foot restriction (L-09) | — | daily steps |
| food | Food | Eat | food | always (meal ideas work with tracking off, A-20) | — | kcal and carbs (tracking on only) |
| glucose | Glucose | Check | reading | diabetes, or "Not sure" | — | readings |
| bp | Blood pressure | Check | reading | high BP, a BP medicine, or a home cuff | — | readings |
| back | Back & leg | Check | reading | back pain, sciatica or neuro history, or "Not sure" | — | pain scores (D21's chart) |
| weight | Weight | Check | reading | fill-in tile (see the rules below) | — | readings |
| water | Water | Check | reading | a water habit is set | — | daily ml |
| sleep | Sleep | Check | reading | fill-in tile | — | hours |
| waist | Waist | Check | reading | never by default | — | readings |
| labs | Labs (HbA1c, B12, Vitamin D) | Check | reading | diabetes (for HbA1c) | — | dated points |
| learn | Learn | Learn | learn | fill-in tile | — | — |

**Rules for the default tiles:**
- The "when" rules are worked out once, at the end of setup or on the first v2 launch. After that, the person's edits always win (A-38). Turning food tracking off changes what the Food hub can do; it never hides a tile the person kept.
- **Fill-in tiles:** if fewer than 9 tiles qualify, Weight, Sleep and Learn are added, in that order, until there are 9.
- **Too many:** fill-ins are only added up to 9, so they never cause this. If the "when" rules alone give more than 9, Labs is dropped first, then Water, then Steps, until 9 remain. Dropped tiles are listed under Edit Home → Hidden. A group with no tiles hides its heading (L-14).
- **"+ Add"** is always last and doesn't count toward the 9.
- **A category that becomes relevant later** (diabetes added in Me, say) is offered once, as a row in Me: "Add Glucose to Home?". It's never added silently.
- **BMI** is derived and has no form. It shows on the Weight hub, with links to edit height and weight.

## 6. First run: "Set up once"

### 6.1 Shape and rules

**Eight chapters.** A glass capsule shows "About you · 2 of 8", and each chapter skips its pages that don't apply.

- **Autosave:**
  - Every answer goes into a draft as it's given.
  - If the draft can't be saved, a caution line says "Your answers aren't being saved on this phone" and offers "Try again". The answers on screen are kept (A-26).
  - Reopening the app resumes on the same page, with "Welcome back, let's carry on".
- **Back** is always visible and never loses answers. **Next** only moves once its answer is stored, so a fast double-tap can't skip a question (M22).
- **Clinical answers never default.**
  - "Not sure" is a real answer, stored as `unsure`, and the engine treats it as "may have".
  - Preferences have labelled defaults, such as "Usual: 250 ml glass".
- **Skipping:**
  - "Skip for now" exists only on preference pages.
  - A skipped safety question stays a gap, never a "No". The engine's existing "Before you start" hold (the `profileGap` path) covers it, and the hold says which chapter it needs ("Answer 2 questions about your back").
- **"Set up once," made precise** (A-25):
  - Completed answers are kept and reused.
  - The app asks again only for things that change: today's symptoms and readings at check-in, a changed medicine, or a safety gap.
  - It always says why: "Do you have a fluid limit? It changes your rest-time advice."
- **Accessibility first.** Text size, Reduce motion and Reduce transparency are on page 1, under "Display" (A-66).

### 6.2 Chapters and pages

| Ch. | Pages (shown only when they apply) |
| --- | --- |
| 1. Welcome | **Page 1:** "Your health, in one place. Everything stays on this phone." Buttons: "Get started" (primary), "Restore from a backup", and "Look around first" (quiet). A Display row covers text size, Reduce motion and Reduce transparency. A line on installing (§6.5) |
| 2. About you | **Page 1:** "What should we call you?" (optional, shown on screen only; the coach never says names) and "Year you were born" (a number field, for example 1958, checked to be 1920 to this year minus 18, K-43). **Page 2:** "Body for the exercise demos": Male figure / Female figure / Either. **Page 3:** height and weight, each a number field with a unit switch (cm or ft-in; kg or lb). **Page 3, collapsed:** "Waist (optional)" with "How to measure" |
| 3. Your health | **Page 1:** "Do you have any of these?" A grid of chips with "Not sure" on each, plus "None of these": diabetes · high blood pressure · heart or circulation · kidney disease · eye problems from diabetes, or eye treatment in the last 3 months · foot problems (numbness, a wound or ulcer) · back pain or sciatica · other. **Follow-up pages for each "yes" or "Not sure",** asking exactly the engine fields in §6.3. **Last page, after a heart, kidney, eye, BP or back answer:** "Has a clinician given you exercise limits or targets?" (`clearance`, `clinicianTargets`; L-12) |
| 4. Your medicines | **Page 1, always** (A-06, K-05): "Do you take any regular medicines?" Yes / No / Not sure. **Page 2, if yes or not sure:** "Do any of these apply?", independent of diagnosis: insulin · a tablet that can cause lows (gliclazide, glimepiride, repaglinide…) · a "-gliflozin" medicine for diabetes, heart or kidneys · metformin · a beta-blocker · a water tablet (diuretic) · something else · Not sure. **Then:** insulin regimen (if insulin), metformin since when (if metformin), and the monitors (glucose meter or CGM, home BP cuff) |
| 5. Your back and feet | **Asked only after a back, foot or neuro answer:** where it hurts (a body picture with tappable areas, plus the same areas as a list for screen readers), then one page for which side and what makes it worse, then any past neurological problem and any foot restriction a clinician gave you. "What helps" is optional (L-01) |
| 6. Your movement | **Page 1:** "What would you most like to do?" (one choice, K-20), stored as `focus`: Stretch more → `stretch` · Walk more → `move` · Get stronger → `strength` · Not sure yet → `explore` (L-12). With it, "Do you exercise now?" (`currentlyActive`). **Page 2:** "Your weekly goal": minutes of movement a week, or "No goal for now" (D31). It's never raised automatically. Only when the focus is Walk more or Get stronger does it add "WHO suggests 150 minutes of moderate activity a week" (L-13). **Page 3:** "Join the 12-week strength programme?" Yes / Not now. "Yes" opens the programme's own Join flow (experience, place and equipment, days, length), the same flow the Workout hub uses, so it isn't part of setup's page count (L-01). The daily step goal is set in Me → Goals, not in setup (L-01) |
| 7. Your food | **Page 1:** eating pattern (vegetarian · eggetarian · non-vegetarian · vegan · Jain), and allergies or foods to avoid (chips plus "Something else"). Allergies are hard filters (§11.5). **Page 2:** "Would you like to log what you eat?" No (meal ideas only) · Yes, meals only, no numbers · Yes, with calorie and carb estimates. **Before the estimates option is stored** (K-22): "Has food or weight ever been hard for you?" Yes / No / Prefer not to say. Yes or Prefer not to say offers "Meals only, no numbers" as the recommended choice, and the estimates option stays available |
| 8. Your day and coach | **Page 1:** reminders: water (glass size and hours), sitting breaks, after-meal walks (not offered with a standing foot restriction, K-30), quiet hours, and whether reminders come in the app or as a calendar file. **Page 1b, only if after-meal walks are on:** usual meal times (L-11). **Page 2:** voice on or off, with "Hear the voices" to choose one (optional) |

**Review: "Here's what we'll do for you."**
- One card per chapter, each with "Edit".
- Then three concrete things, generated from the answers. For example: "Suggest a 10-minute stretch for your back each morning", "Ask for your glucose before exercise", "Remind you to drink water every 2 hours from 9 am".
- Then "Start using FitStrong".

### 6.3 Every engine input and the question that sets it (A-07, K-05)

`setup.fields.test.ts` asserts that every `UserProfile.health` key the engine reads is reachable from a setup question, under that question's condition. A field that no question sets fails the build.

| Engine field (v1 names) | Question | Asked when |
| --- | --- | --- |
| `diabetes` type | Diabetes: "Which type?" 1 · 2 · other · Not sure | diabetes yes or not sure |
| `hypertension`, `bpTreated` | High blood pressure; "Do you take medicine for it?" | yes or not sure |
| `cardiac` (heart or circulation, symptoms on effort) | the heart chip and its follow-up | yes or not sure |
| `kidney` and its stage, if known | the kidney chip and its follow-up | yes or not sure |
| `fluidRestriction` | "Has a doctor given you a fluid limit?" | heart or kidney yes or not sure, and always on the "something else" path |
| `retinopathy`, `recentEyeTreatment` | eyes chip: "Treatment in the last 3 months?" | yes or not sure |
| `neuropathy`, `footWound` (active ulcer), `footRestriction` | foot chip and its follow-ups | yes or not sure |
| `priorDkaOrInsulinDeficiency` | "Have you ever had DKA, or been told your body makes little insulin?" | type 1, insulin, a "-gliflozin", or not sure |
| `ketoneTest` | "Can you test ketones (blood or urine)?" | type 1, insulin or a "-gliflozin" |
| `dizzyOnStanding` | "Do you get dizzy when you stand up?" | BP medicine, a diuretic, or heart chip |
| `highHypoRisk`, `insulinRegimen`, `sulfonylurea` | the medicine classes | from chapter 4 |
| `sglt2` | the "-gliflozin" chip | always reachable from chapter 4, whatever the diabetes answer |
| `metforminSince` (B12 cadence) | "Since when?" | metformin |
| `clearance`, `clinicianTargets` (D29(4)) | "Has a clinician given you exercise limits or targets?" Yes (enter them) / No / Not sure | heart, kidney, eyes, BP or back answers |
| `currentlyActive` | "Do you exercise now?" | chapter 6, page 1 |
| back: `pain.areas`, `side`, `aggravators`, `neuroHistory` | chapter 5 | a back answer |

The plan's first task confirms each name against `src/types` and the engine, and corrects this table where a v1 name differs. It never drops a row.

### 6.4 Edge cases

- **"Look around first"** goes to Home with every movement Start behind the profileGap hold. The Right now card reads "Finish setting up (about 5 minutes)", and Learn, Browse and readings work (J01 kept).
- **Restore on page 1** runs v1's restore flow: file check, summary, then the "Replace" confirmation.
  - A backup with a finished profile goes straight to Home.
  - A backup without one continues setup with its answers filled in.
- **Upgrading part-way:** v1 Welcome answers that were in progress (focus, health) fill in v2 setup (K-57).
- **Private browsing, or storage refused.** v1's storage-failure screens are kept. The app doesn't claim to detect private mode (A-26); a draft that fails to save says so.
- **"Delete everything"** in Me → Data returns to page 1.

### 6.5 Installing and keeping data

- **Page 1 of setup** explains it in one line: "Add FitStrong to your Home Screen so iPhone keeps your data. Show me how" (D16). It's never a blocking step.
- **Safari and the installed app** are treated as not sharing data until a device check shows otherwise (§22). So the end of setup in Safari offers: "Moving to the Home Screen app? Make a backup first, then restore it there" (A-27).
- **Keeping data:** the app asks for persistent storage (`navigator.storage.persist()`). Safari tabs fall under the 7-day rule; Home Screen apps keep their own count of days of use (§22).
- **Me → Data** always shows the install and backup status: "Not installed: this browser may delete data after 7 days unused" and "Last backup: never" (K-24, D17). Installing improves how long data is kept, but it isn't a backup.

### 6.6 Upgrading from v1

- **There's no interstitial.** Home opens with tiles worked out from the existing profile (§5.1).
- **A one-time row**, shown inline as the first row under the Right now card and never floating (K-56): "FitStrong has a new Home. Your tiles are here; Trends and Browse are new". Buttons: "Show me" (3 short cards) and "Got it".
- **New questions are never forced.** Name, meal times and food logging wait as "Finish setting up · 2 short chapters" at the top of Me, with "Not now".
- **Old addresses** redirect with their query strings (§19.3).
- **Migration is additive and atomic** (§18.3). The same inputs give the same safety decisions before and after: an upgrade test compares the engine's output on each persona's data before and after migration (A-36, Codex Q9).

## 7. Home

### 7.1 Layout, top to bottom (428 CSS px wide)

1. **Header.** "Good evening, Asha" at large-title weight, with the date beneath.
   - Under it, a labelled button: "How are you today? Normal ▸". It opens the status sheet (D25, K-13).
   - At the right, only when reminders are waiting, a labelled capsule: "2 reminders".
   - Me is a tab, so there's no avatar (K's Q5).
2. **The urgent banner** (§4.7), only while it applies.
3. **Right now card** (§7.4).
4. **This week** (§7.3). Tap → Trends.
5. **"What would you like to do?"** The tile groups, each under its heading: Move, Eat, Check, Learn (A-37).
   - Two columns at 375 CSS px wide and above, with text at 130% or less. Otherwise one column (K-26, A-59).
   - Tiles are at least 120 px tall and as tall as their content. Titles wrap and are never truncated.
6. **"See today's log"** (§13) and **"Edit Home"**: two labelled rows.

**What Home never shows:** charts beyond the week ring, more than one recommendation, banners other than the urgent one, or a modal on launch.

### 7.2 Tiles

Each tile shows:
- an icon in a circle of the category's colour;
- the title;
- a live line;
- a caution dot with words when something is due today ("BP check day").

Live lines carry a measured date where it matters: "112 mg/dL · today 9:05 am", or "Last: 112 mg/dL · Mon".

**Tapping a tile opens its hub** (M3). Pressing and holding opens a small menu: Hide from Home · Move up · Move down · Edit Home (M18). The same actions are always in Edit Home.

### 7.3 This week

- **A single Move ring:** recorded movement this week, Monday to Sunday, against the person's weekly goal. "64 of 150 min this week".
  - With no goal, there's no ring, just "64 min moved this week" and "Set a weekly goal".
  - The ring never shows more than 100%, and doesn't fill for a rest day.
  - A planned rest day shows as a "Rest" mark in the day dots beneath, never as fabricated activity (A-39).
- **Beside it, plain values:**
  - "Stretched 3 days";
  - "Steps today: 4,210 in FitStrong walks", or "Steps today: 6,050 entered at 6 pm", or "Steps: not entered" (D14, A-47). There's no steps line when walking is held for the feet (L-09).
- **Under it, 7 day dots** (M T W T F S S): filled for a day with movement, a small "R" for a planned rest, hatched for Away, Unwell or Flare-up.
- **Reaching the goal** adds a calm line, "Weekly goal reached", with no animation beyond the ring's normal change (D19).

### 7.4 The Right now card

**What it shows:** v1's one recommendation (`src/health/recommend.ts`, D5 and D20), in v1's order of precedence:

1. safety: an emergency, "get advice today", a glucose re-check, or a hold on the mode;
2. the small hours;
3. carry on a session started today (never while Away or Unwell; only a stretch during a flare);
4. status;
5. the after-meal walk;
6. the focus;
7. a habit;
8. the programme session;
9. done or rest;
10. too little to go on.

Two adjustments:
- **The after-meal walk** (row 5) is skipped when walking is held by a standing foot restriction, so the card offers the next row rather than a hold at every meal (K-30). Its card has two buttons: "I've had lunch: walk now", which tags the walk as after lunch, and "Just a walk". Either is one tap, and the tag comes from the person's own answer, because a usual meal time doesn't prove a meal happened (A-10, L-05).
- **The card's primary action runs directly** (K-32): "Start stretch" → the check-in if one is due → the player. There's no hub step in between. The gate is asked at the tap and again before movement (§4.1).

**The secondary row** (v1's `pickPrompt`), at most one:
- a timely due reading;
- otherwise a waiting reminder (only while the status is Normal and nothing is held);
- otherwise another due item, or the water line.

Food prompts are a reminder subtype, ranked like any other reminder. There's at most one a day, after the meal time, and none once that meal is logged (A-73).

**"Something else"** opens v1's gate-aware chooser sheet, whose rows show any refusal before a tap (S-15). Below its five rows, a separated footer link, "All categories", opens Browse. A footer link isn't one of the "at most 5 main choices" (K-35, A-31, L-15).

**States:** safety states use stop or caution ink and render at once (§4.3). The card is never dismissible.

### 7.5 What a movement tile says (one copy table, K-58)

| Gate for that tile's mode | Live line | In its hub |
| --- | --- | --- |
| allowed | the normal line ("Full Body B · 45 min") | Start |
| allowed with changes (adjust) | the normal line + "· with changes" | Start, with the changes listed |
| hold that only needs a check-in (`needsCheckIn`, with every reason a check-in or fresh-glucose reason) | the normal line + "· check in first" (L-03) | "Check in & start", which opens the check-in |
| hold (that mode only) | the gate's own headline, for example "No walking for now", "Check glucose first", "Waiting for your re-check at 1:45 pm" | the reason and safe action; no Start |
| profile gap (`healthUnreviewed`, `medicinesUnknown`) | "Finish setting up", naming the chapter (L-03) | "Answer 2 questions about your medicines" → that setup chapter |
| Workout, not enrolled (D35) | "12-week programme · not joined" (L-03) | "Join the 12-week programme" and "Stretch instead" |
| emergency or no exercise today | "Not today" | the stop card, the same as Home's |
| status Away or Unwell | "Paused" | "Paused while you're unwell", with "Change status" as the primary action and a quiet "Start anyway", which still goes through the gate |
| status Flare-up | Workout: "Gentle only today" (v1 plans a recovery session); Stretch: "Gentle stretch" (v1's gentler routine); Walk: its normal line, with "Stretch is suggested today" (no flare walk exists, L-08) | the flare-adjusted options |

**Status never blocks movement on its own** (L-04). The gate blocks, and status changes the suggestion and the words. This matches v1: during Away or Unwell the chooser still lists movement through the gate, and the check-in still asks about being unwell. `movementLine()` is the one function every tile and hub uses for these words.

### 7.6 Edit Home

Edit Home opens from its row, or from a tile's menu. In edit mode:
- each tile has labelled buttons, "Hide", "Move up" and "Move down", and a drag handle (K-39, A-62);
- tiles move within their group, and the groups stay in the same order;
- "+ Add" opens Browse in pick mode, where each row shows "Add" or "Added";
- "Done" stores the layout.

Hidden tiles are listed at the bottom of edit mode under "Hidden", with "Show".

### 7.7 Desktop

Same order. The tiles flow into 3–4 columns, and Right now and This week sit side by side.

## 8. Hubs

### 8.1 Shared navigation

- A glass nav bar. Its Back shows the actual opener's name ("Home", "Browse", "Trends"), and returns there with scroll and focus restored (A-32, K-59). A direct link's Back goes to Home.
- The hub title, with the category's colour as a soft tint behind the nav bar.
- One primary action per region; button words are verbs.

### 8.2 Variants (A-37)

**Movement hub** (Workout, Stretch, Walk):
1. **Right now:** the recommended thing for this mode today, with its reason, length and a big Start (or the gate's reason, §7.5).
2. **Options:** the alternatives, each with Start.
3. **This week:** the Monday–Sunday day strip, and progress toward the weekly goal. Below 375 px or above 130% text, the strip becomes a list of 7 rows (K-42).
4. **History:** the last 3 entries, then "Show all".
5. **"See trends."**

**Reading hub** (Glucose, BP, Steps, Back & leg, Weight, Water, Sleep, Waist, Labs):
1. **Latest:** the latest value with its measured date and time, unit, context and v1's interpretation. "When to check next" comes from the cadence engine.
2. **"Add reading":** it opens that metric's form, so it's one tap.
3. **This week:** values.
4. **History:** with corrections.
5. **"See trends."**

Steps' first action is "Add today's steps"; its options are "Daily step goal" and "How steps are counted".

**Food hub** (§11.2).

**Learn hub:** "For you" topics first, then all topics, and search (v1 Guide).

### 8.3 Hub contents

- **Workout:**
  - **Enrolled:** Right now is today's session ("Full Body B · 45 min · mobility, strength and cardio") or "Rest day" with "Stretch instead".
  - **Not enrolled** (D35, K-07, A-09): "Join the 12-week programme" (primary) and "Stretch instead".
  - **Options:** "Your plan" (the 12 weeks, plus "Leave the programme" with confirmation), "Find an exercise" (the library with 3D demos), "Log a workout" (manual, with its provenance shown), and "Weekly goal".
- **Stretch:**
  - **Right now:** the recommended routine, with its area, length and a reason from real inputs only. "Your back felt stiff yesterday" appears only with a pain answer behind it.
  - **Options:** v1's approved mobility routines, through its builder (D36): Back & hips · Neck & shoulders · Hips & legs · Whole body, at 10 or 15 min.
- **Walk:**
  - **Right now:** "Start walk", with the kind chosen by context ("Just a walk", or "After lunch" once confirmed). Quiet chips for Target, Map on/off, Save route on/off.
  - **Options:** "After a meal", "Walk with a target (time)", and "How walks are measured".
- **Learn:** see §8.2.

### 8.4 Hub states

| State | Right now | Starts |
| --- | --- | --- |
| Normal | The recommendation | Enabled |
| A hold or stop for this mode | The gate's card, the same as Home's | Replaced by the reason, never a grey button with no words |
| Away or Unwell | "Paused while you're {away/unwell}", with "Change status" | Start becomes a quiet "Start anyway" through the gate (L-04) |
| Nothing recorded yet | "Add your first {reading}", with why. The gate still decides first (§4.2) | As the gate says |
| Loading | Content-shaped placeholders after 150 ms, static under Reduce motion. Navigation and Back stay usable (A-71) | — |
| Failed | v1's "This screen didn't load" with "Try again" | — |

## 9. Walking and steps

### 9.1 Starting

- **The gate first,** as v1 (S-15): a refusal shows before any tap.
- **First walk ever: two separate questions,** each answerable later in Me (A-51, K-09):
  1. **"Keep a record of your route on this phone?"** Yes / No. Routes are stored only on the device.
  2. **"Show map pictures under your saved routes?"** This is asked only if routes are kept. The plain disclosure: "Map pictures come from OpenStreetMap. When you open a walk, they receive your internet address and the map squares for that area, so they can tell roughly where you walked. Your readings and your route file are never sent." Options: Show map pictures / No pictures. No map picture is ever requested before "Show map pictures", and none during a live walk (§9.2).
- **First walk ever: a one-time card on step counting** (K-29): "iPhone stops counting steps when the screen locks. Hold the phone or keep it in your hand with the screen on." It's shown before asking for motion access.
- **Motion and audio are unlocked inside the tap that starts recording** (A-53, L-02). iOS accepts `DeviceMotionEvent.requestPermission()` and audio playback only during the click handler of a user's tap. So both are requested synchronously in the handler of whichever tap finally starts the walk: the check-in outcome's Start, the walk preflight's Start, or the Right now tap when nothing comes in between. This happens on every cold launch. If it's refused, the walk records time (and distance with location) and says "Steps not counted". A unit test checks that the request runs synchronously in that handler.
- **If location is refused,** there's "Walk without location": time, plus steps if motion is allowed. Steps from the sensor are kept (A-47).
- **The final Start** asks the gate again (§4.1).

### 9.2 Live walk (full screen, D18 kept)

- **The route** sits in the top half, drawn as a line on a plain grid with a "you are here" dot (feasibility research, map decision). There are **no map pictures during a live walk**: nothing is fetched while tracking, so the map company can't follow a walk as it happens, and D18 holds.
  - The drawing is redrawn at most once a second (K-08).
  - It keeps the whole route in view by stepping its scale. Zoom in, Zoom out and "Show whole route" are labelled buttons (A-54).
- **Stats:** a solid panel (not glass, A-68 and K-28) with time (the largest), distance, pace and steps, each with its unit.
  - Pace shows only while there's valid distance (A-48).
  - Energy isn't shown live, only in the summary.
- **Controls:** Pause/Resume (big), Finish, "I need to stop" and "I feel low", as v1.
  - Stop and low sheets follow §4.4.
- **Voice cues:** at 10, 20, 30, 45 and 60 minutes, from recorded lines only, with no composed numbers (A-72).
- **The screen:** Wake Lock where supported. If it's refused or released, a line says "Keep this screen on to keep tracking".

### 9.3 Gaps and segments

v1's walk clock (`src/walk/clock.ts`) keeps:
- segments, each closed by pause, hidden, left, interrupted, midnight or finished;
- each segment credited to its own day (F17).

v2 draws each observed segment separately. A gap is never joined by a line (A-48), and the summary lists it: "Not tracked for 6 min (screen off)".

**Elapsed time within a segment** uses `performance.now()` deltas, so changing the device clock or time zone mid-walk doesn't distort it. Device-clock stamps are kept only for which day each segment counts toward (F17), and Today's log lists a walk on the day it started, as v1 does (L-10).

### 9.4 Walk edge cases

| Situation | What the person sees | What's kept |
| --- | --- | --- |
| Location refused | "Walk without location", plus how to turn it on | Time; steps if motion is allowed |
| Weak GPS | A "Finding your location…" chip. Distance waits; it doesn't guess | Rejected fixes aren't drawn |
| Screen locked or app hidden | On return: "Tracking paused while the screen was off (6 min)" | A gap segment |
| App closed or crashed mid-walk | On the next launch, an inline row on Home under the Right now card: "Your walk on Tuesday was interrupted at 18 min. Save it?" (Save / Discard). Any urgent card ranks above it (A-57) | The stats and route segments written as the walk went (journalled when route saving is on) |
| Midnight | The walk carries on in a new segment | Each day's share |
| Map pictures fail to load (offline, or the map service refuses) | The route drawing alone, with "Map pictures unavailable" | Unchanged |
| A stop or low | v1's flows, at once. The map stays behind the sheet | As v1 |
| Storage full mid-walk | "This phone is out of space. Your walk is kept on this screen; free some space and tap Save" | The walk stays in memory until saved |

### 9.5 Summary and detail

- **The map**, when a route was saved, shows our own route drawing with its segments and start and end markers. With map pictures on, a small static map made of OpenStreetMap picture tiles sits underneath, with "© OpenStreetMap contributors" visible.
  - The map is our own code (about 3 KB), not a map library, and it fetches only the tiles for this one route's area. There's no prefetching, no offline copies and no bulk download, as OpenStreetMap's tile policy requires.
  - Zoom in, Zoom out and Recentre are labelled buttons.
  - "Hide map" shows the stats only, hiding the route and all locations (A-51).
  - **One opt-in, not a tap on every view** (L-21): the research suggested a "Show map" tap on each summary. The spec uses the one-time choice in §9.1 instead, which can be changed in Me → Data, because a repeated tap on every walk is friction for older users. The disclosure is the same, and nothing loads before the choice. This is a deliberate departure from the research.
- **Stats:** time moving, distance (covered time stated), average pace (only with valid distance), steps ("counted while the screen was on: 12 of 20 min"), and about how many kcal (§12.4). Also the after-meal tag, if confirmed.
- **Splits:** per km, only for complete kilometres with valid distance.
- **Notes,** and any low or stop ending (as v1).
- **History:** date, a map thumbnail (or the route shape, or none), distance and time.
- **Deleting:** a walk's route can be deleted without deleting the walk, and Me → Data can delete all routes.

### 9.6 Steps

- **Sources** (D14, D10):
  - in-app walks (sensor steps);
  - a day total entered from the phone's Health app: Steps hub → "Add today's steps", with the time it was entered ("as of 6 pm").
- **The day's figure:**
  - with an entered total, the entered total, labelled "entered at 6 pm";
  - with walks only, labelled "4,210 in FitStrong walks · day total not entered" (K-50);
  - if a later walk pushes the walks above the entered total, "at least 7,300 (walks after 6 pm)". It's never presented as complete.
- **Distance and energy** on the Steps trend say "in recorded walks" (A-47).
- **Reading steps from Apple Health** isn't possible for a web app (feasibility research).
  - "Add today's steps" has a large number field and a "Paste" button.
  - "How to copy your steps" explains an optional iPhone Shortcut that copies today's step count, which the person then pastes. The Shortcut is checked on a real iPhone before the help is shipped; if it doesn't work, the help isn't shown.

## 10. The check-in

The check-in is v1's sheet, unchanged in what it asks and decides. In v2:

- **It opens from:** the Right now card's Start, a hub's Start, or the chooser.
- **Once any answer is given,** the sheet resists swiping away. Close asks "Keep your answers?" with Keep / Discard (K-46).
- **The blood pressure minute:** a calm countdown. At zero it announces "Ready for the second reading" and shows "Enter second reading". The focus doesn't move (K-47, A-64).
- **Each blood pressure reading counts on its own.** A severe first reading or an emergency answer acts at once; nothing waits for the second reading (A-11).
- **The outcome** shows the decision first, with any changes ("Go ahead, with a gentler warm-up"), and then the Start button (M9).

## 11. Food

### 11.1 Three levels, the person's choice

1. **Meal ideas:** always on. Personalised Indian meal cards, the plate method and the sample week (v1 Guide content). Allergies and avoided foods are hard filters (A-16).
2. **Log meals, no numbers:** a record of what was eaten, with no figures anywhere.
3. **Log with estimates:** kcal and carbs per portion, labelled as estimates.

### 11.2 The Food hub

1. **Right now:** "Lunch · ideas for you", with three meal cards that respect the pattern and allergies. With logging on, there's "Log what you ate", plus up to 3 of the person's usual meals as rows: tapping one opens the meal tray filled in, ready to Save (L-19).
2. **Today** (logging on): the meals logged.
   - With estimates: "Estimated 620 kcal · 85 g carbs in logged foods", plus "2 items have no estimate" when that applies (A-17).
   - No daily target is generated (§11.5). A target appears only if the person entered one from their care team.
3. **Options:** Log a meal · Your usual meals · Quick add · Water · Meal ideas · Sample week.
4. **This week:** the days with meals logged (and, with estimates, the estimated kcal per day, labelled partial where items are missing).

### 11.3 Logging a meal (the "Log a meal" sheet)

1. **The meal** is preselected by time (Breakfast, Lunch, Dinner, Snack), shown as a segmented control.
2. **"Your usual"** comes first: the person's saved meals and recent meals, such as "Same as yesterday's lunch". **Tapping one fills its items and portions; Save logs it.** That's the four-tap path (A-21, K-31).
3. **Search, or "Common Indian foods":** rows with a big "+".
   - "+" adds one standard portion at once, with no extra page.
   - Tapping the name opens the portion page: a stepper in Indian units (roti ×2, katori ×1, rice ½ katori), with a reference quantity ("1 katori ≈ 150 ml").
4. **The meal tray,** at the top, lists what's added with − and +, and each item shows its estimate in estimates mode.
5. **"Save meal",** then a "Lunch saved" confirmation after the durable write (§4.5). "Save as a usual meal" is offered.

**Other ways in:**
- **No match:** "Add '{text}' as your own food", with kcal and carbs per portion, both optional and unknown if left blank, or "Quick add: about how much?" (Small, Normal or Large plate, or a kcal number in estimates mode).
- **Editing:** tap a logged meal → its tray → Save or Delete. Delete happens at once, with Undo (§20.4 rule 6). Any past meal can be corrected, and corrections keep their history (A-22).

### 11.4 What it shows, and the words

- No red, no "over", and no judgement. "Estimated" before every figure.
- **Partial totals are labelled** "in logged foods". Unknown nutrients stay unknown, never zero (A-17).
- **With insulin, a sulfonylurea or a meglitinide:**
  - every food screen shows "Carb figures are rough estimates. Follow your care team's plan";
  - carbs show as a range ("about 40–60 g"), never as a single per-meal total (K-22).
- **Never shown:** a net figure (eaten minus burned), "earn" language, or burned energy added to an allowance (A-50).

### 11.5 Guards (A-13, A-15, A-18, K-22)

- **No generated targets.** The app doesn't suggest a daily calorie or carbohydrate target to anyone; Mifflin–St Jeor is removed. A person may enter a target their care team gave them, labelled "from your care team".
- **The counts-free mode** is recommended after "Has food or weight ever been hard for you?" is answered Yes or Prefer not to say. Numbers can be turned off at any time in Me → Food.
- **Prompts:** at most one a day, never in quiet hours, never while the status isn't Normal, and none after that meal is logged. No prompt ever suggests skipping a meal, fasting or exercising to make up for food.
- **Turning logging off** keeps the meal history readable, editable and deletable (A-22).

### 11.6 Food data contract (A-19, K-21, D22)

- **Source: USDA FoodData Central, used as ingredients** (feasibility research). FDC is public domain (CC0), so its values can be bundled with attribution.
  - Each Indian dish is an authored recipe of FDC ingredients and gram amounts, with "home-style, 1 tsp oil per serving" written down. Its kcal and carbs per portion are computed at build time, and the recipe and FDC ids are kept beside each dish.
  - INDB is not bundled (no licence, and its values come from IFCT). IFCT 2017 is not used, because its copyright page forbids electronic products without NIN's written permission. Open Food Facts is not used either (ODbL share-alike, and its terms exclude medical use).
  - The board records the source, its version and the attribution before the food step is built.
- **Portions are grams.** No source defines katori, roti or ladle weights, so the app's own table states each one in grams ("1 katori dal ≈ 150 g") and shows the grams. The person can change a portion's weight.
- **Allergens are tagged by us,** per recipe, from its ingredients, because FDC doesn't confirm allergens. Anything uncertain shows as "May contain".
- **Saved meals and the person's own foods** are records with the same guarantees as readings: atomic writes, backup, merge, deletion records and validation (§18).

## 12. Trends

### 12.1 The Trends tab

1. **Your week** (Monday morning to Sunday): 2–4 factual sentences. "You moved 96 minutes this week, 18 more than last week." "You stretched on 4 days."
   - Nothing is framed as praise or blame. Walking praise is never shown when walking is held for the feet (K-12).
   - Clinical highlights are counts with context, not verdicts: "5 glucose readings this week; 1 was below 70".
2. **This week's ring,** and the last 8 weeks as a row of small weekly rings. Tap one for that week.
3. **Every category with data,** in the registry's order, whether or not it's on Home (A-29, K-33). Each row has an icon, the title, its latest or average value with the statistic named, and a small chart.
4. **Recent workouts, stretches and walks,** with map thumbnails where routes were saved.

### 12.2 A category's trend (one shared component, with per-metric rules)

- **Period control:** Week · Month · 6 Months · Year (K-34).

  | Period | Dates | Bars | Statistic for totals (minutes, steps) | Statistic for readings |
  | --- | --- | --- | --- | --- |
  | Week | Monday–Sunday | days | sum | daily values, plus the average with n |
  | Month | the calendar month | days | sum | average with n |
  | 6 Months | the last 6 calendar months | weeks | weekly average | weekly average |
  | Year | the last 12 calendar months | months | monthly average | monthly average |

  < and > page to earlier periods.
- **Comparisons:**
  - a current, unfinished period is compared with the same elapsed days of the previous one, for example "Mon–Wed vs last Mon–Wed" (A-42);
  - comparisons need at least 3 days with data in both periods;
  - the statistic and unit are always named.
- **Deltas are neutral:** "Higher than last week · +327 steps a day", in body ink with an arrow. There's no green or red and no "better" or "worse" (A-41, K-41). A reviewed, per-metric "toward your goal" phrase is used only for movement minutes against the person's own weekly goal.
- **Bars:** the previous period sits behind in grey, the current one in the category colour, and the average line is labelled. Tapping, or using the arrow keys on a bar, shows its value. Every chart has "Show as list" (a table) and a text summary for VoiceOver (A-63, K-40).
- **Rest and status:** in movement charts, Rest, Away, Unwell and Flare-up days are hatched and labelled, never shown as zero (D25, K-49). Clinical readings are never excluded for a status day: "includes 2 Unwell days" (A-43, K-10).
- **Readings show their spread** (A-44):
  - n, range, and the count of lows and highs ("2 below 70, 1 above 250");
  - context (fasting, after a meal) as separate series when both exist;
  - HI and LO are excluded from the average, shown above it in caution ink, and the change is hidden when any LO is in the period (K-11).
- **Labs** (HbA1c, B12, Vitamin D) are dated points with their interval, from the first record, with no 7-day requirement (A-45).
- **Early days:** a chart shows whatever exists from the first record. "Comparisons start once there are 3 days in both weeks" replaces draft 2's "trends start after 7 days".

### 12.3 What counts (reusing v1's typed aggregation and its overlap rules, A-40)

| Measure | Counts | Doesn't count |
| --- | --- | --- |
| Recorded movement minutes | Time moving in guided sessions (pauses excluded), stretches, walks and manual workouts, with overlaps resolved by v1's rules (F19). A safety-stopped session's minutes are kept, as the partial record they are | Check-ins; time counted twice |
| Stretch days | Days with a stretch routine or a session's mobility block | — |
| Steps | §9.6 | — |
| Readings | By measured time, with provenance | Deleted readings |

The weekly goal counts recorded movement minutes. It doesn't claim WHO-qualifying aerobic minutes, and the copy never says it does.

### 12.4 Energy estimates (V7, A-50)

- **What's shown is active energy:** the energy above resting, which is what "calories burned by the walk" means to a person (feasibility research).
- **The formula:** active kcal ≈ (MET − 1) × body weight (kg) × time moving (hours). The gross figure, MET × kg × hours, is never shown.
  - Example (synthetic): 70 kg walking 30 min at 3 mph (MET 3.8) gives (3.8 − 1) × 70 × 0.5 ≈ 98, shown as "about 100 kcal".
- **The weight** is the one in effect at the time of the activity, from the dated weight readings (A-36).
- **MET values come from the 2024 Compendium of Physical Activities.** Walking is banded by measured speed:

  | Speed | MET |
  | --- | --- |
  | under 2.0 mph | 2.3 |
  | 2.0–2.4 mph | 2.8 |
  | 2.5 mph | 3.0 |
  | 2.8–3.4 mph | 3.8 |
  | 3.5–3.9 mph | 4.8 |
  | 4.0–4.4 mph | 5.5 |
  | 4.5–4.9 mph | 7.0 |

  - Pace is used only with valid distance. Without it, the walk uses 2.8.
  - The stretching and strength values, and the Compendium's citation terms, are confirmed at pacompendium.com in the energy task before shipping, and recorded on the board. Until then, those activities show no energy figure.
- **Rounding:** to the nearest 10, labelled "about", and only on summaries and trends. A single "about" figure is shown rather than the research's ±25% range, because a range of calories is harder to read and the "about" already says it isn't exact. This is a deliberate departure from the research (L-21).
- **Without a weight:** "Add your weight for an estimate".

### 12.5 Goals have dates

Changing the weekly goal or the step goal applies from that day on. Past weeks keep the goal they had (A-36).

### 12.6 "Your week" (replacing milestones)

On Monday mornings, Home's secondary row offers "Your week in brief", which opens Trends at Your week. It ranks last in `pickPrompt`, after the water line, from 04:00 on Monday until it's opened (L-18). The sentences are factual. They're never shown in a non-Normal status or on a day with a hold, and they never count testing frequency, weight loss or food restriction (A-15, K-51).

## 13. Today's log (`/day/:date`)

This is v1's My Day, kept and reached from Home ("See today's log") and Trends (K-15, A-30). It shows every record of the day:
- check-ins;
- readings, with their measured time, unit, context and source;
- sessions, stretches, walks and meals.

Each record opens its detail, where it can be corrected or deleted with confirmation. It meets J05's requirements as v1 does.

Previous day and Next day buttons page through days, as v1. Quick Log's "Add" returns here when opened from here.

## 14. Browse (All Categories)

- **Search at the top:** activities, readings, foods and Guide topics.
- **Every category in the registry, grouped:**
  - Move: Workout, Stretch, Walk, Steps, Programme, Exercise library;
  - Eat: Food, Meal ideas, Water;
  - Check: Glucose, Blood pressure, Back & leg, Weight, Waist, BMI, Sleep, Labs;
  - Learn: the Guide topics;
  - Your data: Today's log, Backup.
- **Each row** opens its hub. Its "More" button (labelled) offers "Add to Home" or "Remove from Home".
- **Pick mode** (from "+ Add"): each row shows "Add" or "Added", then "Done".

## 15. Reminders and notifications

- **"2 reminders"** on Home opens "Waiting for you", v1's pending list, with "Done" and "Later" for each. Later moves the reminder to the next slot by v1's rule (A-82).
- **The app badge** is kept (D15).
- **Delivery,** because there's no server:
  - inside the app while it's open (M20);
  - outside it, only through calendar files.
- **Me → Reminders explains the limit:** "FitStrong can't alert you while it's closed. For safety re-checks, set a timer on your phone."
- **Calendar files are copies** (A-78). Me says: "Calendar reminders are copies. Changes here don't update them. Remove the old ones and add the new file." It records what was exported and when, with the end date. A changed fluid limit or quiet hours shows "Your calendar copies may be out of date".
- **Quiet hours** hold habit reminders, never safety (§4.9).

## 16. Me

| Section | What it holds |
| --- | --- |
| Finish setting up | Skipped or new chapters, each with "Not now" |
| Profile & health | The setup chapters, editable with the same pages. A changed medicine re-runs that chapter's follow-ups and shows what changes ("Before exercise, you'll be asked for a glucose reading") |
| Goals | Weekly movement goal, step goal, and the programme (Join, Leave, Shift plan after a break, with confirmation as v1, D25) |
| Food | Logging level, the pattern, allergies, and a care-team target (optional) |
| Reminders | Habits, quiet hours, calendar copies |
| Voice & demos | Voice on or off, the voice, and the 3D figure |
| Display | Theme (Automatic, Light, Dark), text size, Reduce motion, Reduce transparency (A-66). System settings take precedence where the browser reports them |
| Data | Back up, Restore, Merge, install status, last backup, storage used, map and route settings, delete all routes, Delete everything |
| About | Sources and licences, version |

## 17. Everyday journeys (acceptance V-J01 to V-J42)

Each journey becomes an acceptance case. The "happy" journeys show the shape of the product. The recovery journeys prove it holds up.

### 17.1 Everyday

1. **The first morning** (diabetes, BP, back pain). Launch → Home. Right now: "Check in and stretch", with its reason → tap → the check-in (two BP readings a minute apart; each acts alone if severe) → "Go ahead" → the stretch player → summary → Home. The Move ring changes by 10 min, and "Stretched 1 day".
2. **After lunch.** Right now: "A walk after lunch?" → tap → "Did you just have lunch?" Yes → the gate → the live walk → Finish → summary → Home.
3. **Log a usual lunch.** Food tile → "Same as yesterday's lunch" → Save → "Lunch saved".
4. **A low.** Glucose tile → Add reading → 62 → "This is a low. Treat it now", with the steps (as v1). Home: the urgent state, with "Re-check at 1:45 pm". Workout, Stretch and Walk tiles read "Waiting for your re-check at 1:45 pm".
5. **A BP check day.** BP tile: "Check day: two readings this evening" → hub → Add reading → two readings with the guided minute → saved → the interpretation.
6. **A guided workout.** Workout tile → Right now "Full Body B" → Start → the check-in → the player → summary → Home.
7. **See my week.** Trends → Your week → the Steps row → Week bars against last week → back.
8. **Look up a food.** Browse → search "chapatti" → the food and the Guide card.
9. **Back hurts more.** Back & leg tile → Add reading → pain scores and how far it reaches. A red flag → the stop, everywhere (§4.7).
10. **Change my weight.** Me → Profile & health → About you → weight → Save. This creates a dated weight reading; past estimates keep their weight.
11. **Back up and restore.** Me → Data → Back up → share. On the new phone: setup page 1 → Restore → Home.
12. **Customise Home.** Edit Home → Sleep "Hide" → Water "Move up" → "+ Add" → Labs "Add" → Done.
13. **Upgrade from v1.** Home with the derived tiles and the inline "new Home" row → "Got it". Every v1 record is present in its hub and in Today's log.
14. **Set a flare.** "How are you today?" → Flare-up → Home: Workout "Gentle only today", Stretch "Gentle stretch". Back to Normal → offer to shift the plan (as v1).
15. **A stop from a tile.** The check-in reports new leg weakness → the stop and the urgent banner on every tab. Stretch hub → the same stop, with no Start. Learn and readings still open.
16. **Offline.** Airplane mode → every hub, Trends, logging and the walk (on the plain grid) work. Only map pictures and uncached voice say "Needs a connection".

### 17.2 Recovery and cross-feature (from the audits; each must pass)

17. Uncertain health setup with a failed draft save → "Try again", or continue → Home with the profile-gap hold. No answer becomes "No".
18. A medicine change after setup (a "-gliflozin" without diabetes) → the follow-ups → Home → the next Start uses the new profile.
19. The decision lapses during preflight: a glucose reading → Walk → the consent questions take over 30 minutes → Start → "Check glucose first".
20. First walk with location refused and motion allowed → time and steps, with "No route" labelled.
21. A low during a session → close the sheet → Resume and earphone Play stay held until the release.
22. A dangerous reading while storage fails → guidance shows, the write fails → "Try again". No "Saved".
23. A severe first BP with an empty second → guidance at once; the first reading is kept.
24. A reading measured yesterday, entered today → its measured time; the historical wording.
25. Away, then back to Normal → no "Carry on" while away → the plan-shift offer → accept or decline.
26. Partial steps: 6,050 entered at noon → a later walk → "at least" with sources → a final total → replaced, not added.
27. First days of trends: one reading → its point shows at once; the comparison appears after 3 days in both weeks; labs need no daily data.
28. Food with logging off → Meal ideas → turn on "meals only" → the same hub.
29. Unknown nutrients: a custom food with no values → the partial total labelled; an allergy excluded from ideas.
30. A usual lunch → adjust a portion → Save. The taps are counted separately from V-J03.
31. Correcting a meal from 10 days ago → saved with its history; trends update; no incident resolved.
32. Two deletes in a row → both Undo toasts stay, stacked, until the next action → Undo the first → the right record returns, with its deletion record removed → the totals are right.
33. Weak GPS, screen lock and midnight → separate segments → each day credited (F17).
34. A crash while a route is being saved → Home's inline recovery row → Save once → no duplicate or orphan.
35. Backup cancelled at the share sheet → the export status stays "not backed up" → repeated → restored exactly.
36. A malformed or oversized backup → a specific refusal, with data untouched → a valid file → merge.
37. Finish setup in Safari → install → the verified data path, or backup and restore → history present.
38. Storage full during a log, or an app update arriving during a walk → the task is preserved; the reload waits until the task ends.
39. Calendar copies after a fluid limit is added → "Your calendar copies may be out of date" → replace.
40. VoiceOver and 200% text: log a reading with the keyboard up → the timer announcement doesn't steal focus → back to the opener with focus restored.
41. A time-zone change mid-walk → the elapsed time is right (monotonic clock); history keeps its days; no reading becomes "fresh" from a clock jump (A-75).
42. An upgraded user in programme week 12 → finish → Stretch and Walk continue → "What next?", chosen explicitly. Nothing is invented after week 12.

## 18. Data model

### 18.1 Profile and settings

- **Profile:** `name?` and `waistCm?`.
  - Weight and height changes are dated readings (A-36).
  - The figure for the 3D demos stays separate. Nothing is inferred from it (A-14). `sexForEstimates` is dropped, because no estimate needs it any more.
- **`food`:** `level` (`ideas | meals | estimates`), `pattern`, `allergies[]`, `avoid[]`, `mealTimes?`, `careTeamTargets?` (`{ kcal?, carbsG?, setOn }`).
- **Settings:**
  - `home: { order: Record<GroupId, CategoryId[]>, hidden: CategoryId[] }`;
  - `setup: { draft?, completedAt?, skipped: ChapterId[] }`, with completion stored apart from profile gaps (A-26);
  - `goals: { weeklyMinutes?: Dated<number>[], dailySteps?: Dated<number>[] }`;
  - `walk: { map: 'on' | 'off' | 'unasked', saveRoutes: boolean | 'unasked' }`;
  - `display: { reduceMotion?, reduceTransparency?, textScale? }`;
  - `exports: { calendar: { at, items, endsOn }[], lastBackupAt? }`;
  - `deleted.recent?: { at, store, record }[]`: a deleted record's content, kept for 7 days for "Recently deleted" (§20.4 rule 6) and then dropped. The id lists v1 already keeps (D-06) are unchanged.

### 18.2 New records

- **Meals:** `{ id, at, meal, items: [{ foodId | customId, portions, kcal?, carbsG? }], level, edits[] }`.
- **Saved meals:** `{ id, name, items }`.
- **Custom foods:** `{ id, name, per: { qty, unit }, kcal?, carbsG?, allergens? }`.
- **Routes:** `{ walkId, segments: polyline[], bbox, startedAt }`, written only when `saveRoutes` is on, and journalled per segment during the walk.

Each kind is backed up, merged, deleted with deletion records (D-06) and validated like readings (A-55, A-56).

### 18.3 Storage and migration

- **Versions.** IndexedDB goes from 1 to 2 (adding the new stores), and the data schema from 5 to 6. Both are additive; v1 records stay readable as they are.
- **Atomic.** Linked records (a walk and its route, a meal and its edits) are written in one transaction. Walk recovery state is retired only after the commit (A-55).
- **Backup** is one consistent snapshot that lists the stores it includes. Routes are opt-in, and the choice is stated.
- **Import validation:**
  - the file's version, its compressed and expanded sizes, record and point counts, numeric bounds and references are all checked before anything is replaced;
  - an invalid file leaves the data untouched (A-56).
- **Quota.** Every write handles a full disk (§9.4). Me shows storage used.

## 19. Launch, routing and addresses

### 19.1 What opens

```
open the app
 ├─ storage can't be read     → v1's storage-failure screen
 ├─ setup not finished        → setup, resumed on its page (or Home after "Look around first")
 └─ otherwise                 → Home. An interrupted walk is an inline row under the Right now card.
                                Urgent state ranks first.
```

- **Foreground return** to an active or paused task goes back to that task, through v1's resume gate (A-32).
- **A deep link** opens its screen, with Home as its tab's root. Back goes to Home.
- **The arrival gates** on `#/session` and `#/walk/live` are kept for direct links (J03).

### 19.2 v2 addresses

| Place | Address |
| --- | --- |
| Home | `#/home`, keeping v1's `?checkin=`, `?status`, `?choose` and `?goal` |
| Hubs | `#/hub/:id` for each registry id. Sub-pages: `#/hub/workout/plan`, `#/hub/workout/exercises`, `#/hub/workout/exercises/:id`, `#/hub/food/log`, `#/hub/food/ideas`, `#/hub/food/ideas/:mealId`, `#/hub/food/week`, `#/hub/learn/topic/:id`, `#/hub/learn/card/:id`, `#/hub/learn/sources` |
| Today's log | `#/day/:date` |
| Trends | `#/trends`, `#/trends/:id` |
| Browse | `#/browse`, `#/browse?pick=1` |
| Me | `#/me`, `#/me/:section`, `#/me/profile?chapter=movement` (never a second `#`, K-16) |
| Tasks | `#/setup/:chapter/:page`, `#/session`, `#/walk/live`, `#/walk/summary` (kept, so an unsaved walk is never lost, K-18) |
| Record details | v1's addresses are kept: `#/track/reading/:id`, `/pressure/:id`, `/walk/:id`, `/session/:id`, `/check-in/:date`, `/workout/:id` |

### 19.3 v1 → v2 redirects

**Every redirect keeps the query string** (K-17). `routes.redirect.test.ts` enumerates every route in v1's `src/screens/*/routes.tsx`, every metric kind and every legacy entry, and asserts that each has a real v2 target (K-16, A-35).

| v1 | v2 |
| --- | --- |
| `/today` (+ query) | `/home` (+ query) |
| `/move` | `/hub/workout` |
| `/move/stretch` (+ stretch parameters) | `/hub/stretch` (+ the same parameters) |
| `/move/plan` | `/hub/workout/plan` |
| `/move/exercises`, `/move/exercises/:id` | `/hub/workout/exercises`, `…/:id` |
| `/walk` (+ `?meal=`) | `/hub/walk` (+ `?meal=`) |
| `/walk/summary` | kept as is |
| `/track` (+ `?day=`) | `/day/:day` when a day is given, else `/day/today` |
| `/track/metric/:kind` | `/hub/{glucose, bp, steps, water, weight, waist, sleep, labs}`, using v1's kind → category table (hba1c, b12 and vitd → `labs`; movement → `/trends` (L-17); pain → `/hub/back`) |
| `/track/back` | `/hub/back` |
| `/track/workout` | `/trends/workout` (the workout log) |
| `/track/workout/:id` and the other record details | kept |
| `/guide` | `/hub/learn` |
| `/guide/topic/:id`, `/guide/card/:id`, `/guide/sources` | `/hub/learn/topic/:id`, `/hub/learn/card/:id`, `/hub/learn/sources` |
| `/guide/meals`, `/guide/meals/week`, `/guide/meals/:id` | `/hub/food/ideas`, `/hub/food/week`, `/hub/food/ideas/:id` |
| `/you`, `/you/{profile, food, habits, voice, appearance, data}` | `/me`, `/me/{profile, food, reminders, voice, display, data}` |
| `/you/focus` | `/me/profile?chapter=movement` |
| `/welcome`, `/welcome/health`, `/welcome/keep` | `/setup` (or `/home` once set up) |
| v1's legacy list (`/dashboard`, `/workout`, `/plan`, `/library`, `/progress`, `/history`, `/settings`, `/profile`, `/onboarding`) | Its v1 target, then the row above, in one hop |
| Anything unknown | Home, with "That page has moved", never a blank screen |

**`HREF` in `recommend.ts`** changes to the v2 addresses in the same change (K-55). While setup is unfinished (after "Look around first"), `HREF.profile` resolves to `/setup`, on the page where setup stopped (L-20).

## 20. Design language: Liquid Glass for the web

### 20.1 Materials (research, §22)

- **Glass is the navigation layer only:**
  - the tab bar;
  - nav bars;
  - sheet headers and grabbers;
  - the player's floating control capsule.
- **Everything else is solid:** content, cards, tiles, the Right now card and its buttons, toasts, menus, and the live walk's stats (K-54, A-68).
- **The recipe:**
  - a translucent tint;
  - a backdrop blur with saturation;
  - a 1 px inner highlight;
  - a soft shadow.

  The exact values are in the design research. Text on glass must reach 4.5:1 over pure white, pure black and a saturated red composited behind it; otherwise the tint opacity is raised (K-28).
- **Budget:** at most two blurred surfaces on screen at once. Menus dim the page; they don't blur it (A-68).
- **During a view transition,** glass surfaces switch to their solid fallback. Safari turns backdrop blur off while a transition runs (WebKit bug 302256), so a glass bar would otherwise flash unblurred. They also keep their own transition names, so they're never captured inside a page snapshot (K-53). There's no refraction effect, because Safari can't apply SVG filters in `backdrop-filter` (WebKit bug 245510).
- **Reduce transparency** is an in-app setting (Me → Display, and setup page 1), because Safari doesn't report the iPhone's Reduce Transparency to web pages. It, `prefers-contrast: more`, and a browser without `backdrop-filter` all make glass solid.
- **Increase contrast:** borders, and body-colour secondary text.

### 20.2 Components

| Component | Contract |
| --- | --- |
| GlassTabBar | A floating capsule above the home indicator, with 4 items, icons and labels always shown. The tinted selection moves to the tapped tab (M5). It never shrinks (K-27) |
| GlassNavBar | A large title that collapses into a glass bar (as v1). Back shows the opener's name |
| Tile | Solid, with an icon circle, title, live line and an optional caution dot with words. Pressing scales an inner layer, not the hit area (M2) |
| RightNowCard | Solid, with a category accent, the reason line, one primary button and "Something else". Safety variants use stop and caution ink and render immediately |
| WeekRing | One progress ring in the Move colour, with round caps, never past 100%, plus labelled values and day dots. It's deliberately not a look-alike of Apple's three concentric Activity rings, which Apple's guidelines reserve for Activity data |
| TrendChart | Bars or points, the previous period in grey, a labelled average, a value on tap or arrow key, "Show as list", and a text summary |
| StatGrid | Label, value with unit, and statistic, in 2 columns, or 1 at large text |
| Sheet | A glass header with a labelled Close, a grabber, and medium and large detents. Swipe to dismiss follows §10 and §4.4 |
| Buttons | Primary (filled tint, 60 px tall), Secondary (tinted text on a soft fill), Plain |
| Toast | Solid, above the tab bar. Its action is never the only way to do something (§20.4, rule 6) |

### 20.3 Colour

There's one action tint (D12), plus a category colour for icons, rings and charts:
- Move: red-orange; Stretch: teal; Walk and Steps: green; Workout: orange;
- Food: amber; Water: blue; Glucose: purple; BP: pink-red; Sleep: indigo;
- Weight: cyan; Back & leg: violet; Learn: yellow-brown.

Every pair is measured in light and dark: 4.5:1 for text, 3:1 for graphics. Colour is never the only signal; words or shapes carry it too (A-63).

### 20.4 Grandma rules (acceptance criteria)

1. **Tap targets:** everything tappable is at least 48×48 px and never under 44, with at least 12 px between bezelled controls. Primary buttons and other main targets are at least 60 px tall (design research 4a, L-16).
2. **Labels:** every control has a visible text label, including the bell ("2 reminders"), Hide, More, Recentre, and Zoom in and Zoom out. The stepper's − and + read "Fewer" and "More" to VoiceOver, beside a visible value and unit.
3. **Gestures:** every gesture has a visible button.
   - Swipe → Close.
   - Long-press → More, or Edit Home.
   - Drag → Move up and Move down.
   - Pinch → Zoom in and Zoom out.
   - Scrubbing a chart → arrow keys and Show as list.
4. **One primary action** per region, worded as a verb.
5. **Plain words,** and units on every number. mg/dL and mmol/L link to a short explanation once.
6. **No essential action exists only in timed UI** (A-65, K-38, design research 4e).
   - A routine delete happens at once and offers Undo. The Undo stays until the person leaves the screen or starts another edit, never on a timer. A newer toast stacks above it rather than replacing it, and tapping one Undo doesn't dismiss the other (motion M19, L-06).
   - **Recently deleted:** Today's log has a "Recently deleted" row listing what was deleted in the last 7 days, each with "Restore". It's rebuilt from the deletion records (D-06), which keep the deleted record's content for 7 days, so a delete stays reversible after the toast has gone (L-06).
   - Anything added can be removed later from Today's log.
   - Irreversible actions (Delete everything, Replace with a backup) get two confirmations, with specific labels ("Erase all"), never "OK".
7. **Text** works up to 200% with no clipping and no truncation, and layouts reflow (A-61). Pinch-zoom stays enabled.
8. **Nothing is time-limited** except the guided timers, which can always be paused.
9. **Errors** say what happened and what to do, next to the cause. Safety-related errors appear at once.
10. **Leaving:** every screen can be left by Back or Close, and focus returns to where it came from.
11. **Taps from a shaky hand work:** a press activates by the browser's own click rules. The design never cancels a tap on small movements (K-45, and Codex's M2 review).
12. **Type:** body text is 17 px or larger and scales with the iPhone's Text Size, through v1's `src/lib/textSize.ts`. No meaningful text is under 13 px, and no light font weights are used.
13. **Few choices at once:** at most 5 main choices per region. A tile group shows at most 5 tiles by default, and fill-in tiles never push a group past 5.

## 21. Building, releasing and proving it

### 21.1 Order

Each step is behind the v2 flag until step 6.

1. **Foundations:** design tokens, category colours, the motion module, the registry, and the device probe for glass inside view transitions.
2. **Shell:** the tab bar, the four roots, and the navigation stack generalised to the new tabs.
3. **Home:** status, Right now, This week, the tile groups, Edit Home, and Today's log moved to `/day/:date`.
4. **Hubs:** movement (Workout, Stretch, Walk), then reading (Glucose, BP, Back & leg, Weight, Water, Sleep, Waist, Labs, Steps), then Learn.
5. **Trends, Browse and Me.**
6. **Setup and the upgrade path, redirects, `HREF`,** then the flag is flipped: the launch route and redirects switch together.
7. **Walk:** consents, the map, route saving and journalling, gaps, and the Steps sources.
8. **Food:** the data, meal ideas with allergy filters, logging levels and saved meals.

### 21.2 Offline and updates (A-58)

- The service worker caches each release atomically, with a version stamp.
- New lazy screens and data are precached.
- An update never reloads during a session, a walk or a sheet with answers. It waits, then shows "Updated" on the next Home.
- Missing demos or voice fall back to text cues, safely.

### 21.3 Tests

- **Unit tests** for every rule in this spec: the registry, tile copy against the gate, ranking, trends statistics, energy, steps sources, food guards, migrations, redirects and the setup field crosswalk.
- **Caller tests** for every safety contract in §4.
- **Acceptance:** J01–J20 updated for navigation only, plus V-J01–V-J42, at both sizes and in light and dark.
- **Device-only checks** are listed for release, as D34: glass in transitions, Wake Lock, motion steps, Safari to installed data, VoiceOver, and older-adult sessions.

## 22. Decided by the research

These are recorded as board decisions in the plan's first task. The sources are in `docs/research/v2-feasibility-research.md` and `v2-design-research.md`.

| Question | Decision |
| --- | --- |
| Map during a live walk | No map pictures. The route is an SVG line on a plain grid, redrawn at most once a second (D18) |
| Map on summaries and details | Opt-in static OpenStreetMap picture tiles under our own route drawing. It's our own small code, not a library (Leaflet, at 41.5 KiB gzip, is the upgrade path if panning is ever wanted; MapLibre needs WebGL2). Attribution "© OpenStreetMap contributors". No prefetching, no offline copies, no bulk download. Content Security Policy: add only `https://tile.openstreetmap.org` to `img-src` |
| Food values | USDA FoodData Central ingredients (CC0), with our own authored recipes and gram-based portions, and allergens tagged by us. Not INDB, IFCT 2017 or Open Food Facts |
| Energy | Active kcal = (MET − 1) × kg × hours. Walking METs from the 2024 Compendium by speed band. Stretching and strength values, and the citation terms, are confirmed at the source before they're shown |
| Safari ↔ installed app storage | Treated as not shared, so the backup-and-restore handoff in §6.5 stays. To be verified on a device |
| Eviction | The 7-day rule applies to Safari tabs. Home Screen apps keep their own days-of-use count, and WebKit doesn't expect to delete their data. `navigator.storage.persist()` is requested |
| Wake Lock | Works in Home Screen apps from iOS 18.4. Earlier versions show "Keep this screen on" |
| Motion permission | Requested only from a tap (otherwise `NotAllowedError`) |
| Steps from Apple Health | Not possible. Manual entry with Paste, plus an optional Shortcut tested on a device |
| Glass | The recipe in design research §2.5: light `rgb(255 255 255 / .72)`, dark `rgb(28 28 30 / .72)`, `blur(16px) saturate(180%)`, a rim and highlight, and a solid fallback, which is also used during view transitions |
| Motion | Apple springs at 0.4 s with bounce 0 (CSS 588 ms `linear()`), and bounce 0.15 only for a release with momentum |
| Charts and rings | v1's own SVG `Ring` and `Chart`, extended. No dependency |
| Older-adult rules | Main targets at least 60 px, body text 17 px or larger, at most 5 choices per region, Undo that doesn't time out, and two confirmations for anything irreversible |

## 23. Non-goals

- Social features, accounts, cloud sync, an AI chatbot (C4).
- Streaks, badges, points, levels, milestones, leaderboards (D19).
- Heart-rate features; background step counting; reading Apple Health (not possible for a web app).
- Barcode scanning (it needs a network food database).
- Push notifications (they need a server).
- Generated calorie or carbohydrate targets.

## 24. Risks

- **Glass on iPhone:** kept to small navigation surfaces, with at most two blurs, a device probe, a measured frame budget and the solid fallback.
- **Map privacy:** off until chosen, with honest disclosure and a mode with no map.
- **Calorie estimates and disordered eating:** three levels, the counts-free mode recommended after the screening question, no targets, and no net figures.
- **Clutter:** tiles come from setup, there are groups, Edit Home, and 9 tiles by default.
- **The size of the change:** v2 stays behind a flag, the acceptance journeys come with each step, the clinical outcomes in tests stay the same, and Codex and Kiro review each step.
