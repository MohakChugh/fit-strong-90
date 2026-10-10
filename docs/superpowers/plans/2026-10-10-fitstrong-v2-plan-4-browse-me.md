# FitStrong v2 Plan 4: Browse and Me Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the interim Browse with the real one, and rebuild Me as v2's tab.
- **Browse** lists every category and shortcut, grouped, with a search over them, the Guide and the meal ideas. Each category row has More → Add to Home or Remove from Home. Its pick mode is what Edit Home's "+ Add" opens.
- **Me** has, in order:
  - Finish setting up;
  - a newly relevant category, offered once;
  - Profile & health (v1's screens, behind a seam Plan 5 replaces);
  - Goals, Food, Reminders, Voice & demos and Display;
  - Data, with backup states you can trust;
  - About.

**Architecture:**
- **The category registry** (`src/categories.ts`) gains Browse's groups, its shortcuts (B-14) and the "when" rules as their own function. Browse, Home and Me all read that one source.
- **Every rule is a pure module with its own tests:**
  - the Browse index and search;
  - setup progress;
  - Goals' lines;
  - the display choices and text size;
  - calendar copies (A-78);
  - the backup ledger (B-25).
- **Screens keep v1's logic** and change only layout and words. v1's You screens become Me's sections, still in `src/screens/you/`.
- **Pick mode** is Browse's list in a sheet over Edit Home, so Home keeps its edit state. `#/browse?pick=1` opens it there.
- **Seams for later plans are named:**
  - `setupProgress()` and `notNow()` in `src/setup/progress.ts`, with `ChapterId` in `src/types/setup.ts` and "Not now" kept in `settings.setup.declined`, the names Plan 5's setup state uses (Plan 5);
  - `DisplayControls`, which setup's first page renders (Plan 5);
  - the Food logging row (Plan 7);
  - the Walks and maps group in Data (Plan 6).
- **The weekly goal by the week (B-16) is Plan 2's** `src/screens/track/weeklyGoal.ts`. This plan's Goals screen reads it. If Plan 2 hasn't been built, Task 1 builds that one task first.

**Tech stack:**
- React 19 and TypeScript (strict, `erasableSyntaxOnly`);
- Vite 8 and Tailwind v4;
- the React Router 7.13 hash data router;
- the IndexedDB store;
- base-ui menus and switches, sonner toasts and date-fns;
- Vitest (node environment);
- the Playwright-core acceptance suite in headless Chromium (`npm run e2e:acceptance`).

**Spec:**
- `docs/superpowers/specs/2026-10-08-fitstrong-v2-journey-design.md` (cited as J§):
  - §5.1, §14, §15, §16 and §20.4;
  - §25's B-03, B-04, B-08, B-14, B-16, B-24 and B-25. §25 overrides any earlier text it contradicts.
- `docs/superpowers/specs/2026-10-08-fitstrong-v2-motion-design.md` (cited as M-numbers): M17, M18, M19 and M23.
- The roadmap: `docs/superpowers/plans/2026-10-08-fitstrong-v2-roadmap.md`.
- Plan 1 (`…-plan-1-shell-home.md`) is done on `feat/v2-journey`.

Read the spec sections before starting.

**Depends on:**
- Plan 1;
- Plan 2's Task 2 (the weekly goal by the week), checked in Task 1.

Other plans are being built on the same branch. Find code by the names this plan gives, not by line numbers.

## Global Constraints

- **Branch:** work on `feat/v2-journey`. Never push to `main`. Make one commit per task, with a conventional message.
- **Local-only:** no new network requests, no new dependency, and no API keys.
- **Safety: the engine alone decides** (J§4).
  - Browse and Me never compute a permission.
  - A Browse row into a hub that opens on its refusal skips its view transition, asked of the gate at the tap (`opensOnHold`, then `skipNextTransition`; motion rule 2, codex V1-05).
  - Quiet hours never hold a re-check or a stop (J§4.9).
  - Me never says the app can alert anyone while it's closed (J§15).
- **Urgent first:** a More menu closes the moment an urgent decision arrives, and stays closed (M18).
- **Targets and text** (J§20.4 rules 1, 2 and 12):
  - every control has a visible text label;
  - everything tappable is at least 48 px (`min-h-12`), and never under 44;
  - primary buttons are at least 60 px tall;
  - body text uses `--text-body` (17 px);
  - text up to 200% must work.
- **Five choices** (J§20.4 rule 13, B-08): at most 5 actions per region. Browse's index is the one recorded exception (D58).
- **Irreversible actions ask twice, with specific labels** (J§20.4 rule 6):
  - Delete everything → "Delete everything", then "Erase all";
  - Replace → "Replace everything here", then "Replace everything" (v1, unchanged).
- **Undo** is never on a timer (M19). A plain confirmation fades after 4 s (sonner's default).
- **Reduced motion** (the system setting or `settings.display.reduceMotion`): text size, Reduce motion and Reduce transparency apply instantly. Theme fades over 200 ms only when motion is allowed (M23).
- **Menus dim the page and never blur it.** Glass stays on the navigation layer (J§20.1).
- **Copy:** Indian English, sentence case, and verbs on buttons. Every string is given in its task. B-24's sentences are used as written:
  - "Your records are stored on this {device}. Backups and calendar files leave only when you share them." Plan 6 adds the map sentence when maps arrive.
  - "Installing helps {device} keep your data, but it isn’t a backup."
  - "Safari may remove data from websites you haven’t opened for a while."
- **Settings writes:**
  - a nested object (`habits`, `display`, `setup`) goes through the store's `update()`, from the latest state;
  - a top-level field goes through `setSettings`;
  - every new settings field gets a reader in `src/store/importCheck.ts`, with a test (D-08).
- **v1 screens are kept where later plans replace them:**
  - Profile & health (Plan 5);
  - Food's preferences (Plan 7);
  - Data's backups and restore (Plan 6 adds routes).
- **Tests:**
  - Vitest runs in the node environment (`src/**/*.test.ts`). Every rule is a pure function with its own test;
  - store-backed writes are tested over `fakeIndexedDB()`, as `src/screens/you/write.test.ts` does;
  - screens are proven by the acceptance suite in headless Chromium.
- **Gates before every commit:** `npx tsc -b`, `npm run lint` and `npx vitest run` must all pass.
- **Acceptance:**
  - an existing journey changes only its navigation and copy steps. Every clinical and safety assertion stays as it is (A-76);
  - between tasks, run only the journeys a task names. Task 12 runs the full suite;
  - keep logs in `/tmp/fit-checks` (`mkdir -p /tmp/fit-checks`).

## Review Focus

These are failure modes the spec implies that no task's ordinary tests would exercise. Each has its test in the task that owns the code.

1. **Changing Home from Browse or Me before Home has stored a layout.** Open Browse first on a fresh record and choose Add to Home. It must add one tile to the defaults, and never write a Home that holds only that tile. Task 4 has the test (`homeLayout.test.ts`), and V-J12's Browse case opens at `/browse` to prove it in the browser.
2. **Whatever is typed into Browse's search.** Each of these must not throw, and must read the way the Guide's search reads it:
   - punctuation alone;
   - spaces and mixed case;
   - Devanagari ("रोटी");
   - a 500-character paste.

   Task 3 has the tests.
3. **Goals' history with gaps.** Each of these must read in words, never as a blank, "undefined" or 0:
   - a removed goal: "No weekly goal" or "No steps goal";
   - v1's undated weekly goal: "Before then";
   - a change waiting for Monday: "From Monday 12 October: …".

   Task 8 has the tests.
4. **The app's text size over the device's.** With the iPhone's Text Size or the browser already large, the app's own choice must never make text smaller. Turning it back to Standard must give back exactly what the device set, and never wipe it. Task 9 has the tests, which run `applyTextScale` on a stand-in document.
5. **Checking a backup that isn't the latest.** None of these may mark the latest backup checked:
   - an older file;
   - one that doesn't say when it was made;
   - one with unreadable records.

   A check must also never count as new data for the backup nudge. Task 11 has the tests.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/categories.ts`, `categories.test.ts` (modify) | Browse's groups and shortcuts; `relevantCategories`; `newlyRelevant` |
| `src/types/setup.ts` (new), `src/types/index.ts` (modify) | `CHAPTER_IDS`, `ChapterId`; `UserSettings.homeOffered`, `.setup.declined`, `.display.textScale` |
| `src/types/habits.ts` (modify) | `lastExportVia`, `lastCheckedExportAt`, `CalendarFileEntry.minutes` |
| `src/store/importCheck.ts`, `importCheck.test.ts` (modify) | Each new field read field by field |
| `src/screens/browse/browse.ts`, `browse.test.ts` (new) | The Browse index and its search |
| `src/screens/browse/BrowseList.tsx` (new) | The search field, Browse's rows and pick mode's rows |
| `src/screens/browse/BrowseScreen.tsx` (modify) | The real Browse, More, and `?pick=1` |
| `src/components/hig/ActionMenu.tsx` (new) | The M18 menu, taken out of `TileMenu` |
| `src/screens/home/TileMenu.tsx` (modify) | Drawn by `ActionMenu` |
| `src/screens/home/homeLayout.ts`, `homeLayout.test.ts` (new) | `useHomeLayout`, `layoutNow`, `changeHome`, `answerOffer` |
| `src/screens/home/layout.ts`, `layout.test.ts` (modify) | `storedLayout`; `notOnHome` removed |
| `src/screens/home/EditButton.tsx` (new) | The labelled 48 px button, taken out of `EditHome.tsx` |
| `src/screens/home/EditHome.tsx`, `editor.ts`, `HomeScreen.tsx` (modify) | `PickSheet` replaces `AddSheet`; `?edit=add` |
| `src/setup/progress.ts`, `progress.test.ts` (new) | The setup-progress seam: Finish setting up's rows, and "Not now" |
| `src/screens/you/MeHome.tsx` (new, from `YouHome.tsx`) | Me's root |
| `src/screens/you/routes.tsx` (modify) | Me's routes and the Profile & health seam |
| `src/screens/you/leave.ts`, `leave.test.ts` (delete) | v1's Done, which a tab has no use for |
| `src/screens/you/write.ts`, `write.test.ts` (modify) | `changeDisplay`, `recordExport({ via })`, `recordBackupCheck` |
| `src/screens/you/summaries.ts`, `summaries.test.ts` (modify) | `privacyLine`, `copyLine`, `staleLine` |
| `src/screens/you/goals.ts`, `goals.test.ts` (new) | Goals' lines |
| `src/screens/you/GoalsScreen.tsx`, `ProgrammeGroup.tsx` (new) | Goals; the programme's Join and Leave, taken out of `FocusScreen.tsx` |
| `src/screens/track/weeklyGoal.ts`, `stepsGoal.ts` (modify) | Export each goal's validated history |
| `src/lib/textSize.ts`, `textSize.test.ts` (modify) | The app's text size over the device's |
| `src/screens/you/display.ts`, `display.test.ts` (new) | Display's choices and lines; the theme fade |
| `src/screens/you/DisplayScreen.tsx` (new; `AppearanceScreen.tsx` deleted) | Display, and `DisplayControls` for setup's first page |
| `src/App.tsx`, `src/main.tsx` (modify) | Apply the app's text size |
| `src/reminders/calendarNotice.ts`, `calendarNotice.test.ts` (modify) | The calendar copies' ledger, and when they're out of date (A-78) |
| `src/health/recommend.test.ts` (modify) | Quiet hours never hold a re-check |
| `src/screens/you/dataStatus.ts`, `dataStatus.test.ts` (new) | Backup, install, storage and check lines |
| `src/screens/you/{DataScreen,DataSheets,RestoreFlow,HabitsScreen,FoodScreen,ProfileScreen,FocusScreen,VoiceScreen,CalendarSheet}.tsx` (modify) | Me's sections, in v2's words |
| `src/screens/you/backupFile.ts`, `backupFile.test.ts` (modify) | The new ledger keys don't make a prepared file stale |
| `src/components/hig/StorageBanner.tsx`, `src/screens/welcome/{KeepStep,FocusStep}.tsx`, `src/components/profile/ProfileWizard.tsx` (modify) | Copy and paths that still say You |
| `src/components/hig/shell.node.test.ts` (modify) | Browse's tap rule, the menu's page claim and the Leave sheet, read from their new files |
| `scripts/e2e/acceptance/run.mjs` (modify) | V and M journeys; the warm-up list |
| `scripts/e2e/acceptance/lib/{data,guide}.mjs`, `journeys/{j17,j18,j19,j20,s01}.mjs` (modify) | Navigation and copy only |
| `scripts/e2e/acceptance/journeys/{v08,v12,v35,v39,m01}.mjs` (new) | This plan's journeys |
| `docs/reimagine/BOARD.md` (modify) | Decisions; the result |

---

### Task 1: Baseline, board decisions and the journey runner

**Files:**
- Modify: `docs/reimagine/BOARD.md` (append)
- Modify: `scripts/e2e/acceptance/run.mjs` (the journey file filter)

**Interfaces:** none.

- [ ] **Step 1: Check the baseline.**

```bash
git checkout feat/v2-journey
git status --short            # clean, except untracked docs
npx tsc -b && npm run lint && npx vitest run
```

Each `grep` must print at least one line. These are the names this plan builds on:

```bash
grep -n "export function defaultHome\|export function arrange\|export function isHomeLayout\|export interface Shortcut\|export const MAX_PER_GROUP" src/categories.ts
grep -n "export function addTile\|export function hideTile\|export function addButton\|export function groupFull\|export function placedMessage\|export function hiddenTiles\|export function notOnHome" src/screens/home/layout.ts
grep -n "export function useHomeEditor\|export function useFirstLayout\|export type Control" src/screens/home/editor.ts
grep -n "export function TileIcon" src/screens/home/Tile.tsx
grep -n "export function tileHref\|export const FROM_HOME" src/screens/home/model.ts
grep -n "export const UrgentContext" src/screens/home/urgent.ts
grep -n "export function opensOnHold\|export function gateFor" src/components/checkin/start.ts
grep -n "export function useGuided" src/hooks/useGuided.ts
grep -n "export function claimModal" src/components/hig/modal.ts
grep -n "export function skipNextTransition" src/design/motion.ts
grep -n "export function search" src/content/search.ts
grep -n "export function partialDetail" src/screens/guide/format.ts
grep -n "export function redirectFor" src/redirects.ts
grep -n "export function GoalSheet\|export function StepsGoalSheet" src/screens/track/GoalSheet.tsx
grep -n "export function weeklyGoalOn\|export function pendingWeeklyGoal\|export function withWeeklyGoal" src/screens/track/weeklyGoal.ts
grep -n "weeklyMovementGoalHistory" src/types/index.ts
```

The last two lines are Plan 2's Task 2 (`docs/superpowers/plans/2026-10-10-fitstrong-v2-plan-2-hubs.md`).
- If they print nothing, Plan 2's Task 2 hasn't been built. Build it now, exactly as Plan 2 gives it, and commit it with Plan 2's message. It depends only on Plan 1.
- If a name has moved or changed its shape, use it where it lives now, and keep this plan's behaviour.

Record where this plan starts, for Task 13:

```bash
mkdir -p /tmp/fit-checks && git rev-parse HEAD > /tmp/fit-checks/v2p4-base
```

- [ ] **Step 2: The runner takes v2's journeys.** In `scripts/e2e/acceptance/run.mjs`, the journey files are filtered with `/^[js]\d\d\.mjs$/`. Replace it with:

```js
const files = fs.readdirSync(path.join(HERE, 'journeys')).filter(f => /^[jmsv]\d\d\.mjs$/.test(f)).sort();
```

If Plan 2 has already widened it (`[jsv]`), add only the `m`.

- [ ] **Step 3: Append the decisions to the board.** Add the text below, exactly, at the end of `docs/reimagine/BOARD.md`.

  It's numbered from D56, after Plan 2's D47–D55. Find the highest number used so far with:

  ```bash
  grep -o 'D[0-9]\+' docs/reimagine/BOARD.md | sort -t D -k 1.2 -n | tail -1
  ```

  If the next free number isn't D56, renumber these from it, leave the text otherwise unchanged, and use the new numbers wherever this plan cites D56–D67.

```markdown
### 2026-10-10 — [claude] v2 Plan 4 (Browse and Me): decisions recorded before building

From `docs/superpowers/plans/2026-10-10-fitstrong-v2-plan-4-browse-me.md`, against journey §5.1, §14–§16, §20.4 and §25 (B-03, B-04, B-08, B-14, B-16, B-24, B-25):

| # | Decision | Reason |
| --- | --- | --- |
| D56 | Pick mode is Browse's list of categories in a sheet over Edit Home, titled "Add to Home". `#/browse?pick=1` opens Edit Home with it | Home keeps its edit state, its Undo toasts (B-04) and focus (B-03), and the tab stays Home. As a route under the Browse tab, Browse's root would be remembered in pick mode |
| D57 | Browse keeps its search (§14), though the design research suggested skipping it for low-literacy users | The list stays fully browsable. Search adds the words people use: Indian spellings (chapatti, roti), plain words (sugar, BP) and conditions (sciatica), through aliases |
| D58 | Browse is the full index §14 lists, so its groups hold more than 5 rows | The 5-choices rule (§20.4 rule 13, B-08) is for a region's main choices. Browse's main choice is its search; each group is a list to scan |
| D59 | Browse's "Remove from Home" hides the tile, so it is listed under Hidden in Edit Home, and offers no Undo | Nothing is deleted, and More → Add to Home brings it back in one step |
| D60 | The app's own text size takes the larger of the device's size and its own (§16: "System settings take precedence where the browser reports them") | The app never makes text smaller than the iPhone's Text Size or the browser's; it can only enlarge it |
| D61 | "Checked" (B-25) is recorded only by Me → Data → Check a backup, which reads the file in Restore's preview and writes nothing else | Restore from a backup stays write-free until a choice is made (J18) |
| D62 | The backup and calendar records stay in `settings.habits`: `lastExportAt`, `lastExportSeq` and `calendarExport`, joined by `lastExportVia`, `lastCheckedExportAt` and `calendarExport.*.minutes`. These are §18.1's `exports` | No migration |
| D63 | Me is a tab root, so v1 You's Done goes. The tab bar leaves Me | §5 |
| D64 | Me → Goals is built here, on Plan 2's weekly goal by the week (B-16). V-J35 and V-J39 move from Plan 8 to this plan | Plan 4 builds what they test |
| D65 | Every "Finish setting up" row has "Not now", a safety gap's included (§16). It keeps the chapter in Profile & health, and is stored in `settings.setup.declined`, the field Plan 5's setup state keeps | The engine's hold still names the chapter on the tile and the hub |
| D66 | Me's files stay in `src/screens/you/` | Renaming 30 files is churn with no change in behaviour |
| D67 | On Me → Reminders, A-78's "Your calendar copies may be out of date" takes the place of D-01's "Calendar may still remind you", and keeps its substance: what Calendar still holds, that the app can't remove it, and how to delete it. D-01's notice stays where the answer that stopped a habit is given: the Water sheet and Profile & health | One warning per screen for the same events (V-J39) |
```

- [ ] **Step 4: Commit**

```bash
git add docs/reimagine/BOARD.md scripts/e2e/acceptance/run.mjs
git commit -m "docs: Record the Plan 4 decisions, and run v2's journey files"
```

---

### Task 2: The registry: Browse's groups, shortcuts, and relevant categories

**Files:**
- Modify: `src/categories.ts`
- Modify: `src/categories.test.ts`
- Modify: `src/types/index.ts` (`UserSettings.homeOffered`)
- Modify: `src/store/importCheck.ts`, `src/store/importCheck.test.ts`

**Interfaces:**
- Consumes: `Shortcut { id: string; title: string; to: string }`, `GROUPS`, `arrange`, `defaultHome` (all already in `categories.ts`), and `redirectFor` from `@/redirects`.
- Produces:
  - `type BrowseGroupId = GroupId | 'data'`;
  - `BROWSE_GROUPS: readonly { id: BrowseGroupId; title: string }[]`;
  - `SHORTCUTS: Readonly<Record<BrowseGroupId, readonly Shortcut[]>>`;
  - `interface HomeAnswers { profile: UserProfile; settings: UserSettings; hasSteps: boolean }`;
  - `relevantCategories(answers: HomeAnswers): CategoryId[]`;
  - `newlyRelevant(input: { relevant: readonly CategoryId[]; layout: HomeLayout; offered: readonly CategoryId[] }): CategoryId[]`;
  - `UserSettings.homeOffered?: CategoryId[]`.

- [ ] **Step 1: Write the failing tests.** In `src/categories.test.ts`:
  - change the first import to `import { BROWSE_GROUPS, CATEGORIES, GROUPS, SHORTCUTS, arrange, categoryById, defaultHome, isHomeLayout, newlyRelevant, relevantCategories, type Category, type Shortcut } from './categories';`;
  - add `import { redirectFor } from './redirects';`;
  - append the blocks below. The file already defines `settings`, `withHealth` and `waterOn`.

```ts
describe('Browse’s groups and shortcuts (journey §14, B-14)', () => {
  it('are Home’s four groups, then Your data', () => {
    expect(BROWSE_GROUPS.map(g => g.title)).toEqual(['Move', 'Eat', 'Check', 'Learn', 'Your data']);
  });
  it('each shortcut has its own id, none a category’s, and a v2 address', () => {
    const all = Object.values(SHORTCUTS).flat();
    const ids = all.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of all) {
      expect(CATEGORIES.some(c => c.id === s.id), s.id).toBe(false);
      expect(Object.keys(s).sort()).toEqual(['id', 'title', 'to']);
      const [path, query] = s.to.split('?');
      expect(redirectFor(path, query ? `?${query}` : ''), s.to).toBeUndefined();
    }
  });
  it('lists §14’s shortcuts in their groups, and Water as Check’s category only', () => {
    expect(SHORTCUTS.move.map(s => s.title)).toEqual(['Programme', 'Exercise library']);
    expect(SHORTCUTS.eat.map(s => s.title)).toEqual(['Meal ideas']);
    expect(SHORTCUTS.check.map(s => s.title)).toEqual(['BMI']);
    expect(SHORTCUTS.learn).toEqual([]);
    expect(SHORTCUTS.data.map(s => s.title)).toEqual(['Today’s log', 'Backup']);
    expect(Object.values(SHORTCUTS).flat().some(s => /water/i.test(s.title))).toBe(false);
  });
});

describe('relevantCategories: journey §5.1’s “when” rules', () => {
  it('is what defaultHome lays out before any fill-in', () => {
    const p = withHealth({ diabetes: 'type2', hypertension: 'treated' }, { pain: { areas: ['lowerBack'] } });
    expect(relevantCategories({ profile: p, settings, hasSteps: false })).toEqual(['workout', 'stretch', 'walk', 'food', 'glucose', 'bp', 'back', 'labs']);
    expect(relevantCategories({ profile: withHealth({}), settings, hasSteps: false })).toEqual(['workout', 'stretch', 'walk', 'food']);
  });
});

describe('newlyRelevant: offered in Me once, never added silently (journey §5.1)', () => {
  const laid = defaultHome({ profile: withHealth({}), settings, hasSteps: false });
  const diabetic = relevantCategories({ profile: withHealth({ diabetes: 'type2' }), settings, hasSteps: false });
  it('offers what the answers made relevant since Home was laid out', () => {
    expect(newlyRelevant({ relevant: diabetic, layout: laid, offered: [] })).toEqual(['glucose', 'labs']);
  });
  it('never offers what Home shows or hides, or what Me offered before', () => {
    expect(newlyRelevant({ relevant: diabetic, layout: { ...laid, hidden: ['glucose'] }, offered: ['labs'] })).toEqual([]);
  });
  it('offers Walk once a foot wound heals, and Water once its habit is on', () => {
    const held = defaultHome({ profile: withHealth({ footStatus: 'current_wound_or_active_charcot' }), settings, hasSteps: false });
    const healed = relevantCategories({ profile: withHealth({}), settings, hasSteps: false });
    expect(newlyRelevant({ relevant: healed, layout: held, offered: [] })).toEqual(['walk']);
    const water = relevantCategories({ profile: withHealth({}), settings: { habits: waterOn } as UserSettings, hasSteps: false });
    expect(newlyRelevant({ relevant: water, layout: laid, offered: [] })).toEqual(['water']);
  });
  it('never offers a fill-in tile', () => {
    const bare: HomeLayout = { order: { move: ['workout', 'stretch', 'walk'], eat: ['food'], check: [], learn: [] }, hidden: [] };
    expect(newlyRelevant({ relevant: relevantCategories({ profile: withHealth({}), settings, hasSteps: false }), layout: bare, offered: [] })).toEqual([]);
  });
});
```

In `src/store/importCheck.test.ts`, inside `describe('settings in an import file are read field by field (D-08)')`:

```ts
  it('reads the categories Me has offered for Home, and leaves out a list it cannot read (journey §5.1)', () => {
    expect(preview(file({ settings: { ...settings, homeOffered: ['glucose', 'water'] } })).unreadableFields).toEqual([]);
    expect(preview(file({ settings: { ...settings, homeOffered: ['mood'] } })).unreadableFields).toEqual(['settings.homeOffered']);
  });
```

- [ ] **Step 2: Run them to check they fail**

Run: `npx vitest run src/categories.test.ts src/store/importCheck.test.ts`
Expected: FAIL. `BROWSE_GROUPS`, `SHORTCUTS`, `relevantCategories` and `newlyRelevant` aren't exported, and `homeOffered` isn't read.

- [ ] **Step 3: Write the registry's additions.** In `src/categories.ts`, after `GROUPS`:

```ts
/** Browse's groups: Home's four, then "Your data" (journey §14). */
export type BrowseGroupId = GroupId | 'data';

export const BROWSE_GROUPS: readonly { id: BrowseGroupId; title: string }[] = [...GROUPS, { id: 'data', title: 'Your data' }];

/**
 * The shortcuts Browse lists, by the group each is listed in (journey §14,
 * B-14). Each has only a target: none is ever a tile, a hub or a trend.
 * Water is a category, Check's only. The Learn group's other rows are the
 * Guide's own topics.
 */
export const SHORTCUTS: Readonly<Record<BrowseGroupId, readonly Shortcut[]>> = {
  move: [
    { id: 'programme', title: 'Programme', to: '/hub/workout/plan' },
    { id: 'library', title: 'Exercise library', to: '/hub/workout/exercises' },
  ],
  eat: [{ id: 'meal-ideas', title: 'Meal ideas', to: '/hub/food/ideas' }],
  // BMI is worked out from weight and height and has no form: it shows on the Weight hub (§5.1).
  check: [{ id: 'bmi', title: 'BMI', to: '/hub/weight' }],
  learn: [],
  data: [
    { id: 'today-log', title: 'Today’s log', to: '/day/today' },
    { id: 'backup', title: 'Backup', to: '/me/data' },
  ],
};
```

Above `defaultHome`, add the "when" rules as their own function. Then replace `defaultHome` with the version below. It takes the same input, and `arrange` and the dropped tiles are unchanged:

```ts
/** What the setup answers say, for Home's tiles (journey §5.1). */
export interface HomeAnswers {
  profile: UserProfile;
  settings: UserSettings;
  hasSteps: boolean;
}

/**
 * The categories the answers make relevant: journey §5.1's "when" rules, in
 * the registry's order. `defaultHome` lays these out first. One that becomes
 * relevant after Home was laid out is offered in Me, once (`newlyRelevant`).
 * Fill-in tiles are never relevant by themselves.
 */
export function relevantCategories({ profile, settings, hasSteps }: HomeAnswers): CategoryId[] {
  const h = profile.health;
  const derived = deriveHealth(h);
  const areas = profile.pain.areas;
  const footHeld = walkingHeldForFeet(profile);
  return [
    'workout', 'stretch',
    ...(footHeld ? [] : ['walk' as const]),
    ...(!footHeld && (settings.dailyStepsGoal !== undefined || hasSteps) ? ['steps' as const] : []),
    'food',
    ...(derived.diabetic || h.diabetes === 'prediabetes' ? ['glucose' as const] : []),
    ...(h.hypertension !== 'none' || derived.onBpMeds || h.bpMonitor ? ['bp' as const] : []),
    // Back pain or sciatica, not any pain: Back & leg only for relevant answers (A-38).
    ...(areas.includes('lowerBack') || areas.includes('sciatica') ? ['back' as const] : []),
    ...(settings.habits?.water?.enabled ? ['water' as const] : []),
    // For HbA1c.
    ...(derived.diabetic ? ['labs' as const] : []),
  ];
}

/**
 * The first layout, from the setup answers (journey §5.1). Worked out once;
 * after that `settings.home` holds the person's own layout.
 */
export function defaultHome(answers: HomeAnswers): HomeLayout {
  const wanted = relevantCategories(answers);
  // Too many: the dropped tiles go to `hidden`, so Edit Home offers them under Hidden.
  const hidden = DROP_ORDER.filter(id => wanted.includes(id)).slice(0, Math.max(0, wanted.length - MAX_TILES));
  return arrange(wanted.filter(id => !hidden.includes(id)), hidden);
}

/**
 * The categories to offer in Me, once each (journey §5.1): relevant now, and
 * neither on Home, nor hidden there, nor offered before. Never added silently.
 */
export function newlyRelevant({ relevant, layout, offered }: {
  relevant: readonly CategoryId[];
  layout: HomeLayout;
  offered: readonly CategoryId[];
}): CategoryId[] {
  const placed = new Set<CategoryId>([...Object.values(layout.order).flat(), ...layout.hidden, ...offered]);
  return relevant.filter(id => !placed.has(id));
}
```

- [ ] **Step 4: The setting, and its reader.**
  - In `src/types/index.ts`, inside `UserSettings`, after `home`:

    ```ts
      /** v2 (journey §5.1): categories Me has offered for Home, added or "Not now", so none is offered twice. */
      homeOffered?: CategoryId[];
    ```

  - In `src/store/importCheck.ts`:
    - change the registry import to `import { CATEGORIES, isHomeLayout } from '@/categories';`;
    - in `SETTINGS_SPEC`, after `home: isHomeLayout,`, add:

    ```ts
      homeOffered: listOf(oneOf(...CATEGORIES.map(c => c.id))),
    ```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/categories.test.ts src/store/importCheck.test.ts`
Expected: PASS. The earlier `defaultHome` and `arrange` tests still pass, unchanged.

- [ ] **Step 6: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/categories.ts src/categories.test.ts src/types/index.ts src/store/importCheck.ts src/store/importCheck.test.ts
git commit -m "feat: Give the registry Browse's groups and shortcuts, and the categories each person's answers make relevant"
```

---

### Task 3: The Browse index and its search

**Files:**
- Create: `src/screens/browse/browse.ts`
- Create: `src/screens/browse/browse.test.ts`

**Interfaces:**
- Consumes:
  - `CATEGORIES`, `BROWSE_GROUPS` and `SHORTCUTS` (Task 2);
  - `search`, `contextOf`, `GuideContext` and `SearchResult` from `@/content`;
  - `words` from `@/content/text`;
  - `redirectFor` from `@/redirects`.
- Produces:
  - `type BrowseRow`, which is one of:
    - `{ kind: 'category'; id: CategoryId; title: string }`;
    - `{ kind: 'shortcut'; id: string; title: string; to: string }`;
    - `{ kind: 'topic' | 'card' | 'meal'; id: string; title: string; detail: string; to: string; result: SearchResult }`;
  - `interface BrowseGroup { id: BrowseGroupId; title: string; rows: BrowseRow[] }`;
  - `interface BrowseResults { groups: BrowseGroup[]; partial: boolean }`;
  - `CATEGORY_ALIASES: Record<CategoryId, readonly string[]>`;
  - `SHORTCUT_ALIASES: Readonly<Record<string, readonly string[]>>`;
  - `browse(query: string, ctx: GuideContext, mode?: 'browse' | 'pick'): BrowseResults`.

- [ ] **Step 1: Write the failing test** `src/screens/browse/browse.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { CATEGORIES, SHORTCUTS } from '@/categories';
import { TOPICS, contextOf } from '@/content';
import { CATEGORY_ALIASES, SHORTCUT_ALIASES, browse } from './browse';

const anyone = contextOf();
const group = (q: string, id: string, mode: 'browse' | 'pick' = 'browse') => browse(q, anyone, mode).groups.find(g => g.id === id);
const ids = (q: string, id: string, mode: 'browse' | 'pick' = 'browse') => group(q, id, mode)?.rows.map(r => r.id) ?? [];
const row = (q: string, gid: string, id: string) => group(q, gid)?.rows.find(r => r.id === id);

describe('Browse with nothing typed (journey §14)', () => {
  it('lists every category once, in its own group, in the registry’s order, then that group’s shortcuts', () => {
    const { groups, partial } = browse('', anyone);
    expect(partial).toBe(false);
    expect(groups.map(g => g.title)).toEqual(['Move', 'Eat', 'Check', 'Learn', 'Your data']);
    expect(ids('', 'move')).toEqual(['workout', 'stretch', 'walk', 'steps', 'programme', 'library']);
    expect(ids('', 'eat')).toEqual(['food', 'meal-ideas']);
    expect(ids('', 'check')).toEqual(['glucose', 'bp', 'back', 'weight', 'water', 'sleep', 'waist', 'labs', 'bmi']);
    expect(ids('', 'data')).toEqual(['today-log', 'backup']);
    const categories = groups.flatMap(g => g.rows).filter(r => r.kind === 'category').map(r => r.id);
    expect([...categories].sort()).toEqual(CATEGORIES.map(c => c.id).sort());
  });
  it('lists Learn, then the Guide’s topics in the person’s order, at their v2 places', () => {
    expect(ids('', 'learn')).toEqual(['learn', ...TOPICS.map(t => t.id)]);
    expect(row('', 'learn', TOPICS[0].id)).toMatchObject({ kind: 'topic', to: `/hub/learn/topic/${TOPICS[0].id}` });
  });
  it('keeps Water in Check only (B-14)', () => {
    expect(ids('', 'eat')).not.toContain('water');
  });
  it('has words for every category and shortcut', () => {
    for (const c of CATEGORIES) expect(CATEGORY_ALIASES[c.id].length, c.id).toBeGreaterThan(0);
    for (const s of Object.values(SHORTCUTS).flat()) expect(SHORTCUT_ALIASES[s.id]?.length, s.id).toBeGreaterThan(0);
  });
});

describe('searching (journey §14)', () => {
  it('finds a food and its Guide answer by an Indian spelling (V-J08: chapatti)', () => {
    expect(browse('chapatti', anyone).partial).toBe(false);
    expect(row('chapatti', 'eat', 'l-roti-dal-sabzi')).toMatchObject({ kind: 'meal', title: 'Roti, dal and sabzi', to: '/hub/food/ideas/l-roti-dal-sabzi' });
    expect(row('chapatti', 'learn', 'card-grains')).toMatchObject({ kind: 'card', to: '/hub/learn/card/card-grains' });
    expect(ids('roti', 'eat')).toContain('l-roti-dal-sabzi');
  });
  it('finds a category by the words people use for it', () => {
    expect(ids('sciatica', 'check')).toEqual(['back']);
    expect(ids('sciatica', 'learn')).toContain('card-keep-moving');
    expect(ids('sugar', 'check')).toEqual(['glucose']);
    expect(ids('blood sugar', 'check')).toEqual(['glucose']);
    expect(ids('BP', 'check')).toEqual(['bp']);
    expect(ids('hba1c', 'check')).toEqual(['labs']);
    expect(ids('bmi', 'check')).toEqual(['weight', 'bmi']);
    expect(ids('plan', 'move')).toEqual(['programme']);
    expect(ids('history', 'data')).toEqual(['today-log']);
    expect(ids('backup', 'data')).toEqual(['backup']);
  });
  it('reads the last word as the start of one while typing, but never a single letter', () => {
    expect(ids('gluc', 'check')).toEqual(['glucose']);
    expect(ids('g', 'check')).toEqual([]);
  });
  it('passes the person’s food choices through: a vegan’s search for dahi finds no meal with dahi', () => {
    const vegan = contextOf(['vegan'], { pattern: 'vegan', avoid: [] });
    expect(browse('dahi', vegan).groups.find(g => g.id === 'eat')?.rows.filter(r => r.kind === 'meal') ?? []).toEqual([]);
  });
});

describe('when nothing matches, or only part does', () => {
  it('returns no groups for a word nothing has', () => {
    expect(browse('xylophone', anyone)).toEqual({ groups: [], partial: false });
  });
  it('labels the results partial when nothing has every word', () => {
    const r = browse('insulin zebra', anyone);
    expect(r.partial).toBe(true);
    expect(r.groups.length).toBeGreaterThan(0);
  });
  it('a category with every word is never partial, and the Guide’s part-matches are dropped beside it', () => {
    const r = browse('sugar zebra', anyone);
    expect(r.partial).toBe(true);
    expect(browse('sugar meter', anyone).partial).toBe(false);
    expect(ids('sugar meter', 'check')).toEqual(['glucose']);
  });
});

describe('pick mode (Edit Home’s “+ Add”)', () => {
  it('lists the categories only: a shortcut or a topic can never be a tile (B-14)', () => {
    const { groups } = browse('', anyone, 'pick');
    expect(groups.map(g => g.id)).toEqual(['move', 'eat', 'check', 'learn']);
    expect(groups.flatMap(g => g.rows).every(r => r.kind === 'category')).toBe(true);
    expect(groups.flatMap(g => g.rows)).toHaveLength(CATEGORIES.length);
  });
  it('searches the categories alone', () => {
    expect(browse('sugar', anyone, 'pick').groups.map(g => [g.id, g.rows.map(r => r.id)])).toEqual([['check', ['glucose']]]);
    expect(browse('chapatti', anyone, 'pick').groups).toEqual([]);
  });
});

describe('whatever is typed (Review Focus 2)', () => {
  it('reads punctuation, spaces and case as the Guide’s search does, and never throws', () => {
    expect(browse('???', anyone)).toEqual(browse('', anyone));
    expect(browse('  ChapaTTi  ', anyone)).toEqual(browse('chapatti', anyone));
    expect(() => browse('x'.repeat(500), anyone)).not.toThrow();
    const roti = browse('रोटी', anyone);
    expect(roti.groups.find(g => g.id === 'eat')?.rows.some(r => r.kind === 'meal')).toBe(true);
    for (const g of roti.groups) for (const r of g.rows) if (r.kind !== 'category') expect(r.to).toMatch(/^\//);
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/screens/browse/browse.test.ts`
Expected: FAIL, "Cannot find module './browse'".

- [ ] **Step 3: Write the module** `src/screens/browse/browse.ts`

```ts
/**
 * Browse (journey §14, B-14): every category in the registry and every
 * shortcut, in Browse's groups, with a search over them, the Guide's topics
 * and answers, and the meal ideas. Each kind keeps to its group. Pick mode
 * (Edit Home's "+ Add", §7.6) lists the categories alone, since a shortcut or
 * a topic can't be a tile. Pure, so the whole index is tested without a
 * screen.
 */
import { BROWSE_GROUPS, CATEGORIES, SHORTCUTS, type BrowseGroupId, type CategoryId } from '@/categories';
import { search, type GuideContext, type SearchResult } from '@/content';
import { words } from '@/content/text';
import { redirectFor } from '@/redirects';

export type BrowseRow =
  | { kind: 'category'; id: CategoryId; title: string }
  | { kind: 'shortcut'; id: string; title: string; to: string }
  | { kind: SearchResult['kind']; id: string; title: string; detail: string; to: string; result: SearchResult };

export interface BrowseGroup {
  id: BrowseGroupId;
  title: string;
  rows: BrowseRow[];
}

export interface BrowseResults {
  groups: BrowseGroup[];
  /** Nothing has every word typed, so each row matches only some of them, and the screen says so (Codex content audit F22). */
  partial: boolean;
}

/** Words people type for a category, beside its title: plain words, Hindi words in Latin letters, and common spellings. */
export const CATEGORY_ALIASES: Record<CategoryId, readonly string[]> = {
  workout: ['exercise', 'gym', 'strength', 'training', 'session'],
  stretch: ['stretching', 'mobility', 'yoga', 'flexibility'],
  walk: ['walking', 'stroll', 'after meal walk'],
  steps: ['step count', 'pedometer'],
  food: ['meal', 'meals', 'eat', 'eating', 'diet', 'khana'],
  glucose: ['sugar', 'blood sugar', 'diabetes', 'cgm', 'meter', 'hypo', 'shugar'],
  bp: ['bp', 'blood pressure', 'pressure', 'hypertension', 'cuff'],
  back: ['back pain', 'sciatica', 'leg pain', 'pain', 'kamar dard', 'kamar', 'spine', 'nerve'],
  weight: ['kg', 'bmi', 'wazan', 'body weight'],
  water: ['drink', 'drinking', 'fluid', 'fluids', 'pani', 'paani', 'hydration'],
  sleep: ['nap', 'neend', 'night'],
  waist: ['waistline', 'tummy', 'belly'],
  labs: ['hba1c', 'a1c', 'b12', 'vitamin b12', 'vitamin d', 'blood test', 'lab', 'lab test', 'report'],
  learn: ['guide', 'help', 'tips', 'read', 'articles'],
};

/** The same, for the shortcuts, by their ids (`SHORTCUTS` in the registry). */
export const SHORTCUT_ALIASES: Readonly<Record<string, readonly string[]>> = {
  programme: ['program', 'plan', 'your plan', '12 week', 'join'],
  library: ['exercises', 'exercise list', 'moves', 'demos'],
  'meal-ideas': ['recipes', 'meal plan', 'menu', 'sample week', 'ideas'],
  bmi: ['body mass index'],
  'today-log': ['log', 'history', 'my day', 'records', 'diary'],
  backup: ['back up', 'export', 'restore', 'save', 'file'],
};

interface Entry {
  row: BrowseRow;
  group: BrowseGroupId;
  tokens: ReadonlySet<string>;
}

/** Folded the way the Guide's search folds words (`@/content/text`), so the two agree on what matches. */
const tokensOf = (texts: readonly string[]): ReadonlySet<string> => new Set(texts.flatMap(t => words(t).map(w => w.token)));

const ENTRIES: readonly Entry[] = [
  ...CATEGORIES.map((c): Entry => ({ row: { kind: 'category', id: c.id, title: c.title }, group: c.group, tokens: tokensOf([c.title, ...CATEGORY_ALIASES[c.id]]) })),
  ...BROWSE_GROUPS.flatMap(g => SHORTCUTS[g.id].map((s): Entry => ({
    row: { kind: 'shortcut', id: s.id, title: s.title, to: s.to }, group: g.id, tokens: tokensOf([s.title, ...(SHORTCUT_ALIASES[s.id] ?? [])]),
  }))),
];

/** Every word typed is one of the entry's; the last may be the start of one, as people type, but never a single letter. */
function matches(tokens: ReadonlySet<string>, typed: readonly { token: string }[]): boolean {
  return typed.every(({ token }, i) => tokens.has(token)
    || (i === typed.length - 1 && token.length >= 2 && [...tokens].some(t => t.startsWith(token))));
}

const CONTENT_GROUP: Record<SearchResult['kind'], BrowseGroupId> = { meal: 'eat', topic: 'learn', card: 'learn' };

/** The Guide's links may still name v1's addresses; Browse opens the v2 place (journey §19.3). */
const placeOf = (to: string) => redirectFor(to, '') ?? to;

export function browse(query: string, ctx: GuideContext, mode: 'browse' | 'pick' = 'browse'): BrowseResults {
  const typed = words(query);
  const entries = ENTRIES.filter(e => (mode === 'browse' || e.row.kind === 'category') && (typed.length === 0 || matches(e.tokens, typed)));
  // Nothing typed: the Guide's topics, in the person's order.
  const found = mode === 'pick' ? [] : search(query, ctx);
  const onlyPartial = typed.length > 0 && found.length > 0 && found.every(r => r.missing.length > 0);
  // A category or shortcut with every word is the answer; part-matches beside it would only distract.
  const content = onlyPartial && entries.length > 0 ? [] : found;
  const rows = new Map<BrowseGroupId, BrowseRow[]>(BROWSE_GROUPS.map(g => [g.id, []]));
  for (const e of entries) rows.get(e.group)?.push(e.row);
  for (const r of content) {
    rows.get(CONTENT_GROUP[r.kind])?.push({ kind: r.kind, id: r.id, title: r.title, detail: r.detail, to: placeOf(r.to), result: r });
  }
  return {
    groups: BROWSE_GROUPS.map(g => ({ id: g.id, title: g.title, rows: rows.get(g.id) ?? [] })).filter(g => g.rows.length > 0),
    partial: onlyPartial && entries.length === 0,
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/screens/browse/browse.test.ts`
Expected: PASS.

If one alias test fails because an alias pulls in an extra category, take that alias out rather than loosening the test. For example, "weights" folds to "weight" and would put Workout into a search for "weight".

- [ ] **Step 5: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/browse/browse.ts src/screens/browse/browse.test.ts
git commit -m "feat: Index Browse, and search categories, shortcuts, the Guide and meal ideas together"
```

---

### Task 4: The Browse screen, its More menu, and Home's layout outside Home

**Files:**
- Create: `src/components/hig/ActionMenu.tsx`
- Modify: `src/screens/home/TileMenu.tsx`
- Create: `src/screens/home/homeLayout.ts`, `src/screens/home/homeLayout.test.ts`
- Modify: `src/screens/home/layout.ts`, `layout.test.ts` (`storedLayout`)
- Modify: `src/screens/home/editor.ts` (`latest` reads `layoutNow`)
- Modify: `src/screens/home/HomeScreen.tsx` (`useHomeLayout`)
- Create: `src/screens/browse/BrowseList.tsx`
- Modify: `src/screens/browse/BrowseScreen.tsx`
- Modify: `src/components/hig/shell.node.test.ts` (Browse's tap rule and the menu's page claim, read from their new files)
- Create: `scripts/e2e/acceptance/journeys/v08.mjs`

**Interfaces:**
- Consumes:
  - `browse` and `BrowseResults` (Task 3);
  - `addTile`, `hideTile`, `addButton`, `groupFull` and `placedMessage` (`./layout`);
  - `defaultHome` and `relevantCategories` (Task 2);
  - `TileIcon`, `tileHref`, `UrgentContext`, `useGuided()`, `gateFor` and `opensOnHold` (`@/components/checkin/start`), `skipNextTransition`, `partialDetail` and `useGuide`.
- Produces:
  - `storedLayout(home: unknown): HomeLayout | undefined`;
  - `useHomeLayout(): { layout: HomeLayout; fallback: HomeLayout; stored: HomeLayout | undefined; relevant: CategoryId[] }`;
  - `layoutNow(fallback: HomeLayout): HomeLayout`;
  - `changeHome(fallback: HomeLayout, op: (layout: HomeLayout) => HomeLayout): { next: HomeLayout; saved: Promise<StoreResult> } | undefined`;
  - `interface MenuAnchor { anchor: HTMLElement; opener: HTMLElement }`;
  - `interface MenuAction { label: string; disabled?: boolean; onSelect: () => void }`;
  - `ActionMenu<T extends MenuAnchor>(props: { target: T | null; describe: (shown: T) => { title: string; note?: string; actions: readonly MenuAction[] }; onClose: (reason: 'action' | 'dismiss') => void; onClosed?: () => void })`;
  - `SearchField({ value, onChange, label? })`;
  - `BrowseRows({ results, origin, held, onMore })`;
  - `interface Origin { path: string; label: string; search?: string }`.

- [ ] **Step 1: Write the failing tests.** In `src/screens/home/layout.test.ts`, add `storedLayout` to the import from `./layout`, and append:

```ts
describe('storedLayout: what a change starts from (Review Focus 1)', () => {
  it('is the stored layout when this build can draw it, and nothing otherwise, so a change starts from the defaults rather than from an empty Home', () => {
    expect(storedLayout(L)).toBe(L);
    expect(storedLayout(undefined)).toBeUndefined();
    expect(storedLayout({ order: {}, hidden: [] })).toBeUndefined();
    expect(storedLayout('grid')).toBeUndefined();
  });
});
```

Create `src/screens/home/homeLayout.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeIndexedDB } from '@/store/fakeIdb';
import type { HomeLayout } from '@/types';

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
const { changeHome, layoutNow } = await import('./homeLayout');
const { addTile } = await import('./layout');

/** P02's defaults: no conditions, so Move, Food, then the fill-ins. */
const DEFAULTS: HomeLayout = { order: { move: ['workout', 'stretch', 'walk'], eat: ['food'], check: ['weight', 'sleep'], learn: ['learn'] }, hidden: [] };

beforeEach(async () => {
  local.clear();
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB() });
});

describe('changing Home from Browse or Me (journey §5.1, §14; Review Focus 1)', () => {
  it('starts from the defaults while no layout is stored, never from an empty Home', async () => {
    expect(layoutNow(DEFAULTS)).toBe(DEFAULTS);
    const changed = changeHome(DEFAULTS, l => addTile(l, 'waist'));
    expect((await changed!.saved).ok).toBe(true);
    expect(store.getState().settings.home).toEqual({ ...DEFAULTS, order: { ...DEFAULTS.order, check: ['weight', 'sleep', 'waist'] } });
  });
  it('builds on the stored layout, a change still being written included', async () => {
    const first = changeHome(DEFAULTS, l => addTile(l, 'waist'));
    const second = changeHome(DEFAULTS, l => addTile(l, 'water'));
    await Promise.all([first!.saved, second!.saved]);
    expect(store.getState().settings.home?.order.check).toEqual(['weight', 'sleep', 'waist', 'water']);
  });
  it('writes nothing when the operation changes nothing', () => {
    expect(changeHome(DEFAULTS, l => l)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run them to check they fail**

Run: `npx vitest run src/screens/home/layout.test.ts src/screens/home/homeLayout.test.ts`
Expected: FAIL. `storedLayout` isn't exported, and `./homeLayout` doesn't exist.

- [ ] **Step 3: `storedLayout`.** In `src/screens/home/layout.ts`, import `isHomeLayout` beside the registry's other names, and add:

```ts
/**
 * A stored or imported `settings.home` this build can draw (`isHomeLayout`),
 * or nothing. The caller then falls back to the defaults, never to an empty Home.
 */
export function storedLayout(home: unknown): HomeLayout | undefined {
  return home !== undefined && isHomeLayout(home) ? home : undefined;
}
```

- [ ] **Step 4: The shared layout helpers** `src/screens/home/homeLayout.ts`

```ts
/**
 * Home's tile layout, for the screens that change it besides Home: Browse's
 * More and Me's offers (journey §5.1, §14).
 *
 * It's the person's own layout once one is stored, or else the defaults from
 * their answers, the same as Home draws. Every change is made to the layout
 * as it stands at that moment, a change still being written included, so
 * quick taps build on each other, as in Edit Home.
 */
import { useMemo } from 'react';
import { defaultHome, relevantCategories, type CategoryId } from '@/categories';
import { createDefaultProfile } from '@/profile/defaults';
import type { StoreResult } from '@/store/db';
import { getState, setSettings, useStore } from '@/store/useStore';
import type { HomeLayout } from '@/types';
import { storedLayout } from './layout';

export function useHomeLayout(): { layout: HomeLayout; fallback: HomeLayout; stored: HomeLayout | undefined; relevant: CategoryId[] } {
  const { profile, settings, observations } = useStore();
  const hasSteps = useMemo(() => observations.some(o => o.kind === 'steps'), [observations]);
  const answers = useMemo(() => ({
    profile: profile ?? createDefaultProfile({ weightKg: settings.currentWeight || 0, needsHealthReview: true }),
    settings,
    hasSteps,
  }), [profile, settings, hasSteps]);
  const fallback = useMemo(() => defaultHome(answers), [answers]);
  const relevant = useMemo(() => relevantCategories(answers), [answers]);
  const stored = storedLayout(settings.home);
  return { layout: stored ?? fallback, fallback, stored, relevant };
}

/** The layout as it stands this moment, a change still being written included. */
export function layoutNow(fallback: HomeLayout): HomeLayout {
  return storedLayout(getState().settings.home) ?? fallback;
}

/** One Edit Home operation on the layout as it stands, then stored; `undefined` when it changed nothing. */
export function changeHome(fallback: HomeLayout, op: (layout: HomeLayout) => HomeLayout): { next: HomeLayout; saved: Promise<StoreResult> } | undefined {
  const before = layoutNow(fallback);
  const next = op(before);
  return next === before ? undefined : { next, saved: setSettings({ home: next }) };
}
```

- [ ] **Step 5: Home and Edit Home read through them.**
  - **`src/screens/home/editor.ts`:** `latest` returns a refused draft first, and that stays. Make it `const latest = (): HomeLayout => draft.current ?? layoutNow(fallback);`, keeping its comment, and import `layoutNow` from `./homeLayout`. Drop `getState` from the store import, since `latest` was its only user. `isHomeLayout` stays: `useFirstLayout` uses it.
  - **`src/screens/home/HomeScreen.tsx`:**
    - import `useHomeLayout` from `./homeLayout`;
    - delete the `hasSteps` memo (`const hasSteps = useMemo(() => observations.some(o => o.kind === 'steps'), [observations]);`) and the two lines that make `stored` and `fallback` (`const stored = settings.home !== undefined && isHomeLayout(settings.home) ? …` and `const fallback = useMemo(() => defaultHome({ profile: guided.profile, settings, hasSteps }), …);`). Put this line where `stored` was: `const { fallback, stored } = useHomeLayout();`. It works the defaults out from the same profile `useGuided` gives, the stored one or the default;
    - drop `defaultHome` and `isHomeLayout` from the registry import.

  `useFirstLayout`, the editor and `const layout = editor.draft ?? first;` stay as they are: Home still draws its first defaults, and stores them, itself.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/screens/home`
Expected: PASS.

- [ ] **Step 7: The M18 menu, shared.** Create `src/components/hig/ActionMenu.tsx`. Move `GROW`, `ITEM`, the menu's markup and `useInertPage` out of `src/screens/home/TileMenu.tsx`, unchanged. The rows become a list:

```tsx
import { useId, useLayoutEffect, useState, type CSSProperties } from 'react';
import { Menu } from '@base-ui/react/menu';
import { MOTION, springLinear } from '@/design/motion';
import { claimModal } from './modal';

/**
 * The menu grows from its corner with `spring-quick` (M18); Reduce Motion
 * makes it static (index.css). Custom properties, read by its classes: the
 * popup sets its own `transition` while it positions itself.
 */
const GROW = { '--grow-ms': `${MOTION.springQuick.cssMs}ms`, '--grow-ease': springLinear(0) } as CSSProperties;

const ITEM = 'flex min-h-12 w-full cursor-default select-none items-center px-4 py-2 text-[length:var(--text-body)] leading-snug outline-none [overflow-wrap:break-word] data-[highlighted]:bg-muted data-[disabled]:text-muted-foreground';

/** Where a menu is drawn, and what gets focus back when it closes. */
export interface MenuAnchor {
  anchor: HTMLElement;
  /** What opened it: the element after a long-press, or its More button. */
  opener: HTMLElement;
}

export interface MenuAction {
  label: string;
  disabled?: boolean;
  onSelect: () => void;
}

/**
 * A long-press menu or a More menu (journey §7.2, §14; M18): full-width
 * labelled rows under a title, then Close. It grows from the element that
 * opened it, and dims the page without blurring it.
 *
 * It owns its moment as a modal (B-03): the page behind is inert, Escape and
 * Close close it, and focus goes back to what opened it, or to the screen's
 * title when that has gone. `describe` reads the target the menu last opened
 * for, so its rows stay put while it closes.
 */
export function ActionMenu<T extends MenuAnchor>({ target, describe, onClose, onClosed }: {
  target: T | null;
  describe: (shown: T) => { title: string; note?: string; actions: readonly MenuAction[] };
  /** `action` when an item chose where focus goes; `dismiss` for Escape, Close and a tap outside. */
  onClose: (reason: 'action' | 'dismiss') => void;
  /** It has finished closing: an Undo it set off can be offered now (B-03). */
  onClosed?: () => void;
}) {
  const titleId = useId();
  const [shown, setShown] = useState(target);
  if (target && target !== shown) setShown(target);
  const open = target !== null;
  useInertPage(open, shown?.opener);
  if (!shown) return null;
  const { title, note, actions } = describe(shown);
  return (
    <Menu.Root
      open={open}
      onOpenChange={(next, details) => { if (!next) onClose(details.reason === 'item-press' ? 'action' : 'dismiss'); }}
      onOpenChangeComplete={isOpen => { if (!isOpen) onClosed?.(); }}
    >
      <Menu.Portal>
        <Menu.Backdrop className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        {/* Beside the element when there is room; with none on either side (large text, a short screen), over it, kept in view. */}
        <Menu.Positioner anchor={shown.anchor} side="bottom" align="start" sideOffset={8} collisionPadding={16} sticky className="z-50 outline-none">
          <Menu.Popup
            aria-labelledby={titleId}
            finalFocus={false}
            style={GROW}
            className="max-h-[calc(100dvh-2rem)] w-[min(20rem,calc(100vw-2rem))] origin-[var(--transform-origin)] overflow-y-auto overscroll-contain rounded-2xl bg-grouped-card py-1 text-foreground shadow-2xl outline-none transition-[transform,opacity] duration-[var(--grow-ms)] ease-[var(--grow-ease)] data-[ending-style]:scale-90 data-[ending-style]:opacity-0 data-[starting-style]:scale-90 data-[starting-style]:opacity-0"
          >
            <p id={titleId} className="px-4 pb-1 pt-3 text-[length:var(--text-footnote)] font-medium uppercase tracking-wide text-muted-foreground [overflow-wrap:break-word]">{title}</p>
            {note && <p className="px-4 pb-2 text-[length:var(--text-subhead)] leading-snug text-muted-foreground [overflow-wrap:break-word]">{note}</p>}
            {actions.map(a => (
              <Menu.Item key={a.label} className={ITEM} disabled={a.disabled} onClick={a.onSelect}>{a.label}</Menu.Item>
            ))}
            <Menu.Separator className="my-1 h-px bg-separator" />
            <Menu.Item className={ITEM} onClick={() => onClose('dismiss')}>Close</Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

// useInertPage(open, opener): moved here from TileMenu.tsx, word for word, with its comment.
```

Paste `useInertPage` from `TileMenu.tsx` in place of the last comment. Then `TileMenu` keeps its props and draws through `ActionMenu`. Replace its body, from `const titleId = useId();` to the end of the function, with:

```tsx
  return (
    <ActionMenu
      target={target}
      describe={shown => {
        const { title, group } = categoryById(shown.id);
        const list = layout.order[group];
        const at = list.indexOf(shown.id);
        return {
          title,
          actions: [
            { label: 'Hide from Home', onSelect: () => onHide(shown.id) },
            { label: 'Move up', disabled: at <= 0, onSelect: () => onMove(shown.id, -1) },
            { label: 'Move down', disabled: at < 0 || at >= list.length - 1, onSelect: () => onMove(shown.id, 1) },
            ...(editing ? [] : [{ label: 'Edit Home', onSelect: () => onEdit(shown.id) }]),
          ],
        };
      }}
      onClose={onClose}
      onClosed={onClosed}
    />
  );
```

`TileMenu.tsx` then imports `ActionMenu` from `@/components/hig/ActionMenu`, plus `categoryById`, `type CategoryId`, `type HomeLayout` and `type MenuTarget`, which it already has. Delete its other imports (`useId`, `useLayoutEffect`, `useState`, `CSSProperties`, `Menu`, `MOTION`, `springLinear` and `claimModal`): they moved with the markup. `MenuTarget` (`id`, `anchor`, `opener`) is an `ActionMenu` target as it stands.

- [ ] **Step 8: Browse's rows** `src/screens/browse/BrowseList.tsx`

```tsx
import { useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { SearchIcon } from 'lucide-react';
import { categoryById, type CategoryId } from '@/categories';
import { Group, Row } from '@/components/hig/List';
import { skipNextTransition } from '@/design/motion';
import { partialDetail } from '@/screens/guide/format';
import { tileHref } from '@/screens/home/model';
import { TileIcon } from '@/screens/home/Tile';
import type { BrowseResults } from './browse';

/** Where a row was opened from, so the screen it opens says "Back to Browse" (journey §8.1). */
export interface Origin {
  path: string;
  label: string;
  search?: string;
}

/**
 * The search field at the top of Browse (journey §14) and of its pick mode.
 * Labelled, 48 px, with a labelled Clear. Submitting closes the keyboard and
 * nothing else.
 */
export function SearchField({ value, onChange, label = 'Search' }: { value: string; onChange: (value: string) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const field = useId();
  return (
    <form role="search" onSubmit={e => { e.preventDefault(); input.current?.blur(); }} className="flex flex-col gap-1.5">
      <label htmlFor={field} className="px-1 text-[length:var(--text-subhead)] font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center gap-1">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            ref={input}
            id={field}
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Glucose, roti, sciatica…"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="min-h-12 w-full rounded-xl bg-grouped-card pl-10 pr-3 text-[length:var(--text-body)] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-tint/50 [&::-webkit-search-cancel-button]:appearance-none"
          />
        </div>
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); input.current?.focus(); }}
            className="press-feedback min-h-12 shrink-0 px-3 text-[length:var(--text-body)] font-semibold text-tint"
          >
            Clear
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * Browse's groups (journey §14):
 * - a category row opens its hub, and has a labelled More beside it;
 * - a shortcut row opens its target;
 * - a Guide topic, answer or meal opens its page.
 * A partial result says what it matches and what it doesn't.
 */
export function BrowseRows({ results, origin, held, onMore }: {
  results: BrowseResults;
  origin: Origin;
  /** Asked at the tap: this category's screen opens on its refusal now (`opensOnHold`), so nothing animates into it (motion rule 2). */
  held: (id: CategoryId) => boolean;
  onMore: (id: CategoryId, button: HTMLElement) => void;
}) {
  return (
    <>
      {results.groups.map(g => (
        <Group key={g.id} header={g.title}>
          {g.rows.map(r => {
            if (r.kind === 'category') return <CategoryRow key={`category-${r.id}`} id={r.id} origin={origin} held={held} onMore={onMore} />;
            if (r.kind === 'shortcut') return <Row key={`shortcut-${r.id}`} as={Link} to={r.to} state={origin} viewTransition label={r.title} chevron />;
            return (
              <Row
                key={`${r.kind}-${r.id}`}
                as={Link}
                to={r.to}
                state={origin}
                viewTransition
                label={r.title}
                detail={results.partial ? partialDetail(r.result) : r.detail}
                chevron
              />
            );
          })}
        </Group>
      ))}
    </>
  );
}

function CategoryRow({ id, origin, held, onMore }: { id: CategoryId; origin: Origin; held: (id: CategoryId) => boolean; onMore: (id: CategoryId, button: HTMLElement) => void }) {
  const category = categoryById(id);
  return (
    <div className="flex items-center gap-2 pr-3">
      <Link
        to={tileHref(category)}
        state={origin}
        viewTransition
        onClick={() => { if (held(id)) skipNextTransition(); }}
        className="press-feedback flex min-h-[3.25rem] min-w-0 flex-1 items-center gap-3 py-2 pl-4 text-left transition-colors active:bg-muted/60"
      >
        <TileIcon category={category} />
        <span className="min-w-0 flex-1 text-[length:var(--text-body)] leading-snug [overflow-wrap:break-word]">{category.title}</span>
      </Link>
      {/* The menu's visible way in (journey §20.4 rule 3). */}
      <button
        type="button"
        aria-label={`More, ${category.title}`}
        onClick={e => onMore(id, e.currentTarget)}
        className="press-feedback flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-full bg-tint/10 px-3 text-[length:var(--text-subhead)] font-semibold text-tint"
      >
        More
      </button>
    </div>
  );
}
```

- [ ] **Step 9: The screen.** Replace `src/screens/browse/BrowseScreen.tsx` with:

```tsx
import { useContext, useMemo, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ActionMenu, type MenuAction, type MenuAnchor } from '@/components/hig/ActionMenu';
import { gateFor, opensOnHold } from '@/components/checkin/start';
import { Screen } from '@/components/hig/Screen';
import { categoryById, type CategoryId } from '@/categories';
import { useGuided } from '@/hooks/useGuided';
import { useGuide } from '@/screens/guide/useGuide';
import { changeHome, useHomeLayout } from '@/screens/home/homeLayout';
import { addButton, addTile, groupFull, hideTile, placedMessage } from '@/screens/home/layout';
import { UrgentContext } from '@/screens/home/urgent';
import type { HomeLayout } from '@/types';
import { BrowseRows, SearchField } from './BrowseList';
import { browse } from './browse';

interface MoreTarget extends MenuAnchor {
  id: CategoryId;
}

/**
 * Browse (journey §14): search at the top; every category, grouped, with its
 * More (Add to Home or Remove from Home); the shortcuts; the Guide's topics.
 * Edit Home's pick mode has its own address here and opens over Edit Home
 * (D56).
 */
export default function BrowseScreen() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  // The field owns what is typed; the address keeps it, so Back from a result returns to the same search.
  const [query, setQuery] = useState(() => params.get('q') ?? '');
  const { ctx } = useGuide();
  const { layout, fallback } = useHomeLayout();
  const guided = useGuided();
  const urgent = useContext(UrgentContext);
  const [more, setMore] = useState<MoreTarget | null>(null);
  // An urgent decision closes the menu at once, and it stays closed (M18).
  if (urgent !== undefined && more !== null) setMore(null);
  // Polite, and said again even when the words repeat.
  const [said, setSaid] = useState({ text: '', n: 0 });
  const [problem, setProblem] = useState<string>();
  const results = useMemo(() => browse(query, ctx), [query, ctx]);

  if (params.get('pick') === '1') return <Navigate to="/home?edit=add" replace />;

  const origin = { path: location.pathname, label: 'Browse', ...(location.search ? { search: location.search } : {}) };
  const change = (value: string) => {
    setQuery(value);
    setParams(value ? { q: value } : {}, { replace: true, preventScrollReset: true });
  };
  const edit = (op: (layout: HomeLayout) => HomeLayout, words: (next: HomeLayout) => string) => {
    const changed = changeHome(fallback, op);
    if (!changed) return;
    setSaid(s => ({ text: words(changed.next), n: s.n + 1 }));
    void changed.saved.then(r => setProblem(r.ok ? undefined : `That did not save. ${r.failure.message}`));
  };
  // A movement screen that opens on its refusal shows it in the first frame, asked at the tap (codex V1-05).
  const held = (id: CategoryId) => {
    const { mode } = categoryById(id);
    return mode !== undefined && opensOnHold(gateFor(guided, mode));
  };
  const menuFor = (id: CategoryId): { title: string; note?: string; actions: MenuAction[] } => {
    const { title, group } = categoryById(id);
    if (layout.order[group].includes(id)) {
      return { title, actions: [{ label: 'Remove from Home', onSelect: () => edit(l => hideTile(l, id), () => `${title} removed from Home. It is under Hidden in Edit Home.`) }] };
    }
    const add = addButton(layout, id);
    return {
      title,
      ...(add.disabled ? { note: 'Hide a tile in Edit Home to make room.' } : {}),
      actions: [{
        label: add.disabled ? add.label : 'Add to Home',
        disabled: add.disabled,
        // Another copy of the app may have filled the group meanwhile: then nothing changes.
        onSelect: () => edit(l => (groupFull(l, group) || l.order[group].includes(id) ? l : addTile(l, id)), next => placedMessage(next, id, 'added')),
      }],
    };
  };

  return (
    <Screen title="Browse">
      <SearchField value={query} onChange={change} />
      {results.partial && (
        <p className="px-4 text-[length:var(--text-subhead)] leading-snug text-muted-foreground">Nothing matches every word you typed. These match some of them.</p>
      )}
      <BrowseRows results={results} origin={origin} held={held} onMore={(id, button) => setMore({ id, anchor: button, opener: button })} />
      <p role="status" className="px-2 pt-4 text-center text-[length:var(--text-body)] text-muted-foreground empty:hidden">
        {results.groups.length === 0 ? `Nothing matches “${query.trim()}”. Try another word, such as roti or walk.` : ''}
      </p>
      {problem && <p role="alert" className="px-4 text-[length:var(--text-subhead)] leading-snug text-stop">{problem}</p>}
      <p role="status" className="sr-only">{said.text}{said.n % 2 ? '​' : ''}</p>
      <ActionMenu target={more} describe={({ id }) => menuFor(id)} onClose={() => setMore(null)} />
    </Screen>
  );
}
```

- [ ] **Step 10: The source checks follow the code.** `src/components/hig/shell.node.test.ts` reads two of the files this task changes.
  - In `it('a row into a movement screen that opens on its refusal skips the transition, asked at the tap (codex V1-05)')`, replace the `BrowseScreen.tsx` line with:

    ```ts
    // Browse asks the gate in `held`, which each category row calls at the tap.
    expect(read('src/screens/browse/BrowseScreen.tsx')).toMatch(/const held = \(id: CategoryId\) => \{\s*const \{ mode \} = categoryById\(id\);\s*return mode !== undefined && opensOnHold\(gateFor\(guided, mode\)\);/);
    expect(read('src/screens/browse/BrowseList.tsx')).toContain('onClick={() => { if (held(id)) skipNextTransition(); }}');
    ```

  - In `it('sheets and the tile menu own the page while open: the toasts wait in #toasts, hidden (codex V1-13)')`, the menu's claim on the page has moved to `ActionMenu`. Rename the test `'sheets and menus own the page while open: the toasts wait in #toasts, hidden (codex V1-13)'`, and replace its `TileMenu.tsx` line with:

    ```ts
    expect(read('src/components/hig/ActionMenu.tsx')).toContain('claimModal()');
    ```

Run: `npx vitest run src/components/hig/shell.node.test.ts`
Expected: PASS.

- [ ] **Step 11: Write V-J08** `scripts/e2e/acceptance/journeys/v08.mjs`

```js
/**
 * V-J08: look up a food (journey §17.1 V-J08, §14). Browse → search
 * "chapatti" → the food and the Guide card. Also a condition (sciatica) and a
 * word nothing has.
 */
import { persona } from '../fixtures/personas.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J08';
export const title = 'Look up a food in Browse';
export const safety = false;

const flat = s => s.replace(/[  ]/g, ' ').replace(/\s+/g, ' ');

/** Browse, then the words typed into its search, as a person types them. */
async function searchBrowse(t, words) {
  const page = t.page;
  await ui.tab(page, 'Browse');
  const box = page.getByRole('main').getByRole('searchbox', { name: 'Search', exact: true });
  await ui.type(box, words);
  await page.waitForTimeout(300);
  return box;
}

export const cases = [
  {
    name: 'chapatti finds the food and the Guide card',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home' });
      const main = page.getByRole('main');
      await t.step(1, 'Browse → search “chapatti”', async () => {
        await searchBrowse(t, 'chapatti');
        await t.must(await ui.row(ui.section(main, 'Eat'), 'Roti, dal and sabzi', 'link').count() === 1, `Eat lists no “Roti, dal and sabzi”: ${flat(await main.innerText()).slice(0, 300)}`);
        await t.check(await ui.row(ui.section(main, 'Learn'), 'Rice, roti and millets', 'link').count() === 1, 'Learn lists no “Rice, roti and millets”');
        await t.check(!/These match some of them/.test(await main.innerText()), 'a full match is labelled partial');
        await t.checkpoint('browse-chapatti');
      }, { input: 'chapatti' });
      await t.step(2, 'Open the food; Back returns to Browse with the search kept', async () => {
        await ui.tap(ui.row(ui.section(main, 'Eat'), 'Roti, dal and sabzi', 'link'));
        await ui.heading(page, 'Roti, dal and sabzi');
        await t.check(await t.route() === '/hub/food/ideas/l-roti-dal-sabzi', `the food opened at ${await t.route()}`);
        await t.checkpoint('meal-from-browse');
        await ui.tap(ui.back(page, 'Browse'));
        await ui.heading(page, 'Browse');
        const box = main.getByRole('searchbox', { name: 'Search', exact: true });
        await t.check(await box.inputValue() === 'chapatti', `Back lost the search: “${await box.inputValue()}”`);
      });
      await t.step(3, 'Open the Guide card', async () => {
        await ui.tap(ui.row(ui.section(main, 'Learn'), 'Rice, roti and millets', 'link'));
        await ui.heading(page, 'Rice, roti and millets');
        await t.check(await t.route() === '/hub/learn/card/card-grains', `the card opened at ${await t.route()}`);
        await t.checkpoint('card-from-browse');
      });
    },
  },
  {
    name: 'sciatica finds Back & leg and the back answers',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home' });
      const main = page.getByRole('main');
      await t.step(1, 'Browse → search “sciatica”', async () => {
        await searchBrowse(t, 'sciatica');
        await t.check(await ui.row(ui.section(main, 'Check'), 'Back & leg', 'link').count() === 1, 'Check lists no Back & leg');
        await t.check(await ui.row(ui.section(main, 'Learn'), 'Moving with back pain', 'link').count() === 1, 'Learn lists no “Moving with back pain”');
        await t.checkpoint('browse-sciatica');
      }, { input: 'sciatica' });
      await t.step(2, 'Back & leg opens its hub, with Back named after Browse', async () => {
        await ui.tap(ui.row(ui.section(main, 'Check'), 'Back & leg', 'link'));
        await page.waitForFunction(() => location.hash.startsWith('#/hub/back'), null, { timeout: 10000 });
        await t.check(await ui.back(page, 'Browse').count() === 1, 'the hub’s Back is not named Browse');
      });
    },
  },
  {
    name: 'a word nothing has says so',
    async run(t) {
      const page = await t.open({ seed: persona('P01'), route: '/home' });
      const main = page.getByRole('main');
      await t.step(1, 'Browse → search “xylophone”', async () => {
        await searchBrowse(t, 'xylophone');
        const text = flat(await main.innerText());
        await t.check(/Nothing matches “xylophone”\. Try another word, such as roti or walk\./.test(text), `no plain “nothing matches”: ${text.slice(0, 200)}`);
        await t.check(await ui.section(main, 'Move').count() === 0, 'groups are listed for a word nothing has');
        await t.checkpoint('browse-nothing');
      }, { input: 'xylophone' });
    },
  },
];
```

- [ ] **Step 12: Check by eye.** Run `npm run dev` and open Browse at 430×932 and 320×568, in light and dark, and at 200% text. Check each of these:
  - every group reads in order;
  - More's menu grows from the button and dims the page without blurring it;
  - Escape and Close return focus to More;
  - a full group's item says "Check is full (5)" with the note under the title;
  - after Add to Home, Home shows the tile at the end of its group.

- [ ] **Step 13: Gates, the journeys Browse affects, and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
npm run e2e:acceptance -- --only=V-J08,J20,S01 --projects=large-light,small-dark > /tmp/fit-checks/p4-t4.log 2>&1; tail -n 25 /tmp/fit-checks/p4-t4.log
git add src/components/hig/ActionMenu.tsx src/components/hig/shell.node.test.ts src/screens/home src/screens/browse scripts/e2e/acceptance/journeys/v08.mjs
git commit -m "feat: Make Browse real: every category and shortcut, a search, and More to add or remove a tile"
```

Expected: 0 failed. J20 reaches the Learn hub through Browse's "Learn" row, which is now a category row with a More beside it. Its link is still named "Learn".

---

### Task 5: Pick mode, from Edit Home's "+ Add"

**Files:**
- Create: `src/screens/home/EditButton.tsx` (moved out of `EditHome.tsx`)
- Modify: `src/screens/home/EditHome.tsx` (`PickSheet` replaces `AddSheet`)
- Modify: `src/screens/home/editor.ts` (`picking`, `setPicking`, `openPick`)
- Modify: `src/screens/home/HomeScreen.tsx` (`?edit=add`)
- Modify: `src/screens/home/layout.ts`, `layout.test.ts` (`notOnHome` goes)
- Modify: `src/screens/browse/BrowseList.tsx` (`PickRows`)
- Create (or extend, if Plan 2 made it): `scripts/e2e/acceptance/journeys/v12.mjs`

**Interfaces:**
- Consumes: `browse(query, ctx, 'pick')` (Task 3), `SearchField` (Task 4), `addButton` and `groupFull`, and `editor.add(id): Promise<string | undefined>`, which resolves to the words to announce once stored, or that it didn't save, and to nothing when it couldn't add.
- Produces:
  - `EditButton({ control, disabled?, label, name, onClick })`, where `control: Control | 'show' | 'pick' | 'later'`;
  - `PickRows({ results, layout, onPick })`;
  - `PickSheet({ open, onOpenChange, layout, onAdd })`;
  - on the editor: `picking: boolean`, `setPicking(open: boolean)`, and `openPick()`, which is safe to call during render;
  - Home reads `?edit=add`.

- [ ] **Step 1: `notOnHome` goes.** Pick mode lists every category, so nothing calls it any more:
  - in `src/screens/home/layout.ts`, delete `notOnHome` and its comment. `GROUPS` and `CATEGORIES` keep their other users;
  - in `layout.test.ts`, delete `describe('notOnHome: …')` and `notOnHome` from the import.

  `EditHome.tsx` stops importing it in Step 5.

Run: `npx vitest run src/screens/home/layout.test.ts`
Expected: PASS.

- [ ] **Step 2: `EditButton` gets its own file.** Move the `EditButton` function and its comment from `EditHome.tsx` into `src/screens/home/EditButton.tsx`, unchanged except for its export, its import and the `control` type:

```tsx
import type { Control } from './editor';

/**
 * A labelled, 48 px secondary button. A button that can't act stays in place,
 * focusable and says why in its own words ("Check is full (5)"), rather than
 * dropping out of the tab order under the person's focus.
 */
export function EditButton({ control, disabled = false, label, name, onClick }: {
  control: Control | 'show' | 'pick' | 'later';
  disabled?: boolean;
  label: string;
  /** What it acts on, after the visible words for a screen reader: "Move up, Water". */
  name: string;
  onClick: (button: HTMLButtonElement) => void;
}) {
  // (the body, unchanged)
}
```

In `EditHome.tsx`, import it: `import { EditButton } from './EditButton';`.

- [ ] **Step 3: Pick mode's rows.** In `src/screens/browse/BrowseList.tsx`, add `MAX_PER_GROUP` to the `@/categories` import, and add these imports:

```tsx
import { EditButton } from '@/screens/home/EditButton';
import { addButton, groupFull } from '@/screens/home/layout';
import type { HomeLayout } from '@/types';
```

Then append:

```tsx
/**
 * Pick mode's rows (journey §7.6, §14): every category, each with Add, Added,
 * or its full group's own words, and a full group says why under its rows,
 * as v1's "+ Add" did. The rows never vanish from under a finger: an added
 * one says "Added".
 */
export function PickRows({ results, layout, onPick }: { results: BrowseResults; layout: HomeLayout; onPick: (id: CategoryId) => void }) {
  return (
    <>
      {results.groups.map(g => (
        <Group
          key={g.id}
          header={g.title}
          {...(g.id !== 'data' && groupFull(layout, g.id) ? { footer: `${g.title} has ${MAX_PER_GROUP} tiles. Hide one in Edit Home to make room.` } : {})}
        >
          {g.rows.flatMap(r => (r.kind === 'category' ? [r] : [])).map(r => {
            const category = categoryById(r.id);
            const button = addButton(layout, r.id);
            return (
              <div key={r.id} data-pick={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <TileIcon category={category} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[length:var(--text-body)] leading-snug [overflow-wrap:break-word]">{category.title}</span>
                  {layout.hidden.includes(r.id) && button.label !== 'Added' && (
                    <span className="block text-[length:var(--text-subhead)] leading-snug text-muted-foreground">Hidden from Home</span>
                  )}
                </span>
                <EditButton control="pick" disabled={button.disabled} label={button.label} name={category.title} onClick={() => onPick(r.id)} />
              </div>
            );
          })}
        </Group>
      ))}
    </>
  );
}
```

- [ ] **Step 4: The editor owns pick mode.** In `src/screens/home/editor.ts`, inside `useHomeEditor`:

```ts
  // Browse's pick mode over Edit Home (journey §7.6, D56).
  const [picking, setPicking] = useState(false);
```

  - In `finish`, which `done` calls once every change is stored, add `setPicking(false);` before `setEditing(false);`.
  - Add, beside `start`:

```ts
  /** Edit Home with pick mode over it, as `#/browse?pick=1` asks (journey §19.2). State only, so it is safe during render; the sheet takes focus itself. */
  const openPick = () => {
    setEditing(true);
    setMenu(null);
    setPicking(true);
  };
```

  - Add `picking, setPicking, openPick` to the returned object.

- [ ] **Step 5: `PickSheet` replaces `AddSheet`.** In `src/screens/home/EditHome.tsx`:
  - in `EditTiles`:
    - delete `const [adding, setAdding] = useState(false);`;
    - change "+ Add"'s `onClick` to `() => editor.setPicking(true)`;
    - replace `<AddSheet open={adding} onOpenChange={setAdding} layout={layout} onAdd={editor.add} />` with `<PickSheet open={editor.picking} onOpenChange={editor.setPicking} layout={layout} onAdd={editor.add} />`;
  - delete `AddSheet`, `AddList` and their comment, then what only they used: `groupTitle`, the `Group` import, and `notOnHome` in the `./layout` import;
  - the editor import becomes `import type { HomeEditor } from './editor';`, since `Control` moved with `EditButton`;
  - add `useMemo` to the `react` import, and add `import { contextOf } from '@/content';`, `import { PickRows, SearchField } from '@/screens/browse/BrowseList';` and `import { browse } from '@/screens/browse/browse';`;
  - append:

```tsx
/** Pick mode lists categories only, so it needs none of the person's Guide answers. */
const NO_GUIDE = contextOf();

/**
 * "+ Add" (journey §7.6, §14, D56): Browse in pick mode, over Edit Home.
 * Every category, grouped, each with Add or Added; search at the top; Done.
 * A tile added here fades in at its place in its group (M17).
 */
export function PickSheet({ open, onOpenChange, layout, onAdd }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layout: HomeLayout;
  /** `editor.add`: resolves to what to announce once stored, or that it didn't save; to nothing when it couldn't add. */
  onAdd: (id: CategoryId) => Promise<string | undefined>;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add to Home" detent="large">
      {open && <PickBody layout={layout} onAdd={onAdd} onDone={() => onOpenChange(false)} />}
    </Sheet>
  );
}

function PickBody({ layout, onAdd, onDone }: { layout: HomeLayout; onAdd: (id: CategoryId) => Promise<string | undefined>; onDone: () => void }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => browse(query, NO_GUIDE, 'pick'), [query]);
  // The page behind is inert while the sheet is open, so the sheet says what happened itself.
  const [said, setSaid] = useState('');
  return (
    <>
      <p className="px-1 text-[length:var(--text-body)] leading-snug">Choose a tile for Home. Each group holds up to {MAX_PER_GROUP}.</p>
      <SearchField value={query} onChange={setQuery} />
      <p role="status" className="sr-only">{said}</p>
      <PickRows results={results} layout={layout} onPick={id => void onAdd(id).then(words => { if (words) setSaid(words); })} />
      {results.groups.length === 0 && (
        <p className="px-1 text-[length:var(--text-body)] leading-snug text-muted-foreground">Nothing matches “{query.trim()}”. Try another word.</p>
      )}
      <button
        type="button"
        onClick={onDone}
        className="press-feedback min-h-[60px] rounded-xl bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint"
      >
        Done
      </button>
      {/* Room to scroll the last row clear of an Undo toast still standing from Edit Home (M19). */}
      <div aria-hidden className="h-24" />
    </>
  );
}
```

`Sheet`, `MAX_PER_GROUP`, `CategoryId` and `HomeLayout` are already imported there. `FullNote` stays for Hidden.

- [ ] **Step 6: `#/browse?pick=1` lands in Edit Home.** In `src/screens/home/HomeScreen.tsx`:
  - in the effect that takes `SHEET_KEYS` and `moved` out of the address, make its early return `if (!SHEET_KEYS.some(k => params.has(k)) && !params.has('moved') && !params.has('edit')) return;`, and add `next.delete('edit');` beside `next.delete('moved');`;
  - straight after `const editor = useHomeEditor(...)`:

```tsx
  // `#/browse?pick=1` arrives as `?edit=add` (journey §19.2, D56): Edit Home,
  // with pick mode over it, once per request. The effect above then takes it
  // out of the address.
  const pickAsked = params.get('edit') === 'add';
  const [pickSeen, setPickSeen] = useState(false);
  if (pickAsked !== pickSeen) {
    setPickSeen(pickAsked);
    if (pickAsked) editor.openPick();
  }
```

- [ ] **Step 7: Write V-J12** `scripts/e2e/acceptance/journeys/v12.mjs`

  If Plan 2 already created this file:
  - keep its `id`, `title` and imports;
  - add the three cases below to its `cases`. A case below replaces one of Plan 2's that has the same `name`;
  - where Plan 2's "+ Add" step uses Plan 1's interim sheet, it carries on working. The sheet keeps the title "Add to Home" and the labels "Add, Labs" and "Added, Labs".

  Otherwise create the file:

```js
/**
 * V-J12: customise Home (journey §17.1 V-J12, §7.6, §14, §5.1; M17, M18).
 * Edit Home → Sleep "Hide" → Water "Move up" → "+ Add" → Labs "Add" → Done.
 * Browse's More adds and removes a tile, from the defaults when Home has
 * stored none yet, and a full group says so.
 */
import { docs } from '../lib/harness.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J12';
export const title = 'Customise Home';
export const safety = false;

/** A group's tiles on Home, in order, by category id. */
const tilesIn = (page, group) => page.getByRole('main').locator(`section[data-group="${group}"] li[data-tile]`).evaluateAll(els => els.map(e => e.dataset.tile));
const layoutOf = async t => docs(await t.db()).settings?.home;
const json = v => JSON.stringify(v);

/** P02 (no conditions) with Water second in Check, so it can move up. */
const LAID = { order: { move: ['workout', 'stretch', 'walk'], eat: ['food'], check: ['weight', 'water', 'sleep'], learn: ['learn'] }, hidden: [] };

const customise = {
  name: 'Edit Home: hide, move up, add from pick mode, Done',
  async run(t) {
    const page = await t.open({ seed: persona('P02', { patch: { settings: { home: LAID } } }), route: '/home' });
    const main = page.getByRole('main');
    await t.step(1, 'Edit Home → Sleep “Hide”', async () => {
      await ui.tap(ui.row(main, 'Edit Home'));
      await page.getByRole('heading', { level: 2, name: 'Edit Home', exact: true }).waitFor();
      await ui.tap(ui.button(main, 'Hide, Sleep'));
      await main.locator('section[data-flip="hidden"]').getByRole('button', { name: 'Show, Sleep', exact: true }).waitFor();
      await t.check(await page.getByText('Sleep hidden from Home', { exact: true }).count() === 1, 'Hide offers no “Sleep hidden from Home” with Undo');
      await t.checkpoint('edit-home-sleep-hidden');
    });
    await t.step(2, 'Water “Move up”', async () => {
      await ui.tap(ui.button(main, 'Move up, Water'));
      await data.waitDb(t, s => json(docs(s).settings?.home?.order?.check) === '["water","weight"]', 'Check never became Water, Weight');
      await t.checkpoint('edit-home-water-up');
    });
    await t.step(3, '“+ Add” → pick mode → Labs “Add” → Done', async () => {
      await ui.tap(ui.button(main, 'Add a tile to Home'));
      const sheet = ui.sheet(page, 'Add to Home');
      await sheet.waitFor();
      await t.check(await ui.button(sheet, 'Added, Workout').count() === 1, 'pick mode does not mark Workout as on Home');
      await t.check(await sheet.getByText('Exercise library', { exact: true }).count() === 0, 'pick mode lists a shortcut (B-14)');
      await ui.tap(ui.button(sheet, 'Add, Labs'));
      await ui.button(sheet, 'Added, Labs').waitFor();
      await t.checkpoint('pick-labs-added');
      await ui.tap(ui.button(sheet, 'Done'));
      await sheet.waitFor({ state: 'hidden' });
    });
    await t.step(4, 'Done: Home shows Water, Weight, Labs, and Sleep is hidden; a reload keeps it', async () => {
      // Edit Home has a Done beside its heading and another at its end: the last is the end's.
      await ui.tap(main.getByRole('button', { name: 'Done', exact: true }).last());
      await page.getByRole('heading', { level: 2, name: 'What would you like to do?', exact: true }).waitFor();
      await t.check(json(await tilesIn(page, 'check')) === '["water","weight","labs"]', `Check shows ${json(await tilesIn(page, 'check'))}`);
      const home = await layoutOf(t);
      await t.check(json(home?.order?.check) === '["water","weight","labs"]' && json(home?.hidden) === '["sleep"]', `stored: ${json(home)}`);
      await t.reload();
      await t.check(json(await tilesIn(page, 'check')) === '["water","weight","labs"]', 'the layout did not survive a reload');
      await t.checkpoint('home-customised');
    });
  },
};

const browseMore = {
  name: 'Browse More adds and removes a tile, from the defaults before Home stored any',
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '/browse' });
    const main = page.getByRole('main');
    await t.step(1, 'Browse → Waist “More” → Add to Home, before Home has stored a layout (Review Focus 1)', async () => {
      await t.must((await layoutOf(t)) === undefined, 'a layout was stored before Home was ever opened');
      await ui.tap(ui.button(main, 'More, Waist'));
      await ui.tap(page.getByRole('menuitem', { name: 'Add to Home', exact: true }));
      const snap = await data.waitDb(t, s => !!docs(s).settings?.home, 'Add to Home stored no layout');
      const order = docs(snap).settings.home.order;
      await t.check(json(order) === json({ move: ['workout', 'stretch', 'walk'], eat: ['food'], check: ['weight', 'sleep', 'waist'], learn: ['learn'] }), `not the defaults plus Waist: ${json(order)}`);
      await t.checkpoint('browse-waist-added');
    });
    await t.step(2, 'Home shows Waist at the end of Check', async () => {
      await ui.tab(page, 'Home');
      await t.check(json(await tilesIn(page, 'check')) === '["weight","sleep","waist"]', `Check shows ${json(await tilesIn(page, 'check'))}`);
    });
    await t.step(3, 'Browse → Waist “More” → Remove from Home: it is hidden, not deleted', async () => {
      await ui.tab(page, 'Browse');
      await ui.tap(ui.button(main, 'More, Waist'));
      await ui.tap(page.getByRole('menuitem', { name: 'Remove from Home', exact: true }));
      const snap = await data.waitDb(t, s => (docs(s).settings?.home?.hidden ?? []).includes('waist'), 'Remove from Home did not hide Waist');
      await t.check(json(docs(snap).settings.home.order.check) === '["weight","sleep"]', `Check after Remove: ${json(docs(snap).settings.home.order.check)}`);
      await ui.tab(page, 'Home');
      await t.check(!(await tilesIn(page, 'check')).includes('waist'), 'Home still shows Waist');
    });
  },
};

const fullGroup = {
  name: 'a full group says so in the menu',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/browse' });
    await t.step(1, 'Browse → Sleep “More”: Check already holds 5', async () => {
      await ui.tap(ui.button(page.getByRole('main'), 'More, Sleep'));
      const item = page.getByRole('menuitem', { name: 'Check is full (5)', exact: true });
      await t.must(await item.count() === 1, 'the menu does not say Check is full');
      await t.check(await item.getAttribute('aria-disabled') === 'true' || await item.getAttribute('data-disabled') !== null, 'the full group’s item can be chosen');
      await t.check(await page.getByText('Hide a tile in Edit Home to make room.', { exact: true }).count() === 1, 'the menu does not say what to do');
      await t.checkpoint('browse-check-full');
      await ui.tap(page.getByRole('menuitem', { name: 'Close', exact: true }));
    });
  },
};

export const cases = [customise, browseMore, fullGroup];
```

- [ ] **Step 8: Check by eye.** Use 430×932 and 320×568, at 200% text, and Reduce Motion both on and off:
  - "+ Add" opens "Add to Home" over Edit Home;
  - its search finds "sugar";
  - Add turns to Added at once;
  - Done closes it, and focus returns to "+ Add";
  - the new tile fades in at the end of its group (M17), at once under Reduce Motion;
  - `#/browse?pick=1`, typed into the address bar, opens Edit Home with the sheet over it, and the address becomes `#/home`.

- [ ] **Step 9: Gates, journeys, commit**

```bash
npx tsc -b && npm run lint && npx vitest run
npm run e2e:acceptance -- --only=V-J12,J02 > /tmp/fit-checks/p4-t5.log 2>&1; tail -n 25 /tmp/fit-checks/p4-t5.log
git add src/screens/home src/screens/browse/BrowseList.tsx scripts/e2e/acceptance/journeys/v12.mjs
git commit -m "feat: Open Browse's pick mode from Edit Home's Add, at its own address too"
```

Expected: 0 failed.

---

### Task 6: The setup-progress seam

**Files:**
- Create: `src/types/setup.ts`
- Modify: `src/types/index.ts` (`ChapterId`, `UserSettings.setup`)
- Create: `src/setup/progress.ts`, `src/setup/progress.test.ts`
- Modify: `src/store/importCheck.ts`, `src/store/importCheck.test.ts`

**Interfaces:**
- Consumes: `reviewNeeded` and `REVIEW_LABEL` from `@/screens/you/summaries`; the store's `update()`.
- Produces:
  - in `src/types/setup.ts`: `CHAPTER_IDS`, the eight chapters in setup's order, and `type ChapterId`, re-exported from `@/types`;
  - `UserSettings.setup?: { declined?: ChapterId[] }`;
  - `interface OpenChapter { chapter: ChapterId; label: string; detail: string; href: string; why: 'gap' | 'skipped' | 'new' }`;
  - `setupProgress(input: { profile: UserProfile | undefined; settings: UserSettings }): OpenChapter[]`, without the chapters answered "Not now";
  - `finishTitle(count: number): string`;
  - `notNow(chapter: ChapterId): Promise<StoreResult>`.
- **For Plan 5.** Its draft uses these names (`src/types/setup.ts`, `setupProgress()`, `notNow()`, `SetupState.declined`):
  - it extends `src/types/setup.ts` with its pages and `SetupState`. Its `declined` is this `setup.declined`, so what Me was told carries over. A record this plan wrote has no `stage` or `skipped`, so Plan 5 reads it as a v1 record plus `declined`;
  - it replaces `setupProgress`'s body (the chapters skipped, and the ones new since this person set up, each opening its own page), keeping the signature and the row's fields;
  - Me's rows (Task 7) don't change.

- [ ] **Step 1: Write the failing tests** `src/setup/progress.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeIndexedDB } from '@/store/fakeIdb';
import { createDefaultProfile } from '@/profile/defaults';
import type { UserSettings } from '@/types';

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
const { finishTitle, notNow, setupProgress } = await import('./progress');

const settings = {} as UserSettings;
/** Every answer given: without diabetes, a medicines review also answers the SGLT2 question. */
const answered = createDefaultProfile({ weightKg: 70, health: { medicinesReviewed: true } });
const rows = (profile: Parameters<typeof setupProgress>[0]['profile'], s = settings) => setupProgress({ profile, settings: s }).map(c => [c.chapter, c.detail, c.why]);

beforeEach(async () => {
  local.clear();
  store.resetForTests();
  await store.start({ factory: fakeIndexedDB() });
});

describe('setupProgress until Plan 5 (journey §6.6, §16)', () => {
  it('has nothing open when the answers are complete', () => {
    expect(setupProgress({ profile: answered, settings })).toEqual([]);
  });
  it('opens Your health for someone with no answers yet', () => {
    expect(setupProgress({ profile: undefined, settings })).toEqual([
      { chapter: 'health', label: 'Your health', detail: 'Answer the health questions before you move', href: '/me/profile', why: 'gap' },
    ]);
  });
  it('opens Your health for answers carried over from v1 and not yet reviewed', () => {
    expect(rows({ ...answered, needsHealthReview: true })).toEqual([['health', 'Your health answers need a review', 'gap']]);
  });
  it('opens Your medicines when diabetes medicines were never answered: movement waits on it', () => {
    expect(rows(createDefaultProfile({ weightKg: 70, health: { diabetes: 'type2', medicinesReviewed: false } }))).toEqual([['medicines', 'Medicines: not yet reviewed', 'gap']]);
  });
  it('opens Your medicines for the SGLT2 question nobody answered, as skipped: nothing is held on it', () => {
    expect(rows(createDefaultProfile({ weightKg: 70 }))).toEqual([['medicines', 'One medicine question to answer', 'skipped']]);
  });
  it('leaves out a chapter answered “Not now”', () => {
    expect(rows(undefined, { setup: { declined: ['health'] } } as UserSettings)).toEqual([]);
  });
  it('counts the chapters in the group’s title (journey §6.6)', () => {
    expect(finishTitle(1)).toBe('Finish setting up · 1 short chapter');
    expect(finishTitle(2)).toBe('Finish setting up · 2 short chapters');
  });
});

describe('notNow (journey §6.6)', () => {
  it('keeps each chapter once, and a setting written at the same moment survives', async () => {
    await Promise.all([notNow('health'), store.setSettings({ theme: 'dark' }), notNow('health'), notNow('food')]);
    expect((await store.reload()).ok).toBe(true);
    const s = store.getState().settings;
    expect(s.setup?.declined).toEqual(['health', 'food']);
    expect(s.theme).toBe('dark');
  });
});
```

In `src/store/importCheck.test.ts`, inside the settings `describe`:

```ts
  it('reads what Finish setting up was told, chapter by chapter', () => {
    expect(preview(file({ settings: { ...settings, setup: { declined: ['health', 'food'] } } })).unreadableFields).toEqual([]);
    expect(preview(file({ settings: { ...settings, setup: { declined: ['everything'] } } })).unreadableFields).toEqual(['settings.setup.declined']);
  });
```

- [ ] **Step 2: Run them to check they fail**

Run: `npx vitest run src/setup src/store/importCheck.test.ts`
Expected: FAIL. `./progress` doesn't exist, and `setup` isn't read.

- [ ] **Step 3: The types.** Create `src/types/setup.ts`:

```ts
/** The eight setup chapters, in order (journey §6.2). Plan 5 adds the pages and the setup state here. */
export const CHAPTER_IDS = ['welcome', 'about', 'health', 'medicines', 'backFeet', 'movement', 'food', 'day'] as const;
export type ChapterId = (typeof CHAPTER_IDS)[number];
```

In `src/types/index.ts`:
  - add `import type { ChapterId } from './setup';` beside its other type imports, and `export type { ChapterId } from './setup';` at the end;
  - inside `UserSettings`, after `homeOffered`:

    ```ts
      /**
       * v2 (journey §6.6, §16): the chapters Me's "Finish setting up" was told
       * "Not now". Plan 5 makes this its whole setup state, which keeps
       * `declined` (§18.1).
       */
      setup?: { declined?: ChapterId[] };
    ```

- [ ] **Step 4: The seam** `src/setup/progress.ts`

```ts
/**
 * Setup's progress, as Me's "Finish setting up" reads it (journey §6.6, §16).
 *
 * The seam Plan 5 fills. It builds the eight chapters, and makes
 * `setupProgress` read `settings.setup`: the chapters skipped, and the ones
 * new since this person set up, each opening its own page. It keeps the
 * signature and the row's fields. Until then the only open chapters are the
 * gaps v1 already knows, and each opens the v1 screen that holds its answers.
 */
import { REVIEW_LABEL, reviewNeeded } from '@/screens/you/summaries';
import type { StoreResult } from '@/store/db';
import { update } from '@/store/useStore';
import type { ChapterId, UserSettings } from '@/types';
import type { UserProfile } from '@/types/profile';

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

const TITLE: Record<ChapterId, string> = {
  welcome: 'Welcome', about: 'About you', health: 'Your health', medicines: 'Your medicines',
  backFeet: 'Your back and feet', movement: 'Your movement', food: 'Your food', day: 'Your day and coach',
};

/** Where each chapter's answers are kept until Plan 5 gives the chapters their pages. */
const HREF: Record<ChapterId, string> = {
  welcome: '/me/display', about: '/me/profile', health: '/me/profile', medicines: '/me/profile',
  backFeet: '/me/profile', movement: '/me/profile?chapter=movement', food: '/me/food', day: '/me/reminders',
};

const open = (chapter: ChapterId, why: OpenChapter['why'], detail: string): OpenChapter => ({ chapter, label: TITLE[chapter], detail, href: HREF[chapter], why });

/** The chapters left to answer, without those answered "Not now". */
export function setupProgress({ profile, settings }: { profile: UserProfile | undefined; settings: UserSettings }): OpenChapter[] {
  const review = reviewNeeded(profile);
  const found = !profile ? [open('health', 'gap', 'Answer the health questions before you move')]
    : review === 'health' ? [open('health', 'gap', REVIEW_LABEL.health)]
    // Without diabetes nothing is held on it (`sglt2Unknown`, engine/health.ts): asked, not required.
    : review === 'sglt2' ? [open('medicines', 'skipped', REVIEW_LABEL.sglt2)]
    : review ? [open('medicines', 'gap', REVIEW_LABEL[review])]
    : [];
  const declined = settings.setup?.declined ?? [];
  return found.filter(c => !declined.includes(c.chapter));
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

- [ ] **Step 5: The reader.** In `src/store/importCheck.ts`, import `{ CHAPTER_IDS } from '@/types/setup'`, and in `SETTINGS_SPEC`, after `homeOffered`, add:

```ts
  // Field by field, so Plan 5's own fields in `setup` are kept as they are.
  setup: { declined: listOf(oneOf(...CHAPTER_IDS)) },
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/setup src/store/importCheck.test.ts`
Expected: PASS.

- [ ] **Step 7: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/types/setup.ts src/types/index.ts src/setup src/store/importCheck.ts src/store/importCheck.test.ts
git commit -m "feat: Add the setup-progress seam that Me's Finish setting up reads"
```

---

### Task 7: Me's root and its sections

**Files:**
- Create: `src/screens/you/MeHome.tsx` (`git mv src/screens/you/YouHome.tsx src/screens/you/MeHome.tsx`, then rewrite)
- Delete: `src/screens/you/leave.ts`, `src/screens/you/leave.test.ts`
- Modify: `src/screens/you/routes.tsx`
- Modify: `src/screens/home/homeLayout.ts`, `homeLayout.test.ts` (`answerOffer`)
- Modify: `src/screens/you/summaries.ts`, `summaries.test.ts` (`privacyLine`)
- Modify: `src/screens/you/{ProfileScreen,FocusScreen,VoiceScreen,AppearanceScreen,FoodScreen,HabitsScreen,DataScreen}.tsx` (titles, Back to Me, the Food shell)
- Modify: `src/components/hig/StorageBanner.tsx`, `src/screens/welcome/KeepStep.tsx`, `src/screens/welcome/FocusStep.tsx`, `src/components/profile/ProfileWizard.tsx` (paths and copy that still say You)
- Modify: `scripts/e2e/acceptance/lib/data.mjs`, `lib/guide.mjs`, `journeys/j20.mjs`
- Create: `scripts/e2e/acceptance/journeys/m01.mjs`
- Modify: `scripts/e2e/acceptance/journeys/v12.mjs` (the offer case)

**Interfaces:**
- Consumes:
  - `useHomeLayout`, `layoutNow` (Task 4);
  - `newlyRelevant` (Task 2);
  - `setupProgress`, `finishTitle`, `notNow` and `OpenChapter` (Task 6);
  - `EditButton` (Task 5);
  - `TileIcon` and `addButton`, `addTile`.
- Produces:
  - `MeHome` at `/me`;
  - `answerOffer(fallback: HomeLayout, id: CategoryId, add: boolean): Promise<StoreResult> | undefined`;
  - `privacyLine(device: string): string`;
  - Me's rows and screen titles, which later tasks and journeys rely on: "Profile & health", "What you’d like more of", "Food", "Reminders", "Voice & demos", "Display", "Data", "Sources and licences".
  - Me's row for v1's focus choice keeps v1's name, "What you’d like more of", the title of the screen it opens. It isn't "Your movement": that is the movement chapter's title, which Plan 5's Finish setting up lists, and two links with one name on one screen would be ambiguous. Plan 5 takes the row away when Profile & health gets its chapters.

- [ ] **Step 1: Write the failing tests.** In `src/screens/home/homeLayout.test.ts`:
  - import `answerOffer` too, beside `changeHome` and `layoutNow`;
  - append:

```ts
/** P01's Check, full: Glucose, BP, Back & leg, Labs, then Weight as the fill-in. */
const FULL: HomeLayout = { order: { move: ['workout', 'stretch', 'walk'], eat: ['food'], check: ['glucose', 'bp', 'back', 'labs', 'weight'], learn: [] }, hidden: [] };

describe('answerOffer: offered once, never added silently (journey §5.1)', () => {
  it('“Not now” records the offer and leaves Home alone', async () => {
    await store.setSettings({ home: DEFAULTS });
    expect((await answerOffer(DEFAULTS, 'water', false)!).ok).toBe(true);
    expect(store.getState().settings.homeOffered).toEqual(['water']);
    expect(store.getState().settings.home).toEqual(DEFAULTS);
  });
  it('“Add” puts the tile at the end of its group, and records the offer in the same write', async () => {
    await store.setSettings({ home: DEFAULTS });
    expect((await answerOffer(DEFAULTS, 'water', true)!).ok).toBe(true);
    expect(store.getState().settings.home?.order.check).toEqual(['weight', 'sleep', 'water']);
    expect(store.getState().settings.homeOffered).toEqual(['water']);
  });
  it('writes nothing when the group filled meanwhile, so the offer stays to answer', async () => {
    await store.setSettings({ home: FULL });
    expect(answerOffer(FULL, 'water', true)).toBeUndefined();
    expect(store.getState().settings.homeOffered).toBeUndefined();
  });
});
```

In `src/screens/you/summaries.test.ts`, import `privacyLine` and append:

```ts
describe('privacyLine (B-24)', () => {
  it('says where the records are, and when anything leaves', () => {
    expect(privacyLine('iPhone')).toBe('Your records are stored on this iPhone. Backups and calendar files leave only when you share them.');
  });
});
```

- [ ] **Step 2: Run them to check they fail**

Run: `npx vitest run src/screens/home/homeLayout.test.ts src/screens/you/summaries.test.ts`
Expected: FAIL. `answerOffer` and `privacyLine` don't exist.

- [ ] **Step 3: The offer's write and the privacy line.**
  - In `src/screens/home/homeLayout.ts`:
    - import `addButton` and `addTile` from `./layout`;
    - change the registry import to `import { categoryById, defaultHome, relevantCategories, type CategoryId } from '@/categories';`;
    - append:

```ts
/**
 * "Add Glucose to Home?" answered (journey §5.1). Either answer means it is
 * never offered again; Add also puts the tile at the end of its group, in
 * the same write. When that group has filled meanwhile, nothing is written
 * and `undefined` comes back, so the offer stays to answer.
 */
export function answerOffer(fallback: HomeLayout, id: CategoryId, add: boolean): Promise<StoreResult> | undefined {
  const offered = getState().settings.homeOffered ?? [];
  const homeOffered = offered.includes(id) ? [...offered] : [...offered, id];
  if (!add) return setSettings({ homeOffered });
  const before = layoutNow(fallback);
  if (before.order[categoryById(id).group].includes(id)) return setSettings({ homeOffered });
  if (addButton(before, id).disabled) return undefined;
  return setSettings({ home: addTile(before, id), homeOffered });
}
```

  - In `src/screens/you/summaries.ts`:

```ts
/** B-24's privacy sentence, for this device. Plan 6 adds the one about map pictures when they arrive. */
export function privacyLine(device: string): string {
  return `Your records are stored on this ${device}. Backups and calendar files leave only when you share them.`;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/screens/home/homeLayout.test.ts src/screens/you/summaries.test.ts`
Expected: PASS.

- [ ] **Step 5: Me's root.** First:

```bash
git mv src/screens/you/YouHome.tsx src/screens/you/MeHome.tsx
git rm src/screens/you/leave.ts src/screens/you/leave.test.ts
```

Then replace `MeHome.tsx` with:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { BellIcon, ChevronRightIcon, CompassIcon, HardDriveIcon, HeartPulseIcon, MicIcon, SaladIcon, SunMoonIcon } from 'lucide-react';
import { categoryById, newlyRelevant, type CategoryId } from '@/categories';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { backupMark, backupNudge, recordSpan } from '@/reminders/backup';
import { NOT_ADVICE } from '@/reminders/copy';
import { EditButton } from '@/screens/home/EditButton';
import { answerOffer, useHomeLayout } from '@/screens/home/homeLayout';
import { addButton } from '@/screens/home/layout';
import { TileIcon } from '@/screens/home/Tile';
import { deviceNoun, readInstallEnv } from '@/screens/welcome/install';
import { FOCUS_CHOICES } from '@/screens/welcome/focus';
import { finishTitle, notNow, setupProgress, type OpenChapter } from '@/setup/progress';
import { useStore } from '@/store/useStore';
import type { HomeLayout } from '@/types';
import { packName } from '@/voice/packs';
import { buildId } from './about';
import { shortDate } from './dates';
import { REVIEW_LABEL, conditionsLine, foodLine, habitsLine, privacyLine, reviewNeeded } from './summaries';

const THEME = { system: 'Automatic', light: 'Light', dark: 'Dark' } as const;

/** Focus goes to the screen's title when the row it was on has gone (B-03). */
const focusTitle = () => requestAnimationFrame(() => document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true }));

/**
 * Me (journey §16): what is left to answer, a category the answers now make
 * useful, then the person's own settings by section, then About. Everything
 * here is about them and stays on this device. Me is a tab, so it has no
 * Done (D63).
 */
export function MeHome() {
  const state = useStore();
  const { settings, profile } = state;
  // Read once per visit: none of these change while the list is open.
  const [{ now, device, build }] = useState(() => ({
    now: new Date(),
    device: deviceNoun(readInstallEnv()),
    build: buildId([...document.scripts].map(s => s.src)),
  }));
  const { stored, fallback, relevant } = useHomeLayout();
  const finish = setupProgress({ profile, settings });
  // Only once Home has laid its tiles out: until then its defaults include every relevant one.
  const offers = stored ? newlyRelevant({ relevant, layout: stored, offered: settings.homeOffered ?? [] }) : [];
  const review = reviewNeeded(profile);
  const nudge = backupNudge(now, backupMark(settings.habits), recordSpan(state), state.revision);
  const lastBackup = settings.habits?.lastExportAt;
  const focus = FOCUS_CHOICES.find(f => f.value === settings.focus);
  const voice = profile?.voice;

  return (
    <Screen title="Me">
      {finish.length > 0 && (
        <Group header={finishTitle(finish.length)} footer="Not now keeps a chapter for later, in Profile & health.">
          {finish.map(c => <FinishRow key={c.chapter} chapter={c} />)}
        </Group>
      )}
      {stored && offers.length > 0 && (
        <Group header="New for Home" footer="Your answers make these useful now. Each is offered once.">
          {offers.map(id => <OfferRow key={id} id={id} layout={stored} fallback={fallback} />)}
        </Group>
      )}

      <Group>
        <Row
          as={Link}
          to="/me/profile"
          viewTransition
          icon={<HeartPulseIcon />}
          label="Profile & health"
          detail={review ? <span className="text-caution">{REVIEW_LABEL[review]}</span> : conditionsLine(profile)}
          chevron
        />
        {/* v1's focus choice, by its own name, until Plan 5 puts it in Profile & health's movement chapter. */}
        <Row as={Link} to="/me/profile?chapter=movement" viewTransition icon={<CompassIcon />} label="What you’d like more of" detail={focus?.label ?? 'Not chosen'} chevron />
        <Row as={Link} to="/me/food" viewTransition icon={<SaladIcon />} label="Food" detail={foodLine(profile?.food)} chevron />
      </Group>

      <Group>
        <Row as={Link} to="/me/reminders" viewTransition icon={<BellIcon />} label="Reminders" detail={habitsLine(settings.habits, profile)} chevron />
        <Row
          as={Link}
          to="/me/voice"
          viewTransition
          icon={<MicIcon />}
          label="Voice & demos"
          detail={`${packName(voice?.pack ?? 'af_heart').split(' · ')[0]} · ${profile?.figure === 'female' ? 'female' : 'male'} figure`}
          chevron
        />
        <Row as={Link} to="/me/display" viewTransition icon={<SunMoonIcon />} label="Display" detail={THEME[settings.theme]} chevron />
      </Group>

      <Group footer={privacyLine(device)}>
        <Row
          as={Link}
          to="/me/data"
          viewTransition
          icon={<HardDriveIcon />}
          label="Data"
          detail={nudge.due
            ? <span className="text-caution">{lastBackup ? `Time to back up. The last was ${shortDate(lastBackup)}.` : 'Time to make your first backup.'}</span>
            : lastBackup ? `Backed up ${shortDate(lastBackup)}` : `On this ${device} only`}
          chevron
        />
      </Group>

      <Group header="About" footer={`${NOT_ADVICE} The sources behind each health claim are in Learn.`}>
        <Row label="Version" value={build ? `Build ${build}` : 'Development'} numeric />
        <Row as={Link} to="/hub/learn/sources" viewTransition label="Sources and licences" chevron />
      </Group>
    </Screen>
  );
}

/** One chapter to finish: it opens where its answers are kept, with "Not now" beside it (journey §6.6, D65). */
function FinishRow({ chapter }: { chapter: OpenChapter }) {
  const [problem, setProblem] = useState<string>();
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 pr-3">
        <Link to={chapter.href} viewTransition className="press-feedback flex min-h-[3.25rem] min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left transition-colors active:bg-muted/60">
          <span className="min-w-0 flex-1">
            <span className="block text-[length:var(--text-body)] leading-snug [overflow-wrap:break-word]">{chapter.label}</span>
            <span className={`block text-[length:var(--text-subhead)] leading-snug [overflow-wrap:break-word] ${chapter.why === 'gap' ? 'text-caution' : 'text-muted-foreground'}`}>{chapter.detail}</span>
          </span>
          <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        </Link>
        <EditButton
          control="later"
          label="Not now"
          name={chapter.label}
          onClick={() => void notNow(chapter.chapter).then(saved => {
            if (!saved.ok) setProblem(`That did not save. ${saved.failure.message}`);
            else focusTitle();
          })}
        />
      </div>
      {problem && <p role="alert" className="px-4 pb-2 text-[length:var(--text-subhead)] leading-snug text-stop">{problem}</p>}
    </div>
  );
}

