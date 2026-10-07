import type { Coaching } from '@/types/catalog';

/**
 * Coaching for the neck, upper back, shoulder, arm, torso and lower-back
 * mobility drills. Drafted from docs/research/technique-mobility-cardio.md
 * (per-item technique, mistakes and sources) and
 * docs/research/back-sciatica-mobility.md (dosing and safety). Spoken fields
 * are written for text-to-speech: plain words, no symbols or parentheses.
 */
export const MOBILITY_UPPER_COACHING: Coaching[] = [
  {
    id: 'chin-tuck',
    name: 'Chin Tuck',
    summary:
      'A gentle glide of your head straight back that wakes up the deep muscles at the front of your neck and eases a forward head posture.',
    muscles: {
      primary: ['Deep neck flexors'],
      secondary: ['Muscles at the base of the skull'],
    },
    equipment: 'Firm chair',
    setup: [
      'Sit tall on a firm chair with your feet flat on the floor.',
      'Let your shoulders relax down, away from your ears.',
      'If sitting is uncomfortable, lie on your back instead, with your head on a folded towel.',
    ],
    steps: [
      'Look straight ahead, with your eyes level.',
      'Glide your head straight back, as if closing a drawer, into a small double chin.',
      'Keep your chin level, with no nodding down and no tipping up.',
      'Hold gently for about five seconds as you breathe out.',
      'Slide your head forward again to rest as you breathe in.',
    ],
    dosage: { reps: 10, secondsPerRep: 10, sets: 1, sides: 'none' },
    breathing:
      'Breathe in slowly through your nose for about four seconds while you rest. Breathe out long and slow for about six seconds as you glide back and hold. Keep the breath soft, and never hold it.',
    feel: 'A light, gentle effort deep in the front of your neck, and perhaps a mild stretch at the base of your skull, about 3 out of 10.',
    shouldNotFeel:
      'Stop if you feel dizzy, get a headache, or notice any change in your vision. If you feel pain, tingling or numbness travelling down your arm, ease off at once. Stop at any sharp pain.',
    why: 'Chin tucks strengthen the small muscles that hold your head balanced over your shoulders. That improves your posture and takes strain off your neck and upper back.',
    mistakes: [
      {
        mistake: 'Nodding the chin down',
        risk: 'Your head does not glide back, and your neck takes the strain instead.',
        fix: 'Keep your eyes level and glide straight back, like closing a drawer.',
        clip: 'chin-tuck.chin-nods-down',
        pose: 'Upper cervical spine flexes about 20 to 30 degrees so the chin drops into a nod toward the chest, with no backward glide of the head; gaze drops toward the floor.',
      },
      {
        mistake: 'Tipping the head back',
        risk: 'Squeezes the small joints at the top of your neck.',
        fix: 'Keep your gaze on the horizon as you glide back.',
        clip: 'chin-tuck.head-tips-back',
        pose: 'Upper cervical spine extends about 10 to 15 degrees so the chin lifts and the gaze rises above the horizon; little or no backward glide of the head.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'No load on the lower back. If sitting is uncomfortable, use the lying version and press your head gently into a folded towel.',
    },
    cues: ['Eyes level', 'Slide back, like closing a drawer', 'Small double chin', 'Shoulders heavy, jaw soft'],
    youtube: {
      tutorial: 'chin tuck exercise physiotherapist',
      mistakes: 'chin tuck exercise common mistakes physiotherapist',
    },
    sources: [
      'https://www.hss.edu/health-library/move-better/seated-stretches',
      'https://health.clevelandclinic.org/posture-exercises',
      'https://www.nhsaaa.net/musculoskeletal-msk-service-patient-portal/neck-msk-patient-portal/neck-pain-exercises-msk-patient-portal/',
    ],
  },
  {
    id: 'upper-trap-stretch',
    name: 'Upper Trapezius Stretch',
    summary:
      'A slow, seated tilt of your head to the side that gently stretches the muscle running from your neck to the top of your shoulder.',
    muscles: {
      primary: ['Upper trapezius'],
      secondary: ['Side neck muscles'],
    },
    equipment: 'Firm chair',
    setup: [
      'Sit tall on a firm chair with your feet flat on the floor.',
      'Hold the edge of the seat with the hand on the side you are stretching.',
      'Let that shoulder sink down, heavy and relaxed.',
    ],
    steps: [
      'Keep your nose pointing straight ahead.',
      'Slowly tip your head away from the hand holding the seat, ear toward the other shoulder.',
      'Stop at the first gentle stretch along the side of your neck.',
      'If you like, rest your free hand on your head, for its weight only, never pulling.',
      'Hold and breathe, letting the shoulder on the seat side sink a little lower.',
      'Come back up slowly before you switch sides.',
    ],
    dosage: { holdSeconds: 30, sets: 2, sides: 'each' },
    breathing:
      'Breathe in slowly through your nose for about four seconds. Breathe out long and slow for about six seconds, letting your shoulder drop and the stretch deepen a little with each breath out. Keep breathing easily, and never hold your breath.',
    feel: 'A gentle stretch from the side of your neck to the top of your shoulder, about 3 to 4 out of 10.',
    shouldNotFeel:
      'If you feel tingling, numbness or burning travelling down your arm, ease off at once. Stop if you feel sharp pain or dizziness.',
    why: 'Desk work and screens can leave the tops of your shoulders tight. Gently stretching them eases neck tension and helps you sit and stand taller.',
    mistakes: [
      {
        mistake: 'Turning the head while tilting',
        risk: 'Shifts the load onto the small joints of your neck.',
        fix: 'Keep your nose pointing forward and take your ear straight toward your shoulder.',
        clip: 'upper-trap-stretch.head-rotates',
        pose: 'While side-bent, the neck also rotates about 20 to 30 degrees so the nose turns down toward the floor or up toward the ceiling.',
      },
      {
        mistake: 'Pulling the head down with the hand',
        risk: 'Can irritate the neck joints and the nerves that run into your arm.',
        fix: 'Let your hand rest for its weight only, and hold still with no bouncing.',
        clip: 'upper-trap-stretch.hand-pulls-head',
        pose: 'Free hand pulls the head into a full side-bend of about 45 degrees with small repeated bounces; neck muscles on the stretched side tense.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Seated, with no load on the lower back. If your arm tingles, ease off and use a smaller tilt with no hand on your head.',
    },
    cues: ['Shoulder heavy', 'Ear to shoulder, nose forward', 'Hand rests, never pulls', 'Breathe out and soften'],
    youtube: {
      tutorial: 'upper trapezius stretch physical therapist',
      mistakes: 'upper trapezius stretch mistakes physical therapist',
    },
    sources: [
      'https://www.hss.edu/health-library/move-better/stretches-before-bed',
      'https://health.clevelandclinic.org/posture-exercises',
      'https://www.nhs.uk/live-well/exercise/strength-and-flexibility-exercises/flexibility-exercises/',
    ],
  },
  {
    id: 'levator-scapulae-stretch',
    name: 'Levator Scapulae Stretch',
    summary:
      'A seated turn and nod of your head that stretches the muscle running from the side of your neck to the top of your shoulder blade.',
    muscles: {
      primary: ['Levator scapulae'],
      secondary: ['Muscles at the back of the neck'],
    },
    equipment: 'Firm chair',
    setup: [
      'Sit tall near the front of a firm chair with your feet flat.',
      'Reach the hand on the side you are stretching behind you, and hold the seat.',
      'Let that shoulder blade settle down.',
    ],
    steps: [
      'Turn your head about halfway, away from the hand holding the seat.',
      'Nod your nose down toward the opposite hip pocket.',
      'Rest your free hand on your head, for its weight only, never pulling.',
      'Stop at a gentle stretch from the back of your neck to your shoulder blade.',
      'Hold and breathe, letting the shoulder blade sink a little lower.',
      'Lift your head slowly and turn back to the centre.',
    ],
    dosage: { holdSeconds: 30, sets: 2, sides: 'each' },
    breathing:
      'Breathe in slowly through your nose for about four seconds. Breathe out long and slow for about six seconds, letting your shoulder blade sink and the stretch deepen a little with each breath out. Keep breathing easily, and never hold your breath.',
    feel: 'A gentle stretch from the back of your neck down to the top of your shoulder blade, about 3 to 4 out of 10.',
    shouldNotFeel:
      'If you feel tingling or pain travelling down your arm, ease off at once. Stop if you feel sharp pain, dizziness, a headache, or any change in your vision.',
    why: 'This muscle often tightens with stress and screen time, tugging on your neck and shoulder blade. Stretching it eases neck stiffness and lets your shoulders sit lower and freer.',
    mistakes: [
      {
        mistake: 'Turning the wrong way, or not turning at all',
        risk: 'The stretch moves to the top of your shoulder and misses this muscle.',
        fix: 'Turn about halfway away from the hand holding the seat, then nod.',
        clip: 'levator-scapulae-stretch.wrong-head-turn',
        pose: 'Head turns toward the stretched side, the same side as the anchoring hand, or stays facing forward, instead of rotating about 45 degrees away before the nod; the stretch shifts to the upper trapezius.',
      },
      {
        mistake: 'Cranking the head down with the hand',
        risk: 'Strains your neck and can irritate the nerves that run into your arm.',
        fix: 'Let your hand rest for its weight only.',
        clip: 'levator-scapulae-stretch.hand-cranks-head',
        pose: 'Free hand pulls the head 10 to 15 degrees further into flexion past the comfortable end of the stretch, with small repeated bounces.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Seated, with no load on the lower back. Use the weight of your hand only, never a pull; if it feels strong, nod less and leave the hand off.',
    },
    cues: ['Turn, then nod', 'Nose toward the opposite pocket', 'Hand rests, never pulls', 'Let the shoulder blade sink'],
    youtube: {
      tutorial: 'levator scapulae stretch physiotherapist',
      mistakes: 'levator scapulae stretch mistakes physiotherapist',
    },
    sources: [
      'https://www.hss.edu/health-library/move-better/seated-stretches',
      'https://www.physio-pedia.com/Levator_Scapulae',
      'https://pubmed.ncbi.nlm.nih.gov/28578252/',
    ],
  },
  {
    id: 'cat-cow',
    name: 'Cat-Cow',
    summary:
      'A slow, gentle rocking of your spine on hands and knees that eases stiffness by moving your back through its comfortable middle range.',
    muscles: {
      primary: ['Muscles along the spine'],
      secondary: ['Abdominals'],
    },
    equipment: 'Mat',
    setup: [
      'Come onto your hands and knees on a mat, with padding under your knees.',
      'Place your hands under your shoulders and your knees under your hips.',
      'Start with a long, neutral spine and your gaze down.',
    ],
    steps: [
      'Breathe out and slowly round your back up toward the ceiling, letting your head relax.',
      'Breathe in and let your chest and belly sink gently, with your gaze slightly forward.',
      'Stop well short of either end, so it always feels easy.',
      'Keep your neck long and your hips over your knees.',
      'Keep your elbows soft and push the floor gently away.',
      'Flow smoothly with your breath, about three seconds each way.',
    ],
    dosage: { reps: 6, secondsPerRep: 6, sets: 1, sides: 'none' },
    breathing:
      'Breathe out slowly as you round up, and breathe in softly through your nose as your chest sinks. Let each movement last about three seconds, one easy breath each way. Keep the breath flowing, and never hold it.',
    feel: 'Easy, comfortable movement through your whole back, with no strain, no more than about 3 out of 10.',
    shouldNotFeel:
      'Stop if pain spreads into your buttock or leg, if you feel tingling below the knee, or if you feel a sharp catch in your back. If one direction stirs your symptoms, make that half of the movement smaller.',
    why: 'Gentle, repeated movement helps a stiff back feel looser without straining it. It is a safe way to warm up your spine before strength work.',
    mistakes: [
      {
        mistake: 'Sagging deep with the head thrown back',
        risk: 'Squeezes the joints of your lower back and strains your neck.',
        fix: 'Arch only halfway, and keep your eyes on the floor just ahead.',
        clip: 'cat-cow.deep-sag-head-back',
        pose: 'In the cow phase the lumbar spine sags about 20 to 30 degrees past the intended mid-range arch, belly dropping toward the floor, and the neck extends about 30 degrees with the head thrown back.',
      },
      {
        mistake: 'Forcing the round to the very end',
        risk: 'Loads your discs at the end of their range, which can stir up sciatica.',
        fix: 'Keep your hips over your knees, and round only partway.',
        clip: 'cat-cow.forcing-end-range',
        pose: 'In the cat phase the whole spine is forced to full end-range flexion with the lumbar spine maximally rounded, the hips rock back 10 to 15 cm behind the knees, and the head tucks toward the chest.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'Move through half the range, favouring the direction that eases your symptoms. End-range rounding can irritate disc-type sciatica, and end-range arching can irritate stenosis-type symptoms. With osteoporosis, keep the rounding partial. If kneeling is uncomfortable, do it standing with your hands on a chair seat.',
    },
    cues: ['Breathe out, round up', 'Breathe in, chest softens', 'Stop before the end', 'Move with your breath'],
    youtube: {
      tutorial: 'cat camel exercise physiotherapist',
      mistakes: 'cat cow stretch mistakes physiotherapist',
    },
    sources: [
      'https://health.clevelandclinic.org/cat-cow-stretch',
      'https://www.nhsinform.scot/illnesses-and-conditions/muscle-bone-and-joints/neck-and-back-problems-and-conditions/exercises-for-back-pain/',
      'https://pubmed.ncbi.nlm.nih.gov/9672547/',
    ],
  },
  {
    id: 'thread-the-needle',
    name: 'Thread the Needle',
    summary:
      'A gentle twist on hands and knees that turns your upper back, easing stiffness between your shoulder blades while your lower back stays still.',
    muscles: {
      primary: ['Mid back muscles and joints'],
      secondary: ['Rear shoulder muscles'],
    },
    equipment: 'Mat',
    setup: [
      'Come onto your hands and knees on a mat, with padding under your knees.',
      'Place your hands under your shoulders and your knees under your hips.',
      'Let your spine be long and level.',
    ],
    steps: [
      'Breathe in and reach one arm up toward the ceiling, letting your eyes follow your hand.',
      'Breathe out and slide the back of that hand under your body, toward the other side.',
      'Let that shoulder and the side of your head lower gently toward the mat.',
      'Keep your hips still and square over your knees.',
      'Push the floor away with your supporting hand, elbow soft.',
      'Unwind slowly, then reach up again.',
    ],
    dosage: { reps: 6, secondsPerRep: 10, sets: 1, sides: 'each' },
    breathing:
      'Breathe in slowly through your nose for about four seconds as you reach up and open. Breathe out long and slow for about six seconds as you thread under, settling a little deeper each time. Never hold your breath.',
    feel: 'A gentle stretch and turning between your shoulder blades, and perhaps at the back of your shoulder, about 3 to 4 out of 10.',
    shouldNotFeel:
      'Stop if you feel pinching in your lower back, any symptoms in your leg, pain in your supporting shoulder, or pins and needles in your arm. Ease off at any sharp pain.',
    why: 'Your upper back is built to rotate, and keeping it mobile spares your lower back from twisting. It also makes turning and reaching feel easier.',
    mistakes: [
      {
        mistake: 'Hips shifting or twisting',
        risk: 'Your lower back twists instead of your upper back.',
        fix: 'Keep your hips square over your knees, and sit back slightly if that helps.',
        clip: 'thread-the-needle.hips-shift',
        pose: 'Pelvis shifts 5 to 10 cm sideways and rotates along with the threading arm, so the twist comes from the lumbar spine while the thoracic spine barely rotates.',
      },
      {
        mistake: 'Lower back sagging',
        risk: 'Loads your lower back in an arch.',
        fix: 'Brace lightly and keep your spine long.',
        clip: 'thread-the-needle.low-back-sags',
        pose: 'Lumbar spine sags into about 15 to 20 degrees of extra extension, belly dropping toward the mat, as the arm threads under.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'The rotation stays in your mid back. Keep your hips square over your knees; for an easier version, sit your hips back toward your heels.',
    },
    cues: ['Hips stay still', 'Eyes follow your hand', 'Thread under, breathe out', 'Push the floor away'],
    youtube: {
      tutorial: 'thread the needle stretch physiotherapist',
      mistakes: 'thread the needle stretch mistakes physiotherapist',
    },
    sources: [
      'https://www.southtees.nhs.uk/resources/threading-the-needle/',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC7173996/',
    ],
  },
  {
    id: 'open-book',
    name: 'Open Book',
    summary:
      'A side-lying twist where your top arm opens like the cover of a book, turning your upper back and stretching your chest.',
    muscles: {
      primary: ['Mid back muscles and joints', 'Chest muscles'],
      secondary: ['Front of the shoulder'],
    },
    equipment: 'Mat, pillow and cushion',
    setup: [
      'Lie on your side on a mat, with your head on a pillow.',
      'Bend your hips and knees to about ninety degrees, with a cushion between your stacked knees.',
      'Reach both arms straight out in front of you, palms together.',
    ],
    steps: [
      'Squeeze the cushion lightly between your knees.',
      'Breathe in and sweep your top arm up and over, like opening a book.',
      'Let your chest and head turn with it, eyes following your hand.',
      'Stop before your top knee starts to lift or slide back.',
      'Breathe out and let your shoulder settle, resting the arm on a pillow if you need to.',
      'Close the book slowly, bringing your arm back to meet the other.',
    ],
    dosage: { reps: 6, secondsPerRep: 10, sets: 1, sides: 'each' },
    breathing:
      'Breathe in slowly through your nose for about four seconds as you open. Breathe out long and slow for about six seconds as your shoulder settles a little further, then close the book. Never hold your breath.',
    feel: 'A gentle stretch across your chest and the front of your shoulder, with easy turning in your mid back, about 3 to 4 out of 10.',
    shouldNotFeel:
      'Stop if you feel pinching in your shoulder, pins and needles in your hand, or any symptoms in your back or leg. Ease off at any sharp pain.',
    why: 'Turning through your upper back keeps it supple and spares your lower back from twisting. Opening your chest also helps you stand taller.',
    mistakes: [
      {
        mistake: 'Top knee sliding back',
        risk: 'Your pelvis rolls and your lower back twists instead of your upper back.',
        fix: 'Squeeze the cushion and keep your knees stacked.',
        clip: 'open-book.knee-slides-back',
        pose: 'Top knee slides 5 to 15 cm back off the bottom knee and the pelvis rolls back about 20 to 30 degrees with the opening arm, twisting the lumbar spine.',
      },
      {
        mistake: 'Forcing the arm to the floor',
        risk: 'Strains the front of your shoulder.',
        fix: 'Stop where your chest stops turning.',
        clip: 'open-book.arm-forced-down',
        pose: 'Opening arm is pushed down to the floor so the shoulder sits 20 degrees or more behind the line of the chest after the thoracic rotation has stopped.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Stacked, bent knees limit twisting in your lower back, so keep your knees stacked on a cushion. For an easier version, open only until your arm points at the ceiling, with a pillow behind your back.',
    },
    cues: ['Knees glued together', 'Open the book', 'Chest turns, hips stay', 'Breathe out and settle'],
    youtube: {
      tutorial: 'open book stretch physiotherapist',
      mistakes: 'open book thoracic rotation mistakes physiotherapist',
    },
    sources: [
      'https://www.hss.edu/health-library/move-better/stretches-before-bed',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC7173996/',
    ],
  },
  {
    id: 'foam-roller-thoracic-extension',
    name: 'Foam Roller Thoracic Extension',
    summary:
      'A slow backward drape of your upper back over a foam roller that eases a stiff, rounded mid back and opens your chest.',
    muscles: {
      primary: ['Upper and mid back'],
      secondary: ['Chest wall'],
    },
    equipment: 'Foam roller and mat',
    setup: [
      'Sit on a mat with your knees bent and your feet flat.',
      'Place a medium foam roller across your back at the lower tips of your shoulder blades, never under your lower back.',
      'Lie back onto it, buttocks on the mat, hands behind your head and elbows in.',
    ],
    steps: [
      'Cradle your head in your hands, with your chin gently tucked.',
      'Breathe out and slowly drape your upper back over the roller.',
      'Stop as soon as your ribs start to lift.',
      'Breathe in and curl halfway back up.',
      'Keep your hips heavy on the mat the whole time.',
      'After a few, shift the roller a little higher and repeat.',
    ],
    dosage: { reps: 5, secondsPerRep: 6, sets: 2, sides: 'none' },
    breathing:
      'Breathe out long and slow as you drape back over the roller. Breathe in softly through your nose as you curl halfway up. Never hold your breath.',
    feel: 'A gentle opening across your mid back and chest, about 3 to 4 out of 10.',
    shouldNotFeel:
      'Stop if you feel sharp pain in your spine or ribs, pins and needles in your arms, dizziness, or pinching in your lower back.',
    why: 'Sitting tends to round the upper back. Gently extending it helps you stand taller and lets your arms reach overhead more freely.',
    mistakes: [
      {
        mistake: 'Roller under the lower back',
        risk: 'Bends your lower back too far backward.',
        fix: 'Keep the roller at shoulder blade level and your buttocks on the mat.',
        clip: 'foam-roller-thoracic-extension.roller-under-low-back',
        pose: 'Roller sits under the lumbar spine instead of the lower tips of the shoulder blades; the hips lift off the mat and the lumbar spine bends backward over the roller into hyperextension.',
      },
      {
        mistake: 'Head hanging back unsupported',
        risk: 'Strains your neck and can make you dizzy.',
        fix: 'Let your hands carry the weight of your head.',
        clip: 'foam-roller-thoracic-extension.head-hangs-back',
        pose: 'Hands come away from behind the head and the neck extends about 30 to 40 degrees, the head hanging back toward the floor.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Your hips stay down, so your lower back is not loaded. With osteoporosis or a past spinal fracture, use the seated version, hands behind your neck and elbows lifting, unless your clinician has cleared you.',
    },
    cues: ['Hips heavy', 'Hands hold your head', 'Breathe out, drape back', 'Ribs down'],
    youtube: {
      tutorial: 'foam roller thoracic extension physiotherapist',
      mistakes: 'foam roller thoracic extension mistakes physiotherapist',
    },
    sources: [
      'https://www.hss.edu/health-library/move-better/foam-roller-exercises',
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC7173996/',
      'https://pubmed.ncbi.nlm.nih.gov/35577538/',
    ],
  },
  {
    id: 'doorway-pec-stretch',
    name: 'Doorway Pec Stretch',
    summary:
      'A gentle forward lean in a doorway that stretches the muscles across the front of your chest and shoulders.',
    muscles: {
      primary: ['Chest muscles'],
      secondary: ['Front of the shoulders'],
    },
    equipment: 'Doorway',
    setup: [
      'Stand in a doorway with one foot a small step forward.',
      'Rest your forearms on the door frame, elbows bent to about ninety degrees.',
      'Keep your elbows at or just below shoulder height.',
    ],
    steps: [
      'Draw your ribs gently down and lengthen the back of your neck.',
      'Lean your whole body forward from the ankles, just a little.',
      'Stop when you feel an even stretch across your chest.',
      'Keep your shoulders low and your ears over your shoulders.',
      'Hold and breathe, letting your chest open a little more.',
      'Step back out of the stretch slowly.',
    ],
    dosage: { holdSeconds: 30, sets: 2, sides: 'none' },
    breathing:
      'Breathe in slowly through your nose for about four seconds. Breathe out long and slow for about six seconds, letting your chest open a little more with each breath out. Keep breathing easily, and never hold your breath.',
    feel: 'An even, gentle stretch across your chest and the front of your shoulders, about 3 to 4 out of 10.',
    shouldNotFeel:
      'Stop if you feel a pinch at the front of your shoulder, or tingling travelling down your arm into your hand. Ease off at any sharp pain or dizziness.',
    why: 'Sitting and pressing tighten the chest and pull the shoulders forward. Opening it up helps your posture and lets your shoulders move more freely.',
    mistakes: [
      {
        mistake: 'Hips drifting through with an arched back',
        risk: 'Loads your lower back and loses the chest stretch.',
        fix: "Keep your ribs down and lean only a little, about a hand's width.",
        clip: 'doorway-pec-stretch.low-back-arches',
        pose: 'Hips drift forward through the doorway ahead of the shoulders; the lumbar spine arches about 15 to 20 degrees and the ribs flare.',
      },
      {
        mistake: 'Elbows too high with a hard lean',
        risk: 'Strains the front of your shoulder and can make your arm tingle.',
        fix: 'Keep your elbows at or below shoulder height.',
        clip: 'doorway-pec-stretch.elbows-too-high',
        pose: 'Shoulders abduct to about 110 to 120 degrees so the elbows rest above shoulder height on the frame, combined with a deep forward lean.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'The spine stays neutral. Keep your ribs down and your elbows no higher than your shoulders, and keep the back knee soft if your leg is irritable. For an easier version, stretch one arm at a time with a smaller lean.',
    },
    cues: ['Elbows at shoulder height', 'Ribs down', 'Lean from the ankles', 'Breathe out, let the chest open'],
    youtube: {
      tutorial: 'doorway pec stretch physical therapist',
      mistakes: 'doorway pec stretch mistakes physical therapist',
    },
    sources: [
      'https://health.clevelandclinic.org/posture-exercises',
      'https://pubmed.ncbi.nlm.nih.gov/16679233/',
    ],
  },
  {
    id: 'cross-body-shoulder-stretch',
    name: 'Cross-Body Shoulder Stretch',
    summary: 'A gentle draw of one arm across your chest that stretches the back of your shoulder.',
    muscles: {
      primary: ['Rear shoulder muscle'],
      secondary: ['Rotator cuff', 'Back of the shoulder joint'],
    },
    equipment: 'None',
    setup: [
      'Stand tall, or sit tall on a chair if standing bothers your back.',
      'Let your shoulders relax down, away from your ears.',
    ],
    steps: [
      'Lift one arm to just below shoulder height.',
      'Hold it just above the elbow with your other hand.',
      'Draw the arm gently across your chest.',
      'Keep your chest facing forward and your shoulder low.',
      'Hold and breathe, easing the arm a little further on each breath out.',
    ],
    dosage: { holdSeconds: 30, sets: 2, sides: 'each' },
    breathing:
      'Breathe in slowly through your nose for about four seconds. Breathe out long and slow for about six seconds, easing your arm a little further across with each breath out. Keep breathing easily, and never hold your breath.',
    feel: 'A gentle stretch across the back of your shoulder, about 3 to 4 out of 10.',
    shouldNotFeel:
      'Stop if you feel a pinch at the top or front of your shoulder, or tingling travelling down your arm into your hand. Ease off at any sharp pain. If your shoulder is stiff and painful in every direction, have it checked rather than forcing it.',
    why: 'A tight back of the shoulder can pinch the joint when you reach or press. Keeping it supple protects your shoulder and helps it move smoothly.',
    mistakes: [
      {
        mistake: 'Pulling on the forearm with a straight elbow',
        risk: 'Strains your elbow.',
        fix: 'Hold just above the elbow instead.',
        clip: 'cross-body-shoulder-stretch.pulling-forearm',
        pose: 'Opposite hand grips the forearm near the wrist and pulls the arm across the chest through a fully straight elbow, levering on the elbow joint.',
      },
      {
        mistake: 'Shoulder hiking with the arm too high',
        risk: 'Can pinch the front of your shoulder.',
        fix: 'Keep the arm at or below shoulder height and your shoulder low.',
        clip: 'cross-body-shoulder-stretch.shoulder-hikes',
        pose: 'Stretched shoulder elevates 2 to 3 cm toward the ear and the arm rises above about 100 degrees of flexion as it is pulled across.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'No load on the spine; sit if standing aggravates your back. Hold above the elbow, and keep the arm lower if your shoulder pinches. Diabetes raises the risk of frozen shoulder, so a shoulder that is stiff and painful in every direction should be assessed rather than forced.',
    },
    cues: ['Hold above the elbow', 'Shoulder away from your ear', 'Chest stays square', 'Breathe out, ease across'],
    youtube: {
      tutorial: 'cross body shoulder stretch physiotherapy',
      mistakes: 'cross body shoulder stretch mistakes physiotherapy',
    },
    sources: [
      'https://www.orthoinfo.org/recovery/rotator-cuff-and-shoulder-conditioning-program/',
      'https://pubmed.ncbi.nlm.nih.gov/17416125/',
      'https://www.nhs.uk/conditions/frozen-shoulder/',
    ],
  },
  {
    id: 'kneeling-lat-stretch',
    name: 'Kneeling Lat Stretch',
    summary:
      'A kneeling stretch with your hands on a bench that lengthens the wide muscles running from your armpits down the sides of your back.',
    muscles: {
      primary: ['Lats'],
      secondary: ['Muscles behind the armpit', 'Triceps'],
    },
    equipment: 'Mat and a bench or chair',
    setup: [
      'Kneel on a padded mat facing a bench or chair seat.',
      'Place your knees hip width apart, under your hips.',
      'Hinge forward and rest your hands on the bench, arms straight.',
    ],
    steps: [
      'Brace gently so your back stays long.',
      'Breathe out and slowly sit your hips back.',
      'Sink until you feel a stretch in your armpits.',
      'Stop before your lower back starts to round.',
      'Keep your ears between your arms.',
      'Hold and breathe, then come up slowly.',
    ],
    dosage: { holdSeconds: 30, sets: 2, sides: 'none' },
    breathing:
      'Breathe in slowly through your nose for about four seconds. Breathe out long and slow for about six seconds, letting your armpits sink a little lower with each breath out. Keep breathing easily, and never hold your breath.',
    feel: 'A gentle stretch from your armpits down the sides of your back, about 3 to 4 out of 10.',
    shouldNotFeel:
      'Stop if you feel pain in your lower back, any symptoms travelling down your leg, a pinch in your shoulder, or dizziness when you come up.',
    why: 'Tight lats pull your shoulders forward and arch your lower back when you reach overhead. Stretching them helps your posture and frees your arms to move overhead.',
    mistakes: [
      {
        mistake: 'Pelvis tucking and lower back rounding',
        risk: 'Can irritate the discs and nerves of your lower back.',
        fix: 'Stop earlier and keep the natural curve in your lower back.',
        clip: 'kneeling-lat-stretch.pelvis-tucks',
        pose: 'Hips sit back too far so the pelvis tucks under and the lumbar spine rounds about 20 to 30 degrees into flexion.',
      },
      {
        mistake: 'Chest sagging into an arch',
        risk: 'Can pinch your lower back and shoulders.',
        fix: 'Brace gently and draw your ribs down.',
        clip: 'kneeling-lat-stretch.chest-sags',
        pose: 'Chest drops toward the floor below the line of the arms; the lumbar spine arches about 15 to 20 degrees into extension and the ribs flare.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'The sit-back can end with your lower back rounding, so stop as soon as your pelvis starts to tuck. The standing lat stretch, hinging with your hands on a counter, is the gentler swap.',
      regression: 'standing-rack-lat-stretch',
    },
    cues: ['Hips back, back long', 'Stop before your back rounds', 'Breathe out, let the armpits sink', 'Ears between your arms'],
    youtube: {
      tutorial: 'kneeling lat stretch bench physical therapist',
      mistakes: 'kneeling lat stretch mistakes physical therapist',
    },
    sources: [
      'https://www.acefitness.org/resources/everyone/exercise-library/141/kneeling-lat-stretch-w-bench/',
      'https://www.acefitness.org/resources/everyone/exercise-library/198/90-lat-stretch/',
    ],
  },
  {
    id: 'overhead-triceps-stretch',
    name: 'Overhead Triceps Stretch',
    summary:
      'An overhead reach with your elbow bent that stretches the back of your upper arm and the side of your back.',
    muscles: {
      primary: ['Triceps'],
      secondary: ['Lats', 'Muscles behind the armpit'],
    },
    equipment: 'None, or a towel',
    setup: [
      'Stand tall, or sit tall on a chair if standing bothers your back.',
      'Roll your shoulders gently down and back.',
    ],
    steps: [
      'Reach one arm up, keeping that shoulder away from your ear.',
      'Bend the elbow and let your hand drop toward your upper back.',
      'With your other hand, press lightly just above the elbow.',
      'Keep your ribs down and your head tall.',
      'Hold and breathe, letting the arm sink a little further.',
    ],
    dosage: { holdSeconds: 30, sets: 2, sides: 'each' },
    breathing:
      'Breathe in slowly through your nose for about four seconds. Breathe out long and slow for about six seconds, letting your arm sink a little further with each breath out. Keep breathing easily, and never hold your breath.',
    feel: 'A gentle stretch along the back of your upper arm, perhaps reaching down the side of your back, about 3 to 4 out of 10.',
    shouldNotFeel:
      'Stop if you feel a pinch on top of your shoulder, pain in your elbow, or tingling travelling into your ring and little fingers. Ease off at any sharp pain.',
    why: 'Supple arms and lats let you reach overhead without arching your lower back. This stretch also eases your arms after pressing work.',
    mistakes: [
      {
        mistake: 'Ribs flaring with an arched back',
        risk: 'Compresses your lower back.',
        fix: 'Brace gently and draw your ribs down.',
        clip: 'overhead-triceps-stretch.ribs-flare',
        pose: 'Rib cage flares forward and the lumbar spine arches about 10 to 15 degrees into extension as the arm goes overhead.',
      },
      {
        mistake: 'Forcing the elbow behind the head',
        risk: 'Can pinch the top of your shoulder.',
        fix: 'Use light pressure, or hold a towel instead.',
        clip: 'overhead-triceps-stretch.elbow-forced-back',
        pose: 'Opposite hand pulls hard so the elbow is driven behind the head and the shoulder flexes past about 180 degrees.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Sit if standing aggravates your back, and keep your ribs down so your back does not arch. Use the towel version if your shoulder feels tight: the top hand holds a towel and the lower hand eases it down behind your back.',
    },
    cues: ['Shoulder away from your ear', 'Ribs down', 'Head tall', 'Breathe out, let the arm sink'],
    youtube: {
      tutorial: 'overhead triceps stretch physical therapist',
      mistakes: 'overhead triceps stretch mistakes physical therapist',
    },
    sources: ['https://www.acefitness.org/resources/everyone/exercise-library/174/overhead-triceps-stretch/'],
  },
  {
    id: 'wrist-flexor-extensor-stretch',
    name: 'Wrist Flexor and Extensor Stretch',
    summary:
      'A gentle stretch of your forearm muscles in both directions that keeps your wrists and hands supple.',
    muscles: {
      primary: ['Wrist flexors', 'Wrist extensors'],
      secondary: ['Finger flexors'],
    },
    equipment: 'None',
    setup: [
      'Stand or sit tall, with your shoulders soft.',
      'Reach one arm straight out in front of you, at or below shoulder height.',
    ],
    steps: [
      'Turn your palm up and keep your elbow straight.',
      'With your other hand, ease your palm and fingers back toward the floor, and hold.',
      'For the second hold, turn your palm down and let your hand relax.',
      'Gently bend your wrist so your fingers point down, and hold.',
      'Press on your palm or the back of your hand, never just your fingertips.',
    ],
    dosage: { holdSeconds: 20, sets: 2, sides: 'each' },
    breathing:
      'Breathe in slowly through your nose for about four seconds. Breathe out long and slow for about six seconds, keeping your shoulders soft and letting your forearm lengthen a little more with each breath out. Keep breathing easily, and never hold your breath.',
    feel: 'A gentle pull along your forearm, on the palm side for the first hold and along the back of the arm for the second, about 3 to 4 out of 10.',
    shouldNotFeel:
      'If your fingers tingle or go numb, bend your elbow slightly and ease off. Stop if you feel sharp pain in your wrist or elbow. If the feeling in your hands is reduced, move slowly and keep the stretch light.',
    why: 'Gripping, typing and lifting all tighten the forearms. Keeping them supple protects your wrists and elbows, and daily gentle stretching helps when diabetes makes the hands stiff.',
    mistakes: [
      {
        mistake: 'Bending the elbow',
        risk: 'Your forearm goes slack and the stretch is lost.',
        fix: 'Straighten your elbow, unless your fingers tingle.',
        clip: 'wrist-flexor-extensor-stretch.elbow-bent',
        pose: 'Elbow of the stretched arm bends about 30 to 45 degrees while the wrist is eased back, slackening the forearm muscles.',
      },
      {
        mistake: 'Yanking the wrist too far',
        risk: 'Can strain the tendons of your wrist.',
        fix: 'Move slowly, and keep the tension mild.',
        clip: 'wrist-flexor-extensor-stretch.wrist-yanked',
        pose: 'Other hand yanks the wrist past about 80 degrees of extension with quick, bouncing pulls.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'No load on the spine. If your fingers tingle, bend your elbow slightly; for an easier version, rest your forearm on a table with the elbow slightly bent.',
    },
    cues: ['Elbow straight, shoulder soft', 'Gentle pressure on the palm', 'Breathe out, let the forearm lengthen'],
    youtube: {
      tutorial: 'wrist flexor extensor stretch physiotherapist',
      mistakes: 'wrist stretch mistakes physiotherapist',
    },
    sources: [
      'https://health.clevelandclinic.org/tennis-elbow-exercises',
      'https://pubmed.ncbi.nlm.nih.gov/26265997/',
    ],
  },
  {
    id: 'scapular-wall-slide',
    name: 'Scapular Wall Slide',
    summary:
      'A slow slide of your arms up and down a wall that trains the muscles that control your shoulder blades.',
    muscles: {
      primary: ['Serratus anterior', 'Lower trapezius'],
      secondary: ['Middle trapezius'],
    },
    equipment: 'Wall',
    setup: [
      'Stand with your back to a wall, feet a short step out and knees soft.',
      'Rest your head, upper back and pelvis against the wall.',
      'Draw your ribs gently down.',
    ],
    steps: [
      'Raise your arms into a goalpost shape, elbows bent to about ninety degrees.',
      'Set your shoulder blades gently back and down.',
      'Breathe out and slide your arms slowly up the wall.',
      'Go only as far as your lower back and shoulders stay quiet.',
      'Breathe in and slide down, drawing your elbows toward your sides.',
    ],
    dosage: { reps: 8, secondsPerRep: 6, sets: 2, sides: 'none' },
    breathing:
      'Breathe out slowly as you slide up, for about three seconds. Breathe in softly through your nose as you slide down, for about three seconds. Never hold your breath.',
    feel: 'Gentle, steady work around your shoulder blades, an easy effort of about 3 to 4 out of 10.',
    shouldNotFeel:
      'Stop the slide below any pinch in your shoulder. Stop if your hands tingle or your lower back hurts, and ease off at any sharp pain.',
    why: 'Well-controlled shoulder blades keep your shoulders healthy when you reach and press. This drill also helps you stand taller.',
    mistakes: [
      {
        mistake: 'Lower back arching off the wall',
        risk: 'Compresses your lower back.',
        fix: 'Draw your ribs down, and stop the slide at that point.',
        clip: 'scapular-wall-slide.low-back-arches',
        pose: 'Lumbar spine arches about 15 to 20 degrees away from the wall and the ribs flare as the arms slide up.',
      },
      {
        mistake: 'Shoulders shrugging at the top',
        risk: 'Your upper shoulders take over and can pinch the joint.',
        fix: 'Slide only as high as your shoulders stay down.',
        clip: 'scapular-wall-slide.shoulders-shrug',
        pose: 'Both shoulders elevate 2 to 3 cm toward the ears at the top of the slide.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'The wall supports your spine. For stiff or painful shoulders, face the wall with your forearms on it, thumbs pointing away, and slide up from there.',
    },
    cues: ['Ribs down, back on the wall', 'Slide up slowly', 'Elbows down toward your pockets'],
    youtube: {
      tutorial: 'scapular wall slide physical therapy',
      mistakes: 'scapular wall slide mistakes physical therapy',
    },
    sources: [
      'https://www.nhsinform.scot/illnesses-and-conditions/muscle-bone-and-joints/arm-shoulder-and-hand-problems-and-conditions/exercises-for-shoulder-problems/',
      'https://pubmed.ncbi.nlm.nih.gov/17193867/',
      'https://health.clevelandclinic.org/posture-exercises',
    ],
  },
  {
    id: 'band-pull-apart',
    name: 'Band Pull-Apart',
    summary:
      'A light resistance band pulled apart in front of your chest that strengthens the muscles between your shoulder blades.',
    muscles: {
      primary: ['Middle and lower trapezius', 'Rhomboids'],
      secondary: ['Rear shoulder muscle', 'Rotator cuff'],
    },
    equipment: 'Light resistance band',
    setup: [
      'Stand tall with your knees soft.',
      'Hold a light band in front of you at shoulder height, hands shoulder width apart.',
      'Keep your arms long, with a soft bend in your elbows.',
    ],
    steps: [
      'Brace lightly and draw your ribs down.',
      'Breathe out and sweep your arms out wide until the band nears your chest.',
      'Let your shoulder blades draw back and down.',
      'Breathe in and return slowly, keeping a little tension on the band.',
      'Keep your grip relaxed and your neck long.',
    ],
    dosage: { reps: 12, secondsPerRep: 4, sets: 2, sides: 'none' },
    breathing:
      'Breathe out as you pull the band apart. Breathe in softly through your nose as you return slowly. Keep your grip relaxed, and never hold your breath.',
    feel: 'Gentle work between your shoulder blades and at the back of your shoulders, an easy to moderate effort of about 3 to 5 out of 10.',
    shouldNotFeel:
      'Stop if you feel pain at the front of your shoulder, strain in your neck, or tingling in your hands. Ease off at any sharp pain.',
    why: 'Strengthening your upper back balances all the sitting and pushing you do. It helps your posture and protects your shoulders.',
    mistakes: [
      {
        mistake: 'Ribs flaring with an arched back',
        risk: 'Compresses your lower back.',
        fix: 'Brace gently and keep your ribs down.',
        clip: 'band-pull-apart.ribs-flare',
        pose: 'Rib cage flares and the lumbar spine arches about 10 to 15 degrees into extension as the band is pulled apart.',
      },
      {
        mistake: 'Shoulders shrugging',
        risk: 'Your upper shoulders take over, and the target muscles miss out.',
        fix: 'Keep your shoulders down and your neck long.',
        clip: 'band-pull-apart.shoulders-shrug',
        pose: 'Both shoulders elevate 2 to 3 cm toward the ears during the pull.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Standing with a neutral spine and a light load. Use a light band and breathe out on the pull; for an easier version, use a lighter band, a shorter range, or sit down.',
    },
    cues: ['Long arms, soft elbows', 'Pull apart and breathe out', 'Slow on the way in', 'Shoulders down, neck long'],
    youtube: {
      tutorial: 'band pull apart physical therapist form',
      mistakes: 'band pull apart mistakes physical therapist',
    },
    sources: [
      'https://pmc.ncbi.nlm.nih.gov/articles/PMC8975561/',
      'https://pubmed.ncbi.nlm.nih.gov/17606671/',
      'https://www.orthoinfo.org/recovery/rotator-cuff-and-shoulder-conditioning-program/',
    ],
  },
  {
    id: 'standing-side-bend',
    name: 'Standing Side Bend',
    summary:
      'A slow, small bend to the side that gently stretches the muscles along the side of your waist and lower back.',
    muscles: {
      primary: ['Quadratus lumborum', 'Obliques'],
      secondary: ['Lats'],
    },
    equipment: 'None, with a chair nearby for balance',
    setup: [
      'Stand tall with your feet hip width apart and your knees soft.',
      'Have a wall or chair within reach for balance.',
      'Let your weight settle evenly on both feet.',
    ],
    steps: [
      'Breathe out and slide one hand slowly down the side of your thigh.',
      'Bend straight sideways, as if between two panes of glass.',
      'Keep your hips level and your chest facing forward.',
      'Go only a small way, and skip any side that stirs your symptoms.',
      'Pause for a moment, then breathe in and rise back to tall.',
    ],
    dosage: { reps: 6, secondsPerRep: 10, sets: 1, sides: 'each' },
    breathing:
      'Breathe out slowly for about six seconds as you slide down and pause. Breathe in through your nose for about four seconds as you rise back to tall. Never hold your breath.',
    feel: 'A mild stretch along the opposite side of your waist, about 3 to 4 out of 10.',
    shouldNotFeel:
      'Stop if pain or tingling travels into your buttock or down your leg. Ease off at any sharp pain. If your body is visibly shifted to one side today, skip this drill.',
    why: 'Gentle side bending keeps the muscles along your waist supple, so everyday reaching and bending feel easier.',
    mistakes: [
      {
        mistake: 'Leaning forward as you bend',
        risk: 'Adds forward bending to the side bend, a mix that irritated discs tolerate least.',
        fix: 'Keep your shoulders stacked over your hips.',
        clip: 'standing-side-bend.trunk-drifts-forward',
        pose: 'Trunk flexes forward about 15 to 20 degrees while side-bending, so the shoulders move in front of the hips.',
      },
      {
        mistake: 'Hips sliding out to the side',
        risk: 'Loses the stretch and overloads one spot in your lower back.',
        fix: 'Keep your pelvis level and still.',
        clip: 'standing-side-bend.hips-slide-out',
        pose: 'Pelvis shifts 5 to 10 cm sideways, away from the direction of the bend, as the trunk side-bends.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'Side bending can pinch or stretch an irritated nerve root, so keep the range small and use your comfortable side only. Skip it if your trunk is visibly shifted to one side; for an easier version, do a small seated side bend.',
    },
    cues: ["Slide, don't lean", 'Hips still', 'Chest faces forward', 'Breathe out, lengthen'],
    youtube: {
      tutorial: 'standing side bend stretch lower back physiotherapist',
      mistakes: 'standing side bend stretch mistakes physiotherapist',
    },
    sources: [
      'https://health.clevelandclinic.org/exercises-and-stretches-for-low-back-pain',
      'https://www.nhs.uk/live-well/exercise/flexibility-exercises/',
      'https://www.nhsfife.org/media/rygh3dou/back-exercises-english-1.pdf',
    ],
  },
  {
    id: 'supine-twist',
    name: 'Supine Twist',
    summary:
      'A lying twist where you roll your bent knees slowly from side to side, gently loosening your lower back and hips.',
    muscles: {
      primary: ['Obliques', 'Lower back muscles'],
      secondary: ['Lower back fascia'],
    },
    equipment: 'Mat and a small pillow',
    setup: [
      'Lie on your back on a mat, with a small pillow under your head.',
      'Bend your knees, with your knees and feet together.',
      'Rest your arms out wide, shoulders heavy.',
    ],
    steps: [
      'Breathe out and slowly lower both knees to one side, only as far as is easy.',
      'Keep both shoulder blades resting on the floor.',
      'Pause there for a moment.',
      'Breathe in and bring your knees back to the middle.',
      'Then roll slowly to the other side in the same way.',
    ],
    dosage: { reps: 16, secondsPerRep: 10, sets: 1, sides: 'none' },
    breathing:
      'Breathe out slowly for about six seconds as your knees lower and pause. Breathe in through your nose for about four seconds as they return to the middle. Never hold your breath.',
    feel: 'A light, gentle stretch across the opposite side of your back and hip, about 3 to 4 out of 10.',
    shouldNotFeel:
      'Stop if symptoms spread down your leg, or if you feel a sharp catch in your back. Make the rolls smaller if either side feels uncomfortable.',
    why: 'Gentle rotation eases stiffness in your lower back and hips without loading them. It is a soothing way to keep your back moving.',
    mistakes: [
      {
        mistake: 'Opposite shoulder lifting',
        risk: 'Forces your lower back to the very end of its twist.',
        fix: 'Keep your shoulders heavy, and make the roll smaller.',
        clip: 'supine-twist.shoulder-lifts',
        pose: 'Shoulder opposite the lowering knees lifts 5 cm or more off the mat, forcing end-range lumbar rotation.',
      },
      {
        mistake: 'Knees flopping fast to the floor',
        risk: 'The sudden end-range twist can flare joint or nerve pain.',
        fix: 'Lower slowly, and stop about halfway to the floor.',
        clip: 'supine-twist.knees-flop',
        pose: 'Knees drop quickly all the way to the floor so the pelvis rotates about 70 to 90 degrees; correct form stops near 45 degrees.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'Small knee rolls only, which are usually well tolerated. Skip the deep crossed-knee twist while your back or leg is irritable; for an easier version, roll only a short way with a pillow between your knees.',
    },
    cues: ['Knees together, slow and smooth', 'Shoulders heavy', 'Only as far as is easy', 'Breathe out as they lower'],
    youtube: {
      tutorial: 'knee rolls lower back exercise physiotherapy',
      mistakes: 'knee rolls lower back exercise mistakes physiotherapy',
    },
    sources: [
      'https://www.nhsinform.scot/illnesses-and-conditions/muscle-bone-and-joints/neck-and-back-problems-and-conditions/exercises-for-back-pain/',
      'https://www.wwl.nhs.uk/media/.leaflets/6214e7c8e2e1f0.63708939.pdf',
      'https://www.nhsfife.org/media/rygh3dou/back-exercises-english-1.pdf',
    ],
  },
  {
    id: 'childs-pose',
    name: "Child's Pose",
    summary:
      'A resting stretch where you sit your hips back toward your heels and lower your chest, gently lengthening your lower and mid back.',
    muscles: {
      primary: ['Lower back muscles'],
      secondary: ['Lats', 'Lower back fascia'],
    },
    equipment: 'Mat, towel and cushion',
    setup: [
      'Kneel on a mat with a folded towel under your knees.',
      'Place a cushion in front of you to rest your forehead on.',
      'Keep a chair nearby to help you rise.',
    ],
    steps: [
      'Come onto all fours, with your knees wide and your big toes touching.',
      'Breathe out and sit your hips back toward your heels, only as far as is easy.',
      'Let your chest settle, with your arms reaching forward and your elbows soft.',
      'Rest your forehead on the cushion so your head is supported.',
      'Hold and breathe into your back ribs.',
      'To come up, walk your hands back and rise slowly.',
    ],
    dosage: { holdSeconds: 30, sets: 2, sides: 'none' },
    breathing:
      'Breathe in slowly through your nose for about four seconds, into your back ribs. Breathe out long and slow for about six seconds, and let your hips sink a little closer to your heels. Keep breathing easily, and never hold your breath.',
    feel: 'A broad, gentle stretch through your lower and mid back, about 3 to 4 out of 10.',
    shouldNotFeel:
      'Stop if symptoms spread down your leg, your knees hurt, or you feel light-headed. If you have high blood pressure or take blood pressure medicine, keep your forehead well supported and rise slowly. Skip this head-down position if you have severe or unstable diabetic eye disease.',
    why: 'This pose gently lengthens your back and helps you slow down and breathe. For many backs it is a calming way to ease stiffness.',
    mistakes: [
      {
        mistake: 'Head hanging low with the chin tucked',
        risk: 'Strains your neck and can make you dizzy when you rise.',
        fix: 'Rest your forehead on a cushion, close to the level of your heart.',
        clip: 'childs-pose.head-hanging',
        pose: 'Head hangs unsupported below the level of the hips with the chin tucked and the neck flexed about 45 degrees.',
      },
      {
        mistake: 'Forcing the hips onto the heels',
        risk: 'Squeezes your knees and loads your lower back at the end of its range.',
        fix: 'Widen your knees and place a cushion behind them.',
        clip: 'childs-pose.hips-forced-to-heels',
        pose: 'Knees together and bent about 150 degrees with the hips forced right down onto the heels and the lumbar spine at end-range flexion.',
      },
    ],
    backSafety: {
      status: 'avoidWhenIrritable',
      note: 'Sustained end-range bending often aggravates disc-type sciatica, so leave this out on irritable days. Use a pillow under your chest and hips, or swap to a flat-back hip hinge with your hands on a chair seat. Backs that dislike arching, such as those with stenosis, often find it easing.',
    },
    cues: ['Hips back, only as far as is easy', 'Forehead resting, neck long', 'Breathe into your back ribs', 'Come up slowly'],
    youtube: {
      tutorial: "child's pose modifications low back pain physical therapist",
      mistakes: "child's pose mistakes physical therapist",
    },
    sources: [
      'https://health.clevelandclinic.org/childs-pose',
      'https://www.guysandstthomas.nhs.uk/health-information/low-back-pain/physiotherapy-and-exercises',
      'https://www.nhsinform.scot/illnesses-and-conditions/muscle-bone-and-joints/neck-and-back-problems-and-conditions/spinal-stenosis',
    ],
  },
  {
    id: 'pelvic-tilt',
    name: 'Pelvic Tilt',
    summary:
      'A small, slow rocking of your pelvis while lying on your back that teaches gentle control of your lower back.',
    muscles: {
      primary: ['Abdominals'],
      secondary: ['Lower back muscles'],
    },
    equipment: 'Mat and a small pillow',
    setup: [
      'Lie on your back on a mat or firm bed, with a small pillow under your head.',
      'Bend your knees and place your feet flat.',
      'Rest your hands on your hip bones.',
    ],
    steps: [
      'Breathe out and gently roll your pelvis back, flattening your lower back toward the floor.',
      'Pause there for a moment.',
      'Breathe in and roll the other way into a small arch.',
      'Keep your chest, shoulders and feet relaxed, and your tailbone down.',
      'Keep it small and slow, and finish halfway, in your neutral spine.',
    ],
    dosage: { reps: 10, secondsPerRep: 10, sets: 1, sides: 'none' },
    breathing:
      'Breathe out slowly for about six seconds as you flatten your back. Breathe in through your nose for about four seconds as you roll into a small arch. Keep your stomach soft, and never hold your breath.',
    feel: 'Easy movement in your lower back and light work low in your stomach, no more than about 3 out of 10.',
    shouldNotFeel:
      'If either direction sends symptoms into your leg, use only the comfortable half of the movement. Stop if you feel sharp pain, or if symptoms spread down your leg.',
    why: 'Learning to move your pelvis gently helps you find and hold a comfortable neutral spine. That control protects your back when you lift.',
    mistakes: [
      {
        mistake: 'Lifting into a bridge',
        risk: 'It becomes a hip lift, and you lose the gentle control.',
        fix: "Keep your tailbone down. Tilt, don't lift.",
        clip: 'pelvic-tilt.lifts-into-bridge',
        pose: 'Pelvis lifts so the sacrum rises more than 3 cm off the mat, turning the tilt into a small bridge.',
      },
      {
        mistake: 'Arching too far',
        risk: 'Can irritate backs that dislike arching.',
        fix: 'Keep the arch small and your ribs soft.',
        clip: 'pelvic-tilt.big-arch',
        pose: 'On the forward tilt the lumbar spine arches about 20 degrees into extension and the ribs flare up.',
      },
    ],
    backSafety: {
      status: 'ok',
      note: 'Small range and no load. Use only the comfortable half of the range; for an easier version, put a pillow under your knees and make the movement smaller.',
    },
    cues: ['Gently flatten, then gently arch', 'Small and slow', 'Breathe out as you flatten', 'Jaw and shoulders soft'],
    youtube: {
      tutorial: 'pelvic tilt exercise lying physiotherapist',
      mistakes: 'pelvic tilt exercise mistakes physiotherapist',
    },
    sources: [
      'https://www.southtees.nhs.uk/resources/pelvic-tilt/',
      'https://www.csp.org.uk/conditions/back-pain/video-exercises-back-pain',
      'https://www.royalwolverhampton.nhs.uk/wp-content/uploads/2026/04/Sciatica_V_1.pdf',
    ],
  },
  {
    id: 'knee-to-chest',
    name: 'Knee-to-Chest Stretch',
    summary:
      'A lying stretch where you hug one knee gently toward your chest to ease your lower back and buttock.',
    muscles: {
      primary: ['Lower back muscles', 'Glutes'],
      secondary: ['Lower back fascia'],
    },
    equipment: 'Mat and a thin pillow',
    setup: [
      'Lie on your back on a mat or firm bed, with a thin pillow under your head.',
      'Bend both knees and place your feet flat.',
    ],
    steps: [
      'Bring one knee slowly toward your chest.',
      'Hold behind your thigh, not your shin.',
      'Breathe out and draw the knee in gently, just to a mild stretch.',
      'Keep your other foot flat and your head resting down.',
      'Hold and breathe, letting your lower back soften.',
      'Release slowly, lowering your foot back to the floor.',
    ],
    dosage: { holdSeconds: 30, sets: 2, sides: 'each' },
    breathing:
      'Breathe in slowly through your nose for about four seconds. Breathe out long and slow for about six seconds, letting the knee drift a little closer without pulling. Never hold your breath or strain.',
    feel: 'A mild stretch in your lower back and buttock, about 3 to 4 out of 10.',
    shouldNotFeel:
      'Continue only if your symptoms stay the same or move toward your spine. Stop if pain, tingling or numbness spreads down your leg. Ease off at any sharp pain.',
    why: 'Gentle bending eases many stiff backs, especially those that feel better when sitting or leaning forward. It also relaxes your buttock muscles.',
    mistakes: [
      {
        mistake: 'Pulling on the shin',
        risk: 'Squeezes your kneecap.',
        fix: 'Hold behind your thigh instead.',
        clip: 'knee-to-chest.pulling-shin',
        pose: 'Hands clasp the shin just below the kneecap, bending the knee past about 130 degrees.',
      },
      {
        mistake: 'Tailbone lifting high',
        risk: 'Loads your discs at the end of their range and may send symptoms down your leg.',
        fix: 'Stop drawing in as soon as your tailbone starts to lift.',
        clip: 'knee-to-chest.tailbone-lifts',
        pose: 'Pelvis rolls back more than 20 degrees so the tailbone lifts off the mat and the lumbar spine reaches end-range flexion.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'Use a single knee and partial range, and avoid it soon after waking. Bending often eases backs that prefer sitting, but can aggravate disc-type sciatica. A pelvic tilt is the gentler swap.',
      regression: 'pelvic-tilt',
    },
    cues: ['Hands behind the thigh', 'Head stays down', 'Draw in gently, breathe out', 'If your leg buzzes, ease off'],
    youtube: {
      tutorial: 'single knee to chest stretch physical therapist',
      mistakes: 'knee to chest stretch mistakes physical therapist',
    },
    sources: [
      'https://www.csp.org.uk/conditions/back-pain/video-exercises-back-pain',
      'https://pubmed.ncbi.nlm.nih.gov/9854759/',
      'https://www.cuh.nhs.uk/patient-information/sciatica/',
    ],
  },
  {
    id: 'prone-press-up',
    name: 'Prone Press-Up',
    summary:
      'A face-down press-up with your hips resting on the floor that gently arches your lower back, guided by how your symptoms respond.',
    muscles: {
      primary: ['Lower back'],
      secondary: ['Abdominals', 'Triceps'],
    },
    equipment: 'Mat, plus a pillow if needed',
    setup: [
      'Lie face down on a mat or firm bed, with your arms by your sides.',
      'Place a pillow under your hips if lying flat is uncomfortable.',
      'Rest here for about a minute, and notice where you feel any leg symptoms.',
    ],
    steps: [
      'Prop yourself up onto your forearms, elbows under your shoulders, for a few slow breaths.',
      'If your symptoms stay the same or move toward your back, place your hands under your shoulders.',
      'Breathe out and press your chest up, keeping your hips on the floor and your buttocks soft.',
      'Let your lower back sag for a moment at the top.',
      'Breathe in and lower slowly back down.',
      'If symptoms spread down your leg, stop pressing and return to the last position that felt comfortable.',
      'When you finish, roll onto your side to get up.',
    ],
    dosage: { reps: 10, secondsPerRep: 10, sets: 1, sides: 'none' },
    breathing:
      'Breathe out slowly for about six seconds as you press up and let your back sag. Breathe in through your nose for about four seconds as you lower down. Never hold your breath at the top.',
    feel: 'A gentle pressure or stretch in your lower back, about 3 to 4 out of 10. Leg symptoms easing or moving up toward your back is a good sign, even if your back aches a little more for a moment.',
    shouldNotFeel:
      'Continue only if your symptoms stay the same or move toward your spine. Stop if they spread further down your leg, or if new tingling or numbness appears. Ease off at any sharp pain or dizziness.',
    why: 'For many backs, gentle repeated arching eases pain and draws leg symptoms back toward the spine. Your symptoms guide how far you go.',
    mistakes: [
      {
        mistake: 'Hips lifting off the floor',
        risk: 'The bend moves to your hips, and your lower back misses out.',
        fix: 'Keep your hips heavy on the floor.',
        clip: 'prone-press-up.hips-lift',
        pose: 'Pelvis lifts 3 to 5 cm off the mat as the arms press up, so the extension comes from the hips rather than the lumbar spine.',
      },
      {
        mistake: 'Head thrown back',
        risk: 'Squeezes your neck and can make you dizzy.',
        fix: 'Keep your eyes on the floor just ahead.',
        clip: 'prone-press-up.head-thrown-back',
        pose: 'At the top of the press the neck extends about 30 to 40 degrees, the head thrown back with the gaze toward the ceiling.',
      },
    ],
    backSafety: {
      status: 'modify',
      note: 'Let your symptoms guide you: continue while leg symptoms stay the same or move toward your back, and stop if they spread. Build up from lying face down, to resting on your forearms, to a half press-up. Backs that dislike arching, such as those with stenosis, often do not tolerate it.',
    },
    cues: ['Hips heavy, back soft', 'Press, breathe out, sag', 'Leg easing is a good sign', 'If symptoms spread, stop'],
    youtube: {
      tutorial: 'prone press up McKenzie extension exercise physical therapist',
      mistakes: 'prone press up mistakes physical therapist',
    },
    sources: [
      'https://mckenzieinstitute.org/assets/International/MDT-Clinical-Definitions-July2021.pdf',
      'https://www.cuh.nhs.uk/patient-information/back-mobility-exercises/',
      'https://pubmed.ncbi.nlm.nih.gov/30273918/',
    ],
  },
];
