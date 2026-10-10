import { describe, expect, it } from 'vitest';
import { countText, portionText, UNITS } from './units';

describe('household units (journey §11.3, §11.6)', () => {
  it('writes counts in halves', () => {
    expect(countText(0.5)).toBe('½');
    expect(countText(1)).toBe('1');
    expect(countText(1.5)).toBe('1½');
    expect(countText(2)).toBe('2');
  });
  it('shows every portion with its grams', () => {
    expect(portionText({ unit: 'piece', noun: ['roti', 'rotis'] }, 2, 40)).toBe('2 rotis (≈ 80 g)');
    expect(portionText({ unit: 'katori' }, 0.5, 150)).toBe('½ katori (≈ 75 g)');
    expect(portionText({ unit: 'katori' }, 1.5, 150)).toBe('1½ katoris (≈ 225 g)');
    expect(portionText({ unit: 'tbsp' }, 2, 15)).toBe('2 tablespoons (≈ 30 g)');
  });
  it('says one portion in the singular, rounds the grams, and names only a piece by its noun', () => {
    expect(portionText({ unit: 'katori' }, 1, 150)).toBe('1 katori (≈ 150 g)');
    expect(portionText({ unit: 'katori' }, 1.5, 145)).toBe('1½ katoris (≈ 218 g)');
    expect(portionText({ unit: 'piece' }, 2, 40)).toBe('2 pieces (≈ 80 g)');
    expect(portionText({ unit: 'katori', noun: ['roti', 'rotis'] }, 1, 150)).toBe('1 katori (≈ 150 g)');
  });
  it('steps katoris in halves and pieces whole', () => {
    expect(UNITS.katori.step).toBe(0.5);
    expect(UNITS.piece.step).toBe(1);
  });
});
