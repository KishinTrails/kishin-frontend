import { getToken } from "./authService";

type CellType = "peak" | "natural" | "industrial";

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

const API_BASE = "/poi";

export async function fetchCellType(h3Cell: string): Promise<CellType | null> {
    const token = getToken();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/bycell?h3Cell=${h3Cell}`, { headers });
    if (!response.ok) {
        throw new Error(`Failed to fetch POI for cell: ${h3Cell}`);
    }
    const data: PoiByCellResponse = await response.json();
    return data.type;
}
