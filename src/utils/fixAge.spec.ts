import { describe, it, expect } from 'vitest';
import { fixAge } from './fixAge';

describe('fixAge', () => {
  const now = 1_800_000_000_000;

  it.each([
    [0, 'just now'],
    [4_000, 'just now'],
    [12_000, '12 s ago'],
    [59_000, '59 s ago'],
    [3 * 60_000 + 20_000, '3 min ago'],
    [2 * 3_600_000 + 5 * 60_000, '2 h ago'],
    [-10_000, 'just now'],
  ])('a fix %i ms old reads "%s"', (age, text) => {
    expect(fixAge(now - age, now)).toBe(text);
  });
});
