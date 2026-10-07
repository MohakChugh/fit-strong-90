# FitStrong Guided Training — End-to-End Design

**Status:** Draft for review · **Date:** 2026-10-05 · **Scope:** profile → personalised daily plan → 60-minute voice-guided session (stretch → strength → cardio) with high-fidelity form animations.

Research behind this spec lives in `docs/research/` (one file per topic, with sources). This document is written generically: it describes how the app handles *any* user's conditions and stores nothing about a specific person.

> **Not medical advice.** The app applies published exercise guidelines. It does not diagnose, and it tells users to get clinical clearance where those guidelines require it (§4.6, §4.7).

---

## 0. Summary

One button on the home screen — **Start today's session** — runs a single, continuous 60-minute guided workout:

| Block | Time | What happens |
|---|---|---|
| Check-in | ~20 s (before the clock starts) | Pain, leg symptoms, sleep; optional glucose and BP. Decides normal / modified / recovery / rest. |
| Mobility | 0:00–15:00 | Raise, spine mobility, core activation (McGill Big 3), nerve glides (sciatica side), stretches linked to today's muscles plus a full-body rotation, then movement-specific prep. |
| Strength | 15:00–47:00 | Today's lifts with automatic set → rest → set flow, rep-by-rep tempo and breathing cues, and weight logging during rest. |
| Cardio | 47:00–59:00 | Warm-up, main effort at a profile-safe intensity, cool-down. |
| Wrap-up | 59:00–60:00 | Pain re-check, post-session reminders (e.g. glucose check), saved to history. |

Every step is narrated: **what** to do, **how** (setup and machine adjustments), **why**, **how to breathe**, **where to feel it**, and **what to avoid**. Steps advance on their own, and earphone buttons pause or resume. A 3D figure demonstrates each movement in sync with the voice, highlights the working or stretched muscles, and can replay the common mistakes so the user knows what *not* to do.

A short profile (3 screens, ~60 s) captures goals, schedule, pain areas, sciatica side, and conditions (diabetes type and hypoglycaemia-risk medication, hypertension and beta-blockers, complications). A rules engine regenerates the plan from the profile, the 12-week phase, recent history and that morning's check-in, so the session is personalised every time.

---

## 1. Goals, non-goals, success criteria

**Goals**
1. One cohesive daily journey: open app → Start → stretch → lift → cardio → done, with no navigation in between.
2. Coaching good enough to follow with eyes closed: a calm, well-paced voice that covers setup, execution, breathing, sensation, and mistakes.
3. Back- and sciatica-safe programming that still builds an athletic, strong, lean, flexible body over 12 weeks.
4. Condition-aware: diabetes and hypertension rules applied automatically from the profile and the daily check-in.
5. Anatomically correct, readable animations from the most informative angle, including "how not to do it" demos.
6. Works on every phone from 320 × 568 (iPhone 5/SE 1st gen) up, in portrait and landscape, offline.

**Non-goals (this release)**
- Diagnosing pain or adjusting medication.
- Diet or meal planning (only session-adjacent advice such as carrying fast-acting carbs).
- Camera-based form tracking (noted as a future option in §8).
- Accounts, cloud sync, or sending health data off the device.

**Success criteria**
- A first-time user can finish the profile in under 90 seconds on a 320 px screen.
- A planned session's narration plus timers lands within ±2 minutes of 60 minutes, measured by an automated test across every day type.
- Every exercise and stretch in the catalogue has a validated animation (joint-limit, contact, and bounds tests) and complete coaching content (schema test).
- The end-to-end Playwright journey passes at 320 × 568, 360 × 800, 375 × 667, 390 × 844, 412 × 915 and 430 × 932, with screenshots reviewed at each step.
- No health data leaves the device; a strict CSP is in place (§10).

---

## 2. Decisions for you to confirm

These are my recommendations; each is reversible. Tell me if you want any changed before implementation.

| # | Decision | Recommendation | Why |
|---|---|---|---|
| D1 | Weekly structure | 6-day Upper/Lower ×3 by movement pattern (§4.1), replacing the body-part split | Each muscle 2–3× a week, heavy hinge and squat ≥ 72 h apart, daily core and mobility; the old split's leg day alone ran ~70 min |
| D2 | Animation technology | three.js + a CC0 MakeHuman human, keyframed joints, IK contacts, muscle highlighting, mistake replays (§8). Needs Blender on the dev machine for a one-off scripted model export — **I'll ask before installing** | Realistic, anatomically articulated (3 spine bones, clavicles) and fully controllable; ~0.5–0.7 MB; MIT + CC0 |
| D3 | Voice | Device speech first (M2), then a pre-recorded neural voice pack (Kokoro-82M, Apache-2.0) in M5 (§7). Needs Python `kokoro` + ffmpeg on the dev machine — **I'll ask before installing** | iPhone web apps can't use Premium/Siri voices; runtime cloud TTS can't be secured on a static site |
| D4 | Profile scope | §3.1: three screens, conditional follow-ups | Only the fields that change a safety rule; a user with no conditions taps through in under a minute |
| D5 | Existing 90-day program | Keep the three 4-week phases (Foundation → Hypertrophy → Strength); replace the fixed body-part split with the generated plan. | History, progress charts and phases keep working. |
| D6 | Existing Workout page | Keep it as a "manual mode" for logging without guidance; the guided session becomes the default from Today. | No regression for anyone who logs manually. |

---

## 3. User journey

### 3.1 First run: profile in three screens (~60 s)

Every field has a sensible default, so a user can tap through. All screens fit 320 × 568 without horizontal scroll; long lists become chips that wrap.

**Screen 1 — You and your schedule**
- Weight (required), height and birth year (optional; birth year enables age-based heart-rate guidance).
- Experience: Beginner / Intermediate / Advanced.
- Training days: chips Mon–Sun (default 6 days, Sunday off).
- Session length: 45 / **60** / 75 minutes.
- Where you train: Full gym / Home with dumbbells / Home, no equipment.

**Screen 2 — Your body**
- Pain or past injury (multi-select chips): Lower back · Sciatica · Neck · Shoulder · Hip · Knee · Hamstring · Calf · None.
- If Sciatica: which leg — Left / Right / Both.
- If Lower back or Sciatica: "Which makes it worse?" — Sitting or bending forward / Standing, walking or arching back / Not sure. This seeds the flexion- vs extension-bias choice in §4.5; the app keeps refining it from check-ins.

**Screen 3 — Health** (single-tap chips; follow-ups appear only when relevant, so a user with no conditions answers three taps)
- **Diabetes:** None / Prediabetes / Type 1 / Type 2 / Other. If any type:
  - **Insulin:** None / Injections or pump / Automated (closed-loop) system.
  - **Medicines:** Sulfonylurea or meglitinide (e.g. gliclazide, glimepiride, repaglinide) · SGLT2 inhibitor (e.g. empagliflozin, dapagliflozin) — yes / no / not sure.
  - **Lows:** "A severe low in the past 6 months, or do you often not feel lows coming?" (sets high hypo risk).
  - **Monitoring:** None / Meter / CGM · Ketone testing (only for type 1 or SGLT2): None / Urine / Blood · Unit: mg/dL / mmol/L.
  - **Eyes:** retinopathy None or mild / Moderate / Severe or proliferative / Recent eye treatment / Don't know (Don't know is treated as Moderate, with a prompt to get an eye exam).
  - **Feet:** nerve damage No / Yes / Not sure (Not sure is treated as Yes) · Feet: Healthy / Past ulcer or Charcot / Current wound or active Charcot.
- **Blood pressure:** None / Treated / Untreated / Not sure. If any: Beta-blocker? · Diuretic ("water pill")? · Home BP monitor?
- **Other:** Heart or circulation disease · Kidney disease (CKD / dialysis or transplant) · Dizzy when standing up · None.
- **Activity and clearance:** "Have you done ≥ 30 min of moderate activity on ≥ 3 days a week for the last 3 months?" · "Has a clinician cleared you for exercise?" No / For moderate / For vigorous. Optional clinician targets (minimum start glucose, BP stop value) override the defaults.
- **Goals** (pre-selected, editable): Strong · Lean · Flexible · Athletic · Pain-free back.
- Then a summary card ("Your plan: 6 days, 60 min, back-safe, glucose-aware"). When the clearance rules in §4.9 apply, a notice the user must acknowledge; it explains what stays locked until clearance is confirmed.

Voice choice and test happen on first session start (§3.2), not here, to keep onboarding short.

### 3.2 Every day

```
Today screen ──▶ Check-in sheet (20 s) ──▶ Session player (60 min) ──▶ Summary
      ▲                    │                                              │
      └──── rest-day / recovery outcome ◀──┘                              └──▶ History
```

**Today screen** (replaces the current dashboard hero)

```
┌──────────────────────────────┐ 320 px
│ Fri 9 Oct · Week 2 Foundation│
│ ┌──────────────────────────┐ │
│ │ TODAY · 60 MIN           │ │
│ │ Lower C · Hinge          │ │
│ │ ███▓▓▓▓▓▓▓▓▓▓▓░░░░       │ │ ← blocks to scale
│ │ 15 Mobility · 32 Strength│ │
│ │ · 12 Cardio · 1 Wrap-up  │ │
│ │ ┌──────────────────────┐ │ │
│ │ │  ▶ Start session     │ │ │ ← 56 px primary
│ │ └──────────────────────┘ │ │
│ │ Preview exercises ›      │ │
│ └──────────────────────────┘ │
│ Week ● ● ○ ○ ○ ○ ·           │
│ Last session: 58 min · 14 set│
└──────────────────────────────┘
```

**Check-in sheet** (bottom sheet; about 20 s for most days, because rare items default to "none")
1. **Right now:** "Chest pain or pressure, unusual breathlessness, racing heartbeat at rest, sudden weakness, trouble speaking, or sudden vision change?" No / Yes. Yes → URGENT screen.
2. **Back** (if back pain or sciatica):
   - Back pain now, 0–10.
   - Leg pain, 0–10, plus how far down it reaches (back / buttock / thigh / below knee / foot).
   - "New or worse numbness, tingling or weakness?"
   - "Numbness around the groin or inner thighs, or new bladder or bowel changes?" Yes → emergency screen (§4.5).
3. **Anything new today?** (multi-select, default "None of these"): unwell or fever · a low in the last 24 h (one / two or more / needed help) · fainted or dizzy on standing · new foot blister, sore or warmth · steroid tablets or injection in the last 3 days · hot or humid conditions · unusually tired or breathless in daily life.
4. **Readings** (shown per profile):
   - Glucose, plus the CGM arrow if CGM.
   - "Rapid-acting insulin in the last 2 h?" if on insulin.
   - Ketones when required (§4.6).
   - BP, two readings averaged, if the user has a monitor.
5. **Sleep:** < 5 h / 5–7 h / > 7 h · **Energy:** 1–5.

The outcome banner shows **Normal**, **Modified** (listing exactly what changes), **Recovery only** (mobility + easy walk, 20–30 min), **Rest today** or **Get help now**, with the reason and the threshold that triggered it (§4.5–§4.7). Glucose below the start threshold opens a guided 15-minute "treat and recheck" timer instead of a dead end.

**First session only:** a 20-second voice check — a sample line, a speed slider, Coach vs Over-my-music mode and verbosity (§7.4).

### 3.3 Session player

Portrait, 320 × 568 (scales up):

```
┌──────────────────────────────┐
│ ███▓▓░░░░░░░░░░░░  41:12 left│ ← segmented: mobility|strength|cardio
│ MOBILITY · 5 of 12           │
├──────────────────────────────┤
│                              │
│     3D figure (≈ 300 × 230)  │ ← drag to rotate; muscle glow
│                              │
├──────────────────────────────┤
│ Supine Figure-4   [ LEFT ]   │
│   ◯ 0:24        hold 1 of 2  │ ← ring timer
│   ↑ inhale 4 · ↓ exhale 6    │ ← breath pacer
│ "Let the knee fall open and  │ ← live caption (2 lines)
│  breathe into your hip."     │
├──────────────────────────────┤
│  ⏮    ⏸    ⏭    +15s   ⓘ   │ ← 48 px targets
└──────────────────────────────┘
```

