/**
 * Recently deleted (journey §20.4 rule 6; B-04, B-05; board D109, D110,
 * D111). A routine delete removes the record and everything that belongs to
 * it in one change, and keeps all of it as one entry for 7 days: a
 * content-state row, `recent:<id>`, which never leaves the device (D109
 * amends J§18.1's place for it). A restore puts it back under fresh ids with
 * `restoredFrom`, its references rewritten, and drops the entry, in one
 * change; the originals' deletion records (D-06) stay, so an older backup
 * can't bring them back beside their copies. Each renaming is kept as this
 * device's own lineage, `lineage:<old>` rows, which never leave it either; a
 * merge reads a file's references through them. Pure: the store runs each
 * plan as one change. A session and a check-in's reading are deleted and
 * restored by their own modules (`src/screens/workout/deletion.ts`,
 * `src/components/checkin/pending.ts`), into entries made here.
 */
import type { KeptReading } from '@/components/checkin/pending';
import { bpReadingId, checkInDayOf, isBpKind, observationProblem, type Observation } from '@/health/observation';
import type { UserSettings, WorkoutSession } from '@/types';
import { StoreFailure } from './db';
import { RECORD_RULES, recordKey, recordProblem, type RecordStore, type StoredRecord } from './records';
import type { Change, Snapshot } from './snapshot';
import type { TransferDoc } from './transfer';

export const RECENT_DAYS = 7;
export const RECENT_MS = RECENT_DAYS * 24 * 60 * 60 * 1000;
export const RECENT_PREFIX = 'recent:';
export const LINEAGE_PREFIX = 'lineage:';
/** The last time expiry ran: it never runs on a clock that reads earlier (K8-01). */
export const RECENT_CLOCK = 'recent-clock';

export type RecentKind = 'reading' | 'pressure' | 'walk' | 'meal' | 'usualMeal' | 'ownFood' | 'session' | 'checkInReading';

export interface RecentDeletion {
  id: string;
  /** When it was deleted, ISO with offset. */
  at: string;
  kind: RecentKind;
  /** The deleted thing's own id: the reading's, the blood pressure reading's, the walk's, the meal's, the food's, the session's; a check-in reading's first row. */
  of: string;
  observations?: Observation[];
  records?: Partial<Record<RecordStore, StoredRecord[]>>;
  /** A session or manual workout, whole. */
  session?: WorkoutSession;
  /** A check-in's reading: the check-in's day, and what was taken out of it, where it stood. */
  day?: string;
  kept?: KeptReading;
}

export type DeleteRequest =
  | { kind: 'reading'; id: string }
  | { kind: 'pressure'; readingId: string }
  | { kind: 'walk'; walkId: string }
  | { kind: 'meal'; id: string }
  | { kind: 'usualMeal'; id: string }
  | { kind: 'ownFood'; id: string };

export interface Restored {
  kind: RecentKind;
  /** The restored thing's id now. */
  id: string;
}

export const CHECK_IN_READING = 'This reading belongs to a check-in: it’s deleted from the check-in.';
export const NOT_RECENT = 'That’s no longer in Recently deleted: anything deleted more than 7 days ago is gone for good.';
export const OWN_SCREEN = 'That’s restored by its own record.';

export const recentKey = (id: string): string => `${RECENT_PREFIX}${id}`;
export const isRecentKey = (key: string): boolean => key.startsWith(RECENT_PREFIX);
export const lineageKey = (ref: string): string => `${LINEAGE_PREFIX}${ref}`;
/** This device's own rows: never in a backup, never taken from one (D109, P8R-04). */
export const isLocalKey = (key: string): boolean => isRecentKey(key) || key.startsWith(LINEAGE_PREFIX) || key === RECENT_CLOCK;

