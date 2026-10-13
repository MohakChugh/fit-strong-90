/**
 * Today's log's "Recently deleted" (J§20.4 rule 6, board D109): what was
 * deleted in the last 7 days, newest first, each with Restore. A restore is
 * merge-safe (B-05): the record comes back under a fresh id. What a restore
 * did is said under the list until the sheet closes: never on a timer.
 */
import { useMemo, useState } from 'react';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { dismissUndoFor } from '@/components/hig/undo';
import { countsFree } from '@/food/level';
import { useClock } from '@/screens/today/clock';
import { recentEntries } from '@/store/recent';
import { useStore } from '@/store/useStore';
import type { DisplayPrefs } from './format';
import { recentRow } from './recentRows';
import { restoreEntry } from './restoreEntry';

export function RecentlyDeleted({ prefs, today }: { prefs: DisplayPrefs; today: string }) {
  const { contentState, profile } = useStore();
  const { now } = useClock();
  const [open, setOpen] = useState(false);
  const [said, setSaid] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const entries = useMemo(() => recentEntries(contentState, now.getTime()), [contentState, now]);
  // Read now, so a choice made after the deletion still keeps its figure off every row, name and outcome (P8S-10).
  const noFigures = countsFree(profile);
  if (entries.length === 0 && !open) return null;
  const routes = entries.some(e => (e.records?.routes?.length ?? 0) > 0);

  const restore = async (id: string, title: string) => {
    setProblem(undefined);
    setSaid(undefined);
    const e = entries.find(x => x.id === id);
    const done = e ? await restoreEntry(e, profile) : { problem: 'That’s no longer in Recently deleted.' };
    if (done.problem) {
      setProblem(`${title} wasn’t restored. ${done.problem}`);
      return;
    }
    // Its Undo, if one still stands, has nothing left to undo; any other stays (B-04).
    dismissUndoFor(id);
    setSaid(done.said ?? `${title} restored.`);
  };

  return (
    <>
      <Group>
        <Row onClick={() => { setSaid(undefined); setProblem(undefined); setOpen(true); }} label="Recently deleted" value={entries.length.toLocaleString('en-IN')} numeric chevron />
      </Group>
      <Sheet open={open} onOpenChange={setOpen} title="Recently deleted" detent="large">
        <Group footer={[
          'Each is kept on this device for 7 days after it was deleted, then removed for good.',
          routes ? 'Erase all routes, in Me → Data, removes the routes here at once.' : '',
        ].filter(Boolean).join(' ')}>
          {entries.length === 0 && <Row label="Nothing deleted in the last 7 days" />}
          {entries.map(e => {
            const row = recentRow(e, prefs, today, noFigures);
            return (
              <Row
                key={e.id}
                label={row.title}
                detail={row.detail}
                accessory={(
                  <button
                    type="button"
                    data-main=""
                    aria-label={`Restore ${row.title}`}
                    onClick={() => void restore(e.id, row.title)}
                    className="press-feedback min-h-[3.75rem] shrink-0 rounded-full px-4 text-[length:var(--text-body)] font-semibold text-tint"
                  >
                    Restore
                  </button>
                )}
              />
            );
          })}
        </Group>
        {said && <p role="status" className="px-4 text-[length:var(--text-body)]">{said}</p>}
        {problem && <p role="alert" className="px-4 text-[length:var(--text-subhead)] text-stop">{problem}</p>}
      </Sheet>
    </>
  );
}
