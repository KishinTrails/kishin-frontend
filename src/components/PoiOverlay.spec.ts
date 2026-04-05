import { mount, VueWrapper } from "@vue/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import PoiOverlay from "@/components/PoiOverlay.vue";
import { MockCanvasRenderingContext2D } from "@/__mocks__/canvas";

type CellTypeKey = "peak" | "natural" | "industrial";

vi.mock("h3-js", () => ({
    cellToBoundary: vi.fn((cellId: string) => {
        if (cellId === "invalid") return [];
        return [
            [45.75, 3.1],
            [45.76, 3.1],
            [45.76, 3.11],
            [45.75, 3.11],
        ];
    }),
}));

class MockImage {
    src: string = "";
    width: number = 24;
    height: number = 24;
    constructor() {
        MockImage.instances.push(this);
    }
    static instances: MockImage[] = [];
    static clearInstances() {
        MockImage.instances = [];
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeMap = (): any => ({
    project: vi.fn((_coord: [number, number]) => ({ x: 150, y: 75 })),
    getZoom: vi.fn(() => 16),
});

/**
 * Mount PoiOverlay and wait for onMounted to complete.
 * rAF is already frozen globally so animate() never loops.
 */
const mountOverlay = async (props: { map?: any; cellTypes: Map<string, CellTypeKey>; visibleCells: string[] }) => {
    const wrapper = mount(PoiOverlay, { props });
    await wrapper.vm.$nextTick();
    return wrapper;
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("PoiOverlay", () => {
    let mockMap: ReturnType<typeof makeMap>;
    let mockContext: MockCanvasRenderingContext2D;
    let wrapper: VueWrapper<any>;

    beforeEach(() => {
        MockImage.clearInstances();

        mockMap = makeMap();

        mockContext = new MockCanvasRenderingContext2D();
        (HTMLCanvasElement.prototype.getContext as any) = (_type: string) => (_type === "2d" ? mockContext : null);

        // Freeze the animation loop — draw() is still callable manually
        // and via watch, but animate() never re-schedules itself.
        vi.spyOn(window, "requestAnimationFrame").mockReturnValue(0);
        vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

        vi.stubGlobal("Image", MockImage);
    });

    afterEach(async () => {
        await wrapper?.unmount();
        vi.clearAllMocks();
        vi.restoreAllMocks();
        mockContext.clearHistory();
    });

    // ── Rendering ─────────────────────────────────────────────────────────────

    describe("Rendering", () => {
        it("renders canvas element with correct class", async () => {
            wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });

            expect(wrapper.find("canvas.poi-overlay").exists()).toBe(true);
        });

        it("accepts and exposes cellTypes prop", async () => {
            const cellTypes = new Map<string, CellTypeKey>([["cell1", "peak"]]);
            wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: ["cell1"] });

            expect(wrapper.props("cellTypes")).toEqual(cellTypes);
        });

        it("accepts map prop", async () => {
            wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });

            expect(wrapper.props("map")).toEqual(mockMap);
        });

        it("exposes draw method", async () => {
            wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });

