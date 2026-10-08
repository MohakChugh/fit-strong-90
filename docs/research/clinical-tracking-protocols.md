# Clinical tracking protocols

Research checked on 8 October 2026. This document follows `docs/reimagine/BOARD.md`, especially C1, C4, C9 and C11. It specifies curated education, tracking and deterministic safety rules for a front end only personal health app. It requires no AI assistant, remote health service or medication decision engine.

The design persona is an Indian adult with type 2 diabetes, blood pressure concerns, a lower back injury and sciatica. Their age, medicines, kidney function, retinopathy status, established hypertension diagnosis and clinician targets are unknown. Keep those branches conditional. A missing treatment profile must never silently become “metformin only”.

**Clinical recommendation** means the cited source actually recommends the number or interval. **Research evidence** describes a study, not a prescription. **App policy** is an explicitly identified conservative product decision built around sourced risks. It must not be presented as a verbatim guideline recommendation. Unsupported numerical rules are labelled **Unsourced — do not ship**.

## Summary

| Measure | How often | Target or interpretation | Source |
|---|---|---|---|
| Capillary glucose, diet or metformin only | No routine daily testing requirement; structured checks when clinically indicated | For many nonpregnant adults, premeal 80 to 130 mg/dL; peak postmeal <180 mg/dL | ADA 2026, recommendations 7.13 and Table 6.3; NICE NG28, 1.6.2 to 1.6.4 [ADA7], [ADA6], [NG28] |
| Capillary glucose, sulfonylurea | Clinician plan plus symptoms, missed meals, illness and exercise risk; no universal fixed daily count | Same personalised glucose goals, with additional hypoglycaemia precautions | ADA 2026, sections 6 and 7; NICE NG28, 1.6 [ADA6], [ADA7], [NG28] |
| Capillary glucose, basal insulin | Fasting checks on the clinician's monitoring schedule, plus safety checks | Fasting generally uses the premeal target; the app never titrates insulin | ADA 2026, section 7, “People With Diabetes Using Basal Insulin…” [ADA7] |
| Glucose, multiple daily injections | Before meals and snacks, bedtime, exercise, symptoms and recovery from a low; CGM with meter backup where used | Individualised targets; many using a meter alone need 6 to 10 checks daily, rather than a universal quota | ADA 2026, recommendation 7.11 and intensive insulin monitoring discussion [ADA7] |
| HbA1c | At least twice yearly if stable; approximately every 3 months when not at goal or treatment or health changes | <7% for many adults; lower or looser targets depend on benefits, hypoglycaemia, frailty and treatment burden | ADA 2026, 6.2 to 6.5 [ADA6] |
| CGM report | Continuous use according to treatment plan; interpret a report with 14 days and ≥70% active data | TIR >70%; time <70 mg/dL <4%; time <54 mg/dL <1%; CV ≤36%; no standard GMI goal | ADA 2026, Table 6.2 [ADA6] |
| Home BP | Diagnostic block of at least 4 days, ideally 7; stable treated monitoring can be weekly or monthly according to health status | NICE home diagnosis ≥135/85 mmHg differs from clinic ≥140/90; clinician chooses the treatment framework | NICE NG136, 1.2.7 to 1.2.8; ESH 2021, Box 15 [NG136], [ESH21] |
| Activity | Accumulate throughout the week, beginning below the final goal if necessary | WHO: 150 to 300 minutes moderate or 75 to 150 minutes vigorous activity weekly; strength on ≥2 days | WHO 2020 [WHO20] |
| Steps | Observe usual activity and tolerable walking; no mandatory medical step count | Mortality associations flatten around 6,000 to 8,000 in adults ≥60 and 8,000 to 10,000 below 60, not individual targets | Paluch et al., 2022, observational meta-analysis [STEPS22] |
| Sitting | Interrupt prolonged sitting at least every 30 minutes when able | Brief movement; no established safe total daily sitting ceiling | ADA 2026, 5.34; WHO 2020 [ADA5], [WHO20] |
| Back and leg symptoms | Before and after guided sessions and whenever symptoms change, an app workflow rather than a validated medical interval | Separate pain ratings, distal symptom extent, strength, sensation and function; emergency signs override the pain score | NIH back pain task force; NICE NG59 and NG127; NHS sciatica [NIHBACK], [NG59], [NG127], [SCIATICA] |
| Vitamin B12 | Periodic assessment on long term metformin; annually after >4 years or other specified risk; symptoms trigger earlier review | NICE total B12: <180 pg/mL deficient, 180 to 350 indeterminate, >350 deficiency unlikely, subject to validated local laboratory ranges | ADA 2026, 3.10 and metformin discussion; NICE NG239, Table 1 [ADA3], [NG239] |
| Vitamin D | Test for a clinician identified indication; no automatic annual screening | NIH ODS/NASEM: <12 ng/mL risk of deficiency; 12 to <20 generally inadequate; ≥20 adequate for most; >50 potentially adverse | NIH ODS, Table 1; Endocrine Society 2024 [ODSD], [ENDO24] |
| Weight and waist | Weight weekly to monthly; waist at clinical or weight management reviews | Indian risk cutoffs differ from international WHO BMI cutoffs; see named frameworks below | NHS England; RSSDI 2020; ICMR-NIN 2024 [WEIGHT], [RSSDI20], [NIN24] |
| Fluids and sleep | Optional habit records; clinical plans override general advice | NIN approximately 2 litres including beverages for a healthy adult; NHS sleep usually 7 to 9 hours | NIN 2024, Guideline 14; NHS insomnia [NIN24], [SLEEP] |
| Desk setup and breaks | Review setup when work changes; vary tasks and posture during work | OSHA suggests 5 minutes away from computer tasks each hour; integrate with the diabetes sitting breaks | OSHA computer workstations, Work Process [OSHAWORK] |

## Safety contract

Evaluate this contract before starting a guided session, when a new reading or symptom arrives, and when the user reports a change during the session. It is a specification for subsequent tests, not application code.

Actions have this precedence: **emergency help now**, **stop and seek help today**, **hold pending recovery or clinical advice**, **adjust**, then **reassure**. Higher priority symptoms override every numerical target, average and achievement. “Contact today” means the diabetes team, treating clinician or local urgent care service; “emergency” means local emergency services. UK source telephone numbers must not be copied into an Indian interface.

