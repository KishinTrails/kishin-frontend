/**
 * activityGrid.ts — Layout of the calendar grid of activities: 52 weeks by 7 days, Monday on
 * top, each day coloured by one number (km or moving minutes). Plain functions, testable
 * without a DOM. Ported from the same author's inkspire grid, with `words` replaced by `value`.
 *
 * Dates are ISO day strings (`YYYY-MM-DD`). Date arithmetic is done in UTC with
 * `Date.UTC(y, m - 1, d)`, so a daylight-saving change never moves a day.
 * Does not own: fetching the days (see `services/athleteService.ts`) or drawing the grid.
 */

const DAY_MS = 86_400_000;

const WEEKS = 52;
const DAYS_PER_WEEK = 7;

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const parse = (day: string): number => {
    const [y, m, d] = day.split("-").map(Number);
    return Date.UTC(y!, m! - 1, d!);
};

const format = (timestamp: number): string => new Date(timestamp).toISOString().slice(0, 10);

/**
 * The local calendar day of `now`.
 *
 * @param now - The moment; defaults to the current time
 * @returns An ISO day string
 */
export const todayIso = (now = new Date()): string =>
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

/**
 * Shift a day.
 *
 * @param day - ISO day string
 * @param n - Days to add; negative goes back
 * @returns The shifted ISO day string
 */
export const addDays = (day: string, n: number): string => format(parse(day) + n * DAY_MS);

/**
 * The day of the week.
 *
 * @param day - ISO day string
 * @returns Monday = 0 … Sunday = 6
 */
export const weekday = (day: string): number => (new Date(parse(day)).getUTCDay() + 6) % 7;

/**
 * The Monday of the week a day is in.
 *
 * @param day - ISO day string
 * @returns The ISO day string of that Monday
 */
export const monday = (day: string): string => addDays(day, -weekday(day));

/**
 * A day as a reader reads it, written here rather than by `Intl`, whose month abbreviations
 * differ between ICU versions.
 *
 * @param day - ISO day string
 * @returns For example `Tue 3 Mar 2026`
 */
export const longDate = (day: string): string => {
    const [y, m, d] = day.split("-").map(Number);
    return `${DAY_NAMES[weekday(day)]} ${d} ${MONTH_NAMES[m! - 1]} ${y}`;
};

/** A value for one day. */
export interface DayValue {
    date: string;
    value: number;
}

/** One cell of the grid. */
export interface GridCell {
    date: string;
    value: number;
    /** 0 for an empty day, 1 to 4 by the year's own distribution. */
    level: number;
    /** True for a day after `today` in the last column; not drawn. */
    future: boolean;
}

/** The grid: 52 columns of 7 cells, Monday on top. */
export interface Grid {
    columns: GridCell[][];
}

/**
 * Levels from the grid's own distribution: the thresholds are the non-zero days' 25th, 50th and
 * 75th percentile by nearest rank, and a day's level is `1 + (value > t1) + (value > t2) +
 * (value > t3)`. One very large day does not flatten the others.
 */
const applyLevels = (columns: GridCell[][]): void => {
    const cells = columns.flat();
    const sorted = cells.map((cell) => cell.value).filter((value) => value > 0).sort((a, b) => a - b);
    if (sorted.length === 0) return;

    const rank = (fraction: number): number =>
        sorted[Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)]!;
    const thresholds = [rank(0.25), rank(0.5), rank(0.75)];

    for (const cell of cells) {
        if (cell.value > 0) {
            cell.level = 1 + thresholds.filter((threshold) => cell.value > threshold).length;
        }
    }
};

/**
 * Lay out the grid. The last column is the week containing `today`; the first starts 51 weeks
 * before. A day missing from `days` has the value 0.
 *
 * @param days - Values per day
 * @param today - ISO day string of today
 * @returns The 52 columns
 */
export const buildGrid = (days: DayValue[], today: string): Grid => {
    const values = new Map(days.map((day) => [day.date, day.value]));
    const firstMonday = addDays(monday(today), -DAYS_PER_WEEK * (WEEKS - 1));

    const columns: GridCell[][] = [];
    for (let week = 0; week < WEEKS; week++) {
        const column: GridCell[] = [];
        for (let row = 0; row < DAYS_PER_WEEK; row++) {
            const date = addDays(firstMonday, week * DAYS_PER_WEEK + row);
            column.push({ date, value: values.get(date) ?? 0, level: 0, future: date > today });
        }
        columns.push(column);
    }

    applyLevels(columns);
    return { columns };
};

/**
 * The month of each column's Monday, set only where it differs from the previous column's. The
 * first column's label is dropped when the second has one, so two names do not run together.
 *
 * @param columns - The grid's columns
 * @returns One label or null per column
 */
export const monthLabels = (columns: GridCell[][]): (string | null)[] => {
    const months = columns.map((column) => MONTH_NAMES[Number(column[0]!.date.split("-")[1]) - 1]!);
    const labels = months.map((month, index) => (month === months[index - 1] ? null : month));
    if (labels.length > 1 && labels[1] !== null) labels[0] = null;
    return labels;
};

/** The grid's days added up. */
export interface Summary {
    total: number;
    activeDays: number;
    busiest: GridCell | null;
}

/**
 * Add up the days the grid draws.
 *
 * @param grid - The grid
 * @returns The total value, the number of days with a value and the day with the largest one
 */
export const summarise = (grid: Grid): Summary => {
    let total = 0;
    let activeDays = 0;
    let busiest: GridCell | null = null;
    for (const cell of grid.columns.flat()) {
        if (cell.future || cell.value === 0) continue;
        total += cell.value;
        activeDays += 1;
        if (busiest === null || cell.value > busiest.value) busiest = cell;
    }
    return { total, activeDays, busiest };
};
