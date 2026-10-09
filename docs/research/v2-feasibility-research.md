# v2 feasibility research: maps, food data, energy, iOS web app limits, charts

**Date:** 2026-10-08. Every source below was read on 2026-10-08 unless marked otherwise.
**Scope:** a front-end-only PWA on GitHub Pages, installed on iPhone (iOS 18 to 26) and used on desktop. No backend, no paid APIs, no API keys. Health data never leaves the device.
**Board constraint D18:** no WebGL while a walk is being tracked, and at most 1 Hz re-render during a live walk. Animation is allowed only on summary and detail screens.

**Verification labels**
- **Verified**: read at the cited primary source today.
- **Measured**: my own HTTP probe or file measurement today. The method is given.
- **Unverified**: not confirmed at a primary source in this pass. Do not build on it without a check.

**Method note.** `WebSearch` was not available in this session. Findings come from direct fetches of primary sources: the sites' own terms pages, WebKit's blog and source, MDN browser-compat-data, the npm registry, the GitHub API, and live HTTP probes. The work was cut short on request, so some items are marked Unverified rather than chased down.

---

## Decisions (read this first)

| # | Decision | Recommendation | Why (evidence below) |
|---|---|---|---|
| 1a | **Map during a live walk** | **No basemap.** Draw the route shape as an SVG polyline, re-rendered at most once a second. | D18 forbids WebGL while tracking. An SVG path needs no network, no provider and no licence. |
| 1b | **Map on the walk summary and detail screens** | **Raster tiles from `tile.openstreetmap.org` in a tiny custom static map**: an `<img>` grid sized to the route, with an SVG overlay for the route and its start and end. No map library. Behind a "Show map" tap, with a one-line disclosure. | Keyless. The OSMF policy allows "normal interactive viewing by a human" of viewport tiles. No WebGL. About 2 to 3 KB of our own code, against 41.5 KiB gzip for Leaflet or about 419 KiB gzip for MapLibre (measured). |
| 1c | **If pan and zoom are wanted later** | **Leaflet 1.9.4** (41.5 KiB JS + 3.5 KiB CSS gzip, measured) on the same OSM raster tiles. | DOM and SVG rendering, no WebGL. |
| 1d | **Not now** | MapLibre GL JS 6 + OpenFreeMap vector tiles; self-hosted Protomaps PMTiles. | MapLibre 6 needs WebGL2 and weighs about 419 KiB gzip (measured). A city-sized PMTiles extract is 32.6 MB; India's bounding box is about 5.3 GB (both measured). |
| 1e | **No-provider mode** | The SVG route shape is the default and the offline fallback. The map is opt-in per view. | A tile request tells the tile host roughly where the walk was (see §1.6). |
| 2a | **Bundled food data** | **Author our own recipes from USDA FoodData Central ingredients.** FDC is CC0, which is a written public-domain dedication (Verified). Compute kcal and carbohydrate per portion at build time. | The only candidate with a written licence that permits redistribution in an app bundle. |
| 2b | **INDB (Anuvaad Solutions)** | **Do not bundle.** Use it only as a reference to read. Ask the authors in writing if you want it. | Its GitHub repository has no licence file, and its values derive from IFCT 2017 (Verified). |
| 2c | **IFCT 2017 (ICMR-NIN)** | **Do not bundle.** Cite it and link to it only. | The copyright page forbids storing it "in any electronic format for creating a product" without written permission (Verified). |
| 2d | **Open Food Facts** | **Do not bundle.** | ODbL share-alike, and its terms say the data "must not be used for medical purposes" (Verified). |
| 2e | **Portion units (katori, roti, ladle, cup)** | Define each portion **in grams inside our own table**, show the grams, and let the user re-weigh and override. | No source checked in this pass defines these household measures. INDB's paper never mentions them (Verified). |
| 2f | **Allergens** | **Author allergen tags ourselves**, per recipe. | No allergen metadata was confirmed in FDC SR Legacy or Foundation Foods (Unverified). |
| 3 | **Energy (calories burned)** | `kcal = MET × body mass (kg) × duration (h)`. Show **net** active energy, `(MET − 1) × kg × h`, as "about N kcal" with a ±25% range. Walking METs come from the 2024 Compendium (Verified, §3). | METs are population averages. Net matches what "burned by this walk" means. |
| 4a | **Safari tab and installed app sharing IndexedDB** | **Assume not shared.** Offer export and import to move data. | No primary source says either way (Unverified). Treat a shared store as a bug you got lucky with. |
| 4b | **Motion permission** | Call `DeviceMotionEvent.requestPermission()` only inside a tap handler, on every cold launch. | It needs transient activation, and rejects with `NotAllowedError` otherwise (Verified, MDN). That the grant does not persist is Unverified. |
| 4c | **Wake Lock** | Use it on iOS **18.4+** in the installed app. Feature-detect, and fall back to a "keep the screen on" note. | Wake Lock did not work in Home Screen apps from iOS 16.4 to 18.3 (Verified, MDN BCD). |
| 4d | **Storage eviction** | Make installing the app a first-run step, call `navigator.storage.persist()`, and prompt for a regular export. | Safari clears script-writable storage after 7 days without interaction, but Home Screen apps have "their own counter" and their data is not expected to be deleted (Verified, WebKit). |
| 5 | **Steps from Apple Health** | **No.** An installed web app cannot read the day's step total. Ship manual entry with a **Paste** button, plus an optional Shortcut that copies today's steps to the clipboard. | No web API reaches HealthKit (Unverified in this pass). Clipboard paste is the only user-mediated route, and it needs testing on a device. |
| 6 | **Charts and rings** | Keep the hand-rolled SVG `Ring` and `Chart`. Add no dependency. | They already cover the cases, including reduced motion and text equivalents. |

