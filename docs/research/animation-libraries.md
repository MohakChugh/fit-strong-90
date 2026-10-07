# Research: 3D exercise animation libraries, assets and motion data

**Scope.** This doc covers rendering, rigging and authoring 3D form demos for about 95 exercises in an offline React 19 + Vite PWA on GitHub Pages. Biomechanics (angles, tempo, mistakes) is in the sibling technique docs, such as [technique-lower-body-core.md](./technique-lower-body-core.md). Researched 2026-10-05.

**Sources.**
- Versions come from npm.
- Licences come from LICENSE files and official pages.
- APIs come from the three.js r186 source.
- "Measured" sizes are my own downloads (gzip -9).
- Anything not checked is marked **Unverified**.

## Recommendation

Use **vanilla three.js r186 (MIT)** with **one CC0 skinned human exported from MakeHuman/MPFB2**. Do not use mannequin.js or React Three Fiber (R3F).

The approach:
- **Keyframes.** Each exercise is a small JSON list of bone-rotation keyframes, built into a three.js `AnimationClip` at load time.
- **Contacts.** A 25-line two-bone IK pass keeps planted feet and hands fixed.
- **Mistakes.** Each mistake is an additive clip with a weight from 0 to 1.
- **Muscles.** A per-vertex muscle-ID attribute plus a small shader patch.
- **Equipment.** Built from primitives, so it needs no asset files.
- **Loading.** The viewer is lazy-loaded. Today's SVG rig stays as the fallback when WebGL is missing or reduced motion is on.

**Why not mannequin.js:**
- It is GPL-3.0.
- Importing it creates a full-screen WebGL canvas.
- It has no shoulder girdle, and its rigid torso cannot show a rounded lower back.
- It recolours whole segments only.

**Why not R3F:** it adds about 76 KB gzip (measured, unminified) just to manage one canvas.

**Estimated offline payload: about 0.5–0.7 MB gzip.**
- three.js: about 0.23 MB, measured.
- Character: 0.2–0.4 MB, estimated.
- Motion data: under 0.1 MB, estimated.

## 1. Comparison

| Option | Fidelity | Control | Licence | Bundle + assets | Mobile perf | Authoring | Incorrect form |
|---|---|---|---|---|---|---|---|
| **three.js + MPFB2 human (recommended)** | Realistic; clavicles; 3 or 5 spine bones | Full: quaternions, additive layers, IK | MIT + CC0 exports | three ~194 KB gz (measured) + GLB 0.2–0.4 MB (est.) | 1 skinned mesh; good (est.) | Medium (~10 keyframes per exercise) | Yes: spinal flexion, knee valgus, shrugs |
| three.js + Quaternius Universal Base Characters | Stylised-realistic, ~13k triangles | Same | CC0 | Same (model size unverified) | Good (est.) | Lower setup | Likely; spine bones unverified |
| mannequin.js 5.2.3 | Wooden mannequin | Euler degrees, `blend()`, no IK | **GPL-3.0** code | ~30 KB gz + three | ~100 meshes per figure (my count) | Low (posture editor) | Partial |
| three-vrm + VRoid | Anime | Humanoid bones | MIT + per-model licence | three + three-vrm + VRM | Good | Medium | Style undermines credibility |
| Mixamo clips | Mocap | Fixed clips | Royalty-free (Adobe FAQ) | Example rigs 2–3 MB raw | Good | Low, ~40 fitness clips | None; no props |
| Babylon.js 9.29 | As recommended | Full; built-in 2-bone IK | Apache-2.0 | Full UMD 1.85 MB gz (measured) | Heavier JS | Medium | Yes |
| Lottie | Artist-dependent, fixed view | Playback | Lottie Simple License | 46–76 KB gz JS or ~496 KB gz WASM | Good | Very high | Only if drawn |
| Rive | 2D bones, state machines | High in one view | MIT runtime; free exports show a splash screen | WASM 367–819 KB gz | Good | Very high | Hand-authored |
| Better SVG (today) | Low–medium | One plane | Own | ~0 | Excellent | Medium | 2D only |

## 2. Findings

### 2.1 mannequin.js

