import { mount, VueWrapper } from "@vue/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import PoiOverlay from "@/components/PoiOverlay.vue";
import { MockHTMLCanvasElement, MockCanvasRenderingContext2D } from "@/__mocks__/canvas";

type CellTypeKey = 'peak' | 'natural' | 'industrial';

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

describe("PoiOverlay", () => {
    let mockMap: any;
    let mockCanvas: MockHTMLCanvasElement;
    let mockContext: MockCanvasRenderingContext2D;
    let wrapper: VueWrapper<any>;

    beforeEach(() => {
        MockImage.clearInstances();

        mockMap = {
            project: vi.fn((coord: [number, number]) => ({
                x: 150,
                y: 75,
            })),
            getZoom: vi.fn(() => 16),
        };

        mockCanvas = new MockHTMLCanvasElement();
        mockContext = mockCanvas.getMockContext()!;

        HTMLCanvasElement.prototype.getContext = function (
            contextType: string
        ): MockCanvasRenderingContext2D | null {
            if (contextType === "2d") {
                return mockContext;
            }
            return null;
        };

        Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
            configurable: true,
            value: 800,
        });

        Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
            configurable: true,
            value: 600,
        });

        vi.stubGlobal("Image", MockImage);
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
        mockContext.clearHistory();
    });

    describe("Rendering", () => {
        it("renders canvas element", () => {
            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes: new Map(),
                    visibleCells: [],
                },
            });

            expect(wrapper.find("canvas").exists()).toBe(true);
            expect(wrapper.find("canvas.poi-overlay").exists()).toBe(true);
        });

        it("applies default props", () => {
            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes: new Map(),
                    visibleCells: [],
                },
            });

            expect(wrapper.props("cellTypes")).toEqual(new Map());
        });

        it("accepts custom cellTypes Map", () => {
            const cellTypes = new Map<string, CellTypeKey>([
                ["cell1", "peak"],
                ["cell2", "natural"],
            ]);

            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes,
                    visibleCells: ["cell1", "cell2"],
                },
            });

            expect(wrapper.props("cellTypes")).toEqual(cellTypes);
        });

        it("renders with map prop", () => {
            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes: new Map(),
                    visibleCells: [],
                },
            });

            expect(wrapper.props("map")).toEqual(mockMap);
        });

        it("exposes draw method", () => {
            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes: new Map(),
                    visibleCells: [],
                },
            });

            expect(typeof wrapper.vm.draw).toBe("function");
        });
    });

    describe("Canvas Initialization", () => {
        it("gets 2d context on mount", async () => {
            const getContextSpy = vi.fn().mockReturnValue(mockContext);
            HTMLCanvasElement.prototype.getContext = getContextSpy;

            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes: new Map(),
                    visibleCells: [],
                },
            });

            await wrapper.vm.$nextTick();

            expect(getContextSpy).toHaveBeenCalledWith("2d");
        });

        it("resizes canvas to window dimensions on mount", async () => {
            Object.defineProperty(window, "innerWidth", {
                writable: true,
                configurable: true,
                value: 1920,
            });
            Object.defineProperty(window, "innerHeight", {
                writable: true,
                configurable: true,
                value: 1080,
            });

            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes: new Map(),
                    visibleCells: [],
                },
            });

            await wrapper.vm.$nextTick();

            const canvasElement = wrapper.find("canvas").element as HTMLCanvasElement;
            expect(canvasElement.width).toBe(1920);
            expect(canvasElement.height).toBe(1080);
        });

        it("adds resize event listener on mount", async () => {
            const addEventListenerSpy = vi.spyOn(window, "addEventListener");

            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes: new Map(),
                    visibleCells: [],
                },
            });

            await wrapper.vm.$nextTick();

            expect(addEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));
        });

        it("removes resize event listener on unmount", async () => {
            const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes: new Map(),
                    visibleCells: [],
                },
            });

            await wrapper.vm.$nextTick();
            await wrapper.unmount();

            expect(removeEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));
        });
    });

    describe("Image Loading", () => {
        it("loads peak image on mount", async () => {
            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes: new Map(),
                    visibleCells: [],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const peakImageInstance = MockImage.instances.find((img, i) => i === 0);
            expect(peakImageInstance).toBeDefined();
        });

        it("loads natural image on mount", async () => {
            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes: new Map(),
                    visibleCells: [],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const naturalImageInstance = MockImage.instances.find((img, i) => i === 1);
            expect(naturalImageInstance).toBeDefined();
        });

        it("loads industrial image on mount", async () => {
            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes: new Map(),
                    visibleCells: [],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const industrialImageInstance = MockImage.instances.find((img, i) => i === 2);
            expect(industrialImageInstance).toBeDefined();
        });

        it("stores images in typeImages object", async () => {
            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes: new Map(),
                    visibleCells: [],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(MockImage.instances.length).toBe(3);
        });
    });

    describe("Drawing Operations", () => {
        it("clears canvas when drawing", async () => {
            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes: new Map(),
                    visibleCells: [],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const clearRectCalls = mockContext.getCallsByMethod("clearRect");
            expect(clearRectCalls.length).toBeGreaterThan(0);
        });

        it("draws POI markers for cells with types", async () => {
            const cellTypes = new Map<string, CellTypeKey>([
                ["cell1", "peak"],
            ]);

            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes,
                    visibleCells: ["cell1"],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const beginPathCalls = mockContext.getCallsByMethod("beginPath");
            expect(beginPathCalls.length).toBeGreaterThan(0);
        });

        it("skips cells without types", async () => {
            const cellTypes = new Map<string, CellTypeKey>([
                ["cell1", "peak"],
            ]);

            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes,
                    visibleCells: [],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const beginPathCalls = mockContext.getCallsByMethod("beginPath");
            expect(beginPathCalls.length).toBe(0);
        });

        it("skips invalid cells with empty boundary", async () => {
            const cellTypes = new Map<string, CellTypeKey>([
                ["invalid", "peak"],
            ]);

            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes,
                    visibleCells: ["invalid"],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const beginPathCalls = mockContext.getCallsByMethod("beginPath");
            const strokeCalls = mockContext.getCallsByMethod("stroke");
            const drawImageCalls = mockContext.getCallsByMethod("drawImage");

            expect(beginPathCalls.length).toBe(0);
            expect(strokeCalls.length).toBe(0);
            expect(drawImageCalls.length).toBe(0);
        });

        it("draws cell boundary strokes", async () => {
            const cellTypes = new Map<string, CellTypeKey>([
                ["cell1", "peak"],
            ]);

            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes,
                    visibleCells: ["cell1"],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const strokeCalls = mockContext.getCallsByMethod("stroke");
            expect(strokeCalls.length).toBeGreaterThan(0);
        });

        it("draws marker images at cell centers", async () => {
            const cellTypes = new Map<string, CellTypeKey>([
                ["cell1", "peak"],
            ]);

            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes,
                    visibleCells: ["cell1"],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const drawImageCalls = mockContext.getCallsByMethod("drawImage");
            expect(drawImageCalls.length).toBeGreaterThan(0);
        });

        it("scales images based on zoom level", async () => {
            const cellTypes = new Map<string, CellTypeKey>([
                ["cell1", "peak"],
            ]);

            mockMap.getZoom = vi.fn(() => 16);

            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes,
                    visibleCells: ["cell1"],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const drawImageCalls = mockContext.getCallsByMethod("drawImage");
            expect(drawImageCalls.length).toBeGreaterThan(0);

            const drawImageCall = drawImageCalls[0];
            const expectedSize = 12 * Math.pow(2, 16 - 13);
            expect(drawImageCall.args[3]).toBe(expectedSize);
            expect(drawImageCall.args[4]).toBe(expectedSize);
        });

        it("clears canvas before drawing", async () => {
            const cellTypes = new Map<string, CellTypeKey>([
                ["cell1", "peak"],
            ]);

            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes,
                    visibleCells: ["cell1"],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const clearRectCalls = mockContext.getCallsByMethod("clearRect");
            expect(clearRectCalls.length).toBeGreaterThan(0);
        });
    });

    describe("Cell Type Rendering", () => {
        it("renders peak markers with tori.png", async () => {
            const cellTypes = new Map<string, CellTypeKey>([
                ["cell1", "peak"],
            ]);

            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes,
                    visibleCells: ["cell1"],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const drawImageCalls = mockContext.getCallsByMethod("drawImage");
            expect(drawImageCalls.length).toBeGreaterThan(0);
        });

        it("renders natural markers with nature.png", async () => {
            const cellTypes = new Map<string, CellTypeKey>([
                ["cell1", "natural"],
            ]);

            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes,
                    visibleCells: ["cell1"],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const drawImageCalls = mockContext.getCallsByMethod("drawImage");
            expect(drawImageCalls.length).toBeGreaterThan(0);
        });

        it("renders industrial markers with factory.png", async () => {
            const cellTypes = new Map<string, CellTypeKey>([
                ["cell1", "industrial"],
            ]);

            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes,
                    visibleCells: ["cell1"],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const drawImageCalls = mockContext.getCallsByMethod("drawImage");
            expect(drawImageCalls.length).toBeGreaterThan(0);
        });

        it("handles multiple cells with different types", async () => {
            const cellTypes = new Map<string, CellTypeKey>([
                ["cell1", "peak"],
                ["cell2", "natural"],
                ["cell3", "industrial"],
            ]);

            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes,
                    visibleCells: ["cell1", "cell2", "cell3"],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const beginPathCalls = mockContext.getCallsByMethod("beginPath");
            expect(beginPathCalls.length).toBe(3);
        });

        it("handles empty cellTypes Map", async () => {
            const cellTypes = new Map<string, CellTypeKey>();

            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes,
                    visibleCells: [],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const beginPathCalls = mockContext.getCallsByMethod("beginPath");
            const drawImageCalls = mockContext.getCallsByMethod("drawImage");

            expect(beginPathCalls.length).toBe(0);
            expect(drawImageCalls.length).toBe(0);
        });
    });

    describe("Reactivity", () => {
        it("redraws when visibleCells changes", async () => {
            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes: new Map([["cell1", "peak"]]),
                    visibleCells: [],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));
            mockContext.clearHistory();

            await wrapper.setProps({ visibleCells: ["cell1"] });
            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const beginPathCalls = mockContext.getCallsByMethod("beginPath");
            expect(beginPathCalls.length).toBeGreaterThan(0);
        });

        it("redraws when cellTypes changes", async () => {
            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes: new Map(),
                    visibleCells: [],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));
            mockContext.clearHistory();

            const newCellTypes = new Map<string, CellTypeKey>([
                ["cell1", "peak"],
            ]);
            await wrapper.setProps({ cellTypes: newCellTypes, visibleCells: ["cell1"] });
            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const beginPathCalls = mockContext.getCallsByMethod("beginPath");
            expect(beginPathCalls.length).toBeGreaterThan(0);
        });

        it("only draws cells in visibleCells", async () => {
            const cellTypes = new Map<string, CellTypeKey>([
                ["cell1", "peak"],
                ["cell2", "natural"],
            ]);

            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes,
                    visibleCells: ["cell1"],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const beginPathCalls = mockContext.getCallsByMethod("beginPath");
            expect(beginPathCalls.length).toBe(1);
        });

        it("does not draw cells not in visibleCells", async () => {
            const cellTypes = new Map<string, CellTypeKey>([
                ["cell1", "peak"],
                ["cell2", "natural"],
            ]);

            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes,
                    visibleCells: [],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const beginPathCalls = mockContext.getCallsByMethod("beginPath");
            expect(beginPathCalls.length).toBe(0);
        });
    });

    describe("Manual Draw Method", () => {
        it("can be called manually to trigger redraw", async () => {
            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes: new Map(),
                    visibleCells: [],
                },
            });

            await wrapper.vm.$nextTick();
            mockContext.clearHistory();

            wrapper.vm.draw();
            await wrapper.vm.$nextTick();

            const clearRectCalls = mockContext.getCallsByMethod("clearRect");
            expect(clearRectCalls.length).toBeGreaterThan(0);
        });

        it("does nothing without map", async () => {
            wrapper = mount(PoiOverlay, {
                props: {
                    map: undefined,
                    cellTypes: new Map([["cell1", "peak"]]),
                    visibleCells: ["cell1"],
                },
            });

            await wrapper.vm.$nextTick();
            mockContext.clearHistory();

            wrapper.vm.draw();
            await wrapper.vm.$nextTick();

            const beginPathCalls = mockContext.getCallsByMethod("beginPath");
            expect(beginPathCalls.length).toBe(0);
        });

        it("does nothing without context", async () => {
            HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);

            wrapper = mount(PoiOverlay, {
                props: {
                    map: mockMap,
                    cellTypes: new Map([["cell1", "peak"]]),
                    visibleCells: ["cell1"],
                },
            });

            await wrapper.vm.$nextTick();
            mockContext.clearHistory();

            wrapper.vm.draw();
            await wrapper.vm.$nextTick();

            const clearRectCalls = mockContext.getCallsByMethod("clearRect");
            expect(clearRectCalls.length).toBe(0);
        });
    });
});