---

## 1. Maps for walk routes

### 1.1 Providers

| Provider | Key? | Terms for an app's live use | Attribution | Caching and offline | What the provider receives |
|---|---|---|---|---|---|
| **OSM Standard raster** `tile.openstreetmap.org` | No | Allowed for "Normal interactive viewing by a human where the client requests only the tiles needed for the current viewport". "No SLA or guarantee". "We may block access, without notice, if your usage degrades the service". Commercial services and those seeking donations are warned "access may be withdrawn at any point". | "© OpenStreetMap contributors", visible. "Do not hide attribution beneath UI, behind toggles, or off-screen." | Cache per HTTP headers, or at least 7 days. **"Offline use is not permitted"**. No bulk download and no prefetch. | IP, User-Agent, Referer, and the tile `z/x/y` for each request. |
| **OSMF vector tiles** `vector.openstreetmap.org` | No | Third-party use welcome. "Best effort", no SLA, "may still be blocked without prior notice". | License attribution, bottom right. | "Bulk downloading is prohibited", including "downloading for offline usage". | As above. |
| **OpenFreeMap** `tiles.openfreemap.org` | No | "no limits on the number of map views or requests". Commercial use: "Yes". No SLA. The ToS (last updated 9 Sep 2026) bans attempts to "collect data from the service in automated ways without permission". | "OpenFreeMap © OpenMapTiles Data from OpenStreetMap". MapLibre adds it automatically. | Offline use is not addressed. Vector tiles only, plus Natural Earth relief rasters at z0–6 (Measured, from the style JSON). | Per the privacy policy (4 Oct 2026): the access logs "do not contain IP addresses", error logs may, and all logs are deleted after 7 days. Traffic may pass through Cloudflare. |
| **Protomaps PMTiles, self-hosted** on GitHub Pages | No | Your own file. | OpenStreetMap (ODbL Produced Work). | Works offline only if you cache the whole file (see §1.3). | GitHub, which already serves the app, sees byte ranges that map to tile locations. |
| **VersaTiles** `tiles.versatiles.org` | No ("requires no API keys") | The public server's terms were not found (**Unverified**). | **Unverified**. | **Unverified**. | The project says it "does not track your users" (project-wide claim). |
| **CARTO basemaps** | **Yes, now required** | "An API key is required to use CARTO basemaps." | — | — | **Disqualified.** |

