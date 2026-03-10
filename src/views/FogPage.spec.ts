import { mount } from "@vue/test-utils";
import { describe, expect, test, vi, beforeEach } from "vitest";
import FogPage from "./FogPage.vue";
import * as h3 from "h3-js";

vi.mock("maplibregl", () => ({
    default: vi.fn().mockImplementation(() => ({
        on: vi.fn(),
        addControl: vi.fn(),
        project: vi.fn().mockReturnValue({ x: 100, y: 100 }),
        resize: vi.fn(),
        remove: vi.fn(),
    })),
    NavigationControl: vi.fn(),
}));

vi.mock("@ionic/vue", () => ({
    IonPage: {
        name: "IonPage",
        template: "<div><slot /></div>",
    },
    IonContent: {
        name: "IonContent",
        template: "<div><slot /></div>",
    },
    IonRange: {
        name: "IonRange",
        template: '<input type="range" />',
        props: ["modelValue"],
    },
}));

describe("FogPage.vue", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("renders map container and fog canvas", () => {
        const wrapper = mount(FogPage);

        expect(wrapper.find(".map-container").exists()).toBe(true);
        expect(wrapper.find(".map").exists()).toBe(true);
        expect(wrapper.find(".fog-overlay").exists()).toBe(true);
        expect(wrapper.find("canvas.fog-overlay").exists()).toBe(true);
    });

    test("renders fog of war controls", () => {
        const wrapper = mount(FogPage);

        expect(wrapper.find(".controls").exists()).toBe(true);
        expect(wrapper.text()).toContain("Fog of War");
    });

    test("renders fog opacity slider", () => {
        const wrapper = mount(FogPage);

        const opacityControl = wrapper.findAll(".control-group").find((el: any) => el.text().includes("Fog Opacity"));
        expect(opacityControl).toBeDefined();
    });

    test("renders visible cells stat", () => {
        const wrapper = mount(FogPage);

        expect(wrapper.text()).toContain("Visible Cells:");
    });

    test("has correct initial fog opacity value", () => {
        const wrapper = mount(FogPage) as any;
        const vm = wrapper.vm;

        expect(vm.fogOpacity).toBe(0.85);
    });

    test("has hardcoded H3 cells defined", () => {
        const wrapper = mount(FogPage) as any;
        const vm = wrapper.vm;

        expect(vm.h3Cells).toBeDefined();
        expect(Array.isArray(vm.h3Cells)).toBe(true);
        expect(vm.h3Cells.length).toBeGreaterThan(0);
    });

    test("visible cells array exists", () => {
        const wrapper = mount(FogPage) as any;
        const vm = wrapper.vm;

        expect(vm.visibleCells).toBeDefined();
        expect(Array.isArray(vm.visibleCells)).toBe(true);
    });

    test("fog color defaults to dark", () => {
        const wrapper = mount(FogPage) as any;
        const vm = wrapper.vm;

        expect(vm.fogColor).toBe("#1a1a1a");
    });

    test("processH3Cells returns only resolution 10 cells", () => {
        const wrapper = mount(FogPage) as any;
        const vm = wrapper.vm;

        const baseCell = "8a1fb4644077fff";
        const mixedResCells = [
            "871fb4670ffffff", // res 7
            "881fb47597fffff", // res 8
            h3.cellToParent(baseCell, 9),
            baseCell,
        ];

        vm.h3Cells = mixedResCells;
        vm.processH3Cells();

        expect(vm.visibleCells.length).toBe(399); // 7**3 + 7**2 + 7 = 399 --> baseCell should not be counted twice.

        vm.visibleCells.forEach((cell: string) => {
            expect(h3.getResolution(cell)).toBe(10);
        });
    });

    test("hardcoded cells are valid H3 indexes", () => {
        const wrapper = mount(FogPage) as any;
        const vm = wrapper.vm;

        vm.h3Cells.forEach((cell: string) => {
            const boundary = h3.cellToBoundary(cell);
            expect(boundary.length).toBeGreaterThan(0);
        });
    });

    test("visible cells can produce valid boundaries for drawing", () => {
        const wrapper = mount(FogPage) as any;
        const vm = wrapper.vm;

        vm.processH3Cells();

        vm.visibleCells.forEach((cell: string) => {
            const boundary = h3.cellToBoundary(cell);
            expect(Array.isArray(boundary)).toBe(true);
            expect(boundary.length).toBeGreaterThanOrEqual(3);

            boundary.forEach((coord: number[]) => {
                expect(coord).toHaveLength(2);
                expect(coord[0]).toBeGreaterThanOrEqual(-90);
                expect(coord[0]).toBeLessThanOrEqual(90);
                expect(coord[1]).toBeGreaterThanOrEqual(-180);
                expect(coord[1]).toBeLessThanOrEqual(180);
            });
        });
    });
});

