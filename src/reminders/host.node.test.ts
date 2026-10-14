import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('the host that runs the reminders (K5R-10)', () => {
  it('reads the profile every gate reads, never the stored one alone', () => {
    const host = fs.readFileSync(path.resolve(__dirname, 'ReminderHost.tsx'), 'utf8');
    expect(host).toMatch(/profile: stored[^}]*\} = useStore\(\)/);
    expect(host).toMatch(/gateProfile\(\{ profile: stored, settings \}/);
  });
});
