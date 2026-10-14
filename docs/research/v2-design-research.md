# Research: v2 design — Liquid Glass on the web, Apple Health patterns, motion, and older users

**Scope.** Design research for the v2 redesign of this local-only PWA (React 19 + Tailwind v4, installed to the iPhone Home Screen; primary device iPhone 13 Pro Max, also desktop). All sources were read on **2026-10-08**; the Sources list at the end repeats the date per source. Inline tags like [H-mat] point to that list.

**How sources were read.**
- Apple HIG and developer docs: their DocC JSON, so quotes are exact.
- WWDC: transcripts on the session pages, with timestamps.
- Apple Support: the iOS 27 iPhone and watchOS guides.
- Browser support: MDN browser-compat-data (BCD) `main` on GitHub.
- Also WebKit Bugzilla (REST), Safari release notes, W3C TRs, NN/g, and the GitHub/npm APIs for libraries.

**Unverified** marks anything I could not confirm at the source. All examples are synthetic.

**Context that changes the plan.**
- **iOS 27 is current.**
  - Safari 27 was released on 14 Sep 2026 [SRN27], and the iPhone 13 Pro Max runs iOS 27 [S-compat].
  - Liquid Glass is still Apple's design language. iOS 27 adds a user slider "from ultraclear to fully tinted" [S-new27].
  - The HIG Materials page has not changed since Sep 2025 [H-new].
- **The 13 Pro Max viewport is 428×926 CSS px**, "428x926 pt (1284x2778 px @3x)" [H-lay-arch]. 430×932 is the 14 Pro Max. Test at 375, 428 and 440 px.
- **1 cm on this phone ≈ 60 CSS px.** Derived: 458 ppi [S-13pm] ÷ 3 = 152.7 px per inch.
  - Apple's 44 pt minimum ≈ 7.3 mm.
  - WCAG's 24 px ≈ 4 mm.

---

## Decisions