- **Strength step:** set `2 of 3`, target reps and tempo, rep counter in sync with the voice ("three… down, two, three — exhale, up"), suggested weight with ± steppers, and a large **Done early** button for when the user finishes before the count.
- **Rest step:** countdown ring, "Next: set 3 · 40 kg × 10", quick log of the set just done (reps and weight prefilled), and the breathing and recovery cue.
- **ⓘ sheet:** full instructions, machine setup, breathing, where to feel it, mistakes (each with a "show me" button that plays the mistake animation in red, then the correction), back-safety notes, and two YouTube searches ("tutorial" and "common mistakes").
- **Landscape:** figure on the left, controls on the right — for a phone propped on a bench.
- **Lock screen / earphones:** play/pause, next and previous map to the runner through the Media Session API where supported (§7).

### 3.4 Minute-by-minute example (Lower C · hinge day, Foundation week 2, sciatica on one side)

The methodology in §4 decides the exercises; this shows the pacing for one day of the sample week (§4.10).

| Clock | Step | Narration focus |
|---|---|---|
| 0:00 | Welcome (30 s) | Today's focus, the three blocks, how to pause, the stop rules |
| 0:30 | **Raise:** march in place → step-ups, RPE 3 → 5 | Easy breathing through the nose; warming up for the nerve and spine work |
| 2:00 | **Cat-camel** ×6–8, then the directional-preference drill ×10 | Move within comfort; motion, not stretch |
| 3:00 | **Big 3:** curl-up 3 × 10 s · side plank 2 × 10 s/side · bird dog 3 × 10 s/side | Brace *while* breathing; hips square |
| 6:00 | **Sciatic nerve sliders** 10–15, affected side first, then the other | "Look up as the knee straightens; mild pull, never tingling" |
| 7:00 | **Prime movers (≤ 30 s holds):** supine strap hamstring, knee soft, 2 × 20 s/side (symptomatic leg → supine slider on irritable days) · figure-4 20 s/side | Breath pacer (in 4, out 6), where to feel it |
| 9:00 | **Deep hold:** half-kneeling hip flexor 60 s/side | Tuck the tail, squeeze the glute, then shift; front-thigh tingling → ease off |
| 11:00 | **Coverage:** wall calf 20 s/side (soleus version with a nerve flag) | Heel down |
| 12:00 | **Activate:** glute bridge 2 × 8 (3 s hold) · dead bug 6/side | Ribs down, exhale fully |
| 13:30 | **Potentiate:** dowel hinge ×10 → light kettlebell deadlift ×6 | Three points of contact on the dowel |
| 15:00 | Transition (60 s) | Water; walk to the trap bar; setup narration (handle height, foot position) |
| 16:00 | **Trap-bar deadlift (high handles):** 2 ramp-up sets + 3 × 6 @ RPE 6–7, 150 s rest | Setup, brace-and-breathe, push the floor away; symptom checkpoint after the last set |
| ~27:00 | **Goblet squat ↔ bird dog**, 2 rounds, 75 s rest | Elbows inside knees, chest proud ↔ slow reach |
| ~33:30 | **45° back extension (to neutral) ↔ lying leg curl**, 2 rounds, 60 s | Stop at a straight line, no arching ↔ hips pressed down |
| ~40:00 | **Single-leg calf raise** 2 × 12/side, affected side first, 45 s | Full range, slow lowering |
| ~44:00 | Buffer and transition to the treadmill | The time-fitter absorbs over- or under-runs here |
| 47:00 | **Cardio:** incline walk 3–6% — 2 min easy, 9 min at RPE 3–4, 1 min easy | Tall posture, no rail holding, talk test; glucose prompt if hypo risk |
| 59:00 | **Wrap-up** | Pain re-check, reminders (glucose, feet, walk after dinner), summary saved |

---

## 4. Training methodology

Full evidence and citations: `docs/research/program-design.md`, `back-sciatica-mobility.md`, `diabetes-hypertension-exercise.md`. This section states the rules the app implements.

### 4.1 Weekly structure

The current split trains each muscle once a week. Its Hypertrophy-phase leg day (27 sets) would take about 70 minutes on its own. It also clusters spinal load: deadlifts on Monday, then squats, RDLs and leg press on Wednesday. It is replaced by movement-pattern days in which every muscle is trained 2–3× a week and the heavy hinge and squat days are at least 72 h apart.

| Days/week | Default structure |
|---|---|
| **6 (default)** | Mon **Lower A** squat · Tue **Upper A** horizontal · Wed **Lower B** single-leg + carries · Thu **Upper B** vertical · Fri **Lower C** hinge · Sat **Upper C** hypertrophy · Sun rest + walks |
| 5 | Upper · Lower (squat) · rest/walk · Push · Pull · Legs (hinge) · rest/walk |
| 4 | Upper A · Lower A (squat) · rest · Upper B · Lower B (hinge) · rest · rest |
| 3 | Full body A / B / C on non-consecutive days |

- **Diabetes:** no more than 2 consecutive inactive days. Rest days get a prompted 15–20-minute post-meal walk.
- **Hypertension:** the same structure, with intensity caps from §4.7.
- **Days the user picks:** the template maps onto the selected training days in order. If two lower-body days would fall back to back, the engine swaps an upper day in between.

### 4.2 Mobility block (15 min)

The block follows **RAMP** — Raise, Activate, Mobilise, Potentiate — which outperformed static stretching alone in warm-up trials. Static holds stay short on muscles about to be lifted heavily (≤ 30 s per hold, ≤ 60 s in total, which costs about 1% of strength). Longer "deep" holds go to that day's non-prime movers, early enough that activation follows them.

**Shared opening (every training day)**

| Clock | Drill | Notes |
|---|---|---|
| 0:00–2:00 | **Raise:** march in place / step-ups / easy bike, RPE 3 → 5 | Warms tissue before nerve and spine work |
| 2:00–3:00 | **Cat-camel ×6–8** + directional-preference drill ×10 (§4.5) | Motion, not end range |
| 3:00–6:00 | **McGill Big 3 compact:** curl-up 3 × 10 s · side plank 2 × 10 s/side · bird dog 3 × 10 s/side | Brace *while* breathing |
| 6:00–7:00 | **Sciatic nerve sliders** 10–15/side, affected side first (if sciatica) — otherwise the day's first drill | "Mild pull, never tingling" |

**Day-linked part (7:00–15:00)**

| Slot | Upper push | Upper pull | Lower squat | Lower hinge | Full body |
|---|---|---|---|---|---|
| 7:00–9:00 prime movers (≤30 s) | Wall slide ×8; doorway pec 2 × 20 s | Kneeling lat 2 × 20 s; biceps 20 s/side | Soleus 20 s/side; side-lying quad 20 s/side; adductor rock-back ×8 | Strap hamstring (knee soft) 2 × 20 s/side; figure-4 20 s/side | Open book 5/side; wall slide ×8; knee-to-wall 8/side |
| 9:00–11:00 deep holds (45–60 s) | Hip flexor 60 s/side | Figure-4 60 s/side | Doorway pec 45 s; standing lat 30 s/side | Hip flexor 60 s/side | Hip flexor 50 s/side |
| 11:00–12:00 coverage | Wrists 20 s each | Chin tuck ×10; upper trap 20 s/side | 90/90 ×6/side | Wall calf 20 s/side | Rock-back ×8; quad 20 s/side |
| 12:00–13:30 activate | Scapular push-up ×10; band pull-apart ×15 | Prone Y-T ×8; scapular pull-up ×8 | Glute bridge ×10; band walk 10/side | Glute bridge 2 × 8 (3 s); dead bug 6/side | Bridge ×10; pull-apart ×12 |
| 13:30–15:00 potentiate | Incline push-up ×8 → empty bar ×8 | Band row ×12 → light pulldown | Box squat ×8 → light goblet ×5 | Dowel hinge ×10 → light kettlebell RDL ×6 | Goblet ×5; incline push-up ×6; hinge ×6 |

Each training focus from §4.1 maps to a column: Upper A → push, Upper B → pull, Upper C → full body, Lower A → squat, Lower B → full body with single-leg emphasis, Lower C → hinge. The deep-hold cells are defaults; the engine substitutes the user's flexibility targets, never that day's prime movers.

**Coverage guarantee (neck to calves).** The engine logs exposures and static seconds per region: neck, thoracic/upper back, shoulders, chest, lats, arms/wrists, torso, lower back, hip flexors, glutes, adductors, hamstrings, quads and calves. The 11:00 "coverage" slot always goes to the region furthest behind its weekly target:
- Lower back and torso: every day (cat-camel, side plank).
- Hip flexors, glutes, shoulders, thoracic and calves: ≥ 3 days a week.
- Neck, chest, lats, arms/wrists, adductors, hamstrings, quads: ≥ 2 days a week.

Missed days self-correct because the slot chases the largest deficit.

**Getting very flexible over 12 weeks.** ROM gains need about **≥ 5 min per week per target muscle, spread over ≥ 5 days**. The user picks (or the app suggests from quick tests — knee-to-wall, active knee extension, Thomas test, overhead reach) **2–3 target regions per 12-week block**. Those get about 60 s per side on ≥ 5 days through the deep-hold slots, plus an optional 5-minute post-cardio top-up.

| Weeks | Target-region dose |
|---|---|
| 1–4 | 2 × 30 s |
| 5–8 | 2 × 45 s or 3 × 30 s |
| 9–12 | 2–3 × 60 s, or contract-relax (3–6 s light contraction, then 10–30 s stretch) |

Range is deepened only after 7 Green days (§4.5). Positions that put tension on the nerve are never progressed as stretches. Ranges are re-tested every 4 weeks.

**State modifiers**
- **Red day (pain or leg symptoms):** walk, directional-preference drill, sliders, regressed Big 3, gentle hip mobility. No deep holds.
- **Nerve flag:** sliders fill the 6:00 slot; no static hamstring stretch over 30 s; bent-knee calf stretch instead of straight-knee.
- **Within ~1 h of waking:** no end-range spinal flexion unless the user's directional preference is flexion.
- **HEAD modifier (§4.6, §4.7):** child's pose, deep forward folds and similar head-below-heart positions are swapped for supine alternatives.
- **Core/conditioning day (3- or 4-day plans):** Raise → Big 3 pyramid (3-2-1 reps × 10 s) → sliders or neck work → deep holds for two target regions → dead bug + Pallof → march to step-ups.

### 4.3 Strength block

**Slots, not fixed exercises.** Each day is a list of pattern slots (e.g. Lower C: main hinge → squat accessory + anti-extension → back extension + knee flexion → calf). The engine fills each slot from a ranked candidate list after filtering by equipment, safety flags (§5.3, §4.8), the user's spinal-loading level, and dislikes. Every slot has a regression chain down to bodyweight, so it is never empty.

**Spinal-loading ladder (earned, not banned).** Heavy hinges and squats help many people with back pain. The people who benefit have low pain and good back-extensor endurance, so heavy spinal loading is unlocked level by level.

| Level | Hinge track | Squat track | Ceiling |
|---|---|---|---|
| 0 | glute bridge, dowel hinge, 45° back-extension hold | box sit-to-stand, partial leg press | RPE ≤ 5 |
| 1 | hip thrust, cable pull-through, kettlebell deadlift from blocks | goblet box squat, supported split squat | RPE ≤ 7 |
| 2 | trap-bar deadlift (high handles), 45° back extension, kickstand RDL | goblet squat, step-up, loaded split squat, depth-limited leg press | RPE ≤ 7, ≥ 6 reps |
| 3 | trap bar (low handles), RDL to mid-shin, rack pull ≤ trap-bar load | front-loaded squat, rear-foot-elevated split squat, walking lunges | RPE ≤ 8, ≥ 5 reps |
| 4 | conventional deadlift | barbell back squat | RPE ≤ 8.5, ≥ 3 reps |

- **Starting level:** no back history H3/S3 (beginners H2/S2) · quiet back history H2/S2 after the screen, otherwise H1/S1 · irritable back H0/S0 plus clinician review · active sciatica capped at H1.
- **To move up (all required):**
  - **G1 Symptoms:** ≥ 4 exposures over ≥ 2 weeks with pain ≤ 3/10, back to baseline next morning, and no spreading leg symptoms.
  - **G2 Technique:** neutral lumbar position on every rep, braced breathing.
  - **G3 Capacity:** top of the rep range at target RPE in 2 consecutive sessions.
  - **G4 Trunk endurance (optional):** balanced side-plank times and extensor hold ≥ 60–90 s.
  - **G5 Nerve (sciatica only):** neither an active straight-leg raise nor a kickstand hinge reproduces leg symptoms, in two sessions.
- At most one level per fortnight; each new level starts around RPE 6. Drop a level for a week if leg symptoms spread, pain exceeds 5/10, or next-morning pain is ≥ 2 points above baseline.

