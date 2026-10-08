/**
 * "Time · Now" and "Day · Today" rows. Untouched, they mean the moment Save
 * is tapped — read then, not when the sheet opened, so a form left open for a
 * minute does not back-date the reading. Tapping one shows the native picker,
 * filled with the present moment.
 */

import { useId, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { nowAt } from '@/health/observation';
import { Group, Row } from '@/components/hig/List';
import { toLocalInput } from './logKinds';
import { formatDayRelative } from './format';
import { today } from './periods';
import { useToday } from './useToday';

const INPUT = 'numeric min-h-11 min-w-0 rounded-lg bg-grouped-bg px-2 text-right text-[length:var(--text-body)] text-foreground';

/**
 * A clock time, as a `datetime-local` value, or undefined for "now" — or for
 * a moment captured already (`captured`, e.g. when a first reading was
 * entered). Opening the picker is looking, not editing: it shows the moment
 * the row stands for, and only a change made in it becomes the time (T3-02).
 * Until then the row keeps standing for "now", or for the captured moment to
 * the second.
 */
export function TimeRow({ value, onChange, label = 'Time', footer, captured }: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  label?: string;
  footer?: string;
  /** A moment the row stands for while untouched, instead of now, and what to call it. */
  captured?: { at: string; label: string };
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const current = useToday();
  // What the open picker shows before any change: the moment, to the minute.
  const [shown, setShown] = useState<string>();
  const open = value !== undefined || shown !== undefined;
  return (
    <Group footer={footer}>
      {!open ? (
        <Row
          as="button"
          type="button"
          label={label}
          value={captured?.label ?? 'Now'}
          chevron
          onClick={() => {
            // Rendered synchronously so the focus below happens inside the tap,
            // which is what lets iOS open its picker straight away.
            flushSync(() => setShown(toLocalInput(captured?.at ?? nowAt())));
            input.current?.focus();
          }}
        />
      ) : (
        <div className="flex min-h-[3.25rem] items-center gap-3 px-4 py-1.5">
          {/* The field is named by its label alone; the hint describes it. */}
          <div className="flex-1">
            <label htmlFor={id} className="block text-[length:var(--text-body)]">{label}</label>
            {value === undefined && (
              <span id={`${id}-hint`} className="block text-[length:var(--text-subhead)] text-muted-foreground">
                {captured ? 'Unchanged: the moment it was entered' : 'Unchanged: the moment you tap Save'}
              </span>
            )}
          </div>
          <input
            ref={input}
            id={id}
            type="datetime-local"
            value={value ?? shown}
            // A hint for the picker; Save refuses a future time either way.
            max={`${current}T23:59`}
            aria-describedby={value === undefined ? `${id}-hint` : undefined}
            onChange={e => onChange(e.target.value || undefined)}
            className={INPUT}
          />
        </div>
      )}
    </Group>
  );
}

/** A calendar day, as `YYYY-MM-DD`, or undefined for today. */
export function DayRow({ value, onChange, label = 'Day', footer }: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  label?: string;
  footer?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const current = useToday();
  return (
    <Group footer={footer}>
      {value === undefined ? (
        <Row
          as="button"
          type="button"
          label={label}
          value="Today"
          chevron
          onClick={() => {
            flushSync(() => onChange(today()));
            input.current?.focus();
          }}
        />
      ) : (
        <div className="flex min-h-[3.25rem] items-center gap-3 px-4 py-1.5">
          <label htmlFor={id} className="flex-1 text-[length:var(--text-body)]">
            {label}
            <span className="block text-[length:var(--text-subhead)] text-muted-foreground">{formatDayRelative(value, current)}</span>
          </label>
          <input
            ref={input}
            id={id}
            type="date"
            value={value}
            max={current}
            onChange={e => onChange(e.target.value || undefined)}
            className={INPUT}
          />
        </div>
      )}
    </Group>
  );
}
