import { BookOpenIcon, DumbbellIcon, FootprintsIcon, NotebookPenIcon, PersonStandingIcon, type LucideIcon } from 'lucide-react';
import { Sheet } from '@/components/hig/Sheet';
import { Group, Row } from '@/components/hig/List';
import type { ChooserId, ChooserRow } from './model';

const ICON: Record<ChooserId, LucideIcon> = {
  stretch: PersonStandingIcon,
  walk: FootprintsIcon,
  guided: DumbbellIcon,
  log: NotebookPenIcon,
  learn: BookOpenIcon,
};

/**
 * Choose something else (codex-vision §5 B): the five modes, in the same
 * order every time, with no submenu. A tall sheet, because five rows with a
 * second line each need the room at larger text sizes.
 */
export function ChooserSheet({ open, onOpenChange, rows, onChoose }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: ChooserRow[];
  onChoose: (row: ChooserRow) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="What would help now?" detent="large">
      <Group>
        {rows.map(row => {
          const Icon = ICON[row.id];
          return (
            <Row
              key={row.id}
              icon={<Icon aria-hidden />}
              label={row.label}
              detail={row.suggested
                // The label's colour and weight, not the tint: the tint is for things you can tap (D12).
                ? <><span className="font-semibold text-foreground">Suggested</span> · {row.detail}</>
                : row.detail}
              chevron
              onClick={() => onChoose(row)}
            />
          );
        })}
      </Group>
    </Sheet>
  );
}
