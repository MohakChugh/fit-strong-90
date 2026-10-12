import { useEffect, useState } from 'react';
import { displayTheme, readStoredTheme, setSettings, useStore, type Theme } from '@/store/useStore';

/**
 * The theme, applied to the document.
 *
 * The theme is the one thing that cannot wait for IndexedDB: it decides the
 * colour of the first frame, and reading it asynchronously would flash light
 * and then flip to dark on every launch. So the store mirrors the *stored*
 * theme into a small synchronous `localStorage` flag (D13), which is what the
 * first paint uses. Once the store has loaded its settings decide, and a
 * change made anywhere reaches every subscriber — including one made while
 * nothing can be saved, which holds for this session.
 */
export function useTheme() {
  const current = useStore();
  // Read once, synchronously, before anything has been painted.
  const [atBoot] = useState<Theme>(() => readStoredTheme() ?? 'system');
  const theme = displayTheme(current, atBoot);

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (currentTheme: Theme, systemPreference: boolean) => {
      const shouldBeDark = currentTheme === 'dark' || (currentTheme === 'system' && systemPreference);

      if (shouldBeDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }

      setIsDark(shouldBeDark);
    };

    // Apply theme initially
    applyTheme(theme, mediaQuery.matches);

    // Listen for system preference changes
    const handleChange = (e: MediaQueryListEvent) => {
      applyTheme(theme, e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [theme]);

  // The flag follows the store once the change is stored, never ahead of it:
  // a theme whose save failed must not be the next launch's first frame.
  const setTheme = (newTheme: Theme) => {
    void setSettings({ theme: newTheme });
  };

  return {
    theme,
    setTheme,
    isDark,
  };
}
