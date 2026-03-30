import { useState, useCallback } from 'react';
import { loadData, saveData } from '@/services/storage';
import type { AppData } from '@/types';

/**
 * React hook for reactive localStorage
 *
 * Returns the current app data and an update function
 * All updates are automatically persisted to localStorage
 */
export function useAppData() {
  const [data, setData] = useState<AppData>(loadData);

  const update = useCallback((updater: (prev: AppData) => AppData) => {
    setData(prev => {
      const next = updater(prev);
      saveData(next);
      return next;
    });
  }, []);

  return [data, update] as const;
}