| ID | Exact condition | Required app action and release condition | Basis |
|---|---|---|---|
| E-CARDIAC | New chest pain or pressure, suspected stroke symptoms such as sudden facial or limb weakness or speech disturbance, collapse without normal recovery, or severe new breathlessness | Interrupt immediately, refuse a session, direct emergency help. Do not wait for BP or glucose and do not offer a gentler workout. | ADA exercise statement, cardiovascular precautions; AHA emergency guidance [EX16], [AHACRISIS] |
| E-CES | New inability to start urinating or urinary retention; new bladder or bowel incontinence; new loss of sensation around the genitals, anus or saddle region; or new sexual dysfunction with back pain radiating into a leg | Interrupt immediately and direct emergency assessment for possible cauda equina syndrome. A normal glucose, BP or low pain score cannot clear this flag. | NICE NG127, 1.7.3; NHS sciatica and back pain [NG127], [SCIATICA], [BACK] |
| E-BILATERAL | New bilateral sciatica with severe or worsening weakness or numbness in both legs, or back pain with new bilateral neurological symptoms | Emergency assessment; do not route to stretching or a routine appointment. | NHS sciatica and back pain [SCIATICA], [BACK] |
| E-HYPO | Suspected hypoglycaemia with seizure, unconsciousness, inability to swallow safely, or altered functioning requiring another person's help | Stop, call emergency help where the person cannot safely self-treat, and show no oral food or drink instruction. A trained helper may use already prescribed glucagon according to its existing instructions. No insulin advice. | ADA 2026, Table 6.4 and recommendation 6.15; NHS hypoglycaemia [ADA6], [HYPO] |
| E-BP | Resting SBP ≥180 **or** DBP ≥120 mmHg **and** new chest or unusual severe back pain, breathlessness, confusion, weakness, numbness, vision change or speech difficulty | Emergency help now. Do not delay for a repeat reading or lower the category because the other BP component is normal. | NICE NG136, 1.5.2; AHA 2025. Inclusive numerical boundary follows NICE; AHA's patient page uses >180/120. [NG136], [AHACRISIS] |
| E-KETONE | Blood ketones ≥3.0 mmol/L or urine ketones ≥2+ | Refuse or interrupt and direct emergency assessment. This is a conservative app escalation at the ADA diagnostic ketosis boundary, not an app diagnosis of DKA. NHS's public emergency boundaries are >3 and >2+; the app deliberately does not leave equality reassuring. | ADA 2026, Table 16.1; NHS DKA [ADA16], [DKA] |
| E-DKA-SYMPTOM | Diabetes with vomiting and abdominal pain, deep or unusual breathing, fruity breath, marked drowsiness or confusion suggesting DKA, especially during illness or SGLT2 treatment; ketones may be unknown | Emergency assessment. An apparently normal glucose cannot clear possible euglycaemic DKA. | ADA 2026, sections 6 and 16; NHS DKA [ADA6], [ADA16], [DKA] |
| E-EXTREME-GLUCOSE | Reliable glucose reading ≥600 mg/dL, equivalent to 33.3 mmol/L | Emergency assessment and no exercise. This is a conservative response to the HHS hyperglycaemia criterion; HHS also needs clinical and laboratory criteria the app cannot establish. | ADA 2026, Table 16.1 [ADA16] |
| E-OTHER | Back pain following a serious accident, back pain with chest pain, or dehydration/heat illness with confusion or difficulty waking | Emergency assessment, no exercise. | NHS back pain and dehydration [BACK], [DEHYDRATION] |
| T-BP | Properly obtained resting SBP ≥180 **or** DBP ≥120 mmHg without the emergency symptoms above; repeat remains severe after at least 1 minute | Hold, contact a clinician urgently today. Do not prescribe an extra tablet or rapid BP reduction. The app cannot exclude organ injury; a clinician's pathway for an assessed asymptomatic patient is not automatic home clearance. | AHA 2025 repeat protocol; NICE NG136, 1.5.1. Same day contact is a conservative app policy. [AHACRISIS], [NG136] |
| T-NEURO | New foot drop, foot dragging or slapping, newly impaired walking from weakness, or progressive weakness in either leg | Stop and seek urgent assessment today. Rapid progression, bilateral involvement or a cauda equina symptom moves to the emergency rules. | NICE NG127, 1.7.3 to 1.7.4 [NG127] |
| T-BACK | Back pain with fever, shivering or feeling generally unwell; severe sudden pain; or pain worsening quickly | Hold and seek urgent clinical assessment today. A measured temperature ≥38°C supports fever but its absence does not negate feeling feverish or shivery. | NHS back pain; NHS fever [BACK], [FEVER] |
| T-HYPO-REVIEW | A recovered glucose <54 mg/dL episode; any level 3 episode; glucose still <70 mg/dL on the 15 minute recheck after treatment; or another <70 mg/dL reading after documented recovery during the same session attempt | End that session, repeat rescue treatment as needed under the existing hypo plan and obtain clinical advice today. The defined contact boundary and no automatic session restart after these events are conservative app policies. | ADA 2026, Table 6.4, 6.15 and 6.19 support rescue treatment and treatment plan reevaluation after level 2 or 3 events. [ADA6] |
| T-KETONE | Blood ketones ≥1.5 and <3.0 mmol/L | No exercise; contact the diabetes team today. The contact boundary is deliberately conservative: ADA exercise guidance holds at ≥1.5; NHS calls for immediate team advice at 1.6 to 3 even if well. | ADA 2016 exercise statement; NHS DKA [EX16], [DKA] |
| T-ILLNESS | Positive ketones with feeling unwell; high glucose that is not falling under the existing clinician plan; or vomiting/inability to retain fluids | Hold and contact the diabetes team or urgent care now. DKA symptoms or altered consciousness trigger emergency help. The app must not generate a sick day medicine plan. | NHS DKA; ADA 2026, intercurrent illness and crisis prevention [DKA], [ADA6] |
| H-HYPO | Glucose <70 mg/dL and the person is alert and can swallow | Stop. Use the 15 g, 15 minute treatment described below. Never resume just because a reading crosses 70. Symptoms must resolve and the person's exercise safety plan must permit resumption; level 2/3 follows T-HYPO-REVIEW. | ADA 2026, Table 6.4 and 6.15 [ADA6] |
| H-PRE-LOW | Before exercise, glucose ≥70 and <90 mg/dL in someone using insulin or a sulfonylurea/other secretagogue | Hold pending the existing exercise carbohydrate and monitoring plan. This is not the same as diagnosed hypoglycaemia and is not a universal carbohydrate instruction for metformin only. | ADA 2026, physical activity precautions; ADA 2016, Table 1 [ADA5], [EX16] |
| H-HIGH | Glucose >250 mg/dL with moderate or large urine ketones, or blood ketones meeting the hold boundary above | Do not exercise. Apply ketone and illness escalation first. | ACSM 2022, Table 4; ADA 2016 exercise statement [ACSM22], [EX16] |
| H-HIGH-UNCHECKED | Insulin deficiency/prior DKA risk, unexplained glucose ≥250 mg/dL before exercise, and no usable ketone result or existing clinician exercise plan | Hold the guided session pending assessment under the existing plan. This is a conservative app policy for a risk group, not a mandate to test ketones daily in every person with type 2 diabetes. | ADA 2016 exercise hyperglycaemia precautions; ADA 2026 crisis prevention [EX16], [ADA6] |
| H-T2-HIGH | Type 2 diabetes with glucose >300 mg/dL, even without excessive ketones | Hold the guided moderate or vigorous session. ACSM permits only light activity when well and adequately hydrated; the app may follow an existing clinician plan for that option, never use a workout to treat a crisis. | ACSM 2022 hyperglycaemia precautions. The guided-session hold is conservative app policy. [ACSM22] |
| H-LOW-KETONE | Blood ketones ≥0.6 and <1.5 mmol/L | Hold the guided session while following the existing sick day plan and recheck in 2 hours; contact the team immediately if unwell. Routine activity clearance after a positive ketone result must come from the plan. | NHS DKA gives 0.6 to 1.5 and a 2 hour recheck; exercise hold is conservative app policy. [DKA] |
| H-EXERCISE-BP | Properly obtained resting SBP >160 **or** DBP >100 mmHg before a guided session, without a clinician plan permitting that session at those readings | Hold and obtain clinician advice about control before exercise. This is a conservative app gate based on ACSM's “above 160/100” advice, not a hypertensive emergency definition. Recheck correctly; severe readings follow the higher rules. | ACSM Exercise is Medicine, 2024, “High Blood Pressure Tips and Cautions” [EIM24] |
| H-DIZZY | Dizziness, presyncope or new unsteadiness during exercise or after standing, regardless of BP; especially BP <90 systolic or <60 diastolic, or a documented standing fall ≥20 systolic or ≥10 diastolic mmHg | Stop, sit or lie somewhere safe and seek assessment if symptoms persist or recur. Fainting without recovery is an emergency. Do not force fluids if there is a restriction. | NHS hypotension; NICE NG136, 1.1.5 to 1.1.6; ACSM hypertension advice [LOWBP], [NG136], [EIM24] |
| H-FOOT/EYE | Active foot ulcer or new hot, swollen foot in a person with neuropathy; or a known retinopathy restriction relevant to the planned exercise | Refuse weight bearing exercise for the foot condition and seek prompt care. Refuse prohibited straining, heavy lifting or head down movements for the eye restriction. Do not turn a restriction on a particular mode into an invented ban on every safe movement. | ADA 2016, Table 5; ACSM 2022, Table 5 [EX16], [ACSM22] |
| H-DATA | A required safety check is missing, the medicine risk class is unknown, units are absent/ambiguous, the device reports an error or “HI”, or a CGM result conflicts with symptoms | Do not label the session safe. Request a usable check according to the plan and meter confirmation where appropriate. Persistent “HI” requires urgent clinical advice, with emergency symptoms handled first. Never interpret missing as normal or assume every device's “HI” means the same numerical value. | ADA 2026, 7.10 to 7.12 and CGM limitations; this blocking behaviour is app policy. [ADA7] |
| A-BACK | New distal spread of leg symptoms during a movement, or worse walking/sitting function after the previous session, without emergency or progressive weakness flags | Stop the provoking movement, withhold progression and return only to previously tolerated, clinically appropriate activity. Persistent new neurological symptoms require clinical review. No automatic percentage reduction or pain score permission rule. | NICE NG59, activity tailored to capability; unsupported numerical rules are excluded. [NG59] |

**Boundary and precedence tests:** glucose exactly 54 mg/dL is level 1, while below 54 is level 2; exactly 70 is not a biochemical hypo, but remains within H-PRE-LOW if below 90 in a risk group. Blood ketones exactly 1.5 trigger T-KETONE and exactly 3.0 trigger E-KETONE. BP 180/80 or 120/120 meets the severe resting rule, and symptoms determine emergency escalation. BP exactly 160/100 does not meet the strict `>` EIM gate, but may still exceed the person's clinical target; this is not a declaration of exercise safety. These are boundary examples derived from the cited rules, not additional clinical thresholds. [ADA6], [EX16], [ADA16], [NG136], [EIM24]

Evaluate severe individual BP readings before discarding a diagnostic first day or averaging. New bladder or saddle symptoms with glucose in target still trigger E-CES. Suspected stroke with BP below the severe threshold still triggers E-CARDIAC. A good HbA1c, reassuring weekly average or familiar one-sided sciatica cannot cancel an acute red flag.

