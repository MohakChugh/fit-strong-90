/**
 * Browse (journey §14, B-14): every category in the registry and every
 * shortcut, in Browse's groups, with a search over them, the Guide's topics
 * and answers, and the meal ideas. Each kind keeps to its group. Pick mode
 * (Edit Home's "+ Add", §7.6) lists the categories alone, since a shortcut or
 * a topic can't be a tile. Pure, so the whole index is tested without a
 * screen.
 */
import { BROWSE_GROUPS, CATEGORIES, SHORTCUTS, type BrowseGroupId, type CategoryId } from '@/categories';
import { search, type GuideContext, type SearchResult } from '@/content';
import { words } from '@/content/text';
import { redirectFor } from '@/redirects';

export type BrowseRow =
  | { kind: 'category'; id: CategoryId; title: string }
  | { kind: 'shortcut'; id: string; title: string; to: string }
  | { kind: SearchResult['kind']; id: string; title: string; detail: string; to: string; result: SearchResult }
  /** A food from the food table (D115), to log: Browse's food rows (`foods.ts`). */
  | { kind: 'food'; id: string; title: string; detail: string; to: string };

export interface BrowseGroup {
  id: BrowseGroupId;
  title: string;
  rows: BrowseRow[];
}

export interface BrowseResults {
  groups: BrowseGroup[];
  /** Nothing has every word typed, so each row matches only some of them, and the screen says so (Codex content audit F22). */
  partial: boolean;
}

/** Words people type for a category, beside its title: plain words, Hindi words in Latin letters, and common spellings. */
export const CATEGORY_ALIASES: Record<CategoryId, readonly string[]> = {
  workout: ['exercise', 'gym', 'strength', 'training', 'session'],
  stretch: ['stretching', 'mobility', 'yoga', 'flexibility'],
  walk: ['walking', 'stroll', 'after meal walk'],
  steps: ['step count', 'pedometer'],
  food: ['meal', 'meals', 'eat', 'eating', 'diet', 'khana'],
  glucose: ['sugar', 'blood sugar', 'diabetes', 'cgm', 'meter', 'hypo', 'shugar'],
  bp: ['bp', 'blood pressure', 'pressure', 'hypertension', 'cuff'],
  back: ['back pain', 'sciatica', 'leg pain', 'pain', 'kamar dard', 'kamar', 'spine', 'nerve'],
  weight: ['kg', 'bmi', 'wazan', 'body weight'],
  water: ['drink', 'drinking', 'fluid', 'fluids', 'pani', 'paani', 'hydration'],
  sleep: ['nap', 'neend', 'night'],
  waist: ['waistline', 'tummy', 'belly'],
  labs: ['hba1c', 'a1c', 'b12', 'vitamin b12', 'vitamin d', 'blood test', 'lab', 'lab test', 'report'],
  learn: ['guide', 'help', 'tips', 'read', 'articles'],
};

/** The same, for the shortcuts, by their ids (`SHORTCUTS` in the registry). */
export const SHORTCUT_ALIASES: Readonly<Record<string, readonly string[]>> = {
  programme: ['program', 'plan', 'your plan', '12 week', 'join'],
  library: ['exercises', 'exercise list', 'moves', 'demos'],
  'meal-ideas': ['recipes', 'meal plan', 'menu', 'sample week', 'ideas'],
  bmi: ['body mass index'],
  'today-log': ['log', 'history', 'my day', 'records', 'diary'],
  backup: ['back up', 'export', 'restore', 'save', 'file'],
};

interface Entry {
  row: BrowseRow;
  group: BrowseGroupId;
  tokens: ReadonlySet<string>;
}

/** Folded the way the Guide's search folds words (`@/content/text`), so the two agree on what matches. */
const tokensOf = (texts: readonly string[]): ReadonlySet<string> => new Set(texts.flatMap(t => words(t).map(w => w.token)));

const ENTRIES: readonly Entry[] = [
  ...CATEGORIES.map((c): Entry => ({ row: { kind: 'category', id: c.id, title: c.title }, group: c.group, tokens: tokensOf([c.title, ...CATEGORY_ALIASES[c.id]]) })),
  ...BROWSE_GROUPS.flatMap(g => SHORTCUTS[g.id].map((s): Entry => ({
    row: { kind: 'shortcut', id: s.id, title: s.title, to: s.to }, group: g.id, tokens: tokensOf([s.title, ...(SHORTCUT_ALIASES[s.id] ?? [])]),
  }))),
];

/** Every word typed is one of the entry's; the last may be the start of one, as people type, but never a single letter. */
function matches(tokens: ReadonlySet<string>, typed: readonly { token: string }[]): boolean {
  return typed.every(({ token }, i) => tokens.has(token)
    || (i === typed.length - 1 && token.length >= 2 && [...tokens].some(t => t.startsWith(token))));
}

const CONTENT_GROUP: Record<SearchResult['kind'], BrowseGroupId> = { meal: 'eat', topic: 'learn', card: 'learn' };

/** The Guide's links may still name v1's addresses; Browse opens the v2 place (journey §19.3). */
const placeOf = (to: string) => redirectFor(to, '') ?? to;

export function browse(query: string, ctx: GuideContext, mode: 'browse' | 'pick' = 'browse'): BrowseResults {
  const typed = words(query);
  const entries = ENTRIES.filter(e => (mode === 'browse' || e.row.kind === 'category') && (typed.length === 0 || matches(e.tokens, typed)));
  // Nothing typed: the Guide's topics, in the person's order.
  const found = mode === 'pick' ? [] : search(query, ctx);
  const onlyPartial = typed.length > 0 && found.length > 0 && found.every(r => r.missing.length > 0);
  // A category or shortcut with every word is the answer; part-matches beside it would only distract.
  const content = onlyPartial && entries.length > 0 ? [] : found;
  const rows = new Map<BrowseGroupId, BrowseRow[]>(BROWSE_GROUPS.map(g => [g.id, []]));
  for (const e of entries) rows.get(e.group)?.push(e.row);
  for (const r of content) {
    rows.get(CONTENT_GROUP[r.kind])?.push({ kind: r.kind, id: r.id, title: r.title, detail: r.detail, to: placeOf(r.to), result: r });
  }
  return {
    groups: BROWSE_GROUPS.map(g => ({ id: g.id, title: g.title, rows: rows.get(g.id) ?? [] })).filter(g => g.rows.length > 0),
    partial: onlyPartial && entries.length === 0,
  };
}
