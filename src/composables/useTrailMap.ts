/**
 * Composable for managing trail map state, visibility, and data fetching.
 * Handles explored cells tracking, POI type fetching, and viewport-based cell filtering.
 */

import { ref, onUnmounted } from "vue";
import { cellsFromBounds, cellToToken, isCellInBounds } from "@/utils/s2Utils";
import { fetchCellTypes as fetchCellTypesFromService, fetchCellType as fetchCellTypeFromService } from "@/services/poiService";
import { getCellTypeFromCache, isPrefetchDone } from "@/services/cacheService";
import { fetchExploredTiles } from "@/services/trailsService";

/**
 * Valid POI cell type categories displayed on the map.
 */
export type CellTypeKey = "peak" | "natural" | "industrial";

/**
 * Interface for map viewport bounds.
 * Abstracts map library specifics from the composable.
 */
export interface MapBounds {
    getSouthWest: () => { lat: number; lng: number };
    getNorthEast: () => { lat: number; lng: number };
}

const DEBOUNCE_DELAY = 500;

/**
 * Manages trail map state including explored cells, visible cells, and POI data.
 * Provides debounced updates for map move/zoom events and integrates with
 * the trails, poi, and cache services.
 *
 * @returns Reactive state and actions for trail map management
 */
export function useTrailMap() {
    const visitedCells = ref<Set<string>>(new Set());
    const visibleCells = ref<string[]>([]);
    const visibleExplored = ref<string[]>([]);
    const visibleFog = ref<string[]>([]);
    const cellTypes = ref<Map<string, CellTypeKey>>(new Map());
    const filterByExplored = ref(true);

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
     * Compute visible cells from the current viewport bounds.
     *
     * Always populates visibleExplored with explored cells within the viewport.
     *
     * When enumerate is true, also populates visibleCells with every level-16
     * S2 cell covering the viewport via RegionCoverer. This is expensive at low
     * zoom levels and should only be requested when a consumer actually needs it
     * (e.g. POI in non-explore mode, tile select overlay). Pass enumerate=false
     * (the default) whenever those features are inactive to avoid the cost.
     *
     * @param bounds   - Current map viewport bounds.
     * @param enumerate - Whether to run cellsFromBounds for full viewport coverage.
     */
    const updateVisibleCells = (bounds: MapBounds, enumerate = false): void => {
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();

        visibleExplored.value = Array.from(visitedCells.value).filter(cell =>
            isCellInBounds(cell, sw, ne)
        );

        visibleCells.value = enumerate
            ? cellsFromBounds(sw, ne).map(cellToToken)
            : [];

        visibleFog.value = [];
    };

    /**
     * Debounced version of updateVisibleCells + fetchCellTypes.
     * Designed to be called on map move/zoom events.
     *
     * @param bounds    - Current map viewport bounds.
     * @param enumerate - Whether to run cellsFromBounds (see updateVisibleCells).
     * @param onDone    - Optional callback fired after the update completes.
     */
    const debouncedUpdate = (bounds: MapBounds, enumerate = false, onDone?: () => void): void => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            updateVisibleCells(bounds, enumerate);
            await fetchCellTypes();
            onDone?.();
        }, DEBOUNCE_DELAY);
    };

    /**
     * Fetch POI types for cells currently visible on the map.
     * In explore mode, resolves types for visibleExplored (explored cells in viewport).
     * In full-viewport mode, resolves types for visibleCells (all cells in viewport).
     *
     * Uses the local cache first. When the prefetch has been completed, cache
     * misses are treated as "none" and no API call is made.
     * Aborts any in-flight request before issuing a new one.
     */
    const fetchCellTypes = async (): Promise<void> => {
        abortController?.abort();
        abortController = new AbortController();

        const prefetchDone = isPrefetchDone();
        const cells = filterByExplored.value ? visibleExplored.value : visibleCells.value;
        const cellsToFetch: string[] = [];

        for (const cell of cells) {
            if (cellTypes.value.has(cell)) continue;

            const cached = getCellTypeFromCache(cell);
            if (cached !== null && cached !== "none") {
                cellTypes.value.set(cell, cached as CellTypeKey);
            } else if (cached === null && !prefetchDone) {
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

    /**
     * Fetch the POI type for a single newly explored cell, bypassing the
     * prefetch-done guard. Used when the user explores a new cell in the
     * current session that may not yet be in the prefetch cache.
     *
     * @param cell - The S2 cell token that was just explored
     */
    const fetchCellTypeForNewExplored = async (cell: string): Promise<void> => {
        const result = await fetchCellTypeFromService(cell);
        if (result.type && result.type !== "none") {
            cellTypes.value.set(cell, result.type as CellTypeKey);
        }
    };

    return {
        // State
        visitedCells,
        visibleCells,
        visibleExplored,
        visibleFog,
        cellTypes,
        filterByExplored,

        // Actions
        loadExploredTiles,
        updateVisibleCells,
        debouncedUpdate,
        fetchCellTypes,
        fetchCellTypeForNewExplored,
    };
}
