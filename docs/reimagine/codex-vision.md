# FitStrong 90, a calmer daily companion

Product and UX proposal, 8 October 2026. Design reference: an installed iPhone PWA at the requested 430 × 932 CSS pixels. Desktop is secondary. This proposes a journey and content contracts, not implementation.

**Scope note for reconciliation.** The parallel [review board](BOARD.md), created during this pass, now records an owner decision to cut the assistant. The assigned brief explicitly requests an assistant design, so the Ask sections below are conditional review material, not approval to put it in the delivery scope. If that newer decision governs the final product, remove Ask from the chooser and omit its conversation screen; Guide remains the fourth tab, with search, cited articles and structured tools. The other journeys do not depend on a chatbot.

**The decision: four places to go, six ways to act, one recommendation at a time.**

The opening screen should help answer, “What would be useful for me right now?” It should offer a concrete next action, explain the suggestion in one sentence, and make changing direction easy. It should not make the user organise a large feature catalogue before doing something useful.

Use four stable tabs: **Today, Move, Track, Guide**. Today contains one adaptive recommendation and a persistent **Choose something else** action. That action opens six equally discoverable modes: **Stretch, Walk / Move, Guided Session, Log / Track, Learn, Ask**. Most breadth lives inside a chosen task, where it has a reason to appear.

For the existing owner, enrolled in the programme, the usual recommendation remains the guided session. Someone who joins only to stretch can use the same app without enrolling, seeing gym statistics, or completing a training schedule. The 90 day programme becomes the flagship optional plan, rather than a prerequisite for using the product.

## 1. What the current app gives us, and what creates the clutter

This proposal is grounded in the [README](../../README.md), the [guided training design](../superpowers/specs/2026-10-05-guided-training-design.md), all ten files in [src/pages](../../src/pages/), and the current [app layout](../../src/components/layout/AppLayout.tsx). The existing specification includes future and historical decisions; the pages and current types establish what actually exists.

There is substantial value to retain: a profile and readiness engine, deterministic plans, recorded Kokoro coaching, captions, timed sets and rests, 3D demonstrations, per-set logging, resumable sessions, and local history. Stretch mode should reuse this investment. A different home screen should not mean a second coaching system.

The main problems are structural:

| Current decision | Consequence | Proposed change |
|---|---|---|
| Seven destinations, with mobile Progress, History and Settings behind More | Recording and reviewing are less accessible than browsing exercises | Four task-oriented tabs, with Track directly visible |
| A global date / workout header followed by another page title | Two headers compete for the same small viewport | One page title; date and phase become contextual metadata |
| Today shows the session, four statistic tiles, phase progress, four tips and tomorrow | A simple starting decision becomes a dashboard-reading task | Keep the recommendation; move detailed statistics and education to their destinations |
| Workout offers a guided start alongside a separate manual start, supersets, warmup and cooldown controls | Two competing versions of the same workout | One coached entry; keep manual set logging as a deliberate secondary workflow |
| History selects one session with a date-based `find` | A stretch, walk and strength session on the same day cannot all be represented in that detail view | A day contains multiple distinct records, each with its own identity and source |
| Profile edits use the full wizard, and settings repeat some profile values | Small changes require too much navigation and have overlapping ownership | A grouped “You” surface with focused editors |

**Delete duplicated summaries and navigation, not recorded work.** Existing sets, weights, symptom answers, manual workouts, body measurements and identifiers survive the redesign.

## 2. The opening moment

### Ask through the surface, rather than through an interruption

Today presents a sentence such as **“Your next strength session”**, **“Just your back today?”**, or **“A short walk this evening”**, followed by a specific action. Under it, **Choose something else** always appears in the same position. The app has asked what the person wants to do without demanding an answer before showing anything useful.

Apple’s relevant pattern is visible in three different products. Fitness opens into an activity summary and lets people select a workout. Health brings selected data into Summary instead of asking users which health domain they mean on every visit. Breathe, now inside Apple Watch Mindfulness, makes a bounded session easy to start and its duration easy to change. These are familiar starting surfaces followed by explicit action, rather than a recurring intent questionnaire. See [P1], [P5] and [P3]. These are native-product references, not evidence that their sensor or background capabilities exist in a PWA.

**First use is different.** Ask once: **“What would you like more of?”** with three plain choices, **Build strength**, **Stretch comfortably**, and **Move more**. Offer **Explore first** as a quiet alternative. This sets the initial focus, not a permanent identity. Existing users retain their active plan. Ask for safety-relevant profile answers before starting guided movement; let people read, ask general questions and enter past records without completing gym onboarding. Ask about Indian food preferences when they first request meal ideas, not during exercise onboarding.

### Adapt predictably, with an explanation

Use local rules, not a hidden recommendation model. Apply this order:

| Situation | Today’s main surface | Why it takes priority |
|---|---|---|
| A reported urgent symptom, exercise stop outcome, or required reading recheck | The relevant safety or recheck action | A different mode must not bypass a safety restriction |
| A resumable activity exists | “Continue your session, 18 min remaining” | Finish an existing intention before proposing another |
| The user explicitly selected a preferred focus or training time | That focus, within applicable safety limits | An explicit preference outweighs inferred intent |
| Repeated choices favour a short routine in this part of the day, outside any explicit training window | “Back & hips, 10 min”, with “You usually stretch in the morning” | Make a repeated choice easier without hiding the pending strength session |
| Enrolled in the programme, with training scheduled and not completed | Today’s Guided Session, normally 60 min | Preserve the strongest existing path |
| A session is finished, or it is a scheduled rest day | An optional short walk or previously chosen gentle routine | Completion should not trigger another demanding workout |
| There is too little history | The first-use focus, or a neutral invitation to choose | Missing information is not permission to invent a need |

For the first version, require at least three matching activity choices in the same broad morning / daytime / evening period over the preceding seven days before history changes the default. This is a proposed product heuristic, not a health recommendation. For example, a person who regularly stretches before work and has selected evening training can see Stretch in the morning and Guided Session near their training time. The plan row still says **Strength scheduled today**; the app has reprioritised an entry, not cancelled a workout.

Time of day changes wording and the relevance of an existing preference. It cannot establish that the user has eaten, slept, taken medication or needs exercise. Say “After-meal walk” only if the user selected that intention or supplied meal context. Do not infer glucose, mood or pain from inactivity.

Freeze the recommendation while the person is reading Today. Re-evaluate on a new visit, an explicit change, or a new check-in. Show **Why this?** as a small disclosure, with the actual inputs, such as “Training day in your plan; session not completed.” The user can change their preferred focus in You. The six choices never reorder themselves.

The readiness check happens **when starting movement**, not on every launch. Reuse stable profile answers, but reconfirm relevant symptoms for a new session. Reading freshness follows reviewed clinical rules; “checked this morning” is not an all-day clearance. A long interruption or changed symptoms can require a new check before resuming.

### Opening patterns to reject

