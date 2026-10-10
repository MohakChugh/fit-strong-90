# Guide content re-check

Reviewed 8 October 2026. **Release verdict: ship after listed fixes.**

The source corrections are substantial. The current inventory is **183 claims, 43 sources, 30 cards and 26 meals**. Comparing the current claim statements and citations with the previous register identifies exactly **21 new claims and 36 changed claims**. Of those 57, **56 are SUPPORTED** at an applicable cited locator and **one is OVERSTATED** in its attribution and population, `sglt2-keto`. Source support does not clear a claim's presentation or its consistency with the app's safety contract.

Of the original **F01 to F25**, **22 are fixed and three are partly fixed**, F02, F04 and F21. The remaining problems concern warning order, incomplete back urgency, reminder consumers that bypass the new precautions, and a false food-exclusion confirmation. These need correction before release. The narrower SGLT2 attribution, one page locator and the stale author register also need correction.

## Verification and limits

I read the current typed content, Guide renderers, relevant reminder consumers, the previous audit, the author's register and Board D9, D22, D26, D27, D31 and D32. I fetched the primary material used by the new and changed claims, including the two FDA labels, NICE recommendations, the relevant ADA 2026 sections, NIN's PDF and the four study abstracts.

I executed the existing test bodies against freshly transpiled current modules in memory, using the installed assertion libraries. **209 tests passed, zero failed.** This was an in-memory runner, not a successful invocation of the Vitest CLI.

| Test file | Executed | Result |
|---|---:|---|
| `src/content/integrity.test.ts` | 21 | PASS |
| `src/content/personalise.test.ts` | 25 | PASS |
| `src/content/search.test.ts` | 31 | PASS |
| `src/content/week.test.ts` | 23 | PASS |
| `src/content/library.test.ts` | 3 | PASS |
| `src/content/audit.test.ts` | 96 | PASS |
| `src/screens/guide/format.test.ts` | 10 | PASS |

Additional in-memory probes exercised the real content resolver, search, leave-out filtering, reminder scheduler and calendar-event generator. I also rendered the actual `CardScreen`, `GuideScreen`, meal-list, meal-detail and sample-week components through ReactDOMServer under MemoryRouter. Those component probes supplied `useGuide` with explicit fixture contexts; `contextFromProfile` and the real `useGuide` dependency path were checked separately. These were static component renders, not browser interaction, persistence tests or a mounted live store.

Source access covered **35 distinct source records relevant to this re-check**:

- The ADA 2026 PMC pages and ACSM full text were readable directly. ADA evidence below is paraphrased and identified by recommendation number; no ADA source passage or table is reproduced.
- The FDA labels and NIN/WHO PDFs were downloaded into memory and decoded through `pdftotext` using stdin and stdout. No source downloads or extracted-text files were written.
- Direct ODS B12 and both ODS vitamin D pages returned **403**. Their text was checked through the public `r.jina.ai` text renderer of the original URLs, with the page identity and headings verified. The retrieval address uses `https://r.jina.ai/` followed by the complete original source URL. This is a weaker retrieval path than direct access and is recorded explicitly.
- Direct PubMed pages for Reynolds, WalkBack, Ding and Banach returned a **203 browser/cookie challenge**. Their abstracts were retrieved from the official NCBI Eutilities XML endpoint, with PMIDs matched. I did not read the full papers for these four studies.
- The remaining 126 claims were not all re-verified at source in this round. Structural checks and the personalisation traversal cover the whole library; the source verdict register below covers the requested 57.

The source files I reviewed were unchanged on the final comparison with the text captured during this audit. No application code, tests, settings or existing documentation was edited.

## Remaining findings

### R01. Emergency help still follows movement advice, and one back card has none

**Severity: harmful. Original F04 remains partly fixed.** Cards: `card-keep-moving`, `card-activity`, `card-steps`.

**Code:** `src/content/personalise.ts:243` resolves the answer before emergency claims; line 249 places the answer first in the emitted blocks. `src/screens/guide/CardScreen.tsx:44` renders that order. `src/content/cards.ts:343` puts `back-normal-activities` and `back-exercise` in the opening answer. `src/content/cards.ts:364` defines `card-activity` without an `emergencies` group, despite assigning it to the `back` topic. `card-steps` places `steps-realistic` in its opening answer at line 381.

**Trigger:** open Moving with back pain while experiencing new bladder or saddle symptoms, or enter the back topic and open How much activity?

**Observed:** the actual Moving with back pain component begins with “keep up your normal daily activities” and exercise advice. “Get help now” appears afterwards. In the rendered text, normal-activity advice begins at character 130 and the emergency heading at character 649. The stretch link follows the emergency block, which is an improvement, but the independent movement instructions still precede it. How much activity? renders aerobic/strength recommendations and movement instructions with no back emergency block at all.

**Required:** every back card containing movement advice must put its applicable emergency and same-day exceptions before that advice, including advice classified as an `answer`. A reader can follow prose without using a movement link.

**Fix:** add the shared back warnings to `card-activity`. Order urgent blocks before any movement-bearing answer, or keep an introductory answer purely explanatory and move its movement instructions after the urgent blocks. Check all cards derived from the back topic and all claims marked as movement, rather than a manually selected subset.

**Why the tests miss it:** `src/content/audit.test.ts:156` enumerates only three cards and omits `card-activity`. Lines 160 and 161 compare emergency placement with `actions` and `action`, ignoring movement in `answer`. Those tests pass for the observed unsafe order.

### R02. The new back wording still loses important urgency exceptions

**Severity: harmful. Original F04 remains partly fixed.** Claims: `back-leg-weakness`, `back-weakness`, `back-fever`, `back-changed`.

**Code:** `src/content/claims/daily.ts:212` assigns all new/progressive single-leg weakness to `urgency: 'soon'`, with assessment “today”. Lines 208 to 211 cover worsening weakness in both legs or both arms. Lines 216 to 219 cover fever. `BACK_RED_FLAGS` at `src/content/cards.ts:15` contains these claims but no emergency statement for new bilateral sensory symptoms and no same-day systemic-illness alternative to fever. The nonspecific new/changing-symptom statement at `daily.ts:224` remains a routine caution.

