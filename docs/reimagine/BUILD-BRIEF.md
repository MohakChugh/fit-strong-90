# Build brief — read this before writing any code

Every agent building part of the reimagined app works to this brief. Your own task brief adds scope; it never relaxes these rules.

**The bar:** this is not a prototype. Real people with diabetes, high blood pressure and sciatica will use it to make decisions about their day. Ship nothing you have not exercised. Zero known bugs.

## Read first

1. `docs/reimagine/BOARD.md` — decisions D1–D24 are binding. Constraints C1–C13 are not open for debate.
2. `docs/reimagine/PLAN.md` — architecture and your task's section.
3. `docs/reimagine/codex-vision.md` — the UX proposal. §2 (opening moment), §3 (navigation), §4 (screen table: each screen's one job and what is *deliberately absent*), §6 (Apple design), §9 (honest tracking). **Ignore §7 and every mention of Ask or the assistant: the owner cut that feature (C4).**
4. `docs/research/clinical-tracking-protocols.md` — the Safety contract and Cadence model. Any number you show about glucose, blood pressure, weight, vitamins or activity must trace to this file or to `docs/research/diabetes-hypertension-exercise.md`.
5. `docs/research/frontend-only-health-platform.md` — what iOS Safari can and cannot do. If it says a capability is a dead end, do not build it.

## Ownership — the rule that keeps parallel work safe

- You may create and edit files **only** inside the directories your task brief names.
- **Never edit** `src/routes.tsx`, `src/App.tsx`, `src/index.css`, `src/components/hig/*`, `src/store/*`, `src/health/observation.ts`, `src/health/aggregate.ts`, `src/engine/*`, `src/session/*`, `src/voice/*`, `src/motion/*`, `src/data/*`, `src/types/*`, or another agent's directory — unless your task brief explicitly grants that file.
- If you need a change in a file you do not own, **do not work around it**. Finish everything else and list the exact change you need in your report.
- Read anything.

## Data

- Read with `useStore()` from `@/store/useStore` (state: `status`, `observations`, `sessions`, `settings`, `profile`, `checkIns`, `personalRecords`, `bodyMetrics`, `focusOverrides`, `failure`, `persisted`). Code that expects the old `AppData` shape uses `useAppData()` from `@/hooks/useLocalStorage`, which is now an adapter over the same store.
- Write through the store's actions (`addObservation`, `editObservation`, `removeObservation`, `addToDayTotal`, `putSession`, `setSettings`, `setProfile`, `putCheckIn`, …). Every action returns a `StoreResult`; **handle the failure case** — show it, never swallow it.
- Never read or write `localStorage` or IndexedDB directly.
- Every number has a **source label** (`manual` / `measured` / `imported`). A day with no record says **"Not entered"**, never `0`. Never interpolate across missing data (D14, D10).
- Combining observations goes through `src/health/aggregate.ts` only. Do not sum observations yourself.

## Design — Apple-esque, minimal, intuitive

- Build screens from `src/components/hig/`: `Screen` (large title; pass `back` on pushed screens; `inline` for task screens), `Group` / `Row` (grouped inset lists — the default layout for almost everything), `Sheet` (bounded decisions; `medium` or `large` detent), `Ring`, `Stat`, `LineChart`, `BarChart`. Read each file before using it.
- Root screens put `<YouButton />` (from `@/components/hig/AppShell`) in `Screen`'s `trailing` slot.
- Tokens only: `bg-grouped-bg`, `bg-grouped-card`, `border-separator`, `text-tint`, `bg-tint text-on-tint`, `text-caution` and `text-stop` (text-safe ink), `bg-caution-fill` (black text) and `bg-stop-fill` (white text) for solid backgrounds, `text-muted-foreground`, and the type scale `text-[length:var(--text-large-title|title-2|body|subhead|footnote)]`. **One accent colour** (D12). No new colours, no gradients, no shadows beyond what `hig` already uses.
- **Hierarchy does the work:** one primary action per screen, at most. Each screen has one job (`codex-vision.md` §4 lists what must *not* be on it). If a screen feels busy, move detail one tap away rather than shrinking it.
- **Copy:** plain, warm, sentence case, no exclamation marks, no jargon, no blame. Say what to do, not what the user did wrong. Numbers carry units. "Not entered" over "—".
- **Touch:** every interactive target ≥ 44×44 px. Inputs ≥ 17 px (`--text-body`) so iOS does not zoom on focus. Use `inputMode="decimal"`/`"numeric"` for numbers.
- **Layout:** must work at **320×568** and look its best at **430×932** (iPhone 13 Pro Max). No horizontal overflow, ever. Light and dark mode both designed. Text stays readable at 200% zoom.
- **Motion that explains a change:** a sheet rising, a ring filling to its new value, a number settling on a reading just saved, a row expanding into its detail (`viewTransition` on links; the shell already handles the tab bar). No decorative staggered entrances. Everything respects `prefers-reduced-motion` (CSS already disables animation; for JS-driven motion use `useReducedMotion` from `@/hooks/useReducedMotion`).
- **Accessibility:** real buttons and links, labelled controls, `aria-live="polite"` for values that change on their own, charts already carry a hidden table. Colour is never the only signal (caution/stop always have words).

## Health and safety

- **Never** give insulin or medicine dosing, never suggest changing medication, never diagnose. The app gives general information with its source and points to the user's clinician.
- Any movement session (Stretch, Walk, Guided) is gated by the readiness engine (`src/engine/readiness.ts`, via the check-in sheet in `src/components/checkin`). Do not write a second safety check; call the existing one and respect its outcome.
- Health guidance shows **"General information, not medical advice."** near the advice itself, not only in settings.
- Use the clinician's targets when the profile has them (`profile.health.clinicianTargets`), before any default.
- Indian context: units and cut-offs as the research files specify (Asian BMI/waist cut-offs, mg/dL and mmol/L both supported). No UK phone numbers.

## Code

- React 19, TypeScript strict with `erasableSyntaxOnly` (no enums, no parameter properties, no namespaces). Path alias `@/` → `src/`.
- **No new npm dependencies.** Hand-roll it or use what is installed.
- Keep logic out of components: decisions go in plain `.ts` modules with tests beside them. Components stay thin.
- Comments explain *why*, at the density of the surrounding code. No commented-out code, no TODOs left behind.
- `react-hooks` lint is strict (purity, no setState in effects without cause, exhaustive deps). Fix the cause, do not disable the rule.

## Tests and done

- Vitest runs in a **node** environment (no DOM). Test the `.ts` logic directly. Every test you write must **fail without its implementation** — check by breaking the implementation, not by belief.
- Before reporting done: `npx tsc -p tsconfig.app.json --noEmit`, `npm run lint`, and the full `npm test` all green, and `npm run build` succeeds.
- Then exercise your screens in a real browser at 430×932 and 320×568 (light and dark). Other agents are doing the same at the same time, so: start **your own** dev server on a port of your choosing — `npx vite --port <49xxx> --strictPort` — and stop only that process when done; never kill another server. Drive it with `playwright-core` from a throwaway script **outside the repo** (your own temp dir; delete it after). Copy the launch setup — the `findChromium()` helper and swiftshader flags — from `scripts/e2e/journey.mjs`. Seed state the way a real upgrade does: put a v4 `AppData` blob in `localStorage['fit-strong-90-data']` before the first load and the store migrates it into IndexedDB (see `src/store/migrate.test.ts` for a realistic blob); use a fresh browser context per scenario so IndexedDB starts empty. Look at the screenshots yourself. Fix what you find. Check: no horizontal scroll, no console errors, every tap target works, empty states read well, the screen survives a reload.

## Report back

Files created or changed; the exported API other areas will use (signatures); test names; what you verified in the browser and how; anything you needed from a file you do not own; and any bug or doubt you have not resolved. **Say plainly what is not done.**
