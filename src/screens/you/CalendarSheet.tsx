import { useState } from 'react';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { useStore } from '@/store/useStore';
import { deliver } from '@/store/transfer';
import { nowAt } from '@/health/observation';
import { calendarExportOf, calendarUntil } from '@/reminders/calendarNotice';
import { buildIcs, calendarEvents, type CalendarEvent } from '@/reminders/ics';
import { HABIT_LABEL, NOT_ADVICE } from '@/reminders/copy';
import { wallTimeOf } from '@/reminders/time';
import { inWindowOrder } from '@/reminders/schedule';
import type { HabitSettings } from '@/types/habits';
import { Notice, PrimaryButton } from './controls';
import { shortDay } from './dates';
import { clockFormat } from './summaries';
import { recordCalendarExport } from './write';

/** The exact promise, and no more: Calendar reminds; the app does not. */
const PROMISE = 'Adds these reminders to your Calendar, which will remind you even when this app is closed.';

interface Line {
  label: string;
  detail: string;
}

function lines(events: CalendarEvent[], habits: HabitSettings | undefined): Line[] {
  const out: Line[] = [];
  for (const habit of ['water', 'sittingBreak'] as const) {
    // In the window's own order, which may cross midnight (D-11).
    const times = inWindowOrder(events.filter(e => e.habit === habit).map(e => e.minute), habits?.[habit]?.from);
    if (times.length === 0) continue;
    out.push({
      label: HABIT_LABEL[habit],
      detail: times.length === 1
        ? `Once a day, at ${clockFormat(times[0])}`
        : `${times.length} a day, ${clockFormat(times[0])} to ${clockFormat(times[times.length - 1])}`,
    });
  }
  for (const walk of events.filter(e => e.habit === 'mealWalk')) out.push({ label: walk.title, detail: clockFormat(walk.minute) });
  return out;
}

/** A link that opens the app's Today screen, wherever it is served from. */
function appLink(): string {
  return new URL(`${import.meta.env.BASE_URL}#/today`, window.location.origin).href;
}

export function CalendarSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add to Calendar" detent="large">
      {open && <CalendarBody />}
    </Sheet>
  );
}

function CalendarBody() {
  const { settings, profile } = useStore();
  const events = calendarEvents(settings.habits, profile);
  const [outcome, setOutcome] = useState<{ tone: 'status' | 'error'; text: string }>();
  const summary = lines(events, settings.habits);

  const add = async () => {
    const now = new Date();
    const firstDay = wallTimeOf(now).day;
    // The events end after a while, so a forgotten file cannot remind for ever (D-01).
    const text = buildIcs(events, { now, firstDay, appUrl: appLink(), until: calendarUntil(firstDay) });
    // Handed over in the same tap: iOS only opens the share sheet from a gesture.
    const delivered = await deliver(new File([text], 'fitstrong-reminders.ics', { type: 'text/calendar' }));
    if (!delivered.ok) {
      setOutcome({ tone: 'error', text: delivered.failure.message });
      return;
    }
    if (delivered.value === 'cancelled') {
      setOutcome(undefined);
      return;
    }
    // Remembered, so the app can say when Calendar still reminds after it has stopped.
    const noted = await recordCalendarExport(calendarExportOf(events, nowAt(now), firstDay));
    const done = delivered.value === 'share'
      ? 'Shared. If Calendar did not open, save the file to Files and open it there to add the reminders.'
      : 'Downloaded. Open the file to add the reminders to Calendar.';
    setOutcome(noted.ok
      ? { tone: 'status', text: done }
      : { tone: 'error', text: `${done} The app could not note that it made this file, so it cannot remind you to remove these events later.` });
  };
  const until = calendarUntil(wallTimeOf(new Date()).day);

  if (events.length === 0) {
    return (
      <Group footer="Turn on a reminder first, then come back here to add it to Calendar.">
        <Row label="No reminders are on" />
      </Group>
    );
  }

  return (
    <>
      <p className="px-1 text-[length:var(--text-body)] leading-snug">{PROMISE}</p>
      <Group header="These reminders" footer={`${events.length === 1 ? 'One event' : `${events.length} events`}, each repeating daily with an alert at its time, until ${shortDay(until)}. Add a new file before then to keep them.`}>
        {summary.map(line => <Row key={line.label} label={line.label} detail={line.detail} />)}
      </Group>
      <div className="flex flex-col gap-2">
        <PrimaryButton onClick={() => void add()}>Add to Calendar</PrimaryButton>
        {outcome && <Notice tone={outcome.tone}>{outcome.text}</Notice>}
      </div>
      <p className="px-4 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
        When you add them, choose a calendar of their own. To change them later, delete that calendar and add a new file. Calendar does not know your status in this app, so pause them there when you are away. Afterwards, open one of the events to check it shows an alert. {NOT_ADVICE}
      </p>
    </>
  );
}
