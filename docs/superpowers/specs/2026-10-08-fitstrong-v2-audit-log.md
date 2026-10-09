# FitStrong v2: audit log for the journey and motion specs

Two independent audits of draft 2 were run on 8 October 2026, read-only and with no tools that change anything:

- **Codex** (GPT-6.1 Sol, max reasoning, static review of a 148 KB bundle). It returned findings A-01 to A-78, 26 missing journeys, a review of each motion item, and a tap-budget table. Report: `/tmp/fit-checks/v2audit/codex-out.md`, summarised here.
- **Kiro** (Opus 5.5, reading the repo files itself). It returned findings K-01 to K-61, a cognitive walkthrough for each persona P01–P06, and 23 contradictions. Report: `/tmp/fit-checks/v2audit/kiro-clean.md`.

Both verdicts were "do not implement draft 2 as written". Draft 3 of the journey spec and draft 2 of the motion spec are the reconciliation.

In the tables below:
- **Accepted** means taken as proposed.
- **Modified** means the problem is accepted but solved differently, with the reason given.
- **Rejected** means not taken, with the reason given.
- Section numbers refer to journey draft 3 (J§) and motion draft 2 (M-numbers).

## 1. Where the two audits agreed independently

These findings were raised by both auditors, which is strong evidence they're real. All were accepted.

| Theme | Codex | Kiro | Resolution |
| --- | --- | --- | --- |
| Motion can delay safety (M1, M3, M16) | A-02 | K-01, K-02, K-03 | Motion rule 2: urgent content is there in the first frame, and transitions are skipped. J§4.3 |
| Setup can miss safety inputs (SGLT2 without diabetes, clinician limits, prior DKA…) | A-06, A-07 | K-05 | A medicines question asked regardless of diagnosis, and a crosswalk from each field to its question, with a build test. J§6.2, J§6.3 |
| Daily rings break D31, with "goal reached today" and laps | A-39 | K-06 | One weekly Move ring, never past 100%, no celebration. J§7.3, M12 |
| The 20-minute strength session for people not enrolled breaks D35 | A-09 | K-07 | "Join the programme", or "Stretch instead". J§8.3 |
| The route privacy copy was false | A-51 | K-09 | Honest disclosure. Maps are opt-in, and never load during a live walk. J§9.1, J§9.2 |
| Status averages hide readings from Unwell days | A-43 | K-10 | Clinical readings always count, and the days included are named. J§12.2 |
| Today's log (My Day) went missing, though M16 still referred to it | A-30 | K-15 | `/day/:date` is kept. J§13 |
| The redirects were incomplete and dropped query strings | A-35 | K-16, K-17, K-18 | A full inventory test, query strings kept, `/walk/summary` kept. J§19.3 |
| The decision can go stale between render and tap | A-01 | K-19 | Gate at the tap, and again before moving. J§4.1 |
| `sexForEstimates` was never asked | A-14 | K-44 | Dropped: no estimate needs it any more. J§18.1 |
| Setup was too long, and the length claim was unsupported | A-23 | K-25 | A measured inventory: 20 pages or fewer on the minimal path, 30 or fewer on the complex one. J§1.2 |
| Two 160 pt tiles don't fit at 320 px | A-59 | K-26 | One column below 375 px or above 130% text. J§7.1 |
| The compact tab bar loses its labels | A-62 | K-27 | M6 removed |
| A 5-second Undo is too short | A-65 | K-38 | Undo stays until the next action, with no timer. J§20.4 rule 6, M19 |
| Icon-only controls (the bell, "−", "…") | A-62 | K-39 | Every control is labelled. J§20.4 rule 2 |
| Charts need alternatives to colour and touch | A-63 | K-41 | "Show as list", a text summary, arrow keys, neutral deltas. J§12.2 |
| The BP minute moves focus | A-64 | K-47 | It announces instead of moving focus. M9, J§10 |
| "Something else" had two destinations | A-31 | K-35 | The chooser sheet, with "All categories" as its last row. J§7.4 |
| A meal took about 10–12 taps against a budget of 4 | A-21 | K-31 | "Your usual" meals, and "+" adds without leaving the list. J§11.3 |
| The after-meal walk took 2 taps against 1 | tap table | K-32 | The Right now action runs directly. J§7.4 |
| Trends for any category depended on Home pins | A-29 | K-33 | Trends lists every category with data. J§12.1 |
| Steps had no hub, and there was no goal entry | A-28, A-33 | K-14 | A registry with Steps, and Me → Goals. J§5.1, J§16 |
| Status couldn't be set | A-33 | K-13 | "How are you today?" on Home. J§7.1 |
| Calorie targets for insulin and SU users, and disordered eating | A-13, A-15 | K-22 | No generated targets, a counts-free mode, a screening question, carb ranges. J§11.5 |
| The INDB and IFCT licence | A-19 | K-21 | USDA FDC (CC0) ingredients with authored recipes. J§11.6, J§22 |
| Glass inside view transitions in WebKit | A-70 | K-53 | Solid during transitions (WebKit 302256). J§20.1, M3 |
| A WebGL map at 30 fps breaks D18 | A-68 (performance) | K-08 | No map pictures while tracking; static tiles afterwards. J§9.2, J§9.5 |
| HI and LO readings flatter averages | A-44 | K-11 | Excluded from the average, shown in caution ink, and the change is hidden when there's a LO. J§12.2 |
| Milestones could reward unhelpful behaviour | A-15 | K-51 | Milestones dropped (D19), and replaced with a factual "Your week". J§12.6 |

