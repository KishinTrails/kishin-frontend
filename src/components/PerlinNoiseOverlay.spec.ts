import { mount, VueWrapper } from "@vue/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import PerlinNoiseOverlay from "@/components/PerlinNoiseOverlay.vue";
import { MockHTMLCanvasElement, MockCanvasRenderingContext2D } from "@/__mocks__/canvas";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/utils/s2Utils", () => {
    const degreeVertices = [
        { lat: 45.75, lng: 3.1 },
        { lat: 45.76, lng: 3.1 },
        { lat: 45.76, lng: 3.11 },
        { lat: 45.75, lng: 3.11 },
    ];
    return {
        cellsFromBounds: vi.fn().mockReturnValue([1n, 2n, 3n]),
        cellToToken: vi.fn().mockImplementation((id: bigint) => `cell${id}`),
        cellToVertices: vi.fn().mockReturnValue(degreeVertices),
        tokenToCell: vi.fn().mockImplementation((token: string) => token),
    };
});

vi.mock("../services/noiseService", () => ({
    fetchNoiseForCells: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("maplibre-gl", () => ({
    default: {
        MercatorCoordinate: {
            fromLngLat: vi.fn().mockImplementation(({ lng, lat }: { lng: number; lat: number }) => ({
                x: lng / 360 + 0.5,
                y: 0.5 - lat / 180,
            })),
        },
    },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { fetchNoiseForCells } from "../services/noiseService";
import { cellsFromBounds, cellToToken, cellToVertices, tokenToCell } from "@/utils/s2Utils";

const wait = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

function makeMockMap(overrides: Partial<any> = {}): any {
    return {
        getBounds: vi.fn().mockReturnValue({
            getSouthWest: () => ({ lat: 45.75, lng: 3.09 }),
            getNorthEast: () => ({ lat: 45.76, lng: 3.11 }),
        }),
        unproject: vi.fn().mockImplementation(([x, y]: [number, number]) => ({ lng: x / 10, lat: y / 10 })),
        on: vi.fn(),
        off: vi.fn(),
        ...overrides,
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PerlinNoiseOverlay", () => {
    let mockMap: any;
    let mockCanvas: MockHTMLCanvasElement;
    let mockContext: MockCanvasRenderingContext2D;
    let wrapper: VueWrapper<any>;

    beforeEach(() => {
        mockMap = makeMockMap();
        mockCanvas = new MockHTMLCanvasElement();
        mockContext = mockCanvas.getMockContext()!;

        (HTMLCanvasElement.prototype.getContext as any) = function (contextType: string): any {
            return contextType === "2d" ? mockContext : null;
        };

        Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 800 });
        Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: 600 });

        vi.mocked(fetchNoiseForCells).mockResolvedValue(new Map());
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.restoreAllMocks();
        mockContext.clearHistory();
        wrapper?.unmount();
    });

    // ── Rendering ──────────────────────────────────────────────────────────────

    describe("Rendering", () => {
        it("renders a canvas element", () => {
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap } });

            expect(wrapper.find("canvas").exists()).toBe(true);
            expect(wrapper.find("canvas.perlin-noise-overlay").exists()).toBe(true);
        });

        it("applies default props", () => {
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap } });

            expect(wrapper.props("scale")).toBe(50);
            expect(wrapper.props("threshold")).toBe(0.5);
            expect(wrapper.props("octaves")).toBe(3);
            expect(wrapper.props("amplitudeDecay")).toBe(0.5);
        });

        it("accepts custom scale", () => {
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap, scale: 100 } });

            expect(wrapper.props("scale")).toBe(100);
        });

        it("accepts custom threshold", () => {
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap, threshold: 0.7 } });

            expect(wrapper.props("threshold")).toBe(0.7);
        });

        it("accepts custom octaves", () => {
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap, octaves: 5 } });

            expect(wrapper.props("octaves")).toBe(5);
        });

        it("accepts custom amplitudeDecay", () => {
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap, amplitudeDecay: 0.7 } });

            expect(wrapper.props("amplitudeDecay")).toBe(0.7);
        });
    });

    // ── Canvas Initialization ──────────────────────────────────────────────────

    describe("Canvas Initialization", () => {
        it("gets 2d context on mount", async () => {
            const getContextSpy = vi.fn().mockReturnValue(mockContext);
            HTMLCanvasElement.prototype.getContext = getContextSpy;

            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap } });
            await wrapper.vm.$nextTick();

            expect(getContextSpy).toHaveBeenCalledWith("2d");
        });

        it("resizes canvas to fraction of window dimensions on mount", async () => {
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap } });
            await wrapper.vm.$nextTick();

            const canvasElement = wrapper.find("canvas").element as HTMLCanvasElement;
            // RES = 0.25
            expect(canvasElement.width).toBe(Math.floor(800 * 0.25));
            expect(canvasElement.height).toBe(Math.floor(600 * 0.25));
        });

        it("adds resize event listener on mount", async () => {
            const addEventListenerSpy = vi.spyOn(window, "addEventListener");
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap } });
            await wrapper.vm.$nextTick();

            expect(addEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));
        });

        it("removes resize event listener on unmount", async () => {
            const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap } });
            await wrapper.vm.$nextTick();
            await wrapper.unmount();

            expect(removeEventListenerSpy).toHaveBeenCalledWith("resize", expect.any(Function));
        });

        it("updates canvas dimensions on window resize", async () => {
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap } });
            await wrapper.vm.$nextTick();

            Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1280 });
            Object.defineProperty(window, "innerHeight", { writable: true, configurable: true, value: 720 });
            window.dispatchEvent(new Event("resize"));
            await wrapper.vm.$nextTick();

            const canvasElement = wrapper.find("canvas").element as HTMLCanvasElement;
            expect(canvasElement.width).toBe(Math.floor(1280 * 0.25));
            expect(canvasElement.height).toBe(Math.floor(720 * 0.25));
        });
    });

    // ── Map Integration ────────────────────────────────────────────────────────

    describe("Map Integration", () => {
        it("registers move listener on map when provided", async () => {
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap } });
            await wrapper.vm.$nextTick();

            expect(mockMap.on).toHaveBeenCalledWith("move", expect.any(Function));
        });

        it("removes move listener from old map when map prop changes", async () => {
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap } });
            await wrapper.vm.$nextTick();

            const newMap = makeMockMap();
            await wrapper.setProps({ map: newMap });
            await wrapper.vm.$nextTick();

            expect(mockMap.off).toHaveBeenCalledWith("move", expect.any(Function));
            expect(newMap.on).toHaveBeenCalledWith("move", expect.any(Function));
        });

        it("removes move listener on unmount", async () => {
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap } });
            await wrapper.vm.$nextTick();
            await wrapper.unmount();

            expect(mockMap.off).toHaveBeenCalledWith("move", expect.any(Function));
        });

        it("does nothing without map", async () => {
            wrapper = mount(PerlinNoiseOverlay, { props: { map: undefined } });
            await wrapper.vm.$nextTick();
            mockContext.clearHistory();

            const clearRectCalls = mockContext.getCallsByMethod("clearRect");
            expect(clearRectCalls.length).toBe(0);
        });
    });

    // ── Drawing Operations ─────────────────────────────────────────────────────

    describe("Drawing Operations", () => {
        it("clears canvas on each draw", async () => {
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap } });
            await wrapper.vm.$nextTick();
            await wait();

            expect(mockContext.getCallsByMethod("clearRect").length).toBeGreaterThan(0);
        });

        it("does not draw cells when no active cells", async () => {
            vi.mocked(fetchNoiseForCells).mockResolvedValue(new Map());
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap } });
            await wrapper.vm.$nextTick();
            await wait();

            expect(mockContext.getCallsByMethod("stroke").length).toBe(0);
        });

        it("draws active cells using stroke", async () => {
            vi.mocked(fetchNoiseForCells).mockResolvedValue(new Map([["cell1", 0.9]]));
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap, threshold: 0.5 } });
            await wrapper.vm.$nextTick();
            await wait(100); // let updateActiveCells resolve
            wrapper.vm.draw(); // trigger draw with populated activeCells

            expect(mockContext.getCallsByMethod("stroke").length).toBeGreaterThan(0);
        });

        it("uses red stroke for active cells", async () => {
            vi.mocked(fetchNoiseForCells).mockResolvedValue(new Map([["cell1", 0.9]]));
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap, threshold: 0.5 } });
            await wrapper.vm.$nextTick();
            await wait(100);
            wrapper.vm.draw();

            expect(mockContext.strokeStyle).toBe("red");
        });

        it("calls moveTo and lineTo for active cell vertices", async () => {
            vi.mocked(fetchNoiseForCells).mockResolvedValue(new Map([["cell1", 0.9]]));
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap, threshold: 0.5 } });
            await wrapper.vm.$nextTick();
            await wait(100);
            wrapper.vm.draw();

            expect(mockContext.getCallsByMethod("moveTo").length).toBeGreaterThan(0);
            expect(mockContext.getCallsByMethod("lineTo").length).toBeGreaterThan(0);
        });

        it("closes path after each cell", async () => {
            vi.mocked(fetchNoiseForCells).mockResolvedValue(new Map([["cell1", 0.9]]));
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap, threshold: 0.5 } });
            await wrapper.vm.$nextTick();
            await wait(100);
            wrapper.vm.draw();

            expect(mockContext.getCallsByMethod("closePath").length).toBeGreaterThan(0);
        });

        it("skips cells where cellToVertices throws", async () => {
            vi.mocked(fetchNoiseForCells).mockResolvedValue(
                new Map([
                    ["bad-cell", 0.9],
                    ["good-cell", 0.9],
                ]),
            );
            vi.mocked(cellToVertices).mockImplementationOnce(() => {
                throw new Error("invalid token");
            });
            const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap, threshold: 0.5 } });
            await wrapper.vm.$nextTick();
            await wait(100);
            wrapper.vm.draw();

            expect(mockContext.getCallsByMethod("stroke").length).toBeGreaterThan(0);
            consoleWarnSpy.mockRestore();
        });
    });

    // ── Noise Fetching ─────────────────────────────────────────────────────────

    describe("Noise Fetching", () => {
        it("fetches noise for visible cells using map bounds", async () => {
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap } });
            await wrapper.vm.$nextTick();
            await wait();

            expect(fetchNoiseForCells).toHaveBeenCalledWith(
                expect.any(Array),
                expect.any(Number),
                expect.any(Number),
                expect.any(Number),
            );
        });

        it("passes scale, octaves, amplitudeDecay to fetchNoiseForCells", async () => {
            wrapper = mount(PerlinNoiseOverlay, {
                props: { map: mockMap, scale: 100, octaves: 5, amplitudeDecay: 0.7 },
            });
            await wrapper.vm.$nextTick();
            await wait();

            expect(fetchNoiseForCells).toHaveBeenCalledWith(expect.any(Array), 100, 5, 0.7);
        });

        it("only marks cells above threshold as active", async () => {
            vi.mocked(fetchNoiseForCells).mockResolvedValue(
                new Map([
                    ["cell1", 0.8],
                    ["cell2", 0.3],
                    ["cell3", 0.6],
                ]),
            );
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap, threshold: 0.5 } });
            await wrapper.vm.$nextTick();
            await wait(100);

            const emitted = wrapper.emitted("activeCellsChange");
            expect(emitted).toBeTruthy();
            const lastCount = emitted![emitted!.length - 1][0] as number;
            expect(lastCount).toBe(2);
        });

        it("uses cellsFromBounds with map bounds", async () => {
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap } });
            await wrapper.vm.$nextTick();
            await wait();

            expect(cellsFromBounds).toHaveBeenCalledWith({ lat: 45.75, lng: 3.09 }, { lat: 45.76, lng: 3.11 });
        });

        it("passes tokens (not bigints) to fetchNoiseForCells", async () => {
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap } });
            await wrapper.vm.$nextTick();
            await wait();

            const calls = vi.mocked(fetchNoiseForCells).mock.calls;
            expect(calls.length).toBeGreaterThan(0);
            const tokens = calls[0][0];
            for (const token of tokens) {
                expect(typeof token).toBe("string");
            }
        });
    });

    // ── activeCellsChange emit ─────────────────────────────────────────────────

    describe("activeCellsChange emit", () => {
        it("emits activeCellsChange with 0 when no cells exceed threshold", async () => {
            vi.mocked(fetchNoiseForCells).mockResolvedValue(new Map([["cell1", 0.1]]));
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap, threshold: 0.5 } });
            await wrapper.vm.$nextTick();
            await wait(100);

            const emitted = wrapper.emitted("activeCellsChange");
            expect(emitted).toBeTruthy();
            const lastCount = emitted![emitted!.length - 1][0] as number;
            expect(lastCount).toBe(0);
        });

        it("emits activeCellsChange with correct count", async () => {
            vi.mocked(fetchNoiseForCells).mockResolvedValue(
                new Map([
                    ["cell1", 0.9],
                    ["cell2", 0.8],
                    ["cell3", 0.2],
                ]),
            );
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap, threshold: 0.5 } });
            await wrapper.vm.$nextTick();
            await wait(100);

            const emitted = wrapper.emitted("activeCellsChange");
            const lastCount = emitted![emitted!.length - 1][0] as number;
            expect(lastCount).toBe(2);
        });
    });

    // ── Reactivity ─────────────────────────────────────────────────────────────

    describe("Reactivity", () => {
        it("redraws when scale changes", async () => {
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap, scale: 50 } });
            await wrapper.vm.$nextTick();
            await wait();
            const callsBefore = vi.mocked(fetchNoiseForCells).mock.calls.length;

            await wrapper.setProps({ scale: 100 });
            await wrapper.vm.$nextTick();
            await wait();

            expect(vi.mocked(fetchNoiseForCells).mock.calls.length).toBeGreaterThan(callsBefore);
        });

        it("redraws when threshold changes", async () => {
            vi.mocked(fetchNoiseForCells).mockResolvedValue(new Map([["cell1", 0.6]]));
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap, threshold: 0.8 } });
            await wrapper.vm.$nextTick();
            await wait(100);
            mockContext.clearHistory();

            await wrapper.setProps({ threshold: 0.4 });
            await wrapper.vm.$nextTick();
            await wait(100);

            expect(mockContext.getCallsByMethod("clearRect").length).toBeGreaterThan(0);
        });

        it("redraws when map changes", async () => {
            wrapper = mount(PerlinNoiseOverlay, { props: { map: mockMap } });
            await wrapper.vm.$nextTick();
            await wait();
            mockContext.clearHistory();

            const newMap = makeMockMap();
            await wrapper.setProps({ map: newMap });
            await wrapper.vm.$nextTick();
            await wait();

            expect(mockContext.getCallsByMethod("clearRect").length).toBeGreaterThan(0);
        });
    });
});
