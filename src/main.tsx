import React from 'react'
import ReactDOM from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import App from './App'
import { RootError } from '@/components/hig/ErrorBoundary'
import { backPending, followRouter, setPlaceCheck } from '@/components/hig/navigation'
import { getState } from '@/store/useStore'
import { placeExists } from '@/places'
import { applyTextSize } from '@/lib/textSize'
import './index.css'

// A deploy replaced the files this page was built from, so a screen it hasn't
// loaded yet can't load: reload onto the new build (at most every 10 s, so a
// real outage can't loop). A guided session resumes from its saved progress.
window.addEventListener('vite:preloadError', () => {
  const last = Number(sessionStorage.getItem('fit-reload-at') ?? 0);
  if (Date.now() - last < 10_000) return;
  sessionStorage.setItem('fit-reload-at', String(Date.now()));
  window.location.reload();
});

// Production only: in dev a cached module would mask code changes.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}

// A data router rather than <HashRouter>: only a data router runs
// `viewTransition` on links and provides <ScrollRestoration>. The app keeps
// its descendant <Routes> under one splat route, so each area still owns its
// own subtree.
const router = createHashRouter([
  {
    path: '*',
    element: (
      <TooltipProvider>
        {/* The part a sheet makes inert; toasts stay outside it, live. */}
        <div id="app">
          <App />
        </div>
        {/* Above the tab bar on a phone and a tablet, not over it (see --toast-offset-bottom). */}
        <Toaster
          position="bottom-right"
          offset={{ bottom: 'var(--toast-offset-bottom)' }}
          mobileOffset={{ bottom: 'var(--toast-offset-bottom)' }}
        />
      </TooltipProvider>
    ),
    errorElement: <RootError />,
  },
])

// The navigation stack (Back, each tab's place, focus, direction) follows the
// router from here, before anything renders. A tab goes back to a record's
// screen only while that record is still stored.
followRouter(router)
setPlaceCheck(place => placeExists(place.pathname, getState()))

// Every forward navigation animates, the way a navigation controller pushes.
// The areas' screens live in their own <Routes>, which are not data routes, and
// React Router 7.13's adapter for those drops the `viewTransition` option on
// the way to the router — so it is added here, once. A pop replays its push's
// transition, which the stack marks as going back. Replacements stay instant —
// redirects — unless they are a Back with nothing to pop to; so does reduced motion.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
const navigate = router.navigate.bind(router)
router.navigate = ((to: Parameters<typeof navigate>[0], opts?: Parameters<typeof navigate>[1]) =>
  typeof to === 'number' || (opts?.replace && !backPending()) || reduceMotion.matches
    ? navigate(to as never, opts)
    : navigate(to, { viewTransition: true, ...opts })) as typeof router.navigate

// Safari's swipe-back already animates the page; a second, app-drawn
// transition on top of it would show the move twice.
let browserAnimatedAt = -Infinity
window.addEventListener('popstate', event => {
  if ((event as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition) browserAnimatedAt = performance.now()
}, { capture: true })

// A second tap before a transition has started skips it, and a skipped
// transition rejects `ready`, which React Router never observes: without this
// every quick double navigation logs an uncaught "Transition was skipped".
if (document.startViewTransition) {
  const start = document.startViewTransition.bind(document)
  document.startViewTransition = ((update?: Parameters<typeof start>[0]) => {
    const transition = start(update)
    transition.ready.catch(() => {})
    // The router starts the transition a few frames after the popstate.
    if (performance.now() - browserAnimatedAt < 1000) {
      browserAnimatedAt = -Infinity
      transition.skipTransition()
    }
    return transition
  }) as typeof document.startViewTransition
}

// Follow the iOS text size before anything renders, and again on return to
// the app, since the setting is changed outside it.
applyTextSize()
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') applyTextSize() })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
