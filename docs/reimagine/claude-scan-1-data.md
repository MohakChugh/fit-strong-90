# Claude scan 1: data, You, Welcome and reminders

**Summary:** 11 verified findings: 1 safety, 3 data loss, 2 wrong data, 2 broken journey, 3 polish. Five of the seven claimed fixes are confirmed. The wizard-footer claim is partial. The Welcome half of F07 has regressed (D-04). Cross-tab store commits, atomic restores, migration fidelity and `.ics` structure all hold up.

The worst findings:

- **D-01.** A calendar file the app made keeps reminding the person to drink, or to walk, after they record a fluid limit or an open foot wound. At that point the app says "the app will never remind you".
- **D-02.** Merging a backup from another device replaces or drops that day's check-in readings, because their ids come from the date alone. A morning low disappeared from the glucose history in the reproduction.
- **D-04.** On iPhone in Safari, a refused save of the Welcome health questions throws away every answer.

## Scope, method and code state

- **Reviewed:** 8 October 2026, 11:15 to 12:25 IST, against the working tree on top of `f21db7a`.
- **Read in full:** `src/store/*`, `src/health/{observation,aggregate,status,cadence}.ts`, `src/services/storage.ts`, `src/hooks/useLocalStorage.ts`, `src/screens/you/*`, `src/screens/welcome/*`, `src/reminders/*` and `src/components/profile/*`. I also read the touchpoints in `App.tsx`, `routes.tsx`, `TodayScreen.tsx` and `walk/persist.ts`.
- **Files that changed while I worked:** `useStore.ts` and `snapshot.ts` (`hold`, `keepOrder`), `transfer.ts`, `App.tsx` (record mark), `ProfileWizard.tsx`, `wizardSteps.ts`, `controls.tsx`, `VoiceSettingsCard.tsx` and `ReminderBanner.tsx`. After the last of these changes, every finding below was run again: the unit probes at 12:19 and the browser probes on a restarted server at 12:10 and 12:20. Line numbers are as of 12:20.

How the findings were reproduced:

- **Unit probes.** Vitest in node, against the real store with the repository's fake IndexedDB. "Two copies" means two fresh module instances of the store sharing one fake database, which models two tabs (`vi.resetModules`).
- **Browser probes.** `playwright-core` with headless Chromium against my own `vite --config scripts/e2e/vite.nowatch.config.mjs --port 5252` server, using `timezoneId: Asia/Kolkata`. The viewports were 430×932 and 320×568. Personas were seeded once from `scripts/e2e/acceptance/fixtures/personas.mjs`.
- **Simulated conditions.** A quota failure was simulated by an init script that makes `IDBObjectStore.prototype.put` throw `QuotaExceededError` once a flag is set. iOS 200% text was emulated the way `src/lib/textSize.ts` applies it on iOS: a root font size of 32 px.
- **Clean-up.** The scratch scripts lived in `/tmp/claude-scan-data` and have been deleted.

## Findings

### D-01. Calendar reminders keep firing after a fluid limit or foot wound is recorded, and the app says it will never remind

**Severity:** safety.

**Location:**
- `src/reminders/ics.ts:186`: `RRULE:FREQ=DAILY` with no end.
- `src/screens/you/CalendarSheet.tsx:55-59`: the export records nothing.
- `src/types/habits.ts`: no field records that a calendar file was made.
- `src/screens/you/HabitSheets.tsx:164`: "Then the app will never remind you to drink."
- `src/reminders/water.ts:55` and `src/reminders/advice.ts:71-72`: the off reasons, which do not mention Calendar.

**Reproduction (browser):**
1. Seed persona P02 with water reminders on, 09:00 to 21:00 every 2 hours, and no fluid limit.
2. Go to You → Habits & reminders → Add to Calendar, and download the file. It holds 6 "Glass of water" events, each `RRULE:FREQ=DAILY`, with no `UNTIL` or `COUNT`.
3. Open the Water sheet, choose "Yes, I have a fluid limit", and save.

The sheet says "Then the app will never remind you to drink." The Habits row says "Off, because your care team has asked you to limit fluids." Neither Habits nor Profile & health mentions the Calendar events. The same happens for walk and stand prompts after the health answers record an open foot wound or active Charcot foot: in-app prompts stop, and nothing else changes.

