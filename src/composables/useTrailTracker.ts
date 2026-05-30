/**
 * useTrailTracker — composable for the native TrailTracker Capacitor plugin.
 *
 * State is module-level (singleton), so any component that imports this
 * composable reads the same reactive refs.  MapPage can watch `lastPosition`
 * directly without prop-drilling or a global store.
 *
 * Responsibilities:
 *  - Request foreground + background location permissions in the correct order
 *  - Start / stop the native foreground service via the Capacitor plugin
 *  - Listen to "position" events emitted by the native side while foregrounded
 *  - Expose reactive tracking state to the rest of the UI
 *
 * NOT responsible for:
 *  - S2 cell conversion  → done natively in TrailTrackerService.kt
 *  - API calls           → done natively in TrailTrackerService.kt
 *  - Map rendering       → MapPage / useTrailMap
 *
 * Permission flow (Android):
 *  1. Request ACCESS_FINE_LOCATION via Capacitor Geolocation (foreground prompt).
 *  2. Call TrailTracker.start() — the plugin requests ACCESS_BACKGROUND_LOCATION
 *     itself, which triggers the separate "Allow all the time" system dialog
 *     required on Android 11+.
 *
 * The native service runs and reports to the API regardless of whether the
 * JS position listener is attached (e.g. screen locked, WebView paused).
 */

import { ref, computed, readonly } from "vue";
import { Geolocation } from "@capacitor/geolocation";

import { TrailTracker } from "@/plugins/trailTrackerPlugin";
import type { TrailTrackerPosition } from "@/plugins/trailTrackerPlugin";
import { getToken } from "@/services/authService";

// ---------------------------------------------------------------------------
// Singleton state — declared at module scope so all callers share one instance
// ---------------------------------------------------------------------------

const isTracking = ref(false);
const lastPosition = ref<TrailTrackerPosition | null>(null);
const error = ref<string | null>(null);

/** Handle returned by addListener; kept so we can remove it on stop. */
let positionListenerHandle: { remove: () => void } | null = null;

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function useTrailTracker() {
    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    /**
     * Register a listener for "position" events emitted by the native service.
     *
     * The native side calls notifyListeners("position", ...) on each throttled
     * fix (every 30 s).  If the WebView is paused (screen off), Capacitor
     * buffers or drops the event — that is acceptable because the API call
     * still happens natively regardless.
     */
    async function attachPositionListener(): Promise<void> {
        positionListenerHandle = await TrailTracker.addListener("position", (pos: TrailTrackerPosition) => {
            lastPosition.value = pos;
        });
    }

    function detachPositionListener(): void {
        positionListenerHandle?.remove();
        positionListenerHandle = null;
    }

    // -----------------------------------------------------------------------
    // Public actions
    // -----------------------------------------------------------------------

    /**
     * Request permissions then start the native tracking service.
     *
     * Step 1 — foreground location: handled here via @capacitor/geolocation
     *           so we can give the user a clear rejection message before
     *           ever calling the plugin.
     *
     * Step 2 — background location: delegated to the Kotlin plugin via
     *           TrailTracker.start().  The plugin triggers the "Allow all
     *           the time" prompt on Android 11+ internally, which is the
     *           only way to reliably get that permission on modern Android.
     */
    async function startTracking(): Promise<void> {
        if (isTracking.value) return;
        error.value = null;

        try {
            // Step 1 — foreground location permission
            const permission = await Geolocation.requestPermissions();
            if (permission.location !== "granted") {
                error.value = "Location permission denied";
                return;
            }

            // Step 2 — start service; plugin handles background location prompt
            await TrailTracker.start({
                token: getToken() ?? "",
                apiBase: import.meta.env.VITE_API_BASE as string,
            });

            // Attach the foreground position listener for UI updates.
            // This is best-effort: the service runs and POSTs to the API
            // whether or not this listener is active.
            await attachPositionListener();

            isTracking.value = true;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to start tracking";
            error.value = message;
            console.error("[useTrailTracker] start error:", err);
        }
    }

    async function stopTracking(): Promise<void> {
        if (!isTracking.value) return;

        try {
            // Detach JS listener before stopping the service so we don't
            // receive stale events during teardown.
            detachPositionListener();
            await TrailTracker.stop();
            isTracking.value = false;
        } catch (err: unknown) {
            console.error("[useTrailTracker] stop error:", err);
        }
    }

    // -----------------------------------------------------------------------
    // Derived state
    // -----------------------------------------------------------------------

    const statusLabel = computed<string>(() => {
        if (isTracking.value) return "Tracking";
        if (lastPosition.value) return "Idle";
        return "Stopped";
    });

    const statusClass = computed<string>(() => {
        if (isTracking.value) return "dot-active";
        if (lastPosition.value) return "dot-idle";
        return "dot-off";
    });

    // -----------------------------------------------------------------------
    // Exposed API
    //
    // Refs are readonly so only this composable mutates them; components can
    // only read and react.
    // -----------------------------------------------------------------------

    return {
        isTracking: readonly(isTracking),
        lastPosition: readonly(lastPosition),
        error: readonly(error),
        statusLabel,
        statusClass,
        startTracking,
        stopTracking,
    };
}
