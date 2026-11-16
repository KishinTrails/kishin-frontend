/**
 * fixAge.ts — How long ago a GPS fix was recorded, as the tracker shows it.
 * Does not own: the clock (the caller passes the current time).
 */

/**
 * The age of a fix in words.
 *
 * @param timestamp - When the fix was recorded, Unix milliseconds
 * @param now - The current time, Unix milliseconds
 * @returns `just now` under 5 s, then `12 s ago`, `3 min ago`, `2 h ago`
 */
export function fixAge(timestamp: number, now: number): string {
    const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
    if (seconds < 5) return "just now";
    if (seconds < 60) return `${seconds} s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    return `${Math.floor(minutes / 60)} h ago`;
}