Sources:
- OSM tile policy: https://operations.osmfoundation.org/policies/tiles/
- OSMF vector tile policy: https://operations.osmfoundation.org/policies/vector/
- OpenFreeMap: https://openfreemap.org/, https://openfreemap.org/tos/, https://openfreemap.org/privacy/, https://openfreemap.org/quick_start/
- VersaTiles: https://versatiles.org/
- CARTO: https://github.com/CartoDB/basemap-styles

**OSM's browser requirements are met by default.** The policy says "Modern browsers, with default settings, already satisfy these technical requirements." It requires a Referer and prohibits "a restrictive Referrer-Policy that prevents the HTTP Referer header being sent". The app's `strict-origin-when-cross-origin` (in `vite.config.ts`) sends the origin, which complies. **Never add `referrerpolicy="no-referrer"` to tile images.**

**OpenFreeMap hosts (Measured).** I fetched `https://tiles.openfreemap.org/styles/liberty` and its TileJSON. The style, TileJSON, vector tiles (`/planet/<build>/{z}/{x}/{y}.pbf`, z0–14), glyphs (`/fonts/...`), sprites (`/sprites/...`) and the relief raster (`/natural_earth/...png`) are all on `tiles.openfreemap.org`. Responses come from `server: cloudflare` with `access-control-allow-origin: *`. They also carry a Cloudflare NEL `report-to` header, which only Chromium honours (Unverified for Safari).

### 1.2 Libraries (Measured)

I downloaded the npm tarballs on 2026-10-08 and compressed each file with `gzip -9`.

| Library | Version (published) | Licence | JS gzip | CSS gzip | Renderer |
|---|---|---|---|---|---|
| **Custom static map** (img grid + SVG) | — | ours | ~2–3 KB (estimate) | — | DOM `<img>` + SVG |
| **Leaflet** | 1.9.4 (2023-05-18). 2.0.0-alpha.1 dates from 2025-08-16 and is still alpha | BSD-2-Clause | **41.5 KiB** (`leaflet.js`) | 3.5 KiB | DOM tiles, SVG or Canvas vectors |
| **MapLibre GL JS** | 6.13.0 (2026-10-06) | BSD-3-Clause | **278.6 KiB** main + **140.4 KiB** worker | 10.3 KiB | **WebGL2 only** |
| `pmtiles` | 4.5.0 | BSD-3-Clause | 7.8 KiB | — | (protocol for MapLibre) |

