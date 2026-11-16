/**
 * athleteService.ts — Reads the athlete data the API serves under `/athlete`: Garmin activities
 * (list, daily totals, detail, GPS track, record series) and Withings body measurements.
 * All routes are read-only. Units are metric; Garmin times are the watch's local time, sent as
 * ISO strings without a time zone.
 * Does not own: authentication (see `authService.ts`), caching, or any display formatting.
 */

import { getToken, handleUnauthorized } from "./authService";

const API_BASE = `${import.meta.env.VITE_API_BASE}/athlete`;

/** One Garmin activity in a list. `avg_speed_kmh` is distance over moving time when Garmin gives none. */
export interface ActivitySummary {
    activity_id: string;
    name: string | null;
    sport: string | null;
    sub_sport: string | null;
    start_time: string | null;
    stop_time: string | null;
    elapsed_sec: number | null;
    moving_sec: number | null;
    distance_km: number | null;
    ascent_m: number | null;
    descent_m: number | null;
    avg_hr: number | null;
    max_hr: number | null;
    calories: number | null;
    avg_speed_kmh: number | null;
    training_effect: number | null;
    anaerobic_training_effect: number | null;
}

/** Totals of the activities started on one day (`date` is `YYYY-MM-DD`). */
export interface DailyActivities {
    date: string;
    count: number;
    distance_km: number;
    moving_sec: number;
    elapsed_sec: number;
    ascent_m: number;
}

/** Time spent in one heart rate zone; `hr` is the zone's threshold in bpm. */
export interface HrZone {
    zone: number;
    hr: number | null;
    time_sec: number | null;
}

/** One lap of an activity. */
export interface Lap {
    lap: number;
    start_time: string | null;
    stop_time: string | null;
    elapsed_sec: number | null;
    moving_sec: number | null;
    distance_km: number | null;
    avg_speed_kmh: number | null;
    max_speed_kmh: number | null;
    avg_hr: number | null;
    max_hr: number | null;
    avg_cadence: number | null;
    max_cadence: number | null;
    ascent_m: number | null;
    descent_m: number | null;
    calories: number | null;
    avg_temperature_c: number | null;
    hr_zones: HrZone[];
}

/** Running details of an activity. */
export interface RunningDynamics {
    steps: number | null;
    avg_pace_sec_per_km: number | null;
    avg_moving_pace_sec_per_km: number | null;
    max_pace_sec_per_km: number | null;
    avg_steps_per_min: number | null;
    max_steps_per_min: number | null;
    avg_step_length_mm: number | null;
    avg_vertical_ratio_pct: number | null;
    avg_vertical_oscillation_mm: number | null;
    avg_ground_contact_time_ms: number | null;
    vo2_max: number | null;
}

/** Every stored field of one activity. */
export interface ActivityDetail extends ActivitySummary {
    description: string | null;
    type: string | null;
    lap_count: number | null;
    device_serial_number: number | null;
    self_eval_feel: string | null;
    self_eval_effort: string | null;
    training_load: number | null;
    cycles: number | null;
    avg_cadence: number | null;
    max_cadence: number | null;
    max_speed_kmh: number | null;
    avg_rr: number | null;
    max_rr: number | null;
    avg_temperature_c: number | null;
    min_temperature_c: number | null;
    max_temperature_c: number | null;
    start_lat: number | null;
    start_lon: number | null;
    stop_lat: number | null;
    stop_lon: number | null;
    hr_zones_method: string | null;
    hr_zones: HrZone[];
    running: RunningDynamics | null;
    laps: Lap[];
}

/** The GPS track as a GeoJSON Feature; positions are `[lon, lat]`; `bbox` is null without positions. */
export interface Track {
    type: "Feature";
    geometry: { type: "LineString"; coordinates: [number, number][] };
    properties: { activity_id: string; points: number };
    bbox: [number, number, number, number] | null;
}

/** The records of one activity, one array per field, all the same length. */
export interface Records {
    activity_id: string;
    timestamp: (string | null)[];
    elapsed_sec: (number | null)[];
    distance_km: (number | null)[];
    altitude_m: (number | null)[];
    hr: (number | null)[];
    speed_kmh: (number | null)[];
    cadence: (number | null)[];
    temperature_c: (number | null)[];
    lat: (number | null)[];
    lon: (number | null)[];
}

