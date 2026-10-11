/**
 * The FDC records our ingredients name, pulled out of a downloaded FoodData
 * Central SR Legacy JSON file (journey §11.6; board D95):
 *   npx tsx --tsconfig tsconfig.app.json scripts/food/extract-fdc.ts /tmp/fdc/<file>.json
 * Writes scripts/food/fdc-ingredients.json. The download itself never enters the repository.
 */
import fs from 'node:fs';
import path from 'node:path';
import { tokens } from '@/content/text';
import { fdcFoods, fdcRecord, type FdcExtract } from '@/food/compute';
import { INGREDIENTS } from './ingredients';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npx tsx --tsconfig tsconfig.app.json scripts/food/extract-fdc.ts <FDC SR Legacy JSON file>');
  process.exit(2);
}
const byDescription = new Map<string, unknown>();
for (const f of fdcFoods(JSON.parse(fs.readFileSync(file, 'utf8')))) {
  const d = (f as { description?: unknown }).description;
  if (typeof d === 'string') byDescription.set(d, f);
}
/** The descriptions closest to one that isn't there: most shared words first, then the shortest. */
const closest = (wanted: string) => {
  const want = new Set(tokens(wanted));
  return [...byDescription.keys()]
    .map(d => ({ d, score: tokens(d).filter(w => want.has(w)).length }))
    .sort((a, b) => b.score - a.score || a.d.length - b.d.length)
    .slice(0, 8)
    .map(x => x.d);
};
const wanted = [...new Set(INGREDIENTS.flatMap(i => (i.fdc === null ? [] : [i.fdc])))];
const missing = wanted.filter(d => !byDescription.has(d));
if (missing.length > 0) {
  for (const d of missing) console.error(`No FDC food is described exactly "${d}". The closest:\n  ${closest(d).join('\n  ')}`);
  process.exit(1);
}
const records = wanted.map(d => fdcRecord(byDescription.get(d))).sort((a, b) => a.fdcId - b.fdcId);
const datasets = [...new Set(records.map(r => r.dataType))];
if (datasets.length !== 1 || datasets[0] !== 'SR Legacy') {
  console.error(`Every record must come from SR Legacy (board, Plan 7), not ${datasets.join(', ')}.`);
  process.exit(1);
}
const now = new Date();
const extractedOn = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const extract: FdcExtract = {
  source: {
    name: 'USDA FoodData Central',
    url: 'https://fdc.nal.usda.gov/',
    licence: 'CC0 1.0 Universal (public domain)',
    // FDC's suggested citation, as its home page gives it, cited on the day of the extract (board, Plan 7 Task 1).
    credit: `U.S. Department of Agriculture, Agricultural Research Service, Beltsville Human Nutrition Research Center. FoodData Central. [Internet]. [cited ${extractedOn}]. Available from https://fdc.nal.usda.gov/.`,
    dataset: 'SR Legacy',
    file: path.basename(file),
    extractedOn,
  },
  records,
};
fs.writeFileSync('scripts/food/fdc-ingredients.json', `${JSON.stringify(extract, null, 2)}\n`);
console.log(`Wrote ${records.length} FDC records from ${path.basename(file)}.`);
