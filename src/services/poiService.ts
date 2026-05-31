/**
 * POI (Point of Interest) service for fetching cell type data from the API.
 * Handles caching, batch requests, and localStorage persistence for S2 cells.
 */

import { getToken } from "./authService";
import { getCellTypeFromCache, setCellTypeInCache, syncCacheToDisk } from "./cacheService";

/**
 * Type of POI/feature in an S2 cell.
 * - "peak": Mountain peaks and elevated features
 * - "natural": Natural areas (parks, forests)
 * - "industrial": Industrial zones
 * - "none": No POI data for this cell
 */
export type CellType = "peak" | "natural" | "industrial" | "none";

/**
 * Response from the /poi/bycell endpoint.
 */
interface PoiByCellResponse {
    s2_cell_id: string;
    type: CellType;
    center: {
        lat: number;
        lng: number;
    };
    count: number;
    poi?: {
        id: number;
        name: string;
        geometry: string;
        elevation?: number;
    };
}

interface PoiByCellsResponse {
    cells: PoiByCellResponse[];
}

/**
 * Result from fetching a single cell's POI data.
 */
interface FetchResult {
    type: CellType | null;
    cacheHit: boolean;
}

const API_BASE = `${import.meta.env.VITE_API_BASE}/poi`;
const BATCH_SIZE = 100;

/**
 * Fetch cell types for multiple S2 cells in batch.
 * Uses local cache to avoid redundant API calls.
 *
 * @param cells - Array of S2 cell tokens
 * @param signal - Optional AbortSignal for cancellation
 * @returns Map of S2 cell tokens to their cell types
 */
export async function fetchCellTypes(cells: string[], signal?: AbortSignal): Promise<Map<string, CellType>> {
    const cellsToFetch = cells.filter((cell) => getCellTypeFromCache(cell) === null);

    if (cellsToFetch.length === 0) {
        return new Map();
    }

    const token = getToken();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const resultMap = new Map<string, CellType>();

    for (let i = 0; i < cellsToFetch.length; i += BATCH_SIZE) {
        const batch = cellsToFetch.slice(i, i + BATCH_SIZE);
        const params = new URLSearchParams();
        for (const cell of batch) {
            params.append("s2Cells", cell);
        }
        const url = `${API_BASE}/bycells?${params.toString()}`;

        try {
            const response = await fetch(url, { headers, signal });
            if (response.status === 204) {
                for (const cell of batch) {
                    setCellTypeInCache(cell, "none");
                }
                continue;
            }
            const data: PoiByCellsResponse = await response.json();
            const cellsWithData = new Set<string>();
            for (const cellData of data.cells) {
                const type = cellData.type;
                resultMap.set(cellData.s2_cell_id, type);
                setCellTypeInCache(cellData.s2_cell_id, type);
                cellsWithData.add(cellData.s2_cell_id);
            }
            for (const cell of batch) {
                if (!cellsWithData.has(cell)) {
                    setCellTypeInCache(cell, "none");
                }
            }
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
                throw err;
            }
            console.warn(`[poiService] Batch error:`, err);
        }
    }

    syncCacheToDisk();

    return resultMap;
}

/**
 * Fetch POI data for a single S2 cell.
 * Checks local cache first, then fetches from API if needed.
 *
 * @param cell - The S2 cell token
 * @param signal - Optional AbortSignal for cancellation
 * @returns FetchResult containing the cell type and whether it was a cache hit
 */
export async function fetchCellType(cell: string, signal?: AbortSignal): Promise<FetchResult> {
    const cached = getCellTypeFromCache(cell);
    if (cached !== null) {
        return { type: cached === "none" ? null : cached, cacheHit: true };
    }

    const token = getToken();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/bycell?s2Cell=${cell}`, { headers, signal });
    if (!response.ok) {
        return { type: null, cacheHit: false };
    }
    const data: PoiByCellResponse = await response.json();
    const type = data.type;
    setCellTypeInCache(cell, type);
    syncCacheToDisk();
    return { type, cacheHit: false };
}
