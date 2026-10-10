# Market analysis: which health-app features earn their place

[claude] 2026-10-08 · **revision 2**. Board research pass 3 of 4, answering open question **Q4** — *which features in the best health apps earn their place, and which are clutter?*

Companions: `docs/reimagine/claude-inventory.md` (what we already have), `docs/reimagine/codex-vision.md` (the product proposal this document tests), `docs/research/frontend-only-health-platform.md` (iOS PWA capability; **authoritative over §5 here**), `docs/research/clinical-tracking-protocols.md` (codex; owns tracking cadence — this document does not set cadence).

## How to read this

Every claim carries a link. A line that reasons rather than cites starts **INFERENCE**. The three evidence classes are not equal:

| Class | What it is | Weight |
|---|---|---|
| **Primary measured** | Peer-reviewed studies with n and effect sizes; Apple, WebKit and manufacturer documentation | Decides things |
| **Primary user text** | Verbatim App Store reviews from the iTunes review feed, pulled 2026-10-08; public ratings counts | Shows what annoys people. Reviewers are the angry and the delighted, so this shows themes and exact wording, not prevalence |
| **Market observation** | Listings, descriptions, ratings | Shows what the market believes, not what works |

Ratings are as at 2026-10-08, US storefront unless marked `IN`. Review quotes are verbatim and truncated, with their star rating.

### Method, revisions and limits

- **Revision 2.** Four parallel research passes — Apple Health and Fitness; diabetes and the Indian market; minimal trackers; walking — landed after revision 1 was delivered. Their findings are folded in, and **every quote and number taken from them was re-checked at source before use**:
  - review text against the iTunes feed (roughly 200–1,000 reviews scanned per app);
  - papers against Crossref and PubMed or Europe PMC;
  - Apple and vendor pages read directly;
  - the Dexcom G7 manual, the FreeStyle Libre 3 Plus guide and the IFCT 2017 book downloaded and text-searched.

  Anything I could not re-check is left out or marked.
- **Corrections to revision 1**, so nobody builds on the old text:
  - Gentler Streak's states were misnamed; the real model is in §1.3.
  - Streaks' task cap is **24**; it was 12 until 2021.
  - Apple Fitness's tabs are **Summary · Workout · Sharing**; Fitness+ is not a tab.
  - Apple Health's curated section is **Pinned** (formerly Favorites), followed by Highlights and Trends.
  - The 90-versus-365-day Trends comparison belongs to **Fitness**; Health publishes no window.
  - Medications is two taps **from its list**, more from launch, and "Log All as Taken" exists on **Apple Watch** only.
  - Pedometer++ is **not** tip-jar funded; it moved to a subscription.
  - AllTrails opens on a **trail list** with a map toggle, not on a map.
  - The step target moves from ~7,500 to **7,000**, on a 2025 meta-analysis.
  - Board question Q2, the IFCT licence, is now **answered** (§1.2).
  - Screen Wake Lock (§5) was already corrected in revision 1.
- **Limits.** Reddit, The Verge, Ars Technica, MacStories and every general search engine were blocked from all sessions, so nothing here is sourced to them. No app was installed, so no onboarding screen counts are claimed.

---

## 0. The seven findings that should change what we build

