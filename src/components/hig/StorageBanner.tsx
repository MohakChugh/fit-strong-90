import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRightIcon, TriangleAlertIcon } from 'lucide-react';
import { useStorageNotice } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { Group, Row } from './List';
import { markShown, TaskFrameContext } from './navigation';
import { Sheet } from './Sheet';

/**
 * Says so when the device is not keeping what was entered — no IndexedDB, a
 * full disk, a write that failed. Silence here would let someone believe a
 * glucose reading was saved when it was not. It clears itself on the next
 * write that works.
 *
 * Inside a screen it sits in the sticky header, above the navigation bar, so
 * the two never cover each other and the safe area is padded once. There it
 * is one line — what happened, and Details — however large the text: the full
 * explanation in the header would cover the whole screen at large sizes,
 * Back included (scan S-01), so it opens in a sheet, with the way to Data &
 * offline. Screen readers still hear all of it.
 */
export function StorageBanner({ inHeader = false }: { inHeader?: boolean }) {
  const notice = useStorageNotice();
  const [details, setDetails] = useState(false);
  if (!notice) return null;
  const tone = notice.tone === 'error' ? 'bg-stop-fill text-white' : 'bg-caution-fill text-black';
  const role = notice.tone === 'error' ? 'alert' : 'status';

  if (!inHeader) {
    return (
      <div
        role={role}
        className={cn(
          'flex items-start gap-2 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-[length:var(--text-subhead)] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]',
          tone,
        )}
      >
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="min-w-0">
          <span className="font-semibold">{notice.title}</span> {notice.detail}
        </p>
      </div>
    );
  }

  return (
    <div role={role} className={cn('@container text-[length:var(--text-subhead)]', tone)}>
      {/* The whole banner opens the details: a target as wide as the screen,
          and no button competing with the words for the width. Its name is
          the whole notice, so a screen reader hears all of it. */}
      <button
        type="button"
        onClick={() => setDetails(true)}
        className="press-feedback flex max-h-[30dvh] min-h-11 w-full items-center gap-2 overflow-hidden py-1 text-left pl-[max(min(1rem,20px),env(safe-area-inset-left))] pr-[max(min(1rem,20px),env(safe-area-inset-right))]"
      >
        <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
        <span className="line-clamp-2 min-w-0 flex-1 font-semibold leading-snug">
          {notice.title}
          <span className="sr-only">. {notice.detail}</span>
        </span>
        <span className="shrink-0 font-semibold @max-[16rem]:sr-only">Details</span>
        <ChevronRightIcon className="size-4 shrink-0" aria-hidden />
      </button>
      <Sheet open={details} onOpenChange={setDetails} title={notice.title}>
        <p className="px-1 text-[length:var(--text-body)] leading-snug">{notice.detail}</p>
        <Group>
          <Row as={Link} to="/you/data" viewTransition label="Data & offline" detail="Export a copy of your records, or remove older ones" chevron />
        </Group>
      </Sheet>
    </div>
  );
}

/**
 * The frame for full-screen tasks outside the tab shell — first run, the
 * session player, a live walk: a main landmark and the storage notice, with
 * no tab bar to hit by accident. The notice scrolls away with the task here,
 * so it can say everything in place.
 */
export function TaskFrame({ children }: { children: ReactNode }) {
  // A task on screen ends the launch, as a screen does: a navigation from here
  // on moves focus to where it goes.
  useEffect(() => markShown(), []);
  return (
    <TaskFrameContext.Provider value>
      <div className="min-h-dvh bg-grouped-bg">
        <StorageBanner />
        <main>{children}</main>
      </div>
    </TaskFrameContext.Provider>
  );
}