const KINDS: readonly RecentKind[] = ['reading', 'pressure', 'walk', 'meal', 'usualMeal', 'ownFood', 'session', 'checkInReading'];
const STORE_OF: Partial<Record<RecentKind, RecordStore>> = { meal: 'meals', usualMeal: 'savedMeals', ownFood: 'customFoods' };
const PREFIX_OF: Partial<Record<RecentKind, string>> = { meal: 'meal', usualMeal: 'usual', ownFood: 'food' };
const gone = (what: string) => new StoreFailure('invalid', `${what} is no longer on this device.`);
const newestFirst = (a: RecentDeletion, b: RecentDeletion) => Date.parse(b.at) - Date.parse(a.at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** A content row's value as an entry, or nothing when it can't be one. */
export function asRecent(value: unknown): RecentDeletion | undefined {
  if (!isObject(value)) return undefined;
  const e = value as Partial<RecentDeletion>;
  if (typeof e.id !== 'string' || typeof e.at !== 'string' || Number.isNaN(Date.parse(e.at)) || typeof e.of !== 'string') return undefined;
  if (!KINDS.includes(e.kind as RecentKind)) return undefined;
  if (e.observations !== undefined && !Array.isArray(e.observations)) return undefined;
  if (e.records !== undefined && !isObject(e.records)) return undefined;
  if (e.kind === 'session' && !isObject(e.session)) return undefined;
  if (e.kind === 'checkInReading' && (typeof e.day !== 'string' || !isObject(e.kept))) return undefined;
  return e as RecentDeletion;
}

const within = (e: RecentDeletion, now: number) => now - Date.parse(e.at) < RECENT_MS;

/** The entries still within 7 days, newest first. */
export function recentEntries(content: Readonly<Record<string, unknown>>, now: number): RecentDeletion[] {
  const out: RecentDeletion[] = [];
  for (const [key, value] of Object.entries(content)) {
    if (!isRecentKey(key)) continue;
    const e = asRecent(value);
    if (e && within(e, now)) out.push(e);
  }
  return out.sort(newestFirst);
}

/** The one test every restore asks, of what is stored when it is written (P8R-14): the entry, still within its 7 days, or nothing. */
export function restorable(content: Readonly<Record<string, unknown>>, entryId: string, now: number): RecentDeletion | undefined {
  const e = asRecent(content[recentKey(entryId)]);
  return e && within(e, now) ? e : undefined;
}

/** The rows past their 7 days, or unreadable. Every deletion is kept its 7 days, however many there are (P8-12). */
export function staleKeys(content: Readonly<Record<string, unknown>>, now: number): string[] {
  const drop: string[] = [];
  for (const [key, value] of Object.entries(content)) {
    if (!isRecentKey(key)) continue;
    const e = asRecent(value);
    if (!e || !within(e, now)) drop.push(key);
  }
  return drop.sort();
}

const clockOf = (content: Readonly<Record<string, unknown>>) => {
  const v = content[RECENT_CLOCK];
  return isObject(v) && typeof v.at === 'number' && Number.isFinite(v.at) ? v.at : undefined;
};

/**
 * Expiry, the one place it happens (D109, K8-01): what has passed its 7 days
 * goes, with the clock it ran at. Nothing at all while the clock reads
 * earlier than the last time it ran, so a clock set back never ends anything.
 * Undefined: nothing to do.
 */
export function expiryPlan(content: Readonly<Record<string, unknown>>, now: number): { remove: string[]; put: Record<string, unknown> } | undefined {
  const last = clockOf(content);
  if (last !== undefined && now < last) return undefined;
  const remove = staleKeys(content, now);
  return remove.length > 0 ? { remove, put: { [RECENT_CLOCK]: { at: now } } } : undefined;
}

/** When the next entry's 7 days end: what the store's timer waits for while the page runs (P8R-14). */
export function nextExpiry(content: Readonly<Record<string, unknown>>): number | undefined {
  let next: number | undefined;
  for (const [key, value] of Object.entries(content)) {
    if (!isRecentKey(key)) continue;
    const e = asRecent(value);
    const due = e ? Date.parse(e.at) + RECENT_MS : undefined;
    if (due !== undefined && (next === undefined || due < next)) next = due;
  }
  return next;
}

/** A session's entry, made by `deleteWorkout` in the change that removes it: the session, and what was recorded with it as it is now (P8S-06). */
export function sessionEntry(session: WorkoutSession, meta: { entry: string; at: string }, observations: readonly Observation[] = []): RecentDeletion {
  return { id: meta.entry, at: meta.at, kind: 'session', of: session.id, session, ...(observations.length > 0 ? { observations: [...observations] } : {}) };
}

/**
 * This device's history, which no import changes, a Replace included
 * (P8S-08): its lineage, and expiry's clock. Recently deleted's entries
 * aren't history but recovery payloads, and a Replace clears them with the
 * records they describe.
 */
export function deviceHistory(content: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(content).filter(([key]) => key.startsWith(LINEAGE_PREFIX) || key === RECENT_CLOCK));
}

/** A check-in reading's entry, made by `removeCheckInReading` in the change that takes it out. */
export function checkInReadingEntry(meta: { entry: string; at: string }, day: string, kept: KeptReading, observations: readonly Observation[]): RecentDeletion {
  return { id: meta.entry, at: meta.at, kind: 'checkInReading', of: observations[0]?.id ?? `${day}:${kept.kind}`, day, kept, observations: [...observations] };
}