Symptom conditions are explicit reported flags, such as new urinary retention, new weakness or feeling unwell, rather than a severity inferred by the app. If multiple flags apply, the highest priority action wins. “Reassure” means a specific result is within its recorded target and no safety flag applies; it never means the app has excluded disease.

**Excluded numerical gates:** a universal exercise termination BP of 250/115, a universal resting exercise cutoff of 200/110, a fixed pain score that makes movement safe, and automatic load/step percentage changes were not established from the sources reviewed here. **Unsourced — do not ship** these as this app's rules. Laboratory B12/D results, BMI, sleep hours and CGM averages alone are not acute exercise clearance tests.

## Glucose

### Measure and technique

Record glucose value and units, capillary versus sensor source, timestamp, relationship to the start of a meal, symptoms, activity and relevant treatment class. Use an approved meter, correctly stored unexpired strips and the device instructions. Wash and thoroughly dry hands before a fingerstick; contamination from food can distort a result. A surprising reading merits a correct repeat, without delaying treatment of symptoms. [ADA7], [METER]

“Fasting” means no caloric intake for at least 8 hours, not merely a reading taken early in the morning. For the postmeal target, measure 1 to 2 hours after the **start** of the meal. Meal targets are treatment goals, not a new diagnosis from a home meter. [ADA2], [ADA6]

### Cadence by treatment situation

| Situation | Sourced cadence and practical app behaviour | What must not be invented |
|---|---|---|
| Diet, activity and metformin only | NICE does not routinely offer SMBG unless specific indications apply. ADA supports structured checks when nutrition, activity, illness or treatment evaluation makes them useful. Store a clinician requested premeal/postmeal experiment with a purpose and an end point. [NG28], [ADA7] | Mandatory lifelong daily fasting or postmeal tests. **Unsourced — do not ship.** |
| Sulfonylurea, such as gliclazide or glimepiride | Hypoglycaemia risk changes the safety branch. Use the person's monitoring plan, add checks for suspected lows, illness and exercise risks, and respect driving or machinery advice. CGM is recommended by ADA for noninsulin therapies that can cause hypoglycaemia where appropriate. [ADA6], [ADA7], [NG28] | A universal number of fingersticks per day. **Unsourced — do not ship.** |
| Basal insulin | ADA says evidence is insufficient to specify a universal BGM frequency for nonintensive insulin treatment; fasting monitoring is useful for the clinician's treatment decisions. The app should follow a recorded fasting schedule, which may be daily when prescribed, plus symptom/exercise safety checks. [ADA7] | Presenting daily fasting testing as an ADA requirement for every basal insulin user, or turning its result into a titration suggestion. |
| Multiple daily injections | Assess before meals/snacks, bedtime, occasionally after meals, before/during/after activity, when low or high is suspected, and after treating a low until recovered. For many using BGM alone this entails 6 to 10 checks daily, but needs vary. CGM reduces fingerstick burden when used appropriately; a meter remains available. [ADA7] | Treating 6 to 10 as an immutable daily checklist or duplicating every sensor reading with a fingerstick. |

The correct answer can be “the guideline does not set a universal interval”. A clinician monitoring plan is necessary in that branch; an arbitrary reminder is not a clinical recommendation.

### Targets, interpretation and follow-up

| Measure | Named framework and target | App response |
|---|---|---|
| Fasting/premeal glucose | ADA 2026, Table 6.3: 80 to 130 mg/dL, or 4.4 to 7.2 mmol/L, for many nonpregnant adults [ADA6] | Within the person's target and symptom free, explain that this reading is in range. Repeated departures prompt a review of the recorded pattern with the clinician, not medicine advice. |
| Peak postmeal glucose | ADA 2026, Table 6.3: <180 mg/dL, or <10.0 mmol/L, at 1 to 2 hours from meal start [ADA6] | Show timing and context; a reading taken at another time is not automatically a failed postmeal target. |
| HbA1c, usual adult goal | ADA 2026, 6.3a: <7%, or <53 mmol/mol [ADA6] | A long term control measure. Above target calls for a clinical review, not an emergency label or a harder workout. |
| Lower HbA1c goal | ADA 2026, 6.4: <6.5% can suit good health/function with low treatment risk and burden [ADA6] | Clinician selected, never earned by an app streak. |
| Healthy older adults | ADA 2026, 13.7a: goals such as <7.0% to <7.5% [ADA13] | Do not loosen a target solely because a birthday was reached. |
| Complex/intermediate older health | ADA 2026, 13.7b: goals such as <8%; very complex/poor health emphasises avoiding hypoglycaemia and symptomatic hyperglycaemia rather than a stringent HbA1c [ADA13] | Frailty, cognitive/functional impairment, major comorbidity, severe hypoglycaemia and burden support individualisation. |

ADA recommendation 6.2 specifies at least twice yearly assessment when stable, with more frequent assessment, for example every 3 months, when goals are unmet, treatment changes, severe glucose events occur or health status changes. NICE NG28, 1.5.1, uses 3 to 6 months until stable on unchanged treatment and 6 months once stable. The app can use the ADA conditional schedule and display a clinician override. [ADA6], [NG28]

### CGM

ADA 2026, Table 6.2, supports these report metrics. Require an interpretable window of 14 days with ≥70% active data; missing sensor time is not time in range. [ADA6]

| Metric | Most adults | Older adults with complex/intermediate health | Meaning |
|---|---|---|---|
| Time in range, 70 to 180 mg/dL | >70% | >50% in Table 6.2 | Useful overall exposure, never permission to ignore an acute low. |
| Time below 70 mg/dL | <4% | <1% | Prioritise preventing lows. |
| Time below 54 mg/dL | <1% | <1% | A nested subset of time below 70, not another amount to add. |
| Time above 180 mg/dL | <25% | <50% | Pattern for clinical review. |
| Time above 250 mg/dL | <5% | <10% | Nested within time above 180. |
| Coefficient of variation | ≤36% | Interpret with the clinical plan | Variability can expose hypo risk despite a reasonable mean. |
| GMI | No standardised target | No standardised target | An estimate from mean sensor glucose, not a laboratory HbA1c result. |

All numerical entries in this table are from [ADA6], Table 6.2. ADA section 13 describes TIR ≥50% for complex older adults; retain the source-specific wording rather than hiding the boundary difference. [ADA13]

Do not invent a GMI <7% success gate. Anaemia, altered red cell turnover, kidney disease and other factors can make HbA1c disagree with sensor estimates; B12 related anaemia belongs in that interpretation. CGM can lag during rapid change. Confirm discordant symptoms/results with the meter according to the device and care plan, while treating suspected hypoglycaemia promptly. The PWA must not promise the alarm reliability of the medical CGM system. [ADA6], [ADA7]

### Exercise and delayed hypoglycaemia

For insulin or secretagogue treatment, assess glucose before, during and after exercise according to the care plan, with additional checks for symptoms, unusual duration/intensity and recovery from a low. Discuss bedtime and overnight/next day monitoring after activity that has caused or may cause a delayed low. ADA does not prescribe a universal in-session check interval or a universal overnight alarm time. [ADA7], [ACSM22]

The ADA exercise statement reports nocturnal hypoglycaemia commonly occurring 6 to 15 hours after activity, with risk extending up to 48 hours. Much of that quantified evidence is in insulin treated/type 1 diabetes; do not portray it as an inevitable effect of a short walk on metformin alone. Insulin and secretagogue users remain the relevant higher risk type 2 group. Carry rapidly absorbed carbohydrate and follow the existing rescue plan. [EX16], [ACSM22]

Pre-exercise glucose <90 mg/dL may require carbohydrate in insulin/secretagogue users. The ADA 2016 exercise table's 15 to 30 g recommendation comes largely from insulin/type 1 management and must not become automatic food dosing for every type 2 user. The actual pre-exercise carbohydrate strategy comes from the person's plan. [ADA5], [EX16]

### Hypoglycaemia and the 15 minute loop

ADA 2026, Table 6.4, defines level 1 as glucose <70 and ≥54 mg/dL; level 2 as <54 mg/dL; and level 3 as altered functioning requiring assistance, irrespective of the measured value. Symptoms and ability to swallow determine how to respond. [ADA6]

For an alert person who can swallow, ADA recommendation 6.15 and its discussion support 15 g of fast acting carbohydrate, rechecking after 15 minutes and repeating if still low. Glucose is preferred; avoid relying on fatty foods that delay absorption. The interface should show the measured carbohydrate amount, not an assumed sugar content of an Indian sweet or an unspecified glass of juice. Persistent hypoglycaemia needs help. Severe impairment follows E-HYPO. Automated insulin delivery may have a different prescribed rescue plan; do not overwrite it. [ADA6]

### Hyperglycaemia, ketones and treatment boundaries

