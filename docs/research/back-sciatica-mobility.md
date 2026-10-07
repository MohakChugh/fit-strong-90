# Low back pain, sciatica and the 15-minute mobility block

**Scope.** Exercise management of low back pain (LBP) with and without sciatica, symptom rules for the app, and the design of the 15-minute pre-strength mobility block. Other topics are in sibling docs. Labels match the technique doc: **OK**, **Modify**, **Avoid when irritable**. *Irritable* means pain at rest, easily provoked leg symptoms, or symptoms that take more than 30 min to settle. General self-management content, not medical advice. Researched 2026-10-05.

## Decisions that matter most

1. **Any structured exercise helps modestly; tolerance and adherence decide outcomes.** Choose back-tolerant variants and progress them.
2. **Default to spine-sparing without teaching fear of bending.** Neutral spine under load, hip hinge, endurance before strength. Restrictions depend on state (irritable, early morning, active sciatica) and lift as the user recovers.
3. **Find directional preference with a guarded self-test.** Store the result as provisional.
4. **Nerve symptoms get sliders, not stretches.** Never hold a nerve tensioner (straight leg + ankle pulled up + neck bent) as a static stretch.
5. **Traffic light + 24-hour rule + "leg symptoms must not spread".** Peripheralisation is a hard stop whatever the pain score.
6. **Build the block on RAMP (Raise, Activate, Mobilise, Potentiate).** Muscles about to be loaded hard get ≤30 s per hold, ≤60 s total. Longer "deep" holds go to that day's non-prime movers. Finish with dynamic work.
7. **Flexibility needs ≥5 min per week per target muscle over ≥5 days.** Pick 2–3 target regions per 12-week block; keep other regions at ≥2 exposures a week.

## 1. Exercise management of LBP with and without sciatica

### 1.1 What to emphasise