- **A launch modal asking “What do you want to do?”** It charges a decision tax on every visit, interrupts resume, and becomes a reflexive dismissal by week two.
- **A grid of twenty features.** It exposes the product’s inventory rather than helping the user choose a next action. Small icons also make distinct actions look equally important.
- **Chat as the home screen.** A blank composer requires the user to formulate a request before the app has helped them. It also gives the assistant too much apparent authority.
- **An entirely fixed workout home.** It serves enrolled lifters well but makes “just my back today” feel like abandoning the app’s intended use.

## 3. Navigation and first-class modes

The tab bar has four labels, each with a familiar icon and a visible selected state:

| Tab | Its question | Root screen |
|---|---|---|
| **Today** | What is useful now? | Today |
| **Move** | What movement can I do? | Move |
| **Track** | What did I do or record? | My Day |
| **Guide** | What can I learn or ask? | Guide |

There is no More tab. A single **You** button in each root screen’s title area opens profile, preferences, reminders, offline assets and data controls. It represents local settings, not an account.

**Ask belongs in Guide, but has its own screen and its own row in the mode chooser.** Guide starts with a clearly labelled **Ask the guide** row, above its learning topics. This makes Ask reachable without adding a fifth permanent destination or a floating chat bubble over every task. “First-class” means a predictable named entry and a complete journey, not a dedicated tab for every mode.

| Mode | From Today | From a stable tab | Entry reached |
|---|---|---|---|
| **Stretch only** | Choose something else → Stretch | Move → Stretch | Stretch setup, default **Back & hips · 10 min** for a person with back pain or sciatica |
| **Walk / Move** | Choose something else → Walk / Move | Move → Walk / Move | Walk setup, with timed walking available without location |
| **Guided Session** | Primary recommendation, normally one tap | Move → Guided Session | Readiness / session setup, then the existing coached sequence |
| **Log / Track** | Choose something else → Log / Track | Track → Add | Quick Log chooser |
| **Learn / Guidance** | Choose something else → Learn | Guide | Search and learning topics |
| **Ask** | Choose something else → Ask | Guide → Ask the guide | Ask conversation |

These counts are **to the mode’s entry**, not promises to bypass profile questions, safety checks or permission choices. Track itself opens in one tap. Opening a particular historical chart can take further navigation.

**Move** contains three movement rows, Stretch, Walk / Move, Guided Session, followed by **Your plan** and **Find an exercise**. It has no daily measurements or advice feed. A setup screen carries duration, equipment, relevant modifications and the single Start action.

Stretch is a deliberately composed short routine, not the first ten minutes of an arbitrary gym warmup. It uses the shared catalogue, coaching and restrictions, with a short opening, appropriate mobility or activation, and a wrap-up. “Stretch” is the user’s entry word; the subtitle can explain “gentle mobility and supported movements.” No title promises to cure sciatica. **Change focus** reveals other body areas and durations.

On desktop, the same four destinations become a labelled leading sidebar when space supports it. Detail screens can use a second column. Do not resurrect the seven-item navigation or turn Today into a wall of widgets.

## 4. Screen-by-screen information architecture

“Overflow” below means a named destination for detail, not a generic menu into which anything can disappear. Screens with several mode variants share a layout and a job.

| Screen | Its one job | What is on it | Deliberately absent, and where it goes |
|---|---|---|---|
| **Welcome / Initial Focus** | Establish a useful first action | Three focus choices, Explore first, restore existing backup, local-data explanation | Full health and diet questionnaire; requested at the relevant first action |
| **Today** | Offer the next useful action | Large title, one recommendation and reason, Choose something else, compact recorded-day summary, one plan row if enrolled, at most one opted-in habit prompt | Volume, set totals, streaks, phase essays, tip grid, tomorrow card; Track, Your Plan and Guide hold them |
| **Choose Something Else** | Switch intention | Six fixed rows with concrete labels, duration where meaningful, and the active recommendation identified | Settings, metrics, nested categories; their tabs or You |
| **Move** | Choose a movement journey | Stretch, Walk / Move, Guided Session, Your Plan, Find an exercise | History and long educational articles; Track and Guide |
| **Movement Setup** | Make the selected activity concrete | Routine name, duration, short preview, equipment, current restrictions, Start; Walk offers optional distance measurement | Full exercise instructions and settings; Exercise Detail and You |
| **Readiness** | Decide how this movement should change | Relevant symptoms and readings, timestamps, units, conditional follow-ups, plain outcome and exact changes | Generic wellness score, mandatory mood journal, repeated stable profile questions; optional logs live in Track |
| **Safety / Recheck** | Explain the next safe step after a reported concern | Reason, sourced authored guidance, appropriate care direction or reading entry, navigation to information and records | Start buttons for alternative exercise modes; movement remains restricted as the reviewed rule requires |
| **Session Player** | Help perform the current step | Current movement, side, demo, caption, timer, Pause, Next, Details, visible symptom-stop control | Tabs, charts, chat, articles and plan editing; available after pause or exit |
| **Live Walk** | Show what can be observed during this walk | Active time, optional foreground GPS pace and distance, signal status, Pause, Finish, symptom-stop control | All-day step total, calorie burn, inferred heart rate, map by default; supported records and sources in Track |
| **Activity Summary** | Close the activity and confirm its record | Actual observed minutes / sets, optional symptom follow-up, source or coverage limits, confirmed save state, Done | PR celebration, rewards, a suggested second workout; deeper review in Track |
| **My Day, Track root** | Review a day’s records | Date, Add, Timeline / Trends switch, at most three chosen metric rows, all activity and measurement entries for that date | Every possible tracker and all charts; Quick Log and individual metric screens |
| **Quick Log** | Record one fact | A short list of supported types, then the selected input with value, unit, date, time, source and Save | Clinical interpretation and targets; reviewed guidance or clinician-entered settings |
| **Workout Log** | Record performed sets without coaching | One exercise at a time, reps, weight, optional effort, optional rest timer, notes, save state | A second guided Start, warmup / cooldown builder and superset creation toolbar; coached routines belong in Move |
| **Trends** | Choose one aspect to review over time | Selected metrics in an inset list, a plain period selector, completeness information | A simultaneous collection of volume, weight, waist and PR charts; Metric Detail |
| **Metric Detail** | Explain a single recorded measure | One readable chart, period, units, source, missing-data treatment, accessible values, related entries | Automatic diagnoses or supplement / medication recommendations; Ask can retrieve relevant general information |
| **Day / Record Detail** | Inspect or correct recorded work | Multiple records for the selected day, individual activity details, set edits, source, explicit edit actions | Resetting an entire workout to redo it; another attempt creates another record |
| **Your Plan** | Understand and manage the programme | This week first, current phase, session status including partial / recovery / rest, schedule and progression explanations | All three phase essays expanded by default; Phase Detail is a disclosure |
| **Guide** | Find useful knowledge | Search, Ask the guide, topics: Indian food, movement and back, desk setup, B12 / D, hydration, sleep | A daily article feed, all recipes, featured-product tiles; topic and article screens |
| **Topic / Article** | Explain one issue and a useful next action | Short answer, practical choices, applicability, caution, citations, reviewed date, related action | Unbounded prose and generic disclaimers as the only safety control; Sources and authored escalation flows |
| **Meal Ideas / Meal Detail** | Help assemble a familiar meal | Reviewed Indian meal templates, stated portions, vegetarian / egg / meat choices, substitutions, carbohydrate and salt context, sources | A prescribed clinical diet, glucose prediction or invented macro precision; individual targets remain with the care team |
| **Exercise Library / Exercise Detail** | Find and understand a movement | Searchable catalogue, optional type / area filters, detail demo, cues, modifications, full instructions, sources | Playing 3D demos in every list row; detail loads the existing viewer |
| **Ask** | Clarify a question and offer supported help | Honest capability label, typed question or starter choices, one follow-up at a time, cited response, screen / action links | Typing theatre, a human avatar, hidden model downloads, unrestricted health advice |
| **Sources** | Let the user inspect an answer’s basis | Organisation, document title, edition, exact section, reviewed date, short permitted excerpt, external original link | A link dump or citations added after an unsupported answer |
| **You** | Manage the person’s local preferences | Grouped Profile & Health, Food Preferences, Habits & Reminders, Voice & Demos, Appearance & Text, Data & Offline | Training actions and repeated measurement-entry fields; Move and Track |
| **Profile / Food Preferences** | Edit one relevant group of answers | Focused sections; explicit unknown answers; food pattern, allergies, familiar staples, optional clinician restrictions | Re-running the entire wizard for a voice or schedule change; independent editors |
| **Habits & Reminders** | Set a small, achievable reminder | Chosen habit, timing, foreground reminder behaviour, quiet hours, system-reminder fallback | Guaranteed background alerts, a mandatory water goal or overdue punishment |
| **Data & Offline** | Control what is stored and available | Backup / restore with preview, storage state, downloaded coaching assets, content version, later validated Health import | Accounts, syncing, health-content uploads, or claims that browser storage is permanent |

