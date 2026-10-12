import { useId, type ComponentType, type ReactNode } from 'react';
import { CheckIcon } from 'lucide-react';
import { Group } from '@/components/hig/List';
import { ChoiceRows, type Choice } from '@/screens/you/controls';
import { cn } from '@/lib/utils';
import type { Ctx } from '@/setup/graph';
import { typedMax } from '@/setup/limits';
import type { SetupAnswers, Tri } from '@/types/setup';

/** Numbers as typed, by their key (`RAW_KEYS`). */
export type Typed = Readonly<Record<string, string>>;

/** What every page view is given: the paged first run and Me's chapter editor draw the same views (board D75). */
export interface PageProps {
  /** The answers so far, this page's changes included. */
  a: SetupAnswers;
  /** Numbers as typed (`draft.raw`; H5R-15). */
  raw: Typed;
  /**
   * Change this page's answers, and the numbers as typed: an answer only once
   * its text gives a valid one, a text emptied taken away. Setup keeps each
   * change in the draft shortly after it's made; Me's only at Save.
   */
  set: (patch: Partial<SetupAnswers>, typed?: Readonly<Record<string, string | undefined>>) => void;
  /** Next or Save was pressed with this page unanswered: say what's missing. */
  tried: boolean;
  ctx: Ctx;
  /** One page at a time in setup, or one under another in Me. */
  mode: 'setup' | 'edit';
}
export type PageView = ComponentType<PageProps>;

/** What's missing, said where it's missing, once Next or Save was pressed. */
export function Missing({ show, children = 'Choose one to carry on.' }: { show: boolean; children?: string }) {
  return show ? <p role="alert" className="px-4 pt-1.5 text-[length:var(--text-subhead)] leading-snug text-stop">{children}</p> : null;
}

/** One question, its answers as rows. The radio group is named by the question (B-08: one question). */
export function Ask<T extends string>({ label, header, options, value, onChange, tried, footer }: {
  label: string;
  /** Shown above the rows when the page asks more than this one question. */
  header?: string;
  options: Choice<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  tried: boolean;
  footer?: string;
}) {
  return (
    <div className="flex flex-col">
      <Group header={header} footer={footer}>
        <ChoiceRows label={label} options={options} value={value} onChange={onChange} />
      </Group>
      <Missing show={tried && value === undefined} />
    </div>
  );
}

function CheckButton({ checked, onClick, label, className, children }: {
  checked: boolean; onClick: () => void; label: string; className?: string; children: ReactNode;
}) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onClick}
      className={cn('press-feedback flex min-h-[3.25rem] items-center gap-3 px-4 py-2.5 text-left transition-colors active:bg-muted/60', className)}>
      <span className="min-w-0 flex-1">{children}</span>
      <CheckIcon className={cn('size-5 shrink-0 text-tint', !checked && 'invisible')} strokeWidth={2.4} aria-hidden />
    </button>
  );
}

/**
 * A checklist answered as one question (B-08): tick what applies, or "Not
 * sure" on a row, or the last row for all of them. Rows left unticked are No
 * once the page is stored (`commitPage`).
 */
export function TriChecklist<K extends string>({ label, rows, value, onChange, all, tried }: {
  label: string;
  rows: readonly { id: K; label: string; detail?: string }[];
  value: Partial<Record<K, Tri>> | undefined;
  onChange: (next: Partial<Record<K, Tri>>) => void;
  /** "None of these" (every row No) or "Not sure about any of these" (every row Not sure). */
  all: { label: string; to: Tri };
  tried: boolean;
}) {
  const v: Partial<Record<K, Tri>> = value ?? {};
  const allOn = rows.every(r => v[r.id] === all.to);
  const flip = (id: K, to: Tri) => onChange({ ...v, [id]: v[id] === to ? 'no' : to });
  const answered = rows.some(r => v[r.id] === 'yes' || v[r.id] === 'unsure') || rows.every(r => v[r.id] === 'no');
  return (
    <div className="flex flex-col">
      <div role="group" aria-label={label} className="overflow-hidden rounded-xl bg-grouped-card [&>*+*]:border-t [&>*+*]:border-separator">
        {rows.map(r => (
          <div key={r.id} className="flex flex-wrap items-stretch">
            <CheckButton checked={v[r.id] === 'yes'} onClick={() => flip(r.id, 'yes')} label={r.label} className="min-w-[12rem] flex-1">
              <span className="block text-[length:var(--text-body)] leading-snug">{r.label}</span>
              {r.detail && <span className="block text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{r.detail}</span>}
            </CheckButton>
            <CheckButton checked={v[r.id] === 'unsure'} onClick={() => flip(r.id, 'unsure')} label={`Not sure: ${r.label}`} className="border-l border-separator">
              <span className="text-[length:var(--text-subhead)]">Not sure</span>
            </CheckButton>
          </div>
        ))}
        <CheckButton checked={allOn} onClick={() => onChange(allOn ? {} : Object.fromEntries(rows.map(r => [r.id, all.to])) as Partial<Record<K, Tri>>)} label={all.label}>
          <span className="text-[length:var(--text-body)] leading-snug">{all.label}</span>
        </CheckButton>
      </div>
      <Missing show={tried && !answered}>{`Tick what applies, or “${all.label}”.`}</Missing>
    </div>
  );
}

/** A text field with its label beside it; at large text the field goes under the label (D-10). */
export function TextInput({ label, text, onText, inputMode = 'text', placeholder, autoComplete = 'off', hint, maxLength }: {
  label: string;
  text: string;
  onText: (text: string) => void;
  inputMode?: 'text' | 'numeric' | 'decimal';
  placeholder?: string;
  autoComplete?: string;
  hint?: string;
  maxLength?: number;
}) {
  const id = useId();
  const hintId = useId();
  return (
    <div className="flex flex-col">
      <div className="flex min-h-[3.25rem] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5">
        <label htmlFor={id} className="min-w-0 flex-1 basis-40 text-[length:var(--text-body)] leading-snug">{label}</label>
        <input id={id} value={text} inputMode={inputMode} placeholder={placeholder} autoComplete={autoComplete} maxLength={maxLength}
          {...(hint ? { 'aria-describedby': hintId } : {})}
          onChange={e => onText(e.target.value)}
          className="numeric min-h-12 w-full max-w-[12rem] rounded-lg bg-muted/60 px-3 text-[length:var(--text-body)] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-tint/40" />
      </div>
      {hint && <p id={hintId} className="px-4 pb-2 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** A number, shown as typed: "1", "19" and "195" on the way to "1958" (J02). It's checked at Next or Save. */
export function NumberAnswer({ label, text, onText, placeholder, decimals = false, hint }: {
  label: string;
  text: string;
  onText: (text: string) => void;
  placeholder?: string;
  decimals?: boolean;
  hint?: string;
}) {
  return (
    <TextInput label={label} text={text} inputMode={decimals ? 'decimal' : 'numeric'} placeholder={placeholder} hint={hint} maxLength={typedMax('birthYear')}
      onText={onText} />
  );
}
