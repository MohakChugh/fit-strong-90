import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeftIcon } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';
import { useSetupSession } from '@/setup/draft';
import { PlainButton, PrimaryButton } from '@/screens/you/controls';
import { useSetupAnswers, type Recovery } from './useSetup';

/**
 * The glass capsule: the chapter and how far along setup is; its fill moves on
 * with each page (M22). Where large text leaves it no room beside Back and
 * Close, it takes its own line under them, and its label wraps rather than
 * being cut short.
 */
function Capsule({ label, fraction }: { label: string; fraction: number }) {
  return (
    <div role="progressbar" aria-label="Setup" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)} aria-valuetext={label}
      className="glass relative min-h-9 min-w-0 flex-1 overflow-hidden rounded-full px-3 text-center @max-[20rem]:order-last @max-[20rem]:basis-full">
      <span aria-hidden className="setup-capsule-fill absolute inset-y-0 left-0 bg-tint/15" style={{ width: `${Math.round(fraction * 100)}%` }} />
      <span className="relative block truncate text-[length:var(--text-footnote)] font-semibold leading-9 @max-[20rem]:whitespace-normal @max-[20rem]:py-1.5 @max-[20rem]:leading-snug">{label}</span>
    </div>
  );
}

/** A refused store (§6.1, B-07): the answers stay on screen, with the two ways on, each from the page as it is now (H5-02). */
function SaveFailed({ recovery }: { recovery: Recovery }) {
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-xl bg-caution/10 p-4">
      <p className="text-[length:var(--text-body)] font-semibold leading-snug">Your answers aren’t being saved on this phone.</p>
      <p className="text-[length:var(--text-subhead)] leading-snug">They’re still here. Try again, or carry on without saving: then they’re kept only until you close FitStrong.</p>
      <PrimaryButton className="min-h-[3.75rem]" onClick={recovery.retry}>Try again</PrimaryButton>
      <PlainButton className="min-h-12" onClick={recovery.continueUnsaved}>Continue without saving</PlainButton>
    </div>
  );
}

/**
 * Every setup page's frame (journey §6.1, M22): Back, the capsule, Close once
 * the app is open behind it, the heading, "Welcome back" on resuming, the
 * warning while unsaved, and a refused store. The page is named
 * `setup-page` for its own view transition; under Reduce Motion it fades in.
 */
export function SetupShell({ title, capsule, onBack, recovery, children }: {
  title: string;
  capsule?: { label: string; fraction: number };
  onBack?: () => void;
  recovery?: Recovery;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useSetupSession();
  const { setup } = useSetupAnswers();
  const reduced = useReducedMotion();
  const heading = useRef<HTMLHeadingElement>(null);
  const welcomeBack = (location.state as { welcomeBack?: boolean } | null)?.welcomeBack === true;
  // After "Look around first", or unsaved and entered, Home is behind setup and Close goes back to it.
  const canClose = setup.stage === 'lookAround' || session.entered;
  // A new page is announced by its heading, as a new screen is.
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [title]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]">
      {/* A container, so the row can lay itself out by its own width at the person's text size. */}
      <div className="@container">
        <div data-setup-nav className="flex min-h-12 items-center gap-2 @max-[20rem]:flex-wrap @max-[20rem]:justify-between">
          {onBack
            ? (
              <button type="button" onClick={onBack} className="press-feedback flex min-h-12 min-w-12 items-center gap-0.5 pr-2 text-[length:var(--text-body)] text-tint">
                <ChevronLeftIcon className="size-6" aria-hidden />Back
              </button>
            )
            : <span className="min-w-12" aria-hidden />}
          {capsule ? <Capsule {...capsule} /> : <span className="flex-1" aria-hidden />}
          {canClose
            ? <button type="button" onClick={() => navigate('/home')} className="press-feedback min-h-12 min-w-12 px-2 text-[length:var(--text-body)] text-tint">Close</button>
            : <span className="min-w-12" aria-hidden />}
        </div>
      </div>
      <div key={title} style={{ viewTransitionName: 'setup-page' }} className={cn('flex flex-1 flex-col gap-5', reduced && 'setup-page-fade')}>
        <h1 ref={heading} tabIndex={-1} className="text-[length:var(--text-large-title)] font-bold leading-tight tracking-tight outline-none [overflow-wrap:break-word] hyphens-auto">{title}</h1>
        {welcomeBack && <p role="status" className="text-[length:var(--text-body)] leading-snug text-muted-foreground">Welcome back, let’s carry on.</p>}
        {session.unsaved && (
          <p role="status" className="rounded-xl bg-caution/10 p-4 text-[length:var(--text-body)] leading-snug">
            Your answers aren’t being saved on this phone. If you close FitStrong, they’re lost.
          </p>
        )}
        {children}
        {recovery?.failed && <SaveFailed recovery={recovery} />}
      </div>
    </div>
  );
}
