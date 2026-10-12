/**
 * Look up FDC foods by words in a downloaded file, to choose an ingredient's
 * exact description (journey §11.6):
 *   npx tsx --tsconfig tsconfig.app.json scripts/food/find-fdc.ts /tmp/fdc/<file>.json pigeon peas raw
 */
import fs from 'node:fs';
import { tokens } from '@/content/text';
import { fdcFoods, fdcRecord } from '@/food/compute';

const [file, ...words] = process.argv.slice(2);
if (!file || words.length === 0) {
  console.error('Usage: npx tsx --tsconfig tsconfig.app.json scripts/food/find-fdc.ts <FDC JSON file> <words…>');
  process.exit(2);
}
const want = tokens(words.join(' '));
for (const f of fdcFoods(JSON.parse(fs.readFileSync(file, 'utf8')))) {
  const d = (f as { description?: unknown }).description;
  if (typeof d !== 'string') continue;
  const have = new Set(tokens(d));
  if (!want.every(w => have.has(w))) continue;
  try {
    const r = fdcRecord(f);
    console.log(`${r.fdcId}\t${r.kcal} kcal\t${r.carbsG} g carbs\t${r.description}`);
  } catch {
    console.log(`(no kcal or carbohydrate)\t${d}`);
  }
}