ACSM 2022 advises no exercise with glucose >250 mg/dL and moderate/high ketones; at >300 mg/dL without excessive ketones, only light activity if well and properly hydrated. ADA exercise guidance postpones exercise at blood ketones ≥1.5 mmol/L. These are exercise precautions, not fasting treatment targets. [ACSM22], [EX16]

For people at DKA risk, illness, missed insulin or symptoms can require ketone checking, particularly when glucose exceeds 200 mg/dL. SGLT2 associated DKA can occur without marked hyperglycaemia. Use blood or urine results with their own units and categories; never convert a urine “+” into a guessed blood value. [ADA6], [ADA16]

NHS blood ketone interpretation is <0.6 mmol/L normal, 0.6 to 1.5 slightly high with a repeat in 2 hours, 1.6 to 3 needing immediate team advice, and >3 needing emergency help. The safety contract explicitly applies a more conservative app boundary at 1.5 for holding/contact and at 3.0 for emergency assessment, grounded in ADA exercise and diagnostic ketosis thresholds. [DKA], [EX16], [ADA16]

**The app must not calculate insulin, suggest correction doses, change basal or bolus treatment, recommend omitting medicines, or create sick day medication instructions.** It can display a previously recorded clinician plan and direct the user to clinical help. This restriction includes medications discussed in source exercise tables.

## Blood pressure

### Home measurement protocol

Use a validated automatic upper arm monitor with a cuff matched to measured arm circumference. Place it on bare skin, following its artery marker and placement instructions. Support the arm with the cuff at heart level. A cuff that is too small or a wrist reading taken in an arbitrary position is not equivalent. A clinician can establish the appropriate arm and adaptations when an upper arm cuff cannot be used. [BP19]

Avoid smoking, caffeine and exercise for at least 30 minutes beforehand; empty the bladder. Sit quietly for 5 minutes with back supported, feet flat, legs uncrossed and arm supported. Do not talk or use the phone during the reading. These are resting measurements, not exercise BP measurements. [BP19]

For a diagnostic block, use the NICE NG136, 1.2.7 protocol: 2 consecutive readings at least 1 minute apart, morning and evening, for at least 4 days and ideally 7. Discard the first day's readings for the diagnostic average, then average the remaining valid systolic values and diastolic values separately. Do not pick only the lower reading or average the two components together. [NG136]

Use consistent morning and evening conditions; where feasible, morning readings precede breakfast and the usual antihypertensive dose. Never delay or omit prescribed medication to obtain a reading. Log posture, symptoms and departures from the protocol. Severe readings still trigger safety rules even on the discarded first day. [BP19], [ESH21]

### Name the diagnostic and treatment framework

| Framework | Clinic threshold or target | Home threshold or target | Implication |
|---|---|---|---|
| NICE NG136 diagnosis | ≥140 systolic or ≥90 diastolic mmHg | Average ≥135 systolic or ≥85 diastolic mmHg confirms alongside raised clinic BP | Home and clinic cutoffs differ. A single reading does not establish the diagnosis. NICE 1.2.8. [NG136] |
| NICE treatment, age <80 | <140/90 mmHg | <135/85 mmHg | Individualise for comorbidity, frailty and postural symptoms. NICE 1.4.20 and 1.4.22. [NG136] |
| NICE treatment, age ≥80 | <150/90 mmHg | <145/85 mmHg | Age and clinical judgement belong in the target record. NICE 1.4.21 to 1.4.22. [NG136] |
| ADA 2026 diabetes | Hypertension ≥130 systolic or ≥80 diastolic, confirmed on separate occasions; usual treated goal <130/80 if safely attainable | Home monitoring is recommended, but do not manufacture a home target by subtracting a fixed amount | A different clinical framework, not an error in NICE. High cardiovascular/kidney risk can justify a clinician selected systolic goal <120. ADA 10.1 to 10.4. [ADA10] |

Normal average home BP alongside elevated clinic BP may suggest a white coat pattern; the reverse can suggest masked hypertension. Explain the pattern and advise assessment, never autonomously diagnose or change treatment. AHA's correspondence table maps clinic 140/90 to home 135/85, while clinic 130/80 corresponds to home 130/80. There is no universal “subtract 5” rule. [BP19]

### Frequency and action

For suspected or untreated hypertension, obtain the diagnostic block and arrange clinical interpretation; repeat blocks according to the clinician plan or changed circumstances. A universal indefinite daily home measurement requirement for untreated hypertension is **Unsourced — do not ship**.

For stable treated hypertension, ESH 2021, Box 15, allows once or twice per week or month according to status and preference. It recommends a 7 day block before clinic visits and, when controlled, at least a week of monitoring within 3 months. More frequent monitoring may be appropriate when readings or treatment change. ESH discourages perpetual excessive daily monitoring and self-adjustment of medication. Its own averaging advice does not mandate first day exclusion; this app's diagnostic calculation deliberately chooses the NICE protocol and must identify that choice. [ESH21], [NG136]

ADA 2026 recommends clinical BP at routine visits or at least every 6 months in diabetes. NICE hypertension care includes an annual clinical review. These clinical visits are not a justification for daily home reminders. [ADA10], [NG136]

Repeated modest elevation above the person's target means review the pattern with the clinician. Resting >160 systolic or >100 diastolic invokes the conservative guided-session hold based on ACSM 2024. Resting ≥180 systolic or ≥120 diastolic invokes urgent or emergency assessment according to symptoms. “Hypertensive urgency” or “severe hypertension without acute organ damage” is not the same as hypertensive emergency; the latter depends on acute organ injury, not the number alone. The app cannot exclude that injury. [EIM24], [AHACRISIS], [NG136]

Do not apply resting thresholds to an unreliable cuff reading during movement. Stop for symptoms, let the person rest safely and assess with proper technique. A clinician's lower exercise limit takes precedence; supervised exercise test termination rules should not be imported into an unsupervised PWA without a verified applicable source.

### Exercise cautions

Avoid breath holding and the Valsalva manoeuvre during resistance exercise; teach breathing and use tolerable loads rather than heavy straining. Cool down and change posture gradually because BP can fall after activity, especially with antihypertensives, dehydration or autonomic neuropathy. Dizziness or presyncope stops the session regardless of the number. [EIM24], [EX16], [ACSM22]

Head below heart positions are specifically restricted with some diabetic retinopathy states; do not generalise that into a ban on every forward bend for everyone with controlled BP. For the design persona, unreviewed inversions and strenuous breath holding should not be default session content. The app needs the applicable eye/BP restrictions, and safer upright alternatives, rather than an invented “inversion angle” cutoff. ADA exercise statement, Table 5. [EX16]

## Physical activity and walking

WHO 2020 recommends 150 to 300 minutes of moderate aerobic activity or 75 to 150 minutes of vigorous activity weekly, plus muscle strengthening involving major muscle groups on at least 2 days. Adults aged ≥65 should also include varied balance and strength focused multicomponent activity on at least 3 days. Some activity is better than none; begin with small amounts and increase gradually. Activity does not need to occur in minimum 10 minute bouts. [WHO20]

ADA 2026, 5.36 to 5.37, recommends at least 150 minutes of moderate/vigorous aerobic activity across at least 3 days, with no more than 2 consecutive inactive days, and resistance exercise on 2 to 3 nonconsecutive days. These are eventual weekly goals, not permission to override sciatica, cardiovascular symptoms or glucose safety. [ADA5]

Track walking duration, tolerance, activity intensity and optional steps. A “can talk but cannot sing” check can help describe a brisk moderate walk without inventing a heart rate target. [WALK]

**Steps:** Paluch et al. 2022 pooled observational cohorts and found progressively lower mortality associations up to roughly 6,000 to 8,000 daily steps for adults ≥60, and 8,000 to 10,000 for adults <60. These are observational curve patterns, not WHO targets, causal guarantees, minimums or ceilings. The evidence does not prescribe 10,000 steps to an Indian adult with diabetes and sciatica. [STEPS22]

Build a representative baseline from usable observations, including usual work and nonwork conditions. Use the same source and distinguish missing device data from zero activity. Add a short tolerable walking opportunity, then progress duration or opportunities only when leg symptoms, function and glucose safety remain acceptable under the care plan. No verified guideline establishes a person's starting count, an automatic extra 500 steps, a 10% weekly increment or a progression every 7 days. **Unsourced — do not ship** those numerical rules.

**Postmeal walking:** Reynolds et al. 2016 tested 10 minutes after each of 3 main meals, starting within 5 minutes after finishing, against an untimed 30 minute daily walk in a short crossover trial in type 2 diabetes. Postmeal glucose incremental area under the curve was 12% lower overall and 22% lower after dinner. Those are study outcomes, not a guaranteed change in a fingerstick, HbA1c or medication need. Offer a comfortable postmeal walk as an evidence informed option; the trial does not prove a universal critical timing window. [MEAL16]

