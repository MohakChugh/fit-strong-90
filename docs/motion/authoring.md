# Authoring motion clips

The 3D coach is a realistic 1.73 m figure (MakeHuman CC0 assets) on a 53-bone skeleton. Clips are short TypeScript keyframe lists in `src/motion/clips/*.ts`. The runtime turns them into poses with FK joint angles plus IK for hands, feet and kneeling knees, and renders them in three.js.

Read this guide, then copy the style of the exemplars:

| Archetype | Exemplar |
|---|---|
| Standing lift with a held weight | `goblet-squat` |
| Hinge with a hanging bar | `romanian-deadlift` |
| Lying on a bench | `dumbbell-bench-press` |
| All fours, sided hold | `bird-dog` |
| Gait generator | `treadmill-walk` |
| Spinal drill | `cat-cow` |
| Sided supine stretch hold | `supine-hamstring-stretch-strap` |

## World frame

- **Units and axes:** metres. Y is up and the floor is y = 0.
- **Facing:** at rest the figure faces +Z. Its **left** side is **+X**.
- **Sided clips:** author the **left** side only. The viewer mirrors the clip for the right side.

### Body dimensions

These are the measurements the authoring maths relies on:

| Measure | Value |
|---|---|
| Pelvis joint, standing with straight legs | y 0.945 (`STAND_Y` = 0.93 gives soft knees) |
| Hip joints | x ±0.108 |
| Thigh (hip to knee joint) | 0.42 |
| Shin (knee to ankle joint) | 0.446 |
| Ankle joint, foot flat | y 0.071 above the surface |
| Shoulder joints, standing | x ±0.214, y 1.386 |
| Shoulder joint to palm centre | 0.59 (a target farther than this cannot be reached) |
| Shoulder joint along the trunk from the pelvis | ~0.44 |
| Head joint | y 1.586; the top of the head is ~1.75 |
| Kneeling | the knee joint centre sits ~0.065 above the floor (`KNEEL_Y`) |
| Lying on the back or front | pelvis joint at y ≈ 0.10 (`LIE_Y`) |

## Pose fields

These are defined in `src/motion/types.ts`. Angles are in degrees. A positive angle is the anatomical direction on either side:

| Field | Value | Meaning |
|---|---|---|
| `root` | [x, y, z] | Pelvis joint position. Default: standing over the origin. |
| `rootRot` | [pitch, yaw, roll] | Pelvis orientation, Euler YXZ. **pitch +** = tilt forward (−90 lies on the back with the head toward −Z, +90 lies face down with the head toward +Z). **yaw +** = turn to face +X. **roll +** = left hip up. |
| `rootTwist` | number | Turn about the pelvis's own long axis, applied last. On all fours or lying, + lifts the left hip toward the ceiling. |
| `spine` | [flex, sideL, twistL] | Whole trunk, spread over three spine bones. **flex +** = round forward. **sideL +** = bend toward the left. **twistL +** = chest turns left. |
| `lumbar` | [flex, sideL, twistL] | Lower-back-only motion (rounding, arching). |
| `thoracic` | [flex, sideL, twistL] | Upper-back-only motion. |
| `neck`, `head` | [flex, sideL, twistL] | **flex +** = chin toward chest. Negative = look up. |
| `clavL`/`R` | [elevation, protraction] | Shrug up; shoulder blade forward. |
| `shoulderL`/`R` | [flex, abd, extRot] | FK, used when that hand has no target. **flex 90** = arm straight forward; **abd 90** = out to the side; flex ~170 = overhead. |
| `elbowL`/`R` | flex | 0 = straight. |
| `forearmL`/`R` | pronation | 0 = thumb forward; +90 = palm back. |
| `wristL`/`R` | [flex toward palm, radial deviation] | |
| `hipL`/`R` | [flex, abd, extRot] | FK, used when that foot has no target. **flex +** = thigh forward; negative = extension behind. |
| `kneeL`/`R` | flex | 0 = straight; positive bends the heel toward the buttock. |
| `ankleL`/`R` | [dorsiflex, inversion] | Negative dorsiflexion points the toes. |
| `toesL`/`R` | extension | |
| `gripL`/`R` | 0 open … 1 closed | |

