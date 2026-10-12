import { CARDS } from './cards';
import { claims } from './library';
import { MEALS, SLOTS } from './meals';
import { isCardVisible, topicsFor, type GuideContext } from './personalise';
import type { Pattern } from './schema';
import { normalise, tokens, words } from './text';
import { TOPICS } from './topics';
import { componentsFor, isAvoided, suits } from './week';

export type ResultKind = 'topic' | 'card' | 'meal';

interface Found {
  kind: ResultKind;
  id: string;
  title: string;
  detail: string;
  /** In-app route; search never builds a URL that leaves the app. */
  to: string;
}

export interface SearchResult extends Found {
  /** The query words this result matches, as typed. */
  matched: string[];
  /** The query words it does not: a partial match is labelled, never passed off as an answer (Codex content audit F22). */
  missing: string[];
}

interface Doc extends Found {
  /** Folded words by weight: the title counts most, body text least. */
  words: [weight: number, words: Set<string>][];
  /** The title, normalised, for whole-phrase matches. */
  phrase: string;
}

const doc = (r: Found, title: string[], strong: string[], body: string[]): Doc => ({
  ...r,
  words: [
    [3, new Set(title.flatMap(tokens))],
    [2, new Set(strong.flatMap(tokens))],
    [1, new Set(body.flatMap(tokens))],
  ],
  phrase: normalise(title.join(' ')),
});

const TOPIC_DOCS: Doc[] = TOPICS.map(t => doc(
  { kind: 'topic', id: t.id, title: t.title, detail: t.summary, to: `/guide/topic/${t.id}` },
  [t.title], [...t.aliases, t.summary], [],
));

const CARD_DOCS: Doc[] = CARDS.map(c => doc(
  { kind: 'card', id: c.id, title: c.title, detail: c.question, to: `/guide/card/${c.id}` },
  [c.title], [...c.aliases, c.question],
  claims([...c.answer, ...(c.emergencies ?? []), ...c.notes, ...c.actions, ...c.cautions]).map(x => x.statement),
));

const SLOT_TITLE = new Map(SLOTS.map(s => [s.id, s.title]));

/** Meal documents per eating pattern: a vegan's search for "dahi" finds no dahi side. */
const mealDocs = new Map<Pattern | 'any', Doc[]>();
function mealDocsFor(pattern?: Pattern): Doc[] {
  const key = pattern ?? 'any';
  let docs = mealDocs.get(key);
  if (!docs) {
    docs = MEALS.filter(m => suits(m, pattern)).map(m => {
      const parts = componentsFor(m, pattern);
      return doc(
        { kind: 'meal', id: m.id, title: m.name, detail: SLOT_TITLE.get(m.slot) ?? '', to: `/guide/meals/${m.id}` },
        [m.name], [...m.aliases, ...parts.flatMap(c => c.aliases ?? [])], parts.map(c => c.name),
      );
    });
    mealDocs.set(key, docs);
  }
  return docs;
}

/** The best weight with which a query word appears in a document, or 0. */
function weightOf(d: Doc, word: string, prefix: boolean): number {
  let best = 0;
  for (const [weight, words] of d.words) {
    if (words.has(word)) best = Math.max(best, weight);
    // A prefix counts for half, so the word itself ("dal") outranks a longer
    // word that merely starts with it ("dalchini").
    else if (prefix && [...words].some(w => w.startsWith(word))) best = Math.max(best, weight / 2);
  }
  return best;
}

const KIND_ORDER: Record<ResultKind, number> = { topic: 0, card: 1, meal: 2 };

/**
 * Search topics, answers and meals. Pure, local and tolerant of case, accents
 * and simple plurals; Hindi food names are matched through each card's and
 * meal's aliases. An empty query returns the topics — in the person's order —
 * not everything. Every word must match, the last one as a prefix so results
 * appear while typing; if nothing matches every word, the closest matches are
 * returned rather than nothing.
 */
export function search(query: string, ctx: GuideContext): SearchResult[] {
  const typed = words(query);
  if (typed.length === 0) {
    const { forYou, more } = topicsFor(ctx);
    return [...forYou.map(f => f.topic), ...more].map(t => strip(TOPIC_DOCS.find(d => d.id === t.id)!, [], []));
  }

  const visibleCardIds = new Set(CARDS.filter(c => isCardVisible(c, ctx)).map(c => c.id));
  const meals = mealDocsFor(ctx.food?.pattern)
    .filter(d => !isAvoided(MEALS.find(m => m.id === d.id)!, ctx.food?.avoid, ctx.food?.pattern));
  const pool = [...TOPIC_DOCS, ...CARD_DOCS.filter(d => visibleCardIds.has(d.id)), ...meals];
  const phrase = normalise(query);

  const scored = pool.map(d => {
    const hit: boolean[] = [];
    let score = 0;
    typed.forEach(({ token }, i) => {
      // Type-ahead on the last word only, and never on a single letter, so
      // "vitamin d" does not also match every word starting with d.
      const weight = weightOf(d, token, i === typed.length - 1 && token.length >= 2);
      hit.push(weight > 0);
      score += weight;
    });
    if (phrase.length >= 2 && d.phrase.includes(phrase)) score += 5;
    return { d, hit, matched: hit.filter(Boolean).length, score };
  }).filter(s => s.matched > 0);

  const best = Math.max(0, ...scored.map(s => s.matched));
  const all = scored.filter(s => s.matched === typed.length);
  const chosen = all.length > 0 ? all : scored.filter(s => s.matched === best);

  return chosen
    .sort((a, b) => b.score - a.score || KIND_ORDER[a.d.kind] - KIND_ORDER[b.d.kind] || a.d.title.localeCompare(b.d.title))
    .slice(0, 40)
    .map(s => strip(s.d, typed.filter((_, i) => s.hit[i]).map(w => w.word), typed.filter((_, i) => !s.hit[i]).map(w => w.word)));
}

function strip({ kind, id, title, detail, to }: Doc, matched: string[], missing: string[]): SearchResult {
  return { kind, id, title, detail, to, matched: [...new Set(matched)], missing: [...new Set(missing)] };
}
