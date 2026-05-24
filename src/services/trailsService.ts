/**
 * Trails service for fetching user exploration data from the API.
 * Manages explored S2 cells associated with the authenticated user.
 */

import { getToken } from "./authService";

/**
 * Response from the /trails/explored endpoint.
 */
interface ExploredTilesResponse {
    explored: string[];
}

const API_BASE = `${import.meta.env.VITE_API_BASE}/trails`;

/**
 * Log a single S2 cell as explored for the authenticated user.
 *
 * @param cell - S2 cell token (e.g. '4f7e52163')
 */
export async function logExploredCell(cell: string): Promise<void> {
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/explored?cell=${encodeURIComponent(cell)}`, {
        method: "POST",
        headers,
    });
    if (!response.ok) {
        throw new Error(`Failed to log explored cell: ${response.status}`);
    }
}

/**
 * Fetch the list of S2 cells that the current user has explored.
 *
 * @returns Array of S2 cell tokens that the user has explored
 * @throws Error if the API request fails
 */
export async function fetchExploredTiles(): Promise<string[]> {
    const token = getToken();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/explored`, { headers });
    if (!response.ok) {
        throw new Error(`Failed to fetch explored tiles: ${response.status}`);
    }

    const data: ExploredTilesResponse = await response.json();
    return data.explored;
}