            expect(typeof wrapper.vm.draw).toBe("function");
        });
    });

    // ── Canvas Initialization ─────────────────────────────────────────────────

    describe("Canvas Initialization", () => {
        it("gets 2d context on mount", async () => {
            const getContextSpy = vi.fn().mockReturnValue(mockContext);
            HTMLCanvasElement.prototype.getContext = getContextSpy;

            wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });

            expect(getContextSpy).toHaveBeenCalledWith("2d");
        });

        it("resizes canvas to window dimensions on mount", async () => {
            Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1920 });
            Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: 1080 });

            wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });

            const canvas = wrapper.find("canvas").element as HTMLCanvasElement;
            expect(canvas.width).toBe(1920);
            expect(canvas.height).toBe(1080);
        });

        it("updates canvas dimensions on window resize", async () => {
            Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1920 });
            Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: 1080 });

            wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });

            Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1280 });
            Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: 720 });
            window.dispatchEvent(new Event("resize"));
            await wrapper.vm.$nextTick();

            const canvas = wrapper.find("canvas").element as HTMLCanvasElement;
            expect(canvas.width).toBe(1280);
            expect(canvas.height).toBe(720);
        });

        it("adds resize event listener on mount", async () => {
            const spy = vi.spyOn(window, "addEventListener");
            wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });

            expect(spy).toHaveBeenCalledWith("resize", expect.any(Function));
        });

        it("removes resize event listener on unmount", async () => {
            const spy = vi.spyOn(window, "removeEventListener");
            wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });
            await wrapper.unmount();

            expect(spy).toHaveBeenCalledWith("resize", expect.any(Function));
        });

        // it("cancels animation frame on unmount", async () => {
        //     wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });
        //     await wrapper.unmount();
        //
        //     expect(window.cancelAnimationFrame).toHaveBeenCalled();
        // });

        it("starts the animation loop on mount", async () => {
            wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });

            expect(window.requestAnimationFrame).toHaveBeenCalled();
        });
    });

    // ── Image Loading ─────────────────────────────────────────────────────────

    describe("Image Loading", () => {
        it("loads exactly 3 images on mount (peak, natural, industrial)", async () => {
            wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });

            expect(MockImage.instances.length).toBe(3);
        });

        it("sets correct src for peak image", async () => {
            wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });

            expect(MockImage.instances[0].src).toBe("/tori.png");
        });

        it("sets correct src for natural image", async () => {
            wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });

            expect(MockImage.instances[1].src).toBe("/nature.png");
        });

        it("sets correct src for industrial image", async () => {
            wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });

            expect(MockImage.instances[2].src).toBe("/factory.png");
        });
    });

    // ── Drawing Operations ────────────────────────────────────────────────────

    describe("Drawing Operations", () => {
        it("clears the full canvas on each draw", async () => {
            wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });
            mockContext.clearHistory();

            wrapper.vm.draw();

            const calls = mockContext.getCallsByMethod("clearRect");
            expect(calls.length).toBe(1);
            expect(calls[0].args).toEqual([0, 0, expect.any(Number), expect.any(Number)]);
        });

        it("calls beginPath once per visible cell with a known type", async () => {
            const cellTypes = new Map<string, CellTypeKey>([
                ["cell1", "peak"],
                ["cell2", "natural"],
            ]);
            wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: ["cell1"] });
            mockContext.clearHistory();

            wrapper.vm.draw();

            expect(mockContext.getCallsByMethod("beginPath").length).toBe(1);
        });

        it("calls drawImage once per visible cell with a known type", async () => {
            const cellTypes = new Map<string, CellTypeKey>([
                ["cell1", "peak"],
                ["cell2", "natural"],
            ]);
            wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: ["cell1"] });
            mockContext.clearHistory();

            wrapper.vm.draw();

            expect(mockContext.getCallsByMethod("drawImage").length).toBe(1);
        });

        it("calls stroke once per visible cell with a known type", async () => {
            const cellTypes = new Map<string, CellTypeKey>([
                ["cell1", "peak"],
                ["cell2", "natural"],
            ]);
            wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: ["cell1"] });
            mockContext.clearHistory();

            wrapper.vm.draw();

            expect(mockContext.getCallsByMethod("stroke").length).toBe(1);
        });

        it("skips cells whose type is not in cellTypes", async () => {
            // cell1 is visible but has no entry in cellTypes
            const cellTypes = new Map<string, CellTypeKey>();
            wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: ["cell1"] });
            mockContext.clearHistory();

            wrapper.vm.draw();

            expect(mockContext.getCallsByMethod("beginPath").length).toBe(0);
            expect(mockContext.getCallsByMethod("stroke").length).toBe(0);
            expect(mockContext.getCallsByMethod("drawImage").length).toBe(0);
        });

        it("skips cells with an empty h3 boundary (invalid cell)", async () => {
            const cellTypes = new Map<string, CellTypeKey>([["invalid", "peak"]]);
            wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: ["invalid"] });
            mockContext.clearHistory();

            wrapper.vm.draw();

            expect(mockContext.getCallsByMethod("beginPath").length).toBe(0);
            expect(mockContext.getCallsByMethod("stroke").length).toBe(0);
            expect(mockContext.getCallsByMethod("drawImage").length).toBe(0);
        });

        it("draws N markers for N visible cells with known types", async () => {
            const cellTypes = new Map<string, CellTypeKey>([
                ["cell1", "peak"],
                ["cell2", "natural"],
                ["cell3", "industrial"],
            ]);
            wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: ["cell1", "cell2", "cell3"] });
            mockContext.clearHistory();

            wrapper.vm.draw();

            expect(mockContext.getCallsByMethod("beginPath").length).toBe(3);
            expect(mockContext.getCallsByMethod("drawImage").length).toBe(3);
        });

        it("only draws cells listed in visibleCells, not all cells in cellTypes", async () => {
            // cellTypes has 2 entries but only cell1 is visible
            const cellTypes = new Map<string, CellTypeKey>([
                ["cell1", "peak"],
                ["cell2", "natural"],
            ]);
            wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: ["cell1"] });
            mockContext.clearHistory();

            wrapper.vm.draw();

            expect(mockContext.getCallsByMethod("beginPath").length).toBe(1);
        });

        it("scales the marker image size correctly based on zoom", async () => {
            mockMap.getZoom.mockReturnValue(16);
            const cellTypes = new Map<string, CellTypeKey>([["cell1", "peak"]]);
            wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: ["cell1"] });
            mockContext.clearHistory();

            wrapper.vm.draw();

            const drawImageCalls = mockContext.getCallsByMethod("drawImage");
            expect(drawImageCalls.length).toBe(1);

            const expectedSize = 12 * Math.pow(2, 16 - 13); // 96
            // args: [image, x, y, width, height]
            expect(drawImageCalls[0].args[3]).toBe(expectedSize);
            expect(drawImageCalls[0].args[4]).toBe(expectedSize);
        });

        it("does not draw when map is undefined", async () => {
            const cellTypes = new Map<string, CellTypeKey>([["cell1", "peak"]]);
            wrapper = await mountOverlay({ map: undefined, cellTypes, visibleCells: ["cell1"] });
            mockContext.clearHistory();

            wrapper.vm.draw();

            expect(mockContext.getCallsByMethod("clearRect").length).toBe(0);
        });

        it("does not draw when canvas context is unavailable", async () => {
            HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);
            const cellTypes = new Map<string, CellTypeKey>([["cell1", "peak"]]);
            wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: ["cell1"] });
            mockContext.clearHistory();

            wrapper.vm.draw();

            expect(mockContext.getCallsByMethod("clearRect").length).toBe(0);
        });
    });

    // ── Cell Type Rendering ───────────────────────────────────────────────────

    describe("Cell Type Rendering", () => {
        it("draws the peak image (instances[0]) for a peak cell", async () => {
            const cellTypes = new Map<string, CellTypeKey>([["cell1", "peak"]]);
            wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: ["cell1"] });
            mockContext.clearHistory();

            wrapper.vm.draw();

            const drawImageCalls = mockContext.getCallsByMethod("drawImage");
            expect(drawImageCalls.length).toBe(1);
            expect(drawImageCalls[0].args[0]).toStrictEqual(MockImage.instances[0]);
        });

        it("draws the natural image (instances[1]) for a natural cell", async () => {
            const cellTypes = new Map<string, CellTypeKey>([["cell1", "natural"]]);
            wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: ["cell1"] });
            mockContext.clearHistory();

            wrapper.vm.draw();

            const drawImageCalls = mockContext.getCallsByMethod("drawImage");
            expect(drawImageCalls.length).toBe(1);
            expect(drawImageCalls[0].args[0]).toStrictEqual(MockImage.instances[1]);
        });

        it("draws the industrial image (instances[2]) for an industrial cell", async () => {
            const cellTypes = new Map<string, CellTypeKey>([["cell1", "industrial"]]);
            wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: ["cell1"] });
            mockContext.clearHistory();

            wrapper.vm.draw();

            const drawImageCalls = mockContext.getCallsByMethod("drawImage");
            expect(drawImageCalls.length).toBe(1);
            expect(drawImageCalls[0].args[0]).toStrictEqual(MockImage.instances[2]);
        });

        it("handles multiple cells with different types", async () => {
            const cellTypes = new Map<string, CellTypeKey>([
                ["cell1", "peak"],
                ["cell2", "natural"],
                ["cell3", "industrial"],
            ]);

            wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: ["cell1", "cell2", "cell3"] });
            mockContext.clearHistory();

            wrapper.vm.draw();

            expect(mockContext.getCallsByMethod("beginPath").length).toBe(3);
            expect(mockContext.getCallsByMethod("drawImage").length).toBe(3);
        });
    });

    // ── Reactivity ────────────────────────────────────────────────────────────

    describe("Reactivity", () => {
        it("redraws when visibleCells changes", async () => {
            const cellTypes = new Map<string, CellTypeKey>([["cell1", "peak"]]);
            wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: [] });
            mockContext.clearHistory();

            await wrapper.setProps({ visibleCells: ["cell1"] });
            await wrapper.vm.$nextTick();

            // watch triggers exactly one draw() with one cell
            expect(mockContext.getCallsByMethod("beginPath").length).toBe(1);
        });

        it("does NOT redraws when ONLY cellTypes changes", async () => {
            wrapper = await mountOverlay({
                map: mockMap,
                cellTypes: new Map<string, CellTypeKey>([["cell1", "peak"]]),
                visibleCells: [],
            });
            mockContext.clearHistory();

            const newCellTypes = new Map<string, CellTypeKey>([["cell2", "natural"]]);
            await wrapper.setProps({ cellTypes: newCellTypes, visibleCells: ["cell1"] });
            await wrapper.vm.$nextTick();

            expect(mockContext.getCallsByMethod("beginPath").length).toBe(0);
        });

        it("redraws when cellTypes and visibleCells change together", async () => {
            wrapper = await mountOverlay({
                map: mockMap,
                cellTypes: new Map<string, CellTypeKey>([["cell1", "peak"]]),
                visibleCells: [],
            });
            mockContext.clearHistory();

            const newCellTypes = new Map<string, CellTypeKey>([["cell2", "natural"]]);
            await wrapper.setProps({ cellTypes: newCellTypes, visibleCells: ["cell2"] });
            await wrapper.vm.$nextTick();

            expect(mockContext.getCallsByMethod("beginPath").length).toBe(1);
        });

        it("clears markers when visibleCells becomes empty", async () => {
            const cellTypes = new Map<string, CellTypeKey>([["cell1", "peak"]]);
            wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: ["cell1"] });
            mockContext.clearHistory();

            await wrapper.setProps({ visibleCells: [] });
            await wrapper.vm.$nextTick();

            // draw() is called but no cells to render
            expect(mockContext.getCallsByMethod("clearRect").length).toBe(1);
            expect(mockContext.getCallsByMethod("beginPath").length).toBe(0);
        });
    });

    // ── Manual Draw ───────────────────────────────────────────────────────────

    describe("Manual Draw Method", () => {
        it("clears and redraws when called manually", async () => {
            wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });
            mockContext.clearHistory();

            wrapper.vm.draw();

            expect(mockContext.getCallsByMethod("clearRect").length).toBe(1);
        });

        it("does nothing without map", async () => {
            const cellTypes = new Map<string, CellTypeKey>([["cell1", "peak"]]);
            wrapper = await mountOverlay({ map: undefined, cellTypes, visibleCells: ["cell1"] });
            mockContext.clearHistory();

            wrapper.vm.draw();

            expect(mockContext.getCallsByMethod("beginPath").length).toBe(0);
            expect(mockContext.getCallsByMethod("clearRect").length).toBe(0);
        });

        it("does nothing without context", async () => {
            HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);
            wrapper = await mountOverlay({
                map: mockMap,
                cellTypes: new Map<string, CellTypeKey>([["cell1", "peak"]]),
                visibleCells: ["cell1"],
            });
            mockContext.clearHistory();

            wrapper.vm.draw();

            expect(mockContext.getCallsByMethod("clearRect").length).toBe(0);
        });
    });
});
