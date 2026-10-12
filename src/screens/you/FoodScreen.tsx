import { useId, useState, type FormEvent } from 'react';
import { XIcon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { useStore } from '@/store/useStore';
import type { FoodPreferences } from '@/types/profile';
import { ChoiceRows, Notice, PlainButton, type Choice } from './controls';
import { AVOID_MAX_ITEMS, AVOID_MAX_LENGTH, FOOD_PATTERN, FOOD_REGION, addAvoid } from './summaries';
import { changeProfile } from './write';

type Pattern = FoodPreferences['pattern'];
type Region = NonNullable<FoodPreferences['region']>;

const PATTERNS: Choice<Pattern>[] = (Object.keys(FOOD_PATTERN) as Pattern[]).map(value => ({ value, label: FOOD_PATTERN[value] }));

const REGIONS: Choice<Region | 'none'>[] = [
  { value: 'none', label: 'No preference' },
  ...(Object.keys(FOOD_REGION) as Region[]).map(value => ({ value, label: FOOD_REGION[value] })),
];

/**
 * What meal ideas may include. Only what the person says: the app never
 * guesses a diet from anything else, and none of this leaves the device.
 */
export function FoodScreen() {
  const { profile } = useStore();
  const food = profile?.food;
  const [typed, setTyped] = useState('');
  const [problem, setProblem] = useState<string>();
  const inputId = useId();

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

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const entry = typed;
    // Cleared at once, so the next entry can be typed while this one saves;
    // put back only if it did not save and nothing new has been typed.
    setTyped('');
    const saved = await edit(current => (current ? { ...current, avoid: addAvoid(current.avoid, entry) } : current));
    if (!saved) setTyped(now => now || entry);
  };

  return (
    <Screen title="Food preferences" back={{ to: '/you', label: 'You' }}>
      <Group header="What you eat" footer="Meal ideas in Guide use this. The app only knows what you tell it.">
        <ChoiceRows
          label="What you eat"
          options={PATTERNS}
          value={food?.pattern}
          onChange={pattern => void edit(current => ({ avoid: [], ...current, pattern }))}
        />
      </Group>

      {food && (
        <Group header="Leave out" footer="Allergies, or foods you do not eat, in your own words.">
          {food.avoid.map(item => (
            <Row
              key={item}
              label={item}
              className="py-1"
              accessory={
                <button
                  type="button"
                  aria-label={`Remove ${item}`}
                  onClick={() => void edit(current => (current ? { ...current, avoid: current.avoid.filter(a => a !== item) } : current))}
                  className="press-feedback -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground"
                >
                  <XIcon className="size-5" aria-hidden />
                </button>
              }
            />
          ))}
          {food.avoid.length < AVOID_MAX_ITEMS && (
            <form onSubmit={event => void add(event)} className="flex min-h-[3.25rem] items-center gap-2 px-4 py-1.5">
              <label htmlFor={inputId} className="sr-only">A food to leave out</label>
              <input
                id={inputId}
                type="text"
                value={typed}
                maxLength={AVOID_MAX_LENGTH}
                enterKeyHint="done"
                autoComplete="off"
                placeholder="For example, peanuts"
                onChange={e => setTyped(e.target.value)}
                className="min-h-11 min-w-0 flex-1 bg-transparent text-[length:var(--text-body)] outline-none placeholder:text-muted-foreground"
              />
              <button type="submit" disabled={!typed.trim()} className="press-feedback min-h-11 shrink-0 px-2 text-[length:var(--text-body)] font-semibold text-tint disabled:opacity-40">
                Add
              </button>
            </form>
          )}
        </Group>
      )}

      {food && (
        <Group header="Region (optional)" footer="For familiar examples. It never changes the guidance itself.">
          <ChoiceRows
            label="Region"
            options={REGIONS}
            value={food.region ?? 'none'}
            onChange={region => void edit(current => current && {
              pattern: current.pattern,
              avoid: current.avoid,
              ...(region === 'none' ? {} : { region }),
            })}
          />
        </Group>
      )}

      {problem && <Notice tone="error">{problem}</Notice>}
      {food && <PlainButton tone="stop" onClick={() => void edit(() => undefined)}>Clear food preferences</PlainButton>}
    </Screen>
  );
}
