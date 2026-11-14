import { describe, it, expect } from "vitest";
import { weeklyTotals } from "./weeklyTotals";

const day = (date: string, distance_km: number, moving_sec: number) => ({
    date, count: 1, distance_km, moving_sec, elapsed_sec: moving_sec, ascent_m: 0,
});

describe("weeklyTotals", () => {
    it("adds days into Monday weeks and keeps empty weeks", () => {
        const totals = weeklyTotals(
            [day("2026-03-02", 5, 1800), day("2026-03-04", 10, 3600), day("2026-02-20", 8, 2400)],
            "2026-03-04",
            3,
        );
        expect(totals.map((total) => total.week)).toEqual(["2026-02-16", "2026-02-23", "2026-03-02"]);
        expect(totals.map((total) => total.distance_km)).toEqual([8, 0, 15]);
        expect(totals[2]).toEqual({ week: "2026-03-02", count: 2, distance_km: 15, moving_sec: 5400 });
    });

    it("ignores days before the first week", () => {
        const totals = weeklyTotals([day("2025-01-06", 5, 1800)], "2026-03-04", 2);
        expect(totals.every((total) => total.count === 0)).toBe(true);
    });

    it("has 52 weeks by default", () => {
        expect(weeklyTotals([], "2026-03-04")).toHaveLength(52);
    });
});
