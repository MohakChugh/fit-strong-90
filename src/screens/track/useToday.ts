import { useSyncExternalStore } from 'react';
import { today } from './periods';

/**
 * Today's date, as a value that changes at midnight. An installed app can sit
 * open overnight; without this, My Day would keep calling yesterday "Today"
 * and refuse the next day as the future.
 */
function subscribe(onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const arm = () => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
    timer = setTimeout(() => {
      onChange();
      arm();
    }, midnight.getTime() - now.getTime());
  };
  arm();
  // Returning to the app after a night away is a visibility change, and a
  // timer may not have fired while the page was frozen.
  const wake = () => document.visibilityState === 'visible' && onChange();
  document.addEventListener('visibilitychange', wake);
  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', wake);
  };
}

export function useToday(): string {
  return useSyncExternalStore(subscribe, () => today(), () => today());
}
