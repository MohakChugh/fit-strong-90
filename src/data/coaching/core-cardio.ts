import type { Coaching } from '@/types/catalog';

/**
 * Coaching for the core exercises and the six cardio modalities. Drafted from
 * docs/research/technique-lower-body-core.md §7–9, technique-mobility-cardio.md
 * §13 and program-design.md §4 (spec §4.3, §4.4, Appendix A). cable-chop was
 * researched separately (ACE, Voight 2008, Fujii 2007). Spoken fields are
 * written for text-to-speech: plain words, no symbols or parentheses.
 * Tempo: `lift` is the working phase and `pauseTop` the hold at its end;
 * `lower` is the return and `pauseBottom` the reset before the next rep.
 * Cardio uses the spec's zone 2 block: 2 min easy, 9 min at effort 3 to 4, 1 min easy.
 */
export const CORE_CARDIO_COACHING: Coaching[] = [
  // ─── Core: stability ──────────────────────────────────────────────────────
  {
    id: 'plank',
    name: 'Plank',
    summary: 'A forearm hold that trains your trunk to keep your spine straight and steady.',
    muscles: {
      primary: ['Abs', 'Deep core muscles', 'Obliques'],
      secondary: ['Glutes', 'Thighs', 'Shoulders'],
    },
    equipment: 'Exercise mat',
    setup: [
      'Use an exercise mat on a clear patch of floor.',
      'Place your forearms on the mat, shoulder width apart, with your elbows right under your shoulders.',
      'Set your feet hip width apart with your toes tucked under.',
      'For an easier version, keep your knees down or rest your forearms on a bench.',
    ],
    steps: [
      'Set your elbows under your shoulders, forearms flat on the mat.',
      'Step your feet back and tuck your toes under.',
      'Squeeze your glutes and thighs, and draw your ribs down.',
      'Lift into one straight line from your head to your heels.',
      'Hold for 10 seconds and keep breathing.',
      'Lower your knees and rest for a few seconds, then lift again.',
    ],
    dosage: { holdSeconds: 10, sets: 2, reps: 3, sides: 'none' },
    breathing:
      'Brace your trunk gently, then keep breathing behind the brace. Take short breaths out through pursed lips. Counting your breaths out loud helps. Never hold your breath.',
    feel: 'You should feel your abs, the fronts of your shoulders and your glutes working.',
    shouldNotFeel:
      'You should not feel an ache or pinch in your lower back, or pain in your shoulders. If you do, drop to your knees, shorten the hold, or rest your forearms on a bench. Stop if pain spreads into your leg.',
    why: 'A strong, steady trunk shares the load with your back when you lift and carry. Short holds with steady breathing build that endurance without straining your back or pushing up your blood pressure.',
    mistakes: [
      {
        mistake: 'Hips sagging',
        risk: 'Your lower back arches and the small joints at the back of your spine get squeezed.',
        fix: 'Squeeze your glutes, tuck your tailbone slightly and shorten the hold.',
        clip: 'plank.hips-sag',
        pose: 'Pelvis drops 5 to 10 cm below the head-to-heel line and the lumbar spine extends about 15 to 20 degrees; forearms and toes stay in place.',
      },
      {
        mistake: 'Hips piked up',
        risk: 'Your abs switch off and your shoulders take over the work.',
        fix: 'Lower your hips until your body makes one straight line.',
        clip: 'plank.hips-pike',
        pose: 'Hips rise 10 to 20 cm above the head-to-heel line, with the hips flexed about 30 to 40 degrees; forearms and toes unchanged.',
      },
      {
        mistake: 'Head dropping',
        risk: 'It strains your neck.',
        fix: 'Look at the floor just ahead of your hands.',
        clip: 'plank.head-drop',
        pose: 'Neck flexes about 20 to 30 degrees so the chin tucks toward the chest and the eyes look back toward the feet; the rest of the body stays in a straight line.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Suitable as written. If your hips sag or arching bothers your back, plank from your knees or with your forearms on a bench, or use the dead bug instead.',
      regression: 'dead-bug',
    },
    cues: ['Straight line, head to heels', 'Squeeze your glutes', 'Ribs down', 'Keep breathing'],
    youtube: {
      tutorial: 'forearm plank proper form physical therapist',
      mistakes: 'plank form common mistakes physical therapist',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/32/front-plank/',
      'https://pubmed.ncbi.nlm.nih.gov/25325773/',
      'https://pubmed.ncbi.nlm.nih.gov/19154838/',
    ],
  },
  {
    id: 'side-plank',
    name: 'Side Plank',
    summary: 'A hold on your side that strengthens the muscles that keep your spine steady from side to side.',
    muscles: {
      primary: ['Obliques', 'Deep side muscles of the lower back', 'Deep core muscles'],
      secondary: ['Side hip muscles', 'Shoulder stabilisers'],
    },
    equipment: 'Exercise mat',
    setup: [
      'Use an exercise mat and lie on your side.',
      'Place your elbow directly under your shoulder, with your forearm on the mat in front of you.',
      'Bend your knees to 90 degrees for the easier version, or straighten your legs with your top foot in front of your bottom foot.',
      'Rest your top hand on your hip.',
    ],
    steps: [
      'Lie on your side with your elbow under your shoulder.',
      'Bend your knees, or straighten your legs with the top foot in front.',
      'Brace gently and breathe out as you lift your hips off the mat.',
      'Make a straight line from your head to your knees or feet.',
      'Hold for 10 seconds, breathing steadily.',
      'Lower your hips to rest, and switch sides after your reps.',
    ],
    dosage: { holdSeconds: 10, sets: 2, reps: 3, sides: 'each' },
    breathing:
      'Breathe out as you lift your hips. Then keep a gentle brace and breathe steadily through the hold. Never hold your breath.',
    feel: 'You should feel the side of your waist and hip on the bottom side.',
    shouldNotFeel:
      'You should not feel shoulder pain or a pinch in your lower back. If you do, drop to your knees or shorten the hold. Stop if pain spreads into your leg.',
    why: 'It trains the muscles that hold your spine steady from side to side, while putting very little load on your back. It is one of the most back friendly core exercises you can do.',
    mistakes: [
      {
        mistake: 'Hips sagging',
        risk: 'Your spine bends sideways and the low side gets squeezed.',
        fix: 'Lift your hips back into line and shorten the hold.',
        clip: 'side-plank.hips-sag',
        pose: 'Bottom hip drops 5 to 10 cm toward the mat and the trunk side-bends about 10 to 15 degrees toward the floor; elbow and feet stay put.',
      },
      {
        mistake: 'Rolling forward',
        risk: 'Your spine twists and your side muscles miss the work.',
        fix: 'Stack your top hip right over your bottom hip.',
        clip: 'side-plank.rolling-forward',
        pose: 'Pelvis and ribcage rotate about 15 to 20 degrees toward the floor, so the top hip sits ahead of the bottom hip and the top shoulder rolls forward.',
      },
      {
        mistake: 'Elbow out of place',
        risk: 'It strains the shoulder you are leaning on.',
        fix: 'Place your elbow right under your shoulder and push the floor away.',
        clip: 'side-plank.elbow-misplaced',
        pose: 'Supporting elbow sits 5 to 10 cm in front of the shoulder, so the upper arm angles about 20 degrees off vertical and the shoulder sinks toward the ear.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Suitable as written. Start from your knees, and stay on your knees on irritable days. If it still bothers you, use the dead bug instead.',
      regression: 'dead-bug',
    },
    cues: ['Elbow under your shoulder', 'Hips high', 'Stack your hips', 'Breathe steadily'],
    youtube: {
      tutorial: 'McGill side bridge progression',
      mistakes: 'side plank common mistakes physical therapist',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/100/side-plank-modified/',
      'https://pubmed.ncbi.nlm.nih.gov/19154838/',
      'https://pubmed.ncbi.nlm.nih.gov/9502361/',
    ],
  },
  {
    id: 'mcgill-curl-up',
    name: 'McGill Curl-Up',
    summary: 'A small, gentle curl that works your abs while your lower back keeps its natural curve.',
    muscles: {
      primary: ['Front abs'],
      secondary: ['Obliques', 'Deep core muscles'],
    },
    equipment: 'Exercise mat',
    setup: [
      'Use an exercise mat and lie on your back.',
      'Bend one knee with that foot flat, and keep the other leg straight.',
      'Slide both hands, palms down, under the small of your back to support its natural curve.',
      'Keep your elbows on the mat to start, and lift them only when it feels easy.',
    ],
    steps: [
      'Lie on your back with one knee bent and one leg straight.',
      'Slide your hands under your lower back and keep its gentle arch.',
      'Brace your abs gently.',
      'Lift your head and shoulders just a few centimetres off the mat.',
      'Keep your head and neck still, moving as one unit.',
      'Hold for 10 seconds, breathing the whole time, then lower slowly.',
      'Switch the bent leg for each new round.',
    ],
    tempo: { lower: 2, pauseBottom: 3, lift: 2, pauseTop: 10 },
    dosage: { holdSeconds: 10, sets: 3, reps: 4, sides: 'none' },
    breathing:
      'Keep a gentle brace and breathe slowly and steadily through every hold. Never hold your breath. If your face starts to feel hot or flushed, lower down and rest.',
    feel: 'You should feel your upper abs working.',
    shouldNotFeel:
      'You should not feel strain in your neck or pain in your lower back. If your neck works hard, keep your elbows down and lift a little less. Stop if pain spreads into your leg.',
    why: 'It was designed for back rehabilitation and works your abs with far less load on your spine than a sit up. Your lower back stays in its natural position the whole time.',
    mistakes: [
      {
        mistake: 'Flattening the lower back',
        risk: 'You lose the natural curve the exercise is meant to protect.',
        fix: 'Keep a small arch over your hands.',
        clip: 'mcgill-curl-up.flat-back',
        pose: 'Pelvis tucks into about 10 degrees of posterior tilt and the lumbar spine flexes about 10 to 15 degrees, pressing flat onto the hands.',
      },
      {
        mistake: 'Chin to chest',
        risk: 'It strains your neck.',
        fix: 'Keep your head and neck as one unit, eyes on the ceiling.',
        clip: 'mcgill-curl-up.chin-to-chest',
        pose: 'Neck flexes about 30 to 45 degrees so the chin nearly touches the chest, while the shoulder blades stay on the mat.',
      },
      {
        mistake: 'Sitting up too high',
        risk: 'It turns into a sit up, which bends your lower back and pulls on your hip flexors.',
        fix: 'Lift only until your shoulder blades just clear the mat.',
        clip: 'mcgill-curl-up.too-high',
        pose: 'Trunk rises 30 to 45 degrees off the mat, with the lumbar spine lifting off the hands and flexing about 20 degrees.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Designed for back rehabilitation and suitable as written. On irritable days, keep your elbows down and lift only your head.',
    },
    cues: ['Head and neck still', 'Just off the mat', 'Keep the small arch', 'Keep breathing'],
    youtube: {
      tutorial: 'McGill curl up big 3 technique',
      mistakes: 'McGill curl up common mistakes',
    },
    sources: [
      'https://pubmed.ncbi.nlm.nih.gov/19154838/',
      'https://pubmed.ncbi.nlm.nih.gov/9219209/',
      'https://pubmed.ncbi.nlm.nih.gov/9502361/',
    ],
  },
  {
    id: 'bird-dog',
    name: 'Bird Dog',
    summary: 'On your hands and knees, you reach one arm and the opposite leg long while your back stays still like a table.',
    muscles: {
      primary: ['Back muscles', 'Glutes'],
      secondary: ['Obliques', 'Shoulders'],
    },
    equipment: 'Exercise mat',
    setup: [
      'Use an exercise mat, with a folded towel under your knees if they are sensitive.',
      'Kneel on all fours with your hands under your shoulders and your knees under your hips.',
      'Set your back flat like a table, with your neck long.',
    ],
    steps: [
      'Start on all fours, hands under your shoulders, knees under your hips.',
      'Brace gently so your back stays flat.',
      'Reach one arm forward and the opposite leg back.',
      'Stop when your arm and leg reach shoulder and hip height, no higher.',
      'Make a fist, push your heel back, and hold for 10 seconds while you breathe.',
      'Return slowly, then switch to the other arm and leg.',
    ],
    dosage: { holdSeconds: 10, sets: 2, reps: 3, sides: 'each' },
    breathing:
      'Keep a gentle brace and breathe slowly and steadily through each hold. Never hold your breath.',
    feel: 'You should feel the glute of your raised leg, the muscles along your spine and your shoulder.',
    shouldNotFeel:
      'You should not feel a pinch in your lower back. If you do, lower your leg a little, or move only your arm or only your leg. Stop if pain spreads into your leg.',
    why: 'It trains the muscles that hold your spine steady while your arms and legs move, with very low load on your back. That steadiness protects your back in everyday movement.',
    mistakes: [
      {
        mistake: 'Lifting the leg too high',
        risk: 'Your lower back arches and gets pinched.',
        fix: 'Stop your foot at hip height.',
        clip: 'bird-dog.leg-too-high',
        pose: 'Raised leg lifts 15 to 20 degrees above horizontal at the hip and the lumbar spine extends about 10 to 15 degrees into an arch.',
      },
      {
        mistake: 'Hips rotating',
        risk: 'Your spine twists instead of staying still.',
        fix: 'Keep both hips level, as if balancing a cup on your lower back.',
        clip: 'bird-dog.hip-rotation',
        pose: 'Pelvis rotates 10 to 20 degrees as the hip of the raised leg opens toward the ceiling and the raised foot turns out.',
      },
      {
        mistake: 'Head lifting',
        risk: 'It strains your neck.',
        fix: 'Look at the floor between your hands.',
        clip: 'bird-dog.head-up',
        pose: 'Neck extends about 20 to 30 degrees so the face looks forward instead of down at the floor.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Low load on the spine and suitable as written. To make it easier, move only your arm or only your leg.',
    },
    cues: ['Back flat like a table', 'Reach long', 'Hips level', 'Hold and breathe'],
    youtube: {
      tutorial: 'McGill bird dog technique',
      mistakes: 'bird dog exercise common mistakes physical therapist',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/14/bird-dog/',
      'https://pubmed.ncbi.nlm.nih.gov/19154838/',
      'https://pubmed.ncbi.nlm.nih.gov/9442191/',
    ],
  },
  {
    id: 'dead-bug',
    name: 'Dead Bug',
    summary: 'Lying on your back, you slowly lower one arm and the opposite leg while your lower back stays still.',
    muscles: {
      primary: ['Deep core muscles', 'Abs', 'Obliques'],
      secondary: ['Hip flexors', 'Shoulder stabilisers'],
    },
    equipment: 'Exercise mat',
    setup: [
      'Use an exercise mat and lie on your back.',
      'Point your arms straight up at the ceiling, over your shoulders.',
      'Lift your legs so your hips and knees are bent to 90 degrees, with your knees over your hips.',
      'Let your lower back rest gently on the mat.',
    ],
    steps: [
      'Lie on your back with your arms up and your knees over your hips.',
      'Draw your ribs down and let your lower back rest on the mat.',
      'Breathe in as you slowly reach one arm back and lower the opposite heel toward the floor.',
      'Stop just above the floor and keep your back still.',
      'Breathe out as you bring them back to the start.',
      'Switch to the other arm and leg.',
    ],
    tempo: { lower: 3, pauseBottom: 1, lift: 3, pauseTop: 1 },
    dosage: { sets: 2, reps: 6, sides: 'each' },
    breathing:
      'Keep a gentle brace all the way around your waist. Breathe in as your arm and leg reach away, and breathe out as they come back. Never hold your breath.',
    feel: 'You should feel the deep muscles of your stomach working to keep your back still.',
    shouldNotFeel:
      'You should not feel your lower back lifting off the mat, a pinch at the front of your hips, or pain in your back. If you do, shorten the reach, or keep your knee bent and just tap your heel down. Stop if pain spreads into your leg.',
    why: 'It teaches your trunk to stay steady while your arms and legs move, which is what protects your back in daily life. It is gentle enough for most sensitive backs.',
    mistakes: [
      {
        mistake: 'Lower back arching',
        risk: 'The arch loads your lower back and your abs switch off.',
        fix: 'Shorten the reach so your back stays on the mat.',
        clip: 'dead-bug.back-arch',
        pose: 'Lumbar spine lifts 2 to 4 cm off the mat, with lordosis increasing about 10 to 15 degrees, as the lowering leg nears the floor.',
      },
      {
        mistake: 'Ribs flaring',
        risk: 'You lose your brace and your back starts to arch.',
        fix: 'Draw your ribs down toward your hips.',
        clip: 'dead-bug.ribs-flare',
        pose: 'Lower ribcage lifts and flares about 10 degrees into thoracic extension as the arm reaches overhead past the ear.',
      },
      {
        mistake: 'Rushing',
        risk: 'Momentum does the work and you lose control of your back.',
        fix: 'Take 3 seconds out and 3 seconds back.',
        clip: 'dead-bug.rushing',
        pose: 'Arm and leg drop toward the floor in under 1 second and bounce back, the trunk jolting and the lower back lifting about 2 cm at each change of direction.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Suitable as written. If your back arches, keep your knees bent and tap one heel down at a time.',
    },
    cues: ['Ribs down', 'Back stays still', 'Slow and smooth', 'Breathe out on the way back'],
    youtube: {
      tutorial: 'dead bug exercise physical therapist',
      mistakes: 'dead bug exercise common mistakes',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/147/supine-dead-bug/',
      'https://pubmed.ncbi.nlm.nih.gov/17207676/',
    ],
  },
  {
    id: 'pallof-press',
    name: 'Pallof Press',
    summary: 'Standing side on to a cable, you press a handle straight out and resist being turned, which trains your trunk to stay steady.',
    muscles: {
      primary: ['Obliques', 'Deep core muscles', 'Abs'],
      secondary: ['Glutes', 'Shoulders', 'Chest'],
    },
    equipment: 'Cable machine with a single handle, or a resistance band anchored at chest height',
    setup: [
      'Find a cable tower and clip on a single handle, or anchor a resistance band at chest height.',
      'Set the pulley level with your chest.',
      'Stand side on to the tower, about one to one and a half metres away, so the cable is tight with the handle at your breastbone.',
      'Set your feet hip width apart or a little wider, knees soft, both hands on the handle.',
      'To make it easier, kneel tall or on one knee.',
    ],
    steps: [
      'Stand side on to the cable with the handle at your breastbone.',
      'Soften your knees and brace gently.',
      'Breathe out as you press the handle straight out from your chest.',
      "Don't let the cable turn you, and hold for 3 seconds.",
      'Breathe in as you bring the handle back to your chest.',
      'Finish the set, then turn around and work the other side.',
    ],
    tempo: { lower: 2, pauseBottom: 0, lift: 2, pauseTop: 3 },
    breathing:
      'Keep a gentle brace and keep breathing. Breathe out slowly as you press and through the hold, then breathe in as the handle comes back. Never hold your breath.',
    feel: 'You should feel the sides of your waist and your deep stomach muscles working to stop you turning.',
    shouldNotFeel:
      'You should not feel your lower back twisting or pain in your shoulders. If you do, step closer to the tower or use a lighter weight. Stop if pain spreads into your leg.',
    why: 'Your trunk learns to resist twisting while your spine stays still, which is a safe way to build turning strength for a sensitive back. It replaces twisting exercises like the Russian twist.',
    mistakes: [
      {
        mistake: 'Turning toward the cable',
        risk: 'Your spine twists and your core stops doing the work.',
        fix: 'Use a lighter weight and keep your hands in line with your breastbone.',
        clip: 'pallof-press.rotating-to-stack',
        pose: 'Trunk rotates 10 to 20 degrees toward the weight stack and the hands drift 10 to 15 cm off the midline toward the pulley.',
      },
      {
        mistake: 'Hips shifting or leaning',
        risk: 'You lose your neutral spine.',
        fix: 'Stack your ribs over your hips.',
        clip: 'pallof-press.hip-shift',
        pose: 'Hips slide 5 to 10 cm away from the stack while the trunk side-bends about 10 degrees toward it.',
      },
      {
        mistake: 'Shrugging with bent arms',
        risk: 'It strains your neck and shoulders.',
        fix: 'Keep your shoulders down and press your arms straight.',
        clip: 'pallof-press.shrug-bent-arms',
        pose: 'Shoulders lift about 3 cm toward the ears and the elbows stay bent about 45 degrees at full press.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Trains your trunk without any spinal movement and suits sensitive backs. To make it easier, kneel tall or on one knee. If it still bothers you, use the bird dog.',
      regression: 'bird-dog',
    },
    cues: ['Press straight out', "Don't let it turn you", 'Ribs down', 'Breathe out as you press'],
    youtube: {
      tutorial: 'Pallof press technique physical therapist',
      mistakes: 'Pallof press common mistakes',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/332/standing-anti-rotation-press/',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC11857476/',
    ],
  },
  {
    id: 'cable-chop',
    name: 'Cable Chop',
    summary: 'A diagonal pull across your body that trains your hips and upper back to do the turning while your lower back stays steady.',
    muscles: {
      primary: ['Obliques', 'Deep core muscles'],
      secondary: ['Glutes', 'Shoulders', 'Upper back'],
    },
    equipment: 'Cable tower with a single handle or rope, or a resistance band anchored high',
    setup: [
      'Find a cable tower with an adjustable pulley, and clip on a single handle or a rope.',
      'Set the pulley at about head height and pick a light weight.',
      'Stand side on to the tower, one long step away, with your feet a little wider than your shoulders.',
      'Hold the handle with both hands, arms long, reaching up toward the pulley.',
      'For the low to high version, set the pulley at the bottom and sweep up and across instead.',
    ],
    steps: [
      'Brace gently and shift your weight onto the leg nearest the tower.',
      'Keep your arms long and pull the handle down and across your body toward your far hip.',
      'Let the heel nearest the tower lift and pivot, so your hips turn with your chest.',
      'Turn from your hips and upper back, not your lower back.',
      'Pause for one second beside your far hip.',
      'Return slowly to the start over 3 seconds.',
      'Finish the set, then turn around and work the other side.',
    ],
    tempo: { lower: 3, pauseBottom: 1, lift: 2, pauseTop: 1 },
    breathing:
      'Keep a gentle brace. Breathe out slowly as you chop across, and breathe in as the handle returns. Never hold your breath.',
    feel: 'You should feel the sides of your waist, your hips and your shoulders working together.',
    shouldNotFeel:
      'You should not feel twisting or pinching in your lower back, or pain down your leg. If you do, make the turn smaller, use a lighter weight, or switch to the Pallof press.',
    why: 'Everyday jobs like lifting a bag into a car involve turning. This teaches your hips and upper back to do the turning while your lower back, which is built to twist only a little, stays steady.',
    mistakes: [
      {
        mistake: 'Twisting from the lower back',
        risk: 'Forcing the twist into your lower back loads the discs and can flare back pain or sciatica.',
        fix: 'Let your back heel pivot so your hips and chest turn together.',
        clip: 'cable-chop.lower-back-twist',
        pose: 'Both heels stay planted and the pelvis stays square to the front at 0 degrees while the ribcage turns about 45 degrees toward the far hip, forcing about 15 to 20 degrees of twist through the lumbar spine.',
      },
      {
        mistake: 'Rounding the back at the bottom',
        risk: 'Bending and twisting together under load is a common way discs get injured.',
        fix: 'Keep your chest proud and bend your knees a little instead.',
        clip: 'cable-chop.rounded-back',
        pose: 'At the finish the lumbar spine flexes about 20 to 30 degrees and the head drops about 20 degrees while the trunk is still turned about 30 degrees, hands reaching below the far knee with the knees nearly straight.',
      },
      {
        mistake: 'Yanking with the arms',
        risk: 'Momentum jerks your shoulders and back and takes the work away from your trunk.',
        fix: 'Use a lighter weight and move the handle slowly with long arms.',
        clip: 'cable-chop.yanking-arms',
        pose: 'Elbows bend about 90 degrees to pull the handle into the chest, then the arms punch down in under half a second, with the shoulders shrugged about 3 cm and the hips not turning.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'Use a light weight and let your hips and upper back do the turning while your lower back stays still. It usually joins your plan after the first four weeks. On irritable days, or if it stirs leg symptoms, use the Pallof press instead.',
      regression: 'pallof-press',
    },
    cues: ['Arms long', 'Hips and chest turn together', 'Pivot your back foot', 'Lower back stays steady', 'Breathe out as you chop'],
    youtube: {
      tutorial: 'cable wood chop high to low technique',
      mistakes: 'cable wood chop mistakes lower back',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/349/standing-rotational-chop/',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC2953333/',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC2223353/',
    ],
  },

  // ─── Loaded carries ───────────────────────────────────────────────────────
  {
    id: 'suitcase-carry',
    name: 'Suitcase Carry',
    summary: 'You walk tall with a weight in one hand while your trunk works to stop you leaning toward it.',
    muscles: {
      primary: ['Obliques', 'Deep side muscles of the lower back', 'Side hip muscles'],
      secondary: ['Grip', 'Upper back', 'Back muscles'],
    },
    equipment: 'One dumbbell or kettlebell, and a clear walking lane',
    setup: [
      'Choose one dumbbell or kettlebell, starting at about 10 to 15 percent of your body weight.',
      'Pick it up from a bench, or squat down to it, and never bend sideways to grab it.',
      'Clear a straight lane of about 15 to 20 metres.',
      'Wear supportive shoes, and with diabetes, check your feet afterwards.',
    ],
    steps: [
      'Squat down and pick up the weight in one hand.',
      'Stand tall with your shoulders level.',
      "Brace gently and don't lean toward the weight.",
      'Walk with short, smooth steps.',
      'Set the weight down with a squat, then switch hands.',
    ],
    dosage: { holdSeconds: 30, sets: 2, sides: 'each' },
    breathing:
      'Keep a gentle brace and keep breathing steadily. Breathe out every two or three steps. Never hold your breath.',
    feel: 'You should feel the side of your waist opposite the weight, your grip and your hips working.',
    shouldNotFeel:
      'You should not feel pain in your lower back or pain travelling down your leg. If you do, set the weight down and use a lighter one next time.',
    why: 'Carrying shopping or a bag in one hand is part of everyday life. This trains your trunk to keep your spine tall and steady under a one sided load.',
    mistakes: [
      {
        mistake: 'Leaning toward the weight',
        risk: 'Your spine is squeezed unevenly on one side.',
        fix: 'Use a lighter weight and keep your shoulders level.',
        clip: 'suitcase-carry.leaning-to-weight',
        pose: 'Trunk side-bends 10 to 15 degrees toward the loaded hand and the loaded shoulder drops 3 to 5 cm.',
      },
      {
        mistake: 'Leaning away from the weight',
        risk: 'It is still lopsided, just the other way.',
        fix: 'Stand stacked and tall, as if between two walls.',
        clip: 'suitcase-carry.leaning-away',
        pose: 'Trunk side-bends about 10 degrees away from the weight and the free arm drifts out about 20 degrees from the side for balance.',
      },
      {
        mistake: 'Twisting with each step',
        risk: 'The weight swings and twists your spine.',
        fix: 'Slow down and keep the weight still at your side.',
        clip: 'suitcase-carry.twisting-steps',
        pose: 'Trunk rotates 10 to 15 degrees side to side with each step and the weight swings 10 to 20 cm forward and back.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'A weight in one hand squeezes the spine more than the same weight split between two hands. While your back is sensitive, keep the load moderate, no more than 20 to 25 percent of your body weight. On irritable days, use the side plank instead.',
      regression: 'side-plank',
    },
    cues: ['Stand tall', 'Shoulders level', "Don't lean", 'Short, smooth steps', 'Keep breathing'],
    youtube: {
      tutorial: 'suitcase carry technique physical therapist',
      mistakes: 'suitcase carry common mistakes',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/358/suitcase-carry/',
      'https://pubmed.ncbi.nlm.nih.gov/23384188/',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC11042841/',
    ],
  },
  {
    id: 'farmer-carry',
    name: 'Farmer Carry',
    summary: 'You walk tall with a weight in each hand, which builds grip, posture and a strong, steady trunk.',
    muscles: {
      primary: ['Grip and forearms', 'Upper back', 'Core'],
      secondary: ['Glutes', 'Thighs', 'Calves'],
    },
    equipment: 'Two equal dumbbells or kettlebells, and a clear walking lane',
    setup: [
      'Choose two equal dumbbells or kettlebells, starting at about 25 to 35 percent of your body weight in total.',
      'Lift them from a bench or rack, or squat down to them with a flat back.',
      'Clear a straight lane of about 15 to 20 metres.',
      'Wear supportive, well fitting shoes, and with diabetes, check your feet afterwards.',
    ],
    steps: [
      'Pick up both weights with a flat back.',
      'Stand tall with your shoulders down and back.',
      'Brace gently and walk with short, quick steps.',
      'Keep the weights still at your sides.',
      'Set them down with a squat or a hip hinge, keeping your back flat.',
    ],
    dosage: { holdSeconds: 40, sets: 2, sides: 'none' },
    breathing:
      'Keep a gentle brace and breathe steadily as you walk. Never hold your breath, even when your grip gets tired.',
    feel: 'You should feel your grip, the tops of your shoulders and your whole trunk working.',
    shouldNotFeel:
      'You should not feel pain in your lower back or pain travelling down your leg. If you do, set the weights down and go lighter next time.',
    why: 'Carrying heavy bags is part of daily life. Two balanced weights train your grip and posture with less load on your spine than the same weight in one hand.',
    mistakes: [
      {
        mistake: 'Rounding to pick up or set down',
        risk: 'Lifting with a rounded back loads your spine where it is most vulnerable.',
        fix: 'Squat or hinge with a flat back, or lift the weights from a bench.',
        clip: 'farmer-carry.rounded-pickup',
        pose: 'Knees nearly straight while the lumbar spine flexes 20 to 30 degrees to reach the weights on the floor, head dropped.',
      },
      {
        mistake: 'Shoulders rolled and shrugged',
        risk: 'It strains your neck and upper back.',
        fix: 'Shoulders down and back, chest tall.',
        clip: 'farmer-carry.shrugged-shoulders',
        pose: 'Shoulders roll forward and lift 3 to 5 cm toward the ears, with the upper back rounding about 10 degrees.',
      },
      {
        mistake: 'Leaning back',
        risk: 'Your back muscles overwork and your lower back arches.',
        fix: 'Stand stacked, with your ribs over your hips.',
        clip: 'farmer-carry.leaning-back',
        pose: 'Trunk leans 10 to 15 degrees behind vertical with the lumbar spine extended about 10 degrees and the hips pushed forward.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'A balanced load squeezes the spine less than the same weight in one hand. While your back is sensitive, lift the weights from bench height rather than the floor.',
    },
    cues: ['Stand tall', 'Shoulders down', 'Short, quick steps', 'Keep breathing'],
    youtube: {
      tutorial: 'farmers carry technique strength coach',
      mistakes: 'farmers carry common mistakes',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/359/farmer-s-carry/',
      'https://pubmed.ncbi.nlm.nih.gov/23384188/',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC11042841/',
    ],
  },

  // ─── Core: flexion and rotation (retired from default back plans) ────────
  {
    id: 'cable-crunch',
    name: 'Cable Crunch',
    summary: 'Kneeling at a cable, you curl your ribs toward your hips against a weight to work your front abs.',
    muscles: {
      primary: ['Front abs'],
      secondary: ['Obliques'],
    },
    equipment: 'Cable tower with a rope on the high pulley, and a mat for your knees',
    setup: [
      'Find a cable tower and clip a rope onto the pulley at the top.',
      'Kneel on a mat facing the weight stack, about 30 to 60 centimetres away.',
      'Hold the rope ends beside your head, with your wrists against your head.',
      'Pick a light weight.',
    ],
    steps: [
      'Kneel facing the stack with the rope beside your head.',
      'Brace gently and keep your hips still.',
      'Breathe out and curl your ribs toward your hips.',
      'Bring your elbows toward your thighs.',
      'Breathe in and uncurl slowly without moving your hips.',
    ],
    tempo: { lower: 2, pauseBottom: 0, lift: 2, pauseTop: 1 },
    breathing:
      'Breathe out as you curl down and breathe in as you uncurl. Keep a gentle brace and never hold your breath.',
    feel: 'You should feel your abs doing the work.',
    shouldNotFeel:
      'You should not feel pain in your lower back, your hip flexors doing the pulling, or strain in your neck. Stop if pain spreads into your leg.',
    why: 'It builds the front abs against an adjustable weight. Because it bends the spine over and over under load, a gentler curl up replaces it for anyone with a back history.',
    mistakes: [
      {
        mistake: 'Hinging at the hips',
        risk: 'Your hip flexors do the work instead of your abs.',
        fix: 'Keep your hips still and bring your ribs toward your hips.',
        clip: 'cable-crunch.hip-hinge',
        pose: 'Hips sit back 20 to 30 cm toward the heels, with hip flexion about 40 to 50 degrees, while the spine stays nearly straight.',
      },
      {
        mistake: 'Pulling with the arms',
        risk: 'Your arms take the load off your abs.',
        fix: 'Keep your hands fixed beside your head.',
        clip: 'cable-crunch.arm-pull',
        pose: 'Hands move away from the head and the elbows extend about 30 to 45 degrees, dragging the rope down in front of the face.',
      },
      {
        mistake: 'Jerking a heavy stack',
        risk: 'Fast, forceful bending stresses the discs in your lower back.',
        fix: 'Go lighter and move slowly and smoothly.',
        clip: 'cable-crunch.jerking',
        pose: 'Spine snaps from upright to about 60 degrees of trunk flexion in under half a second, and the weight stack bounces at the top.',
      },
    ],
    backSafety: {
      status: 'excluded',
      note: 'Left out of plans for back and sciatica profiles because it bends the spine over and over under load. Use the McGill curl up instead.',
      regression: 'mcgill-curl-up',
    },
    cues: ['Hips still', 'Ribs to hips', 'Breathe out as you curl', 'Slow on the way up'],
    youtube: {
      tutorial: 'kneeling cable crunch proper form',
      mistakes: 'kneeling cable crunch mistakes',
    },
    sources: [
      'https://exrx.net/WeightExercises/RectusAbdominis/CBKneelingCrunch',
      'https://pubmed.ncbi.nlm.nih.gov/11114441/',
    ],
  },
  {
    id: 'hanging-knee-raise',
    name: 'Hanging Knee Raise',
    summary: "Supported in a captain's chair or hanging from a bar, you raise your bent knees to hip height to work your lower abs and hip flexors.",
    muscles: {
      primary: ['Hip flexors', 'Lower abs'],
      secondary: ['Obliques', 'Grip', 'Upper back'],
    },
    equipment: "Captain's chair, or a pull up bar",
    setup: [
      "Look for a captain's chair, a tall frame with a back pad and padded forearm rests with handles.",
      'Step up, press your back into the pad and rest your forearms on the pads.',
      'If you use a pull up bar instead, grip it overhand, slightly wider than your shoulders.',
    ],
    steps: [
      'Start still, with your legs hanging and your shoulders pulled down.',
      'Brace gently and keep your legs still.',
      'Breathe out and raise your bent knees to hip height.',
      'Curl your pelvis up slightly.',
      'Breathe in and lower your legs slowly, with no swinging.',
    ],
    tempo: { lower: 2, pauseBottom: 1, lift: 2, pauseTop: 1 },
    breathing:
      'Breathe out as your knees rise and breathe in as they lower. Keep a gentle brace and never hold your breath.',
    feel: 'You should feel your lower abs, the fronts of your hips and your grip working.',
    shouldNotFeel:
      'You should not feel pain in your lower back or your shoulders. If you do, stop and use the dead bug instead.',
    why: "It strengthens your lower abs and hip flexors. The captain's chair supports your back and takes your grip out of the way.",
    mistakes: [
      {
        mistake: 'Swinging',
        risk: 'Momentum does the work and strains your shoulders.',
        fix: "Start each rep from a still position, or use the captain's chair.",
        clip: 'hanging-knee-raise.swinging',
        pose: 'Whole body swings 20 to 30 degrees forward and back from the shoulders, with the legs kicking up on the forward swing.',
      },
      {
        mistake: 'Arching at the bottom',
        risk: 'Your hip flexors pull your lower back into an arch under load.',
        fix: 'Keep your knees bent and your pelvis slightly tucked.',
        clip: 'hanging-knee-raise.arching-bottom',
        pose: 'As the legs drop, the lumbar spine extends 10 to 15 degrees and the pelvis tips forward, with the legs swinging behind the line of the body.',
      },
      {
        mistake: 'Dropping the legs',
        risk: 'The fast drop jolts your spine.',
        fix: 'Take 2 seconds to lower.',
        clip: 'hanging-knee-raise.dropping-legs',
        pose: 'Legs fall from hip height to straight down, the hips extending about 90 degrees in under half a second, and the body jolts into a swing of about 10 to 15 degrees.',
      },
    ],
    backSafety: {
      status: 'avoidWhenIrritable',
      note: "Leave it out on irritable days and use the dead bug instead. When your back is calm, use the captain's chair with bent knees and no swinging.",
      regression: 'dead-bug',
    },
    cues: ['Shoulders down', 'Knees up, no swing', 'Curl the pelvis', 'Lower slowly'],
    youtube: {
      tutorial: 'captains chair knee raise proper form',
      mistakes: 'hanging knee raise mistakes no swinging',
    },
    sources: [
      'https://exrx.net/WeightExercises/HipFlexors/BWHangingLegRaise',
      'https://pubmed.ncbi.nlm.nih.gov/25111163/',
    ],
  },
  {
    id: 'russian-twist',
    name: 'Russian Twist',
    summary: 'Seated and leaning back, you turn your chest from side to side, which works your obliques but bends and twists your spine.',
    muscles: {
      primary: ['Obliques'],
      secondary: ['Front abs', 'Hip flexors'],
    },
    equipment: 'Exercise mat and a light medicine ball or weight plate',
    setup: [
      'Use an exercise mat and sit with your knees bent to about 90 degrees and your heels on the floor.',
      'Lean back to about 45 degrees with a long spine.',
      'Hold a light medicine ball or weight plate, about 2 to 5 kilograms, at your chest.',
    ],
    steps: [
      'Sit tall with your knees bent and your heels down.',
      'Lean back slightly, keeping your spine long.',
      'Brace gently and turn your chest to one side.',
      'Move slowly, so your ribs and the weight turn together.',
      'Come back through the middle, pause, and turn to the other side.',
    ],
    tempo: { lower: 2, pauseBottom: 1, lift: 2, pauseTop: 0 },
    breathing:
      'Breathe out as you turn and breathe in as you come back through the middle. Never hold your breath.',
    feel: 'You should feel the sides of your waist working.',
    shouldNotFeel:
      'You should not feel pain in your lower back or any symptoms in your legs. If you do, stop and use the Pallof press instead.',
    why: 'It works the obliques for people with no back history. For anyone with a back or sciatica history, the Pallof press trains the same muscles without bending and twisting the spine.',
    mistakes: [
      {
        mistake: 'Rounded back while twisting',
        risk: 'Bending and twisting together under load is a known way to injure discs.',
        fix: 'Keep your spine long, or switch to the Pallof press.',
        clip: 'russian-twist.rounded-back',
        pose: 'Lumbar spine flexes 20 to 30 degrees into a C shape with the shoulders slumped forward, while the trunk rotates about 30 degrees each way.',
      },
      {
        mistake: 'Moving only the arms',
        risk: 'Your trunk does no work.',
        fix: 'Turn your chest, not just your hands.',
        clip: 'russian-twist.arms-only',
        pose: 'Arms swing the weight about 45 degrees to each side while the chest stays square to the front.',
      },
      {
        mistake: 'Fast, jerky twisting',
        risk: 'Sudden twisting force spikes the load on your spine.',
        fix: 'Take 2 seconds to turn to each side.',
        clip: 'russian-twist.fast-twisting',
        pose: 'Trunk whips about 45 degrees to each side in under half a second, with the weight overshooting past the hip.',
      },
    ],
    backSafety: {
      status: 'excluded',
      note: 'Left out of plans for back and sciatica profiles because it combines bending and twisting under load. Use the Pallof press instead.',
      regression: 'pallof-press',
    },
    cues: ['Long spine', 'Turn your chest', 'Slow and controlled', 'Keep breathing'],
    youtube: {
      tutorial: 'Russian twist proper form',
      mistakes: 'Russian twist form mistakes physical therapist',
    },
    sources: [
      'https://pubmed.ncbi.nlm.nih.gov/19815318/',
      'https://www.acefitness.org/resources/everyone/exercise-library/65/russian-twist/',
      'https://pubmed.ncbi.nlm.nih.gov/11114441/',
    ],
  },

  // ─── Cardio (12-minute zone 2 block) ──────────────────────────────────────
  {
    id: 'treadmill-walk',
    name: 'Incline Treadmill Walk',
    summary: 'A steady walk up a gentle slope that builds your heart and lungs with very little impact.',
    muscles: {
      primary: ['Glutes', 'Calves', 'Hamstrings', 'Thighs'],
      secondary: ['Core', 'Shins', 'Hip flexors'],
    },
    equipment: 'Treadmill',
    setup: [
      'Find a treadmill and clip the safety key to your clothing.',
      'Start at 0 to 1 percent incline and about 4 kilometres per hour.',
      'For the main part, aim for 4 to 5.5 kilometres per hour at 3 to 6 percent incline, or 3 percent or less on a sore day.',
      'Add about 1 percent of incline a week if it feels easy, and stay at 8 percent or less.',
      'Wear cushioned, supportive walking shoes, and with diabetes, check your feet afterwards.',
    ],
    steps: [
      'Walk easily for the first 2 minutes on a flat or almost flat belt.',
      'Then raise the incline and settle into a pace where you can still talk in full sentences, and keep it for 9 minutes.',
      'Stand tall and lean very slightly forward from your ankles, not your waist.',
      'Let your arms swing and keep your hands off the rails.',
      'Take short, quick steps up the slope.',
      'For the last minute, lower the incline to zero and slow to an easy stroll.',
      'Wait for the belt to stop before you step off.',
    ],
    breathing:
      'Breathe in a steady rhythm, in for two or three steps and out for two or three. Never hold your breath on the climb.',
    feel: 'You should feel warm and gently out of breath, with your legs and glutes working. Use the talk test. You can still talk comfortably in full sentences. That is an effort of about 3 to 4 out of 10.',
    shouldNotFeel:
      'You should not feel tingling or pain building in your buttock or leg. If you do, lower the incline and shorten your steps. Stop and sit down if you get chest pain, dizziness or unusual breathlessness, or if you feel shaky and sweaty.',
    why: 'Walking helps your muscles use blood sugar, especially soon after a meal, and keeps your heart and blood pressure healthy. A regular walking habit also helps keep back pain from coming back.',
    mistakes: [
      {
        mistake: 'Holding the rails',
        risk: 'It takes the work off your legs, strains your shoulders and back, and gripping can push up your blood pressure.',
        fix: 'Let go, and lower the speed or incline until you can walk hands free.',
        clip: 'treadmill-walk.holding-rails',
        pose: 'Both hands grip the front rails with the elbows locked straight, the trunk leaning about 20 degrees forward onto the rails and the hips flexed 20 to 30 degrees, feet trailing behind.',
      },
      {
        mistake: 'Bending at the waist',
        risk: 'Your lower back is held bent and the nerve down the back of your leg is stretched more.',
        fix: 'Lean from your ankles with your chest up, and take shorter, quicker steps.',
        clip: 'treadmill-walk.bending-at-waist',
        pose: 'Trunk tilts 20 to 30 degrees forward of vertical from the hips with the lumbar spine flexed and the head down, taking long reaching steps.',
      },
      {
        mistake: 'Overstriding',
        risk: 'Each heel strike brakes hard and jolts your knees and back.',
        fix: 'Take shorter steps that land under your hips.',
        clip: 'treadmill-walk.overstriding',
        pose: 'Leading heel lands 30 to 40 cm ahead of the hips with the knee almost straight, bent only 0 to 5 degrees, toes pointing up.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'A gentle incline often suits backs that dislike standing and arching. If buttock, hamstring or calf symptoms rise, lower the incline to 3 percent or less and shorten your stride. If walking keeps stirring leg symptoms, use the recumbent bike.',
      regression: 'recumbent-bike',
    },
    cues: ['Can you still talk in full sentences?', 'Go by effort, not heart rate', 'Hands off the rails', 'Lean from your ankles, not your waist', 'Short, quick steps up the slope'],
    youtube: {
      tutorial: 'incline treadmill walking form physical therapist',
      mistakes: 'treadmill walking mistakes holding rails',
    },
    sources: [
      'https://www.cdc.gov/physical-activity-basics/measuring/index.html',
      'https://pubmed.ncbi.nlm.nih.gov/9355058/',
      'https://pubmed.ncbi.nlm.nih.gov/38908392/',
    ],
  },
  {
    id: 'brisk-walking',
    name: 'Brisk Walk',
    summary: 'A purposeful walk, quick enough to warm you up but easy enough to chat.',
    muscles: {
      primary: ['Glutes', 'Calves', 'Thighs', 'Hamstrings'],
      secondary: ['Core', 'Shins', 'Shoulders'],
    },
    equipment: 'No equipment, just supportive walking shoes',
    setup: [
      'Choose a flat, even route, or a treadmill at 0 to 1 percent incline.',
      'Wear cushioned, well fitting walking shoes and socks that keep your feet dry.',
      'Brisk usually means about 100 steps a minute, but let the talk test set your pace.',
      'With diabetes, check your feet after every walk.',
    ],
    steps: [
      'Stroll easily for the first 2 minutes.',
      'Then pick up to a brisk pace where you can still talk in full sentences, and keep it for 9 minutes.',
      'Stand tall with your eyes on the horizon and your shoulders low.',
      'Bend your elbows and let them swing from your shoulders.',
      'Take quick, light steps that land under your hips and roll from heel to toe.',
      'For the last minute, ease back to a gentle stroll.',
    ],
    breathing:
      'Breathe in a relaxed, steady rhythm, in through your nose if that is comfortable and out through your mouth. Never hold your breath, even on hills.',
    feel: 'You should feel warm and gently out of breath. Use the talk test. You can still talk comfortably in full sentences. That is an effort of about 3 to 4 out of 10.',
    shouldNotFeel:
      'You should not feel tingling or pain building in your buttock or leg. If you do, slow down and shorten your steps, or pause for a minute, then carry on. Stop and rest if you get chest pain, dizziness or unusual breathlessness, or if you feel shaky and sweaty.',
    why: 'Walking lowers blood sugar, especially in the hour after a meal, and keeps your heart and blood pressure healthy. Regular walking also helps keep back pain from coming back.',
    mistakes: [
      {
        mistake: 'Looking down at your feet or phone',
        risk: 'It strains your neck and upper back and makes trips more likely.',
        fix: 'Keep your eyes 10 to 20 metres ahead.',
        clip: 'brisk-walking.head-down',
        pose: 'Neck flexes 30 to 45 degrees with the chin toward the chest and the upper back rounding about 10 degrees, eyes on the ground just ahead of the feet.',
      },
      {
        mistake: 'Overstriding',
        risk: 'Each step brakes hard, jolts your knees and back, and stretches the nerve in your leg more.',
        fix: 'Take shorter, quicker steps that land under you.',
        clip: 'brisk-walking.overstriding',
        pose: 'Leading heel lands 30 to 40 cm ahead of the hips with the knee almost straight, bent only 0 to 5 degrees, toes pointing up.',
      },
      {
        mistake: 'Slumping',
        risk: 'A rounded upper back and a forward head strain your neck and back.',
        fix: 'Walk tall, as if a string lifts the top of your head.',
        clip: 'brisk-walking.slumped',
        pose: 'Upper back rounds 15 to 20 degrees, the head pokes 5 to 8 cm forward of the shoulders and the shoulders roll forward.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Walking is usually well tolerated by sore backs. If leg symptoms build, slow down, shorten your steps and pause if needed. If walking keeps stirring symptoms, use the recumbent bike.',
      regression: 'recumbent-bike',
    },
    cues: ['Can you still talk in full sentences?', 'Go by effort, not heart rate', 'Tall spine, eyes on the horizon', 'Quick, light steps under you', 'Leg tingling? Shorten your steps'],
    youtube: {
      tutorial: 'brisk walking technique physiotherapist',
      mistakes: 'walking posture mistakes physiotherapist',
    },
    sources: [
      'https://www.cdc.gov/physical-activity-basics/measuring/index.html',
      'https://pubmed.ncbi.nlm.nih.gov/27747394/',
      'https://pubmed.ncbi.nlm.nih.gov/38908392/',
    ],
  },
  {
    id: 'stationary-bike',
    name: 'Upright Bike',
    summary: 'Steady pedalling on an upright exercise bike, which builds your heart and lungs without pounding your joints.',
    muscles: {
      primary: ['Thighs', 'Glutes'],
      secondary: ['Hamstrings', 'Calves', 'Core'],
    },
    equipment: 'Upright exercise bike',
    setup: [
      'Find an upright exercise bike, the kind with a saddle and handlebars like a road bike.',
      'Set the saddle height so your leg is almost straight when your heel rests on the bottom pedal.',
      'Then ride on the ball of your foot, which leaves a soft bend of about 25 to 35 degrees in your knee.',
      'Set the handlebars level with the saddle or higher, which is kinder to your back.',
      'Ride in shoes with the straps fastened, and start with light resistance.',
    ],
    steps: [
      'Pedal easily with light resistance for the first 2 minutes.',
      'Then add a little resistance and pedal smoothly for 9 minutes, at a pace where you can still talk in full sentences.',
      'Sit tall and hinge slightly forward from your hips with a long spine.',
      'Keep your hands light, your elbows soft and your shoulders low.',
      'Keep your knees in line with your feet and your hips still on the saddle.',
      'For the last minute, take the resistance off and spin easily.',
      'Sit for about 30 seconds before you stand up and step off.',
    ],
    breathing:
      'Breathe in a smooth rhythm and breathe out as you push. Never hold your breath when you add resistance.',
    feel: 'You should feel your thighs and glutes working, and feel warm and gently out of breath. Use the talk test. You can still talk comfortably in full sentences. That is an effort of about 3 to 4 out of 10.',
    shouldNotFeel:
      'You should not feel tingling or pain building in your buttock or leg, or an ache from sitting bent forward. If you do, raise the handlebars, sit more upright and ease the resistance, or switch to the recumbent bike. Stop if you get chest pain, dizziness or unusual breathlessness, or if you feel shaky and sweaty. With diabetes, check your feet and the skin where you sit afterwards.',
    why: 'Cycling helps your body use blood sugar and strengthens your heart, with no pounding on your feet or joints. That makes it a good choice on days when walking bothers your feet.',
    mistakes: [
      {
        mistake: 'Saddle too high',
        risk: 'Your knee locks straight and your hips rock, which tugs on the nerve in your leg and irritates your lower back.',
        fix: 'Lower the saddle until your hips stay still and your knee keeps a soft bend.',
        clip: 'stationary-bike.saddle-too-high',
        pose: 'Knee straightens to under 15 degrees of bend at the bottom of the stroke and the pelvis rocks 5 to 10 degrees side to side, toes reaching down for the pedal.',
      },
      {
        mistake: 'Slumped over low handlebars',
        risk: 'Your lower back is held bent near the end of its range for the whole ride.',
        fix: 'Raise the handlebars and sit taller.',
        clip: 'stationary-bike.slumped-back',
        pose: 'Spine rounds into a C curve with lumbar flexion near end range, the pelvis tucked under about 15 degrees and the head dropped, hands on bars set below saddle height.',
      },
      {
        mistake: 'Gripping the bars hard',
        risk: 'A tight grip can push up your blood pressure and tense your shoulders.',
        fix: 'Hold the bars lightly with soft elbows.',
        clip: 'stationary-bike.gripping-hard',
        pose: 'Elbows locked straight, shoulders shrugged 3 to 5 cm toward the ears and wrists bent back about 20 degrees in a tight grip.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'Cycling keeps the lower back bent, which can stir sciatica that dislikes bending. Raise the handlebars, sit more upright and make sure your knee never locks. Switch to the recumbent bike if leg symptoms spread.',
      regression: 'recumbent-bike',
    },
    cues: ['Can you still talk in full sentences?', 'Go by effort, not heart rate', 'Soft bend in the knee', 'Light hands, low shoulders', 'Smooth circles, hips stay still'],
    youtube: {
      tutorial: 'exercise bike seat height setup physical therapist',
      mistakes: 'exercise bike setup mistakes physical therapist',
    },
    sources: [
      'https://pubmed.ncbi.nlm.nih.gov/20581695/',
      'https://pubmed.ncbi.nlm.nih.gov/27784817/',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC6908414/',
    ],
  },
  {
    id: 'recumbent-bike',
    name: 'Recumbent Bike',
    summary: 'Pedalling on a bike with a backrest, which supports your lower back while you build your heart and lungs.',
    muscles: {
      primary: ['Thighs', 'Glutes'],
      secondary: ['Hamstrings', 'Calves'],
    },
    equipment: 'Recumbent exercise bike',
    setup: [
      'Find the recumbent bike, the one with a low, wide seat, a backrest and the pedals out in front.',
      'Slide the seat so your knee keeps a soft bend of about 25 to 35 degrees at the farthest pedal, and never locks straight.',
      'Set the backrest upright or slightly reclined, and sit with your hips all the way back.',
      'Fasten the straps over the front of your feet and start with light resistance.',
      'Ride in shoes, never barefoot.',
    ],
    steps: [
      'Pedal easily with light resistance for the first 2 minutes.',
      'Then add resistance and pedal smoothly for 9 minutes, at a pace where you can still talk in full sentences.',
      'Keep your back and pelvis against the backrest.',
      'Rest your hands lightly on the side handles and relax your shoulders and jaw.',
      'Keep your knees in line with your feet and push through your whole foot.',
      'For the last minute, take the resistance off and pedal gently.',
      'Sit for about 30 seconds before you stand up.',
    ],
    breathing:
      'Slow belly breathing comes easily in this position. Breathe out as you push, and never hold your breath when you add resistance.',
    feel: 'You should feel your thighs and glutes working, and feel warm and gently out of breath. Use the talk test. You can still talk comfortably in full sentences. That is an effort of about 3 to 4 out of 10.',
    shouldNotFeel:
      'You should not feel tingling down your leg or an ache at the front of your knee. If your leg tingles, bring the seat a little closer and ease the resistance. If your knee aches, move the seat back a little. Stop if you get chest pain, dizziness or unusual breathlessness, or if you feel shaky and sweaty. With diabetes, check your feet afterwards, since straps can rub.',
    why: 'It improves blood sugar control and heart health while your back is supported and your feet carry no weight. That makes it a safe choice on a sore back day, with sore or numb feet, or when your balance is unsteady.',
    mistakes: [
      {
        mistake: 'Seat too far away',
        risk: 'Your knee snaps straight with your ankle pulled up, which stretches the nerve down the back of your leg, and your hips slide forward.',
        fix: 'Move the seat closer so your knee keeps a soft bend.',
        clip: 'recumbent-bike.seat-too-far',
        pose: 'Knee fully straight at 0 to 10 degrees of bend at the far pedal, with the hip flexed 80 to 90 degrees and the ankle pulled up, and the pelvis sliding about 5 cm forward off the backrest.',
      },
      {
        mistake: 'Seat too close',
        risk: 'Your hips bend too far, your lower back rounds and your kneecaps take extra pressure.',
        fix: 'Move the seat back and keep your pelvis against the backrest.',
        clip: 'recumbent-bike.seat-too-close',
        pose: 'Hip flexes past 110 degrees with the thighs near the belly at the top of the stroke, the pelvis tucked under 15 to 20 degrees and the lower back rounded off the backrest.',
      },
      {
        mistake: 'Gripping the handles hard',
        risk: 'A tight grip can push up your blood pressure and tense your shoulders.',
        fix: 'Rest your hands lightly on the handles.',
        clip: 'recumbent-bike.gripping-hard',
        pose: 'Fists clench the side handles with the elbows locked, shoulders shrugged 3 to 5 cm and pulled forward off the backrest.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'The supported back, steady seat and lack of impact make this the gentlest choice for a sore back or sciatica. Seat distance is the key adjustment. If leg tingling appears, bring the seat closer and lower the resistance.',
    },
    cues: ['Can you still talk in full sentences?', 'Go by effort, not heart rate', 'Back against the seat', 'Soft knee at the far pedal', 'Push through your whole foot'],
    youtube: {
      tutorial: 'recumbent bike seat adjustment physical therapist',
      mistakes: 'recumbent bike setup mistakes',
    },
    sources: [
      'https://pubmed.ncbi.nlm.nih.gov/20581695/',
      'https://pubmed.ncbi.nlm.nih.gov/16838375/',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC6908414/',
    ],
  },
  {
    id: 'elliptical',
    name: 'Elliptical',
    summary: 'A smooth, low impact stride on an elliptical trainer that works your legs and heart while your feet stay on the pedals.',
    muscles: {
      primary: ['Thighs', 'Glutes', 'Calves'],
      secondary: ['Hamstrings', 'Core', 'Shoulders'],
    },
    equipment: 'Elliptical cross trainer',
    setup: [
      'Find the elliptical, the machine with two long foot pedals that glide in an oval, and tall handles.',
      'Start with low resistance and a low ramp, around level 0 to 5 on most machines.',
      'Place your feet flat in the middle of the pedals and hold the handles lightly.',
      'Use the fixed handles if your balance is unsteady.',
      'Wear cushioned shoes, and with diabetes, check your feet afterwards.',
    ],
    steps: [
      'Stride easily with low resistance for the first 2 minutes.',
      'Then raise the resistance or ramp by one or two levels, and keep a steady pace for 9 minutes where you can still talk in full sentences.',
      'Stand tall with your hips under your shoulders and your eyes forward.',
      'Keep your whole foot on the pedal and press through your heels.',
      'Let your legs do the work, with light hands.',
      'For the last minute, lower the resistance and slow your stride.',
      'Hold the fixed handles and wait for the pedals to stop before you step off.',
    ],
    breathing:
      'Breathe in a steady rhythm that matches your strides, and breathe out fully. Never hold your breath when the resistance goes up.',
    feel: 'You should feel your thighs, glutes and calves working, and feel warm and gently out of breath. Use the talk test. You can still talk comfortably in full sentences. That is an effort of about 3 to 4 out of 10.',
    shouldNotFeel:
      'You should not feel tingling or pain building in your buttock or leg, or numb toes. If you do, lower the ramp or resistance and reset your feet, or switch to walking or the recumbent bike. Stop if you get chest pain, dizziness or unusual breathlessness, or if you feel shaky and sweaty.',
    why: 'It builds your heart and helps your body use blood sugar with very little impact on your joints. It works your legs through a natural walking pattern.',
    mistakes: [
      {
        mistake: 'Leaning on the handles',
        risk: 'It takes the work off your legs, rounds your lower back, and a tight grip can push up your blood pressure.',
        fix: 'Stand tall and keep your hands light.',
        clip: 'elliptical.leaning-on-handles',
        pose: 'Trunk flexes 20 to 30 degrees forward over the console with the elbows locked and body weight hanging on the handles.',
      },
      {
        mistake: 'Up on your toes',
        risk: 'It overloads your calves, presses on the balls of your feet and can make your toes go numb.',
        fix: 'Press through your heels and whole foot, and lower the resistance or ramp.',
        clip: 'elliptical.on-toes',
        pose: 'Heels lift off the pedals with the ankles pointed 20 to 30 degrees, weight on the balls of the feet throughout the stride.',
      },
      {
        mistake: 'Knees caving in',
        risk: 'It strains your knees and hips.',
        fix: 'Keep your knees in line with your second toe.',
        clip: 'elliptical.knees-caving',
        pose: 'Knees drift 3 to 5 cm inside the line of the second toe and the thighs turn in about 10 degrees on each push.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Low impact, but the stride bends your hips and trunk more than walking does, so stay upright. If leg symptoms rise, lower the ramp and resistance, or switch to walking or the recumbent bike.',
      regression: 'recumbent-bike',
    },
    cues: ['Can you still talk in full sentences?', 'Go by effort, not heart rate', 'Stand tall, hips under shoulders', 'Heels down, whole foot on pedal', 'Light hands, legs do the work'],
    youtube: {
      tutorial: 'elliptical proper form physical therapist',
      mistakes: 'elliptical mistakes leaning on handles',
    },
    sources: [
      'https://pubmed.ncbi.nlm.nih.gov/20022994/',
      'https://pubmed.ncbi.nlm.nih.gov/32791378/',
      'https://health.clevelandclinic.org/treadmill-or-elliptical-how-to-decide-whats-your-best-workout',
    ],
  },
  {
    id: 'rowing-machine',
    name: 'Rowing Machine',
    summary: 'A smooth rowing stroke that works your legs, back and arms together to build your heart and lungs.',
    muscles: {
      primary: ['Thighs', 'Glutes', 'Upper back'],
      secondary: ['Hamstrings', 'Arms', 'Core'],
    },
    equipment: 'Rowing machine',
    setup: [
      'Find the rowing machine, the long rail with a sliding seat, foot plates and a handle on a chain or strap.',
      'Set the damper, the lever on the side of the fan, to between 3 and 5.',
      'Strap your feet in across the widest part of your foot.',
      'Hold the handle with a relaxed grip and flat wrists.',
      'Aim for an easy rhythm of about 18 to 24 strokes a minute.',
    ],
    steps: [
      'Row easily for the first 2 minutes, with legs only at first, then legs and body.',
      'Then row full strokes at a steady pace for 9 minutes, where you can still talk in full sentences.',
      'Push with your legs first, then swing your body back slightly, then draw the handle to your lower ribs.',
      'Return in reverse, with arms, then body, then knees.',
      'At the front, stop with your shins upright and hinge from your hips with a tall spine.',
      'For the last minute, row gently with light pressure.',
      'Sit for about 30 seconds before you stand up.',
    ],
    breathing:
      'Breathe out as you push with your legs, and breathe in as you slide forward. Never hold your breath or grip the handle tightly.',
    feel: 'You should feel your legs, glutes and upper back working, and feel warm and gently out of breath. Use the talk test. You can still talk comfortably in full sentences. That is an effort of about 3 to 4 out of 10.',
    shouldNotFeel:
      'You should not feel your lower back aching, or tingling down your leg. If you do, stop and switch to the recumbent bike. Stop at once if you get chest pain, dizziness or unusual breathlessness, or if you feel shaky and sweaty. With diabetes, check your feet and hands afterwards, since straps and the handle can rub.',
    why: 'It is a whole body workout that builds your heart and helps your muscles use blood sugar, with no impact on your feet. Because every stroke bends the lower back under load, it is only offered once your back is ready for it.',
    mistakes: [
      {
        mistake: 'Rounding your lower back at the front',
        risk: 'Bending your lower back under load on every stroke can flare back pain, and it gets worse as you tire.',
        fix: 'Sit tall on your sit bones, hinge from your hips and shorten the slide.',
        clip: 'rowing-machine.rounded-catch',
        pose: 'At the catch the pelvis tucks under 10 to 20 degrees and the lumbar spine rounds, the shoulders reaching past the shins and the shins tipped about 10 degrees past vertical.',
      },
      {
        mistake: 'Leaning back too far at the finish',
        risk: 'Your lower back arches under load and your shoulders strain.',
        fix: 'Push with your legs first and finish only slightly behind upright.',
        clip: 'rowing-machine.big-layback',
        pose: 'At the finish the trunk leans more than 30 degrees behind vertical with the ribs flared, the lumbar spine arched about 15 degrees and the elbows flared high.',
      },
      {
        mistake: 'Pulling with your arms first',
        risk: 'Your back and arms take the load your legs should carry.',
        fix: 'Legs, then body, then arms.',
        clip: 'rowing-machine.arms-first',
        pose: 'Elbows bend 60 to 90 degrees at the very start of the drive while the knees are still fully bent and the seat has not moved.',
      },
    ],
    backSafety: {
      status: 'avoidWhenIrritable',
      note: 'Every stroke bends the lower back under load, and the finish position can tug on the sciatic nerve. Leave it out on irritable days and use the recumbent bike. When your back is calm, use short bouts, a low damper and a shorter reach.',
      regression: 'recumbent-bike',
    },
    cues: ['Can you still talk in full sentences?', 'Go by effort, not heart rate', 'Legs, body, arms', 'Tall spine, hinge from your hips', 'Shins stop at upright'],
    youtube: {
      tutorial: 'concept2 rowing technique beginners',
      mistakes: 'rowing machine common mistakes back',
    },
    sources: [
      'https://www.concept2.com/training/rowing-technique',
      'https://www.concept2.com/training/articles/damper-setting',
      'https://pubmed.ncbi.nlm.nih.gov/33397675/',
    ],
  },
];