**Expected:** When a recorded answer stops a habit that went into a calendar file, the person is told plainly that Calendar will keep reminding them, and how to delete those events.

**Actual:** The in-app reminders stop. The Calendar alerts the app generated continue every day, against a clinician's fluid limit or a foot-wound precaution. The only warning was shown once, at export time ("To change them later, delete that calendar…", `CalendarSheet.tsx:85`). iOS Calendar's own alerting was not run on a device; it follows from the file's endless daily rule.

**Suggested fix:**
1. Record each export: when it was made, and which habits and times it held.
2. While a recorded answer blocks any exported habit, show a persistent notice on Habits and on the blocked habit's sheet: "Your Calendar still has N water reminders from this app. Delete that calendar." Say it again at the moment the answer is saved.
3. Consider giving exports an `UNTIL` date (for example 90 days), so a forgotten file eventually stops.

### D-02. Merging a backup from another device replaces or drops that day's check-in readings

**Severity:** data loss. A hypo can vanish from the glucose series.

**Location:**
- `src/store/project.ts:63-64` and `:204-212`: check-in reading ids are `checkIn:<date>[#n]:<kind>`, allocated per date.
- `src/store/transfer.ts:520-534`: the merge treats an equal id as the same record, keeps whichever copy was "stated later", and counts a conflict only for equal instants.
- `src/screens/you/RestoreFlow.tsx:208-209`: the preview says "Every reading in it is already on this device."

**Reproduction (unit, two separate databases):**
1. Device B saves a 7 October check-in with glucose 160 mg/dL measured at 18:30 and BP 150/95, and is exported.
2. Device A saves its own 7 October check-in with glucose 62 mg/dL measured at 08:30 and BP 124/78.
3. On A, merge B's file with the default policy (keep this device's copy).

