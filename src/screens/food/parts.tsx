/**
 * The "Log a meal" sheet's pieces (journey §11.3, M15, B-08): a tray row with
 * "Less" and "More", a food's row with its "+", and the pages the sheet shows
 * in place of the tray, because sheets never nest: a food's portion, your own
 * food, and Quick add.
 */
import { useEffect, useId, useState } from 'react';
import { ChevronLeftIcon, PlusIcon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { ALLERGENS, allergenList, allergenName, allergyWarning, type Allergies } from '@/food/allergens';
import { FOOD_COPY } from '@/food/copy';
import { foodItem, QUICK_NAME, quickItem } from '@/food/estimate';
import { foodRowDetail, itemEstimate } from '@/food/format';
import type { NumbersView } from '@/food/level';
import { itemProblem } from '@/food/records';
import { newCustomId } from '@/food/store';
import { moreFits, step, stepOf, weighed, type Lookup } from '@/food/tray';
import type { CustomFood, Food, FoodItem, MealItem, QuickItem } from '@/food/types';
import { portionText, UNITS } from '@/food/units';
import { nowAt } from '@/health/observation';
import { ErrorText, Hint, NumberField, PrimaryButton, SecondaryButton, Segmented } from '@/screens/track/ui';
import { CheckRows } from '@/screens/you/controls';
import type { AllergenId } from '@/types/profile';

// 48 px targets, 12 px apart (§20.4 rule 1; board D141).
const STEP = 'press-feedback flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-1 rounded-full bg-grouped-bg px-3 text-[length:var(--text-subhead)] font-semibold text-tint disabled:opacity-40';
const FIELD = 'h-12 w-full rounded-xl bg-grouped-card px-4 text-[length:var(--text-body)] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-tint/50';
const LABEL = 'px-4 pb-2 text-[length:var(--text-footnote)] font-medium uppercase tracking-wide text-muted-foreground';

/**
 * "Less" and "More" with what they change between them (B-08). At the smallest
 * step, "Less" reads "Remove". In a narrow container, and so at large text
 * (the breakpoints are in rem, which grows with it), the quantity takes its
 * own line above the two buttons, so neither squeezes it; narrower still, each
 * button has a line of its own (H7-16; board D141).
 */
export function Stepper({ label, text, onLess, onMore, removes, moreDisabled }: {
  label: string;
  text: string;
  onLess: () => void;
  onMore: () => void;
  removes: boolean;
  moreDisabled: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="@container">
      <div className="flex items-center gap-3 @max-[22rem]:grid @max-[22rem]:grid-cols-2 @max-[13rem]:grid-cols-1">
        <button type="button" className={`${STEP} @max-[22rem]:order-2`} onClick={onLess}>
          {removes ? FOOD_COPY.remove : <><span aria-hidden>−</span>{FOOD_COPY.less}</>}
        </button>
        <span className="numeric min-w-0 flex-1 text-center text-[length:var(--text-body)] [overflow-wrap:break-word] @max-[22rem]:col-span-full @max-[22rem]:order-1">{text}</span>
        <button type="button" className={`${STEP} @max-[22rem]:order-3`} onClick={onMore} disabled={moreDisabled}>
          <span aria-hidden>+</span>{FOOD_COPY.more}
        </button>
      </div>
    </div>
  );
}

/** One item in the tray: its name opens its portion page, and "Less" and "More" change it at once, with its estimate (M15). */
export function ItemRow({ item, portion, numbers, warning, more, onOpen, onChange, onRemove }: {
  item: MealItem;
  portion: string;
  numbers: NumbersView;
  warning?: string;
  /** Whether "More" makes an item the store keeps (`moreFits`). */
  more: boolean;
  /** Absent when there's no portion page: a food the table no longer has, your own food, Quick add. */
  onOpen?: () => void;
  onChange: (by: 1 | -1) => void;
  onRemove: () => void;
}) {
  const estimate = itemEstimate(item, numbers);
  const text = (
    <>
      <span className="block text-[length:var(--text-body)] leading-snug">{item.name}</span>
      <span className="block text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{[portion, estimate].filter(Boolean).join(' · ')}</span>
      {warning && <span className="block text-[length:var(--text-subhead)] leading-snug text-caution">{warning}</span>}
    </>
  );
  const atLeast = item.kind === 'quick' || item.count <= stepOf(item);
  return (
    <div data-item={item.name} className="flex flex-col gap-2 px-4 py-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
      {onOpen ? <button type="button" onClick={onOpen} className="press-feedback text-left">{text}</button> : <div>{text}</div>}
      {item.kind === 'quick'
        ? <SecondaryButton tone="stop" onClick={onRemove}>{FOOD_COPY.remove}</SecondaryButton>
        : <Stepper label={item.name} text={portion} removes={atLeast} onLess={() => (atLeast ? onRemove() : onChange(-1))} onMore={() => onChange(1)} moreDisabled={!more} />}
    </div>
  );
}

/** A food in a list: its name opens its portion page, and "+" adds one standard portion at once, saying "Added ✓" for a second (M15). */
export function FoodRow({ food, numbers, warning, added, onOpen, onAdd }: {
  food: Food;
  numbers: NumbersView;
  warning?: string;
  added: boolean;
  onOpen: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center gap-3 pr-3">
      <button type="button" onClick={onOpen} className="press-feedback min-h-[3.25rem] min-w-0 flex-1 px-4 py-2.5 text-left">
        <span className="block text-[length:var(--text-body)] leading-snug">{food.name}</span>
        <span className="block text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{foodRowDetail(food, numbers)}</span>
        {warning && <span className="block text-[length:var(--text-subhead)] leading-snug text-caution">{warning}</span>}
      </button>
      <button
        type="button"
        aria-label={FOOD_COPY.addOne(food.name)}
        onClick={onAdd}
        className="press-feedback flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-1 rounded-full bg-tint px-3 text-[length:var(--text-subhead)] font-semibold text-on-tint"
      >
        {/* "Added ✓" carries its own tick, so no icon beside it. */}
        {added ? FOOD_COPY.added : <><PlusIcon className="size-4" aria-hidden />{FOOD_COPY.add}</>}
      </button>
    </div>
  );
}

/** The FDC records a dish's values come from, once each. */
const fdcIds = (food: Food) => [...new Set(food.recipe.ingredients.flatMap(i => (i.fdcId === null ? [] : [i.fdcId])))];

function BackToMeal({ onBack }: { onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} className="press-feedback flex min-h-12 items-center gap-1 self-start text-[length:var(--text-body)] text-tint">
      <ChevronLeftIcon className="size-5" aria-hidden />{FOOD_COPY.backToMeal}
    </button>
  );
}

