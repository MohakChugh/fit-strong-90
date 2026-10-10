import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BellIcon, CompassIcon, HardDriveIcon, HeartPulseIcon, MicIcon, SaladIcon, SunMoonIcon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { useStore } from '@/store/useStore';
import { packName } from '@/voice/packs';
import { backupMark, backupNudge, recordSpan } from '@/reminders/backup';
import { NOT_ADVICE } from '@/reminders/copy';
import { deviceNoun, readInstallEnv } from '@/screens/welcome/install';
import { FOCUS_CHOICES } from '@/screens/welcome/focus';
import { buildId } from './about';
import { REVIEW_LABEL, conditionsLine, foodLine, habitsLine, reviewNeeded } from './summaries';
import { shortDate } from './dates';

const THEME = { system: 'Automatic', light: 'Light', dark: 'Dark' } as const;

/**
 * The person's own settings, one grouped list. Everything here is about them,
 * kept on this device; training actions and measurements live in Move and Track.
 */
export function YouHome({ onDone }: { onDone: () => void }) {
  const state = useStore();
  const { settings, profile } = state;
  // Read once per visit: none of these change while the list is open.
  const [{ now, device, build }] = useState(() => ({
    now: new Date(),
    device: deviceNoun(readInstallEnv()),
    build: buildId([...document.scripts].map(s => s.src)),
  }));

  const review = reviewNeeded(profile);
  const nudge = backupNudge(now, backupMark(settings.habits), recordSpan(state), state.revision);
  const lastBackup = settings.habits?.lastExportAt;
  const focus = FOCUS_CHOICES.find(f => f.value === settings.focus);
  const voice = profile?.voice;

  return (
    <Screen
      title="You"
      trailing={
        <button type="button" onClick={onDone} className="press-feedback min-h-11 px-2 text-[length:var(--text-body)] font-semibold text-tint">
          Done
        </button>
      }
    >
      <Group>
        <Row
          as={Link}
          to="/you/profile"
          viewTransition
          icon={<HeartPulseIcon />}
          label="Profile & health"
          detail={review
            ? <span className="text-caution">{REVIEW_LABEL[review]}</span>
            : conditionsLine(profile)}
          chevron
        />
        <Row as={Link} to="/you/food" viewTransition icon={<SaladIcon />} label="Food preferences" detail={foodLine(profile?.food)} chevron />
        <Row as={Link} to="/you/focus" viewTransition icon={<CompassIcon />} label="What you’d like more of" detail={focus?.label ?? 'Not chosen'} chevron />
      </Group>

      <Group>
        <Row as={Link} to="/you/habits" viewTransition icon={<BellIcon />} label="Habits & reminders" detail={habitsLine(settings.habits, profile)} chevron />
      </Group>

      <Group>
        <Row
          as={Link}
          to="/you/voice"
          viewTransition
          icon={<MicIcon />}
          label="Voice & demos"
          detail={`${packName(voice?.pack ?? 'af_heart').split(' · ')[0]} · ${profile?.figure === 'female' ? 'female' : 'male'} figure`}
          chevron
        />
        <Row as={Link} to="/you/appearance" viewTransition icon={<SunMoonIcon />} label="Appearance" detail={THEME[settings.theme]} chevron />
      </Group>

      <Group footer={`Your record lives only on this ${device}. Nothing is sent anywhere.`}>
        <Row
          as={Link}
          to="/you/data"
          viewTransition
          icon={<HardDriveIcon />}
          label="Data & offline"
          detail={nudge.due
            ? <span className="text-caution">{lastBackup ? `Time to back up. The last was ${shortDate(lastBackup)}.` : 'Time to make your first backup.'}</span>
            : lastBackup ? `Backed up ${shortDate(lastBackup)}` : `On this ${device} only`}
          chevron
        />
      </Group>

      <Group header="About" footer={`${NOT_ADVICE} The sources behind each health claim are in Guide.`}>
        <Row label="Version" value={build ? `Build ${build}` : 'Development'} numeric />
        <Row as={Link} to="/guide" viewTransition label="Sources" chevron />
      </Group>
    </Screen>
  );
}
