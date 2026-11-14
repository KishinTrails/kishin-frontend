import { describe, it, expect } from "vitest";
import { addDays, buildGrid, longDate, monday, monthLabels, summarise, todayIso, weekday } from "./activityGrid";

describe("activityGrid dates", () => {
    it("shifts days across a month and a daylight-saving change", () => {
        expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
        expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    });

    it("numbers weekdays from Monday", () => {
        expect(weekday("2026-03-02")).toBe(0);
        expect(weekday("2026-03-08")).toBe(6);
        expect(monday("2026-03-08")).toBe("2026-03-02");
    });

    it("writes a long date", () => {
        expect(longDate("2026-03-03")).toBe("Tue 3 Mar 2026");
    });

    it("reads today in local time", () => {
        expect(todayIso(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
    });
});

describe("buildGrid", () => {
    const today = "2026-03-04"; // a Wednesday

    it("has 52 columns of 7 days ending with the week of today", () => {
        const grid = buildGrid([], today);
        expect(grid.columns).toHaveLength(52);
        expect(grid.columns.every((column) => column.length === 7)).toBe(true);
        const last = grid.columns[51]!;
        expect(last[0]!.date).toBe("2026-03-02");
        expect(last.map((cell) => cell.future)).toEqual([false, false, false, true, true, true, true]);
        expect(grid.columns[0]![0]!.date).toBe(addDays("2026-03-02", -51 * 7));
    });

    it("sets levels from the quartiles of the days with a value", () => {
        const days = [1, 2, 3, 4, 100].map((value, index) => ({ date: addDays("2026-02-01", index), value }));
        const cells = buildGrid(days, today).columns.flat();
        const level = (date: string) => cells.find((cell) => cell.date === date)!.level;
        expect([0, 1, 2, 3, 4].map((index) => level(addDays("2026-02-01", index)))).toEqual([1, 1, 2, 3, 4]);
        expect(level("2026-01-01")).toBe(0);
    });

    it("leaves days outside the grid out of the summary", () => {
        const grid = buildGrid(
            [
                { date: "2026-03-01", value: 5 },
                { date: "2026-03-03", value: 8 },
                { date: "2024-01-01", value: 99 },
            ],
            today,
        );
        const summary = summarise(grid);
        expect(summary.total).toBe(13);
        expect(summary.activeDays).toBe(2);
        expect(summary.busiest?.date).toBe("2026-03-03");
    });
});

describe("monthLabels", () => {
    it("labels the first column of each month", () => {
        const labels = monthLabels(buildGrid([], "2026-03-04").columns);
        expect(labels[0]).toBe("Mar"); // 2025-03-10
        expect(labels.filter((label) => label !== null)).toHaveLength(13);
        expect(labels[51]).toBe("Mar");
    });
});
