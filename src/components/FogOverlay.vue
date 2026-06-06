<template>
  <!-- Canvas is only used in gradient mode; flat mode renders via a MapLibre fill layer. -->
  <canvas
    v-show="fogMode === 'gradient'"
    ref="canvas"
    class="fog-overlay"
  />
</template>

<script setup lang="ts">
/**
 * Fog overlay component for rendering unexplored map areas.
 *
 * Two rendering modes:
 *  - flat     — headless; a MapLibre `fill` layer covers the world with a
 *               GeoJSON Polygon whose interior rings are explored S2 cells,
 *               punching transparent holes through the fog natively in WebGL.
 *  - gradient — canvas-based; a radial gradient centred on the player fades
 *               outward, with explored cells erased via `destination-out`.
 *
 * Switching fogMode tears down the inactive path and sets up the active one.
 * Both paths share a vertex cache so S2 geometry is computed at most once per
 * cell token across the component's lifetime.
 */

import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { tokenToCell, cellToVertices } from '@/utils/s2Utils';
import { hexToRgba } from '@/utils/color';
import type { Map as MaplibreMap, GeoJSONSource } from 'maplibre-gl';
import type { Feature, Polygon } from 'geojson';

interface Props {
  /** MapLibre GL map instance. */
  map?: MaplibreMap;
  /** S2 cell tokens representing explored areas (punched out of the fog). */
  exploredCells?: string[];
  /** Fog opacity (0–1). */
  opacity?: number;
  /** Fog base colour as a hex string. */
  color?: string;
  /** Player position — gradient mode centres the fade here. */
  playerPosition?: { lat: number; lng: number };
  /** Gradient mode visibility radius in kilometres. */
  fogRadiusKm?: number;
  /** 'flat' uses a MapLibre layer; 'gradient' uses a canvas radial gradient. */
  fogMode?: 'flat' | 'gradient';
}

const props = withDefaults(defineProps<Props>(), {
  map: undefined,
  exploredCells: () => [],
  opacity: 1,
  color: '#1a1a1a',
  playerPosition: undefined,
  fogRadiusKm: 0.5,
  fogMode: 'gradient',
});

// ─── Shared: vertex cache ──────────────────────────────────────────────────

/** Cached lat/lng vertices per cell token — S2 geometry never changes. */
const vertexCache = new Map<string, Array<{ lat: number; lng: number }>>();

function getVertices(token: string): Array<{ lat: number; lng: number }> | null {
  if (vertexCache.has(token)) return vertexCache.get(token)!;
  try {
    const verts = cellToVertices(tokenToCell(token));
    vertexCache.set(token, verts);
    return verts;
  } catch {
    return null;
  }
}

// ─── Flat mode: MapLibre polygon-with-holes ────────────────────────────────

const FOG_SOURCE_ID = 'fog-mask';
const FOG_LAYER_ID  = 'fog-flat-fill';

/**
 * World-covering outer ring in CCW winding (GeoJSON spec for exterior rings).
 * Clamped to Web Mercator latitude bounds to avoid projection artifacts.
 */
const WORLD_RING: [number, number][] = [
  [-180, -85.051129],
  [ 180, -85.051129],
  [ 180,  85.051129],
  [-180,  85.051129],
  [-180, -85.051129],
];

/**
 * Builds the fog GeoJSON: a single Polygon whose outer ring covers the world
 * and whose interior rings are explored S2 cells (holes revealing the map).
 *
 * S2 vertices are CCW; interior rings (holes) require CW winding per RFC 7946,
 * so each cell ring is reversed before being added.
 */
function buildFogGeoJSON(exploredCells: string[]): Feature<Polygon> {
  const holes: [number, number][][] = [];

  for (const token of exploredCells) {
    const verts = getVertices(token);
    if (!verts) continue;

    // S2 vertices are CCW; reverse to CW for interior ring (hole).
    const ring = verts.map(v => [v.lng, v.lat] as [number, number]);
    ring.reverse();
    ring.push(ring[0]); // close the ring
    holes.push(ring);
  }

  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [WORLD_RING, ...holes] },
    properties: {},
  };
}

function updateFlatSource(map: MaplibreMap): void {
  const src = map.getSource(FOG_SOURCE_ID) as GeoJSONSource | undefined;
  src?.setData(buildFogGeoJSON(props.exploredCells ?? []));
}

async function setupFlatLayers(map: MaplibreMap): Promise<void> {
  if (!map.getSource(FOG_SOURCE_ID)) {
    map.addSource(FOG_SOURCE_ID, {
      type: 'geojson',
      data: buildFogGeoJSON(props.exploredCells ?? []),
    });
  }

  if (!map.getLayer(FOG_LAYER_ID)) {
    map.addLayer({
      id: FOG_LAYER_ID,
      type: 'fill',
      source: FOG_SOURCE_ID,
      paint: {
        'fill-color':         props.color,
        'fill-opacity':       props.opacity,
        'fill-outline-color': 'rgba(0, 0, 0, 0)',
      },
    });
  }
}

function teardownFlatLayers(map: MaplibreMap): void {
  if (map.getLayer(FOG_LAYER_ID))   map.removeLayer(FOG_LAYER_ID);
  if (map.getSource(FOG_SOURCE_ID)) map.removeSource(FOG_SOURCE_ID);
}

// ─── Gradient mode: canvas ─────────────────────────────────────────────────

