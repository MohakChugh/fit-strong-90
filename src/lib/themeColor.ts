import type { Theme } from '@/store/useStore';

/**
 * Safari's bars and the status bar take the page's `theme-color`. These are
 * the grouped page behind every screen (`--grouped-bg`), measured in the
 * browser; index.html and the manifest carry the same values.
 */
export const BAR_COLOR = { light: '#f3f4f5', dark: '#0a0a0a' } as const;

/**
 * The colour a `theme-color` tag should hold. index.html keys one tag to each
 * device scheme. While the app follows the device they keep those; once the
 * person picks Light or Dark both say it, so the bars match the page rather
 * than the device.
 */
export function themeColorFor(theme: Theme, media: string): string {
  if (theme === 'light' || theme === 'dark') return BAR_COLOR[theme];
  return /dark/.test(media) ? BAR_COLOR.dark : BAR_COLOR.light;
}

export function applyThemeColor(theme: Theme, doc: Document = document): void {
  for (const meta of doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = themeColorFor(theme, meta.media);
  }
}
