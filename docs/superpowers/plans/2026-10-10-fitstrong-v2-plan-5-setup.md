# FitStrong v2 Plan 5: Setup and upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace v1's three-step Welcome with v2's "Set up once". That means:
- eight chapters of pages, each storing the answers before setup moves on, with a failure state and "Continue without saving";
- a published page graph, with tests for its page counts and its engine-field coverage;
- "Look around first", Restore on page 1, install guidance and the Safari-to-Home-Screen handoff;
- a review page;
- the programme's own Join flow;
- Me → Profile & health, edited chapter by chapter with the same page views;
- an upgrade from v1 with no interstitial.

**Architecture:**
- **Answers are data.** `settings.setup` keeps every answer as the person gave it, `'unsure'` included: in `draft` while setup runs, and in `answers` once it's finished. One pure function, `profileFrom()` in `src/setup/assemble.ts`, turns answers into the `UserProfile` the engine reads. It's the only place "Not sure" becomes "may have".
- **The pages are a graph** (`src/setup/graph.ts`). Each page says:
  - when it applies, from the answers so far;
  - which answers it sets;
  - when it's answered;
  - whether it can be skipped.

  Two tests read the graph: `setup.pages.test.ts` (page counts and reachability, B-06) and `setup.fields.test.ts` (every engine field reachable under its condition, §6.3).
- **The screens are thin.** `src/screens/setup/` renders each page through one shell. Next stores the draft before setup moves (M22). Me's chapter editor renders the same page views, one under another, with one Save.
- **v1 records aren't migrated.** Their setup state is read from what v1 kept (`setupStateOf`), and written the first time something changes it. Reading a v1 profile as answers and back gives the same profile, so the upgrade itself changes nothing the engine reads. `upgrade.test.ts` checks this for every persona and every chapter.

**Tech stack:** React 19, TypeScript (strict, `erasableSyntaxOnly`), Vite 8, Tailwind v4, the React Router 7.13 hash data router, the IndexedDB store, Vitest (node environment, `src/**/*.test.ts`), and the Playwright-core acceptance suite in headless Chromium (`npm run e2e:acceptance`).

**Spec:**
- `docs/superpowers/specs/2026-10-08-fitstrong-v2-journey-design.md` (cited as J§):
  - §6 in full;
  - §1.2, §4, §16, §18.1, §19 and §20.4;
  - the §25 amendments B-06, B-07, B-08, B-18, B-22, B-24 and B-31, which override earlier text.
- `docs/superpowers/specs/2026-10-08-fitstrong-v2-motion-design.md`: M22, and rule 4.
- The roadmap, `docs/superpowers/plans/2026-10-08-fitstrong-v2-roadmap.md`.
- `docs/reimagine/BOARD.md`, and `docs/reimagine/codex-acceptance.md` (J01, J02).

Read them before starting.

**Depends on:** Plans 1, 2 and 4. Other plans are being built on the same branch, so find code by the names below, not by line numbers. Task 1 Step 1 checks each one exists.
- **Plan 4's setup-progress seam (its Task 6).** Plan 4 builds it and this plan fills it, without redefining it:
  - `CHAPTER_IDS` and `type ChapterId` in `src/types/setup.ts`, re-exported from `@/types`;
  - in `src/setup/progress.ts`: `OpenChapter { chapter, label, detail, href, why }`, `setupProgress({ profile, settings }): OpenChapter[]` (without the chapters answered "Not now"), `finishTitle(count)` and `notNow(chapter)`;
  - "Not now" kept in `settings.setup.declined`, and read in `src/store/importCheck.ts` as `setup: { declined }`.
- **Plan 4's Me:**
  - `DisplayControls` in `src/screens/you/DisplayScreen.tsx`;
  - `MeHome`, with its "Finish setting up" rows and its "What you’d like more of" row;
  - `Profile()` in `src/screens/you/routes.tsx`;
  - `ProgrammeGroup` in `src/screens/you/ProgrammeGroup.tsx`;
  - `privacyLine(device)` in `src/screens/you/summaries.ts`.
- **Plan 2:**
  - `withWeeklyGoal(settings, goal, day)` and `weeklyGoalOn(settings, day)` in `src/screens/track/weeklyGoal.ts`;
  - Your plan's `?join=1` in `src/screens/move/PlanScreen.tsx`.
- **Plan 7 isn't needed.** Chapter 7 writes the food contract Plan 7 defines. Task 3 lands Plan 7's own Task 2 definitions word for word, so there's nothing to reconcile (board D82).

## Global Constraints

- **Branch:** work on `feat/v2-journey`. Never push to `main`. Make one commit per task, with a conventional message.
- **Local-only:** no new network request, no new dependency, no API key.
- **Safety** (J§4, J§6.1):
  - The engine alone decides every start. Setup changes the engine's inputs only through `profileFrom()`.
  - "Not sure" is a real answer, stored as `'unsure'`. Every safety rule reads it as "may have".
  - Clinical answers never default. Preferences have labelled defaults ("Usual: 250 ml glass").
  - "Skip for now" exists only on preference pages. A safety question that's skipped or unanswered stays a gap (the `profileGap` hold), never a "No".
  - A first-time profile always shows v1's acknowledgement before it's used (on the Review page, D84).
  - An answer nobody gave is never written as one. A profile with `needsHealthReview` gives setup none of its health, medicine or pain values (contract H-DATA).
- **Page budgets** (J§1.2, B-06):
  - at most 20 pages on the minimal path (no conditions);
  - at most 30 on the complex path (diabetes on insulin, treated high blood pressure and sciatica);
  - Welcome and Review are counted; the programme's Join flow isn't;
  - no time claim anywhere: "about 5 minutes" is removed until it's measured.
- **Choices** (B-08): at most 5 main choices per region for navigation and actions. A checklist of yes/no answers counts as one question.
- **Grandma rules** (J§20.4):
  - every control has a visible text label;
  - everything tappable is at least 48×48 px, never under 44, and primary buttons are at least 60 px tall;
  - body text is 17 px (`--text-body`);
  - text works up to 200%, and reflows at 320 CSS px;
  - every gesture has a visible button;
  - one primary action per region, worded as a verb;
  - a number field keeps what's typed and is checked only at Next or Save, so "1", "19" and "195" can be typed on the way to "1958".
- **Motion M22:**
  - between pages, the incoming page slides 30% in from the trailing edge and fades in (`spring`); the outgoing page moves 30% the other way and fades; Back reverses it;
  - Next moves only after the answer is stored, never when an animation ends;
  - the progress capsule fills smoothly to its next fraction;
  - the Review page is drawn at once, with no cascade;
  - "Start using FitStrong" goes straight to Home;
  - under Reduce Motion (the system's or the app's), pages change with a fade (motion rule 4: reduced motion replaces, it doesn't delete).
- **Copy:** Indian English, sentence case, verbs on buttons. B-24's standard copy, verbatim:
  - privacy: Plan 4's `privacyLine(device)` ("Your records are stored on this {device}. Backups and calendar files leave only when you share them."). Plan 6 adds the map sentence when maps arrive;
  - install: "Installing helps {device} keep your data, but it isn’t a backup.";
  - Safari: "Safari may remove data from websites you haven’t opened for a while."

  Every other string is given exactly in its task. A failed write says `That did not save. {reason}`, as every v1 screen does.
- **Data** (J§18.1):
  - `settings.setup` holds `stage`, `draft?`, `answers?`, `completedAt?`, `skipped`, `declined?` (Plan 4's) and the upgrade flags;
  - weight, height and waist changes are dated readings, and a v1 weight without a date is never given one (B-16);
  - the change is additive, with no schema version bump.
- **Tests:** Vitest runs in the node environment, so components aren't unit-rendered. Every rule is a pure function with its own test. Screen behaviour is proven by the acceptance suite in headless Chromium.
- **Gates before every commit:** `npx tsc -b`, `npm run lint` and `npx vitest run` all pass.

## Review Focus

These are failure modes the spec implies but that no task's tests would naturally exercise. Each has its test in the task that owns the code.

1. **Editing one chapter in Me.**
   - It must change only that chapter's fields, and keep what another open copy saved meanwhile.
   - It must never force an upgrader through v2's new safety questions, but it must re-ask anything the edit itself made necessary.
   - Adding diabetes re-asks the diabetes medicines and never keeps the old review. Saving the review clears it.

   Task 14 tests `editChapters`, `editPath` and `editedRecord`; Task 5 tests the review flags.
2. **A page shown in pounds or feet, saved unchanged.** It must leave the stored kilograms and centimetres exactly as they were, and record no new reading. Rounding through a unit would otherwise drift the weight a little on every save and add a reading each time. Task 4 tests `heightFrom`, `weightFrom` and `waistFrom`; Task 5 tests `measurementsFrom`; V-J10's variant checks it on screen.
3. **A diabetes medicine with "No" to diabetes.** Chapter 4 asks about medicines whatever the diagnosis, so a person can say "No" to diabetes and then tick insulin. The engine's rules about lows apply only with diabetes, so this person must be read as "may have diabetes" (`'other'`, D78), and asked for a glucose reading before exercise. Task 5 tests this through `deriveHealth` and `glucoseStartMin`.
4. **A second tab finishes setup while this one is part-way.** This tab's next save must not reopen setup or overwrite the finished answers. Task 8 tests `withDraft` on a finished record.
5. **A stored draft, or a backup from another build.** Say the draft points at a page this build doesn't have, or carries answers of the wrong shape. Setup must keep what it can read, by name, and resume at a page that applies. It must never crash or loop. Task 2 tests the import check; Task 4 tests `resumeAt` and `guardFor`.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/types/setup.ts` (modify; Plan 4 created it) | Page ids, `Tri`, conditions, medicine classes, `JoinAnswers`, `SetupAnswers`, `SetupRecord`, `SetupState` |
| `src/types/index.ts`, `src/types/profile.ts` (modify) | `settings.setup` as `SetupRecord`; `profile.name`, `waistCm` and `pain.neuroHistory`; Plan 7's `FoodPreferences` |
| `src/health/observation.ts`, `src/screens/track/format.ts`, `src/redirects.ts` (+ test) (modify) | The `height` reading |
| `src/store/importCheck.ts` (+ test) (modify) | Setup, read field by field; the new profile fields; Plan 7's food shape |
| `src/store/useStore.ts` (+ test) (modify) | `update(…, { addObservations })`: readings in the same write |
| `src/content/meals.ts`, `index.ts`, `personalise.ts` (+ test), `src/screens/you/summaries.ts`, `src/screens/guide/FoodPicker.tsx` (modify) | Jain wherever patterns are named; the picker keeps the other food answers |
| `src/setup/age.ts`, `units.ts`, `facts.ts`, `graph.ts`, `fixtures.ts`, `state.ts` (+ tests, `setup.pages.test.ts`) | Birth year (B-31), units, facts, the page graph, fixtures, setup's state |
| `src/setup/assemble.ts`, `fields.ts` (+ `assemble.test.ts`, `setup.fields.test.ts`) | Answers → record; the crosswalk and its test |
| `src/programme/join.ts` (+ test), `src/programme/JoinFlow.tsx` | The Join flow, shared by setup, Your plan and Goals |
| `src/setup/prefill.ts` (+ test) | Answers from a stored record |
| `src/setup/progress.ts` (+ test) (modify; Plan 4's) | Finish setting up's rows, from setup's state |
| `src/health/recommend.ts` (+ test), `src/screens/home/urgent.ts` (modify) | "Finish setting up" while setup is unfinished (L-20) |
| `src/setup/draft.ts` (+ test) | Storing the draft, the failure state, the unsaved session |
| `src/setup/review.ts` (+ test), `src/screens/you/summaries.ts` (`chapterSections`, + test) | Review's three things; each chapter's rows |
| `src/setup/edit.ts`, `changes.ts` (+ tests) | Me's chapter edit; what an edit changes |
| `src/setup/upgrade.test.ts` | The answers read back from a v1 record change nothing the engine reads |
| `src/screens/welcome/install.ts` (+ new test), `focus.ts` (modify) | Page 1's install line and the handoff copy; v2's focus words |
| `src/screens/setup/` (new) | The controls, the shell, the page views, page 1, Review, setup's routes, Profile & health and the chapter editor |
| `src/screens/home/NewHomeRow.tsx` (new), `HomeScreen.tsx` (modify) | The one-time "new Home" row |
| `src/screens/you/routes.tsx`, `MeHome.tsx`, `write.ts` (+ tests), `ProgrammeGroup.tsx`, `copies.test.ts` (modify) | Profile & health; Me without v1's focus row; Join |
| `src/screens/move/plan.ts`, `PlanScreen.tsx`, `plan.test.ts` (modify) | Your plan opens the Join flow |
| `src/categories.ts` (+ test) (modify) | Back & leg for a nerve history or "Not sure" |
| `src/routes.tsx`, `src/routes.test.ts`, `src/App.tsx`, `src/index.css` (modify) | Setup's routes; M22 |
| Deleted | v1's Welcome screens, `ProfileScreen`, `FocusScreen`, `ProfileWizard`, `WizardCover`, and the wizard exports nothing reads |
| `scripts/e2e/acceptance/lib/setup.mjs` (new); `lib/inpage.mjs`, `run.mjs` (modify) | Answering setup by its visible questions; the iPhone capabilities |
| `scripts/e2e/acceptance/journeys/v10.mjs`, `v11.mjs`, `v13.mjs`, `v17.mjs`, `v18.mjs`, `v37.mjs` (new) | V-J10, V-J11, V-J13, V-J17, V-J18 and V-J37 |
| `scripts/e2e/acceptance/journeys/j01.mjs`, `j02.mjs`, `j03.mjs`, `j12.mjs`, `j14.mjs`, `j17.mjs`, `j20.mjs`, `s01.mjs`, `m01.mjs` (modify) | Walked through v2 setup and the v2 profile editor |
| `docs/reimagine/BOARD.md`, `docs/reimagine/codex-acceptance.md`, the journey spec's §6.3 and §6.4 (modify) | Decisions, the journeys, the corrected crosswalk |

---

### Task 1: Check the seams, record the decisions, correct the crosswalk and specify the journeys

The spec asks this plan's first task to confirm every §6.3 field name against `src/types/profile.ts` and the engine, and to correct the table where a v1 name differs, never dropping a row. That check was done while writing this plan. It covered:
- `HealthProfile`, `PainProfile` and `UserProfile`;
- `deriveHealth`, `profileGaps`, `sglt2Unknown` and `profileRules`;
- `readiness.ts`, `cadence.ts`, `reminders/water.ts` and `components/checkin/form.ts`.

The corrected table is in Step 3.

**Files:**
- Modify: `docs/reimagine/BOARD.md` (append)
- Modify: `docs/superpowers/specs/2026-10-08-fitstrong-v2-journey-design.md` (§6.3's table, §6.4's first bullet)
- Modify: `docs/reimagine/codex-acceptance.md` (J01 and J02; a new V-J section)

**Interfaces:** none.

- [ ] **Step 1: Check the seams this plan fills.**

```bash
grep -n "export const CHAPTER_IDS\|export type ChapterId" src/types/setup.ts
grep -n "export interface OpenChapter\|export function setupProgress\|export function finishTitle\|export function notNow" src/setup/progress.ts
grep -n "setup?: { declined" src/types/index.ts
grep -n "setup: { declined" src/store/importCheck.ts
grep -n "export function DisplayControls" src/screens/you/DisplayScreen.tsx
grep -n "export function ProgrammeGroup" src/screens/you/ProgrammeGroup.tsx
grep -n "export function privacyLine" src/screens/you/summaries.ts
grep -n "export function withWeeklyGoal\|export function weeklyGoalOn" src/screens/track/weeklyGoal.ts
grep -n "join=1\|params.get('join')" src/screens/move/PlanScreen.tsx
```

Expected: every line is found. If Plan 4 or Plan 2 isn't merged, stop: this plan builds on them (roadmap). If a name differs, use the name that's there everywhere this plan uses the expected one, and record the pair under "Names" in Step 2's entry.

- [ ] **Step 2: Append the board entry.** These are numbered from D75, after the numbers Plans 2 to 4 use. Find the highest number used so far:

```bash
grep -o 'D[0-9]\+' docs/reimagine/BOARD.md | sort -t D -k 1.2 -n | tail -1
```

If the next free number isn't D75, renumber these from it, and use the new numbers wherever this plan cites D75–D84. Then add this at the end of `docs/reimagine/BOARD.md`, exactly:

```markdown
### 2026-10-10 — [claude] v2 Plan 5 (setup and upgrade): decisions before building

The plan is `docs/superpowers/plans/2026-10-10-fitstrong-v2-plan-5-setup.md`. It folds in B-06, B-07, B-08, B-18, B-24 and B-31, and fills Plan 4's setup-progress seam (D65).

| # | Decision | Why |
| --- | --- | --- |
| D75 | Setup keeps every answer as given in `settings.setup`: `draft` while unfinished, `answers` after. One function, `profileFrom()`, works out the profile from them. "Not sure" stays `'unsure'` in the answers, and becomes "may have" only there. Me edits a chapter with the same page views, one under another, and saves them together | §6.1; §16 "editable with the same pages" |
| D76 | §6.3's crosswalk is corrected to v1's field names, and the spec's table is updated in the same commit. No row is dropped; a row whose v1 field doesn't exist says so | §6.3 asks for it |
| D77 | Chapter 3's pain chip is "Back pain, sciatica or other pain", and chapter 5 lists every v1 area. "What helps" is kept in the answers only, never as `pain.preference`. `pain.neuroHistory` is new, and only Home's tiles read it | The engine reads calf and hamstring pain for everyone (`safety.ts`), and reads `preference` as a confirmed direction (`mobility.ts`); the engine reads today's symptoms, not the history (D29(2)) |
| D78 | Insulin or a tablet that can cause lows, with diabetes "No" or prediabetes, is read as diabetes `'other'` | The rules about lows apply only with diabetes, and a person on insulin may have it (§6.1 "Not sure" is "may have") |
| D79 | Upgraders aren't asked v2's new safety questions (eyes and feet without diabetes, "something else") unless they edit Your health. A Me edit owns only its chapters' fields. It re-asks what it makes newly needed: Your medicines, when diabetes or blood pressure is added. While a health review is pending, the three safety chapters open together | §6.6 "New questions are never forced"; the review clears only when every safety chapter is answered in one sitting |
| D80 | "Look around first" and finishing both set `onboardingComplete`; `settings.setup.stage` says which. While setup is unfinished, the profile hold reads "Finish setting up · Carry on setting up", and `/me/profile` opens setup where it stopped | §19.1 keeps one launch flag; L-20 |
| D81 | The programme's Join flow is its own four steps (experience, place, days, and length with a start date). Setup, Your plan and Goals all use it. It doesn't ask body weight or goals | Nothing in the engine reads them for the programme |
| D82 | Chapter 7 writes Plan 7's food contract. Plan 5 lands it early, word for word (Plan 7 Task 2 Steps 1, 6, 8, 10 and 11): Jain; `allergies` (P7-5's canonical ids, or the person's own words); and `level`. The screening answer is never stored (P7-8). Meal ideas filter by allergy only once Plan 7 lands. `food.mealTimes` isn't written: setup's meal times are the after-meal walk's (`habits.mealWalk.finish`) | One contract and one copy of each fact; the branch merges only after Plan 7 (B-22) |
| D83 | Weight, height and waist changes are dated readings; `height` is a new observation kind (Weight hub). A field shown in pounds or feet and saved unchanged keeps the stored kilograms or centimetres exactly, and adds no reading. An undated v1 weight is never given a date | §18.1, B-16 |
| D84 | v1's acknowledgement stays, on the Review page, for every first-time profile. In Safari on iPhone, Review offers "Moving to the Home Screen app?" with Make a backup, before finishing. Restored in the installed app, setup carries on at Review | v1's rule; A-27; §6.4 "a backup without a finished profile continues setup" |

**Crosswalk corrections (D76):**
- Prediabetes is an option of "Which type of diabetes?". It's a v1 value, which Home's Glucose tile and the session gate read.
- `priorDkaOrInsulinDeficiency` is asked with every diabetes answer, as v1 asks it (`DIABETES_MEDICINES`), not only with type 1, insulin or a "-gliflozin".
- Clinician limits are also asked with diabetes, as v1 asks them. ACSM screening counts diabetes (`profileRules`).
- Dizziness on standing is also asked with diabetes (autonomic neuropathy) and with "something else". v1 asked everyone.
- v1 has no `cardiac` effort-symptom, `footRestriction`, `footWound` or `neuroHistory` field:
  - effort symptoms are asked at every check-in;
  - a wound now, or a clinician's weight-bearing limit, is `footStatus: 'current_wound_or_active_charcot'`;
  - `pain.neuroHistory` is new (D77).
- The glucose start minimum sits with the insulin questions, which is where it's known whether lows are possible.
- Chapter 3's eye-treatment and foot-wound questions offer no "Not sure": both are things a person knows (§1.2 "where safety allows").
- `bpMedicinesReviewed` and `medicinesReviewed` are set only when every medicine they vouch for was answered (`wizardSteps.answeredOnOpen`).
```

- [ ] **Step 3: Replace §6.3's table in the journey spec.** In `docs/superpowers/specs/2026-10-08-fitstrong-v2-journey-design.md`, replace the table under "### 6.3 Every engine input and the question that sets it", from its header row to its `| back: …` row, with this table:

```markdown
| Engine field (v1 names) | Question | Asked when |
| --- | --- | --- |
| `diabetes` (`none`, `prediabetes`, `type1`, `type2`, `other`) | Diabetes chip; "Which type of diabetes?" Type 1 · Type 2 · Prediabetes · Another type · Not sure (Not sure → `other`) | diabetes yes or not sure. Insulin or a tablet that can cause lows with diabetes "No" or prediabetes reads as `other` (D78) |
| `hypertension` (`treated`, `untreated`, `unsure`); v1 has no separate `bpTreated` | High blood pressure chip; "Do you take medicine for high blood pressure?" | yes or not sure |
| `heartOrVascularDisease` (boolean; Not sure → true). Effort symptoms have no profile field: every check-in asks them | the heart chip | always (chapter 3, page 1) |
| `kidneyDisease` (`ckd`, `dialysis_or_transplant`, `unsure`) | kidney chip; "Are you on dialysis, or have you had a kidney transplant?" | yes or not sure |
| `fluidRestriction` | "Has a doctor given you a fluid limit?" | heart, kidney or something else, yes or not sure; and on Reminders when water reminders are turned on |
| `retinopathy` (v1's one field holds `recent_eye_treatment`) | eyes chip; "Eye treatment or surgery in the last 3 months?"; "How bad is the eye disease from diabetes?" | yes or not sure |
| `peripheralNeuropathy`, `footStatus` (v1 has no `footWound` or `footRestriction`: a wound now, or a clinician's weight-bearing limit, is `current_wound_or_active_charcot`) | foot chip: "Numbness or loss of feeling in your feet?", "A wound, an ulcer or a Charcot foot?"; chapter 5: "Has a clinician told you to keep weight off a foot?" | foot yes or not sure |
| `priorDkaOrInsulinDeficiency` | "Ever had diabetic ketoacidosis (DKA), or been told your body makes too little insulin?" | any diabetes answer (v1 asks every diabetic) |
| `ketoneTest` | "Can you test ketones?" | type 1, insulin with another type, a "-gliflozin", or past DKA yes or not sure |
| `dizzyOnStandingOrAutonomicNeuropathy` | "Do you get dizzy when you stand up?" | BP medicine (treated or not-sure BP, a beta-blocker), a diuretic, heart, diabetes, or something else |
| `insulin`, `insulinRegimen`, `sulfonylureaOrMeglitinide`, `highHypoRisk` | the medicine classes; "How do you take insulin?"; "A severe low in the last 6 months, or do you often not feel lows coming?" | classes: regular medicines yes or not sure ("No" answers each class No). Insulin page: diabetes with insulin or a lows tablet, or type 1 |
| `sglt2i` | the "-gliflozin" row | chapter 4, whatever the diabetes answer |
| `metformin`, `metforminSince` | the metformin row; "Year you started metformin (optional)" | regular medicines; the year with metformin yes |
| `betaBlocker`, `diuretic` | the beta-blocker and water-tablet rows | regular medicines yes or not sure ("No" answers both No) |
| `medicinesReviewed`, `bpMedicinesReviewed` | not a question: set when chapter 4 is complete and every medicine they vouch for was answered | — |
| `glucoseMonitor`, `glucoseUnit`, `bpMonitor` | "What do you have at home?" | always (B-06); the unit with a meter or sensor |
| `clearance`, `clinicianTargets` (`glucoseStartMin` and `glucoseStartUnit` on the insulin page; `bpStopSystolic`, `hba1cPercent`), `bpExercisePermission` | "Has a clinician cleared you to exercise?"; "Has a clinician given you any limits or targets?" | heart, kidney, eyes, BP, pain or diabetes (v1 also asks with diabetes); the targets with BP or diabetes |
| `currentlyActive` | "Do you exercise now?" (at least 30 minutes, 3 days a week, for the last 3 months) | chapter 6, page 1 |
| `needsHealthReview` | not a question: cleared when chapters 3 to 5 are complete in one sitting | — |
| back: `pain.areas`, `pain.sciaticaSide` (the spec's `side`), `pain.worseWith` (`aggravators`), `pain.neuroHistory` (new; not read by the engine), `pain.preference` (never asked, D77) | chapter 5 | a pain answer: back, sciatica or other pain (D77) |

Corrected by Plan 5 Task 1 against `src/types/profile.ts` and the engine (board D76).
```

- [ ] **Step 4: Remove the time claim (B-06).** In §6.4's first bullet, replace `The Right now card reads "Finish setting up (about 5 minutes)"` with `The Right now card reads "Finish setting up", with "Carry on setting up" (B-06: no time is claimed until it's measured)`.

- [ ] **Step 5: Rewrite J01 and J02 in the acceptance spec, and add the V-J journeys.** In `docs/reimagine/codex-acceptance.md`:
  - replace J01's step table and its **Stored:** line with the first block below;
  - in J02, replace step 1's outcome and step 3's action with the second block below;
  - add the third block after J20, before "## Checks on every screen and sheet".

J01 (replacing its table and **Stored:** line):

```markdown
| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | Open a fresh context at the app root. | `/setup`, heading `Welcome`, `Your health, in one place.`, the privacy line (B-24), a line on keeping data here, `Get started`, `Restore from a backup`, `Look around first` and the `Display` row. No location, motion or notification request. |
| 2 | Tap `Look around first`; reload at the next checkpoint. | Home (its greeting), and again after the reload. `settings.setup.stage='lookAround'`, `onboardingComplete=true`, no profile. `navigator.storage.persist()` was attempted where available. |
| 3 | Look at Home. | Four tabs. Right now: `Finish setting up`, button `Carry on setting up`. `startDate` is empty. |
| 4 | Open `Something else`. | Exactly five rows in fixed order: Stretch, Walk, Guided session, Log something, Learn. No Ask row, chat composer or assistant. Closing restores focus to the opener. |
| 5 | Open Learn, return, then Log something. Save steps `2000` for `2026-10-07`. | Learn is readable; Log something opens Today's log. Historical steps are `Manual`, `2000`, for 7 October. Today's missing steps read `Not entered`. |
| 6 | Stretch: no Start, with the health-questions reason. Home → `Carry on setting up`: setup page 1 → `Get started`. Answer P07's answers through Review: no conditions, no regular medicines, `Neither` and no cuff, `Not sure yet`, exercising now `No, not like that`, `No goal for now`, `Not now`, vegetarian, no food allergies, meal ideas only, reminders off, voice on. Tick the acknowledgement; `Start using FitStrong`. Stretch → the check-in. | Setup's questions come before movement, and no treatment is inferred from a default. After setup, the check-in, then a permission-approved Start. |
| 7 | Cancel before active movement, reload, open Me. | `startDate` empty, no session, `settings.focus='explore'`. No "Finish setting up" group. |

**Stored:** `settings.setup.stage='done'` with P07's answers and `completedAt`; `focus='explore'`. One manual steps day-total observation for 7 October. A profile with diabetes `none`, hypertension `none` and no pain areas. No weight, glucose, sleep, pain or movement observations before those facts are actually entered.
```

J02 (step 1's outcome, then step 3's action):

```markdown
| 1 | Load P01 with its legacy history. | Home opens without repeating first-run setup and with no dialog. The first element after the Right now block is the `FitStrong has a new Home` row. `Week 3 of 12` on the Workout hub; a visible `Why this?` explains the scheduled unfinished session. The historical session, both sets and notes are accessible in Today's log. Migration has exactly the eight observations specified above. |
| 3 | Variant: use a fresh P01 seed with `medicinesReviewed`, `metformin`, `metforminSince` and `priorDkaOrInsulinDeficiency` omitted, and `needsHealthReview=true`. Attempt Guided session. | Health/medicine review hold. No reliance on the seeded green readiness. Me → Profile & health → `Your health answers need a review` opens the three safety chapters, one under another, filled in from the record. Answer what's missing as P01: no clinician targets; regular medicines `Yes`; `Metformin`, since 2019; no DKA; no nerve damage. Save. The known metformin-only branch then permits a check-in with no glucose reading. |
```

The V-J journeys (new section):

```markdown
## v2 setup journeys (Plan 5)

### V-J10, P01: change my weight
| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | Load P01. Me → Profile & health → `Edit About you`. | `About you`, with `What should we call you?`, `Body for the exercise demos` and `Your height and weight`, one under another. |
| 2 | Type `80` in `Weight in kg`; `Save`. | `Saved. Home uses your new answers.` One new `weight` observation: 80 `kg`, `pointInTime`, `manual`, `context='profile'`, day 2026-10-08, no `timeUnknown`. The migrated 78 kg reading of 25 September is unchanged. `profile.weightKg` and `settings.currentWeight` are 80. No other profile field changed, and there's no height reading. |
| 3 | Open `/hub/weight`. | The latest weight is 80 kg, dated today. |
| 4 | Variant: `Edit About you` again; Units `ft, in and lb`; `Save` without typing. | `useMetric=false`; `profile.weightKg` is 80 and `heightCm` 175, exactly; no new observation (D83). |

### V-J11, P01: back up, and restore on a new phone
| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | Load P01. Me → Data → `Back up your record` → Download. | A backup file. |
| 2 | Close the context; open a fresh one at the root. | Setup page 1 (`Welcome`). |
| 3 | `Restore from a backup` → the file → `Restore`. | A preview before anything is written; then Home. The record equals the file, logically, as J18 step 9 compares it. |
| 4 | Variant: a file with `onboardingComplete=false` and a setup draft at `health.conditions` (figure `female`), restored from page 1; `Done`; `Get started`. | After the restore, page 1 stays: the file has no finished profile. Then `/setup/health/conditions` with `Welcome back, let’s carry on.` Back, Back: `Body for the exercise demos` with `Female figure` chosen. |

### V-J13, P01: upgrade from v1
| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | Load P01 (v4 seed). | Home with no dialog. The first element after the Right now block is the `FitStrong has a new Home` row, with `Show me` and `Got it`. |
| 2 | `Got it`; reload. | The row is gone and stays gone. `settings.setup`: `stage='done'`, `upgraded=true`, `newHomeSeen=true`, no `completedAt`. |
| 3 | Today's log for 25 September; the Glucose hub; the Weight hub. | The legacy session on 25 September; glucose 104 mg/dL and weight 78 kg on their hubs, each stored with its own date (25 September). |
| 4 | Me. | `Finish setting up · 2 short chapters`: `About you` (`What to call you`) and `Your food` (`Logging what you eat`), opening `/me/profile?chapter=about` and `/me/profile?chapter=food`. |
| 5 | Variant: a fresh P01; `Show me` → `Next`, `Next`, `Done`. | Three cards (`Your tiles are here`, `Trends is new`, `Browse is new`); then the row is gone and `newHomeSeen=true`. |

### V-J17, fresh: uncertain answers, and a draft that won't save
| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | `Get started`; `Next`; `Skip for now`; `Next`. On `Do you have any of these?` tick `Not sure: Diabetes` and `High blood pressure`. Make settings writes fail; `Next`. | `Your answers aren’t being saved on this phone.`, `Try again` and `Continue without saving`, on the same page with both still ticked. The stored draft is unchanged. |
| 2a | Writes work again; `Try again`. Answer `Not sure` wherever it's offered, `No` for ketone testing, `Neither` and no cuff for the monitors, then P07's answers for chapters 6 to 8; Review; tick; `Start using FitStrong`. | `Which type of diabetes?` comes next. The stored profile: diabetes `other`, hypertension `unsure`, insulin `unsure`; `sulfonylureaOrMeglitinide`, `sglt2i`, `metformin`, `betaBlocker`, `diuretic` and `priorDkaOrInsulinDeficiency` all `unsure`; `highHypoRisk` and dizziness true. No answer given as Not sure is stored as No. Stretch → the check-in asks for glucose and about ketones. |
| 2b | Variant: `Continue without saving`; answer as in 2a through Review; `Start using FitStrong`. | On every page after: `Your answers aren’t being saved on this phone. If you close FitStrong, they’re lost.` Home, with Right now `Finish setting up`, and Stretch held for the health questions. No profile and no completion stored. After a reload, setup again, at `Do you have any of these?`. |

### V-J18, P02: a medicine change after setup
| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | Load P02. Stretch → the check-in. | No ketone rows. |
| 2 | Me → Profile & health → `Edit Your medicines`. `Do you take any regular medicines?` → `Yes`; tick `A “-gliflozin” medicine`. | `Ketones` appears below: `Can you test ketones?` → `Urine strips`. `What do you have at home?`: `Neither`, and `No` for the cuff. `Save`: `Saved. Home uses your new answers.` and `Each check-in will ask about ketones and the signs of ketoacidosis.` Stored: `sglt2i=true`, `ketoneTest='urine'`, `medicinesReviewed=true`. |
| 3 | Home → Stretch → the check-in. | `Ketones, urine strip` is asked. |

### V-J37, fresh iPhone Safari: finish setup, then move to the Home Screen app
| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | iPhone Safari user agent; `persist()` refused. Page 1. | `Installing helps iPhone keep your data, but it isn’t a backup.` and `Show me how`, whose sheet shows the three steps. |
| 2 | Answer P02's answers through Review. | `Moving to the Home Screen app?` with `Make a backup first, then restore it there. Safari may remove data from websites you haven’t opened for a while.` `Make a backup` → `Save or share` → a file. Tick; `Start using FitStrong` → Home. |
| 3 | Me → Data. | Storage isn't guaranteed (temporary storage, B-30): the install status is `Not installed`. |
| 4 | A new context as the installed app (standalone), with empty storage (device loss, B-30). Page 1 → `Restore from a backup` → the file → `Restore` → `Done`; `Get started`. | No install line on page 1. Setup carries on at `Here’s what we’ll do for you`, with `Welcome back, let’s carry on.`; tick; `Start using FitStrong` → Home, with `settings.setup.stage='done'` and P02's answers. |
```

- [ ] **Step 6: Commit**

```bash
git add docs/reimagine/BOARD.md docs/reimagine/codex-acceptance.md docs/superpowers/specs/2026-10-08-fitstrong-v2-journey-design.md
git commit -m "docs: Record Plan 5's setup decisions and correct the field crosswalk"
```

---

### Task 2: The setup data model

**Files:**
- Modify: `src/types/setup.ts` (Plan 4's: `CHAPTER_IDS`, `ChapterId`), `src/types/index.ts` (`UserSettings.setup`), `src/types/profile.ts` (`name`, `waistCm`, `pain.neuroHistory`)
- Modify: `src/health/observation.ts` (`height`), `src/screens/track/format.ts` (`TITLES`), `src/redirects.ts`, `src/redirects.test.ts`
- Modify: `src/store/importCheck.ts`, `src/store/importCheck.test.ts`
- Modify: `src/store/useStore.ts`, `src/store/useStore.test.ts`

**Interfaces:**
- Consumes: `CHAPTER_IDS`, `ChapterId` (Plan 4, `src/types/setup.ts`).
- Produces, in `src/types/setup.ts`:
  - `PAGE_IDS` (29 ids, in setup's order) and `type PageId`;
  - `CONDITION_IDS` and `type ConditionId`;
  - `MEDICINE_CLASSES` and `type MedicineClass`;
  - `type Tri = 'yes' | 'no' | 'unsure'`;
  - `interface JoinAnswers`, `interface SetupAnswers`;
  - `interface SetupRecord` (what `settings.setup` holds, every field optional) and `interface SetupState extends SetupRecord` (with `stage` and `skipped` always there).
- Produces, in `src/types/profile.ts`: `UserProfile.name?: string`, `UserProfile.waistCm?: number`, `PainProfile.neuroHistory?: MedicineAnswer`.
- Produces:
  - `UserSettings.setup?: SetupRecord`, replacing Plan 4's `{ declined?: ChapterId[] }` with a type that includes it;
  - `ObservationKind` gains `'height'` (cm, `pointInTime`);
  - `UpdateOptions.addObservations?: readonly ObservationInput[]`: readings written in the same transaction as the update, with their ids and times fixed once.

- [ ] **Step 1: Write the types.** Append to `src/types/setup.ts`, after Plan 4's `CHAPTER_IDS` and `ChapterId`:

```ts
// ---- Plan 5: the pages, the answers and setup's state ----------------------
// "Set up once" (journey §6): every answer as the person gave it. "Not sure"
// stays `'unsure'` here; `profileFrom` (src/setup/assemble.ts) is the one
// place that turns it into "may have" for the engine (§6.1, board D75).

import type { DayOfWeek, Difficulty } from './index';
import type { Meal } from './habits';
import type { EquipmentAccess, PainArea, SessionMinutes, Side, VoiceSettings } from './profile';

/** Every page, in the order setup shows them. Each chapter shows only the ones that apply (§6.2). */
export const PAGE_IDS = [
  'welcome.start',
  'about.name', 'about.figure', 'about.body',
  'health.conditions', 'health.diabetes', 'health.bp', 'health.fluid', 'health.eyes', 'health.feet', 'health.limits',
  'medicines.regular', 'medicines.which', 'medicines.lows', 'medicines.ketones', 'medicines.standing', 'medicines.monitors',
  'backFeet.where', 'backFeet.side', 'backFeet.history',
  'movement.focus', 'movement.goal', 'movement.programme',
  'food.pattern', 'food.logging',
  'day.reminders', 'day.meals', 'day.voice',
  'review',
] as const;
export type PageId = (typeof PAGE_IDS)[number];

/** Yes, no, or "Not sure", which every safety rule reads as "may have" (§6.1). */
export type Tri = 'yes' | 'no' | 'unsure';

/** Chapter 3's chips (§6.2). `pain` is back pain, sciatica or other pain (board D77). */
export const CONDITION_IDS = ['diabetes', 'bp', 'heart', 'kidney', 'eyes', 'feet', 'pain', 'other'] as const;
export type ConditionId = (typeof CONDITION_IDS)[number];

/** Chapter 4's medicine classes, asked whatever the diagnosis (A-06, K-05). */
export const MEDICINE_CLASSES = ['insulin', 'lowsTablet', 'gliflozin', 'metformin', 'betaBlocker', 'diuretic', 'other'] as const;
export type MedicineClass = (typeof MEDICINE_CLASSES)[number];

/** The 12-week programme's Join flow (§6.2 ch. 6): the same answers wherever it's opened from (board D81). */
export interface JoinAnswers {
  experience: Difficulty;
  equipment: EquipmentAccess;
  days: DayOfWeek[];
  minutes: SessionMinutes;
  /** `YYYY-MM-DD`, today or later. */
  startDate: string;
}

export interface SetupAnswers {
  // ---- 2. About you
  name?: string;
  birthYear?: number;
  /** B-31: asked only when `birthYear` is this year minus 18. */
  adult?: boolean;
  figure?: 'male' | 'female' | 'either';
  /** cm and kg (true), or ft, in and lb; also the app's display unit (`settings.useMetric`). */
  metric?: boolean;
  heightCm?: number;
  weightKg?: number;
  waistCm?: number;
  // ---- 3. Your health
  /** A chip per condition. Rows left unticked become 'no' when the page is stored (`commitPage`). */
  conditions?: Partial<Record<ConditionId, Tri>>;
  diabetesType?: 'type1' | 'type2' | 'prediabetes' | 'other' | 'unsure';
  bpMedicine?: Tri;
  kidneyTreatment?: 'yes' | 'no';
  fluidLimit?: Tri;
  eyeTreatment?: 'yes' | 'no';
  eyeDisease?: 'mild' | 'moderate' | 'severe' | 'unsure';
  feetNumb?: Tri;
  footWound?: 'now' | 'past' | 'no';
  clearance?: 'none' | 'moderate' | 'vigorous' | 'unsure';
  targets?: Tri;
  bpStopSystolic?: number;
  bpPermission?: { sys: number; dia: number };
  hba1cPercent?: number;
  // ---- 4. Your medicines
  regular?: Tri;
  /** A row per class. Rows left unticked become 'no' when the page is stored. */
  classes?: Partial<Record<MedicineClass, Tri>>;
  /** As typed; stored only once it reads as a year (the page's check). */
  metforminSince?: string;
  insulinHow?: 'basalOnly' | 'multipleDaily' | 'pump' | 'closedLoop' | 'unsure';
  lowsRisk?: Tri;
  glucoseStartMin?: number;
  glucoseStartUnit?: 'mg/dL' | 'mmol/L';
  priorDka?: Tri;
  ketoneTest?: 'none' | 'urine' | 'blood';
  dizzy?: Tri;
  glucoseMonitor?: 'none' | 'meter' | 'cgm';
  glucoseUnit?: 'mg/dL' | 'mmol/L';
  bpCuff?: boolean;
  // ---- 5. Your back and feet
  painAreas?: PainArea[];
  sciaticaSide?: Side;
  worseWith?: 'flexion' | 'extension' | 'unknown';
  /** Optional, and kept here only (board D77). */
  helps?: ('moving' | 'lying' | 'heat' | 'bendingForward' | 'archingBack')[];
  neuroHistory?: Tri;
  footRestriction?: 'yes' | 'no';
  // ---- 6. Your movement
  focus?: 'stretch' | 'move' | 'strength' | 'explore';
  active?: 'yes' | 'no';
  weeklyGoal?: number | 'none';
  programme?: 'join' | 'notNow' | 'joined';
  join?: JoinAnswers;
  // ---- 7. Your food (Plan 7's contract, board D82)
  pattern?: 'vegetarian' | 'eggetarian' | 'nonVegetarian' | 'vegan' | 'jain';
  /** Canonical ids (P7-5), or the person's own words. */
  allergies?: string[];
  foodLevel?: 'ideas' | 'meals' | 'estimates';
  // ---- 8. Your day and coach
  water?: { on: boolean; glassMl: number; everyMinutes: number; from: string; to: string };
  sitting?: { on: boolean; everyMinutes: number; from: string; to: string };
  mealWalk?: { on: boolean; meals: Meal[] };
  /** When each walked-after meal usually finishes, `HH:MM` (`habits.mealWalk.finish`). */
  mealFinish?: Partial<Record<Meal, string>>;
  quiet?: { from: string; to: string } | 'none';
  delivery?: 'app' | 'calendar';
  voice?: Partial<VoiceSettings>;
  /** Pages answered with "Skip for now": their chapters wait in Me (§16). */
  skippedPages?: PageId[];
}

/**
 * What `settings.setup` holds. Every field may be missing: a v1 record holds
 * nothing, and one Plan 4 wrote holds only `declined`. `setupStateOf`
 * (src/setup/state.ts) reads it.
 */
export interface SetupRecord {
  /** 'open' while setup runs; 'lookAround' after "Look around first"; 'done' once finished (board D80). */
  stage?: 'open' | 'lookAround' | 'done';
  /** Unfinished setup: the page to resume on, and the answers so far (§6.1, §18.1). */
  draft?: { at?: PageId; answers?: SetupAnswers };
  /** Finished setup: the answers as given, for editing in Me with the same pages (§16). */
  answers?: SetupAnswers;
  /** When setup was finished here, ISO with offset. Absent for a record set up in v1. */
  completedAt?: string;
  /** Chapters skipped, or with questions new since v1: Me's "Finish setting up" lists them. */
  skipped?: ChapterId[];
  /** Chapters answered "Not now" in Me (Plan 4, D65). */
  declined?: ChapterId[];
  /** Set up in v1, before this build. */
  upgraded?: boolean;
  /** The one-time "FitStrong has a new Home" row was answered (§6.6). */
  newHomeSeen?: boolean;
}

/** Where setup stands, as `setupStateOf` reads it. */
export interface SetupState extends SetupRecord {
  stage: 'open' | 'lookAround' | 'done';
  skipped: ChapterId[];
}
```

Move the three `import type` lines to the top of the file, above Plan 4's `CHAPTER_IDS`. ESLint's `import/first` rule, if enabled, asks for that.

- [ ] **Step 2: Extend the profile and settings types.**
  - In `src/types/profile.ts`, in `PainProfile` after `preference`, add:

    ```ts
    /**
     * v2: a doctor once said a nerve in the back or leg was damaged (foot drop,
     * say). Read by Home's default tiles and the summary only: the engine reads
     * today's symptoms instead (D29(2), board D77). `'unsure'` is kept as it was said.
     */
    neuroHistory?: MedicineAnswer;
    ```

  - In `UserProfile`, after `food?`, add:

    ```ts
    /** v2: what to call the person, on screen only. The voice coach never says it (journey §6.2). */
    name?: string;
    /** v2: the latest waist in cm. Each change is also a dated `waist` reading (journey §18.1). */
    waistCm?: number;
    ```

  - In `src/types/index.ts`:
    - add `SetupRecord` to the `import type { ChapterId } from './setup';` line Plan 4 added;
    - replace Plan 4's `setup?: { declined?: ChapterId[] };` and its comment with:

      ```ts
        /**
         * v2 (journey §6, §18.1): first run, "Set up once", and what Me's
         * "Finish setting up" was told (`declined`, Plan 4). Absent on a v1
         * record: `setupStateOf` reads its state from what v1 kept.
         */
        setup?: SetupRecord;
      ```

    - at the end, add `export type { PageId, SetupAnswers, SetupRecord, SetupState, Tri } from './setup';` beside Plan 4's `ChapterId` re-export.

- [ ] **Step 3: The height reading.**
  - In `src/health/observation.ts`, add `| 'height'` after `| 'waist'` in `ObservationKind`. In `KINDS`, add this line after `waist`:

    ```ts
    height: { units: ['cm'], scopes: ['pointInTime'], label: 'Height' },
    ```

  - In `src/screens/track/format.ts`'s `TITLES`, add `height: 'Height',` after `waist`.
  - In `src/redirects.ts`'s `METRIC`, add `height: '/hub/weight',`. BMI and height live on the Weight hub (§5.1).
  - In `src/redirects.test.ts`'s kind table (`const to`), add `height: '/hub/weight',`.

- [ ] **Step 4: Write the failing import tests.** Append to `src/store/importCheck.test.ts`:

```ts
describe('setup in a backup file, read field by field (journey §18.1; D-08; Review Focus 5)', () => {
  const setup = {
    stage: 'open', skipped: [], declined: ['food'],
    draft: { at: 'health.conditions', answers: { figure: 'female', conditions: { diabetes: 'unsure', bp: 'no' }, weightKg: 72 } },
  };

  it('keeps a setup this build can read, Plan 4’s Not now included', () => {
    expect(preview(file({ settings: { ...settings, setup } })).unreadableFields).toEqual([]);
    expect(planImport(file({ settings: { ...settings, setup } }), 'replace', emptySnapshot()).change.settings?.replace?.setup).toEqual(setup);
  });

  it('leaves out, by name, a page this build lacks or an answer of the wrong kind, and keeps the rest', () => {
    const odd = { ...setup, draft: { at: 'health.somewhere', answers: { ...setup.draft.answers, conditions: { diabetes: 'maybe' } } } };
    expect(preview(file({ settings: { ...settings, setup: odd } })).unreadableFields)
      .toEqual(['settings.setup.draft.at', 'settings.setup.draft.answers.conditions']);
    const { change } = planImport(file({ settings: { ...settings, setup: odd } }), 'replace', emptySnapshot(), { allowRejected: true });
    expect(change.settings?.replace?.setup).toEqual({ ...setup, draft: { answers: { figure: 'female', weightKg: 72 } } });
    expect(preview(file({ settings: { ...settings, setup: { stage: 'done', skipped: ['nowhere'] } } })).unreadableFields).toEqual(['settings.setup.skipped']);
  });

  it('keeps answers a newer build added, as it keeps unknown fields', () => {
    expect(preview(file({ settings: { ...settings, setup: { stage: 'done', skipped: [], answers: { someNewQuestion: 'x' } } } })).unreadableFields).toEqual([]);
  });
});

describe('the profile’s v2 fields (journey §18.1)', () => {
  const profile = {
    ...createDefaultProfile({ weightKg: 70 }), name: 'Asha', waistCm: 92,
    pain: { areas: ['lowerBack'], worseWith: 'flexion', preference: 'untested', neuroHistory: 'unsure' },
  };
  it('reads the name, the waist and the nerve history', () => {
    expect(preview(file({ settings, profile })).unreadableFields).toEqual([]);
    expect(preview(file({ settings, profile: { ...profile, name: 42 } })).unreadableFields).toEqual(['profile.name']);
  });
});
```

- [ ] **Step 5: Run them to check they fail**

Run: `npx vitest run src/store/importCheck.test.ts`
Expected: FAIL. `settings.setup.draft` and `profile.name` are reported unreadable, or kept unchecked.

- [ ] **Step 6: Write the checks.** In `src/store/importCheck.ts`:
  - Add `CONDITION_IDS`, `MEDICINE_CLASSES` and `PAGE_IDS` to the import from `@/types/setup` that Plan 4 added for `CHAPTER_IDS`.
  - Add, after `HABIT_SPEC`:

    ```ts
    const PAIN_AREAS = ['lowerBack', 'sciatica', 'neck', 'shoulder', 'hip', 'knee', 'hamstring', 'calf'] as const;
    const PATTERNS = ['vegetarian', 'eggetarian', 'nonVegetarian', 'vegan', 'jain'] as const;
    const tri = oneOf('yes', 'no', 'unsure');
    const habitWindow = shape({ on: bool, everyMinutes: num(1, 1440), from: clock, to: clock }, ['on', 'everyMinutes', 'from', 'to']);
    /** The voice coach's settings: the profile's, and setup's answer (a part of them). */
    const VOICE: Check = shape({
      pack: text, voiceURI: text, voiceName: text, rate: num(0.1, 4),
      verbosity: oneOf('auto', 'detailed', 'standard', 'minimal'), mode: oneOf('coach', 'overMusic'), muted: bool, checked: bool,
    });
    /** Allergies: canonical ids or the person's words (Plan 7, B-13). */
    const ALLERGIES: Check = x => Array.isArray(x) && x.length <= 30 && x.every(a => typeof a === 'string' && a.trim() !== '' && a.length <= 60);

    /** Each setup answer a file may hold, by its type (journey §18.1). One that fails is left out by name; unknown ones are kept. */
    const ANSWER_SPEC: Spec = {
      name: x => typeof x === 'string' && x.length <= 60, birthYear: num(1900, 2100), adult: bool,
      figure: oneOf('male', 'female', 'either'), metric: bool, heightCm: num(50, 260), weightKg: num(10, 400), waistCm: num(30, 250),
      conditions: recordOf(oneOf(...CONDITION_IDS), tri), diabetesType: oneOf('type1', 'type2', 'prediabetes', 'other', 'unsure'),
      bpMedicine: tri, kidneyTreatment: oneOf('yes', 'no'), fluidLimit: tri, eyeTreatment: oneOf('yes', 'no'),
      eyeDisease: oneOf('mild', 'moderate', 'severe', 'unsure'), feetNumb: tri, footWound: oneOf('now', 'past', 'no'),
      clearance: oneOf('none', 'moderate', 'vigorous', 'unsure'), targets: tri, bpStopSystolic: num(90, 250),
      bpPermission: shape({ sys: num(90, 250), dia: num(50, 150) }, ['sys', 'dia']), hba1cPercent: num(4, 15),
      regular: tri, classes: recordOf(oneOf(...MEDICINE_CLASSES), tri), metforminSince: x => typeof x === 'string' && /^\d{4}$/.test(x),
      insulinHow: oneOf('basalOnly', 'multipleDaily', 'pump', 'closedLoop', 'unsure'), lowsRisk: tri, glucoseStartMin: num(3, 300),
      glucoseStartUnit: oneOf('mg/dL', 'mmol/L'), priorDka: tri, ketoneTest: oneOf('none', 'urine', 'blood'), dizzy: tri,
      glucoseMonitor: oneOf('none', 'meter', 'cgm'), glucoseUnit: oneOf('mg/dL', 'mmol/L'), bpCuff: bool,
      painAreas: listOf(oneOf(...PAIN_AREAS)), sciaticaSide: oneOf('left', 'right', 'both'), worseWith: oneOf('flexion', 'extension', 'unknown'),
      helps: listOf(oneOf('moving', 'lying', 'heat', 'bendingForward', 'archingBack')), neuroHistory: tri, footRestriction: oneOf('yes', 'no'),
      focus: oneOf('stretch', 'move', 'strength', 'explore'), active: oneOf('yes', 'no'), weeklyGoal: x => x === 'none' || num(0, 10080)(x),
      programme: oneOf('join', 'notNow', 'joined'),
      join: shape({
        experience: oneOf('beginner', 'intermediate', 'advanced'), equipment: oneOf('fullGym', 'homeDumbbells', 'homeNone'),
        days: listOf(oneOf(...DAYS)), minutes: oneOf(45, 60, 75), startDate: day,
      }, ['experience', 'equipment', 'days', 'minutes', 'startDate']),
      pattern: oneOf(...PATTERNS), allergies: ALLERGIES, foodLevel: oneOf('ideas', 'meals', 'estimates'),
      water: shape({ on: bool, glassMl: num(1, 5000), everyMinutes: num(1, 1440), from: clock, to: clock }, ['on', 'glassMl', 'everyMinutes', 'from', 'to']),
      sitting: habitWindow, mealWalk: shape({ on: bool, meals: listOf(oneOf(...MEALS)) }, ['on', 'meals']),
      mealFinish: recordOf(oneOf(...MEALS), clock), quiet: x => x === 'none' || shape({ from: clock, to: clock }, ['from', 'to'])(x),
      delivery: oneOf('app', 'calendar'), voice: VOICE, skippedPages: listOf(oneOf(...PAGE_IDS)),
    };

    /** Setup's state, field by field (Review Focus 5): a draft at a page this build lacks loses only its page, never its answers. */
    const SETUP_SPEC: Spec = {
      stage: oneOf('open', 'lookAround', 'done'),
      draft: { at: oneOf(...PAGE_IDS), answers: ANSWER_SPEC },
      answers: ANSWER_SPEC,
      completedAt: text,
      skipped: listOf(oneOf(...CHAPTER_IDS)),
      declined: listOf(oneOf(...CHAPTER_IDS)),
      upgraded: bool,
      newHomeSeen: bool,
    };
    ```

  - In `SETTINGS_SPEC`, replace Plan 4's `setup: { declined: listOf(oneOf(...CHAPTER_IDS)) },` and its comment with:

    ```ts
    // Field by field, answer by answer: what can be read is kept, and setup resumes from it.
    setup: SETUP_SPEC,
    ```

  - In `PROFILE_SPEC`, replace the inline `voice: shape({ … }),` with `voice: VOICE,`. Add `name: x => typeof x === 'string' && x.length <= 60,` and `waistCm: num(0, 300),`.
  - In `PAIN`, add `neuroHistory: medicine,`.

- [ ] **Step 7: Run them to check they pass**

Run: `npx vitest run src/store/importCheck.test.ts src/redirects.test.ts`
Expected: PASS.

- [ ] **Step 8: Write the failing store tests.** Append to `src/store/useStore.test.ts`:

```ts
describe('update with readings (journey §18.1: weight and height are dated readings)', () => {
  it('stores the change and the readings in one write', async () => {
    await booted();
    const result = await store.update(previous => ({ ...previous, settings: { ...previous.settings, currentWeight: 80 } }), {
      addObservations: [{ kind: 'weight', value: 80, unit: 'kg', scope: 'pointInTime', source: 'manual', context: 'profile' }],
    });
    expect(result.ok).toBe(true);
    const state = store.getState();
    expect(state.settings.currentWeight).toBe(80);
    expect(state.observations.filter(o => o.kind === 'weight').map(o => [o.value, o.context])).toEqual([[80, 'profile']]);
  });

  it('stores neither when the reading is refused', async () => {
    await booted({ failWrite: storeName => (storeName === 'observations' ? new DOMException('Disk is full', 'QuotaExceededError') : undefined) });
    const result = await store.update(previous => ({ ...previous, settings: { ...previous.settings, currentWeight: 81 } }), {
      addObservations: [{ kind: 'height', value: 170, unit: 'cm', scope: 'pointInTime', source: 'manual', context: 'profile' }],
    });
    expect(result.ok).toBe(false);
    expect(store.getState().settings.currentWeight).not.toBe(81);
    expect(store.getState().observations).toEqual([]);
  });

  it('gives each reading one identity however often the change is planned', async () => {
    await booted();
    await store.update(previous => previous, { addObservations: [{ kind: 'waist', value: 90, unit: 'cm', scope: 'pointInTime', source: 'manual' }] });
    expect(store.getState().observations.filter(o => o.kind === 'waist')).toHaveLength(1);
  });
});
```

- [ ] **Step 9: Run them to check they fail**

Run: `npx vitest run src/store/useStore.test.ts -t "update with readings"`
Expected: FAIL. `addObservations` is ignored, so no weight observation is stored.

- [ ] **Step 10: Write `addObservations`.** In `src/store/useStore.ts`:
  - add to `UpdateOptions`:

    ```ts
    /**
     * Readings recorded in the same write: the weight, height and waist an edit
     * of the profile states, each a dated reading (journey §18.1). Their ids and
     * times are fixed here, so a re-plan never makes a second record.
     */
    addObservations?: readonly ObservationInput[];
    ```

  - replace `update`'s body with:

    ```ts
    export function update(updater: (previous: AppData) => AppData, options: UpdateOptions = {}): Promise<StoreResult> {
      const now = nowAt();
      const adding = (options.addObservations ?? []).map(input => ({ ...input, id: input.id ?? freshId(), at: input.at ?? now }));
      return enqueue<void>({
        ...(options.hold ? { hold: true } : {}),
        plan: base => {
          const before = appDataOf(base);
          // A copy: an updater that edits in place cannot reach into live state.
          const after = updater(structuredClone(before));
          const change = describeUpdate(base, before, after, now, options.readings ?? 'append');
          const doomed = new Set((options.removeObservations ?? []).filter(id => findObservation(base, id)));
          // An invalid reading throws here, so the whole write is refused before anything shows.
          // One already stored, from an earlier plan of this same write, isn't added twice.
          const added = adding.filter(input => !findObservation(base, input.id)).map(input => newObservation(input));
          if (doomed.size === 0 && added.length === 0) return { change, result: () => undefined };
          const observations = change?.observations;
          return {
            change: {
              ...change,
              observations: {
                ...observations,
                put: [...(observations?.put ?? []).filter(o => !doomed.has(o.id)), ...added],
                remove: [...(observations?.remove ?? []), ...doomed],
              },
            },
            result: () => undefined,
          };
        },
      });
    }
    ```

  `newObservation` is already imported from `@/health/observation`; add it to that import if it isn't.

- [ ] **Step 11: Run the tests, then the gates**

Run: `npx vitest run src/store src/redirects.test.ts`
Expected: PASS.

```bash
npx tsc -b && npm run lint && npx vitest run
```

- [ ] **Step 12: Commit**

```bash
git add src/types src/health/observation.ts src/screens/track/format.ts src/redirects.ts src/redirects.test.ts src/store
git commit -m "feat: Add setup's answers to the record, and dated height readings"
```

---

### Task 3: The food contract chapter 7 writes (Plan 7's, landed early)

Chapter 7 stores the eating pattern (Jain included), allergies and the logging level in `profile.food`. Plan 7 defines those fields in its own Task 2, and says: "Chapter 7 writes the fields Task 2 defines." This plan runs first, so this task carries out Plan 7's Task 2 Steps 1, 6, 8, 10 and 11 word for word. Nothing then differs between the two plans (board D82). Plan 7 builds the rest: the logging level module, the allergen list and the filters.

Meal ideas don't filter by allergy until Plan 7's Task 3 lands; the branch merges only after Plan 7 (B-22). Meanwhile no screen may drop what setup stored. So Meal ideas' own food question keeps every other food answer (Step 5).

**Files:**
- Modify: `src/types/profile.ts` (`FoodPreferences`)
- Modify: `src/store/importCheck.ts` (`PROFILE_SPEC.food`), `src/store/importCheck.test.ts`
- Modify: `src/content/meals.ts` (`PATTERN_LABEL`, `PATTERN_DETAIL`), `src/content/index.ts`, `src/content/personalise.ts`, `src/content/personalise.test.ts`
- Modify: `src/screens/you/summaries.ts` (`FOOD_PATTERN`), `src/screens/guide/FoodPicker.tsx`

**Interfaces:**
- Produces, exactly as Plan 7's Task 2 Step 1 defines them:
  - `FoodPreferences.pattern` gains `'jain'`;
  - new optional `level`, `allergies`, `mealTimes`, `careTeamTargets` and `logReminder`.

  Setup writes `pattern`, `allergies` and `level` only.
- Produces: `PATTERN_DETAIL: Record<Pattern, string>` in `src/content/meals.ts`, exported from `@/content`.

- [ ] **Step 1: The type.** Replace `FoodPreferences` at the end of `src/types/profile.ts` with:

```ts
/** What meal ideas may include, and how much the person logs. Never inferred: only what the person said. */
export interface FoodPreferences {
  /** `jain` (journey §6.2 chapter 7): vegetarian, with no honey and no root vegetables or bulbs (board P7-6). */
  pattern: 'vegetarian' | 'eggetarian' | 'nonVegetarian' | 'vegan' | 'jain';
  /** Foods to leave out of meal ideas, in the person's own words (v1's "Leave out"). */
  avoid: string[];
  /** Optional regional leaning for meal examples. */
  region?: 'north' | 'south' | 'east' | 'west' | 'mixed';
  /**
   * v2 (journey §11.1): meal ideas only, meals with no numbers (counts-free,
   * B-11), or meals with calorie and carb estimates. Absent reads as `ideas`.
   */
  level?: 'ideas' | 'meals' | 'estimates';
  /**
   * v2 (B-13): a chip stores its canonical id (`peanut`, `treeNut`); "Something
   * else" stores the person's own words, resolved through the aliases when read.
   */
  allergies?: string[];
  /** Usual meal times, local HH:MM (journey §18.1). */
  mealTimes?: Partial<Record<'breakfast' | 'lunch' | 'dinner', string>>;
  /** A daily target the person's care team gave them (journey §11.5). The app never suggests one. */
  careTeamTargets?: { kcal?: number; carbsG?: number; setOn: string };
  /** One daily reminder to log a meal, with estimates only (journey §7.4, A-73; board P7-9). Absent: off. */
  logReminder?: { meal: 'breakfast' | 'lunch' | 'dinner'; at: string };
}
```

- [ ] **Step 2: Write the failing import test.** Append to `src/store/importCheck.test.ts`:

```ts
describe('food preferences in an import file (journey §18.1, B-13)', () => {
  const profile = (food: unknown) => ({ ...createDefaultProfile({ weightKg: 70 }), food });
  const food = {
    pattern: 'jain', avoid: ['mushrooms'], level: 'estimates', allergies: ['peanut', 'brinjal'],
    mealTimes: { lunch: '13:00' }, careTeamTargets: { kcal: 1600, setOn: '2026-10-01' }, logReminder: { meal: 'lunch', at: '14:30' },
  };
  it('reads v2 food preferences whole', () => {
    expect(preview(file({ settings, profile: profile(food) })).unreadableFields).toEqual([]);
    expect(planImport(file({ settings, profile: profile(food) }), 'replace', emptySnapshot()).change.profile?.food).toEqual(food);
  });
  it('leaves the food preferences out whole when any of them can’t be read, so meal ideas ask again rather than drop an allergy', () => {
    const bad = [
      { level: 'lots' }, { allergies: 'peanut' }, { allergies: [''] }, { allergies: ['x'.repeat(61)] },
      { careTeamTargets: { kcal: -5, setOn: '2026-10-01' } }, { careTeamTargets: { kcal: 1600 } },
      { logReminder: { meal: 'brunch', at: '11:00' } }, { mealTimes: { lunch: '1pm' } }, { pattern: 'paleo' },
    ];
    for (const over of bad) {
      expect(preview(file({ settings, profile: profile({ ...food, ...over }) })).unreadableFields, JSON.stringify(over)).toEqual(['profile.food']);
    }
  });
});
```

Run: `npx vitest run src/store/importCheck.test.ts`
Expected: FAIL. "jain" isn't an allowed pattern, so the first case reports `profile.food`.

- [ ] **Step 3: Read v2 food preferences.** In `src/store/importCheck.ts`, replace the `food:` line of `PROFILE_SPEC` with the following. `ALLERGIES` is Task 2's check, the same one Plan 7's Step 8 writes inline.

```ts
  // All or nothing (D-08): an unreadable allergy must not leave the rest standing as "no allergies".
  food: shape({
    pattern: oneOf('vegetarian', 'eggetarian', 'nonVegetarian', 'vegan', 'jain'),
    avoid: listOf(text),
    region: oneOf('north', 'south', 'east', 'west', 'mixed'),
    level: oneOf('ideas', 'meals', 'estimates'),
    allergies: ALLERGIES,
    mealTimes: recordOf(oneOf(...MEALS), clock),
    careTeamTargets: shape({ kcal: num(1, 10000), carbsG: num(1, 2000), setOn: day }, ['setOn']),
    logReminder: shape({ meal: oneOf(...MEALS), at: clock }, ['meal', 'at']),
  }, ['pattern', 'avoid']),
```

Run: `npx vitest run src/store/importCheck.test.ts`
Expected: PASS.

- [ ] **Step 4: Jain wherever patterns are named.** `tsc` now reports every `Record` keyed by the pattern. Fix each:
  - In `src/content/meals.ts`, add `jain: 'Jain',` to `PATTERN_LABEL`, and below it add:

    ```ts
    /** What each pattern means here, shown wherever it is chosen (board P7-6 for Jain). */
    export const PATTERN_DETAIL: Record<Pattern, string> = {
      vegetarian: 'Dairy, but no eggs, fish or meat',
      eggetarian: 'Dairy and eggs, but no fish or meat',
      nonVegetarian: 'Eggs, fish, chicken or meat',
      vegan: 'No dairy, eggs, fish or meat',
      jain: 'Dairy, but no eggs, fish, meat or honey, and no root vegetables such as onion, garlic or potato',
    };
    ```

    Export it from `src/content/index.ts`, beside `PATTERN_LABEL`.
  - In `src/screens/guide/FoodPicker.tsx`:
    - import `PATTERN_DETAIL` beside `PATTERN_LABEL` from `@/content`;
    - replace the `PATTERNS` array with `const PATTERNS: Pattern[] = ['vegetarian', 'eggetarian', 'nonVegetarian', 'vegan', 'jain'];`;
    - in the radio list, use `key={p}`, `label={PATTERN_LABEL[p]}`, `detail={PATTERN_DETAIL[p]}`, `checked={pattern === p}` and `onChange={() => setPattern(p)}`.
  - In `src/screens/you/summaries.ts`, add `jain: 'Jain',` to `FOOD_PATTERN`.
  - In `src/content/personalise.ts`, in the `if (food)` block, replace the reason map and the first `add`:

    ```ts
    const reason = {
      vegetarian: 'You eat vegetarian food',
      eggetarian: 'You eat vegetarian food and eggs',
      vegan: 'You eat vegan food',
      nonVegetarian: 'You eat meat or fish',
      jain: 'You follow a Jain diet',
    }[food.pattern];
    // A Jain plate is vegetarian for everything the Guide says (B12, vitamin D).
    add(food.pattern === 'jain' ? 'vegetarian' : food.pattern, reason);
    ```

  Append to `src/content/personalise.test.ts`, using the file's own `profile` helper:

```ts
describe('a Jain pattern (board P7-6)', () => {
  it('is vegetarian for the Guide’s facts, in the person’s own words', () => {
    const ctx = contextFromProfile(profile({ food: { pattern: 'jain', avoid: [] } }));
    expect(ctx.facts.has('vegetarian')).toBe(true);
    expect(ctx.facts.has('lowAnimalFood')).toBe(true);
    expect(ctx.because.get('vegetarian')).toBe('You follow a Jain diet');
  });
});
```

`suits(meal, 'jain')` is false for every template until Plan 7's Task 7, so a Jain person sees no meal ideas until then. That's expected on this branch (B-22).

- [ ] **Step 5: Meal ideas' food question keeps the rest.** In `FoodPicker.tsx`'s `submit`, the picker writes only what it asks. Replace the line that builds `next` with:

```ts
    // Only what this sheet asks: setup's allergies and logging level stay (board D82).
    const next: FoodPreferences = { ...food, pattern, avoid: parseAvoid(avoid) };
    if (region === 'any') delete next.region;
    else next.region = region;
```

Plan 7's Task 6 extends this same `next` with the allergies it then asks.

- [ ] **Step 6: Run the tests, then the gates**

Run: `npx vitest run src/content src/store/importCheck.test.ts`
Expected: PASS.

```bash
npx tsc -b && npm run lint && npx vitest run
```

- [ ] **Step 7: Commit**

```bash
git add src/types/profile.ts src/store/importCheck.ts src/store/importCheck.test.ts src/content src/screens/you/summaries.ts src/screens/guide/FoodPicker.tsx
git commit -m "feat: Land Plan 7's food preferences contract for setup's food chapter"
```

---
### Task 4: The page graph, units, the birth-year rule and setup's state

This is the graph B-06 asks to publish: every page, when it applies, what it sets, when it's answered, and whether it can be skipped. Two tests read it: this task's `setup.pages.test.ts`, and Task 5's `setup.fields.test.ts`.

**Files:**
- Create: `src/setup/age.ts`, `src/setup/age.test.ts`
- Create: `src/setup/units.ts`, `src/setup/units.test.ts`
- Create: `src/setup/facts.ts`
- Create: `src/setup/graph.ts`, `src/setup/setup.pages.test.ts`
- Create: `src/setup/fixtures.ts` (whole-run answer sets, for tests only)
- Create: `src/setup/state.ts`, `src/setup/state.test.ts`

**Interfaces:**
- Consumes:
  - Task 2's types;
  - `windowProblem` and `mealProblem` from `@/screens/you/habitOptions`;
  - `metforminYearProblem` and `weightFieldText` from `@/components/profile/wizardSteps`;
  - `LB_PER_KG` from `@/lib/utils`.
- Produces, in `age.ts`:
  - `OLDEST_YEAR = 1920`, `ADULT_AGE = 18`;
  - `birthYearProblem(year: number | undefined, thisYear: number): string | null`;
  - `asksAdult(year: number | undefined, thisYear: number): boolean`;
  - `ageRange(year: number | undefined, today: Date, adult?: boolean): { min: number; max: number } | undefined`.
- Produces, in `units.ts`:
  - `CM_PER_INCH`, `numberFrom(text): number | undefined`;
  - `interface HeightText { cm: string; ft: string; inch: string }`, `heightText(cm, metric): HeightText`, `heightFrom(text: HeightText, metric, stored): number | undefined`;
  - `weightFrom(text, metric, stored)`, `waistText(cm, metric)`, `waistFrom(text, metric, stored)`;
  - `heightProblem`, `weightProblem`, `waistProblem` (`(n: number | undefined) => string | null`).
- Produces, in `facts.ts`: `has(t: Tri | undefined): boolean`, `diabetesOf(a): HealthProfile['diabetes'] | undefined`, `interface Facts`, `factsOf(a: SetupAnswers): Facts`.
- Produces, in `graph.ts`:
  - `interface Ctx { thisYear: number }`, `interface PageDef`;
  - `PAGES`, `pageDef(id)`, `isPageId(x)`, `chapterOf(id: PageId): ChapterId | 'review'`;
  - `CHAPTER_TITLE: Record<ChapterId, string>`, `SAFETY_CHAPTERS: readonly ChapterId[]`;
  - `checklistDone(record, ids): boolean`, `commitPage(id, a): SetupAnswers`;
  - `pathFor(a): PageId[]`, `pageDone(id, a, ctx): boolean`;
  - `nextPage(a, from): PageId`, `prevPage(a, from): PageId | undefined`, `nextFromReview(a, from, ctx): PageId`, `firstPageOf(chapter, a): PageId`;
  - `missingPages(a, ctx): PageId[]`, `chapterComplete(chapter, a, ctx): boolean`, `skippedChapters(a, ctx): ChapterId[]`;
  - `resumeAt(a, at: PageId | undefined, ctx): PageId`, `guardFor(a, want: PageId, ctx): PageId | undefined`;
  - `capsuleOf(id, a): { label: string; fraction: number }`;
  - `hrefOf(id): string`, `pageAt(chapter?: string, page?: string): PageId | undefined`.
- Produces, in `state.ts`:
  - `upgradeSkipped(settings, profile): ChapterId[]`;
  - `setupStateOf(settings: Pick<UserSettings, 'setup' | 'onboardingComplete' | 'habits'>, profile: UserProfile | undefined): SetupState`;
  - `answersOf(s: SetupState): SetupAnswers`;
  - `withNewHomeSeen(data: AppData): AppData`.
- Produces, in `fixtures.ts`: `NO_CONDITIONS`, `NO_CLASSES`, `withC`, `withMeds`, `MINIMAL`, `COMPLEX`, `EVERYTHING`, `FOOT_WOUND`, `GLIFLOZIN_NO_DIABETES`, `INSULIN_NO_DIABETES`, `UNSURE` and `JOIN`.

- [ ] **Step 1: Write the failing birth-year test** `src/setup/age.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { ageRange, asksAdult, birthYearProblem } from './age';

describe('the year you were born (journey §6.2 ch. 2; K-43; B-31)', () => {
  it('is optional, and checked to be 1920 to this year minus 18', () => {
    expect(birthYearProblem(undefined, 2026)).toBeNull();
    expect(birthYearProblem(1958, 2026)).toBeNull();
    expect(birthYearProblem(2008, 2026)).toBeNull();
    expect(birthYearProblem(2009, 2026)).toBe('FitStrong is made for adults aged 18 and over.');
    expect(birthYearProblem(1919, 2026)).toMatch(/from 1920/);
    expect(birthYearProblem(2030, 2026)).toMatch(/from 1920/);
    expect(birthYearProblem(19, 2026)).toMatch(/from 1920/);
    expect(birthYearProblem(1958.5, 2026)).toMatch(/four digits/);
    expect(birthYearProblem(Number.NaN, 2026)).toMatch(/four digits/);
  });

  it('asks "Are you 18 or over?" only for the one year that could be 17 (B-31)', () => {
    expect(asksAdult(2008, 2026)).toBe(true);
    expect(asksAdult(2007, 2026)).toBe(false);
    expect(asksAdult(undefined, 2026)).toBe(false);
  });

  it('reads a borderline year at its lower end, unless the person said they’re 18 (B-31)', () => {
    const today = new Date('2026-10-10T09:00:00+05:30');
    expect(ageRange(2008, today)).toEqual({ min: 17, max: 18 });
    expect(ageRange(2008, today, true)).toEqual({ min: 18, max: 18 });
    expect(ageRange(1966, today)).toEqual({ min: 59, max: 60 });
    expect(ageRange(undefined, today)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/setup/age.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `src/setup/age.ts`**

```ts
/**
 * The year of birth (journey §6.2 ch. 2, K-43, B-31). A number field, checked
 * to be 1920 to this year minus 18. A year alone can't say whether the
 * birthday has passed, so the one borderline year asks "Are you 18 or over?",
 * and age-limited features read any year at the lower end of its range.
 */
export const OLDEST_YEAR = 1920;
export const ADULT_AGE = 18;

/** What's wrong with the year, or `null`. Empty is fine: the question is optional. */
export function birthYearProblem(year: number | undefined, thisYear: number): string | null {
  if (year === undefined) return null;
  if (!Number.isInteger(year)) return 'Enter the year as four digits, such as 1958.';
  if (year < OLDEST_YEAR || year > thisYear) return `Enter the year you were born, from ${OLDEST_YEAR}.`;
  if (year > thisYear - ADULT_AGE) return 'FitStrong is made for adults aged 18 and over.';
  return null;
}

/** B-31: only this year minus 18 could be 17 or 18. */
export function asksAdult(year: number | undefined, thisYear: number): boolean {
  return year === thisYear - ADULT_AGE;
}

/** The age a year allows: the birthday this year may or may not have passed. "18 or over" lifts the lower end. */
export function ageRange(year: number | undefined, today: Date, adult?: boolean): { min: number; max: number } | undefined {
  if (year === undefined) return undefined;
  const max = today.getFullYear() - year;
  return { min: adult === true && max === ADULT_AGE ? ADULT_AGE : max - 1, max };
}
```

- [ ] **Step 4: Write the failing units test** `src/setup/units.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { weightFieldText } from '@/components/profile/wizardSteps';
import { heightFrom, heightProblem, heightText, numberFrom, waistFrom, waistProblem, waistText, weightFrom, weightProblem } from './units';

describe('height, weight and waist as typed (journey §6.2 ch. 2; board D83)', () => {
  it('a page shown in feet and pounds, saved unchanged, keeps the stored values exactly (Review Focus 2)', () => {
    expect(heightText(170, false)).toEqual({ cm: '', ft: '5', inch: '7' });
    expect(heightFrom(heightText(170, false), false, 170)).toBe(170);
    expect(weightFrom(weightFieldText(78, false), false, 78)).toBe(78);
    expect(waistFrom(waistText(92, false), false, 92)).toBe(92);
    expect(heightFrom(heightText(170.18, true), true, 170.18)).toBe(170.18);
  });

  it('converts what is typed in feet, inches and pounds', () => {
    expect(heightFrom({ cm: '', ft: '5', inch: '8' }, false, 170)).toBe(172.7);
    expect(weightFrom('176', false, 78)).toBe(79.8);
    expect(waistFrom('38', false, 92)).toBe(96.5);
    expect(heightFrom({ cm: '', ft: '', inch: '' }, false, undefined)).toBeUndefined();
  });

  it('keeps typing as it comes: nothing for empty, the number so far, or not a number yet', () => {
    expect(numberFrom('')).toBeUndefined();
    expect(numberFrom('19')).toBe(19);
    expect(numberFrom('72,5')).toBe(72.5);
    expect(numberFrom('7x')).toBeNaN();
  });

  it('checks each measure against what a person can be, and empty is fine', () => {
    expect(heightProblem(undefined)).toBeNull();
    expect(heightProblem(170)).toBeNull();
    expect(heightProblem(17)).toMatch(/between 50 and 260/);
    expect(weightProblem(Number.NaN)).toMatch(/between 10 and 400/);
    expect(waistProblem(300)).toMatch(/between 30 and 250/);
  });
});
```

- [ ] **Step 5: Run it to check it fails, then write `src/setup/units.ts`**

Run: `npx vitest run src/setup/units.test.ts`
Expected: FAIL (module not found).

```ts
/**
 * Height, weight and waist as the person types them (journey §6.2 ch. 2). A
 * field shows the stored value in the unit chosen. While it still shows that,
 * the stored value is kept exactly, so saving in feet or pounds never drifts
 * it or adds a reading (Review Focus 2, board D83). Problems are checked at
 * Next or Save, never per keystroke.
 */
import { weightFieldText } from '@/components/profile/wizardSteps';
import { LB_PER_KG } from '@/lib/utils';

export const CM_PER_INCH = 2.54;
const tenth = (n: number) => Math.round(n * 10) / 10;

/** A number as typed: nothing for an empty field; NaN for one that isn't a number yet. */
export function numberFrom(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  return t === '' ? undefined : Number(t);
}

export interface HeightText { cm: string; ft: string; inch: string }

/** What the height fields show for a height: cm, or feet and inches. */
export function heightText(cm: number | undefined, metric: boolean): HeightText {
  if (cm === undefined || !Number.isFinite(cm) || cm <= 0) return { cm: '', ft: '', inch: '' };
  if (metric) return { cm: String(tenth(cm)), ft: '', inch: '' };
  const inches = Math.round(cm / CM_PER_INCH);
  return { cm: '', ft: String(Math.floor(inches / 12)), inch: String(inches % 12) };
}

/** The height the fields give, in cm: the stored one while they still show it. */
export function heightFrom(t: HeightText, metric: boolean, stored: number | undefined): number | undefined {
  const shown = heightText(stored, metric);
  if (stored !== undefined && (metric ? t.cm === shown.cm : t.ft === shown.ft && t.inch === shown.inch)) return stored;
  if (metric) return numberFrom(t.cm);
  const ft = numberFrom(t.ft);
  const inch = numberFrom(t.inch);
  if (ft === undefined && inch === undefined) return undefined;
  return tenth(((ft ?? 0) * 12 + (inch ?? 0)) * CM_PER_INCH);
}

/** The weight the field gives, in kg: the stored one while it still shows it. */
export function weightFrom(text: string, metric: boolean, stored: number | undefined): number | undefined {
  if (stored !== undefined && stored > 0 && text === weightFieldText(stored, metric)) return stored;
  const n = numberFrom(text);
  return n === undefined || metric ? n : tenth(n / LB_PER_KG);
}

/** What the waist field shows: cm, or whole inches. */
export function waistText(cm: number | undefined, metric: boolean): string {
  if (cm === undefined || !Number.isFinite(cm) || cm <= 0) return '';
  return String(metric ? tenth(cm) : Math.round(cm / CM_PER_INCH));
}

export function waistFrom(text: string, metric: boolean, stored: number | undefined): number | undefined {
  if (stored !== undefined && text === waistText(stored, metric)) return stored;
  const n = numberFrom(text);
  return n === undefined || metric ? n : tenth(n * CM_PER_INCH);
}

const outside = (n: number | undefined, lo: number, hi: number) => n !== undefined && (!Number.isFinite(n) || n < lo || n > hi);

export const heightProblem = (cm: number | undefined): string | null =>
  (outside(cm, 50, 260) ? 'Enter a height between 50 and 260 cm (1 ft 8 in and 8 ft 6 in).' : null);
export const weightProblem = (kg: number | undefined): string | null =>
  (outside(kg, 10, 400) ? 'Enter a weight between 10 and 400 kg (22 and 880 lb).' : null);
export const waistProblem = (cm: number | undefined): string | null =>
  (outside(cm, 30, 250) ? 'Enter a waist between 30 and 250 cm (12 and 98 inches).' : null);
```

Run: `npx vitest run src/setup/age.test.ts src/setup/units.test.ts`
Expected: PASS.

- [ ] **Step 6: Write `src/setup/facts.ts`**

```ts
/**
 * What the answers so far mean in the engine's terms: the conditions that
 * decide which pages apply (journey §6.3, board D76), and how `profileFrom`
 * reads them. One place, so a page's condition and the profile it writes
 * can't disagree.
 */
import type { HealthProfile } from '@/types/profile';
import type { SetupAnswers, Tri } from '@/types/setup';

/** "Yes" or "Not sure": every safety rule reads "Not sure" as "may have" (§6.1). */
export const has = (t: Tri | undefined): boolean => t === 'yes' || t === 'unsure';

/**
 * The diabetes value the engine reads, or `undefined` before the chip is
 * answered. "Not sure", or a type not given yet, is `'other'`. Insulin or a
 * tablet that can cause lows means lows are possible, so with "No" or
 * prediabetes it is `'other'` too (board D78; Review Focus 3).
 */
export function diabetesOf(a: SetupAnswers): HealthProfile['diabetes'] | undefined {
  const chip = a.conditions?.diabetes;
  if (chip === undefined) return undefined;
  const lowsMedicine = has(a.classes?.insulin) || has(a.classes?.lowsTablet);
  if (chip === 'no') return lowsMedicine ? 'other' : 'none';
  const t = a.diabetesType;
  const typed = t === 'type1' || t === 'type2' || t === 'prediabetes' || t === 'other' ? t : 'other';
  return typed === 'prediabetes' && lowsMedicine ? 'other' : typed;
}

export interface Facts {
  diabetic: boolean;
  /** Type 1, or insulin ticked or not sure. */
  insulin: boolean;
  /** Diabetes with insulin or a tablet that can cause lows: the engine's `hypoRisk`. */
  hypoRisk: boolean;
  /** Type 1, a "-gliflozin", insulin with another type, or past DKA: ketones matter. */
  ketoneRisk: boolean;
  bp: boolean;
  /** High blood pressure treated or not sure, a beta-blocker or a diuretic: the dizziness question's "BP medicine". */
  bpMeds: boolean;
  heart: boolean;
  kidney: boolean;
  eyes: boolean;
  feet: boolean;
  pain: boolean;
  other: boolean;
  /** Lower back or sciatica among the areas: which leg and what makes it worse are asked. */
  back: boolean;
  /** Regular medicines, yes or not sure: the classes are asked. */
  medicines: boolean;
  /** A wound now, or a clinician's weight-bearing limit: walking is held (K-30). */
  footHeld: boolean;
}

export function factsOf(a: SetupAnswers): Facts {
  const c = a.conditions ?? {};
  const k = a.classes ?? {};
  const diabetes = diabetesOf(a);
  const diabetic = diabetes === 'type1' || diabetes === 'type2' || diabetes === 'other';
  const insulin = diabetes === 'type1' || has(k.insulin);
  const bp = has(c.bp);
  const feet = has(c.feet);
  return {
    diabetic,
    insulin,
    hypoRisk: diabetic && (insulin || has(k.lowsTablet)),
    ketoneRisk: diabetes === 'type1' || has(k.gliflozin) || (diabetes === 'other' && has(k.insulin)) || (diabetic && has(a.priorDka)),
    bp,
    bpMeds: (bp && a.bpMedicine !== 'no') || has(k.betaBlocker) || has(k.diuretic),
    heart: has(c.heart),
    kidney: has(c.kidney),
    eyes: has(c.eyes),
    feet,
    pain: has(c.pain),
    other: has(c.other),
    back: (a.painAreas ?? []).some(x => x === 'lowerBack' || x === 'sciatica'),
    medicines: a.regular === 'yes' || a.regular === 'unsure',
    footHeld: feet && (a.footWound === 'now' || a.footRestriction === 'yes'),
  };
}
```

- [ ] **Step 7: Write the fixtures** `src/setup/fixtures.ts`

```ts
/**
 * Whole first runs, for the setup tests only: every page on each one's path
 * is answered, so `missingPages` is empty for each. Nothing in the app
 * imports this file.
 */
import type { ConditionId, JoinAnswers, MedicineClass, SetupAnswers, Tri } from '@/types/setup';

export const NO_CONDITIONS = { diabetes: 'no', bp: 'no', heart: 'no', kidney: 'no', eyes: 'no', feet: 'no', pain: 'no', other: 'no' } as const satisfies Record<ConditionId, Tri>;
export const NO_CLASSES = { insulin: 'no', lowsTablet: 'no', gliflozin: 'no', metformin: 'no', betaBlocker: 'no', diuretic: 'no', other: 'no' } as const satisfies Record<MedicineClass, Tri>;

/** No conditions, no medicines and nothing turned on: the minimal path (journey §1.2). */
export const MINIMAL: SetupAnswers = {
  figure: 'either', metric: true,
  conditions: { ...NO_CONDITIONS },
  regular: 'no',
  glucoseMonitor: 'none', bpCuff: false,
  focus: 'explore', active: 'yes', weeklyGoal: 'none', programme: 'notNow',
  pattern: 'vegetarian', allergies: [], foodLevel: 'ideas',
  delivery: 'app', voice: { muted: false },
};

/** MINIMAL with these chips, and anything else given. */
export const withC = (c: Partial<Record<ConditionId, Tri>>, extra: SetupAnswers = {}): SetupAnswers =>
  ({ ...MINIMAL, conditions: { ...NO_CONDITIONS, ...c }, ...extra });
/** MINIMAL with regular medicines of these classes. */
export const withMeds = (classes: Partial<Record<MedicineClass, Tri>>, extra: SetupAnswers = {}): SetupAnswers =>
  ({ ...MINIMAL, regular: 'yes', classes: { ...NO_CLASSES, ...classes }, ...extra });

/** Diabetes on insulin, treated high blood pressure and sciatica: the complex path (journey §1.2). */
export const COMPLEX: SetupAnswers = {
  name: 'Asha', birthYear: 1958, figure: 'female', metric: true, heightCm: 158, weightKg: 68,
  conditions: { ...NO_CONDITIONS, diabetes: 'yes', bp: 'yes', pain: 'yes' },
  diabetesType: 'type2', bpMedicine: 'yes', clearance: 'moderate', targets: 'no',
  regular: 'yes', classes: { ...NO_CLASSES, insulin: 'yes', metformin: 'yes', other: 'yes' }, metforminSince: '2015',
  insulinHow: 'multipleDaily', lowsRisk: 'no', priorDka: 'no', dizzy: 'no',
  glucoseMonitor: 'meter', glucoseUnit: 'mg/dL', bpCuff: true,
  painAreas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion', neuroHistory: 'no',
  focus: 'stretch', active: 'no', weeklyGoal: 90, programme: 'notNow',
  pattern: 'vegetarian', allergies: ['peanut'], foodLevel: 'estimates',
  water: { on: true, glassMl: 250, everyMinutes: 120, from: '09:00', to: '21:00' }, fluidLimit: 'no',
  mealWalk: { on: true, meals: ['lunch', 'dinner'] }, mealFinish: { lunch: '13:30', dinner: '20:30' },
  quiet: { from: '22:00', to: '07:00' }, delivery: 'app', voice: { muted: false },
};

/** Every chip yes, every follow-up answered: the longest path there is. */
export const EVERYTHING: SetupAnswers = {
  ...COMPLEX,
  conditions: { diabetes: 'yes', bp: 'yes', heart: 'yes', kidney: 'yes', eyes: 'yes', feet: 'yes', pain: 'yes', other: 'yes' },
  kidneyTreatment: 'no', eyeTreatment: 'no', eyeDisease: 'mild', feetNumb: 'no', footWound: 'no', footRestriction: 'no',
};

/** P05-like: type 2 diabetes, numb feet and a wound now; no regular medicines. */
export const FOOT_WOUND: SetupAnswers = withC({ diabetes: 'yes', feet: 'yes' }, {
  diabetesType: 'type2', feetNumb: 'yes', footWound: 'now', footRestriction: 'no', clearance: 'none', targets: 'no', priorDka: 'no', dizzy: 'no',
});

/** A "-gliflozin" for the heart or kidneys, with no diabetes (A-06). */
export const GLIFLOZIN_NO_DIABETES: SetupAnswers = withMeds({ gliflozin: 'yes' }, { ketoneTest: 'none' });

/** Insulin ticked with diabetes "No" (board D78; Review Focus 3). */
export const INSULIN_NO_DIABETES: SetupAnswers = withMeds({ insulin: 'yes' }, {
  insulinHow: 'basalOnly', lowsRisk: 'no', priorDka: 'no', ketoneTest: 'none', clearance: 'none', targets: 'no', dizzy: 'no',
});

/** "Not sure" wherever it's offered, with high blood pressure (V-J17). */
export const UNSURE: SetupAnswers = withC({ diabetes: 'unsure', bp: 'yes', heart: 'unsure' }, {
  diabetesType: 'unsure', bpMedicine: 'unsure', fluidLimit: 'unsure', clearance: 'unsure', targets: 'unsure',
  regular: 'unsure',
  classes: { insulin: 'unsure', lowsTablet: 'unsure', gliflozin: 'unsure', metformin: 'unsure', betaBlocker: 'unsure', diuretic: 'unsure', other: 'unsure' },
  insulinHow: 'unsure', lowsRisk: 'unsure', priorDka: 'unsure', ketoneTest: 'none', dizzy: 'unsure',
});

export const JOIN: JoinAnswers = { experience: 'beginner', equipment: 'homeNone', days: ['monday', 'thursday', 'saturday'], minutes: 45, startDate: '2026-10-12' };
```

- [ ] **Step 8: Write the failing page test** `src/setup/setup.pages.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { CHAPTER_IDS, PAGE_IDS, type PageId, type SetupAnswers } from '@/types/setup';
import { COMPLEX, EVERYTHING, FOOT_WOUND, GLIFLOZIN_NO_DIABETES, INSULIN_NO_DIABETES, JOIN, MINIMAL, NO_CONDITIONS, UNSURE } from './fixtures';
import {
  PAGES, capsuleOf, chapterComplete, commitPage, firstPageOf, guardFor, hrefOf, missingPages, nextFromReview, nextPage, pageAt, pageDone, pathFor,
  prevPage, resumeAt, skippedChapters,
} from './graph';

const CTX = { thisYear: 2026 };

describe('setup’s pages (journey §1.2, §6.2; B-06)', () => {
  it('has every page once, in setup’s order', () => {
    expect(PAGES.map(p => p.id)).toEqual([...PAGE_IDS]);
    expect(CHAPTER_IDS).toHaveLength(8);
  });

  it('the minimal path is 15 pages, within 20, Welcome and Review counted', () => {
    const path = pathFor(MINIMAL);
    expect(path).toEqual([
      'welcome.start', 'about.name', 'about.figure', 'about.body', 'health.conditions', 'medicines.regular', 'medicines.monitors',
      'movement.focus', 'movement.goal', 'movement.programme', 'food.pattern', 'food.logging', 'day.reminders', 'day.voice', 'review',
    ]);
    expect(path.length).toBeLessThanOrEqual(20);
  });

  it('the complex path is 26 pages, within 30; the Join flow is not among them (L-01)', () => {
    expect(pathFor(COMPLEX)).toHaveLength(26);
    expect(pathFor({ ...COMPLEX, programme: 'join', join: JOIN })).toHaveLength(26);
  });

  it('no answers make setup longer than 29 pages', () => {
    expect(pathFor(EVERYTHING)).toEqual([...PAGE_IDS]);
    expect(PAGE_IDS).toHaveLength(29);
  });

  it('every fixture is a whole run: nothing on its path is left to answer', () => {
    for (const a of [MINIMAL, COMPLEX, EVERYTHING, FOOT_WOUND, GLIFLOZIN_NO_DIABETES, INSULIN_NO_DIABETES, UNSURE]) expect(missingPages(a, CTX)).toEqual([]);
  });

  it('a checklist is one question: a row ticked answers it, and the rest are stored as No (B-08)', () => {
    const ticked: SetupAnswers = { conditions: { diabetes: 'unsure' } };
    expect(pageDone('health.conditions', ticked, CTX)).toBe(true);
    expect(commitPage('health.conditions', ticked).conditions).toEqual({ ...NO_CONDITIONS, diabetes: 'unsure' });
    expect(pageDone('health.conditions', { conditions: {} }, CTX)).toBe(false);
    expect(commitPage('health.conditions', { conditions: {} }).conditions).toEqual({});
    expect(pageDone('health.conditions', { conditions: { ...NO_CONDITIONS } }, CTX)).toBe(true);
  });

  it('a number not yet checked holds the page', () => {
    expect(pageDone('about.name', { birthYear: 19 }, CTX)).toBe(false);
    expect(pageDone('about.name', { birthYear: 2008 }, CTX)).toBe(false);
    expect(pageDone('about.name', { birthYear: 2008, adult: true }, CTX)).toBe(true);
    expect(pageDone('about.body', { weightKg: Number.NaN }, CTX)).toBe(false);
    expect(pageDone('medicines.which', { classes: { metformin: 'yes' }, metforminSince: '201' }, CTX)).toBe(false);
  });
});

describe('every conditional page can be reached, and none is always on (B-06)', () => {
  const REACH: Record<PageId, SetupAnswers> = {
    'welcome.start': MINIMAL, 'about.name': MINIMAL, 'about.figure': MINIMAL, 'about.body': MINIMAL,
    'health.conditions': MINIMAL, 'health.diabetes': COMPLEX, 'health.bp': COMPLEX, 'health.fluid': EVERYTHING,
    'health.eyes': EVERYTHING, 'health.feet': FOOT_WOUND, 'health.limits': COMPLEX,
    'medicines.regular': MINIMAL, 'medicines.which': COMPLEX, 'medicines.lows': INSULIN_NO_DIABETES,
    'medicines.ketones': GLIFLOZIN_NO_DIABETES, 'medicines.standing': UNSURE, 'medicines.monitors': MINIMAL,
    'backFeet.where': COMPLEX, 'backFeet.side': COMPLEX, 'backFeet.history': FOOT_WOUND,
    'movement.focus': MINIMAL, 'movement.goal': MINIMAL, 'movement.programme': MINIMAL,
    'food.pattern': MINIMAL, 'food.logging': MINIMAL,
    'day.reminders': MINIMAL, 'day.meals': COMPLEX, 'day.voice': MINIMAL, 'review': MINIMAL,
  };
  for (const [id, a] of Object.entries(REACH) as [PageId, SetupAnswers][]) {
    it(`${id} is reached`, () => expect(pathFor(a)).toContain(id));
  }

  it('the pages that depend on an answer are exactly these', () => {
    expect(PAGE_IDS.filter(id => !pathFor(MINIMAL).includes(id))).toEqual([
      'health.diabetes', 'health.bp', 'health.fluid', 'health.eyes', 'health.feet', 'health.limits',
      'medicines.which', 'medicines.lows', 'medicines.ketones', 'medicines.standing',
      'backFeet.where', 'backFeet.side', 'backFeet.history', 'day.meals',
    ]);
  });

  it('asks the monitors whether or not a medicine is taken (B-06)', () => {
    expect(pathFor(MINIMAL)).toContain('medicines.monitors');
  });

  it('a diabetes medicine with "No" diabetes brings the insulin, ketone and limits pages (D78)', () => {
    expect(pathFor(INSULIN_NO_DIABETES)).toEqual(expect.arrayContaining(['health.limits', 'medicines.lows', 'medicines.ketones', 'medicines.standing']));
  });

  it('a wound now takes the after-meal walks off (K-30)', () => {
    expect(pathFor({ ...FOOT_WOUND, mealWalk: { on: true, meals: ['lunch'] } })).not.toContain('day.meals');
  });
});

describe('moving through setup', () => {
  it('goes forward and back over pages that don’t apply', () => {
    expect(nextPage(MINIMAL, 'health.conditions')).toBe('medicines.regular');
    expect(prevPage(MINIMAL, 'medicines.regular')).toBe('health.conditions');
    expect(prevPage(MINIMAL, 'welcome.start')).toBeUndefined();
    expect(nextPage(MINIMAL, 'day.voice')).toBe('review');
  });

  it('a page that stops applying still knows the page after it', () => {
    expect(nextPage(MINIMAL, 'day.meals')).toBe('day.voice');
  });

  it('from Review, Edit walks its own chapter, then any page the change made necessary, then back to Review', () => {
    expect(nextFromReview(COMPLEX, 'about.name', CTX)).toBe('about.figure');
    expect(nextFromReview(COMPLEX, 'about.body', CTX)).toBe('review');
    const feet: SetupAnswers = { ...COMPLEX, conditions: { ...COMPLEX.conditions, feet: 'yes' } };
    expect(nextFromReview(feet, 'health.bp', CTX)).toBe('health.feet');
    expect(nextFromReview(feet, 'health.limits', CTX)).toBe('backFeet.history');
  });

  it('opens a chapter at its first page; Your back and feet without pain at the question that brings it', () => {
    expect(firstPageOf('about', MINIMAL)).toBe('about.name');
    expect(firstPageOf('backFeet', MINIMAL)).toBe('health.conditions');
    expect(firstPageOf('backFeet', COMPLEX)).toBe('backFeet.where');
  });

  it('names the chapter and its place on the capsule', () => {
    expect(capsuleOf('about.name', MINIMAL).label).toBe('About you · 2 of 8');
    expect(capsuleOf('day.voice', MINIMAL).label).toBe('Your day and coach · 8 of 8');
    expect(capsuleOf('review', MINIMAL)).toEqual({ label: 'Review', fraction: 1 });
    expect(capsuleOf('health.conditions', MINIMAL).fraction).toBeCloseTo(5 / 15);
  });

  it('lives at /setup/:chapter/:page, with page 1 at /setup (§19.2)', () => {
    expect(hrefOf('welcome.start')).toBe('/setup');
    expect(hrefOf('health.conditions')).toBe('/setup/health/conditions');
    expect(hrefOf('review')).toBe('/setup/review');
    expect(pageAt('health', 'conditions')).toBe('health.conditions');
    expect(pageAt('health', 'nowhere')).toBeUndefined();
    expect(pageAt(undefined, undefined)).toBeUndefined();
  });

  it('puts a skipped preference page’s chapter under Finish setting up', () => {
    expect(skippedChapters(MINIMAL, CTX)).toEqual([]);
    expect(skippedChapters({ ...MINIMAL, weeklyGoal: undefined, skippedPages: ['movement.goal'] }, CTX)).toEqual(['movement']);
    expect(chapterComplete('backFeet', MINIMAL, CTX)).toBe(true);
  });
});

describe('resuming, and pages opened directly (Review Focus 5)', () => {
  const partway: SetupAnswers = { figure: 'female', conditions: { ...NO_CONDITIONS } };

  it('carries on at the stored page while it still applies', () => {
    expect(resumeAt(partway, 'medicines.regular', CTX)).toBe('medicines.regular');
  });

  it('goes to the first page left when the stored page no longer applies, or this build has no such page', () => {
    expect(resumeAt(partway, 'health.diabetes', CTX)).toBe('medicines.regular');
    expect(resumeAt(partway, 'health.somewhere' as PageId, CTX)).toBe('medicines.regular');
  });

  it('starts at the first question when no page was kept', () => {
    expect(resumeAt({}, undefined, CTX)).toBe('about.name');
    expect(resumeAt(partway, undefined, CTX)).toBe('about.name');
  });

  it('sends a page opened past an unanswered safety page back to it', () => {
    expect(guardFor({}, 'medicines.regular', CTX)).toBe('health.conditions');
    expect(guardFor(partway, 'medicines.regular', CTX)).toBeUndefined();
  });

  it('lets a page opened past a skipped preference page stay', () => {
    expect(guardFor({ conditions: { ...NO_CONDITIONS } }, 'medicines.regular', CTX)).toBeUndefined();
  });

  it('sends a page that doesn’t apply to the first page left', () => {
    expect(guardFor(MINIMAL, 'health.diabetes', CTX)).toBe('review');
  });
});
```

- [ ] **Step 9: Run it to check it fails**

Run: `npx vitest run src/setup/setup.pages.test.ts`
Expected: FAIL, "Cannot find module './graph'".

- [ ] **Step 10: Write `src/setup/graph.ts`**

```ts
/**
 * Setup's pages: when each applies, what it sets, when it's answered, and
 * whether it may be skipped (journey §6.2; B-06 publishes this graph). The
 * conditions follow §6.3 as corrected on the board (D76). Counts and
 * reachability: setup.pages.test.ts. Fields: setup.fields.test.ts.
 */
import {
  CHAPTER_IDS, CONDITION_IDS, MEDICINE_CLASSES, PAGE_IDS, type ChapterId, type PageId, type SetupAnswers, type Tri,
} from '@/types/setup';
import { metforminYearProblem } from '@/components/profile/wizardSteps';
import { mealProblem, windowProblem } from '@/screens/you/habitOptions';
import { asksAdult, birthYearProblem } from './age';
import { factsOf, has, type Facts } from './facts';
import { heightProblem, waistProblem, weightProblem } from './units';

export interface Ctx { thisYear: number }

export interface PageDef {
  id: PageId;
  /** Shown only when this holds for the answers so far. */
  when: (a: SetupAnswers, f: Facts) => boolean;
  /** Its answers are complete: Next may store them and move on. */
  done: (a: SetupAnswers, f: Facts, ctx: Ctx) => boolean;
  /** The answers it sets; the crosswalk test reads these. */
  sets: readonly (keyof SetupAnswers)[];
  /** A preference page offers "Skip for now"; a safety page never does (§6.1). */
  skippable: boolean;
}

const always = () => true;
const inRange = (n: number | undefined, lo: number, hi: number) => n === undefined || (Number.isFinite(n) && n >= lo && n <= hi);
const okWindow = (w: { on: boolean; everyMinutes: number; from: string; to: string } | undefined) =>
  !w?.on || windowProblem(w.from, w.to, w.everyMinutes) === undefined;
const glucoseOk = (a: SetupAnswers) => {
  const mmol = (a.glucoseStartUnit ?? a.glucoseUnit) === 'mmol/L';
  return inRange(a.glucoseStartMin, mmol ? 3 : 54, mmol ? 17 : 300);
};

/** A checklist is one question (B-08): answered once a row is ticked, or "None of these" is (every row No). */
export function checklistDone<K extends string>(r: Partial<Record<K, Tri>> | undefined, ids: readonly K[]): boolean {
  return r !== undefined && (ids.some(id => has(r[id])) || ids.every(id => r[id] === 'no'));
}

const fill = <K extends string>(r: Partial<Record<K, Tri>>, ids: readonly K[]): Record<K, Tri> =>
  Object.fromEntries(ids.map(id => [id, r[id] ?? 'no'])) as Record<K, Tri>;

export const PAGES: readonly PageDef[] = [
  { id: 'welcome.start', when: always, done: always, sets: [], skippable: false },
  { id: 'about.name', when: always, sets: ['name', 'birthYear', 'adult'], skippable: true,
    done: (a, _f, ctx) => birthYearProblem(a.birthYear, ctx.thisYear) === null && (!asksAdult(a.birthYear, ctx.thisYear) || a.adult === true) },
  { id: 'about.figure', when: always, sets: ['figure'], skippable: true, done: a => a.figure !== undefined },
  { id: 'about.body', when: always, sets: ['metric', 'heightCm', 'weightKg', 'waistCm'], skippable: false,
    done: a => heightProblem(a.heightCm) === null && weightProblem(a.weightKg) === null && waistProblem(a.waistCm) === null },
  { id: 'health.conditions', when: always, sets: ['conditions'], skippable: false, done: a => checklistDone(a.conditions, CONDITION_IDS) },
  { id: 'health.diabetes', when: a => has(a.conditions?.diabetes), sets: ['diabetesType'], skippable: false, done: a => a.diabetesType !== undefined },
  { id: 'health.bp', when: (_a, f) => f.bp, sets: ['bpMedicine'], skippable: false, done: a => a.bpMedicine !== undefined },
  { id: 'health.fluid', when: (_a, f) => f.heart || f.kidney || f.other, sets: ['kidneyTreatment', 'fluidLimit'], skippable: false,
    done: (a, f) => a.fluidLimit !== undefined && (!f.kidney || a.kidneyTreatment !== undefined) },
  { id: 'health.eyes', when: (_a, f) => f.eyes, sets: ['eyeTreatment', 'eyeDisease'], skippable: false,
    done: a => a.eyeTreatment === 'yes' || (a.eyeTreatment === 'no' && a.eyeDisease !== undefined) },
  { id: 'health.feet', when: (_a, f) => f.feet, sets: ['feetNumb', 'footWound'], skippable: false,
    done: a => a.feetNumb !== undefined && a.footWound !== undefined },
  { id: 'health.limits', when: (_a, f) => f.heart || f.kidney || f.eyes || f.bp || f.pain || f.diabetic,
    sets: ['clearance', 'targets', 'bpStopSystolic', 'bpPermission', 'hba1cPercent'], skippable: false,
    done: (a, f) => a.clearance !== undefined && (!(f.bp || f.diabetic) || a.targets !== undefined)
      && inRange(a.bpStopSystolic, 90, 250) && inRange(a.hba1cPercent, 4, 15)
      && (a.bpPermission === undefined || (inRange(a.bpPermission.sys, 90, 250) && inRange(a.bpPermission.dia, 50, 150))) },
  { id: 'medicines.regular', when: always, sets: ['regular'], skippable: false, done: a => a.regular !== undefined },
  { id: 'medicines.which', when: (_a, f) => f.medicines, sets: ['classes', 'metforminSince'], skippable: false,
    done: (a, _f, ctx) => checklistDone(a.classes, MEDICINE_CLASSES) && metforminYearProblem(a.metforminSince ?? '', ctx.thisYear) === null },
  { id: 'medicines.lows', when: (a, f) => f.diabetic && (f.insulin || has(a.classes?.lowsTablet)),
    sets: ['insulinHow', 'lowsRisk', 'glucoseStartMin', 'glucoseStartUnit'], skippable: false,
    done: (a, f) => (!f.insulin || a.insulinHow !== undefined) && a.lowsRisk !== undefined && glucoseOk(a) },
  { id: 'medicines.ketones', when: (a, f) => f.diabetic || has(a.classes?.gliflozin), sets: ['priorDka', 'ketoneTest'], skippable: false,
    done: (a, f) => (!f.diabetic || a.priorDka !== undefined) && (!f.ketoneRisk || a.ketoneTest !== undefined) },
  { id: 'medicines.standing', when: (_a, f) => f.bpMeds || f.heart || f.diabetic || f.other, sets: ['dizzy'], skippable: false,
    done: a => a.dizzy !== undefined },
  { id: 'medicines.monitors', when: always, sets: ['glucoseMonitor', 'glucoseUnit', 'bpCuff'], skippable: false,
    done: a => a.glucoseMonitor !== undefined && a.bpCuff !== undefined && (a.glucoseMonitor === 'none' || a.glucoseUnit !== undefined) },
  { id: 'backFeet.where', when: (_a, f) => f.pain, sets: ['painAreas'], skippable: false, done: a => a.painAreas !== undefined },
  { id: 'backFeet.side', when: (_a, f) => f.pain && f.back, sets: ['sciaticaSide', 'worseWith', 'helps'], skippable: false,
    done: a => a.worseWith !== undefined && (!(a.painAreas ?? []).includes('sciatica') || a.sciaticaSide !== undefined) },
  { id: 'backFeet.history', when: (_a, f) => f.pain || f.feet, sets: ['neuroHistory', 'footRestriction'], skippable: false,
    done: (a, f) => (!f.pain || a.neuroHistory !== undefined) && (!f.feet || a.footRestriction !== undefined) },
  { id: 'movement.focus', when: always, sets: ['focus', 'active'], skippable: false, done: a => a.focus !== undefined && a.active !== undefined },
  { id: 'movement.goal', when: always, sets: ['weeklyGoal'], skippable: true, done: a => a.weeklyGoal !== undefined },
  { id: 'movement.programme', when: always, sets: ['programme', 'join'], skippable: false,
    done: a => a.programme === 'notNow' || a.programme === 'joined' || (a.programme === 'join' && a.join !== undefined) },
  { id: 'food.pattern', when: always, sets: ['pattern', 'allergies'], skippable: true, done: a => a.pattern !== undefined && a.allergies !== undefined },
  // The screening question is asked on this page before estimates are stored, and never kept (K-22, board D82).
  { id: 'food.logging', when: always, sets: ['foodLevel'], skippable: true, done: a => a.foodLevel !== undefined },
  { id: 'day.reminders', when: always, sets: ['water', 'sitting', 'mealWalk', 'mealFinish', 'quiet', 'delivery', 'fluidLimit'], skippable: true,
    done: a => okWindow(a.water) && okWindow(a.sitting) && (!a.water?.on || a.fluidLimit !== undefined) && (!a.mealWalk?.on || a.mealWalk.meals.length > 0) },
  { id: 'day.meals', when: (a, f) => a.mealWalk?.on === true && !f.footHeld, sets: ['mealFinish'], skippable: false,
    done: a => mealProblem(a.mealWalk?.meals ?? [], a.mealFinish ?? {}) === undefined },
  { id: 'day.voice', when: always, sets: ['voice'], skippable: false, done: always },
  { id: 'review', when: always, sets: [], skippable: false, done: always },
];

const BY_ID = new Map<string, PageDef>(PAGES.map(p => [p.id, p]));
export const isPageId = (x: unknown): x is PageId => typeof x === 'string' && BY_ID.has(x);
export const pageDef = (id: PageId): PageDef => BY_ID.get(id)!;
export const chapterOf = (id: PageId): ChapterId | 'review' => (id === 'review' ? 'review' : (id.split('.')[0] as ChapterId));

/** What each chapter is called (journey §6.2), on the capsule, the review cards, Me and Profile & health. */
export const CHAPTER_TITLE: Record<ChapterId, string> = {
  welcome: 'Welcome', about: 'About you', health: 'Your health', medicines: 'Your medicines',
  backFeet: 'Your back and feet', movement: 'Your movement', food: 'Your food', day: 'Your day and coach',
};

/** The chapters the engine's profile gaps depend on (§6.1). */
export const SAFETY_CHAPTERS: readonly ChapterId[] = ['health', 'medicines', 'backFeet'];

export function pathFor(a: SetupAnswers): PageId[] {
  const f = factsOf(a);
  return PAGES.filter(p => p.when(a, f)).map(p => p.id);
}

export function pageDone(id: PageId, a: SetupAnswers, ctx: Ctx): boolean {
  return pageDef(id).done(a, factsOf(a), ctx);
}

/** What a page stores: a checklist's unticked rows are No once it's answered (B-08). */
export function commitPage(id: PageId, a: SetupAnswers): SetupAnswers {
  if (id === 'health.conditions' && a.conditions && checklistDone(a.conditions, CONDITION_IDS)) return { ...a, conditions: fill(a.conditions, CONDITION_IDS) };
  if (id === 'medicines.which' && a.classes && checklistDone(a.classes, MEDICINE_CLASSES)) return { ...a, classes: fill(a.classes, MEDICINE_CLASSES) };
  return a;
}

/** The next page that applies after `from`, in setup's order; Review is last. */
export function nextPage(a: SetupAnswers, from: PageId): PageId {
  const f = factsOf(a);
  return PAGES.slice(PAGE_IDS.indexOf(from) + 1).find(p => p.when(a, f))?.id ?? 'review';
}

export function prevPage(a: SetupAnswers, from: PageId): PageId | undefined {
  const f = factsOf(a);
  return PAGES.slice(0, PAGE_IDS.indexOf(from)).reverse().find(p => p.when(a, f))?.id;
}

const skippedOf = (a: SetupAnswers) => new Set<PageId>(a.skippedPages ?? []);

/**
 * Next, from a chapter opened with Review's Edit: the rest of that chapter,
 * then any page the change made necessary, then Review again.
 */
export function nextFromReview(a: SetupAnswers, from: PageId, ctx: Ctx): PageId {
  const path = pathFor(a);
  const after = path.slice(path.indexOf(from) + 1);
  const skipped = skippedOf(a);
  return after.find(id => chapterOf(id) === chapterOf(from))
    ?? after.find(id => id !== 'review' && !skipped.has(id) && !pageDone(id, a, ctx))
    ?? 'review';
}

/** Where Edit opens a chapter. Your back and feet has no page without a pain or foot answer, so it opens the question that brings them. */
export function firstPageOf(chapter: ChapterId, a: SetupAnswers): PageId {
  return pathFor(a).find(id => chapterOf(id) === chapter) ?? 'health.conditions';
}

/** Pages on the path still to answer, apart from those skipped: Review lists them. */
export function missingPages(a: SetupAnswers, ctx: Ctx): PageId[] {
  const skipped = skippedOf(a);
  return pathFor(a).filter(id => id !== 'review' && !skipped.has(id) && !pageDone(id, a, ctx));
}

export function chapterComplete(chapter: ChapterId, a: SetupAnswers, ctx: Ctx): boolean {
  return pathFor(a).filter(id => chapterOf(id) === chapter).every(id => pageDone(id, a, ctx));
}

/** Chapters with a page skipped or left on the path: Me lists them under "Finish setting up" (§16). */
export function skippedChapters(a: SetupAnswers, ctx: Ctx): ChapterId[] {
  const path = pathFor(a);
  const skipped = skippedOf(a);
  return CHAPTER_IDS.filter(c => c !== 'welcome' && path.some(id => chapterOf(id) === c && (skipped.has(id) || !pageDone(id, a, ctx))));
}

const firstLeft = (a: SetupAnswers, ctx: Ctx, safetyOnly: boolean): PageId | undefined => {
  const skipped = skippedOf(a);
  return pathFor(a).find(id => id !== 'welcome.start' && id !== 'review' && !skipped.has(id) && !pageDone(id, a, ctx)
    && (!safetyOnly || !pageDef(id).skippable));
};

/**
 * Where setup carries on (§6.1 "resumes on the same page"): the stored page
 * while it still applies; otherwise the first page left to answer, as when a
 * draft comes from another build (Review Focus 5). With no page kept, the
 * first question.
 */
export function resumeAt(a: SetupAnswers, at: PageId | undefined, ctx: Ctx): PageId {
  if (at === undefined) return 'about.name';
  if (isPageId(at) && pathFor(a).includes(at)) return at;
  return firstLeft(a, ctx, false) ?? 'review';
}

/** A page opened directly: where to go instead, if it doesn't apply, or comes after a safety page not yet answered. */
export function guardFor(a: SetupAnswers, want: PageId, ctx: Ctx): PageId | undefined {
  const path = pathFor(a);
  const blocking = firstLeft(a, ctx, true);
  if (!path.includes(want)) return blocking ?? 'review';
  if (blocking !== undefined && path.indexOf(blocking) < path.indexOf(want)) return blocking;
  return undefined;
}

/** The glass capsule: "About you · 2 of 8", and how far along the path this page is (M22). */
export function capsuleOf(id: PageId, a: SetupAnswers): { label: string; fraction: number } {
  if (id === 'review') return { label: 'Review', fraction: 1 };
  const path = pathFor(a);
  const chapter = chapterOf(id) as ChapterId;
  const at = Math.max(0, path.indexOf(id));
  return { label: `${CHAPTER_TITLE[chapter]} · ${CHAPTER_IDS.indexOf(chapter) + 1} of 8`, fraction: (at + 1) / path.length };
}

export function hrefOf(id: PageId): string {
  if (id === 'welcome.start') return '/setup';
  if (id === 'review') return '/setup/review';
  const [chapter, page] = id.split('.');
  return `/setup/${chapter}/${page}`;
}

export function pageAt(chapter: string | undefined, page: string | undefined): PageId | undefined {
  const id = `${chapter}.${page}`;
  return isPageId(id) ? id : undefined;
}
```

- [ ] **Step 11: Run it to check it passes**

Run: `npx vitest run src/setup/setup.pages.test.ts`
Expected: PASS.

If a count is off, list the path with `console.log(pathFor(COMPLEX))` in the test, and read each page's `when` against the fixture: the counts in the test are the specification (J§1.2).

- [ ] **Step 12: Write the failing state test** `src/setup/state.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
import { createDefaultProfile } from '@/profile/defaults';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import { setupStateOf, upgradeSkipped, withNewHomeSeen } from './state';

const v1 = createDefaultProfile({ weightKg: 78, health: { diabetes: 'type2', medicinesReviewed: true } });

describe('where setup stands (journey §6.6, §19.1; board D80)', () => {
  it('a first run is open', () => {
    expect(setupStateOf({ onboardingComplete: false }, undefined)).toEqual({ stage: 'open', skipped: [] });
  });

  it('a v1 Welcome left part-way is open, so setup carries on from what it kept (K-57)', () => {
    expect(setupStateOf({ onboardingComplete: false }, v1).stage).toBe('open');
  });

  it('v1’s Explore first is v2’s Look around first', () => {
    expect(setupStateOf({ onboardingComplete: true }, undefined)).toEqual({ stage: 'lookAround', skipped: [], upgraded: true });
  });

  it('a record set up in v1 is done, waiting only on chapters with new questions (§6.6)', () => {
    expect(setupStateOf({ onboardingComplete: true }, v1)).toEqual({ stage: 'done', skipped: ['about', 'food'], upgraded: true });
    const named = { ...v1, name: 'Asha', food: { pattern: 'vegetarian' as const, avoid: [], level: 'ideas' as const } };
    expect(upgradeSkipped({}, named)).toEqual([]);
    expect(upgradeSkipped({ habits: { mealWalk: { enabled: true, meals: ['lunch'] } } }, named)).toEqual(['day']);
  });

  it('keeps what Me was told “Not now” before this build wrote anything (Plan 4, D65)', () => {
    expect(setupStateOf({ onboardingComplete: true, setup: { declined: ['food'] } }, v1))
      .toEqual({ stage: 'done', skipped: ['about', 'food'], upgraded: true, declined: ['food'] });
  });

  it('a stored state wins; one whose skipped list was left out on import reads as nothing skipped (Review Focus 5)', () => {
    const stored = { stage: 'done', skipped: [], completedAt: '2026-10-08T09:00:00.000+05:30' } as const;
    expect(setupStateOf({ onboardingComplete: true, setup: stored }, v1)).toEqual(stored);
    expect(setupStateOf({ onboardingComplete: true, setup: { stage: 'open' } }, v1)).toEqual({ stage: 'open', skipped: [] });
  });

  it('answering the new-Home row keeps everything else', () => {
    const data: AppData = { ...migrateData({ version: CURRENT_VERSION } as AppData), profile: v1 };
    data.settings = { ...data.settings, onboardingComplete: true };
    expect(withNewHomeSeen(data).settings.setup).toEqual({ stage: 'done', skipped: ['about', 'food'], upgraded: true, newHomeSeen: true });
    expect(withNewHomeSeen(data).profile).toBe(data.profile);
  });
});
```

- [ ] **Step 13: Run it to check it fails, then write `src/setup/state.ts`**

Run: `npx vitest run src/setup/state.test.ts`
Expected: FAIL (module not found).

```ts
/**
 * Where setup stands (journey §6, §18.1, §19.1). A v1 record has no
 * `settings.setup`, and one Plan 4 wrote has only `declined`. Its state is
 * read from what v1 kept, and written the first time something changes it.
 * There's no migration step and no interstitial (§6.6).
 */
import type { AppData, UserSettings } from '@/types';
import type { UserProfile } from '@/types/profile';
import type { ChapterId, SetupAnswers, SetupState } from '@/types/setup';

/** The chapters a v1 record has new questions in: name, food logging, and meal times for after-meal walks (§6.6, board D79). */
export function upgradeSkipped(settings: Pick<UserSettings, 'habits'>, profile: UserProfile): ChapterId[] {
  const walk = settings.habits?.mealWalk;
  return [
    ...(profile.name === undefined ? ['about' as const] : []),
    ...(profile.food?.level === undefined ? ['food' as const] : []),
    ...(walk?.enabled && walk.meals.some(meal => !walk.finish?.[meal]) ? ['day' as const] : []),
  ];
}

export function setupStateOf(settings: Pick<UserSettings, 'setup' | 'onboardingComplete' | 'habits'>, profile: UserProfile | undefined): SetupState {
  const stored = settings.setup ?? {};
  if (stored.stage !== undefined) return { ...stored, stage: stored.stage, skipped: stored.skipped ?? [] };
  const declined = stored.declined?.length ? { declined: [...stored.declined] } : {};
  if (!settings.onboardingComplete) return { stage: 'open', skipped: [], ...declined };
  if (!profile) return { stage: 'lookAround', skipped: [], upgraded: true, ...declined };
  return { stage: 'done', skipped: upgradeSkipped(settings, profile), upgraded: true, ...declined };
}

/** The answers so far, wherever they're kept. */
export const answersOf = (s: SetupState): SetupAnswers => s.draft?.answers ?? s.answers ?? {};

/** The one-time "FitStrong has a new Home" row was answered (§6.6). */
export function withNewHomeSeen(data: AppData): AppData {
  return { ...data, settings: { ...data.settings, setup: { ...setupStateOf(data.settings, data.profile), newHomeSeen: true } } };
}
```

- [ ] **Step 14: Run the tests, then the gates**

Run: `npx vitest run src/setup`
Expected: PASS.

```bash
npx tsc -b && npm run lint && npx vitest run
```

- [ ] **Step 15: Commit**

```bash
git add src/setup
git commit -m "feat: Publish setup's page graph with its counts, reachability and resume rules"
```

---

### Task 5: From answers to the record, and the crosswalk test

**Files:**
- Create: `src/setup/assemble.ts`, `src/setup/fields.ts`, `src/setup/assemble.test.ts`, `src/setup/setup.fields.test.ts`
- Create: `src/programme/join.ts`, `src/programme/join.test.ts`
- Modify: `src/screens/move/plan.ts` (`startDateProblem` moves out)
- Modify: `src/categories.ts` (`defaultHome`), `src/categories.test.ts`

**Interfaces:**
- Consumes:
  - Task 4's graph, facts and state;
  - `ladderAfterEdit` from `@/components/profile/wizardSteps`, and `startingLadder`;
  - `conditionBlock` from `@/reminders/water`;
  - `defaultHome` and `isHomeLayout`;
  - Plan 2's `withWeeklyGoal(settings, goal, day)` from `@/screens/track/weeklyGoal`.
- Produces, in `assemble.ts`:
  - `put(target, key, value)` and `compact(o)`;
  - `healthFrom(a, base: HealthProfile, today): HealthProfile`;
  - `painFrom(a, base: PainProfile): PainProfile`;
  - `foodFrom(a, base?: FoodPreferences): FoodPreferences | undefined`;
  - `profileFrom(a, base: UserProfile | undefined, today: string, ctx: Ctx, chapters: readonly ChapterId[] = CHAPTER_IDS): UserProfile`;
  - `habitsFrom(a, base: HabitSettings | undefined, profile): HabitSettings`;
  - `settingsFrom(a, base: UserSettings, profile, today: string, chapters = CHAPTER_IDS): Partial<UserSettings>`;
  - `measurementsFrom(a, before: UserProfile | undefined, at: string): ObservationInput[]`;
  - `completedSetup(data: AppData, a, now: string, ctx: Ctx & { hasSteps: boolean }): AppData`;
  - `lookedAround(data: AppData): AppData`.
- Produces, in `fields.ts`:
  - `HEALTH_SOURCES: Record<keyof HealthProfile, readonly (keyof SetupAnswers)[]>`;
  - `PAIN_SOURCES: Record<keyof PainProfile, readonly (keyof SetupAnswers)[] | 'learned'>`;
  - `keysOfChapter(c): (keyof SetupAnswers)[]`, `fieldsOfChapter(c): string[]` (`profile.…` and `settings.…` paths).
- Produces, in `src/programme/join.ts`:
  - `JOIN_STEPS`, `type JoinStep`;
  - `startDateProblem(date, today): string | null`, moved here from `src/screens/move/plan.ts`, which re-exports it;
  - `joinProblem(step, j, today): string | null`;
  - `joinInitial(profile: UserProfile | undefined, today: string): JoinAnswers`;
  - `withJoinAnswers(data: AppData, j: JoinAnswers): AppData`;
  - `joinLine(j: JoinAnswers): string`.
- Produces: `defaultHome(input: { profile; settings; hasSteps: boolean; backUnsure?: boolean })`.

- [ ] **Step 1: Write the failing Join test** `src/programme/join.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
import { createDefaultProfile } from '@/profile/defaults';
import { isEnrolled } from '@/health/recommend';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import { JOIN } from '@/setup/fixtures';
import { joinInitial, joinLine, joinProblem, withJoinAnswers } from './join';

const TODAY = '2026-10-10';

describe('the programme’s Join flow (journey §6.2 ch. 6; D35; board D81)', () => {
  it('starts from what the profile says, on today', () => {
    const p = createDefaultProfile({ experience: 'beginner', equipment: 'homeNone', trainingDays: ['tuesday'], sessionMinutes: 45 });
    expect(joinInitial(p, TODAY)).toEqual({ experience: 'beginner', equipment: 'homeNone', days: ['tuesday'], minutes: 45, startDate: TODAY });
  });

  it('needs a day, and a start of today or later', () => {
    expect(joinProblem('days', { ...JOIN, days: [] }, TODAY)).toBe('Choose at least one day.');
    expect(joinProblem('length', { ...JOIN, startDate: '2026-10-09' }, TODAY)).toMatch(/today or a later/i);
    expect(joinProblem('length', JOIN, TODAY)).toBeNull();
    expect(joinProblem('experience', JOIN, TODAY)).toBeNull();
  });

  it('joins with those answers and that start date, in week order, and changes nothing else', () => {
    const before: AppData = { ...migrateData({ version: CURRENT_VERSION } as AppData), profile: createDefaultProfile({ health: { footStatus: 'current_wound_or_active_charcot' } }) };
    const after = withJoinAnswers(before, { ...JOIN, days: ['saturday', 'monday'] });
    expect(after.profile).toMatchObject({ experience: 'beginner', equipment: 'homeNone', trainingDays: ['monday', 'saturday'], sessionMinutes: 45 });
    expect(after.profile?.health).toEqual(before.profile?.health);
    expect(after.settings.startDate).toBe('2026-10-12');
    expect(isEnrolled(after.settings, after.profile)).toBe(true);
  });

  it('says what was chosen in one line', () => {
    expect(joinLine(JOIN)).toBe('3 days a week, 45 minutes, from Monday 12 October');
    expect(joinLine({ ...JOIN, days: ['monday'] })).toMatch(/^1 day a week/);
  });
});
```

- [ ] **Step 2: Run it to check it fails, then write `src/programme/join.ts`**

Run: `npx vitest run src/programme/join.test.ts`
Expected: FAIL (module not found).

```ts
/**
 * The 12-week programme's own Join flow (journey §6.2 ch. 6; D35; board D81):
 * experience, place, days, and session length with a start date. Setup opens
 * it from "Join the 12-week strength programme?", Your plan and Goals from
 * "Join the 12-week programme": the same answers and the same write. It isn't
 * part of setup's page count (L-01).
 */
import { format, parseISO } from 'date-fns';
import type { AppData } from '@/types';
import type { UserProfile } from '@/types/profile';
import type { JoinAnswers } from '@/types/setup';
import { WEEK } from '@/engine/templates';
import { isDay } from '@/health/observation';
import { createDefaultProfile } from '@/profile/defaults';

export const JOIN_STEPS = ['experience', 'place', 'days', 'length'] as const;
export type JoinStep = (typeof JOIN_STEPS)[number];

/** Any real day from today on. */
export function startDateProblem(date: string, today: string): string | null {
  if (!isDay(date)) return 'Choose a start date.';
  return date < today ? 'Choose today or a later day.' : null;
}

export function joinProblem(step: JoinStep, j: JoinAnswers, today: string): string | null {
  if (step === 'days') return j.days.length === 0 ? 'Choose at least one day.' : null;
  if (step === 'length') return startDateProblem(j.startDate, today);
  return null;
}

/** The first answers: what the profile already says, as labelled usual choices (§6.1), starting today. */
export function joinInitial(profile: UserProfile | undefined, today: string): JoinAnswers {
  const p = profile ?? createDefaultProfile();
  return { experience: p.experience, equipment: p.equipment, days: [...p.trainingDays], minutes: p.sessionMinutes, startDate: today };
}

/** The record after joining: the programme's answers on the profile, and its start date. Nothing else changes (D35, scan D-03). */
export function withJoinAnswers(data: AppData, j: JoinAnswers): AppData {
  const profile = data.profile ?? createDefaultProfile({ weightKg: data.settings.currentWeight || 0, needsHealthReview: true });
  return {
    ...data,
    profile: { ...profile, experience: j.experience, equipment: j.equipment, trainingDays: WEEK.filter(d => j.days.includes(d)), sessionMinutes: j.minutes },
    settings: { ...data.settings, startDate: j.startDate },
  };
}

/** "3 days a week, 45 minutes, from Monday 12 October". */
export function joinLine(j: JoinAnswers): string {
  const days = j.days.length === 1 ? '1 day a week' : `${j.days.length} days a week`;
  return `${days}, ${j.minutes} minutes, from ${format(parseISO(j.startDate), 'EEEE d MMMM')}`;
}
```

In `src/screens/move/plan.ts`, delete its own `startDateProblem` and add `export { startDateProblem } from '@/programme/join';`, so its callers and `plan.test.ts` keep working.

- [ ] **Step 3: Run it to check it passes**

Run: `npx vitest run src/programme src/screens/move/plan.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the failing crosswalk test** `src/setup/setup.fields.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { HealthProfile, PainProfile } from '@/types/profile';
import type { SetupAnswers } from '@/types/setup';
import { bpMedicinesAsked, deriveHealth } from '@/engine/health';
import { createDefaultProfile } from '@/profile/defaults';
import { profileFrom } from './assemble';
import { HEALTH_SOURCES, PAIN_SOURCES, fieldsOfChapter } from './fields';
import {
  COMPLEX, EVERYTHING, FOOT_WOUND, GLIFLOZIN_NO_DIABETES, INSULIN_NO_DIABETES, MINIMAL, NO_CLASSES, NO_CONDITIONS, UNSURE, withC, withMeds,
} from './fixtures';
import { PAGES, missingPages, pathFor } from './graph';

const TODAY = '2026-10-10';
const CTX = { thisYear: 2026 };
type Probe = { answers: SetupAnswers; vary: SetupAnswers };

const T2 = { diabetesType: 'type2' } as const;
const ON_INSULIN = withC({ diabetes: 'yes' }, { ...T2, regular: 'yes', classes: { ...NO_CLASSES, insulin: 'yes' }, insulinHow: 'basalOnly' });
const FEET = withC({ feet: 'yes' }, { feetNumb: 'no', footWound: 'no', footRestriction: 'no' });
const BP_TARGETS = withC({ bp: 'yes' }, { bpMedicine: 'yes', targets: 'yes' });

/**
 * For each engine field (journey §6.3 as corrected, D76): answers that put its
 * question on the path, and a change of answer that must change the field.
 * A `Record` over `HealthProfile`'s own keys, so a field added to the profile
 * without a question fails the build (A-07, K-05).
 */
const HEALTH_PROBES: Record<keyof HealthProfile, Probe> = {
  diabetes: { answers: withC({ diabetes: 'yes' }, T2), vary: { diabetesType: 'type1' } },
  insulin: { answers: ON_INSULIN, vary: { insulinHow: 'closedLoop' } },
  insulinRegimen: { answers: ON_INSULIN, vary: { insulinHow: 'multipleDaily' } },
  sulfonylureaOrMeglitinide: { answers: withMeds({}), vary: { classes: { ...NO_CLASSES, lowsTablet: 'yes' } } },
  sglt2i: { answers: withMeds({}), vary: { classes: { ...NO_CLASSES, gliflozin: 'unsure' } } },
  metformin: { answers: withMeds({}), vary: { classes: { ...NO_CLASSES, metformin: 'yes' } } },
  metforminSince: { answers: withMeds({ metformin: 'yes' }), vary: { metforminSince: '2019' } },
  priorDkaOrInsulinDeficiency: { answers: withC({ diabetes: 'yes' }, { ...T2, priorDka: 'no' }), vary: { priorDka: 'yes' } },
  medicinesReviewed: { answers: withMeds({}), vary: { classes: undefined } },
  highHypoRisk: { answers: withC({ diabetes: 'yes' }, { ...T2, regular: 'yes', classes: { ...NO_CLASSES, lowsTablet: 'yes' }, lowsRisk: 'no' }), vary: { lowsRisk: 'unsure' } },
  hypertension: { answers: withC({ bp: 'yes' }, { bpMedicine: 'yes' }), vary: { bpMedicine: 'no' } },
  betaBlocker: { answers: withMeds({}), vary: { classes: { ...NO_CLASSES, betaBlocker: 'unsure' } } },
  diuretic: { answers: withMeds({}), vary: { classes: { ...NO_CLASSES, diuretic: 'yes' } } },
  bpMedicinesReviewed: { answers: withC({ bp: 'yes' }, { bpMedicine: 'yes', regular: 'yes', classes: { ...NO_CLASSES }, dizzy: 'no' }), vary: { classes: undefined } },
  heartOrVascularDisease: { answers: MINIMAL, vary: { conditions: { ...NO_CONDITIONS, heart: 'unsure' } } },
  kidneyDisease: { answers: withC({ kidney: 'yes' }, { kidneyTreatment: 'no', fluidLimit: 'no' }), vary: { kidneyTreatment: 'yes' } },
  fluidRestriction: { answers: withC({ heart: 'yes' }, { fluidLimit: 'no' }), vary: { fluidLimit: 'unsure' } },
  retinopathy: { answers: withC({ eyes: 'yes' }, { eyeTreatment: 'no', eyeDisease: 'mild' }), vary: { eyeTreatment: 'yes' } },
  peripheralNeuropathy: { answers: FEET, vary: { feetNumb: 'unsure' } },
  footStatus: { answers: FEET, vary: { footRestriction: 'yes' } },
  dizzyOnStandingOrAutonomicNeuropathy: { answers: withC({ bp: 'yes' }, { bpMedicine: 'yes', dizzy: 'no' }), vary: { dizzy: 'yes' } },
  glucoseMonitor: { answers: MINIMAL, vary: { glucoseMonitor: 'cgm', glucoseUnit: 'mmol/L' } },
  glucoseUnit: { answers: { ...MINIMAL, glucoseMonitor: 'meter', glucoseUnit: 'mg/dL' }, vary: { glucoseUnit: 'mmol/L' } },
  ketoneTest: { answers: GLIFLOZIN_NO_DIABETES, vary: { ketoneTest: 'blood' } },
  bpMonitor: { answers: MINIMAL, vary: { bpCuff: true } },
  currentlyActive: { answers: MINIMAL, vary: { active: 'no' } },
  clearance: { answers: withC({ heart: 'yes' }, { fluidLimit: 'no', clearance: 'none' }), vary: { clearance: 'vigorous' } },
  clinicianTargets: { answers: BP_TARGETS, vary: { bpStopSystolic: 170 } },
  bpExercisePermission: { answers: BP_TARGETS, vary: { bpPermission: { sys: 170, dia: 105 } } },
};

const PAIN_PROBES: Record<Exclude<keyof PainProfile, 'preference'>, Probe> = {
  areas: { answers: withC({ pain: 'yes' }, { painAreas: ['knee'], neuroHistory: 'no' }), vary: { painAreas: ['calf'] } },
  sciaticaSide: { answers: withC({ pain: 'yes' }, { painAreas: ['sciatica'], sciaticaSide: 'left', worseWith: 'flexion', neuroHistory: 'no' }), vary: { sciaticaSide: 'both' } },
  worseWith: { answers: withC({ pain: 'yes' }, { painAreas: ['lowerBack'], worseWith: 'flexion', neuroHistory: 'no' }), vary: { worseWith: 'extension' } },
  neuroHistory: { answers: withC({ pain: 'yes' }, { painAreas: ['knee'], neuroHistory: 'no' }), vary: { neuroHistory: 'unsure' } },
};

function probe(read: (a: SetupAnswers) => unknown, sources: readonly (keyof SetupAnswers)[], { answers, vary }: Probe) {
  const after = { ...answers, ...vary };
  const varied = Object.keys(vary) as (keyof SetupAnswers)[];
  expect(varied.every(k => sources.includes(k)), `${varied.join(', ')} not among its sources ${sources.join(', ')}`).toBe(true);
  const asking = PAGES.filter(p => p.sets.some(k => varied.includes(k))).map(p => p.id);
  expect(asking.some(id => pathFor(after).includes(id)), `none of ${asking.join(', ')} is on the path`).toBe(true);
  expect(read(after)).not.toEqual(read(answers));
}

describe('every engine field is set by a question on the path (journey §6.3; A-07; K-05)', () => {
  for (const [field, p] of Object.entries(HEALTH_PROBES) as [keyof HealthProfile, Probe][]) {
    it(`health.${field}`, () => probe(a => profileFrom(a, undefined, TODAY, CTX).health[field], HEALTH_SOURCES[field], p));
  }
  for (const [field, p] of Object.entries(PAIN_PROBES) as [Exclude<keyof PainProfile, 'preference'>, Probe][]) {
    it(`pain.${field}`, () => probe(a => profileFrom(a, undefined, TODAY, CTX).pain[field], PAIN_SOURCES[field] as readonly (keyof SetupAnswers)[], p));
  }

  it('every source answer is set by some page', () => {
    for (const sources of [...Object.values(HEALTH_SOURCES), ...Object.values(PAIN_SOURCES)]) {
      if (sources === 'learned') continue;
      for (const k of sources) expect(PAGES.some(p => p.sets.includes(k)), k).toBe(true);
    }
  });

  it('never sets pain.preference, the direction the engine reads as confirmed (D77)', () => {
    expect(PAIN_SOURCES.preference).toBe('learned');
    const base = createDefaultProfile({ pain: { areas: ['lowerBack'], worseWith: 'flexion', preference: 'extension' } });
    expect(profileFrom({ ...COMPLEX, helps: ['archingBack'] }, base, TODAY, CTX).pain.preference).toBe('extension');
  });

  it('gives each chapter its own fields to own', () => {
    expect(fieldsOfChapter('medicines')).toEqual(expect.arrayContaining(['profile.health.sglt2i', 'profile.health.insulin', 'profile.health.diabetes']));
    expect(fieldsOfChapter('about')).toEqual(expect.arrayContaining(['profile.weightKg', 'settings.useMetric']));
    expect(fieldsOfChapter('backFeet')).toEqual(expect.arrayContaining(['profile.pain.areas', 'profile.health.footStatus']));
  });
});

describe('each question is asked whenever the engine reads its field (B-06 conditional paths)', () => {
  const PERSONAS: Record<string, SetupAnswers> = {
    MINIMAL, COMPLEX, EVERYTHING, FOOT_WOUND, GLIFLOZIN_NO_DIABETES, INSULIN_NO_DIABETES, UNSURE,
    kidney: withC({ kidney: 'unsure' }, { kidneyTreatment: 'no', fluidLimit: 'unsure', clearance: 'none' }),
    heart: withC({ heart: 'yes' }, { fluidLimit: 'no', clearance: 'none', dizzy: 'no' }),
    prediabetes: withC({ diabetes: 'yes' }, { diabetesType: 'prediabetes' }),
    type1: withC({ diabetes: 'yes' }, { diabetesType: 'type1', insulinHow: 'pump', lowsRisk: 'no', priorDka: 'no', ketoneTest: 'blood', clearance: 'none', targets: 'no', dizzy: 'no' }),
  };
  for (const [name, a] of Object.entries(PERSONAS)) {
    it(name, () => {
      const h = profileFrom(a, undefined, TODAY, CTX).health;
      const d = deriveHealth(h);
      const path = pathFor(a);
      expect(missingPages(a, CTX)).toEqual([]);
      if (d.ketoneRisk || d.diabetic) expect(path).toContain('medicines.ketones');
      if (d.hypoRisk) expect(path).toContain('medicines.lows');
      if (bpMedicinesAsked(h)) expect(path.includes('medicines.which') || a.regular === 'no').toBe(true);
      if (d.diabetic || h.heartOrVascularDisease || h.kidneyDisease !== 'none' || h.hypertension !== 'none') expect(path).toContain('health.limits');
      if (d.onBpMeds || h.heartOrVascularDisease || d.diabetic) expect(path).toContain('medicines.standing');
      if (h.kidneyDisease !== 'none' || h.heartOrVascularDisease) expect(path).toContain('health.fluid');
    });
  }
});
```

The `prediabetes` persona doesn't need `health.limits`: prediabetes isn't diabetes, and no other chip is on. So its path is the minimal one plus `health.diabetes`, and `missingPages` is empty because `diabetesType` is answered.

- [ ] **Step 5: Write the failing assembly test** `src/setup/assemble.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
import { PERMISSION_TEXT, permission } from '@/engine/permission';
import { deriveHealth, glucoseStartMin, profileGaps, profileRules, sglt2Unknown } from '@/engine/health';
import { createDefaultProfile } from '@/profile/defaults';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import { weeklyGoalOn } from '@/screens/track/weeklyGoal';
import { completedSetup, foodFrom, habitsFrom, lookedAround, measurementsFrom, profileFrom } from './assemble';
import { COMPLEX, FOOT_WOUND, GLIFLOZIN_NO_DIABETES, INSULIN_NO_DIABETES, JOIN, MINIMAL, NO_CLASSES, NO_CONDITIONS, UNSURE, withC } from './fixtures';

const TODAY = '2026-10-10';
const NOW = '2026-10-10T09:00:00.000+05:30';
const CTX = { thisYear: 2026 };
const fresh = (): AppData => migrateData({ version: CURRENT_VERSION } as AppData);

describe('"Not sure" is "may have", through the engine itself (journey §6.1)', () => {
  const p = profileFrom(UNSURE, undefined, TODAY, CTX);

  it('stores the conservative value for every "Not sure"', () => {
    expect(p.health).toMatchObject({
      diabetes: 'other', insulin: 'unsure', sulfonylureaOrMeglitinide: 'unsure', sglt2i: 'unsure', metformin: 'unsure',
      betaBlocker: 'unsure', diuretic: 'unsure', priorDkaOrInsulinDeficiency: 'unsure', hypertension: 'unsure',
      heartOrVascularDisease: true, fluidRestriction: 'unsure', highHypoRisk: true, dizzyOnStandingOrAutonomicNeuropathy: true, clearance: 'none',
    });
  });

  it('and the engine reads it as "may have"', () => {
    const d = deriveHealth(p.health);
    expect(d).toMatchObject({ diabetic: true, hypoRisk: true, ketoneRisk: true, onBpMeds: true });
    expect(profileRules(p).vigorousLocked).toBe(true);
    expect(glucoseStartMin(p.health)).toBe(145);
  });

  it('leaves no profile gap: every safety question was answered (Not sure is an answer)', () => {
    expect(profileGaps(p)).toMatchObject({ healthUnreviewed: false, medicinesUnknown: false });
    const walk = permission({ profile: p, now: new Date(NOW) }, 'walk');
    expect(walk.reasons).toContain(PERMISSION_TEXT.noCheckIn);
    expect(walk.reasons).not.toContain(PERMISSION_TEXT.healthUnreviewed);
  });
});

describe('medicines whatever the diagnosis (A-06, K-05)', () => {
  it('insulin with diabetes "No" is diabetes that can go low (Review Focus 3, D78)', () => {
    const p = profileFrom(INSULIN_NO_DIABETES, undefined, TODAY, CTX);
    expect(p.health.diabetes).toBe('other');
    expect(deriveHealth(p.health).hypoRisk).toBe(true);
    expect(glucoseStartMin(p.health)).toBe(90);
    expect(profileGaps(p).medicinesUnknown).toBe(false);
  });

  it('a "-gliflozin" without diabetes is a ketone risk, answered and reviewed', () => {
    const p = profileFrom(GLIFLOZIN_NO_DIABETES, undefined, TODAY, CTX);
    expect(p.health).toMatchObject({ diabetes: 'none', sglt2i: true, medicinesReviewed: true, ketoneTest: 'none' });
    expect(deriveHealth(p.health).ketoneRisk).toBe(true);
    expect(sglt2Unknown(p.health)).toBe(false);
  });

  it('"No regular medicines" answers every class No, and counts as reviewed', () => {
    const p = profileFrom(MINIMAL, undefined, TODAY, CTX);
    expect(p.health).toMatchObject({ insulin: 'none', sulfonylureaOrMeglitinide: false, sglt2i: false, metformin: false, betaBlocker: false, diuretic: false, medicinesReviewed: true });
    expect(sglt2Unknown(p.health)).toBe(false);
  });

  it('asks the diabetes medicines again when diabetes is added later; an old review never vouches for them (Review Focus 1)', () => {
    const before = profileFrom(GLIFLOZIN_NO_DIABETES, undefined, TODAY, CTX);
    const edited = profileFrom({ ...GLIFLOZIN_NO_DIABETES, conditions: { ...NO_CONDITIONS, diabetes: 'yes' }, diabetesType: 'type2' }, before, TODAY, CTX, ['health']);
    expect(edited.health.medicinesReviewed).toBe(false);
    expect(profileGaps(edited).medicinesUnknown).toBe(true);
  });

  it('vouches for the blood-pressure medicines only when both were answered', () => {
    const bp = withC({ bp: 'yes' }, { bpMedicine: 'yes', regular: 'yes', dizzy: 'no' });
    expect(profileFrom({ ...bp, classes: { ...NO_CLASSES } }, undefined, TODAY, CTX).health.bpMedicinesReviewed).toBe(true);
    expect(profileFrom({ ...bp, classes: { metformin: 'yes' } }, undefined, TODAY, CTX).health.bpMedicinesReviewed).toBeUndefined();
  });
});

describe('gaps stay gaps (journey §6.1)', () => {
  it('a new profile from unfinished safety chapters is held, never read as "No"', () => {
    const p = profileFrom({ conditions: { ...NO_CONDITIONS } }, undefined, TODAY, CTX);
    expect(p.needsHealthReview).toBe(true);
    expect(profileGaps(p).healthUnreviewed).toBe(true);
  });

  it('a chapter not edited keeps what it had', () => {
    const p = profileFrom(COMPLEX, undefined, TODAY, CTX);
    const renamed = profileFrom({ ...COMPLEX, name: 'Asha K' }, p, TODAY, CTX, ['about']);
    expect(renamed.name).toBe('Asha K');
    expect(renamed.health).toEqual(p.health);
    expect(renamed.pain).toEqual(p.pain);
    expect(renamed.food).toEqual(p.food);
  });
});

describe('back, feet and food', () => {
  it('back pain and sciatica set the areas and the leg; no pain clears them', () => {
    const p = profileFrom(COMPLEX, undefined, TODAY, CTX);
    expect(p.pain).toMatchObject({ areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion', neuroHistory: false });
    const none = profileFrom({ ...COMPLEX, conditions: { ...COMPLEX.conditions, pain: 'no' } }, p, TODAY, CTX);
    expect(none.pain).toEqual({ areas: [], worseWith: 'unknown', preference: p.pain.preference });
  });

  it('a wound now, or a clinician’s limit, holds walking (K-30)', () => {
    expect(profileFrom(FOOT_WOUND, undefined, TODAY, CTX).health.footStatus).toBe('current_wound_or_active_charcot');
    const limit = profileFrom({ ...FOOT_WOUND, footWound: 'no', footRestriction: 'yes' }, undefined, TODAY, CTX);
    expect(limit.health.footStatus).toBe('current_wound_or_active_charcot');
  });

  it('stores the pattern, the allergies as given and the logging level, and keeps the foods left out (board D82)', () => {
    expect(foodFrom({ pattern: 'jain', allergies: ['peanut', 'brinjal'], foodLevel: 'meals' }, { pattern: 'vegetarian', avoid: ['bhindi'], region: 'north' }))
      .toEqual({ pattern: 'jain', avoid: ['bhindi'], region: 'north', allergies: ['peanut', 'brinjal'], level: 'meals' });
    expect(foodFrom({ pattern: 'vegan', allergies: [] }, undefined)).toEqual({ pattern: 'vegan', avoid: [] });
    expect(foodFrom({}, undefined)).toBeUndefined();
  });

  it('turns water on only with a fluid limit answered "No" and no condition needing one', () => {
    const ok = profileFrom(COMPLEX, undefined, TODAY, CTX);
    expect(habitsFrom(COMPLEX, undefined, ok).water?.enabled).toBe(true);
    const kidneyAnswers = { ...COMPLEX, conditions: { ...COMPLEX.conditions, kidney: 'yes' as const }, kidneyTreatment: 'no' as const };
    expect(habitsFrom(kidneyAnswers, undefined, profileFrom(kidneyAnswers, undefined, TODAY, CTX)).water?.enabled).toBe(false);
    const held = profileFrom({ ...FOOT_WOUND, mealWalk: { on: true, meals: ['lunch'] } }, undefined, TODAY, CTX);
    expect(habitsFrom({ ...FOOT_WOUND, mealWalk: { on: true, meals: ['lunch'] } }, undefined, held).mealWalk?.enabled).toBe(false);
  });
});

describe('weight, height and waist are dated readings (journey §18.1; B-16; Review Focus 2)', () => {
  it('records a changed value, and never an unchanged or undated one', () => {
    expect(measurementsFrom(COMPLEX, undefined, NOW).map(o => [o.kind, o.value, o.unit, o.context])).toEqual([
      ['weight', 68, 'kg', 'profile'], ['height', 158, 'cm', 'profile'],
    ]);
    expect(measurementsFrom(COMPLEX, createDefaultProfile({ weightKg: 68, heightCm: 158 }), NOW)).toEqual([]);
    expect(measurementsFrom({ weightKg: 70 }, createDefaultProfile({ weightKg: 0 }), NOW)).toHaveLength(1);
    expect(measurementsFrom({}, createDefaultProfile({ weightKg: 78 }), NOW)).toEqual([]);
  });
});

describe('finishing, and looking around first', () => {
  it('finishing stores the profile, the answers, completion and Home’s first tiles in one record', () => {
    const done = completedSetup(fresh(), COMPLEX, NOW, { ...CTX, hasSteps: false });
    expect(done.settings).toMatchObject({ onboardingComplete: true, focus: 'stretch', weeklyMovementGoalMinutes: 90, useMetric: true });
    expect(weeklyGoalOn(done.settings, TODAY)).toBe(90);
    expect(done.settings.setup).toEqual({ stage: 'done', answers: COMPLEX, completedAt: NOW, skipped: [] });
    expect(done.settings.home?.order.check).toEqual(expect.arrayContaining(['glucose', 'bp', 'back']));
    expect(done.profile?.needsHealthReview).toBe(false);
    expect(done.settings.startDate).toBe('');
  });

  it('joins the programme when setup said Yes, and remembers it as joined', () => {
    const done = completedSetup(fresh(), { ...COMPLEX, programme: 'join', join: JOIN }, NOW, { ...CTX, hasSteps: false });
    expect(done.settings.startDate).toBe(JOIN.startDate);
    expect(done.profile?.trainingDays).toEqual(JOIN.days);
    expect(done.settings.setup?.answers?.programme).toBe('joined');
  });

  it('"No goal for now" ends a goal from next Monday (B-16); a skipped chapter waits in Me', () => {
    const before = fresh();
    before.settings = { ...before.settings, weeklyMovementGoalMinutes: 150 };
    const done = completedSetup(before, { ...MINIMAL, foodLevel: undefined, skippedPages: ['food.logging'] }, NOW, { ...CTX, hasSteps: false });
    expect(done.settings.weeklyMovementGoalMinutes).toBeUndefined();
    expect(weeklyGoalOn(done.settings, TODAY)).toBe(150);
    expect(weeklyGoalOn(done.settings, '2026-10-12')).toBeUndefined();
    expect(done.settings.setup?.skipped).toEqual(['food']);
  });

  it('keeps what Me was told “Not now”, and the upgrade flags', () => {
    const before = fresh();
    before.settings = { ...before.settings, setup: { declined: ['food'] } };
    expect(completedSetup(before, MINIMAL, NOW, { ...CTX, hasSteps: false }).settings.setup?.declined).toEqual(['food']);
  });

  it('Back & leg for "Not sure" about pain (journey §5.1)', () => {
    const unsurePain = withC({ pain: 'unsure' }, { painAreas: [], neuroHistory: 'no', clearance: 'none' });
    expect(completedSetup(fresh(), unsurePain, NOW, { ...CTX, hasSteps: false }).settings.home?.order.check).toContain('back');
  });

  it('looking around keeps the draft, writes no profile, and opens Home (§6.4)', () => {
    const data = fresh();
    data.settings = { ...data.settings, setup: { stage: 'open', skipped: [], draft: { at: 'about.figure', answers: { name: 'Asha' } } } };
    const after = lookedAround(data);
    expect(after.settings.onboardingComplete).toBe(true);
    expect(after.settings.setup).toEqual({ stage: 'lookAround', skipped: [], draft: { at: 'about.figure', answers: { name: 'Asha' } } });
    expect(after.profile).toBeUndefined();
  });
});
```

- [ ] **Step 6: Run them to check they fail**

Run: `npx vitest run src/setup/setup.fields.test.ts src/setup/assemble.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 7: Write `src/setup/assemble.ts`**

```ts
/**
 * From setup's answers to the record the engine reads (journey §6.3, as
 * corrected on the board, D76). The one place "Not sure" becomes "may have"
 * (§6.1). A field is set only from an answer that was given: with no answer
 * it keeps what it had, so a chapter not asked, or a v1 answer v2 hasn't
 * asked again, never turns into a "No".
 */
import type { AppData, UserSettings } from '@/types';
import type { HabitSettings } from '@/types/habits';
import type { FoodPreferences, HealthProfile, MedicineAnswer, PainProfile, UserProfile } from '@/types/profile';
import { CHAPTER_IDS, type ChapterId, type MedicineClass, type SetupAnswers, type SetupState, type Tri } from '@/types/setup';
import type { ObservationInput } from '@/health/observation';
import { bpMedicinesAsked, deriveHealth } from '@/engine/health';
import { startingLadder } from '@/engine/progression';
import { ladderAfterEdit } from '@/components/profile/wizardSteps';
import { createDefaultProfile } from '@/profile/defaults';
import { conditionBlock } from '@/reminders/water';
import { defaultHome, isHomeLayout } from '@/categories';
import { withJoinAnswers } from '@/programme/join';
import { withWeeklyGoal } from '@/screens/track/weeklyGoal';
import { diabetesOf, factsOf, has } from './facts';
import { SAFETY_CHAPTERS, chapterComplete, skippedChapters, type Ctx } from './graph';
import { setupStateOf } from './state';

const med = (t: Tri | undefined): MedicineAnswer => (t === 'yes' ? true : t === 'unsure' ? 'unsure' : false);

/** Sets an optional field, or removes it for `undefined`, so a stored record never holds an `undefined` key. */
export function put<T extends object, K extends keyof T>(target: T, key: K, value: T[K] | undefined): void {
  if (value === undefined) delete (target as Record<PropertyKey, unknown>)[key as PropertyKey];
  else target[key] = value;
}

/** The object without its `undefined` values, or `undefined` when nothing is left. */
export function compact<T extends object>(o: T): T | undefined {
  const kept = Object.entries(o).filter(([, v]) => v !== undefined);
  return kept.length > 0 ? (Object.fromEntries(kept) as T) : undefined;
}

const EYES: Record<NonNullable<SetupAnswers['eyeDisease']>, HealthProfile['retinopathy']> = {
  mild: 'none_or_mild', moderate: 'moderate', severe: 'severe_or_proliferative', unsure: 'unknown',
};
const CLASS_FIELD = {
  lowsTablet: 'sulfonylureaOrMeglitinide', gliflozin: 'sglt2i', metformin: 'metformin', betaBlocker: 'betaBlocker', diuretic: 'diuretic',
} as const satisfies Partial<Record<MedicineClass, keyof HealthProfile>>;
const DIABETES_CLASSES = ['insulin', 'lowsTablet', 'gliflozin', 'metformin'] as const;

export function healthFrom(a: SetupAnswers, base: HealthProfile, today: string): HealthProfile {
  const f = factsOf(a);
  const c = a.conditions ?? {};
  const next: HealthProfile = { ...base };

  // Chapter 3: each chip and its follow-ups.
  const diabetes = diabetesOf(a);
  if (diabetes !== undefined) next.diabetes = diabetes;
  if (c.bp !== undefined) {
    next.hypertension = !has(c.bp) ? 'none' : a.bpMedicine === 'yes' ? 'treated' : a.bpMedicine === 'no' && c.bp === 'yes' ? 'untreated' : 'unsure';
  }
  if (c.heart !== undefined) next.heartOrVascularDisease = has(c.heart);
  if (c.kidney !== undefined) {
    next.kidneyDisease = !has(c.kidney) ? 'none' : a.kidneyTreatment === 'yes' ? 'dialysis_or_transplant' : c.kidney === 'unsure' ? 'unsure' : 'ckd';
  }
  if (a.fluidLimit !== undefined) next.fluidRestriction = med(a.fluidLimit);
  if (c.eyes !== undefined) {
    next.retinopathy = !has(c.eyes) ? 'none_or_mild' : a.eyeTreatment === 'yes' ? 'recent_eye_treatment' : EYES[a.eyeDisease ?? 'unsure'];
  }
  if (c.feet !== undefined) {
    next.peripheralNeuropathy = !has(c.feet) || a.feetNumb === 'no' ? 'no' : a.feetNumb === 'yes' ? 'yes' : 'unsure';
    next.footStatus = !has(c.feet) ? 'healthy'
      : a.footWound === 'now' || a.footRestriction === 'yes' ? 'current_wound_or_active_charcot'
      : a.footWound === 'past' ? 'past_ulcer_or_charcot' : 'healthy';
  }
  if (a.clearance !== undefined) next.clearance = a.clearance === 'moderate' || a.clearance === 'vigorous' ? a.clearance : 'none';
  if (a.targets !== undefined || a.glucoseStartMin !== undefined) {
    const targets = a.targets === 'yes';
    put(next, 'clinicianTargets', compact({
      glucoseStartMin: f.hypoRisk ? a.glucoseStartMin : undefined,
      glucoseStartUnit: f.hypoRisk && a.glucoseStartMin !== undefined ? a.glucoseStartUnit ?? a.glucoseUnit ?? 'mg/dL' : undefined,
      bpStopSystolic: targets && f.bp ? a.bpStopSystolic : undefined,
      hba1cPercent: targets && f.diabetic ? a.hba1cPercent : undefined,
    }));
    const permission = targets && f.bp ? a.bpPermission : undefined;
    const was = base.bpExercisePermission;
    const keptOn = permission && was && was.sys === permission.sys && was.dia === permission.dia ? was.recordedOn : undefined;
    put(next, 'bpExercisePermission', permission ? { ...permission, recordedOn: keptOn ?? today } : undefined);
  }

  // Chapter 4: medicines, whatever the diagnosis (A-06, K-05). "No regular medicines" answers each class No.
  if (a.regular !== undefined) {
    for (const [cls, field] of Object.entries(CLASS_FIELD) as [keyof typeof CLASS_FIELD, (typeof CLASS_FIELD)[keyof typeof CLASS_FIELD]][]) {
      const answer = a.regular === 'no' ? 'no' : a.classes?.[cls];
      if (answer !== undefined) next[field] = med(answer);
    }
    put(next, 'metforminSince', next.metformin === true ? a.metforminSince ?? base.metforminSince : undefined);
  }
  const insulinAnswer = a.regular === 'no' ? 'no' : a.classes?.insulin;
  if (insulinAnswer !== undefined || diabetes === 'type1') {
    const takesInsulin = has(insulinAnswer) || diabetes === 'type1';
    next.insulin = !takesInsulin ? 'none'
      : insulinAnswer === 'unsure' || a.insulinHow === undefined || a.insulinHow === 'unsure' ? 'unsure'
      : a.insulinHow === 'closedLoop' ? 'automated_delivery' : 'injections_or_pump';
    put(next, 'insulinRegimen', next.insulin === 'automated_delivery' ? 'pump'
      : next.insulin === 'injections_or_pump' && a.insulinHow !== undefined && a.insulinHow !== 'unsure' && a.insulinHow !== 'closedLoop' ? a.insulinHow
      : undefined);
  }
  if (a.lowsRisk !== undefined) next.highHypoRisk = has(a.lowsRisk);
  if (a.priorDka !== undefined) next.priorDkaOrInsulinDeficiency = med(a.priorDka);
  if (a.ketoneTest !== undefined) next.ketoneTest = a.ketoneTest;
  if (a.dizzy !== undefined) next.dizzyOnStandingOrAutonomicNeuropathy = has(a.dizzy);
  if (a.glucoseMonitor !== undefined) next.glucoseMonitor = a.glucoseMonitor;
  if (a.glucoseUnit !== undefined) next.glucoseUnit = a.glucoseUnit;
  if (a.bpCuff !== undefined) next.bpMonitor = a.bpCuff;

  // Chapter 6.
  if (a.active !== undefined) next.currentlyActive = a.active === 'yes';
  return next;
}

/**
 * Which reviews the answers earn. `medicinesReviewed` vouches for the diabetes
 * medicines, or without diabetes the "-gliflozin" alone; `bpMedicinesReviewed`
 * for the beta-blocker and the water tablet (`wizardSteps.answeredOnOpen`).
 * Each is earned only when every medicine it vouches for was answered.
 */
function reviewsOf(a: SetupAnswers, h: HealthProfile): { medicines: boolean; bp: boolean } {
  const given = (k: MedicineClass) => a.regular === 'no' || a.classes?.[k] !== undefined;
  return {
    medicines: deriveHealth(h).diabetic ? DIABETES_CLASSES.every(given) && a.priorDka !== undefined : given('gliflozin'),
    bp: given('betaBlocker') && given('diuretic'),
  };
}

export function painFrom(a: SetupAnswers, base: PainProfile): PainProfile {
  const chip = a.conditions?.pain;
  if (chip === undefined) return base;
  const next: PainProfile = { ...base };
  if (chip === 'no') {
    next.areas = [];
    next.worseWith = 'unknown';
    put(next, 'sciaticaSide', undefined);
    put(next, 'neuroHistory', undefined);
    return next;
  }
  if (a.painAreas !== undefined) next.areas = [...a.painAreas];
  const back = next.areas.includes('lowerBack') || next.areas.includes('sciatica');
  put(next, 'sciaticaSide', next.areas.includes('sciatica') ? a.sciaticaSide ?? base.sciaticaSide : undefined);
  next.worseWith = back ? a.worseWith ?? base.worseWith : 'unknown';
  if (a.neuroHistory !== undefined) next.neuroHistory = med(a.neuroHistory);
  return next;
}

/** Plan 7's food preferences, as chapter 7 answered them (board D82). What it didn't ask stays. */
export function foodFrom(a: SetupAnswers, base: FoodPreferences | undefined): FoodPreferences | undefined {
  if (a.pattern === undefined) return base;
  const next: FoodPreferences = { ...base, pattern: a.pattern, avoid: base?.avoid ?? [] };
  if (a.allergies !== undefined) put(next, 'allergies', a.allergies.length > 0 ? [...a.allergies] : undefined);
  if (a.foodLevel !== undefined) next.level = a.foodLevel;
  return next;
}

/**
 * The profile the answers give, on top of `base` (the stored profile, if
 * any). Only the fields `chapters` own are worked out again (Me edits a
 * chapter at a time). A new profile from unfinished safety chapters stays
 * held (`needsHealthReview`).
 */
export function profileFrom(a: SetupAnswers, base: UserProfile | undefined, today: string, ctx: Ctx, chapters: readonly ChapterId[] = CHAPTER_IDS): UserProfile {
  const start = base ?? createDefaultProfile({ needsHealthReview: true });
  const on = (c: ChapterId) => chapters.includes(c);
  const next: UserProfile = structuredClone(start);

  if (on('about')) {
    if ('name' in a) put(next, 'name', a.name?.trim() || undefined);
    if ('birthYear' in a) put(next, 'birthYear', a.birthYear);
    if (a.figure !== undefined) put(next, 'figure', a.figure === 'either' ? undefined : a.figure);
    if ('heightCm' in a) put(next, 'heightCm', a.heightCm);
    if ('weightKg' in a) next.weightKg = a.weightKg ?? 0;
    if ('waistCm' in a) put(next, 'waistCm', a.waistCm);
  }
  if (on('health') || on('medicines') || on('backFeet') || on('movement')) {
    next.health = healthFrom(a, start.health, today);
    const reviews = on('medicines') && chapterComplete('medicines', a, ctx) ? reviewsOf(a, next.health) : { medicines: false, bp: false };
    if (reviews.medicines) next.health.medicinesReviewed = true;
    // A review vouches for the medicines asked then: diabetes added since needs them answered again (Review Focus 1).
    else if (deriveHealth(next.health).diabetic && !deriveHealth(start.health).diabetic) next.health.medicinesReviewed = false;
    if (reviews.bp && bpMedicinesAsked(next.health)) next.health.bpMedicinesReviewed = true;
    else if (bpMedicinesAsked(next.health) && !bpMedicinesAsked(start.health)) put(next.health, 'bpMedicinesReviewed', undefined);
  }
  if (on('health') || on('backFeet')) next.pain = painFrom(a, start.pain);
  if (on('food')) put(next, 'food', foodFrom(a, start.food));
  if (on('day') && a.voice) next.voice = { ...start.voice, ...a.voice };
  // Only every safety chapter, complete, in one sitting clears a review (§6.1; contract H-DATA).
  if (SAFETY_CHAPTERS.every(c => on(c) && chapterComplete(c, a, ctx))) next.needsHealthReview = false;
  next.ladder = base ? ladderAfterEdit(base, next, today) : startingLadder(next);
  return next;
}

/** The reminders chapter 8 turned on. Water needs a fluid limit answered "No" and no condition needing one (reminders/water.ts). */
export function habitsFrom(a: SetupAnswers, base: HabitSettings | undefined, profile: UserProfile): HabitSettings {
  const next: HabitSettings = { ...base };
  if (a.water) {
    const allowed = a.fluidLimit === 'no' && conditionBlock(profile) === undefined;
    next.water = { ...base?.water, enabled: a.water.on && allowed, glassMl: a.water.glassMl, everyMinutes: a.water.everyMinutes, from: a.water.from, to: a.water.to };
  }
  if (a.sitting) next.sittingBreak = { enabled: a.sitting.on, everyMinutes: a.sitting.everyMinutes, from: a.sitting.from, to: a.sitting.to };
  if (a.mealWalk) {
    const finish = a.mealFinish ?? base?.mealWalk?.finish;
    next.mealWalk = { enabled: a.mealWalk.on && !factsOf(a).footHeld, meals: [...a.mealWalk.meals], ...(finish ? { finish } : {}) };
  }
  if (a.quiet === 'none') delete next.quietHours;
  else if (a.quiet) next.quietHours = { ...a.quiet };
  if (a.delivery) next.inApp = a.delivery === 'app';
  return next;
}

/** The settings the answers set, for the chapters given. A weekly goal goes through Plan 2's dated goals (B-16). */
export function settingsFrom(a: SetupAnswers, base: UserSettings, profile: UserProfile, today: string, chapters: readonly ChapterId[] = CHAPTER_IDS): Partial<UserSettings> {
  const on = (c: ChapterId) => chapters.includes(c);
  const patch: Partial<UserSettings> = {};
  if (on('about')) {
    if (a.metric !== undefined) patch.useMetric = a.metric;
    if (a.weightKg !== undefined) patch.currentWeight = a.weightKg;
  }
  if (on('movement')) {
    if (a.focus !== undefined) patch.focus = a.focus;
    if (a.weeklyGoal !== undefined) Object.assign(patch, withWeeklyGoal(base, a.weeklyGoal === 'none' ? undefined : a.weeklyGoal, today));
  }
  if (on('day')) patch.habits = habitsFrom(a, base.habits, profile);
  return patch;
}

/** A dated reading for each body measure that changed (§18.1). A v1 weight with no date is never given one (B-16). */
export function measurementsFrom(a: SetupAnswers, before: UserProfile | undefined, at: string): ObservationInput[] {
  const changed = (value: number | undefined, was: number | undefined) => value !== undefined && Number.isFinite(value) && value > 0 && value !== was;
  const reading = (kind: 'weight' | 'height' | 'waist', value: number, unit: string): ObservationInput =>
    ({ kind, value, unit, scope: 'pointInTime', source: 'manual', at, context: 'profile' });
  return [
    ...(changed(a.weightKg, before?.weightKg || undefined) ? [reading('weight', a.weightKg!, 'kg')] : []),
    ...(changed(a.heightCm, before?.heightCm) ? [reading('height', a.heightCm!, 'cm')] : []),
    ...(changed(a.waistCm, before?.waistCm) ? [reading('waist', a.waistCm!, 'cm')] : []),
  ];
}

/** "Start using FitStrong": the profile, the settings, completion and Home's first tiles, as one record (§6.2, §5.1). */
export function completedSetup(data: AppData, a: SetupAnswers, now: string, ctx: Ctx & { hasSteps: boolean }): AppData {
  const prior = setupStateOf(data.settings, data.profile);
  const today = now.slice(0, 10);
  const profile = profileFrom(a, data.profile, today, ctx);
  const joined = a.programme === 'join' && a.join !== undefined;
  const setup: SetupState = {
    stage: 'done',
    answers: joined ? { ...a, programme: 'joined' } : a,
    completedAt: now,
    skipped: skippedChapters(a, ctx),
    ...(prior.declined ? { declined: prior.declined } : {}),
    ...(prior.upgraded ? { upgraded: true } : {}),
    ...(prior.newHomeSeen ? { newHomeSeen: true } : {}),
  };
  let next: AppData = { ...data, profile, settings: { ...data.settings, ...settingsFrom(a, data.settings, profile, today), onboardingComplete: true, setup } };
  if (joined) next = withJoinAnswers(next, a.join!);
  if (!isHomeLayout(next.settings.home)) {
    const home = defaultHome({ profile: next.profile!, settings: next.settings, hasSteps: ctx.hasSteps, backUnsure: a.conditions?.pain === 'unsure' });
    next = { ...next, settings: { ...next.settings, home } };
  }
  return next;
}

/** "Look around first" (§6.4): Home now, with every movement held; the answers so far wait in the draft. */
export function lookedAround(data: AppData): AppData {
  const prior = setupStateOf(data.settings, data.profile);
  return { ...data, settings: { ...data.settings, onboardingComplete: true, setup: { ...prior, stage: 'lookAround' } } };
}
```

The test `'finishing stores the profile, the answers, completion …'` expects `setup` to equal `{ stage: 'done', answers: COMPLEX, completedAt: NOW, skipped: [] }`. That holds because a fresh record has no `declined`, `upgraded` or `newHomeSeen`.

- [ ] **Step 8: Write `src/setup/fields.ts`**

```ts
/**
 * The crosswalk (journey §6.3 as corrected, board D76): each health and pain
 * field, and the setup answers that set it. `Record`s over the profile's own
 * keys, so a field added to the profile without a question fails the build.
 */
import type { HealthProfile, PainProfile } from '@/types/profile';
import type { ChapterId, SetupAnswers } from '@/types/setup';
import { PAGES, chapterOf } from './graph';

export const HEALTH_SOURCES: Record<keyof HealthProfile, readonly (keyof SetupAnswers)[]> = {
  diabetes: ['conditions', 'diabetesType', 'classes'],
  insulin: ['classes', 'insulinHow'],
  insulinRegimen: ['insulinHow'],
  sulfonylureaOrMeglitinide: ['regular', 'classes'],
  sglt2i: ['regular', 'classes'],
  metformin: ['regular', 'classes'],
  metforminSince: ['metforminSince'],
  priorDkaOrInsulinDeficiency: ['priorDka'],
  medicinesReviewed: ['regular', 'classes'],
  highHypoRisk: ['lowsRisk'],
  hypertension: ['conditions', 'bpMedicine'],
  betaBlocker: ['regular', 'classes'],
  diuretic: ['regular', 'classes'],
  bpMedicinesReviewed: ['regular', 'classes'],
  heartOrVascularDisease: ['conditions'],
  kidneyDisease: ['conditions', 'kidneyTreatment'],
  fluidRestriction: ['fluidLimit'],
  retinopathy: ['conditions', 'eyeTreatment', 'eyeDisease'],
  peripheralNeuropathy: ['conditions', 'feetNumb'],
  footStatus: ['conditions', 'footWound', 'footRestriction'],
  dizzyOnStandingOrAutonomicNeuropathy: ['dizzy'],
  glucoseMonitor: ['glucoseMonitor'],
  glucoseUnit: ['glucoseUnit'],
  ketoneTest: ['ketoneTest'],
  bpMonitor: ['bpCuff'],
  currentlyActive: ['active'],
  clearance: ['clearance'],
  clinicianTargets: ['targets', 'bpStopSystolic', 'hba1cPercent', 'glucoseStartMin', 'glucoseStartUnit'],
  bpExercisePermission: ['targets', 'bpPermission'],
};

/** `preference` is learned, never asked (D77). */
export const PAIN_SOURCES: Record<keyof PainProfile, readonly (keyof SetupAnswers)[] | 'learned'> = {
  areas: ['conditions', 'painAreas'],
  sciaticaSide: ['sciaticaSide'],
  worseWith: ['worseWith'],
  neuroHistory: ['neuroHistory'],
  preference: 'learned',
};

/** Fields outside health and pain that each chapter's answers set. */
const OTHER_FIELDS: Record<ChapterId, readonly string[]> = {
  welcome: [],
  about: ['profile.name', 'profile.birthYear', 'profile.figure', 'profile.heightCm', 'profile.weightKg', 'profile.waistCm', 'settings.useMetric'],
  health: [],
  medicines: [],
  backFeet: [],
  movement: ['settings.focus', 'settings.weeklyMovementGoalMinutes'],
  food: ['profile.food'],
  day: ['settings.habits.water', 'settings.habits.sittingBreak', 'settings.habits.mealWalk', 'settings.habits.quietHours', 'settings.habits.inApp', 'profile.voice'],
};

export function keysOfChapter(chapter: ChapterId): (keyof SetupAnswers)[] {
  return [...new Set(PAGES.filter(p => chapterOf(p.id) === chapter).flatMap(p => p.sets))];
}

/** Every record path a chapter's answers can change: what an edit of it owns (§16). */
export function fieldsOfChapter(chapter: ChapterId): string[] {
  const keys = new Set<string>(keysOfChapter(chapter));
  const owns = (sources: readonly string[] | 'learned') => sources !== 'learned' && sources.some(k => keys.has(k));
  return [...new Set([
    ...OTHER_FIELDS[chapter],
    ...Object.entries(HEALTH_SOURCES).filter(([, s]) => owns(s)).map(([f]) => `profile.health.${f}`),
    ...Object.entries(PAIN_SOURCES).filter(([, s]) => owns(s)).map(([f]) => `profile.pain.${f}`),
  ])];
}
```

- [ ] **Step 9: Home's Back & leg tile.** In `src/categories.ts`'s `defaultHome`:
  - add `backUnsure?: boolean` to the input;
  - change the back rule to `areas.includes('lowerBack') || areas.includes('sciatica') || takes(profile.pain.neuroHistory) || backUnsure === true`;
  - import `takes` from `@/engine/health`;
  - extend the comment: "a back answer, a nerve problem in the history, or 'Not sure' about pain (journey §5.1)".

  Append to `src/categories.test.ts`, using its own `settings`:

```ts
describe('Back & leg by default (journey §5.1)', () => {
  it('for a nerve problem in the history, or "Not sure" about pain', () => {
    expect(defaultHome({ profile: createDefaultProfile({ pain: { neuroHistory: true } }), settings, hasSteps: false }).order.check).toContain('back');
    expect(defaultHome({ profile: createDefaultProfile(), settings, hasSteps: false, backUnsure: true }).order.check).toContain('back');
    expect(defaultHome({ profile: createDefaultProfile(), settings, hasSteps: false }).order.check).not.toContain('back');
  });
});
```

- [ ] **Step 10: Run the tests**

Run: `npx vitest run src/setup src/programme src/categories.test.ts`
Expected: PASS.

If a crosswalk probe fails with "values are equal", read its mapping in `healthFrom` against the probe's `vary`: the probe is the specification. Change the mapping, not the probe, unless the probe contradicts the board's crosswalk (D76).

- [ ] **Step 11: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/setup src/programme src/categories.ts src/categories.test.ts src/screens/move/plan.ts
git commit -m "feat: Work out the profile from setup's answers, with a crosswalk test for every engine field"
```

---

### Task 6: Answers from what's already stored

Setup and Me both start from what the record already says:
- a v1 Welcome left part-way (K-57);
- a restored backup that never finished setting up (§6.4);
- Me's chapters, for someone set up in v1, or after an edit made elsewhere (§16).

**Files:**
- Create: `src/setup/prefill.ts`, `src/setup/prefill.test.ts`

**Interfaces:**
- Consumes: `profileFrom`, `settingsFrom`, `put` (Task 5); `fieldsOfChapter`, `keysOfChapter`; `SAFETY_CHAPTERS`; `answeredOnOpen`; `isEnrolled`; `sameValue` from `@/store/transfer`.
- Produces:
  - `answersFromProfile(p: UserProfile, s: Pick<UserSettings, 'useMetric' | 'focus' | 'weeklyMovementGoalMinutes' | 'habits' | 'startDate'>): SetupAnswers`;
  - `prefillAnswers(settings, profile: UserProfile | undefined): SetupAnswers`;
  - `answersToEdit(stored: SetupAnswers | undefined, p: UserProfile, s: UserSettings, today: string, ctx: Ctx): SetupAnswers`.

- [ ] **Step 1: Write the failing test** `src/setup/prefill.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { AppData, UserSettings } from '@/types';
import { createDefaultProfile } from '@/profile/defaults';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import { profileFrom } from './assemble';
import { UNSURE } from './fixtures';
import { pageDone } from './graph';
import { answersFromProfile, answersToEdit, prefillAnswers } from './prefill';

const TODAY = '2026-10-10';
const CTX = { thisYear: 2026 };
const S: UserSettings = { ...migrateData({ version: CURRENT_VERSION } as AppData).settings, useMetric: true, startDate: '2026-09-24', focus: 'strength' };

/** P01 of codex-acceptance.md, as v1 stored it. */
const P01 = createDefaultProfile({
  weightKg: 78, heightCm: 175, birthYear: 1982, figure: 'male', experience: 'beginner', trainingDays: ['monday', 'thursday', 'saturday'],
  sessionMinutes: 45, equipment: 'fullGym', goals: ['strong', 'flexible', 'painFreeBack'],
  pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion', preference: 'extension' },
  health: {
    diabetes: 'type2', metformin: true, metforminSince: '2019', glucoseMonitor: 'meter', hypertension: 'treated', bpMonitor: true,
    sulfonylureaOrMeglitinide: false, sglt2i: false, priorDkaOrInsulinDeficiency: false, medicinesReviewed: true, clearance: 'vigorous',
  },
  food: { pattern: 'vegetarian', avoid: [], region: 'north' },
  voice: { muted: true, checked: true },
  needsHealthReview: false,
});

describe('answers v1 already gave (K-57; journey §6.4, §16)', () => {
  it('reads P01 back as the answers v1 asked', () => {
    const a = answersFromProfile(P01, S);
    expect(a).toMatchObject({
      conditions: { diabetes: 'yes', bp: 'yes', heart: 'no', kidney: 'no', pain: 'yes', eyes: 'no', feet: 'no' },
      diabetesType: 'type2', bpMedicine: 'yes', regular: 'yes',
      classes: { insulin: 'no', lowsTablet: 'no', gliflozin: 'no', metformin: 'yes' }, metforminSince: '2019', priorDka: 'no',
      glucoseMonitor: 'meter', glucoseUnit: 'mg/dL', bpCuff: true, dizzy: 'no', clearance: 'vigorous', active: 'yes',
      painAreas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion',
      focus: 'strength', programme: 'joined', pattern: 'vegetarian', voice: { muted: true, pack: 'af_heart' },
    });
    // v1 never asked "something else", nor the BP medicines without their review flag.
    expect(a.conditions?.other).toBeUndefined();
    expect(a.classes?.betaBlocker).toBeUndefined();
  });

  it('gives back exactly the profile it came from: reading it changes nothing (§6.6)', () => {
    expect(profileFrom(answersFromProfile(P01, S), P01, TODAY, CTX)).toEqual(P01);
  });

  it('never answers eyes or feet for someone v1 never asked (board D79)', () => {
    const noDiabetes = createDefaultProfile({ health: { medicinesReviewed: true } });
    const a = answersFromProfile(noDiabetes, S);
    expect(a.conditions?.eyes).toBeUndefined();
    expect(a.conditions?.feet).toBeUndefined();
    expect(pageDone('health.conditions', a, CTX)).toBe(false);
  });

  it('a migrated, unreviewed profile reads what it kept, but no medicine never answered', () => {
    const migrated = createDefaultProfile({ needsHealthReview: true, health: { diabetes: 'type2' } });
    const a = answersFromProfile(migrated, S);
    expect(a.conditions?.diabetes).toBe('yes');
    expect(a.classes).toBeUndefined();
    expect(a.regular).toBeUndefined();
  });

  it('gives setup none of an unreviewed profile’s health answers: they may be defaults nobody gave (H-DATA)', () => {
    const a = prefillAnswers(S, createDefaultProfile({ needsHealthReview: true, figure: 'female', health: { diabetes: 'type2' } }));
    expect(a.figure).toBe('female');
    expect(a.conditions).toBeUndefined();
    expect(a.painAreas).toBeUndefined();
    expect(a.glucoseMonitor).toBeUndefined();
  });

  it('a v1 Welcome left part-way fills in its focus (K-57)', () => {
    expect(prefillAnswers({ ...S, focus: 'stretch' }, undefined)).toEqual({ metric: true, focus: 'stretch' });
  });
});

describe('the answers Me edits with (§16)', () => {
  const p = profileFrom(UNSURE, undefined, TODAY, CTX);

  it('keeps "Not sure" while the profile still says what those answers gave', () => {
    const a = answersToEdit(UNSURE, p, S, TODAY, CTX);
    expect(a.conditions?.diabetes).toBe('unsure');
    expect(a.classes?.insulin).toBe('unsure');
  });

  it('an edit made elsewhere wins, for the chapters that own the field only', () => {
    const elsewhere = { ...p, health: { ...p.health, fluidRestriction: true as const } };
    const a = answersToEdit(UNSURE, elsewhere, S, TODAY, CTX);
    expect(a.fluidLimit).toBe('yes');
    expect(a.conditions?.diabetes).toBe('yes');
    expect(a.classes?.insulin).toBe('unsure');
  });

  it('says what’s true of the programme now (D35)', () => {
    expect(answersToEdit({ ...UNSURE, programme: 'joined' }, p, { ...S, startDate: '' }, TODAY, CTX).programme).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/setup/prefill.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `src/setup/prefill.ts`**

```ts
/**
 * The answers a stored record already gives, for setup's pages: a v1 Welcome
 * left part-way (K-57), a restored backup that never finished setting up
 * (§6.4), and Me's chapters for someone set up in v1 (§16). Only what v1
 * asked: it asked about the eyes and feet only with diabetes, so without it
 * those chips stay unanswered rather than read back as "No" (contract H-DATA,
 * board D79); and a medicine answer counts only when v1 counted it
 * (`answeredOnOpen`).
 */
import type { UserSettings } from '@/types';
import type { MedicineAnswer, UserProfile } from '@/types/profile';
import { CHAPTER_IDS, type SetupAnswers, type Tri } from '@/types/setup';
import { deriveHealth } from '@/engine/health';
import { answeredOnOpen } from '@/components/profile/wizardSteps';
import { isEnrolled } from '@/health/recommend';
import { sameValue } from '@/store/transfer';
import { profileFrom, put, settingsFrom } from './assemble';
import { fieldsOfChapter, keysOfChapter } from './fields';
import { SAFETY_CHAPTERS, type Ctx } from './graph';

type Kept = Pick<UserSettings, 'useMetric' | 'focus' | 'weeklyMovementGoalMinutes' | 'habits' | 'startDate'>;

const tri = (v: MedicineAnswer | undefined): Tri | undefined => (v === true ? 'yes' : v === 'unsure' ? 'unsure' : v === false ? 'no' : undefined);

export function answersFromProfile(p: UserProfile, s: Kept): SetupAnswers {
  const h = p.health;
  const d = deriveHealth(h);
  const a: SetupAnswers = { metric: s.useMetric };

  // 2. About you: the person's own values.
  if (p.name !== undefined) a.name = p.name;
  if (p.birthYear !== undefined) a.birthYear = p.birthYear;
  if (p.figure) a.figure = p.figure;
  if (p.heightCm) a.heightCm = p.heightCm;
  if (p.weightKg > 0) a.weightKg = p.weightKg;
  if (p.waistCm) a.waistCm = p.waistCm;

  // 3. Your health, as v1's health step asked it.
  a.conditions = {
    diabetes: h.diabetes === 'none' ? 'no' : 'yes',
    bp: h.hypertension === 'none' ? 'no' : h.hypertension === 'unsure' ? 'unsure' : 'yes',
    heart: h.heartOrVascularDisease ? 'yes' : 'no',
    kidney: h.kidneyDisease === 'none' ? 'no' : h.kidneyDisease === 'unsure' ? 'unsure' : 'yes',
    pain: p.pain.areas.length > 0 ? 'yes' : 'no',
    ...(d.diabetic ? {
      eyes: h.retinopathy === 'none_or_mild' ? 'no' : h.retinopathy === 'unknown' ? 'unsure' : 'yes',
      feet: h.peripheralNeuropathy === 'no' && h.footStatus === 'healthy' ? 'no'
        : h.peripheralNeuropathy === 'unsure' && h.footStatus === 'healthy' ? 'unsure' : 'yes',
    } as const : {}),
  };
  if (h.diabetes !== 'none') a.diabetesType = h.diabetes;
  if (h.hypertension === 'treated') a.bpMedicine = 'yes';
  else if (h.hypertension === 'untreated') a.bpMedicine = 'no';
  else if (h.hypertension === 'unsure') a.bpMedicine = 'unsure';
  if (h.kidneyDisease !== 'none') a.kidneyTreatment = h.kidneyDisease === 'dialysis_or_transplant' ? 'yes' : 'no';
  if (h.fluidRestriction !== undefined) a.fluidLimit = tri(h.fluidRestriction);
  if (d.diabetic && h.retinopathy !== 'none_or_mild') {
    a.eyeTreatment = h.retinopathy === 'recent_eye_treatment' ? 'yes' : 'no';
    if (h.retinopathy !== 'recent_eye_treatment') a.eyeDisease = h.retinopathy === 'moderate' ? 'moderate' : h.retinopathy === 'severe_or_proliferative' ? 'severe' : 'unsure';
  }
  if (a.conditions.feet === 'yes' || a.conditions.feet === 'unsure') {
    a.feetNumb = h.peripheralNeuropathy === 'yes' ? 'yes' : h.peripheralNeuropathy === 'unsure' ? 'unsure' : 'no';
    a.footWound = h.footStatus === 'current_wound_or_active_charcot' ? 'now' : h.footStatus === 'past_ulcer_or_charcot' ? 'past' : 'no';
  }
  if (d.diabetic || h.heartOrVascularDisease || h.kidneyDisease !== 'none' || h.hypertension !== 'none') a.clearance = h.clearance;
  const t = h.clinicianTargets;
  if (t?.bpStopSystolic !== undefined) a.bpStopSystolic = t.bpStopSystolic;
  if (t?.hba1cPercent !== undefined) a.hba1cPercent = t.hba1cPercent;
  if (h.bpExercisePermission) a.bpPermission = { sys: h.bpExercisePermission.sys, dia: h.bpExercisePermission.dia };
  if (a.bpStopSystolic !== undefined || a.hba1cPercent !== undefined || a.bpPermission) a.targets = 'yes';

  // 4. Medicines: only those v1 counted as answered.
  const asked = answeredOnOpen(h);
  const classes: NonNullable<SetupAnswers['classes']> = {};
  if (asked.has('insulin')) classes.insulin = h.insulin === 'none' ? 'no' : h.insulin === 'unsure' ? 'unsure' : 'yes';
  if (asked.has('sulfonylurea')) classes.lowsTablet = tri(h.sulfonylureaOrMeglitinide);
  if (asked.has('sglt2i')) classes.gliflozin = tri(h.sglt2i);
  if (asked.has('metformin')) classes.metformin = tri(h.metformin);
  if (asked.has('betaBlocker')) classes.betaBlocker = tri(h.betaBlocker);
  if (asked.has('diuretic')) classes.diuretic = tri(h.diuretic);
  if (Object.keys(classes).length > 0) {
    a.classes = classes;
    if (Object.values(classes).some(v => v === 'yes' || v === 'unsure')) a.regular = 'yes';
  }
  if (h.metforminSince) a.metforminSince = h.metforminSince.slice(0, 4);
  if (asked.has('priorDka') && h.priorDkaOrInsulinDeficiency !== undefined) a.priorDka = tri(h.priorDkaOrInsulinDeficiency);
  if (asked.has('insulin') && h.insulin !== 'none') {
    a.insulinHow = h.insulin === 'automated_delivery' ? 'closedLoop' : h.insulin === 'unsure' ? 'unsure' : h.insulinRegimen ?? 'unsure';
  }
  if (d.hypoRisk) a.lowsRisk = h.highHypoRisk ? 'yes' : 'no';
  if (t?.glucoseStartMin !== undefined) { a.glucoseStartMin = t.glucoseStartMin; a.glucoseStartUnit = t.glucoseStartUnit ?? 'mg/dL'; }
  if (d.ketoneRisk) a.ketoneTest = h.ketoneTest;
  // "Anything else?", with dizziness, was asked of everyone.
  a.dizzy = h.dizzyOnStandingOrAutonomicNeuropathy ? 'yes' : 'no';
  if (d.diabetic) { a.glucoseMonitor = h.glucoseMonitor; a.glucoseUnit = h.glucoseUnit; }
  if (h.hypertension !== 'none') a.bpCuff = h.bpMonitor;

  // 5. Back and feet: v1's body step asked everyone.
  a.painAreas = [...p.pain.areas];
  if (p.pain.sciaticaSide) a.sciaticaSide = p.pain.sciaticaSide;
  if (p.pain.areas.some(x => x === 'lowerBack' || x === 'sciatica')) a.worseWith = p.pain.worseWith;
  if (p.pain.neuroHistory !== undefined) a.neuroHistory = tri(p.pain.neuroHistory);

  // 6. Movement.
  if (s.focus) a.focus = s.focus;
  a.active = h.currentlyActive ? 'yes' : 'no';
  if (s.weeklyMovementGoalMinutes !== undefined) a.weeklyGoal = s.weeklyMovementGoalMinutes;
  if (isEnrolled(s, p)) a.programme = 'joined';

  // 7. Food (Plan 7's contract, board D82).
  if (p.food) {
    a.pattern = p.food.pattern;
    if (p.food.allergies) a.allergies = [...p.food.allergies];
    if (p.food.level) a.foodLevel = p.food.level;
  }

  // 8. Your day and coach.
  const hb = s.habits;
  if (hb?.water) a.water = { on: hb.water.enabled, glassMl: hb.water.glassMl, everyMinutes: hb.water.everyMinutes, from: hb.water.from, to: hb.water.to };
  if (hb?.sittingBreak) a.sitting = { on: hb.sittingBreak.enabled, everyMinutes: hb.sittingBreak.everyMinutes, from: hb.sittingBreak.from, to: hb.sittingBreak.to };
  if (hb?.mealWalk) {
    a.mealWalk = { on: hb.mealWalk.enabled, meals: [...hb.mealWalk.meals] };
    if (hb.mealWalk.finish) a.mealFinish = { ...hb.mealWalk.finish };
  }
  if (hb?.quietHours) a.quiet = { ...hb.quietHours };
  if (hb?.inApp !== undefined) a.delivery = hb.inApp ? 'app' : 'calendar';
  a.voice = { muted: p.voice.muted, ...(p.voice.pack ? { pack: p.voice.pack } : {}) };
  return a;
}

/**
 * What setup starts from when nothing was drafted: what the record already
 * says (K-57, §6.4). An unreviewed profile's health, medicine and pain values
 * may be defaults nobody gave, so setup asks those again (contract H-DATA).
 */
export function prefillAnswers(settings: Kept, profile: UserProfile | undefined): SetupAnswers {
  if (!profile) return { metric: settings.useMetric, ...(settings.focus ? { focus: settings.focus } : {}) };
  const out = answersFromProfile(profile, settings);
  if (profile.needsHealthReview) for (const c of SAFETY_CHAPTERS) for (const k of keysOfChapter(c)) delete out[k];
  return out;
}

const read = (o: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((x, k) => (x !== null && typeof x === 'object' ? (x as Record<string, unknown>)[k] : undefined), o);

/**
 * The answers Me edits a chapter with (§16): the stored ones while, chapter
 * by chapter, they still give the record as it is. A chapter whose fields
 * were changed somewhere else since (a fluid limit set in Reminders, say)
 * takes what the record says now. So "Not sure" survives, and an edit made
 * elsewhere is never undone.
 */
export function answersToEdit(stored: SetupAnswers | undefined, p: UserProfile, s: UserSettings, today: string, ctx: Ctx): SetupAnswers {
  const out: SetupAnswers = answersFromProfile(p, s);
  if (stored) {
    const profile = profileFrom(stored, p, today, ctx);
    const record = { profile, settings: { ...s, ...settingsFrom(stored, s, profile, today) } };
    const current = { profile: p, settings: s };
    for (const chapter of CHAPTER_IDS) {
      if (!fieldsOfChapter(chapter).every(path => sameValue(read(record, path), read(current, path)))) continue;
      for (const key of keysOfChapter(chapter)) put(out, key, stored[key]);
    }
    if (stored.skippedPages) out.skippedPages = [...stored.skippedPages];
  }
  // Membership has one definition (D35): this answer always says what's true now.
  if (isEnrolled(s, p)) out.programme = 'joined';
  else if (out.programme === 'joined') delete out.programme;
  return out;
}
```

- [ ] **Step 4: Run it to check it passes**

Run: `npx vitest run src/setup/prefill.test.ts`
Expected: PASS.

If the round-trip test fails, the diff names the field. The answer that sets it is either:
- read back where v1 never asked it, so delete that line from `answersFromProfile`; or
- mapped in `healthFrom` to a value v1 didn't use for the same answer, so fix the mapping.

Fix the mapping, never the test: this test is how an upgrade is proven not to change what's allowed (§6.6).

- [ ] **Step 5: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/setup/prefill.ts src/setup/prefill.test.ts
git commit -m "feat: Fill setup and Me's chapters from what the record already says"
```

---
### Task 7: Finish setting up, from setup's state; the hold while setup is unfinished

Plan 4 built `setupProgress()` with only the gaps v1 knows, each opening a v1 screen. This task fills it from `settings.setup` (D65's seam, board D79), keeping its signature, its row fields and `notNow`:
- the safety gaps the engine holds on;
- the chapters skipped;
- the chapters new since a v1 record set up.

Each row opens the chapter's own pages (`/me/profile?chapter=…`, Task 14), or setup itself while it's unfinished. Home's profile hold says "Finish setting up" until setup is finished (L-20, board D80).

**Files:**
- Modify: `src/setup/progress.ts` (Plan 4's), `src/setup/progress.test.ts`
- Modify: `src/health/recommend.ts`, `src/health/recommend.test.ts`
- Modify: `src/screens/home/urgent.ts` (`recommendSources`)

**Interfaces:**
- Consumes: `setupStateOf` (Task 4); `CHAPTER_TITLE`, `chapterOf`, `missingPages` (Task 4); `reviewNeeded`, `REVIEW_LABEL`.
- Produces:
  - `setupProgress({ profile, settings }, ctx?): OpenChapter[]`: Plan 4's signature, with an optional `ctx` for tests (the year, today's by default);
  - `chapterHref(chapter: ChapterId): string`, used by Profile & health (Task 14);
  - `finishTitle` and `notNow`, unchanged;
  - `RecommendInput.setupOpen?: boolean`, and `profileFirst(gaps, held, setupOpen = false)`.

- [ ] **Step 1: Write the failing tests.** In `src/setup/progress.test.ts`, keep Plan 4's set-up (the `localStorage` stand-in, `store` and `beforeEach`) and its `notNow` describe. Replace the imports and the `describe('setupProgress until Plan 5 …')` block with:

```ts
import type { ChapterId, UserSettings } from '@/types';
import { CHAPTER_IDS, type SetupAnswers } from '@/types/setup';
import { MINIMAL } from './fixtures';

const { chapterHref, finishTitle, notNow, setupProgress } = await import('./progress');

const ctx = { thisYear: 2026 };
/** Set up in v1: done, with no setup state written yet. */
const v1 = { onboardingComplete: true } as UserSettings;
const finished = (answers: SetupAnswers, skipped: ChapterId[] = []) =>
  ({ onboardingComplete: true, setup: { stage: 'done', skipped, answers, completedAt: '2026-10-08T09:00:00.000+05:30' } }) as UserSettings;
/** Every answer given, the questions new since v1 included. */
const answered = createDefaultProfile({ weightKg: 70, name: 'Asha', food: { pattern: 'vegetarian', avoid: [], level: 'ideas' }, health: { medicinesReviewed: true } });
const rows = (profile: Parameters<typeof setupProgress>[0]['profile'], s: UserSettings) =>
  setupProgress({ profile, settings: s }, ctx).map(c => [c.chapter, c.detail, c.why]);

describe('setupProgress, from setup’s state (journey §6.6, §16; board D79)', () => {
  it('has nothing open once setup is finished with every chapter answered', () => {
    expect(setupProgress({ profile: answered, settings: finished(MINIMAL) }, ctx)).toEqual([]);
  });

  it('while setup is unfinished, its one row carries on setting up (L-20)', () => {
    expect(setupProgress({ profile: undefined, settings: {} as UserSettings }, ctx)).toEqual([
      { chapter: 'health', label: 'Your health', detail: 'Answer the health questions before you move', href: '/setup', why: 'gap' },
    ]);
    expect(rows(undefined, { onboardingComplete: true, setup: { stage: 'lookAround', skipped: [] } } as UserSettings))
      .toEqual([['health', 'Answer the health questions before you move', 'gap']]);
  });

  it('lists an upgrader’s new chapters as new, after any safety gap (§6.6)', () => {
    const p = createDefaultProfile({ weightKg: 70, health: { medicinesReviewed: true }, needsHealthReview: true });
    expect(rows(p, v1)).toEqual([
      ['health', 'Your health answers need a review', 'gap'],
      ['about', 'What to call you', 'new'],
      ['food', 'Logging what you eat', 'new'],
    ]);
  });

  it('opens Your medicines when diabetes medicines were never answered: movement waits on it', () => {
    const p = { ...answered, health: { ...answered.health, diabetes: 'type2' as const, medicinesReviewed: false } };
    expect(rows(p, v1)).toEqual([['medicines', 'Medicines: not yet reviewed', 'gap']]);
  });

  it('opens Your medicines for the SGLT2 question nobody answered, as skipped: nothing is held on it', () => {
    const p = { ...answered, health: { ...answered.health, medicinesReviewed: undefined } };
    expect(rows(p, v1)).toEqual([['medicines', 'One medicine question to answer', 'skipped']]);
  });

  it('names a skipped preference page by what it asks, and opens the chapter’s own pages', () => {
    const s = finished({ ...MINIMAL, weeklyGoal: undefined, skippedPages: ['movement.goal'] }, ['movement']);
    expect(setupProgress({ profile: answered, settings: s }, ctx)).toEqual([
      { chapter: 'movement', label: 'Your movement', detail: 'Your weekly goal', href: '/me/profile?chapter=movement', why: 'skipped' },
    ]);
  });

  it('leaves out a chapter answered “Not now”', () => {
    expect(rows(undefined, { setup: { declined: ['health'] } } as UserSettings)).toEqual([]);
    const p = createDefaultProfile({ weightKg: 70, health: { medicinesReviewed: true } });
    expect(rows(p, { onboardingComplete: true, setup: { declined: ['about'] } } as UserSettings)).toEqual([['food', 'Logging what you eat', 'new']]);
  });

  it('counts the chapters in the group’s title (journey §6.6)', () => {
    expect(finishTitle(1)).toBe('Finish setting up · 1 short chapter');
    expect(finishTitle(2)).toBe('Finish setting up · 2 short chapters');
  });

  it('opens each chapter at its own pages, and Welcome at Display (§19.2)', () => {
    expect(CHAPTER_IDS.map(chapterHref)).toEqual([
      '/me/display', '/me/profile?chapter=about', '/me/profile?chapter=health', '/me/profile?chapter=medicines',
      '/me/profile?chapter=backFeet', '/me/profile?chapter=movement', '/me/profile?chapter=food', '/me/profile?chapter=day',
    ]);
  });
});
```

Append to `src/health/recommend.test.ts`, inside the safety `describe` that holds "puts an unreviewed health profile at the top":

```ts
  it('says “Finish setting up” while setup is unfinished, and carries on setting up (journey §6.4, L-20)', () => {
    const permissions = every(m => ({ ...firstCheckIn(m), reasons: [PERMISSION_TEXT.healthUnreviewed, PERMISSION_TEXT.noCheckIn], release: 'Answer the health questions in your profile.' }));
    expect(recommend(input({ profile: undefined, permissions, setupOpen: true }))).toEqual({
      kind: 'hold',
      title: 'Finish setting up',
      detail: 'Answer the health questions in your profile.',
      reason: PERMISSION_TEXT.healthUnreviewed,
      action: { label: 'Carry on setting up', to: HREF.profile },
    });
    expect(recommend(input({ profile: owner({}, { needsHealthReview: true }), permissions })).title).toBe('Finish your health profile');
  });
```

- [ ] **Step 2: Run them to check they fail**

Run: `npx vitest run src/setup/progress.test.ts src/health/recommend.test.ts`
Expected: FAIL. `chapterHref` isn't exported, the rows aren't read from setup's state, and `setupOpen` isn't read.

- [ ] **Step 3: Fill the seam.** Replace `src/setup/progress.ts` with:

```ts
/**
 * Setup's progress, as Me's "Finish setting up" reads it (journey §6.6, §16).
 * Plan 4 built this seam (D65), and Plan 5 fills it from `settings.setup`
 * (board D79): the safety gaps the engine holds on, the chapters skipped, and
 * the ones new since this person set up in v1. Each row opens the chapter's
 * own pages; while setup is unfinished, setup itself (L-20).
 */
import { REVIEW_LABEL, reviewNeeded } from '@/screens/you/summaries';
import type { StoreResult } from '@/store/db';
import { update } from '@/store/useStore';
import type { ChapterId, UserSettings } from '@/types';
import type { UserProfile } from '@/types/profile';
import { CHAPTER_IDS, type PageId } from '@/types/setup';
import { CHAPTER_TITLE, chapterOf, missingPages, type Ctx } from './graph';
import { setupStateOf } from './state';

export interface OpenChapter {
  chapter: ChapterId;
  /** The chapter's title: the row's first line. */
  label: string;
  /** The row's second line: why it's open. */
  detail: string;
  /** Where the row opens. */
  href: string;
  /**
   * - `gap`: a safety answer is missing, so movement waits (the engine's own hold).
   * - `skipped`: passed over in setup, or never answered.
   * - `new`: added since this person set up.
   */
  why: 'gap' | 'skipped' | 'new';
}

/** Where Me opens a chapter: its own pages in Profile & health, and Welcome's Display row at Display (§19.2). */
export function chapterHref(chapter: ChapterId): string {
  return chapter === 'welcome' ? '/me/display' : `/me/profile?chapter=${chapter}`;
}

/** The questions a v1 record was never asked, by chapter (§6.6). */
const NEW_SINCE_V1: Partial<Record<ChapterId, string>> = { about: 'What to call you', food: 'Logging what you eat', day: 'Your usual meal times' };

/** What a page that may be left asks, for its row. */
const PAGE_TOPIC: Partial<Record<PageId, string>> = {
  'about.name': 'What to call you', 'about.figure': 'Body for the exercise demos', 'movement.goal': 'Your weekly goal',
  'food.pattern': 'What you eat', 'food.logging': 'Logging what you eat', 'day.reminders': 'Reminders', 'day.meals': 'Your usual meal times',
};

const open = (chapter: ChapterId, why: OpenChapter['why'], detail: string, href = chapterHref(chapter)): OpenChapter =>
  ({ chapter, label: CHAPTER_TITLE[chapter], detail, href, why });

/** The chapters left to answer, safety gaps first, without those answered "Not now". */
export function setupProgress(
  { profile, settings }: { profile: UserProfile | undefined; settings: UserSettings },
  ctx: Ctx = { thisYear: new Date().getFullYear() },
): OpenChapter[] {
  const setup = setupStateOf(settings, profile);
  const declined = setup.declined ?? [];
  const keep = (rows: OpenChapter[]) => rows.filter(c => !declined.includes(c.chapter));
  // Unfinished: setup carries on where it stopped (L-20, board D80).
  if (setup.stage !== 'done' || !profile) return keep([open('health', 'gap', 'Answer the health questions before you move', '/setup')]);
  const review = reviewNeeded(profile);
  const gaps = review === 'health' ? [open('health', 'gap', REVIEW_LABEL.health)]
    // Without diabetes nothing is held on it (`sglt2Unknown`, engine/health.ts): asked, not required.
    : review === 'sglt2' ? [open('medicines', 'skipped', REVIEW_LABEL.sglt2)]
    : review ? [open('medicines', 'gap', REVIEW_LABEL[review])]
    : [];
  const answers = setup.answers;
  const left = CHAPTER_IDS.filter(c => setup.skipped.includes(c) && !gaps.some(g => g.chapter === c)).map(c => {
    if (!answers) return open(c, 'new', NEW_SINCE_V1[c] ?? 'A few questions');
    const pages = [...(answers.skippedPages ?? []), ...missingPages(answers, ctx)].filter(id => chapterOf(id) === c);
    const topics = [...new Set(pages.map(id => PAGE_TOPIC[id]).filter((t): t is string => t !== undefined))];
    return open(c, 'skipped', topics.join(', ') || 'A few questions');
  });
  return keep([...gaps, ...left]);
}

/** "Finish setting up · 2 short chapters" (journey §6.6). */
export function finishTitle(count: number): string {
  return `Finish setting up · ${count === 1 ? '1 short chapter' : `${count} short chapters`}`;
}

/** "Not now" on a Finish setting up row (journey §6.6, D65): the chapter waits in Profile & health, and the row goes. */
export function notNow(chapter: ChapterId): Promise<StoreResult> {
  return update(previous => {
    const declined = previous.settings.setup?.declined ?? [];
    if (declined.includes(chapter)) return previous;
    return { ...previous, settings: { ...previous.settings, setup: { ...previous.settings.setup, declined: [...declined, chapter] } } };
  });
}
```

- [ ] **Step 4: The hold while setup is unfinished.** In `src/health/recommend.ts`:
  - add to `RecommendInput`:

    ```ts
    /** Setup isn't finished ("Look around first", journey §6.4): the profile hold says so, and carries on setting up (L-20). */
    setupOpen?: boolean;
    ```

  - in `holdFor`, change the first line to `if (ctx.profileGap) return profileFirst(ctx.gaps, held, ctx.input.setupOpen === true);`;
  - change `profileFirst`'s signature and add its first case:

    ```ts
    export function profileFirst(gaps: ProfileGaps, held: Permission, setupOpen = false): Recommendation {
      // Its action is the profile's address, which opens setup where it stopped while setup is unfinished (Task 14).
      if (setupOpen) {
        return {
          kind: 'hold',
          title: 'Finish setting up',
          detail: held.release ?? '',
          reason: PERMISSION_TEXT.healthUnreviewed,
          action: { label: 'Carry on setting up', to: HREF.profile },
        };
      }
    ```

    The two cases that follow stay as they are.

  In `src/screens/home/urgent.ts`'s `recommendSources`, import `setupStateOf` from `@/setup/state` and add `setupOpen: setupStateOf(state.settings, state.profile).stage !== 'done'` to the object it returns.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/setup/progress.test.ts src/health/recommend.test.ts src/screens/home src/screens/today`
Expected: PASS. `eyebrowOf` still reads `HREF.profile` as "Before you start", which is right for "Finish setting up".

- [ ] **Step 6: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/setup/progress.ts src/setup/progress.test.ts src/health/recommend.ts src/health/recommend.test.ts src/screens/home/urgent.ts
git commit -m "feat: Fill Finish setting up from setup's state, and hold with Finish setting up until it's done"
```

---

### Task 8: The draft, its failure state and "Continue without saving"

Every Next stores the draft before setup moves, so a fast double tap can't skip a question (M22). If the write fails, setup stays on the page with its answers. It says so, and offers "Try again" and "Continue without saving" (§6.1, B-07). Without saving, the answers live in this session only: the warning stays on every page, completion isn't stored, and the safety holds apply.

**Files:**
- Create: `src/setup/draft.ts`, `src/setup/draft.test.ts`

**Interfaces:**
- Consumes: `setupStateOf` (Task 4); the store's `update`, `StoreResult` and status.
- Produces:
  - `withDraft(data: AppData, at: PageId, answers: SetupAnswers): AppData`, a no-op once setup is done;
  - `type SaveOutcome = 'saved' | 'session' | 'failed'`, and `outcomeOf(result: StoreResult, status: 'loading' | 'ready' | 'unavailable'): SaveOutcome`;
  - `mover(save, on: { moved(to): void; failed(to, answers): void }): (to, answers) => Promise<SaveOutcome | undefined>`;
  - `interface SetupSession { unsaved: boolean; entered: boolean; answers: SetupAnswers; at?: PageId }`;
  - `useSetupSession()`, `getSetupSession()`;
  - `continueWithoutSaving(at, answers)`, `keepInSession(at, answers)`, `enterWithoutSaving()`;
  - `pageEdits(id)` and `rememberEdits(id, edits)`, so Back never loses what a page held (§6.1);
  - `resetSetupSessionForTests()`.

- [ ] **Step 1: Write the failing test** `src/setup/draft.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { StoreFailure } from '@/store/db';
import { CURRENT_VERSION, migrateData } from '@/services/storage';

// The store sweeps localStorage on clear-all; node has none, so give it one.
const local = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => local.get(k) ?? null,
  setItem: (k: string, v: string) => void local.set(k, v),
  removeItem: (k: string) => void local.delete(k),
  clear: () => local.clear(),
  key: (i: number) => [...local.keys()][i] ?? null,
  get length() { return local.size; },
} as Storage;

const store = await import('@/store/useStore');
const {
  continueWithoutSaving, enterWithoutSaving, getSetupSession, keepInSession, mover, outcomeOf, pageEdits, rememberEdits,
  resetSetupSessionForTests, withDraft,
} = await import('./draft');

const fresh = (): AppData => migrateData({ version: CURRENT_VERSION } as AppData);
const ok = { ok: true as const, value: undefined };
const refused = { ok: false as const, failure: new StoreFailure('quotaExceeded', 'Storage is full') };

beforeEach(() => {
  local.clear();
  store.resetForTests();
  resetSetupSessionForTests();
});

describe('the draft (journey §6.1, §18.1)', () => {
  it('stores the answers and the page to resume on, keeping the rest of setup’s state', () => {
    const data = fresh();
    data.settings = { ...data.settings, setup: { declined: ['food'] } };
    expect(withDraft(data, 'about.figure', { name: 'Asha' }).settings.setup)
      .toEqual({ stage: 'open', skipped: [], declined: ['food'], draft: { at: 'about.figure', answers: { name: 'Asha' } } });
  });

  it('changes nothing once another tab has finished setup (Review Focus 4)', () => {
    const data = fresh();
    data.settings = { ...data.settings, onboardingComplete: true, setup: { stage: 'done', skipped: [], answers: { name: 'Asha' } } };
    expect(withDraft(data, 'health.conditions', { name: 'Someone else' })).toBe(data);
  });

  it('reads a write’s result: stored, kept for this session only, or refused', () => {
    expect(outcomeOf(ok, 'ready')).toBe('saved');
    expect(outcomeOf(refused, 'unavailable')).toBe('session');
    expect(outcomeOf(refused, 'ready')).toBe('failed');
  });
});

describe('Next moves only once its answer is stored (M22)', () => {
  it('a fast double tap stores once and moves once', async () => {
    const saves: string[] = [];
    const moves: string[] = [];
    let finish!: () => void;
    const go = mover(to => new Promise(resolve => { saves.push(to); finish = () => resolve('saved'); }), { moved: to => moves.push(to), failed: () => {} });
    const first = go('about.figure', {});
    const second = go('about.figure', {});
    expect(await second).toBeUndefined();
    finish();
    expect(await first).toBe('saved');
    expect(saves).toEqual(['about.figure']);
    expect(moves).toEqual(['about.figure']);
  });

  it('a refused or thrown save stays, with the answers kept to try again', async () => {
    const failed: [string, unknown][] = [];
    const moves: string[] = [];
    const on = { moved: (to: string) => moves.push(to), failed: (to: string, a: unknown) => failed.push([to, a]) };
    await mover(() => Promise.resolve('failed'), on)('health.diabetes', { regular: 'yes' });
    await mover(() => Promise.reject(new Error('disk gone')), on)('health.bp', {});
    expect(moves).toEqual([]);
    expect(failed).toEqual([['health.diabetes', { regular: 'yes' }], ['health.bp', {}]]);
  });

  it('a refused write leaves the stored draft as it was (V-J17)', async () => {
    let refuse = false;
    await store.start({ factory: fakeIndexedDB({ failWrite: (s, v) => (refuse && s === 'settings' && v.key === 'settings' ? new DOMException('Disk is full', 'QuotaExceededError') : undefined) }) });
    expect((await store.update(d => withDraft(d, 'about.figure', { name: 'Asha' }))).ok).toBe(true);
    refuse = true;
    const result = await store.update(d => withDraft(d, 'health.conditions', { name: 'Asha', figure: 'female' }));
    expect(outcomeOf(result, store.getState().status)).toBe('failed');
    expect((await store.reload()).ok).toBe(true);
    expect(store.getState().settings.setup?.draft).toEqual({ at: 'about.figure', answers: { name: 'Asha' } });
  });
});

describe('without saving (B-07)', () => {
  it('keeps the answers in this session, then lets the app open for it only', () => {
    continueWithoutSaving('health.diabetes', { conditions: { diabetes: 'unsure' } });
    keepInSession('health.bp', { conditions: { diabetes: 'unsure' }, diabetesType: 'unsure' });
    expect(getSetupSession()).toEqual({ unsaved: true, entered: false, at: 'health.bp', answers: { conditions: { diabetes: 'unsure' }, diabetesType: 'unsure' } });
    enterWithoutSaving();
    expect(getSetupSession().entered).toBe(true);
  });

  it('remembers what a page held, so Back never loses it (§6.1)', () => {
    rememberEdits('about.name', { name: 'As' });
    expect(pageEdits('about.name')).toEqual({ name: 'As' });
    expect(pageEdits('about.figure')).toEqual({});
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/setup/draft.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write `src/setup/draft.ts`**

```ts
/**
 * Setup's draft (journey §6.1, §18.1; B-07). Every Next stores the answers
 * and the page to resume on before setup moves. When that write fails, setup
 * says so and offers to carry on without saving. Then the answers live only
 * in this session: completion is never stored, and every safety hold applies.
 */
import { useSyncExternalStore } from 'react';
import type { AppData } from '@/types';
import type { PageId, SetupAnswers } from '@/types/setup';
import type { StoreResult } from '@/store/db';
import { setupStateOf } from './state';

export function withDraft(data: AppData, at: PageId, answers: SetupAnswers): AppData {
  const setup = setupStateOf(data.settings, data.profile);
  // Another tab finished setup meanwhile: nothing here may reopen it (Review Focus 4).
  if (setup.stage === 'done') return data;
  return { ...data, settings: { ...data.settings, setup: { ...setup, draft: { at, answers } } } };
}

export type SaveOutcome = 'saved' | 'session' | 'failed';

export function outcomeOf(result: StoreResult, status: 'loading' | 'ready' | 'unavailable'): SaveOutcome {
  if (result.ok) return 'saved';
  // Storage never opened: the store keeps the change for this session, and its banner says so (F09).
  return status === 'unavailable' ? 'session' : 'failed';
}

/** One move at a time: Next waits for its answer to be stored, so a fast double tap can't skip a question (M22). */
export function mover(
  save: (to: PageId, answers: SetupAnswers) => Promise<SaveOutcome>,
  on: { moved: (to: PageId) => void; failed: (to: PageId, answers: SetupAnswers) => void },
): (to: PageId, answers: SetupAnswers) => Promise<SaveOutcome | undefined> {
  let busy = false;
  return async (to, answers) => {
    if (busy) return undefined;
    busy = true;
    try {
      const outcome = await save(to, answers).catch((): SaveOutcome => 'failed');
      if (outcome === 'failed') on.failed(to, answers);
      else on.moved(to);
      return outcome;
    } finally {
      busy = false;
    }
  };
}

export interface SetupSession {
  /** Setup goes on without saving: the warning stays, and the answers live here. */
  unsaved: boolean;
  /** "Start using FitStrong" without saving: the app opens for this session only. */
  entered: boolean;
  answers: SetupAnswers;
  at?: PageId;
}

const EMPTY: SetupSession = { unsaved: false, entered: false, answers: {} };
let session: SetupSession = EMPTY;
const listeners = new Set<() => void>();
const publish = (next: SetupSession) => {
  session = next;
  for (const listener of [...listeners]) listener();
};

export function useSetupSession(): SetupSession {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => session);
}
export const getSetupSession = (): SetupSession => session;

export function continueWithoutSaving(at: PageId, answers: SetupAnswers): void {
  publish({ ...session, unsaved: true, at, answers });
}
export function keepInSession(at: PageId, answers: SetupAnswers): void {
  publish({ ...session, at, answers });
}
export function enterWithoutSaving(): void {
  publish({ ...session, entered: true });
}

/** What each page held when it was left, for this session: Back never loses answers (§6.1). */
const edits = new Map<PageId, Partial<SetupAnswers>>();
export const pageEdits = (id: PageId): Partial<SetupAnswers> => edits.get(id) ?? {};
export function rememberEdits(id: PageId, next: Partial<SetupAnswers>): void {
  edits.set(id, next);
}

export function resetSetupSessionForTests(): void {
  session = EMPTY;
  edits.clear();
}
```

- [ ] **Step 4: Run it to check it passes**

Run: `npx vitest run src/setup/draft.test.ts`
Expected: PASS.

- [ ] **Step 5: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/setup/draft.ts src/setup/draft.test.ts
git commit -m "feat: Store setup's draft before every move, with a failure state and Continue without saving"
```

---
### Task 9: Setup's kit: controls, the shell, page 1 and About you

The pieces every page is drawn with. Each page view is a component of `PageProps`, so the paged first run and Me's chapter editor (Task 14) draw the same views.

Setup is wired into the app in Task 13, once every page view exists. So this task's screens are checked by eye there, and its rules by the unit tests here.

**Files:**
- Create: `src/screens/setup/titles.ts`, `src/screens/setup/controls.tsx`, `src/screens/setup/useSetup.ts`, `src/screens/setup/SetupShell.tsx`, `src/screens/setup/PageFrame.tsx`, `src/screens/setup/WelcomePage.tsx`, `src/screens/setup/pages/about.tsx`
- Modify: `src/screens/welcome/install.ts` (`installLine`, `HANDOFF`); create `src/screens/welcome/install.test.ts`
- Modify: `src/screens/welcome/focus.ts` (v2's words)
- Modify: `src/index.css` (M22)

**Interfaces:**
- Consumes:
  - Tasks 4 to 8 (graph, units, age, state, prefill, draft);
  - `ChoiceRows`, `CheckRows`, `Segmented`, `Toggle`, `TimeField`, `Notice`, `PrimaryButton`, `PlainButton` from `@/screens/you/controls`;
  - `Group`, `Row`, `Sheet`;
  - `RestoreFlow`; Plan 4's `DisplayControls` and `privacyLine`; `InstallSteps`;
  - `useReducedMotion`, and `markBack` from `@/components/hig/navigation`.
- Produces:
  - `PAGE_TITLE: Record<PageId, string>`;
  - `interface PageProps { a; set; tried; ctx; mode: 'setup' | 'edit' }`, `type PageView = ComponentType<PageProps>`;
  - `TRI`, `YES_NO`, `Missing`, `Ask`, `TriChecklist`, `TextInput`, `NumberAnswer`;
  - `useCtx()`, `useSetupAnswers()`, `useMove(): Move`;
  - `SetupShell`, `PageFrame`, `WelcomePage`;
  - `ABOUT_VIEWS: Record<'about.name' | 'about.figure' | 'about.body', PageView>`;
  - `installLine(context, device): { text: string; howTo: boolean } | undefined` and `HANDOFF: { title: string; text: string }`.

- [ ] **Step 1: Write the failing install test** `src/screens/welcome/install.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { HANDOFF, installLine } from './install';

describe('page 1’s line on keeping data here (journey §6.5; D16; B-24)', () => {
  it('in Safari on iPhone, says what installing does and doesn’t, with Show me how', () => {
    expect(installLine('iosBrowser', 'iPhone')).toEqual({ text: 'Installing helps iPhone keep your data, but it isn’t a backup.', howTo: true });
  });
  it('in any other browser, says what would delete it', () => {
    expect(installLine('desktop', 'device')).toEqual({ text: 'Clearing this browser’s data would delete it. Back up now and then.', howTo: false });
  });
  it('says nothing once installed (V-J37)', () => {
    expect(installLine('installed', 'iPhone')).toBeUndefined();
  });
  it('offers the move to the Home Screen app with a backup (A-27; B-24)', () => {
    expect(HANDOFF).toEqual({
      title: 'Moving to the Home Screen app?',
      text: 'Make a backup first, then restore it there. Safari may remove data from websites you haven’t opened for a while.',
    });
  });
});
```

Run: `npx vitest run src/screens/welcome/install.test.ts`
Expected: FAIL. `installLine` isn't exported.

- [ ] **Step 2: The install line.** Append to `src/screens/welcome/install.ts`:

```ts
/** Page 1's line on keeping data here (journey §6.5; D16, B-24), or nothing once installed. */
export function installLine(context: InstallContext, device: string): { text: string; howTo: boolean } | undefined {
  if (context === 'installed') return undefined;
  if (context === 'iosBrowser') return { text: `Installing helps ${device} keep your data, but it isn’t a backup.`, howTo: true };
  return { text: 'Clearing this browser’s data would delete it. Back up now and then.', howTo: false };
}

/** The end of setup in Safari (A-27, board D84): the Home Screen app starts empty, so it moves with a backup. */
export const HANDOFF = {
  title: 'Moving to the Home Screen app?',
  text: 'Make a backup first, then restore it there. Safari may remove data from websites you haven’t opened for a while.',
} as const;
```

Run: `npx vitest run src/screens/welcome/install.test.ts`
Expected: PASS.

- [ ] **Step 3: The focus choices in v2's words** (journey §6.2 ch. 6). Replace `src/screens/welcome/focus.ts` with:

```ts
import type { UserSettings } from '@/types';

export type Focus = NonNullable<UserSettings['focus']>;

export interface FocusChoice {
  value: Focus;
  label: string;
  detail: string;
}

/**
 * "What would you most like to do?" (journey §6.2 ch. 6, K-20): setup's
 * movement page, and its line in Profile & health's "Your movement". The
 * words describe what the app will lead with, not who the person is.
 */
export const FOCUS_CHOICES: readonly FocusChoice[] = [
  { value: 'stretch', label: 'Stretch more', detail: 'Short, gentle routines for your back and hips.' },
  { value: 'move', label: 'Walk more', detail: 'Walks and everyday movement, at your own pace.' },
  { value: 'strength', label: 'Get stronger', detail: 'A guided programme that looks after your back.' },
  { value: 'explore', label: 'Not sure yet', detail: 'Look around before you choose.' },
];
```

- [ ] **Step 4: The page titles** `src/screens/setup/titles.ts`

```ts
import type { PageId } from '@/types/setup';

/** Each page's heading: the h1 one page at a time, the h2 in Me's chapter editor (journey §6.2). */
export const PAGE_TITLE: Record<PageId, string> = {
  'welcome.start': 'Welcome',
  'about.name': 'What should we call you?',
  'about.figure': 'Body for the exercise demos',
  'about.body': 'Your height and weight',
  'health.conditions': 'Do you have any of these?',
  'health.diabetes': 'Which type of diabetes?',
  'health.bp': 'High blood pressure',
  'health.fluid': 'Heart, kidneys and fluids',
  'health.eyes': 'Your eyes',
  'health.feet': 'Your feet',
  'health.limits': 'Exercise limits from a clinician',
  'medicines.regular': 'Your medicines',
  'medicines.which': 'Do any of these apply?',
  'medicines.lows': 'Insulin and lows',
  'medicines.ketones': 'Ketones',
  'medicines.standing': 'Standing up',
  'medicines.monitors': 'What do you have at home?',
  'backFeet.where': 'Where does it hurt?',
  'backFeet.side': 'Your back and leg',
  'backFeet.history': 'Nerves and feet',
  'movement.focus': 'What would you most like to do?',
  'movement.goal': 'Your weekly goal',
  'movement.programme': 'Join the 12-week strength programme?',
  'food.pattern': 'How do you eat?',
  'food.logging': 'Would you like to log what you eat?',
  'day.reminders': 'Reminders',
  'day.meals': 'When do you usually finish your meals?',
  'day.voice': 'Your voice coach',
  'review': 'Here’s what we’ll do for you',
};
```

- [ ] **Step 5: The controls** `src/screens/setup/controls.tsx`

```tsx
import { useId, useState, type ComponentType, type ReactNode } from 'react';
import { CheckIcon } from 'lucide-react';
import { Group } from '@/components/hig/List';
import { ChoiceRows, type Choice } from '@/screens/you/controls';
import { cn } from '@/lib/utils';
import type { Ctx } from '@/setup/graph';
import { numberFrom } from '@/setup/units';
import type { SetupAnswers, Tri } from '@/types/setup';

/** What every page view is given: the paged first run and Me's chapter editor draw the same views (board D75). */
export interface PageProps {
  /** The answers so far, this page's changes included. */
  a: SetupAnswers;
  /** Change this page's answers. Stored only by Next or Save. */
  set: (patch: Partial<SetupAnswers>) => void;
  /** Next or Save was pressed with this page unanswered: say what's missing. */
  tried: boolean;
  ctx: Ctx;
  /** One page at a time in setup, or one under another in Me. */
  mode: 'setup' | 'edit';
}
export type PageView = ComponentType<PageProps>;

export const TRI: Choice<Tri>[] = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unsure', label: 'Not sure' }];
export const YES_NO: Choice<'yes' | 'no'>[] = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }];

/** What's missing, said where it's missing, once Next or Save was pressed. */
export function Missing({ show, children = 'Choose one to carry on.' }: { show: boolean; children?: string }) {
  return show ? <p role="alert" className="px-4 pt-1.5 text-[length:var(--text-subhead)] leading-snug text-stop">{children}</p> : null;
}

/** One question, its answers as rows. The radio group is named by the question (B-08: one question). */
export function Ask<T extends string>({ label, header, options, value, onChange, tried, footer }: {
  label: string;
  /** Shown above the rows when the page asks more than this one question. */
  header?: string;
  options: Choice<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  tried: boolean;
  footer?: string;
}) {
  return (
    <div className="flex flex-col">
      <Group header={header} footer={footer}>
        <ChoiceRows label={label} options={options} value={value} onChange={onChange} />
      </Group>
      <Missing show={tried && value === undefined} />
    </div>
  );
}

function CheckButton({ checked, onClick, label, className, children }: {
  checked: boolean; onClick: () => void; label: string; className?: string; children: ReactNode;
}) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onClick}
      className={cn('press-feedback flex min-h-[3.25rem] items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-muted/60', className)}>
      <span className="min-w-0 flex-1">{children}</span>
      <CheckIcon className={cn('size-5 shrink-0 text-tint', !checked && 'invisible')} strokeWidth={2.4} aria-hidden />
    </button>
  );
}

/**
 * A checklist answered as one question (B-08): tick what applies, or "Not
 * sure" on a row, or the last row for all of them. Rows left unticked are No
 * once the page is stored (`commitPage`).
 */
export function TriChecklist<K extends string>({ label, rows, value, onChange, all, tried }: {
  label: string;
  rows: readonly { id: K; label: string; detail?: string }[];
  value: Partial<Record<K, Tri>> | undefined;
  onChange: (next: Partial<Record<K, Tri>>) => void;
  /** "None of these" (every row No) or "Not sure about any of these" (every row Not sure). */
  all: { label: string; to: Tri };
  tried: boolean;
}) {
  const v: Partial<Record<K, Tri>> = value ?? {};
  const allOn = rows.every(r => v[r.id] === all.to);
  const flip = (id: K, to: Tri) => onChange({ ...v, [id]: v[id] === to ? 'no' : to });
  const answered = rows.some(r => v[r.id] === 'yes' || v[r.id] === 'unsure') || rows.every(r => v[r.id] === 'no');
  return (
    <div className="flex flex-col">
      <div role="group" aria-label={label} className="overflow-hidden rounded-xl bg-grouped-card [&>*+*]:border-t [&>*+*]:border-separator">
        {rows.map(r => (
          <div key={r.id} className="flex flex-wrap items-stretch">
            <CheckButton checked={v[r.id] === 'yes'} onClick={() => flip(r.id, 'yes')} label={r.label} className="min-w-[12rem] flex-1">
              <span className="block text-[length:var(--text-body)] leading-snug">{r.label}</span>
              {r.detail && <span className="block text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{r.detail}</span>}
            </CheckButton>
            <CheckButton checked={v[r.id] === 'unsure'} onClick={() => flip(r.id, 'unsure')} label={`Not sure: ${r.label}`} className="border-l border-separator">
              <span className="text-[length:var(--text-subhead)]">Not sure</span>
            </CheckButton>
          </div>
        ))}
        <CheckButton checked={allOn} onClick={() => onChange(allOn ? {} : Object.fromEntries(rows.map(r => [r.id, all.to])) as Partial<Record<K, Tri>>)} label={all.label}>
          <span className="text-[length:var(--text-body)] leading-snug">{all.label}</span>
        </CheckButton>
      </div>
      <Missing show={tried && !answered}>{`Tick what applies, or “${all.label}”.`}</Missing>
    </div>
  );
}

/** A text field with its label beside it; at large text the field goes under the label (D-10). */
export function TextInput({ label, text, onText, inputMode = 'text', placeholder, autoComplete = 'off', hint }: {
  label: string;
  text: string;
  onText: (text: string) => void;
  inputMode?: 'text' | 'numeric' | 'decimal';
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
}) {
  const id = useId();
  const hintId = useId();
  return (
    <div className="flex flex-col">
      <div className="flex min-h-[3.25rem] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5">
        <label htmlFor={id} className="min-w-0 flex-1 basis-40 text-[length:var(--text-body)] leading-snug">{label}</label>
        <input id={id} value={text} inputMode={inputMode} placeholder={placeholder} autoComplete={autoComplete}
          {...(hint ? { 'aria-describedby': hintId } : {})}
          onChange={e => onText(e.target.value)}
          className="numeric min-h-11 w-full max-w-[12rem] rounded-lg bg-muted/60 px-3 text-[length:var(--text-body)] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-tint/40" />
      </div>
      {hint && <p id={hintId} className="px-4 pb-2 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** A number answer, kept as typed: "1", "19" and "195" on the way to "1958" (J02). It's checked at Next or Save. */
export function NumberAnswer({ label, value, onChange, placeholder, decimals = false, hint }: {
  label: string;
  value: number | undefined;
  onChange: (n: number | undefined) => void;
  placeholder?: string;
  decimals?: boolean;
  hint?: string;
}) {
  const [text, setText] = useState(value === undefined || !Number.isFinite(value) ? '' : String(value));
  return (
    <TextInput label={label} text={text} inputMode={decimals ? 'decimal' : 'numeric'} placeholder={placeholder} hint={hint}
      onText={t => { setText(t); onChange(numberFrom(t)); }} />
  );
}
```

- [ ] **Step 6: Setup's hooks** `src/screens/setup/useSetup.ts`

```ts
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getState, update, useStore } from '@/store/useStore';
import { continueWithoutSaving, getSetupSession, keepInSession, mover, outcomeOf, useSetupSession, withDraft } from '@/setup/draft';
import { hrefOf, type Ctx } from '@/setup/graph';
import { prefillAnswers } from '@/setup/prefill';
import { setupStateOf } from '@/setup/state';
import type { PageId, SetupAnswers, SetupState } from '@/types/setup';

/** This year, for the birth-year check, read when the page draws. */
export const useCtx = (): Ctx => ({ thisYear: new Date().getFullYear() });

/**
 * The answers setup has: this session's when it goes on without saving, else
 * the stored draft's, else what the record already says (K-57, §6.4).
 */
export function useSetupAnswers(): { answers: SetupAnswers; at: PageId | undefined; setup: SetupState } {
  const { settings, profile } = useStore();
  const session = useSetupSession();
  const setup = setupStateOf(settings, profile);
  if (session.unsaved) return { answers: session.answers, at: session.at, setup };
  return { answers: setup.draft?.answers ?? prefillAnswers(settings, profile), at: setup.draft?.at, setup };
}

export interface Move {
  /** Store the draft, then go to `to` (M22). `state` goes with the navigation. */
  go: (to: PageId, answers: SetupAnswers, state?: Record<string, unknown>) => void;
  /** The last store was refused: the page stays, with its answers (§6.1). */
  failed: boolean;
  retry: () => void;
  /** B-07: go on, keeping the answers in this session only. */
  continueUnsaved: () => void;
}

export function useMove(): Move {
  const navigate = useNavigate();
  const [failed, setFailed] = useState<{ to: PageId; answers: SetupAnswers }>();
  const state = useRef<Record<string, unknown> | undefined>(undefined);
  const run = useMemo(() => mover(
    async (to, answers) => {
      if (getSetupSession().unsaved) {
        keepInSession(to, answers);
        return 'session';
      }
      return outcomeOf(await update(d => withDraft(d, to, answers)), getState().status);
    },
    {
      moved: to => { setFailed(undefined); navigate(hrefOf(to), state.current ? { state: state.current } : undefined); },
      failed: (to, answers) => setFailed({ to, answers }),
    },
  ), [navigate]);
  return {
    go: (to, answers, next) => { state.current = next; void run(to, answers); },
    failed: failed !== undefined,
    retry: () => { if (failed) void run(failed.to, failed.answers); },
    continueUnsaved: () => {
      if (!failed) return;
      continueWithoutSaving(failed.to, failed.answers);
      setFailed(undefined);
      navigate(hrefOf(failed.to), state.current ? { state: state.current } : undefined);
    },
  };
}
```

- [ ] **Step 7: The shell** `src/screens/setup/SetupShell.tsx`

```tsx
import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeftIcon } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';
import { useSetupSession } from '@/setup/draft';
import { PlainButton, PrimaryButton } from '@/screens/you/controls';
import { useSetupAnswers, type Move } from './useSetup';

/** The glass capsule: the chapter and how far along setup is; its fill moves on with each page (M22). */
function Capsule({ label, fraction }: { label: string; fraction: number }) {
  return (
    <div role="progressbar" aria-label="Setup" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)} aria-valuetext={label}
      className="glass relative min-h-9 min-w-0 flex-1 overflow-hidden rounded-full px-3 text-center">
      <span aria-hidden className="setup-capsule-fill absolute inset-y-0 left-0 bg-tint/15" style={{ width: `${Math.round(fraction * 100)}%` }} />
      <span className="relative block truncate text-[length:var(--text-footnote)] font-semibold leading-9">{label}</span>
    </div>
  );
}

/** A refused store (§6.1, B-07): the answers stay on screen, with the two ways on. */
function SaveFailed({ move }: { move: Move }) {
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-xl bg-caution/10 p-4">
      <p className="text-[length:var(--text-body)] font-semibold leading-snug">Your answers aren’t being saved on this phone.</p>
      <p className="text-[length:var(--text-subhead)] leading-snug">They’re still here. Try again, or carry on without saving: then they’re kept only until you close FitStrong.</p>
      <PrimaryButton onClick={move.retry}>Try again</PrimaryButton>
      <PlainButton onClick={move.continueUnsaved}>Continue without saving</PlainButton>
    </div>
  );
}

/**
 * Every setup page's frame (journey §6.1, M22): Back, the capsule, Close once
 * the app is open behind it, the heading, "Welcome back" on resuming, the
 * warning while unsaved, and a refused store. The page is named
 * `setup-page` for its own view transition; under Reduce Motion it fades in.
 */
export function SetupShell({ title, capsule, onBack, move, children }: {
  title: string;
  capsule?: { label: string; fraction: number };
  onBack?: () => void;
  move?: Move;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSetupSession();
  const { setup } = useSetupAnswers();
  const reduced = useReducedMotion();
  const heading = useRef<HTMLHeadingElement>(null);
  const welcomeBack = (location.state as { welcomeBack?: boolean } | null)?.welcomeBack === true;
  // After "Look around first", or unsaved and entered, Home is behind setup and Close goes back to it.
  const canClose = setup.stage === 'lookAround' || session.entered;
  // A new page is announced by its heading, as a new screen is.
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [title]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div data-setup-nav className="flex min-h-12 items-center gap-2">
        {onBack
          ? (
            <button type="button" onClick={onBack} className="press-feedback flex min-h-12 min-w-12 items-center gap-0.5 pr-2 text-[length:var(--text-body)] text-tint">
              <ChevronLeftIcon className="size-6" aria-hidden />Back
            </button>
          )
          : <span className="min-w-12" aria-hidden />}
        {capsule ? <Capsule {...capsule} /> : <span className="flex-1" aria-hidden />}
        {canClose
          ? <button type="button" onClick={() => navigate('/home')} className="press-feedback min-h-12 min-w-12 px-2 text-[length:var(--text-body)] text-tint">Close</button>
          : <span className="min-w-12" aria-hidden />}
      </div>
      <div key={title} style={{ viewTransitionName: 'setup-page' }} className={cn('flex flex-1 flex-col gap-5', reduced && 'setup-page-fade')}>
        <h1 ref={heading} tabIndex={-1} className="text-[length:var(--text-large-title)] font-bold leading-tight outline-none">{title}</h1>
        {welcomeBack && <p role="status" className="text-[length:var(--text-body)] leading-snug text-muted-foreground">Welcome back, let’s carry on.</p>}
        {session.unsaved && (
          <p role="status" className="rounded-xl bg-caution/10 p-4 text-[length:var(--text-body)] leading-snug">
            Your answers aren’t being saved on this phone. If you close FitStrong, they’re lost.
          </p>
        )}
        {children}
        {move?.failed && <SaveFailed move={move} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: One page at a time** `src/screens/setup/PageFrame.tsx`

```tsx
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { markBack } from '@/components/hig/navigation';
import { pageEdits, rememberEdits } from '@/setup/draft';
import { capsuleOf, commitPage, hrefOf, nextFromReview, nextPage, pageDef, pageDone, prevPage } from '@/setup/graph';
import { PlainButton, PrimaryButton } from '@/screens/you/controls';
import type { PageId, SetupAnswers } from '@/types/setup';
import type { PageView } from './controls';
import { SetupShell } from './SetupShell';
import { PAGE_TITLE } from './titles';
import { useCtx, useMove, useSetupAnswers } from './useSetup';

/**
 * A setup page (journey §6.1): its view, then Next, which stores the answers
 * before moving (M22), and "Skip for now" on a preference page only. Back
 * keeps what the page held, for this session (§6.1). Opened from Review's
 * Edit, Next walks that chapter and then returns to Review.
 */
export function PageFrame({ id, View }: { id: PageId; View: PageView }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { answers } = useSetupAnswers();
  const move = useMove();
  const ctx = useCtx();
  const [edits, setEdits] = useState<Partial<SetupAnswers>>(() => pageEdits(id));
  const [tried, setTried] = useState(false);
  const a: SetupAnswers = { ...answers, ...edits };
  const fromReview = (location.state as { fromReview?: boolean } | null)?.fromReview === true;
  const carry = fromReview ? { fromReview: true } : undefined;
  const after = (stored: SetupAnswers) => (fromReview ? nextFromReview(stored, id, ctx) : nextPage(stored, id));

  const set = (patch: Partial<SetupAnswers>) => setEdits(e => {
    const next = { ...e, ...patch };
    rememberEdits(id, next);
    return next;
  });

  const next = () => {
    const stored = commitPage(id, a);
    if (!pageDone(id, stored, ctx)) {
      setTried(true);
      return;
    }
    // Answering a page takes it off the skipped list.
    const toStore = { ...stored, skippedPages: (stored.skippedPages ?? []).filter(p => p !== id) };
    move.go(after(toStore), toStore, carry);
  };

  const skip = () => {
    rememberEdits(id, {});
    const toStore = { ...answers, skippedPages: [...new Set([...(answers.skippedPages ?? []), id])] };
    move.go(after(toStore), toStore, carry);
  };

  const back = () => {
    const prev = prevPage(a, id);
    markBack();
    navigate(prev && prev !== 'welcome.start' ? hrefOf(prev) : '/setup', { replace: true, state: { back: true, ...carry } });
  };

  return (
    <SetupShell title={PAGE_TITLE[id]} capsule={capsuleOf(id, answers)} onBack={back} move={move}>
      <View a={a} set={set} tried={tried} ctx={ctx} mode="setup" />
      <div className="mt-auto flex flex-col gap-2 pt-2">
        <PrimaryButton className="min-h-[3.75rem]" onClick={next}>Next</PrimaryButton>
        {pageDef(id).skippable && <PlainButton onClick={skip}>Skip for now</PlainButton>}
      </div>
    </SetupShell>
  );
}
```

- [ ] **Step 9: Page 1** `src/screens/setup/WelcomePage.tsx`

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TypeIcon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { getState, update } from '@/store/useStore';
import { lookedAround } from '@/setup/assemble';
import { resumeAt } from '@/setup/graph';
import { InstallSteps } from '@/screens/welcome/InstallSteps';
import { deviceNoun, installContext, installLine, readInstallEnv } from '@/screens/welcome/install';
import { DisplayControls } from '@/screens/you/DisplayScreen';
import { RestoreFlow } from '@/screens/you/RestoreFlow';
import { Notice, PlainButton, PrimaryButton } from '@/screens/you/controls';
import { privacyLine } from '@/screens/you/summaries';
import { SetupShell } from './SetupShell';
import { useCtx, useMove, useSetupAnswers } from './useSetup';

/**
 * Setup's page 1 (journey §6.2 ch. 1, §6.4, §6.5): what the app is, where the
 * record is kept, and three ways on: Get started, Restore from a backup, and
 * Look around first. Display is here (A-66). The install line comes before
 * any answer, so a Safari user can move first (D16).
 */
export function WelcomePage() {
  const navigate = useNavigate();
  const { answers, at } = useSetupAnswers();
  const move = useMove();
  const ctx = useCtx();
  const [{ context, device }] = useState(() => {
    const env = readInstallEnv();
    return { context: installContext(env), device: deviceNoun(env) };
  });
  const [sheet, setSheet] = useState<'display' | 'install'>();
  const [problem, setProblem] = useState<string>();
  const line = installLine(context, device);

  // A draft carries on where it stopped; otherwise the first question.
  const start = () => move.go(at && at !== 'welcome.start' ? resumeAt(answers, at, ctx) : 'about.name', answers);

  const lookAround = async () => {
    // Held until stored: it opens Home, and a refusal must leave the person here, where it is said (D-04).
    const saved = await update(lookedAround, { hold: true });
    if (saved.ok || getState().status === 'unavailable') navigate('/home', { replace: true });
    else setProblem(`That did not save. ${saved.failure.message}`);
  };

  return (
    <SetupShell title="Welcome" move={move}>
      <p className="text-[length:var(--text-title-2)] font-semibold leading-snug">Your health, in one place.</p>
      <p className="text-[length:var(--text-body)] leading-snug">{privacyLine(device)}</p>
      {line && (
        <Group>
          <Row
            label={line.text}
            {...(line.howTo ? {
              accessory: (
                <button type="button" onClick={() => setSheet('install')} className="press-feedback min-h-12 shrink-0 px-2 text-[length:var(--text-body)] font-medium text-tint">
                  Show me how
                </button>
              ),
            } : {})}
          />
        </Group>
      )}
      <Group>
        <Row onClick={() => setSheet('display')} icon={<TypeIcon />} label="Display" detail="Text size, Reduce motion, Reduce transparency" chevron />
      </Group>
      <div className="mt-auto flex flex-col gap-2">
        <PrimaryButton className="min-h-[3.75rem]" onClick={start}>Get started</PrimaryButton>
        <RestoreFlow
          place="welcome"
          {...(context === 'iosBrowser'
            ? { note: 'You are in Safari, and a backup restored here stays in Safari. To keep it, add the app to your Home Screen and restore it there.' }
            : {})}
          trigger={pick => <PlainButton onClick={pick}>Restore from a backup</PlainButton>}
        />
        <PlainButton onClick={() => void lookAround()}>Look around first</PlainButton>
        {problem && <Notice tone="error">{problem}</Notice>}
      </div>
      <Sheet open={sheet === 'display'} onOpenChange={open => setSheet(open ? 'display' : undefined)} title="Display" detent="large">
        <DisplayControls />
      </Sheet>
      <Sheet open={sheet === 'install'} onOpenChange={open => setSheet(open ? 'install' : undefined)} title="Add FitStrong to your Home Screen" detent="large">
        <InstallSteps device={device} />
      </Sheet>
    </SetupShell>
  );
}
```

`RestoreFlow` restores the file whole. A finished backup sets `onboardingComplete`, so the app opens Home. A file with a draft leaves page 1 where it is; `Get started` then carries on at the draft's page, with "Welcome back, let’s carry on." (Task 13 Step 6, V-J11, V-J37).

- [ ] **Step 10: About you's pages** `src/screens/setup/pages/about.tsx`

```tsx
import { useState } from 'react';
import { Group } from '@/components/hig/List';
import { Segmented } from '@/screens/you/controls';
import { convertWeightText, weightFieldText } from '@/components/profile/wizardSteps';
import { asksAdult, birthYearProblem } from '@/setup/age';
import { heightFrom, heightProblem, heightText, waistFrom, waistProblem, waistText, weightFrom, weightProblem, type HeightText } from '@/setup/units';
import { Ask, Missing, NumberAnswer, TextInput, YES_NO, type PageProps, type PageView } from '../controls';

function Name({ a, set, tried, ctx }: PageProps) {
  const problem = birthYearProblem(a.birthYear, ctx.thisYear);
  return (
    <>
      <Group footer="Shown on screen only. The voice coach never says it.">
        <TextInput label="Name (optional)" text={a.name ?? ''} onText={name => set({ name })} autoComplete="given-name" />
      </Group>
      <Group footer="Some advice changes with age.">
        <NumberAnswer label="Year you were born (optional)" placeholder="1958" value={a.birthYear} onChange={birthYear => set({ birthYear })} />
      </Group>
      <Missing show={tried && problem !== null}>{problem ?? ''}</Missing>
      {asksAdult(a.birthYear, ctx.thisYear) && (
        <>
          <Ask label="Are you 18 or over?" header="Are you 18 or over?" options={YES_NO}
            value={a.adult === undefined ? undefined : a.adult ? 'yes' : 'no'} onChange={v => set({ adult: v === 'yes' })} tried={tried} />
          <Missing show={a.adult === false}>FitStrong is made for adults aged 18 and over.</Missing>
        </>
      )}
    </>
  );
}

function Figure({ a, set, tried }: PageProps) {
  return (
    <Ask label="Body for the exercise demos" tried={tried} value={a.figure} onChange={figure => set({ figure })}
      options={[{ value: 'male', label: 'Male figure' }, { value: 'female', label: 'Female figure' }, { value: 'either', label: 'Either' }]}
      footer="Only the figure in the exercise demos. Nothing else is worked out from it." />
  );
}

function Body({ a, set, tried }: PageProps) {
  // What was stored when the page opened: a field still showing it keeps it exactly, in either unit (Review Focus 2).
  const [stored] = useState(() => ({ height: a.heightCm, weight: a.weightKg, waist: a.waistCm }));
  const metric = a.metric ?? true;
  const [height, setHeight] = useState<HeightText>(() => heightText(a.heightCm, metric));
  const [weight, setWeight] = useState(() => weightFieldText(a.weightKg, metric));
  const [waist, setWaist] = useState(() => waistText(a.waistCm, metric));

  const switchUnits = (to: boolean) => {
    if (to === metric) return;
    const cm = heightFrom(height, metric, stored.height);
    const wc = waistFrom(waist, metric, stored.waist);
    setHeight(heightText(cm, to));
    setWeight(convertWeightText(weight, to));
    setWaist(waistText(wc, to));
    set({ metric: to });
  };
  const changeHeight = (next: HeightText) => { setHeight(next); set({ heightCm: heightFrom(next, metric, stored.height) }); };
  const problem = heightProblem(a.heightCm) ?? weightProblem(a.weightKg);
  const waistIssue = waistProblem(a.waistCm);

  return (
    <>
      <div className="px-1">
        <Segmented label="Units" value={metric ? 'metric' : 'imperial'} onChange={v => switchUnits(v === 'metric')}
          options={[{ value: 'metric', label: 'cm and kg' }, { value: 'imperial', label: 'ft, in and lb' }]} />
      </div>
      <Group footer="Optional. Each one you give is kept as a dated reading.">
        {metric
          ? <TextInput label="Height in cm" inputMode="decimal" text={height.cm} onText={cm => changeHeight({ ...height, cm })} placeholder="160" />
          : (
            <>
              <TextInput label="Height, feet" inputMode="numeric" text={height.ft} onText={ft => changeHeight({ ...height, ft })} placeholder="5" />
              <TextInput label="Height, inches" inputMode="numeric" text={height.inch} onText={inch => changeHeight({ ...height, inch })} placeholder="3" />
            </>
          )}
        <TextInput label={metric ? 'Weight in kg' : 'Weight in lb'} inputMode="decimal" text={weight}
          onText={t => { setWeight(t); set({ weightKg: weightFrom(t, metric, stored.weight) }); }} placeholder={metric ? '65' : '143'} />
      </Group>
      <Missing show={tried && problem !== null}>{problem ?? ''}</Missing>
      <details className="overflow-hidden rounded-xl bg-grouped-card">
        <summary className="press-feedback flex min-h-12 cursor-pointer items-center px-4 text-[length:var(--text-body)]">Waist (optional)</summary>
        <TextInput label={metric ? 'Waist in cm' : 'Waist in inches'} inputMode="decimal" text={waist}
          onText={t => { setWaist(t); set({ waistCm: waistFrom(t, metric, stored.waist) }); }} placeholder={metric ? '85' : '34'} />
        <p className="px-4 pb-3 text-[length:var(--text-subhead)] leading-snug text-muted-foreground">
          How to measure: stand up, breathe out normally, and measure around your middle at the level of your belly button.
        </p>
      </details>
      <Missing show={tried && waistIssue !== null}>{waistIssue ?? ''}</Missing>
    </>
  );
}

export const ABOUT_VIEWS: Record<'about.name' | 'about.figure' | 'about.body', PageView> = {
  'about.name': Name,
  'about.figure': Figure,
  'about.body': Body,
};
```

- [ ] **Step 11: M22's page change.** In `src/index.css`, after the "Page transitions" block (after the `:root[data-reduce-motion]::view-transition-old(root)` rule), add:

```css
/* Setup's pages (M22): the incoming page slides 30% in from the trailing
   edge and fades in, the outgoing one moves 30% the other way and fades, and
   Back reverses both. The rest of the frame stays put: setup sets
   data-task="setup" on <html>, and its own layer, setup-page, moves. The
   spring's easing and length are set on <html> from design/motion.ts. */
@keyframes setup-in-trailing { from { opacity: 0; transform: translate3d(30%, 0, 0); } }
@keyframes setup-out-leading { to { opacity: 0; transform: translate3d(-30%, 0, 0); } }
@keyframes setup-in-leading { from { opacity: 0; transform: translate3d(-30%, 0, 0); } }
@keyframes setup-out-trailing { to { opacity: 0; transform: translate3d(30%, 0, 0); } }

@media (prefers-reduced-motion: no-preference) {
  :root[data-task="setup"]::view-transition-old(root),
  :root[data-task="setup"]::view-transition-new(root) {
    animation: none;
  }
  ::view-transition-old(setup-page) {
    animation: setup-out-leading var(--setup-ms, 588ms) var(--setup-ease, var(--ease-out-quart)) both;
  }
  ::view-transition-new(setup-page) {
    animation: setup-in-trailing var(--setup-ms, 588ms) var(--setup-ease, var(--ease-out-quart)) both;
  }
  :root[data-nav="back"]::view-transition-old(setup-page) { animation-name: setup-out-trailing; }
  :root[data-nav="back"]::view-transition-new(setup-page) { animation-name: setup-in-leading; }
  .setup-capsule-fill { transition: width var(--setup-ms, 588ms) var(--setup-ease, var(--ease-out-quart)); }
}

/* Under Reduce Motion pages change with a fade (M22 RM; motion rule 4: reduced
   motion replaces, it doesn't delete). The navigation runs no transition
   then, so the arriving page fades itself in; the rule further down that
   cuts every animation to nothing is overridden for this one. */
.setup-page-fade { animation: fs-fade-in 200ms linear both; }
@media (prefers-reduced-motion: reduce) {
  .setup-page-fade { animation: fs-fade-in 200ms linear both !important; }
}
```

- [ ] **Step 12: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/setup src/screens/welcome/install.ts src/screens/welcome/install.test.ts src/screens/welcome/focus.ts src/index.css
git commit -m "feat: Build setup's controls, shell, first page and About you"
```

`tsc` may report `src/screens/welcome/FocusStep.tsx` or `assemble.ts` still importing `Focus` from `./assemble`. Both are deleted in Task 13; until then, change their import to `import type { Focus } from './focus'`.

---

### Task 10: Your health, Your medicines, and Your back and feet

The pages that set the engine's safety inputs. Each asks exactly what §6.3's corrected crosswalk lists (D76), in the words below. The radio groups and checkboxes are named by their questions, which the acceptance helper (Task 16) answers by.

**Files:**
- Create: `src/screens/setup/pages/health.tsx`, `src/screens/setup/pages/medicines.tsx`, `src/screens/setup/pages/backFeet.tsx`

**Interfaces:**
- Consumes: Task 9's controls; `factsOf`; `metforminYearProblem`; `CheckRows`, `Segmented`.
- Produces:
  - `HEALTH_VIEWS: Record<'health.conditions' | 'health.diabetes' | 'health.bp' | 'health.fluid' | 'health.eyes' | 'health.feet' | 'health.limits', PageView>`;
  - `MEDICINES_VIEWS: Record<'medicines.regular' | 'medicines.which' | 'medicines.lows' | 'medicines.ketones' | 'medicines.standing' | 'medicines.monitors', PageView>`;
  - `BACK_FEET_VIEWS: Record<'backFeet.where' | 'backFeet.side' | 'backFeet.history', PageView>`;
  - `CONDITION_ROWS` and `CLASS_ROWS`: each row's label, which Review and the acceptance helper also use.

- [ ] **Step 1: Your health** `src/screens/setup/pages/health.tsx`

```tsx
import { useState } from 'react';
import { Group } from '@/components/hig/List';
import { factsOf } from '@/setup/facts';
import { pageDone } from '@/setup/graph';
import { numberFrom } from '@/setup/units';
import type { ConditionId } from '@/types/setup';
import { Ask, Missing, NumberAnswer, TRI, TextInput, TriChecklist, YES_NO, type PageProps, type PageView } from '../controls';

export const CONDITION_ROWS: readonly { id: ConditionId; label: string }[] = [
  { id: 'diabetes', label: 'Diabetes' },
  { id: 'bp', label: 'High blood pressure' },
  { id: 'heart', label: 'Heart or circulation problems' },
  { id: 'kidney', label: 'Kidney disease' },
  { id: 'eyes', label: 'Eye problems from diabetes, or eye treatment in the last 3 months' },
  { id: 'feet', label: 'Foot problems: numbness, a wound or an ulcer' },
  { id: 'pain', label: 'Back pain, sciatica or other pain' },
  { id: 'other', label: 'Something else that affects exercise' },
];

function Conditions({ a, set, tried }: PageProps) {
  return (
    <>
      <p className="px-1 text-[length:var(--text-body)] leading-snug">Tick what applies. “Not sure” is a real answer: the app then plays safe.</p>
      <TriChecklist label="Do you have any of these?" rows={CONDITION_ROWS} value={a.conditions} onChange={conditions => set({ conditions })}
        all={{ label: 'None of these', to: 'no' }} tried={tried} />
    </>
  );
}

function DiabetesType({ a, set, tried }: PageProps) {
  return (
    <Ask label="Which type of diabetes?" tried={tried} value={a.diabetesType} onChange={diabetesType => set({ diabetesType })}
      options={[
        { value: 'type1', label: 'Type 1' }, { value: 'type2', label: 'Type 2' }, { value: 'prediabetes', label: 'Prediabetes' },
        { value: 'other', label: 'Another type' }, { value: 'unsure', label: 'Not sure' },
      ]} />
  );
}

function Bp({ a, set, tried }: PageProps) {
  return (
    <Ask label="Do you take medicine for high blood pressure?" header="Do you take medicine for high blood pressure?" options={TRI}
      value={a.bpMedicine} onChange={bpMedicine => set({ bpMedicine })} tried={tried} />
  );
}

function Fluid({ a, set, tried }: PageProps) {
  return (
    <>
      {factsOf(a).kidney && (
        <Ask label="Are you on dialysis, or have you had a kidney transplant?" header="Are you on dialysis, or have you had a kidney transplant?"
          options={YES_NO} value={a.kidneyTreatment} onChange={kidneyTreatment => set({ kidneyTreatment })} tried={tried} />
      )}
      <Ask label="Has a doctor given you a fluid limit?" header="Has a doctor given you a fluid limit?" options={TRI}
        value={a.fluidLimit} onChange={fluidLimit => set({ fluidLimit })} tried={tried} footer="It changes your rest-time and water advice." />
    </>
  );
}

function Eyes({ a, set, tried }: PageProps) {
  return (
    <>
      <Ask label="Eye treatment or surgery in the last 3 months?" header="Eye treatment or surgery in the last 3 months?" options={YES_NO}
        value={a.eyeTreatment} onChange={eyeTreatment => set({ eyeTreatment })} tried={tried} />
      {a.eyeTreatment === 'no' && (
        <Ask label="How bad is the eye disease from diabetes?" header="How bad is the eye disease from diabetes?" tried={tried}
          value={a.eyeDisease} onChange={eyeDisease => set({ eyeDisease })} footer="As your eye doctor last said. “Not sure” is fine."
          options={[{ value: 'mild', label: 'Mild, or none' }, { value: 'moderate', label: 'Moderate' }, { value: 'severe', label: 'Severe' }, { value: 'unsure', label: 'Not sure' }]} />
      )}
    </>
  );
}

function Feet({ a, set, tried }: PageProps) {
  return (
    <>
      <Ask label="Numbness or loss of feeling in your feet?" header="Numbness or loss of feeling in your feet?" options={TRI}
        value={a.feetNumb} onChange={feetNumb => set({ feetNumb })} tried={tried} />
      <Ask label="A wound, an ulcer or a Charcot foot?" header="A wound, an ulcer or a Charcot foot?" tried={tried}
        value={a.footWound} onChange={footWound => set({ footWound })}
        options={[{ value: 'now', label: 'Yes, now' }, { value: 'past', label: 'In the past' }, { value: 'no', label: 'No' }]}
        footer="A wound now keeps walks off until it has healed." />
    </>
  );
}

/** Two numbers that go together, kept as typed, stored only when both are there. */
function BpPermission({ a, set }: PageProps) {
  const [sys, setSys] = useState(a.bpPermission ? String(a.bpPermission.sys) : '');
  const [dia, setDia] = useState(a.bpPermission ? String(a.bpPermission.dia) : '');
  const write = (s: string, d: string) => {
    const top = numberFrom(s);
    const bottom = numberFrom(d);
    set({ bpPermission: top === undefined || bottom === undefined ? undefined : { sys: top, dia: bottom } });
  };
  return (
    <>
      <TextInput label="Top number exercise is fine up to" inputMode="numeric" text={sys} placeholder="170" onText={t => { setSys(t); write(t, dia); }} />
      <TextInput label="Bottom number exercise is fine up to" inputMode="numeric" text={dia} placeholder="105" onText={t => { setDia(t); write(sys, t); }} />
    </>
  );
}

function Limits(props: PageProps) {
  const { a, set, tried } = props;
  const f = factsOf(a);
  const targets = f.bp || f.diabetic;
  return (
    <>
      <Ask label="Has a clinician cleared you to exercise?" header="Has a clinician cleared you to exercise?" tried={tried}
        value={a.clearance} onChange={clearance => set({ clearance })}
        options={[
          { value: 'none', label: 'Not yet' }, { value: 'moderate', label: 'Yes, for moderate exercise' },
          { value: 'vigorous', label: 'Yes, for vigorous exercise' }, { value: 'unsure', label: 'Not sure' },
        ]} />
      {targets && (
        <Ask label="Has a clinician given you any limits or targets?" header="Has a clinician given you any limits or targets?" options={TRI}
          value={a.targets} onChange={t => set({ targets: t })} tried={tried} />
      )}
      {targets && a.targets === 'yes' && (
        <Group header="Your limits and targets" footer="Only what your clinician gave you. Leave the rest empty.">
          {f.bp && <NumberAnswer label="Stop exercise if the top number is above (optional)" placeholder="180" value={a.bpStopSystolic} onChange={bpStopSystolic => set({ bpStopSystolic })} />}
          {f.bp && <BpPermission {...props} />}
          {f.diabetic && <NumberAnswer label="HbA1c target, % (optional)" decimals placeholder="7" value={a.hba1cPercent} onChange={hba1cPercent => set({ hba1cPercent })} />}
        </Group>
      )}
      <Missing show={tried && a.clearance !== undefined && (!targets || a.targets !== undefined) && !pageDone('health.limits', a, props.ctx)}>
        Check the numbers: blood pressure between 90 and 250 over 50 and 150, and HbA1c between 4 and 15.
      </Missing>
    </>
  );
}

export const HEALTH_VIEWS: Record<'health.conditions' | 'health.diabetes' | 'health.bp' | 'health.fluid' | 'health.eyes' | 'health.feet' | 'health.limits', PageView> = {
  'health.conditions': Conditions,
  'health.diabetes': DiabetesType,
  'health.bp': Bp,
  'health.fluid': Fluid,
  'health.eyes': Eyes,
  'health.feet': Feet,
  'health.limits': Limits,
};
```

`Limits`' last line shows only when its questions are answered and the page still isn't done, which is when a number is outside its range. It goes as soon as the number is put right.

- [ ] **Step 2: Your medicines** `src/screens/setup/pages/medicines.tsx`

```tsx
import { Group } from '@/components/hig/List';
import { Segmented } from '@/screens/you/controls';
import { metforminYearProblem } from '@/components/profile/wizardSteps';
import { factsOf } from '@/setup/facts';
import { pageDone } from '@/setup/graph';
import type { MedicineClass } from '@/types/setup';
import { Ask, Missing, NumberAnswer, TRI, TextInput, TriChecklist, YES_NO, type PageProps, type PageView } from '../controls';

export const CLASS_ROWS: readonly { id: MedicineClass; label: string; detail?: string }[] = [
  { id: 'insulin', label: 'Insulin' },
  { id: 'lowsTablet', label: 'A tablet that can cause lows', detail: 'Gliclazide, glimepiride, repaglinide and others' },
  { id: 'gliflozin', label: 'A “-gliflozin” medicine', detail: 'Empagliflozin, dapagliflozin and others, for diabetes, the heart or the kidneys' },
  { id: 'metformin', label: 'Metformin' },
  { id: 'betaBlocker', label: 'A beta-blocker', detail: 'Bisoprolol, metoprolol and others' },
  { id: 'diuretic', label: 'A water tablet (diuretic)' },
  { id: 'other', label: 'Something else' },
];

function Regular({ a, set, tried }: PageProps) {
  return (
    <Ask label="Do you take any regular medicines?" header="Do you take any regular medicines?" options={TRI} tried={tried}
      value={a.regular} onChange={regular => set({ regular })} footer="For any condition. Some change what’s safe before exercise." />
  );
}

function Which({ a, set, tried, ctx }: PageProps) {
  const problem = metforminYearProblem(a.metforminSince ?? '', ctx.thisYear);
  return (
    <>
      <p className="px-1 text-[length:var(--text-body)] leading-snug">Whatever they’re for. Tick each one you take.</p>
      <TriChecklist label="Do any of these apply?" rows={CLASS_ROWS} value={a.classes} onChange={classes => set({ classes })}
        all={{ label: 'Not sure about any of these', to: 'unsure' }} tried={tried} />
      {a.classes?.metformin === 'yes' && (
        <>
          <Group>
            <TextInput label="Year you started metformin (optional)" inputMode="numeric" placeholder="2019" text={a.metforminSince ?? ''}
              onText={t => set({ metforminSince: t.trim() === '' ? undefined : t.trim() })} />
          </Group>
          <Missing show={tried && problem !== null}>{problem ?? ''}</Missing>
        </>
      )}
    </>
  );
}

function Lows({ a, set, tried, ctx }: PageProps) {
  const answered = a.lowsRisk !== undefined && (!factsOf(a).insulin || a.insulinHow !== undefined);
  return (
    <>
      {factsOf(a).insulin && (
        <Ask label="How do you take insulin?" header="How do you take insulin?" tried={tried} value={a.insulinHow} onChange={insulinHow => set({ insulinHow })}
          options={[
            { value: 'basalOnly', label: 'Long-acting only' }, { value: 'multipleDaily', label: 'Several injections a day' },
            { value: 'pump', label: 'A pump' }, { value: 'closedLoop', label: 'A closed-loop system' }, { value: 'unsure', label: 'Not sure' },
          ]} />
      )}
      <Ask label="A severe low in the last 6 months, or do you often not feel lows coming?" header="A severe low in the last 6 months, or do you often not feel lows coming?"
        options={TRI} value={a.lowsRisk} onChange={lowsRisk => set({ lowsRisk })} tried={tried} />
      <Group header="Your care team’s starting glucose (optional)" footer="Only if your care team gave you one. Otherwise the app uses the usual figure for your medicines.">
        <NumberAnswer label="Lowest glucose to start exercise at" decimals value={a.glucoseStartMin} onChange={glucoseStartMin => set({ glucoseStartMin })} />
        <div className="px-4 pb-3">
          <Segmented label="Its unit" value={a.glucoseStartUnit ?? a.glucoseUnit ?? 'mg/dL'} onChange={glucoseStartUnit => set({ glucoseStartUnit })}
            options={[{ value: 'mg/dL', label: 'mg/dL' }, { value: 'mmol/L', label: 'mmol/L' }]} />
        </div>
      </Group>
      <Missing show={tried && answered && !pageDone('medicines.lows', a, ctx)}>Check the glucose number: 54 to 300 mg/dL, or 3 to 17 mmol/L.</Missing>
    </>
  );
}

function Ketones({ a, set, tried }: PageProps) {
  const f = factsOf(a);
  return (
    <>
      {f.diabetic && (
        <Ask label="Ever had diabetic ketoacidosis (DKA), or been told your body makes too little insulin?"
          header="Ever had diabetic ketoacidosis (DKA), or been told your body makes too little insulin?"
          options={TRI} value={a.priorDka} onChange={priorDka => set({ priorDka })} tried={tried} />
      )}
      {f.ketoneRisk && (
        <Ask label="Can you test ketones?" header="Can you test ketones?" tried={tried} value={a.ketoneTest} onChange={ketoneTest => set({ ketoneTest })}
          options={[{ value: 'none', label: 'No' }, { value: 'urine', label: 'Urine strips' }, { value: 'blood', label: 'Blood meter' }]}
          footer="Then each check-in can ask for a reading." />
      )}
    </>
  );
}

function Standing({ a, set, tried }: PageProps) {
  return (
    <Ask label="Do you get dizzy when you stand up?" header="Do you get dizzy when you stand up?" options={TRI} tried={tried}
      value={a.dizzy} onChange={dizzy => set({ dizzy })} footer="“Not sure” is fine: the app then plays safe." />
  );
}

function Monitors({ a, set, tried }: PageProps) {
  return (
    <>
      <Ask label="Glucose meter or sensor" header="Glucose meter or sensor" tried={tried} value={a.glucoseMonitor} onChange={glucoseMonitor => set({ glucoseMonitor })}
        options={[{ value: 'none', label: 'Neither' }, { value: 'meter', label: 'A glucose meter (finger-prick)' }, { value: 'cgm', label: 'A glucose sensor (CGM)' }]} />
      {a.glucoseMonitor !== undefined && a.glucoseMonitor !== 'none' && (
        <Ask label="Glucose unit" header="Its unit" tried={tried} value={a.glucoseUnit} onChange={glucoseUnit => set({ glucoseUnit })}
          options={[{ value: 'mg/dL', label: 'mg/dL' }, { value: 'mmol/L', label: 'mmol/L' }]} />
      )}
      <Ask label="Home blood-pressure cuff" header="Home blood-pressure cuff" options={YES_NO} tried={tried}
        value={a.bpCuff === undefined ? undefined : a.bpCuff ? 'yes' : 'no'} onChange={v => set({ bpCuff: v === 'yes' })} />
    </>
  );
}

export const MEDICINES_VIEWS: Record<'medicines.regular' | 'medicines.which' | 'medicines.lows' | 'medicines.ketones' | 'medicines.standing' | 'medicines.monitors', PageView> = {
  'medicines.regular': Regular,
  'medicines.which': Which,
  'medicines.lows': Lows,
  'medicines.ketones': Ketones,
  'medicines.standing': Standing,
  'medicines.monitors': Monitors,
};
```

`Lows`' last line, like `Limits`', shows only while the page's questions are answered and a number is still outside its range.

- [ ] **Step 3: Your back and feet** `src/screens/setup/pages/backFeet.tsx`

```tsx
import type { ReactNode } from 'react';
import { Group } from '@/components/hig/List';
import { CheckRows } from '@/screens/you/controls';
import { cn } from '@/lib/utils';
import { factsOf } from '@/setup/facts';
import type { PainArea } from '@/types/profile';
import { Ask, Missing, TRI, YES_NO, type PageProps, type PageView } from '../controls';

export const AREAS: { value: PainArea; label: string }[] = [
  { value: 'lowerBack', label: 'Lower back' }, { value: 'sciatica', label: 'Sciatica (pain down the leg)' }, { value: 'neck', label: 'Neck' },
  { value: 'shoulder', label: 'Shoulder' }, { value: 'hip', label: 'Hip' }, { value: 'knee', label: 'Knee' },
  { value: 'hamstring', label: 'Back of the thigh (hamstring)' }, { value: 'calf', label: 'Calf' },
];

/**
 * A body seen from behind, its areas tappable (journey §6.2 ch. 5). A picture
 * only: the list beside it is the control, for screen readers and for any
 * area too small to tap with confidence.
 */
function BodyPicture({ chosen, onToggle }: { chosen: readonly PainArea[]; onToggle: (area: PainArea) => void }) {
  const area = (id: PainArea, shape: ReactNode) => (
    <g key={id} onClick={() => onToggle(id)} className={cn('cursor-pointer transition-colors', chosen.includes(id) ? 'fill-tint/70' : 'fill-tint/10')}>{shape}</g>
  );
  return (
    <svg aria-hidden viewBox="0 0 120 230" className="mx-auto h-56 w-auto">
      <g className="fill-muted">
        <circle cx="60" cy="18" r="13" />
        <rect x="38" y="34" width="44" height="78" rx="14" />
        <rect x="20" y="40" width="14" height="66" rx="7" />
        <rect x="86" y="40" width="14" height="66" rx="7" />
        <rect x="40" y="108" width="18" height="110" rx="8" />
        <rect x="62" y="108" width="18" height="110" rx="8" />
      </g>
      {area('neck', <rect x="52" y="30" width="16" height="8" rx="3" />)}
      {area('shoulder', <><circle cx="38" cy="42" r="7" /><circle cx="82" cy="42" r="7" /></>)}
      {area('lowerBack', <rect x="44" y="84" width="32" height="18" rx="6" />)}
      {area('hip', <><circle cx="47" cy="112" r="7" /><circle cx="73" cy="112" r="7" /></>)}
      {area('sciatica', <rect x="42" y="120" width="5" height="62" rx="2.5" />)}
      {area('hamstring', <><rect x="49" y="124" width="8" height="34" rx="3" /><rect x="63" y="124" width="14" height="34" rx="4" /></>)}
      {area('knee', <><circle cx="49" cy="166" r="6" /><circle cx="71" cy="166" r="6" /></>)}
      {area('calf', <><rect x="43" y="176" width="12" height="30" rx="5" /><rect x="65" y="176" width="12" height="30" rx="5" /></>)}
    </svg>
  );
}

function Where({ a, set, tried }: PageProps) {
  const areas = a.painAreas;
  const toggle = (x: PainArea) => {
    const now = areas ?? [];
    set({ painAreas: now.includes(x) ? now.filter(y => y !== x) : [...now, x] });
  };
  return (
    <>
      <BodyPicture chosen={areas ?? []} onToggle={toggle} />
      <Group>
        <CheckRows label="Where does it hurt?" options={AREAS} value={areas ?? []} onChange={painAreas => set({ painAreas })} />
      </Group>
      <Group>
        <CheckRows label="None of these right now" options={[{ value: 'none', label: 'None of these right now' }]}
          value={areas !== undefined && areas.length === 0 ? ['none'] : []} onChange={v => set({ painAreas: v.length > 0 ? [] : undefined })} />
      </Group>
      <Missing show={tried && areas === undefined}>Tick where it hurts, or “None of these right now”.</Missing>
    </>
  );
}

function Side({ a, set, tried }: PageProps) {
  const sciatica = (a.painAreas ?? []).includes('sciatica');
  return (
    <>
      {sciatica && (
        <Ask label="Which leg?" header="Which leg?" tried={tried} value={a.sciaticaSide} onChange={sciaticaSide => set({ sciaticaSide })}
          options={[{ value: 'left', label: 'Left leg' }, { value: 'right', label: 'Right leg' }, { value: 'both', label: 'Both legs' }]} />
      )}
      {sciatica && a.sciaticaSide === 'both' && (
        <p role="alert" className="rounded-xl bg-stop/10 p-4 text-[length:var(--text-body)] leading-snug">
          Sciatica in both legs should be checked by a doctor promptly. If it came on suddenly, or comes with numbness around the groin or bladder or bowel changes, get emergency care.
        </p>
      )}
      <Ask label="What makes it worse?" header="What makes it worse?" tried={tried} value={a.worseWith} onChange={worseWith => set({ worseWith })}
        options={[{ value: 'flexion', label: 'Sitting or bending forward' }, { value: 'extension', label: 'Standing, walking or arching back' }, { value: 'unknown', label: 'Not sure' }]}
        footer="This sets which back stretches you start with. The app keeps learning from your check-ins." />
      <Group header="What helps? (optional)">
        <CheckRows label="What helps? (optional)" value={a.helps ?? []} onChange={helps => set({ helps })}
          options={[
            { value: 'moving', label: 'Moving about' }, { value: 'lying', label: 'Lying down' }, { value: 'heat', label: 'Heat' },
            { value: 'bendingForward', label: 'Bending forward' }, { value: 'archingBack', label: 'Arching back' },
          ]} />
      </Group>
    </>
  );
}

function History({ a, set, tried }: PageProps) {
  const f = factsOf(a);
  return (
    <>
      {f.pain && (
        <Ask label="Has a doctor ever said a nerve in your back or leg was damaged?" header="Has a doctor ever said a nerve in your back or leg was damaged?"
          options={TRI} value={a.neuroHistory} onChange={neuroHistory => set({ neuroHistory })} tried={tried} footer="For example, foot drop after sciatica." />
      )}
      {f.feet && (
        <Ask label="Has a clinician told you to keep weight off a foot?" header="Has a clinician told you to keep weight off a foot?" options={YES_NO}
          value={a.footRestriction} onChange={footRestriction => set({ footRestriction })} tried={tried}
          footer="Then walks stay off until they say it’s fine." />
      )}
    </>
  );
}

export const BACK_FEET_VIEWS: Record<'backFeet.where' | 'backFeet.side' | 'backFeet.history', PageView> = {
  'backFeet.where': Where,
  'backFeet.side': Side,
  'backFeet.history': History,
};
```

- [ ] **Step 4: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/setup/pages
git commit -m "feat: Build setup's health, medicines, and back and feet pages"
```

---

### Task 11: The programme's Join flow, everywhere it's joined

One Join flow (D81): four steps in a sheet. Setup's programme page opens it, as do Your plan (`?join=1` too, Plan 2) and Goals' programme group (Plan 4's `ProgrammeGroup`). It replaces the profile wizard's "programme" mode in both.

**Files:**
- Create: `src/programme/JoinFlow.tsx`
- Modify: `src/screens/move/plan.ts`, `src/screens/move/PlanScreen.tsx`, `src/screens/move/plan.test.ts`
- Modify: `src/screens/you/write.ts` (`joinProgramme`), `src/screens/you/write.test.ts`, `src/screens/you/copies.test.ts`, `src/screens/you/ProgrammeGroup.tsx`

**Interfaces:**
- Consumes: `JOIN_STEPS`, `joinProblem`, `joinInitial`, `withJoinAnswers` (Task 5).
- Produces:
  - `JoinFlow({ open, onOpenChange, initial: JoinAnswers, busy?, error?, onJoin(j: JoinAnswers) })`, a sheet titled "Join the 12-week programme";
  - `JoinFlow.draft` in `plan.ts` becomes `JoinAnswers`; `joinController(write, dispatch)` takes `JoinAnswers`; `joinSeed(state, data, today): JoinAnswers`;
  - `joinProgramme(j: JoinAnswers): Promise<StoreResult>` in `src/screens/you/write.ts`;
  - `withJoined` is deleted.

- [ ] **Step 1: Change the Join lifecycle tests to the four answers.** In `src/screens/move/plan.test.ts`:
  - drop `withJoined` from the import; import `JOIN` from `@/setup/fixtures`;
  - delete the test `'joins with the answers given and the start date chosen, and touches nothing else'` (Task 5's `join.test.ts` covers `withJoinAnswers`);
  - in `describe('the Join save lifecycle (R02)')`, replace `tueThu` with `const tueThu = { ...JOIN, days: ['tuesday', 'thursday'] as DayOfWeek[], startDate: '2026-10-12' };`, importing `DayOfWeek` from `@/types`;
  - replace every `r.state.draft?.profile.trainingDays` and `state.draft?.profile.trainingDays` with `r.state.draft?.days` and `state.draft?.days`;
  - replace the test `'writes only the answers changed in this wizard over the latest profile (scan D-03)'` with:

```ts
  it('writes only the programme’s answers over the latest profile (scan D-03)', async () => {
    // Meanwhile another open copy saved an open foot wound. Join changes the programme's answers only.
    const attempts: AppData[] = [];
    const latest = stored();
    latest.profile = { ...latest.profile!, health: { ...latest.profile!.health, footStatus: 'current_wound_or_active_charcot' } };
    const write = (updater: (d: AppData) => AppData) => { attempts.push(updater(latest)); return Promise.resolve(ok); };
    await joinController(write, () => {})(tueThu);
    expect(attempts[0].profile?.trainingDays).toEqual(['tuesday', 'thursday']);
    expect(attempts[0].profile?.health.footStatus).toBe('current_wound_or_active_charcot');
  });
```

  - in `'keeps the unsaved answers after closing…'`, the last line becomes `expect(joinSeed(r.state, stored(), TODAY)).toEqual(tueThu);`;
  - in `'closes and forgets the draft once the store confirms the save'`, the last line becomes `expect(joinSeed(r.state, stored(), TODAY)).toEqual({ experience: 'intermediate', equipment: 'fullGym', days: ['monday'], minutes: 60, startDate: TODAY });` (the stored profile's own answers, `createDefaultProfile`'s defaults with Monday);
  - in `'retries with the kept answers after a refusal'`, map the attempts with `x.profile?.trainingDays` as now.

  In `src/screens/you/write.test.ts`:
  - drop the `WizardResult` import if nothing else uses it after Task 14; for now, change the two `joinProgramme({ profile: joined, useMetric: true }, '2026-10-12')` calls to `joinProgramme({ ...JOIN, startDate: '2026-10-12' })`, importing `JOIN` from `@/setup/fixtures`;
  - in `'joins with the programme answers and a start date'`, assert `trainingDays` equals `JOIN.days` and `startDate` is `'2026-10-12'`, and delete its assertions on `currentWeight` and `useMetric` (the Join flow no longer asks them, D81).

  In `src/screens/you/copies.test.ts`, the case `'joining the programme in one keeps the answers the other saved meanwhile'` calls `a.write.joinProgramme({ ...JOIN, startDate: '2026-10-12' })` instead of `joinProgramme(joined, '2026-10-12')`, and keeps its assertions on the other copy's answers.

Run: `npx vitest run src/screens/move/plan.test.ts src/screens/you/write.test.ts src/screens/you/copies.test.ts`
Expected: FAIL. `joinController` and `joinProgramme` still take the wizard's result.

- [ ] **Step 2: The lifecycle with the four answers.** In `src/screens/move/plan.ts`:
  - delete `withJoined`; import `joinInitial` and `withJoinAnswers` from `@/programme/join`, and `type JoinAnswers` from `@/types/setup`; remove the `WizardResult` and `answeredProfile` imports;
  - in `JoinFlow`, change `draft?: WizardResult` to `draft?: JoinAnswers`; in `JoinAction`, change `{ type: 'submit'; draft: WizardResult }` to `{ type: 'submit'; draft: JoinAnswers }`;
  - `joinController` returns `(draft: JoinAnswers) => Promise<StoreResult | null>`, and its write becomes `const result = await write(data => withJoinAnswers(data, draft));`. Its comment: "Only the programme's answers, over the latest stored profile: another open copy's saved answers stay (scan D-03)";
  - replace `joinSeed` with:

    ```ts
    /** What the Join flow opens with: the unsaved answers if there are any, otherwise the stored profile's, from today. */
    export function joinSeed(state: JoinFlow, data: Pick<AppData, 'profile' | 'settings'>, today: string): JoinAnswers {
      return state.draft ?? joinInitial(data.profile, today);
    }
    ```

  In `src/screens/you/write.ts`, replace `joinProgramme` with:

```ts
/** Join the 12-week programme: its four answers and a start date (board D8, D81). The same write Your plan makes. */
export function joinProgramme(j: JoinAnswers): Promise<StoreResult> {
  return update(previous => withJoinAnswers(previous, j));
}
```

  Import `withJoinAnswers` from `@/programme/join` and `type JoinAnswers` from `@/types/setup`, and remove `withJoined` from the `@/screens/move/plan` import.

- [ ] **Step 3: The flow** `src/programme/JoinFlow.tsx`

```tsx
import { useId, useState } from 'react';
import { Group } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { dayOf, nowAt } from '@/health/observation';
import { CheckRows, ChoiceRows, Notice, PlainButton, PrimaryButton } from '@/screens/you/controls';
import type { DayOfWeek } from '@/types';
import type { SessionMinutes } from '@/types/profile';
import type { JoinAnswers } from '@/types/setup';
import { JOIN_STEPS, joinProblem } from './join';

const DAYS: { value: DayOfWeek; label: string }[] = [
  { value: 'monday', label: 'Monday' }, { value: 'tuesday', label: 'Tuesday' }, { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' }, { value: 'friday', label: 'Friday' }, { value: 'saturday', label: 'Saturday' }, { value: 'sunday', label: 'Sunday' },
];

/**
 * The 12-week programme's own Join flow (journey §6.2 ch. 6; D35; board D81):
 * experience, where you'll train, your days, and session length with a start
 * date, a step at a time. The same wherever it's opened. While a save is
 * under way nothing closes; a refusal keeps every answer to try again (R02).
 */
export function JoinFlow({ open, onOpenChange, initial, busy = false, error, onJoin }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: JoinAnswers;
  busy?: boolean;
  error?: string;
  onJoin: (j: JoinAnswers) => void;
}) {
  return (
    <Sheet open={open} dismissible={!busy} onOpenChange={next => { if (!busy) onOpenChange(next); }} title="Join the 12-week programme" detent="large">
      {open && <JoinSteps initial={initial} busy={busy} error={error} onJoin={onJoin} onCancel={() => onOpenChange(false)} />}
    </Sheet>
  );
}

function JoinSteps({ initial, busy, error, onJoin, onCancel }: {
  initial: JoinAnswers; busy: boolean; error?: string; onJoin: (j: JoinAnswers) => void; onCancel: () => void;
}) {
  const [j, setJ] = useState(initial);
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const [today] = useState(() => dayOf(nowAt()));
  const dateId = useId();
  const s = JOIN_STEPS[step];
  const problem = joinProblem(s, j, today);
  const last = step === JOIN_STEPS.length - 1;

  const next = () => {
    if (problem) {
      setTried(true);
      return;
    }
    setTried(false);
    if (last) onJoin(j);
    else setStep(step + 1);
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="px-1 text-[length:var(--text-subhead)] text-muted-foreground">Step {step + 1} of {JOIN_STEPS.length}</p>
      {s === 'experience' && (
        <Group header="Your experience">
          <ChoiceRows label="How much strength training have you done?" value={j.experience} onChange={experience => setJ({ ...j, experience })}
            options={[
              { value: 'beginner', label: 'New to it', detail: 'Or not for a long while' },
              { value: 'intermediate', label: 'Some', detail: 'A few months, on and off' },
              { value: 'advanced', label: 'A lot', detail: 'Regular training for a year or more' },
            ]} />
        </Group>
      )}
      {s === 'place' && (
        <Group header="Where you’ll train">
          <ChoiceRows label="Where will you train?" value={j.equipment} onChange={equipment => setJ({ ...j, equipment })}
            options={[
              { value: 'fullGym', label: 'A gym' }, { value: 'homeDumbbells', label: 'At home, with dumbbells' },
              { value: 'homeNone', label: 'At home, with no equipment' },
            ]} />
        </Group>
      )}
      {s === 'days' && (
        <Group header="Your days" footer="Three days a week suits most people.">
          <CheckRows label="Which days?" options={DAYS} value={j.days} onChange={days => setJ({ ...j, days })} />
        </Group>
      )}
      {s === 'length' && (
        <>
          <Group header="Session length">
            <ChoiceRows label="How long is each session?" value={String(j.minutes) as `${SessionMinutes}`}
              onChange={m => setJ({ ...j, minutes: Number(m) as SessionMinutes })}
              options={[{ value: '45', label: '45 minutes' }, { value: '60', label: '60 minutes' }, { value: '75', label: '75 minutes' }]} />
          </Group>
          <Group header="Start date">
            <div className="flex min-h-[3.25rem] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5">
              <label htmlFor={dateId} className="min-w-0 flex-1 basis-24 text-[length:var(--text-body)]">Start on</label>
              <input id={dateId} type="date" min={today} value={j.startDate} onChange={e => setJ({ ...j, startDate: e.target.value })}
                className="numeric min-h-11 rounded-lg bg-muted/60 px-3 text-[length:var(--text-body)] text-foreground outline-none focus-visible:ring-3 focus-visible:ring-tint/40" />
            </div>
          </Group>
        </>
      )}
      {tried && problem && <Notice tone="error">{problem}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="flex flex-col gap-2">
        <PrimaryButton className="min-h-[3.75rem]" disabled={busy} onClick={next}>
          {!last ? 'Next' : busy ? 'Joining…' : 'Join the programme'}
        </PrimaryButton>
        <PlainButton disabled={busy} onClick={step > 0 ? () => setStep(step - 1) : onCancel}>{step > 0 ? 'Back' : 'Cancel'}</PlainButton>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Your plan and Goals open it.**
  - In `src/screens/move/PlanScreen.tsx`, replace the `<WizardCover …>…</WizardCover>` block with the lines below, and remove the `ProfileWizard` and `WizardCover` imports. Plan 2's `?join=1` effect, which opens the flow at once, stays as it is.

    ```tsx
          <JoinFlow
            open={flow.open}
            onOpenChange={next => { if (!next) cancel(); }}
            initial={joinSeed(flow, data, date)}
            busy={flow.busy}
            {...(flow.error ? { error: flow.error } : {})}
            onJoin={answers => { void submit(answers).then(result => { if (result?.ok) setSwitched(true); }); }}
          />
    ```

  - In `src/screens/you/ProgrammeGroup.tsx` (Plan 4's), replace the `WizardCover` with its `ProfileWizard` with:

    ```tsx
          <JoinFlow
            open={joining}
            onOpenChange={next => { if (!busy) setJoining(next); }}
            initial={joinInitial(profile, today)}
            busy={busy}
            {...(joinProblem ? { error: joinProblem } : {})}
            onJoin={j => void join(j)}
          />
    ```

    Change `join` to take `j: JoinAnswers` and call `joinProgramme(j)`. Import `JoinFlow` from `@/programme/JoinFlow`, `joinInitial` from `@/programme/join` and `type JoinAnswers` from `@/types/setup`, and remove the imports nothing uses now (`ProfileWizard`, `WizardResult`, `WizardCover`, `createDefaultProfile`, `withFluidAnswer`, `startDateProblem`).

- [ ] **Step 5: Run the tests, then the gates**

Run: `npx vitest run src/screens/move src/screens/you src/programme`
Expected: PASS.

```bash
npx tsc -b && npm run lint && npx vitest run
```

- [ ] **Step 6: Check by eye.** `npm run dev`, open `#/hub/workout/plan?join=1` as P02 at 428×926 and 320×568:
  - the sheet "Join the 12-week programme" opens at Step 1 of 4;
  - Next with no day ticked says "Choose at least one day.";
  - a past start date says "Choose today or a later day.";
  - Join the programme closes the sheet and shows the member view.

- [ ] **Step 7: Commit**

```bash
git add src/programme src/screens/move src/screens/you/write.ts src/screens/you/write.test.ts src/screens/you/copies.test.ts src/screens/you/ProgrammeGroup.tsx
git commit -m "feat: Give the programme its own Join flow, shared by setup, Your plan and Goals"
```

---

### Task 12: Your movement, Your food, and Your day and coach

**Files:**
- Create: `src/setup/allergies.ts`
- Create: `src/screens/setup/pages/movement.tsx`, `src/screens/setup/pages/food.tsx`, `src/screens/setup/pages/day.tsx`

**Interfaces:**
- Consumes:
  - Task 9's controls; `FOCUS_CHOICES`; `JoinFlow`, `joinInitial`, `joinLine` (Tasks 5 and 11);
  - `PATTERN_LABEL`, `PATTERN_DETAIL` (Task 3); `parseAvoid`;
  - `GLASS_SIZES`, `WATER_EVERY`, `SITTING_EVERY`, `DEFAULT_WATER`, `DEFAULT_SITTING`, `DEFAULT_FINISH`, `DEFAULT_QUIET`, `windowProblem`, `mealProblem`;
  - `everyLabel`, `MEAL_LABEL`, `VoiceSettingsCard`, `isEnrolled`.
- Produces:
  - `MOVEMENT_VIEWS: Record<'movement.focus' | 'movement.goal' | 'movement.programme', PageView>`;
  - `FOOD_VIEWS: Record<'food.pattern' | 'food.logging', PageView>`;
  - `DAY_VIEWS: Record<'day.reminders' | 'day.meals' | 'day.voice', PageView>`;
  - in `src/setup/allergies.ts`: `ALLERGY_CHIPS: { value: string; label: string }[]` (P7-5's canonical ids) and `allergyName(entry: string): string`.

- [ ] **Step 1: Your movement** `src/screens/setup/pages/movement.tsx`

```tsx
import { useState } from 'react';
import { Group, Row } from '@/components/hig/List';
import { isEnrolled } from '@/health/recommend';
import { dayOf, nowAt } from '@/health/observation';
import { joinInitial, joinLine } from '@/programme/join';
import { JoinFlow } from '@/programme/JoinFlow';
import { FOCUS_CHOICES } from '@/screens/welcome/focus';
import { useStore } from '@/store/useStore';
import { Ask, type PageProps, type PageView } from '../controls';

function Focus({ a, set, tried }: PageProps) {
  return (
    <>
      <Ask label="What would you most like to do?" tried={tried} value={a.focus} onChange={focus => set({ focus })}
        options={FOCUS_CHOICES.map(({ value, label, detail }) => ({ value, label, detail }))}
        footer="This sets what the app suggests first, not what you can do." />
      <Ask label="Do you exercise now?" header="Do you exercise now?" tried={tried} value={a.active} onChange={active => set({ active })}
        options={[
          { value: 'yes', label: 'Yes', detail: 'At least 30 minutes, 3 days a week, for the last 3 months' },
          { value: 'no', label: 'No, not like that' },
        ]} />
    </>
  );
}

const GOALS = [30, 60, 90, 150].map(m => ({ value: String(m), label: `${m} minutes a week` }));

function Goal({ a, set, tried }: PageProps) {
  const value = a.weeklyGoal === undefined ? undefined : a.weeklyGoal === 'none' ? 'none' : String(a.weeklyGoal);
  // No WHO line here: it lives in Learn (B-18). The goal is never raised for the person (D31).
  return (
    <Ask label="Your weekly goal" tried={tried} value={value} onChange={v => set({ weeklyGoal: v === 'none' ? 'none' : Number(v) })}
      options={[...GOALS, { value: 'none', label: 'No goal for now' }]}
      footer="Minutes of movement a week. The app never raises it for you; you can change it in Me → Goals." />
  );
}

function Programme({ a, set, tried, mode }: PageProps) {
  const { settings, profile } = useStore();
  const [open, setOpen] = useState(false);
  const [today] = useState(() => dayOf(nowAt()));
  if (mode === 'edit' && isEnrolled(settings, profile)) {
    return <Group footer="Me → Goals has Leave the programme."><Row label="You’re in the 12-week programme" /></Group>;
  }
  return (
    <>
      <p className="px-1 text-[length:var(--text-body)] leading-snug">Guided sessions on the days you choose, built around your back and your health. Stretch and Walk work without it.</p>
      <Ask label="Join the 12-week strength programme?" tried={tried} value={a.programme === 'joined' ? 'join' : a.programme}
        onChange={v => (v === 'join' ? setOpen(true) : set({ programme: 'notNow', join: undefined }))}
        options={[{ value: 'join', label: 'Yes, join it' }, { value: 'notNow', label: 'Not now' }]} />
      {a.programme === 'join' && a.join && (
        <Group><Row onClick={() => setOpen(true)} label="Your programme" detail={joinLine(a.join)} chevron /></Group>
      )}
      <JoinFlow open={open} onOpenChange={setOpen} initial={a.join ?? joinInitial(profile, today)}
        onJoin={join => { set({ programme: 'join', join }); setOpen(false); }} />
    </>
  );
}

export const MOVEMENT_VIEWS: Record<'movement.focus' | 'movement.goal' | 'movement.programme', PageView> = {
  'movement.focus': Focus,
  'movement.goal': Goal,
  'movement.programme': Programme,
};
```

- [ ] **Step 2: The allergy chips** `src/setup/allergies.ts`

```ts
/**
 * P7-5's canonical allergens, as a chip stores them (B-13, board D82). Plan 7
 * lists them all, with their aliases, in `src/food/allergens.ts`; these are
 * the common ones, and anything else is typed in the person's own words. The
 * ids must stay Plan 7's.
 */
export const ALLERGY_CHIPS: { value: string; label: string }[] = [
  { value: 'peanut', label: 'Peanuts' }, { value: 'treeNut', label: 'Tree nuts' }, { value: 'milk', label: 'Milk' },
  { value: 'egg', label: 'Eggs' }, { value: 'gluten', label: 'Gluten (wheat, barley, rye)' }, { value: 'soy', label: 'Soya' },
  { value: 'sesame', label: 'Sesame' }, { value: 'fish', label: 'Fish' }, { value: 'crustacean', label: 'Prawns, crab and lobster' },
  { value: 'mustard', label: 'Mustard' },
];

const NAME = new Map(ALLERGY_CHIPS.map(c => [c.value, c.label]));

/** A stored allergy as the person reads it: a chip's label, or their own words. */
export const allergyName = (entry: string): string => NAME.get(entry) ?? entry;
```

- [ ] **Step 3: Your food** `src/screens/setup/pages/food.tsx`

```tsx
import { useState } from 'react';
import { Group, Row } from '@/components/hig/List';
import { PATTERN_DETAIL, PATTERN_LABEL, type Pattern } from '@/content';
import { parseAvoid } from '@/screens/guide/format';
import { CheckRows } from '@/screens/you/controls';
import { ALLERGY_CHIPS } from '@/setup/allergies';
import { Ask, Missing, TextInput, type PageProps, type PageView } from '../controls';

const PATTERNS: Pattern[] = ['vegetarian', 'eggetarian', 'nonVegetarian', 'vegan', 'jain'];
const CHIP_IDS = new Set<string>(ALLERGY_CHIPS.map(c => c.value));

function PatternPage({ a, set, tried }: PageProps) {
  const given = a.allergies ?? [];
  const chips = given.filter(x => CHIP_IDS.has(x));
  const [other, setOther] = useState(() => given.filter(x => !CHIP_IDS.has(x)).join(', '));
  const write = (ids: string[], typed: string) => set({ allergies: [...ids, ...parseAvoid(typed)] });
  return (
    <>
      <Ask label="How do you eat?" tried={tried} value={a.pattern} onChange={pattern => set({ pattern })}
        options={PATTERNS.map(p => ({ value: p, label: PATTERN_LABEL[p], detail: PATTERN_DETAIL[p] }))} />
      <Group header="Allergies" footer="Meal ideas leave out anything with these. A food you’ve already eaten can still be logged.">
        <CheckRows label="Allergies" options={ALLERGY_CHIPS} value={chips} onChange={ids => write(ids, other)} />
        <TextInput label="Something else you’re allergic to (optional)" text={other} placeholder="For example: brinjal, kiwi"
          onText={t => { setOther(t); write(chips, t); }} />
      </Group>
      <Group>
        <CheckRows label="No food allergies" options={[{ value: 'none', label: 'No food allergies' }]}
          value={a.allergies !== undefined && a.allergies.length === 0 ? ['none'] : []}
          onChange={v => { setOther(''); set({ allergies: v.length > 0 ? [] : undefined }); }} />
      </Group>
      <Missing show={tried && a.allergies === undefined}>Tick your allergies, or “No food allergies”.</Missing>
    </>
  );
}

type Level = 'ideas' | 'meals' | 'estimates';
type Screen = 'yes' | 'no' | 'preferNot';

/**
 * The logging level (journey §6.2 ch. 7, §11.1). Before estimates are
 * stored, "Has food or weight ever been hard for you?" is asked (K-22). The
 * answer is never kept (P7-8): it only decides what's suggested here.
 */
function Logging({ a, set, tried }: PageProps) {
  const [opened] = useState(a.foodLevel);
  const [picked, setPicked] = useState<Level | undefined>(a.foodLevel);
  const [screen, setScreen] = useState<Screen>();
  const asking = picked === 'estimates' && opened !== 'estimates';
  const suggest = screen === 'yes' || screen === 'preferNot';

  const pick = (v: Level) => {
    setPicked(v);
    setScreen(undefined);
    set({ foodLevel: v === 'estimates' && opened !== 'estimates' ? undefined : v });
  };
  const answer = (s: Screen) => {
    setScreen(s);
    if (s === 'no') set({ foodLevel: 'estimates' });
  };

  return (
    <>
      <Ask label="Would you like to log what you eat?" tried={tried && picked === undefined} value={picked} onChange={pick}
        footer="You can change this any time in Me → Food."
        options={[
          { value: 'ideas', label: 'No, meal ideas only' },
          { value: 'meals', label: 'Yes, meals only, no numbers', ...(suggest ? { detail: 'Recommended' } : {}) },
          { value: 'estimates', label: 'Yes, with calorie and carb estimates' },
        ]} />
      {asking && (
        <Ask label="Has food or weight ever been hard for you?" header="Has food or weight ever been hard for you?" tried={tried}
          value={screen} onChange={answer} footer="Your answer isn’t kept. It only decides what we suggest here."
          options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'preferNot', label: 'Prefer not to say' }]} />
      )}
      {asking && suggest && a.foodLevel === undefined && (
        <Group footer="Meals only shows no calorie or carb numbers anywhere. Estimates stay available.">
          <Row label="We suggest “Yes, meals only, no numbers”" />
          <Row onClick={() => { setPicked('meals'); set({ foodLevel: 'meals' }); }} label={<span className="text-tint">Use meals only</span>} />
          <Row onClick={() => set({ foodLevel: 'estimates' })} label={<span className="text-tint">Keep estimates</span>} />
        </Group>
      )}
    </>
  );
}

export const FOOD_VIEWS: Record<'food.pattern' | 'food.logging', PageView> = {
  'food.pattern': PatternPage,
  'food.logging': Logging,
};
```

- [ ] **Step 4: Your day and coach** `src/screens/setup/pages/day.tsx`

```tsx
import { useState } from 'react';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { VoiceSettingsCard } from '@/components/profile/VoiceSettingsCard';
import { createDefaultProfile } from '@/profile/defaults';
import { MEAL_LABEL } from '@/reminders/copy';
import { factsOf } from '@/setup/facts';
import { CheckRows, ChoiceRows, TimeField, Toggle } from '@/screens/you/controls';
import {
  DEFAULT_FINISH, DEFAULT_QUIET, DEFAULT_SITTING, DEFAULT_WATER, GLASS_SIZES, SITTING_EVERY, WATER_EVERY, mealProblem, windowProblem,
} from '@/screens/you/habitOptions';
import { everyLabel } from '@/screens/you/summaries';
import type { Meal } from '@/types/habits';
import type { VoiceSettings } from '@/types/profile';
import { Ask, Missing, TRI, type PageProps, type PageView } from '../controls';

const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner'];
/** Usual finish times for the meals chosen, labelled defaults until the person changes them (§6.1). */
const finishFor = (meals: readonly Meal[], kept: Partial<Record<Meal, string>> | undefined) =>
  Object.fromEntries(meals.map(m => [m, kept?.[m] ?? DEFAULT_FINISH[m]])) as Partial<Record<Meal, string>>;

function Reminders({ a, set, tried }: PageProps) {
  const water = a.water ?? { on: false, ...DEFAULT_WATER };
  const sitting = a.sitting ?? { on: false, ...DEFAULT_SITTING };
  const walk = a.mealWalk ?? { on: false, meals: [] };
  const quiet = a.quiet;
  const footHeld = factsOf(a).footHeld;
  const waterIssue = water.on ? windowProblem(water.from, water.to, water.everyMinutes) : undefined;
  const sittingIssue = sitting.on ? windowProblem(sitting.from, sitting.to, sitting.everyMinutes) : undefined;

  return (
    <>
      <Group header="Water" footer={water.on ? 'Usual choices are filled in. Change them to yours.' : undefined}>
        <Row label="Water reminders" accessory={<Toggle label="Water reminders" checked={water.on} onChange={on => set({ water: { ...water, on } })} />} />
        {water.on && (
          <>
            <ChoiceRows label="Glass size" value={String(water.glassMl)} onChange={v => set({ water: { ...water, glassMl: Number(v) } })}
              options={GLASS_SIZES.map(ml => ({ value: String(ml), label: ml === DEFAULT_WATER.glassMl ? `Usual: ${ml} ml glass` : `${ml} ml glass` }))} />
            <ChoiceRows label="How often" value={String(water.everyMinutes)} onChange={v => set({ water: { ...water, everyMinutes: Number(v) } })}
              options={WATER_EVERY.map(m => ({ value: String(m), label: everyLabel(m) }))} />
            <TimeField id="setup-water-from" label="From" value={water.from} onChange={from => set({ water: { ...water, from } })} />
            <TimeField id="setup-water-to" label="Until" value={water.to} onChange={to => set({ water: { ...water, to } })} />
          </>
        )}
      </Group>
      <Missing show={tried && waterIssue !== undefined}>{waterIssue ?? ''}</Missing>
      {water.on && a.fluidLimit !== 'no' && (
        <Ask label="Has a doctor given you a fluid limit?" header="Has a doctor given you a fluid limit?" options={TRI} tried={tried}
          value={a.fluidLimit} onChange={fluidLimit => set({ fluidLimit })} footer="Water reminders are only for someone without a fluid limit." />
      )}
      {water.on && (a.fluidLimit === 'yes' || a.fluidLimit === 'unsure') && (
        <p role="status" className="px-4 text-[length:var(--text-subhead)] leading-snug text-muted-foreground">
          Water reminders stay off with a fluid limit, or while you’re not sure. Your care team’s plan comes first.
        </p>
      )}

      <Group header="Sitting breaks">
        <Row label="Sitting-break reminders" accessory={<Toggle label="Sitting-break reminders" checked={sitting.on} onChange={on => set({ sitting: { ...sitting, on } })} />} />
        {sitting.on && (
          <>
            <ChoiceRows label="How often" value={String(sitting.everyMinutes)} onChange={v => set({ sitting: { ...sitting, everyMinutes: Number(v) } })}
              options={SITTING_EVERY.map(m => ({ value: String(m), label: everyLabel(m) }))} />
            <TimeField id="setup-sitting-from" label="From" value={sitting.from} onChange={from => set({ sitting: { ...sitting, from } })} />
            <TimeField id="setup-sitting-to" label="Until" value={sitting.to} onChange={to => set({ sitting: { ...sitting, to } })} />
          </>
        )}
      </Group>
      <Missing show={tried && sittingIssue !== undefined}>{sittingIssue ?? ''}</Missing>

      {footHeld
        ? <Group><Row label="After-meal walks" detail="Not offered while a foot needs weight kept off it." /></Group>
        : (
          <Group header="After-meal walks">
            <Row label="After-meal walks" accessory={<Toggle label="After-meal walks" checked={walk.on}
              onChange={on => set({ mealWalk: { ...walk, on }, mealFinish: finishFor(walk.meals, a.mealFinish) })} />} />
            {walk.on && (
              <CheckRows label="After which meals?" value={walk.meals} options={MEALS.map(m => ({ value: m, label: MEAL_LABEL[m] }))}
                onChange={meals => set({ mealWalk: { ...walk, meals }, mealFinish: finishFor(meals, a.mealFinish) })} />
            )}
          </Group>
        )}
      <Missing show={tried && walk.on && !footHeld && walk.meals.length === 0}>Choose at least one meal.</Missing>

      <Group header="Quiet hours" footer="No reminders between these times.">
        <Row label="Quiet hours" accessory={<Toggle label="Quiet hours" checked={quiet !== undefined && quiet !== 'none'}
          onChange={on => set({ quiet: on ? { ...DEFAULT_QUIET } : 'none' })} />} />
        {quiet !== undefined && quiet !== 'none' && (
          <>
            <TimeField id="setup-quiet-from" label="From" value={quiet.from} onChange={from => set({ quiet: { ...quiet, from } })} />
            <TimeField id="setup-quiet-to" label="Until" value={quiet.to} onChange={to => set({ quiet: { ...quiet, to } })} />
          </>
        )}
      </Group>

      <Ask label="How reminders come" header="How reminders come" tried={false} value={a.delivery ?? 'app'} onChange={delivery => set({ delivery })}
        options={[{ value: 'app', label: 'In the app' }, { value: 'calendar', label: 'As a calendar file' }]}
        footer="In the app, while FitStrong is open. A calendar file goes into your phone’s own calendar." />
    </>
  );
}

function Meals({ a, set, tried }: PageProps) {
  const meals = a.mealWalk?.meals ?? [];
  const finish = finishFor(meals, a.mealFinish);
  const problem = mealProblem(meals, a.mealFinish ?? {});
  return (
    <>
      <Group footer="Usual times are filled in. Change them to yours: a short walk is suggested soon after.">
        {meals.map(m => (
          <TimeField key={m} id={`setup-finish-${m}`} label={MEAL_LABEL[m]} value={finish[m] ?? ''} onChange={t => set({ mealFinish: { ...finish, [m]: t } })} />
        ))}
      </Group>
      <Missing show={tried && problem !== undefined}>{problem ?? ''}</Missing>
    </>
  );
}

function Voice({ a, set }: PageProps) {
  const [open, setOpen] = useState(false);
  const voice: VoiceSettings = { ...createDefaultProfile().voice, ...a.voice };
  return (
    <>
      <Ask label="Voice coach" header="Voice coach" tried={false} value={voice.muted ? 'off' : 'on'} onChange={v => set({ voice: { ...a.voice, muted: v === 'off' } })}
        options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} footer="It talks you through each exercise. You can turn it off any time." />
      <Group>
        <Row onClick={() => setOpen(true)} label="Hear the voices" detail="Optional: choose the one you like" chevron />
      </Group>
      <Sheet open={open} onOpenChange={setOpen} title="Voices" detent="large">
        <VoiceSettingsCard voice={voice} onChange={patch => set({ voice: { ...a.voice, ...patch } })} />
      </Sheet>
    </>
  );
}

export const DAY_VIEWS: Record<'day.reminders' | 'day.meals' | 'day.voice', PageView> = {
  'day.reminders': Reminders,
  'day.meals': Meals,
  'day.voice': Voice,
};
```

- [ ] **Step 5: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/setup/allergies.ts src/screens/setup/pages
git commit -m "feat: Build setup's movement, food, and day and coach pages"
```

---
### Task 13: Review, setup's routes, and setup in the app

Review says what the answers will do, shows each chapter with Edit, keeps v1's acknowledgement, and finishes in one write. Then setup takes v1 Welcome's place: at `/setup` for a first run, and again after "Look around first" until it's finished (§19.1).

**Files:**
- Create: `src/setup/review.ts`, `src/setup/review.test.ts`
- Modify: `src/screens/you/summaries.ts` (`chapterSections`), `src/screens/you/summaries.test.ts`
- Create: `src/screens/setup/pages/index.ts`, `src/screens/setup/ReviewPage.tsx`, `src/screens/setup/routes.tsx`
- Modify: `src/routes.tsx`, `src/routes.test.ts`, `src/App.tsx`
- Delete: `src/screens/welcome/routes.tsx`, `FocusStep.tsx`, `HealthStep.tsx`, `KeepStep.tsx`, `assemble.ts`, `welcome.test.ts`
- Modify: `src/redirects.test.ts` (the route inventory)

**Interfaces:**
- Consumes: Tasks 4 to 12; `BackupSheet` from `@/screens/you/DataSheets`; `profileRules`; `springLinear` and `MOTION`.
- Produces:
  - `reviewThings(p: UserProfile, s: Pick<UserSettings, 'habits' | 'startDate'>, clock: (hhmm: string) => string): string[]`, at most three;
  - `clearanceNotes(p: UserProfile): string[]`;
  - `chapterSections(profile, settings, today, format?): { chapter: ChapterId; rows: SummaryRow[] }[]`, the six chapters after Welcome plus Your day and coach;
  - `PAGE_VIEWS: Record<Exclude<PageId, 'welcome.start' | 'review'>, PageView>`;
  - `ReviewPage`, and `SetupRoutes` (default export of `src/screens/setup/routes.tsx`);
  - `AppRoutes({ onboarded, setupOpen? })`.

- [ ] **Step 1: Write the failing tests.** Create `src/setup/review.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import { profileFrom, settingsFrom } from './assemble';
import { COMPLEX, MINIMAL, withC } from './fixtures';
import { clearanceNotes, reviewThings } from './review';

const TODAY = '2026-10-10';
const CTX = { thisYear: 2026 };
const base = migrateData({ version: CURRENT_VERSION } as AppData).settings;
const of = (a: typeof MINIMAL) => {
  const p = profileFrom(a, undefined, TODAY, CTX);
  return { p, s: { ...base, ...settingsFrom(a, base, p, TODAY) } };
};

describe('“Here’s what we’ll do for you” (journey §6.2)', () => {
  it('names up to three concrete things, safety first', () => {
    const { p, s } = of(COMPLEX);
    expect(reviewThings(p, s, t => t)).toEqual([
      'Ask for your glucose before you move, with an “I feel low” button.',
      'Choose back-safe stretches from how your back feels that day.',
      'Leave out stretches that pull on the nerve in your left leg.',
    ]);
  });

  it('without conditions, says what the reminders will do', () => {
    const { p, s } = of({ ...MINIMAL, water: { on: true, glassMl: 250, everyMinutes: 120, from: '09:00', to: '21:00' }, fluidLimit: 'no' });
    expect(reviewThings(p, s, t => t)).toEqual(['Remind you to drink water every 2 hours from 09:00.', 'Ask how you are before any movement.']);
  });

  it('says what needs a clinician first, in the engine’s words', () => {
    expect(clearanceNotes(of(MINIMAL).p)).toEqual([]);
    expect(clearanceNotes(of(withC({ heart: 'yes' }, { fluidLimit: 'no', clearance: 'none', dizzy: 'no' })).p).length).toBeGreaterThan(0);
  });
});
```

Append to `src/screens/you/summaries.test.ts`, importing `chapterSections` from `./summaries`:

```ts
import { profileFrom } from '@/setup/assemble';
import { COMPLEX, UNSURE } from '@/setup/fixtures';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import type { AppData } from '@/types';

describe('chapterSections: Profile & health by chapter (journey §16; Plan 5)', () => {
  const S = { ...migrateData({ version: CURRENT_VERSION } as AppData).settings, useMetric: true };
  const read = (p: Parameters<typeof chapterSections>[0]) =>
    Object.fromEntries(chapterSections(p, S, '2026-10-10').map(c => [c.chapter, Object.fromEntries(c.rows.map(r => [r.label, r.value]))]));

  it('reads each chapter back from the record, in v1’s words where v1 named them', () => {
    const rows = read(profileFrom(COMPLEX, undefined, '2026-10-10', { thisYear: 2026 }));
    expect(rows.about).toMatchObject({ Name: 'Asha', Born: '1958', Height: '158 cm', Weight: '68 kg' });
    expect(rows.health).toMatchObject({ Diabetes: 'Type 2', 'High blood pressure': 'Treated', 'Fluid limit from your care team': 'No' });
    expect(rows.medicines).toMatchObject({ Insulin: 'Injections or pump, several times a day', Metformin: 'Yes, since 2015' });
    expect(rows.backFeet).toMatchObject({ 'Pain or past injury': 'Lower back, Sciatica', 'Which leg': 'Left' });
    expect(rows.food).toMatchObject({ 'What you eat': 'Vegetarian', Allergies: 'Peanuts' });
  });

  it('says Not sure where it was said (V-J17)', () => {
    expect(read(profileFrom(UNSURE, undefined, '2026-10-10', { thisYear: 2026 })).medicines.Insulin).toBe('Not sure');
  });
});
```

Merge these imports with the file's existing ones if any repeat.

Run: `npx vitest run src/setup/review.test.ts src/screens/you/summaries.test.ts`
Expected: FAIL (modules and exports missing).

- [ ] **Step 2: Write `src/setup/review.ts`**

```ts
/**
 * Review's "Here's what we'll do for you" (journey §6.2). Up to three things
 * the answers change, safety first, each something the app really does: these
 * are v1's own adaptations, said plainly. Then what needs a clinician first,
 * in the engine's own words.
 */
import type { UserSettings } from '@/types';
import type { UserProfile } from '@/types/profile';
import { deriveHealth, profileRules } from '@/engine/health';
import { isEnrolled } from '@/health/recommend';
import { MEAL_LABEL } from '@/reminders/copy';
import { everyLabel, listOf } from '@/screens/you/summaries';

export function reviewThings(p: UserProfile, s: Pick<UserSettings, 'habits' | 'startDate'>, clock: (hhmm: string) => string): string[] {
  const d = deriveHealth(p.health);
  const areas = p.pain.areas;
  const back = areas.includes('lowerBack') || areas.includes('sciatica');
  const leg = p.pain.sciaticaSide === 'both' ? 'legs' : `${p.pain.sciaticaSide ?? 'left'} leg`;
  const water = s.habits?.water;
  const walk = s.habits?.mealWalk;
  return [
    d.hypoRisk && 'Ask for your glucose before you move, with an “I feel low” button.',
    d.ketoneRisk && 'Ask about ketones and the signs of ketoacidosis at each check-in.',
    back && 'Choose back-safe stretches from how your back feels that day.',
    areas.includes('sciatica') && `Leave out stretches that pull on the nerve in your ${leg}.`,
    (p.health.hypertension !== 'none' || d.onBpMeds) && 'No breath-holding, and slow, steady rises from the floor.',
    p.health.peripheralNeuropathy !== 'no' && 'Low-impact choices and foot checks.',
    water?.enabled && `Remind you to drink water ${everyLabel(water.everyMinutes).toLowerCase()} from ${clock(water.from)}.`,
    walk?.enabled && walk.meals.length > 0 && `Suggest a short walk after ${listOf(walk.meals.map(m => MEAL_LABEL[m].toLowerCase()))}.`,
    isEnrolled(s, p) && 'Start your 12-week programme on the day you chose.',
    'Ask how you are before any movement.',
  ].filter((x): x is string => typeof x === 'string').slice(0, 3);
}

/** What needs a clinician before vigorous exercise, as the engine says it (v1's summary step). */
export function clearanceNotes(p: UserProfile): string[] {
  return profileRules(p).reasons
    .filter(r => r.code.startsWith('clearance') || r.code === 'bpUnknown' || r.code === 'eyeTreatment')
    .map(r => r.message);
}
```

- [ ] **Step 3: Write `chapterSections`.** In `src/screens/you/summaries.ts`, add these imports: `type ChapterId` and `type UserSettings` from `@/types`; `weeklyGoalOn` from `@/screens/track/weeklyGoal`; `FOCUS_CHOICES` from `@/screens/welcome/focus`; `isEnrolled` from `@/health/recommend`; `allergyName` from `@/setup/allergies`. Then append:

```ts
// ============================================================================
// Profile & health, by setup chapter (journey §16; Plan 5)
// ============================================================================

const FIGURE = { male: 'Male figure', female: 'Female figure' } as const;
const KIDNEY_ANSWER: Record<UserProfile['health']['kidneyDisease'], string> = {
  none: 'No', ckd: 'Yes', dialysis_or_transplant: 'Dialysis or transplant', unsure: 'Not sure',
};
const RETINA = {
  none_or_mild: 'None or mild', moderate: 'Moderate', severe_or_proliferative: 'Severe', recent_eye_treatment: 'Recent eye treatment', unknown: 'Don’t know',
} as const;
const FEET = { healthy: 'Healthy', past_ulcer_or_charcot: 'Past ulcer or Charcot', current_wound_or_active_charcot: 'Current wound' } as const;
const LEVEL: Record<NonNullable<FoodPreferences['level']>, string> = {
  ideas: 'Meal ideas only', meals: 'Meals, with no numbers', estimates: 'Meals, with calorie and carb estimates',
};
const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export interface ChapterSection {
  chapter: ChapterId;
  rows: SummaryRow[];
}

/**
 * Each setup chapter's answers, read back from the record the engine reads
 * (journey §16): Profile & health's groups and Review's cards. In v1's words
 * where v1 named them, so a row reads as it always has.
 */
export function chapterSections(profile: UserProfile, settings: UserSettings, today: string, format: ClockFormat = clockFormat): ChapterSection[] {
  const h = profile.health;
  const metric = settings.useMetric;
  // Until the medicines are reviewed, what is stored may be a default nobody chose (B08).
  const unconfirmed = profileGaps(profile).medicinesUnknown;
  const medicine = (value: string) => (unconfirmed && value !== 'Not answered yet' ? `${value}, not yet confirmed` : value);
  const bpUnconfirmed = bpMedicinesUnknown(h);
  const bpMedicine = (value: string) => (bpUnconfirmed && value !== 'Not answered yet' ? `${value}, not yet confirmed` : value);
  const inches = (cm: number) => Math.round(cm / 2.54);

  const about: SummaryRow[] = [
    { label: 'Name', value: profile.name ?? 'Not given' },
    ...(profile.birthYear ? [{ label: 'Born', value: String(profile.birthYear) }] : []),
    { label: 'Body for the exercise demos', value: profile.figure ? FIGURE[profile.figure] : 'Either' },
    { label: 'Height', value: !profile.heightCm ? 'Not entered' : metric ? `${Math.round(profile.heightCm)} cm` : `${Math.floor(inches(profile.heightCm) / 12)} ft ${inches(profile.heightCm) % 12} in` },
    { label: 'Weight', value: profile.weightKg > 0 ? `${kgToDisplay(profile.weightKg, metric)} ${metric ? 'kg' : 'lb'}` : 'Not entered' },
    ...(profile.waistCm ? [{ label: 'Waist', value: metric ? `${Math.round(profile.waistCm)} cm` : `${inches(profile.waistCm)} in` }] : []),
  ];

  const eyesOrFeet = diabetic(profile) || h.retinopathy !== 'none_or_mild' || h.footStatus !== 'healthy' || h.peripheralNeuropathy !== 'no';
  const health: SummaryRow[] = [
    { label: 'Diabetes', value: DIABETES[h.diabetes] },
    { label: 'High blood pressure', value: BP[h.hypertension] },
    { label: 'Heart or circulation', value: yes(h.heartOrVascularDisease) },
    { label: 'Kidney disease', value: KIDNEY_ANSWER[h.kidneyDisease] },
    { label: 'Fluid limit from your care team', value: answer(h.fluidRestriction) },
    ...(eyesOrFeet ? [
      { label: 'Diabetic eye disease (retinopathy)', value: RETINA[h.retinopathy] },
      { label: 'Nerve damage in your feet', value: { no: 'No', yes: 'Yes', unsure: 'Not sure' }[h.peripheralNeuropathy] },
      { label: 'Your feet today', value: FEET[h.footStatus] },
    ] : []),
    { label: 'Cleared for exercise', value: CLEARANCE[h.clearance] },
  ];

  const medicines: SummaryRow[] = [
    ...(diabetic(profile) ? [
      { label: 'Insulin', value: medicine(h.insulinRegimen && h.insulin !== 'none' ? `${INSULIN[h.insulin]}, ${REGIMEN[h.insulinRegimen]}` : INSULIN[h.insulin]) },
      { label: 'A tablet that can cause lows', value: medicine(answer(h.sulfonylureaOrMeglitinide)) },
    ] : []),
    // Asked of everyone: also prescribed for the heart and kidneys. An untouched default No reads as not answered (B08).
    { label: 'A “-gliflozin” medicine', value: diabetic(profile) ? medicine(answer(h.sglt2i)) : answeredOnOpen(h).has('sglt2i') ? answer(h.sglt2i) : 'Not answered yet' },
    ...(diabetic(profile) ? [
      { label: 'Metformin', value: medicine(h.metformin === true && h.metforminSince ? `Yes, since ${h.metforminSince}` : answer(h.metformin)) },
      ...(h.priorDkaOrInsulinDeficiency !== undefined ? [{ label: 'Ketoacidosis, or low insulin', value: medicine(answer(h.priorDkaOrInsulinDeficiency)) }] : []),
    ] : []),
    ...(bpMedicinesAsked(h) ? [
      { label: 'Beta-blocker', value: bpMedicine(answer(h.betaBlocker)) },
      { label: 'Water tablet (diuretic)', value: bpMedicine(answer(h.diuretic)) },
    ] : []),
    { label: 'Dizzy when you stand up', value: yes(h.dizzyOnStandingOrAutonomicNeuropathy) },
    { label: 'Glucose meter or sensor', value: MONITOR[h.glucoseMonitor] },
    { label: 'Home blood-pressure cuff', value: yes(h.bpMonitor) },
  ];

  const areas = profile.pain.areas;
  const back = areas.includes('lowerBack') || areas.includes('sciatica');
  const backFeet: SummaryRow[] = [
    { label: 'Pain or past injury', value: areas.length > 0 ? areas.map(a => PAIN[a]).join(', ') : 'None' },
    ...(areas.includes('sciatica') ? [{ label: 'Which leg', value: { left: 'Left', right: 'Right', both: 'Both' }[profile.pain.sciaticaSide ?? 'left'] }] : []),
    ...(back ? [{ label: 'Worse with', value: WORSE[profile.pain.worseWith] }] : []),
    ...(profile.pain.neuroHistory !== undefined ? [{ label: 'A nerve damaged in the past', value: answer(profile.pain.neuroHistory) }] : []),
  ];

  const goal = weeklyGoalOn(settings, today);
  const movement: SummaryRow[] = [
    { label: 'What you’d most like to do', value: FOCUS_CHOICES.find(f => f.value === settings.focus)?.label ?? 'Not chosen' },
    { label: 'Exercise now', value: yes(h.currentlyActive) },
    { label: 'Weekly goal', value: goal === undefined ? 'No goal' : `${goal} minutes a week` },
    { label: 'The 12-week programme', value: isEnrolled(settings, profile) && isDay(settings.startDate) ? `Joined, from ${shortDay(settings.startDate)}` : 'Not joined' },
  ];

  const food = profile.food;
  const foodRows: SummaryRow[] = [
    { label: 'What you eat', value: food ? FOOD_PATTERN[food.pattern] : 'Not chosen' },
    { label: 'Allergies', value: food?.allergies?.length ? food.allergies.map(allergyName).join(', ') : 'None given' },
    { label: 'Logging what you eat', value: LEVEL[food?.level ?? 'ideas'] },
  ];

  const hb = settings.habits;
  const quiet = hb?.quietHours;
  const day: SummaryRow[] = [
    { label: 'Reminders', value: habitsLine(hb, profile) },
    { label: 'Quiet hours', value: quiet ? `${format(minutesOf(quiet.from))} to ${format(minutesOf(quiet.to))}` : 'None' },
    { label: 'Reminders come', value: hb?.inApp === false ? 'As a calendar file' : 'In the app' },
    { label: 'Voice coach', value: profile.voice.muted ? 'Off' : 'On' },
  ];

  return [
    { chapter: 'about', rows: about },
    { chapter: 'health', rows: health },
    { chapter: 'medicines', rows: medicines },
    { chapter: 'backFeet', rows: backFeet },
    { chapter: 'movement', rows: movement },
    { chapter: 'food', rows: foodRows },
    { chapter: 'day', rows: day },
  ];
}
```

`DIABETES`, `BP`, `INSULIN`, `REGIMEN`, `MONITOR`, `CLEARANCE`, `PAIN`, `WORSE`, `answer`, `yes` and `diabetic` are this file's own. If `RETINA` or `FEET` already exist in it at module level, use those instead of adding them again.

Run: `npx vitest run src/setup/review.test.ts src/screens/you/summaries.test.ts`
Expected: PASS.

- [ ] **Step 4: Every page view in one place** `src/screens/setup/pages/index.ts`

```ts
import type { PageId } from '@/types/setup';
import type { PageView } from '../controls';
import { ABOUT_VIEWS } from './about';
import { BACK_FEET_VIEWS } from './backFeet';
import { DAY_VIEWS } from './day';
import { FOOD_VIEWS } from './food';
import { HEALTH_VIEWS } from './health';
import { MEDICINES_VIEWS } from './medicines';
import { MOVEMENT_VIEWS } from './movement';

/** Every page's view, keyed by its id: a page added to the graph without a view fails the build. */
export const PAGE_VIEWS: Record<Exclude<PageId, 'welcome.start' | 'review'>, PageView> = {
  ...ABOUT_VIEWS, ...HEALTH_VIEWS, ...MEDICINES_VIEWS, ...BACK_FEET_VIEWS, ...MOVEMENT_VIEWS, ...FOOD_VIEWS, ...DAY_VIEWS,
};
```

- [ ] **Step 5: Review** `src/screens/setup/ReviewPage.tsx`

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckIcon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { markBack } from '@/components/hig/navigation';
import { dayOf, nowAt } from '@/health/observation';
import { timeOf } from '@/lib/time';
import { cn } from '@/lib/utils';
import { completedSetup, measurementsFrom, profileFrom, settingsFrom } from '@/setup/assemble';
import { enterWithoutSaving, useSetupSession } from '@/setup/draft';
import { CHAPTER_TITLE, firstPageOf, hrefOf, prevPage } from '@/setup/graph';
import { clearanceNotes, reviewThings } from '@/setup/review';
import { HANDOFF, deviceNoun, installContext, readInstallEnv } from '@/screens/welcome/install';
import { BackupSheet } from '@/screens/you/DataSheets';
import { Notice, PrimaryButton } from '@/screens/you/controls';
import { chapterSections } from '@/screens/you/summaries';
import { getState, update, useStore } from '@/store/useStore';
import { Missing } from './controls';
import { SetupShell } from './SetupShell';
import { useCtx, useSetupAnswers } from './useSetup';

/** v1's acknowledgement, kept for every first-time profile (board D84). */
export const ACKNOWLEDGEMENT = 'I understand this is general information, not medical advice. I will stop and get help for chest pain, faintness or severe breathlessness, and follow my care team’s medication plan.';

const clock = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return timeOf(new Date(2026, 0, 1, h, m));
};

/**
 * Review (journey §6.2): what the answers will do, each chapter with Edit,
 * the move to the Home Screen app in Safari (A-27), v1's acknowledgement, and
 * "Start using FitStrong": the profile, the settings, completion and Home's
 * first tiles as one write, then straight to Home (M22). Drawn at once.
 */
export function ReviewPage() {
  const navigate = useNavigate();
  const state = useStore();
  const { answers } = useSetupAnswers();
  const session = useSetupSession();
  const ctx = useCtx();
  const [today] = useState(() => dayOf(nowAt()));
  const [{ context, device }] = useState(() => {
    const env = readInstallEnv();
    return { context: installContext(env), device: deviceNoun(env) };
  });
  const [ack, setAck] = useState(false);
  const [askAck, setAskAck] = useState(false);
  const [backup, setBackup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();

  // What finishing would store, shown before it is.
  const profile = profileFrom(answers, state.profile, today, ctx);
  const settings = { ...state.settings, ...settingsFrom(answers, state.settings, profile, today) };
  const things = reviewThings(profile, settings, clock);
  const notes = clearanceNotes(profile);

  const back = () => {
    const prev = prevPage(answers, 'review');
    markBack();
    navigate(prev && prev !== 'welcome.start' ? hrefOf(prev) : '/setup', { replace: true, state: { back: true } });
  };

  const start = async () => {
    if (!ack) {
      setAskAck(true);
      return;
    }
    if (busy) return;
    // Without saving (B-07): the app opens for this session, and nothing is stored, so every hold stays.
    if (session.unsaved) {
      enterWithoutSaving();
      navigate('/home', { replace: true });
      return;
    }
    setBusy(true);
    setProblem(undefined);
    const now = nowAt();
    const hasSteps = getState().observations.some(o => o.kind === 'steps');
    // Held until stored: finishing opens Home, and a refusal must leave the person here, where it is said (D-04).
    const saved = await update(d => completedSetup(d, answers, now, { ...ctx, hasSteps }), { hold: true, addObservations: measurementsFrom(answers, state.profile, now) });
    setBusy(false);
    if (saved.ok || getState().status === 'unavailable') navigate('/home', { replace: true });
    else setProblem(`That did not save. ${saved.failure.message}`);
  };

  return (
    <SetupShell title="Here’s what we’ll do for you" capsule={{ label: 'Review', fraction: 1 }} onBack={back}>
      <Group header="What we’ll do">
        {things.map(t => <Row key={t} icon={<CheckIcon />} label={t} />)}
      </Group>
      {notes.length > 0 && (
        <Group header="Before vigorous exercise" footer="You can add your clearance in Me → Profile & health once you have it.">
          {notes.map(n => <Row key={n} label={n} />)}
        </Group>
      )}
      {chapterSections(profile, settings, today).map(s => (
        <Group key={s.chapter} header={CHAPTER_TITLE[s.chapter]}>
          {s.rows.map(r => <Row key={r.label} label={r.label} detail={r.value} />)}
          <Row onClick={() => navigate(hrefOf(firstPageOf(s.chapter, answers)), { state: { fromReview: true } })}
            aria-label={`Edit ${CHAPTER_TITLE[s.chapter]}`} label={<span className="text-tint">Edit</span>} />
        </Group>
      ))}
      {context === 'iosBrowser' && (
        <Group header={HANDOFF.title} footer={HANDOFF.text}>
          <Row onClick={() => setBackup(true)} label={<span className="text-tint">Make a backup</span>} chevron />
        </Group>
      )}
      <button type="button" role="checkbox" aria-checked={ack} onClick={() => { setAck(!ack); setAskAck(false); }}
        className="press-feedback flex min-h-12 w-full items-start gap-3 rounded-xl bg-grouped-card p-4 text-left">
        <span aria-hidden className={cn('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2', ack ? 'border-tint bg-tint text-on-tint' : 'border-muted-foreground')}>
          {ack && <CheckIcon className="size-4" strokeWidth={3} />}
        </span>
        <span className="text-[length:var(--text-body)] leading-snug">{ACKNOWLEDGEMENT}</span>
      </button>
      <Missing show={askAck && !ack}>Tick the box above to carry on.</Missing>
      {problem && <Notice tone="error">{problem}</Notice>}
      <PrimaryButton className="min-h-[3.75rem]" disabled={busy} onClick={() => void start()}>{busy ? 'Saving…' : 'Start using FitStrong'}</PrimaryButton>
      <BackupSheet open={backup} onOpenChange={setBackup} device={device} />
    </SetupShell>
  );
}
```

`BackupSheet` backs up the record as it is: the draft, at Review. Restored in the installed app, setup carries on at Review (board D84, V-J37).

- [ ] **Step 6: Setup's routes** `src/screens/setup/routes.tsx`

```tsx
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { MOTION, springLinear } from '@/design/motion';
import { guardFor, hrefOf, pageAt, resumeAt } from '@/setup/graph';
import type { PageId } from '@/types/setup';
import { PageFrame } from './PageFrame';
import { PAGE_VIEWS } from './pages';
import { ReviewPage } from './ReviewPage';
import { useCtx, useSetupAnswers } from './useSetup';
import { WelcomePage } from './WelcomePage';

/**
 * Setup at `/setup/:chapter/:page` (journey §19.2): page 1 at `/setup`,
 * Review at `/setup/review`. Only its own page layer moves between pages
 * (M22): `data-task` on <html> stills the rest, and the spring is set there.
 */
export default function SetupRoutes() {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.task = 'setup';
    root.style.setProperty('--setup-ease', springLinear(0));
    root.style.setProperty('--setup-ms', `${MOTION.spring.cssMs}ms`);
    return () => {
      delete root.dataset.task;
      root.style.removeProperty('--setup-ease');
      root.style.removeProperty('--setup-ms');
    };
  }, []);
  return (
    <Routes>
      <Route index element={<Start />} />
      <Route path="review" element={<Guarded id="review" />} />
      <Route path=":chapter/:page" element={<ByAddress />} />
      <Route path="*" element={<Navigate to="/setup" replace />} />
    </Routes>
  );
}

/**
 * Page 1, or where a draft stopped. Read once, on arrival: reopening resumes
 * on the draft's page with "Welcome back" (§6.1); Back to page 1 stays here.
 */
function Start() {
  const location = useLocation();
  const { answers, at } = useSetupAnswers();
  const ctx = useCtx();
  const [arrival] = useState(() => ((location.state as { back?: boolean } | null)?.back ? undefined : at));
  if (arrival !== undefined && arrival !== 'welcome.start') {
    return <Navigate to={hrefOf(resumeAt(answers, arrival, ctx))} replace state={{ welcomeBack: true }} />;
  }
  return <WelcomePage />;
}

function ByAddress() {
  const { chapter, page } = useParams();
  const id = pageAt(chapter, page);
  if (!id || id === 'welcome.start' || id === 'review') return <Navigate to="/setup" replace />;
  return <Guarded id={id} />;
}

/** A page opened by its address: on to the page it needs first, or past one that doesn't apply (Review Focus 5). */
function Guarded({ id }: { id: PageId }) {
  const location = useLocation();
  const { answers } = useSetupAnswers();
  const ctx = useCtx();
  const to = guardFor(answers, id, ctx);
  if (to !== undefined && to !== id) return <Navigate to={hrefOf(to)} replace state={location.state} />;
  if (id === 'review') return <ReviewPage />;
  return <PageFrame key={id} id={id} View={PAGE_VIEWS[id as keyof typeof PAGE_VIEWS]} />;
}
```

Page 1's "Get started" passes `{ welcomeBack: true }` when it resumes a draft (a backup restored there, V-J11). In `WelcomePage.tsx`, change `start` to:

```tsx
  const start = () => (at && at !== 'welcome.start'
    ? move.go(resumeAt(answers, at, ctx), answers, { welcomeBack: true })
    : move.go('about.name', answers));
```

- [ ] **Step 7: Write the failing route test.** In `src/routes.test.ts`, add a probe for setup's routes beside the Home probe:

```ts
vi.mock('@/screens/setup/routes', async () => {
  const { useLocation: where } = await import('react-router-dom');
  return {
    default: function SetupProbe() {
      const l = where();
      seen.push({ at: `setup:${l.pathname}`, state: l.state });
      return null;
    },
  };
});
```

Change `land`'s signature to `land(entry, onboarded, setupOpen = false)` and render `h(AppRoutes, { onboarded, setupOpen })`. Then add to its `describe`:

```ts
  it('after “Look around first”, setup carries on at its own address (journey §19.1)', async () => {
    await land({ pathname: '/setup/health/conditions' }, true, true);
    expect(seen.at(-1)?.at).toBe('setup:/setup/health/conditions');
  });
```

Run: `npx vitest run src/routes.test.ts`
Expected: FAIL. `AppRoutes` has no `setupOpen`, and `/setup` is still v1's Welcome.

- [ ] **Step 8: Setup in the app.**
  - In `src/routes.tsx`:
    - replace `const WelcomeRoutes = lazy(() => import('@/screens/welcome/routes'));` with `const SetupRoutes = lazy(() => import('@/screens/setup/routes'));`;
    - change the signature to `export function AppRoutes({ onboarded, setupOpen = false }: { onboarded: boolean; setupOpen?: boolean })`;
    - in the not-onboarded branch, `<Task><WelcomeRoutes /></Task>` becomes `<Task><SetupRoutes /></Task>`;
    - in the onboarded branch, replace the `/setup/*` route and its comment with:

      ```tsx
            {/* Set up already: setup's addresses go Home, which is also how finishing arrives there.
                After "Look around first", setup carries on at its address until it's finished (§19.1). */}
            <Route path="/setup/*" element={setupOpen ? <Task><SetupRoutes /></Task> : <Keeping to="/home" />} />
      ```

  - In `src/App.tsx`:
    - import `useSetupSession` from `@/setup/draft` and `setupStateOf` from `@/setup/state`;
    - take `profile` from `useStore()` too, and add `const session = useSetupSession();`;
    - render the routes as:

      ```tsx
              {/* Unsaved setup that was finished opens the app for this session only (B-07). */}
              <AppRoutes
                onboarded={settings.onboardingComplete || session.entered}
                setupOpen={setupStateOf(settings, profile).stage !== 'done' || session.entered}
              />
      ```

    `shell.node.test.ts` checks that `<AppRoutes` follows the `Suspense` fallback; the element still starts with `<AppRoutes`.
  - Delete `src/screens/welcome/routes.tsx`, `FocusStep.tsx`, `HealthStep.tsx`, `KeepStep.tsx`, `assemble.ts` and `welcome.test.ts`. Keep `install.ts`, `focus.ts` and `InstallSteps.tsx`: Me and setup use them.
  - In `src/redirects.test.ts`'s route inventory, remove `welcome: '/welcome'` from `bases`. v1's Welcome screens are gone; the explicit `/welcome`, `/welcome/health` and `/welcome/keep` cases above still prove each one's redirect.
  - Check nothing else imported the deleted files:

    ```bash
    grep -rn "screens/welcome/\(routes\|FocusStep\|HealthStep\|KeepStep\|assemble\)" src scripts
    ```

    Expected: no output.

- [ ] **Step 9: Run the tests, then the gates**

Run: `npx vitest run src/routes.test.ts src/redirects.test.ts src/components/hig`
Expected: PASS.

```bash
npx tsc -b && npm run lint && npx vitest run
```

- [ ] **Step 10: Check by eye.** `npm run dev` in a fresh private window, at 428×926 and 320×568, light and dark, and at 200% text:
  - the root opens `Welcome`, with the privacy line, the line on keeping data, `Display`, `Get started`, `Restore from a backup` and `Look around first`;
  - `Get started` → `What should we call you?`, the capsule reading `About you · 2 of 8`;
  - pages slide 30% and fade, Back reverses it, and with Reduce motion on (Display) they fade;
  - typing a birth year a digit at a time is never undone, and `Next` on "19" says "Enter the year you were born, from 1920.";
  - a minimal run reaches `Here’s what we’ll do for you` in 15 pages, and `Start using FitStrong` without the tick says "Tick the box above to carry on.";
  - after `Start using FitStrong`, Home, with no Finish setting up and the tiles worked out from the answers;
  - a fresh window with `Look around first`: Home, `Finish setting up · Carry on setting up`, and back in setup, `Close` returns to Home.

- [ ] **Step 11: Commit**

```bash
git add -A src/setup src/screens/setup src/screens/you/summaries.ts src/screens/you/summaries.test.ts src/screens/welcome src/routes.tsx src/routes.test.ts src/App.tsx src/redirects.test.ts
git commit -m "feat: Replace v1's Welcome with v2's setup, ending on a review of what it will do"
```

---

### Task 14: Me → Profile & health, chapter by chapter

Profile & health shows each chapter's answers with Edit (§16). Edit opens the chapter's own page views, one under another, with one Save. Saving changes:
- only what the edit changed, over the record as it is then (scan D-03);
- whatever the edit made necessary (D79), asked within the same edit;
- with any change the engine now makes said in words ("Each check-in will ask about ketones…").

While setup is unfinished, Profile & health is setup itself (L-20).

This task also retires v1's wizard: `ProfileScreen`, `FocusScreen`, `ProfileWizard`, `WizardCover` and the wizard exports nothing reads.

**Files:**
- Create: `src/setup/edit.ts`, `src/setup/edit.test.ts`, `src/setup/changes.ts`, `src/setup/changes.test.ts`
- Create: `src/screens/setup/ProfileHealthScreen.tsx`, `src/screens/setup/ChapterEditor.tsx`
- Modify: `src/screens/you/routes.tsx` (`Profile()`), `src/screens/you/MeHome.tsx` (the "What you’d like more of" row goes)
- Modify: `src/screens/you/write.ts`, `write.test.ts`, `copies.test.ts`, `summaries.ts`, `summaries.test.ts`, `src/components/profile/wizardSteps.ts`, `wizardSteps.test.ts`
- Delete: `src/screens/you/ProfileScreen.tsx`, `src/screens/you/FocusScreen.tsx`, `src/screens/you/WizardCover.tsx`, `src/components/profile/ProfileWizard.tsx`

**Interfaces:**
- Consumes: `answersToEdit` (Task 6); `profileFrom`, `settingsFrom`, `measurementsFrom`, `put` (Task 5); `commitPage`, `pageDone`, `pathFor`, `chapterOf`, `SAFETY_CHAPTERS`, `CHAPTER_TITLE` (Task 4); `factsOf`; `profileChanges`, `withProfileChanges`; `withJoinAnswers`; `chapterSections`; `chapterHref`; `PAGE_VIEWS`, `PAGE_TITLE`.
- Produces:
  - `interface ChapterEdit { chapters: readonly ChapterId[]; opened: SetupAnswers; answers: SetupAnswers; skipped: readonly PageId[] }`;
  - `editChapters(asked, a, opened): ChapterId[]`;
  - `editPath(chapters, a, opened, ctx): PageId[]`;
  - `editedRecord(data: AppData, edit: ChapterEdit, today: string, ctx: Ctx): AppData`;
  - `whatChanges(before: UserProfile, after: UserProfile): string[]`;
  - `ProfileHealthScreen`, and `ChapterEditor({ chapter })` at `/me/profile?chapter=…`.

- [ ] **Step 1: Write the failing tests.** Create `src/setup/edit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
import { profileGaps } from '@/engine/health';
import { isEnrolled } from '@/health/recommend';
import { createDefaultProfile } from '@/profile/defaults';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import { completedSetup, profileFrom } from './assemble';
import { editChapters, editPath, editedRecord } from './edit';
import { COMPLEX, GLIFLOZIN_NO_DIABETES, JOIN, MINIMAL, NO_CONDITIONS } from './fixtures';
import { SAFETY_CHAPTERS, commitPage, pathFor } from './graph';
import { answersFromProfile, answersToEdit } from './prefill';

const TODAY = '2026-10-10';
const NOW = '2026-10-10T09:00:00.000+05:30';
const CTX = { thisYear: 2026 };
const fresh = (): AppData => migrateData({ version: CURRENT_VERSION } as AppData);
const finished = (a: typeof MINIMAL) => completedSetup(fresh(), a, NOW, { ...CTX, hasSteps: false });
const opened = (data: AppData) => answersToEdit(data.settings.setup?.answers, data.profile!, data.settings, TODAY, CTX);

describe('which chapters an edit owns (board D79; Review Focus 1)', () => {
  it('adds Your medicines when the edit adds diabetes or blood pressure', () => {
    const was = GLIFLOZIN_NO_DIABETES;
    expect(editChapters(['health'], { ...was, conditions: { ...NO_CONDITIONS, diabetes: 'yes' } }, was)).toEqual(['health', 'medicines']);
    expect(editChapters(['health'], { ...was, conditions: { ...NO_CONDITIONS, bp: 'yes' } }, was)).toEqual(['health', 'medicines']);
    expect(editChapters(['about'], was, was)).toEqual(['about']);
  });
});

describe('which pages an edit shows (journey §16)', () => {
  it('an upgrader editing About you sees About you only, never v2’s new safety questions', () => {
    const v1 = answersFromProfile(createDefaultProfile({ weightKg: 70, health: { medicinesReviewed: true } }), fresh().settings);
    expect(editPath(['about'], v1, v1, CTX)).toEqual(['about.name', 'about.figure', 'about.body']);
  });

  it('a new foot answer brings its follow-ups, in this chapter and the next', () => {
    const feet = { ...COMPLEX, conditions: { ...COMPLEX.conditions, feet: 'yes' as const } };
    const path = editPath(['health'], feet, COMPLEX, CTX);
    expect(path).toEqual(expect.arrayContaining(['health.feet', 'backFeet.history']));
    expect(path).not.toContain('medicines.which');
  });

  it('Your back and feet with no pain answer shows the question that brings it', () => {
    expect(editPath(['backFeet'], MINIMAL, MINIMAL, CTX)).toEqual(['health.conditions']);
  });
});

describe('the record after an edit (journey §16)', () => {
  it('changes only what the edit changed, and keeps what another copy saved meanwhile (scan D-03; Review Focus 1)', () => {
    const data = finished(COMPLEX);
    const a = opened(data);
    const latest: AppData = { ...data, profile: { ...data.profile!, health: { ...data.profile!.health, footStatus: 'current_wound_or_active_charcot' } } };
    const after = editedRecord(latest, { chapters: ['about'], opened: a, answers: { ...a, weightKg: 70 }, skipped: [] }, TODAY, CTX);
    expect(after.profile?.weightKg).toBe(70);
    expect(after.settings.currentWeight).toBe(70);
    expect(after.profile?.health.footStatus).toBe('current_wound_or_active_charcot');
    expect({ ...after.profile, weightKg: 68 }).toEqual(latest.profile);
  });

  it('saving the three safety chapters clears a pending review (H-DATA)', () => {
    const data = fresh();
    data.settings = { ...data.settings, onboardingComplete: true };
    data.profile = { ...profileFrom(COMPLEX, undefined, TODAY, CTX), needsHealthReview: true };
    const a = opened(data);
    const answers = pathFor({ ...a, targets: 'no' }).reduce((x, id) => commitPage(id, x), { ...a, targets: 'no' as const });
    const after = editedRecord(data, { chapters: SAFETY_CHAPTERS, opened: a, answers, skipped: [] }, TODAY, CTX);
    expect(after.profile?.needsHealthReview).toBe(false);
  });

  it('adding diabetes without its medicines never keeps the old review (Review Focus 1)', () => {
    const data = finished(GLIFLOZIN_NO_DIABETES);
    const a = opened(data);
    const after = editedRecord(data, { chapters: ['health'], opened: a, answers: { ...a, conditions: { ...NO_CONDITIONS, diabetes: 'yes' }, diabetesType: 'type2' }, skipped: [] }, TODAY, CTX);
    expect(after.profile?.health.medicinesReviewed).toBe(false);
    expect(profileGaps(after.profile!).medicinesUnknown).toBe(true);
  });

  it('joins the programme from Your movement (D81)', () => {
    const data = finished(MINIMAL);
    const a = opened(data);
    const after = editedRecord(data, { chapters: ['movement'], opened: a, answers: { ...a, programme: 'join', join: JOIN }, skipped: [] }, TODAY, CTX);
    expect(isEnrolled(after.settings, after.profile)).toBe(true);
    expect(after.settings.setup?.answers?.programme).toBe('joined');
  });

  it('keeps a chapter under Finish setting up only while a page in it is left', () => {
    const data = finished({ ...MINIMAL, weeklyGoal: undefined, skippedPages: ['movement.goal'] });
    expect(data.settings.setup?.skipped).toEqual(['movement']);
    const a = opened(data);
    expect(editedRecord(data, { chapters: ['about'], opened: a, answers: a, skipped: [] }, TODAY, CTX).settings.setup?.skipped).toEqual(['movement']);
    expect(editedRecord(data, { chapters: ['movement'], opened: a, answers: { ...a, weeklyGoal: 60 }, skipped: [] }, TODAY, CTX).settings.setup?.skipped).toEqual([]);
  });
});
```

Create `src/setup/changes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { profileFrom } from './assemble';
import { whatChanges } from './changes';
import { FOOT_WOUND, GLIFLOZIN_NO_DIABETES, INSULIN_NO_DIABETES, MINIMAL } from './fixtures';

const at = (a: typeof MINIMAL) => profileFrom(a, undefined, '2026-10-10', { thisYear: 2026 });

describe('what an edit changes, in words (journey §16)', () => {
  it('says what the engine will now do differently, and nothing when nothing did', () => {
    const before = at(MINIMAL);
    expect(whatChanges(before, at(GLIFLOZIN_NO_DIABETES))).toEqual(['Each check-in will ask about ketones and the signs of ketoacidosis.']);
    expect(whatChanges(before, at(INSULIN_NO_DIABETES))).toContain('Before exercise, you’ll be asked for a glucose reading.');
    expect(whatChanges(before, at(FOOT_WOUND))).toContain('Walks stay off while your foot needs weight kept off it.');
    expect(whatChanges(before, before)).toEqual([]);
  });
});
```

Run: `npx vitest run src/setup/edit.test.ts src/setup/changes.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 2: Write `src/setup/edit.ts`**

```ts
/**
 * Me → Profile & health, a chapter at a time (journey §16, board D79). The
 * edit shows its chapter's pages, and any page the change makes necessary;
 * it never asks an upgrader what v1 never asked unless that chapter is the
 * one opened. Saving takes only what the edit changed onto the record as it
 * is then, so another open copy's answers stay (scan D-03).
 */
import type { AppData } from '@/types';
import type { ChapterId, PageId, SetupAnswers } from '@/types/setup';
import { CHAPTER_IDS } from '@/types/setup';
import { profileChanges, withProfileChanges } from '@/components/profile/wizardSteps';
import { isEnrolled } from '@/health/recommend';
import { createDefaultProfile } from '@/profile/defaults';
import { withJoinAnswers } from '@/programme/join';
import { profileFrom, put, settingsFrom } from './assemble';
import { factsOf } from './facts';
import { chapterOf, pageDone, pathFor, type Ctx } from './graph';
import { setupStateOf } from './state';

export interface ChapterEdit {
  /** The chapters the edit owns (`editChapters`). */
  chapters: readonly ChapterId[];
  /** The answers the editor opened with (`answersToEdit`). */
  opened: SetupAnswers;
  /** The answers saved: every page shown, stored (`commitPage`). */
  answers: SetupAnswers;
  /** Preference pages shown and left unanswered: their chapters stay under Finish setting up. */
  skipped: readonly PageId[];
}

/** The chapters an edit owns: those opened, and Your medicines when the edit makes its answers needed again (Review Focus 1). */
export function editChapters(asked: readonly ChapterId[], a: SetupAnswers, opened: SetupAnswers): ChapterId[] {
  const now = factsOf(a);
  const was = factsOf(opened);
  const bp = (f: typeof now) => f.bp || f.heart || f.kidney;
  const medicinesAgain = (now.diabetic && !was.diabetic) || (bp(now) && !bp(was));
  return CHAPTER_IDS.filter(c => asked.includes(c) || (c === 'medicines' && medicinesAgain));
}

/**
 * The pages the editor shows, in setup's order: every page of its chapters
 * that applies, and any other page this edit made necessary. A page that was
 * already unanswered when the editor opened, in a chapter not opened, waits.
 */
export function editPath(chapters: readonly ChapterId[], a: SetupAnswers, opened: SetupAnswers, ctx: Ctx): PageId[] {
  const waiting = new Set(pathFor(opened).filter(id => !pageDone(id, opened, ctx)));
  const path = pathFor(a).filter(id => id !== 'welcome.start' && id !== 'review'
    && (chapters.includes(chapterOf(id) as ChapterId) || (!pageDone(id, a, ctx) && !waiting.has(id))));
  // Your back and feet has no page without a pain or foot answer: the question that brings them is shown instead.
  return path.length === 0 && chapters.includes('backFeet') ? ['health.conditions'] : path;
}

export function editedRecord(data: AppData, edit: ChapterEdit, today: string, ctx: Ctx): AppData {
  const base = data.profile ?? createDefaultProfile({ weightKg: data.settings.currentWeight || 0, needsHealthReview: true });
  const was = profileFrom(edit.opened, base, today, ctx, edit.chapters);
  const saved = profileFrom(edit.answers, base, today, ctx, edit.chapters);
  const profile = withProfileChanges(base, profileChanges(was, saved));
  // Saving is the confirmation the review flags stand for, so they come from what was saved (H-DATA).
  put(profile, 'needsHealthReview', saved.needsHealthReview);
  put(profile.health, 'medicinesReviewed', saved.health.medicinesReviewed);
  put(profile.health, 'bpMedicinesReviewed', saved.health.bpMedicinesReviewed);

  const setup = setupStateOf(data.settings, data.profile);
  const left = new Set(edit.skipped.map(chapterOf));
  const skipped = CHAPTER_IDS.filter(c => (edit.chapters.includes(c) ? left.has(c) : setup.skipped.includes(c)));
  const skippedPages = [...(edit.answers.skippedPages ?? []).filter(p => !edit.chapters.includes(chapterOf(p) as ChapterId)), ...edit.skipped];
  const joins = edit.chapters.includes('movement') && edit.answers.programme === 'join' && edit.answers.join !== undefined && !isEnrolled(data.settings, data.profile);
  const answers: SetupAnswers = { ...edit.answers, skippedPages, ...(joins ? { programme: 'joined' as const } : {}) };

  const next: AppData = {
    ...data,
    profile,
    settings: { ...data.settings, ...settingsFrom(edit.answers, data.settings, profile, today, edit.chapters), setup: { ...setup, answers, skipped } },
  };
  return joins ? withJoinAnswers(next, edit.answers.join!) : next;
}
```

- [ ] **Step 3: Write `src/setup/changes.ts`**

```ts
/**
 * What an edit changes, in words (journey §16: "Before exercise, you'll be
 * asked for a glucose reading"): only what the engine itself now does
 * differently, read from the profile before and after.
 */
import type { UserProfile } from '@/types/profile';
import { walkingHeldForFeet } from '@/categories';
import { deriveHealth, profileGaps } from '@/engine/health';

export function whatChanges(before: UserProfile, after: UserProfile): string[] {
  const b = deriveHealth(before.health);
  const a = deriveHealth(after.health);
  return [
    a.hypoRisk && !b.hypoRisk && 'Before exercise, you’ll be asked for a glucose reading.',
    a.ketoneRisk && !b.ketoneRisk && 'Each check-in will ask about ketones and the signs of ketoacidosis.',
    walkingHeldForFeet(after) && !walkingHeldForFeet(before) && 'Walks stay off while your foot needs weight kept off it.',
    profileGaps(after).medicinesUnknown && !profileGaps(before).medicinesUnknown && 'Sessions wait until your diabetes medicines are answered.',
  ].filter((x): x is string => typeof x === 'string');
}
```

Run: `npx vitest run src/setup/edit.test.ts src/setup/changes.test.ts`
Expected: PASS.

- [ ] **Step 4: Profile & health** `src/screens/setup/ProfileHealthScreen.tsx`

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TriangleAlertIcon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { dayOf, nowAt } from '@/health/observation';
import { NOT_ADVICE } from '@/reminders/copy';
import { CHAPTER_TITLE } from '@/setup/graph';
import { chapterHref } from '@/setup/progress';
import { REVIEW_LABEL, chapterSections, reviewNeeded } from '@/screens/you/summaries';
import { useStore } from '@/store/useStore';

const REVIEW_FOOTER = {
  health: 'These answers came from an older version of the app and have not been checked. Sessions use them to stay safe.',
  medicines: 'Until your diabetes medicines are answered, sessions stay on hold: some medicines change what is safe before exercise.',
  sglt2: 'Whether you take a “-gliflozin” medicine changes what is safe before exercise. They are prescribed for heart and kidney conditions as well as diabetes.',
} as const;

/**
 * Profile & health (journey §16): the setup chapters' answers, read back from
 * the record, each with Edit, which opens its own pages. An answer that needs
 * a review comes first, as in v1.
 */
export function ProfileHealthScreen() {
  const { settings, profile } = useStore();
  const [today] = useState(() => dayOf(nowAt()));
  const review = reviewNeeded(profile);
  return (
    <Screen title="Profile & health" back={{ to: '/me', label: 'Me' }}>
      {/* The calendar notice v1's Profile & health shows: copy it here as ProfileScreen.tsx has it (D-01, D67). */}
      {review && (
        <Group footer={REVIEW_FOOTER[review]}>
          <Row as={Link} to={chapterHref(review === 'health' ? 'health' : 'medicines')} viewTransition
            icon={<TriangleAlertIcon className="text-caution" />} label={REVIEW_LABEL[review]} detail={review === 'sglt2' ? 'Answer it now' : 'Answer them now'} chevron />
        </Group>
      )}
      {profile && chapterSections(profile, settings, today).map(s => (
        <Group key={s.chapter} header={CHAPTER_TITLE[s.chapter]}>
          {s.rows.map(r => <Row key={r.label} label={r.label} detail={r.value} />)}
          <Row as={Link} to={chapterHref(s.chapter)} viewTransition aria-label={`Edit ${CHAPTER_TITLE[s.chapter]}`} label={<span className="text-tint">Edit</span>} />
        </Group>
      ))}
      <p className="px-4 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
        Your answers stay on this device. The app uses them to keep each session safe and never shares them. {NOT_ADVICE}
      </p>
    </Screen>
  );
}
```

Replace the `{/* The calendar notice … */}` comment with the `<CalendarStill …/>` element (or what Plan 4 put in its place) exactly as `src/screens/you/ProfileScreen.tsx` renders it, and bring its imports.

- [ ] **Step 5: The chapter editor** `src/screens/setup/ChapterEditor.tsx`

```tsx
import { useState } from 'react';
import { Screen } from '@/components/hig/Screen';
import { dayOf, nowAt } from '@/health/observation';
import { measurementsFrom } from '@/setup/assemble';
import { whatChanges } from '@/setup/changes';
import { editChapters, editPath, editedRecord } from '@/setup/edit';
import { CHAPTER_TITLE, SAFETY_CHAPTERS, chapterOf, commitPage, pageDef, pageDone } from '@/setup/graph';
import { answersToEdit } from '@/setup/prefill';
import { setupStateOf } from '@/setup/state';
import { Notice, PrimaryButton } from '@/screens/you/controls';
import { getState, update, useStore } from '@/store/useStore';
import type { ChapterId, SetupAnswers } from '@/types/setup';
import { Missing } from './controls';
import { PAGE_VIEWS } from './pages';
import { PAGE_TITLE } from './titles';
import { useCtx } from './useSetup';

/**
 * One chapter of Profile & health (journey §16, board D79): its own page
 * views, one under another, and any page the change makes necessary, with
 * one Save. While a health review is pending, the three safety chapters open
 * together: only all three answered clear it.
 */
export function ChapterEditor({ chapter }: { chapter: ChapterId }) {
  const { settings, profile } = useStore();
  const ctx = useCtx();
  const [today] = useState(() => dayOf(nowAt()));
  const reviewing = profile?.needsHealthReview === true && SAFETY_CHAPTERS.includes(chapter);
  const asked: readonly ChapterId[] = reviewing ? SAFETY_CHAPTERS : [chapter];
  const [opened] = useState<SetupAnswers>(() => (profile ? answersToEdit(setupStateOf(settings, profile).answers, profile, settings, today, ctx) : {}));
  const [edits, setEdits] = useState<Partial<SetupAnswers>>({});
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ tone: 'status' | 'error'; lines: string[] }>();
  const a: SetupAnswers = { ...opened, ...edits };
  const chapters = editChapters(asked, a, opened);
  const pages = editPath(chapters, a, opened, ctx);
  const committed = pages.reduce((x, id) => commitPage(id, x), a);
  const left = pages.filter(id => !pageDone(id, committed, ctx));
  const blocking = left.filter(id => !pageDef(id).skippable);

  const set = (patch: Partial<SetupAnswers>) => {
    setOutcome(undefined);
    setEdits(e => ({ ...e, ...patch }));
  };

  const save = async () => {
    if (busy || !profile) return;
    if (blocking.length > 0) {
      setTried(true);
      return;
    }
    setBusy(true);
    const now = nowAt();
    const edit = { chapters, opened, answers: committed, skipped: left };
    const saved = await update(d => editedRecord(d, edit, today, ctx), { addObservations: measurementsFrom(committed, profile, now) });
    setBusy(false);
    if (!saved.ok) {
      setOutcome({ tone: 'error', lines: [`That did not save. ${saved.failure.message}`] });
      return;
    }
    setTried(false);
    const after = getState().profile;
    setOutcome({ tone: 'status', lines: ['Saved. Home uses your new answers.', ...(after ? whatChanges(profile, after) : [])] });
  };

  return (
    <Screen title={CHAPTER_TITLE[chapter]} back={{ to: '/me/profile', label: 'Profile & health' }}>
      {reviewing && <Notice>Your health answers need a review. Check each answer, then Save.</Notice>}
      {pages.map((id, i) => {
        const View = PAGE_VIEWS[id as keyof typeof PAGE_VIEWS];
        const own = chapterOf(id);
        const first = i === 0 || chapterOf(pages[i - 1]) !== own;
        return (
          <section key={id} aria-labelledby={`edit-${id}`} className="flex flex-col gap-3">
            {first && own !== chapter && own !== 'review' && (
              <p className="px-1 text-[length:var(--text-footnote)] font-semibold uppercase tracking-wide text-muted-foreground">{CHAPTER_TITLE[own]}</p>
            )}
            <h2 id={`edit-${id}`} className="px-1 text-[length:var(--text-title-2)] font-semibold leading-snug">{PAGE_TITLE[id]}</h2>
            <View a={a} set={set} tried={tried} ctx={ctx} mode="edit" />
          </section>
        );
      })}
      <div className="flex flex-col gap-2">
        <Missing show={tried && blocking.length > 0}>Answer the questions marked above, then Save.</Missing>
        {outcome?.lines.map(line => <Notice key={line} tone={outcome.tone}>{line}</Notice>)}
        <PrimaryButton className="min-h-[3.75rem]" disabled={busy} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</PrimaryButton>
      </div>
    </Screen>
  );
}
```

- [ ] **Step 6: Me routes to them.**
  - In `src/screens/you/routes.tsx`, replace `Profile()` and its comment with the code below. Import `ChapterEditor` and `ProfileHealthScreen` from `@/screens/setup/…`, `useStore`, `useSetupSession` from `@/setup/draft`, `setupStateOf` from `@/setup/state` and `CHAPTER_IDS` from `@/types/setup`, and remove the `FocusScreen` and `ProfileScreen` imports.

    ```tsx
    /**
     * `/me/profile`, Profile & health (journey §16): the chapters' answers, and
     * `?chapter=…` for a chapter's own pages (§19.2). While setup is unfinished,
     * it is setup itself, carrying on where it stopped (L-20, board D80).
     */
    function Profile() {
      const [params] = useSearchParams();
      const { settings, profile } = useStore();
      const session = useSetupSession();
      if (!profile || session.entered || setupStateOf(settings, profile).stage !== 'done') return <Navigate to="/setup" replace />;
      const chapter = params.get('chapter');
      const known = CHAPTER_IDS.find(c => c === chapter && c !== 'welcome');
      return known ? <ChapterEditor key={known} chapter={known} /> : <ProfileHealthScreen />;
    }
    ```

  - In `src/screens/you/MeHome.tsx`, delete the row Plan 4 left as "What you’d like more of" and its comment, as Plan 4 asks: v1's focus choice is now the movement chapter, "Your movement", in Profile & health. A second "Your movement" link on Me, beside a Finish setting up row of that name, would be ambiguous. Remove `CompassIcon` from the lucide import, and the `focus` value the row read if nothing else reads it (`npx tsc -b` and lint say so).

- [ ] **Step 7: Retire v1's wizard.**
  - Delete `src/screens/you/ProfileScreen.tsx`, `src/screens/you/FocusScreen.tsx`, `src/screens/you/WizardCover.tsx` and `src/components/profile/ProfileWizard.tsx`.
  - In `src/screens/you/write.ts`, delete `saveProfileAnswers` and `answeredMetric`, and the `WizardResult` and `answeredProfile` imports. In `write.test.ts`, delete `describe('saveProfileAnswers')`, `saveProfileAnswers` from the import list and the `WizardResult` import.
  - In `src/screens/you/copies.test.ts`, delete the case `'a body edit in one keeps the health answers the other saved meanwhile'`, the `wizard` helper and the `WizardResult` import. Task 14's `edit.test.ts` covers the same rule for the chapter editor.
  - In `src/screens/you/summaries.ts`, delete `profileSections`, `SummarySection` and the `WizardStep` import, and their tests in `summaries.test.ts`. Keep `SummaryRow`.
  - In `src/components/profile/wizardSteps.ts`, delete every export nothing outside the file and its test reads now. Check each one:

    ```bash
    for n in wizardSteps WIZARD_STEPS WizardStep programmeInFlow asksStartDate startDateMissing requiredMedicines medicinesAnswered submittedWeightKg StepGate canLeave stepTitle finishLabel finalProfile answeredProfile; do
      echo "$n: $(grep -rlw "$n" src | grep -v 'components/profile/wizardSteps' | tr '\n' ' ')"
    done
    ```

    Delete each name with nothing after its colon, and its `describe` or `it` blocks in `wizardSteps.test.ts`. Keep `MedicineQuestion`, `DIABETES_MEDICINES`, `BP_MEDICINES`, `answeredOnOpen`, `weightFieldText`, `convertWeightText`, `metforminYearProblem`, `ladderAfterEdit`, `ProfileChange`, `profileChanges` and `withProfileChanges`, which setup reads.
  - Check nothing still imports what's gone:

    ```bash
    grep -rn "ProfileWizard\|WizardCover\|ProfileScreen\|FocusScreen\|WizardResult\|saveProfileAnswers\|profileSections" src
    ```

    Expected: no output.

- [ ] **Step 8: Run the tests, then the gates**

Run: `npx vitest run src/setup src/screens/you src/components`
Expected: PASS.

```bash
npx tsc -b && npm run lint && npx vitest run
```

- [ ] **Step 9: Check by eye.** `npm run dev` with P01 seeded, at 428×926 and 320×568:
  - Me → Profile & health lists About you to Your day and coach, each with `Edit`;
  - `Edit About you`: three pages one under another; change the weight; `Save`: `Saved. Home uses your new answers.`;
  - `Edit Your health`: tick `Foot problems: numbness, a wound or an ulcer`; `Your feet` and `Nerves and feet` appear below, and Save asks for them;
  - with P01's answers under review (`needsHealthReview`), `Edit Your health` shows the three safety chapters with the review line;
  - Back from the editor says "Profile & health", or "Me" when it was opened from Me.

- [ ] **Step 10: Commit**

```bash
git add -A src/setup src/screens/setup src/screens/you src/components/profile
git commit -m "feat: Edit Profile & health chapter by chapter with setup's pages, and retire v1's wizard"
```

---
### Task 15: The upgrade from v1: one inline row, and nothing the engine reads changes

There's no interstitial (§6.6). A v1 record opens Home with its tiles. Directly under the Right now card, one row says what's new, with "Show me" (three short cards) and "Got it". Either answer stores it, and the row goes for good. Upgrade test: for every persona, any chapter saved with the answers read back from the record gives the same profile and the same permissions (A-36).

**Files:**
- Create: `src/screens/home/NewHomeRow.tsx`, `src/setup/upgrade.test.ts`
- Modify: `src/screens/home/HomeScreen.tsx`

**Interfaces:**
- Consumes: `withNewHomeSeen`, `setupStateOf` (Task 4); `answersFromProfile`, `answersToEdit` (Task 6); `editedRecord` (Task 14); `permission`.
- Produces: `NewHomeRow()`, a region named "FitStrong has a new Home".

- [ ] **Step 1: Write the failing test** `src/setup/upgrade.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { AppData } from '@/types';
import type { Mode } from '@/types/checkin';
import type { HealthProfile, UserProfile } from '@/types/profile';
import { CHAPTER_IDS } from '@/types/setup';
import { permission } from '@/engine/permission';
import { createDefaultProfile } from '@/profile/defaults';
import { CURRENT_VERSION, migrateData } from '@/services/storage';
import { profileFrom } from './assemble';
import { editedRecord } from './edit';
import { answersFromProfile, answersToEdit } from './prefill';

const TODAY = '2026-10-08';
const NOW = new Date('2026-10-08T09:00:00+05:30');
const CTX = { thisYear: 2026 };
const MODES: readonly Mode[] = ['guided', 'stretch', 'walk'];

/** codex-acceptance.md's envelope: every persona starts from it. */
const ENVELOPE_HEALTH: Partial<HealthProfile> = {
  diabetes: 'none', insulin: 'none', sulfonylureaOrMeglitinide: false, sglt2i: false, metformin: false, priorDkaOrInsulinDeficiency: false,
  medicinesReviewed: true, highHypoRisk: false, hypertension: 'none', betaBlocker: false, diuretic: false, heartOrVascularDisease: false,
  kidneyDisease: 'none', retinopathy: 'none_or_mild', peripheralNeuropathy: 'no', footStatus: 'healthy', dizzyOnStandingOrAutonomicNeuropathy: false,
  glucoseMonitor: 'none', glucoseUnit: 'mg/dL', ketoneTest: 'none', bpMonitor: false, currentlyActive: true, clearance: 'vigorous',
};
const persona = (health: Partial<HealthProfile>, extra: Partial<UserProfile> = {}): UserProfile => createDefaultProfile({
  weightKg: 78, heightCm: 175, birthYear: 1982, experience: 'beginner', trainingDays: ['monday', 'thursday', 'saturday'], sessionMinutes: 45,
  equipment: 'homeNone', goals: ['flexible'], ladder: { hinge: 2, squat: 2, neuralGate: false }, voice: { muted: true, checked: true },
  figure: 'male', needsHealthReview: false, ...extra, health: { ...ENVELOPE_HEALTH, ...health },
});
const BACK = { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left', worseWith: 'flexion', preference: 'extension' } as const;

const PERSONAS: Record<string, UserProfile> = {
  P01: persona({ diabetes: 'type2', metformin: true, metforminSince: '2019', glucoseMonitor: 'meter', hypertension: 'treated', bpMonitor: true },
    { equipment: 'fullGym', pain: { ...BACK, areas: [...BACK.areas] }, food: { pattern: 'vegetarian', avoid: [], region: 'north' } }),
  P02: persona({}, { trainingDays: [], weightKg: 65 }),
  P03: persona({ diabetes: 'type2', sulfonylureaOrMeglitinide: true, metformin: true, metforminSince: '2023', glucoseMonitor: 'meter' }),
  P04: persona({ diabetes: 'type2', insulin: 'injections_or_pump', insulinRegimen: 'basalOnly', metformin: true, metforminSince: '2022', glucoseMonitor: 'meter' }),
  P05: persona({ diabetes: 'type2', metformin: true, peripheralNeuropathy: 'yes', footStatus: 'current_wound_or_active_charcot' }),
  P06: persona({}, { pain: { ...BACK, areas: [...BACK.areas] } }),
};

const recordOf = (p: UserProfile): AppData => {
  const data = migrateData({ version: CURRENT_VERSION } as AppData);
  return { ...data, profile: p, settings: { ...data.settings, onboardingComplete: true, startDate: '2026-09-24', focus: 'stretch' } };
};

describe('an upgrade from v1 changes nothing the engine reads (journey §6.6; A-36)', () => {
  for (const [name, p] of Object.entries(PERSONAS)) {
    it(`${name}: its answers give back the same profile`, () => {
      expect(profileFrom(answersFromProfile(p, recordOf(p).settings), p, TODAY, CTX)).toEqual(p);
    });

    // A real Save also stores a shown checklist's unticked rows as No (B-08): that's an answer the person gives.
    // This checks the part nobody gives: the answers read back from the record, saved as they are, change nothing.
    it(`${name}: every chapter saved with the answers it opened with keeps the profile and every permission`, () => {
      const data = recordOf(p);
      const opened = answersToEdit(undefined, p, data.settings, TODAY, CTX);
      for (const chapter of CHAPTER_IDS.filter(c => c !== 'welcome')) {
        const after = editedRecord(data, { chapters: [chapter], opened, answers: opened, skipped: [] }, TODAY, CTX);
        expect(after.profile, chapter).toEqual(p);
        for (const mode of MODES) expect(permission({ profile: after.profile!, now: NOW }, mode), `${chapter} ${mode}`).toEqual(permission({ profile: p, now: NOW }, mode));
      }
    });
  }
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/setup/upgrade.test.ts`
Expected: PASS, unless a mapping changes a v1 value. A failure names the persona and the chapter; read the diff against `answersFromProfile` and `healthFrom`, as in Task 6 Step 4. Fix the mapping, never the test.

- [ ] **Step 3: The row** `src/screens/home/NewHomeRow.tsx`

```tsx
import { useState } from 'react';
import { Sheet } from '@/components/hig/Sheet';
import { withNewHomeSeen } from '@/setup/state';
import { PrimaryButton } from '@/screens/you/controls';
import { update } from '@/store/useStore';

const CARDS = [
  { title: 'Your tiles are here', text: 'Home has a tile for each thing you keep track of, worked out from your answers. Edit Home changes them.' },
  { title: 'Trends is new', text: 'Trends shows how each one is going, week by week.' },
  { title: 'Browse is new', text: 'Browse lists everything FitStrong has, with a search.' },
] as const;

/**
 * The one-time "FitStrong has a new Home" row (journey §6.6, K-56): inline,
 * directly under the Right now card, never floating. "Show me" walks three
 * short cards; "Got it", or Done on the last card, stores the answer, and the
 * row goes for good.
 */
export function NewHomeRow() {
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState(0);
  const [problem, setProblem] = useState<string>();
  const seen = async () => {
    const saved = await update(withNewHomeSeen);
    if (!saved.ok) setProblem(`That did not save. ${saved.failure.message}`);
  };
  const last = card === CARDS.length - 1;

  return (
    <section aria-label="FitStrong has a new Home" className="flex flex-col gap-2 rounded-xl bg-grouped-card p-4">
      <p className="text-[length:var(--text-body)] leading-snug">FitStrong has a new Home. Your tiles are here; Trends and Browse are new.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setCard(0); setOpen(true); }}
          className="press-feedback min-h-12 rounded-xl bg-tint/10 px-4 text-[length:var(--text-body)] font-semibold text-tint">Show me</button>
        <button type="button" onClick={() => void seen()} className="press-feedback min-h-12 rounded-xl px-4 text-[length:var(--text-body)] text-tint">Got it</button>
      </div>
      {problem && <p role="alert" className="text-[length:var(--text-subhead)] text-stop">{problem}</p>}
      <Sheet open={open} onOpenChange={setOpen} title={CARDS[card].title}>
        <p className="px-1 text-[length:var(--text-body)] leading-snug">{CARDS[card].text}</p>
        <p className="px-1 text-[length:var(--text-subhead)] text-muted-foreground">{card + 1} of {CARDS.length}</p>
        <PrimaryButton onClick={() => {
          if (!last) {
            setCard(card + 1);
            return;
          }
          setOpen(false);
          void seen();
        }}>{last ? 'Done' : 'Next'}</PrimaryButton>
      </Sheet>
    </section>
  );
}
```

- [ ] **Step 4: Home shows it.** In `src/screens/home/HomeScreen.tsx`:
  - import `NewHomeRow` from `./NewHomeRow` and `setupStateOf` from `@/setup/state`;
  - after `const still = …`, add:

    ```tsx
      const setup = setupStateOf(settings, profile);
      // Once, for a record set up in v1, and never beside a safety state (§6.6, motion rule 2).
      const newHome = setup.stage === 'done' && setup.upgraded === true && setup.newHomeSeen !== true && !still;
    ```

  - directly after the closing `</div>` of the `RIGHT_NOW_ID` block, before any other row, add `{newHome && <NewHomeRow />}`. It must be the next element after that block (J02, V-J13).
  - the greeting no longer needs its cast: `greeting(now, profile?.name)`.

- [ ] **Step 5: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/home/NewHomeRow.tsx src/screens/home/HomeScreen.tsx src/setup/upgrade.test.ts
git commit -m "feat: Show v1 users one inline row about the new Home, and prove the upgrade changes nothing"
```

---

### Task 16: Acceptance: setup and the profile editor, through the browser

The six V-J journeys, J01 and J02 as rewritten in Task 1, and the journeys that walked v1's Welcome or profile wizard. A helper answers setup by its visible questions, so each journey reads as the person's steps.

**Files:**
- Create: `scripts/e2e/acceptance/lib/setup.mjs`
- Modify: `scripts/e2e/acceptance/lib/inpage.mjs` (`capabilityInit`), `scripts/e2e/acceptance/run.mjs`
- Create: `scripts/e2e/acceptance/journeys/v10.mjs`, `v11.mjs`, `v13.mjs`, `v17.mjs`, `v18.mjs`, `v37.mjs`
- Modify: `scripts/e2e/acceptance/journeys/j01.mjs`, `j02.mjs`, `j03.mjs`, `j12.mjs`, `j14.mjs`, `j17.mjs`, `j20.mjs`, `s01.mjs`, `m01.mjs`

**Interfaces:**
- Consumes: the harness (`t.open`, `t.step`, `t.check`, `t.must`, `t.checkpoint`, `t.db`, `t.reload`, `t.goto`, which reloads, `t.hash`, which doesn't, `t.route`, `t.note`, `t.setPageFaults`, `t.setFaults`, `t.faultLog`, `t.allowConsole`); `docs`; `lib/ui.mjs`; `lib/data.mjs`; `lib/move.mjs`; `persona`.
- Produces, in `lib/setup.mjs`:
  - `REVIEW`, `ACKNOWLEDGEMENT`;
  - `P07`, `P02`, `UNSURE` (answers in the person's words);
  - `choose(scope, question, option)`, `tick(scope, name, on?)`, `fill(scope, label, text)`;
  - `answerPage(scope, heading, a)`, `throughSetup(t, a, { until?, checkpoint?, onPage? })`, `startUsing(t)`;
  - `openChapter(t, title)`, `save(t, { expectSaved? })`, `reviewAsP01(main)`.
- Produces: `capabilityInit` options `standalone: true` and `persist: 'refuse'`.

- [ ] **Step 1: The helper** `scripts/e2e/acceptance/lib/setup.mjs`

```js
/**
 * Setup, and Me's chapter editor, answered by their visible questions
 * (journey §6.2, §16; Plan 5). A journey says what the person answers, in
 * the words on screen; these find each control by its question and answer
 * it. Both places draw the same page views, so one map serves both.
 */
import * as ui from './ui.mjs';

export const REVIEW = 'Here’s what we’ll do for you';
export const ACKNOWLEDGEMENT = 'I understand this is general information, not medical advice. I will stop and get help for chest pain, faintness or severe breathlessness, and follow my care team’s medication plan.';

/** P07's answers (codex-acceptance J01): nothing to report, nothing turned on. */
export const P07 = {
  figure: 'Either', conditions: 'none', regular: 'No', glucoseMonitor: 'Neither', bpCuff: 'No',
  focus: 'Not sure yet', active: 'No, not like that', goal: 'No goal for now', programme: 'Not now',
  pattern: 'Vegetarian', allergies: 'none', level: 'No, meal ideas only',
};
/** P02 (V-J37): the same, leading with stretching. */
export const P02 = { ...P07, focus: 'Stretch more' };
/** "Not sure" wherever it's offered, after Diabetes "Not sure" and High blood pressure (V-J17). */
export const UNSURE = {
  ...P07,
  diabetesType: 'Not sure', bpMedicine: 'Not sure', clearance: 'Not sure', targets: 'Not sure',
  regular: 'Not sure', classes: 'unsure', insulinHow: 'Not sure', lowsRisk: 'Not sure', priorDka: 'Not sure', ketoneTest: 'No', dizzy: 'Not sure',
};

/**
 * A control by its label. A row with a detail line is named by both
 * ("Not sure yet Look around before you choose."), so when the exact name
 * finds nothing, the row holding the label's own text is taken.
 */
async function labelled(scope, role, label) {
  const byName = scope.getByRole(role, { name: label, exact: true });
  return (await byName.count()) ? byName : ui.row(scope, label, role);
}

/** A radio row in the group named by its question; nothing when no answer is given. */
export async function choose(scope, question, option) {
  if (option === undefined) return;
  await ui.tap(await labelled(scope.getByRole('radiogroup', { name: question, exact: true }), 'radio', option));
}

/** A checkbox by its name, ticked or not as asked: tapped only when it isn't already. */
export async function tick(scope, name, on = true) {
  const box = await labelled(scope, 'checkbox', name);
  if ((await box.getAttribute('aria-checked') === 'true') !== on) await ui.tap(box);
}

/** A field by its label, typed a key at a time, as a phone keyboard does. */
export async function fill(scope, label, text) {
  await ui.type(scope.getByLabel(label, { exact: true }), String(text));
}

const ticks = async (s, list, prefix) => {
  for (const [label, v] of Object.entries(list ?? {})) await tick(s, v === 'unsure' ? `${prefix}${label}` : label, v !== 'no');
};

/** Each page, by its heading, answered from `a`. A key left out leaves its question as it is. */
const PAGES = {
  'What should we call you?': async (s, a) => {
    if (a.name !== undefined) await fill(s, 'Name (optional)', a.name);
    if (a.year !== undefined) await fill(s, 'Year you were born (optional)', a.year);
    await choose(s, 'Are you 18 or over?', a.adult);
  },
  'Body for the exercise demos': (s, a) => choose(s, 'Body for the exercise demos', a.figure),
  'Your height and weight': async (s, a) => {
    await choose(s, 'Units', a.units);
    if (a.heightCm !== undefined) await fill(s, 'Height in cm', a.heightCm);
    if (a.weightKg !== undefined) await fill(s, 'Weight in kg', a.weightKg);
  },
  'Do you have any of these?': (s, a) => (a.conditions === 'none' ? tick(s, 'None of these') : ticks(s, a.conditions, 'Not sure: ')),
  'Which type of diabetes?': (s, a) => choose(s, 'Which type of diabetes?', a.diabetesType),
  'High blood pressure': (s, a) => choose(s, 'Do you take medicine for high blood pressure?', a.bpMedicine),
  'Heart, kidneys and fluids': async (s, a) => {
    await choose(s, 'Are you on dialysis, or have you had a kidney transplant?', a.kidneyTreatment);
    await choose(s, 'Has a doctor given you a fluid limit?', a.fluidLimit);
  },
  'Your eyes': async (s, a) => {
    await choose(s, 'Eye treatment or surgery in the last 3 months?', a.eyeTreatment);
    await choose(s, 'How bad is the eye disease from diabetes?', a.eyeDisease);
  },
  'Your feet': async (s, a) => {
    await choose(s, 'Numbness or loss of feeling in your feet?', a.feetNumb);
    await choose(s, 'A wound, an ulcer or a Charcot foot?', a.footWound);
  },
  'Exercise limits from a clinician': async (s, a) => {
    await choose(s, 'Has a clinician cleared you to exercise?', a.clearance);
    await choose(s, 'Has a clinician given you any limits or targets?', a.targets);
  },
  'Your medicines': (s, a) => choose(s, 'Do you take any regular medicines?', a.regular),
  'Do any of these apply?': async (s, a) => {
    if (a.classes === 'unsure') await tick(s, 'Not sure about any of these');
    else await ticks(s, a.classes, 'Not sure: ');
    if (a.metforminSince !== undefined) await fill(s, 'Year you started metformin (optional)', a.metforminSince);
  },
  'Insulin and lows': async (s, a) => {
    await choose(s, 'How do you take insulin?', a.insulinHow);
    await choose(s, 'A severe low in the last 6 months, or do you often not feel lows coming?', a.lowsRisk);
  },
  Ketones: async (s, a) => {
    await choose(s, 'Ever had diabetic ketoacidosis (DKA), or been told your body makes too little insulin?', a.priorDka);
    await choose(s, 'Can you test ketones?', a.ketoneTest);
  },
  'Standing up': (s, a) => choose(s, 'Do you get dizzy when you stand up?', a.dizzy),
  'What do you have at home?': async (s, a) => {
    await choose(s, 'Glucose meter or sensor', a.glucoseMonitor);
    await choose(s, 'Glucose unit', a.glucoseUnit);
    await choose(s, 'Home blood-pressure cuff', a.bpCuff);
  },
  'Where does it hurt?': async (s, a) => {
    if (a.areas === 'none') await tick(s, 'None of these right now');
    else for (const area of a.areas ?? []) await tick(s, area);
  },
  'Your back and leg': async (s, a) => {
    await choose(s, 'Which leg?', a.leg);
    await choose(s, 'What makes it worse?', a.worse);
  },
  'Nerves and feet': async (s, a) => {
    await choose(s, 'Has a doctor ever said a nerve in your back or leg was damaged?', a.neuro);
    await choose(s, 'Has a clinician told you to keep weight off a foot?', a.footRestriction);
  },
  'What would you most like to do?': async (s, a) => {
    await choose(s, 'What would you most like to do?', a.focus);
    await choose(s, 'Do you exercise now?', a.active);
  },
  'Your weekly goal': (s, a) => choose(s, 'Your weekly goal', a.goal),
  'Join the 12-week strength programme?': (s, a) => choose(s, 'Join the 12-week strength programme?', a.programme),
  'How do you eat?': async (s, a) => {
    await choose(s, 'How do you eat?', a.pattern);
    if (a.allergies === 'none') await tick(s, 'No food allergies');
    else for (const x of a.allergies ?? []) await tick(s, x);
  },
  'Would you like to log what you eat?': async (s, a) => {
    await choose(s, 'Would you like to log what you eat?', a.level);
    await choose(s, 'Has food or weight ever been hard for you?', a.screen);
  },
  Reminders: async () => {},
  'When do you usually finish your meals?': async () => {},
  'Your voice coach': (s, a) => choose(s, 'Voice coach', a.voice),
};

/** Answer the page shown in `scope`, found by its heading. */
export async function answerPage(scope, heading, a) {
  const answer = PAGES[heading];
  if (!answer) throw new Error(`a setup page this helper doesn't know: “${heading}”`);
  await answer(scope, a);
}

const h1 = async page => (await page.getByRole('main').getByRole('heading', { level: 1 }).innerText()).trim();

/**
 * Answer setup a page at a time, from wherever it is, until `until` (Review
 * by default), with "Skip for now" on the pages `a.skip` names. `onPage`
 * looks at each page, `until` included, before it's answered. Returns the
 * headings seen. A page that won't move on is a failure that names it.
 */
export async function throughSetup(t, a, { until = REVIEW, checkpoint = false, onPage } = {}) {
  const page = t.page;
  const main = page.getByRole('main');
  const seen = [];
  for (let i = 0; i < 32; i++) {
    const heading = await h1(page);
    seen.push(heading);
    if (onPage) await onPage(heading);
    if (heading === until) return seen;
    if (checkpoint) await t.checkpoint(`setup-${heading.replace(/\W+/g, '-').toLowerCase()}`);
    if (heading === 'Welcome') {
      await ui.tap(ui.button(main, 'Get started'));
    } else if ((a.skip ?? []).includes(heading)) {
      await ui.tap(ui.button(main, 'Skip for now'));
    } else {
      await answerPage(main, heading, a);
      await ui.tap(ui.button(main, 'Next'));
    }
    await page.waitForFunction(was => document.querySelector('main h1')?.textContent?.trim() !== was, heading, { timeout: 10000 })
      .catch(() => { throw new Error(`setup stayed on “${heading}” after its answers (${seen.join(' → ')})`); });
  }
  throw new Error(`setup did not reach “${until}”: ${seen.join(' → ')}`);
}

/** Review: tick the acknowledgement, then Start using FitStrong; returns once Home is up. */
export async function startUsing(t) {
  const main = t.page.getByRole('main');
  await tick(main, ACKNOWLEDGEMENT);
  await ui.tap(ui.button(main, 'Start using FitStrong'));
  await t.page.getByRole('heading', { level: 1, name: ui.HOME_TITLE }).waitFor({ timeout: 15000 });
  await t.ready();
}

/** Me → Profile & health → Edit {title}, as a person gets there. Returns the main landmark. */
export async function openChapter(t, title) {
  const page = t.page;
  await ui.tab(page, 'Me');
  await ui.heading(page, 'Me');
  const main = page.getByRole('main');
  await ui.tap(ui.row(main, 'Profile & health', 'link'));
  await ui.heading(page, 'Profile & health');
  await ui.tap(ui.link(main, `Edit ${title}`));
  await ui.heading(page, title);
  return main;
}

/** The chapter editor's Save; waits for its confirmation unless the save is meant to fail. */
export async function save(t, { expectSaved = true } = {}) {
  const main = t.page.getByRole('main');
  await ui.tap(ui.button(main, 'Save'));
  if (expectSaved) await main.getByText('Saved. Home uses your new answers.', { exact: true }).waitFor({ timeout: 15000 });
}

/** P01's review (codex-acceptance J02 step 3): what the variant left unanswered, in the review editor. */
export async function reviewAsP01(main) {
  await choose(main, 'Has a clinician given you any limits or targets?', 'No');
  await choose(main, 'Do you take any regular medicines?', 'Yes');
  await tick(main, 'Metformin');
  await fill(main, 'Year you started metformin (optional)', '2019');
  await choose(main, 'Ever had diabetic ketoacidosis (DKA), or been told your body makes too little insulin?', 'No');
  await choose(main, 'Has a doctor ever said a nerve in your back or leg was damaged?', 'No');
}
```

- [ ] **Step 2: The iPhone capabilities.** In `scripts/e2e/acceptance/lib/inpage.mjs`, append to `capabilityInit` (before its closing brace):

```js
  if (opts.standalone === true) {
    // The installed Home Screen app (V-J37): display-mode standalone, and Safari's own flag.
    const real = window.matchMedia.bind(window);
    window.matchMedia = query => (/display-mode:\s*(standalone|fullscreen|minimal-ui)/.test(query)
      ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }
      : real(query));
    try { Object.defineProperty(Navigator.prototype, 'standalone', { configurable: true, get: () => true }); } catch { /* ignore */ }
  }
  if (opts.persist === 'refuse' && navigator.storage) {
    // Temporary storage (B-30): the browser keeps the right to clear it. Asking is still counted, as `sensorInit` counts it.
    const calls = window.__acc?.calls;
    navigator.storage.persist = () => {
      if (typeof calls?.persist === 'number') calls.persist += 1;
      return Promise.resolve(false);
    };
    navigator.storage.persisted = () => Promise.resolve(false);
  }
```

In `scripts/e2e/acceptance/run.mjs`, the journey file pattern must take `v` and `m` files. Plans 2 and 4 widened it; if it still reads `/^[js]\d\d\.mjs$/`, make it `/^[jsvm]\d\d\.mjs$/`.

- [ ] **Step 3: V-J10** `scripts/e2e/acceptance/journeys/v10.mjs`

```js
/**
 * V-J10, P01: change my weight in Me (journey §16, §18.1; board D83).
 * A weight change is a dated reading; a page saved in other units drifts nothing (Review Focus 2).
 */
import { docs } from '../lib/harness.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as setup from '../lib/setup.mjs';

export const id = 'V-J10';
export const title = 'Change my weight';
export const safety = false;

const weights = snap => (snap.observations ?? []).filter(o => o.kind === 'weight');
const brief = o => ({ v: o.value, unit: o.unit, scope: o.scope, source: o.source, context: o.context, day: o.day, timeUnknown: o.timeUnknown });

export const cases = [{
  name: 'main',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/home' });
    let before;
    await t.step(1, 'Me → Profile & health → Edit About you', async () => {
      before = await t.db();
      const main = await setup.openChapter(t, 'About you');
      for (const h of ['What should we call you?', 'Body for the exercise demos', 'Your height and weight']) {
        await t.check(await main.getByRole('heading', { level: 2, name: h, exact: true }).count() === 1, `About you does not show “${h}”`);
      }
      await t.checkpoint('edit-about-you');
    });
    await t.step(2, 'Weight 80 kg; Save', async () => {
      await setup.fill(page.getByRole('main'), 'Weight in kg', '80');
      await setup.save(t);
      const snap = await t.checkpoint('about-you-saved');
      const added = weights(snap).filter(o => !weights(before).some(b => b.id === o.id));
      await t.check(added.length === 1 && added[0].value === 80 && added[0].unit === 'kg' && added[0].scope === 'pointInTime'
        && added[0].source === 'manual' && added[0].context === 'profile' && added[0].day === '2026-10-08' && !added[0].timeUnknown,
        `the new weight readings: ${JSON.stringify(added.map(brief))}`);
      const migrated = weights(before).find(o => o.day === '2026-09-25');
      await t.check(!!migrated && JSON.stringify(weights(snap).find(o => o.id === migrated.id)) === JSON.stringify(migrated), 'the migrated 25 September weight changed');
      const d = docs(snap);
      const was = docs(before).profile ?? {};
      await t.check(d.profile?.weightKg === 80 && d.settings?.currentWeight === 80, `weight is ${d.profile?.weightKg} in the profile, ${d.settings?.currentWeight} in the settings`);
      const changed = Object.keys(d.profile ?? {}).filter(k => k !== 'weightKg' && JSON.stringify(d.profile[k]) !== JSON.stringify(was[k]));
      await t.check(changed.length === 0, `other profile fields changed: ${changed.join(', ')}`);
      await t.check(!(snap.observations ?? []).some(o => o.kind === 'height'), 'a height reading was added though the height did not change');
    }, { input: 'weight 80 kg' });
    await t.step(3, 'The Weight hub shows it, dated today', async () => {
      await t.goto('/hub/weight');
      const text = (await page.getByRole('main').innerText()).replace(/\s+/g, ' ');
      await t.checkpoint('weight-hub');
      await t.check(/\b80(\.0)?\s?kg/.test(text), `the Weight hub does not show 80 kg: ${text.slice(0, 300)}`);
    });
    await t.step(4, 'Feet and pounds, saved unchanged: nothing drifts (Review Focus 2)', async () => {
      const count = (await t.db()).observations?.length ?? 0;
      const main = await setup.openChapter(t, 'About you');
      await setup.choose(main, 'Units', 'ft, in and lb');
      await setup.save(t);
      const snap = await t.db();
      const d = docs(snap);
      await t.check(d.settings?.useMetric === false, `useMetric is ${d.settings?.useMetric}`);
      await t.check(d.profile?.weightKg === 80 && d.profile?.heightCm === 175, `after saving in feet and pounds: ${d.profile?.weightKg} kg, ${d.profile?.heightCm} cm`);
      await t.check((snap.observations?.length ?? 0) === count, 'saving unchanged values in other units added a reading');
    }, { input: 'Units ft, in and lb; Save' });
  },
}];
```

- [ ] **Step 4: V-J11** `scripts/e2e/acceptance/journeys/v11.mjs`

```js
/**
 * V-J11, P01: back up, and restore on a new phone from setup's page 1
 * (journey §6.4). A backup with a finished profile goes straight to Home; one
 * without carries setup on with its answers.
 */
import { docs } from '../lib/harness.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J11';
export const title = 'Back up, and restore on a new phone';
export const safety = false;

const restoreDraft = async (t, file) => {
  const sheet = await data.chooseRestore(t, file, { from: 'welcome' });
  await ui.tap(ui.button(sheet, 'Restore'));
  await data.waitOutcome(t, sheet);
  await t.check(/Restored\./.test(await sheet.innerText()), `the restore did not finish: ${(await sheet.innerText()).slice(0, 200)}`);
  await ui.tap(ui.button(sheet, 'Done'));
  await sheet.waitFor({ state: 'hidden' });
};

export const cases = [
  {
    name: 'finished record',
    async run(t) {
      await t.open({ seed: persona('P01'), route: '/home' });
      let made;
      let before;
      await t.step(1, 'Me → Data → Back up your record', async () => {
        made = await data.backup(t, { expectVia: 'download' });
        before = data.decodeBackup(made.bytes);
      });
      await t.step(2, 'A fresh context opens setup’s page 1', async () => {
        await t.context.close();
        const page = await t.open({ seed: null, route: '' });
        await t.must(await page.getByRole('heading', { level: 1, name: 'Welcome', exact: true }).count() === 1, 'a fresh phone does not open setup’s page 1');
      });
      await t.step(3, 'Restore from a backup → the file → Restore: a preview, then Home', async () => {
        const sheet = await data.chooseRestore(t, data.writeFixture(t, made.name, made.bytes), { from: 'welcome' });
        // The preview J18 reads, before anything is written.
        await t.check(/In this file/i.test(await sheet.innerText()), 'no preview before restoring from page 1');
        await t.check(((await t.db()).observations ?? []).length === 0, 'choosing the file wrote records before Restore was tapped');
        await t.checkpoint('restore-preview');
        await ui.tap(ui.button(sheet, 'Restore'));
        await data.restoredFromWelcome(t, sheet);
        const snap = await t.checkpoint('restored-home');
        const diffs = data.compareLogical(data.logicalFromDoc(before, { ignoreExportDate: true }), data.logical(snap, { ignoreExportDate: true }), { label: ['file', 'restored'] });
        await t.check(diffs.length === 0, `the restored record differs from the file: ${diffs.slice(0, 5).join(' | ')}`);
      });
    },
  },
  {
    name: 'a backup made part-way through setup',
    async run(t) {
      const page = await t.open({ seed: null, route: '' });
      const main = page.getByRole('main');
      const file = data.writeFixture(t, 'setup-draft.json', data.transferDoc({
        settings: {
          onboardingComplete: false, theme: 'system', useMetric: true, startDate: '',
          setup: { stage: 'open', skipped: [], draft: { at: 'health.conditions', answers: { figure: 'female', metric: true } } },
        },
      }));
      await t.step(4, 'Restore it from page 1, then Get started: setup carries on where it stopped', async () => {
        await restoreDraft(t, file);
        await ui.tap(ui.button(main, 'Get started'));
        await ui.heading(page, 'Do you have any of these?');
        await t.check(await t.route() === '/setup/health/conditions', `opened ${await t.route()}`);
        await t.check(await main.getByText('Welcome back, let’s carry on.', { exact: true }).count() === 1, 'no “Welcome back, let’s carry on.”');
        await ui.tap(ui.button(main, 'Back'));
        await ui.heading(page, 'Your height and weight');
        await ui.tap(ui.button(main, 'Back'));
        await ui.heading(page, 'Body for the exercise demos');
        await t.check(await ui.radio(main.getByRole('radiogroup', { name: 'Body for the exercise demos', exact: true }), 'Female figure').getAttribute('aria-checked') === 'true',
          'the restored answer “Female figure” is not chosen');
        const snap = await t.checkpoint('restored-draft');
        await t.check(docs(snap).settings?.setup?.draft?.answers?.figure === 'female', 'the draft’s answers were not restored');
      });
    },
  },
];
```

- [ ] **Step 5: V-J13** `scripts/e2e/acceptance/journeys/v13.mjs`

```js
/**
 * V-J13, P01: the upgrade from v1 (journey §6.6). No interstitial, one inline
 * row, legacy records with their own dates, and the new chapters waiting in Me.
 */
import { docs } from '../lib/harness.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J13';
export const title = 'Upgrade from v1';
export const safety = false;

const flat = s => s.replace(/\s+/g, ' ').trim();
const row = page => page.getByRole('main').getByRole('region', { name: 'FitStrong has a new Home', exact: true });
const afterRightNow = page => page.evaluate(() => document.getElementById('right-now')?.nextElementSibling?.getAttribute('aria-label') ?? null);

export const cases = [
  {
    name: 'main',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home' });
      const main = page.getByRole('main');
      await t.step(1, 'Home with no dialog; the new-Home row comes first after Right now', async () => {
        await t.check(await page.getByRole('dialog').count() === 0, 'a dialog opened over Home');
        await t.must(await row(page).count() === 1, 'no “FitStrong has a new Home” row');
        await t.check(await afterRightNow(page) === 'FitStrong has a new Home', `the element after Right now is “${await afterRightNow(page)}”`);
        await t.check(await ui.button(row(page), 'Show me').count() === 1 && await ui.button(row(page), 'Got it').count() === 1, 'the row lacks Show me or Got it');
        await t.checkpoint('new-home-row');
      });
      await t.step(2, 'Got it; reload: the row stays gone', async () => {
        await ui.tap(ui.button(row(page), 'Got it'));
        await data.waitDb(t, s => docs(s).settings?.setup?.newHomeSeen === true, 'Got it was not stored');
        await t.reload();
        await t.check(await row(page).count() === 0, 'the row came back after a reload');
        const s = docs(await t.db()).settings?.setup ?? {};
        await t.check(s.stage === 'done' && s.upgraded === true && s.newHomeSeen === true && s.completedAt === undefined, `settings.setup: ${JSON.stringify(s)}`);
      });
      await t.step(3, 'The legacy session, glucose and weight, each with its own date', async () => {
        // Today's log (v1's Track) on 25 September, as J02 reaches it.
        await ui.legacyTab(page, 'Track');
        await ui.trackDay(page, '2026-09-25');
        await t.check(await main.getByRole('link', { name: /^Upper A · Push & Row/ }).count() === 1, 'Today’s log for 25 September does not list the legacy session once');
        for (const [hub, value, what] of [['/hub/glucose', /\b104\b/, '104 mg/dL'], ['/hub/weight', /\b78\b/, '78 kg']]) {
          await t.goto(hub);
          const text = flat(await main.innerText());
          await t.check(value.test(text), `${hub} does not show ${what}: ${text.slice(0, 300)}`);
        }
        const snap = await t.checkpoint('legacy-records');
        const on25 = kind => (snap.observations ?? []).filter(o => o.kind === kind && o.day === '2026-09-25').map(o => o.value);
        await t.check(on25('glucose').includes(104) && on25('weight').includes(78), `the legacy readings are not dated 25 September: glucose ${on25('glucose')}, weight ${on25('weight')}`);
      });
      await t.step(4, 'Me: Finish setting up · 2 short chapters', async () => {
        await ui.tab(page, 'Me');
        const group = ui.section(main, 'Finish setting up · 2 short chapters');
        await t.must(await group.count() === 1, `Me has no “Finish setting up · 2 short chapters”: ${flat(await main.innerText()).slice(0, 300)}`);
        for (const [label, detail, href] of [['About you', 'What to call you', '#/me/profile?chapter=about'], ['Your food', 'Logging what you eat', '#/me/profile?chapter=food']]) {
          const link = ui.row(group, label, 'link');
          await t.check(flat(await link.innerText()).includes(detail), `the ${label} row does not say “${detail}”`);
          await t.check((await link.getAttribute('href'))?.endsWith(href), `the ${label} row opens ${await link.getAttribute('href')}`);
        }
        await t.checkpoint('me-finish-setting-up');
      });
    },
  },
  {
    name: 'show me',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home' });
      await t.step(5, 'Show me → Next, Next, Done', async () => {
        await ui.tap(ui.button(row(page), 'Show me'));
        // Each card is the sheet's title, so the sheet is named by it.
        for (const [i, [title, next]] of [['Your tiles are here', 'Next'], ['Trends is new', 'Next'], ['Browse is new', 'Done']].entries()) {
          const sheet = page.getByRole('dialog', { name: title, exact: true });
          await sheet.waitFor({ timeout: 10000 }).catch(() => {});
          await t.must(await sheet.count() === 1, `card ${i + 1} is not “${title}”`);
          await t.checkpoint(`show-me-${i + 1}`);
          await ui.tap(ui.button(sheet, next));
        }
        await data.waitDb(t, s => docs(s).settings?.setup?.newHomeSeen === true, 'Done was not stored');
        await t.check(await row(page).count() === 0, 'the row stayed after Done');
      });
    },
  },
];
```

- [ ] **Step 6: V-J17** `scripts/e2e/acceptance/journeys/v17.mjs`

```js
/**
 * V-J17, fresh: uncertain answers, and a draft that won't save (journey §6.1,
 * B-07). "Not sure" is stored as "may have"; a refused write stays on its page
 * with its answers; without saving, nothing is stored and every hold applies.
 */
import { docs } from '../lib/harness.mjs';
import * as setup from '../lib/setup.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J17';
export const title = 'Uncertain answers, and a draft that won’t save';
export const safety = true;

/** The settings document refuses every write: the draft can't be stored. */
const FAIL_SETTINGS = [{ op: 'put', store: 'settings', match: { key: 'settings' }, action: 'throwUnknown' }];
const SAVE_FAILED = 'Your answers aren’t being saved on this phone.';
const UNSAVED = 'Your answers aren’t being saved on this phone. If you close FitStrong, they’re lost.';

/** Step 1, shared by both cases: to the conditions, then a refused Next. */
async function refusedNext(t) {
  const page = await t.open({ seed: null, route: '' });
  const main = page.getByRole('main');
  t.allowConsole('acceptance-injected');
  await t.step(1, 'Get started; Next; Skip for now; Next; tick; writes fail; Next', async () => {
    await ui.tap(ui.button(main, 'Get started'));
    await ui.heading(page, 'What should we call you?');
    await ui.tap(ui.button(main, 'Next'));
    await ui.heading(page, 'Body for the exercise demos');
    await ui.tap(ui.button(main, 'Skip for now'));
    await ui.heading(page, 'Your height and weight');
    await ui.tap(ui.button(main, 'Next'));
    await ui.heading(page, 'Do you have any of these?');
    await setup.tick(main, 'Not sure: Diabetes');
    await setup.tick(main, 'High blood pressure');
    const stored = docs(await t.db()).settings?.setup;
    await t.setPageFaults(FAIL_SETTINGS);
    await ui.tap(ui.button(main, 'Next'));
    const alert = main.getByRole('alert').filter({ hasText: SAVE_FAILED });
    await alert.waitFor({ timeout: 10000 });
    await t.check(await ui.button(alert, 'Try again').count() === 1 && await ui.button(alert, 'Continue without saving').count() === 1, 'no Try again or Continue without saving');
    await t.check(await t.route() === '/setup/health/conditions', `the refused Next moved to ${await t.route()}`);
    for (const box of ['Not sure: Diabetes', 'High blood pressure']) {
      await t.check(await main.getByRole('checkbox', { name: box, exact: true }).getAttribute('aria-checked') === 'true', `“${box}” is no longer ticked`);
    }
    await t.checkpoint('draft-refused');
    await t.check(JSON.stringify(docs(await t.db()).settings?.setup) === JSON.stringify(stored), 'the refused draft was stored');
  }, { input: 'Not sure: Diabetes, High blood pressure; settings writes fail' });
  return page;
}

export const cases = [
  {
    name: 'Not sure is stored as may-have',
    async run(t) {
      const page = await refusedNext(t);
      const main = page.getByRole('main');
      await t.step(2, 'Writes work again; Try again; Not sure wherever it’s offered; Start using', async () => {
        await t.setPageFaults(null);
        await ui.tap(ui.button(main, 'Try again'));
        await ui.heading(page, 'Which type of diabetes?');
        await setup.throughSetup(t, setup.UNSURE);
        await setup.startUsing(t);
        const h = docs(await t.checkpoint('unsure-stored')).profile?.health ?? {};
        const want = {
          diabetes: 'other', hypertension: 'unsure', insulin: 'unsure', sulfonylureaOrMeglitinide: 'unsure', sglt2i: 'unsure', metformin: 'unsure',
          betaBlocker: 'unsure', diuretic: 'unsure', priorDkaOrInsulinDeficiency: 'unsure', highHypoRisk: true, dizzyOnStandingOrAutonomicNeuropathy: true,
        };
        const bad = Object.entries(want).filter(([k, v]) => h[k] !== v);
        await t.check(!bad.length, `stored: ${bad.map(([k, v]) => `${k}=${JSON.stringify(h[k])} (want ${JSON.stringify(v)})`).join(', ')}`);
        await t.goto('/home?checkin=stretch');
        const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
        await sheet.waitFor();
        const text = await sheet.innerText();
        await t.checkpoint('check-in-unsure');
        await t.check(/glucose/i.test(text) && /ketone/i.test(text), `the check-in does not ask for glucose and about ketones: ${text.replace(/\s+/g, ' ').slice(0, 300)}`);
      }, { input: 'Not sure for every safety question; No ketone testing; Neither; no cuff' });
    },
  },
  {
    name: 'continue without saving',
    async run(t) {
      const page = await refusedNext(t);
      const main = page.getByRole('main');
      await t.step(2, 'Continue without saving; answer through Review; Start using', async () => {
        await ui.tap(ui.button(main, 'Continue without saving'));
        await ui.heading(page, 'Which type of diabetes?');
        // Writes work again, so anything the app stored now would show.
        await t.setPageFaults(null);
        const lost = [];
        const seen = await setup.throughSetup(t, setup.UNSURE, {
          checkpoint: true,
          onPage: async heading => { if (await main.getByText(UNSAVED, { exact: true }).count() !== 1) lost.push(heading); },
        });
        await t.check(!lost.length, `these pages don’t say the answers aren’t being saved: ${lost.join(', ')}`);
        t.note(`pages after Continue without saving: ${seen.join(' → ')}`);
        await setup.startUsing(t);
        const card = (await ui.rightNow(page).innerText()).replace(/\s+/g, ' ');
        await t.check(/Finish setting up/.test(card), `Right now does not say Finish setting up: ${card.slice(0, 200)}`);
        const d = docs(await t.checkpoint('home-unsaved'));
        await t.check(!d.profile && d.settings?.onboardingComplete !== true && d.settings?.setup?.completedAt === undefined, `stored without saving: ${JSON.stringify({ profile: !!d.profile, onboarded: d.settings?.onboardingComplete, setup: d.settings?.setup })}`);
        // Within the running app: a reload would end this session, and with it the answers.
        await t.hash('/home?checkin=stretch');
        const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
        await sheet.waitFor();
        await t.check(/health questions/i.test(await sheet.innerText()), 'Stretch is not held for the health questions');
        await ui.tap(ui.button(sheet, 'Close'));
      });
      await t.step(3, 'After a reload, setup again, where the draft was stored', async () => {
        await t.reload();
        await ui.heading(page, 'Do you have any of these?');
        await t.check(await main.getByText('Welcome back, let’s carry on.', { exact: true }).count() === 1, 'no “Welcome back” after the reload');
      });
    },
  },
];
```

`UNSURE` doesn't tick conditions again: they were ticked in step 1, and the page that follows is the diabetes type. Every page after it appears in `UNSURE`'s words.

- [ ] **Step 7: V-J18** `scripts/e2e/acceptance/journeys/v18.mjs`

```js
/**
 * V-J18, P02: a medicine change after setup (journey §16): a changed medicine
 * re-runs its chapter's follow-ups and says what changes.
 */
import { docs } from '../lib/harness.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as setup from '../lib/setup.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J18';
export const title = 'A medicine change after setup';
export const safety = true;

const checkIn = async (t, mode) => {
  await t.goto(`/home?checkin=${mode}`);
  const sheet = t.page.getByRole('dialog', { name: ui.CHECKIN });
  await sheet.waitFor();
  return sheet;
};

export const cases = [{
  name: 'main',
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '/home' });
    await t.step(1, 'Stretch → the check-in: no ketone rows', async () => {
      const sheet = await checkIn(t, 'stretch');
      await t.check(await sheet.getByText(/Ketones/).count() === 0, 'the check-in asks about ketones before any ketone risk');
      await ui.tap(ui.button(sheet, 'Close'));
    });
    await t.step(2, 'Edit Your medicines: a “-gliflozin”; Ketones appears; Save', async () => {
      const main = await setup.openChapter(t, 'Your medicines');
      await setup.choose(main, 'Do you take any regular medicines?', 'Yes');
      await setup.tick(main, 'A “-gliflozin” medicine');
      await main.getByRole('heading', { level: 2, name: 'Ketones', exact: true }).waitFor();
      await setup.choose(main, 'Can you test ketones?', 'Urine strips');
      await setup.choose(main, 'Glucose meter or sensor', 'Neither');
      await setup.choose(main, 'Home blood-pressure cuff', 'No');
      await t.checkpoint('medicines-edited');
      await setup.save(t);
      await t.check(await main.getByText('Each check-in will ask about ketones and the signs of ketoacidosis.', { exact: true }).count() === 1, 'the save does not say what changes');
      const h = docs(await t.db()).profile?.health ?? {};
      await t.check(h.sglt2i === true && h.ketoneTest === 'urine' && h.medicinesReviewed === true, `stored: ${JSON.stringify({ sglt2i: h.sglt2i, ketoneTest: h.ketoneTest, reviewed: h.medicinesReviewed })}`);
    }, { input: 'regular medicines Yes; a -gliflozin; urine strips; no meter, no cuff' });
    await t.step(3, 'Home → Stretch → the check-in asks for a urine strip', async () => {
      const sheet = await checkIn(t, 'stretch');
      await t.checkpoint('check-in-ketones');
      await t.check(await sheet.getByText('Ketones, urine strip', { exact: true }).count() >= 1, 'the check-in does not ask “Ketones, urine strip”');
    });
  },
}];
```

- [ ] **Step 8: V-J37** `scripts/e2e/acceptance/journeys/v37.mjs`

```js
/**
 * V-J37, fresh iPhone Safari: finish setup, then move to the Home Screen app
 * (journey §6.5; A-27; B-24; B-30: temporary storage and device loss).
 */
import { docs } from '../lib/harness.mjs';
import * as data from '../lib/data.mjs';
import * as setup from '../lib/setup.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J37';
export const title = 'Finish setup in Safari, then move to the Home Screen app';
export const safety = false;

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const flat = s => s.replace(/\s+/g, ' ');

export const cases = [{
  name: 'main',
  async run(t) {
    let page = await t.open({ seed: null, route: '', contextOptions: { userAgent: IPHONE }, capabilities: { persist: 'refuse', share: 'capture' } });
    let main = page.getByRole('main');
    let file;
    await t.step(1, 'Page 1 in Safari: the install line and Show me how', async () => {
      await t.check(flat(await main.innerText()).includes('Installing helps iPhone keep your data, but it isn’t a backup.'), 'no install line (B-24)');
      await ui.tap(ui.button(main, 'Show me how'));
      const sheet = page.getByRole('dialog', { name: 'Add FitStrong to your Home Screen' });
      await sheet.waitFor();
      await t.check(await sheet.getByRole('list', { name: 'How to add the app to your Home Screen' }).getByRole('listitem').count() === 3, 'the sheet does not show three steps');
      await t.checkpoint('install-steps');
      await ui.tap(ui.button(sheet, 'Close'));
    });
    await t.step(2, 'P02’s answers; Review offers the move with a backup; Start using', async () => {
      await setup.throughSetup(t, setup.P02);
      const offer = ui.section(main, 'Moving to the Home Screen app?');
      await t.must(await offer.count() === 1, 'Review offers no “Moving to the Home Screen app?”');
      await t.check(flat(await offer.innerText()).includes('Make a backup first, then restore it there. Safari may remove data from websites you haven’t opened for a while.'), 'the offer’s words are not B-24’s');
      await ui.tap(ui.row(offer, 'Make a backup'));
      const sheet = page.getByRole('dialog', { name: 'Back up your record' });
      await sheet.waitFor();
      // Safari on iPhone can share files, so the file goes to the share sheet (`deliveryMethod`), captured here.
      await ui.tap(ui.button(sheet, 'Save or share'));
      await page.waitForTimeout(500);
      const shared = (await page.evaluate(() => window.__acc?.shares ?? [])).at(-1)?.files?.[0];
      await t.must(!!shared?.bytes, 'no backup file was made');
      file = data.writeFixture(t, shared.name, Buffer.from(shared.bytes));
      await ui.tap(ui.button(sheet, 'Close'));
      await t.checkpoint('review-handoff');
      await setup.startUsing(t);
    }, { input: 'P02’s answers; Make a backup' });
    await t.step(3, 'Me → Data: not installed, storage temporary', async () => {
      const data2 = await data.openData(t);
      await t.check(/Not installed/.test(await data2.innerText()), 'Me → Data does not say Not installed (B-30)');
      await t.checkpoint('data-not-installed');
    });
    await t.step(4, 'The installed app, empty: restore the file on page 1; setup carries on at Review', async () => {
      await t.context.close();
      page = await t.open({ seed: null, route: '', contextOptions: { userAgent: IPHONE }, capabilities: { standalone: true } });
      main = page.getByRole('main');
      await t.check(!flat(await main.innerText()).includes('Installing helps'), 'the installed app still shows the install line');
      const sheet = await data.chooseRestore(t, file, { from: 'welcome' });
      await ui.tap(ui.button(sheet, 'Restore'));
      await data.waitOutcome(t, sheet);
      await t.check(/Restored\./.test(await sheet.innerText()), `the restore did not finish: ${flat(await sheet.innerText()).slice(0, 200)}`);
      await ui.tap(ui.button(sheet, 'Done'));
      // The file has no finished profile, so page 1 stays; Get started carries on where the draft stopped.
      await ui.tap(ui.button(main, 'Get started'));
      await ui.heading(page, setup.REVIEW);
      await t.check(await main.getByText('Welcome back, let’s carry on.', { exact: true }).count() === 1, 'no “Welcome back, let’s carry on.” at Review');
      await setup.startUsing(t);
      const d = docs(await t.checkpoint('installed-home'));
      await t.check(d.settings?.setup?.stage === 'done' && d.settings?.setup?.answers?.focus === 'stretch', `settings.setup: ${JSON.stringify(d.settings?.setup).slice(0, 200)}`);
    });
  },
}];
```

- [ ] **Step 9: J01, through v2's setup.** In `scripts/e2e/acceptance/journeys/j01.mjs`:
  - delete `answerWizardP07` and its doc comment, and import `* as setup from '../lib/setup.mjs'`;
  - change `title` to `'Look around first without accidental enrolment'`, and the doc comment's first line to `J01, P07: Look around first without accidental enrolment`;
  - replace steps 1, 2, 3, 6 and 7 with the code below. Keep steps 4 and 5 (the chooser, Learn and the steps entry) as they are.

```js
    await t.step(1, 'Fresh context at the app root: setup’s page 1', async () => {
      await t.must(await t.route() === '/setup', `the app root opened ${await t.route()}, not setup`);
      await t.must(await main.getByRole('heading', { level: 1, name: 'Welcome', exact: true }).count() === 1, 'no Welcome heading');
      const text = (await main.innerText()).replace(/\s+/g, ' ');
      await t.check(text.includes('Your health, in one place.'), 'no “Your health, in one place.”');
      await t.check(/Your records are stored on this (device|iPhone|iPad)\./.test(text), 'no privacy line (B-24)');
      await t.check(/Clearing this browser’s data would delete it|Installing helps/.test(text), 'no line on keeping data here (§6.5)');
      for (const name of ['Get started', 'Restore from a backup', 'Look around first']) await t.check(await ui.button(main, name).count() === 1, `no “${name}”`);
      await t.check(await ui.row(main, 'Display').count() === 1, 'no Display row (A-66)');
      const calls = await page.evaluate(() => window.__acc.calls);
      await t.check(calls.geolocation === 0 && calls.notification === 0 && calls.motion === 0
        && !calls.permissionsQuery.some(n => ['geolocation', 'notifications', 'accelerometer', 'gyroscope'].includes(n)),
        `a permission or sensor was requested on page 1: ${JSON.stringify(calls)}`);
      await t.checkpoint('setup-page-1');
    });

    await t.step(2, 'Look around first, then reload at the next checkpoint', async () => {
      await ui.tap(ui.button(main, 'Look around first'));
      await page.getByRole('heading', { level: 1, name: ui.HOME_TITLE }).waitFor();
      await t.reload();
      await page.getByRole('heading', { level: 1, name: ui.HOME_TITLE }).waitFor();
      const d = docs(await t.checkpoint('after-look-around-reload'));
      await t.check(d.settings?.setup?.stage === 'lookAround' && d.settings?.onboardingComplete === true && !d.profile,
        `after Look around first: ${JSON.stringify({ setup: d.settings?.setup, onboarded: d.settings?.onboardingComplete, profile: !!d.profile })}`);
      const persist = await page.evaluate(async () => ({ calls: window.__acc.calls.persist ?? null, granted: await navigator.storage?.persisted?.() }));
      await t.check(persist.calls === null || persist.calls > 0 || persist.granted === true, `navigator.storage.persist() was never attempted (${JSON.stringify(persist)})`);
    }, { input: 'Look around first' });

    await t.step(3, 'Home: four tabs, Finish setting up, no start date', async () => {
      const tabs = page.getByRole('navigation', { name: 'Main' }).getByRole('link');
      await t.check((await tabs.allInnerTexts()).map(s => s.trim()).join('|') === 'Home|Trends|Browse|Me', `tabs are ${(await tabs.allInnerTexts()).join('|')}`);
      const card = ui.rightNow(page);
      const text = (await card.innerText()).replace(/\s+/g, ' ');
      await t.check(/Finish setting up/.test(text), `Right now does not say Finish setting up: ${text.slice(0, 200)}`);
      await t.check(await card.getByRole('button', { name: 'Carry on setting up' }).count() + await card.getByRole('link', { name: 'Carry on setting up' }).count() === 1,
        'no “Carry on setting up”');
      const snap = await t.checkpoint('home-first');
      await t.check(!docs(snap).settings?.startDate, `startDate was set to ${docs(snap).settings?.startDate}`);
    });
```

```js
    await t.step(6, 'Stretch held; Carry on setting up; P07’s answers; Start using; Stretch → the check-in', async () => {
      await ui.tab(page, 'Home');
      const held = await mv.enter(t, 'stretch', 'move');
      const heldText = (await (held.sheet ?? main).innerText()).replace(/\s+/g, ' ');
      await t.check(!held.sheet || await mv.sheetStart(held.sheet).count() === 0, 'Stretch offered a Start before the health questions');
      await t.check(/health questions|setting up/i.test(heldText), `the hold does not say the health questions come first: ${heldText.slice(0, 200)}`);
      if (held.sheet) await ui.tap(ui.button(held.sheet, 'Close'));
      await ui.tab(page, 'Home');
      const carryOn = ui.rightNow(page).getByRole('button', { name: 'Carry on setting up' }).or(ui.rightNow(page).getByRole('link', { name: 'Carry on setting up' }));
      await ui.tap(carryOn);
      await ui.heading(page, 'Welcome');
      await setup.throughSetup(t, setup.P07);
      await t.checkpoint('review');
      await setup.startUsing(t);
      const again = await mv.enter(t, 'stretch', 'move');
      await t.must(!!again.sheet, `Stretch opened no check-in after setup (${again.route})`);
      await ui.answerCheckIn(t, again.sheet, ui.normalAnswers('P07'));
      await t.checkpoint('stretch-permission');
      await t.check(await mv.sheetStart(again.sheet).count() === 1, `no permission-approved start after setup: ${(await again.sheet.innerText()).replace(/\s+/g, ' ').slice(0, 300)}`);
    }, { input: 'P07’s answers; normal current answers' });

    await t.step(7, 'Cancel before active movement, reload, open Me', async () => {
      const sheet = page.getByRole('dialog', { name: ui.CHECKIN });
      if (await sheet.count()) await ui.tap(ui.button(sheet, 'Close'));
      await t.reload();
      await ui.tab(page, 'Me');
      await page.getByRole('heading', { level: 1, name: 'Me', exact: true }).waitFor();
      const snap = await t.checkpoint('me-after-reload');
      const d = docs(snap);
      await t.check(await main.getByRole('heading', { name: /^Finish setting up/ }).count() === 0, 'Me still has Finish setting up after a whole run');
      await t.check(d.settings?.focus === 'explore', `focus is ${d.settings?.focus}`);
      await t.check(!d.settings?.startDate, `startDate is ${JSON.stringify(d.settings?.startDate)}, not empty`);
      await t.check(d.settings?.setup?.stage === 'done' && typeof d.settings?.setup?.completedAt === 'string', `settings.setup: ${JSON.stringify(d.settings?.setup).slice(0, 200)}`);
      await t.check((snap.sessions ?? []).length === 0, `${(snap.sessions ?? []).length} session(s) were created`);
      await t.check(!!d.profile && d.profile.health?.diabetes === 'none' && d.profile.health?.hypertension === 'none' && (d.profile.pain?.areas ?? []).length === 0,
        `the profile does not reflect the answers: ${JSON.stringify(d.profile?.health ?? null).slice(0, 200)}`);
      const kinds = (snap.observations ?? []).map(o => o.kind);
      await t.check(kinds.every(k => k === 'steps'), `observations other than the entered steps exist: ${kinds.join(', ')}`);
    });
```

`mv.enter(t, mode, via)` and `mv.sheetStart(sheet)` are `lib/move.mjs`'s, as J02 and J17 use them. Steps 4 and 5 still read `main`, `page` and `docs`, which this code keeps.

- [ ] **Step 10: J02.** In `scripts/e2e/acceptance/journeys/j02.mjs`:
  - import `* as setup from '../lib/setup.mjs'`;
  - in step 1, after the `Why this?` check, add:

    ```js
        const first = await page.evaluate(() => document.getElementById('right-now')?.nextElementSibling?.getAttribute('aria-label') ?? null);
        await t.check(first === 'FitStrong has a new Home', `the element after Right now is “${first}”, not the new-Home row (§6.6)`);
    ```

  - replace `reviewMedicines` with:

    ```js
    /** Me → Profile & health → the review, answered as step 3 says (codex-acceptance J02). */
    async function reviewMedicines(t) {
      const page = t.page;
      await t.goto('/me/profile');
      const review = page.getByRole('link', { name: /^Your health answers need a review/ });
      await t.must(await review.count() === 1, 'Profile & health offers no health review');
      await ui.tap(review);
      await ui.heading(page, 'Your health');
      const main = page.getByRole('main');
      await t.check(await main.getByText('Your health answers need a review. Check each answer, then Save.', { exact: true }).count() === 1,
        'the review does not open the three safety chapters together');
      await setup.reviewAsP01(main);
      await t.checkpoint('health-review-answered');
      await setup.save(t);
    }
    ```

- [ ] **Step 11: J03, J12, J14, J17, J20, S01 and M01.**
  - **`j03.mjs`**, step 5's profile edit, from `await ui.tab(page, 'Me');` to the `snap0` check: replace with the lines below, and import `* as setup from '../lib/setup.mjs'`.

    ```js
          // Profile: no back or sciatica any more. The pain chip is Your health's, and the areas go with it (journey §16).
          await setup.openChapter(t, 'Your health');
          await setup.tick(main, 'Back pain, sciatica or other pain', false);
          // P01 has diabetes and treated blood pressure, so the limits are asked; v1 never asked about targets.
          await setup.choose(main, 'Has a clinician given you any limits or targets?', 'No');
          await t.checkpoint('profile-edit');
          await setup.save(t);
          const snap0 = await t.db();
          await t.must((docs(snap0).profile?.pain?.areas ?? []).length === 0, `the profile still lists ${JSON.stringify(docs(snap0).profile?.pain?.areas)}`);
    ```

  - **`j12.mjs`**: delete `SU`, `SGLT2`, `METFORMIN`, `DKA` and `editHealth`; import `* as setup from '../lib/setup.mjs'`; add:

    ```js
    /** Me → Profile & health → the review when asked for one, else Your medicines; answer; Save. */
    async function editMedicines(t, answer) {
      const page = t.page;
      await openProfile(t);
      const main = page.getByRole('main');
      const review = main.getByRole('link', { name: /^(Your health answers need a review|Medicines: not yet reviewed)/ });
      await ui.tap((await review.count()) ? review : ui.link(main, 'Edit Your medicines'));
      // Its first page, in the review (three chapters) and in Your medicines alike.
      await main.getByRole('heading', { level: 2, name: 'Your medicines', exact: true }).waitFor();
      await answer(main);
      await t.checkpoint(`medicines-edit-${Date.now() % 1000}`);
      await setup.save(t);
    }
    ```

    Then:
    - step 6: `await editMedicines(t, async m => { await setup.choose(m, 'Has a clinician given you any limits or targets?', 'No'); await setup.choose(m, 'Do you take any regular medicines?', 'Yes'); await setup.tick(m, 'Not sure: Insulin'); await setup.choose(m, 'How do you take insulin?', 'Not sure'); await setup.choose(m, 'A severe low in the last 6 months, or do you often not feel lows coming?', 'No'); await setup.choose(m, 'Ever had diabetic ketoacidosis (DKA), or been told your body makes too little insulin?', 'No'); });`
    - step 7: `await editMedicines(t, async m => { await setup.tick(m, 'Not sure: Insulin', false); await setup.tick(m, 'Metformin'); });`
    - step 8, first edit: `await editMedicines(t, async m => { await setup.tick(m, 'Insulin'); await setup.choose(m, 'How do you take insulin?', 'Long-acting only'); });`
    - step 8, second edit: `await editMedicines(t, m => setup.choose(m, 'How do you take insulin?', 'Several injections a day'));`

    Each step's assertions after the edit stay as they are; the `/Insulin Not sure/` and `/Insulin Injections or pump, several (injections|times) a day/` checks read Profile & health's Your medicines rows.
  - **`j14.mjs`**: replace `editHealth` with:

    ```js
    /** Me → Profile & health → Edit {chapter}; answer; Save. */
    async function editChapter(t, chapter, answer) {
      const main = await setup.openChapter(t, chapter);
      await answer(main);
      await setup.save(t);
    }
    ```

    The two calls become `await editChapter(t, 'Your health', async m => { await setup.choose(m, 'Which type of diabetes?', 'Type 1'); await setup.choose(m, 'Has a clinician given you any limits or targets?', 'No'); });` and `await editChapter(t, 'Your medicines', m => setup.choose(m, 'Can you test ketones?', 'Urine strips'));`. Import `* as setup from '../lib/setup.mjs'`.
  - **`j17.mjs`**, step 6: replace everything from the first `await t.goto('/me/profile');` to the line that waits for `Saved. Today uses your new answers` with:

    ```js
        const openReview = async () => {
          await t.goto('/me/profile');
          await ui.tap(page.getByRole('link', { name: /^Your health answers need a review/ }));
          await ui.heading(page, 'Your health');
          await setup.reviewAsP01(page.getByRole('main'));
        };
        await openReview();
        await t.setFaults([{ op: 'put', store: 'settings', match: { key: 'profile' }, action: 'quotaDom' }]);
        await setup.save(t, { expectSaved: false });
        await page.waitForTimeout(1000);
        const fired = await t.faultLog();
        await t.must(fired.some(f => f.store === 'settings'), `the profile write fault never fired: ${JSON.stringify(fired)}`);
        const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
        await t.checkpoint('profile-save-failed');
        await t.check(/did not save|not enough space|couldn.t save/i.test(text), `the failed profile update is not shown: ${text.slice(0, 200)}`);
        await t.check(!/Saved\. Home uses your new answers/.test(text), 'the failed profile update was acknowledged as saved');
        const snap = await t.db();
        const health = docs(snap).profile?.health ?? {};
        await t.check(health.medicinesReviewed !== true && health.metformin === undefined, `the uncommitted medicine answers are in the stored profile: ${JSON.stringify({ r: health.medicinesReviewed, m: health.metformin })}`);
        const second = await startHeld('after-error');
        await t.check(second.held, `Start was allowed on the uncommitted profile: ${second.text.slice(0, 200)}`);
        // Retry, now that the device can store it.
        await t.setFaults(null);
        await openReview();
        await setup.save(t);
    ```

    Import `* as setup from '../lib/setup.mjs'`. The checks after the retry stay as they are.
  - **`j20.mjs`**: in `YOU_EDITORS`, delete `['What you’d like more of', /^What you’d like more of$/],`: Me no longer has that row (Task 14). The movement chapter is reached from Profile & health, as every chapter is.
  - **`s01.mjs`**:
    - delete `answerWizardStep` and the `answerWizardP07` import, and import `* as setup from '../lib/setup.mjs'`;
    - replace the `firstRun` object with the function below;
    - in `cases`, replace `firstRun,` with `firstRun(),` and `firstRun({ textScale: 2 }),`, so first run is swept at 200% text too (§20.4).

    ```js
    /** First run: setup a page at a time, each one checkpointed and swept, then the empty screens. */
    const firstRun = ({ textScale } = {}) => ({
      name: textScale ? 'first run at 200% text' : 'first run and empty states',
      async run(t) {
        await t.open({ seed: null, route: '', ...(textScale ? { textScale } : {}) });
        await t.step(1, 'Setup page by page, then Review and Start using', async () => {
          await setup.throughSetup(t, setup.P07, { checkpoint: true });
          await t.checkpoint('setup-review');
          await setup.startUsing(t);
        });
        await t.step(2, 'Empty Home, My Day, Trends and Move for a person with no history', async () => {
          if (!(await t.route()).startsWith('/home')) t.note(`first run ended at ${await t.route()}`);
          for (const r of ['/home', '/day/today', '/trends', '/hub/workout', '/hub/workout/plan']) await visit(t, r, `empty-${r.replace(/\W+/g, '-')}`);
        });
      },
    });
    ```

  - **`m01.mjs`**, the `finishSettingUp` case (Plan 4's): P02 with its answers under review now has three chapters to finish (the review, and v1's two new chapters). Replace its two steps with:

    ```js
        await t.step(1, 'Me starts with the chapters to finish; the review opens its own pages', async () => {
          const group = ui.section(main, 'Finish setting up · 3 short chapters');
          await t.must(await group.count() === 1, `Me has no “Finish setting up · 3 short chapters”: ${flat(await main.innerText()).slice(0, 300)}`);
          const rows = (await group.getByRole('link').allInnerTexts()).map(s => flat(s).trim());
          await t.check(rows.join(' | ') === 'Your health Your health answers need a review | About you What to call you | Your food Logging what you eat', `the rows are ${rows.join(' | ')}`);
          await t.checkpoint('me-finish');
          await ui.tap(ui.row(group, 'Your health', 'link'));
          await ui.heading(page, 'Your health');
          await t.check(await main.getByText('Your health answers need a review. Check each answer, then Save.', { exact: true }).count() === 1, 'Your health does not open as the review');
          await ui.tap(ui.back(page, 'Me'));
          await ui.heading(page, 'Me');
        });
        await t.step(2, 'Not now: the row goes, and stays gone', async () => {
          await ui.tap(ui.button(main, 'Not now, Your health'));
          await page.waitForTimeout(300);
          await t.check(await ui.section(main, 'Finish setting up · 2 short chapters').count() === 1, 'Not now did not take Your health away');
          await t.reload();
          await t.check(await ui.section(main, 'Finish setting up · 2 short chapters').count() === 1, 'Your health came back after a reload');
          await t.check(JSON.stringify(docs(await t.db()).settings?.setup?.declined) === '["health"]', 'Not now was not stored');
        });
    ```

    The row opens Your health as the review: Plan 5's `chapterHref`, not Plan 4's Profile & health.

- [ ] **Step 12: Run the journeys**

```bash
mkdir -p /tmp/fit-checks
npm run e2e:acceptance -- --only=V-J10,V-J11,V-J13,V-J17,V-J18,V-J37,J01,J02 --projects=large-light,small-dark > /tmp/fit-checks/p5-setup.log 2>&1; tail -n 40 /tmp/fit-checks/p5-setup.log
npm run e2e:acceptance -- --only=J03,J07,J12,J14,J17,J18,J20,M01,S01 --projects=large-light,small-dark > /tmp/fit-checks/p5-edits.log 2>&1; tail -n 40 /tmp/fit-checks/p5-edits.log
```

Expected: 0 failed. A failure carries its step, screenshot, visible text and database difference: read those first. Fix the app when it breaks the journey's table in `codex-acceptance.md`; fix the journey only when it asks for something the table doesn't.

- [ ] **Step 13: The whole suite, then commit**

```bash
npm run e2e:acceptance > /tmp/fit-checks/p5-all.log 2>&1; tail -n 40 /tmp/fit-checks/p5-all.log
git add scripts/e2e/acceptance
git commit -m "test: Walk v2 setup and the chapter editor through the acceptance suite"
```

Expected: 0 failed.

---

### Task 17: Review, reconcile, and record the result

The roadmap's last step for every plan: Codex (static, max effort) and Kiro (read-only) review the plan's diff, and every finding is reconciled before the plan is done.

**Files:** whatever the findings touch; `docs/reimagine/BOARD.md` (append).

**Interfaces:** none.

- [ ] **Step 1: Build the bundle and the prompt.** The diff starts at the commit before Task 1's, found by its message:

```bash
mkdir -p /tmp/fit-checks
BASE=$(git log -n 1 --format=%H --grep="Record Plan 5's setup decisions")~1
{
  cat docs/superpowers/plans/2026-10-10-fitstrong-v2-plan-5-setup.md
  git diff "$BASE"..HEAD -- src scripts/e2e/acceptance docs
} > /tmp/fit-checks/v2p5-bundle.md
cat > /tmp/fit-checks/v2p5-prompt.md <<'EOF'
Review FitStrong v2 Plan 5 (setup and upgrade), statically, at maximum effort. The plan and the diff are in /tmp/fit-checks/v2p5-bundle.md; the spec is docs/superpowers/specs/2026-10-08-fitstrong-v2-journey-design.md (§1.2, §6, §16, §18.1, §19, §20.4, §25 B-06 B-07 B-08 B-18 B-24 B-31) and docs/superpowers/specs/2026-10-08-fitstrong-v2-motion-design.md (M22). Read the files the diff touches in full. Report each real bug as: id, severity, file:line, what a person would see, and a failing test (Vitest node, or an acceptance step) that would catch it. Look hardest at: an answer nobody gave stored as one; "Not sure" read as "No" anywhere; a review flag set without every medicine it vouches for; an edit changing a field outside its chapter, or undoing what another open copy saved; a draft write that reopens a finished setup; a unit round trip that drifts a stored number; a page that can't be left, or is skipped, for some combination of answers; a restored draft that loops or crashes; anything a person at 200% text can't reach. No style comments.
EOF
```

- [ ] **Step 2: Codex** (static, max effort; run it in the background, it takes about 25 minutes):

```bash
codex exec -m openai.gpt-6.1-sol -c model_reasoning_effort='"max"' -c 'model_providers.amazon-bedrock.aws.region="us-east-1"' -s read-only -C "$PWD" -o /tmp/fit-checks/v2p5-codex.md - < /tmp/fit-checks/v2p5-prompt.md
```

- [ ] **Step 3: Kiro** (read-only), with the same prompt:

```bash
kiro-cli chat --no-interactive --trust-tools=fs_read --model claude-opus-5.5 "$(cat /tmp/fit-checks/v2p5-prompt.md)" > /tmp/fit-checks/v2p5-kiro.md 2>&1
```

- [ ] **Step 4: Reconcile.** For each finding:
  - **Fix** it: reproduce it with a failing test in the owning task's style, then fix the code. Commit one fix per finding, or per tight group, with the finding ids in the message (`fix: … (C-03, K-02)`).
  - **Reject** it, with the reason, when it contradicts the spec, the board or this plan's decisions (D75–D84).
  - **Defer** it to a named plan when it belongs there (the Food hub to Plan 7, maps to Plan 6, recovery journeys to Plan 8).

  Then run everything again:

```bash
npx tsc -b && npm run lint && npx vitest run
npm run e2e:acceptance > /tmp/fit-checks/v2p5-after-review.log 2>&1; tail -n 20 /tmp/fit-checks/v2p5-after-review.log
```

Expected: the gates pass and 0 journeys fail.

- [ ] **Step 5: Record the result.** Append this to `docs/reimagine/BOARD.md`, then one line under it per finding from Steps 2 and 3: its id and reviewer, what a person would have seen, and what happened to it (the fixing commit, the reason it's rejected, or the plan it's deferred to).

```markdown
### 2026-10-10 — [claude] v2 Plan 5 (setup and upgrade): built and reviewed

- Setup's page graph has 29 pages; the minimal path is 15 and the complex path 26 (J§1.2: at most 20 and 30). `setup.pages.test.ts` and `setup.fields.test.ts` pass.
- Acceptance: V-J10, V-J11, V-J13, V-J17, V-J18, V-J37, J01 and J02 pass at both sizes, with J03, J07, J12, J14, J17, J18, J20, M01 and S01.
- Codex (GPT-6.1 Sol, max effort, static) and Kiro (read-only) reviewed the plan and its diff. Their findings, and what happened to each:
```

- [ ] **Step 6: Commit**

```bash
git add docs/reimagine/BOARD.md
git commit -m "docs: Record Plan 5's review and acceptance results"
```

---

## Self-review

**1. Spec coverage.** Each requirement, and the task that builds it:

| Requirement | Task |
| --- | --- |
| §6.1 eight chapters, the capsule "About you · 2 of 8" | 4 (`capsuleOf`), 9 (`SetupShell`) |
| §6.1 autosave, the failure line with Try again, "Welcome back, let’s carry on" | 8 (`withDraft`, `mover`), 9 (`useMove`, `SetupShell`), 13 (`Start`) |
| §6.1 Back never loses answers; Next only once stored (M22) | 8 (`pageEdits`, `mover`), 9 (`PageFrame`) |
| §6.1 Not sure is real and stored as `unsure`; clinical answers never default; labelled preference defaults | 2, 4, 5 (`profileFrom`), 10, 12 |
| §6.1 Skip for now on preference pages only; a skipped safety question stays a gap | 4 (`skippable`, `guardFor`), 9 |
| §6.1 "Set up once": answers kept and reused; asked again only when a change needs it | 6 (`answersToEdit`), 14 (`editPath`, `editChapters`) |
| §6.1 Display on page 1 (A-66) | 9 (`WelcomePage` with Plan 4's `DisplayControls`) |
| §6.2 every chapter's pages, the body picture with a list, What helps optional | 9, 10, 12 |
| §6.2 the programme's own Join flow, not counted (L-01) | 5 (`join.ts`), 11 (`JoinFlow`), 12 |
| §6.2 chapter 7's pattern with Jain, allergies, logging level and the screening question | 3, 12 (P7-8: the answer isn't kept) |
| §6.2 chapter 8 reminders, meal times only with after-meal walks, voice with Hear the voices | 12 |
| §6.2 Review: chapter cards with Edit, three things, Start using FitStrong | 13 |
| §6.3 every engine field reachable under its condition; the table corrected | 1, 5 (`setup.fields.test.ts`) |
| §6.4 Look around first; Restore on page 1; v1 part-way prefill (K-57); Delete everything → page 1 | 5 (`lookedAround`), 6, 9, 13; J18 keeps page 1's `Welcome` at `/setup` |
| §6.4 "about 5 minutes" removed (B-06) | 1 |
| §6.5 install line (D16, B-24), Show me how, the Safari handoff (A-27), `persist()` | 9, 13 (`HANDOFF`, `BackupSheet`), V-J37; the store already asks `persist()` at start |
| §6.6 no interstitial; the inline row with Show me and Got it; new questions never forced; Finish setting up | 4 (`upgradeSkipped`), 7, 15 |
| §6.6 same safety decisions before and after (A-36) | 6 (round trip), 15 (`upgrade.test.ts`) |
| §1.2 budgets: minimal ≤ 20, complex ≤ 30 | 4 (15 and 26 pages) |
| §16 Profile & health by chapter, with the same pages; what changes | 14 |
| §18.1 `name`, `waistCm`, dated weight, height and waist readings; `settings.setup` | 2, 5 (`measurementsFrom`), 13, 14 |
| §19.1 launch: setup resumed, or Home after Look around first; §19.2 `/setup/:chapter/:page`; L-20 | 7 (`setupOpen`), 13 (routes, App), 14 (`Profile()`) |
| §20.4 grandma rules: labels, 48 px, 60 px primaries, 200% text, verbs | Global Constraints, 9 to 14, S01 at 200% |
| B-06 the published graph, both personas' counts, reachability | 4 |
| B-07 Continue without saving | 8, 9, 13, V-J17 |
| B-08 a checklist is one question | 4 (`checklistDone`, `commitPage`), 9 (`TriChecklist`) |
| B-18 no WHO line on the goal page | 12 |
| B-24 standard copy | Global Constraints, 9, 13 |
| B-31 the borderline birth year | 4 (`age.ts`), 9 |
| M22 slide, fade, spring, Reduce Motion fade, capsule fill, Review at once | 9 (CSS, `SetupShell`), 13 (`SetupRoutes`) |
| V-J10, V-J11, V-J13, V-J17, V-J18, V-J37; J01 and J02 | 1 (tables), 16 (journeys) |

No gaps found. Two things belong to other plans:
- the Food hub, and meal ideas filtered by allergy (Plan 7, D82);
- the map sentence of the privacy line (Plan 6).

**2. Placeholder scan.** Every code step carries its code.
- Three steps keep code that exists only on the branch at that point, so the step names its source and the exact change:
  - J01's steps 4 and 5;
  - Profile & health's calendar notice, copied from `ProfileScreen.tsx`;
  - the `j17.mjs` checks after the retry, and the set-up of Plan 4's `m01.mjs` case.
- The wizard exports to delete in Task 14 are found by a given command, with the ones setup keeps named.
- Task 17's board entry ends with the review's findings, one line each, written from that task's own Steps 2 to 4. They're results to record, not plan content.
- The journey code was read against the harness and helpers as they are: `t.goto` reloads and `t.hash` doesn't (so the unsaved session in V-J17 is checked without a reload); the fault action is `throwUnknown`; the iPhone backup goes through the captured share sheet (`deliveryMethod`); a row with a detail line is found by its label's text, not its whole name.

**3. Type consistency.**
- `SetupAnswers`, `SetupRecord`, `SetupState`, `PageId`, `ChapterId`, `Tri` and `JoinAnswers` are defined in Task 2 and used under those names throughout.
- `ChapterId` and `CHAPTER_IDS` stay Plan 4's.
- `profileFrom(a, base, today, ctx, chapters)` and `settingsFrom(a, base, profile, today, chapters)` take the same order everywhere (Tasks 5, 6, 13 and 14).
- `editedRecord(data, { chapters, opened, answers, skipped }, today, ctx)` is the same in Tasks 14 and 15.
- `setupProgress`, `OpenChapter`, `finishTitle` and `notNow` keep Plan 4's signatures; `chapterHref` is new.
- `PageProps` and `PageView` (Task 9) type every view (Tasks 10 and 12) and `PAGE_VIEWS` (Task 13).
- The acceptance helper's headings and question names are the page titles in `titles.ts` and the `label`s in the views, checked one by one.
- `permission({ profile, now }, mode)` is the engine's own signature; `@/engine/permission` exports no list of modes, so `upgrade.test.ts` names the three.

**4. Review Focus.**
1. **The chapter edit.** Task 14's `edit.test.ts`, with the review flags in Task 5's `assemble.test.ts`.
2. **Units.** Task 4's `units.test.ts`, Task 5's `measurementsFrom` cases, and V-J10's step 4.
3. **A diabetes medicine with "No".** Task 5's `assemble.test.ts` and the crosswalk personas.
4. **A second tab.** Task 8's `withDraft` test.
5. **A draft from another build.** Task 2's import tests, and Task 4's `resumeAt` and `guardFor` cases.

**Coordination with the plans written beside this one:**
- **Plan 4.** Its seam is filled, not redefined: `src/types/setup.ts`, `setupProgress`, `notNow` and `settings.setup.declined`, read field by field.
  - `DisplayControls` is reused.
  - Its Me row "What you’d like more of" is taken away, as Plan 4 asks, now that the movement chapter is in Profile & health (Task 14).
  - Its M01 and J20 journeys are updated (Task 16).
- **Plan 2.** `withWeeklyGoal` writes setup's weekly goal (B-16). Your plan's `?join=1` opens the new Join flow.
- **Plan 7.** Its food contract is landed word for word (D82). When Plan 7 runs, its Task 2 Steps 1, 6, 8, 10 and 11 are already done: skip them, and expect Step 7's run to pass. Setup's allergy chips use P7-5's ids; Plan 7 may replace `ALLERGY_CHIPS` with its own list.

