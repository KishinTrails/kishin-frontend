/**
 * Typed Capacitor bridge for the native TrailTracker plugin.
 *
 * The native service (TrailTrackerService.kt) owns the full GPS→H3→HTTP
 * pipeline and runs independently of the WebView, surviving screen lock.
 *
 * This module is the single point of contact with the native side.
 * Nothing else should call registerPlugin('TrailTracker') directly.
 */

import { registerPlugin } from "@capacitor/core";

export interface TrailTrackerPosition {
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
}

export interface TrailTrackerStartOptions {
    token: string /** Bearer token forwarded to the API by the native service. */;
    apiBase: string;
}

export interface TrailTrackerPlugin {
    start(options: TrailTrackerStartOptions): Promise<void>;
    stop(): Promise<void>;
    /**
     * Optional: native side calls notifyListeners('position', ...) on each
     * logged fix so the UI can refresh while the app is foregrounded.
     */
    addListener(event: "position", handler: (position: TrailTrackerPosition) => void): Promise<{ remove: () => void }>;
}

export const TrailTracker = registerPlugin<TrailTrackerPlugin>("TrailTracker");
