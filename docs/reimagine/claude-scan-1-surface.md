# Claude scan 1 — surface (shell, Today, Move, Guide and content)

**Summary.** 24 open findings: 1 safety (how it looks), 1 wrong advice, 5 broken journey, 8 accessibility, 9 polish. Two more were fixed by other agents while the scan ran, and were re-measured as fixed. The worst: after one failed save, at large text on a 320 × 568 screen, the storage banner covers the whole app, Back included. During an emergency the Stretch screen still leads with "Start stretch". At 200 % text on a 320-px screen, list rows split words into fragments ("Vit / ami / n B1 / 2").

Scope, method and caveats:
- **Code:** the working tree of `fix/voice-start-and-audit`, 8 October 2026, 11:00–12:50 IST. Other agents were editing files in this scope during the scan: `index.css`, `controls.tsx`, `Sheet.tsx`, `main.tsx`, `App.tsx`, `TodayScreen.tsx`, `StretchScreen.tsx`, `src/content/*`. Every open finding below was re-checked against the tree as it stood at about 12:45, on a freshly restarted server.
- **Browser:** Chromium headless shell through `scripts/e2e/acceptance/lib/env.mjs`, at 430 × 932 and 320 × 568 (deviceScaleFactor 3, isMobile, hasTouch), light and dark, both reduced-motion settings, `Asia/Kolkata`, clock fixed at Thu 8 Oct 2026 09:00 IST. Personas P01–P07 come from `fixtures/personas.mjs`, plus two synthetic patches of P02: hypertension only, and a water habit.
- **Safe areas:** emulated with CDP `Emulation.setSafeAreaInsetsOverride`, at top 47 / bottom 34 and at top 0 / bottom 34.
- **200 % text:** root `font-size: 200%`, as the brief asks.
- **Production behaviour:** a build in `/tmp/claude-scan-surface/dist`, served by request interception, so no port was used and nothing was written to the repo's `dist`.
- **WebKit:** one probe in Playwright WebKit 26.6, downloaded to `~/Library/Caches`.
- **Evidence:** screenshots are in `/tmp/claude-scan-surface/shots/`.

---

## Findings

### S-01 · broken journey (at 150–200 % text) · A failed save turns the storage banner into a wall: no content and no Back
- **Location:** `src/components/hig/Screen.tsx:94-95`, where the banner sits inside the sticky header. `src/components/hig/StorageBanner.tsx:16-34` has no size cap and no dismiss.
- **Reproduction:**
  - Persona P02 with a water habit, at 320 × 568 and 200 % text.
  - Make IndexedDB `put`/`add` throw `QuotaExceededError` (the acceptance `faultInit`), then tap **Add 250 ml** on Today.
  - Go to `#/move/stretch`.
  - Measured: sticky header 525 px of a 568-px viewport (banner 437 px plus the 88-px bar); tab bar top at 469 px; **visible content 0 px**; the Back button at 437–525 px sits under the tab bar.
  - At 150 % text: header 293 px, 201 px of content. At 100 %: header 150 px, 368 px of content.
  - Screenshots: `banner-stretch-2x.png`, `banner-small-2x.png`.
- **Expected vs actual:**
  - Expected: the person can still read, go Back and reach You → Data. The banner itself tells them to "export and remove older records", and HIG Typography says to "keep primary elements toward the top of a view even when the font size is very large".
  - Actual: every screen shows only the banner until a write succeeds, and no write can be reached.
- **Suggested fix:**
  - Keep a one-line banner in the header (title plus "Details", opening a sheet with the full text and a link to Data & offline), or let it scroll with the content instead of sticking.
  - Cap its height, for example `max-h-[30dvh]` with the text clamped.
  - Never let it push the bar under the tab bar.

### S-02 · accessibility · In production the first navigation after launch drops focus to `<body>` instead of the new screen's title
- **Location:**
  - `src/App.tsx:74-76`: `recordNavigation` runs in the parent's effect.
  - `src/components/hig/Screen.tsx:75-83`: `takeFocusRequest` runs in the child's effect.
  - `src/components/hig/navigation.ts:15-33`.
