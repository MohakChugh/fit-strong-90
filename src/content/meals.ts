import { REVIEWED } from './claims';
import type { MealComponent, MealTemplate, Measure, Pattern, Slot } from './schema';

/**
 * The only portions a meal may state. Each one comes from a source: the
 * plate method for vegetables, protein and grains, and ICMR-NIN's sample
 * day for curd and fruit. There is deliberately no roti count, grams of
 * carbohydrate or calorie figure: no source gives one for a person we have not
 * met, and their own targets come from their care team.
 */
export const MEASURES: Record<string, Measure> = {
  halfPlate: { text: 'Half the plate', claimIds: ['fd-plate-method'] },
  quarterPlate: { text: 'A quarter of the plate', claimIds: ['fd-plate-method'] },
  curdGlass: { text: '1 small steel glass, about 100 ml', claimIds: ['meal-curd-glass'] },
  fruitKatori: { text: 'Half a medium katori', claimIds: ['meal-fruit-katori', 'meal-katori'] },
};

/**
 * Shown on Meal ideas, above the meals: how they are built, salt, and whose
 * portions they are not. Each is neutral and swaps to its diabetes or blood
 * pressure version, marked For you, only for the people it applies to (S-14).
 */
export const MEAL_INTRO = ['fd-plate-method', 'meal-salt', 'fd-personal-plan'];

/** Shown under a slot on Meal ideas. Snacks are optional in ICMR-NIN's guidance. */
export const SLOT_NOTES: Partial<Record<Slot, string[]>> = {
  snack: ['fd-two-three-meals', 'fd-healthy-snacks'],
};

export const SLOTS: { id: Slot; title: string }[] = [
  { id: 'breakfast', title: 'Breakfast' },
  { id: 'lunch', title: 'Lunch' },
  { id: 'snack', title: 'Snacks' },
  { id: 'dinner', title: 'Dinner' },
];

const ALL: Pattern[] = ['vegetarian', 'eggetarian', 'nonVegetarian', 'vegan'];
const WITH_DAIRY: Pattern[] = ['vegetarian', 'eggetarian', 'nonVegetarian'];
const WITH_EGGS: Pattern[] = ['eggetarian', 'nonVegetarian'];
const NON_VEG: Pattern[] = ['nonVegetarian'];

// Components that recur. Aliases let a "leave out" entry such as "curd" or
// "nuts" find the component whatever the dish calls it.
const DAIRY = ['curd', 'dahi', 'yogurt', 'yoghurt', 'milk', 'dairy', 'दही', 'दूध'];
const dahi = (name = 'Dahi (curd)'): MealComponent =>
  ({ name, group: 'dairy', measure: 'curdGlass', aliases: DAIRY, notFor: ['vegan'] });
const roti = (): MealComponent =>
  ({ name: 'Whole-wheat or millet roti', group: 'grains', measure: 'quarterPlate', aliases: ['roti', 'chapati', 'chapatti', 'chappati', 'chapathi', 'phulka', 'fulka', 'wheat', 'atta', 'millet', 'gluten', 'रोटी', 'चपाती'] });
const rice = (name = 'Rice'): MealComponent =>
  ({ name, group: 'grains', measure: 'quarterPlate', aliases: ['rice', 'chawal', 'chaval', 'bhat', 'bhaat', 'चावल', 'भात'] });
const dal = (name = 'Dal'): MealComponent =>
  ({ name, group: 'pulses', measure: 'quarterPlate', aliases: ['dal', 'daal', 'dhal', 'lentils', 'pulses', 'दाल'] });
const veg = (name: string): MealComponent =>
  ({ name, group: 'vegetables', measure: 'halfPlate', aliases: ['vegetables', 'sabzi', 'salad', 'सब्ज़ी', 'सब्जी', 'सलाद'] });

const meal = (m: Omit<MealTemplate, 'reviewedDate' | 'swaps' | 'salt' | 'sugar'> & Partial<Pick<MealTemplate, 'swaps' | 'salt' | 'sugar'>>): MealTemplate =>
  ({ swaps: [], salt: [], sugar: [], ...m, reviewedDate: REVIEWED });

