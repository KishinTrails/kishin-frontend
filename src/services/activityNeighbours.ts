/**
 * activityNeighbours.ts — The activities just before and just after one activity, by start
 * time, for the previous / next links of the activity page. The API lists activities newest
 * first only, so the search is:
 * - the other activities of the same day;
 * - otherwise, before: the newest activity up to the day before;
 * - otherwise, after: the first later day that has activities (`/activities/daily`), and the
 *   oldest activity of that day.
 * Does not own: the requests themselves (see `athleteService.ts`).
 */

import { addDays, todayIso } from "@/utils/activityGrid";
import { fetchActivities, fetchDailyActivities, type ActivitySummary } from "./athleteService";

/** The activity before and the activity after; null where there is none. */
export interface Neighbours {
    previous: ActivitySummary | null;
    next: ActivitySummary | null;
}

/** Most activities one day is expected to hold; a day is read in one request of this size. */
const DAY_LIMIT = 100;

/**
 * The activities before and after one activity.
 *
 * @param activityId - The activity
 * @param startTime - Its device-local start time, ISO (`2026-03-03T07:00:00`)
 * @returns Its neighbours; both null when the start time is unknown
 */
export async function fetchNeighbours(activityId: string, startTime: string | null): Promise<Neighbours> {
    if (!startTime) return { previous: null, next: null };
    const day = startTime.slice(0, 10);
    const sameDay = await fetchActivities({ start: day, end: day, limit: DAY_LIMIT });
    const index = sameDay.findIndex((activity) => activity.activity_id === activityId);
    const [previous, next] = await Promise.all([
        index >= 0 && index + 1 < sameDay.length ? sameDay[index + 1]! : previousBefore(day),
        index > 0 ? sameDay[index - 1]! : nextAfter(day),
    ]);
    return { previous, next };
}

/**
 * The newest activity of the days before one day.
 *
 * @param day - ISO day
 * @returns The activity, or null when there is none
 */
async function previousBefore(day: string): Promise<ActivitySummary | null> {
    const [activity] = await fetchActivities({ end: addDays(day, -1), limit: 1 });
    return activity ?? null;
}

/**
 * The oldest activity of the first day after one day that has activities.
 *
 * @param day - ISO day
 * @returns The activity, or null when there is none up to today
 */
async function nextAfter(day: string): Promise<ActivitySummary | null> {
    const today = todayIso();
    if (day >= today) return null;
    const [firstDay] = await fetchDailyActivities(addDays(day, 1), today);
    if (!firstDay) return null;
    const activities = await fetchActivities({ start: firstDay.date, end: firstDay.date, limit: DAY_LIMIT });
    return activities[activities.length - 1] ?? null;
}
