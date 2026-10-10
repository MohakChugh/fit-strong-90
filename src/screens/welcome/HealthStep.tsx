import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ProfileWizard, type WizardResult } from '@/components/profile/ProfileWizard';
import { getState, update, useStore } from '@/store/useStore';
import { STEP_PATH, finished, stepAfter, stepBefore, stepGuard, welcomeWizardSteps, withAnswers } from './assemble';
import { installContext, readInstallEnv } from './install';

/**
 * The questions safety needs before any movement — conditions, diabetes
 * treatment, blood pressure, back and sciatica — asked by the one profile
 * wizard the whole app shares, so its rules and wording live in one place.
 * Build strength also gets the programme's questions and its plan; nobody
 * else is asked about training days or shown a weekly plan.
 */
export function HealthStep() {
  const navigate = useNavigate();
  const { settings, profile } = useStore();
  const [context] = useState(() => installContext(readInstallEnv()));
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string>();
  const guard = stepGuard(context, 'health', { settings, profile });
  if (guard) return <Navigate to={STEP_PATH[guard]} replace />;

  const last = stepAfter(context, 'health', settings.focus) === 'done';
  const before = stepBefore(context, 'health', settings.focus);

  const complete = async (result: WizardResult) => {
    if (saving) return;
    setSaving(true);
    setProblem(undefined);
    // When this is the last step, the answers and the finish are one write:
    // nobody arrives on Today with half a setup.
    // Held until stored, so a refusal can never unmount the wizard holding
    // the answers by finishing Welcome a moment early (D-04).
    const saved = await update(previous => {
      const answered = withAnswers(previous, result);
      return last ? finished(answered) ?? answered : answered;
    }, { hold: true });
    setSaving(false);
    // A failed write is said in the wizard, which still holds every answer
    // to try again. When it was the last step, finishing moves the app on to
    // Today by itself.
    // Without storage the answers are still kept for this session, as the
    // person chose and the banner says, so Welcome goes on.
    if (!saved.ok && getState().status !== 'unavailable') setProblem(`That did not save. ${saved.failure.message}`);
    else if (!last) navigate(STEP_PATH.keep, { viewTransition: true });
  };

  return (
    <ProfileWizard
      mode="onboarding"
      steps={welcomeWizardSteps(settings.focus)}
      busy={saving}
      {...(problem ? { error: problem } : {})}
      {...(profile
        ? { initial: { profile, ...(settings.startDate ? { startDate: settings.startDate } : {}), useMetric: settings.useMetric } }
        : {})}
      onCancel={() => navigate(before ? STEP_PATH[before] : STEP_PATH.focus, { viewTransition: true })}
      onComplete={result => void complete(result)}
    />
  );
}