| # | Topic | Decision | Evidence |
|---|---|---|---|
| 1a | **Where glass goes** | Glass goes only on the floating navigation/controls layer: the tab bar, one floating primary button, and the header of a transient sheet. Cards, lists, charts and text stay opaque. Never put glass on glass, and never show more than 2 glass surfaces at once. | "Don't use Liquid Glass in the content layer"; "Use Liquid Glass effects sparingly" [H-mat]. "always avoid glass on glass" [W219 13:24]. |
| 1b | **Recipe (light)** | `background: rgb(255 255 255 / .72)`; `backdrop-filter: blur(16px) saturate(180%)`; `border: 1px solid rgb(255 255 255 / .55)`; `box-shadow: inset 0 1px 0 rgb(255 255 255 / .6), 0 1px 2px rgb(0 0 0 / .08), 0 8px 24px rgb(0 0 0 / .12)`; capsule radius (`9999px`) near screen edges. | The values are my tuning, not Apple's. Apple publishes no material numbers apart from the 35% dimming layer for clear glass [H-mat]. Capsules near phone edges: [W356 5:48]. |
| 1c | **Recipe (dark)** | `background: rgb(28 28 30 / .72)`; same blur and saturation; `border: 1px solid rgb(255 255 255 / .14)`; `box-shadow: inset 0 1px 0 rgb(255 255 255 / .10), 0 8px 24px rgb(0 0 0 / .5)`. | Apple: "provide both light and dark colors to support Liquid Glass adaptivity" [H-col]. |
| 1d | **"Clear" variant** | Use it only over photos or video, and add `rgb(0 0 0 / .35)` behind it. We have no media backgrounds, so effectively never. | Clear only "over visually rich backgrounds"; "dark dimming layer of 35% opacity" [H-mat]. Regular and clear "should never be mixed" [W219 13:55]. |
| 1e | **Legibility rule** | Measure text contrast over the **worst-case backdrop**: white and black page content scrolled under the bar, not the resting state. Body text needs ≥4.5:1 against both, labels ≥3:1. If a combination fails, raise the fill opacity until it passes. | HIG minimums: up to 17 pt needs 4.5:1, 18 pt or bold needs 3:1 [H-acc]. The resting state "maintains clear legibility" [H-col]. |
| 1f | **Solid fallback** | Use a solid surface (`backdrop-filter: none`, opaque fill, 1px contrasting border) in four cases: (a) the in-app "See-through panels: Off" setting, (b) `prefers-reduced-transparency: reduce` (Chromium only), (c) `prefers-contrast: more`, (d) no `backdrop-filter` support. **Default the in-app setting to "Tinted"** (≈0.72–0.8 fill). | Safari does **not** support `prefers-reduced-transparency` [BCD], so iOS Reduce Transparency is invisible to us and the app must ask. Apple's Increase Contrast shows "predominantly black or white" with "a contrasting border" [W219 18:29]. |
| 1g | **No refraction** | No SVG `feDisplacementMap`, no WebGL/WebGPU glass, no glass library. Suggest lensing with a rim and a top highlight. The scroll edge effect is a gradient fade, not a second blur. | WebKit bug 245510 (still open 2026-09-06): Safari drops `backdrop-filter: url()`. On WebKit trunk the test case "crashes the GPU process" [WKB-245510]. "Accelerated filters (including backdrop-filter) can't use SVG filters" (WebKit engineer) [WKB-297770]. |
| 2a | **Glass during View Transitions** | Safari **turns backdrop blur off while a view transition runs**. A glass tab bar flashes un-blurred on every navigation. Keep the tab bar out of the transition: it already has its own `app-nav` name with `animation:none`. Make its fill opaque enough to look fine without blur (≥0.85), or set the bar to the solid style during the transition (`:active-view-transition`, Safari 18+). | WebKit 302256 (NEW, Nov 2025): "Backdrop filter not applied during view transitions (works in Chrome, broken in Firefox and WebKit)" [WKB-302256]. Also 262001: `-webkit-backdrop-filter` "disappears when element's width is changed with a transition". |
| 2b | **Same-document View Transitions** | Safe to rely on, as progressive enhancement. Supported since Safari 18, Chrome 111 and Firefox 144. `view-transition-class` and `types` need Safari 18.2, and `match-element` needs 18.4. Cross-document transitions (Safari 18.2, Chrome 126, not Firefox) are irrelevant: the app is a hash-router SPA. | [BCD]. Safari 26.2 fixed "incorrect clipping of `position: fixed` and `position: sticky` content during view transitions" [SRN26.2]. |
| 2c | **`linear()` easing** | Use it for springs: Safari 17.2, Chrome 113, Firefox 112. Ready-made tokens are in §4.1. | [BCD]; [chrome-linear]. |
| 2d | **`prefers-reduced-transparency`** | **Not supported in Safari or iOS.** Chrome 118 supports it; Firefox only behind a flag. Use it as a bonus, never as the only switch. | [BCD]; MDN lists the iOS setting, but Safari doesn't expose it [MDN-prt]. Safari release notes 18–27.2 never mention it [SRN]. |
| 2e | **`@starting-style`** | OK for sheet and toast entry: Safari 17.5, Chrome 117, Firefox 129. Known WebKit issues: it "transitions in but does not transition out" (275184), and Safari 26.4 fixed entries that "only applied on the first transition". Animate exits with a class plus a transition. | [BCD]; WebKit 275184; [SRN26.4]. |
| 2f | **Scroll-driven animations** | Available since Safari 26 (threaded since 26.4) and Chrome 115; Firefox only in preview. Use them only for decoration (e.g., header shadow fading in). **Do not shrink the tab bar on scroll**: it hides labels, and Apple makes shrinking opt-in. | [BCD]; [SRN26]; [SRN26.4]. "You can opt into this behavior" [D-adopt]; "Make sure the tab bar is visible" [H-tab]. |
| 2g | **`contrast-color()`** | Safari 26, Chrome 147, Firefox 146. It picks black or white only ("whichever one provides more contrast" [WK-26beta]). Fine for text on solid accent buttons; useless over glass, because the backdrop varies. | [BCD]; [WK-26beta]. |
| 3a | **SwiftUI spring defaults** | `.spring` = `spring(duration: 0.5, bounce: 0.0)`. `.smooth`, `.snappy` and `.bouncy` all default to `duration: 0.5`. Bounce values:<br>• `.smooth`: "no bounce".<br>• `.snappy`: "small amount of bounce" (≈0.15, Unverified).<br>• `.bouncy`: "higher amount of bounce" (≈0.3, Unverified). | Declarations and abstracts [D-spring]. WWDC23 calls 15% "doesn't feel very bouncy yet" and 30% "noticeable bounciness" [W23 21:03–21:13]. |
| 3b | **UIKit spring default** | `UIView.animate(springDuration: 0.5, bounce: 0.0, …)`. | Declaration [D-uikit-spring]. |
| 3c | **Conversion to physics** | Mass 1: `stiffness = (2π/duration)²` and `damping = 4π(1−bounce)/duration`, so damping ratio = 1 − bounce. Example: 0.5 s with bounce 0 → stiffness 157.9, damping 25.13. | Matches Apple's own example: `Spring(duration: 0.5, bounce: 0.3)` → `(1.0, 157.9, 17.6)` [D-spring]. The equation on the WWDC23 page is mistyped [W23]. |
| 3d | **Sheet, push and tab timing** | Apple publishes **no durations** for push, sheet or tab switches (Unverified; I found none). Use one family:<br>• Push and sheet: duration 0.4–0.5 s, bounce 0.<br>• Tab switch: a 0.2 s cross-fade, which the app already has.<br>• Release of a gesture with momentum: bounce ≤0.15. | Apple: start at bounce 0; add bounce only when "the gesture that's driving the motion itself has momentum". Music uses "100% damping" for tap and "80% damping" for swipe-dismiss [W18 36:21–37:42]. Stay cautious above bounce 0.4 [W23]. |
| 3e | **Reduced motion = replace, not delete** | Under Reduce Motion: cross-fade 150–200 ms instead of slides and zooms, no bounce, no parallax or z-depth, no animating into or out of blur. Keep progress and feedback visible. | HIG list: "Tightening animation springs to reduce bounce effects … Replacing transitions in x-, y-, and z-axes with fades to avoid motion … Avoiding animating into and out of blurs" [H-acc]. Glass under Reduce Motion "disables any elastic properties" [W219 18:35]. The app currently drops the transition entirely; switch it to a fade. |
| 4a | **Targets** | Primary tiles and buttons **≥60 px** tall (≈1 cm). Anything tappable ≥48 px, never <44. ≥12 px gap between bezeled controls. | NN/g: "at least 1cm × 1cm" [NNG-touch]. HIG: 44×44 pt; "about 12 points of padding" [H-acc]. WCAG 2.5.8: 24×24 (AA); 2.5.5: 44×44 (AAA) [WCAG22]. |
| 4b | **Text** | Body 17 px at the default size, scaled with iOS Text Size (keep `src/lib/textSize.ts`). Meaningful text never <13 px. No light weights. At large text sizes, tiles go from 2 columns to 1 column, with the label stacked over the value. | HIG: default 17 pt, minimum 11 pt; "avoid light font weights"; "Reduce the number of columns when the font size increases" [H-typ]. Mobile text "too small and lightly colored" for older adults [NNG-old]. |
| 4c | **Icons** | Every icon gets a visible text label, on tabs, tiles and buttons alike. | "include both an icon and a label" (Assistive Access) [W238 14:20]. COGA 4.2.7: icons "next to the content it relates to" [COGA]. HIG: "Include tab labels" [H-tab]. |
| 4d | **Gestures** | Every swipe or drag has a visible button: Back, Close, Delete, Move up/down. No swipe-up-to-end. | "if you use a swipe gesture to dismiss a view, also make a button available" [H-acc]. WCAG 2.5.1 and 2.5.7 [WCAG22]. Apple's own Fitness ends a workout with "Swipe up … then tap End Workout" [S-fitwo]; don't copy that. |
| 4e | **Undo and timeouts** | Routine deletes happen at once and offer **Undo that does not time out**: it stays until the next action. Irreversible actions (erase data) get **two confirmations** with a specific label ("Erase all"), not "OK". No timed UI. | HIG: "Minimize use of time-boxed interface elements"; confirm twice for hard-to-undo actions [H-acc]. "Avoid displaying alerts for common, undoable actions" [H-alert]. COGA 4.5.9: "Avoid timeouts" [COGA]. |
| 4f | **Choices per screen** | ≤5 main choices on a screen, one clear primary action at the top, plain words at about a 6th-grade reading level. | COGA 4.6.3: "five or less main choices on each screen" [COGA]. NN/g: 6th-grade text on the homepage; "plow" rather than scan [NNG-lit]. |
| 5a | **Home tiles (copy)** | Copy Health's **Pinned** pattern: a short list the person chooses, each card showing "how you're doing … that day", plus **Highlights** as sentences with small static charts and "Show All". | [S-104997]; [S-health]. Static mini charts need no gridlines [W22a 10:30]. |
| 5b | **Trends (copy)** | Period control D / W / M / Y (≤5 segments). Show the period **average** as the headline, then a one-line comparison with the previous period in words. Tap or drag anywhere in the plot to see a value. | Health shows "the average number of steps per day" [H-charts, image alt]. "D selected" [H-seg, image alt]. ≤5 segments on iPhone [H-seg]. Whole-plot hit target [H-charts]. Fitness compares the last 90 days with the last 365 [S-fitsum]. 6M is Unverified. |
| 5c | **Summary cards (copy)** | Card layout: category icon and name in the category colour, a large number with a small unit, and one comparison line in words. Every number gets context and plain words. | Charts need a descriptive headline, e.g. "Sales for the past 30 days are up 12%" [W22b 4:31]. COGA 4.4.13: alternatives to numbers [COGA]. |
| 5d | **Don't copy** | Don't copy:<br>• Activity rings, or any three-ring red/green/cyan look-alike.<br>• Hidden swipe gestures.<br>• Trends that need 180 days of data.<br>• Tab bars that shrink on scroll.<br>• Apple screenshots, the Health icon, or the term HealthKit. | "Never show Move, Exercise, and Stand progress in another ring-like element" [H-rings]. "It takes 180 days of activity to start your trends" [S-fitsum]. "Don't display Health app images or screenshots" [H-hk]. |

