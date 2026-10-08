import { BACK_RED_FLAGS, CARDS } from './cards';
import { CLAIMS } from './claims';
import { HABITS } from './habits';
import { claimIdsOfMealIdeas, recommendationNumbers, shownClaimIds } from './library';
import { MEALS, MEASURES } from './meals';
import { ROUTES, type Claim, type GuidanceCard, type MealTemplate, type Source } from './schema';
import { FURTHER_READING, READ_AT, SOURCES } from './sources';
import { tokens } from './text';
import { TOPICS } from './topics';

/**
 * Checks the library against the rules in `schema.ts`. Each function returns
 * every problem it finds as a sentence, so a failing test says what to fix.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A number with a dose unit: 500 mcg, 60,000 IU, 10 units, 1.5 mg. */
const DOSE = /(?:^|[^\w])\d[\d,.]*\s?(?:mg|mcg|µg|μg|ug|iu|units?)(?![a-z])/i;
/** Words that turn a quantity into dosing advice. */
const MEDICINE = /\b(?:supplements?|tablets?|capsules?|pills?|insulin|injections?|shots?|doses?|dosing|vitamins?|b12|metformin|medicines?|medications?|sachets?|drops?|syrups?)\b/i;

/**
 * Whether a text gives a dose: a quantity with a dose unit in the same
 * sentence as a supplement, insulin or medicine word. "Less than 2,000 mg of
 * sodium" is a food limit and passes; "1,000 mcg B12 tablets" does not.
 */
export function hasDoseAdvice(text: string): boolean {
  return text.split(/(?<=[.;!?])\s+/).some(sentence => DOSE.test(sentence) && MEDICINE.test(sentence));
}

/** NHS terms forbid citing the NHS as the source of adapted text (board D32). */
export function isNhs(url: string, organisation = ''): boolean {
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    return false;
  }
  return host === 'nhs.uk' || host.endsWith('.nhs.uk') || /\bNHS\b/.test(organisation);
}

/** External links open only on a tap and carry nothing about the person. */
function isCleanHttps(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.search === '' && u.username === '' && u.password === '';
  } catch {
    return false;
  }
}

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  return [...new Set(ids.filter(id => (seen.has(id) ? true : (seen.add(id), false))))];
}

export function checkUniqueIds(): string[] {
  const groups: [string, string[]][] = [
    ['claim', CLAIMS.map(c => c.id)],
    ['source', SOURCES.map(s => s.id)],
    ['card', CARDS.map(c => c.id)],
    ['meal', MEALS.map(m => m.id)],
    ['topic', TOPICS.map(t => t.id)],
    ['further reading', FURTHER_READING.map(f => f.id)],
    ['habit', HABITS.map(h => h.id)],
  ];
  return groups.flatMap(([kind, ids]) => duplicates(ids).map(id => `Duplicate ${kind} id ${id}`));
}

export function checkSources(sources: Source[] = SOURCES): string[] {
  const problems: string[] = [];
  for (const s of sources) {
    for (const field of ['organisation', 'short', 'title', 'edition', 'locator', 'jurisdiction', 'population'] as const) {
      if (!s[field]?.trim()) problems.push(`Source ${s.id} has no ${field}`);
    }
    if (!isCleanHttps(s.url)) problems.push(`Source ${s.id} needs a plain https URL with no query string`);
    if (!ISO_DATE.test(s.accessed)) problems.push(`Source ${s.id} has no accessed date`);
    if (isNhs(s.url, s.organisation)) problems.push(`Source ${s.id} is an NHS page; NHS pages may only be further reading`);
    const read = READ_AT[s.id];
    if (!read || !read.url.startsWith('https://')) problems.push(`Source ${s.id} has no record of how it was read`);
  }
  const cited = new Set(CLAIMS.flatMap(c => c.support.map(x => x.sourceId)));
  for (const s of sources) if (!cited.has(s.id)) problems.push(`Source ${s.id} is not cited by any claim`);
  return problems;
}

