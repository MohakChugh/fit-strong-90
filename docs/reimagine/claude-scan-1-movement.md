# Claude scan 1 — movement and the session player

**Summary: 11 verified findings — 5 safety, 3 data loss, 1 broken journey, 1 wrong advice, 1 polish.** The worst: after midnight, the player's glucose box fills in for the new day's check-in, so any typed number creates a check-in nobody answered (M-01). Next, a guided session is lost when the device refuses its write, because its progress copy is deleted before the session is stored (M-06, F09 still open on this path). Third, a low found at the restart check resumes the whole session instead of cool-down only (M-02).

Scope: Walk (`src/walk/*`, `src/screens/walk/*`, except the "I need to stop" sheet), the guided and stretch player (`src/pages/SessionPage.tsx`, `src/session/*`, `src/hooks/useGuidedSession.ts`, `src/engine/session.ts`, `src/engine/mobility.ts`), the Workout Log (`src/screens/workout/*`), and the check-in sheet used to start movement (`src/components/checkin/*`).

How each finding was checked:
- **browser**: Chromium 430×932, `Asia/Kolkata`, Playwright clock, a synthetic persona from `scripts/e2e/acceptance/fixtures/personas.mjs` seeded through the real migration, against my own watch-free server on port 5251.
- **in-memory**: vitest in node with the real store over `src/store/fakeIdb.ts`, real screens rendered with `src/test/host.ts`. The host re-renders the whole tree on every pass, so where that could change the outcome I confirmed in the browser too.
- **unit**: the module called directly.
- **trace**: the code path cited by file:line.

Other agents were editing walk, check-in, store and engine files during the scan. Every finding below was re-run against the code as it stood at about 12:05 on 2026-10-08, with the dev server restarted so it served current modules.

---

## Findings

### M-01 — Safety. After midnight, a typed glucose number stands in for the new day's check-in

**Location**
- `src/pages/SessionPage.tsx:366`: every `needsCheckIn` refusal, whatever its reason, goes to the glucose `ReadingScreen`, including "Check in first".
- `src/pages/SessionPage.tsx:62` / `:174`: `reportSymptoms` is bound to the `date` of the page's last render. Nothing re-renders the page during a session, so the first report after midnight goes to yesterday.
- `src/components/checkin/pending.ts:181`: `applyReport` builds `{ urgentSymptoms: false, news: [], sleep: 'gt7', energy: 3 }` when the day has no record. Nobody gave those answers.
- `src/engine/permission.ts:184`, `:217`: any record dated today counts as today's check-in.
- Walk entry point: `src/screens/walk/LiveWalkScreen.tsx:182-188` → `src/walk/low.ts:19-22`.

**Reproduction (browser)**
1. Seed persona P02 (no diabetes) with a check-in for 8 Oct. Set the clock to 8 Oct 23:40 IST.
2. Move → Stretch → Start stretch → Start → Pause.
3. Advance the clock to 9 Oct 00:05 and tap Resume. The screen says: "Check your glucose before you carry on. Starting again after a break needs a recent reading. Check in first, so today's movement fits how you are." It shows a glucose box and the box "My symptoms have gone, and my care plan lets me exercise after a treated low."
4. Type 100 and tap Save this reading. The screen stays. The reading, taken at 00:05 on 9 Oct, is filed in **8 Oct's** check-in.
5. Type 100 and save again. The stretch runs again. IndexedDB now holds a 9 Oct check-in `{news: [], sleep: 'gt7', energy: 3, glucose: 100}` with no emergency answer and no back answers.
6. Open Walk and tap Start walk. It goes straight to `#/walk/live` with no check-in sheet.

**Walk variant (in-memory)**
1. An insulin user (synthetic) starts a walk at 23:40 and taps "I feel low" at 00:05. This creates a 9 Oct record `{news: ['lowSymptoms'], sleep: 'gt7', energy: 3}`.
2. They enter 110 and tick "symptoms gone". Resume is allowed.
3. At 08:00, starting anything asks for a fresh reading. The check-in sheet opens pre-filled from that record, with "None of these" already ticked for "Right now, any of these?" (`form.ts:141,151` turn the missing `emergency` into `[]`; `CheckInSheet.tsx:297`).

**Expected:** restarting after midnight asks the new day's check-in (B03). A person without diabetes is never asked for glucose. A report never becomes a check-in nobody answered. A reading taken on 9 Oct is filed on 9 Oct.

