import { ref, onUnmounted } from "vue";
import * as h3 from "h3-js";
import { fetchCellTypes as fetchCellTypesFromService } from "@/services/poiService";
import { getCellTypeFromCache } from "@/services/cacheService";
import { fetchExploredTiles } from "@/services/trailsService";
import type { Map as MaplibreMap } from "maplibre-gl";

export type CellTypeKey = "peak" | "natural" | "industrial";

export interface MapBounds {
    getSouthWest: () => { lat: number; lng: number };
    getNorthEast: () => { lat: number; lng: number };
}

const H3_RESOLUTION = 10;
const DEBOUNCE_DELAY = 500;

export function useTrailMap() {
    const visitedCells = ref<Set<string>>(new Set());
    const visibleCells = ref<string[]>([]);
    const visibleExplored = ref<string[]>([]);
    const visibleFog = ref<string[]>([]);
    const cellTypes = ref<Map<string, CellTypeKey>>(new Map());

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let abortController: AbortController | null = null;

    onUnmounted(() => {
        if (debounceTimer) clearTimeout(debounceTimer);
        abortController?.abort();
    });

    /**
     * Load the user's explored tiles from the API.
     */
    const loadExploredTiles = async (): Promise<void> => {
        try {
            const explored = await fetchExploredTiles();
            visitedCells.value = new Set(explored);
        } catch (err) {
            console.error("Failed to load explored tiles:", err);
        }
    };

    /**
     * Compute all H3 cells visible within the given map bounds.
     */
    const computeCellsFromBounds = (bounds: MapBounds): string[] => {
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();

        const polygon: [number, number][] = [
            [sw.lat, sw.lng],
            [ne.lat, sw.lng],
            [ne.lat, ne.lng],
            [sw.lat, ne.lng],
            [sw.lat, sw.lng],
        ];

        return h3.polygonToCells(polygon, H3_RESOLUTION);
    };

    /**
     * Split visible cells into explored and fog lists based on visitedCells.
     */
    const updateVisibleCells = (bounds: MapBounds): void => {
        const cells = computeCellsFromBounds(bounds);
        visibleCells.value = cells;

        const explored: string[] = [];
        const fog: string[] = [];

        for (const cell of cells) {
            if (visitedCells.value.has(cell)) {
                explored.push(cell);
            } else {
                fog.push(cell);
            }
        }

        visibleExplored.value = explored;
        visibleFog.value = fog;
    };

    /**
     * Debounced version of updateVisibleCells + fetchCellTypes.
     * Designed to be called on map move/zoom events.
     */
    const debouncedUpdate = (bounds: MapBounds, onDone?: () => void): void => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            updateVisibleCells(bounds);
            await fetchCellTypes();
            onDone?.();
        }, DEBOUNCE_DELAY);
    };

    /**
     * Fetch POI types for visible explored cells, using cache when available.
     * Aborts any in-flight request before issuing a new one.
     */
    const fetchCellTypes = async (): Promise<void> => {
        abortController?.abort();
        abortController = new AbortController();

        const cellsToFetch: string[] = [];

        for (const cell of visibleExplored.value) {
            if (cellTypes.value.has(cell)) continue;

            const cached = getCellTypeFromCache(cell);
            if (cached !== null && cached !== "none") {
                cellTypes.value.set(cell, cached as CellTypeKey);
            } else {
                cellsToFetch.push(cell);
            }
        }

        if (cellsToFetch.length === 0) return;

        const results = await fetchCellTypesFromService(cellsToFetch, abortController.signal);
        for (const [cell, type] of results) {
            if (type !== "none") {
                cellTypes.value.set(cell, type as CellTypeKey);
            }
        }
    };

    return {
        // State
        visitedCells,
        visibleCells,
        visibleExplored,
        visibleFog,
        cellTypes,

        // Actions
        loadExploredTiles,
        computeCellsFromBounds,
        updateVisibleCells,
        debouncedUpdate,
        fetchCellTypes,
    };
}