/**
 * A routine delete as one change (B-04, D111): the record, everything that
 * belongs to it, and the entry that keeps them for 7 days. A check-in's own
 * reading is refused: its check-in removes it (`removeCheckInReading`).
 */
export function planDeletion(request: DeleteRequest, base: Snapshot, meta: { entry: string; at: string }): { change: Change; entry: RecentDeletion } {
  let of: string;
  let observations: Observation[] = [];
  const records: Partial<Record<RecordStore, StoredRecord[]>> = {};
  let journal: string[] | undefined;
  switch (request.kind) {
    case 'reading': {
      const o = base.observations.find(x => x.id === request.id);
      if (!o) throw gone('That record');
      const reading = isBpKind(o.kind) ? bpReadingId(o.context) : undefined;
      if (reading !== undefined) return planDeletion({ kind: 'pressure', readingId: reading }, base, meta);
      if (checkInDayOf(o) !== undefined) throw new StoreFailure('invalid', CHECK_IN_READING);
      observations = [o];
      of = o.id;
      break;
    }
    case 'pressure': {
      observations = base.observations.filter(o => bpReadingId(o.context) === request.readingId);
      if (observations.length === 0) throw gone('That reading');
      if (observations.some(o => checkInDayOf(o) !== undefined)) throw new StoreFailure('invalid', CHECK_IN_READING);
      of = request.readingId;
      break;
    }
    case 'walk': {
      // Everything recorded with the walk, as one entry (D110): its measurements, the energy
      // worked out from them, the pain rated after it, its route and its journal.
      observations = base.observations.filter(o => o.context === `walk:${request.walkId}`);
      const route = base.records.routes.filter(r => recordKey('routes', r) === request.walkId);
      if (observations.length === 0 && route.length === 0) throw gone('That walk');
      if (route.length > 0) records.routes = route;
      journal = [request.walkId];
      of = request.walkId;
      break;
    }
    case 'meal':
    case 'usualMeal':
    case 'ownFood': {
      const store = STORE_OF[request.kind]!;
      const found = base.records[store].filter(r => recordKey(store, r) === request.id);
      if (found.length === 0) throw gone(`That ${RECORD_RULES[store].label.one}`);
      records[store] = found;
      of = request.id;
      break;
    }
  }
  const entry: RecentDeletion = {
    id: meta.entry, at: meta.at, kind: request.kind, of,
    ...(observations.length > 0 ? { observations } : {}),
    ...(Object.keys(records).length > 0 ? { records } : {}),
  };
  const removes = Object.fromEntries(Object.entries(records).map(([store, rows]) => [store, { remove: rows.map(r => recordKey(store as RecordStore, r)) }]));
  return {
    entry,
    change: {
      ...(observations.length > 0 ? { observations: { remove: observations.map(o => o.id) } } : {}),
      ...(Object.keys(removes).length > 0 ? { records: removes } : {}),
      ...(journal ? { journal: { remove: journal } } : {}),
      content: { put: { [recentKey(entry.id)]: entry } },
    },
  };
}

/** A reference through the lineage to the record that bears it now: `walk:W` → `walk:W3` after two restores. */
export function canonical(lineage: Readonly<Record<string, string>>, ref: string): string {
  let at = ref;
  const seen = new Set<string>();
  while (Object.hasOwn(lineage, at) && !seen.has(at)) {
    seen.add(at);
    at = lineage[at];
  }
  return at;
}

/** This device's renamings, old reference to new, from its own rows. */
export function lineageIn(content: Readonly<Record<string, unknown>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(content)) {
    if (key.startsWith(LINEAGE_PREFIX) && isObject(value) && typeof value.to === 'string') out[key.slice(LINEAGE_PREFIX.length)] = value.to;
  }
  return out;
}

/** Whether a walk or a session a reference names is on the device now. */
const lives = (base: Snapshot, ref: string) => (ref.startsWith('walk:')
  ? base.observations.some(o => o.context === ref && o.scope === 'sessionObserved') || base.records.routes.some(r => `walk:${recordKey('routes', r)}` === ref)
  : base.sessions.some(s => `session:${s.id}` === ref));

/**
 * A restored reading's walk or session (P8R-05): the one that bears its
 * record now, through this device's lineage; none when that is gone, so the
 * reading stands on its own in the log rather than under a record that isn't
 * there.
 */