const canvas = ref<HTMLCanvasElement | null>(null);
const ctx    = ref<CanvasRenderingContext2D | null>(null);

const resizeCanvas = (): void => {
  if (!canvas.value) return;
  canvas.value.width  = canvas.value.clientWidth;
  canvas.value.height = canvas.value.clientHeight;
};

/**
 * Traces the S2 cell outline onto the canvas context, filling with opaque
 * black. Used with `destination-out` composite to punch holes in the fog.
 */
const drawS2Cell = (c: CanvasRenderingContext2D, token: string): void => {
  if (!props.map || typeof props.map.project !== 'function') return;

  const verts = getVertices(token);
  if (!verts) {
    console.warn(`[FogOverlay] Invalid S2 cell token: ${token}`);
    return;
  }

  c.beginPath();
  for (let i = 0; i < verts.length; i++) {
    const { x, y } = props.map.project([verts[i].lng, verts[i].lat]);
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.closePath();
  c.fillStyle = 'rgba(0, 0, 0, 1)';
  c.fill();
};

const drawFlat = (c: CanvasRenderingContext2D, w: number, h: number): void => {
  c.fillStyle = hexToRgba(props.color, props.opacity);
  c.fillRect(0, 0, w, h);
};

const drawGradientFill = (c: CanvasRenderingContext2D, w: number, h: number): void => {
  if (!props.playerPosition || !props.map) { drawFlat(c, w, h); return; }

  const { x, y } = props.map.project([props.playerPosition.lng, props.playerPosition.lat]);
  const deltaLat = (props.fogRadiusKm ?? 0.5) / 111.32;
  const edge     = props.map.project([props.playerPosition.lng, props.playerPosition.lat + deltaLat]);
  const radiusPx = Math.hypot(edge.x - x, edge.y - y);

  const g = c.createRadialGradient(x, y, 0, x, y, radiusPx);
  g.addColorStop(0,   hexToRgba(props.color, props.opacity * 0.85));
  g.addColorStop(0.3, hexToRgba(props.color, props.opacity * 1));
  g.addColorStop(0.6, hexToRgba(props.color, props.opacity * 1.05));
  g.addColorStop(1,   hexToRgba(props.color, 1));
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
};

/** Renders one gradient-mode frame onto the canvas. */
const draw = (): void => {
  if (!ctx.value || !canvas.value || !props.map || props.fogMode !== 'gradient') return;

  const c = ctx.value;
  const w = canvas.value.width;
  const h = canvas.value.height;

  c.clearRect(0, 0, w, h);
  c.save();
  drawGradientFill(c, w, h);
  c.globalCompositeOperation = 'destination-out';
  for (const cell of (props.exploredCells ?? [])) drawS2Cell(c, cell);
  c.restore();
};

// ─── Style reload ──────────────────────────────────────────────────────────

// setStyle() clears all sources and layers; re-register flat layers afterwards.
// Gradient mode only needs the canvas/render-loop which survives style changes.
const onStyleData = (): void => {
  if (props.map && props.fogMode === 'flat') setupFlatLayers(props.map);
};

// ─── Map prop watcher ──────────────────────────────────────────────────────

watch(
  () => props.map,
  async (map, oldMap) => {
    if (oldMap) {
      oldMap.off('styledata', onStyleData);
      oldMap.off('render', draw);
      teardownFlatLayers(oldMap);
    }
    if (!map) return;
    map.on('styledata', onStyleData);
    if (props.fogMode === 'flat') {
      await setupFlatLayers(map);
    } else {
      resizeCanvas();
      map.on('render', draw);
    }
  },
  { immediate: true },
);

// ─── fogMode switch ────────────────────────────────────────────────────────

watch(
  () => props.fogMode,
  async (mode) => {
    if (!props.map) return;
    if (mode === 'flat') {
      props.map.off('render', draw);
      teardownFlatLayers(props.map); // idempotent if not set up
      await setupFlatLayers(props.map);
    } else {
      teardownFlatLayers(props.map);
      // Canvas is revealed by v-show; wait for layout before resizing.
      await nextTick();
      resizeCanvas();
      props.map.on('render', draw);
    }
  },
);

// ─── Reactive data updates ─────────────────────────────────────────────────

watch(
  () => props.exploredCells,
  () => {
    if (!props.map) return;
    if (props.fogMode === 'flat') updateFlatSource(props.map);
    else draw();
  },
  { deep: true },
);

watch(
  () => [props.opacity, props.color] as const,
  () => {
    if (!props.map) return;
    if (props.fogMode === 'flat') {
      if (props.map.getLayer(FOG_LAYER_ID)) {
        props.map.setPaintProperty(FOG_LAYER_ID, 'fill-opacity', props.opacity);
        props.map.setPaintProperty(FOG_LAYER_ID, 'fill-color', props.color);
      }
    } else {
      draw();
    }
  },
);

watch(
  () => [props.playerPosition, props.fogRadiusKm] as const,
  () => { if (props.fogMode === 'gradient') draw(); },
);

// ─── Lifecycle ─────────────────────────────────────────────────────────────

onMounted(() => {
  if (!canvas.value) return;
  ctx.value = canvas.value.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
});

onUnmounted(() => {
  if (props.map) {
    props.map.off('render', draw);
    props.map.off('styledata', onStyleData);
    teardownFlatLayers(props.map);
  }
  window.removeEventListener('resize', resizeCanvas);
});

defineExpose({ draw });
</script>

<style scoped>
.fog-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}
</style>
