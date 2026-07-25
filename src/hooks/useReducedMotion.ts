import { useEffect, useState } from 'react';

/**
 * Tracks the OS "reduce motion" preference.
 *
 * CSS handles reduced motion for keyframe animations, but SVG SMIL
 * (`<animate>`) is immune to CSS animation overrides — it has to be switched
 * off at the source. The exercise animations use this to render a static pose
 * instead of a moving figure.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
