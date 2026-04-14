/**
 * Noise service for fetching Perlin noise values from the API.
 * Handles batch requests for H3 cells.
 */

import { getToken } from "./authService";

/**
 * Response from the /noise/cells endpoint.
 */
interface NoiseResponse {
    cell: string;
    noise: number;
}

const API_BASE = `${import.meta.env.VITE_API_BASE}/noise`;
const BATCH_SIZE = 500;

const noiseCache = new Map<string, number>();

function getCacheKey(cell: string, scale: number, octaves: number, amplitudeDecay: number): string {
    return `${cell}:${scale}:${octaves}:${amplitudeDecay}`;
}

/**
 * Fetch noise values for multiple H3 cells.
 * Returns a map of cell IDs to their noise values (0-1 range).
 *
 * @param cells - Array of H3 cell identifiers
 * @param scale - Noise scale parameter
 * @param octaves - Number of noise octaves
 * @param amplitudeDecay - Amplitude decay per octave
 * @param signal - Optional AbortSignal for cancellation
 * @returns Map of H3 cell IDs to their noise values
 */
export async function fetchNoiseForCells(
    cells: string[],
    scale: number,
    octaves: number = 3,
    amplitudeDecay: number = 0.5,
    signal?: AbortSignal,
): Promise<Map<string, number>> {
    if (cells.length === 0) {
        return new Map();
    }

    const token = getToken();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const resultMap = new Map<string, number>();
    const uncachedCells: string[] = [];

    for (const cell of cells) {
        const cacheKey = getCacheKey(cell, scale, octaves, amplitudeDecay);
        const cached = noiseCache.get(cacheKey);
        if (cached !== undefined) {
            resultMap.set(cell, cached);
        } else {
            uncachedCells.push(cell);
        }
    }

    if (uncachedCells.length === 0) {
        return resultMap;
    }

    for (let i = 0; i < uncachedCells.length; i += BATCH_SIZE) {
        const batch = uncachedCells.slice(i, i + BATCH_SIZE);
        const body = JSON.stringify({ cells: batch, scale, octaves, amplitudeDecay });

        try {
            const response = await fetch(`${API_BASE}/cells`, {
                method: "POST",
                headers,
                body,
                signal,
            });

            if (!response.ok) {
                console.warn(`[noiseService] Batch error: ${response.status}`);
                continue;
            }

            const data: NoiseResponse[] = await response.json();
            for (const item of data) {
                resultMap.set(item.cell, item.noise);
                noiseCache.set(getCacheKey(item.cell, scale, octaves, amplitudeDecay), item.noise);
            }
        } catch (err) {
            console.warn(`[noiseService] Batch error:`, err);
        }
    }

    return resultMap;
}
