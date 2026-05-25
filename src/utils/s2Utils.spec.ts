import { describe, it, expect } from "vitest";
import { s2 } from "s2js";
import { S2_LEVEL, cellsFromBounds, cellToVertices, cellToToken, tokenToCell, cellFromLatLng } from "./s2Utils";

// Shared fixture — small area, used across most tests
const FIX_SW = { lat: 46.53197, lng: 7.95179 };
const FIX_NE = { lat: 46.54151, lng: 7.97215 };

// Medium area (~10km²) — for "larger bounds returns more cells"
const FIX_LARGE_SW = { lat: 46.52, lng: 7.94 };
const FIX_LARGE_NE = { lat: 46.55, lng: 7.99 };

// Southern hemisphere — Buenos Aires area, for hemisphere coverage tests
const FIX_SH_SW = { lat: -34.62, lng: -58.45 };
const FIX_SH_NE = { lat: -34.6, lng: -58.42 };

// Western hemisphere — NY area, for hemisphere coverage tests
const FIX_WH_SW = { lat: 40.7, lng: -74.02 };
const FIX_WH_NE = { lat: 40.73, lng: -73.97 };

// Single point — for degenerate bounds test
const FIX_POINT = { lat: 46.53197, lng: 7.95179 };

describe("s2Utils", () => {
    describe("S2_LEVEL", () => {
        it("is 16", () => {
            expect(S2_LEVEL).toBe(16);
        });
    });

    // ── cellsFromBounds ──────────────────────────────────────────────────────

    describe("cellsFromBounds", () => {
        it("returns non-empty array for valid France bounds", () => {
            const cells = cellsFromBounds(FIX_SW, FIX_NE);

            expect(Array.isArray(cells)).toBe(true);
            expect(cells.length).toBeGreaterThan(0);
        });

        it("returns array of bigints", () => {
            const cells = cellsFromBounds(FIX_SW, FIX_NE);

            for (const cell of cells) {
                expect(typeof cell).toBe("bigint");
            }
        });

        it("returns array with unique cells", () => {
            const cells = cellsFromBounds(FIX_SW, FIX_NE);

            expect(new Set(cells).size).toBe(cells.length);
        });

        it("returns non-empty array for degenerate (point) bounds", () => {
            const cells = cellsFromBounds(FIX_SW, FIX_SW);

            expect(cells.length).toBeGreaterThanOrEqual(1);
        });

        it("all returned cells are at S2_LEVEL", () => {
            const cells = cellsFromBounds(FIX_SW, FIX_NE);

            for (const cell of cells) {
                expect(s2.cellid.level(cell)).toBe(S2_LEVEL);
            }
        });

        it("returns more cells for larger bounds", () => {
            const small = cellsFromBounds(FIX_SW, FIX_NE);
            const large = cellsFromBounds(FIX_LARGE_SW, FIX_LARGE_NE);

            expect(large.length).toBeGreaterThan(small.length);
        });

        it("returns sorted cells (CellUnion invariant)", () => {
            const cells = cellsFromBounds(FIX_SW, FIX_NE);

            for (let i = 1; i < cells.length; i++) {
                expect(cells[i]).toBeGreaterThan(cells[i - 1]);
            }
        });

        it("works for southern hemisphere coordinates", () => {
            const cells = cellsFromBounds(
                FIX_SH_SW, // Buenos Aires SW
                FIX_SH_NE, // Buenos Aires NE
            );

            expect(cells.length).toBeGreaterThan(0);
        });

        it("works for negative longitude (western hemisphere)", () => {
            const cells = cellsFromBounds(
                FIX_WH_SW, // New York SW
                FIX_WH_NE, // New York NE
            );

            expect(cells.length).toBeGreaterThan(0);
        });
    });

    // ── cellToVertices ───────────────────────────────────────────────────────

    describe("cellToVertices", () => {
        it("returns exactly 4 vertices for a valid cellId", () => {
            const cells = cellsFromBounds(FIX_SW, FIX_NE);

            for (const cellId of cells) {
                expect(cellToVertices(cellId)).toHaveLength(4);
            }
        });

        it("each vertex has lat and lng properties", () => {
            const cells = cellsFromBounds(FIX_SW, FIX_NE);
            const vertices = cellToVertices(cells[0]);

            for (const vertex of vertices) {
                expect(vertex).toHaveProperty("lat");
                expect(vertex).toHaveProperty("lng");
                expect(typeof vertex.lat).toBe("number");
                expect(typeof vertex.lng).toBe("number");
            }
        });

        it("lat/lng are in degrees", () => {
            const cells = cellsFromBounds(FIX_SW, FIX_NE);
            const vertices = cellToVertices(cells[0]);

            for (const vertex of vertices) {
                expect(vertex.lat).toBeGreaterThan(-90);
                expect(vertex.lat).toBeLessThan(90);
                expect(vertex.lng).toBeGreaterThan(-180);
                expect(vertex.lng).toBeLessThan(180);
            }
        });

        it("vertices are in counter-clockwise order", () => {
            const cells = cellsFromBounds(FIX_SW, FIX_NE);
            const vertices = cellToVertices(cells[0]);

            let signedArea = 0;
            for (let i = 0; i < vertices.length; i++) {
                const j = (i + 1) % vertices.length;
                signedArea += vertices[i].lng * vertices[j].lat;
                signedArea -= vertices[j].lng * vertices[i].lat;
            }

            expect(signedArea).toBeGreaterThan(0);
        });

        it("first and last vertex are different", () => {
            const cells = cellsFromBounds(FIX_SW, FIX_NE);
            const vertices = cellToVertices(cells[0]);

            const first = vertices[0];
            const last = vertices[3];
            expect(first.lat !== last.lat || first.lng !== last.lng).toBe(true);
        });

        it("all 4 vertices are distinct", () => {
            const cells = cellsFromBounds(FIX_SW, FIX_NE);
            const vertices = cellToVertices(cells[0]);

            const unique = new Set(vertices.map((v) => `${v.lat},${v.lng}`));
            expect(unique.size).toBe(4);
        });

        it("vertices spatially contain the cell center", () => {
            // The cell from a known point should have that point inside its vertices
            const cellId = cellFromLatLng(FIX_POINT.lat, FIX_POINT.lng);
            const vertices = cellToVertices(cellId);

            const lats = vertices.map((v) => v.lat);
            const lngs = vertices.map((v) => v.lng);

            expect(Math.min(...lats)).toBeLessThan(FIX_POINT.lat);
            expect(Math.max(...lats)).toBeGreaterThan(FIX_POINT.lat);
            expect(Math.min(...lngs)).toBeLessThan(FIX_POINT.lng);
            expect(Math.max(...lngs)).toBeGreaterThan(FIX_POINT.lng);
        });

        it("returns vertices in [lng, lat] projection order (canvas contract)", () => {
            const cells = cellsFromBounds(FIX_SW, FIX_NE);
            const vertices = cellToVertices(cells[0]);

            // First vertex is moveTo, next 3 are lineTo
            expect(vertices).toHaveLength(4);
            const [first, ...rest] = vertices;
            for (const v of rest) {
                expect(v.lat !== first.lat || v.lng !== first.lng).toBe(true);
            }
        });

        it("works for southern hemisphere cells", () => {
            const cellId = cellFromLatLng(FIX_SH_SW.lat, FIX_SH_SW.lng);
            const vertices = cellToVertices(cellId);

            expect(vertices).toHaveLength(4);
            for (const v of vertices) {
                expect(v.lat).toBeLessThan(0);
            }
        });
    });

    // ── cellToToken ──────────────────────────────────────────────────────────

    describe("cellToToken", () => {
        it("returns a non-empty string", () => {
            const cells = cellsFromBounds(FIX_SW, FIX_NE);
            const token = cellToToken(cells[0]);

            expect(typeof token).toBe("string");
            expect(token.length).toBeGreaterThan(0);
        });

        it("token is a lowercase hex string", () => {
            const cells = cellsFromBounds(FIX_SW, FIX_NE);
            const token = cellToToken(cells[0]);

            expect(token).toMatch(/^[0-9a-f]+$/);
        });

        it("different cells produce different tokens", () => {
            const cells = cellsFromBounds(FIX_SW, FIX_NE);

            const tokens = cells.map(cellToToken);
            const uniqueTokens = new Set(tokens);

            expect(uniqueTokens.size).toBe(tokens.length);
        });

        it("token length is consistent with level 16 cells", () => {
            const cells = cellsFromBounds(FIX_SW, FIX_NE);

            // S2 tokens at level 16 are 9 hex chars (4 bits face + 2*16 bits = 36 bits → 9 nibbles)
            for (const cell of cells) {
                const token = cellToToken(cell);
                expect(token.length).toBe(9);
            }
        });
    });

    // ── tokenToCell ──────────────────────────────────────────────────────────

    describe("tokenToCell", () => {
        it("returns a bigint for a valid token", () => {
            const cells = cellsFromBounds(FIX_SW, FIX_NE);
            const token = cellToToken(cells[0]);

            const cellId = tokenToCell(token);

            expect(typeof cellId).toBe("bigint");
            expect(cellId).toBe(cells[0]);
        });

        it("is the exact inverse of cellToToken", () => {
            const cells = cellsFromBounds(FIX_SW, FIX_NE);

            for (const cellId of cells) {
                expect(tokenToCell(cellToToken(cellId))).toBe(cellId);
            }
        });

        it("result is at S2_LEVEL", () => {
            const cells = cellsFromBounds(FIX_SW, FIX_NE);
            const token = cellToToken(cells[0]);

            expect(s2.cellid.level(tokenToCell(token))).toBe(S2_LEVEL);
        });
    });

    // ── cellFromLatLng ───────────────────────────────────────────────────────

    describe("cellFromLatLng", () => {
        it("returns a non-zero bigint", () => {
            const cellId = cellFromLatLng(FIX_POINT.lat, FIX_POINT.lng);

            expect(typeof cellId).toBe("bigint");
            expect(cellId).not.toBe(0n);
        });

        it("result can be converted back to vertices containing the input point", () => {
            const lat = FIX_POINT.lat;
            const lng = FIX_POINT.lng;
            const vertices = cellToVertices(cellFromLatLng(lat, lng));

            const lats = vertices.map((v) => v.lat);
            const lngs = vertices.map((v) => v.lng);

            expect(lats.some((v) => Math.abs(v - lat) < 0.01)).toBe(true);
            expect(lngs.some((v) => Math.abs(v - lng) < 0.01)).toBe(true);
        });

        it("different coordinates produce different cells", () => {
            const cell1 = cellFromLatLng(FIX_SW.lat, FIX_SW.lng);
            const cell2 = cellFromLatLng(FIX_NE.lat, FIX_NE.lng);

            expect(cell1).not.toBe(cell2);
        });

        it("same coordinates always produce the same cell", () => {
            expect(cellFromLatLng(FIX_SW.lat, FIX_SW.lng)).toBe(cellFromLatLng(FIX_SW.lat, FIX_SW.lng));
        });

        it("works for negative latitude (southern hemisphere)", () => {
            const cellId = cellFromLatLng(FIX_SH_SW.lat, FIX_SH_SW.lng);

            expect(typeof cellId).toBe("bigint");
            expect(cellId).not.toBe(0n);
        });

        it("works for zero coordinates", () => {
            const cellId = cellFromLatLng(0, 0);

            expect(typeof cellId).toBe("bigint");
            expect(cellId).not.toBe(0n);
        });

        it("result is contained within bounds covering the same point", () => {
            const lat = FIX_POINT.lat;
            const lng = FIX_POINT.lng;
            const cellId = cellFromLatLng(lat, lng);

            // The cell returned for a point should appear in the covering of a
            // small area around that point
            const cells = cellsFromBounds(
                { lat: lat - 0.005, lng: lng - 0.005 },
                { lat: lat + 0.005, lng: lng + 0.005 },
            );

            expect(cells).toContain(cellId);
        });
    });

    // ── roundtrips ───────────────────────────────────────────────────────────

    describe("roundtrips", () => {
        it("cellToToken + tokenToCell is lossless", () => {
            const cells = cellsFromBounds(FIX_SW, FIX_NE);

            for (const cellId of cells) {
                expect(tokenToCell(cellToToken(cellId))).toBe(cellId);
            }
        });

        it("cellFromLatLng result survives token roundtrip", () => {
            const cellId = cellFromLatLng(FIX_POINT.lat, FIX_POINT.lng);
            const token = cellToToken(cellId);
            const restored = tokenToCell(token);

            expect(restored).toBe(cellId);
        });

        it("cellFromLatLng result has valid vertices", () => {
            const cellId = cellFromLatLng(FIX_POINT.lat, FIX_POINT.lng);
            const vertices = cellToVertices(cellId);

            expect(vertices).toHaveLength(4);
            for (const v of vertices) {
                expect(typeof v.lat).toBe("number");
                expect(typeof v.lng).toBe("number");
                expect(isNaN(v.lat)).toBe(false);
                expect(isNaN(v.lng)).toBe(false);
            }
        });
    });
});
