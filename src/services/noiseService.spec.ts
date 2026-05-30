import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchNoiseForCells, clearNoiseCache } from "./noiseService";

vi.mock("./authService", () => ({
    getToken: vi.fn(),
}));

import { getToken } from "./authService";

const mockGetToken = getToken as ReturnType<typeof vi.fn>;

describe("noiseService", () => {
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        clearNoiseCache();
        mockFetch = vi.fn();
        vi.stubGlobal("fetch", mockFetch);
    });

    describe("fetchNoiseForCells", () => {
        it("should return noise map on successful response", async () => {
            mockGetToken.mockReturnValue("mock-token");
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => [
                    { cell: "cell1", noise: 0.85 },
                    { cell: "cell2", noise: 0.42 },
                ],
            });

            const result = await fetchNoiseForCells(["cell1", "cell2"], 50);

            expect(result.get("cell1")).toBe(0.85);
            expect(result.get("cell2")).toBe(0.42);
        });

        it("should return empty map when cells array is empty", async () => {
            mockGetToken.mockReturnValue("mock-token");

            const result = await fetchNoiseForCells([], 50);

            expect(result.size).toBe(0);
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it("should include Authorization header when token exists", async () => {
            mockGetToken.mockReturnValue("my-token-123");
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => [],
            });

            await fetchNoiseForCells(["cell1"], 50);

            const fetchCall = mockFetch.mock.calls[0];
            const options = fetchCall[1] as { headers: Record<string, string> };
            expect(options?.headers?.["Authorization"]).toBe("Bearer my-token-123");
        });

        it("should not include Authorization header when no token", async () => {
            mockGetToken.mockReturnValue(null);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => [],
            });

            await fetchNoiseForCells(["cell1"], 50);

            const fetchCall = mockFetch.mock.calls[0];
            const options = fetchCall[1] as { headers: Record<string, string> };
            expect(options?.headers?.["Authorization"]).toBeUndefined();
        });

        it("should send correct body with default octaves and amplitudeDecay", async () => {
            mockGetToken.mockReturnValue("token");
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => [],
            });

            await fetchNoiseForCells(["cell1"], 50);

            const fetchCall = mockFetch.mock.calls[0];
            const body = JSON.parse((fetchCall[1] as { body: string }).body);
            expect(body).toEqual({
                cells: ["cell1"],
                scale: 50,
                octaves: 3,
                amplitudeDecay: 0.5,
            });
        });

        it("should send custom octaves and amplitudeDecay", async () => {
            mockGetToken.mockReturnValue("token");
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => [],
            });

            await fetchNoiseForCells(["cell1"], 100, 5, 0.7);

            const fetchCall = mockFetch.mock.calls[0];
            const body = JSON.parse((fetchCall[1] as { body: string }).body);
            expect(body.octaves).toBe(5);
            expect(body.amplitudeDecay).toBe(0.7);
        });

        it("should call correct API endpoint", async () => {
            mockGetToken.mockReturnValue("token");
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => [],
            });

            await fetchNoiseForCells(["cell1"], 50);

            const fetchCall = mockFetch.mock.calls[0];
            const url = fetchCall[0] as string;
            expect(url).toContain("/noise/cells");
        });

        it("should include Content-Type header", async () => {
            mockGetToken.mockReturnValue("token");
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => [],
            });

            await fetchNoiseForCells(["cell1"], 50);

            const fetchCall = mockFetch.mock.calls[0];
            const options = fetchCall[1] as { headers: Record<string, string> };
            expect(options?.headers?.["Content-Type"]).toBe("application/json");
        });

        it("should handle non-OK responses without throwing", async () => {
            mockGetToken.mockReturnValue("token");
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
            });

            const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
            const result = await fetchNoiseForCells(["cell1"], 50);

            expect(result.size).toBe(0);
            expect(consoleWarnSpy).toHaveBeenCalled();
            consoleWarnSpy.mockRestore();
        });

        it("should respect AbortSignal", async () => {
            mockGetToken.mockReturnValue("token");
            mockFetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => [],
            });
            mockFetch.mockImplementation((_url: string, options?: RequestInit) => {
                if (options?.signal?.aborted) {
                    return Promise.reject(new DOMException("The user aborted a request.", "AbortError"));
                }
                return Promise.resolve({ ok: true, status: 200, json: async () => [] });
            });

            const abortController = new AbortController();
            abortController.abort();

            await expect(fetchNoiseForCells(["cell1"], 50, 3, 0.5, abortController.signal)).rejects.toThrow(
                "The user aborted a request.",
            );
        });
    });
});

