/**
 * Tap targets, as journey §20.4 rule 1 sets them (design research 4a, L-16):
 * everything tappable at least 48 × 48 px and never under 44, at least 12 px
 * between bezelled controls, and primary buttons and other main targets at
 * least 60 px tall. One place for the sizes, so a screen asks for "a main
 * target" rather than choosing a number.
 */
export const TARGET = {
  /** Anything tappable: 48 × 48 px at least. */
  tap: 'min-h-12 min-w-12',
  /** A primary button or other main target, a destructive confirmation included: 60 px tall at least. */
  primary: 'min-h-[60px]',
  /** Between bezelled controls side by side or stacked: 12 px. */
  gap: 'gap-3',
} as const;
