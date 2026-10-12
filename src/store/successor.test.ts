import { describe, expect, it } from 'vitest';
import { DB_VERSION } from './db';
import { SCHEMA_VERSION } from './migrate';
import { SUCCESSOR } from './successor';

describe('the suite’s successor build (D121)', () => {
  it('is no build but the suite’s: every other has IndexedDB 2 and schema 6', () => {
    expect(SUCCESSOR).toBe(0);
    expect(DB_VERSION).toBe(2);
    expect(SCHEMA_VERSION).toBe(6);
  });
});
