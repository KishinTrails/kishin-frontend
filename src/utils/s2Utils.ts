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

export function cellFromLatLng(lat: number, lng: number, level: number = S2_LEVEL): bigint {
    const leafCell = s2.cellid.fromLatLng(s2.LatLng.fromDegrees(lat, lng));
    return s2.cellid.parent(leafCell, level);
}