| Source | Finding | Certainty |
|---|---|---|
| [NICE NG59](https://www.nice.org.uk/guidance/ng59/chapter/Recommendations) (updated Jul 2026) | Self-management advice; encourage normal activities. Consider group exercise (biomechanical, aerobic, mind–body or combined), with or without sciatica. No belts, corsets, orthotics or traction; manual therapy only alongside exercise. | Guideline |
| [ACP 2017](https://www.acpjournals.org/doi/10.7326/M16-2367) | Chronic LBP: start with exercise, mindfulness-based stress reduction, tai chi, yoga or motor-control exercise | Moderate–low |
| [WHO 2023](https://www.who.int/publications/i/item/9789240081789) | Structured exercise may be offered with or without spine-related leg pain; braces, belts and traction not for routine care | Low / very low |
| [Cochrane 2021](https://doi.org/10.1002/14651858.CD009790.pub2) | Vs no treatment, usual care or placebo: pain −15.2/100 (clinically important), function −6.8/100 (below threshold); harms mostly soreness | Moderate |
| Network meta-analyses | Disagree on best type: [Hayden 2021](https://doi.org/10.1016/j.jphys.2021.09.004) favours Pilates, McKenzie, functional restoration; [Owen 2020](https://doi.org/10.1136/bjsports-2019-100886) finds stretching and McKenzie ≈ control; [Fernández-Rodríguez 2022](https://doi.org/10.2519/jospt.2022.10671) finds stretching ineffective for pain | Low, conflicting |
| Dose | Stabilisation best at 3–5×/week, 20–30 min ([Mueller 2020](https://doi.org/10.1038/s41598-020-73954-9)); programmes meeting ACSM FITT do better ([Tan 2026](https://doi.org/10.3389/fphys.2026.1725132)) | Low–moderate |
| Walking | Progressive walking + education cut recurrence (HR 0.72; median 208 vs 112 days), with more lower-limb niggles ([WalkBack 2024](https://doi.org/10.1016/S0140-6736(24)00755-4)) | One large RCT |
| Sciatica | Exercise beats advice to stay active only for short-term leg pain (~11/100), with no long-term difference ([Fernandez 2015](https://doi.org/10.1097/BRS.0000000000001036)); usually settles in weeks to months ([NHS](https://www.nhs.uk/conditions/sciatica/)) | Low / moderate |
| Heavy lifting | Deadlift training and low-load motor control both reduced pain ([Aasa 2015](https://doi.org/10.2519/jospt.2015.5021)); lower pain/disability and better back-extensor endurance predicted deadlift benefit ([Berglund 2015](https://doi.org/10.1519/JSC.0000000000000837)) | Low–moderate |

**App implication:** reward consistency and tolerable progression over exercise "type". Stretching alone is not an LBP treatment; it serves the flexibility goal.

### 1.2 What to avoid or modify, and why

The case against flexion rests mainly on pig-spine and EMG studies. Low-quality evidence finds flexed lifting is not a risk factor for LBP ([Saraceni 2020](https://doi.org/10.2519/jospt.2020.9218)), fear of bending is unhelpful ([O'Sullivan 2020](https://doi.org/10.1136/bjsports-2019-101611)), and flexion training may suit healthy lifters ([Contreras & Schoenfeld 2011](https://doi.org/10.1519/SSC.0b013e3182259d05)). **Restrict by current state, not for life.**

| Exercise | Why it is a problem | Irritable / Amber | Green ≥4 weeks | Swap |
|---|---|---|---|---|
| Sit-ups, crunches | Repeated loaded flexion. Partial curl-ups give the best abdominal challenge for the least spinal compression ([Axler & McGill 1997](https://doi.org/10.1097/00005768-199706000-00011)). Highly repetitive flexion herniated pig discs ([Callaghan & McGill 2001](https://doi.org/10.1016/S0268-0033(00)00063-2)). | Avoid | Optional partial crunch | McGill curl-up, dead bug |
| Russian twists (loaded rotation) | Twisting plus repeated flexion delaminated the outer disc wall (annulus) in 67.5% of pig specimens ([Marshall & McGill 2010](https://doi.org/10.1016/j.clinbiomech.2009.09.003)) | Avoid | Avoid by default | Pallof press, side plank, suitcase carry |
| Toe touches, seated folds, sit-and-reach | End-range flexion that also tensions the nerve. Avoiding early-morning flexion reduced chronic LBP in an RCT ([Snook 1998](https://doi.org/10.1097/00007632-199812010-00015)). | Avoid | Gentle; not within ~1 h of waking | Hip-hinge hamstring stretch, supine strap |
| Jefferson curls | Loaded end-range flexion. No LBP trials; one small RCT in healthy adults used full-range extensor loading to improve sit-and-reach ([Rosenfeldt 2024](https://doi.org/10.1186/s13102-024-00934-1)). | Exclude | Light only, never with a sciatica history | Romanian deadlift (RDL) to mid-shin, neutral spine |
| Aggressive straight-leg stretch with ankle dorsiflexion | A nerve tensioner: dorsiflexion cuts straight-leg-raise range and triggers protective muscle guarding ([Boyd 2009](https://doi.org/10.2519/jospt.2009.3002)) | Avoid | Ankle relaxed by default | Knee-soft strap stretch, sciatic slider |
| Good mornings | Long loaded lever; spine flexes once hamstring range runs out (reasoning; no trials) | Avoid | Light, once RDL is competent | Hip thrust, dowel hinge |
| Heavy back squat or deadlift early in recovery | High compressive load. Benefit depends on low pain and back-extensor endurance (Berglund 2015). | Goblet or box squat; kettlebell or trap-bar pull from blocks | Add load only if the 24-hour rule stays Green | — |

### 1.3 McGill spine-sparing principles and the Big 3

- **Remove triggers.** Examples are slumped sitting and repeated bending.
- **Keep a neutral spine under load and move at the hips.** A moderate abdominal brace raises oblique activation ([McGill & Karpowicz 2009](https://doi.org/10.1016/j.apmr.2008.06.026)).
- **Build endurance before strength.** Do the Big 3 daily: curl-up, side plank and bird dog. Use short holds (~10 s) and add reps in a descending pyramid rather than holding longer ([Back Mechanic](https://www.backfitpro.com/books/back-mechanic-the-mcgill-method-to-fix-back-pain/)). An app-delivered Big 3 RCT used 7–10 s holds ([López-Marcos 2024](https://doi.org/10.3390/s24020567)).
- **Use cat-camel for motion, not stretch.** A handful of slow cycles (McGill reports ~5–6 suffice) in the pain-free range ([McGill 1998](https://doi.org/10.1093/ptj/78.7.754)).
- **Put flexibility work at the hips and thoracic spine, not the lumbar spine.** Walk often.

**Evidence status.** The biomechanical rationale is strong but the clinical evidence is weak. A review of 4 Big 3 RCTs found low-quality, mixed results ([Laurin 2022 preprint](https://doi.org/10.1101/2022.01.21.22269311)). Motor-control exercise is not superior to other exercise ([Cochrane 2016](https://doi.org/10.1002/14651858.CD012004)). Treat the Big 3 as a quick, low-load activation tool, not a cure.

### 1.4 McKenzie (MDT) directional preference

- **Definitions.** *Centralisation*: symptoms retreat toward the spine with repeated movement. *Directional preference (DP)*: one direction gives immediate, lasting improvement.
- **Evidence.** Centralisation occurs in 44% (74% acute, 42% chronic), DP in 70%; centralisation predicted outcome in 21 of 23 studies, but examiner agreement varies (kappa 0.15–0.9) ([May & Aina 2012](https://doi.org/10.1016/j.math.2012.05.003)). In an RCT, DP was found in 74%; matched exercises beat opposite or non-directional ones, a third of whose users dropped out within 2 weeks ([Long 2004](https://doi.org/10.1097/01.brs.0000146464.23007.2a)). MDT beats some comparators in chronic, not acute, LBP ([Lam 2018](https://doi.org/10.2519/jospt.2018.7562)).

**"Find my direction" self-test.** Only with no red flags, Green/Amber state and no worsening neurology; a visible lateral shift needs a clinician first.

1. **Baseline.** Back and leg pain (0–10), most distant symptom point on a body map (back / buttock / thigh / below knee / foot), and a function check (sit-to-stand or forward reach).
2. **Test extension stepwise.** Prone lying 1 min → prone on elbows 1 min → 10 slow press-ups, hips down. Re-rate after each step.
3. **Read it.** Centralises or eases, still better 5–10 min later, function improves → *extension DP (provisional)*. Spreads down the leg → stop; next session test supine knees-to-chest ×10 the same way. No change either way → *no clear DP*; neutral-spine plan.
4. **Confirm on 2–3 days**; re-test monthly and after flares.
5. **Stenosis-type pattern** (leg symptoms on standing/walking, eased by sitting or bending forward; [Lurie 2016](https://doi.org/10.1136/bmj.h6234)) → default to flexion.
6. **Use the DP drill daily** (minute 2) and as a flare "rescue" (~10 reps a few times a day; MDT convention, not trial-tested).

### 1.5 Neurodynamics

- **Sliders vs tensioners.** A *slider* lengthens the nerve bed at one end while slackening the other; a *tensioner* lengthens both. In cadavers, sliders moved nerves about twice as far with far less strain (0.8% vs 6.8%) ([Coppieters & Butler 2008](https://doi.org/10.1016/j.math.2006.12.008)). In vivo, looking up while straightening the knee gave the largest sciatic excursion ([Ellis 2012](https://doi.org/10.2519/jospt.2012.3854)).
- **Effect.** In chronic LBP, nerve mobilisation improved the Oswestry Disability Index by −9.3/50 and pain by −1.8/10 ([Basson 2017](https://doi.org/10.2519/jospt.2017.7117)); 8 RCTs in radiating leg pain suggest short-term benefit ([Peacock 2023](https://doi.org/10.1080/10669817.2022.2065599)). More cautious: [Plaza-Manzano 2020](https://doi.org/10.1097/PHM.0000000000001295) (nerve symptoms and straight-leg raise improved, pain and disability did not); [Ferreira 2016](https://doi.org/10.1016/j.jphys.2016.08.007) (no difference at 2 weeks, leg pain better by 4).
- **Dose.** Not standardised ([Ellis & Hing 2008](https://pmc.ncbi.nlm.nih.gov/articles/PMC2565076/)). Slump "stretching" (a tensioner) used 5×30 s in clinic and 2×30 s at home in back pain without nerve-root signs ([Nagrale 2012](https://pmc.ncbi.nlm.nih.gov/articles/PMC3267445/)).
- **App dose (pragmatic, expert-level).** Active leg symptoms: sliders only, 10–15 slow reps per side, 1–2 sets, once or twice daily, "mild pull, no tingling"; anything provoked must settle within ~1 min. Green for 2 weeks without leg symptoms: tensioners allowed, 5–10 reps with a 1–2 s end-hold.

## 2. Symptom rules the app can apply

**Centralisation vs peripheralisation.** Back pain may rise briefly while leg symptoms centralise; that is acceptable. Any spread further down the leg, or new numbness, tingling or weakness, means stop.

**Traffic light.** Based on the tendon pain-monitoring model: 0–5/10 is acceptable if it settles by the next morning ([Silbernagel 2007](https://doi.org/10.1177/0363546506298279); [Smitheman 2024](https://pmc.ncbi.nlm.nih.gov/articles/PMC11572981/)). Some pain during exercise is acceptable in chronic pain ([Smith 2017](https://doi.org/10.1136/bjsports-2016-097383)). Applying this to LBP is an extrapolation; the leg rule comes from MDT.

| | During exercise | 24-hour rule (next morning) | Leg symptoms | Action |
|---|---|---|---|---|
| **Green** | 0–2/10 | Back to baseline | None, unchanged or centralising | Continue; progress after 2 Green sessions |
| **Amber** | 3–5/10, not climbing with each rep | Slightly worse, but settles within 24 h | Brief spread that settles within ~1 min | Hold progression; shrink range or load on the provoking drill |
| **Red** | >5/10, sharp, or rising each rep | Worse beyond 24 h, or morning stiffness up 2 days running | Spreading down the leg; new numbness or weakness | Stop the drill and switch to the Red-day block (walk, DP drill, sliders, regressed Big 3). Advise a clinician if it lasts 3 or more days. |

**Check-ins.** Before the session: pain, the most distant symptom point, and minutes of morning stiffness. After the session: a single tap. Next morning: better / same / worse, and "did anything spread?". Criteria-based progression of this kind looks beneficial in LBP ([Tuninetti 2025](https://doi.org/10.2147/JPR.S539160)).

**Immediate stop.** Stop for any of: symptoms spreading down the leg; new numbness, tingling or weakness; sharp pain above 5/10; pain that climbs with each rep; dizziness, chest pain or feeling unwell.

**Red flags.** Most red flags lack good evidence of diagnostic accuracy, so screen at onboarding and whenever symptoms are new or changed, and default to "see a clinician" when unsure ([Finucane 2020](https://doi.org/10.2519/jospt.2020.9971); NICE NG59 1.1.1).

| Urgency | Triggers | App response |
|---|---|---|
| **Emergency (999 / A&E; do not drive)** | Sciatica in both legs; severe or worsening weakness or numbness in both legs; numbness around the genitals or anus; new bladder or bowel problems ([NHS](https://www.nhs.uk/conditions/sciatica/); [GIRFT CES pathway](https://gettingitrightfirsttime.co.uk/wp-content/uploads/2025/03/National-Suspected-Cauda-Equina-Pathway-February-2025.pdf)). Cancer history with limb weakness, gait change or bladder/bowel change ([NICE NG234](https://www.nice.org.uk/guidance/ng234/chapter/Recommendations)). Calf pain or swelling with breathlessness or chest pain ([NHS DVT](https://www.nhs.uk/conditions/deep-vein-thrombosis-dvt/)). | Lock the session and show the emergency screen |
| **Same day / within 24 h** | Worsening weakness in one leg (foot drop, can't walk on heels or toes); fever or feeling unwell with back pain, especially with diabetes ([Epstein 2015](https://doi.org/10.4103/2152-7806.166887)); significant trauma, or a minor fall with osteoporosis or long-term steroids; cancer history with new progressive, night or strain-provoked back pain (NG234); suspected DVT (one swollen, warm, tender calf) | Suspend training and prompt GP / 111 |
| **Book an appointment (days to 2 weeks)** | Within days: unexplained weight loss or constant night pain with back pain. Within 2 weeks: sciatica not improving after several weeks, or worsening (NHS); back pain that began before 45, has lasted more than 3 months, and has inflammatory features ([NICE NG65](https://www.nice.org.uk/guidance/ng65/chapter/Recommendations)); calf pain on walking that eases with rest ([NHS PAD](https://www.nhs.uk/conditions/peripheral-arterial-disease-pad/)); numbness or burning in both feet ([NHS](https://www.nhs.uk/conditions/peripheral-neuropathy/)) | Continue with modifications; set a reminder |

## 3. The 15-minute block: design evidence

**Static stretching before lifting.**

- Immediately after stretching, static stretching cost 3.7% performance and PNF stretching 4.4%, while dynamic stretching added 1.3% ([Behm 2016](https://doi.org/10.1139/apnm-2015-0235)).
  - Holds under 60 s per muscle cost 1.1%; 60 s or more cost 4.6%.
  - When dynamic activity followed the stretching, there was no clear deficit.
  - Range-of-motion (ROM) gains lasted under 30 min.
- A 2024 multilevel meta-analysis found a small loss of maximal strength (effect size −0.21) and a large one for bouts of 60 s or more (−0.84). Athletic performance was not impaired, and jumping even improved ([Warneke & Lohmann 2024](https://doi.org/10.1016/j.jshs.2024.05.002)).
- Short static or dynamic stretches within a full warm-up had no effect on sprinting or jumping ([Blazevich 2018](https://doi.org/10.1249/MSS.0000000000001539)).
- **Expert consensus.** Use at least 2 bouts of 5–30 s for an acute ROM gain. Avoid holds over 60 s per muscle before maximal efforts by that muscle; short holds inside a dynamic warm-up are fine ([Delphi 2025](https://doi.org/10.1016/j.jshs.2025.101067)).
- **Sequencing.** RAMP is Raise → Activate → Mobilise → Potentiate. In a small crossover RCT it beat static stretching alone for sprint and jump (d=0.41) ([Girginer 2025](https://doi.org/10.3389/fphys.2025.1612611)).

**Rules for the engine.**

1. **Prime movers:** ≤30 s per hold and ≤60 s in total, then dynamic drills.
2. **Deep holds (45–60 s):** only on muscles that are not prime movers that day. They go at minutes 9–11 so that activation and potentiation follow.
3. **Stretch intensity:** "tightness or slight discomfort" ([ACSM](https://doi.org/10.1249/MSS.0b013e318213fefb)), never nerve symptoms.
4. **Nerve sliders:** right after Raise, while tissue is warm, and before any hamstring or hinge work.
5. **Activation:** Big 3, glute bridge and dead bug. They are low-load and prime the movement pattern, but their specific benefit is backed only by biomechanical evidence.
6. **Deep stretching without irritating the nerve:**
   - Hamstrings: lying down, knee soft, ankle relaxed, head resting on the floor, lumbar spine neutral. No slumped sitting stretches.
   - Hip flexors: posterior pelvic tilt plus glute squeeze. Reduce knee bend if the front of the thigh tingles (femoral nerve).
   - Piriformis: supine figure-4 rather than pigeon.

## 4. Stretch and mobility catalogue

"Pre-lift" doses apply to prime movers. On deep-hold days, use 1–2 × 45–60 s. **Daily:** cat-camel, Big 3, the DP drill once established, and sliders if the user has a nerve flag. Everything else rotates.

| Region | Option | Back / sciatica | Dose | Key cue |
|---|---|---|---|---|
| Neck | Chin tuck | OK | 8–10 × 3 s | Slide head back, eyes level |
| | Upper-trap stretch | OK | 2×20–30 s/side | Shoulder down, gentle hand |
| | Levator stretch | OK | 2×20 s/side | Nose toward armpit |
| Thoracic | Side-lying open book | OK | 6–8/side | Knees stacked and bent to lock the lumbar spine |
| | Thread-the-needle | OK | 6/side | Hips over knees |
| | Foam-roller extension | Modify | 6–8 | Mid-back only, ribs down |
| | Cat-camel | OK (pain-free range) | 6–8 cycles | Motion, not end range |
| Shoulders | Wall slide | OK | 8–10 | Ribs down |
| | Band pass-through | OK | 10 | Wide grip, no back arch |
| | Cross-body stretch | OK | 2×20–30 s | Shoulder blade down |
| Chest | Doorway pec stretch | OK | 2×20–30 s | Staggered stance, no lumbar arch |
| | Floor angels | OK | 8–10 | Low back gently flat |
| Lats | Kneeling bench lat stretch | Modify | 2×20–30 s | Sink chest, hips stay above knees |
| | Standing rack lat stretch | OK | 2×20–30 s/side | Hinge, long spine |
| Arms/wrists | Wrist flexor/extensor stretch | OK | 2×20 s each | Elbow straight |
| | Biceps wall stretch | OK | 2×20 s | Thumb down, turn chest away |
| | Overhead triceps stretch | OK | 2×20 s | Ribs down |
| Torso | Side plank | OK (knees if irritable) | 2–3×10 s/side | Hips forward, breathe |
| | Pallof press hold | OK | 3×10 s/side | Resist the twist |
| | Standing side-bend reach | Avoid when irritable | 5/side | Up and over, no twist |
| Lower back | DP drill: press-up *or* knees-to-chest | Only with an established DP | 10 | Stop if symptoms spread |
| | Pelvic tilts | OK | 10 | Small and slow |
| | Toe touch, seated fold | Avoid when irritable | — | — |
| Hip flexors | Half-kneeling stretch | OK | 2×20–30 s/side | Tuck tail, squeeze glute, then shift |
| | Reverse lunge + overhead reach | OK | 5/side | Tall trunk |
| | Couch stretch | Avoid when irritable | 30 s | Keep the posterior tilt |
| Glutes | Supine figure-4 | OK (stop if leg symptoms) | 2×20–30 s/side | Low back stays down |
| | 90/90 switches | Modify | 6/side | Hands behind for support |
| | Pigeon | Avoid when irritable | — | Green only |
| Adductors | Quadruped rock-back | OK | 8–10 | Stop before the pelvis tucks |
| | Half-kneeling side-lunge stretch | OK | 2×20–30 s/side | Pelvis square |
| | Cossack squat | Modify | 5/side | Range as tolerated |
| Hamstrings | Supine strap stretch | Modify | 2×20–30 s/side | Knee soft, toes pointed, head on floor |
| | Active knee extension | OK | 8–10/side | Controlled, short of tingling |
| | Sciatic slider | OK (the irritable option) | 10–15/side | Look up as the knee straightens |
| Quads | Side-lying quad stretch | OK | 2×20–30 s/side | Tail tucked |
| | Prone quad stretch with strap | Modify | 2×20 s | Extension-biased; skip if flexion DP |
| Calves/ankles | Wall calf stretch, straight knee | Modify if the foot tingles | 2×20–30 s | Heel down |
| | Bent-knee soleus stretch | OK | 2×20–30 s | Knee over toes |
| | Knee-to-wall rocks | OK | 10/side | Heel stays down |

## 5. Linking rules and daily templates

**State modifiers.**

- **Red day:** walk, DP drill, sliders, regressed Big 3, gentle hip mobility. No deep holds.
- **Nerve flag:** sliders fill the 6:00 slot; no static hamstring stretch over 30 s; use the bent-knee calf stretch.
- **Within 1 h of waking:** no end-range flexion (Snook 1998), unless the user has a flexion DP.

**Shared opening (all days except core day):**

- 0:00–2:00 **Raise**: march, step-ups or easy bike, RPE 3→5.
- 2:00–3:00 **Cat-camel** ×6–8, plus the DP drill ×10.
- 3:00–6:00 **Big 3 compact**: curl-up 3×10 s; side plank 2×10 s/side; bird dog 3×10 s/side.
- 6:00–7:00 **Sliders** 10–15/side if there is a nerve flag; otherwise the first drill listed for the day.

| Slot | Upper push | Upper pull | Lower squat | Lower hinge | Full body |
|---|---|---|---|---|---|
| 6:00–7:00 (no flag) | Open book 6/side | Thread-the-needle 6/side | Knee-to-wall 10/side | Active knee extension 8/side | Reverse lunge + reach 5/side |
| 7:00–9:00 prime movers | Wall slide ×8; doorway pec 2×20 s | Kneeling lat 2×20 s; biceps 20 s/side | Soleus 20 s/side; side-lying quad 20 s/side; adductor rock-back ×8 | Strap hamstring 2×20 s/side; figure-4 20 s/side | Open book 5/side; wall slide ×8; knee-to-wall 8/side |
| 9:00–11:00 deep holds | Hip flexor 60 s/side | Figure-4 60 s/side | Doorway pec 45 s; standing lat 30 s/side | Hip flexor 60 s/side | Hip flexor 50 s/side |
| 11:00–12:00 coverage | Wrists 20 s each | Chin tuck ×10; upper trap 20 s/side | 90/90 ×6/side | Wall calf 20 s/side | Rock-back ×8; side-lying quad 20 s/side |
| 12:00–13:30 activate | Scapular push-up ×10; pull-apart ×15 | Prone Y-T ×8; scapular pull-up ×8 | Bridge ×10; band walk 10/side | Bridge 2×8 (3 s); dead bug 6/side | Bridge ×10; pull-apart ×12 |
| 13:30–15:00 potentiate | Incline push-up ×8 → empty bar ×8 | Band row ×12 → light pulldown | Box squat ×8 → light goblet ×5 | Dowel hinge ×10 → light kettlebell RDL ×6 | Goblet ×5; incline push-up ×6; hinge ×6 |

The deep-hold cells are defaults. The engine swaps in the user's target regions, excluding that day's prime movers.

**Core/conditioning day:**

- 0:00–3:00 Raise; cat-camel + DP drill.
- 3:00–9:00 Big 3 pyramid: 3-2-1 reps × 10 s holds, each side.
- 9:00–10:00 Sliders if flagged, otherwise chin tuck ×10 + upper trap 20 s/side.
- 10:00–13:00 Deep holds for 2 target regions, 45 s/side.
- 13:00–14:00 Dead bug 6/side; Pallof press 2×10 s/side.
- 14:00–15:00 March → step-ups or skips at the first interval's pace.

**Weekly coverage (6-day cycle).** Every region gets at least 2 exposures:

- Lower back and torso: daily (cat-camel, side plank).
- 3 days: hip flexors, glutes, shoulders, calves, and thoracic (on top of daily cat-camel).
- 2 days, more when chosen as targets: neck, chest, lats, arms/wrists, adductors, hamstrings, quads.

**Coverage algorithm.** Log exposures and static seconds per region. The 11:00 coverage slot goes to the region furthest behind its target: at least 2 exposures a week for every region, and at least 5 min per side for target regions. Missed days then self-correct.

## 6. Developing flexibility over 12 weeks

| Source | Dose finding |
|---|---|
| [Thomas 2018](https://doi.org/10.1055/s-0044-101146) | At least 5 min per week per muscle on 5 or more days. Weekly time matters; time per session does not. |
| [Konrad 2024](https://doi.org/10.1016/j.jshs.2023.06.002) (77 studies) | Moderate ROM gain overall (effect size ~1.0). Static and PNF stretching beat dynamic. Volume, intensity and frequency did *not* change the effect, which conflicts with Thomas 2018. |
| [Delphi 2025](https://doi.org/10.1016/j.jshs.2025.101067) | Static or PNF, 2–3 sets daily, 30–120 s per muscle, to maximise weekly volume |
| ACSM ([2011](https://doi.org/10.1249/MSS.0b013e318213fefb); [FITT](https://pmc.ncbi.nlm.nih.gov/articles/PMC7930885/)) | Minimum for maintenance: 10–30 s × 2–4 reps (~60 s per exercise), at least 2–3 days a week |
| [Afonso 2021](https://doi.org/10.3390/healthcare9040427); [Alizadeh 2023](https://doi.org/10.1007/s40279-022-01804-x) | Full-range resistance training gains ROM about as well as stretching, but bodyweight-only training does not |

**Prescription.**

- **Targets.** Choose 2–3 target regions per 12-week block, using an assessment (knee-to-wall, supine active knee extension, Thomas test, overhead reach) and the user's preference.
- **Volume.** Each target region gets ~60 s per side on at least 5 days (≥5 min/week). Deep-hold slots supply this, plus an optional 5-min post-cardio top-up.
- **Progression.**
  - Weeks 1–4: 2×30 s.
  - Weeks 5–8: 2×45 s or 3×30 s.
  - Weeks 9–12: 2–3×60 s, or contract-relax: a light 3–6 s contraction followed by a 10–30 s stretch (ACSM).
- **Gates.** Deepen range only after 7 Green days, and never progress nerve-tension positions as stretches.
- **Testing.** Re-test every 4 weeks. Load full-range strength work (RDL, split squat, flye) through range to add stimulus.

## 7. Hamstring and calf pain: neural or muscular?

Hamstring tightness is often partly neural: 57% of rugby players with recurrent hamstring strains had a positive slump test, against 0% of controls, with no difference in flexibility ([Turl & George 1998](https://doi.org/10.2519/jospt.1998.27.1.16)). Changing ankle or neck position alters nerve load ([Boyd 2009](https://doi.org/10.2519/jospt.2009.3002); [Ellis 2012](https://doi.org/10.2519/jospt.2012.3854)). Validated self-report screens exist, such as S-LANSS, which classified about 75% of cases correctly ([Bennett 2005](https://doi.org/10.1016/j.jpain.2004.11.007)). Definitions of nerve-root leg pain are still inconsistent ([Stynes 2016](https://doi.org/10.1186/s12891-016-1074-z)).

**Hamstring questions.**

1. **Does it travel below the knee, or come with tingling, numbness or burning?** → neural.
2. **Only if Q1 is no: sit, straighten the knee to the feeling, then look down or pull your toes up. Does the thigh feeling change?** → neural (this is "structural differentiation": muscle doesn't care about neck position). Do this once, gently.
3. **Is it right at the sit bone and worse when sitting on hard seats?** → proximal hamstring tendinopathy ([Goom 2016](https://doi.org/10.2519/jospt.2016.5986)).
4. **Did it start suddenly while sprinting or kicking, and is there a tender spot or bruising?** → muscle strain.

**Calf questions.**

1. **Tingling on the sole or outer foot, or weakness on tiptoe?** → S1 nerve root.
2. **Calf pain on walking that eases when you just stand still?** → vascular claudication (likelihood ratio 20; [Nadeau 2013](https://doi.org/10.1503/cjs.016512)). Raise it with a GP, especially with diabetes or hypertension; PAD can mimic sciatica ([Feller 2023](https://doi.org/10.3390/healthcare11111527)). If the pain eases only with sitting or bending forward → neurogenic (stenosis).
3. **One calf swollen, warm and discoloured?** → possible DVT (§2).
4. **A sudden "kick" in the calf or a snap while pushing off?** → strain or Achilles rupture; get urgent assessment.

| Origin | Stretches | Strength block |
|---|---|---|
| Neural | Sliders; strap stretch with knee soft and toes pointed; bent-knee calf stretch. No slump, no forced dorsiflexion, no holds over 30 s. Use the DP drill if one is established. | Prefer hip thrust, bridge, trap-bar from blocks and upright split squat. Avoid stiff-leg deadlifts and good mornings. Regress any lift that makes symptoms spread. |
| Muscle strain | Gentle, pain-free (≤3/10) range work as tolerated | Isometrics → lengthening loads; a lengthening-focused protocol shortened return to play (28 vs 51 days) ([Askling 2013](https://doi.org/10.1136/bjsports-2013-092165)). Add Nordics later (they halve hamstring injuries; [van Dyk 2019](https://doi.org/10.1136/bjsports-2018-100045)). |
| Hamstring tendon | Avoid compressive deep hip-flexion stretches early | Isometric bridges, then progressive loading (Goom 2016) |
| Vascular, DVT, neuropathy | Stretching doesn't treat these; refer (§2) | Per the diabetes/hypertension doc |

## 8. Where evidence is weak or disputed

- **Flexion avoidance.** McGill's laboratory data clash with the epidemiology and with cognitive-functional thinking (Saraceni 2020; O'Sullivan 2020).
- **Big 3.** RCT support is low quality.
- **McKenzie.** Network meta-analyses disagree; DP self-testing has not been validated outside clinics.
- **Pain-monitoring thresholds.** They come from tendon research.
- **Nerve-glide doses.** No dose is standardised.
- **Flexibility dose-response.** Thomas 2018 and Konrad 2024 conflict.
- **Red flags.** Most lack evidence of diagnostic accuracy.
