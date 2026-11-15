import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("./authService", () => ({
    getToken: vi.fn(),
    handleUnauthorized: vi.fn(),
}));

import { getToken, handleUnauthorized } from "./authService";
import {
    AthleteApiError,
    fetchActivities,
    fetchActivity,
    fetchDailyActivities,
    fetchMeasures,
    fetchRecords,
    fetchTrack,
} from "./athleteService";

const mockGetToken = getToken as ReturnType<typeof vi.fn>;
const BASE = `${import.meta.env.VITE_API_BASE}/athlete`;

describe("athleteService", () => {
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
        vi.stubGlobal("fetch", mockFetch);
        mockGetToken.mockReturnValue("mock-token");
    });

    it("sends the token", async () => {
        await fetchActivities();
        expect(mockFetch).toHaveBeenCalledWith(`${BASE}/activities`, {
            headers: { Authorization: "Bearer mock-token" },
        });
    });

    it("sends no Authorization header without a token", async () => {
        mockGetToken.mockReturnValue(null);
        await fetchActivities();
        expect(mockFetch.mock.calls[0][1]).toEqual({ headers: {} });
    });

    it("puts the given filters in the query and leaves out the others", async () => {
        await fetchActivities({ sport: "running", limit: 20, offset: 40 });
        expect(mockFetch.mock.calls[0][0]).toBe(`${BASE}/activities?sport=running&limit=20&offset=40`);
    });

    it("calls the daily and measures routes with a date range", async () => {
        await fetchDailyActivities("2026-01-01", "2026-01-31");
        await fetchMeasures(undefined, "2026-01-31");
        expect(mockFetch.mock.calls[0][0]).toBe(`${BASE}/activities/daily?start=2026-01-01&end=2026-01-31`);
        expect(mockFetch.mock.calls[1][0]).toBe(`${BASE}/measures?end=2026-01-31`);
    });

    it("calls the routes of one activity", async () => {
        await fetchActivity("1001");
        await fetchTrack("1001");
        await fetchRecords("1001");
        expect(mockFetch.mock.calls.map((call) => call[0])).toEqual([
            `${BASE}/activities/1001`,
            `${BASE}/activities/1001/track`,
            `${BASE}/activities/1001/records`,
        ]);
    });

    it("returns the decoded body", async () => {
        mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ activity_id: "1001" }) });
        expect(await fetchActivity("1001")).toEqual({ activity_id: "1001" });
    });

    it("throws an AthleteApiError with the status", async () => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
        const error = await fetchMeasures().catch((caught) => caught);
        expect(error).toBeInstanceOf(AthleteApiError);
        expect(error.status).toBe(503);
    });

    it("hands every response to handleUnauthorized", async () => {
        const refused = { ok: false, status: 401, json: async () => ({}) };
        mockFetch.mockResolvedValueOnce(refused);
        await expect(fetchActivities()).rejects.toThrow(AthleteApiError);
        expect(handleUnauthorized).toHaveBeenCalledWith(refused);
    });
});
