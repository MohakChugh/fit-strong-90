# What we already have, and what it is worth

[claude] 2026-10-08. My half of the design input: an honest audit of the existing app, so the reimagining builds on the strong parts and replaces the weak ones. Codex's product proposal is in `codex-vision.md`; decisions are argued in `BOARD.md`.

## The shape of it

About 24,000 lines of TypeScript, in two very different tiers.

| Tier | Area | Lines | Verdict |
|---|---|---|---|
| Domain | `src/data` (catalogue, coaching, 115 clip definitions) | 8,630 | **Keep.** Months of content work. |
| Domain | `src/motion` (3D runtime, rig, equipment, clips) | 6,337 | **Keep.** Unique asset, device-agnostic. |
| Domain | `src/engine` (readiness, session builder, mobility, cardio, dosage, progression, safety) | 2,709 | **Keep.** This is the app's brain and it is tested. |
| Domain | `src/session` (runner, script, logging, persistence, clock) | 1,075 | **Keep**, extend. |
| Domain | `src/voice` (clip narrator, device speech, scheduler) | 797 | **Keep.** Plus 2 × 1,367 recorded clips. |
| Domain | `src/types`, `src/profile`, `src/lib` | 1,306 | **Keep**, extend. |
| Surface | `src/pages` | 4,202 | **Mostly replace.** |
| Surface | `src/components` (of which `ui/` is 28 shadcn primitives) | 4,300 | Keep `ui/`, replace the rest. |

**The domain tier is the moat and the surface tier is the problem.** Roughly 19,000 lines of tested domain logic and content carry over unchanged. The ~6,000 lines of screens are where the clutter the owner complained about actually lives.

## Where the clutter is, concretely

- **`WorkoutPage.tsx` is 1,510 lines.** It is a page, a state machine, a rest timer, a superset timer, a swap dialog, a summary dialog, a PR detector and a set editor. It is the single worst file in the repo and the clearest example of what "reduce the clutter" means. It must be broken up.
- **Ten routes, seven of them in a tab bar.** Dashboard, Workout, Plan, Library, Progress, History, Settings. Apple ships five tabs at most, and usually fewer. Three of these are variations on "look at my data".
- **Three different places show the day's plan** — Dashboard's Today card, Workout, and Plan — each building it slightly differently. We fixed the building part today (`planFor`); the duplication of *surface* remains.
- **History and Progress overlap heavily.** Both are "past data, charted". They should be one place.
- **Settings holds profile, health, units, data export and reset.** Profile and health belong together and away from app preferences.

## What is missing for a holistic health app

Nothing in the current model covers the actual day of the people this app is for. These are new domains, not new screens:

| Domain | Current state | Needed |
|---|---|---|
| Glucose | A single reading inside the daily check-in, used once for readiness, then discarded into the check-in record | A first-class time series: readings with context (fasting, pre/post meal, around exercise), trends, time-in-range, cadence prompts |
| Blood pressure | Same — one averaged reading in the check-in | A time series with the correct home-monitoring protocol, averaged properly, with its own trend |
| Weight and waist | `bodyMetrics`, written only on the Progress page | Kept, surfaced, with Asian-specific cut-offs |
| Walking and steps | Nothing | Live walk sessions, step estimates, post-meal walk prompts |
| Nutrition | Nothing | Indian-food guidance as structured content; realistically **not** a food diary (see the abandonment evidence) |
| Vitamins (B12, D) | Nothing | Risk flags from the profile (metformin → B12), test cadence, food and sun guidance |
| Hydration | Nothing | One-tap logging, a daily target |
| Posture and sitting | Nothing | Desk setup guidance, break cadence |
| Sleep | Nothing | Manual or imported, correlated with glucose |
| Sciatica | Tracked inside the check-in and feeds the loading ladder — the one condition handled well | Keep, and give it its own trend view |

## Data model: what has to change

Today everything is one `localStorage` blob under `fit-strong-90-data`, at schema version 4, loaded and rewritten whole by `useAppData`.

That is fine for a 90-day programme and wrong for a lifelong record.

1. **It rewrites everything on every change.** A decade of readings serialised on each water tap is not acceptable.
2. **`useAppData` gives every caller its own snapshot.** We hit this today: Clear-all-data could not reach onboarding because App's copy was stale. One reactive store, not per-hook copies.
3. **Vitals want an append-only series**, not a nested array inside a settings object.
4. **localStorage will do for years but not for life**, and iOS can evict it. The research pass is checking the real quota and eviction behaviour; the likely answer is IndexedDB for series data with localStorage kept for settings, and `navigator.storage.persist()`.

**My proposal (D3, to argue on the board):** one reactive store over IndexedDB, with `localStorage` retained only for small settings and the in-progress session, a single append-only `entries` series for every observation (`{ id, kind, at, value, context, note }`), and a v5 migration that lifts glucose and blood pressure out of the old check-in records into that series so nothing already recorded is lost.

## What is genuinely excellent and must not regress

The temptation in a reimagining is to rebuild everything and quietly lose the best parts. These are non-negotiable:

1. **The readiness engine.** It encodes real safety rules — severe lows, ketones, hypertensive thresholds, cauda equina red flags — and it is covered by tests that were written after two separate audits found dangerous bugs. Do not reimplement it. Call it.
2. **The guided session.** 1,367 recorded lines per voice, a cue scheduler with priorities and catch-up, rep-synced 3D demos. It took weeks and it works.
3. **The 115 3D clips** with their fault variants, each geometry-tested against the floor, joint limits and reach.
4. **The spinal-loading ladder** that steps down when a symptom checkpoint says "worse". This is the app's single most valuable idea for a person with sciatica and it is nearly invisible in the current UI. The reimagining should make it visible.
5. **2,110 tests.** The new surface must not drop below this bar, and C9 demands better.

## My opening position on the design

To be argued with Codex on the board, not treated as settled:

- **Four tabs, not seven:** Today, Move, Health, Learn. Everything else is a sheet or a detail pushed from one of those.
- **Today is adaptive, not a menu.** The owner asked to be "asked what I want to do"; a modal that asks that on every launch is exactly the clutter they are complaining about. Today should already know — time of day, what is logged, what the check-in said — and offer one obvious action plus a way to reach anything.
- **No food diary.** The market research is checking this, but the abandonment evidence I expect will say calorie logging is the single biggest cause of quitting. Indian-diet *guidance* and meal patterns, yes; weighing dal, no.
- **Tracking must be honest about iOS.** If a web page cannot count steps in the background — and I believe it cannot — the app says so plainly and offers a foreground walk session plus Apple Health import, rather than showing a step count that is quietly wrong.
- **The 90-day programme stays the spine** of Move, but becomes one plan among several so that "just stretch today" is a first-class choice rather than a deviation.
