/**
 * Coaching content for the lower-body strength catalogue: hinges, glutes,
 * squats, single-leg work, hamstrings and calves.
 *
 * Drafted from docs/research/technique-lower-body-core.md and
 * docs/research/program-design.md (spinal-loading ladder, back-safe variants).
 * kettlebell-deadlift, single-leg-rdl, goblet-box-squat, split-squat,
 * reverse-lunge, lying-leg-curl and single-leg-calf-raise are not covered by
 * the research doc and were researched separately (see each record's sources).
 *
 * Spoken fields are written for text-to-speech: plain words, short sentences,
 * no symbols or abbreviations, and never any advice to hold the breath.
 */
import type { Coaching } from "@/types/catalog";

export const LOWER_COACHING: Coaching[] = [
  // ---------------------------------------------------------------- Hinges
  {
    id: "deadlift",
    name: "Conventional Deadlift",
    summary:
      "The conventional deadlift lifts a loaded barbell from the floor to standing, building strength in your hips, legs, back and grip.",
    muscles: {
      primary: ["glutes", "hamstrings", "inner thighs", "quadriceps"],
      secondary: ["lower back muscles", "lats", "upper back", "forearms and grip"],
    },
    equipment: "Olympic barbell and plates on a lifting platform, with blocks if the plates are small",
    setup: [
      "Find a straight Olympic bar loaded on the floor, usually on a lifting platform.",
      "Full-size plates hold the bar about 22 centimetres off the floor. With smaller plates, raise the bar on blocks to that height.",
      "Stand with your feet under your hips, toes straight or turned out a little, and the bar over the middle of your feet.",
      "Grip the bar with both palms facing you, hands just outside your shins.",
    ],
    steps: [
      "Stand with the bar over the middle of your feet.",
      "Hinge down and grip the bar just outside your legs.",
      "Bend your knees until your shins touch the bar, chest up and back long.",
      "Breathe in, brace, and gently pull the slack out of the bar.",
      "Push the floor away, keeping the bar against your legs.",
      "Stand tall with your hips through and your ribs down.",
      "Push your hips back and slide the bar down your legs to the floor.",
    ],
    tempo: { lower: 2, pauseBottom: 1, lift: 2, pauseTop: 1 },
    breathing:
      "With the bar on the floor, breathe in through your nose and brace all the way around your middle, front, sides and back. Keep breathing behind that brace. Breathe out slowly through pursed lips as the bar passes your knees, then take a fresh breath at the top or with the plates on the floor. Never hold your breath.",
    feel: "You should feel your glutes, hamstrings, grip and upper back doing the work.",
    shouldNotFeel:
      "You should not feel sharp or one-sided pain in your lower back, pain in your buttock, or pain or tingling below your knee. If you do, stop the set and switch to the trap-bar deadlift with the high handles.",
    why: "Pulling from the floor builds whole-body strength for lifting heavy things safely in daily life. It comes last in your plan, once your back has handled lighter hip-hinge lifts well.",
    mistakes: [
      {
        mistake: "Rounding the lower back",
        risk: "Strains the discs and ligaments of your lower back and can flare sciatica.",
        fix: "Use a lighter load and keep a long spine with a proud chest.",
        clip: "deadlift.rounded-lower-back",
        pose: "As the bar leaves the floor the lumbar spine flexes a further 25 to 35 degrees beyond the start posture: low back visibly convex, pelvis tucked under, head dropping. The bar stays over mid-foot.",
      },
      {
        mistake: "Bar drifting away from your legs",
        risk: "Lengthens the lever on your lower back and multiplies the load on it.",
        fix: "Keep your arms long and drag the bar up your legs.",
        clip: "deadlift.bar-drifts-forward",
        pose: "Bar travels 8 to 15 cm in front of the shins and thighs, arms angled about 15 degrees forward of vertical, shoulders well ahead of the bar.",
      },
      {
        mistake: "Leaning back at the top",
        risk: "Squeezes the small joints at the back of your spine.",
        fix: "Squeeze your glutes and stack your ribs over your hips.",
        clip: "deadlift.leaning-back-at-lockout",
        pose: "At lockout the lumbar spine extends 10 to 20 degrees past neutral, ribs flare and the shoulders finish about 10 cm behind the hips.",
      },
    ],
    backSafety: {
      status: "avoidWhenIrritable",
      note: "Hinge level 4 only, the top of the spinal-loading ladder. Skip it while your back or leg is irritable. When calm, pull from blocks with the bar at mid-shin first, finish every set with 2 or 3 reps left in the tank, and never test a maximum. With high blood pressure, stop 3 reps short. With a back history, the trap-bar deadlift with high handles is the safer default.",
      regression: "trap-bar-deadlift",
    },
    cues: [
      "Bar on your legs.",
      "Push the floor away.",
      "Long spine.",
      "Hips through, ribs down.",
      "Breathe out past the knees.",
    ],
    youtube: {
      tutorial: "how to deadlift physical therapist explains form",
      mistakes: "deadlift mistakes rounded back physical therapist",
    },
    sources: [
      "https://exrx.net/WeightExercises/GluteusMaximus/BBDeadlift",
      "https://www.strongerbyscience.com/how-to-deadlift/",
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC9528690/",
    ],
  },
  {
    id: "trap-bar-deadlift",
    name: "Trap Bar Deadlift",
    summary:
      "The trap bar deadlift lifts a hexagon-shaped bar that you stand inside, keeping the weight beside you so your legs share more of the work and your lower back less.",
    muscles: {
      primary: ["quadriceps", "glutes", "inner thighs"],
      secondary: ["hamstrings", "lower back muscles", "upper back", "grip"],
    },
    equipment: "Trap bar, also called a hex bar, with plates; optional 5 to 10 centimetre blocks",
    setup: [
      "Look for a hexagon-shaped bar you stand inside, with plates on short sleeves at each side.",
      "Most have high and low handles. Flip the bar so the high handles face up, which starts you 5 to 10 centimetres higher.",
      "Step into the centre with your ankle bones in line with the middle of the handles.",
      "Set your feet hip-width apart, toes turned out slightly. You will grip the middle of each handle so the bar balances level.",
    ],
    steps: [
      "Step into the centre, ankles in line with the handles.",
      "Push your hips back, bend your knees and grip the middle of the handles.",
      "Set your shoulders just over the handles with your back long.",
      "Breathe in, brace and take the slack out.",
      "Drive the floor away and stand tall.",
      "Sit your hips back and lower the bar softly to the floor.",
    ],
    tempo: { lower: 2, pauseBottom: 1, lift: 2, pauseTop: 1 },
    breathing:
      "With the plates on the floor, breathe in through your nose and brace all the way around your middle, front, sides and back. Keep breathing behind that brace. Breathe out steadily from mid-shin to standing tall, then take a fresh breath with the plates back on the floor. Never hold your breath.",
    feel: "You should feel your thighs, glutes and grip working while your back holds steady.",
    shouldNotFeel:
      "You should not feel pain in your lower back, or pain or tingling below your knee. If you do, stop the set and switch to the kettlebell deadlift from a step.",
    why: "Because the weight sits beside you rather than in front, it is the preferred heavy hip-hinge lift with a back history. It builds the leg and hip strength you need to lift heavy things from the floor.",
    mistakes: [
      {
        mistake: "Standing off-centre",
        risk: "The bar tilts and your back has to work to balance it.",
        fix: "Line your ankle bones up with the middle of the handles.",
        clip: "trap-bar-deadlift.off-centre-stance",
        pose: "Feet placed 5 to 10 cm too far forward inside the frame, so the handles sit behind the ankles. As the plates leave the floor the bar tilts front-down 5 to 10 degrees and the torso pitches forward to chase it.",
      },
      {
        mistake: "Rounding the lower back at the bottom",
        risk: "Strains the discs, most often when using the low handles.",
        fix: "Use the high handles, push your hips back and keep your chest proud.",
        clip: "trap-bar-deadlift.rounded-lower-back",
        pose: "At the start position the lumbar spine flexes 20 to 30 degrees beyond the setup posture: low back convex, pelvis tucked under, head dropping toward the floor.",
      },
      {
        mistake: "Leaning back at the top",
        risk: "Squeezes the small joints at the back of your spine.",
        fix: "Stand tall, squeeze your glutes and stop when you are straight.",
        clip: "trap-bar-deadlift.leaning-back-at-lockout",
        pose: "At lockout the lumbar spine extends 10 to 20 degrees past neutral and the shoulders finish about 10 cm behind the hips.",
      },
    ],
    backSafety: {
      status: "modify",
      note: "The preferred heavy hinge with a back history. Use the high handles from hinge level 2 with moderate loads, stopping with 3 reps left in the tank, and move to the low handles only at level 3. Stop if leg symptoms appear. If it still irritates, use the kettlebell deadlift from a step, the cable pull-through or the glute bridge.",
      regression: "kettlebell-deadlift",
    },
    cues: ["Ankles under the handles.", "Long arms.", "Push the floor away.", "Stand tall, don't lean."],
    youtube: {
      tutorial: "trap bar deadlift technique physical therapist",
      mistakes: "trap bar deadlift common mistakes",
    },
    sources: [
      "https://pubmed.ncbi.nlm.nih.gov/21659894/",
      "https://pubmed.ncbi.nlm.nih.gov/28151780/",
    ],
  },
  {
    id: "kettlebell-deadlift",
    name: "Kettlebell Deadlift",
    summary:
      "The kettlebell deadlift lifts one kettlebell from a low step to standing, a light and adjustable way to learn the hip hinge and strengthen your glutes and hamstrings.",
    muscles: {
      primary: ["glutes", "hamstrings", "quadriceps"],
      secondary: ["inner thighs", "lower back muscles", "upper back", "grip"],
    },
    equipment: "One kettlebell and a sturdy step, low box or stacked plates about 10 to 20 centimetres high",
    setup: [
      "Set one kettlebell on a sturdy step or stacked plates, about 10 to 20 centimetres high, so the handle sits a little below your knees.",
      "Stand with the bell between your feet and the handle in line with your ankle bones.",
      "Place your feet between hip and shoulder width apart, toes turned out slightly.",
      "Start with a light bell. Lower the step over the weeks as your hinge improves.",
    ],
    steps: [
      "Stand tall with the bell between your feet.",
      "Push your hips back, soften your knees and reach down to the handle.",
      "Grip with both hands, arms long, shoulders pulled down.",
      "Breathe in, brace, and take the slack out.",
      "Drive your feet into the floor and stand tall, squeezing your glutes.",
      "Push your hips back and set the bell down softly on the step.",
    ],
    tempo: { lower: 2, pauseBottom: 1, lift: 2, pauseTop: 1 },
    breathing:
      "With the bell on the step, breathe in through your nose and brace all the way around your middle, front, sides and back. Keep breathing behind that brace. Breathe out slowly through pursed lips as you stand up, and breathe in as you lower. Never hold your breath.",
    feel: "You should feel your glutes and the backs of your thighs working, with a light stretch at the bottom.",
    shouldNotFeel:
      "You should not feel pain in your lower back, or pain or tingling travelling down your leg. If you do, raise the step or lighten the bell, and if it continues, stop and switch to the glute bridge.",
    why: "It teaches you to bend from the hips, the safest way to pick things up from the floor, with a light load and a short range. It is the first loaded hinge in your plan and the stepping stone to the trap-bar deadlift.",
    mistakes: [
      {
        mistake: "Squatting the bell up",
        risk: "Your hips stay low, your glutes switch off, and it stops teaching the hinge.",
        fix: "Push your hips back and keep your shins nearly upright.",
        clip: "kettlebell-deadlift.squatting-instead-of-hinging",
        pose: "At the bottom the knees flex to 100 to 110 degrees, the hips drop to knee height, the shins tilt 25 to 30 degrees forward and the torso stays nearly upright, only about 20 degrees forward.",
      },
      {
        mistake: "Rounding to reach the bell",
        risk: "Bends your lower back under load and can flare disc pain or sciatica.",
        fix: "Raise the step until you can reach the handle with a long spine.",
        clip: "kettlebell-deadlift.rounded-lower-back",
        pose: "As the hands reach the handle the lumbar spine flexes 20 to 30 degrees and the head drops; hips sit higher than the knees and the low back is visibly convex.",
      },
      {
        mistake: "Bell too far in front",
        risk: "The weight pulls you forward and loads your lower back.",
        fix: "Line the handle up with your ankle bones.",
        clip: "kettlebell-deadlift.bell-too-far-forward",
        pose: "Kettlebell sits 15 to 20 cm in front of the toes; arms angle about 20 degrees forward of vertical, shoulders well ahead of the handle, heels light on the floor.",
      },
    ],
    backSafety: {
      status: "ok",
      note: "A back-friendly first loaded hinge at hinge level 1: the light bell sits between your feet and the step shortens the range. Raise the step if you cannot reach the handle with a long spine, and lower it gradually toward the floor as your hinge improves. If it provokes back or leg symptoms, use the glute bridge until things settle.",
      regression: "glute-bridge",
    },
    cues: [
      "Hips back.",
      "Long spine.",
      "Arms long, shoulders down.",
      "Push the floor away.",
      "Stand tall and squeeze.",
    ],
    youtube: {
      tutorial: "kettlebell deadlift from blocks hip hinge tutorial physical therapist",
      mistakes: "kettlebell deadlift mistakes squatting instead of hinging",
    },
    sources: [
      "https://exrx.net/WeightExercises/Kettlebell/KBDeadlift",
      "https://www.acefitness.org/resources/everyone/exercise-library/33/hip-hinge/",
      "https://pubmed.ncbi.nlm.nih.gov/25641309/",
    ],
  },
  {
    id: "rack-pull",
    name: "Rack Pull",
    summary:
      "The rack pull is a partial deadlift from pins at about knee height, strengthening your hips and upper back over the top half of the lift.",
    muscles: {
      primary: ["glutes", "hamstrings", "lower back muscles", "upper back"],
      secondary: ["lats", "shoulder-blade muscles", "forearms and grip"],
    },
    equipment: "Barbell and plates in a power rack with safety pins, or full-size plates raised on 10 to 15 centimetre blocks",
    setup: [
      "Find a power rack, the steel cage with four uprights, numbered holes and safety pins.",
      "Set the pins so the bar rests at about knee height. With a back history, set it at or just above the knee.",
      "Stand close with your feet hip-width apart and the bar touching your legs.",
      "Grip with both palms facing you, hands just outside your legs.",
      "Load no more than you use for the trap-bar deadlift.",
    ],
    steps: [
      "Hinge and grip the bar just outside your legs.",
      "Breathe in, brace and pull the slack out.",
      "Drive your hips forward, sliding the bar up your thighs.",
      "Stand tall with your shoulders down. No leaning back.",
      "Lower under control and touch the pins softly.",
    ],
    tempo: { lower: 2, pauseBottom: 1, lift: 2, pauseTop: 1 },
    breathing:
      "At the pins, breathe in through your nose and brace all the way around your middle, front, sides and back. Keep breathing behind that brace. Breathe out slowly through pursed lips as you drive to standing, and breathe in as you lower. Never hold your breath.",
    feel: "You should feel your glutes, hamstrings, upper back and grip working.",
    shouldNotFeel:
      "You should not feel pain in your lower back or pain travelling down your leg. If you do, stop the set and switch to the trap-bar deadlift with the high handles.",
    why: "It strengthens the top half of the deadlift and your upper back without a deep bend. Kept to moderate loads, it builds pulling strength for carrying and lifting.",
    mistakes: [
      {
        mistake: "Overloading and hitching",
        risk: "Too much weight rounds your back and overloads your spine.",
        fix: "Use your trap-bar load or less, in one smooth pull.",
        clip: "rack-pull.overloading-and-hitching",
        pose: "With an overloaded bar the lumbar spine rounds 15 to 25 degrees as the bar breaks from the pins, then the knees re-bend 15 to 20 degrees at mid-thigh to rest the bar on the thighs before the hips finish.",
      },
      {
        mistake: "Leaning back at the top",
        risk: "Squeezes the small joints at the back of your spine.",
        fix: "Finish with your glutes, ribs over hips.",
        clip: "rack-pull.leaning-back-at-lockout",
        pose: "At lockout the torso finishes 15 to 20 degrees behind vertical with the lumbar spine arched and the ribs flared.",
      },
      {
        mistake: "Bouncing off the pins",
        risk: "You lose your brace and jolt your spine.",
        fix: "Touch the pins softly and pause for one second.",
        clip: "rack-pull.bouncing-off-the-pins",
        pose: "Bar drops onto the pins and rebounds 3 to 5 cm straight into the next rep; the trunk jolts about 10 degrees forward and the low back loses its set position.",
      },
    ],
    backSafety: {
      status: "modify",
      note: "Hinge level 3 only, and never heavier than your trap-bar deadlift load, because the short range tempts you to overload. Set the pins at or just above the knee, use one smooth pull, and finish with 2 or 3 reps left in the tank, or 3 with high blood pressure. On an irritable day, use the trap-bar deadlift with high handles or the cable pull-through instead.",
      regression: "trap-bar-deadlift",
    },
    cues: ["Bar on your thighs.", "Hips forward.", "Tall, not back.", "One smooth pull."],
    youtube: {
      tutorial: "rack pull technique strength coach",
      mistakes: "rack pull mistakes hitching leaning back",
    },
    sources: [
      "https://exrx.net/WeightExercises/GluteusMaximus/BBRackPull",
      "https://www.strongerbyscience.com/how-to-deadlift/",
    ],
  },
  {
    id: "romanian-deadlift",
    name: "Romanian Deadlift",
    summary:
      "The Romanian deadlift is a hip hinge with soft knees, sliding a bar down your thighs to stretch and strengthen your hamstrings and glutes.",
    muscles: {
      primary: ["hamstrings", "glutes", "inner thighs"],
      secondary: ["lower back muscles", "lats", "grip"],
    },
    equipment: "Barbell taken from a rack at mid-thigh height, or two dumbbells",
    setup: [
      "Set the bar in a rack at mid-thigh height, so you never lift it from the floor.",
      "Stand with your feet hip-width apart, toes pointing forward.",
      "Grip with both palms facing you, hands just outside your thighs.",
      "Unlock your knees slightly and keep that small bend for the whole set.",
    ],
    steps: [
      "Stand tall with the bar at your thighs and your knees soft.",
      "Push your hips back and slide the bar down your thighs.",
      "Keep your shins nearly upright and your back long.",
      "Stop when your hips stop moving back, usually just below your knees.",
      "Drive your hips forward to stand and squeeze your glutes.",
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 1 },
    breathing:
      "At the top, breathe in through your nose and brace all the way around your middle, front, sides and back. Keep breathing behind that brace as you lower. Breathe out slowly as you rise past your knees. Never hold your breath.",
    feel: "You should feel a strong stretch in the backs of your thighs, and your glutes working as you stand.",
    shouldNotFeel:
      "You should not feel pain in your lower back, or burning or tingling behind your knee or in your calf. That is nerve tension, not a muscle stretch. If you feel it, stop and switch to the cable pull-through.",
    why: "It builds strong hamstrings and glutes through a long range, which helps protect your back when you bend and lift. It also trains you to keep your spine steady while your hips do the moving.",
    mistakes: [
      {
        mistake: "Reaching for the floor",
        risk: "Once your hamstrings run out of length, your lower back rounds and strains the discs.",
        fix: "Stop where your hips stop moving back.",
        clip: "romanian-deadlift.reaching-for-the-floor",
        pose: "Bar travels below mid-shin after the hips have stopped moving back; the lumbar spine flexes 20 to 30 degrees, low back convex, head dropping.",
      },
      {
        mistake: "Bar drifting away from your legs",
        risk: "Lengthens the lever on your lower back.",
        fix: "Keep the bar brushing your thighs on the way down.",
        clip: "romanian-deadlift.bar-drifts-forward",
        pose: "Arms swing about 15 degrees forward of vertical so the bar hangs 10 to 20 cm in front of the thighs, shoulders well ahead of the bar.",
      },
      {
        mistake: "Locking the knees",
        risk: "Adds tension to your hamstrings and the sciatic nerve.",
        fix: "Keep a soft bend in your knees.",
        clip: "romanian-deadlift.locked-knees",
        pose: "Knees fully straight, 0 degrees of bend, at the bottom of the hinge, with the torso about 70 degrees forward and the ankles under the hips.",
      },
    ],
    backSafety: {
      status: "modify",
      note: "Hinge level 3, and with sciatica only after the nerve check shows no leg symptoms. Take the bar no lower than just below the knee. With sciatica, stop just above the knee, bend your knees about 25 to 30 degrees and keep your chin level. Dumbbells or the cable pull-through are gentler options. Stop if symptoms travel below the knee.",
      regression: "cable-pull-through",
    },
    cues: ["Hips back.", "Bar on your thighs.", "Long spine.", "Soft knees.", "Squeeze to stand."],
    youtube: {
      tutorial: "Romanian deadlift form physical therapist hip hinge",
      mistakes: "Romanian deadlift common mistakes rounding back",
    },
    sources: [
      "https://exrx.net/WeightExercises/OlympicLifts/RomanianDeadlift",
      "https://www.acefitness.org/resources/everyone/exercise-library/317/romanian-deadlift/",
      "https://www.acefitness.org/resources/everyone/exercise-library/33/hip-hinge/",
    ],
  },
  {
    id: "single-leg-rdl",
    name: "Single-Leg Romanian Deadlift",
    summary:
      "The single-leg Romanian deadlift is a hip hinge on one leg, starting with the back toes resting on the floor like a kickstand, that strengthens each glute and hamstring and trains balance.",
    muscles: {
      primary: ["glutes", "hamstrings"],
      secondary: ["side hip muscles", "inner thighs", "lower back muscles", "core"],
    },
    equipment: "Bodyweight or one light dumbbell or kettlebell, beside a rack or wall to hold if needed",
    setup: [
      "Stand next to a rack or wall that you can touch for balance.",
      "For the kickstand version, step one foot half a step back so its toes line up with your front heel, and lift that back heel.",
      "Keep most of your weight, about 80 to 90 percent, on the front foot.",
      "Hold a light dumbbell in the hand opposite your front leg, or start with no weight.",
      "When the kickstand feels steady, you can let the back foot lift and reach behind you as you hinge.",
    ],
    steps: [
      "Soften your front knee and brace.",
      "Push your hips back and tip your chest forward with a long spine.",
      "Keep both hips pointing at the floor.",
      "Lower the weight along your front shin until your hips stop moving back.",
      "Drive your front foot into the floor and stand tall, squeezing your glute.",
      "Finish the set on one side, then switch.",
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 1 },
    breathing:
      "At the top, breathe in through your nose and brace all the way around your middle, front, sides and back. Keep breathing behind that brace as you hinge down. Breathe out slowly as you drive back up to standing. Never hold your breath.",
    feel: "You should feel the glute and the back of the thigh of your front leg, a mild stretch at the bottom, and the side of your hip working to keep you steady.",
    shouldNotFeel:
      "You should not feel pain in your lower back, or burning or tingling behind your knee, in your calf or in your foot. That is nerve tension, not a stretch. If you feel it, stop and switch to the cable pull-through.",
    why: "It strengthens each hip on its own and trains your balance, which helps with walking, stairs and catching a stumble. Working one side at a time also shows up and evens out differences between your legs.",
    mistakes: [
      {
        mistake: "Hips twisting open",
        risk: "Twists your lower back and moves the work away from your glute.",
        fix: "Keep both hips pointing at the floor.",
        clip: "single-leg-rdl.hips-twisting-open",
        pose: "As the torso tips forward the pelvis rotates 15 to 25 degrees open toward the back-leg side: the back hip hikes up, the back knee and toes turn out sideways, and the trunk follows with about 10 degrees of rotation.",
      },
      {
        mistake: "Rounding the back to reach lower",
        risk: "Bends your lower back under load and adds tension to the sciatic nerve.",
        fix: "Stop where your hips stop moving back.",
        clip: "single-leg-rdl.rounded-lower-back",
        pose: "Weight reaches below mid-shin while the lumbar spine flexes 20 to 30 degrees and the head drops; the standing knee is nearly straight.",
      },
      {
        mistake: "Locking the standing knee",
        risk: "Pulls hard on your hamstring and the sciatic nerve.",
        fix: "Keep a soft bend in your front knee.",
        clip: "single-leg-rdl.locked-standing-knee",
        pose: "Standing knee fully straight, 0 degrees of bend, with the shin vertical and the torso 60 to 70 degrees forward at the bottom of the hinge.",
      },
    ],
    backSafety: {
      status: "avoidWhenIrritable",
      note: "Hinge level 2 for the kickstand version and level 3 with the back foot lifted. With sciatica, use it only after the nerve check shows no leg symptoms in two sessions, because a bent hip with a straight knee tensions the sciatic nerve. Avoid it while your back or leg is irritable and use the cable pull-through instead. With poor balance or numb feet, keep a hand on a support.",
      regression: "cable-pull-through",
    },
    cues: [
      "Weight on the front foot.",
      "Hips back, hips square.",
      "Long spine.",
      "Soft front knee.",
      "Drive up and squeeze.",
    ],
    youtube: {
      tutorial: "kickstand RDL tutorial physical therapist",
      mistakes: "single leg RDL common mistakes hip rotation",
    },
    sources: [
      "https://www.acefitness.org/resources/everyone/exercise-library/329/single-leg-romanian-deadlift/",
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC10716453/",
      "https://pubmed.ncbi.nlm.nih.gov/16838375/",
    ],
  },
  {
    id: "cable-pull-through",
    name: "Cable Pull-Through",
    summary:
      "The cable pull-through is a hip hinge facing away from a low cable, training your glutes and hamstrings with less work for your back muscles than a deadlift.",
    muscles: {
      primary: ["glutes", "hamstrings"],
      secondary: ["inner thighs", "grip", "lower back muscles"],
    },
    equipment: "Cable station with the pulley at its lowest setting and a rope handle",
    setup: [
      "Find a cable station, the tall column with a weight stack and a pulley that slides and locks with a pin.",
      "Set the pulley to the lowest position and clip on a rope.",
      "Face away, take the rope between your legs, and walk out 2 or 3 steps until the stack lifts.",
      "Stand with your feet shoulder-width apart, toes turned out slightly, knees soft.",
    ],
    steps: [
      "Hold the rope between your legs with long arms.",
      "Soften your knees and push your hips back, letting the rope pull your hands through.",
      "Keep your back long and stop when your hips stop moving back.",
      "Drive your hips forward to stand tall.",
      "Squeeze your glutes at the top. Your arms just hold the rope.",
    ],
    tempo: { lower: 2, pauseBottom: 1, lift: 1, pauseTop: 1 },
    breathing:
      "Brace all the way around your middle, front, sides and back, and keep breathing behind that brace. Breathe in as your hips go back, and breathe out as you drive them forward. Never hold your breath.",
    feel: "You should feel your glutes squeeze at the top and a stretch in the backs of your thighs at the bottom.",
    shouldNotFeel:
      "You should not feel your lower back doing the work, your shoulders being yanked, or pain or tingling down your leg. If you do, shorten the range and lighten the stack, and if it continues, switch to the glute bridge.",
    why: "The cable pulls you backwards instead of down, so your back muscles work less than in a Romanian deadlift while your glutes still work hard. It is a back-friendly way to build a strong hip hinge.",
    mistakes: [
      {
        mistake: "Squatting instead of hinging",
        risk: "Your glutes and hamstrings miss the work.",
        fix: "Push your hips back, like shutting a car door with your bottom.",
        clip: "cable-pull-through.squatting-instead-of-hinging",
        pose: "Knees flex past 60 degrees and the hips drop toward the heels while the torso stays nearly upright, about 20 degrees forward; the rope passes low between the knees.",
      },
      {
        mistake: "Rounding at the bottom",
        risk: "Bends your lower back under load and stresses the discs.",
        fix: "Use a shorter range and keep your back long.",
        clip: "cable-pull-through.rounded-lower-back",
        pose: "Hands pulled deep between the thighs at the bottom; the lumbar spine flexes 15 to 25 degrees and the head drops.",
      },
      {
        mistake: "Pulling with your arms",
        risk: "Your shoulders and biceps take over from your hips.",
        fix: "Keep your arms long, like ropes.",
        clip: "cable-pull-through.pulling-with-arms",
        pose: "Elbows bend 30 to 60 degrees as the hips drive forward, hands pulled up toward the belly at lockout, shoulders shrugging.",
      },
    ],
    backSafety: {
      status: "ok",
      note: "A back-friendly hinge at hinge level 1. The resistance pulls backwards, and your back muscles work less than in a Romanian deadlift. While irritable, shorten the range and lighten the load. Stop if leg symptoms appear.",
      regression: "glute-bridge",
    },
    cues: ["Hips back.", "Arms long.", "Hips through.", "Squeeze."],
    youtube: {
      tutorial: "cable pull through technique physical therapist",
      mistakes: "cable pull through common mistakes",
    },
    sources: [
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC10124728/",
      "https://www.acefitness.org/resources/everyone/exercise-library/33/hip-hinge/",
    ],
  },
  {
    id: "back-extension-45",
    name: "45-Degree Back Extension",
    summary:
      "The 45-degree back extension hinges you forward over an angled bench and back up to a straight line, strengthening your glutes, hamstrings and back muscles.",
    muscles: {
      primary: ["glutes", "hamstrings", "lower back muscles"],
      secondary: ["inner thighs"],
    },
    equipment: "45-degree back extension bench, often called a Roman chair",
    setup: [
      "Find the angled back extension bench, with thigh pads and a footplate with ankle rollers.",
      "Set the pad so its top edge sits just below the crease of your hips, so your belly clears it as you lower.",
      "Press your heels against the footplate with the rollers behind your lower calves.",
      "Rest your hands behind your hips. Crossing your arms on your chest is harder.",
    ],
    steps: [
      "Brace so your body makes a straight line from head to heels.",
      "Hinge at your hips and lower until you feel a stretch in the backs of your thighs.",
      "Keep your back long. Don't curl over the pad.",
      "Squeeze your glutes to rise.",
      "Stop at a straight line. Never arch past it.",
    ],
    tempo: { lower: 2, pauseBottom: 0, lift: 2, pauseTop: 1 },
    breathing:
      "Brace all the way around your middle, front, sides and back, and keep breathing. Breathe in as you lower, and breathe out as you rise. Never hold your breath, especially at the bottom where your head is low.",
    feel: "You should feel your glutes and hamstrings lifting you while your back muscles hold steady.",
    shouldNotFeel:
      "You should not feel pain in your lower back, a pinch as you reach the top, or pressure in your head at the bottom. If you do, stop and switch to the bird dog.",
    why: "Endurance in your back muscles helps you bend and lift with control, and it is one of the things that predicts who does well with heavier lifts. This builds it while your hips do the moving, so your spine stays steady.",
    mistakes: [
      {
        mistake: "Arching past straight at the top",
        risk: "Squeezes the small joints at the back of your spine.",
        fix: "Stop when your body makes a straight line.",
        clip: "back-extension-45.arching-at-the-top",
        pose: "At the top the torso rises 15 to 25 degrees above the line of the legs, with the lumbar spine arched and the head tipped back.",
      },
      {
        mistake: "Curling over the pad",
        risk: "Repeats loaded bending of your lower back.",
        fix: "Hinge at the hips only and limit the depth.",
        clip: "back-extension-45.curling-over-the-pad",
        pose: "At the bottom the lumbar spine flexes 30 to 40 degrees over the pad, upper back rounded and chin tucked to the chest, while the hips barely hinge.",
      },
      {
        mistake: "Pad set too high",
        risk: "Your hips cannot hinge, so your spine bends instead.",
        fix: "Lower the pad to just below your hip crease.",
        clip: "back-extension-45.pad-too-high",
        pose: "Pad edge sits across the belly 5 to 10 cm above the hip crease, blocking the pelvis, so all the movement comes from the lumbar spine flexing about 40 degrees.",
      },
    ],
    backSafety: {
      status: "avoidWhenIrritable",
      note: "Hip-hinge style only, to a straight line and never arched. A short hold at the top is hinge level 0, and moving reps start at level 2. Avoid it while irritable, with pain on arching, or with active sciatica, and use the bird dog instead. The bottom puts your head below your heart, so keep it brief with high blood pressure and skip it with advanced diabetic eye disease.",
      regression: "bird-dog",
    },
    cues: ["Hinge at the hips.", "Long spine.", "Squeeze up.", "Stop at the line."],
    youtube: {
      tutorial: "45 degree back extension glute focus physical therapist",
      mistakes: "back extension mistakes hyperextending lower back",
    },
    sources: [
      "https://exrx.net/WeightExercises/Hamstrings/BW45HyperextensionHips",
      "https://pubmed.ncbi.nlm.nih.gov/9442191/",
    ],
  },

  // ----------------------------------------------------------------- Glutes
  {
    id: "hip-thrust",
    name: "Hip Thrust",
    summary:
      "The hip thrust drives your hips up under a padded barbell while your upper back rests on a bench, one of the most direct ways to strengthen your glutes.",
    muscles: {
      primary: ["glutes"],
      secondary: ["hamstrings", "quadriceps", "inner thighs"],
    },
    equipment: "Flat bench braced against a wall, barbell with a bar pad and plates, or a hip-thrust machine",
    setup: [
      "Brace a flat bench, about 40 to 46 centimetres high, against a wall so it cannot slide.",
      "Sit on the floor with the bench edge just below your shoulder blades.",
      "Roll the padded bar over your hip crease, not your stomach.",
      "Plant your feet flat, about hip to shoulder width apart, so your shins will be upright at the top.",
      "On a hip-thrust machine, set the back pad at shoulder-blade height and the pad or belt across your hips.",
    ],
    steps: [
      "Set your shoulder blades on the bench, with the bar over your hip crease.",
      "Tuck your chin, set your ribs down and brace.",
      "Drive through your heels until your body is flat like a table.",
      "Squeeze your glutes for two seconds. No arching.",
      "Lower until your hips are just above the floor.",
    ],
    tempo: { lower: 2, pauseBottom: 0, lift: 1, pauseTop: 2 },
    breathing:
      "At the bottom, breathe in and brace all the way around your middle, front, sides and back. Breathe out as you drive up, and keep breathing out gently through the squeeze. Never hold your breath at the top.",
    feel: "You should feel your glutes working, hardest at the top.",
    shouldNotFeel:
      "You should not feel pain in your lower back, a pinch at the front of your hips, or cramping in your hamstrings. If your back hurts, stop and switch to the glute bridge.",
    why: "It loads your glutes heavily with no weight pressing down through your spine, which makes it a safe way to build hip strength. Strong glutes take strain off your lower back when you lift and walk.",
    mistakes: [
      {
        mistake: "Arching at the top",
        risk: "Squeezes the joints of your lower back, and your glutes do less.",
        fix: "Chin tucked, ribs down, tuck your tailbone.",
        clip: "hip-thrust.arching-at-the-top",
        pose: "At the top the ribs flare, the lumbar spine extends 15 to 20 degrees and the pelvis tips about 10 degrees forward, with the head pressing back over the bench.",
      },
      {
        mistake: "Feet too far away",
        risk: "Your hamstrings cramp and take over.",
        fix: "Bring your feet in so your shins are upright at the top.",
        clip: "hip-thrust.feet-too-far-away",
        pose: "Feet 15 to 20 cm too far from the hips, so the knees open past 110 degrees at the top and the shins slope about 20 degrees away from the body.",
      },
      {
        mistake: "Knees caving in",
        risk: "Stresses your knees, and your glutes do less.",
        fix: "Push your knees out over your toes.",
        clip: "hip-thrust.knees-caving-in",
        pose: "Knees collapse inward 10 to 15 degrees into valgus during the drive, feet flat.",
      },
    ],
    backSafety: {
      status: "ok",
      note: "No weight presses down through your spine, so it is a good substitute for deadlifts, from hinge level 1. If arching bothers your back, tuck your tailbone harder and stop just short of full lockout.",
      regression: "glute-bridge",
    },
    cues: ["Chin tucked.", "Ribs down.", "Drive through your heels.", "Squeeze, don't arch."],
    youtube: {
      tutorial: "barbell hip thrust setup physical therapist",
      mistakes: "hip thrust mistakes arching lower back",
    },
    sources: [
      "https://exrx.net/WeightExercises/GluteusMaximus/BBHipThrust",
      "https://pubmed.ncbi.nlm.nih.gov/26214739/",
    ],
  },
  {
    id: "glute-bridge",
    name: "Glute Bridge",
    summary:
      "The glute bridge lifts your hips while you lie on your back with your knees bent, a gentle way to strengthen your glutes with almost no load on your spine.",
    muscles: {
      primary: ["glutes"],
      secondary: ["hamstrings", "deep abdominals"],
    },
    equipment: "Exercise mat; optional dumbbell or plate resting on the hips",
    setup: [
      "Lie on your back on a mat with your knees bent and your feet flat, hip-width apart.",
      "Bring your heels about 25 to 30 centimetres from your bottom, so your knees bend to about 90 degrees.",
      "Rest your arms by your sides. For more load, rest a dumbbell across your hips.",
    ],
    steps: [
      "Set your ribs down and gently tighten your stomach.",
      "Press through your heels and lift your hips.",
      "Stop when your shoulders, hips and knees line up.",
      "Squeeze your glutes for two seconds.",
      "Lower slowly to the mat.",
    ],
    tempo: { lower: 2, pauseBottom: 0, lift: 1, pauseTop: 2 },
    breathing:
      "Brace gently all the way around your middle and keep breathing. Breathe out as you lift and through the squeeze, and breathe in as you lower. Never hold your breath.",
    feel: "You should feel your glutes squeezing, most of all at the top.",
    shouldNotFeel:
      "You should not feel your lower back working, your hamstrings cramping, or pain travelling down your leg. If your back aches, lift only three-quarters of the way. If your hamstrings cramp, bring your heels closer. If pain travels down your leg, stop the exercise.",
    why: "It wakes up and strengthens your glutes with almost no load on your spine, so you can train it even on sensitive days. Strong glutes help support your lower back.",
    mistakes: [
      {
        mistake: "Over-arching at the top",
        risk: "Squeezes the joints of your lower back.",
        fix: "Stop at a straight line with your ribs down.",
        clip: "glute-bridge.over-arching",
        pose: "Hips pushed 5 to 8 cm above the shoulder-to-knee line; the lumbar spine extends about 15 degrees and the ribs flare.",
      },
      {
        mistake: "Feet too far away",
        risk: "Your hamstrings cramp and take over.",
        fix: "Bring your heels in until your knees bend to about 90 degrees.",
        clip: "glute-bridge.feet-too-far-away",
        pose: "Heels 40 to 50 cm from the buttocks, so the knees open to 120 to 130 degrees at the top.",
      },
      {
        mistake: "Pushing through your toes",
        risk: "Your thighs take over from your glutes.",
        fix: "Keep your heels down.",
        clip: "glute-bridge.pushing-through-toes",
        pose: "Heels lift 2 to 3 cm off the mat with the weight on the balls of the feet, knees drifting forward past the toes.",
      },
    ],
    backSafety: {
      status: "ok",
      note: "First-line glute work during flares, at hinge level 0. If arching bothers your back, lift to about three-quarters height.",
    },
    cues: ["Heels down.", "Ribs down.", "Squeeze.", "Lower slowly."],
    youtube: {
      tutorial: "glute bridge proper form physical therapist",
      mistakes: "glute bridge common mistakes",
    },
    sources: [
      "https://www.acefitness.org/resources/everyone/exercise-library/49/glute-bridge/",
      "https://www.acefitness.org/resources/everyone/exercise-library/145/glute-bridge-single-leg-progression/",
    ],
  },

  // ------------------------------------------------------- Squats and press
  {
    id: "leg-press",
    name: "Leg Press",
    summary:
      "The leg press has you push a weighted platform away with your legs while seated, building your thighs and glutes without any weight on your spine.",
    muscles: {
      primary: ["quadriceps", "glutes"],
      secondary: ["inner thighs", "hamstrings", "calves"],
    },
    equipment: "45-degree sled leg press or seated leg press machine",
    setup: [
      "Look for an angled sled on diagonal rails with safety handles beside the seat, or a seated machine with a weight stack.",
      "If the back pad adjusts, recline it a notch further to give your hips more room before your pelvis tucks.",
      "Place your feet in the middle of the plate, shoulder-width apart, toes turned out a little, whole foot flat.",
      "Set the safety stops at your depth limit, just before your tailbone starts to lift.",
      "On a seated machine, set the seat so your knees start bent to about 90 degrees.",
    ],
    steps: [
      "Sit back with your tailbone and lower back flat on the pad.",
      "Press the plate away and release the safety handles.",
      "Lower under control until your knees reach about 90 degrees, stopping before your tailbone lifts.",
      "Press through your whole foot to just short of straight.",
      "Keep your knees in line with your toes throughout.",
      "Lock the safety handles after your last rep.",
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 0 },
    breathing:
      "Brace all the way around your middle, front, sides and back, and keep breathing. Breathe in on the way down, and breathe out steadily as you press. Never hold your breath at the bottom. Straining on this machine can push your blood pressure very high.",
    feel: "You should feel your thighs and glutes working.",
    shouldNotFeel:
      "You should not feel your lower back peeling off the pad, sharp knee pain, or tingling in your legs. If you do, shorten your range, and if it continues, switch to a goblet squat to a box.",
    why: "It builds strong legs with no weight pressing down on your spine, so you can load your thighs safely. Strong legs make stairs, standing up and lifting easier.",
    mistakes: [
      {
        mistake: "Pelvis tucking at the bottom",
        risk: "Rounds your lower back under load and stresses the discs.",
        fix: "Stop just before your tailbone lifts, and set the safeties there.",
        clip: "leg-press.pelvis-tucks-at-bottom",
        pose: "At the bottom the sacrum lifts 2 to 5 cm off the pad and the lumbar spine flexes 15 to 25 degrees as the knees pass about 100 degrees of bend.",
      },
      {
        mistake: "Locking the knees",
        risk: "Puts sudden stress on your knee joints.",
        fix: "Stop with a slight bend at the top.",
        clip: "leg-press.locking-the-knees",
        pose: "Knees snap fully straight and hyperextend about 5 degrees at the top of each press.",
      },
      {
        mistake: "Knees caving in",
        risk: "Stresses your knees.",
        fix: "Keep your knees over your toes.",
        clip: "leg-press.knees-caving-in",
        pose: "Knees collapse inward 10 to 15 degrees into valgus as the press starts, feet flat on the plate.",
      },
    ],
    backSafety: {
      status: "modify",
      note: "Depth-limited from squat level 2: stop before your pelvis tucks, set the safety stops at that point, and finish each set with 2 or 3 reps left in the tank. With high blood pressure, stop 3 reps short and never strain or hold your breath. If seated bending provokes sciatica, shorten the range or switch to step-ups or a goblet squat to a box.",
      regression: "goblet-box-squat",
    },
    cues: [
      "Tailbone down.",
      "Knees over toes.",
      "Whole foot.",
      "Soft knees at the top.",
      "Breathe out as you press.",
    ],
    youtube: {
      tutorial: "leg press form physical therapist",
      mistakes: "leg press mistakes lower back rounding",
    },
    sources: [
      "https://exrx.net/WeightExercises/GluteusMaximus/SL45LegPress",
      "https://www.acefitness.org/resources/everyone/exercise-library/154/seated-leg-press/",
      "https://pubmed.ncbi.nlm.nih.gov/3980383/",
    ],
  },
  {
    id: "goblet-squat",
    name: "Goblet Squat",
    summary:
      "The goblet squat has you hold one weight at your chest and squat down and up, building your thighs and glutes while you stay upright.",
    muscles: {
      primary: ["quadriceps", "glutes"],
      secondary: ["inner thighs", "core", "upper back"],
    },
    equipment: "One dumbbell or kettlebell; optional box or bench about 45 centimetres high",
    setup: [
      "Hold one dumbbell upright, cupped under the top end, at your breastbone with your elbows tucked. A kettlebell held by the sides of its handle also works.",
      "Stand with your feet shoulder-width apart or a little wider, toes turned out slightly.",
      "For a depth target, set a box or bench about 45 centimetres high behind you.",
    ],
    steps: [
      "Hold the weight at your chest, elbows down.",
      "Brace, then sit down between your heels.",
      "Let your knees travel over your toes and keep your chest tall.",
      "Go as low as your back stays long, about thighs level with the floor.",
      "Pause, then drive up through your whole foot.",
    ],
    tempo: { lower: 3, pauseBottom: 1, lift: 2, pauseTop: 0 },
    breathing:
      "At the top, breathe in and brace all the way around your middle, front, sides and back. Keep breathing behind that brace on the way down. Breathe out steadily as you drive up through the hardest part. Never hold your breath.",
    feel: "You should feel your thighs and glutes working, and your upper back holding the weight.",
    shouldNotFeel:
      "You should not feel pain in your lower back, a pinch in your knee, or pain or tingling in your legs. If you do, stop and switch to the goblet box squat, at a height that feels easy.",
    why: "Holding the weight in front keeps you upright and the load on your spine light, so it is the preferred loaded squat with a back history. It builds the strength to stand up easily from chairs, the floor and the car.",
    mistakes: [
      {
        mistake: "Pelvis tucking at the bottom",
        risk: "Rounds your lower back under load and stresses the discs.",
        fix: "Stop just above that depth, or squat to a box.",
        clip: "goblet-squat.pelvis-tucks-at-bottom",
        pose: "In the last 10 cm of the descent the pelvis tucks under and the lumbar spine flexes 15 to 25 degrees, the low back rounding behind the weight.",
      },
      {
        mistake: "Knees caving in",
        risk: "Stresses your knees.",
        fix: "Spread the floor with your feet.",
        clip: "goblet-squat.knees-caving-in",
        pose: "Knees collapse inward 10 to 15 degrees into valgus on the way up out of the bottom.",
      },
      {
        mistake: "Chest dropping forward",
        risk: "The weight pulls you forward and strains your back.",
        fix: "Elbows down, chest tall.",
        clip: "goblet-squat.chest-drops",
        pose: "Torso tips past 45 degrees forward and the weight drifts 10 to 15 cm away from the chest, elbows flaring forward.",
      },
    ],
    backSafety: {
      status: "ok",
      note: "The preferred loaded squat with a back history, at squat level 2. It is light, front-loaded and upright. On irritable days, squat to a box 45 to 50 centimetres high.",
      regression: "goblet-box-squat",
    },
    cues: ["Elbows down.", "Knees out.", "Chest tall.", "Push the floor away."],
    youtube: {
      tutorial: "goblet squat technique physical therapist",
      mistakes: "goblet squat common mistakes",
    },
    sources: [
      "https://www.acefitness.org/resources/everyone/exercise-library/362/goblet-squat/",
      "https://exrx.net/WeightExercises/Kettlebell/KBGobletSquat",
    ],
  },
  {
    id: "goblet-box-squat",
    name: "Goblet Box Squat",
    summary:
      "The goblet box squat is a goblet squat down to a box behind you, which sets a safe depth so your lower back stays long.",
    muscles: {
      primary: ["quadriceps", "glutes"],
      secondary: ["inner thighs", "core", "upper back"],
    },
    equipment: "One dumbbell or kettlebell and a sturdy box or bench about 45 to 50 centimetres high",
    setup: [
      "Place a sturdy box or bench behind you, about 45 to 50 centimetres high, so it cannot slide.",
      "Pick a height you can reach without your pelvis tucking, and use a higher box on stiff days.",
      "Stand one short step in front of it, feet shoulder-width apart, toes turned out slightly.",
      "Hold one dumbbell upright at your breastbone with your elbows tucked.",
    ],
    steps: [
      "Brace, then sit back and down between your heels.",
      "Keep your chest tall and your knees over your toes.",
      "Touch the box lightly and pause, keeping your weight in your feet.",
      "Drive up through your whole foot to standing.",
      "Squeeze your glutes at the top.",
    ],
    tempo: { lower: 3, pauseBottom: 1, lift: 2, pauseTop: 0 },
    breathing:
      "At the top, breathe in and brace all the way around your middle, front, sides and back. Keep breathing behind that brace as you sit back. Breathe out steadily as you stand up. Never hold your breath.",
    feel: "You should feel your thighs and glutes working as you stand up from the box.",
    shouldNotFeel:
      "You should not feel pain in your lower back, knee pain, or pain or tingling in your legs. If you do, use a higher box, and if it continues, switch to box squats without the weight.",
    why: "The box gives you the same safe depth every rep, so you can build squat strength without your lower back rounding. It is also practice for sitting down and standing up from a chair with control.",
    mistakes: [
      {
        mistake: "Dropping onto the box",
        risk: "Jolts your spine and you lose your brace.",
        fix: "Lower for three seconds and touch down softly.",
        clip: "goblet-box-squat.dropping-onto-the-box",
        pose: "The last 15 to 20 cm of the descent happens in under half a second; the hips land hard on the box and the trunk jolts about 10 degrees forward.",
      },
      {
        mistake: "Relaxing and rocking on the box",
        risk: "Your back rounds as you rock forward to stand.",
        fix: "Keep your weight in your feet and your brace on.",
        clip: "goblet-box-squat.rocking-on-the-box",
        pose: "Seated on the box the trunk leans back 10 to 15 degrees with the lumbar spine flexed about 20 degrees and the feet unweighted, then the trunk rocks forward to stand.",
      },
      {
        mistake: "Box too low",
        risk: "Your pelvis tucks before you reach it, and your lower back rounds.",
        fix: "Raise the box until you can touch it with a long back.",
        clip: "goblet-box-squat.box-too-low",
        pose: "Box about 35 cm high; in the last 10 cm before the hips touch, the pelvis tucks and the lumbar spine flexes 15 to 25 degrees.",
      },
    ],
    backSafety: {
      status: "ok",
      note: "The preferred starting squat, at squat level 1. Set the box where your back stays long, and go higher on irritable days. Move on to the goblet squat once two sessions in a row feel easy and symptom-free.",
      regression: "box-squat",
    },
    cues: ["Sit back and down.", "Chest tall.", "Touch softly.", "Push the floor away."],
    youtube: {
      tutorial: "goblet box squat tutorial physical therapist",
      mistakes: "box squat mistakes dropping onto the box",
    },
    sources: [
      "https://www.acefitness.org/resources/everyone/exercise-library/362/goblet-squat/",
      "https://www.acefitness.org/resources/everyone/exercise-library/135/bodyweight-squat/",
      "https://pubmed.ncbi.nlm.nih.gov/22505136/",
    ],
  },
  {
    id: "barbell-squat",
    name: "Barbell Back Squat",
    summary:
      "The barbell back squat has you squat down and stand up with a barbell across your upper back, building strength in your thighs, glutes and trunk.",
    muscles: {
      primary: ["quadriceps", "glutes", "inner thighs"],
      secondary: ["hamstrings", "lower back muscles", "calves"],
    },
    equipment: "Barbell and plates in a power rack or squat stand with safety pins or straps",
    setup: [
      "Use a power rack or squat stand with adjustable hooks and safety pins or straps.",
      "Set the hooks between mid-chest and armpit height, so you lift the bar out with a slight knee bend.",
      "Set the safeties a few centimetres below the lowest point the bar will reach.",
      "Rest the bar on the muscle across the top of your shoulders, not your neck, with your hands just outside your shoulders.",
      "After two steps back, stand with your feet shoulder-width apart, toes turned out a little.",
    ],
    steps: [
      "Lift the bar out of the hooks and take two steps back.",
      "Breathe in, brace, and sit down between your heels.",
      "Lower until your thighs are about level with the floor, back long.",
      "Drive up with your chest and hips rising together.",
      "After your last rep, walk forward until the bar touches the uprights, then set it in the hooks.",
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 0 },
    breathing:
      "At the top, breathe in and brace all the way around your middle, front, sides and back. Keep breathing behind that brace on the way down. Breathe out slowly through pursed lips from the hardest part of the way up, and take a fresh breath at the top. Never hold your breath.",
    feel: "You should feel your thighs and glutes working while your trunk holds firm.",
    shouldNotFeel:
      "You should not feel pain in your lower back, knee pain, or pain or tingling in your legs. If you do, rack the bar and switch to the goblet squat.",
    why: "It is a classic strength builder for the whole lower body. It comes last in your plan because the bar presses down through your spine, so your back must first handle lighter squats well.",
    mistakes: [
      {
        mistake: "Pelvis tucking at the bottom",
        risk: "Rounds your lower back while the bar presses down on it.",
        fix: "Limit your depth or squat to a box.",
        clip: "barbell-squat.pelvis-tucks-at-bottom",
        pose: "At the bottom the pelvis tucks under and the lumbar spine flexes 20 to 30 degrees with the bar on the upper back.",
      },
      {
        mistake: "Hips rising first",
        risk: "Your lower back takes the load.",
        fix: "Chest and hips rise together.",
        clip: "barbell-squat.hips-rising-first",
        pose: "Out of the bottom the hips rise 10 to 15 cm before the chest moves and the torso tips 15 to 20 degrees further forward, a good-morning shape.",
      },
      {
        mistake: "Knees caving in",
        risk: "Stresses your knees.",
        fix: "Push your knees out over your toes.",
        clip: "barbell-squat.knees-caving-in",
        pose: "Knees collapse inward 10 to 15 degrees into valgus as you drive out of the bottom.",
      },
    ],
    backSafety: {
      status: "avoidWhenIrritable",
      note: "Squat level 4 only, the top of the spinal-loading ladder, because the bar presses down through your spine. Skip it while your back or leg is irritable and use the goblet squat or a depth-limited leg press. When calm, use a high bar position, a box at parallel and moderate loads, finishing with 2 or 3 reps left in the tank, or 3 with high blood pressure. Never test a maximum.",
      regression: "goblet-squat",
    },
    cues: ["Brace and keep breathing.", "Knees out.", "Chest up.", "Up together.", "Breathe out."],
    youtube: {
      tutorial: "back squat technique physical therapist",
      mistakes: "back squat common mistakes physical therapist",
    },
    sources: [
      "https://www.strongerbyscience.com/how-to-squat/",
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC4262933/",
      "https://pubmed.ncbi.nlm.nih.gov/33038028/",
    ],
  },

  // ------------------------------------------------------------- Single leg
  {
    id: "split-squat",
    name: "Split Squat",
    summary:
      "The split squat has you lower your back knee toward the floor and rise again from a fixed split stance while holding a support, building each leg in a steady position.",
    muscles: {
      primary: ["quadriceps", "glutes"],
      secondary: ["inner thighs", "hamstrings", "calves", "side hip muscles"],
    },
    equipment: "A rack, rail or wall to hold; optional dumbbells",
    setup: [
      "Stand beside a rack, rail or wall and hold it lightly with one hand.",
      "Step one foot forward about one long stride, so both knees can bend to about 90 degrees.",
      "Keep your feet hip-width apart side to side, like train tracks, not on a tightrope.",
      "Lift your back heel and balance on the ball of that foot.",
    ],
    steps: [
      "Hold the support lightly and brace.",
      "Lower straight down until your back knee is just above the floor.",
      "Keep your front knee over your middle toes and your chest tall.",
      "Drive through your front foot to rise.",
      "Stop just short of straight, then lower again.",
      "Finish the set, then switch legs.",
    ],
    tempo: { lower: 3, pauseBottom: 1, lift: 2, pauseTop: 0 },
    breathing:
      "Brace all the way around your middle, front, sides and back, and keep breathing. Breathe in as you lower, and breathe out as you rise. Never hold your breath.",
    feel: "You should feel the thigh and glute of your front leg, and a gentle stretch at the front of your back hip.",
    shouldNotFeel:
      "You should not feel pain in your lower back, knee pain, or tingling at the front of your thigh. If you do, lower less far, and if it continues, switch to bodyweight box squats.",
    why: "It builds strength in each leg from a steady stance, working your thighs and glutes about as hard as tougher single-leg exercises. Holding a support lets you focus on the leg instead of your balance.",
    mistakes: [
      {
        mistake: "Front knee caving in",
        risk: "Stresses your knee.",
        fix: "Keep your front knee over your middle toes.",
        clip: "split-squat.front-knee-caves",
        pose: "Front knee collapses inward 10 to 15 degrees into valgus at the bottom, front foot flat.",
      },
      {
        mistake: "Feet on a tightrope",
        risk: "Your pelvis twists and you lose balance.",
        fix: "Set your feet hip-width apart, like train tracks.",
        clip: "split-squat.tightrope-stance",
        pose: "Back foot placed directly behind the front foot on one line; the pelvis rotates about 10 degrees and the trunk sways 5 cm sideways at the bottom.",
      },
      {
        mistake: "Arching your lower back",
        risk: "Squeezes the joints of your lower back as the back hip stretches.",
        fix: "Ribs down, and squeeze the glute of your back leg.",
        clip: "split-squat.arched-lower-back",
        pose: "As the back knee lowers the pelvis tips 10 to 15 degrees forward, the lumbar spine extends about 15 degrees and the trunk leans 5 to 10 degrees back.",
      },
    ],
    backSafety: {
      status: "ok",
      note: "Low spinal load. The supported version is squat level 1 and the loaded version level 2. It is the go-to swap for lunges on irritable days. If the stretch at the front of the back hip brings on thigh tingling, shorten the depth.",
      regression: "box-squat",
    },
    cues: [
      "Straight down.",
      "Front knee over toes.",
      "Chest tall.",
      "Drive through the front heel.",
    ],
    youtube: {
      tutorial: "split squat tutorial physical therapist",
      mistakes: "split squat common mistakes",
    },
    sources: [
      "https://exrx.net/WeightExercises/Quadriceps/DBSplitSquat",
      "https://pubmed.ncbi.nlm.nih.gov/29870422/",
    ],
  },
  {
    id: "rear-foot-elevated-split-squat",
    name: "Rear-Foot-Elevated Split Squat",
    summary:
      "The rear-foot-elevated split squat, also called the Bulgarian split squat, raises your back foot on a bench so your front leg works hard, building strength and balance.",
    muscles: {
      primary: ["quadriceps", "glutes"],
      secondary: ["inner thighs", "hamstrings", "hip flexors of the back leg", "core"],
    },
    equipment: "Flat bench or box about knee height, or lower for a sensitive back; optional dumbbells",
    setup: [
      "Use a flat bench or box about knee height, 40 to 50 centimetres, or a lower one, about 30 centimetres, if your hips are tight or your back is sensitive.",
      "Rest the top of your back foot, laces down, on the bench.",
      "Place your front foot one long stride ahead, about 60 to 90 centimetres from the bench, so your front shin is roughly upright at the bottom.",
      "Keep your feet hip-width apart, not in one line.",
      "Hold dumbbells at your sides, or one at your chest.",
    ],
    steps: [
      "Brace with your ribs down and lean slightly forward.",
      "Lower straight down until your back knee is just above the floor.",
      "Keep your front knee over your middle toes.",
      "Drive through your front foot to stand.",
      "Finish the set, then switch legs.",
    ],
    tempo: { lower: 3, pauseBottom: 1, lift: 2, pauseTop: 0 },
    breathing:
      "Brace all the way around your middle, front, sides and back, and keep breathing. Breathe in on the way down, and breathe out on the way up. Never hold your breath.",
    feel: "You should feel the thigh and glute of your front leg, and a stretch at the front of your back hip.",
    shouldNotFeel:
      "You should not feel a pinch in your lower back, knee pain, or tingling at the front of your thigh. If you do, use a lower bench, and if it continues, switch to the split squat with your back foot on the floor.",
    why: "It builds a lot of leg and glute strength with little load on your spine, and it can build two-leg squat strength about as well as back squats. It also trains the balance you need on stairs and uneven ground.",
    mistakes: [
      {
        mistake: "Arching your lower back",
        risk: "Squeezes the joints of your lower back as the back hip stretches.",
        fix: "Use a lower bench, keep your ribs down and squeeze your back glute.",
        clip: "rear-foot-elevated-split-squat.arched-lower-back",
        pose: "As the back hip stretches the pelvis tips 10 to 15 degrees forward and the lumbar spine extends about 15 degrees, ribs flared.",
      },
      {
        mistake: "Front knee caving in",
        risk: "Stresses your knee.",
        fix: "Keep your front knee over your middle toes.",
        clip: "rear-foot-elevated-split-squat.front-knee-caves",
        pose: "Front knee collapses inward 10 to 15 degrees into valgus during the descent.",
      },
      {
        mistake: "Pushing off the back foot",
        risk: "Your back leg does the work and your front leg is under-trained.",
        fix: "Treat the back foot as a kickstand only.",
        clip: "rear-foot-elevated-split-squat.pushing-off-back-foot",
        pose: "Rear foot presses hard into the bench; the rear knee extends 20 to 30 degrees and the torso bounces up about 5 cm while the front knee barely changes angle.",
      },
    ],
    backSafety: {
      status: "modify",
      note: "Squat level 3. Spinal load is low, but the stretch at the front of the back hip can pull your lower back into an arch. If arching bothers your back or your balance is poor, use a lower bench and hold a rack. On irritable days, use the split squat with the back foot on the floor.",
      regression: "split-squat",
    },
    cues: ["Straight down.", "Knee over toes.", "Ribs down.", "Drive through the front heel."],
    youtube: {
      tutorial: "Bulgarian split squat setup physical therapist",
      mistakes: "Bulgarian split squat common mistakes",
    },
    sources: [
      "https://www.acefitness.org/resources/everyone/exercise-library/366/bulgarian-split-squat/",
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC8136570/",
      "https://pubmed.ncbi.nlm.nih.gov/26200193/",
    ],
  },
  {
    id: "step-up",
    name: "Step-Up",
    summary:
      "The step-up has you step onto a box with one leg and back down with control, building leg strength for stairs and hills.",
    muscles: {
      primary: ["quadriceps", "glutes"],
      secondary: ["hamstrings", "inner thighs", "side hip muscles", "calves"],
    },
    equipment: "Stable box, bench or step from mid-shin to knee height; optional dumbbells",
    setup: [
      "Use a stable box, bench or step that cannot slide.",
      "Start at mid-shin height, about 20 to 30 centimetres, and go no higher than your knee.",
      "Hold dumbbells at your sides, or hold a rail if your balance is unsteady.",
    ],
    steps: [
      "Place your whole foot on the box.",
      "Lean slightly forward over that foot.",
      "Drive through the heel of your top foot to stand up tall.",
      "Don't push off with your bottom foot.",
      "Step down slowly with the same trailing leg.",
    ],
    tempo: { lower: 2, pauseBottom: 0, lift: 2, pauseTop: 0 },
    breathing:
      "Brace gently all the way around your middle and keep breathing. Breathe out on the way up, and breathe in on the way down. Never hold your breath.",
    feel: "You should feel the thigh and glute of the leg on the box doing the work.",
    shouldNotFeel:
      "You should not feel knee pain or back pain. If you do, use a lower box, and if it continues, switch to the split squat holding a support.",
    why: "It trains exactly what you use on stairs, curbs and hills, one leg at a time, with very little load on your spine.",
    mistakes: [
      {
        mistake: "Pushing off the bottom leg",
        risk: "The working leg gets skipped.",
        fix: "Keep your bottom foot light, toes only.",
        clip: "step-up.pushing-off-bottom-leg",
        pose: "Trailing ankle plantarflexes hard and the body bounces up 5 to 8 cm before the lead knee starts to extend.",
      },
      {
        mistake: "Knee caving in",
        risk: "Stresses your knee.",
        fix: "Keep your knee over your middle toes.",
        clip: "step-up.knee-caves",
        pose: "Lead knee collapses inward 10 to 15 degrees into valgus as you drive up.",
      },
      {
        mistake: "Box too high",
        risk: "Your pelvis tucks and your knee strains.",
        fix: "Use a box at knee height or lower.",
        clip: "step-up.box-too-high",
        pose: "Box above knee height, so with the foot placed the thigh points 10 to 20 degrees above level, hip flexion passes 100 degrees, the pelvis tucks and the lumbar spine flexes about 15 degrees.",
      },
    ],
    backSafety: {
      status: "ok",
      note: "Low spinal load, at squat level 2. Keep the box at or below knee height. Hold a rail for balance, which also helps with numb feet from diabetes, and check your feet afterwards.",
      regression: "split-squat",
    },
    cues: [
      "Whole foot on the box.",
      "Drive through the heel.",
      "Tall at the top.",
      "Slow on the way down.",
    ],
    youtube: {
      tutorial: "dumbbell step up technique physical therapist",
      mistakes: "step up exercise common mistakes",
    },
    sources: [
      "https://exrx.net/WeightExercises/Quadriceps/DBStepUp",
      "https://www.acefitness.org/resources/everyone/exercise-library/28/step-up/",
    ],
  },
  {
    id: "reverse-lunge",
    name: "Reverse Lunge",
    summary:
      "The reverse lunge has you step one foot back and lower your back knee toward the floor, a knee-friendly lunge that builds your legs and glutes.",
    muscles: {
      primary: ["quadriceps", "glutes"],
      secondary: ["inner thighs", "hamstrings", "side hip muscles", "calves"],
    },
    equipment: "Bodyweight or dumbbells, clear floor space, and a rail or rack to hold if needed",
    setup: [
      "Find a clear patch of floor, next to a rail or rack if your balance is unsteady.",
      "Stand tall with your feet hip-width apart, weights at your sides if you use them.",
      "Shift most of your weight onto the foot that will stay in front.",
    ],
    steps: [
      "Step one foot back about a long stride, landing on the ball of that foot.",
      "Lower straight down until your back knee is just above the floor.",
      "Keep your front knee over your middle toes and your chest tall.",
      "Push through your front heel to stand and bring your back foot in.",
      "Finish the set on one side, then switch.",
    ],
    tempo: { lower: 2, pauseBottom: 0, lift: 2, pauseTop: 1 },
    breathing:
      "Brace gently all the way around your middle and keep breathing. Breathe in as you step back and lower, and breathe out as you push back up. Never hold your breath.",
    feel: "You should feel the thigh and glute of your front leg doing the work.",
    shouldNotFeel:
      "You should not feel knee pain, a pinch in your lower back, or tingling down your leg or at the front of your thigh. If you do, take a shorter step and lower less, and if it continues, switch to the split squat holding a support.",
    why: "Stepping back keeps your weight over the front foot, which is easier to balance and gentler on the front of your knee than a forward lunge. It builds the leg strength you need for stairs, getting up from the floor and catching your balance.",
    mistakes: [
      {
        mistake: "Stepping back too short",
        risk: "Your front heel lifts and your knee takes the strain.",
        fix: "Step back far enough that both knees bend to about 90 degrees.",
        clip: "reverse-lunge.step-too-short",
        pose: "Rear foot lands only 40 to 50 cm behind; the front heel lifts 2 to 3 cm and the front knee travels 10 cm or more past the toes.",
      },
      {
        mistake: "Front knee caving in",
        risk: "Stresses your knee.",
        fix: "Keep your front knee over your middle toes.",
        clip: "reverse-lunge.front-knee-caves",
        pose: "Front knee collapses inward 10 to 15 degrees into valgus as you push back up.",
      },
      {
        mistake: "Torso pitching forward",
        risk: "Shifts the load into your lower back.",
        fix: "Chest tall, ribs over hips.",
        clip: "reverse-lunge.torso-pitches-forward",
        pose: "At the bottom the trunk pitches 30 to 40 degrees forward and the lumbar spine flexes about 15 degrees, head and hands reaching toward the front foot.",
      },
    ],
    backSafety: {
      status: "ok",
      note: "Low spinal load, at squat level 2. Keep the step moderate and your trunk tall. Hold a rail if your balance is poor or your feet are numb, and check your feet afterwards. If stepping back provokes back or leg symptoms, use the split squat.",
      regression: "split-squat",
    },
    cues: [
      "Step back softly.",
      "Drop the back knee.",
      "Chest tall.",
      "Push through the front heel.",
    ],
    youtube: {
      tutorial: "reverse lunge technique physical therapist",
      mistakes: "reverse lunge common mistakes",
    },
    sources: [
      "https://www.acefitness.org/resources/everyone/exercise-library/319/reverse-lunge/",
      "https://exrx.net/WeightExercises/Quadriceps/DBRearLunge",
      "https://pubmed.ncbi.nlm.nih.gov/33310585/",
    ],
  },
  {
    id: "walking-lunges",
    name: "Walking Lunges",
    summary:
      "Walking lunges have you lunge forward step after step down a clear lane, building leg strength, balance and coordination.",
    muscles: {
      primary: ["quadriceps", "glutes"],
      secondary: ["inner thighs", "hamstrings", "side hip muscles", "calves", "core"],
    },
    equipment: "Dumbbells and a clear lane 10 to 15 metres long",
    setup: [
      "Clear a lane about 10 to 15 metres long.",
      "Hold dumbbells at your sides, or start without weights.",
      "Plan a long stride, about 70 to 90 centimetres heel to heel, so both knees bend to about 90 degrees.",
      "Keep your feet hip-width apart side to side, like train tracks.",
    ],
    steps: [
      "Stand tall with the weights at your sides.",
      "Step forward, landing heel first, then the rest of your foot.",
      "Lower until your back knee is just above the floor.",
      "Keep your front knee over your middle toes and your torso tall.",
      "Push through your front foot and step through into the next lunge.",
    ],
    tempo: { lower: 2, pauseBottom: 0, lift: 1, pauseTop: 0 },
    breathing:
      "Brace gently all the way around your middle and keep breathing. Breathe in as you lower, and breathe out as you rise and step through. Never hold your breath.",
    feel: "You should feel your thighs and glutes working.",
    shouldNotFeel:
      "You should not feel knee pain or lower back pain. If you do, shorten your stride, and if it continues, switch to the split squat holding a support.",
    why: "It builds leg strength while you move, training the balance and control you need for brisk walking, climbing and changing direction.",
    mistakes: [
      {
        mistake: "Walking a tightrope",
        risk: "Your pelvis twists and you lose balance.",
        fix: "Keep your feet hip-width apart, like train tracks.",
        clip: "walking-lunges.tightrope-stance",
        pose: "Each foot lands directly in front of the other on one line; the pelvis rotates about 10 degrees and the trunk sways 5 cm sideways.",
      },
      {
        mistake: "Back knee slamming down",
        risk: "Bruises your kneecap.",
        fix: "Stop 3 to 5 centimetres above the floor.",
        clip: "walking-lunges.back-knee-slams",
        pose: "Rear knee strikes the floor hard at the bottom of each step.",
      },
      {
        mistake: "Torso pitching forward",
        risk: "Strains your back.",
        fix: "Tall chest, ribs down.",
        clip: "walking-lunges.torso-pitches-forward",
        pose: "Trunk leans about 30 degrees forward at the bottom of each step, head down and the lumbar spine flexing about 10 degrees.",
      },
    ],
    backSafety: {
      status: "modify",
      note: "Squat level 3, because it adds moving balance to the load. Shorten the stride if long steps provoke back or leg symptoms. Use the split squat with support on irritable days or if your balance is poor. With diabetes, check your feet afterwards.",
      regression: "split-squat",
    },
    cues: [
      "Feet on train tracks.",
      "Drop the back knee.",
      "Tall chest.",
      "Push through the front heel.",
    ],
    youtube: {
      tutorial: "walking lunge technique physical therapist",
      mistakes: "walking lunge common mistakes",
    },
    sources: [
      "https://exrx.net/WeightExercises/Quadriceps/DBWalkingLunge",
      "https://www.acefitness.org/resources/everyone/exercise-library/363/lunge/",
    ],
  },

  // -------------------------------------------------- Hamstrings and calves
  {
    id: "hamstring-curl",
    name: "Seated Leg Curl",
    summary:
      "The seated leg curl has you curl your heels down and under you against a padded roller while seated, strengthening the backs of your thighs.",
    muscles: {
      primary: ["hamstrings"],
      secondary: ["calves"],
    },
    equipment: "Seated leg curl machine",
    setup: [
      "Find the seated leg curl, an upright seat with a back pad, a thigh pad and a roller under your lower legs.",
      "Slide the back pad until your knee joint lines up with the machine's pivot, often marked with a coloured dot.",
      "Rest the roller on your lower calves, just above your ankles.",
      "Lower the thigh pad until it sits snugly just above your knees.",
      "With sciatica, set the range limiter so your knees start bent about 30 degrees, and recline the back pad.",
    ],
    steps: [
      "Sit tall with your back against the pad and grip the handles.",
      "Brace gently and keep your hips down.",
      "Curl your heels down and back toward the seat.",
      "Pause and squeeze for one second.",
      "Lower slowly until your knees are almost straight.",
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 1, pauseTop: 1 },
    breathing:
      "Brace gently all the way around your middle and keep breathing. Breathe out as you curl, and breathe in as you let the roller return. Never hold your breath.",
    feel: "You should feel the backs of your thighs working.",
    shouldNotFeel:
      "You should not feel cramping behind your knee, or tingling or pain travelling down your leg. If you feel leg symptoms, stop and switch to the lying leg curl.",
    why: "Strong hamstrings support your knees and hips and share the work of bending and lifting. Training them seated, with the hips bent, builds more muscle than the lying version.",
    mistakes: [
      {
        mistake: "Knee not lined up with the pivot",
        risk: "Shears your knee joint and the roller slides.",
        fix: "Adjust the back pad until your knee lines up with the dot.",
        clip: "hamstring-curl.knee-off-pivot",
        pose: "Knee joint sits about 5 cm in front of the machine pivot, so the roller slides up the calf as the leg curls.",
      },
      {
        mistake: "Swinging the weight",
        risk: "Strains your hamstrings.",
        fix: "Curl smoothly and lower for three seconds.",
        clip: "hamstring-curl.swinging",
        pose: "Weight jerked through the first 45 degrees of the curl in under half a second while the torso rocks 10 to 15 degrees back from the pad and then forward.",
      },
      {
        mistake: "Slumping forward in the seat",
        risk: "Rounds your back and adds tension to the sciatic nerve.",
        fix: "Sit tall with your back against the pad.",
        clip: "hamstring-curl.slumping",
        pose: "Trunk leans 15 to 20 degrees forward off the back pad with the lumbar and thoracic spine flexed 20 to 30 degrees and the chin dropped, knees nearly straight at the start of the rep.",
      },
    ],
    backSafety: {
      status: "modify",
      note: "The seated start, hips bent with knees straight, tensions the sciatic nerve. Use it once sciatica is quiet, with the range limiter set so your knees start bent about 30 degrees and the back pad reclined. With active sciatica, use the lying leg curl.",
      regression: "lying-leg-curl",
    },
    cues: ["Sit tall.", "Curl.", "Squeeze.", "Slow on the way back."],
    youtube: {
      tutorial: "seated leg curl machine setup physical therapist",
      mistakes: "seated leg curl common mistakes",
    },
    sources: [
      "https://exrx.net/WeightExercises/Hamstrings/LVSeatedLegCurl",
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC7969179/",
    ],
  },
  {
    id: "lying-leg-curl",
    name: "Lying Leg Curl",
    summary:
      "The lying leg curl has you lie face down and curl your heels toward your bottom, strengthening the backs of your thighs while your hips stay straight.",
    muscles: {
      primary: ["hamstrings"],
      secondary: ["calves"],
    },
    equipment: "Lying leg curl machine, a face-down bench with a hump under the hips and an ankle roller",
    setup: [
      "Find the lying leg curl, a face-down bench with a hump under the hips and a roller at the foot end.",
      "Lie face down with your knees just off the edge of the bench, in line with the machine's pivot.",
      "Set the roller on the lower part of your calves, above your ankles, not on your heels.",
      "Rest your hips on the hump and lightly grip the handles.",
    ],
    steps: [
      "Brace gently and press your hips into the pad.",
      "Curl your heels toward your bottom.",
      "Keep your hips down and your back still.",
      "Pause for one second near the top.",
      "Lower slowly until your knees are almost straight.",
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 1, pauseTop: 1 },
    breathing:
      "Brace gently all the way around your middle and keep breathing. Breathe out as you curl, and breathe in as you lower. Never hold your breath.",
    feel: "You should feel the backs of your thighs working while your hips stay on the pad.",
    shouldNotFeel:
      "You should not feel your lower back arching or aching, cramping behind your knee, or tingling down your leg or at the front of your thigh. If you do, lighten the weight and shorten the curl, and if it continues, switch to the glute bridge.",
    why: "It strengthens your hamstrings while your hips stay straight, which keeps tension off the sciatic nerve. That makes it the preferred hamstring exercise while sciatica is active.",
    mistakes: [
      {
        mistake: "Hips lifting off the pad",
        risk: "Arches your lower back under load.",
        fix: "Lighten the weight and keep your hips pinned.",
        clip: "lying-leg-curl.hips-lifting",
        pose: "Hips rise 5 to 10 cm off the pad and the lumbar spine extends 10 to 20 degrees as the heels curl past 60 degrees of knee bend.",
      },
      {
        mistake: "Swinging the weight up",
        risk: "Strains your hamstrings and jolts your back.",
        fix: "Curl smoothly and lower for three seconds.",
        clip: "lying-leg-curl.swinging",
        pose: "Heels whipped up through 90 degrees in under half a second, the roller bouncing off the stop and the hips jolting up about 3 cm.",
      },
      {
        mistake: "Knees off the pivot",
        risk: "Shears your knees, and the roller slides.",
        fix: "Line your knees up with the pivot, just off the bench edge.",
        clip: "lying-leg-curl.knees-off-pivot",
        pose: "Knees rest 5 to 8 cm up on the bench, behind the pivot, so the roller slides toward the heels as the legs curl.",
      },
    ],
    backSafety: {
      status: "ok",
      note: "The preferred knee-bending exercise while sciatica is active, because the hips stay straight. Keep your hips pinned to protect your lower back, and use a lighter load if lying face down bothers your back. If the curl brings on tingling at the front of your thigh, shorten the range.",
      regression: "glute-bridge",
    },
    cues: ["Hips down.", "Curl.", "Squeeze.", "Slow on the way down."],
    youtube: {
      tutorial: "lying leg curl machine proper form",
      mistakes: "lying leg curl mistakes hips lifting",
    },
    sources: [
      "https://www.acefitness.org/resources/everyone/exercise-library/153/lying-hamstrings-curl/",
      "https://exrx.net/WeightExercises/Hamstrings/LVLyingLegCurl",
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC7969179/",
    ],
  },
  {
    id: "calf-raises",
    name: "Standing Calf Raise",
    summary:
      "The standing calf raise has you lower your heels below a step and rise high onto the balls of your feet, strengthening your calves.",
    muscles: {
      primary: ["calves"],
      secondary: ["lower calves", "ankle stabilisers"],
    },
    equipment: "Standing calf raise machine, or a step and a rail",
    setup: [
      "On a standing calf machine, set the shoulder pads just below your shoulders with your heels fully lowered, then stand up into them with soft, straight knees.",
      "Without a machine, stand on a step and hold a rail, which keeps weight off your spine.",
      "Put the balls of your feet on the edge with your heels free.",
    ],
    steps: [
      "Put the balls of your feet on the edge, heels hanging.",
      "Keep your knees straight but soft and stand tall.",
      "Lower your heels slowly into a stretch and pause for two seconds.",
      "Rise as high as you can onto your big toes.",
      "Squeeze for a second, then lower slowly.",
    ],
    tempo: { lower: 2, pauseBottom: 2, lift: 1, pauseTop: 1 },
    breathing:
      "Stand tall, brace gently all the way around your middle and keep breathing steadily. Breathe out on the way up, and breathe in as you lower. Never hold your breath.",
    feel: "You should feel your calves working and stretching.",
    shouldNotFeel:
      "You should not feel pain in your Achilles tendon, cramping in your foot, or pressure through your spine from the shoulder pads. If the machine presses on your back, switch to the seated calf raise.",
    why: "Strong calves push you forward with every step, help your balance and take strain off your knees. Full-range raises also keep your ankles mobile.",
    mistakes: [
      {
        mistake: "Bouncing at the bottom",
        risk: "Stresses your Achilles tendon, and your calves do less.",
        fix: "Pause for two seconds in the stretch.",
        clip: "calf-raises.bouncing",
        pose: "Heels drop into the stretch and rebound immediately with no pause, the ankle snapping from about 15 degrees of dorsiflexion straight into the rise.",
      },
      {
        mistake: "Half reps",
        risk: "Your calves miss the full range.",
        fix: "Full stretch at the bottom, full rise at the top.",
        clip: "calf-raises.half-reps",
        pose: "Heels never drop below the step and rise only halfway, so the ankle moves through about 15 degrees instead of 40 to 50.",
      },
      {
        mistake: "Rolling onto your little toes",
        risk: "Strains the outside of your ankle.",
        fix: "Press through your big toe.",
        clip: "calf-raises.rolling-out",
        pose: "At the top the ankles invert 10 to 15 degrees and the weight shifts onto the little toes.",
      },
    ],
    backSafety: {
      status: "modify",
      note: "The standing calf machine and barbell versions press down through your spine. Skip them while your back is irritable and use the seated calf raise, single-leg raises on a step, or a calf press on the leg press. With numb feet from diabetes, keep shoes on, hold a support and check your feet afterwards.",
      regression: "seated-calf-raise",
    },
    cues: [
      "Pause in the stretch.",
      "Up onto your big toe.",
      "Squeeze.",
      "Slow on the way down.",
    ],
    youtube: {
      tutorial: "standing calf raise proper form physical therapist",
      mistakes: "calf raise mistakes bouncing",
    },
    sources: [
      "https://exrx.net/WeightExercises/Gastrocnemius/LVStandingCalfRaise",
      "https://www.acefitness.org/resources/everyone/exercise-library/294/calf-raise/",
    ],
  },
  {
    id: "seated-calf-raise",
    name: "Seated Calf Raise",
    summary:
      "The seated calf raise has you raise and lower your heels with a padded lever across your thighs, strengthening your lower calves with no load on your spine.",
    muscles: {
      primary: ["lower calves"],
      secondary: ["calves"],
    },
    equipment: "Seated calf raise machine, or a bench with dumbbells resting on the knees",
    setup: [
      "Find the seated calf machine, a low seat with a padded lever over your thighs, a foot platform and a safety lever.",
      "Set the pad so it sits snugly on your lower thighs, just above your knees.",
      "Place the balls of your feet on the platform edge with your heels free.",
      "Without a machine, sit on a bench with dumbbells on your knees and the balls of your feet on a plate.",
    ],
    steps: [
      "Lift your heels slightly and release the safety lever.",
      "Lower your heels into a deep stretch.",
      "Pause for two seconds.",
      "Push up as high as you can and squeeze.",
      "Lock the safety lever after your last rep.",
    ],
    tempo: { lower: 2, pauseBottom: 2, lift: 1, pauseTop: 1 },
    breathing:
      "Sit tall, brace gently all the way around your middle and keep breathing steadily. Breathe out as you push up, and breathe in as you lower. Never hold your breath.",
    feel: "You should feel your lower calves working, down toward your Achilles.",
    shouldNotFeel:
      "You should not feel pain in your Achilles tendon or the pad pressing on your kneecaps. If your Achilles hurts, stop the set. If the pad presses on your knees, slide it a little further up your thighs.",
    why: "It strengthens the deep calf muscle that keeps you steady when you walk and stand, with no weight on your spine. It is the preferred calf exercise while your back is sensitive.",
    mistakes: [
      {
        mistake: "Bouncing at the bottom",
        risk: "Strains your Achilles tendon.",
        fix: "Pause for two seconds in the stretch.",
        clip: "seated-calf-raise.bouncing",
        pose: "Heels drop into the stretch and rebound instantly with no pause at the bottom.",
      },
      {
        mistake: "Half reps",
        risk: "Your calves miss the full range.",
        fix: "Let your heels sink into a full stretch.",
        clip: "seated-calf-raise.half-reps",
        pose: "Heels stay level with the platform, so the ankle moves through only about 20 degrees.",
      },
      {
        mistake: "Pushing with your hands",
        risk: "Your calves do less of the work.",
        fix: "Rest your hands lightly on the pad.",
        clip: "seated-calf-raise.pushing-with-hands",
        pose: "Hands press down and pull up on the lever pad each rep, elbows bending 30 to 40 degrees.",
      },
    ],
    backSafety: {
      status: "ok",
      note: "No spinal load, so it is the preferred calf exercise while the back is irritable.",
    },
    cues: ["Deep stretch.", "Pause.", "All the way up.", "Slow on the way down."],
    youtube: {
      tutorial: "seated calf raise machine proper form",
      mistakes: "seated calf raise common mistakes",
    },
    sources: ["https://exrx.net/WeightExercises/Soleus/LVSeatedCalfRaise"],
  },
  {
    id: "single-leg-calf-raise",
    name: "Single-Leg Calf Raise",
    summary:
      "The single-leg calf raise has you rise up and down on one foot on a step while holding a rail, strengthening each calf with your body weight.",
    muscles: {
      primary: ["calves"],
      secondary: ["lower calves", "side hip muscles", "ankle stabilisers"],
    },
    equipment: "A sturdy step beside a rail, wall or rack; optional dumbbell",
    setup: [
      "Stand on a sturdy step that cannot tip, beside a rail or wall.",
      "Hold the rail with one or both hands for balance.",
      "Place the ball of your working foot on the edge with the heel free, and bend your other knee to lift that foot behind you.",
      "To add load later, hold a dumbbell in the hand on your working side.",
    ],
    steps: [
      "Stand tall on the ball of your foot, knee straight but soft.",
      "Lower your heel slowly below the step into a stretch.",
      "Pause for one second.",
      "Rise as high as you can onto your big toe.",
      "Lower slowly. Finish the set, then switch legs.",
    ],
    tempo: { lower: 2, pauseBottom: 1, lift: 1, pauseTop: 1 },
    breathing:
      "Stand tall, brace gently all the way around your middle and keep breathing steadily. Breathe out as you rise, and breathe in as you lower. Never hold your breath.",
    feel: "You should feel your calf working, with a stretch at the bottom.",
    shouldNotFeel:
      "You should not feel pain in your Achilles tendon, cramping in your foot, or tingling in your sole or the outside of your foot. If you do, stop and switch to the seated calf raise.",
    why: "Working one leg at a time builds the calf strength you need for walking, stairs and balance, with no weight on your spine. It also shows whether one side is weaker.",
    mistakes: [
      {
        mistake: "Bouncing out of the stretch",
        risk: "Stresses your Achilles tendon, and your calf does less.",
        fix: "Pause for a second at the bottom.",
        clip: "single-leg-calf-raise.bouncing",
        pose: "Heel drops below the step and rebounds instantly with no pause, the knee flicking 15 to 20 degrees to help the rise.",
      },
      {
        mistake: "Leaning on the rail",
        risk: "Your arms take the load, and your calf misses the work.",
        fix: "Hold the rail for balance only, with a light grip.",
        clip: "single-leg-calf-raise.leaning-on-rail",
        pose: "Body leans 10 to 15 degrees toward the rail and the supporting arm pulls, elbow bending 30 to 40 degrees as the heel rises.",
      },
      {
        mistake: "Rolling onto your little toes",
        risk: "Strains the outside of your ankle.",
        fix: "Press through your big toe.",
        clip: "single-leg-calf-raise.rolling-out",
        pose: "At the top the ankle inverts 10 to 15 degrees and the weight shifts onto the little toes.",
      },
    ],
    backSafety: {
      status: "ok",
      note: "No spinal load. Keep shoes on and hold a support, especially with numb feet from diabetes, and check your feet afterwards. If one calf is clearly weaker, or your sole or outer foot tingles, tell your clinician, as it can be a sign of nerve irritation.",
      regression: "seated-calf-raise",
    },
    cues: [
      "Pause in the stretch.",
      "Up onto your big toe.",
      "Light hand on the rail.",
      "Slow on the way down.",
    ],
    youtube: {
      tutorial: "single leg calf raise on step physical therapist",
      mistakes: "single leg calf raise common mistakes",
    },
    sources: [
      "https://exrx.net/WeightExercises/Gastrocnemius/BWSingleLegCalfRaise",
      "https://www.acefitness.org/resources/everyone/exercise-library/73/standing-calf-raises-wall/",
      "https://pmc.ncbi.nlm.nih.gov/articles/PMC6908414/",
    ],
  },
];
