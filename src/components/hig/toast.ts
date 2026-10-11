import type { CSSProperties } from 'react';

/** Toasts are solid and read at the body size; Undo is a 48 px target (journey §20.4 rules 1 and 12). */
export const TOAST_STYLE: CSSProperties = { fontSize: 'var(--text-body)' };
export const UNDO_STYLE: CSSProperties = {
  height: 'auto', minHeight: '3rem', minWidth: '3rem', paddingInline: '1rem', borderRadius: '9999px',
  fontSize: 'var(--text-body)', fontWeight: 600, background: 'var(--tint)', color: 'var(--on-tint)',
};
