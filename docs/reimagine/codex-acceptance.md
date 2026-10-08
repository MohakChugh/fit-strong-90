# Acceptance suite for the rebuilt health app

Written on 8 October 2026. This is a specification for the final browser run, not a report that the app passed. All profiles, readings and dates below are synthetic fixtures. Run against a disposable browser context, never the owner's only record.

**Revised 8 October 2026, after the first full run.** These are test-side changes agreed with the coordinator; the app findings from that run stand.
- J11's GPS fixtures now arrive every 10 seconds. iOS reports about one fix a second while moving, and the app treats more than 20 seconds without a fix as lost signal (`GPS.lostAfterMs` in `src/walk/gps.ts`, re-audit F15). The one deliberate silence longer than 20 seconds is the new lost-signal row, step 8.
- J07 step 3 no longer expects a floor near 4,000 steps (D27 superseded in part, after content audit F15). It finds the user's daily steps goal in Track's Steps detail: optional, no default, and never re-scoring past days. Until that control ships, the suite reports the goal checks as pending an agreed app change rather than failed.
- J18 step 1 creates reading state by merging a backup that carries one reading-state row. No screen writes reading state, so this is the defined setup, not a workaround.
- J10 step 4's save acknowledgement is `Saved on this device`, not `Saved on this iPhone`: the app must not claim an iPhone on every device (the coordinator's wording decision).
- J07 step 7 reads reminders where they float, on a screen other than Today. Today shows a waiting reminder inline only when it is the top prompt, and otherwise counts it on the app badge. The dismiss answer is `Later`.
- D35: someone not in the programme cannot start the guided session. Move's Guided session row is then only the way to join, and Today's check-in for Guided records the answers but starts nothing. Only P01 is enrolled. Check-in rules that apply to every mode now run through Stretch, or through Walk where the case is about walking, so “each mode” and “all modes” for P02–P06 mean Stretch and Walk (J12, J14, and J16 steps 3–5 and 8). Cases about the guided session itself seed the persona in the programme as the defined setup: `settings.startDate` `2026-09-24`, with the envelope's Monday, Thursday and Saturday training days, so Thursday 8 October is a programme day (J15 steps 3 and 6, J16 step 6).
- While the engine refuses movement, the Stretch and Walk setups refuse before any tap (scan S-15). Where a case used to tap Start and find the refusal in the check-in, it now asserts the stronger behaviour: no Start, the reason on screen before any tap, and `Review today’s check-in` opening the check-in with the same refusal (J01 step 6, J03 steps 1 and 3, J04, J13, J16 steps 3–5, J17 step 7).
- Displayed times follow the device's 12-hour or 24-hour preference (`9:15 am` or `09:15`). A check-in glucose reading is timed when its first digit is typed, as the sheet's Time measured shows (scan X2-15), so J09 step 2 expects 09:00 rather than the save a minute later. During a low, an emergency may keep the low's 15 g treatment and its glucose re-check for someone who can swallow: the call for help comes first and no time to wait for is shown (J09 step 3). The rescue's branch for someone confused or unable to swallow, which calls for help, is not an escalation of a repeated level 1 low (J09 step 5).

The governing documents are [BOARD](BOARD.md), [PLAN](PLAN.md), [BUILD-BRIEF](BUILD-BRIEF.md), [codex-vision](codex-vision.md), [Clinical tracking protocols](../research/clinical-tracking-protocols.md) and [Safety gap](codex-safety-gap.md). Board D28, D29 and D30 supersede the older engine behaviour described in the audit. D29 also settles the research contract's persistent level 1 low policy, glucose conversion and BP gate. D31 replaces the earlier daily movement ring. C4 removes every Ask or assistant proposal in the vision.

## Execution and pass criteria

Run every journey in Chromium in these four projects:

| Project | Viewport, CSS pixels | Appearance |
|---|---|---|
| Large light | 430 × 932 | Light |
| Large dark | 430 × 932 | Dark |
| Small light | 320 × 568 | Light |
| Small dark | 320 × 568 | Dark |

Use touch emulation, `locale=en-IN` and `timezoneId=Asia/Kolkata`. Freeze the initial clock at **2026-10-08T09:00:00+05:30**, called **NOW**. Advance both the wall clock and timer clock deliberately. NOW is a Thursday, fourteen calendar days after the programme start used below, so P01 is in **Week 3 of 12**. Durations and quantities in fixtures are test inputs, not health recommendations.

1. Use a fresh context for each journey and each independent parameter row. Reuse one context only where the numbered steps explicitly form a sequence, such as low, rescue and recheck.
2. Seed v4 `AppData` in `localStorage['fit-strong-90-data']` before the first app script executes. Let the real migration create IndexedDB. A seed guard under a separate test namespace must survive reload and Clear, so an init script cannot secretly reseed erased records.
3. Do all journey mutations through the UI. Supplementary observations that v4 cannot represent enter through the app's canonical backup import, explicitly identified below. Do not call `permission()` as a substitute for testing a movement entry.
4. Normalise hash routes before assertions. For example, the logical route `/track?day=2026-10-07` is the part after `#`, within the deployment's base URL. An HTTP path outside that base is not a valid deep link.
5. Capture console errors, uncaught exceptions, requests, screenshots and a database snapshot at each checkpoint. Store runner artifacts outside the repository. Fault tests may allow only the exact browser resource error intentionally injected, never a blanket console allowlist.
6. A journey passes only when its UI, permission, recovery and persistence assertions all pass. A missing control or unrepresentable required safety answer is a failure, not a skipped case.

Text in backticks identifies a visible label or required text fragment. Locate labelled inputs by their accessible name. For a row whose accessible name includes its subtitle, locate the exact visible label and its enclosing semantic button or link. Scope repeated `None of these` controls to their named section. An ambiguous locator is a test failure. Do not select the first matching element to conceal it.

The check-in currently uses these outcome headings, which form the copy assertions:

| Disposition | Observable result in Check-in | Exercise permission |
|---|---|---|
| `emergency` | `Call emergency services now`, plus `No exercise today.` | All three modes refused immediately |
| `today` | `No exercise today. Get medical advice today.` | All three modes refused |
| `hold`, needs reading | `Check again before you start`, reason and `What changes this` | Relevant modes refused until the release condition is satisfied |
| `hold`, mode restriction | `No walk for now`, `No stretch for now` or `No session for now`, with reason | Named mode refused |
| `adjust` | `Go ahead, with changes`, followed by concrete restrictions | Only the permitted movements and intensity |
| `reassure` | `Good to go` | Allowed only after all required checks |

On a direct player or setup route, assert the same permission and care direction even if the heading differs. Emergency text must match `/emergency|help now/i`; today text must explicitly contain `today` and a clinical help direction. Colour alone never satisfies an assertion. A button that opens Check-in is not exercise permission; a button that starts or resumes the active clock is.

## Fixtures and seven personas

### Common v4 envelope

The following is a complete starting envelope. Apply persona overrides recursively, replacing arrays rather than merging them. It uses the v4 `AppData` envelope and today's optional profile fields so known medication answers are explicit. J02 separately tests a genuine old profile without those added answers.

```json
{
  "version": 4,
  "settings": {
    "startDate": "",
    "currentWeight": 78,
    "targetGoal": "",
    "defaultRestSeconds": 90,
    "useMetric": true,
    "theme": "system",
    "onboardingComplete": true,
    "gymDays": {
      "monday": "upper",
      "tuesday": "rest",
      "wednesday": "rest",
      "thursday": "lower",
      "friday": "rest",
      "saturday": "upper",
      "sunday": "rest"
    },
    "warmupEnabled": false,
    "cooldownEnabled": false,
    "defaultWarmupExercises": ["hip-opener-stretch"],
    "defaultCooldownExercises": ["breathing-cooldown"],
    "supersetRestSeconds": 20
  },
  "sessions": [],
  "bodyMetrics": [],
  "personalRecords": [],
  "checkIns": [],
  "focusOverrides": {},
  "profile": {
    "version": 1,
    "weightKg": 78,
    "heightCm": 175,
    "birthYear": 1982,
    "experience": "beginner",
    "trainingDays": ["monday", "thursday", "saturday"],
    "sessionMinutes": 45,
    "equipment": "homeNone",
    "goals": ["flexible"],
    "pain": {
      "areas": [],
      "worseWith": "unknown",
      "preference": "untested"
    },
    "health": {
      "diabetes": "none",
      "insulin": "none",
      "sulfonylureaOrMeglitinide": false,
      "sglt2i": false,
      "metformin": false,
      "priorDkaOrInsulinDeficiency": false,
      "medicinesReviewed": true,
      "highHypoRisk": false,
      "hypertension": "none",
      "betaBlocker": false,
      "diuretic": false,
      "heartOrVascularDisease": false,
      "kidneyDisease": "none",
      "retinopathy": "none_or_mild",
      "peripheralNeuropathy": "no",
      "footStatus": "healthy",
      "dizzyOnStandingOrAutonomicNeuropathy": false,
      "glucoseMonitor": "none",
      "glucoseUnit": "mg/dL",
      "ketoneTest": "none",
      "bpMonitor": false,
      "currentlyActive": true,
      "clearance": "vigorous"
    },
    "ladder": {"hinge": 2, "squat": 2, "neuralGate": false},
    "flexibilityTargets": ["hamstrings", "hipFlexors"],
    "dislikes": [],
    "restDayMobility": true,
    "voice": {
      "pack": "af_heart",
      "rate": 0.85,
      "verbosity": "auto",
      "mode": "coach",
      "muted": true,
      "checked": true
    },
    "figure": "male",
    "needsHealthReview": false
  }
}
```

These fixtures use clinician clearance to isolate the rules under test. Generic `clearance='vigorous'` does **not** permit exercise at a new high BP, erase hypoglycaemia, or supply a missing exercise safety plan.