| Concrete presentation | What the current text supplies | Required reconciliation |
|---|---|---|
| A new weak foot deteriorates over hours, without sudden stroke signs, bilateral weakness or cauda equina symptoms | `back-leg-weakness`: get assessed today and do not exercise | The contract's T-NEURO row explicitly escalates rapid progression to emergency assessment. Make that exception explicit in the content. |
| Back pain with numbness developing in both legs over a day, without sudden onset, weakness or bladder/saddle symptoms | The sudden-stroke and bilateral-weakness statements do not cover this presentation; `back-changed` supplies a routine contact message | The contract's E-BILATERAL row makes new bilateral neurological symptoms an emergency. Do not require weakness to obtain that instruction. |
| Back pain with shivering/feeling generally unwell, or severe sudden/rapidly worsening pain, without a stated fever | The new same-day claim is conditional on fever; new/changing symptoms otherwise receive a routine doctor message | The original F04 requested systemic illness and rapidly changing symptoms. The contract's T-BACK row requires a hold and assessment today for these presentations. Preserve those exceptions without requiring a temperature measurement. |

**Source reconciliation:** NICE NG127 1.7.4 addresses rapidly progressive single-limb weakness through referral for investigation. It does **not** itself prescribe emergency help for every new unilateral foot drop. The current claim accurately describes that recommendation, and its same-day rule is explicitly the app's policy. The defect is the missing exception to that policy under the app's existing contract, not a licence to attribute a broader emergency rule to NICE.

**Fix:** split ordinary new leg weakness from rapid progression and add the bilateral sensory/systemic-illness exceptions. Identify conservative escalation as **“this app”** policy and maintain an allowed primary-source foundation. Do not turn an NHS passage into adapted product content or imply NG127 1.7.4 says more than it does. Keep ordinary new unilateral weakness as assessment today when no emergency exception applies.

**Test gap:** `src/content/audit.test.ts:174` checks that single-leg weakness is present and tagged `soon`; it never exercises rapid progression or sensory-only bilateral symptoms. The fever test at line 182 does not cover being generally unwell without fever.

### R03. Travelling precautions stop at Guide; reminders still invite forbidden movement

**Severity: harmful. Original F02 remains partly fixed.** Claims/habits: `walk-foot-wound`, `walk-carry-sugar`, `sittingBreak`, `mealWalk`.

**Code:** `src/content/personalise.ts:300` correctly withholds Guide's standing and meal-walk habit offers for a foot wound. However, `src/reminders/schedule.ts:122` schedules an enabled sitting break without consulting the profile's foot restriction; line 127 does the same for meal walks. `src/reminders/copy.ts:48` says “Time to stand up for a few minutes”; line 53 offers ten easy minutes without medicine precautions. `src/reminders/ics.ts:123` calls the same scheduler, and line 111 names a calendar event “Stand up and move”. `src/screens/you/HabitSheets.tsx:245` can still enable the standing habit. `src/reminders/ReminderBanner.tsx:52` displays this independent text and line 63 offers the walk link.

**Trigger:** use a reviewed basal-insulin profile with `footStatus: 'current_wound_or_active_charcot'`; enable sitting breaks every 30 minutes from 09:00 to 10:00 and a dinner walk at 19:00.

**Observed in actual function outputs:** Guide returns `offered: false` for both habits. `dailyTimes` nevertheless returns sitting breaks at minutes 570 and 600 and a meal walk at minute 1140. `calendarEvents` emits two “Stand up and move” events and a “Walk after dinner” event. Their notes contain neither the active-foot restriction nor the insulin activity precautions.

**Required:** an active wound/Charcot profile must not receive independent standing or walking invitations. An insulin/secretagogue user receiving a permitted movement reminder must retain the care-plan monitoring/rapid-carbohydrate precaution, especially in a calendar event that can be followed outside the app.

**Fix:** share the canonical foot eligibility and relevant precaution resolution with habit settings, scheduler, pending reminder display and calendar generation. Withhold weight-bearing prompts or replace them with an explicitly permitted seated alternative. Do not rely on a later Walk gate to make an earlier instruction safe. Check existing enabled habits as well as newly created ones.

This is a bounded check of consumers of the corrected guidance, not a claim that the Walk player bypasses its own safety gate. Guide's claim reuse and seated replacements are correct; the integration is incomplete.

### R04. A new leave-out helper can falsely confirm an exclusion

**Severity: misleading. Original F21 is partly fixed because the new confirmation mechanism introduces this failure.**

**Code:** `src/content/week.ts:37` unions words from every meal into `MEAL_WORDS`. `unmatchedAvoid` at line 46 accepts a term if each word appears somewhere in that global union. Actual filtering at `isAvoided`, line 24, requires the words to appear in the **same meal**. `src/screens/guide/format.ts:25` trusts the first result and line 27 writes “no …”. `FoodPicker.tsx:50` uses the helper for its unmatched warning.

**Trigger:** choose Vegetarian and enter `peanut chutney` in Leave out.

**Observed:** no meal matches the compound term, so `mealsFor` returns the same 20 meals as without it. `unmatchedAvoid(['peanut chutney'])` returns `[]`; the food summary says **“Vegetarian · no peanut chutney”** and there is no unmatched note. `coconut milk` produces the same disagreement. These are plausible food names, not just arbitrary mismatched tokens.

**Required:** the UI must not state that an entry excluded a meal when nothing was excluded. The new allergy/cross-contact disclaimer is useful but does not make this confirmation true.

**Fix:** detect unmatched entries through the same per-meal matching predicate used for filtering, accounting for the selected dietary pattern. Derive the success summary from actual affected meals. Add compound-food and pattern-specific regression cases, retaining the existing Devanagari tests and allergy disclaimer.

### R05. The ketogenic-diet claim extends ADA's stated population

**Severity: inaccurate attribution. Claim: `sglt2-keto`. Source verdict: OVERSTATED.**

**Code:** `src/content/claims/food.ts:143` says “If you take an SGLT2 inhibitor, ADA advises against …” and applies to the `sglt2i` fact.

**Trigger:** a person without diabetes takes an SGLT2 inhibitor for heart failure or kidney disease and reads the claim. `contextFromProfile` adds the SGLT2 fact independently of diabetes at `src/content/personalise.ts:92`.

**Observed:** the text attributes a recommendation to ADA across all such users. ADA 2026 recommendation 5.26 is framed for people with diabetes at ketoacidosis risk receiving SGLT inhibition. The drug labels support ketoacidosis education and ketogenic-diet risk across the medicines' users, but do not broaden the population named in the ADA recommendation.

**Fix:** qualify the attribution while preserving the broader label-based warning. For example: “For people with diabetes taking an SGLT2 inhibitor, ADA discourages ketogenic eating. These medicines' labels identify a ketogenic diet as a ketoacidosis trigger, so discuss major diet changes with your care team.” Keep the FDA citations and the warning for users without diabetes. Do not solve this by hiding their relevant risk information.

This is a source/population correction. The ketoacidosis warning itself is appropriate; it should not become a fasting ban, drug-stop instruction or fluid prescription.

