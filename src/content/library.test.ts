import { describe, expect, it } from 'vitest';
import { CARDS } from './cards';
import { claimIdsOfCard, getCard, sourcesFor } from './library';

describe('sources for a screen', () => {
  it('lists each source once, with each section once', () => {
    const cited = sourcesFor(claimIdsOfCard(getCard('card-water-limit')!));
    const niddk = cited.find(c => c.source.id === 'niddk-ckd-eating')!;
    expect(niddk.locators).toEqual(['Liquids', 'Track your liquids', 'Sodium']);
    expect(new Set(cited.map(c => c.source.id)).size).toBe(cited.length);
  });

  it('never repeats a section on any card', () => {
    for (const card of CARDS) {
      for (const { source, locators } of sourcesFor(claimIdsOfCard(card))) {
        expect(new Set(locators).size, `${card.id} / ${source.id}`).toBe(locators.length);
      }
    }
  });

  it('includes the sources of cautions attached to a claim', () => {
    // fd-dal-potassium carries the kidney caution, which cites NIDDK.
    const ids = claimIdsOfCard(getCard('card-dal')!);
    expect(ids).toContain('bp-potassium-kidney');
    expect(sourcesFor(ids).some(c => c.source.id === 'niddk-ckd-eating')).toBe(true);
  });
});
