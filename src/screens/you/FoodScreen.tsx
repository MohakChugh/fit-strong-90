import { useId, useState, type FormEvent } from 'react';
import { XIcon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { ALLERGENS } from '@/food/allergens';
import { FOOD_COPY, LEVEL_LABEL } from '@/food/copy';
import { foodLevel, numbersView } from '@/food/level';
import { promptDefault } from '@/food/prompts';
import { LevelSheet } from '@/screens/food/LevelSheet';
import { formatDayShort } from '@/screens/track/format';
import { NumberField } from '@/screens/track/ui';
import { useToday } from '@/screens/track/useToday';
import { useStore } from '@/store/useStore';
import type { Meal } from '@/types/habits';
import type { AllergenId, FoodPreferences } from '@/types/profile';
import { CheckRows, ChoiceRows, Notice, PlainButton, Segmented, TimeField, type Choice } from './controls';
import { AVOID_MAX_ITEMS, AVOID_MAX_LENGTH, FOOD_PATTERN, FOOD_REGION, addAvoid } from './summaries';
import { changeProfile } from './write';

type Pattern = FoodPreferences['pattern'];
type Region = NonNullable<FoodPreferences['region']>;

const PATTERNS: Choice<Pattern>[] = (Object.keys(FOOD_PATTERN) as Pattern[]).map(value => ({ value, label: FOOD_PATTERN[value] }));
const REGIONS: Choice<Region | 'none'>[] = [
  { value: 'none', label: 'No preference' },
  ...(Object.keys(FOOD_REGION) as Region[]).map(value => ({ value, label: FOOD_REGION[value] })),
];
const ALLERGY_CHOICES: Choice<AllergenId>[] = ALLERGENS.map(a => ({ value: a.id, label: a.label }));
const REMINDER_MEALS: { value: Meal | 'off'; label: string }[] = [
  { value: 'off', label: FOOD_COPY.reminderOff },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
];

/** A whole number from a field, within bounds; blank is none; `null` can't be right. */
function whole(text: string, max: number): number | undefined | null {
  if (text.trim() === '') return undefined;
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
}

/**
 * Me → Food (journey §16): what meal ideas may include, allergies, the
 * logging level, a target from the person's care team, and the reminder to
 * log. Only what the person says: the app never guesses a diet, and none of
 * this leaves the device.
 */
export function FoodScreen() {
  const { profile, settings } = useStore();
  const food = profile?.food;
  const level = foodLevel(food);
  // A target and the prompt are for estimates only (journey §11.5, B-11).
  const numbers = numbersView(profile);
  const today = useToday();
  const ids = { avoid: useId(), allergy: useId(), time: useId() };
  const [problem, setProblem] = useState<string>();
  const [choosing, setChoosing] = useState(false);
  const [kcal, setKcal] = useState(String(food?.careTeamTargets?.kcal ?? ''));
  const [carbs, setCarbs] = useState(String(food?.careTeamTargets?.carbsG ?? ''));

  /** Each change is worked out from the stored preferences at the moment it is written. */
  const edit = async (change: (food: FoodPreferences | undefined) => FoodPreferences | undefined) => {
    const saved = await changeProfile(current => {
      const next = change(current.food);
      const edited = { ...current };
      if (next) edited.food = next;
      else delete edited.food;
      return edited;
    });
    setProblem(saved.ok ? undefined : `That did not save. ${saved.failure.message}`);
    return saved.ok;
  };

  const saveTarget = () => {
    const k = whole(kcal, 10_000);
    const c = whole(carbs, 2_000);
    if (k === null || c === null || (k === undefined && c === undefined)) {
      setProblem(FOOD_COPY.targetBad);
      return;
    }
    void edit(current => current && { ...current, careTeamTargets: { ...(k ? { kcal: k } : {}), ...(c ? { carbsG: c } : {}), setOn: today } });
  };
  const removeTarget = () => {
    setKcal('');
    setCarbs('');
    void edit(current => {
      if (!current) return current;
      const next = { ...current };
      delete next.careTeamTargets;
      return next;
    });
  };

  return (
    <Screen title="Food" back={{ to: '/me', label: 'Me' }}>
      <Group header="What you eat" footer="Meal ideas use this. The app only knows what you tell it.">
        <ChoiceRows
          label="What you eat"
          options={PATTERNS}
          value={food?.pattern}
          onChange={pattern => void edit(current => ({ avoid: [], ...current, pattern }))}
        />
      </Group>

      {food && (
        <Group header={FOOD_COPY.allergiesGroup} footer={FOOD_COPY.allergiesFooter}>
          <CheckRows
            label={FOOD_COPY.allergiesGroup}
            options={ALLERGY_CHOICES}
            value={food.allergies ?? []}
            onChange={allergies => void edit(current => current && { ...current, allergies })}
          />
        </Group>
      )}

      {food && (
        <WordList
          header={FOOD_COPY.somethingElse}
          inputId={ids.allergy}
          inputLabel={FOOD_COPY.somethingElse}
          placeholder={FOOD_COPY.somethingElsePlaceholder}
          items={food.customAllergies ?? []}
          onAdd={entry => edit(current => current && { ...current, customAllergies: addAvoid(current.customAllergies ?? [], entry) })}
          onRemove={item => void edit(current => {
            if (!current) return current;
            const left = (current.customAllergies ?? []).filter(a => a !== item);
            const next: FoodPreferences = { ...current, customAllergies: left };
            if (left.length === 0) delete next.customAllergies;
            return next;
          })}
        />
      )}

      {food && (
        <WordList
          header="Leave out"
          footer={FOOD_COPY.avoidFooter}
          inputId={ids.avoid}
          inputLabel="A food to leave out"
          placeholder="For example, mushrooms"
          items={food.avoid}
          onAdd={entry => edit(current => current && { ...current, avoid: addAvoid(current.avoid, entry) })}
          onRemove={item => void edit(current => current && { ...current, avoid: current.avoid.filter(a => a !== item) })}
        />
      )}

      {food && (
        <Group header="Region (optional)" footer="For familiar examples. It never changes the guidance itself.">
          <ChoiceRows
            label="Region"
            options={REGIONS}
            value={food.region ?? 'none'}
            // Every other preference stays: the level, allergies, a target, the reminder.
            onChange={region => void edit(current => {
              if (!current) return current;
              const next = { ...current };
              if (region === 'none') delete next.region;
              else next.region = region;
              return next;
            })}
          />
        </Group>
      )}

      {food && (
        <Group header={FOOD_COPY.levelGroup} footer={FOOD_COPY.levelFooter}>
          <Row onClick={() => setChoosing(true)} label={FOOD_COPY.levelGroup} detail={LEVEL_LABEL[level]} chevron />
        </Group>
      )}

      {food && numbers.show && (
        <Group
          header={FOOD_COPY.targetGroup}
          footer={food.careTeamTargets ? `${FOOD_COPY.targetSetOn(formatDayShort(food.careTeamTargets.setOn, today))} ${FOOD_COPY.targetFooter}` : FOOD_COPY.targetFooter}
        >
          <div className="flex flex-col gap-3 px-4 py-3">
            <NumberField label={FOOD_COPY.targetKcal} mode="numeric" unit="kcal" value={kcal} onChange={v => { setKcal(v); setProblem(undefined); }} />
            <NumberField label={FOOD_COPY.targetCarbs} mode="numeric" unit="g" value={carbs} onChange={v => { setCarbs(v); setProblem(undefined); }} />
            <PlainButton onClick={saveTarget}>{FOOD_COPY.targetSave}</PlainButton>
            {food.careTeamTargets && <PlainButton tone="stop" onClick={removeTarget}>{FOOD_COPY.targetRemove}</PlainButton>}
          </div>
        </Group>
      )}

      {food && numbers.show && (
        <Group header={FOOD_COPY.reminderGroup} footer={FOOD_COPY.reminderFooter}>
          <div className="flex flex-col gap-3 px-4 py-3">
            <Segmented
              label={FOOD_COPY.reminderMeal}
              options={REMINDER_MEALS}
              value={food.logReminder?.meal ?? 'off'}
              onChange={meal => void edit(current => {
                if (!current) return current;
                const next = { ...current };
                if (meal === 'off') delete next.logReminder;
                else next.logReminder = { meal, at: current.logReminder?.meal === meal ? current.logReminder.at : promptDefault(meal, settings.habits) };
                return next;
              })}
            />
            {food.logReminder && (
              <TimeField
                id={ids.time}
                label={FOOD_COPY.reminderTime}
                value={food.logReminder.at}
                onChange={at => void edit(current => (current?.logReminder ? { ...current, logReminder: { ...current.logReminder, at } } : current))}
              />
            )}
          </div>
        </Group>
      )}

      {problem && <Notice tone="error">{problem}</Notice>}
      {food && <PlainButton tone="stop" onClick={() => void edit(() => undefined)}>Clear food preferences</PlainButton>}
      <LevelSheet open={choosing} onOpenChange={setChoosing} />
    </Screen>
  );
}

/** A list of the person's own words, each removable, with a field to add one. */
function WordList({ header, footer, inputId, inputLabel, placeholder, items, onAdd, onRemove }: {
  header: string;
  footer?: string;
  inputId: string;
  inputLabel: string;
  placeholder: string;
  items: readonly string[];
  onAdd: (entry: string) => Promise<boolean>;
  onRemove: (item: string) => void;
}) {
  const [typed, setTyped] = useState('');
  const add = async (event: FormEvent) => {
    event.preventDefault();
    const entry = typed;
    // Cleared at once, so the next entry can be typed while this one saves;
    // put back only if it did not save and nothing new has been typed.
    setTyped('');
    if (!(await onAdd(entry))) setTyped(now => now || entry);
  };
  return (
    <Group header={header} {...(footer ? { footer } : {})}>
      {items.map(item => (
        <Row
          key={item}
          label={item}
          className="py-1"
          accessory={
            <button
              type="button"
              aria-label={`Remove ${item}`}
              onClick={() => onRemove(item)}
              className="press-feedback -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground"
            >
              <XIcon className="size-5" aria-hidden />
            </button>
          }
        />
      ))}
      {items.length < AVOID_MAX_ITEMS && (
        <form onSubmit={event => void add(event)} className="flex min-h-[3.25rem] items-center gap-2 px-4 py-1.5">
          <label htmlFor={inputId} className="sr-only">{inputLabel}</label>
          <input
            id={inputId}
            type="text"
            value={typed}
            maxLength={AVOID_MAX_LENGTH}
            enterKeyHint="done"
            autoComplete="off"
            placeholder={placeholder}
            onChange={e => setTyped(e.target.value)}
            className="min-h-11 min-w-0 flex-1 bg-transparent text-[length:var(--text-body)] outline-none placeholder:text-muted-foreground"
          />
          <button type="submit" disabled={!typed.trim()} className="press-feedback min-h-11 shrink-0 px-2 text-[length:var(--text-body)] font-semibold text-tint disabled:opacity-40">
            Add
          </button>
        </form>
      )}
    </Group>
  );
}