### R06. The author register still describes the previous content

**Severity: minor, auditability.**

**Code/document:** `docs/reimagine/guide-report.md:32` still reports 32 sources, 164 claims and 29 cards. Its CLAIMS REGISTER remains the older set. Line 349 says Banach's 3,867 figure was used where the current claim correctly removed the floor. Line 358 says fever/feeling unwell was left out because of the NHS restriction, despite the newly sourced fever claim. Line 55 describes the old test total.

**Trigger:** a later reviewer uses this document as the advertised author register to verify the release inventory, new safety content or deliberately excluded facts.

**Observed:** the 21 new claims and current source changes are absent, and the LEFT OUT section contradicts what ships.

**Fix:** update the author register, verification methods, counts and relevant LEFT OUT explanations to the current library. Distinguish fever, now covered, from the remaining systemic-illness gap in R02. Preserve genuine exclusions; do not remove all limits just because the inventory grew.

### R07. One extra NIN locator points to the wrong printed page

**Severity: minor. Claim: `fd-whole-grains`.**

**Code:** its support entry in `src/content/claims/food.ts` names “My Plate for the Day (p. 5)”. In the fetched DGI-2024 PDF the My Plate heading and material are on **printed page 6**.

**Observed:** the first locator, Guideline 1, printed page 1, correctly supports the half-whole/minimally polished grain principle, so the substantive claim remains SUPPORTED. The additional page locator is inaccurate.

**Fix:** change that extra locator to printed page 6, or remove it because page 1 already supplies the needed support. Use printed page numbers consistently rather than PDF file-page indices.

## Source verdicts for all 21 new claims

**SUPPORTED** means the substantive statement has support in an applicable cited source and locator. For a claim marked `policy`, the source supplies the clinical foundation while the additional app rule is explicitly identified as the app's choice. It does not mean the source mandates that extra rule. Presentation and missing urgency exceptions are assessed separately above.

| Claim | Verdict | Cited source and locator | Source check |
|---|---|---|---|
| `ckd-protein` | SUPPORTED | [NIDDK CKD][NIDDK-CKD], Protein; choosing amounts/types; Potassium | Individual protein needs, the harm of too little protein and potentially greater needs during dialysis are explicit. This is not a prescribed restriction or an instruction to increase total protein. |
| `food-safety-sprouts` | SUPPORTED | [CDC food safety][CDC-FOOD], Why it is important; vegetables/fruits | Diabetes and CKD are named risk conditions. The source contrasts “Any raw or undercooked sprouts” with “Cooked sprouts”. Washing produce does not replace cooking sprouts. |
| `fd-meds-timing` | SUPPORTED | [NIDDK low glucose][NIDDK-LOW], Causes; Prevention; [ADA 2026 §5][ADA5], recommendation 5.28 | NIDDK names insulin, sulfonylureas and meglitinides and warns about “skip or delay any meals” and fasting. ADA 5.28 concerns consistent carbohydrate timing/amount with fixed insulin. The broader secretagogue caution comes from NIDDK, not an invented extension of 5.28. |
| `sglt2-keto` | OVERSTATED | [ADA 2026 §5][ADA5], 5.26; [empagliflozin label][EMPA] and [dapagliflozin label][DAPA], §17 ketoacidosis | The ketogenic-diet risk is supported. ADA's recommendation names people with diabetes at DKA risk, while the statement attributes it to all SGLT2 users. FDA label warnings support the broader clinical caution. R05 gives the correction. |
| `sglt2-plan` | SUPPORTED | [ADA 2026 §5][ADA5], 5.26; [EMPA][EMPA]/[DAPA][DAPA], §17 and Medication Guide | The labels name reduced caloric intake, illness/infection, dehydration and alcohol abuse as precipitating conditions. They instruct education of all patients. Referring fasting, illness and ketone planning to the care team is appropriate. |
| `sglt2-dka-signs` | SUPPORTED | [EMPA][EMPA]/[DAPA][DAPA], §17 ketoacidosis | Labels explicitly say “blood glucose may be normal even in the presence of ketoacidosis” and list nausea, vomiting, abdominal pain, tiredness and laboured breathing with immediate medical attention. The app does not repeat their medication-discontinuation instruction. |
| `fast-ada` | SUPPORTED | [ADA 2026 §5][ADA5], 5.32 and 5.33 | These recommendations support prefasting risk assessment and professional review of treatment/timing well before religious fasting. The app does not choose a dose, schedule or universal prohibition. |
| `fast-plan` | SUPPORTED | [ADA 2026 §5][ADA5], 5.33; [NIDDK low glucose][NIDDK-LOW], Causes; Prevention | ADA covers religious fasting; NIDDK explicitly discusses fasting for medical procedures or other reasons while taking glucose-lowering medicines. The combined references support the wider care-team planning statement. |
| `fast-lows` | SUPPORTED | [NIDDK low glucose][NIDDK-LOW], Causes | Fasting with continued glucose-lowering medicines can cause hypoglycaemia. Its `hypoRisk` applicability supplies the relevant medication-risk context. |
| `b12-low-animal-route` | SUPPORTED | [ODS B12][ODS-B12], Foods; Getting enough; [NIN 2024][NIN], Guideline 1, printed p. 2 | ODS describes animal foods, fortified foods and supplements; plant foods do not naturally supply B12. NIN notes vegetarian difficulty and the small amount in milk. “If you eat them” and the care-team route avoid instructing a vegan to eat dairy/eggs. |
| `b12-absorb` | SUPPORTED | [ODS B12][ODS-B12], Getting enough; medicine interactions; [NICE NG239][NG239], Box 2; 1.5.3 to 1.5.6 and 1.5.11 to 1.5.14 | These sources cover malabsorption, relevant medicines, gastrointestinal conditions/surgery and replacement treatment. Food alone is not presented as treatment of a known deficiency. No replacement dose or route is chosen by the app. |
| `b12-ask-monitoring` | SUPPORTED | [ADA 2026 §3][ADA3], 3.10 | Periodic assessment with long-term metformin is supported. Asking about monitoring even while well correctly separates it from symptom-led diagnostic testing and invents no interval. |
| `desk-seated-change` | SUPPORTED | [OSHA positions][OSHA-POS], Changing position | Adjusting chair/backrest and stretching hands, arms and torso are source examples. This is a seated alternative, not a claim that it has the same glycaemic effect as walking. Foot offloading remains a separate precaution. |
| `emergency-heart` | SUPPORTED | [NHLBI heart attack][HEART], Symptoms; When to call 9-1-1 | Chest pressure/discomfort, breathing symptoms and immediate help even if unsure are supported. NHLBI says “Never ignore chest discomfort or pain.” Collapse/not recovering normally is expressly **this app** policy, not falsely attributed to the heart-attack page. |
| `stroke-signs` | SUPPORTED | [CDC stroke][STROKE], Signs; Emergency help; TIA; [NICE NG127][NG127], 1.7.1 | Sudden one-sided weakness/numbness and speech, vision or balance changes are covered. NICE includes sudden weakness restricted to one hand. CDC says suspected TIA still needs immediate care, so passing symptoms are not reassurance. |
| `back-ces` | SUPPORTED | [NICE NG127][NG127], 1.7.3 | The source says “Refer immediately” for severe low back pain radiating into a leg plus new bladder/bowel/sexual dysfunction or perineal numbness. The text states that population and explicitly labels the mild-pain extension **this app** policy. It does not ask the reader to wait. |
| `back-leg-weakness` | SUPPORTED | [NICE NG127][NG127], 1.7.4 and 1.7.5 | Referral for rapidly progressive single-limb weakness is described accurately. Same-day assessment and withholding exercise are explicitly app policy. The missing rapid-progression/bilateral emergency exceptions are R02, not a claim that NICE mandates emergency care for every foot drop. |
| `back-fever` | SUPPORTED | [NIAMS back pain][NIAMS], Symptoms; [NICE NG59][NG59], 1.1.1 | NIAMS includes fever among reasons to see a doctor; NICE requires consideration of infection/other diagnoses. The source does not itself specify “today”. That conservative timing and the no-exercise rule are expressly **this app** policy. The broader unwell presentation is still missing, R02. |
| `back-see-doctor` | SUPPORTED | [NIAMS back pain][NIAMS], Symptoms | The source includes injury/fall, severe pain not improving with medicine and unintended weight loss. This is appropriate assessment advice, but is not a complete triage rule for major trauma or every urgent pain presentation. |
| `back-changed` | SUPPORTED | [NICE NG59][NG59], 1.1.1 | New or changed symptoms require consideration of alternative diagnoses and serious causes. This routine statement must not replace the urgent systemic/neurological exceptions in R02. |
| `steps-more` | SUPPORTED | [Banach 2023][BANACH], abstract Results; Conclusion | The review reports an inverse association between daily steps and mortality. The current claim does not turn the reference-quartile median into an onset of benefit or clinical target. |

