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