### Disposition of the existing pages

| Existing file | Decision | Destination and deletion |
|---|---|---|
| `DashboardPage.tsx` | **Keep the role, replace the composition** | Today; delete its statistics grid, separate phase card, tip grid and tomorrow card |
| `SessionPage.tsx` | **Keep and extend** | Shared Guided / Stretch player and summary; consolidate setup so the user does not approve the same session twice |
| `WorkoutPage.tsx` | **Merge, remove as a primary destination** | Workout Log in Track; delete duplicate coached entry, reset-to-redo action and default builder controls |
| `PlanPage.tsx` | **Keep as a child screen** | Move → Your Plan; collapse distant phases and replace duplicated Today presentation with a simple link |
| `LibraryPage.tsx` | **Keep as a child screen** | Move → Find an exercise; Guide search can also return its entries; move filter groups into a Filter sheet |
| `ProgressPage.tsx` | **Merge and delete the standalone page** | Track → Trends / Metric Detail; move the body-metrics form into Quick Log |
| `HistoryPage.tsx` | **Merge and delete the standalone page** | Track timeline, date selector and Day / Record Detail; remove duplicated statistics and destructive “mark incomplete” workflow |
| `SettingsPage.tsx` | **Merge and delete the standalone page** | You and focused settings screens; remove duplicate current-weight and goal entry, and legacy warmup / cooldown toggles from normal settings |
| `ProfilePage.tsx` | **Keep the data, replace the editing journey** | Focused Profile & Health editor under You |
| `OnboardingPage.tsx` | **Keep, shorten and make conditional** | Initial Focus and relevant first-action setup; delete repeated marketing cards and mandatory training enrolment |

These are product decisions for a later change. No existing page or data is being deleted by this document.

## 5. Six important screens at 430 × 932

The wireframes represent the default text size and the requested portrait viewport. Their vertical bands are allocation targets, not measured iOS insets. Reserve an illustrative 56 px at the top and 34 px at the bottom, replacing both with actual safe-area values. Root screens use an approximately 56 px tab bar above the bottom inset. Content has 20 px side margins.

The iPhone 13 Pro Max has a notch, not a Dynamic Island. The requested 430 × 932 is the design reference; verify the actual device viewport, which can differ from that reference. No control is positioned using a guessed notch or Island height. All example activity totals below are illustrative, not this owner’s recorded data.

### A. Today, enrolled user before training

```text
+----------------------------------------------------+
| 9:41              SYSTEM AREA              100%    | 0-56
|                                                    |
| Today                                      (You)   | 56-146
| Thursday, 8 October                                |
|                                                    |
| YOUR NEXT SESSION                                  | 146-390
| Build strength                                     |
| Upper body A                                       |
|                                                    |
| 60 min  |  Mobility, strength, then an easy finish |
| Foundation, week 2                                 |
| Scheduled in your plan.              Why this?     |
|                                                    |
| [             Check in & start                ]    |
|                                                    |
| [          Choose something else              ]    | 406-462
|                                                    |
| RECORDED TODAY                                     | 482-608
| Movement       12 min from a recorded walk         |
| Steps          Not added                  [ + ]    |
| View my day                                   >    |
|                                                    |
| Your plan                                          | 628-706
| This week: 2 sessions recorded                 >   |
|                                                    |
| A desk break, when you are ready                   | 726-790
| Your chosen reminder                   [ Done ]    |
|                                                    |
|                                                    |
| Today       Move        Track        Guide         | 842-898
|   *                                                |
|                  HOME INDICATOR                    | 898-932
+----------------------------------------------------+
```

The habit row is absent until explicitly enabled. Its removal leaves breathing room, not another suggestion. When readiness changes the session, the hero explains that change instead of adding a second warning card elsewhere. A medical stop state replaces the movement CTA.

### B. Choose Something Else, over Today

```text
+----------------------------------------------------+
| 9:41              SYSTEM AREA              100%    |
| Today                                      (You)   |
| Thursday, 8 October                                |
|                                                    |
| YOUR NEXT SESSION                                  |
| Build strength                                     |
| Upper body A                                       |
|                                                    |
|                 dimmed background                  |
|                                                    |
|----------------------------------------------------| sheet
|                      ====                          |
| What would help now?                    [ Close ]  |
|                                                    |
| Stretch                                            |
| Just my back today, 10 min                     >   |
|----------------------------------------------------|
| Walk / Move                                        |
| Start a walk, see time and available pace      >   |
|----------------------------------------------------|
| Guided Session                                     |
| Today's programme, 60 min                     >    |
|----------------------------------------------------|
| Log / Track                                        |
| Add steps, a reading, water or a workout       >   |
|----------------------------------------------------|
| Learn                                              |
| Food, desk setup and everyday habits          >    |
|----------------------------------------------------|
| Ask                                                |
| Questions answered from saved guidance        >    |
|                                                    |
|                  HOME INDICATOR                    |
+----------------------------------------------------+
```

Open at a tall detent, approximately 70% of the usable height, because six rows need room. Offer a nearly full-height detent for larger text. Do not force this into a fashionable half sheet with hidden rows. The underlying tabs are inert while the sheet is open. The chooser has no nested submenu.