/**
 * Tells the sheet whether a page holds what the person hasn't added yet, so a Back or Close asks first, and
 * that it holds nothing once the page goes (H7-19). `onDirty` is the sheet's own setter, so it never changes.
 */
function useHolds(holds: boolean, onDirty?: (holds: boolean) => void): void {
  useEffect(() => {
    onDirty?.(holds);
    return () => onDirty?.(false);
  }, [holds, onDirty]);
}

/** A food's portion page (journey §11.3, §11.6): its unit with the grams, "Weigh yours", what's in it, and its allergens. */
export function PortionPage({ food, item, numbers, allergies, look, onBack, onSave, onRemove, onDirty }: {
  food: Food;
  /** The tray's item, when the food is in the meal already. */
  item?: FoodItem;
  numbers: NumbersView;
  allergies: Allergies;
  look: Lookup;
  onBack: () => void;
  onSave: (item: FoodItem) => void;
  onRemove?: () => void;
  onDirty?: (holds: boolean) => void;
}) {
  const [opened] = useState<FoodItem>(() => item ?? foodItem(food));
  const [draft, setDraft] = useState<FoodItem>(opened);
  const [weighing, setWeighing] = useState(draft.weighed === true);
  const [grams, setGrams] = useState(String(draft.gramsPerPortion));
  useHolds(JSON.stringify(draft) !== JSON.stringify(opened) || grams !== String(draft.gramsPerPortion), onDirty);
  const [problem, setProblem] = useState<string>();
  const unit = UNITS[food.portion.unit];
  const one = food.portion.unit === 'piece' && food.portion.noun ? food.portion.noun[0] : unit.one;
  const warning = allergyWarning({ ...food.allergens, words: food.words }, allergies);
  const estimate = itemEstimate(draft, numbers);
  /** The portion with the weight in the field applied, or nothing when that weight can't be right (H7-12). */
  const applied = (): FoodItem | undefined => {
    if (!weighing || grams === String(draft.gramsPerPortion)) return draft;
    const g = Number(grams);
    // As the store will keep it, or not at all: a weight that rounds to nothing, or one more than an item holds.
    const next = weighed(draft, g, food);
    if (itemProblem(next) !== undefined) {
      setProblem(FOOD_COPY.ownBadFigure);
      return undefined;
    }
    setProblem(undefined);
    return next;
  };
  const weigh = () => {
    const next = applied();
    if (next) setDraft(next);
  };
  // The page's own action takes the weight as typed, applied or not, and is stopped by one that can't be right.
  const commit = () => {
    const next = applied();
    if (next) onSave(next);
  };
  return (
    <div className="flex flex-col gap-4">
      <BackToMeal onBack={onBack} />
      <h3 className="px-1 text-[length:var(--text-body)] font-semibold">{food.name}</h3>
      <Group {...(unit.volume ? { footer: unit.volume } : {})}>
        <div className="flex flex-col gap-2 px-4 py-3">
          <Stepper
            label={food.name}
            text={portionText(food.portion, draft.count, draft.gramsPerPortion)}
            removes={false}
            onLess={() => setDraft(d => step(d, -1, look) as FoodItem)}
            onMore={() => setDraft(d => step(d, 1, look) as FoodItem)}
            moreDisabled={!moreFits(draft, look)}
          />
          {estimate && <p className="text-center text-[length:var(--text-subhead)] text-muted-foreground">{estimate}</p>}
          {/* The tray's footer says it there; this page stands in for the tray (K-22). */}
          {estimate && numbers.show && numbers.ranges && <p className="text-center text-[length:var(--text-footnote)] text-muted-foreground">{FOOD_COPY.roughCarbs}</p>}
          {warning && <p className="text-[length:var(--text-subhead)] text-caution">{warning}</p>}
        </div>
      </Group>
      <Group>
        {!weighing ? (
          <Row onClick={() => setWeighing(true)} label={FOOD_COPY.weigh} chevron />
        ) : (
          <div className="flex flex-col gap-2 px-4 py-3">
            <NumberField label={FOOD_COPY.weighLabel(one)} mode="numeric" unit="g" value={grams} onChange={v => { setGrams(v); setProblem(undefined); }} invalid={!!problem} />
            <Hint>{FOOD_COPY.weighHint}</Hint>
            <SecondaryButton onClick={weigh}>{FOOD_COPY.useWeight}</SecondaryButton>
            {problem && <ErrorText>{problem}</ErrorText>}
          </div>
        )}
      </Group>
      {/* Plain words in the rows; the FDC records each value comes from, as its sources (§20.4 rule 5, K7-15). */}
      <Group header={FOOD_COPY.whatsInIt} footer={`${food.recipe.note}. ${FOOD_COPY.recipeNote} ${FOOD_COPY.fdcSources(fdcIds(food).join(', '), fdcIds(food).length > 1)}`}>
        {food.recipe.ingredients.map(i => (
          <Row key={i.key} label={i.name} detail={i.fdcId === null ? FOOD_COPY.notCounted : FOOD_COPY.usdaValue} value={`${i.grams} g`} numeric />
        ))}
        <Row
          label={food.allergens.contains.length > 0 ? FOOD_COPY.contains(allergenList(food.allergens.contains)) : FOOD_COPY.noTaggedAllergens}
          {...(food.allergens.mayContain.length > 0 ? { detail: FOOD_COPY.mayContain(allergenList(food.allergens.mayContain)) } : {})}
        />
      </Group>
      <PrimaryButton onClick={commit}>{item ? FOOD_COPY.done : FOOD_COPY.addToMeal}</PrimaryButton>
      {onRemove && <SecondaryButton tone="stop" onClick={onRemove}>{FOOD_COPY.remove}</SecondaryButton>}
    </div>
  );
}

