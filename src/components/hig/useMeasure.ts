import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { textSize } from './scale';

/**
 * A chart's container width and text size, measured before the first paint,
 * so a chart never flashes at a guessed size. A ResizeObserver keeps both
 * right through rotation and a split view; they change only when the box
 * does, never per frame. Every chart shares this one.
 */
export function useMeasure<T extends HTMLElement = HTMLElement>(): [RefObject<T | null>, number, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  const [fontPx, setFontPx] = useState(13);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = (px: number) => {
      // Floored, never rounded: a chart half a pixel wider than its box is a
      // horizontal scrollbar at 320 px.
      setWidth(Math.floor(px));
      setFontPx(textSize(parseFloat(getComputedStyle(el).fontSize)));
    };
    update(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    // The observer's content box ignores transforms, so a parent's press
    // animation can't leave the chart measured at its scaled-down width.
    const ro = new ResizeObserver(([entry]) => update(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width, fontPx];
}