**MapLibre 6 changed two things that matter here** (Verified, [CHANGELOG](https://github.com/maplibre/maplibre-gl-js/blob/main/CHANGELOG.md) §6.0.0):
- "WebGL (v1) support has been removed; WebGL2 is now required." iOS Safari has supported WebGL2 since 15 ([BCD](https://github.com/mdn/browser-compat-data/blob/main/api/WebGL2RenderingContext.json)).
- It ships as ESM only, and "the ESM build loads its worker as a real URL, so `worker-src blob:` is no longer required."

**Fit to the "polyline route plus start and end markers" use case**
- **Custom static map.** Fit the route's bounding box to a zoom level and lay out the 4 to 12 tiles that cover it as absolutely positioned `<img>`. Project lat/lng into the same pixel space as the route `<path>`, and draw two `<circle>`s for start and end. You get no pan or zoom, which a walk summary does not need.
- **Leaflet.** Use `L.polyline` and two `L.circleMarker`s. Circle markers need no icon images, which avoids the bundler icon-path problem.
- **MapLibre.** Use a GeoJSON source with a `line` layer and a `circle` layer. Heavy for this job.

**Performance on iPhone Safari.** No measured frame rates were found (**Unverified**). Structurally, the static map does nothing per frame. Leaflet moves DOM tiles with CSS transforms. MapLibre runs a WebGL2 context and a worker, which is what D18 forbids during tracking. On a summary screen it is allowed, but costly.

### 1.3 Protomaps PMTiles on GitHub Pages

**Extract sizes (Measured).** I wrote a probe that reads only the PMTiles header and directories of today's planet build (`https://build.protomaps.com/20261008.pmtiles`, 138.7 GB, v4.15.2, z0–15) through HTTP Range requests. It sums the unique tile bytes inside a bounding box:

| Area | Zooms | Tiles | Size |
|---|---|---|---|
| City-sized box, 35 × 34 km (77.46–77.78°E, 12.83–13.14°N) | 0–15 | 1,243 | **32.6 MB** (31.1 MiB) |
| Same box | 0–14 | 343 | ~12.4 MB |
| India bounding box (68.1–97.4°E, 6.7–35.7°N) | 0–12 | 161,000 | 666 MB |
| India bounding box | 0–15 | ~10.2 M | **~5.25 GB** |

Docs: "Each additional zoom level roughly doubles the size of the file" ([downloads](https://docs.protomaps.com/basemaps/downloads)). That page still says the planet is "roughly 120 gigabytes", which is stale: today's build is 138.7 GB ([builds.json](https://build-metadata.protomaps.dev/builds.json), Measured).

**GitHub Pages limits (Verified).** "Published GitHub Pages sites may be no larger than 1 GB". There is a soft limit of 100 GB of bandwidth a month ([Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)). "GitHub blocks files larger than 100 MiB" ([large files](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)). **A city fits. A country does not.**

**Range requests on GitHub Pages (Measured).** I probed `mohakchugh.github.io/fit-strong-90/models/coach-female.bin`:
- `accept-ranges: bytes`.
- `Range: bytes=0-99` returns **206** with `content-range: bytes 0-99/546588`.
- **The catch:** with `Accept-Encoding: gzip` added, Pages returned `content-encoding: gzip` and `content-range: bytes 1000-1999/309855`. The range is taken from the *compressed* body, which would break PMTiles.
- **Browsers avoid it.** The Fetch spec says "If httpRequest's header list contains `Range`, then append (`Accept-Encoding`, `identity`)" ([Fetch](https://fetch.spec.whatwg.org/)). WebKit implements this in `CachedResourceRequest::updateAcceptEncodingHeader()`, and its imported WPT expectation reads "PASS Fetch with range header will be sent with Accept-Encoding: identity" ([source](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/loader/cache/CachedResourceRequest.cpp)). So Safari gets uncompressed ranges. Any non-browser tooling must send `identity` itself.

**Offline is awkward (Verified).** The Service Worker spec's `Cache.put`: "If innerResponse's status is 206, return a promise rejected with a TypeError" ([SW spec](https://w3c.github.io/ServiceWorker/)). To work offline you must cache the whole 31 MiB file and answer ranges by slicing a `Blob` in the service worker.

**Verdict.** Not now. It needs MapLibre and WebGL, a 31 MiB download per city, and custom service-worker range code. Revisit only if an "offline home-area map" becomes a requirement.

### 1.4 CSP changes

Today's production CSP (`vite.config.ts`) is `default-src 'self'`, with `img-src 'self' data: blob:`, `connect-src 'self'` and `worker-src 'self'`. Add only the exact host, with no wildcards:

| Option | Change |
|---|---|
| **Recommended: static map or Leaflet + OSM raster** | `img-src 'self' data: blob: https://tile.openstreetmap.org`. Nothing else. `<img>` loads use `img-src`, not `connect-src`. |
| MapLibre 6 + OpenFreeMap | `connect-src 'self' https://tiles.openfreemap.org`. `worker-src 'self'` is enough if you call `setWorkerUrl()` with the bundled same-origin worker. Keep `img-src 'self' data: blob:`. MapLibre's docs list exactly "worker-src 'self' ;" and "img-src data: blob: 'self' ;" ([docs](https://maplibre.org/maplibre-gl-js/docs/)). |
| Self-hosted PMTiles | No change, because it is same-origin. |

A meta-tag CSP covers all of these. The meta tag only rules out `frame-ancestors`, `report-uri` and `sandbox`.

### 1.5 The "route shape only" fallback

1. Take the fixes for each segment. Keep the app's existing rule of starting a new segment after a gap, and never join across one.
2. Project to a local plane: `x = (lon − lon0) × cos(lat0)` and `y = −(lat − lat0)`, where `lat0` and `lon0` are the centre of the bounding box. That is equirectangular, which is accurate enough at walk scale.
3. Scale uniformly to fit a `viewBox` with padding. Emit one `<path d="M… L…">` per segment, with `vector-effect="non-scaling-stroke"`. Add a start `<circle>`, an end `<circle>`, and a scale bar computed from metres per unit.
4. During a live walk, rebuild the `d` string at most once a second (D18). Thin points with a distance threshold so the path stays at a few hundred vertices.

It needs no network, no licence and no attribution. It also works offline.

### 1.6 Privacy disclosure

A tile request names the tile. At z14 a tile is about 2.4 km across at 13°N (40,075 km × cos 13° ÷ 2¹⁴). So the tile host learns your IP, the time, your browser, and **roughly which few square kilometres the walk covered**. Recommended copy, shown once beside "Show map":

> "Showing a map downloads map pictures from OpenStreetMap's servers. They will see your internet address and roughly which area this walk was in, but not the route itself. Your walk data stays on this device. The route shape below needs no download."

Design rules:
- Off by default.
- Never prefetch.
- Request only the viewport.
- Optionally cap at z13 to coarsen what is revealed.

The OSMF privacy and logging terms for tile servers were not checked (**Unverified**).

---

## 2. Indian food: calories and carbohydrate under a clean licence

### 2.1 Sources

| Source | Written licence? | Bundle in the app? | Evidence |
|---|---|---|---|
| **USDA FoodData Central** | **Yes. CC0 / public domain.** "USDA FoodData Central data are in the public domain and they are not copyrighted. They are published under CC0 1.0 Universal". The requested credit: "we request that users list FoodData Central as the source". | **Yes** | https://fdc.nal.usda.gov/ |
| **INDB, the Indian Nutrient Databank** (Vijayakumar, Dubasi, Awasthi of Anuvaad Solutions, New Delhi; Jaacks) | **No data licence.** The GitHub repository's `license` is `null` and there is no LICENSE file (Measured via the GitHub API). The *article* is CC BY 4.0, which covers the paper, not the data. | **No**, unless you get written permission | Paper: *Curr Dev Nutr* 2024, doi:10.1016/j.cdnut.2024.103790, PMC11277795 (corrected: *Curr Dev Nutr* 2025;9(5):107450, contents not read). Repo: https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB- |
| **IFCT 2017 (ICMR-NIN)** | **No.** Copyright page, verbatim: "However, no part of this publication can be stored or reproduced in any electronic format for creating a product without the prior written permission of the National Institute of Nutrition, Hyderabad." | **No** | Measured: `pdftotext` on https://www.nin.res.in/ebooks/IFCT2017.pdf (585 pages; encrypted with copy:no) |
| **Open Food Facts** | ODbL 1.0 (database), DbCL (contents), CC BY-SA (images). | **No** | Share-alike: an extract of a "Substantial part" is a Derivative Database (ODbL §4.4(b)), and you must offer it under ODbL plus provide access (§4.6). Terms: data "must not be used for medical purposes". https://world.openfoodfacts.org/data, https://world.openfoodfacts.org/terms-of-use, https://opendatacommons.org/licenses/odbl/1-0/ |
| **FAO/INFOODS** | **Unverified** in this pass | — | Not read today |

**What INDB contains (Verified).**
- 1,095 raw foods and 1,014 recipes, with values "per 100 g of the recipe and per serving of the recipe".
- Raw-food values come from IFCT 2017 (528 items) and IFCT 2004 (369), with UK CoFID filling gaps (144 ingredients) and USDA FDC the remaining 54.
- The recipes come from two Indian cookery textbooks and food blogs.
- It is excellent *coverage* of Indian dishes. But its values inherit IFCT's restriction, and the authors cannot license NIN's rights away. Even written permission from Anuvaad covers only their own contribution.

### 2.2 How to ship 150–300 dishes cleanly

1. **Author each recipe yourself**: dish name, ingredients in grams, yield in grams, and the portion definitions. Your own selection, wording and recipes are your own work.
2. **Take ingredient values from FDC** SR Legacy or Foundation Foods (CC0). Record the FDC ID for every ingredient in a `sources[]` field.
3. **Compute at build time**: kcal and available carbohydrate per 100 g and per portion. Apply cooking-yield adjustments as your own documented factor.
4. **Ship a JSON file** of about 50 to 100 KB. Show this attribution: "Ingredient values: U.S. Department of Agriculture, Agricultural Research Service. FoodData Central. https://fdc.nal.usda.gov/ (public domain, CC0 1.0)." Licence your own table CC BY 4.0 if you want others to reuse it.
5. **Never copy a number from IFCT or INDB.** Reading them to sanity-check your own computed value is a judgement call. Keep your values sourced to FDC.

### 2.3 Portion units

**No authoritative definition was confirmed in this pass (Unverified).** INDB's paper records "the total weight of the recipe (g), the number of servings in the recipe, and the serving size" but defines no household measures (Verified).

Make every portion a gram weight inside our own data, for example `{"unit": "katori", "grams": 150}`. Show "1 katori (150 g)", and offer "weigh yours once" to override it. Any default you pick, whether a katori of 150 mL, a ladle or a roti of a given weight, is an **app convention, not a sourced fact**, and the UI should say so.

### 2.4 Allergens

FDC SR Legacy and Foundation Foods are not known to carry allergen fields (**Unverified**). OFF has allergen tags, but they are share-alike and come with the "not for medical purposes" caveat. **Tag allergens ourselves, per recipe, from the ingredient list.** Show "contains: milk, wheat (gluten), peanut…" as derived from our own recipe, and say it is not a guarantee.

---

## 3. Calories burned

### 3.1 MET values: 2024 Adult Compendium (Verified for walking)

From https://pacompendium.com/walking/ (level, firm surface):

| Code | Speed | MET |
|---|---|---|
| 17151 | < 2.0 mph (< 3.2 km/h), strolling | 2.3 |
| 17152 | 2.0–2.4 mph | 2.8 |
| 17170 | 2.5 mph | 3.0 |
| 17190 | 2.8–3.4 mph, moderate | 3.8 |
| 17200 | 3.5–3.9 mph, brisk | 4.8 |
| 17220 | 4.0–4.4 mph (6.4–7.1 km/h), very brisk | 5.5 |
| 17230 | 4.5–4.9 mph | 7.0 |

The page notes that "Specific Activity Codes in red are estimated MET values" and that the rest are supported by published literature. I could not see the red colouring, so I cannot say which rows are estimates.

- **Stretching, yoga and resistance training METs: Unverified in this pass.** Read them from the Compendium's conditioning-exercise category before shipping.
- **Licence and terms: Unverified.** The walking page states none. The citation, *Herrmann SD et al., "2024 Adult Compendium of Physical Activities", J Sport Health Sci 2024*, is from memory and must be checked at the source.

### 3.2 Formula (units)

- **Gross:** `kcal = MET × body mass (kg) × duration (h)`. This uses the convention that 1 MET ≈ 1 kcal·kg⁻¹·h⁻¹.
- **Net (recommended):** `kcal = (MET − 1) × kg × h`. This removes the energy a person would burn at rest anyway.
- **Synthetic example:** a 70 kg person walking 30 minutes at 3.0 mph (MET 3.8) burns 3.8 × 70 × 0.5 = **133 kcal gross**, or (3.8 − 1) × 70 × 0.5 = **98 kcal net**. Show "about 100 kcal (75–125)".
- The convention, and the ACSM walking equation (VO₂ = 3.5 + 0.1·S + 1.8·S·G, in mL·kg⁻¹·min⁻¹ with S in m/min), were **not re-verified at a primary source today (Unverified)**. The Compendium value is the simpler choice and the one to use.

### 3.3 Honest presentation

- Always say "about", and round to the nearest 5 or 10.
- Show a range of ±25%. That figure is a product convention, not a sourced error bound.
- Label it "estimate from walking speed and your weight".
- Never sum it against food kcal as if it were precise.

Beta-blockers blunt heart-rate response, which breaks heart-rate-based estimates. We do not use heart rate, so the MET method is unaffected (the pharmacology was not re-verified today).

---

## 4. What an installed iPhone web app can and cannot do

| Capability | Status | Evidence |
|---|---|---|
| **Wake Lock** | Works in Home Screen apps from **iOS 18.4**. From 16.4 to 18.3 it was partial: "Does not work in standalone Home Screen Web Apps". | Verified: [BCD WakeLock.json](https://github.com/mdn/browser-compat-data/blob/main/api/WakeLock.json) |
| **DeviceMotion permission** | `requestPermission()` "requires transient activation", resolves `"granted"` or `"denied"`, and rejects with `NotAllowedError` without a gesture. The iOS version and whether the grant persists across launches are **Unverified**. | Verified: [MDN](https://developer.mozilla.org/en-US/docs/Web/API/DeviceMotionEvent/requestPermission_static) |
| **Geolocation with the screen locked or the app in the background** | Stops. Treat it as a gap and start a new segment (the app already does). The spec text was not re-fetched today (**Unverified** in this pass). | W3C Geolocation |
| **Web Push** | Home Screen apps on iOS 16.4+, permission "in response to direct user interaction". It always needs a sender, which means a server. | Verified: [WebKit, 16 Feb 2023](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) |
| **Local reminders without a server** | Only while the app is open. Notification Triggers never shipped (**Unverified** in this pass). | — |
| **Badging** | "Home Screen web apps on iOS and iPadOS 16.4 now support the Badging API." Works in the foreground or while handling a push. | Verified: same post |
| **7-day ITP rule** | Safari deletes "all of a website's script-writable storage after seven days of Safari use without user interaction". Home Screen apps "have their own counter of days of use", and "We do not expect the first-party in such a web application to have its website data deleted." | Verified: [WebKit, 24 Mar 2020](https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/) |
| **Quota and `persist()`** | Browser origin quota is "up to 60% of the total disk space". A Home Screen app "has the same origin quota and overall quota as when it is opened in a browser app". `persist()` is granted "based on heuristics like whether the website is opened as a Home Screen Web App". Persistent origins may be skipped during eviction. | Verified: [WebKit, 10 Aug 2023](https://webkit.org/blog/14403/updates-to-storage-policy/) |
| **Safari and the installed app sharing storage** | **Unverified.** Neither WebKit post says. Assume separate stores and design export and import accordingly. | — |
| **A Shortcut or URL handing data to the installed app** | **Unverified.** A URL opened from Shortcuts is expected to open in Safari, not the Home Screen app. If storage is separate, data passed that way lands in the wrong store. | Test on a device |
| **Steps from Apple Health** | No web API (**Unverified** in this pass). The realistic route: a Shortcut ("Find Health Samples" for today's steps, then "Calculate Statistics", then "Copy to Clipboard"), followed by a **Paste** button in the app that calls `navigator.clipboard.readText()` from the tap. Show the pasted number for confirmation, and store it as "entered by you". | Test on a device |

---

## 5. Charts and rings

- `src/components/hig/Ring.tsx` already animates `stroke-dashoffset` from an explicit circumference, keeps a lap arc mounted, and respects reduced motion. `src/components/hig/Chart.tsx` draws line and bar charts with gaps for missing days and a data-table text equivalent.
- **No library is needed. The smallest approach is what is already there.** For bar entry animation on summary screens only (D18), transition `transform: scaleY()` with `transform-box: fill-box; transform-origin: bottom`, and disable it under reduced motion.
- Using an explicit circumference instead of `pathLength` avoids any engine quirks with `pathLength` on `<circle>` (not checked today).
- No tiny MIT chart library was evaluated in this pass. Given the existing components, adding one would be a regression in size and accessibility control.

---

## Decisions recommended for this app

1. **Live walk: SVG route shape only, at most 1 Hz, no basemap.** D18 bans WebGL while tracking, and the shape needs no network or licence.
2. **Summary and detail map: a custom static `<img>` tile grid from `tile.openstreetmap.org` with an SVG overlay, opt-in.** It is keyless, the policy allows viewport-only human viewing, it uses no WebGL, and it is about 2 to 3 KB of code.
3. **Pan and zoom later: Leaflet 1.9.4, not MapLibre.** 41.5 KiB against about 419 KiB gzip, and no WebGL2.
4. **CSP: add only `https://tile.openstreetmap.org` to `img-src`.** It is the one exact host the map needs, with no wildcards.
5. **Attribution: a visible "© OpenStreetMap contributors" on every map.** The tile policy requires it.
6. **Never cache tiles for offline use, and never prefetch.** The OSM policy prohibits both.
7. **Disclose that showing a map reveals the approximate area to OSM.** Tile coordinates locate the walk to a few square kilometres.
8. **Skip PMTiles for now.** It needs 31 MiB per city, WebGL, and service-worker range slicing, and a country is about 5.3 GB.
9. **Food data: our own recipes built from USDA FDC ingredients (CC0).** It is the only source with a written licence that allows bundling.
10. **Do not bundle INDB, IFCT 2017 or Open Food Facts.** They have no data licence, an explicit electronic-reproduction ban, and share-alike plus "not for medical purposes", respectively.
11. **Portions in grams, user-overridable; allergens authored per recipe.** No verified source defines a katori or gives allergen fields we can reuse.
12. **Energy: show net kcal, `(MET − 1) × kg × h`, from the Compendium walking METs, as "about N" with a ±25% range.** METs are population averages.
13. **Assume Safari and the installed app do not share IndexedDB.** It is unverified, and the safe design is export and import.
14. **Install as a first-run step, then call `persist()`, then prompt for a regular export.** Installed apps escape Safari's 7-day counter, and `persist()` favours Home Screen apps.
15. **Wake Lock only on iOS 18.4+ (feature-detect), and motion permission from a tap.** It failed in Home Screen apps before 18.4, and motion requires a gesture.
16. **Steps: manual entry with a Paste button and an optional Shortcut. No automatic read.** No web API reaches HealthKit.
17. **Charts: keep the hand-rolled SVG and add no dependency.** It already handles gaps, reduced motion and text equivalents.

## Open items to verify on a device or at source

- Does Safari's IndexedDB carry into the installed app, on iOS 18 and on iOS 26?
- What does a Shortcuts "Open URLs" call to the app's URL actually open?
- Does `navigator.clipboard.readText()` work from a tap in the installed app, and what does the Paste prompt look like?
- Does the motion permission persist across a cold launch?
- Compendium METs for stretching, yoga and resistance training, plus the Compendium's licence and exact citation.
- The ACSM walking equation at its source.
- FAO/INFOODS terms.
- An authoritative Indian household-measure reference.
- VersaTiles public-server terms.
- The OSMF tile-server privacy policy.
