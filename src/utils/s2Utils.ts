/**
 * S2 geometry utilities for cell operations.
 * Provides functions for converting between S2 cell IDs, tokens, and geographic coordinates.
 */

import { s2 } from "s2js";
import { r1 } from "s2js";
import { s1 } from "s2js";

export const S2_LEVEL = 16;

const toRad = (deg: number) => (deg * Math.PI) / 180;

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

export function cellToToken(cellId: bigint): string {
    return s2.cellid.toToken(cellId);
}

export function tokenToCell(token: string): bigint {
    return s2.cellid.fromToken(token);
}

export function isValidCellId(cellId: bigint): boolean {
    return cellId !== 0n;
}

export function isValidToken(token: string): boolean {
    return isValidCellId(tokenToCell(token));
}

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
 * @param lat - Latitude in degrees
 * @param lng - Longitude in degrees
 * @param level - S2 cell level (defaults to S2_LEVEL)
 * @returns S2 cell ID as bigint
 */
export function cellFromLatLng(lat: number, lng: number, level: number = S2_LEVEL): bigint {
    const leafCell = s2.cellid.fromLatLng(s2.LatLng.fromDegrees(lat, lng));
    return s2.cellid.parent(leafCell, level);
}
