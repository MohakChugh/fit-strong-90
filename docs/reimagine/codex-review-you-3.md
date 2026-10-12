# You, Welcome, reminders, Today and shared controls, round 3

**Verification is incomplete.** The current source, test results and browser behavior could not be inspected in this turn. This report does not independently confirm any implementation claim and does not attribute any new defect to the implementation.

The only file written is this report. Source was not modified. No approval or escalation was requested. The app's user is referred to as the person, with they/them pronouns. The test cases below use synthetic personas.

## Execution evidence

| Attempt | Observed result | Consequence |
| --- | --- | --- |
| Fresh read-only shell, `pwd`, in the repository | Exit 71, `sandbox-exec: sandbox_apply: Operation not permitted` | Could not read the current source or prior report through the shell. |
| Reuse the previously available probe session, 11100 | `write_stdin failed: Unknown process id 11100` | The previously running reader and in-memory test runner are no longer available. |
| Check the persistent JavaScript kernel | Kernel exited with code 71 and the same `sandbox_apply` error | No alternative file reader, test runner or browser controller became available. |
| Ask for another already-running read-only probe session | Requested its session identifier asynchronously | No usable identifier was available when this report was written. |

**Executed tests: 0. Browser checks: 0. Source lines independently inspected this turn: 0.** Tests from earlier reviews are not counted as evidence for these changes.

No Vite server was started on port 5242. There was therefore no server from this turn to stop. Other ports were not used.

## Claim disposition

The requested label **PARTIAL** below means the re-check is incomplete, not that a portion of the implementation has been verified. The source paths identify what must be inspected. A reliable `file:line` citation cannot be supplied without reading the file, so no line number is invented.

| Claim | Status | Evidence available and missing |
| --- | --- | --- |
| **N04, an import write prevents sheet dismissal and choosing another file** | **PARTIAL, unverified** | The claim names `src/screens/you/RestoreFlow.tsx` and `restore.ts`. Neither the current handlers nor the tests were accessible. Escape, outside dismissal, explicit Close, file input, double taps and route navigation were not exercised. |
| **N04, completion lands only if nothing newer started; closing invalidates an outstanding file read** | **PARTIAL, unverified** | The request identity and invalidation paths in `RestoreFlow.tsx` and `restore.ts` were not traced. No deferred-read or deferred-import completion was driven. |
| **N05, untouched weight saves its exact stored value regardless of displayed unit** | **PARTIAL, unverified** | `src/components/profile/wizardSteps.ts` and `ProfileWizard.tsx` were not accessible. The separation between original weight, display text and a typed edit was not checked. You, Join and Welcome callers were not traced. |
| **N05, switching units converts the shown number; empty and unfinished entries do not become zero** | **PARTIAL, unverified** | Conversion, dirty-state handling and save validation were not inspected. No unit-switching or incomplete-entry test was run. |
| **Wizard footer uses `sticky bottom-0` and an error does not hide the form** | **PARTIAL, unverified** | The footer class, containing scroll region and error layout were not inspected. No 320 × 568, 430 × 932 or 200% text check was completed. The presence of a sticky class alone would not establish these layout results. |
| **N07, the host rechecks just after each minute starts and on visibility changes** | **PARTIAL, unverified** | `src/reminders/ReminderHost.tsx` and `time.ts` were not read. Timer alignment, rescheduling, cleanup and visibility handling were not tested at the quiet-hour boundary. |
| **Reminder placement, no floating banner on Today; only Session and Walk live skip due reminders** | **PARTIAL, unverified** | `place.ts`, `ReminderBanner.tsx` and the host's consumers were not traced. Waiting versus skipped state was not inspected across navigation. |
| **Today renders a waiting reminder inline in its prompt slot** | **PARTIAL, unverified** | The `variant="inline"` rendering path, competing prompt precedence and acknowledgment action were not inspected in `TodayScreen.tsx`. |
| **B08, a non-diabetic default SGLT2 No does not count as an answer** | **PARTIAL, unverified** | The `answeredOnOpen` and `requiredMedicines` paths and the wizard's submission guard were not read. Default display, explicit answer and persisted review status were not distinguished by a test. |
| **Screen's second sentinel enables material before the original sentinel reveals the compact title** | **PARTIAL, unverified** | `src/components/hig/Screen.tsx` was not accessible. Observer roots, margins, thresholds, cleanup and behavior when the title starts in the bar were not traced. No scroll sequence was observed. |
| **Segmented controls use the new tokens, body-color labels and semibold selection, with sufficient contrast and targets** | **PARTIAL, unverified** | `src/index.css`, Track's shared `ui.tsx` and `src/screens/move/controls.tsx` were not inspected. No color values, contrast ratios, computed target dimensions or wrapping measurements are available. |
| **Track arrow keys and Move's lack of arrow keys are appropriate for their semantics** | **PARTIAL, unverified** | Current roles, tab stops and handlers were not read. The absence of arrow-key handling is a defect if a control exposes a radio-group or tab-list interaction pattern requiring it. A labelled group of ordinary buttons can instead use Tab and Enter/Space. The current implementation cannot be assigned either interpretation from the claim alone. |
| **Today's glucose and BP rows link to their metric pages** | **PARTIAL, unverified** | The destinations in `src/screens/today/TodayScreen.tsx` were not inspected or clicked. No back-navigation behavior was verified. |
| **Deleting 17 unused shadcn primitives leaves no broken imports or rendering paths** | **PARTIAL, unverified** | The deleted filenames and remaining imports were not enumerated. A targeted import-resolution check and route smoke test were not available. |

