import { describe, it, expect } from 'vitest';
import { clipKey, splitSentences } from './sentences';
// @ts-expect-error -- plain ESM helper shared with the build-time renderer
import { clipKey as renderKey } from '../../scripts/voice/key.mjs';

describe('voice clip keys', () => {
  it('match the build-time renderer exactly', () => {
    for (const s of ['Begin. Ease into it.', 'Rest 90 seconds.', 'Switch to your left side.', 'Today\u2019s plan.']) {
      expect(clipKey(s)).toBe(renderKey(s));
    }
  });

  it('ignore case and spacing', () => {
    expect(clipKey('  Rest   90 seconds. ')).toBe(clipKey('rest 90 seconds.'));
  });

  it('split narration into sentences', () => {
    expect(splitSentences('Next: Goblet Squat. Hold the weight at your chest! Ready?')).toEqual(['Next: Goblet Squat.', 'Hold the weight at your chest!', 'Ready?']);
  });
});