| Persona | Overrides or first-run answers | Preparation and journeys |
|---|---|---|
| **P01, programme member** | `settings.startDate='2026-09-24'`, `settings.focus='strength'`; profile equipment `fullGym`, goals `['strong','flexible','painFreeBack']`; pain areas `['lowerBack','sciatica']`, side `left`, worse with `flexion`, preference `extension`; health diabetes `type2`, metformin `true`, metforminSince `'2019'`, glucoseMonitor `meter`, hypertension `treated`, bpMonitor `true`; food `{pattern:'vegetarian',avoid:[],region:'north'}`. Other medicine answers explicitly negative. | Add the legacy history below. No active status period, habit, step goal or movement goal. J02 to J07, J17 to J19. |
| **P02, stretch only** | `settings.focus='stretch'`, startDate empty; profile trainingDays `[]`, equipment `homeNone`, goals `['flexible']`, weightKg/currentWeight `65`, no diabetes, BP or pain history. | Empty history. J08. No programme enrolment follows from choosing Stretch. |
| **P03, walker on a sulfonylurea** | `settings.focus='move'`, startDate empty; diabetes `type2`, sulfonylureaOrMeglitinide `true`, metformin `true`, metforminSince `'2023'`, glucoseMonitor `meter`; no insulin or SGLT2; no pain or foot restriction. | Empty history. Pre-walk glucose is required, not an all-day optional recommendation. J09 to J11. |
| **P04, basal insulin** | `settings.focus='move'`, startDate empty; diabetes `type2`, insulin `injections_or_pump`, insulinRegimen `basalOnly`, metformin `true`, metforminSince `'2022'`, glucoseMonitor `meter`; SU/SGLT2/prior DKA explicitly negative. | Empty history. No dosage in the fixture. J12 to J14 use named variants for unknown medicines, multiple injections, prior DKA and SGLT2. |
| **P05, neuropathy and active ulcer** | `settings.focus='stretch'`, startDate empty; diabetes `type2`, metformin `true`, peripheralNeuropathy `yes`, footStatus `current_wound_or_active_charcot`, equipment `homeNone`; all other medicine risks negative. | Established foot restriction; no acute emergency symptoms. J15. No invented bike fallback. |
| **P06, sciatica flare** | `settings.focus='stretch'`, startDate empty; pain areas `['lowerBack','sciatica']`, side `left`, worse with `flexion`, preference `extension`; no diabetes; `settings.statusPeriods=[{kind:'flare',from:'2026-10-08'}]`. | Seed yesterday's check-in as C0 below, changing its date to `2026-10-07`, removing glucose/BP, and using back pain `3`, leg pain `2`, reach `thigh`. J16. |
| **P07, Explore first** | Completely fresh context, no v4 blob, profile, readings or sessions. First answer `Explore first`. Do not answer health or food questions initially. | J01 and J20. Before first movement, answer no diabetes/BP/other conditions, no current emergency symptoms, no pain, no medicines that change exercise risk, home with no equipment and no programme. These answers may create a profile, never an automatic enrolment. |

P01's seed contains **one** historical session and these retained records:

```json
{
  "sessions": [{
    "id": "legacy-strength",
    "date": "2026-09-25",
    "dayOfWeek": "friday",
    "muscleGroup": "upper",
    "phase": "foundation",
    "week": 1,
    "status": "completed",
    "sets": [
      {"id":"legacy-set-1","exerciseId":"dumbbell-bench-press","setNumber":1,"plannedReps":12,"actualReps":12,"weight":20,"status":"completed","rpe":7},
      {"id":"legacy-set-2","exerciseId":"face-pull","setNumber":1,"plannedReps":12,"actualReps":12,"weight":20,"status":"completed","rpe":6}
    ],
    "startedAt": "2026-09-25T09:00:00+05:30",
    "completedAt": "2026-09-25T09:20:00+05:30",
    "notes": "Retain this session note",
    "totalVolume": 480,
    "warmup": [{"exerciseId":"hip-opener-stretch","completed":true,"durationSeconds":30}],
    "cooldown": [{"exerciseId":"breathing-cooldown","completed":true,"durationSeconds":60}],
    "supersetGroups": [{"id":"legacy-superset","exerciseIds":["dumbbell-bench-press","face-pull"],"restBetweenSeconds":20,"restAfterRoundSeconds":90}],
    "exerciseNotes": {"face-pull":"Retain this exercise note"},
    "guided": true,
    "focus": "upperA",
    "planId": "legacy-plan",
    "mobility": [{"exerciseId":"hip-opener-stretch","seconds":30}],
    "cardio": {"modality":"walk","minutes":5,"format":"continuous"},
    "painAfter": 2,
    "symptomChecks": {"hip-opener-stretch":"same"},
    "durationSeconds": 1200
  }],
  "bodyMetrics": [{"date":"2026-09-25","weight":78,"waist":95,"notes":"Retain this measurement note"}],
  "personalRecords": [{"exerciseId":"dumbbell-bench-press","weight":20,"reps":12,"date":"2026-09-25","volume":240}],
  "focusOverrides": {"2026-09-25":"upperA"}
}
```

Add **C0** to `checkIns` and, as an identical embedded copy, `sessions[0].checkIn`:

```json
{
  "date": "2026-09-25",
  "urgentSymptoms": false,
  "back": {"pain":2,"legPain":1,"reach":"thigh","newNeuro":false,"caudaEquinaFlag":false},
  "news": [],
  "glucose": {"value":104,"unit":"mg/dL"},
  "bp": {"sys":126,"dia":82},
  "sleep": "gt7",
  "energy": 4,
  "readiness": {
    "outcome":"green","modifiers":[],"back":"green","nerveFlag":false,
    "reasons":[],"actions":[],"vigorousLocked":false,"capHeavy":false,
    "rpeOnly":false,"notices":[]
  }
}
```

The duplicate embedded C0 must not duplicate its observations. P01 migration produces **8 point observations**: glucose, two BP halves, two pre-session pain readings, weight, waist and one post-session back-pain reading. All eight have `source='manual'`. Date-only v4 readings retain `timeUnknown=true`; they cannot become fresh exercise measurements at NOW. No numeric sleep, mood or steps observation can be derived from C0's sleep band or energy.

### Normal current answers

Unless a case overrides them, select `None of these` in the current emergency, back-change and other-news sections; sleep `Over 7 h`, energy `Good`; P01 back pain `0`, leg pain `0`, reach `Back`; BP, when requested, `124/78` and `122/76` one minute apart. P03/P04 enter glucose `110 mg/dL`, meter, measured at NOW. P01/P02/P06/P07 leave optional glucose blank. Submit `See today’s plan`. These are explicit test answers, not values the app may prefill as measured facts.

## Database assertions used throughout

Read database **`fit-strong`**, version 1, in one readonly transaction spanning `observations`, `sessions`, `settings` and `content-state`. Close the inspection connection after each snapshot. Do not let the test's own connection cause a later blocked upgrade.

`settings` contains `{key,value}` documents, including `settings`, `profile`, `checkIns`, `personalRecords`, `bodyMetrics`, `focusOverrides`, `schemaVersion` and `revision`. `content-state` contains `{key,value}` rows. These paths come from [db.ts](../../src/store/db.ts), [snapshot.ts](../../src/store/snapshot.ts) and [observation.ts](../../src/health/observation.ts).

| Record being asserted | Required kind, scope, source and association | Forbidden result |
|---|---|---|
| Typed meter/sensor number | `glucose`, `pointInTime`, `manual`, original value/unit/time. Check-in projection has `context='checkIn:YYYY-MM-DD'`; check-in also retains its meter/sensor source. Timing tag is recorded if supplied. | Unit inferred from magnitude, rounded value replacing raw input, absent time relabelled fresh, unknown context relabelled fasting |
| BP reading | One systolic and one diastolic, each `pointInTime`, `manual`, `mmHg`, same reading context/time/source. Check-in has every raw `bpReadings` entry. | A mixed pair, an orphan half, or the average stored as an additional raw measurement |
| Check-in | One current summary per date in `settings.checkIns`, plus all genuine earlier glucose/BP readings and unresolved flags. Its projections preserve measurement history. | Recheck overwrites the earlier low; profile edits remove a reported emergency |
| Finished walk W | `walkDuration` and `movementMinutes`, `sessionObserved`, `measured`, `min`, `context='walk:W'`, actual interval `at` and `coverageMs`. GPS distance, if usable, is `walkDistance`, `km`, with the same association. One set per observed segment. | Hidden time recorded as observed, estimated all-day steps, GPS coordinates, a bridge across a gap, duplicate movement minutes from counting both duration kinds |
| Explicitly added walk gap | Separate `walkDuration`/`movementMinutes`, `sessionObserved`, `manual`, gap interval, same W, correction note | Manual time relabelled measured or supplying nonexistent GPS coverage/distance |
| Steps, water, sleep | `dayTotal`, `manual`, `steps`/`ml`/`h`, requested local day. New statement supersedes the previous effective statement for that kind/source/day. | Summing day-total statements, counting a session total again, or treating an empty day as zero |
| Weight, waist, pain, labs | `pointInTime`, `manual`; canonical weight `kg`, waist `cm`, pain `0-10`; HbA1c `%` or `mmol/mol`, B12 `pg/mL` or `pmol/L`, D `ng/mL` or `nmol/L` | Fabricated companion readings or diagnosis/treatment stored as an observation |
| Guided/Stretch session | One stable session ID with logged work, date, status, plan identity and mode. Stretch has `planKind='stretch'`. Session-derived pain links to `session:<id>`; measured movement, if projected, identifies that same session. | Stretch counts as a programme workout; skipped sets count completed; session duration and its projection count twice |
| Restored backup | Original sources, scopes, IDs, times, tags, notes and associations survive | Every restored row relabelled `imported`, or a restored historical reading used as fresh because the import happened today |

An append-only history may contain earlier statements of a day total. “No duplicated day totals” means no duplicate IDs/copies and only one effective statement per kind/source/day. It does **not** mean deleting the user's earlier statements. Source conflicts and overlaps remain inspectable, with no manufactured combined total. This is D10 and D14.

For comparisons, ignore only internal `revision` and observation `seq` where a commit legitimately restamps them. For export/restore, also account for the explicitly updated `settings.habits.lastExportAt`. Do not ignore clinical fields, timestamps, source, tags, contexts or session logs to make a comparison pass.

## The ten safety journeys that block release

Exactly these ten journey families are flagged. Run all their parameter rows in all four projects, and exercise the indicated movement entries.