## 2. Codex findings (A-01 to A-78)

| ID | Sev. | Resolution | Where |
| --- | --- | --- | --- |
| A-01 | Blocker | Accepted: gate at the tap, and re-evaluated just before movement, for every path | J§4.1, M10 |
| A-02 | Blocker | Accepted: urgent content first, stale snapshots removed | Motion rule 2, J§4.3 |
| A-03 | Blocker | Accepted: closing guidance never clears it, and movement stays paused | J§4.4, M8 |
| A-04 | Blocker | Accepted: "Saved" only after a durable write, and a failure keeps the draft | J§4.5, M15, M16 |
| A-05 | High | Accepted: corrections never resolve incidents | J§4.6 |
| A-06 | Blocker | Accepted: a medicines question regardless of diagnosis | J§6.2 ch. 4 |
| A-07 | High | Accepted: a field crosswalk with a build test | J§6.3 |
| A-08 | High | Accepted: the mode's permission comes first, and copy states the real release | J§4.2, J§7.5 |
| A-09 | High | Accepted: the approved planner only, and the 20-minute session dropped | J§8.3 |
| A-10 | High | Accepted: "Did you just have lunch?" before tagging a walk | J§7.4 |
| A-11 | High | Accepted: each BP reading acts on its own | J§10, M9 |
| A-12 | High | Accepted: measured date and time, unit and context; prefill never stamps | J§4.10, J§7.2 |
| A-13 | Blocker | Accepted, and simplified: no generated intake targets at all | J§11.5 |
| A-14 | High | Accepted: sex is never inferred, and `sexForEstimates` is dropped | J§18.1 |
| A-15 | High | Accepted: a counts-free mode and a screening question; milestones dropped | J§11.5, J§12.6 |
| A-16 | High | Accepted: allergies are hard filters, with tagged recipes | J§11.1, J§11.6 |
| A-17 | High | Accepted: unknown nutrients stay unknown, and partial totals are labelled | J§11.4 |
| A-18 | Medium | Accepted: no carb target unless entered from the care team | J§11.5, J§18.1 |
| A-19 | High | Accepted: licence, version and attribution recorded, gram portions, provenance | J§11.6 |
| A-20 | High | Accepted: the Food hub and tile exist with logging off | J§5.1, J§11.1 |
| A-21 | High | Accepted: saved meals give the 4-tap path; first-time paths are counted separately | J§1.2, J§11.3 |
| A-22 | Medium | Accepted: correction any time, and history stays when logging is off | J§11.3, J§11.5 |
| A-23 | High | Accepted: a measured inventory | J§1.2 |
| A-24 | Medium | Accepted: number fields with typing; no wheel; no default measurements | J§6.2 |
| A-25 | Medium | Accepted: "set up once" made precise | J§6.1 |
| A-26 | High | Accepted: draft-save failure state; completion stored apart from gaps | J§6.1, J§18.1 |
| A-27 | High | Accepted: treated as not shared, with a backup handoff | J§6.5, J§22 |
| A-28 | High | Accepted: the category registry | J§5.1 |
| A-29 | High | Accepted: Trends is independent of pins | J§12.1 |
| A-30 | High | Accepted: Today's log | J§13 |
| A-31 | Medium | Accepted: the chooser | J§7.4 |
| A-32 | High | Accepted: Back goes to the real opener; cold launch and foreground return are separate | J§8.1, J§19.1, M4 |
| A-33 | High | Accepted: entries for status, goals, Join and Leave, and the plan shift | J§7.1, J§16 |
| A-34 | High | **Modified (already true in v1):** `recommend.ts` `resume()` already returns nothing while Unwell or Away, and offers only stretch during a flare. The spec now states v1's rule | J§4.8, J§7.4 |
| A-35 | High | Accepted: complete inventory, and a test | J§19.3 |
| A-36 | High | Accepted: dated weights and goals | J§12.4, J§12.5, J§18.1 |
| A-37 | Medium | Accepted: grouped Home and hub variants | J§7.1, J§8.2 |
| A-38 | Medium | Accepted: the layout keeps what the person chose; Back & leg pinned only for relevant answers | J§5.1 |
| A-39 | High | Accepted: the weekly model, no fabricated rest activity | J§7.3 |
| A-40 | High | Accepted: v1's typed aggregation and overlap rules; partial records kept; no WHO claim | J§12.3 |
| A-41 | High | Accepted: neutral deltas | J§12.2 |
| A-42 | High | Accepted: defined periods and like-for-like comparisons | J§12.2 |
| A-43 | High | Accepted | J§12.2 |
| A-44 | High | Accepted: n, range, lows and highs, context | J§12.2 |
| A-45 | High | Accepted: labs as dated points | J§12.2 |
| A-46 | High | Accepted: the urgent banner everywhere | J§4.7 |
| A-47 | High | Accepted: step sources, the as-of time, sensor steps kept without GPS | J§9.6, J§9.4 |
| A-48 | High | Accepted: separate segments, no joining lines, pace only with valid distance | J§9.3, J§9.2 |
| A-49 | High | **Modified (no conflict found):** v1's walk credits each segment to its own day (F17, `src/walk/clock.ts`); "the evening before" applies only to suggestions (`dayPartOf` in `recommend.ts`). Both are kept and both are stated | J§3.2 |
| A-50 | Blocker | Accepted: the units are fixed, and the formula is now active energy, (MET − 1) × kg × hours | J§12.4 |
| A-51 | High | Accepted: honest copy, opt-in map pictures, a privacy view, no requests before consent | J§9.1, J§9.5 |
| A-52 | High | Accepted: OSM tiles named, with policy limits (attribution, no prefetch or offline, no SLA) and a fallback | J§22, J§9.5 |
| A-53 | High | Accepted: motion permission from a tap; Wake Lock feature-detected; on-device step validation | J§9.1, J§9.2, J§21.3 |
| A-54 | High | Accepted: zoom and recentre buttons, and a text summary | J§9.2, J§9.5 |
| A-55 | Blocker | Accepted: atomic linked writes, a consistent snapshot, quota handling | J§18.3 |
| A-56 | High | Accepted: import limits and validation | J§18.3 |
| A-57 | High | Accepted: route journalling; recovery as an inline row, with urgent first | J§9.4 |
| A-58 | High | Accepted: atomic cache, and no reload during a task | J§21.2 |
| A-59 | High | Accepted | J§7.1 |
| A-60 | Medium | Accepted: 428×926 CSS px, px tokens (confirmed by the design research) | J§2 |
| A-61 | High | Accepted: reflow tests at 320 px and 400% | J§2, J§20.4 |
| A-62 | High | Accepted | J§20.4, M6 |
| A-63 | High | Accepted | J§12.2, M21 |
| A-64 | High | Accepted: dialogs, focus restoration, no focus theft | M8, M9, J§20.4 |
| A-65 | High | Accepted | J§20.4, M19, M20 |
| A-66 | High | Accepted: an in-app Reduce motion in setup and Me, with specific replacements | Motion rule 4, J§6.1, J§16 |
| A-67 | High | Accepted: no replayed sweeps, cascades or loops | M1, M13, M21, M22 |
| A-68 | High | Accepted: a solid walk panel, no page blur, a blur inventory, measured targets | M4 layers, motion §7 |
| A-69 | Medium | Accepted: JS springs for gestures; overshoot at most 0.15 and never on values | Motion §2, §3.1 |
| A-70 | High | Accepted: one owner, names set before capture, a fade when the source is missing | Motion rule 3, M3, M4 |
| A-71 | High | Accepted: one loading pattern | M24, J§8.4 |
| A-72 | High | Accepted: recorded walk cues only (no composed numbers); audio unlocked by a tap; queued speech cancelled | J§9.2, M10, M11 |
| A-73 | Medium | Accepted: food prompts are a reminder subtype, with a defined rank and cap | J§7.4 |
| A-74 | High | Accepted: quiet hours never hold safety | J§4.9, J§15 |
| A-75 | High | Accepted: a monotonic elapsed clock; clock jumps never make a reading fresh | J§17.2 #41 |
| A-76 | High | Accepted: real older-adult testing and a physical iPhone; clinical expectations in tests don't change | J§1.2, J§21.3 |
| A-77 | Medium | Accepted: v2 behind a flag, and the switch made together | J§2, J§21.1 |
| A-78 | High | Accepted: calendar copies explained, with a record of exports | J§15 |

