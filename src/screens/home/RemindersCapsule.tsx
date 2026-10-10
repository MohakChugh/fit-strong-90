import { useState } from 'react';
import { BellIcon } from 'lucide-react';
import { Sheet } from '@/components/hig/Sheet';
import { habitPrecautions } from '@/reminders/advice';
import type { Pending } from '@/reminders/pending';
import { ReminderBanner } from '@/reminders/ReminderBanner';
import { useStore } from '@/store/useStore';

/**
 * "2 reminders" at the top right of Home, only while reminders wait (journey
 * §7.1, §15, M20): a labelled capsule, never a bare bell, that opens "Waiting
 * for you" with Done and Later on each. A reminder that steps out of view by
 * itself is still here, so nothing is lost to a timer (A-65).
 */
export function RemindersCapsule({ waiting }: { waiting: readonly Pending[] }) {
  const [open, setOpen] = useState(false);
  const { settings, profile } = useStore();
  const n = waiting.length;
  const glassMl = settings.habits?.water?.glassMl;
  return (
    <>
      {n > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="press-feedback flex min-h-12 shrink-0 items-center gap-1.5 rounded-full bg-tint/12 px-3 text-[length:var(--text-subhead)] font-semibold text-tint"
        >
          <BellIcon className="size-4 shrink-0" aria-hidden />
          {n} {n === 1 ? 'reminder' : 'reminders'}
        </button>
      )}
      {/* Mounted while answering, so the sheet stays put as the last one is answered. */}
      <Sheet open={open} onOpenChange={setOpen} title="Waiting for you">
        <div className="flex flex-col gap-3">
          {n === 0 && <p className="px-1 text-[length:var(--text-body)] text-muted-foreground">Nothing is waiting now.</p>}
          {waiting.map(item => (
            <ReminderBanner
              key={item.occurrence.id}
              variant="inline"
              item={item}
              {...(glassMl ? { glassMl } : {})}
              precautions={habitPrecautions(item.occurrence.habit, profile, settings.habits)}
            />
          ))}
        </div>
      </Sheet>
    </>
  );
}