### IK targets

The solver uses IK when a target is present and FK angles otherwise.

**Feet.** Set `footL`/`footR` = [x, surfaceY, z]. This is the point on a surface (floor y = 0, step top, treadmill belt 0.17) under the **ankle** of a flat foot.
- `footRotL`/`R`: [pitch, yaw, roll] of the foot in the world. Yaw + turns the toes toward +X; for the left foot that is toe-out.
- `heelL`/`R`: degrees of heel raise, pivoting on the ball of the foot.
- `kneePoleL`/`R`: the world direction the knee points. The default is "over the toes".

**Hands.** Set `handL`/`handR` = palm centre, where a bar or handle sits. The shoulder reaches 0.59 to
the palm, and less than that when the hand is turned so the palm sits behind the wrist, so probe the
reach instead of trusting the number: the tests check the gap in **every** `handSpace`, not just world space.
- `palmL`/`R`: the direction the palm faces — towards the thing the hand holds.
- `fingersL`/`R`: the direction the straight fingers point. A neutral hanging hand has fingers [0,−1,0] and palm toward the midline.
- `elbowPoleL`/`R`: where the elbow points. The default is back and slightly out.

`handSpace` sets the frame for hand targets, palm and finger directions, and poles:
- `'world'` is the default.
- `'chest'` puts the origin at the upper spine and moves with the trunk: +Z = forward from the chest, +Y = up the spine, +X = left. Use it for goblet holds, a bar on the back, and presses while lying.
- `'pelvis'` is similar, with the origin at the pelvis.
- `'shoulders'` keeps world axes but puts the origin at each shoulder joint, so hanging arms stay under the shoulders: `[±0.03, −0.585, z]`. Use it for deadlifts, carries and shrugs.

**Kneeling.** Set `kneeAimL`/`R` = knee joint target [x, `KNEEL_Y`, z]. The thigh aims there; the knee and ankle angles stay FK. The `kneel()` kit helper sets the shin flat.

## Kit (`src/motion/clips/kit.ts`)

| Helper | What it gives you |
|---|---|
| `stance(half, toeOut, z)` | Feet flat on the floor. |
| `standing(extra)` | Pelvis at `STAND_Y`, hip-width stance, arms relaxed. |
| `palmsFlat(half, z, y)` | Palms flat on a surface, fingers forward. |
| `kneel(kneeZ, half, lean)` | Knees on the floor with shins flat. |
| `quadruped(extra)` | Hands under shoulders, knees under hips. |
| `supine(extra)` | Lying on the back, legs straight. |
| `hookLying(extra)` | Lying on the back, knees bent, feet flat. |
| `prone(extra)` | Lying face down. |
| `seated(h, extra)` | Sitting on a seat of height h. |
| `rep(start, bottom, {lower, pauseBottom, lift, pauseTop})` | The keys and duration of one strength rep, from the coaching tempo. |

Add helpers to your **own** clip file. Do not edit `kit.ts`.

## Keyframes

- **Timing:** `t` runs from 0 up to (but not including) 1. After the last key the clip wraps back to the first — or to `loopFrom` when the clip has one, so a hold never blends back through its un-stretched start.
- **Easing:** `ease` controls how a key is entered. The default is `inOut`; use `linear` inside fast continuous motion (gait, pedalling).
- **Depth:** set 0 at the easy end and 1 at the hardest, most instructive point — the bottom of a squat, the deep hinge of a deadlift, the end range of a stretch. The app uses the depth-1 pose as its still frame, scales mistake deltas by depth, and maps the coach's rep phases to the spans either side of it (lowering runs 0 → 1, lifting runs 1 → back), so a clip must always travel easy end → hardest → back.
- **Strength:** build with `rep()` using the coaching `tempo`. Give `duration` in seconds.
- **Mobility holds:** ease into the stretch, then add a few near-identical keys that deepen slightly on each exhale. Set `loopFrom` to where the settled hold starts (before the last key). The last key (t ≤ 0.99) should match the `loopFrom` key, so the span between them — the loop itself — holds still.
- **Drills and cardio:** loop the whole cycle.
- **Duration:** use one cycle as the coaching describes it, for example 6 s for a 6 s cat-cow rep or about 1.1 s for a walking stride.
- **Camera:** set `view` to one of:
  - `side`: camera at +X, so it sees the figure's left side.
  - `otherSide`, `front`, `back`, `threeQuarter`, `top`.
  - Pick the view that shows the key joint angles best. Hinges, squats and lunges are usually best from the `side` or `threeQuarter`.