- **Reproduction (production build):**
  - Launch at `#/today`, then tap **Week 3 of 12**: `document.activeElement` is `BODY` on `#/move/plan`.
  - Launch at `#/guide`, then tap **Vitamin B12**: `BODY`. The next navigation then focuses its `H1`.
  - Same result with reduced motion.
  - The dev server hides the bug: StrictMode runs effects twice, so the second run finds the flag.
- **Expected vs actual:**
  - Expected: every navigation moves focus to the new title, as the comment in `Screen.tsx` promises.
  - Actual: on a navigation that mounts the new `Screen` in the same commit as `App`, the child's effect runs before the parent's. It finds no flag; the parent then sets one, and the next screen consumes it one navigation late.
  - Result: the first push of every launch leaves VoiceOver on a detached element. A stale `true` flag is also always left behind, so any later title change without a navigation steals focus.
- **Suggested fix:** decide in `Screen` itself, from `useLocation().key` compared with a module-level "last announced key", rather than from a flag set by a parent effect.

### S-03 · accessibility · At 200 % text on a 320-px screen, rows split words into 2–3-letter fragments
- **Location:**
  - `src/components/hig/List.tsx:65-77`: `px-4`, a `size-7` icon, `gap-3` and a chevron, all in rem, plus `[overflow-wrap:anywhere]`.
  - Inside sheets the body's `px-4` (`Sheet.tsx:129`) narrows the column further.
- **Reproduction:**
  - At 320 × 568 and 200 %, the label column is about 64 px.
  - Words broken across lines (detected with Range client rects):
    - Move: "Stretch", "Walk", "Guided", "session", "plan" (`big-small_move.png`).
    - Guide: "Vit / ami / n B1 / 2", "diabetes", "metformin" (`word-vitamin-320.png`).
    - Today's chooser: "Str / etc / h", "Gen / tle / mo / bilit / y" (`sheet-chooser-small-2x-light.png`).
    - Also Your plan (weekday names), Find an exercise, Meal ideas and You.
  - At 430 px and 200 %, "Bodyweight", "Recumbent", "preferences" and "Appearance" still split.
- **Expected vs actual:**
  - Expected: whole words. HIG Typography: "When font size increases in a horizontally constrained context, inline items … can crowd text … consider using a stacked layout where text appears above secondary items".
  - Actual: unreadable fragments.
- **Suggested fix:**
  - Make `Row` a container. Below about 16–18 rem of width, stack or hide the icon and halve the horizontal padding.
  - Use `overflow-wrap: break-word`.
  - The tab bar (98 px) and nav bar (88 px) also double at 200 %. HIG says tab titles needn't grow ("they don't expect the tab titles to increase in size"). Keeping the chrome fixed would free room.

### S-04 · accessibility · Sheet titles are cut off at 200 % text
- **Location:** `src/components/hig/Sheet.tsx:107-110`: fixed `h-11` bar, `line-clamp-2`, and `pr-16` to clear the absolutely positioned Close.
- **Reproduction:** 320 × 568 at 200 %. The goal sheet shows "Weekly / move…" and the chooser "What / would…". Screenshots: `sheet-goal-small-2x-light.png`, `sheet-chooser-small-2x-light.png`.
- **Expected vs actual:**
  - Expected: the whole title. HIG: "Keep text truncation to a minimum as font size increases".
  - Actual: ellipsis after one or two words.
- **Suggested fix:** let the bar grow (`min-h-11`, no clamp), put Close in the grid flow rather than absolutely, or move the title onto its own line under Close at large sizes.

### S-05 · accessibility · Input text is pinned at 16 px whatever the text size
- **Location:** `src/index.css:188-191`: `input[type="number"], input[type="text"], input[type="date"] { font-size: 16px !important; }`.
- **Reproduction:**
  - At 200 % (root 32 px), Today → Status → Flare-up: the **End date** label is 34 px and the field's text is 16 px (`input-200.png`).
  - The same rule hits FoodPicker's "Leave out" field (`FoodPicker.tsx:95-103`) and every check-in, profile and You text input that has no `!` override. Track's big number field overrides it with `!text-[2.5rem]`, which shows the rule is known to bite.