const OWN_ALLERGENS: { value: AllergenId | 'none'; label: string }[] = [...ALLERGENS.map(a => ({ value: a.id, label: a.label })), { value: 'none', label: FOOD_COPY.ownNoneOfThese }];

/** A figure the person may leave blank: blank is unknown, never 0 (A-17); `null` can't be right. */
function figure(text: string, max: number): number | undefined | null {
  if (text.trim() === '') return undefined;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}

/** Your own food (journey §11.3): a name and what one portion is, with kcal and carbs only if known, and only with estimates. */
export function OwnFoodPage({ name: typed, numbers, allergies, onBack, onAdd, onDirty }: {
  name: string;
  numbers: NumbersView;
  /** The person's own, to name each one left unticked. */
  allergies: Allergies;
  onBack: () => void;
  onAdd: (food: CustomFood) => void;
  onDirty?: (holds: boolean) => void;
}) {
  const ids = { name: useId(), qty: useId(), unit: useId() };
  const [name, setName] = useState(typed);
  const [qty, setQty] = useState('1');
  const [unit, setUnit] = useState('plate');
  const [kcal, setKcal] = useState('');
  const [carbs, setCarbs] = useState('');
  // Nothing ticked is unknown; "None of these" is an answer (H7-04).
  const [allergens, setAllergens] = useState<(AllergenId | 'none')[]>([]);
  const [problem, setProblem] = useState<string>();
  useHolds(name !== typed || qty !== '1' || unit !== 'plate' || kcal !== '' || carbs !== '' || allergens.length > 0, onDirty);
  const add = () => {
    const q = Number(qty);
    const k = numbers.show ? figure(kcal, 5000) : undefined;
    const c = numbers.show ? figure(carbs, 1000) : undefined;
    if (!name.trim()) setProblem(FOOD_COPY.ownNoName);
    else if (!(q > 0 && q <= 10_000) || !unit.trim()) setProblem(FOOD_COPY.ownNoQty);
    else if (k === null || c === null) setProblem(FOOD_COPY.ownBadFigure);
    else {
      const now = nowAt();
      onAdd({
        id: newCustomId(), name: name.trim().slice(0, 60), per: { qty: q, unit: unit.trim().slice(0, 20) },
        ...(k !== undefined ? { kcal: k } : {}), ...(c !== undefined ? { carbsG: c } : {}),
        ...(allergens.length > 0 ? { allergens: allergens.filter((a): a is AllergenId => a !== 'none') } : {}), createdAt: now, updatedAt: now,
      });
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <BackToMeal onBack={onBack} />
      <h3 className="px-1 text-[length:var(--text-body)] font-semibold">{FOOD_COPY.ownTitle}</h3>
      <div className="flex flex-col">
        <label htmlFor={ids.name} className={LABEL}>{FOOD_COPY.ownName}</label>
        <input id={ids.name} value={name} maxLength={60} autoComplete="off" onChange={e => { setName(e.target.value); setProblem(undefined); }} className={FIELD} />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="flex w-24 flex-col">
          <label htmlFor={ids.qty} className={LABEL}>{FOOD_COPY.ownPerQty}</label>
          <input id={ids.qty} value={qty} inputMode="decimal" onChange={e => { setQty(e.target.value); setProblem(undefined); }} className={FIELD} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <label htmlFor={ids.unit} className={LABEL}>{FOOD_COPY.ownPerUnit}</label>
          <input id={ids.unit} value={unit} maxLength={20} autoComplete="off" onChange={e => { setUnit(e.target.value); setProblem(undefined); }} className={FIELD} />
        </div>
      </div>
      {numbers.show && (
        <>
          <NumberField label={FOOD_COPY.ownKcal} mode="numeric" unit="kcal" value={kcal} onChange={v => { setKcal(v); setProblem(undefined); }} />
          <NumberField label={FOOD_COPY.ownCarbs} unit="g" value={carbs} onChange={v => { setCarbs(v); setProblem(undefined); }} />
          <Hint>{FOOD_COPY.ownUnknown}</Hint>
        </>
      )}
      {/* Once answered, unticked means "not in it": said, with each of the person's allergies left unticked (K7R-04; D182). */}
      <Group header={FOOD_COPY.ownAllergens} {...(allergens.length > 0 ? { footer: FOOD_COPY.ownUntickedHint } : {})}>
        <CheckRows
          label={FOOD_COPY.ownAllergens}
          options={OWN_ALLERGENS}
          value={allergens}
          // "None of these" stands alone: ticking it clears the rest, and ticking another clears it.
          onChange={next => setAllergens(next.includes('none') && !allergens.includes('none') ? ['none'] : next.filter(a => a !== 'none'))}
        />
      </Group>
      {allergens.length > 0 && allergies.known.filter(a => !allergens.includes(a)).map(a => <Hint key={a}>{FOOD_COPY.ownUnticked(allergenName(a))}</Hint>)}
      {problem && <ErrorText>{problem}</ErrorText>}
      <PrimaryButton onClick={add}>{FOOD_COPY.addToMeal}</PrimaryButton>
    </div>
  );
}

const SIZES: { id: QuickItem['size']; label: string }[] = (['small', 'normal', 'large'] as const).map(id => ({ id, label: QUICK_NAME[id] }));

/** "Quick add: about how much?" (journey §11.3): a plate size, and a kcal figure only with estimates. Never carbs. */
export function QuickPage({ numbers, onBack, onAdd, onDirty }: {
  numbers: NumbersView;
  onBack: () => void;
  onAdd: (item: QuickItem) => void;
  onDirty?: (holds: boolean) => void;
}) {
  const [size, setSize] = useState<QuickItem['size']>('normal');
  const [kcal, setKcal] = useState('');
  const [problem, setProblem] = useState<string>();
  useHolds(size !== 'normal' || kcal !== '', onDirty);
  const add = () => {
    const k = numbers.show ? figure(kcal, 5000) : undefined;
    if (k === null) setProblem(FOOD_COPY.ownBadFigure);
    else onAdd(quickItem(size, k));
  };
  return (
    <div className="flex flex-col gap-4">
      <BackToMeal onBack={onBack} />
      <Segmented label={FOOD_COPY.quickHow} options={SIZES} value={size} onChange={setSize} />
      {numbers.show && <NumberField label={FOOD_COPY.quickKcal} mode="numeric" unit="kcal" value={kcal} onChange={v => { setKcal(v); setProblem(undefined); }} />}
      {problem && <ErrorText>{problem}</ErrorText>}
      <PrimaryButton onClick={add}>{FOOD_COPY.addToMeal}</PrimaryButton>
    </div>
  );
}