### C. Session Player, Stretch variant

```text
+----------------------------------------------------+
| 9:41              SYSTEM AREA              100%    | 0-56
|                                                    |
| [ End ]      Stretch: back & hips        [ ... ]   | 56-130
| ========..........................  06:40 left     |
|                                                    |
| Bird dog                                           | 146-214
| Step 3 of 6  |  Left arm, right leg                |
|                                                    |
|         SIDE VIEW, CURRENT DEMONSTRATION           | 230-490
|                                                    |
|                 O                                  |
|                  \___________                      |
|             _____/           \______               |
|                    |       |                       |
|                    |       |                       |
|         __________________________________         |
|                                                    |
| Keep your hips level.              [ Demo pause ]  |
|                                                    |
|                    00:24                           | 506-594
|                 remaining in this step             |
|                                                    |
| Breathe out as you reach.                          | 610-698
| Return slowly, without twisting your hips.         |
|                                                    |
| [ How to do it ]           [ I feel unwell ]       | 714-774
|                                                    |
| [ Previous ]      [ PAUSE ]       [ Next ]         | 790-874
|                                                    |
|                  HOME INDICATOR                    | 898-932
+----------------------------------------------------+
```

The artwork stands for the existing 3D instruction, not a decoration on the home screen. Guided strength substitutes the current set and target beneath the exercise name; rest reveals reps / weight entry and the next set. Do not put all those controls on a stretch step. The overflow holds audio, repeat instruction and extra time. The safety action stays visible; low-risk appearance is not a reason to hide it.

### D. Live Walk, optional GPS enabled and usable

```text
+----------------------------------------------------+
| 9:41              SYSTEM AREA              100%    | 0-56
|                                                    |
| [ Back ]             Walk               [ ... ]    | 56-130
| Recorded while this screen is open                 |
|                                                    |
|                                                    |
|                    08:42                           | 170-330
|                  active minutes                    |
|                                                    |
|              13:20 min / km                        | 354-468
|              Recent pace, GPS estimate             |
|                                                    |
| 0.65 km                                            | 492-558
| Distance observed by GPS                           |
| Location updating                                  |
|                                                    |
| Steps                                              | 582-674
| This app cannot read your iPhone step total.       |
| Add a total from Health after your walk.           |
|                                                    |
| Keep a comfortable pace.                           | 698-754
| [ I feel unwell ]                                  |
|                                                    |
| [          PAUSE          ]    [ Finish ]          | 790-874
|                                                    |
|                  HOME INDICATOR                    | 898-932
+----------------------------------------------------+
```

Without location, this exact layout becomes a timed walk: pace says **Not measured**, and the distance block offers **Add distance after**. Poor signal says **Measuring pace…**, not `0:00` or an old live number. Returning from the background shows a coverage-gap explanation before continuing. No map or extra rings compete with the main timer.

### E. My Day, Track root

```text
+----------------------------------------------------+
| 9:41              SYSTEM AREA              100%    | 0-56
|                                                    |
| My Day                                   [ Add ]   | 56-146
| <             Thursday, 8 October              >   |
|                                                    |
| [        Timeline *        |       Trends      ]   | 162-206
|                                                    |
| YOUR CHOSEN MEASURES                               | 226-432
| Steps                                              |
| 4,820, manual total from Health                  > |
|----------------------------------------------------|
| Water                                              |
| 750 mL, three entries                            > |
|----------------------------------------------------|
| Sleep                                              |
| Not entered                                     >  |
|                                                    |
| ACTIVITIES & ENTRIES                               | 456-774
| 07:10   Back & hips                                |
|         10 min stretch, recorded session         > |
|                                                    |
| 13:20   Walk                                       |
|         9 observed min, GPS gap noted            > |
|                                                    |
| 14:05   Water                                      |
|         250 mL, manual entry                     > |
|                                                    |
| 18:00   Daily steps                                |
|         4,820, replaces earlier manual total     > |
|                                                    |
| Choose which measures appear here               >  |
|                                                    |
| Today       Move        Track        Guide         | 842-898
|                           *                        |
|                  HOME INDICATOR                    | 898-932
+----------------------------------------------------+
```

The chosen measures summarise the entries beneath them; they are not additional records. The same day can contain several movement sessions. Steps remain a provisional day total if entered before the day ends. A user who has not chosen measures sees the timeline and Add, not three empty starter cards.

### F. Ask, an ordinary-meal question

```text
+----------------------------------------------------+
| 9:41              SYSTEM AREA              100%    | 0-56
|                                                    |
| < Guide              Ask               [ Clear ]   | 56-130
| Saved guidance, no live AI or clinician            |
|                                                    |
|                         Can I have roti and dal?   | 146-206
|                                                    |
| I can help you think about the whole meal.         | 226-358
| Would you like a meal idea around roti and dal,    |
| or help reviewing your usual portion?              |
|                                                    |
| [ Meal idea ]        [ My usual portion ]          |
|                                                    |
|                                        Meal idea   | 378-430
|                                                    |
| Roti and dal can fit into meal planning.           | 450-634
| Both contribute carbohydrate; amounts and          |
| the rest of your meal matter. A vegetable          |
| side and your usual clinician-agreed portions      |
| are useful starting points. [G1] [G3]              |
|                                                    |
| Using: vegetarian, diabetes, BP concerns           |
| [ Change context ]                                 |
|                                                    |
| [ Adapt my plate ]     [ View sources ]            | 658-722
|                                                    |
| General information, not medical advice.           | 738-778
|                                                    |
| [ Ask about food, movement or habits...      Send] | 794-858
|                                                    |
|                  HOME INDICATOR                    | 898-932
+----------------------------------------------------+
```

This illustrates a reviewed response template, not an already approved clinical answer. The full scope label expands to what the guide can and cannot do. The keyboard pushes the composer above it; the transcript scrolls and the tab bar gives way to the keyboard. Do not pin the composer to a guessed screen height. Source labels open the exact claims and guideline sections.

## 6. Apple design philosophy, translated into this app

**Make hierarchy do the work.** Today gets a large title, one hero and one dominant button. Guide and Track use grouped inset lists. Each row has a meaningful noun and a concise second line. Keep backgrounds quiet, separators subtle, and avoid putting every sentence inside an outlined card. Remove the current duplicate global workout header. Do not make every section entrance animate.

**Typography should feel native and remain flexible.** Use the system font stack on iPhone, with platform fonts elsewhere. Start with a 34 px large title, 22 px section title, 17 px body and 15 px supporting text, expressed in scalable units. Live timers and pace use tabular numbers around 56 to 64 px. Important safety text uses body size, not a tiny footer. Inputs are at least 16 px to avoid unwanted iOS focus zoom. Controls have a minimum 44 × 44 px target, normally a 56 px main action.

A web PWA does not inherit every native Dynamic Type behaviour automatically. Support browser text enlargement, readable line lengths and 200% text without truncating essential labels. **To verify:** how iOS text-size settings affect this installed app. If they do not propagate reliably, add a simple Default / Large / Extra Large preference under Appearance & Text. At large sizes, allow a screen to scroll, expand sheets, and shrink the demo before hiding a control. Never disable user zoom.