- **Expected vs actual:**
  - Expected: input text scales with the person's text size. The brief asks for at least 17 px (`--text-body`), which also avoids the iOS focus zoom.
  - Actual: 16 px, fixed, even at 100 % (where the body text is 17 px).
- **Suggested fix:** replace the rule with `font-size: max(16px, 1rem)`, or drop it, since the fields already use `--text-body`.

### S-06 · accessibility · Source rows clip long words at 200 % on 320 px
- **Location:** `src/screens/guide/parts.tsx:58-76` (`ExternalRow`). Its text spans have no `overflow-wrap`, unlike `Row`.
- **Reproduction:** 320 × 568 at 200 %, `#/guide/sources`. "Exercise/Physical" runs under the arrow and is cut at the card edge, showing "Exercise/Physic" (`wide-exphys.png`). Card `scrollWidth` exceeds `clientWidth` by 18–29 px on Sources, Meal ideas, Sample week, the meal pages and the cards.
- **Expected vs actual:**
  - Expected: wrapped text, with the arrow clear.
  - Actual: overlap, then clipping.
- **Suggested fix:** add `[overflow-wrap:anywhere]` (or `break-word`) to the two spans, and apply the same stacked layout at narrow widths as in S-03.

### S-07 · accessibility · In dark mode the "common mistake" chip and badge are 2.9:1
- **Location:**
  - `src/components/motion/FormDemo.tsx:29` and `src/components/motion/MotionView.tsx:111`: `bg-[var(--safety)] text-white`.
  - Token: `src/index.css:145` (dark `--safety: oklch(0.70 0.19 27)`).
- **Reproduction:** dark mode, `#/move/exercises/cat-cow`, tap a mistake chip. The chip "Sagging deep with the head thrown back" is white on `rgb(255,101,90)`, **2.89:1**. The badge on the demo is the same at 12 px semibold (`chips-dark.png`). In light mode both pass.
- **Expected vs actual:**
  - Expected: at least 4.5:1, like every other token (the `index.css` comment says the lowest is 5.0).
  - Actual: 2.89:1.
- **Suggested fix:** in dark mode put dark text (`--on-ink`) on `--safety`, or use a darker fill there (as `--stop-fill` already does).

### S-08 · accessibility · On macOS Safari the whole app renders at 80 %
- **Location:** `src/lib/textSize.ts:10-30`. `DEFAULT_BODY_PX = 17` assumes iOS, but the probe at `:23` also resolves on macOS.
- **Reproduction:**
  - In Playwright WebKit 26.6 on macOS: `CSS.supports('font','-apple-system-body')` is `true`, `-apple-system-body` is **13 px**, and `rootSizeFor(13)` clamps to **12.8 px**.
  - Measured: root 12.8 px, large title 27.2 px instead of 34, body 13.6 px, footnotes 10.4 px, and 44-px targets become 35 px (`webkit-desktop-today.png`).
  - The comment "Elsewhere the keyword is unknown" is not true for macOS WebKit.
- **Expected vs actual:**
  - Expected: the design size on desktop Safari, the secondary platform under C3.
  - Actual: 80 %.
- **Suggested fix:** apply the scaling only where the iOS text-size setting exists (touch-first WebKit, such as `navigator.maxTouchPoints > 0` together with `(pointer: coarse)`), or never scale below 16 px on non-iOS platforms.

