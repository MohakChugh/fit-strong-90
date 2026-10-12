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

  // Every sentence the coach can say is recorded in every pack, so nothing falls
  // back to the robotic device voice. Run the catalogue and render-all.sh after
  // changing any script line.
  it('records every catalogue sentence in every pack, and ships each clip', () => {
    for (const id of deployed) {
      const m = read(id);
      const missing = lines.filter(l => !(clipKey(l) in m.lines));
      expect(missing, id).toEqual([]);
      const absent = Object.keys(m.lines).filter(k => !fs.existsSync(`public/voice/${id}/${k}.${m.format}`));
      expect(absent, id).toEqual([]);
    }
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

/**
 * The coach's water lines change with the fluid limit (session/script.ts:
 * contract H-DIZZY, Codex re-audit F13). Every variant is asked of the packs
 * themselves, not of `lines.json`, so a catalogue run that loses one profile's
 * wording, and a render that then drops its clip, cannot pass.
 */
describe('the coach’s water lines, for every answer about a fluid limit', () => {
  it('are recorded in every pack', async () => {
    const { createDefaultProfile } = await import('@/profile/defaults');
    const { buildSessionPlan } = await import('@/engine/session');
    const { scriptFor } = await import('@/session/script');
    const { getCoaching } = await import('@/data/coaching');
    const { splitSentences } = await import('./sentences');
    const water = new Set<string>();
    for (const fluidRestriction of [true, 'unsure', false, undefined] as const) {
      const profile = createDefaultProfile({ health: { medicinesReviewed: true, ...(fluidRestriction === undefined ? {} : { fluidRestriction }) } });
      for (const focus of ['lowerA', 'upperA', 'fullA'] as const) {
        const plan = buildSessionPlan({ profile, date: '2026-10-06', startDate: '2026-09-28', sessions: [], focusOverride: focus });
        for (const step of plan.steps) {
          for (const c of scriptFor(step, { profile, plan, coaching: getCoaching, exposures: () => 0 })) {
            for (const s of splitSentences(c.say ?? c.text)) if (/\bsip\b|water|fluid/i.test(s)) water.add(s);
          }
        }
      }
    }
    expect(water.size).toBe(6);
    for (const id of deployed) {
      const m = read(id);
      expect([...water].filter(s => !(clipKey(s) in m.lines)), id).toEqual([]);
    }
  });
});

/**
 * The glucose check before cardio names its level in the person's unit
 * (session/script.ts, scan X2-19). Each wording is asked of the packs
 * themselves, as the water lines are.
 */
describe('the glucose check before cardio, in either unit', () => {
  it('is recorded in every pack', async () => {
    const { createDefaultProfile } = await import('@/profile/defaults');
    const { buildSessionPlan } = await import('@/engine/session');
    const { scriptFor } = await import('@/session/script');
    const { getCoaching } = await import('@/data/coaching');
    const { splitSentences } = await import('./sentences');
    const said = new Set<string>();
    for (const glucoseUnit of ['mg/dL', 'mmol/L'] as const) {
      for (const highHypoRisk of [false, true]) {
        const profile = createDefaultProfile({ health: { medicinesReviewed: true, diabetes: 'type2', insulin: 'injections_or_pump', glucoseMonitor: 'meter', glucoseUnit, highHypoRisk } });
        const plan = buildSessionPlan({ profile, date: '2026-10-06', startDate: '2026-09-28', sessions: [] });
        const step = plan.steps.find(s => s.kind === 'checkpoint' && s.question === 'glucose')!;
        for (const c of scriptFor(step, { profile, plan, coaching: getCoaching, exposures: () => 0 })) for (const s of splitSentences(c.say ?? c.text)) said.add(s);
      }
    }
    expect([...said].filter(s => s.startsWith('If you are under'))).toHaveLength(4);
    for (const id of deployed) {
      const m = read(id);
      expect([...said].filter(s => !(clipKey(s) in m.lines)), id).toEqual([]);
    }
  });
});