**Use sheets for bounded decisions and pages for sustained work.** Choose Something Else is a tall sheet. Readiness begins compact and expands for health follow-ups. A numeric log can be a short sheet that expands above the keyboard. A meal article, plan and conversation get full pages. Avoid nested sheets; selecting an article or another task closes the current sheet and navigates. Detents are web layout states to implement, not native UIKit capabilities to assume. Every sheet has a labelled close control, proper focus handling and a predictable return point.

**Use one action accent.** A deep teal identifies selected navigation and primary actions across the app. Preserve the existing mobility / strength / cardio colours only in the session’s labelled block strip and legend. Do not assign a bright colour to every health domain. Amber and red communicate cautions and stop states, accompanied by words and icons. A red muscle demonstration is explicitly labelled **Common mistake** so it cannot be confused with an overall health status.

**Borrow the readability of rings, not Apple’s three-ring contract.** Use one optional ring for a user-selected **recorded movement minutes** goal in Track, with “12 of 20 chosen minutes” alongside it. Count only recorded activity time; expose overlaps and gaps. Do not copy Move / Exercise / Stand rings when this app cannot observe calories, all-day intensity or hourly standing. Stretch completion can be recognised without pretending it constitutes moderate aerobic exercise. Rest prescribed by the plan or safety rule is a valid day, not a broken streak.

**Use the icon vocabulary already available.** Lucide supplies simple, SF-Symbol-like forms: footprints, activity, notebook, book, message circle and person. Keep sizes and stroke weights consistent, and retain text labels. Do not redistribute SF Symbols as if they were an unrestricted web icon pack, or imitate Apple branding.

**Feedback must work without vibration.** Haptics are an enhancement if a verified API exists, never the sole countdown or stop cue. Assume no reliable Safari vibration. Captions and visible state changes are primary; optional chimes use the existing audio system. Do not build a health interaction that requires a tactile response.

**Light and dark are equally designed.** Follow system appearance by default. Light mode uses pale grouped backgrounds and strong dark text; dark mode uses distinct opaque surfaces with tested contrast. Avoid translucent “Liquid Glass” styling behind pace, captions or readings, particularly outdoors. Selection, error and source labels must remain clear in both themes.

**Motion should explain a change of state.** A short sheet transition and a quiet timer update are sufficient. Honour `prefers-reduced-motion` for navigation, ring fills and decorative motion. Retain the repository’s explicit decision that instructional 3D demonstrations can play, with an immediately visible pause control and text alternatives. Do not treat a therapeutic-sounding breathing animation as mandatory pacing for every person.

**Respect the actual device frame.** Use safe-area insets and available viewport height for top chrome, bottom actions and keyboard changes. The iPhone 13 notch and later Dynamic Islands are system-owned areas. The PWA should not draw a fake Island, advertise native Live Activities, or place important controls against the cutout. Keep a simple in-app return-to-session strip only when an activity is paused and the person has left its player.

What to copy from Apple: stable destinations, strong typographic hierarchy, familiar lists, bounded sheets, clear feedback and the calm of a task in progress. What to avoid: sprawling Health category screens on Today, competing rings, promotional carousels, unclear icon-only actions, excessive material effects and the assumption that native hardware integration is available on the web.

## 7. The assistant, useful through a smaller and honest contract

**Recommend a guided conversational agent over bundled, cited content, with no runtime LLM.** The product label is **Ask**, and its scope label is **Saved guidance**. The first explanation says: “I can find guidance, ask a few questions and help you open the right activity or log. I use reviewed content saved in this app. I am not a clinician or a live AI service.”

| Approach | Decision | Product reason |
|---|---|---|
| Local retrieval, authored responses and structured follow-ups | **Build this** | Immediate, offline, predictable on this phone, and able to expose the exact basis for an answer |
| A small browser model through WebGPU | **Defer beyond this design** | A download around the scale described in the brief, memory pressure, uncertain device / OS support and health hallucinations are a poor trade for this audience |
| Bring your own API key | **Exclude from this local-only product** | It sends questions or health context to an external provider, can incur cost, and leaves a browser-held credential exposed to the origin; calling it opt-in does not preserve the core promise |

No paid API and no server also means no “temporary” proxy, shared secret shipped in JavaScript, or free-service dependency hidden behind the chat UI. A future generative experiment would need a separately reviewed product contract; this design does not depend on it.

### The conversational contract

1. **Recognise a bounded intent.** Local search covers food / meal adaptation, B12 / D, movement choice, desk setup, hydration, sleep and record entry. Index synonyms such as roti / chapati, curd / dahi and “just my back.” Search returns content IDs and matching passages; it never creates a new health claim.
2. **Clarify uncertainty.** Ask one question at a time. Use saved preferences visibly, allow correction, and distinguish unknown from no. Ambiguous searches show two likely interpretations or matching articles. Do not pretend a weak match was understood.
3. **Apply authored applicability and safety gates.** A food question about an ordinary meal is different from treating a low. Symptoms or medication questions route to specific reviewed flows or a clear scope boundary. Typed text is not a reliable emergency detector; users always have a direct “I feel unwell” path.
4. **Answer briefly and cite at the claim.** Usually one short paragraph and up to three practical choices. The response template names its supporting claims and exact source sections before publication. “NIN” attached to an entire conversation is insufficient.
5. **Offer an explicit handoff.** “Adapt my plate” opens Meal Ideas with the selected context. “Start a gentle routine” opens Stretch setup and readiness. “Add a reading” opens a prefilled Quick Log that still needs review and Save. The guide never silently logs, starts movement, changes goals or overrides restrictions.

Conversation state lasts for the current local app session by default. Saving an answer bookmarks its content ID and version; it does not require retaining the user’s entire health conversation. Clear is visible. There is no analytics event containing a question, no remote embedding service, and no external search request built from health context.

### Three designed exchanges

**Food:** “Can I eat rice if I have diabetes?” Treat an ordinary food question as meal planning, retrieving reviewed carbohydrate / plate guidance and asking about the rest of the meal and the person’s familiar portion. Do not add an acute-symptom questionnaire to every food lookup. If the person mentions a low reading, symptoms or uncertainty about treatment, switch to the relevant reviewed flow and clarify that context before giving food suggestions. The ordinary-meal response can explain that rice, roti and pulses contribute carbohydrate and offer an Indian meal template with vegetables and suitable protein choices. It must not declare a food “diabetes safe,” prescribe a personal carbohydrate allowance, predict a glucose rise, or make millet an unlimited substitute. The content derives from [G1], [G2], [G3] and verified food data [G12].

**Back:** “My leg tingles. Should I stretch harder?” Do not produce a stretch routine in the chat. Say that increased or spreading leg symptoms need the existing symptom check, cite the relevant reviewed rule and [G7], and offer **Check symptoms**. The resulting restriction applies across Move. Emergency warning signs go to Safety / Recheck; the source organisation’s UK phone number must not be copied into an Indian care direction.