## Source verdicts for all 36 changed claims

Six of these changes only replace citations, `fd-plate-method`, `fd-plate-size`, `salt-table`, `bp-meds-potassium`, `desk-eyes` and `alc-no-safe`. They are included because a citation change still needs verification.

| Claim | Verdict | Current cited source and locator | Source check |
|---|---|---|---|
| `fd-whole-grains` | SUPPORTED | [NIN 2024][NIN], Guideline 1, printed p. 1; extra My Plate locator | NIN supports at least half the cereals being whole/minimally polished. Millet is now qualified by processing, rather than automatically counting a refined millet product. The extra p. 5 locator needs the p. 6 correction in R07. |
| `fd-portion-refined` | SUPPORTED | [ADA plate][PLATE], step 3 | The carbohydrate quarter supports the rice example. This is an authored application of the plate structure, not a sourced gram or roti-count prescription. |
| `fd-fibre` | SUPPORTED | [ADA 2026 §5][ADA5], 5.14 and 5.24 | Minimally processed high-fibre carbohydrate sources are supported. Curd has been removed from the fibre list. |
| `fd-plant-protein` | SUPPORTED | [ADA 2026 §5][ADA5], 5.29 | The recommendation supports plant protein within diverse foods for people with diabetes/at risk. The new attached kidney qualification prevents treating it as an increase in total protein for CKD. |
| `fd-two-three-meals` | SUPPORTED | [NIN 2024][NIN], Guideline 1, printed p. 2 | Two/three meals without snacks is present in the source. The claim now labels it general advice for healthy people, and the medicine-plan exception accompanies its use. |
| `fd-supplements` | SUPPORTED | [ADA 2026 §5][ADA5], 5.16 | Recommendation-level support covers vitamins/minerals and herbs/spices for glycaemic benefit. The claim does not tell someone to abandon treatment of a deficiency. |
| `walk-meals-study` | SUPPORTED | [Reynolds 2016][REYNOLDS], abstract Methods; Results | The abstract has 41 adults, two-week periods, and three-hour glucose iAUC ratios 0.88 and 0.78. About 12% and 22% lower cumulative rise follows from those ratios. The current text describes the three-hour total, not a reduction in a peak or individual meter reading. |
| `walk-meals-limits` | SUPPORTED | [Reynolds 2016][REYNOLDS], abstract Methods; Results | Two-week intervention periods and group averages support the short-term limitation. No individual glucose prediction is supplied. |
| `walk-carry-sugar` | SUPPORTED | [NIDDK low glucose][NIDDK-LOW], Causes; Prevention; [ACSM 2022][ACSM], table 4 | NIDDK covers checks before/during/after activity and glucose lowering for “up to 24 hours”; ACSM covers rapid carbohydrate. The app defers check details to the care plan instead of inventing a universal interval. |
| `walk-foot-wound` | SUPPORTED | [ACSM 2022][ACSM], table 5, peripheral neuropathy | The non-weight-bearing foundation is present, including no aquatic exercise with unhealed plantar ulcers. Active-wound/Charcot withholding until care-team clearance is explicitly **this app** policy. It no longer requires neuropathy plus an ulcer or sounds optional. |
| `salt-flavour` | SUPPORTED | [WHO sodium][SODIUM], How to reduce intake | The source recommends herbs/spices in place of salt. Ginger, pepper, turmeric and jeera are sensible authored examples, not a supplement dose or claim of a medicinal effect. |
| `bp-dash-what` | SUPPORTED | [NHLBI DASH][DASH], Overview | The listed vegetables, fruit, whole grains, low-fat dairy, fish/poultry, beans/nuts and limits on saturated fat/sugar/salt match the overview. Kidney potassium cautions remain separate. |
| `lsss-what` | SUPPORTED | [WHO salt substitutes 2025][LSSS], Executive summary, background | WHO says substitutes “often include potassium chloride”. “Many” now reflects that qualification; checking the label and kidney/medicine safeguards remain appropriate. |
| `b12-metformin-yearly` | SUPPORTED | [ADA 2026 §3][ADA3], discussion associated with 3.10 | The discussion supports annual testing after more than four years or with other risk factors such as vegan eating. The text explicitly identifies discussion rather than claiming that the numbered recommendation mandates that interval for everyone. |
| `d-vegan` | SUPPORTED | [ODS vitamin D professional][ODS-D-HP], Vitamin D Deficiency | This is the correct section for greater deficiency prevalence with vegan eating, milk allergy or lactose intolerance. The sentence no longer substitutes a dietary-intake comparison or diagnoses the reader's level. |
| `d-diabetes` | SUPPORTED | [ODS vitamin D consumer][ODS-D], Type 2 diabetes; [ADA 2026 §5][ADA5], 5.16; [Endocrine Society 2024][ENDO], recommendation 10 | The glucose/HbA1c trial summary and recommendation against supplements for glycaemic benefit are supported. Clinician-selected high-risk prediabetes prevention and deficiency treatment are expressly separated. No dose is supplied. |
| `sit-30` | SUPPORTED | [ADA 2026 §5][ADA5], 5.34 | The numbered recommendation supplies interruption of prolonged sitting at least every 30 minutes. The app does not claim that one exact kind/duration of break is universally necessary. |
| `water-hot-weather` | SUPPORTED | [NIN 2024][NIN], Guideline 14, printed p. 92; [ADA 2026 §5][ADA5], 5.25; [WHO sodium][SODIUM], reduction recommendations | NIN names the Indian drink examples, ADA supports replacing sugar-sweetened drinks, and WHO covers all dietary salt. Added salt is now counted. The generic water card is hidden for fluid-caution profiles. |
| `water-safe` | SUPPORTED | [NIN 2024][NIN], Guideline 14, printed pp. 89 and 92; [CDC water][CDC-WATER], fuel/toxic chemicals | NIN's fuller explanation says boiling “will not remove chemical impurities”. CDC says boiling/disinfection cannot make chemically contaminated water safe and advises bottled/other safe water and local advice. No improvised chemical-treatment recipe is supplied. |
| `fluid-swelling` | SUPPORTED | [NHLBI heart failure][HF], Know when to seek help; [NIDDK CKD][NIDDK-CKD], Track your liquids | The symptoms and action-plan contact are supported. Prompt contact and “don't wait” now distinguish these from a routine visit; emergency chest/breathing/stroke/collapse advice precedes the fluid actions. No invented weight-gain threshold or diuretic change appears. |
| `back-walkback` | SUPPORTED | [WalkBack 2024][WALKBACK], abstract Methods; Findings | Eligibility was recovery from non-specific low back pain, and the endpoint was an “activity-limiting” recurrence. The 208/112-day medians are correct and now carry those limits. |
| `back-walkback-limits` | SUPPORTED | [WalkBack 2024][WALKBACK], abstract Methods; Findings | Between-episode eligibility and more lower-extremity adverse events support the stated limits. It is not presented as treatment evidence for an acute sciatica flare. |
| `steps-ding` | SUPPORTED | [Ding 2025][DING], abstract Findings | About 7,000 versus 2,000 steps is associated with 47% lower all-cause mortality and 14% lower incident type 2 diabetes. The text says association, does not promise reversal of existing diabetes and does not extrapolate an age-specific personal benefit. |
| `alc-sglt2` | SUPPORTED | [EMPA][EMPA]/[DAPA][DAPA], §17; Medication Guide | Alcohol abuse is named as a ketoacidosis trigger. The broader warning no longer relies on an ADA narrative locator pretending to be a recommendation-level alcohol statement. |
| `alc-delayed-lows` | SUPPORTED | [ADA 2026 §5][ADA5], 5.19; [NIDDK low glucose][NIDDK-LOW], Causes; Prevention | Delayed alcohol-related hypoglycaemia, especially with insulin/secretagogues, and monitoring are supported. NIDDK supplies eating with alcohol. The app refers increased checking to the care plan, with no dose adjustment. |
| `tob-avoid` | SUPPORTED | [ADA 2026 §5][ADA5], 5.40 | Complete tobacco/vaping avoidance is the recommendation for people with diabetes. |
| `tob-benefit` | SUPPORTED | [CDC quitting][QUIT], Health benefits | Benefits at any age and as much as ten additional years of life are present. This is a potential population benefit, not a personal guarantee. |
| `tob-chewed` | SUPPORTED | [WHO tobacco][TOBACCO], Key facts; Overview | WHO states all forms are harmful and includes smokeless tobacco and bidis. The source supports no safe exposure level. |
| `tob-vape` | SUPPORTED | [ADA 2026 §5][ADA5], 5.40 | It accurately identifies ADA's advice for people with diabetes. It no longer purports to settle every country's general cessation policy. |
| `tob-tell-doctor` | SUPPORTED | [ADA 2026 §5][ADA5], 5.40 | Routine ascertainment of tobacco/vaping and cessation support supports inviting the reader to raise it. |
| `fd-plate-method` | SUPPORTED | [ADA plate][PLATE], steps 1 to 3 | The half vegetables/quarter protein/quarter carbohydrate structure is present. Removing the extra Standards narrative citation preserves the actual source. |
| `fd-plate-size` | SUPPORTED | [ADA plate][PLATE], introduction | Nine inches is explicit; 23 cm is a reasonable rounded conversion. This remains a plate geometry example, not a fabricated nutrient amount. |
| `salt-table` | SUPPORTED | [WHO sodium][SODIUM], How to reduce intake | Less cooking salt and removing salt from the table are explicit. The redundant ADA narrative citation is gone. |
| `bp-meds-potassium` | SUPPORTED | [ADA 2026 §10][ADA10], 10.11 | The recommendation covers potassium/eGFR monitoring with ACE inhibitors, ARBs and mineralocorticoid receptor antagonists. Spironolactone is an appropriate MRA example; the app does not change treatment. |
| `desk-eyes` | SUPPORTED | [OSHA monitors][OSHA-MON], Viewing time | Looking at distant objects and blinking are in the now-correct locator. There is no invented 20/20/20 clinical rule. |
| `alc-no-safe` | SUPPORTED | [WHO Europe alcohol 2023][ALCOHOL], headline statement | WHO explicitly states no level is safe for health. The redundant ADA narrative attribution is removed. |

