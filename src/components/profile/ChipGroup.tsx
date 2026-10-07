import { cn } from '@/lib/utils';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label: string;
  options: ChipOption<T>[];
  /** Selected values (one value for single-select). */
  value: T[];
  onChange: (next: T[]) => void;
  multiple?: boolean;
  /** Selecting this clears the others, and selecting another clears it (e.g. "None"). */
  exclusive?: T;
  hint?: string;
  className?: string;
}

/** Large, wrapping toggle chips: ≥ 44 px tall, readable at 320 px. */
export function ChipGroup<T extends string>({ label, options, value, onChange, multiple, exclusive, hint, className }: Props<T>) {
  const toggle = (v: T) => {
    if (!multiple) return onChange([v]);
    if (v === exclusive) return onChange(value.includes(v) ? [] : [v]);
    const without = value.filter(x => x !== v && x !== exclusive);
    onChange(value.includes(v) ? without : [...without, v]);
  };
  return (
    <fieldset className={cn('flex flex-col gap-2', className)}>
      <legend className="text-sm font-medium mb-2">{label}</legend>
      {hint && <p className="text-xs text-muted-foreground -mt-1 mb-1">{hint}</p>}
      <div className="flex flex-wrap gap-2" role={multiple ? 'group' : 'radiogroup'} aria-label={label}>
        {options.map(o => {
          const on = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={on}
              onClick={() => toggle(o.value)}
              className={cn(
                'min-h-11 px-4 rounded-full border text-sm font-medium transition-colors press-feedback',
                'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Yes / No / Not sure row for a single health question. */
export function YesNo({ label, value, onChange, unsure }: { label: string; value: boolean | 'unsure'; onChange: (v: boolean | 'unsure') => void; unsure?: boolean }) {
  const opts: ChipOption<'yes' | 'no' | 'unsure'>[] = [
    { value: 'no', label: 'No' },
    { value: 'yes', label: 'Yes' },
    ...(unsure ? [{ value: 'unsure' as const, label: 'Not sure' }] : []),
  ];
  const current = value === 'unsure' ? 'unsure' : value ? 'yes' : 'no';
  return (
    <ChipGroup
      label={label}
      options={opts}
      value={[current]}
      onChange={([v]) => onChange(v === 'unsure' ? 'unsure' : v === 'yes')}
    />
  );
}