## Mistakes ("how not to do it")

Every coaching mistake (`src/data/coaching/*.ts`, field `clip`) must have a matching `Mistake` with the **same id**. The tests enforce this. Each coaching mistake has a `pose` text that describes the fault in degrees and centimetres; implement exactly that:
- `delta`: a Pose added to every key, scaled by key depth. Set `constant: true` to apply it fully throughout.
  - Angles start from 0 when a key does not set them, so a delta on `lumbar` or `clavL` reads as "this much more".
  - **Directions** (`kneePole`, `elbowPole`, `palm`, `fingers`) start from the solver's own default — knees
    over the toes, elbows back and out, palms to the midline, fingers hanging — because a normalised
    direction has no magnitude to grow from. So `kneePoleL: [-0.26, 0, 0]` turns a knee ~15° inward
    whether or not the clip set the pole, and it gets there smoothly.
  - A delta on an IK target (`handL`, `footL`) moves it: keep the result inside arm's reach, and do not
    slide a foot that is bearing weight. Use `keys` with a weight of 1 from the key the fault starts at
    (`offStart`) when the fault is a fixed setup error rather than something that grows with depth.
- `keys`: full replacement keyframes, when a delta can't express the fault (for example a phase-specific fault, or a different gait).
- `equipment`: replaces the clip's props, for a fault that is really a setup error.
- `highlight`: muscle regions tinted red while the fault plays.
- `label`: 2–5 words, e.g. "Knees cave in".

**Muscle regions** (`MuscleName`): `neck`, `traps`, `deltsFront`, `deltsSide`, `deltsRear`, `chest`, `biceps`, `triceps`, `forearms`, `abs`, `obliques`, `lats`, `upperBack`, `lowerBack`, `glutes`, `gluteMed`, `hipFlexors`, `quads`, `hamstrings`, `adductors`, `calves`, `shins`, `feet`, `hands`.

## Equipment (`Equipment` in types.ts)

**Hand-held props** follow the solved grips:
- `barbell` sits between the hands.
- `dumbbells`, with `hands` = `'both' | 'L' | 'R' | 'goblet'`.
- `kettlebell`.
- `trapBar`.
- `dowel`, with `attach` = `'hands' | 'back'`.
- `landmine`, with an `anchor`.
- `strap`, from both hands to one foot.
- `band`: between the hands, around the knees, or from an anchor to a hand.
- `cable`: a column with a pulley at `anchor` and a cable to the hand(s); `handle` = `'rope' | 'single' | 'bar'`.

- `handle`: a short bar (set `length`) or a `rope` with two falls; pair it with a `cable` for pulldowns and pushdowns.
- `kneePad`: a pad that rides on the knees (assisted pull-up and dip machines).
- `pad` with `follow`: a pad, roller or plate that tracks the `ankles`, `knees`, `thighs`, `feet` or `hands` — a leg-curl ankle roller (`roller: true`), a leg-press foot plate, a thigh pad. Takes `size`, `offset` (world-space), `pitch`, `yaw` and `material`.

