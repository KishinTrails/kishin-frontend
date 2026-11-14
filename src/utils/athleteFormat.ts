/**
 * athleteFormat.ts — Formats athlete values for display: durations, paces, distances and the
 * watch's local times. Plain functions, testable without a DOM.
 * Does not own: unit conversion, which the API does (everything arrives metric).
 */

import { longDate } from "./activityGrid";

const pad = (value: number): string => String(value).padStart(2, "0");

/**
 * A duration as `h:mm:ss`, or `m:ss` under an hour.
 *
 * @param seconds - The duration; null gives `–`
 * @returns The formatted duration
 */
export function formatDuration(seconds: number | null | undefined): string {
    if (seconds === null || seconds === undefined) return "–";
    const total = Math.round(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

/**
 * A pace as `m:ss /km`.
 *
 * @param secPerKm - Seconds per km; null or 0 gives `–`
 * @returns The formatted pace
 */
export function formatPace(secPerKm: number | null | undefined): string {
    if (!secPerKm || !Number.isFinite(secPerKm)) return "–";
    const total = Math.round(secPerKm);
    return `${Math.floor(total / 60)}:${pad(total % 60)} /km`;
}

/**
 * Seconds per km from a speed.
 *
 * @param kmh - Speed in km/h
 * @returns Seconds per km, or null for a missing or zero speed
 */
export function paceFromSpeed(kmh: number | null | undefined): number | null {
    return kmh ? 3600 / kmh : null;
}

/**
 * A distance in km with two decimals.
 *
 * @param km - The distance; null gives `–`
 * @returns For example `12.35 km`
 */
export function formatKm(km: number | null | undefined): string {
    return km === null || km === undefined ? "–" : `${km.toFixed(2)} km`;
}

/**
 * A number with a unit, rounded; null gives `–`.
 *
 * @param value - The number
 * @param unit - The unit, appended after a space when not empty
 * @param digits - Decimals; defaults to 0
 * @returns The formatted value
 */
export function formatValue(value: number | null | undefined, unit = "", digits = 0): string {
    if (value === null || value === undefined) return "–";
    return unit ? `${value.toFixed(digits)} ${unit}` : value.toFixed(digits);
}

/**
 * A Garmin time (the watch's local time, ISO without a time zone) as date and time. The string
 * is read as written, so no time zone conversion moves it.
 *
 * @param iso - For example `2026-03-03T07:05:00`; null gives `–`
 * @returns For example `Tue 3 Mar 2026, 07:05`
 */
export function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return "–";
    const [date, time = ""] = iso.split("T");
    return time ? `${longDate(date!)}, ${time.slice(0, 5)}` : longDate(date!);
}