function relinked(o: Observation, base: Snapshot, lineage: Readonly<Record<string, string>>): Observation {
  const ref = o.context;
  if (ref === undefined || !(ref.startsWith('walk:') || ref.startsWith('session:'))) return o;
  const now = canonical(lineage, ref);
  if (lives(base, now)) return now === ref ? o : { ...o, context: now };
  const { context: _gone, ...alone } = o;
  void _gone;
  return alone as Observation;
}

const renamedItems = (items: unknown, rename: (id: string) => string | undefined) =>
  (Array.isArray(items) ? items.map(i => {
    if (!isObject(i) || i.kind !== 'custom' || typeof i.customId !== 'string') return i;
    const to = rename(i.customId);
    return to === undefined || to === i.customId ? i : { ...i, customId: to };
  }) : items);
const named = (items: unknown, id: string) => Array.isArray(items) && items.some(i => isObject(i) && i.kind === 'custom' && i.customId === id);
/** A meal's or a usual meal's items, each own food named as the one that bears it now. */
const withItems = (r: StoredRecord, rename: (id: string) => string | undefined): StoredRecord => ({
  ...r,
  items: renamedItems(r.items, rename),
  ...(Array.isArray(r.edits) ? { edits: r.edits.map(e => (isObject(e) ? { ...e, items: renamedItems(e.items, rename) } : e)) } : {}),
});

/**
 * Put an entry back (B-05, D110): fresh ids with `restoredFrom`, each
 * record's own times and commit order kept, what it names rewritten through
 * this device's lineage, the renaming kept as lineage, and the entry dropped,
 * in one change. `fresh.stem` names a reading, a blood pressure reading, a
 * meal, a usual meal or an own food; `fresh.walkId` a walk.
 */
export function planRestore(entryId: string, base: Snapshot, fresh: { stem: string; walkId: string }, now: number): { change: Change; restored: Restored } {
  const entry = restorable(base.content, entryId, now);
  if (!entry) throw new StoreFailure('invalid', NOT_RECENT);
  const lineage = lineageIn(base.content);
  // `order` and `seq` are kept: the place each was said in, here and on any device (P8-10, P8R-06).
  const back = (o: Observation, id: string, context?: string): Observation => ({ ...o, id, ...(context !== undefined ? { context } : {}), restoredFrom: o.id });
  const links: Record<string, unknown> = {};
  const link = (from: string, to: string) => { links[lineageKey(from)] = { to, at: new Date(now).toISOString() }; };
  const foodNow = (id: string) => {
    const to = canonical(lineage, `customFood:${id}`).slice('customFood:'.length);
    return base.records.customFoods.some(f => recordKey('customFoods', f) === to) ? to : undefined;
  };
  let observations: Observation[] = [];
  const records: Partial<Record<RecordStore, StoredRecord[]>> = {};
  let restored: Restored;
  switch (entry.kind) {
    case 'reading': {
      observations = (entry.observations ?? []).map(o => relinked(back(o, fresh.stem), base, lineage));
      restored = { kind: 'reading', id: fresh.stem };
      break;
    }
    case 'pressure': {
      const reading = `reading-${fresh.stem}`;
      observations = (entry.observations ?? []).map(o => back(o, `${reading}:${o.kind}`, `bp:${reading}`));
      restored = { kind: 'pressure', id: reading };
      break;
    }
    case 'walk': {
      const was = entry.of;
      const to = fresh.walkId;
      const renamed = (id: string) => (id.startsWith(`${was}:`) ? `${to}:${id.slice(was.length + 1)}` : `${to}:${id}`);
      observations = (entry.observations ?? []).map(o => back(o, renamed(o.id), `walk:${to}`));
      // A route from before the last "Erase all routes" never comes back (Plan 6's rule, B-05).
      const routes = (entry.records?.routes ?? []).filter(r => RECORD_RULES.routes.keeps?.(base.settings, r) ?? true);
      if (routes.length > 0) records.routes = routes.map(r => ({ ...r, walkId: to, restoredFrom: was }));
      link(`walk:${was}`, `walk:${to}`);
      restored = { kind: 'walk', id: to };
      break;
    }
    case 'meal':
    case 'usualMeal':
    case 'ownFood': {
      const store = STORE_OF[entry.kind]!;
      const id = `${PREFIX_OF[entry.kind]}-${fresh.stem}`;
      // A meal names the own food that came back for one it named (P8R-05); one still gone stays named
      // as it was, so the food's own restore, within its 7 days, names itself in it again. In a store
      // whose merge reads a record and its copies as one, every copy names the original (Plan 7's D147).
      const original = (r: StoredRecord) => (RECORD_RULES[store].restores && typeof r.restoredFrom === 'string' ? r.restoredFrom : entry.of);
      records[store] = (entry.records?.[store] ?? []).map(r => ({ ...(entry.kind === 'ownFood' ? r : withItems(r, foodNow)), id, restoredFrom: original(r) }));
      if (entry.kind === 'ownFood') {
        const rename = (x: string) => (x === entry.of ? id : undefined);
        const meals = base.records.meals.filter(m => named(m.items, entry.of) || (Array.isArray(m.edits) && m.edits.some(e => isObject(e) && named(e.items, entry.of))));
        if (meals.length > 0) records.meals = meals.map(m => withItems(m, rename));
        const usual = base.records.savedMeals.filter(u => named(u.items, entry.of));
        if (usual.length > 0) records.savedMeals = usual.map(u => withItems(u, rename));
        link(`customFood:${entry.of}`, `customFood:${id}`);
      }
      restored = { kind: entry.kind, id };
      break;
    }
    case 'session':
    case 'checkInReading':
      throw new StoreFailure('invalid', OWN_SCREEN);
  }
  for (const o of observations) {
    const problem = observationProblem(o);
    if (problem) throw new StoreFailure('invalid', `That can’t be restored: ${problem}`);
  }
  for (const [store, rows] of Object.entries(records) as [RecordStore, StoredRecord[]][]) {
    for (const r of rows) {
      const problem = recordProblem(store, r);
      if (problem) throw new StoreFailure('invalid', `That can’t be restored: ${RECORD_RULES[store].label.one}: ${problem}`);
    }
  }
  return {
    restored,
    change: {
      ...(observations.length > 0 ? { observations: { put: observations, keepSeq: true } } : {}),
      ...(Object.keys(records).length > 0 ? { records: Object.fromEntries(Object.entries(records).map(([store, rows]) => [store, { put: rows }])) } : {}),
      content: { put: links, remove: [recentKey(entryId)] },
    },
  };
}

