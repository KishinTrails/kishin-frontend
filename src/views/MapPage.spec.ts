import { mount } from "@vue/test-utils";
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import MapPage from "./MapPage.vue";
import FogOverlay from "@/components/FogOverlay.vue";
import PoiOverlay from "@/components/PoiOverlay.vue";

vi.mock("maplibregl", () => {
    return {
        default: vi.fn(() => ({
            on: vi.fn(),
            addControl: vi.fn(),
            project: vi.fn().mockReturnValue({ x: 100, y: 100 }),
            getBounds: vi.fn().mockReturnValue({
                getSouthWest: vi.fn().mockReturnValue({ lat: 45.75, lng: 3.09 }),
                getNorthEast: vi.fn().mockReturnValue({ lat: 45.76, lng: 3.11 }),
            }),
            getZoom: vi.fn().mockReturnValue(16),
            resize: vi.fn(),
            remove: vi.fn(),
        })),
        NavigationControl: vi.fn(),
    };
});

vi.mock("@ionic/vue", () => ({
    IonPage: {
        name: "IonPage",
        template: "<div><slot /></div>",
    },
    IonContent: {
        name: "IonContent",
        template: "<div><slot /></div>",
    },
}));

vi.mock("@/services/trailsService", () => ({
    fetchExploredTiles: vi.fn().mockResolvedValue(["cell1", "cell2", "cell3"]),
}));

