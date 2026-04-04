import { mount, VueWrapper } from "@vue/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import FogOverlay from "@/components/FogOverlay.vue";
import { MockHTMLCanvasElement, MockCanvasRenderingContext2D } from "@/__mocks__/canvas";

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

vi.mock("@/utils/color", () => ({
    hexToRgba: vi.fn((hex: string, alpha: number) => `rgba(${hex}, ${alpha})`),
}));

describe("FogOverlay", () => {
    let mockMap: any;
    let mockCanvas: MockHTMLCanvasElement;
    let mockContext: MockCanvasRenderingContext2D;
    let wrapper: VueWrapper<any>;

    beforeEach(() => {
        mockMap = {
            project: vi.fn((coord: [number, number]) => ({
                x: coord[0] * 1000,
                y: coord[1] * 1000,
            })),
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

        vi.spyOn(window, "requestAnimationFrame").mockImplementation(
            (callback: FrameRequestCallback) => {
                setTimeout(() => callback(0), 16);
                return 0;
            }
        );

        vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});

        Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
            configurable: true,
            value: 800,
        });

        Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
            configurable: true,
            value: 600,
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
        mockContext.clearHistory();
    });

    describe("Rendering", () => {
        it("renders canvas element", () => {
            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: ["test-cell"],
                },
            });

            expect(wrapper.find("canvas").exists()).toBe(true);
            expect(wrapper.find("canvas.fog-overlay").exists()).toBe(true);
        });

        it("applies default props", () => {
            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: [],
                },
            });

            expect(wrapper.props("opacity")).toBe(0.85);
            expect(wrapper.props("color")).toBe("#1a1a1a");
        });

        it("accepts custom opacity", () => {
            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: [],
                    opacity: 0.5,
                },
            });

            expect(wrapper.props("opacity")).toBe(0.5);
        });

        it("accepts custom color", () => {
            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: [],
                    color: "#ff0000",
                },
            });

            expect(wrapper.props("color")).toBe("#ff0000");
        });

        it("exposes draw method", () => {
            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: [],
                },
            });

            expect(typeof wrapper.vm.draw).toBe("function");
        });
    });

    describe("Canvas Initialization", () => {
        it("gets 2d context on mount", async () => {
            const getContextSpy = vi.fn().mockReturnValue(mockContext);
            HTMLCanvasElement.prototype.getContext = getContextSpy;

            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: [],
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

            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: [],
                },
            });

            await wrapper.vm.$nextTick();

            const canvasElement = wrapper.find("canvas").element as HTMLCanvasElement;
            expect(canvasElement.width).toBe(1920);
            expect(canvasElement.height).toBe(1080);
        });

        it("adds resize event listener on mount", async () => {
            const addEventListenerSpy = vi.spyOn(window, "addEventListener");

            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: [],
                },
            });

            await wrapper.vm.$nextTick();

            expect(addEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));
        });

        it("removes resize event listener on unmount", async () => {
            const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: [],
                },
            });

            await wrapper.vm.$nextTick();
            await wrapper.unmount();

            expect(removeEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));
        });

        it("cancels animation frame on unmount", async () => {
            const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame");
            let capturedFrameId: number = 0;
            let frameCounter = 1;

            vi.spyOn(window, "requestAnimationFrame").mockImplementation(
                (callback: FrameRequestCallback) => {
                    const id = frameCounter++;
                    setTimeout(() => callback(0), 16);
                    if (!capturedFrameId) {
                        capturedFrameId = id;
                    }
                    return id;
                }
            );

            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: [],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));
            await wrapper.unmount();

            expect(cancelAnimationFrameSpy).toHaveBeenCalled();
        });
    });

    describe("Drawing Operations", () => {
        it("clears canvas when drawing", async () => {
            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: [],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const clearRectCalls = mockContext.getCallsByMethod("clearRect");
            expect(clearRectCalls.length).toBeGreaterThan(0);
        });

        it("fills canvas with background color", async () => {
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

            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: [],
                    color: "#1a1a1a",
                    opacity: 0.85,
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const fillRectCalls = mockContext.getCallsByMethod("fillRect");
            expect(fillRectCalls.length).toBeGreaterThan(0);
            expect(fillRectCalls[0].args).toEqual([0, 0, 1920, 1080]);
        });

        it("sets fillStyle with hexToRgba conversion", async () => {
            const { hexToRgba } = await import("@/utils/color");

            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: [],
                    color: "#1a1a1a",
                    opacity: 0.85,
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(hexToRgba).toHaveBeenCalledWith("#1a1a1a", 0.85);
        });

        it("uses destination-out composite operation", async () => {
            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: ["test-cell"],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(mockContext.globalCompositeOperation).toBe("destination-out");
        });

        it("saves and restores context state", async () => {
            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: [],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const saveCalls = mockContext.getCallsByMethod("save");
            const restoreCalls = mockContext.getCallsByMethod("restore");
            expect(saveCalls.length).toBeGreaterThan(0);
            expect(restoreCalls.length).toBeGreaterThan(0);
        });
    });

    describe("H3 Cell Drawing", () => {
        it("draws H3 cells from cells prop", async () => {
            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: ["test-cell"],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const beginPathCalls = mockContext.getCallsByMethod("beginPath");
            expect(beginPathCalls.length).toBeGreaterThan(1);
        });

        it("projects H3 cell coordinates using map", async () => {
            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: ["test-cell"],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(mockMap.project).toHaveBeenCalledWith([3.1, 45.75]);
            expect(mockMap.project).toHaveBeenCalledWith([3.1, 45.76]);
            expect(mockMap.project).toHaveBeenCalledWith([3.11, 45.76]);
            expect(mockMap.project).toHaveBeenCalledWith([3.11, 45.75]);
        });

        it("calls moveTo and lineTo for cell boundaries", async () => {
            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: ["test-cell"],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const moveToCalls = mockContext.getCallsByMethod("moveTo");
            const lineToCalls = mockContext.getCallsByMethod("lineTo");
            expect(moveToCalls.length).toBeGreaterThan(0);
            expect(lineToCalls.length).toBeGreaterThan(0);
        });

        it("closes path after drawing cell boundary", async () => {
            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: ["test-cell"],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const closePathCalls = mockContext.getCallsByMethod("closePath");
            expect(closePathCalls.length).toBeGreaterThan(0);
        });

        it("fills cell with black color", async () => {
            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: ["test-cell"],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const fillCalls = mockContext.getCallsByMethod("fill");
            expect(fillCalls.length).toBeGreaterThan(0);
        });

        it("skips invalid cells with empty boundary", async () => {
            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: ["invalid"],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const allCalls = mockContext.getCallHistory();
            const beginPathCalls = mockContext.getCallsByMethod("beginPath");
            const fillCalls = mockContext.getCallsByMethod("fill");
            const moveToCalls = mockContext.getCallsByMethod("moveTo");
            const lineToCalls = mockContext.getCallsByMethod("lineTo");
            
            expect(beginPathCalls.length).toBe(0);
            expect(fillCalls.length).toBe(0);
            expect(moveToCalls.length).toBe(0);
            expect(lineToCalls.length).toBe(0);
        });

        it("draws multiple cells", async () => {
            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: ["test-cell-1", "test-cell-2"],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const beginPathCalls = mockContext.getCallsByMethod("beginPath");
            expect(beginPathCalls.length).toBeGreaterThan(2);
        });
    });

    describe("Reactivity", () => {
        it("redraws when cells prop changes", async () => {
            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: [],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));
            mockContext.clearHistory();

            await wrapper.setProps({ cells: ["new-cell"] });
            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const beginPathCalls = mockContext.getCallsByMethod("beginPath");
            expect(beginPathCalls.length).toBeGreaterThan(0);
        });

        it("redraws when opacity changes", async () => {
            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: [],
                    opacity: 0.5,
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));
            mockContext.clearHistory();

            await wrapper.setProps({ opacity: 0.75 });
            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const fillRectCalls = mockContext.getCallsByMethod("fillRect");
            expect(fillRectCalls.length).toBeGreaterThan(0);
        });

        it("redraws when color changes", async () => {
            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: [],
                    color: "#000000",
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));
            mockContext.clearHistory();

            await wrapper.setProps({ color: "#ffffff" });
            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const fillRectCalls = mockContext.getCallsByMethod("fillRect");
            expect(fillRectCalls.length).toBeGreaterThan(0);
        });

        it("redraws when map changes", async () => {
            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: [],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));
            mockContext.clearHistory();

            const newMap = {
                project: vi.fn((coord: [number, number]) => ({
                    x: coord[0] * 2000,
                    y: coord[1] * 2000,
                })),
            };

            await wrapper.setProps({ map: newMap });
            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 50));

            const fillRectCalls = mockContext.getCallsByMethod("fillRect");
            expect(fillRectCalls.length).toBeGreaterThan(0);
        });
    });

    describe("Animation", () => {
        it("starts animation loop on mount", async () => {
            const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame");

            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: [],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(requestAnimationFrameSpy).toHaveBeenCalled();
        });

        it("continues animation loop with multiple frames", async () => {
            let frameCount = 0;
            vi.spyOn(window, "requestAnimationFrame").mockImplementation(
                (callback: FrameRequestCallback) => {
                    frameCount++;
                    if (frameCount <= 3) {
                        setTimeout(() => callback(0), 16);
                    }
                    return frameCount;
                }
            );

            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: [],
                },
            });

            await wrapper.vm.$nextTick();
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(frameCount).toBeGreaterThan(1);
        });
    });

    describe("Resize Handling", () => {
        it("updates canvas dimensions on window resize", async () => {
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

            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: [],
                },
            });

            await wrapper.vm.$nextTick();

            const canvasElement = wrapper.find("canvas").element as HTMLCanvasElement;
            expect(canvasElement.width).toBe(1920);
            expect(canvasElement.height).toBe(1080);

            Object.defineProperty(window, "innerWidth", {
                writable: true,
                configurable: true,
                value: 1280,
            });
            Object.defineProperty(window, "innerHeight", {
                writable: true,
                configurable: true,
                value: 720,
            });

            window.dispatchEvent(new Event("resize"));
            await wrapper.vm.$nextTick();

            expect(canvasElement.width).toBe(1280);
            expect(canvasElement.height).toBe(720);
        });
    });

    describe("Manual Draw Method", () => {
        it("can be called manually to trigger redraw", async () => {
            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: [],
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
            wrapper = mount(FogOverlay, {
                props: {
                    map: undefined,
                    cells: ["test-cell"],
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

            wrapper = mount(FogOverlay, {
                props: {
                    map: mockMap,
                    cells: ["test-cell"],
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