export function checkClaims(claims: Claim[] = CLAIMS): string[] {
  const problems: string[] = [];
  const sourceById = new Map(SOURCES.map(s => [s.id, s]));
  const claimById = new Map(CLAIMS.map(c => [c.id, c]));
  for (const c of claims) {
    if (!c.statement.trim()) problems.push(`Claim ${c.id} has no statement`);
    // Our own words, never a quotation of the guideline (board D32).
    if (/["“”]/.test(c.statement)) problems.push(`Claim ${c.id} quotes its source; write it in your own words`);
    if (c.support.length === 0) problems.push(`Claim ${c.id} cites no source`);
    for (const { sourceId, locator } of c.support) {
      const source = sourceById.get(sourceId);
      if (!source) problems.push(`Claim ${c.id} cites a missing source ${sourceId}`);
      else if (isNhs(source.url, source.organisation)) problems.push(`Claim ${c.id} cites an NHS source ${sourceId}`);
      if (!locator.trim()) problems.push(`Claim ${c.id} gives no locator in ${sourceId}`);
    }
    if (!ISO_DATE.test(c.reviewedDate)) problems.push(`Claim ${c.id} has no reviewed date`);
    if (!['fetched', 'research-doc'].includes(c.verification.method)) problems.push(`Claim ${c.id} has no verification method`);
    if (c.verification.urls.length !== c.support.length || c.verification.urls.some(u => !u.startsWith('https://'))) {
      problems.push(`Claim ${c.id} does not record where each source was read`);
    }
    for (const id of c.cautionIds ?? []) {
      const caution = claimById.get(id);
      if (!caution) problems.push(`Claim ${c.id} attaches a missing caution ${id}`);
      else if (!caution.caution) problems.push(`Claim ${c.id} attaches ${id}, which is not a caution`);
    }
  }
  return problems;
}

export function checkCards(cards: GuidanceCard[] = CARDS): string[] {
  const problems: string[] = [];
  const claimById = new Map(CLAIMS.map(c => [c.id, c]));
  const cardIds = new Set(CARDS.map(c => c.id));
  const topicIds = new Set<string>(TOPICS.map(t => t.id));
  const readingIds = new Set(FURTHER_READING.map(f => f.id));
  const routes = new Set<string>(Object.values(ROUTES));
  for (const card of cards) {
    const sections: [string, string[], number, number][] = [
      ['answer', card.answer, 1, 2],
      ['notes', card.notes, 0, 3],
      ['actions', card.actions, 3, 5],
      ['cautions', card.cautions, 1, 4],
    ];
    for (const [name, ids, min, max] of sections) {
      if (ids.length < min || ids.length > max) problems.push(`Card ${card.id} has ${ids.length} ${name}; allowed ${min}–${max}`);
      for (const id of ids) if (!claimById.has(id)) problems.push(`Card ${card.id} ${name} references a missing claim ${id}`);
    }
    for (const id of card.cautions) {
      if (claimById.has(id) && !claimById.get(id)!.caution) problems.push(`Card ${card.id} lists ${id} under cautions, but it is not a caution`);
    }
    if (card.topics.length === 0) problems.push(`Card ${card.id} belongs to no topic`);
    for (const t of card.topics) if (!topicIds.has(t)) problems.push(`Card ${card.id} names a missing topic ${t}`);
    for (const r of card.related) {
      if (!cardIds.has(r)) problems.push(`Card ${card.id} relates to a missing card ${r}`);
      if (r === card.id) problems.push(`Card ${card.id} relates to itself`);
    }
    for (const id of card.emergencies ?? []) if (!claimById.has(id)) problems.push(`Card ${card.id} emergencies references a missing claim ${id}`);
    for (const f of card.furtherReading ?? []) if (!readingIds.has(f)) problems.push(`Card ${card.id} links missing further reading ${f}`);
    if (card.action && !routes.has(card.action.to)) problems.push(`Card ${card.id} hands off to an unknown route ${card.action.to}`);
    if (!ISO_DATE.test(card.reviewedDate)) problems.push(`Card ${card.id} has no reviewed date`);
  }
  for (const t of TOPICS) {
    if (CARDS.filter(c => c.topics.includes(t.id)).length < 2) problems.push(`Topic ${t.id} has fewer than two cards`);
  }
  return problems;
}

export function checkMeals(meals: MealTemplate[] = MEALS): string[] {
  const problems: string[] = [];
  const claimIds = new Set(CLAIMS.map(c => c.id));
  for (const m of meals) {
    if (m.components.length === 0) problems.push(`Meal ${m.id} has no components`);
    if (m.patterns.length === 0) problems.push(`Meal ${m.id} suits no eating pattern`);
    for (const [name, ids] of [['claims', m.claimIds], ['swaps', m.swaps], ['salt', m.salt], ['sugar', m.sugar]] as const) {
      for (const id of ids) if (!claimIds.has(id)) problems.push(`Meal ${m.id} ${name} references a missing claim ${id}`);
    }
    if (m.claimIds.length === 0) problems.push(`Meal ${m.id} cites no claim for how it is built`);
    for (const c of m.components) {
      if (c.measure && !MEASURES[c.measure]) problems.push(`Meal ${m.id} uses an unknown measure ${c.measure}`);
    }
    for (const p of m.patterns) {
      if (m.components.every(c => c.notFor?.includes(p))) problems.push(`Meal ${m.id} has nothing left for ${p}`);
      // A meal's own search words must not name a food this pattern drops,
      // or a vegan searching "dahi" would be shown a meal with no dahi in it.
      const kept = new Set(m.components.filter(c => !c.notFor?.includes(p)).flatMap(c => [c.name, ...(c.aliases ?? [])]).flatMap(tokens));
      const dropped = new Set(m.components.filter(c => c.notFor?.includes(p)).flatMap(c => [c.name, ...(c.aliases ?? [])]).flatMap(tokens));
      for (const word of m.aliases.flatMap(tokens)) {
        if (dropped.has(word) && !kept.has(word)) problems.push(`Meal ${m.id} alias “${word}” names a food ${p} eaters do not get`);
      }
      for (const word of tokens(m.name)) {
        if (dropped.has(word) && !kept.has(word)) problems.push(`Meal ${m.id} title names “${word}”, which ${p} eaters do not get`);
      }
      // A main meal built on the plate keeps its protein quarter for everyone it suits.
      const groups = new Set(m.components.filter(c => !c.notFor?.includes(p)).map(c => c.group));
      if (m.slot !== 'snack' && m.claimIds.includes('fd-plate-method')) {
        // Dal and other pulses count in the carbohydrate quarter as well as protein (the plate's Step 3).
        const carbs = groups.has('grains') || groups.has('pulses');
        const protein = (['pulses', 'dairy', 'eggsMeatFish'] as const).some(g => groups.has(g));
        for (const [need, has] of [['vegetables', groups.has('vegetables')], ['carbohydrate', carbs], ['protein', protein]] as const) {
          if (!has) problems.push(`Meal ${m.id} has no ${need} for ${p} eaters, though it cites the plate`);
        }
      }
    }
    const sprouts = [m.name, ...m.components.map(c => c.name)].filter(text => /sprout/i.test(text));
    if (sprouts.some(text => !/cooked/i.test(text))) problems.push(`Meal ${m.id} names sprouts without saying they are cooked`);
    if (sprouts.length > 0 && !m.claimIds.includes('food-safety-sprouts')) problems.push(`Meal ${m.id} has sprouts but not the food-safety note`);
    if (!ISO_DATE.test(m.reviewedDate)) problems.push(`Meal ${m.id} has no reviewed date`);
  }
  for (const [key, measure] of Object.entries(MEASURES)) {
    if (measure.claimIds.length === 0) problems.push(`Measure ${key} cites no claim`);
    for (const id of measure.claimIds) if (!claimIds.has(id)) problems.push(`Measure ${key} references a missing claim ${id}`);
  }
  for (const id of claimIdsOfMealIdeas()) if (!claimIds.has(id)) problems.push(`Meal ideas references a missing claim ${id}`);
  return problems;
}

export function checkHabits(): string[] {
  const problems: string[] = [];
  const claimIds = new Set(CLAIMS.map(c => c.id));
  const cardIds = new Set(CARDS.map(c => c.id));
  for (const h of HABITS) {
    for (const id of [...h.claimIds, h.cueClaimId, h.withheldClaimId]) {
      if (id && !claimIds.has(id)) problems.push(`Habit ${h.id} references a missing claim ${id}`);
    }
    if (!cardIds.has(h.cardId)) problems.push(`Habit ${h.id} points to a missing card ${h.cardId}`);
    if ((h.withheldWhen ?? []).length > 0 && !h.withheldClaimId) problems.push(`Habit ${h.id} can be withheld but says nothing instead`);
  }
  return problems;
}

export function checkFurtherReading(): string[] {
  const problems: string[] = [];
  const sourceUrls = new Set(SOURCES.map(s => s.url));
  for (const f of FURTHER_READING) {
    if (!isCleanHttps(f.url)) problems.push(`Further reading ${f.id} needs a plain https URL`);
    if (sourceUrls.has(f.url)) problems.push(`Further reading ${f.id} is also a source`);
    if (!f.note.trim()) problems.push(`Further reading ${f.id} has no note`);
  }
  return problems;
}

/**
 * Board D32: the ADA Standards are cited by recommendation number only. Each
 * citation of such a source must name a number, so the screen has something
 * to show; the rest of its locator stays as the editorial record.
 */
export function checkCitations(claims: Claim[] = CLAIMS): string[] {
  const numbered = new Set(SOURCES.filter(s => s.citeBy === 'recommendation').map(s => s.id));
  return claims.flatMap(c => c.support
    .filter(s => numbered.has(s.sourceId) && recommendationNumbers(s.locator).length === 0)
    .map(s => `Claim ${c.id} cites ${s.sourceId} without a recommendation number (board D32): “${s.locator}”`));
}


/**
 * Safety placement: urgent claims sit in a card's emergencies and nowhere
 * routine; the app's own rules say they are the app's; every movement prompt
 * carries its precautions; and back cards that hand off to movement show the
 * red flags first.
 */
export function checkSafety(claims: Claim[] = CLAIMS, cards: GuidanceCard[] = CARDS): string[] {
  const problems: string[] = [];
  const claimById = new Map(CLAIMS.map(c => [c.id, c]));
  for (const c of claims) {
    if (c.policy && !/\bthis app\b/i.test(c.statement)) problems.push(`Claim ${c.id} is the app’s own rule but does not say so`);
    if (c.movement) {
      const needs = c.movement === 'weightBearing' ? ['walk-carry-sugar', 'walk-feet', 'walk-foot-wound'] : ['walk-carry-sugar', 'walk-foot-wound'];
      for (const id of needs) if (!c.cautionIds?.includes(id)) problems.push(`Movement prompt ${c.id} does not carry ${id}`);
      if (c.movement === 'weightBearing' && c.swap?.when !== 'footWound') problems.push(`Walking or standing prompt ${c.id} does not give way with an open foot wound`);
    }
    for (const id of c.swap?.with ?? []) if (!claimById.has(id)) problems.push(`Claim ${c.id} swaps to a missing claim ${id}`);
  }
  for (const card of cards) {
    for (const [section, ids] of [['answer', card.answer], ['notes', card.notes], ['actions', card.actions], ['cautions', card.cautions]] as const) {
      for (const id of ids) if (claimById.get(id)?.urgency) problems.push(`Card ${card.id} puts urgent ${id} under ${section}; urgent claims belong in emergencies`);
    }
    for (const id of card.emergencies ?? []) if (claimById.has(id) && !claimById.get(id)!.urgency) problems.push(`Card ${card.id} lists ${id} as an emergency, but it has no urgency`);
    // Every back card, with or without a hand-off: its prose invites movement too (re-check R01).
    if (card.topics.includes('back')) {
      for (const id of BACK_RED_FLAGS) if (!card.emergencies?.includes(id)) problems.push(`Back card ${card.id} shows movement without ${id} first`);
    }
  }
  return problems;
}

/** Claims nobody can see are dead weight, and dead weight goes stale unnoticed. */
export function checkNoOrphanClaims(): string[] {
  const shown = shownClaimIds();
  return CLAIMS.filter(c => !shown.has(c.id)).map(c => `Claim ${c.id} is not shown anywhere`);
}

/** Every piece of text in the library, labelled, for the dose guard. */
export function allTexts(): [where: string, text: string][] {
  return [
    ...CLAIMS.map(c => [`claim ${c.id}`, c.statement] as [string, string]),
    ...CARDS.flatMap(c => [[`card ${c.id} title`, c.title], [`card ${c.id} question`, c.question], [`card ${c.id} action`, c.action?.label ?? '']] as [string, string][]),
    ...MEALS.flatMap(m => [[`meal ${m.id}`, m.name], ...m.components.map(c => [`meal ${m.id} component`, c.name])] as [string, string][]),
    ...Object.entries(MEASURES).map(([k, v]) => [`measure ${k}`, v.text] as [string, string]),
    ...HABITS.map(h => [`habit ${h.id}`, h.title] as [string, string]),
    ...TOPICS.flatMap(t => [[`topic ${t.id}`, t.title], [`topic ${t.id} summary`, t.summary]] as [string, string][]),
  ];
}

export function checkNoDoses(): string[] {
  return allTexts().filter(([, text]) => hasDoseAdvice(text)).map(([where, text]) => `Dose-like text in ${where}: ${text}`);
}
