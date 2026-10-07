# Exercise safety rules for diabetes and hypertension

> **These are general guidelines for app design, not individual medical advice.** A user's own clinician's instructions override every default here. Researched 2026-10-05.

**Verification note.** Numbers were checked against full texts where accessible: [Kanaley 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC8802999/), [Moser 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7702152/), [ISPAD 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC10107219/), [AHA RT 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC11209834/), [PAR-Q+ 2025](https://eparmedx.com/wp-content/uploads/2025/01/PARQPlus2025Fillable.pdf) and ADA patient pages. The ADA *Standards 2026*, AHA/ACC, ESC and heart.org sites blocked automated access, so re-check claims credited to them before release.

## 0. Rule-engine conventions

**Outcomes:** **GREEN** normal session · **AMBER** modified session · **RECOVERY** recovery-only · **RED** no exercise today, plus advice · **URGENT** emergency or urgent care.

Evaluate every rule. The most restrictive outcome wins, and AMBER modifiers add up. Profile modifiers apply every day; check-in modifiers apply only that day. Targets entered by a clinician override the defaults.

| Modifier | Change |
|---|---|
| INT | Effort at RPE 13 or lower on the 6–20 scale ("can talk in sentences"). No intervals, sprints or maximal efforts |
| LOAD | Strength at ~40–60% 1RM, 10–15 reps, stopping at least 3 reps before failure. No holds longer than 30 s, no heavy overhead lifts |
| HEAD | No positions with the head below the heart (inversions, downward dog, child's pose, deep forward folds) |
| IMPACT | No jumping or jarring. Low-impact cardio (marching, step-ups, cycling) |
| FOOT | Non-weight-bearing work only (seated, upper-body, floor) |
| COOL | Cool-down of at least 5–10 min. Get up from the floor in stages: side-lying, then sitting for 2 breaths, then standing |
| HYPO | Fast carbohydrate within reach. Check glucose before the cardio block and at the end. Cardio stays continuous and moderate |
| HEAT | Cardio of 8 min or less at RPE 13 or lower, extra fluids, coolest place and time |

**Recovery-only:** the mobility block (still applying HEAD and FOOT), then 5–10 min of easy walking at RPE 11 or lower, plus breathing work. 20–30 min, with no strength work and no intervals.

## 1. Diabetes

### 1.1 Activity targets
- **Type 1 and type 2:** 150–300 min/week of moderate aerobic activity (RPE 11–12) or 75–150 min of vigorous activity (RPE 14–17), with no more than 2 consecutive days off. Resistance training 2–3 days/week, *never on consecutive days*: 8–10 exercises, 1–3 sets × 10–15 reps, 50–85% 1RM. Flexibility and balance work 2–3 days/week. Break up sitting with 3 min of light activity every 30 min ([Kanaley, Table 2](https://pmc.ncbi.nlm.nih.gov/articles/PMC8802999/); [ADA 2026 §5](https://doi.org/10.2337/dc26-s005)).
- **Prediabetes:** at least 150 min/week of moderate activity plus about 7% weight loss ([ADA 2026 §3](https://doi.org/10.2337/dc26-s003)).
- **Program-design conflict:** because strength work is daily, alternate muscle groups or heavy/light days.

### 1.2 Medication facts that change rules
| Medication | Risk | Rule |
|---|---|---|
| Insulin, sulfonylureas, meglitinides (especially within 2–3 h of a dose) | Hypoglycaemia, including delayed lows ([Kanaley](https://pmc.ncbi.nlm.nih.gov/articles/PMC8802999/)) | Rules in 1.3, HYPO, post-session checks |
| Metformin, GLP-1 RA, DPP-4i or SGLT2i used alone | Minimal hypoglycaemia risk; no carbohydrate or dose changes needed ([Kanaley](https://pmc.ncbi.nlm.nih.gov/articles/PMC8802999/)) | Checks optional. Risk becomes high if combined with the row above |
| SGLT2i | **Euglycaemic DKA** (ketoacidosis with normal or mildly raised glucose) ([Kanaley](https://pmc.ncbi.nlm.nih.gov/articles/PMC8802999/)). Triggers: dehydration, illness, low or skipped carbohydrate, alcohol, vigorous or prolonged exercise ([Danne 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6973545/)) | Hydrate; no training when ill or fasting; symptoms mean checking ketones whatever the glucose |
| Beta-blockers | Blunted heart rate; may mask hypoglycaemia warning signs ([Kanaley](https://pmc.ncbi.nlm.nih.gov/articles/PMC8802999/)) | RPE instead of heart rate; extra glucose checks |

### 1.3 Pre-session glucose (insulin or secretagogue users)
Bands follow [Riddell 2017](https://doi.org/10.1016/S2213-8587%2817%2930014-1) and [Moser 2020, Table 1](https://pmc.ncbi.nlm.nih.gov/articles/PMC7702152/). Moser's carbohydrate amounts are smaller when glucose is expected to rise (strength) than when it is expected to fall (aerobic). The session opens with strength, so use the smaller amounts first and re-check before cardio. Both sources address type 1; applying them to type 2 treated with insulin or sulfonylureas is a cautious extrapolation.

| Glucose | Action | Outcome |
|---|---|---|
| < 54 mg/dL (< 3.0 mmol/L) | Treat (1.9) and eat | RED |
| 54–69 (3.0–3.8) | Treat; start only once ≥ 90 (5.0) and free of symptoms | Then AMBER (HYPO, INT) |
| 70–89 (3.9–4.9) | 10–20 g fast carbohydrate; recheck after 15 min; start once ≥ 90 | Then GREEN + HYPO |
| 90–125 (5.0–6.9) | ~10 g carbohydrate now; 15–20 g more before cardio if still < 126 | GREEN + HYPO |
| 126–180 (7.0–10.0) | Target range | GREEN |
| 181–249 (10.1–13.8) | Drink water. Strength or intervals may push glucose higher | GREEN |
| ≥ 250 (≥ 13.9) | `ketoneRisk` users: test ketones (1.4). Others: go if feeling well and hydrated | 1.4, or GREEN |
| > 300 (> 16.7), type 2 or prediabetes | Only if feeling well and hydrated; recheck afterwards ([Kanaley](https://pmc.ncbi.nlm.nih.gov/articles/PMC8802999/)) | AMBER (INT, LOAD) |
| CGM arrow falling and glucose < 126 (7.0) | The row's carbohydrate plus 5–10 g; delay 15 min | Delay |

**Higher targets** ([Moser](https://pmc.ncbi.nlm.nih.gov/articles/PMC7702152/)):
- `highHypoRisk` users (impaired awareness of lows, or a severe low in the past 6 months), or anyone not yet doing weekly sessions of 45 min or more: target 162–216 mg/dL (9.0–12.0); carbohydrate below 162.
- 1–2 such sessions a week: target 145–198 (8.0–11.0); carbohydrate below 145. The app's session log supplies the count.

Low-risk medicines or prediabetes: no routine carbohydrate, but the < 70 and > 300 rows still apply.

### 1.4 Ketones (`ketoneRisk`: type 1, insulin-deficient, or any SGLT2i user)
| Blood ketones (urine) | Outcome |
|---|---|
| < 0.6 mmol/L (negative) | Follow the glucose rules. If glucose is > 270 (15.0): AMBER (INT, LOAD), mainly aerobic ([Moser](https://pmc.ncbi.nlm.nih.gov/articles/PMC7702152/)) |
| 0.6–1.4 (trace/small) | RED today: follow the ketone plan and recheck (the conservative option; see §8) ([ISPAD](https://pmc.ncbi.nlm.nih.gov/articles/PMC10107219/)) |
| ≥ 1.5 (moderate/large) | RED, and contact the care team. URGENT if ≥ 3.0, or with vomiting, abdominal pain, rapid breathing or drowsiness ([Danne](https://pmc.ncbi.nlm.nih.gov/articles/PMC6973545/)) |
| Cannot test | Type 1 at ≥ 250 mg/dL: RECOVERY at most. SGLT2i user with symptoms: RED, and seek care |

### 1.5 CGM ([Moser 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7702152/))
- **Lag:** sensors trail blood glucose by ~5 min at rest and 12–24 min or more during exercise. Confirm by fingerstick when symptoms disagree.
- **Alerts:** low alert at 100 mg/dL (5.6) from the start of exercise; high alert at 180 or above. Read every 15–30 min: at the start, at the strength-to-cardio switch (~48 min) and at the end.
- **During exercise, below 126 mg/dL (7.0):**

| Trend | Strength block | Cardio block |
|---|---|---|
| Steady | ~10 g carbohydrate | ~15 g |
| Slowly falling | ~15 g | ~25 g |
| Falling fast | ~20 g | ~35 g |

  Recheck at least 30 min later. Higher-risk users use 145 or 162 mg/dL (8.0 or 9.0) as the trigger.
- **Below 70 mg/dL:** stop. Restart is possible at ≥ 80 (4.4) with a flat or rising arrow. **Below 54: no restart.**
- Not valid as written for automated insulin delivery (closed-loop) users, who follow the device's exercise mode and their care-team plan.

### 1.6 Exercise type, order and meal timing
- Moderate aerobic exercise lowers glucose. Resistance work, intense intervals and fasted HIIT hold it steady or raise it in type 1 ([Moser](https://pmc.ncbi.nlm.nih.gov/articles/PMC7702152/)), and HIIT briefly raises it in type 2 ([Kanaley](https://pmc.ncbi.nlm.nih.gov/articles/PMC8802999/)).
- In type 1, resistance work **before** aerobic work gave steadier glucose and milder lows afterwards ([Yardley 2012](https://pmc.ncbi.nlm.nih.gov/articles/PMC3308306/)). Keep the strength-then-cardio order.
- In type 2, walking 10 min after each main meal lowered post-meal glucose more than one daily 30-min walk ([Reynolds 2016](https://doi.org/10.1007/s00125-016-4085-2)). Prefer sessions after a meal; offer optional walks after other meals.
- Exercising within ~90 min of a full mealtime bolus raises the risk of a low; bolus changes are a care-team decision ([Moser](https://pmc.ncbi.nlm.nih.gov/articles/PMC7702152/)). After a recent bolus, use the cardio carbohydrate amounts.
- Evidence on the best time of day is inconsistent ([Kanaley](https://pmc.ncbi.nlm.nih.gov/articles/PMC8802999/)), so don't enforce one.

### 1.7 Delayed and nocturnal hypoglycaemia
After afternoon exercise, glucose needs rise during and just after the session, then again 7–11 h later ([McMahon 2007](https://doi.org/10.1210/jc.2006-2263)). Night-time lows usually come 6–15 h after exercise ([Moser](https://pmc.ncbi.nlm.nih.gov/articles/PMC7702152/)). Risk lasts up to 24 h ([ISPAD](https://pmc.ncbi.nlm.nih.gov/articles/PMC10107219/)) and is higher after evening, long, intense or unaccustomed sessions, and with alcohol ([ADA](https://diabetes.org/living-with-diabetes/hypoglycemia-low-blood-glucose/causes-prevention)).

### 1.8 Complications (profile-driven, applied every day)
| Complication | Rules |
|---|---|
| Peripheral neuropathy | Never exercise barefoot; well-fitting shoes and moisture-wicking socks; check feet after every session; IMPACT; balance work with support ([Kanaley, Table 5](https://pmc.ncbi.nlm.nih.gov/articles/PMC8802999/); [IWGDF 2023](https://doi.org/10.1002/dmrr.3651)) |
| Foot wound or active Charcot foot | FOOT until a clinician clears it. No water-based exercise with an unhealed sole ulcer |
| Autonomic neuropathy, or dizziness on standing | RPE instead of heart rate; COOL; HEAT. Expect lows and abnormal BP responses. Clearance before raising intensity ([Kanaley, Tables 3 and 5](https://pmc.ncbi.nlm.nih.gov/articles/PMC8802999/)) |
| Moderate non-proliferative retinopathy (NPDR) | No resistance work above 80% 1RM ([AHA RT, Fig. 1](https://pmc.ncbi.nlm.nih.gov/articles/PMC11209834/)) |
| Severe NPDR or proliferative retinopathy (PDR) | INT at RPE 10–12; LOAD with no breath-holding, isometrics or overhead lifting; HEAD; IMPACT. Needs ophthalmologist sign-off ([Kanaley](https://pmc.ncbi.nlm.nih.gov/articles/PMC8802999/)) |
| Unstable or untreated PDR, or recent laser or eye surgery | RED until an ophthalmologist clears it |
| Kidney disease | LOAD; no breath-holding; careful hydration; clearance needed |

### 1.9 Recognising and treating hypoglycaemia
Warning signs include shakiness, sweating, fast heartbeat, dizziness, hunger, confusion, blurred vision, weakness and clumsiness. Beta-blockers and autonomic neuropathy can blunt them.

**15-15 rule** ([ADA](https://diabetes.org/living-with-diabetes/hypoglycemia-low-blood-glucose/symptoms-treatment)):
1. Below 70 mg/dL (3.9), take 15 g of fast carbohydrate: 4 glucose tablets of 4 g, ½ cup (120 mL) of juice or regular soda, or 1 tablespoon of sugar.
2. Wait 15 min, then recheck.
3. Repeat if still below 70.
4. Once glucose is rising, eat a snack if a meal is not due soon.

No meter available: treat anyway. Unconscious: glucagon if prescribed, or call emergency services.

## 2. Hypertension

### 2.1 Recommendations
- **ESC 2024:** at least 150 min/week of moderate aerobic activity (≥ 30 min, 5–7 days) or 75 min vigorous, plus low–moderate dynamic or isometric resistance training 2–3 times/week. Avoid high intensity while resting BP is uncontrolled ([ESC](https://doi.org/10.1093/eurheartj/ehae178), via [review](https://pmc.ncbi.nlm.nih.gov/articles/PMC12611427/)).
- **AHA/ACC dosing ([2017](https://doi.org/10.1161/HYP.0000000000000065)):** aerobic 90–150 min/week at 65–75% of heart-rate reserve; dynamic resistance 90–150 min/week at 50–80% 1RM (6 exercises × 3 sets × 10 reps); isometric handgrip 4 × 2 min at 30–40% of maximal grip, 3 times/week. The [2025 update](https://doi.org/10.1161/HYP.0000000000000249) keeps aerobic and resistance exercise and calls isometrics a reasonable add-on ([review](https://pmc.ncbi.nlm.nih.gov/articles/PMC13550040/)).
- **Network meta-analysis of 270 trials:** isometric training lowered BP by −8.2/−4.0 mmHg, combined training −6.0/−2.5, dynamic resistance −4.6/−3.0, aerobic −4.5/−2.5, and HIIT −4.1/−2.5. Wall squats were the most effective single exercise ([Edwards 2023](https://doi.org/10.1136/bjsports-2022-106503)).

### 2.2 Resting BP thresholds
**How to measure:** seated with back supported, feet flat and arm at heart level, after 5 min of rest and 30 min without caffeine, exercise or smoking. Average two readings taken 1 min apart ([AHA](https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings/monitoring-your-blood-pressure-at-home)). Re-measure after 5 min if ≥ 160/100.

| Average reading (mmHg) | Outcome |
|---|---|
| Systolic < 90 or diastolic < 60, **with** dizziness | RED: sit or lie down, drink fluids, contact a clinician if it recurs |
| Systolic < 90 or diastolic < 60, no symptoms | AMBER (COOL) |
| < 140 and < 90 | GREEN |
| 140–159 or 90–99 | AMBER: no HIIT, maximal or heavy lifts ([ESC](https://pmc.ncbi.nlm.nih.gov/articles/PMC12611427/)) |
| 160–179 or 100–109 | AMBER (INT, LOAD, HEAD, COOL); suggest screening ([PAR-Q+ cut-off 160/90](https://eparmedx.com/wp-content/uploads/2025/01/PARQPlus2025Fillable.pdf)) |
| ≥ 180 or ≥ 110 on the repeat reading | RED. Uncontrolled BP above 180/110 is an absolute contraindication to resistance training ([AHA RT](https://pmc.ncbi.nlm.nih.gov/articles/PMC11209834/)) |
| > 180 and/or > 120 | RED, and contact a clinician the same day ("severe hypertension", [AHA/ACC 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC13550040/)). URGENT with chest or back pain, breathlessness, weakness, vision change or trouble speaking ([AHA](https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings/hypertensive-crisis-when-you-should-call-911-for-high-blood-pressure)) |

If the 7-day average is ≥ 140/90, suggest a clinician review.

### 2.3 Breathing, intensity and rest
- **Never hold the breath; breathe out during the effort** ([AHA RT](https://pmc.ncbi.nlm.nih.gov/articles/PMC11209834/)). Heavy lifts taken to failure pushed BP to an average of 320/250 mmHg, and above 480/350 in one lifter, partly through breath-holding (the Valsalva manoeuvre) ([MacDougall 1985](https://doi.org/10.1152/jappl.1985.58.3.785)). Stop sets 2–3 reps short of failure.
- **Default load:** 40–60% 1RM for 8–12 reps. Up to 80% only with controlled BP, no retinopathy restriction and clearance for vigorous work ([AHA RT](https://pmc.ncbi.nlm.nih.gov/articles/PMC11209834/)).
- **App heuristics (no specific guideline):** 60–120 s rest between sets; alternate upper- and lower-body exercises; isometric holds with continuous breathing, on GREEN BP days only.

### 2.4 Medications, low BP after exercise, head-down positions
- **Beta-blockers:** use RPE and the talk test, not heart rate ([Kanaley](https://pmc.ncbi.nlm.nih.gov/articles/PMC8802999/)). Non-selective beta-blockers slightly raise core temperature in the heat ([meta-analysis](https://doi.org/10.1016/j.eclinm.2024.102886)).
- **Diuretics:** extra fluids and HEAT on hot days.
- **Any BP medicine:** extended cool-downs prevent low BP after exercise ([AHA RT](https://pmc.ncbi.nlm.nih.gov/articles/PMC11209834/)), so apply COOL.
- **Head below heart:** no hypertension-specific evidence. HEAD is a precaution on AMBER BP days and mandatory for severe NPDR or PDR.

## 3. When diabetes, hypertension and low back pain coexist
1. **Brace while breathing.** The back-pain "brace" cue must come with exhaling through the effort; breath-holding breaks the BP and retinopathy rules.
2. **Getting up from the floor:** neuropathy makes dizziness on standing more likely ([AHA RT](https://pmc.ncbi.nlm.nih.gov/articles/PMC11209834/)), and BP medicines add to it. Group floor exercises together and use staged rising.
3. **Head-down stretches:** swap child's pose, downward dog and toe-touches for supine knee-to-chest or seated hamstring stretches whenever HEAD applies.
4. **Core holds:** 10–30 s with steady breathing. Wall-sit isometrics on GREEN days only.
5. **Numbness:** neuropathy and sciatica overlap. New or worsening numbness or weakness goes to the back-pain red-flag rules. Reduced sensation from either cause hides blisters, so check feet.
6. **Back-pain medicines:**
   - NSAIDs raise BP by ~5 mmHg and blunt BP medicines ([meta-analysis](https://doi.org/10.7326/0003-4819-121-4-199408150-00011)).
   - NSAIDs plus a diuretic plus an ACE inhibitor or ARB roughly double the risk of acute kidney injury ([meta-analysis](https://doi.org/10.1002/bcp.70263)).
   - Epidural steroid injections raised glucose by an average of 126 mg/dL for about 2 days ([Even 2012](https://doi.org/10.1097/BRS.0b013e31821fd21f)).

   The app educates and suggests asking a pharmacist; it never advises on doses.
7. **Walking is the common ground:** it lowers post-meal glucose and BP, and reduced back-pain recurrence in the [WalkBack trial](https://doi.org/10.1016/S0140-6736%2824%2900755-4). Brisk walking is the fallback for the cardio block.

## 4. Minimal profile fields
```ts
type HealthProfile = {
  diabetes: 'none' | 'prediabetes' | 'type1' | 'type2' | 'other';
  hypertension: 'none' | 'treated' | 'untreated' | 'unsure';
  insulin: 'none' | 'injections_or_pump' | 'automated_delivery';
  sulfonylureaOrMeglitinide: boolean;
  sglt2i: boolean;
  betaBlocker: boolean;            // prescribed for any reason
  diuretic: boolean;
  highHypoRisk: boolean;           // impaired awareness of lows, or a severe low in the past 6 months
  heartOrVascularDisease: boolean; // coronary disease, heart failure, arrhythmia, stroke, peripheral artery disease
  kidneyDisease: 'none' | 'ckd' | 'dialysis_or_transplant' | 'unsure';
  retinopathy: 'none_or_mild' | 'moderate' | 'severe_or_proliferative' | 'recent_eye_treatment' | 'unknown';
  peripheralNeuropathy: 'no' | 'yes' | 'unsure';
  footStatus: 'healthy' | 'past_ulcer_or_charcot' | 'current_wound_or_active_charcot';
  dizzyOnStandingOrAutonomicNeuropathy: boolean;
  glucoseMonitor: 'none' | 'meter' | 'cgm';
  glucoseUnit: 'mg/dL' | 'mmol/L';
  ketoneTest: 'none' | 'urine' | 'blood';
  bpMonitor: boolean;
  currentlyActive: boolean;        // ≥ 30 min moderate activity, ≥ 3 days/week, for ≥ 3 months (ACSM definition)
  clearance: 'none' | 'moderate' | 'vigorous';
  clinicianTargets?: { glucoseStartMin?: number; bpStopSystolic?: number };
};
```
**Derived flags:**
- `hypoRisk = insulin !== 'none' || sulfonylureaOrMeglitinide`
- `ketoneRisk = diabetes === 'type1' || sglt2i || (diabetes === 'other' && insulin !== 'none')`
- `onBpMeds = hypertension === 'treated' || betaBlocker || diuretic`, which applies COOL every day.

**Defaults when unsure (conservative app choices):** treat `retinopathy: 'unknown'` as `moderate` and prompt for an eye exam; treat `unsure` neuropathy as `yes`.

**Data handling:** store data only on the device, offer delete and export, and use yes/no fields rather than free-text medicine names.

## 5. Daily pre-session check-in
### 5.1 Questions
Shown only when relevant to the profile.
1. **Red-flag symptoms right now:** chest pain or pressure; unusual breathlessness; racing or irregular heartbeat at rest; sudden weakness, numbness, trouble speaking, severe headache or confusion; sudden vision change.
2. **Unwell today?** Fever, vomiting or diarrhoea, infection.
3. **Lows in the last 24 h:** none / one / two or more / one that needed someone else's help.
4. **Glucose** (strongly prompted when `hypoRisk`) and CGM arrow. **Rapid-acting insulin in the last 2 h?**
5. **Ketones**, asked when `ketoneRisk` and glucose ≥ 250 mg/dL (13.9), or for SGLT2i users with nausea or abdominal pain.
6. **BP reading** (if `bpMonitor`).
7. **Dizzy on standing, or fainted, today?**
8. **Feet:** new blister, sore, redness, swelling or warmth?
9. **Sleep:** < 5 h / 5–7 h / > 7 h. **Energy:** 1–5. **Unusually tired or breathless with everyday activities lately?**
10. **Hot or humid conditions today?**
11. **Steroid tablets or injection in the last 3 days?**

Back-pain questions come from the back-pain report.

### 5.2 Decision rules
Glucose, ketone and BP readings use tables 1.3, 1.4 and 2.2.

| Answer | Outcome |
|---|---|
| Any red-flag symptom | URGENT: call emergency services. For sudden vision change: urgent eye care |
| Unwell | RED: follow the sick-day plan; check ketones if `ketoneRisk` ([PAR-Q+](https://eparmedx.com/wp-content/uploads/2025/01/PARQPlus2025Fillable.pdf); [ISPAD](https://pmc.ncbi.nlm.nih.gov/articles/PMC10107219/)) |
| Severe low, or two or more lows, in the last 24 h | RED ([ISPAD](https://pmc.ncbi.nlm.nih.gov/articles/PMC10107219/)) |
| One low in the last 24 h, or `hypoRisk` with no reading | AMBER (HYPO, INT) |
| Dizzy on standing | AMBER (COOL, INT) |
| Fainted today | RED, and seek medical advice the same day ([ACSM](https://doi.org/10.1249/MSS.0000000000000664)) |
| Foot problem | FOOT. Hot, swollen foot or open wound: see a clinician promptly |
| Unusually tired or breathless with everyday activities | RED, and seek clearance ([ACSM](https://doi.org/10.1249/MSS.0000000000000664)) |
| Sleep < 5 h or energy ≤ 2 | AMBER (INT, one set fewer per exercise). Two days running: RECOVERY (app heuristic) |
| Hot or humid | HEAT |
| Recent steroid | Check glucose before and after; apply the high-glucose rules |

### 5.3 In-session prompts
- **Each strength set:** "Breathe out as you push. Never hold your breath. Stop with 2–3 reps left."
- **Each block change:** "Sip water."
- **Before cardio (`hypoRisk`):** "Check your glucose now." Then apply 1.5.
- **"I feel low", hypoglycaemia symptoms, or CGM < 70:** stop and sit down; take 15 g of fast carbs; run a 15-min timer, then recheck. Once ≥ 90 mg/dL and recovered: cool-down only. Below 54: end the session.
- **Chest pain, dizziness, unusual breathlessness or palpitations:** stop and sit or lie down. Chest pain, or symptoms not settling within minutes: emergency services ([AHA RT](https://pmc.ncbi.nlm.nih.gov/articles/PMC11209834/)).
- **Floor to standing:** "Roll to your side, sit for two breaths, stand slowly."
- **Beta-blocker users:** "Go by effort, not heart rate."
- **Neuropathy, mid-session:** "Any rubbing or hot spots? Stop and check your feet."
- **SGLT2i user with nausea or abdominal pain:** stop, check ketones, seek care.
- **Vision change:** stop; urgent eye care.

### 5.4 Post-session reminders
- Easy last 3–5 min of cardio; COOL if `onBpMeds` or autonomic neuropathy.
- **If `hypoRisk`:**
  - Check glucose at the end and again within 90 min. At ~80 mg/dL (4.4) with a flat arrow, take ~10 g of carbohydrate; with a slowly falling arrow, ~15 g ([Moser](https://pmc.ncbi.nlm.nih.gov/articles/PMC7702152/)).
  - After afternoon or evening sessions, check before bed and set the CGM night alert to 80 mg/dL.
  - Warning text: "Lows can happen up to 24 hours later, often overnight; alcohol raises this risk."
- Check feet (neuropathy); rehydrate.
- Log lows; repeated lows need a care-team medication review.

## 6. Medical clearance and disclaimers
The ACSM algorithm ([Riebe 2015](https://doi.org/10.1249/MSS.0000000000000664)) is based on current activity, known cardiovascular, metabolic (type 1 or type 2 diabetes) or kidney disease, symptoms, and the intensity planned. Risk factors such as hypertension no longer count on their own.

| Situation | App action |
|---|---|
| No disease and no symptoms | No clearance needed; progress gradually |
| Diabetes, heart/vascular disease or kidney disease, and **inactive** | Recommend clearance before starting; light–moderate work only (INT, LOAD) until confirmed |
| Same conditions, already **active** | Moderate work allowed; vigorous work locked until clearance is confirmed |
| Warning symptoms (chest discomfort, breathlessness, fainting, ankle swelling, palpitations, leg pain when walking, unusual fatigue) | RED until cleared |
| BP ≥ 160/90, unknown or hard to control; frequent lows; complications; or planning unusually vigorous exercise | Recommend clearance or a qualified exercise professional ([PAR-Q+](https://eparmedx.com/wp-content/uploads/2025/01/PARQPlus2025Fillable.pdf)) |
| Severe NPDR or PDR, or autonomic neuropathy | Eye or cardiac review before vigorous work ([Kanaley, Table 3](https://pmc.ncbi.nlm.nih.gov/articles/PMC8802999/)) |
| Pregnancy | Outside the app's scope; refer to a clinician |

**Disclaimers to show** (at onboarding; key lines repeated at check-in):
- "General information, not medical advice. Check with your clinician before starting, especially if you have diabetes, heart, kidney or eye disease."
- "Stop and get help for chest pain, faintness or severe breathlessness. This app cannot detect emergencies; call your local emergency number."
- "Follow your care team's medication and insulin plan. This app never changes doses."
- "Meters, sensors and cuffs can be wrong, and CGM readings lag during exercise. Treat symptoms even if the reading looks normal."
- "Targets from your clinician replace the app's defaults."

## 7. Session-adjacent nutrition
- **`hypoRisk` users:** keep 30–45 g of fast carbohydrate within reach (2–3 treatments), plus glucagon if prescribed ([Kanaley, Table 4](https://pmc.ncbi.nlm.nih.gov/articles/PMC8802999/)).
- Pre-session carbohydrate follows table 1.3. Low-glycaemic-index carbohydrate 30–60 min beforehand is advised only for aerobic sessions over 30 min ([Moser](https://pmc.ncbi.nlm.nih.gov/articles/PMC7702152/)).
- Drink before, during and after the session.
- SGLT2i users: no fasted or very-low-carb training ([Danne](https://pmc.ncbi.nlm.nih.gov/articles/PMC6973545/)).
- Avoid alcohol around sessions.

## 8. Where sources disagree (and the app default)
- **Glucose at which type 1 users test ketones:** > 240 mg/dL ([ADA](https://diabetes.org/living-with-diabetes/treatment-care/hyperglycemia)), ≥ 250 (Kanaley) or > 270 (Riddell, ISPAD). **Default: 250.**
- **Ketones 0.6–1.4 mmol/L:** Riddell allows under 30 min of light exercise; Moser's adult table allows aerobic work up to 1.5 (with a possible insulin correction); ISPAD (paediatric) says postpone. **Default: postpone.**
- **Moderate NPDR:** AHA RT restricts heavy resistance work; ADA and Kanaley start restrictions at severe NPDR. **Default: restrict from moderate.**
- **Definition of hypertension:** ≥ 130/80 (AHA/ACC) vs ≥ 140/90 (ESC/ESH) ([NDT](https://pmc.ncbi.nlm.nih.gov/articles/PMC13624793/)). **Default: rules use measured readings, not labels.**
- **BP stop point:** > 180/110 for resistance training (AHA RT); > 200/110 for exercise testing ([AHA 2013](https://doi.org/10.1161/CIR.0b013e31829b5b44)); 160/90 screening cut-off (PAR-Q+). **Default: RED at 180/110.**
- **Intensity with hypertension:** RPE 10–12 (Kanaley) vs up to 80% 1RM (AHA 2017). **Default: moderate.**
- **Neuropathy and walking:** Kanaley limits jogging; IWGDF says ~1000 extra steps/day is likely safe. **Default: low-impact cardio; walking in proper footwear.**
- **Kidney disease:** ADA sets no general restriction; Kanaley advises avoiding large BP rises. **Default: LOAD.**
- **Prediabetes:** not an ACSM screening trigger, but a PAR-Q+ item. **Default: no clearance on its own.**
- **Diuretics in the heat:** often listed as a heat risk; a meta-analysis found no core-temperature effect. **Default: keep the fluid advice.**
- **Restart after an in-session low:** Moser allows it at ≥ 80 mg/dL. **Default: cool-down only.**
- **Severe or repeated lows in the past 24 h:** a paediatric rule (ISPAD), though the blunted stress-hormone response after a low is documented in adults. **Default: applied to adults.**
