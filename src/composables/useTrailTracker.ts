/**
 * useTrailTracker — composable for the native TrailTracker plugin.
 *
 * State is module-level (singleton), so any component that imports this
 * composable reads the same reactive refs. MapPage can watch `lastPosition`
 * directly without prop-drilling or a global store.
 *
 * Responsibilities:
 *  - Start / stop the native foreground service
 *  - Listen to position events from the native side (foreground only)
 *  - Expose reactive tracking state to the rest of the UI
 *
 * NOT responsible for:
 *  - H3 conversion      → done natively in TrailTrackerService.kt
 *  - API calls          → done natively in TrailTrackerService.kt
 *  - Map interaction    → MapPage / useTrailMap
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

/** Handle returned by addListener; kept so we can clean it up on stop. */
let positionListenerHandle: { remove: () => void } | null = null;

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export function useTrailTracker() {
    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    async function attachPositionListener(): Promise<void> {
        positionListenerHandle = await TrailTracker.addListener("position", (pos) => {
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

    async function startTracking(): Promise<void> {
        if (isTracking.value) return;

        error.value = null;

        try {
            // Request permission first — required on Android 14+ before starting FGS
            const permission = await Geolocation.requestPermissions();
            if (permission.location !== "granted") {
                error.value = "Location permission denied";
                return;
            }

            await TrailTracker.start({
                token: getToken() ?? "",
                apiBase: import.meta.env.VITE_API_BASE as string,
            });

            // Receive foreground position updates for UI display.
            // These are best-effort: the native service keeps running even
            // if this listener is never attached (e.g. screen locked).
            await attachPositionListener();

            isTracking.value = true;
        } catch (err: any) {
            error.value = err?.message ?? "Failed to start tracking";
            console.error("[useTrailTracker] start error:", err);
        }
    }

    async function stopTracking(): Promise<void> {
        if (!isTracking.value) return;

        try {
            detachPositionListener();
            await TrailTracker.stop();
            isTracking.value = false;
        } catch (err: any) {
            console.error("[useTrailTracker] stop error:", err);
        }
    }

    // -----------------------------------------------------------------------
    // Derived state
    // -----------------------------------------------------------------------

    const statusLabel = computed(() => {
        if (isTracking.value) return "Tracking";
        if (lastPosition.value) return "Idle";
        return "Stopped";
    });

    const statusClass = computed(() => {
        if (isTracking.value) return "dot-active";
        if (lastPosition.value) return "dot-idle";
        return "dot-off";
    });

    // -----------------------------------------------------------------------
    // Exposed API
    //
    // lastPosition and isTracking are readonly so only this composable mutates
    // them, but any component can reactively read them.
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
