import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArchiveIcon, LockIcon, ShieldCheckIcon, SmartphoneIcon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { Screen } from '@/components/hig/Screen';
import { update, useStore } from '@/store/useStore';
import { Notice, PlainButton, PrimaryButton } from '@/screens/you/controls';
import { STEP_PATH, finished, stepAfter, stepBefore, stepGuard, type Step } from './assemble';
import { InstallSteps } from './InstallSteps';
import { deviceNoun, installContext, readInstallEnv } from './install';

const BACK_LABEL: Record<Step, string> = { focus: 'Welcome', health: 'Questions', keep: 'Back' };

/**
 * Why the record is safe here, and how to keep it so. On iPhone in Safari
 * this comes before the questions and shows how to add the app to the Home
 * Screen; installed, or anywhere else, it closes Welcome. It never blocks:
 * every version has a way on.
 */
export function KeepStep() {
  const navigate = useNavigate();
  const { settings, profile } = useStore();
  const [{ context, device }] = useState(() => {
    const env = readInstallEnv();
    return { context: installContext(env), device: deviceNoun(env) };
  });
  const [problem, setProblem] = useState<string>();
  const guard = stepGuard(context, 'keep', { settings, profile });
  if (guard) return <Navigate to={STEP_PATH[guard]} replace />;

  const next = stepAfter(context, 'keep', settings.focus);
  const before = stepBefore(context, 'keep', settings.focus);

  const go = async () => {
    if (next !== 'done') {
      navigate(STEP_PATH[next], { viewTransition: true });
      return;
    }
    // Held until stored: finishing moves the app to Today, and a refusal must
    // leave the person here, where it is said (D-09).
    const saved = await update(previous => finished(previous) ?? previous, { hold: true });
    if (!saved.ok) setProblem(`That did not save. ${saved.failure.message}`);
  };

  const local = (
    <p className="flex items-start gap-2 px-1 text-[length:var(--text-body)] leading-snug">
      <LockIcon className="mt-1 size-4 shrink-0 text-tint" aria-hidden />
      <span>Everything you enter stays on this {device}. There is no account, and nothing is sent anywhere.</span>
    </p>
  );

  const backup = (
    <Row
      icon={<ArchiveIcon />}
      label="Back it up now and then"
      detail={`If this ${device} is lost or replaced, a backup file brings your record back. It is in You, under Data & offline.`}
    />
  );

  return (
    <Screen
      title={context === 'installed' ? `Kept on this ${device}` : `Keep it on this ${device}`}
      {...(before ? { back: { to: STEP_PATH[before], label: BACK_LABEL[before] } } : {})}
    >
      {local}

      {context === 'iosBrowser' && (
        <>
          <Group header="Add it to your Home Screen first">
            <Row
              icon={<ShieldCheckIcon />}
              label="So your record is kept"
              detail="In Safari, a website’s data can be cleared after 7 days without a visit. On the Home Screen the app is kept apart from Safari, so it is not cleared that way."
            />
            <Row
              icon={<SmartphoneIcon />}
              label="Before you enter anything"
              detail="Safari and the Home Screen app keep separate data. Open the app from the Home Screen, and everything you enter is kept there."
            />
          </Group>
          <InstallSteps device={device} />
        </>
      )}

      {context === 'installed' && (
        <Group>
          {device === 'device' ? (
            <Row
              icon={<ShieldCheckIcon />}
              label="Kept with the installed app"
              detail="Uninstalling the app, or clearing this browser’s data, would delete it."
            />
          ) : (
            <Row
              icon={<ShieldCheckIcon />}
              label="Safe on your Home Screen"
              detail="An app on the Home Screen is kept apart from Safari, so its data is not cleared the way a website’s can be."
            />
          )}
          {backup}
        </Group>
      )}

      {(context === 'android' || context === 'desktop') && (
        <Group
          footer={context === 'android'
            ? 'To keep it one tap away, choose Add to Home screen or Install app in your browser’s menu.'
            : 'Your browser may offer to install the app, from its address bar or menu.'}
        >
          <Row icon={<ShieldCheckIcon />} label="Kept in this browser" detail="Clearing this browser’s data would delete it, so leave the app’s data in place." />
          {backup}
        </Group>
      )}

      <div className="flex flex-col gap-2">
        {problem && <Notice tone="error">{problem}</Notice>}
        {context === 'iosBrowser'
          ? <PlainButton onClick={() => void go()}>Continue in Safari for now</PlainButton>
          : <PrimaryButton onClick={() => void go()}>Start</PrimaryButton>}
      </div>
    </Screen>
  );
}