| Flag | Journey | Why it matters |
|---|---|---|
| 1 | J03 | Current emergency wins over validation, profile edits, averages and saved session resume |
| 2 | J04 | One severe BP component cannot disappear into a pair average |
| 3 | J09 | 70 and 69.9 are different; rescue and prior low history control release |
| 4 | J12 | Insulin/SU freshness and unknown medicine class cannot become clearance |
| 5 | J13 | Exact unit boundaries, extreme glucose and applicable clinician limits |
| 6 | J14 | Ketones and DKA symptoms evaluated independently of glucose |
| 7 | J15 | An ulcer prevents weight-bearing walking without banning every permitted seated movement |
| 8 | J16 | New neurological/systemic symptoms stop movement despite a low pain score |
| 9 | J17 | A failed save cannot erase history, clear progress or acknowledge a nonexistent record |
| 10 | J18 | Replace and Clear act only after confirmation and cannot leave a half-erased record |

## Journeys

### J01, P07: Explore first without accidental enrolment

Basis: D4, D6, D8, D16, D23; PLAN Task 3; vision sections 2 and 4.

| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | Open a fresh context at the app root. | `Welcome` heading, `What would you like more of?`, Build strength, Stretch comfortably, Move more and `Explore first`. Local-only explanation is visible. No location, motion or notification request. |
| 2 | Tap `Explore first`; reload at the next checkpoint. | Focus remains `explore`. Explain Home Screen installation/storage and backup before claiming the record is durable. `navigator.storage.persist()` is attempted when available; a false result is not an app failure. |
| 3 | Continue to Today without enrolling or giving a medical history. | Browsing and logging are available. No forced gym schedule, body-weight requirement or full medical wizard before reading Guide or entering a past fact. Only four tabs and a root `You` button. |
| 4 | Open `Choose something else`. | Exactly five rows in fixed order: Stretch, Walk, Guided session, Log something, Learn. No Ask row, chat composer or assistant. Closing restores focus to the opener. |
| 5 | Open Learn, return, then Log something. Save steps `2000` for `2026-10-07`. | Guide is readable; Quick Log opens in Track. Historical steps are `Manual`, `2000`, for 7 October. Today's missing steps read `Not entered`. |
| 6 | Open Move, choose Stretch and attempt Start. | Relevant profile/safety questions appear before movement. Unknown treatment is never inferred from defaults. Answer P07's first-movement answers and normal current answers. |
| 7 | Cancel before active movement, reload, open You. | Answers already acknowledged as saved remain. `startDate` is empty, no active strength programme or session was fabricated. |

**Stored:** `settings.focus='explore'`; onboarding may finish without falsely marking health questions reviewed. One manual steps day-total observation for 7 October. After step 6, a profile reflecting the explicit answers and a current check-in may exist. No weight, glucose, sleep, pain or movement observations before those facts are actually entered.

### J02, P01: lossless upgrade and one resumable guided session

Basis: D8, D11 as adopted by PLAN Task 5, D13, D28, D30; PLAN Tasks 1 and 5.

| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | Load P01 with its legacy history. | Today opens without repeating first-run setup. `Week 3 of 12`; visible `Why this?` explains the scheduled unfinished session. The historical session, both sets and notes are accessible in Track. Migration has exactly the eight observations specified above. |
| 2 | Reload twice and revisit 25 September. | Same IDs, values, notes and record counts. No duplicate migration projections or second C0. |
| 3 | Variant: use a fresh P01 seed with `medicinesReviewed`, `metformin`, `metforminSince`, `priorDkaOrInsulinDeficiency` omitted and `needsHealthReview=true`. Attempt Guided session. | Health/medicine review hold. No reliance on the seeded green readiness. Enter no insulin, no SU, no SGLT2, metformin yes since 2019, no prior DKA; save. The known metformin-only branch then permits a check-in with no glucose reading. |
| 4 | In the main P01 case, start from Today's primary action and enter normal current answers with glucose blank. | One readiness/setup sequence. Clicking the permission-approved `Start session` starts the player; no second approval of the same session. No tab bar in the player. Current step, caption, timer, Pause and symptom-stop control are visible. |
| 5 | Advance through to the first strength set using Next, leaving skipped work incomplete. Record reps `12`, weight `10 kg`, mark that set done; Pause, then `Save and exit`. | Today offers Continue ahead of a new recommendation. Reload preserves the same plan/session ID, date, step and logged set. Pause time does not auto-complete work. |
| 6 | Continue, then finish the attempt with the remaining work skipped. Save the summary. | One new session with `status='partial'`, one completed set with actual reps 12 and weight 10, other skipped work incomplete. A save acknowledgment appears only after commit. |
| 7 | Reload Track, open that session, return to Today. | Exactly one new session, not two attempts from the reload. The older session and PR remain unchanged. A partial attempt is labelled partial, never displayed as all planned sets completed. |

**Stored:** original v4 settings, profile, `personalRecords`, `bodyMetrics`, `focusOverrides`, nested session fields and embedded C0 remain. Completed logged work is recoverable while in progress, using the permitted small progress cache, and durable in `sessions` before that cache is cleared. No movement record may be created from merely opening a plan or skipping its timed content.

### J03, P01/P06 and healthy controls: emergency precedence

**SAFETY 1 of 10.** Basis: D28, D29(2), D30; E-CARDIAC, E-CES, E-BILATERAL, E-HYPO, E-BP, E-DKA-SYMPTOM and E-OTHER.

| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | Open each of Guided session, Stretch and Walk in separate cases. Open Check-in, enter glucose `900 mg/dL` as a suspect entry, then select the chest emergency answer. | Emergency guidance appears immediately, without Submit, correcting glucose or completing another field. No active session can start. |
| 2 | Repeat with normal glucose `110`, BP `120/80`, pain `0`, selecting each emergency answer in the table below. | Same emergency disposition. No gentler workout, countdown before help, UK care number, or “try stretching” action. |
| 3 | Close the sheet and attempt every other mode, including direct `/session`, `/move/stretch` and `/walk/live` links. | All starts/resumes refused. Learn and past-record entry remain reachable. |
| 4 | With a saved runnable plan from J02, record a new current emergency, then tap Continue and open `/session?resume=1`. | Current emergency replaces resume controls. The stored safe plan cannot mask it; logged progress remains recoverable. |
| 5 | Save a saddle/bladder answer, edit the profile to remove back/sciatica areas, reopen Change answers without clearing that safety answer. | Emergency remains represented and blocks all modes. Hiding a question cannot delete its answer. |
| 6 | Reload after the save has committed. | Emergency flag and denied state survive. No new completed or observed activity record. |

| Parameter, exact selectable current answer | Required stored evidence and extra assertion |
|---|---|
| Chest pain or pressure, or a racing heartbeat at rest | `emergency` includes `chest`; emergency guidance overrides bad numeric entry |
| Face drooping, arm or leg weakness, slurred speech, or a sudden change in vision | `stroke`; BP below 180/120 does not reduce urgency |
| Severe breathlessness that is new | `breathless` |
| Collapsed and not back to normal | `collapse`; distinct from a faint followed by normal recovery |
| Can’t pee, or new loss of bladder or bowel control | `bladderBowel`; pain 0 does not clear it |
| New numbness around the genitals or bottom, or new sexual problems with back pain down a leg | `saddle`; test genital numbness and new sexual dysfunction with radiating pain as separate supplied scenarios |
| New weakness or numbness in both legs | `bothLegs`; historical bilateral sciatica alone is a nonemergency control |
| A low that can’t be treated by mouth: too drowsy or confused, or can’t swallow safely | `lowCantTreat`; show **no oral food/drink rescue instruction**, even if glucose is 50 or unknown |
| Vomiting with tummy pain, deep or unusual breathing, fruity breath, or very drowsy or confused | `dka`; normal glucose and unknown ketones do not clear it |
| Injured in a serious accident, such as a fall or a crash | `accident`, with back pain |
| Confused or hard to wake in the heat | `heatConfusion`; “hot today” alone is not this emergency |

**Stored:** explicit current flags, `urgentSymptoms=true`, emergency readiness/reasons when storage works. No plausibility-rejected glucose manufactured as a valid point observation. No session starts, added cardio or fabricated zero readings. J17 tests the same immediate refusal when saving the emergency fails.

### J04, P01: severe individual BP and strict resting gate

**SAFETY 2 of 10.** Basis: D28, D29(4), D30; E-BP, T-BP, H-EXERCISE-BP.

Start every independent row with a fresh P01, no earlier severe readings and normal symptoms.

| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | Open Check-in; after the displayed rest instructions enter Reading 1 `190/80`. Advance one minute and enter Reading 2 `120/80`. | No movement permission based on mean `155/80`. One severe raw reading is enough to refuse pending assessment/recheck. |
| 2 | Change the fixture to Reading 1 `190/80`, Reading 2 `150/121` at least one minute later. Submit. | Explicit clinical advice today, all modes refused. Mean `170/100.5` cannot replace either raw severe component. |
| 3 | Repeat with `180/80`, then `180/80`; separately `140/120`, then `140/120`. | Equality and the OR operator both trigger today advice. |
| 4 | On the first severe reading, select `Symptoms with the high reading`. | Emergency immediately, no wait for another BP. Test confusion and unusual severe back pain as well as chest symptoms. |
| 5 | Enter each gate variant below through each movement entry. | The stated allow/refuse outcome is identical in Guided, Stretch and Walk. |
| 6 | In a refused case, enter a lower reading as a new observation, reload, attempt another mode. | Earlier severe readings remain. A normal number or different mode does not itself satisfy a clinical release condition. |

| Gate variant | Expected permission |
|---|---|
| `160/100`, no lower clinician limit | No hold from the strict `>160 OR >100` rule. Movement may carry explicit conservative intensity restrictions; `adjust` or `reassure` is acceptable, `allowed=true`. |
| `160.1/80`, or `120/100.1` if decimal BP is accepted | Hold all modes without an applicable clinician permission. Integer controls `161/80` and `120/101` must produce the same hold. |
| Clinician `bpStopSystolic=150`, reading `150/80` | Hold at equality to the recorded clinician stop limit. |
| `bpExercisePermission={sys:170,dia:105,recordedOn:'2026-10-01'}`, reading `165/102` | The above-160/100 app hold is lifted, with applicable restrictions. |
| Same permission, reading `180/80` | Severe rule still refuses. Generic vigorous clearance never supplies this permission. |
| `120/120`, an implausible pair | Require correction/recheck, no reassuring result. With an emergency symptom, emergency direction appears even while this entry is invalid. |

