import { getToken } from "./authService";

interface ExploredTilesResponse {
  explored: string[];
}

const API_BASE = "/trails";

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