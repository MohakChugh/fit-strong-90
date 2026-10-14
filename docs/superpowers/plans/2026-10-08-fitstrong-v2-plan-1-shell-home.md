# FitStrong v2 Plan 1: Shell and Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace v1's Today · Move · Track · Guide shell with v2's Home · Trends · Browse · Me. Home becomes the launch screen, with status, the Right now card, This week and grouped category tiles. Today's log moves to `/day/:date`, and every v1 address redirects to its v2 place.

**Architecture:**
- A category registry (`src/categories.ts`) is the single source for tiles, hubs, trends, Browse and routes.
- The rules are pure modules, each with its own unit tests: default tiles, tile copy, layout edits, redirects and motion maths.
- Home is a refactor of v1's `TodayScreen`, which keeps all its decision logic (the frozen recommendation, sheets, saved progress) and changes the layout.
- Hubs are interim in this plan: v1's screens are mounted at the v2 addresses. Plan 2 replaces them.
- The navigation stack (`navigation.ts`) is generalised to the new tabs. Its behaviour (places, roots, Back) is unchanged.

**Tech stack:** React 19, TypeScript (strict, erasableSyntaxOnly), Vite 8, Tailwind v4, React Router 7.13 hash data router, IndexedDB store, Vitest (node environment), and the Playwright-core acceptance suite (`npm run e2e:acceptance`).

**Spec:** `docs/superpowers/specs/2026-10-08-fitstrong-v2-journey-design.md` (cited as J§) and `docs/superpowers/specs/2026-10-08-fitstrong-v2-motion-design.md` (cited as M-numbers). Read both before starting. The roadmap is `docs/superpowers/plans/2026-10-08-fitstrong-v2-roadmap.md`.

## Global Constraints

- Work on branch `feat/v2-journey`. Never push to `main`. Commit after each task with a conventional message.
- **Local-only:** no new network requests, no new dependency, no API keys.
- **Safety:** the engine alone decides every start, resume and continuation (J§4).
  - A tile, hub or link never computes its own permission. It calls `permission(...)` through `useStartMovement().permissionFor(mode)`, and starts only through `useStartMovement().start(...)`.
- **Urgent first (motion rule 2):**
  - an emergency, stop or hold renders in the first frame, with no entrance animation;
  - a transition into a screen that shows one is skipped.
- **Labels:**
  - every control has a visible text label;
  - every tappable thing is at least 44×44 px; primary buttons and tiles are at least 60 px tall;
  - body text is 17 px, using the existing `--text-body` token;
  - text up to 200% must work.
- **Tile columns:** two columns at 375 px wide and above with text at 130% or less; otherwise one column (J§7.1).
- **Reduced motion:** the system setting OR the in-app `settings.display.reduceMotion`. Either replaces motion with 200 ms fades, and values are set instantly (motion rule 4).
- **Glass** only on the tab bar, nav bars and sheet headers. It's solid when:
  - `settings.display.reduceTransparency` is on;
  - `prefers-contrast: more` is set;
  - `backdrop-filter` isn't supported;
  - a view transition is running (`data-vt-running`).
- **Copy:** Indian English, sentence case, verbs on buttons. Exact strings are given in each task.
- **Tests:** Vitest runs in the node environment (`src/**/*.test.ts`), so components aren't unit-rendered. Put every rule in a pure function with its own test. Screen behaviour is proven by the acceptance suite.
- **Gates before every commit:** `npx tsc -b`, `npm run lint` and `npx vitest run` must all pass.

## Review Focus

These are failure modes the spec implies that no single task's tests would naturally exercise. Each has a test added to the task that owns its code.

1. **A hold on one mode only.** A foot ulcer holds Walk, but Stretch is allowed. The Walk tile must say "No walking for now" while the Stretch tile reads normally. Task 3 has a test for this, using the real `permission()` with persona P05's profile.
2. **A redirect that drops its query, or lands on a blank screen.** `/walk?meal=dinner` must arrive at `/hub/walk?meal=dinner`, and an unknown address must land on Home with "That page has moved". Task 7 has a test for each.
3. **An emergency while Unwell.** The tile says "Not today", not "Paused": emergency outranks status. Task 3 has a test for this.
4. **Delete a record, then tap the Home tab.** It must not reopen the deleted record's screen (J18, `setPlaceCheck`). Task 6 keeps the existing test and adds the same case for a `/hub/...` place.
5. **In-app Reduce motion while the system setting is off.** Router navigations must not animate. Task 4 has a test of the `shouldAnimate` decision, which `main.tsx` uses.

---

## File map

| File | Responsibility |
| --- | --- |
| `src/categories.ts` (new) | The category registry and `defaultHome()` |
| `src/categories.test.ts` (new) | Registry integrity, and default layouts per persona |
| `src/screens/home/tileLine.ts` (new) | The live line on a movement tile, from the gate and the status (J§7.5) |
| `src/screens/home/tileLine.test.ts` (new) | The copy table, including the Review Focus cases |
| `src/screens/home/layout.ts` (new) | Pure Edit Home operations: hide, show, move up, move down |
| `src/screens/home/layout.test.ts` (new) | Those operations |
| `src/screens/home/HomeScreen.tsx` (new) | Home: v1 Today's logic in the v2 layout |
| `src/screens/home/Tile.tsx`, `TileGrid.tsx`, `WeekCard.tsx`, `StatusButton.tsx`, `UrgentBanner.tsx`, `EditHome.tsx` (new) | Home's parts |
| `src/screens/home/routes.tsx` (new) | `/home/*` |
| `src/design/motion.ts` (new) | Motion tokens, spring maths, `shouldAnimate` |
| `src/design/motion.test.ts` (new) | Spring values and the `linear()` tokens |
| `src/design/contrast.ts` (new) | WCAG contrast for OKLCH colours, moved from `shell.node.test.ts` |
| `src/design/tokens.node.test.ts` (new) | Category colours and glass text contrast |
| `src/hooks/useReducedMotion.ts` (modify) | Also read the in-app setting |
| `src/index.css` (modify) | Category colours, the glass recipe, solid fallbacks, the in-app reduced-motion twin |
| `src/types/index.ts` (modify) | `UserSettings.display`, `UserSettings.home` |
| `src/components/hig/navigation.ts` and `navigation.test.ts` (modify) | Tabs `home`, `trends`, `browse` and `me` |
| `src/components/hig/TabBar.tsx` (modify) | `GlassTabBar`: four labelled tabs, floating capsule |
| `src/components/hig/AppShell.tsx` (modify) | Padding for the floating bar; `YouButton` removed |
| `src/components/hig/Ring.tsx` (modify) | Never past 100% (no lap) |
| `src/routes.tsx` (modify) | The v2 tree, interim hubs, Trends, Browse and Me roots |
| `src/redirects.ts` and `src/redirects.test.ts` (new) | The complete v1 → v2 table, preserving queries |
| `src/health/recommend.ts` (modify) | `HREF` to v2 addresses |
| `src/screens/day/routes.tsx` (new) | `/day/:date` → v1's `MyDay`, with the date from the path |
| `src/screens/browse/BrowseScreen.tsx` (new) | The interim Browse: the registry, grouped, and a simple search |
| `src/main.tsx` (modify) | `shouldAnimate`, and `data-vt-running` around view transitions |
| `src/App.tsx` (modify) | Reflect the in-app display settings onto `<html>` |
| `scripts/e2e/acceptance/lib/ui.mjs` and the journeys (modify) | Tab names and paths for v2 navigation |
| `docs/reimagine/BOARD.md` (modify) | V1–V8, the research decisions, the branch decision |

---

### Task 1: Branch and board decisions

**Files:**
- Modify: `docs/reimagine/BOARD.md` (append)

**Interfaces:** none.

- [ ] **Step 1: Create the branch**

```bash
git checkout feat/reimagine-holistic-health
git status --short   # must be clean except untracked docs; the R5 fixes are already committed
git checkout -b feat/v2-journey
```

- [ ] **Step 2: Append the decisions to the board.** The text below is exact. Add it at the end of `docs/reimagine/BOARD.md`.

```markdown
### 2026-10-08 — [claude] v2 journey: decisions recorded before building

From the owner's brief, reconciled with the Codex and Kiro audits (`docs/superpowers/specs/2026-10-08-fitstrong-v2-audit-log.md`):

| # | Decision | Reverses |
| --- | --- | --- |
| D37 (V1) | One setup flow captures everything; page 1 offers "Look around first" | v1 Welcome |
| D38 (V2) | Home: greeting, status, Right now, This week, grouped tiles the person can show, hide and reorder | D5 "no icon grid", C5, and the rejection of pinning |
| D39 (V3) | Tabs: Home · Trends · Browse · Me, with labels always shown | D4 |
| D40 (V5) | Optional food logging at three levels, with no generated targets | D9 |
| D41 (V6) | Opt-in on-device routes, and opt-in OSM map pictures on summaries only, never while tracking | "route never stored" |
| D42 (V7) | Active kcal = (MET − 1) × kg × hours, labelled "about" | — |
| D43 (V8) | A category colour for icons, rings and charts; one action tint for controls | extends D12 |
| D44 | Map: no tiles while tracking; static OSM raster tiles on summaries; CSP `img-src https://tile.openstreetmap.org` | — |
| D45 | Food data: USDA FoodData Central (CC0) ingredients, our own recipes, gram portions, allergens tagged by us | — |
| D46 | v2 is built on `feat/v2-journey`; PR #3 stays v1 until v2 is complete | — |

Kept explicitly: D31 (weekly ring), D19 (no milestones), D18 (no WebGL while tracking), D35 (enrolment), D14 and D10 (steps), D16, D17, D22, D25, D26 and D27.
```

- [ ] **Step 3: Commit**

```bash
git add docs/reimagine/BOARD.md
git commit -m "docs: Record the v2 journey decisions on the board"
```

---

### Task 2: Category registry and default Home

**Files:**
- Create: `src/categories.ts`
- Create: `src/categories.test.ts`
- Modify: `src/types/index.ts` (add `HomeLayout` and `UserSettings.home`)

**Interfaces:**
- Produces:
  - `type CategoryId`, `type GroupId`, `type HubVariant`, `interface Category`;
  - `CATEGORIES: readonly Category[]`;
  - `categoryById(id): Category`;
  - `GROUPS: readonly { id: GroupId; title: string }[]`;
  - `defaultHome(input: { profile: UserProfile; settings: UserSettings; hasSteps: boolean }): HomeLayout`.
- In `src/types/index.ts`: `interface HomeLayout { order: Record<GroupId, CategoryId[]>; hidden: CategoryId[] }`, plus `UserSettings.home?: HomeLayout`.

- [ ] **Step 1: Add the types.** In `src/types/index.ts`, above `export interface UserSettings`:

```ts
/** v2 (journey §5.1): the categories Home can show, by group. */
export type CategoryId =
  | 'workout' | 'stretch' | 'walk' | 'steps'
  | 'food'
  | 'glucose' | 'bp' | 'back' | 'weight' | 'water' | 'sleep' | 'waist' | 'labs'
  | 'learn';