## Retest cases prepared for a working read-only process

These are unexecuted acceptance checks, not findings. They state the observable outcome needed to finish the re-check without inferring success from an implementation claim.

| Case | Synthetic setup and action | Required observable result |
| --- | --- | --- |
| **Restore, slow write** | The person chooses synthetic backup A. Hold the import write's completion. Attempt Close, Escape, outside dismissal, the file chooser and a second Import tap. | The sheet remains present, the person sees the import is in progress, no second import or file-selection operation starts, and the first import has one completion. Check route-back handling separately rather than assuming a sheet guard covers navigation. |
| **Restore, refused write** | Refuse A's import write. | Failure is displayed without a success landing. Dismissal and selecting another file become available again. The durable data satisfies the import operation's atomic failure contract. |
| **Restore, stale file read** | Hold A's file read, close the sheet, reopen it and select B. Complete B's read before A's read. | A cannot repopulate the reopened sheet, overwrite B's preview or enable importing A. The preview and chosen file remain B. |
| **Restore, stale completion** | Hold A's completion and exercise any permitted close, reopen or route transition that starts a later restore interaction. Deliver A's completion last. | A's late callback cannot change the newer interaction's form, error, selected file or completion landing. A write that already committed is reported according to the durable result, rather than treated as canceled by closing a read. |
| **Weight, untouched precision** | Synthetic person A has stored weight `75.12345 kg`. Open the wizard with pounds shown, leave the field untouched and save through You, Join and Welcome. Repeat after switching the displayed unit twice. | The stored weight remains exactly `75.12345`, not a value converted back from rounded display text. Switching the unit changes the displayed equivalent without making the untouched original dirty. |
| **Weight, edit then switch** | Enter `80` in kg, switch to lb and save. Separately enter `176.4` in lb, switch to kg and save. | The selected unit changes the shown equivalent. The saved number represents the entered physical weight in the canonical unit and does not reinterpret the same text as the new unit. Check the conversion before display rounding and the dirty-state transition. |
| **Weight, empty and unfinished** | Starting from a nonzero stored weight, clear the field or leave an incomplete number, then switch units and try to proceed. Also test an initially absent optional weight. | The app either preserves the untouched original or requests completion of a typed edit, as appropriate. It must not save fabricated zero, NaN or a partial-number prefix. An absent optional value must remain absent unless the person completes an entry. |
| **Wizard, error layout** | At 320 × 568 and 430 × 932, at normal and 200% text, trigger a field error on each relevant wizard step. | The error and the form remain reachable by scrolling; the footer does not cover the editable fields or trap navigation. Document and scroll-container widths do not overflow. Repeat with focus on an input and check keyboard behavior on a device. |
| **Medicine answer provenance** | Synthetic person B has no diabetes and an SGLT2 answer that has never been given. Open the wizard displaying its default No. Try to finish without touching it. Then explicitly answer No and finish. | The untouched default cannot satisfy `requiredMedicines` or produce reviewed medicine status. An explicit No is accepted and persists as an answer. Check each wizard entry point and a stored explicit answer on reopen. |
| **Quiet hours, minute edge** | Synthetic person C has quiet hours 21:30 to 07:00 and a banner visible at 21:29:59.900 in Asia/Kolkata. Advance across 21:30 without a visibility event. | At the host's first scheduled recheck just after 21:30, the banner is gone and no replacement banner is shown during quiet hours. Measure the actual scheduled delay; do not call an unspecified timer tolerance “exactly”. |
| **Quiet hours, visible again** | Hide the app before quiet hours begin and return during quiet hours. Repeat in America/Los_Angeles, including a DST boundary. | Visibility immediately reevaluates the local wall clock. No stale banner flashes or remains until an old relative timer fires. Local quiet hours remain local across the zone change. |
| **Today inline reminder** | Make a reminder due while Today is open. Navigate away and back before acknowledging it. | Today has one inline reminder in the intended prompt slot and no floating duplicate. Visiting Today does not mark the reminder skipped. Its action and acknowledgment operate on that same waiting reminder. |
| **Active movement exclusion** | Make reminders come due on Session and Walk live, then navigate to Today. Repeat on setup pages and unrelated screens. | Only the two specified active movement routes apply the skip policy. Setup pages and ordinary screens do not inherit it from an overly broad path prefix. Shared reminder routing can be tested without reviewing Walk's changing internals. |
| **Screen sentinels** | Scroll a large title toward the top bar, continue until it is no longer visible, then reverse. Repeat with a subtitle, 200% text, reduced motion and a page opened at a restored scroll offset. | Material appears at the intended title/bar intersection; the compact title follows its separate trigger. Reverse scrolling restores both states correctly. Observers do not retain state from an earlier route. There is one exposed screen heading. |
| **Segmented controls** | At both widths and text sizes, in light and dark, select every option by pointer and keyboard. Inspect the roles and each control's bounding box and computed colors. | Each option is labelled, reaches a target of at least 44 px in the intended dimension and remains reachable without clipping. Calculate text contrast against each actual background. Keyboard operation matches the exposed role and selection is conveyed beyond font weight alone. |
| **Today metric navigation** | Activate Glucose and Blood pressure on Today, then use the rendered Back action and browser Back. | The links open `/track/metric/glucose` and `/track/metric/bloodPressure`, respectively. Navigation retains the expected origin and returns to Today without reopening a stale sheet or unrelated page. Only these shared-link destinations are in scope. |
| **Removed primitives** | Enumerate the 17 deleted module paths, search all source imports and resolve remaining static and dynamic dependencies. Open the affected routes. | No remaining importer references a removed module. Lazy routes resolve without a missing-module error. A repository-wide build failure from another agent is not attributed to these deletions without a relevant import trace. |

