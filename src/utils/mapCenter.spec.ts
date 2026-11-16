import { describe, it, expect } from 'vitest';
import { FALLBACK_CENTER, parseMapCenter } from './mapCenter';

describe('parseMapCenter', () => {
  it('reads both settings', () => {
    expect(parseMapCenter('48.8584', '2.2945')).toEqual({ lat: 48.8584, lng: 2.2945 });
  });

  it.each([
    [undefined, undefined],
    ['48.8584', undefined],
    ['', '2.2945'],
    ['  ', '2.2945'],
    ['foo', '2.2945'],
    ['91', '2.2945'],
    ['48.8584', '-181'],
  ])('falls back to Paris for %s, %s', (lat, lon) => {
    expect(parseMapCenter(lat, lon)).toEqual(FALLBACK_CENTER);
  });
});