---

## 1. Apple Liquid Glass: what Apple says

### 1.1 What it is
- "a new digital meta-material that dynamically bends and shapes light", which "behaves and moves organically in a manner that feels more like a lightweight liquid" [W219 0:43–0:59].
- "Liquid Glass forms a distinct functional layer for controls and navigation elements — like tab bars and sidebars — that floats above the content layer" [H-mat].
- "blurs content behind it, reflects color and light of surrounding content, and reacts to touch and pointer interactions in real time" [D-custom].

### 1.2 Principles
| Principle | Apple (quote or close paraphrase) | Web translation |
|---|---|---|
| Lensing | "The primary way Liquid Glass visually defines itself is through something called Lensing"; it "dynamically bends, shapes, and concentrates light". Objects "materialize in and out by gradually modulating the light bending" rather than fading [W219 1:55–3:03]. | We can't refract on iOS (§2.1). Suggest it with a bright rim, a top highlight and a soft shadow. Entry and exit: fade plus a slight scale (0.96→1). |
| Regular vs clear | Regular "blurs and adjusts the luminosity of background content … Most system components use this variant". Clear "is highly translucent", for "components that float above media backgrounds" [H-mat]. "They should never be mixed" [W219 13:55]. | Use regular only. |
| Adaptivity | "each layer continuously adapts based on what's behind it". "As text scrolls underneath, shadows become more prominent". Small bars "flip from light to dark"; big surfaces "don't flip" [W219 6:27–7:29, 15:16–15:35]. "Liquid Glass appears more opaque in larger elements" [H-col]. | We can't sample the backdrop cheaply. Use a fixed fill high enough for the worst case (Decision 1e), and make larger glass more opaque. |
| Concentricity | "fixed shapes have a constant corner radius. Capsules use a radius that's half the height of the container. And concentric shapes calculate their radius by subtracting padding from the parent's." "For phone layouts, use a capsule with extra margin to create space near the screen edge." [W356 3:42–5:54] | Inner radius = outer radius − padding (e.g. card 24 / padding 16 → inner 8). Use capsules for the bar and for buttons near screen edges. |
| Floating tab bar | "A tab bar floats above content at the bottom of the screen". "Make sure the tab bar is visible when people navigate to different sections". "Include tab labels … Use single words whenever possible". "Use a tab bar to support navigation, not to provide actions." [H-tab] | 3–4 tabs, always labelled, never hidden. Inset 12–16 px from the edges plus `env(safe-area-inset-bottom)`. |
| Shrink on scroll | Opt-in: "configure the tab bar to minimize when a person scrolls down or up. The tab bar expands when a person scrolls in the opposite direction" [D-adopt]. The HIG frames it for bars with an accessory (MiniPlayer) [H-tab]. | Skip it for this audience (Decision 2f). |
| Scroll edge effect | "Scroll edge effects aren't decorative. They don't block or darken like overlays". "Only use a scroll edge effect when a scroll view is behind floating interface elements". "Apply one scroll edge effect per view." [H-scroll] | A 24–32 px gradient from the page background to transparent under the bar. |
| Sheets | "Sheets feature an increased corner radius, and half sheets are inset from the edge … When a half sheet expands to full height, it transitions to a more opaque appearance" [D-adopt]. Rules [H-sheet]:<br>• "Display only one sheet at a time".<br>• Pair Done with Cancel or Back.<br>• "Avoid showing all three buttons".<br>• Confirm before discarding unsaved changes on a swipe-dismiss.<br>• "Include a grabber". | The sheet body is solid; at most its header is glass. Modal tasks get a dimming layer [W356 7:43]. Always show a visible Close button. |
| Toolbars and grouping | "aim for a maximum of three" groups. "Keep actions with text labels separate". "Only specify one primary action, and put it on the trailing side". Keep a title "under 15 characters" [H-tool]. "hierarchy should be expressed through layout and grouping" [W356 8:55]. | One tinted primary per screen. Keep titles short. |
| Motion | "responds to interaction by instantly flexing and energizing with light". "the resting state stay[s] visually quiet, while it comes to life on touch" [W219 3:38–4:22]. | Press state: brighten the fill plus `scale(.97)`, on transform and opacity only. |

### 1.3 When not to use glass
- "Don't use Liquid Glass in the content layer". The exception is transient controls such as sliders and toggles while they're active [H-mat].
- "always avoid glass on glass". Instead, "use fills, transparency, and vibrancy for the top elements" [W219 13:24–13:44]. The docs say "avoid overcrowding or layering Liquid Glass elements on top of each other" [D-adopt].
- "In steady states, such as when an app first launches, avoid intersections between content and Liquid Glass" [W219 17:54].
- "Avoid tinting all your elements … If you want to imbue color into your app, do it in the content layer instead" [W219 17:29].

### 1.4 Accessibility behaviour
- **Native glass under each setting:** "Reduced Transparency, makes Liquid Glass frostier and obscures more of the content behind it. Increased contrast, makes elements predominantly black or white and highlights them with a contrasting border and Reduced Motion decreases the intensity of some effects and disables any elastic properties for the material." [W219 18:22–18:42]
- **iOS settings:**
  - Reduce Transparency makes "transparent backgrounds opaque by giving them a solid color" [S-colors].
  - In iOS 27, the Liquid Glass slider is disabled while Reduce Transparency or Increase Contrast is on [S-disp27].
  - **No web API exposes the slider** (Unverified; I found none).
- **Contrast:**
  - Accessibility Inspector applies WCAG AA: up to 17 pt needs 4.5:1, 18 pt needs 3:1, and bold needs 3:1.
  - "If your app doesn't provide this minimum contrast by default, ensure it at least provides a higher contrast color scheme when the system setting Increase Contrast is turned on" [H-acc].