**Actual:** two taps of any number clear movement for the whole new day, and the first one is filed on the wrong day.

**Suggested fix**
- In `Player`, send a `needsCheckIn` refusal to the check-in (`SessionGate`, or the shared `CheckInSheet`). Use `ReadingScreen` only when the release is a glucose reading for someone who takes one.
- In `applyReport`, never create a day from nothing. Attach the report to the record the movement started under, or mark it so `permission` still returns `needsCheckIn`.
- Take the report's date from the moment of the report, not from a render.

### M-02 — Safety. A low found at the restart check resumes the whole session, not the cool-down

**Location:** `src/pages/SessionPage.tsx:310-327`. On the restart screen `flow` is null, so `since = Date.now()`. `lowSince(record, since)` therefore never sees the low entered earlier on the same screen, and the code takes `act.resume()` instead of `coolDownTarget`/`seek`.

**Reproduction (in-memory, real `SessionPage`, runner and store; harness as in `src/pages/session.callers.test.ts`)**
1. Insulin user; check-in at 09:00 with glucose 140. Start, then Pause at 09:05.
2. At 09:40 tap Resume. The screen says "Check your glucose before you carry on".
3. Enter 62. The session holds: "Glucose 62 mg/dL, from 54 to 69 mg/dL, is a low… Measure again in 15 minutes".
4. At 09:56 enter 95 and tick "My symptoms have gone". The runner is `running` at the paused step with `coolDownFrom` undefined: the full session carries on.

Control: the same 62 → 95 sequence through "I feel low" sets `coolDownFrom` (cool-down only).

**Expected:** after any in-session low, cool-down only once at 90 or above (`docs/superpowers/specs/2026-10-05-guided-training-design.md:456`; `docs/research/diabetes-hypertension-exercise.md:237`, `:292`).

**Suggested fix:** record when the restart screen opened (or when the pause began) and use that as `since`. Or treat any reading under 70 since the session started as the session's low.

### M-03 — Safety. Earphone or lock-screen "previous track" restarts a finished session, even under a hold

**Location**
- `src/hooks/useGuidedSession.ts:291`: `previous` dispatches without asking `mayResume`.
- `:307`: the handler stays registered after the session is done.
- `src/session/runner.ts:209`: `status: state.status === 'done' ? 'running' : …`.

