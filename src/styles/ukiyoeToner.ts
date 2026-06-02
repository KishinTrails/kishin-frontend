/**
 * ukiyoeToner.ts — Stamen Toner-inspired MapLibre style with ukiyo-e palette.
 *
 * Replicates the Toner aesthetic (bold ink outlines, high contrast, sparse colour)
 * but substitutes the black/white palette with ukiyo-e colours:
 *   - washi paper instead of white
 *   - sumi ink instead of black
 *   - prussian blue for water (Toner uses solid black)
 *   - moss green for parks (Toner uses halftone patterns — unavailable without Stadia sprite)
 *
 * Uses OpenFreeMap vector tiles (OpenMapTiles schema, no API key required).
 * Does not own: fog overlay, POI overlay, or any canvas-based rendering.
 */

import type { StyleSpecification, Map as MaplibreMap } from 'maplibre-gl';

const C = {
  paper:   '#E8D5A3', // washi paper  — background, road fill, text halo
  ink:     '#1A2B4D', // sumi ink     — roads, outlines, labels, water in Toner
  blue:    '#4A6B8A', // prussian blue — water (replaces Toner's black water)
  green:   '#5B7A5B', // moss green   — parks/vegetation (replaces Toner's halftone)
  ochre:   '#8B6914', // ochre        — paths, building fill
  shadow:  '#B4A07A', // parchment    — buildings, residential
};

/**
 * Generate and register the diagonal building-stripe pattern into a MapLibre map instance.
 *
 * Must be called after each `style.load` event when this style is active, because
 * `map.setStyle()` clears all custom images. The pattern is an 8×8 px tileable
 * diagonal hatch (45°, 4 px period) in sumi ink on a transparent background —
 * transparent areas reveal the washi paper background underneath.
 *
 * @param map - The active MapLibre map instance.
 */
export function addTonerPatterns(map: MaplibreMap): void {
  const size = 8;
  const data = new Uint8ClampedArray(size * size * 4); // initialised to 0 (transparent)
  const [r, g, b] = [0x1a, 0x2b, 0x4d]; // C.ink

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if ((x + y) % 4 === 0) {
        const i = (y * size + x) * 4;
        data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 200;
      }
    }
  }

  map.addImage('building-stripe', { width: size, height: size, data });
}

