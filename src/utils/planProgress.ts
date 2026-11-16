/**
 * planProgress.ts — Figures of a plan's progression computed from the `/plan` response: the
 * done/planned counts overall and per training type, the weekly series of the chart (distance,
 * moving time, longest run), the labels of the training types, the words of the RPE scale, a
 * week's date range and what is left to do in the current week. Plain functions, testable without a DOM.
 * Does not own: fetching the plan or recording completions (see `services/planService.ts`).
 */

import type { PlanProgress, PlanTraining, PlanWeek, WeekRunning } from "@/services/planService";
import { addDays, longDate } from "@/utils/activityGrid";

/**
 * A plan phase as a reader reads it.
 *
 * @param phase - For example `BASE`
 * @returns For example `Base`
 */
export const phaseLabel = (phase: string): string => phase.charAt(0) + phase.slice(1).toLowerCase();

/**
 * The word for a rating of perceived exertion.
 *
 * @param rpe - 1 to 10
 * @returns 1–2 very easy, 3–4 easy, 5–6 moderate, 7–8 hard, 9 very hard, 10 max
 */
export function rpeWord(rpe: number): string {
    if (rpe <= 2) return "very easy";
    if (rpe <= 4) return "easy";
    if (rpe <= 6) return "moderate";
    if (rpe <= 8) return "hard";
    if (rpe === 9) return "very hard";
    return "max";
}

/**
 * The days of a week, as short as the dates allow.
 *
 * @param start - ISO day of the Monday
 * @param end - ISO day of the Sunday
 * @returns `3–9 Nov`, `27 Oct – 2 Nov`, or `29 Dec 2025 – 4 Jan 2026` across a new year
 */
export function weekRange(start: string, end: string): string {
    const [, startDay, startMonth, startYear] = longDate(start).split(" ");
    const [, endDay, endMonth, endYear] = longDate(end).split(" ");
    if (startYear !== endYear) return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
    if (startMonth !== endMonth) return `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
    return `${startDay}–${endDay} ${endMonth}`;
}

/** What is left of a week on a given day. */
export interface WeekLeft {
    /** Days from that day to the Sunday, both included. */
    days: number;
    /** The trainings not done yet. */
    trainings: PlanTraining[];
}

/**
 * What is left to do in a week on a given day.
 *
 * @param week - The week
 * @param today - ISO day
 * @returns The days left and the trainings not done, or null when the day is not in the week
 */
export function weekLeft(week: PlanWeek, today: string): WeekLeft | null {
    if (today < week.start || today > week.end) return null;
    let days = 0;
    while (addDays(today, days) <= week.end) days += 1;
    return { days, trainings: week.trainings.filter((training) => training.completion === null) };
}

/** Display names of the training types. */
export const TRAINING_LABELS: Record<string, string> = {
    EXPLORATORY_LONG_RUN: "Long run",
    FUNDAMENTAL_RUN: "30-minute run",
    CROSS_TRAINING: "Cross-training",
    LEG_DAY: "Leg day",
    YOGA: "Yoga",
};

/**
 * The display name of a training type.
 *
 * @param type - A `TrainingType` value
 * @returns Its label, or the value itself when unknown
 */
export const trainingLabel = (type: string): string => TRAINING_LABELS[type] ?? type;

/** Done and planned counts of one group of trainings. */
export interface Count {
    label: string;
    done: number;
    planned: number;
}

/**
 * Done/planned counts overall and per training type, in the order of `TRAINING_LABELS`.
 *
 * @param plan - The progression
 * @param upToWeek - Only count weeks up to this one (for example the current week); all weeks when omitted
 * @returns The overall count first, then one per type present in the plan
 */
export function completionCounts(plan: PlanProgress, upToWeek?: number): Count[] {
    const trainings = plan.weeks
        .filter((week) => upToWeek === undefined || week.week_number <= upToWeek)
        .flatMap((week) => week.trainings);
    const count = (label: string, list: PlanTraining[]): Count => ({
        label,
        done: list.filter((training) => training.completion !== null).length,
        planned: list.length,
    });
    const perType = Object.keys(TRAINING_LABELS)
        .map((type) => count(trainingLabel(type), trainings.filter((training) => training.type === type)))
        .filter((group) => group.planned > 0);
    return [count("All trainings", trainings), ...perType];
}

/**
 * The planned long-run distance of a week.
 *
 * @param week - The week
 * @returns The target in km, or null when the week has no long run with a distance
 */
export function longRunTarget(week: PlanWeek): number | null {
    return week.trainings.find((training) => training.type === "EXPLORATORY_LONG_RUN")?.target_distance_km ?? null;
}

/** What the chart shows: weekly distance, weekly moving time, or the longest run of each week. */
export type WeeklyMetric = "distance" | "time" | "longest";

/** One chart: the planned value and the Garmin value of each week. */
export interface WeeklySeries {
    planned: (number | null)[];
    recorded: (number | null)[];
}

/**
 * Sum of a target over a week's runs.
 *
 * @param week - The week
 * @param target - The target read from each run
 * @returns The sum, or null when no run of the week has that kind of target
 */
const plannedSum = (week: PlanWeek, target: (training: PlanTraining) => number | null): number | null => {
    const values = week.trainings
        .filter((training) => !training.is_tick)
        .map(target)
        .filter((value): value is number => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
};

/**
 * The chart's series, one entry per week, for each metric.
 *
 * Planned distance is the sum of the distance targets of the week's runs, and planned time the
 * sum of their duration targets: a run with only a distance target counts in the distance only.
 * Distances are in km, times in hours.
 *
 * @param plan - The progression
 * @param currentWeek - Weeks after this one have no recorded value yet
 * @returns Week numbers and the planned and recorded values per metric
 */
export function weeklySeries(plan: PlanProgress, currentWeek: number): {
    weeks: number[];
    series: Record<WeeklyMetric, WeeklySeries>;
} {
    const recorded = (value: (running: WeekRunning) => number | null): (number | null)[] =>
        plan.weeks.map((week) =>
            week.week_number > currentWeek || week.running === null ? null : value(week.running),
        );
    return {
        weeks: plan.weeks.map((week) => week.week_number),
        series: {
            distance: {
                planned: plan.weeks.map((week) => plannedSum(week, (training) => training.target_distance_km)),
                recorded: recorded((running) => running.run_km),
            },
            time: {
                planned: plan.weeks.map((week) => {
                    const seconds = plannedSum(week, (training) => training.target_duration_sec);
                    return seconds === null ? null : seconds / 3600;
                }),
                recorded: recorded((running) => running.run_moving_sec / 3600),
            },
            longest: {
                planned: plan.weeks.map(longRunTarget),
                recorded: recorded((running) => running.longest_run_km ?? 0),
            },
        },
    };
}