**Reproduction (browser; the page's `mediaSession` handler called as the OS calls it)**
1. P04 (insulin), with a fresh reading. Start a stretch.
2. After 3 minutes tap "I feel low". Enter 85 and tick "symptoms gone". This is a hold: under the 90 mg/dL start level.
3. Tap End session.
4. Send `previoustrack`. The runner goes from done to `running` at step 8 (Calm Breathing) and reaches "Session complete" 90 s later. All the while the screen still says "Check your glucose before you carry on".

With the voice on, `useGuidedSession.ts:179-183` loads and plays that step's cues. With no hold at all (End session → Finish now), the same press brings the finished session back to the player (in-memory).

**Expected:** every restart, including from earphones and the lock screen, asks the restart question (B03), and a finished session stays finished.

**Suggested fix:** make `previous` never leave `done`. Have `act.previous` ask `mayResume` unless the run is running. Clear the media handlers once the run is done.

### M-04 — Safety. Workout Log: the 30-minute reading rule is never asked again while the screen stays open

**Location**
- `src/screens/workout/gate.ts:51-55`: the `live` stage asks `resumePermission`, with no freshness check.
- `src/screens/workout/model.ts:527`: every logged set sets `live: true`.
- `live` is cleared only by a remount, a restore or a finish (`useWorkout.ts:49`, `model.ts:322`, `:623`).
- `TodayWorkoutScreen.tsx:43` only refreshes `now`. Nothing ends the sitting when the page is hidden or after a long gap.

**Reproduction (unit; real model and gate)**
1. Insulin user, glucose 140 at 09:55.
2. Log a set at 10:00. The workout is now `live`.
3. `setGate(state, clinical, 13:00)` returns `log` with no reasons.
4. The same state with `live: false`, which is what a reload gives, returns `checkIn`: "With insulin or a sulfonylurea, check your glucose within 30 minutes of starting. Your last reading was 3 hours ago."

**Expected:** a real break makes the next set a restart (B03, D29(6)). Examples are a phone locked over lunch with the Workout screen open, or a set logged at 23:50 and the next at 01:00. The walk treats a hidden page this way.

**Suggested fix:** end the sitting when the page is hidden for more than a few minutes, when the gap since the last set exceeds its rest plus a margin, and at midnight.

### M-05 — Safety. A walk cannot record a low that needed someone else's help

**Location**
- `src/screens/walk/guidance.tsx:77-149`: `LowFollowUp` offers only a reading and "symptoms gone".
- `src/walk/low.ts:25-27`.
- Compare the player: `src/pages/SessionPage.tsx:735-740` asks "Someone else had to help me treat this low", and `:305` maps it to news `lowSevere`.
- The walk offers its check-in sheet (which has "Needed help") only for `action === 'checkIn'` (`LiveWalkScreen.tsx:225`). It is not offered while the low reading is asked (`:243`).

**Reproduction (trace; path walked in the browser)**
1. On a walk, tap I feel low.
2. Enter a normal reading and tick "symptoms gone".
3. Resume is offered and the walk records. Nowhere along the way can the person say that someone helped. So the rule `lowNeededHelp` (`readiness.ts:352`: no exercise today, contact your care team today) can never apply to a walk.

**Expected:** the player's question, mapped the same way.

**Suggested fix:** add the checkbox to `LowFollowUp`, and add `news: ['lowSevere']` in `lowReading` when it is ticked.

### M-06 — Data loss. A refused write loses the session: its progress copy is deleted before the session is stored (F09 still open)

**Location**
- `src/pages/SessionPage.tsx:91-95`: clears progress on `result.ok`.
- `:277-283` and `:892-893`: the same record is saved twice the moment the run is done.
- `src/store/useStore.ts:295-296`: the second save plans to "no change" and resolves `ok` at once, while the first is still on its way. The first can then fail.
- `isSessionSaved` (`useStore.ts:1342`) exists for exactly this check and is not used here.

**Reproduction (browser)**
1. P02, stretch. Start.
2. After 4 minutes, make `sessions` writes fail with `QuotaExceededError` (acceptance `faultInit`).
3. End session → Finish now. The summary appears. `localStorage['fit-strong-90-stretch']` is already gone. Exactly one write was attempted, and it was refused. IndexedDB holds 0 sessions.
4. Save and finish: "This device couldn't save just now. Your session is still here — try again."
5. Reload. No session, and no progress left to bank.

**Expected:** progress is kept until the session is durably stored.

**Suggested fix:** clear progress only when `isSessionSaved(sessionId)`. Or make the store resolve a no-op only after the earlier mutations have settled.

### M-07 — Data loss (lower). "Continue without saving": the summaries report a save that did not happen and delete the only copy

**Location**
- Walk: `src/screens/walk/WalkSummary.tsx:78-82` with `src/walk/record.ts:239-245`. `storedIds` reads the on-screen view, which in this mode already holds the first attempt's records, so the retry finds "nothing missing".
- Player: `SessionPage.tsx:94` with `useStore.ts:295-296`.

**Reproduction (in-memory; real `WalkSummary` and store, IndexedDB open failing)**
1. Save walk: "This walk did not save… It is kept here, so you can try again."
2. Try again: "Saved on this device". The `sessionStorage` draft is removed.
3. Reload: nothing.

The guided summary fails the same way. Its progress copy is deleted as soon as it appears, then Save and finish shows "Saved" and exits. After a reload, nothing remains.

The launch screen did warn that "nothing you enter will be kept after you close the app". These screens then say the opposite.

**Suggested fix:** decide "saved" from durable state. In this mode, say "kept for now, not saved", and never delete the draft or the progress.

### M-08 — Data loss (lower). Banking an earlier day's unfinished session ignores a refused write; Start then overwrites it

**Location:** `src/pages/SessionPage.tsx:98-103` (`void update(…)`, so the result is ignored) and `src/hooks/useGuidedSession.ts:221-224` (the first save after Start overwrites the same key).

**Reproduction (in-memory)**
1. Yesterday's paused hour (12 steps, 25 minutes) is in `fit-strong-90-guided`, and session writes are refused.
2. Open the session and tap Start.
3. The saved progress is now today's run. No banked session exists, and yesterday's work is gone.

**Suggested fix:** await the bank. If it fails, keep the old progress under its own key and say so before Start.

### M-09 — Broken journey. "I feel low", then "End session", never reaches the summary

**Location:** `src/pages/SessionPage.tsx:359` (`end` clears the flow) and `:364-379`. The low's hold (`needsCheckIn`) sends a finished run to `ReadingScreen` kind `restart`.

**Reproduction (browser)**
1. P04, stretch. Start, then tap I feel low.
2. Tap End session. The screen says "Check your glucose before you carry on. Starting again after a break needs a recent reading", with "My symptoms have gone…".
3. End session again changes nothing visible. The record is stored as `skipped`. The back-pain question and Save and finish never appear, unless a reading clears the hold.

**Expected:** the summary, with the low guidance, or a "session ended: treat the low" screen. Never a prompt to carry on.

**Suggested fix:** when `state.status === 'done'`, render the summary (with the low guidance) before any hold screen.

### M-10 — Wrong advice (low). The Stretch preview is built from stored check-ins only

**Location:** `src/screens/move/StretchScreen.tsx:23`, `:27` call `stretchPlanFor(useGuided().data…)`, which holds the raw stored check-ins. The player builds from the effective ones (`SessionPage.tsx:74`, `:119`).

**Reproduction (unit)**
1. A synthetic sciatica and metformin profile with a stored morning check-in.
2. A later "new foot sore" save is refused by the device.
3. The preview lists "March in Place" first; the player runs "90/90 Breathing" instead.

**Suggested fix:** pass `{ ...data, checkIns }` from `useGuided()`.

### M-11 — Polish (accessibility). After "I feel low", focus falls to `<body>`, and the player's new screen announces nothing

**Location**
- `src/pages/SessionPage.tsx:294-299`.
- `ReadingScreen` (`:713-748`) has no live region or role, and nothing moves focus to it.
- Walk: the tapped button is removed (`LiveWalkScreen.tsx:303-308`). The walk's hold sits in an `aria-live` region, so it is announced, but focus is still lost.

**Reproduction (browser):** after tapping I feel low, `document.activeElement` is `BODY` in both the player and the walk.

**Suggested fix:** move focus to the new heading (`tabIndex={-1}`), or present the capture as `role="alertdialog"`.

---

## Checked and fine

- **Walk controller**
  - The live question is asked every second and the moment the store or a pending answer changes.
  - The restart question is asked on Resume, on coming back from hidden, and on restoring after a reload. A restored walk is never running.
  - Time, steps and GPS runs are split at midnight, each fix and step going to its own day.
  - Gaps are stamped and never counted unless added. Stale walks finish at the moment last seen. Refused draft writes say so.
  - Wake-lock ownership is correct, and an old history entry cannot start a walk twice.
- **Walk "I feel low" (browser)**: it holds until a later reading, and resumes only through the restart question.
- **Walk save**: one atomic batch, retries leave out ids already stored, and a refused write stays honest in normal mode.
- **Session player**
  - The arrival, Start and live gates work. Earphone Play asks the restart question.
  - Refused steps are passed in both directions. The glucose checkpoint waits for a reading. "I feel low" with a low goes to cool-down only.
  - Progress survives a reload and is rehydrated paused.
  - Units are right: holds and carries never count as weight lifted, and a guided hold shows no count.
- **Workout Log**
  - The start, restart and record gates read the effective check-ins.
  - kg/lb conversion happens in one place, and seconds and reps are handled everywhere.
  - The rest timer runs from its deadline. A finish is the last word, and a failed finish reopens the workout.
- **Check-in sheet**
  - The strictest of the stored, saved and optimistic records decides.
  - Start is asked again at the tap, and an emergency is saved the moment it is ticked.
  - The sheet makes the page behind it inert, so the walk's fixed bar cannot be tapped through it.
- **Effective check-ins**: Walk, the player, the Workout Log and `useStartMovement` all read the effective records. Only the Stretch preview does not (M-10).

## Not checked

- The "I need to stop" sheet (`StopSheet.tsx`, `src/walk/stop.ts`): excluded, being rewritten during the scan.
- On-device iOS behaviour:
  - whether `sessionStorage` (the unsaved walk) survives the app being killed;
  - Screen Wake Lock, motion permission, background GPS;
  - real earphone and lock-screen routing (I called the registered `mediaSession` handler directly).
- The 320×568 layout, dark mode, and screen-reader output beyond where focus lands.
- Clinical content of `mobility.ts` and the readiness thresholds, beyond what these journeys exercised.
- Several tabs open at once.
- How Today and Track present the fabricated check-in from M-01, beyond letting a walk start.