DiPietro et al. 2013 tested 15 minute walks starting 30 minutes after meals in older adults at risk of glucose intolerance, not this app's exact population. The different effective schedules argue against an invented universal minute at which everyone must walk. If symptoms limit walking, a shorter tolerated activity remains preferable to chasing the trial dose. [MEAL13], [WHO20]

**Sitting:** ADA 2026, 5.34, recommends interrupting sitting at least every 30 minutes. Dempsey et al. 2016 tested 3 minute light walking or simple resistance breaks every 30 minutes in an acute laboratory study of type 2 diabetes. Acute glucose improvement supports brief movement; it does not establish a lifetime mortality benefit, an HbA1c effect of identical magnitude, or a safe maximum daily sitting total. WHO does not set a numerical sedentary time ceiling. [ADA5], [BREAK16], [WHO20]

## Lower back pain and sciatica

Track back pain and leg pain separately using a 0 to 10 numeric rating, where 0 is no pain and 10 is the worst pain. Track the most distal symptom location, such as buttock, thigh, calf or foot; numbness/tingling; new weakness or foot dragging; walking and sitting tolerance; usual daily function; and sleep disruption. Distinguish a person's established one-sided symptoms from a new pattern. NIH's back pain research standards support pain intensity and functional/interference measures, not an app diagnosis from pain alone. [NIHBACK]

A brief pre/post session check and a change-triggered neurological check are proposed app workflows. No reviewed guideline mandates a fixed daily pain entry or weekly disability score for lifelong self-management. Such a mandatory medical interval is **Unsourced — do not ship**. A clinician may choose repeat functional assessment at treatment reviews.

| Instrument | Valid use and cadence | Reuse status for this app |
|---|---|---|
| STarT Back | Prognostic risk screening at first professional contact for a new episode, per NICE NG59, 1.1.2; not a daily recovery score or emergency screen [NG59] | The Keele form is downloadable and copyrighted. The reviewed download does not establish electronic redistribution permission. App embedding/licence terms remain **Unsourced — do not ship** until permission is confirmed. [START] |
| Oswestry Disability Index | Validated disability measure for back related function; review timing belongs in the care plan | The official Mapi catalogue provides an instrument/permission route. A downloadable copy does not establish permission to embed, translate or redistribute. Exact applicable app licence terms remain **Unsourced — do not ship**. [ODI] |
| Roland-Morris Disability Questionnaire | Validated back related disability questionnaire, suitable for clinician selected functional follow-up | The instrument owner's site explicitly says the original and translations are public domain, with no permission required for any purpose. Preserve the validated wording and identify the version/language. This is the clearest reuse option. [RMDQ], [NIHBACK] |

NICE recommends remaining active and tailoring exercise to capabilities and preferences. “Worse” for the next session should mean a change from the person's documented pattern: distal spread, new neurological symptoms or reduced function. Stop the provoking movement and withhold progression; worsening or persistent neurological changes require clinical assessment. Do not infer nerve damage from a higher pain score alone. [NG59], [NG127]

Universal rules such as “pain ≤3/10 is safe”, “a 2 point rise is acceptable”, “reduce load by 20%” or “all leg pain means bed rest” are **Unsourced — do not ship**. The app can select previously tolerated, reviewed activity; it cannot prescribe rehabilitation from a fabricated threshold.

Cauda equina symptoms, saddle sensory loss, new bladder/bowel/sexual dysfunction, rapidly progressive weakness and the bilateral symptoms in the safety contract must never be softened into “try a lighter session”. Fever/unwellness, sudden severe pain, serious trauma, unexplained weight loss, night/rest pain or a relevant cancer/infection history merit clinical assessment with urgency determined by the acute presentation. [NG127], [SCIATICA], [BACK], [NG59]

NHS states that sciatica usually improves over a few weeks to a few months, but can last longer and recur. The app must not promise a fixed recovery date or a cure after a programme. Persistent worsening or impaired usual activities needs review rather than reassurance from a calendar. [SCIATICA]

## Vitamin B12 and vitamin D

### B12

Metformin, a vegan or poorly supplemented vegetarian diet, malabsorption, relevant gastric/ileal surgery and some other medicines raise risk. Neuropathy, balance/gait problems, fatigue or anaemia can be relevant; deficiency can occur without anaemia or macrocytosis. Do not use a B12 explanation to delay urgent assessment of new sciatica weakness or cauda equina signs. [ADA3], [NG239], [ODSB12]

ADA 2026, recommendation 3.10, advises periodic assessment in long term metformin use, especially with anaemia or peripheral neuropathy. Its discussion specifically supports **annual** monitoring after **more than 4 years** on metformin or with other risk factors such as a vegan diet or relevant gastrointestinal surgery. Symptoms warrant earlier assessment; they should not wait for the annual reminder. A universal annual screen for every low risk adult is not established here. [ADA3]

Record total serum B12 in the laboratory's units. Indian reports commonly use pg/mL, numerically identical to ng/L. NICE NG239, 1.3.9/Table 1, uses <180 ng/L as confirmed deficiency, 180 to 350 as indeterminate and >350 as deficiency unlikely, while allowing validated local laboratory thresholds. Exactly 350 remains in the indeterminate group. NIH ODS notes that laboratory cutoffs vary; do not mix different frameworks into one silently changing scale. [NG239], [ODSB12]

Low or indeterminate results trigger clinician assessment, potentially including methylmalonic acid in the appropriate clinical context, not an app supplement prescription. NICE follow-up after starting replacement is generally at 3 months or earlier according to severity; this is a clinical review, not an automatic repeat blood test. NICE 1.6.10 says not to repeat the initial diagnostic test during intramuscular replacement. [NG239]

ICMR-NIN's 2020 RDA, the nutrient requirements basis accompanying the 2024 dietary guidance, is **2.2 µg/day** for adult B12. This is dietary adequacy, not treatment of deficiency. Reliable sources include dairy, eggs and other animal foods, or appropriately fortified foods. A vegetarian Indian diet is the hard case: milk/curd can contribute, but a generic plant food variety score cannot guarantee adequate B12. Do not claim that sprouts, spinach, fermented foods or spirulina reliably replace a validated B12 source. [NIN20], [ODSB12]

### Vitamin D

Measure serum **25-hydroxyvitamin D**, written 25(OH)D, when indicated, not a routine 1,25-dihydroxyvitamin D test. Indian reports commonly use ng/mL; **1 ng/mL equals 2.5 nmol/L**. Risk includes limited effective sun exposure, darker skin, malabsorption, older age and some medical conditions. [ODSD]

| NIH ODS/NASEM framework, Table 1 | Interpretation and app response |
|---|---|
| <12 ng/mL, or <30 nmol/L | Risk of deficiency; clinician review for evaluation and treatment |
| 12 to <20 ng/mL, or 30 to <50 nmol/L | Generally inadequate; assess in clinical context |
| ≥20 ng/mL, or ≥50 nmol/L | Adequate for most people, not a universal disease prevention target |
| >50 ng/mL, or >125 nmol/L | Potential adverse effects; review supplements and the result with a clinician |

All values in this table come from [ODSD]. The potential adverse effects category overrides the generic adequacy category; “≥20” must not produce an unqualified reassuring message at a high result. Laboratories may use another named framework. The Endocrine Society 2024 prevention guideline does not establish an outcome based universal 25(OH)D target, and recommends against routine testing in generally healthy groups without an indication. Neither diabetes alone nor Indian nationality establishes an automatic annual test. [ENDO24]

Vitamin D deficiency has been widely reported in Indian studies. The reviewed India prevalence synthesis is from 2014 and uses heterogeneous regional studies and definitions; it cannot supply a current national prevalence or diagnose an individual. [INDIAD]

ICMR-NIN 2020 specifies **600 IU/day**, equivalent to **15 µg/day**, for adult dietary vitamin D requirements. Fish, egg yolk and fortified foods can contribute; vegetarian food availability and actual fortification labels matter. That RDA is not a replacement course. [NIN20], [ODSD]

Sunlight contribution varies with season, latitude, skin pigmentation, clothing, age and exposure; window glass does not supply effective UVB. There is no reliable universal number of sun minutes that guarantees sufficiency. Do not transpose a child or pregnancy sun exposure example in NIN into a prescription for this adult, or recommend tanning/unprotected midday exposure as treatment. [NIN24], [ODSD]

**Supplement choice, treatment dose, route, duration and retesting are clinician decisions**, especially with kidney disease, calcium disorders or interacting medicines. Routine vitamin D tests every 3, 6 or 12 months, a universal “optimal” level and fixed sunlight minutes remain **Unsourced — do not ship**. Record an existing clinician plan rather than generating one.

## Weight, waist and body composition

Weigh on a firm level floor, using the same scale at a consistent time, preferably morning, with similar minimal clothing and no shoes. NHS England advises regular **weekly to monthly** weighing. A weekly default is within that guidance; daily weighing may be an optional preference rather than a requirement. [WEIGHT]

