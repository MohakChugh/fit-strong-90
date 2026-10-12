# Shell and design system bug hunt

Reviewed on 2026-10-08 against [BUILD-BRIEF.md](BUILD-BRIEF.md) and [BOARD.md](BOARD.md), especially D4, D12, D24 and D31. Targets are the owner's specified 430×932 installed iPhone PWA, 320×568, landscape and desktop, in light and dark themes.

The serious failures are a line chart turning invalid values into plotted readings, rejected lazy imports removing the UI, inaccessible clickable rows, and a storage failure being routed through the first-run gate. The persistent tab bar does survive an ordinary pending tab import. The nested React Router structure itself is valid.

This is a source review with read-only Node probes, not an iPhone browser certification. I read all thirteen requested source files, the complete stylesheet, the supporting HTML entry point, theme hooks, area route files, sheet wrapper and relevant installed library implementations. Installed versions were React 19.2.4, React Router 7.13.2, Base UI 1.3.0 and Tailwind CSS 4.2.2. The thirteen requested files remained unchanged through the probes.

For component probes I transpiled the actual TypeScript in memory and rendered with React's server renderer. Chart layout hooks were substituted with a fixed 288px width and inert effects, so these probes verify emitted markup and numerical behaviour, not layout, browser focus or animation. Router probes used the real React Router with `MemoryRouter`; session and live-walk components were placeholders used only to check routing boundaries. No owner's browser record was opened. No code, tests or existing documents were modified.

Fresh shell and Node REPL launches failed before execution with `sandbox-exec: sandbox_apply: Operation not permitted`. I requested no escalation. File reads and probes used an already-running Node process and created no scratch files. No build, development server, browser launch or screenshot capture was attempted. Checks requiring a browser or device are listed separately below.

## Finding index

| ID | Severity | Finding |
|---|---|---|
| F01 | broken | Invalid line-chart values become plotted readings |
| F02 | broken | Invalid dimensions reach SVG attributes |
| F03 | broken | Domain calculation can throw or overflow on accepted numeric inputs |
| F04 | polish | An all-zero bar series gets a negative axis |
| F05 | polish | A year of bars overlaps and extends outside its plot |
| F06 | accessibility | `Row` with only `onClick` remains a non-focusable div |
| F07 | broken | A button row implicitly submits its surrounding form |
| F08 | accessibility | Compact and semantic screen titles are both exposed |
| F09 | accessibility | `Stat` communicates caution and stop through colour to sighted users |
| F10 | accessibility | Several text colour combinations fail contrast |
| F11 | accessibility | Navigation has no focus or scroll handoff |
| F12 | accessibility | Welcome has no main landmark |
| F13 | polish | The apparent back control pushes a fixed parent |
| F14 | broken | `viewTransition` does not run under the installed router setup |
| F15 | broken | Unmatched child addresses render an empty shell |
| F16 | polish | Walk setup has no selected tab |
| F17 | broken | A rejected lazy import escapes every Suspense boundary |
| F18 | wrong on iOS | Large-title collapse ignores the top safe area |
| F19 | wrong on iOS | A landscape sheet's close control ignores the side safe area |
| F20 | wrong on iOS | The sticky storage banner covers the sticky navigation header |
| F21 | polish | Dark launches can paint light before theme effects run |
| F22 | broken | Unavailable storage is mistaken for an incomplete first run |
| F23 | polish | The over-goal ring is clipped and its new lap snaps into place |
| F24 | polish | A pending tab's fallback adds avoidable scrolling |
| F25 | polish | A chart's small-frame fallback is invisible to sighted users |

## Findings

### F01. Invalid line-chart values become plotted readings

