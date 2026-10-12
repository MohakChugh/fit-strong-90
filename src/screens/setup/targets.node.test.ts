import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('setup’s tap targets (§20.4.1; H5-22; board D159)', () => {
  /** What setup draws: its own screens and the shared parts they use, the Voices card and the restore flow included (H5-22). */
  const SHARED = ['src/components/profile/VoiceSettingsCard.tsx', 'src/components/profile/ChipGroup.tsx', 'src/screens/you/RestoreFlow.tsx'];

  it('nothing in setup or the controls it uses is sized at 40 or 44 px, the switch included', () => {
    const pages = fs.readdirSync(path.join(ROOT, 'src/screens/setup/pages')).map(f => `src/screens/setup/pages/${f}`);
    for (const file of ['src/screens/you/controls.tsx', 'src/screens/setup/controls.tsx', 'src/screens/setup/SetupShell.tsx', 'src/screens/setup/PageFrame.tsx',
      'src/screens/setup/WelcomePage.tsx', 'src/screens/setup/ReviewPage.tsx', 'src/screens/setup/ChapterEditor.tsx', ...pages, ...SHARED]) {
      expect(read(file), file).not.toMatch(/\b(?:min-)?(?:h|size)-(?:10|11)\b/);
    }
  });

  it('targets side by side, or one above another, are 12 px apart in the shared parts setup uses', () => {
    for (const file of SHARED) expect(read(file), file).not.toMatch(/\bgap-(?:0\.5|1|1\.5|2)\b/);
  });
});
