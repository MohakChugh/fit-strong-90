import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArmchairIcon, FootprintsIcon, GlassWaterIcon } from 'lucide-react';
import { addToDayTotal } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { reminderText } from './copy';
import { answerReminder, type Pending } from './pending';
import { AUTO_HIDE_MS } from './place';
import { timeOf } from '@/lib/time';
import { walkSetupHref } from '@/walk/plan';

const ICON = { water: GlassWaterIcon, sittingBreak: ArmchairIcon, mealWalk: FootprintsIcon } as const;

const ACTION = 'press-feedback flex min-h-11 items-center justify-center rounded-xl px-4 text-[length:var(--text-body)] font-semibold';

/**
 * One waiting reminder, compact. Gentle on purpose: no sound, no countdown,
 * nothing that blames, and never over navigation (the host places it just
 * above the tab bar). Left alone, it steps out of view after about eight
 * seconds — still waiting, in the icon badge and wherever else waiting
 * reminders show, until answered — but it stays while the person points at
 * it, touches it or has focus in it. Either answer is one tap, and the
 * precautions that travel with it are shown for as long as it is.
 */
export function ReminderBanner({ item, glassMl, waterLine, precautions = [], onHide, variant = 'floating' }: {
  item: Pending;
  /** The user's glass, for "I had a glass". Absent means no logging offered. */
  glassMl?: number;
  /** "750 of 2,000 ml today", when the user set a goal. */
  waterLine?: string;
  /** What the Guide says travels with movement for this person, e.g. checks and fast-acting sugar with insulin. */
  precautions?: readonly string[];
  /** Called when it has been left alone for `AUTO_HIDE_MS`. Without it, it stays. */
  onHide?: (id: string) => void;
  /**
   * `floating`, the banner over the screen; `inline`, in a screen's own flow —
   * Today's prompt — with no shadow or slide, and text buttons, so the screen
   * keeps its one filled primary action.
   */
  variant?: 'floating' | 'inline';
}) {
  const inline = variant === 'inline';
  const primary = cn(ACTION, inline ? 'flex-1 text-tint' : 'flex-1 bg-tint text-on-tint');
  const { occurrence } = item;
  const text = reminderText(occurrence, glassMl);
  const Icon = ICON[occurrence.habit];
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [pointer, setPointer] = useState(false);
  const [focus, setFocus] = useState(false);
  const inUse = pointer || focus || saving;

  useEffect(() => {
    if (!onHide || inUse) return;
    const id = setTimeout(() => onHide(occurrence.id), AUTO_HIDE_MS);
    return () => clearTimeout(id);
  }, [onHide, inUse, occurrence.id]);

  const logGlass = async () => {
    if (!glassMl) return;
    setSaving(true);
    const saved = await addToDayTotal('water', glassMl, { unit: 'ml' });
    setSaving(false);
    if (saved.ok) answerReminder(occurrence.id);
    else setProblem(`That did not save. ${saved.failure.message}`);
  };

  return (
    <section
      aria-label="Reminder"
      onPointerEnter={() => setPointer(true)}
      onPointerLeave={() => setPointer(false)}
      onFocus={() => setFocus(true)}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocus(false); }}
      className={cn(
        'pointer-events-auto mx-auto flex w-full flex-col rounded-2xl bg-grouped-card p-3',
        inline
          ? ''
          // Never taller than two fifths of the screen, so it stays clear of the large
          // title even with every precaution on a 320-point phone; what does
          // not fit scrolls inside it, and the answers stay in reach.
          : 'max-h-[40dvh] max-w-md border border-separator shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-200',
      )}
    >
      <div className="flex min-h-0 items-start gap-2.5 overflow-y-auto overscroll-contain">
        <Icon className="mt-0.5 size-5 shrink-0 text-tint" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 className="text-[length:var(--text-body)] font-semibold leading-snug">
            {text.title}
            <span className="numeric ml-2 text-[length:var(--text-footnote)] font-normal text-muted-foreground">{timeOf(new Date(2026, 0, 1, 0, occurrence.minute))}</span>
          </h2>
          <p className="text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{text.detail}</p>
          {waterLine && <p className="numeric text-[length:var(--text-subhead)] text-muted-foreground">{waterLine}</p>}
          {precautions.map(line => <p key={line} className="mt-1 text-[length:var(--text-footnote)] leading-snug">{line}</p>)}
          {problem && <p role="alert" className="mt-1 text-[length:var(--text-subhead)] text-stop">{problem}</p>}
        </div>
      </div>

      <div className="mt-2 flex shrink-0 gap-2">
        {occurrence.habit === 'water' && glassMl ? (
          <button type="button" disabled={saving} onClick={() => void logGlass()} className={cn(primary, 'disabled:opacity-60')}>
            {/* The glass size is in the line above; the label stays short enough for one line at 320 px. */}
            {saving ? 'Saving…' : 'I had a glass'}
          </button>
        ) : occurrence.habit === 'mealWalk' ? (
          // Walk opens on "After a meal" with this reminder's meal chosen (D26).
          <Link to={walkSetupHref(occurrence.meal)} viewTransition onClick={() => answerReminder(occurrence.id)} className={primary}>
            Start a walk
          </Link>
        ) : (
          <button type="button" onClick={() => answerReminder(occurrence.id)} className={primary}>
            Done
          </button>
        )}
        <button type="button" onClick={() => answerReminder(occurrence.id)} className={cn(ACTION, 'text-tint')}>
          Later
        </button>
      </div>
    </section>
  );
}