## Reconciliation of F01 to F25

The test references below are to the existing tests I executed. A passing assertion is evidence of its actual coverage, not independent proof of source accuracy or every consumer.

| Original finding | Result | Current evidence and remaining limit |
|---|---|---|
| **F01**, fluid restriction fails to reach Guide | **FIXED** | `personalise.ts:57` uses the canonical `fluidRestriction` resolver. True and unsure hide generic water advice and withhold the water habit, with truthful reasons. An explicit profile false overrides legacy true, while an absent answer uses the legacy value. `useGuide.ts:35` rebuilds context on profile/food/fluid-setting changes. `audit.test.ts:34` and probe C01 cover cards, search, related links and habit offers. `CardScreen.tsx:32` selects a redirect for hidden direct URLs; the static component probe does not claim to have executed browser navigation. |
| **F02**, reused movement advice loses cautions | **PARTLY FIXED** | `resolveGroups`, `personalise.ts:209`, attaches relevant cautions and resolves foot-wound substitutions. Insulin/secretagogue precautions are present across the Guide movement graph, active-wound walking/standing instructions are replaced, and the sun caution travels with `d-get-outside`. `audit.test.ts:73` and probes C02/C09 confirm this. The actual scheduler/calendar consumers still bypass the protections, R03. |
| **F03**, active-foot restriction sounds optional | **FIXED** | `walk-foot-wound` now explicitly says **this app** withholds affected-foot weight-bearing movement until care-team clearance. It covers wound or active Charcot without requiring confirmed neuropathy. It does not automatically offer swimming. `audit.test.ts:137` plus ACSM tables 4/5 verification. |
| **F04**, incomplete/back-loaded back red flags | **PARTLY FIXED** | New CES, stroke, single-leg weakness and fever claims are correctly sourced and visibly separated into emergency/same-day blocks. CES no longer requires severe pain for the app rule. `audit.test.ts:155` passes, but omits one back card, opening movement answers and several contract urgency exceptions. Actual component renders and the claim/contract comparison establish R01/R02. |
| **F05**, breathlessness gets routine-contact wording | **FIXED** | The fluid-limit card has emergency heart/stroke instructions, followed by prompt fluid-related contact, before its fluid actions. `fluid-swelling` says not to wait for a routine visit. `audit.test.ts:196` and C12 verify block order. It gives no extra-fluid/diuretic instruction or invented weight threshold. |
| **F06**, no-snack advice lacks medicine exception | **FIXED** | `fd-two-three-meals` is labelled healthy-person general advice; `fd-meds-timing` and fixed-insulin guidance accompany meal introduction, snack note, meal detail and sample week through `resolveGroups`. `audit.test.ts:208` passes. Actual meal-list/detail/week component renders, C11, contain the plan exception for an insulin fixture. NIDDK covers secretagogues/fasting; no medication schedule is chosen. |
| **F07**, SGLT2 diet/fasting safety absent | **FIXED**, with new attribution issue R05 | Keto/illness/fasting precautions and normal-glucose DKA symptoms now appear, including the new fasting card. Relevant diet-change cards carry them. `audit.test.ts:223` and FDA/ADA verification. There is no blanket fasting ban, drug-stop instruction or fluid amount. Qualify the ADA population as specified in R05. |
| **F08**, raw-sprout ambiguity | **FIXED** | Sprout chaat and the poha alternative explicitly use cooked sprouts, and `food-safety-sprouts` travels with the relevant guidance. CDC supplies the safety distinction. `audit.test.ts:245`. No unsupported cooking temperature/time is added. |
| **F09**, plant-protein increase lacks CKD context | **FIXED** | `ckd-protein` accompanies the relevant protein guidance for kidney/unknown-health contexts. It covers total protein, potassium and dialysis variation without grams or a blanket restriction. `audit.test.ts:260` and the NIDDK source. |
| **F10**, boiling loses chemical-contamination limit | **FIXED** | `water-safe` explicitly distinguishes germs from chemicals and sends suspected chemical contamination to a safe source/local authority. `audit.test.ts:268`; NIN printed p. 89 and CDC water advice. |
| **F11**, curd classified as high fibre | **FIXED** | Curd is removed from `fd-fibre`; the current list and ADA 5.14/5.24 distinction are supported. `audit.test.ts:276`. |
| **F12**, millet name substitutes for whole grain | **FIXED**, minor locator R07 | Whole/minimally polished qualification now applies to millet; a refined millet biscuit does not qualify automatically. `audit.test.ts:280`; NIN printed p. 1. Correct the extra My Plate page locator. |
| **F13**, Reynolds endpoint/duration overstated | **FIXED** | Two weeks for each intervention and the following three-hour cumulative glucose outcome replace the peak/spike implication. Group-average limits accompany it. `audit.test.ts:285`; official abstract PMID 27747394. |
| **F14**, WalkBack broadened to any recurrence/sciatica | **FIXED** | Recovery from non-specific pain, activity-limiting recurrence, supported progression and lower-extremity adverse events are now stated. It disclaims acute-flare treatment evidence. `audit.test.ts:291`; PMID 38908392. |
| **F15**, reference steps become a benefit floor | **FIXED** | `steps-floor` is removed; `steps-more` describes association without a minimum. Ding's all-cause/incidence endpoints and absence of personal age predictions are explicit. `audit.test.ts:297`; PMIDs 37555441/40713949. Board D27 now acknowledges the correction. |
| **F16**, vitamin D summary dismisses individual indications | **FIXED** | Glycaemic benefit, deficiency treatment and Endocrine Society's high-risk prediabetes prevention recommendation are separated. The undifferentiated prediabetes personalisation is removed. `audit.test.ts:304`; ODS, ADA 5.16 and Endocrine recommendation 10. No dose. |
| **F17**, vegan vitamin D fact points to wrong section | **FIXED** | The claim now cites Vitamin D Deficiency and describes group prevalence, not dietary intake or the reader's diagnosis. `audit.test.ts:311`; ODS professional page via the recorded text-rendering path. |
| **F18**, every salt substitute portrayed as potassium-containing | **FIXED** | “Many” and label checking replace the universal statement. Potassium/medicine/kidney cautions remain. `audit.test.ts:316`; WHO 2025 background. |
| **F19**, ADA narrative/table citations violate D32 | **FIXED** | Citations move to matching recommendations or different primary sources. `sourcesFor`, `src/content/library.ts:103`, respects `citeBy`; recommendation extraction begins at line 69. Rendered Standards locators are recommendation numbers. The B12 annual detail is labelled discussion in its authored text rather than falsely assigned to the recommendation sentence. `audit.test.ts:321`, library tests and actual source-group render. |
| **F20**, vegan meal names/components disagree | **FIXED** | Salad is renamed `s-salad-seeds`; vegan search no longer offers it as curd. Upma has a dal/pulse protein component surviving vegan filtering. `audit.test.ts:352` and C09. No fabricated nutrient values or portions. |
| **F21**, Devanagari disappears and exclusions falsely succeed | **PARTLY FIXED** | `src/content/text.ts:18` retains Unicode letters/marks; search aliases work for `मधुमेह`, `मूंगफली`, `दाल` and `व्रत`. Unsupported nonempty script returns no matches rather than every topic. A peanut leave-out in Devanagari excludes peanut meals; a genuinely unknown term shows a note. `audit.test.ts:365`, C04. The new compound-entry confirmation fails in R04; the warning tests do not cover that case. |
| **F22**, partial search answers hide missing words | **FIXED** | Search exposes matched/missing terms; the screen labels partial answers and says when no answer covers every word. `audit.test.ts:391`, formatting tests and actual Guide render C11. `fasting insulin` now finds the dedicated fasting card. This remains word matching, not a clinical interpretation of queries such as “no salt”. |
| **F23**, medicine reasons invent certainty/classes | **FIXED** | `personalise.ts:85` restates insulin/secretagogue uncertainty and type 1 correctly; lines 92 to 98 distinguish known, unsure and unreviewed SGLT2 medicines. `audit.test.ts:405` verifies the actual reason strings. Conservative caution is retained without inventing a medicine. |
| **F24**, source footer promises no information leaves | **FIXED** | `src/screens/guide/format.ts:68` narrows the statement to profile/readings not included in the link. `parts.tsx:99` renders it; external links retain `noopener noreferrer` and static source URLs. Formatting tests verify the revised copy. No promise about ordinary browser/network information remains. |
| **F25**, B12 food/testing advice misses monitoring and vegan route | **FIXED** | The test card includes monitoring even while well. The food action swaps to fortified foods/care-team advice for low-animal-food patterns and carries the absorption/known-deficiency warning. `audit.test.ts:422`, C12 actual B12 renders, ODS/NICE and ADA 3.10 verification. It chooses no dose or replacement route. |

