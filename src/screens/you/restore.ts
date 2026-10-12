/**
 * While an import is being written, the restore flow belongs to it (Codex
 * screens re-check N04): its sheet cannot be closed and no other file can be
 * chosen, so a completion can never land on a different file's preview.
 */
export function restoreLocked(stage: { kind: string }): boolean {
  return stage.kind === 'importing';
}
