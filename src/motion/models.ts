/**
 * The coach's two 3D models, as the build names them: under a name that
 * changes with their bytes, so every release's cache holds its own copy, and
 * none can ever be another release's (board D120, Codex P8S-15).
 */
import female from '@/assets/models/coach-female.bin?url';
import male from '@/assets/models/coach-male.bin?url';

export const MODEL_URL = { female, male } as const;
