/**
 * Our ingredients: what each one is called, the FDC SR Legacy record it takes
 * its values from (by exact description; extract-fdc.ts resolves the id), and
 * the tags we give it ourselves, because FDC doesn't tag allergens (journey
 * §11.6; board D96 to D100).
 */
import type { Ingredient } from '@/food/compute';

/** How far an ingredient's carbohydrate may vary from FDC's figure (D97). */
const GRAIN = 0.1;
const VEG = 0.2;
const DAIRY = 0.1;
const NONE = 0;

const i = (key: string, name: string, aliases: string[], fdc: string | null, carbVariance: number, more: Partial<Ingredient> = {}): Ingredient =>
  ({ key, name, aliases, fdc, contains: [], mayContain: [], carbVariance, ...more });

export const INGREDIENTS: Ingredient[] = [
  // Grains and flours
  i('atta', 'Whole-wheat flour (atta)', ['wheat', 'atta', 'gehun', 'गेहूं'], "Wheat flour, whole-grain (Includes foods for USDA's Food Distribution Program)", GRAIN, { contains: ['wheat'] }),
  i('rice-raw', 'White rice', ['rice', 'chawal', 'चावल'], 'Rice, white, long-grain, regular, raw, unenriched', GRAIN),
  i('rice-cooked', 'Cooked white rice', ['rice', 'chawal', 'bhat', 'चावल'], 'Rice, white, long-grain, regular, unenriched, cooked without salt', GRAIN),
  i('poha', 'Flattened rice (poha)', ['poha', 'aval', 'flattened rice', 'beaten rice'], 'Rice, white, long-grain, regular, raw, unenriched', GRAIN,
    { proxy: 'FDC has no flattened rice. Poha is rice pressed flat, so raw white rice stands in.' }),
  i('semolina', 'Semolina (rava, sooji)', ['semolina', 'rava', 'sooji', 'suji'], 'Semolina, enriched', GRAIN, { contains: ['wheat'] }),
  i('bulgur', 'Broken wheat (dalia)', ['dalia', 'broken wheat', 'cracked wheat', 'wheat'], 'Bulgur, dry', GRAIN,
    { contains: ['wheat'], proxy: 'FDC has no Indian dalia. Bulgur is cracked wheat from the same grain.' }),
  i('jowar-flour', 'Jowar flour', ['jowar', 'sorghum', 'ज्वार'], 'Sorghum flour, whole-grain', GRAIN),
  // Dals and pulses
  i('urad-dal', 'Urad dal', ['urad', 'udad', 'black gram', 'उड़द'], 'Mungo beans, mature seeds, raw', GRAIN),
  i('toor-dal', 'Toor dal', ['toor', 'tuvar', 'arhar', 'pigeon pea', 'dal', 'अरहर'], 'Pigeon peas (red gram), mature seeds, raw', GRAIN),
  i('moong-dal', 'Moong dal', ['moong', 'mung', 'green gram', 'dal', 'मूंग'], 'Mung beans, mature seeds, raw', GRAIN),
  i('chana', 'Kabuli chana', ['chana', 'chole', 'chickpea', 'garbanzo', 'छोले'], 'Chickpeas (garbanzo beans, bengal gram), mature seeds, raw', GRAIN),
  i('rajma', 'Rajma', ['rajma', 'kidney bean', 'राजमा'], 'Beans, kidney, red, mature seeds, raw', GRAIN),
  i('roasted-chana', 'Roasted chana', ['roasted chana', 'bhuna chana', 'roasted gram', 'chickpea'], 'Chickpeas (garbanzo beans, bengal gram), mature seeds, raw', GRAIN,
    { proxy: 'FDC has no roasted chickpeas. Dry chickpeas, close in water and starch, stand in.' }),
  i('moong-sprouts', 'Boiled moong sprouts', ['sprouts', 'moong sprouts', 'ankurit', 'अंकुरित'], 'Mung beans, mature seeds, sprouted, cooked, boiled, drained, without salt', VEG),
  // Vegetables, herbs and fruit
  i('onion', 'Onion', ['onion', 'pyaz', 'kanda', 'प्याज'], 'Onions, raw', VEG, { root: true }),
  i('tomato', 'Tomato', ['tomato', 'tamatar', 'टमाटर'], 'Tomatoes, red, ripe, raw, year round average', VEG),
  i('potato', 'Potato', ['potato', 'aloo', 'आलू'], 'Potatoes, flesh and skin, raw', VEG, { root: true }),
  i('potato-boiled', 'Boiled potato', ['potato', 'aloo', 'आलू'], 'Potatoes, boiled, cooked without skin, flesh, without salt', VEG, { root: true }),
  i('spinach', 'Spinach (palak)', ['spinach', 'palak', 'पालक'], 'Spinach, raw', VEG),
  i('cauliflower', 'Cauliflower (gobhi)', ['cauliflower', 'gobhi', 'gobi', 'गोभी'], 'Cauliflower, raw', VEG),
  i('okra', 'Okra (bhindi)', ['okra', 'bhindi', 'ladies finger', 'भिंडी'], 'Okra, raw', VEG),
  i('carrot', 'Carrot', ['carrot', 'gajar', 'गाजर'], 'Carrots, raw', VEG, { root: true }),
  i('green-beans', 'Green beans', ['beans', 'french beans', 'phali'], 'Beans, snap, green, raw', VEG),
  i('green-peas', 'Green peas (matar)', ['peas', 'matar', 'मटर'], 'Peas, green, raw', VEG),
  i('cucumber', 'Cucumber (kheera)', ['cucumber', 'kheera', 'खीरा'], 'Cucumber, with peel, raw', VEG),
  i('drumstick', 'Drumstick (moringa pods)', ['drumstick', 'moringa', 'sahjan'], 'Drumstick pods, raw', VEG),
  i('lauki', 'Bottle gourd (lauki)', ['lauki', 'bottle gourd', 'doodhi', 'ghiya', 'लौकी'], 'Gourd, white-flowered (calabash), raw', VEG),
  i('coriander-leaves', 'Coriander leaves', ['coriander', 'dhania', 'cilantro', 'धनिया'], 'Coriander (cilantro) leaves, raw', VEG),
  i('mint', 'Mint (pudina)', ['mint', 'pudina', 'पुदीना'], 'Spearmint, fresh', VEG),
  i('lemon-juice', 'Lemon juice', ['lemon', 'nimbu', 'नींबू'], 'Lemon juice, raw', VEG),
  i('tamarind', 'Tamarind', ['tamarind', 'imli', 'इमली'], 'Tamarinds, raw', VEG),
  i('banana', 'Banana', ['banana', 'kela', 'केला'], 'Bananas, raw', VEG),
  i('guava', 'Guava', ['guava', 'amrood', 'अमरूद'], 'Guavas, common, raw', VEG),
  // Seasonings: at most 2 g a serving, so not counted (D96)
  i('ginger', 'Ginger', ['ginger', 'adrak', 'अदरक'], null, NONE, { root: true }),
  i('garlic', 'Garlic', ['garlic', 'lahsun', 'लहसुन'], null, NONE, { root: true }),
  i('green-chilli', 'Green chilli', ['green chilli', 'mirch', 'हरी मिर्च'], null, NONE),
  i('curry-leaves', 'Curry leaves', ['curry leaves', 'kadi patta', 'कढ़ी पत्ता'], null, NONE),
  i('mustard-seeds', 'Mustard seeds (rai)', ['mustard', 'rai', 'sarson', 'राई'], null, NONE, { contains: ['mustard'] }),
  i('cumin', 'Cumin (jeera)', ['cumin', 'jeera', 'जीरा'], null, NONE),
  i('turmeric', 'Turmeric (haldi)', ['turmeric', 'haldi', 'हल्दी'], null, NONE),
  // Chilli and coriander powder are each one ground spice, so each is named by what it is (K7-02).
  i('chilli-powder', 'Red chilli powder', ['chilli powder', 'lal mirch'], null, NONE),
  i('coriander-powder', 'Coriander powder', ['coriander powder', 'dhania powder'], null, NONE),
  // Compounded hing is usually cut with wheat flour (D99), and may be cut with rice flour and a gum instead:
  // a blend, so a dish with it isn't matched against a custom allergy's words (K7-02).
  i('hing', 'Hing (asafoetida)', ['hing', 'asafoetida', 'हींग'], null, NONE, { mayContain: ['wheat'], blend: true }),
  i('salt', 'Salt', ['salt', 'namak', 'नमक'], null, NONE),
  i('water', 'Water', [], null, NONE, { water: true }),
  // Fats, nuts and coconut. Recipes assume sunflower oil (D99). Coconut isn't a canonical allergen: a coconut allergy matches its words.
  i('oil', 'Sunflower oil', ['oil', 'sunflower oil', 'tel'], 'Oil, sunflower, linoleic, (approx. 65%)', NONE),
  i('ghee', 'Ghee', ['ghee', 'clarified butter', 'घी'], 'Butter oil, anhydrous', NONE, { contains: ['milk'], animal: 'dairy' }),
  i('coconut', 'Grated coconut', ['coconut', 'nariyal', 'नारियल'], 'Nuts, coconut meat, raw', VEG),
  i('coconut-milk', 'Coconut milk', ['coconut milk', 'coconut', 'nariyal'], 'Nuts, coconut milk, raw (liquid expressed from grated meat and water)', VEG),
  i('peanuts', 'Peanuts', ['peanut', 'groundnut', 'moongphali', 'मूंगफली'], 'Peanuts, all types, raw', GRAIN, { contains: ['peanut'] }),
  i('peanuts-roasted', 'Dry-roasted peanuts', ['peanut', 'groundnut', 'moongphali', 'मूंगफली'], 'Peanuts, all types, dry-roasted, without salt', GRAIN, { contains: ['peanut'] }),
  // Dairy, eggs, fish and meat
  i('milk', 'Whole milk', ['milk', 'doodh', 'दूध'], 'Milk, whole, 3.25% milkfat, with added vitamin D', DAIRY, { contains: ['milk'], animal: 'dairy' }),
  i('curd', 'Curd (dahi)', ['curd', 'dahi', 'yogurt', 'दही'], 'Yogurt, plain, whole milk', DAIRY, { contains: ['milk'], animal: 'dairy' }),
  i('paneer', 'Paneer', ['paneer', 'cottage cheese', 'cheese', 'पनीर'], 'Cheese, fresh, queso fresco', DAIRY,
    { contains: ['milk'], animal: 'dairy', proxy: 'FDC has no paneer. Queso fresco, a fresh unripened cheese close in fat and protein, stands in.' }),
  i('egg', 'Egg', ['egg', 'anda', 'अंडा'], 'Egg, whole, raw, fresh', DAIRY, { contains: ['egg'], animal: 'egg' }),
  i('egg-boiled', 'Boiled egg', ['egg', 'anda', 'अंडा'], 'Egg, whole, cooked, hard-boiled', DAIRY, { contains: ['egg'], animal: 'egg' }),
  i('chicken', 'Chicken (thigh)', ['chicken', 'murgh', 'चिकन'], 'Chicken, broilers or fryers, dark meat, thigh, meat only, raw', NONE, { animal: 'meat' }),
  i('fish', 'Fish (rohu or another carp)', ['fish', 'rohu', 'carp', 'machli', 'मछली'], 'Fish, carp, raw', NONE, { contains: ['fish'], animal: 'fish' }),
  // Drinks and sugar
  i('sugar', 'Sugar', ['sugar', 'cheeni', 'चीनी'], 'Sugars, granulated', NONE),
  i('tea', 'Brewed tea', ['tea', 'chai', 'चाय'], 'Beverages, tea, black, brewed, prepared with tap water', NONE),
];
