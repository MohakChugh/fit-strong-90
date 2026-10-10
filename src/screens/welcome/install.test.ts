import { describe, expect, it } from 'vitest';
import { HANDOFF, installLine } from './install';

describe('page 1’s line on keeping data here (journey §6.5; D16; B-24)', () => {
  it('in Safari on iPhone, says what installing does and doesn’t, with Show me how', () => {
    expect(installLine('iosBrowser', 'iPhone')).toEqual({ text: 'Installing helps iPhone keep your data, but it isn’t a backup.', howTo: true });
  });
  it('in any other browser, says what would delete it', () => {
    expect(installLine('desktop', 'device')).toEqual({ text: 'Clearing this browser’s data would delete it. Back up now and then.', howTo: false });
    expect(installLine('android', 'device')).toEqual({ text: 'Clearing this browser’s data would delete it. Back up now and then.', howTo: false });
  });
  it('says nothing once installed (V-J37)', () => {
    expect(installLine('installed', 'iPhone')).toBeUndefined();
  });
  it('offers the move to the Home Screen app with a backup (A-27; B-24)', () => {
    expect(HANDOFF).toEqual({
      title: 'Moving to the Home Screen app?',
      text: 'Make a backup first, then restore it there. Safari may remove data from websites you haven’t opened for a while.',
    });
  });
});