**Severity:** broken. **Source:** `Line` at [Chart.tsx:209](../../src/components/hig/Chart.tsx#L209), `yScale` at [Chart.tsx:140](../../src/components/hig/Chart.tsx#L140), and `clamp` at [scale.ts:37](../../src/components/hig/scale.ts#L37).

**Trigger and result:** Render values `[100, NaN, 110]` or `[100, Infinity, 110]`, with width 288, height 180 and no reference band. Both probes emitted `d="M36 122L159 8L282 46"`. The invalid middle value becomes a real point at the top of the plot, and the line connects through it. The table prints `NaN mg/dL` or `Infinity mg/dL`. With `[100, null, 110]`, the path is empty and the two isolated readings get dots, which is correct.

`segments` correctly rejects non-finite coordinates, but `Line` calls it after `yScale` has converted the invalid number to the finite lower pixel bound. An invalid target has the same conversion problem in `TargetLine` at [Chart.tsx:188](../../src/components/hig/Chart.tsx#L188).

**Fix:** Check the original reading before scaling. Invalid values must break the line, and the table should identify the invalid entry. Validate reference values before drawing them. Keep an invalid record distinguishable from a day on which nothing was entered. The isolated `segments` test at [scale.test.ts:162](../../src/components/hig/scale.test.ts#L162) does not exercise this composition.

### F02. Invalid dimensions reach SVG attributes

**Severity:** broken. **Source:** ring geometry at [Ring.tsx:34](../../src/components/hig/Ring.tsx#L34), its SVG at [Ring.tsx:64](../../src/components/hig/Ring.tsx#L64), and `plotOf` at [Chart.tsx:129](../../src/components/hig/Chart.tsx#L129).

**Trigger and result:** `Ring` with `size={NaN}` emitted `width="NaN"`, `viewBox="0 0 NaN NaN"`, `r="NaN"` and a `NaN` dash offset. React also reported invalid numeric attributes. `LineChart` with `height={Infinity}` emitted `height="Infinity"` and `viewBox="0 0 288 Infinity"`. In `plotOf`, comparing a non-finite calculated height with `MIN_PLOT` does not reject it. A finite ring size of 1 also gives a negative radius because the minimum stroke is 4.

**Fix:** Validate finite, positive frame dimensions before constructing geometry. Give the ring a minimum usable diameter and reserve room for its widest stroke. For invalid chart dimensions, render a visible error or data fallback instead of invalid SVG. These are primitive boundary failures demonstrated by typed `number` inputs; no current screen call site was shown to generate those inputs.

### F03. Domain calculation can throw or overflow on accepted numeric inputs

**Severity:** broken. **Source:** `niceDomain` at [scale.ts:105](../../src/components/hig/scale.ts#L105) and padding arithmetic at [scale.ts:116](../../src/components/hig/scale.ts#L116).

**Trigger and result:** Calling `niceDomain(Array.from({ length: 200000 }, (_, i) => i % 500))` threw `RangeError: Maximum call stack size exceeded` in the Node probe. Spreading the array into `Math.min` and `Math.max` exceeds the runtime's argument limit. `niceDomain([Number.MAX_VALUE])` returned `{ min: -Infinity, max: Infinity, step: 1 }`, even though the input passed its finite-value filter.

**Fix:** Find bounds in an iteration and check that expansion, span, padding and final bounds remain finite. Define chart input limits and any display reduction explicitly, preserving gaps and extrema. The ordinary chart API describes daily slots, so 200,000 points is a stress or corrupt-input case, not a demonstrated normal lifetime chart. The helper nevertheless accepts it without a boundary or a safe result.

### F04. An all-zero bar series gets a negative axis

**Severity:** polish. **Source:** the flat-series branch of `niceDomain` at [scale.ts:108](../../src/components/hig/scale.ts#L108).

**Trigger and result:** `niceDomain([0, 0, 0], { zeroBased: true })` returned `{ min: -2, max: 2, step: 1 }`, with ticks `[-2, -1, 0, 1, 2]`. The flat-series expansion subtracts room from zero, and `Math.min(0, low)` retains that negative lower bound. A recorded zero therefore sits halfway up an axis labelled with negative steps or minutes.

**Fix:** For an all-zero, non-negative bar series, keep the minimum at zero and expand only the upper bound. Preserve support for genuinely signed data. This does not invent a positive reading, but contradicts the non-negative daily-total axis and is absent from the zero-baseline test at [scale.test.ts:85](../../src/components/hig/scale.test.ts#L85).

### F05. A year of bars overlaps and extends outside its plot

**Severity:** polish. **Source:** `bands` at [scale.ts:209](../../src/components/hig/scale.ts#L209), consumed at [Chart.tsx:245](../../src/components/hig/Chart.tsx#L245).

**Trigger and result:** With 365 daily slots in a 246px plot, each slot is approximately 0.674px, but every bar is forced to at least 1px. The first bar starts at `-0.1630136986`; the last finishes at `246.1630136986`. Adjacent bars overlap. There is no plot clip path. The 246px fixture is a 288px chart minus the existing 42px axis gutters, as on a 320px screen with 16px content gutters.

**Fix:** Permit subpixel bars no wider than their slots, or choose an explicitly labelled display range or grouping that fits. Clip drawing to the plot and retain the complete data table. The existing inside-plot test covers up to 90 slots at [scale.test.ts:212](../../src/components/hig/scale.test.ts#L212); its separate 365-slot test checks only minimum bar width.

### F06. `Row` with only `onClick` remains a non-focusable div

**Severity:** accessibility. **Source:** `Row` at [List.tsx:55](../../src/components/hig/List.tsx#L55), especially tag selection at [List.tsx:58](../../src/components/hig/List.tsx#L58).

**Trigger and result:** `<Row label="Units" onClick={handler} />` rendered a `<div>` with no role or tab index in the markup probe. It has a pointer click handler in the client but no button keyboard activation. This is the exact usage promised by the comment at line 51.

**Fix:** Select a native button when `onClick` is supplied without `as`, with `type="button"` by default, or make `as="button"` mandatory in the API and correct the documentation. A read-only row should stay a div; a navigation row should be a real link.

### F07. A button row implicitly submits its surrounding form

**Severity:** broken. **Source:** the spread props in `Row` at [List.tsx:61](../../src/components/hig/List.tsx#L61).

**Trigger and result:** Put `<Row as="button" label="Choose unit" onClick={openUnitPicker} />` inside a sheet's form with an `onSubmit` save handler. The probe emitted a `<button>` without a `type`. Its HTML default is submit, so choosing a unit also submits the form unless the caller separately prevents it.

**Fix:** Default native button rows to `type="button"`, while allowing an explicit `type="submit"` to override it. This follows HTML behaviour and does not require WebKit-specific inference.

### F08. Compact and semantic screen titles are both exposed

**Severity:** accessibility. **Source:** [Screen.tsx:64](../../src/components/hig/Screen.tsx#L64), with the headings at [Screen.tsx:77](../../src/components/hig/Screen.tsx#L77) and [Screen.tsx:81](../../src/components/hig/Screen.tsx#L81).

**Trigger and result:** Render `Screen` with `inline` and title `Glucose`, or scroll a large-title screen until it collapses. The compact span then has `aria-hidden="false"`, while the `h1` is still exposed. The inline markup probe contained both the accessible compact text and an accessible `sr-only` heading. Scrolling the large heading away does not remove it from the accessibility tree.

**Fix:** Keep the compact visual duplicate `aria-hidden` in every state. Retain one semantic `h1`, including on inline task screens.

### F09. `Stat` communicates caution and stop through colour to sighted users

**Severity:** accessibility. **Source:** tone words at [Stat.tsx:8](../../src/components/hig/Stat.tsx#L8), rendered at [Stat.tsx:48](../../src/components/hig/Stat.tsx#L48).

**Trigger and result:** Render the same reading with `tone="default"` and `tone="stop"`. Apart from the number's colour, the visible text is identical. `Stop.` and `Caution.` are `sr-only`. A sighted person who cannot distinguish the colours receives no visible status word.

**Fix:** Show the status word, or a labelled status symbol, alongside the figure. Screen-reader text alone does not satisfy the brief's requirement that caution and stop have words. Avoid making a timer announce every tick as a substitute for a clear visible status.

### F10. Several text colour combinations fail contrast

**Severity:** accessibility. **Source:** foundation tokens at [index.css:424](../../src/index.css#L424) and [index.css:435](../../src/index.css#L435), light muted text at [index.css:63](../../src/index.css#L63), and banner text selection at [StorageBanner.tsx:19](../../src/components/hig/StorageBanner.tsx#L19).

**Trigger and result:** In light mode, read a 17px `text-tint` back link or a 13px muted caption on the grouped page. In dark mode, trigger a failed write and read the error banner's 15px white text on `--stop`. These combinations fail the normal-text 4.5:1 threshold. Light `text-caution` on the grouped page also falls below the 3:1 large-text threshold, including when used for a 34px `Stat`.

The probe converted CSS OKLCH to linear sRGB and calculated WCAG relative luminance and contrast. Some light tokens lie outside sRGB. The second light column shows simple sRGB component clipping, not a claim about WebKit's exact gamut-mapping algorithm. The robust failures below remain failures under either calculation. Ratios are shown with enough precision to avoid treating a rounded `4.50` as a pass.

| Text / background | Light, original colour luminance | Light, sRGB component clipping | Dark | Assessment |
|---|---|---|---|---|
| `--tint` / `--grouped-bg` | 4.209449 | 4.167594 | 8.971454 | Light fails for normal text; icons and strokes have a different 3:1 requirement |
| `--on-tint` / `--tint` | 4.499901 | 4.455157 | 8.635537 | Light is on the boundary before mapping and fails with component clipping; needs a safer margin and renderer verification |
| Black / `--caution` | 7.049888 | 7.076204 | 10.271421 | Passes in both themes; keep the caution banner's black text |
| White / `--stop` | 5.409203 | 5.409203 | 3.142718 | Dark error-banner text fails |
| `--caution` / `--grouped-bg` | 2.707682 | 2.697612 | 9.681138 | Light fails even for large text |
| Muted text / `--grouped-bg` | 4.301624 | 4.301624 | 7.632524 | Light captions and inactive tab labels fail |
| Muted text / `--grouped-card` | 4.732296 | 4.732296 | 6.907687 | Passes on opaque cards |

**Fix:** Adjust the light text tokens and the dark error banner's foreground or background, then compute the actual rendered combinations again. Keep one teal accent under D12. Use text-safe caution styling rather than assuming that the caution fill is also suitable ink. Check translucent header and tab-bar surfaces against their actual composited backgrounds. Contrast criteria and formula: [WCAG 2.2, Contrast (Minimum)](https://www.w3.org/TR/WCAG22/#contrast-minimum) and [relative luminance](https://www.w3.org/TR/WCAG22/#dfn-relative-luminance).

### F11. Navigation has no focus or scroll handoff

**Severity:** accessibility. **Source:** shell outlet at [AppShell.tsx:13](../../src/components/hig/AppShell.tsx#L13), headings at [Screen.tsx:77](../../src/components/hig/Screen.tsx#L77), tab links at [TabBar.tsx:37](../../src/components/hig/TabBar.tsx#L37), and the router at [main.tsx:28](../../src/main.tsx#L28).

**Trigger and result:** In a fixture with long Guide and Track screens, scroll Guide down, focus the Track tab and activate it with Enter. The tab bar remains mounted, so focus remains in the navigation after the new content replaces the old. The new heading is not a focus destination. There is also no shell scroll reset or restoration. Hash-history navigation uses `history.pushState`, which itself does not reset document scroll. The next long screen can open at the old offset.

A search of `src` found no route focus manager, `ScrollRestoration`, `window.scrollTo` or `document.title` update. The document title stays the value in [index.html:15](../../index.html#L15). The current area screens are stubs, so the long-content trigger is a primitive integration fixture, not a claim that those stubs already contain long lists.

**Fix:** Coordinate focus and scroll after committed navigation. Give the destination heading or main an appropriate programmatic focus target, announce the screen through its title, reset on a new push and restore a saved position on an internal back action. Do not move focus for unrelated store updates, and do not override a newly opened sheet's focus. Exact VoiceOver announcements need a device check.

### F12. Welcome has no main landmark

**Severity:** accessibility. **Source:** the first-run route at [routes.tsx:48](../../src/routes.tsx#L48), `Screen`'s outer div at [Screen.tsx:44](../../src/components/hig/Screen.tsx#L44), and the current Welcome element at [welcome/routes.tsx:7](../../src/screens/welcome/routes.tsx#L7).

**Trigger and result:** Load `/welcome` with `onboarded=false`. The loaded router probe produced a Welcome `h1`, zero `<main>` elements and zero navigation elements. Omitting the tab bar is intentional; omitting the main landmark is not necessary to do that. Only `AppShell` currently supplies one.

**Fix:** Give routes outside the tab shell a task or onboarding frame with a main landmark. Avoid changing every `Screen` into a main, which would create nested mains inside `AppShell`. The session and live-walk components were routing placeholders in the probes, so this finding does not assert their internal landmark structure.

### F13. The apparent back control pushes a fixed parent

**Severity:** polish. **Source:** [Screen.tsx:53](../../src/components/hig/Screen.tsx#L53).

**Trigger and result:** With internal history `/today`, `/track`, `/track/glucose`, render `back={{ to: '/track', label: 'Track' }}` and activate it. The link pushes another `/track` entry. The next browser back returns to `/track/glucose`. It also discards a previous parent's query string or scroll state unless the caller manually puts that state in `back.to`.

**Fix:** Use an internal stack pop when the app recorded the originating screen, with an explicit parent fallback for direct links and launches. Replace rather than add a redundant entry when using that fallback. The existing behaviour is reasonable as an explicit parent or breadcrumb link; it does not implement the navigation-controller behaviour claimed by the comment, and should not be presented as an unconditional stack back action.

### F14. `viewTransition` does not run under the installed router setup

**Severity:** broken. **Source:** `HashRouter` at [main.tsx:28](../../src/main.tsx#L28), tab link option at [TabBar.tsx:39](../../src/components/hig/TabBar.tsx#L39), back link option at [Screen.tsx:55](../../src/components/hig/Screen.tsx#L55), and You link option at [AppShell.tsx:31](../../src/components/hig/AppShell.tsx#L31).

**Trigger and result:** On a browser supporting `document.startViewTransition`, tap Track or You. The declarative `HashRouter` uses ordinary history navigation. In installed React Router 7.13.2, the view-transition lifecycle belongs to `RouterProvider`; this history path does not call it. `NavLink` also only reads view-transition state when a data-router state context exists.

This follows the installed implementation, including `HashRouter` and `useLinkClickHandler` in `node_modules/react-router/dist/development/chunk-HPFFRPKK.js` at lines 309 and 656, and the history `push` in `chunk-GO74ODU3.js` at line 295. Consequently, the `app-nav` CSS cannot currently be credited with preventing a native transition flicker; no native transition is being started.

**Fix:** Use a data router and `RouterProvider` with a compatible route configuration, or deliberately implement a feature-detected transition mechanism around this router. Preserve instant navigation on unsupported browsers. After activating transitions, verify the named navigation layer and reduced-motion styling on WebKit.

### F15. Unmatched child addresses render an empty shell

**Severity:** broken. **Source:** area wildcard at [routes.tsx:63](../../src/routes.tsx#L63), top-level fallback at [routes.tsx:73](../../src/routes.tsx#L73), and current child routes at [move/routes.tsx:12](../../src/screens/move/routes.tsx#L12).

**Trigger and result:** Load `/move/not-a-screen` after the Move chunk resolves. The probe returned one main, one tab bar, no `h1` and no pending fallback. The parent `/move/*` already matches, so the top-level catch-all never gets a chance to redirect. The descendant `Routes` has no matching element.

The present stub also makes the legacy `/plan` redirect land at an empty `/move/plan`; that destination's screen is unfinished, so the general missing child fallback is the durable shell finding.

**Fix:** Require each area's descendant routes to handle `*`, with a visible unavailable-page screen or a deliberate redirect to that area's root. Keep the outer catch-all as well. The nested route arrangement is valid; the missing fallback is the failure.

### F16. Walk setup has no selected tab

**Severity:** polish. **Source:** Walk's separate branch at [routes.tsx:64](../../src/routes.tsx#L64) and active-link selection at [TabBar.tsx:38](../../src/components/hig/TabBar.tsx#L38).

**Trigger and result:** Open `/walk`, which is inside `AppShell`. The real `NavLink` markup probe had zero `aria-current` attributes. `/move` had one. Walk is a Move activity, but `/walk` is not a descendant URL of `/move`.

**Fix:** Associate Walk setup with the Move destination when selecting and announcing the current tab, or place its setup address under the Move route. The live walk should continue outside the tab shell. You is a separate title-area destination under D4, so an unselected tab while viewing You is not the same bug.

### F17. A rejected lazy import escapes every Suspense boundary

**Severity:** broken. **Source:** the outer boundary at [App.tsx:32](../../src/App.tsx#L32), the inner boundary at [AppShell.tsx:14](../../src/components/hig/AppShell.tsx#L14), lazy imports at [routes.tsx:8](../../src/routes.tsx#L8), and reload throttling at [main.tsx:12](../../src/main.tsx#L12).

**Trigger and result:** A tab's chunk fails while offline or after a deployment, with `fit-reload-at` already set less than 10 seconds ago. The preload handler returns without reloading. The import rejects; Suspense handles pending promises, not the resulting render error. There is no app or route error boundary. React can therefore unmount the root, including the supposedly persistent navigation and storage notice.

**Fix:** Add a visible error boundary with a recovery action, including for chunk failures that the reload handler deliberately does not recover. Keep the bounded reload behaviour, but make the throttled or repeatedly failing case operable. Test a rejected import separately from a delayed import; the latter already works.

### F18. Large-title collapse ignores the top safe area

**Severity:** wrong on iOS. **Source:** observer configuration at [Screen.tsx:37](../../src/components/hig/Screen.tsx#L37), header inset at [Screen.tsx:46](../../src/components/hig/Screen.tsx#L46), and `.pt-safe` at [index.css:175](../../src/index.css#L175).

**Trigger and result:** On a fixture reporting a 47px top safe area, the sticky bar occludes through y=91, but the observer removes only the first 44px of the viewport. A sentinel at y=60 is already behind the header while still intersecting the observer root. The compact title remains hidden after the large title has gone behind the bar. This is geometry from the source, not a measured claim that this specific device reports 47px.

**Fix:** Derive the observer boundary from the actual sticky header's occluding bottom, including safe-area and any banner offset. Recreate or update it on rotation or inset changes. The sentinel's existing 16px separation from the heading is an additional intentional timing choice; account for it when defining the handoff rather than assuming the sentinel is the heading's last pixel.

### F19. A landscape sheet's close control ignores the side safe area

**Severity:** wrong on iOS. **Source:** sheet header at [Sheet.tsx:80](../../src/components/hig/Sheet.tsx#L80), Close placement at [Sheet.tsx:87](../../src/components/hig/Sheet.tsx#L87), and body-only safe padding at [Sheet.tsx:100](../../src/components/hig/Sheet.tsx#L100).

**Trigger and result:** Open a medium sheet in a 932×430 landscape fixture with the notch on the right and a 47px right inset. Close remains only 8px from the viewport edge. The body respects the inset; the title and Close bar do not. The medium sheet's header is near the vertical middle of that landscape viewport, where the notch is, so the actionable control can occupy the cutout region.

**Fix:** Apply horizontal safe-area clearance to the header and position Close inside `max(normal gutter, safe-area inset)`. Preserve its 44px height. This is a source geometry defect; actual inset values and tap visibility in both landscape orientations still need device verification.

### F20. The sticky storage banner covers the sticky navigation header

**Severity:** wrong on iOS. **Source:** [StorageBanner.tsx:18](../../src/components/hig/StorageBanner.tsx#L18), [Screen.tsx:46](../../src/components/hig/Screen.tsx#L46), and their sibling placement at [App.tsx:31](../../src/App.tsx#L31).

**Trigger and result:** Cause a write failure on a long pushed screen, then scroll far enough for both sticky elements to reach their top constraint. Both use `top: 0`. The banner has z-index 50; the navigation header has 30. The banner covers Back, the compact title and any trailing action where their rectangles overlap. Safe-area padding is also applied independently by both.

**Fix:** Give the banner and navigation header a shared layout and one safe-area owner, or offset the header by the banner's measured height. Use the resulting occlusion height for F18 and focus scroll margins. This follows CSS sticky positioning and stacking order; the size of the overlap depends on the notice text, width and text enlargement.

### F21. Dark launches can paint light before theme effects run

**Severity:** polish. **Source:** default light tokens at [index.css:51](../../src/index.css#L51), theme application at [App.tsx:16](../../src/App.tsx#L16) and [useTheme.ts:22](../../src/hooks/useTheme.ts#L22), and the HTML entry point at [index.html:2](../../index.html#L2).

**Trigger and result:** Set the saved theme to dark, then cold-load with JavaScript delayed. The HTML has no dark class and no synchronous theme bootstrap. The initial canvas and CSS use the light defaults before React runs. Reading the theme synchronously in a state initializer does not apply the class before the HTML's first paint; both class applications are effects.

**Fix:** Apply the small theme flag, with a guarded system-preference fallback, before the first styled paint. Keep IndexedDB authoritative after boot. The duplicate effects agree with each other and the hook already listens for system changes; the failure is the earlier paint, not a demonstrated disagreement between those effects.

### F22. Unavailable storage is mistaken for an incomplete first run

**Severity:** broken. **Source:** the loading-only guard at [App.tsx:27](../../src/App.tsx#L27), onboarding argument at [App.tsx:33](../../src/App.tsx#L33), unavailable boot publication at [useStore.ts:169](../../src/store/useStore.ts#L169), first-run redirect at [routes.tsx:49](../../src/routes.tsx#L49), and notice copy at [useStore.ts:868](../../src/store/useStore.ts#L868).

**Trigger and result:** An existing installed user's database fails to open before its settings can be read. State changes to `unavailable` while settings still contain the default `onboardingComplete=false`. App proceeds to normal routing and sends `/today` to `/welcome`, treating unknown persisted settings as proof of a new user. The unavailable-state render probe showed the warning plus Welcome. There is no retry control in the banner, and `start` caches the completed failed boot promise at [useStore.ts:148](../../src/store/useStore.ts#L148).

The notice also promises that adding to the Home Screen fixes storage. That is false for an already installed app, a blocked database, a failed read or a storage implementation error. This review does not infer that all current Safari private sessions lack IndexedDB.

**Fix:** Handle unavailable boot explicitly, with accurate failure information and a viable retry or reload action. Enter onboarding only after successfully determining that it is incomplete. If temporary use is offered, label it deliberately rather than passing it through the ordinary first-run gate. Qualify installation advice by the actual cause.

### F23. The over-goal ring is clipped and its new lap snaps into place

**Severity:** polish. **Source:** geometry at [Ring.tsx:34](../../src/components/hig/Ring.tsx#L34), conditional lap at [Ring.tsx:76](../../src/components/hig/Ring.tsx#L76), and wider backing arc at [Ring.tsx:82](../../src/components/hig/Ring.tsx#L82).

**Trigger and result:** With the default size 80 and value above the goal, the radius is 35.6 and the lap's backing stroke is 12.8 wide. Its outer radius is 42 inside a viewport radius of 40, putting 2px of paint outside each relevant edge. The embedded SVG's default clipping cuts that paint. This is SVG geometry and default overflow reasoning, not an inspected iPhone image.

When value crosses from 19 to 22 with goal 20, the lap circles are newly mounted with their final dash offsets. A CSS transition cannot interpolate from a prior zero offset on elements that did not exist, so the lap appears immediately while the existing primary arc can transition.

**Fix:** Reserve geometry for the widest possible stroke. Keep the lap's transitionable elements mounted, with zero lap and appropriate visibility when below goal. Under reduced motion keep the immediate update; that path is already correct. Do not alter the user's chosen weekly goal to avoid the over-goal state.

### F24. A pending tab's fallback adds avoidable scrolling

**Severity:** polish. **Source:** bottom padding and fallback at [AppShell.tsx:13](../../src/components/hig/AppShell.tsx#L13).

**Trigger and result:** Open an uncached tab on a slow connection at a viewport height H. The fallback itself is `min-height: 100dvh`, inside a main with an additional `49px + safe-area-inset-bottom` padding. Main's outer height is therefore at least H plus the tab-bar clearance, although the blank fallback only needs the available content space. In a fixture with H=932 and bottom inset 34, that is at least 1015px. This is CSS box arithmetic; scrolling was not exercised in a browser.

**Fix:** Let the loading body fill the shell's remaining content space, including any banner, rather than adding a complete viewport inside a padded main. Keep the tab bar mounted. The desktop branch with `lg:pb-0` does not add that bottom clearance.

### F25. A chart's small-frame fallback is invisible to sighted users

**Severity:** polish. **Source:** frame rejection at [Chart.tsx:132](../../src/components/hig/Chart.tsx#L132) and permanently hidden table at [Chart.tsx:310](../../src/components/hig/Chart.tsx#L310).

**Trigger and result:** Render a line chart in an 89px-wide frame. After the 42px axis gutters, the plot is below `MIN_PLOT=48`, so SVG is omitted. The probe emitted only a `sr-only` table containing the actual 110 mg/dL reading. The visible chart area is empty, contrary to the comment that the table stands alone below the minimum frame size. A too-short frame behaves similarly.

**Fix:** Make the table or a clear data fallback visible when a useful plot cannot be drawn. Preserve the hidden table alongside a normal plot. A standard full-width 320px screen has more room than this trigger; this is a primitive narrow-container boundary, not a claim that all 320px charts disappear.

## Checked and correct

- **Pending imports preserve navigation.** The first Move render had a busy fallback inside main and a complete four-link nav. `AppShell`'s Suspense boundary surrounds only `Outlet`. App's outer boundary is appropriate for onboarding and tasks outside the shell, where no tab bar is intended.
- **Nested routes work.** The pathless shell layout, parent `/area/*` routes and descendant index `Routes` produced the expected root headings after their imports resolved. Their use is supported by React Router v7. F15 concerns unmatched children, not the composition pattern.
- **Legacy redirects retain router queries for an onboarded user.** `Redirect` uses `useLocation().search` and appends it before a replacing navigation. `/dashboard?checkin=1` becomes `/today?checkin=1`. Under `HashRouter`, this is the query inside the route fragment, such as `#/dashboard?checkin=1`. The first-run gate deliberately does not preserve that destination, and anchors are not included by `Redirect`.
- **Core semantics and target sizes are sound when used explicitly.** `Row as={Link}` rendered an anchor with its `href`; ordinary rows rendered divs. Rows have a 52px minimum height, You is 44×44, back controls have 44px minima, phone tabs are 49px high and 80px wide at 320px, and desktop tabs are 44px high at the default 16px root font. The nav is labelled Main and `NavLink` supplies `aria-current` on matching destinations.
- **The primary content and tab bar use horizontal and bottom insets.** `Screen` content uses the larger of a 16px gutter and side inset. The phone tab bar adds bottom safe padding; main reserves the same 49px plus bottom inset. Main has no intermediate overflow scroller, so the current sticky headers and default viewport observer share the document scroll root. F18 and F20 concern their occlusion boundaries.
- **Base UI supplies modal focus handling.** The wrapper uses Base UI's modal default. Installed `DialogPopup.js` passes the supplied body ref to `FloatingFocusManager`, with modal focus management and return focus. `useDialogRoot.js` invokes scroll locking. These mechanisms exist; their exact iOS behaviour is not certified here.
- **The sheet body can scroll without shrinking its content column.** It uses a block scroller with `min-h-0`, and the flex column is inside it. The detent class also correctly replaces the base bottom popup's `h-auto` through `cn`. The React 19 context-provider shorthand is valid. A probe with the base parts replaced by simple containers confirmed that an open outer sheet rejects even a closed nested sheet with the intended error.
- **Missing finite readings break lines correctly.** Raw `segments` splits on null, undefined and non-finite coordinates; `linePath` produces separate subpaths. The composed chart correctly breaks for null and dots isolated readings. Bar charts omit missing and non-finite values, while a recorded zero gets a hairline. F01 is specific to scaling an invalid line value before testing it.
- **Ordinary scale cases are sensible.** Domain inclusion keeps valid reference bands and targets visible, a flat finite series avoids division by zero, ticks remove floating dust, and label thinning retains the newest slot. At a 246px plot width, 90 slots retain indices `[17, 35, 53, 71, 89]`. That spacing assumes the existing 44px label-width budget.
- **Chart data remains available to assistive technology.** SVG is hidden, the table has a caption and scoped row and column headings, and the table's `sr-only` wrapper contains its intrinsic width. Ring exposes one labelled image and hides its duplicate visible words.
- **Ring respects reduced motion and does not change the goal.** Its reduced-motion branch emitted no transition in the probe. The hook reads the initial preference and subscribes to changes. Displayed counts are not clipped to the goal; only the drawn fractions are bounded. Under D31, callers must still supply this week's recorded movement and the user's weekly goal. The current Today stub has no ring, so weekly aggregation was not verified.
- **Boot waits for the stored settings while loading.** App does not render routes before the loading state ends, avoiding the ordinary existing-user onboarding bounce. Calling `start` from the Strict Mode effect is idempotent. F22 is the different case in which the settings could not be read.
- **Wake Lock is not a shell boot dependency.** Session and live-walk addresses are outside the tab shell, and none of the audited shell primitives requires that API to render. This does not certify the individual modes' feature detection or reacquisition logic under D24.

## Needs a device check

These are concrete unverified checks, not additional confirmed findings. Use both installed PWA and Safari tab where the behaviour can differ. Record the OS version, `innerHeight`, `visualViewport.height`, `visualViewport.offsetTop`, computed safe insets and element rectangles instead of inferring them from the nominal device dimensions.

| Check | Source and concrete trigger | Required observation |
|---|---|---|
| Fixed tabs and the keyboard | [TabBar.tsx:30](../../src/components/hig/TabBar.tsx#L30) has a fixed bottom bar with no keyboard state. Focus a last-row text, decimal and date input at 430×932, 320×568 and in both landscape orientations. | Determine whether WebKit hides, moves or pans the bar while editing. The focused field, caret and relevant form action must remain reachable and uncovered. I did not establish that the bar rides up over inputs. |
| Sheet detents with the keyboard | [Sheet.tsx:24](../../src/components/hig/Sheet.tsx#L24) uses 55dvh and 92dvh with a 92dvh cap. Open each detent with a long form and focus its last input. | WebKit's usual keyboard model changes the visual viewport without making `dvh` a reliable keyboard-height measurement. For example, 92% of a 932px layout height is 857.44px, which does not fit a 600px visual viewport. Measure actual popup placement, focus panning and scroller height; Close and the final action must be reachable. If necessary, size and place the sheet against the actual visual viewport. |
| Status bar and full-height accounting | [index.html:7](../../index.html#L7) uses `viewport-fit=cover`; line 11 requests `black-translucent`. Cold-launch both app themes and rotate. | Verify visible time, signal and battery glyphs, safe header position and no doubled top subtraction or bottom gap. The fixed status-bar style and theme-colour meta do not follow the app's theme effects. Changing a meta tag after launch may differ from reinstalling. |
| Rubber-band gaps | Body uses `--background` at [index.css:157](../../src/index.css#L157), while the shell uses `--grouped-bg`. In light mode those are white and tinted grey. Pull past the root's top and bottom, with and without a storage banner. | Look for a white canvas strip or uncovered safe-area strip. `overscroll-behavior: contain` does not itself promise to suppress the local overscroll effect. Dark body and grouped backgrounds match; the light mismatch predicts a possible seam but its visibility was not observed. |
| 320px and 200% text | Exercise [List.tsx:75](../../src/components/hig/List.tsx#L75) with an icon, chevron and `140/90 mmHg`; [Stat.tsx:49](../../src/components/hig/Stat.tsx#L49) with `1:02:03`; Ring with a long count; and back labels with long words. | Row values cannot shrink and Stat's figure is one flex item. Check actual font metrics, wrapping and `scrollWidth <= clientWidth`, without shrinking essential text. Check the 16px `!important` input rule at [index.css:189](../../src/index.css#L189). |
| User zoom | [index.html:7](../../index.html#L7) explicitly requests `maximum-scale=1.0` and `user-scalable=no`. Try pinch zoom and the platform's text or page enlargement in the installed PWA. | Verify 200% readability. Modern Safari can override author zoom restrictions; I did not verify this installed configuration. Remove the author restrictions rather than depending on that override. |
| Chart labels and visible meaning | At 200% text, render five-digit y ticks, long dates, band and target labels in [Chart.tsx:173](../../src/components/hig/Chart.tsx#L173) and [Chart.tsx:264](../../src/components/hig/Chart.tsx#L264). | The left label anchor has only 30px before the SVG edge, and thinning assumes 44px labels. Inspect clipping and collisions. Units, reference names and chart title occur in the hidden table; verify that the finished screens also expose that meaning visibly. |
| ResizeObserver stability | [Chart.tsx:155](../../src/components/hig/Chart.tsx#L155) measures a rounded bounding rectangle. Put charts in fractional-width flex or grid columns, hide and reveal them, rotate, and resize while a parent press transform is active. | No ResizeObserver-loop errors, stable widths, no stale width after releasing the transform, and no horizontal scroll. Repeated identical scalar widths normally bail out; no self-sustaining loop was demonstrated in the current stretched block layout. |
| Sheet focus and scroll locking | Open a large sheet after scrolling the page, traverse every control, overscroll the sheet in both directions, focus an input, then close or use browser back. | Focus stays inside while open, returns to a still-present opener on ordinary close, and the page remains at the original scroll position. Base UI 1.3.0 uses overflow-based locking on iOS; its implementation explicitly notes trouble in Safari when browser chrome is collapsed. That note does not prove failure in the installed PWA. |
| Closing on navigation | [Sheet.tsx:43](../../src/components/hig/Sheet.tsx#L43) has no route-change listener. In a fixture with a persistent layout owner, keep `open=true` and navigate from a sheet to a child route. | It will not close merely because location changed; closure currently depends on the owner changing state or unmounting. Confirm every finished call site closes before pushing and releases focus and scroll lock. The current area stubs provide no such integration to certify. |
| Actual transitions and reduced motion | After F14 is fixed, navigate rapidly, go to a task outside the shell and back, rotate, and repeat with Reduce Motion enabled. Inspect [index.css:330](../../src/index.css#L330) and [index.css:384](../../src/index.css#L384). | No navigation flicker, stranded snapshots or rejected transition promises. The reduced-motion block explicitly disables root snapshots; named `app-nav` snapshot and group animations also need an explicit check because their suppression currently sits in the no-preference block. Ordinary element selectors do not establish coverage for every view-transition pseudo-element. |
| Blur cost and visual contrast | Scroll a dense chart, then open a sheet while the collapsed header and tab bar are visible. Test [Screen.tsx:49](../../src/components/hig/Screen.tsx#L49), [TabBar.tsx:30](../../src/components/hig/TabBar.tsx#L30) and [ui/sheet.tsx:29](../../src/components/ui/sheet.tsx#L29). | Inspect frame pacing and composited text contrast with all backdrop filters active. CSS alone does not prove a performance bug. Verify the out-of-sRGB light action colours in WebKit and on the secondary desktop display. |

The weekly ring's finished call site and each mode's Wake Lock failure path still need integration checks under D31 and D24. Those decisions cannot be certified from a generic ring or a routing placeholder.
