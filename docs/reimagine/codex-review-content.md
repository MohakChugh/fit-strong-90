# Guide content audit

Reviewed 8 October 2026. Release verdict: **ship after fixes**. The current Guide should not reach the owner before the safety and personalisation findings below are resolved.

The register and implementation contain the same **164 unique claims**, supported by **32 source records**, used in **29 cards, 26 meal templates and four habits**. My claim verdicts are **156 SUPPORTED, seven OVERSTATED and one WRONG SOURCE**. No claim remains CANNOT CHECK after the alternative retrievals described below. These counts judge source support, not whether a statement is safe in every place the app displays it. Several supported statements have unsafe context or incomplete warnings.

Board decisions checked: D9, D22, D26, D27, D31 and D32. This is a content and rendering audit, not a new review of the movement engine. No application code, tests, existing documentation or configuration was changed.

## Evidence and limits

I read `guide-report.md`, including all 164 register entries and LEFT OUT, the content schema and data, personalisation, search, meal filtering and week generation, and the Guide screen rendering paths. Claim identifiers below refer to the actual typed records, not just the author's report. References such as `src/content/personalise.ts:102` use the line numbers in the reviewed files.

Public sources were fetched with HTTP GET. PDFs were decoded in memory. Direct PMC requests returned browser verification pages despite HTTP 200, direct ODS and OSHA requests returned 403, and direct PubMed pages returned a verification response with HTTP 203. Those responses were not counted as readable evidence. Public text renderings supplied the ADA, ODS and OSHA material. Official NCBI XML supplied the five study abstracts and the ACSM and WHO articles, including the ACSM tables. Initial NCBI rate limits were followed by a successful combined request. ADA's XML endpoint supplied front matter only, with an explicit publisher restriction on downloading full XML, so it did not verify the recommendations.

For the mirrored documents, I checked the document title, source URL and relevant text. A mirror is an access route, not evidence that a publisher has licensed material for the product. I have not obtained copyright permissions or cleared the board's legal interpretation of the publishers' terms. I reproduce no ADA quotation or guideline table here.

I executed all **108 existing content test cases**, using the installed TypeScript transpiler and Chai/Jest assertions in memory:

| Test file | Passed |
| --- | ---: |
| `src/content/integrity.test.ts` | 19 |
| `src/content/personalise.test.ts` | 25 |
| `src/content/search.test.ts` | 31 |
| `src/content/week.test.ts` | 23 |
| `src/content/library.test.ts` | 3 |
| `src/screens/guide/format.test.ts` | 7 |

This was execution of the existing test bodies, not a normal Vitest runner invocation. Independent probes exercised actual `contextFromProfile`, `waterBlock`, `actionFor`, `habitAdvice`, search and meal functions. Source and Guide file contents were checked again for concurrent changes before writing; the reviewed texts had not changed.

**Skipped checks:** no command requiring approval was run. Normal Vitest/Vite commands, browser launches, screenshots and device checks were omitted because they can write caches, builds, browser profiles or artifacts outside this task's one-file scope. Consequently I do not claim a fresh browser or iPhone rendering test. ARCC was not exposed through tool discovery; only synthetic profiles and public documents were used, and no personal health records were transmitted.

## Source access register

The identifiers in this table are the source identifiers used in the claim register. “Direct” means readable primary content, not merely a successful status code. For the five studies, the claim locators are abstracts and those abstracts were checked; their full articles were not independently reviewed.

