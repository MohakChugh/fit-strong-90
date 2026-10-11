/**
 * "Log a meal" (journey §11.3, M15): the meal, when, Your usual, the tray,
 * search or Common Indian foods, and Save. "Lunch saved" shows only once the
 * meal is stored (§4.5). The same sheet corrects a logged meal, keeping the
 * version it replaces (A-22), and deletes it, with Undo (B-04, B-05). Sheets
 * never nest, so a food's portion, your own food and Quick add are pages in
 * place of the tray.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { toast } from 'sonner';
import { Group, Row } from '@/components/hig/List';
import { cameFrom } from '@/components/hig/navigation';
import { Sheet } from '@/components/hig/Sheet';
import { TOAST_STYLE } from '@/components/hig/toast';
import { allergiesOf, allergyWarning, ownFoodTags } from '@/food/allergens';
import { FOOD_COPY } from '@/food/copy';
import { FOODS, foodById } from '@/food/data';
import { openDraft } from '@/food/draft';
import { customItem, refreshItem, totalsOf } from '@/food/estimate';
import { itemsLine, SLOT_LABEL, totalsLines } from '@/food/format';
import { foodLevel, numbersView } from '@/food/level';
import type { LogRequest } from '@/food/links';
import { customFoodsIn, mealsIn, savedMealsIn } from '@/food/records';
import { commonFoods, searchFoods } from '@/food/search';
import { deleteMeal, newMealId, newUsualId, restoreMeal, saveCorrection, saveMeal } from '@/food/store';
import { addFood, step, type Lookup } from '@/food/tray';
import type { CustomFood, Food, FoodItem, MealItem, Slot } from '@/food/types';
import { countText, portionText } from '@/food/units';
import { usualFor } from '@/food/usual';
import { nowAt } from '@/health/observation';
import { prefersHour12 } from '@/lib/time';
import { formatClock, formatDayRelative } from '@/screens/track/format';
import { fromLocalInput } from '@/screens/track/logKinds';
import { ErrorText, Hint, PrimaryButton, SecondaryButton, Segmented } from '@/screens/track/ui';
import { useToday } from '@/screens/track/useToday';
import { TimeRow } from '@/screens/track/WhenRows';
import { Toggle } from '@/screens/you/controls';
import { useClock } from '@/screens/today/clock';
import { useStore } from '@/store/useStore';
import { FoodRow, ItemRow, OwnFoodPage, PortionPage, QuickPage } from './parts';
import { useHeldQuery } from './useHeldQuery';
import { endFoodUndos, offerFoodUndo } from './undo';

const SLOTS: Slot[] = ['breakfast', 'lunch', 'snack', 'dinner'];
const SLOT_OPTIONS = SLOTS.map(id => ({ id, label: SLOT_LABEL[id] }));
const FIELD = 'h-11 w-full rounded-xl bg-grouped-card px-4 text-[length:var(--text-body)] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-tint/50';
const LABEL = 'px-4 pb-2 text-[length:var(--text-footnote)] font-medium uppercase tracking-wide text-muted-foreground';

/** A time that hasn't come yet, read when Save is tapped. */
const notYet = (at: string) => Date.parse(at) > Date.now();

type Page =
  | { kind: 'tray' }
  | { kind: 'portion'; foodId: string; index?: number }
  | { kind: 'own'; name: string }
  | { kind: 'quick' }
  | { kind: 'discard' };

