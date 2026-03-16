type CellType = 'peak' | 'natural' | 'industrial';

const CACHE_KEY = 'kishin_cell_cache';

interface CacheData {
  [h3Cell: string]: CellType;
}

export function getCellTypeFromCache(h3Cell: string): CellType | null {
  try {
    const cacheJson = localStorage.getItem(CACHE_KEY);
    if (!cacheJson) return null;
    const cache: CacheData = JSON.parse(cacheJson);
    return cache[h3Cell] ?? null;
  } catch {
    return null;
  }
}

export function setCellTypeInCache(h3Cell: string, type: CellType): void {
  try {
    const cacheJson = localStorage.getItem(CACHE_KEY);
    const cache: CacheData = cacheJson ? JSON.parse(cacheJson) : {};
    cache[h3Cell] = type;
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage might be full or unavailable
  }
}
