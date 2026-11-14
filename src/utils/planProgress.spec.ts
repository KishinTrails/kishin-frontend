import { describe, it, expect } from "vitest";
import type { PlanProgress, PlanTraining, PlanWeek } from "@/services/planService";
import { completionCounts, longRunSeries, longRunTarget, trainingLabel } from "./planProgress";

let nextId = 1;

const training = (type: string, done: boolean, target_distance_km: number | null = null): PlanTraining => ({
    id: nextId++, position: 1, type, is_tick: !type.endsWith("RUN"), target_distance_km, target_duration_sec: null,
    segments: [], completion: done ? { completed_at: "2026-01-05T18:00:00", rpe: null, activity: null } : null,
});

const week = (week_number: number, longRunKm: number, done: boolean[], running: PlanWeek["running"]): PlanWeek => ({
    week_number, phase: "BASE", start: "2026-01-05", end: "2026-01-11", running,
    trainings: [
        training("EXPLORATORY_LONG_RUN", done[0]!, longRunKm),
        training("FUNDAMENTAL_RUN", done[1]!),
        training("YOGA", done[2]!),
    ],
});

const plan: PlanProgress = {
    plan_id: 1, name: "Example Plan", goal_type: null, target_fat_ratio: null, target_muscle_mass_kg: null,
    start_date: "2026-01-05", current_week: 2, week_count: 3, health_available: true,
    weeks: [
        week(1, 10, [true, true, false], { run_count: 2, run_km: 16, longest_run_km: 11 }),
        week(2, 12, [false, true, true], { run_count: 0, run_km: 0, longest_run_km: null }),
        week(3, 8, [false, false, false], { run_count: 0, run_km: 0, longest_run_km: null }),
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

    it("builds the long-run series up to the current week", () => {
        expect(longRunTarget(plan.weeks[0]!)).toBe(10);
        expect(longRunSeries(plan, 2)).toEqual({ weeks: [1, 2, 3], planned: [10, 12, 8], longest: [11, 0, null] });
    });

    it("leaves the longest run empty without Garmin data", () => {
        const withoutHealth = { ...plan, weeks: plan.weeks.map((w) => ({ ...w, running: null })) };
        expect(longRunSeries(withoutHealth, 3).longest).toEqual([null, null, null]);
    });
});
