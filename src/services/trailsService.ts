/**
 * Trails service for fetching user exploration data from the API.
 * Manages explored H3 cells associated with the authenticated user.
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
 * Fetch the list of H3 cells that the current user has explored.
 *
 * @returns Array of H3 cell identifiers that the user has explored
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
