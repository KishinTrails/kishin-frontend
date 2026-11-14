/**
 * weeklyTotals.ts — Adds up daily activity totals into Monday-to-Sunday weeks, for the weekly
 * distance and time charts. Plain functions, testable without a DOM.
 * Does not own: fetching the days (see `services/athleteService.ts`) or drawing the charts.
 */

import type { DailyActivities } from "@/services/athleteService";
import { addDays, monday } from "./activityGrid";

/** The totals of one week; `week` is the ISO day of its Monday. */
export interface WeekTotal {
    week: string;
    count: number;
    distance_km: number;
    moving_sec: number;
}

/**
 * One row per week, oldest first, ending with the week of `today`. Weeks without an activity
 * are included with zeros; days outside the weeks are ignored.
 *
 * @param days - Daily totals
 * @param today - ISO day string of today
 * @param weeks - Number of weeks; defaults to 52
 * @returns The weekly totals
 */
export function weeklyTotals(days: DailyActivities[], today: string, weeks = 52): WeekTotal[] {
    const lastMonday = monday(today);
    const totals: WeekTotal[] = [];
    const byWeek = new Map<string, WeekTotal>();
    for (let index = weeks - 1; index >= 0; index--) {
        const week = addDays(lastMonday, -7 * index);
        const total = { week, count: 0, distance_km: 0, moving_sec: 0 };
        totals.push(total);
        byWeek.set(week, total);
    }

    for (const day of days) {
        const total = byWeek.get(monday(day.date));
        if (!total) continue;
        total.count += day.count;
        total.distance_km += day.distance_km;
        total.moving_sec += day.moving_sec;
    }
    return totals;
}