/** "Add Glucose to Home?", once (journey §5.1). A full group says so on Add, and Not now still answers it. */
function OfferRow({ id, layout, fallback }: { id: CategoryId; layout: HomeLayout; fallback: HomeLayout }) {
  const category = categoryById(id);
  const button = addButton(layout, id);
  const [problem, setProblem] = useState<string>();
  const answer = async (add: boolean) => {
    const saved = answerOffer(fallback, id, add);
    if (!saved) {
      setProblem(`${category.title} couldn’t go on Home: its group is full. Hide a tile in Edit Home, or choose Not now.`);
      return;
    }
    const result = await saved;
    if (!result.ok) {
      setProblem(`That did not save. ${result.failure.message}`);
      return;
    }
    if (add) toast(`${category.title} added to Home`);
    focusTitle();
  };
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-3">
        <TileIcon category={category} />
        <p className="min-w-0 flex-1 text-[length:var(--text-body)] leading-snug [overflow-wrap:break-word]">Add {category.title} to Home?</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <EditButton control="pick" disabled={button.disabled} label={button.disabled ? button.label : 'Add'} name={category.title} onClick={() => void answer(true)} />
        <EditButton control="later" label="Not now" name={category.title} onClick={() => void answer(false)} />
      </div>
      {problem && <p role="alert" className="text-[length:var(--text-subhead)] leading-snug text-stop">{problem}</p>}
    </div>
  );
}
```

- [ ] **Step 6: Me's routes.** Replace `src/screens/you/routes.tsx` with:

```tsx
import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { AppearanceScreen } from './AppearanceScreen';
import { DataScreen } from './DataScreen';
import { FocusScreen } from './FocusScreen';
import { FoodScreen } from './FoodScreen';
import { HabitsScreen } from './HabitsScreen';
import { MeHome } from './MeHome';
import { ProfileScreen } from './ProfileScreen';
import { VoiceScreen } from './VoiceScreen';

