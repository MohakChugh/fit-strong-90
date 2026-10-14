import type { Control } from './editor';

/**
 * A labelled, 48 px secondary button. A button that can't act stays in place,
 * focusable and says why in its own words ("Check is full (5)"), rather than
 * dropping out of the tab order under the person's focus.
 */
export function EditButton({ control, disabled = false, label, name, onClick }: {
  control: Control | 'show' | 'pick' | 'later';
  disabled?: boolean;
  label: string;
  /** What it acts on, after the visible words for a screen reader: "Move up, Water". */
  name: string;
  onClick: (button: HTMLButtonElement) => void;
}) {
  return (
    <button
      type="button"
      data-control={control}
      aria-label={`${label}, ${name}`}
      aria-disabled={disabled || undefined}
      onClick={e => { if (!disabled) onClick(e.currentTarget); }}
      className="press-feedback flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-full bg-tint/10 px-3 text-[length:var(--text-subhead)] font-semibold leading-tight text-tint aria-disabled:bg-muted aria-disabled:text-muted-foreground"
    >
      {label}
    </button>
  );
}
