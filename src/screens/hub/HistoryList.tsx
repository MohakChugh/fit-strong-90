import { useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { Link } from 'react-router-dom';
import { Group, Row } from '@/components/hig/List';
import { recordPath, type RecordRef } from '@/screens/track/timeline';
import { HISTORY_PREVIEW } from './frame';
import { HubSection } from './HubFrame';

/**
 * History (journey §8.2): the last three entries, then "Show all". Each row
 * opens its record, where it is corrected or deleted with Undo (§13, B-04);
 * the record's Back returns here. A record just saved here shows with v1's
 * brief highlight that fades (M16).
 */
export function HistoryList({ rows, origin, empty, title = 'History', fresh = [] }: {
  rows: readonly { key: string; label: ReactNode; detail?: ReactNode; ref: RecordRef; ids?: readonly string[] }[];
  origin: { path: string; label: string; search?: string };
  /** What an empty history says ("No stretches yet. Each one shows here."). */
  empty: string;
  title?: string;
  /** The ids just saved from this hub (`SavedResult.ids`). */
  fresh?: readonly string[];
}) {
  const [all, setAll] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const shown = all ? rows : rows.slice(0, HISTORY_PREVIEW);
  // The first newly shown row takes the focus, so the button going doesn't drop it.
  const expand = () => {
    flushSync(() => setAll(true));
    list.current?.querySelectorAll<HTMLElement>('a[href]')[HISTORY_PREVIEW]?.focus();
  };
  return (
    <HubSection title={title}>
      {rows.length === 0 ? (
        <p className="px-4 text-[length:var(--text-body)] leading-snug text-muted-foreground">{empty}</p>
      ) : (
        <div ref={list}>
          <Group>
            {shown.map(r => {
              const isNew = r.ids?.some(id => fresh.includes(id)) ?? false;
              const label = isNew ? <span className="inline-block animate-in fade-in zoom-in-110 duration-500">{r.label}</span> : r.label;
              return <Row key={r.key} as={Link} to={recordPath(r.ref)} state={origin} viewTransition label={label} detail={r.detail} chevron />;
            })}
            {!all && rows.length > HISTORY_PREVIEW && <Row label={<span className="text-tint">Show all {rows.length}</span>} onClick={expand} />}
          </Group>
        </div>
      )}
    </HubSection>
  );
}
