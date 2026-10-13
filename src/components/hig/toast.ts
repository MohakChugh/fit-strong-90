import type { CSSProperties } from 'react';

/**
 * Toasts are solid and read at the body size; Undo and Close are main targets, 60 px tall (journey §20.4
 * rules 1 and 12, K8-04). In px, not rem: at a large text size the button grows with its words, not twice
 * over, so the toast stays a compact bar (M19).
 */
export const TOAST_STYLE: CSSProperties = { fontSize: 'var(--text-body)' };
export const UNDO_STYLE: CSSProperties = {
  height: 'auto', minHeight: '60px', minWidth: '3rem', paddingInline: '1rem', borderRadius: '9999px',
  fontSize: 'var(--text-body)', fontWeight: 600, background: 'var(--tint)', color: 'var(--on-tint)',
};
