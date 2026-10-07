# Guided Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One cohesive daily journey: a minimal health-aware profile, a daily check-in, and one Start button that runs a 60-minute voice-guided session (mobility → strength → cardio). It is personalised by a rules engine and demonstrated by anatomically correct 3D animations.

**Architecture:** Pure TypeScript engine modules (`src/engine/*`) build a deterministic `SessionPlan` from profile + date + history + check-in. A wall-clock runner (`src/session/*`) executes it, and a narrator chain (`src/voice/*`: clip → speech → captions) speaks it. A three.js viewer (`src/motion/*`) renders keyframed motion clips with IK, muscle highlights and mistake replays. React pages compose these.

**Tech Stack:** React 19, TypeScript (strict), Vite 8, Tailwind v4, shadcn/base-ui, Vitest (node env), three.js (M3+), playwright-core (dev, screenshots/e2e).

**Spec:** `docs/superpowers/specs/2026-10-05-guided-training-design.md` (research in `docs/research/`).

**Execution mode (chosen by the user's instruction "start the implementation… do not stop until all is achieved"):** native execution in this session, with parallel subagents for content-heavy, file-isolated tasks (coaching records, motion clips). No commits unless the user asks. No system-wide installs; build-time tools run from project-local npm packages.

## Global Constraints

- Session total 3600 s ± 120 s for a 60-minute profile. Blocks: mobility 0–900 s, strength 900–2820 s, cardio 2820–3540 s, wrap-up 3540–3600 s.
- Viewports verified by screenshots: 320×568, 360×640, 360×800, 375×667, 390×844, 412×915, 430×932, landscape 568×320 and 844×390.
- Tap targets ≥ 44×44 px; primary actions 56 px tall; body text ≥ 14 px (12 px only for secondary labels).
- Health data never leaves the device: no network calls carrying profile or check-in data, no analytics.
- No `dangerouslySetInnerHTML`. YouTube is reached only through `https://www.youtube.com/results?search_query=…` links with `rel="noopener noreferrer"`.
- All session timing comes from wall-clock anchors (`Date.now()`), never from counting ticks.
- Asset URLs use `import.meta.env.BASE_URL` (base `/fit-strong-90/`).
- Tests live in `src/**/*.test.ts` (vitest, node environment). Pure logic gets table-driven tests.
- Disclaimers use the exact copy in spec §4.9.
- Every spoken line is also shown as a caption.

## Review Focus

1. **Glucose units:** the user types 5.5 with mmol/L selected, or 99 with mg/dL. Expect both to land in the 90–125 mg/dL band. An implausible value (e.g. 5.5 with mg/dL) must ask "Did you mean mmol/L?" instead of declaring a severe low. → Task 4 tests.
2. **Resuming the next day:** a session started before midnight and resumed after it continues the original plan and date and logs to the original date. → Task 17 tests.
3. **Extreme profiles:** every condition at once plus "home, no equipment" still fills every slot (bodyweight fallbacks) and stays within 60 ± 2 min. → Task 12 tests.
4. **Unusual training days:** 1–2 days, 7 days, or non-contiguous picks still produce a valid week. No heavy squat and heavy hinge on consecutive calendar days unless unavoidable. → Task 8 tests.
5. **Silent narrator:** no voices, or speech that never fires `onend`, never stalls the session; timers keep advancing and captions show. → Task 19 tests.

---

## Status (2026-10-07)

- **Phase A (Tasks 1–23):** done. The engine, the profile wizard, the check-in and the session player are all in place. Voice and caption narration work, and the journey passes at all 8 viewports.
- **Task 24 (character):** done, but with a different figure. Quaternius wasn't usable without manual downloads, so `scripts/character/build.mjs` builds a realistic skinned human from MakeHuman/MPFB2 CC0 assets in Node, with no Blender needed. The result is a 53-bone game rig with per-vertex muscle IDs and clothing fields, in male and female versions, about 300 KB gzipped each.
- **Task 25 (runtime):** done.
  - **Files:** `src/motion/{rig,clip,character,viewer,equipment,muscles,probe,runtime}.ts`.
  - **Posing:** FK joint angles with neutral-pose frames, plus two-bone IK for hands and feet, knee aiming, hand frames relative to the chest, pelvis or shoulders, and mirroring for the other side.
  - **Display:** fault replays with red tint, lighting and a camera that fits the movement.
  - **Tools:** the lab is `motion-lab.html` (dev only), with `scripts/motion/{shot,probe,sheets}.mjs`. Geometry tests are in `clips.node.test.ts`.
- **Task 26 (clips):** done. All 115 catalogue exercises have a clip, with 300-plus fault variants — one for every mistake in the coaching records. Five parallel authors worked by group, following `docs/motion/authoring.md`, and verified each clip with joint probes, screenshots and the geometry tests (`clips.node.test.ts`: reach within 3 cm, nothing below the floor, faults matching coaching, mirrored sides).
  - Runtime features the authoring surfaced, now in place: per-fault `equipment` for setup faults, props that follow a limb (`pad` with `follow`, plus `kneePad`), a `handle` prop, `landmine` with `hands`, `box`/`pad` materials including `cloth`, `wall` `yaw`, `ignoreForCamera`, and a corrected `bench.incline`.
  - Bugs the authoring caught and fixed: an IK/FK handover that drove a foot 28 cm through the mat, a recumbent-bike seat so far back it locked the knee, and a rep-phase mapping that swapped lift and lower for deadlift-style lifts.
- **Task 27 (integration):** done.
  - The session player syncs the demo to the rep counter and previews the next exercise during rests and talks.
  - Library detail and the session info sheet have Correct/mistake chips.
  - Workout and History use `ExerciseFigure`.
  - Reduced motion: changed on 2026-10-07 at the user's request. Demos now play on their own everywhere, because the movement is the instruction (WCAG 2.3.3 exempts essential motion). In that mode a pause button is always shown.
  - Autoplay fixes, 2026-10-07: the viewer reads the newest visibility entry, so a busy phone can't strand an on-screen demo paused. Opening a Workout exercise also keeps that exercise in view while the one above it folds away. `scripts/e2e/autoplay.mjs` checks both.
  - The legacy SVG rig is removed.
- **Task 28 (voice packs):** done, with deviations. Encoding is AAC m4a (ffmpeg-static) instead of MP3.
  - **Packs:** Heart renders at 141 wpm and Nicole at 109 wpm. `scripts/voice/render-all.sh` adds a stall watchdog and `public/voice/index.json`.
  - **Pacing:** per-pack pace factors size the plan's speech windows.
- **Task 29 (polish):** partly done.
  - **Done:**
    - Media Session; the "over my music" mode (Audio Session API); the catch-up line after long pauses.
    - The production CSP and referrer meta (GitHub Pages can't set headers).
    - Accessible ink colours and screen-reader labels.
    - Lazy routes (main bundle 98 KB gzip; three.js only loads with the first demo).
    - A 30 fps cap on the viewer.
    - Normalisation of stored profiles.
  - **Review (2026-10-07):** a fresh reviewer audited the whole change. The gates were green but it found real bugs the suite missed, including five critical ones. Fixed since:
  - **Glucose:** a reading of 20–33 mg/dL used to block the check-in, and the only offered remedy re-read it as mmol/L (540 mg/dL) and cleared the user to train. An ambiguous low now fails safe to "treat this low now", and still offers the unit fix.
  - **Blood pressure:** the low-BP branch ran first, so 190/55 — common on BP medication — came out amber with a longer cool-down. The high thresholds are now evaluated first.
  - **Ketones:** urine strips (marked in mg/dL) were read on blood mmol/L thresholds, so a routine "small" result read as an emergency; and the kind was never read at all. Readings are now converted by kind, a urine strip is entered as its marking, and a reading counts at any glucose (an SGLT2 inhibitor can cause ketoacidosis at a normal level). A high glucose with no ketone test now restricts everyone who can make ketones, not only type 1.
  - **Back answers** survive a profile edit: unticking "Lower back" no longer turns a cauda equina flag back into a green day.
  - **Hot days** kept the hour: the capped cardio gives its time back as cool-down instead of ending 4 minutes early.
  - **The breathing cue** ("never hold your breath") now fires on every strength set for anyone with diabetes, as the spec asks, not only for raised blood pressure or eye disease.
  - **A green day with standing restrictions** says "Good to go, with changes" instead of "Good to go".
  - **The check-in repeats the disclaimer**, as the plan's constraints require.
  - **CSP:** tightened (`form-action 'none'`, scoped inline styles); the one relaxation that had to stay is documented in spec §10.3 with its reason.
  - **Exercise safety:** the FOOT rule now covers seated foot-plate work (leg press, seated calf raise, hip thrust); core drills carry their isometric/Valsalva flags, graded so a sustained brace is excluded for proliferative retinopathy while a breathed-out paused rep stays available; `femoralTension` is now enforced; deload weeks can no longer gain sets in the time fitter; a back history starts the ladder conservatively (H1/S1) and a "worse" checkpoint now demotes it (`updateLadder` is called on save, and two bugs that stopped it ever promoting are fixed); fallbacks never repeat a drill or swap in the wrong muscle.
  - **Sessions and data:** a finished session is saved the moment it ends, not only on "Save and finish"; ending early logs as partial; an earlier day's unfinished session no longer hides today's Start; durations exclude paused time; "Clear all data" removes every key the app owns; the export warns that it holds health data; version-less backups run every migration.
  - **Voice:** "Previous" repeats a step's narration; returning from a locked screen drops stale cues and says one catch-up line; "+15 s" never stretches a rep's tempo; a blocked or failed clip falls back to the device voice and the player shows "Tap to turn the coach's voice back on"; countdowns land exactly on zero using the recorded clip durations.
  - **3D:** side-lying-quad-stretch rebuilt; the hold-loop seam no longer flails; the knee-cave fault blends in smoothly; a rig bug in forearm pronation (wrist sliding off its target by up to 4 cm) is fixed; nine clips that skated a planted foot or folded a joint past range are fixed.
  - **Tests:** 1,001 → 2,033. The clip suite now checks joint limits, planted-foot drift, prop contact, non-world IK reach, loop seams, a minimum visible size for every fault, and that every live exercise has a clip.
- **Tests the plan previously claimed but did not have** are now written: `src/engine/{mobility,cardio,speech,strengthBlock}.test.ts` and `src/session/script.test.ts`. Review Focus #3's fixture now carries every condition the profile can hold, and the budget is asserted across five different check-ins.

## Phase A — M1 Foundations + M2 Guided session v1

### Task 1: Domain types and profile defaults
**Files:**
- Create: `src/types/profile.ts`, `src/types/checkin.ts`, `src/types/catalog.ts`, `src/types/plan.ts`, `src/profile/defaults.ts`, `src/profile/defaults.test.ts`
- Modify: `src/types/index.ts` (re-exports; extend `MuscleGroup` with `'upper' | 'lower' | 'fullBody'`; add optional `guided`, `focus`, `mobility`, `cardio`, `checkIn`, `painAfter` fields to `WorkoutSession`)

**Produces:** `UserProfile`, `HealthProfile`, `DailyCheckIn`, `Readiness`, `Outcome`, `Modifier`, `ExerciseMeta`, `MobilityMeta`, `CardioMeta`, `SafetyFlags`, `Pattern`, `EquipmentTag`, `MobilityRegion`, `Coaching`, `SessionPlan`, `Step`, `Segment`, `Prescription`, `DayFocus`; `createDefaultProfile(partial?)`.

- [x] Write tests: the default profile is valid (6 training days Mon–Sat, 60 min, no conditions, ladder H3/S3, voice rate 0.92); `createDefaultProfile({ pain: { areas: ['lowerBack'] } })` deep-merges.
- [x] Implement types and defaults; `npx tsc -b` clean; tests pass.

### Task 2: AppData v3 + migration
**Files:** Modify `src/services/storage.ts`, `src/types/index.ts`, `src/hooks/useLocalStorage.ts` · Test `src/services/storage.test.ts`
**Produces:** `AppData.version = 3`, `AppData.profile?: UserProfile`, `AppData.checkIns: DailyCheckIn[]`, `migrateData()` v1→v2→v3.
- [x] Tests: v2 data (onboardingComplete true, weight 82) migrates to v3 with `profile.weightKg = 82`, the sessions kept, `checkIns = []`, and `profile.health.diabetes = 'none'` plus a `needsHealthReview` flag. v3 round-trips unchanged. Corrupt JSON falls back to defaults.
- [x] Implement (localStorage is mocked in node tests with a Map shim).

### Task 3: Health derivations and clearance
**Files:** Create `src/engine/health.ts`, `src/engine/health.test.ts`
**Produces:**
- `deriveHealth(h: HealthProfile) → { hypoRisk, ketoneRisk, onBpMeds }`
- `profileModifiers(p) → { modifiers: Modifier[]; reasons: Reason[]; blockStrength: boolean; red: boolean }`
- `clearanceState(p) → { vigorousLocked: boolean; lightOnly: boolean; notice?: string }`
- [x] Table tests from spec §4.6 (complications), §4.7 and §4.9 (ACSM rows):
  - insulin → hypoRisk; SGLT2 → ketoneRisk; diuretic → onBpMeds → COOL
  - neuropathy → IMPACT; current foot wound → FOOT; severe retinopathy → INT, LOAD, HEAD, IMPACT; recent eye treatment → red
  - diabetes + inactive + no clearance → lightOnly; active + moderate clearance → vigorousLocked; untreated hypertension → blockStrength until cleared
- [x] Implement.

### Task 4: Daily readiness rules
**Files:** Create `src/engine/readiness.ts`, `src/engine/readiness.test.ts`
**Produces:** `toMgdl(value, unit)`, `glucoseSanity(value, unit) → 'ok' | 'suspectUnit' | 'implausible'`, `evaluateCheckIn(profile, checkIn, recent: DailyCheckIn[]) → Readiness`.
- [x] Table tests — one per row of spec §4.6 (glucose bands for hypoRisk users, CGM falling, ketones, low-risk meds, check-in "news" items, sleep/energy, two-days-running → recovery) and §4.7 (BP bands). Plus back rules (§4.5): pain > 5 or spreading → red-day recovery; 3–5 → amber; cauda equina → urgent; urgent symptoms → urgent. Plus most-restrictive-wins and modifier accumulation, and Review Focus #1 (units).
- [x] Implement as an ordered list of pure rule functions, each returning a `{ outcome, modifiers, reason }` contribution, then merge.

### Task 5: Strength and cardio catalogue metadata
**Files:** Create `src/data/catalog/strength.ts`, `src/data/catalog/cardio.ts`, `src/data/catalog/index.ts`, `src/data/catalog/catalog.test.ts`
**Produces:** `STRENGTH: ExerciseMeta[]` (legacy ids + spec Appendix A additions + retired ids flagged `retired: true`), `CARDIO: CardioMeta[]`, `getMeta(id)`, `allIds()`.
- [x] Tests:
  - ids unique and kebab-case
  - every `regressionId` exists, and regression chains terminate without cycles
  - flags match spec Appendix A for spot checks (russian-twist SF2 + LR retired; deadlift ladder H4; trap-bar-deadlift H2; barbell-squat S4)
  - every non-retired strength id has ≥ 1 pattern and `setupSeconds` between 15 and 90
- [x] Implement from spec Appendix A and `docs/research/program-design.md` §7.3.

### Task 6: Mobility catalogue metadata
**Files:** Create `src/data/catalog/mobility.ts`; extend `catalog.test.ts`
**Produces:** `MOBILITY: MobilityMeta[]` (spec Appendix B + raise/activate/potentiate drills).
- [x] Tests: every `irritableSwap` exists and is not itself `avoidWhenIrritable`; `knee-to-opposite-shoulder` is `excluded`; regions are valid; holds have `holdSeconds` 10–90; sliders are `sides: 'affectedFirst'`.
- [x] Implement from `docs/research/technique-mobility-cardio.md` §3 and `back-sciatica-mobility.md` §4.

### Task 7: Safety matrix and slot selection
**Files:** Create `src/engine/safety.ts`, `src/engine/select.ts`, and tests
**Produces:**
- `activeConditions(profile, readiness) → Conditions`
- `evaluateFlags(flags, conditions) → { excluded: boolean; gated: GateNeed[]; caps: Caps }`
- `selectForSlot(slot, ctx) → { exerciseId, caps, swappedFrom?: string, reason?: string }`
- [x] Tests: each cell of spec §4.8 that excludes or gates (e.g. loadedRotation always excluded with back history; heavyAxialLoad excluded when back irritable; neuralTension 2 excluded during active sciatica; headBelowHeart excluded with severe retinopathy or HEAD). Equipment filtering for `homeNone`. Ladder level gating. Dislikes. Never-empty fallback.
- [x] Implement.

### Task 8: Weekly templates and day mapping
**Files:** Create `src/engine/templates.ts`, `src/engine/templates.test.ts`
**Produces:** `TEMPLATES` for 3/4/5/6 training days, `weekFocus(profile) → Record<DayOfWeek, DayFocus>`, `slotsFor(focus) → Slot[]`, `mobilityDayType(focus)`, `focusLabel(focus)`.
- [x] Tests:
  - default Mon–Sat maps to lowerA, upperA, lowerB, upperB, lowerC, upperC, rest
  - 5-day, 4-day and 3-day defaults per spec §4.1
  - 1–2 picked days → full-body subset
  - 7 days → 6-day template + active-recovery day
  - heavy squat and hinge focuses never fall on consecutive calendar days when avoidable (Review Focus #4)
- [x] Implement.

### Task 9: Dosage, progression and the spinal-loading ladder
**Files:** Create `src/engine/dosage.ts`, `src/engine/progression.ts`, and tests
**Produces:**
- `phaseFor(week)` and `modeFor(week)` (deload weeks 4 and 8, taper week 12)
- `prescribe(meta, slot, ctx) → Prescription`
- `suggestLoad(exerciseId, rx, history) → LoadSuggestion`
- `startingLadder(profile)`, `updateLadder(profile, history, today) → ladder`
- [x] Tests:
  - foundation main lift 3 × 8–10 @ RIR 3–4, rest 120 s
  - deload halves the sets and adds 2 RIR
  - hypertension sets RIR ≥ 3 and reps ≥ 6 on valsalva lifts
  - double progression adds 2.5 kg after two sessions at the top of the range (spinal lifts)
  - stall for 3 sessions → −10%
  - ladder promotes at most once per 14 days after 4 green exposures, and demotes on a red exposure
- [x] Implement.

### Task 10: Segment timelines and the time model
**Files:** Create `src/engine/timing.ts`, `src/engine/timing.test.ts`
**Produces:**
- `segmentsFor(step) → Segment[]` (prep / work / switch / rest / rep sub-phases with durations; shared by the planner and the runner)
- `stepSeconds(step)`
- `estimateStrength(exercises) → seconds`
- `fitStrength(exercises, budget, profile) → { exercises, warnings }`
- [x] Tests:
  - 10-rep compound set ≈ 45 s; unilateral 10/side ≈ 90 s
  - hold 2 × 30 s each side = 2·(30+5)·2 + switches
  - cut order trims accessories before ever touching main-lift sets, ramps or main rest
  - grow order adds a main-lift set when > 150 s under
- [x] Implement.

### Task 11: Mobility and cardio block builders
**Files:** Create `src/engine/mobility.ts`, `src/engine/cardio.ts`, and tests
**Produces:** `mobilityBlock(ctx) → Step[]` (RAMP template per mobility day type, state modifiers, coverage ledger, flexibility-target dose by week); `cardioBlock(ctx) → Step[]`; `coverageFromHistory(history, weekStart)`.
- [x] Tests:
  - every day type sums to 900 s ± 10
  - the nerve flag adds sliders and swaps the wall calf stretch to soleus
  - HEAD swaps child's pose
  - a simulated 6-day week covers every region ≥ 2× (3× for hip flexors, glutes, shoulders, thoracic, calves)
  - cardio sums to 720 s; intervals only on upper days when cleared; COOL gives a 5-minute cool-down; HEAT ≤ 8 min main
- [x] Implement.

### Task 12: Session assembly
**Files:** Create `src/engine/session.ts`, `src/engine/session.test.ts`
**Produces:** `buildSessionPlan({ profile, date, history, checkIn }) → SessionPlan`, plus recovery, rest-day, red and urgent variants, and `plan.changes` explanations.
- [x] Tests:
  - every focus × {default, back+sciatica, diabetes on insulin, hypertension, all conditions + homeNone} → 3600 ± 120 s with exact block starts
  - recovery ≤ 1800 s; red → no exercise steps; urgent → empty plan with an urgent reason
  - Review Focus #3
- [x] Implement.

### Task 13: Coaching content (parallel subagents)
**Files:** Create `src/data/coaching/{upper,lower,mobility,cardio}.ts`, `src/data/coaching/index.ts`, `src/data/coaching/coaching.test.ts`
**Produces:** `getCoaching(id) → Coaching`, covering every non-retired catalogue id.
- [x] Schema test: every catalogue id has coaching; no empty strings; 4–7 steps; ≥ 3 cues; strength has ≥ 2 mistakes with clip ids `${id}.${slug}`; youtube queries present; ≥ 1 source URL.
- [x] Dispatch 4 subagents, one file each, converting `docs/research/technique-*.md` into typed records.

### Task 14: Unified exercise list and Library fixes
**Files:** Modify `src/data/exercises.ts` (derive `Exercise` objects from catalogue + coaching; keep retired ids for history), `src/components/exercise/animations.test.ts` (legacy coverage only), `src/pages/LibraryPage.tsx` (wrapping category chips; placeholder in place of the legacy SVG figure)
- [x] Tests: `exercises` contains every catalogue id; `getExerciseById('trap-bar-deadlift')` resolves; legacy history ids still resolve.
- [x] Implement; screenshot the Library at 320 px.

### Task 15: Profile wizard (onboarding) and Settings health section
**Files:** Rewrite `src/pages/OnboardingPage.tsx`; create `src/components/profile/{ProfileWizard,ChipGroup,HealthStep,BodyStep,BasicsStep}.tsx`; modify `src/pages/SettingsPage.tsx`
- [x] Implement 3 screens (spec §3.1) with conditional follow-ups, disclaimer and import; save the profile and mark onboarding complete.
- [x] Screenshot at 320/375/430; fix overflow; verify a no-conditions user taps through in ≤ 10 taps.

### Task 16: Check-in sheet and Today card
**Files:** Create `src/components/checkin/{CheckInSheet,OutcomeBanner}.tsx` and `src/components/today/TodayCard.tsx`; modify `src/pages/DashboardPage.tsx`
- [x] Implement spec §3.2 (questions shown per profile, glucose-unit sanity prompt, treat-and-recheck timer). The Today card shows the plan blocks, Start and Preview.
- [x] Screenshot each outcome state at 320 px.

### Task 17: Session clock and runner
**Files:** Create `src/session/clock.ts`, `src/session/runner.ts`, `src/session/persistence.ts`, and tests
**Produces:**
- `createClock({ now, timescale })`
- `runnerReducer(state, action)`
- `currentPosition(plan, state, now) → { step, segment, segmentRemainingMs, stepRemainingMs, overallElapsedMs }`
- `saveProgress`, `loadProgress`
- [x] Tests:
  - pause/resume freezes elapsed time
  - next/previous/doneEarly/addTime
  - a throttled tick (jump of 10 s) lands in the correct segment
  - resume after reload and across midnight keeps the plan date (Review Focus #2)
  - the timescale only applies in dev
- [x] Implement.

### Task 18: Narration scripts
**Files:** Create `src/session/script.ts`, `src/session/script.test.ts`
**Produces:** `scriptFor(step, ctx) → Cue[]` (P0–P3, anchors relative to step start, `align: 'end'` for countdowns, short and long variants, `estimatedMs`).
- [x] Tests:
  - every step of a full plan yields ≥ 1 cue; no empty text
  - every strength set includes "never hold your breath" when hypertension or retinopathy applies
  - sides are announced, affected side first
  - countdown cues end exactly at the segment end
  - the detailed variant is used for the first two exposures
- [x] Implement.

### Task 19: Voice: narrators and cue scheduler
**Files:** Create `src/voice/{narrator,speech,captions,scheduler}.ts` and tests (fake speechSynthesis)
- [x] Tests:
  - `chunkText` keeps chunks ≤ 140 chars
  - `rankVoices` filters novelty voices
  - the watchdog resolves when `onend` never fires (Review Focus #5)
  - P1 preempts P2; stale cues are dropped; P2 that doesn't fit falls back to short or caption-only
- [x] Implement.

### Task 20: Session player
**Files:** Create `src/pages/SessionPage.tsx`, `src/hooks/useGuidedSession.ts`, `src/hooks/useWakeLock.ts`, `src/components/session/{SessionProgress,StepHeader,TimerRing,BreathPacer,CaptionBar,Controls,SetPanel,RestPanel,InfoSheet,LowGlucoseSheet,Checkpoint,Summary}.tsx`, `src/session/logging.ts` (+ test); modify `src/App.tsx` (route `/session`, outside AppLayout)
- [x] Implement spec §3.3: segmented progress, step header with side badge, ring timer, breath pacer, captions, controls (prev, pause, next, +15 s, info, mute), set logging during rest, "I feel low" for hypoRisk, checkpoints, summary. Logging writes a `WorkoutSession` (guided). Leaving mid-session asks to confirm.
- [x] Logging tests: sets, volume, mobility and cardio logs map correctly.
- [x] Screenshot every step kind at 320×568 and 568×320.

### Task 21: App integration
**Files:** Modify `src/pages/WorkoutPage.tsx` (manual mode sources today's generated strength block), `src/pages/PlanPage.tsx` (generated week), `src/components/layout/AppLayout.tsx` (header label from generated focus), `public/sw.js` (never cache 206; precache app shell)
- [x] Screenshot Dashboard → Session → Summary → History for one complete flow.

### Task 22: End-to-end journey harness
**Files:** Create `scripts/e2e/journey.mjs`, `scripts/e2e/sheet.mjs`; modify `package.json` (`"e2e": "node scripts/e2e/journey.mjs"`, devDependency `playwright-core`)
- [x] The journey runs fresh profile → check-in → full session at `?timescale=60` → summary → history, at every viewport. Screenshots go into contact sheets; it fails on console errors or horizontal overflow.

### Task 23: Phase A verification
- [x] `npm run lint && npm test && npm run build` green; journey green at all viewports; a fresh reviewer agent reviews the diff; findings fixed.

## Phase B — M3/M4 3D motion system and clips

### Task 24: Character spike
- [x] Obtain a CC0 humanoid GLB without system installs (Quaternius Universal Base Characters), or fall back to a procedural mannequin built from three.js geometry on our own skeleton.
- [x] Spike a squat clip with IK. Screenshot it. Measure frame time in headless Chromium.

### Task 25: Motion runtime (`src/motion/*`)
- [x] Shared renderer (single context), clip builder (keyframes → mixer or direct bone posing), two-bone IK, muscle highlighting, equipment kit, camera presets + drag-to-rotate, mistake blending, a pure-kinematics test harness (joint limits, contacts, floor), poster-frame renderer script.

### Task 26: Clip library (parallel subagents)
- [x] Mobility clips first, then strength and cardio, each with mistake variants authored from the research angles.
- [x] Contact sheets reviewed; geometry tests green.

### Task 27: Integrate viewer
- [x] Session player, Library detail (correct / mistake tabs), Workout manual page; reduced-motion poster frames; remove the legacy SVG rig.

## Phase C — M5/M6 voice pack and polish

### Task 28: Neural voice pack
- [x] Project-local generator `scripts/voice/` (kokoro-js + MP3 encoder) renders the line catalogue + phrase vocabulary into `public/voice/`, with a manifest of durations.
- [x] `ClipNarrator` plays clips through one `<audio>` element; prefetch today's clips; fall back to speech.

### Task 29: Polish
- [x] Media Session, Over-my-music mode, catch-up line, CSP meta for production builds, accessibility pass, offline precache, final multi-viewport journey, final review.