**Placed once:**
- `bench` (pad top 0.44 m by default). `incline` hinges the back pad at the head end, so the shoulders sit higher than the hips.
- `box`: base centre at `pos`, with `size`, `pitch` for a tilted pad, and `material` (`wood`, `pad`, `frame`, `steel`, `cloth` for pillows and towels).
- `step`, `chair`, `mat`, `foamRoller`, `pullupBar` (height, z), `backExtensionBench`.
- `wall`: a panel at a `z` (and optional `x`), with `yaw` to turn it so it can face along ±X.
- `treadmill` (belt top 0.17 m), `bike` (`recumbent`), `rower`, `elliptical`.
- `machine` with a model name; it is a simple frame, so compose a seat and pads with `box`/`bench` and a `cable` for handles.

**Framing.** A tall prop (a cable column, a wall) can shrink the figure in shot. List those kinds in the clip's `ignoreForCamera` to leave them out of the framing.

**Setup faults.** A mistake may carry its own `equipment`, replacing the clip's, when the fault *is* the setup (a bench at the wrong angle, a seat at the wrong height).

Put props where the body actually contacts them. Check this in the screenshots.

## Verify every clip

1. **Probe** joint positions and body-surface contact, with no browser needed:
   `npx tsx --tsconfig tsconfig.app.json scripts/motion/probe.ts <clip-id> 0,0.25,0.5`
   `Rig.handTarget(side, pose)` gives the world point a hand target asks for, in any `handSpace`, so you
   can compare it against `Rig.grip(side)`; `probe.lowestY` is a cheap body-surface low point for sweeps.
2. **Screenshots.** The dev server must already be running on :5173; do not start or stop it. Then open the images and look at them:
   - `node scripts/motion/shot.mjs "clip=<id>&phases=0,0.25,0.5,0.75&views=side,front" /tmp/motion/<id>.png 1400 520`
   - Faults, one row each: `node scripts/motion/shot.mjs "clip=<id>&phases=0,0.5&views=side&mistakes=1" /tmp/motion/<id>-m.png 1000 900`
   - The mirrored side: add `&side=right`. An overview of several clips: `clips=a,b,c&phases=0.5`.
3. **Tests:** `npx vitest run src/motion -t "<clip-id>"`. Every variant (correct, each fault, mirrored side) must:
   - reach its hand targets within 3 cm, in whatever `handSpace` they are written in;
   - keep every joint inside its anatomical range, and no knee or elbow folded past 163°;
   - stay above the floor (body surface ≥ −2.5 cm), checked on a 16-phase sweep refined around its lowest point;
   - keep a planted foot planted: while both feet are on an unchanged surface the distance between them may not change by more than 3 cm;
   - touch the mat, pillow and seat it rests on without sinking through them (a fault may lift off one, never sink into it);
   - loop without a jump: the frames spanning the wrap may not move further than the movement does elsewhere;
   - match the coaching mistakes exactly, and move the body's surface at least 3 cm for each of them.

   Every live catalogue id must have a clip, and every retired id must resolve through its `aliasOf`.

## Quality bar

A physiotherapist should find nothing to correct. Check each clip against all of these:

- **Coaching:** it matches the coaching `steps`, `setup` and `tempo` for that id.
- **Spine:** neutral under load unless the exercise is a spinal movement.
- **Joints:** knees track over toes and joint ranges are realistic.
- **Contacts:** feet are flat and planted unless they should move; hands sit on their handles or the floor.
- **Gravity:** hanging arms are vertical and weights travel in straight paths.
- **Faults:** each one is visible and correct, and reads at a glance from the chosen view.
- **Support:** nothing penetrates the floor or props, and nothing floats. A lying body touches the mat. Seated hips touch the seat.
- **Movement:** smooth, calm and without pops. A held stretch breathes, deepening gently on each exhale.

**IK and FK in the same chain.** `handL`, `footL`, `kneeAimL` and friends are *held* values: once a key sets one, later keys keep it until a key sets it to `undefined`. Mixing a live IK target with FK angles for the same limb makes the limb jump or swing through the floor. So hand a limb over at a pose where IK and FK agree, and set the IK target to `undefined` from that key on.
