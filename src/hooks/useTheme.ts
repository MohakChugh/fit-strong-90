import { useEffect, useState } from 'react';
import { loadData, updateSettings } from '@/services/storage';

type Theme = 'light' | 'dark' | 'system';

/**
 * Hook for managing theme state
 *
 * Reads theme from settings and applies it to the document
 * Handles system preference detection for 'system' theme
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const data = loadData();
    return data.settings.theme;
  });

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

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    updateSettings({ theme: newTheme });
  };

  return {
    theme,
    setTheme,
    isDark,
  };
}
