import { useState } from 'react';
import { CalendarX2Icon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { calendarNotice, type StillReminding } from '@/reminders/calendarNotice';
import { Notice } from './controls';
import { forgetCalendarEvents } from './write';

/**
 * Calendar keeps reminding after the app has stopped (D-01): what to delete,
 * and where. Shown wherever the answer that stopped the habit can be seen or
 * changed. It never says the app has stopped Calendar's reminders; only the
 * person can say they deleted them.
 */
export function CalendarStill({ still }: { still: readonly StillReminding[] }) {
  const [problem, setProblem] = useState<string>();
  const text = calendarNotice(still);
  if (!text) return null;
  const deleted = async () => {
    setProblem(undefined);
    const done = await forgetCalendarEvents(still.map(s => s.habit));
    if (!done.ok) setProblem(`That did not save. ${done.failure.message}`);
  };
  return (
    <>
      <Group>
        <Row icon={<CalendarX2Icon className="text-caution" />} label="Calendar may still remind you" detail={text} />
        <Row onClick={() => void deleted()} label={<span className="text-tint">I have deleted them</span>} />
      </Group>
      {problem && <Notice tone="error">{problem}</Notice>}
    </>
  );
}