Record weight in kilograms and measured height in metres. BMI is weight divided by height squared; use the unrounded value for a selected framework's comparison and round only the displayed result. NIN Guideline 9. [NIN24]

The Madigan et al. 2015 systematic review did not establish a significant advantage of daily over weekly instructions. Benefits often occur inside a wider weight management programme, with limited evidence for weighing alone. Day to day fluctuation is not necessarily fat change. Avoid punitive responses, and reduce logging if it increases distress. Fluid retention, unintended weight loss or a prescribed heart/kidney monitoring plan needs its own clinical interpretation. [WEIGH15], [BACK], [CKD]

For waist, use the WHO protocol: a horizontal tape midway between the last palpable rib and the top of the iliac crest, on bare skin where possible, feet together, weight evenly distributed, abdomen relaxed, at the end of a normal expiration. Keep the tape snug without compressing the skin. Do not substitute the navel without identifying a different protocol. [WAIST], [STEPSMAN]

| Named framework | BMI cutoffs, kg/m² | Waist interpretation | App implication |
|---|---|---|---|
| WHO international adult defaults | Overweight ≥25; obesity ≥30 | Waist assessment requires the population and method | These BMI defaults alone can understate Indian metabolic risk. [WHOBMI] |
| RSSDI-ESI 2020 Indian diabetes recommendations, reflecting Indian clinical consensus | Overweight 23 to 24.9; obesity ≥25 | Increased abdominal risk at waist ≥90 cm in men, ≥80 cm in women | Appropriate named Indian clinical risk flags, not an automated diagnosis from BMI alone. [RSSDI20] |
| ICMR-NIN Dietary Guidelines for Indians 2024, Guideline 9, pages 63 to 64 | Recommended Asian range 18.5 to 23; overweight **over 23 to 27.5**; obesity **above 27.5** | Text uses **>90 cm** in men and **>80 cm** in women | Do not attribute the RSSDI obesity ≥25 rule to NIN 2024 or silently change equality operators. [NIN24] |

These are real framework differences. Preserve the selected source and its boundary definitions in the target record; use the Indian clinical risk flag for the design persona while naming RSSDI. Do not display the WHO international category as the only answer.

The India Obesity Commission's 2025 abstract proposes staging that includes adiposity, abdominal distribution, function and comorbidity. This reinforces that BMI alone is incomplete. Only the abstract was verified here; a full automated implementation of its staging criteria remains **Unsourced — do not ship** without the complete criteria. [INDIA25]

RSSDI recommends anthropometric assessment at initial and subsequent clinical visits; NIN says monitor weight periodically. A fixed monthly waist interval is not a universal clinical requirement. If overweight/obesity and clinical circumstances support weight loss, ADA 2026, 5.12, supports an initial goal of at least **5% to 7%**; do not assign weight loss solely from an unknown baseline. [RSSDI20], [NIN24], [ADA5]

Consumer body fat estimates are optional trend data, not a diagnostic or exercise safety test. A universal body fat percentage target, automatic visceral fat score interpretation and routine body composition scan interval were not established here. **Unsourced — do not ship** those rules.

## Hydration, sleep and daily habits

**Fluids:** NIN 2024, Guideline 14, describes about **8 glasses, approximately 2 litres including beverages**, for a normal healthy adult. NHS gives **6 to 8 cups/glasses** as a general guide. Cup sizes and definitions differ; do not add these as separate quotas or claim everyone needs exactly 2 litres of plain water. Heat, activity, illness, diet and individual physiology change need. Pale yellow urine can be a rough cue, not a diagnosis. [NIN24], [WATER]

Kidney disease may require a fluid limit, and a clinician supplied restriction overrides generic water reminders. Diuretics can increase dehydration risk; the app must not advise automatically replacing all urine losses, taking extra salt/electrolytes or altering the medicine. Persistent standing dizziness, little urine or inability to retain fluids warrants clinical advice; confusion/difficulty waking is urgent. [CKD], [DEHYDRATION]

**Sleep:** NHS describes **7 to 9 hours** for adults. Track sleep/wake times, estimated sleep duration, disruption and daytime sleepiness if useful; encourage a regular routine rather than an invented universal bedtime. ADA 2026, 5.56 to 5.57, recommends assessing sleep health and supporting sleep promoting routines. Snoring/gasping, witnessed apnoeas and daytime sleepiness deserve clinical review; an iPhone sleep estimate cannot diagnose sleep apnoea. [SLEEP], [ADA5], [APNOEA]

Poor sleep and disrupted circadian schedules are associated with impaired glucose control, but there is no reliable formula for a person's glucose change per hour of sleep. A 2023 meta-analysis of CPAP trials in people with type 2 diabetes **and obstructive sleep apnoea** found an average HbA1c reduction of **0.24 percentage points**, with heterogeneity. That is evidence about treating diagnosed apnoea, not a promise from meeting a sleep target. [CPAP23]

**Alcohol and tobacco:** WHO states that no alcohol consumption level is safe for health. ADA 2026 advises people who do not drink not to start; for those who drink it describes ceilings of **2 drinks daily for men and 1 for women**, not a health quota or permission to accumulate drinks. Alcohol can produce delayed hypoglycaemia with insulin/secretagogues. Do not label drinking “safe” from a weekly count or run a session when intoxication impairs balance or judgement. [ALCOHOL], [ADA5]

Support cessation of smoking and tobacco, including Indian forms, without a “safe amount” target. Track habit changes if the user wishes and direct to cessation support. Sitting breaks follow the diabetes cadence above. Indian dietary guidance supports minimally processed varied foods, vegetables, pulses and whole fruit; **salt no more than 5 g/day** in NIN is a food habit target, not a rule to add sodium when dizzy. [NIN24], [ADA5]

## Posture and ergonomics for desk work

Provide setup education: feet supported by the floor or a footrest, back supported, shoulders relaxed, elbows close to the body, keyboard/mouse reachable without stretching and room to change posture. Adjust the chair and lumbar support to the person rather than claiming one exact angle cures sciatica. [OSHACHAIR]

OSHA advises a monitor directly in front, roughly **20 to 40 inches, or 50 to 100 cm**, away, with the top at or just below eye level. Readability and visual needs may require adjustment; increase text size before leaning forward. A prolonged laptop setup should allow the screen and input devices to be positioned appropriately. [OSHAMON]

OSHA's Work Process guidance suggests **5 minutes away from computer tasks each hour**, alongside brief pauses and task variation. HSE says breaks depend on the work and gives **5 to 10 minutes each hour** as better than a longer infrequent break. Integrate this with ADA's **at least every 30 minute** sitting interruption, for example making the hourly break the longer movement/task change. These are compatible purposes, not competing precision timers. [OSHAWORK], [HSE], [ADA5]

Supported guidance is to reduce prolonged static/repetitive strain, improve fit and vary posture/activity. It does not establish a single perfect posture, a guarantee that a standing desk prevents back pain or a claim that sitting for a particular number of minutes damages a disc. Fixed chair angles, a compulsory stretching sequence and posture “scores” predicting sciatica recovery remain **Unsourced — do not ship**.

## Sources and verification limits

ADA refers to the **2026 Standards of Care**, the latest annual edition verified for this research. Section and table numbers above refer to that edition. NICE NG28 and NG136 pages reviewed here include their 2026 updates; NG59 includes its July 2026 update. Older exercise statements and research are identified by year rather than portrayed as new guidance.

Primary text was reviewed for the central guidelines, WHO and NIN PDFs and the cited accessible studies. NIH ODS, OSHA, NHS England and AHA material was also readable through a public text rendering of the primary page where the original endpoint blocked retrieval. The complete 2024 ESC publisher text and complete applicable STarT Back/Oswestry electronic licence terms were not established. No unverified ESC numerical exercise threshold or instrument licence is asserted here. The 2025 Indian obesity source was verified at abstract level only.

The following links are the source register. Facts are paraphrased; public access to a guideline does not establish permission to redistribute its tables, images or questionnaire wording.

