import type { Topic } from './schema';

/**
 * The Guide's topics, in the order the owner asked about them. Personalisation
 * moves the relevant ones under "For you" but never reorders the rest.
 */
export const TOPICS: Topic[] = [
  {
    id: 'food-diabetes',
    title: 'Food & diabetes',
    // The summary names no glucose word: it describes the topic, and the
    // answer about how often to check is the card (codex-acceptance J06).
    summary: 'The plate, Indian meals, drinks and home checks',
    aliases: [
      'diet', 'food', 'sugar', 'diabetes', 'diabetic', 'meal plan', 'khana', 'glucose', 'blood sugar', 'blood glucose', 'sugar level',
      'sugar test', 'glucometer', 'monitoring', 'checking', 'hba1c', 'a1c', 'waist', 'ghee', 'oil', 'मधुमेह', 'डायबिटीज', 'शुगर', 'खाना',
      'ग्लूकोज', 'ब्लड शुगर',
    ],
    relevantWhen: ['type2', 'type1', 'otherDiabetes', 'prediabetes'],
    meals: true,
  },
  {
    id: 'food-bp',
    title: 'Food & blood pressure',
    summary: 'Salt, salt substitutes and measuring at home',
    aliases: [
      'bp', 'blood pressure', 'hypertension', 'high bp', 'salt', 'namak', 'bp machine', 'bp monitor', 'home bp', 'measuring', 'monitoring',
      'cuff', 'waist', 'नमक', 'बीपी', 'रक्तचाप',
    ],
    relevantWhen: ['hypertension', 'bpUnsure', 'kidney'],
    meals: true,
  },
  {
    id: 'b12',
    title: 'Vitamin B12',
    summary: 'Metformin, vegetarian food and testing',
    aliases: ['b12', 'vitamin b12', 'cobalamin', 'विटामिन', 'बी12'],
    relevantWhen: ['metformin', 'metforminUnknown', 'vegan', 'vegetarian', 'eggetarian'],
  },
  {
    id: 'vitamin-d',
    title: 'Vitamin D',
    summary: 'Sunlight, food and when to test',
    aliases: ['vitamin d', 'vit d', 'sunlight', 'dhoop', 'विटामिन', 'धूप'],
    relevantWhen: ['vegan'],
  },
  {
    id: 'desk',
    title: 'Desk setup & sitting',
    summary: 'Chair, screen and getting up often',
    aliases: ['posture', 'ergonomics', 'office', 'sitting', 'desk', 'कुर्सी', 'बैठना'],
    relevantWhen: ['backPain', 'type2', 'type1', 'otherDiabetes', 'prediabetes'],
  },
  {
    id: 'water',
    title: 'Water',
    summary: 'How much to drink, and when a limit comes first',
    aliases: ['hydration', 'pani', 'paani', 'drinks', 'fluids', 'पानी'],
    relevantWhen: ['fluidCaution'],
  },
  {
    id: 'sleep',
    title: 'Sleep',
    summary: 'Hours, habits and snoring',
    aliases: ['neend', 'insomnia', 'tired', 'नींद'],
    relevantWhen: [],
  },
  {
    id: 'back',
    title: 'Movement & your back',
    summary: 'Staying active with back pain and sciatica',
    aliases: ['sciatica', 'back pain', 'exercise', 'walking', 'steps', 'kamar dard', 'recovery', 'nerve pain', 'slipped disc', 'कमर दर्द', 'साइटिका', 'व्यायाम'],
    relevantWhen: ['sciatica', 'backPain'],
  },
  {
    id: 'habits',
    title: 'Daily habits',
    summary: 'Alcohol, tobacco and small habits that add up',
    aliases: ['lifestyle', 'habits', 'life choices', 'alcohol', 'smoking', 'शराब', 'तंबाकू', 'सिगरेट'],
    relevantWhen: [],
  },
];