### S-09 · broken journey · Back pops only one level; the second Back replaces the entry and duplicates history
- **Location:** `src/components/hig/navigation.ts:10-26` keeps a single previous path. `src/components/hig/Screen.tsx:85-90`.
- **Reproduction:** Today → Guide → Food & diabetes → "Dal, chana and rajma" → Back → Back.
  - History `idx` goes 3 → 2 → **2**. The second Back is a `replace` to `/guide`, because `cameFrom()` is now the card, not the topic.
  - Browser or gesture Back from Guide then **stays on Guide** (two consecutive `/guide` entries). Forward replays both.
  - Same with Move → Find an exercise → Cat-Cow → Back → Back: browser Back stays on Move.
  - The second Back also has **no reverse transition** (`replace` skips the view transition; counted with a patched `startViewTransition`).
- **Expected vs actual:**
  - Expected: each Back pops exactly one entry and animates like the first.
  - Actual: a dead browser or gesture Back on desktop and in a Safari tab, and an instant second Back on the iPhone.
- **Suggested fix:** keep a stack keyed by `history.state.idx` (React Router writes `idx`) and pop whenever the parent is the entry just below this one.

### S-10 · broken journey · Rows on Today open other tabs' screens, and Back lands in that tab instead of Today
- **Location:**
  - `src/screens/today/TodayScreen.tsx:305-306` (Glucose, Blood pressure) and `:312-321` (plan row): no `state`.
  - `src/screens/track/useOrigin.ts:14-30` already accepts an origin through `location.state` (`{path,label}`).
  - The chooser's Guided-session row (`model.ts:238-240`) has the same problem.
- **Reproduction:**
  - Today → **Glucose** → back label "Back to My Day" → Back = `#/track` (My Day, Track tab).
  - Today → **Week 3 of 12** → Back = `#/move`.
  - P02: Today → Choose something else → Guided session → Your plan → Back = `#/move`.
- **Expected vs actual:**
  - Expected: Back returns to Today, where the person was. iOS pushes a row's detail within the current tab.
  - Actual: the person is moved to another tab's root.
- **Suggested fix:**
  - Pass `state={{ path: '/today', label: 'Today' }}` from Today's rows. Track already honours it.
  - Give `PlanScreen`/`StretchScreen` the same origin mechanism, or let `Screen` take `back.to` from `location.state` when present.