export const ukiyoeTonerStyle: StyleSpecification = {
  version: 8,
  name: 'Ukiyo-e Toner',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sprite: 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm',
  sources: {
    openmaptiles: {
      type: 'vector',
      url: 'https://tiles.openfreemap.org/planet',
    },
  },
  layers: [

    // ── Background ────────────────────────────────────────────────────────────
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': C.paper },
    },

    // ── Parks & vegetation (replaces Toner halftone pattern) ──────────────────
    {
      id: 'national-park',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'park',
      paint: { 'fill-color': C.green, 'fill-opacity': 0.25 },
    },
    {
      id: 'landcover-wood',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['in', 'class', 'wood', 'wetland'],
      paint: { 'fill-color': C.green, 'fill-opacity': 0.3 },
    },
    {
      id: 'landcover-grass',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['in', 'class', 'grass', 'farmland'],
      paint: { 'fill-color': C.green, 'fill-opacity': 0.15 },
    },

    // ── Water ─────────────────────────────────────────────────────────────────
    // Toner uses solid black; we use prussian blue.
    {
      id: 'water',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: { 'fill-color': C.blue },
    },
    {
      id: 'waterway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'waterway',
      paint: {
        'line-color': C.blue,
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0, 8.5, 1],
        'line-width': ['interpolate', ['exponential', 1.3], ['zoom'],
          9, 0.5, 12, 1.5, 18, 6],
      },
    },

    // ── Buildings — diagonal hatch pattern ────────────────────────────────────
    // fill-pattern references the image registered by addTonerPatterns().
    // Transparent areas of the pattern let the washi paper background show through.
    {
      id: 'building',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 14,
      paint: { 'fill-pattern': 'building-stripe', 'fill-opacity': 0.8 },
    },
    {
      id: 'building-outline',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'line-color': ['interpolate', ['linear'], ['zoom'], 13, C.shadow, 15, C.ink],
        'line-width': 0.75,
      },
    },

    // ── Roads — tunnels (dashed) ───────────────────────────────────────────────
    {
      id: 'tunnel-motorway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['==', 'brunnel', 'tunnel'], ['in', 'class', 'motorway', 'trunk']],
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': C.ink,
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2, 14, 8, 18, 16],
        'line-dasharray': [2, 2],
        'line-opacity': 0.6,
      },
    },
    {
      id: 'tunnel-road',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['==', 'brunnel', 'tunnel'],
        ['in', 'class', 'primary', 'secondary', 'tertiary', 'minor']],
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': C.ink,
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1, 14, 4, 18, 8],
        'line-dasharray': [2, 2],
        'line-opacity': 0.5,
      },
    },

    // ── Roads — casings (ink outline) ─────────────────────────────────────────
    {
      id: 'road-motorway-casing',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['!=', 'brunnel', 'tunnel'], ['in', 'class', 'motorway', 'trunk']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': C.ink,
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3, 14, 12, 18, 20],
      },
    },
    {
      id: 'road-primary-casing',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['!=', 'brunnel', 'tunnel'], ['==', 'class', 'primary']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': C.ink,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 8, 18, 14],
      },
    },
    {
      id: 'road-secondary-casing',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['!=', 'brunnel', 'tunnel'],
        ['in', 'class', 'secondary', 'tertiary']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': C.ink,
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 1.5, 14, 6, 18, 12],
      },
    },
    {
      id: 'road-minor-casing',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['!=', 'brunnel', 'tunnel'], ['in', 'class', 'minor', 'service']],
      minzoom: 14,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': C.ink,
        'line-width': ['interpolate', ['linear'], ['zoom'], 14, 2, 18, 6],
      },
    },

    // ── Roads — fill (paper interior for major roads) ──────────────────────────
    {
      id: 'road-motorway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['!=', 'brunnel', 'tunnel'], ['in', 'class', 'motorway', 'trunk']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': C.paper,
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 14, 8, 18, 14],
      },
    },
    {
      id: 'road-primary',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['!=', 'brunnel', 'tunnel'], ['==', 'class', 'primary']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': C.paper,
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 5, 18, 10],
      },
    },
    {
      id: 'road-secondary',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['!=', 'brunnel', 'tunnel'],
        ['in', 'class', 'secondary', 'tertiary']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': C.ink,
        'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.5, 14, 3, 18, 7],
        'line-opacity': 0.7,
      },
    },
    {
      id: 'road-minor',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['!=', 'brunnel', 'tunnel'], ['in', 'class', 'minor', 'service']],
      minzoom: 13,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': C.ink,
        'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.5, 18, 3],
        'line-opacity': 0.5,
      },
    },
    {
      id: 'road-path',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['in', 'class', 'path', 'track', 'pedestrian'],
      minzoom: 13,
      paint: {
        'line-color': C.ochre,
        'line-width': 1,
        'line-dasharray': [3, 2],
        'line-opacity': 0.8,
      },
    },
    {
      id: 'railway',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['in', 'class', 'rail', 'transit'],
      minzoom: 12,
      paint: {
        'line-color': C.ink,
        'line-width': 1,
        'line-dasharray': [4, 3],
        'line-opacity': 0.6,
      },
    },

    // ── Boundaries ────────────────────────────────────────────────────────────
    {
      id: 'boundary-country',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'boundary',
      filter: ['==', 'admin_level', 2],
      paint: {
        'line-color': C.ink,
        'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 10, 2],
        'line-dasharray': [6, 3],
        'line-opacity': 0.6,
      },
    },

    // ── Labels ────────────────────────────────────────────────────────────────
    {
      id: 'water-label',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'water_name',
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Italic'],
        'text-size': 11,
      },
      paint: {
        'text-color': C.paper,
        'text-halo-color': C.blue,
        'text-halo-width': 1,
      },
    },
    {
      id: 'road-label',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'transportation_name',
      minzoom: 13,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 13, 9, 18, 13],
        'symbol-placement': 'line',
        'text-max-angle': 30,
      },
      paint: {
        'text-color': C.ink,
        'text-halo-color': C.paper,
        'text-halo-width': 2,
      },
    },
    {
      id: 'place-village',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['in', 'class', 'village', 'hamlet', 'suburb', 'neighbourhood'],
      minzoom: 12,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 10, 16, 13],
        'text-letter-spacing': 0.1,
        'text-transform': 'uppercase',
      },
      paint: {
        'text-color': C.ink,
        'text-halo-color': C.paper,
        'text-halo-width': 2,
      },
    },
    {
      id: 'place-town',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['==', 'class', 'town'],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 11, 14, 15],
        'text-letter-spacing': 0.15,
        'text-transform': 'uppercase',
      },
      paint: {
        'text-color': C.ink,
        'text-halo-color': C.paper,
        'text-halo-width': 2,
      },
    },
    {
      id: 'place-city',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['==', 'class', 'city'],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 6, 12, 14, 20],
        'text-letter-spacing': 0.2,
        'text-transform': 'uppercase',
      },
      paint: {
        'text-color': C.ink,
        'text-halo-color': C.paper,
        'text-halo-width': 2.5,
      },
    },
    {
      id: 'country-label',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'place',
      filter: ['==', 'class', 'country'],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 8, 16],
        'text-letter-spacing': 0.3,
        'text-transform': 'uppercase',
      },
      paint: {
        'text-color': C.ink,
        'text-halo-color': C.paper,
        'text-halo-width': 2.5,
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 5, 1, 8, 0],
      },
    },

  ],
};
