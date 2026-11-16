/**
 * mapReady.ts — Runs overlay setup once a MapLibre map can take sources and layers.
 * `addSource` and `addLayer` throw "Style is not done loading" until the map's first style has
 * loaded, and MapPage passes the map to the overlays right after creating it.
 * Does not own: re-adding layers after a style change (each overlay listens to `styledata`).
 */

import type { Map as MaplibreMap } from "maplibre-gl";

/**
 * Calls `setup` now when the map's style is loaded, or once on the map's `load` event.
 *
 * @param map - The map
 * @param setup - Adds the overlay's sources and layers
 */
export function whenStyleLoaded(map: MaplibreMap, setup: () => void | Promise<void>): void {
    if (map.isStyleLoaded()) {
        void setup();
    } else {
        map.once("load", () => void setup());
    }
}
