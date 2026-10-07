/** Pre-recorded coach voices (public/voice/<id>/), rendered at build time with Kokoro-82M. */
export interface VoicePack {
  id: string;
  name: string;
  /**
   * Recorded speech length relative to the planner's estimate at rate 0.85
   * (scripts/voice/render.mjs prints words per minute), so step timings fit the voice.
   * Undefined when the pack isn't recorded and sessions fall back to the device voice.
   */
  pace?: number;
}

export const VOICE_PACKS: VoicePack[] = [
  { id: 'af_heart', name: 'Heart · warm and natural', pace: 0.87 },
  { id: 'af_nicole', name: 'Nicole · soft and soothing', pace: 1.12 },
  { id: 'af_bella', name: 'Bella · bright and warm' },
  { id: 'bf_emma', name: 'Emma · gentle British' },
];

/** Display name for a voice pack id (falls back to the id). */
export function packName(id: string): string {
  return VOICE_PACKS.find(p => p.id === id)?.name ?? id;
}

/** Pace factor for a recorded pack, or undefined when it isn't recorded. */
export function packPace(id: string | undefined): number | undefined {
  return VOICE_PACKS.find(p => p.id === (id ?? 'af_heart'))?.pace;
}

/** Ids of the packs actually deployed (public/voice/index.json, written by the renderer). */
export async function loadPackIndex(baseUrl: string, signal?: AbortSignal): Promise<Set<string>> {
  try {
    const res = await fetch(`${baseUrl}voice/index.json`, { signal });
    if (!res.ok) return new Set();
    const j = (await res.json()) as { packs?: string[] };
    return new Set(j.packs ?? []);
  } catch {
    return new Set();
  }
}
