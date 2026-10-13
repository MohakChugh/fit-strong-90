/**
 * Whether this window's storage went read-only while it ran (board D107,
 * Codex P8S-04): another copy upgraded the database under it. Set by the
 * store; read by the movement gates, which import nothing of the store.
 */
let readOnly = false;

export const storageReadOnly = (): boolean => readOnly;

export function setStorageReadOnly(on: boolean): void {
  readOnly = on;
}
