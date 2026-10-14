import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useRouteError } from 'react-router-dom';
import { TriangleAlertIcon } from 'lucide-react';
import { peekWalk } from '@/walk/persist';
import { isChunkLoadError } from './navigation';

/**
 * What a screen shows when it fails to render — a screen's code that could
 * not be downloaded, or one that broke as it drew. Suspense only covers the
 * wait; a failed import is an error, and without a boundary React would
 * unmount everything, tab bar included. Answers typed into a sheet on the
 * failed screen go with it, so it promises only the saved records (K8-14).
 * An unsaved walk keeps its way back (P8-28).
 */
export function Fallback({ onRetry, download = false }: { onRetry?: () => void; download?: boolean }) {
  const walk = peekWalk();
  return (
    <div role="alert" className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <TriangleAlertIcon className="size-8 text-caution" aria-hidden />
      <div className="flex flex-col gap-1">
        <h1 className="text-[length:var(--text-title-2)] font-semibold">This screen didn’t load</h1>
        <p className="max-w-xs text-[length:var(--text-subhead)] text-muted-foreground">
          Usually a weak connection or an app update. Your saved records are safe.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        {/* For a screen whose code never arrived, Try again is the reload that fetches it afresh. A main action: 60 px tall (J§20.4 rule 1). */}
        {(download || onRetry) && (
          <button type="button" onClick={download ? () => window.location.reload() : onRetry}
            className="press-feedback min-h-[3.75rem] rounded-xl bg-tint px-5 text-[length:var(--text-body)] font-semibold text-on-tint">
            Try again
          </button>
        )}
        {/* When Try again is itself a reload, a second button would only repeat it. */}
        {!download && (
          <button type="button" onClick={() => window.location.reload()}
            className="press-feedback min-h-12 rounded-xl px-5 text-[length:var(--text-body)] text-tint">
            Reload the app
          </button>
        )}
        {walk && (
          <a href={`#${walk.href}`} className="press-feedback flex min-h-12 items-center justify-center rounded-xl px-5 text-[length:var(--text-body)] font-semibold text-tint">
            Back to your walk
          </a>
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
export class ErrorBoundary extends Component<{
  resetKey?: string;
  /** Shown above the failure, as the screen would have shown it first: the shared safety surface (codex V1-03). */
  before?: ReactNode;
  children: ReactNode;
}, BoundaryState> {
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
    return (
      <>
        {this.props.before && <div className="px-[max(min(1rem,20px),env(safe-area-inset-left))] pt-[max(0.75rem,env(safe-area-inset-top))]">{this.props.before}</div>}
        {this.state.download
          ? <Fallback download />
          : <Fallback onRetry={() => this.setState({ failed: false })} />}
      </>
    );
  }
}

/** The router's last line of defence, for anything outside a screen boundary. */
export function RootError() {
  const error = useRouteError();
  console.error('App failed to render', error);
  return (
    <main className="min-h-dvh bg-grouped-bg pt-safe">
      <Fallback download={isChunkLoadError(error)} />
    </main>
  );
}