/**
 * `/me/profile`, Profile & health: the seam Plan 5 replaces with the setup
 * chapters' own pages (journey §16). Until then v1's screens hold the
 * answers. The movement chapter (`?chapter=movement`, §19.2) is v1's "What
 * you'd like more of"; every other chapter is v1's Profile & health
 * (`HREF` in `src/setup/progress.ts`).
 */
function Profile() {
  const [params] = useSearchParams();
  return params.get('chapter') === 'movement' ? <FocusScreen /> : <ProfileScreen />;
}

/** Me, the fourth tab (journey §16): its root and its sections. */
export default function YouRoutes() {
  return (
    <Routes>
      <Route index element={<MeHome />} />
      <Route path="profile" element={<Profile />} />
      <Route path="food" element={<FoodScreen />} />
      <Route path="reminders" element={<HabitsScreen />} />
      <Route path="voice" element={<VoiceScreen />} />
      <Route path="display" element={<AppearanceScreen />} />
      <Route path="data" element={<DataScreen />} />
      <Route path="*" element={<Navigate to="/me" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 7: The sections, in Me's words.** Each section's Back goes to Me: change `back={{ to: '/you', label: 'You' }}` to `back={{ to: '/me', label: 'Me' }}` in `ProfileScreen`, `FocusScreen`, `VoiceScreen`, `AppearanceScreen`, `FoodScreen`, `HabitsScreen` and `DataScreen`. Then make these changes:

  | File | Change |
  | --- | --- |
  | `AppearanceScreen.tsx` | `title="Display"`. Task 9 replaces the whole screen |
  | `FoodScreen.tsx` | `title="Food"`. The "What you eat" footer, "Meal ideas in Guide use this. The app only knows what you tell it.", becomes "Meal ideas use this. The app only knows what you tell it." The new group below goes after the region group |
  | `HabitsScreen.tsx` | `title="Reminders"`. "You can change it on Today." becomes "You can change it on Home." |
  | `DataScreen.tsx` | `title="Data"` |
  | `FocusScreen.tsx` | Its footer's "Today suggests something to match." becomes "Home suggests something to match." |
  | `src/components/hig/StorageBanner.tsx` | The sheet's row becomes `<Row as={Link} to="/me/data" viewTransition label="Data" … />`, its detail unchanged |
  | `src/screens/welcome/KeepStep.tsx` | "It is in You, under Data & offline." becomes "It is in Me, under Data." |
  | `src/screens/welcome/FocusStep.tsx` | "You can change it in You at any time." becomes "You can change it in Me at any time." |
  | `src/components/profile/ProfileWizard.tsx` | "You can update your clearance in You, under Profile & health, once you have it." becomes "You can update your clearance in Me, under Profile & health, once you have it." |

  The links elsewhere that still name a `/you/…` address (the walk screens, the workout screen, the Guide's reminders link) go through the redirects to Me and stay as they are. No journey reads any of these strings.

  The group for `FoodScreen.tsx`:

  ```tsx
        {/* Plan 7 fills this: the logging level and a care-team target (journey §16 Food). */}
        <Group header="Logging what you eat">
          <Row label="Logging meals" detail="Not in this version yet. Meal ideas work with the choices above." />
        </Group>
  ```

- [ ] **Step 8: The acceptance helpers follow the names.**
  - `scripts/e2e/acceptance/lib/data.mjs`, `openData`:
    - change the row to `ui.row(page.getByRole('main'), 'Data', 'link')`;
    - change both headings from `'Data & offline'` to `'Data'`;
    - make the doc comment "Me → Data, the way a person gets there".
  - `scripts/e2e/acceptance/lib/guide.mjs`, `openHabits`:
    - change the row to `'Reminders'` and the heading to `'Reminders'`;
    - make the doc comment "Me → Reminders, from anywhere".
  - `scripts/e2e/acceptance/journeys/j20.mjs`:
    - replace `YOU_EDITORS` with:

    ```js
    /** Me's sections (journey §16), each opened from Me and Back to it. "What you’d like more of" stays until Plan 5. */
    const YOU_EDITORS = [
      ['Profile & health', /^Profile & health$/],
      ['What you’d like more of', /^What you’d like more of$/],
      ['Food', /^Food$/],
      ['Reminders', /^Reminders$/],
      ['Voice & demos', /^Voice & demos$/],
      ['Display', /^Display$/],
      ['Data', /^Data$/],
    ];
    ```

    - in the offline case, `ui.row(main, 'Data & offline', 'link')` becomes `ui.row(main, 'Data', 'link')`, and its failure message says "Data does not say…";
    - in step 2, Me is a tab now, so replace the four lines that tap Me's Done and check it returned:

    ```js
    // Me is a tab (journey §5, D63): Home's tab goes back to the place it was left, My Day on 25 September.
    await ui.tap(ui.link(page.getByRole('navigation', { name: 'Main' }), 'Home'));
    await waitRoute(page, trackRoute);
    await ui.heading(page, 'My Day');
    await t.check(await t.route() === trackRoute, `Home’s tab from Me returned to ${await t.route()}, not ${trackRoute}`);
    ```

    - make the step's title `'Each root, Me and its sections, back to Home’s place; details from My Day and Move and Back'`.

- [ ] **Step 9: Write M01, with its first case** `scripts/e2e/acceptance/journeys/m01.mjs`

```js
/**
 * M01: Me's own journeys (journey §16; Plan 4): Finish setting up, Goals,
 * Display, and Data's two confirmations. Browse, Home's tiles, calendar
 * copies and backups have their V-J journeys.
 */
import { docs } from '../lib/harness.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'M01';
export const title = 'Me: Finish setting up, Goals, Display and Data';
export const safety = false;

const flat = s => s.replace(/[  ]/g, ' ').replace(/\s+/g, ' ');

const finishSettingUp = {
  name: 'finish setting up, and Not now',
  async run(t) {
    const page = await t.open({ seed: persona('P02', { patch: { profile: { needsHealthReview: true } } }), route: '/me' });
    const main = page.getByRole('main');
    await t.step(1, 'Me starts with the chapter to finish, which opens where its answers are', async () => {
      const group = ui.section(main, 'Finish setting up · 1 short chapter');
      await t.must(await group.count() === 1, `Me has no “Finish setting up”: ${flat(await main.innerText()).slice(0, 300)}`);
      const row = ui.row(group, 'Your health', 'link');
      await t.check(/Your health answers need a review/.test(flat(await row.innerText())), 'the row does not say why');
      await t.checkpoint('me-finish');
      await ui.tap(row);
      await ui.heading(page, 'Profile & health');
      await t.check(await main.getByRole('button', { name: /^Your health answers need a review/ }).count() === 1, 'Profile & health offers no review');
      await ui.tap(ui.back(page, 'Me'));
      await ui.heading(page, 'Me');
    });
    await t.step(2, 'Not now: the row goes, and stays gone', async () => {
      await ui.tap(ui.button(main, 'Not now, Your health'));
      await page.waitForTimeout(300);
      await t.check(await ui.section(main, 'Finish setting up · 1 short chapter').count() === 0, 'the row stays after Not now');
      await t.reload();
      await t.check(await main.getByRole('heading', { name: /^Finish setting up/ }).count() === 0, 'the row came back after a reload');
      await t.check(JSON.stringify(docs(await t.db()).settings?.setup?.declined) === '["health"]', 'Not now was not stored');
    });
  },
};

export const cases = [finishSettingUp];
```

`data` is imported for the later cases (Tasks 8 and 11).

- [ ] **Step 10: V-J12's offer case.** Add this to `scripts/e2e/acceptance/journeys/v12.mjs`, import `* as g from '../lib/guide.mjs'`, and add `offered` to `cases`:

```js
const offered = {
  name: 'a newly relevant category is offered in Me once',
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '/home' });
    const main = page.getByRole('main');
    await t.step(1, 'Home lays its tiles out; Me offers nothing', async () => {
      await data.waitDb(t, s => !!docs(s).settings?.home, 'Home never stored its layout');
      await ui.tab(page, 'Me');
      await t.check(await ui.section(main, 'New for Home').count() === 0, 'Me offers a tile before anything changed');
    });
    await t.step(2, 'Reminders → Water → no fluid limit → Turn on', async () => {
      await g.openHabits(t);
      await ui.tap(main.getByRole('switch', { name: 'Water', exact: true }));
      const ws = page.getByRole('dialog', { name: 'Water' });
      await ws.waitFor();
      await ui.tap(ui.row(ws.getByRole('radiogroup', { name: 'Has your care team told you to limit how much you drink?' }), 'No, there is no limit', 'radio'));
      await ui.tap(ui.button(ws, 'Turn on'));
      await ws.waitFor({ state: 'hidden' });
    }, { input: 'water reminders on, no fluid limit' });
    await t.step(3, 'Me: “Add Water to Home?” → Add', async () => {
      await ui.tap(ui.back(page, 'Me'));
      await ui.heading(page, 'Me');
      const offer = ui.section(main, 'New for Home');
      await t.must(await offer.getByText('Add Water to Home?', { exact: true }).count() === 1, `Me does not offer Water: ${(await main.innerText()).slice(0, 300)}`);
      await t.checkpoint('me-offer-water');
      await ui.tap(ui.button(offer, 'Add, Water'));
      await page.getByText('Water added to Home', { exact: true }).waitFor();
      await t.check(await ui.section(main, 'New for Home').count() === 0, 'the offer stays after Add');
      const s = docs(await t.db()).settings;
      await t.check(s.home.order.check.includes('water') && json(s.homeOffered) === '["water"]', `after Add: Check ${json(s.home.order.check)}, offered ${json(s.homeOffered)}`);
    });
    await t.step(4, 'Home shows Water; hidden again, it is not offered again', async () => {
      await ui.tab(page, 'Home');
      await t.check((await tilesIn(page, 'check')).includes('water'), 'Home has no Water tile');
      await ui.tap(ui.row(main, 'Edit Home'));
      await ui.tap(ui.button(main, 'Hide, Water'));
      await ui.tap(main.getByRole('button', { name: 'Done', exact: true }).last());
      await ui.tab(page, 'Me');
      await t.check(await ui.section(main, 'New for Home').count() === 0, 'Water is offered again after it was hidden');
    });
  },
};
```

- [ ] **Step 11: Check by eye.** Use 430×932 and 320×568, light and dark, at 200% text:
  - Me reads top to bottom;
  - no group has more than 5 rows;
  - each row's Back says "Me";
  - "Not now" and "Add" are 48 px;
  - the toast "Water added to Home" fades after about 4 s.

- [ ] **Step 12: Gates, journeys, commit**

```bash
npx tsc -b && npm run lint && npx vitest run
npm run e2e:acceptance -- --only=M01,V-J12,J01,J03,J05,J07,J12,J14,J18,J19,J20 --projects=large-light,small-dark > /tmp/fit-checks/p4-t7.log 2>&1; tail -n 30 /tmp/fit-checks/p4-t7.log
git add src/screens/you src/screens/home/homeLayout.ts src/screens/home/homeLayout.test.ts src/components/hig/StorageBanner.tsx src/screens/welcome/KeepStep.tsx src/screens/welcome/FocusStep.tsx src/components/profile/ProfileWizard.tsx scripts/e2e/acceptance
git commit -m "feat: Rebuild Me as v2's tab, with Finish setting up and a newly relevant tile offered once"
```

Expected: 0 failed.

---

### Task 8: Goals

**Files:**
- Modify: `src/screens/track/weeklyGoal.ts` (export the validated history; the file is Plan 2's)
- Modify: `src/screens/track/stepsGoal.ts` (export `stepsGoalChanges`)
- Create: `src/screens/you/goals.ts`, `src/screens/you/goals.test.ts`
- Create: `src/screens/you/ProgrammeGroup.tsx` (moved out of `FocusScreen.tsx`)
- Modify: `src/screens/you/FocusScreen.tsx`
- Modify: `src/components/hig/shell.node.test.ts` (the Leave sheet's new file)
- Create: `src/screens/you/GoalsScreen.tsx`
- Modify: `src/screens/you/routes.tsx`, `MeHome.tsx` (the Goals row)
- Modify: `scripts/e2e/acceptance/journeys/j20.mjs`, `journeys/s01.mjs`, `run.mjs`, `journeys/m01.mjs`

**Interfaces:**
- Consumes:
  - Plan 2's `weeklyGoalOn(settings, day)` and `pendingWeeklyGoal(settings, day): { from: string; goal?: number } | undefined`;
  - Plan 2's `settings.weeklyMovementGoalHistory: { from: string; goal?: number }[]`, where `from: ''` is v1's undated goal;
  - `settings.weeklyMovementGoalMinutes`, the goal last chosen;
  - `currentStepsGoal`, `GoalSheet` and `StepsGoalSheet`;
  - `planOffer` and `MovePlanBack` (as Home uses them);
  - `today` from `@/screens/track/periods`.
- Produces:
  - `weeklyGoalChanges(settings): { from: string; goal?: number }[]`, exported from Plan 2's module;
  - `stepsGoalChanges(settings): { from: string; goal?: number }[]`;
  - `goalsLine(settings, day): string`;
  - `pendingLine(pending: { from: string; goal?: number }, thisWeek: number | undefined): string`;
  - `interface HistoryLine { key: string; what: string; when: string }`;
  - `weeklyGoalLines(settings): HistoryLine[]` and `stepsGoalLines(settings): HistoryLine[]`;
  - `ProgrammeGroup()` and `GoalsScreen` at `/me/goals`.

- [ ] **Step 1: Export each goal's history.**
  - In `src/screens/track/weeklyGoal.ts` (Plan 2's), rename the private `historyOf` to `weeklyGoalChanges`, export it, and update its callers in the file. Its comment stays.
  - In `src/screens/track/stepsGoal.ts`, do the same: `historyOf` becomes the exported `stepsGoalChanges`.

  If Plan 2 named the weekly reader differently, export whatever already reads the validated history, under the name `weeklyGoalChanges`.

Run: `npx vitest run src/screens/track`
Expected: PASS, unchanged.

- [ ] **Step 2: Write the failing test** `src/screens/you/goals.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { UserSettings } from '@/types';
import { shortDay } from './dates';
import { goalsLine, pendingLine, stepsGoalLines, weeklyGoalLines } from './goals';

const THU = '2026-10-08';
const s = (over: Partial<UserSettings>) => over as UserSettings;

describe('Goals’ lines (journey §16)', () => {
  it('names the goals in force today, or that there are none', () => {
    expect(goalsLine(s({}), THU)).toBe('No goals yet');
    expect(goalsLine(s({ weeklyMovementGoalMinutes: 150, dailyStepsGoal: 6000 }), THU)).toBe('150 min a week · 6,000 steps a day');
    expect(goalsLine(s({ dailyStepsGoal: 6000 }), THU)).toBe('6,000 steps a day');
  });
  it('says when a change waits for Monday, and what this week keeps (B-16)', () => {
    expect(pendingLine({ from: '2026-10-12', goal: 120 }, 150)).toBe('From Monday 12 October: 120 min a week. This week keeps 150 min.');
    expect(pendingLine({ from: '2026-10-12' }, 150)).toBe('From Monday 12 October: no weekly goal. This week keeps 150 min.');
  });
  it('lists the weekly goal’s history newest first, v1’s undated goal last (Review Focus 3)', () => {
    const settings = s({ weeklyMovementGoalMinutes: 120, weeklyMovementGoalHistory: [{ from: '', goal: 150 }, { from: '2026-10-12', goal: 120 }] });
    expect(weeklyGoalLines(settings)).toEqual([
      { key: '2026-10-12', what: '120 min a week', when: `From ${shortDay('2026-10-12')}` },
      { key: 'undated', what: '150 min a week', when: 'Before then' },
    ]);
    const removed = s({ weeklyMovementGoalHistory: [{ from: '2026-10-05', goal: 150 }, { from: '2026-10-12' }] });
    expect(weeklyGoalLines(removed)[0]).toEqual({ key: '2026-10-12', what: 'No weekly goal', when: `From ${shortDay('2026-10-12')}` });
    expect(weeklyGoalLines(s({ weeklyMovementGoalMinutes: 150 }))).toEqual([]);
  });
  it('lists the steps goal’s history newest first, a removal in words (Review Focus 3)', () => {
    expect(stepsGoalLines(s({ dailyStepsGoalHistory: [{ from: '2026-10-12', goal: 6000 }, { from: '2026-10-13' }] }))).toEqual([
      { key: '2026-10-13', what: 'No steps goal', when: `From ${shortDay('2026-10-13')}` },
      { key: '2026-10-12', what: '6,000 steps a day', when: `From ${shortDay('2026-10-12')}` },
    ]);
  });
});
```

- [ ] **Step 3: Run it to check it fails**

Run: `npx vitest run src/screens/you/goals.test.ts`
Expected: FAIL, "Cannot find module './goals'".

- [ ] **Step 4: Write the module** `src/screens/you/goals.ts`

```ts
/**
 * What Me → Goals says (journey §16, §12.5, B-16), as plain lines. A goal's
 * history is newest first, each change from the day it applies. Nothing here
 * decides when a change applies: that is the weekly goal's own module
 * (`@/screens/track/weeklyGoal`) and the steps goal's.
 */
import { format, parseISO } from 'date-fns';
import type { UserSettings } from '@/types';
import { currentStepsGoal, stepsGoalChanges } from '@/screens/track/stepsGoal';
import { formatNumber } from '@/screens/track/units';
import { weeklyGoalChanges, weeklyGoalOn } from '@/screens/track/weeklyGoal';
import { shortDay } from './dates';

const weekly = (minutes?: number) => (minutes === undefined ? 'No weekly goal' : `${minutes} min a week`);
const daily = (steps?: number) => (steps === undefined ? 'No steps goal' : `${formatNumber(steps)} steps a day`);

/** Me's Goals row: the goals in force today, or that there are none. */
export function goalsLine(settings: UserSettings, day: string): string {
  const minutes = weeklyGoalOn(settings, day);
  const steps = currentStepsGoal(settings);
  if (minutes === undefined && steps === undefined) return 'No goals yet';
  return [minutes !== undefined && weekly(minutes), steps !== undefined && daily(steps)].filter(Boolean).join(' · ');
}

/** "From Monday 12 October: 120 min a week. This week keeps 150 min." */
export function pendingLine(pending: { from: string; goal?: number }, thisWeek: number | undefined): string {
  const keeps = thisWeek === undefined ? 'This week has none.' : `This week keeps ${thisWeek} min.`;
  return `From ${format(parseISO(pending.from), 'EEEE d MMMM')}: ${pending.goal === undefined ? 'no weekly goal' : `${pending.goal} min a week`}. ${keeps}`;
}

export interface HistoryLine {
  key: string;
  what: string;
  when: string;
}

/** The weekly goal's changes. v1's goal, which has no date, reads "Before then", after the dated ones. */
export function weeklyGoalLines(settings: UserSettings): HistoryLine[] {
  return [...weeklyGoalChanges(settings)].reverse().map(c => (c.from === ''
    ? { key: 'undated', what: weekly(c.goal), when: 'Before then' }
    : { key: c.from, what: weekly(c.goal), when: `From ${shortDay(c.from)}` }));
}

export function stepsGoalLines(settings: UserSettings): HistoryLine[] {
  return [...stepsGoalChanges(settings)].reverse().map(c => ({ key: c.from, what: daily(c.goal), when: `From ${shortDay(c.from)}` }));
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/screens/you/goals.test.ts`
Expected: PASS.

- [ ] **Step 6: The programme, shared.** Everything `FocusScreen` holds for the programme moves, unchanged except one word, into `src/screens/you/ProgrammeGroup.tsx`:

```tsx
import { useState } from 'react';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { ProfileWizard, type WizardResult } from '@/components/profile/ProfileWizard';
import { createDefaultProfile } from '@/profile/defaults';
import { useStore } from '@/store/useStore';
import { isEnrolled } from '@/health/recommend';
import { todayString } from '@/lib/utils';
import { withFluidAnswer } from '@/reminders/water';
import { startDateProblem } from '@/screens/move/plan';
import { Notice, PlainButton } from './controls';
import { shortDay } from './dates';
import { WizardCover } from './WizardCover';
import { joinProgramme, leaveProgramme } from './write';

/**
 * The 12-week programme: join it, or leave it with a confirmation (journey
 * §16 Goals; board D8, D35). Joining and leaving are their own explicit
 * actions, here and in Move under Your plan, and membership is decided in
 * one place for the whole app (`isEnrolled`). Shown in Goals and in "What
 * you’d like more of".
 */
export function ProgrammeGroup() {
  const { settings, profile } = useStore();
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [joinProblem, setJoinProblem] = useState<string>();
  const [leaveProblem, setLeaveProblem] = useState<string>();
  // Read once per visit: joining can start today or any later day.
  const [today] = useState(todayString);
  const enrolled = isEnrolled(settings, profile);

  const join = async (result: WizardResult) => {
    if (busy) return;
    setBusy(true);
    setJoinProblem(undefined);
    const saved = await joinProgramme(result, result.startDate);
    setBusy(false);
    // A failed save keeps the answers on screen to try again.
    if (!saved.ok) setJoinProblem(`That did not save. ${saved.failure.message}`);
    else setJoining(false);
  };

  const leave = async () => {
    if (busy) return;
    setBusy(true);
    setLeaveProblem(undefined);
    const saved = await leaveProgramme();
    setBusy(false);
    if (!saved.ok) setLeaveProblem(`That did not save. ${saved.failure.message}`);
    else setLeaving(false);
  };

  return (
    <>
      <Group
        header="The 12-week programme"
        footer={enrolled
          ? 'Leaving keeps every session, record and answer. You can join again at any time.'
          : 'A guided hour on the days you choose: mobility, then strength, then an easy finish, fitted around your back and your health. Stretch and Walk work without it.'}
      >
        {enrolled ? (
          <>
            <Row label="You are in the programme" detail={`Week 1 began on ${shortDay(settings.startDate)}.`} />
            <Row
              onClick={() => { setLeaveProblem(undefined); setLeaving(true); }}
              label={<span className="text-stop">Leave the programme</span>}
            />
          </>
        ) : (
          <Row
            onClick={() => { setJoinProblem(undefined); setJoining(true); }}
            label={<span className="text-tint">Join the 12-week programme</span>}
            detail="Your training days, session length, where you train, and a start date."
            chevron
          />
        )}
      </Group>

      <WizardCover open={joining} onClose={() => { if (!busy) setJoining(false); }} label="Join the 12-week programme">
        <ProfileWizard
          // Someone with no answers yet is asked everything the programme
          // needs, health first among it; anyone else only its own questions.
          mode={profile ? 'edit' : 'onboarding'}
          steps={profile ? ['about'] : ['about', 'body', 'health', 'summary']}
          programme
          askStartDate
          startDateRule={date => startDateProblem(date, today)}
          submitLabel="Join the programme"
          busy={busy}
          {...(joinProblem ? { error: joinProblem } : {})}
          initial={{
            profile: withFluidAnswer(profile ?? createDefaultProfile({ weightKg: settings.currentWeight || 0, needsHealthReview: true }), settings.habits),
            useMetric: settings.useMetric,
          }}
          onCancel={() => { if (!busy) setJoining(false); }}
          onComplete={result => void join(result)}
        />
      </WizardCover>

      <Sheet open={leaving} dismissible={!busy} onOpenChange={next => { if (!next && !busy) setLeaving(false); }} title="Leave the programme" detent="large">
        <p className="px-1 text-[length:var(--text-title-2)] font-semibold leading-snug">Leave the 12-week programme?</p>
        <p className="px-1 text-[length:var(--text-body)] leading-snug">
          Every session, record and answer stays. Home stops leading with the programme’s workouts, and stretching and walking carry on as before.
        </p>
        <div className="flex flex-col gap-2">
          {leaveProblem && <Notice tone="error">{leaveProblem}</Notice>}
          <button
            type="button"
            disabled={busy}
            onClick={() => void leave()}
            className="press-feedback min-h-[3.25rem] w-full rounded-xl bg-stop-fill px-4 text-[length:var(--text-body)] font-semibold text-white disabled:opacity-60"
          >
            {busy ? 'Leaving…' : 'Leave the programme'}
          </button>
          <PlainButton disabled={busy} onClick={() => setLeaving(false)}>Stay in it</PlainButton>
        </div>
      </Sheet>
    </>
  );
}
```

  The one word: the Leave sheet's "Today stops leading" is "Home stops leading". No journey reads it.

  `src/screens/you/FocusScreen.tsx` then holds only its focus choice:

```tsx
import { useState } from 'react';
import { Group } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { setSettings, useStore } from '@/store/useStore';
import { FOCUS_CHOICES } from '@/screens/welcome/focus';
import { ChoiceRows, Notice } from './controls';
import { ProgrammeGroup } from './ProgrammeGroup';

/**
 * The first-run answer, changeable. It only sets what Home leads with:
 * choosing Build strength does not join the 12-week programme, and choosing
 * anything else does not leave it (board D8).
 */
export function FocusScreen() {
  const { settings } = useStore();
  const [problem, setProblem] = useState<string>();
  return (
    <Screen title="What you’d like more of" back={{ to: '/me', label: 'Me' }}>
      <Group footer="Home suggests something to match. Choosing here does not join or leave the 12-week programme.">
        <ChoiceRows
          label="What you’d like more of"
          options={FOCUS_CHOICES.map(({ value, label, detail }) => ({ value, label, detail }))}
          value={settings.focus}
          onChange={focus => void setSettings({ focus }).then(saved => setProblem(saved.ok ? undefined : `That did not save. ${saved.failure.message}`))}
        />
      </Group>
      {problem && <Notice tone="error">{problem}</Notice>}
      <ProgrammeGroup />
    </Screen>
  );
}
```

  In `src/components/hig/shell.node.test.ts`, the line that reads `src/screens/you/FocusScreen.tsx` for `<Sheet open={leaving} dismissible={!busy}` now reads `src/screens/you/ProgrammeGroup.tsx`. The pattern stays the same.

- [ ] **Step 7: The screen** `src/screens/you/GoalsScreen.tsx`

```tsx
import { useState } from 'react';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { planOffer } from '@/health/status';
import { useStore } from '@/store/useStore';
import { GoalSheet, StepsGoalSheet } from '@/screens/track/GoalSheet';
import { today as todayOf } from '@/screens/track/periods';
import { currentStepsGoal } from '@/screens/track/stepsGoal';
import { formatNumber } from '@/screens/track/units';
import { pendingWeeklyGoal, weeklyGoalOn } from '@/screens/track/weeklyGoal';
import { MovePlanBack } from '@/screens/today/StatusSheet';
import { pendingLine, stepsGoalLines, weeklyGoalLines } from './goals';
import { ProgrammeGroup } from './ProgrammeGroup';

/**
 * Goals (journey §16): the weekly movement goal and the daily steps goal,
 * each with its history, then the programme, and the plan shift after a
 * break when one is waiting (D25). A weekly change waits for Monday (B-16);
 * a steps change counts from today. Nothing here is ever raised for the
 * person (D27, D31).
 */
export function GoalsScreen() {
  const { settings } = useStore();
  // Read once per visit, like the rest of Me's view of today.
  const [day] = useState(() => todayOf());
  const [open, setOpen] = useState<'weekly' | 'steps'>();
  const weekly = weeklyGoalOn(settings, day);
  const pending = pendingWeeklyGoal(settings, day);
  const steps = currentStepsGoal(settings);
  const weeklyHistory = weeklyGoalLines(settings);
  const stepsHistory = stepsGoalLines(settings);
  const offer = planOffer(settings.statusPeriods, settings.startDate, day);
  const sheet = (which: 'weekly' | 'steps') => (next: boolean) => setOpen(next ? which : undefined);

  return (
    <Screen title="Goals" back={{ to: '/me', label: 'Me' }}>
      <Group
        header="Movement"
        footer={pending ? pendingLine(pending, weekly) : 'A first goal counts from this week. A change starts on the next Monday, so the week under way keeps its goal.'}
      >
        <Row onClick={() => setOpen('weekly')} label="Weekly movement goal" value={weekly === undefined ? 'No goal' : `${weekly} min a week`} chevron />
      </Group>
      <Group header="Steps" footer="A change counts from today. Earlier days keep the goal they had.">
        <Row onClick={() => setOpen('steps')} label="Daily steps goal" value={steps === undefined ? 'No goal' : `${formatNumber(steps)} steps a day`} chevron />
      </Group>
      {weeklyHistory.length > 0 && (
        <Group header="Weekly goal history">
          {weeklyHistory.map(line => <Row key={line.key} label={line.what} detail={line.when} />)}
        </Group>
      )}
      {stepsHistory.length > 0 && (
        <Group header="Steps goal history">
          {stepsHistory.map(line => <Row key={line.key} label={line.what} detail={line.when} />)}
        </Group>
      )}
      <ProgrammeGroup />
      {offer && <MovePlanBack offer={offer} periods={settings.statusPeriods} startDate={settings.startDate} />}
      <GoalSheet open={open === 'weekly'} onOpenChange={sheet('weekly')} goal={settings.weeklyMovementGoalMinutes} />
      <StepsGoalSheet open={open === 'steps'} onOpenChange={sheet('steps')} goal={steps} />
    </Screen>
  );
}
```

- [ ] **Step 8: Me links it.**
  - In `routes.tsx`, add `<Route path="goals" element={<GoalsScreen />} />` after `profile`.
  - In `MeHome.tsx`:
    - add `TargetIcon` to the lucide import;
    - import `goalsLine` from `./goals` and `today as todayOf` from `@/screens/track/periods`;
    - add `const day = todayOf(now);` after the `useState`;
    - insert this row into the first group, between "What you’d like more of" and "Food":

```tsx
        <Row as={Link} to="/me/goals" viewTransition icon={<TargetIcon />} label="Goals" detail={goalsLine(settings, day)} chevron />
```

- [ ] **Step 9: The journeys.**
  - `j20.mjs`: add `['Goals', /^Goals$/],` to `YOU_EDITORS`, after "What you’d like more of".
  - `s01.mjs`: in step 6's list, add `'/me/goals'` after `'/me/profile?chapter=movement'`.
  - `run.mjs`: in `warm()`'s list, add `'/me/goals'` after `'/me/profile'`.
  - `m01.mjs`: add this case, and add `goals` to `cases`:

```js
const goals = {
  name: 'goals: a weekly change waits for Monday; the steps goal keeps its history',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/me' });
    const main = page.getByRole('main');
    const ring = async () => (await page.getByRole('main').getByRole('img', { name: /^Moved this week:/ }).getAttribute('aria-label')) ?? '';
    const setGoal = async (row, field, value) => {
      await ui.tap(ui.row(main, row));
      const sheet = ui.sheet(page, row);
      await ui.type(sheet.getByRole('textbox', { name: field, exact: true }), String(value));
      await ui.tap(ui.button(sheet, 'Save goal'));
      await sheet.waitFor({ state: 'hidden' });
    };
    await t.step(1, 'Me → Goals: a first weekly goal of 150 counts this week', async () => {
      await ui.tap(ui.row(main, 'Goals', 'link'));
      await ui.heading(page, 'Goals');
      await t.check(/Weekly movement goal No goal/.test(flat(await main.innerText())), 'the weekly goal does not start empty');
      await setGoal('Weekly movement goal', 'Minutes each week', 150);
      await t.check(/Weekly movement goal 150 min a week/.test(flat(await main.innerText())), 'Goals does not show 150 min a week');
      await ui.tab(page, 'Home');
      await t.check(/ of 150 minutes$/.test(await ring()), `Home’s ring reads “${await ring()}”`);
    }, { input: 'weekly goal 150 min on Thursday 8 October' });
    await t.step(2, 'Change it to 120 on Thursday: it waits for Monday', async () => {
      await t.goto('/me/goals');
      await setGoal('Weekly movement goal', 'Minutes each week', 120);
      const text = flat(await main.innerText());
      await t.check(/Weekly movement goal 150 min a week/.test(text), 'this week lost its goal');
      await t.check(/From Monday 12 October: 120 min a week\. This week keeps 150 min\./.test(text), `Goals does not say the change waits: ${text.slice(0, 400)}`);
      await t.checkpoint('goals-pending');
    }, { input: 'weekly goal 120 min' });
    await t.step(3, 'Monday 12 October: Home and Goals read 120, and the history lists both', async () => {
      await t.setTime(Date.parse('2026-10-12T09:00:00+05:30'));
      await t.goto('/home');
      await t.check(/ of 120 minutes$/.test(await ring()), `Monday’s ring reads “${await ring()}”`);
      await t.goto('/me/goals');
      const text = flat(await main.innerText());
      await t.check(/Weekly movement goal 120 min a week/.test(text), 'Goals does not show 120 on Monday');
      await t.check(/120 min a week From 12 Oct 2026 150 min a week From 5 Oct 2026/.test(text), `the weekly history: ${text.slice(0, 500)}`);
    });
    await t.step(4, 'Steps: 6,000 on Monday, 7,000 on Tuesday; each day keeps its own', async () => {
      await setGoal('Daily steps goal', 'Steps a day', 6000);
      await t.setTime(Date.parse('2026-10-13T09:00:00+05:30'));
      await t.goto('/me/goals');
      await setGoal('Daily steps goal', 'Steps a day', 7000);
      const text = flat(await main.innerText());
      await t.check(/Daily steps goal 7,000 steps a day/.test(text), 'Goals does not show 7,000');
      await t.check(/7,000 steps a day From 13 Oct 2026 6,000 steps a day From 12 Oct 2026/.test(text), `the steps history: ${text.slice(0, 500)}`);
      await t.checkpoint('goals-history');
    }, { input: 'steps goal 6000 on 12 October, 7000 on 13 October' });
  },
};
```

  Group headers draw in capitals, so the checks above read rows, never headers.

- [ ] **Step 10: Check by eye.** Use 320×568 at 200% text, then 430×932:
  - every row wraps rather than truncating;
  - the footer under Movement says when a change applies;
  - Join and Leave work from Goals, and Leave asks first.

- [ ] **Step 11: Gates, journeys, commit**

```bash
npx tsc -b && npm run lint && npx vitest run
npm run e2e:acceptance -- --only=M01,J05,J07,J20,S01 --projects=large-light,small-dark > /tmp/fit-checks/p4-t8.log 2>&1; tail -n 25 /tmp/fit-checks/p4-t8.log
git add src/screens/you src/screens/track/weeklyGoal.ts src/screens/track/stepsGoal.ts src/components/hig/shell.node.test.ts scripts/e2e/acceptance
git commit -m "feat: Add Me's Goals, with each goal's history and the programme"
```

Expected: 0 failed.

---

### Task 9: Display

**Files:**
- Modify: `src/lib/textSize.ts`, `src/lib/textSize.test.ts`
- Create: `src/screens/you/display.ts`, `src/screens/you/display.test.ts`
- Create: `src/screens/you/DisplayScreen.tsx`
- Delete: `src/screens/you/AppearanceScreen.tsx`
- Modify: `src/screens/you/routes.tsx`, `MeHome.tsx` (the Display row's line)
- Modify: `src/screens/you/write.ts`, `write.test.ts` (`changeDisplay`)
- Modify: `src/App.tsx`, `src/main.tsx`
- Modify: `src/types/index.ts` (`display.textScale`), `src/store/importCheck.ts`, `importCheck.test.ts`
- Modify: `scripts/e2e/acceptance/journeys/j17.mjs`, `journeys/m01.mjs`

**Interfaces:**
- Consumes: `settings.display` (Plan 1), `useReducedMotion`, `ChoiceRows`, `Toggle` and `Notice`.
- Produces:
  - `TEXT_SCALES = [1, 1.15, 1.3, 1.6, 2] as const`, `type TextScale` and `isTextScale(x: unknown): x is TextScale`;
  - `rootFontSize(base: string, scale: number): string`;
  - `applyTextScale(scale: number | undefined, doc?: Document): void`;
  - `applyTextSize(doc?: Document, scale?: number): void`, the existing function with a new optional `scale`;
  - `interface SystemDisplay { reducedMotion: boolean; reducedTransparency: boolean; moreContrast: boolean }`;
  - `interface DisplayChoice { on: boolean; bySystem: boolean }`;
  - `displayChoices(display, system): { reduceMotion: DisplayChoice; reduceTransparency: DisplayChoice }`;
  - `readSystemDisplay(win?)`, `TEXT_SIZE_CHOICES` and `displayLine(settings)`;
  - `fadeTheme(change: () => void, reduced: boolean, doc?: Document): void`;
  - `changeDisplay(edit): Promise<StoreResult>`;
  - `DisplayControls()`, Display's four controls without the screen around them, which Plan 5's first setup page renders, and `DisplayScreen` at `/me/display`;
  - `UserSettings.display.textScale?: number`.

- [ ] **Step 1: Write the failing tests.** In `src/lib/textSize.test.ts`, import `TEXT_SCALES`, `applyTextScale`, `isTextScale` and `rootFontSize` too, then append:

```ts
describe('the app’s own text size (journey §16 Display, D60)', () => {
  it('offers five sizes', () => {
    expect(TEXT_SCALES).toEqual([1, 1.15, 1.3, 1.6, 2]);
    expect(isTextScale(1.3)).toBe(true);
    expect(isTextScale(1.4)).toBe(false);
    expect(isTextScale('1.3')).toBe(false);
  });

  it('takes the larger of the device’s size and its own, so it never makes text smaller', () => {
    expect(rootFontSize('', 1)).toBe('');
    expect(rootFontSize('', 1.15)).toBe('115%');
    expect(rootFontSize('', 2)).toBe('200%');
    expect(rootFontSize('16px', 1.3)).toBe('20.8px');
    expect(rootFontSize('32px', 1.3)).toBe('32px');
    expect(rootFontSize('130%', 1.15)).toBe('130%');
    expect(rootFontSize('100%', 1.6)).toBe('160%');
    expect(rootFontSize('19.76px', 1)).toBe('19.76px');
  });

  /** A stand-in for `document`: the root's inline font size and its data attributes. */
  const fakeDoc = (fontSize = '') => ({ documentElement: { style: { fontSize }, dataset: {} as Record<string, string | undefined> } }) as unknown as Document;

  it('gives back exactly what the device set when turned off (Review Focus 4)', () => {
    const browser = fakeDoc('200%');
    applyTextScale(1.3, browser);
    expect(browser.documentElement.style.fontSize).toBe('200%');
    applyTextScale(1, browser);
    expect(browser.documentElement.style.fontSize).toBe('200%');
    expect(browser.documentElement.dataset.textBase).toBeUndefined();
    const ios = fakeDoc('19.76px');
    applyTextScale(1.6, ios);
    expect(ios.documentElement.style.fontSize).toBe('25.6px');
    applyTextScale(undefined, ios);
    expect(ios.documentElement.style.fontSize).toBe('19.76px');
  });

  it('leaves a root it never changed alone, and ignores a size this build does not offer', () => {
    const doc = fakeDoc('200%');
    applyTextScale(1, doc);
    applyTextScale(7, doc);
    expect(doc.documentElement.style.fontSize).toBe('200%');
    expect(doc.documentElement.dataset.textBase).toBeUndefined();
  });
});
```

Create `src/screens/you/display.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { TEXT_SCALES } from '@/lib/textSize';
import { TEXT_SIZE_CHOICES, displayChoices, displayLine, fadeTheme } from './display';

const none = { reducedMotion: false, reducedTransparency: false, moreContrast: false };

describe('displayChoices: the device’s settings come first (journey §16)', () => {
  it('follows the app’s own choice when the device asks for nothing', () => {
    expect(displayChoices(undefined, none)).toEqual({ reduceMotion: { on: false, bySystem: false }, reduceTransparency: { on: false, bySystem: false } });
    expect(displayChoices({ reduceMotion: true, reduceTransparency: true }, none))
      .toEqual({ reduceMotion: { on: true, bySystem: false }, reduceTransparency: { on: true, bySystem: false } });
  });
  it('is on, and the device’s doing, when the device asks', () => {
    expect(displayChoices({ reduceMotion: false }, { ...none, reducedMotion: true }).reduceMotion).toEqual({ on: true, bySystem: true });
    expect(displayChoices(undefined, { ...none, moreContrast: true }).reduceTransparency).toEqual({ on: true, bySystem: true });
    expect(displayChoices(undefined, { ...none, reducedTransparency: true }).reduceTransparency).toEqual({ on: true, bySystem: true });
  });
});

describe('displayLine', () => {
  it('says the theme and the text size, and what is reduced', () => {
    expect(displayLine({ theme: 'system' })).toBe('Automatic · Standard text');
    expect(displayLine({ theme: 'dark', display: { textScale: 1.3, reduceMotion: true } })).toBe('Dark · Larger text · Reduce motion');
    expect(displayLine({ theme: 'light', display: { textScale: 7, reduceTransparency: true } })).toBe('Light · Standard text · Reduce transparency');
  });
});

describe('the choices', () => {
  it('are the five sizes this build can apply (journey §20.4 rule 13)', () => {
    expect(TEXT_SIZE_CHOICES.map(c => Number(c.value))).toEqual([...TEXT_SCALES]);
  });
});

describe('fadeTheme (M23)', () => {
  /** A stand-in document: its root's data attributes, and a view transition that runs its update at once. */
  const fakeDoc = (transitions: boolean) => {
    const ran: string[] = [];
    const doc = {
      documentElement: { dataset: {} as Record<string, string | undefined> },
      ...(transitions ? { startViewTransition: (update: () => void) => { ran.push('transition'); update(); } } : {}),
    } as unknown as Document;
    return { doc, ran };
  };
  it('changes the theme inside a root transition with the tab hand-over', () => {
    const { doc, ran } = fakeDoc(true);
    let changed = 0;
    fadeTheme(() => { changed += 1; }, false, doc);
    expect([ran, changed, doc.documentElement.dataset.nav]).toEqual([['transition'], 1, 'tab']);
  });
  it('changes it at once under Reduce Motion, or where the browser has no view transitions', () => {
    const reduced = fakeDoc(true);
    let changed = 0;
    fadeTheme(() => { changed += 1; }, true, reduced.doc);
    fadeTheme(() => { changed += 1; }, false, fakeDoc(false).doc);
    expect([reduced.ran, changed, reduced.doc.documentElement.dataset.nav]).toEqual([[], 2, undefined]);
  });
});
```

In `write.test.ts`, import `changeDisplay` and append:

```ts
describe('changeDisplay', () => {
  it('changes one display setting and keeps the others', async () => {
    await changeDisplay(d => ({ ...d, reduceMotion: true }));
    await changeDisplay(d => ({ ...d, textScale: 1.3 }));
    expect((await reloadFromDevice()).settings.display).toEqual({ reduceMotion: true, textScale: 1.3 });
  });
});
```

In `importCheck.test.ts`, inside the settings `describe`:

```ts
  it('reads the display settings, and leaves out a text size this build does not offer', () => {
    expect(preview(file({ settings: { ...settings, display: { reduceMotion: true, reduceTransparency: false, textScale: 1.3 } } })).unreadableFields).toEqual([]);
    expect(preview(file({ settings: { ...settings, display: { textScale: 7 } } })).unreadableFields).toEqual(['settings.display']);
  });
```

- [ ] **Step 2: Run them to check they fail**

Run: `npx vitest run src/lib/textSize.test.ts src/screens/you/display.test.ts src/screens/you/write.test.ts src/store/importCheck.test.ts`
Expected: FAIL. The new names don't exist, and `display` isn't read.

- [ ] **Step 3: The text size.** In `src/lib/textSize.ts`, add:

```ts
/** The app's own text sizes (journey §16 Display), as a scale of the design's: five choices (§20.4 rule 13). */
export const TEXT_SCALES = [1, 1.15, 1.3, 1.6, 2] as const;
export type TextScale = (typeof TEXT_SCALES)[number];

export function isTextScale(x: unknown): x is TextScale {
  return TEXT_SCALES.includes(x as TextScale);
}

/**
 * The root font size for the app's own text size, over what the device set.
 * `base` is the root's inline size before the app changed it: '' for the
 * browser's own, 'NNpx' from the iOS Text Size, or 'NNN%'. The larger of the
 * two wins, so the app never makes text smaller than the person's own
 * setting (D60).
 */
export function rootFontSize(base: string, scale: number): string {
  if (!(scale > 1)) return base;
  const px = /^([\d.]+)px$/.exec(base);
  // Rounded: 16 × 1.3 is 20.800000000000004 in floating point.
  if (px) return `${Math.max(Number(px[1]), Math.round(ROOT_PX * scale * 100) / 100)}px`;
  const pct = /^([\d.]+)%$/.exec(base);
  if (pct) return `${Math.max(Number(pct[1]), Math.round(scale * 100))}%`;
  return `${Math.round(scale * 100)}%`;
}

/**
 * Apply the app's own text size (`settings.display.textScale`). While it's on,
 * the root's own size waits in `data-text-base`. Turning it off gives that
 * back, and the iOS Text Size changing meanwhile updates it (`applyTextSize`).
 * A root the app never changed is left exactly as it is.
 */
export function applyTextScale(scale: number | undefined, doc: Document = document): void {
  const root = doc.documentElement;
  if (scale === undefined || !isTextScale(scale) || scale <= 1) {
    if (root.dataset.textBase !== undefined) {
      root.style.fontSize = root.dataset.textBase;
      delete root.dataset.textBase;
    }
    return;
  }
  const base = root.dataset.textBase ?? root.style.fontSize;
  root.dataset.textBase = base;
  root.style.fontSize = rootFontSize(base, scale);
}
```

  Then change `applyTextSize` so the iOS size goes under the app's own size while that is on, and the app's size is applied after it:

```ts
export function applyTextSize(doc: Document = document, scale?: number): void {
  const supportsKeyword = typeof CSS !== 'undefined' && CSS.supports('font', '-apple-system-body');
  if (followsSystemTextSize({ supportsKeyword, maxTouchPoints: navigator.maxTouchPoints ?? 0 })) {
    const probe = doc.createElement('span');
    probe.style.font = '-apple-system-body';
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    doc.documentElement.appendChild(probe);
    const size = rootSizeFor(parseFloat(getComputedStyle(probe).fontSize));
    probe.remove();
    if (size !== null) {
      // While the app's own size is on, the device's goes under it (`applyTextScale`).
      if (doc.documentElement.dataset.textBase !== undefined) doc.documentElement.dataset.textBase = `${size}px`;
      else doc.documentElement.style.fontSize = `${size}px`;
    }
  }
  if (scale !== undefined) applyTextScale(scale, doc);
}
```

- [ ] **Step 4: Display's model** `src/screens/you/display.ts`

```ts
/**
 * Me → Display (journey §16; M23): theme, text size, Reduce motion and Reduce
 * transparency. The device's settings come first where the browser reports
 * them. The app adds to them, and never undoes them.
 */
import { flushSync } from 'react-dom';
import { TEXT_SCALES, isTextScale, type TextScale } from '@/lib/textSize';
import type { Theme } from '@/store/useStore';
import type { UserSettings } from '@/types';

export interface SystemDisplay {
  reducedMotion: boolean;
  /** Only Chromium reports it; Safari doesn't, so the app's own switch exists (journey §20.1). */
  reducedTransparency: boolean;
  moreContrast: boolean;
}

export interface DisplayChoice {
  on: boolean;
  /** The device asks for it, so the app's switch can't turn it off. */
  bySystem: boolean;
}

export function displayChoices(display: UserSettings['display'], system: SystemDisplay): { reduceMotion: DisplayChoice; reduceTransparency: DisplayChoice } {
  return {
    reduceMotion: system.reducedMotion ? { on: true, bySystem: true } : { on: display?.reduceMotion === true, bySystem: false },
    reduceTransparency: system.reducedTransparency || system.moreContrast
      ? { on: true, bySystem: true }
      : { on: display?.reduceTransparency === true, bySystem: false },
  };
}

export function readSystemDisplay(win: Pick<Window, 'matchMedia'> = window): SystemDisplay {
  const asks = (query: string) => typeof win.matchMedia === 'function' && win.matchMedia(query).matches;
  return {
    reducedMotion: asks('(prefers-reduced-motion: reduce)'),
    reducedTransparency: asks('(prefers-reduced-transparency: reduce)'),
    moreContrast: asks('(prefers-contrast: more)'),
  };
}

const TEXT_NAME: Record<TextScale, { label: string; detail: string; line: string }> = {
  1: { label: 'Standard', detail: 'As this device sets it', line: 'Standard text' },
  1.15: { label: 'Large', detail: '115%', line: 'Large text' },
  1.3: { label: 'Larger', detail: '130%', line: 'Larger text' },
  1.6: { label: 'Extra large', detail: '160%', line: 'Extra large text' },
  2: { label: 'Largest', detail: '200%', line: 'Largest text' },
};

export const TEXT_SIZE_CHOICES: { value: `${TextScale}`; label: string; detail: string }[] =
  TEXT_SCALES.map(scale => ({ value: `${scale}` as `${TextScale}`, label: TEXT_NAME[scale].label, detail: TEXT_NAME[scale].detail }));

const THEME_NAME: Record<Theme, string> = { system: 'Automatic', light: 'Light', dark: 'Dark' };

/** Me's Display row: "Dark · Larger text · Reduce motion". */
export function displayLine(settings: Pick<UserSettings, 'theme' | 'display'>): string {
  const scale = isTextScale(settings.display?.textScale) ? settings.display.textScale : 1;
  return [
    THEME_NAME[settings.theme],
    TEXT_NAME[scale].line,
    settings.display?.reduceMotion && 'Reduce motion',
    settings.display?.reduceTransparency && 'Reduce transparency',
  ].filter(Boolean).join(' · ');
}

/**
 * M23: a new theme fades in over the page through a root view transition,
 * with the plain hand-over a tab change uses (`data-nav="tab"`, index.css).
 *
 * `change` stores the theme. App's theme effect then draws it, and puts the
 * stored one back if the write is refused. It runs inside the transition,
 * after the old frame is captured; `flushSync` lets that effect run before
 * the new frame is. Stored first, the effect a click flushes at once would
 * leave nothing to fade.
 *
 * Under Reduce Motion it changes at once. An urgent decision skips the
 * transition (main.tsx), and the change still happens.
 */
export function fadeTheme(change: () => void, reduced: boolean, doc: Document = document): void {
  if (reduced || typeof doc.startViewTransition !== 'function') {
    change();
    return;
  }
  doc.documentElement.dataset.nav = 'tab';
  doc.startViewTransition(() => flushSync(change));
}
```

- [ ] **Step 5: The setting, its write and its reader.**
  - In `src/types/index.ts`, make `display` `display?: { reduceMotion?: boolean; reduceTransparency?: boolean; textScale?: number };`, keeping its comment, and add: `/** v2: the app's own text size, one of TEXT_SCALES (src/lib/textSize.ts). */`.
  - In `src/screens/you/write.ts`, add `import type { UserSettings } from '@/types';` and:

```ts
/** Change one display setting, from the latest ones (journey §16 Display). */
export function changeDisplay(edit: (display: NonNullable<UserSettings['display']>) => NonNullable<UserSettings['display']>): Promise<StoreResult> {
  return update(previous => ({ ...previous, settings: { ...previous.settings, display: edit(previous.settings.display ?? {}) } }));
}
```

  - In `src/store/importCheck.ts`:
    - import `isTextScale` from `@/lib/textSize`;
    - in `SETTINGS_SPEC`, after `setup`, add:

```ts
  display: shape({ reduceMotion: bool, reduceTransparency: bool, textScale: x => isTextScale(x) }),
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/lib/textSize.test.ts src/screens/you/display.test.ts src/screens/you/write.test.ts src/store/importCheck.test.ts`
Expected: PASS.

- [ ] **Step 7: The app applies it.**
  - In `src/App.tsx`, import `applyTextScale` from `@/lib/textSize`. Add this effect after the display-settings effect:

```tsx
  // The app's own text size, over the device's (journey §16, D60): instant, as M23 asks.
  useEffect(() => {
    applyTextScale(settings.display?.textScale);
  }, [settings.display?.textScale]);
```

  - In `src/main.tsx`, the return-to-app listener passes the app's size:

```ts
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') applyTextSize(document, getState().settings.display?.textScale) })
```

    `getState` is already imported there. The first `applyTextSize()` at boot stays as it is: nothing is loaded yet.

- [ ] **Step 8: The screen** `src/screens/you/DisplayScreen.tsx`

```tsx
import { useState } from 'react';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { TextScale } from '@/lib/textSize';
import type { StoreResult } from '@/store/db';
import { setSettings, useStore, type Theme } from '@/store/useStore';
import { ChoiceRows, Notice, Toggle, type Choice } from './controls';
import { TEXT_SIZE_CHOICES, displayChoices, fadeTheme, readSystemDisplay } from './display';
import { changeDisplay } from './write';

const THEMES: Choice<Theme>[] = [
  { value: 'system', label: 'Automatic', detail: 'Light or dark, following this device' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Display (journey §16), at `/me/display`. */
export function DisplayScreen() {
  return (
    <Screen title="Display" back={{ to: '/me', label: 'Me' }}>
      <DisplayControls />
    </Screen>
  );
}

/**
 * Display's controls: theme, text size, Reduce motion and Reduce
 * transparency. Text size and the two switches change the app at once; the
 * theme fades (M23). Where the device asks for less motion or transparency,
 * its switch is on and says so. Setup's first page shows the same controls
 * (Plan 5).
 */
export function DisplayControls() {
  const { settings } = useStore();
  const reduced = useReducedMotion();
  // Read once per visit: the device's own settings are changed outside the app.
  const [system] = useState(() => readSystemDisplay());
  const [problem, setProblem] = useState<string>();
  const choices = displayChoices(settings.display, system);
  const report = (saved: StoreResult) => setProblem(saved.ok ? undefined : `That did not save. ${saved.failure.message}`);
  // A refused write puts the stored theme back by itself: the store drops the change, and App's effect draws what is stored.
  const chooseTheme = (theme: Theme) => fadeTheme(() => void setSettings({ theme }).then(report), reduced);

  return (
    <>
      <Group header="Theme">
        <ChoiceRows label="Theme" options={THEMES} value={settings.theme} onChange={chooseTheme} />
      </Group>
      <Group header="Text size" footer="If this device’s own text size is larger, the app uses that.">
        <ChoiceRows
          label="Text size"
          options={TEXT_SIZE_CHOICES}
          value={`${settings.display?.textScale ?? 1}` as `${TextScale}`}
          onChange={value => void changeDisplay(d => ({ ...d, textScale: Number(value) })).then(report)}
        />
      </Group>
      <Group header="Motion and transparency">
        <Row
          label="Reduce motion"
          detail={choices.reduceMotion.bySystem ? 'On, because this device’s Reduce Motion is on.' : 'Slides and zooms become gentle fades.'}
          accessory={<Toggle checked={choices.reduceMotion.on} disabled={choices.reduceMotion.bySystem} label="Reduce motion"
            onChange={on => void changeDisplay(d => ({ ...d, reduceMotion: on })).then(report)} />}
        />
        <Row
          label="Reduce transparency"
          detail={choices.reduceTransparency.bySystem ? 'On, because this device asks for more contrast or less transparency.' : 'Makes the tab bar and headers solid.'}
          accessory={<Toggle checked={choices.reduceTransparency.on} disabled={choices.reduceTransparency.bySystem} label="Reduce transparency"
            onChange={on => void changeDisplay(d => ({ ...d, reduceTransparency: on })).then(report)} />}
        />
      </Group>
      {problem && <Notice tone="error">{problem}</Notice>}
    </>
  );
}
```

- [ ] **Step 9: Me uses it.**
  - Delete `src/screens/you/AppearanceScreen.tsx`.
  - In `routes.tsx`, change `display`'s element to `<DisplayScreen />` and import it.
  - In `MeHome.tsx`, change the Display row's detail to `displayLine(settings)`, import it from `./display`, and delete `THEME`.

- [ ] **Step 10: The journeys.**
  - `j17.mjs`: Display's theme group is "Theme". Change its three `radiogroup` lookups by name, `'Appearance'` → `'Theme'`. The fault, the failure text and every other assertion stay as they are.
  - `run.mjs`: add `'/me/display'` to `warm()`'s list, after `'/me/reminders'`.
  - `m01.mjs`: add these cases, and add `display, systemMotion` to `cases`:

```js
const display = {
  name: 'display settings apply at once and hold',
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '/me/display' });
    const main = page.getByRole('main');
    const root = () => page.evaluate(() => ({
      dark: document.documentElement.classList.contains('dark'),
      font: getComputedStyle(document.documentElement).fontSize,
      motion: document.documentElement.dataset.reduceMotion !== undefined,
      glass: document.documentElement.dataset.glass ?? '',
    }));
    const size = () => main.getByRole('radiogroup', { name: 'Text size' });
    await t.step(1, 'Theme: Dark, Light, then Automatic', async () => {
      const theme = main.getByRole('radiogroup', { name: 'Theme' });
      await ui.tap(ui.row(theme, 'Dark', 'radio'));
      await page.waitForTimeout(400);
      await t.check((await root()).dark, 'Dark did not darken the page');
      await ui.tap(ui.row(theme, 'Light', 'radio'));
      await page.waitForTimeout(400);
      await t.check(!(await root()).dark, 'Light left the page dark');
      await ui.tap(ui.row(theme, 'Automatic', 'radio'));
      await page.waitForTimeout(400);
      await t.check((await root()).dark === (t.project.scheme === 'dark'), 'Automatic does not follow the device');
      await t.check(docs(await t.db()).settings?.theme === 'system', 'Automatic was not stored');
    });
    await t.step(2, 'Text size: Largest applies at once, and Home takes one column', async () => {
      await ui.tap(ui.row(size(), 'Largest', 'radio'));
      await page.waitForTimeout(300);
      await t.check((await root()).font === '32px', `Largest set the root to ${(await root()).font}`);
      await t.check(docs(await t.db()).settings?.display?.textScale === 2, 'Largest was not stored');
      await t.checkpoint('display-largest');
      await ui.tab(page, 'Home');
      const cols = await page.getByRole('main').locator('section[data-group="move"] ul').getAttribute('class');
      await t.check(/\bgrid-cols-1\b/.test(cols ?? ''), `Home’s tiles keep “${cols}” at 200% text`);
    });
    await t.step(3, 'Reduce motion and Reduce transparency', async () => {
      await t.goto('/me/display');
      await ui.tap(main.getByRole('switch', { name: 'Reduce motion', exact: true }));
      await ui.tap(main.getByRole('switch', { name: 'Reduce transparency', exact: true }));
      await page.waitForTimeout(300);
      const r = await root();
      await t.check(r.motion && r.glass === 'solid', `the page is not reduced: ${JSON.stringify(r)}`);
      const d = docs(await t.db()).settings?.display ?? {};
      await t.check(d.reduceMotion === true && d.reduceTransparency === true, `stored: ${JSON.stringify(d)}`);
    });
    await t.step(4, 'A reload keeps everything; Standard gives back the device’s size', async () => {
      await t.reload();
      const r = await root();
      await t.check(r.font === '32px' && r.motion && r.glass === 'solid', `after a reload: ${JSON.stringify(r)}`);
      await ui.tap(ui.row(size(), 'Standard', 'radio'));
      await page.waitForTimeout(300);
      await t.check((await root()).font === '16px', `Standard left the root at ${(await root()).font}`);
      await t.checkpoint('display-standard');
    });
  },
};

const systemMotion = {
  name: 'the device’s Reduce Motion comes first',
  async run(t) {
    const page = await t.open({ seed: persona('P02'), route: '/me/display', reducedMotion: 'reduce' });
    await t.step(1, 'Reduce motion is on, and says the device set it', async () => {
      const main = page.getByRole('main');
      const sw = main.getByRole('switch', { name: 'Reduce motion', exact: true });
      await t.check(await sw.getAttribute('aria-checked') === 'true', 'the switch is off while the device reduces motion');
      await t.check(/On, because this device’s Reduce Motion is on\./.test(flat(await main.innerText())), 'the row does not say the device set it');
      await t.checkpoint('display-system-motion');
    });
  },
};
```

- [ ] **Step 11: Check by eye.** Use 430×932 and 320×568, light and dark:
  - Largest reflows every Me screen and Home without clipping;
  - the theme fades over about 200 ms with motion allowed, and changes at once under Reduce Motion;
  - Reduce transparency makes the tab bar solid at once.

- [ ] **Step 12: Gates, journeys, commit**

```bash
npx tsc -b && npm run lint && npx vitest run
npm run e2e:acceptance -- --only=M01,J17,S01 --projects=large-light,small-dark > /tmp/fit-checks/p4-t9.log 2>&1; tail -n 25 /tmp/fit-checks/p4-t9.log
git add src/lib/textSize.ts src/lib/textSize.test.ts src/screens/you src/App.tsx src/main.tsx src/types/index.ts src/store/importCheck.ts src/store/importCheck.test.ts scripts/e2e/acceptance
git commit -m "feat: Add Me's Display: theme, text size, Reduce motion and Reduce transparency"
```

Expected: 0 failed.

---

### Task 10: Reminders: calendar copies and quiet hours

**Files:**
- Modify: `src/types/habits.ts` (`CalendarFileEntry.minutes`)
- Modify: `src/reminders/calendarNotice.ts`, `calendarNotice.test.ts`
- Modify: `src/screens/you/summaries.ts`, `summaries.test.ts` (`copyLine`, `staleLine`)
- Modify: `src/screens/you/HabitsScreen.tsx`
- Modify: `src/screens/you/CalendarSheet.tsx` (the event's link goes to `#/home`)
- Modify: `src/health/recommend.test.ts`
- Modify: `src/store/importCheck.ts`, `importCheck.test.ts`
- Create: `scripts/e2e/acceptance/journeys/v39.mjs`

**Interfaces:**
- Consumes: `calendarEvents(habits, profile)` (`./ics`), `forgetCalendarEvents` (`./write`), and `shortDate` and `shortDay`.
- Produces:
  - `calendarExportOf`, which now records each habit's event times as `minutes`;
  - `calendarCopies(habits, today): (StillReminding & { until: string })[]`;
  - `interface StaleCopy { habit: HabitId; names: string[]; inCalendar: number; now: number }`;
  - `staleCalendarCopies(habits, profile, today): StaleCopy[]`;
  - `copyLine(copy): { title: string; detail: string }` and `staleLine(stale): string`.

- [ ] **Step 1: Write the failing tests.** In `src/reminders/calendarNotice.test.ts`:
  - add `calendarCopies` and `staleCalendarCopies` to the import;
  - change the `calendarExportOf` test's expected object to include the times;
  - append the new blocks.

```ts
    expect(calendarExportOf(calendarEvents(habits, healthy), AT, TODAY)).toEqual({
      water: { at: AT, until: '2027-01-06', events: 6, titles: ['Glass of water'], minutes: [660, 780, 900, 1020, 1140, 1260] },
      sittingBreak: { at: AT, until: '2027-01-06', events: 2, titles: ['Stand up and move'], minutes: [570, 600] },
      mealWalk: { at: AT, until: '2027-01-06', events: 1, titles: ['Walk after dinner'], minutes: [1140] },
    });
```

```ts
describe('calendarCopies (A-78)', () => {
  it('lists what each file holds while its events still repeat', () => {
    expect(calendarCopies(exported(habits), TODAY).map(c => [c.habit, c.events, c.until])).toEqual([
      ['water', 6, '2027-01-06'], ['sittingBreak', 2, '2027-01-06'], ['mealWalk', 1, '2027-01-06'],
    ]);
    expect(calendarCopies(exported(habits, '2026-06-01'), TODAY)).toEqual([]);
  });
});

describe('staleCalendarCopies: the copies may be out of date (A-78)', () => {
  it('is empty while the schedule is the one the file holds', () => {
    expect(staleCalendarCopies(exported(habits), healthy, TODAY)).toEqual([]);
  });
  it('names a copy quiet hours have since thinned or emptied', () => {
    const quiet = { ...exported(habits), quietHours: { from: '17:00', to: '20:00' } };
    expect(staleCalendarCopies(quiet, healthy, TODAY)).toEqual([
      { habit: 'water', names: ['Glass of water'], inCalendar: 6, now: 4 },
      { habit: 'mealWalk', names: ['Walk after dinner'], inCalendar: 1, now: 0 },
    ]);
  });
  it('names a copy a fluid limit has stopped, and one turned off', () => {
    expect(staleCalendarCopies(exported(habits), limited, TODAY)).toEqual([{ habit: 'water', names: ['Glass of water'], inCalendar: 6, now: 0 }]);
    const off = { ...exported(habits), sittingBreak: { ...habits.sittingBreak!, enabled: false } };
    expect(staleCalendarCopies(off, healthy, TODAY)).toEqual([{ habit: 'sittingBreak', names: ['Stand up and move'], inCalendar: 2, now: 0 }]);
  });
  it('notices a moved time, with the same number a day', () => {
    const moved = { ...exported(habits), mealWalk: { enabled: true, meals: ['dinner' as const], finish: { dinner: '20:00' } } };
    expect(staleCalendarCopies(moved, healthy, TODAY)).toEqual([{ habit: 'mealWalk', names: ['Walk after dinner'], inCalendar: 1, now: 1 }]);
  });
  it('judges a file made before times were kept by its count and names alone', () => {
    const old = exported(habits);
    const entry = { ...old.calendarExport!.water! };
    delete entry.minutes;
    const noTimes = { ...old, calendarExport: { ...old.calendarExport, water: entry } };
    // ponytail: a shift with the same count isn't seen in such a file; a new file records times.
    expect(staleCalendarCopies({ ...noTimes, water: { ...habits.water!, from: '10:00', to: '22:00' } }, healthy, TODAY)).toEqual([]);
    expect(staleCalendarCopies({ ...noTimes, quietHours: { from: '17:00', to: '20:00' } }, healthy, TODAY).map(s => s.habit)).toEqual(['water', 'mealWalk']);
  });
  it('says nothing once a file has run out', () => {
    expect(staleCalendarCopies({ ...exported(habits, '2026-06-01'), quietHours: { from: '17:00', to: '20:00' } }, healthy, TODAY)).toEqual([]);
  });
});
```

In `src/screens/you/summaries.test.ts`, import `copyLine`, `staleLine` and `shortDate` (from `./dates`, beside `shortDay`), then append:

```ts
describe('calendar copies, as Reminders lists them (A-78)', () => {
  const AT = '2026-10-08T10:00:00.000+05:30';
  it('names the events, how many a day, when the file was added and until when', () => {
    expect(copyLine({ names: ['Glass of water'], events: 6, at: AT, until: '2027-01-06' }))
      .toEqual({ title: 'Glass of water', detail: `6 a day · added ${shortDate(AT)} · until ${shortDay('2027-01-06')}` });
    expect(copyLine({ names: ['Walk after lunch', 'Walk after dinner'], events: 2, at: AT, until: '2027-01-06' }).title).toBe('Walk after lunch and Walk after dinner');
    expect(copyLine({ names: ['Walk after dinner'], events: 1, at: AT, until: '2027-01-06' }).detail).toMatch(/^Once a day · added /);
  });
  it('says what changed for each copy that may be out of date', () => {
    expect(staleLine([
      { habit: 'water', names: ['Glass of water'], inCalendar: 6, now: 0 },
      { habit: 'sittingBreak', names: ['Stand up and move'], inCalendar: 2, now: 1 },
    ])).toBe('Glass of water: 6 a day in Calendar, none now. Stand up and move: 2 a day in Calendar, once a day now.');
  });
});
```

In `src/health/recommend.test.ts`, inside `describe('time boundaries (journey §4.1, L-07, B-20)')`:

```ts
  it('quiet hours never hold a re-check (journey §4.9, §15)', () => {
    // A re-check due at 13:45, inside quiet hours from 13:00 to 15:00.
    expect(next(at(TODAY, '13:32'), lowAt1330(), { quietHours: { from: '13:00', to: '15:00' } })).toEqual(at(TODAY, '13:45'));
  });
```

In `importCheck.test.ts`, inside the settings `describe`:

```ts
  it('reads a calendar file’s event times, and leaves out the file’s record when they cannot be read', () => {
    const entry = { at: '2026-10-07T19:00:00.000+05:30', until: '2027-01-05', events: 1, titles: ['Glass of water'] };
    expect(preview(file({ settings: { ...settings, habits: { calendarExport: { water: { ...entry, minutes: [600] } } } } })).unreadableFields).toEqual([]);
    expect(preview(file({ settings: { ...settings, habits: { calendarExport: { water: { ...entry, minutes: ['9am'] } } } } })).unreadableFields).toEqual(['settings.habits.calendarExport']);
  });
```

- [ ] **Step 2: Run them to check they fail**

Run: `npx vitest run src/reminders/calendarNotice.test.ts src/screens/you/summaries.test.ts src/health/recommend.test.ts src/store/importCheck.test.ts`
Expected: FAIL. `minutes` isn't recorded, and the new names don't exist. The quiet-hours test already passes: it pins the contract.

- [ ] **Step 3: The ledger records times.**
  - In `src/types/habits.ts`, inside `CalendarFileEntry`:

```ts
  /** The events' times, minutes after local midnight, in order, so a changed schedule can be noticed (A-78). Absent for a file made before this was kept. */
  minutes?: number[];
```

  - In `src/reminders/calendarNotice.ts`:
    - add `import { calendarEvents } from './ics';` beside the type import from `./ics`;
    - in `calendarExportOf`, create each entry with `minutes: []`, and push `e.minute` beside `entry.events += 1`:

```ts
    const entry: CalendarFileEntry = out[e.habit] ??= { at, until, events: 0, titles: [], minutes: [] };
    entry.events += 1;
    entry.minutes?.push(e.minute);
```

  - Append:

```ts
/** The calendar copies whose events still repeat (A-78): what each file holds for a habit, when it was made, and until when. */
export function calendarCopies(habits: HabitSettings | undefined, today: string): (StillReminding & { until: string })[] {
  return HABITS.flatMap(habit => {
    const still = exportedStill(habits, habit, today);
    return still ? [{ ...still, until: habits!.calendarExport![habit]!.until }] : [];
  });
}

export interface StaleCopy {
  habit: HabitId;
  /** What its events are called in Calendar. */
  names: string[];
  /** How many daily events the file holds. */
  inCalendar: number;
  /** How many a new file would hold now. */
  now: number;
}

const same = <T,>(a: readonly T[], b: readonly T[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * The calendar copies a new file would no longer match (A-78). Their events
 * still repeat, but the schedule here has changed since: quiet hours, a
 * window or a time, a fluid limit, or a habit turned off. A file made before
 * the times were kept is judged by its count and names alone.
 */
export function staleCalendarCopies(habits: HabitSettings | undefined, profile: UserProfile | undefined, today: string): StaleCopy[] {
  const current = calendarEvents(habits, profile);
  return calendarCopies(habits, today).flatMap(copy => {
    const entry = habits!.calendarExport![copy.habit]!;
    const mine = current.filter(e => e.habit === copy.habit);
    const names = [...new Set(mine.map(e => e.title))];
    const unchanged = (entry.minutes ? same(entry.minutes, mine.map(e => e.minute)) : entry.events === mine.length) && same(entry.titles, names);
    return unchanged ? [] : [{ habit: copy.habit, names: entry.titles, inCalendar: entry.events, now: mine.length }];
  });
}
```

  - In `src/store/importCheck.ts`, add `minutes: listOf(num(0, 1439))` to `HABIT_SPEC`'s `calendarExport` shape. Its required fields stay `['at', 'until', 'events', 'titles']`.

- [ ] **Step 4: Reminders' words.** In `src/screens/you/summaries.ts`, import `type { StaleCopy } from '@/reminders/calendarNotice'`, then add:

```ts
const perDay = (n: number) => (n === 1 ? 'Once a day' : `${n} a day`);
const perDayInline = (n: number) => (n === 1 ? 'once a day' : `${n} a day`);

/** A calendar copy as Reminders lists it (A-78): its events' names, how many a day, when the file was added, and until when. */
export function copyLine(copy: { names: readonly string[]; events: number; at: string; until: string }): { title: string; detail: string } {
  return { title: copy.names.join(' and '), detail: `${perDay(copy.events)} · added ${shortDate(copy.at)} · until ${shortDay(copy.until)}` };
}

/** What changed, for each copy that may be out of date, in one paragraph. */
export function staleLine(stale: readonly StaleCopy[]): string {
  return stale.map(s => `${s.names.join(' and ')}: ${perDayInline(s.inCalendar)} in Calendar, ${s.now === 0 ? 'none now' : `${perDayInline(s.now)} now`}.`).join(' ');
}
```

  Import `shortDate` from `./dates` beside `shortDay`.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/reminders/calendarNotice.test.ts src/screens/you/summaries.test.ts src/health/recommend.test.ts src/store/importCheck.test.ts`
Expected: PASS.

- [ ] **Step 6: The screen.** In `src/screens/you/HabitsScreen.tsx`:
  - **Imports:**
    - add `CalendarX2Icon` to the lucide imports;
    - replace the `calendarStillReminds` import with `import { calendarCopies, staleCalendarCopies } from '@/reminders/calendarNotice';`;
    - import `copyLine` and `staleLine` from `./summaries`, and `forgetCalendarEvents` from `./write`;
    - remove the `CalendarStill` import. `CalendarStill.tsx` itself stays: the Water sheet and Profile & health still show it.
  - **After `const status = …`:**

```tsx
  const stale = staleCalendarCopies(habits, profile, today);
  const copies = calendarCopies(habits, today);
```

  - **The top `<CalendarStill …/>`:** replace it with the lines below (D67). The out-of-date group says what D-01's notice said, for a habit the app has stopped (a fluid limit, a foot wound, answers to review: none now) and for one whose schedule changed alike:
    - what Calendar still holds;
    - that the app can't remove it;
    - how to delete it.

```tsx
      <Notice>FitStrong can’t alert you while it’s closed. For safety re-checks, set a timer on your phone.</Notice>
      {stale.length > 0 && (
        <Group footer="This app can’t remove them. In Calendar, delete those events, or the calendar you added them to, then add the new file with Add to Calendar.">
          <Row icon={<CalendarX2Icon className="text-caution" />} label="Your calendar copies may be out of date" detail={staleLine(stale)} />
          {/* Only the person can say the old events are gone (D-01). */}
          <Row
            onClick={() => void forgetCalendarEvents(stale.map(s => s.habit)).then(saved => setProblem(saved.ok ? undefined : `That did not save. ${saved.failure.message}`))}
            label={<span className="text-tint">I have deleted them</span>}
          />
        </Group>
      )}
```

  - **"While the app is open":** add one sentence to the end of its footer: " Quiet hours hold these reminders, never a safety re-check." The rest of the footer stays, because J07 reads "cannot remind you once it is closed".
  - **"When the app is closed":** gets the footer "Calendar reminders are copies. Changes here don’t update them. Remove the old ones and add the new file." After its "Add to Calendar" row, add:

```tsx
        {copies.map(copy => {
          const line = copyLine(copy);
          return <Row key={copy.habit} label={line.title} detail={line.detail} />;
        })}
```

  In `src/screens/you/CalendarSheet.tsx`, `appLink()` opens `#/home` instead of `#/today`.

- [ ] **Step 7: Write V-J39** `scripts/e2e/acceptance/journeys/v39.mjs`

```js
/**
 * V-J39: calendar copies after a fluid limit is added (journey §17.2 V-J39,
 * §15; A-78). Reminders records what each calendar file holds, says when the
 * copies may be out of date and what to do, and a new file replaces them.
 */
import { docs } from '../lib/harness.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as g from '../lib/guide.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J39';
export const title = 'Calendar copies after a fluid limit';
export const safety = false;

const flat = s => s.replace(/[  ]/g, ' ').replace(/\s+/g, ' ');
const HABITS = {
  water: { enabled: true, glassMl: 250, everyMinutes: 120, from: '09:00', to: '21:00' },
  sittingBreak: { enabled: true, everyMinutes: 60, from: '10:00', to: '16:00' },
};

export const cases = [{
  name: 'out of date after a fluid limit, then replaced',
  async run(t) {
    const page = await t.open({
      seed: persona('P02', { patch: { settings: { habits: HABITS }, profile: { health: { fluidRestriction: false } } } }),
      route: '/home',
      capabilities: { share: 'absent' },
    });
    const main = page.getByRole('main');
    const shown = async () => flat(await main.innerText());
    await t.step(1, 'Me → Reminders → Add to Calendar: the copies are listed', async () => {
      await g.openHabits(t);
      const text = await shown();
      await t.check(/FitStrong can’t alert you while it’s closed\. For safety re-checks, set a timer on your phone\./.test(text), 'Reminders does not say the app can’t alert while closed');
      const cal = await g.openHabitSheet(t, 'Add to Calendar');
      const file = await g.download(t, () => ui.tap(ui.button(cal, 'Add to Calendar')));
      await t.check(file.name.endsWith('.ics'), `the file is ${file.name}`);
      await ui.tap(ui.button(cal, 'Close'));
      await cal.waitFor({ state: 'hidden' });
      const after = await shown();
      await t.check(/Calendar reminders are copies\. Changes here don’t update them\. Remove the old ones and add the new file\./.test(after), 'Reminders does not say calendar reminders are copies');
      await t.check(/Glass of water 6 a day · added 8 Oct 2026 · until 6 Jan 2027/.test(after) && /Stand up and move 6 a day · added 8 Oct 2026 · until 6 Jan 2027/.test(after), `the copies are not listed: ${after.slice(0, 500)}`);
      await t.check(!/may be out of date/.test(after), 'a fresh file reads as out of date');
      const exp = docs(await t.db()).settings?.habits?.calendarExport ?? {};
      await t.check(exp.water?.minutes?.length === 6 && exp.sittingBreak?.minutes?.length === 6, `the file’s times were not kept: ${JSON.stringify(exp)}`);
      await t.checkpoint('reminders-copies');
    });
    await t.step(2, 'Water → “Yes, I have a fluid limit” → Save: the copies may be out of date', async () => {
      const ws = await g.openHabitSheet(t, 'Water');
      await ui.tap(ui.row(ws.getByRole('radiogroup', { name: 'Has your care team told you to limit how much you drink?' }), 'Yes, I have a fluid limit', 'radio'));
      await ui.tap(ui.button(ws, 'Save'));
      await ws.waitFor({ state: 'hidden' });
      const text = await shown();
      await t.check(/Your calendar copies may be out of date/.test(text), `no out-of-date warning: ${text.slice(0, 300)}`);
      await t.check(/Glass of water: 6 a day in Calendar, none now\./.test(text), 'the warning does not say what changed');
      await t.check(/This app can’t remove them\. In Calendar, delete those events, or the calendar you added them to, then add the new file with Add to Calendar\./.test(text), 'the warning does not say what to do');
      await t.checkpoint('reminders-out-of-date');
    }, { input: 'fluid limit: yes' });
    await t.step(3, 'I have deleted them → Add to Calendar: the new copies match', async () => {
      await ui.tap(ui.row(main, 'I have deleted them'));
      await page.waitForTimeout(300);
      await t.check(!/may be out of date/.test(await shown()), 'the warning stays after the old copies were removed');
      const cal = await g.openHabitSheet(t, 'Add to Calendar');
      const file = await g.download(t, () => ui.tap(ui.button(cal, 'Add to Calendar')));
      await t.check(!g.parseIcs(file.text).events.some(e => /water/i.test(e.SUMMARY ?? '')), 'the new file still holds water');
      await ui.tap(ui.button(cal, 'Close'));
      await cal.waitFor({ state: 'hidden' });
      const text = await shown();
      await t.check(/Stand up and move 6 a day/.test(text) && !/Glass of water \d+ a day/.test(text) && !/may be out of date/.test(text), `after replacing, Reminders reads: ${text.slice(0, 500)}`);
      const exp = docs(await t.db()).settings?.habits?.calendarExport ?? {};
      await t.check(!exp.water && !!exp.sittingBreak, `the copies kept: ${Object.keys(exp).join(', ')}`);
      await t.checkpoint('reminders-replaced');
    });
  },
}];
```

- [ ] **Step 8: Gates, journeys, commit**

```bash
npx tsc -b && npm run lint && npx vitest run
npm run e2e:acceptance -- --only=V-J39,J07 > /tmp/fit-checks/p4-t10.log 2>&1; tail -n 25 /tmp/fit-checks/p4-t10.log
git add src/types/habits.ts src/reminders src/screens/you src/health/recommend.test.ts src/store/importCheck.ts src/store/importCheck.test.ts scripts/e2e/acceptance/journeys/v39.mjs
git commit -m "feat: Keep a ledger of calendar copies, and say when they may be out of date"
```

Expected: 0 failed.

---

### Task 11: Data: backup states, a check, install status, storage, and two confirmations

**Files:**
- Modify: `src/types/habits.ts` (`lastExportVia`, `lastCheckedExportAt`)
- Create: `src/screens/you/dataStatus.ts`, `src/screens/you/dataStatus.test.ts`
- Modify: `src/screens/you/write.ts`, `write.test.ts` (`recordExport({ via })`, `recordBackupCheck`)
- Modify: `src/screens/you/backupFile.ts`, `backupFile.test.ts`
- Modify: `src/screens/you/DataSheets.tsx`, `RestoreFlow.tsx`, `DataScreen.tsx`, `MeHome.tsx`
- Modify: `src/store/importCheck.ts`, `importCheck.test.ts`
- Modify: `scripts/e2e/acceptance/lib/data.mjs`, `journeys/j18.mjs`, `journeys/j19.mjs`, `journeys/m01.mjs`
- Create: `scripts/e2e/acceptance/journeys/v35.mjs`

**Interfaces:**
- Consumes:
  - `installContext` and `deviceNoun` (`@/screens/welcome/install`);
  - `previewRecord` and `decode`, through `RestoreFlow`;
  - `backupNudge`, `backupMark` and `recordSpan`;
  - `privacyLine` (Task 7).
- Produces:
  - `type BackupState`, which is `{ kind: 'never' }` or `{ kind: 'shared' | 'checked'; at: string; via?: 'share' | 'download' }`;
  - `backupState(habits)` and `backupLine(state)`;
  - `installStatus(context, device): { label: string; detail: string }`;
  - `fileSize(bytes)` and `storageLine(usage?)`;
  - `type CheckOutcome = 'latest' | 'other' | 'undated' | 'damaged'`;
  - `checkOutcome(preview, latest)` and `checkedLine(outcome, made, latest, device)`;
  - `recordExport({ at, revision?, via? })` and `recordBackupCheck(at)`;
  - `RestoreFlow`'s `purpose?: 'restore' | 'check'`;
  - in the acceptance suite, `data.chooseCheck(t, file)`.

- [ ] **Step 1: Write the failing tests** `src/screens/you/dataStatus.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { ImportPreview } from '@/store/transfer';
import { shortDate } from './dates';
import { backupLine, backupState, checkOutcome, checkedLine, fileSize, installStatus, storageLine } from './dataStatus';

const AT = '2026-10-08T09:00:00.000+05:30';
const OLDER = '2026-10-01T09:00:00.000+05:30';
const whole = { exportedAt: AT, rejected: {}, unreadableObservations: 0, unreadableFields: [] } as Pick<ImportPreview, 'exportedAt' | 'rejected' | 'unreadableObservations' | 'unreadableFields'>;

describe('the backup’s state (B-25)', () => {
  it('is never until a backup has been handed over', () => {
    expect(backupLine(backupState(undefined))).toBe('Last backup: never');
    expect(backupLine(backupState({}))).toBe('Last backup: never');
  });
  it('tells a shared or downloaded backup from a checked one', () => {
    expect(backupLine(backupState({ lastExportAt: AT, lastExportVia: 'share' }))).toBe(`Last backup: shared ${shortDate(AT)} · not checked`);
    expect(backupLine(backupState({ lastExportAt: AT, lastExportVia: 'download' }))).toBe(`Last backup: downloaded ${shortDate(AT)} · not checked`);
    expect(backupLine(backupState({ lastExportAt: AT }))).toBe(`Last backup: ${shortDate(AT)} · not checked`);
    expect(backupLine(backupState({ lastExportAt: AT, lastExportVia: 'share', lastCheckedExportAt: AT }))).toBe(`Last backup: shared ${shortDate(AT)} · checked`);
  });
  it('never counts an older backup’s check for a newer one', () => {
    expect(backupState({ lastExportAt: AT, lastCheckedExportAt: OLDER }).kind).toBe('shared');
  });
});

describe('a backup file read back (B-25; Review Focus 5)', () => {
  it('is the latest only when it is whole and its snapshot is the last backup’s', () => {
    expect(checkOutcome(whole, AT)).toBe('latest');
    expect(checkOutcome(whole, OLDER)).toBe('other');
    expect(checkOutcome(whole, undefined)).toBe('other');
    expect(checkOutcome({ ...whole, exportedAt: undefined }, AT)).toBe('undated');
    expect(checkOutcome({ ...whole, unreadableObservations: 2 }, AT)).toBe('damaged');
    expect(checkOutcome({ ...whole, rejected: { sessions: 1 } }, AT)).toBe('damaged');
    expect(checkOutcome({ ...whole, unreadableFields: ['settings.theme'] }, AT)).toBe('damaged');
  });
  it('says what the check found', () => {
    expect(checkedLine('latest', AT, AT, 'iPhone')).toBe(`Checked. This is your latest backup, made ${shortDate(AT)}, and it reads back whole.`);
    expect(checkedLine('other', OLDER, AT, 'iPhone')).toBe(`This file reads back, but it isn’t your latest backup: it was made ${shortDate(OLDER)}, and your latest is from ${shortDate(AT)}.`);
    expect(checkedLine('other', OLDER, undefined, 'iPhone')).toBe('This file reads back, but no backup has been made on this iPhone yet, so there is nothing to match it to.');
    expect(checkedLine('undated', undefined, AT, 'iPhone')).toBe('This file reads back, but it doesn’t say when it was made, so it can’t be matched to your latest backup.');
    expect(checkedLine('damaged', AT, AT, 'iPhone')).toBe('Parts of this file can’t be read, so it isn’t a whole backup. Make a new one.');
  });
});

describe('install status (B-24)', () => {
  it('says installing helps but is not a backup, and what Safari may do', () => {
    expect(installStatus('installed', 'iPhone')).toEqual({ label: 'Installed', detail: 'Installing helps iPhone keep your data, but it isn’t a backup.' });
    expect(installStatus('installed', 'device').detail).toBe('Installing helps this device keep your data, but it isn’t a backup.');
    expect(installStatus('iosBrowser', 'iPhone')).toEqual({ label: 'Not installed', detail: 'Safari may remove data from websites you haven’t opened for a while.' });
    expect(installStatus('desktop', 'device')).toEqual({ label: 'In this browser', detail: 'Clearing this browser’s data would delete it. Back up now and then.' });
  });
});

describe('sizes', () => {
  it('reads bytes as KB or MB, and an unknown use plainly', () => {
    expect(fileSize(300)).toBe('1 KB');
    expect(fileSize(5 * 1024)).toBe('5 KB');
    expect(fileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
    expect(storageLine(2.5 * 1024 * 1024)).toBe('About 2.5 MB');
    expect(storageLine(undefined)).toBe('Not known in this browser');
    expect(storageLine(Number.NaN)).toBe('Not known in this browser');
  });
});
```

In `write.test.ts`:
- add `recordBackupCheck` to the import;
- import `backupMark` and `backupNudge`, which the file already imports;
- append:

```ts
describe('the backup ledger (B-25)', () => {
  it('records how the backup left; a new backup is not checked until its own file is', async () => {
    await recordExport({ at: '2026-10-01T10:00:00.000+05:30', revision: 3, via: 'download' });
    await recordBackupCheck('2026-10-01T10:00:00.000+05:30');
    expect((await reloadFromDevice()).settings.habits?.lastCheckedExportAt).toBe('2026-10-01T10:00:00.000+05:30');
    await recordExport({ at: '2026-10-08T10:00:00.000+05:30', revision: 9, via: 'share' });
    const habits = (await reloadFromDevice()).settings.habits;
    expect(habits?.lastExportVia).toBe('share');
    expect(habits?.lastCheckedExportAt).toBeUndefined();
  });
  it('checks only the latest backup: another file’s time changes nothing (Review Focus 5)', async () => {
    await recordExport({ at: '2026-10-08T10:00:00.000+05:30', revision: 9, via: 'share' });
    await recordBackupCheck('2026-10-01T10:00:00.000+05:30');
    expect((await reloadFromDevice()).settings.habits?.lastCheckedExportAt).toBeUndefined();
  });
  it('a check never counts as new data for the backup nudge (Review Focus 5)', async () => {
    const made = await store.exportRecord();
    if (!made.ok) throw new Error('export failed');
    await recordExport({ at: made.value.exportedAt, revision: made.value.revision, via: 'share' });
    await recordBackupCheck(made.value.exportedAt);
    const month = new Date(Date.parse(made.value.exportedAt) + 31 * 86_400_000);
    const span = { first: Date.parse('2026-01-01T00:00:00Z'), last: Date.parse('2026-01-02T00:00:00Z') };
    const due = () => {
      const s = store.getState();
      return backupNudge(month, backupMark(s.settings.habits), span, s.revision).due;
    };
    expect(store.getState().settings.habits?.lastCheckedExportAt).toBe(made.value.exportedAt);
    expect(due()).toBe(false);
    await changeProfile(p => ({ ...p, weightKg: 81 }));
    expect(due()).toBe(true);
  });
});
```

In `backupFile.test.ts`, append inside `describe('settingsKey')`:

```ts
  it('ignores how the backup left and whether it was checked, too', () => {
    const stamped = { ...settings, habits: { ...settings.habits, lastExportAt: 'x', lastExportSeq: 9, lastExportVia: 'share', lastCheckedExportAt: 'x' } } as unknown as UserSettings;
    expect(settingsKey(stamped)).toBe(settingsKey(settings));
  });
```

In `importCheck.test.ts`, inside the settings `describe`:

```ts
  it('reads how the last backup left and whether it was checked', () => {
    expect(preview(file({ settings: { ...settings, habits: { lastExportAt: 'x', lastExportVia: 'share', lastCheckedExportAt: 'x' } } })).unreadableFields).toEqual([]);
    expect(preview(file({ settings: { ...settings, habits: { lastExportVia: 'email' } } })).unreadableFields).toEqual(['settings.habits.lastExportVia']);
  });
```

- [ ] **Step 2: Run them to check they fail**

Run: `npx vitest run src/screens/you src/store/importCheck.test.ts`
Expected: FAIL. `./dataStatus` and `recordBackupCheck` don't exist, `via` isn't recorded, and the keys aren't ignored or read.

- [ ] **Step 3: The ledger's fields.**
  - In `src/types/habits.ts`, inside `HabitSettings`, after `lastExportSeq`:

```ts
  /** How the last backup left the app (B-25): through the share sheet, or as a download. Absent for one made before this was kept. */
  lastExportVia?: 'share' | 'download';
  /** The `lastExportAt` of the backup whose own file was read back in Me → Data → Check a backup (B-25, D61). */
  lastCheckedExportAt?: string;
```

  - In `src/store/importCheck.ts`, in `HABIT_SPEC`, after `lastExportSeq`:

```ts
  lastExportVia: oneOf('share', 'download'),
  lastCheckedExportAt: text,
```

  - In `src/screens/you/backupFile.ts`, `settingsKey` also deletes `habits.lastExportVia` and `habits.lastCheckedExportAt`.

- [ ] **Step 4: The lines** `src/screens/you/dataStatus.ts`. `DataSheets.tsx`'s `size` moves here as `fileSize`.

```ts
/**
 * What Me → Data says about where the record is and how safe it is (journey
 * §6.5, §16; B-24, B-25), as plain lines. Pure, so each sentence is tested.
 */
import type { ImportPreview } from '@/store/transfer';
import type { HabitSettings } from '@/types/habits';
import type { InstallContext } from '@/screens/welcome/install';
import { shortDate } from './dates';

export type BackupState =
  | { kind: 'never' }
  | { kind: 'shared' | 'checked'; at: string; via?: 'share' | 'download' };

/**
 * The last backup, told apart (B-25): never made, handed over but not read
 * back, or checked. A cancelled share is none of these: it is never recorded.
 */
export function backupState(habits: Pick<HabitSettings, 'lastExportAt' | 'lastExportVia' | 'lastCheckedExportAt'> | undefined): BackupState {
  const at = habits?.lastExportAt;
  if (at === undefined) return { kind: 'never' };
  const via = habits?.lastExportVia;
  return { kind: habits?.lastCheckedExportAt === at ? 'checked' : 'shared', at, ...(via ? { via } : {}) };
}

export function backupLine(state: BackupState): string {
  if (state.kind === 'never') return 'Last backup: never';
  const how = state.via === 'share' ? 'shared ' : state.via === 'download' ? 'downloaded ' : '';
  return `Last backup: ${how}${shortDate(state.at)} · ${state.kind === 'checked' ? 'checked' : 'not checked'}`;
}

/** B-24's words for where the app is running. */
export function installStatus(context: InstallContext, device: string): { label: string; detail: string } {
  if (context === 'installed') return { label: 'Installed', detail: `Installing helps ${device === 'device' ? 'this device' : device} keep your data, but it isn’t a backup.` };
  if (context === 'iosBrowser') return { label: 'Not installed', detail: 'Safari may remove data from websites you haven’t opened for a while.' };
  return { label: 'In this browser', detail: 'Clearing this browser’s data would delete it. Back up now and then.' };
}

export function fileSize(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024)).toLocaleString()} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Storage used (§18.3), as the browser estimates it. */
export function storageLine(usage: number | undefined): string {
  return usage === undefined || !Number.isFinite(usage) || usage < 0 ? 'Not known in this browser' : `About ${fileSize(usage)}`;
}

export type CheckOutcome = 'latest' | 'other' | 'undated' | 'damaged';

/** A file read back: whole and the last backup's own snapshot, or why it isn't (B-25). */
export function checkOutcome(
  preview: Pick<ImportPreview, 'exportedAt' | 'rejected' | 'unreadableObservations' | 'unreadableFields'>,
  latest: string | undefined,
): CheckOutcome {
  const rejected = Object.values(preview.rejected ?? {}).reduce((n, k) => n + (k ?? 0), 0);
  if (rejected + preview.unreadableObservations + (preview.unreadableFields?.length ?? 0) > 0) return 'damaged';
  if (!preview.exportedAt) return 'undated';
  return preview.exportedAt === latest ? 'latest' : 'other';
}

export function checkedLine(outcome: CheckOutcome, made: string | undefined, latest: string | undefined, device: string): string {
  switch (outcome) {
    case 'latest': return `Checked. This is your latest backup, made ${shortDate(made ?? '')}, and it reads back whole.`;
    case 'damaged': return 'Parts of this file can’t be read, so it isn’t a whole backup. Make a new one.';
    case 'undated': return 'This file reads back, but it doesn’t say when it was made, so it can’t be matched to your latest backup.';
    case 'other': return latest
      ? `This file reads back, but it isn’t your latest backup: it was made ${shortDate(made ?? '')}, and your latest is from ${shortDate(latest)}.`
      : `This file reads back, but no backup has been made on this ${device} yet, so there is nothing to match it to.`;
  }
}
```

- [ ] **Step 5: The writes.** In `src/screens/you/write.ts`:
  - import `getState` beside `update`;
  - replace `recordExport` with the version below, then add `recordBackupCheck`:

```ts
/**
 * Remember what the last backup covered, for the monthly nudge: when its
 * snapshot was taken and that snapshot's stored revision, not when the file
 * happened to be handed over. Also how it left (B-25). A backup without a
 * revision clears an older one, so a new time never borrows an old backup's
 * coverage, and a new backup is not checked until its own file is read back.
 * This write is itself one stored change, which the nudge allows for.
 */
export function recordExport(mark: Required<Pick<BackupMark, 'at'>> & BackupMark & { via?: 'share' | 'download' }): Promise<StoreResult> {
  return changeHabits(habits => {
    const next: HabitSettings = { ...habits, lastExportAt: mark.at };
    if (mark.revision === undefined) delete next.lastExportSeq;
    else next.lastExportSeq = mark.revision;
    if (mark.via === undefined) delete next.lastExportVia;
    else next.lastExportVia = mark.via;
    if (next.lastCheckedExportAt !== mark.at) delete next.lastCheckedExportAt;
    return next;
  });
}

/**
 * A backup file read back in Restore's preview (B-25, D61): the last
 * backup's own snapshot, so that backup is checked. Recording this is one
 * more stored change. When the backup's own mark is the only change since
 * its snapshot, the mark moves past this one too, so a check never reads as
 * new data to the nudge (`reminders/backup.ts`).
 */
export function recordBackupCheck(at: string): Promise<StoreResult> {
  const { revision, settings } = getState();
  const seq = settings.habits?.lastExportSeq;
  const onlyTheMark = seq !== undefined && revision === seq + 1;
  return changeHabits(habits => (habits.lastExportAt !== at ? habits : {
    ...habits,
    lastCheckedExportAt: at,
    ...(onlyTheMark && habits.lastExportSeq === seq ? { lastExportSeq: seq + 1 } : {}),
  }));
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/screens/you src/store/importCheck.test.ts`
Expected: PASS. The earlier `recordExport` tests still pass: a call with no `via` leaves none.

- [ ] **Step 7: The backup sheet tells its states apart.** In `src/screens/you/DataSheets.tsx`:
  - delete `size` and import `{ backupLine, backupState, fileSize } from './dataStatus'`;
  - add `getState` to the store import;
  - in `BackupBody`, add `const [handed, setHanded] = useState(false);`. Inside the effect's `.then`, set it back with `setHanded(false);` beside `setPrepared(...)`, because a new file hasn't left yet;
  - replace `hand` with:

```tsx
  const hand = async ({ file, exportedAt, revision }: Prepared) => {
    const delivered = await deliver(file);
    if (!delivered.ok) {
      setOutcome({ tone: 'error', text: delivered.failure.message });
      return;
    }
    if (delivered.value === 'cancelled') {
      // A known cancellation never advances the backup's status (B-25).
      setOutcome({ tone: 'status', text: `Not shared, so nothing has changed. ${backupLine(backupState(getState().settings.habits))}.` });
      return;
    }
    setHanded(true);
    // What the file covers, not the moment it was handed over.
    const saved = await recordExport({ at: exportedAt, revision, via: delivered.value });
    setOutcome(saved.ok
      ? { tone: 'status', text: delivered.value === 'share'
        ? 'Shared. Keep the file somewhere private, such as Files or iCloud Drive. To check it reads back, use Check a backup.'
        : 'Downloaded. You will find the file with your downloads. To check it reads back, use Check a backup.' }
      : { tone: 'error', text: `The file was made, but the date of this backup did not save. ${saved.failure.message}` });
  };
```

  - the line under the button says what the file is, and whether it has left:

```tsx
        <p aria-live="polite" className="numeric px-4 text-[length:var(--text-footnote)] text-muted-foreground">
          {file ? (handed ? `${file.name}, ${fileSize(file.size)}` : `Prepared: ${file.name}, ${fileSize(file.size)}. It hasn’t left this ${device} yet.`) : ''}
        </p>
```

- [ ] **Step 8: Delete everything asks twice.** In `DataSheets.tsx`, rewrite `DeleteBody` with two steps. `erase` and the counts are unchanged:

```tsx
function DeleteBody({ device, close }: { device: string; close: () => void }) {
  const state = useStore();
  const [step, setStep] = useState<'ask' | 'confirm'>('ask');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  const heading = useRef<HTMLParagraphElement>(null);
  const counts = recordCounts(state);
  const any = counts.readings + counts.sessions + counts.checkIns + counts.bodyMetrics + counts.personalRecords > 0;
  // The button pressed has gone: the second question takes focus (B-03).
  useEffect(() => { if (step === 'confirm') heading.current?.focus(); }, [step]);

  const erase = async () => {
    // (unchanged)
  };

  if (step === 'ask') {
    return (
      <>
        <p className="px-1 text-[length:var(--text-title-2)] font-semibold leading-snug">Delete everything on this {device}?</p>
        <p className="px-1 text-[length:var(--text-body)] leading-snug">
          This deletes everything the app keeps here: your profile and health answers{any ? `, ${countsSentence(counts)}` : ''}, your food preferences, your reminders and your settings. The app then starts again as new.
        </p>
        <p className="px-1 text-[length:var(--text-body)] font-medium leading-snug">It cannot be undone. If you might want any of it later, back up first.</p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setStep('confirm')}
            className="press-feedback min-h-[3.25rem] w-full rounded-xl bg-stop-fill px-4 text-[length:var(--text-body)] font-semibold text-white"
          >
            Delete everything
          </button>
          <PlainButton onClick={close}>Keep my record</PlainButton>
        </div>
      </>
    );
  }
  return (
    <>
      <p ref={heading} tabIndex={-1} className="px-1 text-[length:var(--text-title-2)] font-semibold leading-snug outline-none">Erase all of it?</p>
      <p className="px-1 text-[length:var(--text-body)] leading-snug">
        This is the last step. Everything the app holds on this {device} goes, and only a backup can bring it back.
      </p>
      <div className="flex flex-col gap-2">
        {problem && <Notice tone="error">{problem}</Notice>}
        <button
          type="button"
          disabled={busy}
          onClick={() => void erase()}
          className="press-feedback min-h-[3.25rem] w-full rounded-xl bg-stop-fill px-4 text-[length:var(--text-body)] font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Erasing…' : 'Erase all'}
        </button>
        <PlainButton disabled={busy} onClick={close}>Keep my record</PlainButton>
      </div>
    </>
  );
}
```

Add `useRef` to the `react` import.

- [ ] **Step 9: Check a backup, through Restore's preview.** In `src/screens/you/RestoreFlow.tsx`:
  - **Props:** add `purpose = 'restore'` to the destructured props, and to their type:

```ts
  /**
   * `check` (Me → Data → Check a backup; B-25, D61): read the file back and
   * say whether it is the latest backup, whole. That mark is the only thing
   * written.
   */
  purpose?: 'restore' | 'check';
```

  - **Stage:** add a member: `| { kind: 'checked'; preview: ImportPreview; outcome: CheckOutcome; latest?: string }`.
  - **Imports:**
    - `import { checkOutcome, checkedLine, type CheckOutcome } from './dataStatus';`;
    - add `recordBackupCheck` to the import from `./write`.
  - **Inside the component, before `read`:**

```ts
  /** B-25: a backup is checked once its own file reads back here, whole. Any other file is reported, and nothing is written. */
  const check = async (preview: ImportPreview): Promise<Stage> => {
    const latest = getState().settings.habits?.lastExportAt;
    const outcome = checkOutcome(preview, latest);
    const checked: Stage = { kind: 'checked', preview, outcome, ...(latest ? { latest } : {}) };
    if (outcome !== 'latest' || !preview.exportedAt) return checked;
    const saved = await recordBackupCheck(preview.exportedAt);
    return saved.ok ? checked : { kind: 'problem', message: `The file reads back, but the check did not save. ${saved.failure.message}` };
  };
```

  - **In `read`:** replace `setStage(preview.ok ? { kind: 'preview', raw, preview } : { kind: 'problem', message: preview.reason });` with:

```ts
      if (!preview.ok) {
        setStage({ kind: 'problem', message: preview.reason });
        return;
      }
      if (purpose === 'check') {
        const next = await check(preview);
        if (selection.isCurrent(token)) setStage(next);
        return;
      }
      setStage({ kind: 'preview', raw, preview });
```

  - **The `Sheet`:** keep `<Sheet open={open} dismissible={!locked}` as written, because `shell.node.test.ts` reads it. Its `title` becomes `{purpose === 'check' ? 'Check a backup' : 'Restore from a backup'}`.
  - **Inside the `Sheet`, after the problem stage:**

```tsx
        {stage.kind === 'checked' && (
          <>
            <Notice>{checkedLine(stage.outcome, stage.preview.exportedAt, stage.latest, device)}</Notice>
            <Group header="In this file">
              {previewLines(stage.preview).map(line => <Row key={line.label} label={line.label} value={line.count.toLocaleString()} numeric />)}
            </Group>
            <PrimaryButton onClick={close}>Done</PrimaryButton>
          </>
        )}
```

- [ ] **Step 10: The Data screen.** In `src/screens/you/DataScreen.tsx` (titled "Data" since Task 7):
  - **Imports:**
    - `{ backupLine, backupState, installStatus, storageLine } from './dataStatus'`;
    - `privacyLine` from `./summaries`;
    - `FileCheckIcon` and `MapIcon` from lucide;
    - `useEffect` from `react`;
    - remove `shortDate` and `plural` if they're no longer used.
  - **After the counts:**

```tsx
  const backup = backupState(settings.habits);
  const install = installStatus(context, device);
  // Storage used (§18.3), as the browser estimates it, again after each stored change.
  const [usage, setUsage] = useState<number>();
  useEffect(() => {
    let live = true;
    navigator.storage?.estimate?.().then(e => { if (live) setUsage(e.usage); }, () => {});
    return () => { live = false; };
  }, [state.revision]);
```

  - **The "On this {device}" group:**
    - its footer becomes `privacyLine(device)`;
    - after "Your record", add `<Row label="Storage used" value={storageLine(usage)} />` and `<Row label={install.label} detail={install.detail} />`;
    - "Kept safe" keeps its label and value. Its detail becomes `persisted ? \`This ${device} has agreed to keep the app’s data.\` : 'This browser may clear it to make room. Back up now and then.'`;
    - delete `protection`;
    - "Works offline" and "Add to Home Screen" stay as they are.
  - **The "Backups" group:**
    - "Back up your record" keeps its label, which `data.mjs` finds it by. Its detail becomes `nudge.due ? <span className="text-caution">{\`${backupLine(backup)}. Time for a new one.\`}</span> : backupLine(backup)`;
    - before "Restore from a backup", add:

```tsx
        <RestoreFlow
          place="you"
          purpose="check"
          trigger={pick => <Row onClick={pick} icon={<FileCheckIcon />} label="Check a backup" detail="Read a backup file back, to see it is whole. Nothing changes." chevron />}
        />
```

    - its footer becomes: `` `A backup is one file you keep somewhere safe, such as Files or iCloud Drive. Check it reads back with Check a backup. The app suggests one every ${BACKUP_EVERY_DAYS} days when there is something new.` ``
  - **Before the delete group**, add this, unless Plan 6 has already put its walk and map settings in this screen:

```tsx
      {/* Plan 6 replaces this group with the walk and map settings, and "Erase all routes" (journey §16 Data). */}
      <Group header="Walks and maps">
        <Row icon={<MapIcon />} label="Routes and map pictures" detail="Not in this version yet. Walks keep no route, so there is nothing to show or delete." />
      </Group>
```

  - **The delete group's footer:** `` `Deletes everything the app holds on this ${device} and starts again. It asks twice.` ``

In `MeHome.tsx`, the Data row's detail becomes:
- `nudge.due ? <span className="text-caution">{\`${backupLine(backup)}. Time for a new one.\`}</span> : backupLine(backup)`;
- with `const backup = backupState(settings.habits);`;
- importing `backupLine` and `backupState` from `./dataStatus`.

Delete `lastBackup` and the `shortDate` import.

- [ ] **Step 11: The acceptance helpers and journeys.**
  - **`lib/data.mjs`:**
    - in `logical()` and `logicalFromDoc()`, under `ignoreExportDate`, also delete `settings.habits.lastExportVia` and `settings.habits.lastCheckedExportAt`. These are the record of backups, which `settingsKey` leaves out too;
    - add after `chooseRestore`:

```js
/** Me → Data → Check a backup with `file`; returns its sheet (B-25). */
export async function chooseCheck(t, file) {
  const page = t.page;
  const main = await openData(t);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 10000 }), ui.tap(ui.row(main, 'Check a backup'))]);
  await chooser.setFiles(file);
  const sheet = page.getByRole('dialog', { name: 'Check a backup' });
  await sheet.waitFor({ timeout: 15000 });
  await page.waitForTimeout(300);
  return sheet;
}
```

  - **`journeys/j18.mjs`, steps 7 and 8:** Delete everything asks twice now. After each `await ui.tap(ui.button(sheet, 'Delete everything'));`, add `await ui.tap(ui.button(sheet, 'Erase all'));`. In step 7 the fault is already set before the first tap, so it fires on "Erase all". Nothing else changes.
  - **`journeys/j19.mjs`, the share-cancelled case:** the row's check becomes `/Last backup: never/` (B-24, B-25). Its failure message stays as it is.
  - **`journeys/m01.mjs`:** add this case, and add `deleteTwice` to `cases`:

```js
const deleteTwice = {
  name: 'Delete everything asks twice',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/me/data' });
    const main = page.getByRole('main');
    await t.step(1, 'Delete everything → the first answer erases nothing → Keep my record', async () => {
      const before = await t.db();
      await ui.tap(ui.row(main, 'Delete everything on this device'));
      const sheet = ui.sheet(page, 'Delete everything');
      await ui.tap(ui.button(sheet, 'Delete everything'));
      await ui.button(sheet, 'Erase all').waitFor();
      await t.checkpoint('delete-second-ask');
      await t.check(data.sameSnapshot(before, await t.db()).length === 0, 'the first confirmation changed the record');
      await ui.tap(ui.button(sheet, 'Keep my record'));
      await sheet.waitFor({ state: 'hidden' });
      await t.check(data.sameSnapshot(before, await t.db()).length === 0, 'Keep my record changed the record');
      await t.check(await t.route() === '/me/data', `Keep my record left Data for ${await t.route()}`);
    });
  },
};
```

- [ ] **Step 12: Write V-J35** `scripts/e2e/acceptance/journeys/v35.mjs`

```js
/**
 * V-J35: a backup cancelled at the share sheet, then made, checked and
 * restored exactly (journey §17.2 V-J35, §16 Data, B-25). A known
 * cancellation never advances the backup's status, and "Checked" means the
 * file was read back.
 */
import { docs } from '../lib/harness.mjs';
import { persona } from '../fixtures/personas.mjs';
import * as data from '../lib/data.mjs';
import * as ui from '../lib/ui.mjs';

export const id = 'V-J35';
export const title = 'Backup cancelled, then made, checked and restored exactly';
export const safety = false;

const flat = s => s.replace(/[  ]/g, ' ').replace(/\s+/g, ' ');
const backupRow = async t => flat(await ui.row(await data.openData(t), 'Back up your record').innerText());

/** From here on the share sheet takes the file, as capabilityInit's `capture` does. */
function shareCaptures() {
  window.__acc = window.__acc || {};
  window.__acc.shares = [];
  navigator.canShare = () => true;
  navigator.share = async d => {
    const files = [];
    for (const f of d?.files ?? []) files.push({ name: f.name, type: f.type, bytes: Array.from(new Uint8Array(await f.arrayBuffer())) });
    window.__acc.shares.push({ files });
  };
}

export const cases = [{
  name: 'cancel, share, check, restore',
  async run(t) {
    const page = await t.open({ seed: persona('P01'), route: '/home', capabilities: { share: 'cancel' } });
    let file;
    let doc;
    await t.step(1, 'Me → Data: never backed up', async () => {
      const row = await backupRow(t);
      await t.check(/Last backup: never/.test(row), `the backup row says “${row}”`);
      await t.checkpoint('data-never');
    });
    await t.step(2, 'Back up → Save or share → cancelled at the share sheet', async () => {
      const before = await t.db();
      const made = await data.backup(t, { expectVia: 'share' });
      await t.check(made.via === 'none', `a cancelled share delivered a file (${made.via})`);
      await t.check(/Not shared, so nothing has changed\. Last backup: never\./.test(made.said), `the sheet said “${made.said.slice(0, 240)}”`);
      await t.check(/Prepared: .+\. It hasn’t left this device yet\./.test(made.said), 'the sheet does not say the file is only prepared');
      await t.check(data.sameSnapshot(before, await t.db()).length === 0, 'the cancelled share changed the record');
      const row = await backupRow(t);
      await t.check(/Last backup: never/.test(row), `after the cancelled share the row says “${row}”`);
    }, { input: 'navigator.share rejects with AbortError' });
    await t.step(3, 'Back up again, and this time share it', async () => {
      await page.evaluate(shareCaptures);
      const made = await data.backup(t, { expectVia: 'share' });
      await t.must(made.via === 'share' && !!made.bytes, `the share took no file (${made.via})`);
      await t.check(/Shared\. Keep the file somewhere private/.test(made.said), `no “Shared” confirmation: ${made.said.slice(0, 200)}`);
      doc = data.decodeBackup(made.bytes);
      file = data.writeFixture(t, made.name, made.bytes);
      const habits = docs(await t.db()).settings?.habits ?? {};
      await t.check(habits.lastExportAt === doc.exportedAt && habits.lastExportVia === 'share' && habits.lastCheckedExportAt === undefined, `the ledger reads ${JSON.stringify(habits)}`);
      const row = await backupRow(t);
      await t.check(/Last backup: shared 8 Oct 2026 · not checked/.test(row), `the row says “${row}”`);
      await t.checkpoint('data-shared');
    });
    await t.step(4, 'Check a backup → that file: checked, and nothing else changed', async () => {
      const before = await t.db();
      const sheet = await data.chooseCheck(t, file);
      const said = flat(await sheet.innerText());
      await t.check(/Checked\. This is your latest backup, made 8 Oct 2026, and it reads back whole\./.test(said), `the check said “${said.slice(0, 240)}”`);
      await ui.tap(ui.button(sheet, 'Done'));
      await sheet.waitFor({ state: 'hidden' });
      const after = await t.db();
      const diffs = data.compareLogical(data.logical(before, { ignoreExportDate: true }), data.logical(after, { ignoreExportDate: true }));
      await t.check(diffs.length === 0, `checking changed the record: ${diffs.slice(0, 4).join(' | ')}`);
      await t.check(docs(after).settings?.habits?.lastCheckedExportAt === doc.exportedAt, 'the check was not recorded');
      const row = await backupRow(t);
      await t.check(/Last backup: shared 8 Oct 2026 · checked/.test(row), `the row says “${row}”`);
      await t.checkpoint('data-checked');
    });
    await t.step(5, 'Add a reading, then restore that backup: the record is exactly the file', async () => {
      await data.logGlucose(t, { value: 130 });
      const sheet = await data.chooseRestore(t, file);
      await ui.tap(sheet.getByRole('button', { name: /^Replace everything here$|^Replace with this backup$/ }));
      await ui.tap(ui.button(sheet, 'Replace everything'));
      await data.waitOutcome(t, sheet);
      await ui.tap(ui.button(sheet, 'Done'));
      await t.reload();
      const now = await t.checkpoint('restored');
      const diffs = data.compareLogical(data.logicalFromDoc(doc, { ignoreExportDate: true }), data.logical(now, { ignoreExportDate: true }), { label: ['backup', 'device'] });
      await t.check(diffs.length === 0, `after restoring, the record is not the backup: ${diffs.slice(0, 6).join(' | ')}`);
      await t.check(!(now.observations ?? []).some(o => o.kind === 'glucose' && o.value === 130), 'the reading added after the backup survived the restore');
    }, { input: 'glucose 130 mg/dL; Replace with the shared backup' });
  },
}];
```

- [ ] **Step 13: Check by eye.** Use 430×932 and 320×568 at 200% text:
  - Data's rows wrap;
  - Delete everything's second question takes focus, and "Erase all" is the only stop-coloured fill;
  - Check a backup with a backup made a minute earlier says "Checked.";
  - with an older file, it says it isn't the latest.

- [ ] **Step 14: Gates, journeys, commit**

```bash
npx tsc -b && npm run lint && npx vitest run
npm run e2e:acceptance -- --only=V-J35,M01,J05,J11,J18,J19,J20 > /tmp/fit-checks/p4-t11.log 2>&1; tail -n 30 /tmp/fit-checks/p4-t11.log
git add src/types/habits.ts src/screens/you src/store/importCheck.ts src/store/importCheck.test.ts scripts/e2e/acceptance
git commit -m "feat: Tell a backup's states apart, check one by reading it back, and ask twice before erasing"
```

Expected: 0 failed. J18 is a safety journey. Its assertions are unchanged; only the second tap is new.

---

### Task 12: The full acceptance run, and the result on the board

**Files:**
- Modify: whatever a failure shows is wrong, the app or a journey's navigation
- Modify: `docs/reimagine/BOARD.md` (append)

**Interfaces:** none.

- [ ] **Step 1: Run the full suite**

Run: `npm run e2e:acceptance > /tmp/fit-checks/accept-v2-p4.log 2>&1; tail -n 40 /tmp/fit-checks/accept-v2-p4.log`

Expected: 0 failed and 0 pending.
- If Plans 2 and 3 have added no journeys, the total is 892 + 56 = 948 cases. This plan adds 14 cases (V-J08: 3, V-J12: 4, V-J35: 1, V-J39: 1, M01: 5), each in four projects.
- Otherwise it's the last run's total plus 56.

For each failure, decide whether it's a navigation or copy change (fix the journey's steps, and say so on the board) or a real regression (fix the app, with a unit test first where the rule is pure).

- [ ] **Step 2: Append the result to the board.** Use the text below. In the last paragraph, copy the figures as the run and the gates printed them.

```markdown
### 2026-10-10 — [claude] v2 Plan 4 (Browse and Me): built, and the acceptance run

**What changed in existing journeys** (navigation and copy only, A-76):
- `lib/data.mjs`:
  - `openData`: Me's row and screen are "Data" (were "Data & offline");
  - `logical()` leaves out `lastExportVia` and `lastCheckedExportAt` with the export date;
  - new: `chooseCheck`.
- `lib/guide.mjs`, `openHabits`: "Reminders" (was "Habits & reminders").
- `journeys/j17.mjs`: Display's theme group is "Theme" (was "Appearance").
- `journeys/j18.mjs`, steps 7 and 8: Delete everything asks twice, and the second tap is "Erase all".
- `journeys/j19.mjs`, the share-cancelled case: the row says "Last backup: never" (B-24, B-25).
- `journeys/j20.mjs`, step 2: Me's sections by their v2 names. Me is a tab, so the Home tab, not Done, returns to My Day.
- `journeys/s01.mjs`, step 6, and `run.mjs`'s warm-up: `/me/goals` and `/me/display`.

**New journeys:**
- V-J08, 3 cases;
- V-J12, 4 cases;
- V-J35, 1 case;
- V-J39, 1 case;
- M01, 5 cases.

**Result:**
- the run's summary line, as printed (cases, failed, pending, minutes);
- the unit suite's count and files, as `npx vitest run` printed them;
- `tsc -b` and lint clean.
```

- [ ] **Step 3: Commit**

```bash
git add docs/reimagine/BOARD.md scripts/e2e/acceptance src
git commit -m "test: Walk the acceptance journeys through Browse and Me"
```

---

### Task 13: Review and reconcile

**Files:** whatever the findings touch.

- [ ] **Step 1: Build the bundle and the prompt.**

```bash
BASE=$(cat /tmp/fit-checks/v2p4-base)
{
  cat docs/superpowers/plans/2026-10-10-fitstrong-v2-plan-4-browse-me.md
  git diff "$BASE"..HEAD -- src scripts/e2e/acceptance
} > /tmp/fit-checks/v2p4-bundle.md
cat > /tmp/fit-checks/v2p4-prompt.md <<'EOF'
Review FitStrong v2 Plan 4 (Browse and Me), statically, at maximum effort. The plan and the diff are in /tmp/fit-checks/v2p4-bundle.md; the spec is docs/superpowers/specs/2026-10-08-fitstrong-v2-journey-design.md (§5.1, §14, §15, §16, §20.4, §25 B-03 B-04 B-08 B-14 B-16 B-24 B-25) and docs/superpowers/specs/2026-10-08-fitstrong-v2-motion-design.md (M17 M18 M19 M23). Read the files the diff touches in full. Report each real bug as: id, severity, file:line, what a person would see, and a failing test (Vitest node, or an acceptance step) that would catch it. Look hardest at: changing Home before a layout is stored; a full group; the More menu under an urgent decision; the text size over a device's own size; a backup checked against the wrong file; calendar copies judged stale or fresh wrongly; Delete everything's two steps and focus; anything that computes a permission outside the engine. No style comments.
EOF
```

- [ ] **Step 2: Codex** (static, max effort):

```bash
codex exec -m openai.gpt-6.1-sol -c model_reasoning_effort='"max"' -c 'model_providers.amazon-bedrock.aws.region="us-east-1"' -s read-only -C "$PWD" -o /tmp/fit-checks/v2p4-codex.md - < /tmp/fit-checks/v2p4-prompt.md
```

- [ ] **Step 3: Kiro** (read-only), with the same prompt:

```bash
kiro-cli chat --no-interactive --trust-tools=fs_read --model claude-opus-5.5 "$(cat /tmp/fit-checks/v2p4-prompt.md)"
```

- [ ] **Step 4: Reconcile.**
  - Reproduce each finding with a failing test, then fix it. Commit one fix per finding or per tight group, with the finding ids in the message.
  - Log every finding and what happened to it on the board, under a new dated entry.
  - Run the gates and the full acceptance suite again, as in Task 12, and commit.

---

## Self-review

**1. Spec coverage**

| Spec | Where |
| --- | --- |
| §5.1, the registry: the "when" rules as `relevantCategories` | Task 2 |
| §5.1, categories vs shortcuts (B-14): shortcuts with only a target, Water in Check only, Learn with no trend | Task 2 (the trend landed with Plan 1's review) |
| §5.1, "a category that becomes relevant later is offered once" | Task 2 (`newlyRelevant`), Task 7 (`answerOffer`, the row) |
| §14, search over activities, readings, foods and Guide topics, grouped | Task 3 (index and aliases), Task 4 (screen) |
| §14, More → Add to Home or Remove from Home | Task 4 |
| §14, pick mode with Add, Added and Done | Task 5 |
| §15, "2 reminders" and the badge | Plan 1, untouched |
| §15, the closed-app copy | Task 10 |
| §15, calendar copies (A-78): ledger, "may be out of date" and how to replace them | Task 10, with D-01's notice kept where a habit is stopped (D67) |
| §15, quiet hours never hold safety | Task 10 (copy and a pinning test) |
| §16, Finish setting up | Task 6 (seam), Task 7 (rows) |
| §16, Profile & health | Task 7 (v1 screens behind the `/me/profile` seam, which each open chapter's `href` points into) |
| §16, Goals | Task 8, on Plan 2's B-16 module |
| §16, Food (shell) | Task 7 |
| §16, Reminders | Task 10 |
| §16, Voice & demos | Task 7 |
| §16, Display | Task 9, with `DisplayControls` for setup's first page |
| §16, Data | Task 11 |
| §16, About | Task 7 |
| §20.4 rules 1, 2 and 12 | Global Constraints, and every control named in its task |
| §20.4 rule 3 | Task 4 (More is a visible button) |
| §20.4 rule 6 | Task 11 ("Erase all") |
| §20.4 rule 9 | "Check is full (5)", "That did not save." and "Nothing matches…" |
| §20.4 rule 13 | ≤5 rows in Me's groups, with D58 for Browse |
| B-03 | Task 4 (`ActionMenu`), Task 7 (focus to the title), Task 11 (the second question takes focus) |
| B-04 | No new Undo, by D59. Edit Home's Undo is unchanged |
| B-08 | Global Constraints |
| B-16 | Task 8 reads Plan 2's module |
| B-24 | Task 7 (`privacyLine`), Task 11 (`installStatus`) |
| B-25 | Task 11 |
| M17 | Task 5: the added tile fades in |
| M18 | Task 4: `ActionMenu`, and closing under an urgent decision |
| M19 | Task 7: the plain toast. No timed Undo is added |
| M23 | Task 9 |
| V-J08 | Task 4 |
| V-J12 | Tasks 5 and 7 |
| V-J35 | Task 11 |
| V-J39 | Task 10 |
| M01 | Tasks 7–11 |

Out of scope, on purpose:
- the setup chapters' own pages, and "a changed medicine re-runs that chapter's follow-ups" (Plan 5, which also owns V-J10 and V-J11's setup half);
- Food's logging level and care-team target (Plan 7);
- the walk and map settings, and "Erase all routes" (Plan 6, which replaces Task 11's shell group);
- Recently deleted (Plan 8);
- the import limits behind V-J36 (Plan 8).

**2. Placeholder scan**
- I searched for TBD, TODO, "similar to", "add appropriate" and "handle edge cases": there are none.
- These values are filled in from a command's output, and each says so: Task 1's base commit, Task 12's run totals and Task 13's findings.
- Two steps move code word for word and name what moves: `useInertPage` and `EditButton`'s body. The programme block's move is written out in full in Task 8.
- The code was checked against the branch as it stands (head `b870bdd`), names, signatures and the source checks in `shell.node.test.ts` included. The Browse index was run against the real content in a scratch probe, and every expectation in Task 3's test held.

**3. Type consistency.** Each name is used as it is defined, across tasks:
- `relevantCategories(HomeAnswers)`, `newlyRelevant({ relevant, layout, offered })`, `SHORTCUTS: Record<BrowseGroupId, readonly Shortcut[]>` and `BROWSE_GROUPS`;
- `browse(query, ctx, mode)` → `BrowseResults { groups, partial }`;
- `storedLayout`, `useHomeLayout` → `{ layout, fallback, stored, relevant }`, `layoutNow`, `changeHome` → `{ next, saved } | undefined`, and `answerOffer` → `Promise<StoreResult> | undefined`;
- `ActionMenu<T extends MenuAnchor>({ target, describe, onClose, onClosed })`;
- `EditButton` with `control: Control | 'show' | 'pick' | 'later'`;
- `BrowseRows`, `PickRows`, `SearchField` and `Origin`;
- the editor's `picking`, `setPicking` and `openPick`;
- `CHAPTER_IDS` and `ChapterId` (`src/types/setup.ts`), `OpenChapter { chapter, label, detail, href, why }`, `setupProgress({ profile, settings })`, `finishTitle` and `notNow`, with `settings.setup.declined`;
- Plan 2's `weeklyGoalOn`, `pendingWeeklyGoal` and `weeklyMovementGoalHistory { from, goal? }`, plus `weeklyGoalChanges` and `stepsGoalChanges`;
- `goalsLine`, `pendingLine`, `weeklyGoalLines`, `stepsGoalLines` and `HistoryLine`;
- `TEXT_SCALES`, `TextScale`, `isTextScale`, `rootFontSize`, `applyTextScale` and `applyTextSize(doc, scale)`;
- `displayChoices`, `readSystemDisplay`, `TEXT_SIZE_CHOICES`, `displayLine`, `fadeTheme(change, reduced, doc?)`, `changeDisplay` and `DisplayControls`;
- `calendarCopies`, `staleCalendarCopies` and `StaleCopy { habit, names, inCalendar, now }`;
- `copyLine`, `staleLine` and `privacyLine`;
- `backupState`, `backupLine`, `installStatus`, `fileSize`, `storageLine`, `checkOutcome`, `checkedLine` and `CheckOutcome`;
- `recordExport({ at, revision, via })`, `recordBackupCheck(at)` and RestoreFlow's `purpose`.

The names that tie the journeys to the UI are the strings given in Tasks 4–11, and each journey uses them exactly:
- the labels "More, Waist", "Add, Labs", "Not now, Your health", "I have deleted them" and "Erase all";
- the headings "Finish setting up · 1 short chapter" and "New for Home";
- the dialogs "Add to Home" and "Check a backup".

**4. Review Focus.** Each of the five lines has its test in the task that owns the code:
1. Task 4: `homeLayout.test.ts`, plus V-J12's case that opens at `/browse`;
2. Task 3;
3. Task 8;
4. Task 9;
5. Task 11.

These others were considered and are covered by a task's ordinary tests, so they aren't listed as focus:
- a full group in Browse and in Me (Tasks 4, 5 and 7);
- a calendar file made before times were kept (Task 10);
- Delete everything's first answer (M01);
- a bad imported value for each new field (`importCheck.test.ts`).
