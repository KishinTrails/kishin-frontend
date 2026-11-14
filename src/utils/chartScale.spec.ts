import { describe, it, expect } from "vitest";
import { extent, linearScale, niceTicks } from "./chartScale";

describe("chartScale", () => {
    it("maps a domain to a range, inverted ranges included", () => {
        const scale = linearScale([0, 10], [100, 0]);
        expect(scale(0)).toBe(100);
        expect(scale(5)).toBe(50);
        expect(scale(10)).toBe(0);
    });

    it("maps a zero-width domain to the middle", () => {
        expect(linearScale([3, 3], [0, 100])(3)).toBe(50);
    });

    it("finds round ticks around the data", () => {
        expect(niceTicks(0, 37)).toEqual([0, 10, 20, 30, 40]);
        expect(niceTicks(21.3, 24.8)).toEqual([21, 22, 23, 24, 25]);
        expect(niceTicks(0, 0.9)).toEqual([0, 0.5, 1]);
        expect(niceTicks(5, 5)).toEqual([4.5, 5, 5.5]);
        expect(niceTicks(NaN, 1)).toEqual([]);
    });

    it("finds the extent of numbers, ignoring nulls", () => {
        expect(extent([3, null, -1, 7, undefined])).toEqual([-1, 7]);
        expect(extent([null])).toBeNull();
    });
});
