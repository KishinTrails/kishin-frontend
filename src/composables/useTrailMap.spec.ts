import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withSetup } from "@/__tests__/utils/withSetup";
import { useTrailMap } from "@/composables/useTrailMap";

// ─── Mocks ────────────────────────────────────────────────────────────────────
// Only the three service boundaries matter here. No DOM, no maplibre, no h3.

vi.mock("@/services/trailsService", () => ({
    fetchExploredTiles: vi.fn(),
}));

vi.mock("@/services/poiService", () => ({
    fetchCellTypes: vi.fn(),
}));

vi.mock("@/services/cacheService", () => ({
    getCellTypeFromCache: vi.fn().mockReturnValue(null),
}));

vi.mock("h3-js", () => ({
    polygonToCells: vi.fn().mockReturnValue(["cell1", "cell2", "cell3"]),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { fetchExploredTiles } from "@/services/trailsService";
import { fetchCellTypes } from "@/services/poiService";
import { getCellTypeFromCache } from "@/services/cacheService";

/** Minimal bounds stub — mirrors the MapBounds interface */
const makeBounds = (sw = { lat: 45.75, lng: 3.09 }, ne = { lat: 45.76, lng: 3.11 }) => ({
    getSouthWest: () => sw,
    getNorthEast: () => ne,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useTrailMap", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchExploredTiles).mockResolvedValue([]);
        vi.mocked(fetchCellTypes).mockResolvedValue(new Map());
        vi.mocked(getCellTypeFromCache).mockReturnValue(null);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ── Initial state ──────────────────────────────────────────────────────────

    describe("initial state", () => {
        it("exposes empty collections on first use", () => {
            const { result } = withSetup(useTrailMap);

            expect(result.visitedCells.value.size).toBe(0);
            expect(result.visibleCells.value).toEqual([]);
            expect(result.visibleExplored.value).toEqual([]);
            expect(result.visibleFog.value).toEqual([]);
            expect(result.cellTypes.value.size).toBe(0);
        });
    });

    // ── loadExploredTiles ──────────────────────────────────────────────────────

    describe("loadExploredTiles", () => {
        it("populates visitedCells from the service", async () => {
            vi.mocked(fetchExploredTiles).mockResolvedValue(["cellA", "cellB"]);
            const { result } = withSetup(useTrailMap);

            await result.loadExploredTiles();

            expect(result.visitedCells.value.has("cellA")).toBe(true);
            expect(result.visitedCells.value.has("cellB")).toBe(true);
        });

        it("leaves visitedCells empty on API error", async () => {
            vi.mocked(fetchExploredTiles).mockRejectedValue(new Error("network"));
            const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
            const { result } = withSetup(useTrailMap);

            await result.loadExploredTiles();

            expect(result.visitedCells.value.size).toBe(0);
            expect(consoleSpy).toHaveBeenCalledWith("Failed to load explored tiles:", expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    // ── computeCellsFromBounds ─────────────────────────────────────────────────

    describe("computeCellsFromBounds", () => {
        it("returns the cells produced by h3.polygonToCells", () => {
            const { result } = withSetup(useTrailMap);

            const cells = result.computeCellsFromBounds(makeBounds());

            expect(cells).toEqual(["cell1", "cell2", "cell3"]);
        });

        it("builds the correct closed polygon from bounds", async () => {
            const { polygonToCells } = await import("h3-js");
            const { result } = withSetup(useTrailMap);

            result.computeCellsFromBounds(makeBounds({ lat: 1, lng: 2 }, { lat: 3, lng: 4 }));

            expect(polygonToCells).toHaveBeenCalledWith(
                [
                    [1, 2], // SW
                    [3, 2], // NW
                    [3, 4], // NE
                    [1, 4], // SE
                    [1, 2], // close
                ],
                10, // H3_RESOLUTION
            );
        });
    });

    // ── updateVisibleCells ─────────────────────────────────────────────────────

    describe("updateVisibleCells", () => {
        it("splits cells correctly into explored and fog", () => {
            const { result } = withSetup(useTrailMap);
            // h3 mock returns ['cell1', 'cell2', 'cell3']
            result.visitedCells.value = new Set(["cell1"]);

            result.updateVisibleCells(makeBounds());

            expect(result.visibleExplored.value).toEqual(["cell1"]);
            expect(result.visibleFog.value).toEqual(["cell2", "cell3"]);
        });

        it("puts all cells in fog when none are visited", () => {
            const { result } = withSetup(useTrailMap);

            result.updateVisibleCells(makeBounds());

            expect(result.visibleExplored.value).toEqual([]);
            expect(result.visibleFog.value).toEqual(["cell1", "cell2", "cell3"]);
        });

        it("puts all cells in explored when all are visited", () => {
            const { result } = withSetup(useTrailMap);
            result.visitedCells.value = new Set(["cell1", "cell2", "cell3"]);

            result.updateVisibleCells(makeBounds());

            expect(result.visibleExplored.value).toEqual(["cell1", "cell2", "cell3"]);
            expect(result.visibleFog.value).toEqual([]);
        });

        it("also updates visibleCells with the full set", () => {
            const { result } = withSetup(useTrailMap);

            result.updateVisibleCells(makeBounds());

            expect(result.visibleCells.value).toEqual(["cell1", "cell2", "cell3"]);
        });
    });

    // ── fetchCellTypes ─────────────────────────────────────────────────────────

    describe("fetchCellTypes", () => {
        it("does not call the service when visibleExplored is empty", async () => {
            const { result } = withSetup(useTrailMap);
            result.visibleExplored.value = [];

            await result.fetchCellTypes();

            expect(fetchCellTypes).not.toHaveBeenCalled();
        });

        it("skips cells already in cellTypes", async () => {
            const { result } = withSetup(useTrailMap);
            result.visibleExplored.value = ["cell1", "cell2"];
            result.cellTypes.value.set("cell1", "peak");

            await result.fetchCellTypes();

            expect(fetchCellTypes).toHaveBeenCalledWith(["cell2"], expect.any(AbortSignal));
        });

        it("uses the cache and skips the API for cached cells", async () => {
            vi.mocked(getCellTypeFromCache)
                .mockReturnValueOnce("peak") // cell1 → cached
                .mockReturnValueOnce(null); // cell2 → not cached
            const { result } = withSetup(useTrailMap);
            result.visibleExplored.value = ["cell1", "cell2"];

            await result.fetchCellTypes();

            expect(result.cellTypes.value.get("cell1")).toBe("peak");
            expect(fetchCellTypes).toHaveBeenCalledWith(["cell2"], expect.any(AbortSignal));
        });

        it("does not call the service when all cells are cached", async () => {
            vi.mocked(getCellTypeFromCache).mockReturnValue("peak");
            const { result } = withSetup(useTrailMap);
            result.visibleExplored.value = ["cell1", "cell2"];

            await result.fetchCellTypes();

            expect(fetchCellTypes).not.toHaveBeenCalled();
        });

        it('merges API results into cellTypes, ignoring "none"', async () => {
            vi.mocked(fetchCellTypes).mockResolvedValue(
                new Map([
                    ["cell1", "peak"],
                    ["cell2", "none"],
                ]),
            );
            const { result } = withSetup(useTrailMap);
            result.visibleExplored.value = ["cell1", "cell2"];

            await result.fetchCellTypes();

            expect(result.cellTypes.value.get("cell1")).toBe("peak");
            expect(result.cellTypes.value.has("cell2")).toBe(false);
        });

        it("aborts the previous request when called again", async () => {
            vi.mocked(fetchCellTypes).mockResolvedValue(new Map());
            const { result } = withSetup(useTrailMap);
            result.visibleExplored.value = ["cell1"];

            await result.fetchCellTypes();
            const firstSignal = vi.mocked(fetchCellTypes).mock.calls[0][1] as AbortSignal;

            result.visibleExplored.value = ["cell2"];
            await result.fetchCellTypes();

            expect(firstSignal.aborted).toBe(true);
        });
    });

    // ── debouncedUpdate ────────────────────────────────────────────────────────

    describe("debouncedUpdate", () => {
        it("does not call updateVisibleCells immediately", () => {
            vi.useFakeTimers();
            const { result } = withSetup(useTrailMap);
            const spy = vi.spyOn(result, "updateVisibleCells");

            result.debouncedUpdate(makeBounds());

            expect(spy).not.toHaveBeenCalled();
        });

        it("calls updateVisibleCells after the debounce delay", async () => {
            vi.useFakeTimers();
            vi.mocked(fetchCellTypes).mockResolvedValue(new Map());
            const { result } = withSetup(useTrailMap);

            result.debouncedUpdate(makeBounds());

            // Should be empty immediately
            expect(result.visibleCells.value).toEqual([]);

            await vi.runAllTimersAsync();

            // State should update after the debounce completes
            expect(result.visibleCells.value).toEqual(["cell1", "cell2", "cell3"]);
        });

        it("resets the timer on repeated calls (trailing edge only)", async () => {
            vi.useFakeTimers();
            vi.mocked(fetchCellTypes).mockResolvedValue(new Map());
            const { result } = withSetup(useTrailMap);

            // 1. Manually populate visitedCells so there is work for the API to do
            // (Matching the cells returned by your h3 mock)
            result.visitedCells.value = new Set(["cell1", "cell2", "cell3"]);

            result.debouncedUpdate(makeBounds());
            vi.advanceTimersByTime(200);
            result.debouncedUpdate(makeBounds());
            vi.advanceTimersByTime(200);
            result.debouncedUpdate(makeBounds());

            await vi.runAllTimersAsync();

            // Now the internal logic will find explored cells and call the service
            expect(fetchCellTypes).toHaveBeenCalledOnce();
        });

        it("calls the optional onDone callback after completion", async () => {
            vi.useFakeTimers();
            vi.mocked(fetchCellTypes).mockResolvedValue(new Map());
            const { result } = withSetup(useTrailMap);
            const onDone = vi.fn();

            result.debouncedUpdate(makeBounds(), onDone);
            await vi.runAllTimersAsync();

            expect(onDone).toHaveBeenCalledOnce();
        });
    });

    // ── cleanup ────────────────────────────────────────────────────────────────

    describe("cleanup on unmount", () => {
        it("clears the debounce timer so updateVisibleCells never fires", async () => {
            vi.useFakeTimers();
            const { result, unmount } = withSetup(useTrailMap);
            const spy = vi.spyOn(result, "updateVisibleCells");

            result.debouncedUpdate(makeBounds());
            unmount();
            await vi.runAllTimersAsync();

            expect(spy).not.toHaveBeenCalled();
        });
    });
});
