import type { Claim, IsoDate } from '../schema';
import { READ_AT } from '../sources';

/** The day every claim below was checked against its sources. */
export const REVIEWED: IsoDate = '2026-10-08';

/**
 * Build a claim. Verification is derived from how each cited source was read
 * (`READ_AT`), so it cannot drift from the source register; the integrity
 * test fails if a claim cites a source that has no reading on record.
 */
export function claim(
  id: string,
  statement: string,
  support: [sourceId: string, locator: string][],
  options: Partial<Pick<Claim, 'appliesTo' | 'caution' | 'cautionIds' | 'urgency' | 'movement' | 'swap' | 'policy'>> = {},
): Claim {
  const reads = support.map(([sourceId]) => READ_AT[sourceId]);
  const via = [...new Set(reads.flatMap(r => (r?.via ? [r.via] : [])))].join('; ');
  return {
    id,
    statement,
    support: support.map(([sourceId, locator]) => ({ sourceId, locator })),
    ...options,
    verification: {
      method: 'fetched',
      urls: reads.map(r => r?.url ?? ''),
      ...(via ? { via } : {}),
    },
    reviewedDate: REVIEWED,
  };
}