1. **Real-world 30-day retention for health-adjacent apps is about 3%.**
   - Across 93 apps with ≥10,000 installs, median 30-day retention was 3.3% and the median daily open rate 4.0% ([Baumel 2019, *JMIR*](https://doi.org/10.2196/14567)).
   - Pooled dropout in app-based chronic-disease interventions is 43% (95% CI 29–57), and up to 98% in individual studies ([Meyerowitz-Katz 2020, *JMIR*](https://doi.org/10.2196/20283)).
   - Even inside a paid, human-coached Indian diabetes programme, participants opened the app **108.8 times in 90 days (SD 127.9)**. That is about once a day on average, and wildly uneven ([Joshi 2023, *JMIR Diabetes*](https://doi.org/10.2196/43292)).
2. **The people this app is for are among the most retainable kinds of user measured.** Across eight remote studies with 100,000+ participants, median retention was 5.5 days. It rose by **+7 days for having the condition, +4 for older age and +40 for clinician referral** ([Pratap 2020, *npj Digit Med*](https://doi.org/10.1038/s41746-020-0224-8)). They have the conditions. **Design rule: spend the budget removing friction, not adding motivation.**
3. **The top cause of abandonment is the cost of entering data, in every domain studied.** Lapsed users cited "cost of collecting and integrating": **45.6%** of activity trackers, **42.9%** of location trackers and **57.1%** of finance trackers ([Epstein 2016, CHI](https://doi.org/10.1145/2858036.2858045); [PMC5428074](https://pmc.ncbi.nlm.nih.gov/articles/PMC5428074/)).
4. **A food diary is the worst feature we could build for an Indian home diet, and the obvious data source forbids it.**
   - Journalers rated logging ease out of 7: packaged food **6.5**, home-cooked **4.6**, *ethnic* **3.7**, restaurant 3.6, parties **2.9**. The burden changed what they ate: *"I just avoided eating things that were hard to log"* ([Cordeiro 2015, CHI](https://doi.org/10.1145/2702123.2702155); [PMC4755274](https://pmc.ncbi.nlm.nih.gov/articles/PMC4755274/)).
   - India's largest tracker shows the failure live: *"Black Chick Peas boiled is 161 calories for 100g but same amount of Boiled Kala Chana Chaat is just 97 calories… So what should I log? Big confusion every time"* (Healthify, 1★). Its photo AI gave *"almost same calories in both bowls. But the difference in bowl size is 1:5"* (2★).
   - Of 189,770 people who tried a photo food journal, **2.58%** used it actively ([Helander 2014, *JMIR*](https://doi.org/10.2196/jmir.3084)).
   - India's authoritative food tables say: *"no part of this publication can be stored or reproduced in any electronic format for creating a product without the prior written permission of the National Institute of Nutrition, Hyderabad"* ([IFCT 2017](https://www.nin.res.in/ebooks/IFCT2017.pdf), copyright page).
5. **Local-only data is a competitive advantage in this market, not a limitation.**
   - sugar.fit: *"relentlessly spammed with 10–15 calls every single day. I've blocked over 20 numbers"* (1★).
   - BeatO: *"when there's fluctuations, you will receive call from an executive… This clear means, the reading is viewed by their executive"* (1★).
   - Healthify *"turned off the write back to the Apple Health while they still read from it"* (1★).
   - **One Drop**, once a leading diabetes app, returns no result in the US or Indian App Store (searched 2026-10-08). Its users' records lived in its cloud.
6. **Alarm control, not charting, is what makes clinical-grade software hated.** One company, one data stream, three apps:
   - Dexcom's retrospective **Clarity** app rates **4.60★** (13,092).
   - Its real-time **G7** app rates **3.10★** (8,689).
   - Its caregiver **Follow** app rates **1.62★** (896).

   The G7 complaint barely varies: *"If my high blood sugar is set at 180 and my blood sugar is 182 boom critical alert incoming"* (1★).
7. **Two niches are empty, and we already hold the assets for both.**
   - **Sciatica.** The App Store's sciatica-named apps have **2** and **0** ratings. The market-leading stretching app's top complaint is *"A tiny 2D cartoon does not tell me if I should be pressing into my heel or the ball of my foot"* (Bend, 1★). We have 115 geometry-tested 3D clips, voice coaching and a spinal-loading ladder.
   - **The post-meal walk.** In type 2 diabetes, advice to walk **10 minutes after each main meal** beat 30 minutes a day **at the same total volume**. Post-meal glucose was 12% lower overall and **22% lower after the evening meal** ([Reynolds 2016, *Diabetologia*](https://doi.org/10.1007/s00125-016-4085-2)). None of Strava, AllTrails, Pedometer++ or WalkFit treats a walk after dinner differently from any other ten minutes.

---

## 1. Teardowns

### 1.1 Apple Health and Apple Fitness — the design language we are copying

**Navigation.**
- Health has three tabs: **Summary · Sharing · Browse** ([view data](https://support.apple.com/guide/iphone/view-your-health-data-iphe3d379c32/ios), [share data](https://support.apple.com/guide/iphone/share-your-health-data-iph5ede58c3d/ios)).
- Fitness has three tabs: **Summary · Workout · Sharing** ([Fitness](https://support.apple.com/guide/iphone/get-started-with-fitness-ipha5dddb411/ios)).

**Summary, top to bottom.** First **Pinned** (the user's choice), then **Highlights** (recent data, behind "Show All Highlights"), then **Trends** (significant changes, behind "Show All Health Trends"), then articles ([view data](https://support.apple.com/guide/iphone/view-your-health-data-iphe3d379c32/ios)). That gives three bands of agency on one scroll: what *I* chose, what is *recent*, and what is *changing*. Fitness's Summary goes further and can be composed card by card: *"Edit Summary"*, add a card, *"Swap Current Card"* ([activity summary](https://support.apple.com/guide/iphone/see-your-activity-summary-iph4c34a8a95/ios)).

**Trends.** Fitness compares *"Your last 90 days of activity… to the last 365"*. It warns that *"It takes 180 days of activity to start your trends"*, and a falling trend comes with a small, quantified next step such as *"Walk an extra quarter mile a day"* ([activity summary](https://support.apple.com/guide/iphone/see-your-activity-summary-iph4c34a8a95/ios)). Health's Trends flags "significant changes" and publishes no window.

**Rings, and Apple's own retreat from streak punishment.** There are three fixed rings. Since 2024 people can *"pause your Activity rings for up to 90 days without breaking your award streak"*, and "Adjust Goal for Today" is a separate action from changing the daily goal ([adjust goals](https://support.apple.com/guide/iphone/adjust-your-activity-ring-goals-iph9a08e004e/ios)). The launch coverage named the problem: *"It's not uncommon for someone with a streak to completely abandon their healthy habits after missing a day or two"* ([9to5Mac, 2024](https://9to5mac.com/2024/07/16/close-your-ringsbut-in-watchos-11-its-okay-if-you-dont/)). The HIG also forbids imitation: *"Never use Activity rings to display other types of data"*; *"Differentiate other ring-like elements from Activity rings"* ([HIG, Activity rings](https://developer.apple.com/design/human-interface-guidelines/activity-rings)).

**Medications — the model for every manual log.**
- **Logging** is two taps once you are in the list: *"Tap the name of a medication in the list below Log, then below the medication, tap Taken or Skipped"*. The list lives under Browse, so it takes more taps from launch; the real fast path is the notification.
- **Past days** are editable (*"Select a day"*).
- **Reminders** escalate in opt-in tiers: a reminder, then a follow-up *"if a medication hasn't been logged 30 minutes after the scheduled time"*, then per-medication Critical Alerts.
- **Archive** is distinct from **Delete** ([iPhone guide](https://support.apple.com/guide/iphone/track-your-medications-iph811670c81/ios)).
- **"Log All as Taken" exists on Apple Watch only** ([Watch guide](https://support.apple.com/guide/watch/medications-apd3dd24d78b/watchos)). Putting it on our Today screen beats Apple's iPhone app.
- The disclaimer is worth reusing: *"The Medications feature is not a substitute for professional medical judgment."*

**Cycle Tracking — the best retrospective logging in the app.**
- Logging is one tap: *"Log a period day: Tap a day in the timeline."*
- The logging form is itself configurable (*"tap Options next to Log"*). That is progressive disclosure of *inputs*, not just outputs ([log cycle](https://support.apple.com/guide/iphone/log-menstrual-cycle-information-iph51a822b18/ios)).
- The timeline separates what was **logged** (*"a solid red circle"*) from what is **predicted** or **likely**, and the user can *"hide period and fertility predictions"* ([predictions](https://support.apple.com/guide/iphone/view-menstrual-cycle-predictions-and-history-iph1a4a00aa0/ios)).

Two rules are worth taking: **fill weight shows certainty**, and **every prediction can be switched off**.

**Where Apple is cluttered — on its own evidence.**

| Evidence | What it tells us |
|---|---|
| Apple's own instructions for its two key per-metric actions say *"(You may need to scroll down.)"* ([view data](https://support.apple.com/guide/iphone/view-your-health-data-iphe3d379c32/ios)) | Even Apple buries "Pin to Summary" and "Data Sources" below the fold |
| Launching its 2026 redesign and a new **Insights** tab, Apple named the goal: *"translate complex biometric data into clear guidance"* ([Apple Newsroom, Sep 2026](https://www.apple.com/newsroom/2026/09/apple-advances-health-and-fitness-capabilities-using-apple-intelligence/)) | Apple concedes the current app stores data without saying what it means |
| Apple Health's own App Store listing rates **2.89★ / 834** (`IN`). *"Rings should be customizable… Different people are motivated by different things"* (4★) | A fixed metaphor frustrates |
| *"I can't believe there is nowhere to add an injury"* (3★) | Apple has no concept of a condition being managed. That is our gap |
| *"Then I have to calculate each individual time to confirm how many I took"* (3★) | Storing doses is not the feature; **adherence** is |
| *"I just wish there was a widget for how many steps I have taken"* (3★) | People want glanceable surfaces, which a PWA cannot ship (§5) |

**What to copy and what to refuse.**

| Copy | Refuse |
|---|---|
| Pinned, then recent, then changing, on one scroll | Browse's deep taxonomy; we have ~12 domains, not 100 metrics |
| Two-tap Taken/Skipped, past-day edits, Archive vs Delete | Ring imagery: the HIG forbids it, and it is wrong for us (§6) |
| Trend = arrow + sentence + **one small quantified step** | Critical Alerts on by default |
| Logged and estimated values drawn differently; predictions can be switched off | Numbers with no interpretation |
| "Adjust for today" separate from "change goal"; **pause without penalty** | — |

### 1.2 Diabetes

**Dexcom G7 and Clarity.**
- **The glucose screen** is the number, a trend arrow, a 3/6/12/24-hour selector and a graph whose band is labelled on screen: *"70–180 mg/dL is the international consensus for recommended target range"*.
- **The arrows are predictions, not rates**: *"Trend arrows help you predict where your glucose will be within the next 30 minutes… Steady: Changing less than 30 mg/dL in 30 minutes"* ([G7 user guide](https://www.usmed.com/wp-content/uploads/2025/12/G7-15-CGM-Users-Guide-compressed.pdf)).

The ratings split in finding 6 shows the chart is solved and the alarms are not. Two more complaints matter for a lifelong local app:
- **Reachable history:** *"I can only get 24 hour view. For reports I have to go to another app which generates a pdf… Why would I generate a reports in pdf?"* (1★).
- **Data integrity:** *"those most recent entries had DISAPPEARED… I have had to reenter them from memory"* (2★).

**FreeStyle Libre.**
- **The screen** tints its top by glucose range: *"Glucose readings determine background color at top of phone screen"* ([Libre 3 Plus guide](https://www.freestyle.abbott/content/dam/adc/freestyle/countries/us-en/documents/Brochure_FreeStyleLibre_3_Plus_Getting_Started_Guide_Libre_App.pdf)).
- **Abbott's app sprawl** is a cautionary tale. The consolidated **Libre by Abbott** app rates **4.58★ / 206,652**; the legacy **FreeStyle Libre 3 – US** app rates **2.43★ / 6,188**.
- **Libre Assist** shows the honest way to describe a food's glucose effect. It gives an ordinal *"Minor impact / Moderate impact / Major impact"*, then *"A few hours later, you can see the actual impact"*, with a warning that it *"should not be used to make treatment decisions"* (same guide). It runs on generative AI, which we will not use. Its shape (three words, never a number, then the user's own result) works just as well from cited data.

**Time in Range — the one visual standard worth adopting.** For adults with type 1 or type 2 diabetes ([Battelino 2019, *Diabetes Care*](https://doi.org/10.2337/dci19-0028); [PMC6973648](https://pmc.ncbi.nlm.nih.gov/articles/PMC6973648/)):

| Band | Target | Per day |
|---|---|---|
| 70–180 mg/dL (3.9–10.0 mmol/L) | **>70%** | >16 h 48 min |
| Below 70 mg/dL | **<4%** | <1 h |
| Below 54 mg/dL | **<1%** | <15 min |
| Above 180 mg/dL | **<25%** | <6 h |
| Above 250 mg/dL | **<5%** | <1 h 12 min |

For older or high-risk adults the targets are >50% in range, <1% below 70 and <10% above 250. The variability target is %CV ≤36%. The consensus standardises the **AGP**: one page, with every metric beside its target, readable by patient and clinician alike.

How we use it without a CGM:
- A TIR percentage assumes ≥70% sensor coverage over 14 days. Four fingersticks a day cannot supply that, so we do not print one.
- The AGP's *form* is right for our clinician page. A user asked for exactly that: *"Only info needed is date, time, glucose reading… All on one page. One page is all my doctor wants"* (mySugr, 2★).

**mySugr** (4.68★ / 33,200). Users tame a monster by *"reaching 50 points each day"* ([mySugr](https://www.mysugr.com/support/us/how-do-i-earn-points)).
- **The points push users into richer logging**, the opposite of what we want. They are opaque even to fans: *"The monster is cute and makes a sound, but there is no way to understand what the points are for"* (3★).
- **Subscription resentment:** *"a monthly/annual subscription fee to access previously free tags and features"* (2★).
- **A vanishing derived number breaks trust:** *"it dropped the DMI reading. This leaves you guessing"* (2★).

**One Drop.** It returns no App Store result in the US or India (2026-10-08). INFERENCE: it has wound down. Whatever the cause, a cloud-only record went with it.

**India: four apps, one business model, and it is not ours.**

| App (`IN`) | What it is | What users say |
|---|---|---|
| **sugar.fit** 4.74★ / 10,988 | Doctor-and-coach programme sold with a CGM | *"they will provide only 1 CGM… which last only for 15 days and then you have to pay extra Rs500 every month"*; *"If I spend ₹8000 per month I need to see my blood sugar chart on the app first thing"* (1★) |
| **Healthify** 4.55★ / 66,612 | Photo and voice calorie logging, an AI coach ("Ria"), paid human plans | Duplicate listings with different calories (finding 4); a 1:5 bowl error; *"there is no provision to track specific portion sizes of the meal"* (2★); Apple Health write-back removed |
| **BeatO** 4.09★ / 1,352 | Glucometer and test-strip commerce plus coaches | Calls from an executive after a spike; *"No Apple Health Data Export"* (2★) |
| **Fitterfly** 4.64★ / 1,315 | "Digital therapeutics" programmes with a CGM | *"obnoxious food diary tech will make sure you soon forget this app"*; *"They will not allow you to have data in your system"* (1★) |

The sugar.fit reviewer wrote the best one-line brief in the whole corpus: **the chart first, with nothing in front of it.**

**What the Indian evidence settles.**
- **Board Q2 — can we bundle Indian food data? Not IFCT, without written permission.**
  - IFCT 2017 gives *"nutritional information on 151 discrete food components for 528 key foods"*.
  - Its copyright page forbids electronic reproduction "for creating a product" (finding 4).
  - It holds **no household measures**: "katori" and "household measure" appear nowhere in its full text.
  - The repackagings ([`nodef/ifct2017`](https://github.com/nodef/ifct2017), AGPL-3.0; [`pantryf/ifct2017.assistant`](https://github.com/pantryf/ifct2017.assistant), MIT) cannot grant rights NIN never granted. The book lists **nin@ap.nic.in** for permission.
- **Indian portions have published, measured anchors**, so guidance can speak the user's language without anyone weighing food.
  - *"A standard bowl called Katori… used for curry/dal (lentil) measures 200 ml"* ([LASI-DAD, 2025](https://doi.org/10.1186/s12889-025-24970-9)).
  - The M-SAKHI trial marked household vessels *"quarter, half, three-quarters, and full"* and sized chapatis from *"120 chapatis"* made by real households ([M-SAKHI, 2023](https://doi.org/10.1017/jns.2023.95)).
  - ICMR-NIN's *Dietary Guidelines for Indians 2024* state the balanced plate in katoris, chapatis and glasses (reproduced in [Gupta 2025](https://doi.org/10.4103/ijcm.ijcm_580_23)).
- **Glycaemic index belongs to the dish, not the grain.** In Chennai measurements ([Shobana 2022, *IJMR*](https://doi.org/10.4103/ijmr.ijmr_1935_19)):
  - finger-millet ball: **98.2**;
  - sorghum roti: **84.1**, but sorghum idli: **61.3** (the same grain, 23 points apart);
  - white chickpea sundal: **24.1**.

  The authors: *"Merely being a whole grain-based food does not qualify for a lower GI."* Millet grains average a GI of **52.7**, against 71.7 for milled rice, and *"Minimally processed millets were 30% more effective in lowering GI of a meal"* ([Anitha 2021](https://doi.org/10.3389/fnut.2021.687428)). Preparation decides.

**Verdict.** Our edge over the Indian market is ownership and honesty: no account, no calls when sugar spikes, no coach who runs out of things to say by month three, no ₹36,000 programme, and no data you cannot take with you.

### 1.3 Minimal-but-deep: the apps people love

**Gentler Streak** (4.71★ / 8,824; Apple Design Award 2024, Social Impact — [ADA list](https://en.wikipedia.org/wiki/Apple_Design_Awards)). The most important app in this report.
- **What it shows:** an **Activity Path** — a *"green shaded area"* marking the user's *"ideal range for activity"*, with their training load running through it ([docs](https://docs.gentler.app/understanding-your-activity-path/what-is-the-activity-path)) — under **one sentence** of status. Behind that sentence sit, since February 2024, *"Fourteen variations of daily fitness status"* ([Gentler Stories](https://gentlerstories.com/newsroom/20240209newguidance)). Users quote strings such as "Overreaching" and "Step Up Your Game".
- **A manual status: Active, On a Break, Sick or Injured.** Setting it *"automatically pauses all push notifications related to workout suggestions"* and is *"designed to give you the space you need to recover without pressure"* ([docs](https://docs.gentler.app/personalizing-your-profile/what-happens-when-i-set-my-status-to-sick-injured-or-on-a-br)). For a person with recurring sciatica flares, this is the most transferable feature in the market.
- **Navigation:** in March 2025 it went **from four tabs to three**. The team asked themselves: *"if we were launching version 1.0 with what we have today, how would we design it?"* ([release note](https://docs.gentler.app/release-notes-and-announcements/a-more-intuitive-streak)).
- **On rings**, a co-founder: *"rings tend to create a subconscious need to complete them, which clashes with our core principle: adapting to where the user is"* ([Gentler Stories](https://gentlerstories.com/newsroom/20250528gssteps)).

**Praise.** *"It doesn't give me a red 'X' or break my multi-day streak because I'm tired and need rest. Instead, it says: 'Rest is part of the plan. See you tomorrow!'"* (5★). Another reviewer describes the boom-bust loop a person with recurring flares lives in: *"I have fibromyalgia and severe chronic migraines that for years have left me in a constant loop of over doing it and then crashing… it has helped me finally gain strength and stamina"* (5★, titled "Perfect for those with chronic conditions").

**Complaints, which are the warnings for us.**
- **An opaque status that disagrees with the body:** *"After a full week of resting I'm still 'overreaching'"* (1★); *"The only days I don't get chewed out by this app are days that I am not exercising"* (1★); *"based on science or… what, biorhythms?"* (2★).
- **A short window in a long-term app:** *"you can only see the last 10 days of your activity path"* (2★).
- **Its own notifications contradict its philosophy:** *"EXERCISE REMINDER You're about to wave adios to your streak… Not ok"* (4★). **Every string must be checked against the product's tone.**

**Streaks** (4.81★ / 27,349; $5.99 once).
- **Design:** one grid, and one tap completes a task.
- **The cap is part of the design.** *"One of the philosophies of Streaks is to limit the number of tasks"*; the cap was raised *"from 12 to 24"* in 2021 only because shared tasks used up slots ([Streaks 7](https://crunchybagel.com/now-available-streaks-7/)).
- **Even this app retreated from strict streaks.** In 2024 it added a **2-Day Rule** that *"gives you a single day's grace"* ([Streaks 10](https://crunchybagel.com/now-available-streaks-10/)).

**Waterllama** (4.87★ / 162,518). One tap plus a visible consequence makes a dull metric loved: *"It's fun to tap how much water you drank and then watch the llama fill up"* (5★). It also shows how to spoil that:
- *"You have to pay the upgrade to delete water"* (1★).
- *"I can pay to 'fix' my streaks or the app could just be reasonable"* (1★).
- A widget that *"turned into a red, angry llama face… My son said it looks like they are copying Duolingo"* (1★).

**Copy the tap and the fill; refuse the paywall and the guilt.**

**Oura** (4.86★ / 309,179). Three scores, one hero number, a sentence in words, and one-tap tags. The failure is the hero number: *"it makes up 'readiness' scores that don't really tell you anything you don't already know. My readiness is 82! What does th[at mean]"* (2★).

**Whoop** (4.81★ / 84,851). Strain, Recovery and Sleep scores plus a behaviour journal. Its complaints are the ones a lifelong app must not earn: *"You still can't see more than a weeks data on your phone. You can't export anything"* (1★). A reviewer of a similar journal states the rule for any daily log: *"it needs to let me set daily defaults… only tag or untag the 3 things that were different"* (Athlytic, 4★). **Log the exception, not the routine.**

**Athlytic** (4.79★ / 11,086) **and Bevel** (4.85★ / 16,893). Both compute Whoop-style recovery from Apple Watch data with no extra hardware. Market observation: they suggest **interpretation, not collection, is the scarce good**. Bevel's most damaging recent review is about an assistant: *"Bevel has added a crummy AI chat bot that pops open all the time while I'm trying to explore my data… I used to really like this app for its simplicity and function"* (1★). That is independent support for constraint C4.

### 1.4 Walking and movement

**Strava** (4.81★ / 376,273).
- **Opening:** *"Strava makes fitness tracking social"* (its listing), and its App Store screenshots show it opening on other athletes' activities.
- **Walkers get the feed without the rewards.** Steps exist only *"during the recording process"* of a walk, hike or run ([steps](https://support.strava.com/en-us/articles/15401672-steps-on-strava)). Some features are *"available only for our three core sports: riding, running, and swimming"* ([sports](https://support.strava.com/en-us/articles/15402005-what-sport-types-does-strava-support)).
- **The 2020 paywall backlash:** when Strava moved leaderboards behind its subscription, DC Rainmaker wrote *"Today, Strava sold its segmented soul… They're using the stick, instead of the carrot"* ([DC Rainmaker](https://www.dcrainmaker.com/2020/05/strava-leaderboard-reduces.html)).

**AllTrails** (4.89★ / 1,041,177). Its App Store screenshots show it opening on a trail-discovery list with a map toggle, and its unit is a destination, not a day. INFERENCE: it is the right tool for a user's weekend and the wrong one for their Tuesday.

**Pedometer++** (4.79★ / 183,179).
- **Opening (per its App Store screenshots):** today's step count, very large, over a bar chart against a goal line.
- **Its developer's most important decision for someone rehabbing:** *"changing your goal doesn't affect your past data, only the current day and moving forward"*, because *"starting at a lower goal and then slowly increasing over time works much better"* ([David Smith, 2019](https://david-smith.org/blog/2019/05/28/pedometer-plus-plus-4-dot-0-our-most-personal-update-ever/)).
- **Privacy by architecture:** *"we never have access to your step or health data"* ([FAQ](https://pedometer.app/faq)).
- **Monetisation (correcting revision 1).** It was free with ads plus a one-time ad removal. Premium features *"will now require a subscription"* ($29.99 a year, [pedometer.app](https://pedometer.app)). A user: *"I went for this app against others because it's a one time payment. Now that it switched to subscription, I will be abandoning it"* (1★).
- **Streaks break for reasons outside the user's control:** *"my phone does not keep up with the watch unless I actively synchronize them. I have lost a streak over this"* (3★).

**WalkFit** (4.73★ / 164,729).
- **The free product is the quiz:** *"What you access without subscription: The onboarding quiz… Think of the free download as a test drive"* ([WalkFit](https://walkfit.welltech.com/is-walkfit-free)).
- **Billing:** *"Watch Out for Hidden Charges!"* (1★).
- **Form instruction, the most important review in this section for a back user:** *"they have you do weird bending movements without any instructions on how to protect your back… Something pulled on my lower back bad enough that I had to take pain meds"* (1★).
- INFERENCE: its rating leans on day-one reviews (there are 5★ reviews titled "Day 1").

**The evidence that sets the walking features.**

| Decision | Evidence |
|---|---|
| **Target 7,000 steps, floor ~4,000, goal owned by the user** | Benefits level off between **5,000 and 7,000** steps. At 7,000 versus 2,000 steps, the hazard ratio is 0·53 for all-cause mortality and **0·86 for type 2 diabetes**; the authors call *"7000 steps per day… a more realistic and achievable target"* ([Ding 2025, *Lancet Public Health*](https://doi.org/10.1016/S2468-2667%2825%2900164-1)). In 38–50-year-olds, ≥7,000 steps carried lower mortality and *"no association of step intensity with mortality"* ([Paluch 2021](https://doi.org/10.1001/jamanetworkopen.2021.24516)). Benefit is measurable from under 4,000 a day ([Banach 2023](https://doi.org/10.1093/eurjpc/zwad229)). The 10,000 figure *"can be traced to Japanese walking clubs and a business slogan"* ([Tudor-Locke 2004](https://doi.org/10.2165/00007256-200434010-00001)) |
| **Prompt a walk straight after meals, evening first** | Reynolds 2016 (finding 7). Exercise after a meal beats exercise before it, and *"as soon as possible after a meal"* beats later ([Engeroff 2023, meta-analysis](https://doi.org/10.1007/s40279-022-01808-7)) |
| **Sitting breaks should be walking breaks, not standing** | Two-minute light walks every 20 minutes cut glucose and insulin responses, and light walks did as well as moderate ones ([Dunstan 2012](https://doi.org/10.2337/dc11-1931)). *"light-intensity walking was found to represent a superior physical activity break"* compared with standing ([Buffey 2022](https://doi.org/10.1007/s40279-022-01649-4)) |
| **Walking is a back intervention, not just cardio** | An individualised, progressive walking programme with education almost doubled the time before back pain returned: **HR 0·72; median 208 vs 112 days** ([WalkBack, *Lancet* 2024](https://doi.org/10.1016/S0140-6736%2824%2900755-4)). The trial enrolled people who had recovered from an episode, not people in an active sciatica flare |
| **Walking lowers blood pressure; isometric holds lower it more** | Walking lowered systolic pressure by 4.11 mmHg ([Cochrane 2021](https://doi.org/10.1002/14651858.CD008823.pub2)). Isometric training lowered it by 8.24/4.00 mmHg, with the wall squat ranked first ([Edwards 2023](https://doi.org/10.1136/bjsports-2022-106503)). The exercise content stays in `diabetes-hypertension-exercise.md` |

### 1.5 Nutrition: the cost of logging, and why people leave

**MyFitnessPal** (4.71★ / 2,372,962) is diary-first. Its 2022 move of barcode scanning behind Premium is visible in its reviews:
- *"What a disappointment… features now locked behind paywall"* (1★).
- *"With premium being crazy expensive at $20 a month or $80 a year… they decided to put a feature, the barcode scanner which I use regularly behind the premium pay wall"* (1★).
- *"Charging for stuff that's been free for years"* (1★).

Two of its UX findings apply directly to us:
- **Breadth buried the core:** *"the most important part, the diet and weight monitors, became almost lost in the scrum of everything else they added"* (2★).
- **A repeated prompt is an insult:** *"Good app, if you don't mind being treated like a child… The next day when I enter my weight, I get the same annoying message (and you have to answer it otherwise you cannot proceed)"* (1★). This is the empirical case against a launch modal (§3).

**Yazio** (4.70★ / 51,068) undermines photo logging from the inside: *"it cannot determine the serving size. The calorie counts vary wildly each time I use the feature"* (2★). Healthify's 1:5 bowl (finding 4) is the Indian version of the same failure.

**Cronometer and Zoe.** Market observation: Cronometer sells micronutrient depth to power users, and Zoe sells personalisation gated behind a test kit and a subscription. Both raise the cost of each entry rather than lowering it, and both are structurally unavailable to us.

**The measured abandonment picture** ([Cordeiro 2015](https://doi.org/10.1145/2702123.2702155): 141 journalers, 94 of them lapsed, plus 5,526 forum posts):
- In their own words, journaling was "too much effort" (31), "time-consuming" (27) or "tedious" (16).
- Contents and amounts were unknowable: respondents could not tell the ingredients (+75), the portion eaten (+39) or the cooking method (+27).
- One miss cascades: *"Every time I start I forget one meal or another so it becomes less accurate. Then I just forget completely."*
- It is socially visible: *"I also felt embarrassed to do it in front of friends so I stopped."*
- The authors conclude: *"Journals cannot assume continuous and complete compliance."*

**Verdict: no food diary.** Indian-diet **guidance**, in household measures and dishes, instead (§1.2).

### 1.6 Back pain and physio

**Hinge Health** (4.93★ / 168,860). Its headline rating is not comparable to a consumer app's. Hinge is funded by employers and insurers, so its users are referred and onboarded by a human, and clinician referral alone was worth **+40 days of retention** in [Pratap 2020](https://doi.org/10.1038/s41746-020-0224-8). *I could not reach its onboarding or outcome-study documentation, so I cite neither.*

**Bend** (4.76★ / 174,138) is the closest "minimal but deep" analogue in our own category.
- **Praise:** session length and routine choice are the product. *"If i have 5 minutes or 10 minutes i can just choose a stretch routine for whatever area i want"* (5★); *"I have really enjoyed this app's feature to create custom routines"* (5★). Streaks work on some users: *"I buy it for the streak"* (5★).
- **Complaints:** *"Zero instructional guidance… A tiny 2D cartoon does not tell me if I should be pressing into my heel or the ball of my foot"* (1★); *"Everything is behind a paywall"* (1★); *"it starts back over to day 1… I was no longer logged in"* (2★).

Between Bend's top complaint and the WalkFit back-strain review (§1.4), **form instruction is not polish; for a back user it is safety.** That is what our 3D clips and voice provide.

**Sciatica-specific apps:** nothing credible exists (finding 7). INFERENCE: the niche is empty because it is clinically risky, not because nobody wants it. That makes the readiness engine's red-flag rules an asset rather than overhead.

**Pain measurement: what is short enough to use daily.**

| Instrument | Items | Measures | Verdict for us |
|---|---|---|---|
| **NPRS / NRS 0–10** | 1 | Pain intensity | **Daily.** Its measurement properties in low back pain are systematically reviewed ([Chiarotto 2019, *J Pain*](https://doi.org/10.1016/j.jpain.2018.07.009)). A trial in *JAMA* used a 2-point minimal important difference: *"The prespecified minimal clinically important difference was defined as 2 points or more"* ([Juch 2017](https://doi.org/10.1001/jama.2017.7918)) |
| **Back and leg scored separately** | 2 | Radicular pattern | **Daily, and non-negotiable.** Responsiveness and MCID differ between "back pain only" and "leg pain ± back pain" groups ([Lauridsen 2006](https://doi.org/10.1186/1471-2474-7-82)), so one pain number cannot represent sciatica |
| **Oswestry Disability Index** | 10 sections | Function | **Monthly at most.** MCID ≈6 points on the modified version ([Fritz & Irrgang 2001](https://doi.org/10.1093/ptj/81.2.776)) |
| **Roland-Morris (RMDQ)** | 24 | Function | **Monthly at most** ([Lauridsen 2006](https://doi.org/10.1186/1471-2474-7-82); [Chiarotto 2016](https://doi.org/10.2522/ptj.20150420)) |
| **STarT Back** | 9 | Risk group: low, medium or high | **Once per episode.** NICE NG59 1.1.2: *"Consider using risk stratification (for example, the STarT Back risk assessment tool) at first point of contact… for each new episode"* ([NICE NG59](https://www.nice.org.uk/guidance/ng59/chapter/Recommendations)) |

NG59 1.1.3 sets the intensity of support by risk group: *"simpler and less intensive support"* for likely-good outcomes, and *"more complex and intensive support"* for higher risk. Recommendation 1.1.4 says: *"Do not routinely offer imaging in a non-specialist setting."*

**Design consequence:** two 0–10 numbers each day, a 9-item questionnaire once per flare, and a long questionnaire only when the user wants a formal re-measure. The red-flag rules already exist in the readiness engine and must be surfaced, not re-derived.

---

## 2. What makes people quit — and the design rule for each

This section should decide the build. Each row gives a measured cause and the rule that follows from it.

| # | Cause | Evidence | **Our design rule** |
|---|---|---|---|
| 1 | **The cost of collecting data**, the top reason everywhere | 45.6% / 42.9% / 57.1% of lapsed users cited it ([Epstein 2016](https://doi.org/10.1145/2858036.2858045)); "too much effort", "time-consuming", "tedious" ([Cordeiro 2015](https://doi.org/10.1145/2702123.2702155)) | **No metric ships unless it can be entered in one or two taps from Today.** Budget the whole app at ≤30 seconds of input a day |
| 2 | **Logging that makes behaviour worse** | Ease of logging ran from 6.5 for packaged food down to 3.7 for ethnic food and 2.9 at parties; *"I just avoided eating things that were hard to log"* ([Cordeiro 2015](https://doi.org/10.1145/2702123.2702155)); Healthify's duplicate listings (finding 4) | **No food diary.** Never make the easy-to-log choice the rewarded one |
| 3 | **Guilt after lapsing** | Guilt was the dominant feeling after quitting for 16.2% of lapsed activity trackers ([Epstein 2016](https://doi.org/10.1145/2858036.2858045)). Apple added Pause Rings in 2024 because people *"completely abandon their healthy habits after missing a day or two"* ([9to5Mac](https://9to5mac.com/2024/07/16/close-your-ringsbut-in-watchos-11-its-okay-if-you-dont/)) | **A missed day shows as a neutral gap**, never a red mark, a broken chain or a zero |
| 4 | **Losing a streak is a cliff** | *"I have lost a streak over this"* (Pedometer++, 3★); *"I can pay to 'fix' my streaks"* (Waterllama, 1★). The industry has retreated: Apple's Pause Rings, Streaks' 2-Day Rule. **Honest caveat:** peer-reviewed evidence that streaks *themselves* cause harm is thin. Device owners felt more positive than negative, but *"When prevented from wearing their device… this pattern was reversed"* ([Ryan 2019, *BMC Psychol*](https://doi.org/10.1186/s40359-019-0315-y)) | **No consecutive-day streak.** Show *days active in the last 28*, and a **Status** (flare-up, unwell, away) that takes those days out of the count rather than marking them failed |
| 5 | **Notification volume and tone** | The Dexcom G7 app sits at 3.10★, with alerts as the dominant complaint. A finance app was still emailing a user five years after they quit ([Epstein 2016](https://doi.org/10.1145/2858036.2858045)). Gentler Streak's own *"You're about to wave adios to your streak"*; Waterllama's *"red, angry llama face"* | **No interrupting notifications in v1.** Use the app-icon badge only for genuinely due items. Check every string against the tone |
| 6 | **Being asked the same thing again** | *"if you don't mind being treated like a child… you have to answer it otherwise you cannot proceed"* (MyFitnessPal, 1★) | **No recurring prompt may block a task.** A question dismissed twice is never asked again (§3) |
| 7 | **Subscription and paywall resentment** | MyFitnessPal: *"Charging for stuff that's been free for years"*. mySugr: *"previously free tags and features"*. Pedometer++: *"Now that it switched to subscription, I will be abandoning it"*. Waterllama: *"pay the upgrade to delete water"*. Strava: *"sold its segmented soul"*. Bend: *"Everything is behind a paywall"*. In contrast, Streaks holds **4.81★ on a one-time $5.99** | **Already guaranteed by C1, and it is a feature. Say so in the app.** |
| 8 | **Data with no payoff** | *"My readiness is 82! What does th[at mean]"* (Oura, 2★); *"I have to calculate each individual time"* (Apple Health, 3★); Apple's own goal of *"clear guidance"* ([Newsroom](https://www.apple.com/newsroom/2026/09/apple-advances-health-and-fitness-capabilities-using-apple-intelligence/)) | **Every stored value appears in an interpretation within one screen of where it was entered.** If we cannot say what it means, we do not collect it |
| 9 | **Opaque or wrong derived scores** | Gentler Streak: *"still 'overreaching'"*, *"chewed out"*, *"biorhythms?"* | **Every derived status carries a "Why this?" listing its real inputs, and the user can correct it** |
| 10 | **Short history in an app meant for life** | Whoop: *"can't see more than a weeks data"*; Dexcom: *"I can only get 24 hour view"*; Gentler Streak: *"only the last 10 days"* | **A year view and an all-time view for every metric, and export in v1** |
| 11 | **Losing the data** | Dexcom: *"those most recent entries had DISAPPEARED"* (2★). Bend: *"I was no longer logged in"* (2★). One Drop: gone from the App Store, with its users' records in its cloud | **Confirm writes before saying "saved", request persistent storage, and put one-tap export on the Track root** (§5) |
| 12 | **Anxiety from over-tracking** | Sleep tracking can become *"a perfectionistic quest for the ideal sleep"* ([Baron 2017, orthosomnia](https://doi.org/10.5664/jcsm.6472)); personal data can feed rumination as well as reflection ([Eikey 2021](https://doi.org/10.1007/s00779-021-01573-w)) | **No sleep score.** No "more readings is better" — cadence comes from the clinical protocol document. An out-of-range value gets a calm next step, not an alarm |
| 13 | **Brutal baseline attrition, but not for this app's users** | 3.3% at 30 days ([Baumel 2019](https://doi.org/10.2196/14567)); 43% pooled dropout ([Meyerowitz-Katz 2020](https://doi.org/10.2196/20283)); ~1 app open a day even in a paid coached programme ([Joshi 2023](https://doi.org/10.2196/43292)); +7 days for having the condition and +40 for clinician referral ([Pratap 2020](https://doi.org/10.1038/s41746-020-0224-8)) | **Do not import an engagement playbook built for indifferent users.** Remove friction. Take the cheap share of the referral effect with a printable page for their doctor |
| 14 | **Habits take far longer than the folklore** | Time to 95% automaticity ranged **18 to 254 days**. *"Missing one opportunity to perform the behaviour did not materially affect the habit formation process"* ([Lally 2010](https://doi.org/10.1002/ejsp.674)) | **Design for eight months, not 21 days, and make "one miss is harmless" true in the copy and in the maths** |

---

## 3. The opening moment

The owner said the app "should ask me what I want to do". That sentence describes a *feeling*, being met where they are, and the market says a question is the wrong way to deliver it.

### What the best apps actually do on launch

| App | Opens on | Pattern |
|---|---|---|
| Apple Health | Pinned, then Highlights, then Trends | Adaptive summary; the user pins the top |
| Apple Fitness | Summary cards the user can compose, plus workout entry | Status + one obvious action |
| Oura | One hero score + a sentence | One number, explained |
| Whoop | Recovery %, colour-coded | One number |
| Gentler Streak | Activity Path + one sentence of status | Adaptive recommendation |
| Pedometer++ | Today's steps, very large, over bars against a goal line | Status + history at a glance |
| Bend | A routine + a duration choice | One action with a size choice |
| Waterllama | The character + the quick-add row | The log control *is* the home screen |
| MyFitnessPal | The diary | Data entry first; its own users call it "cluttered" |
| Strava | Other athletes' activities | Social feed — a category mismatch for us |
| AllTrails | A trail-discovery list with a map toggle | Discovery — a category mismatch for us |

Eight of the eleven open on **status plus one action**. Of the three that don't, two are discovery products and the third is the app its own users call cluttered. None of the loved apps opens on a question.

### Recommendation

**An adaptive Today: one sentence of status, one primary action, and "Choose something else" in a fixed position.** This agrees with `codex-vision.md` §2. The evidence adds four things:

1. **"Why this?" is mandatory, not a nicety.** Gentler Streak shows both sides. It collapses fourteen computed states into one plain sentence, which works; its 1–2★ reviews show what happens when that sentence is wrong and cannot be questioned. The disclosure must list the real inputs ("Training day in your plan; session not done; back pain 3/10 this morning"), and the user must be able to correct it.
2. **Resume comes first.** HIG: *"Restore the previous state when your app restarts so people can continue where they left off"* ([HIG, Launching](https://developer.apple.com/design/human-interface-guidelines/launching)).
3. **The fallback list never reorders.** Codex already specifies this. A changing hero over a stable list gives adaptivity without destroying muscle memory.
4. **Ask through the surface, as Apple advises.** *"if onboarding is necessary, design a flow that's fast, fun, and optional"*, and *"Postpone nonessential setup flows or customization steps"* ([HIG, Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding)).

When a user opens the app on a measurement day, the sugar.fit reviewer's rule applies: *"I need to see my blood sugar chart on the app first thing."* If a reading is due or out of range, that is the hero; nothing goes in front of it.

### Alternatives rejected, and why

| Rejected | Why |
|---|---|
| **A modal asking "What do you want to do?" on every launch** | It is MyFitnessPal's documented failure (*"treated like a child… you cannot proceed"*). It charges a decision tax on the habitual launches, blocks resume, and contradicts the HIG's "optional" onboarding |
| **A grid of twelve domain tiles** | It shows inventory, not a next action, and makes twelve unequal things look equal. `claude-inventory.md` already names this as the current app's problem: seven tabs, three of them "look at my data" |
| **A dashboard of every metric** | MyFitnessPal again: *"the most important part… became almost lost in the scrum of everything else"* (2★) |
| **One hero score, Oura-style** | We have the engine to compute one. But *"My readiness is 82! What does that mean"* is the failure mode, and compressing glucose, blood pressure, sciatica and sleep into one number hides the clinically important signal. **Use the engine to choose the action and say why in words; do not print a score** |
| **Chat as the home screen** | Cut by C4. Separately, Bevel's *"crummy AI chat bot that pops open all the time"* shows the cost |
| **A fixed workout home** | It makes "just my back today" feel like misusing the app, which is the owner's stated complaint |

**INFERENCE:** I am confident about the shape — status, one action, a stable fallback list — because the loved apps converge on it and the exceptions are explained by their category. Codex's threshold (three matching choices in the same part of the day over seven days before history moves the default) is unevidenced. Ship it behind "Why this?", and let the owner pin a focus manually so the heuristic never has to be right.

---

## 4. Holistic breadth without feeling like a database

| Pattern | Where it is proven | How we apply it |
|---|---|---|
| **Summary → detail, two levels only** | Apple's Summary and Browse. HIG: *"Keep a chart simple, letting people choose when they want additional details"* ([HIG, Charting data](https://developer.apple.com/design/human-interface-guidelines/charting-data)) | The Track root shows one row per domain with its latest value and trend; the chart, history and sources are one tap deeper. Nothing sits three levels deep |
| **User-pinned items above app-curated ones** | Apple Health's Pinned, then Highlights, then Trends | A person managing diabetes, blood pressure and sciatica pins glucose, blood pressure and back/leg pain. Everything else surfaces only by exception |
| **Progressive disclosure, including of inputs** | NN/g: *"Initially, show users only a few of the most important options"* ([NN/g](https://www.nngroup.com/articles/progressive-disclosure/)). HIG: *"limiting the number of onscreen controls while making secondary details and actions discoverable with minimal interaction"* ([HIG, iOS](https://developer.apple.com/design/human-interface-guidelines/designing-for-ios)). Cycle Tracking's configurable log (*"Options next to Log"*) | Each log sheet shows its one or two essential fields; optional context such as notes, meal or symptoms is added from "More", and the sheet remembers what the user chose to show |
| **Curation by exception** | Apple's Highlights; Oura's daily sentence; Gentler Streak's status | Today shows a vital **only when it is due, out of range or newly trending**, never as a permanent row of twelve numbers |
| **Few tabs, no overflow** | HIG: *"Avoid overflow tabs"* ([HIG, Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)). Apple's older numeric guidance: *"In general, use between three and five tabs on iPhone"* ([archived HIG, 2020](https://web.archive.org/web/20200801000000/https://developer.apple.com/design/human-interface-guidelines/ios/bars/tab-bars/)). Gentler Streak went from four tabs to three | Codex's four tabs (Today / Move / Track / Guide), with no More tab, are right |
| **Life events as dated intervals** | Gentler Streak's Sick/Injured status; Apple's Pause Rings | A **Status** with a start and an end. It pauses programme progression, quiets prompts, and drops those days from the consistency count |
| **Certainty shown visually** | Cycle Tracking draws logged, predicted and likely days differently | Measured, entered, imported and estimated values are drawn differently. Estimates can be hidden |
| **Archive distinct from delete** | Apple Medications | Retire a medication, condition or goal without erasing its history |
| **One printable page for the clinician** | The AGP: *"clinicians and patients can both read it"* ([Battelino 2019](https://doi.org/10.2337/dci19-0028)); *"One page is all my doctor wants"* (mySugr, 2★) | A "Summary for my doctor" screen that prints from the browser |

**The anti-pattern to name:** MyFitnessPal added breadth until its core was *"lost in the scrum"*. A new domain is safe only when it arrives as **a row in Track and an article in Guide**, and reaches Today only when it has something due or urgent to say.

---

## 5. Minimal-friction tracking

> **Source precedence (board rule 5).** `docs/research/frontend-only-health-platform.md` is **authoritative over this section**. It works from WebKit bugs, MDN browser-compat-data and W3C specs. Where this section leaned on [firt.dev](https://firt.dev/notes/pwa-ios/) (last updated June 2023), it has been reconciled with that document:
>
> - **Screen Wake Lock does *not* work in an installed PWA before iOS 18.4.** It *"Does not work in standalone Home Screen Web Apps"* below that version ([webkit.org/b/254545](https://webkit.org/b/254545#c32)). Every guided session must check `'wakeLock' in navigator` and fall back to a visible "keep your screen awake" instruction.
> - **Badging works**: `navigator.setAppBadge()` is available to Home Screen web apps from iOS 16.4.
> - **Foreground step counting can be accurate** — about 95% across carry positions (Salvi, IEEE EMBC 2018, [PMID 30441333](https://pubmed.ncbi.nlm.nih.gov/30441333/)) — but it stops when the phone locks. It belongs to a walk *session*, never to an all-day total.
> - **A Web Push sender need not be a server we run.** A scheduled GitHub Action could send for one user. §2 rule 5 still rejects push in v1, on abandonment grounds.

### The input ladder, cheapest first

| Rank | Method | Cost | Available to a front-end-only iOS PWA? |
|---|---|---|---|
| 1 | **Sensor-derived / passive** | Zero | **Mostly no.** There is no HealthKit from the web and no background pedometer, and Web Bluetooth is unsupported, so no CGM or BP-cuff pairing |
| 2 | **One tap with a preset** | ~1 s | **Yes. This is our main instrument** |
| 3 | **Widget or complication** | ~1 s, without opening the app | **No.** A PWA cannot ship Home Screen widgets or Watch complications. Users ask for them constantly (§1.1, Streaks). This is our biggest permanent disadvantage; say so, don't fake it |
| 4 | **Stepper on a remembered value** | ~3 s | **Yes** |
| 5 | **Barcode** | ~5 s when it works | **Possible, but refuse it.** There is no `BarcodeDetector` in Safari, and it only helps packaged food |
| 6 | **Voice** | ~5 s and error-prone | **Partly.** Recognition is network-dependent and unreliable. Our pre-rendered Kokoro audio sidesteps the *output* problem entirely |
| 7 | **Photo** | ~10 s, and inaccurate | **No, and refuse.** It needs a backend, and portion error is the norm: *"the difference in bowl size is 1:5"* (Healthify); *"calorie counts vary wildly"* (Yazio) |
| 8 | **Typed form** | 15–60 s | Yes, and it is where apps go to die (§2 rule 1) |

**Platform facts that change decisions.**
- **There is no dependable scheduled reminder without a sender.** Web Push needs an installed app and a push sender ([WebKit, iOS 16.4](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)), and Background Sync is unsupported. §2 rule 5 makes this a policy rather than an apology.
- **Local storage is more durable than feared, if we ask.** An installed app gets the browser's quota (*"the same origin quota and overall quota as when it is opened in a browser app"*). An origin in persistent mode can be excluded from eviction, and *"WebKit currently grants a request based on heuristics like whether the website is opened as a Home Screen Web App"* ([WebKit, Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/)). **Decision: call `navigator.storage.persist()` on first run, show the result honestly, and still ship export in v1.**
- **`navigator.vibrate` is unsupported.** There are no haptic rep cues; use audio and visual signals.

### Quick entry, metric by metric

**The governing rule comes from Whoop users: log the exception, not the routine.** Every entry defaults to the last value, so an unchanged day costs one tap.

| Metric | Pattern | Taps | Why this shape |
|---|---|---|---|
| **Glucose** | Number pad pre-filled near the last reading, plus a one-tap context chip (Fasting / Before meal / 2 h after meal / Before or after exercise) | 2–3 | A glucose number without context cannot be interpreted, so the chip is part of the value. The chip set follows `clinical-tracking-protocols.md` |
| **Blood pressure** | One sheet holding a *set* of two or three readings, averaged, each seeded from the last | 3–4 | The home protocol requires repeats; storing them as unrelated records would corrupt the trend |
| **Weight / waist** | One stepper seeded from the last value | 2 | |
| **Water** | A fixed quick-add row on Today | **1** | Waterllama's whole lesson |
| **Back pain / leg pain** | Two 0–10 pickers side by side, defaulting to yesterday | 1–2 | Separate scores are clinically required (§1.6) |
| **Mood / wellbeing** | A 5-point row, one tap, optional note | **1** | Never a required field |
| **Steps** | "Add today's steps" as a **day total that replaces**, never adds; Apple Health import later | 2 | Codex's D10. The step-mismatch complaints come from implicit provenance |
| **Medication / supplement** | Taken / Skipped per item on Today, plus **"Log all as taken"**, which Apple offers only on the Watch | **1** | Apple's model, one level shallower |
| **Status** | Normal / Flare-up / Unwell / Away, with a start date | 2 | Gentler Streak's manual status; covers days of no logging honestly |

---

## 6. Visualisation that earns its space

| Visual | Verdict | Evidence |
|---|---|---|
| **Trend arrow + sentence + one quantified step** | **Highest value per pixel; use everywhere** | Apple Fitness: a falling trend comes with *"Walk an extra quarter mile a day"*. The direction is relative to the user's own baseline, not to a norm, so there is nothing to fail |
| **Range band behind the line, labelled with its source** | **Essential for glucose and blood pressure** | Dexcom prints *"70–180 mg/dL is the international consensus"* on its graph. A clinician target, where one exists, replaces our default and says so |
| **Honest axes** | **Never zero-base glucose or BP** | HIG: *"a heart rate chart that always uses zero for the lower bound could obscure important differences"* ([HIG, Charts](https://developer.apple.com/design/human-interface-guidelines/charts)) |
| **Never colour alone** | **Every state carries a word or a shape** | HIG: *"Convey information with more than color alone"* ([HIG, Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)). Red/green range colouring fails for colour-blind users |
| **"N of the last M in range"** | **The TIR metaphor without the dishonest statistic** | With 2–4 fingersticks a day the consensus TIR does not apply; "7 of your last 10 fasting readings were in range" keeps the visual with an honest denominator |
| **Sparkline on each summary row** | **Yes** | Current value, direction and volatility in ~60 px. Essential at 320 px |
| **Year and all-time views** | **Mandatory in v1** | Whoop, Dexcom and Gentler Streak are all criticised for short windows |
| **28-day or 12-month heatmap** | **Yes — this is the consistency view** | A gap is a pale square, not a failure; it shows adherence without a cliff |
| **Activity rings or ring-like progress** | **Refuse** | The HIG forbids imitation. Gentler Streak: *"rings tend to create a subconscious need to complete them"*. And our key variables (pain, glucose context, loading level) are not daily binaries |
| **Streak counter** | **Refuse** | §2 rules 3–4 |
| **A single composite score** | **Refuse** | Oura's *"What does that mean"*. Use words and drivers instead |
| **Badges, trophies, points** | **Refuse for this app's users** | Some people respond to them (Bend's *"I buy it for the streak"*), but this app's users need no motivation (§2 rule 13), and mySugr's points are opaque even to fans |
| **PDF report generation** | **Refuse as the main path; build the page in the app** | *"Why would I generate a reports in pdf?"* (Dexcom, 1★) |

**Per-metric.**

| Metric | Visual |
|---|---|
| **Glucose** | Readings by time of day over a 70–180 mg/dL band, grouped by context chip; "N of the last M fasting readings in range"; a 90-day and 1-year trend in words |
| **Blood pressure** | Systolic and diastolic lines over threshold bands; each reading *set* is one point; a 7-day rolling average, because single readings are noise |
| **Back and leg pain** | Two stacked 0–10 bands over 28 days, aligned with the loading-ladder level, session markers and Status intervals, so cause and effect sit on one screen. **This is the app's most valuable visual, and nothing on the market has it** |
| **Steps** | Daily bars, a 7-day average line and a target line at **7,000**, with a note that the benefit curve levels off around there ([Ding 2025](https://doi.org/10.1016/S2468-2667%2825%2900164-1)). Raising the goal never re-scores past days (Pedometer++) |
| **Adherence** | A 28-day heatmap and "days active in the last 28". No streak |
| **Weight / waist** | A sparkline and trend arrow; never daily bars, because daily weight noise reads as failure |

---

## 7. Features to refuse, ranked

1. **A food diary or calorie counter.** It is the highest-burden feature in the category, Indian home cooking is its worst case (3.7/7), and its documented side-effect is narrowing the user's diet ([Cordeiro 2015](https://doi.org/10.1145/2702123.2702155)).
2. **AI photo food logging.** It needs a backend (C1), and the market's own apps cannot get portions right (Healthify's 1:5 bowl; Yazio's *"vary wildly"*).
3. **Consecutive-day streaks, badges and points.** They create a cliff that our own sync bug could trigger (Pedometer++, WalkFit), they get monetised as guilt (Waterllama's paid streak repair), and points are opaque (mySugr).
4. **Interrupting push notifications.** There is no dependable delivery without a sender, and over-alerting is what put the Dexcom G7 app at 3.10★.
5. **A single composite health score.** *"My readiness is 82! What does that mean"*, and compressing glucose, blood pressure and sciatica into one number hides the signal that matters.
6. **A per-ingredient glycaemic-index or "glucose score" for foods.** GI belongs to the dish: sorghum roti measures 84.1 and sorghum idli 61.3 ([Shobana 2022](https://doi.org/10.4103/ijmr.ijmr_1935_19)). An ingredient-level score would mislead an Indian user systematically.
7. **Bundling the IFCT 2017 tables.** The licence forbids it without written NIN permission, and the AGPL repackaging cannot cure that.
8. **Barcode scanning.** Safari has no `BarcodeDetector`, and it only helps packaged food — the wrong half of an Indian home diet.
9. **Any account, login or cloud sync.** It is forbidden by C1 and C2, and it is a live failure elsewhere: Bend's *"I was no longer logged in"*, and One Drop's disappearance with its users' data.
10. **Social features and leaderboards.** They are pointless for one user, and harmful: users reported *"demotivation from social comparison, particularly from upward comparison with fitter people"* ([Laranjo 2020](https://doi.org/10.2196/19991)).
11. **A custom-metric builder or configurable dashboard.** It is breadth that claims permanent Today space; MyFitnessPal's core got *"lost in the scrum"*. Codex §11.4 already refuses it.
12. **Camera-based form or posture scoring.** A phone camera cannot establish lumbar loading, and a wrong "safe" verdict on a sciatica exercise is a safety failure. The AI chat is already excluded by C4, and Bevel's reviews show why.

---

## 8. The recommended feature set

Effort is relative to this codebase, where ~19,000 lines of tested domain logic carry over (`claude-inventory.md`).

### Ship in v1

| Feature | Why it earns its place | Effort | Front-end feasible on iOS? | Replaces / absorbs |
|---|---|---|---|---|
| **Adaptive Today: one status sentence, one primary action, a fixed "Choose something else"** | The loved apps converge on it; a launch modal is MyFitnessPal's documented failure (§3) | M | Yes | Dashboard, the Today card, and the owner's "ask me what I want" |
| **"Why this?" on every recommendation, correctable** | Gentler Streak's low ratings are about unexplainable status (§2 rule 9) | S | Yes | — |
| **Four tabs: Today / Move / Track / Guide** | HIG: fewer tabs, no overflow | M | Yes | Seven routes |
| **Stretch-only mode (10 min; Back & hips by default)** | The owner's "just my back today"; Bend shows session-length choice is the product. Routed through the existing safety matrix and loading ladder | M | Yes | "Deviating from the programme" |
| **Guided session + 12-week programme (retained)** | Existing asset; answers Bend's and WalkFit's top complaint, the lack of form instruction | S (retain) | Yes — **check for wake lock**, since installed-PWA support starts at iOS 18.4 | — |
| **Status: Normal / Flare-up / Unwell / Away, as a dated interval** | Gentler Streak's manual status, Apple's Pause Rings and Streaks' grace day converge on it. It pauses progression, quiets prompts and keeps those days out of the consistency count | S | Yes | Streak repair, rest-day hacks |
| **Append-only vitals series with provenance and scope** | Glucose and BP currently die inside a check-in record (`claude-inventory.md` D3/D10) | L | Yes (IndexedDB) | The single localStorage blob |
| **Glucose: 2–3-tap entry with a context chip; banded chart; "N of the last M in range"** | The TIR metaphor without the dishonest statistic | M | Yes | — |
| **Blood pressure: reading-set entry, banded dual line, 7-day average** | Single readings are noise | M | Yes | — |
| **Back + leg pain daily, charted against the loading ladder and Status** | Clinically required to separate them (§1.6); nothing on the market shows pain against load | M | Yes | — |
| **Red flags surfaced, not buried** | The cauda equina rules exist in the readiness engine and are nearly invisible today | S | Yes | — |
| **One-tap water** | Waterllama's whole lesson | S | Yes | — |
| **Medication and supplement list with Taken/Skipped, "Log all as taken" and an adherence summary** | Apple's model, plus the summary Apple's own users miss | M | Yes | — |
| **Consistency: 28-day heatmap + "days active in the last 28"** | The graceful replacement for streaks | S | Yes | Streaks, badges |
| **Year and all-time views on every metric** | The most-cited failure of Whoop, Dexcom and Gentler Streak | M | Yes | — |
| **Export/import JSON, one tap from Track; `storage.persist()` on first run; confirmed writes** | Local-only is viable only with this; silent loss is the category's worst failure | S (exists; promote it) | Yes | — |
| **"Summary for my doctor": one printable page** | The AGP principle; buys a share of the referral effect | S | Yes (browser print) | A PDF pipeline |
| **Walk session (foreground, honest labels) + a prompt to walk straight after meals, evening first; post-meal walks recorded as such** | Reynolds 2016: −22% after the evening meal at the same volume; no walking app does this | M | Yes, as "observed active time" | A fake all-day step count |
| **Manual steps as a replacing day total; target 7,000, floor ~4,000, goal owned by the user and never re-scored backwards** | [Ding 2025](https://doi.org/10.1016/S2468-2667%2825%2900164-1); Pedometer++'s goal rule | S | Yes | — |
| **Guide: cited articles + search; Indian plate guidance in katoris and rotis; GI attached to named dishes with a three-word "lower / medium / higher" label** | Gives C6 without a diary; household measures are published (§1.2); the ordinal shape follows Libre Assist without AI | M | Yes (bundled) | The food diary, the AI coach |
| **"No account, no subscription, no cloud" stated in the app** | The loudest unmet demand in the category (§2 rule 7) | S | Yes | — |
| **In-app reminders + app-icon badge for due items + copyable text for Apple Reminders** | A badge waits to be noticed instead of interrupting | S | Yes | Push notifications |

### Later

| Feature | Why it waits | Effort | Feasible? |
|---|---|---|---|
| **Apple Health export (XML/ZIP) import** | The best passive-data route we have, but parsing, deduplication and source conflicts are real work; manual entry must work first | L | Yes, needs verification |
| **STarT Back (9 items) once per flare** | NICE-recommended, but only after the daily two-number loop is proven | S | Yes |
| **ODI or RMDQ as an occasional formal re-measure** | 10–24 items; monthly at most | S | Yes |
| **Sleep: manual hours + one-tap quality, no score** | Useful, but a fourth daily input, and orthosomnia argues against scoring it | M | Yes |
| **Optional "meal check" with an M-SAKHI-style portion picker (vessel × ¼ steps, three roti sizes)** | Only if the owner asks; never a calorie diary | M | Yes |
| **Indian food data beyond guidance** | Only with written NIN permission (nin@ap.nic.in) | — | Licence-blocked |
| **Vitamin B12 / D risk flags and test cadence** | Depends on `clinical-tracking-protocols.md` | S | Yes |
| **Sitting-break prompts (walk, not stand)** | Worthless without dependable delivery; in-app only until then | S | Partly |
| **Web Push** | Needs a sender; rejected for v1 on abandonment grounds (§2 rule 5) | M | Yes, with a scheduled sender |

---

## Five decisions I would make for you

**1. Meals get guidance and a walk, never a diary.**
Remove the food diary from the plan permanently and put two things around meals instead.
- **The case against logging is overwhelming.** Home-cooked ethnic food is the hardest logging category measured (3.7/7). India's largest tracker cannot agree with itself on the calories in kala chana, and misses portions by 5×. A photo journal kept 2.58% of its 189,770 users. The authoritative Indian tables forbid electronic reproduction for a product.
- **Guidance can be concrete without logging.** Write it in the units Indian households already use: katoris, rotis and glasses, which ICMR-NIN's own 2024 guidelines use. Attach GI to dishes, not grains, because sorghum idli and sorghum roti are 23 points apart.
- **The meal itself is the intervention point.** A 10-minute walk straight after the evening meal cut that meal's glucose rise by 22% at no extra total activity. No app in the market treats that walk differently from any other. This is the cheapest, best-evidenced feature in the report, and it is ours to own.

**2. Delete streaks, badges and points. Replace them with a 28-day consistency view and a Status interval.**
- **The peer-reviewed case against streaks themselves is thin, and I won't overstate it.** The case rests on three other things.
  - Habit formation is barely affected by one missed day, and takes 18–254 days.
  - The industry has visibly retreated: Apple added Pause Rings in 2024, and Streaks added a grace day the same year.
  - Users write the same reviews about streaks broken by sync bugs, or sold back to them for money.
- **What decides it is the people this app is for.** They have the conditions, so they do not need motivating. They do have flare-ups. "Days active in the last 28" degrades gracefully. A **Flare-up / Unwell / Away** status, borrowed from Gentler Streak, turns a bad week into an honest record instead of a broken chain.

**3. Make the adaptive Today's "Why this?" mandatory and correctable, and let the user pin a focus.**
- **The opening:** the adaptive hero over a fixed fallback list is right. The loved apps open on status plus one action, and the repeated question is a documented churn driver.
- **The risk:** adaptivity fails when it is wrong and cannot be questioned. Gentler Streak's users write *"still 'overreaching'"* and *"biorhythms?"*.
- **The fix:**
  - "Why this?" lists its real inputs in words.
  - The owner can correct it.
  - Resume always comes first.
  - A manual focus pin means Codex's unevidenced three-choices-in-seven-days threshold never has to be right.
  - On a day a reading is due, the reading is the hero.

**4. Make "back and leg pain against the loading ladder" the signature screen.**
- **Nobody else has it.** Apple Health has no concept of an injury. The App Store's sciatica apps have 0 and 2 ratings. The market-leading stretching app is criticised for exactly the instruction gap our 3D clips and voice fill.
- **The evidence makes walking part of the back plan, not just cardio.** A progressive walking programme almost doubled the time before back pain returned (208 vs 112 days).
- **The input cost is small.** Two 0–10 numbers a day, defaulting to yesterday, plotted against the loading-ladder level, session markers and flare-up intervals, puts cause and effect on one screen. That is the thing a person in a boom-bust pain cycle needs to see.

**5. Treat "no account, no subscription, no cloud — your data stays here" as a headline feature. Back it with persistent storage, confirmed writes and one-tap export in v1.**
- **The market's loudest complaints are about money and ownership:** features moved behind paywalls, a one-time app turned subscription, water you must pay to delete, and coaches who call ten times a day after reading your sugar.
- **One Drop is the warning:** it vanished from the App Store with its users' records inside it.
- **We cannot commit those sins, which makes this the cheapest differentiator available.** The condition is that local must not mean fragile:
  - request persistent storage on first run, which WebKit grants to Home Screen apps;
  - confirm every write before saying "Saved on this iPhone";
  - put export on the Track root, not in a settings drawer.

  Dexcom's *"those most recent entries had DISAPPEARED… I have had to reenter them from memory"* is the review this app must never earn.
