/**
 * What each meal idea's components are, as dishes in the food table (journey
 * §11.1, B-13). The ideas stay v1's plate-method templates; this map lets the
 * one filter, `mealsFor`, know their allergens and whether a Jain plate suits
 * them. An "or" component lists every dish it could be, so its tags are the
 * union. A component no dish in the table is says what it may carry, and that
 * its make-up isn't established. Every food a component names is in one of
 * its dishes or in its `also`, which mealDishes.node.test.ts checks against
 * the names it says (H7-02).
 */
import type { AllergenId } from '@/types/profile';

export interface ComponentFoods {
  dishes: readonly string[];
  /** Ingredients it names that none of its dishes holds ("lauki or palak"), by key: their names and tags count too. */
  also?: readonly string[];
  mayContain?: readonly AllergenId[];
  /**
   * Its make-up isn't established ("a few seeds or nuts" names none): the idea
   * isn't fully tagged, whatever `mayContain` says, so it's kept from anyone
   * with an allergy until its contents are known (B-13, H7-03).
   */
  unknown?: true;
  /**
   * How a vegan plate makes its dishes: ingredients in place of their own, by
   * key (ghee → sunflower oil). Its dishes' tags and patterns are read as so
   * made, and the idea says so (H7-20).
   */
  vegan?: Readonly<Record<string, string>>;
}

export const componentKey = (mealId: string, componentName: string) => `${mealId}|${componentName}`;

const SALAD = 'cucumber-tomato-salad';
/** A vegan plate's dal, khichdi and dalia take sunflower oil where our recipe has ghee. */
const OIL: ComponentFoods['vegan'] = { ghee: 'oil' };
const SIDE: ComponentFoods = { dishes: [SALAD, 'mixed-veg-sabzi'] };
const ROTI: ComponentFoods = { dishes: ['roti', 'jowar-roti'] };

