/**
 * Colour utility functions used throughout the overlay and UI layers.
 */

/**
 * Convert a hex colour string and an alpha value into a CSS `rgba()` string.
 *
 * Supports both shorthand (`#abc`) and full (`#aabbcc`) hex notation.
 *
 * @param hex   - CSS hex colour, e.g. `'#1a1a1a'` or `'#fff'`.
 * @param alpha - Opacity in the range [0, 1].
 * @returns     A CSS `rgba(r, g, b, alpha)` string.
 */
export const hexToRgba = (hex: string, alpha: number): string => {
  let expandedHex = hex.slice(1);
  if (expandedHex.length === 3) {
    expandedHex = expandedHex.split('').map(c => c + c).join('');
  }
  const r = parseInt(expandedHex.slice(0, 2), 16);
  const g = parseInt(expandedHex.slice(2, 4), 16);
  const b = parseInt(expandedHex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Generate a random fully-saturated colour with medium lightness.
 *
 * Intended for assigning distinct colours to tile groups without repetition.
 *
 * @returns A CSS hex colour string, e.g. `'#e05a2b'`.
 */
export function randomColor(): string {
  const hue = Math.floor(Math.random() * 360);
  return hslToHex(hue, 70, 50);
}

/**
 * Convert HSL colour values to a CSS hex string.
 *
 * Uses the standard HSL→RGB formula with in-place normalisation of s and l
 * from percentage to [0, 1] range.
 *
 * @param h - Hue in degrees [0, 360).
 * @param s - Saturation as a percentage [0, 100].
 * @param l - Lightness as a percentage [0, 100].
 * @returns  A CSS hex colour string, e.g. `'#4fc08d'`.
 */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}