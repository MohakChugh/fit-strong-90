import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRightIcon, DumbbellIcon, FootprintsIcon, LockIcon, PersonStandingIcon } from 'lucide-react';
import { Screen } from '@/components/hig/Screen';
import { getState, update, useStore } from '@/store/useStore';
import { cn } from '@/lib/utils';
import { Notice, PlainButton } from '@/screens/you/controls';
import { RestoreFlow } from '@/screens/you/RestoreFlow';
import { STEP_PATH, stepAfter, withFocus, type Focus } from './assemble';
import { FOCUS_CHOICES } from './focus';
import { deviceNoun, installContext, readInstallEnv } from './install';

const ICON: Record<Exclude<Focus, 'explore'>, ReactNode> = {
  strength: <DumbbellIcon />,
  stretch: <PersonStandingIcon />,
  move: <FootprintsIcon />,
};

/**
 * The first screen: one question with three answers and a quiet fourth. It
 * sets what the app leads with, nothing more, and it says so.
 */
export function FocusStep() {
  const navigate = useNavigate();
  const { settings } = useStore();
  const [{ context, device }] = useState(() => {
    const env = readInstallEnv();
    return { context: installContext(env), device: deviceNoun(env) };
  });
  const [problem, setProblem] = useState<string>();

  const choose = async (focus: Focus) => {
    const saved = await update(previous => withFocus(previous, focus));
    // Without storage the answer is still kept for this session, as the
    // person chose and the banner says, so Welcome goes on.
    if (!saved.ok && getState().status !== 'unavailable') {
      setProblem(`That did not save. ${saved.failure.message}`);
      return;
    }
    const next = stepAfter(context, 'focus', focus);
    if (next !== 'done') navigate(STEP_PATH[next], { viewTransition: true });
  };

  const main = FOCUS_CHOICES.filter((c): c is typeof c & { value: Exclude<Focus, 'explore'> } => c.value !== 'explore');
  const explore = FOCUS_CHOICES.find(c => c.value === 'explore');

  return (
    <Screen title="Welcome">
      <div className="flex flex-col gap-3">
        <h2 className="px-1 text-[length:var(--text-title-2)] font-semibold leading-snug">What would you like more of?</h2>
        {main.map(choice => (
          <button
            key={choice.value}
            type="button"
            onClick={() => void choose(choice.value)}
            className={cn(
              'press-feedback flex min-h-[4.5rem] w-full items-center gap-4 rounded-2xl bg-grouped-card px-4 py-4 text-left transition-colors active:bg-muted/60',
              settings.focus === choice.value && 'ring-2 ring-tint',
            )}
          >
            <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-tint/10 text-tint [&_svg]:size-6">
              {ICON[choice.value]}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[length:var(--text-body)] font-semibold leading-snug">{choice.label}</span>
              <span className="block text-[length:var(--text-subhead)] leading-snug text-muted-foreground">{choice.detail}</span>
            </span>
            <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground/70" aria-hidden />
          </button>
        ))}
        {explore && <PlainButton onClick={() => void choose('explore')}>{explore.label}</PlainButton>}
        {problem && <Notice tone="error">{problem}</Notice>}
        <p className="px-1 text-[length:var(--text-subhead)] leading-snug text-muted-foreground">
          This sets where the app starts you, not what you can do. You can change it in You at any time.
        </p>
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <LockIcon className="size-5 text-tint" aria-hidden />
        <p className="max-w-sm px-2 text-[length:var(--text-subhead)] leading-snug text-muted-foreground">
          Everything you enter stays on this {device}. There is no account, and nothing is sent anywhere.
        </p>
        <RestoreFlow
          place="welcome"
          {...(context === 'iosBrowser'
            ? { note: 'You are in Safari, and a backup restored here stays in Safari. To keep it, add the app to your Home Screen and restore it there.' }
            : {})}
          trigger={pick => (
            <button type="button" onClick={pick} className="press-feedback min-h-11 px-3 text-[length:var(--text-body)] text-tint">
              Restore from a backup
            </button>
          )}
        />
      </div>
    </Screen>
  );
}
