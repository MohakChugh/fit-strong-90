import type { Coaching } from '@/types/catalog';

/**
 * Coaching for the upper-body strength exercises: pulls, presses, shoulders
 * and arms. Drafted from docs/research/technique-upper-body.md, with the
 * back-profile variants from the guided-training spec (section 4.3).
 * seated-cable-curl is not in that doc; it follows ExRx "Cable Seated Curl"
 * and the ACE seated biceps curls. Spoken fields are written for
 * text-to-speech: plain words, numbers spelled out, no symbols or parentheses.
 */
export const UPPER_COACHING: Coaching[] = [
  {
    id: 'lat-pulldown',
    name: 'Lat Pulldown',
    summary:
      'A seated cable pull that brings a bar from overhead down to your upper chest, building the wide muscles of your back.',
    muscles: { primary: ['lats'], secondary: ['biceps', 'mid back', 'rear shoulders'] },
    equipment: 'Lat pulldown machine with a long bar or a neutral-grip handle',
    setup: [
      'Find the tall cable station with a long bar on a high pulley and a seat with knee pads.',
      'Set the knee pads so they press snugly on your thighs, with your feet flat and your knees at about a right angle.',
      'Stand up to take the bar with an overhand grip a little wider than your shoulders, then sit and lock your thighs under the pads.',
      'If there is a handle that lets your palms face each other, it is the kindest choice for your shoulders.',
    ],
    steps: [
      'Sit tall with your thighs locked under the pads.',
      'Lean back just a little and brace your belly.',
      'Draw your shoulders down, away from your ears.',
      'Drive your elbows down toward your ribs.',
      'Bring the bar to the top of your chest.',
      'Let the bar rise slowly until your arms are straight.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 1 },
    breathing:
      'Breathe out as you pull the bar down, and breathe in as it rises. Keep a light brace in your belly and keep breathing behind it, with small breaths during the short pause at your chest.',
    feel: 'You should feel the sides of your back under your armpits, the middle of your back, and your biceps.',
    shouldNotFeel:
      'You should not feel a pinch in your shoulders, strain in your neck, or an ache in your lower back. If your back aches, sit taller and lighten the stack. If your hands tingle or a shoulder pinches, stop, then switch to the palms-facing handle and a lighter weight.',
    why: 'Strong back muscles help you pull, lift and carry with good posture. The thigh pads hold your hips still, so your back muscles work while your lower back stays quiet.',
    mistakes: [
      {
        mistake: 'Leaning back and swinging',
        risk: 'Momentum does the work, and your lower back arches under load.',
        fix: 'Keep a small, fixed lean, lighten the stack, and pull with your elbows.',
        clip: 'lat-pulldown.leaning-back',
        pose: 'Seated with thighs under the pads. Trunk swings back 25 to 35 degrees past the correct 10 to 20 degree lean, lumbar spine extends about 15 degrees and the ribs flare as the bar is yanked down; the trunk then rocks forward on the return.',
      },
      {
        mistake: 'Pulling the bar behind your neck',
        risk: 'It strains your neck and pushes your shoulders to the end of their range, with no extra benefit.',
        fix: 'Pull the bar in front of your face, down to the top of your chest.',
        clip: 'lat-pulldown.behind-the-neck',
        pose: 'Head and neck flex forward 25 to 30 degrees so the bar passes behind the head to the base of the neck; elbows point straight out to the sides with the shoulders at end-range external rotation.',
      },
      {
        mistake: 'Shrugging your shoulders',
        risk: 'Your neck and the tops of your shoulders tense up and take over.',
        fix: 'Set your shoulders down first, then pull.',
        clip: 'lat-pulldown.shrugging',
        pose: 'Shoulder girdle stays elevated 3 to 5 cm toward the ears through the whole pull; the neck looks shortened and the shoulder blades never depress at the bottom of the pull.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'The thigh pads hold your hips still, which protects your lower back. Keep the lean small and avoid swinging or arching. If sitting brings on leg symptoms, stop and use a light standing cable pulldown in a staggered stance instead.',
    },
    cues: ['Shoulders down, then pull', 'Elbows to your ribs', 'Bar to your collarbone', 'Chest tall, no swinging'],
    youtube: {
      tutorial: 'lat pulldown proper form physical therapist',
      mistakes: 'lat pulldown common mistakes',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/158/seated-lat-pulldown/',
      'https://www.nasm.org/resource-center/blog/training/the-biomechanics-of-the-lat-pulldown-muscles-grip-and-form',
      'https://pubmed.ncbi.nlm.nih.gov/19855327/',
    ],
  },
  {
    id: 'assisted-pull-up',
    name: 'Assisted Pull-Up',
    summary:
      'A pull-up on a machine that takes away part of your body weight, so you can build the strength to pull yourself up.',
    muscles: { primary: ['lats'], secondary: ['biceps', 'mid back'] },
    equipment: 'Assisted pull-up machine, often labelled assisted chin and dip',
    setup: [
      'Look for the tall tower with steps, handles at the top, a moving knee pad and a weight stack.',
      'On this machine, more weight means more help, the opposite of other machines.',
      'Pick enough help to finish every rep smoothly, with two or three reps left in the tank.',
      'Climb the steps, grip the handles a little wider than your shoulders, then kneel on the pad one knee at a time and let it sink slowly.',
      'To get off, rise to the top and step back onto the steps one foot at a time.',
    ],
    steps: [
      'Hang with straight arms and your ribs down.',
      'Set your shoulders down and back.',
      'Pull your elbows down to your sides.',
      'Rise until your chin is level with your hands.',
      'Lower slowly until your arms are straight.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 1 },
    breathing:
      'Breathe out as you pull up, and breathe in as you lower. Keep the air moving at the top. If you need to hold your breath to finish a rep, add more help on the stack.',
    feel: 'You should feel the sides of your back, the middle of your back, and your biceps.',
    shouldNotFeel:
      'You should not feel a pinch in your shoulders, pain in your elbows, strain in your neck, or your lower back arching. If hanging or kneeling brings on tingling or pain down a leg, stop and switch to the lat pulldown.',
    why: 'Pulling your own body weight builds strong, useful back and arm muscles. The machine lets you choose how much help you get, so you can progress safely toward a full pull-up.',
    mistakes: [
      {
        mistake: 'Swinging and kicking up',
        risk: 'It jerks your shoulders, and bends and arches your lower back under load.',
        fix: 'Add more help and slow every rep down.',
        clip: 'assisted-pull-up.kipping',
        pose: 'Hips flex 30 to 40 degrees and then snap open to throw the body up; the body swings about 15 degrees forward and back; the lumbar spine flexes then extends each rep and the knees briefly lift off the pad.',
      },
      {
        mistake: 'Arching to reach the bar',
        risk: 'It strains your lower back and your neck.',
        fix: 'Keep your ribs down and stop with your chin level with your hands.',
        clip: 'assisted-pull-up.arched-reach',
        pose: 'At the top, the lumbar spine extends 15 to 25 degrees with the ribs flaring, and the chin juts 5 to 8 cm forward and up to clear the hands.',
      },
      {
        mistake: 'Hanging with shrugged shoulders',
        risk: 'Your shoulders hang loose under load and your neck tenses.',
        fix: 'Gently draw your shoulders down before each pull.',
        clip: 'assisted-pull-up.shrugged-hang',
        pose: 'At the bottom, the shoulders ride about 5 cm up toward the ears with the shoulder blades fully elevated, and the head pushes 3 to 5 cm forward.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Your spine stays unloaded as long as your ribs stay down. Get on and off slowly, without twisting. If hanging or kneeling brings on leg symptoms, use the lat pulldown instead.',
      regression: 'lat-pulldown',
    },
    cues: ['More weight means more help', 'Shoulders down, elbows to ribs', 'Chin to your hands', 'Slow on the way down'],
    youtube: {
      tutorial: 'assisted pull up machine how to use physical therapist',
      mistakes: 'assisted pull up machine common mistakes',
    },
    sources: [
      'https://exrx.net/WeightExercises/LatissimusDorsi/AsPullupOpenKneeling',
      'https://www.acefitness.org/resources/everyone/exercise-library/191/pull-ups/',
    ],
  },
  {
    id: 'seated-cable-row',
    name: 'Seated Cable Row',
    summary:
      'A seated pull on a low cable that draws a handle to your belly, strengthening the middle of your back.',
    muscles: { primary: ['mid back', 'lats'], secondary: ['rear shoulders', 'biceps'] },
    equipment: 'Low-pulley seated row station with a close-grip V handle',
    setup: [
      'Find the long, low bench facing a low pulley, with an angled foot plate and a close-grip handle.',
      'Sit forward with your feet on the plate and your knees well bent.',
      'Reach the handle with a long, straight back, bending your knees more if you need to.',
      'Slide your hips back until your arms are straight and the stack lifts, keeping a clear bend in your knees.',
    ],
    steps: [
      'Sit tall with your knees bent and your chest up.',
      'Brace your belly and keep your torso still.',
      'Pull the handle to your upper belly.',
      'Squeeze your shoulder blades together for one second.',
      'Straighten your arms slowly, letting only your shoulder blades slide forward.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 1 },
    breathing:
      'Breathe out as you pull, and breathe in as you return. Keep the air moving during the squeeze, and keep breathing behind a light brace.',
    feel: 'You should feel it between your shoulder blades, in the sides of your back, and in the backs of your shoulders.',
    shouldNotFeel:
      'You should not feel an ache in your lower back or a pinch in your shoulders. If you feel pain or tingling down a leg, stop and switch to the chest-supported row.',
    why: 'A strong middle back helps you sit and stand tall, and balances all the pushing you do in daily life. Keeping your torso still also trains your trunk to hold your spine steady.',
    mistakes: [
      {
        mistake: 'Rounding forward on the return',
        risk: 'It loads your lower back while it is bent, and can stretch an irritated nerve.',
        fix: 'Stay tall and let only your shoulder blades move forward.',
        clip: 'seated-cable-row.rounded-reach',
        pose: 'On the return, the trunk tips about 30 degrees forward of vertical with 20 to 30 degrees of lumbar flexion; the head drops forward and the arms are pulled long by the stack.',
      },
      {
        mistake: 'Rowing with your back',
        risk: 'Momentum takes over and your lower back arches under load.',
        fix: 'Keep your torso still and lighten the stack.',
        clip: 'seated-cable-row.leaning-back',
        pose: 'At the finish, the trunk swings 20 to 30 degrees behind vertical with about 15 degrees of lumbar extension; the torso rocks forward and back every rep.',
      },
      {
        mistake: 'Locking your knees straight',
        risk: 'It tucks your pelvis under, rounds your lower back, and puts tension on the sciatic nerve.',
        fix: 'Keep a clear bend in your knees the whole time.',
        clip: 'seated-cable-row.locked-knees',
        pose: 'Knees fully straight at 0 to 5 degrees of flexion; the pelvis tilts back about 15 degrees and the lumbar spine rounds about 20 degrees.',
      },
    ],
    backSafety: {
      status: 'avoidWhenIrritable',
      note: 'Use only the straight-back version, with your knees bent. On days when your back or leg is irritable, swap to the chest-supported row, where a pad carries your torso.',
      regression: 'chest-supported-row',
    },
    cues: ['Sit tall, ribs over hips', 'Elbows back past your ribs', 'Squeeze, then reach long', 'Torso stays still'],
    youtube: {
      tutorial: 'seated cable row form physiotherapist neutral spine',
      mistakes: 'seated cable row common mistakes',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/48/seated-row/',
      'https://exrx.net/WeightExercises/BackGeneral/CBStraightBackSeatedRow',
      'https://pubmed.ncbi.nlm.nih.gov/18391677/',
    ],
  },
  {
    id: 'one-arm-dumbbell-row',
    name: 'One-Arm Dumbbell Row',
    summary:
      'A one-arm row with your knee and hand on a bench, pulling a dumbbell toward your hip to strengthen your back.',
    muscles: { primary: ['lats', 'mid back'], secondary: ['rear shoulders', 'biceps', 'obliques'] },
    equipment: 'One dumbbell and a flat bench',
    setup: [
      'You need a flat bench and one dumbbell, placed on the end of the bench rather than the floor.',
      'Put one knee and the hand on the same side on the bench, with your hand under your shoulder and your knee under your hip.',
      'Set your other foot on the floor, slightly back and out to the side.',
      'Make your back flat like a tabletop, level across your shoulders.',
      'Take the dumbbell from the bench and let it hang below your shoulder.',
    ],
    steps: [
      'Keep your back flat and your shoulders level.',
      'Let the dumbbell hang straight down.',
      'Pull it toward your hip pocket.',
      'Stop when your elbow passes your body, with your chest square to the floor.',
      'Lower slowly to a straight arm.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 1 },
    breathing:
      'Breathe out as you row, and breathe in as you lower. Keep breathing behind a light brace, with small breaths during the short pause at the top.',
    feel: 'You should feel the side and middle of your back on the working side, and the back of that shoulder.',
    shouldNotFeel:
      'You should not feel pain in your lower back, a pinch in your shoulder, or strain in your neck. If you feel pain or tingling in your buttock or down a leg, stop and switch to the chest-supported row.',
    why: 'Working one side at a time builds even back strength and trains your trunk to resist twisting. The bench supports your spine while your back muscles do the pulling.',
    mistakes: [
      {
        mistake: 'Twisting your torso',
        risk: 'It rotates your spine while it holds a load.',
        fix: 'Keep your shoulders level and use a lighter dumbbell.',
        clip: 'one-arm-dumbbell-row.torso-twist',
        pose: 'At the top of the row, the chest opens 20 to 40 degrees toward the working side; the working shoulder rises above the support shoulder and the pelvis rotates with it.',
      },
      {
        mistake: 'Rounding or sagging your back',
        risk: 'It loads the discs of your lower back and strains your neck.',
        fix: 'Keep a flat back and look at the floor.',
        clip: 'one-arm-dumbbell-row.rounded-back',
        pose: 'Lumbar spine rounds 15 to 20 degrees and the mid back hunches; the neck extends about 30 degrees to look forward.',
      },
      {
        mistake: 'Heaving with your legs',
        risk: 'It jolts your spine on every rep.',
        fix: 'Use a lighter dumbbell and take two full seconds to pull.',
        clip: 'one-arm-dumbbell-row.leg-heave',
        pose: 'Hips and knees dip about 10 degrees and then drive up to jerk the dumbbell; the trunk bounces 5 to 10 degrees and the arm pull starts only after the heave.',
      },
    ],
    backSafety: {
      status: 'avoidWhenIrritable',
      note: 'The bench helps, but the bent-over position and handling the dumbbell can stir up sciatica. Always take the dumbbell from the bench, never the floor. On irritable days, swap to the chest-supported row.',
      regression: 'chest-supported-row',
    },
    cues: ['Flat back, like a tabletop', 'Pull to your hip pocket', 'Chest stays square', 'Long neck, eyes down'],
    youtube: {
      tutorial: 'single arm dumbbell row bench form physical therapist',
      mistakes: 'single arm dumbbell row common mistakes',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/126/single-arm-row/',
      'https://exrx.net/WeightExercises/BackGeneral/DBBentOverRow',
      'https://pubmed.ncbi.nlm.nih.gov/19197209/',
    ],
  },
  {
    id: 'chest-supported-row',
    name: 'Chest-Supported Row',
    summary:
      'A row with your chest resting on a pad, so your back muscles can pull while your spine stays supported.',
    muscles: { primary: ['mid back', 'lats'], secondary: ['rear shoulders', 'biceps'] },
    equipment: 'Chest-supported row machine, or an adjustable incline bench and a pair of dumbbells',
    setup: [
      'Use a seated row machine with an upright chest pad, or an adjustable bench with two dumbbells.',
      'On the machine, set the seat so the handles are about level with your shoulders.',
      'Move the chest pad so it just touches your chest when your arms are straight.',
      'With dumbbells, set the bench to thirty to forty-five degrees and place the dumbbells beside it first.',
      'Lie face down with your upper chest at the top edge of the pad, so the dumbbells hang clear of the floor.',
    ],
    steps: [
      'Rest your chest on the pad, with your feet planted and your neck long.',
      'Start with straight arms and your shoulder blades spread.',
      'Pull your elbows back, just past your ribs.',
      'Squeeze your shoulder blades together for one second.',
      'Reach back slowly to straight arms.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 1 },
    breathing:
      'Breathe out as you pull, and breathe in as you reach back. The pad presses on your chest, so keep your breaths small but steady, and never hold them.',
    feel: 'You should feel it between your shoulder blades and in the backs of your shoulders.',
    shouldNotFeel:
      'You should feel almost nothing in your lower back. If your neck strains or a shoulder pinches, lighten the weight and tuck your chin slightly. If the pad presses hard on your belly, raise the bench a notch or add a folded towel.',
    why: 'The pad carries your torso, so you can train your back hard with almost no load on your lower back. It is the go-to row on days when your back or leg is sensitive.',
    mistakes: [
      {
        mistake: 'Lifting your chest off the pad',
        risk: 'You lose the support and arch your lower back to heave the weight.',
        fix: 'Keep your chest glued to the pad and use a lighter load.',
        clip: 'chest-supported-row.chest-off-pad',
        pose: 'At the top of the pull, the chest lifts 5 to 10 cm off the pad, the lumbar spine extends about 15 degrees and the head tips back.',
      },
      {
        mistake: 'Craning your neck',
        risk: 'It strains your neck.',
        fix: 'Keep your chin slightly tucked and your eyes down.',
        clip: 'chest-supported-row.neck-crane',
        pose: 'Neck extends 20 to 30 degrees to look forward and the chin juts out; the rest of the body is correct.',
      },
      {
        mistake: 'Setting the pad too far away',
        risk: 'You round your back to reach the handles, loading it while it is bent.',
        fix: 'Move the pad closer so you can reach with a straight back.',
        clip: 'chest-supported-row.pad-too-far',
        pose: 'Torso rounds about 20 degrees forward through the mid and lower back to reach the handles; the shoulders protract fully and the chest barely touches the pad.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'This is the default row for back pain and sciatica, because the pad carries your torso. Get on and off without twisting.',
      regression: 'band-row',
    },
    cues: ['Chest stays on the pad', 'Elbows back, squeeze', 'Shoulders away from your ears', 'Reach long on the way back'],
    youtube: {
      tutorial: 'chest supported row incline bench dumbbell form physical therapist',
      mistakes: 'chest supported row common mistakes',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/168/seated-row/',
      'https://exrx.net/WeightExercises/BackGeneral/DBLyingRow',
      'https://exrx.net/WeightExercises/BackGeneral/LVSeatedRow',
    ],
  },
  {
    id: 'face-pull',
    name: 'Face Pull',
    summary:
      'A cable pull with a rope toward your eyes that strengthens the backs of your shoulders and your upper back.',
    muscles: { primary: ['rear shoulders', 'mid back'], secondary: ['rotator cuff'] },
    equipment: 'Adjustable cable column with a rope attachment',
    setup: [
      'Use any adjustable cable column and clip on the rope attachment.',
      'Set the pulley at about eye level.',
      'Hold the rope with an overhand grip, thumbs toward you, and step back until the cable is taut.',
      'Stand in a staggered stance with one foot forward, or sit on a bench facing the pulley, which is easier on your back.',
    ],
    steps: [
      'Stand tall with straight arms and your ribs down.',
      'Pull the rope toward your eyes.',
      'Keep your elbows high, level with your shoulders.',
      'Pull the rope apart so your hands finish beside your ears.',
      'Pause, then straighten your arms slowly.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 1 },
    breathing:
      'Breathe out as you pull, and breathe in as you return. Keep the air moving during the pause, and keep breathing behind a light brace.',
    feel: 'You should feel it in the backs of your shoulders and between your shoulder blades.',
    shouldNotFeel:
      'You should not feel strain in your neck, a pinch in your shoulders, or your lower back arching. If you have to lean back to move the weight, lighten it.',
    why: 'Strong rear shoulders and upper back balance all your pressing work and support healthy shoulders and posture. The load is light, so it is easy on your spine.',
    mistakes: [
      {
        mistake: 'Leaning back to drag the weight',
        risk: 'It arches and strains your lower back.',
        fix: 'Use a lighter weight and stand upright in a staggered stance.',
        clip: 'face-pull.leaning-back',
        pose: 'Torso leans 20 to 30 degrees back from vertical with about 15 degrees of lumbar extension and the hips pushed forward, using body weight to drag the stack.',
      },
      {
        mistake: 'Dropping your elbows',
        risk: 'It turns into a row, and the backs of your shoulders do less.',
        fix: 'Keep your elbows level with your shoulders.',
        clip: 'face-pull.dropped-elbows',
        pose: 'Elbows drop to about 45 degrees from the trunk instead of 90, and the rope is pulled to the chin rather than the eyes.',
      },
      {
        mistake: 'Pushing your head forward',
        risk: 'It strains your neck.',
        fix: 'Bring the rope to your face, not your face to the rope.',
        clip: 'face-pull.head-poke',
        pose: 'At the end of the pull, the chin and head travel about 5 cm forward to meet the rope, with the upper neck slightly extended.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'The load is light, and the main risk for your back is leaning back. Stand in a staggered stance or sit on a bench.',
      regression: 'band-pull-apart',
    },
    cues: ['Rope to your eyes', 'Elbows high', 'Pull the rope apart', 'Shoulders down, ribs down'],
    youtube: {
      tutorial: 'face pull proper form physical therapist rope cable',
      mistakes: 'face pull common mistakes',
    },
    sources: [
      'https://www.nasm.org/resource-center/exercise-library/face-pull',
      'https://exrx.net/WeightExercises/DeltoidPosterior/CBStandingRearDeltRowRope',
    ],
  },
  {
    id: 'machine-chest-press',
    name: 'Machine Chest Press',
    summary:
      'A seated machine press that pushes two handles away from your chest, building your chest, shoulders and triceps with full back support.',
    muscles: { primary: ['chest'], secondary: ['front shoulders', 'triceps'] },
    equipment: 'Seated chest press machine',
    setup: [
      'Find the seated machine with an upright backrest and two handles at chest height on lever arms.',
      'Set the seat so the handles line up with the middle of your chest.',
      'Check that the handles start no further back than the front of your chest.',
      'If there is a foot lever, use it to bring the handles forward at the start and to park them at the end.',
      'Choose the neutral handles if there are any, with your elbows about forty-five degrees from your body.',
    ],
    steps: [
      'Sit with your back on the pad and your feet flat.',
      'Draw your shoulder blades gently back and down.',
      'Press until your arms are almost straight.',
      'Keep your shoulder blades on the pad.',
      'Return slowly to chest level.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 0 },
    breathing:
      'Breathe out as you press, and breathe in as the handles return. Keep breathing steadily, and never hold your breath at either end.',
    feel: 'You should feel your chest, the fronts of your shoulders, and your triceps.',
    shouldNotFeel:
      'You should not feel pain at the front of your shoulder, your lower back arching, or elbow pain. If the stack forces your back to arch, the weight is too heavy, so lighten it.',
    why: 'The fixed path and full back support let you build pressing strength safely. It is the default chest exercise on days when your back needs care.',
    mistakes: [
      {
        mistake: 'Setting the seat too low',
        risk: 'Your shoulders hunch up and get pinched.',
        fix: 'Raise the seat so the handles are at mid-chest.',
        clip: 'machine-chest-press.seat-too-low',
        pose: 'Handles sit 8 to 10 cm above the nipple line, the elbows flare to about 90 degrees from the torso and the shoulders shrug about 3 cm.',
      },
      {
        mistake: 'Starting too deep',
        risk: 'It strains the front of your shoulders and your chest.',
        fix: 'Set the handles so they start no deeper than your chest.',
        clip: 'machine-chest-press.too-deep',
        pose: 'At the start, the elbows sit 10 to 15 cm behind the plane of the back, with the shoulders horizontally abducted past neutral and the chest on a hard stretch.',
      },
      {
        mistake: 'Arching off the pad',
        risk: 'It loads your lower back in an arched position.',
        fix: 'Keep your buttocks and upper back on the pad, and lighten the weight.',
        clip: 'machine-chest-press.arching',
        pose: 'Lumbar spine extends 15 to 25 degrees away from the pad, the hips lift slightly off the seat and the ribs flare.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'The fixed path and full back support make this the default press for back pain. If you have to arch to move the weight, it is too heavy.',
      regression: 'incline-push-up',
    },
    cues: ['Handles at mid-chest', 'Shoulder blades stay back', 'Soft elbows at the end', 'Slow return'],
    youtube: {
      tutorial: 'chest press machine seat height setup proper form',
      mistakes: 'chest press machine common mistakes',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/188/seated-chest-press/',
      'https://www.nasm.org/resource-center/exercise-library/chest-press-machine',
      'https://exrx.net/WeightExercises/PectoralSternal/LVChestPress',
    ],
  },
  {
    id: 'dumbbell-bench-press',
    name: 'Dumbbell Bench Press',
    summary:
      'A press lying on a flat bench that pushes two dumbbells up from your chest, building your chest, shoulders and triceps.',
    muscles: { primary: ['chest'], secondary: ['front shoulders', 'triceps'] },
    equipment: 'Flat bench and a pair of dumbbells',
    setup: [
      'You need a flat bench and a pair of dumbbells you can easily lift to your thighs.',
      'Sit on the end of the bench with the dumbbells resting on your thighs.',
      'Lie back with them held tight to your chest, using your knees to help.',
      'Plant your feet on the floor, or on a low step if your back arches, with your head, shoulders and buttocks on the bench.',
      'To finish, bring the dumbbells to your chest, then your thighs, rock up to sitting, and pause a few seconds before you stand.',
    ],
    steps: [
      'Draw your shoulder blades down and back.',
      'Start with straight arms over your shoulders.',
      'Lower the dumbbells slowly to the sides of your chest.',
      'Keep your elbows about forty-five degrees from your body.',
      'Press up and slightly in.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 0 },
    breathing:
      'Breathe in as you lower, and breathe out as you press. Keep breathing as you turn at the bottom, and never hold your breath there.',
    feel: 'You should feel your chest, the fronts of your shoulders, and your triceps.',
    shouldNotFeel:
      'You should not feel pain at the front of your shoulder, in your lower back, or in your wrists. If getting into position hurts your back, switch to the machine chest press.',
    why: 'Dumbbells let each arm move freely in a shoulder-friendly path, building even pushing strength on both sides.',
    mistakes: [
      {
        mistake: 'Flaring your elbows out wide',
        risk: 'It stresses the front of your shoulders.',
        fix: 'Keep your elbows at about forty-five degrees, like an arrow, not a T.',
        clip: 'dumbbell-bench-press.flared-elbows',
        pose: 'Elbows abducted to about 90 degrees from the torso in a T shape, with the dumbbells drifting toward the line of the neck at the bottom.',
      },
      {
        mistake: 'Arching your back high off the bench',
        risk: 'It squeezes the joints of your lower back.',
        fix: 'Put your feet flat on the floor or a step, and keep your ribs down.',
        clip: 'dumbbell-bench-press.big-arch',
        pose: 'Lumbar spine lifts 5 to 8 cm off the bench in extension, the ribs flare and the hips start to rise.',
      },
      {
        mistake: 'Dropping the dumbbells to the sides',
        risk: 'It wrenches your shoulders and twists your back.',
        fix: 'Bring them to your chest, then your thighs, then rock up.',
        clip: 'dumbbell-bench-press.dumping',
        pose: 'From lockout, both arms fall out to the sides with the elbows straightening and the shoulders horizontally abducted past the body line; the trunk twists about 20 degrees as one dumbbell is lowered toward the floor.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'Getting into and out of position is the riskiest part, so use dumbbells you can bring to your thighs easily, and keep your feet on the floor or a step. If the rock-up stirs up your back, switch to the machine chest press.',
      regression: 'machine-chest-press',
    },
    cues: ['Shoulder blades down and back', 'Elbows at forty-five', 'Lower slowly to your chest', 'Press up and together'],
    youtube: {
      tutorial: 'dumbbell bench press form how to get dumbbells into position safely',
      mistakes: 'dumbbell bench press common mistakes',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/19/chest-press/',
      'https://exrx.net/WeightExercises/PectoralSternal/DBBenchPress',
    ],
  },
  {
    id: 'incline-dumbbell-press',
    name: 'Incline Dumbbell Press',
    summary:
      'A dumbbell press on a low incline bench that targets your upper chest, along with your shoulders and triceps.',
    muscles: { primary: ['upper chest'], secondary: ['front shoulders', 'triceps'] },
    equipment: 'Adjustable bench and a pair of dumbbells',
    setup: [
      'Set an adjustable bench to about thirty degrees, and never more than forty-five.',
      'Raise the seat pad one notch so you do not slide down.',
      'Sit with the dumbbells on your thighs, then lean back and bring them to your upper chest as you go.',
      'Plant your feet and keep your head, shoulders and buttocks on the pad.',
      'To finish, bring the dumbbells to your chest, then your thighs, and sit up slowly.',
    ],
    steps: [
      'Draw your shoulder blades down and back.',
      'Press the dumbbells up to start, arms straight over your shoulders.',
      'Lower them slowly to the sides of your upper chest.',
      'Keep your elbows about forty-five degrees from your body.',
      'Press back up over your shoulders, not over your face.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 0 },
    breathing:
      'Breathe in as you lower, and breathe out as you press. Keep breathing smoothly, and never hold your breath at the bottom.',
    feel: 'You should feel your upper chest, the fronts of your shoulders, and your triceps.',
    shouldNotFeel:
      'You should not feel pain at the front of your shoulder, your lower back arching, or strain in your neck. If getting into position hurts your back, switch to the machine chest press.',
    why: 'A low incline puts more of the work on your upper chest than a flat press. The bench supports your whole back while you press.',
    mistakes: [
      {
        mistake: 'Setting the bench too steep',
        risk: 'It becomes a shoulder press, and the fronts of your shoulders take over.',
        fix: 'Lower the bench to about thirty degrees.',
        clip: 'incline-dumbbell-press.bench-too-steep',
        pose: 'Back pad set at 45 to 60 degrees so the torso is nearly upright and the pressing path turns overhead.',
      },
      {
        mistake: 'Lowering toward your neck with flared elbows',
        risk: 'It stresses your shoulders.',
        fix: 'Keep your elbows at about forty-five degrees and lower to your upper chest.',
        clip: 'incline-dumbbell-press.flared-elbows',
        pose: 'Elbows abducted about 90 degrees from the torso, with the dumbbells lowered toward the neck rather than the upper chest.',
      },
      {
        mistake: 'Sliding down and arching',
        risk: 'It strains your lower back.',
        fix: 'Raise the seat one notch and keep your buttocks back.',
        clip: 'incline-dumbbell-press.slide-and-arch',
        pose: 'Hips slide 5 to 10 cm forward down the seat and the lumbar spine arches 15 to 20 degrees away from the pad.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'The pad supports your spine, so just watch for sliding and arching. If lifting the dumbbells into position hurts, switch to the machine chest press.',
      regression: 'machine-chest-press',
    },
    cues: ['Bench low, about thirty degrees', 'Elbows at forty-five', 'Press up over your shoulders', 'Slow to the upper chest'],
    youtube: {
      tutorial: 'incline dumbbell press bench angle form physical therapist',
      mistakes: 'incline dumbbell press common mistakes',
    },
    sources: [
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC7579505/',
      'https://www.acefitness.org/resources/everyone/exercise-library/25/incline-chest-press/',
      'https://exrx.net/WeightExercises/PectoralClavicular/DBInclineBenchPress',
    ],
  },
  {
    id: 'cable-fly',
    name: 'Cable Fly',
    summary:
      'A standing cable exercise that sweeps your arms together in front of your chest, like hugging a big tree, to work your chest.',
    muscles: { primary: ['chest'], secondary: ['front shoulders'] },
    equipment: 'Cable crossover station with two single handles',
    setup: [
      'Find the cable crossover, two tall towers with adjustable pulleys joined by an overhead bar.',
      'Set both pulleys at shoulder height or a little above, with a single handle on each.',
      'Take one handle, then the other, and step forward into a staggered stance.',
      'Lean forward slightly from your hips, and set a soft bend in your elbows that stays fixed.',
    ],
    steps: [
      'Stand in a staggered stance with your chest proud.',
      'Open your arms with your elbows softly bent.',
      'Hug the handles together in front of your chest.',
      'Squeeze for one second, with your hands meeting, not crossing.',
      'Open slowly, stopping when your hands are level with your chest.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 1 },
    breathing:
      'Breathe out as your hands come together, and breathe in as you open. Keep the air moving during the squeeze.',
    feel: 'You should feel your chest and the fronts of your shoulders.',
    shouldNotFeel:
      'You should not feel a pulling pain at the front of your shoulder when your arms are open, strain in your lower back, or elbow pain. If your back complains, switch to a seated pec deck or the machine chest press.',
    why: 'The cables keep tension on your chest through the whole movement, building chest strength without heavy loads on your joints.',
    mistakes: [
      {
        mistake: 'Pressing instead of hugging',
        risk: 'Your elbows bend and straighten, so it turns into a press and your chest does less.',
        fix: 'Lock the soft bend in your elbows and sweep your arms.',
        clip: 'cable-fly.pressing',
        pose: 'Elbows bend from about 20 degrees to about 90 degrees as the hands come in, then straighten again, so the hands push forward like a press.',
      },
      {
        mistake: 'Opening too far',
        risk: 'It strains the front of your shoulders and your chest.',
        fix: 'Open only until your hands are level with your chest.',
        clip: 'cable-fly.over-stretch',
        pose: 'At the open position, the hands travel 20 to 30 cm behind the body line, with the shoulders horizontally abducted past neutral and the chest on a hard stretch.',
      },
      {
        mistake: 'Hunching forward',
        risk: 'It rounds your back and adds strain to your shoulders.',
        fix: 'Stay tall, with only a slight lean from your hips.',
        clip: 'cable-fly.hunching',
        pose: 'Trunk flexes 30 to 45 degrees forward with the back rounded, the shoulders roll forward and the head drops.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'The cables pull you backward, so a staggered stance keeps your back from arching. Take and return the handles without twisting. On irritable days, use a seated pec deck or the machine chest press.',
      regression: 'machine-chest-press',
    },
    cues: ['Hug a big tree', 'Elbows soft and fixed', 'Squeeze your chest', 'Open only to chest level'],
    youtube: {
      tutorial: 'cable chest fly proper form physical therapist',
      mistakes: 'cable chest fly common mistakes shoulder safe',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/160/standing-chest-fly/',
      'https://www.acefitness.org/resources/everyone/exercise-library/163/standing-incline-cable-flyes/',
      'https://www.nasm.org/resource-center/exercise-library/cable-crossover',
    ],
  },
  {
    id: 'push-ups',
    name: 'Push-Ups',
    summary:
      'A body weight press where you lower your chest and push back up, with easier versions using a wall or a bench.',
    muscles: { primary: ['chest'], secondary: ['triceps', 'front shoulders', 'abs', 'glutes'] },
    equipment: 'Floor or mat; a wall, bench or racked bar for the incline version',
    setup: [
      'Choose a height for your hands, from a wall, to a bench, to the floor.',
      'The higher your hands, the easier it is.',
      'Place your hands slightly wider than your shoulders, level with your chest.',
      'Step your feet back so your body makes one straight line from head to heels.',
      'If your wrists are sore, grip dumbbell handles instead of pressing your palms flat.',
    ],
    steps: [
      'Hold one straight line from your head to your heels.',
      'Brace your belly and squeeze your glutes.',
      'Lower your chest, with your elbows about forty-five degrees from your body.',
      'Stop just short of touching, with your body still straight.',
      'Push away until your arms are straight.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 0 },
    breathing:
      'Breathe in as you lower, and breathe out as you push up. Keep breathing behind a light brace.',
    feel: 'You should feel your chest, your triceps, the fronts of your shoulders, and your belly working to keep you straight.',
    shouldNotFeel:
      'You should not feel an ache in your lower back from sagging, or pain in your wrists or shoulders. If your hips sag, raise your hands to a higher surface.',
    why: 'Push-ups build pressing strength and train your trunk to hold a straight line, with no equipment needed. The incline lets you match the challenge to your strength.',
    mistakes: [
      {
        mistake: 'Letting your hips sag',
        risk: 'It arches and loads your lower back.',
        fix: 'Brace and squeeze your glutes, or raise your hands higher.',
        clip: 'push-ups.sagging-hips',
        pose: 'Pelvis drops 5 to 10 cm below the head-to-heel line and the lumbar spine extends 15 to 25 degrees, with the belly hanging toward the floor.',
      },
      {
        mistake: 'Flaring your elbows out wide',
        risk: 'It stresses your shoulders.',
        fix: 'Keep your elbows at about forty-five degrees.',
        clip: 'push-ups.flared-elbows',
        pose: 'Elbows abducted to about 90 degrees from the torso in a T shape, with the hands placed level with the face instead of the chest.',
      },
      {
        mistake: 'Dropping your head',
        risk: 'It strains your neck and shortens each rep.',
        fix: 'Lead with your chest, not your chin.',
        clip: 'push-ups.head-drop',
        pose: 'Neck flexes about 30 degrees so the nose reaches toward the floor first while the chest stays high.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'Use the incline height that keeps your body straight with no sagging, and avoid clapping or jumping push-ups. With severe diabetic eye disease, avoid feet-raised push-ups, because they put your head below your heart.',
      regression: 'incline-push-up',
    },
    cues: ['One straight line, head to heels', 'Elbows at forty-five', 'Lead with your chest, not your chin', 'Push the floor away'],
    youtube: {
      tutorial: 'push up proper form physical therapist incline progression',
      mistakes: 'push up common mistakes',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/41/push-up/',
      'https://exrx.net/WeightExercises/PectoralSternal/BWPushup',
      'https://pubmed.ncbi.nlm.nih.gov/16540847/',
    ],
  },
  {
    id: 'assisted-dips',
    name: 'Assisted Dips',
    summary:
      'A dip on a machine that takes away part of your body weight, lowering and pressing yourself up to work your triceps and chest.',
    muscles: { primary: ['triceps', 'chest'], secondary: ['front shoulders'] },
    equipment: 'Assisted dip machine, usually the same tower as the assisted pull-up',
    setup: [
      'Use the assisted tower with dip handles at waist height, a knee pad and a weight stack.',
      'Remember that more weight on the stack means more help.',
      'Step up, grip the handles about shoulder width apart, straighten your arms, then kneel on the pad one knee at a time.',
      'Stay upright to work your triceps more, or lean slightly forward to work your chest more.',
    ],
    steps: [
      'Start with straight arms, your shoulders down and your chest proud.',
      'Lean forward slightly.',
      'Bend your elbows to lower yourself, letting your elbows travel back.',
      'Stop when your upper arms are about level with the floor.',
      'Press back up to straight arms.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 0 },
    breathing:
      'Breathe in as you lower, and breathe out as you press up. If you need to hold your breath to finish a rep, add more help on the stack.',
    feel: 'You should feel the backs of your upper arms, your lower chest, and the fronts of your shoulders.',
    shouldNotFeel:
      'You should not feel sharp pain at the front of your shoulder, pain in your breastbone or ribs, or elbow pain. If you do, stop higher up, or switch to the rope pushdown.',
    why: 'Dips build strong triceps and chest muscles for pushing yourself up from a chair or the floor. The machine lets you choose how much help you get.',
    mistakes: [
      {
        mistake: 'Sinking too deep',
        risk: 'It pushes your shoulders to the limit of their range.',
        fix: 'Stop when your upper arms are level with the floor.',
        clip: 'assisted-dips.too-deep',
        pose: 'Shoulders sink below the elbows and roll forward, with shoulder extension close to its limit of about 85 to 90 degrees and the elbows bent well past 90 degrees.',
      },
      {
        mistake: 'Flaring your elbows out',
        risk: 'It strains your elbows and shoulders.',
        fix: 'Let your elbows travel straight back.',
        clip: 'assisted-dips.flared-elbows',
        pose: 'Elbows flare 45 to 60 degrees out to the sides during the lowering instead of tracking backward.',
      },
      {
        mistake: 'Arching your back on the pad',
        risk: 'It strains your lower back.',
        fix: 'Keep your ribs down and your glutes gently squeezed.',
        clip: 'assisted-dips.arched-back',
        pose: 'Kneeling on the pad, the lumbar spine extends 15 to 20 degrees, the pelvis tips forward and the ribs flare.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Your spine carries little load as long as your ribs stay down. Get on and off without twisting. Do not swap in bench dips, which push your shoulders much further.',
      regression: 'rope-pushdown',
    },
    cues: ['Shoulders down, long neck', 'Elbows back, not out', 'Stop at parallel', 'Press tall'],
    youtube: {
      tutorial: 'assisted dip machine form shoulder safe depth physical therapist',
      mistakes: 'assisted dip machine common mistakes',
    },
    sources: [
      'https://exrx.net/WeightExercises/PectoralSternal/AsChestDip',
      'https://e3rehab.com/how-to-perform-dips/',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC9603242/',
    ],
  },
  {
    id: 'machine-shoulder-press',
    name: 'Machine Shoulder Press',
    summary:
      'A seated machine press that pushes two handles overhead, strengthening your shoulders and triceps with full back support.',
    muscles: { primary: ['front shoulders'], secondary: ['side shoulders', 'triceps', 'upper chest'] },
    equipment: 'Seated shoulder press machine',
    setup: [
      'Find the upright seat with a tall backrest and two handles beside your head on lever arms.',
      'Set the seat so the handles start level with, or just above, your shoulders.',
      'Sit with your back and head on the pad.',
      'Use the neutral handles if there are any, with your elbows slightly in front of your body.',
      'Avoid a very wide grip.',
    ],
    steps: [
      'Keep your back and head on the pad.',
      'Hold the handles at shoulder height, with your elbows slightly forward.',
      'Press up until your arms are almost straight.',
      'Keep your ribs down and your back on the pad.',
      'Pull the handles down slowly to shoulder height.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 0 },
    breathing:
      'Breathe out as you press up, and breathe in as you lower. Keep breathing behind a light brace.',
    feel: 'You should feel the fronts and sides of your shoulders, and your triceps.',
    shouldNotFeel:
      'You should not feel pain at the top or front of your shoulder, neck pain, or your lower back arching. If a shoulder pinches, use a closer grip with your palms facing each other, or lighten the weight.',
    why: 'Pressing overhead keeps your shoulders strong for lifting things onto shelves. The backrest lets you do it without arching your lower back.',
    mistakes: [
      {
        mistake: 'Arching off the pad',
        risk: 'It squeezes the joints of your lower back.',
        fix: 'Keep your back on the pad and lighten the weight.',
        clip: 'machine-shoulder-press.arching',
        pose: 'Lumbar spine extends 15 to 25 degrees with the ribs flaring, and the upper back lifts about 5 cm off the pad at lockout.',
      },
      {
        mistake: 'Setting the seat too low',
        risk: 'It forces your shoulders through a deep, strained range.',
        fix: 'Raise the seat so the handles start at shoulder height.',
        clip: 'machine-shoulder-press.seat-too-low',
        pose: 'Handles start about 10 cm below the shoulders, and the elbows drop below the handles at the bottom of each rep.',
      },
      {
        mistake: 'Flaring your elbows straight out',
        risk: 'It can pinch the top of your shoulders.',
        fix: 'Keep your elbows slightly forward and use the neutral handles.',
        clip: 'machine-shoulder-press.flared-elbows',
        pose: 'Wide grip with the elbows flared directly out to the sides in the frontal plane, upper arms at 90 degrees to the torso and in line with the shoulders.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'The backrest makes this the default overhead press for back pain. Pressing without the backrest is only for people without back symptoms.',
    },
    cues: ['Back flat on the pad', 'Elbows slightly forward', 'Press up, ribs down', 'Pull it down slowly'],
    youtube: {
      tutorial: 'machine shoulder press seat height setup proper form',
      mistakes: 'machine shoulder press common mistakes',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/186/seated-shoulder-press/',
      'https://www.acefitness.org/resources/everyone/exercise-library/187/seated-machine-close-grip-shoulder-press/',
      'https://exrx.net/WeightExercises/DeltoidAnterior/LVShoulderPress',
    ],
  },
  {
    id: 'dumbbell-shoulder-press',
    name: 'Seated Dumbbell Shoulder Press',
    summary:
      'A seated, back-supported press that pushes two dumbbells overhead to build your shoulders and triceps.',
    muscles: { primary: ['front shoulders'], secondary: ['side shoulders', 'triceps', 'upper chest'] },
    equipment: 'Adjustable bench set upright and a pair of dumbbells',
    setup: [
      'Set an adjustable bench with the back pad upright, or one notch back from upright.',
      'Sit with your head, shoulders and buttocks on the pad, and your feet flat and wider than your hips.',
      'Lift the dumbbells from your thighs to your shoulders one at a time.',
      'Start with your wrists stacked over your elbows and your elbows slightly forward.',
      'Turning your palms to face each other is kinder to your shoulders.',
    ],
    steps: [
      'Keep your back on the pad and your feet wide.',
      'Hold the dumbbells at shoulder height, wrists over elbows.',
      'Press up until your arms are straight.',
      'Keep your lower back against the pad.',
      'Lower slowly to shoulder height.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 0 },
    breathing:
      'Breathe out as you press up, and breathe in as you lower. Keep breathing behind a light brace.',
    feel: 'You should feel your shoulders and your triceps.',
    shouldNotFeel:
      'You should not feel pressure in your lower back, a pinch at the top of your shoulder, or neck pain. If your back complains, switch to the machine shoulder press.',
    why: 'Dumbbells let each arm press on its own path, building balanced shoulder strength. Sitting with your back on the pad keeps your lower back out of the work.',
    mistakes: [
      {
        mistake: 'Leaning back to press',
        risk: 'It arches and loads your lower back.',
        fix: 'Keep your back on the pad and use lighter dumbbells.',
        clip: 'dumbbell-shoulder-press.leaning-back',
        pose: 'Hips slide 5 to 10 cm forward on the seat and the trunk reclines 15 to 25 degrees away from the pad, with the lumbar spine arching.',
      },
      {
        mistake: 'Elbows drifting behind your body',
        risk: 'It stresses the front of your shoulders.',
        fix: 'Bring your elbows slightly in front of your body.',
        clip: 'dumbbell-shoulder-press.elbows-back',
        pose: 'At the bottom, the elbows sit about 10 cm behind the line of the ears, with the upper arms pulled back in the frontal plane instead of about 30 degrees forward.',
      },
      {
        mistake: 'Letting the dumbbells drift out wide',
        risk: 'It strains your shoulders.',
        fix: 'Keep your wrists stacked over your elbows.',
        clip: 'dumbbell-shoulder-press.drifting-dumbbells',
        pose: 'Wrists drift 10 to 15 cm outside the elbows, with the forearms tilted outward through the press.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'Do this seated with your back supported only, because standing presses ask much more of your trunk. On irritable days, use the machine shoulder press.',
      regression: 'machine-shoulder-press',
    },
    cues: ['Back on the pad', 'Wrists over elbows', 'Press up, ribs down', 'Control to your shoulders'],
    youtube: {
      tutorial: 'seated dumbbell shoulder press form back support physical therapist',
      mistakes: 'seated dumbbell shoulder press common mistakes',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/45/seated-overhead-press/',
      'https://exrx.net/WeightExercises/DeltoidAnterior/DBShoulderPress',
      'https://pubmed.ncbi.nlm.nih.gov/23096062/',
    ],
  },
  {
    id: 'landmine-press',
    name: 'Half-Kneeling Landmine Press',
    summary:
      'A one-arm press of a barbell anchored at one end, pushing up and forward from a half kneeling position in a shoulder-friendly arc.',
    muscles: { primary: ['front shoulders', 'upper chest'], secondary: ['triceps', 'obliques', 'glutes'] },
    equipment: 'Landmine sleeve, or a barbell end wedged into a corner on a towel, with small plates, a knee pad and a box',
    setup: [
      'Look for a barbell with one end in a floor swivel, or wedge one end into a corner on a towel.',
      'Load small plates, and rest the free end of the bar on a box so you never lift it from the floor.',
      'Half kneel facing the bar, with the knee on your pressing side down on a pad and your front knee at a right angle.',
      'Lift the bar end from the box to the front of your shoulder, with your elbow under your hand.',
    ],
    steps: [
      'Kneel tall with your hips over your down knee, and squeeze the glute of that leg.',
      'Hold the bar at your shoulder, with your ribs down.',
      'Press up and forward until your arm is straight.',
      'Let your shoulder blade reach forward at the top.',
      'Lower slowly back to your shoulder.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 0 },
    breathing:
      'Breathe out as you press, and breathe in as you lower. Keep breathing behind a light brace.',
    feel: 'You should feel the front of your shoulder, your upper chest and triceps, the side of your trunk, and the glute of your down leg.',
    shouldNotFeel:
      'You should not feel a pinch at the top of your shoulder, your lower back arching, or pain in your kneeling knee. If kneeling hurts, add more padding or use the machine shoulder press.',
    why: 'The angled path lets you press up and out without taking your shoulder to the end of its range. Kneeling removes leg drive and helps keep your lower back from arching.',
    mistakes: [
      {
        mistake: 'Arching your lower back',
        risk: 'It loads your lower back in an arched position.',
        fix: 'Keep your ribs down and the glute of your down leg squeezed.',
        clip: 'landmine-press.arching',
        pose: 'Lumbar spine extends 15 to 20 degrees, the ribs flare and the pelvis tips forward over the down knee as the bar is pressed.',
      },
      {
        mistake: 'Twisting to drive the bar',
        risk: 'It twists your spine under load.',
        fix: 'Keep your hips and shoulders square to the bar.',
        clip: 'landmine-press.twisting',
        pose: 'Trunk rotates 20 to 30 degrees toward the non-pressing side to drive the bar, with the pressing shoulder swinging forward and the hips turning with it.',
      },
      {
        mistake: 'Pressing across your body',
        risk: 'It puts your shoulder in a weaker, strained position.',
        fix: 'Press straight out, in line with your shoulder.',
        clip: 'landmine-press.pressing-across',
        pose: 'At lockout, the hand finishes 10 to 15 cm past the midline of the body, with the arm crossing in front of the face.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'The arc is easier on your shoulder than a straight overhead press, and kneeling discourages arching. Always lift the bar end from a box, never the floor. If kneeling is uncomfortable, use the machine shoulder press.',
      regression: 'machine-shoulder-press',
    },
    cues: ['Squeeze the down-side glute', 'Ribs down', 'Press up and out, not across', 'Chin tucked'],
    youtube: {
      tutorial: 'half kneeling landmine press form physical therapist',
      mistakes: 'landmine press common mistakes',
    },
    sources: [
      'https://www.acefitness.org/continuing-education/certified/september-2025/8948/the-ace-workout-builder-for-landmine-training/',
      'https://ericcressey.com/strength-exercise-of-the-week-half-kneeling-1-arm-landmine-press/',
      'https://theprehabguys.com/blog/landmine-exercises/',
    ],
  },
  {
    id: 'lateral-raises',
    name: 'Lateral Raises',
    summary: 'A light dumbbell raise out to your sides that builds the sides of your shoulders.',
    muscles: { primary: ['side shoulders'], secondary: ['front shoulders', 'rotator cuff'] },
    equipment: 'A pair of light dumbbells, and a bench with back support for the seated version',
    setup: [
      'Take a pair of light dumbbells from the rack at thigh height.',
      'Stand with your feet hip width apart, or sit on a bench with back support, which is easier on your back.',
      'Hold the dumbbells at your sides with your palms facing in and your elbows slightly bent.',
      'A small forward lean from your hips is fine.',
    ],
    steps: [
      'Stand or sit tall, with your elbows soft.',
      'Draw your shoulders down, away from your ears.',
      'Raise your arms out to the sides and slightly forward.',
      'Stop at shoulder height, with your elbows level with or just above your wrists.',
      'Lower slowly.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 1 },
    breathing:
      'Breathe out as you raise, and breathe in as you lower. Keep the air moving during the short pause at the top.',
    feel: 'You should feel the sides of your shoulders.',
    shouldNotFeel:
      'You should not feel a pinch at the top of your shoulder, strain in your neck, or your lower back working. If a shoulder pinches, stop a little lower and keep your thumbs level.',
    why: 'Strong side shoulders help you lift your arms out to the side and keep your shoulders stable. Light weights are all it takes, so the load on your spine is tiny.',
    mistakes: [
      {
        mistake: 'Swinging the weights up',
        risk: 'Momentum takes over and your lower back arches.',
        fix: 'Use lighter dumbbells, or sit down.',
        clip: 'lateral-raises.swinging',
        pose: 'Hips hinge about 15 degrees and then snap upright, and the trunk leans 10 to 15 degrees back at the top with lumbar extension as the dumbbells are flung up.',
      },
      {
        mistake: 'Shrugging your shoulders',
        risk: 'Your neck muscles take over and tighten.',
        fix: 'Reach for the walls, not the ceiling.',
        clip: 'lateral-raises.shrugging',
        pose: 'Shoulders elevate 3 to 5 cm toward the ears as the arms rise, shortening the neck.',
      },
      {
        mistake: 'Raising too high with your thumbs down',
        risk: 'It can pinch the top of your shoulder.',
        fix: 'Stop at shoulder height with your thumbs level.',
        clip: 'lateral-raises.jug-pour',
        pose: 'Arms raised past 100 degrees of abduction with the shoulders internally rotated, so the thumbs point down like pouring a jug.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Keep the weights light and do not swing. On irritable days, sit on a bench with back support.',
    },
    cues: ['Reach out, not up', 'Lead with your elbows', 'Shoulders down', 'Stop at shoulder height'],
    youtube: {
      tutorial: 'dumbbell lateral raise form physical therapist',
      mistakes: 'dumbbell lateral raise common mistakes shoulder impingement',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/26/lateral-raise/',
      'https://exrx.net/WeightExercises/DeltoidLateral/DBLateralRaise',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC7503819/',
    ],
  },
  {
    id: 'rear-delt-fly',
    name: 'Chest-Supported Rear Delt Fly',
    summary:
      'A light dumbbell fly with your chest on an incline bench, opening your arms wide to strengthen the backs of your shoulders.',
    muscles: { primary: ['rear shoulders'], secondary: ['mid back', 'rotator cuff'] },
    equipment: 'Adjustable incline bench and light dumbbells, or a reverse pec deck machine',
    setup: [
      'Set an adjustable bench to forty-five to sixty degrees.',
      'Place light dumbbells beside the bench, then sit facing the back pad with your chest resting on it.',
      'Let the dumbbells hang below your shoulders, with your palms facing each other and your elbows soft.',
      'On a reverse pec deck, sit facing the pad, with the seat set so the handles are at shoulder height, and grip with your thumbs up.',
    ],
    steps: [
      'Rest your chest on the pad, with your arms hanging and your elbows soft.',
      'Draw your shoulders down, away from your ears.',
      'Open your arms wide to the sides.',
      'Stop at shoulder height, with your hands in line with your ears.',
      'Lower slowly.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 1 },
    breathing:
      'Breathe out as you open your arms, and breathe in as you lower. The pad presses on your chest, so keep your breaths small and steady.',
    feel: 'You should feel the backs of your shoulders and your upper back.',
    shouldNotFeel:
      'You should not feel strain in your neck, a pinch in your shoulder, or any work in your lower back. If your chest lifts off the pad, lighten the weights.',
    why: 'Strong rear shoulders balance all the pushing and reaching forward you do each day. The pad holds your torso, so your lower back stays out of it.',
    mistakes: [
      {
        mistake: 'Lifting your chest off the pad',
        risk: 'You lose the support and arch your lower back.',
        fix: 'Keep your chest on the pad and use lighter weights.',
        clip: 'rear-delt-fly.chest-off-pad',
        pose: 'At the top, the chest lifts 5 to 10 cm off the pad, the lumbar spine extends about 15 degrees and the head tips back.',
      },
      {
        mistake: 'Sweeping your elbows toward your hips',
        risk: 'It turns into a row, and your big back muscles take over from your rear shoulders.',
        fix: 'Keep your upper arms at right angles to your body.',
        clip: 'rear-delt-fly.elbows-to-hips',
        pose: 'Elbows sweep about 45 degrees down toward the hips during the lift, so the upper arms are no longer perpendicular to the torso.',
      },
      {
        mistake: 'Bending your elbows more and more',
        risk: 'The fly becomes a pull, taking work away from the backs of your shoulders.',
        fix: 'Fix the soft bend in your elbows.',
        clip: 'rear-delt-fly.bending-elbows',
        pose: 'Elbow flexion increases from about 20 degrees to about 90 degrees over the set, so the dumbbells are pulled up rather than swept out.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'Only do this with your chest supported on a bench, or on a reverse pec deck. Never use the bent-over version, which holds your back in a long forward bend.',
      regression: 'band-pull-apart',
    },
    cues: ['Chest stays on the pad', 'Open wide like wings', 'Shoulders away from your ears', 'Stop at shoulder height'],
    youtube: {
      tutorial: 'chest supported rear delt fly incline bench form',
      mistakes: 'rear delt fly common mistakes',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/34/incline-reverse-fly/',
      'https://exrx.net/WeightExercises/DeltoidPosterior/LVRearLateralRaise',
      'https://exrx.net/WeightExercises/DeltoidPosterior/DBRearLateralRaise',
    ],
  },
  {
    id: 'arnold-press',
    name: 'Seated Arnold Press',
    summary:
      'A seated, back-supported dumbbell press that turns your palms from facing you to facing forward as you press overhead.',
    muscles: { primary: ['front shoulders'], secondary: ['side shoulders', 'triceps', 'rotator cuff'] },
    equipment: 'Adjustable bench set upright and a pair of light dumbbells',
    setup: [
      'Set an adjustable bench with the back pad upright, the same as for the seated shoulder press.',
      'Sit with your head, shoulders and buttocks on the pad and your feet flat.',
      'Choose lighter dumbbells than your normal press, and lift them from your thighs one at a time.',
      'Start with the dumbbells in front of your shoulders at chin height, palms facing you.',
    ],
    steps: [
      'Keep your back on the pad, with the dumbbells at chin height and your palms facing you.',
      'Open your elbows out to the sides as you start to press.',
      'Turn your palms forward as the dumbbells rise.',
      'Finish with your arms straight overhead.',
      'Reverse the turn on the way down.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 0 },
    breathing:
      'Breathe out as you press and turn, and breathe in as you lower. Keep breathing behind a light brace.',
    feel: 'You should feel the fronts and sides of your shoulders, and your triceps.',
    shouldNotFeel:
      'You should not feel catching or pinching in your shoulder during the turn, wrist pain, or strain in your lower back. If a shoulder catches, switch to the seated dumbbell shoulder press with your palms facing each other.',
    why: 'The turning press works your shoulders through a wide range in one smooth movement. It is an optional variety lift, so keep it light and smooth.',
    mistakes: [
      {
        mistake: 'Leaning back off the pad',
        risk: 'It arches and loads your lower back.',
        fix: 'Keep your back on the pad and use lighter dumbbells.',
        clip: 'arnold-press.leaning-back',
        pose: 'Trunk reclines 15 to 25 degrees off the back pad with the lumbar spine extending and the hips sliding forward on the seat.',
      },
      {
        mistake: 'Twisting only your wrists',
        risk: 'It misses the shoulder work that is the point of the lift.',
        fix: 'Open your elbows out first, then turn your palms.',
        clip: 'arnold-press.wrist-only-twist',
        pose: 'Forearms rotate from palms-in to palms-forward while the elbows stay forward and low in front of the chest, with no shoulder abduction before the press.',
      },
      {
        mistake: 'Jerking through the turn',
        risk: 'It can irritate your shoulder joint.',
        fix: 'Use a light load and a smooth press of two full seconds.',
        clip: 'arnold-press.jerky-rotation',
        pose: 'The shoulder rotation happens in a fast jerk in under half a second at the start of the press; the dumbbells wobble and the elbows snap outward.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'Only do this seated with your back supported. It adds turning to a loaded shoulder, so it is the lowest priority press. If your back or shoulder complains, use the machine shoulder press.',
      regression: 'machine-shoulder-press',
    },
    cues: ['Elbows open, palms turn', 'Back on the pad', 'Press up, ribs down', 'Reverse it on the way down'],
    youtube: {
      tutorial: 'arnold press proper form seated physical therapist',
      mistakes: 'arnold press common mistakes',
    },
    sources: [
      'https://exrx.net/WeightExercises/DeltoidAnterior/DBArnoldPress',
      'https://www.acefitness.org/resources/everyone/exercise-library/45/seated-overhead-press/',
      'https://pubmed.ncbi.nlm.nih.gov/20508476/',
    ],
  },
  {
    id: 'barbell-curl',
    name: 'Barbell Curl',
    summary:
      'A standing curl that lifts a bar from your thighs toward your shoulders, building the fronts of your upper arms.',
    muscles: { primary: ['biceps'], secondary: ['brachialis', 'forearms'] },
    equipment: 'EZ curl bar or straight barbell, taken from a rack at hip height',
    setup: [
      'Use a straight bar, or the zigzag curl bar, which is easier on your wrists.',
      'Take it from a rack at hip height, not from the floor.',
      'Hold it underhand, with your hands about shoulder width apart.',
      'Stand with your feet hip width apart and your knees soft.',
      'If you have back pain, stand with your back against a wall.',
    ],
    steps: [
      'Stand tall with the bar at your thighs and your elbows by your sides.',
      'Brace your belly and keep your chest still.',
      'Curl until your forearms are upright.',
      'Squeeze, with your elbows still by your sides.',
      'Lower slowly to straight arms.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 1 },
    breathing:
      'Breathe out as you curl, and breathe in as you lower. Stop each set with two or three reps left in the tank, because curls pushed to failure drive your blood pressure very high.',
    feel: 'You should feel the fronts of your upper arms and your forearms.',
    shouldNotFeel:
      'You should not feel strain in your lower back, pain at the front of your shoulder, or elbow or wrist pain. If your back complains or anything travels down a leg, stop and switch to the seated cable curl.',
    why: 'Strong arms make carrying, lifting and pulling easier in daily life. The bar lets both arms work together against a steady load.',
    mistakes: [
      {
        mistake: 'Swinging your body',
        risk: 'It arches your lower back and lets momentum do the work.',
        fix: 'Use a lighter bar and stand with your back against a wall.',
        clip: 'barbell-curl.body-swing',
        pose: 'Hips hinge 15 to 20 degrees and then thrust forward as the trunk leans 15 to 20 degrees back at the top, with the lumbar spine extending.',
      },
      {
        mistake: 'Elbows drifting forward',
        risk: 'The fronts of your shoulders take over from your biceps.',
        fix: 'Keep your elbows at your sides.',
        clip: 'barbell-curl.elbows-forward',
        pose: 'Upper arms flex 30 to 45 degrees forward at the top, so the bar travels up to the chin.',
      },
      {
        mistake: 'Dropping the bar on the way down',
        risk: 'Your elbows snap straight and get strained.',
        fix: 'Take three full seconds to lower.',
        clip: 'barbell-curl.dropping-the-bar',
        pose: 'Bar falls from the top to the thighs in under one second, and the elbows snap into full extension at the bottom.',
      },
    ],
    backSafety: {
      status: 'avoidWhenIrritable',
      note: 'The load sits in front of your body and invites swinging. With back pain, prefer the seated cable curl or a seated dumbbell curl with back support.',
      regression: 'seated-cable-curl',
    },
    cues: ['Elbows pinned to your sides', 'Chest still, no swing', 'Curl, squeeze, lower slowly', 'Breathe out on the way up'],
    youtube: {
      tutorial: 'barbell curl proper form no swinging physical therapist',
      mistakes: 'barbell curl common mistakes',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/70/bicep-curl/',
      'https://exrx.net/WeightExercises/Biceps/BBCurl',
      'https://pubmed.ncbi.nlm.nih.gov/3980383/',
    ],
  },
  {
    id: 'seated-cable-curl',
    name: 'Seated Cable Curl',
    summary:
      'A curl done seated with your back supported, pulling two low cable handles toward your shoulders to build your biceps.',
    muscles: { primary: ['biceps'], secondary: ['brachialis', 'forearms'] },
    equipment: 'Two low cable pulleys with single handles, and an adjustable bench set upright',
    setup: [
      'Use a cable station with two adjustable pulleys, and set both at the lowest notch with a single handle on each.',
      'Place an adjustable bench between them, with the back pad upright.',
      'Stand between the pulleys, bend your knees with a long back to take both handles, then sit back on the bench.',
      'Rest your head, shoulders and buttocks on the pad, with your feet flat and your arms hanging by your sides, palms forward.',
      'If the pulleys are far apart, sit right beside one pulley and work one arm at a time.',
    ],
    steps: [
      'Sit tall, with your back on the pad and your elbows by your sides.',
      'Draw your shoulders down and back.',
      'Curl the handles up toward your shoulders, keeping your elbows still.',
      'Squeeze at the top, with your forearms no further than upright.',
      'Lower slowly until your arms are straight.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 1 },
    breathing:
      'Breathe out as you curl, and breathe in as you lower. Keep the air moving during the squeeze, and stop each set with two or three reps left in the tank.',
    feel: 'You should feel the fronts of your upper arms and your forearms.',
    shouldNotFeel:
      'You should not feel strain in your lower back, pain at the front of your shoulder, or elbow pain. If you have to rock off the pad to finish a rep, lighten the stack.',
    why: 'The cables keep steady tension on your biceps through the whole curl. Sitting with your back on the pad stops the swinging that strains the lower back in standing curls.',
    mistakes: [
      {
        mistake: 'Rocking to swing the weight',
        risk: 'Throwing your torso back strains your lower back.',
        fix: 'Keep your head, shoulders and buttocks on the pad, and lighten the stack.',
        clip: 'seated-cable-curl.rocking',
        pose: 'At the bottom, the trunk tips 15 to 20 degrees forward off the back pad, then swings back onto it to throw the handles up; the lumbar spine arches about 15 degrees and the hips slide forward on the seat.',
      },
      {
        mistake: 'Elbows drifting forward',
        risk: 'The fronts of your shoulders take over and your biceps lose tension.',
        fix: 'Pin your elbows by your sides.',
        clip: 'seated-cable-curl.elbows-forward',
        pose: 'Upper arms flex 30 to 45 degrees forward as the handles rise, so the forearms pass vertical toward the shoulders and the elbows leave the sides of the trunk.',
      },
      {
        mistake: 'Rounding down to grab the handles',
        risk: 'It bends and twists your lower back while the cables pull.',
        fix: 'Stand, bend your knees with a long back, and take both handles before you sit.',
        clip: 'seated-cable-curl.rounding-to-handles',
        pose: 'Seated on the bench, the trunk flexes about 40 degrees forward and side-bends about 15 degrees toward one pulley, with the lumbar spine rounded about 20 degrees and one hand reaching to a handle at floor level.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'You sit with your back supported and your knees bent, so your spine stays still. Take and return the handles with a long back, never by rounding down to the floor.',
    },
    cues: ['Back on the pad', 'Elbows pinned by your sides', 'Curl, squeeze, lower slowly', 'Shoulders down and relaxed'],
    youtube: {
      tutorial: 'seated cable bicep curl proper form',
      mistakes: 'cable bicep curl common mistakes',
    },
    sources: [
      'https://exrx.net/WeightExercises/Biceps/CBSeatedCurl',
      'https://www.acefitness.org/resources/everyone/exercise-library/44/seated-biceps-curl/',
      'https://www.acefitness.org/resources/everyone/exercise-library/184/seated-biceps-curl/',
    ],
  },
  {
    id: 'incline-dumbbell-curl',
    name: 'Incline Dumbbell Curl',
    summary:
      'A curl lying back on an incline bench with your arms hanging behind your body, which works your biceps from a long stretch.',
    muscles: { primary: ['biceps'], secondary: ['brachialis', 'forearms'] },
    equipment: 'Adjustable bench and a pair of dumbbells',
    setup: [
      'Set an adjustable bench to forty-five to sixty degrees.',
      'Pick up the dumbbells one at a time from the rack or the bench end before you lean back.',
      'Rest your head, shoulders and buttocks on the pad, with your feet flat.',
      'Let your arms hang straight down, palms facing in or forward.',
      'When you finish, sit up slowly and pause a few seconds before you stand.',
    ],
    steps: [
      'Lean back, with your arms hanging straight down.',
      'Keep your shoulders against the bench.',
      'Curl up, turning your palms to face your shoulders.',
      'Keep your elbows pointing down.',
      'Lower slowly to straight arms.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 1 },
    breathing:
      'Breathe out as you curl, and breathe in as you lower. Keep the air moving during the squeeze.',
    feel: 'You should feel your biceps working, with a stretch at the bottom of each rep.',
    shouldNotFeel:
      'You should not feel pain at the front of your shoulder or in your elbow. If the front of your shoulder hurts, raise the bench or switch to the seated cable curl.',
    why: 'With your arms behind your body, your biceps work from a longer stretch, which adds a useful strength challenge. The bench supports your back the whole time.',
    mistakes: [
      {
        mistake: 'Swinging your elbows forward',
        risk: 'You lose the stretch, and your shoulders help out.',
        fix: 'Keep your elbows pointing at the floor.',
        clip: 'incline-dumbbell-curl.elbows-forward',
        pose: 'Upper arms swing 30 to 45 degrees forward from hanging vertically as the dumbbells rise.',
      },
      {
        mistake: 'Lifting your shoulders off the pad',
        risk: 'It strains your neck.',
        fix: 'Keep your shoulders and head back on the pad.',
        clip: 'incline-dumbbell-curl.shoulders-off-pad',
        pose: 'Shoulders lift 3 to 5 cm off the pad and roll forward, and the chin juts about 5 cm forward.',
      },
      {
        mistake: 'Setting the bench too flat',
        risk: 'Your arms hang too far behind you and strain the front of your shoulders.',
        fix: 'Set the bench at forty-five to sixty degrees.',
        clip: 'incline-dumbbell-curl.bench-too-flat',
        pose: 'Bench reclined to 30 degrees or less, so the arms hang far behind the torso with the shoulders in deep extension.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'You are seated and fully supported, so your back is well protected. Sit up slowly at the end.',
      regression: 'seated-cable-curl',
    },
    cues: ['Arms hang straight down', 'Elbows stay back', 'Curl and turn', 'Slow to a full stretch'],
    youtube: {
      tutorial: 'incline dumbbell curl proper form bench angle',
      mistakes: 'incline dumbbell curl common mistakes',
    },
    sources: [
      'https://exrx.net/WeightExercises/Biceps/DBInclineCurl',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC3737788/',
    ],
  },
  {
    id: 'hammer-curl',
    name: 'Hammer Curl',
    summary:
      'A dumbbell curl with your thumbs pointing up, which builds your forearms and the muscles of your upper arms.',
    muscles: { primary: ['forearms', 'brachialis'], secondary: ['biceps'] },
    equipment: 'A pair of dumbbells, and a bench with back support for the seated version',
    setup: [
      'Take a pair of dumbbells from the rack at thigh height.',
      'Hold them with your palms facing your body and your thumbs up.',
      'Stand in a split stance with one foot forward, or sit on a bench with back support, which is easier on your back.',
    ],
    steps: [
      'Stand or sit tall, with your palms facing your body.',
      'Keep your elbows by your sides and your shoulders down.',
      'Curl up, with your thumbs leading toward your shoulders.',
      'Stop when the dumbbell nears the front of your shoulder.',
      'Lower slowly.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 1 },
    breathing:
      'Breathe out as you curl, and breathe in as you lower. Stop each set with two or three reps left in the tank.',
    feel: 'You should feel the thumb side of your forearm and the front of your upper arm.',
    shouldNotFeel:
      'You should not feel pain on the outside of your elbow, wrist pain, or strain in your lower back. If you lean back to lift, use lighter dumbbells or sit down.',
    why: 'This grip builds your forearms and grip along with your arms, which helps with carrying bags and lifting boxes. It is gentle on your wrists and elbows.',
    mistakes: [
      {
        mistake: 'Swinging your body',
        risk: 'It arches your lower back.',
        fix: 'Use lighter dumbbells, and stand in a split stance or sit.',
        clip: 'hammer-curl.body-swing',
        pose: 'Trunk leans about 15 degrees back as the hips thrust forward, with the lumbar spine extending as the dumbbells are swung up.',
      },
      {
        mistake: 'Elbows drifting forward or out',
        risk: 'Your shoulders take over from your arms.',
        fix: 'Pin your elbows by your sides.',
        clip: 'hammer-curl.elbows-drifting',
        pose: 'Elbows drift about 30 degrees forward and outward, away from the sides, as the dumbbells rise.',
      },
      {
        mistake: 'Bending your wrists',
        risk: 'It strains your wrists.',
        fix: 'Keep your thumb in line with your forearm.',
        clip: 'hammer-curl.bent-wrists',
        pose: 'Wrists tilt about 20 degrees toward the thumb side or the little finger side during the curl.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'On irritable days, sit with your back supported and alternate arms to halve the load.',
      regression: 'seated-cable-curl',
    },
    cues: ['Thumbs up, like holding hammers', 'Elbows by your sides', 'Lift without leaning', 'Slow on the way down'],
    youtube: {
      tutorial: 'hammer curl proper form physical therapist',
      mistakes: 'hammer curl common mistakes',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/10/hammer-curl/',
      'https://exrx.net/WeightExercises/Brachioradialis/DBHammerCurl',
    ],
  },
  {
    id: 'rope-pushdown',
    name: 'Rope Pushdown',
    summary:
      'A standing cable exercise that pushes a rope down from chest height until your arms are straight, building the backs of your arms.',
    muscles: { primary: ['triceps'], secondary: ['abs', 'lats'] },
    equipment: 'Cable column with a rope attachment on the high pulley',
    setup: [
      'Use a cable column with the pulley at its highest setting and the rope attached.',
      'Stand close to the cable with your feet hip width apart or staggered, and your torso tall.',
      'Hold the rope with your thumbs up and your elbows at your sides.',
    ],
    steps: [
      'Stand tall, with your elbows at your sides.',
      'Start with your hands at chest height.',
      'Push the rope down until your arms are straight.',
      'Spread the rope ends apart at the bottom.',
      'Let your hands rise slowly, with your elbows pinned.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 1 },
    breathing:
      'Breathe out as you push down, and breathe in as your hands rise. Keep the air moving during the pause at the bottom.',
    feel: 'You should feel the backs of your upper arms.',
    shouldNotFeel:
      'You should not feel elbow pain, pain at the front of your shoulder, or strain in your lower back. If you have to lean over the rope, lighten the stack. If standing brings on back or leg symptoms, use a seated triceps machine.',
    why: 'Strong triceps help you push up from a chair and press things overhead. Standing tall with a light stack keeps the load off your spine.',
    mistakes: [
      {
        mistake: 'Leaning over the rope',
        risk: 'It rounds and loads your lower back.',
        fix: 'Stand tall and lighten the stack.',
        clip: 'rope-pushdown.leaning-over',
        pose: 'Trunk flexes 30 to 45 degrees forward over the rope with the back rounded and the shoulders rolling over the hands.',
      },
      {
        mistake: 'Elbows drifting forward',
        risk: 'Your back and shoulders join in, and your triceps do less.',
        fix: 'Keep your elbows pinned to your sides.',
        clip: 'rope-pushdown.elbows-drifting',
        pose: 'At the top, the elbows drift 30 to 40 degrees forward and up, away from the sides, as the hands rise above chest height.',
      },
      {
        mistake: 'Flaring your elbows out',
        risk: 'It stresses your elbows and shoulders.',
        fix: 'Keep your elbows tucked in.',
        clip: 'rope-pushdown.elbows-flaring',
        pose: 'Elbows flare 30 to 45 degrees out to the sides, away from the trunk, throughout the push.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Your spine carries little load when you stand tall. If standing brings on symptoms, use a seated triceps machine.',
    },
    cues: ['Elbows glued to your sides', 'Push down and spread the rope', 'Stand tall', 'Slow on the way up'],
    youtube: {
      tutorial: 'tricep rope pushdown proper form physical therapist',
      mistakes: 'tricep rope pushdown common mistakes elbows',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/3/triceps-pressdown/',
      'https://www.acefitness.org/resources/everyone/exercise-library/185/triceps-pushdowns/',
      'https://exrx.net/WeightExercises/Triceps/CBPushdown',
    ],
  },
  {
    id: 'overhead-tricep-extension',
    name: 'Seated Overhead Tricep Extension',
    summary:
      'A seated, back-supported exercise that lowers one dumbbell behind your head and presses it back up, working your triceps from a long stretch.',
    muscles: { primary: ['triceps'], secondary: ['shoulders', 'abs'] },
    equipment: 'One dumbbell and a bench with a short upright back pad, or a rope on a low pulley',
    setup: [
      'Use a bench with an upright back pad whose top sits just below your shoulders, so it does not block the dumbbell.',
      'Sit tall with your back on the pad, your feet flat and your ribs down.',
      'Hold one dumbbell in both hands, cupping the top plate.',
      'Bring it to your chest, then press it straight overhead to start.',
    ],
    steps: [
      'Sit tall, with your back on the pad and the dumbbell straight overhead.',
      'Point your elbows forward, close to your head.',
      'Lower the dumbbell slowly behind your head.',
      'Stop when your elbows reach about a right angle.',
      'Straighten your arms back overhead.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 0 },
    breathing:
      'Breathe in as you lower, and breathe out as you press up. Keep your ribs down and keep breathing behind a light brace.',
    feel: 'You should feel a long stretch and work in the backs of your upper arms.',
    shouldNotFeel:
      'You should not feel your lower back arching, elbow pain, a pinch in your shoulder, or strain in your neck. If your back arches or your shoulders feel tight overhead, switch to the rope pushdown.',
    why: 'Working your triceps from an overhead stretch tends to build them more than pushdowns alone. The back pad keeps your lower back from arching.',
    mistakes: [
      {
        mistake: 'Arching with your ribs flared',
        risk: 'It loads your lower back in an arched position.',
        fix: 'Keep your back on the pad and your ribs down, and go less deep.',
        clip: 'overhead-tricep-extension.arching',
        pose: 'Lumbar spine extends 15 to 25 degrees, the ribs pop forward and the upper back leaves the pad as the dumbbell lowers.',
      },
      {
        mistake: 'Flaring your elbows out',
        risk: 'It strains your elbows and shoulders.',
        fix: 'Point your elbows forward, about shoulder width apart.',
        clip: 'overhead-tricep-extension.elbows-flaring',
        pose: 'Elbows flare 30 to 45 degrees outward, ending 15 to 20 cm wider than the shoulders.',
      },
      {
        mistake: 'Bowing your head',
        risk: 'It strains your neck and risks the dumbbell hitting your head.',
        fix: 'Keep your head level and stop at a right angle.',
        clip: 'overhead-tricep-extension.head-bowed',
        pose: 'Neck flexes 20 to 30 degrees forward to make room, with the dumbbell lowered close to the back of the head.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'Only do this seated with your back supported, or use the light cable version. Never do it standing with an arched back. If your shoulders are tight overhead, use the rope pushdown.',
      regression: 'rope-pushdown',
    },
    cues: ['Ribs down, back on the pad', 'Elbows forward, close to your head', 'Lower behind your head slowly', 'Press to the ceiling'],
    youtube: {
      tutorial: 'seated overhead tricep extension dumbbell form elbows',
      mistakes: 'overhead tricep extension common mistakes',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/74/triceps-extension/',
      'https://exrx.net/WeightExercises/Triceps/DBTriExt',
      'https://pubmed.ncbi.nlm.nih.gov/35819335/',
    ],
  },
  {
    id: 'skull-crushers',
    name: 'Skull Crushers',
    summary:
      'A lying triceps exercise that lowers a bar or dumbbells toward your forehead and then straightens your arms again.',
    muscles: { primary: ['triceps'], secondary: ['shoulders'] },
    equipment: 'Flat bench with an EZ curl bar or two dumbbells',
    setup: [
      'Use a flat bench with the zigzag curl bar, or two dumbbells, which are easier to control near your face.',
      'Take the weight from a rack or the bench end, and rest it on your thighs as you sit.',
      'Lie back with it held on your chest, then press it up over your shoulders.',
      'Keep your feet flat on the floor, or on a step to keep your back neutral, with a narrow grip about shoulder width.',
      'When you finish, lower the weight to your chest, sit up, and pause a few seconds before you stand.',
    ],
    steps: [
      'Lie back with the weight over your shoulders and your arms straight.',
      'Keep your upper arms still and shoulder width apart.',
      'Bend your elbows to lower the weight toward your forehead.',
      'Slow down near your head, and stop just above it.',
      'Straighten your arms back to the start.',
    ],
    tempo: { lower: 3, pauseBottom: 0, lift: 2, pauseTop: 0 },
    breathing:
      'Breathe in as you lower, and breathe out as you straighten your arms. Keep breathing smoothly, and never hold your breath at the bottom.',
    feel: 'You should feel the backs of your upper arms.',
    shouldNotFeel:
      'You should not feel elbow, wrist or shoulder pain, or strain in your lower back. If your elbows ache, switch to dumbbells with your palms facing each other.',
    why: 'Lying on the bench lets you work your triceps hard while your spine rests. It builds the pushing strength of your arms.',
    mistakes: [
      {
        mistake: 'Flaring your elbows out',
        risk: 'It stresses your elbows and shoulders.',
        fix: 'Keep your elbows shoulder width apart.',
        clip: 'skull-crushers.elbows-flaring',
        pose: 'Elbows splay 15 to 20 cm wider than the grip as the bar lowers.',
      },
      {
        mistake: 'Dropping the weight toward your face',
        risk: 'It can hit your face or head.',
        fix: 'Slow down near your forehead, or use dumbbells.',
        clip: 'skull-crushers.dropping-the-bar',
        pose: 'Bar falls freely over the last 10 cm toward the forehead with no slowing, and the elbows collapse into full flexion.',
      },
      {
        mistake: 'Arching your back',
        risk: 'It squeezes the joints of your lower back.',
        fix: 'Plant your feet or rest them on a step, and keep your ribs down.',
        clip: 'skull-crushers.arched-back',
        pose: 'Lumbar spine arches 15 to 20 degrees off the bench, the hips lift slightly and the ribs flare.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Lying on your back with your feet planted is easy on your spine. The risky parts are getting into position and getting up, so sit for a moment before you stand.',
      regression: 'rope-pushdown',
    },
    cues: ['Upper arms still', 'Elbows in, shoulder width', 'Slow near your forehead', 'Squeeze straight'],
    youtube: {
      tutorial: 'skull crusher proper form elbow friendly ez bar dumbbell',
      mistakes: 'skull crusher common mistakes',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/36/lying-barbell-triceps-extensions/',
      'https://exrx.net/WeightExercises/Triceps/BBLyingTriExtSC',
    ],
  },
];
