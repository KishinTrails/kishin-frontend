/**
 * mapCenter.ts — Where the map opens before a GPS position is known: the settings
 * `VITE_DEFAULT_CENTER_LAT` and `VITE_DEFAULT_CENTER_LON` (in `.env`, read by Vite at build
 * time), or central Paris when either is missing or not a valid coordinate.
 * Does not own: following the GPS position (see `composables/useTrailTracker.ts`).
 */

/** Central Paris, used when the settings are missing or invalid. */
export const FALLBACK_CENTER = { lat: 48.85542074268142, lng: 2.345938844267552 };

/**
 * The map's starting centre from the two settings.
 *
 * @param lat - Value of `VITE_DEFAULT_CENTER_LAT`, a latitude in degrees
 * @param lon - Value of `VITE_DEFAULT_CENTER_LON`, a longitude in degrees
 * @returns The centre, or `FALLBACK_CENTER` when a value is missing, not a number or out of range
 */
export function parseMapCenter(lat: string | undefined, lon: string | undefined): { lat: number, lng: number } {
    if (!lat?.trim() || !lon?.trim()) return FALLBACK_CENTER;
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return FALLBACK_CENTER;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return FALLBACK_CENTER;
    return { lat: latitude, lng: longitude };
}

/** The map's starting centre for this build. */
export const MAP_CENTER = parseMapCenter(
    import.meta.env.VITE_DEFAULT_CENTER_LAT as string | undefined,
    import.meta.env.VITE_DEFAULT_CENTER_LON as string | undefined,
);