## Checked and correct

- **Emergency wording:** chest/breathing and stroke instructions say to obtain help immediately. Transient stroke symptoms are not clearance. CES includes bladder, bowel, sexual and saddle/perineal changes; the text accurately names NICE's severe-radiating-pain population and separately declares the app's mild-pain policy. The remaining issues are ordering and missing exceptions, not wording that asks a person with CES or suspected stroke to wait.
- **Five declared app policies identify the app:** `walk-foot-wound`, `emergency-heart`, `back-ces`, `back-leg-weakness` and `back-fever` all say “this app”. Source recommendations and extra conservative rules are not silently conflated. R02 identifies exceptions that still need reconciliation.
- **SGLT2 and fasting:** both FDA labels support normal-glucose DKA, illness/reduced-intake/alcohol triggers and prompt help. Fasting is referred to professional risk assessment and the person's plan; neither the new card nor the changed claims prescribe stopping a drug, a medication dose, a fasting ban or extra water.
- **Medicine and meals:** the no-snack claim is general-population advice. Insulin/secretagogue users receive their agreed meal/snack-plan exception across the rendered meal entry points. Fixed-insulin consistency is attributed to ADA 5.28; the broader skipping/delaying/fasting risk is grounded in NIDDK.
- **Fluid restriction:** true/unsure canonical answers suppress generic water advice; explicit false supersedes a legacy true when there is no separate kidney/heart caution. Kidney/heart uncertainty remains conservative. The fluid-limit card gives no universal amount and distinguishes emergency symptoms from prompt action-plan contact.
- **Indian food:** cooked sprouts, dal/pulse protein, pattern-neutral names and retained optional dairy make the changed templates sensible across vegetarian, eggetarian, non-vegetarian and vegan variants. Authored salt/spice examples do not claim medicinal effects. The existing sourced plate measures remain the portion framework, with no IFCT nutrient database, roti counts or glycaemic predictions.
- **Evidence limits:** Reynolds' result is short-term and group-level; WalkBack concerns recovered non-specific pain; step-count results are observational. No benefit floor, automatic step-goal increase or claim that 10,000 is a guideline was introduced by these fixes. The Guide remains consistent with the user-owned goals in D27/D31.
- **Attribution/reuse:** the current claim support graph contains no NHS source. NHS links remain further reading. Displayed claims are authored summaries; I found no reproduced ADA/NIN/IFCT table or copied ADA passage in the changed content. This checks the stated D32 implementation, not a general legal clearance for all source use.
- **Search:** supported Devanagari is preserved, unmatched script is not treated as an empty query, and partial matches are identified in actual rendered Guide output. Preference filtering explicitly disclaims allergy/cross-contact checking. R04 concerns a separate false confirmation, not a regression to deleting Devanagari.

