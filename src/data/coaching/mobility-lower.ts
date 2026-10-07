import type { Coaching } from '@/types/catalog';

/**
 * Coaching for the hip, hamstring, nerve, quad and calf stretches, the
 * breathing drills, and the raise, activate and potentiate drills used by the
 * 15-minute mobility block (spec §4.2, Appendix B).
 *
 * Stretches and breathing are drafted from docs/research/technique-mobility-cardio.md
 * (technique, mistakes, back status and sources per item) and
 * docs/research/back-sciatica-mobility.md (RAMP order, sliders versus
 * tensioners, dosing). The drills were researched separately from NHS physio
 * leaflets, NSCA, ACE, HSS and peer-reviewed studies; their sources are listed
 * per record.
 *
 * Spoken fields are written for text-to-speech: plain words, short sentences,
 * no symbols, slashes or parentheses, and never a breath hold.
 */
export const MOBILITY_LOWER_COACHING: Coaching[] = [
  {
    id: 'supine-figure-4',
    name: 'Supine Figure-4 Stretch',
    summary:
      'A lying stretch that crosses one ankle over the opposite knee to ease the deep muscles of your buttock and outer hip, including the piriformis.',
    muscles: {
      primary: ['Piriformis', 'Deep hip rotators', 'Glutes'],
      secondary: ['Outer hip muscles'],
    },
    equipment: 'Mat, with a strap or towel if needed',
    setup: [
      'Lie on your back on a mat with your knees bent and your feet flat.',
      'Rest your head on the mat or a thin pillow, and let your shoulders relax.',
      'Keep a strap or towel nearby in case you cannot reach your thigh comfortably.',
    ],
    steps: [
      'Cross one ankle over the opposite knee and flex that foot, toes toward your shin.',
      'Let the crossed knee gently fall open to the side.',
      'Hold behind the thigh of your supporting leg, or loop the strap around it.',
      'Breathe out and slowly draw that thigh toward you until you feel a stretch deep in the buttock of the crossed leg.',
      'Keep your tailbone heavy and your head resting down.',
      'Hold and breathe, then lower both feet and switch sides.',
    ],
    dosage: { holdSeconds: 30, sets: 2, sides: 'each' },
    breathing:
      'Breathe in slowly through your nose for about four seconds. Breathe out long and slow for about six seconds, and let the thigh drift a little closer only as you breathe out. Keep breathing easily, and never hold your breath.',
    feel: 'A gentle stretch deep in the buttock and outer hip of the crossed leg, about 3 to 4 out of 10.',
    shouldNotFeel:
      'If tingling, numbness or pain travels down your leg or into your foot, ease off at once, or stop. Next time, leave the supporting foot on the floor or on a wall. Anything stirred up should settle within about a minute. Also stop if you feel a pinch in the groin or pain in the knee.',
    why: 'This stretch eases the deep hip muscles that lie over the sciatic nerve, with your spine fully supported. Supple hips let you bend from your hips rather than your lower back.',
    mistakes: [
      {
        mistake: 'Tailbone lifting and lower back rounding',
        risk: 'Loads the discs of your lower back and can stir up leg symptoms.',
        fix: 'Draw the thigh in less, or use a strap, so your tailbone stays heavy on the mat.',
        clip: 'supine-figure-4.tailbone-lifts',
        pose: 'Supporting thigh pulled too far toward the chest so the pelvis curls up: tailbone lifts about 3 to 5 centimetres off the mat and the lumbar spine rounds about 15 to 20 degrees into flexion.',
      },
      {
        mistake: 'Head lifting with a held breath',
        risk: 'Strains your neck and can spike your blood pressure.',
        fix: 'Rest your head down, use a strap if you cannot reach, and keep breathing.',
        clip: 'supine-figure-4.head-lifts',
        pose: 'Head and shoulders curl off the mat with the neck flexed about 30 degrees, arms straining to reach the thigh, face tense and lips pressed together as if holding the breath.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Your spine is supported and both knees stay bent, so tension on the sciatic nerve stays low. If it stirs your leg, leave the supporting foot on the floor or on a wall and let gravity open the crossed knee.',
    },
    cues: ['Flex the crossed foot', 'Tailbone heavy', 'Breathe out, draw in', 'Head stays down'],
    youtube: {
      tutorial: 'supine figure 4 piriformis stretch physical therapist',
      mistakes: 'figure 4 stretch mistakes physical therapist',
    },
    sources: [
      'https://www.hss.edu/health-library/move-better/hip-strengthening-exercises',
      'https://health.clevelandclinic.org/piriformis-syndrome-stretches-exercises',
      'https://www.acefitness.org/resources/everyone/exercise-library/148/supine-90-90-hip-rotator-stretch/',
    ],
  },
  {
    id: 'seated-piriformis-stretch',
    name: 'Seated Piriformis Stretch',
    summary:
      'A seated stretch for the deep muscles of your buttock, done with a tall spine and a gentle hinge from the hips.',
    muscles: {
      primary: ['Piriformis', 'Deep hip rotators'],
      secondary: ['Glutes'],
    },
    equipment: 'Sturdy chair',
    setup: [
      'Sit near the front edge of a sturdy chair with your feet flat on the floor.',
      'Sit tall on both sit bones, with your hands resting on your thighs.',
    ],
    steps: [
      'Lift one ankle onto the opposite knee and flex that foot.',
      'Rest one hand on the crossed knee and the other on the ankle.',
      'Breathe in and grow tall through your spine.',
      'Breathe out and hinge forward from your hips, leading with your chest.',
      'Stop at a gentle stretch in the buttock, and let the knee settle by itself.',
      'Hold and breathe, then sit up tall and switch sides.',
    ],
    dosage: { holdSeconds: 30, sets: 2, sides: 'each' },
    breathing:
      'Breathe in slowly through your nose for about four seconds to grow tall. Breathe out long and slow for about six seconds as you hinge. Keep breathing easily through the hold, and never hold your breath.',
    feel: 'A gentle stretch deep in the buttock of the crossed leg, about 3 to 4 out of 10.',
    shouldNotFeel:
      'If tingling, numbness or pain travels down your leg or into your foot, sit back up at once and ease off, and use the lying figure four instead. Anything stirred up should settle within about a minute. Also stop if you feel a pinch in the groin or pain in the knee.',
    why: 'It reaches the same deep hip muscles as the lying figure four, and you can do it on any chair. Hinging with a long spine keeps the stretch in your hip and off your back and nerves.',
    mistakes: [
      {
        mistake: 'Slumping and rounding the back',
        risk: 'Puts tension on the sciatic nerve, much like a nerve test, and can flare sciatica.',
        fix: 'Lead with your chest, keep your chin level, and hinge only from your hips.',
        clip: 'seated-piriformis-stretch.slumping',
        pose: 'Thoracic and lumbar spine round about 30 to 40 degrees into flexion and the chin drops about 20 degrees toward the chest, instead of a straight-backed hinge at the hips.',
      },
      {
        mistake: 'Pushing the knee down',
        risk: 'Strains the knee and hip.',
        fix: 'Let gravity lower the knee, and rest your hand on it lightly.',
        clip: 'seated-piriformis-stretch.forcing-knee',
        pose: 'Hand presses the crossed knee about 10 to 15 centimetres toward the floor, the shoulder pushing down and the hip forced into extra outward rotation.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'A rounded, slumped lean mimics the slump nerve test, so hinge with a long spine and never slump. If it stirs your leg, stay upright and let the knee lower, or use the supine figure four.',
      regression: 'supine-figure-4',
    },
    cues: ['Sit tall first', 'Hinge from your hips', 'Chin level', 'Let the knee drop'],
    youtube: {
      tutorial: 'seated piriformis stretch physiotherapy NHS',
      mistakes: 'seated piriformis stretch mistakes physiotherapist',
    },
    sources: [
      'https://www.southtees.nhs.uk/resources/gluteal-stretch-in-sitting/',
      'https://health.clevelandclinic.org/piriformis-syndrome-stretches-exercises',
      'https://pubmed.ncbi.nlm.nih.gov/18391677/',
    ],
  },
  {
    id: 'half-kneeling-hip-flexor-stretch',
    name: 'Half-Kneeling Hip Flexor Stretch',
    summary:
      'A kneeling stretch for the front of your hip that uses a gentle tuck of the pelvis to protect your lower back.',
    muscles: {
      primary: ['Hip flexors'],
      secondary: ['Quadriceps'],
    },
    equipment: 'Mat, a cushion for the knee, and a chair for balance',
    setup: [
      'Place a cushion on the mat for your knee and a sturdy chair beside you for balance.',
      'Kneel on one knee with the other foot flat in front, both knees bent to about ninety degrees.',
      'Point the back shin straight behind you and keep your hips square.',
    ],
    steps: [
      'Rest one hand on the chair and lift tall through your trunk.',
      'Tuck your tailbone under and gently squeeze the buttock of the kneeling leg.',
      'Keep that tuck and shift your hips forward just a little.',
      'Stop at a gentle stretch at the front of the hip of the kneeling leg.',
      'Keep your ribs down and your trunk tall as you breathe.',
      'Ease back, switch sides, then use the chair to stand up slowly.',
    ],
    dosage: { holdSeconds: 30, sets: 2, sides: 'each' },
    breathing:
      'Breathe in slowly through your nose for about four seconds. Breathe out long and slow for about six seconds as you tuck and shift forward. Keep breathing easily, and never hold your breath.',
    feel: 'A gentle stretch at the front of the hip of the kneeling leg, about 3 to 4 out of 10.',
    shouldNotFeel:
      'Stop if you feel pinching in your lower back or pain in your kneecap. Tingling or burning down the front of the thigh means the thigh nerve is under tension, so shift forward less, or slide the back knee further behind you so it bends less. If tingling, numbness or pain travels down your leg or into your foot, ease off or stop. Anything stirred up should settle within about a minute.',
    why: 'Long hours of sitting shorten the front of the hips, which can pull on your pelvis and lower back. This stretch restores that length, while the tuck keeps your back protected.',
    mistakes: [
      {
        mistake: 'Arching the lower back',
        risk: 'Loads your lower back in extension and loses the hip stretch.',
        fix: 'Tuck your tail, squeeze the back buttock, and draw your ribs down.',
        clip: 'half-kneeling-hip-flexor-stretch.back-arches',
        pose: 'Pelvis tips forward about 15 to 20 degrees into anterior tilt, the lumbar spine arches into extension and the ribs flare up and forward.',
      },
      {
        mistake: 'Lunging too far forward',
        risk: 'Loads the front knee and pulls your back into an arch.',
        fix: 'Tuck first, then shift forward only a little.',
        clip: 'half-kneeling-hip-flexor-stretch.over-lunge',
        pose: 'Hips drive about 15 centimetres forward and the front knee travels about 10 centimetres past the toes, with the pelvis still tipped forward and the lower back arched.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'Fine with the pelvis tucked. Arching loads the lower back in extension, which irritates extension sensitive backs. On irritable days, or if kneeling hurts, use a standing split stance at a counter with the back heel up and the pelvis tucked.',
    },
    cues: ['Tuck your tail', 'Squeeze the back buttock', 'Shift forward just a little', 'Ribs down, hips square'],
    youtube: {
      tutorial: 'half kneeling hip flexor stretch physiotherapist',
      mistakes: 'half kneeling hip flexor stretch mistakes physiotherapist',
    },
    sources: [
      'https://www.southtees.nhs.uk/resources/hip-stretch-in-half-kneeling/',
      'https://www.hss.edu/health-library/move-better/hip-flexor-stretch',
      'https://health.clevelandclinic.org/psoas-stretch-guide-for-psoas-release',
    ],
  },
  {
    id: 'ninety-ninety-hip-switch',
    name: '90-90 Hip Switch',
    summary:
      'A seated hip drill where both knees sweep from side to side like wipers, turning each hip gently in and out.',
    muscles: {
      primary: ['Deep hip rotators', 'Piriformis'],
      secondary: ['Glutes'],
    },
    equipment: 'Mat, with a cushion or block if your hips are stiff',
    setup: [
      'Sit on the mat with your knees bent to about ninety degrees and your feet flat, a little wider than your hips.',
      'Place your hands on the mat behind you and lean back slightly onto them.',
      'If your hips are stiff, sit on a cushion or block.',
    ],
    steps: [
      'Sit tall, with some of your weight resting on your hands.',
      'Breathe out and let both knees lower to one side, only as far as is comfortable.',
      'Your front leg rests on its outer side and your back leg on its inner side.',
      'Breathe in and lift both knees back up through the middle.',
      'Breathe out and lower them to the other side.',
      'Keep switching slowly, about six times to each side, with both sit bones heavy.',
    ],
    dosage: { reps: 12, secondsPerRep: 5, sets: 1, sides: 'none' },
    breathing:
      'Breathe out slowly as your knees lower to the side, and breathe in softly through your nose as they lift back through the middle. Keep the rhythm slow and easy, and never hold your breath.',
    feel: 'Easy turning and a gentle stretch around both hips and buttocks, about 3 to 4 out of 10.',
    shouldNotFeel:
      'Stop if you feel a pinch in the groin or pain on the inside of the knee. If tingling, numbness or pain travels down your leg or into your foot, make the range smaller or stop. Anything stirred up should settle within about a minute. Skip this after a hip or knee replacement unless your surgeon or physiotherapist has cleared it.',
    why: 'Your hips need to turn in and out freely for squats, lunges and everyday walking. When they do, your lower back has less twisting to do.',
    mistakes: [
      {
        mistake: 'Lower back rounding',
        risk: 'Loads your discs and stops the movement coming from your hips.',
        fix: 'Lean back on your hands and sit on a cushion or block.',
        clip: 'ninety-ninety-hip-switch.back-rounds',
        pose: 'Hands come off the floor and the trunk slumps: lumbar spine rounds about 20 to 30 degrees into flexion with the pelvis tucked under, while the knees barely rotate.',
      },
      {
        mistake: 'Back sit bone lifting and trunk leaning away',
        risk: 'Bends your lower back sideways instead of turning your hips.',
        fix: 'Keep both sit bones heavy and use a smaller range.',
        clip: 'ninety-ninety-hip-switch.sit-bone-lifts',
        pose: 'As the knees lower, the sit bone of the back leg lifts about 5 to 10 centimetres off the floor and the trunk side-bends about 20 degrees away from the knees.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'Turning the back leg inward can provoke deep buttock pain, and slumping rounds the lower back. Stay propped on your hands, sit on a block and keep the range small. Skip after a hip or knee replacement, or with hip impingement or a meniscus tear, unless cleared.',
    },
    cues: ['Sit tall', 'Knees sweep like wipers', 'Sit bones heavy', 'Small and slow'],
    youtube: {
      tutorial: '90 90 hip switch mobility physical therapist',
      mistakes: '90 90 hip switch mistakes physical therapist',
    },
    sources: [
      'https://health.clevelandclinic.org/90-90-stretch',
      'https://www.hss.edu/health-library/move-better/hip-flexor-stretch',
    ],
  },
  {
    id: 'adductor-rock-back',
    name: 'Adductor Rock-Back',
    summary:
      'A slow rocking drill on your hands and knees that stretches the inner thigh of the leg reaching out to the side.',
    muscles: {
      primary: ['Adductors'],
      secondary: ['Gracilis'],
    },
    equipment: 'Mat with padding under your knees',
    setup: [
      'Kneel on a padded mat on your hands and knees.',
      'Place your hands under your shoulders and your knees under your hips.',
      'Straighten one leg out to the side, with the whole foot flat and the toes pointing forward.',
    ],
    steps: [
      'Set a long, neutral spine, with your belly gently drawn in.',
      'Breathe out and slowly rock your hips back toward the heel of your kneeling leg.',
      'Stop when you feel a stretch in the inner thigh of the straight leg.',
      'Stop sooner if your lower back starts to round.',
      'Breathe in and rock forward again to the start.',
      'Finish your rocks, then switch sides.',
    ],
    dosage: { reps: 8, secondsPerRep: 5, sets: 1, sides: 'each' },
    breathing:
      'Breathe out slowly for about three seconds as you rock back, and breathe in softly through your nose as you return. Never hold your breath.',
    feel: 'A gentle stretch along the inner thigh of the straight leg, about 3 to 4 out of 10.',
    shouldNotFeel:
      'Stop if you feel sharp groin pain, a pinch in the hip, or pain on the inside of the knee. If tingling, numbness or pain travels down your leg or into your foot, ease off or stop, and bend the side knee next time. Anything stirred up should settle within about a minute.',
    why: 'Supple inner thighs let you squat and lunge more deeply without your lower back taking over. Rocking keeps the stretch gentle and moving, which suits a warm up.',
    mistakes: [
      {
        mistake: 'Lower back rounding at the end',
        risk: 'Loads the discs and nerves once your hips run out of range.',
        fix: 'Stop the rock just before your pelvis tucks, keeping your belly long.',
        clip: 'adductor-rock-back.back-rounds',
        pose: 'Hips rock too far back toward the heel: the pelvis tucks under and the lumbar spine rounds about 20 to 30 degrees into flexion.',
      },
      {
        mistake: 'Straight leg rolling inward',
        risk: 'Strains the inside of the knee.',
        fix: 'Keep the whole foot flat and the kneecap facing forward.',
        clip: 'adductor-rock-back.leg-rolls-in',
        pose: 'Straight leg rotates inward about 30 to 45 degrees at the hip so the kneecap faces the floor and the foot rolls onto its inner edge.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'Once hip range runs out, the lower back rounds, which commonly triggers symptoms, and the straight knee adds nerve tension. Stop before the pelvis tucks, and bend the side knee to ninety degrees if the leg stirs.',
    },
    cues: ['Long spine', 'Rock back slowly', 'Stop before the tuck', 'Kneecap forward'],
    youtube: {
      tutorial: 'adductor rock back exercise physical therapist',
      mistakes: 'adductor rock back mistakes physical therapist',
    },
    sources: [
      'https://health.clevelandclinic.org/hip-opening-stretches',
      'https://www.nhsinform.scot/illnesses-and-conditions/muscle-bone-and-joints/leg-and-foot-problems-and-conditions/exercises-for-osteoarthritis-of-the-hip/',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC2659590/',
    ],
  },
  {
    id: 'sciatic-nerve-glide-seated',
    name: 'Seated Sciatic Nerve Glide',
    summary:
      'A gentle seated slider that moves the sciatic nerve smoothly along the back of your leg without stretching it.',
    muscles: {
      primary: ['Sciatic nerve'],
      secondary: ['Front thigh muscles'],
    },
    equipment: 'Firm chair',
    setup: [
      'Sit upright on a firm chair with both feet flat on the floor.',
      'Sit tall on both sit bones and rest your hands on the seat beside you.',
    ],
    steps: [
      'Start with the leg that has symptoms, if one leg does.',
      'Slowly straighten that knee as you point your toes away and gently look up.',
      'Stop before you feel any pull or tingling.',
      'Bend the knee back down as you let your chin drop slightly.',
      'Keep it smooth and flowing, about two seconds each way.',
      'Finish your reps on the first leg, then do the other leg.',
    ],
    dosage: { reps: 10, secondsPerRep: 4, sets: 1, sides: 'affectedFirst' },
    breathing:
      'Breathe softly through your nose the whole time. Let the breath flow out as your knee straightens, and breathe in as it bends. Keep it slow and easy, and never hold your breath.',
    feel: 'Easy movement behind the thigh and knee, a mild pull at most, never tingling. Any faint feeling should fade as soon as the knee bends.',
    shouldNotFeel:
      'If you feel tingling, burning or numbness, or pain travelling down your leg or into your foot, make the movement smaller or stop. Anything stirred up should settle within about a minute. If it lingers, stop for today and use the lying glide next time.',
    why: 'Nerve glides help an irritated sciatic nerve move freely again without being stretched, which can ease sciatic leg pain and nerve related hamstring tightness. Doing them while you are warm prepares the leg for hinging and walking.',
    mistakes: [
      {
        mistake: 'Slumping as the knee straightens',
        risk: 'Turns the glide into a nerve stretch and can flare sciatica.',
        fix: 'Sit tall on your sit bones and keep your eyes up as the knee straightens.',
        clip: 'sciatic-nerve-glide-seated.slumping',
        pose: 'Trunk rounds about 20 to 30 degrees into flexion and the chin drops toward the chest at the same moment the knee straightens, combining into the slump tension position.',
      },
      {
        mistake: 'Pulling the toes up and holding',
        risk: 'Stretches the nerve instead of gliding it.',
        fix: 'Point your toes away as the knee straightens, and keep moving.',
        clip: 'sciatic-nerve-glide-seated.toes-pulled-up',
        pose: 'At full knee straightening the ankle pulls about 15 to 20 degrees up toward the shin and the position is held still for five to ten seconds.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'Built for sciatica, but keep it small and symptom free. Sit upright, never slumped, and use the slider only, never a tensioner, while symptoms are irritable. If it stirs symptoms, use the lying glide instead.',
      regression: 'sciatic-nerve-glide-supine',
    },
    cues: ['Knee up, eyes up', 'Knee down, chin down', 'Smooth, no stretch', 'A mild pull at most'],
    youtube: {
      tutorial: 'seated sciatic nerve slider physiotherapist',
      mistakes: 'sciatic nerve glide mistakes physiotherapist',
    },
    sources: [
      'https://www.southtees.nhs.uk/resources/sciatic-nerve-slider/',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC5430455/',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC9848316/',
    ],
  },
  {
    id: 'sciatic-nerve-glide-supine',
    name: 'Supine Sciatic Nerve Glide',
    summary:
      'The gentlest nerve glide, done lying on your back, which slides the sciatic nerve along the back of your leg with very little tension.',
    muscles: {
      primary: ['Sciatic nerve'],
      secondary: ['Front thigh muscles'],
    },
    equipment: 'Mat and a thin pillow, with a strap or towel if needed',
    setup: [
      'Lie on your back on a mat with your head on a thin pillow.',
      'Bend both knees with your feet flat on the floor.',
      'Lift one leg, the one with symptoms if there is one, and hold behind the thigh so your hip is bent to about a right angle or a little less.',
    ],
    steps: [
      'Keep your other foot planted and your head resting on the pillow.',
      'Slowly straighten the knee as you point your toes away from you.',
      'Stop before you feel any pull or tingling.',
      'Bend the knee again as your toes come back toward you.',
      'Keep the thigh still and the movement flowing, about two seconds each way.',
      'Finish your reps, then switch legs.',
    ],
    dosage: { reps: 10, secondsPerRep: 4, sets: 1, sides: 'affectedFirst' },
    breathing:
      'Breathe softly through your nose the whole time. Breathe out slowly as the knee straightens, and breathe in as it bends. Keep it easy, and never hold your breath.',
    feel: 'Easy movement behind the knee and thigh, a mild pull at most, never tingling.',
    shouldNotFeel:
      'If you feel tingling, burning or numbness, or symptoms spreading below the knee or into the foot, make the movement smaller and lower the thigh, or stop. Anything stirred up should settle within about a minute. If it lingers after the set, stop for today.',
    why: 'In an ultrasound study, this sliding style moved the sciatic nerve about five times further than a nerve stretch, while keeping tension low. It is a gentle way to keep an irritated nerve moving and may help ease sciatic leg pain.',
    mistakes: [
      {
        mistake: 'Pulling the thigh in with the knee locked',
        risk: 'Turns the glide into a straight leg raise nerve stretch.',
        fix: 'Keep the hip at a right angle or less, and point your toes away.',
        clip: 'sciatic-nerve-glide-supine.thigh-pulled-too-far',
        pose: 'Thigh pulled to about 110 degrees of hip flexion with the knee locked straight and the ankle pulled up toward the shin.',
      },
      {
        mistake: 'Lifting the head and shoulders',
        risk: 'Adds tension to the nerve and strains your neck.',
        fix: 'Rest your head on the pillow, and use a strap if you cannot reach.',
        clip: 'sciatic-nerve-glide-supine.head-lifts',
        pose: 'Head and shoulders curl about 30 degrees up off the pillow, neck flexed, as the hands strain to hold the thigh.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'The gentlest slider, with your spine supported. If symptoms stir, lower the thigh to about forty five degrees, use half the knee range, or do ankle pumps only.',
    },
    cues: ['Knee straight, toes away', 'Knee bends, toes back', 'Glide, do not stretch', 'Head stays down'],
    youtube: {
      tutorial: 'supine sciatic nerve glide slider physical therapist',
      mistakes: 'sciatic nerve glide mistakes physical therapist',
    },
    sources: [
      'https://pubmed.ncbi.nlm.nih.gov/26304637/',
      'https://pubmed.ncbi.nlm.nih.gov/17398140/',
      'https://www.southtees.nhs.uk/resources/10-sciatica-facts/',
    ],
  },
  {
    id: 'supine-hamstring-stretch-strap',
    name: 'Supine Hamstring Stretch with Strap',
    summary:
      'A lying hamstring stretch with a strap, keeping the knee soft and the ankle relaxed so the stretch stays in the muscle and off the nerve.',
    muscles: {
      primary: ['Hamstrings'],
      secondary: ['Calf'],
    },
    equipment: 'Mat, strap or towel, and a pillow',
    setup: [
      'Lie on your back on a mat with your head on a pillow.',
      'Keep your other leg long on the floor, or bent with the foot flat if that is kinder to your back.',
      'Loop the strap around the arch of one foot, near the heel, and hold both ends.',
    ],
    steps: [
      'Start with the knee bent and your toes relaxed.',
      'Straighten the knee until it is soft, not locked.',
      'Breathe out and raise the leg until you feel a mild pull in the middle of the back of your thigh.',
      'Keep your hips heavy, your head down and your arms long.',
      'Hold and breathe, letting the leg drift up a little on each breath out.',
      'Bend the knee to lower the leg, then switch sides.',
    ],
    dosage: { holdSeconds: 30, sets: 2, sides: 'each' },
    breathing:
      'Breathe in slowly through your nose for about four seconds. Breathe out long and slow for about six seconds, and let the leg drift up a little only as you breathe out. Keep breathing easily, and never hold your breath.',
    feel: 'A dull, gentle pull in the middle of the back of your thigh, about 3 to 4 out of 10, which eases as you hold it.',
    shouldNotFeel:
      'Burning or tingling behind the knee, or tingling, numbness or pain travelling into the calf or foot, are nerve signs. Bend the knee and lower the leg at once, and use the nerve glide instead. If the feeling changes when you move your head or ankle, it is the nerve, not the muscle. Anything stirred up should settle within about a minute.',
    why: 'Short, tight hamstrings can tug on your pelvis when you bend forward. Lying down with the knee soft lengthens them while your back stays supported.',
    mistakes: [
      {
        mistake: 'Strap at the toes, pulling the ankle up',
        risk: 'Adds tension to the sciatic nerve.',
        fix: 'Loop the strap at the arch and keep your toes relaxed.',
        clip: 'supine-hamstring-stretch-strap.ankle-pulled-up',
        pose: 'Strap sits over the toes and pulls the ankle about 15 to 20 degrees up toward the shin while the knee is locked straight.',
      },
      {
        mistake: 'Lower back rounding and the other thigh lifting',
        risk: 'Moves the load into your lower back.',
        fix: 'Keep the other leg long and heavy and your hips down.',
        clip: 'supine-hamstring-stretch-strap.pelvis-curls',
        pose: 'Pelvis curls up so the lumbar spine rounds about 10 to 15 degrees off the mat, and the resting thigh lifts about 20 degrees off the floor.',
      },
    ],
    backSafety: {
      status: 'avoidWhenIrritable',
      note: 'On a leg with sciatica this is the straight leg raise nerve test position. On irritable days, use the supine nerve glide on that leg instead. When calm, keep the hip at ninety degrees and straighten the knee only to the first pull.',
      regression: 'sciatic-nerve-glide-supine',
    },
    cues: ['Toes soft', 'Hips heavy, head down', 'Mild pull, mid thigh', 'Knee soft, not locked'],
    youtube: {
      tutorial: 'supine hamstring stretch with strap physical therapist',
      mistakes: 'hamstring stretch with strap mistakes physical therapist',
    },
    sources: [
      'https://www.southtees.nhs.uk/resources/hamstring-stretch-1/',
      'https://www.nhsinform.scot/illnesses-and-conditions/muscle-bone-and-joints/leg-and-foot-problems-and-conditions/exercises-for-thigh-problems/',
      'https://pubmed.ncbi.nlm.nih.gov/19881004/',
    ],
  },
  {
    id: 'side-lying-quad-stretch',
    name: 'Side-Lying Quad Stretch',
    summary:
      'A lying stretch for the front of your thigh, with the pelvis gently tucked so your lower back stays comfortable.',
    muscles: {
      primary: ['Quadriceps'],
      secondary: ['Hip flexors'],
    },
    equipment: 'Mat and pillow, with a strap or towel if needed',
    setup: [
      'Lie on your side on a mat with your head on a pillow.',
      'Bend the bottom knee forward for balance.',
      'If you cannot reach your ankle easily, loop a strap or towel around it.',
    ],
    steps: [
      'Bend the top knee and hold the ankle or the strap.',
      'Tuck your tailbone under and draw your belly gently in.',
      'Keep your knees level, with the top thigh in line with your body.',
      'Breathe out and ease the knee back until you feel a stretch down the front of the thigh.',
      'Hold and breathe, then release and roll over to switch sides.',
    ],
    dosage: { holdSeconds: 30, sets: 2, sides: 'each' },
    breathing:
      'Breathe in slowly through your nose for about four seconds. Breathe out long and slow for about six seconds as you ease the knee back. Keep breathing easily, and never hold your breath.',
    feel: 'A gentle stretch down the front of the top thigh, about 3 to 4 out of 10.',
    shouldNotFeel:
      'Stop if you feel pinching in your lower back or pain in your knee. Tingling or burning at the front of the thigh means the thigh nerve is under tension, so reduce the knee bend and let your heel move away from your buttock. If tingling, numbness or pain travels down your leg or into your foot, ease off or stop. Anything stirred up should settle within about a minute.',
    why: 'Tight quadriceps pull on the front of your pelvis and can add to lower back strain when you stand and walk. Lying on your side lets you stretch them with no load on your spine.',
    mistakes: [
      {
        mistake: 'Lower back arching',
        risk: 'Squeezes the joints of your lower back.',
        fix: 'Tuck your tailbone and keep your ribs down before you ease the knee back.',
        clip: 'side-lying-quad-stretch.back-arches',
        pose: 'Lumbar spine arches about 15 to 20 degrees into extension as the heel is pulled toward the buttock, with the ribs flaring forward.',
      },
      {
        mistake: 'Top thigh drifting forward',
        risk: 'Takes the stretch away from the front of the hip.',
        fix: 'Keep the knee in line with your hip, or just behind it.',
        clip: 'side-lying-quad-stretch.thigh-drifts-forward',
        pose: 'Top hip flexes about 20 to 30 degrees so the knee drifts forward of the body line while the heel stays near the buttock.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'No load on the sciatic nerve. Keep the pelvis tucked if arching bothers your back. If the front of the thigh tingles, use a strap and less knee bend.',
    },
    cues: ['Tail tucked', 'Knees level', 'Knee back, not up', 'Breathe out, ease back'],
    youtube: {
      tutorial: 'side lying quad stretch physiotherapy',
      mistakes: 'quad stretch mistakes physiotherapy',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/149/side-lying-quadriceps-stretch/',
      'https://www.southtees.nhs.uk/resources/quads-stretch/',
      'https://pubmed.ncbi.nlm.nih.gov/21295239/',
    ],
  },
  {
    id: 'wall-calf-stretch',
    name: 'Wall Calf Stretch',
    summary:
      'A standing stretch against a wall for the upper calf and Achilles tendon, with the back knee straight and the heel down.',
    muscles: {
      primary: ['Upper calf'],
      secondary: ['Achilles tendon'],
    },
    equipment: 'Wall',
    setup: [
      'Stand facing a wall with your hands on it at shoulder height.',
      'Step one foot a long pace back, with both feet pointing straight ahead.',
      'If you have reduced feeling in your feet or a foot deformity, keep supportive shoes on.',
    ],
    steps: [
      'Keep the back knee straight and the back heel down.',
      'Bend the front knee and lean your body toward the wall as one piece.',
      'Stop at a gentle stretch in the upper calf of the back leg.',
      'Hold and breathe, leaning a little more on each breath out.',
      'Step your feet together, then switch sides.',
    ],
    dosage: { holdSeconds: 30, sets: 2, sides: 'each' },
    breathing:
      'Breathe in slowly through your nose for about four seconds. Breathe out long and slow for about six seconds, leaning a fraction further as you breathe out. Keep breathing easily, and never hold your breath.',
    feel: 'A gentle pull in the belly of the calf on the back leg, about 3 to 4 out of 10.',
    shouldNotFeel:
      'If burning, tingling, numbness or pain travels down your leg or into your foot, ease off or stop, and use the bent knee soleus stretch instead. Anything stirred up should settle within about a minute. If you have reduced feeling in your feet, keep the stretch mild and check your feet afterwards.',
    why: 'Flexible calves give you a smoother stride and make squats and stairs easier. Calves also tend to stiffen with diabetes, so regular stretching helps keep your ankles moving.',
    mistakes: [
      {
        mistake: 'Back heel lifting',
        risk: 'Loses the calf stretch.',
        fix: 'Take a shorter step and press the heel down.',
        clip: 'wall-calf-stretch.heel-lifts',
        pose: 'Back heel rises about 1 to 3 centimetres off the floor as the body leans toward the wall.',
      },
      {
        mistake: 'Hips sagging and lower back arching',
        risk: 'Strains your lower back.',
        fix: 'Keep one straight line from head to heel and lean from the ankles.',
        clip: 'wall-calf-stretch.hips-sag',
        pose: 'Hips sag forward toward the wall and the lumbar spine arches about 15 degrees into extension, breaking the straight line from head to back heel.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'A straight knee with the ankle bent tensions the sciatic and tibial nerve, so sciatic calf pain can flare. Use a shorter step and a smaller lean, or switch to the soleus stretch on irritable days.',
      regression: 'soleus-stretch',
    },
    cues: ['Toes forward', 'Back heel heavy', 'Lean as one piece', 'Breathe out, lean in'],
    youtube: {
      tutorial: 'wall calf stretch gastrocnemius physiotherapist',
      mistakes: 'calf stretch mistakes physiotherapist',
    },
    sources: [
      'https://www.nhs.uk/live-well/exercise/flexibility-exercises/',
      'https://www.southtees.nhs.uk/resources/upper-calf-stretch/',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC6908414/',
    ],
  },
  {
    id: 'soleus-stretch',
    name: 'Bent-Knee Soleus Stretch',
    summary:
      'A standing calf stretch with both knees bent, which reaches the lower calf and Achilles while keeping the sciatic nerve slack.',
    muscles: {
      primary: ['Lower calf'],
      secondary: ['Achilles tendon'],
    },
    equipment: 'Wall',
    setup: [
      'Stand facing a wall with your hands resting on it.',
      'Step one foot a short pace behind the other, with both feet pointing straight ahead.',
      'Keep supportive shoes on if you have reduced feeling in your feet.',
    ],
    steps: [
      'Keep the back heel firmly down.',
      'Bend both knees and sink your hips straight down.',
      'Stop at a gentle stretch low in the calf of the back leg.',
      'Keep the back knee in line with your second toe.',
      'Hold and breathe, then rise slowly and switch sides.',
    ],
    dosage: { holdSeconds: 30, sets: 2, sides: 'each' },
    breathing:
      'Breathe in slowly through your nose for about four seconds. Breathe out long and slow for about six seconds, sinking a little lower as you breathe out. Keep breathing easily, and never hold your breath.',
    feel: 'A deep, gentle pull low in the calf or around the Achilles of the back leg, about 3 to 4 out of 10.',
    shouldNotFeel:
      'Stop if you feel sharp pain in the Achilles or heel, or pain in the knee. If tingling, numbness or pain travels down your leg or into your foot, ease off or stop. Anything stirred up should settle within about a minute. With reduced feeling in your feet, keep it mild and check your feet afterwards.',
    why: 'The lower calf works hard every time you walk or climb stairs. Bending the knee slackens the sciatic nerve, which makes this the calf stretch of choice when sciatica reaches the calf.',
    mistakes: [
      {
        mistake: 'Back heel lifting',
        risk: 'Loses the stretch.',
        fix: 'Take a shorter step and keep the heel down as the knees bend.',
        clip: 'soleus-stretch.heel-lifts',
        pose: 'Back heel rises about 1 to 2 centimetres off the floor as both knees bend.',
      },
      {
        mistake: 'Back knee barely bending',
        risk: 'Turns it back into an upper calf stretch that tensions the nerve.',
        fix: 'Bend both knees and sit your hips straight down.',
        clip: 'soleus-stretch.knee-straight',
        pose: 'Back knee bends less than 15 degrees while the body leans forward, so the stretch stays in the upper calf.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'The bent knee slackens the sciatic and tibial nerve, so this is the preferred calf stretch with sciatica. If standing is hard, sit and slide the foot back under the chair with the heel down.',
    },
    cues: ['Heel down', 'Sit straight down', 'Knee over toes', 'Breathe out, sink'],
    youtube: {
      tutorial: 'soleus stretch bent knee wall physiotherapist',
      mistakes: 'soleus stretch mistakes physiotherapist',
    },
    sources: [
      'https://www.southtees.nhs.uk/resources/lower-calf-stretch/',
      'https://www.southtees.nhs.uk/resources/advanced-lower-calf-stretch/',
      'https://www.acefitness.org/resources/everyone/exercise-library/152/standing-dorsi-flexion-calf-stretch/',
    ],
  },
  {
    id: 'diaphragmatic-breathing-90-90',
    name: '90-90 Diaphragmatic Breathing',
    summary:
      'A calming breathing drill, lying with your feet on a wall and your hips and knees bent to right angles, that teaches low, wide breaths.',
    muscles: {
      primary: ['Diaphragm'],
      secondary: ['Deep abdominals', 'Pelvic floor'],
    },
    equipment: 'Mat and a wall, or a chair',
    setup: [
      'Lie on your back on a mat with your feet flat on a wall, hips and knees bent to about ninety degrees.',
      'If there is no wall nearby, rest your calves on a chair seat instead.',
      'Place one hand on your chest and the other on your belly.',
    ],
    steps: [
      'Let your lower back rest heavy on the mat.',
      'Breathe in through your nose for about four seconds, feeling your belly and lower ribs widen.',
      'Keep the hand on your chest still.',
      'Breathe out softly through pursed lips for about six seconds as your ribs sink.',
      'Let the next breath arrive by itself, with no pause.',
    ],
    dosage: { reps: 5, secondsPerRep: 10, sets: 3, sides: 'none' },
    breathing:
      'Breathe in through your nose for about four seconds, low and wide into your belly and side ribs. Breathe out softly through pursed lips for about six seconds. There are no holds at any point, so let each breath flow into the next.',
    feel: 'Your belly and lower ribs rising and widening, your neck and shoulders quiet, and your whole body growing heavier.',
    shouldNotFeel:
      'Stop if you feel dizzy or light headed, or notice tingling in your lips or fingers, which means you are breathing too much. Stop if back pain appears, or if tingling, numbness or pain travels down your leg. It should settle within about a minute. Roll onto your side and sit up slowly when you finish.',
    why: 'Slow breathing with a long breath out calms your nervous system and can help lower blood pressure. Breathing low and wide also trains the deep trunk muscles that support your back.',
    mistakes: [
      {
        mistake: 'Ribs flaring and back arching',
        risk: 'Puts extension stress on your lower back.',
        fix: 'Let your ribs drop and keep your lower back heavy.',
        clip: 'diaphragmatic-breathing-90-90.ribs-flare',
        pose: 'On the breath in, the lower ribs flare up and forward and the lumbar spine arches about 1 to 2 centimetres off the mat.',
      },
      {
        mistake: 'Forcing the breath out or pausing',
        risk: 'Straining or holding your breath can spike your blood pressure.',
        fix: 'Keep each breath soft and unforced, with no pause.',
        clip: 'diaphragmatic-breathing-90-90.forced-exhale',
        pose: 'Cheeks puff out, the belly braces hard and the lower ribs clamp down at the end of the breath out, then the breath stops with the throat closed, the jaw clenched and the shoulders tensed about 1 centimetre up toward the ears.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Supported, bent hips usually ease sensitive backs. No breath holds at any point. If lying with the feet up is uncomfortable, keep the feet on the floor with a pillow under the knees.',
    },
    cues: ['Breathe low and wide', 'Long, easy breath out', 'Ribs soften down', 'Chest hand stays still'],
    youtube: {
      tutorial: '90 90 breathing feet on wall physical therapist',
      mistakes: 'diaphragmatic breathing mistakes physical therapist',
    },
    sources: [
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC2971640/',
      'https://my.clevelandclinic.org/health/articles/9445-diaphragmatic-breathing',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC7934526/',
    ],
  },
  {
    id: 'crocodile-breathing',
    name: 'Crocodile Breathing',
    summary:
      'A face down breathing drill that teaches your breath to widen your back and sides, helping your lower back relax.',
    muscles: {
      primary: ['Diaphragm'],
      secondary: ['Muscles between the ribs', 'Lower back muscles'],
    },
    equipment: 'Mat, with a pillow under your hips if needed',
    setup: [
      'Lie face down on a mat with your forehead resting on your stacked hands.',
      'Let your legs relax, with your toes turned in or out, whichever is comfortable.',
      'If lying flat bothers your back, place a pillow under your hips.',
    ],
    steps: [
      'Let your forehead and your whole body sink into the mat.',
      'Breathe in through your nose for about four seconds.',
      'Feel your belly press into the mat and your waist and lower back rise.',
      'Breathe out slowly for about six seconds, letting everything soften.',
      'Keep your shoulders and jaw loose.',
    ],
    dosage: { reps: 8, secondsPerRep: 10, sets: 2, sides: 'none' },
    breathing:
      'Breathe in through your nose for about four seconds, into your back and sides. Breathe out through your nose, or softly through your mouth, for about six seconds. There are no holds, so let each breath roll into the next.',
    feel: 'Your lower back and sides widening as you breathe in, and your body growing heavier as you breathe out.',
    shouldNotFeel:
      'If back or leg symptoms increase, or tingling, numbness or pain travels down your leg, add a pillow under your hips or stop. Anything stirred up should settle within about a minute. Stop if you feel dizzy or your neck is uncomfortable. Come up slowly through your hands and knees.',
    why: 'Breathing into your back gently moves the ribs and helps the muscles around your lower back let go. It is a calm way to settle your body before or after training.',
    mistakes: [
      {
        mistake: 'Lifting the head to look forward',
        risk: 'Strains your neck.',
        fix: 'Rest your forehead on your hands and keep your neck long.',
        clip: 'crocodile-breathing.head-lifts',
        pose: 'Forehead lifts off the stacked hands and the neck extends about 20 to 30 degrees so the face looks forward.',
      },
      {
        mistake: 'Arching the back and clenching the buttocks',
        risk: 'Adds extension stress to your lower back.',
        fix: 'Keep your hips heavy and your buttocks soft.',
        clip: 'crocodile-breathing.back-arches',
        pose: 'On the breath in, the buttocks clench and the lumbar spine arches about 10 degrees into extension, so the lower back dips instead of rising.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'No load on the spine. Lying flat puts the back in slight extension, so add a pillow under the hips if it aggravates your back or leg. The same breathing also works lying on your side or in the ninety ninety position.',
    },
    cues: ['Forehead heavy', 'Breathe into your back', 'Waist widens', 'Hips heavy, jaw soft'],
    youtube: {
      tutorial: 'crocodile breathing physical therapist',
      mistakes: 'crocodile breathing mistakes physical therapist',
    },
    sources: [
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC7934526/',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC12768353/',
    ],
  },
  {
    id: 'box-breathing',
    name: 'Box Breathing',
    summary:
      'A paced breathing drill that slows your breath to calm your heart rate and nervous system, done here with no breath holds.',
    muscles: {
      primary: ['Diaphragm'],
      secondary: ['Deep abdominals'],
    },
    equipment: 'Chair, or a mat to lie on',
    setup: [
      'Sit tall on a chair with your feet flat, or lie on your back with your knees bent.',
      'Rest your hands on your belly and let your shoulders relax.',
    ],
    steps: [
      'Breathe out slowly to begin.',
      'Breathe in gently through your nose for a count of four.',
      'Breathe out softly through pursed lips for a count of six.',
      'Go straight into the next breath, with no pause and no holding.',
      'Keep the breath quiet, low and easy as you repeat.',
    ],
    dosage: { reps: 6, secondsPerRep: 10, sets: 1, sides: 'none' },
    breathing:
      'This is the no hold version of box breathing. Breathe in through your nose for a count of four, then out softly for a count of six, about six breaths a minute. Classic box breathing adds pauses, which are left out here to keep your blood pressure steady. Never hold your breath.',
    feel: 'Calmer and slower, with your heart rate settling and your body feeling heavier.',
    shouldNotFeel:
      'Stop if you feel dizzy, short of air, or tingling in your lips or fingers, or if you notice chest discomfort or a headache. If it feels like too much, shorten the counts to three in and four out. If sitting stirs tingling, numbness or pain down your leg, lie on your back with your knees bent instead. It should settle within about a minute.',
    why: 'Slow, paced breathing calms your nervous system, and regular slow breathing can help lower blood pressure. It is a simple way to settle before training or to wind down afterwards.',
    mistakes: [
      {
        mistake: 'Holding the breath and bearing down',
        risk: 'Can spike your blood pressure, especially with high blood pressure or diabetic eye disease.',
        fix: 'Use this no hold version and keep your throat soft.',
        clip: 'box-breathing.breath-held',
        pose: 'After the breath in, the throat closes and the belly braces and bears down; the face reddens, the jaw clenches and the shoulders rise about 1 to 2 centimetres and lock while no air moves.',
      },
      {
        mistake: 'Big, fast breaths with rising shoulders',
        risk: 'Over breathing can make you feel light headed.',
        fix: 'Take gentle breaths, about three quarters full, and let your shoulders rest.',
        clip: 'box-breathing.over-breathing',
        pose: 'Shoulders rise about 2 to 3 centimetres toward the ears on each quick, large breath in, with the upper chest lifting and the belly still.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'No load on the spine, so use any comfortable position. The no hold version is the default. Classic box holds are opt in only, and are never offered with high blood pressure or diabetic eye disease.',
    },
    cues: ['In for four', 'Out for six', 'Throat soft, no holding', 'Quiet, easy breaths'],
    youtube: {
      tutorial: 'box breathing technique physiotherapist',
      mistakes: 'breathing exercise mistakes hyperventilation physiotherapist',
    },
    sources: [
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC9873947/',
      'https://pubmed.ncbi.nlm.nih.gov/31331557/',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC6908414/',
    ],
  },
  {
    id: 'march-in-place',
    name: 'March in Place',
    summary:
      'An easy march on the spot that gently raises your heart rate and warms your whole body for the rest of the session.',
    muscles: {
      primary: ['Hip flexors', 'Calves'],
      secondary: ['Glutes', 'Core', 'Shoulders'],
    },
    equipment: 'None, with a counter or chair nearby for balance',
    setup: [
      'Stand tall with your feet hip width apart.',
      'Stand near a counter or sturdy chair in case you need it for balance.',
      'Wear supportive shoes, especially if you have reduced feeling in your feet.',
    ],
    steps: [
      'Start marching gently on the spot, lifting one knee and then the other.',
      'Swing your arms in rhythm with your steps, elbows softly bent.',
      'Stand tall, with your eyes ahead and your shoulders relaxed.',
      'Land softly through the whole foot.',
      'After the first minute, lift your knees a little higher and pick up the pace.',
      'Finish warm and breathing a little faster, but still able to talk.',
    ],
    dosage: { reps: 60, secondsPerRep: 2, sets: 1, sides: 'none' },
    breathing:
      'Start with slow breaths through your nose, about four seconds in and six seconds out. As you speed up, let your breathing quicken naturally, but keep it smooth and never hold it.',
    feel: 'Warmth spreading through your legs and body, with your breathing a little quicker, building from an easy 3 to about 5 out of 10.',
    shouldNotFeel:
      'Stop if you feel chest pain, dizziness or unusual breathlessness. If tingling, numbness or pain travels down your leg or into your foot, take smaller steps with lower knees, or stop. Anything stirred up should settle within about a minute.',
    why: 'Raising your heart rate and body temperature is the first step of a good warm up. Warm tissues move more easily, which prepares your back, hips and nerves for the mobility work that follows.',
    mistakes: [
      {
        mistake: 'Leaning back to lift the knees',
        risk: 'Arches your lower back and loads the joints there.',
        fix: 'Stand tall with your ribs down, and lift your knees only as high as your trunk stays upright.',
        clip: 'march-in-place.leaning-back',
        pose: 'Trunk leans back about 10 to 15 degrees and the lumbar spine arches as each knee is lifted above hip height.',
      },
      {
        mistake: 'Stamping the feet down',
        risk: 'Jars your joints and can stir up back and leg symptoms.',
        fix: 'Land softly through the whole foot.',
        clip: 'march-in-place.stamping',
        pose: 'Each foot drops hard from about 20 centimetres onto a stiff, nearly locked knee, landing flat with a visible jolt through the trunk.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Low impact. If leg symptoms build, take smaller steps with lower knee lifts. Hold a counter if balance is an issue, and wear supportive shoes if you have reduced feeling in your feet.',
    },
    cues: ['Stand tall', 'Soft feet', 'Arms swing easily', 'Warm, but able to talk'],
    youtube: {
      tutorial: 'marching on the spot warm up physiotherapist',
      mistakes: 'marching in place exercise mistakes physiotherapist',
    },
    sources: [
      'https://www.nhs.uk/live-well/exercise/how-to-warm-up-before-exercising/',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC12234454/',
      'https://www.cdc.gov/physical-activity-basics/measuring/index.html',
    ],
  },
  {
    id: 'scapular-push-up',
    name: 'Scapular Push-Up',
    summary:
      'A small push up movement where only your shoulder blades move, waking up the serratus muscle that keeps them steady against your ribs.',
    muscles: {
      primary: ['Serratus anterior'],
      secondary: ['Muscles between the shoulder blades', 'Chest'],
    },
    equipment: 'Wall, sturdy bench or mat',
    setup: [
      'Choose your level: hands on a wall, on a sturdy bench, or on the floor with your knees down.',
      'Place your hands under your shoulders, arms straight but not locked.',
      'Make a straight line from your head to your knees or heels, with a gentle brace.',
    ],
    steps: [
      'Keep your arms straight the whole time, so only your shoulder blades move.',
      'Breathe in and let your chest sink slowly as your shoulder blades draw together.',
      'Breathe out and push the floor or wall away, spreading your shoulder blades wide.',
      'Finish with your upper back gently rounded between your shoulders.',
      'Keep your hips level and your neck long throughout.',
    ],
    dosage: { reps: 10, secondsPerRep: 4, sets: 1, sides: 'none' },
    breathing:
      'Breathe in softly through your nose as your chest sinks, and breathe out as you push away. Keep the pace slow, about two seconds each way, and never hold your breath.',
    feel: 'Light work around your shoulder blades and along the sides of your ribs, about 3 to 4 out of 10.',
    shouldNotFeel:
      'Stop if you feel a pinch at the front of the shoulder or tingling in your hands. If holding the position makes your lower back ache, move to the bench or the wall. If tingling, numbness or pain travels down your leg, stop. Anything stirred up should settle within about a minute.',
    why: 'The serratus holds your shoulder blades flat against your ribs as you push and reach overhead. Waking it up before pressing helps keep your shoulders stable and comfortable.',
    mistakes: [
      {
        mistake: 'Bending the elbows',
        risk: 'Turns it into a regular push up, so the shoulder blades stop doing the work.',
        fix: 'Keep your arms straight and let only your shoulder blades move.',
        clip: 'scapular-push-up.elbows-bend',
        pose: 'Elbows bend about 30 to 40 degrees as the chest lowers, instead of staying straight with movement only at the shoulder blades.',
      },
      {
        mistake: 'Hips sagging toward the floor',
        risk: 'Arches and loads your lower back.',
        fix: 'Brace gently and keep one straight line, or move your hands higher.',
        clip: 'scapular-push-up.hips-sag',
        pose: 'Hips drop about 10 centimetres below the straight body line and the lumbar spine sags about 15 to 20 degrees into extension.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Low load. Use the wall or bench version if holding a plank strains your lower back, and keep a gentle brace so the hips do not sag.',
    },
    cues: ['Arms stay straight', 'Chest sinks, then push away', 'Spread your shoulder blades', 'Hips level'],
    youtube: {
      tutorial: 'scapular push up serratus anterior physical therapist',
      mistakes: 'scapular push up mistakes physical therapist',
    },
    sources: [
      'https://pubmed.ncbi.nlm.nih.gov/14977678/',
      'https://www.uhcw.nhs.uk/download/clientfiles/files/Patient%20Information%20Leaflets/Integrated%20and%20Community%20Care%20Services/Therapies/Physiotherapy/Shoulder%20class%20-%20week%203.pdf',
    ],
  },
  {
    id: 'prone-y-t',
    name: 'Prone Y-T Raise',
    summary:
      'A face down drill that lifts your arms into a Y and then a T shape, strengthening the muscles that draw your shoulder blades back and down.',
    muscles: {
      primary: ['Lower trapezius', 'Middle trapezius'],
      secondary: ['Rear shoulders', 'Muscles between the shoulder blades'],
    },
    equipment: 'Mat and a rolled towel, with a pillow under your hips if needed',
    setup: [
      'Lie face down on a mat with a rolled towel under your forehead.',
      'If lying flat bothers your lower back, place a pillow under your hips.',
      'Let your legs rest long and relaxed.',
    ],
    steps: [
      'Reach your arms overhead into a Y shape, thumbs pointing up.',
      'Breathe out and lift both arms just off the mat, drawing your shoulder blades back and down.',
      'Pause briefly, then lower slowly as you breathe in.',
      'Bring your arms straight out to the sides into a T, thumbs up.',
      'Breathe out and lift again, squeezing gently between your shoulder blades, then lower.',
      'Keep your forehead on the towel and your lower back relaxed throughout.',
    ],
    dosage: { reps: 8, secondsPerRep: 6, sets: 1, sides: 'none' },
    breathing:
      'Breathe out slowly as you lift your arms, and breathe in softly through your nose as you lower them. Keep each pause short and keep breathing. Never hold your breath.',
    feel: 'Gentle work between and just below your shoulder blades, about 3 to 4 out of 10.',
    shouldNotFeel:
      'Stop if you feel a pinch in your shoulders, strain in your neck, or pain in your lower back. If your back complains, add a pillow under your hips and lift only your arms. If tingling, numbness or pain travels down your leg or arm, stop. Anything stirred up should settle within about a minute.',
    why: 'These muscles set your shoulder blades in a good position for rowing, pressing and reaching overhead. Keeping them strong helps counter rounded shoulders.',
    mistakes: [
      {
        mistake: 'Lifting the chest and arching the back',
        risk: 'Loads your lower back in extension and lets your back do the work.',
        fix: 'Keep your forehead on the towel and lift from your shoulders only.',
        clip: 'prone-y-t.back-arches',
        pose: 'Chest and head lift about 10 centimetres off the mat and the lumbar spine arches about 15 to 20 degrees into extension as the arms rise.',
      },
      {
        mistake: 'Shrugging toward the ears',
        risk: 'Lets the top of your shoulders take over and can pinch the shoulder.',
        fix: 'Draw your shoulder blades down toward your back pockets before you lift.',
        clip: 'prone-y-t.shrugging',
        pose: 'Shoulders rise about 2 to 3 centimetres toward the ears as the arms lift, shortening the neck.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Only the arms lift. Lying face down puts the back in slight extension, so add a pillow under the hips if it aggravates your back or leg, and never lift the chest.',
    },
    cues: ['Forehead stays down', 'Shoulder blades back and down', 'Lift from the shoulders', 'Thumbs up'],
    youtube: {
      tutorial: 'prone Y T raise lower trapezius physical therapist',
      mistakes: 'prone Y raise mistakes physical therapist',
    },
    sources: [
      'https://pubmed.ncbi.nlm.nih.gov/12774999/',
      'https://www.wwl.nhs.uk/media/.leaflets/657835a18e50d7.90662950.pdf',
      'https://www.acefitness.org/resources/everyone/exercise-library/249/prone-scapular-shoulder-stabilization-series-i-y-t-w-o-formation/',
    ],
  },
  {
    id: 'scapular-pull-up',
    name: 'Scapular Pull-Up',
    summary:
      'A small movement while hanging from a bar, drawing your shoulder blades down without bending your elbows, to wake up the muscles that steady your shoulders.',
    muscles: {
      primary: ['Lower trapezius', 'Lats'],
      secondary: ['Serratus anterior', 'Forearms'],
    },
    equipment: 'Pull-up bar, with a box or step to stand on',
    setup: [
      'Place a sturdy box or step under a pull up bar.',
      'Step up and take an overhand grip, about shoulder width apart.',
      'Keep your feet lightly on the box to take some of your weight, or lift them only if your shoulders feel strong.',
    ],
    steps: [
      'Let your arms straighten into a gentle hang, shoulders rising toward your ears.',
      'Keeping your elbows straight, draw your shoulder blades down and slightly back.',
      'Your body rises a little as your shoulders move away from your ears.',
      'Pause for a moment, then lower slowly back into the gentle hang.',
      'When you finish, step down onto the box, and never drop to the floor.',
    ],
    dosage: { reps: 8, secondsPerRep: 4, sets: 1, sides: 'none' },
    breathing:
      'Breathe out as you draw your shoulder blades down, and breathe in softly as you lower. Keep your grip firm but relaxed, and never hold your breath.',
    feel: 'Work low between your shoulder blades and down the sides of your back, plus a firm grip, about 3 to 5 out of 10.',
    shouldNotFeel:
      'Stop if you feel a pinch in your shoulders, pain in your elbows, or tingling in your hands. If hanging stirs your back, or sends tingling, numbness or pain down your leg, take more weight through your feet or stop. Anything stirred up should settle within about a minute.',
    why: 'Drawing the shoulder blades down is the first part of every pull up and pulldown. Practising it on its own sets your shoulders safely before you pull.',
    mistakes: [
      {
        mistake: 'Bending the elbows',
        risk: 'Turns it into a partial pull up, so the shoulder blades stop leading.',
        fix: 'Keep your arms long and move only at your shoulders.',
        clip: 'scapular-pull-up.elbows-bend',
        pose: 'Elbows bend about 30 to 45 degrees as the body rises, while the shoulder blades stay high near the ears.',
      },
      {
        mistake: 'Swinging and arching the back',
        risk: 'Strains your lower back and shoulders.',
        fix: 'Keep a light brace with your ribs down, and keep your feet on the box if you swing.',
        clip: 'scapular-pull-up.back-arches',
        pose: 'Legs swing forward and back and the lumbar spine arches about 20 degrees into extension, ribs flaring, as the body jerks upward.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Keep your feet on a box to take part of your weight, step up and down rather than jumping or dropping, and keep sets short so gripping never turns into straining.',
    },
    cues: ['Long arms', 'Shoulders away from your ears', 'Small and slow', 'Step down, never drop'],
    youtube: {
      tutorial: 'scapular pull up physical therapist',
      mistakes: 'scapular pull up mistakes physical therapist',
    },
    sources: [
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC4916995/',
      'https://www.nsca.com/contentassets/3d09f06f0b4c4f6fbd8cc382ed1f3d4a/ptq-10.2.1-progressive-strategies-for-teaching-fundamental-resistance-training-movement-patterns.pdf',
    ],
  },
  {
    id: 'band-walk',
    name: 'Lateral Band Walk',
    summary:
      'Small side steps against a light band that wake up the muscles at the side of your hips before squats and lunges.',
    muscles: {
      primary: ['Gluteus medius'],
      secondary: ['Gluteus maximus', 'Outer hip'],
    },
    equipment: 'Light resistance band',
    setup: [
      'Place a light loop band around your legs just above your knees, or around your ankles for more challenge.',
      'Stand with your feet hip width apart and a gentle bend in your knees and hips.',
      'Keep your chest up and your weight even on both feet.',
    ],
    steps: [
      'Brace gently and keep your toes pointing forward.',
      'Step sideways with one foot, about the width of your hips.',
      'Follow with the other foot, keeping tension on the band.',
      'Keep your trunk tall and your hips level as you step.',
      'Take your steps in one direction, then come back the other way.',
    ],
    dosage: { reps: 10, secondsPerRep: 2, sets: 1, sides: 'each' },
    breathing:
      'Breathe slowly and steadily as you step, in through your nose and out softly through your mouth. Never hold your breath.',
    feel: 'Warm, steady work on the outside of your hips and buttocks, about 4 to 5 out of 10.',
    shouldNotFeel:
      'Stop if you feel pain in your knees or lower back. If tingling, numbness or pain travels down your leg or into your foot, take smaller steps or stop. Anything stirred up should settle within about a minute.',
    why: 'The side hip muscles keep your pelvis level and your knees tracking well when you squat, lunge and walk. Waking them up first helps your hips, rather than your lower back, control the movement.',
    mistakes: [
      {
        mistake: 'Leaning the trunk side to side',
        risk: 'Bends your lower back sideways and lets the hips off the hook.',
        fix: 'Stay tall and level, and take smaller steps.',
        clip: 'band-walk.trunk-leans',
        pose: 'Trunk side-bends about 15 to 20 degrees toward the standing leg with each step, and the pelvis hitches up on the stepping side.',
      },
      {
        mistake: 'Knees caving inward',
        risk: 'Strains your knees and takes the work away from your hips.',
        fix: 'Press your knees gently out against the band, over your toes.',
        clip: 'band-walk.knees-cave',
        pose: 'Both knees collapse inward about 10 to 15 degrees toward each other as the band pulls, with the feet turning out.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Standing and light. Keep the steps small and the trunk tall. The band above the knees is the easier version, and supportive shoes are wise if you have reduced feeling in your feet.',
    },
    cues: ['Stay tall and level', 'Toes forward', 'Knees press out', 'Small, steady steps'],
    youtube: {
      tutorial: 'lateral band walk glute medius physical therapist',
      mistakes: 'lateral band walk mistakes physical therapist',
    },
    sources: [
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC4951090/',
      'https://pubmed.ncbi.nlm.nih.gov/22464817/',
    ],
  },
  {
    id: 'band-row',
    name: 'Standing Band Row',
    summary:
      'A standing row with a light band that wakes up the muscles between your shoulder blades and sets your posture before pulling work.',
    muscles: {
      primary: ['Upper back', 'Lats'],
      secondary: ['Rear shoulders', 'Biceps'],
    },
    equipment: 'Light resistance band, anchored in a door or around a sturdy post',
    setup: [
      'Anchor the middle of a light band at chest height, in a closed door or around a sturdy post.',
      'Hold one end in each hand and step back until the band is lightly taut with your arms straight.',
      'Stand tall with your feet hip width apart, or one foot slightly in front, knees soft.',
    ],
    steps: [
      'Tuck your chin gently and draw your ribs down.',
      'Breathe out and pull the band toward your lower ribs, elbows close to your sides.',
      'Squeeze your shoulder blades gently together and down.',
      'Pause for a moment, then let your arms straighten slowly as you breathe in.',
      'Keep your trunk still, with no leaning back.',
    ],
    dosage: { reps: 12, secondsPerRep: 4, sets: 1, sides: 'none' },
    breathing:
      'Breathe out as you pull and squeeze, and breathe in softly through your nose as your arms return slowly. Keep your grip relaxed, and never hold your breath.',
    feel: 'Work between your shoulder blades and at the back of your shoulders, about 4 to 5 out of 10.',
    shouldNotFeel:
      'Stop if you feel a pinch at the front of the shoulder, strain in your neck, or pain in your lower back. If tingling, numbness or pain travels down your leg or arm, stop. Anything stirred up should settle within about a minute.',
    why: 'Rowing muscles balance all the pushing we do and help hold your shoulders back. A light band row primes them before heavier pulling.',
    mistakes: [
      {
        mistake: 'Leaning back to pull',
        risk: 'Arches your lower back and swings the load into your spine.',
        fix: 'Use a lighter band, stay tall, and pull with your arms and shoulder blades only.',
        clip: 'band-row.leaning-back',
        pose: 'Trunk leans back about 15 to 20 degrees from vertical as the hands reach the ribs, with the lumbar spine arching.',
      },
      {
        mistake: 'Shrugging and poking the chin',
        risk: 'Strains your neck and the tops of your shoulders.',
        fix: 'Keep your shoulders down and your chin gently tucked.',
        clip: 'band-row.shrugging',
        pose: 'Shoulders rise about 2 to 3 centimetres toward the ears and the chin pokes about 3 to 5 centimetres forward at the end of the pull.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Do it standing, or seated tall on a chair. Avoid the floor version with the legs straight out in front, because sitting with straight legs puts tension on the sciatic nerve.',
    },
    cues: ['Elbows close to your sides', 'Squeeze and breathe out', 'Slow on the way back', 'Stay tall'],
    youtube: {
      tutorial: 'resistance band row physiotherapist',
      mistakes: 'resistance band row mistakes physiotherapist',
    },
    sources: [
      'https://northcheshireandmersey.nhs.uk/media/3aaixkhv/shoulder-strengthening-exercises-patient-advice-sheet.pdf',
      'https://pubmed.ncbi.nlm.nih.gov/20133444/',
    ],
  },
  {
    id: 'dowel-hinge',
    name: 'Dowel Hip Hinge',
    summary:
      'A drill that teaches you to bend from your hips with a long spine, using a stick along your back as a guide.',
    muscles: {
      primary: ['Glutes', 'Hamstrings'],
      secondary: ['Back muscles', 'Deep abdominals'],
    },
    equipment: 'Dowel or broomstick',
    setup: [
      'Stand with your feet between hip and shoulder width apart, knees unlocked.',
      'Hold a dowel or broomstick upright along your back, one hand behind your neck and the other at the small of your back.',
      'The stick should touch three points: the back of your head, your upper back and your tailbone.',
    ],
    steps: [
      'Soften your knees and set a gentle brace in your belly.',
      'Breathe in and push your hips back, as if closing a car door with your buttocks.',
      'Let your chest tip forward, keeping all three points on the stick.',
      'Stop at a mild pull in the back of your thighs, or as soon as the stick starts to leave a point.',
      'Breathe out and drive your hips forward to stand tall, squeezing your buttocks.',
    ],
    dosage: { reps: 10, secondsPerRep: 5, sets: 1, sides: 'none' },
    breathing:
      'Breathe in slowly through your nose as your hips push back, and breathe out as you stand tall. Keep a light brace while you breathe, and never hold your breath.',
    feel: 'A mild stretch in the back of your thighs and light work in your buttocks, about 3 to 4 out of 10, with your lower back feeling quiet.',
    shouldNotFeel:
      'Stop if you feel pain in your lower back. If tingling, numbness or pain travels down your leg or into your foot, bend your knees more and shorten the range, or stop. Anything stirred up should settle within about a minute.',
    why: 'The hip hinge is the foundation for deadlifts and for picking things up safely. Moving at your hips with a long spine spares your lower back.',
    mistakes: [
      {
        mistake: 'Rounding the back off the stick',
        risk: 'Moves the bend into your lower back and loads the discs.',
        fix: 'Keep all three points on the stick and stop earlier.',
        clip: 'dowel-hinge.back-rounds',
        pose: 'At about 60 degrees of trunk lean the lumbar spine rounds about 20 to 30 degrees into flexion, so the lower back bulges into the dowel and the tailbone loses contact with it.',
      },
      {
        mistake: 'Squatting down instead of hinging',
        risk: 'Misses the hip pattern and loads the knees.',
        fix: 'Keep your shins nearly upright and send your hips back, not down.',
        clip: 'dowel-hinge.squatting',
        pose: 'Knees bend about 60 to 70 degrees and travel forward over the toes while the trunk stays nearly upright and the hips drop down rather than back.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'This is the spine sparing way to bend. Keep the knees soft and stop at the first hamstring pull, before the stick leaves your tailbone. With leg symptoms, bend the knees more and shorten the range.',
    },
    cues: ['Three points on the stick', 'Hips back, close the car door', 'Soft knees', 'Stand tall and squeeze'],
    youtube: {
      tutorial: 'dowel hip hinge physical therapist',
      mistakes: 'hip hinge mistakes physical therapist',
    },
    sources: [
      'https://www.nsca.com/contentassets/3d09f06f0b4c4f6fbd8cc382ed1f3d4a/ptq-10.2.1-progressive-strategies-for-teaching-fundamental-resistance-training-movement-patterns.pdf',
      'https://www.backfitpro.com/books/back-mechanic-the-mcgill-method-to-fix-back-pain/',
    ],
  },
  {
    id: 'box-squat',
    name: 'Bodyweight Box Squat',
    summary:
      'A bodyweight squat to a box or bench that teaches you to sit back with control and stand up using your legs.',
    muscles: {
      primary: ['Quadriceps', 'Glutes'],
      secondary: ['Hamstrings', 'Inner thighs', 'Core'],
    },
    equipment: 'Box or bench',
    setup: [
      'Place a sturdy box, bench or chair behind you, high enough that your lower back stays neutral when you sit.',
      'Stand just in front of it with your feet about hip to shoulder width apart, toes turned out slightly.',
      'Reach your arms forward for balance, or cross them over your chest.',
    ],
    steps: [
      'Brace gently and breathe in as you begin to lower.',
      'Push your hips back and bend your knees, keeping your chest proud.',
      'Lower slowly until you lightly touch the box, without flopping down.',
      'Keep your knees in line with your toes and your heels down.',
      'Breathe out and drive through your whole foot to stand tall.',
    ],
    dosage: { reps: 8, secondsPerRep: 5, sets: 1, sides: 'none' },
    breathing:
      'Breathe in slowly as you lower to the box, and breathe out as you stand. Keep a light brace while you breathe, and never hold your breath.',
    feel: 'Work in your thighs and buttocks, about 4 to 5 out of 10.',
    shouldNotFeel:
      'Stop if you feel pain in your knees or lower back. If your lower back rounds or aches at the bottom, use a higher box. If tingling, numbness or pain travels down your leg or into your foot, shorten the range or stop. Anything stirred up should settle within about a minute.',
    why: 'The box gives you a consistent, safe depth and teaches you to sit back with control. It grooves the squat pattern before you add any load.',
    mistakes: [
      {
        mistake: 'Lower back rounding at the bottom',
        risk: 'Loads the discs of your lower back.',
        fix: 'Use a higher box and keep your chest proud.',
        clip: 'box-squat.back-rounds',
        pose: 'At box contact the pelvis tucks under and the lumbar spine rounds about 15 to 25 degrees into flexion, with the chest collapsing forward.',
      },
      {
        mistake: 'Dropping onto the box',
        risk: 'Jolts your spine and loses control.',
        fix: 'Lower slowly and just touch the box before you stand.',
        clip: 'box-squat.dropping',
        pose: 'The last 20 centimetres of the descent become a free fall: the hips drop onto the box, the trunk rocks back about 15 degrees and the toes lift slightly.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Choose a box high enough that your lower back stays neutral, and use a higher box on irritable days. Touch the box lightly and never drop onto it.',
    },
    cues: ['Hips back, chest proud', 'Touch the box lightly', 'Knees over toes', 'Breathe out, stand tall'],
    youtube: {
      tutorial: 'box squat bodyweight physical therapist',
      mistakes: 'box squat mistakes physical therapist',
    },
    sources: [
      'https://www.nsca.com/contentassets/3d09f06f0b4c4f6fbd8cc382ed1f3d4a/ptq-10.2.1-progressive-strategies-for-teaching-fundamental-resistance-training-movement-patterns.pdf',
      'https://www.nhs.uk/live-well/exercise/strength-and-flexibility-exercises/strength-exercises/',
    ],
  },
  {
    id: 'incline-push-up',
    name: 'Incline Push-Up',
    summary:
      'A push up with your hands raised on a bench or counter, which lightens the load so you can practise a solid plank and smooth pressing.',
    muscles: {
      primary: ['Chest', 'Triceps'],
      secondary: ['Front shoulders', 'Serratus anterior', 'Core'],
    },
    equipment: 'Box or bench, or a sturdy counter',
    setup: [
      'Place your hands on the edge of a sturdy bench or counter, just wider than your shoulders.',
      'Walk your feet back until your body forms a straight line from head to heels.',
      'The higher the surface, the easier the push up.',
    ],
    steps: [
      'Brace gently and keep your ribs down.',
      'Breathe in as you bend your elbows and lower your chest toward the edge.',
      'Keep your elbows angled back at about forty five degrees from your body.',
      'Lower until your chest is a hand width from the edge, or as far as is comfortable.',
      'Breathe out and push the bench away, keeping your body in one line.',
    ],
    dosage: { reps: 8, secondsPerRep: 4, sets: 1, sides: 'none' },
    breathing:
      'Breathe in as you lower, and breathe out as you push away. Keep the breath flowing on every rep, and never hold it.',
    feel: 'Work in your chest, the backs of your arms and your shoulders, about 4 to 5 out of 10.',
    shouldNotFeel:
      'Stop if you feel pain at the front of the shoulder or in your wrists. If your lower back sags or aches, use a higher surface. If tingling, numbness or pain travels down your leg or arm, stop. Anything stirred up should settle within about a minute.',
    why: 'Raising your hands means you press less of your body weight, so you can build pushing strength with good form. It also warms up your chest and shoulders before heavier pressing.',
    mistakes: [
      {
        mistake: 'Hips sagging',
        risk: 'Arches and loads your lower back.',
        fix: 'Squeeze your buttocks, brace, and use a higher surface if needed.',
        clip: 'incline-push-up.hips-sag',
        pose: 'Hips drop about 10 to 15 centimetres below the straight line from shoulders to heels, with the lumbar spine sagging about 15 to 20 degrees into extension.',
      },
      {
        mistake: 'Elbows flaring out wide',
        risk: 'Strains the front of the shoulder.',
        fix: 'Keep your elbows angled back toward your hips.',
        clip: 'incline-push-up.elbows-flare',
        pose: 'Elbows flare out to about 80 to 90 degrees from the trunk, level with the shoulders, as the chest lowers toward the bench.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'The incline keeps the load light. Use a higher surface, such as a counter or a wall, if holding the plank strains your lower back.',
    },
    cues: ['One straight line', 'Elbows angled back', 'Breathe out, push away', 'Ribs down'],
    youtube: {
      tutorial: 'incline push up form physical therapist',
      mistakes: 'incline push up mistakes physical therapist',
    },
    sources: [
      'https://www.nsca.com/contentassets/3d09f06f0b4c4f6fbd8cc382ed1f3d4a/ptq-10.2.1-progressive-strategies-for-teaching-fundamental-resistance-training-movement-patterns.pdf',
      'https://pubmed.ncbi.nlm.nih.gov/21873902/',
      'https://www.nhs.uk/live-well/exercise/strength-and-flexibility-exercises/strength-exercises/',
    ],
  },
  {
    id: 'knee-to-wall-rock',
    name: 'Knee-to-Wall Ankle Rock',
    summary:
      'A gentle rocking drill that bends the ankle by moving the knee toward a wall, freeing up your ankles for squats and lunges.',
    muscles: {
      primary: ['Lower calf'],
      secondary: ['Achilles tendon'],
    },
    equipment: 'Wall',
    setup: [
      'Stand facing a wall in a split stance, with your front foot about a hand width from the wall.',
      'Point your toes straight ahead and rest your hands on the wall.',
      'Keep the back foot a comfortable step behind you for balance.',
    ],
    steps: [
      'Keep your front heel firmly on the floor.',
      'Rock your front knee forward toward the wall, over your middle toes.',
      'Touch the wall lightly if you can, then rock back.',
      'If you touch easily, move your foot back a little, and if your heel lifts, move closer.',
      'Finish your rocks, then switch sides.',
    ],
    dosage: { reps: 10, secondsPerRep: 3, sets: 1, sides: 'each' },
    breathing:
      'Breathe out as your knee rocks forward, and breathe in softly as you rock back. Keep the rhythm slow and easy, and never hold your breath.',
    feel: 'A gentle stretch low in the calf or at the front of the ankle, about 3 to 4 out of 10.',
    shouldNotFeel:
      'Stop if you feel a sharp pinch at the front of the ankle, pain in the Achilles or heel, or knee pain. If tingling, numbness or pain travels down your leg or into your foot, ease off or stop. Anything stirred up should settle within about a minute. With reduced feeling in your feet, keep shoes on and stay gentle.',
    why: 'Good ankle bend lets your knees travel forward in squats and lunges, so your hips and back do not have to make up for stiff ankles. The bent knee keeps tension off the sciatic nerve.',
    mistakes: [
      {
        mistake: 'Front heel lifting',
        risk: 'Loses the ankle bend and moves the stretch away from the calf.',
        fix: 'Move your foot closer to the wall and keep the heel heavy.',
        clip: 'knee-to-wall-rock.heel-lifts',
        pose: 'Front heel rises about 1 to 2 centimetres off the floor as the knee drives toward the wall.',
      },
      {
        mistake: 'Knee caving inward',
        risk: 'Twists the knee and flattens the arch of your foot.',
        fix: 'Aim the knee over your middle toes.',
        clip: 'knee-to-wall-rock.knee-caves',
        pose: 'Front knee drifts about 10 to 15 degrees inward past the big toe as it moves toward the wall, and the arch of the foot collapses.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Standing with a bent knee, so the sciatic nerve stays slack. If calf or leg symptoms stir, use the static bent knee soleus stretch instead.',
      regression: 'soleus-stretch',
    },
    cues: ['Heel stays down', 'Knee over middle toes', 'Rock, do not force', 'Breathe out, rock forward'],
    youtube: {
      tutorial: 'knee to wall ankle mobility physiotherapist',
      mistakes: 'knee to wall ankle mobility mistakes physiotherapist',
    },
    sources: [
      'https://northcheshireandmersey.nhs.uk/media/5ndj32ll/ankle-range-of-motion-exercises-patient-advice-sheet.pdf',
      'https://pubmed.ncbi.nlm.nih.gov/11676731/',
      'https://pubmed.ncbi.nlm.nih.gov/25704110/',
    ],
  },
  {
    id: 'active-knee-extension',
    name: 'Active Knee Extension',
    summary:
      'A lying hamstring drill where you hold your thigh upright and slowly straighten the knee with your own muscles, never forcing the stretch.',
    muscles: {
      primary: ['Hamstrings'],
      secondary: ['Quadriceps'],
    },
    equipment: 'Mat, with a strap or towel if needed',
    setup: [
      'Lie on your back on a mat with your head resting down.',
      'Keep your other leg long on the floor, or bent with the foot flat if that is kinder to your back.',
      'Lift one thigh until it points straight up, and hold behind it with both hands or a strap.',
    ],
    steps: [
      'Keep your thigh still and your toes relaxed.',
      'Breathe out and slowly straighten the knee, using your thigh muscles.',
      'Stop at the first mild pull behind the thigh, without locking the knee.',
      'Breathe in and slowly bend the knee back down.',
      'Repeat smoothly, then switch legs.',
    ],
    dosage: { reps: 8, secondsPerRep: 4, sets: 1, sides: 'each' },
    breathing:
      'Breathe out slowly as the knee straightens, and breathe in softly through your nose as it bends. Keep the rhythm unhurried, and never hold your breath.',
    feel: 'A mild pull in the middle of the back of your thigh at the top of each rep, about 3 to 4 out of 10, easing as the knee bends.',
    shouldNotFeel:
      'Burning or tingling behind the knee, or tingling, numbness or pain travelling into the calf or foot, are nerve signs. Make the range smaller or stop, and use the nerve glide instead. Anything stirred up should settle within about a minute.',
    why: 'Moving your hamstrings through their range under your own control warms them up for hinging, without a long static hold. It also shows you how your hamstring flexibility changes over the weeks.',
    mistakes: [
      {
        mistake: 'Pulling the ankle up toward the shin',
        risk: 'Adds tension to the sciatic nerve.',
        fix: 'Keep your toes relaxed or gently pointed.',
        clip: 'active-knee-extension.ankle-pulled-up',
        pose: 'As the knee straightens, the ankle pulls about 15 to 20 degrees up toward the shin and stays there at the top of the rep.',
      },
      {
        mistake: 'Kicking the knee straight',
        risk: 'Jolts the hamstring and nerve instead of moving with control.',
        fix: 'Straighten slowly over about two seconds and stop short of locking.',
        clip: 'active-knee-extension.kicking',
        pose: 'Knee snaps from about 90 degrees of bend to fully locked in under one second, and the thigh drifts away from vertical.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'A bent hip with the knee straightening is close to the straight leg raise nerve test, so keep the toes relaxed, the head down and the range short of any tingling. On irritable days, or with sciatica in that leg, use the supine nerve glide instead.',
      regression: 'sciatic-nerve-glide-supine',
    },
    cues: ['Thigh stays still', 'Toes relaxed', 'Straighten slowly', 'Stop at the first pull'],
    youtube: {
      tutorial: 'active knee extension hamstring stretch physical therapist',
      mistakes: 'active hamstring stretch mistakes physical therapist',
    },
    sources: [
      'https://pubmed.ncbi.nlm.nih.gov/6867117/',
      'https://pubmed.ncbi.nlm.nih.gov/9549713/',
      'https://pubmed.ncbi.nlm.nih.gov/19881004/',
    ],
  },
  {
    id: 'reverse-lunge-overhead-reach',
    name: 'Reverse Lunge with Overhead Reach',
    summary:
      'A slow step back into a lunge with one arm reaching overhead, which stretches the front of your hip and warms up your legs.',
    muscles: {
      primary: ['Hip flexors', 'Glutes', 'Quadriceps'],
      secondary: ['Lats', 'Core'],
    },
    equipment: 'None, with a chair or wall nearby for balance',
    setup: [
      'Stand tall with your feet hip width apart.',
      'Stand beside a chair or wall you can touch for balance if needed.',
    ],
    steps: [
      'Step one foot back and lower slowly into a lunge, both knees bending.',
      'Keep your front knee over your ankle and your weight through the front heel.',
      'Tuck your tailbone and squeeze the buttock of the back leg.',
      'Breathe out and reach the arm on the back leg side up overhead, keeping your ribs down.',
      'Lower the arm and push through the front foot to step back to standing.',
      'Finish your reps on this leg, then switch legs.',
    ],
    dosage: { reps: 5, secondsPerRep: 6, sets: 1, sides: 'each' },
    breathing:
      'Breathe in as you step back and lower. Breathe out slowly as you reach up and feel the stretch. Let your breath flow easily as you return to standing, and never hold it.',
    feel: 'A gentle stretch at the front of the back hip and along that side of your body, with light work in the front leg, about 3 to 4 out of 10.',
    shouldNotFeel:
      'Stop if you feel pinching in your lower back or pain in your knees. Tingling or burning at the front of the thigh means the thigh nerve is under tension, so lunge less deeply and bend the back knee less. If tingling, numbness or pain travels down your leg or into your foot, ease off or stop. Anything stirred up should settle within about a minute.',
    why: 'This drill opens the front of your hips and warms up your legs in one movement. Stepping back is easier on the knees than stepping forward.',
    mistakes: [
      {
        mistake: 'Arching the lower back as you reach',
        risk: 'Loads your lower back in extension and loses the hip stretch.',
        fix: 'Tuck your tail and keep your ribs down, reaching only as high as you can without arching.',
        clip: 'reverse-lunge-overhead-reach.back-arches',
        pose: 'As the arm reaches overhead, the pelvis tips forward about 15 degrees, the lumbar spine arches into extension and the ribs flare forward.',
      },
      {
        mistake: 'Front knee caving inward',
        risk: 'Strains your knee and throws off your balance.',
        fix: 'Keep your front knee over your middle toes, and hold a support if needed.',
        clip: 'reverse-lunge-overhead-reach.knee-caves',
        pose: 'Front knee drifts about 10 to 15 degrees inward past the big toe at the bottom of the lunge, with the hips twisting toward that side.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'Keep the pelvis tucked and the ribs down as you reach, because arching loads the lower back in extension. Reach only to shoulder height, or hold a support, if arching or balance is a problem, and lunge less deeply if the front of the thigh tingles.',
    },
    cues: ['Step back softly', 'Tuck your tail', 'Reach tall, ribs down', 'Front knee over toes'],
    youtube: {
      tutorial: 'reverse lunge with overhead reach hip flexor mobility physical therapist',
      mistakes: 'reverse lunge mistakes physical therapist',
    },
    sources: [
      'https://www.hss.edu/health-library/move-better/hip-flexor-stretch',
      'https://pubmed.ncbi.nlm.nih.gov/33310585/',
      'https://pubmed.ncbi.nlm.nih.gov/26642915/',
    ],
  },
  {
    id: 'standing-rack-lat-stretch',
    name: 'Standing Rack Lat Stretch',
    summary:
      'A standing stretch where you hold a rack or door frame and sit your hips back, lengthening the wide muscle down the side of your back.',
    muscles: {
      primary: ['Lats'],
      secondary: ['Muscles behind the armpit', 'Triceps'],
    },
    equipment: 'Squat rack upright, door frame or sturdy counter',
    setup: [
      'Stand facing a squat rack upright, a door frame or a sturdy counter, close enough to hold it with a straight arm.',
      'Hold it with one hand at about hip to chest height.',
      'Set your feet hip width apart with your knees softly bent.',
    ],
    steps: [
      'Rest your free hand on your thigh for support.',
      'Breathe out and hinge at your hips, sitting them back and slightly away from your holding hand.',
      'Let your chest sink until you feel a stretch from that armpit down the side of your back.',
      'Keep your spine long and your head in line with it.',
      'Hold and breathe, then walk your hips back in and stand up slowly.',
      'Switch hands and repeat on the other side.',
    ],
    dosage: { holdSeconds: 30, sets: 2, sides: 'each' },
    breathing:
      'Breathe in slowly through your nose for about four seconds. Breathe out long and slow for about six seconds, sitting your hips back a little further as you breathe out. Keep breathing easily, and never hold your breath.',
    feel: 'A gentle stretch from your armpit down the side of your back, about 3 to 4 out of 10.',
    shouldNotFeel:
      'Stop if you feel pain in your lower back, a pinch in your shoulder, or dizziness when you stand up. If tingling, numbness or pain travels down your leg or into your foot, bend your knees more or stop. Anything stirred up should settle within about a minute.',
    why: 'Supple lats let your arms reach overhead without your lower back arching to make up the difference. Standing with soft knees keeps the stretch gentle on your back, with no kneeling.',
    mistakes: [
      {
        mistake: 'Rounding the lower back',
        risk: 'Can irritate the discs and nerves of your lower back.',
        fix: 'Hinge from your hips, keep your spine long, and stop before your back rounds.',
        clip: 'standing-rack-lat-stretch.back-rounds',
        pose: 'Hips sit back too far and the pelvis tucks, so the lumbar spine rounds about 20 to 30 degrees into flexion while the hand stays fixed on the upright.',
      },
      {
        mistake: 'Locking the knees straight',
        risk: 'Adds hamstring and sciatic nerve tension as you hinge.',
        fix: 'Keep your knees softly bent throughout.',
        clip: 'standing-rack-lat-stretch.knees-locked',
        pose: 'Both knees lock fully straight while the trunk hinges forward to about 90 degrees, so the pull shifts into the backs of the thighs.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Hinge with a long spine and soft knees, and stop before the lower back rounds. This is the gentler swap for the kneeling lat stretch. Stand up slowly at the end.',
    },
    cues: ['Hips back, spine long', 'Soft knees', 'Breathe out, sink back', 'Stand up slowly'],
    youtube: {
      tutorial: 'standing lat stretch physical therapist',
      mistakes: 'lat stretch mistakes physical therapist',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/198/90-lat-stretch/',
      'https://pubmed.ncbi.nlm.nih.gov/26642915/',
    ],
  },
  {
    id: 'biceps-wall-stretch',
    name: 'Biceps Wall Stretch',
    summary:
      'A standing stretch with your hand on a wall slightly behind you that gently lengthens the front of your upper arm and shoulder.',
    muscles: {
      primary: ['Biceps'],
      secondary: ['Front shoulder', 'Chest'],
    },
    equipment: 'Wall',
    setup: [
      'Stand with your side to a wall, the arm to be stretched nearest to it.',
      'Place your palm flat on the wall slightly behind you, at or just below shoulder height, with your elbow straight but not locked.',
    ],
    steps: [
      'Turn your hand so your thumb points down toward the floor.',
      'Draw your shoulder blade gently back and down.',
      'Breathe out and slowly turn your chest away from the wall.',
      'Stop at a gentle stretch along the front of your upper arm.',
      'Hold and breathe, then turn back and switch sides.',
    ],
    dosage: { holdSeconds: 20, sets: 2, sides: 'each' },
    breathing:
      'Breathe in slowly through your nose for about four seconds. Breathe out long and slow for about six seconds, turning your chest a fraction further away as you breathe out. Keep breathing easily, and never hold your breath.',
    feel: 'A gentle stretch along the front of your upper arm and the front of your shoulder, about 3 to 4 out of 10.',
    shouldNotFeel:
      'Stop if you feel a pinch at the front of the shoulder or pain in the elbow. If tingling, numbness or pain travels down your arm into your hand, a nerve is being stretched, so lower your hand and soften the elbow. Anything stirred up should settle within about a minute.',
    why: 'Rows and pulldowns work the biceps hard. A short, gentle stretch helps your elbows and the fronts of your shoulders keep moving freely.',
    mistakes: [
      {
        mistake: 'Shoulder rolling forward',
        risk: 'Pinches the front of the shoulder.',
        fix: 'Keep your shoulder blade back and down, and turn less.',
        clip: 'biceps-wall-stretch.shoulder-rolls-forward',
        pose: 'Front of the shoulder glides about 2 to 3 centimetres forward and rounds, and the shoulder hitches up toward the ear as the chest turns away.',
      },
      {
        mistake: 'Hand too high and turning too far',
        risk: 'Strains the shoulder and can stretch the nerves of the arm.',
        fix: 'Keep your hand at or below shoulder height, and turn only to a gentle stretch.',
        clip: 'biceps-wall-stretch.hand-too-high',
        pose: 'Hand placed about 30 degrees above shoulder height while the chest rotates about 60 degrees away from the wall, with the elbow locked and slightly hyperextended.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Standing, with no load on the spine. If your hand or fingers tingle, lower your hand and soften the elbow.',
    },
    cues: ['Thumb down', 'Shoulder back and down', 'Turn your chest away slowly', 'Breathe out, soften'],
    youtube: {
      tutorial: 'biceps wall stretch physiotherapist',
      mistakes: 'biceps stretch mistakes physiotherapist',
    },
    sources: [
      'https://us.physitrack.com/home-exercise-video/bicep-stretch-against-wall',
      'https://pubmed.ncbi.nlm.nih.gov/20810302/',
    ],
  },
];