/**
 * "Erase all routes" (B-05, D93): every entry without its route, and an entry
 * that can't be read, gone. No coordinate stays in a deletion. Nothing to do:
 * undefined.
 */
export function recentWithoutRoutes(content: Readonly<Record<string, unknown>>): { put: Record<string, unknown>; remove: string[] } | undefined {
  const put: Record<string, unknown> = {};
  const remove: string[] = [];
  for (const [key, value] of Object.entries(content)) {
    if (!isRecentKey(key)) continue;
    const e = asRecent(value);
    if (!e) {
      remove.push(key);
      continue;
    }
    if (!e.records?.routes) continue;
    const { records, ...rest } = e;
    const others = Object.fromEntries(Object.entries(records ?? {}).filter(([store]) => store !== 'routes'));
    put[key] = Object.keys(others).length > 0 ? { ...rest, records: others } : rest;
  }
  return Object.keys(put).length > 0 || remove.length > 0 ? { put, remove } : undefined;
}

/**
 * The settings without a `deleted.recent` (D109): this app never writes one,
 * so one that is there came from a file, and is never this device's to
 * restore. Every other deletion record stays. The same settings back when
 * there is none.
 */
export function withoutRecentCarrier(settings: UserSettings | undefined): UserSettings | undefined {
  const deleted = settings?.deleted as (Record<string, unknown> | undefined);
  if (!deleted || !Object.hasOwn(deleted, 'recent')) return settings;
  const { recent: _carried, ...rest } = deleted;
  void _carried;
  return { ...settings, deleted: rest } as UserSettings;
}

/**
 * A file's references read through this device's lineage, before a merge
 * compares anything (B-05, D110, P8-09): a pain rating after a walk, and a
 * meal's own food, name the record that survives here. A record's own key
 * isn't a reference: an older file's deleted original stays deleted by its
 * deletion record.
 */
export function throughLineage(file: TransferDoc, lineage: Readonly<Record<string, string>>): TransferDoc {
  if (Object.keys(lineage).length === 0) return file;
  const context = (c: string | undefined) => (c !== undefined && (c.startsWith('walk:') || c.startsWith('session:')) ? canonical(lineage, c) : c);
  const food = (id: string) => canonical(lineage, `customFood:${id}`).slice('customFood:'.length);
  const records = file.records;
  return {
    ...file,
    observations: file.observations.map(o => {
      const c = context(o.context);
      return c === o.context ? o : { ...o, context: c! };
    }),
    ...(records ? {
      records: {
        ...records,
        ...(records.meals ? { meals: records.meals.map(m => withItems(m, food)) } : {}),
        ...(records.savedMeals ? { savedMeals: records.savedMeals.map(u => withItems(u, food)) } : {}),
      },
    } : {}),
  };
}