/**
 * Familiar Indian meals laid out with the plate method. They are examples to
 * adapt, not a prescribed diet: the sample week is assembled from these and
 * nothing else.
 */
export const MEALS: MealTemplate[] = [
  // Breakfast
  meal({
    id: 'b-idli-sambar', slot: 'breakfast', name: 'Idli with sambar',
    aliases: ['idli', 'idly', 'sambar', 'sambhar', 'tiffin', 'south indian breakfast', 'इडली', 'सांबर'],
    regions: ['south'], patterns: ALL,
    components: [
      veg('Sambar vegetables, with cucumber or tomato on the side'),
      dal('Sambar dal'),
      { name: 'Idli', group: 'grains', measure: 'quarterPlate', aliases: ['idli', 'rice', 'urad'] },
      { name: 'Coconut chutney', group: 'fats', aliases: ['coconut', 'nariyal', 'chutney'] },
    ],
    claimIds: ['fd-plate-method', 'fd-combination', 'fd-fermented'],
    swaps: ['fd-whole-grains', 'fd-veg-in-dishes'],
    salt: ['salt-limit'],
  }),
  meal({
    id: 'b-dosa-sambar', slot: 'breakfast', name: 'Plain dosa with sambar',
    aliases: ['dosa', 'dosai', 'plain dosa', 'masala dosa', 'sambar', 'sambhar', 'डोसा', 'सांबर'],
    regions: ['south'], patterns: ALL,
    components: [
      veg('Sambar vegetables, with cucumber or tomato on the side'),
      dal('Sambar dal'),
      { name: 'Plain dosa', group: 'grains', measure: 'quarterPlate', aliases: ['dosa', 'rice', 'urad'] },
      { name: 'Coconut chutney', group: 'fats', aliases: ['coconut', 'nariyal', 'chutney'] },
    ],
    claimIds: ['fd-plate-method', 'fd-fermented'],
    swaps: ['fd-starchy', 'fd-oil'],
    salt: ['salt-limit'],
  }),
  meal({
    id: 'b-poha', slot: 'breakfast', name: 'Vegetable poha',
    aliases: ['poha', 'pohe', 'aval', 'kanda poha', 'flattened rice', 'beaten rice', 'पोहा'],
    regions: ['west'], patterns: ALL,
    components: [
      veg('Onion, tomato and other vegetables mixed in'),
      { name: 'Poha', group: 'grains', measure: 'quarterPlate', aliases: ['poha', 'rice', 'पोहा'] },
      { name: 'Cooked sprouts or roasted chana on the side', group: 'pulses', measure: 'quarterPlate', aliases: ['sprouts', 'chana', 'channa', 'moong', 'अंकुरित', 'चना'] },
      { name: 'A few peanuts', group: 'nutsSeeds', aliases: ['peanut', 'peanuts', 'groundnut', 'moongphali', 'nuts', 'मूंगफली', 'मूँगफली'] },
    ],
    claimIds: ['fd-plate-method', 'fd-veg-in-dishes', 'food-safety-sprouts'],
    swaps: ['fd-starchy'],
    salt: ['salt-limit'],
    sugar: ['fd-added-sugar'],
  }),
  meal({
    id: 'b-upma', slot: 'breakfast', name: 'Vegetable upma',
    aliases: ['upma', 'uppittu', 'rava upma', 'sooji', 'suji', 'semolina', 'उपमा'],
    regions: ['south', 'west'], patterns: ALL,
    components: [
      veg('Beans, carrot, onion and other vegetables cooked in'),
      { name: 'Upma', group: 'grains', measure: 'quarterPlate', aliases: ['upma', 'rava', 'sooji', 'wheat', 'gluten', 'उपमा'] },
      dal('Sambar or dal on the side'),
      dahi('Dahi (curd), if you like'),
    ],
    claimIds: ['fd-plate-method', 'fd-veg-in-dishes', 'fd-cereal-pulse'],
    swaps: ['fd-whole-grains'],
    salt: ['salt-limit'],
  }),
  meal({
    id: 'b-moong-chilla', slot: 'breakfast', name: 'Moong dal chilla',
    aliases: ['chilla', 'cheela', 'moong dal chilla', 'pesarattu', 'moong', 'dal', 'चीला', 'चिल्ला'],
    regions: ['north'], patterns: ALL,
    components: [
      veg('Onion, tomato and palak in the batter, and a salad'),
      dal('Moong dal chilla'),
      { name: 'Mint chutney', group: 'vegetables', aliases: ['pudina', 'mint', 'chutney'] },
      dahi(),
    ],
    claimIds: ['fd-plate-method', 'fd-legumes-carbs', 'fd-veg-in-dishes', 'fd-plant-protein'],
    swaps: ['fd-variety'],
    salt: ['salt-limit'],
  }),
  meal({
    id: 'b-dalia', slot: 'breakfast', name: 'Vegetable dalia with moong',
    aliases: ['dalia', 'daliya', 'broken wheat', 'cracked wheat', 'khichdi', 'दलिया'],
    regions: ['north'], patterns: ALL,
    components: [
      veg('Vegetables cooked in, and a salad'),
      dal('Moong dal, cooked in'),
      { name: 'Dalia (broken wheat)', group: 'grains', measure: 'quarterPlate', aliases: ['dalia', 'wheat', 'gluten'] },
    ],
    claimIds: ['fd-plate-method', 'fd-combination', 'fd-cereal-pulse'],
    swaps: ['fd-whole-grains'],
    salt: ['salt-limit'],
    sugar: ['fd-added-sugar'],
  }),
  meal({
    id: 'b-egg-bhurji', slot: 'breakfast', name: 'Egg bhurji with roti',
    aliases: ['egg', 'eggs', 'anda', 'bhurji', 'anda bhurji', 'scrambled egg', 'roti', 'अंडा', 'भुर्जी'],
    regions: ['north'], patterns: WITH_EGGS,
    components: [
      veg('Salad, or more vegetables'),
      { name: 'Egg bhurji with onion, tomato and palak', group: 'eggsMeatFish', measure: 'quarterPlate', aliases: ['egg', 'eggs', 'anda'] },
      roti(),
    ],
    claimIds: ['fd-plate-method', 'b12-sources'],
    swaps: ['fd-whole-grains', 'fd-oil'],
    salt: ['salt-limit'],
  }),

  // Lunch
  meal({
    id: 'l-roti-dal-sabzi', slot: 'lunch', name: 'Roti, dal and sabzi',
    aliases: ['roti', 'chapati', 'chapathi', 'phulka', 'dal', 'daal', 'sabzi', 'sabji', 'subzi', 'thali', 'थाली'],
    regions: ['north'], patterns: ALL,
    components: [
      veg('Sabzi and salad — bhindi, lauki, gobhi or palak, with kheera and tomato'),
      dal(),
      roti(),
      dahi(),
    ],
    claimIds: ['fd-plate-method', 'fd-cereal-pulse', 'fd-healthy-meal'],
    swaps: ['fd-whole-grains', 'fd-variety'],
    salt: ['salt-limit', 'salt-hidden-indian'],
  }),
  meal({
    id: 'l-rice-sambar-poriyal', slot: 'lunch', name: 'Rice, sambar and poriyal',
    aliases: ['rice', 'chawal', 'sambar', 'sambhar', 'poriyal', 'thoran', 'kootu', 'rasam', 'meals'],
    regions: ['south'], patterns: ALL,
    components: [
      veg('Poriyal and a kosambari-style salad'),
      dal('Sambar dal'),
      rice('Rice, or a millet such as foxtail millet'),
      dahi('Curd (thayir)'),
    ],
    claimIds: ['fd-plate-method', 'fd-cereal-pulse'],
    swaps: ['fd-portion-refined', 'fd-whole-grains'],
    salt: ['salt-limit', 'salt-hidden-indian'],
  }),
  meal({
    id: 'l-rajma-rice', slot: 'lunch', name: 'Rajma with rice',
    aliases: ['rajma', 'rajmah', 'rajma chawal', 'kidney beans', 'rice', 'chawal', 'राजमा'],
    regions: ['north'], patterns: ALL,
    components: [
      veg('Salad and a vegetable side'),
      { name: 'Rajma', group: 'pulses', measure: 'quarterPlate', aliases: ['rajma', 'kidney beans', 'beans', 'राजमा'] },
      rice(),
      dahi('Dahi or raita'),
    ],
    claimIds: ['fd-plate-method', 'fd-legumes-carbs', 'fd-cereal-pulse'],
    swaps: ['fd-portion-refined', 'fd-whole-grains'],
    salt: ['salt-baking-soda', 'salt-limit'],
  }),
  meal({
    id: 'l-chana-roti', slot: 'lunch', name: 'Chana masala with roti',
    aliases: ['chana', 'chole', 'chhole', 'chickpeas', 'kabuli chana', 'kala chana', 'roti', 'चना', 'छोले'],
    regions: ['north'], patterns: ALL,
    components: [
      veg('Salad and a vegetable side'),
      { name: 'Chana masala', group: 'pulses', measure: 'quarterPlate', aliases: ['chana', 'channa', 'chole', 'chhole', 'chickpeas', 'चना', 'छोले'] },
      roti(),
    ],
    claimIds: ['fd-plate-method', 'fd-legumes-carbs'],
    swaps: ['fd-whole-grains', 'fd-variety'],
    salt: ['salt-baking-soda', 'salt-limit'],
  }),
  meal({
    id: 'l-palak-paneer', slot: 'lunch', name: 'Palak paneer with roti',
    aliases: ['paneer', 'palak paneer', 'saag paneer', 'cottage cheese', 'palak', 'spinach', 'roti'],
    regions: ['north'], patterns: WITH_DAIRY,
    components: [
      veg('Palak gravy and a salad'),
      { name: 'Paneer', group: 'dairy', measure: 'quarterPlate', aliases: ['paneer', 'panner', 'panir', 'cheese', 'cottage cheese', 'पनीर', ...DAIRY] },
      roti(),
    ],
    claimIds: ['fd-plate-method', 'b12-sources'],
    swaps: ['fd-oil'],
    salt: ['salt-limit'],
  }),
  meal({
    id: 'l-fish-curry-rice', slot: 'lunch', name: 'Fish curry with rice',
    aliases: ['fish', 'machli', 'macher jhol', 'meen curry', 'fish curry', 'rice', 'chawal', 'मछली'],
    regions: ['east', 'south'], patterns: NON_VEG,
    components: [
      veg('A vegetable side and salad'),
      { name: 'Fish curry', group: 'eggsMeatFish', measure: 'quarterPlate', aliases: ['fish', 'machli', 'machhli', 'seafood', 'मछली'] },
      rice(),
    ],
    claimIds: ['fd-plate-method', 'd-foods', 'b12-sources'],
    swaps: ['fd-portion-refined', 'fd-cooking'],
    salt: ['salt-limit'],
  }),
  meal({
    id: 'l-chicken-roti', slot: 'lunch', name: 'Chicken curry with roti',
    aliases: ['chicken', 'murgh', 'murga', 'murgi', 'chicken curry', 'roti', 'चिकन', 'मुर्ग', 'मुर्गा'],
    regions: ['north'], patterns: NON_VEG,
    components: [
      veg('Salad and a vegetable side'),
      { name: 'Chicken curry', group: 'eggsMeatFish', measure: 'quarterPlate', aliases: ['chicken', 'murgh', 'murga', 'murgi', 'meat'] },
      roti(),
    ],
    claimIds: ['fd-plate-method', 'b12-sources'],
    swaps: ['fd-oil', 'fd-whole-grains'],
    salt: ['salt-limit'],
  }),

  // Snacks
  meal({
    id: 's-roasted-chana', slot: 'snack', name: 'Roasted chana',
    aliases: ['chana', 'bhuna chana', 'roasted gram', 'chickpeas'],
    patterns: ALL,
    components: [{ name: 'Roasted chana', group: 'pulses', aliases: ['chana', 'channa', 'gram', 'chickpeas'] }],
    claimIds: ['fd-healthy-snacks'],
    salt: ['salt-limit'],
  }),
  meal({
    id: 's-sprouts-chaat', slot: 'snack', name: 'Cooked sprouts chaat',
    aliases: ['sprouts', 'ankurit', 'moong sprouts', 'chaat', 'salad', 'अंकुरित', 'चाट'],
    patterns: ALL,
    components: [
      { name: 'Cooked moong sprouts', group: 'pulses', aliases: ['sprouts', 'moong', 'dal', 'अंकुरित', 'मूंग'] },
      { name: 'Onion, tomato and cucumber with lemon', group: 'vegetables', aliases: ['vegetables', 'salad'] },
    ],
    claimIds: ['fd-healthy-snacks', 'fd-fermented', 'food-safety-sprouts'],
    salt: ['salt-limit'],
  }),
  meal({
    id: 's-fruit', slot: 'snack', name: 'A serving of fruit',
    aliases: ['fruit', 'phal', 'guava', 'amrood', 'apple', 'orange', 'papaya', 'फल', 'अमरूद'],
    patterns: ALL,
    components: [{ name: 'Whole fruit, such as guava, orange, apple or papaya', group: 'fruit', measure: 'fruitKatori', aliases: ['fruit'] }],
    claimIds: ['fd-fruit-whole'],
    sugar: ['fd-water-first'],
  }),
  meal({
    id: 's-salad-seeds', slot: 'snack', name: 'Salad with seeds',
    aliases: ['salad', 'kachumber', 'seeds', 'सलाद'],
    patterns: ALL,
    components: [
      { name: 'Cucumber, tomato, carrot and onion', group: 'vegetables', aliases: ['vegetables', 'salad'] },
      { name: 'A few seeds or nuts', group: 'nutsSeeds', aliases: ['seeds', 'nuts', 'peanuts', 'flaxseed', 'alsi', 'मूंगफली'] },
      { name: 'Curd on top, if you like', group: 'dairy', aliases: [...DAIRY, 'raita'], notFor: ['vegan'] },
    ],
    claimIds: ['fd-healthy-snacks'],
  }),
  meal({
    id: 's-chaas', slot: 'snack', name: 'Chaas',
    aliases: ['chaas', 'chhachh', 'buttermilk', 'mattha', 'majjige', 'mor', 'छाछ', 'मट्ठा'],
    patterns: WITH_DAIRY,
    components: [{ name: 'Chaas', group: 'dairy', aliases: ['buttermilk', ...DAIRY] }],
    claimIds: ['water-hot-weather'],
    salt: ['salt-limit'],
  }),
  meal({
    id: 's-boiled-egg', slot: 'snack', name: 'Boiled egg',
    aliases: ['egg', 'eggs', 'anda', 'boiled egg', 'ubla anda', 'अंडा'],
    patterns: WITH_EGGS,
    components: [{ name: 'Boiled egg', group: 'eggsMeatFish', aliases: ['egg', 'eggs', 'anda'] }],
    claimIds: ['b12-sources', 'd-foods'],
  }),

  // Dinner
  meal({
    id: 'd-khichdi', slot: 'dinner', name: 'Moong dal khichdi',
    aliases: ['khichdi', 'khichri', 'kichdi', 'moong dal', 'dal', 'rice', 'pongal', 'खिचड़ी'],
    patterns: ALL,
    components: [
      veg('Vegetables cooked in, and a sabzi on the side'),
      dal('Moong dal'),
      rice('Rice or millet, cooked with the dal'),
      dahi(),
    ],
    claimIds: ['fd-plate-method', 'fd-combination', 'fd-cereal-pulse', 'fd-veg-in-dishes'],
    swaps: ['fd-whole-grains'],
    salt: ['salt-limit'],
  }),
  meal({
    id: 'd-millet-roti-dal', slot: 'dinner', name: 'Jowar roti, dal and sabzi',
    aliases: ['jowar', 'jowar roti', 'bhakri', 'bajra', 'bajra roti', 'ragi', 'millet', 'dal', 'sabzi', 'roti', 'ज्वार', 'बाजरा', 'रागी'],
    regions: ['west', 'north'], patterns: ALL,
    components: [
      veg('Sabzi and salad'),
      dal(),
      { name: 'Jowar or bajra roti', group: 'grains', measure: 'quarterPlate', aliases: ['jowar', 'bajra', 'bhakri', 'millet', 'roti'] },
    ],
    claimIds: ['fd-plate-method', 'fd-whole-grains', 'fd-cereal-pulse'],
    swaps: ['fd-variety'],
    salt: ['salt-limit', 'salt-hidden-indian'],
  }),
  meal({
    id: 'd-dal-bhat', slot: 'dinner', name: 'Dal, rice and tarkari',
    aliases: ['dal bhat', 'dal chawal', 'bhat', 'tarkari', 'dalma', 'dal', 'rice', 'दाल चावल'],
    regions: ['east'], patterns: ALL,
    components: [
      veg('Tarkari (vegetable curry) and salad'),
      dal(),
      rice(),
    ],
    claimIds: ['fd-plate-method', 'fd-cereal-pulse'],
    swaps: ['fd-portion-refined', 'fd-whole-grains'],
    salt: ['salt-limit', 'salt-hidden-indian'],
  }),
  meal({
    id: 'd-paneer-bhurji', slot: 'dinner', name: 'Paneer bhurji with roti',
    aliases: ['paneer', 'paneer bhurji', 'cottage cheese', 'roti', 'पनीर'],
    regions: ['north'], patterns: WITH_DAIRY,
    components: [
      veg('Salad and a vegetable side'),
      { name: 'Paneer bhurji with onion and tomato', group: 'dairy', measure: 'quarterPlate', aliases: ['paneer', 'panner', 'panir', 'cheese', 'cottage cheese', ...DAIRY] },
      roti(),
    ],
    claimIds: ['fd-plate-method', 'b12-sources'],
    swaps: ['fd-oil'],
    salt: ['salt-limit'],
  }),
  meal({
    id: 'd-egg-curry', slot: 'dinner', name: 'Egg curry with roti',
    aliases: ['egg curry', 'anda curry', 'egg', 'eggs', 'anda', 'roti', 'अंडा करी'],
    patterns: WITH_EGGS,
    components: [
      veg('Salad and a vegetable side'),
      { name: 'Egg curry', group: 'eggsMeatFish', measure: 'quarterPlate', aliases: ['egg', 'eggs', 'anda'] },
      roti(),
    ],
    claimIds: ['fd-plate-method', 'b12-sources', 'd-foods'],
    swaps: ['fd-whole-grains', 'fd-oil'],
    salt: ['salt-limit'],
  }),
  meal({
    id: 'd-chicken-stew', slot: 'dinner', name: 'Chicken stew with rice',
    aliases: ['chicken', 'murga', 'murgi', 'stew', 'ishtu', 'chicken stew', 'rice', 'चिकन', 'मुर्गा'],
    regions: ['south'], patterns: NON_VEG,
    components: [
      veg('Vegetables in the stew, and a salad'),
      { name: 'Chicken', group: 'eggsMeatFish', measure: 'quarterPlate', aliases: ['chicken', 'meat'] },
      rice(),
    ],
    claimIds: ['fd-plate-method', 'fd-cooking'],
    swaps: ['fd-portion-refined'],
    salt: ['salt-limit'],
  }),
];

/** Human labels for the food groups a component belongs to. */
export const FOOD_GROUP_LABEL: Record<MealComponent['group'], string> = {
  vegetables: 'Vegetables',
  grains: 'Grains',
  pulses: 'Dal and pulses',
  dairy: 'Dairy',
  eggsMeatFish: 'Eggs, fish or meat',
  nutsSeeds: 'Nuts and seeds',
  fruit: 'Fruit',
  fats: 'Fats',
};

export const PATTERN_LABEL: Record<Pattern, string> = {
  vegetarian: 'Vegetarian',
  eggetarian: 'Vegetarian with eggs',
  nonVegetarian: 'Non-vegetarian',
  vegan: 'Vegan',
};