**B12:** “What dose should I take?” Say, “I can explain food sources and what to discuss with your care team. I cannot choose a treatment dose or determine whether you have a deficiency.” Offer **Food sources**, **Questions for my clinician**, and the cited article [G5]. Do not convert a lab number, symptoms or a medication name into a supplement prescription.

**Refuse plainly:** diagnosis, medication or insulin changes, treatment doses, claims to reverse diabetes or cure sciatica, and unsupported food / exercise recommendations. If there is no reviewed answer, say **“I do not have a reviewed answer for that”**, then show relevant sources or a care-team question. The assistant must not fabricate a citation or answer from plausible-sounding general knowledge.

## 8. Health and Indian-diet guidance as a content system

The app needs a modest, maintained knowledge library, not a collection of long Markdown articles. Author structured records and render the same records in learning screens, readiness explanations, meal tools and Ask. Existing [exercise coaching records](../../src/data/coaching/) are a useful foundation; their source URLs need finer claim and section mapping.

### Proposed records, without introducing implementation code

| Record | Required data | Why the structure matters |
|---|---|---|
| **Source** | Stable ID, organisation, title, edition / publication date, URL, section / table locator, jurisdiction and population, access date, licence / excerpt permission | A user can inspect the actual basis; UK general guidance is not silently treated as an Indian prescription |
| **Claim** | Stable ID, authored statement, supporting source IDs and locators, evidence strength / limits, applicable populations, exclusions, reviewer, reviewed date, review-by date, publication state | Every health statement can be traced and withdrawn independently |
| **Guidance Card** | Topic, search aliases, question answered, summary claim IDs, practical actions, caution / referral claim IDs, related records, action handoffs | One record works in an article, search result or conversation |
| **Food** | Indian and regional names / aliases, food group, preparation, portion unit and measured amount, nutrition source, carbohydrate / sodium / B12 / D fields with known / unknown status, allergens, dietary pattern | “One roti” is not falsely treated as a standard weight; missing nutrient data remains missing |
| **Meal Template** | Components and portions, serving count, substitutions, cooking / salt assumptions, linked foods, applicable preferences, restrictions needing review, supporting claims | Support a familiar meal without generating an unsourced clinical diet |
| **Question Flow** | Intent IDs, question text, answer choices, unknown path, branching rules, required context, escalation path, response-template IDs | Follow-ups are explicit and reviewable rather than improvised |
| **Response Template** | Allowed claims, applicability rules, question slots, source labels, refusal text and named action handoffs | The conversational surface cannot expand beyond approved content |
| **Habit** | Named behaviour, user-selected cue / interval, reason claim IDs, restrictions, reminder delivery modes, quiet hours | Hydration and desk breaks share a clear reminder contract |
| **Local Context** | Explicit preferences and health-profile references, consent to use each group, clinician-entered restrictions with provenance, relevant current-session facts | Personalisation selects appropriate content; it does not invent targets or infer a diagnosis |

### The initial content set

| Domain | Useful content to publish | Boundary |
|---|---|---|
| **Indian food, diabetes and BP** | Plate composition; rice / roti / dal context; breakfast examples such as idli with sambar; familiar lunch and dinner templates; vegetable and protein substitutions; added salt, pickle, papad, sauces and packaged-food labels | No universal roti count, daily calories, glycaemic prediction, or “good / bad food” score. Pulses supply both protein and carbohydrate. Personal requirements remain individual |
| **Vitamin B12** | Verified sources including appropriate animal foods and fortified products; vegetarian / vegan limitations; questions about symptoms, testing and possible absorption problems | Do not imply dal, greens or ordinary fermented foods reliably treat deficiency, or prescribe supplements from symptoms |
| **Vitamin D** | Verified food / fortification information, deficiency and testing questions, limits of food-only strategies | No sunlight countdown based on the clock; no UK seasonal schedule or supplement dose automatically transplanted to India |
| **Desk setup and sitting** | Supported feet, comfortable chair / screen setup, relaxed shoulders, changes of position, short movement breaks, illustrated adjustments | No single perfect posture, pain diagnosis, rigid “sit straight all day” instruction or camera posture score |
| **Hydration** | Fluid-aware habits, user-defined serving size, sensible contextual reminders | No mandatory two-litre target. Kidney / heart disease and prescribed fluid restrictions suppress generic “drink more” nudges |
| **Sleep and daily habits** | Regular schedule, wind-down choices, daytime light / activity context, when persistent problems merit review | No diagnosis of sleep apnoea, assumed sleep from phone inactivity, or guaranteed health outcome |
| **Movement and back care** | Existing exercise technique and modifications, readiness explanations, supported general activity information | A demo describes form; it does not prove that the app knows how this person moved or that an exercise is safe for every back condition |

For meal ideas, ask about vegetarian / egg / meat preferences, allergies, usual staples and any prescribed restrictions. Region and budget are optional refinements. Offer **Adapt my usual meal** before a seven-day menu: it is more useful than assigning unfamiliar foods to a person who already cooks Indian meals.

A later weekly view should assemble the same reviewed meal templates, not generate a new diet. Portions must be explained as template servings and adjustable examples. If nutrient totals are shown, they need a food-data source, preparation assumptions, calculation method and an estimate label. Do not invent GI, B12, D or sodium values for a homemade dish. Potassium-based salt substitutions require specific caution, especially with kidney disease or relevant medicines; generic BP guidance must not recommend them by default.

### Citation and review discipline

Use **ICMR-NIN** for Indian dietary patterns and food data, **ADA** for diabetes-specific guidance, **WHO** for activity and sodium guidance, and **NHS** for accessible explanations of vitamins, hydration, sleep and warning symptoms. Add sources such as HSE for the specific desk-setup material. These organisations are complementary, not interchangeable.

Before activation, a disease-specific meal template, exercise rule or escalation flow needs exact source locators and appropriate qualified review. An engineer’s schema test cannot establish medical validity. The existing rules are assets to preserve and review, not newly certified by this UX proposal.

Every relevant article and Ask answer shows **“General information, not medical advice.”** Applicability and specific cautions appear near the action they affect. Do not hide the boundary only in Settings, or require a disclaimer confirmation before every harmless lookup.

The bundled content contains authored summaries and permitted short excerpts, so citations remain inspectable offline. The original opens only on an explicit tap, without a health-containing query or URL parameter. Show the content edition and reviewed date. When review is overdue, label it; expired safety-critical guidance cannot power a new recommendation. Updates arrive as static content releases with the PWA, not through a clinical-content server.

## 9. Tracking that stays honest

**The app records what was observed or supplied. It does not continuously observe the person.** A visible source label is part of the value, not an optional debugging detail.