| Source id | Document and edition | Successful check and access limitation |
| --- | --- | --- |
| `nin-dgi-2024` | [ICMR-NIN Dietary Guidelines for Indians, 2024](https://www.nin.res.in/dietaryguidelines/pdfjs/locale/DGI_2024.pdf) | Direct official PDF. Printed page numbers, including Annexures I, II and IV, were used. |
| `ada-soc-2026-s5` | [ADA Standards of Care, 2026, section 5](https://doi.org/10.2337/dc26-S005) | PMC full text through its public text rendering. Direct PMC challenged; official XML contained metadata only. Recommendation numbers and cited narrative passages checked. |
| `ada-soc-2026-s3` | [ADA Standards of Care, 2026, section 3](https://doi.org/10.2337/dc26-S003) | PMC text rendering. Direct PMC challenged. Recommendation 3.10 and the paragraph containing the annual B12 advice checked. |
| `ada-soc-2026-s10` | [ADA Standards of Care, 2026, section 10](https://doi.org/10.2337/dc26-S010) | PMC text rendering. Direct PMC challenged; official XML contained metadata only. Recommendations 10.3, 10.5 and 10.11 checked. |
| `ada-diabetes-plate` | [ADA Diabetes Food Hub, What is the Diabetes Plate?, 14 May 2026](https://diabetesfoodhub.org/blog/what-diabetes-plate) | Direct article, including the four steps and combination foods. |
| `who-sodium-2026` | [WHO Sodium reduction, 11 May 2026](https://www.who.int/news-room/fact-sheets/detail/sodium-reduction) | Direct fact sheet. Total sodium/salt limit, iodine and food sources checked. |
| `who-lsss-2025` | [WHO lower-sodium salt substitutes guideline, 2025](https://www.who.int/publications/i/item/9789240105591) | Direct [official IRIS PDF](https://iris.who.int/server/api/core/bitstreams/31fad89a-d7c2-450c-9b74-cd2a8752e60f/content). Executive summary and printed pages 23 to 26 checked. |
| `who-pa-2020` | [Bull et al., WHO physical activity guidelines, 2020](https://doi.org/10.1136/bjsports-2020-102955) | Official PMC XML and text rendering. Direct PMC challenged. Table 4 and surrounding discussion checked. |
| `who-alcohol-2023` | [WHO Europe alcohol statement, 4 January 2023](https://www.who.int/europe/news/item/04-01-2023-no-level-of-alcohol-consumption-is-safe-for-our-health) | Direct statement. |
| `ods-b12` | [NIH ODS B12 consumer fact sheet](https://ods.od.nih.gov/factsheets/VitaminB12-Consumer/) | Public text rendering of the fact sheet; direct site returned 403. Food, deficiency and medicine sections checked. |
| `ods-vitamin-d` | [NIH ODS vitamin D consumer fact sheet](https://ods.od.nih.gov/factsheets/VitaminD-Consumer/) | Public text rendering; direct site returned 403. Food, sun, risks, diabetes, toxicity and interactions checked. |
| `ods-vitamin-d-hp` | [NIH ODS vitamin D professional fact sheet](https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/) | Public text rendering; direct site returned 403. Sun exposure, Vitamin D Deficiency, and Groups at Risk checked. |
| `nice-ng239` | [NICE NG239, B12 deficiency, 2024](https://www.nice.org.uk/guidance/ng239/chapter/recommendations) | Direct recommendations, especially 1.2.5 and Boxes 1 and 2. |
| `endocrine-vitamin-d-2024` | [Endocrine Society vitamin D guideline, 2024](https://www.endocrine.org/clinical-practice-guidelines/vitamin-d-for-prevention-of-disease) | Direct recommendations 3, 5 and 7; recommendation 10 also checked to reconcile the prediabetes wording. |
| `nice-ng59` | [NICE NG59, back pain and sciatica](https://www.nice.org.uk/guidance/ng59/chapter/Recommendations) | Direct recommendations 1.1.1 and 1.2.1 to 1.2.3. |
| `nice-ng127` | [NICE NG127, adult neurological symptoms](https://www.nice.org.uk/guidance/ng127/chapter/recommendations-for-adults-aged-over-16) | Direct recommendations 1.7.1 to 1.7.5 and 1.10.12, including the unilateral weakness advice omitted by the Guide. |
| `acsm-2022` | [ACSM exercise consensus for type 2 diabetes, 2022](https://doi.org/10.1249/MSS.0000000000002800) | Official PMC XML supplied the full article and Tables 4 and 5. Main text rendering omitted some tables; the separate Table 5 rendering challenged. Neither omission was treated as verification. |
| `osha-chairs` | [OSHA Computer Workstations, Chairs](https://www.osha.gov/etools/computer-workstations/components/chairs) | Public text rendering; direct page returned 403. Backrest, seat and armrests checked. |
| `osha-monitors` | [OSHA Computer Workstations, Monitors](https://www.osha.gov/etools/computer-workstations/components/monitors) | Public text rendering; direct page returned 403. Viewing distance, angle and viewing time checked. |
| `osha-positions` | [OSHA Good Working Positions](https://www.osha.gov/etools/computer-workstations/positions) | Public text rendering; direct page returned 403. Position changes and four reference postures checked. |
| `osha-work-process` | [OSHA Work Process and Recognition](https://www.osha.gov/etools/computer-workstations/work-process) | Public text rendering; direct page returned 403. Break example and symptom reporting checked. |
| `hse-dse-posture` | [HSE DSE posture](https://www.hse.gov.uk/msd/dse/good-posture.htm) | Direct workstation and laptop advice. |
| `hse-dse-breaks` | [HSE DSE work routine](https://www.hse.gov.uk/msd/dse/work-routine.htm) | Direct advice. Its numerical break example is an example, not a statutory or clinical threshold. |
| `niddk-ckd-eating` | [NIDDK Healthy Eating for Adults with CKD, reviewed January 2025](https://www.niddk.nih.gov/health-information/kidney-disease/chronic-kidney-disease-ckd/healthy-eating-adults-chronic-kidney-disease) | Direct potassium, protein, sodium and liquids advice. |
| `nhlbi-heart-failure` | [NHLBI Living With Heart Failure](https://www.nhlbi.nih.gov/health/heart-failure/living-with) | Direct lifestyle and “Know when to seek help” sections. |
| `nhlbi-sleep-apnea` | [NHLBI Sleep Apnea Symptoms](https://www.nhlbi.nih.gov/health/sleep-apnea/symptoms) | Direct symptoms and assessment advice. |
| `cdc-sleep` | [CDC About Sleep, 15 May 2024](https://www.cdc.gov/sleep/about/index.html) | Direct page was readable in this audit. Adult age bands, habits and management checked. |
| `reynolds-2016` | [Reynolds et al., Diabetologia, 2016](https://doi.org/10.1007/s00125-016-4085-2) | Official PubMed XML, PMID 27747394. Direct PubMed challenged. Abstract methods, outcomes and ratios checked. |
| `dempsey-2016` | [Dempsey et al., Diabetes Care, 2016](https://doi.org/10.2337/dc15-2336) | Official PubMed XML, PMID 27208318. Direct PubMed challenged. |
| `walkback-2024` | [Pocovi et al., WalkBack, Lancet, 2024](https://doi.org/10.1016/S0140-6736(24)00755-4) | Official PubMed XML, PMID 38908392. Direct PubMed challenged. Eligibility, endpoint, medians and adverse events checked. |
| `ding-2025` | [Ding et al., Lancet Public Health, 2025](https://doi.org/10.1016/S2468-2667(25)00164-1) | Official PubMed XML, PMID 40713949. Direct PubMed challenged. Observational estimates and limitations checked. |
| `banach-2023` | [Banach et al., European Journal of Preventive Cardiology, 2023](https://doi.org/10.1093/eurjpc/zwad229) | Official PubMed XML, PMID 37555441. Direct PubMed challenged. The reference quartile and conclusion were both checked. |

Additional readable primary sources used for the safety corrections, not silently substituted as support for existing claim records:

| Source | What it establishes |
| --- | --- |
| [NIDDK Low Blood Glucose](https://www.niddk.nih.gov/health-information/diabetes/overview/preventing-problems/low-blood-glucose-hypoglycemia) | Insulin and secretagogue risk; skipped or delayed meals, fasting, alcohol and activity; checking around activity according to a care plan. |
| [CDC Safer Food Choices for People With Weakened Immune Systems](https://www.cdc.gov/food-safety/foods/weakened-immune-systems.html) | Diabetes and kidney disease are relevant risk conditions; raw or undercooked sprouts are riskier, cooked sprouts are the safer choice. |
| [NIAMS Back Pain](https://www.niams.nih.gov/health-topics/back-pain) | Back pain with fever, urinary problems or leg weakness needs medical assessment, without requiring the Guide's severe-pain qualifier. |
| [NHLBI Heart Failure Symptoms](https://www.nhlbi.nih.gov/health/heart-failure/symptoms) | Breathlessness, inability to lie flat, confusion and fluid accumulation belong in a clinical assessment context, not a generic hydration habit. |

## Safety and personalisation findings

### F01. A recorded fluid restriction does not reach Guide

**Severity: harmful.** Cards/claims: `card-water-amount`, `water-amount`, `water-more`; habit `water`. Code: `src/content/personalise.ts:32`, `:75`, `:102`; `src/screens/guide/useGuide.ts:31`; `src/reminders/water.ts:33`.

Trigger: use a profile with `health.fluidRestriction: true`, no kidney/heart condition, and no legacy `habits.fluidLimit`. The actual `contextFromProfile` returns no `fluidCaution`; `card-water-amount` remains visible and `habitAdvice('water', ctx).offered` is true. The reminders resolver correctly returns “Off, because your care team has asked you to limit fluids.” The same disagreement occurs for `health.fluidRestriction: 'unsure'` and for a legacy `fluidLimit: 'unsure'`.

There is also a reverse disagreement: `health.fluidRestriction: false` plus old `habits.fluidLimit: true` suppresses Guide's card while reminders correctly prefer the newer profile answer. The new field is explicitly documented at `src/types/profile.ts:66` as withholding generic advice when true or unsure.

**Exact fix:** use the same canonical answer resolution as reminders, `profile.health.fluidRestriction` first, legacy answer only when absent. Treat true and unsure as `fluidCaution`, with distinct truthful reasons. Keep the kidney/heart safeguards. Verify hiding in topic lists, search, related links and direct card URLs, as well as the habit offer. Do not change the valid general-population wording of `water-amount` into a personal prescription.

### F02. Movement cautions are lost when a claim is reused

**Severity: harmful.** Claims: `walk-meals-try`, `walk-carry-sugar`, `walk-foot-wound`; cards `card-supplements`, `card-steps`, `card-walking-back`; habit `sittingBreak`. Code: `src/content/claims/food.ts:132`; `src/content/cards.ts:77`, `:88`, `:89`, `:333`, `:357`; `src/content/habits.ts:20`; `src/screens/guide/parts.tsx:21`.

Trigger: an insulin or sulfonylurea user opens Home remedies and pills. “What you can do” includes the after-meal walk, but the card has only the supplement caution. The same walking claim on the main walking card has hypoglycaemia and foot cautions. Actual claim graphs confirm `walk-meals-try` has no attached cautions; `card-steps` also omits `walk-carry-sugar`, and Walking and your back offers walking without that caution.

A user with an active foot wound can still read the walk instruction on the supplements card, which has no foot warning. The `sittingBreak` habit also remains offered as “Get up from sitting” for that profile. Correctly hiding three `/walk` links does not make independent instructions or standing reminders safe.

**Exact fix:** make relevant precautions travel with movement directives, including reuse outside the main walking card. For insulin/secretagogue users, state that they should follow their care plan for checks before, during and after activity and carry rapid carbohydrate, without prescribing a universal check interval or changing medicines. For an active wound/Charcot restriction, replace standing/walking prompts with a permitted seated alternative or withhold them. Include the foot restriction whenever `walk-meals-try` is displayed. ACSM 2022 Tables 4 and 5 and the NIDDK hypoglycaemia page support these precautions.

The same reuse review should cover `d-get-outside` on `card-d-test`: its skin-protection caution appears on the Getting vitamin D card but does not accompany this reused action. Attach the existing sun-risk explanation rather than adding a sunlight timer.

### F03. The foot-wound warning reads as a preference

**Severity: harmful.** Claim: `walk-foot-wound`. Code: `src/content/claims/food.ts:143`; `src/content/personalise.ts:92`; `src/engine/health.ts:123`.

Trigger: a profile has `footStatus: 'current_wound_or_active_charcot'`. The Guide correctly hides walking links and the meal-walk habit, but its replacement advice says non-weight-bearing activity “may suit you better”, and predicates the sentence on both nerve damage and an ulcer. Someone with a new wound but no diagnosed neuropathy, or active Charcot without an open ulcer, can read the restriction as inapplicable or optional.

**Source reconciliation:** ACSM Table 5 really does use optional wording for non-weight-bearing alternatives in peripheral neuropathy generally. The claim therefore has literal source support. That is weaker than this app's specific active-wound/Charcot restriction, represented by `FOOT` and the contract's H-FOOT/EYE row. Do not claim that Table 5's general wording is itself the complete offloading protocol.

**Exact fix:** explicitly describe the app policy: “With an open foot wound or active Charcot foot, this app does not offer movement that puts weight through the affected foot until your care team clears it. Ask which activity and offloading are safe for you.” Preserve the general neuropathy advice for people without an active wound. Do not substitute swimming automatically, ACSM specifically cautions against aquatic exercise with unhealed plantar ulcers.

### F04. Back red flags are incomplete and appear below the movement invitation

**Severity: harmful.** Claims: `back-emergency`, `back-weakness`, `b12-numbness-check`; cards `card-keep-moving`, `card-walking-back`. Code: `src/content/claims/daily.ts:181`, `:185`; `src/content/cards.ts:319`; `src/screens/guide/CardScreen.tsx:45`, `:49`.

Trigger A: a person has familiar mild sciatica and new saddle numbness or urinary retention. The emergency sentence first requires severe pain spreading into a leg. The safety contract's E-CES rule explicitly does not allow a low pain score to clear these symptoms.

Trigger B: a person with sciatica develops new weakness or foot drop in one foot. The only dedicated weakness warning says “both legs, or both arms” worsening over days or weeks. That does not cover their unilateral deficit. NICE NG127 1.7.1 warns about sudden weakness even in a restricted distribution, and 1.7.4 addresses rapidly progressive weakness of a single limb. NG127 1.7.2 supports the bilateral sentence, but is not a complete weakness safety screen.

Trigger C: back pain comes with fever or feeling unwell. The author deliberately excluded this because of the NHS source restriction. NICE NG59 1.1.1 still requires consideration of infection and other serious diagnoses, and the readable NIAMS back-pain page includes fever among reasons for assessment. The board's source rule does not justify leaving the clinical concern unaddressed.

The screen offers “Start a gentle stretch” before these warnings and groups emergencies under “When to check with your doctor”. A movement gate is useful, but a reader may act on the prose away from the player.

**Exact fix:** place an emergency block before movement actions. State that new bladder/bowel control changes, saddle/genital sensory loss and relevant new sexual dysfunction require emergency assessment even if pain is mild. Add sudden unilateral weakness as a possible stroke emergency and new/progressive leg weakness as a reason to stop and obtain urgent assessment, aligned with the existing safety contract. Cover back pain with fever/systemic illness and new or rapidly changing symptoms using an allowed primary source. Clearly distinguish the app's conservative safety policy from the exact population wording of a cited referral recommendation. Do not introduce a numeric pain threshold.

NICE's relevant language includes “new-onset disturbance of bladder, bowel or sexual function”; the content should not narrow that to urinary difficulty and bowel incontinence alone. Keep immediate help distinct from a routine doctor appointment.

### F05. Worsening breathlessness is reduced to a generic contact suggestion

**Severity: harmful.** Claim: `fluid-swelling`; card `card-water-limit`. Code: `src/content/claims/daily.ts:113`; `src/content/cards.ts:269`; `src/screens/guide/CardScreen.tsx:49`.

Trigger: a person with heart failure develops severe new breathlessness and opens Fluid limits. The only urgency instruction says to tell the care team about breathlessness getting worse, under the same routine doctor heading used for non-urgent cautions.

NHLBI's “Know when to seek help” distinguishes office visits and emergency care. The current symptom list is supported, but it loses that distinction. The app's E-CARDIAC contract already makes severe new breathlessness an emergency independent of readings.

**Exact fix:** put an explicit emergency instruction ahead of the ordinary fluid-contact advice for severe new breathlessness, chest pain, collapse or suspected stroke symptoms, using the existing contract and allowed primary sources. For new or worsening swelling, weight gain or breathing symptoms, direct prompt contact according to the person's heart-failure action plan rather than implying waiting for a routine visit. Do not invent a universal weight-gain threshold or tell the user to change diuretics or drink extra water.

### F06. General no-snacking advice is presented without a medicine-plan exception

**Severity: harmful.** Claim: `fd-two-three-meals`; related claim `fd-fixed-insulin`. Code: `src/content/claims/food.ts:98`, `:119`; `src/content/meals.ts:22`; `src/screens/guide/MealIdeasScreen.tsx:63`; `src/screens/guide/MealDetailScreen.tsx:56`.

Trigger: an insulin or sulfonylurea user opens the Snacks section and follows the suggestion to have two or three meals without snacks, although their care plan includes a snack or different meal timing. The sourced fixed-insulin caution is on `card-plate`, but is absent from the Snacks note, meal detail pages and sample-week explanation.

NIN 2024 page 2 supports the general no-snacking sentence. It is not a treatment-specific rule. NIDDK warns that people taking glucose-lowering medicines can go low if they “skip or delay any meals”. Its fasting advice also distinguishes medication risk. ADA 2026 recommendation 5.28 supports consistency with fixed insulin, not the app changing a schedule.

**Exact fix:** label the NIN sentence as general-population advice and attach an exception wherever it appears: follow the meal/snack timing agreed with the care team when taking insulin or a sulfonylurea/meglitinide; do not remove prescribed snacks, skip/delay meals or fast based on this general advice. Carry the existing fixed-insulin caution into the meal entry points and add a properly sourced secretagogue/fasting caution. Never supply dose or medication-timing changes.

### F07. SGLT2 personalisation does not supply the main dietary safety boundary

**Severity: misleading.** Existing claim: `alc-sglt2`; affected cards `card-plate`, `card-grains`, `card-supplements`, `card-alcohol`. Code: `src/content/personalise.ts:69`; `src/content/claims/daily.ts:245`; `src/content/cards.ts:372`.

Trigger: someone taking an SGLT2 inhibitor browses diet changes or searches for fasting. The only SGLT2-specific health instruction is to avoid heavy drinking. No card explains the ketogenic-diet/ketoacidosis boundary or points the person to a fasting/illness care plan. Search can return unrelated partial matches instead of identifying that missing answer.

ADA 2026 recommendation 5.26 supplies the missing recommendation-level foundation: ketoacidosis risk education, signs and mitigation, ketone testing tools and discouraging a ketogenic eating pattern. Its narrative also addresses excessive alcohol, but a citation to 5.26 alone must not pretend it contains an alcohol-specific sentence.

**Exact fix:** add a sourced SGLT2 precaution alongside diet-change advice, discouraging ketogenic eating and explaining that ketoacidosis symptoms need action even when glucose is not very high. Refer fasting, illness, ketone testing and medicine decisions to the person's care plan. Do not invent a blanket ban on every religious fast, tell them to stop the drug, or prescribe a fluid amount that could override a restriction.

### F08. Sprout meals do not specify the safer preparation for this audience

**Severity: harmful.** Meals: `s-sprouts-chaat`, `b-poha`; claim `fd-fermented`. Code: `src/content/meals.ts:97`, `:266`.

Trigger: a person with diabetes or CKD follows “Moong sprouts chaat”, serving uncooked sprouts with onion, tomato, cucumber and lemon. No cooking instruction or food-safety caution accompanies the template. Vegetable poha also offers “Sprouts or roasted chana on the side” without specifying cooked sprouts.

The NIN digestion/bioavailability claim is supported but does not establish microbiological safety. CDC identifies diabetes and kidney disease as relevant risk conditions and contrasts “Any raw or undercooked sprouts” with “Cooked sprouts”.

**Exact fix:** name cooked moong sprouts explicitly in both places, retain roasted/boiled chana as an alternative, and add a sourced food-safety note. Do not suggest that washing alone makes raw sprouts safe. No cooking duration or temperature should be added without its own source.

### F09. Increasing plant protein needs a CKD-specific qualification

**Severity: misleading.** Claims: `fd-plant-protein`, `fd-veg-protein`; card `card-dal`. Code: `src/content/cards.ts:51`, `:54`; `src/content/claims/food.ts:56`, `:60`.

Trigger: a person with CKD opens Dal, chana and rajma and follows “eat more plant protein” as an instruction to increase total protein. The card's kidney caution concerns potassium only. The general personal-portions caveat does not explain the distinct protein decision.

NIDDK's Protein section says some people with CKD need moderate amounts, too little can cause malnutrition, and the right balance must be individualised. This does not justify a blanket low-protein diet or removing dal from every kidney patient's plate.

**Exact fix:** attach a kidney-specific caution that the care team sets protein as well as potassium needs, that increasing plant foods need not mean increasing total protein, and that dialysis/other treatment situations need their own plan. Give no grams or universal restriction.

### F10. Boiling is described without the source's chemical-contamination limit

**Severity: misleading.** Claim: `water-safe`; card `card-water-amount`. Code: `src/content/claims/daily.ts:92`; `src/content/cards.ts:254`.

Trigger: a reader whose water may contain excess fluoride, arsenic or another chemical contaminant follows the instruction to boil water whenever safety is uncertain and assumes that resolves the problem.

The sentence is supported by NIN's short checklist on page 92. The fuller explanation on page 89 explicitly says boiling “will not remove chemical impurities”. That condition was lost.

**Exact fix:** explain that boiling addresses microbial risk but does not remove chemical contamination; if the concern is chemical contamination, use water confirmed safe by the relevant local authority or an appropriate verified treatment. Do not improvise a filtration recommendation, disinfectant dose or boiling-time rule.

## Source accuracy, attribution and editorial findings

These findings have concrete text or function outputs. They are not assertions that every omission from an educational library is harmful.

| Finding | Claim/card id and severity | File and trigger | What is wrong and exact fix |
| --- | --- | --- | --- |
| F11 | `fd-fibre`, `card-grains`, `card-supplements`; **inaccurate** | `src/content/claims/food.ts:41`; read its fibre examples | Curd is placed among high-fibre carbohydrate foods. ADA 5.14 includes dairy among nutrition principles, while 5.24 concerns high-fibre carbohydrate sources. Combining those lists gives curd a property it does not have. Remove curd from the fibre list; discuss plain curd separately if wanted. |
| F12 | `fd-whole-grains`, `card-grains`; **misleading** | `src/content/claims/food.ts:35`; treat a refined/polished millet product as satisfying the half-whole-grain suggestion | “Whole grains or millets” makes the crop name sufficient. NIN page 1 specifies whole/minimally polished grains. Say that at least half the grains should be whole or minimally processed, including millets prepared that way. Do not imply a millet biscuit or refined millet preparation qualifies automatically. |
| F13 | `walk-meals-study`; **inaccurate** | `src/content/claims/food.ts:125`; interpret the 12%/22% as the reduction in an individual post-meal spike or reading | Reynolds measured three-hour incremental area under the glucose curve, not peak height. Each intervention lasted two weeks; the crossover was not completed in two weeks and included a 30-day washout. Replace with a study of 41 adults using two-week intervention periods, reporting about 12% lower glucose exposure above baseline over the following three hours, and 22% after the evening meal. Explain that this is a study average, not a promised change in a reading. |
| F14 | `back-walkback`, `card-walking-back`; **misleading** | `src/content/claims/daily.ts:175`; use the 208/112-day figures to predict recurrence of a person's sciatica or any minor back ache | Eligibility was recent recovery from non-specific low back pain; the endpoint was an activity-limiting recurrence. Add both qualifications. Retain physiotherapist-supported progression and the adverse-event note. Say this is not evidence that the app's walk treats an acute radicular flare. The medians themselves are correct. |
| F15 | `steps-floor`, `card-steps`; **misleading** | `src/content/claims/daily.ts:223`; read about 3,900 as the point where benefit starts or a clinical minimum | The 3,867 figure is the median of the reference quartile in Banach's analysis. The conclusion calls it a cut-off, but the study does not establish a biological onset of benefit or a prescribed minimum. Remove “Benefit seems to start”; explain the observational association without a threshold claim. Keep a user-owned progressive goal and no automatic increases. For `steps-ding`, prefer “death from any cause” to “early death”, and state that the analysis did not supply age-specific personal benefit estimates. |
| F16 | `d-diabetes`, `card-d-test`, `card-supplements`; **misleading** | `src/content/claims/vitamins.ts:101`; a person with prediabetes sees the claim marked For you and takes it as a universal reason to reject a clinician's vitamin D plan | ODS supports the glucose/HbA1c summary, but ADA's narrative rejects universal supplementation in diabetes without deficiency, not every individual indication. Endocrine Society 2024 recommendation 10 suggests clinician-directed supplementation for high-risk prediabetes as an adjunct to lifestyle for prevention, a different outcome. Say routine vitamin D is not recommended as a glucose-lowering treatment in diabetes without deficiency; distinguish deficiency treatment and clinician-selected prediabetes prevention. Remove the undifferentiated prediabetes badge or provide the separate explanation. Give no dose. |
| F17 | `d-vegan`, `card-d-get`; **inaccurate** | `src/content/claims/vitamins.ts:89`; follow its cited Groups at Risk section | The corresponding vegan/milk-avoidance passage is under Vitamin D Deficiency, not the cited Groups at Risk section, and concerns deficiency prevalence rather than a comparison of dietary intake. Point to the correct section and state the actual deficiency-risk observation. Do not infer this person's blood status from diet alone. |
| F18 | `lsss-what`, `card-salt-types`; **minor** | `src/content/claims/food.ts:199`; read the definition as applying to every lower-sodium substitute | WHO's background says these products “often include potassium chloride”; its recommendation's scope is the potassium-containing subset. Say that many lower-sodium salts replace some sodium chloride with potassium chloride and labels need checking. Keep all the kidney/medicine cautions. |
| F19 | Twelve claims listed below; **misleading** attribution, release requirement under D32 | `src/content/claims/food.ts`, `vitamins.ts`, `daily.ts`; open the rendered Sources section at `src/screens/guide/parts.tsx:102` | Twelve Standards citations have no recommendation number and include narrative or Table 5.2 locators. This violates the board's number-only rule even when the facts are supported. Apply the specific citation changes below. Do not simply attach a convenient recommendation number to a detail it does not support. |
| F20 | `s-salad-curd`, `b-upma`; **inaccurate** | `src/content/meals.ts:106`, `:285`; choose Vegan and open the sample week, a curd search result or the meal | `componentsFor` correctly removes dairy, but the salad retains “Salad with seeds and curd” as its title and remains a vegan result for “curd”. Upma has no explicit protein-quarter component; after vegan filtering it has only vegetables and grains while citing the full plate method. Use a pattern-neutral salad title or a title derived from kept components. Add a suitable dal/pulse protein component to the upma example, using an existing sourced measure, keeping curd optional for dairy eaters. Do not invent nutrient values. |
| F21 | Search and food exclusion; **misleading** | `src/content/text.ts:20`; enter `मधुमेह` in search, or `मूंगफली` in Leave out | Non-Latin characters are deleted. The first query returns all nine topics as if it were empty; the second exclusion has no tokens and does not hide peanut-containing poha. Preserve supported scripts and supply aliases, or explicitly reject an unsupported-script entry before claiming meals have been filtered. A language limitation must not silently become a successful exclusion. State that preference filtering is not an allergen/cross-contact guarantee. |
| F22 | Guide search; **minor** | `src/content/search.ts:120`; search `fasting insulin` or `no salt` | The first returns Alcohol, Building your plate, Getting up from your desk and Walking after meals; the second can return only Building your plate. Results are labelled Answers without identifying unmatched terms. Label partial matches and their matched words, or show that no complete answer exists. Do not manufacture fasting or zero-salt advice to fill the gap. |
| F23 | Medicine reasons from `contextFromProfile`; **minor** | `src/content/personalise.ts:67`, `:69`; use `sglt2i: 'unsure'`, insulin unsure, or type 1 with insulin left at its default | The API reason says the person takes an SGLT2 inhibitor or uses insulin despite uncertainty; type 1 with `insulin: 'none'` gets “You take a sulfonylurea or meglitinide”. The actual risk fact is conservative and can stay, but the asserted reason is false. Restate the answer, including uncertainty; for type 1, cite type 1 rather than inventing a secretagogue. These incorrect `because` values were observed in function outputs, not demonstrated as currently visible topic text. |
| F24 | Sources footer; **misleading** | `src/screens/guide/parts.tsx:93`; open an external source | “Nothing about you is sent” is broader than the implementation can guarantee. External requests reveal ordinary network/browser information and may carry that site's existing cookies. The links do correctly avoid profile/readings in query parameters and use `noreferrer`. Replace the sentence with “Your profile and readings are not included in the link.” |
| F25 | `b12-when-tested`, `b12-variety`; cards `card-b12-test`, `card-b12-food`; **misleading** | `src/content/cards.ts:160`, `:172`; an asymptomatic long-term metformin user opens B12 tests, or a vegan/metformin user follows the food action | The test card presents the symptom-plus-risk diagnostic rule without the separate metformin monitoring indication. The food action asks all patterns to eat a variety of the animal foods just listed, and can sound sufficient despite impaired absorption. Put the existing periodic metformin explanation on the test card. Keep diagnostic testing distinct from monitoring; do not imply symptoms are required for all checks. Give vegans a fortified-food/care-team explanation, and clarify that food variety does not establish absorption or treat a known deficiency. No dose or universal test interval is needed. |

For F13, Reynolds' own abstract defines its outcome as “incremental area under the blood glucose curve (iAUC)”. The arithmetic `1 - 0.88` and `1 - 0.78` is correct; the outcome label is the error.

For F14, the WalkBack endpoint was an “activity-limiting episode of low back pain”. A general next-episode promise changes that endpoint. For F25, ODS explicitly notes that some people have trouble absorbing B12 from food; the existing metformin and vegetarian cautions should accompany the relevant actions.

### F19 citation changes required by D32

| Claim | Current Standards locator | Specific correction |
| --- | --- | --- |
| `fd-plate-method` | Eating Patterns and Meal Planning | Keep the already-cited Food Hub plate steps; remove the unnumbered Standards citation. |
| `fd-plate-size` | Eating Patterns and Meal Planning | Keep the already-cited Food Hub introduction for the nine-inch plate. |
| `fd-whole-grains` | Carbohydrates | Use NIN's already-cited whole/minimally polished grain guidance after F12. |
| `fd-portion-refined` | Table 5.2 | Remove the table attribution and the unsupported appearance of a recommendation number. Use the Food Hub quarter-plate method as the basis for the authored rice example. |
| `salt-flavour` | Table 5.2 | Keep the WHO herbs/spices advice, with authored Indian examples. |
| `salt-table` | Sodium | Keep the already-cited WHO advice. |
| `d-diabetes` | Micronutrients and Other Supplements | Reconcile F16 using ODS, Endocrine Society and an applicable numbered recommendation for the routine glycaemic-supplement statement, without attributing extra detail to that recommendation. |
| `alc-no-safe` | Alcohol | Keep the WHO statement; it already supports the assertion. |
| `alc-sglt2` | Carbohydrates | Obtain and verify an allowed primary source for the alcohol-specific SGLT2 precaution. ADA 5.26 is appropriate for the separate ketoacidosis/ketogenic-diet message, not a replacement alcohol locator. |
| `tob-benefit` | Smoking Cessation discussion | Re-source the ten-year figure to a verified primary public-health source, or omit that number. ADA 5.40 alone does not state it. |
| `tob-chewed` | Smoking Cessation discussion | Re-source the specific cardiovascular/oral cancer facts, or retain a general avoidance message supported by 5.40. |
| `tob-vape` | Smoking Cessation discussion | Frame the advice as ADA's recommendation for people with diabetes and cite 5.40. If keeping specific heart/lung or cessation comparisons, independently source those details. |

Other locators already include recommendation numbers but add discussion text. Keep the full evidence locator in the editorial record and make the product's citation display comply with D32. In particular, annual B12 testing after more than four years is in the discussion associated with 3.10, not the recommendation sentence itself. Do not make it appear that the numeric cadence was independently printed in that sentence.

## Claim-by-claim register

SUPPORTED means the substantive assertion is supported at the supplied locator, allowing ordinary Indian food names and authored examples. It does not clear unsafe context, a licensing issue or an incomplete safety list. OVERSTATED means the app broadens the source's population, outcome, definition or qualification. WRONG SOURCE here includes a wrong cited section, even when another section of the same document contains a related fact. UNSUPPORTED would require a readable source that did not substantiate the assertion; CANNOT CHECK would identify an unavailable passage. Neither was needed after the successful alternative retrievals.

For readability, the following tables use NIN for `nin-dgi-2024`, ADA 5/3/10 for the corresponding 2026 Standards sections, Plate for `ada-diabetes-plate`, ODS B12/D/D-HP for the corresponding fact sheets, and WHO PA for `who-pa-2020`. The access register above supplies the original links, editions and retrieval limitations. Where a claim has two sources, both are named or the independently sufficient source is identified. Findings remain applicable even to rows marked SUPPORTED.

### Food, post-meal walking, blood pressure and household measures, 60 claims

| Claim | Verdict | Cited locator and verification |
| --- | --- | --- |
| `fd-plate-method` | SUPPORTED | Plate steps 1 to 3; ADA 5 Eating Patterns. The half/quarter/quarter structure is present. F19 applies to the extra Standards locator. |
| `fd-plate-size` | SUPPORTED | Plate introduction; ADA meal-planning discussion. Nine inches is explicit; 23 cm is a reasonable rounded conversion. F19. |
| `fd-nonstarchy` | SUPPORTED | Plate step 1 lists the corresponding vegetables, including okra, eggplant, leafy greens, radish and green beans. Indian names do not add a nutrient claim. |
| `fd-gourds` | SUPPORTED | NIN Annexure IV, p. 127, places the named gourds, cluster beans and drumstick among vegetables. |
| `fd-starchy` | SUPPORTED | Plate step 3 includes potato, sweet potato, corn and peas as starchy carbohydrate foods. |
| `fd-legumes-carbs` | SUPPORTED | Plate steps 2 and 3 recognise plant protein and carbohydrate in beans/legumes. |
| `fd-combination` | SUPPORTED | Plate combination-food section applies the same component proportions to mixed dishes. Khichdi/pulao are authored examples. |
| `fd-grains-yes` | SUPPORTED | Plate step 3 supplies the carbohydrate quarter, including grain foods. |
| `fd-whole-grains` | OVERSTATED | NIN pp. 1 and 66 specifies whole/minimally polished grains. “Or millets” drops the processing qualification. F12/F19. |
| `fd-portion-refined` | SUPPORTED | ADA Table 5.2's cultural/portion discussion and Plate step 3 support the portion approach. Source support does not clear the D32 table citation. F19. |
| `fd-fibre` | OVERSTATED | ADA 5.14 and 5.24 distinguish general healthy foods from high-fibre carbohydrates. Curd cannot be inserted into the latter list. F11. |
| `fd-healthy-meal` | SUPPORTED | NIN guideline 1, p. 1, describes vegetables, whole grains/pulses, modest nuts, fruit/curd and minimal added sugar/oil/salt. |
| `fd-veg-every-meal` | SUPPORTED | NIN pp. 1 and 50 includes fresh and leafy vegetables in meals. |
| `fd-veg-in-dishes` | SUPPORTED | NIN p. 50 includes vegetables in pulse/cereal dishes and raita. |
| `fd-cereal-pulse` | SUPPORTED | NIN pp. 61 and 66 explains improved protein quality from cereal/pulse combinations. The app does not prescribe its raw-weight ratio. |
| `fd-veg-protein` | SUPPORTED | NIN p. 61 explicitly identifies pulses, beans, peas and milk/curd for vegetarian protein needs. CKD qualification still needed, F09. |
| `fd-plant-protein` | SUPPORTED | ADA 5.29 supports more plant protein within diverse foods for cardiovascular risk reduction. It is not a CKD total-protein prescription, F09. |
| `fd-dal-potassium` | SUPPORTED | NIN p. 73 identifies beans/lentils as potassium sources. The attached kidney caution is correct. |
| `fd-variety` | SUPPORTED | NIN p. 2 explains variety within food groups because nutrient profiles differ. |
| `fd-water-first` | SUPPORTED | ADA 5.21/5.25; NIN p. 92 supports water/unsweetened drinks and whole fruit instead of juice. It must respect a fluid limit. |
| `fd-added-sugar` | SUPPORTED | ADA 5.14/5.25; NIN p. 99 supports minimising added-sugar foods without an invented portion allowance. |
| `fd-fruit-whole` | SUPPORTED | Plate step 3 and NIN p. 92 support fruit as carbohydrate and whole fruit over juice. |
| `fd-processed` | SUPPORTED | ADA 5.14/5.15, NIN pp. 94/99 and WHO sodium advice support limiting the listed processed foods. |
| `fd-fermented` | SUPPORTED | NIN pp. 81/88 discusses digestion and nutrient bioavailability from fermentation/sprouting. It does not establish raw-sprout safety, F08. |
| `fd-cooking` | SUPPORTED | NIN pp. 88/56 supports pressure/steam cooking and avoiding repeatedly heated oil. |
| `fd-oil` | SUPPORTED | NIN p. 56 and ADA 5.31 support limited saturated fats and avoiding partially hydrogenated fats. |
| `fd-two-three-meals` | SUPPORTED | NIN p. 2 contains the general meal-frequency/no-snacking advice. Treatment-specific exceptions are absent in its Guide presentation, F06. |
| `fd-healthy-snacks` | SUPPORTED | NIN p. 1 supplies salads, nuts/seeds/curd and roasted/boiled pulses/peanuts as examples. |
| `fd-supplements` | SUPPORTED | ADA 5.16 and accompanying supplement discussion support no routine glycaemic recommendation for the named supplements. This is about supplements, not forbidding turmeric as food. |
| `fd-tell-supplements` | SUPPORTED | ADA 5.16 and ODS B12 interactions support discussing supplement intake with the care team. |
| `fd-personal-plan` | SUPPORTED | ADA 5.10 and 5.13 support individual medical nutrition therapy and meal plans. |
| `fd-fixed-insulin` | SUPPORTED | ADA 5.28 supports consistent carbohydrate timing/amount with fixed doses. No dose change is supplied. It must accompany the meal guidance, F06. |
| `walk-meals-study` | OVERSTATED | Reynolds abstract reports two-week periods and three-hour iAUC ratios 0.88/0.78, not a two-week total crossover or a 12%/22% smaller spike. F13. |
| `walk-meals-limits` | SUPPORTED | Reynolds Methods gives two-week intervention periods and a three-hour post-meal outcome. Its short-term qualification is appropriate. |
| `walk-meals-try` | SUPPORTED | Reynolds compared ten minutes after each main meal with thirty daily minutes, with the largest evening association. It is a research-based option, not universal clearance. F02. |
| `walk-carry-sugar` | SUPPORTED | ACSM Table 4 explicitly covers insulin and secretagogue users carrying rapid carbohydrate. |
| `walk-feet` | SUPPORTED | ACSM Table 5 specifies daily checks, footwear and limiting foot-trauma activities/uneven surfaces. |
| `walk-foot-wound` | SUPPORTED | ACSM Table 5 supports non-weight-bearing alternatives for neuropathy. The app's active-wound/Charcot boundary needs stronger, complete policy wording, F03. |
| `salt-limit` | SUPPORTED | WHO sodium recommendation is less than 5 g total salt, approximately a teaspoon. NIN pp. 74/76 supports salt restriction; its wording concerns added salt, so WHO is the sufficient source for counting all sources. |
| `salt-why` | SUPPORTED | WHO overview and NIN p. 73 connect excess sodium, blood pressure and cardiovascular risk. |
| `salt-ada` | SUPPORTED | ADA 5.20 supports sodium limitation with processed-food reduction. The app does not conflate sodium milligrams with salt grams. |
| `salt-hidden-indian` | SUPPORTED | NIN pp. 74/94 identifies salty preserved/snack foods. Occasional small helpings are qualitative advice, not an invented safe quantity. |
| `salt-hidden-packaged` | SUPPORTED | WHO overview and NIN pp. 74/94 support the listed common sodium sources. |
| `salt-baking-soda` | SUPPORTED | NIN p. 88 explicitly advises against adding baking soda to pulses/vegetables because it adds sodium. No equal gram-for-gram sodium claim is made. |
| `salt-rock-black` | SUPPORTED | NIN p. 75 says sodium content is almost similar across these salts and consumption should be limited. |
| `salt-flavour` | SUPPORTED | WHO herbs/spices advice supports the authored Indian examples. The ADA table citation must be removed, F19. |
| `salt-table` | SUPPORTED | WHO sodium-reduction advice includes less cooking salt and removing table salt. F19 applies to the unnecessary ADA narrative citation. |
| `salt-iodised` | SUPPORTED | NIN p. 76 and WHO specify iodised salt alongside salt reduction. |
| `bp-potassium-foods` | SUPPORTED | NIN p. 76 explains potassium-rich fruit/vegetables and sodium excretion/BP. Kidney caution is attached and rendered. |
| `bp-potassium-kidney` | SUPPORTED | NIDDK Potassium section supports individual potassium needs and accumulation risk in CKD. |
| `bp-dash` | SUPPORTED | ADA 10.5 contains the >120/80 mmHg lifestyle recommendation. This is an intervention recommendation, not a home-hypertension diagnostic threshold. |
| `bp-dash-what` | SUPPORTED | ADA discussion of 10.5 describes fruit/vegetables, low-fat dairy and sodium reduction. Keep the recommendation-number citation rule. |
| `bp-own-targets` | SUPPORTED | ADA 10.3 supports shared, individualised BP goals. The source record's broad locator should also include 10.3, which the claim correctly names. |
| `lsss-what` | OVERSTATED | WHO Scope covers potassium-containing substitutes; its general definition says they often contain KCl, not that all do. F18. |
| `lsss-caution` | SUPPORTED | WHO executive summary and Scope explicitly exclude impaired potassium excretion and describe exclusions from the trials, including diabetes in some trials. |
| `lsss-kidney` | SUPPORTED | NIDDK potassium advice supports avoiding high-potassium salt substitutes when potassium is high. |
| `bp-meds-potassium` | SUPPORTED | ADA 10.11 and discussion cover ACE inhibitors, ARBs and MRAs, including potassium monitoring. |
| `meal-katori` | SUPPORTED | NIN Annexure I pp. 111/112 and figure notes identify the medium katori as 200 ml. This is a named measuring example, not every household bowl. |
| `meal-curd-glass` | SUPPORTED | NIN Annexure II p. 120 contains the 100/150 ml small-steel-glass curd examples. The record correctly describes a sample day rather than an individual target. |
| `meal-fruit-katori` | SUPPORTED | NIN Annexure II p. 120 gives half a medium katori in the sample adult day. |

### B12 and vitamin D, 30 claims

| Claim | Verdict | Cited locator and verification |
| --- | --- | --- |
| `b12-sources` | SUPPORTED | ODS B12 food section and NIN p. 13 support animal-food sources. Dairy/paneer examples do not assign an invented B12 amount. |
| `b12-plants` | SUPPORTED | ODS B12 food section states plant foods lack B12 unless fortified. No claim that sprouting/fermentation fixes B12 intake is made. |
| `b12-variety` | SUPPORTED | ODS describes meeting dietary intake through varied B12-containing foods. This is not assurance of adequate absorption or treatment, and needs pattern-specific delivery, F25. |
| `b12-vegetarian-hard` | SUPPORTED | NIN p. 2 specifically identifies B12 adequacy as a vegetarian concern and milk's small amount. |
| `b12-low-animal-risk` | SUPPORTED | ODS B12 risk section and NICE NG239 Box 2 include low-animal-food, vegan and religious dietary exclusions. |
| `b12-label` | SUPPORTED | ODS fortified-food advice; NIN p. 99 says nutrient enrichment does not make ultra-processed foods wholesome. |
| `b12-metformin` | SUPPORTED | ADA 3.10 supports periodic assessment with long-term metformin, especially anaemia/neuropathy; ODS describes reduced absorption. |
| `b12-metformin-yearly` | SUPPORTED | ADA discussion following 3.10 explicitly supplies annual monitoring after more than four years. It also discusses other deficiency risks; do not imply four years is the only indication. |
| `b12-other-medicines` | SUPPORTED | NICE NG239 Box 2 includes PPIs, H2 blockers and pregabalin; ODS explains gastric-acid inhibitors. |
| `b12-symptoms` | SUPPORTED | ODS deficiency section and NG239 Box 1 support fatigue, neurological/balance/cognitive symptoms and tongue changes. |
| `b12-slow` | SUPPORTED | ODS describes substantial stores and years before deficiency symptoms may appear. |
| `b12-when-tested` | SUPPORTED | NG239 1.2.5 describes the symptom-plus-risk diagnostic indication. It is not the entire preventive-monitoring policy, F25. |
| `b12-ask-test` | SUPPORTED | NG239 1.2.5/Boxes 1 and 2 and ADA 3.10 support raising symptoms and risks with a clinician. |
| `b12-doctor-decides` | SUPPORTED | NG239 testing recommendations and ODS supplement/interaction advice support clinician assessment without a product-selected dose. |
| `b12-numbness-check` | SUPPORTED | NG239 Box 1 and NG127 urgent neurological recommendations support not assuming a cause. Acute/progressive weakness needs the urgency distinctions in F04. |
| `d-sun` | SUPPORTED | ODS D sun section and NIN p. 1 support cutaneous synthesis with sun exposure. |
| `d-sun-varies` | SUPPORTED | ODS D-HP Sun exposure explains variable synthesis and UVB exclusion by glass; the consumer sheet supports age/skin/cloud/smog factors. No universal minutes are prescribed. |
| `d-get-outside` | SUPPORTED | ODS D sun section and NIN p. 1 support the mechanism. The skin-risk condition must accompany its use as an action, F02. |
| `d-sun-skin` | SUPPORTED | ODS consumer/professional sun sections describe UV skin risk and limiting exposure. |
| `d-indoors` | SUPPORTED | ODS D-HP limited-sun-exposure group and consumer risk section support indoor/covered-skin risk. |
| `d-foods` | SUPPORTED | ODS D food section identifies fatty fish, small amounts in egg yolks/cheese and UV-exposed mushrooms. |
| `d-label` | SUPPORTED | ODS D food section describes fortification and label checking. It does not assume every Indian milk brand is fortified. |
| `d-vegan` | WRONG SOURCE | The cited Groups at Risk section does not contain the vegan/milk-avoidance comparison. A related deficiency-risk passage exists under Vitamin D Deficiency; the dietary-intake wording also needs correction, F17. |
| `d-at-risk` | SUPPORTED | ODS D consumer risk section contains older age, limited sun, darker skin, obesity and malabsorption. |
| `d-no-routine-test` | SUPPORTED | Endocrine Society 2024 recommendations 3/5/7 advise against routine testing in the stated generally healthy adult groups. The app's medical-reason qualification matters. |
| `d-diabetes` | OVERSTATED | ODS supports the broad glucose/HbA1c trial summary, but ADA rejects universal supplementation, not every clinician-selected indication; the prediabetes badge ignores the distinct prevention recommendation. F16. |
| `d-ask-test` | SUPPORTED | Endocrine Society's established-indication qualification supports asking whether individual testing is appropriate, without routine screening. |
| `d-too-much` | SUPPORTED | ODS toxicity section attributes excessive levels predominantly to supplements, not sun synthesis. This does not make unlimited sun exposure safe. |
| `d-thiazide` | SUPPORTED | ODS interaction section specifically describes high calcium risk with thiazide diuretics and vitamin D supplements. It does not say every diuretic does this. |
| `d-doctor-decides` | SUPPORTED | Endocrine Society testing boundaries and ODS toxicity advice support individual clinical decisions without dose advice. |

### Desk and sitting, 19 claims

| Claim | Verdict | Cited locator and verification |
| --- | --- | --- |
| `desk-no-single-posture` | SUPPORTED | OSHA Positions says prolonged static positioning is unhealthy regardless of posture and encourages frequent changes. |
| `desk-postures` | SUPPORTED | OSHA's four reference postures are upright, reclined, declined sitting and standing. This is ergonomic guidance, not evidence one posture cures sciatica. |
| `desk-ways-to-change` | SUPPORTED | OSHA changing-position examples include chair adjustment, stretching, brief walks and standing tasks. Foot restrictions need an alternative, F02. |
| `desk-lumbar` | SUPPORTED | OSHA Chairs, Backrest, explicitly includes a rolled towel/removable support as a temporary solution. |
| `desk-feet` | SUPPORTED | OSHA Chairs, Seat, supports foot support and a footrest when needed. |
| `desk-arms` | SUPPORTED | OSHA Armrests and HSE standard setup support relaxed shoulders and keyboard below elbow height. |
| `desk-screen` | SUPPORTED | OSHA distance/angle advice and HSE standard setup support the screen placement and approximate arm's length. |
| `desk-centred` | SUPPORTED | HSE standard setup explicitly centres screen/keyboard to avoid twisting. |
| `desk-laptop` | SUPPORTED | HSE prolonged-laptop setup uses a separate keyboard/mouse and raised screen. |
| `desk-text-size` | SUPPORTED | OSHA Viewing distance says text size may need increasing rather than requiring forward leaning. |
| `desk-eyes` | SUPPORTED | OSHA Viewing time describes looking farther away and blinking. “Eye fatigue” is a descriptive locator; use the actual Viewing time heading for precision. |
| `desk-back-link` | SUPPORTED | OSHA Backrest describes back pain/fatigue from poor support and awkward positions, with conditional language. |
| `desk-report-early` | SUPPORTED | OSHA Work Process, MSD Signs and Symptoms, encourages early reporting and includes aching, tingling and numbness. |
| `sit-30` | SUPPORTED | ADA 5.34 explicitly includes interrupting prolonged sitting at least every thirty minutes. This is the correct 2026 number. |
| `sit-dempsey` | SUPPORTED | Dempsey abstract describes 24 adults, three-minute activity breaks every thirty minutes and lower acute post-meal glucose/insulin exposure. No long-term HbA1c claim is made. |
| `sit-hourly` | SUPPORTED | OSHA Micro Breaks explicitly gives a five-minute computer break every hour. |
| `sit-short-often` | SUPPORTED | HSE gives five to ten minutes hourly versus twenty every two hours as an example. Do not call this a universal medical minimum. |
| `sit-nin-tips` | SUPPORTED | NIN p. 71 gives standing every half hour, walking five to ten minutes every few hours and phone calls while walking. Restricted users need seated options, F02. |
| `sit-any-movement` | SUPPORTED | WHO PA Table 4 supports replacing sedentary time with activity of any intensity, including light activity. |

### Water and fluid limits, 11 claims

| Claim | Verdict | Cited locator and verification |
| --- | --- | --- |
| `water-amount` | SUPPORTED | NIN p. 89 gives approximately eight glasses/two litres including beverages for a normal healthy person. It is not an individual clinical fluid target. F01. |
| `water-more` | SUPPORTED | NIN p. 89 describes higher requirements with heat/vigorous activity and sweat loss. The fluid-limit override must apply. |
| `water-hot-weather` | SUPPORTED | NIN p. 92 supports the named drinks; ADA 5.25 supports avoiding added sugar. The attached coconut-potassium caution is present. Count any added salt and fluids within the care plan. |
| `water-coconut` | SUPPORTED | NIN p. 89 specifically excludes coconut water for patients prone to hyperkalaemia in kidney/heart disease. It is not a ban for every cardiac diagnosis. |
| `water-safe` | SUPPORTED | NIN p. 92 contains the boiling instruction. Its fuller p. 89 chemical-contamination limit must be retained, F10. |
| `water-kidney` | SUPPORTED | NIDDK Liquids explains impaired fluid clearance and individual limits. The claim appropriately says may need a limit. |
| `hf-salt-fluid` | SUPPORTED | NHLBI heart-healthy lifestyle section says the team may ask for salt/liquid limits to reduce buildup. |
| `water-plan-first` | SUPPORTED | NIDDK Liquids/Track your liquids and NHLBI lifestyle guidance support following individual limits over general advice. |
| `fluid-ask-amount` | SUPPORTED | NIDDK and NHLBI direct individual fluid planning with the care team. |
| `fluid-salt` | SUPPORTED | NIDDK Sodium and NHLBI lifestyle sections connect sodium with fluid retention and individual limits. |
| `fluid-swelling` | SUPPORTED | NIDDK Track your liquids and NHLBI worsening-heart-failure advice support the symptoms and contact instruction. The missing emergency distinction is F05. |

### Sleep, 13 claims

| Claim | Verdict | Cited locator and verification |
| --- | --- | --- |
| `sleep-hours` | SUPPORTED | CDC Getting enough sleep gives 7+ hours at 18 to 60, 7 to 9 at 61 to 64, and 7 to 8 at 65+. |
| `sleep-quality` | SUPPORTED | CDC Sleep quality identifies sleep-initiation problems, repeated waking and tiredness despite enough hours. |
| `sleep-same-times` | SUPPORTED | CDC What to do recommends consistent bed and wake times. |
| `sleep-room` | SUPPORTED | CDC What to do recommends a quiet, relaxing, cool bedroom. |
| `sleep-screens` | SUPPORTED | CDC What to do specifies switching off devices at least thirty minutes before bed. |
| `sleep-food-caffeine` | SUPPORTED | CDC What to do covers large meals/alcohol before bed and afternoon/evening caffeine. |
| `sleep-active` | SUPPORTED | CDC What to do supports regular exercise and healthy eating for sleep. |
| `sleep-ada-routine` | SUPPORTED | ADA 5.57 supports sleep-promoting routines in diabetes. |
| `sleep-ada-screen` | SUPPORTED | ADA 5.56 supports screening sleep health in diabetes/prediabetes and referral when indicated. |
| `sleep-see-doctor` | SUPPORTED | CDC Management advises clinical discussion for regular problems or sleep-disorder symptoms. |
| `apnoea-signs` | SUPPORTED | NHLBI Symptoms includes snoring, breathing pauses, daytime effects and nocturnal urination. These are possible signs, not a diagnosis. |
| `apnoea-ask-someone` | SUPPORTED | NHLBI explains that another person may notice signs the sleeper does not; the authored question follows that explanation. |
| `apnoea-tell-doctor` | SUPPORTED | NHLBI recommends assessment and says a sleep study may be needed. |

### Back, activity, steps, alcohol and tobacco, 31 claims

| Claim | Verdict | Cited locator and verification |
| --- | --- | --- |
| `back-normal-activities` | SUPPORTED | NICE NG59 1.2.1 encourages normal activity with advice tailored to capability. Red flags must precede this advice, F04. |
| `back-exercise` | SUPPORTED | NG59 1.2.2 supports considering an individually suitable group biomechanical/aerobic/mind-body programme for an episode/flare. It does not validate this app's particular stretches. |
| `back-no-belts` | SUPPORTED | NG59 1.2.3 explicitly advises against belts/corsets for back pain with or without sciatica. |
| `back-walkback` | OVERSTATED | WalkBack abstract specifies recovered non-specific pain and an activity-limiting recurrence. The 208/112 medians are correct but their population/outcome were broadened, F14. |
| `back-walkback-limits` | SUPPORTED | WalkBack Methods/Findings supports the recovered-population and excess lower-extremity-event qualification. |
| `back-emergency` | SUPPORTED | NG127 1.7.3 supports immediate cauda-equina assessment in its described presentation. As the app's complete emergency instruction, the sentence is too narrow, F04. |
| `back-weakness` | SUPPORTED | NG127 1.7.2 supports immediate assessment of rapidly progressive symmetrical weakness. It does not cover all urgent weakness, F04. |
| `back-not-controlled` | SUPPORTED | NG127 1.10.12 recognises uncontrolled/disabling lumbar radiculopathy as an exception to routine non-referral for stable symptoms. The app does not instruct waiting six weeks. |
| `act-who` | SUPPORTED | WHO PA Table 4 supports 150 to 300 moderate aerobic minutes and strength on two or more days, including appropriate chronic-condition populations. Vigorous/equivalent options also exist; this is not a 300-minute safety cap. |
| `act-nin` | SUPPORTED | NIN p. 70 supplies thirty to sixty moderate minutes on at least five days and at least two strength days for adults through sixty. Its framework is named. |
| `act-ada` | SUPPORTED | ADA 5.36/5.37 supplies at least 150 aerobic minutes across at least three days, no more than two consecutive inactive days, and two to three nonconsecutive resistance sessions. |
| `act-start-small` | SUPPORTED | WHO PA discussion/Table 4 supports some activity over none and gradual progression. No unsupported percentage increase is invented. |
| `act-talk-test` | SUPPORTED | NIN p. 70 describes brisk/moderate effort with deeper/faster breathing while still able to talk. This is not clearance despite symptoms. |
| `act-check-first` | SUPPORTED | NIN p. 71 advises physician consultation for chronic-disease exercise programmes. It is a conservative, explicitly named NIN recommendation. |
| `steps-ding` | SUPPORTED | Ding abstract reports 7,000 versus 2,000 steps associated with 47% lower all-cause mortality and 14% lower incident type 2 diabetes. These are observational relative estimates, not personal predictions. F15 improves the endpoint label. |
| `steps-realistic` | SUPPORTED | Ding Interpretation suggests 7,000 may be more achievable and identifies observational biases/residual confounding. The non-causal qualification is correct. |
| `steps-floor` | OVERSTATED | Banach's reference-quartile median is not evidence of the point at which benefit begins. F15. |
| `steps-build` | SUPPORTED | WHO PA uses time/intensity, not a universal step prescription, and supports gradual progression. |
| `alc-no-safe` | SUPPORTED | WHO Europe 2023 supports no risk-free amount. The extra ADA narrative citation is unnecessary and fails D32, F19. |
| `alc-dont-start` | SUPPORTED | ADA 5.18 explicitly advises abstainers not to start even in moderation. |
| `alc-nin` | SUPPORTED | NIN pp. 92/68 advises avoiding alcohol. |
| `alc-bp` | SUPPORTED | ADA 10.5 includes limiting or avoiding alcohol in BP lifestyle management. |
| `alc-sglt2` | SUPPORTED | ADA Carbohydrates discussion explicitly advises avoiding excessive alcohol with SGLT2 inhibitors. Current locator lacks a recommendation number, F19; the broader missing safety message is F07. |
| `alc-delayed-lows` | SUPPORTED | ADA 5.19 and Alcohol discussion support delayed hypoglycaemia and extra monitoring with insulin/secretagogues. A food/care-plan qualifier would strengthen its context; no universal safe drink count is given. |
| `tob-avoid` | SUPPORTED | ADA 5.40 and discussion support avoiding tobacco/vaping and the unsafe-product statement. |
| `tob-benefit` | SUPPORTED | ADA Smoking Cessation discussion explicitly contains up to ten additional years of life. It is not in the recommendation sentence, F19. |
| `tob-chewed` | SUPPORTED | ADA Smoking Cessation discussion covers cardiovascular and oral cancer risk from smokeless tobacco. F19. |
| `tob-vape` | SUPPORTED | ADA Smoking Cessation discussion advises people with diabetes against e-cigarettes as cessation/recreation and describes cardiovascular/respiratory risks. Frame it as that guidance, not a universal claim about every country's cessation policy, F19. |
| `tob-help` | SUPPORTED | ADA 5.40 recommends counselling plus pharmacologic cessation treatment. |
| `tob-tell-doctor` | SUPPORTED | ADA 5.40 and discussion support routine assessment, with every-visit wording in the discussion. |
| `tob-meds-doctor` | SUPPORTED | ADA 5.40 supports clinical provision/referral for cessation treatment. The app asks for advice; it does not claim every nicotine product requires a prescription. |

## Indian meal and advice assessment

The core food categorisation is sensible: potato/peas/corn are treated as starchy, pulses carry both protein and carbohydrate, mixed dishes are explained by components, and familiar roti/rice/dal/sambar/khichdi meals do not pretend to have exact glycaemic effects. Paneer, dairy, eggs and meat are not treated as interchangeable with plant B12. The app does not claim traditional fermentation or sprouting supplies reliable B12.

All four explicit measures have source records: half/quarter plate from the Plate method, and curd/fruit examples from NIN's sample adult day. There are no unsupported roti counts, cooked rice gram portions, nutrient totals or dish GI values. This clears the principal D9/D22 issue. It does not make the sample day suitable for every insulin regimen, CKD stage or calorie requirement, which is why F06/F09 and the existing individual-plan caveat matter.

Vegetarian filtering removes eggs/meat; eggetarian filtering permits eggs but excludes meat/fish; vegan component filtering removes dairy. Region is an ordering preference rather than a ban on other regions, which is appropriate for a varied Indian diet. Specific failures are the vegan salad title/search and upma composition in F20. “Sprouts chaat” needs the cooking qualification in F08. Romanised Hindi aliases work; native-script input does not, F21.

Salt guidance correctly distinguishes total salt from sodium and does not market sendha/kala namak as a BP treatment. The single displayed population salt ceiling is WHO's below 5 g, not a claim that the WHO and ADA sodium frameworks are numerically identical. Potassium substitutes are not made the default swap; kidney and relevant medicine cautions are retained. When editing hot-weather drinks, specify preparations without added sugar and remind readers to count any salt in chaas/nimbu pani within their plan. A commercially salted spice blend is not automatically a salt-free flavour swap.

## Licence, attribution and factual reuse

- **No IFCT database or nutrient table was found.** No DGI My Plate table, raw-gram diet or calorie table is reproduced in the content. The household examples are selected factual measures described in authored prose, not a copy of the sample-day table.
- **No NHS source backs a claim in the typed graph.** The two NHS links are in Further reading, kept separate from `SOURCES` and claim support. Their presence there complies with the board's stated exception. This graph check does not prove the history of every authored sentence, but I found no unacknowledged NHS adaptation in the reviewed claim/source comparisons.
- **No direct ADA quotation was found in displayed claims.** Own-word summaries still need the citation correction in F19. Availability through PMC or a mirror is not product reuse permission.
- **HSE attribution is present.** Its source records carry the Open Government Licence v3.0 statement and `SourceList` includes it in the footer. NICE and the US government sources are identified as their actual organisations, not relabelled NHS.
- **Research results are authored summaries with links.** Keep the corrected endpoint/population qualifications. Do not paste the underlying research tables into this app as a fix.

The factory at `src/content/claims/make.ts:25` assigns `method: 'fetched'` and the same `REVIEWED` date to every claim from source-level reading records. The 108 passing tests validate references, formatting, patterns and some safeguards; they cannot establish that a claim says what its cited passage says. After these edits, review each changed statement and its actual locator before renewing its checked date. Do not interpret the existing badge as clinician approval.

## Personalisation checks and required regression inputs

These are the independent function results and the acceptance conditions needed for the content fixes. They do not assert that source edits or new tests have already been made.

| Input/context | Current result | Required result |
| --- | --- | --- |
| Type 2, metformin true | `metformin` fact and B12 relevance, truthful medicine reason | Keep. |
| Type 2, metformin false, non-vegetarian | No metformin/unknown fact; no metformin-based B12 priority | Keep. |
| Type 2, metformin missing/unsure | `metforminUnknown`; conditional metformin wording, not an asserted dose/use | Keep; show an uncertainty reason when answered unsure. |
| Vegetarian/vegan/eggetarian | `lowAnimalFood`, B12 relevance and vegetarian difficulty badge | Keep risk recognition; adapt the B12 food action to the pattern rather than prescribing animal foods. |
| Kidney disease true/unsure, or heart condition | Generic water card hidden; fluid-limit card remains | Keep conservative withholding. Do not infer every cardiac patient actually has a prescribed limit. |
| `health.fluidRestriction: true`, no legacy limit | Generic water card visible; water habit offered | Hide generic amount/more advice, withhold water habit, keep clinician-plan content. |
| `health.fluidRestriction: 'unsure'` | Generic water card visible; water habit offered | Withhold pending clarification, with an uncertainty reason. |
| Legacy `habits.fluidLimit: 'unsure'`, new field absent | Generic water card visible; water habit offered | Same cautious behaviour as the canonical resolver. |
| New fluid answer false, legacy answer true | Guide suppresses advice; reminders prefers new false | Honour the newer profile answer consistently, subject to kidney/heart safeguards. |
| Active wound/Charcot | All three walking links hidden; meal-walk habit withheld | Keep. Also remove contradictory prose and adapt standing reminders. |
| Past ulcer, no current wound | General neuropathy restrictions without an active-wound ban | Keep; do not turn every historic ulcer into a permanent ban on walking. |
| Insulin/SU user opens `card-supplements`, `card-steps`, `card-walking-back` | Walking advice lacks some/all hypo precautions | Relevant care-plan, carbohydrate and foot precautions must be visible beside the advice. |
| Insulin/SU user opens Snacks or meal detail | General meal guidance without the timing exception | Display the medicine-plan exception before any decision to remove snacks or change timing. |
| Mild back pain plus new saddle/bladder symptoms | Guide's severe-pain wording can appear inapplicable | Unambiguous emergency instruction before the movement action. |
| New unilateral weakness/foot drop | Bilateral warning does not cover it | Explicit urgent unilateral assessment instruction; sudden possible stroke symptoms get emergency direction. |
| Vegan opens `s-salad-curd` or searches curd | Dairy-free components, dairy-containing title/result | Title and search document reflect the actual kept components. |
| Vegan opens upma | Vegetables and grain only | A coherent plant-protein option consistent with the cited plate example. |
| Search `मधुमेह`; exclusion `मूंगफली` | All topics; exclusion silently ignored | Supported matching or explicit unsupported-language handling, never a false successful filter. |
| Type 1, insulin default none; SGLT2 unsure | Conservative risk facts but false `because` medicine assertions | Truthful reasons without reducing precautions. |

## Checked and correct

- Register coverage is exact: 164 claim ids, no missing or duplicate register entry. Every claim has a source record and locator. Source links are references to public documents, not generated personal advice.
- Metformin yes/no/unknown is handled deliberately. The B12 facts, including the more-than-four-year annual discussion, are sourced. The problem is contextual delivery, not an invented dose or a false claim that milk reliably fixes deficiency.
- Kidney potassium cautions are attached to the potassium-food claims and render with them. Coconut-water caution travels with the hot-weather claim. The low-sodium salt card includes kidney and medicine exceptions.
- Foot-wound link suppression follows `profileRules(...).modifiers.includes('FOOT')`. Actual probes confirmed all three walking actions and the meal-walk habit are withheld for `current_wound_or_active_charcot`.
- The content contains no supplement dose, insulin dose, medicine-adjustment instruction, vitamin D sunlight timer or routine vitamin D testing interval. The non-routine screening statement is appropriately qualified.
- WHO/ADA/NIN activity frameworks are named. No fixed percentage step increase or rule that 10,000 is a guideline is introduced. The research's relative risks are presented as associations, with the threshold correction in F15 still required.
- The WalkBack adverse-event caveat and the short-term post-meal-walk caveat are present. Neither should be deleted to make copy more encouraging.
- The current NHS separation, absence of IFCT data, own-word prose and HSE attribution are correct, subject to the ADA locator issue.
- Preference changes are handled by pattern/component filtering rather than fabricated nutrient calculations. Empty filtered slots do not generate an invented replacement meal.

## Release conditions

Before release, resolve the harmful findings F01 to F06 and F08, and the misleading clinical-context findings F07, F09/F10, F12, F14 to F16 and F25. Correct F11/F13/F17, which are factual or source-location errors, and make F19 comply with D32. Resolve the explicit preference/language failures F20/F21 so the app does not claim it honoured food choices it ignored. The smaller search, definition, medicine-reason and privacy-copy corrections are straightforward and should accompany that pass.

Re-run the content tests with regression cases for the canonical fluid answer, reusable precautions, medicine-specific meal timing, urgent back symptoms and vegan/unsupported-script filtering. A passing structural suite alone does not clear these issues. Recheck each changed claim against its locator, retain the study limitations, and perform the separately authorised browser validation before publishing.

**Release verdict: ship after fixes.**
