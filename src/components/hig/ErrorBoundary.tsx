import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useRouteError } from 'react-router-dom';
import { TriangleAlertIcon } from 'lucide-react';
import { isChunkLoadError } from './navigation';

/**
 * What a screen shows when it fails to render — most often a screen's code
 * that could not be downloaded (offline, or a deploy replaced the files).
 * Suspense only covers the wait; a failed import is an error, and without a
 * boundary React would unmount everything, tab bar included.
 */
function Fallback({ onRetry, retryReloads = false }: { onRetry?: () => void; retryReloads?: boolean }) {
  return (
    <div role="alert" className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <TriangleAlertIcon className="size-8 text-caution" aria-hidden />
      <div className="flex flex-col gap-1">
        <h1 className="text-[length:var(--text-title-2)] font-semibold">This screen didn’t load</h1>
        <p className="max-w-xs text-[length:var(--text-subhead)] text-muted-foreground">
          Usually a weak connection or an app update. Nothing you entered has been lost.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {onRetry && (
          <button type="button" onClick={onRetry}
            className="press-feedback min-h-11 rounded-xl bg-tint px-5 text-[length:var(--text-body)] font-semibold text-on-tint">
            Try again
          </button>
        )}
        {/* When Try again is itself a reload, a second button would only repeat it. */}
        {!retryReloads && (
          <button type="button" onClick={() => window.location.reload()}
            className="press-feedback min-h-11 rounded-xl px-5 text-[length:var(--text-body)] text-tint">
            Reload the app
          </button>
        )}
      </div>
    </div>
  );
}

interface BoundaryState {
  failed: boolean;
  /** Its code never arrived, rather than it breaking as it drew. */
  download: boolean;
  key?: string;
}

/**
 * Wraps a screen so its failure stays inside it. `resetKey` (the path) clears
 * the error when the person navigates elsewhere, so one broken screen never
 * strands them.
 *
 * Try again draws the screen again. For a screen whose code could not be
 * downloaded that would only show the same failure — the browser keeps it for
 * the life of the page — so there it reloads, which fetches it afresh.
 */
export class ErrorBoundary extends Component<{ resetKey?: string; children: ReactNode }, BoundaryState> {
  state: BoundaryState = { failed: false, download: false, key: this.props.resetKey };

  static getDerivedStateFromError(error: unknown): Pick<BoundaryState, 'failed' | 'download'> {
    return { failed: true, download: isChunkLoadError(error) };
  }

  static getDerivedStateFromProps(props: { resetKey?: string }, state: BoundaryState) {
    return props.resetKey !== state.key ? { failed: false, download: false, key: props.resetKey } : null;
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Screen failed to render', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return this.state.download
      ? <Fallback onRetry={() => window.location.reload()} retryReloads />
      : <Fallback onRetry={() => this.setState({ failed: false })} />;
  }
}

/** The router's last line of defence, for anything outside a screen boundary. */
export function RootError() {
  const error = useRouteError();
  console.error('App failed to render', error);
  return (
    <main className="min-h-dvh bg-grouped-bg pt-safe">
      <Fallback />
    </main>
  );
}
