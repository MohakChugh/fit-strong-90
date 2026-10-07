# Research: voice narration for a 60-minute guided workout

**Scope.** This doc covers the TTS engine, audio playback, keeping the session alive, and timer sync for an offline React 19 + Vite PWA on GitHub Pages. The narration script and the animations are covered in the sibling docs. Researched 2026-10-05.

**Sources.**
- WebKit/Chromium source, bug trackers and release notes.
- MDN browser-compat-data, caniuse, model cards, LICENSE files and pricing pages.
- **Measured** means I ran it myself: kokoro-js 1.2.1 on an Apple M3 Pro (Node, CPU), and ffmpeg encodes of the output.
- Anything not checked is marked **Unverified**.

## Recommendation

Pre-render the narration at build time with **Kokoro-82M** (Apache-2.0 weights) and ship static clips:
- **Ogg Opus at 32 kbps** as the main format, with **AAC at 48 kbps** as the fallback. Measured size is about **28 MB / 45 MB per 2 hours** of speech.
- Clips are cached per workout and played through **one reused `<audio>` element**.
- A **wall-clock timeline** decides when each clip plays.
- `speechSynthesis` is the Phase-0 voice and stays as the fallback.
- The Screen Wake Lock API keeps the screen on. Background and lock-screen playback are best-effort only.

Key constraints:
1. **iOS gives web pages only compact system voices.** Enhanced/Premium voices downloaded in Settings and Siri voices are not exposed (see §2).
2. **On-device neural TTS isn't ready for phones.** Kokoro needs an 86–326 MB model, runs slower than real time on WASM, and its JS phonemizer bundles GPL-3.0 eSpeak NG.
3. **iOS Home Screen apps got Wake Lock only in iOS 18.4.** Their background audio and Media Session support still has open bugs. Design for screen-on, foreground use.
4. **A static site can't keep a TTS credential secret.** Runtime cloud TTS is therefore an open-ended cost risk. Cloud TTS is fine at build time.
5. **Timers must be anchored to the wall clock.** `src/hooks/useTimer.ts` and `useSupersetTimer.ts` decrement a counter once per interval tick, so they drift and freeze when the page is throttled.

## 1. Options compared

| Option | Naturalness | Offline | On-device size | Phone cost | Timer sync | Licence / legal | Secrets & cost | Verdict |
|---|---|---|---|---|---|---|---|---|
| Web Speech, iOS/iPadOS (every iOS browser) | Low–medium (compact voices) | Yes | 0 | Native | Rough; events can be lost | OS | None | Fallback |
| Web Speech, Chrome Android | Medium–good (Google TTS) | If the voice pack is installed | 0 | Native | Rough | OS | None | Fallback |
| Web Speech, Edge desktop "Natural" | High | **No** (online voices) | 0 | n/a | Rough | OS | None | Desktop bonus |
| kokoro-js in the browser | High | After download | 86–326 MB | WASM slower than real time; WebGPU flaky on Android | Good once rendered | Apache-2.0, but bundles GPL eSpeak NG | None | Not on phones (2026) |
| Piper / sherpa-onnx WASM | Medium | After download | 63–114 MB per voice + phonemizer | Lighter than Kokoro (**Unverified** on phones) | Good | GPL engine; voice licences vary | None | No |
| **Build-time Kokoro clips** | High, same on every device | Yes | ~28 MB (Opus) / 45 MB (AAC) per 2 h | Playback only | **Best** (durations known ahead) | Apache-2.0 output; GPL tools stay on the build machine | None | **Primary** |
| Build-time cloud TTS clips | High–very high | Yes | Same | Same | Same | Provider terms (Polly allows replay) | Key stays on the build machine; ~$2–9 once | Alternative voice source |
| Runtime cloud TTS (Cognito or proxy) | Very high | No | 0 | Network latency | Poor | Provider terms | Public credentials or a backend; open-ended cost | **Reject** |

## 2. Web Speech API (`speechSynthesis`)

