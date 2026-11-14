/**
 * mapStyles.ts — The three MapLibre styles the app offers, keyed by `MapStyle`.
 * Shared by the main map and the activity map so both draw the same tiles.
 * Does not own: which style is selected (see `services/mapStyleService.ts`) or the
 * toner patterns, which a map adds itself with `addTonerPatterns` once loaded.
 */

import type { StyleSpecification } from 'maplibre-gl';
import type { MapStyle } from '@/services/mapStyleService';
import { ukiyoEStyle } from '@/styles/ukiyoE';
import { ukiyoeTonerStyle } from '@/styles/ukiyoeToner';

/** OpenStreetMap raster tiles. */
export const STANDARD_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 20 }],
};

/** The style specification of each `MapStyle`. */
export const STYLE_MAP: Record<MapStyle, StyleSpecification> = {
  'standard':    STANDARD_STYLE,
  'ukiyo-e':     ukiyoEStyle,
  'ukiyo-toner': ukiyoeTonerStyle,
};
