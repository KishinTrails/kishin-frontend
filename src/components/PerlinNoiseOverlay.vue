<script setup lang="ts">
/**
 * Perlin noise overlay component.
 *
 * Fetches server-side Perlin noise values for each S2 cell currently visible
 * in the map viewport and highlights those that exceed `threshold` by drawing
 * their outlines in red. The canvas is rendered at a reduced resolution
 * (`RES` fraction of the viewport) and scaled up via CSS to improve
 * performance on large viewports.
 *
 * The overlay re-fetches noise values on every map move event, which causes
 * frequent API calls while panning — callers should enable this overlay
 * sparingly or wire it to a user-facing toggle.
 */
import { ref, watch, onMounted, onUnmounted } from 'vue';
import maplibregl from 'maplibre-gl';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { cellsFromBounds, cellToToken, cellToVertices, tokenToCell } from '@/utils/s2Utils';
import { fetchNoiseForCells } from '../services/noiseService';

interface Props {
  /** MapLibre GL map instance used for viewport queries and event subscriptions. */
  map?: MaplibreMap;
  /** Spatial frequency of the noise function passed to the API. */
  scale?: number;
  /** Noise value above which a cell is considered "active" and drawn. */
  threshold?: number;
  /** Number of fractal octaves passed to the noise API. */
  octaves?: number;
  /** Amplitude reduction factor per octave passed to the noise API. */
  amplitudeDecay?: number;
}

const props = withDefaults(defineProps<Props>(), {
  map: undefined,
  scale: 50,
  threshold: 0.5,
  octaves: 3,
  amplitudeDecay: 0.5,
});

const emit = defineEmits<{
  /** Emitted after each update with the count of cells whose noise exceeds `threshold`. */
  activeCellsChange: [count: number];
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);

/** Set of S2 cell tokens whose noise value currently exceeds `props.threshold`. */
const activeCells = ref<Set<string>>(new Set());

/**
 * Fetch noise values for all S2 cells in the current viewport and update
 * `activeCells` with those that exceed `props.threshold`.
 *
 * Emits `activeCellsChange` with the new active cell count after each update.
 * Returns immediately if the map is not yet available.
 */
const updateActiveCells = async () => {
  if (!props.map) return;

  const bounds = props.map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();

  const cellIds = cellsFromBounds(
    { lat: sw.lat, lng: sw.lng },
    { lat: ne.lat, lng: ne.lng },
  );

  const tokens = cellIds.map(cellToToken);

  const noiseMap = await fetchNoiseForCells(
    tokens,
    props.scale,
    props.octaves,
    props.amplitudeDecay,
  );

  const newActiveCells = new Set<string>();
  for (const [cell, noise] of noiseMap.entries()) {
    if (noise > props.threshold) {
      newActiveCells.add(cell);
    }
  }

  activeCells.value = newActiveCells;
  emit('activeCellsChange', newActiveCells.size);
};

/**
 * Internal canvas resolution scale factor.
 *
 * The canvas pixel dimensions are `RES` × viewport dimensions. The canvas is
 * stretched to full viewport size in CSS, trading sharpness for performance.
 * A value of 0.25 means the canvas is 1/4 resolution in each dimension.
 */
const RES = 0.25;

/**
 * Render one frame of the noise overlay.
 *
 * Triggers an async `updateActiveCells` call (result applied on the next
 * frame) then immediately draws the current `activeCells` set so the overlay
 * stays responsive during panning. Uses Mercator coordinate projection to
 * match maplibre's rendering pipeline.
 */
const draw = () => {
  if (!ctx.value || !canvas.value || !props.map) return;

  const m = props.map;
  const { width, height } = canvas.value;
  const c = ctx.value;

  c.clearRect(0, 0, width, height);

  updateActiveCells().catch(console.warn);

  if (activeCells.value.size === 0) return;

  const nw = m.unproject([0, 0]);
  const se = m.unproject([window.innerWidth, window.innerHeight]);

  const nwM = maplibregl.MercatorCoordinate.fromLngLat(nw);
  const seM = maplibregl.MercatorCoordinate.fromLngLat(se);

  const spanX = seM.x - nwM.x;
  const spanY = seM.y - nwM.y;

  c.strokeStyle = 'red';
  c.lineWidth = 2;
  c.beginPath();

  for (const token of activeCells.value) {
    let vertices: Array<{ lat: number; lng: number }>;
    try {
      vertices = cellToVertices(tokenToCell(token));
    } catch {
      continue;
    }

    let firstPoint = true;

    for (const { lat, lng } of vertices) {
      const mercator = maplibregl.MercatorCoordinate.fromLngLat({ lng, lat });

      const screenX = ((mercator.x - nwM.x) / spanX) * width;
      const screenY = ((mercator.y - nwM.y) / spanY) * height;

      if (firstPoint) {
        c.moveTo(screenX, screenY);
        firstPoint = false;
      } else {
        c.lineTo(screenX, screenY);
      }
    }

    c.closePath();
  }

  c.stroke();
};

/**
 * Resize the backing canvas to `RES` × the current viewport dimensions and redraw.
 *
 * Called on mount and whenever the browser window is resized.
 */
const resize = () => {
  if (!canvas.value) return;
  canvas.value.width = Math.floor(window.innerWidth * RES);
  canvas.value.height = Math.floor(window.innerHeight * RES);
  draw();
};

watch(() => props.map, (m, old) => {
  if (old) old.off('move', draw);
  if (m) {
    m.on('move', draw);
    draw();
  }
}, { immediate: true });

watch(() => [props.scale, props.threshold, props.octaves, props.amplitudeDecay], () => {
  draw();
});

onMounted(() => {
  ctx.value = canvas.value!.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
});

onUnmounted(() => {
  props.map?.off('move', draw);
  window.removeEventListener('resize', resize);
});
</script>

<template>
  <canvas
    ref="canvas"
    class="perlin-noise-overlay"
  />
</template>

<style scoped>
.perlin-noise-overlay {
  position: absolute;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  pointer-events: none;
  /* This makes the small picture look smooth when stretched to full size */
  image-rendering: auto;
}
</style>