For a single asymptomatic severe reading, **hold or the more conservative today disposition is acceptable**, provided exercise is refused and the next action is explicit. After a properly repeated severe result, today advice is required. This accepted set prevents the test from penalising safe earlier clinical contact; it does not permit exercise or an emergency diagnosis from the number alone.

**Stored:** every accepted raw BP pair as two linked point observations and all raw entries in the check-in. After step 2, exactly four new BP observations, with pairs `190/80` and `150/121`. No extra point observation for the mean. Do not demand persistence of the invalid `120/120` pair.

### J05, P01: My Day, provenance, totals and local dates

Basis: D10, D13, D14, D21; PLAN Task 6.

| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | Track → Add → Steps, enter `2000` for today; then enter `2500` for the same day. | Effective total 2500, not 4500. Both historical statements remain inspectable and are labelled Manual. |
| 2 | Add Water `250 ml`, then `250 ml`. | Effective water total 500. Stored day-total statements are 250 then 500, not two additive totals of 250 or a displayed sum of 750. |
| 3 | Add Sleep `7.5 h`, Weight `78 kg`, Waist `90 cm`, back pain `2` and leave leg pain blank. | Each fact appears with its own date/unit/source. Blank leg pain creates no zero. Sleep is a night/day statement, not inferred from screen inactivity. |
| 4 | Add glucose `150 mg/dL`, tag `After a meal`, meal started `07:00`, reading time `08:30`. Add a separate untagged 150 at `08:40`. | First reading shows its meal context and 90-minute interval; ADA's after-meal framework is named. Untagged reading is not called fasting or above a premeal target. |
| 5 | Edit the first reading to 155, keeping its event time. Reload. | Same ID/time/context/tag/meal start, new value 155 and correction timestamp. Not a second measurement or lost meal context. |
| 6 | Open Trends and Back & leg, then each record detail and Back. | One measure per chart, readable values and source labels. Back returns to the originating day/view. Missing dates remain gaps; no line implies a fabricated zero or measured intermediate reading. |
| 7 | Track → Add → Workout for today. Complete normal current answers if requested. In the first offered set, enter `12` in Reps if that field appears, otherwise `20` in Seconds; enter `10` in Weight (kg) only if offered. Tap `Done set`, wait for the save acknowledgement and reload. | Workout Log returns to the same attempt with exactly one completed set and the entered amount. An absent weight control produces `weight=null`, not 10 or a fabricated zero. No guided player or automatic coached progression starts. |
| 8 | Tap `Finish workout`, enter Notes `Manual acceptance set`, then `Save workout`. Open the saved record from Track and return. | Detail shows one set done, the exact amount/weight and note; all other planned sets remain not done. This multi-set P01 workout is partial, never presented as all sets completed. Reload preserves the same record ID; Back returns to the originating Track day. |

Supplement this journey with canonical backup fixtures, using explicit IDs to check the following independent cases:

| Input | Exact expected display/data |
|---|---|
| Manual day steps 2500 plus measured session steps 300 for the same day | Separate day and session scopes; the day total remains 2500, never 2800 |
| Two movement intervals, 10 minutes at 08:00 and 5 minutes at 08:05 | Visible `/overlap/i` explanation; no combined “15 minutes recorded” claim, no ring built from that invalid sum |
| Two manual day totals at exactly the same timestamp, 2000 then 2500 | Later committed statement wins; changing UUID lexical order cannot change 2500 |
| Imported glucose 110 `mg/dL` and 6 `mmol/L` | Preserve units and sources. Never average raw values into 58 or silently choose the newest unit for both |
| BP halves from two contexts at the same timestamp: A `130/80`, B `140/90` | Display A 130/80 and B 140/90, never A/B 130/90 |
| NOW moved to `2026-10-09T00:01:00+05:30`; weight 79 at `2026-10-08T23:59:00+05:30`, 80 at `2026-10-09T00:01:00+05:30` | Two local days. Reopen the same records in `America/New_York`; stored day keys remain 8 and 9 October |
| NOW moved to 2 November; readings at `2026-11-01T01:30:00-04:00` and `2026-11-01T01:30:00-05:00` | Two distinct chronological readings on 1 November, first offset before second; no deduplication by wall-clock label |

**Stored:** steps and water are superseding day-total histories; all point observations retain their separate identities. One additional manual `WorkoutSession` contains the logged set and note; no second session is created by reload or finishing, no unperformed set receives actual reps/weight, and browsing/logging time is not manufactured as measured movement minutes. The legacy session remains unchanged. No GPS data, inferred calories, background steps, fabricated missing readings or mixed BP pairs. A restored `imported` source remains imported; the typed facts remain manual.

### J06, P01: what to track and what a result means

Basis: C11, D9, D22, D27, D32, D33; clinical Glucose, BP, B12/D, Weight, Hydration and Ergonomics sections.

| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | Guide search for glucose/diabetes monitoring, then inspect the applicable cadence and Sources. | Confirmed metformin-only does not get a mandatory daily fasting check. Basal, SU and multiple-injection monitoring situations are distinguished. Each clinical number identifies an edition and recommendation/table/section. |
| 2 | Open BP guidance and its measurement instructions. | Validated upper-arm cuff; bare arm, supported at heart level; 5-minute rest, back supported, feet flat, no talking; two readings at least one minute apart. NICE home 135/85 and clinic 140/90 are distinguished from ADA diabetes goals, not merged into one unexplained “normal” scale. |
| 3 | Add lab results HbA1c `6.5%`, B12 `350 pg/mL`, D `50.1 ng/mL`; open their details. | HbA1c uses an explicitly general, individualisable ADA goal. B12 equality 350 is **indeterminate**, NICE NG239 Table 1. D 50.1 is **potential adverse effects/clinician review**, NIH ODS, not unqualified “adequate” just because it exceeds 20. These labs alone do not create an acute exercise emergency. |
| 4 | Open B12 and D articles for this vegetarian metformin profile. | Annual B12 assessment after more than four years of metformin is explained with ADA 2026 recommendation 3.10 and its discussion. No automatic annual vitamin D test, fixed sunlight timer or treatment-dose recommendation. Dal, greens and fermented foods are not presented as reliable substitutes for B12 sources. |
| 5 | Inspect BMI/waist interpretation for 78 kg, height 175 cm and waist 90 cm, plus the framework comparisons. | BMI approximately 25.5, with **RSSDI-ESI 2020 Indian cutoffs**, not WHO obesity threshold 30 as the only answer. Explain NIN 2024's different above-27.5 definition. Men's 90 cm is at RSSDI's increased-risk threshold, while NIN's text uses strict above 90. Sex-dependent flags require explicit applicable context; a demo figure is not a clinical sex answer. |
| 6 | Guide → Meal ideas; use vegetarian North Indian preferences and open a roti/dal meal. Open its Sources. | Authored portions/substitutions, carbohydrate and salt context, dairy/fortification where applicable. No required weighing, food diary, calories, glucose prediction, IFCT nutrient table, guaranteed “diabetes safe” food or supplement dose. Preferences persist. |
| 7 | Open desk, sitting, hydration and sleep topics; inspect all actionable numbers. | Sitting-break cadence identifies ADA, desk geometry identifies OSHA/equivalent, fluid advice explains individual variation, sleep advice identifies its source. No posture cure, camera score, glucose-per-hour-of-sleep formula or compulsory two-litre plain-water target. |

For HbA1c cadence, stable/at-goal/unchanged treatment means **6 months**; unmet goal or treatment change means **3 months**, with clinician override. Those are conditional suggestions from ADA 2026 recommendation 6.2, not mandatory daily tasks. For a basal user without a prescribed fasting schedule, say to follow the care-team plan; do not invent a universal count. A multiple-injection variant must explain before meals/bedtime/activity and rescue checks without assigning a fixed 6-to-10 checklist.

Use these additional interpretation boundaries as parameter rows for lab detail, with no invented clinical numbers:

| Framework | Value | Required interpretation |
|---|---|---|
| NICE NG239 Table 1, B12 pg/mL | 179.9; 180; 350; 350.1 | Deficiency; indeterminate; indeterminate; deficiency unlikely |
| NIH ODS/NASEM Table 1, D ng/mL | 11.9; 12; 19.9; 20; 50; 50.1 | Deficiency risk; inadequate; inadequate; adequate for most; adequate for most; possible harm/review |
| RSSDI-ESI 2020 versus NIN 2024 | BMI exactly 23; exactly 25; exactly 27.5 | RSSDI overweight/obesity/obesity; NIN upper recommended boundary/overweight/overweight. NIN obesity starts **above** 27.5 |

**Stored:** three manual point lab observations in their entered units and dates, plus any explicitly saved food preferences/reading state. Opening a Source or article creates no health measurement. Backup import preserves the original sources. B12 supplementation, vitamin D supplementation, medication and insulin dosing remain clinician decisions. NHS material appears only as Further reading under D32; no reproduced guideline tables or embedded STarT Back/Oswestry questionnaire without permission. If a questionnaire ships, Roland-Morris needs its validated version/language identified; availability is not a requirement to add a new questionnaire.

### J07, P01: user goals, rest, status and reminders

Basis: D15, D19, D25, D26, D27, D31.

| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | Open Track before choosing a goal. Open Weekly movement goal. | No automatically assigned ring target. WHO 150 weekly minutes is a suggestion requiring an explicit tap/save. Not a daily ring or a guarantee that all recorded minutes were moderate aerobic activity. |
| 2 | Save a weekly goal `20`; record a five-minute timed walk. Reload. | `5 of 20` chosen weekly recorded minutes, unchanged goal 20. One walk is counted once even though it produces both duration and movement observations. |
| 3 | Separate P01 case: start the clock on 7 October, choose a daily steps goal `2500` in Track's Steps detail, log `2000` steps that day; advance to 8 October and change the goal to `3000`. Reopen 7 October. | The goal is optional and starts empty, with no default presented as chosen. Earlier day still shows 2000 against its chosen 2500, or 80%, not a retrospective 2000/3000. User choice is retained. A suggestion near 7000 has its D27 study source and is not a validation minimum or WHO prescription; no floor or onset-of-benefit threshold is claimed (D27 superseded in part, content audit F15). No automatic percentage increment. |
| 4 | Move the clock to a scheduled rest Sunday. | Rest is part of the plan. No broken-streak, missed daily ring or “make up” strength session. At most one optional gentle recommendation. |
| 5 | In a fresh P01 variant at 5 October, set Status Away; advance to 8 October and select Back to normal. | Away history covers 5 through 7 October. Gentle/no movement recommendations and quiet habits during those days; startDate never changes without confirmation. Returning offers a shift. |
| 6 | First decline; in a separate identical case accept a shift of the three paused calendar days. Reload. | Decline retains `2026-09-24`; acceptance gives `2026-09-27`. No historical session/check-in date moves. The three days are excluded from consistency calculations. |
| 7 | You → Habits & reminders: enable sitting breaks every `30 min`, 09:00 to 18:00, meal walk after Dinner, quiet hours 22:00 to 07:00. Advance to a due time with the app open on a screen other than Today (Move, say), then visit Today. | Off Today, a waiting reminder floats above the tab bar, one at a time, answered with `Done` or `Later`. Today shows a waiting reminder inline only when it is the top prompt, and otherwise counts it on the app badge; Today never shows more than one prompt. Dinner walk only for the chosen meal. Prompt completion is not a measurement or programme workout. Quiet hours and non-Normal status suppress prompts and leave nothing waiting on the badge. |
| 8 | Open Add to Calendar; download the `.ics`, then disable banners. | Calendar file contains the selected schedule and alarms, excludes disabled habits and contains no health readings. Each event repeats daily until an end date the sheet states; a new file renews it, so a stale file cannot remind forever (scan D-01). UI explains delivery by Calendar when closed; does not claim successful OS import merely from download. No server push or background timer promise. |
| 9 | Enable water reminders, then answer `Yes, I have a fluid limit`; additionally test a kidney-disease variant. | Generic water prompts are suppressed, including in generated calendar files. No instruction to replace all urine losses, add salt or change a diuretic. |

**Stored:** explicit goal settings, food/habit preferences and status periods, without measurement zeros for rest or habit completion. User goals are never auto-raised. Historical goal context must be durable enough to meet D27. This suite interprets D25's “paused days” as unique paused **calendar days**, not only missed scheduled workouts; the three-day fixture intentionally includes only one scheduled training day. If the board adopts a different counting rule, reconcile the decision before execution, rather than deriving the expected answer from the implementation.

### J08, P02: a complete Stretch product without a strength plan

Basis: D6, D8, D21, D24; PLAN Task 5.

| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | Open Today, Choose something else → Stretch; repeat via Move → Stretch. | Stretch setup with focus/duration, no compulsory programme, gym statistics or empty phase dashboard. |
| 2 | Choose the ten-minute routine, enter normal current answers with no glucose/BP, Start stretch. | Shared safety gate; no diabetes readings demanded. Player starts, no tab bar. Demo, caption, pause control and symptom-stop control are visible. |
| 3 | Pause for two minutes, reload, then resume at the saved step. | Same attempt, step and ID. No two minutes of performed stretching invented from the pause. |
| 4 | Advance through each running timed step to completion; save. | One Stretch summary with actual recorded duration and completion. Nothing says the strength programme was completed. |
| 5 | Open Track and the saved record; reload Today. | Stretch remains a separate session and the useful next recommendation remains within this user's chosen focus. `settings.startDate` stays empty. |
| 6 | Repeat with Wake Lock absent/rejected and voice unavailable; separately use reduced motion. | Captions, controls and timers remain usable. No crash, blocked start, mandatory vibration, stuck ring animation or uncontrolled demo without a pause control. |

**Stored:** one stable `planKind='stretch'` session, actual mobility work/duration, measured movement at most once, explicit optional pain only if entered. No programme enrolment, all-day step total, glucose/BP zeros or completed strength sets.

### J09, P03 plus P01 controls: 70, 69.9, rescue and release

**SAFETY 3 of 10.** Basis: D28, D29(1), D29(3), D29(5), D30; H-HYPO, H-PRE-LOW, T-HYPO-REVIEW; ADA 2026 Table 6.4 and recommendation 6.15.

| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | P03, pre-walk glucose exactly `70 mg/dL`, fresh; no symptoms. Submit. | **Not** labelled biochemical hypoglycaemia. Still held below 90 for SU exercise risk. Existing exercise carbohydrate/monitoring plan is the release, no universal 15-15 treatment solely because the value is 70. |
| 2 | Fresh P01 metformin-only control, 70 mg/dL, no symptoms. | No H-HYPO or H-PRE-LOW refusal solely from that number. A general premeal target can still be described as different from the exercise gate. |
| 3 | Fresh P03: switch to mmol/L and enter **`3.8833333333333337`**, the runtime string for `69.9/18`. Submit. | Level 1 low, not rounded to 70 or merely “below start”. Refuse movement; show **15 g fast-acting carbohydrate** and **recheck in 15 minutes**. Timer must not delay emergency symptoms. |
| 4 | Advance fourteen minutes; try to reuse the old number or enter a premature normal recheck. | No release from a countdown tick or merely replacing the field. A newly measured, correctly timed reading and recovery condition are required. |
| 5 | Advance to fifteen minutes; measure `65 mg/dL`. Submit. | End this attempt; repeat rescue as needed. No Start/Resume or gentle fallback. Repeated level 1 says to tell the care team if lows keep happening, without claiming every level 1 loop mandates emergency or same-day contact. |
| 6 | Separate sequence: initial `53.9 mg/dL`, alert/can swallow, then fifteen-minute reading 110 and symptoms resolved. | Level 2, session ended and **contact care team today** remains. The normal recheck cannot erase the event or restart this attempt. |
| 7 | Separate sequence: initial `69.9`, fifteen-minute reading `95`, recovered symptoms and explicit existing-plan permission. | Release only after valid time, new reading, symptoms gone and plan allows exercise. Leaving the recovery/plan answer false keeps the hold. |
| 8 | Change mode, reload and revisit Track during steps 5/6. | Ended-attempt/review state persists; both readings remain in history. No alternate mode bypass. |

**Stored:** distinct raw glucose observations at each actual measurement time, `manual`, `pointInTime`, original units, plus check-in `glucoseEarlier` and current reading. A repeated submit of the same measurement must not duplicate it. Recovery replaces neither the first low nor its review significance. Historical `news=['lowSevere']` causes today review; it must not falsely assert current inability to swallow or unconditional no-oral rescue.

### J10, P03: after-meal walk with location denied

Basis: D14, D18, D24, D26.

| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | Move → Walk; choose `After a meal`, Breakfast, Started `20 minutes ago` at NOW, corresponding to 08:40. | Meal context is explicit. Ten minutes is a study-based suggestion, with Reynolds 2016 named and “Research, not a promise” framing. No assumed meal from clock time. |
| 2 | Before opting in, count geolocation calls. Then toggle `Measure distance and pace` and return permission denied. Keep Count steps off. | Zero location calls before opt-in. After denial, a visible timed-only explanation; Start walk remains available subject to readiness. No repeated permission loop. |
| 3 | Enter P03 fresh glucose 110 and normal answers; start. Advance two foreground minutes. | Active timer reaches 02:00. Distance/pace read `Not measured`, never zero kilometres or `0:00` pace. |
| 4 | Finish, confirm Finish walk, Save walk, wait for commit, Done. | `Saved on this device` only after persistence. Today/Track has one two-minute after-breakfast walk with meal context. |
| 5 | Reload Track and open the walk. | Same ID and two-minute record. Location denial did not create a crash or lose the timed walk. |

**Stored:** two observations for the one segment, walkDuration 2 and movementMinutes 2, scope `sessionObserved`, source `measured`, coverage 120000 ms, same walk context. No walkDistance, steps, coordinates, inferred calories or all-day movement total. Meal identity/start remains in the walk's context/note. Unmeasured distance may be entered later only as manual, never GPS.

### J11, P03: foreground coverage, background gap and reload

Basis: D10, D18, D24; vision section 9.

| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | Start a permitted GPS walk, Count steps off. Emit fresh accuracy-3-metre fixes every 10 seconds from second 0 to 120, latitude rising evenly from 0 to 0.001, longitude 0. | Two observed foreground minutes. GPS source is labelled estimated/measured coverage, not exact navigation or all-day walking. |
| 2 | Set real document visibility to hidden at second 120 and dispatch its visibility event. Advance 180 seconds; emit a hidden position far away. | Recording pauses and the hidden position contributes no time, steps or distance. No WebGL demo while tracking. |
| 3 | Return visible at second 300, choose Continue walking. Emit fixes every 10 seconds from second 300 to 360, latitude rising evenly from 1 to 1.001, longitude 0. | New segment, explicit gap notice. The roughly 111 km displacement across the gap is not added. Active timer reaches 03:00, not 06:00. |
| 4 | Finish and Save without adding away time. | Three observed minutes and three unobserved minutes distinguished. Two segments, each approximately 111 metres; total distance approximately 0.222 km after the current metre rounding, not a cross-gap route. |
| 5 | Separate identical case: reload while paused after the first segment, wait one minute, resume with a far-away fix. | Same walk ID and prior totals. Reload interval is a gap, not a performed segment or a duplicate new walk. |
| 6 | Separate case: explicitly add the three-minute away interval. | Six supplied/recorded minutes can be shown only with **3 measured + 3 manually added** coverage. No distance invented for that correction. |
| 7 | Save, reload, inspect every store, local/session storage and the exported backup. | No latitude, longitude, coordinate array, route, GPS track or stored last position. Summary segments/gap times may persist. |
| 8 | Separate case, page visible throughout: fixes every 10 seconds from second 0 to 60 (latitude 0 to 0.0005), then no fix for 30 seconds, then fixes every 10 seconds from second 90 to 120 (latitude 0.001 to 0.0013). | During the silence the walk says the GPS signal is lost, and the time still counts as observed: the timer reads 02:00 at second 120. One segment holds two GPS runs, of about 56 m and about 33 m, totalling about 0.089 km, never the about 0.145 km that bridging the silence would give. The summary does not present that distance as complete. |

