import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { CheckIcon } from 'lucide-react';
import { Sheet } from '@/components/hig/Sheet';
import { PATTERN_LABEL, unmatchedAvoid, type Pattern, type Region } from '@/content';
import type { FoodPreferences } from '@/types/profile';
import { cn } from '@/lib/utils';
import { AVOID_HELP, parseAvoid, REGION_LABEL, unmatchedNote } from './format';
import { saveFood } from './useGuide';

const PATTERNS: { id: Pattern; detail: string }[] = [
  { id: 'vegetarian', detail: 'Dairy, but no eggs, fish or meat' },
  { id: 'eggetarian', detail: 'Dairy and eggs, but no fish or meat' },
  { id: 'nonVegetarian', detail: 'Eggs, fish, chicken or meat' },
  { id: 'vegan', detail: 'No dairy, eggs, fish or meat' },
];

const REGIONS: (Exclude<Region, 'mixed'> | 'any')[] = ['any', 'north', 'south', 'east', 'west'];

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const avoidId = useId();
  const avoidHelp = useId();
  const avoidNote = useId();
  // Said while typing, so an entry that hides nothing is never taken as done.
  const unmatched = unmatchedNote(unmatchedAvoid(parseAvoid(avoid), pattern));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pattern || saving) return;
    setSaving(true);
    setError(undefined);
    const next: FoodPreferences = { pattern, avoid: parseAvoid(avoid), ...(region === 'any' ? {} : { region }) };
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
            key={p.id}
            name="pattern"
            label={PATTERN_LABEL[p.id]}
            detail={p.detail}
            checked={pattern === p.id}
            onChange={() => setPattern(p.id)}
          />
        ))}
      </Choices>

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
          className="h-11 rounded-xl bg-grouped-card px-4 text-[length:var(--text-body)] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-tint/50"
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
