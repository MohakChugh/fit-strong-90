import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import App from './App'
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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <TooltipProvider>
        <App />
        <Toaster richColors position="bottom-right" />
      </TooltipProvider>
    </HashRouter>
  </React.StrictMode>,
)
