/**
 * iOS text size for a web app. On iPhone and iPad the system body text style
 * (`-apple-system-body`) follows the size the person chose in Settings,
 * including the larger accessibility sizes, but nothing else on a page does.
 * So measure it and scale the root by it: at the default 17 pt the root stays
 * 16 px and the design is unchanged; at a larger setting every rem — text,
 * spacing, touch targets — grows the way a native app's does.
 *
 * macOS Safari knows the keyword too, but there it is a fixed 13 px with no
 * setting behind it, which would shrink the whole app to 80% (scan S-08). So
 * this runs only on a touch screen, where the setting exists; elsewhere the
 * browser's own zoom and text size apply.
 */
const DEFAULT_BODY_PX = 17;
const ROOT_PX = 16;

export function rootSizeFor(bodyPx: number): number | null {
  if (!Number.isFinite(bodyPx) || bodyPx <= 0) return null;
  // Clamp to a sane band: a broken measurement must not shrink the app to
  // nothing or blow it past the largest accessibility size.
  return Math.min(ROOT_PX * 3.5, Math.max(ROOT_PX * 0.8, (ROOT_PX * bodyPx) / DEFAULT_BODY_PX));
}

/**
 * The person's text size as a scale of the design's: the root font size,
 * however it got there (the iOS setting through `applyTextSize`, or the
 * browser's own text size), over the design's 16 px. 1 at the default, 2 at
 * 200%. Anything that is not a size reads as the default.
 */
export function scaleFromRoot(rootPx: number): number {
  return Number.isFinite(rootPx) && rootPx > 0 ? rootPx / ROOT_PX : 1;
}

/** Whether the system text size is the person's setting here: Apple's keyword, on a touch screen (iPadOS reports a Mac). */
export function followsSystemTextSize(env: { supportsKeyword: boolean; maxTouchPoints: number }): boolean {
  return env.supportsKeyword && env.maxTouchPoints > 0;
}

/** The app's own text sizes (journey §16 Display), as a scale of the design's: five choices (§20.4 rule 13). */
export const TEXT_SCALES = [1, 1.15, 1.3, 1.6, 2] as const;
export type TextScale = (typeof TEXT_SCALES)[number];

export function isTextScale(x: unknown): x is TextScale {
  return TEXT_SCALES.includes(x as TextScale);
}

/**
 * The root font size for the app's own text size, over what the device set.
 * `base` is the root's inline size before the app changed it: '' for the
 * browser's own, 'NNpx' from the iOS Text Size, or 'NNN%'. The larger of the
 * two wins, so the app never makes text smaller than the person's own
 * setting (D60).
 */
export function rootFontSize(base: string, scale: number): string {
  if (!(scale > 1)) return base;
  const px = /^([\d.]+)px$/.exec(base);
  // Rounded, as a percentage must be: 1.15 × 100 is 114.99999999999999 in floating point.
  if (px) return `${Math.max(Number(px[1]), Math.round(ROOT_PX * scale * 100) / 100)}px`;
  const pct = /^([\d.]+)%$/.exec(base);
  if (pct) return `${Math.max(Number(pct[1]), Math.round(scale * 100))}%`;
  return `${Math.round(scale * 100)}%`;
}

/**
 * Apply the app's own text size (`settings.display.textScale`). While it's on,
 * the root's own size waits in `data-text-base`. Turning it off gives that
 * back, and the iOS Text Size changing meanwhile updates it (`applyTextSize`).
 * A root the app never changed is left exactly as it is.
 */
export function applyTextScale(scale: number | undefined, doc: Document = document): void {
  const root = doc.documentElement;
  if (scale === undefined || !isTextScale(scale) || scale <= 1) {
    if (root.dataset.textBase !== undefined) {
      root.style.fontSize = root.dataset.textBase;
      delete root.dataset.textBase;
    }
    return;
  }
  const base = root.dataset.textBase ?? root.style.fontSize;
  root.dataset.textBase = base;
  root.style.fontSize = rootFontSize(base, scale);
}

export function applyTextSize(doc: Document = document, scale?: number): void {
  const supportsKeyword = typeof CSS !== 'undefined' && CSS.supports('font', '-apple-system-body');
  if (followsSystemTextSize({ supportsKeyword, maxTouchPoints: navigator.maxTouchPoints ?? 0 })) {
    const probe = doc.createElement('span');
    probe.style.font = '-apple-system-body';
    probe.style.position = 'absolute';
    probe.style.visibility = 'hidden';
    doc.documentElement.appendChild(probe);
    const size = rootSizeFor(parseFloat(getComputedStyle(probe).fontSize));
    probe.remove();
    if (size !== null) {
      // While the app's own size is on, the device's goes under it (`applyTextScale`).
      if (doc.documentElement.dataset.textBase !== undefined) doc.documentElement.dataset.textBase = `${size}px`;
      else doc.documentElement.style.fontSize = `${size}px`;
    }
  }
  if (scale !== undefined) applyTextScale(scale, doc);
}
