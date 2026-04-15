import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchExploredTiles } from "./trailsService";

// Mock authService
vi.mock("./authService", () => ({
    getToken: vi.fn(),
}));

import { getToken } from "./authService";

const mockGetToken = getToken as ReturnType<typeof vi.fn>;

describe("trailsService", () => {
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockFetch = vi.fn();
        vi.stubGlobal("fetch", mockFetch);
    });

    describe("fetchExploredTiles", () => {
        it("should return array of cell IDs on successful response", async () => {
            mockGetToken.mockReturnValue("mock-token");
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    explored: ["cell1", "cell2", "cell3"],
                }),
            });

            const result = await fetchExploredTiles();

            expect(result).toEqual(["cell1", "cell2", "cell3"]);
        });

        it("should throw error when response is not ok", async () => {
            mockGetToken.mockReturnValue("mock-token");
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            await expect(fetchExploredTiles()).rejects.toThrow("Failed to fetch explored tiles: 500");
        });

        it("should include Authorization header when token exists", async () => {
            mockGetToken.mockReturnValue("my-token-123");
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ explored: [] }),
            });

            await fetchExploredTiles();

            const fetchCall = mockFetch.mock.calls[0];
            const options = fetchCall[1] as { headers: Record<string, string> };
            expect(options?.headers?.["Authorization"]).toBe("Bearer my-token-123");
        });

        it("should not include Authorization header when no token", async () => {
            mockGetToken.mockReturnValue(null);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ explored: [] }),
            });

            await fetchExploredTiles();

            const fetchCall = mockFetch.mock.calls[0];
            const options = fetchCall[1] as { headers: Record<string, string> };
            expect(options?.headers?.["Authorization"]).toBeUndefined();
        });

        it("should call correct API endpoint", async () => {
            mockGetToken.mockReturnValue("token");
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ explored: [] }),
            });

            await fetchExploredTiles();

            const fetchCall = mockFetch.mock.calls[0];
            const url = fetchCall[0] as string;
            expect(url).toContain("/trails/explored");
        });

        it("should include Content-Type header", async () => {
            mockGetToken.mockReturnValue("token");
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ explored: [] }),
            });

            await fetchExploredTiles();

            const fetchCall = mockFetch.mock.calls[0];
            const options = fetchCall[1] as { headers: Record<string, string> };
            expect(options?.headers?.["Content-Type"]).toBe("application/json");
        });

        it("should return empty array when no tiles explored", async () => {
            mockGetToken.mockReturnValue("token");
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ explored: [] }),
            });

            const result = await fetchExploredTiles();

            expect(result).toEqual([]);
        });
    });
});