Use an init-script visibility shim that changes the getter **and** emits `visibilitychange`, or a browser mechanism that demonstrably makes `document.visibilityState='hidden'`. Dispatching the event while the property remains visible does not execute this test. GPS mock timestamps must advance with the test clock; this is a deterministic Chromium simulation, not an iOS background test. Fixtures arrive at most 10 seconds apart: iOS reports a position about once a second while moving, and more than 20 seconds without one is lost signal (`GPS.lostAfterMs`, re-audit F15). Step 8 is the one deliberate longer silence.

**Stored:** two measured segment sets with coverage 120000 and 60000 ms, the same walk context; separate manual gap observations only in step 6. Weekly movement counts 3 observed minutes once, or explicitly labelled manual supplementation, never 6 observed or 9 from adding duration and movement kinds. In step 8, one `walkDistance` per GPS run (about 0.056 km over 60000 ms and about 0.033 km over 30000 ms), and one two-minute `walkDuration` and `movementMinutes` over 120000 ms; no distance spans the silence.

### J12, P04: missing/stale glucose, medicine certainty and regimen

**SAFETY 4 of 10.** Basis: D28, D29(5), D29(6), D30; H-DATA.

| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | Attempt each movement mode P04 can start (Stretch and Walk; P04 is not in the programme, D35) with known basal insulin and no glucose. | Data hold, `Check again before you start`; no runnable amber/recovery fallback. |
| 2 | Enter 110 measured `08:29` at NOW 09:00. | Hold with `check your glucose within 30 minutes of starting`; 31 minutes is stale. Merely reopening or importing the value does not refresh it. |
| 3 | Separate cases: glucose measured exactly `08:30`, then `08:29:59.999`. | Exactly 30 minutes satisfies this freshness requirement; 30 minutes plus 1 ms does not. Other clinical restrictions still apply. Use a retained reading fixture for sub-minute precision if the UI time picker only exposes minutes. |
| 4 | Enter a new 110 measured now. | Freshness hold clears after save and normal symptom checks. Original 08:29 reading remains historical. |
| 5 | Fresh variant: type 2, default false medicine booleans, `medicinesReviewed` absent and `needsHealthReview=true`. | Medicine/profile data hold in all modes, even with glucose 110. Learn/past logging remain available. |
| 6 | Review medicines; choose Not sure for insulin or SU. Save and reload. | Unknown answer remains `unsure`, visible as Not sure, not converted to “No”. Risk-dependent clearance remains held until knowledge/plan is sufficient. |
| 7 | Confirm insulin none, SU no, SGLT2 no, metformin yes, prior DKA no. Leave glucose absent. | Known metformin-only no-reading control passes this data rule. No new daily glucose mandate. |
| 8 | Return to basal, then change to Several injections a day and reload Profile & health/Guide. | Stored regimen changes `basalOnly` → `multipleDaily`; cadence explanation changes accordingly, without insulin dose/titration or a universal basal testing count. |

Additional H-DATA variants: device `HI` or `LO` is retained as a display result, with no invented numeric equivalent; unknown/error units require correction; a normal sensor reading 110 plus shaky/sweaty `lowSymptoms` requires meter confirmation and cannot reassure solely from sensor range. A future timestamp an hour ahead is not a valid fresh check.

**Stored:** reviewed knowledge and combinable medicine components, regimen, exact reading time/source and prior readings. No glucose observation for a nonnumeric display or missing reading. No medication names/doses guessed from diabetes type.

### J13, P04/P01: all glucose boundaries in both units

**SAFETY 5 of 10.** Basis: D29(1), D30; H-PRE-LOW, H-HIGH-UNCHECKED, H-T2-HIGH, E-EXTREME-GLUCOSE.

| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | For each row below, open a new relevant mode with the named profile, all other flags negative, and a fresh meter reading. | No previous independent subcase can contribute a remembered low or ketone. |
| 2 | Run once entering mg/dL; again switching units and entering `String(mg / 18)`, retaining the full string. | Same disposition, permission and release condition. Display rounding may differ; clinical comparisons may not. |
| 3 | Submit, attempt Start and direct player navigation, then inspect persisted values. | Refusal cannot be bypassed. Original entry precision/unit survives. No conversion through `Math.round` before comparison. |
| 4 | For an allowed row, begin then report a new applicable stop reading through the safety check. | Active movement pauses/stops and recomputes permission, not just a warning under a running timer. |

| mg/dL input | Profile and isolated condition | Required result |
|---|---|---|
| 53.9; 54; 54.1 | P04, alert/can swallow | 53.9 level 2, no session and contact today; 54 and 54.1 level 1, rescue/hold |
| 69.9; 70; 70.1 | P04 | 69.9 level 1; 70/70.1 not biochemical hypo but H-PRE-LOW hold |
| 89.9; 90; 90.1 | P04, default start limit | 89.9 hold; 90/90.1 clear this pre-low rule |
| 249.9; 250; 250.1 | P04 variant `priorDkaOrInsulinDeficiency=true`, unexplained high, no ketones/recorded applicable plan | 249.9 clears the ≥250 missing-ketone rule; 250/250.1 hold pending usable ketones/assessment |
| 299.9; 300; 300.1 | P01, well, no excessive ketones and no recorded light-activity permission | 299.9/300 do not fire strict `>300`; 300.1 refuses moderate/vigorous Guided session. No automatic light Walk prescribed to treat the high |
| 599.9; 600; 600.1; 601 | P01, reliable reading | 599.9 is high but not the ≥600 emergency rule; 600 and above emergency, all modes refused, not dismissed as implausible and then cleared |

At 300.1 and 599.9, a documented clinician plan could permit only the light activity it specifies, when well/hydrated and without higher flags. That permission is absent in this fixture. A runnable “moderate effort” modified guided workout fails. Numeric target status is not itself general reassurance at these readings.

The exact mmol/L strings for 54, 70, 90, 250, 300 and 600 are respectively `3`, `3.888888888888889`, `5`, `13.88888888888889`, `16.666666666666668`, `33.333333333333336`. **33.3 mmol/L is 599.4 mg/dL**, not an independently coded 600 boundary.

Clinician variant: set `clinicianTargets.glucoseStartMin=5.6`, `glucoseStartUnit='mmol/L'`. The canonical limit is 100.8 mg/dL. Readings 100.7 hold and 100.9 clear this limit; repeat in both units. The UI names the clinician's limit. The clinician start limit never relaxes biochemical hypoglycaemia or emergency rules.

**Stored:** all accepted measurements at original precision; no replacement with rounded canonical numbers. Invalid runtime/missing units cannot be stored as valid glucose or produce clearance. Any trustworthy extreme reading gets emergency guidance even if a generic plausibility check also objects.

### J14, P04 variants: ketones independent of glucose

**SAFETY 6 of 10.** Basis: D28, D29(8), D30; E-KETONE, E-DKA-SYMPTOM, T-KETONE, T-ILLNESS, H-LOW-KETONE.

Use P04 with `sglt2i=true`, ketoneTest `blood`, otherwise normal answers. SGLT2 is combined with the existing medicines, not an exclusive replacement class. P04 is not in the programme, so each row runs through Stretch or Walk, and the other modes it checks are those two (D35).

| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | Enter glucose 60 and blood ketones `3.0`. Repeat with glucose 50, 110 and glucose absent. | Emergency in every case. Low-glucose early return never drops ketones. Safe oral rescue may be shown only while alert/can swallow; emergency help is not contingent on its timer. |
| 2 | Parameterise blood ketones using the table below. | Inclusive boundaries and release/contact direction are visible. |
| 3 | Switch profile ketoneTest to urine; choose Moderate, then Large. | Emergency at Moderate/2+ and above. Raw strip category persists; no synthetic blood mmol/L conversion. |
| 4 | Ketones unknown, glucose 110; report vomiting with abdominal pain/deep unusual breathing as the current DKA answer. | Emergency despite normal glucose. No app-generated sick-day medication changes. |
| 5 | Glucose 110, ketones 0.6, news unwell; separately vomiting/cannot retain fluids or high not falling under the existing plan. | Prompt clinical contact now/today and no exercise; DKA/altered consciousness additions escalate immediately. |
| 6 | Reload, change a diabetes diagnosis field while leaving these reported current findings unchanged, try another mode. | Previously reported ketones/symptoms remain evaluated. A diagnosis edit cannot discard an emergency measurement. |

| Blood ketones, mmol/L | Required result, no other symptoms |
|---|---|
| 0.59 | No hold from the ≥0.6 ketone rule alone |
| 0.6; 1.49 | Hold; existing sick-day plan and **2-hour recheck**. No activity clearance inferred merely from being below 1.5 |
| 1.5; 2.99 | No exercise, contact diabetes team today |
| 3.0; 3.01 | Emergency now |

**Stored:** `ketones.kind='blood'` with raw value/time, or `kind='urine'` with original `category`, in check-in/history. The observation registry has no ketone kind, so do not invent a `glucose` observation or a new numeric urine-to-blood row. Newer ketone readings retain earlier significant results until applicable release.

### J15, P05: foot restriction applies to Walk

**SAFETY 7 of 10.** Basis: D28, D30; H-FOOT/EYE; ADA exercise statement 2016 Table 5 and ACSM 2022 Table 5.

| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | With the established active-ulcer profile, enter normal current answers and open Walk from Today and Move. | Walk refused, foot-protection reason and care direction. No ordinary Start walk or “easy walk” workaround. |
| 2 | Open a valid-looking `/walk/live` deep link and a saved walk resume. | No active recording/weight-bearing session. GPS permission cannot bypass clinical permission. |
| 3 | Open Stretch, and Guided session with P05 seeded in the programme (defined setup below). Inspect the permitted routine. | Only reviewed seated/floor activity compatible with the foot restriction may run. No loaded standing, walking cardio, treadmill or unavailable bike fallback. A restriction on Walk is not a fabricated blanket prohibition of every safe seated movement. |
| 4 | Separate variant: healthy stored foot status but neuropathy yes; report `A foot that is newly hot, red or swollen`. | Walk refused and prompt clinical assessment advised. It is captured even without a blister/sore. |
| 5 | Change only the overall legacy readiness colour to green in a seed, keeping foot facts. | Exactly the same mode restriction. No screen uses green alone as permission. |
| 6 | Severe/proliferative retinopathy variant, no current foot restriction, seeded in the programme; preview Stretch/Guided. | No prohibited heavy straining or head-down movements. Ordinary movement is limited by its applicable restrictions, not an invented universal inversion angle. |