[ADA2]: https://pmc.ncbi.nlm.nih.gov/articles/PMC12690183/ "ADA 2026, 2. Diagnosis and Classification of Diabetes, Table 2.1"
[ADA3]: https://pmc.ncbi.nlm.nih.gov/articles/PMC12690170/ "ADA 2026, 3. Prevention or Delay of Diabetes and Associated Comorbidities, recommendation 3.10 and metformin discussion"
[ADA5]: https://pmc.ncbi.nlm.nih.gov/articles/PMC12690188/ "ADA 2026, 5. Facilitating Positive Health Behaviors and Well-being to Improve Health Outcomes"
[ADA6]: https://pmc.ncbi.nlm.nih.gov/articles/PMC12690178/ "ADA 2026, 6. Glycemic Goals, Hypoglycemia, and Hyperglycemic Crises"
[ADA7]: https://pmc.ncbi.nlm.nih.gov/articles/PMC12690173/ "ADA 2026, 7. Diabetes Technology"
[ADA10]: https://pmc.ncbi.nlm.nih.gov/articles/PMC12690187/ "ADA 2026, 10. Cardiovascular Disease and Risk Management, Blood Pressure Management"
[ADA13]: https://pmc.ncbi.nlm.nih.gov/articles/PMC12690186/ "ADA 2026, 13. Older Adults, recommendations 13.7a to 13.7c"
[ADA16]: https://pmc.ncbi.nlm.nih.gov/articles/PMC12690180/ "ADA 2026, 16. Diabetes Care in the Hospital, Tables 16.1 and 16.2"
[NG28]: https://www.nice.org.uk/guidance/ng28/chapter/Blood-glucose-management "NICE NG28, Type 2 diabetes in adults, Blood glucose management, updated February 2026"
[EX16]: https://pmc.ncbi.nlm.nih.gov/articles/PMC6908414/ "ADA 2016 position statement, Physical Activity/Exercise and Diabetes, Tables 1 and 5 and exercise-associated hypoglycaemia"
[ACSM22]: https://pmc.ncbi.nlm.nih.gov/articles/PMC8802999/ "ACSM 2022 consensus, Exercise/Physical Activity in Individuals with Type 2 Diabetes, Tables 4 and 5"
[METER]: https://medlineplus.gov/ency/patientinstructions/000324.htm "NIH MedlinePlus, Home blood sugar testing, measurement instructions"
[DKA]: https://www.nhs.uk/conditions/diabetic-ketoacidosis/ "NHS, Diabetic ketoacidosis, ketone ranges and escalation, reviewed 2023"
[HYPO]: https://www.nhs.uk/conditions/low-blood-sugar-hypoglycaemia/ "NHS, Low blood sugar, severe episode and oral treatment precautions"
[BP19]: https://pmc.ncbi.nlm.nih.gov/articles/PMC11409525/ "AHA 2019 scientific statement, Measurement of Blood Pressure in Humans, Tables 5 and 9 and office/home correspondence"
[NG136]: https://www.nice.org.uk/guidance/ng136/chapter/recommendations "NICE NG136, Hypertension in adults, updated February 2026"
[ESH21]: https://pmc.ncbi.nlm.nih.gov/articles/PMC9904446/ "ESH 2021 position paper, Home blood pressure monitoring, section 8.1 and Box 15"
[AHACRISIS]: https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings/hypertensive-crisis-when-you-should-call-911-for-high-blood-pressure "AHA, When To Call 911 About High Blood Pressure, reviewed August 2025"
[EIM24]: https://acsm.org/wp-content/uploads/EIM_Rx-for-Health_Hypertension.pdf "ACSM Exercise is Medicine, Being Active When You Have Hypertension, copyright 2024"
[LOWBP]: https://www.nhs.uk/conditions/low-blood-pressure-hypotension/ "NHS, Low blood pressure, less than 90/60 and symptoms"
[WHO20]: https://pmc.ncbi.nlm.nih.gov/articles/PMC7719906/ "WHO 2020 physical activity and sedentary behaviour guideline summary, adult/chronic condition and older adult recommendations"
[STEPS22]: https://pmc.ncbi.nlm.nih.gov/articles/PMC9289978/ "Paluch et al. 2022, Daily steps and all-cause mortality, observational meta-analysis of international cohorts"
[WALK]: https://www.nhs.uk/live-well/exercise/walking-for-health/ "NHS, Walking for health, moderate intensity and gradual progression"
[MEAL16]: https://link.springer.com/article/10.1007/s00125-016-4085-2 "Reynolds et al. 2016, Advice to walk after meals is more effective for lowering postprandial glycaemia, Methods and Results"
[MEAL13]: https://pmc.ncbi.nlm.nih.gov/articles/PMC3781561/ "DiPietro et al. 2013, Three 15-min bouts of moderate postmeal walking improve glycemic control in older people"
[BREAK16]: https://doi.org/10.2337/dc15-2336 "Dempsey et al. 2016, Benefits for Type 2 Diabetes of Interrupting Prolonged Sitting With Brief Bouts of Light Walking or Simple Resistance Activities, abstract verified"
[NIHBACK]: https://pmc.ncbi.nlm.nih.gov/articles/PMC4560531/ "NIH Task Force on Research Standards for Chronic Low Back Pain, original report 2014, Table 4 and outcome measures"
[NG59]: https://www.nice.org.uk/guidance/ng59/chapter/recommendations "NICE NG59, Low back pain and sciatica, updated July 2026, sections 1.1 and 1.2"
[NG127]: https://www.nice.org.uk/guidance/ng127/chapter/recommendations-for-adults-aged-over-16 "NICE NG127, Suspected neurological conditions, updated 2023, recommendations 1.7.3 and 1.7.4"
[SCIATICA]: https://www.nhs.uk/conditions/sciatica/ "NHS, Sciatica, reviewed December 2024, natural history and emergency symptoms"
[BACK]: https://www.nhs.uk/conditions/back-pain/ "NHS, Back pain, urgent and emergency symptoms"
[FEVER]: https://www.nhs.uk/symptoms/fever-in-adults/ "NHS, Fever in adults, usual 38 degree Celsius threshold and symptom caveat"
[START]: https://keele.health/startback-questionnaire/ "Keele, STarT Back questionnaire, downloadable copyrighted form; app redistribution licence not established"
[ODI]: https://eprovide.mapi-trust.org/instruments/oswestry-disability-index "Mapi Research Trust, Oswestry Disability Index catalogue and permission route; complete app licence not established"
[RMDQ]: https://www.rmdq.org/ "Roland-Morris questionnaire owner, explicit public domain and no permission required statement"
[NIN24]: https://www.nin.res.in/dietaryguidelines/pdfjs/locale/DGI_2024.pdf "ICMR-NIN, Dietary Guidelines for Indians 2024, Guidelines 9, 11 and 14"
[NIN20]: https://www.nin.res.in/rdabook/brief_note.pdf "ICMR-NIN, Nutrient Requirements for Indians 2020, brief report Tables 3 and 4, adult RDAs"
[NG239]: https://www.nice.org.uk/guidance/ng239/chapter/recommendations "NICE NG239, Vitamin B12 deficiency, 2024, Table 1 and sections 1.2, 1.3 and 1.6"
[ODSB12]: https://ods.od.nih.gov/factsheets/VitaminB12-HealthProfessional/ "NIH ODS, Vitamin B12 Health Professional Fact Sheet, status, risk and food sources"
[ODSD]: https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/ "NIH ODS, Vitamin D Health Professional Fact Sheet, Table 1, units, food and sun exposure"
[ENDO24]: https://www.endocrine.org/clinical-practice-guidelines/vitamin-d-for-prevention-of-disease "Endocrine Society 2024, Vitamin D for the Prevention of Disease, screening and target limitations"
[INDIAD]: https://pmc.ncbi.nlm.nih.gov/articles/PMC3942730/ "Ritu and Gupta 2014, Vitamin D Deficiency in India, dated prevalence review"
[WEIGHT]: https://www.england.nhs.uk/digital-weight-management/how-to-record-your-weight/ "NHS England, How to record your weight, weekly to monthly cadence and consistent technique"
[WEIGH15]: https://pmc.ncbi.nlm.nih.gov/articles/PMC4546162/ "Madigan et al. 2015, Is self-weighing an effective tool for weight loss, systematic review and meta-analysis"
[WAIST]: https://www.who.int/publications/i/item/9789241501491 "WHO 2011 report of the 2008 expert consultation, Waist Circumference and Waist-Hip Ratio, section 2"
[STEPSMAN]: https://cdn.who.int/media/docs/default-source/ncds/ncd-surveillance/steps/part3-section5.pdf?sfvrsn=a46653c7_2 "WHO STEPS manual, Part 3 section 5, physical measurements, waist protocol, updated 2017"
[WHOBMI]: https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight "WHO, Obesity and overweight, adult international BMI thresholds"
[RSSDI20]: https://pmc.ncbi.nlm.nih.gov/articles/PMC7328526/ "RSSDI-ESI 2020 clinical recommendations, Obesity and type 2 diabetes, Indian BMI/waist and assessment"
[INDIA25]: https://doi.org/10.1016/j.dsx.2024.102989 "Misra et al. 2025, Revised definition of obesity in Asian Indians living in India, abstract verified"
[WATER]: https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/water-drinks-nutrition/ "NHS, Water, drinks and hydration, general guide and individual variation"
[CKD]: https://www.niddk.nih.gov/health-information/kidney-disease/chronic-kidney-disease-ckd/eating-nutrition "NIH NIDDK, Healthy Eating for Adults with Chronic Kidney Disease, Liquids"
[DEHYDRATION]: https://www.nhs.uk/conditions/dehydration/ "NHS, Dehydration, diabetes/diuretic risks and urgent symptoms"
[SLEEP]: https://www.nhs.uk/conditions/insomnia/ "NHS, Insomnia, usual adult sleep duration and routine"
[APNOEA]: https://www.nhs.uk/conditions/sleep-apnoea/ "NHS, Sleep apnoea, symptoms and assessment"
[CPAP23]: https://pmc.ncbi.nlm.nih.gov/articles/PMC10481331/ "Herth et al. 2023, CPAP effects on glucose metabolism in obstructive sleep apnoea and type 2 diabetes, systematic review of randomised trials"
[ALCOHOL]: https://www.who.int/europe/news/item/04-01-2023-no-level-of-alcohol-consumption-is-safe-for-our-health "WHO Europe 2023, No level of alcohol consumption is safe for our health"
[OSHACHAIR]: https://www.osha.gov/etools/computer-workstations/components/chairs "OSHA Computer Workstations eTool, Chairs"
[OSHAMON]: https://www.osha.gov/etools/computer-workstations/components/monitors "OSHA Computer Workstations eTool, Monitors"
[OSHAWORK]: https://www.osha.gov/etools/computer-workstations/work-process "OSHA Computer Workstations eTool, Work Process"
[HSE]: https://www.hse.gov.uk/msd/dse/work-routine.htm "UK HSE, Working safely with display screen equipment, Work routine and breaks"

