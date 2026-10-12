# Front-end-only personal-health platform: capability research

**Date:** 2026-10-08
**Target:** iPhone 13 Pro Max (A15, 6 GB RAM), current iOS Safari, used as an **installed PWA** (Add to Home Screen). Desktop Chrome/Safari secondary.
**Hard constraint:** static hosting (GitHub Pages), no backend we run, no paid APIs, no API keys the user must buy.

**Current iOS/Safari baseline for this report:** **Safari 27.0**, released 14 September 2026 (build 20625.1.29), shipping with iOS/iPadOS/macOS/visionOS 27 — per the [WebKit features post](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/) (17 Sep 2026) and Apple's [Safari release-notes index](https://developer.apple.com/documentation/safari-release-notes). Safari 27.2 is in beta; 26.0 shipped 15 Sep 2025. On iOS, Safari's version tracks the OS. An iPhone 13 Pro Max is on [Apple's iOS 27 compatibility list](https://support.apple.com/en-us/128058), so assume **iOS 27.x**. Where a feature landed earlier, the earlier version is given.

**One platform fact that simplifies everything:** **every browser on iOS is still WebKit**, including in India. Apple's [alternative browser engines](https://developer.apple.com/support/alternative-browser-engines/) entitlements are limited to *"EU users"* on iOS 17.4+, and even in the EU nothing has shipped — Open Web Advocacy, [June 2026](https://open-web-advocacy.org/blog/28-percent-faster--the-blink-prototype-that-shows-why-apples-ios-browser-engine-ban-must-end/), describes a Blink *prototype* and states *"every other browser on iOS forced to use the bundled WebKit engine"*. **Test in Safari and you have tested Chrome, Edge, Firefox, Brave and Opera on iOS too.**

**A note on sources.** `WebSearch` was unavailable for this work, so every finding comes from direct primary-source fetches: the WebKit blog, **WebKit source and preference YAML**, WebKit Bugzilla, **Apple's Safari release-notes DocC JSON API**, MDN browser-compat-data JSON, the caniuse dataset, W3C/WHATWG specs, the Bluetooth SIG's assigned-numbers files, the npm registry, GitHub's REST API, PubMed E-utilities, and each dataset's own licence page — plus live HTTP probes for file sizes and CORS headers. Several published figures turned out to be stale and are corrected inline. The trade-off: **discovery of obscure datasets may be incomplete**, and a human search sweep would be a worthwhile confirmation step for §6's Indian-dataset survey.

> **How to read the verification labels**
> - **Confirmed** — stated by a primary source (WebKit blog, Safari release notes, WebKit source/prefs, W3C spec, MDN browser-compat-data, the dataset's own licence page).
> - **Confirmed by absence** — no enabling API exists in WebKit; the negative is as reliable as a positive statement.
> - **Unverified** — could not be confirmed from a primary source. Do not build on these without an on-device test.

---

## Summary table

Sections 1–10 below correspond to the ten research areas. iOS Safari support is called out separately from Chrome throughout.

| Capability | Front-end only? | iOS Safari PWA? | Recommendation |
|---|---|---|---|
| **Step counting, foreground session** (`DeviceMotionEvent` + peak detection) | Yes | **Yes** — iOS 4.2+; `requestPermission()` from a tap, grant **does not persist** across launches | **Use with fallback** |
| **Step counting, background / screen off** | **No** | **No. Impossible.** No background execution exists for web content on iOS | **Avoid** — dead end |
| **Generic Sensor API** (`Accelerometer`, `Gyroscope`, `Pedometer`) | Chrome only | **No, permanently** — WebKit position is `oppose` | **Avoid** |
| **Walk/run GPS tracking, foreground** (`watchPosition`) | Yes | **Yes** — iOS ≤3+ | **Use with fallback** |
| **Live pace / speed readout** | Yes | Yes (compute from fixes; `coords.speed` is often `null`) | **Use** |
| **GPS tracking in background** | **No** | **No** — the spec itself says updates go *"exclusively… to fully active documents that are visible"* | **Avoid** — dead end |
| **Map basemap for routes** | Tiles yes, offline no | Policy-blocked for offline PWAs | **Avoid tiles**; draw an SVG polyline |
| **Heart rate via Web Bluetooth** | Desktop Chrome only | **No, permanently** — WebKit `oppose` | **Avoid** on iOS; desktop-only extra |
| **Heart rate via finger PPG + torch** | Yes | **Yes** — `torch` ships from iOS **17.4** | **Use with fallback** (wellness framing, manual entry alongside) |
| **Heart rate via face rPPG** | Yes | Yes | **Avoid** — 43% real-world yield, ±12–38 bpm LoA |
| **HRV / AF / blood pressure / SpO2 / glucose from camera** | Technically | — | **Avoid. Never ship.** |
| **Reminders while the app is open** (`setTimeout` + notification) | Yes | **Yes** — iOS 16.4+, **installed PWA only** | **Use** |
| **Reminders when the app is closed, no server** | **No** | **No** — Notification Triggers never shipped anywhere | **Avoid** |
| **Web Push when closed** | Needs a sender | **Yes** — iOS 16.4+, installed PWA only; still needs something to POST | **Use with fallback** (GitHub Actions cron as sender) |
| **Generated `.ics` with `VALARM` → iOS Calendar fires it** | Yes | Yes (needs on-device verification) | **Use** — the honest no-server reminder |
| **Badging API** (`setAppBadge`) | Yes | **Yes** — iOS 16.4+, home-screen web apps | **Use** |
| **Background Sync / Periodic Sync / Background Fetch** | Chrome only | **No** | **Avoid** |
| **Read/write Apple Health or Google Fit live** | **No** | **No** — HealthKit is native-only; Google Fit API dies in 2026 | **Avoid** |
| **Import Apple Health `export.zip`** | Yes | **Yes** via `<input type="file">`; **no** Web Share Target | **Use** — streaming SAX in a Worker, aggregate to daily buckets |
| **Import GPX / TCX / Strava bulk export** | Yes | Yes | **Use** — highest value for least effort |
| **USDA FoodData Central bundled** | Yes | Yes | **Use** — CC0, 7,793 foods ≈ **412 KB gzipped** |
| **USDA FDC API** | No | — | **Avoid** — requires an api.data.gov key |
| **Open Food Facts barcode lookup** | Yes | Yes — keyless, CORS `*`, send `X-User-Agent` | **Use with fallback** — ~15% Indian nutrition coverage |
| **IFCT 2017 / ICMR-NIN tables bundled** | Technically | — | **Avoid** — all rights reserved; hand-build your own table |
| **`BarcodeDetector`** | Chrome/Android only | **No** — flag-off everywhere *and* broken when enabled | **Avoid** |
| **WASM barcode scanning** (`barcode-detector` + zxing-wasm) | Yes | Yes — ~15 KB JS + ~445 KiB gzip WASM | **Use** |
| **WebGPU** | Yes | **Yes — enabled by default from iOS 26** (off in Lockdown Mode) | **Use with fallback** (feature-detect) |
| **On-device LLM** (WebLLM / transformers.js) | Yes | Technically ≤1B only; **~1.5 GB process cap**, silent tab kills | **Avoid** for health answers |
| **Retrieval assistant over bundled content** (minisearch) | Yes | Yes — **5.7 KB** + ~70–250 KB index | **Use** — the recommendation |
| **Chrome Prompt API / `window.ai`** | Chrome desktop only | **No** — WebKit `oppose` | **Avoid** |
| **Pose estimation for rep counting** (MediaPipe lite, CPU) | Yes | Yes — no COOP/COEP needed; expect ~15 fps | **Use with fallback** — standing sagittal only |
| **Pose estimation for form / posture checking** | Yes | Yes | **Avoid.** Errors are 2–20× clinically meaningful; no spine landmarks exist |
| **TensorFlow.js pose** | Yes | Yes, but auto-selects a **silently-broken** WebGPU path on iOS 26+ | **Avoid** |
| **Device orientation for gross position** (lying vs upright) | Yes | Yes — permission **re-prompts every launch** | **Use** |
| **Device orientation for slouch / forward head** | — | — | **Avoid** — mathematically underdetermined with one sensor |
| **`Screen Wake Lock`** | Yes | **Yes — but only from iOS 18.4 in an installed PWA** (worked in a tab from 16.4) | **Use with fallback** |
| **`Vibration` / haptics** | Chrome only | **No** | **Avoid** — use audio and visual cues |
| **`AmbientLightSensor`** | Chrome flag only | **No** | **Avoid** — use `prefers-color-scheme` |
| **Web Audio cues** | Yes | Yes — gesture to start; **`navigator.audioSession.type`** controls silent-switch behaviour (iOS 16.4+) | **Use** |
| **IndexedDB storage** | Yes | **Yes — ~60% of disk for an installed PWA** | **Use** — migrate off localStorage |
| **`localStorage`** | Yes | Yes but **5 MiB cap**, synchronous | **Use only for tiny flags** |
| **Data survives disuse** | — | **Yes for installed PWAs** — WebKit: *"their own counter of days of use"*, *"We do not expect… data to be deleted"* | **Use** — make install a first-run step |
| **`navigator.storage.persist()`** | Yes | Yes, 15.2+ — granted heuristically, home-screen install is a positive signal | **Use** |
| **File System Access** (`showSaveFilePicker`) | Chrome only | **No** — WebKit `oppose` | **Avoid** |
| **Export via `navigator.share({files})`** | Yes | **Yes** — Safari 12.1 / files 14+ | **Use** — best iOS export UX |
| **Free content: NIH ODS, CDC/NIOSH, OSHA** | Yes | — | **Use** — public domain, reusable with a no-endorsement note |
| **Free content: NHS (OGL v3.0)** | Yes | — | **Use** — commercial use allowed, **but for adapted content you must NOT cite the NHS** (their §3.6) |
| **Free content: WHO (CC BY-NC-SA 3.0 IGO)** | Yes | — | **Use with care** — summarise rather than reproduce (non-commercial + share-alike) |
| **Free content: ADA Standards of Care** | Free to read | — | **Cite and link only.** The 2026 notice bans third-party posting **and text/data mining or machine learning** — so it cannot go in the retrieval index |
| **Free content: ICMR-NIN, NICE, ACSM** | Yes | — | **Cite and link only** — all rights reserved |

---

## 1. Step counting and activity

### What exists on the web platform

| API | iOS Safari (tab) | iOS Safari (installed PWA) | Chrome (desktop / Android) |
|---|---|---|---|
| `DeviceMotionEvent` (`devicemotion`) | **Yes**, since iOS 4.2 | Same | Yes (Chrome 31+) |
| `DeviceMotionEvent.requestPermission()` | **Required**, since iOS 13 | Same | Chrome 152+ (recent) |
| `DeviceOrientationEvent` | Yes, iOS 4.2 (`absolute` **not** supported) | Same | Yes |
| Generic Sensor API: `Accelerometer`, `LinearAccelerationSensor`, `Gyroscope`, `AbsoluteOrientationSensor` | **No** | **No** | Chrome 67+ |
| `Pedometer` | **Does not exist as a web API in any browser** | — | — |
| `AmbientLightSensor` | **No** | **No** | Chrome 56 behind a flag |

Sources: [MDN BCD `api/DeviceMotionEvent.json`](https://github.com/mdn/browser-compat-data/blob/main/api/DeviceMotionEvent.json), [`api/Accelerometer.json`](https://github.com/mdn/browser-compat-data/blob/main/api/Accelerometer.json), [`api/Gyroscope.json`](https://github.com/mdn/browser-compat-data/blob/main/api/Gyroscope.json), [`api/AmbientLightSensor.json`](https://github.com/mdn/browser-compat-data/blob/main/api/AmbientLightSensor.json).

**The Generic Sensor API will not come to Safari.** WebKit's own standards-positions entry for "Gyroscope, Accelerometer, Magnetometer, Orientation, Motion" is **`oppose`**, with concerns listed as duplication, privacy, venue, use cases, power and device independence — [WebKit/standards-positions issue 347](https://github.com/WebKit/standards-positions/issues/347). Treat `Accelerometer`/`Pedometer` as permanently unavailable on iOS and build only on `DeviceMotionEvent`.

**There is no `Pedometer` web API.** The only pedometer-ish proposal of that name never reached a standards body and is not in MDN's compat database. Apple's step count lives in HealthKit/CoreMotion, which is native-only (see §5).

### Sources disagree on when `requestPermission()` arrived — flagging it

Two Apple sources conflict:

- **Apple's Safari 13 release notes** say *"Added a permission API on iOS for `DeviceMotionEvent` and `DeviceOrientationEvent`"* ([Safari 13 release notes](https://developer.apple.com/documentation/safari-release-notes/safari-13-release-notes)).
- **WebKit's own release branches** do not contain it until `safari-611-branch` (Safari 14.1 / iOS 14.5): `requestPermission` is absent from the IDL in `safari-608-branch` (Safari 13.0.x) through `safari-610-branch` (Safari 14.0). **MDN BCD agrees: `safari_ios: 14.5`**, and `safari: false` — it has never existed on macOS.
- The implementing commit (*"Add support for Device Orientation / Motion permission API"*) landed in WebKit trunk on 2019-03-09, so the API existed upstream in the iOS 13 era.

**Resolution: treat iOS 14.5+ as certain and "iOS 13" as plausible but unconfirmed.** It changes nothing for the build — feature-detect `typeof DeviceMotionEvent.requestPermission === 'function'` and fall back to attaching the listener directly.

### Permission mechanics on iOS

- Must be called **from a user gesture**. MDN: *"This method requires transient activation, meaning that it must be triggered by a UI event such as a button click"*, and it *"rejects with `NotAllowedError`"* otherwise ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static)). WebKit's own layout tests are named `device-motion-request-permission-user-gesture.html` and `…-secure-context.html`.
- Requires a **secure context** (HTTPS) — recently tightened: [Safari 26.4](https://developer.apple.com/documentation/safari-release-notes/safari-26_4-release-notes) *"Fixed `DeviceMotionEvent` and `DeviceOrientationEvent` interfaces so that they only show up in secure contexts"*. GitHub Pages is HTTPS, so fine.
- **The grant does NOT persist across launches — confirmed from WebKit source.** In [`DeviceOrientationAndMotionAccessController.cpp`](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/dom/DeviceOrientationAndMotionAccessController.cpp) the state lives in `m_accessStatePerOrigin`, a plain **in-memory map owned by `Page`**, with no embedder `queryPermission()` call and no persistent store (contrast camera, which *does* call `uiClient().queryPermission("camera", …)`). Kill and relaunch the installed web app and the state resets to `Prompt`. **Design an explicit "Enable motion sensing" button into the session-start flow on every cold launch** — never a silent call at boot.
- If the user has turned off Settings → Safari → **Motion & Orientation Access**, `requestPermission()` resolves to `'denied'`. Handle that path explicitly.
- `DeviceOrientationEvent.absolute` is **not supported on iOS**; iOS exposes non-standard `webkitCompassHeading` / `webkitCompassAccuracy` instead (guarded by `#if PLATFORM(IOS_FAMILY)` in [`DeviceOrientationEvent.idl`](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/dom/DeviceOrientationEvent.idl)). There is no cross-platform absolute-orientation or magnetometer flag.

### Can steps be counted with the screen off or the app backgrounded on iOS?

**No. Flatly no.** This is the single most important constraint in the whole report.

- `DeviceMotionEvent` is `Exposed=Window`. It is not available in a Worker or a Service Worker, so there is no context that could survive the page being hidden.
- iOS gives no background-execution primitive to web content: **Background Sync — not implemented in Safari** ([BCD `api/SyncManager.json`](https://github.com/mdn/browser-compat-data/blob/main/api/SyncManager.json)); **Periodic Background Sync — not implemented** ([BCD `api/PeriodicSyncManager.json`](https://github.com/mdn/browser-compat-data/blob/main/api/PeriodicSyncManager.json)); **Background Fetch — not implemented** ([BCD `api/BackgroundFetchManager.json`](https://github.com/mdn/browser-compat-data/blob/main/api/BackgroundFetchManager.json)). WebKit has taken **no position** on Background Sync and Background Fetch and lists "power" and "privacy" among its concerns ([standards-positions summary](https://github.com/WebKit/standards-positions/blob/main/summary.json)).
- The only thing that wakes an iOS web app's service worker is an incoming **push message**, and that requires a sender (see §4).
- `Screen Wake Lock` cannot help: the spec says *"Only visible documents can acquire the screen wake lock"*, `request()` rejects with `NotAllowedError` when hidden, and any held lock is released when the document becomes hidden ([Screen Wake Lock §2, §8.1, §11.3](https://www.w3.org/TR/screen-wake-lock/)).

**Confirmed by absence.** No all-day background pedometer is possible on iOS from a web app. Any design that assumes it is a dead end.

### What *is* actually achievable

1. **Foreground "walk session" step counting.** User taps *Start walk*, the app grabs `Screen Wake Lock` (iOS 18.4+ in an installed PWA — see §8), keeps the screen on, and runs a step detector on `devicemotion` with the phone in hand or pocket. Accurate, but costs battery and screen-on time, and stops the instant the user locks the phone or switches apps.
2. **Manual / Health-export reconciliation.** Let the user type a daily step total, or import their Apple Health export periodically (§5) and backfill real step counts from CoreMotion — which *does* run all day, natively. This is the honest path to an all-day step history.
3. **Activity *inference* rather than counting.** Count "movement minutes" only during sessions the user starts; present everything else as self-reported.

### Writing the detector yourself

The literature-standard approach is a **windowed peak-detection** algorithm on the magnitude of `accelerationIncludingGravity`:

1. magnitude `m = sqrt(x² + y² + z²)`
2. remove gravity / DC with a moving average or a high-pass filter
3. low-pass to ~3–5 Hz (human cadence is roughly 0.5–3 Hz, i.e. 30–180 steps/min)
4. detect peaks above an adaptive threshold with a refractory period (~250–300 ms) to reject double counts

Salvi et al. report **95% average accuracy** for an optimised windowed peak-detection algorithm across six different phone carry positions, with an open-source reference implementation — *An Optimised Algorithm for Accurate Steps Counting From Smart-Phone Accelerometry*, IEEE EMBC 2018, [PMID 30441333](https://pubmed.ncbi.nlm.nih.gov/30441333/). That is the right accuracy expectation to design against.

For context on native step counting: Case et al. found smartphone apps (phone in pocket, using the device's own pedometer) differed from manually counted steps by **−6.7% to +6.2%**, versus −22.7% to −1.5% for wrist wearables — *Accuracy of Smartphone Applications and Wearable Devices for Tracking Physical Activity Data*, JAMA 2015;313(6):625–626, [article](https://jamanetwork.com/journals/jama/fullarticle/2108876). Note this used the iPhone's hardware motion coprocessor, not JavaScript, so treat it as a *ceiling*, not a prediction.

**Sampling rate caveat:** `devicemotion` in iOS Safari fires at roughly 30–60 Hz; read `event.interval` rather than assuming. The exact ceiling is **Unverified** — measure it on device, because a detector tuned at 60 Hz misbehaves at 20 Hz.

**Recommendation: use with fallback.** Build foreground session step counting; be explicit in the UI that it only counts while the app is open; make Health-export import the source of truth for daily totals.

---

## 2. Walk / run tracking

### API and iOS support

`navigator.geolocation.watchPosition()` — **supported in iOS Safari since iOS ≤3** and in every browser ([BCD `api/Geolocation.json`](https://github.com/mdn/browser-compat-data/blob/main/api/Geolocation.json)). Requires a secure context. Installed PWA behaves the same as a tab, except that the permission grant is scoped to the installed app.

Note: WebKit's position on the newer **Geolocation Sensor** API is `oppose` (duplication) — [standards-positions](https://github.com/WebKit/standards-positions/blob/main/summary.json). The classic API is the one to use, and it is not going away.

### Live pace / speed readout: feasible

`GeolocationCoordinates` carries `speed` (m/s) and `heading`, but on iOS these are frequently `null`. The reliable approach is to compute it yourself:

- distance between consecutive fixes via the haversine formula
- divide by the timestamp delta for instantaneous speed; smooth over a 5–15 s window for a readable pace
- **gate on `coords.accuracy`**: the spec defines it as *"the accuracy value indicating the 95% confidence level in meters"* ([W3C Geolocation §6.6](https://www.w3.org/TR/geolocation/)). Discard fixes worse than ~20–30 m and discard sub-threshold movements, or GPS jitter will inflate distance while standing still.

Set `enableHighAccuracy: true` and `maximumAge: 0`. The spec is explicit that high accuracy is only a hint — *"a hint that the application would like to receive the most accurate location data"*, *"though the request can be ignored by the user agent"* — and that it *"can result in slower response times or increased power consumption"* ([§7.1, §1](https://www.w3.org/TR/geolocation/)).

**Yes, a live "how fast am I going" readout is feasible** and will be good enough outdoors. Expect typical consumer-GPS horizontal error of several metres; the per-fix `accuracy` value is the authoritative in-app signal (I could not reach gps.gov for a primary accuracy figure today — treat any specific metre number as **Unverified**).

### Background behaviour on iOS: this is the killer

The W3C spec settles it independently of iOS:

> *"position updates are exclusively delivered to fully active documents that are visible"* — and updates to other documents are silently discarded ([§6.5 note](https://www.w3.org/TR/geolocation/)).
> A request from a hidden page *waits until it is visible*, and the `timeout` clock excludes that wait ([§6.5, §7.2](https://www.w3.org/TR/geolocation/)).
> `Geolocation` is `Exposed=Window` — no worker or service-worker access.

So: lock the phone or switch apps and the GPS track stops, with a gap, not an error. **Confirmed.** There is no `background` mode, no equivalent of CoreLocation's significant-location-change or always-authorisation, and no way to ask for one.

### What this means in practice

- A tracked walk/run requires the app in the foreground with the screen on. Acquire `Screen Wake Lock` (§8) for the duration.
- Handle `visibilitychange`: on hide, stamp the gap; on show, resume a **new** segment rather than drawing a straight line across the gap (that would silently fabricate distance).
- Battery: continuous high-accuracy GPS plus a lit screen is the heaviest thing this app will ever do. Expect a meaningful drain over a 45–60 minute walk. Mitigate by dimming the UI (dark, low-pixel-count screen), avoiding three.js/WebGL during tracking, and throttling re-renders to ~1 Hz.
- Offer **GPX import** as the alternative for people who track with a watch (see §5).

### Showing the route: skip the basemap

If you want a map, the free option people reach for is OpenStreetMap's own tiles — and the OSMF tile usage policy makes that a poor fit for a PWA. It states that **"Offline use is not permitted on tile.openstreetmap.org"**, forbids **"any pre-emptive fetching of tiles other than those a user is actively viewing"**, requires a stable identifying `User-Agent` (which a browser will not let you set) or at minimum a valid `Referer`, requires visible `© OpenStreetMap contributors` attribution, and warns **"We may block access, without notice, if your usage degrades the service"** with **"no SLA or guarantee"** ([OSMF tile usage policy](https://operations.osmfoundation.org/policies/tiles/)).

An offline-capable PWA is therefore on the wrong side of that policy. **The lazier and better answer: draw the route as a self-scaled SVG or canvas polyline with no basemap** — project lat/lng to a local equirectangular plane, auto-fit the bounding box, colour by pace. Zero dependencies, zero licence obligations, works offline, and for a personal walk log the shape of the route is the information. Add a "View in Maps" link (`https://maps.apple.com/?ll=…` or a `geo:` URI) for anyone who wants a real map.

**Recommendation: use with fallback.** Live foreground tracking is genuinely good. Say plainly in the UI that it pauses when the app is backgrounded. Avoid a tiled basemap.

---

## 3. Heart rate

### Web Bluetooth: never on iOS. WebKit has formally opposed it.

**[WebKit/standards-positions issue #570](https://github.com/WebKit/standards-positions/issues/570)**, opened 4 Nov 2025, closed 2 Dec 2025 with label **`position: oppose`** plus `concerns: privacy`, `concerns: security`, `concerns: device independence`. Anne van Kesteren, verbatim:

> *"The low-level nature of this API means that it is insecure, has a massive privacy risk, and perhaps most importantly doesn't meet the web platform's device-independence bar. Resolving this as position: oppose therefore. (Not waiting for the usual week as our position is well known I think…)"*

The spec's own community group agrees: the [Web Bluetooth implementation-status page](https://github.com/WebBluetoothCG/web-bluetooth/blob/main/implementation-status.md) lists Safari as **"Not supported and no plan to support it in the near future."** The tracking bug, [WebKit 101034](https://bugs.webkit.org/show_bug.cgi?id=101034), has been open since 2012. This is a pattern, not a one-off — WebUSB ([#68](https://github.com/WebKit/standards-positions/issues/68)), Web Serial ([#199](https://github.com/WebKit/standards-positions/issues/199)) and WebHID ([#510](https://github.com/WebKit/standards-positions/issues/510)) are all `oppose`.

| Browser / platform | Web Bluetooth |
|---|---|
| **Safari, iOS/iPadOS (tab or installed PWA)** | **No**, every version 3.2 → 27.2 |
| Safari, macOS | **No**, every version |
| **Chrome on iOS** | **No** — it is WKWebView, so it inherits WebKit. Chromium has *"no implementation planned"* for iOS |
| Chrome desktop | **Yes** — 56+ by default; macOS 56, Windows 10 from 70, ChromeOS yes, Linux needs a flag |
| Chrome Android | **Yes**, 56+ |
| Edge 79+, Opera 43+, Samsung Internet 6.2+ | Yes |
| Firefox (all) | **No** — Mozilla's position is *harmful* |

For a desktop-only enhancement, the GATT layout (from the Bluetooth SIG's [assigned numbers](https://bitbucket.org/bluetooth-SIG/public/raw/main/assigned_numbers/uuids/characteristic_uuids.yaml) and GATT Specification Supplement v9 §3.113): service **`0x180D`** Heart Rate, characteristic **`0x2A37`** Heart Rate Measurement (Notify). Byte 0 is a flags bitfield — bit 0 = value format (0 → `uint8`, 1 → `uint16`), bit 1 = sensor contact detected, bit 2 = contact supported (read 1 and 2 together), bit 3 = Energy Expended present (`uint16`, **joules**), bit 4 = RR-intervals present (`uint16[n]`, **units of 1/1024 s**, oldest first). All multi-octet fields are little-endian; there is no timestamp. The Web Bluetooth CG's [`heartRateSensor.js`](https://github.com/WebBluetoothCG/demos/blob/gh-pages/heart-rate-sensor/heartRateSensor.js) is the reference parser. Gate it on `navigator.bluetooth && await navigator.bluetooth.getAvailability()`.

### iOS fallbacks for a real strap: there are none that work live

| Option | Verdict |
|---|---|
| Web Bluetooth in any iOS browser | **No** (above) |
| WebUSB / WebHID / Web Serial | **No** — all `oppose` in WebKit |
| The `iOSWebBLE` **Safari extension** shim (relays `navigator.bluetooth` to CoreBluetooth) | **Unreachable.** Safari Web Extensions in web apps are **macOS-only**: [Safari 18.0](https://developer.apple.com/documentation/safari-release-notes/safari-18-release-notes) — *"Added support for Safari Web Extensions and Content Blockers in web apps **on macOS**."* No iOS equivalent exists in any release note 17.0 → 27.2 |
| **Bluefy / WebBLE** (App Store browsers that implement Web Bluetooth over CoreBluetooth) | Real, but they are *different browser apps*. Your app would have to be used as a web page inside Bluefy — no home-screen install, no standalone mode, no shared storage with the installed app |
| HealthKit from the web | **No web API exists** (see §5) |
| Audio jack / ANT+ | **No.** No jack on an iPhone 13 Pro Max; no Web ANT+ anything |

**Blunt answer: there is no live route from a chest strap into an installed iOS PWA with no backend.** The honest options are **manual entry** of a number the user reads off their own strap or watch, retrospective Apple Health import (§5), or camera PPG.

### Camera PPG: realistic, and better than expected — because the torch *is* available

**Correction to a widely-held belief: the `torch` constraint IS supported on iOS Safari, from 17.4.** Verified five ways:

1. [`MediaTrackSupportedConstraints.idl`](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/mediastream/MediaTrackSupportedConstraints.idl) contains `boolean torch = true;`; [`MediaTrackCapabilities.idl`](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/mediastream/MediaTrackCapabilities.idl) has `boolean torch;`; [`MediaTrackConstraints.idl`](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/mediastream/MediaTrackConstraints.idl) has `ConstrainBoolean torch;`. No feature-flag pref gates it.
2. The commit exists: `9c0b105d8`, 2023-10-04, *"[MediaStream] Add support for torch"*, [WebKit bug 262131](https://bugs.webkit.org/show_bug.cgi?id=262131).
3. Branch bisect: absent from `safari-7617-branch` (Safari 17.2/17.3), present in `safari-7618-branch` (Safari 17.4). Its sibling shipped in the same cycle and *was* announced — [Safari 17.4](https://developer.apple.com/documentation/safari-release-notes/safari-17_4-release-notes): *"Added MediaStream support for `whiteBalanceMode`."*
4. Apple has shipped bug fixes against it on real hardware: [Safari 17.5](https://developer.apple.com/documentation/safari-release-notes/safari-17_5-release-notes) *"Fixed the camera pausing occasionally when torch is enabled"*; [Safari 18.4](https://developer.apple.com/documentation/safari-release-notes/safari-18_4-release-notes) *"Fixed getUserMedia video track `getSettings()` returning a stale value for `torch` and `whiteBalanceMode` constraints."*
5. In [`AVVideoCaptureSource.mm`](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/mediastream/cocoa/AVVideoCaptureSource.mm) the capability is gated on `if ([device() hasTorch])` and `updateTorch()` calls `[device setTorchModeOnWithLevel:AVCaptureMaxAvailableTorchLevel …]` — **maximum level, which is what the validated literature used.** `hasTorch` is false on Macs, so torch is effectively an iOS-only capability.

**The usage pattern nobody documents** — from WebKit's own layout test [`mediastreamtrack-video-torch.html`](https://github.com/WebKit/WebKit/blob/main/LayoutTests/fast/mediastream/mediastreamtrack-video-torch.html):

```js
// WRONG — torch stays invisible forever:
await navigator.mediaDevices.getUserMedia({ video: { width: 640 } });
track.getCapabilities().torch   // undefined

// RIGHT — ask for torch in the INITIAL getUserMedia call:
const stream = await navigator.mediaDevices.getUserMedia({
  video: { facingMode: 'environment', width: 640, torch: true }
});
const track = stream.getVideoTracks()[0];
track.getCapabilities().torch   // true
await track.applyConstraints({ torch: true });
track.getSettings().torch       // true  <- always verify; applyConstraints can resolve while the LED stays dark
```

Three rules follow: request `torch` up front or it is `undefined` forever (this is almost certainly why "iOS has no torch" is folklore); use the plain `applyConstraints({ torch: true })` form, not `{advanced:[{torch:true}]}`; and **read back `getSettings().torch`** because `updateTorch()` only *logs* `NSException`s and `isTorchAvailable` goes false when the phone is hot. Feature-detect with `navigator.mediaDevices.getSupportedConstraints().torch`.

#### Accuracy — contact finger PPG is genuinely usable at rest

| Study | n | Reference | Result |
|---|---|---|---|
| [Coppetti et al., *Eur J Prev Cardiol* 2017;24(12):1287](https://pubmed.ncbi.nlm.nih.gov/28464700/) | 108 patients | 12-lead ECG | *Contact* apps: **MAE 2.0 ± 0.5 bpm** (r = 0.96) and 4.5 ± 1.1 bpm (r = 0.83). The reference pulse oximeter itself was MAE 2.0 |
| Yan et al. (Cardiio, iPhone 6S) | 40 | 12-lead ECG | mean difference **−0.05 bpm** (SD 1.03) |
| Bánhalmi et al. (iPhone 6, 240 fps, torch at maximum) | 50 | 4-lead ECG | r = 1.00; Bland–Altman bias 0.032, SD 0.110 |
| [Mather et al., *Front Digit Health* 2024 — scoping review](https://pmc.ncbi.nlm.nih.gov/articles/PMC10937558/) | 10 studies | ECG | *"all studies reached the same conclusion, with agreement ranging between good to very strong and correlations ranging from r = .98 to 1"* — with their own caveat: *"agreement was established under highly controlled conditions"* in *"healthy subjects"* |
| [Johansson et al., *Front Physiol* 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12819663/) | 37 athletes | ECG + Polar H10 | **HRV is a different story:** camera RMSSD **MAPE 17.49%** vs chest strap 2.16% |

**Read: at rest, still, finger on a torch-lit rear camera, MAE ≈ 2–5 bpm with limits of agreement of a few bpm is well supported.** Nothing supports it during movement, with cold hands, or without the torch. **Ship HR; do not ship HRV/RMSSD.**

**Every validated study used the torch.** Mather et al., verbatim: *"Eight studies (80%) reported which camera recorded smartphone PPG measurements, of which the rear-facing camera was utilized for all with torch (flash) turned on."* Ambient-only finger PPG was attempted by **none of the ten studies** — it is **Unverified and unsupported**, and mechanistically a finger over a dark lens is shot noise. Screen-as-illuminator for *finger* PPG is also **Unverified** (no study exists), and there is no web API to set screen brightness.

#### Face rPPG is materially worse — don't substitute it

| Study | Result |
|---|---|
| [Coppetti 2017](https://pubmed.ncbi.nlm.nih.gov/28464700/) (same patients, same session as the contact apps) | Non-contact apps **MAE 7.1 ± 1.4** (r = 0.62) and 8.1 ± 1.4 (r = 0.60) — **2–4× worse, head to head** |
| [Liao et al., *Nature* 2026;655:728](https://pmc.ncbi.nlm.nih.gov/articles/PMC13372663/), lab, 1,731 videos | bias −0.7 bpm but **95% LoA −12.9 to +11.5 bpm**; success 78.4% at rest, 62.1% post-exercise |
| [Liao 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC13372663/), free-living, 158,471 videos | MAE 3.59 bpm — **but measurement success only 43.1%**, and by skin tone (MST 1–4 / 5–7 / 8–10) success was **58% / 45% / 25%** |
| [Cramer et al., *J Clin Monit Comput* 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC13562297/), ICU, 24 h, 35 patients | bias 2.1 bpm, **95% LoA −33.6 to +37.7 bpm**, ICC 0.43 |

Headline rPPG MAEs are computed only on the measurements the algorithm *chose to emit*. A browser app running classical CHROM/POS on a 30 fps front camera will be worse than every row above.

#### Failure modes to design for

- **Motion:** [Bent et al., *npj Digital Medicine* 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7010823/) — *"absolute error during activity was, on average, 30% higher than during rest."*
- **Skin tone — be precise.** For **SpO2** the bias is strong and replicated ([Sjoding et al., *NEJM* 2020](https://pmc.ncbi.nlm.nih.gov/articles/PMC7808260/): occult hypoxaemia in 11.7% of Black vs 3.6% of White patients). For **HR from contact PPG** it is weak-to-absent (Bent et al. found *"no statistically significant difference in accuracy across skin tones"*). For **face rPPG yield** it is large and documented (58/45/25% above). Correct framing: melanin barely affects torch-lit finger contact PPG; it strongly affects face rPPG success rates.
- **Cold fingers / low perfusion:** FDA's pulse-oximeter guidance names *"poor circulation, skin pigmentation, skin thickness, skin temperature"* and advises keeping the hand *"warm, relaxed, and held below the level of the heart."* (⚠️ that fda.gov URL now 404s; text from a Wayback snapshot.) Corroborated for cameras: [Cramer 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC13562297/) found norepinephrine significantly reduced agreement.
- **Arrhythmia corrupts the number itself**, not just the confidence: in AF the beat intervals are irregular so an FFT bpm is a poorly-defined average. **Any single number shown during AF is misleading by construction.**
- **No exposure lock on iOS.** You can lock white balance (`applyConstraints({ whiteBalanceMode: 'manual' })`, 17.4+) but **exposure is an explicit `// FIXME: add exposureMode` in WebKit's IDL**. With a finger over a torch-lit lens, auto-exposure will hunt and inject drift right in the 0.7–4 Hz band. Mitigate: lock white balance, detrend hard, discard the first few seconds.
- **Frame timing is not isochronous.** `requestVideoFrameCallback` is driven by the compositor. **Timestamp every frame and resample to a uniform grid before any FFT** — [Finotti et al. 2026](https://pmc.ncbi.nlm.nih.gov/articles/PMC13407969/) had to resample to a fixed 60 Hz.

#### Do not build: AF, blood pressure, SpO2, glucose

- **Atrial fibrillation.** Pooled numbers look great — [Gill et al., *Heart* 2022 (28 studies, 11,404 participants)](https://pmc.ncbi.nlm.nih.gov/articles/PMC9554073/): sensitivity 94%, specificity 97% — but the authors' own conclusion is *"current evidence is limited to small, biased, low-quality studies with unrealistically high sensitivity and specificity"*, and **none of the 28 studies met all QUADAS-2 criteria.** FibriCheck and Preventicus are regulated devices with clinical files. An unvalidated rhythm heuristic is a false-reassurance hazard.
- **Blood pressure — the cautionary tale.** FTC action: [*Aura Labs, Inc.*](https://www.ftc.gov/legal-library/browse/cases-proceedings/152-3150-aura-labs-inc), Dec 2016, over "Instant Blood Pressure" claiming to be *"as accurate as a traditional blood pressure cuff"*; judgment $595,945.27. The science: [Plante et al., *JAMA Internal Medicine* 2016;176(5):700](https://pmc.ncbi.nlm.nih.gov/articles/PMC4922794/), n = 85 — **mean absolute difference 12.4 ± 10.5 mmHg systolic**, sensitivity for hypertensive BP **0.22**, and the decisive sentence: *"approximately four-fifths (77.5%) of individuals with hypertensive BP levels will be falsely reassured that their BP is in the nonhypertensive range."* A [follow-up](https://pubmed.ncbi.nlm.nih.gov/31304313/) notes *"Systematic underreporting of elevated BPs may have been a contributor to the app's success"* — **a falsely reassuring health app gets better reviews.** Still unsolved in 2026: [BMJ Open 2026](https://pubmed.ncbi.nlm.nih.gov/42331583/), Fitzpatrick V–VI, systolic MAE 15.4 mmHg with **sensitivity 0.00 in Fitzpatrick VI**.
- **SpO2.** FDA: OTC oximeters *"include smart phone apps developed for the purpose of estimating oxygen saturation"* and *"do not undergo FDA review"*; even for cleared hardware, *"if an FDA-cleared pulse oximeter reads 90%, then the true oxygen saturation… is generally between 86-94%."* An RGB camera has no physical basis for a calibrated ratio-of-ratios.
- **Glucose — the most important citation here, because the app is for people with diabetes.** [FDA Safety Communication, 21 Feb 2024](https://www.fda.gov/medical-devices/safety-communications/do-not-use-smartwatches-or-smart-rings-measure-blood-glucose-levels-fda-safety-communication), verbatim: *"The FDA has not authorized, cleared, or approved any smartwatch or smart ring that is intended to measure or estimate blood glucose values on its own,"* and *"Taking too much of these medications can quickly lead to dangerously low glucose, leading to mental confusion, coma, or death within hours of the error."* **Nothing in this app should ever estimate, infer, trend or hint at blood glucose.** (Note: the oft-cited "FTC action on glucose wearables" does not exist — the real document is this FDA communication.)

#### How to word it: FDA General Wellness

[FDA, *General Wellness: Policy for Low Risk Devices*](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices) ([PDF](https://www.fda.gov/media/90652/download)) — **note the current edition is dated 6 January 2026 and supersedes the 2019 version.** It added a section that is precisely this use case, verbatim:

> *"FDA may consider certain products that use non-invasive sensing (e.g. optical sensing) to estimate, infer, or output physiologic parameters … to be general wellness products when such outputs are intended solely for wellness uses, and provided they … are not intended to substitute for an FDA-authorized, cleared, or approved device; do not include claims, functionality, or outputs that prompt or guide specific clinical action or medical management; and do not include values that mimic those used clinically unless validated … to reflect those values."*
>
> *"Products that meet the aforementioned criteria may display values, ranges, trends, baselines, or longitudinal summaries, and may contextualize these outputs in relation to sleep, activity, stress, recovery, or similar wellness domains."*

Disqualifying, also verbatim: *"references to specific diseases, clinical conditions, or diagnostic thresholds"*; *"alerts, alarms, or prompts that recommend or require specific clinical action"*; *"claims of clinical equivalence, clinical accuracy, medical or clinical grade, or substitution"*. The "see a doctor" carve-out is allowed only if it *"do[es] not identify or name a specific disease or medical condition; do[es] not characterize the output as abnormal, pathological, or diagnostic; do[es] not include clinical thresholds…; and do[es] not provide ongoing alerts or monitoring intended to manage a disease or condition."* EU equivalent: [MDR 2017/745 Recital 19](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32017R0745) — *"software intended for life-style and well-being purposes is not a medical device"* (MDCG 2019-11 and Annex VIII Rule 11 are **Unverified** — could not be retrieved).

**Safe copy:** "Estimated resting pulse — a wellness estimate, not a medical measurement." · "Pulse estimate: 68 bpm (low confidence — hold still and try again)." · "Your own baseline: 64 bpm. Today: 71 bpm." · "Couldn't get a usable signal. Cold hands, movement or dim light will do that." · "For anything you'd act on, use a chest strap or ask your clinician."

**Never:** "Your heart rate is 68 bpm" (stated as fact) · "Possible atrial fibrillation detected" · "clinical-grade" / "as accurate as a chest strap" · "above the normal range — this may indicate…" · "Use this instead of your cuff/meter" · "FDA approved".

**Design rules that fall out of the text:** always render a signal-quality indicator, and make **"no reading" a first-class, non-apologetic outcome** below a quality threshold. Prefer trend + personal baseline over absolutes (explicitly permitted). Offer a **supine/supported measurement posture** — Bolkhovsky et al. measured supine with LoA 0.29 bpm, and FDA's advice is hand warm, relaxed, below heart level. That also suits a lower-back injury.

#### Nothing off the shelf

| Repo | Licence | Blocker |
|---|---|---|
| [prouast/heartbeat-js](https://github.com/prouast/heartbeat-js) (113★) | **GPL-3.0** | Viral copyleft would infect the PWA; needs OpenCV.js; *"tracking is disabled"* |
| [Rouast-Labs/vitallens.js](https://github.com/Rouast-Labs/vitallens.js) (MIT, active) | MIT | Flagship method **requires an `apiKey`** → disqualified. But it bundles MIT *"Implementations of classic rPPG algorithms (`pos`, `chrom`, `g`) for local, API-free processing"* — those are usable. Face only |
| [jones7000/heart-detect](https://github.com/jones7000/heart-detect) | **none** | Only repo documenting iOS Safari, but no licence file → legally unusable |
| Several others | none / MIT | Hobby demos |

**Every browser project in this space is face rPPG — there is no browser finger-contact PPG library.** Combined with the torch finding, that is an opportunity rather than a warning: the validated modality is unoccupied in the browser because everyone believed the torch was unreachable. The pipeline is ~200 lines you should write yourself: channel mean → uniform resample → detrend → 0.7–4 Hz bandpass → FFT or peak detection over a 20–30 s window.

**Recommendation:** **use with fallback** — torch-lit finger PPG as a clearly-labelled wellness estimate, with manual entry always available. **Avoid** Web Bluetooth as anything but a desktop-Chrome extra, and avoid HRV, AF, BP, SpO2 and glucose entirely.

---

---

## 4. Reminders (water, posture breaks, movement)

This is the area where the honest answer differs most from the intuitive one. Be precise.

### What each mechanism actually does on iOS

| Mechanism | Works on iOS? | Works when the app is **closed**? | Needs a server? |
|---|---|---|---|
| `new Notification(...)` / `registration.showNotification()` while the app is **open** | **Yes — installed PWA only, iOS 16.4+** | No | No |
| `setTimeout` / `setInterval` + `showNotification` | Yes, **only while in the foreground** | No | No |
| **Web Push** (`PushManager.subscribe`) | **Yes — installed PWA only, iOS 16.4+** | **Yes** | **Yes — unavoidably** |
| **Declarative Web Push** | Yes, iOS 18.4+ | Yes | **Yes** |
| **Notification Triggers** (`showTrigger`/`TimestampTrigger`) | **No — never shipped in any browser** | — | — |
| Background Sync / Periodic Background Sync | **No** | — | — |
| **Badging API** (`navigator.setAppBadge`) | **Yes — home-screen web apps, iOS 16.4+** | Only updated when code runs | No (to set it) |

### Notifications require an installed PWA on iOS — in a tab the API does not exist

MDN BCD is unusually explicit:

> *"The `Notification` interface is **undefined**, unless the page is a web app saved to the home screen. The app's manifest must have a non-default `display` value."* — [BCD `api/Notification.json`](https://github.com/mdn/browser-compat-data/blob/main/api/Notification.json)

The constructor *throws a `ReferenceError`* in a tab. `ServiceWorkerRegistration.showNotification`, `getNotifications` and `pushManager` carry the same note: *"Notifications are supported in web apps saved to the home screen."* All arrived in **iOS 16.4**.

WebKit's announcement matches: *"we are adding support for Web Push to Home Screen web apps"*, *"A web app that has been added to the Home Screen can request permission to receive push notifications"*, permission must be *"in response to direct user interaction"*, and notifications *"show on the Lock Screen, in Notification Center, and on a paired Apple Watch"* and *"integrate with Focus"* — [Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

Two important practical gaps on iOS (from BCD): `Notification.tag` and `Notification.silent` are **not supported** (`version_added: false`). No tag means **you cannot replace/coalesce an existing notification**; repeated reminders will stack.

**Good news for installability:** from iOS/iPadOS 26, *"By default, every website added to the Home Screen opens as a web app"*, and installability now has *"zero prerequisites"* — a manifest is honoured but no longer required ([WebKit Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)). Keep a manifest with `display: "standalone"` anyway for older iOS; note that `display: fullscreen` and `minimal-ui` are **not** supported on iOS ([BCD `manifests/webapp/display.json`](https://github.com/mdn/browser-compat-data/blob/main/manifests/webapp/display.json)).

### Notification Triggers: dead everywhere

Chrome Platform Status lists **Notification Triggers** (feature 5133150283890688) as *"In developer trial (Behind a flag)"* with **no desktop shipping version**. It never shipped by default in any browser and the explainer's README has not been touched since 2019 ([Chrome Platform Status](https://chromestatus.com/feature/5133150283890688), [explainer](https://github.com/beverloo/notification-triggers)). Do not plan around it.

### Web Push always needs a sender — but the sender need not be a server *we run*

Web Push is a *push* protocol: something must POST an encrypted payload, signed with your VAPID key, to the subscription endpoint (`*.push.apple.com` for iOS). WebKit confirms iOS uses *"the same Apple Push Notification service that powers native push on all Apple devices"*, that you *"do not need to be a member of the Apple Developer Program"*, and that the subscribe call still passes an `applicationServerKey` ([Web Push post](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Meet Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/)).

Also note WebKit's enforcement rule: with classic Web Push the service worker **must** display a notification for each push or the subscription can be revoked. Declarative Web Push (iOS 18.4+) removes that penalty — *"there is no penalty for service workers failing to display a notification"* — and can show a notification with no service worker at all, via a JSON payload opted in with `"web_push": 8030`.

**The zero-infrastructure sender that actually exists: a GitHub Actions scheduled workflow.** Same repo, same free tier, nothing to operate. It stores the VAPID private key and the user's subscription JSON as repo secrets and POSTs on a cron. Caveats, straight from GitHub's docs ([Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)):

- *"The shortest interval you can run scheduled workflows is once every 5 minutes."*
- *"The `schedule` event can be delayed during periods of high loads"*, *"High load times include the start of every hour"*, and *"If the load is sufficiently high enough, some queued jobs may be dropped."*
- *"In a public repository, scheduled workflows are automatically disabled when no repository activity has occurred in 60 days."*

So: good enough for "drink water", "stand up and walk", "evening check-in". **Not** good enough for anything time-critical, and it needs the repo private (or periodically touched) plus a one-time secret setup. Also note this stores a personal subscription endpoint in repo secrets — fine for a single-user app, not for a shareable one.

### The honest alternative with literally no sender: generate a calendar file

The reliable, fully offline way to make iOS fire a notification at a chosen time is to have **iOS itself** own the schedule:

- Generate an **iCalendar (`.ics`)** file client-side containing recurring `VEVENT`s with `VALARM` display triggers (RFC 5545, [§3.6.6 VALARM](https://datatracker.ietf.org/doc/html/rfc5545#section-3.6.6)), one per reminder (water every 2 h 09:00–21:00, posture break hourly, evening walk).
- Hand it to the user via a `Blob` download or `navigator.share({ files })` (both supported — §9). Tapping an `.ics` on iOS offers to add the events to Calendar, and Calendar then fires native alerts with zero involvement from us. Put a deep link back into the PWA in the event `URL`/description.
- The exact iOS handoff from a PWA-generated blob, and whether alerts fire for *subscribed* (`webcal://`) calendars by default, are **Unverified** — test both on device before committing. Apple's support pages would not render for verification.

This is less elegant than push but it is robust, needs nothing from us, keeps working if GitHub Actions is disabled, and survives the app being uninstalled.

### Badging

`navigator.setAppBadge()` / `clearAppBadge()` — **iOS Safari 16.4+**, with the BCD note *"Badging is supported for web apps saved to the home screen"*, plus the gotcha *"Passing `0` as an argument will clear the badge instead of displaying an unnumbered dot"* ([BCD `api/Navigator.json`](https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json)). WebKit adds that badges work *"while the web app is handling push events in the background"* and *"even before permission to display the count has been granted"*. Useful as a passive nudge — set the badge to the number of outstanding reminders on each app open.

### Recommendation

- **Use:** in-app scheduled reminders (foreground), Badging, generated `.ics` for anything that must fire while the app is closed.
- **Use with fallback:** Web Push via a GitHub Actions cron sender, for a single user, with the delay/drop/60-day caveats documented in the UI.
- **Avoid:** Notification Triggers, Background Sync, any design that assumes the service worker wakes up on its own.

---

## 5. Apple Health / Google Fit data

### Reading or writing HealthKit from a web page: no. Definitively.

Apple's own documentation API lists HealthKit's platforms as **iOS 8.0, iPadOS 8.0, Mac Catalyst 17.0, macOS 14.0, visionOS 1.0, watchOS 2.0** ([HealthKit](https://developer.apple.com/documentation/healthkit)). **The web is not among them.** HealthKit is a native framework (Swift/Objective-C); there is no JavaScript API, no REST endpoint, no URL scheme and no browser-accessible interface. Apple's description — *"HealthKit provides a central repository for health and fitness data on iPhone and Apple Watch. With the user's permission, apps communicate with the HealthKit store"* — is explicitly about apps on the device. Authorization is per-app, per-data-type, read and write separately, via a system sheet, and an app cannot even tell whether *read* access was denied.

**Confirmed. There is no live Apple Health integration available to a PWA, at any price, with or without a backend.** The only route is a native companion app, which is out of scope.

**Google Fit is also closing, and its replacement is Android-native.** The Google Fit docs carry a deprecation banner: the Google Fit APIs including the REST API *"will be deprecated in 2026"*, and *"As of May 1, 2024, developers cannot sign up to use these APIs"* ([Google Fit Android getting started](https://developers.google.com/fit/android/get-started)). The stated replacement is **Health Connect**, which is an Android on-device API with no web surface. **No free, keyless web path exists.**

### The one real import path: the Apple Health manual export

**How the user gets it:** Health app → tap the profile picture top-right → scroll to the bottom → **"Export All Health Data"** → confirm → iOS builds a zip and hands it to the share sheet.

**What's in it** (confirmed from open-source importers that read real exports):

```
export.zip
└── apple_health_export/
    ├── export.xml            ← everything: all HKQuantityType / HKCategoryType records
    ├── export_cda.xml        ← the same clinical data as HL7 CDA (much larger, usually ignorable)
    ├── electrocardiograms/   ← one CSV per ECG (Apple Watch Series 4+ only)
    └── workout-routes/       ← one GPX file per outdoor workout with GPS
```

**`export.xml` shape** — an inline DTD followed by:

```xml
<HealthData locale="en_IN">
  <ExportDate value="2026-01-22 10:14:07 +0530"/>
  <Me HKCharacteristicTypeIdentifierDateOfBirth="…" HKCharacteristicTypeIdentifierBiologicalSex="…" …/>
  <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" sourceVersion="…"
          unit="count" creationDate="2014-09-13 10:27:54 +0100"
          startDate="…" endDate="…" value="112"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" value="HKCategoryValueSleepAnalysisAsleepCore" …/>
  <Workout workoutActivityType="HKWorkoutActivityTypeWalking" duration="…" durationUnit="min" …>
    <MetadataEntry …/> <WorkoutRoute …/>
  </Workout>
  <ActivitySummary dateComponents="2026-01-21" activeEnergyBurned="…" appleExerciseTime="…" …/>
</HealthData>
```

Two parsing details that will bite you: **the date format is `"2014-09-13 10:27:54 +0100"`** — a space, not a `T`, so `new Date()` is unreliable; parse it yourself. And **`unit` is CDATA per Apple's DTD and is per *record*, not per type** — the same `HKQuantityTypeIdentifier` can appear with different units across records, so never assume a unit from the type name.

**Size — Apple publishes nothing, so every figure here is third-party:**

| Profile | Uncompressed | Source |
|---|---|---|
| 1 year, no Apple Watch | **30–80 MB** | [aihealthexport.com guide](https://www.aihealthexport.com/guides/apple-health-xml-format) |
| **5 years, Apple Watch worn daily** | **200–500 MB** | same |
| 10+ years, multiple apps | **800 MB – 1.5 GB** | same |
| A real 2015–2020 iPhone-only export | `export.xml` **118 MB**, `export_cda.xml` **249 MB** | [simonkrenger/apple-health-to-fitbit](https://github.com/simonkrenger/apple-health-to-fitbit) directory listing |
| In the wild | *"Apple Health exports can be very large (500MB+)"*; *"This file can be 100s of MB"*; one ingest tool *"Streams the 1.5 GB export.xml with iterparse"* | [big-mood-detector](https://github.com/Clarity-Digital-Twin/big-mood-detector/blob/main/data/README.md), [rckwzrd](https://rckwzrd.github.io/2023/01/26/parsing-apple-health-data.html), [HealthLens](https://github.com/danpercic86/HealthLens/blob/main/tools/health-export/preprocess.py) |

The zip is roughly **30–40% of the unzipped size**, and `export.xml` is *"usually 95%+ of the .zip's size"*. ⚠️ Note the 249 MB `export_cda.xml` above is unusual — CDA is normally near-empty for a consumer unless a hospital/clinical account is linked, so don't size your budget around it. **Plan for 200–500 MB as the realistic case and up to ~1.5 GB as the tail.**

**The memory trap is the real constraint, not the disk size.** Simon Willison on `healthkit-to-sqlite`: *"the script still uses over 1GB of RAM"* **even with a pull parser** ([issue #7](https://github.com/dogsheep/healthkit-to-sqlite/issues/7)). Against Apple's ~1.5 GB WebContent process cap (§7), that means **you must aggregate as you stream and never retain parsed records.**

### Can an iOS PWA actually receive that zip? Yes — via one path only

| Mechanism | iOS | Verdict |
|---|---|---|
| **`<input type="file">`** picking the zip from the Files app | **Yes — confirmed** | **The only inbound path.** See the `accept` quirk below |
| **Web Share Target** (`share_target` manifest) | **No** | Unsupported in Safari and iOS Safari ([BCD](https://github.com/mdn/browser-compat-data/blob/main/manifests/webapp/share_target.json)); impl bug [194593](https://bugs.webkit.org/show_bug.cgi?id=194593) still NEW; WebKit's standards position is *neutral* ([#11](https://github.com/WebKit/standards-positions/issues/11)). Safari 27.0's release notes contain **zero** mentions of "Share Target" or "manifest". **You cannot appear in the iOS share sheet.** |
| `file_handlers`, `protocol_handlers`, `launch_handler`, `LaunchQueue`, `window.showOpenFilePicker` | **No** (all `false` in BCD for Safari and iOS Safari) | — |
| Drag and drop | n/a on iPhone | — |

**A useful iOS quirk: the `accept` attribute is effectively ignored.** WebKit bug [279606](https://bugs.webkit.org/show_bug.cgi?id=279606) (NEW, filed 2024-09-12): *"On iOS, any file can be selected, as if the accept attribute had not been specified"*, and bug [142614](https://bugs.webkit.org/show_bug.cgi?id=142614) notes `_UTIsForMIMETypes` *"only supports image and video MIME types"*. So nothing greys out a `.zip` — a plain `<input type="file">` works. Supply `accept=".zip,application/zip,application/x-zip-compressed"` anyway for desktop, and don't rely on it for validation. The tap opens the **Files document picker**; "On My iPhone" local storage works, though bug [306211](https://bugs.webkit.org/show_bug.cgi?id=306211) (iOS 26.2) reports some third-party cloud providers (e.g. OneDrive) can't be selected.

**So the import flow is necessarily: Export → Save to Files → open the PWA → tap Import → pick the zip.** Four steps, unavoidable, and worth writing into the UI copy rather than hiding.

### Parsing it in the browser without melting the phone

Everything needed is free and mostly built in:

1. **Unzip.** [`fflate`](https://github.com/101arrowz/fflate) (**MIT**, ~8 KB gzip, zero deps, has a streaming `Unzip` class and a worker-based async API) or [`zip.js`](https://github.com/gildas-lormeau/zip.js) (**BSD-3-Clause**, supports `ReadableStream` end to end). Prefer `fflate`'s streaming unzip so you never hold the whole `export.xml` in memory. **Note the browser's own `DecompressionStream` cannot help** — it does gzip/deflate, not the ZIP container format.
2. **Stream the XML.** Do **not** use `DOMParser` — a 500 MB string will exceed the ~1.5 GB WebContent process cap (§7) and crash the tab with no catchable error. Use a chunked SAX parser: [`saxes`](https://github.com/lddubeau/saxes) (**ISC**, a maintained fork of sax-js, pure JS, feeds it chunk by chunk) or `sax-js` (ISC). Pipe `ReadableStream → TextDecoderStream → saxes.write(chunk)` and aggregate as you go.
3. **Do it in a Worker.** `MediaStreamTrackProcessor` aside, this is the clearest case for a Worker: the import must not block the UI for minutes. (A Worker *does* work on iOS — it is only MediaPipe's `createFromOptions` that hangs there, §8b.)
4. **Aggregate, don't store raw.** A multi-GB export has tens of millions of `<Record>` elements. **Fold them into daily (or hourly) buckets per metric per source as you stream, and persist only the buckets to IndexedDB.** You get an all-day step history, resting HR, sleep and workouts in a few hundred KB.
5. **Checkpoint.** iOS can kill the process. Persist progress per chunk so a re-import resumes rather than restarts.

### Other free import paths

| Format | Where it comes from | Parsing |
|---|---|---|
| **GPX** | Apple Health's own `workout-routes/`, Strava bulk export, almost every watch | Plain XML, small, trivial to parse with `DOMParser`. **The highest-value / lowest-effort import in this whole report** |
| **TCX** | Garmin and older devices | XML with laps + trackpoints incl. HR |
| **FIT** | Garmin/Wahoo native | Binary. Free JS parsers exist (e.g. `fit-file-parser`, MIT) but it's the most work for the least additional benefit |
| **Strava bulk export** ("Download all your activities" under Settings → My Account) | `activities.csv` plus one `.gpx`/`.fit`/`.tcx` per activity | CSV + GPX covers it. **The Strava *API* needs a registered OAuth client ID and secret** — a secret in a static bundle is published, and the implicit-flow-only options don't exist, so **the API is disqualified by the no-key constraint; the bulk export is not.** |
| **Google Takeout** (Fit section) | Takeout → "Fit" | Survives the API shutdown because it's a user-initiated export. Format is JSON/CSV per data type (**Unverified** — not inspected) |
| **Plain CSV** | anything the user can produce | Offer a documented column format as the universal escape hatch |

**Recommendation: use.** Build **GPX import first** (small, standard, immediately useful, and it is what Apple Health itself emits for routes), then an **aggregating streaming importer for `export.xml`** as the way to get real all-day step/HR/sleep history that the web platform cannot measure itself (§1). **Avoid** any design that assumes a live Apple Health or Google Fit connection.

---

---

## 6. Food and nutrition data, free and bundleable

### The four decisions up front

| Question | Answer |
|---|---|
| Open Food Facts for barcoded packaged food? | **Yes** — genuinely open (ODbL), no API key, **CORS confirmed working**. But Indian nutrition coverage is only ~15%, and bundling a subset triggers ODbL share-alike |
| A redistributable Indian food composition dataset to bundle? | **No. There isn't one.** IFCT 2017's copyright page prohibits exactly this use. Hand-build a small table |
| USDA FoodData Central? | **Yes, ideal — explicitly public domain / CC0 1.0.** Bundle SR Legacy + Foundation. The API needs a key, so use the downloads |
| `BarcodeDetector` on iOS? | **No.** Off by default in every Safari, and broken even when flag-enabled. Ship a WASM decoder |

### Open Food Facts

**Licences**, verbatim from [world.openfoodfacts.org/data](https://world.openfoodfacts.org/data):

> *"The Open Food Facts database is available under the Open Database License (ODbL). The individual contents of the database are available under the Database Contents License (DbCL). Products images are available under the Creative Commons Attribution ShareAlike licence (CC-BY-SA)."*

So: database → [**ODbL 1.0**](https://opendatacommons.org/licenses/odbl/1-0/); individual contents → [**DbCL 1.0**](https://opendatacommons.org/licenses/dbcl/1-0/); images → **CC-BY-SA**. (⚠️ the Hugging Face dataset card's YAML front-matter declares `license: [agpl-3.0, odbl]` — AGPL-3.0 is the licence of OFF's *software*, not the data. Treat `/data` and `/terms-of-use` as authoritative.)

**Two lines from the Terms matter for a health app:**
> *"Open Food Facts does not guarantee the accuracy of the information and data… **It can contain errors and must not be used for medical purposes.**"*
> *"Re-users have to mention the licence and to attribute the authorship to Open Food Facts"* … *"Derivative works must be shared under the same conditions."*

**What ODbL requires if you bundle a derived subset.** ODbL distinguishes a **Produced Work** (output of a query) from a **Derivative Database** — and §4.4(b) explicitly includes *"Extraction or Re-utilisation of the whole or a Substantial part of the Contents into a new database"*. **A filtered, trimmed JSON of OFF products shipped inside your app is a Derivative Database.** In plain terms:

1. **Attribute (§4.3)** — model wording from the licence: *"Contains information from DATABASE NAME, which is made available here under the Open Database License (ODbL)."* OFF's own string: *"Contains data from Open Food Facts, available under the Open Database License"*, with the name linking to OFF and the licence name to the licence text. OFF also asks for *"Prominent UI attribution… with clickable links"* on product and search screens.
2. **Share-alike (§4.4)** — the **bundled data file itself must be ODbL-licensed.** Your app code can stay whatever licence you like; the data file cannot be relicensed.
3. **Keep open (§4.6)** — you must offer recipients a machine-readable copy of either the whole derivative database or *"a file containing all of the alterations made"*. **On a public GitHub repo serving GitHub Pages you already satisfy this for free** — the derived JSON and the build script that produced it are in the repo. Point to them from the attribution notice. This is the cheapest compliance path and it falls out of the architecture.
4. Keep notices intact (§4.2); no DRM (§4.7); **purely internal use triggers nothing (§4.5)**.

There is also an [ODbL non-compliance registry](https://wiki.openfoodfacts.org/ODBL_non-compliance) (**Unverified** — the wiki is behind bot protection).

**Bulk exports — measured `Content-Length`, today:**

| Export | Measured | Page's published claim |
|---|---|---|
| MongoDB dump (gz) | **14.88 GiB** | not stated |
| JSONL (gz) | **12.19 GiB** | not stated |
| **CSV (gz, tab-separated)** | **1.19 GiB** | "~0.9 Gb" — **stale** |
| CSV uncompressed | **12.15 GiB** | "~9 Gb" — **stale** |
| **Parquet (`food.parquet`**, official, on HF**)** | **7.35 GiB** | not stated |
| `beauty.parquet` | 60.9 MiB | — |
| Daily deltas | 22–36 MB each, 13 files in the index | "14-day window" |
| RDF | not probed | *"an experiment, not actively maintained anymore"* |

The CSV has **211 columns** and includes everything useful (`code`, `product_name`, `brands`, `countries_en`, `energy-kcal_100g`, macros, `fiber_100g`, `sugars_100g`, `saturated-fat_100g`, `sodium_100g`, `salt_100g`, `serving_size`, `nutriscore_grade`, `nova_group`). It redirects to S3 and **supports HTTP Range requests**, so a build step can stream it rather than download 1.19 GiB. The Parquet is official (4.86M rows, ~111 columns) and linked from `/data`.

**Reduced datasets.** No static per-country or per-field export exists, but the **advanced-search CSV export works** (measured: `?tagtype_0=countries&tag_0=india&download=on&format=csv` → 200, 11.5 MB, 7,851 rows). Two hard caveats: it is **capped at 10,000 products** (`$options{export_limit} = 10000;` in OFF's own `Config_off.pm`), and the **`fields=` parameter is broken** (HTTP 500 from `Export.pm` line 288) so you get all 1,207 columns or nothing.

**⚠️ The finding that should change the plan: OFF's Indian nutrition data is very sparse.** Measured two independent ways — stream-filtering the full 1.19 GiB CSV found **20,497 rows** mentioning India, of which only **1,803 (9%)** had a parseable `energy-kcal_100g`; the search index gives exact counts of **3,462** Indian products with kcal and **4,067** marked `nutrition-facts-completed` against **7,798** marked `to-be-completed`. **Call it ~15% of 20,500–24,700 Indian products with usable nutrition.** A barcode scan of an Indian grocery item will usually find the product but **not** its nutrition. Design for the miss case and do not promise barcode-driven macro logging for the Indian market. (An India-only trimmed JSON of 16 fields is tiny: **1.68 MB minified / 0.40 MB gzipped**, or 0.30/0.08 MB restricted to rows with energy.)

**The read API: free, keyless, CORS-enabled.** Official docs: *"READ operations … do not require authentication other than the custom User-Agent."* Measured preflight from a `*.github.io` origin returned `204` with `access-control-allow-origin: *` and `access-control-allow-headers: DNT,User-Agent,X-User-Agent,…`.

**⚠️ The User-Agent problem is solved — use `X-User-Agent`.** Browsers cannot set `User-Agent`, and OFF added `X-User-Agent` precisely for this. Merged [PR #13348](https://github.com/openfoodfacts/openfoodfacts-server/pull/13348) (2026-03-31), verbatim: *"This is to allow web app to send us a X-User-Agent header as they cannot modify the User-Agent header."* The server reads it in `cgi/search.pl`. Send `X-User-Agent: YourApp/1.0 (your@email)`. The docs haven't caught up ([issue #5264](https://github.com/openfoodfacts/openfoodfacts-server/issues/5264) open since 2021).

**Rate limits**, verbatim from OFF's docs: *"15 req/min/IP address for all read product queries"*; *"10 req/min/IP address for all search queries … **don't use it for a search-as-you-type feature, you would be blocked very quickly**"*; *"If your requests come from your users directly (ex: mobile app), the rate limits apply per user"* (good news for a client-side PWA); *"If you need to fetch more than a few hundred products, we ask you to download the data as a CSV or JSONL file directly."*

**Three API gotchas worth designing around:**
- **🚨 429 responses carry NO CORS headers** ([open issue #13475](https://github.com/openfoodfacts/openfoodfacts-server/issues/13475)). In the browser your `fetch` therefore rejects with an opaque network error — **you cannot distinguish "rate limited" from "offline".** Keep a client-side budget (≤15/min) and treat opaque failures as probable throttling.
- **API v2 is deprecated** — use **v3** (keyless, CORS `*`, latest v3.6).
- **No full-text search in the browser.** v2/v3 offer structured filter search only, and `search.openfoodfacts.org` (which does have the right query language) returns **no `Access-Control-Allow-Origin` header at all** — measured on both GET and the OPTIONS preflight, so a browser on GitHub Pages cannot call it. Country-filtered v2 queries also proved unreliable (worked once, then HTTP 503 for the rest of a session, consistent with OFF's documented global rate limits shedding expensive queries first). **Another argument for bundling your own searchable table.**

### Indian food composition data: there is no cleanly licensed, redistributable dataset

**IFCT 2017 — freely downloadable, explicitly not redistributable.** The PDF is free at [nin.res.in/ebooks/IFCT2017.pdf](https://www.nin.res.in/ebooks/IFCT2017.pdf) (measured: 12,401,190 bytes, 585 pages, 151 components × 528 key foods across six regions). **PDF only** — no Excel, CSV, database or API, and `pdfinfo` reports the file is AES-encrypted with the copy/extract permission bit denied. The book itself says the richer data is unpublished: *"The region specific database is available in the electronic version at the National Institute of Nutrition (NIN)."* The official domains printed in the book are dead or hijacked (`ifct2017.com` → HTTP 521; `ninindia.org` → redirects elsewhere; `ninindia.icmr.org.in` → NXDOMAIN).

**The copyright page (p.4), verbatim — this is dispositive:**

> *"The use and dissemination of the data in this book is encouraged. This publication can be reproduced for personal use with full acknowledgment of the source. **However, no part of this publication can be stored or reproduced in any electronic format for creating a product without the prior written permission of the National Institute of Nutrition, Hyderabad.**"*

That second sentence describes this exact use case. There is **no open licence, no CC licence, no public-domain dedication.** The site-wide terms at nin.res.in add an anti-scraping clause naming *"using scrapping automated softwares"*. Required citation: *Longvah, T., Ananthan, R., Bhaskarachary, K. and Venkaiah, K. (2017). Indian Food Composition Tables 2017, National Institute of Nutrition, ICMR, Hyderabad.*

**NVIF ("Nutritive Value of Indian Foods", Gopalan et al.)** — not available online at all, at any price. NIN's own books page marks it *"Available at NIN Book Counter"* (₹130) versus IFCT-2017's *"Also available ONLINE!"*. No free PDF, no licence statement.

**Every candidate "open" dataset, and what the licence actually is:**

| Source | Claimed licence | Reality |
|---|---|---|
| **data.gov.in / GODL** | Government Open Data Licence – India | **Licence is genuinely good — but there is no food composition data under it.** Querying the portal's own backend (356,951 resources): `IFCT` → 0 results; `nutrient` → 35 results, **all fertilizer subsidy data**; `ICMR` → 22, all cancer registry |
| **Kaggle** Indian-nutrition datasets | uploader-declared | **Unreliable. Uploaders cannot grant rights they don't hold.** Kaggle does not verify the `licenses` field. Treat every one as presumptively IFCT-derived |
| `nodef/ifct2017` (59★) | **AGPL-3.0** (was MIT across 765 versions until 2025-04-18) | **Invalid as to the data, and hostile copyleft.** README admits *"Data was obtained from the book [IFCT 2017]"*; ships a 1.15 MB complete digitisation. **Unilaterally relicensing someone else's data twice is itself the evidence these licences track preference, not title** — and AGPL would reach your whole PWA |
| `nithyamani/IndianFoodComposition` | **none** | Default exclusive copyright, and the README documents the scraping: *"reads the content from page # 539 to page #572 (INDEX) in the IFCT PDF file"* |
| `pantryf/*`, `chinmaykhopde/*`, `narmidm/columns`, `nimeshvaghasiya/nutrients` | MIT | Derived from the MIT-era `nodef` data. Same title problem |
| **FAO/INFOODS** | none stated | **No South Asia regional FCT**; the India entry just points at the dead `ifct2017.com` |
| **FAO/WHO GIFT** | `CC_by` badge | **Wrong data type** — individual dietary *intake* microdata, not composition |
| `akashthawaitcc/sangat-food-db` | CC BY-SA 4.0 | README claims 200+ dishes; **the repo contains exactly one** (`dal-tadka.json`, 783 B). And its premise is factually wrong — it calls IFCT 2017 a *"public domain government publication"*. Useful as a **schema template** only |
| "Anuvaad" / "IndianFoodDB" | — | Name confusion: `project-anuvaad/anuvaad` is a document-translation platform. GitHub search for "IndianFoodDB": **0 results** |

On GODL specifically — it *would* be ideal. [Gazette of India notification](https://www.data.gov.in/sites/default/files/Gazette_Notification_OGDL.pdf) §3 grants *"a worldwide, royalty-free, non-exclusive license to use, adapt, publish … and create derivative works (including products and services), for all lawful commercial and non-commercial purposes"* — effectively CC-BY. But **§6(b) excludes "Data that the data provider(s) is not authorized to license", so a GODL badge cannot launder ICMR-NIN copyright.**

**The legal nuance — and it works in your favour.** Under the [Indian Copyright Act 1957](https://copyright.gov.in/documents/copyrightrules1957.pdf), s.2(o) makes *"tables and compilations"* literary works, s.13(1)(a) requires **originality**, and s.28/28A give Government works **60 years** from publication — so **IFCT 2017 is protected until 31 Dec 2077. India has no US-style federal-works public domain**; the widespread "Indian government publication = public domain" belief is wrong, and the s.52(1)(q) fair-dealing exemption reaches only Gazette matter, Acts and committee reports laid on the Table, not a priced institutional monograph.

The controlling case is ***Eastern Book Company v. D.B. Modak*, (2008) 1 SCC 1** ([judgment](https://indiankanoon.org/doc/1062099/)), which adopted the Canadian middle path: *"The sweat of the brow approach to originality is too low a standard"* while *"the creativity standard of originality is too high"*; para 38, directly on compilations — *"To claim copyright in a compilation, the author must produce the material with exercise of his skill and judgment… The trivial variation or inputs put in the judgment would not satisfy the test of copyright."* Applied: routine cross-citations failed; paragraph numbering and internal referencing passed. The injunction covered EBC's **headnotes**, not the underlying judgment text.

Concretely:
1. **A measured nutrient value is a fact, not authored expression.** "Toor dal, raw, 22.3 g protein per 100 g" is a discovery, and facts cannot be owned.
2. **The IFCT table as a compiled whole is almost certainly protected** — 528-food selection, six-region sampling design, 151-component scheme, coding and arrangement is skill and judgment far above *EBC*'s triviality floor.
3. **Wholesale copying infringes** — selection, structure and arrangement travel with the numbers — and separately breaches the copyright-page contract term.
4. **✅ Independently re-expressing individual facts, with your own selection and arrangement, does not infringe.** But heed *EBC*'s free-riding warning: derive from multiple cited sources and record provenance per value; don't transcribe one table and reshuffle it.
5. **India has no sui generis database right** — no second layer to clear. (For comparison: the US is more permissive still — *Feist*, 499 U.S. 340: *"Facts, whether alone or as part of a compilation, are not original and therefore may not be copyrighted"*. The EU's Directive 96/9/EC Art. 7 sui generis right **does not attach to an Indian maker**, per Art. 11.)

**Don't conflate the three hurdles:** (1) copyright, (2) the copyright page's contract/licence term, (3) nin.res.in's site terms. Hand-building from multiple cited sources sidesteps all three.

**Realistic options, ranked:**
1. **Hand-build a ~100-dish table of common Indian foods.** On this evidence it is not a compromise — **it is the only lawful path to bundled Indian nutrition data.** Keep a per-value `sources[]` array: good practice *and* the evidentiary record that you compiled independently. Use your own food list, serving conventions (katori / piece / roti) and columns.
2. **Base ingredient-level values on USDA FoodData Central (CC0)** where coverage allows — legumes, grains, oils, vegetables — and compute composite dishes from recipes.
3. **Cite-and-link IFCT 2017** for cross-checking. Citation is lawful and the book says dissemination *"is encouraged"*. Never redistribute its tables.
4. **Let the user enter their own foods**, persisted locally. Zero licence surface, and it compounds in value.
5. **Use OFF for barcoded Indian packaged products only**, with ODbL credit, expecting the ~15% nutrition hit rate.
6. **Actually ask ICMR-NIN for written permission** (`director.nin@icmr.gov.in`). The copyright page sets up exactly that route and the book encourages dissemination. A one-page request is cheap.
7. **Licence your own table CC BY-SA 4.0 or CC BY 4.0** — it would become the open Indian dish table that demonstrably does not yet exist.

### USDA FoodData Central: the clean option

**Licence — verbatim from [fdc.nal.usda.gov](https://fdc.nal.usda.gov/):**
> *"USDA FoodData Central data are in the public domain and they are not copyrighted. They are published under **CC0 1.0 Universal (CC0 1.0)**. No permission is needed for their use, but we request that users list FoodData Central as the source…"*

**This is the cleanest licensing position of anything in this report — no attribution legally required, no share-alike, no copyleft.** Attribute anyway. (⚠️ the statement is on the homepage and the API guide, not on `/download-datasets/` — cite those URLs.)

**Download sizes (measured zip `Content-Length`) and counts (measured via the search API):**

| Dataset | Format | Measured zip | Foods |
|---|---|---|---|
| **Foundation Foods** (2026-04) | JSON | **0.45 MB** | 394 |
| Foundation Foods | CSV | 3.65 MB | — |
| **SR Legacy** (2018, frozen) | **CSV** | **5.79 MB** | **7,793** |
| SR Legacy | JSON | 12.83 MB | — |
| Survey / FNDDS (2024-10) | CSV | 3.17 MB (⚠️ the page claims 200 MB / 1.6 GB — **wrong**) | 5,428 |
| **Branded Foods** | JSON / CSV | 194.8 MB / 428.0 MB | 433,916 |
| Full download | CSV | 459.2 MB | — |

**Best bundle: SR Legacy CSV (5.79 MB) + Foundation Foods JSON (0.45 MB).** SR Legacy gives 7,793 generic whole foods with deep nutrient coverage — exactly the right shape. **Skip Branded Foods** (428 MB for items you'd reach by barcode anyway, and OFF covers non-US products better).

**How big is a trimmed JSON really? Measured, not estimated** — SR Legacy joined and reduced to id + name + 15 nutrients (energy kcal, protein, fat, carbs, fibre, sugars, sat fat, cholesterol, sodium, potassium, calcium, iron, magnesium, zinc, vitamin C):

| Foods | Minified | **Minified + gzip** | Columnar + gzip |
|---|---|---|---|
| 2,000 | 0.53 MB | **108 KB** | 82 KB |
| 4,000 | 1.06 MB | **214 KB** | 163 KB |
| **all 7,793** | 1.99 MB | **412 KB** | **317 KB** |

≈ 255 B minified / 53 B gzipped per food. **Ship all 7,793; there is no reason to subset** — 412 KB gzipped is smaller than one hero image, and smaller than the barcode WASM you'll need anyway. GitHub Pages gzips automatically (verified).

**The API needs a key — confirmed, therefore disqualified.** Measured: a keyless `GET https://api.nal.usda.gov/fdc/v1/food/1750339` returns **HTTP 403 `API_KEY_MISSING`**. The guide states *"a data.gov API key must be incorporated into each API request"* with *"a default rate of 1,000 requests per hour per IP address"*; `DEMO_KEY` is capped at 30/hour and 50/day. CORS is `*`, so the key is the only blocker — and embedding one in a static bundle publishes it. **This is not a problem: the data is CC0 and the download is 5.79 MB. Bundle at build time and you need no runtime dependency on USDA at all — strictly better than an API for a static PWA.**

### Barcode scanning in the browser

**`BarcodeDetector` on iOS: no.** Four primary sources agree.

1. **WebKit's own source is decisive** — [`UnifiedWebPreferences.yaml`](https://github.com/WebKit/WebKit/blob/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml): `ShapeDetection` has `status: testable` and `defaultValue: false`, with **no per-platform override**. Of 92 preferences with `status: testable`, **exactly zero have `defaultValue: true`** — `testable` means developer builds and the Feature Flags panel only.
2. **MDN BCD**: `safari: 17` **behind a `"Shape Detection API"` preference flag**; `safari_ios: "mirror"`; `firefox: false`; **Chrome desktop 88 but *"Supported on ChromeOS and macOS only"***; **Chrome Android 83** unflagged. So "Chrome/Android-only" is right, and it's narrower than usually assumed — not Windows, not Linux.
3. **caniuse**: Safari on iOS "Not supported" 3.2–16.7, **"Disabled by default" 17.0 → 27.2**.
4. **🚨 It is broken even if you flip the flag.** [WebKit Bug 281848, *"Shape Detection API doesn't work on iOS"*](https://bugs.webkit.org/show_bug.cgi?id=281848) — **status NEW/OPEN**, filed 2024-10-21, last modified 2026-07-21: *"The Shape Detection API was working until Safari 17.6.x when enabled in feature flags but is no longer working… The Shape Detection API does work on macOS Sequoia."* Verified non-working in comments on Safari 18.3, iOS 18.4, iOS 18.5 and the first iOS 26 developer beta.

Nuance: WebKit's *standards position* on the spec is **`support`** ([issue #174](https://github.com/WebKit/standards-positions/issues/174)), so it may ship eventually. It has not. **⇒ Do not feature-detect-and-rely. Ship a decoder — and prefer a *ponyfill* (explicit named import) over a *polyfill* (`globalThis.BarcodeDetector ??= …`), because the polyfill's guard would bind you to the broken native class on a flag-enabled iPhone.**

**Decoder libraries** (sizes measured from published tarballs; downloads for week of 2026-09-28):

| npm package | Version | Licence | JS gzip | WASM raw / gzip | Weekly dl | Status |
|---|---|---|---|---|---|---|
| **`barcode-detector`** | 3.2.2 (2026-08) | **MIT** | **15 KB** | via pinned `zxing-wasm@3.1.3`: 1,093,289 / **455,931** | 2.63M | ✅ active, 1 open issue |
| **`zxing-wasm`** | 3.1.5 (2026-10) | MIT + Apache-2.0 + BSD-3 | 14 KB | reader 966,895 / **415,068** | 3.16M | ✅ active, 2 open issues |
| `@zxing/library` | 0.23.0 | Apache-2.0 | 120 KB | none | 2.30M | ⚠️ *"Project in Maintenance Mode Only"* |
| `@zxing/browser` | 0.2.1 | MIT | 7 KB (+ peer `@zxing/library` → ~127 KB total) | none | 1.51M | low activity |
| `@ericblade/quagga2` | 1.12.1 | MIT | **42 KB** | **none** | 63.6k | ✅ maintained fork |
| `@undecaf/zbar-wasm` | 0.11.0 (2024-05) | **LGPL-2.1** | 5 KB | **238,653 / 173,911** ← smallest | 75.2k | quiet but alive |
| `@undecaf/barcode-detector-polyfill` | 0.9.23 | MIT wrapper | 2.5 KB | via ↑, **pins `^0.9.16`** | 6.4k | quiet |
| `zbar.wasm` | 2.1.1 (**2021-12**) | LGPL-2.1 | 16 KB | 232,799 / 171,918 | 3.2k | ❌ **dormant** |
| `quagga` (original) | 0.12.1 (**2017**) | MIT | — | none | 28.8k | ❌ **unmaintained**, 222 open issues |

**Recommended: `barcode-detector` (ponyfill import) + self-hosted `zxing_reader.wasm`.** Fully permissive (MIT + Apache-2.0 + BSD-3, no copyleft); most actively maintained; standard-shaped API so if Apple ever ships Shape Detection you delete one import; WASM decode keeps the main thread free. ≈ **15 KB gzip JS + ~445 KiB gzip WASM**, lazy-loaded behind the Scan button.

Three traps:
- **⚠️ The default WASM source is a third-party CDN** (`fastly.jsdelivr.net/npm/zxing-wasm@3.1.3/…`). **Override it.** Self-hosting is first-class and the README names your constraint — *"there're cases where this is not desired, such as … **offline usage is required**"*. Use `prepareZXingModule({ overrides: { locateFile: … } })` **before** constructing the detector (`setZXingModuleOverrides` is deprecated). Forget it and you get a `DOMException`.
- **Version coupling:** `barcode-detector` pins `zxing-wasm` **exactly**, and each zxing-wasm version needs its matching `.wasm`. **Add a CI check against the exported `ZXING_WASM_SHA256`** and re-copy the binary on every bump.
- **`zxing-wasm`'s bare `.` export maps to `full`, not `reader`** — import `zxing-wasm/reader` explicitly or you ship 1.55 MB instead of 967 KB.

Runners-up: **`zxing-wasm/reader` used directly** (drop the ponyfill, save 15 KB, get the newer/smaller 3.1.5 binary); **`@ericblade/quagga2` as a second-opinion decoder** — MIT, 42 KB gzip, zero WASM, and uniquely *"invariant to scale and rotation, whereas other libraries require the barcode to be aligned with the viewport"*, which is genuinely useful on curved food packaging. Consider `@undecaf/*` only if payload dominates **and** your LGPL-in-a-bundled-static-PWA review clears — the author's own bundling reasoning visibly reverses an earlier "must not be bundled" stance, so treat it as an open legal question. **Avoid** `zbar.wasm` and the original `quagga`.

### getUserMedia in an installed iOS PWA

**The historical bug is real and was fixed in iOS 13.4.** [WebKit Bug 185448](https://bugs.webkit.org/show_bug.cgi?id=185448), *"getUserMedia not working in apps added to home screen that run in standalone mode"* — filed May 2018, **RESOLVED FIXED** Feb 2020. Youenn Fablet: *"This is a known limitation of WKWebView that we want to fix."* It appeared fixed in iOS 13 beta 1, regressed in beta 2 (*"we had to disable the feature because we found a serious bug"*), and was confirmed working in **iOS 13.4 beta 1**. caniuse independently corroborates the exact cutoff: its [`stream` dataset](https://caniuse.com/stream) carries note #4 *"Does not work in standalone running ('installed') PWAs"* on iOS Safari **11.0 through 13.3**, dropped from **13.4** onward. (A separate bug, [208667](https://bugs.webkit.org/show_bug.cgi?id=208667), covered third-party WKWebView browsers and was fixed in **iOS 14.3**.)

**Reliable today — but there is a long tail of open PWA-camera bugs.** No *currently-open* bug claims getUserMedia is outright broken in standalone mode on iOS 26/27, but these are stale-open rather than confirmed-fixed, and several name your device family:

| Bug | Title | Status | iOS reported |
|---|---|---|---|
| [275527](https://bugs.webkit.org/show_bug.cgi?id=275527) | *"REGRESSION (again in iOS 17.5.1): Camera (getUserMedia) freezes in installed PWA"* | **OPEN** | 17.5.1 → 18.1.1. Reproduced against a real scanner; **an iPhone 13 froze, an iPhone 12 Mini did not** |
| [273938](https://bugs.webkit.org/show_bug.cgi?id=273938) | *"getUserMedia camera stream does not work in PWA on some devices"* | **OPEN** | Works in a tab; once installed, *"the video fires only its earliest loading events… **No error is raised.**"* |
| [282327](https://bugs.webkit.org/show_bug.cgi?id=282327) | *"Camera doesn't start in PWA"* | **OPEN** | 18.2 → 18.5; a commenter with ~200k monthly iPhone users estimated ~1% hit rate |
| [262416](https://bugs.webkit.org/show_bug.cgi?id=262416) | *"REGRESSION (iOS 17): getUserMedia Back Triple Camera automatically switches cameras"* | **OPEN**, major | On iOS 17+ the rear array **swaps wide → ultra-wide at close range and crops so framing looks unchanged** — your decoder silently gets a softer, upscaled image exactly when the user moves in close. No constraint pins the lens |
| [280394](https://bugs.webkit.org/show_bug.cgi?id=280394) | *"Persist permissions for getUserMedia"* | **OPEN**, mod. 2026-07-08 | 17 → 26.x |
| [245962](https://bugs.webkit.org/show_bug.cgi?id=245962) | *"When getUserMedia is called again, the existing stream is killed"* | **OPEN** | 16 |
| [254129](https://bugs.webkit.org/show_bug.cgi?id=254129) | *"[PWA] Video stream stops when control center is opened"* | **OPEN** | 16 |

**Sources conflict on permission persistence — flagging it.** One line of evidence says the grant persists: Apple fixed re-prompting as a bug ([Safari 17.2](https://developer.apple.com/documentation/safari-release-notes/safari-17_2-release-notes): *"Fixed an issue that repeatedly asks for camera access after relaunching a web app"*), and WebKit source routes camera through a persistent `uiClient().queryPermission("camera", topLevelOrigin, …)`. The other says it doesn't: bug 280394 is open with reports of re-prompting after relaunch on current iOS. **Both can be true, because of a trap neither mentions prominently** — in [`UserMediaPermissionRequestManagerProxy.cpp`](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/UIProcess/UserMediaPermissionRequestManagerProxy.cpp), `hasGrantedRequest()` returns false (→ prompt) when the call is **not from a user gesture** and capture has been inactive longer than `inactiveMediaCaptureStreamRepromptWithoutUserGestureIntervalInMinutes`, which defaults to **1 minute on iOS** (10 on desktop). [WebKit bug 298307](https://bugs.webkit.org/show_bug.cgi?id=298307), in Apple's words: *"we keep prompting after 1 minute of inactive capture if getUserMedia is not called from a user gesture. If called from a user gesture, we will prompt after 10 minutes."*

**→ Always call `getUserMedia()` from inside a tap handler, and design for a fresh prompt on cold launch.** Also assume a grant in Safari does **not** carry into the installed web app (**Unverified** — no Apple document either way; expect one prompt in each).

**Implementation checklist for the scanner, each item traceable to a primary source:**

1. **HTTPS mandatory** — in insecure contexts `navigator.mediaDevices` is `undefined`, so you get a **TypeError, not a rejected promise**. Guard for it. GitHub Pages is HTTPS.
2. **`<video autoplay muted playsinline>`, attached and visible.** WebKit's [New `<video>` Policies for iOS](https://webkit.org/blog/6784/new-video-policies-for-ios/): *"`<video>` elements without `playsinline` attributes will continue to require fullscreen mode"*; *"`<video muted>` elements will also be allowed to autoplay"*; and *"`<video autoplay>` elements will only begin playing when visible on-screen"* and *"will pause if they become non-visible"*. **Never `display:none` the preview to "scan in the background."**
3. **Call `getUserMedia` ONCE** (bug 245962) — hold the track and use `track.applyConstraints()` rather than re-requesting. Watch for React StrictMode double-invoking your start effect in dev.
4. **Add a watchdog, because failures are silent** (bugs 273938, 282327 return neither stream nor error). After `play()`, start a 3–5 s timer; if `videoWidth === 0` or no frame advanced, show a recovery path. *"Open in Safari instead"* is the one workaround that consistently worked across these bugs.
5. **Handle `track.onended` / `onmute` and `visibilitychange`** (bug 254129) — tear down and re-acquire on resume with a visible "tap to resume scanning" affordance, not a dead black rectangle.
6. **Don't request max resolution** (bug 321307 crashes at 3024×2268). `{ width: { ideal: 1280 }, height: { ideal: 720 } }` is ample for EAN-13.
7. **`facingMode` is a preference, not a guarantee** — use `{ exact: "environment" }` to get an `OverconstrainedError` instead of a silent front camera. For bug 262416's lens swap, ask users to hold ~15–20 cm away rather than pressed against the pack.
8. **`getContext('2d', { willReadFrequently: true })`** for a per-frame `getImageData` loop.
9. **GitHub Pages serves `.wasm` correctly — verified live:** `content-type: application/wasm`, `content-encoding: gzip`. `WebAssembly.instantiateStreaming` works with zero configuration. **You get gzip but not brotli** — budget the gzip figures. **Precache the `.wasm` in the service worker**, or the first scan after an offline launch fails.

**Recommendation: use with fallback.** Bundle USDA SR Legacy + a hand-built Indian dish table as the primary lookup; add OFF barcode scanning as a convenience with explicit manual-entry fallback and ODbL attribution.

---

---

## 7. On-device AI for a chat assistant, no API key

### Headline: WebGPU is real on iOS; the blocker is Apple's process memory cap, not the GPU API

**WebGPU ships enabled by default on iOS 26 and later.** Four independent confirmations:

1. *"WebKit for Safari 26.0 adds support for WebGPU … is now shipping in Safari 26.0 for macOS, iOS, iPadOS, and visionOS"*, and it *"adds compute shaders, which allow general purpose computations on the GPU"* — [WebKit Features in Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/).
2. gpuweb's [Implementation Status wiki](https://github.com/gpuweb/gpuweb/wiki/Implementation-Status) (edited 2 Oct 2026): *"In macOS Tahoe 26, iOS 26, iPadOS 26, and visionOS 26, WebGPU is supported and enabled by default."*
3. caniuse [`webgpu.json`](https://github.com/Fyrd/caniuse/blob/main/features-json/webgpu.json): **iOS Safari 26.0–27.2 = `y`** (full, unflagged). Desktop Safari is rated only *partial* — but note #7 explains that is purely an OS gate (*"only being enabled by default on macOS 26 Tahoe or later"*), not a capability gap. **iOS is less restricted than macOS here.**
4. WebKit source, [`PlatformEnable.h`](https://github.com/WebKit/WebKit/blob/main/Source/WTF/wtf/PlatformEnable.h): `ENABLE_WEBGPU_BY_DEFAULT` is set for `PLATFORM(MAC) && >= 260000` **or `PLATFORM(IOS)` with no version predicate**.

**Gotcha:** the `WebGPUEnabled` preference is `disableInLockdownMode: true`. WebGPU is off entirely for users with iOS Lockdown Mode on. Always feature-detect `'gpu' in navigator`.

**Installed PWA:** **Unverified.** No primary source tests `display-mode: standalone`. The preference has no display-mode or app-type gate anywhere in WebKit's preference system and is a WebKit-wide process preference, so it very likely works — but run a 5-line probe inside the installed app before building on it.

**f16 and subgroups are available.** [`HardwareCapabilities.mm`](https://github.com/WebKit/WebKit/blob/main/Source/WebGPU/WebGPU/HardwareCapabilities.mm) appends `ShaderF16` unconditionally, and `Subgroups` when `[device supportsFamily:MTLGPUFamilyMetal3]` — Apple's [Metal Feature Set Tables](https://developer.apple.com/metal/Metal-Feature-Set-Tables.pdf) put A15 Bionic in GPU family Apple8 / "Metal 3 & 4", so the gate passes. iOS also reports `CoreFeaturesAndLimits`, i.e. **not** WebGPU compatibility mode.

### The real ceiling: ~1.5 GB per WebContent process

This, not WebGPU, is what kills on-device LLMs. **6 GB of device RAM buys you nothing.** On the record from Apple WebKit engineers:

- **Ben Nham**, [WebKit Bug 268816 c10](https://bugs.webkit.org/show_bug.cgi?id=268816): *"Webpages are loaded into a WebContent process. This process has an OS-defined memory limit."* … *"On iPhones, for most devices, the limit is 1.5GB"* … *"I find it unlikely that these limits will change anytime soon… they are chosen for user experience reasons."* Apple's Alexey Proskuryakov on documentation: *"I do not think that this is documented by Apple."*
- **Mike Wyrzykowski**, [mlc-ai/web-llm#386](https://github.com/mlc-ai/web-llm/issues/386): *"the memory limit per web process is 1.5GB. If we raise it, the website needs to be careful with populating the buffer because both the ArrayBuffer in JavaScript and the buffer allocation within WebGPU count towards that 1.5GB limit."* … *"I tried raising the limit to 1024MB but then iOS Safari is terminated due to memory pressure."*
- [WebKit Bug 275958](https://bugs.webkit.org/show_bug.cgi?id=275958) — *"chat.webllm.ai does not work on iOS because chat.webllm.ai requires 1GB buffer size"* — closed **RESOLVED/INVALID**: *"iOS is too likely to jetsam at 1GB"*, *"No change needed on the WebKit side."* WebLLM capitulated and lowered its buffer to 256 MB.

**The failure mode is uncatchable.** Over-allocating produces the generic *"A problem occurred with this webpage"* with no console output and no catchable JS error, and it is **nondeterministic** (it depends on system memory pressure). Two open WebKit bugs make it worse: [283321](https://bugs.webkit.org/show_bug.cgi?id=283321) (WebGPU allocations aren't reported to the JS GC, so *"GCs do not occur on iOS in a timely fashion"*) and [312563](https://bugs.webkit.org/show_bug.cgi?id=312563) (destroyed WebGPU textures don't release Metal memory).

**One more iOS-specific compute gap:** [WebKit Bug 311598](https://bugs.webkit.org/show_bug.cgi?id=311598) (open, iOS 26) — more than one compute command buffer in flight causes `onSubmittedWorkDone` to **hang with no surfaced error**. Wyrzykowski: *"Recommended practice is 1 command buffer."* This is why library-level iOS support here is fragile.

**iOS envelope: VRAM ≲ 950 MB, download < ~700 MiB — i.e. 0.1B–1B parameters.**

### WebLLM (`@mlc-ai/web-llm`)

- **v0.2.85** (2026-09-08), **Apache-2.0**, actively maintained, single runtime dep. **WebGPU is mandatory — there is no WASM/CPU fallback** (`engine.ts` throws `WebGPUNotAvailableError`). Docs: *"A WebGPU-compatible browser is needed."*
- Weights cached via the **Cache API** by default since 0.2.83 (`cacheBackend: "cache" | "indexeddb" | "cross-origin" | "opfs"`; `useIndexedDBCache` was removed).

Sizes from `prebuiltAppConfig` plus measured `Content-Length`:

| model | `vram_required_MB` | download |
|---|---|---|
| `SmolLM2-360M-Instruct-q4f16_1` | 376 | **194 MiB** |
| `SmolLM2-135M-Instruct-q0f16` | 360 | 257 MiB |
| `Qwen2.5-0.5B-Instruct-q4f16_1` | 945 | **265 MiB** |
| `Qwen3-0.6B-q4f16_1` | 1403 | 320 MiB |
| `TinyLlama-1.1B-Chat-q4f16_1` | 697 | 590 MiB |
| `Llama-3.2-1B-Instruct-q4f16_1` | 879 | **663 MiB** |
| `Qwen2.5-1.5B-Instruct-q4f16_1` | 1630 | 828 MiB — **over the cap** |
| `gemma-2-2b-it-q4f16_1` | 1895 | 1403 MiB — **over** |
| `Llama-3.2-3B-Instruct-q4f16_1` | 2264 | 1724 MiB — **over** |
| `Phi-3.5-mini-instruct-q4f16_1` | 3672 | 2050 MiB — **far over** |

Three non-obvious findings:
- **`q4f32_1` downloads byte-identical weights to `q4f16_1`** (same `Content-Length`), differing only in ~11% more GPU footprint. Choosing f32 "for Safari" costs memory for no download saving — and is unnecessary, since iOS exposes `shader-f16`.
- **The `-1k` variants shrink VRAM but not download** (same HF repo, smaller KV cache).
- **`low_resource_required` / `vram_required_MB` are advisory only — the engine never enforces them**, and MLC's own demo heuristic checks for vendor `qualcomm`/`arm` and `maxStorageBufferBindingSize <= 128 MB`. An iPhone reports vendor `apple` and ≥256 MiB, so **MLC's demo does not classify an iPhone as constrained at all.** Gate models yourself.

**iOS is unsupported by silence.** A full grep of the repo for `ios|iphone|ipad|safari` returns zero hits outside `-webkit-scrollbar` CSS; the [paper](https://arxiv.org/abs/2412.15803) benchmarks only an M3 Max in Chrome Canary; the maintainers' answer to "can I run this in an iOS webview" was a bare link to their **native** iOS app. Maintainer `akaashrp`: *"Apple might limit WebContent processes to 1.5GB… I do not believe this can be fixed on our side."*

Real-world reports: Qwen2.5-0.5B ✅ works in mobile Safari (Simon Willison, [HN](https://news.ycombinator.com/item?id=45821722)); SmolLM2-135M ✅ runs on iOS 26 but *"didn't produce the quality of results I needed"*; Qwen2.5-3B ❌ *"Safari terminates the tab"* ([web-llm#753](https://github.com/mlc-ai/web-llm/issues/753), closed with no fix). Also **`ServiceWorkerMLCEngine` hangs indefinitely on iOS** ([web-llm-chat#31](https://github.com/mlc-ai/web-llm-chat/issues/31), iPhone 13) — use `WebWorkerMLCEngine`.

**First load estimate (labelled as such):** 2–5 min cold for a 265–663 MiB model, 30 s–2 min warm, extrapolated from the single real iOS data point (*134 MB in 47 s* download; *"591MB loaded… 128 secs elapsed"* warm, then failed). **No published iOS 26/27 or A15 measurement exists.**

### transformers.js (`@huggingface/transformers`)

- **v4.3.1** (2026-10-06), **Apache-2.0**. The old `@xenova/transformers` is abandoned in practice (last 2.17.2, May 2024) but carries no npm deprecation flag.
- **It does not auto-detect WebGPU — the browser default is `wasm`.** `device: 'webgpu'` *throws* if `navigator.gpu` is absent. Use `device: 'auto'` or probe yourself.
- **Pin ≥ 4.3.1:** earlier v3 had an iOS/macOS memory leak ([#1242](https://github.com/huggingface/transformers.js/issues/1242), [WebKit bug 284752](https://bugs.webkit.org/show_bug.cgi?id=284752)); current source routes around it via an `IS_SAFARI_BELOW_26` branch, with maintainer guidance *"on iOS: < 26.x — use non-asyncify build…; >= 26.x — use asyncify build"* ([PR #1700](https://github.com/huggingface/transformers.js/pull/1700)).

#### WASM threads, COOP/COEP, and GitHub Pages — the finding that changes the design

- Shared memory requires cross-origin isolation: *"To use shared memory your document must be in a secure context and cross-origin isolated"* ([MDN `SharedArrayBuffer`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer)). caniuse attaches *"Requires cross-origin isolation by having COEP and COOP headers set"* to **every iOS Safari entry from 15.2 through 27.2**.
- **You cannot set COOP/COEP via `<meta>`.** MDN's `http-equiv` list is closed and warns *"Do not set other security headers using `<meta http-equiv=`"*.
- **GitHub Pages cannot set response headers.** No `_headers`, no config surface; a Pages engineer on [community discussion 13309](https://github.com/orgs/community/discussions/13309): *"This is a scenario we would support with custom headers… No ETA."* Still unanswered, with users reporting as of Aug 2026. (GitHub has never published an explicit "cannot" sentence — this is docs-absence + engineer reply + an empirical header probe.)
- **The consequence is benign.** ONNX Runtime Web detects `typeof SharedArrayBuffer === 'undefined'`, logs two warnings and falls back to single-threaded. ORT's maintainer: *"it just works and behaves as the single thread build without noticeable performance difference."* You lose at most a ≤4× thread factor.
- **Do NOT add `coi-serviceworker` to force isolation.** On iOS, succeeding is the failure mode: [onnxruntime#11679](https://github.com/microsoft/onnxruntime/issues/11679) — *"The failure on iOS is due to a `RangeError: Out of memory`… inside `WebAssembly.instantiate`. Since the single-thread version is totally working fine… I think this is simply because a bug in iOS Safari (mac safari works good)"* — reconfirmed on iOS 17.6, closed by a stale-bot not a fix. And [onnxruntime#22086](https://github.com/microsoft/onnxruntime/issues/22086) names the exact device: *"iPhone 13 Pro, iPhone 13 Pro Max… the issue occurred on all of them"*, resolved only by forcing `numThreads: 1`. Also: COEP breaks Safari's cross-origin worker loading ([transformers.js#319](https://github.com/huggingface/transformers.js/issues/319) → [WebKit 261734](https://bugs.webkit.org/show_bug.cgi?id=261734)), which would hit you because transformers.js defaults its WASM paths to jsdelivr.

**Net: the inability to set headers on GitHub Pages is an advantage here, not a limitation.** It lands you on the single-threaded SIMD path, which is the configuration that avoids the documented iOS OOM hangs. **WebGPU itself needs no cross-origin isolation** — only `SharedArrayBuffer` and unthrottled `performance.now()` do.

#### Generative model sizes (live from the HF tree API)

| model | q4f16 ONNX | note |
|---|---|---|
| SmolLM2-135M-Instruct | 112 MiB | on `HuggingFaceTB`, not `onnx-community` |
| SmolLM2-360M-Instruct | 260 MiB | **recommended start if you must generate** |
| Qwen2.5-0.5B-Instruct | 461 MiB | `onnx-community`, HF's own demo model |
| Qwen3-0.6B | 543 MiB | — |
| Llama-3.2-1B-Instruct | 1180 MiB | at/over the cap; `meta-llama/…` is **gated → 401** |
| Phi-3-mini-4k | 2186–2597 MiB | **not feasible** |

**MLC's quantisation is ~1.7–1.8× more compact than the ONNX export of the same model** (Qwen2.5-0.5B: 265 vs 461 MiB; Llama-3.2-1B: 663 vs 1180 MiB) — which makes WebLLM's iOS fragility the more frustrating trade.

**Speed on WASM: Unverified.** There is **no published tokens/sec figure for a 0.5B/1B model under ORT Web WASM on mobile hardware** anywhere; a crowdsourced benchmark is still in progress ([#1750](https://github.com/huggingface/transformers.js/issues/1750)). HF's "up to 100× faster than WASM" headline appears once with no test setup — treat as marketing. Estimate single-digit to low-double-digit tok/s on an A15.

#### Hosting the weights

- **CORS on Hugging Face is fully permissive** (verified live 2026-10-08): `access-control-allow-origin` echoes a `*.github.io` origin, the CDN returns `access-control-allow-origin: *`, and `Range` requests work, so resumable chunked downloads are available. No token needed for public models (anonymous rate limit 3000 resolver requests / 300 s). **Gated repos need a token, and a token in a static PWA is publicly readable — so gated models are off the table.**
- **Bundling weights in the repo is impossible.** GitHub *"blocks files larger than 100 MiB"* (50 MiB warning, 25 MiB via browser upload) — [About large files](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github). The *smallest* quantised chat model above, at 112 MiB, is already over. Published Pages sites may be *"no larger than 1 GB"* with a *"soft bandwidth limit of 100 GB per month"* (≈222 cold loads/month for a 461 MiB model, then HTTP 429). And **"Git LFS cannot be used with GitHub Pages sites"** — [About Git LFS](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage). The ORT `.wasm` runtime (11.3 MB raw / 2.9 MB gzip) *does* fit and is worth self-hosting via `env.backends.onnx.wasm.wasmPaths`.

### What a retrieval-based assistant gets you with no model at all

**This is the recommendation.** Compared against ~25 MB (embeddings) or 265–663 MiB (WebLLM):

| library | version | licence | min+gzip | true BM25? | prebuilt index | maintained |
|---|---|---|---|---|---|---|
| **minisearch** | 7.2.0 | MIT | **5.7 KB** | ✅ **BM25+** | ✅ `toJSON`/`loadJSON` | ✅ 2025-09 |
| lunr | 2.3.9 | MIT | 8.2 KB | ✅ true Okapi BM25 | ✅ | ❌ last release 2020, 130 open issues |
| flexsearch | 0.8.x | Apache-2.0 | 16.4 KB | ❌ resolution-based | ✅ | ✅ |
| @orama/orama | 3.1.x | Apache-2.0 | 23.8 KB | ✅ BM25+ | ✅ via plugin | ✅ |
| wink-bm25-text-search | 3.1.2 | MIT | 3.2 KB | ✅ | ✅ | ❌ 2022, no TS types |
| fuse.js | 7.5.0 | Apache-2.0 | 9.2 KB | ❌ fuzzy Bitap | ✅ | ✅ |

Two corrections to common belief, verified in source: **lunr 2.x *does* implement true Okapi BM25** (`lunr.js` line 2608, `k1 = 1.2`, `b = 0.75`) — the tf-idf claim applies to lunr **1.x**; and **flexsearch does *not* do BM25** (zero `bm25` hits in `dist/`). minisearch uses **BM25+** (`{k: 1.2, b: 0.7, d: 0.5}`), whose delta term lower-bounds term frequency — the better variant for short documents, i.e. exactly a health FAQ.

Measured on a 2000-doc / 124k-word corpus: minisearch index **845 KB raw, 203 KB gzip** (*smaller than the corpus text*), `loadJSON` **19 ms**, query **0.4 ms**. For a realistic 500-doc FAQ, ~70 KB gzip. **Avoid fuse.js: 151 ms per query at 2000 docs (42 ms at 500) and very poor precision** — Bitap scans every document, which is a visible stall on an A15.

**If keyword recall proves insufficient, escalate in this order and measure at each step:**

1. **A hand-written synonym map** for query expansion (`sciatica → leg pain, nerve pain, radiating`). ~2 KB of JSON, zero runtime cost. In a closed, known corpus this usually recovers most of the semantic gap. **Do this before adding any model.**
2. **Precomputed embeddings + a static query encoder.** `minishlab/potion-retrieval-32M` (model2vec) is a plain gather+mean+L2 graph — no WASM, no ONNX Runtime, ~60 lines of JS. Measured **0.005–0.008 ms per query**; 14.4 MB int8 table, 0.98 MB of vectors for 2000 docs. Brute-force cosine over 2000×256 int8 vectors measured **0.49 ms** — **do not add a vector database to this app.**
3. **Only then** transformers.js with a real encoder. **Use `Snowflake/snowflake-arctic-embed-xs`, not `all-MiniLM-L6-v2`:** identical 22M params, identical 21.9 MB int8 size, identical measured latency, but **MTEB Retrieval nDCG@10 of 50.15 vs 41.95** — a free ~8-point upgrade (Snowflake's own first-party model card). Requires CLS pooling and the query prefix `"Represent this sentence for searching relevant passages: "` (documents get no prefix); getting this wrong degrades retrieval silently. Budget ~25 MB first load (21.9 MB model + 2.9 MB gzipped ORT WASM + 161 KB JS) and ~20–45 ms per query on an A15 (estimate scaled from measured M3 Pro figures of 11–18 ms).

Repo gotchas worth knowing: `Xenova/snowflake-arctic-embed-*` and `onnx-community/snowflake-arctic-embed-*` **do not exist** (use the Snowflake org repos); `onnx-community/all-MiniLM-L6-v2-ONNX` has **no int8 variant** so the transformers.js `q8` default **404s** (use `Xenova/all-MiniLM-L6-v2`); `TaylorAI/gte-tiny` **declares no licence**; and **never use `dtype: 'fp16'` on a WASM target** — session creation fails outright. Counter-intuitively, for a 22M-param encoder **WASM beats WebGPU** (measured ~3.5× faster init, ~9.6× faster embed — WebGPU's fixed per-call overhead never amortises at that size).

### Why retrieval is the *safe* choice, not just the cheap one

This is the part that should decide the architecture, given the app is for people with a lower-back injury, sciatica and diabetes.

- **Even frontier models are unsafe at a measurable rate.** Physician-led red-teaming of Claude, Gemini, GPT-4o and Llama-3 over 888 responses to 222 patient-posed primary-care questions: *"The rate of problematic responses varies from 21.6% (Claude) to 43.2% (Llama), with unsafe responses varying from 5% (Claude) to 13% (GPT-4o, Llama)"* — [npj Digital Medicine, Feb 2026](https://doi.org/10.1038/s41746-026-02428-5) ([PMID 41688533](https://pubmed.ncbi.nlm.nih.gov/41688533/)). Those are 70B-to-frontier models; a 6 GB PWA caps out below 3B at 4-bit.
- **4-bit quantisation preferentially breaks the highest-risk cases.** *"INT8 GPTQ is universally safe… while INT4 degradation is substantial… On HealthBench's emergency-risk subgroup, Qwen2.5-7B degrades by 26.8% under INT4, suggesting high-risk scenarios are disproportionately vulnerable to compression"* — [arXiv:2609.22216](https://arxiv.org/abs/2609.22216). **The exact quantisation needed to fit a model in a browser degrades emergency-risk health answers by ~27%.**
- **Medical fine-tuning makes hallucination worse, not better:** *"General-purpose models achieved significantly higher proportions of hallucination-free responses than medical-specialized models (median: 76.6% vs 51.3%, p = 0.012)"*, and *"64–72% of residual hallucinations stemmed from causal or temporal reasoning failures rather than knowledge gaps"* — [arXiv:2503.05777](https://arxiv.org/abs/2503.05777). Reasoning is exactly what shrinks first in a small model.
- **Self-checking is not a safety net:** *"LLMs significantly underperform human experts and, in some cases, even laypeople in detecting medical hallucinations"* — [MedHalu](https://arxiv.org/abs/2409.19492).
- **Retrieval over a curated corpus is competitive anyway:** [*"A corpus-specific clinical RAG system matches or outperforms newer frontier LLMs on HealthBench"*](https://arxiv.org/abs/2608.12138) (Aug 2026).

**The regulatory line falls exactly on this architecture choice.** FDA, *Clinical Decision Support Software* (issued 29 Jan 2026), p. 13: **"Software functions that support or provide recommendations to patients or caregivers – not HCPs – meet the definition of a device."** ([landing page](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software), [PDF](https://www.fda.gov/media/109618/download)). The Non-Device CDS carve-out is written around health-care professionals and is therefore **structurally unavailable** to a patient-facing app. A generative assistant *provides recommendations to a patient* — the exact fact pattern — leaving only enforcement discretion under the [General Wellness](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices) and [Mobile Medical Applications](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/policy-device-software-functions-and-mobile-medical-applications) policies. A retrieval system surfacing pre-written, human-reviewed text **verbatim with a citation** is much closer to simply *displaying medical information*.

**Retrieval isn't just safer in expectation — it is categorically incapable of the dangerous failure mode.** It cannot invent a dose, contradict a prescription, fabricate a contraindication, or produce a novel exercise that aggravates a disc problem, because it has no generative capability. Provenance is free; in a generative design it is impossible.

### No other key-free on-device AI option exists on iOS

- **Chrome's Prompt API / Gemini Nano:** Chrome's own docs say *"Chrome for Android, iOS, and ChromeOS on non-Chromebook Plus devices are not yet supported"*, and require *"At least 22 GB of free space"* and *"Strictly more than 4 GB of VRAM"* ([Prompt API docs](https://developer.chrome.com/docs/ai/prompt-api)). Desktop-only even on Chrome.
- **WebKit has formally opposed it.** [standards-positions#495](https://github.com/WebKit/standards-positions/issues/495), `position: oppose`, concerns interoperability/privacy/portability. Apple's hober: *"The API has no user consent mechanism for running inference… any top-level page can run inference silently, consuming the user's battery, CPU, and GPU resources without their knowledge."* And: *"We are not aware of another web API where the correctness of the primary output is left entirely as a quality-of-implementation issue."* **Do not plan on a WebKit `window.ai` on any timeline.**
- **Every browser on iOS is still WebKit, including in India.** Apple's [alternative browser engines page](https://developer.apple.com/support/alternative-browser-engines/) limits the entitlements to *"EU users"* on iOS 17.4+. India is outside the EU — and even inside it, nothing shipped: Open Web Advocacy, [18 June 2026](https://open-web-advocacy.org/blog/28-percent-faster--the-blink-prototype-that-shows-why-apples-ios-browser-engine-ban-must-end/), describes a Blink **prototype** and states *"every other browser on iOS forced to use the bundled WebKit engine"*. **Practical consequence: test in Safari and you have tested Chrome, Edge, Firefox, Brave and Opera on iOS too.**

### Worth a look if you ever must generate: `wllama`

[`ngxson/wllama`](https://github.com/ngxson/wllama) — MIT, v3.8.1 (2026-10-02), zero runtime deps, llama.cpp compiled to WASM SIMD with optional WebGPU: *"Can run inference directly on browser (using WebAssembly SIMD), no backend or GPU is needed!"* It **degrades gracefully without COOP/COEP** instead of hard-failing, exposes `n_gpu_layers` for partial offload (the exact knob you want against a 1.5 GB cap), and also does embeddings. Safari runs in "compat mode" (Asyncify instead of JSPI, no MEMORY64) which is *"significantly lower performance"* — though **Safari 27.0 added WebAssembly JSPI** ([features post](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)), so that trigger may now be MEMORY64 alone (**Unverified**). Flagged as a promising lead, not evaluated in depth.

**Recommendation: use** a bundled-corpus retrieval assistant (minisearch + synonyms). **Avoid** shipping a generative LLM — on safety grounds first, iOS memory grounds second.

---

---

## 8. Sensors and extras

### 8a. Web-platform capabilities (verified from WebKit sources)

| Capability | iOS Safari | Installed PWA difference | Chrome | Notes |
|---|---|---|---|---|
| **`Screen Wake Lock`** | **18.4+** | **Yes — this is the catch.** iOS 16.4–18.3 supported it in a tab but it *"Does not work in standalone Home Screen Web Apps"* ([webkit.org/b/254545](https://webkit.org/b/254545#c32)) | 84+ | Must be visible to acquire; auto-released when hidden |
| **`Vibration` (`navigator.vibrate`)** | **No** (`version_added: false`) | No | Chrome 32+, Chrome Android 32+ | Firefox *removed* it in 129 |
| **`AmbientLightSensor`** | **No** | No | Chrome 56 behind a flag | Use `prefers-color-scheme` instead |
| **Web Audio (`AudioContext`)** | Yes | Yes | Yes | Must be created or `resume()`d from a user gesture |
| **`navigator.audioSession`** | **Yes, 16.4+** (`type` only) | Yes | **No** | iOS-only lever for silent-switch / mixing behaviour |
| **`SpeechSynthesis`** | Yes, Safari 7+ | Yes | Yes | Device TTS — see note below |
| **`DeviceOrientationEvent`** | Yes (+`requestPermission()`) | Yes | Yes | `absolute` **not** supported on iOS |
| **`requestVideoFrameCallback`** | **Yes, 15.4+** | Yes | 83+ | The right loop for camera frame processing |
| **`OffscreenCanvas`** | **Yes, 16.4+** (WebGL ctx 17+, WebGPU ctx 26+) | Yes | 69+ | Enables worker-side image processing |
| **`MediaStreamTrackProcessor`** | **Yes, Safari 18+** | Unverified | 94+ | Insertable streams for frame-by-frame video |
| **`ImageCapture`** | **Yes, 18.4+** (`grabFrame` only 26+) | Unverified | 59+ | Earlier reports of "no ImageCapture in Safari" are now out of date; **caniuse is stale here, prefer MDN BCD** |
| **`torch` constraint** | **Yes, 17.4+** (rear camera, gated on `hasTorch`) | Yes | Yes | **Not tracked by MDN BCD at all** — verified from WebKit source, a branch bisect and Safari 17.5/18.4 bug fixes. See §3 |
| **`whiteBalanceMode` constraint** | **Yes, 17.4+** | Yes | Yes | Announced in the Safari 17.4 release notes |
| **`zoom` constraint** | **Yes, 17.0+** | Yes | Yes | — |
| **exposure** mode / time / compensation | **No** | No | Yes | `// FIXME: add exposureMode` in WebKit's IDL. The one missing lever for PPG |
| **`WebGPU`** | **Yes, Safari 26.0** | Unverified | 144 desktop / 121 Android | See §7 |
| **`IdleDetector`** | **No** | No | 94+ | Can't detect "user walked away" for posture nudges |
| **Battery Status (`getBattery`)** | **No** | No | 38+ | Can't adapt to battery level |
| **`CompressionStream` / `DecompressionStream`** | **Yes, 16.4+** (gzip, deflate; brotli 18.4+) | Yes | 80+ | Free gzip for export/import, no library |

Primary sources: [BCD `api/WakeLock.json`](https://github.com/mdn/browser-compat-data/blob/main/api/WakeLock.json), [`api/Navigator.json`](https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json), [`api/AudioSession.json`](https://github.com/mdn/browser-compat-data/blob/main/api/AudioSession.json), [`api/HTMLVideoElement.json`](https://github.com/mdn/browser-compat-data/blob/main/api/HTMLVideoElement.json), [`api/OffscreenCanvas.json`](https://github.com/mdn/browser-compat-data/blob/main/api/OffscreenCanvas.json), [`api/ImageCapture.json`](https://github.com/mdn/browser-compat-data/blob/main/api/ImageCapture.json), [`api/IdleDetector.json`](https://github.com/mdn/browser-compat-data/blob/main/api/IdleDetector.json), [`api/CompressionStream.json`](https://github.com/mdn/browser-compat-data/blob/main/api/CompressionStream.json), [`api/GPU.json`](https://github.com/mdn/browser-compat-data/blob/main/api/GPU.json).

**Screen Wake Lock — read the PWA caveat twice.** This is a textbook case of a feature that works in the browser and silently fails in the installed app. On iOS it only works in a home-screen web app from **18.4** onward. Below that, the only (ugly) fallback is a looping, muted, 1-pixel `<video playsinline>` — which still fails if the app is backgrounded. Always feature-detect `'wakeLock' in navigator` and degrade to a visible "keep your screen awake" instruction.

**No vibration on iOS, at all.** `navigator.vibrate` is unsupported in WebKit. There is a widely-repeated claim that toggling an iOS-styled `<input type="checkbox" switch>` produces haptic feedback; I could find no WebKit preference or release note for it, so treat haptics on iOS as **Unverified / assume unavailable**. Use audio cues and visual flashes instead.

**Audio cues: use `navigator.audioSession`.** This is an iOS-only API that is enabled by default in current WebKit (`DOMAudioSessionEnabled`, `status: mature`, `defaultValue: true` — [UnifiedWebPreferences.yaml](https://github.com/WebKit/WebKit/blob/main/Source/WTF/Scripts/Preferences/UnifiedWebPreferences.yaml)) and lets you set `navigator.audioSession.type` to control whether your audio respects the Ring/Silent switch and whether it mixes with other audio. For a coaching app, `'playback'` is the usual choice so cues keep playing with the ringer off; `'play-and-record'` if the mic is in use. The richer `state`/`statechange` surface is behind `DOMAudioSessionFullEnabled` (`testable`, off) — don't depend on it. The standard autoplay rule still applies: *"Create or resume context from inside a user gesture"* ([MDN Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)). The existing "start the coach's voice on the first tap" fix in this repo is exactly the right pattern.

**`SpeechSynthesis` works but is the wrong tool here.** It is supported since Safari 7, but this project's established preference is pre-rendered Kokoro voice packs precisely because device TTS sounds robotic. Keep `speechSynthesis` only as a last-resort fallback for text the packs don't cover, if at all.

### 8b. Pose estimation for rep counting and "form checking"

#### Use MediaPipe, not TensorFlow.js — and the reason is iOS-specific

**`@mediapipe/tasks-vision` PoseLandmarker.** Code **Apache-2.0**, and unusually the **weights are Apache-2.0 too** — the [BlazePose GHUM 3D model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf) p.2 has an explicit *"LICENSED UNDER → Apache License, Version 2.0."*

Measured `.task` bundle sizes from the official CDN (the docs list none):

| bundle | MiB |
|---|---|
| `pose_landmarker_lite.task` | **5.51** |
| `pose_landmarker_full.task` | 8.96 |
| `pose_landmarker_heavy.task` | 29.24 |

Each bundle is a ZIP containing a shared `pose_detector.tflite` (~2.96 MB) plus a landmarker. **This resolves a discrepancy you will hit:** the model card's "Lite (3MB), Full (6MB), Heavy (26MB)" are the *landmark models alone*. Budget against the bundle sizes. JS/WASM payload for `@mediapipe/tasks-vision@1.1.0` (published **2026-10-06**): `vision_bundle.mjs` 152 KiB, glue 335 KiB, and **`vision_wasm_internal.wasm` 12.40 MiB** (SIMD build, what iOS 16.4+ loads). **First load with the lite model ≈ 18.4 MiB**, dominated by a monolithic WASM containing *every* vision task — there is no pose-only build. Cache it in the service worker.

**⭐ Cross-origin isolation is NOT required — the make-or-break question for GitHub Pages, answered from the binary.** Parsing section id 5 (memory) of both WASM files gives `flags=0x1, shared=NO` — the WebAssembly `shared` bit is clear, so the memory cannot be backed by a `SharedArrayBuffer` and threads are impossible. The glue JS has **zero** occurrences of `SharedArrayBuffer`, `Atomics`, `crossOriginIsolated`, `pthread_create` or `new Worker`, and **no `*-threaded-*` binary variant ships** (the only axis is SIMD). **PoseLandmarker runs on GitHub Pages with no header changes.** The cost is a permanently single-threaded (but SIMD) CPU delegate.

**The GPU delegate is WebGL2, not WebGPU.** The undocumented API is `delegate?: "CPU" | "GPU"`. Grepping `vision_bundle.mjs`: `getContext("webgl2")` ×3, `getContext("webgl")` ×1, and **`navigator.gpu` / `requestAdapter` / `GPUDevice` ×0**. A WebGPU path exists as an opt-in mixin upstream but **is not wired into the published PoseLandmarker**.

**iOS Safari is a second-class MediaPipe-web target, and Google effectively says so:**

| Issue | Finding |
|---|---|
| [#6142](https://github.com/google-ai-edge/mediapipe/issues/6142) **OPEN** (2025-11) | *"[Web] Image Segmenter GPU delegate produces **incorrect categories** on iOS Safari"* (iOS 18.7.1). **Not a crash — wrong numbers**, while CPU on the same device and GPU on desktop are correct. Google reproduced it; still open. **For a health app this is the risk that matters.** |
| [#4499](https://github.com/google-ai-edge/mediapipe/issues/4499) | PoseLandmarker on iOS: `Couldn't create webGL 2 context → Fall back on WebGL 1 → Couldn't create webGL 1 context`. **Undocumented fix: pass an explicit `canvas` into `createFromOptions`** — *"it's not written in the documentation as far as I know"*. Do this defensively |
| [#5122](https://github.com/google-ai-edge/mediapipe/issues/5122) | *"WebGL context get lost on iOS if Safari went into background"* — *"MediaPipe is not able to start anymore. Even if we reload or open a new tab. To solve the issue, we need to restart the Safari App."* **Critical for a 60-minute session.** Closed stale, no fix |
| [#4022](https://github.com/google-ai-edge/mediapipe/issues/4022) | Same M1 silicon: **15–18 fps on macOS vs 2–4 fps on iPadOS.** Google maintainer: *"Apple has an experimental setting 'GPU Process: WebGL' which is enabled by default (as of iOS 16)… **This currently completely hoses our iOS web performance.**"* |
| [#3303](https://github.com/google-ai-edge/mediapipe/issues/3303) | **~6–7 fps on iPhone 11 / 12 Pro Max / 13 Pro** (your device family) in iOS Safari, vs 30 fps for the same graph in MediaPipe Visualizer |
| [#4680](https://github.com/google-ai-edge/mediapipe/issues/4680) | `createFromOptions` **hangs in a Web Worker on iOS** (>60 s, even with CPU delegate), fine on desktop. Tempers the docs' "use a worker" advice |
| [#4539](https://github.com/google-ai-edge/mediapipe/issues/4539) | ~50% failure **on service-worker-cached loads** with GPU delegate + VIDEO mode. Exactly what a PWA does |

**TensorFlow.js: avoid, for three independent reasons.**

1. **Maintenance.** `@mediapipe/tasks-vision` shipped 2026-10-06. `@tensorflow/tfjs-core` 4.22.0 → **2024-10-21**. `@tensorflow-models/pose-detection` 2.1.3 → **2023-08-29**. A pose library unshipped for three years on a runtime unshipped for two is a poor foundation for a health app.
2. **🚨 An open, silently-wrong-output bug on iOS 26+ that TF.js auto-selects into.** [tensorflow/tfjs#8733](https://github.com/tensorflow/tfjs/issues/8733), **OPEN**, filed 2026-07-04: *"[webgpu] Video frames imported via importExternalTexture are misoriented on iOS 26 (landmarks rotated ~90°)"* — reproduced on Safari 26.3 and Chrome 145 on iOS 26.3/iPadOS 26.5, not on desktop. With `WEBGPU_IMPORT_EXTERNAL_TEXTURE` (**default on**), *"face/hand landmark coordinates come out rotated ~90° and misaligned with the video"*; the reporter's own framing is that tf.js should *"default the flag off on affected WebKit versions, **since results are silently wrong**."* Maintainer confirmed 2026-08-12; **fix not merged.** And TF.js's backend priority is `webgpu` = 3 > `webgl` = 2 > `wasm` = 2, so **on an iPhone 13 Pro Max running iOS 26/27 it silently picks the broken path** unless you don't bundle the WebGPU backend, force `tf.setBackend('webgl')`, or flip the env flag.
3. **Model hosting is a live supply-chain risk.** `pose-detection` hard-codes `https://tfhub.dev/google/tfjs-model/movenet/…`, which now 302s to `kaggle.com/models` and then to a **3-hour signed `storage.googleapis.com` URL** you cannot pin or SRI. A library last published in Aug 2023 pointing at a retired host that works only because Google keeps a shim alive. (If you do use TF.js, commit the weights and pass explicit `modelUrl` / `detectorModelUrl` / `landmarkModelUrl`.)

For reference, measured TF.js sizes: MoveNet Lightning v4 **4.60 MiB** (input `[1,192,192,3]`), Thunder v4 **12.06 MiB** (`[1,256,256,3]`), BlazePose detector 5.79 MiB + landmark lite/full/heavy 2.74 / 6.20 / 26.55 MiB. Weights are float32/int32, **not quantised**. Licences Apache-2.0. **Avoid the `mediapipe` runtime option** — it pulls `@mediapipe/pose@0.5.1675469404`, published 2023-02-04, **50.21 MiB unpacked**, wrapping the deprecated legacy solution.

**Hosting: everything fits on GitHub, no LFS.** MediaPipe's CDN is clean — measured `GET storage.googleapis.com/mediapipe-models/…/pose_landmarker_lite.task` → `200` with `access-control-allow-origin: *`, and a real preflight from a `*.github.io` origin → `200`. But `cache-control: max-age=3600` is only an hour, so cache it yourself. **Recommended: commit `vision_bundle.mjs` + the three `wasm/` files + `pose_landmarker_lite.task` ≈ 18.3 MiB**, same-origin — no CORS dependency, no expiring URLs, SRI-able. The largest asset (`heavy`, 29.24 MiB) is under GitHub's 100 MiB block but **over the 25 MiB browser-upload cap**, so add it with the git CLI. At ~18 MiB per cold install you'd need ~5,500 cold loads/month to approach the 100 GB bandwidth soft limit.

#### Rep counting: yes, with named failure modes

Published accuracy for standing sagittal exercises is genuinely high. [Pūioio, arXiv:2308.02420](http://arxiv.org/abs/2308.02420) (squats, push-ups, pull-ups, on-device): *"the system was **98.89% accurate in real-world tests**."* [arXiv:2107.13760](http://arxiv.org/abs/2107.13760) on MM-Fit and UI-PRMD: *"overall mean absolute error (MAE) for mm-fit was **0.06** with off-by-one Accuracy (OBOA) 0.94… UI-PRMD… **0.06** with OBOA 0.95"*, degrading to OBOA 0.88 under uncontrolled camera placement. Google lists *"Fitness and repetition counting"* under intended use in the BlazePose model card.

**What breaks it, named by the vendors:**

1. **⭐ Lying down and seated.** Google, verbatim: *"seated knee extensions or supine positions (laying down) **cause grief for even state-of-the-art detectors**"*, contrasted with *"a typical off-the-shelf detector is sufficient for easy movements such as shoulder abductions or full body squats"* ([TensorFlow blog](https://blog.tensorflow.org/2021/05/next-generation-pose-detection-with-movenet-and-tensorflowjs.html)). **This is the glute-bridge case, called out by name by the model's own authors.** Supine, the body is foreshortened, hip/knee/shoulder landmarks collapse toward collinearity, and the floor occludes posterior landmarks.
2. **Camera angle** — non-sagittal views distort 2D joint angles.
3. **Distance** — MoveNet: *"Most suitable for… a single person who is **3ft ~ 6ft away**"*. BlazePose is out-of-scope beyond 4 m.
4. **Head not visible** is explicitly out-of-scope for BlazePose, whose tracking mode is seeded by a *"Face detector with pose alignment"*. **Lose the face, lose tracking** — this bites on floor work.
5. **Partial reps: Unverified.** No published study reports partial-rep discrimination accuracy. A threshold state machine counts or doesn't depending on noise.
6. **Jitter** — the card warns of *"degradation of quality and increase of 'jittering'"* in poor light or motion. Use hysteresis plus temporal smoothing.

**⇒ Ship rep counting for standing, sagittal, large-ROM movements** with hysteresis, a visibility gate and a user-correctable count. **For glute bridges and floor work, do not auto-count** — use a timer, interval, or user-tapped counting.

#### Form and posture checking: no. This is the safety-critical finding.

**(a) The landmark topology makes spine assessment impossible, not merely inaccurate.** MediaPipe Pose's 33 landmarks are: 0 nose, 1–6 eyes, 7–8 ears, 9–10 mouth, **11–12 shoulders**, 13–14 elbows, 15–16 wrists, 17–22 hands, **23–24 hips**, 25–26 knees, 27–28 ankles, 29–30 heels, 31–32 foot index. **Between shoulders and hips there is nothing** — indices 13–22 are arms and hands. No neck, no C7, no T12, no L1–L5, no sacrum, no pelvis centre. MoveNet is worse: 17 keypoints, no spine, no feet.

The consequence is structural, not statistical. A "lumbar angle" can only be a shoulder-midpoint → hip-midpoint line — **a single rigid trunk segment**. It cannot separate **lumbar flexion** (rounding, the thing to protect) from **hip flexion** (hinging, the thing you want), nor lumbar flexion from thoracic kyphosis. A healthy hip-hinge and a spine-rounding one produce a nearly identical shoulder–hip vector. **A cue derived from it is not an approximate measurement of lumbar flexion; it is a different quantity wearing its name.** Research that *does* measure spine kinematics uses segmental ultrasound, quantitative fluoroscopy, or — closest to video — **ten IMUs on individual vertebrae plus three synchronised smartphone videos plus a thoracolumbar model** ([*IEEE JBHI* 2024, PMID 38923475](https://pubmed.ncbi.nlm.nih.gov/38923475/)), whose own conclusion is that integrating IMUs with computer vision *"outperforms the single-modality method"*. **Video alone was insufficient even for researchers who tried hard.**

**(b) What "accurate" means in Google's own metric.** The model card defines PDJ/PCK@0.2: *"We consider a keypoint to be correctly detected if… the absolute 2D Euclidean error… normalized by the **2D torso diameter** projection is smaller than **20%**."* **A landmark counts as "correct" while sitting up to 20% of a torso diameter away — roughly 6–8 cm on an adult.** Headline PDJ: lite 87.0, full 91.8, heavy 94.2 (human agreement 97.5). By Fitzpatrick skin tone, lite ranges 80.5–87.8; MoveNet Lightning's COCO fairness gap by skin tone is **13.9 points** (60.5 darker vs 74.4 lighter). **"94% correct" under a 20%-of-torso tolerance says nothing about degree-level angle accuracy.**

**3D is not a rescue.** BlazePose's z is explicitly non-metric: *"Note, that Z is not metric but up to scale"*, obtained *"not via human annotation, by fitting synthetic data (GHUM model) to the 2D annotation"*, and ***"applications requiring metric accurate depth"* is listed out-of-scope.**

**(c) Against marker-based mocap, in degrees** — ordered most to least favourable, which is itself the story:

| Study | Comparison | Result |
|---|---|---|
| [*Heliyon* 2024, PMID 39281584](https://pubmed.ncbi.nlm.nih.gov/39281584/) — **knee valgus, single-leg drop landing** | MediaPipe vs **VICON MX** | ***"significantly higher than… the 3-D motion analysis systems (p < 0.05, error range 18.83–19.68°)"*** and ***"No significant concurrent validity was found in the absolute value."*** Only *change* from initial contact was reliable |
| [*Sci Rep* 2026, PMID 42215670](https://pubmed.ncbi.nlm.nih.gov/42215670/) — **1 consumer camera, rehab exercises** ← matches your exact setup | MediaPipe Full vs Visual3D, 14 IR cameras, 53 markers | *"Individual-measure ICC… 0.005–0.68"*; *"reliability is inconsistent and frequently poor"*; ***"These findings do not support clinical deployment at this stage."*** |
| [*IEEE EMBC* 2025, PMID 41336603](https://pubmed.ncbi.nlm.nih.gov/41336603/) | BlazePose vs mocap, CP gait | *"the joint angle errors exceed 5°"*; worse recall/F1 than plain observational gait analysis |
| [*Sensors* 2026, PMID 41755089](https://pubmed.ncbi.nlm.nih.gov/41755089/) | 3 MediaPipe complexity levels vs Azure Kinect | ***"the high-complexity model introduced significant skeletal distortions"*** and *"should be avoided"* — **heavy is not automatically safer** |
| [*IEEE Access* 2026, PMID 42238785](https://pubmed.ncbi.nlm.nih.gov/42238785/) — **best case**: research model, 51 participants, 669 trials | single camera 30 Hz vs THEIA3D multi-camera 180 Hz | *"mean trajectory RMSE was 5.95 cm and **joint angle RMSEs ranged 2.10°–10.98°**"* (incl. trunk); ROM ICCs > 0.93; *"not a full substitute for multi-camera capture"* |
| [*J Sports Sci* 2025, PMID 40526450](https://pubmed.ncbi.nlm.nih.gov/40526450/) — **systematic review, 53 studies** | all markerless vs marker-based | ***"differences between technologies ranging from 0.2° to 28.6° and correlations negligible (including negative values) to very strong"***; **hip flexion SEM 4.0°–11.1°**; *"not largely comparable to marker-based systems"* |

**Read the gradient:** error shrinks as you add cameras, synchronisation, task constraint, bespoke training, biomechanical models and bias correction. **One uncalibrated phone camera, a general-purpose real-time mobile model, unconstrained home positioning, no inverse kinematics, no bias correction sits at the worst end of every axis.**

**(d) ⭐ 2D frontal-plane knee valgus fails even with a human doing the digitising — which removes pose estimation from the equation entirely.** [Systematic review with meta-analysis, 16 studies, *JOSPT* 2018, PMID 29895235](https://pubmed.ncbi.nlm.nih.gov/29895235/): *"there was **poor agreement** between the 2-D and 3-D methods, with **no correlation between 2-D knee frontal plane projection angle and 3-D knee frontal plane angles (r = 0.127, P = .094) for the single-leg squat**, but a moderate to good relationship (r = 0.619, P<.001) for the landing task."* **r = 0.127, p = 0.094 — indistinguishable from zero — with expert manual digitisation and zero pose-estimation error.** Corroborated: 2D FPPA correlates with **hip adduction** far better than with knee abduction ([PMID 30414788](https://pubmed.ncbi.nlm.nih.gov/30414788/)) — *2D "knee valgus" is substantially a hip-adduction measurement mislabelled.* And 2D FPPA is highly **reliable without being valid** (ICC 0.59–0.998 across studies) — **consistently wrong is still wrong, and reliability-without-validity is exactly what makes a bad cue feel trustworthy.** Expert manual 2D FPPA error is ≤2.04° at the 95th percentile, so MediaPipe's ~19° vs Vicon is **~9× the human measurement error, on a construct itself uncorrelated with 3D truth for squats.** Two independent failures stacked.

**The blunt answer, with magnitudes:**

| Target | Error you'd have | Magnitude that matters | Verdict |
|---|---|---|---|
| Knee valgus | **18.83–19.68°** vs Vicon; **no concurrent validity for the absolute value** | clinical threshold **>10°**; expert 2D error ~**2°** | **No** — error ≈ 2× the entire clinical threshold, on a construct uncorrelated with 3D truth |
| Lumbar flexion | **No landmarks exist between shoulders and hips.** Trunk RMSE where measured: 2.10°–10.98° | lumbar MDC from a purpose-built device **2.85°–6.17°** ([PMID 29229059](https://pubmed.ncbi.nlm.nih.gov/29229059/)) | **No** — a validity failure, not a precision one. Even at the optimistic end you're at or above the MDC of dedicated instruments, *and the quantity isn't lumbar angle* |
| Pelvic tilt | Two hip landmarks only; no sacrum, no ASIS/PSIS | a few degrees | **No** — the anatomy needed to define the segment isn't in the landmark set |
| Neck angle | nose/eye/ear + shoulders; **no C7** | a few degrees | **No** — no cervical landmarks |

**And the model authors say so.** BlazePose model card, Ethical Considerations → HUMAN LIFE: ***"The model is not intended for human life-critical decisions. The primary intended application is entertainment."*** Using it to direct the loading of an injured lumbar spine is using it outside its stated scope.

**The specific harm mechanism:** a rounding cue and a hinging cue are *opposite* instructions. Because 2D measures are reliable-but-invalid, a wrong reading is **stable and confident** — it doesn't look like noise, so neither the app nor the user can tell it's wrong. A 19°-biased valgus estimate flags valgus in someone with none, prompting a knee-tracking correction that for a sciatica patient may shift load in exactly the wrong direction.

**What the evidence *does* support, and it isn't nothing:**
1. **Rep counting** for standing sagittal exercises (~0.06 rep MAE).
2. **Presence / engagement** — "in frame and moving" driving the session clock. Robust.
3. **Within-session relative change, never absolute angles.** This is the one consistent positive across studies: MediaPipe valgus had *"no significant concurrent validity… in the absolute value"* but *"the change in IC showed good reliability and concurrent validity"*, and single-camera ROM ICCs exceeded 0.93 with errors *"predominantly attributable to **systematic bias, not random error**"* — **and systematic bias cancels in a difference.** So *"your squat depth today is 12% less than your week-1 baseline, same camera position"* is defensible. *"Your lumbar spine is flexed 14°"* is not.
4. **Tempo and hold timing** — temporal signals need no absolute spatial accuracy.
5. **ROM trend over weeks**, same setup, as relative change with visible uncertainty.

**What to do instead:** lead with the **3D form demonstrations already in the stack** — teach the movement, don't grade it. Make the camera optional and label it a rep counter. Gate anything form-adjacent on MediaPipe's `visibility` score and show a skeleton overlay so the *user* judges — honest about where the judgement lives. For a disc injury and sciatica, the form authority is a physiotherapist; the app handles adherence, tempo and counting.

#### Battery and thermal: you are flying blind

**Apple documents exactly this failure mode.** [`AVCaptureDevice.SystemPressureState`](https://developer.apple.com/documentation/avfoundation/avcapturedevice/systempressurestate-swift.class): *"The performance and availability of the camera capture system on an iOS device is subject to several external factors, such as **power usage and device temperature**. If during a capture session the total system pressure reaches excessive levels, **the capture system automatically shuts down**… Under less heavy pressure, **the system may automatically reduce capture quality**."* Recommended mitigation: *"reducing the capture frame rate."*

**A web app cannot see any of it:**
- **No thermal/pressure API in Safari, by policy.** WebKit's position on **Compute Pressure** is **`oppose`** with concerns privacy and device independence ([issue #255](https://github.com/WebKit/standards-positions/issues/255)). `PressureObserver` is not coming.
- **No Battery Status API in Safari, ever** — `n` at every iOS version through 27.2.

**⇒ Build your own frame-interval telemetry from day one** — rolling inference latency and rAF deltas — and treat sustained degradation as thermal pressure. It is also your only honest signal for when pose output has become too sparse to count reps.

**Frame budget.** 30 fps = 33.3 ms shared across camera decode, video→tensor upload, a 224×224 detector plus a 256×256 landmarker, **your three.js scene competing for the same GPU**, plus rep logic, React and voice. MediaPipe's docs warn `detectForVideo()` is **synchronous and blocks the main thread** (hence the worker advice — tempered by the iOS worker hang in #4680), and on top sits the iOS GPU-process tax Google measured at 4–9×. **Budget for 15 fps, not 30. Decouple inference from render: pose at 10–15 Hz, interpolate three.js at display rate.** A squat takes 2–4 s, so 10 Hz still gives 20–40 samples per rep.

**Backgrounding and long sessions — the biggest operational risk.** Camera stops when backgrounded (`videoDeviceNotAvailableInBackground`). **rAF stops too** — the [HTML Standard](https://html.spec.whatwg.org/multipage/webappapis.html#event-loops) runs the rendering steps only *"For each navigable that has a rendering opportunity"*, and a hidden document gets none, so a frame-counted session clock **silently stops**. Drive elapsed time from `performance.now()` deltas and reconcile on `visibilitychange`. Handle `webglcontextlost`/`webglcontextrestored` and recreate the `PoseLandmarker`; pass an explicit `canvas` so you own the context; **consider the CPU delegate — it has no WebGL context to lose**; hold a wake lock; and design graceful degradation so the session continues on 3D demos, voice and a timer if pose dies.

**Unverified:** there is **no published PoseLandmarker FPS on an A15 in iOS Safari** for either delegate, and **no published battery/thermal measurement** for pose + camera + WebGL in iOS Safari on any iPhone. Google's much-cited MoveNet launch table ("iPhone 12 / WebGL / 51 fps Lightning") **names no browser for any row**, predates the iOS 16 GPU-process regression Google itself calls *"completely hoses our iOS web performance"*, and the MacBook WASM row is multithreaded (unobtainable here). The defensible statement is: *"51 fps on an iPhone 12 in 2021 with browser unstated, versus 6–7 fps measured for a comparable MediaPipe graph on iPhone 13 Pro-class hardware"* — an ~8× spread only on-device measurement can close. **Don't accept a number from anyone here.**

**Pose recommendation: use with fallback.** `@mediapipe/tasks-vision` PoseLandmarker, **lite** model, **CPU delegate**, self-hosted (~18.3 MiB), explicit `canvas`, 10–15 Hz decoupled from render, wake lock held, `webglcontextlost` handled, your own telemetry, full graceful degradation. Scope: rep counting for standing sagittal exercises, presence, tempo/holds, relative change. **Avoid** TF.js, and **avoid** valgus detection, lumbar cues, pelvic tilt, neck angle and any corrective form advice.

### 8c. Device orientation for posture

`DeviceOrientationEvent` gives `alpha`/`beta`/`gamma` — the Euler angles of **one rigid body**, derived from gravity plus the gyro. Permission mechanics are in §1 (user gesture required, **grant does not persist across launches**).

**What is genuinely achievable:**
- **Coarse posture *class*** — sitting vs standing vs lying — is well established with a **thigh- or hip-worn** sensor. The current systematic review ([*PLOS Digital Health* 2026, PMID 42743259](https://pubmed.ncbi.nlm.nih.gov/42743259/), 10 databases, 27,334 records → 14 studies) finds *"accelerometer-based wearable sensors provide a feasible basis for monitoring prolonged sitting"*, with thigh-worn activPAL the dominant device. **Note the placement:** the thigh changes inclination ~90° between sitting and standing. A phone in a *pocket* approximates this; a phone on the chest or lower back does not.
- **Trunk inclination** (how far forward you are leaning) from a trunk-mounted sensor — a direct gravity readout, genuinely reliable.
- **Movement, transitions, tempo, time-in-position.** Robust.
- **Relative change from a user-calibrated "neutral"** captured in the same mounting position in the same session.

**What is not achievable, and why it's a maths problem not a noise problem:**
- **Slouching** is a *change in spinal curvature* — lumbar flexion plus thoracic kyphosis — at near-constant overall trunk inclination. One sensor cannot see it. Research that does measure it uses **multiple**: a whole-day lumbar-posture study used **three accelerometers** ([*Clinical Biomechanics* 2026, PMID 42379099](https://pubmed.ncbi.nlm.nih.gov/42379099/)); the vertebral-level work needed **ten IMUs plus three cameras**. One phone is one segment; slouch is a two-or-more-segment phenomenon. **Mathematically underdetermined.**
- **Forward head posture** is the craniovertebral angle (C7 to tragus) — requires a sensor on the **head** and another on the **upper trunk**. A body-worn phone has no head reference at all.
- **Absolute angles** depend on how the phone sits in a pocket or strap, which shifts between and during sessions. **Mounting error is indistinguishable from posture change.** Per-session re-calibration to a user-held "neutral" is mandatory, and even then you get only *relative* change.
- The event stream **stops when the page is hidden**, so this can never be a background posture monitor.

**Verdict: use, for three narrow jobs only.** (1) Confirming the phone is propped at a workable angle for the camera. (2) **Detecting gross position for floor exercises where pose estimation fails anyway** — "are you lying down?" is a gravity question, and a phone resting on the chest or held in hand answers it reliably. This is a genuinely useful substitute for the glute-bridge rep counting MediaPipe cannot do. (3) A user-calibrated **relative** trunk-inclination cue for a single held position ("stay within 10° of where you started"). **Avoid** slouch detection, forward-head detection, and any spinal-posture coaching — the same bright line as §8b: **do not generate corrective spinal cues from a sensor that cannot see the spine.**

---

## 9. Storage and export

### Quotas in an iOS PWA — much larger than people assume, with one trap

| Store | Limit | Source |
|---|---|---|
| **`localStorage`** | **5 MiB per origin** (10 MiB total with `sessionStorage`), throws `QuotaExceededError` | [MDN Storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) |
| **IndexedDB / Cache API / OPFS**, iOS 17+ | **~60% of total disk per origin** for browser apps, and *"If the user has saved the site as a web app on the Home Screen or the Dock, it uses the same origin quota as the browser app (around 60% of disk space)"* | MDN, above |
| Overall across origins | 80% of disk (browser apps) | MDN, above |
| Pre-iOS-17 | *"an origin is given an initial 1 GiB quota"*, then a prompt | MDN, above |

WebKit's own statement: *"For a browser app, the origin quota is up to 60% of the total disk space"*, *"Safari 17.0 no longer prompts users about a website wanting to use more space"*, and a Home Screen web app *"has the same origin quota and overall quota as when it is opened in a browser app"* — [Updates to Storage Policy](https://webkit.org/blog/14403/updates-to-storage-policy/). That post lists the governed storage types as *"localStorage, Cache API, IndexedDB, Service Worker, and File System"*.

**The trap: this app currently stores everything in `localStorage`, which is capped at 5 MiB and is synchronous.** A bundled food table, an Apple Health import, or a few months of GPS tracks will blow through that and block the main thread on the way. **Move the data layer to IndexedDB** (keep `localStorage` only for tiny preference flags). This is the single highest-leverage change in the report.

### Eviction risk: does iOS delete PWA data after disuse?

ITP imposes a *"7-Day Cap on All Script-Writeable Storage"* — *"deleting all of a website's script-writable storage after seven days of Safari use without user interaction on the site"*, covering *"Indexed DB"*, *"LocalStorage"*, *"Media keys"*, *"SessionStorage"*, *"Service Worker registrations and cache"* ([Full Third-Party Cookie Blocking and More](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/)).

**But installed web apps are treated separately — and this is the good news:**

> *"Web applications added to the home screen are not part of Safari and thus have their own counter of days of use."*
> *"We do not expect the first-party in such a web application to have its website data deleted."*
> — same post

WebKit frames a data wipe in an installed web app as a bug they want reported. Note the hedging: it is an *expectation*, not a guarantee, and MDN's quota page does **not** repeat the exemption. So:

- Installing to the Home Screen is not just a notification unlock — it is the **data-durability** story too. Make installation a first-run step, with an explanation.
- Call `navigator.storage.persist()` anyway. Safari supports it since 15.2 and decides heuristically with no prompt; WebKit says approval is *"based on heuristics like whether the website is opened as a Home Screen Web App"* ([storage policy post](https://webkit.org/blog/14403/updates-to-storage-policy/)). An origin in persistent mode *"might be excluded from eviction"*. Note `navigator.permissions.query({name:'persistent-storage'})` is **not supported in Safari** — call `persist()`/`persisted()` directly.
- Regardless: **data loss must be survivable**. Prompt for a periodic export (see below), and handle `QuotaExceededError` on every write.

### Export and import

| Mechanism | iOS Safari | Chrome | Verdict |
|---|---|---|---|
| `Blob` + `<a download>` | Yes | Yes | Baseline export; works in standalone mode |
| **`navigator.share({ files })`** (Web Share) | **Yes — Safari 12.1 / files 14+** | Chrome 128 desktop / 89 Android | **Best iOS export UX** — straight into Files, Mail, WhatsApp, iCloud Drive |
| `<input type="file">` import | Yes | Yes | Baseline import |
| **File System Access** (`showOpenFilePicker`, `showSaveFilePicker`, `showDirectoryPicker`) | **No** | Chrome 86+ | **Chrome-only. WebKit's position is `oppose` (security)** — [standards-positions issue 28](https://github.com/WebKit/standards-positions/issues/28) |
| `FileSystemFileHandle` / OPFS via `navigator.storage.getDirectory()` | **Yes, 15.2+** | 86+ | Private sandbox, not user-visible files — good for staging a big import |
| **Web Share *Target*** (`share_target` manifest) | **No** | Chrome 89 / Android 76 | Can't receive a shared Health export on iOS. Impl bug [194593](https://bugs.webkit.org/show_bug.cgi?id=194593) still NEW; WebKit position *neutral* ([#11](https://github.com/WebKit/standards-positions/issues/11)) |
| `file_handlers`, `protocol_handlers`, `launch_handler`, `LaunchQueue` manifest members | **No** (all `false` in BCD) | Chrome | No OS-level file or URL-scheme handoff on iOS |
| manifest `shortcuts` | **No on iOS** (Safari 17.4 desktop only) | 96+ | No long-press quick actions on iOS |
| `<input type="file">` **on iOS ignores `accept`** | — | — | WebKit [279606](https://bugs.webkit.org/show_bug.cgi?id=279606): *"any file can be selected, as if the accept attribute had not been specified"*. Convenient for `.zip` import, but never rely on it for validation |

Sources: [BCD `api/Navigator.json`](https://github.com/mdn/browser-compat-data/blob/main/api/Navigator.json), [`api/Window.json`](https://github.com/mdn/browser-compat-data/blob/main/api/Window.json), [`api/FileSystemFileHandle.json`](https://github.com/mdn/browser-compat-data/blob/main/api/FileSystemFileHandle.json), [`manifests/webapp/share_target.json`](https://github.com/mdn/browser-compat-data/blob/main/manifests/webapp/share_target.json), [`manifests/webapp/shortcuts.json`](https://github.com/mdn/browser-compat-data/blob/main/manifests/webapp/shortcuts.json).

**Practical export design:** one JSON document, gzipped with `CompressionStream` (free, Safari 16.4+), offered via `navigator.share({ files: [new File(...)] })` with an `<a download>` fallback behind `navigator.canShare()`. Nudge a monthly export. Because there is no File System Access and no Share Target on iOS, round-tripping is always an explicit user action — design for that rather than fighting it.

**Hosting limits** ([GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)): published sites *"may be no larger than 1 GB"*, with a *"soft bandwidth limit of 100 GB per month"* and a *"soft limit of 10 builds per hour"*. GitHub also asks that Pages not be used as a general free web-hosting service for a business. Separately, Git's own hard per-file push limit (100 MiB) constrains any bundled dataset or model file.

---

## 10. Authoritative free content sources

**The crucial distinction first.** You are writing your **own summaries**, and *nutritional and physiological facts are not copyrightable* (§6: *Feist* in the US; *EBC v. Modak* in India requires "skill and judgment" for a compilation, not for the underlying facts). So the question for each source is not "may we summarise it?" — you may — but **"may we quote it, reproduce its tables, or adapt it?"** Those answers differ sharply, and two of the most useful sources are the most restricted.

| Source | Licence / terms | Link? | Our own summary? | Short quotes with attribution? | Reproduce tables/figures? |
|---|---|---|---|---|---|
| **NIH ODS fact sheets** (B12, vitamin D) | US federal work — public domain | ✅ | ✅ | ✅ | ✅ (likely) — see note |
| **CDC / NIOSH** (ergonomics) | **Public domain, explicitly** | ✅ | ✅ | ✅ | ✅ with conditions |
| **OSHA** (Computer Workstations eTool) | US federal work (17 U.S.C. §105) | ✅ | ✅ | ✅ | ✅ (likely) — statement Unverified |
| **NHS** (B12, vitamin D, activity guidelines) | **Open Government Licence v3.0** | ✅ | ✅ | ✅ | ✅ **including commercially** |
| **WHO** (physical activity guidelines 2020) | **CC BY-NC-SA 3.0 IGO** | ✅ | ✅ | ✅ | ⚠️ only non-commercially + share-alike |
| **ADA Standards of Care** | **"All rights reserved"** | ✅ | ✅ | ⚠️ fair use only | ❌ needs ADA permission |
| **ICMR-NIN DGI 2024 / RDA-EAR** | **All rights reserved** | ✅ | ✅ | ⚠️ cite only | ❌ needs NIN written permission |
| **NICE guidelines** (low back pain / sciatica) | NICE UK Open Content Licence | ✅ | ✅ | ✅ | ⚠️ read the licence — **Unverified** |
| **ACSM position stands** | paywalled, all rights reserved | ✅ | ✅ | ❌ | ❌ |

### The clean ones

**NIH Office of Dietary Supplements** — [Vitamin B12](https://ods.od.nih.gov/factsheets/VitaminB12-HealthProfessional/), [Vitamin D](https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/). Both have a "Health Professional" version (fully referenced, with the DRI/RDA/UL tables) and a plain-language "Consumer" version. The governing statement is the **Public Use Policy** at [ods.od.nih.gov/About/Site_Policies.aspx](https://ods.od.nih.gov/About/Site_Policies.aspx), verbatim:

> *"Most of the information available from this site is within the public domain and unless stated otherwise, may be freely downloaded and reproduced, provided the content has not been changed or modified. When using information from this site, we do ask that you avoid creating the impression that the ODS is endorsing or promoting any particular product or service. At times the ODS site may contain documents or links to documents, such as full-text journal articles that may be copyright protected. Permission to reproduce copyrighted documents may be required."*

⚠️ Two corrections to commonly-repeated claims: **there is no `ods.od.nih.gov/About/copyright.aspx`** (it has never existed — zero Wayback captures), and the oft-quoted *"does not have copyright restrictions / we ask only that you…"* wording is **not** in the ODS fact sheets, whose only notice is a medical disclaimer. The statutory backing is **[17 U.S.C. §105(a)](https://www.law.cornell.edu/uscode/text/17/105)** — but note §105(b)/(c), added in 2019, carve out military-academy "covered works", so don't state §105 as absolute. For a diabetic user, note B12 specifically: metformin is an established cause of B12 depletion, and the ODS professional fact sheet covers it with citations.

**CDC / NIOSH** — the strongest explicit permission of any source here. CDC's [reusing-content page](https://www.cdc.gov/other/agencymaterials.html) states most CDC and ATSDR material **"is in the public domain"** and may be used or copied **"without obtaining copyright permission"**, subject to four conditions: credit the originating agency, include a prominent **no-endorsement disclaimer**, leave the substance unaltered, and note that CDC offers the content free on its own site. Exceptions: contractor/grantee-produced or **third-party-licensed images** (CDC's own PHIL library images are royalty-free with credit; stock photos are not), and CDC/ATSDR/HHS **logos require express written permission**. ⚠️ NIOSH's main [ergonomics page](https://www.cdc.gov/niosh/ergonomics/about/index.html) is about *industrial* MSD risk — lifting, awkward postures, vibration — and says nothing about desks or screens. For office/computer work, go to OSHA.

**OSHA — public domain, confirmed.** [dol.gov/general/aboutdol/copyright](https://www.dol.gov/general/aboutdol/copyright): works created by the federal government are public domain and may be *"reproduced and distributed without permission"*, with no advance DOL approval needed; credit may name "the U.S. Department of Labor" and/or dol.gov. Limits: don't imply DOL endorsement; DOL seals and logos need prior approval; and a **bolded warning that "Not all materials on this website were created by the federal government"** — so check the eTool's own Credits page before reusing its illustrations.

The [Computer Workstations eTool](https://www.osha.gov/etools/computer-workstations) is the single best free source for the posture-break feature. It covers recommended body postures, seating, desks, document holders, keyboards, monitors, pointing devices, phones, wrist/palm rests, a workspace-environment section, a work-process section, and **two checklists** (evaluate an existing setup; guide new purchases). Concrete targets from its interactive figure, verbatim: *"Top of monitor at or just below eye level"*; neck and head neutral and stacked above the trunk with loose shoulders; upper arms near the sides with elbow support; hands and wrists straight in line with the forearms; support for the small of the back; feet flat on the floor; enough surface for keyboard and mouse. Note the eTool's own disclaimer: eTools *"sometimes go beyond what OSHA mandates"* and *"do not create new OSHA requirements."*

**NHS — OGL, confirmed, and it permits commercial use. But read the attribution rule carefully, because it has a sting.**

There is no `nhs.uk/.../copyright` page (every such URL 404s). The licence is **§3 of the terms**, at [nhs.uk/our-policies/terms-and-conditions](https://www.nhs.uk/our-policies/terms-and-conditions/), verbatim:

> *"Copyright and database rights in NHS Website Content are released free-of-charge under the current version of the Open Government Licence ("OGL"), except where specified… This means that you can use NHS Website Content, except where specified, including copying it, adapting it, and using it for any purpose, including commercially."*

The underlying [OGL v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/) grants *"copy, publish, distribute and transmit"*, *"adapt"*, and **"exploit the Information commercially and non-commercially"**, with one duty — acknowledge the source — and the default string *"Contains public sector information licensed under the Open Government Licence v3.0."* **Failing to attribute terminates your rights automatically.**

**⭐ The catch that matters for this project: NHS §3.6 specifies two *different* attribution rules, and the one for adapted content forbids naming the NHS.**

- **Verbatim copies:** *"Information from the NHS website"* + *"as at DDMMYY"* + a link per instance, **plus** a prominent site-wide *"Information from the NHS website is licensed under the Open Government Licence v3.0."*
- **Adapted content — which is exactly what our own summaries are:** use the generic OGL string, and ***"You must not attribute the content to the NHS website or cite the NHS specifically as the source of the adapted… content."***

So if you summarise an NHS page in your own words, **you must not say "source: NHS."** That is counter-intuitive and easy to get wrong. (It is also a reason to prefer NIH ODS, which *wants* a non-endorsement disclaimer rather than forbidding attribution, for content you intend to rewrite.)

Other NHS terms worth knowing: §3.10 — **no specific charge may be levied for access to NHS content**; §1.4 — the content is *"intended for use only by people who live in England"*, which matters for an India-based user; and the precedence clause — *"If there is any conflict between the OGL terms and these terms and conditions these terms and conditions shall take precedence."* Exclusions (§3.5): logos, visuals, image rights, trademarks and design styles; other IP; personal data; medical devices; and **third-party content — *"Many images on the NHS website are included as these are licensed by stock sites"***. Whole sub-sites are excluded and listed at [content not licensed for re-use](https://www.nhs.uk/our-policies/terms-and-conditions/content-not-licensed-for-re-use/) (Change4Life, Best Start in Life, Be Clear on Cancer, One You, Smokefree, Quit Now).

Relevant pages: [Vitamin B12 or folate deficiency anaemia](https://www.nhs.uk/conditions/vitamin-b12-or-folate-deficiency-anaemia/), [Vitamins and minerals — Vitamin D](https://www.nhs.uk/conditions/vitamins-and-minerals/vitamin-d/), [Physical activity guidelines for adults aged 19 to 64](https://www.nhs.uk/live-well/exercise/exercise-guidelines/physical-activity-guidelines-for-adults-aged-19-to-64/).

### The restricted ones — summarise, cite, do not reproduce

**WHO guidelines on physical activity and sedentary behaviour (2020)** — [publication page](https://www.who.int/publications/i/item/9789240015128), 25 Nov 2020, ISBN 9789240015128. Licence: **CC BY-NC-SA 3.0 IGO** (the page shows the four CC icons linking to the [IGO deed](https://creativecommons.org/licenses/by-nc-sa/3.0/igo/deed.en); no wording accompanies them). So: attribution required, **non-commercial only**, **share-alike on adaptations**. WHO's standard IGO terms also require that any adaptation carry a disclaimer that it was not created by WHO and that WHO is not responsible for its content, and that translations include specified wording. ⚠️ **The exact required disclaimer text is in the PDF's front matter, which I did not retrieve — Unverified.**

**Practical reading:** if this app is and stays non-commercial, you could reproduce WHO text and figures under the licence provided you attribute, carry the disclaimer, and release the adaptation share-alike. **Writing your own summary of the recommendations avoids all of that** — the recommendations themselves (150–300 min/week moderate aerobic activity, or 75–150 min vigorous; muscle-strengthening on 2+ days; limit sedentary time; all adults including those with chronic conditions) are facts, and a fact is not expression. **Prefer the summary route and keep the NC/SA obligations off your licence surface entirely.** Also useful and under the same regime: the WHO [physical activity fact sheet](https://www.who.int/news-room/fact-sheets/detail/physical-activity).

**ADA Standards of Care in Diabetes — free to read, but the 2026 licence explicitly forbids machine learning and third-party posting.** This is the most consequential licence finding in the section.

Current edition **2026**, published as a supplement to *Diabetes Care* — **volume 49, Supplement 1**, with exercise in **Section 5, "Facilitating Positive Health Behaviors and Well-being to Improve Health Outcomes"**, pp. S89–S131, [doi:10.2337/dc26-s005](https://doi.org/10.2337/dc26-s005). Hub: [professional.diabetes.org/standards-of-care](https://professional.diabetes.org/standards-of-care).

**Free to read: yes, confirmed.** ADA's own [license page](https://diabetesjournals.org/journals/pages/license) lists as freely available immediately on publication *"ADA-authored articles, including ADA Statements and the annual 'Standards of Medical Care in Diabetes'"*, and Crossref records `delay-in-days: 0` for the Section 5 DOI. (diabetesjournals.org returns HTTP 403 to every automated client via Cloudflare; it is fine in a real browser.)

**But the 2026 copyright notice is tightened versus the older form.** The notice people usually quote is the **2016** one, e.g. on the ADA/ACSM joint position statement *"Physical Activity/Exercise and Diabetes"* ([doi:10.2337/dc16-1728](https://doi.org/10.2337/dc16-1728)): *"Readers may use this article as long as the work is properly cited, the use is educational and not for profit, and the work is not altered."* The **2026 Standards** notice reads, verbatim:

> *"© 2025 by the American Diabetes Association. Readers may use this work for educational, noncommercial purposes if properly cited and unaltered. The version of record may be linked at https://diabetesjournals.org/care, but **ADA permission is required to post this work on any third-party site or platform**. This publication and its contents **may not be reproduced, distributed, or used for text or data mining, machine learning, or similar technologies** without prior written permission."*

**⇒ Two hard consequences for this build:**
1. **You may not host ADA text on GitHub Pages** — that is "posting on a third-party site or platform".
2. **You may not put ADA text into the retrieval index** described in §7 — building a search index over a corpus is text/data mining, and the clause names it explicitly alongside machine learning.

There is **no CC licence anywhere** (even Open Choice articles use ADA's own licence). Tables and figures go through the Copyright Clearance Center. The site licence does twice carve out *"normal quotations with an appropriate citation"*.

**⇒ For diabetes-and-exercise content: write your own summary from the facts, cite the section and DOI, and link out. Do not paste ADA text, do not bundle it, do not index it.** The clinically important points are facts you can state in your own words: pre-exercise glucose checks; carbohydrate before activity if below roughly 90 mg/dL on insulin or a sulfonylurea; avoid exercise with ketosis; resistance training 2–3×/week; break up sitting every 30 minutes; inspect the feet if there is neuropathy.

**ICMR-NIN "Dietary Guidelines for Indians" 2024** — the hub is [nin.res.in](https://www.nin.res.in/) ("Dietary Guidelines 2024 Released. Click to read online"), with the full document in a flipbook viewer at [/dietaryguidelines/index.html](https://www.nin.res.in/dietaryguidelines/index.html) and a **freely downloadable short booklet** in English, Hindi and Telugu — e.g. [`DGI_Booklet_English_CMYK.pdf`](https://www.nin.res.in/downloads/DGI_Booklet_English_CMYK.pdf) (measured: 34,875,560 bytes), which contains all 17 guidelines with rationale and "points to register". Also on the same site: **"Nutrient Requirements for Indians — RDA and EAR"** (the 2020 ICMR-NIN report), *What India Eats*, *My Plate for the Day*, and a food-label booklet.

**The full document is at [`nin.res.in/dietaryguidelines/pdfjs/locale/DGI_2024.pdf`](https://www.nin.res.in/dietaryguidelines/pdfjs/locale/DGI_2024.pdf)** — 148 pages, 24,471,521 bytes (23.3 MB). Its imprint page (p.3) carries **the same restriction as IFCT 2017**, verbatim:

> *"© Copyright DIETARY GUIDELINES FOR INDIANS-2024 … **The use and dissemination of the data in this book is encouraged. This publication can be reproduced for personal use with full acknowledgment of the source citation. However, no part of this publication can be stored or reproduced in any electronic format for creating a product without the prior written permission of the National Institute of Nutrition, Hyderabad.**"*

Note the clause says **"a product"**, not "a commercial product" — a PWA is a product either way. There is no CC licence and **no GODL-India**: neither nin.res.in nor icmr.gov.in mentions GODL or NDSAP. ICMR's *parent* copyright policy is more generous (*"Material featured on this Website may be reproduced free of charge"* — [icmr.gov.in/copyright-policy](https://www.icmr.gov.in/copyright-policy)) **but the document-specific imprint governs.** The freely-downloadable short booklet contains no copyright statement at all, so the site-wide terms govern it — and they are explicit: *"All rights reserved for this website. No part of this website may be reproduced, distributed, or transmitted in any form or by any means, including photocopying, recording, **using scrapping automated softwares** or other electronic or mechanical methods, without the prior written permission of Institute."* ICMR pre-grants deep-linking but **forbids iframes** ([hyperlinking policy](https://www.icmr.gov.in/hyperlinking-policy)) — so link out, don't embed.

**⇒ Summarise the 17 guidelines in your own words, cite the document, link to the official PDF. Do not bundle its text or tables.** This is also the right source to *cite* for an Indian-context nutrition view, and the free booklet is a legitimate thing to link users to directly.

### Gaps and the remaining candidates

- **Hydration / water intake.** There is no single authoritative free number. The usual citable anchors are the **EFSA Dietary Reference Values for water** (2010; EFSA publications are generally reusable with attribution — **Unverified, not checked**) and the **US NAM/IOM** total-water AIs. ICMR-NIN's RDA-EAR report covers Indian recommendations but is all-rights-reserved. **Recommendation: don't ship a number as a target.** Frame hydration as a habit prompt ("have a glass now") rather than a quantified goal — which also sidesteps the fact that individual requirements vary enormously with climate, which matters in India.
- **Sleep.** CDC and AASM both publish free adult sleep-duration recommendations; CDC's is public domain under the terms above and is the easier citation.
- **Low back pain and sciatica.** **NICE NG59** (*Low back pain and sciatica in over 16s: assessment and management*) is the right UK guideline, and NICE publishes under the **NICE UK Open Content Licence** — ⚠️ terms **Unverified**, read them before reproducing anything; NICE is generally permissive for non-commercial UK use and more restrictive otherwise. **ACSM position stands are paywalled and all-rights-reserved** — citable, not reproducible.
- **A note that matters more than any licence:** for any specific lumbar disc injury or sciatica, published general guidelines are the wrong authority for exercise selection. Treat bundled content as *education*, keep a persistent "general information, not medical advice — your physiotherapist overrides this app" affordance, and never let a guideline summary drive an exercise prescription. That is also what keeps the app inside the FDA General Wellness and Non-Device CDS lines discussed in §3 and §7.

**Recommendation: use** NIH ODS, CDC/NIOSH, OSHA and NHS content freely (with attribution); **use with care** WHO (NC/SA) by summarising rather than reproducing; **cite only** ADA, ICMR-NIN, NICE and ACSM. In every case write our own prose — which is both the safest licensing position and the better product.

---

---

## Dead ends

Things that sound possible but are not. Each line exists so nobody spends a weekend on it later.

1. **All-day background step counting.** There is no background execution for web content on iOS. Background Sync, Periodic Background Sync and Background Fetch are all unimplemented in WebKit; `DeviceMotionEvent` is `Exposed=Window`; a service worker only wakes for a push. Screen Wake Lock cannot help — the spec releases it when the document is hidden. **Confirmed by absence.**
2. **Background GPS tracking.** The W3C spec itself: *"position updates are exclusively delivered to fully active documents that are visible"*, and `Geolocation` is `Exposed=Window`. There is no equivalent of CoreLocation's always-authorisation and no way to ask for one.
3. **The Generic Sensor API on iOS** (`Accelerometer`, `Gyroscope`, `LinearAccelerationSensor`, `AmbientLightSensor`). WebKit's standards position is **`oppose`** ([issue #347](https://github.com/WebKit/standards-positions/issues/347)). Not "not yet" — not coming.
4. **A `Pedometer` web API.** Doesn't exist in any browser and isn't in MDN's compat database. Apple's step count is CoreMotion/HealthKit, native only.
5. **Web Bluetooth for a heart-rate strap on iOS.** WebKit `position: oppose` ([#570](https://github.com/WebKit/standards-positions/issues/570)); the spec's own CG says *"no plan to support it in the near future"*; the bug has been open since 2012. **Chrome on iOS is WebKit, so it doesn't help.** And the `iOSWebBLE` Safari-extension shim is unreachable because Safari Web Extensions in web apps are **macOS-only**.
6. **Notification Triggers** (`showTrigger` / `TimestampTrigger`). Chrome Platform Status: *"In developer trial (Behind a flag)"*, **no shipping version in any browser**; the explainer's README is untouched since 2019.
7. **Notifications in an iOS Safari *tab*.** The `Notification` interface is **undefined** outside a home-screen web app; the constructor throws `ReferenceError`. Install is not a nice-to-have, it is the gate.
8. **Reading Apple Health or writing to it from a web page.** HealthKit's platform list is iOS/iPadOS/Mac Catalyst/macOS/visionOS/watchOS. No web, no REST, no URL scheme.
9. **The Google Fit REST API.** Deprecated in 2026, signups closed 1 May 2024, replaced by Health Connect, which is Android-native.
10. **Appearing in the iOS share sheet to receive a Health export.** Web Share **Target** is unsupported in Safari and iOS Safari. Only Chrome 89 / Chrome Android 76.
11. **`showSaveFilePicker` / `showOpenFilePicker` / `showDirectoryPicker`.** Chrome only; WebKit's position is **`oppose`** (security, [issue #28](https://github.com/WebKit/standards-positions/issues/28)). Note the confusing nuance: Safari *does* support `FileSystemFileHandle` — but only for the **private** origin filesystem, not user-visible files.
12. **`BarcodeDetector`.** `ShapeDetection` is `status: testable, defaultValue: false` in WebKit with no platform override, and **[bug 281848](https://bugs.webkit.org/show_bug.cgi?id=281848) is open: it doesn't work on iOS even with the flag on.** Ship a WASM decoder.
13. **`navigator.vibrate` on iOS.** Not implemented in WebKit. (Firefox *removed* it in 129.) Haptics via the `<input type="checkbox" switch>` trick is **Unverified** — assume unavailable.
14. **Battery Status and Compute Pressure APIs.** `getBattery` is unimplemented in Safari; WebKit's position on Compute Pressure is **`oppose`**. **Your app cannot detect that it is being thermally throttled or draining the battery** — build your own frame-interval telemetry.
15. **Forcing cross-origin isolation on GitHub Pages with `coi-serviceworker`.** Pages cannot set headers, `<meta http-equiv>` cannot set COOP/COEP, and on iOS *succeeding* is the failure mode: [onnxruntime#11679](https://github.com/microsoft/onnxruntime/issues/11679) (`RangeError: Out of memory` inside `WebAssembly.instantiate`) and [#22086](https://github.com/microsoft/onnxruntime/issues/22086), which names **iPhone 13 Pro Max specifically**. The single-threaded SIMD path you get by default is the *safe* one.
16. **A useful on-device LLM.** Not blocked by WebGPU — WebGPU ships on iOS 26+. Blocked by Apple's **~1.5 GB WebContent process cap**, stated on the record by Apple engineers, with an uncatchable *"A problem occurred with this webpage"* as the failure mode. Nothing above ~1B parameters survives.
17. **`window.ai` / the Chrome Prompt API.** Desktop-Chrome-only even in Chrome (requires 22 GB free and >4 GB VRAM), and WebKit's position is **`oppose`**.
18. **Bundling model weights in the GitHub repo.** *"GitHub blocks files larger than 100 MiB"*, and **"Git LFS cannot be used with GitHub Pages sites."** The smallest quantised chat model (112 MiB) is already over.
19. **Bundling IFCT 2017 / ICMR-NIN tables.** The copyright page bans *"stored or reproduced in any electronic format for creating a product"*. No GitHub or Kaggle "licence" fixes this — those uploaders have no title to grant. And Indian government works are **not** public domain: 60-year term, protected to 2077.
20. **A tiled basemap in an offline PWA.** *"Offline use is not permitted on tile.openstreetmap.org"*, and pre-fetching tiles is explicitly forbidden.
21. **Form / posture checking from a phone camera.** **No landmarks exist between the shoulders and the hips** in MediaPipe (33) or MoveNet (17) — no C7, no lumbar vertebrae, no sacrum. A "lumbar angle" can only be one rigid trunk segment, which cannot distinguish lumbar flexion from hip flexion. Measured error vs Vicon for knee valgus is **18.83–19.68°** against a **>10°** clinical threshold, and 2D frontal-plane valgus has **r = 0.127, p = 0.094** against 3D truth for single-leg squats *even with expert manual digitising*. Google's own model card: *"The model is not intended for human life-critical decisions. The primary intended application is entertainment."*
22. **Auto rep counting for glute bridges and floor work.** Google, verbatim: *"seated knee extensions or supine positions (laying down) cause grief for even state-of-the-art detectors."*
23. **Slouch or forward-head detection from one phone.** Underdetermined, not noisy — slouch is a multi-segment curvature change at constant trunk inclination. Published work needs three to ten sensors.
24. **`localStorage` as the data layer.** 5 MiB cap and synchronous. It will fail the moment you bundle a food table or import a Health export.
25. **Putting ADA Standards of Care text into the retrieval corpus.** The 2026 notice explicitly forbids use *"for text or data mining, machine learning, or similar technologies"* and requires ADA permission *"to post this work on any third-party site or platform"*. Building a search index over it is exactly the prohibited act. Summarise the facts yourself and cite the DOI.
26. **Citing the NHS as the source of your own summaries.** NHS terms §3.6: *"You must not attribute the content to the NHS website or cite the NHS specifically as the source of the adapted… content."* Use the generic OGL string instead. Counter-intuitive, and easy to get backwards.
27. **Assuming any Indian government publication is public domain.** India has no US-style federal-works public domain: a Government work gets **60 years** from publication (so IFCT 2017 and DGI-2024 are protected to 2077 and 2084), and both carry an imprint banning electronic reproduction *"for creating a product"*.

---

## Best bets

The ten highest value-for-risk capabilities, ranked, with one line each on why.

1. **Migrate the data layer from `localStorage` to IndexedDB.** Unlocks ~60% of disk instead of 5 MiB, stops blocking the main thread, and is a prerequisite for food data, imports and offline models. Nothing else on this list works well without it.
2. **Make "Add to Home Screen" a guided first-run step.** It is the gate for notifications (iOS 16.4+), badging, Screen Wake Lock (18.4+) **and** data durability — WebKit: installed web apps have *"their own counter of days of use"* and *"We do not expect the first-party in such a web application to have its website data deleted."* One UI flow buys four capabilities. From iOS 26 any site installs with no manifest prerequisites.
3. **Bundle USDA FoodData Central SR Legacy.** CC0, no attribution legally required, no API, no key, no runtime dependency — **7,793 foods with 15 nutrients for ~412 KB gzipped** (measured). The single best effort-to-value ratio in the report.
4. **A retrieval assistant over bundled, human-written content** (`minisearch`, MIT, **5.7 KB** + ~70–250 KB index, 0.4 ms queries). Works offline on every device, cites its source, and is *categorically incapable* of inventing health advice — which matters when frontier models still give unsafe answers 5–13% of the time and INT4 quantisation degrades emergency-risk answers by ~27%.
5. **Generated `.ics` reminders with `VALARM`.** Hands the schedule to iOS Calendar, which fires notifications natively with **zero server and zero push infrastructure**, and keeps working if the app is never opened. Needs an on-device verification pass.
6. **GPX import.** Plain XML, tiny, trivially parseable, and it is exactly what Apple Health's own `workout-routes/` folder contains. Immediate value for anyone with a watch.
7. **Foreground walk tracking with wake lock + an SVG route polyline.** Genuinely good GPS, a live pace readout, no map licence obligations, no tile hosting. Be explicit in the UI that it pauses when backgrounded.
8. **Export via `navigator.share({ files })` with `CompressionStream` gzip.** Both free and built in since Safari 14 / 16.4; gives a real iOS share-sheet export to Files, Mail or iCloud Drive with no library and no File System Access.
9. **Torch-lit finger PPG for resting pulse.** The torch works from iOS 17.4 — a finding that reverses conventional wisdom — and this is the *only* camera-vitals modality with real validation (**MAE ≈ 2–5 bpm at rest** vs ECG). Ship it as a clearly-labelled wellness estimate with a signal-quality gate and manual entry alongside.
10. **MediaPipe PoseLandmarker lite on CPU for rep counting on standing exercises.** ~18.3 MiB self-hosted, **needs no COOP/COEP** (verified from the WASM memory section), ~0.06 rep MAE in the literature. Strictly scoped to counting, presence, tempo and *relative* change — never form cues.

*Just below the line, and worth knowing:* Apple Health `export.xml` import (high value, but the most engineering of anything here); Web Push with a GitHub Actions cron sender (works, but delay/drop/60-day caveats and a personal subscription in repo secrets); OFF barcode lookup (great API, but ~15% Indian nutrition coverage); `navigator.audioSession.type = 'playback'` (a one-line iOS-only win for voice cues with the ringer off).

---

## Open questions for the humans

**Must be answered on the actual device before building on them:**

1. **Does WebGPU work in an installed home-screen PWA on iOS?** No primary source tests `display-mode: standalone`. The evidence is strong (WebKit's `WebGPUEnabled` pref has no display-mode gate and is a WebKit-wide process preference) but **Unverified**. Probe `'gpu' in navigator` and `requestAdapter()` inside the installed app.
2. **Does an installed PWA get a different WebContent memory cap than a Safari tab?** Apple's ~1.5 GB is stated for "iPhones" generally; nothing distinguishes standalone mode.
3. **Does a camera permission granted in Safari carry into the installed web app?** Sources conflict: Apple fixed re-prompting as a bug in Safari 17.2 and WebKit routes camera through a *persistent* `queryPermission`, but [bug 280394](https://bugs.webkit.org/show_bug.cgi?id=280394) is open with current reports of re-prompting. **Assume not**, and always call from a tap handler because of the **1-minute non-gesture re-prompt rule**.
4. **Does iOS Calendar reliably fire `VALARM` alerts from a PWA-generated `.ics`, and do alerts work for a *subscribed* (`webcal://`) calendar?** Best bet #5 depends on this, and Apple's support pages would not render for verification. **This is the single highest-value unknown in the report** — if it holds, it is the only zero-infrastructure way to notify a user whose app is closed.
5. **What is the real `devicemotion` sampling rate on this iPhone?** A step detector tuned at 60 Hz misbehaves at 20 Hz. Read `event.interval` and measure.
6. **What is PoseLandmarker's actual FPS on the A15 in iOS Safari, CPU vs GPU delegate?** Published figures span ~8× (6–7 fps measured for a comparable MediaPipe graph on iPhone 13-class hardware, vs Google's unsourced 51 fps claim). Nobody has published a number for this device.
7. **What happens thermally and to the battery over a full unplugged 60-minute session** with camera + pose + three.js + voice? There is no published measurement, and **the app cannot detect throttling** (no Compute Pressure, no Battery Status), so this has to be measured by hand.

**Product and policy decisions only you can make:**

8. **Will this app ever be commercial, or distributed beyond you?** It changes three things: the WHO licence (CC BY-NC-**SA** — non-commercial) becomes unusable for reproduced text; ODbL share-alike on a bundled Open Food Facts subset becomes a real obligation; and App Store guideline 5.1.1(ix) would block an individual developer from submitting a health app if you ever wrap it natively.
9. **Do you want to ask ICMR-NIN for written permission to use IFCT 2017?** Its copyright page sets up exactly that route and the book says dissemination *"is encouraged"*. It is a one-page request, and it is the only path to the authoritative Indian dataset. Otherwise: hand-build ~100 dishes with per-value provenance.
10. **Is the Web Push path worth its cost?** It needs a GitHub Actions cron sender holding your VAPID private key and personal subscription endpoint in repo secrets, tolerates 5-minute granularity with possible drops, and dies after 60 days of repo inactivity on a public repo. The `.ics` route has none of that. Pick one; don't build both.
11. **Where does form authority live?** This report recommends removing all corrective form cues. That means the 3D demonstrations *teach* and the physiotherapist *judges*. If you want the app to grade form, that is a different product requiring hardware this phone does not have.
12. **How much first-load weight is acceptable?** The pose stack alone is ~18.3 MiB. An embedding model would add ~25 MB. The retrieval-only assistant adds ~250 KB. These are three different products with three different install experiences.

**Smaller unresolved items**, all flagged inline above: WHO's exact required adaptation disclaimer (in the PDF front matter, not retrieved); NICE's UK Open Content Licence terms; EFSA's reuse terms for the water DRVs; whether a granted `navigator.storage.persist()` also overrides the 7-day script-writable-storage rule (neither MDN nor WebKit reconciles the two statements); whether WebKit bugs 273938 / 275527 / 282327 are actually fixed on iOS 26/27 (stale-open, not confirmed-fixed); whether `zoom: false` mitigates the rear triple-camera lens swap (bug 262416 — an untested engineer suggestion); whether haptic feedback via `<input type="checkbox" switch>` is real; whether WASM MEMORY64 has shipped in Safari 27 (relevant only if you pursue `wllama`); the total size of the Open Food Facts image dataset; whether MediaPipe's GPU-delegate silent-wrong-output bug (#6142) affects PoseLandmarker as well as Image Segmenter; and the format of a Google Takeout Fit export.

**Resolved during this research**, recorded so nobody re-opens them: NHS content *is* OGL (in the terms, not a copyright page); NIH ODS's statement is the Public Use Policy and `About/copyright.aspx` has never existed; DOL/OSHA material *is* public domain; the ADA Standards *are* free to read but carry an ML/mining prohibition; the full ICMR-NIN DGI-2024 PDF and its imprint *were* located; `<input type="file">` on iOS *can* pick a `.zip` (the `accept` attribute is ignored entirely); WebGPU *is* enabled by default on iOS 26+; the `torch` constraint *is* supported from iOS 17.4; and `Screen Wake Lock` works in an installed PWA from iOS 18.4.
