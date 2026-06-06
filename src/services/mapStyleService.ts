/**
 * mapStyleService.ts — Persists and retrieves the user's preferred map style.
 * Does not own: map rendering, overlay theming, or authentication state.
 */

export type MapStyle = 'standard' | 'ukiyo-e' | 'ukiyo-toner';

const STYLE_KEY = 'kishin_map_style';
const DEFAULT_STYLE: MapStyle = 'ukiyo-toner';

const VALID_STYLES = new Set<string>(['standard', 'ukiyo-e', 'ukiyo-toner']);

/**
 * Persist the active map style to localStorage.
 *
 * @param style - The map style to save.
 */
export function saveMapStyle(style: MapStyle): void {
    localStorage.setItem(STYLE_KEY, style);
}

/**
 * Load the persisted map style from localStorage.
 *
 * @returns The stored style, or the default if none is saved or the value is unrecognised.
 */
export function loadMapStyle(): MapStyle {
    const stored = localStorage.getItem(STYLE_KEY);
    return VALID_STYLES.has(stored ?? '') ? (stored as MapStyle) : DEFAULT_STYLE;
}

/**
 * Map a MapStyle value to a CSS theme class name used by the controls panel and login page.
 *
 * @param style - The active map style.
 * @returns `'theme-ukiyo'` for any ukiyo-e variant, `'theme-standard'` otherwise.
 */
export function styleToThemeClass(style: MapStyle): 'theme-standard' | 'theme-ukiyo' {
    return style === 'standard' ? 'theme-standard' : 'theme-ukiyo';
}