| Capability | Honest UX | Design dependency and fallback |
|---|---|---|
| **Live walking pace** | “Recent pace, GPS estimate”, with signal state; timed walking works without location | **To verify on the actual iOS version:** foreground geolocation cadence and quality in the installed PWA. Location is requested only after opting into distance measurement |
| **Steps throughout the day** | “Add today’s steps”, optionally “Read the total in Apple Health”; entry says Manual, reported from Health | No browser HealthKit access or dependable all-day background pedometer is assumed. Never label a blank day `0 steps` |
| **Foreground step estimation** | Omit from the default product | **Unverified:** motion permissions, sensor availability and accuracy. A future experiment must say “Estimated during this open session”, and cannot become an all-day total |
| **Manual distance / activity** | “Distance you entered” and “Time you entered” | A supplied treadmill distance is useful; it is not GPS measurement. Never derive steps from distance and label them counted |
| **Health export import** | “Import a snapshot from Apple Health”, with dates, selected types, sources and preview | Apple documents XML export [P2]. **To verify:** practical file selection, ZIP / XML parsing and resource limits on this phone. Until validated, manual entry is the supported path |
| **BP / glucose / body measurements** | Number, explicit unit, time, manual or imported source, optional notes | No live cuff / CGM connection, interpretation as a diagnosis or automatic medication adjustment |
| **Sleep and hydration** | Manual duration or entries; missing remains “Not entered” | No background sleep inference, automatic cup detection or default fluid prescription |
| **Reminders** | “Shown while the app is open”; offer text to copy into Apple Reminders for dependable delivery | No server means no product promise of scheduled Web Push. Background JavaScript timers are not a local-notification scheduler |
| **Voice, wake lock and earphone controls** | Screen-on coaching with captions; explicit recovery when interrupted | **To verify:** installed-PWA behaviour, audio interruptions, wake lock and Media Session on this iOS version. All core actions remain on screen |

### A live session has observable boundaries

For walking, count **observed active time** while running in the foreground. Pause recording on loss of visibility and mark the unobserved interval. On return, say **“Recording paused while the app was away. Continue, or add the missing time?”** A manual correction is stored as a correction, not retroactive observation.

GPS samples with inadequate accuracy, stale timestamps or implausible jumps cannot produce a live pace. Smooth usable samples into a recent estimate; avoid instantaneous walking-speed jitter. Do not draw a straight line across an unobserved gap and count it as distance. Display **Not measured** or **Measuring pace…** when appropriate. Keep only useful session summaries by default, rather than building a permanent location archive.

Guided timers retain the existing wall-clock and resume work, but elapsed clock time cannot prove a set or movement was performed. Preserve logged work, distinguish an interruption, and resume at a clear step. Do not silently complete skipped activity because the phone was locked.

### Daily records need provenance, not just values

Each record carries a stable ID, kind, value and unit, event time / date with timezone context, source, scope such as session or day, observed coverage, and any edit or import provenance. An imported reading is not a fresh check-in reading merely because it was imported today.

Daily steps are a total or snapshot, not an additive drink-style entry. An updated manual day total replaces the earlier manual total. Walking-session steps, if ever supported, are not added again to an all-day Health total. Movement minutes count distinct activity intervals; overlapping intervals are flagged instead of silently summed. Plan adherence is separate from general recorded movement.

Health exports are historical snapshots, not synchronisation. Raw Watch and iPhone samples can overlap, and naive summation does not reproduce Apple Health’s own aggregate. Select sources, deduplicate records, expose conflicts and label imported sample totals honestly. If a trustworthy day total cannot be established, retain the records for inspection and ask the user to enter the Health total instead of manufacturing one.

A Health importer is a later feature, after the core manual journey. It must let the user preview types and dates, ignore unsupported personal data, keep parsing local, handle large files within tested limits, and store compact selected records rather than the raw archive in localStorage. Duplicate imports must not inflate totals. A date filter alone does not solve the cost of reading a large archive.

For reminders, the dependable first release offers foreground prompts and a clear **Set this in Reminders** instruction with copyable text. **To verify before offering:** whether a calendar file with an alarm can be imported reliably from this PWA on this phone. Do not ship a button that implies a successful OS reminder merely because a file was downloaded.

All records remain local. Browser storage can be cleared or exhausted; it is not an encrypted clinical vault or an assured backup. Confirm writes before showing “Saved on this iPhone,” provide a useful storage-failure state, and offer explicit export. Restore and import show a preview and explain whether records will merge or replace before a destructive replacement. No health transcript, import, GPS route or API credential is sent to a service.

## 10. The 90 day programme’s place

**Make it optional to enter, and central once chosen.** The application’s organising spine is the day; the programme’s organising spine is progression. Keeping those separate lets the owner retain a rich training plan while a stretch-only user gets a complete product.

The programme remains prominent in three places: Today’s recommendation on training days, Move’s Your Plan row, and an adherence view in Track. Preserve Foundation, Hypertrophy and Strength, deloads, taper, progression, modifications, coaching and historical loads. Do not dilute it into one anonymous tile among dozens of unsupported plans.

Only one strength plan is active at a time. In this redesign the existing programme is the one reviewed flagship; “several plans” is a future content capability, not a plan marketplace to build now. Stretch and Walk are independent routines, not competing strength programmes.

A missed or modified session is recorded honestly. It does not become completed because the person walked. Rest does not erase progress. Pause / resume and schedule changes should be explicit, preserving history and spacing constraints rather than silently jumping to a harder phase after a long break. Returning after a break requires a reviewed re-entry policy; the assistant cannot invent one.

There is also a naming issue to resolve: the app calls itself 90 day, while `TOTAL_WEEKS` and the phase structure are twelve weeks. Twelve weeks are 84 days. Use **Week 2 of 12** in the UI until the product explicitly defines the remaining days; do not invent six extra training days or alter progression as a cosmetic fix.

## 11. What this app should refuse to build

1. **An AI clinician.** No diagnosis, insulin titration, medication changes, personalised supplement treatment or “reverse diabetes” plan. The harm and evidence burden are incompatible with an offline guidance companion, and a disclaimer cannot repair an unsupported answer.
2. **Automatic all-day monitoring and a pretend Apple Health connection.** No background step counter, inferred sleep, continuous glucose / BP dashboard, or guaranteed scheduled notifications. Build useful foreground sessions and explicit records within the PWA’s actual boundaries.
3. **Camera scores for form, posture or meal safety.** A phone camera cannot establish lumbar loading, nerve involvement, food composition or an individual glucose response with the confidence this audience needs. Preserve the 3D teaching asset; reject a “98% safe” score.
4. **An unlimited dashboard and automation builder.** No widget marketplace, configurable rings for every variable, twenty persistent trackers or many simultaneous plans. Support the named domains and optional custom notes / simple named measurements under Add. Unrecognised measurements get no clinical interpretation, targets or automatic recommendations. Breadth must not consume Today.

## 12. A design that survives the platform research

The critical journey depends only on local profile data, reviewed bundled content, manual input, foreground timers, captions and user-initiated audio. GPS improves Walk, imports improve historical tracking, and haptics or earphone controls improve comfort. None is a prerequisite for Stretch, the programme, logging or Ask.

