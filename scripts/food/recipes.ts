/**
 * Our own home-style recipes, one standard portion each, with sunflower oil
 * and grams per serving (journey §11.6; board D98). Change a recipe's
 * ingredients or portion and raise its `rev` (B-12): build.ts refuses
 * otherwise.
 */
import type { Recipe } from '@/food/compute';
import type { Portion } from '@/food/types';

const piece = (grams: number, noun: [string, string], count = 1): Portion => ({ unit: 'piece', grams, count, noun });
const katori = (grams: number): Portion => ({ unit: 'katori', grams, count: 1 });
const plate = (grams: number): Portion => ({ unit: 'plate', grams, count: 1 });
const glass = (grams: number): Portion => ({ unit: 'glass', grams, count: 1 });
const cup = (grams: number): Portion => ({ unit: 'cup', grams, count: 1 });
const tbsp = (count: number): Portion => ({ unit: 'tbsp', grams: 15, count });
const handful = (grams: number): Portion => ({ unit: 'handful', grams, count: 1 });

const r = (id: string, name: string, aliases: string[], shelf: Recipe['shelf'], slots: Recipe['slots'], portion: Portion, ingredients: Recipe['ingredients'], note: string): Recipe =>
  ({ id, rev: 1, name, aliases, shelf, slots, portion, yieldG: portion.count * portion.grams, ingredients, note });

