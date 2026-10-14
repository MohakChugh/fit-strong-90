/**
 * The food table (journey §11.6):
 *   npx tsx --tsconfig tsconfig.app.json scripts/food/build.ts
 * Reads scripts/food/fdc-ingredients.json, ingredients.ts and recipes.ts, and
 * writes src/data/food/foods.json. It refuses a recipe whose content changed
 * without a new rev (B-12).
 */
import fs from 'node:fs';
import { buildFoodData, unbumped, type FdcExtract } from '@/food/compute';
import type { FoodData } from '@/food/types';
import { INGREDIENTS } from './ingredients';
import { RECIPES } from './recipes';

const OUT = 'src/data/food/foods.json';
const fdc = JSON.parse(fs.readFileSync('scripts/food/fdc-ingredients.json', 'utf8')) as FdcExtract;
const data = buildFoodData({ fdc, ingredients: INGREDIENTS, recipes: RECIPES });
const before = fs.existsSync(OUT) ? (JSON.parse(fs.readFileSync(OUT, 'utf8')) as FoodData) : undefined;
const stale = unbumped(before, data);
if (stale.length > 0) {
  console.error(`These recipes changed without a new rev: ${stale.join(', ')}. Raise each one's rev in scripts/food/recipes.ts.`);
  process.exit(1);
}
fs.mkdirSync('src/data/food', { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(data, null, 1)}\n`);
console.log(`Wrote ${data.foods.length} foods to ${OUT}.`);
