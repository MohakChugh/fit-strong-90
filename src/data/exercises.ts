import type { Exercise, MuscleGroup, Difficulty } from '@/types';

export const exercises: Exercise[] = [
  // BACK EXERCISES
  {
    id: 'lat-pulldown',
    name: 'Lat Pulldown',
    primaryMuscles: ['lats', 'upper back'],
    secondaryMuscles: ['biceps', 'rear delts'],
    equipment: 'Cable machine',
    instructions: [
      'Sit at the lat pulldown machine with knees secured under pads',
      'Grip the bar slightly wider than shoulder-width with palms facing away',
      'Pull the bar down to upper chest while keeping torso upright, squeeze shoulder blades together',
      'Slowly return to starting position with arms fully extended'
    ],
    commonMistakes: [
      'Leaning back too far and using momentum instead of lat strength',
      'Pulling the bar behind the neck, which can strain shoulders'
    ],
    beginnerAlternative: 'Assisted pull-up machine',
    advancedAlternative: 'Weighted pull-ups',
    youtubeSearchQuery: 'lat pulldown proper form',
    difficulty: 'beginner',
    category: 'back'
  },
  {
    id: 'seated-cable-row',
    name: 'Seated Cable Row',
    primaryMuscles: ['mid back', 'lats'],
    secondaryMuscles: ['biceps', 'rear delts', 'traps'],
    equipment: 'Cable machine',
    instructions: [
      'Sit at the cable row machine with feet on footrests and knees slightly bent',
      'Grab the handle with both hands, arms extended',
      'Pull the handle toward your lower abdomen, squeezing shoulder blades together',
      'Keep torso upright and core engaged throughout the movement'
    ],
    commonMistakes: [
      'Using momentum by rocking back and forth',
      'Rounding the shoulders forward at the start position'
    ],
    beginnerAlternative: 'Resistance band row',
    advancedAlternative: 'One-arm cable row',
    youtubeSearchQuery: 'seated cable row form',
    difficulty: 'beginner',
    category: 'back'
  },
  {
    id: 'one-arm-dumbbell-row',
    name: 'One-Arm Dumbbell Row',
    primaryMuscles: ['lats', 'mid back'],
    secondaryMuscles: ['biceps', 'rear delts', 'core'],
    equipment: 'Dumbbell, bench',
    instructions: [
      'Place one knee and hand on a bench, keep back flat and parallel to the ground',
      'Hold dumbbell in opposite hand with arm extended',
      'Pull dumbbell up toward hip, keeping elbow close to body',
      'Squeeze shoulder blade at the top, then lower with control'
    ],
    commonMistakes: [
      'Rotating torso as you pull, instead of keeping it stable',
      'Using too much momentum instead of controlled movement'
    ],
    beginnerAlternative: 'Two-arm dumbbell row',
    advancedAlternative: 'Single-arm landmine row',
    youtubeSearchQuery: 'one arm dumbbell row technique',
    difficulty: 'intermediate',
    category: 'back'
  },
  {
    id: 'chest-supported-row',
    name: 'Chest-Supported Row',
    primaryMuscles: ['mid back', 'lats'],
    secondaryMuscles: ['biceps', 'rear delts'],
    equipment: 'Incline bench, dumbbells',
    instructions: [
      'Set an incline bench to 45 degrees and lie face down',
      'Hold dumbbells with arms hanging straight down',
      'Pull dumbbells up toward hips, squeezing shoulder blades together',
      'Lower with control, maintaining chest contact with bench'
    ],
    commonMistakes: [
      'Lifting chest off the bench to use momentum',
      'Flaring elbows out too wide instead of keeping them close to body'
    ],
    youtubeSearchQuery: 'chest supported dumbbell row',
    difficulty: 'intermediate',
    category: 'back'
  },
  {
    id: 'face-pull',
    name: 'Face Pull',
    primaryMuscles: ['rear delts', 'upper back'],
    secondaryMuscles: ['traps', 'rotator cuff'],
    equipment: 'Cable machine with rope attachment',
    instructions: [
      'Set cable at upper chest height with rope attachment',
      'Grab rope with overhand grip, step back to create tension',
      'Pull rope toward your face, separating hands as you pull',
      'Focus on pulling with rear delts and squeezing shoulder blades'
    ],
    commonMistakes: [
      'Using too much weight and pulling with arms instead of rear delts',
      'Not externally rotating shoulders at the end of the movement'
    ],
    youtubeSearchQuery: 'face pull cable exercise',
    difficulty: 'beginner',
    category: 'back'
  },
  {
    id: 'deadlift',
    name: 'Deadlift',
    primaryMuscles: ['lower back', 'glutes', 'hamstrings'],
    secondaryMuscles: ['traps', 'forearms', 'core', 'quads'],
    equipment: 'Barbell',
    instructions: [
      'Stand with feet hip-width apart, barbell over mid-foot',
      'Bend at hips and knees, grip bar just outside legs',
      'Keep back flat, chest up, drive through heels to stand up',
      'Lock out hips and knees at top, then lower bar with control'
    ],
    commonMistakes: [
      'Rounding the lower back during the lift',
      'Starting with hips too low or too high'
    ],
    beginnerAlternative: 'Trap bar deadlift',
    advancedAlternative: 'Deficit deadlift',
    youtubeSearchQuery: 'deadlift proper form tutorial',
    difficulty: 'advanced',
    category: 'back'
  },
  {
    id: 'rack-pull',
    name: 'Rack Pull',
    primaryMuscles: ['upper back', 'traps'],
    secondaryMuscles: ['lower back', 'glutes', 'forearms'],
    equipment: 'Barbell, power rack',
    instructions: [
      'Set barbell in power rack at knee height',
      'Stand with feet hip-width, grip bar just outside legs',
      'Keep back flat, pull bar up by extending hips and standing tall',
      'Squeeze traps and shoulder blades at top, lower with control'
    ],
    commonMistakes: [
      'Using momentum instead of controlled pulling',
      'Shrugging at the top instead of retracting shoulder blades'
    ],
    youtubeSearchQuery: 'rack pull exercise technique',
    difficulty: 'advanced',
    category: 'back'
  },

  // CHEST EXERCISES
  {
    id: 'machine-chest-press',
    name: 'Machine Chest Press',
    primaryMuscles: ['chest', 'pectorals'],
    secondaryMuscles: ['triceps', 'front delts'],
    equipment: 'Chest press machine',
    instructions: [
      'Adjust seat so handles align with mid-chest',
      'Sit with back flat against pad, grip handles',
      'Press forward until arms are extended but not locked',
      'Return to starting position with control'
    ],
    commonMistakes: [
      'Bouncing the weight instead of using controlled motion',
      'Arching back excessively off the pad'
    ],
    beginnerAlternative: 'Push-ups on knees',
    advancedAlternative: 'Barbell bench press',
    youtubeSearchQuery: 'chest press machine tutorial',
    difficulty: 'beginner',
    category: 'chest'
  },
  {
    id: 'dumbbell-bench-press',
    name: 'Dumbbell Bench Press',
    primaryMuscles: ['chest', 'pectorals'],
    secondaryMuscles: ['triceps', 'front delts'],
    equipment: 'Dumbbells, flat bench',
    instructions: [
      'Lie on flat bench with dumbbells at chest level',
      'Plant feet firmly on ground, maintain slight arch in lower back',
      'Press dumbbells up until arms are extended',
      'Lower with control until dumbbells are at chest level'
    ],
    commonMistakes: [
      'Flaring elbows out too wide, which strains shoulders',
      'Bouncing dumbbells off chest instead of controlled descent'
    ],
    beginnerAlternative: 'Machine chest press',
    advancedAlternative: 'Barbell bench press with heavier weight',
    youtubeSearchQuery: 'dumbbell bench press form',
    difficulty: 'intermediate',
    category: 'chest'
  },
  {
    id: 'incline-dumbbell-press',
    name: 'Incline Dumbbell Press',
    primaryMuscles: ['upper chest'],
    secondaryMuscles: ['front delts', 'triceps'],
    equipment: 'Dumbbells, incline bench',
    instructions: [
      'Set bench to 30-45 degree incline',
      'Lie back with dumbbells at upper chest level',
      'Press dumbbells up and slightly together at top',
      'Lower with control to starting position'
    ],
    commonMistakes: [
      'Setting incline too steep, which shifts focus to shoulders',
      'Not getting full range of motion at the bottom'
    ],
    beginnerAlternative: 'Incline machine press',
    advancedAlternative: 'Incline barbell press',
    youtubeSearchQuery: 'incline dumbbell press tutorial',
    difficulty: 'intermediate',
    category: 'chest'
  },
  {
    id: 'cable-fly',
    name: 'Cable Fly',
    primaryMuscles: ['chest', 'pectorals'],
    secondaryMuscles: ['front delts'],
    equipment: 'Cable machine',
    instructions: [
      'Set cables to chest height, grab handles with arms extended to sides',
      'Step forward slightly, lean forward with one foot ahead',
      'Bring hands together in front of chest in hugging motion',
      'Return to starting position with control, feeling stretch in chest'
    ],
    commonMistakes: [
      'Bending elbows too much, turning it into a press',
      'Using momentum instead of controlled movement'
    ],
    beginnerAlternative: 'Dumbbell fly',
    advancedAlternative: 'Single-arm cable fly',
    youtubeSearchQuery: 'cable chest fly proper form',
    difficulty: 'intermediate',
    category: 'chest'
  },
  {
    id: 'push-ups',
    name: 'Push-Ups',
    primaryMuscles: ['chest', 'pectorals'],
    secondaryMuscles: ['triceps', 'front delts', 'core'],
    equipment: 'Bodyweight',
    instructions: [
      'Start in plank position with hands slightly wider than shoulders',
      'Keep body in straight line from head to heels',
      'Lower chest toward ground by bending elbows',
      'Push back up to starting position'
    ],
    commonMistakes: [
      'Letting hips sag or piking hips up',
      'Not going through full range of motion'
    ],
    beginnerAlternative: 'Incline push-ups on bench',
    advancedAlternative: 'Deficit push-ups or weighted push-ups',
    youtubeSearchQuery: 'perfect push up form',
    difficulty: 'beginner',
    category: 'chest'
  },
  {
    id: 'assisted-dips',
    name: 'Assisted Dips',
    primaryMuscles: ['chest', 'triceps'],
    secondaryMuscles: ['front delts'],
    equipment: 'Assisted dip machine',
    instructions: [
      'Set assistance weight and grip handles with arms extended',
      'Lean forward slightly to target chest more',
      'Lower body by bending elbows until upper arms are parallel to ground',
      'Push back up to starting position'
    ],
    commonMistakes: [
      'Not leaning forward enough, which shifts focus to triceps',
      'Going too deep and risking shoulder strain'
    ],
    advancedAlternative: 'Bodyweight dips or weighted dips',
    youtubeSearchQuery: 'assisted dips machine tutorial',
    difficulty: 'intermediate',
    category: 'chest'
  },

  // LEGS EXERCISES
  {
    id: 'leg-press',
    name: 'Leg Press',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings', 'calves'],
    equipment: 'Leg press machine',
    instructions: [
      'Sit in leg press machine with back flat against pad',
      'Place feet shoulder-width apart on platform',
      'Lower platform by bending knees until they reach 90 degrees',
      'Press through heels to return to starting position'
    ],
    commonMistakes: [
      'Locking out knees at top of movement',
      'Letting lower back round off the pad at bottom'
    ],
    beginnerAlternative: 'Bodyweight squats',
    advancedAlternative: 'Single-leg press',
    youtubeSearchQuery: 'leg press proper technique',
    difficulty: 'beginner',
    category: 'legs'
  },
  {
    id: 'goblet-squat',
    name: 'Goblet Squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['core', 'hamstrings'],
    equipment: 'Dumbbell or kettlebell',
    instructions: [
      'Hold dumbbell vertically at chest level with both hands',
      'Stand with feet shoulder-width apart, toes slightly out',
      'Squat down by bending knees and hips, keeping chest up',
      'Drive through heels to stand back up'
    ],
    commonMistakes: [
      'Knees caving inward during squat',
      'Leaning forward too much, losing upright torso position'
    ],
    beginnerAlternative: 'Bodyweight squat',
    advancedAlternative: 'Barbell front squat',
    youtubeSearchQuery: 'goblet squat form tutorial',
    difficulty: 'beginner',
    category: 'legs'
  },
  {
    id: 'barbell-squat',
    name: 'Barbell Squat',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings', 'core', 'lower back'],
    equipment: 'Barbell, squat rack',
    instructions: [
      'Position barbell on upper back, grip bar just outside shoulders',
      'Stand with feet shoulder-width apart, toes slightly out',
      'Descend by bending knees and hips, keeping chest up and core tight',
      'Drive through heels to stand back up to starting position'
    ],
    commonMistakes: [
      'Not squatting deep enough, stopping above parallel',
      'Letting knees cave inward or drift too far forward'
    ],
    beginnerAlternative: 'Goblet squat',
    advancedAlternative: 'Pause squats or high-bar squats',
    youtubeSearchQuery: 'barbell back squat technique',
    difficulty: 'advanced',
    category: 'legs'
  },
  {
    id: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    primaryMuscles: ['hamstrings', 'glutes'],
    secondaryMuscles: ['lower back', 'forearms'],
    equipment: 'Barbell or dumbbells',
    instructions: [
      'Hold barbell with overhand grip, stand with feet hip-width apart',
      'Keep knees slightly bent, hinge at hips to lower bar down legs',
      'Lower until you feel stretch in hamstrings, keep back flat',
      'Drive hips forward to return to standing position'
    ],
    commonMistakes: [
      'Bending knees too much, turning it into a squat',
      'Rounding the lower back during descent'
    ],
    beginnerAlternative: 'Dumbbell RDL',
    advancedAlternative: 'Single-leg RDL',
    youtubeSearchQuery: 'romanian deadlift form',
    difficulty: 'intermediate',
    category: 'legs'
  },
  {
    id: 'hip-thrust',
    name: 'Hip Thrust',
    primaryMuscles: ['glutes'],
    secondaryMuscles: ['hamstrings', 'core'],
    equipment: 'Barbell, bench',
    instructions: [
      'Sit on ground with upper back against bench, barbell over hips',
      'Plant feet flat on ground, knees bent at 90 degrees',
      'Drive through heels to lift hips until body forms straight line',
      'Squeeze glutes at top, then lower with control'
    ],
    commonMistakes: [
      'Overextending lower back instead of using glutes',
      'Not achieving full hip extension at the top'
    ],
    beginnerAlternative: 'Glute bridge',
    advancedAlternative: 'Single-leg hip thrust',
    youtubeSearchQuery: 'hip thrust barbell technique',
    difficulty: 'intermediate',
    category: 'legs'
  },
  {
    id: 'hamstring-curl',
    name: 'Hamstring Curl',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['calves'],
    equipment: 'Hamstring curl machine',
    instructions: [
      'Lie face down on hamstring curl machine, pad on lower calves',
      'Grip handles for stability',
      'Curl legs up toward glutes by bending knees',
      'Lower with control to starting position'
    ],
    commonMistakes: [
      'Using momentum and swinging the weight',
      'Lifting hips off the pad during curl'
    ],
    beginnerAlternative: 'Stability ball hamstring curl',
    advancedAlternative: 'Single-leg hamstring curl',
    youtubeSearchQuery: 'hamstring curl machine form',
    difficulty: 'beginner',
    category: 'legs'
  },
  {
    id: 'calf-raises',
    name: 'Calf Raises',
    primaryMuscles: ['calves'],
    secondaryMuscles: [],
    equipment: 'Calf raise machine or dumbbells',
    instructions: [
      'Stand with balls of feet on edge of platform, heels hanging off',
      'Rise up onto toes as high as possible',
      'Squeeze calves at top position',
      'Lower heels below platform level for full stretch'
    ],
    commonMistakes: [
      'Bouncing at the bottom instead of controlled movement',
      'Not achieving full range of motion'
    ],
    beginnerAlternative: 'Bodyweight calf raises',
    advancedAlternative: 'Single-leg calf raises',
    youtubeSearchQuery: 'calf raises proper form',
    difficulty: 'beginner',
    category: 'legs'
  },
  {
    id: 'walking-lunges',
    name: 'Walking Lunges',
    primaryMuscles: ['quads', 'glutes'],
    secondaryMuscles: ['hamstrings', 'core'],
    equipment: 'Dumbbells (optional)',
    instructions: [
      'Stand upright holding dumbbells at sides',
      'Step forward with one leg, lower hips until both knees at 90 degrees',
      'Push through front heel to step forward with back leg',
      'Continue alternating legs in walking pattern'
    ],
    commonMistakes: [
      'Taking steps that are too short or too long',
      'Letting front knee drift past toes'
    ],
    beginnerAlternative: 'Stationary lunges',
    advancedAlternative: 'Bulgarian split squats',
    youtubeSearchQuery: 'walking lunges with dumbbells',
    difficulty: 'intermediate',
    category: 'legs'
  },

  // SHOULDERS EXERCISES
  {
    id: 'machine-shoulder-press',
    name: 'Machine Shoulder Press',
    primaryMuscles: ['front delts', 'middle delts'],
    secondaryMuscles: ['triceps', 'upper chest'],
    equipment: 'Shoulder press machine',
    instructions: [
      'Adjust seat so handles are at shoulder height',
      'Sit with back against pad, grip handles',
      'Press handles up until arms are extended overhead',
      'Lower with control to starting position'
    ],
    commonMistakes: [
      'Arching back excessively during press',
      'Using momentum instead of controlled pressing'
    ],
    beginnerAlternative: 'Dumbbell shoulder press seated',
    advancedAlternative: 'Standing barbell overhead press',
    youtubeSearchQuery: 'shoulder press machine tutorial',
    difficulty: 'beginner',
    category: 'shoulders'
  },
  {
    id: 'dumbbell-shoulder-press',
    name: 'Dumbbell Shoulder Press',
    primaryMuscles: ['front delts', 'middle delts'],
    secondaryMuscles: ['triceps', 'upper chest'],
    equipment: 'Dumbbells, bench with back support',
    instructions: [
      'Sit on bench with back support, dumbbells at shoulder level',
      'Press dumbbells up and slightly together overhead',
      'Lower with control until dumbbells are at shoulder level',
      'Keep core engaged throughout movement'
    ],
    commonMistakes: [
      'Pressing dumbbells forward instead of straight up',
      'Arching lower back excessively'
    ],
    beginnerAlternative: 'Machine shoulder press',
    advancedAlternative: 'Standing dumbbell press',
    youtubeSearchQuery: 'dumbbell shoulder press form',
    difficulty: 'intermediate',
    category: 'shoulders'
  },
  {
    id: 'lateral-raises',
    name: 'Lateral Raises',
    primaryMuscles: ['middle delts', 'side delts'],
    secondaryMuscles: ['traps'],
    equipment: 'Dumbbells',
    instructions: [
      'Stand with dumbbells at sides, slight bend in elbows',
      'Raise arms out to sides until parallel with ground',
      'Keep shoulders down, avoid shrugging',
      'Lower with control to starting position'
    ],
    commonMistakes: [
      'Using momentum and swinging the weights',
      'Raising weights too high, above shoulder level'
    ],
    beginnerAlternative: 'Cable lateral raises',
    advancedAlternative: 'Single-arm lateral raises',
    youtubeSearchQuery: 'lateral raises dumbbell technique',
    difficulty: 'beginner',
    category: 'shoulders'
  },
  {
    id: 'rear-delt-fly',
    name: 'Rear Delt Fly',
    primaryMuscles: ['rear delts'],
    secondaryMuscles: ['upper back', 'traps'],
    equipment: 'Dumbbells, incline bench',
    instructions: [
      'Lie face down on incline bench set to 30-45 degrees',
      'Hold dumbbells with arms hanging straight down',
      'Raise dumbbells out to sides in flying motion',
      'Squeeze shoulder blades together at top, lower with control'
    ],
    commonMistakes: [
      'Using too much weight and losing proper form',
      'Not retracting shoulder blades during the movement'
    ],
    beginnerAlternative: 'Cable rear delt fly',
    advancedAlternative: 'Single-arm rear delt fly',
    youtubeSearchQuery: 'rear delt fly dumbbell',
    difficulty: 'intermediate',
    category: 'shoulders'
  },
  {
    id: 'face-pulls-shoulder',
    name: 'Face Pulls',
    primaryMuscles: ['rear delts', 'upper back'],
    secondaryMuscles: ['traps', 'rotator cuff'],
    equipment: 'Cable machine with rope',
    instructions: [
      'Set cable at upper chest height with rope attachment',
      'Grab rope with overhand grip, step back to create tension',
      'Pull rope toward face, separating hands as you pull',
      'Focus on pulling with rear delts and squeezing shoulder blades'
    ],
    commonMistakes: [
      'Using too much weight and pulling with arms',
      'Not externally rotating shoulders at end of movement'
    ],
    youtubeSearchQuery: 'face pull cable shoulder',
    difficulty: 'beginner',
    category: 'shoulders'
  },
  {
    id: 'arnold-press',
    name: 'Arnold Press',
    primaryMuscles: ['front delts', 'middle delts'],
    secondaryMuscles: ['triceps', 'upper chest'],
    equipment: 'Dumbbells, bench',
    instructions: [
      'Sit with dumbbells at shoulder level, palms facing you',
      'Press dumbbells up while rotating palms to face forward',
      'End with arms extended overhead, palms facing away',
      'Reverse the motion to return to starting position'
    ],
    commonMistakes: [
      'Rushing the rotation instead of smooth controlled motion',
      'Using too much weight and losing form'
    ],
    beginnerAlternative: 'Regular dumbbell shoulder press',
    advancedAlternative: 'Standing Arnold press',
    youtubeSearchQuery: 'arnold press technique tutorial',
    difficulty: 'advanced',
    category: 'shoulders'
  },

  // ARMS EXERCISES
  {
    id: 'barbell-curl',
    name: 'Barbell Curl',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    equipment: 'Barbell',
    instructions: [
      'Stand with feet shoulder-width, hold barbell with underhand grip',
      'Keep elbows close to torso, curl bar up toward shoulders',
      'Squeeze biceps at top of movement',
      'Lower with control to full arm extension'
    ],
    commonMistakes: [
      'Swinging the bar using momentum',
      'Moving elbows forward or back instead of keeping them stationary'
    ],
    beginnerAlternative: 'Dumbbell curl',
    advancedAlternative: 'EZ bar curl or preacher curl',
    youtubeSearchQuery: 'barbell curl proper form',
    difficulty: 'beginner',
    category: 'arms'
  },
  {
    id: 'incline-dumbbell-curl',
    name: 'Incline Dumbbell Curl',
    primaryMuscles: ['biceps'],
    secondaryMuscles: ['forearms'],
    equipment: 'Dumbbells, incline bench',
    instructions: [
      'Set bench to 45-degree incline, sit with back against pad',
      'Let arms hang straight down with dumbbells',
      'Curl dumbbells up toward shoulders, keeping elbows back',
      'Lower with control to full stretch position'
    ],
    commonMistakes: [
      'Letting elbows drift forward during curl',
      'Not achieving full stretch at bottom position'
    ],
    beginnerAlternative: 'Standing dumbbell curl',
    advancedAlternative: 'Incline hammer curl',
    youtubeSearchQuery: 'incline dumbbell curl technique',
    difficulty: 'intermediate',
    category: 'arms'
  },
  {
    id: 'hammer-curl',
    name: 'Hammer Curl',
    primaryMuscles: ['biceps', 'brachialis'],
    secondaryMuscles: ['forearms'],
    equipment: 'Dumbbells',
    instructions: [
      'Stand with dumbbells at sides, palms facing each other',
      'Keep elbows close to torso throughout movement',
      'Curl dumbbells up toward shoulders maintaining neutral grip',
      'Lower with control to starting position'
    ],
    commonMistakes: [
      'Rotating wrists during curl instead of keeping neutral',
      'Using momentum to swing weights up'
    ],
    beginnerAlternative: 'Cable hammer curl',
    advancedAlternative: 'Cross-body hammer curl',
    youtubeSearchQuery: 'hammer curl dumbbell form',
    difficulty: 'beginner',
    category: 'arms'
  },
  {
    id: 'rope-pushdown',
    name: 'Rope Pushdown',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    equipment: 'Cable machine with rope attachment',
    instructions: [
      'Attach rope to high pulley, grab ends with overhand grip',
      'Keep elbows close to sides, upper arms stationary',
      'Push rope down by extending elbows, separate rope ends at bottom',
      'Return to starting position with control'
    ],
    commonMistakes: [
      'Letting elbows flare out or move during extension',
      'Leaning forward too much and using body weight'
    ],
    beginnerAlternative: 'Straight bar pushdown',
    advancedAlternative: 'Single-arm pushdown',
    youtubeSearchQuery: 'tricep rope pushdown technique',
    difficulty: 'beginner',
    category: 'arms'
  },
  {
    id: 'overhead-tricep-extension',
    name: 'Overhead Tricep Extension',
    primaryMuscles: ['triceps'],
    secondaryMuscles: ['core'],
    equipment: 'Dumbbell or cable machine',
    instructions: [
      'Hold dumbbell overhead with both hands, arms extended',
      'Keep elbows close to head, lower weight behind head',
      'Extend elbows to raise weight back to starting position',
      'Keep core engaged and avoid arching back'
    ],
    commonMistakes: [
      'Letting elbows flare out to sides',
      'Arching lower back excessively'
    ],
    beginnerAlternative: 'Seated overhead extension',
    advancedAlternative: 'Single-arm overhead extension',
    youtubeSearchQuery: 'overhead tricep extension dumbbell',
    difficulty: 'intermediate',
    category: 'arms'
  },
  {
    id: 'skull-crushers',
    name: 'Skull Crushers',
    primaryMuscles: ['triceps'],
    secondaryMuscles: [],
    equipment: 'EZ bar or dumbbells, flat bench',
    instructions: [
      'Lie on flat bench holding EZ bar with arms extended overhead',
      'Keep upper arms stationary, lower bar toward forehead',
      'Extend elbows to press bar back to starting position',
      'Maintain control throughout movement'
    ],
    commonMistakes: [
      'Letting elbows flare out instead of keeping them in',
      'Moving upper arms instead of keeping them stationary'
    ],
    beginnerAlternative: 'Close-grip bench press',
    advancedAlternative: 'Decline skull crushers',
    youtubeSearchQuery: 'skull crushers ez bar form',
    difficulty: 'advanced',
    category: 'arms'
  },

  // CORE EXERCISES
  {
    id: 'plank',
    name: 'Plank',
    primaryMuscles: ['core', 'abs'],
    secondaryMuscles: ['shoulders', 'glutes'],
    equipment: 'Bodyweight',
    instructions: [
      'Start in forearm plank position with elbows under shoulders',
      'Keep body in straight line from head to heels',
      'Engage core by pulling belly button toward spine',
      'Hold position while breathing normally'
    ],
    commonMistakes: [
      'Letting hips sag toward ground',
      'Piking hips up too high'
    ],
    beginnerAlternative: 'Plank on knees',
    advancedAlternative: 'Weighted plank or plank with leg lift',
    youtubeSearchQuery: 'perfect plank form tutorial',
    difficulty: 'beginner',
    category: 'core'
  },
  {
    id: 'dead-bug',
    name: 'Dead Bug',
    primaryMuscles: ['core', 'abs'],
    secondaryMuscles: ['hip flexors'],
    equipment: 'Bodyweight',
    instructions: [
      'Lie on back with arms extended toward ceiling, knees bent at 90 degrees',
      'Lower opposite arm and leg toward ground simultaneously',
      'Keep lower back pressed against floor throughout',
      'Return to starting position and alternate sides'
    ],
    commonMistakes: [
      'Letting lower back arch off the ground',
      'Moving too quickly without control'
    ],
    beginnerAlternative: 'Single-leg dead bug',
    advancedAlternative: 'Dead bug with resistance band',
    youtubeSearchQuery: 'dead bug exercise core',
    difficulty: 'beginner',
    category: 'core'
  },
  {
    id: 'cable-crunch',
    name: 'Cable Crunch',
    primaryMuscles: ['abs', 'upper abs'],
    secondaryMuscles: ['obliques'],
    equipment: 'Cable machine with rope attachment',
    instructions: [
      'Kneel in front of high pulley with rope attachment',
      'Hold rope behind head with hands at temples',
      'Crunch down by flexing at waist, bringing elbows toward knees',
      'Return to starting position with control'
    ],
    commonMistakes: [
      'Using hip flexors instead of abs to pull weight',
      'Pulling with arms instead of crunching with abs'
    ],
    beginnerAlternative: 'Bodyweight crunch',
    advancedAlternative: 'Standing cable crunch',
    youtubeSearchQuery: 'cable crunch kneeling form',
    difficulty: 'intermediate',
    category: 'core'
  },
  {
    id: 'hanging-knee-raise',
    name: 'Hanging Knee Raise',
    primaryMuscles: ['lower abs', 'hip flexors'],
    secondaryMuscles: ['core', 'forearms'],
    equipment: 'Pull-up bar',
    instructions: [
      'Hang from pull-up bar with arms fully extended',
      'Engage core and raise knees toward chest',
      'Control the descent back to starting position',
      'Avoid swinging or using momentum'
    ],
    commonMistakes: [
      'Swinging body instead of controlled movement',
      'Not raising knees high enough'
    ],
    beginnerAlternative: 'Lying leg raises',
    advancedAlternative: 'Hanging leg raises with straight legs',
    youtubeSearchQuery: 'hanging knee raise technique',
    difficulty: 'intermediate',
    category: 'core'
  },
  {
    id: 'russian-twist',
    name: 'Russian Twist',
    primaryMuscles: ['obliques', 'abs'],
    secondaryMuscles: ['core'],
    equipment: 'Medicine ball or dumbbell',
    instructions: [
      'Sit on ground with knees bent, lean back slightly',
      'Hold weight at chest with both hands',
      'Rotate torso side to side, touching weight to ground beside hips',
      'Keep core engaged and feet off ground for added difficulty'
    ],
    commonMistakes: [
      'Moving arms instead of rotating torso',
      'Going too fast and losing control'
    ],
    beginnerAlternative: 'Russian twist with feet on ground',
    advancedAlternative: 'Russian twist with heavier weight',
    youtubeSearchQuery: 'russian twist exercise form',
    difficulty: 'intermediate',
    category: 'core'
  },

  // CARDIO EXERCISES
  {
    id: 'brisk-walking',
    name: 'Brisk Walking',
    primaryMuscles: ['cardiovascular system', 'legs'],
    secondaryMuscles: ['core', 'glutes'],
    equipment: 'None',
    instructions: [
      'Walk at a pace that elevates heart rate (15-20 min per mile)',
      'Maintain upright posture with shoulders back',
      'Swing arms naturally at sides',
      'Aim for 20-30 minutes continuous walking'
    ],
    commonMistakes: [
      'Walking too slowly to achieve cardiovascular benefit',
      'Poor posture with shoulders hunched forward'
    ],
    advancedAlternative: 'Incline walking or jogging',
    youtubeSearchQuery: 'brisk walking technique',
    difficulty: 'beginner',
    category: 'cardio'
  },
  {
    id: 'stationary-bike',
    name: 'Stationary Bike',
    primaryMuscles: ['cardiovascular system', 'quads'],
    secondaryMuscles: ['hamstrings', 'calves'],
    equipment: 'Stationary bike',
    instructions: [
      'Adjust seat height so knee has slight bend at bottom of pedal stroke',
      'Maintain steady pace that elevates heart rate',
      'Keep upper body relaxed, avoid gripping handlebars too tightly',
      'Aim for 20-30 minutes of continuous cycling'
    ],
    commonMistakes: [
      'Seat adjusted too high or too low',
      'Pedaling too slowly to achieve cardio benefit'
    ],
    beginnerAlternative: 'Recumbent bike',
    advancedAlternative: 'Interval training on bike',
    youtubeSearchQuery: 'stationary bike proper setup',
    difficulty: 'beginner',
    category: 'cardio'
  },

  // MOBILITY EXERCISES
  {
    id: 'hip-opener-stretch',
    name: 'Hip Opener Stretch',
    primaryMuscles: ['hip flexors', 'glutes'],
    secondaryMuscles: ['lower back'],
    equipment: 'Mat',
    instructions: [
      'Start in low lunge position with one knee on ground',
      'Push hips forward gently to feel stretch in front hip',
      'Hold for 30 seconds, breathing deeply',
      'Switch sides and repeat'
    ],
    commonMistakes: [
      'Arching lower back excessively',
      'Not holding stretch long enough'
    ],
    youtubeSearchQuery: 'hip flexor stretch runner lunge',
    difficulty: 'beginner',
    category: 'mobility'
  },
  {
    id: 'hamstring-stretch',
    name: 'Hamstring Stretch',
    primaryMuscles: ['hamstrings'],
    secondaryMuscles: ['calves', 'lower back'],
    equipment: 'Mat',
    instructions: [
      'Lie on back, raise one leg toward ceiling',
      'Keep leg straight, gently pull toward chest',
      'Hold for 30 seconds, feeling stretch in back of thigh',
      'Switch legs and repeat'
    ],
    commonMistakes: [
      'Bending knee instead of keeping leg straight',
      'Pulling too aggressively and risking strain'
    ],
    youtubeSearchQuery: 'hamstring stretch lying down',
    difficulty: 'beginner',
    category: 'mobility'
  },
  {
    id: 'thoracic-opener',
    name: 'Thoracic Opener',
    primaryMuscles: ['upper back', 'chest'],
    secondaryMuscles: ['shoulders'],
    equipment: 'Foam roller or towel',
    instructions: [
      'Lie on back with foam roller perpendicular under upper back',
      'Support head with hands, extend upper back over roller',
      'Hold for 20-30 seconds, breathing deeply',
      'Move roller to different positions along upper back'
    ],
    commonMistakes: [
      'Placing roller on lower back instead of upper back',
      'Holding breath instead of breathing deeply'
    ],
    youtubeSearchQuery: 'thoracic spine foam roller stretch',
    difficulty: 'beginner',
    category: 'mobility'
  },
  {
    id: 'breathing-cooldown',
    name: 'Breathing Cooldown',
    primaryMuscles: ['respiratory system'],
    secondaryMuscles: ['core'],
    equipment: 'None',
    instructions: [
      'Sit or lie in comfortable position',
      'Breathe in deeply through nose for 4 counts',
      'Hold breath for 4 counts',
      'Exhale slowly through mouth for 6 counts',
      'Repeat for 3-5 minutes'
    ],
    commonMistakes: [
      'Breathing too rapidly instead of slowly',
      'Not fully exhaling before next breath'
    ],
    youtubeSearchQuery: 'breathing exercises relaxation',
    difficulty: 'beginner',
    category: 'mobility'
  }
];

export const getExerciseById = (id: string): Exercise | undefined => {
  return exercises.find(ex => ex.id === id);
};

export const getExercisesByCategory = (category: MuscleGroup): Exercise[] => {
  return exercises.filter(ex => ex.category === category);
};

export const getExercisesByDifficulty = (difficulty: Difficulty): Exercise[] => {
  return exercises.filter(ex => ex.difficulty === difficulty);
};