vi.mock("@/services/poiService", () => ({
    fetchCellTypes: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("@/services/cacheService", () => ({
    getCellTypeFromCache: vi.fn().mockReturnValue(null),
}));

vi.mock("h3-js", () => ({
    polygonToCells: vi.fn().mockReturnValue(["cell1", "cell2", "cell3"]),
    cellToBoundary: vi.fn().mockReturnValue([
        [45.75, 3.09],
        [45.76, 3.09],
        [45.76, 3.11],
        [45.75, 3.11],
    ]),
    getResolution: vi.fn().mockReturnValue(10),
    uncompactCells: vi.fn().mockReturnValue(["cell1", "cell2", "cell3"]),
    cellToChildren: vi.fn().mockReturnValue([]),
}));

describe("MapPage.vue", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("Rendering", () => {
        test("renders map container", () => {
            const wrapper = mount(MapPage);

            expect(wrapper.find(".map-container").exists()).toBe(true);
            expect(wrapper.find(".map").exists()).toBe(true);
        });

        test("renders controls with stats", () => {
            const wrapper = mount(MapPage);

            expect(wrapper.find(".controls").exists()).toBe(true);
            expect(wrapper.text()).toContain("Trail Map");
            expect(wrapper.text()).toContain("Explored:");
            expect(wrapper.text()).toContain("Visible Explored:");
            expect(wrapper.text()).toContain("Visible Fog:");
        });

        test("renders FogOverlay component", () => {
            const wrapper = mount(MapPage);

            const fogOverlay = wrapper.findComponent(FogOverlay);
            expect(fogOverlay.exists()).toBe(true);
        });

        test("renders PoiOverlay component", () => {
            const wrapper = mount(MapPage);

            const poiOverlay = wrapper.findComponent(PoiOverlay);
            expect(poiOverlay.exists()).toBe(true);
        });
    });

    describe("Component Refs", () => {
        test("fogOverlay ref is initialized", async () => {
            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            await vm.$nextTick();

            expect(vm.fogOverlay).toBeDefined();
        });

        test("poiOverlay ref is initialized", async () => {
            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            await vm.$nextTick();

            expect(vm.poiOverlay).toBeDefined();
        });
    });

    describe("State Initialization", () => {
        test("visibleCells array exists", () => {
            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            expect(vm.visibleCells).toBeDefined();
            expect(Array.isArray(vm.visibleCells)).toBe(true);
        });

        test("visitedCells Set exists", () => {
            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            expect(vm.visitedCells).toBeDefined();
            expect(vm.visitedCells instanceof Set).toBe(true);
        });

        test("cellTypes map exists", () => {
            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            expect(vm.cellTypes).toBeDefined();
            expect(vm.cellTypes instanceof Map).toBe(true);
        });

        test("fogOpacity defaults to 0.85", () => {
            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            expect(vm.fogOpacity).toBe(0.85);
        });

        test("fogColor defaults to dark", () => {
            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            expect(vm.fogColor).toBe("#1a1a1a");
        });

        test("H3_RESOLUTION constant is defined", () => {
            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            expect(vm.H3_RESOLUTION).toBe(10);
        });

        test("visibleExplored and visibleFog arrays exist", () => {
            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            expect(vm.visibleExplored).toBeDefined();
            expect(Array.isArray(vm.visibleExplored)).toBe(true);
            expect(vm.visibleFog).toBeDefined();
            expect(Array.isArray(vm.visibleFog)).toBe(true);
        });
    });

    describe("Draw Coordination", () => {
        test("draw() does not throw when overlays are null", () => {
            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            vm.fogOverlay = null;
            vm.poiOverlay = null;

            expect(() => vm.draw()).not.toThrow();
        });
    });

    describe("Map Initialization", () => {
        test("initMap returns early without mapContainer", () => {
            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            vm.mapContainer = null;

            expect(() => vm.initMap()).not.toThrow();
        });
    });

    describe("Cell Management", () => {
        test("updateVisibleCells correctly splits cells into explored and fog", async () => {
            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            vm.visitedCells = new Set(["cell1"]);

            vm.map = {
                getBounds: vi.fn().mockReturnValue({
                    getSouthWest: () => ({ lat: 45.75, lng: 3.09 }),
                    getNorthEast: () => ({ lat: 45.76, lng: 3.11 }),
                }),
            };

            vm.updateVisibleCells();

            expect(vm.visibleExplored).toContain("cell1");
            expect(vm.visibleFog).toContain("cell2");
            expect(vm.visibleFog).toContain("cell3");
        });

        test("updateVisibleCells returns early when map is not initialized", () => {
            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            vm.map = null;

            expect(() => vm.updateVisibleCells()).not.toThrow();
        });

        test("computeCellsFromBounds calls h3.polygonToCells", async () => {
            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            vm.map = {
                getBounds: vi.fn().mockReturnValue({
                    getSouthWest: () => ({ lat: 45.75, lng: 3.09 }),
                    getNorthEast: () => ({ lat: 45.76, lng: 3.11 }),
                }),
            };

            vm.computeCellsFromBounds();

            const { polygonToCells } = await import("h3-js");
            expect(polygonToCells).toHaveBeenCalled();
        });

        test("computeCellsFromBounds returns empty array without map", () => {
            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            vm.map = null;

            const result = vm.computeCellsFromBounds();

            expect(result).toEqual([]);
        });
    });

    describe("API Integration", () => {
        test("loadExploredTiles fetches from API and populates visitedCells", async () => {
            const { fetchExploredTiles } = await import("@/services/trailsService");

            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            await vm.loadExploredTiles();

            expect(fetchExploredTiles).toHaveBeenCalled();

            expect(vm.visitedCells.has("cell1")).toBe(true);
            expect(vm.visitedCells.has("cell2")).toBe(true);
            expect(vm.visitedCells.has("cell3")).toBe(true);
        });

        test("loadExploredTiles handles API errors gracefully", async () => {
            const { fetchExploredTiles } = await import("@/services/trailsService");
            vi.mocked(fetchExploredTiles).mockRejectedValueOnce(new Error("API error"));

            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

            await vm.loadExploredTiles();

            expect(consoleSpy).toHaveBeenCalledWith("Failed to load explored tiles:", expect.any(Error));

            consoleSpy.mockRestore();
        });

        test("fetchCellTypes skips API call when all cells are cached", async () => {
            const { getCellTypeFromCache } = await import("@/services/cacheService");
            const { fetchCellTypes } = await import("@/services/poiService");

            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            vm.visibleExplored = ["cell1", "cell2"];
            vm.cellTypes = new Map();
            getCellTypeFromCache.mockReturnValue("peak");

            await vm.fetchCellTypes();

            expect(fetchCellTypes).not.toHaveBeenCalled();
        });

        test("fetchCellTypes only fetches uncached cells from API", async () => {
            const { getCellTypeFromCache } = await import("@/services/cacheService");
            const { fetchCellTypes } = await import("@/services/poiService");

            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            vm.visibleExplored = ["cell1", "cell2"];
            vm.cellTypes = new Map();
            getCellTypeFromCache.mockReturnValueOnce("peak").mockReturnValueOnce(null);

            await vm.fetchCellTypes();

            expect(fetchCellTypes).toHaveBeenCalledWith(["cell2"], expect.any(AbortSignal));
        });

        test("fetchCellTypes handles empty cell list", async () => {
            const { fetchCellTypes } = await import("@/services/poiService");

            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            vm.visibleExplored = [];
            vm.cellTypes = new Map();

            await vm.fetchCellTypes();

            expect(fetchCellTypes).not.toHaveBeenCalled();
        });

        test("fetchCellTypes caches non-none types from API", async () => {
            const { fetchCellTypes } = await import("@/services/poiService");
            const { getCellTypeFromCache } = await import("@/services/cacheService");

            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            vm.cellTypes = new Map();
            vm.visibleExplored = ["cell1", "cell2"];

            const mockGetCache = getCellTypeFromCache as ReturnType<typeof vi.fn>;
            mockGetCache.mockReturnValue(null);

            const mockFetch = fetchCellTypes as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValueOnce(
                new Map([
                    ["cell1", "peak"],
                    ["cell2", "natural"],
                ]),
            );

            await vm.fetchCellTypes();

            expect(vm.cellTypes.get("cell1")).toBe("peak");
            expect(vm.cellTypes.get("cell2")).toBe("natural");
        });

        test("fetchCellTypes aborts previous request on new call", async () => {
            const { fetchCellTypes } = await import("@/services/poiService");

            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            vm.visibleExplored = ["cell1"];
            vm.cellTypes = new Map();

            const mockFetch = fetchCellTypes as ReturnType<typeof vi.fn>;
            mockFetch.mockResolvedValue(new Map());

            await vm.fetchCellTypes();
            const firstAbortController = vm.abortController;

            await vm.fetchCellTypes();

            expect(firstAbortController?.signal.aborted).toBe(true);
        });
    });

    describe("Component Lifecycle", () => {
        test("onUnmounted clears debounce timer", async () => {
            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            vi.useFakeTimers();

            const mockUpdate = vi.fn();
            vm.updateVisibleCells = mockUpdate;

            vm.debouncedUpdate();

            await wrapper.unmount();

            vi.advanceTimersByTime(500);

            expect(mockUpdate).not.toHaveBeenCalled();

            vi.useRealTimers();
        });

        test("onUnmounted removes map instance", async () => {
            const wrapper = mount(MapPage) as any;
            const vm = wrapper.vm;

            const mockMap = {
                remove: vi.fn(),
            };
            vm.map = mockMap;

            await wrapper.unmount();

            expect(mockMap.remove).toHaveBeenCalled();
        });
    });
});
