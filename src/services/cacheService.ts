/**
 * Local cache service for S2 cell types.
 * Stores cell type data in localStorage to reduce API calls.
 */

import { CellType } from "./poiService";

const CACHE_KEY = "kishin_cell_cache";

let cacheMap: Map<string, CellType> | null = null;

/**
 * Ensures the in-memory cache map is initialized.
 * Loads from localStorage if not yet loaded.
 * 
 * @returns The in-memory cache map.
 */
function ensureCache(): Map<string, CellType> {
    if (cacheMap === null) {
        const cacheJson = localStorage.getItem(CACHE_KEY);
        if (cacheJson) {
            const cache: Record<string, CellType> = JSON.parse(cacheJson);
            cacheMap = new Map(Object.entries(cache));
        } else {
            cacheMap = new Map();
        }
    }
    return cacheMap;
}

/**
 * Retrieve the cell type for a given S2 cell from the cache.
 * 
 * @param cell - The S2 cell token
 * @returns The cached cell type, or null if not found
 */
export function getCellTypeFromCache(cell: string): CellType | null {
    const cache = ensureCache();
    return cache.get(cell) ?? null;
}

/**
 * Store a cell type in the in-memory cache.
 * Note: Does not persist to localStorage until syncCacheToDisk is called.
 * 
 * @param cell - The S2 cell token
 * @param type - The cell type to cache
 */
export function setCellTypeInCache(cell: string, type: CellType): void {
    const cache = ensureCache();
    cache.set(cell, type);
}

/**
 * Persist the in-memory cache to localStorage.
 * Called after batch operations to save cached data.
 */
export function syncCacheToDisk(): void {
    try {
        const cache = ensureCache();
        localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(cache)));
    } catch {
        // localStorage might be full or unavailable
    }
}