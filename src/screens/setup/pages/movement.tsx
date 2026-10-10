import { useState } from 'react';
import { Group, Row } from '@/components/hig/List';
import { isEnrolled } from '@/health/recommend';
import { dayOf, nowAt } from '@/health/observation';
import { joinInitial, joinLine } from '@/programme/join';
import { JoinFlow } from '@/programme/JoinFlow';
import { FOCUS_CHOICES } from '@/screens/welcome/focus';
import { useStore } from '@/store/useStore';
import { Ask, type PageProps } from '../controls';

/** "What would you most like to do?" (K-20) and "Do you exercise now?" (`currentlyActive`). */
export function MovementFocus({ a, set, tried }: PageProps) {
  return (
    <>
      <Ask label="What would you most like to do?" tried={tried} value={a.focus} onChange={focus => set({ focus })}
        options={FOCUS_CHOICES.map(({ value, label, detail }) => ({ value, label, detail }))}
        footer="This sets what the app suggests first, not what you can do." />
      <Ask label="Do you exercise now?" header="Do you exercise now?" tried={tried} value={a.active} onChange={active => set({ active })}
        options={[
          { value: 'yes', label: 'Yes', detail: 'At least 30 minutes, 3 days a week, for the last 3 months' },
          { value: 'no', label: 'No, not like that' },
        ]} />
    </>
  );
}

const GOALS = [30, 60, 90, 150].map(m => ({ value: String(m), label: `${m} minutes a week` }));

export function MovementGoal({ a, set, tried }: PageProps) {
  const value = a.weeklyGoal === undefined ? undefined : a.weeklyGoal === 'none' ? 'none' : String(a.weeklyGoal);
  // No WHO line here: it lives in Learn (B-18). The goal is never raised for the person (D31).
  return (
    <Ask label="Your weekly goal" tried={tried} value={value} onChange={v => set({ weeklyGoal: v === 'none' ? 'none' : Number(v) })}
      options={[...GOALS, { value: 'none', label: 'No goal for now' }]}
      footer="Minutes of movement a week. The app never raises it for you; you can change it in Me → Goals." />
  );
}

/** "Join the 12-week strength programme?": Yes opens the programme's own Join flow, not counted in setup's pages (L-01, board D81). */
export function MovementProgramme({ a, set, tried, mode }: PageProps) {
  const { settings, profile } = useStore();
  const [open, setOpen] = useState(false);
  const [today] = useState(() => dayOf(nowAt()));
  if (mode === 'edit' && isEnrolled(settings, profile)) {
    return <Group footer="Me → Goals has Leave the programme."><Row label="You’re in the 12-week programme" /></Group>;
  }
  return (
    <>
      <p className="px-1 text-[length:var(--text-body)] leading-snug">Guided sessions on the days you choose, built around your back and your health. Stretch and Walk work without it.</p>
      <Ask label="Join the 12-week strength programme?" tried={tried} value={a.programme === 'joined' ? 'join' : a.programme}
        onChange={v => (v === 'join' ? setOpen(true) : set({ programme: 'notNow', join: undefined }))}
        options={[{ value: 'join', label: 'Yes, join it' }, { value: 'notNow', label: 'Not now' }]} />
      {a.programme === 'join' && a.join && (
        <Group><Row onClick={() => setOpen(true)} label="Your programme" detail={joinLine(a.join)} chevron /></Group>
      )}
      <JoinFlow open={open} onOpenChange={setOpen} initial={a.join ?? joinInitial(profile, today)}
        onJoin={join => { set({ programme: 'join', join }); setOpen(false); }} />
    </>
  );
}
