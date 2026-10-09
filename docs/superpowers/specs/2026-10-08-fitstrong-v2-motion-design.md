# FitStrong v2: motion and interaction design

**Status:** draft 2, 8 October 2026. It's reconciled from:
- Codex's motion review (its §5, with A-02 and A-64 to A-72);
- Kiro's K-01 to K-03, K-27, K-45 to K-47 and K-53;
- the platform facts in `docs/research/v2-design-research.md` and `v2-feasibility-research.md`.

**Companion:** the journey spec (`2026-10-08-fitstrong-v2-journey-design.md`). That spec says what each screen shows. This one says how things move between and within screens: where every element comes from and goes to, how it feels, and what replaces the movement when motion is reduced.

## 0. Four rules above everything else

1. **State leads, animation follows.**
   - The real value, the permission, the focus target and the accessible name update first, independently of any visual effect.
   - An animation finishing never grants permission, saves anything or starts movement (A-69, A-70).
   - Content can be read and used before its motion settles.
2. **Safety pre-empts every effect** (A-02, K-01 to K-03). When the current decision is an emergency, a stop or a hold, three things happen in the first frame:
   - urgent text and its safe action render at once, at full contrast;
   - any running view transition is skipped (`transition.skipTransition()`) and its old snapshot removed;
   - camera, gesture and counting animations stop.

   Surrounding non-essential effects may follow; the information never waits for them.
3. **One owner per transition** (A-70).
   - Navigation transitions belong to the router's `viewTransition`. Named shared elements are set before capture and cleared on finish, skip or error. Names are unique per snapshot.
   - The newest navigation wins: a second tap skips the running transition and acts on the latest intent.
   - Navigation and focus succeed even when the animation is skipped or unsupported.
4. **Reduced motion replaces; it doesn't just delete** (research decision 3e, A-66). Reduce Motion is either the system setting or the in-app one, in Me → Display and on setup page 1.
   - Slides and zooms become 200 ms fades, and values update instantly.
   - There's no bounce, no parallax, and nothing animates into or out of blur.
   - The map never moves on its own, and demos start as a still with a Play button.
   - Every M-number below states its reduced-motion version.

## 1. What motion is for

Motion has three jobs, and nothing moves without one of them:

- **Continuity:** where something came from and where it went. A tile becomes its hub, and a finished stretch's minutes reach the week ring.
- **Feedback:** a touch registered, or a change happened.
- **Calm emphasis:** draw the eye to the one thing that changed.

