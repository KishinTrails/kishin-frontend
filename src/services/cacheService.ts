import { CellType } from "./poiService";

const CACHE_KEY = "kishin_cell_cache";

let cacheMap: Map<string, CellType> | null = null;

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

export function getCellTypeFromCache(h3Cell: string): CellType | null {
    const cache = ensureCache();
    return cache.get(h3Cell) ?? null;
}

export function setCellTypeInCache(h3Cell: string, type: CellType): void {
    const cache = ensureCache();
    cache.set(h3Cell, type);
}

export function syncCacheToDisk(): void {
    try {
        const cache = ensureCache();
        localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(cache)));
    } catch {
        // localStorage might be full or unavailable
    }
}