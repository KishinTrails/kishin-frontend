import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("./authService", () => ({
    getToken: vi.fn(),
    handleUnauthorized: vi.fn(),
}));

import { getToken } from "./authService";
import { completeTraining, fetchCandidates, fetchPlan, PlanApiError, uncompleteTraining } from "./planService";

const mockGetToken = getToken as ReturnType<typeof vi.fn>;
const BASE = `${import.meta.env.VITE_API_BASE}/plan`;

describe("planService", () => {
    let mockFetch: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
        vi.stubGlobal("fetch", mockFetch);
        mockGetToken.mockReturnValue("mock-token");
    });

    it("fetches the plan with the token", async () => {
        await fetchPlan();
        expect(mockFetch).toHaveBeenCalledWith(BASE, {
            method: "GET",
            headers: { Authorization: "Bearer mock-token" },
            body: undefined,
        });
    });

    it("fetches candidates", async () => {
        await fetchCandidates(7);
        expect(mockFetch.mock.calls[0][0]).toBe(`${BASE}/trainings/7/candidates`);
    });

    it("posts a run completion and a tick", async () => {
        await completeTraining(7, { activity_id: "1001", rpe: 4 });
        await completeTraining(8);
        expect(mockFetch.mock.calls[0]).toEqual([
            `${BASE}/trainings/7/complete`,
            {
                method: "POST",
                headers: { Authorization: "Bearer mock-token", "Content-Type": "application/json" },
                body: JSON.stringify({ activity_id: "1001", rpe: 4 }),
            },
        ]);
        expect(mockFetch.mock.calls[1][1].body).toBe("{}");
    });

    it("deletes a completion and accepts 204", async () => {
        mockFetch.mockResolvedValueOnce({ ok: true, status: 204, json: async () => { throw new Error("no body"); } });
        await expect(uncompleteTraining(7)).resolves.toBeUndefined();
        expect(mockFetch.mock.calls[0][1].method).toBe("DELETE");
    });

    it("throws the server's detail", async () => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ detail: "Too short." }) });
        const error = await completeTraining(7, { activity_id: "1001", rpe: 4 }).catch((caught) => caught);
        expect(error).toBeInstanceOf(PlanApiError);
        expect(error.status).toBe(422);
        expect(error.detail).toBe("Too short.");
    });

    it("throws a generic detail when the body has none", async () => {
        mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => { throw new Error("html"); } });
        const error = await fetchPlan().catch((caught) => caught);
        expect(error.detail).toBe("Request failed: 500");
    });
});