**Motion never:**
- decorates;
- replays history (rings, charts and lists don't re-animate from zero on every visit, A-67);
- loops, except the 3D form demo while it plays and the session timer;
- delays information.

## 2. The feel

The model is iOS spring motion with no bounce by default.

- **Gestures.** Surfaces follow the finger 1:1. On release they settle with a spring that starts from the release velocity. That spring is simulated in JS for gestures, because a fixed CSS curve can't carry velocity (A-69).
- **Distances.** Content travels 8–24 px; only the iOS push uses the full width. At most one large movement happens at a time.
- **Glass.** Floating glass controls stay calm: tint, blur, a rim and a highlight. There's no refraction, because Safari can't do it (WebKit bug 245510).

## 3. Tokens (`src/design/motion.ts` and `src/index.css`)

### 3.1 Springs

These are Apple's duration-and-bounce model, converted with the research's formula: stiffness = (2π/d)², damping = 4π(1−bounce)/d, with a mass of 1.

| Token | Apple value | CSS | Use |
| --- | --- | --- | --- |
| `spring` | 0.4 s, bounce 0 | `588ms var(--spring-smooth)` | navigation, sheets, morphs, the tab indicator |
| `spring-quick` | 0.3 s, bounce 0 | `441ms var(--spring-smooth)` | small surfaces: menus, callouts, chips |
| `spring-release` | 0.4 s, bounce 0.15 | `557ms var(--spring-snappy)`, or the JS spring from the release velocity | only after a gesture with momentum: a sheet's release, a drag's drop |

- `--spring-smooth` and `--spring-snappy` are the research's `linear()` tokens (§4.1).
- Nothing bounces more than 0.15, and there's no `bouncy` token.
- No clinical value or ring ever overshoots its true value (A-69).

### 3.2 Durations for plain fades

| Token | ms | Use |
| --- | --- | --- |
| `instant` | 100 | press-in feedback |
| `fade` | 200 | tab content hand-over, small fades, every reduced-motion replacement |
| `fade-slow` | 300 | non-urgent new content arriving |
| `count` | up to 600 | a non-clinical number moving to its new value (minutes, steps). Clinical values never count (M16) |

**Safety:** 0 ms. Urgent content is there in the first frame (rule 2).

### 3.3 Distances and scales

- **Content entrance:** 8 px up, plus opacity.
- **Press:** an inner visual layer scales to 0.97. The hit area never shrinks (A-62, Codex's M2 review).
- **Glass press:** the highlight brightens. It doesn't bulge.
- **Page behind a sheet:** scales to 0.94 with a 12 px corner radius and dims to 70%. Under Reduce Motion it only dims.

## 4. Layers: where things live and come from

From back to front:

| Layer | Holds | Enters from | Leaves to |
| --- | --- | --- | --- |
| 0. Page | screen content | its trigger (a push or morph) | the opposite direction |
| 1. Content | solid cards, tiles, charts, the Right now card | already there, or a fade for new content | fade |
| 2. Navigation glass | nav bar, tab bar, the player's control capsule, sheet headers | always present | — |
| 3. Sheets | check-in, Add reading, Log a meal, status, chooser, stop | the bottom edge | the bottom edge |
| 4. Toasts | "Saved", Undo, waiting reminders | 16 px above the tab bar, rising | sinking back |
| 5. Menus | the long-press menu, "More" | the pressed element | back into the element |
| 6. Full-screen tasks | setup, player, live walk | their trigger (a sheet or a button) | where they return to |
| 7. Urgent | the urgent banner, stop states | present in the first frame | only when the decision changes |

**Rules:**
- Glass never sits on glass. A sheet over the tab bar hides it: the bar sinks 8 px and fades.
- One sheet at a time.
- At most two blurred surfaces at once (research decision 1a).
- Toasts and menus are solid. Menus dim the page; they don't blur it (A-68).

## 5. Choreography, interaction by interaction

Each entry gives the trigger, then the motion, then the reduced-motion version (RM).

### M1. Launch → Home

- **Trigger:** opening the app, or returning to Home.
- **Motion:** Home renders complete at once: the greeting, status, urgent banner, Right now card, This week and the tiles. There's no entrance cascade (A-67).
  - The background matches the stored theme from the first paint: a tiny inline script reads the saved theme before the CSS applies.
  - **The week ring.** When its value is higher than the last value this device showed, it animates from the old value to the new one (`spring`). Otherwise it's drawn already set, and it never animates from zero.
  - **Safety.** An urgent Right now state has no motion at all (rule 2). The week ring is then drawn already set too, so nothing beside an urgent card moves (K-03, Kiro's verification).
- **RM:** everything is drawn set, values included.

### M2. Pressing anything

- **Trigger:** a pointer down on a tile, card, row or button.
- **Motion:** the inner visual scales to 0.97 and darkens 4% (`instant`), then returns on release (`spring-quick`). Glass controls brighten their highlight instead.
- **Activation** follows the browser's own click rules. A scroll cancels it (`pointercancel`), and a shaky hand's small movement doesn't (K-45).
- **Keyboard** activation and the focus ring look the same as touch.
- **RM:** only the colour changes.

### M3. Tile → its hub (the signature transition)

- **Trigger:** tapping a Home tile.
- **Motion:** a same-document view transition, `spring`.
  - **The morph.** Only the tapped tile gets `view-transition-name: hub-card`, through `useViewTransitionState`. The destination's header container gets the same name. The plain coloured container morphs from the tile's rectangle to the header, while the text cross-fades. Text isn't morphed, because a snapshot's corners scale with its image (research §4.2).
  - **The rest of the page.** The other tiles fade out (`fade`). The hub's content fades in, rising 8 px, once the morph is half done.
  - **The tab bar** stays put (`app-nav`, no animation). Its glass is solid during the transition, because Safari drops backdrop blur while one runs (WebKit 302256).
- **Safety:** if the hub opens on a hold or a stop, the transition is skipped and the hub renders at once (rule 2, K-01).
- **Back:** reverses to the tile if it's still on screen. If it's hidden, scrolled away or removed, Back is a plain fade (A-70). When Safari has already animated a swipe-back (`hasUAVisualTransition`), the app's own transition is skipped, as in v1.
- **RM:** a 200 ms fade with no change of shape.

### M4. Push to a detail, and Back

- **Trigger:** a row opens its detail: a reading, session, walk, topic or meal.
- **Motion:** the iOS push.
  - The incoming page slides in from the trailing edge (`spring`). The outgoing page moves 25% toward the leading edge and dims to 90%.
  - The title cross-fades, and the Back label becomes the opener's name.
  - Back reverses it, and restores the opener's scroll position and the focus on the tapped row (A-32).
  - **Shared elements** are used only where both ends exist: a walk thumbnail into the detail's route, or a reading's value into the detail's value.
  - **Browser history gestures** complete without a second app animation layered on top (A-70).
- **RM:** a 200 ms fade, and Back is the same fade.

### M5. Switching tabs

- **Trigger:** tapping a tab.
- **Motion:**
  - The tinted selection slides to the tapped item (`spring-quick`), without stretching.
  - The content hands over: the old page fades out in 100 ms and the new one fades in over 200 ms. There's no scale and no sideways movement.
- **Re-tap on the selected tab:** if the tab has pushed screens, it pops to the tab's root with M4's Back. Otherwise it scrolls to the top: smooth, or instant under RM.
- **Rapid taps:** the latest wins (rule 3).
- **RM:** the selection jumps, and the content changes with a 200 ms fade.

### M6. The tab bar on scroll: removed

The tab bar never shrinks or hides its labels (K-27, A-62, research decision 2f). A soft gradient under it keeps content legible as it scrolls beneath. That gradient is a fade, not a second blur.

### M7. Large title → compact title

As v1:
- the large title scrolls with the content;
- the bar's glass appears after 2 px;
- the compact title fades in once the large title has passed under the bar.

The threshold is measured from the real header height, including multi-line titles and safe areas.

**RM:** the compact title appears without travel.

### M8. Sheets

- **Presentation:**
  - The sheet rises from the bottom edge to its detent (`spring`), interactive the moment it's visible.
  - The page behind scales to 0.94 and dims, and the tab bar sinks and fades.
  - The header and grabber are glass, with a labelled Close. The body is solid.
- **Urgent sheets** (stop, "I feel low", an emergency outcome) appear at once, with no rise, scale or dim animation (rule 2).
- **Dragging:**
  - The sheet follows the finger 1:1, with rubber-banding at the top.
  - On release it closes if it was dragged past 30% of its height (up to 200 px) or flicked down faster than 800 px/s, using `spring-release` from the release velocity. Otherwise it springs back.
- **Resisting:** with answers given (the check-in, a form with input), a drag moves the sheet at most 24 px and it settles back.
  - Close asks "Keep your answers?" (K-46).
  - While saving, the sheet resists the same way, and the header says "Saving…".
  - Stop and low guidance can be closed, but closing it leaves movement paused and the incident open (journey §4.4).
- **Detents:** medium and large. The height changes only between detents; inside a detent, the content scrolls. Sheets don't grow with their content (A-68).
- **Pushes inside a sheet** (Log a meal → a food's portion): the content slides horizontally inside the sheet, using M4 at 60% of the distance.
- **The keyboard:** content lifts with the visual viewport, so a focused field is never hidden.
- **RM:** the sheet fades in at its detent. The page behind only dims, there's no rubber-banding, and dismissal is a fade.

### M9. The check-in, step by step

- **Sections appear as they apply:**
  - When "None of these" is ticked, the next section appears below. Its height grows from 0 (`spring-quick`; small sections only) and its content fades in.
  - The sheet scrolls only as far as needed to show the new section's heading. It never scrolls away from a focused field.
  - An open section never collapses by itself.
- **Answer chips:** a tap fills the chip with the tint and shows its check (`instant`). Chips that can't both be chosen swap at once.
- **The BP minute:**
  - A soft circular countdown draws over 60 s.
  - At zero, VoiceOver hears "Ready for the second reading" (polite), and an "Enter second reading" button appears.
  - Focus doesn't move (K-47, A-64).
- **Each reading counts on its own.** A severe first value, or an emergency answer, shows its guidance at once, without waiting for the rest of the form (A-11).
- **The outcome** renders in place in the first frame.
  - **Go ahead** shows its decision and any changes together ("with a gentler warm-up"). No green check implies an unrestricted clearance when there are changes (Codex's M9 review).
  - **Hold and stop** use their ink, with the safe action already present.
- **RM:** sections appear without growing, and the outcome is simply there.

### M10. Into the player or the live walk (full-screen tasks)

**Three origins:**

| Origin | Motion | RM |
| --- | --- | --- |
| From the check-in outcome sheet | The sheet grows to full height (`spring`), its grabber fades, its content cross-fades into the player's first screen, and Start becomes the player's play/pause control | a fade |
| From a hub's or the Right now card's Start | The task rises from the bottom edge as a full-screen sheet (`spring`) | a fade |
| From a direct link or a resume | A fade, since there's no visual source | a fade |

**Order of events** (A-01, A-72):
1. The final live gate runs.
2. Only after it passes do the movement and the timer start.
3. Audio is unlocked by the person's own tap on Start.

**Before the 3D model loads:** the text cues and the stop control are already visible, and a soft still silhouette stands in for the model.

### M11. Inside the player

- **Step to step:** the outgoing step's title and cues fade while moving 16 px toward the leading side (`fade`). The incoming step fades in from 16 px on the trailing side. The 3D figure cross-fades between poses.
- **The timer ring** advances continuously. The last 3 seconds show their numbers without a pulse, and the voice counts in time.
- **Sets:** completing a set fills its chip and shows a check (`instant`). The next set's weight and reps field appears below.
- **Rest:** a countdown ring and the rest line. There's no breathing animation: a fixed breathing pace would be new, unreviewed clinical guidance (Codex's M11 review).
- **Pause** stops everything: the timer, the demo's motion and the voice, with queued speech cancelled (A-72). The play/pause icon swaps at once.
- **"Stop: something's wrong"** pauses at once and shows the stop sheet at once (M8, urgent). Answers that end the session replace it with the full-screen stop state at once.
- **Finish:**
  - The session is saved first. After the durable save, the content compresses into the summary and the session's minutes appear.
  - A safety ending has no celebration and no compression; the stop state stays.
- **RM:** step changes are fades and poses switch without a cross-fade. The demo stays a still until Play is tapped.

### M12. Summary → back where it started

- **Trigger:** "Done" on a session, stretch or walk summary.
- **Motion:**
  - The task closes back to its actual origin: Home, a hub, or Browse → hub. If that origin's tile or card is still on screen, the task shrinks into it; otherwise it fades (A-32).
  - On arrival, the week ring animates its real change once (M1's rule) and the tile's line changes.
  - Each committed activity is applied once, so returning twice doesn't animate twice (A-55).
- **Reaching the weekly goal** adds the line "Weekly goal reached". There's no burst, bounce or glow, and nothing for going past it (D19, K-06).
- **RM:** values are set, and the task fades away.

### M13. The live walk

- **Starting:** the live walk rises as a full-screen sheet from the Start button (M10). There's no circle reveal and no countdown flourish. Recording begins when the gate passes after "Start walk" (Codex's M13 review).
- **While walking** (journey §9.2; D18; feasibility research map decision):
  - **No map pictures during the walk.** The route is drawn as an SVG line on a plain grid, redrawn at most once a second.
  - **The view:** a "you are here" dot. The view keeps the whole route in frame by stepping its scale; it never pans or zooms with animation. Zoom in, Zoom out and "Show whole route" are labelled buttons.
  - **Segments:** each is drawn separately, and a gap is never joined (A-48).
  - **Stats:** values change by replacing their text, with no digit rolls.
  - **Paused:** the time dims and "Paused" shows, with no pulsing (A-67).
- **"I need to stop" and "I feel low":** the sheets appear at once (M8, urgent).
- **Finish:**
  - After the durable save, the solid stats panel expands upward into the summary (`spring`), with the route drawing still visible above.
  - The start and end markers appear.
- **RM:** the same, with every change instant.

### M14. Walk summary and detail: the map

- **Maps on and a route saved:** the summary and detail first show the route drawing.
  - The map pictures (OpenStreetMap tiles, journey §9.5) load behind it and fade in under the route once they're ready. Their attribution, "© OpenStreetMap contributors", shows from the first tile.
  - From the history list, the thumbnail (our own route drawing) grows into the detail's route frame (a shared element, `spring`).
- **No route, maps off, offline, or the privacy view:** the stats fade in. No map request is ever made in these cases (A-51).
- **RM:** fades, and the tiles appear without fading.

### M15. Logging food

- **The sheet** rises (M8).
- **Search:** results update as the person types, but stay put while a finger is down or a row has focus. There's no reflow animation, so tap targets never move under the finger (A-21, Codex's M15 review).
- **"+" on a row:** the "+" becomes "Added ✓" for a second, and the meal tray at the top shows the new item, fading in. The item doesn't fly across the screen.
- **The stepper:** − and + use M2's press. The value changes at once, and the estimate under it updates at once, with its "about".
- **"Save meal":** the button shows "Saving…". After the durable save, the sheet closes and "Lunch saved" appears (M19). If the Food tile is visible, its line changes.
- **RM:** the same, without the fades.

### M16. Adding a reading

- **The sheet** rises (M8).
- **Saving a normal reading:** after the durable save, the sheet closes and "Glucose saved · 112 mg/dL at 9:05 am" appears.
  - If the destination is on screen (a hub's latest value, or Today's log), the new value's row appears with a brief highlight that fades.
  - Clinical values never count up and never animate their numbers (Codex's M16 review).
- **A reading that needs guidance** (a low, a severe BP): the guidance replaces the form in the first frame, whatever happens to the write (journey §4.5). The number stays visible at the top.
- **Back on Home after a safety reading,** the Right now card shows the new state in the first frame (K-02).
- **RM:** the same, without the highlight fade.

### M17. Edit Home

- **Entering:**
  - Each tile shows its labelled "Hide", "Move up" and "Move down" buttons and a drag handle, which fade in (`fade`).
  - There's no jiggle and no corner badges.
  - "+ Add" gets a dashed outline.
- **Dragging a tile:**
  - The tile lifts (a deeper shadow, an inner scale of 1.03) and follows the finger.
  - The other tiles in its group move aside (`spring-quick`), and dropping settles it (`spring-release`).
  - VoiceOver hears "Water moved to position 2 of 5", and focus stays on the moved tile.
- **Move up and Move down** animate the same reorder.
- **Hiding:** the tile fades and the group closes the gap (`spring-quick`). The tile appears under "Hidden" with "Show", and Undo is offered too (M19).
- **Adding, from Browse's pick mode:** the new tile fades in at its place in its group.
- **RM:** order changes are instant, and the controls appear without a fade.

### M18. Long-press menus and "More"

- **Trigger:** a 500 ms long-press on a tile, or the labelled "More" button.
- **Motion:**
  - The element lifts (an inner scale of 1.02, with a shadow).
  - The page dims to 40%, without blur.
  - The menu grows from the element's nearest corner (`spring-quick`), with full-width labelled rows.
  - Tapping outside, or "Close", sends the menu back into the element.
- **Urgent state:** if one arrives while the menu is open, the menu closes at once and the urgent state shows.
- **Native selection and zoom** are never disabled globally.
- **RM:** a static menu anchored to the element.

### M19. Toasts and Undo

- **Appearance:**
  - A solid capsule 16 px above the tab bar, or above the home indicator in full-screen tasks.
  - It rises 12 px and fades in (`spring-quick`), and sinks out (`fade`).
  - It says what was saved: "Glucose saved · 112 mg/dL".
- **Undo** (research decision 4e, A-65):
  - A routine delete happens at once, with Undo.
  - Undo stays until the person's next action, never on a timer.
  - A newer toast stacks above it rather than replacing it, up to two. Older actions stay reachable from Today's log.
  - Erasing everything gets two confirmations with specific labels ("Erase all").
- **A plain confirmation** with no action fades after 4 s; nothing is lost when it goes.
- **Screen readers:** each toast is announced once (polite).
- **Toasts never cover** a focused field or the primary button.
- **RM:** toasts appear and disappear without travel.

### M20. Waiting reminders

- **While the app is open:** a reminder that comes due appears as a toast, with its icon, its text and two labelled buttons ("Done", "Later").
- **After 8 s** it goes from the screen, but it stays in "2 reminders" with the same buttons, so nothing is lost (A-65).
- **Live eligibility:** a habit that a new fluid limit or status has made inappropriate is withdrawn at once.
- **On Home,** a reminder is the Right now card's secondary row when §7.4's ranking puts it there (K-37).
- **RM:** a static toast.

### M21. Trends

- **History is static** (A-67). Opening the tab or a category draws its charts and rings at once; nothing sweeps from zero or redraws on each visit.
- **Changing the period:**
  - The segment indicator slides (`spring-quick`).
  - The chart changes in one step. Bars for the same dates move to their new heights (`spring`, transform only), and everything else fades over (`fade`).
  - The headline value, its statistic and the comparison text change at once, never counting (A-42).
- **Tapping, dragging or arrowing to a bar:**
  - A callout appears above the bar (`spring-quick`), with its value, unit and date.
  - The other bars soften to 60%, which keeps 3:1 against the background.
  - Escape, or a tap elsewhere, closes it.
- **"Show as list"** expands a table below the chart.
- **RM:** charts and callouts appear without motion.

### M22. Setup

- **Between pages:** the incoming page slides 30% in from the trailing edge and fades in (`spring`). The outgoing page moves 30% the other way and fades. Back reverses this.
- **Next moves only after the answer is stored,** never on an animation's end, so rapid taps can't skip a question (A-23 to A-26).
- **The progress capsule** fills smoothly to its next fraction.
- **The review page** is drawn at once, with no cascade.
- **"Start using FitStrong"** goes straight to Home, which renders under M1's rule. There's no compound reveal.
- **RM:** pages change with a fade.

### M23. Theme, text size, Reduce motion, Reduce transparency

- **Instant:** text size, Reduce motion and Reduce transparency.
- **Theme:** the page fades over 200 ms through a root view transition. This is skipped while a map or the player is on screen (A-68), and never delays an urgent update.
- **RM:** instant.

### M24. Loading, errors and empty states

- **Loading:** navigation and Back stay usable.
  - Content that takes more than 150 ms shows content-shaped placeholders, with a gentle shimmer that's off under RM.
  - The placeholders are announced as "Loading" (A-71).
- **Errors:**
  - Inline errors appear at once under their field, in stop ink, with no shake. Safety-related errors are never delayed.
  - A failed screen shows v1's "This screen didn't load", with "Try again".
- **Empty states:** a static icon and two lines. Nothing floats or loops.
- **RM:** static placeholders.

## 6. How the components fit together

| Component | Events | Motion it owns | Hands off to |
| --- | --- | --- | --- |
| `GlassTabBar` | select, reselect | M5 | routes; reselect → pop or scroll |
| `Screen` (nav bar and large title) | back | M4, M7 | the navigation stack |
| `Tile` | open, menu | M2, M3 (as source), M17 | the hub (M3), `Menu` (M18) |
| `RightNowCard` | act, chooser | M1's rule; safety immediate | the check-in sheet, the player or walk (M10), the chooser |
| `WeekRing` | open | M1, M12 (real changes only) | Trends |
| `Sheet` | close, detent | M8 | its inner pushes |
| `CheckInSheet` | outcome | M9, M10 (origin 1) | `Player` or `LiveWalk` |
| `Player` | finish, stop | M11 | summary → origin (M12) |
| `LiveWalk` | finish, stop | M13 | summary → origin (M12) |
| `RouteView` (the SVG route drawing) and `StaticMap` (the opt-in tiles beneath it) | — | M13, M14 | — |
| `FoodLog` | save | M15 | the Food hub or tile |
| `AddReading` | save | M16 | the hub, Today's log, Right now |
| `TrendChart` | select, period | M21 | — |
| `Toast` | undo | M19, M20 | the store (undo) |
| `Menu` | pick | M18 | Edit Home, show and hide |

**Implementation shape:**
- **`src/design/motion.ts`** exports:
  - the tokens;
  - `spring(t, duration, bounce)`, plus a JS integrator that starts from a velocity, for gestures;
  - `useReducedMotion()`, which combines the system and in-app settings;
  - `skipTransitions()`, which rule 2 calls.
- **The router** owns view transitions. Shared names are set with `useViewTransitionState` before capture.
- **`data-vt-running`** on `<html>` makes glass solid while a transition runs (WebKit 302256).
- **CSS animates only** `transform`, `opacity` and stroke offsets. `clip-path` and `height` are allowed on small sections only, and layout properties are never animated on large surfaces.

## 7. Performance budget, measured on an iPhone 13 Pro Max

- **Frames.** A 60 Hz frame is 16.7 ms and a 120 Hz frame is 8.3 ms; ProMotion isn't guaranteed for web content.
  - Target: fewer than 5% dropped frames during M3, M4, M5, M8 and M10.
  - Measured with the Safari Web Inspector timeline, in Low Power Mode, with text at 200%, and after 10 minutes of use (when the phone is warm).
- **Blur:** at most two blurred surfaces at once, all small: the tab bar or nav bar, plus a sheet header. No full-page blur, and no animated blur.
- **View transitions:** at most one named shared element, plus the page.
- **Live walk:** at most one route redraw a second, and no map pictures.
- **3D demo:** pauses when it's off screen or the app is hidden.
- **Fallback:** anything over budget on the device falls back to its RM version.

## 8. Preferences in one table

| Preference | Effect |
| --- | --- |
| Reduce Motion (the system setting, or in-app) | Every M-number's RM line. Safety is already immediate |
| Reduce Transparency (in-app only, because Safari doesn't report the system setting; also `prefers-reduced-transparency` where a browser supports it) | Glass becomes solid everywhere |
| Increase Contrast (`prefers-contrast: more`) | Glass becomes solid with a 1 px border, secondary text uses the body colour, and the tab selection gets an outline |
| Large text, up to 200% | Layouts reflow and tiles go to one column. Motion distances stay in px, so they don't grow with the text |