**Defined setup for Guided (D35):** P05 is not in the programme, and outside it there is no guided session to start. Steps 3 and 6 seed P05 with `settings.startDate` `2026-09-24` and the envelope's Monday, Thursday and Saturday training days, so Thursday 8 October has a programme session; step 3's Guided session is its own case. Steps 1, 2, 4 and 5 keep P05 as specified.

**Stored:** original foot/eye facts and new symptom answers; refused Walk creates no movement observations/session. Permitted seated activity records its actual mode, without day steps or unperformed cardio.

### J16, P06: flare, deterioration and neurological red flags

**SAFETY 8 of 10.** Basis: D25, D28, D29(7), D30; A-BACK, T-NEURO, T-BACK, E-CES and E-BILATERAL.

| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | Open Today with the active Flare-up status. | Gentle/no movement recommendation, visible reason, quiet habit prompts. No programme pressure or claim that a specific pain score proves safety. |
| 2 | Back/leg pain `1`, reach `Foot`, walking/sitting newly harder than yesterday; no weakness or emergency symptoms. Submit. | Adjust: stop provoking activity, withhold progression, previously tolerated appropriate activity only. Loading ladder cannot promote. No automatic 20% load reduction, +500 steps or fixed safe pain threshold. |
| 3 | Separate fresh case: same low pain, select `New foot drop or foot dragging, or a leg getting weaker`. | Contact/assessment **today**, no recovery, Stretch or Walk session. |
| 4 | Add weakness getting worse quickly over hours, or a new bilateral flag, or a bladder/saddle flag. | Emergency escalation; not softened by 1/10 pain, normal glucose or known left sciatica. |
| 5 | Separate cases: back pain with fever/shivering but no measured temperature; sudden severe/rapidly worsening back pain. | Today assessment, no session. A missing thermometer reading does not clear reported systemic symptoms. |
| 6 | Start a permitted gentle case, then use its visible symptom-stop control and report new distal spread or new foot drop. Repeat while walking, and in Guided with P06 seeded in the programme (defined setup below). | Provoking movement stops immediately. Distal spread blocks progression; foot drop ends exercise and directs today care. The shared rule applies during activity and on Resume. |
| 7 | Report `Dizzy or faint on standing or when active` with BP `110/70`. | Stop/hold despite a normal-looking BP, safe sit/lie direction; no forced fluid instruction if fluid restriction is set. Collapse without normal recovery uses the emergency branch. |
| 8 | Reload Track → Back & leg, then attempt another mode. | Pain, reach/change, weakness/systemic flags and relevant session symptom outcome survive. No computed “nerve damage” diagnosis or promised recovery date. |

Historical bilateral sciatica with no **new** bilateral loss is a nonemergency control. Stable familiar pain can justify comfort changes; pain 0 cannot clear a reported red flag. Sciatica education says improvement often takes weeks to months and recurrence is possible, without guaranteeing that this programme cures it.

**Defined setup for Guided (D35):** P06 is not in the programme, so its modes are Stretch and Walk: “no recovery, Stretch or Walk session” and the refusals in steps 3–5 cover those two and the stretch player's own link, and step 8's other mode is Walk. Step 6's Guided row seeds P06 with `settings.startDate` `2026-09-24` and the envelope's Monday, Thursday and Saturday training days, so Thursday 8 October has a programme session.

**Stored:** separate actual back/leg pain point observations and symptom/function flags in the check-in. Distal reach and function are not replaced by a composite pain score. No numeric zero created for unanswered leg pain, and no unperformed movement after a stop.

### J17, all personas: failure visibility, durable writes and recovery

**SAFETY 9 of 10.** Basis: D13, D16, D28, D30; PLAN Task 1 and accepted data-review fixes.

Inject faults in the browser's storage API after seeding/migration, never by changing application code. Test both a thrown `DOMException('…','QuotaExceededError')` and a Safari-like thrown object `{name:'QuotaExceededError',code:22}`. Also abort an actual readwrite transaction after requests were queued, so success of a `put` request alone cannot count as a commit.

| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | Snapshot P01. Fail the next glucose observation write; Track → Add glucose 111 → Save. | Visible storage error and retained draft. No Saved acknowledgment. No new glucose in the authoritative snapshot or phantom saved timeline row after rollback/resync. |
| 2 | Reload while the fault is active, recover the same draft; remove fault and Save once. | Exactly one committed 111 observation with the original intended time/unit/context. No duplicate from retry. |
| 3 | Finish a walk; abort saving after at least one segment record committed and before all its records finish. | Explicit incomplete-save state, retry available, progress retained. UI does not claim the whole walk saved. Already committed records are identified, not silently discarded. |
| 4 | Reload that summary; retry; separately choose Discard after a partial-save failure. | Retry yields the exact complete walk set once per stable ID. Confirmed Discard removes any partial saved walk records, or exposes a failed removal; never claims discard succeeded while leaving hidden remnants. |
| 5 | Fail saving a finished Guided/Stretch session. | Unsaved state visible, logged work/progress retained. No success toast or progress-cache deletion before durable session commit. After reload/retry, one session with exactly the logged work. |
| 6 | Fail a health/profile update from unknown medicines to known metformin-only. Attempt Start before and after the error. | No clearance based on an uncommitted profile. Previous persisted profile remains; failure visible. Retry is required before the change is acknowledged. |
| 7 | Fail saving a newly selected emergency over an earlier safe check-in. Try other modes, reload and Resume. | Immediate emergency guidance and refusal remain, even though persistence failed. Pending safety evidence is retained for retry and cannot be replaced by cached safe clearance. |
| 8 | Open two tabs of the same context. Both add Water 250 concurrently; separately change appearance and a different profile setting while writes queue. | Effective water total 500, with two actual additions. Both acknowledged independent changes persist. A failed earlier write cannot overwrite a later successful one during rollback. Tabs resynchronise. |
| 9 | Suspend a write before transaction completion, reload; inspect, then recover/retry. | Before commit, no Saved claim. After recovery, either the old or fully committed new transaction state, never torn BP halves/check-in projections. Retry does not duplicate an already committed operation. |

For step 3, multi-transaction walk saving may retain a clearly labelled partial record; this differs from the atomic Replace requirement in J18. A BP **pair** and a check-in with its projections must commit together. No exception should be silently swallowed, and failed writes must appear in store failure state as well as the task UI.

**Stored:** committed preexisting records unchanged by failed atomic operations; failed new atomic records absent; pending progress/drafts recoverable; exact intended records once after retry. Neither optimistic rendering nor disappearance of a spinner establishes persistence.

### J18, P01: backup, Replace and clearing all data

**SAFETY 10 of 10.** Basis: D13, D16, D17, D23; PLAN Task 1.

| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | In P01, add one glucose and one day steps total through the UI. Create reading-state content by merging a canonical backup that carries one content-state row through You → Data & offline → Restore from a backup. This is the defined setup, because no screen writes reading state. Then You → Data & offline → Back up your record. Download or complete an explicit file share. Capture and decode backup B. | `format='fit-strong-health-record'`, `version=1`, `schemaVersion=5`; all four stores' application data represented, including settings/profile/check-ins/PRs/body metrics/focus overrides/content state. No health data sent to a service. |
| 2 | Add a new glucose and a new session after B. Snapshot A. Select Restore from a backup and B. | Preview counts/date range/profile/settings before mutation; A is byte-for-byte unchanged at this checkpoint, apart from explicitly unrelated metadata. |
| 3 | Tap Replace everything here, then Keep what is here. Reload. | Confirmation clearly describes deletion. Cancel preserves all of A, including newer records and settings. |
| 4 | Repeat Replace; before final Replace everything, inject transaction abort/quota failure during the replacement. | Failure says nothing changed. A survives across all stores, no partially cleared record and no false Restored acknowledgment. |
| 5 | Remove fault, choose B again, confirm Replace everything; wait for completion and reload. | Record equals B's logical contents, with the documented export-date/internal metadata exceptions. Newer A-only records are absent because Replace was explicitly chosen. Profile/settings/reading state restored; no mixture of A and B. |
| 6 | You → Data & offline → Delete everything on this device/iPhone; choose Keep my record. | No change. Existing legacy blob/progress/data still present. |
| 7 | Repeat; inject clear transaction failure; confirm Delete everything. | Failure visible, record and settings preserved, no welcome gate falsely presented as success. |
| 8 | Remove fault, confirm Delete everything; wait for reset, reload twice. | Welcome as a new user. No observations, sessions, profile, check-ins, PRs, body metrics, food preferences, focus overrides, reading state or reminders. Old v4 blob and app-owned progress/draft flags removed; no migration resurrection. |
| 9 | Restore B from Welcome. | Preview and explicit Restore; same logical record as B, correctly onboarded state and persona, rather than merged default first-run settings. |

**Stored:** after Replace, exactly B's logical record; after Clear, empty health/session/content stores and only permitted empty defaults/schema/internal metadata. An unrelated test-namespace flag may remain. No GPS track in B. Restored observations retain original `manual`/`measured`/`imported` labels; import itself is not a new measurement.

### J19, P01: merge, malformed files and capability fallback

Basis: D10, D16, D17; PLAN Task 1.

| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | Export B, then correct an existing observation on the device so its `editedAt` is newer; add another record. Merge B twice. | Newer device correction retained, new device-only record retained, no duplicate IDs, totals or sessions. Merge retains this device's settings/profile. |
| 2 | Import a file with the same observation ID and a provably newer correction. | Merge keeps the newer observation; preserved context/tag/time/source unless the correction explicitly changed them. Other records remain. |
| 3 | Import an equal-revision but different record, or conflicting session/check-in/body metric without a per-record revision. | Conflict disclosed. Default keeps device copy unless the user explicitly chooses file/conflict resolution; no silent older overwrite or misleading “file always wins” copy. |
| 4 | Select truncated JSON, invalid gzip, unknown format/version, negative glucose, unknown unit, invalid calendar date and a malformed BP half. | Readable error/preview rejection. No crash or write. A file with rejected records cannot silently half-Replace a good record. |
| 5 | Simulate CompressionStream absent; export again, then restore that file in a fresh context. | Plain JSON `.json` fallback, matching MIME, lossless restore; no unusable gzip label or unavailable-control dead end. |
| 6 | Simulate canShare false or share absent, then a user-cancelled share. | Download fallback in the former cases. Cancellation preserves the record and does not mark a backup as successfully delivered or reset its reminder. |
| 7 | Open a backup from a later unsupported schema. | Clear update-required error and no record changes. Unsupported Apple Health XML/ZIP is rejected honestly, not treated as a validated Health connection. |

**Stored:** a lossless logical round trip, stable IDs and original provenance. A failed/cancelled operation creates no health records, fabricated day totals or partial destructive replacement. All file parsing remains local.

### J20, P07/P01: offline shell, navigation and boot recovery

Basis: D4, D7, D13, D16, D23, D24; PLAN Tasks 2, 3 and 10.

| Step | Script action | Exact observable outcome |
|---|---|---|
| 1 | Warm every supported route/content/player asset, wait for service-worker control, take the context offline, reload and visit every tab. | Previously cached app and authored guidance work. Missing optional voice/demo asset yields text/captions and a truthful availability state, not an empty app or fabricated download success. |
| 2 | Open each root, You, its editors, then Done; open details from Track and Move, use Back. | Returns to actual origin with date/view/filter retained. Direct detail entry has a sensible parent fallback. Session/live walk stay full screen; their exit returns to the intended surface. |
| 3 | Open legacy hash routes with query strings: dashboard → today, workout → track/workout, plan → move/plan, library → move/exercises, progress/history → track, settings → you, profile → you/profile. | Correct destination, retained query string, no extra legacy navigation items. `/dashboard?checkin=1` still opens the intended check-in. |
| 4 | Open an unknown child under every route subtree; fail one lazy screen download. | Working fallback/error screen and usable navigation/retry, not an empty shell or permanently blank tab bar. |
| 5 | Fresh fault case with existing P01: make IndexedDB opening unavailable/blocked, reload. | Explicit storage-unavailable/retry state, never first-run setup pretending the saved person is new. Existing data/legacy source untouched; no new migration/default writes over it. |
| 6 | Remove the fault/release the other connection; Retry/reload. | P01 record returns exactly, with correct appearance and onboarding state. An inspection connection closes on version change; no indefinite silent wait. |

**Stored:** navigation and offline use do not mutate clinical facts. No remote account, telemetry containing health context, API credential or backend dependency. Source originals open only on explicit taps, without health-containing query parameters.

## Checks on every screen and sheet

Apply these checks at **every visible checkpoint**, not only the four roots. Include empty, populated, loading, failed, refused and restored states.

| Check | Unambiguous pass condition |
|---|---|
| Horizontal layout | `document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1` at 320 and 430. No essential label/value/control clipped by overflow hiding. All content is reachable by vertical scroll. |
| Errors | No unexpected console error, uncaught exception or unhandled rejection. Only an explicitly identified fault-test browser resource failure may be exempted. |
| Landmarks and heading | Exactly one main landmark; one exposed level-1 screen heading with the correct title. Compact duplicate title is aria-hidden. Main tab navigation named; active destination observable, including Move on Walk routes. |
| Controls | Every actionable item has a nonempty accessible name and correct button/link/input/checkbox/radio/switch role. Keyboard can reach it, with arrow navigation inside composite controls. Minimum 44 × 44 CSS-pixel target; focus visibly indicated. Numeric inputs use appropriate input mode and readable size. |
| Focus/navigation | Forward navigation focuses the destination heading/main; Back returns to origin. Dialog open moves focus inside; Tab/Shift-Tab remain inside; Escape/Close returns to opener. Background content is inert while a sheet is open. Route change closes obsolete sheets. |
| Dark/light legibility | Measure actual foreground/background contrast, including tint on grouped background, on-tint on tint, caution text/fill and stop text/fill. WCAG 2.2 AA: at least 4.5:1 ordinary text, 3:1 large text; warnings/selection also have words/state, not colour alone. No wrong-theme first rendered frame or unreadable native inputs. |
| Small/large text | Repeat screen sweep with 200% text enlargement. No lost Start, Stop, Save, emergency text, source label, unit or close control; sheets scroll as needed. Pinch zoom is not disabled. |
| Motion | In reduced motion, navigation and decorative ring/number animation do not delay usability. No stuck transition or frozen control. Instructional demo remains pausable and has textual instructions. |
| Charts/stats/ring | SVG attributes and displayed numbers are finite; no NaN/Infinity, fake zero gaps or unexplained unit conversion. Values are accessible outside colour/geometry, through labelled text/list/table. A 25-of-20 weekly goal displays actual 25/20 without raising the target or rendering overflow. |
| Safety visibility | Symptom-stop control reachable while moving. Emergency/today directions are readable at body text size. A generic disclaimer cannot replace a specific refusal, reason or release. No dosing or medication-change action. |
| Tabs and task layout | Four tabs, no More/Ask. Roots have You. Full-screen player/live walk have no accidental tab targets; summary/setup return navigation remains available. Storage banner never covers an action. |
| Privacy/provenance | Every recorded value has a source and appropriate context/coverage. Missing steps/readings say Not entered/Not measured. No camera HR/posture/form score, barcode food diary, background step counter or pretend HealthKit connection. |

### Route coverage inventory

Exercise this inventory in all four projects, using real record IDs/hrefs obtained from the seeded UI. A route existing in the router does not establish that its content works.

| Area | Screens and states that must receive the checks above |
|---|---|
| Welcome | Focus; installation/storage explanation; first-movement health questions; restore preview/error; incomplete first-run reload |
| Today | Scheduled, resume, no history, rest, Flare-up/Unwell/Away, emergency/hold; chooser and status sheets |
| Move | Root; Stretch setup; Your plan/current week/phase disclosure; exercise search/filter; exercise detail/demo; each refusal |
| Player | Guided and Stretch ready/running/paused/rest/checkpoint/stop/summary/save failure; voice/demo unavailable |
| Walk | Setup, after-meal inputs, denied/poor GPS, live, paused/hidden-gap, symptom-stop, summary, partial save/retry/discard |
| Track | My Day empty/populated/date selection; Add and every form; Timeline/Trends; every supported metric detail; Back & leg; reading/BP/check-in/walk/session detail/edit |
| Workout Log | Today entry, one exercise/set input, optional timer/notes, historical record/edit, save failure; no duplicate coached Start or builder |
| Guide | Search/empty result, topic, guidance card, meal preferences/ideas/detail/sample week if shipped, Sources and source detail |
| You | Root, Profile & health/review, Food preferences, Focus, Habits & reminders and calendar, Voice & demos, Appearance & text, Data & offline and every destructive/error sheet |
| Recovery | Storage unavailable/blocked, lazy-route failure, unknown route, offline optional asset failure |

### Reload checkpoints

“Survives reload” has observable state, not just an app that loads again:

| Task interrupted | Reload checkpoint | Required recovered state |
|---|---|---|
| First run/profile editing | After an acknowledged answer/section, and with a dirty form | Saved answers unchanged; unfinished step/draft values restored, never defaults reported as answers |
| Quick Log/edit | Value, units, event time, meal tag/start entered before Save; then while Save is pending | Draft restored and clearly unsaved; no phantom observation. On retry, preserve intended measurement time rather than relabelling it now |
| Low/recheck | Immediately after low save, before due time, and after a normal recheck of a level 2 low | Earlier measurement/rescue timing/review remain; no release solely because the component remounted |
| Guided/Stretch | Paused after a logged set; finished before save commit | Same attempt/plan/date/step/logs; unfinished activity never auto-completes |
| Walk | Running, paused, hidden, finished unsaved, partly saved | Same walk; interruption gap explicit; no position bridge or duplicated saved segment |
| Import/export | Preview before confirmation, replacement pending, delivery cancelled | No mutation before confirmation; replacement atomic; cancellation is not successful delivery |
| Status/goal/habits/theme | After save, while queued write pending | Every acknowledged setting retained; pending operation either completes durably or exposes failure, never silently dropped |

Unsaved drafts may use the small in-progress storage permitted by D13. They must not appear as durable measurements or be exported as measured facts. If the platform refuses even draft storage, show that loss risk immediately and keep the task unsaved; do not promise reload recovery that cannot occur.

## Final reconciliation and release rule

The safety disposition order is **emergency > today > hold > adjust > reassure**. J03 combines emergencies with invalid fields and saved plans; J14 combines emergency ketones with hypoglycaemia; J04 combines severe raw BP with a lower average; J16 combines red flags with low pain. In every case, the strongest applicable care direction must remain first and exercise permission must reflect it. A legacy green/amber/recovery result cannot mask a refusal.

A product may retain explicitly documented, safe extra comfort restrictions, such as avoiding heavy strain at exactly 160/100. It cannot claim those are the strict `>` guideline boundary, turn them into medication advice, or use them to defer a more urgent condition. The accepted single-severe-BP outcome set is documented in J04. The repeated level 1 low contact policy is the board's D29 resolution, not the older contract's blanket same-day instruction.

Fixed “safe” pain cutoffs, automatic step/load increases, a routine vitamin D testing interval and universal sunlight minutes remain **Unsourced, do not ship**. Failure to implement a supported requirement is a release failure; invented clinical rules are also a release failure.

Chromium can validate these journeys, data invariants and capability fallbacks. It does not prove installed iOS Safari's keyboard geometry, landscape notch insets, actual storage retention/eviction, native share/calendar handoff, audio interruption or Wake Lock behaviour. Before the owner receives the app, perform a separate device pass for those properties, with the same source/coverage and save guarantees. Do not mark an iOS claim verified from a Chromium mock.

Release requires all twenty journey families, all their mandatory parameter rows, all ten flagged safety families and the screen/reload sweep to pass. Record a failure by journey/step/project with the input, screenshot, visible result and database difference. An empty TODO, skipped required question or passing legacy engine unit test cannot substitute for this acceptance evidence.
