import { describe, it, expect, beforeEach, vi } from "vitest";

const start = vi.fn().mockResolvedValue(undefined);
const stop = vi.fn().mockResolvedValue(undefined);

vi.mock("@/plugins/trailTrackerPlugin", () => ({
    TrailTracker: {
        start,
        stop,
        addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    },
}));

const native = vi.hoisted(() => ({ value: true }));

vi.mock("@capacitor/core", () => ({
    Capacitor: { isNativePlatform: () => native.value },
}));

vi.mock("@capacitor/geolocation", () => ({
    Geolocation: { requestPermissions: vi.fn().mockResolvedValue({ location: "granted" }) },
}));

const { useTrailTracker } = await import("./useTrailTracker");

/**
 * An unsigned JWT expiring in the given number of hours.
 *
 * @param hours - Hours from now
 * @returns header.payload.signature
 */
function tokenExpiringIn(hours: number): string {
    const exp = Math.floor((Date.now() + hours * 3_600_000) / 1000);
    const payload = btoa(JSON.stringify({ sub: "foo", exp })).replace(/=+$/, "");
    return `header.${payload}.signature`;
}

describe("useTrailTracker", () => {
    let storedToken: string | null;

    beforeEach(async () => {
        start.mockClear();
        vi.stubGlobal("localStorage", {
            getItem: vi.fn(() => storedToken),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        });
        await useTrailTracker().stopTracking();
    });

    it("refuses to start when the login expires within 24 hours", async () => {
        storedToken = tokenExpiringIn(23);
        const tracker = useTrailTracker();

        await tracker.startTracking();

        expect(start).not.toHaveBeenCalled();
        expect(tracker.loginExpiresSoon.value).toBe(true);
        expect(tracker.isTracking.value).toBe(false);
    });

    it("starts with the token when the login lasts more than 24 hours", async () => {
        storedToken = tokenExpiringIn(25);
        const tracker = useTrailTracker();

        await tracker.startTracking();

        expect(start).toHaveBeenCalledWith(expect.objectContaining({ token: storedToken }));
        expect(tracker.loginExpiresSoon.value).toBe(false);
        expect(tracker.isTracking.value).toBe(true);
    });

    it("starts nothing in a browser and says why", async () => {
        native.value = false;
        vi.resetModules();
        try {
            const web = await import("./useTrailTracker");
            storedToken = tokenExpiringIn(25);
            const tracker = web.useTrailTracker();

            await tracker.startTracking();

            expect(web.trackingAvailable).toBe(false);
            expect(start).not.toHaveBeenCalled();
            expect(tracker.error.value).toBe("Tracking works in the Android app only.");
        } finally {
            native.value = true;
        }
    });
});
