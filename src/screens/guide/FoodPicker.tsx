import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { CheckIcon } from 'lucide-react';
import { Sheet } from '@/components/hig/Sheet';
import { PATTERN_DETAIL, PATTERN_LABEL, unmatchedAvoid, withPicked, type Pattern, type Region } from '@/content';
import { ALLERGENS, setupAllergyAnswer } from '@/food/allergens';
import { FOOD_COPY } from '@/food/copy';
import { getSetupSession } from '@/setup/draft';
import { CheckRows } from '@/screens/you/controls';
import type { AllergenId, FoodPreferences } from '@/types/profile';
import { cn } from '@/lib/utils';
import { useStore } from '@/store/useStore';
import { AVOID_HELP, ownAllergyNote, parseAllergies, parseAvoid, REGION_LABEL, unmatchedNote } from './format';
import { saveFood } from './useGuide';

const PATTERNS: Pattern[] = ['vegetarian', 'eggetarian', 'nonVegetarian', 'vegan', 'jain'];

const REGIONS: (Exclude<Region, 'mixed'> | 'any')[] = ['any', 'north', 'south', 'east', 'west'];

const ALLERGY_OPTIONS = ALLERGENS.map(a => ({ value: a.id, label: a.label }));

/**
 * "What do you eat?" — asked the first time Meal ideas opens, not during
 * exercise setup (codex-vision §2). Three answers at most, one required.
 * The full food-preferences editor belongs to You.
 */
export function FoodPicker({ open, onOpenChange, food, canSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  food?: FoodPreferences;
  /** False before a profile exists: the choice lasts for this visit. */
  canSave: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Your food" detent="large">
      <FoodForm food={food} canSave={canSave} onDone={() => onOpenChange(false)} />
    </Sheet>
  );
}

