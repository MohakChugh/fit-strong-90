import { useState } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { ProfileWizard, type WizardResult } from '@/components/profile/ProfileWizard';
import { WIZARD_STEPS, type WizardStep } from '@/components/profile/wizardSteps';
import { createDefaultProfile } from '@/profile/defaults';
import { useStore } from '@/store/useStore';
import { isEnrolled } from '@/health/recommend';
import { NOT_ADVICE } from '@/reminders/copy';
import { withFluidAnswer } from '@/reminders/water';
import { calendarStillReminds } from '@/reminders/calendarNotice';
import { dayOf, nowAt } from '@/health/observation';
import { CalendarStill } from './CalendarStill';
import { Notice, PrimaryButton } from './controls';
import { REVIEW_LABEL, profileSections, reviewNeeded } from './summaries';
import { WizardCover } from './WizardCover';
import { saveProfileAnswers } from './write';

type Outcome = { tone: 'status' | 'error'; text: string };

/** Without the programme, first-time questions are only what safety needs. */
const SAFETY_STEPS: WizardStep[] = ['body', 'health', 'summary'];

/**
 * The answers the app keeps the person safe with, read back so they can be
 * checked, and changed one section at a time through the one wizard every
 * part of the app shares.
 */
export function ProfileScreen() {
  const { profile, settings } = useStore();
  // The section being edited; `'all'` asks the first-time questions.
  const [editing, setEditing] = useState<WizardStep | 'all'>();
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [outcome, setOutcome] = useState<Outcome>();
  const [today] = useState(() => dayOf(nowAt()));
  const review = reviewNeeded(profile);
  // Membership has one definition for the whole app (F29).
  const programme = isEnrolled(settings, profile);
  // The start date is asked, and saved, with the programme's own questions,
  // so editing anything else can never move it.
  const asksDate = programme && (editing === 'about' || editing === 'all');

  const edit = (section: WizardStep | 'all') => {
    setOutcome(undefined);
    setProblem(undefined);
    setEditing(section);
  };
  // Nothing closes while a save is under way: the answers stay until it lands.
  const close = () => {
    if (!saving) setEditing(undefined);
  };

  const save = async (result: WizardResult) => {
    if (saving) return;
    setSaving(true);
    setProblem(undefined);
    const saved = await saveProfileAnswers(result, { startDate: asksDate });
    setSaving(false);
    if (!saved.ok) {
      // Shown in the editor, which still holds every answer to try again.
      setProblem(`That did not save. ${saved.failure.message}`);
      return;
    }
    setEditing(undefined);
    setOutcome({ tone: 'status', text: 'Saved. Today uses your new answers.' });
  };

  return (
    <Screen title="Profile & health" back={{ to: '/you', label: 'You' }}>
      <CalendarStill still={calendarStillReminds(settings.habits, profile, today)} />
      {review && (
        <Group
          footer={review === 'medicines'
            ? 'Until your diabetes medicines are answered, sessions stay on hold: some medicines change what is safe before exercise.'
            : review === 'sglt2'
              ? 'Whether you take an SGLT2 inhibitor changes what is safe before exercise. They are prescribed for heart and kidney conditions as well as diabetes.'
              : 'These answers came from an older version of the app and have not been checked. Sessions use them to stay safe.'}
        >
          <Row
            onClick={() => edit('health')}
            icon={<TriangleAlertIcon className="text-caution" />}
            label={REVIEW_LABEL[review]}
            detail={review === 'sglt2' ? 'Answer it now' : 'Answer them now'}
            chevron
          />
        </Group>
      )}

      {profile
        ? profileSections(withFluidAnswer(profile, settings.habits), settings.useMetric, { programme, startDate: settings.startDate }).map(section => (
          <Group key={section.title} header={section.title}>
            {/* The answer under its question, not beside it: a long answer
                beside a long question would cut one of them short at 320 px. */}
            {section.rows.map(row => <Row key={row.label} label={row.label} detail={row.value} />)}
            <Row
              onClick={() => edit(section.step)}
              aria-label={`Edit ${section.title.toLowerCase()}`}
              label={<span className="text-tint">Edit</span>}
            />
          </Group>
        ))
        : (
          <>
            <Group footer="The app asks these before any movement, so each session can be kept safe.">
              <Row label="Not answered yet" />
            </Group>
            <PrimaryButton onClick={() => edit('all')}>Answer the questions</PrimaryButton>
          </>
        )}

      <div className="flex flex-col gap-3">
        {outcome && <Notice tone={outcome.tone === 'error' ? 'error' : 'status'}>{outcome.text}</Notice>}
        <p className="px-4 text-[length:var(--text-footnote)] leading-snug text-muted-foreground">
          Your answers stay on this device. The app uses them to keep each session safe and never shares them. {NOT_ADVICE}
        </p>
      </div>

      <WizardCover open={editing !== undefined} onClose={close} label="Edit your answers">
        <ProfileWizard
          // Someone with no answers yet gets the first-time questions, so the
          // starting back-safety levels are worked out from what they say.
          mode={profile ? 'edit' : 'onboarding'}
          steps={editing === 'all' || editing === undefined ? (programme ? WIZARD_STEPS : SAFETY_STEPS) : [editing]}
          // The programme's questions only of someone in the programme.
          programme={programme}
          askStartDate={asksDate}
          busy={saving}
          {...(problem ? { error: problem } : {})}
          initial={{
            profile: withFluidAnswer(profile ?? createDefaultProfile({ weightKg: settings.currentWeight || 0 }), settings.habits),
            ...(settings.startDate ? { startDate: settings.startDate } : {}),
            useMetric: settings.useMetric,
          }}
          onCancel={close}
          onComplete={result => void save(result)}
        />
      </WizardCover>
    </Screen>
  );
}
