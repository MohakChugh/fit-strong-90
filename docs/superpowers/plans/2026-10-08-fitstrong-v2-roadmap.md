# FitStrong v2: roadmap of implementation plans

**Specs:**
- `docs/superpowers/specs/2026-10-08-fitstrong-v2-journey-design.md` (draft 3, journey §);
- `docs/superpowers/specs/2026-10-08-fitstrong-v2-motion-design.md` (draft 2, M-numbers);
- `docs/superpowers/specs/2026-10-08-fitstrong-v2-audit-log.md`.

**Branch:** `feat/v2-journey`, created from `feat/reimagine-holistic-health` once the R5 fixes are committed there. v2 is built on this branch until it's complete; PR #3 and `main` stay on v1. The branch stands in for journey §2's "development flag", because a runtime flag would mean keeping two route trees alive. Every plan leaves the branch working, with all its tests passing.

The spec covers several subsystems, so each one gets its own plan, written in full when its turn comes, from the code as it stands then. Each plan produces working, tested software on its own.

| Plan | Covers (journey §) | Depends on | Done when |
| --- | --- | --- | --- |
| **1. Shell and Home** | Tokens, glass, motion module, category registry, the four tabs, Home (status, Right now, This week, tiles, Edit Home), Today's log, every redirect, interim hubs (§2, §4.1–4.3, §5, §7, §13, §19, §20) | — | Home is the launch screen; every v1 address redirects with its query; J01–J20 pass with updated navigation; Codex and Kiro have reviewed it |
| **2. Hubs** | The movement, reading and learn hub variants; hub states; Steps; goals in Me (§8, §9.6, §16 Goals) | 1 | Every registry category opens a real hub; V-J01, V-J04–06, V-J09, V-J12, V-J14 and V-J15 pass |
| **3. Trends** | The Trends tab, the category trend component, statistics, comparisons, readings and labs, "Your week" (§12) | 1, 2 | V-J07, V-J26 and V-J27 pass; the statistics have unit tests |
| **4. Browse and Me** | Browse with search and pick mode; Me sections; Display settings (§14, §16) | 1 | V-J08 and V-J12 pass |
| **5. Setup and upgrade** | The 8 chapters, the field crosswalk, review, install guidance, "Look around first", restore, the v1 upgrade path (§6) | 1, 4 | V-J10, V-J11, V-J13, V-J17, V-J18 and V-J37 pass; `setup.fields.test.ts` passes |
| **6. Walk** | Consents, the live route drawing, segments and gaps, journalling, the static OSM map, summary and detail, routes in backups (§9, §18) | 1, 2 | V-J02, V-J16, V-J19, V-J20, V-J33 and V-J34 pass |
| **7. Food** | Meal ideas with allergy filters, the three logging levels, saved meals, the FDC recipe data, the guards, food records in backups (§11, §18) | 1, 2 | V-J03, V-J28 to V-J31 pass; the food data's licence is on the board |
| **8. Hardening** | The remaining recovery journeys (V-J21 to V-J25, V-J32, V-J35, V-J36, V-J38 to V-J42), the offline/update policy (§21.2), and the performance budget on a device | 1–7 | All V-J and J journeys pass at both sizes, in light and dark |

**After each plan:**
- the unit gates (`tsc -b`, lint, vitest) pass;
- the acceptance suite passes;
- Codex (static, max effort) and Kiro (read-only) review the plan's diff, and the findings are reconciled and fixed;
- the decisions are logged on the board;
- one commit is made per task, on `feat/v2-journey`. Nothing is pushed to `main`.