export type GroupId = 'move' | 'eat' | 'check' | 'learn';

/** v2: Home's tiles as the person arranged them. Absent until set up, when `defaultHome()` gives the first layout. */
export interface HomeLayout {
  /** Tiles shown, in order, per group. */
  order: Record<GroupId, CategoryId[]>;
  /** Tiles the person hid, so "Hidden" can offer them back. */
  hidden: CategoryId[];
}
```

Inside `UserSettings`, after `walkDefaults`:

```ts
  /** v2: Home's tile layout (journey §7.6). The person's edits always win over the defaults. */
  home?: HomeLayout;
```

- [ ] **Step 2: Write the failing test** `src/categories.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { CATEGORIES, GROUPS, categoryById, defaultHome } from './categories';
import { DEFAULT_PROFILE } from '@/types/profile';   // use the profile default the store uses; if the name differs, import the default from where useStore builds a new profile
import type { UserProfile } from '@/types/profile';
import type { UserSettings } from '@/types';

const settings = {} as UserSettings;
const withHealth = (h: Partial<UserProfile['health']>, extra: Partial<UserProfile> = {}): UserProfile =>
  ({ ...DEFAULT_PROFILE, ...extra, health: { ...DEFAULT_PROFILE.health, ...h } });

describe('category registry', () => {
  it('has each id once, in a known group, with a hub path and a title', () => {
    const ids = CATEGORIES.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CATEGORIES) {
      expect(GROUPS.map(g => g.id)).toContain(c.group);
      expect(c.hub).toBe(`/hub/${c.id}`);
      expect(c.title.length).toBeGreaterThan(0);
    }
  });
  it('gives movement modes only to Workout, Stretch and Walk', () => {
    expect(CATEGORIES.filter(c => c.mode).map(c => [c.id, c.mode])).toEqual([['workout', 'guided'], ['stretch', 'stretch'], ['walk', 'walk']]);
  });
  it('finds a category by id', () => {
    expect(categoryById('bp').title).toBe('Blood pressure');
  });
});

describe('defaultHome (journey §5.1)', () => {
  it('a person with no conditions: Move three, Food, then the fill-ins up to 9 total, never more than 5 per group', () => {
    const home = defaultHome({ profile: withHealth({}), settings, hasSteps: false });
    expect(home.order.move).toEqual(['workout', 'stretch', 'walk']);
    expect(home.order.eat).toEqual(['food']);
    expect(home.order.check).toEqual(['weight', 'sleep']);
    expect(home.order.learn).toEqual(['learn']);
    expect(home.hidden).toEqual([]);
  });
  it('diabetes, treated BP and back pain (P01-like): Glucose, Blood pressure and Back & leg in Check', () => {
    const p = withHealth({ diabetes: 'type2', hypertension: 'treated' }, { pain: { ...DEFAULT_PROFILE.pain, areas: ['lowerBack', 'sciatica'] } });
    const home = defaultHome({ profile: p, settings, hasSteps: false });
    expect(home.order.check.slice(0, 3)).toEqual(['glucose', 'bp', 'back']);
  });
  it('an active foot wound leaves Walk off Home (it would only ever say "No walking for now")', () => {
    const home = defaultHome({ profile: withHealth({ footStatus: 'current_wound_or_active_charcot' }), settings, hasSteps: false });
    expect(home.order.move).toEqual(['workout', 'stretch']);
  });
  it('Steps appears once a step goal is set or steps were ever recorded', () => {
    expect(defaultHome({ profile: withHealth({}), settings: { dailyStepsGoal: 6000 } as UserSettings, hasSteps: false }).order.move).toContain('steps');
    expect(defaultHome({ profile: withHealth({}), settings, hasSteps: true }).order.move).toContain('steps');
  });
  it('Water appears when the water habit is on', () => {
    const s = { habits: { water: { enabled: true, glassMl: 250, everyMinutes: 120, from: '09:00', to: '21:00' } } } as UserSettings;
    expect(defaultHome({ profile: withHealth({}), settings: s, hasSteps: false }).order.check).toContain('water');
  });
  it('never more than 9 tiles, and never more than 5 in a group', () => {
    const p = withHealth({ diabetes: 'type2', hypertension: 'treated', bpMonitor: true }, { pain: { ...DEFAULT_PROFILE.pain, areas: ['lowerBack'] } });
    const s = { dailyStepsGoal: 5000, habits: { water: { enabled: true, glassMl: 250, everyMinutes: 120, from: '09:00', to: '21:00' } } } as UserSettings;
    const home = defaultHome({ profile: p, settings: s, hasSteps: true });
    const all = Object.values(home.order).flat();
    expect(all.length).toBeLessThanOrEqual(9);
    for (const g of Object.values(home.order)) expect(g.length).toBeLessThanOrEqual(5);
  });
});
```

- [ ] **Step 3: Run it to check it fails**

Run: `npx vitest run src/categories.test.ts`
Expected: FAIL, "Cannot find module './categories'".

If `DEFAULT_PROFILE` isn't the export's name, find the default profile the store uses for a new person (`grep -rn "health: {" src/store src/types | head`), import that instead, and keep the test bodies the same.

- [ ] **Step 4: Write the module** `src/categories.ts`

```ts
/**
 * Every category the app has, once (journey §5.1). Home's tiles, the hubs,
 * Trends, Browse and the routes all read from here, so a category can't be
 * on Home without a hub or a trend (audit A-28).
 */
import { deriveHealth } from '@/engine/health';
import type { Mode } from '@/engine/permission';
import type { CategoryId, GroupId, HomeLayout, UserSettings } from '@/types';
import type { UserProfile } from '@/types/profile';

export type { CategoryId, GroupId } from '@/types';
export type HubVariant = 'movement' | 'reading' | 'food' | 'learn';

export interface Category {
  id: CategoryId;
  title: string;
  group: GroupId;
  variant: HubVariant;
  /** The movement this category starts, if any; its tile line comes from that mode's gate. */
  mode?: Mode;
  /** `/hub/{id}` */
  hub: string;
  /** CSS custom property holding the category colour (graphics) and its ink (text). */
  colour: string;
}

const c = (id: CategoryId, title: string, group: GroupId, variant: HubVariant, mode?: Mode): Category =>
  ({ id, title, group, variant, ...(mode ? { mode } : {}), hub: `/hub/${id}`, colour: `--cat-${id}` });

export const CATEGORIES: readonly Category[] = [
  c('workout', 'Workout', 'move', 'movement', 'guided'),
  c('stretch', 'Stretch', 'move', 'movement', 'stretch'),
  c('walk', 'Walk', 'move', 'movement', 'walk'),
  c('steps', 'Steps', 'move', 'reading'),
  c('food', 'Food', 'eat', 'food'),
  c('glucose', 'Glucose', 'check', 'reading'),
  c('bp', 'Blood pressure', 'check', 'reading'),
  c('back', 'Back & leg', 'check', 'reading'),
  c('weight', 'Weight', 'check', 'reading'),
  c('water', 'Water', 'check', 'reading'),
  c('sleep', 'Sleep', 'check', 'reading'),
  c('waist', 'Waist', 'check', 'reading'),
  c('labs', 'Labs', 'check', 'reading'),
  c('learn', 'Learn', 'learn', 'learn'),
];

export const GROUPS: readonly { id: GroupId; title: string }[] = [
  { id: 'move', title: 'Move' },
  { id: 'eat', title: 'Eat' },
  { id: 'check', title: 'Check' },
  { id: 'learn', title: 'Learn' },
];

