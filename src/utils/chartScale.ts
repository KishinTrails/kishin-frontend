/**
 * chartScale.ts — Linear scales and tick values for the hand-written SVG charts. Plain
 * functions, testable without a DOM.
 * Does not own: drawing, colours or labels.
 */

/** A linear map from a data domain to a pixel range. */
export interface LinearScale {
    (value: number): number;
    domain: [number, number];
}

/**
 * A linear scale. A domain of zero width maps every value to the middle of the range.
 *
 * @param domain - Smallest and largest data value
 * @param range - Pixel positions of the two ends
 * @returns The scale function
 */
export function linearScale(domain: [number, number], range: [number, number]): LinearScale {
    const [d0, d1] = domain;
    const [r0, r1] = range;
    const scale = ((value: number) =>
        d1 === d0 ? (r0 + r1) / 2 : r0 + ((value - d0) / (d1 - d0)) * (r1 - r0)) as LinearScale;
    scale.domain = domain;
    return scale;
}

/**
 * Round tick values covering `[min, max]`: steps of 1, 2 or 5 times a power of ten, about
 * `count` of them.
 *
 * @param min - Smallest value
 * @param max - Largest value
 * @param count - Wanted number of intervals; defaults to 4
 * @returns The ticks, ascending, the first at or below `min` and the last at or above `max`
 */
export function niceTicks(min: number, max: number, count = 4): number[] {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
    if (min === max) {
        const pad = min === 0 ? 1 : Math.abs(min) * 0.1;
        min -= pad;
        max += pad;
    }
    const rough = (max - min) / count;
    const power = 10 ** Math.floor(Math.log10(rough));
    const fraction = rough / power;
    const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;

    const first = Math.floor(min / step) * step;
    const last = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let tick = first; tick <= last + step / 2; tick += step) {
        ticks.push(Number(tick.toPrecision(12)));
    }
    return ticks;
}

/**
 * The smallest and largest finite number in a list.
 *
 * @param values - Numbers, nulls ignored
 * @returns `[min, max]`, or null when no number is present
 */
export function extent(values: (number | null | undefined)[]): [number, number] | null {
    let min = Infinity;
    let max = -Infinity;
    for (const value of values) {
        if (value === null || value === undefined || !Number.isFinite(value)) continue;
        if (value < min) min = value;
        if (value > max) max = value;
    }
    return min === Infinity ? null : [min, max];
}
