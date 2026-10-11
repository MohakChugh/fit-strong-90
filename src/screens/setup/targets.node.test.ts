import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '../../..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('setup’s tap targets (§20.4.1; H5-22; board D159)', () => {
  it('nothing in setup or the controls it uses is sized at 40 or 44 px, the switch included', () => {
    const pages = fs.readdirSync(path.join(ROOT, 'src/screens/setup/pages')).map(f => `src/screens/setup/pages/${f}`);
    for (const file of ['src/screens/you/controls.tsx', 'src/screens/setup/controls.tsx', 'src/screens/setup/SetupShell.tsx', 'src/screens/setup/PageFrame.tsx',
      'src/screens/setup/WelcomePage.tsx', 'src/screens/setup/ReviewPage.tsx', 'src/screens/setup/ChapterEditor.tsx', ...pages]) {
      expect(read(file), file).not.toMatch(/\b(?:min-)?h-(?:10|11)\b/);
    }
  });
});
