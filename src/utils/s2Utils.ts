/**
 * S2 geometry utilities for cell operations.
 *
 * Thin wrappers around the s2js library that translate between S2 cell IDs
 * (bigint), human-readable hex tokens, and geographic lat/lng coordinates.
 * All cell operations default to level 16 (~600 m² cells), which is the
 * resolution used for trail exploration tracking.
 */

import { s2 } from "s2js";
import { r1 } from "s2js";
import { s1 } from "s2js";

/** S2 cell level used throughout the application for trail exploration. */
export const S2_LEVEL = 16;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Return all S2 cell IDs at `S2_LEVEL` that cover the given bounding box.
 *
 * Uses `RegionCoverer` with both `minLevel` and `maxLevel` pinned to
 * `S2_LEVEL` so every returned cell is exactly the same size.
 *
 * @param sw - South-west corner of the bounding box (degrees).
 * @param ne - North-east corner of the bounding box (degrees).
 * @returns  Array of S2 cell IDs as bigints.
 */
export function cellsFromBounds(sw: { lat: number; lng: number }, ne: { lat: number; lng: number }): bigint[] {
    const rect = new s2.Rect(
        new r1.Interval(toRad(sw.lat), toRad(ne.lat)),
        new s1.Interval(toRad(sw.lng), toRad(ne.lng)),
    );

    const coverer = new s2.RegionCoverer({
        minLevel: S2_LEVEL,
        maxLevel: S2_LEVEL,
    });

    return Array.from(coverer.covering(rect));
}

/**
 * Return the four corner vertices of an S2 cell in lat/lng degrees.
 *
 * Vertices are returned in the order the S2 library enumerates them
 * (counter-clockwise when viewed from outside the sphere). Suitable for
 * drawing cell outlines on a 2-D canvas or WebGL layer.
 *
 * @param cellId - S2 cell ID as bigint.
 * @returns      Array of four `{ lat, lng }` objects in degrees.
 */
export function cellToVertices(cellId: bigint): Array<{ lat: number; lng: number }> {
    const cell = s2.Cell.fromCellID(cellId);
    const vertices: Array<{ lat: number; lng: number }> = [];

    for (let k = 0; k < 4; k++) {
        const pt = cell.vertex(k);
        const ll = s2.LatLng.fromPoint(pt);
        vertices.push({
            lat: s1.angle.degrees(ll.lat),
            lng: s1.angle.degrees(ll.lng),
        });
    }

    return vertices;
}

/**
 * Encode an S2 cell ID as a compact hex token string.
 *
 * Tokens are the canonical identifier used by the backend API and stored
 * in the client-side cache. The encoding strips trailing zeros, so
 * different levels produce different-length strings.
 *
 * @param cellId - S2 cell ID as bigint.
 * @returns      Hex token string, e.g. `'4f7e52163'`.
 */
export function cellToToken(cellId: bigint): string {
    return s2.cellid.toToken(cellId);
}

/**
 * Decode a hex token string back into an S2 cell ID.
 *
 * The inverse of `cellToToken`. Returns `0n` for invalid tokens; callers
 * that receive tokens from external sources should validate with
 * `isValidToken` before use.
 *
 * @param token - Hex token string.
 * @returns     S2 cell ID as bigint.
 */
export function tokenToCell(token: string): bigint {
    return s2.cellid.fromToken(token);
}

/**
 * Return whether a bigint represents a valid (non-zero) S2 cell ID.
 *
 * The s2js library uses `0n` as the sentinel for an invalid cell ID,
 * for example when `fromToken` is given a malformed string.
 *
 * @param cellId - S2 cell ID as bigint.
 * @returns      `true` if the cell ID is valid.
 */
export function isValidCellId(cellId: bigint): boolean {
    return cellId !== 0n;
}

/**
 * Return whether a hex token string decodes to a valid S2 cell ID.
 *
 * @param token - Hex token string.
 * @returns     `true` if the token is well-formed and non-zero.
 */
export function isValidToken(token: string): boolean {
    return isValidCellId(tokenToCell(token));
}

/**
 * Return whether the center of the S2 cell identified by `token` falls
 * within the given lat/lng bounding box.
 *
 * The center-point test is an approximation: cells that straddle the
 * bounding box edge may be included or excluded. For viewport culling
 * this is acceptable because the caller renders all visible cells anyway.
 *
 * @param token - Hex token of the cell to test.
 * @param sw    - South-west corner of the bounding box (degrees).
 * @param ne    - North-east corner of the bounding box (degrees).
 * @returns     `true` if the cell center lies inside the bounding box.
 */
export function isCellInBounds(token: string, sw: { lat: number; lng: number }, ne: { lat: number; lng: number }): boolean {
    const cellId = tokenToCell(token);
    const latLng = s2.LatLng.fromPoint(s2.Cell.fromCellID(cellId).center());
    const lat = s1.angle.degrees(latLng.lat);
    const lng = s1.angle.degrees(latLng.lng);
    return lat >= sw.lat && lat <= ne.lat && lng >= sw.lng && lng <= ne.lng;
}

/**
 * Returns the S2 cell ID containing the given geographic point at the specified level.
 *
 * @param lat   - Latitude in degrees.
 * @param lng   - Longitude in degrees.
 * @param level - S2 cell level (defaults to `S2_LEVEL`).
 * @returns     S2 cell ID as bigint.
 */
export function cellFromLatLng(lat: number, lng: number, level: number = S2_LEVEL): bigint {
    const leafCell = s2.cellid.fromLatLng(s2.LatLng.fromDegrees(lat, lng));
    return s2.cellid.parent(leafCell, level);
}

