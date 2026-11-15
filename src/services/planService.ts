/**
 * planService.ts — Reads the active training plan's progression from `/plan`, lists the Garmin
 * activities that can complete a run, and records or undoes completions.
 * Does not own: authentication (see `authService.ts`), plan creation (plans are imported on the
 * server with `kishin plan import`), or display formatting.
 */

import { getToken } from "./authService";
import type { ActivitySummary } from "./athleteService";

const API_BASE = `${import.meta.env.VITE_API_BASE}/plan`;

/** One segment of a planned run. */
export interface PlanSegment {
    position: number;
    type: string;
    duration_sec: number | null;
    distance_km: number | null;
    rpe_min: number | null;
    rpe_max: number | null;
    pace_min_km: number | null;
}

/** That a training is done; runs carry the linked activity and the RPE. */
export interface Completion {
    completed_at: string;
    rpe: number | null;
    activity: {
        activity_id: string;
        name: string | null;
        start_time: string | null;
        distance_km: number | null;
        moving_sec: number | null;
    } | null;
}

/** One training of a week. `is_tick` is true for cross-training, leg day and yoga. */
export interface PlanTraining {
    id: number;
    position: number;
    type: string;
    is_tick: boolean;
    target_distance_km: number | null;
    target_duration_sec: number | null;
    segments: PlanSegment[];
    completion: Completion | null;
}

/** What Garmin recorded as running in one plan week. */
export interface WeekRunning {
    run_count: number;
    run_km: number;
    run_moving_sec: number;
    longest_run_km: number | null;
}

/** One plan week, Monday (`start`) to Sunday (`end`). */
export interface PlanWeek {
    week_number: number;
    phase: string;
    start: string;
    end: string;
    trainings: PlanTraining[];
    running: WeekRunning | null;
}

/** The active plan and its progression. `current_week` is below 1 before the start, above `week_count` after the end. */
export interface PlanProgress {
    plan_id: number;
    name: string;
    goal_type: string | null;
    target_fat_ratio: number | null;
    target_muscle_mass_kg: number | null;
    start_date: string;
    current_week: number;
    week_count: number;
    health_available: boolean;
    weeks: PlanWeek[];
}

/** A plan API error, with the HTTP status and the server's explanation when it gave one. */
export class PlanApiError extends Error {
    /**
     * @param status - HTTP status of the response
     * @param detail - The `detail` field of the response body, or a generic sentence
     */
    constructor(public readonly status: number, public readonly detail: string) {
        super(detail);
        this.name = "PlanApiError";
    }
}

/**
 * Send a request to a plan route with the stored token.
 *
 * @param path - Route below `/plan`, empty or starting with `/`
 * @param init - Method and body
 * @returns The decoded JSON body, or null for 204
 * @throws PlanApiError when the response is not 2xx
 */
async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const headers: Record<string, string> = {};
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (init.body !== undefined) headers["Content-Type"] = "application/json";

    const response = await fetch(`${API_BASE}${path}`, {
        method: init.method ?? "GET",
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const detail = typeof body.detail === "string" ? body.detail : `Request failed: ${response.status}`;
        throw new PlanApiError(response.status, detail);
    }
    return response.status === 204 ? (null as T) : response.json();
}

/**
 * Fetch the active plan's progression.
 *
 * @returns The plan with its weeks, trainings and completions
 * @throws PlanApiError 404 when there is no active plan
 */
export function fetchPlan(): Promise<PlanProgress> {
    return request("");
}

/**
 * Fetch the Garmin running activities of a training's week not linked to another training.
 *
 * @param trainingId - The training
 * @returns The activities, oldest first
 */
export function fetchCandidates(trainingId: number): Promise<ActivitySummary[]> {
    return request(`/trainings/${trainingId}/candidates`);
}

/**
 * Mark a training done: a run with an activity and an RPE, a tick item with neither.
 *
 * @param trainingId - The training
 * @param run - The activity id and the RPE (1-10), for a run
 * @returns The training with its completion
 * @throws PlanApiError 422 with the reason when the activity does not complete the run
 */
export function completeTraining(trainingId: number, run?: { activity_id: string; rpe: number }): Promise<PlanTraining> {
    return request(`/trainings/${trainingId}/complete`, { method: "POST", body: run ?? {} });
}

/**
 * Undo a completion.
 *
 * @param trainingId - The training
 */
export async function uncompleteTraining(trainingId: number): Promise<void> {
    await request(`/trainings/${trainingId}/complete`, { method: "DELETE" });
}
