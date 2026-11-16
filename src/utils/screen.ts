/**
 * screen.ts — Whether the window is narrow (a phone, or a phone-sized browser window). On a
 * narrow screen every menu starts closed: the map panel and each of its groups.
 * Does not own: the CSS breakpoints of the pages (AppShell switches its tabs at 640px).
 */

/** Widths below this, in CSS pixels, are narrow. */
export const NARROW_BELOW_PX = 768;

/**
 * Whether the window is narrower than `NARROW_BELOW_PX` when called.
 *
 * @returns True on a narrow window
 */
export const isNarrowScreen = (): boolean => window.innerWidth < NARROW_BELOW_PX;