### S-11 · broken journey · Related links send Back to a screen the person never visited
- **Location:** `src/screens/guide/CardScreen.tsx:35-38` (Back always goes to the card's first topic). `src/screens/move/ExerciseScreen.tsx:51-52,113` and `src/screens/move/library.ts:139-151` (a related exercise inherits the list as its Back).
- **Reproduction:**
  - Guide → Food & diabetes → "Dal, chana and rajma" → Related "Foods with B12" → Back = **Vitamin B12** topic, never opened. Back again = Guide.
  - 16 of the 85 related links in `cards.ts` cross topics (counted with `relatedCards`).
  - Find an exercise → Goblet Squat → "Easier: Goblet Box Squat" → Back = the list, skipping Goblet Squat.
- **Expected vs actual:**
  - Expected: Back returns to the previous screen, the card or exercise the person came from (navigation-controller semantics).
  - Actual: a jump sideways in the tree.
- **Suggested fix:** pass the opener in `state` (`{from: currentPath, label: title}`) on related rows, and prefer it over the home topic or the library.

### S-12 · accessibility · VoiceOver hears "Back to Back"; the parent's name never shows even when it fits
- **Location:**
  - `src/screens/guide/format.ts:75-77` (`backLabel` returns "Back" for any name over 5 letters).
  - Used at `CardScreen.tsx:38`, `MealDetailScreen.tsx:25-29` and `SampleWeekScreen.tsx:23`.
  - `Screen.tsx:106` builds `aria-label={\`Back to ${back.label}\`}`.
- **Reproduction:** on any Guide card (`#/guide/card/card-dal`) the button's accessible name is "**Back to Back**". Meal pages and Sample week are the same. On 430 px and desktop the visible label is "Back", although "Food & diabetes" fits (`desktop-card-scrolled.png`).
- **Expected vs actual:**
  - Expected: "Back to Food & diabetes". Show the name when it fits; `Screen.tsx:113` already hides the label in a narrow cell.
  - Actual: "Back to Back" everywhere.
- **Suggested fix:** pass the real parent name and drop `backLabel`. The container query in `Screen` handles narrow cells.

### S-13 · broken journey · "Try again" never recovers a screen that failed to download
- **Location:** `src/routes.tsx:11-18` (module-level `React.lazy`, which caches the rejected import). `src/components/hig/ErrorBoundary.tsx:58` (retry only clears the error state).
- **Reproduction (production build):**
  - Block the Guide chunk, tap Guide. The `vite:preloadError` handler reloads once, and then "This screen didn't load" appears.
  - Restore the network and tap **Try again** twice: it still fails.
  - **Reload the app** works (`chunk-tryagain.png`).
  - Visiting another tab and coming back also stays broken until a reload.
- **Expected vs actual:**
  - Expected: Try again re-fetches, matching its copy ("Usually a weak connection…").
  - Actual: a dead primary button.
- **Suggested fix:** make the lazy retryable (re-create it on retry, keyed by attempt), or have Try again call `location.reload()` for chunk-load errors.

### S-14 · wrong advice (low) · Meal ideas gives diabetes framing to people without diabetes
- **Location:**
  - `src/screens/guide/MealIdeasScreen.tsx:31` ("laid out on the diabetes plate").
  - `src/content/meals.ts:19` (`MEAL_INTRO`).
  - `src/content/claims/food.ts:16-18` and `:135-138`: no `appliesTo`, shown to everyone.
  - Meal ideas is also the entry from Food & blood pressure (`topics.ts:31`, `meals: true`).
- **Reproduction:** P02 with only `hypertension: 'treated'` → Guide → Food & blood pressure → Meal ideas. Shown: "laid out on the diabetes plate", "Build each main meal on the diabetes plate…", "ADA recommends a personal meal plan, ideally made with a dietitian who knows diabetes." No blood-pressure framing appears on the page (`bponly-meal-ideas.png`). P02 and P06, who have no diabetes, see the same.
- **Expected vs actual:**
  - Expected: neutral plate wording ("the plate method") and a "dietitian" line, with the diabetes versions marked "For you" only where diabetes applies, and BP or salt framing for hypertension.
  - Actual: diabetes advice for everyone.
- **Suggested fix:** split the claims by `appliesTo`, or `swap` them: diabetes / hypertension / neither.

### S-15 · safety (how it looks; the gate still refuses) · During an emergency the app still offers movement as the next thing to do
- **Location:**
  - `src/screens/move/StretchScreen.tsx:49-51`: `cannotStart` is false for a refusal.
  - `:83`: the stop text sits in a neutral card, with only the icon in red.
  - `:103`: full-strength primary **Start stretch**.
  - `src/screens/today/model.ts:250-251`: the chooser's Stretch and Walk rows ignore the stop.
- **Reproduction:**
  - P01 with today's check-in carrying `caudaEquinaFlag: true`. Today correctly says "Call emergency services now".
  - `#/move/stretch` shows the reason text in a plain card, then a teal **Start stretch** button. Tapping it opens the check-in: "No exercise today" (`stretch-emergency.png`).
  - Today → Choose something else lists "Stretch · Gentle mobility…" and "Walk · Timed…" as ordinary choices. Only "Guided session" says "Not today" (`today-emergency-chooser.png`).
  - Move lists Stretch and Walk normally.
- **Expected vs actual:**
  - Expected: in a stop state the movement start buttons are gone. See codex-vision §4 (Safety / Recheck: "Start buttons for alternative exercise modes" are deliberately absent) and `RecommendationCard`'s own rule ("A stop replaces the movement button rather than sitting beside it"). The stop's headline also appears where the button was.
  - Actual: the primary action invites exercise; the refusal comes only after the tap.
- **Suggested fix:**
  - Under `emergency` or `today` dispositions, replace Start with the stop headline and "Review your check-in" (quiet styling), and give the line card the stop ink.
  - In the chooser, give Stretch and Walk the gate's words ("Not today — see your check-in"), as Guided already does.

### S-16 · polish · Every push from a scrolled list opens mid-page and then scrolls up; Back does the reverse
- **Location:** `src/index.css:194-196`: `* { scroll-behavior: smooth; }`. React Router's `ScrollRestoration` then smooth-scrolls instead of jumping.
- **Reproduction (rAF trace):**
  - 320 × 568, Food & diabetes scrolled to 366, tap "Fasting and your medicines". The new screen draws at `scrollY` 366, with its title at −321 px, and animates to 0 over about 300 ms: 366 → 359 (51 ms) → 164 (122 ms) → 45 (191 ms) → 0 (324 ms).
  - Back opens the topic at the child's offset (300) and drifts to its saved 366.
  - With reduced motion both are instant.
- **Expected vs actual:**
  - Expected: a pushed screen appears at its top, at once, as a navigation controller shows it.
  - Actual: a visible scroll during the view transition.
- **Suggested fix:** remove the global smooth scroll, or set `html { scroll-behavior: auto }`, and use `behavior: 'smooth'` only where wanted.

### S-17 · polish · An in-app theme that differs from the device's leaves native controls and the browser chrome on the device's scheme
- **Location:** `index.html:10-12` (`color-scheme: light dark`, and `theme-color` keyed only to `prefers-color-scheme`). `src/App.tsx:88-92` and `src/hooks/useTheme.ts:23-37` toggle only the `dark` class.
- **Reproduction:** device light, app set to Dark. Computed `color-scheme` is `normal` and the active `theme-color` is `#f1f3f5`. In the Status sheet the date field's calendar icon is black on `#1a1a1a` and close to invisible (`theme-dark-on-light-system-date.png`). Safari's bars and the status-bar tint stay light over a dark page. The reverse holds for Light on a dark device. Toasts also follow the device, because sonner's `Toaster` calls `next-themes`' `useTheme` with no provider.
- **Expected vs actual:**
  - Expected: one scheme for the page, its controls and the bars.
  - Actual: mixed schemes.
- **Suggested fix:** when the theme resolves, set `document.documentElement.style.colorScheme` and rewrite the `theme-color` meta to `--grouped-bg`; pass the resolved theme to `Toaster`.

### S-18 · polish · Switching tabs throws away each tab's place
- **Location:** `src/components/hig/TabBar.tsx:43-46` (each tab links to its root).
- **Reproduction:** Guide, search "dal", open the card and scroll to 600 → tap Today → tap Guide. The result is the Guide root, with the search empty and the card gone.
- **Expected vs actual:**
  - Expected: HIG Tab bars: tabs "let people quickly switch between sections of the view while preserving the current navigation state within each section".
  - Actual: every tab switch resets the tab.
- **Suggested fix:** remember the last location per tab (module state or `sessionStorage`) and link the tab there. A tap on the already-selected tab can still pop to the root; it already scrolls to the top.

### S-19 · polish · Sheets show a grabber but cannot be dragged, resized or swiped away
- **Location:** `src/components/hig/Sheet.tsx:101-105` (decorative grabber); `src/components/ui/sheet.tsx` has no gesture handling.
- **Reproduction:** open Choose something else and swipe 480 px down from the grabber with CDP touch events. The sheet stays open and its top barely moves.
- **Expected vs actual:**
  - Expected: HIG Sheets: "Include a grabber in a resizable sheet. A grabber shows people that they can drag the sheet to resize it", and "Support swiping to dismiss a sheet. People expect to swipe vertically to dismiss a sheet".
  - Actual: a non-functional affordance.
- **Suggested fix:** add a vertical-drag-to-dismiss on the grabber and header, or remove the grabber.

### S-20 · polish · During the large-title collapse the bar shows no title
- **Location:** `src/components/hig/Screen.tsx:136-143`. The second sentinel sits after the subtitle and `pb-4`.
- **Reproduction:** 430 × 932. On Today the large title is fully under the bar at y = 44, but the compact title appears only from y = 86. Between those, the bar shows the blurred large title and the date, with no title (`collapse_today-0-light-65.png`, `-80.png`, `-100.png`). Other screens have an 18-px gap (44 → 62).
- **Expected vs actual:**
  - Expected: the inline title appears as the large title passes under the bar.
  - Actual: a gap with no title.
- **Suggested fix:** put the sentinel straight after the `h1`, before the subtitle and padding.

### S-21 · polish · Search misses common spellings, and the exercise search misses "sciatica"
- **Location:** `src/content/cards.ts` and `src/content/topics.ts` aliases; `src/screens/move/library.ts:87-97` (substring match, no synonyms).
- **Reproduction (`search()` and `filterExercises()` in tsx, content as of 12:45):**
  - Guide finds every requested name: roti, chapati, idli, dosa, poha, dal, rajma, chana, paneer, curd/dahi and rice, plus Devanagari रोटी and दाल.
  - Guide misses common variants: **chapatti, chappati, channa, panner, mutton** return 0 results.
  - Find an exercise: **"sciatica" → No matches**, although two sciatic nerve glides exist. "back pain", "yoga" and "posture" → 0.
- **Expected vs actual:**
  - Expected: a person with sciatica who types "sciatica" finds the nerve glides.
  - Actual: dead ends.
- **Suggested fix:** add the aliases. Give `filterExercises` a small synonym map (sciatica → sciatic, nerve; back pain → lower back) or prefix-of-word matching.

### S-22 · polish · The iPhone Home Screen icon is SVG only
- **Location:** `index.html:6` (`apple-touch-icon.svg`); `public/manifest.webmanifest:11-27` (all icons SVG). `public/` has no PNG.
- **Evidence:** Apple's *Configuring Web Applications* says to "place an icon file in PNG format". With no usable icon, iOS uses a snapshot of the page. The platform behaviour was not observed on a device.
- **Expected vs actual:**
  - Expected: a 180 × 180 PNG `apple-touch-icon` and PNG manifest icons (192, 512, plus a maskable one).
  - Actual: SVG only.
- **Suggested fix:** add the PNGs.

### S-23 · polish · The action tint also colours text you can't tap
- **Location:** `src/screens/guide/parts.tsx:14` and `TopicScreen.tsx:22` ("For you ·"); `src/screens/today/ChooserSheet.tsx:36` ("Suggested").
- **Evidence:** the same teal marks borderless buttons ("Choose something else", "Change", "Clear filter", "Close"). HIG Color: "if you use your brand color to indicate that a borderless button is interactive, using the same or similar color to stylize noninteractive text is confusing."
- **Suggested fix:** show "For you" and "Suggested" in label or secondary-label weight (semibold body colour) and keep the tint for actions only (D12).

### S-24 · polish · Back plays the same animation as a push, and the cross-fade shows both screens at once
- **Location:** `src/index.css:330-337`: one `fs-fade-in reverse` / `fs-rise-in` pair, with no direction. The comment at `main.tsx:48-52` says "Back then reverses the same transition".
- **Reproduction:** with CDP animation playback slowed to 5 %, push and pop both show the new screen rising 12 px from below. In the old snapshot's reversed ease-out, its opacity is still about 0.98 at 75 ms of 200 ms, so both screens are superimposed (`vt-light-no-preference-1500.png`). The background pixels stay constant, so there is no flash.
- **Expected vs actual:**
  - Expected: a pop reverses the push, so Back reads as going back.
  - Actual: both directions look the same.
- **Suggested fix:** set a view-transition type or a `data-direction` on Back, and give the old view an ease-in curve that hands over cleanly.

---

## Fixed by other agents during the scan (re-measured)
- **Dark-mode muted text failed contrast:** 3.27:1 on cards, 3.61:1 on the page, covering every secondary line, footer, date, disclaimer and inactive tab label. The light `:root` override of `--muted-foreground` came after shadcn's `.dark` block. It is now restated in `.dark` (`index.css:450-453`); a re-run of the contrast audit over 13 routes in light and dark finds no failures.
- **Stretch's segmented control was 40 px tall.** It is now `min-h-11` (`controls.tsx:101`).

## Checked and fine
- **Overflow:** no horizontal overflow on any scope route at 430 and 320, light and dark, at 100 %. At 200 % the only clip is S-06. Light-mode text contrast is 4.5:1 or better everywhere measured. All targets are at least 44 px after the segmented fix.
- **View transitions:**
  - Pushes, tab taps, the You button, the first Back (pop) and browser Back animate.
  - Under reduced motion, zero `startViewTransition` calls were made.
  - No light or dark flash: background pixels were constant through slowed transitions.
  - The tab bar is excluded from the cross-fade.
- **Safe areas (emulated 47/34):**
  - The header, tab bar, the sticky Start bar on Stretch and the sheets clear the notch and the home indicator.
  - The bar's material turns on at 2 px of scroll.
  - The header's top safe-area band has no material, so content shows through when the top inset is above 0. Apple's meta-tag reference says that with `apple-mobile-web-app-status-bar-style: default` "the web content is displayed below the status bar", so the inset is 0 in the installed app. This would matter only with `black-translucent`.
- **Routing:**
  - All nine legacy redirects land correctly; `?checkin=1` and `/library?ex=` survive.
  - Unknown routes in each area fall back to that area; `/welcome` sends an onboarded person to Today.
  - Re-tapping the selected tab scrolls to the top.
- **CSP (production build):**
  - No `securitypolicyviolation` across Today, Move, Stretch, the 3D exercise demo, Guide, cards, meals, You, Track and Session.
  - The inline theme script's hash matches.
  - `form-action 'none'` does not break Guide search.
- **Status sheet:** Away (since 1 October) → "I'm back" → "Move your plan back 7 days" → Week 3 becomes Week 2, and "0 of 2 sessions" excludes the status days. Flare-up gives "A gentle stretch, or rest" with its reason.
- **Personalisation:**
  - The For-you topics and reasons are right for P01–P06.
  - For P05 (open foot wound) the walk hand-offs are hidden and walking prompts give way to seated versions.
  - The water prompt adds to the day total and shows "of 2,000 ml".
  - The Glucose and BP rows appear for the right profiles.
- **Content numbers cross-checked between screens:**
  - Reynolds 2016: 41 adults, 12 %, and 22 % after the evening meal. Today's after-meal-walk reason matches the Guide.
  - Ding 2025: 7,000 steps, 47 % / 14 %.
  - WHO 150–300 minutes, the same figure in the goal sheet and the Guide.
  - CDC sleep bands; salt under 5 g.
  - The ADA citation is by recommendation number only (D32).
  - NHS appears only as Further reading.
- **Error handling:** error boundaries keep the tab bar when a screen fails.

## Not checked
- **On an iPhone:**
  - Real safe-area values and status-bar appearance with `theme-color`.
  - Home Screen icon rendering (S-22).
  - Real VoiceOver output (S-02 and S-12 were measured through `document.activeElement` and accessible names).
  - The iOS text-size probe on a phone (only macOS WebKit was measured).
  - Safari's view transitions.
  - Whether standalone mode has a swipe-back gesture, which decides how visible S-09 is on the phone.
- **Clinical:**
  - The Stretch preview during a Flare-up status is the same routine as on a Normal day. It changes only once the check-in reports an irritable back. Left for the safety owner; not shown to be wrong.
  - ADA 2026 recommendation numbers (3.10, 5.x, 6.2) were not checked against the Standards.
- **Out of scope, seen in passing and left for their owners:**
  - For the foot-wound persona, the Walk setup shows "Start walk" with no hold on screen; the gate was not exercised.
  - The B12 Quick Log placeholder "320" looks like a pre-filled value.
  - Sonner toasts sit 16 px from the bottom, over the tab bar. They are used only by SessionPage.
- **Not tested:** landscape orientation and keyboard geometry.
