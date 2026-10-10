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

/** Whether the system text size is the person's setting here: Apple's keyword, on a touch screen (iPadOS reports a Mac). */
export function followsSystemTextSize(env: { supportsKeyword: boolean; maxTouchPoints: number }): boolean {
  return env.supportsKeyword && env.maxTouchPoints > 0;
}

export function applyTextSize(doc: Document = document): void {
  const supportsKeyword = typeof CSS !== 'undefined' && CSS.supports('font', '-apple-system-body');
  if (!followsSystemTextSize({ supportsKeyword, maxTouchPoints: navigator.maxTouchPoints ?? 0 })) return;
  const probe = doc.createElement('span');
  probe.style.font = '-apple-system-body';
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  doc.documentElement.appendChild(probe);
  const size = rootSizeFor(parseFloat(getComputedStyle(probe).fontSize));
  probe.remove();
  if (size !== null) doc.documentElement.style.fontSize = `${size}px`;
}