export function LogMealSheet({ request, onClose }: { request: LogRequest; onClose: () => void }) {
  const { profile, records } = useStore();
  const today = useToday();
  const { now: clock } = useClock();
  const hour12 = prefersHour12();
  const ids = { search: useId(), usual: useId() };
  const numbers = numbersView(profile);
  const allergies = allergiesOf(profile?.food);
  const meals = mealsIn(records);
  const saved = savedMealsIn(records);
  const customs = customFoodsIn(records);
  // The person's own foods added in this sheet: stored with the meal, in one change.
  const [own, setOwn] = useState<CustomFood[]>([]);
  const look: Lookup = { food: foodById, custom: id => own.find(c => c.id === id) ?? customs.find(c => c.id === id) };
  const [draft] = useState(() => openDraft(request, { now: nowAt(), meals, saved, look }));
  const editing = draft.editing;
  // Made once, when the sheet opens: a second tap on Save writes this meal again, never a second one.
  const [mealId] = useState(() => editing?.id ?? newMealId());
  const [usualId] = useState(newUsualId);
  const [slot, setSlot] = useState<Slot>(draft.slot);
  const [items, setItems] = useState<MealItem[]>(draft.items);
  const [whenInput, setWhenInput] = useState<string>();
  const [keepUsual, setKeepUsual] = useState(false);
  const [usualName, setUsualName] = useState('');
  const [page, setPage] = useState<Page>(draft.page);
  const [query, setQuery] = useState('');
  const [added, setAdded] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const busy = useRef(false);
  const [opened] = useState(() => JSON.stringify([draft.slot, draft.items]));
  const { shownQuery, listProps } = useHeldQuery(query, page.kind === 'tray');

  const at = whenInput !== undefined ? fromLocalInput(whenInput) : draft.at;
  // Read against the clock that ticks each minute; Save checks again when tapped.
  const future = at !== undefined && Date.parse(at) > clock.getTime();
  const dirty = JSON.stringify([slot, items]) !== opened || whenInput !== undefined || own.length > 0 || keepUsual;
  const lines = totalsLines(totalsOf(items), numbers);
  const results = useMemo(() => searchFoods(shownQuery, FOODS, [...own, ...customs]), [shownQuery, own, customs]);
  const usual = editing || items.length > 0 ? [] : usualFor(slot, today, meals, saved);
  const typed = shownQuery.trim();

  const foodWarning = (f: Food) => allergyWarning({ ...f.allergens, words: f.words }, allergies);
  const customWarning = (c: CustomFood) => allergyWarning(ownFoodTags(c), allergies);
  const itemWarning = (item: MealItem) => {
    if (item.kind === 'food') {
      const food = foodById(item.foodId);
      return food ? foodWarning(food) : undefined;
    }
    // Your own food as it is now, or, when it's gone, its name alone with nothing known of it (H7-10).
    return item.kind === 'custom' ? allergyWarning(ownFoodTags({ name: item.name, allergens: look.custom(item.customId)?.allergens }), allergies) : undefined;
  };
  const portionOf = (item: MealItem) => {
    if (item.kind === 'quick') return item.name;
    // As it was logged, whatever the food is now (board D134).
    if (item.kind === 'custom') return `${countText(item.count)} × ${item.per.qty} ${item.per.unit}`;
    return portionText({ unit: item.unit, noun: foodById(item.foodId)?.portion.noun }, item.count, item.gramsPerPortion);
  };

  const add = (food: Food) => {
    setItems(list => addFood(list, food, look));
    setAdded(food.id);
    // "Added ✓" for a second (M15).
    window.setTimeout(() => setAdded(a => (a === food.id ? undefined : a)), 1000);
  };
  // Browser or system Back goes through the same guards as Close (H7-19): with a draft it asks first, and
  // while saving it waits, going once the save lands and staying, draft and reason kept, if it's refused.
  // The sheet's own leaving isn't held.
  const leaving = useRef(false);
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    !leaving.current && (saving || dirty) && (nextLocation.pathname !== currentLocation.pathname || nextLocation.search !== currentLocation.search));
  // The blocker as it is now, for a handler that awaited a save.
  const latest = useRef(blocker);
  useEffect(() => {
    latest.current = blocker;
  });
  if (blocker.state === 'blocked' && !saving && page.kind !== 'discard') setPage({ kind: 'discard' });
  const leave = () => {
    leaving.current = true;
    if (latest.current.state === 'blocked') latest.current.proceed();
    else onClose();
  };
  const stay = () => {
    if (latest.current.state === 'blocked') latest.current.reset();
  };
  const close = () => {
    if (saving) return;
    if (dirty && page.kind !== 'discard') setPage({ kind: 'discard' });
    else leave();
  };

  const save = async () => {
    if (busy.current || items.length === 0 || (at !== undefined && notYet(at))) return;
    busy.current = true;
    setSaving(true);
    setError(undefined);
    const now = nowAt();
    const when = at ?? now;
    const result = editing
      ? await saveCorrection(editing, { at: when, meal: slot, items }, now, {
        customFoods: own,
        // What changed, so the person can see why nothing was saved: the draft stays (board D135).
        describe: current => (current
          ? FOOD_COPY.changedElsewhere(formatClock(current.editedAt ?? current.loggedAt, hour12), `${SLOT_LABEL[current.meal]}, ${itemsLine(current.items)}`)
          : FOOD_COPY.deletedElsewhere),
      })
      : await saveMeal(
        { id: mealId, at: when, day: when.slice(0, 10), meal: slot, items, level: foodLevel(profile?.food) === 'estimates' ? 'estimates' : 'meals', loggedAt: now, edits: [] },
        {
          customFoods: own,
          ...(keepUsual ? { usual: { id: usualId, name: usualName.trim().slice(0, 60) || itemsLine(items).slice(0, 60), meal: slot, items, savedAt: now, updatedAt: now } } : {}),
        },
      );
    busy.current = false;
    setSaving(false);
    if (!result.ok) {
      stay();
      setError(result.failure.code === 'conflict' ? result.failure.message : `${FOOD_COPY.didNotSave} ${result.failure.message}`);
      return;
    }
    // A save is an unrelated change: any Undo still standing ends (B-04).
    endFoodUndos();
    toast(editing ? FOOD_COPY.updated(SLOT_LABEL[slot]) : FOOD_COPY.saved(SLOT_LABEL[slot]), { style: TOAST_STYLE });
    leave();
  };

  const remove = async () => {
    if (!editing || busy.current) return;
    busy.current = true;
    setSaving(true);
    const result = await deleteMeal(editing.id);
    busy.current = false;
    setSaving(false);
    if (!result.ok) {
      stay();
      setError(`${FOOD_COPY.didNotSave} ${result.failure.message}`);
      return;
    }
    const gone = editing;
    offerFoodUndo({
      text: FOOD_COPY.deleted(SLOT_LABEL[gone.meal]),
      restored: FOOD_COPY.restored(SLOT_LABEL[gone.meal]),
      // The screen the sheet goes back to: Today's log, or the hub.
      scope: cameFrom() ?? '/hub/food',
      undo: async () => {
        const back = await restoreMeal(gone);
        return back.ok ? undefined : back.failure.message;
      },
    });
    leave();
  };

  const portionFood = page.kind === 'portion' ? foodById(page.foodId) : undefined;
  const title = editing ? FOOD_COPY.editTitle(SLOT_LABEL[editing.meal]) : FOOD_COPY.logTitle;

  return (
    <Sheet open onOpenChange={next => { if (!next) close(); }} title={title} detent="large" dismissible={!saving}>
      {page.kind === 'discard' && (
        <div className="flex flex-col gap-3">
          <p className="px-1 text-[length:var(--text-body)] font-semibold">{FOOD_COPY.discardTitle}</p>
          <Hint>{FOOD_COPY.discardDetail}</Hint>
          <PrimaryButton onClick={() => { stay(); setPage({ kind: 'tray' }); }}>{FOOD_COPY.keepEditing}</PrimaryButton>
          <SecondaryButton tone="stop" onClick={leave}>{FOOD_COPY.discard}</SecondaryButton>
        </div>
      )}

      {page.kind === 'portion' && portionFood && (
        <PortionPage
          key={`${page.foodId}:${page.index ?? 'new'}`}
          food={portionFood}
          {...(page.index !== undefined ? { item: items[page.index] as FoodItem, onRemove: () => { setItems(list => list.filter((_, i) => i !== page.index)); setPage({ kind: 'tray' }); } } : {})}
          numbers={numbers}
          allergies={allergies}
          look={look}
          onBack={() => setPage({ kind: 'tray' })}
          onSave={item => {
            setItems(list => (page.index !== undefined ? list.map((x, i) => (i === page.index ? item : x)) : [...list, item]));
            setPage({ kind: 'tray' });
          }}
        />
      )}

      {page.kind === 'own' && (
        <OwnFoodPage
          name={page.name}
          numbers={numbers}
          onBack={() => setPage({ kind: 'tray' })}
          onAdd={food => {
            setOwn(list => [...list, food]);
            setItems(list => [...list, customItem(food)]);
            setQuery('');
            setPage({ kind: 'tray' });
          }}
        />
      )}

      {page.kind === 'quick' && (
        <QuickPage
          numbers={numbers}
          onBack={() => setPage({ kind: 'tray' })}
          onAdd={item => {
            setItems(list => [...list, item]);
            setPage({ kind: 'tray' });
          }}
        />
      )}

      {page.kind === 'tray' && (
        <div className="flex flex-col gap-6">
          {draft.gone && <Hint>{FOOD_COPY.gone}</Hint>}
          <Segmented label={FOOD_COPY.meal} options={SLOT_OPTIONS} value={slot} onChange={setSlot} />
          <TimeRow
            label={FOOD_COPY.when}
            value={whenInput}
            onChange={setWhenInput}
            {...(draft.at ? { captured: { at: draft.at, label: `${formatDayRelative(draft.at.slice(0, 10), today)}, ${formatClock(draft.at, hour12)}` } } : {})}
          />
          {future && <ErrorText>{FOOD_COPY.futureTime}</ErrorText>}

          {usual.length > 0 && (
            <Group header={FOOD_COPY.yourUsual}>
              {usual.map(u => (
                <Row
                  key={u.key}
                  onClick={() => {
                    setItems(u.items.map(i => (i.kind === 'food' ? refreshItem(i, foodById(i.foodId)) : i)));
                    setSlot(u.meal);
                  }}
                  label={u.label}
                  detail={u.detail}
                />
              ))}
            </Group>
          )}

          <Group header={FOOD_COPY.yourMeal} footer={[lines.estimate, lines.missing, numbers.show && numbers.ranges ? FOOD_COPY.roughCarbs : undefined].filter(Boolean).join('. ') || undefined}>
            {items.length === 0 ? (
              <Row label={FOOD_COPY.nothingAdded} />
            ) : (
              items.map((item, i) => {
                const food = item.kind === 'food' ? foodById(item.foodId) : undefined;
                return (
                  <ItemRow
                    key={`${i}:${item.name}`}
                    item={item}
                    portion={portionOf(item)}
                    numbers={numbers}
                    {...(itemWarning(item) ? { warning: itemWarning(item) } : {})}
                    {...(food && item.kind === 'food' ? { onOpen: () => setPage({ kind: 'portion', foodId: food.id, index: i }) } : {})}
                    onChange={by => setItems(list => list.map((x, j) => (j === i ? step(x, by, look) : x)))}
                    onRemove={() => setItems(list => list.filter((_, j) => j !== i))}
                  />
                );
              })
            )}
          </Group>

          <div className="flex flex-col">
            <label htmlFor={ids.search} className={LABEL}>{FOOD_COPY.search}</label>
            <input
              id={ids.search}
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={FOOD_COPY.searchPlaceholder}
              enterKeyHint="search"
              autoComplete="off"
              className={FIELD}
            />
          </div>

          <div {...listProps}>
            {typed === '' ? (
              <Group header={FOOD_COPY.common}>
                {commonFoods(FOODS, slot).map(f => (
                  <FoodRow
                    key={f.id}
                    food={f}
                    numbers={numbers}
                    {...(foodWarning(f) ? { warning: foodWarning(f) } : {})}
                    added={added === f.id}
                    onOpen={() => setPage({ kind: 'portion', foodId: f.id })}
                    onAdd={() => add(f)}
                  />
                ))}
              </Group>
            ) : (
              <Group header={FOOD_COPY.results} {...(results.foods.length + results.customs.length === 0 ? { footer: FOOD_COPY.noResults(typed) } : {})}>
                {results.customs.map(c => (
                  <Row
                    key={c.id}
                    onClick={() => setItems(list => [...list, customItem(c)])}
                    label={c.name}
                    detail={[`${c.per.qty} ${c.per.unit}`, customWarning(c)].filter(Boolean).join(' · ')}
                    accessory={<span className="shrink-0 text-[length:var(--text-body)] font-semibold text-tint">{FOOD_COPY.add}</span>}
                  />
                ))}
                {results.foods.map(f => (
                  <FoodRow
                    key={f.id}
                    food={f}
                    numbers={numbers}
                    {...(foodWarning(f) ? { warning: foodWarning(f) } : {})}
                    added={added === f.id}
                    onOpen={() => setPage({ kind: 'portion', foodId: f.id })}
                    onAdd={() => add(f)}
                  />
                ))}
                <Row onClick={() => setPage({ kind: 'own', name: typed })} label={FOOD_COPY.ownFood(typed)} chevron />
                <Row onClick={() => setPage({ kind: 'quick' })} label={FOOD_COPY.quickAdd} chevron />
              </Group>
            )}
          </div>

          {!editing && (
            <Group>
              <Row label={FOOD_COPY.saveAsUsual} accessory={<Toggle checked={keepUsual} onChange={setKeepUsual} label={FOOD_COPY.saveAsUsual} />} />
              {keepUsual && (
                <div className="flex flex-col px-4 py-2">
                  <label htmlFor={ids.usual} className="pb-1 text-[length:var(--text-subhead)] text-muted-foreground">{FOOD_COPY.usualName}</label>
                  <input id={ids.usual} value={usualName} maxLength={60} placeholder={itemsLine(items)} onChange={e => setUsualName(e.target.value)} className={FIELD} />
                </div>
              )}
            </Group>
          )}

          {editing && editing.edits.length > 0 && (
            <Group header={FOOD_COPY.history}>
              {[...editing.edits].reverse().map(e => (
                <Row
                  key={e.replacedAt}
                  label={FOOD_COPY.historyRow(`${formatDayRelative(e.replacedAt.slice(0, 10), today)}, ${formatClock(e.replacedAt, hour12)}`)}
                  detail={`${SLOT_LABEL[e.meal]}, ${formatClock(e.at, hour12)} · ${itemsLine(e.items)}`}
                />
              ))}
            </Group>
          )}

          {error && <ErrorText>{error}</ErrorText>}
          <PrimaryButton onClick={() => void save()} disabled={saving || items.length === 0 || future || (editing !== undefined && !dirty)}>
            {saving ? FOOD_COPY.saving : FOOD_COPY.save}
          </PrimaryButton>
          {editing && <SecondaryButton tone="stop" onClick={() => void remove()} disabled={saving}>{FOOD_COPY.deleteMeal}</SecondaryButton>}
        </div>
      )}
    </Sheet>
  );
}
