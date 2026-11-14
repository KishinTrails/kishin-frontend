import { describe, it, expect } from "vitest";
import { formatDateTime, formatDuration, formatKm, formatPace, formatValue, paceFromSpeed } from "./athleteFormat";

describe("athleteFormat", () => {
    it("formats durations", () => {
        expect(formatDuration(0)).toBe("0:00");
        expect(formatDuration(65)).toBe("1:05");
        expect(formatDuration(3725)).toBe("1:02:05");
        expect(formatDuration(null)).toBe("–");
    });

    it("formats paces", () => {
        expect(formatPace(310)).toBe("5:10 /km");
        expect(formatPace(0)).toBe("–");
        expect(formatPace(null)).toBe("–");
        expect(paceFromSpeed(12)).toBe(300);
        expect(paceFromSpeed(0)).toBeNull();
    });

    it("formats distances and values", () => {
        expect(formatKm(12.345)).toBe("12.35 km");
        expect(formatKm(null)).toBe("–");
        expect(formatValue(140, "bpm")).toBe("140 bpm");
        expect(formatValue(2.46, "", 1)).toBe("2.5");
        expect(formatValue(undefined, "bpm")).toBe("–");
    });

    it("formats Garmin local times as written", () => {
        expect(formatDateTime("2026-03-03T07:05:42")).toBe("Tue 3 Mar 2026, 07:05");
        expect(formatDateTime("2026-03-03")).toBe("Tue 3 Mar 2026");
        expect(formatDateTime(null)).toBe("–");
    });
});