**Codex's 26 missing journeys** are now V-J17 to V-J42 (J§17.2). Each of the 26 is kept, worded to match the spec's final names.

**Codex's motion review (M1–M24):** every "required change" in its table is reflected in motion draft 2 under the same M-number. M6 is removed.

## 3. Kiro findings (K-01 to K-61)

| ID | Sev. | Resolution | Where |
| --- | --- | --- | --- |
| K-01 to K-03 | Blocker | Accepted | Motion rule 2, M1, M3, M16 |
| K-04 | Blocker | Accepted: tile lines come from the permission for each mode, with a P05 acceptance case (V-J15 and V-J04 cover holds) | J§7.5 |
| K-05 | Blocker | Accepted | J§6.2, J§6.3 |
| K-06 | High | Accepted (the weekly ring) | J§7.3 |
| K-07 | High | Accepted | J§8.3 |
| K-08 | High | Accepted, and stronger: no map pictures at all while tracking | J§9.2 |
| K-09 | High | Accepted | J§9.1 |
| K-10, K-11 | High | Accepted | J§12.2 |
| K-12 | High | Accepted: no step praise when walking is held for the feet; no Steps tile by default then | J§5.1, J§12.1 |
| K-13 | High | Accepted | J§7.1 |
| K-14 | High | Accepted | J§5.1, J§8.2, J§16 |
| K-15 | High | Accepted | J§13 |
| K-16 to K-18 | High | Accepted | J§19.2, J§19.3 |
| K-19 | High | Accepted | J§4.1 |
| K-20 | High | **Modified:** a single-choice focus question matches the engine's single `focus`; the multi-select is dropped | J§6.2 ch. 6 |
| K-21, K-22 | High | Accepted (K-22's insulin carb ranges included) | J§11 |
| K-23 | High | Accepted: "Look around first" keeps J01 | J§6.2 ch. 1, J§6.4 |
| K-24 | High | Accepted | J§6.5 |
| K-25 to K-29 | High | Accepted | J§1.2, J§7.1, M6, J§20.1, J§9.1 |
| K-30 | High | Accepted: the after-meal walk is skipped when a standing foot restriction holds walking, and not offered in setup | J§7.4, J§6.2 ch. 8 |
| K-31 to K-34 | Medium | Accepted | J§11.3, J§7.4, J§12 |
| K-35 to K-37 | Medium | Accepted | J§7.4, M18, M20 |
| K-38 | Medium | **Modified, then corrected in verification (L-06):** Undo with no timer (the research's rule), plus Today's log's "Recently deleted" (7 days, rebuilt from deletion records) | J§20.4 rule 6, M19, J§13 |
| K-39 to K-42 | Medium | Accepted | J§20.4, J§12.2, J§8.2 |
| K-43 | Medium | Accepted: the year of birth is a number field | J§6.2 ch. 2 |
| K-44 | Medium | **Modified:** the field is dropped rather than asked | J§18.1 |
| K-45 to K-49 | Medium | Accepted | M2, M8, M9, J§7.5, J§12.2 |
| K-50 | Medium | Accepted | J§9.6 |
| K-51 | Medium | Accepted (milestones dropped) | J§12.6 |
| K-52 | Medium | Accepted: reversals declared in J§3.1 (D4, D5, C5, pinning, D9, D12, routes), and D21's chart shown in the Back & leg trend | J§3.1, J§5.1 |
| K-53 | Medium | Accepted | J§20.1, M3 |
| K-54 | Medium | Accepted: the Right now card is solid | J§20.1 |
| K-55 | Medium | Accepted: `HREF` updated | J§19.3 |
| K-56 | Medium | Accepted: the tip is an inline row | J§6.6 |
| K-57 | Medium | Accepted: v1 Welcome answers fill in v2 setup | J§6.4 |
| K-58 to K-61 | Low | Accepted (one copy table; Back names the opener; tile drop order; the name is shown on screen only) | J§7.5, J§8.1, J§5.1, J§6.2 |

**Kiro's 23 contradictions** are all resolved by the rows above. **Kiro's persona walkthroughs** are covered:
- P01: K-56, K-06, K-47, K-15 and K-16.
- P02: K-20, K-05, K-25 and K-07; the stretch reason copy now uses real inputs only (J§8.3).
- P03: K-29, K-19, K-22 and K-09; after-meal walks need meal times (J§6.2 ch. 8).
- P04: freshness is stated as the check-in exception in J§1.2, plus K-22, K-11 and K-51.
- P05: K-04, K-12 and K-30.
- P06: K-13, K-48, K-06 and K-49; the back chapter's hold names the chapter (J§6.1).

## 4. Facts from the research that changed the specs

| Fact | Source | Change |
| --- | --- | --- |
| Safari turns off backdrop blur during view transitions (WebKit 302256) | design research 2a | Glass goes solid during transitions (J§20.1, M3) |
| Safari doesn't support `prefers-reduced-transparency` | design research 2d | An in-app Reduce transparency setting (J§20.1) |
| No SVG refraction in Safari (WebKit 245510) | design research 1g | No refraction effect (J§20.1) |
| The iPhone 13 Pro Max is 428×926 CSS px; iOS 27 is current | design research | J§2 |
| Apple's guidelines reserve the three-ring look for Activity data | design research 5d | One ring, not a look-alike (J§20.2) |
| Undo without a timeout; two confirmations for irreversible actions; at most 5 choices per region; targets of 60 px or more | design research 4a–4f | J§20.4 |
| The OSM tile policy allows interactive viewing, and forbids prefetch, offline use and bulk download | feasibility research, map | Static tiles on summaries only, opt-in (J§9.5, J§22) |
| USDA FDC is CC0; INDB has no licence; IFCT forbids electronic products; OFF is ODbL and excludes medical use | feasibility research, food | J§11.6 |
| Active kcal = (MET − 1) × kg × hours; 2024 Compendium walking bands | feasibility research, energy | J§12.4 |
| Wake Lock works in Home Screen apps from iOS 18.4; motion permission needs a tap; the 7-day rule is for Safari tabs | feasibility research, iOS | J§9.1, J§9.2, J§22 |

## 5. Points I checked in the code while reconciling

- **A-34 (resume above status).** Not a bug: `resume()` in `src/health/recommend.ts` returns nothing while Unwell or Away, and offers only stretch during a flare.
- **A-49 (midnight).** No conflict: walk segments are credited per day (F17), and the small hours count as the evening before only for suggestions.
- **The design research's note that `useStore.ts:438` only checks `standalone`.** Not a bug on iPhone: `detectInstalled()` checks `navigator.standalone` first, which iOS sets for Home Screen apps, and the manifest's `display` is `standalone`. It's left as is.

## 6. Verification round (draft 3)

Kiro (Opus 5.5) re-audited draft 3 (report: `/tmp/fit-checks/v2audit/kiro-verify-clean.md`):
- 54 of its 61 findings are fully resolved, and 7 partly.
- All 23 contradictions are resolved.
- A-34 and A-49 are confirmed in the code.
- Its verdict: ready for the plan, after small edits.

Its new findings, and what happened to them:

| ID | Resolution | Where |
| --- | --- | --- |
| L-01 | Accepted. Enrolment details moved to the Join flow, the step goal to Me → Goals, and ch.5 pages combined. A page-count test covers both paths | J§1.2, J§6.2 |
| L-02 | Accepted. Motion permission and the audio unlock happen inside the tap that starts recording, on every cold launch | J§9.1 |
| L-03 | Accepted. New rows for the check-in state, profile gaps and the Workout tile when not enrolled | J§7.5 |
| L-04 | Accepted, with v1's behaviour stated: status never blocks on its own (v1's chooser lists movement through the gate); hubs offer "Start anyway" | J§7.5, J§8.4 |
| L-05 | Accepted. Two buttons on the card: "I've had lunch: walk now" and "Just a walk" | J§7.4 |
| L-06 | Accepted. The meaning of "until" is defined, and "Recently deleted" (7 days) is added to Today's log | J§20.4 rule 6, J§13 |
| L-07 | Accepted. Text is worked out again at the next time boundary, and `freezeKey` gains it | J§4.1 |
| L-08 | Accepted. No flare walk wording; "Stretch is suggested today" instead | J§7.5 |
| L-09 | Accepted | J§5.1, J§7.3 |
| L-10 | Accepted. Elapsed time uses `performance.now()`; the day still comes from the device clock | J§9.3 |
| L-11 | Accepted. Meal times are asked right after the after-meal walk opt-in | J§6.2 ch.8 |
| L-12 | Accepted. `currentlyActive` and `clearance` are placed, and the focus mapping is written | J§6.2, J§6.3 |
| L-13 | Accepted. The WHO suggestion appears only for Walk more and Get stronger | J§6.2 ch.6 |
| L-14 | Accepted | J§5.1 |
| L-15 | Accepted. "All categories" is a footer link | J§7.4 |
| L-16 | Accepted. 48 px, never under 44 | J§20.4 rule 1 |
| L-17 | Accepted | J§19.3 |
| L-18 | Accepted | J§12.6 |
| L-19 | Accepted | J§11.2 |
| L-20 | Accepted | J§19.3 |
| L-21 | Recorded as two deliberate departures from the research: a one-time map opt-in, and a single "about" figure | J§9.5, J§12.4 |
| A-34 (untested case) | Plan 2 adds a test that a stretch saved before a flare and resumed during it follows the gentler routine | Plan 2 |
