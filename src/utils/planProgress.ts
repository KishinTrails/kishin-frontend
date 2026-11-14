/**
 * planProgress.ts — Figures of a plan's progression computed from the `/plan` response: the
 * done/planned counts overall and per training type, the long-run series for the chart, and
 * the labels of the training types. Plain functions, testable without a DOM.
 * Does not own: fetching the plan or recording completions (see `services/planService.ts`).
 */

import type { PlanProgress, PlanTraining, PlanWeek } from "@/services/planService";

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

/**
 * The long-run chart's series: one entry per week.
 *
 * @param plan - The progression
 * @param currentWeek - Weeks after this one have no recorded value yet
 * @returns Week numbers, planned targets and the longest Garmin run of each week
 */
export function longRunSeries(plan: PlanProgress, currentWeek: number): {
    weeks: number[];
    planned: (number | null)[];
    longest: (number | null)[];
} {
    return {
        weeks: plan.weeks.map((week) => week.week_number),
        planned: plan.weeks.map(longRunTarget),
        longest: plan.weeks.map((week) =>
            week.week_number > currentWeek || week.running === null ? null : (week.running.longest_run_km ?? 0),
        ),
    };
}