export const MEAL_DISHES: Readonly<Record<string, ComponentFoods>> = {
  // Breakfast
  'b-idli-sambar|Sambar vegetables, with cucumber or tomato on the side': { dishes: ['sambar', SALAD] },
  'b-idli-sambar|Sambar dal': { dishes: ['sambar'] },
  'b-idli-sambar|Idli': { dishes: ['idli'] },
  'b-idli-sambar|Coconut chutney': { dishes: ['coconut-chutney'] },
  'b-dosa-sambar|Sambar vegetables, with cucumber or tomato on the side': { dishes: ['sambar', SALAD] },
  'b-dosa-sambar|Sambar dal': { dishes: ['sambar'] },
  'b-dosa-sambar|Plain dosa': { dishes: ['plain-dosa'] },
  'b-dosa-sambar|Coconut chutney': { dishes: ['coconut-chutney'] },
  'b-poha|Onion, tomato and other vegetables mixed in': { dishes: ['poha'], also: ['tomato'] },
  'b-poha|Poha': { dishes: ['poha'] },
  'b-poha|Cooked sprouts or roasted chana on the side': { dishes: ['sprouts-chaat', 'roasted-chana'] },
  'b-poha|A few peanuts': { dishes: ['roasted-peanuts'] },
  'b-upma|Beans, carrot, onion and other vegetables cooked in': { dishes: ['upma'] },
  'b-upma|Upma': { dishes: ['upma'] },
  'b-upma|Sambar or dal on the side': { dishes: ['sambar', 'toor-dal'], vegan: OIL },
  'b-upma|Dahi (curd), if you like': { dishes: ['dahi'] },
  'b-moong-chilla|Onion, tomato and palak in the batter, and a salad': { dishes: ['moong-dal-chilla', SALAD] },
  'b-moong-chilla|Moong dal chilla': { dishes: ['moong-dal-chilla'] },
  'b-moong-chilla|Mint chutney': { dishes: ['mint-chutney'] },
  'b-moong-chilla|Dahi (curd)': { dishes: ['dahi'] },
  'b-dalia|Vegetables cooked in, and a salad': { dishes: ['vegetable-dalia', SALAD], vegan: OIL },
  'b-dalia|Moong dal, cooked in': { dishes: ['vegetable-dalia'], vegan: OIL },
  'b-dalia|Dalia (broken wheat)': { dishes: ['vegetable-dalia'], vegan: OIL },
  'b-egg-bhurji|Salad, or more vegetables': SIDE,
  'b-egg-bhurji|Egg bhurji with onion, tomato and palak': { dishes: ['egg-bhurji'] },
  'b-egg-bhurji|Whole-wheat or millet roti': ROTI,
  // Lunch
  'l-roti-dal-sabzi|Sabzi and salad — bhindi, lauki, gobhi or palak, with kheera and tomato': { dishes: ['mixed-veg-sabzi', 'bhindi-sabzi', SALAD], also: ['lauki', 'spinach'] },
  'l-roti-dal-sabzi|Dal': { dishes: ['toor-dal'], vegan: OIL },
  'l-roti-dal-sabzi|Whole-wheat or millet roti': ROTI,
  'l-roti-dal-sabzi|Dahi (curd)': { dishes: ['dahi'] },
  'l-rice-sambar-poriyal|Poriyal and a kosambari-style salad': { dishes: ['poriyal', SALAD] },
  'l-rice-sambar-poriyal|Sambar dal': { dishes: ['sambar'] },
  'l-rice-sambar-poriyal|Rice, or a millet such as foxtail millet': { dishes: ['rice'] },
  'l-rice-sambar-poriyal|Curd (thayir)': { dishes: ['dahi'] },
  'l-rajma-rice|Salad and a vegetable side': SIDE,
  'l-rajma-rice|Rajma': { dishes: ['rajma'] },
  'l-rajma-rice|Rice': { dishes: ['rice'] },
  'l-rajma-rice|Dahi or raita': { dishes: ['dahi', 'raita'] },
  'l-chana-roti|Salad and a vegetable side': SIDE,
  'l-chana-roti|Chana masala': { dishes: ['chana-masala'] },
  'l-chana-roti|Whole-wheat or millet roti': ROTI,
  'l-palak-paneer|Palak gravy and a salad': { dishes: ['palak-paneer', SALAD] },
  'l-palak-paneer|Paneer': { dishes: ['palak-paneer'] },
  'l-palak-paneer|Whole-wheat or millet roti': ROTI,
  'l-fish-curry-rice|A vegetable side and salad': SIDE,
  'l-fish-curry-rice|Fish curry': { dishes: ['fish-curry'] },
  'l-fish-curry-rice|Rice': { dishes: ['rice'] },
  'l-chicken-roti|Salad and a vegetable side': SIDE,
  'l-chicken-roti|Chicken curry': { dishes: ['chicken-curry'] },
  'l-chicken-roti|Whole-wheat or millet roti': ROTI,
  // Snacks
  's-roasted-chana|Roasted chana': { dishes: ['roasted-chana'] },
  's-sprouts-chaat|Cooked moong sprouts': { dishes: ['sprouts-chaat'] },
  's-sprouts-chaat|Onion, tomato and cucumber with lemon': { dishes: ['sprouts-chaat'], also: ['onion'] },
  's-fruit|Whole fruit, such as guava, orange, apple or papaya': { dishes: ['guava'] },
  's-salad-seeds|Cucumber, tomato, carrot and onion': { dishes: [SALAD], also: ['carrot', 'onion'] },
  's-salad-seeds|A few seeds or nuts': { dishes: [], mayContain: ['peanut', 'treeNut', 'sesame'], unknown: true },
  's-salad-seeds|Curd on top, if you like': { dishes: ['dahi'] },
  's-chaas|Chaas': { dishes: ['chaas'] },
  's-boiled-egg|Boiled egg': { dishes: ['boiled-egg'] },
  // Dinner
  'd-khichdi|Vegetables cooked in, and a sabzi on the side': { dishes: ['moong-dal-khichdi', 'mixed-veg-sabzi'], vegan: OIL },
  'd-khichdi|Moong dal': { dishes: ['moong-dal-khichdi'], vegan: OIL },
  'd-khichdi|Rice or millet, cooked with the dal': { dishes: ['moong-dal-khichdi'], vegan: OIL },
  'd-khichdi|Dahi (curd)': { dishes: ['dahi'] },
  'd-millet-roti-dal|Sabzi and salad': SIDE,
  'd-millet-roti-dal|Dal': { dishes: ['toor-dal'], vegan: OIL },
  // Bajra roti is made as jowar roti is (millet flour and water), with no allergen of its own.
  'd-millet-roti-dal|Jowar or bajra roti': { dishes: ['jowar-roti'] },
  'd-dal-bhat|Tarkari (vegetable curry) and salad': SIDE,
  'd-dal-bhat|Dal': { dishes: ['toor-dal'], vegan: OIL },
  'd-dal-bhat|Rice': { dishes: ['rice'] },
  'd-paneer-bhurji|Salad and a vegetable side': SIDE,
  'd-paneer-bhurji|Paneer bhurji with onion and tomato': { dishes: ['paneer-bhurji'] },
  'd-paneer-bhurji|Whole-wheat or millet roti': ROTI,
  'd-egg-curry|Salad and a vegetable side': SIDE,
  'd-egg-curry|Egg curry': { dishes: ['egg-curry'] },
  'd-egg-curry|Whole-wheat or millet roti': ROTI,
  'd-chicken-stew|Vegetables in the stew, and a salad': { dishes: ['chicken-stew', SALAD] },
  'd-chicken-stew|Chicken': { dishes: ['chicken-stew'] },
  'd-chicken-stew|Rice': { dishes: ['rice'] },
};
