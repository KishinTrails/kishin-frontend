/**
 * Typed Capacitor bridge for the native TrailTracker plugin.
 *
 * The native service (TrailTrackerService.kt) owns the full GPS→S2→HTTP
 * pipeline and runs independently of the WebView, surviving screen lock.
 *
 * This module is the single point of contact with the native side.
 * Nothing else should call registerPlugin('TrailTracker') directly.
 */

import { registerPlugin } from "@capacitor/core";

/** Position fix delivered by the native service to the JS layer. */
export interface TrailTrackerPosition {
    /** Latitude in decimal degrees. */
    latitude: number;
    /** Longitude in decimal degrees. */
    longitude: number;
    /** Estimated horizontal accuracy radius in metres. */
    accuracy: number;
    /** Unix timestamp in milliseconds of when the fix was recorded. */
    timestamp: number;
}

/** Options passed to `TrailTracker.start()`. */
export interface TrailTrackerStartOptions {
    /** Bearer token forwarded to the API by the native service. */
    token: string;
    /** Base URL of the kishin-api, e.g. `'https://api.example.com'`. */
    apiBase: string;
}

/** TypeScript mirror of the native TrailTracker Capacitor plugin interface. */
export interface TrailTrackerPlugin {
    /** Start the background GPS tracking foreground service. */
    start(options: TrailTrackerStartOptions): Promise<void>;
    /** Stop the background GPS tracking foreground service. */
    stop(): Promise<void>;
    /**
     * Subscribe to position events emitted by the native service.
     *
     * The native side calls `notifyListeners('position', ...)` on each
     * throttled fix (every 2 s while foregrounded). The returned handle
     * must be removed when the subscriber is torn down to prevent leaks.
     */
    addListener(event: "position", handler: (position: TrailTrackerPosition) => void): Promise<{ remove: () => void }>;
}

/** Singleton Capacitor plugin instance — import this, do not re-register. */
export const TrailTracker = registerPlugin<TrailTrackerPlugin>("TrailTracker");
