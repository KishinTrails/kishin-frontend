import { describe, it, expect } from "vitest";
import type { PlanProgress, PlanTraining, PlanWeek } from "@/services/planService";
import {
    completionCounts, longRunTarget, rpeWord, trainingLabel, weekLeft, weeklySeries, weekRange,
} from "./planProgress";

let nextId = 1;

const training = (
    type: string, done: boolean, target_distance_km: number | null = null, target_duration_sec: number | null = null,
): PlanTraining => ({
    id: nextId++, position: 1, type, is_tick: !type.endsWith("RUN"), target_distance_km, target_duration_sec,
    segments: [], completion: done ? { completed_at: "2026-01-05T18:00:00", rpe: null, activity: null } : null,
});

const week = (week_number: number, longRunKm: number, done: boolean[], running: PlanWeek["running"]): PlanWeek => ({
    week_number, phase: "BASE", start: "2026-01-05", end: "2026-01-11", running,
    trainings: [
        training("EXPLORATORY_LONG_RUN", done[0]!, longRunKm),
        training("FUNDAMENTAL_RUN", done[1]!, null, 1800),
        training("YOGA", done[2]!),
    ],
});

const plan: PlanProgress = {
    plan_id: 1, name: "Example Plan", goal_type: null, target_fat_ratio: null, target_muscle_mass_kg: null,
    start_date: "2026-01-05", current_week: 2, week_count: 3, health_available: true,
    weeks: [
        week(1, 10, [true, true, false], { run_count: 2, run_km: 16, run_moving_sec: 5400, longest_run_km: 11 }),
        week(2, 12, [false, true, true], { run_count: 0, run_km: 0, run_moving_sec: 0, longest_run_km: null }),
        week(3, 8, [false, false, false], { run_count: 0, run_km: 0, run_moving_sec: 0, longest_run_km: null }),
    ],
};

describe("planProgress", () => {
    it("labels training types", () => {
        expect(trainingLabel("LEG_DAY")).toBe("Leg day");
        expect(trainingLabel("OTHER")).toBe("OTHER");
    });

    it("counts done and planned trainings overall and per type", () => {
        expect(completionCounts(plan)).toEqual([
            { label: "All trainings", done: 4, planned: 9 },
            { label: "Long run", done: 1, planned: 3 },
            { label: "30-minute run", done: 2, planned: 3 },
            { label: "Yoga", done: 1, planned: 3 },
        ]);
        expect(completionCounts(plan, 1)[0]).toEqual({ label: "All trainings", done: 2, planned: 3 });
    });

    it("builds the weekly series up to the current week", () => {
        expect(longRunTarget(plan.weeks[0]!)).toBe(10);
        expect(weeklySeries(plan, 2)).toEqual({
            weeks: [1, 2, 3],
            series: {
                distance: { planned: [10, 12, 8], recorded: [16, 0, null] },
                time: { planned: [0.5, 0.5, 0.5], recorded: [1.5, 0, null] },
                longest: { planned: [10, 12, 8], recorded: [11, 0, null] },
            },
        });
    });

    it("leaves the recorded values empty without Garmin data", () => {
        const withoutHealth = { ...plan, weeks: plan.weeks.map((w) => ({ ...w, running: null })) };
        const { series } = weeklySeries(withoutHealth, 3);
        expect([series.distance.recorded, series.time.recorded, series.longest.recorded]).toEqual([
            [null, null, null], [null, null, null], [null, null, null],
        ]);
    });

    it("names each RPE value", () => {
        expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(rpeWord)).toEqual([
            "very easy", "very easy", "easy", "easy", "moderate", "moderate", "hard", "hard", "very hard", "max",
        ]);
    });

    it("writes a week's range as short as the dates allow", () => {
        expect(weekRange("2026-11-02", "2026-11-08")).toBe("2–8 Nov");
        expect(weekRange("2026-10-26", "2026-11-01")).toBe("26 Oct – 1 Nov");
        expect(weekRange("2025-12-29", "2026-01-04")).toBe("29 Dec 2025 – 4 Jan 2026");
    });

    it("says what is left of the week on a day of it", () => {
        const current = week(1, 12, [true, false, false], null);
        const left = weekLeft(current, "2026-01-09");
        expect(left?.days).toBe(3);
        expect(left?.trainings.map((t) => t.type)).toEqual(["FUNDAMENTAL_RUN", "YOGA"]);
        expect(weekLeft(current, "2026-01-11")?.days).toBe(1);
        expect(weekLeft(current, "2026-01-12")).toBeNull();
        expect(weekLeft(current, "2026-01-04")).toBeNull();
    });
});
