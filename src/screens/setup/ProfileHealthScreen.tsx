import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TriangleAlertIcon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { dayOf, nowAt } from '@/health/observation';
import { calendarStillReminds } from '@/reminders/calendarNotice';
import { NOT_ADVICE } from '@/reminders/copy';
import { withFluidAnswer } from '@/reminders/water';
import { CHAPTER_TITLE } from '@/setup/graph';
import { chapterHref } from '@/setup/progress';
import { CalendarStill } from '@/screens/you/CalendarStill';
import { REVIEW_LABEL, chapterSections, reviewNeeded } from '@/screens/you/summaries';
import { UnsavedClinical } from '@/components/profile/UnsavedClinical';
import { useStore } from '@/store/useStore';

const REVIEW_FOOTER = {
  health: 'These answers came from an older version of the app and have not been checked. Sessions use them to stay safe.',
  medicines: 'Until your diabetes medicines are answered, sessions stay on hold: some medicines change what is safe before exercise.',
  sglt2: 'Whether you take a “-gliflozin” medicine changes what is safe before exercise. They are prescribed for heart and kidney conditions as well as diabetes.',
} as const;

/**
 * Profile & health (journey §16): the setup chapters' answers, read back from
 * the record, each with Edit, which opens its own pages. An answer that needs
 * a review comes first, as in v1.
 */
export function ProfileHealthScreen() {
  const { settings, profile, observations } = useStore();
  const [today] = useState(() => dayOf(nowAt()));
  const review = reviewNeeded(profile);
  return (
    <Screen title="Profile & health" back={{ to: '/me', label: 'Me' }}>
      {/* A clinical save the device refused: movement waits until it's tried again or discarded (board D197). */}
      <UnsavedClinical />
      {/* Calendar may still remind about a habit an answer here stopped (D-01, D67). */}
      <CalendarStill still={calendarStillReminds(settings.habits, profile, today)} />
      {review && (
        <Group footer={REVIEW_FOOTER[review]}>
          <Row as={Link} to={chapterHref(review === 'health' ? 'health' : 'medicines')} viewTransition
            icon={<TriangleAlertIcon className="text-caution" />} label={REVIEW_LABEL[review]} detail={review === 'sglt2' ? 'Answer it now' : 'Answer them now'} chevron />
        </Group>
      )}
      {/* A fluid-limit answer v1 kept in its reminders still reads back, as the water rules read it (reminders/water.ts). */}
      {/* Each body measure with when it was taken (H5-24). */}
      {profile && chapterSections(withFluidAnswer(profile, settings.habits), settings, today, observations).map(s => (
        <Group key={s.chapter} header={CHAPTER_TITLE[s.chapter]}>
          {s.rows.map(r => <Row key={r.label} label={r.label} detail={r.value} />)}
          <Row as={Link} to={chapterHref(s.chapter)} viewTransition aria-label={`Edit ${CHAPTER_TITLE[s.chapter]}`} label={<span className="text-tint">Edit</span>} />
        </Group>
      ))}
      <p className="px-4 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
        Your answers stay on this device. The app uses them to keep each session safe and never shares them. {NOT_ADVICE}
      </p>
    </Screen>
  );
}