**Licence.**
- The [repo](https://github.com/boytchev/mannequin.js) and npm `mannequin-js` are both GPL-3.0.
- GPL-3.0 §5(c) says "You must license the entire work, as a whole, under this License". Bundling mannequin.js therefore means releasing the whole app under GPL-3.0. The app has no LICENSE file yet.
- A separate [figure licence](https://github.com/boytchev/mannequin.js/blob/main/docs/licence.md) frees the generated figures, so pre-rendered images are unrestricted.

**Maintenance.**
- Latest npm release: 5.2.3, on 2024-10-06.
- Last push: 2025-10-05, a community example.
- three.js was last updated to r170 on 2024-11-17.
- Shoulder movement is an open request ([#30](https://github.com/boytchev/mannequin.js/issues/30)).

**Vite.**
- Import `mannequin-js/src/mannequin.js`. The `main` field points at a file that isn't published, and the package has no `exports` map.
- The [user guide](https://boytchev.github.io/mannequin.js/docs/userguide.html) targets CDN import maps with three@0.170.0. It says npm use "is not tested so far".
- It uses `THREE.Clock`, deprecated since r183. I did not run it on r186.

**Side effects on import** (5.2.3 `src/scene.js`):
- It adds a viewport `<meta … user-scalable=no>`, which blocks pinch-zoom, and a favicon.
- It creates a window-sized `WebGLRenderer` with a fixed full-screen canvas and starts its own render loop.
- Every figure adds itself to that internal scene.

**API** (verified in source and guide):
- **Figures:** `Male(1.8)`, `Female(1.65)`, `Child(1.15)`.
- **Parts:** `body, pelvis, torso, neck, head`, plus `l_`/`r_` versions of `leg, knee, ankle, arm, elbow, wrist, finger_0..4`.
- **Rotations (degrees):**
  - `bend`/`turn`/`tilt`: torso, wrists, ankles.
  - `nod`/`turn`/`tilt`: head.
  - `raise`/`straddle`/`turn`: limbs.
  - `bend`: elbows, knees.
- **Postures:** `posture` / `postureString` as versioned JSON. `blend(p, q, k)` interpolates Euler angles linearly.
- **Other methods:** `recolor(...)`, `attach`/`detach`, `point(x, y, z)` for world coordinates, `stepOnGround()`, `hide`/`show`.

**Limits, look and performance.**
- **Joint limits:** `minRot`/`maxRot` exist, but only the posture editor uses them; the setters don't clamp.
- **Look:** smooth parametric limbs with ball joints and no anatomy.
- **Performance:** by my count, each figure has about 100 meshes or material groups, about 70 of them finger parts, and all cast shadows. Not measured.
- **Examples:** about 30 in [docs](https://github.com/boytchev/mannequin.js/tree/main/docs), plus an online posture editor.

### 2.2 three.js with a skinned human

**three.js.**
- r186 was [released 2026-09-24](https://github.com/mrdoob/three.js/releases/tag/r186).
- WebGL 1 was removed in [r163](https://github.com/mrdoob/three.js/releases/tag/r163). WebGL 2 is supported on iOS Safari 15+ and for about 96% of users ([caniuse](https://github.com/Fyrd/caniuse/blob/main/features-json/webgl2.json)).
- Measured sizes (minified, gzip):
  - Core + WebGL module: 194 KB (159 KB with brotli). The WebGPU build is about 309 KB.
  - GLTFLoader + OrbitControls: about 34 KB, unminified.
  - Meshopt decoder: 7.7 KB.

**MakeHuman / MPFB2.**
- **Licence:** core assets are CC0, and "The exported models end up being licensed CC0" ([FAQ](https://static.makehumancommunity.org/makehuman/faq/can_i_sell_models_created_with_makehuman.html)). The code is AGPL/GPL ([licence](https://static.makehumancommunity.org/about/license.html)). Third-party CC-BY assets bring their own obligations ([FAQ](https://static.makehumancommunity.org/mpfb/faq/use_in_closed_source.html)).
- **Version:** [MPFB2](https://github.com/makehumancommunity/mpfb2) v2.0.17 (2026-07-22) needs Blender 4.2 or later.
- **Rigs** ([files](https://github.com/makehumancommunity/mpfb2/tree/master/src/mpfb/data/rigs/standard)):
  - `game_engine`: 53 bones, including `pelvis`, `spine_01..03`, `clavicle_l/r` and `thigh/calf/foot/ball`.
  - `default`: 163 bones, including `spine01..05` and `shoulder01`.
  - A rig with Mixamo bone names.
- **Mesh:** the body is 13,378 quads (~26.8k triangles); decimate it to about 15k.
- **Why the spine bones matter:** the technique docs want a rounded back to look "visibly convex", which needs at least 3 spine bones.

**Quaternius (CC0).**
- [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) (August 2025): 6 bodies averaging 13k triangles, a "Humanoid rig", glTF format.
- The free tier is "60-70%" of the pack. Which bodies it includes and the bone names are unverified.
- The [animation library](https://quaternius.com/packs/universalanimationlibrary.html) and [UAL 2](https://quaternius.com/packs/universalanimationlibrary2.html) pages (January 2026) list no gym clips.

**Other sources.**
- **Anny:** NAVER's [Anny](https://github.com/naver/anny) (Apache-2.0, CC0 data) is a PyTorch body model, not a web asset.
- **Mixamo:**
  - **Source:** the [archived FAQ](http://web.archive.org/web/20260924203626/https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html); the live page blocked my fetch.
  - **Access:** an Adobe ID is required.
  - **Terms:** characters and animations are "royalty free for personal, commercial, and non-profit projects including… Create video games."
  - **Raw-file redistribution:** **Unverified**.
- **Ready Player Me:** "Ready Player Me services were discontinued on Jan 31, 2026" ([archived homepage](http://web.archive.org/web/20260131143241/https://readyplayer.me/)). The domain no longer resolves.
- **VRM / VRoid:**
  - [three-vrm](https://github.com/pixiv/three-vrm) 3.5.5 is MIT.
  - VRM licence metadata defaults to the most restrictive values ([spec](https://github.com/vrm-c/vrm-specification/blob/master/specification/VRMC_vrm-1.0/meta.md)).
  - VRoid base models are "not CC0" but allowed in commercial apps ([guidelines](https://vroid.com/en/studio/guidelines)). The anime style suits avatars, not anatomy.

**Sizes.**
- **Unoptimised examples:** the Mixamo-credited Xbot.glb is 2.93 MB and Soldier.glb is 2.16 MB ([folder](https://github.com/mrdoob/three.js/tree/r186/examples/models/gltf)).
- **Compression:** GitHub Pages gzips `.glb` files; Xbot measured 1.15 MB on the wire.
- **Optimising:** use [glTF-Transform](https://github.com/donmccurdy/glTF-Transform) (MIT): `gltf-transform optimize in.glb out.glb --texture-compress webp`.

**IK.**
- The built-in [`CCDIKSolver`](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/animation/CCDIKSolver.js) needs its target to be a bone in the skeleton, so you would have to add extra bones. It does support `rotationMin`/`rotationMax`.
- An analytic two-bone solver (§4) is simpler and deterministic.
- Gotcha: three.js strips `[ ] . : /` from node names, so `clavicle.L` becomes `clavicleL`.

**Muscle highlighting**, best first:
1. **Per-vertex muscle ID.** Paint a `_MUSCLE` attribute in Blender.
   - Blender exports attributes "when the name starts with underscore" ([docs](https://github.com/KhronosGroup/glTF-Blender-IO/blob/main/docs/blender_docs/scene_gltf2.rst)).
   - GLTFLoader lower-cases it to `_muscle`.
   - It costs 1 byte per vertex and no extra draw calls.
2. **Bone-weight tint.** Free, but bones aren't muscles: it can't separate quads from hamstrings.
3. **Overlay meshes.** [Z-Anatomy](https://github.com/LluisV/Z-Anatomy) (CC BY-SA 4.0) and [BodyParts3D](https://github.com/Kevin-Mattheus-Moerman/BodyParts3D) (CC BY-SA 2.1 JP) need attribution and share-alike, and add geometry. Use them as painting references instead.

### 2.3 Motion data

| Source | Licence | Gym fit |
|---|---|---|
| [CMU MoCap](http://mocap.cs.cmu.edu/) | "free for all uses"; can ship "in commercially-sold products, but you may not resell this data directly" | Bodyweight only (squats, lunges, jacks, stretches) |
| [AMASS](https://amass.is.tue.mpg.de/license.html) | Non-commercial; bans "incorporation in a commercial product" | — |
| [HumanML3D](https://github.com/EricGuo5513/HumanML3D) | MIT code; data rebuilt from AMASS | 14,616 general clips (28.59 h) |
| [MDM](https://github.com/GuyTevet/motion-diffusion-model) (MIT), [MoMask](https://github.com/EricGuo5513/momask-codes) (MIT), [T2M-GPT](https://github.com/Mael-zys/T2M-GPT) (Apache-2.0) | Code only; datasets and SMPL "have their own respective licenses"; [SMPL](https://smpl.is.tue.mpg.de/modellicense.html) bars commercial use | Python/GPU; no equipment or contacts; needs retargeting |
| Mixamo catalogue | §2.2 | ~40 fitness clips (squats, push up, plank, situps, burpee, jumping jacks, bicep curl, front raises, kettlebell swing…). No deadlift, bench press, rows or machines; no props |

**Verdict.** Hand-author keyframes and use Mixamo only as a reference. Text-to-motion doesn't fit:
- Its training data is non-commercial.
- It has no notion of contacts.
- It can't run offline on a phone.

### 2.4 2D alternatives, muscle maps and Babylon.js

**Lottie.**
- **Licence:** the [Lottie Simple License](https://lottiefiles.com/page/license) allows commercial use without attribution, but not compiling files into a "competing service".
- **Coverage:** thin. There are "9 Free squat Animations" from 5–6 creators ([search](https://lottiefiles.com/free-animations/squat)).
- **Runtimes (measured):** lottie-web is 46–76 KB gzip; dotLottie's WASM is about 496 KB.

**Rive.**
- **Licence:** the runtime is MIT ([rive-wasm](https://github.com/rive-app/rive-wasm)).
- **Cost:** "Free exports play a Rive splash screen". The Cadet plan, listed at $9 per seat per month, removes it ([pricing](https://rive.app/pricing)).
- **Size:** WASM is 367–819 KB gzip.
- **Limit:** one fixed 2D view.

**Muscle maps.**
- [react-body-highlighter](https://github.com/giavinh79/react-body-highlighter) (MIT): last npm release 2.0.5 on 2022-05-14, with unreleased repo work from September 2026. It has 19 regions, with front and back deltoids only.
- [react-muscle-highlighter](https://github.com/soroojshehryar/react-muscle-highlighter) (MIT): version 1.2.0 (2026-01-06) supports React 18 and 19 and has 23 regions.
- Neither separates lateral delts or lats, so treat them as optional summaries. The 3D muscle IDs are the source of truth.

**Babylon.js.**
- `@babylonjs/core` 9.29.0 is Apache-2.0.
- **Built-ins:** `BoneIKController` ("currently limited to 2 bones") and `attachToBone` ([docs](https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/mesh/bonesSkeletons.md)).
- **Size:** its tree-shaking docs cite "about 700Kb versus 2.3Mb" for an example ([docs](https://github.com/BabylonJS/Documentation/blob/master/content/setup/frameworkPackages/es6Support.md)).
- **Verdict:** viable but heavier. Its main extra, two-bone IK, is 25 lines in three.js.

### 2.5 Camera-based form feedback (later)

**[MediaPipe Pose Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker)** (recommended):
- **Licence:** `@mediapipe/tasks-vision` 1.0.1 (2026-07-31) is Apache-2.0. The [model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf) also lists Apache-2.0.
- **Output:** 33 landmarks plus world coordinates ([web guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js)). Intended uses include "Fitness and repetition counting".
- **Speed:** the card gives native Pixel 3 rates of about 44 FPS on CPU and 49 FPS on GPU for the Lite model. Speed in a phone browser is **Unverified**.
- **Download:** the WASM is 11.8 MB raw (3.4 MB gzip) and the Lite model is 5.8 MB, so make it opt-in.
- **Out of scope:** users more than 4 m from the camera, or with the head out of frame.

**TF.js MoveNet:** 17 keypoints. `pose-detection` was last released in 2023 and tfjs in 2024, a maintenance risk.

## 3. Architecture sketch

### Motion data
There is one lazy JSON file per exercise, about 1–3 KB each (estimated). It uses the technique docs' C-H-E-P phases and mistake angles directly.

```ts
type Deg3 = [number, number, number];        // bone-local XYZ degrees, offset from rest pose
interface Keyframe { t: number; bones: Record<string, Deg3>; root?: Deg3;  // pelvis travel (m)
  phase?: 'concentric' | 'hold' | 'eccentric' | 'pause'; breath?: 'in' | 'out'; cue?: string }
interface ExerciseMotion {
  id: string; plane: 'sagittal' | 'frontal' | 'transverse'; camera: CameraPreset;
  equipment: { kind: EquipmentKind; attach?: string }[];
  contacts: { effector: string; target: 'planted' | `prop:${string}`; from?: number; to?: number }[];
  muscles: { worked: MuscleId[]; stretched?: MuscleId[] };
  keyframes: Keyframe[];                     // omitted bones hold their previous value
  mistakes?: { id: string; label: string; camera?: CameraPreset; keyframes: Keyframe[]; faultBones: string[] }[];
}
```

### Each frame
Each frame runs the same pipeline: timeline → `mixer.setTime(t)` → contact IK → muscle uniforms → render.

**Timeline.**
- The phase timeline, not the wall clock, owns `t`. A hold can wait for narration to finish.
- Phase, breath and cue markers emit events for the voice module.
- `Timer.setTimescale()` gives slow motion.

**Contacts.**
- **Target:** at contact start, record the effector's world pose (`planted`), or use a prop anchor such as a bar grip or pedal.
- **Solve:** after the mixer runs, apply two-bone IK. The pole is the animated knee or elbow. Then restore the foot's world rotation.
- **Other cases:** kneeling and forearm contacts use a one-bone aim. Seated and lying poses use a root offset.

**Equipment.**
- **Geometry:** boxes and cylinders with named anchors.
- **Held props** go on a bone: `hand_r.add(dumbbell)`.
- **Moving props** get their own tracks, such as a bar path or crank angle. IK pulls hands and feet onto them: barbell, cable, pulldown bar, sled, pedals.
- **Fixed props** sit against the pelvis: bench, chair, mat, treadmill.

**Muscles.**
- Up to 32 IDs.
- Two `Float32Array`s (worked, stretched) are written per phase. For example, quads peak in the concentric phase.

**Correct vs incorrect.**
- "Show mistake" ramps the additive weight from 0 to 1 over about 0.3 s. Set it by hand, because `setTime` rewinds the clock that `fadeIn` uses.
- It also switches camera and pulses the `faultBones` red.
- **Optional:** a translucent `SkeletonUtils.clone` "ghost" shows the correct form alongside.

**Camera.**
- **Default by plane of motion:**
  - Sagittal: side or three-quarter view (azimuth 90° or 55°).
  - Frontal (lateral raises): front.
  - Transverse (rotations): front, raised 35–45°.
- **Mistakes** can override it; knee valgus reads best from the front.
- **Drag to rotate:** OrbitControls with pan and zoom off and the polar angle clamped.
  - OrbitControls sets `touch-action: none`, which blocks page scrolling over the canvas.
  - So enable it only in the expanded viewer, and add a "reset view" button.

**Budget** (targets, not measured):
- **Geometry:** ≤20k triangles and ≤10 draw calls.
- **Lighting:** a hemisphere light plus a directional light, with a blob shadow and no shadow maps.
- **Resolution:** DPR capped at 2.
- **CPU:** mixer plus IK under 1 ms.
- **Idle:** no rendering when paused, offscreen or the tab is hidden.
- **Verify:** spike on a mid-range Android and an older iPhone.

**One WebGL context.**
- **Why:** the three.js [manual](https://github.com/mrdoob/three.js/blob/r186/manual/pages/multiple-scenes.html) warns the limit "is around 8" and the oldest context is lost after that. WebKit caps active contexts at 16 ([source](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/html/canvas/WebGLRenderingContextBase.cpp)), and Chromium force-loses the oldest ([source](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/modules/webgl/webgl_rendering_context_base.cc); its default limit is unverified).
- **Singleton:** use one module-level renderer and move its canvas into whichever viewer is mounted.
- **Lists:** keep the static SVG pose.
- **Side by side:** use `setScissor` on the one canvas.

**Lazy loading and offline.**
- **Code splitting:** `React.lazy(() => import('./viewer3d/Viewer3D'))` keeps three.js out of the main bundle.
- **Asset paths:** use `import.meta.env.BASE_URL`, because the app's base is `/fit-strong-90/`.
- **Offline:** `public/sw.js` only caches files after they are fetched. Precache the 3D chunk, the GLB and the motion JSON from the Vite manifest.

**Fallbacks.**
- **Reduced motion:** with `useReducedMotion` set, don't autoplay. Show key poses with step buttons instead.
- **Pause:** always offer one. WCAG 2.2.2 requires it for auto-started motion longer than 5 s ([Understanding 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)).
- **No WebGL 2:** `new WebGLRenderer()` throws "Error creating WebGL context.". On that error or on `webglcontextlost`, render the existing SVG `ExerciseAnimation`.

**Authoring.**
- Build a dev-only pose editor from `TransformControls` and lil-gui. Both ship in `three/addons`, so this adds no dependencies.
- MediaPipe landmarks can later be mapped onto the same joint-angle schema.

## 4. API snippets (checked against three.js r186 source)

```ts
// viewer3d/stage.ts: one renderer = one WebGL context for the whole app
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let shared: THREE.WebGLRenderer | undefined;
export function attachRenderer(el: HTMLElement) {
  let r = shared;
  if (!r) {
    try { r = shared = new THREE.WebGLRenderer({ antialias: devicePixelRatio < 2 }); }
    catch { return null; }                       // no WebGL 2: caller shows the SVG rig
  }
  r.setPixelRatio(Math.min(devicePixelRatio, 2));
  el.appendChild(r.domElement);                  // moves the single canvas between viewers
  r.setSize(el.clientWidth, el.clientHeight);
  return r;
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
export const loadHuman = () => loader.loadAsync(`${import.meta.env.BASE_URL}models/human.glb`);

const PRESETS = { front: [0, 10], side: [90, 10], threeQuarter: [55, 15], high: [20, 40] } as const;
export function frame(cam: THREE.PerspectiveCamera, controls: OrbitControls,
  preset: keyof typeof PRESETS, target: THREE.Vector3, dist = 3.2) {
  const [az, el] = PRESETS[preset];              // glTF assets face +Z, so azimuth 0 = front
  cam.position.setFromSphericalCoords(dist, THREE.MathUtils.degToRad(90 - el),
    THREE.MathUtils.degToRad(az)).add(target);
  controls.target.copy(target);
  controls.enablePan = controls.enableZoom = false;
  controls.minPolarAngle = THREE.MathUtils.degToRad(45);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(100);
  controls.update();
}
```

```ts
// viewer3d/clips.ts: keyframe JSON -> AnimationClip; mistakes are additive deltas
import { AdditiveAnimationBlendMode, AnimationClip, Euler, MathUtils, NormalAnimationBlendMode,
  Quaternion, QuaternionKeyframeTrack } from 'three';
import type { Keyframe } from '@/motion/schema';

const e = new Euler(), dq = new Quaternion();
export function buildClip(name: string, keys: Keyframe[], rest: Map<string, Quaternion>, additive = false) {
  const filled: Keyframe[] = [];
  for (const k of keys) filled.push({ ...k, bones: { ...filled.at(-1)?.bones, ...k.bones } });
  const tracks = Object.keys(filled.at(-1)!.bones).map((bone) =>
    new QuaternionKeyframeTrack(`${bone}.quaternion`, filled.map((k) => k.t), filled.flatMap((k) => {
      const [x, y, z] = (k.bones[bone] ?? [0, 0, 0]).map(MathUtils.degToRad);
      dq.setFromEuler(e.set(x, y, z, 'XYZ'));
      return (additive ? dq : rest.get(bone)!.clone().multiply(dq)).toArray();
    })));
  return new AnimationClip(name, -1, tracks, additive ? AdditiveAnimationBlendMode : NormalAnimationBlendMode);
}
// rest = new Map(skinned.skeleton.bones.map((b) => [b.name, b.quaternion.clone()])) // before playback
// fault = mixer.clipAction(buildClip('knees-cave', mistake.keyframes, rest, true)).play();
// per frame: mixer.setTime(timeline.t); fault.setEffectiveWeight(timeline.mistakeWeight);
```

```ts
// viewer3d/ik.ts: analytic two-bone IK (thigh-calf-foot, upperarm-lowerarm-hand)
import { MathUtils, Quaternion, Vector3, type Object3D } from 'three';
const a = new Vector3(), b = new Vector3(), c = new Vector3(), d = new Vector3();
const n = new Vector3(), knee = new Vector3(), qd = new Quaternion(), qp = new Quaternion();

function aim(bone: Object3D, from: Vector3, to: Vector3) {     // world-space delta rotation
  qd.setFromUnitVectors(from.normalize(), to.normalize());
  bone.parent!.getWorldQuaternion(qp);
  bone.quaternion.premultiply(qp).premultiply(qd).premultiply(qp.invert()); // L' = P^-1 D P L
  bone.updateMatrixWorld(true);
}

export function twoBoneIK(upper: Object3D, lower: Object3D, end: Object3D, target: Vector3, pole: Vector3) {
  upper.getWorldPosition(a); lower.getWorldPosition(b); end.getWorldPosition(c);
  const l1 = a.distanceTo(b), l2 = b.distanceTo(c);
  const reach = MathUtils.clamp(d.subVectors(target, a).length(), 1e-4, l1 + l2 - 1e-4);
  d.normalize();
  n.subVectors(pole, a);
  n.addScaledVector(d, -n.dot(d)).normalize();   // bend plane; pole must not sit on the reach line
  const cos = MathUtils.clamp((l1 * l1 + reach * reach - l2 * l2) / (2 * l1 * reach), -1, 1);
  knee.copy(a).addScaledVector(d, l1 * cos).addScaledVector(n, l1 * Math.sqrt(1 - cos * cos));
  aim(upper, b.sub(a), knee.sub(a));             // 1) upper bone -> solved knee/elbow
  lower.getWorldPosition(b); end.getWorldPosition(c);
  aim(lower, c.sub(b), d.subVectors(target, b)); // 2) lower bone -> target
}
```

This solver only swings bones; it does not control twist. Use it to correct small drift from authored poses.

```ts
// viewer3d/muscles.ts: per-vertex muscle id (glTF _MUSCLE -> '_muscle'); id 0 = none
import { Color, type MeshStandardMaterial } from 'three';
export const worked = new Float32Array(32), stretched = new Float32Array(32);
export function addMuscleHighlight(mat: MeshStandardMaterial) {
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, { uWorked: { value: worked }, uStretched: { value: stretched },
      uWorkedColor: { value: new Color('#ff6a3d') }, uStretchColor: { value: new Color('#3da5ff') } });
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float _muscle; uniform float uWorked[32]; uniform float uStretched[32]; varying vec2 vMuscle;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        int mId = int(_muscle); vMuscle = vec2(uWorked[mId], uStretched[mId]);`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uWorkedColor; uniform vec3 uStretchColor; varying vec2 vMuscle;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uWorkedColor * vMuscle.x + uStretchColor * vMuscle.y;`);
  };
}
```

**Checked in r186 source:**
- `setMeshoptDecoder` returns `this`.
- `setFromSphericalCoords(radius, phi, theta)`.
- `clipAction` defaults to the clip's blend mode.
- Additive blending multiplies the delta onto the base.
- `setTime` resets the mixer, then updates it.
- `getWorld*` updates parent bones first.
- The `begin_vertex` / `emissivemap_fragment` chunks and `totalEmissiveRadiance` exist.
- The renderer throws when the context fails.

## 5. Not verified

- **Performance:** phone frame rates.
- **Asset size:** optimised character size.
- **Quaternius:** bone names and free-tier contents.
- **Mixamo:** Adobe's redistribution terms, and whether clips bind to MPFB2's Mixamo rig.
- **Chromium:** its default WebGL context limit.
- **mannequin.js:** behaviour on three.js r186.