### 1.5 Typography and colour
- **Typography is "bolder and left-aligned"** in key moments like alerts and onboarding [W356 2:52]. Section headers use title-style capitalization, not all caps [D-adopt]. Avoid Ultralight, Thin and Light [H-typ].
- **iOS text styles at the default (Large) size [H-typ]:**

  | Style | Size / leading (pt) | Weight |
  |---|---|---|
  | Large Title | 34/41 | Regular (Bold emphasized) |
  | Title 1 | 28/34 | Regular |
  | Title 2 | 22/28 | Regular |
  | Title 3 | 20/25 | Regular |
  | Headline | 17/22 | Semibold |
  | Body | 17/22 | Regular |
  | Callout | 16/21 | Regular |
  | Subhead | 15/20 | Regular |
  | Footnote | 13/18 | Regular |
  | Caption 1 | 12/16 | Regular |
  | Caption 2 | 11/13 | Regular |

  Body grows to 23 pt at xxxLarge, 28 at AX1 and 53 at AX5.
- **Colour on glass:**
  - It "has no inherent color".
  - "Apply color sparingly". "To emphasize primary actions, apply color to the background rather than to symbols or text". "Refrain from adding color to the background of multiple controls" [H-col].
- **iOS 26 system colours** (the HIG swatch values) and their contrast, which I computed:

  | Colour | Light | Increased contrast (light) | Contrast on white: default → IC |
  |---|---|---|---|
  | Blue | #0088FF | #1E6EF4 | 3.52 → **4.57** |
  | Green | #34C759 | #008932 | 2.22 → **4.54** |
  | Red | #FF383C | #E9152D | 3.57 → **4.56** |
  | Orange | #FF8D28 | #C55300 | 2.31 → **4.55** |
  | Teal | #00C3D0 | #008198 | 2.16 → **4.57** |

  Dark-mode defaults: blue #0091FF, green #30D158, red #FF4245, orange #FF9230.
  - **Implication:** use the IC-light colours for coloured text and icons on white. Keep the default colours for large fills.
  - The IC colours drop to about 4.1:1 on a light grey page (#F2F2F7, Unverified as Apple's value), so put coloured text on white cards.

---

## 2. Recreating Liquid Glass on the web

### 2.1 Techniques
| Technique | iOS Safari 27 | Chrome | Firefox | Cost | Use? |
|---|---|---|---|---|---|
| `backdrop-filter: blur() saturate()` | Yes: unprefixed since 18, prefixed since 9 | 76 | 103 | GPU; grows with area × radius; resampled whenever the content behind it moves | **Yes, ≤2 small surfaces** |
| Tint, rim and highlight: translucent fill, 1 px rgba border, inset `box-shadow` | Yes | Yes | Yes | Cheap | **Yes** |
| SVG refraction (`backdrop-filter: url(#feDisplacementMap)`) | **No** (bug 245510, open) | Yes | Partial / Unverified | High | **No** |
| `filter: url()` on the element itself (refracts its own content) | Works, but "`filter: url()` ignored when `backdrop-filter` applied" [WKB-297770] | Yes | Yes | Software path | No |
| WebGL/WebGPU page snapshot (html2canvas or a custom rasteriser) | Runs, but "Safari can be unstable when the liquid element(s) are more than 50% of the viewport" [liquidGL] | Yes | Yes | High; snapshot goes stale | No |
| Scroll edge effect as a gradient fade | Yes | Yes | Yes | Cheap | **Yes** |

### 2.2 Performance on iOS Safari: evidence and budget
- **web.dev:** "Caution: backdrop-filter may harm performance. Test it before deploying." [webdev-bdf]
- **WebKit 319187 (Jul 2026, iOS 26.4):** two large fixed elements with `filter: blur(100px/120px)` stalled the first render for about 20 s on iPhone. "Replacing the blurred elements with radial-gradient backgrounds also fixes the problem." [WKB-319187]
- **Safari 27:** "Fixed an extremely slow page load on iPhone caused by blur filters with large radii" [SRN27].
- **Safari 26.4:** "Improved drop-shadow and blur effects rendering performance" [SRN26.4].
- **Layers:** "every layer you create requires memory and management". "Stick to transform and opacity changes for your animations" [webdev-comp].
- **Apple's native guidance:** "Combine custom Liquid Glass effects to improve rendering performance" [D-adopt].
- **Budget.** This is my rule; no published number exists.
  - ≤2 glass surfaces visible at once, each ≤20% of the viewport.
  - Blur 12–20 px.
  - Never animate blur or `backdrop-filter`.
  - No blurred decoration.
  - Profile on the 13 Pro Max with Web Inspector Timelines.

### 2.3 Preference queries and fallbacks [BCD]
| Feature | Safari / iOS | Chrome | Firefox |
|---|---|---|---|
| `prefers-reduced-transparency` | **No** | 118 | Flag only (113) |
| `prefers-contrast` | 14.1 | 96 | 101 |
| `prefers-reduced-motion` | 10.1 | 74 | 63 |
| `inverted-colors` (Smart Invert) | 9.1 / iOS 10 | No | Flag |
| `backdrop-filter` | 18 (9 prefixed) | 76 | 103 |

- Safari supports `prefers-contrast`. Whether iOS "Increase Contrast" maps to `more` is **Unverified**; test it on the device.
- **PWA gotcha:** iOS reports an installed web app as `display-mode: fullscreen`, not `standalone`. WebKit 264218 has been open since 2023 [WKB-264218], and BCD notes it too.
  - `src/screens/welcome/install.ts` already tests all three modes.
  - `src/store/useStore.ts:438` tests only `standalone`.
- **Safari 26 UA string:** the user agent now reports "a frozen OS version" [SRN26]. Feature-detect with `CSS.supports`; never sniff the iOS version.

### 2.4 Open-source libraries (GitHub and npm APIs, read 2026-10-08)
| Repo | Stars | Licence | Last push | Approach | Verdict |
|---|---|---|---|---|---|
| rdev/liquid-glass-react (npm 1.1.1) | 6.4k | MIT | 2025-06-13 | SVG displacement. Its README says "Safari and Firefox only partially support the effect (displacement will not be visible)" | Stale and Chromium-only. No. |
| AndrewPrifer/liquid-dom | 2.5k | MIT (the npm `@liquid-dom/react` shows no licence field) | 2026-09-06 | WebGPU plus HTML-in-Canvas, "behind Chrome's Canvas Draw Element flag" | Not usable on iOS. |
| dashersw/liquid-glass-js | 1.3k | MIT | 2025-06-12 | WebGL plus html2canvas snapshot | Stale snapshot; heavy. No. |
| shuding/liquid-glass | 1.2k | MIT | 2026-03-26 | "Copy-paste … shader with SVG" | A demo. |
| naughtyduk/liquidGL | 0.9k | MIT for code (assets excluded) | 2026-10-01 | WebGPU or WebGL snapshot with a CSS fallback | Safari unstable >50% of the viewport. No. |
| samasante/liquid-glass (npm 0.1.1) | 0.6k | MIT | 2026-06-23 | `filter: url()` on the live DOM. In Safari it "can't bend the live page" | Clever, but too complex. No. |
| ybouane/liquidglass, huozhi/vaso, archisvaze/liquid-glass | — | **No licence** | — | — | Legally unusable. |

**Verdict:** depend on none of them. The recipe below is about 30 lines of CSS.

### 2.5 Recipe (dependency-free; goes in `src/index.css`)
```css
:root { --glass-fill: rgb(255 255 255 / .72); --glass-rim: rgb(255 255 255 / .55);
        --glass-hi: rgb(255 255 255 / .6); --glass-drop: 0 1px 2px rgb(0 0 0 / .08), 0 8px 24px rgb(0 0 0 / .12); }
@media (prefers-color-scheme: dark) {
  :root { --glass-fill: rgb(28 28 30 / .72); --glass-rim: rgb(255 255 255 / .14);
          --glass-hi: rgb(255 255 255 / .10); --glass-drop: 0 8px 24px rgb(0 0 0 / .5); } }
.glass {                                   /* nav layer only: tab bar, one floating button, sheet header */
  background: var(--glass-fill);
  -webkit-backdrop-filter: blur(16px) saturate(180%);  /* Safari < 18 */
  backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid var(--glass-rim);
  box-shadow: inset 0 1px 0 var(--glass-hi), var(--glass-drop);   /* top highlight + lift */
}
.glass:active { transform: scale(.97); }  /* the "comes to life on touch" cue; transform only */
/* Solid: in-app setting, Chromium reduced transparency, more contrast, or no support */
:root[data-glass="solid"] .glass,
:root[data-vt-running] .tabbar.glass { background: var(--surface); -webkit-backdrop-filter: none; backdrop-filter: none; }
@media (prefers-reduced-transparency: reduce) { .glass { background: var(--surface); backdrop-filter: none; } }
@media (prefers-contrast: more) { .glass { background: var(--surface); backdrop-filter: none;
  border-color: var(--text); box-shadow: none; } }
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { .glass { background: var(--surface); } }
/* Scroll edge effect: a fade under the floating bar, not a second blur */
.edge-fade { position: fixed; inset-inline: 0; bottom: 0; height: calc(96px + env(safe-area-inset-bottom));
  background: linear-gradient(to top, var(--page) 55%, transparent); pointer-events: none; }
```
- **"Tinted"** is 0.72–0.8 fill, and it's the default. **"Clear"** is 0.5 fill and opt-in. Neither is an Apple value.
- `data-vt-running` is set from the `ViewTransition` promises, to cover WebKit 302256 (Decision 2a). `:root:active-view-transition` (Safari 18+) does the same in CSS.
- Tailwind v4 has no reduced-transparency variant: its docs list `motion-*`, `contrast-*`, `forced-colors` and `inverted-colors` [TW-states]. Keep these rules in plain CSS.

---

## 3. Apple Health and Fitness patterns

### 3.1 Summary: Pinned, Highlights and Trends (Health, iOS 27)
- **Pinned.** "You can pin and arrange the health categories that are most important to you", via "Edit next to Pinned" [S-health]. "Your Pinned list shows how you're doing in each health category that day" [S-104997].
- **Highlights.** "Highlights show your Health over time, so you can see how you're doing overall". There's "Show All Highlights" [S-104997].
- **Trends.** "Health can alert you to significant changes in types of data like resting heart rate, number of steps, and amount of sleep. Trend lines show you how much these metrics have changed and for how long". There's "Show All Health Trends" [S-health].
- **Fitness Summary** has rings, steps, distance, trends, sessions and awards. "Edit Summary" lets you add, swap or move cards, and "See All Categories" sits at the bottom [S-fitsum].

### 3.2 Trends, comparison periods and empty states
- **Fitness compares periods:** "Your last 90 days of activity are compared to the last 365."
  - An up arrow means "maintaining or improving".
  - A down arrow means "your 90-day average … has started to decline".
  - Coaching comes as a sentence, e.g. "Walk an extra quarter mile a day."
  - "It takes 180 days of activity to start your trends" [S-fitsum]. The Watch guide says the same as "at least 6 months" [S-watch].
- **Empty-state wording:**
  - I could not find Apple text for a "Keep moving" empty state (**Unverified**).
  - Apple's general rules: "Provide clear next steps on any blank screens … give them a button or link" [H-write]. "If a section is empty, explain why its content is unavailable" [H-tab].
  - Synthetic example for us: "Your walking trend appears after 2 weeks. 5 days so far. [Start a walk]". Use a short window, not 180 days.

### 3.3 Browse and All Categories
- Browse shows the Health Categories screen, which has a search field.
- Each category page has:
  - "weekly, monthly, and yearly views … tabs at the top"
  - "Add Data"
  - "Pin to Summary"
  - "Show All Data"
  - "Data Sources & Access"
  - "Unit" [S-health]
- **For us:** one single-column list of ≤7 categories, each row with an icon, a label and a chevron.
- Skip search. Lower-literacy users "have difficulty spelling the query terms" [NNG-lit].

### 3.4 Charts
- **Mark type.** Use bars "when each value can represent a sum, like the total number of steps taken in a day" [H-charts].
- **Y axis.**
  - The axis is dynamic: "the upper bound of the Y axis range in the Health app's Steps chart varies" [H-charts].
  - Bars start at zero; level metrics like heart rate need not [H-charts].
- **Period and average.**
  - The Health Steps chart "shows the average number of steps per day in a one-month period" [H-charts, image alt].
  - Health's segmented control appears with "D selected, indicating … one day" [H-seg, image alt].
  - Week, month and year views are confirmed [S-health]; 6M is **Unverified**.
  - Segmented controls get "no more than about five segments on iPhone", labelled with nouns [H-seg].
- **Selection callout.**
  - Stocks lets people "drag a vertical indicator through the line graph, revealing the value" [H-charts].
  - Make the hit target "the entire plot area, letting people scrub" [H-charts], "stretching targets to the full height of the chart" [W22a 16:19].
  - "Don't require interaction to reveal critical information" [H-charts].
- **Headline and comparison.**
  - Write a self-contained description, e.g. "Sales for the past 30 days are up 12%, totaling 1,234 pancakes."
  - Add tappable summary rows (daily average, best day) that update the chart [W22b 4:31, 6:14].
  - How Health words its "this week vs last week" highlight is **Unverified**.
  - Our synthetic pattern: "**6,400 steps a day** this week — about 600 more than last week."
- **Gridlines.** About 4 horizontal lines with round values, and 7-day steps on a 30-day axis [W22a 11:25–11:46]. Small preview charts have no gridlines [W22a 10:30].
- **Continuity.** A chart "should retain its shape and any numbers apparent in an earlier view should be preserved" when it expands [W22b 8:32]. Use the same style for the mini chart and the full chart [H-chd].
- **Accessibility.**
  - One label per bar, with context first and words spelled out ("June 1, 36 pancakes") [W22a 17:31].
  - "Avoid using subjective terms" [H-charts].
  - Never rely on colour alone. Health uses two point shapes for blood pressure [H-charts].

### 3.5 Activity rings: what they mean, and why not to copy them
- **What each ring measures:**
  - The red Move ring shows active calories.
  - The green Exercise ring shows "minutes of brisk activity".
  - The blue Stand ring shows "how many times in the day you've stood and moved for at least 1 minute per hour".
  - For people who use a wheelchair, Stand becomes the Roll ring.
  - "An overlapping ring means you exceeded your goal" [S-fitsum; S-watch].
  - Without a Watch, iOS shows only the Move ring, "an approximation … based on their steps and workout information from other apps" [H-rings].
  - Goals can be set per weekday, and rings can be paused for "up to 90 days without breaking your award streak" [S-fitgoals].
- **HIG rules:**
  - "Never show Move, Exercise, and Stand progress in another ring-like element".
  - "Always display Activity rings on a black background".
  - "Differentiate other ring-like elements from Activity rings".
  - Label colours are #FA114F, #A6FF00 and #00FFF6 [H-rings].
- **For us:** one labelled progress ring or bar per goal, in our own palette, with the goal stated in words. Novel charts must be taught [H-chd]; a labelled bar may beat a ring for low-literacy users.

### 3.6 Workout and walk detail
- **Apple's rules [H-work]:**
  - "Provide a summary at the end of a session".
  - "Discard extremely brief workout sessions", or ask first.
  - Controls must be "easy to find and tap", with "clear feedback … when a session starts or stops".
  - In motion, use "large font sizes, high-contrast colors".
- **Route map:** Apple's colour-coded pace route is **Unverified**; I found no Apple text.
- **For us:**
  - Draw the stored GPS points as an SVG polyline. No map tiles, so it stays offline and private.
  - Label the start and finish with text.
  - Show pace through both colour and a legend.
  - Follow with summary rows (synthetic: "2.1 km · 31 min · Steady pace").

### 3.7 Concrete layout for 428 px
- **Apple-stated:**
  - The text styles in §1.5.
  - 44 pt targets, and 12 pt or 24 pt padding [H-acc].
  - Lists get "larger row height and padding" and "Sections have an increased corner radius" [D-adopt].
  - Default subview margins of 8 pt [D-uikit-margins].
  - The 16 or 20 pt root side margins are community measurements (**Unverified**).
- **Our spec:**
  - 16 px side margins and 12 px gaps.
  - 2-column tiles 186 px wide, 120–140 px tall, at the default text size; 1 column from the AX sizes up.
  - Card radius 24 with 16 padding, so inner radius 8.
  - Tab bar: a capsule 64 px tall with a 13–15 px label under a 26–28 px icon.
  - The value numbers use `ui-rounded` (Safari 13.1+ only) with a fallback, plus `font-variant-numeric: tabular-nums`.

---

## 4. Motion on the web, Apple-like

### 4.1 Springs
| Apple duration / bounce | Stiffness / damping (mass 1) | Damping ratio | CSS duration to settle within 0.1% |
|---|---|---|---|
| 0.5 / 0 (default) | 157.9 / 25.13 | 1.00 | 735 ms |
| 0.4 / 0 (**our default**) | 246.7 / 31.42 | 1.00 | 588 ms |
| 0.35 / 0 | 322.3 / 35.90 | 1.00 | 514 ms |
| 0.4 / 0.15 (release only) | 246.7 / 26.70 | 0.85 | 557 ms |
| 0.5 / 0.3 (avoid) | 157.9 / 17.59 | 0.70 | 819 ms |

The curve shape depends only on bounce, so one `linear()` token per bounce works at any duration. I computed these tokens; at bounce 0 the motion reaches 90% at about 42% of the time.
```css
--spring-smooth: linear(0, .058, .18, .321, .455, .573, .671, .75, .812, .86, .897, .924, .945, .96, .971, .979, .985, .989, .992, .994, .996, .997, .998, .999, 1); /* duration ≈ 1.47 × Apple duration */
--spring-snappy: linear(0, .054, .176, .323, .468, .598, .708, .795, .862, .912, .947, .972, .987, .997, 1.003, 1.005, 1.006, 1.006, 1.005, 1.005, 1.004, 1.003, 1.002, 1.001, 1); /* bounce .15; ≈ 1.39 × */
```
For JS-driven motion (counters, drags):
`p(t) = 1 − (1 + ω t)·e^(−ω t)`, with `ω = 2π/duration`, when bounce is 0.

### 4.2 View Transitions
- **Support** is in Decision 2b. The app is an SPA, so transitions are same-document. React Router's `viewTransition` "automatically wraps the navigation update in `document.startViewTransition()`" [RR-vt], and the app already wires this up in `src/main.tsx`.
- **Tile to screen:**
  1. Put `view-transition-name: hero` only on the tapped tile (`useViewTransitionState(href)` [RR-vt]) and on the destination header.
  2. Names must be unique, otherwise "`ViewTransition.ready` will reject and the transition will be skipped" [MDN-vt].
  3. By default the group animates position and size, and other changes cross-fade [MDN-vt].
  4. Snapshots "render as replaced content", so corners scale with the image. Morph a plain coloured container and let the text cross-fade.
  5. Group timing: `0.59s var(--spring-smooth)`.
  6. The tab bar stays out (`app-nav`, `animation:none`), and its blur is off during the transition (Decision 2a).
  7. Skip the app transition when Safari already animated the swipe-back: `hasUAVisualTransition`, Safari 18+ [BCD]. The app already does this.
- **React's own `<ViewTransition>`:** release status is **Unverified**. React Router covers the need.

### 4.3 Rings, charts and counters, cheaply
- **Ring:** an SVG `<circle>` with `stroke-dasharray` = 2πr and `stroke-dashoffset` = 2πr × (1 − p), rotated −90°.
  - Animate it once when it first appears. A small paint is fine.
  - No filters or shadows on rings.
- **Bars:** animate `transform: scaleY()` from the bottom, not `height` [webdev-comp]. Stagger them by ≤20 ms.
- **Counter:**
  - Run a `requestAnimationFrame` tween of ≤600 ms on the spring above, with `tabular-nums`.
  - Mark the animated digits `aria-hidden`, and put the final value in text for VoiceOver.
  - Under reduced motion, render the final value immediately.

### 4.4 Effects to avoid on iPhone
- **Large or animated blurs**, and `position: fixed` blurred decoration [WKB-319187; SRN27].
- **Glass on scrolling content.**
- **SVG filters on the backdrop:** not supported, and they crash on trunk [WKB-245510].
- **Animating layout properties:** width, height, top or left.
- **`will-change` on many elements** [webdev-comp].
- **Animating blur in or out:** Apple's Reduce Motion guidance says to avoid this anyway [H-acc].
- **Continuous loops in hidden views,** such as the three.js demo: pause them when they're off screen.

---

## 5. Designing for older and low-literacy users

### 5.1 NN/g
- **Touch targets:**
  - "Interactive elements must be at least 1cm × 1cm (0.4in × 0.4in)".
  - "seniors, whose dexterity has begun to decline, will also benefit from larger controls that are more forgiving of shaky hands".
  - "Limiting the number of elements on the screen can allow key touch targets to be larger and further spaced apart" [NNG-touch, 2019-05-05].
- **Older adults:**
  - "Interface text on mobile apps was often too small and lightly colored".
  - "Older users make more mistakes than younger users do".
  - "When older users encounter error handling, simplicity is even more important than usual" [NNG-old, 2019-09-08].
- **Lower-literacy users:**
  - They "plow the text"; "having to scroll breaks lower-literacy users' visual concentration".
  - Use "text aimed at a 6th grade reading level on the homepage".
  - "Avoid text that moves or changes".
  - Use "a single main column" and "a linear menu" [NNG-lit, 2005; old, but still the reference].

### 5.2 W3C COGA (Group Note, 29 Apr 2021) and WCAG 2.2
- **COGA patterns:**
  - 4.3.4: "Key content should be visible to users without needing to scroll".
  - 4.6.3: "five or less main choices on each screen".
  - 4.4.1: "Use common and clear words … Do not invent new words".
  - 4.2.7: "Each icon or symbol should convey a single meaning".
  - 4.5.6: labels "visible and next to the relevant control".
  - 4.5.2: "The user should never lose their work if they press back".
  - 4.5.5: "Always allow the user to check their work and correct any mistakes".
  - 4.5.10: "let the user know of its status and if it was successfully completed".
  - 4.5.1: content must "not move, unless the user initiates the movement".
  - 4.4.13: "Provide alternatives for numbers" [COGA].
- **WCAG 2.2 (12 Dec 2024):**
  - 2.5.8: 24×24 px (AA). 2.5.5: 44×44 px (AAA).
  - 2.5.1 Pointer Gestures and 2.5.7 Dragging Movements: a single-pointer alternative is required.
  - 1.4.4: text resizes to 200%.
  - 1.4.10: content reflows at 320 px.
  - 2.4.11 Focus Not Obscured: matters for the floating bar; add `scroll-padding-bottom`.
  - 3.3.4: deletions must be reversible, checked, or confirmed [WCAG22].

### 5.3 Apple's Assistive Access as the template
- Its apps share "large controls, streamlined interfaces, and visual alternatives to text", laid out in a "grid or row screen layout", with a back button always at the bottom.
- Apple's advice:
  - "Reduce the number of options shown at any given time".
  - "avoid timed interactions".
  - Build "an incremental, step by step flow".
  - "ask twice for confirmation" for permanent actions.
  - "include both an icon and a label" [W238 1:44–14:24]. The HIG says the same [H-acc].

### 5.4 Large text and gestures
- **Dynamic Type on the web:**
  - The app already scales the root by the measured `-apple-system-body` size (`src/lib/textSize.ts`).
  - WebKit's only public statement is that these keywords exist because "iOS has dynamic type behavior" [WK-2015].
  - That the keyword follows the Text Size setting inside Home Screen web apps is **Unverified** by any Apple doc; the app's own testing is the evidence.
- **At large sizes:** stack the layout, keep truncation to a minimum, and keep primary items at the top [H-typ].
- **Display Zoom "Larger Text"** makes the viewport narrower; the exact width is **Unverified**. Test at 375 and 320 px.
- **Gestures:** custom gestures must be "Not the only way to perform an important action" [H-gest].

### 5.5 Rules for a home screen of tiles
1. **Answer three questions:** "where am I", "what can I do", "where can I go" [W359 2:03–2:20]. That means a large title, one primary action, then the tiles.
2. **One primary action at the top** ("Start today's session"), filled in the accent colour. Never more than one or two prominent buttons [H-btn].
3. **≤5 tiles or rows in total**, every one visible without scrolling at the default text size [COGA 4.6.3, 4.3.4].
4. **Each tile:**
   - An icon plus a 1–3 word label.
   - One status line in words (synthetic: "Done today ✓", "Next: 10-min walk").
   - ≥60 px tall, with the whole tile tappable.
5. **Use 2 columns at the default text size and 1-column rows at large sizes.** Rows read better for low-literacy users, who need one column [NNG-lit].
6. **Fixed positions:** tiles never reorder themselves. No carousels, no auto-advancing content, no badges unless something is critical [COGA 4.5.1; H-tab].
7. **No hidden gestures.** Long-press or swipe is only a shortcut, never the only path [H-gest].
8. **Opaque tiles on a plain background.** Glass appears only in the tab bar.
9. **Colour plus icon plus words** for every state; never colour alone [H-col; H-charts].
10. **Undo for routine actions, double confirmation for irreversible ones.** No timeouts [H-acc; COGA 4.5.9].

---

## Recommendations for this app
1. Use glass only on the floating layer: the tab bar, one floating primary button, and sheet headers. Content stays opaque. No glass on glass, and at most 2 glass surfaces on screen.
2. Ship the §2.5 recipe: tinted fill 0.72 (dark: #1C1C1E at 0.72), blur 16 px, saturate 180%, 1 px rim, inset top highlight, soft drop shadow, capsule shape.
3. Add a "See-through panels" setting (Tinted by default, Clear, Off). Safari can't read iOS Reduce Transparency.
4. Switch to solid on `prefers-contrast: more`, on `prefers-reduced-transparency` (Chromium), when `backdrop-filter` isn't supported, and **while a view transition runs** (WebKit 302256).
5. Use no glass libraries, no SVG or WebGL refraction, and no blurred decoration. Fake the scroll edge effect with a gradient fade.
6. Check legibility over the worst-case backdrop. Use the IC-light system colours for coloured text on white cards; default colours are for fills only.
7. Type: iOS text styles with 17 px body, keep the existing `-apple-system-body` scaling, nothing under 13 px, no light weights, and section headers in title case.
8. Home: a large title, then one primary action, then ≤5 labelled tiles (≥60 px tall). Use 2 columns, switching to 1 column at large text sizes. Nothing on the home screen needs scrolling.
9. Tab bar: 3–4 labelled tabs that are always visible. It never shrinks on scroll, and `scroll-padding-bottom` keeps focused items above it.
10. Today: Health-style Pinned cards (≤4), then Highlights written as sentences with static mini charts, then "Show all".
11. Charts: bars for sums and lines for levels, with D/W/M/Y periods. The headline is the period average plus a comparison in words. The whole plot area can be scrubbed. Use about 4 round gridlines and one VoiceOver label per bar.
12. Trends start after 2 weeks, not 180 days. Empty states say what's missing, how long it will take, and offer one button.
13. Don't clone Activity rings. Use one labelled ring or bar per goal, in our own colours, with words.
14. Walk detail: an SVG route from stored GPS (no tiles) with labelled start and finish, pace in colour plus a legend, and summary rows. Pause and End are big visible buttons.
15. Motion: one spring family. Navigation and sheets use `--spring-smooth` (0.4 s, bounce 0, CSS 590 ms). `--spring-snappy` is only for releasing a gesture that has momentum.
16. Transitions: keep React Router's `viewTransition` and morph only the tapped tile into the screen header. Under reduced motion, cross-fade for 150–200 ms instead of skipping the animation.
17. Animate transform and opacity only. Bars grow with `scaleY`, rings draw once, and counters run ≤600 ms with tabular figures and a final value VoiceOver can read.
18. Every gesture has a button, including Back, Close, Delete and reorder (Move up/down). There is no swipe-to-end.
19. Routine deletes run at once and offer an Undo that stays until the next action. Irreversible actions get two confirmations with specific labels. No timed UI.
20. Words: about a 6th-grade reading level, verbs on buttons, no invented terms, and every number paired with plain words.
21. Test matrix:
    - 13 Pro Max (428 px) at the default text size, AX3, and Display Zoom.
    - Reduce Motion on; Increase Contrast on (to check `prefers-contrast`).
    - Dark mode.
    - Desktop Chrome, Firefox and Safari.

---

## Sources (all read 2026-10-08)
**Apple HIG** (developer.apple.com/design/human-interface-guidelines/…)
- [H-mat] /materials · [H-col] /color · [H-typ] /typography · [H-acc] /accessibility
- [H-tab] /tab-bars · [H-tool] /toolbars · [H-sheet] /sheets · [H-scroll] /scroll-views
- [H-mot] /motion · [H-charts] /charts · [H-chd] /charting-data · [H-seg] /segmented-controls
- [H-rings] /activity-rings · [H-work] /workouts · [H-hk] /healthkit · [H-btn] /buttons
- [H-alert] /alerts · [H-write] /writing · [H-gest] /gestures
- [H-new] https://developer.apple.com/design/whats-new/
- [H-lay-arch] HIG Layout specifications, archived 2025-12-01: https://web.archive.org/web/20251201140322/https://developer.apple.com/tutorials/data/design/human-interface-guidelines/layout.json

**Apple developer docs**
- [D-adopt] https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass
- [D-custom] https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views
- [D-spring] https://developer.apple.com/documentation/swiftui/spring (with `spring(duration:bounce:blendDuration:)`, `smooth`, `snappy` and `bouncy`)
- [D-uikit-spring] https://developer.apple.com/documentation/uikit/uiview/animate(springduration:bounce:initialspringvelocity:delay:options:animations:completion:)
- [D-uikit-margins] https://developer.apple.com/documentation/uikit/uiview/directionallayoutmargins

**WWDC**
- [W219] https://developer.apple.com/videos/play/wwdc2025/219/
- [W356] https://developer.apple.com/videos/play/wwdc2025/356/
- [W359] https://developer.apple.com/videos/play/wwdc2025/359/
- [W238] https://developer.apple.com/videos/play/wwdc2025/238/
- [W23] https://developer.apple.com/videos/play/wwdc2023/10158/
- [W18] https://developer.apple.com/videos/play/wwdc2018/803/
- [W22a] https://developer.apple.com/videos/play/wwdc2022/110340/
- [W22b] https://developer.apple.com/videos/play/wwdc2022/110342/

**Apple Support**
- [S-health] https://support.apple.com/guide/iphone/view-your-health-data-iphe3d379c32/ios
- [S-104997] https://support.apple.com/en-us/104997
- [S-fitsum] https://support.apple.com/guide/iphone/see-your-activity-summary-iph4c34a8a95/ios
- [S-fitgoals] https://support.apple.com/guide/iphone/adjust-your-activity-ring-goals-iph9a08e004e/ios
- [S-fitwo] https://support.apple.com/guide/iphone/start-a-workout-in-fitness-iph8475d8510/ios
- [S-watch] https://support.apple.com/guide/watch/track-daily-activity-apd3bf6d85a6/watchos
- [S-new27] https://support.apple.com/guide/iphone/whats-new-in-ios-27-iphfed2c4091/ios
- [S-disp27] https://support.apple.com/guide/iphone/adjust-iphone-display-and-text-settings-iphd6804774e/27/ios/27
- [S-colors] https://support.apple.com/guide/iphone/change-display-colors-iph3e2e1fb0/27/ios/27
- [S-compat] https://support.apple.com/guide/iphone/iphone-models-compatible-with-ios-27-iphe3fa5df43/ios
- [S-13pm] https://support.apple.com/en-us/111870

**Web platform**
- [BCD] https://github.com/mdn/browser-compat-data (`main`: css/at-rules/media, css/properties/backdrop-filter, view-transition-*, api/Document, api/ViewTransition, css/types/easing-function, css/at-rules/starting-style, css/properties/animation-timeline, css/types/color, api/PopStateEvent)
- [MDN-prt] https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-transparency
- [MDN-vt] https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using
- Safari release notes (https://developer.apple.com/documentation/safari-release-notes/…):
  - [SRN26] /safari-26-release-notes
  - [SRN26.2] /safari-26_2-release-notes
  - [SRN26.4] /safari-26_4-release-notes
  - [SRN27] /safari-27-release-notes
  - [SRN] 18 through 27.2
- [WK-26beta] https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/
- [WK-2015] https://webkit.org/blog/3709/using-the-system-font-in-web-content/
- WebKit bugs (https://bugs.webkit.org/show_bug.cgi?id=…):
  - [WKB-245510] 245510 · [WKB-297770] 297770 · [WKB-302256] 302256 · [WKB-319187] 319187 · [WKB-264218] 264218
  - 262001 and 275184
- [webdev-bdf] https://web.dev/articles/backdrop-filter
- [webdev-comp] https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count
- [chrome-linear] https://developer.chrome.com/docs/css-ui/css-linear-easing-function
- [kube] https://kube.io/blog/liquid-glass-css-svg/ (4 Sep 2025: "Only Chrome currently supports using SVG filters as `backdrop-filter`")
- [RR-vt] https://reactrouter.com/how-to/view-transitions
- [TW-states] https://tailwindcss.com/docs/hover-focus-and-other-states
- Libraries, via the GitHub REST API and registry.npmjs.org:
  - [liquidGL] https://github.com/naughtyduk/liquidGL
  - https://github.com/rdev/liquid-glass-react
  - https://github.com/samasante/liquid-glass
  - https://github.com/AndrewPrifer/liquid-dom
  - https://github.com/dashersw/liquid-glass-js
  - https://github.com/shuding/liquid-glass

**Older and low-literacy users**
- [NNG-touch] https://www.nngroup.com/articles/touch-target-size/
- [NNG-old] https://www.nngroup.com/articles/usability-for-senior-citizens/
- [NNG-lit] https://www.nngroup.com/articles/writing-for-lower-literacy-users/
- [COGA] https://www.w3.org/TR/coga-usable/
- [WCAG22] https://www.w3.org/TR/WCAG22/
