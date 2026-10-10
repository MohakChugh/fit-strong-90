# FitStrong v2 Plan 7: Food Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give FitStrong a Food hub. It has:
- meal ideas that respect the person's eating pattern and allergies;
- optional meal logging at the level they choose: meals with no numbers, or calorie and carb estimates per Indian portion;
- usual meals in three taps, and corrections that keep their history;
- food records in backups;
- a food table built at build time from USDA FoodData Central ingredients and our own recipes.

**Architecture:**
- **The food table is generated, not typed in.**
  - `scripts/food/build.ts` runs the pure `src/food/compute.ts` over three inputs: a checked-in FDC extract (`scripts/food/fdc-ingredients.json`), our authored ingredient tags (`scripts/food/ingredients.ts`) and our recipes (`scripts/food/recipes.ts`). It writes `src/data/food/foods.json`.
  - A node test rebuilds the table and must get exactly the committed file. It also checks every dish against a reviewed table of expected values.
- **Every rule is a pure module in `src/food/`, each with its own tests:** the level and counts-free switch, allergens, estimates and the words they're shown in, records (validation, merge, history), the tray, usual meals, search, the week, and the food prompt.
- **Meal ideas stay v1's plate-method templates** (`src/content/meals.ts`). A component-to-dish map (`src/content/mealDishes.ts`) lets the one filter, `mealsFor`, read each idea's allergens and Jain fit from its recipes. Every screen that lists ideas then agrees. This replaces Plan 5's interim word matching.
- **Meals, usual meals and the person's own foods are records** in Plan 6's stores (`meals`, `savedMeals`, `customFoods`). This plan fills in the three placeholder rules in Plan 6's registry.
- **The Food hub uses Plan 2's hub frame.** Logging is one sheet, "Log a meal", which `#/hub/food/log` opens over the hub.

**Tech stack:** React 19, TypeScript (strict, `erasableSyntaxOnly`), Vite 8, Tailwind v4, React Router 7.13 hash data router, the IndexedDB store, Vitest (node environment), `tsx` for build scripts, and the Playwright-core acceptance suite (`npm run e2e:acceptance`, headless Chromium).

**Spec:** `docs/superpowers/specs/2026-10-08-fitstrong-v2-journey-design.md` (cited as J§). This plan covers:
- all of §11;
- §7.4 (food prompts), §18.1–18.2 (data) and §22 (food values);
- the §25 amendments B-04, B-05, B-08, B-10, B-11, B-12, B-13, B-20 and B-24, which override earlier text.

Motion is M15 in `…-motion-design.md`. The evidence is `docs/research/v2-feasibility-research.md` §2, and the roadmap is `docs/superpowers/plans/2026-10-08-fitstrong-v2-roadmap.md`. Read J§11 and §25 before starting.

## Global Constraints

- Work on branch `feat/v2-journey`. Never push to `main`. Commit after each task, with the message given.
- **Plans 2 to 6 come first.** This plan builds on what they left (see Dependencies), and changes their code only where a task says so.
- **Local-only.** The app makes no new network request and takes no new dependency or key. Downloading FDC's SR Legacy file is a one-off developer step, outside the app, and the download never enters the repository.
- **Food values** come only from USDA FoodData Central SR Legacy (CC0), through `scripts/food/`. Never bundle INDB, IFCT 2017 or Open Food Facts, or copy a number from them (J§11.6, D45).
- **No generated targets.** The app never suggests a calorie or carbohydrate target. The only target is one the person enters, shown as "From your care team", and only with estimates (J§11.5).
- **"Estimated" before every figure.** A meal's or day's total ends "in logged foods". An unknown value stays unknown: it's listed by name, never shown as 0 (J§11.4, A-17, B-12).
- **Carbs as a range** with insulin, a sulfonylurea or a meglitinide, or while the medicine answers aren't known. Every screen that shows carbs then says "Carb figures are rough estimates. Follow your care team’s plan." (K-22).
- **Counts-free** ("Meals only, no numbers") hides nutrition figures and movement-energy figures everywhere, old records included. It also has no food prompts and no targets (B-11). Every figure goes through `numbersView()` or `countsFree()`.
- **Never shown:** red, "over", judgement, a net figure (eaten minus burned), "earn", or burned energy as an allowance. No prompt suggests skipping a meal, fasting or exercising to make up for food (J§11.4–11.5, A-50).
- **Allergies (B-13).** The canonical ids are Plan 5's `ALLERGEN_IDS`, each with aliases. Anything else the person names is a custom allergy, matched by word against every ingredient.
  - Ideas leave out anything that contains an allergen, may contain one, or isn't fully tagged.
  - Logging never hides a food; it warns.
- **Durable saves.** "Lunch saved" appears only after the write is stored. A failure keeps the tray and says "That didn’t save." with the reason (J§4.5, M15).
- **Deletes** happen at once, with Undo.
  - The two latest Undo toasts stand, stacked, and never on a timer.
  - They end when the person leaves that screen or makes an unrelated change.
  - A restore uses a fresh id (J§20.4 rule 6, B-04, B-05).
- **Labels.** Every control has a visible text label, and steppers read "Less" and "More" (B-08).
  - Every target is at least 44×44 px, and primary buttons are at least 56 px tall (`PrimaryButton`).
  - Body text is 17 px, and 200% text must work.
- **Motion** is M15. Reduce motion drops the fades. Urgent content comes first.
- **The food table stays out of the first screen.** Nothing that `src/main.tsx` imports statically may import `src/food/data.ts` (Task 15 checks).
- **Tests.** Vitest runs in node (`src/**/*.test.ts`; file reads go in `*.node.test.ts`). Components aren't unit-rendered: every rule is a pure function with its own test, and screens are proved by the acceptance suite in headless Chromium.
- **Gates before every commit:** `npx tsc -b && npm run lint && npx vitest run`.
- **Copy:** Indian English, sentence case, verbs on buttons. Every food sentence lives in `src/food/copy.ts`, and the words estimates are shown in live in `src/food/format.ts`.

## Dependencies: what this plan builds on

The roadmap runs the plans in order, so Plans 2 to 6 are merged before this one. This plan uses their names, as their plan files give them, and Task 1 checks each one against the code.

**When a merged name differs:**
- use the merged name everywhere this plan uses the expected one;
- record the pair on the board (Task 1, Step 4);
- keep the behaviour this plan describes.

**Plan 5 (Setup), Tasks 2 and 3: the food answers.**
- In `src/types/profile.ts`:
  - `ALLERGEN_IDS` (`peanut`, `treeNut`, `milk`, `egg`, `wheat`, `soy`, `sesame`, `fish`, `shellfish`, `mustard`), with `type AllergenId`;
  - `type FoodPattern`, Jain included;
  - `FoodPreferences` with `pattern`, `avoid`, `region?`, `allergies?: AllergenId[]`, `level?: 'ideas' | 'meals' | 'estimates'` and `hardBefore?: 'yes' | 'no' | 'preferNot'`.
- `src/content/allergens.ts`: `ALLERGEN_TERMS`, `JAIN_LEAVES_OUT`, `leaveOut`, `mealPattern` and `withPicked`. This is Plan 5's interim word matching, its board decision for allergies until recipes are tagged. Task 7 replaces it with recipe tags.
- `src/content/week.ts`, `search.ts` and `src/screens/guide/MealDetailScreen.tsx` filter through `leaveOut`. `FoodPicker` lists Jain and saves through `withPicked`.
- `src/store/importCheck.ts` reads `allergies`, `level` and `hardBefore`.
- Setup's meal times are `habits.mealWalk.finish`, by Plan 5's board decision. This plan doesn't add `food.mealTimes`.
- The screening answer is kept in `food.hardBefore`. This plan keeps it there too, and asks only when it's absent (board D102).

**Plan 6 (Walk), Task 1: the storage foundation.** Tasks 8 and 10–16 need it.
- In `src/store/records.ts`:
  - `RECORD_STORES` (`routes`, `meals`, `savedMeals`, `customFoods`), `type RecordStore`, `type StoredRecord = Record<string, unknown>` and `type Records`;
  - `interface RecordRule { keyPath; label; limit; backup; problem(record); newer?(here, file); accepts?(device) }` and `RECORD_RULES`;
  - `recordKey`, `recordProblem` and `sortRecords`.

  The three food rules are placeholders that refuse every record. Task 8 replaces them.
- `Snapshot.records` and `StoreState.records` hold each store in key order. `Change.records?: Partial<Record<RecordStore, { put?: StoredRecord[]; remove?: string[] }>>` writes them.
- `src/store/useStore.ts` exports `putRecords(store, records)` and `removeRecords(store, keys)`, each one transaction. Task 8 adds `writeRecords`, for several stores in one change, and exports the existing `freshId`.
- A removed key is remembered in `settings.deleted.records[store]` (D-06).
- Backups always carry the food stores. An import checks each row with the rule's `problem`, merges with `newer`, honours deletions and enforces `limit`.
- `ObservationKind` has `activeEnergy`, and walk summaries and details show "about N kcal". Task 15 makes counts-free hide it (B-11).

**Plan 2 (Hubs).**
- `src/screens/hub/HubFrame.tsx` exports `HubFrame({ category, held?, trailing?, children })` and `HubSection({ title, footer?, children })`. `categoryById` comes from `@/categories`.
- The interim `/hub/food…` routes are left for this plan, and Learn links to `/hub/food/ideas`.

**Plan 4 (Browse and Me).**
- Me lives at `/me`. `FoodScreen` is titled "Food" and goes Back to Me.
- `FoodScreen` holds a placeholder group, "Logging what you eat", that Task 12 replaces.
- Acceptance's `data.openData` opens Me → Data.

**Plan 3 (Trends).**
- `/trends/food` stays on the Food hub, by Plan 3's board decision.
- Food's trend is out of this plan's scope. `dailyNutrition()` (Task 9) is the series a later Food trend draws, through Plan 3's `ChartModel`, with `countsFree()` applied.

**Plan 8.** Recently deleted reads the deletion records the generic store keeps.

## Review Focus

These are failure modes the spec implies that no task's own tests would naturally exercise. Each has a test in the task that owns its code.

1. **A shaky double tap on "Save meal"** must save one meal, not two. Task 8 saves one draft twice at once and expects one record.
2. **An allergy typed in the person's own words.**
   - "Groundnuts", "मूंगफली" and "seafood" must resolve to canonical allergens. Task 3 has these cases.
   - "Brinjal" must keep out any dish whose recipe names it, and every dish that isn't fully tagged. Task 7 tests "drumstick" against sambar's recipe.
3. **Switching to "Meals only, no numbers" after logging with estimates.** Every old meal still carries its estimate snapshot, and must show no figure anywhere: the tray, the hub, Today's log. Tasks 6 and 14 test with snapshots present.
4. **Correcting a meal's time onto another day** (a dinner after midnight). It must move to that day once, keep its id and history, and not be counted on both days. Tasks 8 and 14 test it.
5. **A wrong-form FDC record** (raw rice where cooked was meant) would silently triple an estimate. Task 5's plausibility table catches it.

---

## File map

| File | Responsibility |
| --- | --- |
| `docs/reimagine/BOARD.md` (modify) | The food data's source, version, licence and credit; decisions D95 to D104; the acceptance result |
| `src/types/profile.ts` (modify) | `FoodPreferences` gains `customAllergies`, `careTeamTargets` and `logReminder` |
| `src/store/importCheck.ts` (modify) | Reads the new food fields, all or nothing |
| `src/food/level.ts` (new) | The level, counts-free, carb ranges, `numbersView`, the screening step |
| `src/food/allergens.ts` (new) | Aliases for Plan 5's canonical allergens; custom allergies; `recommendable`; `allergyWarning` |
| `src/food/types.ts` (new) | The food table's types and the record types |
| `src/food/units.ts` (new) | Household units in grams, `countText`, `portionText` |
| `src/food/compute.ts` (new) | Build-time maths: FDC parsing, per-100 g values, carb ranges, allergen and pattern tags, `unbumped` |
| `scripts/food/ingredients.ts`, `recipes.ts`, `expected.ts` (new) | Our ingredient tags with FDC descriptions, the 42 recipes, and the reviewed expectations |
| `scripts/food/find-fdc.ts`, `extract-fdc.ts`, `build.ts` (new) | Look up FDC records; extract the ones we use; build the table |
| `scripts/food/fdc-ingredients.json`, `src/data/food/foods.json` (generated) | The FDC extract with its source record; the food table |
| `src/food/data.ts`, `src/food/data.node.test.ts` (new) | Loads the table; proves it's fresh, plausible and attributed |
| `src/content/mealDishes.ts` (new) | Each meal idea's components mapped to dishes |
| `src/content/allergens.ts`, `week.ts`, `search.ts`, `index.ts` (modify) | Ideas filtered by recipe tags and the Jain pattern, in place of Plan 5's interim word lists |
| `src/content/schema.ts`, `sources.ts`, `meals.ts`, `library.ts`, `claims/food.ts` (modify) | The FDC source and its claim |
| `src/food/estimate.ts`, `format.ts`, `copy.ts` (new) | Estimates and totals; the words they're shown in; every food string |
| `src/food/records.ts`, `src/food/store.ts` (new) | Validation, merge, history and restore; the store actions |
| `src/store/records.ts`, `src/store/useStore.ts` (modify, Plan 6's) | The three food rules; `writeRecords`; `freshId` exported |
| `src/food/tray.ts`, `usual.ts`, `search.ts`, `days.ts` (new) | The tray; Your usual; food search; days, weeks and `dailyNutrition` |
| `src/food/links.ts`, `src/food/draft.ts` (new) | Addresses into the sheet; what it opens with |
| `src/food/prompts.ts` (new) | The food prompt's time |
| `src/components/hig/toast.ts` (new) | Toast and Undo styles, shared by Edit Home and Food |
| `src/screens/food/undo.ts` (new) | Undo toasts for deleted meals and usual meals |
| `src/screens/food/LogMealSheet.tsx`, `parts.tsx`, `useHeldQuery.ts`, `LevelSheet.tsx`, `FoodHubScreen.tsx`, `UsualMealsScreen.tsx`, `routes.tsx` (new) | The sheet and its pages, the held list, the level choice, the hub, Your usual meals, `/hub/food/*` |
| `src/screens/guide/MealIdeasScreen.tsx`, `MealDetailScreen.tsx`, `SampleWeekScreen.tsx`, `FoodPicker.tsx`, `format.ts`, `SourcesScreen.tsx` (modify) | v2 addresses, allergies in the picker and summary, food data in Sources |
| `src/screens/you/FoodScreen.tsx`, `summaries.ts` (modify) | Me → Food |
| `src/reminders/schedule.ts`, `copy.ts`, `advice.ts`, `ReminderBanner.tsx`, `ReminderHost.tsx` (modify) | The food prompt as an in-app reminder kind |
| `src/screens/track/timeline.ts`, `MyDay.tsx`, `QuickLog.tsx` (modify) | Meals in Today's log; "Meal" in Add |
| `src/screens/home/HomeScreen.tsx`, `model.ts`, `editor.ts` (modify) | The Food tile's line; shared toast styles |
| Walk energy screens (modify; Task 15 finds them) | Counts-free hides "about N kcal" |
| `src/routes.tsx`, `tsconfig.app.json`, `README.md` (modify) | Food routes; JSON imports; the food commands |
| `src/food/boundaries.node.test.ts` (new) | The first-screen boundary and the counts-free gate |
| `scripts/e2e/acceptance/lib/food.mjs`, `journeys/v03.mjs`, `v28.mjs`, `v29.mjs`, `v30.mjs`, `v31.mjs` (new); `run.mjs` (modify) | V-J03 and V-J28 to V-J31 |

---

### Task 1: Board record and the dependency check

**Files:**
- Modify: `docs/reimagine/BOARD.md` (append)

**Interfaces:**
- Consumes: the expected names in "Dependencies" above.
- Produces: the board entry, with any name that differs, which every later task uses.

- [ ] **Step 1: Check what Plan 5 left**

```bash
grep -n "ALLERGEN_IDS\|export type FoodPattern\|hardBefore\|allergies?:" src/types/profile.ts
grep -n "export const ALLERGEN_TERMS\|export const JAIN_LEAVES_OUT\|export function leaveOut\|export function mealPattern\|export function withPicked" src/content/allergens.ts
grep -rn "leaveOut(" src | grep -v "\.test\.ts"
grep -n "hardBefore\|allergies" src/store/importCheck.ts
```

Expected:
- the ten ids and the four `FoodPreferences` fields above;
- the five exports in `src/content/allergens.ts`;
- `leaveOut(` called in `week.ts`, `search.ts` and `MealDetailScreen.tsx`;
- both fields in the import check.

If Plan 5 isn't merged, stop: this plan builds on its food answers.

- [ ] **Step 2: Check Plan 6's storage foundation**

```bash
grep -n "DB_VERSION\|CORE_STORES\|STORE_NAMES" src/store/db.ts
grep -n "SCHEMA_VERSION =" src/store/migrate.ts
grep -n "export const RECORD_STORES\|export interface RecordRule\|export const RECORD_RULES\|export function recordKey\|export function recordProblem\|export function sortRecords" src/store/records.ts
grep -n "export function putRecords\|export function removeRecords\|function freshId" src/store/useStore.ts
grep -n "activeEnergy" src/health/observation.ts
```

Expected:
- `DB_VERSION = 2` and `SCHEMA_VERSION = 6`;
- every registry name above;
- `putRecords`, `removeRecords` and a private `freshId`;
- the `activeEnergy` kind.

If the stores don't exist, Plan 6's Task 1 isn't merged. Tasks 2–7 and 9 can go first; wait for it before Task 8.

- [ ] **Step 3: Check Plans 2 and 4, and the acceptance runner**

```bash
grep -n "export function HubFrame\|export function HubSection" src/screens/hub/HubFrame.tsx
grep -n "Logging what you eat\|title=\"Food\"" src/screens/you/FoodScreen.tsx
grep -n "jsv\|jmsv" scripts/e2e/acceptance/run.mjs
grep -n "export async function openData" -A 6 scripts/e2e/acceptance/lib/data.mjs
```

Expected:
- `HubFrame` and `HubSection` exist;
- `FoodScreen` has the title "Food" and the "Logging what you eat" placeholder;
- the runner's filter takes `v` journeys;
- `openData` opens "Data".

- [ ] **Step 4: Read the FDC licence once more at the source.**
  - Open https://fdc.nal.usda.gov/ and its "Download Data" page in a browser.
  - Confirm the CC0 1.0 statement and the requested credit are as quoted in Step 5, and that the SR Legacy release is April 2018.
  - If either has changed, write what the page says now into the entry instead.

- [ ] **Step 5: Append the board entry.** Add this exact text at the end of `docs/reimagine/BOARD.md`.
  - If Steps 1–3 found different names, add one line per pair under "Names", in the form `- Plan 6 calls putRecords putRecordBatch`.
  - Otherwise leave that heading out.

```markdown
### 2026-10-10 — [claude] v2 Plan 7 (Food): where the food data comes from, and the decisions behind it

**Source record** (journey §11.6: written before the food step is built)

| | |
| --- | --- |
| Source | USDA FoodData Central (FDC), the SR Legacy dataset, used as ingredients only |
| Version | SR Legacy, April 2018 release. It's final (FDC no longer updates it), so its values can't change under us. The downloaded file's name and the extraction date are written into `scripts/food/fdc-ingredients.json` (`source.file`, `source.extractedOn`) |
| Licence | Public domain under CC0 1.0 Universal. FDC: "USDA FoodData Central data are in the public domain and they are not copyrighted. They are published under CC0 1.0 Universal" |
| Credit, as FDC asks | U.S. Department of Agriculture, Agricultural Research Service. FoodData Central. https://fdc.nal.usda.gov/ |
| Where it shows | Learn → Sources, under "Food data"; the Food hub's footer and "How estimates work"; each food's "What's in it", with its FDC ids |
| Our recipes | Written by us in `scripts/food/recipes.ts`: home-style, with sunflower oil and gram amounts per serving. The table they make is `src/data/food/foods.json` |
| Not used (D45) | INDB (no data licence), IFCT 2017 (no electronic product without NIN's written permission), Open Food Facts (ODbL share-alike, and "not for medical purposes"). No number is copied from any of them |

**Decisions.** Plan 7's are D95 to D104, the numbers set aside for it.

| # | Decision | Why |
| --- | --- | --- |
| D95 | Carbs are FDC's "Carbohydrate, by difference" (nutrient 205): total carbohydrate, fibre included, labelled "carbs". Energy is FDC's kcal (208), never kJ | It's the figure on Indian (FSSAI) and US labels, and one definition is used everywhere |
| D96 | Seasonings used at 2 g a serving or less (salt, hing, spices, ginger, garlic, chillies, curry leaves) have no FDC record and add nothing. They still carry allergen and diet tags | Their energy is a few kcal; their allergens matter |
| D97 | Carb ranges (B-12). Each ingredient varies ±10% (grains, pulses, dairy, eggs), ±20% (vegetables, fruit, coconut, tamarind) or not at all (oil, ghee, sugar, meat, fish). Each unit adds its portion variance: ±20% for a piece or a katori, ±25% for a plate, tablespoon or handful, ±15% for a glass or cup. A weighed portion adds none. Ranges add as intervals. A meal's range sums its known items, and unknown items are listed apart. `scripts/food/expected.ts` is the reviewed expectation for each dish, and a test fails any dish more than 20% away from it | B-12 asks for a defined method, reviewed |
| D98 | Portions are our own gram table (`src/food/units.ts` and each recipe), always shown with the grams. The person can weigh their own | No source defines a katori (feasibility research §2.3) |
| D99 | Allergens use Plan 5's canonical ids: peanut, tree nuts, milk, egg, wheat, soy, sesame, fish, shellfish and mustard. Each has aliases in English, Hindi and Hinglish (`src/food/allergens.ts`). "Gluten" reads as wheat, because our recipes use no barley, rye or oats. Coconut isn't a tree nut and isn't canonical, so a coconut allergy is a custom one. A custom allergy is anything else the person names; it's matched by word against every ingredient. Recipes assume sunflower oil, and compounded hing "may contain wheat". With any allergy, only fully tagged dishes are recommended. Logging never hides a food: it says "Contains peanut, which you listed as an allergy". A food the person leaves out (`avoid`) is still matched against a meal idea's own words, as in v1; only allergies reach into the recipes | B-13; setup stores these ids (Plan 5); v1's audit R04 stays true, as a compound such as "coconut milk" names no meal |
| D100 | Jain means no meat, fish, eggs or honey, and no root vegetables or bulbs (onion, garlic, potato, carrot, radish, beetroot, ginger). This is the app's convention, said in the picker; "Foods to leave out" covers anything else | Setup chapter 7 lists Jain, and v1's templates weren't written for it |
| D101 | Counts-free is the "Meals only, no numbers" level. It shows no calorie or carb figure and no energy figure from movement anywhere, old records and walk summaries included. It has no food prompts and no targets (B-11). Estimate snapshots are still stored with each item, and never shown in counts-free | Switching to estimates later shows old meals' estimates. B-11 governs what is shown |
| D102 | The answer to "Has food or weight ever been hard for you?" is kept where Plan 5 keeps it, `food.hardBefore`, on this phone only. It's asked when estimates are chosen and no answer is kept. "Yes" or "Prefer not to say" recommends "Meals only, no numbers" each time estimates are chosen, and estimates stay one tap away | K-22; one copy of the answer, as setup keeps it |
| D103 | The food prompt is opt-in, in Me → Food: one meal, at one time, with estimates only, in the app only. It's never in a calendar file, which can't know what was logged | J§11.5's caps, B-11 and A-73 |
| D104 | Each logged item keeps its name, recipe revision, unit, grams and estimate snapshot (B-12), so history reads the same when the table changes. Undo restores a deleted meal under a fresh id, with `restoredFrom`; the deletion record stays (B-05) | J§18.2, B-05 |

**Names**
```

- [ ] **Step 6: Commit**

```bash
git add docs/reimagine/BOARD.md
git commit -m "docs: Record the food data's source, licence and the Plan 7 decisions"
```

---

### Task 2: The food preferences contract

**Files:**
- Modify: `src/types/profile.ts` (`FoodPreferences`)
- Create: `src/food/level.ts`, `src/food/level.test.ts`
- Modify: `src/store/importCheck.ts` (`PROFILE_SPEC.food`), `src/store/importCheck.test.ts` (append)

**Interfaces:**
- Consumes: Plan 5's `FoodPreferences` (`pattern`, `avoid`, `region`, `allergies`, `level`, `hardBefore`).
- Produces:
  - `FoodPreferences` gains `customAllergies?: string[]`, `careTeamTargets?: { kcal?: number; carbsG?: number; setOn: string }` and `logReminder?: { meal: 'breakfast' | 'lunch' | 'dinner'; at: string }`, exactly as in Step 1;
  - in `src/food/level.ts`:
    - `type FoodLevel = NonNullable<FoodPreferences['level']>`;
    - `foodLevel(food: FoodPreferences | undefined): FoodLevel`;
    - `logsMeals(food: FoodPreferences | undefined): boolean`;
    - `countsFree(profile: Pick<UserProfile, 'food'> | undefined): boolean`;
    - `carbRanges(profile: UserProfile | undefined): boolean`;
    - `type NumbersView = { show: false } | { show: true; ranges: boolean }`;
    - `numbersView(profile: UserProfile | undefined): NumbersView`;
    - `type ScreenAnswer = NonNullable<FoodPreferences['hardBefore']>`;
    - `afterScreening(answer: ScreenAnswer): { recommended: FoodLevel; others: FoodLevel[] }`.

- [ ] **Step 1: The type.** In `src/types/profile.ts`, add these fields at the end of `FoodPreferences`, after Plan 5's `hardBefore`:

```ts
  /**
   * v2 (B-13): allergies the chips don't name, in the person's own words
   * ("brinjal"). Read through the aliases, so "groundnuts" still counts as
   * peanut; anything else is matched by word against every ingredient.
   */
  customAllergies?: string[];
  /** A daily target the person's care team gave them (journey §11.5). The app never suggests one. */
  careTeamTargets?: { kcal?: number; carbsG?: number; setOn: string };
  /** One daily reminder to log a meal, with estimates only (journey §7.4, A-73; board D103). Absent: off. */
  logReminder?: { meal: 'breakfast' | 'lunch' | 'dinner'; at: string };
```

- [ ] **Step 2: Write the failing test** `src/food/level.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import type { FoodPreferences, HealthProfile, UserProfile } from '@/types/profile';
import { afterScreening, carbRanges, countsFree, foodLevel, logsMeals, numbersView } from './level';

const person = (food?: Partial<FoodPreferences>, health: Partial<HealthProfile> = {}): UserProfile => createDefaultProfile({
  health: { medicinesReviewed: true, ...health },
  ...(food ? { food: { pattern: 'vegetarian', avoid: [], ...food } } : {}),
});

describe('food level (journey §11.1)', () => {
  it('reads nothing chosen as meal ideas only (A-20)', () => {
    expect(foodLevel(undefined)).toBe('ideas');
    expect(foodLevel({ pattern: 'vegan', avoid: [] })).toBe('ideas');
    expect(logsMeals(undefined)).toBe(false);
    expect(logsMeals({ pattern: 'vegan', avoid: [], level: 'meals' })).toBe(true);
  });
  it('is counts-free only for “meals only, no numbers” (B-11)', () => {
    expect(countsFree(person({ level: 'meals' }))).toBe(true);
    expect(countsFree(person({ level: 'estimates' }))).toBe(false);
    expect(countsFree(person({ level: 'ideas' }))).toBe(false);
    expect(countsFree(undefined)).toBe(false);
  });
  it('shows numbers only with estimates', () => {
    expect(numbersView(person({ level: 'meals' }))).toEqual({ show: false });
    expect(numbersView(person({ level: 'ideas' }))).toEqual({ show: false });
    expect(numbersView(person({ level: 'estimates' }))).toEqual({ show: true, ranges: false });
    expect(numbersView(person({ level: 'estimates' }, { diabetes: 'type2', insulin: 'injections_or_pump' }))).toEqual({ show: true, ranges: true });
  });
});

describe('carb ranges (K-22)', () => {
  it('with insulin, a sulfonylurea or a meglitinide, "not sure" included', () => {
    expect(carbRanges(person({}, { diabetes: 'type2', insulin: 'injections_or_pump' }))).toBe(true);
    expect(carbRanges(person({}, { diabetes: 'type2', sulfonylureaOrMeglitinide: true }))).toBe(true);
    expect(carbRanges(person({}, { diabetes: 'type2', sulfonylureaOrMeglitinide: 'unsure' }))).toBe(true);
  });
  it('while the medicines aren’t known, or the health answers aren’t reviewed', () => {
    expect(carbRanges(person({}, { diabetes: 'type2', medicinesReviewed: false }))).toBe(true);
    expect(carbRanges(createDefaultProfile({ needsHealthReview: true }))).toBe(true);
    expect(carbRanges(undefined)).toBe(true);
  });
  it('not with metformin alone, or without diabetes', () => {
    expect(carbRanges(person({}, { diabetes: 'type2', metformin: true }))).toBe(false);
    expect(carbRanges(person())).toBe(false);
  });
});

describe('after the screening question (journey §6.2 chapter 7, §11.5)', () => {
  it('"No" goes to estimates; "Yes" and "Prefer not to say" recommend meals only and keep estimates', () => {
    expect(afterScreening('no')).toEqual({ recommended: 'estimates', others: [] });
    expect(afterScreening('yes')).toEqual({ recommended: 'meals', others: ['estimates'] });
    expect(afterScreening('preferNot')).toEqual({ recommended: 'meals', others: ['estimates'] });
  });
});
```

- [ ] **Step 3: Run it to check it fails**

Run: `npx vitest run src/food/level.test.ts`
Expected: FAIL, "Cannot find module './level'".

- [ ] **Step 4: Write** `src/food/level.ts`

```ts
/**
 * How much the person logs, and what that lets the app show (journey §11.1,
 * §11.4, B-11). Every screen that could show a nutrition figure, or an energy
 * figure from movement, asks here first.
 *
 * Kept free of the food table: Home and the reminder host import this file.
 */
import { deriveHealth, profileGaps, takes } from '@/engine/health';
import type { FoodPreferences, UserProfile } from '@/types/profile';

export type FoodLevel = NonNullable<FoodPreferences['level']>;

/** The level the person chose. Nothing chosen is "meal ideas only" (A-20). */
export function foodLevel(food: FoodPreferences | undefined): FoodLevel {
  return food?.level ?? 'ideas';
}

/** Meals can be logged: "meals only, no numbers" or "with estimates". */
export function logsMeals(food: FoodPreferences | undefined): boolean {
  return foodLevel(food) !== 'ideas';
}

/**
 * Counts-free ("Meals only, no numbers", B-11; board D101): no calorie or
 * carb figure and no energy figure from movement anywhere, on old records
 * too; no food prompts; no numeric targets.
 */
export function countsFree(profile: Pick<UserProfile, 'food'> | undefined): boolean {
  return foodLevel(profile?.food) === 'meals';
}

/**
 * Carbs as a range, with "Carb figures are rough estimates…" (K-22): with
 * insulin, a sulfonylurea or a meglitinide, or while the medicine answers
 * aren't known, which the engine reads as "may be taking one".
 */
export function carbRanges(profile: UserProfile | undefined): boolean {
  if (!profile || profile.needsHealthReview) return true;
  const h = profile.health;
  if (deriveHealth(h).hypoRisk || h.insulin !== 'none' || takes(h.sulfonylureaOrMeglitinide)) return true;
  return profileGaps(profile).medicinesUnknown;
}

/** What a food screen may show: nothing numeric, or estimates, with carbs as ranges or not. */
export type NumbersView = { show: false } | { show: true; ranges: boolean };

export function numbersView(profile: UserProfile | undefined): NumbersView {
  return foodLevel(profile?.food) === 'estimates' ? { show: true, ranges: carbRanges(profile) } : { show: false };
}

/** The answer to "Has food or weight ever been hard for you?", kept as `food.hardBefore` (board D102). */
export type ScreenAnswer = NonNullable<FoodPreferences['hardBefore']>;

/**
 * What to offer once that question is answered (journey §6.2 chapter 7,
 * §11.5): "No" goes straight to estimates; "Yes" or "Prefer not to say"
 * recommends meals only, and estimates stay available.
 */
export function afterScreening(answer: ScreenAnswer): { recommended: FoodLevel; others: FoodLevel[] } {
  return answer === 'no' ? { recommended: 'estimates', others: [] } : { recommended: 'meals', others: ['estimates'] };
}
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run src/food/level.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 6: Write the failing import test.** Append to `src/store/importCheck.test.ts`. Its `file`, `settings`, `preview`, `planImport`, `emptySnapshot` and `createDefaultProfile` are already there.

```ts
describe('the food fields Plan 7 adds (journey §18.1, B-13)', () => {
  const profile = (food: unknown) => ({ ...createDefaultProfile({ weightKg: 70 }), food });
  const food = {
    pattern: 'jain', avoid: ['mushrooms'], level: 'estimates', hardBefore: 'no', allergies: ['peanut'], customAllergies: ['brinjal'],
    careTeamTargets: { kcal: 1600, setOn: '2026-10-01' }, logReminder: { meal: 'lunch', at: '14:30' },
  };
  it('reads them with the rest of the food preferences', () => {
    expect(preview(file({ settings, profile: profile(food) })).unreadableFields).toEqual([]);
    expect(planImport(file({ settings, profile: profile(food) }), 'replace', emptySnapshot()).change.profile?.food).toEqual(food);
  });
  it('leaves the food preferences out whole when any of them can’t be read, so meal ideas ask again rather than drop an allergy', () => {
    const bad = [
      { customAllergies: 'brinjal' }, { customAllergies: [''] }, { customAllergies: ['x'.repeat(61)] },
      { careTeamTargets: { kcal: -5, setOn: '2026-10-01' } }, { careTeamTargets: { kcal: 1600 } },
      { logReminder: { meal: 'brunch', at: '11:00' } }, { logReminder: { meal: 'lunch', at: '2pm' } },
    ];
    for (const over of bad) {
      expect(preview(file({ settings, profile: profile({ ...food, ...over }) })).unreadableFields, JSON.stringify(over)).toEqual(['profile.food']);
    }
  });
});
```

- [ ] **Step 7: Run it to check it fails**

Run: `npx vitest run src/store/importCheck.test.ts`
Expected: FAIL in the second case. `shape` keeps a field it doesn't know without checking it, so a bad `customAllergies`, `careTeamTargets` or `logReminder` isn't refused yet.

- [ ] **Step 8: Read the new fields.** In `src/store/importCheck.ts`, add three entries to `PROFILE_SPEC.food`'s `shape`, after Plan 5's `hardBefore`. `MEALS`, `clock`, `day`, `num` and `shape` are already in the file.

```ts
      // All or nothing (D-08): an unreadable allergy must not leave the rest standing as "no allergies".
      customAllergies: x => Array.isArray(x) && x.length <= 30 && x.every(a => typeof a === 'string' && a.trim() !== '' && a.length <= 60),
      careTeamTargets: shape({ kcal: num(1, 10000), carbsG: num(1, 2000), setOn: day }, ['setOn']),
      logReminder: shape({ meal: oneOf(...MEALS), at: clock }, ['meal', 'at']),
```

- [ ] **Step 9: Run it**

Run: `npx vitest run src/store/importCheck.test.ts`
Expected: PASS, Plan 5's cases included.

- [ ] **Step 10: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/types/profile.ts src/food/level.ts src/food/level.test.ts src/store/importCheck.ts src/store/importCheck.test.ts
git commit -m "feat: Add the food fields Plan 7 needs, the logging level and counts-free"
```

---

### Task 3: Allergens

**Files:**
- Create: `src/food/allergens.ts`, `src/food/allergens.test.ts`

**Interfaces:**
- Consumes: `ALLERGEN_IDS`, `type AllergenId` and `FoodPreferences` from `@/types/profile` (Plan 5); `tokens` from `@/content/text`.
- Produces:
  - `interface Allergen { id: AllergenId; label: string; name: string; aliases: readonly string[] }`, and `ALLERGENS: readonly Allergen[]` in `ALLERGEN_IDS` order;
  - `isAllergenId(x: unknown): x is AllergenId`;
  - `allergenName(id: AllergenId): string`, `allergenList(ids: readonly AllergenId[]): string`;
  - `resolveAllergens(text: string): AllergenId[]`;
  - `interface Allergies { known: AllergenId[]; custom: string[][] }`, and `allergiesOf(food: Pick<FoodPreferences, 'allergies' | 'customAllergies'> | undefined): Allergies`;
  - `interface AllergenTags { contains: readonly AllergenId[]; mayContain: readonly AllergenId[]; complete: boolean; words: readonly string[] }`;
  - `recommendable(tags: AllergenTags, allergies: Allergies): boolean`;
  - `allergyWarning(tags: AllergenTags, allergies: Allergies): string | undefined`.

- [ ] **Step 1: Write the failing test** `src/food/allergens.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { ALLERGEN_IDS } from '@/types/profile';
import { ALLERGENS, allergenList, allergiesOf, allergyWarning, recommendable, resolveAllergens, type AllergenTags } from './allergens';

const tags = (over: Partial<AllergenTags> = {}): AllergenTags => ({ contains: [], mayContain: [], complete: true, words: [], ...over });

describe('the canonical allergens (B-13, board D99)', () => {
  it('are Plan 5’s ten, each with a chip label and aliases', () => {
    expect(ALLERGENS.map(a => a.id)).toEqual([...ALLERGEN_IDS]);
    for (const a of ALLERGENS) expect(a.aliases.length, a.id).toBeGreaterThan(1);
  });
});

describe('resolveAllergens: the person’s own words to canonical ids (B-13, Review Focus 2)', () => {
  it('finds a canonical allergen by any of its names, singular or plural, in English, Hindi or Hinglish', () => {
    expect(resolveAllergens('peanut')).toEqual(['peanut']);
    expect(resolveAllergens('Peanuts')).toEqual(['peanut']);
    expect(resolveAllergens('groundnuts')).toEqual(['peanut']);
    expect(resolveAllergens('मूंगफली')).toEqual(['peanut']);
    expect(resolveAllergens('Prawns')).toEqual(['shellfish']);
    expect(resolveAllergens('dahi')).toEqual(['milk']);
    expect(resolveAllergens('gluten')).toEqual(['wheat']);
    expect(resolveAllergens('lactose intolerant')).toEqual(['milk']);
    expect(resolveAllergens('treeNut')).toEqual(['treeNut']);
  });
  it('reads an umbrella word as every allergen it covers', () => {
    expect(resolveAllergens('nuts')).toEqual(['peanut', 'treeNut']);
    expect(resolveAllergens('seafood')).toEqual(['fish', 'shellfish']);
    expect(resolveAllergens('tree nuts')).toEqual(['treeNut']);
  });
  it('keeps coconut apart from tree nuts (board D99)', () => {
    expect(resolveAllergens('coconut')).toEqual([]);
    expect(resolveAllergens('tree nuts')).not.toContain('coconut');
  });
  it('names nothing for a word it doesn’t know', () => {
    expect(resolveAllergens('brinjal')).toEqual([]);
    expect(resolveAllergens('  ')).toEqual([]);
  });
});

describe('allergiesOf', () => {
  it('reads the chips, and the own words through the aliases, leaving the rest as custom allergies', () => {
    expect(allergiesOf({ allergies: ['peanut', 'sesame'], customAllergies: ['Groundnut', 'Brinjals', 'coconut'] }))
      .toEqual({ known: ['peanut', 'sesame'], custom: [['brinjal'], ['coconut']] });
    expect(allergiesOf(undefined)).toEqual({ known: [], custom: [] });
    expect(allergiesOf({})).toEqual({ known: [], custom: [] });
  });
});

describe('recommendable (B-13)', () => {
  const peanut = allergiesOf({ allergies: ['peanut'] });
  const brinjal = allergiesOf({ customAllergies: ['brinjal'] });
  it('recommends anything to someone with no allergies, fully tagged or not', () => {
    expect(recommendable(tags({ complete: false }), allergiesOf({}))).toBe(true);
  });
  it('leaves out what contains or may contain the allergen', () => {
    expect(recommendable(tags({ contains: ['peanut'] }), peanut)).toBe(false);
    expect(recommendable(tags({ mayContain: ['peanut'] }), peanut)).toBe(false);
    expect(recommendable(tags({ contains: ['milk'] }), peanut)).toBe(true);
  });
  it('with any allergy, leaves out what isn’t fully tagged', () => {
    expect(recommendable(tags({ complete: false }), peanut)).toBe(false);
    expect(recommendable(tags({ complete: false }), brinjal)).toBe(false);
  });
  it('matches a custom allergy against every word the dish and its ingredients go by', () => {
    expect(recommendable(tags({ words: ['baingan', 'brinjal', 'bharta'] }), brinjal)).toBe(false);
    expect(recommendable(tags({ words: ['roti', 'wheat'] }), brinjal)).toBe(true);
    expect(recommendable(tags({ words: ['green', 'pea', 'matar'] }), allergiesOf({ customAllergies: ['green peas'] }))).toBe(false);
    expect(recommendable(tags({ words: ['pea'] }), allergiesOf({ customAllergies: ['green peas'] }))).toBe(true);
  });
});

describe('allergyWarning: logging never hides a food, it says why (B-13)', () => {
  it('names a contained or possible allergen, or a custom match, in plain words', () => {
    expect(allergyWarning(tags({ contains: ['peanut', 'mustard'] }), allergiesOf({ allergies: ['peanut', 'mustard'] }))).toBe('Contains peanut and mustard, which you listed as allergies');
    expect(allergyWarning(tags({ mayContain: ['wheat'] }), allergiesOf({ customAllergies: ['gluten'] }))).toBe('May contain wheat, which you listed as an allergy');
    expect(allergyWarning(tags({ words: ['brinjal'] }), allergiesOf({ customAllergies: ['Brinjal'] }))).toBe('Contains brinjal, which you listed as an allergy');
    expect(allergyWarning(tags({ contains: ['milk'] }), allergiesOf({ allergies: ['peanut'] }))).toBeUndefined();
  });
  it('lists allergens as a sentence would', () => {
    expect(allergenList(['wheat'])).toBe('wheat');
    expect(allergenList(['milk', 'treeNut', 'sesame'])).toBe('milk, tree nuts and sesame');
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/food/allergens.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write** `src/food/allergens.ts`

```ts
/**
 * Allergens by Plan 5's canonical ids, with the words people use for them
 * (B-13; board D99). Meal ideas leave out anything that contains an
 * allergen, may contain one, or isn't fully tagged. With an allergy the
 * aliases don't name, only fully tagged dishes without that word are
 * recommended. Logging never hides a food: it says what's in it
 * (`allergyWarning`).
 *
 * Kept free of the food table: it's matched against whatever tags it's given.
 */
import { tokens } from '@/content/text';
import { ALLERGEN_IDS, type AllergenId, type FoodPreferences } from '@/types/profile';

export interface Allergen {
  id: AllergenId;
  /** On the chip. */
  label: string;
  /** In a sentence: "Contains tree nuts". */
  name: string;
  aliases: readonly string[];
}

const ALLERGEN_DEFS: Record<AllergenId, Omit<Allergen, 'id'>> = {
  peanut: { label: 'Peanuts', name: 'peanut', aliases: ['peanut', 'groundnut', 'moongphali', 'mungfali', 'nut', 'मूंगफली', 'मूँगफली'] },
  treeNut: { label: 'Tree nuts (almond, cashew)', name: 'tree nuts', aliases: ['tree nut', 'nut', 'almond', 'badam', 'cashew', 'kaju', 'walnut', 'akhrot', 'pistachio', 'pista', 'hazelnut', 'pecan', 'बादाम', 'काजू'] },
  milk: { label: 'Milk', name: 'milk', aliases: ['milk', 'dairy', 'lactose', 'curd', 'dahi', 'yogurt', 'yoghurt', 'paneer', 'ghee', 'butter', 'cream', 'cheese', 'khoya', 'doodh', 'दूध', 'दही', 'पनीर', 'घी'] },
  egg: { label: 'Egg', name: 'egg', aliases: ['egg', 'anda', 'अंडा'] },
  // Our recipes use no barley, rye or oats, so gluten here is wheat's (D99).
  wheat: { label: 'Wheat (gluten)', name: 'wheat', aliases: ['wheat', 'gluten', 'atta', 'maida', 'sooji', 'suji', 'rava', 'semolina', 'gehun', 'coeliac', 'celiac', 'गेहूं', 'गेहूँ', 'मैदा'] },
  soy: { label: 'Soy', name: 'soy', aliases: ['soy', 'soya', 'soybean', 'tofu'] },
  sesame: { label: 'Sesame (til)', name: 'sesame', aliases: ['sesame', 'til', 'gingelly', 'तिल'] },
  fish: { label: 'Fish', name: 'fish', aliases: ['fish', 'seafood', 'machli', 'machhli', 'मछली'] },
  shellfish: { label: 'Shellfish (prawn, crab)', name: 'shellfish', aliases: ['shellfish', 'seafood', 'crustacean', 'prawn', 'shrimp', 'jhinga', 'crab', 'lobster', 'mollusc', 'mollusk', 'squid', 'clam', 'oyster', 'mussel', 'झींगा'] },
  mustard: { label: 'Mustard (rai)', name: 'mustard', aliases: ['mustard', 'rai', 'sarson', 'सरसों', 'राई'] },
};

export const ALLERGENS: readonly Allergen[] = ALLERGEN_IDS.map(id => ({ id, ...ALLERGEN_DEFS[id] }));

const ALIASES = ALLERGENS.flatMap(a => a.aliases.map(alias => ({ id: a.id, words: tokens(alias) })));
const unique = <T>(xs: readonly T[]): T[] => [...new Set(xs)];
const and = (names: readonly string[]) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

export function isAllergenId(x: unknown): x is AllergenId {
  return typeof x === 'string' && (ALLERGEN_IDS as readonly string[]).includes(x);
}

export function allergenName(id: AllergenId): string {
  return ALLERGEN_DEFS[id].name;
}

/** "milk, tree nuts and sesame". */
export function allergenList(ids: readonly AllergenId[]): string {
  return and(ids.map(allergenName));
}

/**
 * The canonical allergens a person's own words name: those an alias matches
 * exactly ("tree nuts"), or else every one whose alias the words contain
 * ("allergic to nuts and dairy"). An id from a chip is itself.
 */
export function resolveAllergens(text: string): AllergenId[] {
  if (isAllergenId(text)) return [text];
  const words = tokens(text);
  if (words.length === 0) return [];
  const phrase = words.join(' ');
  const exact = ALIASES.filter(a => a.words.join(' ') === phrase).map(a => a.id);
  if (exact.length > 0) return unique(exact);
  const have = new Set(words);
  return unique(ALIASES.filter(a => a.words.length > 0 && a.words.every(w => have.has(w))).map(a => a.id));
}

export interface Allergies {
  known: AllergenId[];
  /** Each own-words entry the aliases don't name, as its folded words. */
  custom: string[][];
}

/** The person's allergies: the chips, and their own words read through the aliases first. */
export function allergiesOf(food: Pick<FoodPreferences, 'allergies' | 'customAllergies'> | undefined): Allergies {
  const known: AllergenId[] = [...(food?.allergies ?? [])];
  const custom: string[][] = [];
  for (const entry of food?.customAllergies ?? []) {
    const ids = resolveAllergens(entry);
    if (ids.length > 0) known.push(...ids);
    else {
      const words = tokens(entry);
      if (words.length > 0) custom.push(words);
    }
  }
  return { known: unique(known), custom };
}

/** What a dish, a meal idea or a food is tagged with. `words` are folded (`tokens`). */
export interface AllergenTags {
  contains: readonly AllergenId[];
  mayContain: readonly AllergenId[];
  /** Every part of it is tagged; a blend of unknown make-up isn't. */
  complete: boolean;
  words: readonly string[];
}

/** Whether this may be recommended to this person (B-13). */
export function recommendable(tags: AllergenTags, allergies: Allergies): boolean {
  if (allergies.known.length === 0 && allergies.custom.length === 0) return true;
  if (!tags.complete) return false;
  if (allergies.known.some(id => tags.contains.includes(id) || tags.mayContain.includes(id))) return false;
  const words = new Set(tags.words);
  return !allergies.custom.some(entry => entry.every(w => words.has(w)));
}

const listed = (n: number) => (n === 1 ? 'which you listed as an allergy' : 'which you listed as allergies');

/** Why a food the person can still log is marked for them, or nothing. */
export function allergyWarning(tags: AllergenTags, allergies: Allergies): string | undefined {
  const contains = allergies.known.filter(id => tags.contains.includes(id));
  if (contains.length > 0) return `Contains ${allergenList(contains)}, ${listed(contains.length)}`;
  const may = allergies.known.filter(id => tags.mayContain.includes(id));
  if (may.length > 0) return `May contain ${allergenList(may)}, ${listed(may.length)}`;
  const words = new Set(tags.words);
  const hits = allergies.custom.filter(entry => entry.every(w => words.has(w))).map(entry => entry.join(' '));
  return hits.length > 0 ? `Contains ${and(hits)}, ${listed(hits.length)}` : undefined;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/food/allergens.test.ts`
Expected: PASS.

- [ ] **Step 5: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/food/allergens.ts src/food/allergens.test.ts
git commit -m "feat: Give Plan 5's allergens their aliases, and read custom allergies"
```

---

### Task 4: The food table's maths

**Files:**
- Create: `src/food/types.ts`, `src/food/units.ts`, `src/food/units.test.ts`, `src/food/compute.ts`, `src/food/compute.test.ts`

**Interfaces:**
- Consumes: `ALLERGEN_IDS` and `type AllergenId` from `@/types/profile` (Plan 5); `tokens` from `@/content/text`; `Pattern` and `Slot` from `@/content/schema`.
- Produces:
  - `src/food/types.ts`: `ShelfId`, `Portion`, `Food`, `RecipeIngredient`, `FoodSource`, `FoodData`, and the record types `FoodItem`, `CustomItem`, `QuickItem`, `MealItem`, `LoggedLevel`, `MealRecord`, `MealEdit`, `SavedMeal` and `CustomFood`, exactly as written in Step 1;
  - `src/food/units.ts`: `type UnitId`, `interface Unit`, `UNITS: Readonly<Record<UnitId, Unit>>`, `isUnitId(x: unknown): x is UnitId`, `countText(n: number): string`, `portionText(p: Pick<Portion, 'unit' | 'noun'>, count: number, gramsPerPortion: number): string`;
  - `src/food/compute.ts`:
    - the types `FdcRecord`, `FdcExtract`, `Ingredient` and `Recipe`;
    - `SEASONING_MAX_G = 2`;
    - `fdcFoods(json: unknown): unknown[]` and `fdcRecord(food: unknown): FdcRecord`;
    - `patternsOf(ingredients: readonly Pick<Ingredient, 'animal' | 'root'>[]): Pattern[]`;
    - `hashOf(recipe: Pick<Recipe, 'portion' | 'yieldG' | 'ingredients'>): string`;
    - `buildFoodData(input: { fdc: FdcExtract; ingredients: readonly Ingredient[]; recipes: readonly Recipe[] }): FoodData`;
    - `unbumped(before: Pick<FoodData, 'foods'> | undefined, after: Pick<FoodData, 'foods'>): string[]`.

- [ ] **Step 1: The types** `src/food/types.ts`

```ts
/**
 * The food table (generated: `src/data/food/foods.json`) and the person's food
 * records (journey §11, §18.2). Types only.
 */
import type { Pattern, Slot } from '@/content/schema';
import type { AllergenId } from '@/types/profile';
import type { UnitId } from './units';

export type { Slot } from '@/content/schema';

/** Where a food sits in "Common Indian foods", in this order (`SHELVES` in search.ts). */
export type ShelfId = 'breads' | 'breakfast' | 'dal' | 'veg' | 'sides' | 'eggsMeat' | 'snacks' | 'drinks' | 'fruit';

/** A standard portion: one unit's weight in grams (our own table, board D98) and how many units it is. */
export interface Portion {
  unit: UnitId;
  grams: number;
  /** Two idlis, two tablespoons of chutney: what "+" adds at once. */
  count: number;
  /** For `piece`: what one and several are called. */
  noun?: [one: string, many: string];
}

export interface RecipeIngredient {
  key: string;
  name: string;
  grams: number;
  /** `null` for a seasoning or water, which adds nothing (board D96). */
  fdcId: number | null;
  proxy?: string;
}

export interface Food {
  id: string;
  /** Raised when the recipe changes; every logged item keeps the one it used (B-12). */
  rev: number;
  name: string;
  aliases: string[];
  shelf: ShelfId;
  slots: Slot[];
  portion: Portion;
  /** Per 100 g of the dish as served. Carbs are total carbohydrate (D95); the range is the ingredients' own variance (D97). */
  per100g: { kcal: number; carbsG: number; carbsLowG: number; carbsHighG: number };
  allergens: { contains: AllergenId[]; mayContain: AllergenId[]; complete: boolean };
  patterns: Pattern[];
  /** Every word its name, aliases and ingredients go by, folded: what a custom allergy is matched against (B-13). */
  words: string[];
  recipe: { note: string; hash: string; ingredients: RecipeIngredient[] };
}

export interface FoodSource { name: string; url: string; licence: string; credit: string; dataset: string; file: string; extractedOn: string }

export interface FoodData { format: 'fit-strong-food'; version: 1; source: FoodSource; foods: Food[] }

// ---- The person's records (journey §18.2) ----------------------------------

interface ItemBase {
  /** As it was called when logged, so history reads the same if the table changes (D104). */
  name: string;
  /** The estimate when logged. Absent is unknown, never 0 (A-17). */
  kcal?: number;
  carbsG?: number;
}

/** A food from the table: `count × gramsPerPortion` grams, worked out from recipe revision `rev` (B-12). */
export interface FoodItem extends ItemBase {
  kind: 'food';
  foodId: string;
  rev: number;
  unit: UnitId;
  count: number;
  /** One unit's weight: the table's, or the person's own when `weighed`. */
  gramsPerPortion: number;
  weighed?: true;
  carbsLowG?: number;
  carbsHighG?: number;
}

/** `count` portions of one of the person's own foods. */
export interface CustomItem extends ItemBase { kind: 'custom'; customId: string; count: number }

/** "About how much?" with no food named: a plate size, with kcal only if the person gave a number. Never carbs. */
export interface QuickItem extends ItemBase { kind: 'quick'; size: 'small' | 'normal' | 'large' }

export type MealItem = FoodItem | CustomItem | QuickItem;

/** The level a meal was logged at. What's shown never depends on it: B-11 reads the level now. */
export type LoggedLevel = 'meals' | 'estimates';

export interface MealRecord {
  id: string;
  /** When it was eaten, ISO with offset. */
  at: string;
  /** `at`'s local day. */
  day: string;
  meal: Slot;
  items: MealItem[];
  level: LoggedLevel;
  loggedAt: string;
  /** When it was last corrected. */
  editedAt?: string;
  /** Earlier versions, oldest first (A-22). */
  edits: MealEdit[];
  /** Brought back by Undo: the deleted record's id (B-05). */
  restoredFrom?: string;
}

export interface MealEdit { replacedAt: string; at: string; meal: Slot; items: MealItem[] }

export interface SavedMeal {
  id: string;
  name: string;
  meal?: Slot;
  items: MealItem[];
  savedAt: string;
  updatedAt: string;
  restoredFrom?: string;
}

export interface CustomFood {
  id: string;
  name: string;
  /** What one portion is, in the person's words: 1 plate, 100 g. */
  per: { qty: number; unit: string };
  kcal?: number;
  carbsG?: number;
  allergens?: AllergenId[];
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Write the failing test** `src/food/units.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { countText, portionText, UNITS } from './units';

describe('household units (journey §11.3, §11.6)', () => {
  it('writes counts in halves', () => {
    expect(countText(0.5)).toBe('½');
    expect(countText(1)).toBe('1');
    expect(countText(1.5)).toBe('1½');
    expect(countText(2)).toBe('2');
  });
  it('shows every portion with its grams', () => {
    expect(portionText({ unit: 'piece', noun: ['roti', 'rotis'] }, 2, 40)).toBe('2 rotis (≈ 80 g)');
    expect(portionText({ unit: 'katori' }, 0.5, 150)).toBe('½ katori (≈ 75 g)');
    expect(portionText({ unit: 'katori' }, 1.5, 150)).toBe('1½ katoris (≈ 225 g)');
    expect(portionText({ unit: 'tbsp' }, 2, 15)).toBe('2 tablespoons (≈ 30 g)');
  });
  it('steps katoris in halves and pieces whole', () => {
    expect(UNITS.katori.step).toBe(0.5);
    expect(UNITS.piece.step).toBe(1);
  });
});
```

- [ ] **Step 3: Run it to check it fails**

Run: `npx vitest run src/food/units.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Write** `src/food/units.ts`

```ts
/**
 * Household units (journey §11.6; board D98). No source defines a katori or
 * a roti, so each food's portion is stated by us in grams, every portion shows
 * its grams, and the person can weigh their own.
 */
import type { Portion } from './types';

export type UnitId = 'piece' | 'katori' | 'plate' | 'glass' | 'cup' | 'tbsp' | 'handful';

export interface Unit {
  one: string;
  many: string;
  /** What the stepper moves by. */
  step: 0.5 | 1;
  /** How far a standard portion's weight may vary, as a fraction (D97). */
  variance: number;
  /** The volume we take it to be, shown beside the grams. */
  volume?: string;
}

export const UNITS: Readonly<Record<UnitId, Unit>> = {
  piece: { one: 'piece', many: 'pieces', step: 1, variance: 0.2 },
  katori: { one: 'katori', many: 'katoris', step: 0.5, variance: 0.2, volume: '1 katori ≈ 150 ml' },
  plate: { one: 'plate', many: 'plates', step: 0.5, variance: 0.25 },
  glass: { one: 'glass', many: 'glasses', step: 0.5, variance: 0.15, volume: '1 glass ≈ 200 ml' },
  cup: { one: 'cup', many: 'cups', step: 0.5, variance: 0.15, volume: '1 cup ≈ 150 ml' },
  tbsp: { one: 'tablespoon', many: 'tablespoons', step: 1, variance: 0.25, volume: '1 tablespoon ≈ 15 ml' },
  handful: { one: 'handful', many: 'handfuls', step: 0.5, variance: 0.25 },
};

export function isUnitId(x: unknown): x is UnitId {
  return typeof x === 'string' && Object.hasOwn(UNITS, x);
}

/** 0.5 → "½", 1.5 → "1½", 2 → "2". Counts move in halves at most. */
export function countText(n: number): string {
  const whole = Math.floor(n);
  const half = n - whole >= 0.5;
  return `${whole > 0 ? whole : ''}${half ? '½' : ''}` || '0';
}

/** "2 rotis (≈ 80 g)", "½ katori (≈ 75 g)". */
export function portionText(p: Pick<Portion, 'unit' | 'noun'>, count: number, gramsPerPortion: number): string {
  const unit = UNITS[p.unit];
  const [one, many] = p.unit === 'piece' && p.noun ? p.noun : [unit.one, unit.many];
  return `${countText(count)} ${count > 1 ? many : one} (≈ ${Math.round(count * gramsPerPortion)} g)`;
}
```

- [ ] **Step 5: Run it**

Run: `npx vitest run src/food/units.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing test** `src/food/compute.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { buildFoodData, fdcFoods, fdcRecord, hashOf, patternsOf, unbumped, type FdcExtract, type Ingredient, type Recipe } from './compute';

const source = { name: 'USDA FoodData Central', url: 'https://fdc.nal.usda.gov/', licence: 'CC0 1.0 Universal (public domain)', credit: 'credit', dataset: 'SR Legacy', file: 'f.json', extractedOn: '2026-10-10' };
const fdc: FdcExtract = {
  source,
  records: [
    { fdcId: 1, dataType: 'SR Legacy', description: 'Flour', kcal: 340, carbsG: 72 },
    { fdcId: 2, dataType: 'SR Legacy', description: 'Oil', kcal: 884, carbsG: 0 },
  ],
};
const ing = (over: Partial<Ingredient> & Pick<Ingredient, 'key'>): Ingredient =>
  ({ name: over.key, aliases: [], fdc: null, contains: [], mayContain: [], carbVariance: 0, ...over });
const INGREDIENTS: Ingredient[] = [
  ing({ key: 'flour', name: 'Wheat flour', aliases: ['atta'], fdc: 'Flour', contains: ['wheat'], carbVariance: 0.1 }),
  ing({ key: 'oil', fdc: 'Oil' }),
  ing({ key: 'salt' }),
  ing({ key: 'hing', mayContain: ['wheat'] }),
  ing({ key: 'water', water: true }),
];
const paratha: Recipe = {
  id: 'paratha', rev: 1, name: 'Plain paratha', aliases: ['parantha'], shelf: 'breads', slots: ['breakfast'],
  portion: { unit: 'piece', grams: 60, count: 1, noun: ['paratha', 'parathas'] }, yieldG: 60,
  ingredients: [['flour', 40], ['oil', 5], ['salt', 1], ['water', 20]], note: 'Home-style, 1 tsp oil',
};
const build = (recipes: Recipe[], ingredients = INGREDIENTS) => buildFoodData({ fdc, ingredients, recipes });

describe('buildFoodData (journey §11.6, B-12)', () => {
  it('works out per-100 g values from the ingredients over the cooked yield', () => {
    const [f] = build([paratha]).foods;
    // (40 × 3.40 + 5 × 8.84) = 180.2 kcal over 60 g; 40 × 0.72 = 28.8 g carbs over 60 g.
    expect(f.per100g.kcal).toBe(300.3);
    expect(f.per100g.carbsG).toBe(48);
    // ±10% on the flour's carbs only: 25.92 and 31.68 g over 60 g.
    expect(f.per100g.carbsLowG).toBe(43.2);
    expect(f.per100g.carbsHighG).toBe(52.8);
  });
  it('keeps the recipe beside the dish, with each ingredient’s FDC id, and counts nothing for a seasoning', () => {
    const [f] = build([paratha]).foods;
    expect(f.recipe.ingredients).toEqual([
      { key: 'flour', name: 'Wheat flour', grams: 40, fdcId: 1 },
      { key: 'oil', name: 'oil', grams: 5, fdcId: 2 },
      { key: 'salt', name: 'salt', grams: 1, fdcId: null },
      { key: 'water', name: 'water', grams: 20, fdcId: null },
    ]);
    expect(f.recipe.note).toBe('Home-style, 1 tsp oil');
    expect(f.recipe.hash).toBe(hashOf(paratha));
  });
  it('tags allergens from the ingredients, “may contain” apart from “contains”', () => {
    expect(build([paratha]).foods[0].allergens).toEqual({ contains: ['wheat'], mayContain: [], complete: true });
    const dal: Recipe = { ...paratha, id: 'dal', ingredients: [['oil', 5], ['hing', 0.1], ['water', 55]] };
    expect(build([dal]).foods[0].allergens).toEqual({ contains: [], mayContain: ['wheat'], complete: true });
  });
  it('isn’t fully tagged with a blend in it (B-13)', () => {
    const masala = ing({ key: 'masala', blend: true });
    expect(build([{ ...paratha, ingredients: [['flour', 40], ['masala', 1]] }], [...INGREDIENTS, masala]).foods[0].allergens.complete).toBe(false);
  });
  it('lists every word the dish and its ingredients go by, for custom allergies', () => {
    expect(build([paratha]).foods[0].words).toEqual(expect.arrayContaining(['paratha', 'parantha', 'wheat', 'flour', 'atta']));
  });
  it('refuses inputs it can’t trust, naming every problem at once', () => {
    const bad: Recipe[] = [
      { ...paratha, id: 'Bad Id', yieldG: 50 },
      { ...paratha, id: 'heavy', ingredients: [['salt', 5]] },
      { ...paratha, id: 'missing', ingredients: [['ghee', 5]] },
    ];
    expect(() => build(bad)).toThrow(/Bad Id: the id[\s\S]*yieldG 50 isn't count × grams \(60\)[\s\S]*salt has no FDC values, so it may be at most 2 g a serving, not 5 g[\s\S]*unknown ingredient ghee/);
    expect(() => build([paratha], [...INGREDIENTS, ing({ key: 'ghee', fdc: 'Butter oil, anhydrous' })])).toThrow(/no FDC record "Butter oil, anhydrous"/);
    expect(() => build([paratha, paratha])).toThrow(/recipe paratha is listed twice/);
    expect(() => build([{ ...paratha, portion: { unit: 'piece', grams: 60, count: 1 } }])).toThrow(/a piece needs a noun/);
  });
});

describe('patternsOf (board D100)', () => {
  it('reads eating patterns from the ingredients', () => {
    expect(patternsOf([{}])).toEqual(['vegetarian', 'eggetarian', 'nonVegetarian', 'vegan', 'jain']);
    expect(patternsOf([{ animal: 'dairy' }])).toEqual(['vegetarian', 'eggetarian', 'nonVegetarian', 'jain']);
    expect(patternsOf([{ animal: 'egg' }])).toEqual(['eggetarian', 'nonVegetarian']);
    expect(patternsOf([{ animal: 'fish' }])).toEqual(['nonVegetarian']);
    expect(patternsOf([{ root: true }])).toEqual(['vegetarian', 'eggetarian', 'nonVegetarian', 'vegan']);
    expect(patternsOf([{ animal: 'honey' }])).toEqual(['vegetarian', 'eggetarian', 'nonVegetarian']);
  });
});

describe('FDC downloads', () => {
  const food = {
    fdcId: 168893, dataType: 'SR Legacy', description: 'Wheat flour, whole-grain', foodNutrients: [
      { nutrient: { number: '268', unitName: 'kJ' }, amount: 1423 },
      { nutrient: { number: '208', unitName: 'kcal' }, amount: 340 },
      { nutrient: { number: '205', unitName: 'g' }, amount: 71.97 },
    ],
  };
  it('finds the food list under whatever top-level key the file uses', () => {
    expect(fdcFoods({ SRLegacyFoods: [food] })).toEqual([food]);
    expect(() => fdcFoods({ Other: 'x' })).toThrow(/No FoodData Central food list/);
  });
  it('reads energy in kcal, never kJ, and carbohydrate by difference (D95)', () => {
    expect(fdcRecord(food)).toEqual({ fdcId: 168893, dataType: 'SR Legacy', description: 'Wheat flour, whole-grain', kcal: 340, carbsG: 71.97 });
    expect(() => fdcRecord({ ...food, foodNutrients: food.foodNutrients.slice(0, 1) })).toThrow(/no energy in kcal or no carbohydrate/);
  });
});

describe('unbumped (B-12)', () => {
  it('names a recipe whose content changed while its rev didn’t rise', () => {
    const before = build([paratha]);
    const more = (rev: number) => build([{ ...paratha, rev, ingredients: [['flour', 45], ['oil', 5]] }]);
    expect(unbumped(before, more(1))).toEqual(['paratha']);
    expect(unbumped(before, more(2))).toEqual([]);
    expect(unbumped(before, before)).toEqual([]);
    expect(unbumped(undefined, before)).toEqual([]);
  });
});
```

- [ ] **Step 7: Run it to check it fails**

Run: `npx vitest run src/food/compute.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 8: Write** `src/food/compute.ts`

```ts
/**
 * The food table, worked out from FoodData Central ingredient values and our
 * own recipes (journey §11.6, B-12; board D95 to D98). Pure: build.ts runs
 * it to write src/data/food/foods.json, and data.node.test.ts runs it again to
 * prove the committed file is what these inputs give.
 *
 * - Values are per 100 g of the dish as served: the ingredients' FDC values
 *   for their weights, over the cooked yield we wrote down.
 * - Carbs are FDC's "Carbohydrate, by difference": total, fibre included.
 * - The carb range adds each ingredient's own variance as an interval. A
 *   portion's variance is added when it's eaten (estimate.ts).
 * - Allergens are the union of the ingredients' tags. A dish with a blend of
 *   unknown make-up isn't fully tagged (B-13).
 * - Seasonings at 2 g a serving or less have no FDC record and add nothing.
 */
import type { Pattern, Slot } from '@/content/schema';
import { tokens } from '@/content/text';
import { ALLERGEN_IDS, type AllergenId } from '@/types/profile';
import type { Food, FoodData, FoodSource, Portion, RecipeIngredient, ShelfId } from './types';

export interface FdcRecord { fdcId: number; dataType: string; description: string; kcal: number; carbsG: number }
export interface FdcExtract { source: FoodSource; records: FdcRecord[] }

export interface Ingredient {
  key: string;
  name: string;
  aliases: string[];
  /** The FDC record, by its exact description; `null` for a seasoning (at most 2 g a serving) or water. */
  fdc: string | null;
  /** Why this FDC record stands in for one FDC doesn't have. */
  proxy?: string;
  contains: readonly AllergenId[];
  mayContain: readonly AllergenId[];
  /** A blend of unknown make-up: a dish with one isn't fully tagged. */
  blend?: true;
  animal?: 'dairy' | 'egg' | 'fish' | 'meat' | 'honey';
  /** A root vegetable or bulb, which Jain cooking leaves out (D100). */
  root?: true;
  /** How far its carbohydrate may vary from FDC's figure, as a fraction (D97). */
  carbVariance: number;
  /** Any amount, and no values. */
  water?: true;
}

export interface Recipe {
  id: string;
  rev: number;
  name: string;
  aliases: string[];
  shelf: ShelfId;
  slots: Slot[];
  portion: Portion;
  /** The cooked weight of one standard portion: always `portion.count × portion.grams`. */
  yieldG: number;
  ingredients: [key: string, grams: number][];
  note: string;
}

export const SEASONING_MAX_G = 2;
const ENERGY_KCAL = '208';
const CARBOHYDRATE = '205';
const PATTERNS: Pattern[] = ['vegetarian', 'eggetarian', 'nonVegetarian', 'vegan', 'jain'];
const ALLERGEN_ORDER: readonly AllergenId[] = ALLERGEN_IDS;

const round = (n: number, places: number) => Math.round(n * 10 ** places) / 10 ** places;
const sorted = (ids: readonly AllergenId[]) => [...new Set(ids)].sort((a, b) => ALLERGEN_ORDER.indexOf(a) - ALLERGEN_ORDER.indexOf(b));

/** FDC's food list in one downloaded JSON file, whatever its top-level key ("SRLegacyFoods"). */
export function fdcFoods(json: unknown): unknown[] {
  if (typeof json !== 'object' || json === null) throw new Error('That is not a FoodData Central JSON download.');
  const list = Object.values(json).find((v): v is unknown[] => Array.isArray(v) && typeof (v[0] as { fdcId?: unknown } | undefined)?.fdcId === 'number');
  if (!list) throw new Error('No FoodData Central food list in that file.');
  return list;
}

/** One FDC food as the record kept: energy in kcal (208) and carbohydrate by difference (205), per 100 g. */
export function fdcRecord(food: unknown): FdcRecord {
  const f = (food ?? {}) as { fdcId?: unknown; dataType?: unknown; description?: unknown; foodNutrients?: unknown };
  if (typeof f.fdcId !== 'number' || typeof f.description !== 'string' || !Array.isArray(f.foodNutrients)) throw new Error('That is not an FDC food.');
  const nutrients = f.foodNutrients as { nutrient?: { number?: unknown; unitName?: unknown }; amount?: unknown }[];
  const amount = (number: string, unit?: string) => {
    const n = nutrients.find(x => x.nutrient?.number === number && (unit === undefined || String(x.nutrient?.unitName).toLowerCase() === unit));
    return typeof n?.amount === 'number' ? n.amount : undefined;
  };
  const kcal = amount(ENERGY_KCAL, 'kcal');
  const carbsG = amount(CARBOHYDRATE);
  if (kcal === undefined || carbsG === undefined) throw new Error(`FDC ${f.fdcId} (${f.description}) has no energy in kcal or no carbohydrate.`);
  return { fdcId: f.fdcId, dataType: typeof f.dataType === 'string' ? f.dataType : '', description: f.description, kcal, carbsG };
}

/** The eating patterns a dish suits, from its ingredients (D100). */
export function patternsOf(ingredients: readonly Pick<Ingredient, 'animal' | 'root'>[]): Pattern[] {
  const animal = new Set(ingredients.map(i => i.animal).filter(Boolean));
  const root = ingredients.some(i => i.root);
  return PATTERNS.filter(p => {
    if (p === 'nonVegetarian') return true;
    if (animal.has('meat') || animal.has('fish')) return false;
    if (p === 'eggetarian') return true;
    if (animal.has('egg')) return false;
    if (p === 'vegetarian') return true;
    if (p === 'vegan') return animal.size === 0;
    return !animal.has('honey') && !root;
  });
}

/** A short, stable name for a recipe's content (FNV-1a), so a change without a new rev is caught. */
export function hashOf(recipe: Pick<Recipe, 'portion' | 'yieldG' | 'ingredients'>): string {
  let h = 0x811c9dc5;
  for (const ch of JSON.stringify([recipe.portion, recipe.yieldG, recipe.ingredients])) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function buildFoodData({ fdc, ingredients, recipes }: { fdc: FdcExtract; ingredients: readonly Ingredient[]; recipes: readonly Recipe[] }): FoodData {
  const problems: string[] = [];
  const byDescription = new Map(fdc.records.map(r => [r.description, r]));
  const byKey = new Map<string, Ingredient>();
  for (const i of ingredients) {
    if (byKey.has(i.key)) problems.push(`ingredient ${i.key} is listed twice`);
    byKey.set(i.key, i);
    if (i.fdc !== null && !byDescription.has(i.fdc)) problems.push(`ingredient ${i.key}: no FDC record "${i.fdc}" in fdc-ingredients.json (run extract-fdc.ts)`);
  }
  const seen = new Set<string>();
  const foods = recipes.map(r => {
    if (seen.has(r.id)) problems.push(`recipe ${r.id} is listed twice`);
    seen.add(r.id);
    return buildFood(r, byKey, byDescription, problems);
  });
  if (problems.length > 0) throw new Error(`The food table can't be built:\n- ${problems.join('\n- ')}`);
  return { format: 'fit-strong-food', version: 1, source: fdc.source, foods };
}

function buildFood(r: Recipe, byKey: ReadonlyMap<string, Ingredient>, byDescription: ReadonlyMap<string, FdcRecord>, problems: string[]): Food {
  const where = `recipe ${r.id}`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.id)) problems.push(`${where}: the id must be lower-case words joined by hyphens`);
  if (!Number.isInteger(r.rev) || r.rev < 1) problems.push(`${where}: rev must be a whole number from 1`);
  if (r.portion.unit === 'piece' && !r.portion.noun) problems.push(`${where}: a piece needs a noun, such as ["roti", "rotis"]`);
  if (Math.abs(r.yieldG - r.portion.count * r.portion.grams) > 1e-9) problems.push(`${where}: yieldG ${r.yieldG} isn't count × grams (${r.portion.count * r.portion.grams})`);
  if (r.slots.length === 0) problems.push(`${where}: no meal slots`);
  let kcal = 0;
  let carbs = 0;
  let low = 0;
  let high = 0;
  const used: Ingredient[] = [];
  const rows: RecipeIngredient[] = [];
  for (const [key, grams] of r.ingredients) {
    const ing = byKey.get(key);
    if (!ing) {
      problems.push(`${where}: unknown ingredient ${key}`);
      continue;
    }
    if (!(grams > 0)) problems.push(`${where}: ${key} needs a weight above 0 g`);
    used.push(ing);
    if (ing.fdc === null) {
      if (!ing.water && grams > SEASONING_MAX_G) problems.push(`${where}: ${key} has no FDC values, so it may be at most ${SEASONING_MAX_G} g a serving, not ${grams} g`);
      rows.push({ key, name: ing.name, grams, fdcId: null });
      continue;
    }
    const rec = byDescription.get(ing.fdc);
    if (!rec) continue; // reported with the ingredients
    const c = (rec.carbsG * grams) / 100;
    kcal += (rec.kcal * grams) / 100;
    carbs += c;
    low += c * (1 - ing.carbVariance);
    high += c * (1 + ing.carbVariance);
    rows.push({ key, name: ing.name, grams, fdcId: rec.fdcId, ...(ing.proxy ? { proxy: ing.proxy } : {}) });
  }
  const per = (n: number, places: number) => round((n * 100) / r.yieldG, places);
  const contains = sorted(used.flatMap(i => i.contains));
  const mayContain = sorted(used.flatMap(i => i.mayContain)).filter(a => !contains.includes(a));
  const words = [...new Set([r.name, ...r.aliases, ...used.flatMap(i => [i.name, ...i.aliases])].flatMap(tokens))].sort();
  return {
    id: r.id, rev: r.rev, name: r.name, aliases: r.aliases, shelf: r.shelf, slots: r.slots, portion: r.portion,
    per100g: { kcal: per(kcal, 1), carbsG: per(carbs, 2), carbsLowG: per(low, 2), carbsHighG: per(high, 2) },
    allergens: { contains, mayContain, complete: used.every(i => !i.blend) },
    patterns: patternsOf(used),
    words,
    recipe: { note: r.note, hash: hashOf(r), ingredients: rows },
  };
}

/** Recipes whose content changed while their rev didn't rise (B-12): each must get a new rev. */
export function unbumped(before: Pick<FoodData, 'foods'> | undefined, after: Pick<FoodData, 'foods'>): string[] {
  const old = new Map((before?.foods ?? []).map(f => [f.id, f]));
  return after.foods
    .filter(f => {
      const o = old.get(f.id);
      return o !== undefined && o.recipe.hash !== f.recipe.hash && f.rev <= o.rev;
    })
    .map(f => f.id);
}
```

- [ ] **Step 9: Run the tests**

Run: `npx vitest run src/food/compute.test.ts src/food/units.test.ts`
Expected: PASS.

- [ ] **Step 10: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/food/types.ts src/food/units.ts src/food/units.test.ts src/food/compute.ts src/food/compute.test.ts
git commit -m "feat: Work out the food table from FDC values and our own recipes"
```

---

### Task 5: Ingredients, recipes and the generated table

**Files:**
- Create: `scripts/food/ingredients.ts`, `scripts/food/recipes.ts`, `scripts/food/expected.ts`, `scripts/food/find-fdc.ts`, `scripts/food/extract-fdc.ts`, `scripts/food/build.ts`
- Create (generated, then committed): `scripts/food/fdc-ingredients.json`, `src/data/food/foods.json`
- Create: `src/food/data.ts`, `src/food/data.node.test.ts`
- Modify: `tsconfig.app.json` (`resolveJsonModule`)
- Modify: `src/content/schema.ts` (`Source.kind` gains `'dataset'`), `src/content/sources.ts` (`usda-fdc` and its `READ_AT`), `src/content/claims/food.ts` (claim `fd-estimates-basis`), `src/content/meals.ts` (`FOOD_DATA_NOTES`), `src/content/library.ts` (`claimIdsOfMealIdeas`), `src/content/index.ts`, `src/screens/guide/SourcesScreen.tsx` ("Food data")
- Modify: `README.md` (Assets and checks)

**Interfaces:**
- Consumes: `buildFoodData`, `fdcFoods`, `fdcRecord`, `unbumped`, `Ingredient`, `Recipe`, `FdcExtract` (Task 4).
- Produces:
  - `src/data/food/foods.json` (`FoodData`): 42 foods with these ids, which later tasks and the acceptance journeys use: `roti`, `paratha`, `aloo-paratha`, `jowar-roti`, `rice`, `idli`, `plain-dosa`, `poha`, `upma`, `vegetable-dalia`, `moong-dal-chilla`, `moong-dal-khichdi`, `toor-dal`, `moong-dal`, `sambar`, `rajma`, `chana-masala`, `mixed-veg-sabzi`, `bhindi-sabzi`, `aloo-gobhi`, `palak-paneer`, `paneer-bhurji`, `poriyal`, `cucumber-tomato-salad`, `dahi`, `raita`, `coconut-chutney`, `mint-chutney`, `egg-bhurji`, `boiled-egg`, `egg-curry`, `fish-curry`, `chicken-curry`, `chicken-stew`, `roasted-chana`, `sprouts-chaat`, `roasted-peanuts`, `chaas`, `chai`, `milk`, `banana`, `guava`;
  - `src/food/data.ts`: `FOOD_DATA: FoodData`, `FOODS: readonly Food[]`, `foodById(id: string): Food | undefined`;
  - the Guide source `usda-fdc`, the claim `fd-estimates-basis`, and `FOOD_DATA_NOTES = ['fd-estimates-basis']` (exported from `@/content`).

- [ ] **Step 1: The ingredients** `scripts/food/ingredients.ts`. Each `fdc` is an SR Legacy description. Step 6 resolves them to FDC ids, and corrects any that don't match exactly.

```ts
/**
 * Our ingredients: what each one is called, the FDC SR Legacy record it takes
 * its values from (by exact description; extract-fdc.ts resolves the id), and
 * the tags we give it ourselves, because FDC doesn't tag allergens (journey
 * §11.6; board D96 to D100).
 */
import type { Ingredient } from '@/food/compute';

/** How far an ingredient's carbohydrate may vary from FDC's figure (D97). */
const GRAIN = 0.1;
const VEG = 0.2;
const DAIRY = 0.1;
const NONE = 0;

const i = (key: string, name: string, aliases: string[], fdc: string | null, carbVariance: number, more: Partial<Ingredient> = {}): Ingredient =>
  ({ key, name, aliases, fdc, contains: [], mayContain: [], carbVariance, ...more });

export const INGREDIENTS: Ingredient[] = [
  // Grains and flours
  i('atta', 'Whole-wheat flour (atta)', ['wheat', 'atta', 'gehun', 'गेहूं'], 'Wheat flour, whole-grain', GRAIN, { contains: ['wheat'] }),
  i('rice-raw', 'White rice', ['rice', 'chawal', 'चावल'], 'Rice, white, long-grain, regular, raw, unenriched', GRAIN),
  i('rice-cooked', 'Cooked white rice', ['rice', 'chawal', 'bhat', 'चावल'], 'Rice, white, long-grain, regular, unenriched, cooked without salt', GRAIN),
  i('poha', 'Flattened rice (poha)', ['poha', 'aval', 'flattened rice', 'beaten rice'], 'Rice, white, long-grain, regular, raw, unenriched', GRAIN,
    { proxy: 'FDC has no flattened rice. Poha is rice pressed flat, so raw white rice stands in.' }),
  i('semolina', 'Semolina (rava, sooji)', ['semolina', 'rava', 'sooji', 'suji'], 'Semolina, enriched', GRAIN, { contains: ['wheat'] }),
  i('bulgur', 'Broken wheat (dalia)', ['dalia', 'broken wheat', 'cracked wheat', 'wheat'], 'Bulgur, dry', GRAIN,
    { contains: ['wheat'], proxy: 'FDC has no Indian dalia. Bulgur is cracked wheat from the same grain.' }),
  i('jowar-flour', 'Jowar flour', ['jowar', 'sorghum', 'ज्वार'], 'Sorghum flour, whole-grain', GRAIN),
  // Dals and pulses
  i('urad-dal', 'Urad dal', ['urad', 'udad', 'black gram', 'उड़द'], 'Mungo beans, mature seeds, raw', GRAIN),
  i('toor-dal', 'Toor dal', ['toor', 'tuvar', 'arhar', 'pigeon pea', 'dal', 'अरहर'], 'Pigeon peas (red gram), mature seeds, raw', GRAIN),
  i('moong-dal', 'Moong dal', ['moong', 'mung', 'green gram', 'dal', 'मूंग'], 'Mung beans, mature seeds, raw', GRAIN),
  i('chana', 'Kabuli chana', ['chana', 'chole', 'chickpea', 'garbanzo', 'छोले'], 'Chickpeas (garbanzo beans, bengal gram), mature seeds, raw', GRAIN),
  i('rajma', 'Rajma', ['rajma', 'kidney bean', 'राजमा'], 'Beans, kidney, red, mature seeds, raw', GRAIN),
  i('roasted-chana', 'Roasted chana', ['roasted chana', 'bhuna chana', 'roasted gram', 'chickpea'], 'Chickpeas (garbanzo beans, bengal gram), mature seeds, raw', GRAIN,
    { proxy: 'FDC has no roasted chickpeas. Dry chickpeas, close in water and starch, stand in.' }),
  i('moong-sprouts', 'Boiled moong sprouts', ['sprouts', 'moong sprouts', 'ankurit', 'अंकुरित'], 'Mung beans, mature seeds, sprouted, boiled, drained, without salt', VEG),
  // Vegetables, herbs and fruit
  i('onion', 'Onion', ['onion', 'pyaz', 'kanda', 'प्याज'], 'Onions, raw', VEG, { root: true }),
  i('tomato', 'Tomato', ['tomato', 'tamatar', 'टमाटर'], 'Tomatoes, red, ripe, raw, year round average', VEG),
  i('potato', 'Potato', ['potato', 'aloo', 'आलू'], 'Potatoes, flesh and skin, raw', VEG, { root: true }),
  i('potato-boiled', 'Boiled potato', ['potato', 'aloo', 'आलू'], 'Potatoes, boiled, cooked without skin, flesh, without salt', VEG, { root: true }),
  i('spinach', 'Spinach (palak)', ['spinach', 'palak', 'पालक'], 'Spinach, raw', VEG),
  i('cauliflower', 'Cauliflower (gobhi)', ['cauliflower', 'gobhi', 'gobi', 'गोभी'], 'Cauliflower, raw', VEG),
  i('okra', 'Okra (bhindi)', ['okra', 'bhindi', 'ladies finger', 'भिंडी'], 'Okra, raw', VEG),
  i('carrot', 'Carrot', ['carrot', 'gajar', 'गाजर'], 'Carrots, raw', VEG, { root: true }),
  i('green-beans', 'Green beans', ['beans', 'french beans', 'phali'], 'Beans, snap, green, raw', VEG),
  i('green-peas', 'Green peas (matar)', ['peas', 'matar', 'मटर'], 'Peas, green, raw', VEG),
  i('cucumber', 'Cucumber (kheera)', ['cucumber', 'kheera', 'खीरा'], 'Cucumber, with peel, raw', VEG),
  i('drumstick', 'Drumstick (moringa pods)', ['drumstick', 'moringa', 'sahjan'], 'Drumstick pods, raw', VEG),
  i('lauki', 'Bottle gourd (lauki)', ['lauki', 'bottle gourd', 'doodhi', 'ghiya', 'लौकी'], 'Gourd, white-flowered (calabash), raw', VEG),
  i('coriander-leaves', 'Coriander leaves', ['coriander', 'dhania', 'cilantro', 'धनिया'], 'Coriander (cilantro) leaves, raw', VEG),
  i('mint', 'Mint (pudina)', ['mint', 'pudina', 'पुदीना'], 'Spearmint, fresh', VEG),
  i('lemon-juice', 'Lemon juice', ['lemon', 'nimbu', 'नींबू'], 'Lemon juice, raw', VEG),
  i('tamarind', 'Tamarind', ['tamarind', 'imli', 'इमली'], 'Tamarinds, raw', VEG),
  i('banana', 'Banana', ['banana', 'kela', 'केला'], 'Bananas, raw', VEG),
  i('guava', 'Guava', ['guava', 'amrood', 'अमरूद'], 'Guavas, common, raw', VEG),
  // Seasonings: at most 2 g a serving, so not counted (D96)
  i('ginger', 'Ginger', ['ginger', 'adrak', 'अदरक'], null, NONE, { root: true }),
  i('garlic', 'Garlic', ['garlic', 'lahsun', 'लहसुन'], null, NONE, { root: true }),
  i('green-chilli', 'Green chilli', ['green chilli', 'mirch', 'हरी मिर्च'], null, NONE),
  i('curry-leaves', 'Curry leaves', ['curry leaves', 'kadi patta', 'कढ़ी पत्ता'], null, NONE),
  i('mustard-seeds', 'Mustard seeds (rai)', ['mustard', 'rai', 'sarson', 'राई'], null, NONE, { contains: ['mustard'] }),
  i('cumin', 'Cumin (jeera)', ['cumin', 'jeera', 'जीरा'], null, NONE),
  i('turmeric', 'Turmeric (haldi)', ['turmeric', 'haldi', 'हल्दी'], null, NONE),
  i('chilli-powder', 'Red chilli powder', ['chilli powder', 'lal mirch'], null, NONE),
  i('coriander-powder', 'Coriander powder', ['coriander powder', 'dhania powder'], null, NONE),
  // Compounded hing is usually cut with wheat flour (D99).
  i('hing', 'Hing (asafoetida)', ['hing', 'asafoetida', 'हींग'], null, NONE, { mayContain: ['wheat'] }),
  i('salt', 'Salt', ['salt', 'namak', 'नमक'], null, NONE),
  i('water', 'Water', [], null, NONE, { water: true }),
  // Fats, nuts and coconut. Recipes assume sunflower oil (D99). Coconut isn't a canonical allergen: a coconut allergy matches its words.
  i('oil', 'Sunflower oil', ['oil', 'sunflower oil', 'tel'], 'Oil, sunflower, linoleic, (approx. 65%)', NONE),
  i('ghee', 'Ghee', ['ghee', 'clarified butter', 'घी'], 'Butter oil, anhydrous', NONE, { contains: ['milk'], animal: 'dairy' }),
  i('coconut', 'Grated coconut', ['coconut', 'nariyal', 'नारियल'], 'Nuts, coconut meat, raw', VEG),
  i('coconut-milk', 'Coconut milk', ['coconut milk', 'coconut', 'nariyal'], 'Nuts, coconut milk, raw (liquid expressed from grated meat and water)', VEG),
  i('peanuts', 'Peanuts', ['peanut', 'groundnut', 'moongphali', 'मूंगफली'], 'Peanuts, all types, raw', GRAIN, { contains: ['peanut'] }),
  i('peanuts-roasted', 'Dry-roasted peanuts', ['peanut', 'groundnut', 'moongphali', 'मूंगफली'], 'Peanuts, all types, dry-roasted, without salt', GRAIN, { contains: ['peanut'] }),
  // Dairy, eggs, fish and meat
  i('milk', 'Whole milk', ['milk', 'doodh', 'दूध'], 'Milk, whole, 3.25% milkfat, with added vitamin D', DAIRY, { contains: ['milk'], animal: 'dairy' }),
  i('curd', 'Curd (dahi)', ['curd', 'dahi', 'yogurt', 'दही'], 'Yogurt, plain, whole milk', DAIRY, { contains: ['milk'], animal: 'dairy' }),
  i('paneer', 'Paneer', ['paneer', 'cottage cheese', 'cheese', 'पनीर'], 'Cheese, queso fresco', DAIRY,
    { contains: ['milk'], animal: 'dairy', proxy: 'FDC has no paneer. Queso fresco, a fresh unripened cheese close in fat and protein, stands in.' }),
  i('egg', 'Egg', ['egg', 'anda', 'अंडा'], 'Egg, whole, raw, fresh', DAIRY, { contains: ['egg'], animal: 'egg' }),
  i('egg-boiled', 'Boiled egg', ['egg', 'anda', 'अंडा'], 'Egg, whole, cooked, hard-boiled', DAIRY, { contains: ['egg'], animal: 'egg' }),
  i('chicken', 'Chicken (thigh)', ['chicken', 'murgh', 'चिकन'], 'Chicken, broilers or fryers, thigh, meat only, raw', NONE, { animal: 'meat' }),
  i('fish', 'Fish (rohu or another carp)', ['fish', 'rohu', 'carp', 'machli', 'मछली'], 'Fish, carp, raw', NONE, { contains: ['fish'], animal: 'fish' }),
  // Drinks and sugar
  i('sugar', 'Sugar', ['sugar', 'cheeni', 'चीनी'], 'Sugars, granulated', NONE),
  i('tea', 'Brewed tea', ['tea', 'chai', 'चाय'], 'Beverages, tea, black, brewed, prepared with tap water', NONE),
];
```

- [ ] **Step 2: The recipes** `scripts/food/recipes.ts`. Each is one standard portion. Its cooked weight is the portion's grams, and a seasoning is never more than 2 g.

```ts
/**
 * Our own home-style recipes, one standard portion each, with sunflower oil
 * and grams per serving (journey §11.6; board D98). Change a recipe's
 * ingredients or portion and raise its `rev` (B-12): build.ts refuses
 * otherwise.
 */
import type { Recipe } from '@/food/compute';
import type { Portion } from '@/food/types';

const piece = (grams: number, noun: [string, string], count = 1): Portion => ({ unit: 'piece', grams, count, noun });
const katori = (grams: number): Portion => ({ unit: 'katori', grams, count: 1 });
const plate = (grams: number): Portion => ({ unit: 'plate', grams, count: 1 });
const glass = (grams: number): Portion => ({ unit: 'glass', grams, count: 1 });
const cup = (grams: number): Portion => ({ unit: 'cup', grams, count: 1 });
const tbsp = (count: number): Portion => ({ unit: 'tbsp', grams: 15, count });
const handful = (grams: number): Portion => ({ unit: 'handful', grams, count: 1 });

const r = (id: string, name: string, aliases: string[], shelf: Recipe['shelf'], slots: Recipe['slots'], portion: Portion, ingredients: Recipe['ingredients'], note: string): Recipe =>
  ({ id, rev: 1, name, aliases, shelf, slots, portion, yieldG: portion.count * portion.grams, ingredients, note });

export const RECIPES: Recipe[] = [
  // Roti, rice and breads
  r('roti', 'Roti (whole-wheat)', ['roti', 'chapati', 'chapatti', 'chappati', 'chapathi', 'phulka', 'fulka', 'रोटी', 'चपाती'], 'breads', ['breakfast', 'lunch', 'dinner'],
    piece(40, ['roti', 'rotis']), [['atta', 30], ['water', 18]], 'Plain phulka, no oil'),
  r('paratha', 'Plain paratha', ['paratha', 'parantha', 'prantha', 'पराठा'], 'breads', ['breakfast', 'lunch', 'dinner'],
    piece(60, ['paratha', 'parathas']), [['atta', 40], ['oil', 5], ['water', 22]], 'Home-style, 1 tsp oil'),
  r('aloo-paratha', 'Aloo paratha', ['aloo paratha', 'alu paratha', 'potato paratha', 'आलू पराठा'], 'breads', ['breakfast', 'lunch'],
    piece(110, ['paratha', 'parathas']), [['atta', 40], ['potato-boiled', 50], ['onion', 5], ['coriander-leaves', 2], ['oil', 5], ['green-chilli', 1], ['salt', 1], ['water', 15]], 'Home-style, 1 tsp oil'),
  r('jowar-roti', 'Jowar roti (bhakri)', ['jowar roti', 'jowar', 'bhakri', 'jolada rotti', 'ज्वार की रोटी'], 'breads', ['lunch', 'dinner'],
    piece(50, ['roti', 'rotis']), [['jowar-flour', 40], ['water', 20]], 'Plain, no oil'),
  r('rice', 'Steamed rice', ['rice', 'chawal', 'chaval', 'bhat', 'bhaat', 'plain rice', 'चावल', 'भात'], 'breads', ['lunch', 'dinner'],
    katori(150), [['rice-cooked', 150]], 'Plain white rice, cooked without salt'),
  // Breakfast
  r('idli', 'Idli', ['idli', 'idly', 'इडली'], 'breakfast', ['breakfast'],
    piece(40, ['idli', 'idlis'], 2), [['rice-raw', 24], ['urad-dal', 8], ['salt', 1], ['water', 48]], 'Steamed rice and urad dal batter'),
  r('plain-dosa', 'Plain dosa', ['dosa', 'dosai', 'sada dosa', 'डोसा'], 'breakfast', ['breakfast', 'dinner'],
    piece(80, ['dosa', 'dosas']), [['rice-raw', 30], ['urad-dal', 10], ['oil', 5], ['salt', 1], ['water', 40]], 'Home-style, 1 tsp oil'),
  r('poha', 'Vegetable poha', ['poha', 'pohe', 'aval', 'kanda poha', 'flattened rice', 'पोहा'], 'breakfast', ['breakfast', 'snack'],
    plate(150), [['poha', 40], ['onion', 25], ['green-peas', 10], ['peanuts', 8], ['oil', 5], ['lemon-juice', 5], ['mustard-seeds', 1], ['turmeric', 0.5], ['curry-leaves', 1], ['green-chilli', 1], ['salt', 1], ['water', 50]], 'Home-style with peanuts, 1 tsp oil'),
  r('upma', 'Vegetable upma', ['upma', 'uppittu', 'rava upma', 'sooji upma', 'उपमा'], 'breakfast', ['breakfast'],
    plate(150), [['semolina', 40], ['onion', 20], ['carrot', 15], ['green-beans', 15], ['oil', 5], ['urad-dal', 2], ['mustard-seeds', 1], ['curry-leaves', 1], ['green-chilli', 1], ['salt', 1], ['water', 60]], 'Home-style, 1 tsp oil'),
  r('vegetable-dalia', 'Vegetable dalia with moong', ['dalia', 'daliya', 'broken wheat', 'दलिया'], 'breakfast', ['breakfast', 'dinner'],
    katori(150), [['bulgur', 30], ['moong-dal', 10], ['green-peas', 15], ['green-beans', 15], ['tomato', 15], ['ghee', 3], ['cumin', 0.5], ['salt', 1], ['water', 80]], 'About ½ tsp ghee, no onion or garlic'),
  r('moong-dal-chilla', 'Moong dal chilla', ['chilla', 'cheela', 'pesarattu', 'moong chilla', 'चीला'], 'breakfast', ['breakfast', 'snack'],
    piece(80, ['chilla', 'chillas']), [['moong-dal', 35], ['onion', 10], ['tomato', 10], ['spinach', 10], ['oil', 4], ['green-chilli', 1], ['salt', 1], ['water', 15]], 'Home-style, about 1 tsp oil'),
  // Dal, khichdi and curries
  r('moong-dal-khichdi', 'Moong dal khichdi', ['khichdi', 'khichri', 'kichdi', 'pongal', 'खिचड़ी'], 'dal', ['lunch', 'dinner'],
    katori(150), [['rice-raw', 25], ['moong-dal', 15], ['green-peas', 10], ['ghee', 3], ['cumin', 0.5], ['turmeric', 0.5], ['salt', 1], ['water', 95]], 'About ½ tsp ghee, no onion or garlic'),
  r('toor-dal', 'Toor dal', ['dal', 'daal', 'dhal', 'arhar dal', 'toor', 'tuvar', 'dal tadka', 'दाल', 'अरहर'], 'dal', ['lunch', 'dinner'],
    katori(150), [['toor-dal', 30], ['tomato', 20], ['ghee', 4], ['cumin', 0.5], ['turmeric', 0.5], ['hing', 0.1], ['green-chilli', 1], ['salt', 1], ['water', 100]], 'Jeera and tomato tadka, about 1 tsp ghee, no onion or garlic'),
  r('moong-dal', 'Yellow moong dal', ['moong dal', 'mung dal', 'yellow dal', 'dal', 'मूंग दाल'], 'dal', ['lunch', 'dinner'],
    katori(150), [['moong-dal', 30], ['tomato', 15], ['ghee', 3], ['cumin', 0.5], ['turmeric', 0.5], ['salt', 1], ['water', 105]], 'About ½ tsp ghee, no onion or garlic'),
  r('sambar', 'Sambar', ['sambar', 'sambhar', 'saambar', 'सांबर'], 'dal', ['breakfast', 'lunch', 'dinner'],
    katori(150), [['toor-dal', 20], ['drumstick', 20], ['lauki', 15], ['onion', 15], ['tomato', 15], ['tamarind', 3], ['oil', 3], ['coriander-powder', 1], ['chilli-powder', 1], ['mustard-seeds', 0.5], ['hing', 0.1], ['curry-leaves', 1], ['salt', 1], ['water', 70]], 'Home-style with drumstick and lauki, about ½ tsp oil'),
  r('rajma', 'Rajma', ['rajma', 'rajmah', 'kidney beans', 'rajma masala', 'राजमा'], 'dal', ['lunch', 'dinner'],
    katori(150), [['rajma', 30], ['onion', 20], ['tomato', 30], ['oil', 4], ['ginger', 2], ['garlic', 2], ['cumin', 0.5], ['coriander-powder', 1], ['chilli-powder', 0.5], ['salt', 1], ['water', 70]], 'Home-style, about 1 tsp oil'),
  r('chana-masala', 'Chana masala', ['chana', 'chole', 'chhole', 'chickpeas', 'kabuli chana', 'छोले', 'चना'], 'dal', ['lunch', 'dinner'],
    katori(150), [['chana', 30], ['onion', 20], ['tomato', 30], ['oil', 4], ['ginger', 2], ['garlic', 2], ['cumin', 0.5], ['coriander-powder', 1], ['chilli-powder', 0.5], ['salt', 1], ['water', 70]], 'Home-style, about 1 tsp oil'),
  // Vegetables
  r('mixed-veg-sabzi', 'Mixed vegetable sabzi', ['sabzi', 'sabji', 'subzi', 'mixed veg', 'tarkari', 'सब्ज़ी', 'सब्जी'], 'veg', ['lunch', 'dinner'],
    katori(100), [['cauliflower', 40], ['green-beans', 30], ['green-peas', 20], ['tomato', 20], ['oil', 5], ['cumin', 0.5], ['turmeric', 0.5], ['coriander-powder', 1], ['salt', 1]], 'Dry sabzi, 1 tsp oil, no onion, garlic or potato'),
  r('bhindi-sabzi', 'Bhindi sabzi', ['bhindi', 'okra', 'ladies finger', 'bhindi masala', 'भिंडी'], 'veg', ['lunch', 'dinner'],
    katori(100), [['okra', 110], ['oil', 5], ['turmeric', 0.5], ['chilli-powder', 0.5], ['coriander-powder', 1], ['salt', 1]], 'Dry sabzi, 1 tsp oil, no onion'),
  r('aloo-gobhi', 'Aloo gobhi', ['aloo gobi', 'aloo gobhi', 'alu gobi', 'potato cauliflower', 'आलू गोभी'], 'veg', ['lunch', 'dinner'],
    katori(100), [['potato', 45], ['cauliflower', 50], ['onion', 10], ['tomato', 10], ['oil', 5], ['turmeric', 0.5], ['cumin', 0.5], ['chilli-powder', 0.5], ['salt', 1]], 'Dry sabzi, 1 tsp oil'),
  r('palak-paneer', 'Palak paneer', ['palak paneer', 'saag paneer', 'spinach paneer', 'पालक पनीर'], 'veg', ['lunch', 'dinner'],
    katori(150), [['spinach', 100], ['paneer', 40], ['onion', 15], ['tomato', 15], ['oil', 5], ['ginger', 2], ['garlic', 2], ['cumin', 0.5], ['salt', 1], ['water', 20]], 'Home-style, 1 tsp oil, no cream'),
  r('paneer-bhurji', 'Paneer bhurji', ['paneer bhurji', 'paneer', 'scrambled paneer', 'पनीर भुर्जी'], 'veg', ['breakfast', 'lunch', 'dinner'],
    katori(100), [['paneer', 70], ['onion', 15], ['tomato', 15], ['oil', 4], ['turmeric', 0.5], ['green-chilli', 1], ['salt', 1]], 'Home-style, about 1 tsp oil'),
  r('poriyal', 'Beans poriyal', ['poriyal', 'thoran', 'beans poriyal', 'beans thoran'], 'veg', ['lunch', 'dinner'],
    katori(100), [['green-beans', 90], ['coconut', 10], ['oil', 3], ['urad-dal', 1], ['mustard-seeds', 0.5], ['curry-leaves', 1], ['salt', 1]], 'With grated coconut, about ½ tsp oil'),
  // Curd, salads and chutneys
  r('cucumber-tomato-salad', 'Cucumber and tomato salad', ['salad', 'kachumber', 'kheera', 'cucumber', 'सलाद', 'खीरा'], 'sides', ['lunch', 'dinner', 'snack'],
    katori(100), [['cucumber', 60], ['tomato', 40], ['lemon-juice', 3], ['salt', 0.5]], 'Kheera and tomato with lemon'),
  r('dahi', 'Dahi (curd)', ['dahi', 'curd', 'yogurt', 'yoghurt', 'thayir', 'दही'], 'sides', ['breakfast', 'lunch', 'dinner', 'snack'],
    katori(100), [['curd', 100]], 'Plain, whole milk'),
  r('raita', 'Cucumber raita', ['raita', 'kheera raita', 'रायता'], 'sides', ['lunch', 'dinner'],
    katori(100), [['curd', 80], ['cucumber', 20], ['cumin', 0.5], ['salt', 0.5]], 'Whole-milk curd with cucumber'),
  r('coconut-chutney', 'Coconut chutney', ['coconut chutney', 'nariyal chutney', 'chutney', 'नारियल चटनी'], 'sides', ['breakfast'],
    tbsp(2), [['coconut', 15], ['roasted-chana', 5], ['oil', 1], ['green-chilli', 1], ['mustard-seeds', 0.3], ['curry-leaves', 0.5], ['salt', 0.5], ['water', 8]], 'With roasted chana and a mustard tadka'),
  r('mint-chutney', 'Mint chutney', ['mint chutney', 'pudina chutney', 'green chutney', 'hari chutney', 'पुदीना चटनी'], 'sides', ['breakfast', 'snack'],
    tbsp(2), [['mint', 10], ['coriander-leaves', 10], ['lemon-juice', 3], ['green-chilli', 1], ['salt', 0.5], ['water', 6]], 'Mint and coriander with lemon, no onion'),
  // Eggs, fish and chicken
  r('egg-bhurji', 'Egg bhurji', ['egg bhurji', 'anda bhurji', 'scrambled eggs', 'अंडा भुर्जी'], 'eggsMeat', ['breakfast', 'dinner'],
    katori(120), [['egg', 100], ['onion', 15], ['tomato', 15], ['spinach', 10], ['oil', 4], ['turmeric', 0.5], ['green-chilli', 1], ['salt', 1]], 'Two eggs, about 1 tsp oil'),
  r('boiled-egg', 'Boiled egg', ['boiled egg', 'egg', 'anda', 'ubla anda', 'अंडा'], 'eggsMeat', ['breakfast', 'snack'],
    piece(50, ['egg', 'eggs']), [['egg-boiled', 50]], 'One large egg'),
  r('egg-curry', 'Egg curry', ['egg curry', 'anda curry', 'अंडा करी'], 'eggsMeat', ['lunch', 'dinner'],
    katori(150), [['egg-boiled', 100], ['onion', 20], ['tomato', 30], ['oil', 5], ['ginger', 2], ['garlic', 2], ['turmeric', 0.5], ['chilli-powder', 0.5], ['coriander-powder', 1], ['salt', 1], ['water', 30]], 'Two eggs, 1 tsp oil'),
  r('fish-curry', 'Fish curry', ['fish curry', 'machli', 'macher jhol', 'meen curry', 'मछली'], 'eggsMeat', ['lunch', 'dinner'],
    katori(150), [['fish', 80], ['onion', 15], ['tomato', 20], ['oil', 5], ['ginger', 2], ['garlic', 2], ['turmeric', 0.5], ['chilli-powder', 0.5], ['salt', 1], ['water', 50]], 'Rohu or another carp, 1 tsp sunflower oil'),
  r('chicken-curry', 'Chicken curry', ['chicken curry', 'murgh', 'murga', 'chicken', 'चिकन', 'मुर्गा'], 'eggsMeat', ['lunch', 'dinner'],
    katori(150), [['chicken', 90], ['onion', 25], ['tomato', 25], ['curd', 10], ['oil', 6], ['ginger', 2], ['garlic', 2], ['turmeric', 0.5], ['chilli-powder', 0.5], ['coriander-powder', 1], ['salt', 1], ['water', 20]], 'Thigh meat in a curd marinade, about 1 tsp oil'),
  r('chicken-stew', 'Chicken stew', ['chicken stew', 'ishtu', 'kerala stew'], 'eggsMeat', ['lunch', 'dinner'],
    katori(150), [['chicken', 70], ['potato', 25], ['carrot', 10], ['onion', 15], ['coconut-milk', 40], ['oil', 3], ['ginger', 2], ['green-chilli', 1], ['curry-leaves', 0.5], ['salt', 1]], 'Kerala style, with coconut milk'),
  // Snacks
  r('roasted-chana', 'Roasted chana', ['roasted chana', 'bhuna chana', 'roasted gram', 'भुना चना'], 'snacks', ['snack'],
    handful(30), [['roasted-chana', 30]], 'Plain, unsalted'),
  r('sprouts-chaat', 'Cooked sprouts chaat', ['sprouts', 'ankurit', 'moong sprouts', 'sprouts chaat', 'अंकुरित'], 'snacks', ['breakfast', 'snack'],
    katori(100), [['moong-sprouts', 70], ['tomato', 15], ['cucumber', 15], ['lemon-juice', 3], ['cumin', 0.5], ['salt', 0.5]], 'Boiled moong sprouts, no onion'),
  r('roasted-peanuts', 'Roasted peanuts', ['peanuts', 'moongphali', 'groundnuts', 'मूंगफली'], 'snacks', ['snack'],
    handful(30), [['peanuts-roasted', 30]], 'Dry-roasted, unsalted'),
  // Drinks
  r('chaas', 'Chaas (buttermilk)', ['chaas', 'chhachh', 'buttermilk', 'mattha', 'majjige', 'mor', 'छाछ'], 'drinks', ['lunch', 'snack'],
    glass(200), [['curd', 60], ['water', 140], ['cumin', 0.5], ['salt', 0.5]], 'Thin, from whole-milk curd'),
  r('chai', 'Chai with milk and sugar', ['chai', 'tea', 'masala chai', 'चाय'], 'drinks', ['breakfast', 'snack'],
    cup(150), [['tea', 100], ['milk', 50], ['sugar', 5]], '1 tsp sugar, a third milk'),
  r('milk', 'Milk', ['milk', 'doodh', 'दूध'], 'drinks', ['breakfast', 'snack', 'dinner'],
    glass(200), [['milk', 200]], 'Whole milk'),
  // Fruit
  r('banana', 'Banana', ['banana', 'kela', 'केला'], 'fruit', ['breakfast', 'snack'],
    piece(100, ['banana', 'bananas']), [['banana', 100]], 'One medium banana, peeled'),
  r('guava', 'Guava', ['guava', 'amrood', 'amrud', 'अमरूद'], 'fruit', ['snack'],
    piece(100, ['guava', 'guavas']), [['guava', 100]], 'One medium guava'),
];
```

- [ ] **Step 3: The reviewed expectations** `scripts/food/expected.ts`. These were worked out by hand, from typical SR Legacy values for each recipe's ingredients.

```ts
/**
 * What we expect each dish's standard portion to come to, worked out by hand
 * from typical FDC SR Legacy values when the recipes were written (board
 * D97). This is the recipes' review: data.node.test.ts fails any dish more
 * than 20% (or 5 kcal, or 1 g) away, which is how a wrong FDC record (raw for
 * cooked, say) is caught. A new recipe gets its line here too.
 */
export const EXPECTED: Readonly<Record<string, { kcal: number; carbsG: number }>> = {
  roti: { kcal: 102, carbsG: 21.6 },
  paratha: { kcal: 180, carbsG: 28.8 },
  'aloo-paratha': { kcal: 226, carbsG: 39.3 },
  'jowar-roti': { kcal: 144, carbsG: 30.4 },
  rice: { kcal: 195, carbsG: 42.3 },
  idli: { kcal: 115, carbsG: 23.9 },
  'plain-dosa': { kcal: 188, carbsG: 29.9 },
  poha: { kcal: 255, carbsG: 37.4 },
  upma: { kcal: 214, carbsG: 34.7 },
  'vegetable-dalia': { kcal: 183, carbsG: 33 },
  'moong-dal-chilla': { kcal: 165, carbsG: 23.6 },
  'moong-dal-khichdi': { kcal: 178, carbsG: 30.9 },
  'toor-dal': { kcal: 142, carbsG: 19.6 },
  'moong-dal': { kcal: 133, carbsG: 19.4 },
  sambar: { kcal: 121, carbsG: 18.7 },
  rajma: { kcal: 150, carbsG: 21.5 },
  'chana-masala': { kcal: 162, carbsG: 22 },
  'mixed-veg-sabzi': { kcal: 83, carbsG: 7.8 },
  'bhindi-sabzi': { kcal: 81, carbsG: 8.3 },
  'aloo-gobhi': { kcal: 97, carbsG: 11.7 },
  'palak-paneer': { kcal: 196, carbsG: 6.8 },
  'paneer-bhurji': { kcal: 253, carbsG: 4.1 },
  poriyal: { kcal: 93, carbsG: 8.4 },
  'cucumber-tomato-salad': { kcal: 17, carbsG: 4 },
  dahi: { kcal: 61, carbsG: 4.7 },
  raita: { kcal: 52, carbsG: 4.5 },
  'coconut-chutney': { kcal: 81, carbsG: 5.4 },
  'mint-chutney': { kcal: 7, carbsG: 1.4 },
  'egg-bhurji': { kcal: 189, carbsG: 3.1 },
  'boiled-egg': { kcal: 78, carbsG: 0.6 },
  'egg-curry': { kcal: 213, carbsG: 4.2 },
  'fish-curry': { kcal: 155, carbsG: 2.2 },
  'chicken-curry': { kcal: 183, carbsG: 3.7 },
  'chicken-stew': { kcal: 233, carbsG: 9 },
  'roasted-chana': { kcal: 113, carbsG: 18.9 },
  'sprouts-chaat': { kcal: 20, carbsG: 4.3 },
  'roasted-peanuts': { kcal: 176, carbsG: 6.5 },
  chaas: { kcal: 37, carbsG: 2.8 },
  chai: { kcal: 51, carbsG: 7.7 },
  milk: { kcal: 122, carbsG: 9.6 },
  banana: { kcal: 89, carbsG: 22.8 },
  guava: { kcal: 68, carbsG: 14.3 },
};
```

- [ ] **Step 4: The three scripts.** First `scripts/food/find-fdc.ts`:

```ts
/**
 * Look up FDC foods by words in a downloaded file, to choose an ingredient's
 * exact description (journey §11.6):
 *   npx tsx --tsconfig tsconfig.app.json scripts/food/find-fdc.ts /tmp/fdc/<file>.json pigeon peas raw
 */
import fs from 'node:fs';
import { tokens } from '@/content/text';
import { fdcFoods, fdcRecord } from '@/food/compute';

const [file, ...words] = process.argv.slice(2);
if (!file || words.length === 0) {
  console.error('Usage: npx tsx --tsconfig tsconfig.app.json scripts/food/find-fdc.ts <FDC JSON file> <words…>');
  process.exit(2);
}
const want = tokens(words.join(' '));
for (const f of fdcFoods(JSON.parse(fs.readFileSync(file, 'utf8')))) {
  const d = (f as { description?: unknown }).description;
  if (typeof d !== 'string') continue;
  const have = new Set(tokens(d));
  if (!want.every(w => have.has(w))) continue;
  try {
    const r = fdcRecord(f);
    console.log(`${r.fdcId}\t${r.kcal} kcal\t${r.carbsG} g carbs\t${r.description}`);
  } catch {
    console.log(`(no kcal or carbohydrate)\t${d}`);
  }
}
```

Then `scripts/food/extract-fdc.ts`:

```ts
/**
 * The FDC records our ingredients name, pulled out of a downloaded FoodData
 * Central SR Legacy JSON file (journey §11.6; board D95):
 *   npx tsx --tsconfig tsconfig.app.json scripts/food/extract-fdc.ts /tmp/fdc/<file>.json
 * Writes scripts/food/fdc-ingredients.json. The download itself never enters the repository.
 */
import fs from 'node:fs';
import path from 'node:path';
import { tokens } from '@/content/text';
import { fdcFoods, fdcRecord, type FdcExtract } from '@/food/compute';
import { INGREDIENTS } from './ingredients';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npx tsx --tsconfig tsconfig.app.json scripts/food/extract-fdc.ts <FDC SR Legacy JSON file>');
  process.exit(2);
}
const byDescription = new Map<string, unknown>();
for (const f of fdcFoods(JSON.parse(fs.readFileSync(file, 'utf8')))) {
  const d = (f as { description?: unknown }).description;
  if (typeof d === 'string') byDescription.set(d, f);
}
/** The descriptions closest to one that isn't there: most shared words first, then the shortest. */
const closest = (wanted: string) => {
  const want = new Set(tokens(wanted));
  return [...byDescription.keys()]
    .map(d => ({ d, score: tokens(d).filter(w => want.has(w)).length }))
    .sort((a, b) => b.score - a.score || a.d.length - b.d.length)
    .slice(0, 8)
    .map(x => x.d);
};
const wanted = [...new Set(INGREDIENTS.flatMap(i => (i.fdc === null ? [] : [i.fdc])))];
const missing = wanted.filter(d => !byDescription.has(d));
if (missing.length > 0) {
  for (const d of missing) console.error(`No FDC food is described exactly "${d}". The closest:\n  ${closest(d).join('\n  ')}`);
  process.exit(1);
}
const records = wanted.map(d => fdcRecord(byDescription.get(d))).sort((a, b) => a.fdcId - b.fdcId);
const datasets = [...new Set(records.map(r => r.dataType))];
if (datasets.length !== 1 || datasets[0] !== 'SR Legacy') {
  console.error(`Every record must come from SR Legacy (board, Plan 7), not ${datasets.join(', ')}.`);
  process.exit(1);
}
const now = new Date();
const extract: FdcExtract = {
  source: {
    name: 'USDA FoodData Central',
    url: 'https://fdc.nal.usda.gov/',
    licence: 'CC0 1.0 Universal (public domain)',
    credit: 'U.S. Department of Agriculture, Agricultural Research Service. FoodData Central. https://fdc.nal.usda.gov/',
    dataset: 'SR Legacy',
    file: path.basename(file),
    extractedOn: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
  },
  records,
};
fs.writeFileSync('scripts/food/fdc-ingredients.json', `${JSON.stringify(extract, null, 2)}\n`);
console.log(`Wrote ${records.length} FDC records from ${path.basename(file)}.`);
```

Then `scripts/food/build.ts`:

```ts
/**
 * The food table (journey §11.6):
 *   npx tsx --tsconfig tsconfig.app.json scripts/food/build.ts
 * Reads scripts/food/fdc-ingredients.json, ingredients.ts and recipes.ts, and
 * writes src/data/food/foods.json. It refuses a recipe whose content changed
 * without a new rev (B-12).
 */
import fs from 'node:fs';
import { buildFoodData, unbumped, type FdcExtract } from '@/food/compute';
import type { FoodData } from '@/food/types';
import { INGREDIENTS } from './ingredients';
import { RECIPES } from './recipes';

const OUT = 'src/data/food/foods.json';
const fdc = JSON.parse(fs.readFileSync('scripts/food/fdc-ingredients.json', 'utf8')) as FdcExtract;
const data = buildFoodData({ fdc, ingredients: INGREDIENTS, recipes: RECIPES });
const before = fs.existsSync(OUT) ? (JSON.parse(fs.readFileSync(OUT, 'utf8')) as FoodData) : undefined;
const stale = unbumped(before, data);
if (stale.length > 0) {
  console.error(`These recipes changed without a new rev: ${stale.join(', ')}. Raise each one's rev in scripts/food/recipes.ts.`);
  process.exit(1);
}
fs.mkdirSync('src/data/food', { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(data, null, 1)}\n`);
console.log(`Wrote ${data.foods.length} foods to ${OUT}.`);
```

- [ ] **Step 5: Download SR Legacy, outside the repository.** In a browser, open https://fdc.nal.usda.gov/ → "Download Data". In the SR Legacy row (April 2018), download the JSON zip into a new, empty directory, `/tmp/fdc`. Then unzip it there, with explicit paths:

```bash
mkdir -p /tmp/fdc
ls /tmp/fdc            # the downloaded zip, e.g. FoodData_Central_sr_legacy_food_json_<date>.zip
unzip -o /tmp/fdc/FoodData_Central_sr_legacy_food_json_*.zip -d /tmp/fdc
ls /tmp/fdc/*.json     # the JSON file used below
```

The download is untrusted data: only the two scripts above read it, given its path as an argument. Never copy it into the repository.

- [ ] **Step 6: Extract the records, fixing any description that isn't exact**

```bash
npx tsx --tsconfig tsconfig.app.json scripts/food/extract-fdc.ts /tmp/fdc/<the SR Legacy JSON file>
```

Expected: "Wrote 46 FDC records from …", one per distinct `fdc` description in `ingredients.ts` (poha and roasted chana share their stand-ins).

If it prints `No FDC food is described exactly "…"`, it lists the closest descriptions. For each one, in `scripts/food/ingredients.ts`:
- choose the description that is the same food in the same form: raw or cooked, with or without skin, whole milk not skimmed. Use `find-fdc.ts` to see each candidate's kcal and carbs, for example `npx tsx --tsconfig tsconfig.app.json scripts/food/find-fdc.ts /tmp/fdc/<file> queso fresco`;
- when FDC has no such food at all (paneer is the likely one), choose the closest by composition and write why in `proxy`, as the other stand-ins do;
- run the extract again, until it writes the file.

Never change a recipe to make a number fit.

- [ ] **Step 7: Write the failing test** `src/food/data.node.test.ts`

```ts
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SOURCES } from '@/content/sources';
import { EXPECTED } from '../../scripts/food/expected';
import { INGREDIENTS } from '../../scripts/food/ingredients';
import { RECIPES } from '../../scripts/food/recipes';
import { buildFoodData, type FdcExtract } from './compute';
import { FOOD_DATA } from './data';

const fdc = JSON.parse(fs.readFileSync('scripts/food/fdc-ingredients.json', 'utf8')) as FdcExtract;
const committed: unknown = JSON.parse(fs.readFileSync('src/data/food/foods.json', 'utf8'));
const food = (id: string) => FOOD_DATA.foods.find(f => f.id === id)!;

describe('the food table (journey §11.6)', () => {
  it('is exactly what the recipes and the FDC extract give: run scripts/food/build.ts after changing either', () => {
    expect(committed).toEqual(buildFoodData({ fdc, ingredients: INGREDIENTS, recipes: RECIPES }));
  });
  it('is what the app loads', () => {
    expect(FOOD_DATA).toEqual(committed);
  });
  it('starts with 42 common Indian dishes', () => {
    expect(FOOD_DATA.foods).toHaveLength(42);
  });
  it('carries its source, version, licence and credit (board, D45)', () => {
    const s = FOOD_DATA.source;
    expect(s.name).toBe('USDA FoodData Central');
    expect(s.dataset).toBe('SR Legacy');
    expect(s.licence).toMatch(/CC0 1\.0/);
    expect(s.credit).toBe('U.S. Department of Agriculture, Agricultural Research Service. FoodData Central. https://fdc.nal.usda.gov/');
    expect(s.file).toMatch(/sr_legacy/i);
    expect(SOURCES.find(x => x.id === 'usda-fdc')?.accessed).toBe(s.extractedOn);
  });
  it('gives every dish a plausible estimate for its standard portion (Review Focus 5: a raw record matched for a cooked one)', () => {
    for (const f of FOOD_DATA.foods) {
      const want = EXPECTED[f.id];
      expect(want, `${f.id} has no line in scripts/food/expected.ts`).toBeDefined();
      const grams = f.portion.count * f.portion.grams;
      const kcal = (f.per100g.kcal * grams) / 100;
      const carbs = (f.per100g.carbsG * grams) / 100;
      expect(Math.abs(kcal - want.kcal), `${f.id}: ${kcal.toFixed(0)} kcal, expected about ${want.kcal}`).toBeLessThanOrEqual(Math.max(want.kcal * 0.2, 5));
      expect(Math.abs(carbs - want.carbsG), `${f.id}: ${carbs.toFixed(1)} g carbs, expected about ${want.carbsG}`).toBeLessThanOrEqual(Math.max(want.carbsG * 0.2, 1));
      expect(f.per100g.carbsLowG).toBeLessThanOrEqual(f.per100g.carbsG);
      expect(f.per100g.carbsHighG).toBeGreaterThanOrEqual(f.per100g.carbsG);
    }
  });
  it('says why each stand-in FDC record stands in', () => {
    for (const i of INGREDIENTS) if (i.proxy !== undefined) expect(i.proxy.length, i.key).toBeGreaterThan(20);
  });
  it('tags allergens from the ingredients (D99)', () => {
    expect(food('dahi').allergens.contains).toEqual(['milk']);
    expect(food('roti').allergens.contains).toEqual(['wheat']);
    expect(food('poha').allergens.contains).toEqual(expect.arrayContaining(['peanut', 'mustard']));
    expect(food('sambar').allergens.mayContain).toContain('wheat');
    expect(food('rice').allergens).toEqual({ contains: [], mayContain: [], complete: true });
    expect(food('coconut-chutney').words).toContain('coconut');
    expect(FOOD_DATA.foods.every(f => f.allergens.complete)).toBe(true);
  });
  it('derives eating patterns: no meat for vegetarians, no dairy for vegans, no root vegetables for Jain (D100)', () => {
    expect(food('chicken-curry').patterns).toEqual(['nonVegetarian']);
    expect(food('boiled-egg').patterns).toEqual(['eggetarian', 'nonVegetarian']);
    expect(food('dahi').patterns).not.toContain('vegan');
    expect(food('aloo-gobhi').patterns).not.toContain('jain');
    expect(food('mixed-veg-sabzi').patterns).toContain('jain');
  });
});
```

Run: `npx vitest run src/food/data.node.test.ts`
Expected: FAIL, "Cannot find module './data'".

- [ ] **Step 8: JSON imports, and the loader.** In `tsconfig.app.json`, add `"resolveJsonModule": true,` after `"moduleDetection": "force",`. (`tsconfig.test.json` extends it.) Then write `src/food/data.ts`:

```ts
/**
 * The food table, as scripts/food/build.ts wrote it. Imported only where food
 * is logged or ideas are filtered: Home and the reminder host never import it,
 * so the first screen doesn't carry it (boundaries.node.test.ts).
 */
import raw from '@/data/food/foods.json';
import type { Food, FoodData } from './types';

// Generated, and checked against its inputs and its shape by data.node.test.ts.
export const FOOD_DATA = raw as unknown as FoodData;
export const FOODS: readonly Food[] = FOOD_DATA.foods;
const BY_ID = new Map(FOODS.map(f => [f.id, f]));

export function foodById(id: string): Food | undefined {
  return BY_ID.get(id);
}
```

If `tsc` rejects the default import of the JSON, add `"allowSyntheticDefaultImports": true` beside `resolveJsonModule`.

- [ ] **Step 9: Build the table and run the test**

```bash
npx tsx --tsconfig tsconfig.app.json scripts/food/build.ts
npx vitest run src/food/data.node.test.ts
```

Expected: "Wrote 42 foods to src/data/food/foods.json", then every test passes except the source test, which needs Step 10.

If the plausibility test fails for a dish, its message names the dish and both figures. Check which ingredient's FDC record is in the wrong form (raw against cooked is the usual one), correct its `fdc` description, and repeat Steps 6 and 9. A recipe's grams change only if the recipe itself was wrong. In that case, update its line in `expected.ts` with the hand-worked figure, so the change is reviewed, and keep `rev` at 1, because nothing has been logged with it yet.

- [ ] **Step 10: The source and its claim.**
  - In `src/content/schema.ts`, change `kind` on `Source` to `kind: 'guideline' | 'factsheet' | 'study' | 'label' | 'dataset';`.
  - In `src/content/sources.ts`, add this to `SOURCES`, with `accessed` set to the `extractedOn` date in `scripts/food/fdc-ingredients.json`:

    ```ts
    {
      id: 'usda-fdc',
      organisation: 'U.S. Department of Agriculture, Agricultural Research Service',
      short: 'USDA FDC',
      title: 'FoodData Central: SR Legacy',
      edition: 'SR Legacy, April 2018',
      url: 'https://fdc.nal.usda.gov/',
      locator: 'Ingredient records by FDC ID, as each food’s recipe lists them',
      jurisdiction: 'United States',
      population: 'Food composition, not people',
      accessed: '<extractedOn from scripts/food/fdc-ingredients.json>',
      kind: 'dataset',
      licence: 'USDA FoodData Central data are public domain, under CC0 1.0 Universal. Credit: U.S. Department of Agriculture, Agricultural Research Service. FoodData Central. https://fdc.nal.usda.gov/',
    },
    ```

    Write the real date in place of the angle-bracketed text. The data test checks the two dates are equal. In `READ_AT`, add `'usda-fdc': { url: 'https://fdc.nal.usda.gov/', via: 'SR Legacy JSON download, values extracted by scripts/food/extract-fdc.ts' },`.
  - In `src/content/claims/food.ts`, add to `FOOD_CLAIMS`:

    ```ts
    claim('fd-estimates-basis',
      'FitStrong works out calorie and carbohydrate estimates from USDA FoodData Central values for each ingredient of its own home-style recipes, cooked with about a teaspoon of sunflower oil a serving. Carbs here are total carbohydrate, fibre included. Your own cooking and portions will differ, so every figure is an estimate.',
      [['usda-fdc', 'SR Legacy ingredient records, by FDC ID, as each recipe lists them']],
      { policy: true }),
    ```
  - In `src/content/meals.ts`, add `/** Shown wherever estimates are explained (the Food hub's "How estimates work"). */ export const FOOD_DATA_NOTES = ['fd-estimates-basis'];`, and export it from `src/content/index.ts`.
  - In `src/content/library.ts`, make `claimIdsOfMealIdeas()` return `withEverythingItCarries([...MEAL_INTRO, ...Object.values(SLOT_NOTES).flat(), ...FOOD_DATA_NOTES])`, importing `FOOD_DATA_NOTES` from `./meals`.
  - In `src/screens/guide/SourcesScreen.tsx`, exclude datasets from the first list (`k => k !== 'study' && k !== 'dataset'`), and add `<SourceList header="Food data" cited={asCited(k => k === 'dataset')} audience />` after "Studies".

- [ ] **Step 11: Run the content and data tests**

Run: `npx vitest run src/content src/food`
Expected: PASS. The content integrity tests now see `usda-fdc` cited by `fd-estimates-basis`, and the claim shown through the meal ideas' list.

- [ ] **Step 12: README.** Under "Assets and checks" in `README.md`, add:

```bash
npx tsx --tsconfig tsconfig.app.json scripts/food/extract-fdc.ts /tmp/fdc/<SR Legacy JSON>   # FDC values the recipes use → scripts/food/fdc-ingredients.json
npx tsx --tsconfig tsconfig.app.json scripts/food/build.ts                                  # the food table → src/data/food/foods.json
```

- [ ] **Step 13: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add scripts/food src/data/food src/food/data.ts src/food/data.node.test.ts tsconfig.app.json src/content src/screens/guide/SourcesScreen.tsx README.md
git commit -m "feat: Build 42 Indian dishes from FDC ingredients, with their source on record"
```

---

### Task 6: Estimates, and the words they're shown in

**Files:**
- Create: `src/food/estimate.ts`, `src/food/estimate.test.ts`
- Create: `src/food/format.ts`, `src/food/format.test.ts`
- Create: `src/food/copy.ts`, `src/food/copy.test.ts`

**Interfaces:**
- Consumes: `Food`, `FoodItem`, `CustomItem`, `QuickItem`, `MealItem`, `MealRecord`, `CustomFood`, `Slot` (Task 4); `UNITS`, `countText`, `portionText` (Task 4); `NumbersView`, `FoodLevel` (Task 2); `formatClock` from `@/screens/track/format`; `type TileLine` from `@/screens/home/tileLine`.
- Produces:
  - `src/food/estimate.ts`:
    - `interface Estimate { kcal: number; carbsG: number; carbsLowG: number; carbsHighG: number }`;
    - `estimateFood(food: Pick<Food, 'per100g' | 'portion'>, count: number, gramsPerPortion: number, weighed?: boolean): Estimate`;
    - `foodItem(food: Food, count?: number, gramsPerPortion?: number, weighed?: boolean): FoodItem`;
    - `customItem(custom: CustomFood, count?: number): CustomItem`;
    - `QUICK_NAME`, `quickItem(size: QuickItem['size'], kcal?: number): QuickItem`;
    - `refreshItem(item: MealItem, food: Food | undefined): MealItem`;
    - `interface Totals`, `totalsOf(items: readonly MealItem[]): Totals`;
  - `src/food/format.ts`:
    - `SLOT_LABEL: Record<Slot, string>`;
    - `kcalText(kcal: number): string`;
    - `carbsText(c: { carbsG: number; carbsLowG?: number; carbsHighG?: number }, ranges: boolean): string`;
    - `itemEstimate(item: MealItem, view: NumbersView): string | undefined`;
    - `interface TotalsLines { estimate?: string; missing?: string }`, `totalsLines(t: Totals, view: NumbersView): TotalsLines`;
    - `itemsLine(items: readonly MealItem[]): string`;
    - `mealRowDetail(meal: Pick<MealRecord, 'at' | 'items'>, view: NumbersView, hour12: boolean): string`;
    - `foodRowDetail(food: Pick<Food, 'portion' | 'per100g'>, view: NumbersView): string`;
    - `foodTileLine(level: FoodLevel, mealsToday: number): TileLine`;
    - `careTeamLine(targets: FoodPreferences['careTeamTargets'], view: NumbersView): string | undefined`;
  - `src/food/copy.ts`: `FOOD_COPY`, every food sentence the screens say, and `LEVEL_LABEL: Record<FoodLevel, string>` (as a `const` object).

- [ ] **Step 1: Write the failing test** `src/food/estimate.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { CustomFood, Food, FoodItem } from './types';
import { customItem, estimateFood, foodItem, quickItem, refreshItem, totalsOf } from './estimate';

const roti = {
  id: 'roti', rev: 1, name: 'Roti', portion: { unit: 'piece', grams: 40, count: 1, noun: ['roti', 'rotis'] },
  per100g: { kcal: 255, carbsG: 54, carbsLowG: 48.6, carbsHighG: 59.4 },
} as Food;
const dal = {
  id: 'toor-dal', rev: 2, name: 'Toor dal', portion: { unit: 'katori', grams: 150, count: 1 },
  per100g: { kcal: 94.3, carbsG: 13.07, carbsLowG: 11.76, carbsHighG: 14.38 },
} as Food;
const bhel: CustomFood = { id: 'c1', name: 'Bhel puri', per: { qty: 1, unit: 'plate' }, createdAt: '2026-10-08T09:00:00.000+05:30', updatedAt: '2026-10-08T09:00:00.000+05:30' };

describe('estimateFood (B-12)', () => {
  it('scales per-100 g values to the grams eaten, with the portion’s variance on the carb range', () => {
    // 2 rotis are 80 g: 204 kcal and 43.2 g carbs; the range is 38.88 × 0.8 to 47.52 × 1.2.
    expect(estimateFood(roti, 2, 40)).toEqual({ kcal: 204, carbsG: 43.2, carbsLowG: 31.1, carbsHighG: 57 });
  });
  it('drops the portion’s variance for a portion the person weighed', () => {
    expect(estimateFood(roti, 2, 40, true)).toEqual({ kcal: 204, carbsG: 43.2, carbsLowG: 38.9, carbsHighG: 47.5 });
  });
});

describe('items', () => {
  it('keep the food’s name, revision, unit and grams with the estimate (B-12)', () => {
    expect(foodItem(dal)).toEqual({ kind: 'food', foodId: 'toor-dal', rev: 2, name: 'Toor dal', unit: 'katori', count: 1, gramsPerPortion: 150, kcal: 141, carbsG: 19.6, carbsLowG: 14.1, carbsHighG: 25.9 });
  });
  it('leave a custom food’s unknown values unknown, never 0 (A-17)', () => {
    expect(customItem(bhel)).toEqual({ kind: 'custom', customId: 'c1', name: 'Bhel puri', count: 1 });
    expect(customItem({ ...bhel, kcal: 300 }, 2)).toEqual({ kind: 'custom', customId: 'c1', name: 'Bhel puri', count: 2, kcal: 600 });
    expect(quickItem('normal')).toEqual({ kind: 'quick', size: 'normal', name: 'Normal plate' });
  });
  it('are worked out again when the recipe moved on, keeping a weighed portion’s grams', () => {
    const old: FoodItem = { ...foodItem(dal), rev: 1, kcal: 999 };
    expect(refreshItem(old, dal)).toEqual(foodItem(dal));
    expect(refreshItem({ ...foodItem(dal, 1, 200, true), rev: 1 }, dal)).toEqual(foodItem(dal, 1, 200, true));
    const stored: FoodItem = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40 };
    expect(refreshItem(stored, roti)).toEqual(foodItem(roti, 2));
    expect(refreshItem(old, undefined)).toBe(old);
  });
});

describe('totalsOf (A-17, B-12)', () => {
  it('adds the known items and names the unknown ones apart', () => {
    expect(totalsOf([foodItem(roti, 2), customItem(bhel), quickItem('small', 250)])).toEqual({
      kcal: 454, carbsG: 43.2, carbsLowG: 31.1, carbsHighG: 57, withKcal: 2, withCarbs: 1, items: 3,
      missing: [{ name: 'Bhel puri', kcal: true, carbs: true }, { name: 'Small plate', kcal: false, carbs: true }],
    });
  });
  it('knows nothing for an empty meal', () => {
    expect(totalsOf([])).toEqual({ kcal: 0, carbsG: 0, carbsLowG: 0, carbsHighG: 0, withKcal: 0, withCarbs: 0, items: 0, missing: [] });
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/food/estimate.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write** `src/food/estimate.ts`

```ts
/**
 * Estimates for what a person ate (journey §11.2–11.4, B-12): from the food
 * table's per-100 g values, for the grams eaten, with a carb range that adds
 * the portion's own variance unless the person weighed it. A meal's or a
 * day's total adds the known items only; the others are named, never 0.
 *
 * Kept free of the food table: it is handed the foods it works with.
 */
import { UNITS } from './units';
import type { CustomFood, CustomItem, Food, FoodItem, MealItem, QuickItem } from './types';

const r1 = (n: number) => Math.round(n * 10) / 10;

export interface Estimate { kcal: number; carbsG: number; carbsLowG: number; carbsHighG: number }

export function estimateFood(food: Pick<Food, 'per100g' | 'portion'>, count: number, gramsPerPortion: number, weighed = false): Estimate {
  const share = (count * gramsPerPortion) / 100;
  const variance = weighed ? 0 : UNITS[food.portion.unit].variance;
  return {
    kcal: Math.round(food.per100g.kcal * share),
    carbsG: r1(food.per100g.carbsG * share),
    carbsLowG: r1(food.per100g.carbsLowG * share * (1 - variance)),
    carbsHighG: r1(food.per100g.carbsHighG * share * (1 + variance)),
  };
}

/** A tray item for a food from the table: its standard portion unless told otherwise, with the estimate (B-12). */
export function foodItem(food: Food, count = food.portion.count, gramsPerPortion = food.portion.grams, weighed = false): FoodItem {
  return {
    kind: 'food', foodId: food.id, rev: food.rev, name: food.name, unit: food.portion.unit, count, gramsPerPortion,
    ...(weighed ? { weighed: true as const } : {}),
    ...estimateFood(food, count, gramsPerPortion, weighed),
  };
}

export function customItem(custom: CustomFood, count = 1): CustomItem {
  return {
    kind: 'custom', customId: custom.id, name: custom.name, count,
    ...(custom.kcal !== undefined ? { kcal: Math.round(custom.kcal * count) } : {}),
    ...(custom.carbsG !== undefined ? { carbsG: r1(custom.carbsG * count) } : {}),
  };
}

export const QUICK_NAME: Record<QuickItem['size'], string> = { small: 'Small plate', normal: 'Normal plate', large: 'Large plate' };

export function quickItem(size: QuickItem['size'], kcal?: number): QuickItem {
  return { kind: 'quick', size, name: QUICK_NAME[size], ...(kcal !== undefined ? { kcal: Math.round(kcal) } : {}) };
}

/**
 * An item worked out again from the table as it is now: when its recipe has
 * a new revision, or it was stored without an estimate. A weighed portion
 * keeps its grams; otherwise the table's standard grams apply. Anything the
 * table no longer has is kept as it was.
 */
export function refreshItem(item: MealItem, food: Food | undefined): MealItem {
  if (item.kind !== 'food' || !food) return item;
  if (item.rev === food.rev && item.kcal !== undefined) return item;
  return foodItem(food, item.count, item.weighed ? item.gramsPerPortion : food.portion.grams, item.weighed === true);
}

export interface Totals {
  kcal: number;
  carbsG: number;
  carbsLowG: number;
  carbsHighG: number;
  /** How many items have a calorie figure, and how many a carb figure. */
  withKcal: number;
  withCarbs: number;
  /** Each item missing a figure (A-17): named, never counted as 0. */
  missing: { name: string; kcal: boolean; carbs: boolean }[];
  items: number;
}

export function totalsOf(items: readonly MealItem[]): Totals {
  let kcal = 0;
  let carbs = 0;
  let low = 0;
  let high = 0;
  let withKcal = 0;
  let withCarbs = 0;
  const missing: Totals['missing'] = [];
  for (const item of items) {
    if (item.kcal !== undefined) {
      kcal += item.kcal;
      withKcal += 1;
    }
    if (item.carbsG !== undefined) {
      carbs += item.carbsG;
      low += item.kind === 'food' ? item.carbsLowG ?? item.carbsG : item.carbsG;
      high += item.kind === 'food' ? item.carbsHighG ?? item.carbsG : item.carbsG;
      withCarbs += 1;
    }
    if (item.kcal === undefined || item.carbsG === undefined) missing.push({ name: item.name, kcal: item.kcal === undefined, carbs: item.carbsG === undefined });
  }
  return { kcal: Math.round(kcal), carbsG: r1(carbs), carbsLowG: r1(low), carbsHighG: r1(high), withKcal, withCarbs, missing, items: items.length };
}
```

- [ ] **Step 4: Run it**

Run: `npx vitest run src/food/estimate.test.ts`
Expected: PASS.

- [ ] **Step 5: The copy.** Write `src/food/copy.ts`:

```ts
/**
 * Every sentence the food screens say (journey §11, B-24), in one place, so a
 * test can check that none of them judges, counts down to a limit, or offers
 * skipping a meal, fasting or exercising to make up for food (§11.4, §11.5).
 * The words estimates themselves are shown in are `format.ts`'s.
 */
export const FOOD_COPY = {
  // The hub
  rightNow: 'Right now',
  ideasFor: (slot: string) => `${slot} · ideas for you`,
  allIdeas: 'All meal ideas',
  noIdeas: 'No ideas left for this meal',
  noIdeasDetail: 'Every idea here has a food you’re allergic to or chose to leave out.',
  noIdeaLeft: (slot: string) => `${slot} · every idea has a food you’re allergic to or chose to leave out`,
  chooseFood: 'What you eat',
  chooseFoodDetail: 'Tell us how you eat, for ideas that suit you',
  logWhatYouAte: 'Log what you ate',
  startLogging: 'Log what you eat',
  startLoggingDetail: 'Optional: meals only, or with estimates',
  needsProfile: 'Finish setting up to log meals',
  sameAsYesterday: (slot: string) => `Same as yesterday’s ${slot.toLowerCase()}`,
  today: 'Today',
  nothingToday: 'Nothing logged yet today',
  thisWeek: 'This week',
  notLogged: 'Not logged',
  mealsCount: (n: number) => `${n} ${n === 1 ? 'meal' : 'meals'}`,
  options: 'Options',
  optionLog: 'Log a meal',
  optionUsual: 'Your usual meals',
  optionQuick: 'Quick add',
  optionIdeas: 'Meal ideas',
  optionWeek: 'Sample week',
  howEstimates: 'How estimates work',
  roughCarbs: 'Carb figures are rough estimates. Follow your care team’s plan.',
  attribution: 'Ingredient values: USDA FoodData Central (public domain).',
  privacy: 'Your records are stored on this phone.',
  // Your usual meals
  usualTitle: 'Your usual meals',
  noUsual: 'No usual meals yet. When you log a meal, turn on “Save as a usual meal”.',
  usualRemove: (name: string) => `Remove ${name}`,
  removed: (name: string) => `${name} removed`,
  // Log a meal
  logTitle: 'Log a meal',
  gone: 'That meal isn’t here any more. It may have been deleted on another screen.',
  editTitle: (slot: string) => `Edit ${slot.toLowerCase()}`,
  meal: 'Meal',
  when: 'When',
  change: 'Change',
  futureTime: 'That time hasn’t come yet. Choose a time that has passed.',
  yourUsual: 'Your usual',
  yourMeal: 'Your meal',
  nothingAdded: 'Nothing added yet. Search, or choose from the foods below.',
  search: 'Search foods',
  searchPlaceholder: 'Roti, dal, poha…',
  common: 'Common Indian foods',
  results: 'Results',
  add: 'Add',
  noResults: (text: string) => `No food called “${text}” here`,
  added: 'Added ✓',
  addOne: (name: string) => `Add ${name}`,
  ownFood: (text: string) => `Add “${text}” as your own food`,
  quickAdd: 'Quick add: about how much?',
  less: 'Less',
  more: 'More',
  remove: 'Remove',
  backToMeal: 'Your meal',
  weigh: 'Weigh yours',
  weighLabel: (what: string) => `One ${what} weighs, in grams`,
  weighHint: 'Weigh one portion once, and that weight is used for this meal.',
  whatsInIt: 'What’s in it',
  notCounted: 'not counted',
  recipeNote: 'Tagged from our recipe. Kitchens and brands differ.',
  contains: (list: string) => `Contains ${list}`,
  mayContain: (list: string) => `May contain ${list}`,
  noTaggedAllergens: 'None of the allergens we tag',
  saveAsUsual: 'Save as a usual meal',
  usualName: 'Name',
  save: 'Save meal',
  saving: 'Saving…',
  addToMeal: 'Add to meal',
  done: 'Done',
  deleteMeal: 'Delete meal',
  history: 'Earlier versions',
  historyRow: (when: string) => `Changed ${when}`,
  discardTitle: 'Discard this meal?',
  discardDetail: 'What you added here goes. Meals already saved stay.',
  discard: 'Discard',
  keepEditing: 'Keep editing',
  saved: (slot: string) => `${slot} saved`,
  updated: (slot: string) => `${slot} updated`,
  deleted: (slot: string) => `${slot} deleted`,
  restored: (slot: string) => `${slot} restored`,
  undo: 'Undo',
  didNotSave: 'That didn’t save.',
  // Your own food, and Quick add
  ownTitle: 'Your own food',
  ownName: 'Name',
  ownPerQty: 'One portion is',
  ownPerUnit: 'Unit, such as plate or bowl',
  ownKcal: 'kcal in one portion (optional)',
  ownCarbs: 'Carbs in one portion, in grams (optional)',
  ownUnknown: 'Leave a figure blank if you don’t know it. It stays unknown, never 0.',
  ownAllergens: 'It contains (optional)',
  ownNoName: 'Give it a name.',
  ownNoQty: 'Say how much one portion is.',
  ownBadFigure: 'That figure can’t be right. Check it, or leave it blank.',
  quickHow: 'About how much?',
  quickKcal: 'Or about how many kcal (optional)',
  // Choosing a level
  levelTitle: 'Log what you eat?',
  levelIdeas: 'No, meal ideas only',
  levelIdeasDetail: 'Ideas for every meal. Nothing to log.',
  levelMeals: 'Yes, meals only, no numbers',
  levelMealsDetail: 'A record of what you ate, with no calories or carbs anywhere.',
  levelEstimates: 'Yes, with calorie and carb estimates',
  levelEstimatesDetail: 'Estimates for Indian portions, always marked as estimates.',
  screenQuestion: 'Has food or weight ever been hard for you?',
  screenYes: 'Yes',
  screenNo: 'No',
  screenPreferNot: 'Prefer not to say',
  screenNote: 'Your answer stays on this phone, and only changes what we suggest.',
  suggestTitle: 'Many people find it easier to log without numbers.',
  suggestMeals: 'Meals only, no numbers (recommended)',
  suggestEstimates: 'With estimates anyway',
  // Me → Food
  levelGroup: 'Log what you eat',
  levelFooter: 'You can change this at any time. Meals you’ve logged stay, whatever you choose.',
  allergiesGroup: 'Allergies',
  allergiesFooter: 'Meal ideas leave out anything with these in it, or that may have them. Foods you’ve eaten can still be logged.',
  somethingElse: 'Something else',
  somethingElsePlaceholder: 'For example: brinjal',
  avoidFooter: 'Foods you don’t eat, in your own words. Meal ideas leave them out.',
  targetGroup: 'Daily target from your care team (optional)',
  targetFooter: 'FitStrong doesn’t suggest targets. Add one only if your care team gave it to you.',
  targetKcal: 'kcal a day',
  targetCarbs: 'Carbs a day, in grams',
  targetSave: 'Save target',
  targetRemove: 'Remove target',
  targetSetOn: (date: string) => `From your care team, set on ${date}.`,
  targetBad: 'Enter the whole numbers your care team gave you, or leave one blank.',
  reminderGroup: 'Reminder to log',
  reminderMeal: 'Remind me about',
  reminderOff: 'Off',
  reminderTime: 'At',
  reminderFooter: 'At most once a day, never in quiet hours, and not once that meal is logged. It shows only while FitStrong is open.',
  // The prompt (journey §7.4)
  promptTitle: (slot: string) => `Add ${slot.toLowerCase()} to Food?`,
  promptDetail: 'Only if you’d like to. It takes a few taps.',
  promptAction: (slot: string) => `Log ${slot.toLowerCase()}`,
} as const;

/** Each logging level, as Me → Food and the hub name it. */
export const LEVEL_LABEL = { ideas: 'Meal ideas only', meals: 'Meals only, no numbers', estimates: 'Meals with estimates' } as const;
```

- [ ] **Step 6: Write the failing tests** `src/food/format.test.ts` and `src/food/copy.test.ts`

```ts
// src/food/format.test.ts
import { describe, expect, it } from 'vitest';
import type { FoodItem, CustomItem, Food } from './types';
import { totalsOf } from './estimate';
import { careTeamLine, carbsText, foodRowDetail, foodTileLine, itemEstimate, itemsLine, kcalText, mealRowDetail, totalsLines } from './format';

const shown = { show: true, ranges: false } as const;
const ranged = { show: true, ranges: true } as const;
const hidden = { show: false } as const;
const roti: FoodItem = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40, kcal: 204, carbsG: 43.2, carbsLowG: 31.1, carbsHighG: 57 };
const bhel: CustomItem = { kind: 'custom', customId: 'c1', name: 'Bhel puri', count: 1 };

describe('kcalText and carbsText (journey §11.4)', () => {
  it('rounds kcal to 10, and carbs to the gram under 10 and to 5 above', () => {
    expect(kcalText(204)).toBe('200 kcal');
    expect(kcalText(1455)).toBe('1,460 kcal');
    expect(kcalText(4)).toBe('under 10 kcal');
    expect(carbsText({ carbsG: 43.2 }, false)).toBe('45 g carbs');
    expect(carbsText({ carbsG: 7.6 }, false)).toBe('8 g carbs');
    expect(carbsText({ carbsG: 0.4 }, false)).toBe('under 1 g carbs');
  });
  it('shows carbs as a range that never narrows the estimate (K-22)', () => {
    expect(carbsText({ carbsG: 43.2, carbsLowG: 31.1, carbsHighG: 57 }, true)).toBe('about 30–60 g carbs');
    expect(carbsText({ carbsG: 4, carbsLowG: 3.1, carbsHighG: 5.3 }, true)).toBe('about 3–6 g carbs');
    expect(carbsText({ carbsG: 30 }, true)).toBe('about 30 g carbs');
  });
});

describe('item and meal lines', () => {
  it('say “Estimated” before every figure, and “No estimate” for an unknown food', () => {
    expect(itemEstimate(roti, shown)).toBe('Estimated 200 kcal · 45 g carbs');
    expect(itemEstimate(roti, ranged)).toBe('Estimated 200 kcal · about 30–60 g carbs');
    expect(itemEstimate(bhel, shown)).toBe('No estimate');
    expect(itemEstimate({ ...bhel, kcal: 300 }, shown)).toBe('Estimated 300 kcal · no carb estimate');
  });
  it('label a partial total “in logged foods” and count what has no estimate (A-17)', () => {
    expect(totalsLines(totalsOf([roti, bhel]), shown)).toEqual({ estimate: 'Estimated 200 kcal · 45 g carbs in logged foods', missing: '1 item has no estimate' });
    expect(totalsLines(totalsOf([roti, bhel, bhel]), ranged)).toEqual({ estimate: 'Estimated 200 kcal · about 30–60 g carbs in logged foods', missing: '2 items have no estimate' });
  });
  it('list what was eaten, with counts', () => {
    expect(itemsLine([roti, { ...roti, foodId: 'toor-dal', name: 'Toor dal', count: 1.5 }, bhel])).toBe('Roti ×2 · Toor dal ×1½ · Bhel puri');
  });
  it('show nothing numeric in counts-free mode, even for a meal logged with estimates (B-11, Review Focus 3)', () => {
    expect(itemEstimate(roti, hidden)).toBeUndefined();
    expect(totalsLines(totalsOf([roti]), hidden)).toEqual({});
    const meal = { at: '2026-10-07T13:10:00.000+05:30', items: [roti] };
    expect(mealRowDetail(meal, hidden, true)).toBe('1:10 pm · Roti ×2');
    expect(mealRowDetail(meal, shown, true)).toBe('1:10 pm · Roti ×2 · Estimated 200 kcal');
    const food = { portion: { unit: 'piece', grams: 40, count: 1, noun: ['roti', 'rotis'] }, per100g: { kcal: 255, carbsG: 54, carbsLowG: 48.6, carbsHighG: 59.4 } } as Food;
    expect(foodRowDetail(food, hidden)).toBe('1 roti (≈ 40 g)');
    expect(foodRowDetail(food, shown)).toBe('1 roti (≈ 40 g) · Estimated 100 kcal');
  });
});

describe('the Food tile and the care-team target', () => {
  it('reads ideas, nothing yet, or how many meals today, never a figure', () => {
    expect(foodTileLine('ideas', 3).text).toBe('Meal ideas for you');
    expect(foodTileLine('meals', 0).text).toBe('Log a meal · ideas for you');
    expect(foodTileLine('estimates', 1).text).toBe('1 meal logged today');
    expect(foodTileLine('meals', 2).text).toBe('2 meals logged today');
  });
  it('shows a care-team target only with estimates, as theirs (journey §11.5)', () => {
    expect(careTeamLine({ kcal: 1600, carbsG: 180, setOn: '2026-10-01' }, shown)).toBe('From your care team: 1,600 kcal and 180 g carbs a day');
    expect(careTeamLine({ kcal: 1600, setOn: '2026-10-01' }, hidden)).toBeUndefined();
    expect(careTeamLine(undefined, shown)).toBeUndefined();
  });
});
```

```ts
// src/food/copy.test.ts
import { describe, expect, it } from 'vitest';
import { FOOD_COPY } from './copy';
import { totalsOf } from './estimate';
import { careTeamLine, foodTileLine, itemEstimate, totalsLines } from './format';
import type { FoodItem } from './types';

/** Words that judge, count down to a limit, or offer making up for food (journey §11.4–11.5, A-50). */
const FORBIDDEN = /\b(net|earn(ed|s)?|burn(ed|t|s)?|allowance|over|remaining|left today|exceed(ed|s)?|skip|fast(ing)?|cheat|guilt|junk|bad|compensate|make up|work (it )?off)\b/i;
const sample = (v: unknown): string => (typeof v === 'function' ? String((v as (s: string) => string)('Lunch')) : String(v));

describe('food words', () => {
  it('never judge, never count down, never offer making up for food', () => {
    for (const [key, value] of Object.entries(FOOD_COPY)) expect(sample(value), key).not.toMatch(FORBIDDEN);
    const roti: FoodItem = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40, kcal: 204, carbsG: 43.2 };
    const shown = { show: true, ranges: true } as const;
    const lines = totalsLines(totalsOf([roti]), shown);
    for (const text of [itemEstimate(roti, shown), lines.estimate, careTeamLine({ kcal: 1600, setOn: '2026-10-01' }, shown), foodTileLine('estimates', 2).text]) {
      expect(text).not.toMatch(FORBIDDEN);
    }
  });
});
```

- [ ] **Step 7: Run them to check they fail**

Run: `npx vitest run src/food/format.test.ts src/food/copy.test.ts`
Expected: FAIL. `./format` isn't found.

- [ ] **Step 8: Write** `src/food/format.ts`

```ts
/**
 * The words estimates are shown in (journey §11.4): "Estimated" before every
 * figure, carbs as a range with insulin or a sulfonylurea (K-22), partial
 * totals said to be "in logged foods", unknowns counted apart, and nothing
 * numeric at all unless the person chose estimates (B-11), on old records too.
 *
 * Kept free of the food table: Home and Today's log import this file.
 */
import type { TileLine } from '@/screens/home/tileLine';
import { formatClock } from '@/screens/track/format';
import type { FoodPreferences } from '@/types/profile';
import { estimateFood, totalsOf, type Totals } from './estimate';
import type { FoodLevel, NumbersView } from './level';
import type { Food, MealItem, MealRecord, Slot } from './types';
import { countText, portionText } from './units';

export const SLOT_LABEL: Record<Slot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' };

const fmt = (n: number) => n.toLocaleString('en-IN');
const to = (n: number, step: number, how: 'round' | 'floor' | 'ceil') => Math[how](n / step) * step;
const carbStep = (n: number) => (n < 10 ? 1 : 5);

/** "200 kcal": to the nearest 10, and under 10 said as such. */
export function kcalText(kcal: number): string {
  return kcal < 10 ? 'under 10 kcal' : `${fmt(to(kcal, 10, 'round'))} kcal`;
}

/** "45 g carbs", or "about 30–60 g carbs" as a range (K-22): to the gram under 10 g, to 5 g above. */
export function carbsText(c: { carbsG: number; carbsLowG?: number; carbsHighG?: number }, ranges: boolean): string {
  if (!ranges) return c.carbsG < 1 ? 'under 1 g carbs' : `${fmt(to(c.carbsG, carbStep(c.carbsG), 'round'))} g carbs`;
  const lowRaw = c.carbsLowG ?? c.carbsG;
  const highRaw = c.carbsHighG ?? c.carbsG;
  if (highRaw < 1) return 'under 1 g carbs';
  const low = to(lowRaw, carbStep(lowRaw), 'floor');
  const high = to(highRaw, carbStep(highRaw), 'ceil');
  return low === high ? `about ${fmt(low)} g carbs` : `about ${fmt(low)}–${fmt(high)} g carbs`;
}

/** One item's estimate in the tray, or nothing when numbers aren't shown. */
export function itemEstimate(item: MealItem, view: NumbersView): string | undefined {
  if (!view.show) return undefined;
  if (item.kcal === undefined && item.carbsG === undefined) return 'No estimate';
  const known = [
    item.kcal !== undefined ? kcalText(item.kcal) : undefined,
    item.carbsG !== undefined
      ? carbsText({ carbsG: item.carbsG, carbsLowG: item.kind === 'food' ? item.carbsLowG : undefined, carbsHighG: item.kind === 'food' ? item.carbsHighG : undefined }, view.ranges)
      : undefined,
  ].filter(Boolean);
  const gap = item.kcal === undefined ? ' · no calorie estimate' : item.carbsG === undefined ? ' · no carb estimate' : '';
  return `Estimated ${known.join(' · ')}${gap}`;
}

export interface TotalsLines {
  /** "Estimated 620 kcal · 85 g carbs in logged foods". */
  estimate?: string;
  /** "2 items have no estimate". */
  missing?: string;
}

export function totalsLines(t: Totals, view: NumbersView): TotalsLines {
  if (!view.show || t.items === 0) return {};
  const parts = [t.withKcal > 0 ? kcalText(t.kcal) : undefined, t.withCarbs > 0 ? carbsText(t, view.ranges) : undefined].filter(Boolean);
  const say = (n: number, what: string) => `${n} ${n === 1 ? 'item has' : 'items have'} no ${what}`;
  const none = t.missing.filter(m => m.kcal && m.carbs).length;
  const noCarbs = t.missing.filter(m => m.carbs && !m.kcal).length;
  const noKcal = t.missing.filter(m => m.kcal && !m.carbs).length;
  const missing = [none > 0 && say(none, 'estimate'), noCarbs > 0 && say(noCarbs, 'carb estimate'), noKcal > 0 && say(noKcal, 'calorie estimate')].filter(Boolean).join(' · ');
  return { ...(parts.length > 0 ? { estimate: `Estimated ${parts.join(' · ')} in logged foods` } : {}), ...(missing ? { missing } : {}) };
}

/** "Roti ×2 · Toor dal ×1½ · Bhel puri". */
export function itemsLine(items: readonly MealItem[]): string {
  return items.map(i => (i.kind === 'quick' || i.count === 1 ? i.name : `${i.name} ×${countText(i.count)}`)).join(' · ');
}

/** A logged meal's line in Today's log and the hub: "1:10 pm · Roti ×2", with its estimate when numbers are shown. */
export function mealRowDetail(meal: Pick<MealRecord, 'at' | 'items'>, view: NumbersView, hour12: boolean): string {
  const parts = [formatClock(meal.at, hour12), itemsLine(meal.items)];
  if (view.show) {
    const t = totalsOf(meal.items);
    if (t.withKcal > 0) parts.push(`Estimated ${kcalText(t.kcal)}${t.missing.some(m => m.kcal) ? ' in logged foods' : ''}`);
  }
  return parts.join(' · ');
}

/** A food's line in a list: its standard portion, and its estimate when numbers are shown (B-11 covers search too). */
export function foodRowDetail(food: Pick<Food, 'portion' | 'per100g'>, view: NumbersView): string {
  const portion = portionText(food.portion, food.portion.count, food.portion.grams);
  if (!view.show) return portion;
  return `${portion} · Estimated ${kcalText(estimateFood(food, food.portion.count, food.portion.grams).kcal)}`;
}

/** Home's Food tile (journey §7.2): ideas, or how many meals today. Never a figure on Home. */
export function foodTileLine(level: FoodLevel, mealsToday: number): TileLine {
  if (level === 'ideas') return { text: 'Meal ideas for you', tone: 'normal' };
  if (mealsToday === 0) return { text: 'Log a meal · ideas for you', tone: 'normal' };
  return { text: `${mealsToday} ${mealsToday === 1 ? 'meal' : 'meals'} logged today`, tone: 'normal' };
}

/** A target the person's care team gave them, only with estimates (journey §11.5). No progress, no "left". */
export function careTeamLine(targets: FoodPreferences['careTeamTargets'], view: NumbersView): string | undefined {
  if (!view.show || !targets || (targets.kcal === undefined && targets.carbsG === undefined)) return undefined;
  const parts = [targets.kcal !== undefined ? `${fmt(targets.kcal)} kcal` : undefined, targets.carbsG !== undefined ? `${fmt(targets.carbsG)} g carbs` : undefined].filter(Boolean);
  return `From your care team: ${parts.join(' and ')} a day`;
}
```

- [ ] **Step 9: Run them**

Run: `npx vitest run src/food`
Expected: PASS.

- [ ] **Step 10: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/food/estimate.ts src/food/estimate.test.ts src/food/format.ts src/food/format.test.ts src/food/copy.ts src/food/copy.test.ts
git commit -m "feat: Estimate what was eaten, and say it with no judgement"
```

---

### Task 7: Meal ideas that respect allergies and the Jain pattern

This replaces Plan 5's interim word matching with each idea's recipe tags.

**Files:**
- Create: `src/content/mealDishes.ts`, `src/content/mealDishes.test.ts`
- Modify: `src/content/allergens.ts` (Plan 5's), `src/content/week.ts`, `src/content/week.test.ts`, `src/content/search.ts`, `src/content/index.ts`
- Modify: `src/screens/guide/MealIdeasScreen.tsx`, `MealDetailScreen.tsx`, `SampleWeekScreen.tsx`, `FoodPicker.tsx`, `format.ts`, `format.test.ts` (append)

**Interfaces:**
- Consumes:
  - `foodById` (Task 5);
  - `ALLERGENS`, `allergiesOf`, `allergenList`, `allergenName`, `isAllergenId`, `recommendable` and `type AllergenTags` (Task 3);
  - `FOOD_COPY` (Task 6);
  - Plan 5's `JAIN_LEAVES_OUT`, `mealPattern` and `withPicked`.
- Produces:
  - `src/content/mealDishes.ts`: `interface ComponentFoods { dishes: readonly string[]; mayContain?: readonly AllergenId[] }`, `componentKey(mealId: string, componentName: string): string` and `MEAL_DISHES: Readonly<Record<string, ComponentFoods>>`;
  - `src/content/week.ts`:
    - `suits(meal, pattern?)` reads a Jain plate from its dishes;
    - `mealTags(meal: MealTemplate, pattern?: Pattern): AllergenTags`;
    - `mealAllowed(meal: MealTemplate, food?: FoodPreferences): boolean`;
    - `mealsFor(food?, slot?)` filters through `mealAllowed`;
    - `isAvoided(...)` keeps v1's matching, against the meal's own words, now through the shared `ownWords` (board D99).

    Every caller of `mealsFor` and `sampleWeek` gets this without changing.
  - `src/content/allergens.ts`:
    - `ALLERGEN_TERMS` and `leaveOut` go;
    - `JAIN_LEAVES_OUT` lists every word D100 names;
    - `withPicked` also carries the picker's allergies.

- [ ] **Step 1: The map** `src/content/mealDishes.ts`. Each key is `templateId|component name`, as written in `src/content/meals.ts`.

```ts
/**
 * What each meal idea's components are, as dishes in the food table (journey
 * §11.1, B-13). The ideas stay v1's plate-method templates; this map lets the
 * one filter, `mealsFor`, know their allergens and whether a Jain plate suits
 * them. An "or" component lists every dish it could be, so its tags are the
 * union. A component no dish in the table is says what it may carry.
 */
import type { AllergenId } from '@/types/profile';

export interface ComponentFoods {
  dishes: readonly string[];
  mayContain?: readonly AllergenId[];
}

export const componentKey = (mealId: string, componentName: string) => `${mealId}|${componentName}`;

const SALAD = 'cucumber-tomato-salad';
const SIDE: ComponentFoods = { dishes: [SALAD, 'mixed-veg-sabzi'] };
const ROTI: ComponentFoods = { dishes: ['roti', 'jowar-roti'] };

export const MEAL_DISHES: Readonly<Record<string, ComponentFoods>> = {
  // Breakfast
  'b-idli-sambar|Sambar vegetables, with cucumber or tomato on the side': { dishes: ['sambar', SALAD] },
  'b-idli-sambar|Sambar dal': { dishes: ['sambar'] },
  'b-idli-sambar|Idli': { dishes: ['idli'] },
  'b-idli-sambar|Coconut chutney': { dishes: ['coconut-chutney'] },
  'b-dosa-sambar|Sambar vegetables, with cucumber or tomato on the side': { dishes: ['sambar', SALAD] },
  'b-dosa-sambar|Sambar dal': { dishes: ['sambar'] },
  'b-dosa-sambar|Plain dosa': { dishes: ['plain-dosa'] },
  'b-dosa-sambar|Coconut chutney': { dishes: ['coconut-chutney'] },
  'b-poha|Onion, tomato and other vegetables mixed in': { dishes: ['poha'] },
  'b-poha|Poha': { dishes: ['poha'] },
  'b-poha|Cooked sprouts or roasted chana on the side': { dishes: ['sprouts-chaat', 'roasted-chana'] },
  'b-poha|A few peanuts': { dishes: ['roasted-peanuts'] },
  'b-upma|Beans, carrot, onion and other vegetables cooked in': { dishes: ['upma'] },
  'b-upma|Upma': { dishes: ['upma'] },
  'b-upma|Sambar or dal on the side': { dishes: ['sambar', 'toor-dal'] },
  'b-upma|Dahi (curd), if you like': { dishes: ['dahi'] },
  'b-moong-chilla|Onion, tomato and palak in the batter, and a salad': { dishes: ['moong-dal-chilla', SALAD] },
  'b-moong-chilla|Moong dal chilla': { dishes: ['moong-dal-chilla'] },
  'b-moong-chilla|Mint chutney': { dishes: ['mint-chutney'] },
  'b-moong-chilla|Dahi (curd)': { dishes: ['dahi'] },
  'b-dalia|Vegetables cooked in, and a salad': { dishes: ['vegetable-dalia', SALAD] },
  'b-dalia|Moong dal, cooked in': { dishes: ['vegetable-dalia'] },
  'b-dalia|Dalia (broken wheat)': { dishes: ['vegetable-dalia'] },
  'b-egg-bhurji|Salad, or more vegetables': SIDE,
  'b-egg-bhurji|Egg bhurji with onion, tomato and palak': { dishes: ['egg-bhurji'] },
  'b-egg-bhurji|Whole-wheat or millet roti': ROTI,
  // Lunch
  'l-roti-dal-sabzi|Sabzi and salad — bhindi, lauki, gobhi or palak, with kheera and tomato': { dishes: ['mixed-veg-sabzi', 'bhindi-sabzi', SALAD] },
  'l-roti-dal-sabzi|Dal': { dishes: ['toor-dal'] },
  'l-roti-dal-sabzi|Whole-wheat or millet roti': ROTI,
  'l-roti-dal-sabzi|Dahi (curd)': { dishes: ['dahi'] },
  'l-rice-sambar-poriyal|Poriyal and a kosambari-style salad': { dishes: ['poriyal', SALAD] },
  'l-rice-sambar-poriyal|Sambar dal': { dishes: ['sambar'] },
  'l-rice-sambar-poriyal|Rice, or a millet such as foxtail millet': { dishes: ['rice'] },
  'l-rice-sambar-poriyal|Curd (thayir)': { dishes: ['dahi'] },
  'l-rajma-rice|Salad and a vegetable side': SIDE,
  'l-rajma-rice|Rajma': { dishes: ['rajma'] },
  'l-rajma-rice|Rice': { dishes: ['rice'] },
  'l-rajma-rice|Dahi or raita': { dishes: ['dahi', 'raita'] },
  'l-chana-roti|Salad and a vegetable side': SIDE,
  'l-chana-roti|Chana masala': { dishes: ['chana-masala'] },
  'l-chana-roti|Whole-wheat or millet roti': ROTI,
  'l-palak-paneer|Palak gravy and a salad': { dishes: ['palak-paneer', SALAD] },
  'l-palak-paneer|Paneer': { dishes: ['palak-paneer'] },
  'l-palak-paneer|Whole-wheat or millet roti': ROTI,
  'l-fish-curry-rice|A vegetable side and salad': SIDE,
  'l-fish-curry-rice|Fish curry': { dishes: ['fish-curry'] },
  'l-fish-curry-rice|Rice': { dishes: ['rice'] },
  'l-chicken-roti|Salad and a vegetable side': SIDE,
  'l-chicken-roti|Chicken curry': { dishes: ['chicken-curry'] },
  'l-chicken-roti|Whole-wheat or millet roti': ROTI,
  // Snacks
  's-roasted-chana|Roasted chana': { dishes: ['roasted-chana'] },
  's-sprouts-chaat|Cooked moong sprouts': { dishes: ['sprouts-chaat'] },
  's-sprouts-chaat|Onion, tomato and cucumber with lemon': { dishes: ['sprouts-chaat'] },
  's-fruit|Whole fruit, such as guava, orange, apple or papaya': { dishes: ['guava'] },
  's-salad-seeds|Cucumber, tomato, carrot and onion': { dishes: [SALAD] },
  's-salad-seeds|A few seeds or nuts': { dishes: [], mayContain: ['peanut', 'treeNut', 'sesame'] },
  's-salad-seeds|Curd on top, if you like': { dishes: ['dahi'] },
  's-chaas|Chaas': { dishes: ['chaas'] },
  's-boiled-egg|Boiled egg': { dishes: ['boiled-egg'] },
  // Dinner
  'd-khichdi|Vegetables cooked in, and a sabzi on the side': { dishes: ['moong-dal-khichdi', 'mixed-veg-sabzi'] },
  'd-khichdi|Moong dal': { dishes: ['moong-dal-khichdi'] },
  'd-khichdi|Rice or millet, cooked with the dal': { dishes: ['moong-dal-khichdi'] },
  'd-khichdi|Dahi (curd)': { dishes: ['dahi'] },
  'd-millet-roti-dal|Sabzi and salad': SIDE,
  'd-millet-roti-dal|Dal': { dishes: ['toor-dal'] },
  // Bajra roti is made as jowar roti is (millet flour and water), with no allergen of its own.
  'd-millet-roti-dal|Jowar or bajra roti': { dishes: ['jowar-roti'] },
  'd-dal-bhat|Tarkari (vegetable curry) and salad': SIDE,
  'd-dal-bhat|Dal': { dishes: ['toor-dal'] },
  'd-dal-bhat|Rice': { dishes: ['rice'] },
  'd-paneer-bhurji|Salad and a vegetable side': SIDE,
  'd-paneer-bhurji|Paneer bhurji with onion and tomato': { dishes: ['paneer-bhurji'] },
  'd-paneer-bhurji|Whole-wheat or millet roti': ROTI,
  'd-egg-curry|Salad and a vegetable side': SIDE,
  'd-egg-curry|Egg curry': { dishes: ['egg-curry'] },
  'd-egg-curry|Whole-wheat or millet roti': ROTI,
  'd-chicken-stew|Vegetables in the stew, and a salad': { dishes: ['chicken-stew', SALAD] },
  'd-chicken-stew|Chicken': { dishes: ['chicken-stew'] },
  'd-chicken-stew|Rice': { dishes: ['rice'] },
};
```

- [ ] **Step 2: Write the failing tests.** First `src/content/mealDishes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { foodById } from '@/food/data';
import { MEALS } from './meals';
import { componentKey, MEAL_DISHES } from './mealDishes';

describe('meal ideas as dishes (B-13)', () => {
  it('maps every component of every meal idea, and nothing else', () => {
    const keys = MEALS.flatMap(m => m.components.map(c => componentKey(m.id, c.name)));
    expect(keys.filter(k => !MEAL_DISHES[k])).toEqual([]);
    expect(Object.keys(MEAL_DISHES).filter(k => !keys.includes(k))).toEqual([]);
  });
  it('names only dishes the food table has', () => {
    for (const [key, { dishes }] of Object.entries(MEAL_DISHES)) for (const id of dishes) expect(foodById(id), `${key}: ${id}`).toBeDefined();
  });
  it('says what a component with no dish may carry', () => {
    for (const [key, c] of Object.entries(MEAL_DISHES)) if (c.dishes.length === 0) expect(c.mayContain?.length, key).toBeGreaterThan(0);
  });
});
```

Then the week tests:
- In the block Plan 5 appended to `src/content/week.test.ts` ("setup’s food answers in meal ideas"):
  - delete the test "adds the typed foods, the allergens’ words and Jain’s rule, in that order", since `leaveOut` goes;
  - import only `JAIN_LEAVES_OUT` and `withPicked` from `./allergens`.
- Make sure `suits` is in the file's import from `./week`, and `Slot` in its type import from `./schema`.
- Append this block:

```ts
describe('allergies and the Jain pattern from recipe tags (B-13, board D99, D100)', () => {
  const ids = (f: FoodPreferences, slot?: Slot) => mealsFor(f, slot).map(m => m.id);
  it('leaves out every idea with an allergen, or one that may contain it', () => {
    expect(ids(food('vegetarian', { allergies: ['peanut'] }), 'breakfast')).not.toContain('b-poha');
    expect(ids(food('vegetarian', { allergies: ['peanut'] }), 'breakfast')).toContain('b-idli-sambar');
    // "A few seeds or nuts" may carry them.
    expect(ids(food('vegetarian', { allergies: ['peanut'] }), 'snack')).not.toContain('s-salad-seeds');
    expect(ids(food('vegetarian', { allergies: ['wheat'] }), 'lunch')).not.toContain('l-roti-dal-sabzi');
    // Sambar's hing may contain wheat, and "gluten" in the person's own words is wheat.
    expect(ids(food('vegetarian', { allergies: ['wheat'] }), 'breakfast')).not.toContain('b-idli-sambar');
    expect(ids(food('vegetarian', { customAllergies: ['gluten'] }), 'breakfast')).not.toContain('b-idli-sambar');
    expect(ids(food('vegetarian', { allergies: ['milk'] }), 'lunch')).not.toContain('l-roti-dal-sabzi');
  });
  it('keeps a custom allergy’s word out, through the dishes’ own ingredients (Review Focus 2)', () => {
    expect(ids(food('vegetarian', { customAllergies: ['drumstick'] }), 'breakfast')).not.toContain('b-idli-sambar');
    expect(ids(food('vegetarian', { customAllergies: ['drumstick'] }), 'breakfast')).toContain('b-poha');
    // Coconut isn't canonical (D99): it's matched by word, here in the chutney's coconut.
    expect(ids(food('vegetarian', { customAllergies: ['coconut'] }), 'breakfast')).not.toContain('b-idli-sambar');
  });
  it('matches a food left out against the meal’s own words, as v1 did, and an allergy against its recipes too (D99)', () => {
    expect(isAvoided(meal('l-rajma-rice'), ['garlic'])).toBe(false);
    expect(ids(food('vegetarian', { customAllergies: ['garlic'] }), 'lunch')).not.toContain('l-rajma-rice');
    expect(ids(food('vegetarian', { customAllergies: ['garlic'] }), 'lunch')).toContain('l-roti-dal-sabzi');
  });
  it('offers a Jain plate only ideas without root vegetables, eggs, fish or meat', () => {
    const jain = food('jain');
    expect(ids(jain, 'breakfast')).toEqual(['b-dalia']);
    expect(ids(jain, 'lunch')).toEqual(['l-roti-dal-sabzi']);
    expect(ids(jain, 'snack')).toEqual(['s-roasted-chana', 's-fruit', 's-chaas']);
    expect(ids(jain, 'dinner')).toEqual(['d-khichdi', 'd-millet-roti-dal', 'd-dal-bhat']);
    // Kanda poha is onion poha; sambar and the palak paneer recipe have onion.
    expect(suits(meal('b-poha'), 'jain')).toBe(false);
    expect(suits(meal('b-idli-sambar'), 'jain')).toBe(false);
    expect(suits(meal('l-palak-paneer'), 'jain')).toBe(false);
  });
  it('fills a Jain sample week from those ideas', () => {
    for (const day of sampleWeek(food('jain'))) expect(Object.keys(day.meals).sort()).toEqual(['breakfast', 'dinner', 'lunch', 'snack']);
  });
});
```

- [ ] **Step 3: Run them to check they fail**

Run: `npx vitest run src/content/mealDishes.test.ts src/content/week.test.ts`
Expected: the map tests pass. The new week tests FAIL: custom allergies and recipe tags aren't read yet.

- [ ] **Step 4: The filter.**
  - Replace `src/content/allergens.ts` with:

    ```ts
    /**
     * The food choices meal ideas read beside the recipe tags: the words a
     * Jain plate leaves out (board D100), the pattern v1's templates were
     * written for, and the picker's answers merged into what setup stored.
     * Allergens are matched by each idea's recipe tags (`@/food/allergens`,
     * B-13), which replaced Plan 5's interim word lists.
     */
    import type { AllergenId, FoodPattern, FoodPreferences } from '@/types/profile';
    import type { Region } from './schema';

    /** Words a Jain plate leaves out (D100): root vegetables and bulbs, eggs, fish, meat and honey, in English, Hinglish and Hindi. */
    export const JAIN_LEAVES_OUT: readonly string[] = [
      'onion', 'kanda', 'pyaz', 'pyaaz', 'garlic', 'lahsun', 'lehsun', 'potato', 'aloo', 'alu', 'batata', 'carrot', 'gajar',
      'beetroot', 'beet', 'radish', 'mooli', 'ginger', 'adrak', 'yam', 'arbi', 'egg', 'anda', 'fish', 'machli', 'chicken',
      'murgh', 'murga', 'meat', 'mutton', 'prawn', 'honey', 'shahad',
      'प्याज', 'लहसुन', 'आलू', 'अदरक', 'गाजर', 'मूली', 'अंडा', 'मछली', 'शहद',
    ];

    /** The pattern v1's meal templates are tagged with: Jain food is chosen from the vegetarian ones. */
    export function mealPattern(p: FoodPattern | undefined): Exclude<FoodPattern, 'jain'> | undefined {
      return p === 'jain' ? 'vegetarian' : p;
    }

    /**
     * Meal ideas' own food question, answered: it changes what it asks and
     * keeps the rest of what was stored (the level, the screening answer, a
     * target). The picker's allergies replace the stored ones when it gives them.
     */
    export function withPicked(food: FoodPreferences | undefined, picked: {
      pattern: FoodPattern;
      avoid: string[];
      region: Region | 'any';
      allergies?: AllergenId[];
      customAllergies?: string[];
    }): FoodPreferences {
      const next: FoodPreferences = { ...food, pattern: picked.pattern, avoid: picked.avoid };
      if (picked.region === 'any') delete next.region;
      else next.region = picked.region;
      // Kept even when empty: setup reads an empty list as "answered: none".
      if (picked.allergies !== undefined) next.allergies = [...picked.allergies];
      if (picked.customAllergies !== undefined) {
        if (picked.customAllergies.length > 0) next.customAllergies = [...picked.customAllergies];
        else delete next.customAllergies;
      }
      return next;
    }
    ```

  - In `src/content/week.ts`, change the imports to:

    ```ts
    import { allergiesOf, recommendable, type AllergenTags } from '@/food/allergens';
    import { foodById } from '@/food/data';
    import type { AllergenId, FoodPreferences } from '@/types/profile';
    import { JAIN_LEAVES_OUT, mealPattern } from './allergens';
    import { MEALS } from './meals';
    import { componentKey, MEAL_DISHES } from './mealDishes';
    import type { MealComponent, MealTemplate, Pattern, Slot } from './schema';
    import { tokens } from './text';
    ```

  - Replace `componentsFor`, `suits` and `isAvoided` with the following, which adds `mealTags` and `mealAllowed`:

    ```ts
    /** The folded words a Jain plate leaves out. */
    const JAIN_WORDS = new Set(JAIN_LEAVES_OUT.flatMap(tokens));

    /** The parts of a meal this person eats: a vegan's plate has no dahi. */
    export function componentsFor(meal: MealTemplate, pattern?: Pattern): MealComponent[] {
      const p = mealPattern(pattern);
      return p ? meal.components.filter(c => !c.notFor?.includes(p)) : meal.components;
    }

    /** Every word a template, and the components this person would eat, go by. */
    function ownWords(meal: MealTemplate, pattern?: Pattern): Set<string> {
      return new Set([meal.name, ...meal.aliases, ...componentsFor(meal, pattern).flatMap(c => [c.name, ...(c.aliases ?? [])])].flatMap(tokens));
    }

    /** The dishes a component this person eats is, from the map. */
    const dishesOf = (meal: MealTemplate, c: MealComponent) => MEAL_DISHES[componentKey(meal.id, c.name)];

    /**
     * Whether a template suits an eating pattern. A Jain plate is a vegetarian
     * one whose words name nothing Jain cooking leaves out, and whose dishes
     * all suit it (D100). Other patterns are as the templates were written.
     */
    export function suits(meal: MealTemplate, pattern?: Pattern): boolean {
      const p = mealPattern(pattern);
      if (p === undefined) return true;
      if (!meal.patterns.includes(p)) return false;
      if (pattern !== 'jain') return true;
      if ([...ownWords(meal, pattern)].some(w => JAIN_WORDS.has(w))) return false;
      return componentsFor(meal, pattern).every(c => (dishesOf(meal, c)?.dishes ?? []).every(id => foodById(id)?.patterns.includes('jain') === true));
    }

    /**
     * A template's allergen tags (B-13): its components' dishes, what a
     * component with no dish may carry, and every word it and its dishes go
     * by. A component the map doesn't know leaves the template not fully tagged.
     */
    export function mealTags(meal: MealTemplate, pattern?: Pattern): AllergenTags {
      const contains = new Set<AllergenId>();
      const may = new Set<AllergenId>();
      const words = ownWords(meal, pattern);
      let complete = true;
      for (const c of componentsFor(meal, pattern)) {
        const mapped = dishesOf(meal, c);
        if (!mapped) {
          complete = false;
          continue;
        }
        for (const a of mapped.mayContain ?? []) may.add(a);
        for (const id of mapped.dishes) {
          const dish = foodById(id);
          if (!dish) {
            complete = false;
            continue;
          }
          for (const a of dish.allergens.contains) contains.add(a);
          for (const a of dish.allergens.mayContain) may.add(a);
          if (!dish.allergens.complete) complete = false;
          for (const w of dish.words) words.add(w);
        }
      }
      return { contains: [...contains], mayContain: [...may].filter(a => !contains.has(a)), complete, words: [...words] };
    }

    /**
     * Whether the person asked to leave out something in this meal. Matching is
     * by word, after the same plural folding search uses, against the meal's
     * names and every component they would eat, as in v1: "peanut" hides poha
     * with peanuts, "nut" doesn't hide coconut, and "coconut milk" names no
     * meal (audit R04). Only an allergy goes into each dish's ingredients (D99).
     */
    export function isAvoided(meal: MealTemplate, avoid: readonly string[] = [], pattern?: Pattern): boolean {
      if (avoid.length === 0) return false;
      const words = ownWords(meal, pattern);
      return avoid.some(term => {
        const wanted = tokens(term);
        return wanted.length > 0 && wanted.every(w => words.has(w));
      });
    }

    /** Every filter for one person (A-16, B-13): the pattern, the foods they leave out, and their allergies. */
    export function mealAllowed(meal: MealTemplate, food?: FoodPreferences): boolean {
      return suits(meal, food?.pattern)
        && !isAvoided(meal, food?.avoid, food?.pattern)
        && recommendable(mealTags(meal, food?.pattern), allergiesOf(food));
    }
    ```

  - In `mealsFor`, delete `const out = leaveOut(food);`, and make the pool's filter `(slot === undefined || m.slot === slot) && mealAllowed(m, food)`.
  - In `src/content/search.ts`:
    - import `mealAllowed` from `./week`, and drop `isAvoided` and `leaveOut` from its imports if nothing else there uses them;
    - make the meals' filter `.filter(d => mealAllowed(MEALS.find(m => m.id === d.id)!, ctx.food))`.
  - In `src/content/index.ts`, add `mealAllowed` and `mealTags` to the exports from `./week`, and drop any re-export of `leaveOut` or `ALLERGEN_TERMS`.
  - Run `grep -rn "leaveOut\|ALLERGEN_TERMS" src`. Only the next step's `MealDetailScreen.tsx` may still name either.

- [ ] **Step 5: Run the content tests**

Run: `npx vitest run src/content`
Expected: PASS. That includes v1's own week, search and audit tests and Plan 5's food-answer tests, unchanged:
- "nut" still doesn't hide coconut chutney;
- a vegan's roti-dal-sabzi still has no dahi to leave out;
- `unmatchedAvoid` still says "coconut milk" matches no meal (audit R04), because a food left out is matched only against the meal's own words;
- setup's peanut, milk and egg allergies still hide poha, palak paneer and egg bhurji, now through their recipes.

- [ ] **Step 6: v2 addresses, and allergies on the idea screens**
  - `MealIdeasScreen.tsx`:
    - set the screen's Back to `{ to: '/hub/food', label: 'Food' }`;
    - point the Sample week row at `/hub/food/week`, with `state={{ from: 'ideas' }}`;
    - make each idea row's `to` `` `/hub/food/ideas/${m.id}` ``;
    - make the empty slot's row `label={FOOD_COPY.noIdeas} detail={FOOD_COPY.noIdeasDetail}`.
  - `MealDetailScreen.tsx`:
    - redirect a missing meal to `/hub/food/ideas`;
    - set `back` from `from`: `'search'` gives `{ to: '/hub/learn', label: 'Learn' }`, `'week'` gives `{ to: '/hub/food/week', label: 'Sample week' }`, `'hub'` gives `{ to: '/hub/food', label: 'Food' }`, and anything else gives `{ to: '/hub/food/ideas', label: 'Meal ideas' }`;
    - make the lead's last part `{food && !mealAllowed(meal, food) ? ' · Outside the food choices you gave' : ''}`, in place of Plan 5's `suits` and `leaveOut` test. Import `mealAllowed` and `mealTags` from `@/content`, `allergenList` from `@/food/allergens`, `FOOD_COPY` from `@/food/copy` and `Row` beside `Group`, and drop the `leaveOut` and `isAvoided` imports;
    - add this group after "On the plate", with `const tags = mealTags(meal, pattern);`:

    ```tsx
    <Group header="Allergens in our recipes" footer={FOOD_COPY.recipeNote}>
      <Row
        label={tags.contains.length > 0 ? FOOD_COPY.contains(allergenList(tags.contains)) : FOOD_COPY.noTaggedAllergens}
        {...(tags.mayContain.length > 0 ? { detail: FOOD_COPY.mayContain(allergenList(tags.mayContain)) } : {})}
      />
    </Group>
    ```

  - `SampleWeekScreen.tsx`:
    - set Back to `{ to: '/hub/food', label: 'Food' }` when `useLocation().state?.from === 'hub'`, and to `{ to: '/hub/food/ideas', label: 'Meal ideas' }` otherwise;
    - point each meal link at `` `/hub/food/ideas/${meal.id}` ``, with `state={{ from: 'week' }}`;
    - make the empty row's detail `FOOD_COPY.noIdeaLeft(slot.title)`.
  - `FoodPicker.tsx`:
    - import `ALLERGENS` from `@/food/allergens`, `FOOD_COPY` from `@/food/copy`, `CheckRows` from `@/screens/you/controls` and `type AllergenId` from `@/types/profile`;
    - make the Jain row's detail `'Dairy, but no eggs, fish, meat or honey, and no root vegetables such as onion, garlic or potato'` (D100);
    - after the pattern, add an "Allergies (optional)" group, `CheckRows` from `@/screens/you/controls` over `ALLERGENS.map(a => ({ value: a.id, label: a.label }))`;
    - below it add a "Something else" text field, with the placeholder `FOOD_COPY.somethingElsePlaceholder` and `FOOD_COPY.allergiesFooter` beneath;
    - keep the chips in `const [chosen, setChosen] = useState<AllergenId[]>(food?.allergies ?? [])` and the field in `const [otherAllergies, setOtherAllergies] = useState((food?.customAllergies ?? []).join(', '))`;
    - in `submit`, build `next` as `withPicked(food, { pattern, avoid: parseAvoid(avoid), region, allergies: chosen, customAllergies: parseAvoid(otherAllergies) })`.
  - `src/screens/guide/format.ts`, in `foodSummary`, after the region (import `allergenName` from `@/food/allergens`):

    ```ts
    const allergies = [...(food.allergies ?? []).map(allergenName), ...(food.customAllergies ?? [])];
    if (allergies.length > 0) parts.push(`allergic to ${allergies.join(', ')}`);
    ```

    Append to `format.test.ts`:

    ```ts
    it('names allergies in the summary of what the person eats', () => {
      expect(foodSummary({ pattern: 'jain', avoid: [], allergies: ['peanut'], customAllergies: ['brinjal'] })).toBe('Jain · allergic to peanut, brinjal');
    });
    ```

- [ ] **Step 7: Check by eye.** Run `npm run dev` and open `#/hub/food/ideas` at 428×926 and 320×568:
  - with Peanuts ticked in the picker, "Vegetable poha" is gone from Breakfast, and an idea's page shows "Allergens in our recipes";
  - with Jain, Breakfast shows only "Vegetable dalia with moong";
  - Back on Meal ideas says "Food".

- [ ] **Step 8: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/content src/screens/guide
git commit -m "feat: Filter meal ideas by their recipes' allergens and the Jain pattern"
```

---

### Task 8: Food records, and their rules in the store

**Files:**
- Create: `src/food/records.ts`, `src/food/records.test.ts`
- Modify: `src/store/records.ts` (Plan 6's: the three food rules), `src/store/records.test.ts` (Plan 6's placeholder case)
- Modify: `src/store/useStore.ts` (export `freshId`; add `writeRecords`)
- Create: `src/food/store.ts`, `src/food/store.test.ts`

**Interfaces:**
- Consumes:
  - `MealRecord`, `MealEdit`, `MealItem`, `SavedMeal`, `CustomFood` and `Slot` (Task 4); `isUnitId` (Task 4);
  - Plan 6's `RECORD_RULES`, `RECORD_STORES`, `recordKey`, `recordProblem`, `type Records`, `type RecordStore`, `type StoredRecord`, `putRecords` and `removeRecords`;
  - `isAt` from `@/health/observation`, `ALLERGEN_IDS` from `@/types/profile`.
- Produces:
  - `src/food/records.ts`:
    - `MEAL_LIMITS = { items: 40, edits: 50, name: 80 }`;
    - `itemProblem(x: unknown): string | undefined`;
    - `mealProblem(r: StoredRecord)`, `savedMealProblem(r: StoredRecord)` and `customFoodProblem(r: StoredRecord)`, each `string | undefined`;
    - `newerMeal(here: StoredRecord, file: StoredRecord): number` and `newerByUpdate(here, file): number`, Plan 6's `newer`;
    - `mealsIn(records: Pick<Records, 'meals'>): readonly MealRecord[]`, `savedMealsIn(records: Pick<Records, 'savedMeals'>): readonly SavedMeal[]` and `customFoodsIn(records: Pick<Records, 'customFoods'>): readonly CustomFood[]`;
    - `corrected(meal: MealRecord, next: Pick<MealRecord, 'at' | 'meal' | 'items'>, now: string): MealRecord`;
    - `restored<T extends { id: string }>(record: T, id: string): T & { restoredFrom: string }`;
    - `stored(r: MealRecord | SavedMeal | CustomFood): StoredRecord`.
  - `src/store/useStore.ts`: `export function freshId(prefix?: string): string` (already there, now exported), and `writeRecords(write: { put?: Partial<Record<RecordStore, readonly StoredRecord[]>>; remove?: Partial<Record<RecordStore, readonly string[]>> }): Promise<StoreResult>`.
  - `src/food/store.ts`:
    - `newMealId()`, `newUsualId()` and `newCustomId()`, each `string`;
    - `saveMeal(meal: MealRecord, extras?: { usual?: SavedMeal; customFoods?: readonly CustomFood[] }): Promise<StoreResult>`;
    - `saveCorrection(meal: MealRecord, customFoods?: readonly CustomFood[]): Promise<StoreResult>`;
    - `deleteMeal(id: string): Promise<StoreResult>` and `restoreMeal(meal: MealRecord): Promise<StoreResult<MealRecord>>`;
    - `deleteUsual(id: string): Promise<StoreResult>` and `restoreUsual(usual: SavedMeal): Promise<StoreResult<SavedMeal>>`.

- [ ] **Step 1: Write the failing test** `src/food/records.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { RECORD_RULES, recordProblem } from '@/store/records';
import type { CustomFood, MealRecord, SavedMeal } from './types';
import {
  corrected, customFoodProblem, itemProblem, mealProblem, mealsIn, newerByUpdate, newerMeal, restored, savedMealProblem, stored,
} from './records';

const AT = '2026-10-08T13:10:00.000+05:30';
const roti = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40, kcal: 204, carbsG: 43.2, carbsLowG: 31.1, carbsHighG: 57 } as const;
const base: MealRecord = { id: 'meal-1', at: AT, day: '2026-10-08', meal: 'lunch', items: [roti], level: 'estimates', loggedAt: AT, edits: [] };
const meal = (over: Record<string, unknown> = {}) => ({ ...stored(base), ...over });

describe('a meal record (journey §18.2, B-12)', () => {
  it('keeps each item with its recipe revision, unit, grams and estimate (D104)', () => {
    expect(mealProblem(meal())).toBeUndefined();
    expect(recordProblem('meals', meal())).toBeUndefined();
  });
  it('refuses what a meal could not hold', () => {
    const bad = (over: Record<string, unknown>) => mealProblem(meal(over));
    expect(bad({ at: '2026-10-08 13:10' })).toMatch(/when it was eaten/);
    expect(bad({ day: '2026-10-07' })).toMatch(/day/);
    expect(bad({ meal: 'brunch' })).toMatch(/breakfast, lunch/);
    expect(bad({ level: 'ideas' })).toMatch(/level/);
    expect(bad({ items: [] })).toMatch(/between 1 and 40/);
    expect(bad({ items: [{ ...roti, rev: 0 }] })).toMatch(/recipe/);
    expect(bad({ items: [{ ...roti, count: 0.3 }] })).toMatch(/portion/);
    expect(bad({ items: [{ ...roti, unit: 'bucket' }] })).toMatch(/portion/);
    expect(bad({ items: [{ ...roti, carbsLowG: 50 }] })).toMatch(/range/);
    expect(bad({ items: [{ kind: 'quick', size: 'small', name: 'Small plate', carbsG: 30 }] })).toMatch(/never has carbs/);
    expect(bad({ items: [{ kind: 'mystery', name: 'X' }] })).toMatch(/kind/);
    expect(bad({ edits: [{ replacedAt: AT, at: AT, meal: 'lunch', items: [roti] }] })).toMatch(/when it was corrected/);
  });
  it('takes an unknown figure as unknown, never as 0 (A-17)', () => {
    expect(itemProblem({ kind: 'custom', customId: 'food-1', name: 'Bhel puri', count: 1 })).toBeUndefined();
    expect(itemProblem({ kind: 'quick', size: 'normal', name: 'Normal plate' })).toBeUndefined();
  });
});

describe('usual meals and own foods', () => {
  const usual: SavedMeal = { id: 'usual-1', name: 'Weekday lunch', meal: 'lunch', items: [roti], savedAt: AT, updatedAt: AT };
  const own: CustomFood = { id: 'food-1', name: 'Bhel puri', per: { qty: 1, unit: 'plate' }, createdAt: AT, updatedAt: AT };
  it('are read whole, or refused with the reason', () => {
    expect(savedMealProblem(stored(usual))).toBeUndefined();
    expect(savedMealProblem({ ...stored(usual), name: '' })).toMatch(/name/);
    expect(customFoodProblem(stored(own))).toBeUndefined();
    expect(customFoodProblem({ ...stored(own), kcal: -1 })).toMatch(/figure/);
    expect(customFoodProblem({ ...stored(own), allergens: ['coconut'] })).toMatch(/allergen/);
    expect(customFoodProblem({ ...stored(own), per: { qty: 0, unit: 'plate' } })).toMatch(/portion/);
  });
  it('fill Plan 6’s three food rules', () => {
    expect(RECORD_RULES.meals).toMatchObject({ keyPath: 'id', backup: 'always', problem: mealProblem, newer: newerMeal });
    expect(RECORD_RULES.savedMeals).toMatchObject({ keyPath: 'id', backup: 'always', problem: savedMealProblem, newer: newerByUpdate });
    expect(RECORD_RULES.customFoods).toMatchObject({ keyPath: 'id', backup: 'always', problem: customFoodProblem, newer: newerByUpdate });
  });
});

describe('two copies of one meal, in a merge (journey §18.3)', () => {
  it('keep the one changed last, and call equal times a conflict', () => {
    const later = meal({ editedAt: '2026-10-08T15:00:00.000+05:30', edits: [{ replacedAt: '2026-10-08T15:00:00.000+05:30', at: AT, meal: 'lunch', items: [roti] }] });
    expect(newerMeal(meal(), later)).toBe(1);
    expect(newerMeal(later, meal())).toBe(-1);
    expect(newerMeal(meal(), meal({ items: [{ ...roti, count: 3 }] }))).toBe(0);
  });
});

describe('corrections and restores (A-22, B-05)', () => {
  it('keep the version a correction replaced, and leave an unchanged meal alone', () => {
    const next = corrected(base, { at: AT, meal: 'lunch', items: [{ ...roti, count: 3 }] }, '2026-10-08T15:00:00.000+05:30');
    expect(next).toMatchObject({ id: 'meal-1', editedAt: '2026-10-08T15:00:00.000+05:30' });
    expect(next.edits).toEqual([{ replacedAt: '2026-10-08T15:00:00.000+05:30', at: AT, meal: 'lunch', items: [roti] }]);
    expect(corrected(base, { at: AT, meal: 'lunch', items: [roti] }, '2026-10-08T15:00:00.000+05:30')).toBe(base);
  });
  it('move a dinner corrected past midnight onto its new day, keeping its id (Review Focus 4)', () => {
    const next = corrected(base, { at: '2026-10-09T00:20:00.000+05:30', meal: 'dinner', items: base.items }, '2026-10-09T08:00:00.000+05:30');
    expect(next).toMatchObject({ id: 'meal-1', day: '2026-10-09', meal: 'dinner' });
    expect(mealProblem(stored(next))).toBeUndefined();
  });
  it('restore under a fresh id, naming the one it came from', () => {
    expect(restored(base, 'meal-2')).toMatchObject({ id: 'meal-2', restoredFrom: 'meal-1', items: base.items });
  });
});

describe('reading what the store holds', () => {
  it('passes over a row this version can’t read, and works it out once per list', () => {
    const list = [meal(), { id: 'meal-x' }];
    const first = mealsIn({ meals: list });
    expect(first.map(m => m.id)).toEqual(['meal-1']);
    expect(mealsIn({ meals: list })).toBe(first);
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/food/records.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write** `src/food/records.ts`

```ts
/**
 * Food records as the store keeps them (journey §18.2, B-05, B-12; board
 * D104). Each rule says what a meal, a usual meal or a person's own food must
 * hold to be read, and which of two copies a merge keeps. A correction keeps
 * the version it replaced, and a restore uses a fresh id. Plan 6's registry
 * calls these for every put and every imported row.
 *
 * Kept free of the food table and of the store, so the registry, Home and the
 * reminder host can import it.
 */
import { isAt } from '@/health/observation';
import type { Records, StoredRecord } from '@/store/records';
import { ALLERGEN_IDS } from '@/types/profile';
import type { CustomFood, MealEdit, MealRecord, SavedMeal, Slot } from './types';
import { isUnitId } from './units';

export const MEAL_LIMITS = { items: 40, edits: 50, name: 80 } as const;

const SLOTS: readonly Slot[] = ['breakfast', 'lunch', 'snack', 'dinner'];
const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isSlot = (x: unknown): x is Slot => typeof x === 'string' && (SLOTS as readonly string[]).includes(x);
const isText = (x: unknown, max: number = MEAL_LIMITS.name): x is string => typeof x === 'string' && x.trim() !== '' && x.length <= max;
const isAmount = (x: unknown, max: number): x is number => typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= max;
/** A count the stepper can reach: halves, from ½ to 20. */
const isCount = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0 && x <= 20 && Number.isInteger(x * 2);
const optional = (x: unknown, check: (v: unknown) => boolean) => x === undefined || check(x);

/** Why a logged item can't be read, or nothing. */
export function itemProblem(x: unknown): string | undefined {
  if (!isObject(x)) return 'an item is not an object';
  if (!isText(x.name)) return 'an item needs its name';
  const name = x.name;
  if (!optional(x.kcal, v => isAmount(v, 10_000))) return `${name}: an impossible kcal figure`;
  if (!optional(x.carbsG, v => isAmount(v, 2_000))) return `${name}: an impossible carb figure`;
  switch (x.kind) {
    case 'food': {
      if (!isText(x.foodId) || !(typeof x.rev === 'number' && Number.isInteger(x.rev) && x.rev >= 1)) return `${name}: the recipe it was worked out from is missing`;
      if (!isUnitId(x.unit) || !isCount(x.count) || !isAmount(x.gramsPerPortion, 2_000) || x.gramsPerPortion === 0) return `${name}: an impossible portion`;
      if (!optional(x.weighed, v => v === true)) return `${name}: an impossible portion`;
      if (!optional(x.carbsLowG, v => isAmount(v, 2_000)) || !optional(x.carbsHighG, v => isAmount(v, 2_000))) return `${name}: an impossible carb range`;
      const { carbsG, carbsLowG, carbsHighG } = x;
      if (typeof carbsG === 'number' && typeof carbsLowG === 'number' && typeof carbsHighG === 'number' && !(carbsLowG <= carbsG && carbsG <= carbsHighG)) {
        return `${name}: a carb range that doesn’t hold its estimate`;
      }
      return undefined;
    }
    case 'custom':
      return isText(x.customId) && isCount(x.count) ? undefined : `${name}: an impossible portion of your own food`;
    case 'quick':
      if (x.size !== 'small' && x.size !== 'normal' && x.size !== 'large') return `${name}: a quick add needs its size`;
      return x.carbsG === undefined ? undefined : `${name}: a quick add never has carbs`;
    default:
      return 'an item of a kind this version doesn’t know';
  }
}

function itemsProblem(items: unknown): string | undefined {
  if (!Array.isArray(items) || items.length === 0 || items.length > MEAL_LIMITS.items) return `a meal holds between 1 and ${MEAL_LIMITS.items} items`;
  for (const item of items) {
    const problem = itemProblem(item);
    if (problem) return problem;
  }
  return undefined;
}

/** Why a stored or imported meal can't be read, or nothing (journey §18.3). */
export function mealProblem(r: StoredRecord): string | undefined {
  if (!isText(r.id)) return 'a meal needs its id';
  if (!isAt(r.at)) return 'a meal needs when it was eaten, ISO with an offset';
  if (r.day !== r.at.slice(0, 10)) return 'a meal’s day must be the day it was eaten';
  if (!isSlot(r.meal)) return 'a meal needs breakfast, lunch, a snack or dinner';
  if (r.level !== 'meals' && r.level !== 'estimates') return 'a meal needs the level it was logged at';
  if (!isAt(r.loggedAt) || !optional(r.editedAt, isAt)) return 'a meal needs when it was logged, and when it was corrected';
  if (!optional(r.restoredFrom, v => isText(v))) return 'a restored meal needs the id it came back from';
  const items = itemsProblem(r.items);
  if (items) return items;
  if (!Array.isArray(r.edits) || r.edits.length > MEAL_LIMITS.edits) return `a meal keeps at most ${MEAL_LIMITS.edits} earlier versions`;
  for (const e of r.edits) {
    if (!isObject(e) || !isAt(e.replacedAt) || !isAt(e.at) || !isSlot(e.meal)) return 'an earlier version of a meal can’t be read';
    const problem = itemsProblem(e.items);
    if (problem) return problem;
  }
  if (r.edits.length > 0 && r.editedAt === undefined) return 'a corrected meal needs when it was corrected';
  return undefined;
}

/** Why a usual meal can't be read, or nothing. */
export function savedMealProblem(r: StoredRecord): string | undefined {
  if (!isText(r.id)) return 'a usual meal needs its id';
  if (!isText(r.name, 60)) return 'a usual meal needs a name of 1 to 60 characters';
  if (!optional(r.meal, isSlot)) return 'a usual meal’s meal must be breakfast, lunch, a snack or dinner';
  if (!isAt(r.savedAt) || !isAt(r.updatedAt)) return 'a usual meal needs when it was saved';
  if (!optional(r.restoredFrom, v => isText(v))) return 'a restored usual meal needs the id it came back from';
  return itemsProblem(r.items);
}

/** Why one of the person's own foods can't be read, or nothing. */
export function customFoodProblem(r: StoredRecord): string | undefined {
  if (!isText(r.id)) return 'your own food needs its id';
  if (!isText(r.name, 60)) return 'your own food needs a name of 1 to 60 characters';
  const per = r.per;
  if (!isObject(per) || !(typeof per.qty === 'number' && per.qty > 0 && per.qty <= 10_000) || !isText(per.unit, 20)) return `${r.name}: what one portion is can’t be read`;
  if (!optional(r.kcal, v => isAmount(v, 5_000)) || !optional(r.carbsG, v => isAmount(v, 1_000))) return `${r.name}: an impossible figure`;
  if (!optional(r.allergens, v => Array.isArray(v) && v.every(a => (ALLERGEN_IDS as readonly unknown[]).includes(a)))) return `${r.name}: an allergen this version doesn’t know`;
  if (!isAt(r.createdAt) || !isAt(r.updatedAt)) return `${r.name}: when it was added can’t be read`;
  return undefined;
}

/** The latest of these instants on a record. */
function lastChange(r: StoredRecord, keys: readonly string[]): number {
  let latest = -Infinity;
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'string') latest = Math.max(latest, Date.parse(v));
  }
  return latest;
}

/** Plan 6's `newer`: >0 takes the file's copy, <0 keeps this phone's, 0 is a conflict. */
const byLatest = (keys: readonly string[]) => (here: StoredRecord, file: StoredRecord): number =>
  Math.sign(lastChange(file, keys) - lastChange(here, keys)) || 0;

/** The copy corrected (or logged) last. */
export const newerMeal = byLatest(['editedAt', 'loggedAt']);
/** The copy changed last: a usual meal, or the person's own food. */
export const newerByUpdate = byLatest(['updatedAt']);

const readable = new WeakMap<readonly StoredRecord[], readonly StoredRecord[]>();

/** The rows of a store this version can read, worked out once per list. */
function readableIn(list: readonly StoredRecord[], problem: (r: StoredRecord) => string | undefined): readonly StoredRecord[] {
  let kept = readable.get(list);
  if (!kept) {
    kept = list.filter(r => problem(r) === undefined);
    readable.set(list, kept);
  }
  return kept;
}

export const mealsIn = (records: Pick<Records, 'meals'>): readonly MealRecord[] =>
  readableIn(records.meals, mealProblem) as unknown as readonly MealRecord[];
export const savedMealsIn = (records: Pick<Records, 'savedMeals'>): readonly SavedMeal[] =>
  readableIn(records.savedMeals, savedMealProblem) as unknown as readonly SavedMeal[];
export const customFoodsIn = (records: Pick<Records, 'customFoods'>): readonly CustomFood[] =>
  readableIn(records.customFoods, customFoodProblem) as unknown as readonly CustomFood[];

/**
 * A meal as corrected (A-22): the new time, meal and items, with the version
 * it replaces kept in `edits`. Moved past midnight, it moves to that day
 * (Review Focus 4). Unchanged, it's the same meal.
 */
export function corrected(meal: MealRecord, next: Pick<MealRecord, 'at' | 'meal' | 'items'>, now: string): MealRecord {
  if (meal.at === next.at && meal.meal === next.meal && JSON.stringify(meal.items) === JSON.stringify(next.items)) return meal;
  const before: MealEdit = { replacedAt: now, at: meal.at, meal: meal.meal, items: meal.items };
  return {
    ...meal, at: next.at, day: next.at.slice(0, 10), meal: next.meal, items: next.items, editedAt: now,
    edits: [...meal.edits, before].slice(-MEAL_LIMITS.edits),
  };
}

/** A deleted record brought back by Undo, under a fresh id (B-05). The original's deletion record stays. */
export function restored<T extends { id: string }>(record: T, id: string): T & { restoredFrom: string } {
  return { ...record, id, restoredFrom: record.id };
}

/** A food record as the store's registry types it. */
export const stored = (r: MealRecord | SavedMeal | CustomFood): StoredRecord => r as unknown as StoredRecord;
```

- [ ] **Step 4: Fill Plan 6's food rules.** In `src/store/records.ts`:
  - import `customFoodProblem`, `mealProblem`, `newerByUpdate`, `newerMeal` and `savedMealProblem` from `@/food/records`. It's a cycle by type only (`@/food/records` imports this file's types), so it's harmless;
  - replace the three placeholder entries with:

    ```ts
      meals: { keyPath: 'id', label: { one: 'meal', many: 'meals' }, limit: 200_000, backup: 'always', problem: mealProblem, newer: newerMeal },
      savedMeals: { keyPath: 'id', label: { one: 'usual meal', many: 'usual meals' }, limit: 10_000, backup: 'always', problem: savedMealProblem, newer: newerByUpdate },
      customFoods: { keyPath: 'id', label: { one: 'own food', many: 'own foods' }, limit: 10_000, backup: 'always', problem: customFoodProblem, newer: newerByUpdate },
    ```

  - delete the `notYet` helper, which nothing uses now.

  In `src/store/records.test.ts`, Plan 6's case "refuse food records until Plan 7 gives them their rules" becomes:

  ```ts
    it('refuse a food record they can’t read, saying why (Plan 7)', () => {
      expect(recordProblem('meals', { id: 'm1' })).toMatch(/when it was eaten/);
    });
  ```

  Plan 6's transfer case, "refuses food records until Plan 7 can read them", still passes unchanged: `{ id: 'm1' }` is still unreadable. Rename it "refuses a food record it can’t read".

- [ ] **Step 5: Run the record tests**

Run: `npx vitest run src/food/records.test.ts src/store/records.test.ts src/store/transfer.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing store test** `src/food/store.test.ts`. It boots the real store on the in-memory IndexedDB, as `src/store/useStore.test.ts` does.

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { decode } from '@/store/transfer';
import type { CustomFood, MealRecord, SavedMeal } from './types';

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
const food = await import('./store');
const { corrected, customFoodsIn, mealsIn, savedMealsIn } = await import('./records');

const AT = '2026-10-08T13:10:00.000+05:30';
const roti = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40, kcal: 204, carbsG: 43.2, carbsLowG: 31.1, carbsHighG: 57 } as const;
const meal = (id: string, over: Partial<MealRecord> = {}): MealRecord =>
  ({ id, at: AT, day: '2026-10-08', meal: 'lunch', items: [roti], level: 'estimates', loggedAt: AT, edits: [], ...over });

async function booted() {
  await store.start({ factory: fakeIndexedDB(), broadcast: null });
}

beforeEach(() => {
  local.clear();
  store.resetForTests();
});

describe('saving a meal (journey §11.3, §4.5)', () => {
  it('saves one meal for a shaky double tap, not two (Review Focus 1)', async () => {
    await booted();
    const m = meal('meal-1');
    const [a, b] = await Promise.all([food.saveMeal(m), food.saveMeal(m)]);
    expect(a.ok && b.ok).toBe(true);
    expect(mealsIn(store.getState().records)).toEqual([m]);
  });

  it('saves a new usual meal and the person’s own foods with it, in one change', async () => {
    await booted();
    const own: CustomFood = { id: 'food-1', name: 'Bhel puri', per: { qty: 1, unit: 'plate' }, createdAt: AT, updatedAt: AT };
    const usual: SavedMeal = { id: 'usual-1', name: 'Bhel and roti', meal: 'lunch', items: [roti, { kind: 'custom', customId: 'food-1', name: 'Bhel puri', count: 1 }], savedAt: AT, updatedAt: AT };
    const m = meal('meal-1', { items: usual.items });
    expect((await food.saveMeal(m, { usual, customFoods: [own] })).ok).toBe(true);
    const records = store.getState().records;
    expect(mealsIn(records)).toEqual([m]);
    expect(savedMealsIn(records)).toEqual([usual]);
    expect(customFoodsIn(records)).toEqual([own]);
  });

  it('refuses a meal with nothing in it, and writes nothing', async () => {
    await booted();
    const result = await food.saveMeal(meal('meal-1', { items: [] }));
    expect(!result.ok && result.failure.code).toBe('invalid');
    expect(store.getState().records.meals).toEqual([]);
  });
});

describe('correcting, deleting and restoring (A-22, B-05)', () => {
  it('keeps the version a correction replaced, and moves the meal to the day it now belongs to (Review Focus 4)', async () => {
    await booted();
    const dinner = meal('meal-1', { at: '2026-10-07T23:30:00.000+05:30', day: '2026-10-07', meal: 'dinner' });
    await food.saveMeal(dinner);
    const later = corrected(dinner, { at: '2026-10-08T00:30:00.000+05:30', meal: 'dinner', items: dinner.items }, '2026-10-08T09:00:00.000+05:30');
    expect((await food.saveCorrection(later)).ok).toBe(true);
    const kept = mealsIn(store.getState().records);
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ id: 'meal-1', day: '2026-10-08', editedAt: '2026-10-08T09:00:00.000+05:30' });
    expect(kept[0].edits).toEqual([{ replacedAt: '2026-10-08T09:00:00.000+05:30', at: dinner.at, meal: 'dinner', items: dinner.items }]);
  });

  it('deletes at once, remembers the deletion, and brings the meal back under a fresh id', async () => {
    await booted();
    const m = meal('meal-1');
    await food.saveMeal(m);
    expect((await food.deleteMeal('meal-1')).ok).toBe(true);
    expect(store.getState().settings.deleted?.records?.meals).toEqual(['meal-1']);
    const back = await food.restoreMeal(m);
    if (!back.ok) throw back.failure;
    expect(back.value).toMatchObject({ restoredFrom: 'meal-1', items: m.items });
    expect(back.value.id).not.toBe('meal-1');
    expect(mealsIn(store.getState().records).map(x => x.id)).toEqual([back.value.id]);
    // The original's deletion record stays, so an older backup can't bring it back beside its copy (B-05).
    expect(store.getState().settings.deleted?.records?.meals).toEqual(['meal-1']);
  });
});

describe('meals in backups (journey §18.3)', () => {
  it('go into a backup and come back from it, history included', async () => {
    await booted();
    const m = corrected(meal('meal-1'), { at: AT, meal: 'lunch', items: [{ ...roti, count: 3 }] }, '2026-10-08T14:00:00.000+05:30');
    await food.saveMeal(m);
    const exported = await store.exportRecord();
    if (!exported.ok) throw exported.failure;
    expect(exported.value.stores).toEqual(['meals', 'savedMeals', 'customFoods']);
    const doc = await decode(exported.value.bytes);
    expect((doc as { records: { meals: unknown[] } }).records.meals).toEqual([m]);
    store.resetForTests();
    local.clear();
    await booted();
    expect((await store.importRecord(doc, 'replace')).ok).toBe(true);
    expect(mealsIn(store.getState().records)).toEqual([m]);
  });

  it('refuses a file holding a meal it can’t read, unless the person allows it', async () => {
    await booted();
    await food.saveMeal(meal('meal-1'));
    const exported = await store.exportRecord();
    if (!exported.ok) throw exported.failure;
    const doc = (await decode(exported.value.bytes)) as { records: { meals: unknown[] } };
    const bad = { ...doc, records: { ...doc.records, meals: [...doc.records.meals, { id: 'meal-2', at: 'yesterday' }] } };
    expect((await store.importRecord(bad, 'merge')).ok).toBe(false);
    expect((await store.importRecord(bad, 'merge', { allowRejected: true })).ok).toBe(true);
    expect(mealsIn(store.getState().records).map(x => x.id)).toEqual(['meal-1']);
  });
});
```

- [ ] **Step 7: Run it to check it fails**

Run: `npx vitest run src/food/store.test.ts`
Expected: FAIL. `./store` isn't found.

- [ ] **Step 8: Two store additions.** In `src/store/useStore.ts`:
  - make `freshId` exported (`export function freshId(prefix = ''): string`). It's already "made once, at the call", which is what a meal's id needs;
  - add `RECORD_STORES` to the import from `./records`;
  - add this after Plan 6's `removeRecords`:

```ts
/**
 * Records in several stores as one change (Plan 7): a meal saved with a new
 * usual meal and the person's own foods. Every put is checked first, and one
 * refusal writes nothing. Keys no longer stored are passed over.
 */
export function writeRecords(write: {
  put?: Partial<Record<RecordStore, readonly StoredRecord[]>>;
  remove?: Partial<Record<RecordStore, readonly string[]>>;
}): Promise<StoreResult> {
  return enqueue<void>({
    plan: base => {
      const refused: FailureDetail[] = [];
      const records: NonNullable<Change['records']> = {};
      for (const store of RECORD_STORES) {
        const put = write.put?.[store] ?? [];
        put.forEach((r, index) => {
          const problem = recordProblem(store, r);
          if (problem) refused.push({ index, ...(recordKey(store, r) ? { id: recordKey(store, r) } : {}), reason: `${RECORD_RULES[store].label.one} ${index + 1}: ${problem}` });
        });
        const wanted = new Set(write.remove?.[store] ?? []);
        const remove = base.records[store].map(r => recordKey(store, r)).filter(k => wanted.has(k));
        if (put.length > 0 || remove.length > 0) records[store] = { ...(put.length > 0 ? { put: [...put] } : {}), ...(remove.length > 0 ? { remove } : {}) };
      }
      if (refused.length > 0) throw new StoreFailure('invalid', `Nothing was saved. ${refused.map(d => d.reason).join('; ')}`, undefined, refused);
      return { change: Object.keys(records).length > 0 ? { records } : null, result: () => undefined };
    },
  });
}
```

- [ ] **Step 9: Write** `src/food/store.ts`

```ts
/**
 * The food actions (journey §11.3, §18.2): each one stored change, through
 * Plan 6's record stores. A meal's id is made once, when the sheet opens, so
 * a second tap on Save writes the same meal again rather than a second one
 * (Review Focus 1).
 */
import type { StoreResult } from '@/store/db';
import { freshId, putRecords, removeRecords, writeRecords } from '@/store/useStore';
import { restored, stored } from './records';
import type { CustomFood, MealRecord, SavedMeal } from './types';

export const newMealId = (): string => freshId('meal-');
export const newUsualId = (): string => freshId('usual-');
export const newCustomId = (): string => freshId('food-');

/** A new meal, with a usual meal and the person's own foods it was saved with, in one change. */
export function saveMeal(meal: MealRecord, extras: { usual?: SavedMeal; customFoods?: readonly CustomFood[] } = {}): Promise<StoreResult> {
  return writeRecords({
    put: {
      meals: [stored(meal)],
      ...(extras.usual ? { savedMeals: [stored(extras.usual)] } : {}),
      ...(extras.customFoods && extras.customFoods.length > 0 ? { customFoods: extras.customFoods.map(stored) } : {}),
    },
  });
}

/** A corrected meal (`corrected`), with any own foods added while correcting it. */
export function saveCorrection(meal: MealRecord, customFoods: readonly CustomFood[] = []): Promise<StoreResult> {
  return writeRecords({ put: { meals: [stored(meal)], ...(customFoods.length > 0 ? { customFoods: customFoods.map(stored) } : {}) } });
}

export const deleteMeal = (id: string): Promise<StoreResult> => removeRecords('meals', [id]);

/** Undo a meal's delete (B-05): the meal again, under a fresh id. */
export async function restoreMeal(meal: MealRecord): Promise<StoreResult<MealRecord>> {
  const back = restored(meal, newMealId());
  const result = await putRecords('meals', [stored(back)]);
  return result.ok ? { ok: true, value: back } : result;
}

export const deleteUsual = (id: string): Promise<StoreResult> => removeRecords('savedMeals', [id]);

/** Undo a usual meal's delete, under a fresh id. */
export async function restoreUsual(usual: SavedMeal): Promise<StoreResult<SavedMeal>> {
  const back = restored(usual, newUsualId());
  const result = await putRecords('savedMeals', [stored(back)]);
  return result.ok ? { ok: true, value: back } : result;
}
```

- [ ] **Step 10: Run the store tests**

Run: `npx vitest run src/food src/store`
Expected: PASS. Plan 6's store tests are unchanged.

- [ ] **Step 11: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/food/records.ts src/food/records.test.ts src/food/store.ts src/food/store.test.ts src/store/records.ts src/store/records.test.ts src/store/transfer.test.ts src/store/useStore.ts
git commit -m "feat: Keep meals, usual meals and own foods as validated records with history"
```

---

### Task 9: The tray, usual meals, food search and the week

**Files:**
- Create: `src/food/tray.ts`, `src/food/tray.test.ts`
- Create: `src/food/usual.ts`, `src/food/usual.test.ts`
- Create: `src/food/search.ts`, `src/food/search.test.ts`
- Create: `src/food/days.ts`, `src/food/days.test.ts`

**Interfaces:**
- Consumes: `foodItem`, `customItem`, `totalsOf` and `type Totals` (Task 6); `SLOT_LABEL`, `itemsLine` and `kcalText` (Task 6); `FOOD_COPY` (Task 6); `UNITS` (Task 4); `addDays` and `mondayOf` from `@/screens/track/periods`; `tokens` from `@/content/text`.
- Produces:
  - `src/food/tray.ts`:
    - `MAX_COUNT = 20`;
    - `interface Lookup { food(id: string): Food | undefined; custom(id: string): CustomFood | undefined }`;
    - `stepOf(item: MealItem): number`;
    - `withCount(item: MealItem, count: number, look: Lookup): MealItem`, and `step(item: MealItem, by: 1 | -1, look: Lookup): MealItem`;
    - `addFood(items: readonly MealItem[], food: Food, look: Lookup): MealItem[]`;
    - `weighed(item: FoodItem, grams: number, food: Food): FoodItem`;
    - `slotAt(minuteOfDay: number): Slot`;
  - `src/food/usual.ts`: `USUAL_MAX = 3`, `interface Usual { key: string; label: string; detail: string; meal: Slot; items: MealItem[] }` and `usualFor(slot: Slot, today: string, meals: readonly MealRecord[], saved: readonly SavedMeal[]): Usual[]`;
  - `src/food/search.ts`: `SHELVES`, `COMMON_MAX = 12`, `interface FoodResults { customs: CustomFood[]; foods: Food[] }`, `searchFoods(query: string, foods: readonly Food[], customs: readonly CustomFood[]): FoodResults` and `commonFoods(foods: readonly Food[], slot: Slot): Food[]`;
  - `src/food/days.ts`:
    - `mealsOn(meals: readonly MealRecord[], day: string): MealRecord[]`;
    - `interface DayFood { day: string; meals: number; totals?: Totals }` and `weekFood(meals: readonly MealRecord[], day: string, view: NumbersView): DayFood[]`;
    - `dayLine(d: DayFood): string`;
    - `interface DailyNutrition { day: string; meals: number; missing: number; kcal?: number; carbsG?: number }` and `dailyNutrition(meals: readonly MealRecord[], from: string, to: string, view: NumbersView): DailyNutrition[]`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/food/tray.test.ts
import { describe, expect, it } from 'vitest';
import { foodItem } from './estimate';
import { addFood, step, slotAt, weighed, withCount, type Lookup } from './tray';
import type { Food, FoodItem } from './types';

const roti = { id: 'roti', rev: 2, name: 'Roti', portion: { unit: 'piece', grams: 40, count: 1, noun: ['roti', 'rotis'] }, per100g: { kcal: 255, carbsG: 54, carbsLowG: 48.6, carbsHighG: 59.4 } } as Food;
const idli = { id: 'idli', rev: 1, name: 'Idli', portion: { unit: 'piece', grams: 40, count: 2, noun: ['idli', 'idlis'] }, per100g: { kcal: 144, carbsG: 30, carbsLowG: 27, carbsHighG: 33 } } as Food;
const dal = { id: 'toor-dal', rev: 1, name: 'Toor dal', portion: { unit: 'katori', grams: 150, count: 1 }, per100g: { kcal: 94.3, carbsG: 13.07, carbsLowG: 11.76, carbsHighG: 14.38 } } as Food;
const look: Lookup = { food: id => [roti, idli, dal].find(f => f.id === id), custom: () => undefined };

describe('the meal tray (journey §11.3, B-08)', () => {
  it('"+" adds one standard portion, and a second "+" adds another to the same row', () => {
    const one = addFood([], idli, look);
    expect(one).toEqual([foodItem(idli)]);
    expect(addFood(one, idli, look)).toEqual([foodItem(idli, 4)]);
  });
  it('steps pieces by one and katoris by halves, never below one step or above 20', () => {
    expect(step(foodItem(roti), 1, look)).toEqual(foodItem(roti, 2));
    expect(step(foodItem(dal), 1, look)).toEqual(foodItem(dal, 1.5));
    expect(step(foodItem(dal, 0.5), -1, look)).toEqual(foodItem(dal, 0.5));
    expect(withCount(foodItem(roti), 50, look)).toEqual(foodItem(roti, 20));
  });
  it('keeps an item on the recipe it was logged with when the table has moved on (B-12)', () => {
    const logged: FoodItem = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40, kcal: 204, carbsG: 43.2, carbsLowG: 31.1, carbsHighG: 57 };
    expect(withCount(logged, 3, look)).toEqual({ ...logged, count: 3, kcal: 306, carbsG: 64.8, carbsLowG: 46.7, carbsHighG: 85.5 });
  });
  it('weighs a portion: the weight given, and no portion variance', () => {
    expect(weighed(foodItem(roti, 2), 35, roti)).toEqual(foodItem(roti, 2, 35, true));
  });
  it('suggests the meal by the time of day', () => {
    expect(slotAt(9 * 60)).toBe('breakfast');
    expect(slotAt(13 * 60 + 20)).toBe('lunch');
    expect(slotAt(17 * 60)).toBe('snack');
    expect(slotAt(21 * 60)).toBe('dinner');
    expect(slotAt(2 * 60)).toBe('dinner');
  });
});
```

```ts
// src/food/usual.test.ts
import { describe, expect, it } from 'vitest';
import type { FoodItem, MealRecord, SavedMeal } from './types';
import { usualFor } from './usual';

const roti: FoodItem = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40 };
const dal: FoodItem = { kind: 'food', foodId: 'toor-dal', rev: 1, name: 'Toor dal', unit: 'katori', count: 1, gramsPerPortion: 150 };
const lunch = (id: string, at: string, items = [roti, dal]): MealRecord => ({ id, at, day: at.slice(0, 10), meal: 'lunch', items, level: 'meals', loggedAt: at, edits: [] });
const usual = (id: string, updatedAt: string, meal?: SavedMeal['meal']): SavedMeal => ({ id, name: `Usual ${id}`, ...(meal ? { meal } : {}), items: [dal], savedAt: updatedAt, updatedAt });

describe('Your usual (journey §11.3, B-10)', () => {
  it('starts with the same meal yesterday, the latest one if there were two', () => {
    const meals = [lunch('a', '2026-10-07T12:30:00.000+05:30', [dal]), lunch('b', '2026-10-07T13:10:00.000+05:30')];
    expect(usualFor('lunch', '2026-10-08', meals, [])).toEqual([
      { key: 'yesterday:b', label: 'Same as yesterday’s lunch', detail: 'Roti ×2 · Toor dal', meal: 'lunch', items: [roti, dal] },
    ]);
  });
  it('then the usual meals for that meal, or for any meal, newest first, three at most', () => {
    const saved = [usual('1', '2026-10-01T09:00:00.000+05:30', 'lunch'), usual('2', '2026-10-05T09:00:00.000+05:30'), usual('3', '2026-10-06T09:00:00.000+05:30', 'dinner'), usual('4', '2026-10-03T09:00:00.000+05:30', 'lunch')];
    const meals = [lunch('b', '2026-10-07T13:10:00.000+05:30')];
    expect(usualFor('lunch', '2026-10-08', meals, saved).map(u => u.key)).toEqual(['yesterday:b', 'saved:2', 'saved:4']);
  });
  it('offers nothing from the day before yesterday', () => {
    expect(usualFor('lunch', '2026-10-08', [lunch('a', '2026-10-06T13:10:00.000+05:30')], [])).toEqual([]);
  });
});
```

```ts
// src/food/search.test.ts
import { describe, expect, it } from 'vitest';
import { commonFoods, searchFoods } from './search';
import type { CustomFood, Food } from './types';

const f = (id: string, name: string, aliases: string[], shelf: Food['shelf'], slots: Food['slots']) => ({ id, name, aliases, shelf, slots }) as Food;
const FOODS = [
  f('roti', 'Roti (whole-wheat)', ['roti', 'chapati', 'chapatti', 'phulka'], 'breads', ['breakfast', 'lunch', 'dinner']),
  f('rajma', 'Rajma', ['rajma', 'kidney beans'], 'dal', ['lunch', 'dinner']),
  f('raita', 'Cucumber raita', ['raita'], 'sides', ['lunch', 'dinner']),
  f('poha', 'Vegetable poha', ['poha', 'pohe'], 'breakfast', ['breakfast', 'snack']),
  f('chai', 'Chai with milk and sugar', ['chai', 'tea'], 'drinks', ['breakfast', 'snack']),
];
const mine: CustomFood[] = [{ id: 'food-1', name: 'Rava dosa from the canteen', per: { qty: 1, unit: 'plate' }, createdAt: '2026-10-01T09:00:00.000+05:30', updatedAt: '2026-10-01T09:00:00.000+05:30' }];

describe('finding a food (journey §11.3)', () => {
  it('matches names and aliases as the person types, the last word as a prefix', () => {
    expect(searchFoods('chapatti', FOODS, []).foods.map(x => x.id)).toEqual(['roti']);
    expect(searchFoods('ra', FOODS, []).foods.map(x => x.id)).toEqual(['rajma', 'raita']);
    expect(searchFoods('kidney', FOODS, []).foods.map(x => x.id)).toEqual(['rajma']);
  });
  it('puts the person’s own foods first, and finds nothing for nothing typed', () => {
    expect(searchFoods('rava', FOODS, mine)).toEqual({ customs: mine, foods: [] });
    expect(searchFoods('  ', FOODS, mine)).toEqual({ customs: [], foods: [] });
  });
  it('lists common foods for the meal, shelf by shelf', () => {
    expect(commonFoods(FOODS, 'breakfast').map(x => x.id)).toEqual(['roti', 'poha', 'chai']);
    expect(commonFoods(FOODS, 'lunch').map(x => x.id)).toEqual(['roti', 'rajma', 'raita']);
  });
});
```

```ts
// src/food/days.test.ts
import { describe, expect, it } from 'vitest';
import { dailyNutrition, dayLine, mealsOn, weekFood } from './days';
import type { FoodItem, MealRecord } from './types';

const roti: FoodItem = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40, kcal: 204, carbsG: 43.2, carbsLowG: 31.1, carbsHighG: 57 };
const meal = (id: string, at: string, items: MealRecord['items'] = [roti]): MealRecord => ({ id, at, day: at.slice(0, 10), meal: 'lunch', items, level: 'estimates', loggedAt: at, edits: [] });
const MEALS = [
  meal('b', '2026-10-08T20:00:00.000+05:30'),
  meal('a', '2026-10-08T08:30:00.000+05:30', [roti, { kind: 'custom', customId: 'food-1', name: 'Bhel puri', count: 1 }]),
  meal('c', '2026-10-06T13:00:00.000+05:30'),
];
const shown = { show: true, ranges: false } as const;

describe('meals by day (journey §11.2)', () => {
  it('lists a day’s meals in the order they were eaten', () => {
    expect(mealsOn(MEALS, '2026-10-08').map(m => m.id)).toEqual(['a', 'b']);
  });
  it('gives the week Monday to Sunday, with totals only when numbers are shown', () => {
    const week = weekFood(MEALS, '2026-10-08', shown);
    expect(week.map(d => d.day)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
    expect(week.map(d => d.meals)).toEqual([0, 1, 0, 2, 0, 0, 0]);
    expect(week[3].totals?.kcal).toBe(408);
    expect(dayLine(week[3])).toBe('2 meals · Estimated 410 kcal in logged foods');
  });
  it('shows no figure in counts-free mode, though every meal carries its estimate (B-11, Review Focus 3)', () => {
    const week = weekFood(MEALS, '2026-10-08', { show: false });
    expect(week[3]).toEqual({ day: '2026-10-08', meals: 2 });
    expect(dayLine(week[3])).toBe('2 meals');
    expect(dailyNutrition(MEALS, '2026-10-08', '2026-10-08', { show: false })).toEqual([{ day: '2026-10-08', meals: 2, missing: 1 }]);
  });
  it('gives the daily series a Food trend would draw, partial days marked by what’s missing (B-12)', () => {
    expect(dailyNutrition(MEALS, '2026-10-06', '2026-10-08', shown)).toEqual([
      { day: '2026-10-06', meals: 1, missing: 0, kcal: 204, carbsG: 43.2 },
      { day: '2026-10-07', meals: 0, missing: 0 },
      { day: '2026-10-08', meals: 2, missing: 1, kcal: 408, carbsG: 86.4 },
    ]);
  });
});
```

- [ ] **Step 2: Run them to check they fail**

Run: `npx vitest run src/food/tray.test.ts src/food/usual.test.ts src/food/search.test.ts src/food/days.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Write** `src/food/tray.ts`

```ts
/**
 * The meal tray (journey §11.3, B-08): what "+" adds, what the stepper does,
 * a weighed portion, and which meal a time of day suggests. Pure; the sheet
 * holds the items and hands in the foods it knows.
 */
import { customItem, foodItem } from './estimate';
import type { CustomFood, CustomItem, Food, FoodItem, MealItem, Slot } from './types';
import { UNITS } from './units';

export const MAX_COUNT = 20;

export interface Lookup {
  food(id: string): Food | undefined;
  custom(id: string): CustomFood | undefined;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** What the stepper moves an item by: its unit's step, or half a portion of the person's own food. */
export function stepOf(item: MealItem): number {
  return item.kind === 'food' ? UNITS[item.unit].step : 0.5;
}

/** An item's own figures for another count, on the recipe it was logged with (B-12). */
function scaled(item: FoodItem | CustomItem, count: number): FoodItem | CustomItem {
  const f = count / item.count;
  const kcal = item.kcal === undefined ? {} : { kcal: Math.round(item.kcal * f) };
  const carbs = item.carbsG === undefined ? {} : { carbsG: r1(item.carbsG * f) };
  if (item.kind === 'custom') return { kind: 'custom', customId: item.customId, name: item.name, count, ...kcal, ...carbs };
  return {
    kind: 'food', foodId: item.foodId, rev: item.rev, name: item.name, unit: item.unit, count, gramsPerPortion: item.gramsPerPortion,
    ...(item.weighed ? { weighed: true as const } : {}), ...kcal, ...carbs,
    ...(item.carbsLowG === undefined ? {} : { carbsLowG: r1(item.carbsLowG * f) }),
    ...(item.carbsHighG === undefined ? {} : { carbsHighG: r1(item.carbsHighG * f) }),
  };
}

/**
 * The item at another count, from one step to 20. Worked out again from the
 * table when it still has the recipe revision the item used; otherwise the
 * item's own figures are scaled, so it stays on that revision (B-12).
 */
export function withCount(item: MealItem, count: number, look: Lookup): MealItem {
  if (item.kind === 'quick') return item;
  const c = Math.min(MAX_COUNT, Math.max(stepOf(item), count));
  if (item.kind === 'food') {
    const food = look.food(item.foodId);
    return food && food.rev === item.rev ? foodItem(food, c, item.gramsPerPortion, item.weighed === true) : scaled(item, c);
  }
  const custom = look.custom(item.customId);
  return custom ? customItem(custom, c) : scaled(item, c);
}

/** "Less" or "More": one step. */
export function step(item: MealItem, by: 1 | -1, look: Lookup): MealItem {
  return item.kind === 'quick' ? item : withCount(item, item.count + by * stepOf(item), look);
}

/** "+" (journey §11.3): one standard portion at once. Added again, the same food gets another portion, not a second row. */
export function addFood(items: readonly MealItem[], food: Food, look: Lookup): MealItem[] {
  const i = items.findIndex(x => x.kind === 'food' && x.foodId === food.id && !x.weighed);
  if (i < 0) return [...items, foodItem(food)];
  const item = items[i] as FoodItem;
  return items.map((x, j) => (j === i ? withCount(item, item.count + food.portion.count, look) : x));
}

/** A portion the person weighed (journey §11.6): that weight, from the table as it is now, with no portion variance (B-12). */
export function weighed(item: FoodItem, grams: number, food: Food): FoodItem {
  return foodItem(food, item.count, Math.round(grams), true);
}

/** The meal a time of day suggests: breakfast from 04:00, lunch from 11:00, a snack from 15:30, dinner from 19:00. */
export function slotAt(minuteOfDay: number): Slot {
  if (minuteOfDay >= 4 * 60 && minuteOfDay < 11 * 60) return 'breakfast';
  if (minuteOfDay >= 11 * 60 && minuteOfDay < 15 * 60 + 30) return 'lunch';
  if (minuteOfDay >= 15 * 60 + 30 && minuteOfDay < 19 * 60) return 'snack';
  return 'dinner';
}
```

- [ ] **Step 4: Write** `src/food/usual.ts`

```ts
/**
 * "Your usual" (journey §11.2–11.3, B-10): the same meal yesterday, then the
 * person's usual meals for it, at most three. Tapping one fills the tray, and
 * Save logs it: three taps from the Food tile.
 */
import { addDays } from '@/screens/track/periods';
import { FOOD_COPY } from './copy';
import { itemsLine, SLOT_LABEL } from './format';
import type { MealItem, MealRecord, SavedMeal, Slot } from './types';

export const USUAL_MAX = 3;

export interface Usual {
  /** `yesterday:<meal id>` or `saved:<usual meal id>`: what `?usual=` opens the sheet with. */
  key: string;
  label: string;
  detail: string;
  meal: Slot;
  items: MealItem[];
}

const newestFirst = (a: string, b: string) => Date.parse(b) - Date.parse(a);

export function usualFor(slot: Slot, today: string, meals: readonly MealRecord[], saved: readonly SavedMeal[]): Usual[] {
  const yesterday = addDays(today, -1);
  const last = meals.filter(m => m.day === yesterday && m.meal === slot).sort((a, b) => newestFirst(a.at, b.at))[0];
  const out: Usual[] = [];
  if (last) out.push({ key: `yesterday:${last.id}`, label: FOOD_COPY.sameAsYesterday(SLOT_LABEL[slot]), detail: itemsLine(last.items), meal: slot, items: last.items });
  const mine = saved.filter(s => s.meal === undefined || s.meal === slot).sort((a, b) => newestFirst(a.updatedAt, b.updatedAt));
  for (const s of mine) out.push({ key: `saved:${s.id}`, label: s.name, detail: itemsLine(s.items), meal: slot, items: s.items });
  return out.slice(0, USUAL_MAX);
}
```

- [ ] **Step 5: Write** `src/food/search.ts`

```ts
/**
 * Finding a food to add (journey §11.3): by name or alias as the person
 * types, their own foods first, and "Common Indian foods" for the meal when
 * nothing is typed. Pure; the sheet keeps the list still while a finger is on
 * it (M15).
 */
import { tokens } from '@/content/text';
import type { CustomFood, Food, ShelfId, Slot } from './types';

export const SHELVES: readonly { id: ShelfId; title: string }[] = [
  { id: 'breads', title: 'Roti and rice' },
  { id: 'breakfast', title: 'Breakfast' },
  { id: 'dal', title: 'Dal and curries' },
  { id: 'veg', title: 'Vegetables' },
  { id: 'sides', title: 'Curd, salads and chutneys' },
  { id: 'eggsMeat', title: 'Eggs, fish and chicken' },
  { id: 'snacks', title: 'Snacks' },
  { id: 'drinks', title: 'Drinks' },
  { id: 'fruit', title: 'Fruit' },
];

export const COMMON_MAX = 12;

/** How well names match the typed words: every word must, the last as a prefix. 3 is the whole name, 2 its start, 0 no match. */
function score(names: readonly string[], typed: readonly string[]): number {
  let best = 0;
  for (const name of names) {
    const words = tokens(name);
    const matches = typed.every((t, i) => words.some(w => (i === typed.length - 1 ? w.startsWith(t) : w === t)));
    if (!matches) continue;
    best = Math.max(best, words.join(' ') === typed.join(' ') ? 3 : words[0]?.startsWith(typed[0]) ? 2 : 1);
  }
  return best;
}

function ranked<T>(list: readonly T[], names: (x: T) => readonly string[], typed: readonly string[]): T[] {
  return list
    .map((x, i) => ({ x, i, s: score(names(x), typed) }))
    .filter(r => r.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map(r => r.x);
}

export interface FoodResults {
  customs: CustomFood[];
  foods: Food[];
}

export function searchFoods(query: string, foods: readonly Food[], customs: readonly CustomFood[]): FoodResults {
  const typed = tokens(query);
  if (typed.length === 0) return { customs: [], foods: [] };
  return { customs: ranked(customs, c => [c.name], typed), foods: ranked(foods, f => [f.name, ...f.aliases], typed) };
}

/** "Common Indian foods" for a meal: what's eaten at it, shelf by shelf, in the table's order. */
export function commonFoods(foods: readonly Food[], slot: Slot): Food[] {
  const shelf = (f: Food) => SHELVES.findIndex(s => s.id === f.shelf);
  return foods
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.slots.includes(slot))
    .sort((a, b) => shelf(a.f) - shelf(b.f) || a.i - b.i)
    .slice(0, COMMON_MAX)
    .map(({ f }) => f);
}
```

- [ ] **Step 6: Write** `src/food/days.ts`

```ts
/**
 * Meals by day (journey §11.2): Today, This week, and the daily series a Food
 * trend would draw. A partial total stays labelled partial, and counts-free
 * gives no figure at all (B-11, B-12).
 *
 * Kept free of the food table: Home imports this file.
 */
import { addDays, mondayOf } from '@/screens/track/periods';
import { FOOD_COPY } from './copy';
import { totalsOf, type Totals } from './estimate';
import { kcalText } from './format';
import type { NumbersView } from './level';
import type { MealRecord } from './types';

/** One day's meals, in the order they were eaten. */
export function mealsOn(meals: readonly MealRecord[], day: string): MealRecord[] {
  return meals.filter(m => m.day === day).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export interface DayFood {
  day: string;
  meals: number;
  /** Only when numbers are shown and the day has a meal. */
  totals?: Totals;
}

/** Monday to Sunday of the week holding `day`. */
export function weekFood(meals: readonly MealRecord[], day: string, view: NumbersView): DayFood[] {
  const monday = mondayOf(day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(monday, i);
    const list = mealsOn(meals, d);
    return { day: d, meals: list.length, ...(view.show && list.length > 0 ? { totals: totalsOf(list.flatMap(m => m.items)) } : {}) };
  });
}

/** "2 meals · Estimated 1,460 kcal in logged foods" (journey §11.2). */
export function dayLine(d: DayFood): string {
  const parts = [FOOD_COPY.mealsCount(d.meals)];
  if (d.totals && d.totals.withKcal > 0) parts.push(`Estimated ${kcalText(d.totals.kcal)} in logged foods`);
  return parts.join(' · ');
}

export interface DailyNutrition {
  day: string;
  meals: number;
  /** Items with no figure, so a partial day is never drawn as a whole one. */
  missing: number;
  kcal?: number;
  carbsG?: number;
}

/** Per day from `from` to `to`, inclusive: Plan 3's chart reads this for a Food trend. */
export function dailyNutrition(meals: readonly MealRecord[], from: string, to: string, view: NumbersView): DailyNutrition[] {
  const out: DailyNutrition[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const list = mealsOn(meals, d);
    const t = totalsOf(list.flatMap(m => m.items));
    out.push({
      day: d, meals: list.length, missing: t.missing.length,
      ...(view.show && t.withKcal > 0 ? { kcal: t.kcal } : {}),
      ...(view.show && t.withCarbs > 0 ? { carbsG: t.carbsG } : {}),
    });
  }
  return out;
}
```

- [ ] **Step 7: Run them**

Run: `npx vitest run src/food`
Expected: PASS.

- [ ] **Step 8: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/food/tray.ts src/food/tray.test.ts src/food/usual.ts src/food/usual.test.ts src/food/search.ts src/food/search.test.ts src/food/days.ts src/food/days.test.ts
git commit -m "feat: Fill the meal tray, offer usual meals, find foods and read the week"
```

---

### Task 10: The "Log a meal" sheet

**Files:**
- Create: `src/food/links.ts`, `src/food/links.test.ts`, `src/food/draft.ts`, `src/food/draft.test.ts`
- Create: `src/components/hig/toast.ts`
- Modify: `src/screens/home/editor.ts` (its toast styles move to `toast.ts`)
- Create: `src/screens/food/undo.ts`, `src/screens/food/useHeldQuery.ts`, `src/screens/food/parts.tsx`, `src/screens/food/LogMealSheet.tsx`

**Interfaces:**
- Consumes:
  - Tasks 3–9, by the names in each import below;
  - `TimeRow` (`@/screens/track/WhenRows`), `fromLocalInput` (`@/screens/track/logKinds`), `cameFrom` (`@/components/hig/navigation`) and `useClock` (`@/screens/today/clock`).
- Produces:
  - `src/food/links.ts`: `interface LogRequest { meal?: Slot; day?: string; edit?: string; usual?: string; food?: string; quick?: true }`, `logHref(r?: LogRequest): string` and `logRequest(search: string): LogRequest`;
  - `src/food/draft.ts`: `SLOT_HOUR: Record<Slot, string>`, `interface Draft` and `openDraft(r: LogRequest, ctx: { now: string; meals: readonly MealRecord[]; saved: readonly SavedMeal[]; look: Lookup }): Draft`;
  - `src/components/hig/toast.ts`: `TOAST_STYLE` and `UNDO_STYLE`;
  - `src/screens/food/undo.ts`: `offerFoodUndo(o: { text: string; restored: string; scope: string; undo: () => Promise<string | undefined> }): void`, `endFoodUndos(scope?: string): void` and `useFoodUndoScope(path: string): void`;
  - `src/screens/food/useHeldQuery.ts`: `useHeldQuery(query: string, shown: boolean): { shownQuery: string; listProps }`, where `listProps` goes on the list's container;
  - `src/screens/food/parts.tsx`: `Stepper`, `ItemRow`, `FoodRow`, `PortionPage`, `OwnFoodPage` and `QuickPage`;
  - `src/screens/food/LogMealSheet.tsx`: `LogMealSheet({ request, onClose }: { request: LogRequest; onClose: () => void })`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/food/links.test.ts
import { describe, expect, it } from 'vitest';
import { logHref, logRequest } from './links';

describe('addresses into Food (journey §11.3)', () => {
  it('open the sheet for what was asked', () => {
    expect(logHref()).toBe('/hub/food/log');
    expect(logHref({ meal: 'lunch' })).toBe('/hub/food/log?meal=lunch');
    expect(logHref({ edit: 'meal-1', day: '2026-10-07' })).toBe('/hub/food/log?edit=meal-1&day=2026-10-07');
    expect(logHref({ usual: 'saved:usual-1', quick: true })).toBe('/hub/food/log?usual=saved%3Ausual-1&quick=1');
  });
  it('read back what they asked, and nothing they can’t read', () => {
    expect(logRequest('?meal=lunch&day=2026-10-07&quick=1')).toEqual({ meal: 'lunch', day: '2026-10-07', quick: true });
    expect(logRequest(logHref({ usual: 'saved:usual-1', food: 'roti', edit: 'meal-1' }).split('?')[1])).toEqual({ usual: 'saved:usual-1', food: 'roti', edit: 'meal-1' });
    expect(logRequest('?meal=brunch&day=2026-02-30&edit=&quick=yes')).toEqual({});
  });
});
```

```ts
// src/food/draft.test.ts
import { describe, expect, it } from 'vitest';
import { openDraft } from './draft';
import { foodItem } from './estimate';
import type { Lookup } from './tray';
import type { Food, FoodItem, MealRecord, SavedMeal } from './types';

const NOW = '2026-10-08T13:20:00.000+05:30';
const roti = { id: 'roti', rev: 2, name: 'Roti', portion: { unit: 'piece', grams: 40, count: 1, noun: ['roti', 'rotis'] }, per100g: { kcal: 255, carbsG: 54, carbsLowG: 48.6, carbsHighG: 59.4 } } as Food;
const look: Lookup = { food: id => (id === 'roti' ? roti : undefined), custom: () => undefined };
const logged: FoodItem = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40, kcal: 210, carbsG: 44 };
const yesterday: MealRecord = { id: 'meal-1', at: '2026-10-07T13:10:00.000+05:30', day: '2026-10-07', meal: 'lunch', items: [logged], level: 'meals', loggedAt: '2026-10-07T13:15:00.000+05:30', edits: [] };
const usual: SavedMeal = { id: 'usual-1', name: 'Roti breakfast', meal: 'breakfast', items: [logged], savedAt: NOW, updatedAt: NOW };
const ctx = { now: NOW, meals: [yesterday], saved: [usual], look };

describe('what "Log a meal" opens with (journey §11.3)', () => {
  it('the meal the time suggests, with nothing in it', () => {
    expect(openDraft({}, ctx)).toEqual({ slot: 'lunch', items: [], page: { kind: 'tray' } });
    expect(openDraft({ meal: 'dinner' }, ctx).slot).toBe('dinner');
  });
  it('yesterday’s meal, its items worked out again from the table as it is now (B-12)', () => {
    expect(openDraft({ usual: 'yesterday:meal-1' }, ctx)).toEqual({ slot: 'lunch', items: [foodItem(roti, 2)], page: { kind: 'tray' } });
  });
  it('a usual meal, on the meal it was saved for', () => {
    expect(openDraft({ usual: 'saved:usual-1' }, ctx)).toMatchObject({ slot: 'breakfast', items: [foodItem(roti, 2)] });
    expect(openDraft({ usual: 'saved:nope' }, ctx)).toMatchObject({ slot: 'lunch', items: [] });
  });
  it('a logged meal to correct, at its own time, or says it’s gone', () => {
    expect(openDraft({ edit: 'meal-1' }, ctx)).toEqual({ slot: 'lunch', items: [logged], at: yesterday.at, editing: yesterday, page: { kind: 'tray' } });
    expect(openDraft({ edit: 'nope' }, ctx)).toMatchObject({ gone: true, items: [] });
  });
  it('a past day’s meal at that meal’s usual hour, in this phone’s offset; today is no past day', () => {
    expect(openDraft({ day: '2026-10-05', meal: 'dinner' }, ctx).at).toBe('2026-10-05T20:30:00.000+05:30');
    expect(openDraft({ day: '2026-10-08' }, ctx).at).toBeUndefined();
  });
  it('a food’s portion page, or Quick add', () => {
    expect(openDraft({ food: 'roti' }, ctx).page).toEqual({ kind: 'portion', foodId: 'roti' });
    expect(openDraft({ food: 'nope' }, ctx).page).toEqual({ kind: 'tray' });
    expect(openDraft({ quick: true }, ctx).page).toEqual({ kind: 'quick' });
  });
});
```

- [ ] **Step 2: Run them to check they fail**

Run: `npx vitest run src/food/links.test.ts src/food/draft.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Write** `src/food/links.ts`

```ts
/**
 * Addresses into Food (journey §11.3): the "Log a meal" sheet, opened for a
 * meal, a past day, a usual meal, a food, Quick add, or a meal to correct.
 * Pure and free of the food table: the reminder banner and Today's log link here.
 */
import { isDay } from '@/health/observation';
import type { Slot } from './types';

export interface LogRequest {
  meal?: Slot;
  /** A past day, from Today's log. */
  day?: string;
  /** A logged meal to correct. */
  edit?: string;
  /** A "Your usual" key (`usual.ts`). */
  usual?: string;
  /** A food's portion page. */
  food?: string;
  quick?: true;
}

const SLOTS: readonly string[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export function logHref(r: LogRequest = {}): string {
  const q = new URLSearchParams();
  if (r.edit) q.set('edit', r.edit);
  if (r.meal) q.set('meal', r.meal);
  if (r.day) q.set('day', r.day);
  if (r.usual) q.set('usual', r.usual);
  if (r.food) q.set('food', r.food);
  if (r.quick) q.set('quick', '1');
  const s = q.toString();
  return `/hub/food/log${s ? `?${s}` : ''}`;
}

/** What an address asks for. Anything it can't read is left out, never guessed. */
export function logRequest(search: string): LogRequest {
  const q = new URLSearchParams(search);
  const text = (k: string) => {
    const v = q.get(k);
    return v && v.length <= 200 ? v : undefined;
  };
  const meal = q.get('meal');
  const day = q.get('day');
  const edit = text('edit');
  const usual = text('usual');
  const food = text('food');
  return {
    ...(meal && SLOTS.includes(meal) ? { meal: meal as Slot } : {}),
    ...(day && isDay(day) ? { day } : {}),
    ...(edit ? { edit } : {}),
    ...(usual ? { usual } : {}),
    ...(food ? { food } : {}),
    ...(q.get('quick') === '1' ? { quick: true as const } : {}),
  };
}
```

- [ ] **Step 4: Write** `src/food/draft.ts`. It reads the clock from the ISO string it's handed, never from the device, so the test is the same in every time zone.

```ts
/**
 * What the "Log a meal" sheet opens with (journey §11.3): the meal by the
 * time of day, a past day's usual hour, a usual meal's items worked out again
 * from the table as it is now (B-12), a logged meal to correct, or a food's
 * portion page. Pure, and handed the clock, so a test can say what opens.
 */
import { refreshItem } from './estimate';
import type { LogRequest } from './links';
import { slotAt, type Lookup } from './tray';
import type { MealItem, MealRecord, SavedMeal, Slot } from './types';

/** A meal on a past day, before the person gives its time: that meal's usual hour. */
export const SLOT_HOUR: Record<Slot, string> = { breakfast: '08:30', lunch: '13:00', snack: '17:00', dinner: '20:30' };

export interface Draft {
  slot: Slot;
  items: MealItem[];
  /** The moment the meal stands for until the person changes it. Absent: the moment Save is tapped. */
  at?: string;
  editing?: MealRecord;
  page: { kind: 'tray' } | { kind: 'portion'; foodId: string } | { kind: 'quick' };
  /** The meal the address names isn't stored any more. */
  gone?: true;
}

/** `now` is ISO with this phone's offset (`nowAt()`). */
export function openDraft(r: LogRequest, ctx: { now: string; meals: readonly MealRecord[]; saved: readonly SavedMeal[]; look: Lookup }): Draft {
  if (r.edit) {
    const meal = ctx.meals.find(m => m.id === r.edit);
    if (meal) return { slot: meal.meal, items: meal.items, at: meal.at, editing: meal, page: { kind: 'tray' } };
  }
  const minute = Number(ctx.now.slice(11, 13)) * 60 + Number(ctx.now.slice(14, 16));
  let slot: Slot = r.meal ?? slotAt(minute);
  let items: MealItem[] = [];
  const sep = r.usual?.indexOf(':') ?? -1;
  const kind = r.usual && sep > 0 ? r.usual.slice(0, sep) : undefined;
  const id = r.usual && sep > 0 ? r.usual.slice(sep + 1) : undefined;
  if (kind === 'yesterday') {
    const m = ctx.meals.find(x => x.id === id);
    if (m) {
      items = m.items;
      slot = r.meal ?? m.meal;
    }
  }
  if (kind === 'saved') {
    const s = ctx.saved.find(x => x.id === id);
    if (s) {
      items = s.items;
      slot = r.meal ?? s.meal ?? slot;
    }
  }
  const today = ctx.now.slice(0, 10);
  const offset = /([+-]\d\d:\d\d|Z)$/.exec(ctx.now)?.[1] ?? 'Z';
  const at = r.day && r.day < today ? `${r.day}T${SLOT_HOUR[slot]}:00.000${offset}` : undefined;
  const page: Draft['page'] = r.food && ctx.look.food(r.food) ? { kind: 'portion', foodId: r.food } : r.quick ? { kind: 'quick' } : { kind: 'tray' };
  return {
    slot,
    items: items.map(i => (i.kind === 'food' ? refreshItem(i, ctx.look.food(i.foodId)) : i)),
    ...(at ? { at } : {}),
    page,
    ...(r.edit ? { gone: true as const } : {}),
  };
}
```

- [ ] **Step 5: Run them**

Run: `npx vitest run src/food/links.test.ts src/food/draft.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Shared toast styles.** Create `src/components/hig/toast.ts`:

```ts
import type { CSSProperties } from 'react';

/** Toasts are solid and read at the body size; Undo is a 48 px target (journey §20.4 rules 1 and 12). */
export const TOAST_STYLE: CSSProperties = { fontSize: 'var(--text-body)' };
export const UNDO_STYLE: CSSProperties = {
  height: 'auto', minHeight: '3rem', minWidth: '3rem', paddingInline: '1rem', borderRadius: '9999px',
  fontSize: 'var(--text-body)', fontWeight: 600, background: 'var(--tint)', color: 'var(--on-tint)',
};
```

In `src/screens/home/editor.ts`, delete the two local constants `TOAST_STYLE` and `UNDO_STYLE` (and their comment), and import them from `@/components/hig/toast`. If `CSSProperties` is then unused there, drop it from the React import.

- [ ] **Step 7: Undo for food deletes** `src/screens/food/undo.ts`. Each Undo belongs to the screen the person returns to (B-04).
  - A sheet opened from Today's log returns there, so its Undo stands until the person leaves Today's log.
  - The Food hub ends only its own when it unmounts, so closing the sheet over it never ends an Undo the hub didn't raise.

```ts
/**
 * Undo for a food delete (B-04, B-05): offered at once, on no timer, the two
 * latest standing. Each belongs to the screen the person returns to, and
 * leaving that screen ends it, as an unrelated change ends them all. Kept
 * here rather than in a screen, so a toast raised as the sheet closes
 * outlives the sheet.
 */
import { useEffect } from 'react';
import { toast } from 'sonner';
import { TOAST_STYLE, UNDO_STYLE } from '@/components/hig/toast';
import { FOOD_COPY } from '@/food/copy';

interface Offer {
  key: string;
  /** The path of the screen it belongs to. */
  scope: string;
}

let offers: Offer[] = [];
let seq = 0;

const forget = (key: string) => {
  offers = offers.filter(o => o.key !== key);
};

/** Offer Undo. `undo` restores the record, and says why if it couldn't. */
export function offerFoodUndo({ text, restored, scope, undo }: {
  text: string;
  restored: string;
  scope: string;
  undo: () => Promise<string | undefined>;
}): void {
  const key = `food-undo-${++seq}`;
  offers = [...offers, { key, scope }];
  // Two at most, the newer stacked above the older; restoring one keeps the other (B-04).
  while (offers.length > 2) {
    const [oldest, ...rest] = offers;
    toast.dismiss(oldest.key);
    offers = rest;
  }
  toast(text, {
    id: key, duration: Infinity, style: TOAST_STYLE, actionButtonStyle: UNDO_STYLE,
    action: {
      label: FOOD_COPY.undo,
      onClick: event => {
        // The toast stays until the record is stored back (as Edit Home's Undo does).
        event.preventDefault();
        void undo().then(problem => {
          if (problem) {
            toast(`${FOOD_COPY.didNotSave} ${problem}`, { style: TOAST_STYLE });
            return;
          }
          forget(key);
          toast.dismiss(key);
          toast(restored, { style: TOAST_STYLE });
        });
      },
    },
    onDismiss: () => forget(key),
  });
}

/** Ends every Undo standing, or only one screen's: leaving it, or an unrelated change (B-04). */
export function endFoodUndos(scope?: string): void {
  for (const o of offers) if (scope === undefined || o.scope === scope) toast.dismiss(o.key);
  offers = scope === undefined ? [] : offers.filter(o => o.scope !== scope);
}

/** A screen food Undo toasts can belong to: leaving it ends its own. */
export function useFoodUndoScope(path: string): void {
  useEffect(() => () => endFoodUndos(path), [path]);
}
```

- [ ] **Step 8: The held list (M15)** `src/screens/food/useHeldQuery.ts`.
  - It holds the query, not the results, so a list rebuilt on every render never loops.
  - It lets go whenever another page hides the list, because an element removed while it has focus sends no blur.

```ts
import { useState, type FocusEvent } from 'react';

/**
 * M15: the results update as the person types, but stay put while a finger is
 * down on the list or a row in it has focus, so a row never moves under a tap.
 * `shown` is false while another page hides the list: an element removed with
 * focus sends no blur, so nothing can stay held then.
 */
export function useHeldQuery(query: string, shown: boolean) {
  const [down, setDown] = useState(false);
  const [focused, setFocused] = useState(false);
  const [frozen, setFrozen] = useState(query);
  if (!shown && (down || focused)) {
    setDown(false);
    setFocused(false);
  }
  const held = shown && (down || focused);
  // While rendering, not in an effect, so the frame that lets go already shows the newest results.
  if (!held && frozen !== query) setFrozen(query);
  return {
    shownQuery: held ? frozen : query,
    listProps: {
      onPointerDown: () => setDown(true),
      onPointerUp: () => setDown(false),
      onPointerCancel: () => setDown(false),
      onFocus: () => setFocused(true),
      onBlur: (e: FocusEvent<HTMLElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      },
    },
  };
}
```

- [ ] **Step 9: The sheet's parts** `src/screens/food/parts.tsx`

```tsx
/**
 * The "Log a meal" sheet's pieces (journey §11.3, M15, B-08): a tray row with
 * "Less" and "More", a food's row with its "+", and the pages the sheet shows
 * in place of the tray, because sheets never nest: a food's portion, your own
 * food, and Quick add.
 */
import { useId, useState } from 'react';
import { CheckIcon, ChevronLeftIcon, PlusIcon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { ALLERGENS, allergenList, allergyWarning, type Allergies } from '@/food/allergens';
import { FOOD_COPY } from '@/food/copy';
import { foodItem, QUICK_NAME, quickItem } from '@/food/estimate';
import { foodRowDetail, itemEstimate } from '@/food/format';
import type { NumbersView } from '@/food/level';
import { newCustomId } from '@/food/store';
import { MAX_COUNT, step, stepOf, weighed, type Lookup } from '@/food/tray';
import type { CustomFood, Food, FoodItem, MealItem, QuickItem } from '@/food/types';
import { portionText, UNITS } from '@/food/units';
import { nowAt } from '@/health/observation';
import { ErrorText, Hint, NumberField, PrimaryButton, SecondaryButton, Segmented } from '@/screens/track/ui';
import { CheckRows } from '@/screens/you/controls';
import type { AllergenId } from '@/types/profile';

const STEP = 'press-feedback flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-full bg-grouped-bg px-3 text-[length:var(--text-subhead)] font-semibold text-tint disabled:opacity-40';
const FIELD = 'h-11 w-full rounded-xl bg-grouped-card px-4 text-[length:var(--text-body)] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-tint/50';
const LABEL = 'px-4 pb-2 text-[length:var(--text-footnote)] font-medium uppercase tracking-wide text-muted-foreground';

/** "Less" and "More" with what they change between them (B-08). At the smallest step, "Less" reads "Remove". */
export function Stepper({ label, text, onLess, onMore, removes, moreDisabled }: {
  label: string;
  text: string;
  onLess: () => void;
  onMore: () => void;
  removes: boolean;
  moreDisabled: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <button type="button" className={STEP} onClick={onLess}>
        {removes ? FOOD_COPY.remove : <><span aria-hidden>−</span>{FOOD_COPY.less}</>}
      </button>
      <span className="numeric min-w-0 flex-1 text-center text-[length:var(--text-body)] [overflow-wrap:break-word]">{text}</span>
      <button type="button" className={STEP} onClick={onMore} disabled={moreDisabled}>
        <span aria-hidden>+</span>{FOOD_COPY.more}
      </button>
    </div>
  );
}

/** One item in the tray: its name opens its portion page, and "Less" and "More" change it at once, with its estimate (M15). */
export function ItemRow({ item, portion, numbers, warning, onOpen, onChange, onRemove }: {
  item: MealItem;
  portion: string;
  numbers: NumbersView;
  warning?: string;
  /** Absent when there's no portion page: a food the table no longer has, your own food, Quick add. */
  onOpen?: () => void;
  onChange: (by: 1 | -1) => void;
  onRemove: () => void;
}) {
  const estimate = itemEstimate(item, numbers);
  const text = (
    <>
      <span className="block text-[length:var(--text-body)] leading-snug">{item.name}</span>
      <span className="block text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{[portion, estimate].filter(Boolean).join(' · ')}</span>
      {warning && <span className="block text-[length:var(--text-subhead)] leading-snug text-caution">{warning}</span>}
    </>
  );
  const atLeast = item.kind === 'quick' || item.count <= stepOf(item);
  return (
    <div data-item={item.name} className="flex flex-col gap-2 px-4 py-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      {onOpen ? <button type="button" onClick={onOpen} className="press-feedback text-left">{text}</button> : <div>{text}</div>}
      {item.kind === 'quick'
        ? <SecondaryButton tone="stop" onClick={onRemove}>{FOOD_COPY.remove}</SecondaryButton>
        : <Stepper label={item.name} text={portion} removes={atLeast} onLess={() => (atLeast ? onRemove() : onChange(-1))} onMore={() => onChange(1)} moreDisabled={item.count >= MAX_COUNT} />}
    </div>
  );
}

/** A food in a list: its name opens its portion page, and "+" adds one standard portion at once, saying "Added ✓" for a second (M15). */
export function FoodRow({ food, numbers, warning, added, onOpen, onAdd }: {
  food: Food;
  numbers: NumbersView;
  warning?: string;
  added: boolean;
  onOpen: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center gap-2 pr-3">
      <button type="button" onClick={onOpen} className="press-feedback min-h-[3.25rem] min-w-0 flex-1 px-4 py-2.5 text-left">
        <span className="block text-[length:var(--text-body)] leading-snug">{food.name}</span>
        <span className="block text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{foodRowDetail(food, numbers)}</span>
        {warning && <span className="block text-[length:var(--text-subhead)] leading-snug text-caution">{warning}</span>}
      </button>
      <button
        type="button"
        aria-label={FOOD_COPY.addOne(food.name)}
        onClick={onAdd}
        className="press-feedback flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-1 rounded-full bg-tint px-3 text-[length:var(--text-subhead)] font-semibold text-on-tint"
      >
        {added ? <><CheckIcon className="size-4" aria-hidden />{FOOD_COPY.added}</> : <><PlusIcon className="size-4" aria-hidden />{FOOD_COPY.add}</>}
      </button>
    </div>
  );
}

function BackToMeal({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="press-feedback flex min-h-11 items-center gap-1 self-start text-[length:var(--text-body)] text-tint">
      <ChevronLeftIcon className="size-5" aria-hidden />{FOOD_COPY.backToMeal}
    </button>
  );
}

/** A food's portion page (journey §11.3, §11.6): its unit with the grams, "Weigh yours", what's in it, and its allergens. */
export function PortionPage({ food, item, numbers, allergies, look, onBack, onSave, onRemove }: {
  food: Food;
  /** The tray's item, when the food is in the meal already. */
  item?: FoodItem;
  numbers: NumbersView;
  allergies: Allergies;
  look: Lookup;
  onBack: () => void;
  onSave: (item: FoodItem) => void;
  onRemove?: () => void;
}) {
  const [draft, setDraft] = useState<FoodItem>(() => item ?? foodItem(food));
  const [weighing, setWeighing] = useState(draft.weighed === true);
  const [grams, setGrams] = useState(String(draft.gramsPerPortion));
  const [problem, setProblem] = useState<string>();
  const unit = UNITS[food.portion.unit];
  const one = food.portion.unit === 'piece' && food.portion.noun ? food.portion.noun[0] : unit.one;
  const warning = allergyWarning({ ...food.allergens, words: food.words }, allergies);
  const estimate = itemEstimate(draft, numbers);
  const weigh = () => {
    const g = Number(grams);
    if (!(g > 0 && g <= 2000)) {
      setProblem(FOOD_COPY.ownBadFigure);
      return;
    }
    setProblem(undefined);
    setDraft(d => weighed(d, g, food));
  };
  return (
    <div className="flex flex-col gap-4">
      <BackToMeal onBack={onBack} />
      <h3 className="px-1 text-[length:var(--text-body)] font-semibold">{food.name}</h3>
      <Group {...(unit.volume ? { footer: unit.volume } : {})}>
        <div className="flex flex-col gap-2 px-4 py-3">
          <Stepper
            label={food.name}
            text={portionText(food.portion, draft.count, draft.gramsPerPortion)}
            removes={false}
            onLess={() => setDraft(d => step(d, -1, look) as FoodItem)}
            onMore={() => setDraft(d => step(d, 1, look) as FoodItem)}
            moreDisabled={draft.count >= MAX_COUNT}
          />
          {estimate && <p className="text-center text-[length:var(--text-subhead)] text-muted-foreground">{estimate}</p>}
          {warning && <p className="text-[length:var(--text-subhead)] text-caution">{warning}</p>}
        </div>
      </Group>
      <Group>
        {!weighing ? (
          <Row onClick={() => setWeighing(true)} label={FOOD_COPY.weigh} chevron />
        ) : (
          <div className="flex flex-col gap-2 px-4 py-3">
            <NumberField label={FOOD_COPY.weighLabel(one)} mode="numeric" unit="g" value={grams} onChange={v => { setGrams(v); setProblem(undefined); }} invalid={!!problem} />
            <Hint>{FOOD_COPY.weighHint}</Hint>
            <SecondaryButton onClick={weigh}>{FOOD_COPY.done}</SecondaryButton>
            {problem && <ErrorText>{problem}</ErrorText>}
          </div>
        )}
      </Group>
      <Group header={FOOD_COPY.whatsInIt} footer={`${food.recipe.note}. ${FOOD_COPY.recipeNote}`}>
        {food.recipe.ingredients.map(i => (
          <Row key={i.key} label={i.name} detail={i.fdcId === null ? FOOD_COPY.notCounted : `FDC ${i.fdcId}`} value={`${i.grams} g`} numeric />
        ))}
        <Row
          label={food.allergens.contains.length > 0 ? FOOD_COPY.contains(allergenList(food.allergens.contains)) : FOOD_COPY.noTaggedAllergens}
          {...(food.allergens.mayContain.length > 0 ? { detail: FOOD_COPY.mayContain(allergenList(food.allergens.mayContain)) } : {})}
        />
      </Group>
      <PrimaryButton onClick={() => onSave(draft)}>{item ? FOOD_COPY.done : FOOD_COPY.addToMeal}</PrimaryButton>
      {onRemove && <SecondaryButton tone="stop" onClick={onRemove}>{FOOD_COPY.remove}</SecondaryButton>}
    </div>
  );
}

/** A figure the person may leave blank: blank is unknown, never 0 (A-17); `null` can't be right. */
function figure(text: string, max: number): number | undefined | null {
  if (text.trim() === '') return undefined;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}

/** Your own food (journey §11.3): a name and what one portion is, with kcal and carbs only if known, and only with estimates. */
export function OwnFoodPage({ name: typed, numbers, onBack, onAdd }: {
  name: string;
  numbers: NumbersView;
  onBack: () => void;
  onAdd: (food: CustomFood) => void;
}) {
  const ids = { name: useId(), qty: useId(), unit: useId() };
  const [name, setName] = useState(typed);
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('plate');
  const [kcal, setKcal] = useState('');
  const [carbs, setCarbs] = useState('');
  const [allergens, setAllergens] = useState<AllergenId[]>([]);
  const [problem, setProblem] = useState<string>();
  const add = () => {
    const q = Number(qty);
    const k = numbers.show ? figure(kcal, 5000) : undefined;
    const c = numbers.show ? figure(carbs, 1000) : undefined;
    if (!name.trim()) setProblem(FOOD_COPY.ownNoName);
    else if (!(q > 0 && q <= 10_000) || !unit.trim()) setProblem(FOOD_COPY.ownNoQty);
    else if (k === null || c === null) setProblem(FOOD_COPY.ownBadFigure);
    else {
      const now = nowAt();
      onAdd({
        id: newCustomId(), name: name.trim().slice(0, 60), per: { qty: q, unit: unit.trim().slice(0, 20) },
        ...(k !== undefined ? { kcal: k } : {}), ...(c !== undefined ? { carbsG: c } : {}),
        ...(allergens.length > 0 ? { allergens } : {}), createdAt: now, updatedAt: now,
      });
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <BackToMeal onBack={onBack} />
      <h3 className="px-1 text-[length:var(--text-body)] font-semibold">{FOOD_COPY.ownTitle}</h3>
      <div className="flex flex-col">
        <label htmlFor={ids.name} className={LABEL}>{FOOD_COPY.ownName}</label>
        <input id={ids.name} value={name} maxLength={60} autoComplete="off" onChange={e => { setName(e.target.value); setProblem(undefined); }} className={FIELD} />
      </div>
      <div className="flex gap-2">
        <div className="flex w-24 flex-col">
          <label htmlFor={ids.qty} className={LABEL}>{FOOD_COPY.ownPerQty}</label>
          <input id={ids.qty} value={qty} inputMode="decimal" onChange={e => { setQty(e.target.value); setProblem(undefined); }} className={FIELD} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <label htmlFor={ids.unit} className={LABEL}>{FOOD_COPY.ownPerUnit}</label>
          <input id={ids.unit} value={unit} maxLength={20} autoComplete="off" onChange={e => { setUnit(e.target.value); setProblem(undefined); }} className={FIELD} />
        </div>
      </div>
      {numbers.show && (
        <>
          <NumberField label={FOOD_COPY.ownKcal} mode="numeric" unit="kcal" value={kcal} onChange={v => { setKcal(v); setProblem(undefined); }} />
          <NumberField label={FOOD_COPY.ownCarbs} unit="g" value={carbs} onChange={v => { setCarbs(v); setProblem(undefined); }} />
          <Hint>{FOOD_COPY.ownUnknown}</Hint>
        </>
      )}
      <Group header={FOOD_COPY.ownAllergens}>
        <CheckRows label={FOOD_COPY.ownAllergens} options={ALLERGENS.map(a => ({ value: a.id, label: a.label }))} value={allergens} onChange={setAllergens} />
      </Group>
      {problem && <ErrorText>{problem}</ErrorText>}
      <PrimaryButton onClick={add}>{FOOD_COPY.addToMeal}</PrimaryButton>
    </div>
  );
}

const SIZES: { id: QuickItem['size']; label: string }[] = (['small', 'normal', 'large'] as const).map(id => ({ id, label: QUICK_NAME[id] }));

/** "Quick add: about how much?" (journey §11.3): a plate size, and a kcal figure only with estimates. Never carbs. */
export function QuickPage({ numbers, onBack, onAdd }: { numbers: NumbersView; onBack: () => void; onAdd: (item: QuickItem) => void }) {
  const [size, setSize] = useState<QuickItem['size']>('normal');
  const [kcal, setKcal] = useState('');
  const [problem, setProblem] = useState<string>();
  const add = () => {
    const k = numbers.show ? figure(kcal, 5000) : undefined;
    if (k === null) setProblem(FOOD_COPY.ownBadFigure);
    else onAdd(quickItem(size, k));
  };
  return (
    <div className="flex flex-col gap-4">
      <BackToMeal onBack={onBack} />
      <Segmented label={FOOD_COPY.quickHow} options={SIZES} value={size} onChange={setSize} />
      {numbers.show && <NumberField label={FOOD_COPY.quickKcal} mode="numeric" unit="kcal" value={kcal} onChange={v => { setKcal(v); setProblem(undefined); }} />}
      {problem && <ErrorText>{problem}</ErrorText>}
      <PrimaryButton onClick={add}>{FOOD_COPY.addToMeal}</PrimaryButton>
    </div>
  );
}
```

- [ ] **Step 10: The sheet** `src/screens/food/LogMealSheet.tsx`. What each part of it does:
  - **Save** is guarded by a ref as well as by `saving`, so a second tap in the same frame does nothing. The meal's id is made when the sheet opens, so even a repeat would rewrite the same meal (Review Focus 1).
  - **The toast** is raised only after the store has answered (§4.5). A refusal keeps the tray and says "That didn’t save." with the reason.
  - **Delete** goes at once. Its Undo belongs to `cameFrom()`, the screen the sheet goes back to.

```tsx
/**
 * "Log a meal" (journey §11.3, M15): the meal, when, Your usual, the tray,
 * search or Common Indian foods, and Save. "Lunch saved" shows only once the
 * meal is stored (§4.5). The same sheet corrects a logged meal, keeping the
 * version it replaces (A-22), and deletes it, with Undo (B-04, B-05). Sheets
 * never nest, so a food's portion, your own food and Quick add are pages in
 * place of the tray.
 */
import { useId, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Group, Row } from '@/components/hig/List';
import { cameFrom } from '@/components/hig/navigation';
import { Sheet } from '@/components/hig/Sheet';
import { TOAST_STYLE } from '@/components/hig/toast';
import { tokens } from '@/content/text';
import { allergiesOf, allergyWarning } from '@/food/allergens';
import { FOOD_COPY } from '@/food/copy';
import { FOODS, foodById } from '@/food/data';
import { openDraft } from '@/food/draft';
import { customItem, refreshItem, totalsOf } from '@/food/estimate';
import { itemsLine, SLOT_LABEL, totalsLines } from '@/food/format';
import { foodLevel, numbersView } from '@/food/level';
import type { LogRequest } from '@/food/links';
import { corrected, customFoodsIn, mealsIn, savedMealsIn } from '@/food/records';
import { commonFoods, searchFoods } from '@/food/search';
import { deleteMeal, newMealId, newUsualId, restoreMeal, saveCorrection, saveMeal } from '@/food/store';
import { addFood, step, type Lookup } from '@/food/tray';
import type { CustomFood, Food, FoodItem, MealItem, Slot } from '@/food/types';
import { countText, portionText } from '@/food/units';
import { usualFor } from '@/food/usual';
import { nowAt } from '@/health/observation';
import { prefersHour12 } from '@/lib/time';
import { formatClock, formatDayRelative } from '@/screens/track/format';
import { fromLocalInput } from '@/screens/track/logKinds';
import { ErrorText, Hint, PrimaryButton, SecondaryButton, Segmented } from '@/screens/track/ui';
import { useToday } from '@/screens/track/useToday';
import { TimeRow } from '@/screens/track/WhenRows';
import { Toggle } from '@/screens/you/controls';
import { useClock } from '@/screens/today/clock';
import { useStore } from '@/store/useStore';
import { FoodRow, ItemRow, OwnFoodPage, PortionPage, QuickPage } from './parts';
import { useHeldQuery } from './useHeldQuery';
import { endFoodUndos, offerFoodUndo } from './undo';

const SLOTS: Slot[] = ['breakfast', 'lunch', 'snack', 'dinner'];
const SLOT_OPTIONS = SLOTS.map(id => ({ id, label: SLOT_LABEL[id] }));
const FIELD = 'h-11 w-full rounded-xl bg-grouped-card px-4 text-[length:var(--text-body)] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-tint/50';
const LABEL = 'px-4 pb-2 text-[length:var(--text-footnote)] font-medium uppercase tracking-wide text-muted-foreground';

type Page =
  | { kind: 'tray' }
  | { kind: 'portion'; foodId: string; index?: number }
  | { kind: 'own'; name: string }
  | { kind: 'quick' }
  | { kind: 'discard' };

export function LogMealSheet({ request, onClose }: { request: LogRequest; onClose: () => void }) {
  const { profile, records } = useStore();
  const today = useToday();
  const { now: clock } = useClock();
  const hour12 = prefersHour12();
  const ids = { search: useId(), usual: useId() };
  const numbers = numbersView(profile);
  const allergies = allergiesOf(profile?.food);
  const meals = mealsIn(records);
  const saved = savedMealsIn(records);
  const customs = customFoodsIn(records);
  // The person's own foods added in this sheet: stored with the meal, in one change.
  const [own, setOwn] = useState<CustomFood[]>([]);
  const look: Lookup = { food: foodById, custom: id => own.find(c => c.id === id) ?? customs.find(c => c.id === id) };
  const [draft] = useState(() => openDraft(request, { now: nowAt(), meals, saved, look }));
  const editing = draft.editing;
  // Made once, when the sheet opens: a second tap on Save writes this meal again, never a second one.
  const [mealId] = useState(() => editing?.id ?? newMealId());
  const [usualId] = useState(newUsualId);
  const [slot, setSlot] = useState<Slot>(draft.slot);
  const [items, setItems] = useState<MealItem[]>(draft.items);
  const [whenInput, setWhenInput] = useState<string>();
  const [keepUsual, setKeepUsual] = useState(false);
  const [usualName, setUsualName] = useState('');
  const [page, setPage] = useState<Page>(draft.page);
  const [query, setQuery] = useState('');
  const [added, setAdded] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const busy = useRef(false);
  const [opened] = useState(() => JSON.stringify([draft.slot, draft.items]));
  const { shownQuery, listProps } = useHeldQuery(query, page.kind === 'tray');

  const at = whenInput !== undefined ? fromLocalInput(whenInput) : draft.at;
  // Read against the clock that ticks each minute; Save checks again when tapped.
  const future = at !== undefined && Date.parse(at) > clock.getTime();
  const dirty = JSON.stringify([slot, items]) !== opened || whenInput !== undefined || own.length > 0 || keepUsual;
  const lines = totalsLines(totalsOf(items), numbers);
  const results = useMemo(() => searchFoods(shownQuery, FOODS, [...own, ...customs]), [shownQuery, own, customs]);
  const usual = editing || items.length > 0 ? [] : usualFor(slot, today, meals, saved);
  const typed = shownQuery.trim();

  const foodWarning = (f: Food) => allergyWarning({ ...f.allergens, words: f.words }, allergies);
  const customWarning = (c: CustomFood) => allergyWarning({ contains: c.allergens ?? [], mayContain: [], complete: true, words: tokens(c.name) }, allergies);
  const itemWarning = (item: MealItem) => {
    if (item.kind === 'food') {
      const food = foodById(item.foodId);
      return food ? foodWarning(food) : undefined;
    }
    const custom = item.kind === 'custom' ? look.custom(item.customId) : undefined;
    return custom ? customWarning(custom) : undefined;
  };
  const portionOf = (item: MealItem) => {
    if (item.kind === 'quick') return item.name;
    if (item.kind === 'custom') {
      const custom = look.custom(item.customId);
      return custom ? `${countText(item.count)} × ${custom.per.qty} ${custom.per.unit}` : countText(item.count);
    }
    return portionText({ unit: item.unit, noun: foodById(item.foodId)?.portion.noun }, item.count, item.gramsPerPortion);
  };

  const add = (food: Food) => {
    setItems(list => addFood(list, food, look));
    setAdded(food.id);
    // "Added ✓" for a second (M15).
    window.setTimeout(() => setAdded(a => (a === food.id ? undefined : a)), 1000);
  };
  const close = () => {
    if (saving) return;
    if (dirty && page.kind !== 'discard') setPage({ kind: 'discard' });
    else onClose();
  };

  const save = async () => {
    if (busy.current || items.length === 0 || (at !== undefined && Date.parse(at) > Date.now())) return;
    busy.current = true;
    setSaving(true);
    setError(undefined);
    const now = nowAt();
    const when = at ?? now;
    const result = editing
      ? await saveCorrection(corrected(editing, { at: when, meal: slot, items }, now), own)
      : await saveMeal(
        { id: mealId, at: when, day: when.slice(0, 10), meal: slot, items, level: foodLevel(profile?.food) === 'estimates' ? 'estimates' : 'meals', loggedAt: now, edits: [] },
        {
          customFoods: own,
          ...(keepUsual ? { usual: { id: usualId, name: usualName.trim().slice(0, 60) || itemsLine(items).slice(0, 60), meal: slot, items, savedAt: now, updatedAt: now } } : {}),
        },
      );
    busy.current = false;
    setSaving(false);
    if (!result.ok) {
      setError(`${FOOD_COPY.didNotSave} ${result.failure.message}`);
      return;
    }
    // A save is an unrelated change: any Undo still standing ends (B-04).
    endFoodUndos();
    toast(editing ? FOOD_COPY.updated(SLOT_LABEL[slot]) : FOOD_COPY.saved(SLOT_LABEL[slot]), { style: TOAST_STYLE });
    onClose();
  };

  const remove = async () => {
    if (!editing || busy.current) return;
    busy.current = true;
    setSaving(true);
    const result = await deleteMeal(editing.id);
    busy.current = false;
    setSaving(false);
    if (!result.ok) {
      setError(`${FOOD_COPY.didNotSave} ${result.failure.message}`);
      return;
    }
    const gone = editing;
    offerFoodUndo({
      text: FOOD_COPY.deleted(SLOT_LABEL[gone.meal]),
      restored: FOOD_COPY.restored(SLOT_LABEL[gone.meal]),
      // The screen the sheet goes back to: Today's log, or the hub.
      scope: cameFrom() ?? '/hub/food',
      undo: async () => {
        const back = await restoreMeal(gone);
        return back.ok ? undefined : back.failure.message;
      },
    });
    onClose();
  };

  const portionFood = page.kind === 'portion' ? foodById(page.foodId) : undefined;
  const title = editing ? FOOD_COPY.editTitle(SLOT_LABEL[editing.meal]) : FOOD_COPY.logTitle;

  return (
    <Sheet open onOpenChange={next => { if (!next) close(); }} title={title} detent="large" dismissible={!saving}>
      {page.kind === 'discard' && (
        <div className="flex flex-col gap-3">
          <p className="px-1 text-[length:var(--text-body)] font-semibold">{FOOD_COPY.discardTitle}</p>
          <Hint>{FOOD_COPY.discardDetail}</Hint>
          <PrimaryButton onClick={() => setPage({ kind: 'tray' })}>{FOOD_COPY.keepEditing}</PrimaryButton>
          <SecondaryButton tone="stop" onClick={onClose}>{FOOD_COPY.discard}</SecondaryButton>
        </div>
      )}

      {page.kind === 'portion' && portionFood && (
        <PortionPage
          key={`${page.foodId}:${page.index ?? 'new'}`}
          food={portionFood}
          {...(page.index !== undefined ? { item: items[page.index] as FoodItem, onRemove: () => { setItems(list => list.filter((_, i) => i !== page.index)); setPage({ kind: 'tray' }); } } : {})}
          numbers={numbers}
          allergies={allergies}
          look={look}
          onBack={() => setPage({ kind: 'tray' })}
          onSave={item => {
            setItems(list => (page.index !== undefined ? list.map((x, i) => (i === page.index ? item : x)) : [...list, item]));
            setPage({ kind: 'tray' });
          }}
        />
      )}

      {page.kind === 'own' && (
        <OwnFoodPage
          name={page.name}
          numbers={numbers}
          onBack={() => setPage({ kind: 'tray' })}
          onAdd={food => {
            setOwn(list => [...list, food]);
            setItems(list => [...list, customItem(food)]);
            setQuery('');
            setPage({ kind: 'tray' });
          }}
        />
      )}

      {page.kind === 'quick' && (
        <QuickPage
          numbers={numbers}
          onBack={() => setPage({ kind: 'tray' })}
          onAdd={item => {
            setItems(list => [...list, item]);
            setPage({ kind: 'tray' });
          }}
        />
      )}

      {page.kind === 'tray' && (
        <div className="flex flex-col gap-6">
          {draft.gone && <Hint>{FOOD_COPY.gone}</Hint>}
          <Segmented label={FOOD_COPY.meal} options={SLOT_OPTIONS} value={slot} onChange={setSlot} />
          <TimeRow
            label={FOOD_COPY.when}
            value={whenInput}
            onChange={setWhenInput}
            {...(draft.at ? { captured: { at: draft.at, label: `${formatDayRelative(draft.at.slice(0, 10), today)}, ${formatClock(draft.at, hour12)}` } } : {})}
          />
          {future && <ErrorText>{FOOD_COPY.futureTime}</ErrorText>}

          {usual.length > 0 && (
            <Group header={FOOD_COPY.yourUsual}>
              {usual.map(u => (
                <Row
                  key={u.key}
                  onClick={() => {
                    setItems(u.items.map(i => (i.kind === 'food' ? refreshItem(i, foodById(i.foodId)) : i)));
                    setSlot(u.meal);
                  }}
                  label={u.label}
                  detail={u.detail}
                />
              ))}
            </Group>
          )}

          <Group header={FOOD_COPY.yourMeal} footer={[lines.estimate, lines.missing, numbers.show && numbers.ranges ? FOOD_COPY.roughCarbs : undefined].filter(Boolean).join('. ') || undefined}>
            {items.length === 0 ? (
              <Row label={FOOD_COPY.nothingAdded} />
            ) : (
              items.map((item, i) => {
                const food = item.kind === 'food' ? foodById(item.foodId) : undefined;
                return (
                  <ItemRow
                    key={`${i}:${item.name}`}
                    item={item}
                    portion={portionOf(item)}
                    numbers={numbers}
                    {...(itemWarning(item) ? { warning: itemWarning(item) } : {})}
                    {...(food && item.kind === 'food' ? { onOpen: () => setPage({ kind: 'portion', foodId: food.id, index: i }) } : {})}
                    onChange={by => setItems(list => list.map((x, j) => (j === i ? step(x, by, look) : x)))}
                    onRemove={() => setItems(list => list.filter((_, j) => j !== i))}
                  />
                );
              })
            )}
          </Group>

          <div className="flex flex-col">
            <label htmlFor={ids.search} className={LABEL}>{FOOD_COPY.search}</label>
            <input
              id={ids.search}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={FOOD_COPY.searchPlaceholder}
              enterKeyHint="search"
              autoComplete="off"
              className={FIELD}
            />
          </div>

          <div {...listProps}>
            {typed === '' ? (
              <Group header={FOOD_COPY.common}>
                {commonFoods(FOODS, slot).map(f => (
                  <FoodRow
                    key={f.id}
                    food={f}
                    numbers={numbers}
                    {...(foodWarning(f) ? { warning: foodWarning(f) } : {})}
                    added={added === f.id}
                    onOpen={() => setPage({ kind: 'portion', foodId: f.id })}
                    onAdd={() => add(f)}
                  />
                ))}
              </Group>
            ) : (
              <Group header={FOOD_COPY.results} {...(results.foods.length + results.customs.length === 0 ? { footer: FOOD_COPY.noResults(typed) } : {})}>
                {results.customs.map(c => (
                  <Row
                    key={c.id}
                    onClick={() => setItems(list => [...list, customItem(c)])}
                    label={c.name}
                    detail={[`${c.per.qty} ${c.per.unit}`, customWarning(c)].filter(Boolean).join(' · ')}
                    accessory={<span className="shrink-0 text-[length:var(--text-body)] font-semibold text-tint">{FOOD_COPY.add}</span>}
                  />
                ))}
                {results.foods.map(f => (
                  <FoodRow
                    key={f.id}
                    food={f}
                    numbers={numbers}
                    {...(foodWarning(f) ? { warning: foodWarning(f) } : {})}
                    added={added === f.id}
                    onOpen={() => setPage({ kind: 'portion', foodId: f.id })}
                    onAdd={() => add(f)}
                  />
                ))}
                <Row onClick={() => setPage({ kind: 'own', name: typed })} label={FOOD_COPY.ownFood(typed)} chevron />
                <Row onClick={() => setPage({ kind: 'quick' })} label={FOOD_COPY.quickAdd} chevron />
              </Group>
            )}
          </div>

          {!editing && (
            <Group>
              <Row label={FOOD_COPY.saveAsUsual} accessory={<Toggle checked={keepUsual} onChange={setKeepUsual} label={FOOD_COPY.saveAsUsual} />} />
              {keepUsual && (
                <div className="flex flex-col px-4 py-2">
                  <label htmlFor={ids.usual} className="pb-1 text-[length:var(--text-subhead)] text-muted-foreground">{FOOD_COPY.usualName}</label>
                  <input id={ids.usual} value={usualName} maxLength={60} placeholder={itemsLine(items)} onChange={e => setUsualName(e.target.value)} className={FIELD} />
                </div>
              )}
            </Group>
          )}

          {editing && editing.edits.length > 0 && (
            <Group header={FOOD_COPY.history}>
              {[...editing.edits].reverse().map(e => (
                <Row
                  key={e.replacedAt}
                  label={FOOD_COPY.historyRow(`${formatDayRelative(e.replacedAt.slice(0, 10), today)}, ${formatClock(e.replacedAt, hour12)}`)}
                  detail={`${SLOT_LABEL[e.meal]}, ${formatClock(e.at, hour12)} · ${itemsLine(e.items)}`}
                />
              ))}
            </Group>
          )}

          {error && <ErrorText>{error}</ErrorText>}
          <PrimaryButton onClick={() => void save()} disabled={saving || items.length === 0 || future || (editing !== undefined && !dirty)}>
            {saving ? FOOD_COPY.saving : FOOD_COPY.save}
          </PrimaryButton>
          {editing && <SecondaryButton tone="stop" onClick={() => void remove()} disabled={saving}>{FOOD_COPY.deleteMeal}</SecondaryButton>}
        </div>
      )}
    </Sheet>
  );
}
```

- [ ] **Step 11: Gates and commit.** The sheet isn't reachable until Task 11 gives it its route. The acceptance cases in Task 16 drive it.

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/food/links.ts src/food/links.test.ts src/food/draft.ts src/food/draft.test.ts src/components/hig/toast.ts src/screens/home/editor.ts src/screens/food
git commit -m "feat: Add the Log a meal sheet, with durable saves and Undo"
```

---

### Task 11: The Food hub, its routes and the Food tile

**Files:**
- Create: `src/screens/food/LevelSheet.tsx`, `src/screens/food/FoodHubScreen.tsx`, `src/screens/food/UsualMealsScreen.tsx`, `src/screens/food/routes.tsx`
- Modify: `src/routes.tsx` (the food routes)
- Modify: `src/screens/home/HomeScreen.tsx` (the Food tile's line), `src/screens/home/model.ts` and `src/screens/home/model.test.ts` (food leaves `readingLine`)
- Modify: `scripts/e2e/acceptance/run.mjs` (the warm-up list)

**Interfaces:**
- Consumes:
  - Plan 2's `HubFrame` and `HubSection`; `categoryById`;
  - `FOOD_DATA_NOTES`, `mealsFor` and `resolveGroups` (`@/content`); `ClaimGroup` (`@/screens/guide/parts`), `useGuide` (`@/screens/guide/useGuide`) and `mealDetail` (`@/screens/guide/mealText`);
  - `backTarget`, `markBack` and `useNavStack` (`@/components/hig/navigation`);
  - `changeProfile` (`@/screens/you/write`) and `ChoiceRows` (`@/screens/you/controls`);
  - Tasks 2, 6, 8, 9 and 10.
- Produces:
  - `LevelSheet({ open, onOpenChange, onDone? }: { open: boolean; onOpenChange: (open: boolean) => void; onDone?: (level: FoodLevel) => void })`, which Task 13's Me → Food uses too;
  - `FoodHubScreen` (default export), at `/hub/food` and, with the sheet over it, `/hub/food/log`;
  - `UsualMealsScreen` (default export), at `/hub/food/usual`;
  - `FoodRoutes` (default export), at `/hub/food/*`.

- [ ] **Step 1: The level choice** `src/screens/food/LevelSheet.tsx`

```tsx
/**
 * "Log what you eat?" (journey §11.1, §11.5, K-22): meal ideas only, meals
 * with no numbers, or estimates. Before estimates are stored, "Has food or
 * weight ever been hard for you?" is asked once, and the answer is kept where
 * setup keeps it (board D102). "Yes" or "Prefer not to say" recommends meals
 * only, and estimates stay one tap away.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { FOOD_COPY } from '@/food/copy';
import { afterScreening, foodLevel, type FoodLevel, type ScreenAnswer } from '@/food/level';
import { ErrorText, Hint, PrimaryButton, SecondaryButton } from '@/screens/track/ui';
import { ChoiceRows, type Choice } from '@/screens/you/controls';
import { changeProfile } from '@/screens/you/write';
import { useStore } from '@/store/useStore';

const LEVELS: Choice<FoodLevel>[] = [
  { value: 'ideas', label: FOOD_COPY.levelIdeas, detail: FOOD_COPY.levelIdeasDetail },
  { value: 'meals', label: FOOD_COPY.levelMeals, detail: FOOD_COPY.levelMealsDetail },
  { value: 'estimates', label: FOOD_COPY.levelEstimates, detail: FOOD_COPY.levelEstimatesDetail },
];

export function LevelSheet({ open, onOpenChange, onDone }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** After the level is stored. Without it, the sheet closes. */
  onDone?: (level: FoodLevel) => void;
}) {
  const { profile } = useStore();
  const food = profile?.food;
  const [page, setPage] = useState<'choose' | 'screen' | 'suggest'>('choose');
  const [answer, setAnswer] = useState<ScreenAnswer | undefined>(food?.hardBefore);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  // Each opening starts on the choice: reset while rendering, as Quick Log does.
  const [was, setWas] = useState(open);
  if (open !== was) {
    setWas(open);
    if (open) {
      setPage('choose');
      setError(undefined);
      setAnswer(food?.hardBefore);
    }
  }

  const store = async (level: FoodLevel, hardBefore?: ScreenAnswer) => {
    if (saving) return;
    setSaving(true);
    const result = await changeProfile(p => (p.food ? { ...p, food: { ...p.food, level, ...(hardBefore ? { hardBefore } : {}) } } : p));
    setSaving(false);
    if (!result.ok) {
      setError(`${FOOD_COPY.didNotSave} ${result.failure.message}`);
      return;
    }
    if (onDone) onDone(level);
    else onOpenChange(false);
  };
  const pick = (level: FoodLevel) => {
    if (level !== 'estimates') void store(level);
    else if (answer === undefined) setPage('screen');
    else if (afterScreening(answer).recommended === 'estimates') void store('estimates');
    else setPage('suggest');
  };
  const answerWith = (a: ScreenAnswer) => {
    setAnswer(a);
    if (afterScreening(a).recommended === 'estimates') void store('estimates', a);
    else setPage('suggest');
  };

  return (
    <Sheet open={open} onOpenChange={next => { if (!saving) onOpenChange(next); }} title={FOOD_COPY.levelTitle} detent="medium" dismissible={!saving}>
      {!food ? (
        <Group>
          <Row as={Link} to="/hub/food/ideas" label={FOOD_COPY.chooseFood} detail={FOOD_COPY.chooseFoodDetail} chevron />
        </Group>
      ) : page === 'choose' ? (
        <Group>
          <ChoiceRows label={FOOD_COPY.levelTitle} options={LEVELS} value={foodLevel(food)} onChange={pick} />
        </Group>
      ) : page === 'screen' ? (
        <div className="flex flex-col gap-3">
          <p className="px-1 text-[length:var(--text-body)] font-semibold">{FOOD_COPY.screenQuestion}</p>
          <SecondaryButton onClick={() => answerWith('yes')} disabled={saving}>{FOOD_COPY.screenYes}</SecondaryButton>
          <SecondaryButton onClick={() => answerWith('no')} disabled={saving}>{FOOD_COPY.screenNo}</SecondaryButton>
          <SecondaryButton onClick={() => answerWith('preferNot')} disabled={saving}>{FOOD_COPY.screenPreferNot}</SecondaryButton>
          <Hint>{FOOD_COPY.screenNote}</Hint>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="px-1 text-[length:var(--text-body)] font-semibold">{FOOD_COPY.suggestTitle}</p>
          <PrimaryButton onClick={() => void store('meals', answer)} disabled={saving}>{FOOD_COPY.suggestMeals}</PrimaryButton>
          <SecondaryButton onClick={() => void store('estimates', answer)} disabled={saving}>{FOOD_COPY.suggestEstimates}</SecondaryButton>
        </div>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </Sheet>
  );
}
```

- [ ] **Step 2: The hub** `src/screens/food/FoodHubScreen.tsx`. It's one route for `/hub/food` and `/hub/food/log`. Opening and closing "Log a meal" only changes the address, so the hub never remounts under the sheet.

```tsx
/**
 * The Food hub (journey §11.2): Right now, with three ideas for the meal the
 * time suggests and, with logging on, "Log what you ate" and up to three usual
 * meals; Today; Options (5, B-08); This week; and how estimates work. "Log a
 * meal" opens over it at `#/hub/food/log`, so closing the sheet never reloads
 * the hub, and an Undo raised as it closes stays.
 */
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { categoryById } from '@/categories';
import { Group, Row } from '@/components/hig/List';
import { backTarget, markBack, useNavStack } from '@/components/hig/navigation';
import { FOOD_DATA_NOTES, mealsFor, resolveGroups } from '@/content';
import { FOOD_COPY } from '@/food/copy';
import { dayLine, mealsOn, weekFood } from '@/food/days';
import { totalsOf } from '@/food/estimate';
import { careTeamLine, mealRowDetail, SLOT_LABEL, totalsLines } from '@/food/format';
import { foodLevel, numbersView } from '@/food/level';
import { logHref, logRequest } from '@/food/links';
import { mealsIn, savedMealsIn } from '@/food/records';
import { slotAt } from '@/food/tray';
import { usualFor } from '@/food/usual';
import { prefersHour12 } from '@/lib/time';
import { mealDetail } from '@/screens/guide/mealText';
import { ClaimGroup } from '@/screens/guide/parts';
import { useGuide } from '@/screens/guide/useGuide';
import { HubFrame, HubSection } from '@/screens/hub/HubFrame';
import { useClock } from '@/screens/today/clock';
import { formatDayRelative } from '@/screens/track/format';
import { useToday } from '@/screens/track/useToday';
import { useStore } from '@/store/useStore';
import { LevelSheet } from './LevelSheet';
import { LogMealSheet } from './LogMealSheet';
import { useFoodUndoScope } from './undo';

/** Where an idea and the sample week go back to. */
const FROM_HUB = { from: 'hub' };

export default function FoodHubScreen() {
  const { profile, records } = useStore();
  const { ctx } = useGuide();
  const { pathname, search, state } = useLocation();
  const navigate = useNavigate();
  const stack = useNavStack();
  const today = useToday();
  const { now } = useClock();
  const hour12 = prefersHour12();
  const [choosing, setChoosing] = useState(false);
  useFoodUndoScope('/hub/food');

  const food = profile?.food;
  const level = foodLevel(food);
  const numbers = numbersView(profile);
  const meals = mealsIn(records);
  const slot = slotAt(now.getHours() * 60 + now.getMinutes());
  const ideas = mealsFor(food, slot).slice(0, 3);
  const usual = level === 'ideas' ? [] : usualFor(slot, today, meals, savedMealsIn(records));
  const todays = mealsOn(meals, today);
  const todayLines = totalsLines(totalsOf(todays.flatMap(m => m.items)), numbers);
  const target = careTeamLine(food?.careTeamTargets, numbers);
  const [notes] = resolveGroups([FOOD_DATA_NOTES], ctx);

  const closeLog = () => {
    const to = backTarget(stack, { to: '/hub/food', label: 'Food' }, state);
    markBack();
    if (to.pop) navigate(-1);
    else navigate(to.to, { replace: true, ...(to.state ? { state: to.state } : {}) });
  };

  if (pathname !== '/hub/food' && pathname !== '/hub/food/log') return <Navigate to="/hub/food" replace />;
  const logging = pathname === '/hub/food/log';
  // Meals logged before logging was turned off stay readable here (A-22).
  const history = level !== 'ideas' || meals.length > 0;
  const request = logRequest(search);

  return (
    <HubFrame category={categoryById('food')}>
      <HubSection title={FOOD_COPY.rightNow}>
        <Group header={FOOD_COPY.ideasFor(SLOT_LABEL[slot])}>
          {!food ? (
            <Row as={Link} to="/hub/food/ideas" viewTransition label={FOOD_COPY.chooseFood} detail={FOOD_COPY.chooseFoodDetail} chevron />
          ) : ideas.length === 0 ? (
            <Row label={FOOD_COPY.noIdeas} detail={FOOD_COPY.noIdeasDetail} />
          ) : (
            ideas.map(m => <Row key={m.id} as={Link} to={`/hub/food/ideas/${m.id}`} state={FROM_HUB} viewTransition label={m.name} detail={mealDetail(m, food.pattern)} chevron />)
          )}
        </Group>
        {level === 'ideas' ? (
          <Group>
            <Row onClick={() => setChoosing(true)} label={FOOD_COPY.startLogging} detail={FOOD_COPY.startLoggingDetail} chevron />
          </Group>
        ) : (
          <Group>
            <Row as={Link} to={logHref({ meal: slot })} label={FOOD_COPY.logWhatYouAte} chevron />
            {usual.map(u => <Row key={u.key} as={Link} to={logHref({ usual: u.key })} label={u.label} detail={u.detail} chevron />)}
          </Group>
        )}
      </HubSection>

      {history && (
        <HubSection title={FOOD_COPY.today}>
          <Group footer={[target && `${target}.`, numbers.show && numbers.ranges ? FOOD_COPY.roughCarbs : undefined].filter(Boolean).join(' ') || undefined}>
            {todays.length === 0
              ? <Row label={FOOD_COPY.nothingToday} />
              : todays.map(m => <Row key={m.id} as={Link} to={logHref({ edit: m.id })} label={SLOT_LABEL[m.meal]} detail={mealRowDetail(m, numbers, hour12)} chevron />)}
            {todayLines.estimate && <Row label={todayLines.estimate} {...(todayLines.missing ? { detail: todayLines.missing } : {})} />}
          </Group>
        </HubSection>
      )}

      <HubSection title={FOOD_COPY.options}>
        <Group>
          {level !== 'ideas' && (
            <>
              <Row as={Link} to={logHref()} label={FOOD_COPY.optionLog} chevron />
              <Row as={Link} to="/hub/food/usual" viewTransition label={FOOD_COPY.optionUsual} chevron />
              <Row as={Link} to={logHref({ quick: true })} label={FOOD_COPY.optionQuick} chevron />
            </>
          )}
          <Row as={Link} to="/hub/food/ideas" viewTransition label={FOOD_COPY.optionIdeas} chevron />
          <Row as={Link} to="/hub/food/week" state={FROM_HUB} viewTransition label={FOOD_COPY.optionWeek} chevron />
        </Group>
      </HubSection>

      {history && (
        <HubSection title={FOOD_COPY.thisWeek}>
          <Group>
            {weekFood(meals, today, numbers).filter(d => d.day <= today).map(d => (
              <Row key={d.day} label={formatDayRelative(d.day, today)} detail={d.meals > 0 ? dayLine(d) : FOOD_COPY.notLogged} />
            ))}
          </Group>
        </HubSection>
      )}

      {numbers.show && <ClaimGroup header={FOOD_COPY.howEstimates} claims={notes} ctx={ctx} />}
      <p className="px-4 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">{FOOD_COPY.attribution} {FOOD_COPY.privacy}</p>

      {/* A new meal waits for logging to be on; a logged meal stays editable and deletable whatever the level (A-22). */}
      {logging && (level === 'ideas' && !request.edit
        ? <LevelSheet open onOpenChange={next => { if (!next) closeLog(); }} onDone={chosen => { if (chosen === 'ideas') closeLog(); }} />
        : <LogMealSheet key={search} request={request} onClose={closeLog} />)}
      <LevelSheet open={choosing} onOpenChange={setChoosing} />
    </HubFrame>
  );
}
```

- [ ] **Step 3: Your usual meals** `src/screens/food/UsualMealsScreen.tsx`

```tsx
/**
 * Your usual meals (journey §11.2's Options): each one opens "Log a meal"
 * filled in, and Remove goes at once, with Undo (B-04, B-05).
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { XIcon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { FOOD_COPY } from '@/food/copy';
import { itemsLine } from '@/food/format';
import { logHref } from '@/food/links';
import { savedMealsIn } from '@/food/records';
import { deleteUsual, restoreUsual } from '@/food/store';
import type { SavedMeal } from '@/food/types';
import { Notice } from '@/screens/you/controls';
import { useStore } from '@/store/useStore';
import { offerFoodUndo, useFoodUndoScope } from './undo';

export default function UsualMealsScreen() {
  const { records } = useStore();
  const [error, setError] = useState<string>();
  useFoodUndoScope('/hub/food/usual');
  const saved = [...savedMealsIn(records)].sort((a, b) => a.name.localeCompare(b.name));

  const remove = async (u: SavedMeal) => {
    const result = await deleteUsual(u.id);
    if (!result.ok) {
      setError(`${FOOD_COPY.didNotSave} ${result.failure.message}`);
      return;
    }
    setError(undefined);
    offerFoodUndo({
      text: FOOD_COPY.removed(u.name),
      restored: FOOD_COPY.restored(u.name),
      scope: '/hub/food/usual',
      undo: async () => {
        const back = await restoreUsual(u);
        return back.ok ? undefined : back.failure.message;
      },
    });
  };

  return (
    <Screen title={FOOD_COPY.usualTitle} back={{ to: '/hub/food', label: 'Food' }}>
      <Group {...(saved.length === 0 ? { footer: FOOD_COPY.noUsual } : {})}>
        {saved.map(u => (
          <div key={u.id} className="flex items-center pr-2">
            <Row as={Link} to={logHref({ usual: `saved:${u.id}` })} label={u.name} detail={itemsLine(u.items)} chevron className="min-w-0 flex-1" />
            <button
              type="button"
              aria-label={FOOD_COPY.usualRemove(u.name)}
              onClick={() => void remove(u)}
              className="press-feedback flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground"
            >
              <XIcon className="size-5" aria-hidden />
            </button>
          </div>
        ))}
      </Group>
      {error && <Notice tone="error">{error}</Notice>}
    </Screen>
  );
}
```

- [ ] **Step 4: The routes** `src/screens/food/routes.tsx`

```tsx
import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import FoodHubScreen from './FoodHubScreen';

const MealIdeasScreen = lazy(() => import('@/screens/guide/MealIdeasScreen'));
const MealDetailScreen = lazy(() => import('@/screens/guide/MealDetailScreen'));
const SampleWeekScreen = lazy(() => import('@/screens/guide/SampleWeekScreen'));
const UsualMealsScreen = lazy(() => import('./UsualMealsScreen'));

/**
 * `/hub/food/*` (journey §11, §19.2). The hub and its "Log a meal" sheet are
 * one route, `*`, so opening and closing the sheet never remounts the hub;
 * the hub sends any other address to itself.
 */
export default function FoodRoutes() {
  return (
    <Routes>
      <Route path="ideas" element={<MealIdeasScreen />} />
      <Route path="ideas/:mealId" element={<MealDetailScreen />} />
      <Route path="week" element={<SampleWeekScreen />} />
      <Route path="usual" element={<UsualMealsScreen />} />
      <Route path="*" element={<FoodHubScreen />} />
    </Routes>
  );
}
```

- [ ] **Step 5: Mount them.** In `src/routes.tsx`:
  - delete the lazy imports of `MealIdeasScreen`, `MealDetailScreen` and `SampleWeekScreen`, and add `const FoodRoutes = lazy(() => import('@/screens/food/routes'));` beside `GuideRoutes`;
  - replace the four interim routes (`/hub/food`, `/hub/food/ideas`, `/hub/food/ideas/:mealId` and `/hub/food/week`) with `<Route path="/hub/food/*" element={<FoodRoutes />} />`, still before `/hub/:id`.

  `src/screens/guide/routes.tsx` keeps its v1 meal routes: Plan 2 leaves them for the redirect inventory. v1's `/guide/meals…` addresses already redirect to `/hub/food/…` (`src/redirects.ts`), which this route now serves.

- [ ] **Step 6: The Food tile's line.**
  - In `src/screens/home/HomeScreen.tsx`'s `tile(id)`, put this line just before the `if (!mode) return { line: readingLine(id, …` line. `profile`, `today` and `dot` are already there.

    ```ts
        // Never a figure on Home: ideas, or how many meals today (journey §7.2, B-11).
        if (id === 'food') return { line: foodTileLine(foodLevel(profile?.food), mealsOn(mealsIn(state.records), today).length), held: false, ...(dot ? { due: dot } : {}) };
    ```

  - Import `mealsOn` from `@/food/days`, `foodTileLine` from `@/food/format`, `foodLevel` from `@/food/level` and `mealsIn` from `@/food/records`. None of them imports the food table (Task 15 checks).
  - In `src/screens/home/model.ts`, delete `readingLine`'s food branch: `if (id === 'food') return { text: 'Meal ideas for you', tone: 'normal' };`.
  - In `model.test.ts`, delete `expect(readingLine('food', {}).text).toBe('Meal ideas for you');`. `foodTileLine`'s own tests (Task 6) cover the tile now.

- [ ] **Step 7: Warm the food screens.** In `scripts/e2e/acceptance/run.mjs`'s `warm` list, replace `'/hub/food/ideas'` with `'/hub/food', '/hub/food/ideas', '/hub/food/log', '/hub/food/usual'`, and add `'/me/food'` after `'/me/profile'`.

- [ ] **Step 8: Run the gates**

```bash
npx tsc -b && npm run lint && npx vitest run
```

Expected: PASS.

- [ ] **Step 9: Check by eye.** Run `npm run dev`. With a profile whose food pattern is set, at 428×926 and 320×568, in light and dark:
  - the Food tile reads "Meal ideas for you". The hub shows "Lunch · ideas for you" (at lunchtime) with three ideas, then "Log what you eat";
  - "Log what you eat" opens "Log what you eat?". "Yes, meals only, no numbers" closes it, and the same hub now has Today, Options (five rows) and This week;
  - "Log what you ate" opens "Log a meal" on Lunch. A food's "Add" says "Added ✓" for a second, and the item fades into Your meal ("Less" and "More" under it);
  - "Save meal" says "Saving…", the sheet closes, and "Lunch saved" appears. The tile then reads "1 meal logged today";
  - opening that meal from Today and tapping "Delete meal" closes the sheet with "Lunch deleted" and Undo. Undo brings it back;
  - with Reduce Motion on, nothing fades.

- [ ] **Step 10: Commit**

```bash
git add src/screens/food src/routes.tsx src/screens/home/HomeScreen.tsx src/screens/home/model.ts src/screens/home/model.test.ts scripts/e2e/acceptance/run.mjs
git commit -m "feat: Open the Food hub, with logging levels, usual meals and the tile's line"
```

---

### Task 12: The food prompt, as an in-app reminder

**Files:**
- Create: `src/food/prompts.ts`, `src/food/prompts.test.ts`
- Modify: `src/reminders/schedule.ts`, `src/reminders/schedule.test.ts` (append)
- Modify: `src/reminders/copy.ts`, `src/reminders/advice.ts`, `src/reminders/ReminderBanner.tsx`, `src/reminders/ReminderHost.tsx`

**Interfaces:**
- Consumes: `foodLevel` (Task 2); `logHref` (Task 10); `mealsIn` (Task 8); `FOOD_COPY` (Task 6); `parseClock`, `formatClock` and `MINUTES_PER_DAY` from `@/reminders/time`.
- Produces:
  - `src/food/prompts.ts`: `promptDefault(meal: Meal, habits: Pick<HabitSettings, 'mealWalk'> | undefined): string` and `foodPromptTime(profile: UserProfile | undefined): { habit: 'foodLog'; meal: Meal; minute: number } | undefined`;
  - `src/reminders/schedule.ts`:
    - `type ReminderKind = HabitId | 'foodLog'`;
    - `interface InAppTime { habit: ReminderKind; minute: number; meal?: Meal }`;
    - `Occurrence extends InAppTime`;
    - `ReminderContext.mealLogged?: (day: string, meal: Meal) => boolean`;
    - `inAppTimes(context: Pick<ReminderContext, 'habits' | 'profile'>): InAppTime[]`.

    `dailyTimes` is unchanged, and stays the calendar file's only source (board D103).

- [ ] **Step 1: Write the failing tests.** First `src/food/prompts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import type { FoodPreferences } from '@/types/profile';
import { foodPromptTime, promptDefault } from './prompts';

const person = (food: Partial<FoodPreferences>) => createDefaultProfile({ food: { pattern: 'vegetarian', avoid: [], ...food } });

describe('the food prompt (journey §7.4, A-73; board D103)', () => {
  it('is one meal at one time, with estimates only', () => {
    expect(foodPromptTime(person({ level: 'estimates', logReminder: { meal: 'lunch', at: '14:30' } }))).toEqual({ habit: 'foodLog', meal: 'lunch', minute: 870 });
  });
  it('is never there counts-free, with ideas only, when off, or with a time it can’t read (B-11)', () => {
    expect(foodPromptTime(person({ level: 'meals', logReminder: { meal: 'lunch', at: '14:30' } }))).toBeUndefined();
    expect(foodPromptTime(person({ level: 'ideas', logReminder: { meal: 'lunch', at: '14:30' } }))).toBeUndefined();
    expect(foodPromptTime(person({ level: 'estimates' }))).toBeUndefined();
    expect(foodPromptTime(person({ level: 'estimates', logReminder: { meal: 'lunch', at: '2pm' } }))).toBeUndefined();
    expect(foodPromptTime(undefined)).toBeUndefined();
  });
  it('defaults to an hour after the meal’s usual finish, or a fixed hour', () => {
    expect(promptDefault('lunch', { mealWalk: { enabled: true, meals: ['lunch'], finish: { lunch: '13:30' } } })).toBe('14:30');
    expect(promptDefault('dinner', { mealWalk: { enabled: true, meals: ['dinner'], finish: { dinner: '23:30' } } })).toBe('00:30');
    expect(promptDefault('breakfast', undefined)).toBe('10:00');
  });
});
```

Then append this to `src/reminders/schedule.test.ts`. Its `context`, `at`, `WATER`, `D` and `NEXT` are already in the file, and `createDefaultProfile` is already imported.

```ts
describe('the food prompt among the reminders (journey §7.4, §11.5; board D103)', () => {
  const eating = createDefaultProfile({ weightKg: 80, food: { pattern: 'vegetarian', avoid: [], level: 'estimates', logReminder: { meal: 'lunch', at: '14:30' } } });
  const food = (over: Partial<ReminderContext> = {}) => context({ water: WATER }, { profile: eating, ...over });
  it('shows in the app at its time, and never in a calendar file', () => {
    expect(occurrencesOn(D, food()).filter(o => o.habit === 'foodLog')).toEqual([{ habit: 'foodLog', meal: 'lunch', minute: 870, day: D, id: `foodLog:lunch@${D}T14:30` }]);
    expect(dailyTimes({ water: WATER }, eating).some(t => (t.habit as string) === 'foodLog')).toBe(false);
  });
  it('doesn’t show once that meal is logged, in quiet hours, or on a day that isn’t Normal', () => {
    const lunchLogged = food({ mealLogged: (day, meal) => day === D && meal === 'lunch' });
    expect(occurrencesOn(D, lunchLogged).some(o => o.habit === 'foodLog')).toBe(false);
    expect(occurrencesOn(NEXT, lunchLogged).some(o => o.habit === 'foodLog')).toBe(true);
    expect(occurrencesOn(D, context({ water: WATER, quietHours: { from: '14:00', to: '15:00' } }, { profile: eating })).some(o => o.habit === 'foodLog')).toBe(false);
    expect(occurrencesOn(D, food({ status: 'flare' }))).toEqual([]);
  });
  it('goes the moment the meal is logged, if it is already waiting', () => {
    const [prompt] = occurrencesOn(D, food()).filter(o => o.habit === 'foodLog');
    expect(stillDue(prompt, at(D, '14:40'), food())).toBe(true);
    expect(stillDue(prompt, at(D, '14:40'), food({ mealLogged: () => true }))).toBe(false);
  });
  it('is the next reminder the host waits for', () => {
    expect(nextAfter(at(D, '13:30'), food())).toMatchObject({ habit: 'foodLog', minute: 870 });
  });
});
```

- [ ] **Step 2: Run them to check they fail**

Run: `npx vitest run src/food/prompts.test.ts src/reminders/schedule.test.ts`
Expected: FAIL. `./prompts` isn't found, and the scheduler has no food prompt.

- [ ] **Step 3: Write** `src/food/prompts.ts`

```ts
/**
 * The food prompt (journey §7.4, §11.5, A-73; board D103): one meal, at one
 * time, with estimates only, in the app only. Never in a calendar file, which
 * can't know what was logged. The scheduler adds the rest of its rules: never
 * in quiet hours, never while the day isn't Normal, and not once that meal is
 * logged.
 *
 * Kept free of the food table: the reminder host imports this file.
 */
import { formatClock, MINUTES_PER_DAY, parseClock } from '@/reminders/time';
import type { HabitSettings, Meal } from '@/types/habits';
import type { UserProfile } from '@/types/profile';
import { foodLevel } from './level';

/** The prompt's time of day, when the person hasn't set one. */
const FIXED: Record<Meal, string> = { breakfast: '10:00', lunch: '14:30', dinner: '21:30' };

/** When a meal's prompt defaults to: an hour after its usual finish, from setup's meal times, or a fixed hour. */
export function promptDefault(meal: Meal, habits: Pick<HabitSettings, 'mealWalk'> | undefined): string {
  const finish = parseClock(habits?.mealWalk?.finish?.[meal]);
  return finish === undefined ? FIXED[meal] : formatClock((finish + 60) % MINUTES_PER_DAY);
}

/** The food prompt's time, or nothing: off, not with estimates (B-11), or a time that can't be read. */
export function foodPromptTime(profile: UserProfile | undefined): { habit: 'foodLog'; meal: Meal; minute: number } | undefined {
  const reminder = profile?.food?.logReminder;
  if (!reminder || foodLevel(profile?.food) !== 'estimates') return undefined;
  const minute = parseClock(reminder.at);
  return minute === undefined ? undefined : { habit: 'foodLog', meal: reminder.meal, minute };
}
```

- [ ] **Step 4: The scheduler.** In `src/reminders/schedule.ts`:
  - import `foodPromptTime` from `@/food/prompts`;
  - after `HABITS`, add:

    ```ts
    /** An in-app reminder's kind: a habit the person chose, or the food prompt, which no calendar file holds (board D103). */
    export type ReminderKind = HabitId | 'foodLog';

    const KINDS: readonly ReminderKind[] = [...HABITS, 'foodLog'];
    ```

  - before `Occurrence`, add this, and make `Occurrence` extend `InAppTime` in place of `DailyTime`:

    ```ts
    /** One time of day an in-app reminder may show: the habits' (`dailyTimes`) and the food prompt's. */
    export interface InAppTime {
      habit: ReminderKind;
      /** Minutes after local midnight, 0–1439. */
      minute: number;
      meal?: Meal;
    }
    ```

  - add this last field to `ReminderContext`:

    ```ts
      /** Whether that meal is logged on a day: its food prompt then doesn't show (journey §11.5). */
      mealLogged?: (day: string, meal: Meal) => boolean;
    ```

  - before `reminderKey`, add this, and type `reminderKey`'s and `occurrence`'s `time` as `InAppTime`:

    ```ts
    /**
     * The in-app reminders' times: the habits', then the food prompt's, minus
     * quiet hours. A calendar file reads `dailyTimes` alone, so the food prompt
     * is never in one (board D103).
     */
    export function inAppTimes(context: Pick<ReminderContext, 'habits' | 'profile'>): InAppTime[] {
      const times: InAppTime[] = dailyTimes(context.habits, context.profile);
      const food = foodPromptTime(context.profile);
      if (food && !isQuiet(food.minute, context.habits?.quietHours)) times.push(food);
      return times.sort((a, b) => a.minute - b.minute || KINDS.indexOf(a.habit) - KINDS.indexOf(b.habit));
    }
    ```

  - replace `occurrencesOn` with:

    ```ts
    /** The in-app reminders one local day holds, in time order. */
    export function occurrencesOn(day: string, context: ReminderContext, times: readonly InAppTime[] = inAppTimes(context)): Occurrence[] {
      if (!canShow(context, day)) return [];
      const met = waterGoalMet(context, day);
      return times
        .filter(t => !(met && t.habit === 'water') && !(t.habit === 'foodLog' && t.meal !== undefined && context.mealLogged?.(day, t.meal)))
        .map(t => occurrence(t, day));
    }
    ```

  - in `stillDue`, after the water line, add `if (o.habit === 'foodLog' && o.meal !== undefined && context.mealLogged?.(now.day, o.meal)) return false;`. Make its last line `return inAppTimes(context).some(t => t.habit === o.habit && t.meal === o.meal);`, and change its comment to "`inAppTimes` holds only habits that are on and allowed, meals still chosen, and a food prompt still wanted.";
  - in `dueBetween` and `nextAfter`, make `const times = inAppTimes(context);`.

- [ ] **Step 5: Its words, its precautions, its banner and its host.**
  - `src/reminders/copy.ts`: import `FOOD_COPY` from `@/food/copy`, and type `reminderText`'s `time` as `Pick<InAppTime, 'habit' | 'meal'>`. Add this case:

    ```ts
        case 'foodLog':
          return { title: FOOD_COPY.promptTitle(time.meal ? MEAL_LABEL[time.meal] : 'Your meal'), detail: FOOD_COPY.promptDetail };
    ```

  - `src/reminders/advice.ts`: type `habitPrecautions`'s `habit` as `ReminderKind`, and begin it with `if (habit === 'foodLog') return [];` and the comment "The food prompt carries no movement precaution." Every caller (the host, Home, the reminders capsule) is then unchanged.
  - `src/reminders/ReminderBanner.tsx`:
    - add `foodLog: UtensilsIcon` to `ICON`, importing `UtensilsIcon` from `lucide-react`;
    - import `FOOD_COPY`, `logHref` and `MEAL_LABEL` (from `./copy`);
    - add this branch before the `mealWalk` one:

    ```tsx
            ) : occurrence.habit === 'foodLog' && occurrence.meal ? (
              // "Log a meal" opens on this reminder's meal (journey §7.4).
              <Link to={logHref({ meal: occurrence.meal })} viewTransition onClick={() => answerReminder(occurrence.id)} className={primary}>
                {FOOD_COPY.promptAction(MEAL_LABEL[occurrence.meal])}
              </Link>
    ```

  - `src/reminders/ReminderHost.tsx`:
    - take `records` from `useStore()`;
    - add `mealLogged: (day, meal) => mealsIn(records).some(m => m.day === day && m.meal === meal)` to `current`, and `records` to its dependencies;
    - make the schedule key `JSON.stringify([periods ?? [], habits?.inApp, inAppTimes({ habits, profile })])`;
    - import `inAppTimes` in place of `dailyTimes`, and `mealsIn` from `@/food/records`.

  `pending.ts` needs nothing. During an urgent state it already offers water only, so the food prompt waits.

- [ ] **Step 6: Run them**

Run: `npx vitest run src/food/prompts.test.ts src/reminders`
Expected: PASS, the calendar file's tests (`ics.test.ts`) unchanged.

- [ ] **Step 7: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/food/prompts.ts src/food/prompts.test.ts src/reminders
git commit -m "feat: Prompt once a day to log a meal, with estimates only, in the app only"
```

---

### Task 13: Me → Food

This fills Plan 4's Food section, `/me/food`, and replaces its "Logging what you eat" placeholder.

**Files:**
- Modify: `src/screens/you/FoodScreen.tsx` (replace)
- Modify: `src/screens/you/summaries.ts` (`foodLine`), `src/screens/you/summaries.test.ts` (append)

**Interfaces:**
- Consumes:
  - `ALLERGENS` and `allergenName` (Task 3); `FOOD_COPY` and `LEVEL_LABEL` (Task 6); `foodLevel` and `numbersView` (Task 2);
  - `promptDefault` (Task 12); `LevelSheet` (Task 11);
  - `addAvoid`, `FOOD_PATTERN` and `FOOD_REGION` (`./summaries`); `changeProfile` (`./write`);
  - `CheckRows`, `ChoiceRows`, `Segmented`, `TimeField`, `Notice` and `PlainButton` (`./controls`).
- Produces: `FoodScreen` (unchanged name and route), and `foodLine(food)`, which now names allergies and the level.

- [ ] **Step 1: Write the failing test.** Append to `src/screens/you/summaries.test.ts`, where `foodLine` is already imported:

```ts
describe('the Food row on Me (Plan 7)', () => {
  it('names allergies and the logging level, after what the person eats', () => {
    expect(foodLine({ pattern: 'jain', avoid: [], allergies: ['peanut'], customAllergies: ['brinjal'], level: 'meals' })).toBe('Jain · allergic to peanut and brinjal · meals only, no numbers');
    expect(foodLine({ pattern: 'vegetarian', avoid: ['mushrooms'], level: 'estimates' })).toBe('Vegetarian · leaves out mushrooms · meals with estimates');
    expect(foodLine({ pattern: 'vegan', avoid: [], level: 'ideas' })).toBe('Vegan');
  });
});
```

Run: `npx vitest run src/screens/you/summaries.test.ts`
Expected: FAIL. `foodLine` names neither.

- [ ] **Step 2: Me's Food row.** In `src/screens/you/summaries.ts`, import `allergenName` from `@/food/allergens` and `LEVEL_LABEL` from `@/food/copy`, and replace `foodLine` with:

```ts
export function foodLine(food: FoodPreferences | undefined): string {
  if (!food) return 'Not set';
  const allergies = [...(food.allergies ?? []).map(allergenName), ...(food.customAllergies ?? [])];
  return [
    FOOD_PATTERN[food.pattern],
    allergies.length > 0 ? `allergic to ${listOf(allergies)}` : undefined,
    food.avoid.length > 0 ? `leaves out ${listOf(food.avoid)}` : undefined,
    food.level && food.level !== 'ideas' ? LEVEL_LABEL[food.level].toLowerCase() : undefined,
  ].filter(Boolean).join(' · ');
}
```

Run: `npx vitest run src/screens/you/summaries.test.ts`
Expected: PASS, the existing `foodLine` cases included.

- [ ] **Step 3: The screen.** Replace `src/screens/you/FoodScreen.tsx` with the following.
  - It keeps Plan 4's title, Back and footer.
  - Its region edit now keeps every other preference. The old one rebuilt the preferences from three fields, which would have dropped the level, the allergies, a target and the reminder.
  - The target and the reminder are for estimates only (journey §11.5, B-11).

```tsx
import { useId, useState, type FormEvent } from 'react';
import { XIcon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { ALLERGENS } from '@/food/allergens';
import { FOOD_COPY, LEVEL_LABEL } from '@/food/copy';
import { foodLevel, numbersView } from '@/food/level';
import { promptDefault } from '@/food/prompts';
import { LevelSheet } from '@/screens/food/LevelSheet';
import { formatDayShort } from '@/screens/track/format';
import { NumberField } from '@/screens/track/ui';
import { useToday } from '@/screens/track/useToday';
import { useStore } from '@/store/useStore';
import type { Meal } from '@/types/habits';
import type { AllergenId, FoodPreferences } from '@/types/profile';
import { CheckRows, ChoiceRows, Notice, PlainButton, Segmented, TimeField, type Choice } from './controls';
import { AVOID_MAX_ITEMS, AVOID_MAX_LENGTH, FOOD_PATTERN, FOOD_REGION, addAvoid } from './summaries';
import { changeProfile } from './write';

type Pattern = FoodPreferences['pattern'];
type Region = NonNullable<FoodPreferences['region']>;

const PATTERNS: Choice<Pattern>[] = (Object.keys(FOOD_PATTERN) as Pattern[]).map(value => ({ value, label: FOOD_PATTERN[value] }));
const REGIONS: Choice<Region | 'none'>[] = [
  { value: 'none', label: 'No preference' },
  ...(Object.keys(FOOD_REGION) as Region[]).map(value => ({ value, label: FOOD_REGION[value] })),
];
const ALLERGY_CHOICES: Choice<AllergenId>[] = ALLERGENS.map(a => ({ value: a.id, label: a.label }));
const REMINDER_MEALS: { value: Meal | 'off'; label: string }[] = [
  { value: 'off', label: FOOD_COPY.reminderOff },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];

/** A whole number from a field, within bounds; blank is none; `null` can't be right. */
function whole(text: string, max: number): number | undefined | null {
  if (text.trim() === '') return undefined;
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
}

/**
 * Me → Food (journey §16): what meal ideas may include, allergies, the
 * logging level, a target from the person's care team, and the reminder to
 * log. Only what the person says: the app never guesses a diet, and none of
 * this leaves the device.
 */
export function FoodScreen() {
  const { profile, settings } = useStore();
  const food = profile?.food;
  const level = foodLevel(food);
  // A target and the prompt are for estimates only (journey §11.5, B-11).
  const numbers = numbersView(profile);
  const today = useToday();
  const ids = { avoid: useId(), allergy: useId(), time: useId() };
  const [problem, setProblem] = useState<string>();
  const [choosing, setChoosing] = useState(false);
  const [kcal, setKcal] = useState(String(food?.careTeamTargets?.kcal ?? ''));
  const [carbs, setCarbs] = useState(String(food?.careTeamTargets?.carbsG ?? ''));

  /** Each change is worked out from the stored preferences at the moment it is written. */
  const edit = async (change: (food: FoodPreferences | undefined) => FoodPreferences | undefined) => {
    const saved = await changeProfile(current => {
      const next = change(current.food);
      const edited = { ...current };
      if (next) edited.food = next;
      else delete edited.food;
      return edited;
    });
    setProblem(saved.ok ? undefined : `That did not save. ${saved.failure.message}`);
    return saved.ok;
  };

  const saveTarget = () => {
    const k = whole(kcal, 10_000);
    const c = whole(carbs, 2_000);
    if (k === null || c === null || (k === undefined && c === undefined)) {
      setProblem(FOOD_COPY.targetBad);
      return;
    }
    void edit(current => current && { ...current, careTeamTargets: { ...(k ? { kcal: k } : {}), ...(c ? { carbsG: c } : {}), setOn: today } });
  };
  const removeTarget = () => {
    setKcal('');
    setCarbs('');
    void edit(current => {
      if (!current) return current;
      const next = { ...current };
      delete next.careTeamTargets;
      return next;
    });
  };

  return (
    <Screen title="Food" back={{ to: '/me', label: 'Me' }}>
      <Group header="What you eat" footer="Meal ideas use this. The app only knows what you tell it.">
        <ChoiceRows
          label="What you eat"
          options={PATTERNS}
          value={food?.pattern}
          onChange={pattern => void edit(current => ({ avoid: [], ...current, pattern }))}
        />
      </Group>

      {food && (
        <Group header={FOOD_COPY.allergiesGroup} footer={FOOD_COPY.allergiesFooter}>
          <CheckRows
            label={FOOD_COPY.allergiesGroup}
            options={ALLERGY_CHOICES}
            value={food.allergies ?? []}
            onChange={allergies => void edit(current => current && { ...current, allergies })}
          />
        </Group>
      )}

      {food && (
        <WordList
          header={FOOD_COPY.somethingElse}
          inputId={ids.allergy}
          inputLabel={FOOD_COPY.somethingElse}
          placeholder={FOOD_COPY.somethingElsePlaceholder}
          items={food.customAllergies ?? []}
          onAdd={entry => edit(current => current && { ...current, customAllergies: addAvoid(current.customAllergies ?? [], entry) })}
          onRemove={item => void edit(current => {
            if (!current) return current;
            const left = (current.customAllergies ?? []).filter(a => a !== item);
            const next: FoodPreferences = { ...current, customAllergies: left };
            if (left.length === 0) delete next.customAllergies;
            return next;
          })}
        />
      )}

      {food && (
        <WordList
          header="Leave out"
          footer={FOOD_COPY.avoidFooter}
          inputId={ids.avoid}
          inputLabel="A food to leave out"
          placeholder="For example, mushrooms"
          items={food.avoid}
          onAdd={entry => edit(current => current && { ...current, avoid: addAvoid(current.avoid, entry) })}
          onRemove={item => void edit(current => current && { ...current, avoid: current.avoid.filter(a => a !== item) })}
        />
      )}

      {food && (
        <Group header="Region (optional)" footer="For familiar examples. It never changes the guidance itself.">
          <ChoiceRows
            label="Region"
            options={REGIONS}
            value={food.region ?? 'none'}
            // Every other preference stays: the level, allergies, a target, the reminder.
            onChange={region => void edit(current => {
              if (!current) return current;
              const next = { ...current };
              if (region === 'none') delete next.region;
              else next.region = region;
              return next;
            })}
          />
        </Group>
      )}

      {food && (
        <Group header={FOOD_COPY.levelGroup} footer={FOOD_COPY.levelFooter}>
          <Row onClick={() => setChoosing(true)} label={FOOD_COPY.levelGroup} detail={LEVEL_LABEL[level]} chevron />
        </Group>
      )}

      {food && numbers.show && (
        <Group
          header={FOOD_COPY.targetGroup}
          footer={food.careTeamTargets ? `${FOOD_COPY.targetSetOn(formatDayShort(food.careTeamTargets.setOn, today))} ${FOOD_COPY.targetFooter}` : FOOD_COPY.targetFooter}
        >
          <div className="flex flex-col gap-3 px-4 py-3">
            <NumberField label={FOOD_COPY.targetKcal} mode="numeric" unit="kcal" value={kcal} onChange={v => { setKcal(v); setProblem(undefined); }} />
            <NumberField label={FOOD_COPY.targetCarbs} mode="numeric" unit="g" value={carbs} onChange={v => { setCarbs(v); setProblem(undefined); }} />
            <PlainButton onClick={saveTarget}>{FOOD_COPY.targetSave}</PlainButton>
            {food.careTeamTargets && <PlainButton tone="stop" onClick={removeTarget}>{FOOD_COPY.targetRemove}</PlainButton>}
          </div>
        </Group>
      )}

      {food && numbers.show && (
        <Group header={FOOD_COPY.reminderGroup} footer={FOOD_COPY.reminderFooter}>
          <div className="flex flex-col gap-3 px-4 py-3">
            <Segmented
              label={FOOD_COPY.reminderMeal}
              options={REMINDER_MEALS}
              value={food.logReminder?.meal ?? 'off'}
              onChange={meal => void edit(current => {
                if (!current) return current;
                const next = { ...current };
                if (meal === 'off') delete next.logReminder;
                else next.logReminder = { meal, at: current.logReminder?.meal === meal ? current.logReminder.at : promptDefault(meal, settings.habits) };
                return next;
              })}
            />
            {food.logReminder && (
              <TimeField
                id={ids.time}
                label={FOOD_COPY.reminderTime}
                value={food.logReminder.at}
                onChange={at => void edit(current => (current?.logReminder ? { ...current, logReminder: { ...current.logReminder, at } } : current))}
              />
            )}
          </div>
        </Group>
      )}

      {problem && <Notice tone="error">{problem}</Notice>}
      {food && <PlainButton tone="stop" onClick={() => void edit(() => undefined)}>Clear food preferences</PlainButton>}
      <LevelSheet open={choosing} onOpenChange={setChoosing} />
    </Screen>
  );
}

/** A list of the person's own words, each removable, with a field to add one. */
function WordList({ header, footer, inputId, inputLabel, placeholder, items, onAdd, onRemove }: {
  header: string;
  footer?: string;
  inputId: string;
  inputLabel: string;
  placeholder: string;
  items: readonly string[];
  onAdd: (entry: string) => Promise<boolean>;
  onRemove: (item: string) => void;
}) {
  const [typed, setTyped] = useState('');
  const add = async (event: FormEvent) => {
    event.preventDefault();
    const entry = typed;
    // Cleared at once, so the next entry can be typed while this one saves;
    // put back only if it did not save and nothing new has been typed.
    setTyped('');
    if (!(await onAdd(entry))) setTyped(now => now || entry);
  };
  return (
    <Group header={header} {...(footer ? { footer } : {})}>
      {items.map(item => (
        <Row
          key={item}
          label={item}
          className="py-1"
          accessory={
            <button
              type="button"
              aria-label={`Remove ${item}`}
              onClick={() => onRemove(item)}
              className="press-feedback -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground"
            >
              <XIcon className="size-5" aria-hidden />
            </button>
          }
        />
      ))}
      {items.length < AVOID_MAX_ITEMS && (
        <form onSubmit={event => void add(event)} className="flex min-h-[3.25rem] items-center gap-2 px-4 py-1.5">
          <label htmlFor={inputId} className="sr-only">{inputLabel}</label>
          <input
            id={inputId}
            type="text"
            value={typed}
            maxLength={AVOID_MAX_LENGTH}
            enterKeyHint="done"
            autoComplete="off"
            placeholder={placeholder}
            onChange={e => setTyped(e.target.value)}
            className="min-h-11 min-w-0 flex-1 bg-transparent text-[length:var(--text-body)] outline-none placeholder:text-muted-foreground"
          />
          <button type="submit" disabled={!typed.trim()} className="press-feedback min-h-11 shrink-0 px-2 text-[length:var(--text-body)] font-semibold text-tint disabled:opacity-40">
            Add
          </button>
        </form>
      )}
    </Group>
  );
}
```

- [ ] **Step 4: Gates**

```bash
npx tsc -b && npm run lint && npx vitest run
```

Expected: PASS.

- [ ] **Step 5: Check by eye.** Open `#/me/food` at 428×926 and 320×568, at 200% text too. Check:
  - "Log what you eat" opens the level sheet;
  - with estimates, "Daily target from your care team (optional)" saves "From your care team, set on 10 Oct.";
  - "Reminder to log" on Lunch shows "At" with the default time;
  - ticking Peanuts leaves "Vegetable poha" out of the Food hub's breakfast ideas;
  - Me's Food row reads, for example, "Vegetarian · allergic to peanut · meals with estimates".

- [ ] **Step 6: Commit**

```bash
git add src/screens/you/FoodScreen.tsx src/screens/you/summaries.ts src/screens/you/summaries.test.ts
git commit -m "feat: Fill Me → Food with allergies, the logging level, a care-team target and the reminder"
```

---

### Task 14: Meals in Today's log, and "Meal" in Add

**Files:**
- Modify: `src/screens/track/timeline.ts`, `src/screens/track/timeline.test.ts` (append)
- Modify: `src/screens/track/MyDay.tsx`, `src/screens/track/QuickLog.tsx`

**Interfaces:**
- Consumes: `mealRowDetail` and `SLOT_LABEL` (Task 6); `NumbersView`, `numbersView` and `logsMeals` (Task 2); `logHref` (Task 10); `mealsIn` (Task 8); `useFoodUndoScope` (Task 10).
- Produces:
  - `RecordRef` gains `{ type: 'meal'; id: string }`, and `recordPath` gives it `logHref({ edit: id })`;
  - `DayData` gains `meals?: readonly MealRecord[]` and `numbers?: NumbersView`.

- [ ] **Step 1: Write the failing test.** Append to `src/screens/track/timeline.test.ts`. Its `day`, `empty` and `DEFAULT_PREFS` are already there.

```ts
describe('meals in Today’s log (Plan 7)', () => {
  const roti = { kind: 'food', foodId: 'roti', rev: 1, name: 'Roti', unit: 'piece', count: 2, gramsPerPortion: 40, kcal: 204, carbsG: 43.2 } as const;
  const lunch = { id: 'meal-1', at: '2026-10-08T13:10:00.000+05:30', day, meal: 'lunch', items: [roti], level: 'estimates', loggedAt: '2026-10-08T13:15:00.000+05:30', edits: [] } as const;
  const meals = [{ ...lunch, items: [...lunch.items], edits: [] }];

  it('lists a meal at its time, opening it to correct', () => {
    const view = assembleDay(day, { ...empty, meals, numbers: { show: true, ranges: false } }, DEFAULT_PREFS);
    expect(view.rows.map(r => [r.title, r.detail])).toEqual([['Lunch', '13:10 · Roti ×2 · Estimated 200 kcal']]);
    expect(view.rows[0].ref).toEqual({ type: 'meal', id: 'meal-1' });
    expect(recordPath(view.rows[0].ref)).toBe('/hub/food/log?edit=meal-1');
  });
  it('shows no figure counts-free, though the meal carries its estimate (B-11, Review Focus 3)', () => {
    expect(assembleDay(day, { ...empty, meals, numbers: { show: false } }, DEFAULT_PREFS).rows[0].detail).toBe('13:10 · Roti ×2');
    expect(assembleDay(day, { ...empty, meals }, DEFAULT_PREFS).rows[0].detail).toBe('13:10 · Roti ×2');
  });
  it('lists a meal corrected past midnight on its new day only (Review Focus 4)', () => {
    const moved = [{ ...meals[0], at: '2026-10-09T00:20:00.000+05:30', day: '2026-10-09' }];
    expect(assembleDay(day, { ...empty, meals: moved }, DEFAULT_PREFS).rows).toEqual([]);
    expect(assembleDay('2026-10-09', { ...empty, meals: moved }, DEFAULT_PREFS).rows.map(r => r.key)).toEqual(['meal:meal-1']);
  });
});
```

Run: `npx vitest run src/screens/track/timeline.test.ts`
Expected: FAIL. No meal row is listed yet.

- [ ] **Step 2: Meal rows.** In `src/screens/track/timeline.ts`:
  - import `mealRowDetail` and `SLOT_LABEL` from `@/food/format`, `type NumbersView` from `@/food/level`, `logHref` from `@/food/links` and `type MealRecord` from `@/food/types`;
  - add `| { type: 'meal'; id: string }` to `RecordRef`, documented "A logged meal: it opens in "Log a meal", to correct it (journey §11.3).", and add `case 'meal': return logHref({ edit: ref.id });` to `recordPath`;
  - add these fields to `DayData`:

    ```ts
      /** Logged meals (Plan 7), each on the day it was eaten. */
      meals?: readonly MealRecord[];
      /** What a meal's line may show (B-11): absent shows no figure. */
      numbers?: NumbersView;
    ```

  - add this above `byTime`:

    ```ts
    /** A meal: what was eaten, at its time, with its estimate only when numbers are shown (B-11, Review Focus 3). */
    function mealRow(m: MealRecord, numbers: NumbersView, prefs: DisplayPrefs): TimelineRow {
      return {
        key: `meal:${m.id}`,
        ref: { type: 'meal', id: m.id },
        title: SLOT_LABEL[m.meal],
        detail: mealRowDetail(m, numbers, prefs.hour12),
        ids: [m.id],
        at: Date.parse(m.at),
        // After any reading at the same moment.
        order: OBSERVATION_KINDS.length,
      };
    }
    ```

  - in `assembleDay`, after the reading rows and before `rows.sort(byTime)`, add:

    ```ts
      // A meal is listed on the day it was eaten: a correction past midnight moves it (Review Focus 4).
      for (const m of data.meals ?? []) if (m.day === day) rows.push(mealRow(m, data.numbers ?? { show: false }, prefs));
    ```

Run: `npx vitest run src/screens/track/timeline.test.ts`
Expected: PASS.

- [ ] **Step 3: My Day passes them, and keeps a deleted meal's Undo.** In `src/screens/track/MyDay.tsx`:
  - in `TimelineView`, take `profile` and `records` from `useStore()`. Make the call `assembleDay(day, { observations, sessions, checkIns, settings, meals: mealsIn(records), numbers: numbersView(profile) }, prefs)`, and add `records` and `profile` to its `useMemo` dependencies;
  - in `MyDay`, right after `const location = useLocation();`, add:

    ```ts
      // A meal deleted from here keeps its Undo until the person leaves (B-04).
      useFoodUndoScope(location.pathname);
    ```

  - import `numbersView`, `mealsIn` and `useFoodUndoScope`.

  A meal row links through `recordPath`, like every other row, with My Day's `origin` state. Closing the sheet then pops back here.

- [ ] **Step 4: "Meal" in Add.** In `src/screens/track/QuickLog.tsx`, after the Workout row, add the row below. Import `UtensilsIcon` with `DumbbellIcon`, and import `logsMeals` from `@/food/level` and `logHref` from `@/food/links`.

```tsx
            {logsMeals(profile?.food) && (
              <Row
                as="button"
                type="button"
                icon={<UtensilsIcon aria-hidden />}
                label="Meal"
                detail={pastDay ? `Log a meal for ${formatDayShort(pastDay, current)}` : 'What you ate, in Food'}
                chevron
                // As Workout: only a navigation. "Log a meal" opens over the Food hub, and closing it comes back here.
                onClick={() => navigate(logHref(pastDay ? { day: pastDay } : {}), { viewTransition: true })}
              />
            )}
```

- [ ] **Step 5: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/track/timeline.ts src/screens/track/timeline.test.ts src/screens/track/MyDay.tsx src/screens/track/QuickLog.tsx
git commit -m "feat: List meals in Today's log, and add Meal to Add"
```

---

### Task 15: The first screen's boundary, and counts-free everywhere

**Files:**
- Create: `src/food/boundaries.node.test.ts`
- Modify: every screen the test names that shows an energy figure without asking the gate. After Plan 6, expect `src/screens/walk/WalkSummary.tsx` and `src/screens/track/RecordDetails.tsx`, where walks show "about N kcal".

**Interfaces:**
- Consumes: `countsFree` (Task 2).
- Produces: two checks that run with the unit gates.

- [ ] **Step 1: Write the test** `src/food/boundaries.node.test.ts`
  - The first case walks the static imports from `src/main.tsx` (never `import()` or `import type`). The food table must not be among them.
  - The second scans every screen. A file that shows a nutrition or energy figure must ask `numbersView()` or `countsFree()`, unless it only words figures for a caller that asks. Such a file is listed in `WORDS_ONLY`, with that caller.

```ts
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve('src');
const rel = (file: string) => path.relative(path.resolve('.'), file).split(path.sep).join('/');

/** The file an import names, as Vite resolves it here: `@/` is `src/`. Packages are left out. */
function resolve(from: string, spec: string): string | undefined {
  const base = spec.startsWith('@/') ? path.join(SRC, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(from), spec) : undefined;
  if (!base) return undefined;
  for (const ending of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const file = base + ending;
    if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  }
  return undefined;
}

/** Every file the first screen loads: static imports from `src/main.tsx`, never `import()` or `import type`. */
function firstScreen(): Set<string> {
  const seen = new Set<string>();
  const todo = [path.join(SRC, 'main.tsx')];
  while (todo.length > 0) {
    const file = todo.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!/\.tsx?$/.test(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(/^\s*(?:import|export)\s+(type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm)) {
      if (m[1]) continue;
      const next = resolve(file, m[2]);
      if (next) todo.push(next);
    }
  }
  return new Set([...seen].map(rel));
}

/** Every source file under these folders, tests left out. */
function sources(...dirs: string[]): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(file);
    }
  };
  for (const d of dirs) walk(path.join(SRC, d));
  return out;
}

/** Anything that shows a nutrition figure, or an energy figure from movement. */
const SHOWS_FIGURE = /\bkcal\b|activeEnergy|energyText\(|energyKcal|\b(?:itemEstimate|totalsLines|mealRowDetail|foodRowDetail|careTeamLine|kcalText|carbsText|dayLine|dailyNutrition)\(/;
/** Asking the gate: the person's level decides (B-11). */
const ASKS = /\bcountsFree\(|\bnumbersView\(/;
/**
 * Files that only word figures for a caller that asks the gate, each with
 * that caller. Add one here only with the caller that gates it.
 */
const WORDS_ONLY: Record<string, string> = {
  'src/screens/track/timeline.ts': 'MyDay.tsx passes numbersView() in DayData.numbers',
  'src/screens/food/parts.tsx': 'LogMealSheet.tsx passes numbersView() to every part',
};

describe('the food table stays out of the first screen (Global Constraints)', () => {
  it('is never loaded by anything src/main.tsx imports statically', () => {
    const loaded = firstScreen();
    expect(loaded.has('src/main.tsx')).toBe(true);
    expect(loaded.has('src/screens/home/HomeScreen.tsx')).toBe(true);
    expect([...loaded].filter(f => f === 'src/food/data.ts' || f.startsWith('src/data/food/'))).toEqual([]);
  });
});

describe('counts-free hides every figure (B-11)', () => {
  it('every screen that shows a nutrition or energy figure asks numbersView() or countsFree()', () => {
    const offenders = sources('screens', 'components', 'pages', 'reminders')
      .filter(file => {
        const text = fs.readFileSync(file, 'utf8');
        return SHOWS_FIGURE.test(text) && !ASKS.test(text) && !(rel(file) in WORDS_ONLY);
      })
      .map(rel);
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/food/boundaries.node.test.ts`
Expected:
- the first case passes. Tasks 6, 8, 9, 12 and 14 kept `src/food/data.ts` out of everything Home, the reminder host and the store import;
- the second fails, naming the walk screens that show Plan 6's energy figure.

If the first case fails, the name it prints is the import to break. Move the table lookup behind the screen that needs it.

- [ ] **Step 3: Counts-free hides movement energy too (B-11; board D101).** In each file the test names:
  - read the person's level with `countsFree(profile)` from `@/food/level`, where `profile` is the screen's `useStore().profile`;
  - leave the energy row or line out when it's true. For example, in a walk summary built from `energyText`:

    ```tsx
    {!countsFree(profile) && energy && <Row label="Energy" value={energy.value} detail={energy.detail} />}
    ```

  - leave the stored `activeEnergy` record alone. Counts-free decides what's shown, never what's kept, so switching levels later shows it again (board D101).

  A file that only words figures for a caller that asks the gate (a formatter, say) goes into `WORDS_ONLY` instead, with that caller named.

- [ ] **Step 4: Run it again**

Run: `npx vitest run src/food/boundaries.node.test.ts`
Expected: PASS.

- [ ] **Step 5: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/food/boundaries.node.test.ts src/screens
git commit -m "test: Keep the food table off the first screen, and every figure behind counts-free"
```

---

### Task 16: Acceptance: V-J03 and V-J28 to V-J31

**Files:**
- Create: `scripts/e2e/acceptance/lib/food.mjs`
- Create: `scripts/e2e/acceptance/journeys/v03.mjs`, `v28.mjs`, `v29.mjs`, `v30.mjs`, `v31.mjs`
- Modify: `scripts/e2e/acceptance/run.mjs` (only if its filter doesn't take `v` journeys yet)
- Modify: `docs/reimagine/BOARD.md` (append the result)

**Interfaces:**
- Consumes:
  - the harness's `t.open`, `t.step`, `t.check`, `t.must`, `t.note`, `t.pending`, `t.db`, `t.checkpoint`, `t.route` and `t.setPageFaults`; `docs` (`lib/harness.mjs`);
  - `lib/ui.mjs` (`tap`, `type`, `row`, `button`, `sheet`, `back`, `tab`, `legacyTab`, `exact`);
  - `lib/data.mjs` (`writeFixture`, `transferDoc`, `chooseRestore`, `merge`, `logGlucose`, `trackDay`);
  - `persona` (`fixtures/personas.mjs`).
- Produces: five journeys, `V-J03` and `V-J28` to `V-J31`, each a module exporting `id`, `title` and `cases`.

**How each journey sets up:**
- **Food preferences** go in through the persona's v4 blob. The v4 migration copies the profile as it is.
- **Meals** go in through Me → Data → Restore → Merge, from a backup file the journey writes. The record therefore enters through the same validation an import gets (Task 8).
- **The clock** is NOW (Thursday 8 October, 09:00 IST, breakfast by the sheet's clock), or `food.LUNCHTIME` (13:20, lunch).

- [ ] **Step 1: Check the runner takes `v` journeys**

```bash
grep -n "jsv\|jmsv" scripts/e2e/acceptance/run.mjs
```

Expected: one match (Plans 2, 4 or 6 widened the filter). If there's none, change the filter to `/^[jsv]\d\d\.mjs$/`.

- [ ] **Step 2: The helpers** `scripts/e2e/acceptance/lib/food.mjs`

```js
/**
 * Food journeys' helpers (V-J03, V-J28 to V-J31): meals seeded through Me →
 * Data's own Merge, the Food tile and hub, and the "Log a meal" sheet. Names
 * are the food table's (src/data/food/foods.json) and the sheet's own words
 * (src/food/copy.ts).
 */
import * as data from './data.mjs';
import * as ui from './ui.mjs';

/** 13:20 on Thursday 8 October: lunchtime by the sheet's clock. */
export const LUNCHTIME = Date.parse('2026-10-08T13:20:00+05:30');

/** An item from the food table, as a meal keeps it (src/food/types.ts `FoodItem`). */
export const item = (foodId, name, unit, count, gramsPerPortion) => ({ kind: 'food', foodId, rev: 1, name, unit, count, gramsPerPortion });
export const ROTI = item('roti', 'Roti (whole-wheat)', 'piece', 2, 40);
export const DAL = item('toor-dal', 'Toor dal', 'katori', 1, 150);
export const DAHI = item('dahi', 'Dahi (curd)', 'katori', 1, 100);

/** A logged meal (src/food/types.ts `MealRecord`). */
export const meal = (id, at, slot, items, level = 'meals') => ({ id, at, day: at.slice(0, 10), meal: slot, items, level, loggedAt: at, edits: [] });

/** Yesterday's lunch, 13:10: roti, dal and dahi. */
export const USUAL_LUNCH = meal('meal-seed-lunch', '2026-10-07T13:10:00.000+05:30', 'lunch', [ROTI, DAL, DAHI]);

/** Meals put on this phone the way a person would: a backup file, through Me → Data → Restore → Merge. */
export async function seedMeals(t, meals) {
  const file = data.writeFixture(t, 'meals.json', data.transferDoc({ schemaVersion: 6, stores: ['meals'], records: { meals } }));
  const sheet = await data.chooseRestore(t, file);
  await data.merge(t, sheet);
  await ui.tap(ui.button(sheet, 'Done'));
  await sheet.waitFor({ state: 'hidden' });
}

const esc = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A list group by its own header, never a section around it. Headers are drawn in capitals, so the match ignores case. */
export const group = (scope, header) => scope.locator('section > h2').filter({ hasText: new RegExp(`^\\s*${esc(header)}\\s*$`, 'i') }).locator('xpath=..');

/** One of the hub's regions, named by its visible heading ("Right now", "Today", "This week"). */
export const region = (page, title) => page.getByRole('region', { name: title, exact: true });

/** Home's Food tile. */
export const tile = page => page.locator('[data-tile="food"]').getByRole('link');

/** Food, from Home's tile, the way a person gets there. Returns the hub's main region. */
export async function openHub(t, tap = ui.tap) {
  const page = t.page;
  await ui.tab(page, 'Home');
  await tap(tile(page));
  await page.getByRole('heading', { level: 1, name: 'Food', exact: true }).waitFor();
  return page.getByRole('main');
}

/** The open "Log a meal" sheet, or "Edit lunch" and the like. */
export const logSheet = page => page.getByRole('dialog', { name: /^(Log a meal|Edit (breakfast|lunch|snack|dinner))$/ });

/** The tray's item names, in order. */
export const trayNames = sheet => sheet.locator('[data-item]').evaluateAll(els => els.map(e => e.getAttribute('data-item')));

/** One tray item, by its name. */
export const trayItem = (sheet, name) => sheet.locator(`[data-item="${name}"]`);

/** A food row's "+": its accessible name is "Add <food>". */
export const addButton = (sheet, name) => sheet.getByRole('button', { name: `Add ${name}`, exact: true });

/** A toast's exact words. */
export const toast = (page, text) => page.locator('#toasts').getByText(text, { exact: true });

/** The meals stored for a day, in a database snapshot. */
export const mealsOn = (snap, day) => (snap.meals ?? []).filter(m => m.day === day);

/** Words that must never show while counts-free (B-11). */
export const FIGURES = /\bkcal\b|\bg carbs\b|Estimated/;
```

- [ ] **Step 3: V-J03** `scripts/e2e/acceptance/journeys/v03.mjs`. Three taps, "Lunch saved" only once stored, and no figure counts-free. A second case refuses the first write.

```js
/**
 * V-J03 (journey §17.1, B-10, B-11, §4.5): log a usual lunch in three taps.
 *
 * Cases:
 *   usual-lunch   P01, meals only. Yesterday's lunch merged in. Food tile → "Same as yesterday’s lunch" → "Save meal".
 *   refused-save  The same, with the meals store refusing the first write: no "Lunch saved", the tray kept, then saved once.
 */
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as food from '../lib/food.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J03';
export const title = 'Log a usual lunch';

const MEALS_ONLY = { patch: { profile: { food: { level: 'meals' } } } };
const TODAY = '2026-10-08';

const usualLunch = {
  name: 'usual-lunch',
  async run(t) {
    const page = await t.open({ seed: persona('P01', MEALS_ONLY), route: '/home', time: food.LUNCHTIME });

    await t.step(1, 'Yesterday’s lunch is on this phone, merged from a backup', async () => {
      await food.seedMeals(t, [food.USUAL_LUNCH]);
      await t.must(food.mealsOn(await t.db(), '2026-10-07').length === 1, 'yesterday’s lunch did not merge');
    });

    await t.step(2, 'Food tile → "Same as yesterday’s lunch" → "Save meal": three taps (B-10)', async () => {
      let taps = 0;
      const tap = async locator => { taps += 1; await ui.tap(locator); };
      const main = await food.openHub(t, tap);
      await tap(ui.row(main, 'Same as yesterday’s lunch', 'link'));
      const sheet = food.logSheet(page);
      await sheet.waitFor();
      const names = await food.trayNames(sheet);
      await t.check(names.join('|') === 'Roti (whole-wheat)|Toor dal|Dahi (curd)', `the tray holds ${names.join(', ')}`);
      await t.check(!food.FIGURES.test(await sheet.innerText()), 'the sheet shows a figure while counts-free (B-11)');
      await tap(ui.button(sheet, 'Save meal'));
      await food.toast(page, 'Lunch saved').waitFor();
      // "Lunch saved" only once it is stored (journey §4.5).
      const stored = food.mealsOn(await t.db(), TODAY);
      await t.check(stored.length === 1 && stored[0].meal === 'lunch' && stored[0].items.length === 3 && stored[0].level === 'meals',
        `stored for today: ${JSON.stringify(stored)}`);
      await t.check(taps === 3, `the usual lunch took ${taps} taps, not 3 (B-10)`);
      await sheet.waitFor({ state: 'hidden' });
    });

    await t.step(3, 'The Food tile counts it, and Today’s log lists it with no figure (B-11)', async () => {
      await ui.tab(page, 'Home');
      const line = await food.tile(page).innerText();
      await t.check(/1 meal logged today/.test(line), `the Food tile reads “${line.replace(/\s+/g, ' ')}”`);
      await ui.legacyTab(page, 'Track');
      await data.trackDay(page, TODAY);
      const row = ui.row(page.getByRole('main'), 'Lunch', 'link');
      const text = (await row.innerText()).replace(/\s+/g, ' ');
      await t.check(/Roti \(whole-wheat\) ×2 · Toor dal · Dahi \(curd\)/.test(text), `Today’s log’s lunch reads “${text}”`);
      await t.check(!food.FIGURES.test(text), `Today’s log shows a figure while counts-free: “${text}”`);
      await t.checkpoint('after-usual-lunch');
    });
  },
};

const refusedSave = {
  name: 'refused-save',
  async run(t) {
    const page = await t.open({ seed: persona('P01', MEALS_ONLY), route: '/home', time: food.LUNCHTIME });
    await food.seedMeals(t, [food.USUAL_LUNCH]);

    await t.step(1, 'The meals store refuses the first write: no "Lunch saved", and the tray stays', async () => {
      const main = await food.openHub(t);
      await ui.tap(ui.row(main, 'Same as yesterday’s lunch', 'link'));
      const sheet = food.logSheet(page);
      await sheet.waitFor();
      await t.setPageFaults([{ op: 'put', store: 'meals', action: 'abortAfterQueue', times: 1 }]);
      await ui.tap(ui.button(sheet, 'Save meal'));
      await sheet.getByText(/^That didn’t save\./).waitFor();
      await t.check(await food.toast(page, 'Lunch saved').count() === 0, '“Lunch saved” showed for a write that was refused');
      await t.check(food.mealsOn(await t.db(), TODAY).length === 0, 'a refused write left a meal stored');
      await t.check((await food.trayNames(sheet)).length === 3, 'the tray was lost when the write was refused');
    });

    await t.step(2, 'Save again: stored once', async () => {
      const sheet = food.logSheet(page);
      await ui.tap(ui.button(sheet, 'Save meal'));
      await food.toast(page, 'Lunch saved').waitFor();
      await t.check(food.mealsOn(await t.db(), TODAY).length === 1, 'the second save did not store exactly one meal');
    });
  },
};

export const cases = [usualLunch, refusedSave];
```

- [ ] **Step 4: V-J28** `scripts/e2e/acceptance/journeys/v28.mjs`. Logging is turned on from the hub, in place. Estimates come only after the screening question.

```js
/**
 * V-J28 (journey §17.2, §11.1, §11.5, K-22): Food with logging off → meal
 * ideas → turn logging on → the same hub.
 *
 * Cases:
 *   meals-only   P01 with logging off. The hub shows ideas and "Log what you eat"; "Meals only, no numbers" turns logging on in place.
 *   estimates    "With calorie and carb estimates": the screening question first; "Prefer not to say" recommends meals only; "With estimates anyway" keeps estimates.
 */
import { persona } from '../fixtures/personas.mjs';
import { docs } from '../lib/harness.mjs';
import * as food from '../lib/food.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J28';
export const title = 'Food with logging off, then on';

const LEVEL_SHEET = 'Log what you eat?';

/** The hub with logging off: three ideas for lunch, and the way in to logging. */
async function hubWithLoggingOff(t) {
  const main = await food.openHub(t);
  const ideas = food.group(main, 'Lunch · ideas for you');
  await t.check(await ideas.getByRole('link').count() === 3, `“Lunch · ideas for you” lists ${await ideas.getByRole('link').count()} ideas, not 3`);
  await t.check(await ui.row(main, 'Log a meal', 'link').count() === 0, 'Options offers “Log a meal” with logging off');
  return main;
}

const mealsOnly = {
  name: 'meals-only',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/home', time: food.LUNCHTIME });

    await t.step(1, 'Food tile → the hub: meal ideas, and "Log what you eat"', async () => {
      const line = await food.tile(page).innerText();
      await t.check(/Meal ideas for you/.test(line), `the Food tile reads “${line.replace(/\s+/g, ' ')}”`);
      await hubWithLoggingOff(t);
    });

    await t.step(2, '"Log what you eat" → "Yes, meals only, no numbers": the same hub, now logging', async () => {
      const main = page.getByRole('main');
      await ui.tap(ui.row(main, 'Log what you eat'));
      const sheet = ui.sheet(page, LEVEL_SHEET);
      await sheet.waitFor();
      await ui.tap(sheet.getByRole('radio', { name: /^Yes, meals only, no numbers/ }));
      await sheet.waitFor({ state: 'hidden' });
      await t.check(await t.route() === '/hub/food', `turning logging on left the hub for ${await t.route()}`);
      await ui.row(main, 'Log what you ate', 'link').waitFor();
      await main.getByText('Nothing logged yet today', { exact: true }).waitFor();
      for (const option of ['Log a meal', 'Your usual meals', 'Quick add', 'Meal ideas', 'Sample week']) {
        await t.check(await ui.row(main, option, 'link').count() === 1, `Options lacks “${option}” (B-08)`);
      }
      await t.check(!food.FIGURES.test(await main.innerText()), 'the hub shows a figure while counts-free (B-11)');
      const kept = docs(await t.checkpoint('meals-only')).profile?.food;
      await t.check(kept?.level === 'meals' && kept.hardBefore === undefined, `stored food preferences: ${JSON.stringify(kept)}`);
    });
  },
};

const estimates = {
  name: 'estimates',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/home', time: food.LUNCHTIME });

    await t.step(1, 'Estimates are asked for: the screening question comes first (K-22)', async () => {
      const main = await hubWithLoggingOff(t);
      await ui.tap(ui.row(main, 'Log what you eat'));
      const sheet = ui.sheet(page, LEVEL_SHEET);
      await sheet.waitFor();
      await ui.tap(sheet.getByRole('radio', { name: /^Yes, with calorie and carb estimates/ }));
      await sheet.getByText('Has food or weight ever been hard for you?', { exact: true }).waitFor();
      await t.check(await sheet.getByText('Your answer stays on this phone, and only changes what we suggest.', { exact: true }).count() === 1, 'the question doesn’t say what happens to the answer');
    });

    await t.step(2, '"Prefer not to say" recommends meals only; "With estimates anyway" keeps estimates', async () => {
      const sheet = ui.sheet(page, LEVEL_SHEET);
      await ui.tap(ui.button(sheet, 'Prefer not to say'));
      await sheet.getByText('Many people find it easier to log without numbers.', { exact: true }).waitFor();
      await t.check(await ui.button(sheet, 'Meals only, no numbers (recommended)').count() === 1, 'meals only is not offered as recommended');
      await ui.tap(ui.button(sheet, 'With estimates anyway'));
      await sheet.waitFor({ state: 'hidden' });
      await t.check(await t.route() === '/hub/food', `choosing estimates left the hub for ${await t.route()}`);
    });

    await t.step(3, 'The level and the answer are kept where setup keeps them (board D102), and estimates show', async () => {
      const main = page.getByRole('main');
      await ui.tap(ui.row(main, 'Log what you ate', 'link'));
      const sheet = food.logSheet(page);
      await sheet.waitFor();
      const common = food.group(sheet, 'Common Indian foods');
      await t.check(/Estimated \d/.test(await common.innerText()), 'Common Indian foods show no estimates with estimates on');
      await ui.tap(sheet.getByRole('button', { name: 'Close', exact: true }));
      await sheet.waitFor({ state: 'hidden' });
      const kept = docs(await t.checkpoint('estimates')).profile?.food;
      await t.check(kept?.level === 'estimates' && kept.hardBefore === 'preferNot', `stored food preferences: ${JSON.stringify(kept)}`);
    });
  },
};

export const cases = [mealsOnly, estimates];
```

- [ ] **Step 5: V-J29** `scripts/e2e/acceptance/journeys/v29.mjs`. An allergy is kept out of the ideas but stays findable to log. Your own food with no values stays unknown, and the total says it's partial.

```js
/**
 * V-J29 (journey §17.2, A-17, B-12, B-13): unknown nutrients, and an allergy.
 * A peanut allergy keeps poha out of the ideas, and logging still finds it,
 * with a warning. Your own food with no values stays unknown. The partial
 * total says "in logged foods" and counts what has no estimate.
 */
import { persona } from '../fixtures/personas.mjs';
import * as food from '../lib/food.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J29';
export const title = 'Unknown nutrients and an allergy';

const PEANUT_ESTIMATES = { patch: { profile: { food: { level: 'estimates', hardBefore: 'no', allergies: ['peanut'] } } } };

const unknownAndAllergy = {
  name: 'bhel-puri-and-peanuts',
  async run(t) {
    // 09:00: breakfast by the sheet's clock.
    const page = await t.open({ seed: persona('P01', PEANUT_ESTIMATES), route: '/home' });

    await t.step(1, 'The peanut allergy leaves poha out of the ideas, on the hub and on Meal ideas (B-13)', async () => {
      const main = await food.openHub(t);
      const ideas = await food.group(main, 'Breakfast · ideas for you').innerText();
      await t.check(!/poha/i.test(ideas), `the hub offers poha to a person allergic to peanuts: ${ideas}`);
      await ui.tap(ui.row(main, 'Meal ideas', 'link'));
      await page.getByRole('heading', { level: 1, name: 'Meal ideas', exact: true }).waitFor();
      const breakfast = await food.group(page.getByRole('main'), 'Breakfast').innerText();
      await t.check(!/Vegetable poha/.test(breakfast), 'Meal ideas offers “Vegetable poha” to a person allergic to peanuts');
      await ui.tap(ui.back(page, 'Food'));
      await page.getByRole('heading', { level: 1, name: 'Food', exact: true }).waitFor();
    });

    await t.step(2, '"bhel puri" isn’t in the table: added as your own food, with no values, it has "No estimate"', async () => {
      await ui.tap(ui.row(page.getByRole('main'), 'Log what you ate', 'link'));
      const sheet = food.logSheet(page);
      await sheet.waitFor();
      await ui.type(sheet.getByRole('searchbox', { name: 'Search foods' }), 'bhel puri');
      await ui.tap(ui.row(sheet, 'Add “bhel puri” as your own food'));
      await sheet.getByRole('heading', { name: 'Your own food', exact: true }).waitFor();
      await ui.tap(ui.button(sheet, 'Add to meal'));
      const own = await food.trayItem(sheet, 'bhel puri').innerText();
      await t.check(/No estimate/.test(own) && !/\b0 kcal\b/.test(own), `your own food reads “${own.replace(/\s+/g, ' ')}”, not “No estimate” (A-17)`);
    });

    await t.step(3, 'Poha can still be logged, with its warning (B-13); roti is added with its "+"', async () => {
      const sheet = food.logSheet(page);
      await ui.type(sheet.getByRole('searchbox', { name: 'Search foods' }), 'poha');
      const results = await food.group(sheet, 'Results').innerText();
      await t.check(/Vegetable poha/.test(results) && /Contains peanut, which you listed as an allergy/.test(results),
        `search for poha shows: ${results.replace(/\s+/g, ' ')}`);
      await ui.type(sheet.getByRole('searchbox', { name: 'Search foods' }), 'roti');
      await ui.tap(food.addButton(sheet, 'Roti (whole-wheat)'));
      const names = await food.trayNames(sheet);
      await t.check(names.join('|') === 'bhel puri|Roti (whole-wheat)', `the tray holds ${names.join(', ')}`);
    });

    await t.step(4, 'Save: "Breakfast saved"; the total is labelled partial, and the unknown counted (A-17, B-12)', async () => {
      const sheet = food.logSheet(page);
      await ui.tap(ui.button(sheet, 'Save meal'));
      await food.toast(page, 'Breakfast saved').waitFor();
      const snap = await t.checkpoint('saved');
      const [saved] = food.mealsOn(snap, '2026-10-08');
      const own = (snap.customFoods ?? [])[0];
      await t.check(saved?.items?.length === 2 && saved.items[0].kind === 'custom' && saved.items[0].kcal === undefined && saved.items[0].carbsG === undefined,
        `the stored meal: ${JSON.stringify(saved)}`);
      await t.check(own?.name === 'bhel puri' && own.kcal === undefined && own.carbsG === undefined, `the stored own food: ${JSON.stringify(own)}`);
      const today = await food.region(page, 'Today').innerText();
      await t.check(/Estimated \d[\d,]* kcal · (about )?[\d–]+ g carbs in logged foods/.test(today), `Today has no partial total: ${today.replace(/\s+/g, ' ')}`);
      await t.check(/1 item has no estimate/.test(today), `Today doesn’t count the unknown item: ${today.replace(/\s+/g, ' ')}`);
    });
  },
};

export const cases = [unknownAndAllergy];
```

- [ ] **Step 6: V-J30** `scripts/e2e/acceptance/journeys/v30.mjs`. A usual lunch adjusted takes four taps, the first-time path five, and a double tap saves one meal.

```js
/**
 * V-J30 (journey §17.2, B-10, B-08): a usual lunch, one portion adjusted,
 * then Save; the taps counted apart from V-J03's three. Also the first-time
 * path, and a shaky double tap on Save (Review Focus 1).
 *
 * Cases:
 *   adjusted-usual  Food tile → "Same as yesterday’s lunch" → roti's "More" → "Save meal": four taps.
 *   first-time      Food tile → "Log what you ate" → type "roti" → "Add" → type "dal" → "Add" → "Save meal": five taps and two words.
 *   double-tap      "Save meal" tapped twice at once: one meal.
 */
import { persona } from '../fixtures/personas.mjs';
import * as food from '../lib/food.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J30';
export const title = 'Adjust a usual lunch; log a first meal';

const MEALS_ONLY = { patch: { profile: { food: { level: 'meals' } } } };
const TODAY = '2026-10-08';

/** A tap counter over `ui.tap`. */
function counted() {
  const c = { n: 0, tap: async locator => { c.n += 1; await ui.tap(locator); } };
  return c;
}

const adjustedUsual = {
  name: 'adjusted-usual',
  async run(t) {
    const page = await t.open({ seed: persona('P01', MEALS_ONLY), route: '/home', time: food.LUNCHTIME });
    await food.seedMeals(t, [food.USUAL_LUNCH]);

    await t.step(1, 'Usual lunch, one more roti, Save: four taps (B-10)', async () => {
      const c = counted();
      const main = await food.openHub(t, c.tap);
      await c.tap(ui.row(main, 'Same as yesterday’s lunch', 'link'));
      const sheet = food.logSheet(page);
      await sheet.waitFor();
      const roti = food.trayItem(sheet, 'Roti (whole-wheat)');
      await c.tap(roti.getByRole('button', { name: 'More', exact: true }));
      await t.check(/3 rotis \(≈ 120 g\)/.test(await roti.innerText()), `the roti reads “${(await roti.innerText()).replace(/\s+/g, ' ')}” after More`);
      await c.tap(ui.button(sheet, 'Save meal'));
      await food.toast(page, 'Lunch saved').waitFor();
      const [saved] = food.mealsOn(await t.db(), TODAY);
      await t.check(saved?.items?.find(i => i.foodId === 'roti')?.count === 3, `the stored lunch: ${JSON.stringify(saved)}`);
      await t.check(c.n === 4, `adjusting a usual lunch took ${c.n} taps, not 4`);
      t.note(`taps: ${c.n} (V-J03's usual lunch is 3)`);
    });
  },
};

const firstTime = {
  name: 'first-time',
  async run(t) {
    const page = await t.open({ seed: persona('P01', MEALS_ONLY), route: '/home', time: food.LUNCHTIME });

    await t.step(1, 'Two foods found by typing and added with "+": five taps', async () => {
      const c = counted();
      const main = await food.openHub(t, c.tap);
      await c.tap(ui.row(main, 'Log what you ate', 'link'));
      const sheet = food.logSheet(page);
      await sheet.waitFor();
      const search = sheet.getByRole('searchbox', { name: 'Search foods' });
      await ui.type(search, 'roti');
      await c.tap(food.addButton(sheet, 'Roti (whole-wheat)'));
      await ui.type(search, 'dal');
      await c.tap(food.addButton(sheet, 'Toor dal'));
      const names = await food.trayNames(sheet);
      await t.check(names.join('|') === 'Roti (whole-wheat)|Toor dal', `the tray holds ${names.join(', ')}`);
      await c.tap(ui.button(sheet, 'Save meal'));
      await food.toast(page, 'Lunch saved').waitFor();
      const [saved] = food.mealsOn(await t.db(), TODAY);
      await t.check(saved?.items?.map(i => `${i.foodId}×${i.count}`).join('|') === 'roti×1|toor-dal×1', `the stored lunch: ${JSON.stringify(saved)}`);
      await t.check(c.n === 5, `the first-time path took ${c.n} taps, not 5`);
      t.note(`taps: ${c.n}, plus typing "roti" and "dal"`);
    });
  },
};

const doubleTap = {
  name: 'double-tap',
  async run(t) {
    const page = await t.open({ seed: persona('P01', MEALS_ONLY), route: '/home', time: food.LUNCHTIME });
    await food.seedMeals(t, [food.USUAL_LUNCH]);

    await t.step(1, 'A shaky double tap on "Save meal" saves one meal (Review Focus 1)', async () => {
      const main = await food.openHub(t);
      await ui.tap(ui.row(main, 'Same as yesterday’s lunch', 'link'));
      const sheet = food.logSheet(page);
      await sheet.waitFor();
      await ui.button(sheet, 'Save meal').dblclick();
      await food.toast(page, 'Lunch saved').waitFor();
      await page.waitForTimeout(500);
      const today = food.mealsOn(await t.checkpoint('after-double-tap'), TODAY);
      await t.check(today.length === 1, `a double tap stored ${today.length} meals`);
    });
  },
};

export const cases = [adjustedUsual, firstTime, doubleTap];
```

- [ ] **Step 7: V-J31** `scripts/e2e/acceptance/journeys/v31.mjs`. A meal from 10 days ago is corrected and keeps its history, and the urgent low stays urgent.

```js
/**
 * V-J31 (journey §17.2, A-22, B-12): correct a meal from 10 days ago. It is
 * saved with its history, and no incident is resolved: an urgent low stays
 * urgent, and no reading or check-in changes.
 */
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as food from '../lib/food.mjs';
import { docs } from '../lib/harness.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J31';
export const title = 'Correct a meal from 10 days ago';

const ESTIMATES = { patch: { profile: { food: { pattern: 'vegetarian', avoid: [], level: 'estimates', hardBefore: 'no' } } } };
const DAY = '2026-09-28';
const OLD_LUNCH = food.meal('meal-seed-0928', `${DAY}T13:05:00.000+05:30`, 'lunch', [food.ROTI, food.DAL], 'estimates');

/** The shell's urgent surface (journey §4.7). */
const urgent = page => page.locator('section[data-urgent-kind]');

const correctOldMeal = {
  name: 'ten-days-ago',
  async run(t) {
    // P04 takes insulin: carbs show as ranges (K-22).
    const page = await t.open({ seed: persona('P04', ESTIMATES), route: '/home' });
    let before;

    await t.step(1, 'A lunch from 28 September is on this phone; a low makes today urgent', async () => {
      await food.seedMeals(t, [OLD_LUNCH]);
      await data.logGlucose(t, { value: 62 });
      // A low: its guidance shows at once (as v1), and the shell keeps the urgent state.
      const guidance = page.getByRole('dialog', { name: /^(Saved|What to do)$/ });
      await guidance.waitFor();
      await ui.tap(ui.button(guidance, 'Close'));
      await ui.tab(page, 'Home');
      await urgent(page).first().waitFor();
      before = await t.checkpoint('before-correction');
      await t.must(food.mealsOn(before, DAY).length === 1, 'the 28 September lunch did not merge');
    });

    await t.step(2, 'Today’s log → 28 September → Lunch → dal ×1½ → Save: "Lunch updated"', async () => {
      await ui.legacyTab(page, 'Track');
      await data.trackDay(page, DAY);
      await ui.tap(ui.row(page.getByRole('main'), 'Lunch', 'link'));
      const sheet = food.logSheet(page);
      await sheet.waitFor();
      await t.check(await page.getByRole('dialog', { name: 'Edit lunch', exact: true }).count() === 1, 'the meal didn’t open as “Edit lunch”');
      const dal = food.trayItem(sheet, 'Toor dal');
      await ui.tap(dal.getByRole('button', { name: 'More', exact: true }));
      await t.check(/1½ katoris \(≈ 225 g\)/.test(await dal.innerText()), `the dal reads “${(await dal.innerText()).replace(/\s+/g, ' ')}”`);
      await t.check(/about [\d–]+ g carbs/.test(await sheet.innerText()), 'carbs aren’t shown as a range with insulin (K-22)');
      await ui.tap(ui.button(sheet, 'Save meal'));
      await food.toast(page, 'Lunch updated').waitFor();
      await sheet.waitFor({ state: 'hidden' });
    });

    await t.step(3, 'Saved with its history; nothing else changed, and the low is still urgent', async () => {
      const after = await t.checkpoint('after-correction');
      const [lunch] = food.mealsOn(after, DAY);
      await t.check(lunch?.id === OLD_LUNCH.id && lunch.items.find(i => i.foodId === 'toor-dal')?.count === 1.5, `the corrected lunch: ${JSON.stringify(lunch)}`);
      await t.check(lunch?.edits?.length === 1 && JSON.stringify(lunch.edits[0].items) === JSON.stringify(OLD_LUNCH.items) && typeof lunch.editedAt === 'string',
        `its history: ${JSON.stringify(lunch?.edits)}`);
      await t.check(food.mealsOn(after, '2026-10-08').length === 0, 'the correction made a meal today');
      // The readings, the low among them, and the check-ins are untouched.
      await t.check(JSON.stringify(after.observations) === JSON.stringify(before.observations), 'correcting a meal changed a reading');
      await t.check(JSON.stringify(docs(after).checkIns) === JSON.stringify(docs(before).checkIns), 'correcting a meal changed a check-in');
      const row = (await ui.row(page.getByRole('main'), 'Lunch', 'link').innerText()).replace(/\s+/g, ' ');
      await t.check(/Toor dal ×1½/.test(row), `Today’s log’s lunch reads “${row}”`);
      await ui.tab(page, 'Home');
      await t.check(await urgent(page).count() > 0, 'correcting a meal resolved the urgent low');
      t.pending('Food’s trend is out of Plan 7: /trends/food stays on the Food hub (Plan 3). dailyNutrition() carries the corrected figures for it');
    });

    await t.step(4, 'The meal opens again with its earlier version listed', async () => {
      await ui.legacyTab(page, 'Track');
      await data.trackDay(page, DAY);
      await ui.tap(ui.row(page.getByRole('main'), 'Lunch', 'link'));
      const sheet = food.logSheet(page);
      await sheet.waitFor();
      const history = await food.group(sheet, 'Earlier versions').innerText();
      await t.check(/Roti \(whole-wheat\) ×2 · Toor dal/.test(history), `“Earlier versions” reads ${history.replace(/\s+/g, ' ')}`);
      await ui.tap(sheet.getByRole('button', { name: 'Close', exact: true }));
    });
  },
};

export const cases = [correctOldMeal];
```

- [ ] **Step 8: Run the five journeys**

```bash
npm run e2e:acceptance -- --only=V-J03,V-J28,V-J29,V-J30,V-J31
```

Expected:
- every case passes in all four projects (large and small, light and dark);
- V-J31 lists one pending item: Food's trend, which is outside this plan.

For a failure, read the case's screenshots and database snapshots in the artifact directory it prints. Fix the app, not the journey, unless the journey asks for something the spec doesn't.

- [ ] **Step 9: Run the whole suite**

```bash
npm run e2e:acceptance
```

Expected: J01 to J20, S01 and every `V` journey pass. J20 still finds Me's Food section titled "Food".

- [ ] **Step 10: Record the result.** Append to `docs/reimagine/BOARD.md`. Fill in each row's result as the run reported it: "Passed in all four projects", or the case and step that failed and what was done.

```markdown
### 2026-10-1x — [claude] v2 Plan 7 (Food): acceptance

| Journey | What it proves | Result |
| --- | --- | --- |
| V-J03 | A usual lunch in three taps; "Lunch saved" only once stored; no figure counts-free; a refused write keeps the tray | |
| V-J28 | Logging turned on from the hub, in place; estimates only after the screening question, with the answer kept as `food.hardBefore` | |
| V-J29 | A peanut allergy keeps poha out of the ideas and warns when it's logged; your own food with no values stays unknown; the partial total | |
| V-J30 | Four taps for an adjusted usual lunch, five for the first-time path; a double tap saves one meal | |
| V-J31 | A meal from 10 days ago corrected with its history, no reading or check-in changed, the urgent low still urgent. Pending: Food's trend | |
```

- [ ] **Step 11: Commit**

```bash
git add scripts/e2e/acceptance docs/reimagine/BOARD.md
git commit -m "test: Add the food acceptance journeys, V-J03 and V-J28 to V-J31"
```

---

### Task 17: Review and reconcile

**Files:** whatever the findings touch.

- [ ] **Step 1: Build a static bundle for Codex.** Put it in `/tmp/fit-checks/v2p7-prompt.md`, with:
  - the review request: find bugs, spec gaps and unsafe behaviour, and name a file and line for each;
  - this plan, and J§11, §7.4, §18 and §25's rows B-04, B-05, B-08, B-10 to B-13, B-20 and B-24;
  - `git diff <base>...feat/v2-journey -- src scripts`, where `<base>` is the parent of this plan's first commit (`git log --format=%H --grep="Record the food data's source" -n 1`, then `^`);
  - the new files in full.

  Then run:

```bash
codex exec -m openai.gpt-6.1-sol -c model_reasoning_effort='"max"' -c 'model_providers.amazon-bedrock.aws.region="us-east-1"' -s read-only -C "$PWD" -o /tmp/fit-checks/v2p7-codex.md - < /tmp/fit-checks/v2p7-prompt.md
```

- [ ] **Step 2: Run Kiro on the same diff, read-only**

```bash
kiro-cli chat --no-interactive --trust-tools=fs_read --model claude-opus-5.5 "Review the FitStrong v2 Plan 7 (Food) changes on feat/v2-journey against docs/superpowers/plans/2026-10-10-fitstrong-v2-plan-7-food.md and the journey spec's §11 and §25. Read the diff with git diff <base>...feat/v2-journey -- src scripts. Report bugs, spec gaps and unsafe behaviour, each with a file and line, most serious first. Change nothing."
```

- [ ] **Step 3: Reconcile the findings.**
  - For each one, reproduce it with a failing test (a unit test, or a step in a V journey), then fix it.
  - Log each on the board as accepted (with its test), already covered (with the test that covers it), or declined (with the reason).
  - Plan 7's decision numbers stop at D104. A new decision this review makes needs a number from the board's coordinator.

- [ ] **Step 4: Run every gate and the whole acceptance suite again, then commit**

```bash
npx tsc -b && npm run lint && npx vitest run && npm run e2e:acceptance
git add -A src scripts docs/reimagine/BOARD.md
git commit -m "fix: Reconcile the Plan 7 reviews"
```

---

## Self-review

**1. Spec coverage.** Each requirement, and the task that builds it:

| Requirement | Task |
| --- | --- |
| J§11.1: three levels; meal ideas always on; allergies and foods left out are hard filters (A-16) | 2 (`level.ts`), 7 (`mealAllowed`), 11 (`LevelSheet`, the hub), 13 (Me → Food) |
| J§11.2: Right now (three ideas, "Log what you ate", up to three usual meals), Today with the partial total and the missing count, Options (5), This week | 6 (the words), 9 (`usualFor`, `weekFood`, `dayLine`), 11 (`FoodHubScreen`) |
| J§11.3: the meal by the time, Your usual first, search and Common Indian foods with "+", the portion page with the reference quantity, the tray with "Less" and "More", Save only after the write, Save as a usual meal, your own food, Quick add, correcting with history, Delete with Undo | 8, 9, 10 |
| J§11.4: "Estimated" before every figure, "in logged foods", unknown never 0, ranges and the care-team line with insulin, a sulfonylurea or a meglitinide; never red, "over", net, "earn" or an allowance | 2 (`carbRanges`), 6 (`format.ts`, and `copy.test.ts`'s forbidden words) |
| J§11.5: no generated target, the care team's own, counts-free recommended after the question, prompt caps, turning logging off keeps history readable and editable | 2, 11 (the level sheet; edits open at any level; Today and This week stay while meals exist), 12, 13 |
| J§11.6: FDC ingredients and our recipes computed at build time, gram portions, our allergen tags, the source on the board | 1, 4, 5 |
| J§7.4 and A-73: food prompts as a reminder subtype, at most one a day, after the meal time, none once logged | 12 |
| J§18.1: `profile.food` | Plan 5 and 2. `mealTimes` isn't added, by Plan 5's decision to keep meal times in `habits.mealWalk.finish`. Task 12's `promptDefault` reads them there |
| J§18.2–18.3: meal, usual meal and own food records; atomic linked writes; backup, merge, deletion records, validation | Plan 6's foundation, and 8 (the rules, `writeRecords`, and the store tests) |
| J§22: food values | 1, 5 |
| B-04, B-05: Undo two-deep, scoped to its screen, on no timer; restore under a fresh id, deletion record kept | 8, 10 (`undo.ts`), 11, 14 |
| B-08: Options five; "Less" and "More" | 10, 11 |
| B-10: a usual meal in three taps, the others counted apart | 9, 11, 16 (V-J03, V-J30) |
| B-11: counts-free hides nutrition and movement energy everywhere, old records included; no prompts or targets | 2, 6, 9, 12, 13, 14, 15 |
| B-12: the carb range method, unknowns apart, each entry's revision and grams | 4, 5, 6, 8, 9 |
| B-13: canonical ids with aliases; contains, may contain or untagged left out; custom allergies only on fully tagged dishes; logging warns | 3, 5, 7, 10 |
| B-20: the prompt's boundary is scheduled | 12 (`nextAfter` includes it) |
| B-24: the privacy copy's first sentence, on the hub | 6, 11 |
| M15: the held list, "Added ✓", the tray fading in, "Saving…", the toast after the write, no fades under Reduce Motion | 10, 11 |
| V-J03, V-J28 to V-J31; the board entries | 16; 1 and 16 |

Left out, as the brief says:
- Food's trend: Plan 3 keeps `/trends/food` on the hub, and `dailyNutrition()` is its series;
- Browse's food results (Plan 4): `searchFoods()`, `foodRowDetail()` and `logHref({ food })` are ready for it;
- Recently deleted (Plan 8).

**2. Placeholder scan.** A search for "TBD", "TODO", "implement later", "similar to", "fill in" and "appropriate" finds none. Four steps leave the executor to write what can only be known then, each with its exact rule:
- Task 5 Step 6 corrects an FDC description, from `extract-fdc.ts`'s own closest matches;
- Task 5 Step 10 writes the extraction date into `usda-fdc`'s `accessed`, and the data test checks it;
- Task 15 Step 3 gates the walk screens the scan names, with the code pattern given;
- Task 16 Step 10 records the acceptance results in the table given.

**3. Type consistency.** These names are defined once and used with the same spelling and types everywhere:
- Task 2: `FoodLevel`, `NumbersView`, `numbersView`, `countsFree`, `carbRanges`, `ScreenAnswer`, `afterScreening`.
- Task 3: `allergiesOf(food)`, `recommendable`, `allergyWarning`, `AllergenTags`, on Plan 5's `AllergenId`.
- Task 4: `Food`, `FoodItem`, `CustomItem`, `QuickItem`, `MealItem`, `MealRecord`, `MealEdit`, `SavedMeal`, `CustomFood`.
- Task 6: `foodItem`, `customItem`, `quickItem`, `refreshItem`, `totalsOf`, `QUICK_NAME`; `itemEstimate`, `totalsLines`, `itemsLine`, `mealRowDetail`, `foodRowDetail`, `foodTileLine`, `careTeamLine`, `SLOT_LABEL`, `kcalText`. Every `FOOD_COPY` key used in Tasks 7 and 10–13 is in its block.
- Task 8: `mealsIn`, `savedMealsIn`, `customFoodsIn`, `corrected`, `restored`, `stored`; `saveMeal`, `saveCorrection`, `deleteMeal`, `restoreMeal`, `deleteUsual`, `restoreUsual`, `newMealId`, `newUsualId`, `newCustomId`; `writeRecords`, `freshId`.
- Task 9: `Lookup`, `addFood`, `step`, `stepOf`, `withCount`, `weighed`, `slotAt`, `MAX_COUNT`, `usualFor`, `searchFoods`, `commonFoods`, `mealsOn`, `weekFood`, `dayLine`, `dailyNutrition`.
- Task 10: `LogRequest`, `logHref`, `logRequest`, `openDraft`, `offerFoodUndo`, `endFoodUndos`, `useFoodUndoScope`, `useHeldQuery`.
- Task 11: `LevelSheet`. Task 12: `foodPromptTime`, `promptDefault`, `ReminderKind`, `InAppTime`, `inAppTimes`.

How the code was checked:
- The code of Tasks 2–15 was compiled (`tsc`, both configs), linted, and its unit tests run, in a scratch copy of the branch. That copy had Plan 5's food answers, Plan 6's registry and a fake FDC extract applied, with stand-ins for Plan 2's `HubFrame` and Plan 6's store actions.
- Task 8's `store.test.ts` and Task 5's figures need the real foundation and the real FDC file. The acceptance journeys were checked for syntax only.

**4. Review Focus.** Each line has its test in the task that owns the code:
1. the double tap: Task 8 (`store.test.ts`), and V-J30's `double-tap` case;
2. allergies in the person's own words: Task 3 (`resolveAllergens`), and Task 7 (drumstick, coconut, gluten);
3. counts-free after estimates: Tasks 6 (`format.test.ts`), 9 (`days.test.ts`) and 14 (`timeline.test.ts`), each with estimate snapshots present;
4. a correction past midnight: Task 8 (`records.test.ts` and `store.test.ts`), and Task 14 (`timeline.test.ts`);
5. a wrong-form FDC record: Task 5 (the plausibility table in `data.node.test.ts`).