## Source access references

These links identify the primary pages/PDFs used above. Recommendation numbers and headings in the claim tables are the checked locators. Pages without a reliable publication year are identified as current pages accessed on the review date rather than assigned an invented year.

| Source records | Edition/access and check |
|---|---|
| `ada-soc-2026-s3`, `ada-soc-2026-s5`, `ada-soc-2026-s10` | ADA Standards of Care 2026, [§3][ADA3], [§5][ADA5], [§10][ADA10]; full PMC pages, direct. |
| `ada-diabetes-plate` | [ADA Diabetes Plate][PLATE], current authored public page, direct. |
| `nin-dgi-2024` | [ICMR-NIN Dietary Guidelines for Indians 2024][NIN], official PDF, direct; printed page numbering checked. |
| `label-empagliflozin` | [FDA Jardiance label][EMPA], revised October 2025, reference ID 5683490; §17 and Medication Guide, direct PDF. |
| `label-dapagliflozin` | [FDA Farxiga label][DAPA], revised June 2026, reference ID 5809243; §17 and Medication Guide, direct PDF. |
| `niddk-low-glucose`, `niddk-ckd-eating` | [Low glucose][NIDDK-LOW], [CKD eating][NIDDK-CKD]; named headings, direct. |
| `cdc-food-safety`, `cdc-water-emergency`, `cdc-stroke`, `cdc-quit-benefits` | [Food safety][CDC-FOOD], [water emergency][CDC-WATER], [stroke][STROKE], [quitting benefits][QUIT]; current pages, direct. |
| `nhlbi-dash`, `nhlbi-heart-attack`, `nhlbi-heart-failure` | [DASH][DASH], [heart-attack symptoms][HEART], [living with heart failure][HF]; current pages, direct. |
| `nice-ng127`, `nice-ng59`, `nice-ng239` | NICE [NG127][NG127] (2019), [NG59][NG59] (2016), [NG239][NG239] (2024); current recommendation pages, direct. |
| `niams-back-pain` | [NIAMS back pain][NIAMS], Symptoms section, direct. |
| `osha-positions`, `osha-monitors` | OSHA eTool [positions][OSHA-POS], [monitors][OSHA-MON], direct. |
| `ods-b12`, `ods-vitamin-d`, `ods-vitamin-d-hp` | [B12 consumer][ODS-B12], [D consumer][ODS-D], [D professional][ODS-D-HP]; direct 403, verified through text renderings of those URLs. |
| `endocrine-vitamin-d-2024` | [Endocrine Society 2024 guideline][ENDO], recommendation 10, direct. |
| `who-sodium-2026`, `who-lsss-2025`, `who-alcohol-2023`, `who-tobacco` | [Sodium][SODIUM], [2025 lower-sodium substitutes guideline][LSSS], [2023 alcohol statement][ALCOHOL], [tobacco][TOBACCO]; direct pages/PDF. |
| `acsm-2022` | [ACSM consensus 2022][ACSM], full PMC text and tables 4/5, direct. |
| `reynolds-2016`, `walkback-2024`, `ding-2025`, `banach-2023` | PMIDs [27747394][REYNOLDS], [38908392][WALKBACK], [40713949][DING], [37555441][BANACH]. Direct PubMed challenge; official [NCBI XML abstracts][NCBI-XML] checked. Full papers not checked. |

