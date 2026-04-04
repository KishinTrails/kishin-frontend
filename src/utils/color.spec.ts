import { describe, it, expect } from 'vitest';
import { hexToRgba } from '@/utils/color';

describe('hexToRgba', () => {
  it('converts hex to rgba with full opacity', () => {
    expect(hexToRgba('#ff0000', 1)).toBe('rgba(255, 0, 0, 1)');
  });

  it('converts hex to rgba with partial opacity', () => {
    expect(hexToRgba('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('handles short hex format', () => {
    expect(hexToRgba('#f00', 1)).toBe('rgba(255, 0, 0, 1)');
  });

  it('handles lowercase hex', () => {
    expect(hexToRgba('#aabbcc', 0.8)).toBe('rgba(170, 187, 204, 0.8)');
  });

  it('handles black', () => {
    expect(hexToRgba('#000000', 0.85)).toBe('rgba(0, 0, 0, 0.85)');
  });

  it('handles white', () => {
    expect(hexToRgba('#ffffff', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
  });
});