**12-week periodisation** (keeps the app's three phases)

| | Foundation (wk 1–4) | Hypertrophy (wk 5–8) | Strength (wk 9–12) |
|---|---|---|---|
| Main lifts | 3 × 8–10 @ RPE 6–7 | 3–4 × 6–10 @ RPE 7–8 | 3–5 × 4–6 @ RPE 7–8 (5–8 reps for spinal lifts below level 4) + back-off × 8 |
| Secondary compounds | 2–3 × 10–12 @ RPE 7 | 3 × 8–12 @ RPE 8 | 3 × 6–10 @ RPE 8 |
| Isolation | 2 × 12–15 @ RPE 7–8 | 2–3 × 10–15 @ RPE 8–9 | 2 × 10–12 @ RPE 8–9 |
| Rest (main / secondary / isolation) | 120 / 90 / 60 s | 120–150 / 90 / 60 s | 150–180 / 90–120 / 60 s |
| Weekly sets per muscle | 10–14 | 12–18 | 10–14 |
| Tempo cue | 3 s down, pause | 2 s down | controlled down, fast up |

- **Deloads in weeks 4 and 8:** half the sets, same or −10% load, +2 RIR, zone 2 cardio only, no ladder promotions.
- **Week 12:** taper (−40% sets) and rep-max re-tests on spine-sparing lifts only — no true 1RM attempts for back or hypertension profiles.
- **Progression (double progression):** when every set hits the top of the rep range at target RPE, add the smallest step (lower compounds +2.5–5%, upper +2.5% or next dumbbell, isolation adds reps first). Spinal-heavy lifts and hypertension profiles need it in two sessions running. Miss the bottom of the range → −5% (−10% if painful). Three stalled sessions → −10% or swap to a sibling exercise. Spinal lifts rise ≤ 5% a week.
- **Modifiers:** beginners −20% volume and +1 RIR (reps-only progression); hypertension ≥ 3 RIR and ≥ 6 reps on breath-hold-prone lifts with continuous breathing; modified-readiness days −1 set on compounds and RPE −1.
- **Sciatica side:** unilateral sets start on the affected side and the other side matches its reps. If the affected side lags > 15%, it gets one extra weekly set.

**Catalogue changes** (from the technique research)

| Current | Change | Reason |
|---|---|---|
| russian-twist | Replace → **pallof-press** | Loaded flexion + rotation |
| cable-crunch | Replace → **mcgill-curl-up** / dead bug | Repeated loaded flexion |
| deadlift | Keep at level 4 only; default hinge → **trap-bar-deadlift** | Lower lumbar moment |
| rack-pull | Level 3, never heavier than the trap-bar load | Short range invites overload |
| barbell-squat | Level 4 only; default → **goblet-squat** / depth-limited leg press | Axial load |
| hanging-knee-raise | Not in Foundation; alternative captain's chair or dead bug | Flexion under load |
| calf-raises (standing machine) | Default → **seated-calf-raise** | Shoulder-loaded axial load |
| barbell-curl | Back profiles → seated dumbbell or cable curl | Lumbar swinging |
| arnold-press | Seated, back-supported only (or dropped) | Duplicates DB press + loaded rotation |
| rear-delt-fly | Chest-supported or reverse pec deck only | Bent-over position |
| seated-cable-row | Knees bent; swap to chest-supported row during leg flare | Seated nerve tension |
| dumbbell-shoulder-press, overhead-tricep-extension | Seated, back-supported | Lumbar extension |
| hamstring-stretch (straight-leg pull) | Replace → **supine strap stretch (knee soft, ankle relaxed)** + **sciatic sliders** | Nerve tensioner |

**New catalogue entries:** trap-bar-deadlift, kettlebell-deadlift, cable-pull-through, back-extension-45, glute-bridge, goblet-box-squat, split-squat, rear-foot-elevated-split-squat, step-up, reverse-lunge, single-leg-rdl, mcgill-curl-up, bird-dog, side-plank, pallof-press, cable-chop, suitcase-carry, farmer-carry, seated-calf-raise, single-leg-calf-raise, assisted-pull-up, landmine-press, lying-leg-curl, seated-leg-curl, recumbent-bike, elliptical. The mobility catalogue (Appendix B) adds about 35 drills.

### 4.4 Cardio block (12 min)

Lifting before cardio protects strength and, in type 1 diabetes, gives steadier glucose, which matches the session order.

| Format | Prescription | When |
|---|---|---|
| **Zone 2 (default)** | 2 min easy → 9 min at RPE 3–4/10 (full sentences possible) → 1 min easy | Lower days, deloads, any AMBER day |
| Short intervals | 2 min easy → 6 × (30 s RPE 7–8 + 60 s easy) → 1 min easy | 1×/week in Foundation, then 2×/week, after upper days only, and only if cleared (below) |
| Tempo | 2 → 8 min at RPE 5–6 → 2 min | When intervals aren't cleared |

- **Modalities for backs and sciatica:** incline treadmill (default; 0–5% if flexion-sensitive, as incline flexes the trunk slightly) · recumbent bike (trunk supported; best with neuropathy) · elliptical. Upright bike can aggravate flexion-sensitive sciatica. Rowing waits for hinge level 3. Running needs 30 minutes of symptom-free brisk walking first, then walk–run.
- **Intervals are blocked** with:
  - uncontrolled hypertension, or BP ≥ 140/90 that day
  - severe or proliferative retinopathy
  - insulin use without glucose monitoring
  - the INT or HYPO modifiers (HYPO keeps cardio continuous and moderate)
  - no clearance for vigorous work where §4.9 requires it
- **Intensity by RPE and talk test**, never heart rate alone (beta-blockers and autonomic neuropathy blunt it).
- **Weekly total:** six sessions give 72 minutes, so the app adds 10–15-minute post-meal walk prompts to reach ≥ 150 min/week (200–300 for fat loss). Diabetes profiles get a daily post-meal walk prompt, rest days included.
- **COOL modifier** (any BP medicine, autonomic neuropathy, dizziness on standing): the final 5 minutes of the block are an easy cool-down, and the main portion shortens so the session still ends on time.

### 4.5 Back pain and sciatica rules

**Traffic light** (applied at check-in, after each hinge/squat/lunge exercise, and the next morning)

| | During exercise | Next morning | Leg symptoms | Action |
|---|---|---|---|---|
| **Green** | 0–2/10 | Back to baseline | None, unchanged, or moving toward the spine | Continue; progress after 2 Green sessions |
| **Amber** | 3–5/10, not climbing rep to rep | Slightly worse, settles within 24 h | Brief spread that settles within ~1 min | Hold progression; shrink range or load on the provoking drill |
| **Red** | > 5/10, sharp, or climbing | Worse beyond 24 h, or morning stiffness up 2 days running | Spreading down the leg; new numbness or weakness | Stop the drill; switch to the Red-day block; suggest a clinician if it lasts ≥ 3 days |

**Immediate stop:** symptoms spreading down the leg; new numbness, tingling or weakness; sharp pain > 5/10; pain climbing each rep; dizziness, chest pain or feeling unwell.

**Red flags** (screened at onboarding, and again whenever symptoms are new or changed)

| Urgency | Triggers | App response |
|---|---|---|
| **Emergency** | Sciatica in both legs; severe or worsening weakness or numbness in both legs; numbness around the genitals or anus; new bladder or bowel problems; cancer history with limb weakness or bladder/bowel change; calf pain or swelling with breathlessness or chest pain | Session locked; emergency screen ("call your emergency number; don't drive yourself") |
| **Same day** | Worsening weakness in one leg (foot drop, can't walk on heels or toes); fever or feeling unwell with back pain (especially with diabetes); significant trauma; one swollen, warm, tender calf | Training suspended; prompt to contact a doctor today |
| **Book an appointment** | Unexplained weight loss or constant night pain; sciatica not improving after several weeks; calf pain on walking that eases when standing still; numbness or burning in both feet | Session continues with modifications; reminder set |

**Finding the user's direction (directional preference).** About 70% of people with low back pain have a direction of movement that eases symptoms, and exercises matched to it outperform unmatched ones. The guarded self-test runs only with no red flags, a Green or Amber state and no worsening neurology:
1. Baseline: back and leg pain 0–10, and how far down the leg symptoms reach.
2. Extension in steps: prone lying 1 min → prone on elbows 1 min → 10 slow press-ups (hips down), re-rating after each.
3. Symptoms move toward the spine or ease and stay better → **extension preference (provisional)**. Symptoms spread → stop; next session test supine knees-to-chest × 10 the same way. No change → neutral-spine plan.
4. Confirm on 2–3 separate days; re-test monthly and after flares. A stenosis pattern (leg symptoms when standing or walking, eased by sitting or bending forward) defaults to flexion.

The confirmed drill joins the shared opening (2:00) and is offered as a flare "rescue" (about 10 reps, a few times a day).

**Nerve-friendly rules**
- Sliders only while leg symptoms are active (10–15 slow reps per side, 1–2 sets; anything provoked must settle within ~1 min). Tensioners only after 2 Green weeks with no leg symptoms (5–10 reps, 1–2 s end hold).
- No slumped or seated hamstring stretches; strap stretch lying down, knee soft, ankle relaxed, head down.
- Supine figure-4 instead of pigeon while irritable.

**Hamstring or calf pain: nerve or muscle?** Short self-report questions in the profile and check-in steer selection:
- **Hamstring:**
  - Pain travels below the knee or comes with tingling → nerve.
  - The thigh feeling changes when looking down or pulling the toes up with the knee straight → nerve (structural differentiation, done once and gently).
  - Pain right at the sit bone, worse on hard seats → tendon.
  - Sudden onset while sprinting, with a tender spot → strain.
- **Calf:**
  - Sole or outer-foot tingling, or weak tiptoe → S1 nerve root.
  - Calf pain on walking that eases on standing still → circulation (refer; important with diabetes or hypertension).
  - One swollen, warm calf → possible clot (same-day care).

Nerve-pattern users get sliders, bent-knee calf stretches, no holds > 30 s, hip thrust and trap bar from blocks, and no stiff-leg deadlifts or good mornings. Strain patterns get pain-free isometrics, then lengthening loads (Nordics later).

### 4.6 Diabetes rules

All diabetes, BP and back rules feed one outcome scale: **GREEN** normal · **AMBER** modified · **RECOVERY** mobility + easy walk (20–30 min) · **RED** no exercise today + advice · **URGENT** emergency. The most restrictive outcome wins, and AMBER modifiers add up.

| Modifier | Effect on the session |
|---|---|
| INT | Effort ≤ "can talk in sentences"; no intervals, sprints or maximal efforts |
| LOAD | ~40–60% 1RM, 10–15 reps, ≥ 3 reps in reserve; holds ≤ 30 s; no heavy overhead lifts |
| HEAD | No head-below-heart positions (child's pose, deep forward folds, inversions) |
| IMPACT | No jumping or jarring |
| FOOT | Non-weight-bearing only (seated, upper-body, floor) |
| COOL | Cool-down ≥ 5 min; staged rising from the floor |
| HYPO | Fast carbs within reach; glucose checks before cardio and at the end; cardio continuous and moderate |
| HEAT | Cardio ≤ 8 min at moderate effort, extra fluids |

**Derived from the profile:**
- `hypoRisk` = insulin or sulfonylurea/meglitinide.
- `ketoneRisk` = type 1, any SGLT2 inhibitor, or insulin-deficient.
- `onBpMeds` = treated hypertension, or a beta-blocker or diuretic for any reason. It applies COOL every day.

**Pre-session glucose** (`hypoRisk` users; mg/dL with mmol/L in brackets)

| Glucose | Action | Outcome |
|---|---|---|
| < 54 (< 3.0) | Treat (15-15 rule) and eat | RED |
| 54–69 (3.0–3.8) | Treat; start only when ≥ 90 (5.0) and symptom-free | AMBER (HYPO, INT) |
| 70–89 (3.9–4.9) | 10–20 g fast carbs, recheck in 15 min, start when ≥ 90 | GREEN + HYPO |
| 90–125 (5.0–6.9) | ~10 g carbs now; 15–20 g more before cardio if still < 126 | GREEN + HYPO |
| 126–180 (7.0–10.0) | Target range | GREEN |
| 181–249 (10.1–13.8) | Drink water | GREEN |
| ≥ 250 (≥ 13.9) | `ketoneRisk`: test ketones (below). Others: go if well and hydrated | per ketones, or GREEN |
| > 300 (> 16.7), type 2 | Only if well and hydrated; recheck after | AMBER (INT, LOAD) |
| CGM falling and < 126 | Add 5–10 g to the row's carbs; delay 15 min | Delay |

Users with impaired hypo awareness, a severe low in the past 6 months, or few recent sessions use higher start targets (145–216 mg/dL) per the research file. Low-risk medicines (metformin, GLP-1 RA, DPP-4i, SGLT2i alone) need no routine carbs, but the < 70 and > 300 rows still apply.

**Ketones** (`ketoneRisk`): < 0.6 mmol/L → follow glucose rules · 0.6–1.4 → RED today · ≥ 1.5 → RED and contact the care team · ≥ 3.0 or vomiting, abdominal pain, rapid breathing, drowsiness → URGENT. SGLT2 inhibitors can cause ketoacidosis at normal glucose, so nausea or abdominal pain means a ketone check whatever the glucose.

**Other check-in rules:**
- Severe low, or two or more lows, in the past 24 h → RED.
- One low → AMBER (HYPO, INT).
- `hypoRisk` with no reading → AMBER (HYPO, INT).
- Fainted today → RED + same-day advice.
- Dizzy on standing → AMBER (COOL, INT).
- New foot blister, sore or warmth → FOOT.
- Unusually tired or breathless in daily life → RED until cleared.
- Sleep < 5 h or energy ≤ 2 → AMBER (INT, −1 set); two days running → RECOVERY.
- Hot or humid → HEAT.
- Steroid tablets or injection in the past 3 days → extra glucose checks.

**In-session (voice + screen):**
- Every strength set: "Breathe out as you push. Never hold your breath."
- Every block change: "Sip water."
- Before cardio (`hypoRisk`): "Check your glucose now."
- "I feel low" button (always visible for `hypoRisk`), symptoms, or CGM < 70: stop → 15 g fast carbs → 15-minute timer → recheck. Then cool-down only once ≥ 90; end the session if < 54.

**Post-session:**
- `hypoRisk`: check glucose at the end and within 90 minutes; check before bed after afternoon or evening sessions. "Lows can happen up to 24 hours later, often overnight; alcohol raises the risk."
- Neuropathy: foot check.
- Rehydrate.

**Complications (applied every day):**
- Peripheral neuropathy: shoes on, IMPACT, supported balance work, foot checks.
- Foot wound or active Charcot foot: FOOT until cleared.
- Autonomic neuropathy: RPE only, COOL, HEAT.
- Moderate retinopathy: no lifts > 80% 1RM.
- Severe or proliferative retinopathy: INT, LOAD (no breath-holding, isometrics or overhead), HEAD, IMPACT, plus eye-doctor sign-off. Unstable, or recent eye surgery: RED until cleared.
- Kidney disease: LOAD, careful hydration, clearance.

### 4.7 Hypertension rules

**Resting BP** (seated, back supported, 5 min rest, no caffeine for 30 min; average two readings 1 min apart)

| Average reading (mmHg) | Outcome |
|---|---|
| < 90/60 with dizziness | RED — sit or lie down, fluids |
| < 90/60, no symptoms | AMBER (COOL) |
| < 140 and < 90 | GREEN |
| 140–159 or 90–99 | AMBER: no intervals, no heavy or maximal lifts |
| 160–179 or 100–109 (re-measured after 5 min) | AMBER (INT, LOAD, HEAD, COOL); suggest a clinician check |
| ≥ 180 or ≥ 110 | RED |
| > 180 and/or > 120 with chest or back pain, breathlessness, weakness, vision or speech change | URGENT |

- **Breathing:** never hold the breath; exhale through the effort. Heavy lifts taken to failure with breath-holding have produced pressures above 300 mmHg. Sets stop 2–3 reps (≥ 3 for flagged lifts) short of failure.
- **Load:** 40–60% 1RM × 8–12 by default; up to 80% only with controlled BP, no retinopathy restriction, and clearance for vigorous work.
- **Rest:** 60–120 s; alternate upper and lower body where possible.
- **Beta-blockers:** effort by RPE and talk test.
- **Diuretics:** fluids, HEAT on hot days.
- **Any BP medicine:** extended cool-down (COOL).
- **Isometrics** (wall sits, side planks, Pallof holds) lower resting BP and stay in the plan on GREEN BP days, always with continuous breathing.
- If the 7-day average is ≥ 140/90, the app suggests a clinician review.

**When conditions coexist:**
- Brace *while* exhaling — the back-pain bracing cue never becomes breath-holding.
- Group floor exercises and use staged rising (neuropathy and BP medicines both cause dizziness on standing).
- Supine alternatives replace head-down stretches when HEAD applies.
- New or worsening numbness routes to the back red-flag rules.
- Walking is the fallback cardio for everyone.

### 4.8 Condition → exercise-flag matrix

X = excluded · G = gated (ladder/clearance) · C = capped (RIR, range, support, hold time) · – = no change. Flags are defined in §5.3.

| Flag | Back history | Back irritable | Sciatica active | Sciatica quiet | Prolif. retinopathy | Neuropathy | Hypertension |
|---|---|---|---|---|---|---|---|
| loadedSpinalFlexion (by design) | X | X | X | X | – | – | – |
| loadedSpinalFlexion (if technique fails) | C | X | C | C | – | – | – |
| heavyAxialLoad | G | X | X | G | X | – | C (≥ 3 RIR, ≥ 6 reps) |
| high lumbar moment | G | X | X | G | C | – | C |
| loadedRotation | X | X | X | X | – | – | – |
| endRangeExtension (loaded) | C (to neutral) | C | C | C | – | – | – |
| valsalvaRisk (high) | C (≥ 2 RIR) | C | C | – | X | – | C (≥ 3 RIR, exhale) |
| headBelowHeart | – | – | – | – | X | – | C (brief; X on AMBER BP days) |
| highImpact | C | X | X | G | X | X | – |
| neuralTension (high) | – | – | X | G (G5) | – | – | – |
| neuralTension (low) | – | – | C (symptom-free range) | – | – | – | – |
| balanceDemand (high) | – | – | C (support) | – | – | X → supported | – |
| overhead / isometric hold | – | – | – | – | X | – | C (≤ 30 s, breathing) |

### 4.9 Medical clearance and disclaimers

Following the ACSM pre-participation algorithm:

| Situation | App action |
|---|---|
| No disease, no symptoms | No clearance needed; progress gradually |
| Diabetes, heart/vascular or kidney disease **and currently inactive** | Recommend clearance; light–moderate only (INT, LOAD) until the user confirms it |
| Same conditions, **already active** | Moderate work allowed; vigorous work (intervals, heavy lifts) locked until clearance is confirmed |
| Warning symptoms (chest discomfort, unusual breathlessness, fainting, ankle swelling, palpitations, leg pain on walking, unusual fatigue) | RED until cleared |
| BP ≥ 160/90 or unknown, frequent lows, complications | Recommend clearance |
| Severe/proliferative retinopathy or autonomic neuropathy | Eye or cardiac review before vigorous work |

**Disclaimers** are shown at onboarding, with key lines repeated at check-in:
- General information, not medical advice.
- Stop and get help for chest pain, faintness or severe breathlessness; the app can't detect emergencies.
- The app never changes medication or insulin doses.
- Meters, CGMs and cuffs can be wrong (CGMs lag during exercise), so treat symptoms.
- Clinician-set targets replace the defaults (the profile has fields for them).

### 4.10 Sample week (6 days, Foundation week 2, quiet back history, sciatica on one side, ladder level 2)

| Day | Mobility emphasis (day-linked) | Strength (sets × reps @ RPE, rest) | Cardio (12 min) |
|---|---|---|---|
| **Mon · Lower A (squat)** | Ankles, hip flexion/rotation, DP drill | goblet-box-squat 3 × 8 @ 6–7, 120 s · leg-press (stop before pelvis tucks) 2 × 10 @ 7 · split-squat ↔ dead-bug 2 × 8/side ↔ 2 × 6/side, 60 s · lying-leg-curl ↔ seated-calf-raise 3 × 12 ↔ 3 × 15, 45 s | Incline walk 3–6%, zone 2 |
| **Tue · Upper A (horizontal)** | Thoracic extension, shoulder rotation | dumbbell-bench-press ↔ chest-supported-row 3 × 8 ↔ 3 × 10 @ 7, 75 s · incline-dumbbell-press ↔ one-arm-dumbbell-row 2 × 10, 60 s · circuit ×2: face-pull 15, lateral-raises 15, rope-pushdown 12, hammer-curl 12 | Recumbent bike, zone 2 |
| **Wed · Lower B (single-leg + carries)** | Hip extension, adductors | hip-thrust 3 × 10 @ 7, 90 s · step-up ↔ side-plank 3 × 8/side ↔ 3 × 25 s/side, 60 s · cable-pull-through ↔ pallof-press 2 × 12 ↔ 2 × 10/side, 45 s · suitcase-carry 2 × 30 m/side | Elliptical, zone 2 |
| **Thu · Upper B (vertical)** | Overhead reach, lats | lat-pulldown ↔ half-kneeling landmine-press 3 × 10 ↔ 3 × 8/side, 60 s · seated-cable-row (knees bent) ↔ machine-chest-press 2 × 12, 60 s · circuit: lateral-raises 3 × 15, incline-dumbbell-curl 2 × 12, seated overhead-tricep-extension 2 × 12 | Recumbent-bike intervals 6 × 30 s (if cleared) |
| **Fri · Lower C (hinge)** | Hinge patterning, hamstrings in symptom-free range | trap-bar-deadlift (high handles) 3 × 6 @ 6–7, 150 s · goblet-squat ↔ bird-dog 2 × 10 ↔ 2 × 6/side, 75 s · back-extension-45 (to neutral) ↔ lying-leg-curl 2 × 12 ↔ 2 × 10, 60 s · single-leg-calf-raise 2 × 12/side | Incline walk, zone 2 |
| **Sat · Upper C (hypertrophy)** | Full-body flow, longer holds | push-ups ↔ assisted-pull-up 3 × 10–12 ↔ 3 × 8–10, 75 s · seated dumbbell-shoulder-press ↔ rear-delt-fly (chest-supported) 2 × 10 ↔ 2 × 15, 60 s · circuit ×2: cable-fly 15, lateral-raises 15, seated cable curl 10, skull-crushers 12 | Elliptical, zone 2 |
| **Sun · Rest** | Optional 15-min mobility | — | Two 15–20-min post-meal walks |

Each day's strength block models at 29.7–32.5 minutes, inside the 33-minute budget. Weekly volume lands at 96 working sets with every muscle trained 2–3×. Hamstrings and calves start low because of the pain history and rise as the gates clear. In Hypertrophy and Strength phases the same slots progress, e.g. trap bar 4 × 6–8 then low handles 4 × 5–6, and a dumbbell RDL once G5 clears.

---

## 5. Personalisation engine

The engine is a set of pure, deterministic TypeScript functions. The same inputs always produce the same plan, which makes it testable, and the plan is rebuilt whenever an input changes — profile edit, new phase, new history, or that morning's check-in.

### 5.1 Inputs and outputs

```ts
buildSessionPlan(input: {
  profile: UserProfile;          // §10.1
  date: string;                  // YYYY-MM-DD
  week: number;                  // 1–12 → phase
  history: WorkoutSession[];     // recent loads, adherence, pain trends
  checkIn?: DailyCheckIn;        // today's answers
}): SessionPlan                  // §6.1
```

### 5.2 Algorithm

```
1. dayFocus      = weeklyTemplate(profile.trainingDays, experience)[weekday]   // §4.1
   if dayFocus == rest → return restDayPlan (optional 20-min mobility + walk)
2. readiness     = evaluateCheckIn(checkIn, profile)                            // §4.6, §4.7
   if readiness == stop    → return noExercisePlan(reason)
   if readiness == recovery→ return recoveryPlan(dayFocus)                      // ~30 min
3. candidates    = slotsFor(dayFocus)            // e.g. hinge, vertical pull, horizontal pull, carry, arms
   for each slot: pick the highest-ranked exercise that
       • matches available equipment,
       • passes safetyFilter(exercise.flags, profile, readiness),             // §5.3
       • is the variant appropriate for the phase and experience,
       • was not swapped out by the user last time (respects preferences).
     otherwise take the slot's safe regression.
4. dosage        = phaseDosage(phase, slotRole, experience, readiness)         // sets, reps, RPE, rest, tempo
   apply modifiers: modified readiness → −1 set on compounds, RPE −1;
                    hypertension → no sets to failure, rest ≥ 90 s on compounds, breathing cues forced on;
                    hypo-risk meds → session-start glucose gate and 20-minute symptom prompts.
5. loads         = suggestLoad(history, exercise, reps, RPE)                   // double progression, §4.3
6. strengthSteps = expand(slots) → setup, ramp-up sets (first compound), set, rest, set …
7. fitTime(strengthSteps, budget = sessionMinutes − mobility − cardio − wrapUp)   // 60 − 15 − 12 − 1 = 32 min
   cut order when over budget: optional finisher → last accessory set → superset accessories
   (antagonist pairs only, never heavy hinge or squat) → shorten accessory rest to its minimum;
   never cut ramp-up sets or compound rest below the minimum.
8. mobilitySteps = mobilityBlock(dayFocus, profile, weekCoverage, readiness)   // §4.2
9. cardioSteps   = cardioBlock(dayFocus, profile, readiness, phase)            // §4.4
10. return assemble(intro, mobility, transition, strength, transition, cardio, wrapUp)
```

### 5.3 Exercise metadata and safety flags

Each catalogue entry carries:

```ts
interface ExerciseMeta {
  id: string;
  pattern: 'squat' | 'hinge' | 'lunge' | 'hPush' | 'hPull' | 'vPush' | 'vPull'
         | 'carry' | 'antiExtension' | 'antiRotation' | 'antiLateral' | 'isolation'
         | 'mobility' | 'stretch' | 'neural' | 'breathing' | 'cardio';
  equipment: Equipment[];            // all items required
  level: 'beginner' | 'intermediate' | 'advanced';
  regression?: string;               // exercise id
  progression?: string;
  ladder?: { track: 'hinge' | 'squat'; minLevel: 0 | 1 | 2 | 3 | 4 };
  unilateral: boolean;
  supersetEligible: boolean;
  setupSeconds: number;              // feeds the time-fitter
  flags: SafetyFlags;
}

interface SafetyFlags {              // graded where severity changes the rule (§4.8)
  spinalFlexion?: 1 | 2;             // SF: 1 = only if technique fails, 2 = by design (e.g. crunch)
  axialLoad?: 1 | 2;                 // AX: 2 = bar on back, heavy pulls, standing presses
  lumbarMoment?: 1 | 2;              // LM: hinge / shear demand
  loadedRotation?: true;             // LR: e.g. weighted Russian twist
  loadedExtension?: true;            // LE: e.g. over-arched hip thrust
  valsalva?: 1 | 2;                  // VR: 2 = heavy multi-joint lower body or near failure
  headBelowHeart?: true;             // HB: child's pose, deep folds, 45° back-extension bottom
  highImpact?: true;                 // HI: jumps, running
  sciaticTension?: 1 | 2;            // NTs: hip flexion + knee extension (+ dorsiflexion)
  femoralTension?: 1 | 2;            // NTf: hip extension + knee flexion
  deepHipFlexionLoaded?: true;       // DH: proximal hamstring tendon compression
  balance?: 1 | 2;                   // BD
  overhead?: true;                   // OH
  isometricHold?: true;              // IH
  seatedFlexion?: true;              // SX: upright bike, slumped sitting
  endRangeFlexion?: true;            // direction-specific mobility (knee-to-chest, child's pose)
  endRangeExtension?: true;          // direction-specific mobility (prone press-up)
}
```

`safetyFilter` maps the profile and today's readiness to excluded, gated or capped flags (§4.8). The direction-specific mobility flags follow the user's directional preference (§4.5).

### 5.4 "A customised plan every time"

- **Week template** is fixed for the week (predictable for the user).
- **Session plan** is recomputed when Today opens and again after the check-in; it shows *why* it changed ("Leg tingling today → swapped Romanian deadlift for cable pull-through, mobility block switched to nerve-calming version").
- **Progression** uses the last two sessions per exercise: reaching the top of the rep range at or below the target RPE for all sets → add the smallest increment next time.
- **Preference memory:** when the user swaps an exercise, the engine remembers it for that slot.

---

## 6. Guided session runtime

### 6.1 Step model

```ts
type Step =
  | { kind: 'intro' | 'blockIntro' | 'transition' | 'wrapUp'; seconds: number; script: Script }
  | { kind: 'hold'; exerciseId: string; side?: 'left' | 'right'; holdSeconds: number;
      reps: number; restBetween: number; breath: BreathPacer; script: Script }
  | { kind: 'mobilityReps'; exerciseId: string; side?: 'left' | 'right'; reps: number;
      secondsPerRep: number; script: Script }
  | { kind: 'setup'; exerciseId: string; seconds: number; script: Script }
  | { kind: 'set'; exerciseId: string; set: number; of: number; reps: number;
      tempo: Tempo; load?: Load; rampUp?: boolean; script: Script }
  | { kind: 'rest'; seconds: number; next: string; script: Script }
  | { kind: 'cardio'; modality: string; segments: CardioSegment[]; script: Script }
  | { kind: 'checkpoint'; question: CheckpointQuestion; script: Script };

interface Tempo { lower: number; pauseBottom: number; lift: number; pauseTop: number } // seconds
interface Script { onEnter: Line[]; timed: { at: number | 'perRep' | `end-${number}`; line: Line }[] }
interface Line { text: string; detail?: 'detailed' | 'standard' | 'minimal'; waitForSpeech?: boolean }
```

### 6.2 Runner

- A pure reducer (`sessionReducer(state, action)`) plus a clock that ticks from **wall-clock time**, so throttled timers still compute the correct remaining time.
- Actions: `start`, `pause`, `resume`, `next`, `previous`, `addTime(15)`, `doneEarly`, `logSet(reps, weight)`, `answerCheckpoint`, `end`.
- Intro lines marked `waitForSpeech` hold the step timer until the narrator finishes, with a timeout fallback based on word count, so a silent or failing voice never stalls the session.
- The runner drives the animation clock: during a set, the figure's lowering phase lasts exactly `tempo.lower` seconds, so voice, counter and figure move together.
- State is saved to localStorage every 5 s and on `visibilitychange`. Reopening the app offers **Resume session** at the same step.

### 6.3 Pacing rules ("therapy-like")

1. One idea per sentence; 300–600 ms pauses between sentences; a speaking rate of about 0.9–0.95 × default.
2. Instructions *before* the clock: the user is told how to get into position, then hears "Begin" and the timer starts.
3. During holds: a breath pacer (inhale 4 s, exhale 6 s ≈ 6 breaths/min), a sensation cue in the first third, a relaxation cue in the second, and a gentle "and release" with a countdown only in the last 3 s.
4. During sets: only tempo and breathing ("lower… two… three… exhale, drive"), one form cue per set, and silence on the final hard reps except the count.
5. During rest: one recovery cue, the next set's preview at 10 s left, and "get set" at 3 s.
6. Between exercises: 45–60 s of setup narration while the user walks to the station — machine adjustments first, then the movement.
7. **Verbosity:** *Detailed* the first two times an exercise appears (what, how, why, breath, feel, mistakes), *Standard* afterwards (setup reminder, breath, feel, one mistake), *Minimal* on request. ⓘ always plays the detailed version.

### 6.4 Example narration (Detailed)

**Supine figure-4, left side (hold 2 × 30 s):**
> "Next, a figure-4 stretch for the deep muscles of your left hip, including the piriformis, which sits right over the sciatic nerve. Lie on your back, knees bent. Cross your left ankle over your right knee and let your left knee fall open. Reach through the gap and hold the back of your right thigh. Keep your head and shoulders relaxed on the mat. Gently draw the right knee toward you until you feel a stretch deep in the left buttock — a 4 out of 10, not more. If you feel tingling or pain travelling down the leg, ease off. Begin. … Breathe in through your nose for four. … And out for six, letting the knee sink open. … Good. Soften your jaw and shoulders. … Three, two, one, and release."

**Setup + set, trap-bar deadlift (high handles; set 1 of 3, 6 reps):**
> "Step into the middle of the trap bar, feet hip-width, the handles level with the middle of your feet. Push your hips back, bend your knees, and grip the high handles. Long spine, chest proud, eyes a few metres ahead. Breathe into your belly and brace, as if someone were about to poke your stomach — and keep breathing behind that brace; never hold your breath. … Exhale and push the floor away. Stand tall and squeeze your glutes; don't lean back. … Now lower with control: hips back first, then the knees, two, three. Touch and go. … That's one. You should feel your glutes and thighs working, not your lower back. If anything travels down your leg, stop and tap 'Worse'."

**Cardio, incline walk (12 min):**
> "Set the treadmill to 3 percent incline and a comfortable pace for two minutes. … Now raise the incline to 6 to 8 percent. You should be able to talk in full sentences but not sing — about a 5 or 6 out of 10. Stand tall, let your arms swing, and don't hold the rails. …"

### 6.5 Audio cues

A soft chime for "begin", a tick for 3-2-1, and a low tone for "rest". They ship as tiny pre-rendered clips played through the same `<audio>` channel as the narration, not Web Audio, because of the iOS bug in §7.1. They keep working with narration muted, and a short vibration accompanies them on phones that support it.

### 6.6 Logging

Each completed set writes reps and weight; after the last set of an exercise the user may tap an RPE. Hinge, squat and lunge exercises are followed by a one-tap symptom checkpoint ("Back or leg feeling: Same / Better / Worse"). Worse triggers the regression rule in §4.5. The guided session saves as a normal `WorkoutSession` (so History, Progress and PRs keep working) with added `mobility`, `cardio` and `checkIn` fields.

---

## 7. Voice

Full findings, bug references and code: `docs/research/voice-narration.md`.

### 7.1 Constraints that shape the design

- **iPhone web apps only get the basic system voices.** Enhanced/Premium voices downloaded in iOS Settings and Siri voices are *not* available to web pages (open WebKit bug), whichever iOS browser you use. Device speech on iPhone will therefore always sound fairly robotic.
- **On-phone neural speech isn't ready.** Kokoro, the best open model, needs an 86–326 MB download, runs slower than real time without the GPU, and its GPU mode has produced corrupted audio on Android. Its JavaScript phonemizer also bundles GPL-3.0 code.
- **Runtime cloud voices can't be secured on a static site.** Any credential in the app is public; abuse of default Amazon Polly limits could cost about $33k/day. ARCC guidance also discourages unauthenticated (guest) Cognito access. **Rejected.**
- **iOS Home Screen apps:**
  - Screen Wake Lock only from iOS 18.4.
  - Background audio and lock-screen controls have open bugs.
  - The design assumes screen-on, foreground use.
- **iOS 27 bug:** after speech synthesis has run, Web Audio stays silent until reload. Speech and Web Audio are never mixed in one session.
- **Timers:** the existing `useTimer`/`useSupersetTimer` count interval ticks, so they drift and freeze when the browser throttles the page. All session timing moves to wall-clock anchors.
- **Caching bug:** `public/sw.js` caches 206 (partial) responses, which audio playback generates and the Cache API rejects. Fixed as part of this work.

### 7.2 Recommendation: pre-recorded neural narration, device speech as fallback

The coaching script is known in advance, so it is rendered **once, at build time**, with a natural neural voice. Phones then just play audio.

| Phase | Voice | Ships in |
|---|---|---|
| **0 — Device speech** | `speechSynthesis` with the best-ranked voice, sentence chunks ≤ 140 characters, watchdog timers, 300–600 ms gaps, rate 0.92 | M2 (works everywhere, nothing to download) |
| **1 — Neural clip pack** | **Kokoro-82M** (Apache-2.0 weights), voice `af_heart` (the model's top-rated voice), speed ~0.85 with inserted pauses | M5 |
| 2 — Polish | Earphone/lock-screen controls (Media Session), "Over my music" mode, catch-up line after returning from background, short/long line variants fitted to gaps | M5–M6 |
| 3 — Optional | Web Audio phrase stitching; re-test on-device neural speech when phones are ready | Later |

**Clip pipeline (dev machine only; nothing here ships to users except the audio):**
1. A script turns the coaching content (§9), plan templates and fixed phrases into `{id, text, variant}` lines.
2. Python `kokoro` renders each sentence, and silences are inserted between sentences. Pronunciations are fixed inline with misaki syntax. The GPL eSpeak fallback runs only on the build machine.
3. `ffmpeg` encodes **Ogg Opus 32 kbps** (main) and **AAC 48 kbps** (fallback for older Safari).
4. Files are named by a hash of text + voice + speed + model, so only changed lines re-render. A `manifest.json` records every clip's duration, which lets the scheduler know exactly how long each line takes.
5. Output goes to `public/voice/af_heart/`.

| | Size |
|---|---|
| Full pack (~2 h of speech) | ~28 MB Opus / ~45 MB AAC; each device downloads one codec |
| Today's session only | a few MB, pre-fetched when Today opens; "download all" offered for offline use |
| Rendering time | ~18 min for 2 h of audio on the dev machine |

**Dynamic phrases** come from a finite set, so they are pre-rendered as whole phrases with natural intonation: "Set two of four", reps 1–30, durations 5–300 s in 5 s steps, exercise names. That is roughly 1,000 phrases, ~7 MB. Weights are spoken without numbers ("same weight as last time", "one step heavier") while the exact number shows on screen.

**Alternative voice source:** Amazon Polly neural/generative at **build time only** (~$2–3 one-off for the whole catalogue; the key stays on the dev machine; Polly's terms allow storing and replaying output). This is worth an A/B listen against Kokoro before M5.

### 7.3 Architecture

```
Timeline (pure data: steps → cues with priority, anchor time, alignment)
   │
SessionClock ── epoch-ms anchors; pause/resume; recompute on visibilitychange; 4 Hz UI tick
   │
CueScheduler ── 10 s look-ahead; fits lines into gaps; preempts by priority
   │
Narrator ──► ClipNarrator   (one reused <audio> element, cached Blob URLs)   if the pack is cached
         ──► SpeechNarrator (speechSynthesis)                                  else if a voice ranks ≥ 0
         ──► CaptionNarrator (captions + vibration + visual pulse)             else
SessionControls ── Wake Lock · Media Session · navigator.audioSession.type
```

- **Priorities:**
  - **P0 safety** preempts everything.
  - **P1** — countdowns, "switch sides", "rest", "go" — preempts P2/P3 with a 150 ms fade and is dropped if stale.
  - **P2** — what / how / why / breathing / feel — plays only if it fits before the next P1 cue; otherwise its short variant plays or it is skipped (still shown as a caption).
  - **P3** encouragement fills leftover gaps.
- **End-aligned countdowns:** a "3, 2, 1, switch" clip is scheduled so that "switch" lands exactly at zero.
- **Start tap does everything synchronously, before any `await`:** set `navigator.audioSession.type = 'playback'`, play the first clip, request the wake lock, and unlock speech if it's the active narrator (iOS ignores audio and speech started outside a tap).
- **Health checks:**
  - `play()` rejected → show "Tap to resume audio".
  - Playback not advancing after 1.5 s → recreate the element or fall back to the next narrator.
  - Page visible again → rebuild state from the wall clock, drop stale cues, and say one catch-up line ("You're in your rest — 20 seconds left").
- **Earphone and lock-screen buttons** (where supported): play/pause → pause/resume the session · next → skip step · previous → repeat the last instruction. Large on-screen buttons remain the primary controls because of the iOS bugs above.
- **Music:**
  - Default **Coach mode** (`playback`): music pauses; the coach plays even with the Silent switch on.
  - Opt-in **Over my music** mode (`ambient` on iOS; clips under 5 s on Android so music only dips): silenced by the Silent switch and screen lock; shown with a warning.
- **Wake lock** is re-requested on every `visibilitychange`. Where it's missing (Home Screen app before iOS 18.4), the app suggests Auto-Lock = Never or running in a Safari tab.

### 7.4 Voice settings and first-run check

The first session asks for a short voice check:
- A sample line in the coach voice (the neural pack once downloaded, otherwise the best device voice).
- Speed slider 0.8–1.1.
- Coach vs Over-my-music mode.
- Verbosity (Auto / Detailed / Standard / Minimal).

Settings keep these, plus a "download voice pack for offline" button showing size and storage used. On desktop Edge, the ranking picks the high-quality "Natural" online voices automatically while online.

---

## 8. Animation system

Full comparison, licences and verified API snippets: `docs/research/animation-libraries.md`.

### 8.1 What's wrong today (baseline screenshots, 320 × 568)

- **Mixed perspectives:** a side-view body holds front-view equipment. The barbell squat shows the bar sticking out in front of the chest instead of resting on the upper back, and dumbbells appear as horizontal bars.
- **Movements the camera can't show:** a lateral raise drawn from the side looks like a front raise; the cable fly looks like a sagittal arm swing.
- **Broken anatomy:**
  - The hip-opener "lunge" has the back shin pointing forward under the body, and neither knee touches the floor.
  - Several figures stand on one leg because the far leg isn't constrained.
  - Coordinates are interpolated between key poses, so limbs shrink mid-movement.
- **Limited model:** one rigid torso segment can't show a rounded or neutral back, so the most important back-safety cues can't be demonstrated at all.

### 8.2 Options considered

| Option | Fidelity | Licence | Size (gzip) | Shows mistakes | Verdict |
|---|---|---|---|---|---|
| **three.js r186 + CC0 MakeHuman (MPFB2) skinned human** | Realistic body; clavicles; 3–5 spine bones | MIT + CC0 | ~194 KB three.js + 0.2–0.4 MB model | Yes (spinal flexion, knee valgus, shrugs) | **Recommended** |
| three.js + Quaternius Universal Base Character | Stylised-realistic, ~13k triangles | MIT + CC0 | similar | Likely (spine bones unverified) | Fallback model |
| three.js + procedural mannequin (capsule/lathe body parts on our own skeleton) | Clean artist's-mannequin look | MIT + own | ~194 KB, no model file | Yes | Contingency if the model pipeline fails |
| mannequin.js | Wooden mannequin | **GPL-3.0** (would force the whole app to GPL); creates its own full-screen canvas and a `user-scalable=no` viewport tag | ~30 KB + three.js | Partial — rigid torso, no shoulder girdle | Rejected |
| Mixamo clips | Mocap | Royalty-free; redistribution unclear | 1–3 MB per rig | No; no props or machines | Reference only |
| Text-to-motion (MDM, MoMask) | Mocap-like | Code MIT; training data (AMASS/SMPL) non-commercial | — | No | Rejected |
| Babylon.js | Same as three.js | Apache-2.0 | ~0.7–1.85 MB | Yes | Heavier for no gain |
| Lottie / Rive | Fixed 2D view | Mixed; few free exercise files; Rive free exports show a splash | 46–819 KB | Only if hand-drawn | Rejected |

### 8.3 Recommended architecture

```
motion/*.json (keyframes, 1–3 KB each)                         ┌─────────────────────┐
        │                                                       │ Session runner clock│
        ▼                                                       └──────────┬──────────┘
 buildClip() → three.js AnimationClip ──▶ AnimationMixer.setTime(t) ◀──────┘  (tempo-synced t)
                                               │
                                     additive mistake clip (weight 0→1)
                                               │
                                     two-bone IK pass (planted feet/hands, prop grips)
                                               │
                                     muscle uniforms (worked / stretched per phase)
                                               │
                                        one shared WebGLRenderer → canvas in the mounted viewer
```

- **Model:** one CC0 human exported from MakeHuman's Blender add-on (MPFB2) with the 53-bone "game engine" rig: pelvis, three spine bones, clavicles, thigh/calf/foot/ball. Decimated to ~15k triangles, meshopt-compressed, about 0.2–0.4 MB. Neutral athletic proportions, plain fitted clothing, no face detail beyond a clear facing direction.
- **Model pipeline (one-off, scripted):** headless Blender + MPFB2 → generate the body → add the rig → compute a per-vertex `_MUSCLE` id → export GLB → `gltf-transform optimize`. The muscle id is derived from bone weights plus position relative to the bone (e.g. thigh-weighted vertices on the front surface = quadriceps). This needs Blender installed on the dev machine (`brew install --cask blender`, ~1 GB); **I'll ask before installing it.** If the pipeline proves unreliable, the Quaternius model is the fallback, and the procedural mannequin the contingency.
- **Clip format (data, not code):**

```ts
interface ExerciseMotion {
  id: string;
  plane: 'sagittal' | 'frontal' | 'transverse';
  camera: { preset: 'side' | 'threeQuarter' | 'front' | 'high'; azimuth?: number; elevation?: number };
  equipment: { kind: EquipmentKind; attach?: string; anchors?: Record<string, Vec3> }[];
  contacts: { effector: 'footL' | 'footR' | 'handL' | 'handR' | 'kneeL' | 'kneeR' | 'forearmL' | 'forearmR';
              target: 'planted' | `prop:${string}`; from?: number; to?: number }[];
  muscles: { worked: MuscleId[]; stretched?: MuscleId[] };
  keyframes: { t: number; bones: Record<string, [number, number, number]>; root?: [number, number, number];
               phase?: 'concentric' | 'eccentric' | 'hold' | 'pause'; breath?: 'in' | 'out'; cue?: string }[];
  mistakes: { id: string; label: string; faultBones: string[]; camera?: CameraPreset;
              keyframes: ExerciseMotion['keyframes'] }[];        // additive deltas
}
```

- **Sync with the voice:** the session runner owns the clip's time. During a set, the lowering phase lasts exactly `tempo.lower` seconds. Holds wait for the narration line to finish. Phase and breath markers drive the on-screen "inhale / exhale" pacer and captions.
- **Contacts:** a 25-line analytic two-bone IK pass after the mixer keeps planted feet and hands fixed. It also puts hands on bar grips and feet on pedals and leg-press plates, so nothing slides or floats.
- **Equipment:** built from three.js primitives with named anchors, so no asset files are needed. Items:
  - barbell + plates, trap bar, dumbbells, kettlebell
  - flat and incline bench, mat, chair, wall/doorway, foam roller, strap, band
  - cable column with pulley and handle, rope or bar
  - lat pulldown, leg press (moving sled), chest/shoulder press machine
  - leg-curl machine, 45° back-extension bench
  - treadmill, upright/recumbent bike, elliptical

  Held props attach to hand bones, moving props get their own tracks (bar path, sled, crank), and fixed props sit relative to the pelvis.
- **Muscle highlighting:** a small shader patch reads the vertex muscle id. Worked muscles glow orange on the contraction phase; stretched muscles glow blue during holds. A legend under the figure names them ("Working: lats, rear delts · Stretching: —").
- **Correct vs mistakes:** **Show mistake** fades in an additive clip over 0.3 s, pulses the fault bones red, switches to the most revealing camera (knee cave → front), and captions it ("Lower back rounds — risk: disc strain"). It then replays the correct form in green with the fix ("Push hips back, chest proud"). An optional translucent ghost shows the correct form alongside the mistake.
- **Camera:** the default follows the plane of motion — side or three-quarter for sagittal moves, front for frontal (lateral raise, fly), front-high for rotations. Drag to rotate (azimuth free, elevation clamped, no zoom or pan) only in the expanded viewer so page scrolling still works; a **Reset view** button returns to the default.
- **Rendering budget:**
  - Scene: ≤ 20k triangles, ≤ 10 draw calls, hemisphere + directional light, a blob contact shadow (no shadow maps), DPR capped at 2.
  - CPU: mixer + IK under 1 ms per frame.
  - Idle: no rendering while paused, off-screen or hidden.
  - **Verify:** a performance spike on a mid-range Android and an older iPhone happens before committing to the model.
- **One WebGL context:** browsers cap active contexts (~8–16) and silently drop the oldest, so a module-level renderer moves its single canvas into whichever viewer is mounted. Side-by-side views (correct vs mistake) use scissor rendering on that one canvas.
- **Static frames everywhere else:** a build step renders each clip's key poses (start / peak / mistake) to small WebP "poster frames" with headless Chromium. These are used for Library lists and the plan preview, and when WebGL is unavailable. So no screen ever falls back to the old SVG figure.
- **Lazy loading and offline:** `React.lazy` keeps three.js out of the main bundle; the 3D chunk, model and motion JSON are pre-cached by the service worker. Asset URLs use `import.meta.env.BASE_URL` (base `/fit-strong-90/`).
- **Accessibility:** autoplaying motion over 5 s always has a pause control (WCAG 2.2.2), and every animation has a text description and captions.

### 8.4 Authoring and QA

- **Authoring:** each clip is about 10 keyframes of bone rotations per exercise, plus 1–3 mistake deltas, written against base poses (standing, seated, supine, prone, quadruped, half-kneeling, side-lying, hinge). Angles and mistake magnitudes come straight from the technique research — e.g. "lumbar flexes ~20–30°", "knees cave ~10–15°". A dev-only pose editor (three.js `TransformControls` + lil-gui, both in `three/addons`) speeds up tuning.
- **Automated tests (no GPU needed — run the skeleton maths headless):**
  - joint angles stay inside anatomical limits (no knee or elbow hyperextension beyond 5°, spine and neck ranges)
  - planted contacts move < 0.5 cm
  - nothing below the floor
  - IK error < 0.5 cm
  - every catalogue id has a clip and every coaching mistake links to an existing mistake clip
- **Visual review:** contact sheets of every clip (4 key frames × correct and mistakes) at two camera angles, reviewed before each milestone closes.
- **Later option:** camera-based form feedback with MediaPipe Pose Landmarker (Apache-2.0, ~3.4 MB WASM + 5.8 MB model) as an opt-in download that maps landmarks onto the same joint-angle schema.

---

## 9. Content model

Each exercise, stretch and cardio protocol has a coaching record. A schema test fails the build if any field is missing or empty.

```ts
interface Coaching {
  id: string;
  name: string;
  muscles: { primary: string[]; secondary: string[] };
  setup: string[];            // incl. machine adjustments, read before the first set
  steps: string[];            // 4–7 imperative steps
  tempo?: Tempo;              // strength
  dosage?: { holdSeconds?: number; reps?: number; sides?: 'each' | 'affected' | 'none' }; // mobility
  breathing: string;          // when to inhale, exhale, brace
  feel: string;               // where to feel it
  shouldNotFeel: string;      // e.g. pain down the leg, pinching
  why: string;                // one or two sentences on the benefit
  mistakes: { mistake: string; risk: string; fix: string; clip: string }[]; // clip → animation variant
  backSafety: { status: 'ok' | 'modify' | 'avoidWhenIrritable'; note: string; regression?: string };
  cues: string[];             // 3–5 short in-set cues
  youtube: { tutorial: string; mistakes: string };  // search queries
  sources: string[];          // URLs, kept for review
}
```

Content is drafted from the research files, cross-checked against at least one authoritative source per exercise, and reviewed in a contact sheet (text plus animation frames) before release.

---

## 10. Data, privacy and security

### 10.1 Data model (AppData v3)

```ts
interface UserProfile {
  weightKg: number; heightCm?: number; birthYear?: number;
  experience: 'beginner' | 'intermediate' | 'advanced';
  trainingDays: DayOfWeek[]; sessionMinutes: 45 | 60 | 75;
  equipment: 'fullGym' | 'homeDumbbells' | 'homeNone';
  goals: ('strong' | 'lean' | 'flexible' | 'athletic' | 'painFreeBack')[];
  pain: { areas: PainArea[]; sciaticaSide?: 'left' | 'right' | 'both';
          worseWith?: 'flexion' | 'extension' | 'unknown' };
  health: HealthProfile;
  ladder: { hinge: 0 | 1 | 2 | 3 | 4; squat: 0 | 1 | 2 | 3 | 4; neuralGate: boolean };
  flexibilityTargets: MobilityRegion[];       // 2–3 per 12-week block (§4.2)
  voice: { voiceURI?: string; rate: number; verbosity: 'auto' | 'detailed' | 'standard' | 'minimal' };
}

interface HealthProfile {                     // from diabetes-hypertension-exercise.md §4
  diabetes: 'none' | 'prediabetes' | 'type1' | 'type2' | 'other';
  insulin: 'none' | 'injections_or_pump' | 'automated_delivery';
  sulfonylureaOrMeglitinide: boolean;
  sglt2i: boolean;
  highHypoRisk: boolean;                      // impaired awareness, or severe low in past 6 months
  hypertension: 'none' | 'treated' | 'untreated' | 'unsure';
  betaBlocker: boolean;
  diuretic: boolean;
  heartOrVascularDisease: boolean;
  kidneyDisease: 'none' | 'ckd' | 'dialysis_or_transplant' | 'unsure';
  retinopathy: 'none_or_mild' | 'moderate' | 'severe_or_proliferative' | 'recent_eye_treatment' | 'unknown';
  peripheralNeuropathy: 'no' | 'yes' | 'unsure';
  footStatus: 'healthy' | 'past_ulcer_or_charcot' | 'current_wound_or_active_charcot';
  dizzyOnStandingOrAutonomicNeuropathy: boolean;
  glucoseMonitor: 'none' | 'meter' | 'cgm';
  glucoseUnit: 'mg/dL' | 'mmol/L';
  ketoneTest: 'none' | 'urine' | 'blood';
  bpMonitor: boolean;
  currentlyActive: boolean;                   // ACSM definition, for clearance logic
  clearance: 'none' | 'moderate' | 'vigorous';
  clinicianTargets?: { glucoseStartMin?: number; bpStopSystolic?: number };
}
// Derived, never stored: hypoRisk, ketoneRisk, onBpMeds (§4.6). Conservative defaults when unsure (§4.6).

interface DailyCheckIn {
  date: string;
  urgentSymptoms: boolean;                    // cardiac / stroke / vision red flags
  back?: { pain: number; legPain?: number; reach?: 'back' | 'buttock' | 'thigh' | 'belowKnee' | 'foot';
           newNeuro: boolean; caudaEquinaFlag: boolean };
  news: ('unwell' | 'lowOne' | 'lowTwoPlus' | 'lowSevere' | 'fainted' | 'dizzy' | 'footProblem'
         | 'steroid' | 'hot' | 'unusualFatigue')[];
  glucose?: { value: number; unit: 'mg/dL' | 'mmol/L'; trend?: 'rising' | 'flat' | 'slowFall' | 'fastFall';
              rapidInsulinLast2h?: boolean };
  ketones?: { value: number; kind: 'blood' | 'urine' };
  bp?: { sys: number; dia: number };          // average of two readings
  sleep: 'lt5' | '5to7' | 'gt7'; energy: 1 | 2 | 3 | 4 | 5;
  outcome: 'green' | 'amber' | 'recovery' | 'red' | 'urgent';
  modifiers: ('INT' | 'LOAD' | 'HEAD' | 'IMPACT' | 'FOOT' | 'COOL' | 'HYPO' | 'HEAT')[];
  reasons: string[];                          // shown to the user
}
```

- `WorkoutSession` gains optional `guided`, `mobility`, `cardio`, `checkIn` and `painAfter` fields.
- **Migration v2 → v3** creates a profile from existing settings (weight, goal, start date, units) with safe defaults, keeps all sessions, and asks the user to complete the health screen the next time they open Today. A unit test covers the migration.

### 10.2 Privacy

- Health data stays in the browser's localStorage. There is no network call that carries profile or check-in data, and no analytics.
- The JSON export contains health data; the export dialog says so before saving.
- **Clear all data** in Settings removes everything (existing behaviour, re-verified).

### 10.3 Security (ARCC guidance applied)

ARCC was queried via the `arcc` CLI. Its guidance for web apps handling sensitive data is to enforce a restrictive Content Security Policy and secure headers. GitHub Pages cannot set response headers, so the app ships the CSP as a `<meta http-equiv>` tag (ARCC prefers headers; this is the closest available control on static hosting):

```
default-src 'self'; script-src 'self'; style-src 'self'; style-src-attr 'unsafe-inline';
img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; worker-src 'self';
object-src 'none'; base-uri 'self'; form-action 'none'
```

- **Scripts:** no `unsafe-inline` or `unsafe-eval`. A WebAssembly voice engine, if ever adopted, would need `'wasm-unsafe-eval'` as an explicit, scoped exception.
- **Styles:** only stylesheets from the app's own origin, plus inline styles. **Shipped deviation:** the intended `style-src 'self'; style-src-attr 'unsafe-inline'` had to become `style-src 'self' 'unsafe-inline'`, because the toast library (sonner) injects its entire stylesheet as a `<style>` element when the module loads, and it ships no way to turn that off. Pinning its hash would silently unstyle every toast on a version bump. Inline styles carry no script, `script-src 'self'` is unchanged, and the app has no injection sink: no `dangerouslySetInnerHTML`, no user-generated content, no third-party embeds.
- **Applied to production builds only**, because the Vite dev server injects styles. M6 loads every screen with the policy enforced and fails on any CSP violation.
- `frame-ancestors` is ignored in `<meta>` CSP; clickjacking protection needs a response header GitHub Pages can't set. Noted as a residual risk, and low for an app with no account or payment actions.
- No `dangerouslySetInnerHTML`; all coaching text renders as React text nodes.
- YouTube is reached through plain links in a new tab (`rel="noopener noreferrer"`), never embedded, so no third-party frames or scripts load.
- `Referrer-Policy: strict-origin-when-cross-origin` via `<meta name="referrer">`.

---

## 11. Mobile UI and responsive strategy

Baseline audit at 320 × 568 (current app) found: Library category tabs clipped at both ends, difficulty tabs wrapping into a broken grid, and animations too small to read. The new UI follows these rules:

- **Viewports tested:** 320 × 568, 360 × 640, 360 × 800, 375 × 667, 390 × 844, 412 × 915, 430 × 932, plus landscape 568 × 320 and 844 × 390.
- Layout uses `dvh`/`svh` units and flex columns, so the session player fits without scrolling on 568 px tall screens; nothing important sits under the home indicator (existing safe-area utilities).
- Tap targets ≥ 44 × 44 px; primary actions 56 px tall; minimum text 14 px (12 px only for secondary labels).
- Chip groups wrap instead of scrolling horizontally; horizontal scrollers get edge fades and start flush with padding.
- Session player text is large (step title 20 px, timer 40 px), high-contrast, and readable from a phone lying on the floor.
- Respects `prefers-reduced-motion` and dark mode. UI motion turns off. The 3D form demos still play, because the movement is the instruction, and in that mode they always show a pause button (changed 2026-10-07 at the user's request).
- Voice is never the only channel: every spoken line is also shown as a caption.

---

## 12. Testing and QA

| Layer | What | Tool |
|---|---|---|
| Plan engine | time budget per day type (±2 min), safety filters per condition, substitution, coverage of all body regions per week, progression | Vitest |
| Check-in rules | every threshold row in §4.6/§4.7 as a table-driven test | Vitest |
| Runner | step transitions, pause/resume, done early, resume after reload, wall-clock accuracy under throttling | Vitest + fake clock |
| Narrator | sentence chunking, onend timeout fallback, priority queue, voice ranking | Vitest + fake speechSynthesis |
| Animations | joint limits, planted contacts within 0.5 units, nothing through the floor, bounds, every catalogue id has correct + mistake clips | Vitest |
| Content | schema completeness, mistakes link to existing clips | Vitest |
| Journey | profile → check-in → full session at 30× time scale → summary → history, at every viewport in §11 | Playwright (headless Chromium), screenshots per step |
| Visual review | contact sheets of every clip (key frames, correct and mistake) and every screen at 320 px and 430 px | Screenshot harness |

The 30× time scale is a dev-only query parameter (`?timescale=30`) read by the runner clock; production builds ignore it.

---

## 13. Delivery milestones

Each milestone ends with tests green, a build, and a screenshot review at 320 px and 430 px before the next one starts.

| # | Milestone | Acceptance |
|---|---|---|
| M1 | **Foundations.** Includes:<br>• Data v3 + migration<br>• 3-screen profile<br>• Check-in + rule engine (§4.5–§4.7)<br>• Plan engine (templates, slots, ladder, phase dosage, time-fitter, mobility linking and coverage, cardio)<br>• Catalogue metadata and flags | • Table-driven tests for every threshold row<br>• Time budget within ±2 min for every day type<br>• Weekly region coverage<br>• Onboarding and check-in screenshot-reviewed at 320 px |
| M2 | **Guided session v1.** Includes:<br>• Wall-clock runner and cue scheduler<br>• Device-speech narrator (Phase 0) with captions<br>• Session player UI<br>• Logging into `WorkoutSession`, resume after reload, wake lock<br>• Clean text/illustration placeholder where the figure will go | • Full journey runs at 30× in Playwright at every viewport in §11<br>• Resume works<br>• Narration reviewed by ear on desktop |
| M3 | **3D viewer + mobility clips.** Includes:<br>• Performance spike on real phones first<br>• Model pipeline (Blender, with your OK)<br>• Clip builder, IK, muscle shader, equipment kit, camera presets<br>• All mobility clips (the session starts with them)<br>• Poster-frame build step | • Geometry tests green<br>• Contact-sheet review of every mobility clip<br>• Smooth on a mid-range phone, or a documented fallback |
| M4 | **Strength and cardio clips.** Includes:<br>• All strength and cardio clips, with mistake variants<br>• Library integration (correct/mistake viewer, YouTube searches)<br>• Plan week view | • Every catalogue id has correct + mistake clips<br>• Library and Plan reviewed at 320 px |
| M5 | **Coaching content and neural voice.** Includes:<br>• Coaching records for the full catalogue (schema-tested)<br>• Narration script builder<br>• Kokoro clip pack (with your OK) + clip narrator + prefetch<br>• `sw.js` 206 fix | • Schema test green<br>• Full-session listen-through on iPhone and Android |
| M6 | **Polish.** Includes:<br>• Earphone/lock-screen controls<br>• Over-my-music mode, catch-up lines<br>• Accessibility<br>• Offline precache, CSP<br>• Multi-device QA | • Journey green at every viewport<br>• Accessibility checks pass<br>• An offline session works end to end |

M1 + M2 already give a usable voice-guided 60-minute session; M3–M5 raise it to the full visual and audio quality. Each milestone is reviewed with you before the next starts.

---

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| iPhone web voices sound robotic (Premium/Siri voices unavailable to web pages) | Pre-recorded neural voice pack (§7.2); device speech only as fallback |
| iOS stops audio or timers when the screen locks; Home Screen app bugs | Screen Wake Lock (re-requested on visibility), wall-clock timers, catch-up line, resume prompt; Safari-tab fallback advice (§7.3) |
| Voice pack download size (~28 MB full) | Per-session prefetch of a few MB; full pack optional; persistent-storage request; quota errors handled |
| Dev-machine tools (Blender, Python `kokoro`, ffmpeg) | One-off asset pipelines; outputs committed so users and CI never need them; installs only with your OK |
| Animation authoring effort (~95 clips × correct + mistakes) | Reusable base poses, IK for contacts, automated geometry tests, contact-sheet review |
| Exercise advice could be wrong for an individual | Conservative defaults, symptom-driven regressions, clearance prompts, every rule sourced |
| Performance on low-end phones | One WebGL context, render only the visible figure, lazy-load the 3D module, cap pixel ratio at 2 |
| Session overruns 60 min | Time-fitter with a fixed cut order; live "running 2 min over — skipping the finisher" message |

---

## 15. Open questions

1. **Gym or home:** a full gym every training day, or are some days at home? (Equipment can differ per day.)
2. **Rest days:** add an optional 20-minute mobility + walk session?
3. **Installs:** OK to install Blender (~1 GB, M3) and Python `kokoro` + ffmpeg (M5) on this Mac for the one-off asset pipelines?
4. **Voice:** Kokoro `af_heart` (female, top-rated) as the default coach voice? Kokoro's male voices are rated noticeably lower; a build-time Polly voice is the alternative if you want a male coach.
5. **Flexibility targets:** pick 2–3 regions to prioritise for the first 12 weeks (e.g. hamstrings, hips, thoracic spine), or let the app suggest them from quick tests?

---

## Appendices

### Appendix A — Strength catalogue (target state)

Flag codes as in §5.3: SF = loaded spinal flexion (1 if technique fails, 2 by design), AX = axial load, LM = lumbar moment, VR = Valsalva risk, LR = loaded rotation, LE = loaded extension, HB = head below heart, HI = high impact, NTs/NTf = sciatic/femoral nerve tension, BD = balance demand, OH = overhead, IH = isometric hold, SX = seated flexion. "Ladder" = minimum spinal-loading level from §4.3. Full technique per exercise (setup, steps, breathing, feel, mistakes, sources) is in `technique-upper-body.md` and `technique-lower-body-core.md`.

| Pattern | Exercise | Flags | Ladder / status for back profiles |
|---|---|---|---|
| Squat | goblet-box-squat ✚ | AX1 VR1 | S1 · preferred start |
| | goblet-squat | AX1 VR1 | S2 · preferred |
| | leg-press | SF1 (deep) VR2 | S2 · stop before the pelvis tucks; HTN ≥ 3 RIR |
| | barbell-squat | SF1 AX2 LM1 VR2 | S4 only |
| Single-leg | split-squat ✚ · step-up ✚ · reverse-lunge ✚ | NTf1 · BD1 | S1–S2 |
| | rear-foot-elevated-split-squat ✚ · walking-lunges | BD2 NTf2 · AX1 BD2 | S3 |
| | single-leg-rdl ✚ | NTs2 BD2 | H2–H3, after G5 |
| Hinge | glute-bridge ✚ | — | H0 |
| | hip-thrust | LE (if over-arched) VR1 | H1 · preferred |
| | cable-pull-through ✚ · kettlebell-deadlift ✚ | LM1 | H1 |
| | back-extension-45 ✚ | HB NTs1 | H0 hold → H2 dynamic, to neutral only |
| | trap-bar-deadlift ✚ | AX1–2 LM1 VR2 | H2 high handles → H3 low |
| | romanian-deadlift | SF1 LM2 VR1 NTs2 | H3 + G5 |
| | rack-pull | AX2 LM1 VR2 | H3, ≤ trap-bar load |
| | deadlift | SF1 AX2 LM2 VR2 NTs1 | H4 only |
| Horizontal push | dumbbell-bench-press · machine-chest-press · incline-dumbbell-press · push-ups · cable-fly | VR1 | OK |
| Horizontal pull | chest-supported-row | VR1 | Preferred |
| | one-arm-dumbbell-row | VR1 | OK; chest-supported during leg flare |
| | seated-cable-row | SF1 VR1 (NTs1 if knees straight) | Knees bent |
| | face-pull · rear-delt-fly (chest-supported) | — | OK |
| Vertical push | landmine-press ✚ (half-kneeling) | VR1 | Preferred |
| | dumbbell-shoulder-press · machine-shoulder-press | OH VR1 | Seated, back supported |
| | arnold-press | OH VR1 LR (shoulder) | Seated only, optional |
| | lateral-raises | — | OK |
| Vertical pull | lat-pulldown · assisted-pull-up ✚ | VR1 | OK |
| Arms | incline-dumbbell-curl · hammer-curl · seated cable curl ✚ · rope-pushdown · skull-crushers | — | OK |
| | barbell-curl | (lumbar swing) | Back profiles → seated curl |
| | overhead-tricep-extension | OH | Seated, back supported |
| Knee flexion / calves | lying-leg-curl ✚ | — | Preferred with sciatica |
| | seated-leg-curl ✚ | NTs1 | When sciatica is quiet |
| | seated-calf-raise ✚ · single-leg-calf-raise ✚ | — | Preferred |
| | calf-raises (standing machine) | AX1 | Optional |
| Core: anti-extension | dead-bug · mcgill-curl-up ✚ · plank (≤ 30 s) | IH VR1 | Daily options |
| Core: anti-rotation / lateral | bird-dog ✚ · side-plank ✚ · pallof-press ✚ · suitcase-carry ✚ · farmer-carry ✚ | IH · AX1 | Daily options |
| Core: rotation | cable-chop ✚ (turn through hips and upper back) | — | After Foundation |
| Retired from default plans | russian-twist (SF2 LR) → pallof-press · cable-crunch (SF2) → mcgill-curl-up · hanging-knee-raise (SF1 VR1) → dead bug / captain's chair after Foundation | | |
| Cardio | incline-treadmill-walk · brisk-walk · recumbent-bike ✚ · elliptical ✚ · upright-bike (SX) | — | rowing-machine only from H3; running gated |

✚ = new catalogue entry.

### Appendix B — Mobility catalogue

From `technique-mobility-cardio.md` (full setup, steps, dosage, breathing, stop rules, mistakes, cues and sources per item). "Irritable swap" is applied automatically on Amber/Red days or with a nerve flag.

| Region | Item | Back / sciatica | Irritable swap or key modification |
|---|---|---|---|
| Neck | chin-tuck | OK | Lying version if seated is uncomfortable |
| | upper-trap-stretch | OK | Arm tingling → ease off |
| | levator-scapulae-stretch | OK | Hand weight only, no pulling |
| Upper back | cat-cow (cat-camel) | Modify | Half range in the direction that eases symptoms |
| | thread-the-needle | OK | Hips stay square over knees |
| | open-book | OK | Knees stacked on a cushion |
| | foam-roller-thoracic-extension | OK | Mid-back only; seated version with osteoporosis |
| Shoulders, chest, arms | doorway-pec-stretch | OK | Ribs down, elbows ≤ shoulder height |
| | cross-body-shoulder-stretch | OK | Grip above the elbow |
| | kneeling-lat-stretch | Modify | Stop before the pelvis tucks; standing lat stretch |
| | overhead-triceps-stretch | OK | Ribs down; towel version |
| | wrist-flexor-extensor-stretch | OK | Finger tingling → bend the elbow |
| | scapular-wall-slide | OK | Face-the-wall version for painful shoulders |
| | band-pull-apart | OK | Light band; exhale on the pull |
| Torso | standing-side-bend | Modify | Small range; skip with a lateral shift |
| | supine-twist (knee rolls) | Modify | Small rolls only; no crossed-knee twist |
| | childs-pose | Avoid when irritable · HB | Hands-on-chair hip hinge |
| Lower back | pelvic-tilt | OK | Comfortable half of the range |
| | knee-to-chest | Modify | Single knee, partial range; not soon after waking |
| | prone-press-up (sphinx regression) | Modify | Continue only if symptoms centralise |
| Hips and glutes | supine-figure-4 | OK | Foot-on-wall version |
| | seated-piriformis-stretch | Modify | Hinge with a tall spine, never slump |
| | half-kneeling-hip-flexor-stretch | Modify | Pelvis tucked; standing split-stance version |
| | ninety-ninety-hip-switch | Modify | Hands behind, block under hips |
| | adductor-rock-back | Modify | Stop before the low back rounds |
| | knee-to-opposite-shoulder | **Excluded** | Close to a sciatic provocation test; figure-4 covers it |
| Hamstrings and nerve | sciatic-nerve-glide-seated | Modify | Upright slider only, never slumped |
| | sciatic-nerve-glide-supine | OK | Gentlest slider |
| | supine-hamstring-stretch-strap | Avoid when irritable (symptomatic leg) | Supine slider or bent-knee version |
| Quads and calves | side-lying-quad-stretch | OK | Front-thigh tingling → reduce |
| | wall-calf-stretch | Modify | Nerve-type calf pain → soleus stretch |
| | soleus-stretch | OK | Preferred calf stretch with sciatica |
| Breathing | diaphragmatic-breathing-90-90 | OK | No breath holds |
| | crocodile-breathing | OK | Pillow under hips if prone provokes |
| | box-breathing | OK | No-hold variant by default |
| Activation (from Appendix A) | mcgill-curl-up · side-plank · bird-dog · dead-bug · glute-bridge | OK | Kneeling side plank when irritable |
| Raise / activate / potentiate drills ✚ | march-in-place · step-up (bodyweight) · scapular-push-up · prone-y-t · scapular-pull-up · band-walk · band-row · dowel-hinge · box-squat (bodyweight) · incline-push-up · knee-to-wall-rock · active-knee-extension · reverse-lunge-overhead-reach · standing-rack-lat-stretch · biceps-wall-stretch | OK | Used by the §4.2 templates; each still needs a clip and coaching record (researched in M5 with the same fields) |

### Appendix C — Research index

| File | Covers |
|---|---|
| `docs/research/back-sciatica-mobility.md` | LBP and sciatica evidence, traffic light, red flags, directional preference, nerve sliders, RAMP block design, stretch catalogue, flexibility dosing, nerve-vs-muscle questions |
| `docs/research/diabetes-hypertension-exercise.md` | Outcome levels and modifiers, glucose/ketone/CGM tables, BP thresholds, complications, profile fields, check-in, in-session and post-session prompts, clearance, disclaimers |
| `docs/research/program-design.md` | Split options, pattern menu, spinal-loading ladder and gates, periodisation, conditioning, time-budget constants and auto-fit algorithm, sample week, flag matrix, substitution logic |
| `docs/research/technique-upper-body.md` | 24 upper-body exercises: setup, steps, tempo, breathing, feel, mistakes (with angles), back safety, cues, YouTube queries, sources |
| `docs/research/technique-lower-body-core.md` | 28 lower-body and core exercises, same fields |
| `docs/research/technique-mobility-cardio.md` | 35 stretches/drills and 8 cardio protocols, same fields plus dosage and stop rules |
| `docs/research/animation-libraries.md` | Library comparison, licences, sizes, architecture, verified three.js snippets |
| `docs/research/voice-narration.md` | Device voices, iOS/Android constraints, neural TTS options, pre-generated audio, architecture |