/** Withings readings of one day, with the fat ratio and muscle mass moving averages. */
export interface MeasureDay {
    date: string;
    weight_kg: number | null;
    fat_ratio_pct: number | null;
    fat_ratio_ema: number | null;
    muscle_mass_kg: number | null;
    muscle_mass_ema: number | null;
    fat_mass_kg: number | null;
    fat_free_mass_kg: number | null;
    bone_mass_kg: number | null;
    hydration_kg: number | null;
}

/** An API error, with the HTTP status (503 means the health database is not configured). */
export class AthleteApiError extends Error {
    /**
     * @param status - HTTP status of the response
     * @param path - The route that answered
     */
    constructor(public readonly status: number, path: string) {
        super(`Request to ${path} failed: ${status}`);
        this.name = "AthleteApiError";
    }
}

/**
 * The sentence an athlete page shows for a failed request.
 *
 * @param error - What the request threw
 * @returns The sentence for 503 (health database not configured), or a general one
 */
export const athleteErrorText = (error: unknown): string =>
    error instanceof AthleteApiError && error.status === 503
        ? "Health data is not configured on the server."
        : "Could not load the data.";

/** Query parameters; undefined and null values are left out. */
type Params = Record<string, string | number | null | undefined>;

/**
 * GET an athlete route with the stored token.
 *
 * @param path - Route below `/athlete`, starting with `/`
 * @param params - Query parameters
 * @returns The decoded JSON body
 * @throws AthleteApiError when the response is not 2xx
 */
async function get<T>(path: string, params: Params = {}): Promise<T> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) query.append(key, String(value));
    }
    const search = query.toString();
    const url = `${API_BASE}${path}${search ? `?${search}` : ""}`;

    const headers: Record<string, string> = {};
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const response = await fetch(url, { headers });
    handleUnauthorized(response);
    if (!response.ok) throw new AthleteApiError(response.status, path);
    return response.json();
}

/** Filters of the activity list; dates are `YYYY-MM-DD`, both included. */
export interface ActivityQuery {
    start?: string;
    end?: string;
    sport?: string;
    limit?: number;
    offset?: number;
}

/**
 * Fetch activity summaries, newest first.
 *
 * @param query - Date range, sport, page size and offset
 * @returns The activities of the page
 */
export function fetchActivities(query: ActivityQuery = {}): Promise<ActivitySummary[]> {
    return get("/activities", { ...query });
}

/**
 * Fetch activity totals per day; the API defaults to the last 365 days.
 *
 * @param start - First day, included
 * @param end - Last day, included
 * @returns One row per day that has activities, oldest first
 */
export function fetchDailyActivities(start?: string, end?: string): Promise<DailyActivities[]> {
    return get("/activities/daily", { start, end });
}

/**
 * Fetch every stored field of one activity.
 *
 * @param id - Garmin activity id
 * @returns The activity with its heart rate zones, running details and laps
 */
export function fetchActivity(id: string): Promise<ActivityDetail> {
    return get(`/activities/${encodeURIComponent(id)}`);
}

/**
 * Fetch the GPS track of one activity.
 *
 * @param id - Garmin activity id
 * @returns A GeoJSON Feature with a LineString
 */
export function fetchTrack(id: string): Promise<Track> {
    return get(`/activities/${encodeURIComponent(id)}/track`);
}

/**
 * Fetch the record series of one activity.
 *
 * @param id - Garmin activity id
 * @returns One array per field
 */
export function fetchRecords(id: string): Promise<Records> {
    return get(`/activities/${encodeURIComponent(id)}/records`);
}

/**
 * Fetch Withings readings per day; the API defaults to the last 365 days.
 *
 * @param start - First day, included
 * @param end - Last day, included
 * @returns One row per day that has a reading, oldest first
 */
export function fetchMeasures(start?: string, end?: string): Promise<MeasureDay[]> {
    return get("/measures", { start, end });
}