### Voices you actually get
- **iOS/iPadOS (Safari, Home Screen apps and every iOS browser, all WebKit).**
  - WebKit lists only voices where AVFoundation's `isSystemVoice` is true. It marks every voice `localService: true` and `default: true` ([PlatformSpeechSynthesizerCocoa.mm](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/cocoa/PlatformSpeechSynthesizerCocoa.mm)).
  - Voices downloaded in Settings → Accessibility → Spoken Content don't appear. [WebKit bug 290497](https://bugs.webkit.org/show_bug.cgi?id=290497) has been open since March 2025.
  - In 2024 builds, installing a higher-quality variant removed that voice from Safari entirely. A 2025 retest found it no longer disappears, but "higher quality or downloadable voices remain unavailable" ([Readium #19](https://github.com/HadrienGardeur/web-speech-recommended-voices/issues/19)).
  - Siri voices aren't exposed ([Readium #22](https://github.com/HadrienGardeur/web-speech-recommended-voices/issues/22)). Personal Voice is presumably excluded by the same filter (**Unverified**).
  - What you actually get: compact voices such as Samantha, Daniel and Karen. You also get Eloquence and novelty voices, which you must filter out ([Readium filters](https://github.com/readium/speech/tree/main/json/filters)).
  - On OS 26.3 and later, WebKit loads the voice list asynchronously and fires `voiceschanged` (source above). The event has existed since Safari 16 (MDN BCD).
- **Chrome Android.** Voices come from the Android TTS engine, which has local and network variants. Readium rates them "on par" with Apple's downloadable voices. However, Chrome returns "an unfiltered list of languages/regions" ([Readium WebSpeech.md](https://github.com/readium/speech/blob/main/docs/WebSpeech.md)):
  - It lists packs that aren't installed, then falls back to English.
  - It never flags a default voice.
  - It may use `en_us`-style language tags.
  - `pause()` behaves like `cancel()` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/pause)).
- **Chrome desktop.** It has 19 "Google …" voices. All are network-only and none fire boundary events. Utterances longer than about 14 s stop with no error ([Chromium 332002367](https://issues.chromium.org/issues/332002367), open).
- **Edge desktop.** It has 250+ "Microsoft … Online (Natural)" voices, the most natural you can get through Web Speech. They are network-only and ignore pitch. Edge on Android returns an empty voice list (Readium).
- **Safari macOS** has the same limits as iOS. **Firefox** has no voices of its own and uses the OS voices.

### Choosing the most natural voice
1. Filter by language, normalising `_` to `-`.
2. Drop Apple novelty voices, Eloquence voices and eSpeak voices.
3. Drop voices with `localService === false` while offline. When online, keep a local voice as backup.
4. Score name hints: `Natural` > `Premium` > `Enhanced` > `Google …` > known-good Apple compact voices. An exact locale beats a language-only match.
5. Persist the user's choice by `voiceURI` and `name`. Names are localised on Apple platforms ([Readium](https://github.com/readium/speech/blob/main/json/en.json)).

### Rate and pitch for calm coaching
These defaults are my judgement and need tuning by ear with real users.
- **Pitch: 1.0.** Edge Natural voices ignore it, and shifting it makes other voices sound processed.
- **Rate: 0.9–0.95 by default**, with a user slider from 0.8 to 1.1.
  - WebKit maps rates below 1 linearly onto AVSpeech's default rate, and reaches AVSpeech's maximum at rate 2 (source above).
- Calm pacing comes mostly from pauses. Speak one sentence per utterance with 300–600 ms gaps, and leave longer gaps around breathing cues.
- SSML is not an option, because WebKit reads the tags aloud ([bug 122208](https://bugs.webkit.org/show_bug.cgi?id=122208)).
- **Kokoro is brisk.** Measured on a 46-word coaching paragraph, `af_heart` ran at 203 wpm at speed 1.0, 191 at 0.9 and 163 at 0.8. Use 0.8–0.85 and insert pauses.

### Bugs and workarounds

| Problem | Evidence | Workaround |
|---|---|---|
| iOS silently drops `speak()` until one call happens inside a user gesture | [`SpeechSynthesis::speak`](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/speech/SpeechSynthesis.cpp) | In the Start tap, call `speak()` synchronously, before any `await` |
| Chrome blocks `speak()` before any user activation | [Chrome 71](https://chromestatus.com/feature/5687444770914304) | Same Start tap |
| `getVoices()` is empty at first | Chrome loads voices async; WebKit too on 26.3+ | Wait for `voiceschanged`, with polling and a timeout |
| Google voices stop after ~14 s with no event | crbug 332002367 | Chunk text to ≤140 characters |
| `onend` never fires | Chrome garbage-collects the utterance ([SO](https://stackoverflow.com/questions/23483990)) | Keep references to utterances |
| | WebKit clears the queue with no events when the document is suspended (source) | Add a watchdog per utterance |
| | Utterances queued right after `cancel()` get no events ([238189](https://bugs.webkit.org/show_bug.cgi?id=238189)) | Wait a moment after `cancel()` |
| | Empty utterances get no events ([310602](https://bugs.webkit.org/show_bug.cgi?id=310602)) | Never speak empty text |
| `pause()` cancels on Android | MDN BCD | Pause = cancel, then re-speak the current sentence on resume |
| iOS ducks other audio during speech and for ~1 s after it | [278598](https://bugs.webkit.org/show_bug.cgi?id=278598) | Don't overlap speech with other cues |
| iOS 27: after `speechSynthesis` runs, Web Audio stays silent until reload | [325274](https://bugs.webkit.org/show_bug.cgi?id=325274) (Sept 2026, one reporter) | Never mix speech and Web Audio in one iOS session |
| Screen locked or app backgrounded | JS is suspended and speech is cancelled; Android background speech is **Unverified** | Recompute state when the page becomes visible again |

## 3. Keeping a 60-minute session alive

**Screen Wake Lock.**
- Support: Safari 16.4+ in tabs, but **Home Screen web apps only from iOS/iPadOS 18.4** ([bug 254545](https://bugs.webkit.org/show_bug.cgi?id=254545), [Safari 18.4](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)). Chrome 84+, Firefox 126+.
- The lock is released whenever the page is hidden, so request it again on `visibilitychange` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API)).
- Hidden-video and NoSleep hacks got mixed reports in that bug thread, so skip them.
- Keep the session UI dark and mostly static to limit battery drain.

**Media Session and earphone buttons.**
- `navigator.mediaSession` (Safari 15+, Chrome 57+ on Android) routes headset and lock-screen buttons to `setActionHandler` callbacks. It only works for pages that are playing an `<audio>` or `<video>` element.
- Chrome only gives full audio focus and a media notification to media longer than **5 s** ([web.dev](https://web.dev/articles/media-session), [Chromium source](https://source.chromium.org/chromium/chromium/src/+/main:media/base/media_content_type.cc)).
- In iOS Home Screen apps, lock-screen buttons can stop responding and the next track may not start in the background ([261858](https://bugs.webkit.org/show_bug.cgi?id=261858)). Resuming after about 5 s paused can fail ([243258](https://bugs.webkit.org/show_bug.cgi?id=243258)).
- Use it, but keep large on-screen buttons as the primary controls.

**Background behaviour.**
- An iOS Safari tab keeps playing `<audio>` in the background (per the 261858 report).
- In iOS Home Screen apps, three open bugs affect background audio:
  - Web Audio can come back silent after backgrounding ([291892](https://bugs.webkit.org/show_bug.cgi?id=291892), iOS 18–26.0; reportedly fixed in a 26.2 beta).
  - On iOS 26, an `<audio>` element can freeze after 5–9 s in the background without firing any event ([323022](https://bugs.webkit.org/show_bug.cgi?id=323022)). The reporter avoided it with `navigator.audioSession.type = 'playback'`.
  - The next track may not start after the current one ends (261858, above).
- On Android, a page playing audible sound escapes Chrome's heavy timer throttling.
- So: when the page becomes visible again, rebuild state from the wall clock, drop stale cues, and say one catch-up line ("You're in your rest, 20 seconds left").

**Mixing with the user's music.**
- **iOS.** WebKit maps `navigator.audioSession.type` (Safari 16.4+) onto iOS audio-session categories ([DOMAudioSession.cpp](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/Modules/audiosession/DOMAudioSession.cpp), [Apple: playback](https://developer.apple.com/documentation/avfaudio/avaudiosession/category-swift.struct/playback), [Apple: ambient](https://developer.apple.com/documentation/avfaudio/avaudiosession/category-swift.struct/ambient)):
  - `playback`: plays with the Silent switch on and the screen locked, but interrupts other audio, so music pauses.
  - `ambient` and `transient`: mix with other audio, but are silenced by the Silent switch and by locking the screen.
  - Neither option ducks the music.
- **Android.** Chrome asks for transient "may duck" focus for clips of 5 s or less, so music dips briefly. Longer clips take full focus and the music app pauses ([AudioFocusDelegate.java](https://source.chromium.org/chromium/chromium/src/+/main:content/public/android/java/src/org/chromium/content/browser/AudioFocusDelegate.java)).
- **Product decision:** default to "Coach" mode (`playback`), with an opt-in "Over my music" mode (`ambient` on iOS, clips under 5 s on Android).

**Timers.**
- Chrome checks a hidden page's timers once per second. After 5 minutes hidden, with chained timers and 30 s of silence, it checks them once per minute. "A silent audio track doesn't count" as sound ([Chrome 88](https://developer.chrome.com/blog/timer-throttling-in-chrome-88)).
- `performance.now()` may not tick during device sleep on some platforms ([hr-time #115](https://github.com/w3c/hr-time/issues/115)).
- Store `startedAt` and `endsAt` as epoch milliseconds, and compute remaining time as `endsAt − Date.now()` on every UI tick.

**The silent-audio-loop trick.** It keeps a media session alive, but has four costs:
- True silence doesn't exempt the page from Chrome's throttling.
- It holds iOS's non-mixable session and Android's full audio focus, so the user's music stops.
- It drains the battery.
- It doesn't fix next-clip starts in iOS Home Screen apps.

Offer it at most as an opt-in experiment.

## 4. Neural TTS in the browser

**kokoro-js** ([npm](https://www.npmjs.com/package/kokoro-js), Apache-2.0):
- **Model.** The Kokoro-82M weights are Apache-2.0. The model card says it was "trained exclusively on permissive/non-copyrighted audio data". That includes synthetic audio from closed commercial TTS providers, and v1.0 adds CC BY sets ([model card](https://huggingface.co/hexgrad/Kokoro-82M)). The project's own grades: `af_heart` A, `af_bella` A−, `bf_emma` B−. The male voices are C+ or lower ([README](https://github.com/hexgrad/kokoro/tree/main/kokoro.js)).
- **Download.** ONNX sizes are fp32 326 MB, fp16 163 MB, q8 92 MB, q8f16 86 MB and q4 **305 MB** ([files](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/tree/main/onnx)). q4 is not the small option. Each voice adds about 0.5 MB.
- **Licence chain.** The `phonemizer` dependency declares Apache-2.0, but its 1.3 MB bundle is an Emscripten build of eSpeak NG (I checked the tarball). eSpeak NG is [GPL-3.0-or-later](https://github.com/espeak-ng/espeak-ng).
- **Speed.**
  - Measured natively (CPU): fp32 ran 6.8× faster than real time and q8 ran 3.1×.
  - In a browser, multithreaded WASM needs COOP/COEP headers. GitHub Pages can't set them, so you'd need the [coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker) workaround.
  - On a Samsung S24, WASM q8 sound was "perfect (but performance is bad)" ([transformers.js #1320](https://github.com/huggingface/transformers.js/issues/1320)).
  - Android WebGPU produced corrupted audio ([kokoro #193](https://github.com/hexgrad/kokoro/issues/193), open).
  - The maintainer recommends WebGPU with fp32, which means a 326 MB download.
  - WebGPU is available in iOS Safari 26 and in Chrome 121+ on Android 12+ ([caniuse](https://caniuse.com/webgpu)).
  - I didn't measure on a phone.

**Piper:**
- **Licence.** rhasspy/piper (MIT) is archived. Its successor [piper1-gpl](https://github.com/OHF-Voice/piper1-gpl) is GPL-3.0 and "embeds espeak-ng".
- **Web ports.** `@mintplex-labs/piper-tts-web` and `@diffusionstudio/vits-web` are MIT. They load an espeak-based phonemizer WASM of 18.8 MB unpacked, from jsDelivr by default, so you'd have to self-host it for offline use.
- **Size.** Voices are about 63 MB (medium) or 114 MB (high), at 22.05 kHz ([piper-voices](https://huggingface.co/rhasspy/piper-voices)).
- **Voice licences** differ per voice:
  - lessac's dataset is [research-only](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html).
  - hfc_female and ryan are CC BY-NC-SA 4.0.
  - Many voices are fine-tuned from lessac.
  - ljspeech and cori were trained from scratch on public-domain audio, so they are the cleanest picks.
- **sherpa-onnx** (Apache-2.0) has [WASM TTS builds](https://k2-fsa.github.io/sherpa/onnx/tts/wasm/index.html).

**Others:**
- [KittenTTS](https://huggingface.co/KittenML/kitten-tts-nano-0.8-int8) (Apache-2.0) is a 24 MB int8 model. Its Python package also uses eSpeak.
- [Pocket TTS](https://github.com/kyutai-labs/pocket-tts) has MIT code and gated CC-BY-4.0 weights of about 220 MB. Its README claims about 6× real time on an M4 CPU. It could be a build-time option.
- [Supertonic](https://huggingface.co/Supertone/supertonic-2) has OpenRAIL weights, about 263 MB of ONNX, and its repo is archived.

**Verdict.** The script is known in advance, so render it once rather than on every phone.

## 5. Build-time pre-generated audio

**Pipeline.**
1. A script turns `src/data/program.ts`, `exercises.ts` and the coaching script into `{id, text, variant, priority}` lines.
2. Render the lines with Python [`kokoro`](https://github.com/hexgrad/kokoro) 0.9.4 or with `kokoro-js` in Node. Use `af_heart` at speed 0.85, sentence by sentence, with silences inserted between sentences. Fix pronunciations inline with [misaki](https://github.com/hexgrad/misaki) syntax (`[word](/IPA/)`). eSpeak is only a fallback for unknown words, and it never ships.
3. Encode with `ffmpeg -ac 1 -c:a libopus -b:a 32k -application voip x.ogg` and `ffmpeg -ac 1 -c:a aac -b:a 48k x.m4a`.
4. Name files by a hash of text + voice + speed + model, and write a `manifest.json` with each clip's duration. Only changed lines get regenerated.
5. Commit the output to `public/voice/<voice>/`. GitHub Pages allows a 1 GB site and has a 100 GB/month soft bandwidth limit ([limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)), which is roughly 2–3k full-pack downloads a month.

At the measured fp32 speed, 2 hours of audio takes about 18 minutes on an M3 Pro.

**Format and size** (measured from a 14.2 s Kokoro sample, mono, scaled to 2 hours):

| Codec | Bitrate | 2 h | Support |
|---|---|---|---|
| Ogg Opus | 24 kbps | 21 MB | Safari 18.4+ (iOS and macOS), Chrome, Firefox ([caniuse](https://caniuse.com/opus)) |
| **Ogg Opus** | **32 kbps** | **28 MB** | Same |
| **AAC-LC (.m4a)** | **48 kbps** | **45 MB** | Everywhere; Firefox is "partial" ([caniuse](https://caniuse.com/aac)) |
| MP3 | 48 / 64 kbps | 44 / 58 MB | Everywhere |

Pick the format with `canPlayType('audio/ogg; codecs=opus')`. Each device then downloads only one pack.

**Caching.**
- Prefetch the clips for today's workout (a few MB) into Cache Storage, and offer a "download all" button.
- Don't let `<audio>` stream clips through the service worker. Media elements send Range requests, and `cache.put()` rejects 206 responses ([SW spec](https://w3c.github.io/ServiceWorker/#cache-put)). The current `public/sw.js` caches anything with `response.ok`, which includes 206.
- Instead, take the cached `Response`, call `.blob()`, and play it through `URL.createObjectURL()`. Alternatively use [workbox-range-requests](https://developer.chrome.com/docs/workbox/serving-cached-audio-and-video).
- Storage limits: WebKit allows an origin up to 60% of disk, and Home Screen apps get the same quota as Safari. Eviction is least-recently-used. `navigator.storage.persist()` is granted heuristically ([WebKit](https://webkit.org/blog/14403/updates-to-storage-policy/)). Request persistence when the user downloads a pack, and handle `QuotaExceededError`.

**Dynamic phrases.**
- Most variable phrases come from a finite set:
  - Sets: 1–6 of 2–6.
  - Reps: 1–30.
  - Durations: 5–300 s, in 5 s steps.
  - Exercise names: 45 exercises.
- Render each as a complete phrase ("Set two of four."), which gives the most natural intonation. Each is about 6–8 KB, so 1,000 phrases come to roughly 7 MB.
- For user weights, prefer wording without numbers ("same weight as last time") and show the number on screen.
- If you must compose phrases, render the words inside a carrier sentence and trim them out, so they keep phrase-final intonation. Join them with 20–40 ms crossfades.
- Render a long and a short variant of each explanation, so the scheduler can fit one into the gap available.

**Gapless, timer-synced playback with Web Audio.**
- Decode clips to `AudioBuffer`s and call `source.start(when)` for sample-accurate joins.
- Map wall-clock deadlines to audio time with `getOutputTimestamp()`. Compensate Bluetooth delay with `outputLatency` (Safari 18.4+, Chrome 102+).
- For countdowns, align the clip's end to the deadline, so "3, 2, 1, switch" lands "switch" on zero.

```ts
function ctxTimeFor(ctx: AudioContext, epochMs: number): number {
  const { contextTime = ctx.currentTime, performanceTime = performance.now() } = ctx.getOutputTimestamp();
  const targetPerf = performance.now() + (epochMs - Date.now());
  return contextTime + (targetPerf - performanceTime) / 1000 - (ctx.outputLatency || 0);
}
// end-aligned countdown: src.start(Math.max(ctx.currentTime, ctxTimeFor(ctx, deadline) - buf.duration));
```

iOS Home Screen apps have open Web Audio silence bugs (291892, 325274) and Web Audio gets no Media Session. So keep the `<audio>` element as the default backend. For runtime composition, render the composition with `OfflineAudioContext` into a WAV `Blob`, and play that through the same element.

## 6. Cloud TTS

| Service | Per 1M characters | Free tier | Our ~0.1M-character catalogue* |
|---|---|---|---|
| Polly Neural / Generative ([pricing](https://aws.amazon.com/polly/pricing/)) | $16 / $30 | 1M / 100k per month for 12 months; credits instead for accounts opened after 15 Jul 2025 | ~$1.6 / ~$3 |
| Google Neural2 / Chirp 3 HD ([pricing](https://cloud.google.com/text-to-speech/pricing)) | $16 / $30 | 1M per month | ~$0 |
| Azure Neural / Neural HD ([retail API](https://prices.azure.com/api/retail/prices), East US) | $15 / $22 | 0.5M per month (F0) | ~$0–2 |
| ElevenLabs Flash / Multilingual ([pricing](https://elevenlabs.io/pricing/api)) | $40 / $80 | 20k / 10k, no commercial licence | ~$4–8, plus a $6 Starter plan |

\*Estimate: 2 h × 14–17 characters per second (measured) × about 70% speaking time.

**What a static site would need, and why each option fails.**
- **Cognito guest access.** "Anyone who knows your identity pool ID can request unauthenticated credentials", and the ID "isn't confidential" ([AWS](https://docs.aws.amazon.com/cognito/latest/developerguide/identity-pools-security-best-practices.html)). Polly is on the guest allow-list ([IAM roles](https://docs.aws.amazon.com/cognito/latest/developerguide/iam-roles.html)). Polly also has **no IAM condition keys** ([AWS service reference](https://servicereference.us-east-1.amazonaws.com/v1/polly/polly.json)), so you can't limit the text, voice or engine.
- **Presigned URLs** ([`@aws-sdk/polly-request-presigner`](https://www.npmjs.com/package/@aws-sdk/polly-request-presigner)). Each URL fixes its text, so something holding credentials has to sign every request. A URL lasts at most 7 days, or less if signed with temporary credentials ([S3 docs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html)).
- **A proxy** (Lambda or Workers) is a backend. It needs rate limits, an allowlist of known texts, caching and budgets, and it still fails offline.
- **ElevenLabs** single-use tokens last 15 minutes and still need a server to mint them ([docs](https://elevenlabs.io/docs/api-reference/single-use/create)). Google says "Don't include API keys in client code" ([docs](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices)).

**Abuse ceiling.**
- Polly's default neural quota is 8 requests per second × 3,000 billed characters ([quotas](https://docs.aws.amazon.com/polly/latest/dg/limits.html)). That is about 2.1 billion characters a day, or roughly **$33k/day**.
- AWS Budgets updates up to three times a day, 8–12 h apart ([docs](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html)), so a budget alert can't stop this in time.
- Even legitimate uncached use costs about $1 per session.

**Build-time use is fine.**
- Polly allows "storing and reusing generated speech" ([FAQ](https://aws.amazon.com/polly/faqs/)). Google's and Azure's reuse terms are **Unverified**.
- Keys stay in your shell or in CI secrets, never in the app bundle.

## 7. Phased path
- **Phase 0 (days):**
  - A timeline model and a wall-clock `SessionClock`.
  - `SpeechNarrator` (code in §9).
  - Wake Lock and on-screen captions.
  - Result: narration works everywhere with nothing to download.
- **Phase 1 (core):**
  - The Kokoro clip catalogue in Opus with AAC fallback, plus the manifest.
  - Per-workout prefetch.
  - `ClipNarrator` playing through one `<audio>` element.
  - Speech becomes a session-level fallback and is never mixed with clips on iOS.
- **Phase 2:**
  - Media Session handlers.
  - The "Over my music" mode.
  - Short and long variants, and fitting them into gaps.
  - Catch-up lines after the page returns from the background.
  - Testing on real devices.
- **Phase 3 (optional):**
  - Web Audio composition (tempo counts, numbers).
  - Re-test on-device neural TTS once WebGPU with fp16 proves reliable on mid-range phones.

## 8. Architecture sketch

```
Timeline (pure data: segments → cues with priority, anchor time, alignment)
   │
SessionClock ── epoch-ms anchors; pause/resume; recompute on visibilitychange
   │  ticks the UI at 4 Hz, emits time
CueScheduler ── 10 s look-ahead; fits cues into gaps; preempts by priority
   │
Narrator ──► ClipNarrator (<audio> + cached Blob URLs)   if pack cached & codec playable
         ──► SpeechNarrator (speechSynthesis)            else if a voice ranks ≥ 0
         ──► CaptionNarrator (text + vibration/visual)   else
SessionControls ── Wake Lock · Media Session · navigator.audioSession.type
```

```ts
export type Priority = 0 | 1 | 2 | 3; // safety · timed cue · instruction · encouragement
export interface Cue {
  id: string;              // catalogue key, e.g. "goblet-squat.how.short"
  text: string;            // captions and speech fallback
  priority: Priority;
  at?: number;             // epoch ms anchor
  align?: 'start' | 'end'; // 'end': finish exactly at `at` (countdowns)
  staleAfterMs?: number;   // drop if it can't start in time
}
export interface Narrator {
  readonly kind: 'clips' | 'speech' | 'captions';
  prepare(ids: string[]): Promise<void>;
  durationMs(id: string): number | undefined; // exact for clips, estimated for speech
  play(cue: Cue, signal: AbortSignal): Promise<'ended' | 'aborted' | 'failed'>;
  stop(): void;
}
```

**Scheduler rules.**
- **One voice channel.**
- **P0** (safety) preempts everything.
- **P1** (countdowns, "switch sides", "rest", "go") preempts P2/P3 with a 150 ms fade. It is dropped once stale, except for state lines.
- **P2** (what, how, why, breathing) starts only if its duration + 0.5 s fits before the next P1 cue. Otherwise use the short variant, or skip it.
- **P3** (encouragement) fills leftover gaps.
- **Start times.** Start `<audio>` clips early by the measured `play()`→`playing` delay (a moving average).
- **Health checks.**
  - If `play()` rejects with `NotAllowedError`, show "Tap to resume audio".
  - If `currentTime` hasn't advanced after 1.5 s, recreate the element or drop to the next narrator.

**Start tap.** Do all of this synchronously, before any `await`:
1. Set `navigator.audioSession.type = 'playback'`.
2. `audio.play()` the first clip.
3. Call `navigator.wakeLock.request('screen')`.
4. If the session uses speech, call `speechNarrator.unlock(firstLine)`.

**Earphone and lock-screen buttons.**
- play/pause pauses or resumes the `SessionClock`.
- nexttrack skips to the next segment.
- previoustrack repeats the last instruction.
- Set `playbackState` and `metadata` to the current segment.

**Wake lock.** Request it again on `visibilitychange`. If it isn't available (iOS Home Screen apps before 18.4), suggest setting Auto-Lock to Never or running the workout in a Safari tab.

## 9. Code: voice selection and chunked speaking

This compiles under the repo's `erasableSyntaxOnly` TypeScript settings.

```ts
// src/voice/speech.ts
const NOVELTY = new Set(['Albert', 'Bad News', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos', 'Good News',
  'Jester', 'Organ', 'Superstar', 'Trinoids', 'Whisper', 'Wobble', 'Zarvox']);
const VERY_LOW = new Set(['Eddy', 'Flo', 'Grandma', 'Grandpa', 'Jacques', 'Reed', 'Rocko', 'Sandy', 'Shelley',
  'Fred', 'Junior', 'Kathy', 'Ralph']); // Eloquence + legacy (Readium filters)
const APPLE_OK = new Set(['Samantha', 'Daniel', 'Karen', 'Moira', 'Tessa', 'Rishi', 'Ava', 'Zoe', 'Serena', 'Jamie']);
const norm = (l: string) => l.replace(/_/g, '-').toLowerCase();
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function loadVoices(timeoutMs = 3000): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  if (synth.getVoices().length) return Promise.resolve(synth.getVoices());
  return new Promise((resolve) => {
    const finish = () => {
      clearInterval(poll); clearTimeout(timer);
      synth.removeEventListener('voiceschanged', check);
      resolve(synth.getVoices());
    };
    const check = () => { if (synth.getVoices().length) finish(); };
    const poll = setInterval(check, 250); // Safari < 16 has no voiceschanged
    const timer = setTimeout(finish, timeoutMs);
    synth.addEventListener('voiceschanged', check);
  });
}

export function rankVoices(voices: SpeechSynthesisVoice[], lang = 'en-US', online = navigator.onLine) {
  const want = norm(lang), family = want.split('-')[0];
  const score = (v: SpeechSynthesisVoice): number => {
    const vl = norm(v.lang), first = v.name.split(' (')[0].trim();
    if (!vl.startsWith(family) || NOVELTY.has(first) || VERY_LOW.has(first) || /espeak/i.test(v.name)) return -1;
    if (!v.localService && !online) return -1;   // network voices fail offline
    let s = vl === want ? 20 : 10;
    if (/\bNatural\b/i.test(v.name)) s += 60;     // Edge / Android "(Natural)"
    else if (/\bPremium\b/i.test(v.name)) s += 50;
    else if (/\bEnhanced\b/i.test(v.name)) s += 40;
    else if (/^Google\b/.test(v.name)) s += 30;   // Chrome desktop (network)
    else if (APPLE_OK.has(first)) s += 15;
    return s;
  };
  return voices.map((v) => ({ v, s: score(v) })).filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s).map((x) => x.v);
}

export function pickVoice(voices: SpeechSynthesisVoice[], saved?: { uri: string; name: string }) {
  const ranked = rankVoices(voices);
  return ranked.find((v) => v.voiceURI === saved?.uri || v.name === saved?.name) ?? ranked[0] ?? null;
}

/** Sentence chunks of at most `max` chars: keeps Chrome's Google voices under their ~14 s cut-off. */
export function chunkText(text: string, max = 140): string[] {
  const sentences = typeof Intl.Segmenter === 'function'
    ? Array.from(new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text), (s) => s.segment)
    : (text.match(/[^.!?]+[.!?]*\s*/g) ?? [text]);
  const out: string[] = [];
  for (let s of sentences.map((x) => x.trim()).filter(Boolean)) {
    while (s.length > max) {
      const punct = Math.max(s.lastIndexOf(', ', max), s.lastIndexOf('; ', max));
      let at = punct > max * 0.4 ? punct + 1 : s.lastIndexOf(' ', max);
      if (at <= 0) at = max;
      out.push(s.slice(0, at).trim());
      s = s.slice(at).trim();
    }
    if (s) out.push(s);
  }
  return out;
}

export class SpeechNarrator {
  voice: SpeechSynthesisVoice | null = null;
  rate = 0.92;
  private readonly synth = window.speechSynthesis;
  private readonly live = new Set<SpeechSynthesisUtterance>(); // strong refs: Chrome may GC and drop onend
  private generation = 0;

  /** Call synchronously in the Start tap handler: iOS ignores speak() until one runs inside a gesture. */
  unlock(firstLine: string): Promise<void> { return this.utter(firstLine, this.generation); }

  /** Speaks sentence by sentence with explicit gaps (no SSML). Resolves false if cancelled. */
  async say(text: string, gapMs = 350): Promise<boolean> {
    const gen = this.generation;
    for (const chunk of chunkText(text)) {
      if (gen !== this.generation) return false;
      await this.utter(chunk, gen);
      await sleep(gapMs);
    }
    return gen === this.generation;
  }

  /** Android's pause() is cancel(), so pausing = cancel + re-say the current line later. */
  cancel(): void { this.generation++; this.synth.cancel(); }

  private utter(text: string, gen: number): Promise<void> {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      if (this.voice) { u.voice = this.voice; u.lang = this.voice.lang; }
      u.rate = this.rate;
      u.pitch = 1;
      let timer = 0;
      const done = () => { clearTimeout(timer); this.live.delete(u); resolve(); };
      u.onend = done;
      u.onerror = done; // canceled / interrupted / not-allowed
      // Watchdog: events get lost (GC, document suspension, utterances queued right after cancel()).
      timer = window.setTimeout(() => {
        if (gen === this.generation && this.synth.speaking) this.synth.cancel();
        done();
      }, (text.length / 12 / this.rate) * 1500 + 2500);
      this.live.add(u);
      this.synth.speak(u);
    });
  }
}
```

## 10. Verify on real devices before shipping

**iPhone, in a Safari tab and as a Home Screen app.** Test on iOS 18.4, 26.x and 27:
- A full 60-minute session with Wake Lock on.
- Playback after locking and unlocking the phone.
- The Silent switch with each `audioSession.type`.
- AirPods play/pause.
- Whether paused music resumes afterwards.

**Mid-range Android, Chrome stable:**
- Music ducking with clips of 5 s or less versus longer clips.
- Bluetooth latency.
- Speech behaviour with the screen off.

**Desktop Edge and Chrome:**
- Voice ranking picks the Natural or Google voices.
- Chunking avoids the 14 s cut-off.