The preview reports `alreadyHere: 3` and 2 conflicts, which are the BP halves. The merge report shows `replacedObservations: 1`. A's `checkIn:2026-10-07:glucose` is now 160 at 18:30, and the 62 at 08:30 is gone from the series. A's check-in summary still says 62. With the times reversed (A's reading is later), B's 160 is silently dropped and the report says 0 observations imported. BP takes the device's or the file's pair, depending on the conflict choice, and the other pair is lost either way.

**Expected:** Two devices' check-ins on the same day are different measurements. A merge keeps both, as F10 now does for rechecks on one device.

**Actual:** One reading from each colliding pair is lost. The preview tells the person every reading is already here.

**When this happens:** Any merge between two devices that each recorded a check-in on the same day. That includes Safari and the Home Screen app, which keep separate storage on iOS (D16), and a new phone set up on the day the backup was made.

**Suggested fix:**
1. Give check-in readings ids that cannot collide across devices, for example a random event id, keeping the `checkIn:<date>` context for linking.
2. In `planMerge`, treat a same-id observation whose `at` differs, or whose value differs with no `editedAt`, as a different event: keep both, and re-id the incoming one.
3. Count such collisions in the preview instead of calling them "already here".

### D-03. Two open copies: saving the profile wizard reverts profile changes the other copy saved

**Severity:** data loss. It includes safety-relevant answers.

**Location:**
- `src/screens/you/write.ts:60-71` (`profile: result.profile`).
- The same pattern in `src/screens/move/plan.ts:259` and `src/screens/welcome/assemble.ts:46`.
- `src/store/useStore.ts:1322-1329`: the updater is re-run against fresh storage, but its closure carries the wizard's draft taken when the wizard opened.

**Reproduction (unit, two store copies on one database):**
1. A profile is stored. Copy A opens a wizard draft from it.
2. Copy B saves the health questions with "current wound or active Charcot" and a fluid limit of Yes. The save succeeds.
3. Copy A saves a "Your body" edit (pain areas only) from its draft. The save succeeds.

The stored profile now says `footStatus: healthy` and `fluidRestriction: false`. In a second run, B's food change (vegan, leave out paneer) was reverted the same way by A's body edit. Both saves report success.

**Expected:** An edit of one wizard section changes only that section's fields, on top of the latest stored profile. Every other field, above all the health answers, stays as it was.

**Actual:** Last writer wins on the whole profile. With the foot wound reverted, walk and stand prompts and weight-bearing suggestions come back. With the fluid limit reverted, water reminders can be offered again.

**When this happens:** Needs two open copies that share storage, for example two desktop or Android tabs. An installed iPhone PWA has one window.

**Suggested fix:**
1. Have the wizard return a patch of the fields its shown steps own, and apply it to `previous.profile` inside the updater.
2. Alternatively, compare `previous.profile` with the profile the wizard opened with, and refuse or merge when it has changed.
3. Do the same for `withJoined` and `withAnswers`.

### D-04. On iPhone in Safari, a refused save of the Welcome health questions throws every answer away

**Severity:** data loss of entered answers. This is the F07 failure, back in Welcome.

**Location:**
- `src/screens/welcome/assemble.ts:88`: in Safari on iOS, health is the last step.
- `src/screens/welcome/HealthStep.tsx:33-35`: the answers and `onboardingComplete` go in one `update`.
- `src/store/useStore.ts:306-307`: the view is published before the write is stored.
- `src/App.tsx:108` and `src/routes.tsx:58-70`: the whole route tree switches on the view's `onboardingComplete`.

**Reproduction (browser, iPhone Safari user agent, so the context is `iosBrowser`):**
1. Start at Welcome and choose "Stretch comfortably", then "Continue in Safari for now".
2. Answer the questions: Lower back, then SGLT2 "No", then tick the acknowledgement.
3. Make writes fail, then tap "Save my answers".

The routes go `#/welcome/health` → `#/today` → `#/welcome`. Only the global "That did not save" banner shows. Going back to the questions shows the defaults again, with "None" selected instead of "Lower back".

**Expected:** As F07 required, the wizard stays mounted, busy and holding every answer until the store acknowledges, and shows the refusal inside it.

**Actual:** The optimistic `onboardingComplete: true` unmounts the Welcome tree before the write lands. The rollback then routes to the first Welcome step with an empty wizard. HealthStep's own `setProblem` (`:41`) never renders.

**Suggested fix:** Pick one:
- Gate `AppRoutes` on the committed value of `onboardingComplete`, for example a `durable` flag exposed by the store.
- Write the finishing flag with the new `hold: true` (`useStore.ts:192`), so it is not shown until stored.
- Write the answers first and set `onboardingComplete` in a second write, only after the first succeeds.

### D-05. "Delete everything" leaves the walk in progress; after setup the old walk is offered and saved into the new record

**Severity:** wrong data and privacy.

**Location:**
- `src/services/storage.ts:57-61`: `resetData` sweeps only `localStorage` keys starting with `fit-strong-90`.
- `src/walk/persist.ts:17` and `:193-195`: the draft lives in `sessionStorage` under `fit-strong-walk`.
- `src/store/useStore.ts:1489-1490`: a same-tab reload keeps `sessionStorage`.
- `src/screens/walk/WalkSetup.tsx:59` and `:146`.

**Reproduction (browser):**
1. Seed P02 plus a finished, unsaved walk draft: 20 minutes, back pain 6.
2. Go to You → Data & offline → Delete everything, and confirm. IndexedDB is empty afterwards.
3. The draft is still in `sessionStorage`. Complete Welcome (Explore first → Start).
4. Open Move → Walk.

The screen shows "A walk is waiting to be saved. Started 11:45 AM" with a "Review and save" button. Saving it writes `walkDuration` 20, `movementMinutes` 20 and `backPain` 6 (`walk:walk-before-delete`) into the new record.

**Expected:** "Delete everything" leaves nothing behind (spec §10.2, the `resetData` comment). Nothing from before the deletion can come back.

**Actual:** A walk from before the deletion survives, with timing, pain answers and any meal data, and can be saved into the new record.

**Suggested fix:**
1. In the clear-all `after`, also remove `fit-strong-walk` and `fit-strong-walk-last` from `sessionStorage`, best effort.
2. Better, give every app key one prefix and sweep both storages.
3. Consider the same sweep on a replace-import.

### D-06. Merge silently brings back readings deleted since the backup was made

**Severity:** wrong data.

**Location:** `src/store/transfer.ts:523-524`. An id not on the device is always added, and nothing records that a reading was deleted.

**Reproduction (unit):**
1. Add a glucose of 600 mg/dL, a typo.
2. Export the record.
3. Delete the reading.
4. Merge the export.

The preview shows 0 conflicts and 0 already here. After the merge the 600 is back.

**Expected:** A reading the person deleted stays deleted after merging an older backup, or the preview names it ("1 reading you deleted would come back").

**Actual:** The deletion is undone, with nothing said. The merge footnote says "Where a record has been changed, the newer copy is kept", which suggests later changes are respected.

**Suggested fix:**
1. Keep tombstones (id and deletion time) for removed observations and sessions, include them in exports, and honour them in `planMerge`.
2. At minimum, count and name records that would return.

### D-07. A backup with health answers and settings but no readings is called "empty" and cannot be restored

**Severity:** broken journey.

**Location:**
- `src/store/transfer.ts:746`: `isEmpty` ignores `settings` and `profile`.
- `src/screens/you/RestoreFlow.tsx:222-223`: every action is hidden when the backup is "empty".
- `src/screens/you/DataScreen.tsx:89`: "The Home Screen app starts empty, so back up here first and restore the file there."

**Reproduction (browser):**
1. Seed P02 (profile, health answers, water and sitting reminders, no readings). The Data screen says "Your record: Nothing recorded yet".
2. Back up. The file is 1029 bytes.
3. Open a fresh context at Welcome → Restore from a backup, and choose that file.

The sheet says "No records… It includes a profile and health answers. It includes settings and reminders." and then "This backup is empty, so restoring it would add nothing." Its only button is Close.

**Expected:** The file restores: profile, health answers, reminders and settings.

**Actual:** Someone who answered the questions in Safari and then follows the app's own instruction to move to the Home Screen app cannot bring their answers. They have to enter every health answer again.

**Suggested fix:**
1. Count `hasProfile` and `hasSettings` in `isEmpty`.
2. Reserve "empty" for a file that holds nothing at all.
3. Allow Restore for a file that holds only a profile and settings.

### D-08. Malformed settings in a backup pass the preview, are restored, and break Today and Habits on every launch

**Severity:** broken journey. It needs a malformed file.

**Location:**
- `src/store/transfer.ts:411-412` and `:432-433`: `settings` and `profile` are checked only as objects, and settings are "kept as the file has them".
- `src/store/useStore.ts:141`: defaults fill top-level keys only.
- `src/health/status.ts:76`: `(periods ?? []).filter` with a non-list `statusPeriods`.
- `src/screens/you/HabitsScreen.tsx:53` and `src/screens/today/model.ts:130`.

**Reproduction (browser):**
1. In You → Data → Restore, choose a file whose `settings.statusPeriods` is `"flare"`, with one valid glucose reading.
2. Replace everything.

The preview reports nothing unreadable, and the restore succeeds. Afterwards `/today` and `/you/habits` show "This screen didn't load. Usually a weak connection or an app update." This persists across reloads, and Today is the landing screen. Move, Track and You still work.

**Expected:** As F22 asked: validate every keyed document before anything is written, and refuse or name wrong-typed fields. Never store them.

**Actual:** The file is accepted. The landing screen then fails for good, with an error that blames the connection.

**Suggested fix:**
1. Add an `isSettings` validator that checks the type of every known field (`statusPeriods` an array, `habits` an object, times as HH:MM, `theme` from the set) and drops or rejects bad fields with a preview count.
2. Do the same for nested `profile` fields before `createDefaultProfile`.

### D-09. Welcome's Restore and Start switch to Today before the write lands; a refused write bounces back and the restore sheet's handling never runs

**Severity:** polish. This is D-04's root cause where no answers are lost.

**Location:**
- `src/store/useStore.ts:1465-1474`: `importRecord` publishes optimistically.
- `src/screens/you/RestoreFlow.tsx:89-107`.
- `src/screens/welcome/KeepStep.tsx:39-40`.
- `src/App.tsx:108`.

**Reproduction (browser):**
1. Start on first run (P07) at Welcome → Restore from a backup, and choose a valid backup with `onboardingComplete: true`.
2. Make writes fail, then tap Restore.

The routes go `#/welcome` → `#/today` → `#/welcome`, and the restore sheet is gone. Only the global banner "That did not save…" shows. RestoreFlow's own "Nothing was changed… / Choose another file" never shows. On success, "Restored. This device now holds what the backup held." is never seen either. KeepStep's Start behaves the same on non-iOS contexts.

**Expected:** The restore result is shown in the sheet, and a refusal keeps the person in the restore flow.

**Actual:** The person is bounced between screens, and the specific message is lost.

**Suggested fix:** As D-04. Do not let an uncommitted `onboardingComplete` drive routing. For example, hold the import until it is stored, or gate on the committed flag.

### D-10. At 200% text on a 320-px screen, primary controls overflow the screen

**Severity:** polish, accessibility.

**Location:**
- `src/components/profile/ProfileWizard.tsx:271` and `:276/:280`: the footer buttons. `src/components/ui/button.tsx:9` gives them `shrink-0 whitespace-nowrap`.
- `src/components/profile/VoiceSettingsCard.tsx:68-83`.
- `src/screens/you/controls.tsx:197-198` (TimeField).

**Reproduction (browser, 320×568, root font 32 px):**
- **You → Profile → Edit about you:** the cover scrolls sideways to 397 px wide. The Save button sits at x 241 to 397, so only "✓ S" is visible.
- **Welcome → Stretch comfortably:** the page is 456 px wide, and "Continue" reads "Con".
- **You → Voice & demos:** the voice options run to 367 px, and the Preview buttons are cut in half.
- **Habits → Sitting breaks:** the time inputs run to 342 px and cover their labels, which read "rom" and "ntil".

At 150% text (24 px root), and at 430 px, the wizard footer fits.

**Expected:** No horizontal overflow (BUILD-BRIEF), with text readable at 200%.

**Actual:** The primary actions and labels are clipped. The wizard's form itself stays reachable; see the claim check.

**Suggested fix:**
1. Let the footer buttons wrap or stack (`flex-wrap`, `min-w-0`, or a column below about 360 px at large text).
2. Let the voice rows and TimeField rows wrap the control under the label at large sizes.

### D-11. A reminder window that crosses midnight is described as "00:00 to 23:00"

**Severity:** polish.

**Location:**
- `src/reminders/schedule.ts:141`: `dailyTimes` sorts by minute of day.
- `src/screens/you/summaries.ts:301` (`habitLine`) and `src/screens/you/CalendarSheet.tsx:29` read the first and last items.

**Reproduction (unit):** Set sitting breaks from 22:00 to 02:00, every 60 minutes. The setup sheet correctly says "from 23:00 to 02:00" (`windowTimes` order). The Habits row says "Every hour, 00:00 to 23:00", and the Calendar sheet would say "4 a day, 12:00 AM to 11:00 PM".

**Expected:** The same window as the sheet: 23:00 to 02:00.

**Actual:** The row describes an all-day window that was never set.

**Suggested fix:** Describe the window from the stored `from` and `to`, or from `windowTimes` order, not from the minute-sorted list.

## Claim checks

| Claim | Verdict | Evidence |
|---|---|---|
| **N04.** Restore stays locked while writing, and a stale import completion cannot land. | **CONFIRMED** in You. Welcome unmounts the flow instead; see D-09. | `RestoreFlow.tsx:54-61`, `:84-90`, `:113-117` and `restore.ts:6-8`. In the browser, during a 100,000-reading replace, tapping Close and pressing Escape left "Restoring…" in place, and the trigger could not open a second file chooser. It ended on "Restored. This device now holds what the backup held." |
| **N05.** Switching kg and lb never changes the stored weight unless the person types. | **CONFIRMED** | `ProfileWizard.tsx:92-99`, `:114`, `:126` and `wizardSteps.ts:119-135`. In the browser, a stored 80.04 kg stayed exactly 80.04 after kg→lb with Save, and after three kg↔lb round trips. Typed values converted consistently: 180 lb was saved as 81.6 kg, and 180.3 lb as 81.8 kg. `useMetric` followed the chosen unit. |
| The wizard footer is sticky and never hides the form at 320×568 or 200% text. | **PARTIAL** | The footer is `position: sticky`. At 320×568 (16 and 32 px roots) and at 430×932 (32 px root), scrolled to the bottom, the last control sat above the footer, so the form is reachable. But at 320 px with 200% text the footer's own primary button runs off the screen and makes the cover scroll sideways (D-10). |
| **N07.** A banner on screen leaves exactly when quiet hours begin. | **CONFIRMED** | `ReminderHost.tsx:62-78`, `:84-87`. Under a fake clock, a sitting reminder appeared at 10:59:00.4 and stayed while hovered at 10:59:50. It was gone at 11:00:00.1, with quiet hours from 11:00. Today's inline copy behaved the same. |
| No floating reminder banner on /today, and Today shows it inline. | **CONFIRMED** | `place.ts:25` and `TodayScreen.tsx:329-334`. With the reminder due, /today had 0 floating banners and 1 inline banner. /move, /guide, /track and /you/habits each had 1 floating banner. |
| Only /session and /walk/live skip due reminders. | **CONFIRMED** (/walk/live by code) | `place.ts:10`, `:19-22` and `ReminderHost.tsx:95`. A reminder that came due on /session showed nothing. /walk/live redirects to /walk without a walk, so that path was checked by code only. |
| Without diabetes, the untouched SGLT2 answer never counts as answered. | **CONFIRMED** | `wizardSteps.ts:94-102`, `engine/health.ts:65-68` and `summaries.ts:105`, `:221`. In the browser, at the first-run health step all three SGLT2 chips were unchecked and Continue was disabled; answering "No" enabled it. A stored non-diabetic profile without `medicinesReviewed` shows "One medicine question to answer" and "SGLT2 inhibitor: Not answered yet". |

Earlier data findings, re-checked as part of the above:

- **F01, atomic replace.** Holds. A refused replace changed nothing, and a reload in the middle of a 100,000-reading replace left the old record intact.
- **F02 and F04, two tabs.** Hold in real Chromium tabs.
- **F07 (data), file marker.** Holds: the import writes this build's `SCHEMA_VERSION`.
- **F10, rechecks.** Holds within one device. D-02 is its cross-device form.
- **F12, content state.** Holds: it is exported and restored.
- **F22, validation.** Holds for records. It is still open for settings and profile documents (D-08).
- **F07 (screens), draft kept on a refused save.** Holds in You. It has regressed in Welcome on iOS Safari (D-04).

## Checked and fine

- **Two real Chromium tabs on one database.**
  - Ten interleaved water taps (five per tab) gave 2,500 ml in both tabs.
  - Simultaneous `setSettings` calls (rest seconds in one tab, theme in the other) both landed in both tabs.
- **Restores.**
  - A gzip backup of 100,000 readings (17 MB of JSON, 1.3 MB compressed) previewed in 0.35 s and restored by Replace in about 28 s in headless Chromium. All 100,000 rows were stored.
  - A reload mid-write left the previous record unchanged.
  - A merge of 40,000 readings into 40,000 others took 0.36 s to plan. Insertion is quadratic, but not a problem at realistic sizes.
- **Decoding unusual files.** A UTF-8 BOM decodes. A truncated gzip, a double gzip and UTF-16 JSON are refused with "That file could not be read…" and nothing is touched.
- **Old-app backups.** Merging a v4 backup from the old app into the device that was migrated from it changed nothing: 0 conflicts, 0 rejected, and identical ids.
- **Calendar files.** For a cross-midnight schedule with long notes, no line was over 75 octets, there were no bare LFs, and the file ended in CRLF. `DTSTAMP` is UTC, `DTSTART` is floating, and each VALARM has DISPLAY, a DESCRIPTION and `TRIGGER:PT0S`.
- **DST.** A reminder runner in `America/New_York` across the spring-forward change fired at 03:00, 03:30 and 04:00. Times in the skipped hour did not fire, which is acceptable. Asia/Kolkata has no DST.
- **Weight units in the wizard.** No drift from untouched toggles. Typed values convert consistently (see N05).
- **Clear-all while storage cannot be reached.** In the store, `clearAll` in memory mode still sweeps `localStorage` and empties the screen while IndexedDB keeps the record (`useStore.ts:363`). During this review `App.tsx` started hiding "Continue without saving" when a record is known (`App.tsx:15-21`, `:47`), so the UI can no longer reach it. It is not reported.

## Not checked

- **Real-device behaviour.** Not run on a device:
  - iOS Calendar actually importing and alerting from the `.ics` file.
  - The share sheet with files.
  - Safari storage eviction.
  - `-apple-system-body` text sizes, which I emulated with the root font size.
  - The keyboard covering the sticky wizard footer.
- **Other screens.** Not reviewed in depth: `cadence.ts` and `recommend.ts`, and the Walk, Track, Today and session screens beyond the walk-draft and reminder touchpoints.
- **Backups near the 128 MiB import cap.** The largest tested was 17 MB. Nor did I check whether a lifetime export can exceed the cap.
- **Code still being changed.** I traced but did not exercise the `keepOrder` revision restamping that landed at 11:57.