The uncertainty labels above are intentional. The parallel iOS research should be able to remove GPS, Health-file import, background audio or a reminder-delivery method without changing the four tabs or creating a dead-end mode. Capability descriptions in the interface must come from verified behaviour, not just API presence.

Suggested acceptance targets for a later prototype, not measurements already achieved:

- A returning user identifies and reaches any of the six modes within two taps from Today, before necessary safety or permissions work.
- The habitual guided start does not require reselecting a mode or reading a dashboard.
- A stretch-only user sees no empty programme phase, lift-volume statistics or required gym schedule.
- A normal day can show Stretch, Walk, strength and several logs as separate records without double-counting.
- The six key screens remain usable at the requested 430 × 932, the actual installed-device viewport, 320 px width and 200% text enlargement.
- A denied location permission, background interruption, missing steps and storage failure each produce an honest usable state.
- An ordinary food question returns a reviewed claim and actionable screen link; a dosing request or missing source returns a clear boundary.
- A reported stop condition applies to every movement entry, including Stretch, Walk, manual current-session guidance and Ask handoffs.

## References and source boundaries

Public HTML pages and PDF endpoints were checked on 8 October 2026. This is a product proposal, not a completed clinical review of those documents. The content system must pin editions and exact sections before activating claims. Apple support references describe native journeys; they do not establish PWA capabilities.

| ID | Primary reference | Use in this design |
|---|---|---|
| **G1** | [ICMR-NIN, Dietary Guidelines for Indians, 2024][G1] | Indian food patterns, meal examples, dietary context |
| **G2** | [ADA, Standards of Care in Diabetes, 2026 entry point][G2] | Governing diabetes recommendations; select and review the applicable nutrition / activity sections |
| **G3** | [ADA, Eating Well & Managing Diabetes][G3] | Accessible diabetes plate and carbohydrate explanations |
| **G4** | [WHO, Sodium reduction][G4] | Sodium context, salt reduction, cautions about substitutions |
| **G5** | [NHS, B vitamins and folic acid, vitamin B12 section][G5] | Food sources, limitations and deficiency-information boundary |
| **G6** | [NHS, Vitamin D][G6] | Vitamin D information, supplement and geography cautions |
| **G7** | [NHS, Sciatica][G7] | Symptom context and urgent warning signs; localise care directions |
| **G8** | [NHS, Water, drinks and hydration][G8] | General hydration information, not an individual fluid prescription |
| **G9** | [NHS, Insomnia][G9] | General sleep habits and reasons to seek review |
| **G10** | [WHO, Physical activity][G10] | Activity and sedentary-behaviour context; not an app-specific step target |
| **G11** | [HSE, Good posture when using display screen equipment][G11] | Specific workstation adjustments and illustrations |
| **G12** | [ICMR-NIN, Indian Food Composition Tables, 2017][G12] | Verified food composition; recipe calculations still require explicit assumptions |
| **G13** | [WHO, chronic primary low back pain guideline, 2023][G13] | General back-care context; its scope must not be expanded to every injury or neurological condition |
| **P1** | [Apple, See your activity summary in Fitness][P1] | A familiar summary surface and explicit workout choice |
| **P2** | [Apple, Share your data in Health][P2] | Summary / profile entry and documented XML export |
| **P3** | [Apple, Start a Reflect or Breathe session][P3] | A focused bounded task with adjustable duration |
| **P4** | [Apple Human Interface Guidelines, Tab bars][P4] | Navigation reference; detailed web adaptation is this proposal’s judgement |
| **P5** | [Apple, View your data in Health][P5] | Pinned Summary categories, selected data and drill-down |

[G1]: https://www.nin.res.in/downloads/DietaryGuidelinesforNINwebsite.pdf
[G2]: https://professional.diabetes.org/standards-of-care
[G3]: https://diabetes.org/food-nutrition/eating-healthy
[G4]: https://www.who.int/news-room/fact-sheets/detail/sodium-reduction
[G5]: https://www.nhs.uk/conditions/vitamins-and-minerals/vitamin-b/
[G6]: https://www.nhs.uk/conditions/vitamins-and-minerals/vitamin-d/
[G7]: https://www.nhs.uk/conditions/sciatica/
[G8]: https://www.nhs.uk/live-well/eat-well/food-guidelines-and-food-labels/water-drinks-nutrition/
[G9]: https://www.nhs.uk/conditions/insomnia/
[G10]: https://www.who.int/news-room/fact-sheets/detail/physical-activity
[G11]: https://www.hse.gov.uk/msd/dse/good-posture.htm
[G12]: https://www.nin.res.in/ebooks/IFCT2017.pdf
[G13]: https://www.who.int/publications/i/item/9789240081789
[P1]: https://support.apple.com/guide/iphone/see-your-activity-summary-iph4c34a8a95/ios
[P2]: https://support.apple.com/guide/iphone/share-your-health-data-iph5ede58c3d/ios
[P3]: https://support.apple.com/guide/watch/start-a-reflect-or-breathe-session-apd371dfe3d7/watchos
[P4]: https://developer.apple.com/design/human-interface-guidelines/tab-bars
[P5]: https://support.apple.com/guide/iphone/view-your-health-data-iphe3d379c32/ios

## Questions for Claude

1. **Does Guide hide Ask too much?** I prefer four tabs and a labelled Ask entry over a permanent fifth tab. Challenge whether two taps are acceptable for an owner who explicitly wants conversation, and whether a fifth tab would improve use enough to justify its prominence.
2. **Is the fixed six-row chooser the right amount of breadth?** It makes every mode discoverable, but a frequent stretch user may deserve a direct pinned shortcut. Can that improve speed without turning Today back into a widget collection?
3. **Should the programme remain the whole app’s spine?** I chose an optional flagship that dominates Today after enrolment. What evidence would justify making every user enter through the programme instead?
4. **Does the board’s assistant cut govern the final scope?** If so, take the five-mode variant and keep Guide as search, cited articles and structured tools. If Ask remains under discussion, will a deterministic conversational guide satisfy the expectation, and where should a weak match fail without implying LLM-level comprehension?
5. **Which existing clinical assumptions need review before a new mode can reuse them?** In particular, challenge the short back routine, nerve-related flows, reading freshness, generic walking fallback and clinician-target handling. A familiar engine is not evidence that every rule is suitable for the expanded product.
6. **What did the iOS research actually establish on the owner’s installed PWA?** Separate observed behaviour from API support for foreground pace, motion sensors, audio, wake lock, file imports and reminder delivery. Which proposed enhancement should be removed entirely?
7. **How should overlapping data be resolved without implying Apple Health aggregation?** Challenge the manual-total-first strategy, imported source selection, day-boundary handling and the distinction between recorded movement and programme adherence.
8. **Does “fitness cycle” mean the training programme, another habit cycle, or something else?** This proposal assumes programme progression. It should not quietly introduce menstrual, glucose or other clinical prediction features on that phrase alone.
9. **How should the product reconcile 90 days with twelve weeks?** Keep the existing engine and describe twelve weeks, or explicitly define a separate opening / closing period? The design should not conceal the difference with a misleading completion ring.