const BY_ID = new Map(CATEGORIES.map(x => [x.id, x]));
export function categoryById(id: CategoryId): Category {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown category ${id}`);
  return found;
}

const MAX_TILES = 9;
const MAX_PER_GROUP = 5;
/** Added, in this order, until Home has 9 tiles (journey §5.1). */
const FILL_INS: CategoryId[] = ['weight', 'sleep', 'learn'];

/**
 * The first layout, from the setup answers (journey §5.1). Worked out once;
 * after that `settings.home` holds the person's own layout.
 */
export function defaultHome({ profile, settings, hasSteps }: { profile: UserProfile; settings: UserSettings; hasSteps: boolean }): HomeLayout {
  const h = profile.health;
  const derived = deriveHealth(h);
  const footHeld = h.footStatus === 'current_wound_or_active_charcot';
  const wanted: CategoryId[] = [
    'workout', 'stretch',
    ...(footHeld ? [] : ['walk' as const]),
    ...(settings.dailyStepsGoal !== undefined || hasSteps ? ['steps' as const] : []),
    'food',
    ...(derived.diabetic || h.diabetes === 'prediabetes' ? ['glucose' as const] : []),
    ...(h.hypertension !== 'none' || derived.onBpMeds || h.bpMonitor ? ['bp' as const] : []),
    ...(profile.pain.areas.length > 0 ? ['back' as const] : []),
    ...(settings.habits?.water?.enabled ? ['water' as const] : []),
  ];
  const order: Record<GroupId, CategoryId[]> = { move: [], eat: [], check: [], learn: [] };
  const place = (id: CategoryId) => {
    const group = categoryById(id).group;
    if (order[group].length >= MAX_PER_GROUP) return;
    if (Object.values(order).flat().length >= MAX_TILES) return;
    order[group].push(id);
  };
  wanted.forEach(place);
  for (const id of FILL_INS) place(id);
  return { order, hidden: [] };
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/categories.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 6: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/categories.ts src/categories.test.ts src/types/index.ts
git commit -m "feat: Add the category registry and Home's default tiles"
```

---

### Task 3: What a movement tile says

**Files:**
- Create: `src/screens/home/tileLine.ts`
- Create: `src/screens/home/tileLine.test.ts`

**Interfaces:**
- Consumes: `Permission` and `PERMISSION_TEXT` from `@/engine/permission`; `Status` from `@/health/status` (`'normal' | 'flare' | 'unwell' | 'away'`; check the export name in `src/health/status.ts` and use it).
- Produces:
  - `movementLine(input: { mode: Mode; permission: Permission; status: Status; normal: string }): { text: string; tone: 'normal' | 'caution' | 'stop' | 'quiet' }`;
  - `workoutNormal(input: { enrolled: boolean; label: string; minutes: number }): string`.

- [ ] **Step 1: Write the failing test** `src/screens/home/tileLine.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { PERMISSION_TEXT, permission, type Permission } from '@/engine/permission';
import { movementLine, workoutNormal } from './tileLine';
import { persona } from '../../../scripts/e2e/acceptance/fixtures/personas.mjs';   // if importing .mjs fixtures is awkward, build P05's health inline: footStatus 'current_wound_or_active_charcot', peripheralNeuropathy 'yes'

const base: Permission = { mode: 'walk', allowed: true, disposition: 'reassure', reasons: [], restrictions: [], needsCheckIn: false };

describe('movementLine (journey §7.5)', () => {
  it('allowed: the normal line', () => {
    expect(movementLine({ mode: 'walk', permission: base, status: 'normal', normal: 'After lunch · 10–15 min' })).toEqual({ text: 'After lunch · 10–15 min', tone: 'normal' });
  });
  it('allowed with changes: the normal line, then "with changes"', () => {
    const p = { ...base, disposition: 'adjust' as const, restrictions: ['No intervals.'] };
    expect(movementLine({ mode: 'guided', permission: p, status: 'normal', normal: 'Full Body B · 45 min' }).text).toBe('Full Body B · 45 min · with changes');
  });
  it('emergency or no exercise today: "Not today", even while unwell (Review Focus 3)', () => {
    const p = { ...base, allowed: false, disposition: 'emergency' as const, reasons: [PERMISSION_TEXT.emergencyTitle] };
    expect(movementLine({ mode: 'stretch', permission: p, status: 'unwell', normal: 'x' })).toEqual({ text: 'Not today', tone: 'stop' });
    expect(movementLine({ mode: 'stretch', permission: { ...p, disposition: 'today' }, status: 'normal', normal: 'x' }).text).toBe('Not today');
  });
  it('away or unwell: "Paused"', () => {
    expect(movementLine({ mode: 'walk', permission: base, status: 'away', normal: 'x' })).toEqual({ text: 'Paused', tone: 'quiet' });
    expect(movementLine({ mode: 'walk', permission: base, status: 'unwell', normal: 'x' }).text).toBe('Paused');
  });
  it('a hold uses the gate’s own headline', () => {
    const hold = (reason: string): Permission => ({ ...base, allowed: false, disposition: 'hold', reasons: [reason] });
    expect(movementLine({ mode: 'walk', permission: hold(PERMISSION_TEXT.footWalk), status: 'normal', normal: 'x' })).toEqual({ text: 'No walking for now', tone: 'caution' });
    expect(movementLine({ mode: 'walk', permission: hold(PERMISSION_TEXT.stale), status: 'normal', normal: 'x' }).text).toBe('Check glucose first');
    expect(movementLine({ mode: 'walk', permission: hold(PERMISSION_TEXT.healthUnreviewed), status: 'normal', normal: 'x' }).text).toBe('Answer a few questions first');
    expect(movementLine({ mode: 'walk', permission: hold('Something new the engine says.'), status: 'normal', normal: 'x' }).text).toBe('Not now: open to see why');
  });
  it('flare-up: v1 plans gentler workouts and stretches; walking has no flare plan, so its line is unchanged (L-08)', () => {
    expect(movementLine({ mode: 'guided', permission: base, status: 'flare', normal: 'x' }).text).toBe('Gentle only today');
    expect(movementLine({ mode: 'stretch', permission: base, status: 'flare', normal: 'x' }).text).toBe('Gentle stretch');
    expect(movementLine({ mode: 'walk', permission: base, status: 'flare', normal: 'Just a walk' }).text).toBe('Just a walk');
  });
  it('a hold that only needs today’s check-in keeps the normal line and says so (L-03)', () => {
    const p = { ...base, allowed: false, disposition: 'hold' as const, reasons: [PERMISSION_TEXT.noCheckIn], needsCheckIn: true };
    expect(movementLine({ mode: 'guided', permission: p, status: 'normal', normal: 'Full Body B · 45 min' })).toEqual({ text: 'Full Body B · 45 min · check in first', tone: 'normal' });
    const stale = { ...p, reasons: [PERMISSION_TEXT.stale] };
    expect(movementLine({ mode: 'walk', permission: stale, status: 'normal', normal: 'Just a walk' }).text).toBe('Just a walk · check in first');
  });
  it('a profile gap says to finish setting up (L-03)', () => {
    const p = { ...base, allowed: false, disposition: 'hold' as const, reasons: [PERMISSION_TEXT.medicinesUnknown], needsCheckIn: false };
    expect(movementLine({ mode: 'stretch', permission: p, status: 'normal', normal: 'x' })).toEqual({ text: 'Finish setting up', tone: 'caution' });
  });
  it('the Workout tile’s normal line when not enrolled (D35, L-03)', () => {
    expect(workoutNormal({ enrolled: false, label: 'Full Body B', minutes: 45 })).toBe('12-week programme · not joined');
    expect(workoutNormal({ enrolled: true, label: 'Full Body B', minutes: 45 })).toBe('Full Body B · 45 min');
  });
  it('P05: a foot wound holds Walk only; Stretch reads normally (Review Focus 1)', () => {
    const profile = persona('P05').profile;   // adapt to the fixture's shape
    const now = new Date('2026-10-08T09:00:00');
    const walk = movementLine({ mode: 'walk', permission: permission({ profile, now }, 'walk'), status: 'normal', normal: 'Just a walk' });
    const stretch = movementLine({ mode: 'stretch', permission: permission({ profile, now }, 'stretch'), status: 'normal', normal: 'Back & hips · 10 min' });
    expect(walk.text).toBe('No walking for now');
    expect(stretch.text).not.toBe('No walking for now');
    expect(stretch.tone).not.toBe('stop');
  });
});
```

The last test uses a profile with no check-in. If P05's stretch permission is `needsCheckIn` (allowed but asks for a check-in first), the tile shows the normal line. That's correct: the Start opens the check-in.

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/screens/home/tileLine.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the module** `src/screens/home/tileLine.ts`

```ts
/**
 * The live line on a movement tile (journey §7.5). It always follows the
 * shared gate for that tile's mode, so a tile can never invite what its hub
 * would refuse (audit K-04, A-08). Emergency outranks status, and status
 * outranks a hold.
 */
import { PERMISSION_TEXT, type Mode, type Permission } from '@/engine/permission';
import type { Status } from '@/health/status';

export interface TileLine { text: string; tone: 'normal' | 'caution' | 'stop' | 'quiet' }

/** Short headlines for the gate's known reasons; anything new falls back to a pointer to the hub. */
const HOLD_HEADLINE = new Map<string, string>([
  [PERMISSION_TEXT.footWalk, 'No walking for now'],
  [PERMISSION_TEXT.stale, 'Check glucose first'],
  [PERMISSION_TEXT.staleNoTime, 'Check glucose first'],
  [PERMISSION_TEXT.future, 'Check the reading’s time'],
  [PERMISSION_TEXT.noCheckIn, 'Check in first'],
  [PERMISSION_TEXT.healthUnreviewed, 'Answer a few questions first'],
  [PERMISSION_TEXT.medicinesUnknown, 'Answer a few questions first'],
]);

/** v1 plans a recovery session and a gentler stretch during a flare; walking has no flare plan, so it keeps its line (L-08). */
const FLARE: Partial<Record<Mode, string>> = { guided: 'Gentle only today', stretch: 'Gentle stretch' };
/** Reasons a check-in (or a fresh glucose in it) answers: the tile keeps its line and the Start opens the check-in (L-03). */
const CHECK_IN_ONLY = new Set<string>([PERMISSION_TEXT.noCheckIn, PERMISSION_TEXT.stale, PERMISSION_TEXT.staleNoTime]);
const PROFILE_GAP = new Set<string>([PERMISSION_TEXT.healthUnreviewed, PERMISSION_TEXT.medicinesUnknown]);

export function movementLine({ mode, permission: p, status, normal }: { mode: Mode; permission: Permission; status: Status; normal: string }): TileLine {
  if (!p.allowed && (p.disposition === 'emergency' || p.disposition === 'today')) return { text: 'Not today', tone: 'stop' };
  if (status === 'away' || status === 'unwell') return { text: 'Paused', tone: 'quiet' };
  if (!p.allowed) {
    if (p.reasons.some(r => PROFILE_GAP.has(r))) return { text: 'Finish setting up', tone: 'caution' };
    if (p.needsCheckIn && p.reasons.length > 0 && p.reasons.every(r => CHECK_IN_ONLY.has(r))) return { text: `${normal} · check in first`, tone: 'normal' };
    const known = p.reasons.map(r => HOLD_HEADLINE.get(r)).find(Boolean);
    const recheck = p.release?.toLowerCase().includes('re-check') ? 'Waiting for your re-check' : undefined;
    return { text: known ?? recheck ?? 'Not now: open to see why', tone: 'caution' };
  }
  if (status === 'flare' && FLARE[mode]) return { text: FLARE[mode], tone: 'normal' };
  if (p.disposition === 'adjust' && p.restrictions.length > 0) return { text: `${normal} · with changes`, tone: 'normal' };
  return { text: normal, tone: 'normal' };
}

/** The Workout tile's own line: the programme's session, or that it hasn't been joined (D35). */
export function workoutNormal({ enrolled, label, minutes }: { enrolled: boolean; label: string; minutes: number }): string {
  return enrolled ? `${label} · ${minutes} min` : '12-week programme · not joined';
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/screens/home/tileLine.test.ts`
Expected: PASS.

If the P05 walk test shows a different first reason (for example a check-in reason before `footWalk`), keep the rule ("a hold uses the gate's own headline") and look up all of `p.reasons`, not only the first. The code above already does that. Don't change the engine.

- [ ] **Step 5: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/home/tileLine.ts src/screens/home/tileLine.test.ts
git commit -m "feat: Make movement tiles say what the gate says for their mode"
```

---

### Task 4: Motion module and the in-app Reduce motion

**Files:**
- Create: `src/design/motion.ts`
- Create: `src/design/motion.test.ts`
- Modify: `src/types/index.ts` (`UserSettings.display`)
- Modify: `src/hooks/useReducedMotion.ts`
- Modify: `src/App.tsx` (an effect that sets `data-reduce-motion` and `data-glass`)
- Modify: `src/main.tsx` (use `shouldAnimate`)
- Modify: `src/index.css` (an in-app twin of every `prefers-reduced-motion: reduce` rule)

**Interfaces:**
- Produces:
  - `MOTION` (tokens);
  - `springAt(t: number, duration: number, bounce: number): number`;
  - `springLinear(bounce: number, steps = 24): string`;
  - `shouldAnimate(input: { systemReduced: boolean; appReduced: boolean }): boolean`;
  - `UserSettings.display?: { reduceMotion?: boolean; reduceTransparency?: boolean }`.

- [ ] **Step 1: Write the failing test** `src/design/motion.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { MOTION, shouldAnimate, springAt, springLinear } from './motion';

describe('springAt (Apple duration/bounce model; design research §4.1)', () => {
  it('starts at 0, ends at 1, never overshoots with bounce 0', () => {
    expect(springAt(0, 0.4, 0)).toBe(0);
    for (let t = 0; t <= 1.5; t += 0.01) expect(springAt(t, 0.4, 0)).toBeLessThanOrEqual(1 + 1e-9);
    expect(springAt(1.5, 0.4, 0)).toBeGreaterThan(0.999);
  });
  it('reaches about 90% at about 42% of the settle time at bounce 0', () => {
    // settle (0.1%) ≈ 1.47 × 0.4 s = 0.588 s; 42% of that ≈ 0.247 s
    expect(springAt(0.247, 0.4, 0)).toBeGreaterThan(0.87);
    expect(springAt(0.247, 0.4, 0)).toBeLessThan(0.93);
  });
  it('overshoots slightly at bounce 0.15, and never more than 1%', () => {
    let peak = 0;
    for (let t = 0; t <= 1.5; t += 0.002) peak = Math.max(peak, springAt(t, 0.4, 0.15));
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.01);
  });
});

