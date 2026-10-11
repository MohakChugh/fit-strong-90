import { describe, expect, it } from 'vitest';
import { HANDOFF, deviceNoun, installContext, installLine, type InstallEnv } from './install';

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

// Kept from v1's Welcome tests: setup's page 1 and Review read the same context.
describe('installContext', () => {
  const env = (userAgent: string, standalone = false, maxTouchPoints = 0): InstallEnv => ({ userAgent, standalone, maxTouchPoints });
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1';
  const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Safari/605.1.15';
  const CHROME_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1';
  const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';

  it('knows an installed app wherever it runs', () => {
    expect(installContext(env(IPHONE, true))).toBe('installed');
    expect(installContext(env(ANDROID, true))).toBe('installed');
  });

  it('treats every iPhone browser as Safari, because on iOS every browser is', () => {
    expect(installContext(env(IPHONE))).toBe('iosBrowser');
    expect(installContext(env(CHROME_IOS))).toBe('iosBrowser');
  });

  it('sees through an iPad asking for the desktop site, but not a Mac', () => {
    expect(installContext(env(IPAD, false, 5))).toBe('iosBrowser');
    expect(installContext(env(IPAD, false, 0))).toBe('desktop');
    expect(deviceNoun(env(IPAD, false, 5))).toBe('iPad');
  });

  it('names the device in copy', () => {
    expect(deviceNoun(env(IPHONE))).toBe('iPhone');
    expect(deviceNoun(env(ANDROID))).toBe('device');
    expect(installContext(env(ANDROID))).toBe('android');
  });
});