## New findings

**No Y3-xx code findings are established.** There is no current source trace or triggering probe result that would justify one. In particular, the implementation claims are not sufficient evidence to declare N04, N05, N07 or B08 fixed, and the inability to run the review is not evidence that those fixes are broken.

## Uncompleted checks

- Read `docs/reimagine/codex-review-screens-2b.md` and reconcile the current fixes against the exact N04, N05 and N07 findings.
- Inspect every named current source file, its callers and relevant tests; obtain current `file:line` evidence.
- Execute targeted Vitest files or the actual in-memory test bodies.
- Exercise slow and refused imports, double taps, Escape, back navigation, stale reads and stale completions.
- Exercise exact weight preservation, unit changes during editing, empty fields and unfinished input across You, Join and Welcome.
- Verify the wizard's answer provenance, submission guards and persisted review status.
- Drive reminder timer edges, visibility changes, route transitions and waiting versus skipped state in IST and another timezone.
- Measure Screen's two observer transitions, control semantics, contrast, touch targets, layout at both requested sizes and 200% text.
- Verify Today's metric links and the import-resolution consequences of the primitive deletions.
- Run the allowed watch-free browser server on port 5242 and stop it afterward. This was not attempted once no command runner was available.

**Verdict: do not ship on the strength of this re-check, verification is incomplete.**
