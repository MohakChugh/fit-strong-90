import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TypeIcon } from 'lucide-react';
import { Group, Row } from '@/components/hig/List';
import { Sheet } from '@/components/hig/Sheet';
import { continueUnsaved, flushAnswers, lookAroundFirst, useAnswersQueue } from '@/setup/draft';
import { useStore } from '@/store/useStore';
import { resumeAt } from '@/setup/graph';
import { InstallSteps } from '@/screens/welcome/InstallSteps';
import { deviceNoun, installContext, installLine, readInstallEnv } from '@/screens/welcome/install';
import { DisplayControls } from '@/screens/you/DisplayScreen';
import { RestoreFlow } from '@/screens/you/RestoreFlow';
import { Notice, PlainButton, PrimaryButton } from '@/screens/you/controls';
import { privacyLine } from '@/screens/you/summaries';
import { SetupShell } from './SetupShell';
import { useCtx, useMove, useSetupAnswers, type Recovery } from './useSetup';

/**
 * Setup's page 1 (journey §6.2 ch. 1, §6.4, §6.5): what the app is, where the
 * record is kept, and three ways on: Get started, Restore from a backup, and
 * Look around first. Display is here (A-66). The install line comes before
 * any answer, so a Safari user can move first (D16).
 */
export function WelcomePage() {
  const navigate = useNavigate();
  const { answers, raw, at } = useSetupAnswers();
  const queue = useAnswersQueue();
  const move = useMove();
  const ctx = useCtx();
  const [{ context, device }] = useState(() => {
    const env = readInstallEnv();
    return { context: installContext(env), device: deviceNoun(env) };
  });
  const [sheet, setSheet] = useState<'display' | 'install'>();
  const [problem, setProblem] = useState<string>();
  // The record Welcome shows, as it's drawn now: a move planned from it, once another copy has replaced it, is refused
  // (H5R-09). A backup restored here redraws Welcome, so Get started goes on in the restored record (V-J11).
  const { epoch: generation } = useStore();
  const line = installLine(context, device);

  // A draft carries on where it stopped, with "Welcome back" (a backup restored here, V-J11); otherwise the first question.
  // Planned from what setup holds now, again after a refused store (H5-02). Only the page to go to is stored: the answers
  // stay as the draft has them (H5-12).
  const start = (unsaved = false) => {
    const go = unsaved ? move.goUnsaved : move.go;
    if (at && at !== 'welcome.start') go(resumeAt(answers, at, ctx), answers, { state: { welcomeBack: true }, opened: answers, generation });
    else go('about.name', answers, { opened: answers, generation });
  };
  // A change from a page left with Back that the device refused shows here too (H5R-16).
  const recovery: Recovery = {
    failed: move.failed || queue.refused !== undefined,
    retry: () => (move.failed ? start() : void flushAnswers()),
    continueUnsaved: () => {
      continueUnsaved('welcome.start', answers, raw);
      if (move.failed) start(true);
    },
  };

  const lookAround = async () => {
    const refused = await lookAroundFirst(generation);
    if (refused) setProblem(refused);
    else navigate('/home', { replace: true });
  };

  return (
    <SetupShell title="Welcome" recovery={recovery}>
      <p className="text-[length:var(--text-title-2)] font-semibold leading-snug">Your health, in one place.</p>
      <p className="text-[length:var(--text-body)] leading-snug">{privacyLine(device)}</p>
      {line && (
        <Group>
          <Row
            label={line.text}
            {...(line.howTo ? {
              accessory: (
                <button type="button" onClick={() => setSheet('install')} className="press-feedback min-h-12 shrink-0 px-2 text-[length:var(--text-body)] font-medium text-tint">
                  Show me how
                </button>
              ),
            } : {})}
          />
        </Group>
      )}
      <Group>
        <Row onClick={() => setSheet('display')} icon={<TypeIcon />} label="Display" detail="Text size, Reduce motion, Reduce transparency" chevron />
      </Group>
      <div className="mt-auto flex flex-col gap-2">
        <PrimaryButton className="min-h-[3.75rem]" onClick={() => start()}>Get started</PrimaryButton>
        <RestoreFlow
          place="welcome"
          {...(context === 'iosBrowser'
            ? { note: 'You are in Safari, and a backup restored here stays in Safari. To keep it, add the app to your Home Screen and restore it there.' }
            : {})}
          trigger={pick => <PlainButton className="min-h-12" onClick={pick}>Restore from a backup</PlainButton>}
        />
        <PlainButton className="min-h-12" onClick={() => void lookAround()}>Look around first</PlainButton>
        {problem && <Notice tone="error">{problem}</Notice>}
      </div>
      <Sheet open={sheet === 'display'} onOpenChange={open => setSheet(open ? 'display' : undefined)} title="Display" detent="large">
        <DisplayControls />
      </Sheet>
      <Sheet open={sheet === 'install'} onOpenChange={open => setSheet(open ? 'install' : undefined)} title="Add FitStrong to your Home Screen" detent="large">
        <InstallSteps device={device} />
      </Sheet>
    </SetupShell>
  );
}
