import { getToken } from "./authService";
import { getCellTypeFromCache, setCellTypeInCache, syncCacheToDisk } from "./cacheService";

export type CellType = "peak" | "natural" | "industrial" | "none";

interface PoiByCellResponse {
    h3_cell: string;
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

interface FetchResult {
    type: CellType | null;
    cacheHit: boolean;
}

const API_BASE = "/poi";
const BATCH_SIZE = 100;

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
            params.append("h3Cells", cell);
        }
        const url = `${API_BASE}/bycells?${params.toString()}`;
        console.debug(
            `[poiService] Fetching batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} cells, URL length: ${url.length}`,
        );

        try {
            const response = await fetch(url, { headers, signal });
            if (response.status === 204) {
                for (const cell of batch) {
                    setCellTypeInCache(cell, "none");
                }
                continue;
            }
            const data = await response.json();
            const cellsWithData = new Set<string>();
            for (const cellData of data.cells) {
                const type = cellData.type as CellType;
                resultMap.set(cellData.h3_cell, type);
                setCellTypeInCache(cellData.h3_cell, type);
                cellsWithData.add(cellData.h3_cell);
            }
            for (const cell of batch) {
                if (!cellsWithData.has(cell)) {
                    setCellTypeInCache(cell, "none");
                }
            }
        } catch (err) {
            console.warn(`[poiService] Batch error:`, err);
        }
    }

    syncCacheToDisk();

    return resultMap;
}

export async function fetchCellType(h3Cell: string, signal?: AbortSignal): Promise<FetchResult> {
    const cached = getCellTypeFromCache(h3Cell);
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

    const response = await fetch(`${API_BASE}/bycell?h3Cell=${h3Cell}`, { headers, signal });
    if (!response.ok) {
        return { type: null, cacheHit: false };
        // throw new Error(`Failed to fetch POI for cell: ${h3Cell}`);
    }
    const data: PoiByCellResponse = await response.json();
    const type = data.type;
    setCellTypeInCache(h3Cell, type);
    syncCacheToDisk();
    return { type, cacheHit: false };
}
