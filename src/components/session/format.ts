import type { Block } from '@/types/plan';

export const BLOCK_COLOR: Record<Block, string> = {
  intro: 'var(--block-mobility)',
  mobility: 'var(--block-mobility)',
  strength: 'var(--block-strength)',
  cardio: 'var(--block-cardio)',
  wrapUp: 'var(--block-cardio)',
};

/** Text and filled-control versions of the block colours (≥ 4.5:1 against the page and against `--on-ink`). */
export const BLOCK_INK: Record<Block, string> = {
  intro: 'var(--block-mobility-ink)',
  mobility: 'var(--block-mobility-ink)',
  strength: 'var(--block-strength-ink)',
  cardio: 'var(--block-cardio-ink)',
  wrapUp: 'var(--block-cardio-ink)',
};

export const BLOCK_LABEL: Record<Block, string> = {
  intro: 'Welcome', mobility: 'Mobility', strength: 'Strength', cardio: 'Cardio', wrapUp: 'Wrap-up',
};

export function fmt(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