describe('springLinear', () => {
  it('produces a CSS linear() list from 0 to 1', () => {
    const css = springLinear(0);
    expect(css.startsWith('linear(0,')).toBe(true);
    expect(css.endsWith(', 1)')).toBe(true);
  });
  it('matches the research token at bounce 0 within 0.01 at each step', () => {
    const research = [0, .058, .18, .321, .455, .573, .671, .75, .812, .86, .897, .924, .945, .96, .971, .979, .985, .989, .992, .994, .996, .997, .998, .999, 1];
    const mine = springLinear(0).slice('linear('.length, -1).split(',').map(Number);
    expect(mine).toHaveLength(research.length);
    mine.forEach((v, i) => expect(Math.abs(v - research[i])).toBeLessThan(0.01));
  });
});

describe('tokens', () => {
  it('has the spec’s durations', () => {
    expect(MOTION.fade).toBe(200);
    expect(MOTION.spring.cssMs).toBe(588);
    expect(MOTION.springQuick.cssMs).toBe(441);
  });
});

describe('shouldAnimate (motion rule 4; Review Focus 5)', () => {
  it('animates only when neither the system nor the app asks for less motion', () => {
    expect(shouldAnimate({ systemReduced: false, appReduced: false })).toBe(true);
    expect(shouldAnimate({ systemReduced: true, appReduced: false })).toBe(false);
    expect(shouldAnimate({ systemReduced: false, appReduced: true })).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/design/motion.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the module** `src/design/motion.ts`

```ts
/**
 * Motion tokens and spring maths (motion spec §3). Apple's (duration, bounce)
 * spring, mass 1: stiffness = (2π/d)², damping = 4π(1−bounce)/d, as the
 * design research works out from Apple's own example.
 */

/** Position of a spring released from 0 toward 1, at t seconds. */
export function springAt(t: number, duration: number, bounce: number): number {
  if (t <= 0) return 0;
  const w0 = (2 * Math.PI) / duration;          // natural frequency
  const zeta = 1 - bounce;                      // damping ratio
  if (zeta >= 1) return 1 - (1 + w0 * t) * Math.exp(-w0 * t);
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + (zeta * w0 / wd) * Math.sin(wd * t));
}

/** Time for the spring to settle within 0.1% of its target. */
function settle(duration: number, bounce: number): number {
  let last = 0;
  for (let t = 0; t < duration * 6; t += 0.001) if (Math.abs(1 - springAt(t, duration, bounce)) > 0.001) last = t;
  return last;
}

/** A CSS `linear()` easing that draws the spring, sampled evenly over its settle time. The shape depends only on bounce. */
export function springLinear(bounce: number, steps = 24): string {
  const d = 0.4;
  const total = settle(d, bounce);
  const points = Array.from({ length: steps + 1 }, (_, i) => (i === 0 ? 0 : i === steps ? 1 : Number(springAt((i / steps) * total, d, bounce).toFixed(3))));
  return `linear(${points.join(', ')})`;
}

const spring = (duration: number, bounce: number) => ({ duration, bounce, cssMs: Math.round(settle(duration, bounce) * 1000) });

export const MOTION = {
  instant: 100,
  fade: 200,
  fadeSlow: 300,
  countMax: 600,
  spring: spring(0.4, 0),
  springQuick: spring(0.3, 0),
  springRelease: spring(0.4, 0.15),
} as const;

/** Whether app-drawn motion runs: never when the system or the app asks for less. */
export function shouldAnimate({ systemReduced, appReduced }: { systemReduced: boolean; appReduced: boolean }): boolean {
  return !systemReduced && !appReduced;
}
```

If `MOTION.spring.cssMs` comes out as 587 or 589 rather than 588 because of the 1 ms step, assert `toBeCloseTo(588, -1)` in the test instead. Keep the research's figure in the comment.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/design/motion.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the setting.** In `UserSettings` (`src/types/index.ts`), after `home`:

```ts
  /** v2 (journey §16 Display): the app's own settings, because Safari doesn't report Reduce Transparency, and the system setting isn't everyone's choice. */
  display?: { reduceMotion?: boolean; reduceTransparency?: boolean };
```

- [ ] **Step 6: The hook reads both.** Replace the body of `src/hooks/useReducedMotion.ts`. Keep the comment, and add the in-app setting:

```ts
import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';

/** The system's "reduce motion", or the app's own setting (motion rule 4). */
export function useReducedMotion(): boolean {
  const appReduced = useStore().settings.display?.reduceMotion === true;
  const [systemReduced, setSystemReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setSystemReduced(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return systemReduced || appReduced;
}
```

If `useStore()` can't be called where this hook is used (for example outside the store's provider), check how `useStore` is consumed elsewhere. It's an external-store hook usable anywhere in the tree. Keep the hook's name and signature.

- [ ] **Step 7: Reflect the settings onto `<html>`.** In `src/App.tsx`, add an effect after the theme effect:

```tsx
  // The in-app display settings, for CSS and for the router (motion rule 4; journey §20.1).
  useEffect(() => {
    const root = window.document.documentElement;
    if (settings.display?.reduceMotion) root.dataset.reduceMotion = ''; else delete root.dataset.reduceMotion;
    if (settings.display?.reduceTransparency) root.dataset.glass = 'solid'; else delete root.dataset.glass;
  }, [settings.display?.reduceMotion, settings.display?.reduceTransparency]);
```

- [ ] **Step 8: The router and transitions honour it.** In `src/main.tsx`:
  - import `shouldAnimate` from `@/design/motion`;
  - replace `reduceMotion.matches` inside the `router.navigate` wrapper with `!shouldAnimate({ systemReduced: reduceMotion.matches, appReduced: document.documentElement.dataset.reduceMotion !== undefined })`;
  - in the `document.startViewTransition` wrapper, set `document.documentElement.dataset.vtRunning = ''` before calling `start(update)`, and remove it in `transition.finished.finally(...)`. This covers WebKit 302256.

```ts
    document.documentElement.dataset.vtRunning = ''
    const transition = start(update)
    transition.finished.finally(() => { delete document.documentElement.dataset.vtRunning })
```

- [ ] **Step 9: CSS twin for in-app reduced motion.** In `src/index.css`, for every `@media (prefers-reduced-motion: reduce) { … }` block, add the same rules under `:root[data-reduce-motion] …` selectors. Find them with `grep -n "prefers-reduced-motion" src/index.css`. Also make sure the `@media (prefers-reduced-motion: no-preference)` view-transition block doesn't apply when `data-reduce-motion` is set, by adding `:root[data-reduce-motion]::view-transition-old(root), :root[data-reduce-motion]::view-transition-new(root) { animation: fs-fade-in 0.2s linear both; }` after it. That's a fade, not nothing, per motion rule 4.

- [ ] **Step 10: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/design src/types/index.ts src/hooks/useReducedMotion.ts src/App.tsx src/main.tsx src/index.css
git commit -m "feat: Add motion tokens and an in-app Reduce motion setting"
```

---

### Task 5: Category colours and the glass recipe

**Files:**
- Create: `src/design/contrast.ts` (the OKLCH contrast helper, moved from `src/components/hig/shell.node.test.ts:544-561`)
- Modify: `src/components/hig/shell.node.test.ts` (import the helper instead of defining it)
- Create: `src/design/tokens.node.test.ts`
- Modify: `src/index.css`

**Interfaces:**
- Produces:
  - CSS custom properties `--cat-{id}` and `--cat-{id}-ink`, light and dark, for each `CategoryId`, plus `--cat-move` for the week ring;
  - the `.glass` class;
  - `contrast(a: [L, C, h], b: [L, C, h]): number`.

- [ ] **Step 1: Move the helper.** Create `src/design/contrast.ts` with `contrast` and `luminance`, copied unchanged from `shell.node.test.ts` and exported. Replace them in `shell.node.test.ts` with `import { contrast } from '@/design/contrast';`. Run `npx vitest run src/components/hig/shell.node.test.ts`: it should PASS, unchanged.

- [ ] **Step 2: Write the failing test** `src/design/tokens.node.test.ts`

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '@/categories';
import { contrast } from './contrast';

const css = readFileSync('src/index.css', 'utf8');
/** The value of a custom property inside the first block that starts with `selector`. */
function token(selector: string, name: string): [number, number, number] {
  const block = css.slice(css.indexOf(selector));
  const body = block.slice(0, block.indexOf('\n}'));
  const m = new RegExp(`${name}:\\s*oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\)`).exec(body);
  if (!m) throw new Error(`${name} not found under ${selector}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}
const THEMES = [[':root {', 'light'], ['.dark {', 'dark']] as const;

describe('category colours (journey §20.3)', () => {
  for (const [selector, theme] of THEMES) {
    const card = token(selector, '--grouped-card');
    for (const c of [...CATEGORIES.map(x => x.id), 'move']) {
      it(`${c} in ${theme}: graphics ≥ 3:1 and ink ≥ 4.5:1 on the card`, () => {
        expect(contrast(token(selector, `--cat-${c}`), card)).toBeGreaterThanOrEqual(3);
        expect(contrast(token(selector, `--cat-${c}-ink`), card)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe('glass recipe (journey §20.1)', () => {
  it('is defined with a solid fallback for the in-app setting, transitions, more contrast and no support', () => {
    expect(css).toMatch(/\.glass\s*\{[^}]*backdrop-filter:\s*blur\(16px\) saturate\(180%\)/);
    expect(css).toMatch(/:root\[data-glass="solid"\] \.glass/);
    expect(css).toMatch(/:root\[data-vt-running\] \.glass/);
    expect(css).toMatch(/@media \(prefers-contrast: more\)\s*\{\s*\.glass/);
    expect(css).toMatch(/@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)/);
  });
});
```

- [ ] **Step 3: Run it to check it fails**

Run: `npx vitest run src/design/tokens.node.test.ts`
Expected: FAIL (`--cat-workout not found`).

- [ ] **Step 4: Add the tokens.** In `src/index.css`:
  - inside the light `:root {` block that holds `--grouped-card` (around line 498), and the `.dark {` block (around line 519), add the values below;
  - check each pair with the test. If one fails, lower L (light ink) or raise L (dark ink) by 0.02 until it passes, keeping the hue;
  - add the matching `--color-cat-*` entries in the `@theme inline` block, the way `--color-grouped-card` is declared, so Tailwind classes like `text-cat-walk-ink` work.

```css
  /* v2 category colours (journey §20.3): graphics, then ink for text and icons. */
  --cat-move: oklch(0.6 0.2 30);        --cat-move-ink: oklch(0.5 0.18 30);
  --cat-workout: oklch(0.66 0.17 50);   --cat-workout-ink: oklch(0.5 0.14 45);
  --cat-stretch: oklch(0.6 0.11 190);   --cat-stretch-ink: oklch(0.46 0.09 190);
  --cat-walk: oklch(0.6 0.15 150);      --cat-walk-ink: oklch(0.45 0.12 150);
  --cat-steps: oklch(0.6 0.15 150);     --cat-steps-ink: oklch(0.45 0.12 150);
  --cat-food: oklch(0.7 0.15 75);       --cat-food-ink: oklch(0.5 0.11 70);
  --cat-glucose: oklch(0.56 0.17 300);  --cat-glucose-ink: oklch(0.46 0.16 300);
  --cat-bp: oklch(0.58 0.19 10);        --cat-bp-ink: oklch(0.48 0.18 10);
  --cat-back: oklch(0.56 0.16 320);     --cat-back-ink: oklch(0.46 0.15 320);
  --cat-weight: oklch(0.6 0.12 215);    --cat-weight-ink: oklch(0.46 0.1 215);
  --cat-waist: oklch(0.6 0.12 215);     --cat-waist-ink: oklch(0.46 0.1 215);
  --cat-water: oklch(0.6 0.15 240);     --cat-water-ink: oklch(0.46 0.13 245);
  --cat-sleep: oklch(0.52 0.15 275);    --cat-sleep-ink: oklch(0.44 0.14 275);
  --cat-labs: oklch(0.58 0.08 60);      --cat-labs-ink: oklch(0.44 0.07 60);
  --cat-learn: oklch(0.66 0.13 90);     --cat-learn-ink: oklch(0.46 0.1 85);
```

Dark block, the same names:

```css
  --cat-move: oklch(0.72 0.18 30);      --cat-move-ink: oklch(0.8 0.14 30);
  --cat-workout: oklch(0.75 0.16 55);   --cat-workout-ink: oklch(0.82 0.13 60);
  --cat-stretch: oklch(0.72 0.11 190);  --cat-stretch-ink: oklch(0.8 0.09 190);
  --cat-walk: oklch(0.74 0.15 150);     --cat-walk-ink: oklch(0.82 0.12 150);
  --cat-steps: oklch(0.74 0.15 150);    --cat-steps-ink: oklch(0.82 0.12 150);
  --cat-food: oklch(0.8 0.14 80);       --cat-food-ink: oklch(0.85 0.12 85);
  --cat-glucose: oklch(0.72 0.15 300);  --cat-glucose-ink: oklch(0.8 0.12 300);
  --cat-bp: oklch(0.72 0.16 10);        --cat-bp-ink: oklch(0.8 0.13 10);
  --cat-back: oklch(0.72 0.14 320);     --cat-back-ink: oklch(0.8 0.11 320);
  --cat-weight: oklch(0.75 0.11 215);   --cat-weight-ink: oklch(0.82 0.09 215);
  --cat-waist: oklch(0.75 0.11 215);    --cat-waist-ink: oklch(0.82 0.09 215);
  --cat-water: oklch(0.72 0.13 240);    --cat-water-ink: oklch(0.8 0.11 240);
  --cat-sleep: oklch(0.7 0.13 275);     --cat-sleep-ink: oklch(0.8 0.1 275);
  --cat-labs: oklch(0.74 0.07 60);      --cat-labs-ink: oklch(0.82 0.06 60);
  --cat-learn: oklch(0.8 0.12 95);      --cat-learn-ink: oklch(0.85 0.1 95);
```

- [ ] **Step 5: Add the glass recipe.** Append to `src/index.css`. The values are from the design research, §2.5.

```css
/* ==========================================================================
   Liquid Glass for the web (journey §20.1; design research §2.5).
   Navigation layer only: tab bar, nav bars, sheet headers, the player's
   control capsule. Never on content, never stacked, at most two on screen.
   ========================================================================== */
:root { --glass-fill: rgb(255 255 255 / .72); --glass-rim: rgb(255 255 255 / .55);
        --glass-hi: rgb(255 255 255 / .6); --glass-drop: 0 1px 2px rgb(0 0 0 / .08), 0 8px 24px rgb(0 0 0 / .12); }
.dark { --glass-fill: rgb(28 28 30 / .72); --glass-rim: rgb(255 255 255 / .14);
        --glass-hi: rgb(255 255 255 / .10); --glass-drop: 0 8px 24px rgb(0 0 0 / .5); }
.glass {
  background: var(--glass-fill);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid var(--glass-rim);
  box-shadow: inset 0 1px 0 var(--glass-hi), var(--glass-drop);
}
/* Solid: the in-app setting, while a view transition runs (WebKit 302256), more contrast, or no support. */
:root[data-glass="solid"] .glass,
:root[data-vt-running] .glass { background: var(--grouped-card); -webkit-backdrop-filter: none; backdrop-filter: none; }
@media (prefers-reduced-transparency: reduce) { .glass { background: var(--grouped-card); -webkit-backdrop-filter: none; backdrop-filter: none; } }
@media (prefers-contrast: more) { .glass { background: var(--grouped-card); -webkit-backdrop-filter: none; backdrop-filter: none; border-color: var(--foreground); box-shadow: none; } }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { .glass { background: var(--grouped-card); } }
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run src/design src/components/hig/shell.node.test.ts`
Expected: PASS. Adjust any failing colour as Step 4 describes.

- [ ] **Step 7: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/design src/components/hig/shell.node.test.ts src/index.css
git commit -m "feat: Add category colours and the Liquid Glass recipe"
```

---

### Task 6: The four v2 tabs in the navigation stack

**Files:**
- Modify: `src/components/hig/navigation.ts:24-31`
- Modify: `src/components/hig/navigation.test.ts` (rename tabs, keep every case)

**Interfaces:**
- Produces:
  - `type Tab = 'home' | 'trends' | 'browse' | 'me'`;
  - `TAB_ROOT = { home: '/home', trends: '/trends', browse: '/browse', me: '/me' }`;
  - Home also owns `/hub` and `/day`;
  - the tasks are `/session`, `/walk/live`, `/walk/summary` and `/setup`.

- [ ] **Step 1: Update the tests first.** In `navigation.test.ts`, replace every `'today'` tab with `'home'`, `'/today'` with `'/home'`, `'move'` with `'home'` and `'/move…'` with `'/hub/…'`, `'track'` with `'trends'` (and `'/track'` with `'/trends'`), and `'guide'` with `'browse'`. Keep each test's intent. Then add these cases:

```ts
it('a hub belongs to Home by its address', () => {
  expect(tabOf('/hub/walk')).toBe('home');
  expect(tabOf('/day/2026-10-08')).toBe('home');
  expect(tabOf('/me/data')).toBe('me');
});
it('a record opened from Trends stays in Trends (pushed in its opener’s tab)', () => {
  // record(launch at /trends), then PUSH /track/reading/x: the entry's tab is 'trends'
});
it('does not return a tab to a hub place whose screen never showed', () => {
  // as the existing "place whose screen never showed" test, with /hub/glucose
});
it('the walk summary is a task: no tab returns to it by itself', () => {
  // record PUSH /walk/summary from /hub/walk; tabLink(state,'home') is not /walk/summary
});
```

Write each with the same `record(...)`, `tabLink(...)` and `setPlaceCheck(...)` helpers the existing tests use.

- [ ] **Step 2: Run to check they fail**

Run: `npx vitest run src/components/hig/navigation.test.ts`
Expected: FAIL (the tab names don't exist yet).

- [ ] **Step 3: Change the constants** in `navigation.ts`

```ts
export type Tab = 'home' | 'trends' | 'browse' | 'me';

export const TAB_ROOT: Record<Tab, string> = { home: '/home', trends: '/trends', browse: '/browse', me: '/me' };
const TABS = Object.keys(TAB_ROOT) as Tab[];
/** Hubs and Today's log belong to Home by their address (journey §5). */
const ALSO: Partial<Record<Tab, readonly string[]>> = { home: ['/hub', '/day'] };
/** Full-screen tasks outside the tabs: a tab never returns to one by itself. */
const TASKS = ['/session', '/walk/live', '/walk/summary', '/setup'];
```

Then fix every other use of the old tab names (`grep -rn "'today'\|'move'\|'track'\|'guide'" src/components/hig src/screens src/places.ts`). Only the tab-name usages change, not `Mode` strings or anything else.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/hig/navigation.test.ts`
Expected: PASS.

- [ ] **Step 5: Gates and commit.** `tsc` will fail until Task 7 and Task 8 update the tab bar and routes. Do Tasks 6, 7 and 8 as one commit if needed. Otherwise commit with the tab bar temporarily mapped:

```bash
git add src/components/hig/navigation.ts src/components/hig/navigation.test.ts
git commit -m "feat: Generalise the navigation stack to Home, Trends, Browse and Me"
```

---

### Task 7: v2 routes and every v1 redirect

**Files:**
- Create: `src/redirects.ts`
- Create: `src/redirects.test.ts`
- Modify: `src/routes.tsx`
- Modify: `src/health/recommend.ts:100-112` (`HREF`)
- Create: `src/screens/day/routes.tsx`
- Create: `src/screens/browse/BrowseScreen.tsx` (interim)
- Create: `src/screens/home/routes.tsx` (renders `HomeScreen`, added in Task 9; until then it re-exports v1's `TodayRoutes`)

**Interfaces:**
- Produces:
  - `redirectFor(pathname: string, search: string): string | undefined`, which returns the v2 address with the query kept, or `undefined` when the path is already a v2 address;
  - `V1_PATHS: readonly string[]`, the test inventory.
- Consumes: `CATEGORIES` (Task 2).

- [ ] **Step 1: Write the failing test** `src/redirects.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { redirectFor } from './redirects';

describe('v1 → v2 redirects (journey §19.3)', () => {
  const cases: [string, string, string][] = [
    ['/today', '?checkin=walk', '/home?checkin=walk'],
    ['/move', '', '/hub/workout'],
    ['/move/stretch', '?area=back&minutes=10', '/hub/stretch?area=back&minutes=10'],
    ['/move/plan', '', '/hub/workout/plan'],
    ['/move/exercises', '', '/hub/workout/exercises'],
    ['/move/exercises/goblet-squat', '', '/hub/workout/exercises/goblet-squat'],
    ['/walk', '?meal=dinner', '/hub/walk?meal=dinner'],
    ['/track', '?day=2026-10-07', '/day/2026-10-07'],
    ['/track', '', '/day/today'],
    ['/track', '?view=trends', '/trends'],
    ['/track', '?add=glucose', '/day/today?add=glucose'],
    ['/track/metric/glucose', '?group=all', '/hub/glucose?group=all'],
    ['/track/metric/bloodPressure', '', '/hub/bp'],
    ['/track/metric/hba1c', '', '/hub/labs'],
    ['/track/metric/steps', '', '/hub/steps'],
    ['/track/back', '', '/hub/back'],
    ['/track/workout', '', '/trends/workout'],
    ['/guide', '', '/hub/learn'],
    ['/guide/topic/sugar-checks', '', '/hub/learn/topic/sugar-checks'],
    ['/guide/card/plate', '', '/hub/learn/card/plate'],
    ['/guide/sources', '', '/hub/learn/sources'],
    ['/guide/meals', '', '/hub/food/ideas'],
    ['/guide/meals/week', '', '/hub/food/week'],
    ['/guide/meals/poha', '', '/hub/food/ideas/poha'],
    ['/you', '', '/me'],
    ['/you/appearance', '', '/me/display'],
    ['/you/habits', '', '/me/reminders'],
    ['/you/focus', '', '/me/profile?chapter=movement'],
    ['/dashboard', '?checkin=1', '/home?checkin=1'],
    ['/settings', '', '/me'],
    ['/workout', '', '/trends/workout'],
  ];
  for (const [path, search, to] of cases) it(`${path}${search} → ${to}`, () => expect(redirectFor(path, search)).toBe(to));

  it('keeps record details and tasks where they are', () => {
    for (const p of ['/track/reading/abc', '/track/pressure/x', '/track/walk/w1', '/track/session/s1', '/track/check-in/2026-10-08', '/track/workout/s1', '/session', '/walk/live', '/walk/summary', '/home', '/hub/walk', '/day/2026-10-08', '/trends', '/browse', '/me'])
      expect(redirectFor(p, '')).toBeUndefined();
  });

  it('sends an unknown address to Home with a notice (Review Focus 2)', () => {
    expect(redirectFor('/nowhere/at/all', '')).toBe('/home?moved=1');
  });

  it('covers every route v1 declared (inventory from src/screens/*/routes.tsx)', () => {
    const areas = readdirSync('src/screens').filter(d => { try { readFileSync(`src/screens/${d}/routes.tsx`); return true; } catch { return false; } });
    for (const area of areas) {
      const base = { today: '/today', move: '/move', walk: '/walk', track: '/track', guide: '/guide', you: '/you', welcome: '/welcome', workout: '/track/workout' }[area];
      if (!base) continue;   // v2 areas (home, day, browse) aren't v1
      const paths = [...readFileSync(`src/screens/${area}/routes.tsx`, 'utf8').matchAll(/path="([^"*]+)"/g)].map(m => m[1]);
      for (const p of paths) {
        const full = `${base}/${p.replace(/:[a-zA-Z]+/g, 'x')}`;
        const target = redirectFor(full, '');
        // Either kept as is (a record or task), or sent to a real v2 address, never to the unknown fallback.
        expect(target === undefined || !target.startsWith('/home?moved'), `${full} → ${target}`).toBe(true);
      }
    }
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/redirects.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write the table** `src/redirects.ts`

```ts
/**
 * Every v1 address, sent to its v2 place with its query kept (journey §19.3;
 * audit K-16, K-17, A-35). Record details and tasks keep their v1 addresses.
 */
const METRIC_TO_HUB: Record<string, string> = {
  glucose: 'glucose', bloodPressure: 'bp', bp: 'bp', steps: 'steps', water: 'water', weight: 'weight',
  waist: 'waist', sleep: 'sleep', hba1c: 'labs', b12: 'labs', vitaminD: 'labs', vitd: 'labs', pain: 'back',
};
const YOU: Record<string, string> = { profile: 'profile', food: 'food', habits: 'reminders', voice: 'voice', appearance: 'display', data: 'data' };
const V1_LEGACY: Record<string, string> = {
  '/dashboard': '/today', '/workout': '/track/workout', '/plan': '/move/plan', '/library': '/move/exercises',
  '/progress': '/track', '/history': '/track', '/settings': '/you', '/profile': '/you/profile', '/onboarding': '/welcome',
};
const V2_ROOTS = ['/home', '/hub', '/day', '/trends', '/browse', '/me', '/setup', '/session', '/walk/live', '/walk/summary'];
const KEPT = /^\/track\/(reading|pressure|walk|session|check-in|workout)\/[^/]+$/;

const join = (path: string, search: string) => `${path}${search && search !== '?' ? search : ''}`;
const under = (p: string, base: string) => p === base || p.startsWith(`${base}/`);

export function redirectFor(pathname: string, search: string): string | undefined {
  const p = pathname.replace(/\/+$/, '') || '/';
  if (V2_ROOTS.some(r => under(p, r)) || KEPT.test(p)) return undefined;
  if (V1_LEGACY[p]) return redirectFor(V1_LEGACY[p], search) ?? join(V1_LEGACY[p], search);
  if (p === '/' ) return join('/home', search);
  if (p === '/today') return join('/home', search);
  if (p === '/move') return '/hub/workout';
  if (p === '/move/stretch') return join('/hub/stretch', search);
  if (p === '/move/plan') return '/hub/workout/plan';
  if (under(p, '/move/exercises')) return join(p.replace('/move/', '/hub/workout/'), search);
  if (p === '/walk') return join('/hub/walk', search);
  if (p === '/track') {
    const q = new URLSearchParams(search);
    if (q.get('view') === 'trends') return '/trends';
    const day = q.get('day');
    q.delete('day'); q.delete('view');
    const rest = q.toString();
    return `/day/${day ?? 'today'}${rest ? `?${rest}` : ''}`;
  }
  const metric = /^\/track\/metric\/([^/]+)$/.exec(p);
  if (metric) return join(`/hub/${METRIC_TO_HUB[metric[1]] ?? 'glucose'}`, search);
  if (p === '/track/back') return join('/hub/back', search);
  if (p === '/track/workout') return '/trends/workout';
  if (p === '/guide') return '/hub/learn';
  if (/^\/guide\/(topic|card)\//.test(p) || p === '/guide/sources') return join(p.replace('/guide/', '/hub/learn/'), search);
  if (p === '/guide/meals') return '/hub/food/ideas';
  if (p === '/guide/meals/week') return '/hub/food/week';
  if (under(p, '/guide/meals')) return join(p.replace('/guide/meals/', '/hub/food/ideas/'), search);
  if (p === '/you') return '/me';
  if (p === '/you/focus') return '/me/profile?chapter=movement';
  const you = /^\/you\/([^/]+)$/.exec(p);
  if (you && YOU[you[1]]) return `/me/${YOU[you[1]]}`;
  if (under(p, '/welcome')) return '/setup';
  return '/home?moved=1';
}
```

A metric kind with no mapping falls back to `glucose`. The inventory test catches any v1 kind that's missing, so add each v1 kind to `METRIC_TO_HUB` until the test passes. Find them with `grep -rn "metric/" src | grep -o "metric/[a-zA-Z]*" | sort -u`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/redirects.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the routes.** In `src/routes.tsx` (onboarded branch):
  - **Root and redirects:**
    - `/` → `<Navigate to="/home" replace />`;
    - add `<Route path="*" element={<LegacyRedirect />} />` last. `LegacyRedirect` reads `useLocation()`, calls `redirectFor(pathname, search)`, and renders `<Navigate to={target} replace />`. With no target (an unknown v2 sub-path), it renders `<Navigate to="/home?moved=1" replace />`;
    - delete the old `LEGACY` map; `redirects.ts` replaces it.
  - **Inside `<AppShell />`:**
    - `/home/*` → `HomeRoutes`;
    - `/hub/workout/*` → v1 `MoveRoutes` (interim);
    - `/hub/stretch` → v1's stretch screen (the element `MoveRoutes` renders at `stretch`; export it from `src/screens/move/routes.tsx` if it isn't exported);
    - `/hub/walk/*` → v1 `WalkRoutes`;
    - `/hub/learn/*` → v1 `GuideRoutes`;
    - `/hub/food/*` → v1 `GuideRoutes` mounted so that `ideas` → its `meals` route (interim: a small wrapper `<Routes><Route path="ideas" element={<MealsScreen/>}/>…</Routes>`, importing the components `GuideRoutes` uses);
    - `/hub/:id` for the reading categories → `<MetricDetailFor />`, which maps the hub id back to v1's metric kind and renders `MetricDetail` with that kind. Give `MetricDetail` an optional `kind` prop, defaulting to `useParams().kind`;
    - `/hub/back` → v1 `BackLeg`;
    - `/day/*` → `DayRoutes`;
    - `/trends/*` → `TrendsInterim`, which renders `MyDay` in its trends view (see Step 6);
    - `/browse` → `BrowseScreen`;
    - `/me/*` → v1 `YouRoutes`, with its internal paths mapped (`display` → appearance, `reminders` → habits) inside `src/screens/you/routes.tsx`;
    - `/track/*` → v1 `TrackRoutes` (record details only; its root redirects through `redirectFor`).
  - **Outside the shell:** `/session`, `/walk/live`, `/walk/summary` and `/setup/*` (interim: v1 `WelcomeRoutes`).
  - **Not onboarded:** `/setup/*` → `WelcomeRoutes`, and everything else → `<Navigate to="/setup" replace />`. Update v1 `welcome/routes.tsx`'s internal links from `/welcome/...` to `/setup/...`.

- [ ] **Step 6: Interim day, trends and browse.**
  - `src/screens/day/routes.tsx`:

    ```tsx
    import { Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom';
    import { format } from 'date-fns';
    import { MyDay } from '@/screens/track/MyDay';

    /** Today's log (journey §13): v1's My Day, with the day in the path. `today` is today's local date. */
    function DayFor() {
      const { date = 'today' } = useParams();
      const [params] = useSearchParams();
      const day = date === 'today' ? format(new Date(), 'yyyy-MM-dd') : date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return <Navigate to="/day/today" replace />;
      return <MyDay day={day} add={params.get('add') ?? undefined} />;
    }
    export default function DayRoutes() {
      return <Routes><Route path=":date" element={<DayFor />} /><Route path="*" element={<Navigate to="/day/today" replace />} /></Routes>;
    }
    ```

    Give `MyDay` optional `day` and `add` props that take precedence over its `?day=` and `?add=` query. Its Previous day and Next day buttons navigate to `/day/{date}` instead of setting `?day=`.
  - `TrendsInterim`: `MyDay` with a `view="trends"` prop, title "Trends", and no day stepper.
  - `BrowseScreen` (interim): a `Screen` titled "Browse", with a search field that filters by title. Below it, one `Group` per `GROUPS` entry, listing `CATEGORIES` rows (icon circle in the category colour, title, chevron), each linking to `category.hub`.

- [ ] **Step 7: `HREF` to v2.** In `src/health/recommend.ts`, change only the address strings in `HREF`. These are the v2 equivalents of `redirectFor`'s targets:
  - `day: '/day/today'`;
  - `profile: '/me/profile'`;
  - `plan: '/hub/workout/plan'`;
  - `status: '/home?status=1'`;
  - `statusNormal: '/home?status=normal'`;
  - `walk: '/hub/walk'`;
  - `guided`, `stretch` and `resume` stay as they are (`/session…`).

  Run `npx vitest run src/health src/screens/today`, and update tests that assert the old strings to the new ones. Don't change any test's clinical expectation.

- [ ] **Step 8: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/redirects.ts src/redirects.test.ts src/routes.tsx src/health/recommend.ts src/screens/day src/screens/browse src/screens/home/routes.tsx src/screens/track src/screens/you/routes.tsx src/screens/welcome src/screens/move/routes.tsx
git commit -m "feat: Route v2's places and redirect every v1 address with its query"
```

---

### Task 8: The glass tab bar

**Files:**
- Modify: `src/components/hig/TabBar.tsx`
- Modify: `src/components/hig/AppShell.tsx`

**Interfaces:**
- Consumes: `Tab` and `TAB_ROOT` (Task 6), and `.glass` (Task 5).
- Produces: `TabBar`, with the same name, so callers don't change.

- [ ] **Step 1: The tabs.** In `TabBar.tsx`, replace `TABS`:

```ts
import { CompassIcon, HouseIcon, LineChartIcon, CircleUserRoundIcon, type LucideIcon } from 'lucide-react';
const TABS: { tab: Tab; label: string; icon: LucideIcon }[] = [
  { tab: 'home', label: 'Home', icon: HouseIcon },
  { tab: 'trends', label: 'Trends', icon: LineChartIcon },
  { tab: 'browse', label: 'Browse', icon: CompassIcon },
  { tab: 'me', label: 'Me', icon: CircleUserRoundIcon },
];
```

Keep the `select` handler unchanged: it already does iOS-style re-tap, place restoration and scroll to the top.

- [ ] **Step 2: The floating capsule** (J§20.2 GlassTabBar, M5). Replace the `<nav>` class list for phones with a floating glass capsule. Keep the desktop sidebar as it is, but use `glass` there too.

```tsx
    <nav
      aria-label="Main"
      style={{ viewTransitionName: 'app-nav' }}
      className={cn(
        'fixed inset-x-3 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40 rounded-full glass',
        'lg:inset-x-auto lg:inset-y-0 lg:bottom-auto lg:left-0 lg:w-60 lg:rounded-none lg:pt-safe',
      )}
    >
      <ul className="relative flex items-stretch p-1 lg:flex-col lg:gap-1 lg:p-3 lg:pt-6">
```

Each `<li>`'s link gets:
- `min-h-[3.5rem]`, with the icon at `size-6` and the label at `text-[0.75rem] font-semibold`. Labels are always visible, so there's no shrinking (M6 removed);
- `rounded-full`, with `bg-tint/12 text-tint` for the selected tab, and `text-foreground/80` otherwise.

The selection "slides" via a CSS transition on the background. A full sliding indicator is optional; if added, it must use `transform` with `spring-quick` and jump under reduced motion.

- [ ] **Step 3: Shell padding.** In `AppShell.tsx`:
  - change the `<main>` bottom padding to `pb-[calc(4.5rem+max(0.5rem,env(safe-area-inset-bottom)))]`, so the last content clears the floating bar;
  - delete `YouButton` (Me is a tab now), and remove its imports from screens (`grep -rn YouButton src`). Each screen loses only its trailing button.

- [ ] **Step 4: Check by eye.** Run `npm run dev` and open the app at 428×926 and 320×568, in light and dark:
  - the four labels are visible;
  - the bar is glass;
  - Settings → Reduce transparency (set `settings.display.reduceTransparency = true` from the console via the store if Me's toggle isn't built yet) makes it solid;
  - it's solid during a tab change (watch `data-vt-running`).

- [ ] **Step 5: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/components/hig/TabBar.tsx src/components/hig/AppShell.tsx src
git commit -m "feat: Float a labelled glass tab bar with Home, Trends, Browse and Me"
```

---

### Task 9: Home

**Files:**
- Create: `src/screens/home/HomeScreen.tsx`, moved from `src/screens/today/TodayScreen.tsx` with `git mv`, then edited. The `model.ts`, `RecommendationCard.tsx`, `ChooserSheet.tsx`, `StatusSheet.tsx` and `clock.ts` siblings stay in `src/screens/today/` and are imported from there.
- Create: `src/screens/home/Tile.tsx`, `TileGrid.tsx`, `WeekCard.tsx`, `StatusButton.tsx`, `UrgentBanner.tsx`
- Modify: `src/screens/home/routes.tsx` (render `HomeScreen`)
- Modify: `src/components/hig/Ring.tsx` (clamp at 100%)

**Interfaces:**
- Consumes:
  - `CATEGORIES`, `GROUPS`, `defaultHome` (Task 2);
  - `movementLine` (Task 3);
  - `useStartMovement().permissionFor`;
  - v1 `recommend`, `RecommendationCard`, `StatusSheet`, `ChooserSheet`, `CheckInSheet`, `usePending`, `weekMovement`, `periodOn`, `STATUS_LABEL`.
- Produces: `HomeScreen` at `/home`.

- [ ] **Step 1: Move the screen.**

```bash
git mv src/screens/today/TodayScreen.tsx src/screens/home/HomeScreen.tsx
```

Fix its relative imports to `@/screens/today/...`. Rename the component to `HomeScreen`, and change `FROM_TODAY` to `{ path: '/home', label: 'Home' }`. `src/screens/today/routes.tsx` now only redirects (`/today` is handled by `redirectFor`).

- [ ] **Step 2: Ring never laps** (J§7.3, D31, K-06). In `Ring.tsx`, set `lapped = 0` (delete the lap arc and its comment), and keep `filled = clamp(fraction, 0, 1)`. Update any Ring test that asserted the lap, to assert no arc beyond 100%.

- [ ] **Step 3: The header.** Replace `<Screen title="Today" subtitle=… trailing={<YouButton />}>` with:
  - `<Screen title={greeting(now, profile.name)} subtitle={format(now, 'EEEE, d MMMM')} trailing={waiting.length > 0 ? <RemindersCapsule count={waiting.length} /> : undefined}>`;
  - `greeting()` returns "Good morning", "Good afternoon" or "Good evening", with ", {name}" when `profile.name` is set. `name` arrives in plan 5; read it as optional, `(profile as { name?: string }).name`;
  - `RemindersCapsule` is a labelled button, "2 reminders", that opens v1's pending list sheet (the one `ReminderBanner` opens);
  - under the title, `<StatusButton status={…} onOpen={() => setParams({ status: '1' })} />`. It's a full-width secondary row reading "How are you today? {STATUS_LABEL[status] ?? 'Normal'}", with a chevron and a min height of 60 px, and it opens v1's `StatusSheet`.

- [ ] **Step 4: The urgent banner** (J§4.7). Create `UrgentBanner.tsx`:
  - it renders when the recommendation kind is `emergency` or `seekHelp`;
  - it's a stop-ink strip with the recommendation's title and a "What to do" button that scrolls to the Right now card. On other tabs it links to `/home`;
  - render it in `AppShell` above `<Outlet />`, not only on Home, by reading the same recommendation through a small hook, `useUrgent()`, in `src/screens/home/urgent.ts`;
  - that hook calls `recommend(...)` with the same inputs `HomeScreen` uses, through a shared helper moved out of `HomeScreen`. Its unit test asserts `urgentOf(recommendation)` is true for `emergency` and `seekHelp` only;
  - no animation: it's there in the first frame.

- [ ] **Step 5: The Right now card runs its action directly** (J§7.4, K-32). Keep `RecommendationCard` as it is. In `HomeScreen`'s `onAct`, when the action's `mode` is set, call `start(action.mode, action.to, action.label)` (useStartMovement) instead of navigating to a hub. v1 already does this for movement actions; confirm it, and keep it.

- [ ] **Step 6: This week** (J§7.3). Create `WeekCard.tsx`:
  - one `Ring`, at `size={96}`, with `value={minutes}` and `goal={settings.weeklyMovementGoalMinutes}`. No goal means no ring: show "{minutes} min moved this week" and a "Set a weekly goal" button that opens v1's `GoalSheet`, which Today already lazy-loads;
  - beside it, "Stretched {n} days" (count the distinct days this week with a completed stretch session; put that count in a pure function, with a test, in `src/screens/home/week.ts`) and the steps line from v1's day total ("Steps: not entered" when there's none);
  - under it, 7 day dots for Monday to Sunday: filled for a day with movement, "R" for a planned rest day (from `gymDays`), and hatched for a status day;
  - the whole card links to `/trends`. Its dot logic goes in `week.ts` with tests.

- [ ] **Step 7: The tiles** (J§7.1, J§7.2, J§7.5).
  - **`Tile.tsx`:** a `Link` to `category.hub`, at least 120 px tall and full width in its column. It holds an icon circle (a 44 px circle, `background: color-mix(in oklab, var(--cat-{id}) 16%, transparent)`, glyph in `var(--cat-{id}-ink)`), the title in `--text-headline` semibold, and the live line below in `--text-subhead`, coloured by tone (normal muted, caution `text-caution`, stop `text-stop`).
  - **Press feedback:** the class `press-feedback` on an inner wrapper, so the hit area doesn't shrink (M2).
  - **The M3 morph:** give the inner container `style={{ viewTransitionName: isTransitioning ? 'hub-card' : undefined }}`, using `useViewTransitionState(category.hub)`.
  - **`TileGrid.tsx`:** one section per `GROUPS` entry that has tiles, with a heading ("Move", "Eat", "Check", "Learn") and a grid of `grid-cols-1 min-[375px]:grid-cols-2 gap-3`. Above 130% text, force one column by reading `document.documentElement.style.getPropertyValue('--text-scale')` or v1's `src/lib/textSize.ts`, whichever exposes the current scale. Add `scaleFromRoot()` to `textSize.ts` if neither does, and test it.
  - **Layout:** `settings.home ?? defaultHome({ profile, settings, hasSteps })`, where `hasSteps` = any observation of kind `steps`.
  - **Live lines:**
    - movement tiles (`category.mode`): `movementLine({ mode, permission: permissionFor(mode), status, normal })`. `normal` is the recommendation's label when its mode matches, otherwise a per-mode default ("Full Body · 45 min" from the plan, "10 or 15 min", "Just a walk");
    - reading tiles: the latest value with its measured date. Reuse `latestGlucose` and `latestPressure` from `src/screens/today/model.ts`. Other kinds show "Add a reading" until Plan 2 adds their lines;
    - Food: "Meal ideas for you"; Learn: "For you";
  - **Under the grid:** "See today's log" (a `Row` link to `/day/today`) and "Edit Home" (a `Row` button that opens Edit Home, Task 10).
- [ ] **Step 8: Remove v1's Today-only rows** that v2 moves elsewhere: the "Your day" group's ring row, the glucose and BP rows, and "View my day". They're now This week, the tiles and "See today's log". Keep these, in this order:
  1. the `EarlierSession` block;
  2. `MovePlanBack`;
  3. the prompt row (`PromptRow` / `ReminderBanner`);
  4. the sheets.

  The order after the header is:
  1. `UrgentBanner` (rendered by the shell);
  2. `RecommendationCard`;
  3. the prompt row;
  4. `EarlierSession`;
  5. `MovePlanBack`;
  6. `WeekCard`;
  7. `TileGrid`;
  8. the Today's log and Edit Home rows.

- [ ] **Step 9: Check by eye** at 428×926 and 320×568, in light and dark, and at 200% text:
  - the tiles go to one column at 320 px and at large text;
  - the labels wrap;
  - a P05-like profile shows the Walk tile as "No walking for now". Set the profile through Me → health, or seed it with the acceptance fixture loader.

- [ ] **Step 10: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/home src/screens/today src/components/hig src/lib/textSize.ts
git commit -m "feat: Make Home the launch screen with status, Right now, This week and tiles"
```

---

### Task 10: Edit Home

**Files:**
- Create: `src/screens/home/layout.ts`
- Create: `src/screens/home/layout.test.ts`
- Create: `src/screens/home/EditHome.tsx`

**Interfaces:**
- Produces: pure operations, each returning a new `HomeLayout`:
  - `hideTile(layout, id)`;
  - `showTile(layout, id)`;
  - `moveTile(layout, id, by: -1 | 1)`;
  - `addTile(layout, id)`.
- Every operation keeps each group at 5 tiles or fewer. Adding to a full group fails.

- [ ] **Step 1: Write the failing test** `src/screens/home/layout.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { addTile, hideTile, moveTile, showTile } from './layout';
import type { HomeLayout } from '@/types';

const L: HomeLayout = { order: { move: ['workout', 'stretch', 'walk'], eat: ['food'], check: ['glucose', 'water', 'sleep'], learn: ['learn'] }, hidden: [] };

describe('Edit Home operations (journey §7.6)', () => {
  it('hides a tile and lists it as hidden', () => {
    const next = hideTile(L, 'sleep');
    expect(next.order.check).toEqual(['glucose', 'water']);
    expect(next.hidden).toEqual(['sleep']);
  });
  it('shows a hidden tile at the end of its group', () => {
    expect(showTile(hideTile(L, 'sleep'), 'sleep').order.check).toEqual(['glucose', 'water', 'sleep']);
  });
  it('moves within its group, and never past the ends', () => {
    expect(moveTile(L, 'water', -1).order.check).toEqual(['water', 'glucose', 'sleep']);
    expect(moveTile(L, 'glucose', -1).order.check).toEqual(['glucose', 'water', 'sleep']);
    expect(moveTile(L, 'sleep', 1).order.check).toEqual(['glucose', 'water', 'sleep']);
  });
  it('adds a category to its own group, once', () => {
    const next = addTile(L, 'labs');
    expect(next.order.check).toEqual(['glucose', 'water', 'sleep', 'labs']);
    expect(addTile(next, 'labs')).toEqual(next);
  });
  it('refuses a sixth tile in a group (at most 5 choices, design research 4f)', () => {
    const full = addTile(addTile(L, 'labs'), 'weight');
    expect(full.order.check).toHaveLength(5);
    expect(() => addTile(full, 'waist')).toThrow(/full/);
  });
  it('never mutates its input', () => {
    const copy = structuredClone(L);
    hideTile(L, 'sleep'); moveTile(L, 'water', -1); addTile(L, 'labs');
    expect(L).toEqual(copy);
  });
});
```

- [ ] **Step 2: Run it to check it fails**

Run: `npx vitest run src/screens/home/layout.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Write** `src/screens/home/layout.ts`

```ts
import { categoryById } from '@/categories';
import type { CategoryId, HomeLayout } from '@/types';

const MAX_PER_GROUP = 5;
const clone = (l: HomeLayout): HomeLayout => ({ order: { move: [...l.order.move], eat: [...l.order.eat], check: [...l.order.check], learn: [...l.order.learn] }, hidden: [...l.hidden] });

export function hideTile(layout: HomeLayout, id: CategoryId): HomeLayout {
  const next = clone(layout);
  const g = categoryById(id).group;
  next.order[g] = next.order[g].filter(x => x !== id);
  if (!next.hidden.includes(id)) next.hidden.push(id);
  return next;
}

export function addTile(layout: HomeLayout, id: CategoryId): HomeLayout {
  const g = categoryById(id).group;
  if (layout.order[g].includes(id)) return layout;
  if (layout.order[g].length >= MAX_PER_GROUP) throw new Error(`The ${g} group is full`);
  const next = clone(layout);
  next.order[g].push(id);
  next.hidden = next.hidden.filter(x => x !== id);
  return next;
}

export const showTile = addTile;

export function moveTile(layout: HomeLayout, id: CategoryId, by: -1 | 1): HomeLayout {
  const g = categoryById(id).group;
  const list = layout.order[g];
  const i = list.indexOf(id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= list.length) return layout;
  const next = clone(layout);
  [next.order[g][i], next.order[g][j]] = [next.order[g][j], next.order[g][i]];
  return next;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/screens/home/layout.test.ts`
Expected: PASS.

- [ ] **Step 5: The UI** `EditHome.tsx` (M17):
  - **Edit mode** is a state in `HomeScreen`. Each tile shows labelled buttons, "Hide", "Move up" and "Move down", each at least 44 px. The edit bar has "+ Add" (to `/browse?pick=1`, Plan 4; for now it's a sheet listing the hidden and not-yet-added categories with "Add"), and "Done".
  - **Saving:** every operation writes `settings.home` through the store's settings update (the same call v1 uses for `weeklyMovementGoalMinutes`; `grep -rn "weeklyMovementGoalMinutes" src/screens/track/GoalSheet.tsx`), and announces "Water moved to position 2 of 5" in a polite live region.
  - **"Hidden"** lists the hidden tiles, each with "Show".
  - **Undo:** hiding offers it (v1's toast with an action; it must not time out, M19). If v1's toast library forces a timeout, set `duration: Infinity` and dismiss it on the next navigation.
  - **Long-press** (500 ms) on a tile opens a small menu: Hide from Home · Move up · Move down · Edit Home. It's optional in this task, as long as Edit Home is reachable from its row.

- [ ] **Step 6: Gates and commit**

```bash
npx tsc -b && npm run lint && npx vitest run
git add src/screens/home
git commit -m "feat: Let people hide, show, add and reorder Home's tiles"
```

---

### Task 11: Acceptance navigation, then the full run

**Files:**
- Modify: `scripts/e2e/acceptance/lib/ui.mjs:266-317` (`TAB_PATH`, `TAB_TITLE`, `tab()`)
- Modify: the journeys in `scripts/e2e/acceptance/journeys/*.mjs` that navigate by v1 tab names, titles or addresses

**Interfaces:** none.

- [ ] **Step 1: The tab helper.** In `ui.mjs`:

```js
const TAB_PATH = { Home: '/home', Trends: '/trends', Browse: '/browse', Me: '/me' };
const TAB_TITLE = { Home: undefined, Trends: 'Trends', Browse: 'Browse', Me: 'Me' };
```

Home's title is the greeting, so `tabSettled` must accept any `h1` when `TAB_TITLE` is undefined. Change the check to `title === undefined ? h1.length > 0 : h1.includes(title)`. Also export a v1 → v2 translation helper, so journeys keep their intent:

```js
/** Where v1's tabs went: Today → Home; Move → the Workout hub; Track → Today's log; Guide → the Learn hub. */
export async function legacyTab(page, name) {
  if (name === 'Today') return tab(page, 'Home');
  const to = { Move: '/hub/workout', Track: '/day/today', Guide: '/hub/learn' }[name];
  await tab(page, 'Home');
  await page.evaluate(path => { location.hash = `#${path}`; }, to);
  await heading(page, /.+/);
}
```

- [ ] **Step 2: Update the journeys.** For each `tab(page, 'Today'|'Move'|'Track'|'Guide')` call, use `tab(page, 'Home')` for Today, and `legacyTab(...)` for the others. Also:
  - a check of a `/today` address becomes `/home`;
  - a heading check of "Today" becomes the greeting's pattern (`/^Good (morning|afternoon|evening)/`);
  - "My Day" stays "My Day" on `/day/...`;
  - every clinical assertion is left unchanged (A-76).

  Find the call sites with `grep -rn "tab(page, '\|'/today\|'Today'" scripts/e2e/acceptance`.

- [ ] **Step 3: Run the full suite**

Run: `npm run e2e:acceptance > /tmp/fit-checks/accept-v2-p1.log 2>&1; tail -n 40 /tmp/fit-checks/accept-v2-p1.log`
Expected: 892 cases, 0 failed. For each failure, decide whether it's a navigation change (fix the journey's steps) or a real regression (fix the app). Record each journey change in the board's v2 log.

- [ ] **Step 4: Commit**

```bash
git add scripts/e2e/acceptance docs/reimagine/BOARD.md
git commit -m "test: Walk the acceptance journeys through v2's tabs"
```

---

### Task 12: Review and reconcile

**Files:** whatever the findings touch.

- [ ] **Step 1:** Build a static bundle for Codex: the plan, the spec sections it implements, `git diff feat/reimagine-holistic-health...feat/v2-journey -- src scripts/e2e/acceptance`, and the new files in full. Then run:

```bash
codex exec -m openai.gpt-6.1-sol -c model_reasoning_effort='"max"' -c 'model_providers.amazon-bedrock.aws.region="us-east-1"' -s read-only -C "$PWD" -o /tmp/fit-checks/v2p1-codex.md - < /tmp/fit-checks/v2p1-prompt.md
```

- [ ] **Step 2:** Run Kiro on the same diff, read-only:

```bash
kiro-cli chat --no-interactive --trust-tools=fs_read --model claude-opus-5.5 "<the same review prompt, telling it to read the diff with git and the plan file>"
```

- [ ] **Step 3:** Reconcile the findings. Reproduce each one with a failing test, then fix it. Log the result on the board.
- [ ] **Step 4:** Run the gates and the full acceptance suite again, then commit.
