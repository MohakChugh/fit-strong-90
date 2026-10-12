import { Suspense, useEffect, useState } from 'react';
import { ScrollRestoration } from 'react-router-dom';
import { DatabaseZapIcon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { start, useStore, useStorageNotice } from '@/store/useStore';
import { forgetPlaces, scrollKeyOf } from '@/components/hig/navigation';
import { applyThemeColor } from '@/lib/themeColor';
import { AppRoutes } from '@/routes';
import { ReminderHost } from '@/reminders/ReminderHost';

/**
 * Set once a saved person has been read, so that if the database later cannot
 * be opened the app still knows a record exists here (acceptance J20 step 5).
 * The v4 blob counts too: its data was migrated, not deleted.
 */
const RECORD_MARK = 'fit-strong-90-has-record';
function hadRecord(): boolean {
  try {
    return [RECORD_MARK, 'fit-strong-90-data'].some(key => localStorage.getItem(key) !== null);
  } catch {
    return false;
  }
}

/**
 * Storage could not be opened, so the app cannot read the person's record.
 * When one is known to exist, the only way on is to try again: carrying on
 * unsaved would route them through first-run setup as if their history did
 * not exist. A device that never held one may carry on without saving.
 */
function StorageUnavailable({ onContinue }: { onContinue: () => void }) {
  const notice = useStorageNotice();
  const [existing] = useState(hadRecord);
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-grouped-bg px-6 pt-safe pb-safe text-center">
      <DatabaseZapIcon className="size-10 text-caution" aria-hidden />
      <div className="flex max-w-sm flex-col gap-2">
        <h1 className="text-[length:var(--text-title-2)] font-semibold">{notice?.title ?? 'This device isn’t storing data right now'}</h1>
        <p className="text-[length:var(--text-body)] text-muted-foreground">
          {notice?.detail ?? 'Your record is still on this device; the app just can’t open it at the moment.'}
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <button type="button" onClick={() => window.location.reload()}
          className="press-feedback min-h-12 rounded-xl bg-tint text-[length:var(--text-body)] font-semibold text-on-tint">
          Try again
        </button>
        {!existing && (
          <button type="button" onClick={onContinue}
            className="press-feedback min-h-11 rounded-xl text-[length:var(--text-body)] text-tint">
            Continue without saving
          </button>
        )}
      </div>
      <p className="max-w-sm text-[length:var(--text-footnote)] text-muted-foreground">
        {existing
          ? 'Nothing has been changed or deleted. If the app is open in another tab or window, close it, then try again.'
          : 'Without saving, nothing you enter will be kept after you close the app.'}
      </p>
    </main>
  );
}

function App() {
  const { theme } = useTheme();
  const { status, settings } = useStore();
  const [continueUnsaved, setContinueUnsaved] = useState(false);

  // Open the database, migrate v4 data across and publish it (D13).
  useEffect(() => {
    void start();
  }, []);

  useEffect(() => {
    if (status !== 'ready') return;
    try {
      if (settings.onboardingComplete) localStorage.setItem(RECORD_MARK, '1');
      else localStorage.removeItem(RECORD_MARK);
    } catch {
      // Web storage refused: there is nothing to mark, and nothing depends on it.
    }
    // No record set up — a first run, or everything deleted: no tab may go
    // back to a screen from before (acceptance J18).
    if (!settings.onboardingComplete) forgetPlaces();
  }, [status, settings.onboardingComplete]);

  useEffect(() => {
    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    root.classList.toggle('dark', theme === 'dark' || (theme === 'system' && mediaQuery.matches));
    // The bars follow the app's theme, not only the device's (the class sets
    // `color-scheme`, so native controls follow it too).
    applyThemeColor(theme);
  }, [theme]);

  // Nothing routes until the device has been read. The onboarding gate works
  // off `onboardingComplete`, which is false until then, so routing early
  // would bounce an existing user through onboarding for a frame. A bare
  // background rather than a spinner: this is usually over in well under the
  // time a spinner would take to stop looking like a glitch.
  if (status === 'loading') return <div className="min-h-dvh bg-grouped-bg" aria-busy="true" />;
  if (status === 'unavailable' && !continueUnsaved) return <StorageUnavailable onContinue={() => setContinueUnsaved(true)} />;

  return (
    <>
      {/* Keyed by place, so a tab returns to where it was scrolled. */}
      <ScrollRestoration getKey={scrollKeyOf} />
      {/* Opted-in reminders while the app is open (board D15). */}
      {settings.onboardingComplete && <ReminderHost />}
      <Suspense fallback={<div className="min-h-dvh bg-grouped-bg" aria-busy="true" />}>
        <AppRoutes onboarded={settings.onboardingComplete} />
      </Suspense>
    </>
  );
}

export default App;
