import { describe, it, expect } from 'vitest';
import { createDefaultProfile } from '@/profile/defaults';
import { buildSessionPlan } from '@/engine/session';
import { initialState, segmentsWithExtra, type RunnerState } from '@/session/runner';
import { ClipNarrator, type VoiceManifest } from '@/voice/clips';
import { CaptionNarrator, type Narrator } from '@/voice/narrator';
import { clipKey } from '@/voice/sentences';
import { estimateSpeechMs, PLANNER_RATE } from '@/voice/estimate';
import { anchorCues } from './useGuidedSession';

const profile = createDefaultProfile({ pain: { areas: ['lowerBack', 'sciatica'], sciaticaSide: 'left' }, ladder: { hinge: 2, squat: 2, neuralGate: false } });
const plan = buildSessionPlan({ profile, date: '2026-10-09', startDate: '2026-09-28', sessions: [] });
const T0 = 1_000_000;

const COUNTDOWN = 'Three, two, one.';
/** What af_heart actually records this line as (public/voice/af_heart/manifest.json). */
const RECORDED_MS = 1526;

const manifest: VoiceManifest = { voice: 'af_heart', engine: 'kokoro-82m', speed: 0.72, format: 'm4a', lines: { [clipKey(COUNTDOWN)]: RECORDED_MS } };
const clips = new ClipNarrator(manifest, '/voice/af_heart/', { audio: { preload: '' } as unknown as HTMLAudioElement });

/** A step with a hold long enough to get a "Three, two, one." countdown. */
const index = plan.steps.findIndex(s => s.kind === 'hold' && s.holdSeconds >= 8);
const state: RunnerState = { ...initialState(plan), status: 'running', index, stepStartedAt: T0, visit: 1 };

/** Absolute end time of every segment in the step. */
const segmentEnds = segmentsWithExtra(plan.steps[index], state).reduce<number[]>((ends, s, i) => [...ends, (ends[i - 1] ?? T0) + s.ms], []);

const endAligned = (narrator: Narrator) =>
  anchorCues(plan, profile, [], state, t => narrator.estimateMs(t)).filter(c => c.align === 'end' && c.offsetMs === 0);

describe('anchorCues (spec §7.3 end-aligned countdowns)', () => {
  it('lands a recorded countdown exactly at zero, using the clip length', () => {
    const cues = endAligned(clips);
    expect(cues.length).toBeGreaterThan(0);
    for (const c of cues) {
      expect(c.text).toBe(COUNTDOWN);
      expect(c.startAt + clips.estimateMs(c.say ?? c.text)).toBe(segmentEnds[c.seg]);
    }
    // The generic estimate with its 1.2 safety factor used to start this line
    // nearly a second too early, so "one" fell well before the segment end.
    expect(Math.round(estimateSpeechMs(COUNTDOWN, PLANNER_RATE) * 1.2) - RECORDED_MS).toBeGreaterThan(700);
  });

  it('lands exactly at zero for the device voice too', () => {
    const captions = new CaptionNarrator(profile.voice.rate);
    for (const c of endAligned(captions)) {
      expect(c.startAt + captions.estimateMs(c.say ?? c.text)).toBe(segmentEnds[c.seg]);
    }
  });
});