## Cadence model

This is a proposed default schedule for the design persona. Treatment dependent entries remain conditional until a local care profile or recorded clinician plan supplies the missing information. Optional habit observations are product workflows, not invented medical tests. A clinician's individual plan overrides routine targets and intervals; emergency symptoms still take precedence. The model does not require every metric every day.

| Tracking item | Proposed default | Rule that changes it | Source and status |
|---|---|---|---|
| Safety check | Before each guided session and when readings/symptoms change; show the contract result before playback | Any emergency/today/hold condition blocks the relevant session; unresolved treatment class or required check prevents personalised clearance | Event based app safety policy using the contract above |
| Glucose, no insulin/secretagogue | No recurring fingerstick demand; support a purposeful clinician requested meal/activity or illness check | A hypo causing medicine, symptoms, steroids, illness or a clinician monitoring programme activates the corresponding branch | ADA 7.13; NICE NG28, 1.6 [ADA7], [NG28] |
| Glucose, sulfonylurea/secretagogue | Recorded clinician schedule plus exercise/symptom risk checks | Lows, missed meals, unusual activity or illness require the plan's additional checks and clinical review when indicated | No universal daily count established; do not invent one [ADA6], [ADA7] |
| Glucose, basal insulin | Fasting checks at the clinician specified interval, with exercise/symptom checks | Starting/changing treatment, unstable results or recurrent lows changes the clinician schedule; app supplies no titration | ADA explicitly does not establish a universal basal monitoring frequency [ADA7] |
| Glucose, multiple daily injections | Before meals/snacks, bedtime, before/during/after activity and symptoms; use CGM where prescribed with BGM backup | Hypoglycaemia adds recovery checks; prolonged/unusual activity can add bedtime/overnight/next day checks under the plan | ADA 7.10 to 7.11 and monitoring discussion [ADA7], [EX16] |
| HbA1c | Approximately every 6 months when stable and at the individual goal | Approximately every 3 months when not at goal, treatment changes, major glucose events or health changes; clinician can choose differently | ADA 6.2; NICE NG28, 1.5.1 [ADA6], [NG28] |
| CGM summary, if used | Review an available report alongside clinical assessments; only label pattern metrics interpretable with 14 days and ≥70% active data | Safety events need immediate action, not the next report; insufficient wear shows insufficient evidence | ADA Table 6.2; no invented fixed weekly medical review requirement [ADA6] |
| BP, concern not yet diagnosed | One diagnostic block: 2 readings morning and evening, ≥1 minute apart, ≥4 days ideally 7; exclude day 1 only from its average | Raised average, changed symptoms or clinician request prompts assessment/new block; severe individual readings trigger immediately | NICE 1.2.7 to 1.2.8 [NG136] |
| BP, stable treated hypertension | One check day per week with paired morning and evening readings is a proposed low burden default within the ESH range, plus the pre-visit block | Treatment/control changes activate the clinician schedule. ESH recommends a 7 day block before visits and at least a week within 3 months when controlled | ESH Box 15; retain NICE's named diagnostic averaging convention [ESH21], [NG136] |
| BP at clinical care | Routine diabetes visits or at least every 6 months | More often for hypertension assessment or clinical need; hypertension also has an annual review | ADA 10.1; NICE hypertension review [ADA10], [NG136] |
| Walking and activity | Offer tolerable activity opportunities and an optional postmeal walk; accumulate towards the sourced weekly goals | Glucose/BP/neurological safety, pain-related function or clinician restriction changes today's mode/load; no calendar driven escalation | WHO 2020, ADA 5.36 to 5.37; postmeal duration is research, not a mandate [WHO20], [ADA5], [MEAL16] |
| Steps | Optional usual-activity observations; choose a tolerable baseline-based goal | Progress only after stable function/symptoms and safe glucose response; no automatic count or percentage increment | WHO gradual progression; mortality study supplies associations, not a prescription [WHO20], [STEPS22] |
| Sitting and desk breaks | Movement opportunity at least every 30 minutes; include a longer task change away from the computer each hour | Work constraints and disability require adaptation, not a claim that a missed alert caused damage | ADA 5.34; OSHA suggests 5 minutes/hour [ADA5], [OSHAWORK] |
| Back/leg symptoms | Brief pre/post session and change-triggered observations | New distal spread or reduced function holds progression; new weakness or bladder/saddle signs escalates | Event based app policy grounded in NICE; mandatory daily scores remain unestablished [NG59], [NG127] |
| Functional questionnaire | Offer the public domain Roland-Morris at clinician selected reviews | New treatment episode or review plan determines repeats; do not use a questionnaire to clear an emergency | Reuse verified; universal repeat interval not established [RMDQ], [NIHBACK] |
| B12 | Periodic assessment in long term metformin; annual if >4 years or other specified risk | Anaemia, neuropathy, gait/balance symptoms or other suspicion brings assessment forward; replacement follow-up follows the clinician plan | ADA 3.10 and narrative; NICE NG239 [ADA3], [NG239] |
| Vitamin D | No recurring test by default | Clinician indication, prior deficiency or a treatment plan supplies test and retest dates | Endocrine Society 2024; routine annual or fixed retesting remains **Unsourced — do not ship** [ENDO24] |
| Weight | Weekly, consistent technique, if useful and acceptable | Clinician fluid monitoring plan may differ; distress can reduce frequency; unintended loss warrants review | Within NHS weekly to monthly guidance [WEIGHT] |
| Waist/BMI | Baseline and clinical/weight management reviews, with framework recorded | Change of measurement method or clinician plan requires a clearly labelled comparison; no invented monthly mandate | RSSDI clinical visits; NIN periodic weight monitoring [RSSDI20], [NIN24] |
| Fluids, sleep and habits | Optional observations on the days the user finds them useful; keep general guidance available | Kidney/fluid restriction overrides water advice; sleep apnoea symptoms or dehydration prompt care; medicines alter alcohol/hypo safety | No compulsory daily medical logging interval asserted [NIN24], [CKD], [ADA5], [SLEEP] |

## Questions for Claude

* Will you accidentally assume metformin only, and then give an insulin or sulfonylurea user the low risk cadence?
* Will a target, average or streak clear chest pain, possible stroke or new bladder/saddle symptoms? The answer must always be no.
* Will the BP comparisons use **either** component, preserve the distinction between resting and exercise readings, and evaluate dangerous readings before averaging?
* Will you label the BP/BMI framework beside the target, rather than quietly combining NICE, ADA, WHO, RSSDI and NIN into a fictitious consensus?
* Will every equality boundary in the safety contract be tested, including glucose 54/70/90, ketones 1.5/3.0 and the strict EIM versus inclusive severe BP operators?
* Will a positive ketone result or DKA symptoms be dismissed because glucose is normal, particularly with SGLT2 treatment?
* Will you correctly time postmeal readings from meal **start**, and avoid turning a walking trial's timing or effect size into an individual promise?
* Will GMI become a disguised HbA1c target, or incomplete CGM data be counted as normal time?
* Will you embed STarT Back or Oswestry because a PDF is available, despite unresolved app permission? Roland-Morris is the verified reuse option.
* Will a single pain number justify progression despite new distal symptoms, weakness or worse function?
* Will you invent a daily step minimum, a percentage progression or a fixed vitamin D test/supplement schedule to fill an empty field?
* Will B12 replacement follow-up be confused with annual screening, and vitamin D dietary RDA with deficiency treatment?
* Will generic water reminders override kidney restrictions, or low sleep/weight results trigger inappropriate emergency or exercise decisions?
* Will this front end promise dependable overnight glucose alarms, direct medical device access or clinical monitoring that it cannot deliver?