function FoodForm({ food, canSave, onDone }: { food?: FoodPreferences; canSave: boolean; onDone: () => void }) {
  const [pattern, setPattern] = useState<Pattern | undefined>(food?.pattern);
  const [region, setRegion] = useState<(typeof REGIONS)[number]>(
    food?.region && food.region !== 'mixed' ? food.region : 'any',
  );
  const [avoid, setAvoid] = useState(food?.avoid.join(', ') ?? '');
  // With no food record yet, the allergies start from the answer setup is keeping for one (board D205):
  // this session's while setup goes on without saving (Plan 5's B-07, H5-06).
  const { settings } = useStore();
  const [waiting] = useState(() => (food ? undefined : setupAllergyAnswer(settings.setup, getSetupSession())));
  const [chosen, setChosen] = useState<AllergenId[]>(food?.allergies ?? waiting?.allergies ?? []);
  const [otherAllergies, setOtherAllergies] = useState((food?.customAllergies ?? waiting?.customAllergies ?? []).join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const avoidId = useId();
  const avoidHelp = useId();
  const avoidNote = useId();
  const allergyId = useId();
  const allergyHelp = useId();
  const allergyNote = useId();
  // Said while typing, so an entry that hides nothing is never taken as done.
  const unmatched = unmatchedNote(unmatchedAvoid(parseAvoid(avoid), pattern));
  // And how each allergy in the person's own words is read, so one that keeps nothing out is never taken as done (K7R-02).
  const read = ownAllergyNote(parseAllergies(otherAllergies));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pattern || saving) return;
    setSaving(true);
    setError(undefined);
    // Only what this sheet asks, allergies included (B-13): the logging level, the screening answer and a target stay.
    const next = withPicked(food, { pattern, avoid: parseAvoid(avoid), region, allergies: chosen, customAllergies: parseAllergies(otherAllergies) });
    const failure = await saveFood(next);
    setSaving(false);
    if (failure) setError(failure);
    else onDone();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <Choices legend="What do you eat?">
        {PATTERNS.map(p => (
          <Choice
            key={p}
            name="pattern"
            label={PATTERN_LABEL[p]}
            detail={PATTERN_DETAIL[p]}
            checked={pattern === p}
            onChange={() => setPattern(p)}
          />
        ))}
      </Choices>

      <Choices legend="Allergies (optional)">
        <CheckRows label="Allergies (optional)" options={ALLERGY_OPTIONS} value={chosen} onChange={setChosen} />
      </Choices>

      <div className="flex flex-col">
        <label htmlFor={allergyId} className="px-4 pb-2 text-[length:var(--text-footnote)] font-medium uppercase tracking-wide text-muted-foreground">
          {FOOD_COPY.somethingElse}
        </label>
        <input
          id={allergyId}
          type="text"
          value={otherAllergies}
          onChange={e => setOtherAllergies(e.target.value)}
          placeholder={FOOD_COPY.somethingElsePlaceholder}
          autoComplete="off"
          aria-describedby={read ? `${allergyHelp} ${allergyNote}` : allergyHelp}
          className="h-12 rounded-xl bg-grouped-card px-4 text-[length:var(--text-body)] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-tint/50"
        />
        <p id={allergyHelp} className="px-4 pt-2 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
          {FOOD_COPY.allergiesFooter}
        </p>
        {read && (
          <p id={allergyNote} role="status" className={cn('px-4 pt-2 text-[length:var(--text-footnote)] leading-snug', read.unknown ? 'text-caution' : 'text-muted-foreground')}>
            {read.text}
          </p>
        )}
      </div>

      <Choices legend="Dishes from (optional)">
        {REGIONS.map(r => (
          <Choice
            key={r}
            name="region"
            label={r === 'any' ? 'Any region' : REGION_LABEL[r]}
            checked={region === r}
            onChange={() => setRegion(r)}
          />
        ))}
      </Choices>

      <div className="flex flex-col">
        <label htmlFor={avoidId} className="px-4 pb-2 text-[length:var(--text-footnote)] font-medium uppercase tracking-wide text-muted-foreground">
          Leave out (optional)
        </label>
        <input
          id={avoidId}
          type="text"
          value={avoid}
          onChange={e => setAvoid(e.target.value)}
          placeholder="For example: peanuts, mushrooms"
          autoComplete="off"
          aria-describedby={unmatched ? `${avoidHelp} ${avoidNote}` : avoidHelp}
          className="h-12 rounded-xl bg-grouped-card px-4 text-[length:var(--text-body)] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-tint/50"
        />
        <p id={avoidHelp} className="px-4 pt-2 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
          {AVOID_HELP}
        </p>
        {unmatched && (
          <p id={avoidNote} role="status" className="px-4 pt-2 text-[length:var(--text-footnote)] leading-snug text-caution">
            {unmatched}
          </p>
        )}
      </div>

      {!canSave && (
        <p className="px-4 text-[length:var(--text-subhead)] leading-snug text-muted-foreground">
          There is no profile on this device yet, so this choice lasts until you close the app.
        </p>
      )}
      {error && (
        <p role="alert" className="px-4 text-[length:var(--text-subhead)] leading-snug text-stop">
          <span className="font-semibold">That did not save. </span>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!pattern || saving}
        className="press-feedback min-h-[3.125rem] rounded-xl bg-tint px-4 text-[length:var(--text-body)] font-semibold text-on-tint disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Show meal ideas'}
      </button>
    </form>
  );
}

function Choices({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col">
      <legend className="px-4 pb-2 text-[length:var(--text-footnote)] font-medium uppercase tracking-wide text-muted-foreground">
        {legend}
      </legend>
      <div className="overflow-hidden rounded-xl bg-grouped-card [&>*+*]:border-t [&>*+*]:border-separator">{children}</div>
    </fieldset>
  );
}

function Choice({ name, label, detail, checked, onChange }: {
  name: string;
  label: string;
  detail?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex min-h-[3.25rem] cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors active:bg-muted/60 has-[:focus-visible]:bg-muted/60">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span className="min-w-0 flex-1">
        <span className="block text-[length:var(--text-body)] leading-snug">{label}</span>
        {detail && <span className="block text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{detail}</span>}
      </span>
      <CheckIcon className={cn('size-5 shrink-0 text-tint', checked ? 'opacity-100' : 'opacity-0')} strokeWidth={2.5} aria-hidden />
    </label>
  );
}
