/**
 * ukiyoE.ts — MapLibre GL style specification for the ukiyo-e (woodblock print) map theme.
 *
 * Uses OpenFreeMap vector tiles (OpenMapTiles schema, no API key required).
 * Palette: washi paper, sumi ink, prussian blue, moss green, ochre.
 *
 * Does not own: fog overlay, POI overlay, or any canvas-based rendering.
 */

import type { StyleSpecification } from "maplibre-gl";

/** Ukiyo-e colour palette */
const C = {
    paper: "#E8D5A3", // washi paper — background and road fill
    ink: "#1A2B4D", // sumi ink    — roads, outlines, text
    blue: "#4A6B8A", // prussian blue — water
    green: "#5B7A5B", // moss green  — forest, parks
    greenLt: "#7A9A6A", // light moss  — grass, farmland
    ochre: "#8B6914", // ochre       — paths, sand, buildings
    shadow: "#B4A07A", // parchment shadow — residential areas, building fill
    paperDk: "#D4BF90", // darker paper — landuse areas
};

export const ukiyoEStyle: StyleSpecification = {
    version: 8,
    name: "Ukiyo-e",
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sprite: "https://tiles.openfreemap.org/sprites/ofm_f384/ofm",
    sources: {
        openmaptiles: {
            type: "vector",
            url: "https://tiles.openfreemap.org/planet",
        },
    },
    layers: [
        // ── Background ────────────────────────────────────────────────────────────
        {
            id: "background",
            type: "background",
            paint: { "background-color": C.paper },
        },

        // ── Landcover ─────────────────────────────────────────────────────────────
        {
            id: "landcover_grass",
            type: "fill",
            source: "openmaptiles",
            "source-layer": "landcover",
            filter: ["in", "class", "grass", "farmland", "crop"],
            paint: { "fill-color": C.greenLt, "fill-opacity": 0.4 },
        },
        {
            id: "landcover_wood",
            type: "fill",
            source: "openmaptiles",
            "source-layer": "landcover",
            filter: ["in", "class", "wood", "wetland"],
            paint: { "fill-color": C.green, "fill-opacity": 0.55 },
        },
        {
            id: "landcover_sand",
            type: "fill",
            source: "openmaptiles",
            "source-layer": "landcover",
            filter: ["==", "class", "sand"],
            paint: { "fill-color": C.ochre, "fill-opacity": 0.3 },
        },

        // ── Landuse ───────────────────────────────────────────────────────────────
        {
            id: "landuse_residential",
            type: "fill",
            source: "openmaptiles",
            "source-layer": "landuse",
            filter: ["in", "class", "residential", "suburb", "neighbourhood"],
            paint: { "fill-color": C.paperDk, "fill-opacity": 0.5 },
        },
        {
            id: "landuse_commercial",
            type: "fill",
            source: "openmaptiles",
            "source-layer": "landuse",
            filter: ["in", "class", "commercial", "retail", "industrial"],
            paint: { "fill-color": C.shadow, "fill-opacity": 0.4 },
        },

        // ── Parks ─────────────────────────────────────────────────────────────────
        {
            id: "park",
            type: "fill",
            source: "openmaptiles",
            "source-layer": "park",
            paint: { "fill-color": C.green, "fill-opacity": 0.35 },
        },
        {
            id: "park_outline",
            type: "line",
            source: "openmaptiles",
            "source-layer": "park",
            paint: { "line-color": C.green, "line-width": 0.75, "line-opacity": 0.7 },
        },

        // ── Water ─────────────────────────────────────────────────────────────────
        {
            id: "water",
            type: "fill",
            source: "openmaptiles",
            "source-layer": "water",
            paint: { "fill-color": C.blue },
        },
        {
            id: "waterway_river",
            type: "line",
            source: "openmaptiles",
            "source-layer": "waterway",
            filter: ["in", "class", "river", "canal"],
            paint: {
                "line-color": C.blue,
                "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 14, 2, 18, 4],
            },
        },
        {
            id: "waterway_other",
            type: "line",
            source: "openmaptiles",
            "source-layer": "waterway",
            filter: ["in", "class", "stream", "drain", "ditch"],
            paint: { "line-color": C.blue, "line-width": 0.75, "line-opacity": 0.7 },
        },

        // ── Buildings ─────────────────────────────────────────────────────────────
        {
            id: "building",
            type: "fill",
            source: "openmaptiles",
            "source-layer": "building",
            minzoom: 14,
            paint: { "fill-color": C.shadow, "fill-outline-color": C.ochre, "fill-opacity": 0.7 },
        },

        // ── Roads — casings (ink outline) ─────────────────────────────────────────
        {
            id: "road_motorway_casing",
            type: "line",
            source: "openmaptiles",
            "source-layer": "transportation",
            filter: ["in", "class", "motorway", "trunk"],
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
                "line-color": C.ink,
                "line-width": ["interpolate", ["linear"], ["zoom"], 8, 2.5, 14, 8, 18, 14],
            },
        },
        {
            id: "road_primary_casing",
            type: "line",
            source: "openmaptiles",
            "source-layer": "transportation",
            filter: ["==", "class", "primary"],
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
                "line-color": C.ink,
                "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2, 14, 6, 18, 10],
            },
        },
        {
            id: "road_secondary_casing",
            type: "line",
            source: "openmaptiles",
            "source-layer": "transportation",
            filter: ["in", "class", "secondary", "tertiary"],
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
                "line-color": C.ink,
                "line-width": ["interpolate", ["linear"], ["zoom"], 11, 1, 14, 4, 18, 8],
            },
        },

        // ── Roads — fill (paper interior) ─────────────────────────────────────────
        {
            id: "road_motorway",
            type: "line",
            source: "openmaptiles",
            "source-layer": "transportation",
            filter: ["in", "class", "motorway", "trunk"],
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
                "line-color": C.paper,
                "line-width": ["interpolate", ["linear"], ["zoom"], 8, 1, 14, 5, 18, 10],
            },
        },
        {
            id: "road_primary",
            type: "line",
            source: "openmaptiles",
            "source-layer": "transportation",
            filter: ["==", "class", "primary"],
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
                "line-color": C.paper,
                "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 14, 3.5, 18, 7],
            },
        },
        {
            id: "road_secondary",
            type: "line",
            source: "openmaptiles",
            "source-layer": "transportation",
            filter: ["in", "class", "secondary", "tertiary"],
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
                "line-color": C.ink,
                "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.5, 14, 2, 18, 5],
                "line-opacity": 0.7,
            },
        },
        {
            id: "road_minor",
            type: "line",
            source: "openmaptiles",
            "source-layer": "transportation",
            filter: ["in", "class", "minor", "service"],
            minzoom: 13,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
                "line-color": C.ink,
                "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.5, 18, 3],
                "line-opacity": 0.5,
            },
        },
        {
            id: "road_path",
            type: "line",
            source: "openmaptiles",
            "source-layer": "transportation",
            filter: ["in", "class", "path", "track", "pedestrian"],
            minzoom: 13,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
                "line-color": C.ochre,
                "line-width": 1,
                "line-dasharray": [3, 2],
                "line-opacity": 0.8,
            },
        },

        // ── Labels ────────────────────────────────────────────────────────────────
        {
            id: "water_name",
            type: "symbol",
            source: "openmaptiles",
            "source-layer": "water_name",
            layout: {
                "text-field": ["get", "name"],
                "text-font": ["Noto Sans Italic"],
                "text-size": 11,
            },
            paint: {
                "text-color": C.paper,
                "text-halo-color": C.blue,
                "text-halo-width": 1,
            },
        },
        {
            id: "road_label",
            type: "symbol",
            source: "openmaptiles",
            "source-layer": "transportation_name",
            minzoom: 14,
            layout: {
                "text-field": ["get", "name"],
                "text-font": ["Noto Sans Regular"],
                "text-size": 10,
                "symbol-placement": "line",
                "text-max-angle": 30,
            },
            paint: {
                "text-color": C.ink,
                "text-halo-color": C.paper,
                "text-halo-width": 1.5,
            },
        },
        {
            id: "place_village",
            type: "symbol",
            source: "openmaptiles",
            "source-layer": "place",
            filter: ["in", "class", "village", "hamlet", "suburb"],
            minzoom: 12,
            layout: {
                "text-field": ["get", "name"],
                "text-font": ["Noto Sans Regular"],
                "text-size": 11,
            },
            paint: {
                "text-color": C.ink,
                "text-halo-color": C.paper,
                "text-halo-width": 1.5,
            },
        },
        {
            id: "place_town",
            type: "symbol",
            source: "openmaptiles",
            "source-layer": "place",
            filter: ["==", "class", "town"],
            layout: {
                "text-field": ["get", "name"],
                "text-font": ["Noto Sans Bold"],
                "text-size": 13,
            },
            paint: {
                "text-color": C.ink,
                "text-halo-color": C.paper,
                "text-halo-width": 2,
            },
        },
        {
            id: "place_city",
            type: "symbol",
            source: "openmaptiles",
            "source-layer": "place",
            filter: ["in", "class", "city"],
            layout: {
                "text-field": ["get", "name"],
                "text-font": ["Noto Sans Bold"],
                "text-size": ["interpolate", ["linear"], ["zoom"], 8, 12, 14, 18],
                "text-anchor": "center",
            },
            paint: {
                "text-color": C.ink,
                "text-halo-color": C.paper,
                "text-halo-width": 2,
            },
        },
    ],
};