## Skipped checks and release retests

Fresh shell launches failed at sandbox initialisation with `sandbox-exec: sandbox_apply: Operation not permitted`. I did not request elevated access. Reading, fetching and in-memory execution continued through the existing process. I skipped a normal Vitest CLI launch, real-browser/device checks, screenshots, and interactive save/reload/export-to-Calendar journeys. The calendar finding is proved in the actual event-generation output; acceptance by the iOS Calendar application was not tested here.

Before release, require these observable retests:

1. Every back-topic card, including `card-activity`, renders applicable urgent guidance before its first movement instruction, whether that instruction is an answer, note, action or link.
2. The back content explicitly distinguishes ordinary new unilateral weakness, rapid deterioration, new bilateral sensory symptoms, and systemic/rapidly worsening pain. It matches the app's agreed emergency/today categories while accurately naming the narrower source recommendations.
3. An active-foot-wound/Charcot profile with already-enabled habits receives no standing/walking prompt in the in-app scheduler, banner or generated calendar events. Any seated replacement states its restriction. Permitted insulin/secretagogue movement reminders retain the medicine precautions.
4. Vegetarian leave-out entries `peanut chutney` and `coconut milk` produce an unmatched explanation when no meal is excluded; the summary must not claim “no …”. Re-run the working `मूंगफली` exclusion, unknown-script and single-food cases.
5. `sglt2-keto` distinguishes the ADA diabetes population from label-based warnings applying to other SGLT2 users. No medication-stop, dose, fasting-ban or fluid-amount advice is introduced.
6. The author register matches 183 claims/43 sources/30 cards, records the new verification methods, and updates the contradictory LEFT OUT notes. Correct the extra NIN My Plate locator.

[ADA3]: https://pmc.ncbi.nlm.nih.gov/articles/PMC12690170/
[ADA5]: https://pmc.ncbi.nlm.nih.gov/articles/PMC12690188/
[ADA10]: https://pmc.ncbi.nlm.nih.gov/articles/PMC12690187/
[PLATE]: https://diabetesfoodhub.org/blog/what-diabetes-plate
[NIN]: https://www.nin.res.in/dietaryguidelines/pdfjs/locale/DGI_2024.pdf
[EMPA]: https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/204629s063lbl.pdf
[DAPA]: https://www.accessdata.fda.gov/drugsatfda_docs/label/2026/202293s035lbl.pdf
[NIDDK-LOW]: https://www.niddk.nih.gov/health-information/diabetes/overview/preventing-problems/low-blood-glucose-hypoglycemia
[NIDDK-CKD]: https://www.niddk.nih.gov/health-information/kidney-disease/chronic-kidney-disease-ckd/healthy-eating-adults-chronic-kidney-disease
[CDC-FOOD]: https://www.cdc.gov/food-safety/foods/weakened-immune-systems.html
[CDC-WATER]: https://www.cdc.gov/water-emergency/about/index.html
[STROKE]: https://www.cdc.gov/stroke/signs-symptoms/index.html
[QUIT]: https://www.cdc.gov/tobacco/about/benefits-of-quitting.html
[DASH]: https://www.nhlbi.nih.gov/education/dash-eating-plan
[HEART]: https://www.nhlbi.nih.gov/health/heart-attack/symptoms
[HF]: https://www.nhlbi.nih.gov/health/heart-failure/living-with
[NG127]: https://www.nice.org.uk/guidance/ng127/chapter/recommendations-for-adults-aged-over-16
[NG59]: https://www.nice.org.uk/guidance/ng59/chapter/Recommendations
[NG239]: https://www.nice.org.uk/guidance/ng239/chapter/recommendations
[NIAMS]: https://www.niams.nih.gov/health-topics/back-pain
[OSHA-POS]: https://www.osha.gov/etools/computer-workstations/positions
[OSHA-MON]: https://www.osha.gov/etools/computer-workstations/components/monitors
[ODS-B12]: https://ods.od.nih.gov/factsheets/VitaminB12-Consumer/
[ODS-D]: https://ods.od.nih.gov/factsheets/VitaminD-Consumer/
[ODS-D-HP]: https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/
[ENDO]: https://www.endocrine.org/clinical-practice-guidelines/vitamin-d-for-prevention-of-disease
[SODIUM]: https://www.who.int/news-room/fact-sheets/detail/sodium-reduction
[LSSS]: https://iris.who.int/server/api/core/bitstreams/31fad89a-d7c2-450c-9b74-cd2a8752e60f/content
[ALCOHOL]: https://www.who.int/europe/news/item/04-01-2023-no-level-of-alcohol-consumption-is-safe-for-our-health
[TOBACCO]: https://www.who.int/news-room/fact-sheets/detail/tobacco
[ACSM]: https://pmc.ncbi.nlm.nih.gov/articles/PMC8802999/
[REYNOLDS]: https://pubmed.ncbi.nlm.nih.gov/27747394/
[WALKBACK]: https://pubmed.ncbi.nlm.nih.gov/38908392/
[DING]: https://pubmed.ncbi.nlm.nih.gov/40713949/
[BANACH]: https://pubmed.ncbi.nlm.nih.gov/37555441/
[NCBI-XML]: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=37555441,27747394,38908392,40713949&retmode=xml

**Release verdict: ship after listed fixes.** The source repair is largely successful and the existing tests pass, but R01 to R04 still expose a reader to contradictory safety guidance or a false exclusion confirmation. Resolve those concrete failures and the attribution/documentation corrections before the owner sees the Guide.