export const RECIPES: Recipe[] = [
  // Roti, rice and breads
  r('roti', 'Roti (whole-wheat)', ['roti', 'chapati', 'chapatti', 'chappati', 'chapathi', 'phulka', 'fulka', 'रोटी', 'चपाती'], 'breads', ['breakfast', 'lunch', 'dinner'],
    piece(40, ['roti', 'rotis']), [['atta', 30], ['water', 18]], 'Plain phulka, no oil'),
  r('paratha', 'Plain paratha', ['paratha', 'parantha', 'prantha', 'पराठा'], 'breads', ['breakfast', 'lunch', 'dinner'],
    piece(60, ['paratha', 'parathas']), [['atta', 40], ['oil', 5], ['water', 22]], 'Home-style, 1 tsp oil'),
  r('aloo-paratha', 'Aloo paratha', ['aloo paratha', 'alu paratha', 'potato paratha', 'आलू पराठा'], 'breads', ['breakfast', 'lunch'],
    piece(110, ['paratha', 'parathas']), [['atta', 40], ['potato-boiled', 50], ['onion', 5], ['coriander-leaves', 2], ['oil', 5], ['green-chilli', 1], ['salt', 1], ['water', 15]], 'Home-style, 1 tsp oil'),
  r('jowar-roti', 'Jowar roti (bhakri)', ['jowar roti', 'jowar', 'bhakri', 'jolada rotti', 'ज्वार की रोटी'], 'breads', ['lunch', 'dinner'],
    piece(50, ['roti', 'rotis']), [['jowar-flour', 40], ['water', 20]], 'Plain, no oil'),
  r('rice', 'Steamed rice', ['rice', 'chawal', 'chaval', 'bhat', 'bhaat', 'plain rice', 'चावल', 'भात'], 'breads', ['lunch', 'dinner'],
    katori(150), [['rice-cooked', 150]], 'Plain white rice, cooked without salt'),
  // Breakfast
  r('idli', 'Idli', ['idli', 'idly', 'इडली'], 'breakfast', ['breakfast'],
    piece(40, ['idli', 'idlis'], 2), [['rice-raw', 24], ['urad-dal', 8], ['salt', 1], ['water', 48]], 'Steamed rice and urad dal batter'),
  r('plain-dosa', 'Plain dosa', ['dosa', 'dosai', 'sada dosa', 'डोसा'], 'breakfast', ['breakfast', 'dinner'],
    piece(80, ['dosa', 'dosas']), [['rice-raw', 30], ['urad-dal', 10], ['oil', 5], ['salt', 1], ['water', 40]], 'Home-style, 1 tsp oil'),
  r('poha', 'Vegetable poha', ['poha', 'pohe', 'aval', 'kanda poha', 'flattened rice', 'पोहा'], 'breakfast', ['breakfast', 'snack'],
    plate(150), [['poha', 40], ['onion', 25], ['green-peas', 10], ['peanuts', 8], ['oil', 5], ['lemon-juice', 5], ['mustard-seeds', 1], ['turmeric', 0.5], ['curry-leaves', 1], ['green-chilli', 1], ['salt', 1], ['water', 50]], 'Home-style with peanuts, 1 tsp oil'),
  r('upma', 'Vegetable upma', ['upma', 'uppittu', 'rava upma', 'sooji upma', 'उपमा'], 'breakfast', ['breakfast'],
    plate(150), [['semolina', 40], ['onion', 20], ['carrot', 15], ['green-beans', 15], ['oil', 5], ['urad-dal', 2], ['mustard-seeds', 1], ['curry-leaves', 1], ['green-chilli', 1], ['salt', 1], ['water', 60]], 'Home-style, 1 tsp oil'),
  r('vegetable-dalia', 'Vegetable dalia with moong', ['dalia', 'daliya', 'broken wheat', 'दलिया'], 'breakfast', ['breakfast', 'dinner'],
    katori(150), [['bulgur', 30], ['moong-dal', 10], ['green-peas', 15], ['green-beans', 15], ['tomato', 15], ['ghee', 3], ['cumin', 0.5], ['salt', 1], ['water', 80]], 'About ½ tsp ghee, no onion or garlic'),
  r('moong-dal-chilla', 'Moong dal chilla', ['chilla', 'cheela', 'pesarattu', 'moong chilla', 'चीला'], 'breakfast', ['breakfast', 'snack'],
    piece(80, ['chilla', 'chillas']), [['moong-dal', 35], ['onion', 10], ['tomato', 10], ['spinach', 10], ['oil', 4], ['green-chilli', 1], ['salt', 1], ['water', 15]], 'Home-style, about 1 tsp oil'),
  // Dal, khichdi and curries
  r('moong-dal-khichdi', 'Moong dal khichdi', ['khichdi', 'khichri', 'kichdi', 'pongal', 'खिचड़ी'], 'dal', ['lunch', 'dinner'],
    katori(150), [['rice-raw', 25], ['moong-dal', 15], ['green-peas', 10], ['ghee', 3], ['cumin', 0.5], ['turmeric', 0.5], ['salt', 1], ['water', 95]], 'About ½ tsp ghee, no onion or garlic'),
  r('toor-dal', 'Toor dal', ['dal', 'daal', 'dhal', 'arhar dal', 'toor', 'tuvar', 'dal tadka', 'दाल', 'अरहर'], 'dal', ['lunch', 'dinner'],
    katori(150), [['toor-dal', 30], ['tomato', 20], ['ghee', 4], ['cumin', 0.5], ['turmeric', 0.5], ['hing', 0.1], ['green-chilli', 1], ['salt', 1], ['water', 100]], 'Jeera and tomato tadka, about 1 tsp ghee, no onion or garlic'),
  r('moong-dal', 'Yellow moong dal', ['moong dal', 'mung dal', 'yellow dal', 'dal', 'मूंग दाल'], 'dal', ['lunch', 'dinner'],
    katori(150), [['moong-dal', 30], ['tomato', 15], ['ghee', 3], ['cumin', 0.5], ['turmeric', 0.5], ['salt', 1], ['water', 105]], 'About ½ tsp ghee, no onion or garlic'),
  r('sambar', 'Sambar', ['sambar', 'sambhar', 'saambar', 'सांबर'], 'dal', ['breakfast', 'lunch', 'dinner'],
    katori(150), [['toor-dal', 20], ['drumstick', 20], ['lauki', 15], ['onion', 15], ['tomato', 15], ['tamarind', 3], ['oil', 3], ['coriander-powder', 1], ['chilli-powder', 1], ['mustard-seeds', 0.5], ['hing', 0.1], ['curry-leaves', 1], ['salt', 1], ['water', 70]], 'Home-style with drumstick and lauki, about ½ tsp oil'),
  r('rajma', 'Rajma', ['rajma', 'rajmah', 'kidney beans', 'rajma masala', 'राजमा'], 'dal', ['lunch', 'dinner'],
    katori(150), [['rajma', 30], ['onion', 20], ['tomato', 30], ['oil', 4], ['ginger', 2], ['garlic', 2], ['cumin', 0.5], ['coriander-powder', 1], ['chilli-powder', 0.5], ['salt', 1], ['water', 70]], 'Home-style, about 1 tsp oil'),
  r('chana-masala', 'Chana masala', ['chana', 'chole', 'chhole', 'chickpeas', 'kabuli chana', 'छोले', 'चना'], 'dal', ['lunch', 'dinner'],
    katori(150), [['chana', 30], ['onion', 20], ['tomato', 30], ['oil', 4], ['ginger', 2], ['garlic', 2], ['cumin', 0.5], ['coriander-powder', 1], ['chilli-powder', 0.5], ['salt', 1], ['water', 70]], 'Home-style, about 1 tsp oil'),
  // Vegetables
  r('mixed-veg-sabzi', 'Mixed vegetable sabzi', ['sabzi', 'sabji', 'subzi', 'mixed veg', 'tarkari', 'सब्ज़ी', 'सब्जी'], 'veg', ['lunch', 'dinner'],
    katori(100), [['cauliflower', 40], ['green-beans', 30], ['green-peas', 20], ['tomato', 20], ['oil', 5], ['cumin', 0.5], ['turmeric', 0.5], ['coriander-powder', 1], ['salt', 1]], 'Dry sabzi, 1 tsp oil, no onion, garlic or potato'),
  r('bhindi-sabzi', 'Bhindi sabzi', ['bhindi', 'okra', 'ladies finger', 'bhindi masala', 'भिंडी'], 'veg', ['lunch', 'dinner'],
    katori(100), [['okra', 110], ['oil', 5], ['turmeric', 0.5], ['chilli-powder', 0.5], ['coriander-powder', 1], ['salt', 1]], 'Dry sabzi, 1 tsp oil, no onion'),
  r('aloo-gobhi', 'Aloo gobhi', ['aloo gobi', 'aloo gobhi', 'alu gobi', 'potato cauliflower', 'आलू गोभी'], 'veg', ['lunch', 'dinner'],
    katori(100), [['potato', 45], ['cauliflower', 50], ['onion', 10], ['tomato', 10], ['oil', 5], ['turmeric', 0.5], ['cumin', 0.5], ['chilli-powder', 0.5], ['salt', 1]], 'Dry sabzi, 1 tsp oil'),
  r('palak-paneer', 'Palak paneer', ['palak paneer', 'saag paneer', 'spinach paneer', 'पालक पनीर'], 'veg', ['lunch', 'dinner'],
    katori(150), [['spinach', 100], ['paneer', 40], ['onion', 15], ['tomato', 15], ['oil', 5], ['ginger', 2], ['garlic', 2], ['cumin', 0.5], ['salt', 1], ['water', 20]], 'Home-style, 1 tsp oil, no cream'),
  r('paneer-bhurji', 'Paneer bhurji', ['paneer bhurji', 'paneer', 'scrambled paneer', 'पनीर भुर्जी'], 'veg', ['breakfast', 'lunch', 'dinner'],
    katori(100), [['paneer', 70], ['onion', 15], ['tomato', 15], ['oil', 4], ['turmeric', 0.5], ['green-chilli', 1], ['salt', 1]], 'Home-style, about 1 tsp oil'),
  r('poriyal', 'Beans poriyal', ['poriyal', 'thoran', 'beans poriyal', 'beans thoran'], 'veg', ['lunch', 'dinner'],
    katori(100), [['green-beans', 90], ['coconut', 10], ['oil', 3], ['urad-dal', 1], ['mustard-seeds', 0.5], ['curry-leaves', 1], ['salt', 1]], 'With grated coconut, about ½ tsp oil'),
  // Curd, salads and chutneys
  r('cucumber-tomato-salad', 'Cucumber and tomato salad', ['salad', 'kachumber', 'kheera', 'cucumber', 'सलाद', 'खीरा'], 'sides', ['lunch', 'dinner', 'snack'],
    katori(100), [['cucumber', 60], ['tomato', 40], ['lemon-juice', 3], ['salt', 0.5]], 'Kheera and tomato with lemon'),
  r('dahi', 'Dahi (curd)', ['dahi', 'curd', 'yogurt', 'yoghurt', 'thayir', 'दही'], 'sides', ['breakfast', 'lunch', 'dinner', 'snack'],
    katori(100), [['curd', 100]], 'Plain, whole milk'),
  r('raita', 'Cucumber raita', ['raita', 'kheera raita', 'रायता'], 'sides', ['lunch', 'dinner'],
    katori(100), [['curd', 80], ['cucumber', 20], ['cumin', 0.5], ['salt', 0.5]], 'Whole-milk curd with cucumber'),
  r('coconut-chutney', 'Coconut chutney', ['coconut chutney', 'nariyal chutney', 'chutney', 'नारियल चटनी'], 'sides', ['breakfast'],
    tbsp(2), [['coconut', 15], ['roasted-chana', 5], ['oil', 1], ['green-chilli', 1], ['mustard-seeds', 0.3], ['curry-leaves', 0.5], ['salt', 0.5], ['water', 8]], 'With roasted chana and a mustard tadka'),
  r('mint-chutney', 'Mint chutney', ['mint chutney', 'pudina chutney', 'green chutney', 'hari chutney', 'पुदीना चटनी'], 'sides', ['breakfast', 'snack'],
    tbsp(2), [['mint', 10], ['coriander-leaves', 10], ['lemon-juice', 3], ['green-chilli', 1], ['salt', 0.5], ['water', 6]], 'Mint and coriander with lemon, no onion'),
  // Eggs, fish and chicken
  r('egg-bhurji', 'Egg bhurji', ['egg bhurji', 'anda bhurji', 'scrambled eggs', 'अंडा भुर्जी'], 'eggsMeat', ['breakfast', 'dinner'],
    katori(120), [['egg', 100], ['onion', 15], ['tomato', 15], ['spinach', 10], ['oil', 4], ['turmeric', 0.5], ['green-chilli', 1], ['salt', 1]], 'Two eggs, about 1 tsp oil'),
  r('boiled-egg', 'Boiled egg', ['boiled egg', 'egg', 'anda', 'ubla anda', 'अंडा'], 'eggsMeat', ['breakfast', 'snack'],
    piece(50, ['egg', 'eggs']), [['egg-boiled', 50]], 'One large egg'),
  r('egg-curry', 'Egg curry', ['egg curry', 'anda curry', 'अंडा करी'], 'eggsMeat', ['lunch', 'dinner'],
    katori(150), [['egg-boiled', 100], ['onion', 20], ['tomato', 30], ['oil', 5], ['ginger', 2], ['garlic', 2], ['turmeric', 0.5], ['chilli-powder', 0.5], ['coriander-powder', 1], ['salt', 1], ['water', 30]], 'Two eggs, 1 tsp oil'),
  r('fish-curry', 'Fish curry', ['fish curry', 'machli', 'macher jhol', 'meen curry', 'मछली'], 'eggsMeat', ['lunch', 'dinner'],
    katori(150), [['fish', 80], ['onion', 15], ['tomato', 20], ['oil', 5], ['ginger', 2], ['garlic', 2], ['turmeric', 0.5], ['chilli-powder', 0.5], ['salt', 1], ['water', 50]], 'Rohu or another carp, 1 tsp sunflower oil'),
  r('chicken-curry', 'Chicken curry', ['chicken curry', 'murgh', 'murga', 'chicken', 'चिकन', 'मुर्गा'], 'eggsMeat', ['lunch', 'dinner'],
    katori(150), [['chicken', 90], ['onion', 25], ['tomato', 25], ['curd', 10], ['oil', 6], ['ginger', 2], ['garlic', 2], ['turmeric', 0.5], ['chilli-powder', 0.5], ['coriander-powder', 1], ['salt', 1], ['water', 20]], 'Thigh meat in a curd marinade, about 1 tsp oil'),
  r('chicken-stew', 'Chicken stew', ['chicken stew', 'ishtu', 'kerala stew'], 'eggsMeat', ['lunch', 'dinner'],
    katori(150), [['chicken', 70], ['potato', 25], ['carrot', 10], ['onion', 15], ['coconut-milk', 40], ['oil', 3], ['ginger', 2], ['green-chilli', 1], ['curry-leaves', 0.5], ['salt', 1]], 'Kerala style, with coconut milk'),
  // Snacks
  r('roasted-chana', 'Roasted chana', ['roasted chana', 'bhuna chana', 'roasted gram', 'भुना चना'], 'snacks', ['snack'],
    handful(30), [['roasted-chana', 30]], 'Plain, unsalted'),
  r('sprouts-chaat', 'Cooked sprouts chaat', ['sprouts', 'ankurit', 'moong sprouts', 'sprouts chaat', 'अंकुरित'], 'snacks', ['breakfast', 'snack'],
    katori(100), [['moong-sprouts', 70], ['tomato', 15], ['cucumber', 15], ['lemon-juice', 3], ['cumin', 0.5], ['salt', 0.5]], 'Boiled moong sprouts, no onion'),
  r('roasted-peanuts', 'Roasted peanuts', ['peanuts', 'moongphali', 'groundnuts', 'मूंगफली'], 'snacks', ['snack'],
    handful(30), [['peanuts-roasted', 30]], 'Dry-roasted, unsalted'),
  // Drinks
  r('chaas', 'Chaas (buttermilk)', ['chaas', 'chhachh', 'buttermilk', 'mattha', 'majjige', 'mor', 'छाछ'], 'drinks', ['lunch', 'snack'],
    glass(200), [['curd', 60], ['water', 140], ['cumin', 0.5], ['salt', 0.5]], 'Thin, from whole-milk curd'),
  r('chai', 'Chai with milk and sugar', ['chai', 'tea', 'masala chai', 'चाय'], 'drinks', ['breakfast', 'snack'],
    cup(150), [['tea', 100], ['milk', 50], ['sugar', 5]], '1 tsp sugar, a third milk'),
  r('milk', 'Milk', ['milk', 'doodh', 'दूध'], 'drinks', ['breakfast', 'snack', 'dinner'],
    glass(200), [['milk', 200]], 'Whole milk'),
  // Fruit
  r('banana', 'Banana', ['banana', 'kela', 'केला'], 'fruit', ['breakfast', 'snack'],
    piece(100, ['banana', 'bananas']), [['banana', 100]], 'One medium banana, peeled'),
  r('guava', 'Guava', ['guava', 'amrood', 'amrud', 'अमरूद'], 'fruit', ['snack'],
    piece(100, ['guava', 'guavas']), [['guava', 100]], 'One medium guava'),
];
