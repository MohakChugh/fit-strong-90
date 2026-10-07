import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { estimateSpeechMs, PLANNER_RATE } from './estimate';
import { clipKey } from './sentences';
import { packPace, VOICE_PACKS } from './packs';
import { ClipNarrator, type VoiceManifest } from './clips';

/** Every line the renderer was asked to record (scripts/voice/render.mjs). */
const lines = JSON.parse(fs.readFileSync('scripts/voice/lines.json', 'utf8')) as string[];
const deployed = (JSON.parse(fs.readFileSync('public/voice/index.json', 'utf8')) as { packs: string[] }).packs;
const read = (id: string) => JSON.parse(fs.readFileSync(`public/voice/${id}/manifest.json`, 'utf8')) as VoiceManifest;

const stubAudio = () => ({ preload: '' }) as unknown as HTMLAudioElement;

describe('recorded voice packs', () => {
  it('ships a manifest for every pack in the index', () => {
    expect(deployed.length).toBeGreaterThan(0);
    for (const id of deployed) expect(Object.keys(read(id).lines).length).toBeGreaterThan(1000);
    expect(deployed.every(id => VOICE_PACKS.some(p => p.id === id))).toBe(true);
  });

  /**
   * The planner sizes steps with `estimate × pace` (engine/speech.ts) and the
   * narrator fits lines into gaps; both must match what the voice really does,
   * or every step is mistimed. The renderer's `speed` knob is not a pace.
   */
  it('declares a pace that matches the recorded clips', () => {
    for (const id of deployed) {
      const m = read(id);
      const pace = packPace(id);
      expect(pace, `${id} has no pace`).toBeDefined();
      let real = 0;
      let planned = 0;
      for (const line of lines) {
        const ms = m.lines[clipKey(line)];
        if (!ms) continue;
        real += ms;
        planned += estimateSpeechMs(line, PLANNER_RATE);
      }
      expect(real / planned).toBeCloseTo(pace!, 1);
    }
  });

  /**
   * A line the renderer hasn't recorded still has to be estimated for gap
   * fitting, and the estimate has to behave like the rest of the pack.
   */
  it('estimates an unrecorded line within 15% of what the pack would record', () => {
    for (const id of deployed) {
      const m = read(id);
      const empty = new ClipNarrator({ ...m, lines: {} }, `/voice/${id}/`, { audio: stubAudio() });
      let real = 0;
      let estimated = 0;
      for (const line of lines) {
        const ms = m.lines[clipKey(line)];
        if (!ms) continue;
        real += ms;
        estimated += empty.estimateMs(line);
      }
      expect(estimated / real, `${id} estimates`).toBeGreaterThan(0.85);
      expect(estimated / real, `${id} estimates`).toBeLessThan(1.15);
    }
  });
});
