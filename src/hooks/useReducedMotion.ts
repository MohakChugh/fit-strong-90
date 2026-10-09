import { useEffect, useState } from 'react';
import { shouldAnimate } from '@/design/motion';
import { useStore } from '@/store/useStore';

/**
 * Tracks the OS "reduce motion" preference, or the app's own Reduce motion
 * setting (motion rule 4): either one asks for less motion.
 *
 * CSS handles reduced motion for keyframe animations, but SVG SMIL
 * (`<animate>`) is immune to CSS animation overrides — it has to be switched
 * off at the source. The exercise animations use this to render a static pose
 * instead of a moving figure.
 */
export function useReducedMotion(): boolean {
  const appReduced = useStore().settings.display?.reduceMotion === true;
  const [systemReduced, setSystemReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setSystemReduced(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return !shouldAnimate({ systemReduced, appReduced });
}
