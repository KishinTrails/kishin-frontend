<template>
  <canvas
    ref="canvas"
    class="fog-overlay"
  />
</template>

<script setup lang="ts">
/**
 * Fog overlay component for rendering unexplored map areas.
 * Uses S2 cell tokens to determine which regions are unexplored and displays
 * them with a configurable fog effect.
 */

import { ref, watch, onMounted, onUnmounted } from 'vue';
import { tokenToCell, cellToVertices } from '@/utils/s2Utils';
import { hexToRgba } from '@/utils/color';
import type { Map as MaplibreMap } from 'maplibre-gl';

/**
 * Props for the FogOverlay component.
 */
interface Props {
  /** Maplibre map instance for coordinate projection */
  map?: MaplibreMap;
  /** Array of S2 cell tokens representing explored areas (these areas will be clear) */
  exploredCells?: string[];
  /** Opacity of the fog overlay (0-1) */
  opacity?: number;
  /** Base color of the fog overlay as hex string */
  color?: string;
  /** Player position — when set, fog fades from transparent at the player outward */
  playerPosition?: { lat: number; lng: number };
  /** Visibility radius in kilometres — converted to pixels at draw time so it stays geographically fixed across zoom levels */
  fogRadiusKm?: number;
  /** Rendering mode: 'flat' fills the entire canvas uniformly; 'gradient' fades from the player outward */
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

const canvas = ref<HTMLCanvasElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);
const animationFrame = ref<number | null>(null);

/** Resize the backing canvas to match the current viewport. Called on mount and window resize. */
const resizeCanvas = () => {
  if (!canvas.value) return;
  canvas.value.width = window.innerWidth;
  canvas.value.height = window.innerHeight;
};

/**
 * Trace the outline of a single S2 cell onto the canvas context.
 *
 * When `fill` is true the cell is filled with opaque black. Combined with
 * `destination-out` composite mode in `draw()`, this punches a transparent
 * hole through the fog layer to reveal the explored area beneath.
 *
 * @param c     - Canvas 2D rendering context to draw on.
 * @param token - Hex token identifying the S2 cell to draw.
 * @param fill  - When true, fill the cell shape (default: false, outline only).
 */
const drawS2Cell = (c: CanvasRenderingContext2D, token: string, fill: boolean = false) => {
  if (!props.map || typeof props.map.project !== 'function') return;

  let vertices: Array<{ lat: number; lng: number }>;
  try {
    vertices = cellToVertices(tokenToCell(token));
  } catch (err) {
    console.warn(`[FogOverlay] Invalid S2 cell token: ${token}`, err);
    return;
  }

  c.beginPath();

  for (let i = 0; i < vertices.length; i++) {
    const point = props.map!.project([vertices[i].lng, vertices[i].lat]);
    if (i === 0) {
      c.moveTo(point.x, point.y);
    } else {
      c.lineTo(point.x, point.y);
    }
  }

  c.closePath();

  if (fill) {
    c.fillStyle = 'rgba(0, 0, 0, 1)';
    c.fill();
  }
};

/**
 * Fill the canvas with a uniform flat fog, then punch explored cells.
 *
 * @param c      - Canvas 2D rendering context.
 * @param width  - Canvas width in pixels.
 * @param height - Canvas height in pixels.
 */
const drawFlat = (c: CanvasRenderingContext2D, width: number, height: number) => {
  c.fillStyle = hexToRgba(props.color, props.opacity * 0.85);
  c.fillRect(0, 0, width, height);
};

/**
 * Fill the canvas with a radial gradient centered on the player (or map center),
 * fading from transparent at the center to full opacity at `fogRadiusKm`.
 *
 * @param c - Canvas 2D rendering context.
 * @param width  - Canvas width in pixels.
 * @param height - Canvas height in pixels.
 */
const drawGradient = (c: CanvasRenderingContext2D, width: number, height: number) => {
  if (!props.playerPosition || !props.map) {
    drawFlat(c, width, height);
    return;
  }

  const { x, y } = props.map.project([props.playerPosition.lng, props.playerPosition.lat]);

  // Convert km radius to pixels by projecting a point fogRadiusKm north.
  // Recomputed every frame so the circle stays geographically fixed across zoom levels.
  const deltaLat = props.fogRadiusKm / 111.32;
  const edge = props.map.project([props.playerPosition.lng, props.playerPosition.lat + deltaLat]);
  const radiusPx = Math.hypot(edge.x - x, edge.y - y);

  const gradient = c.createRadialGradient(x, y, 0, x, y, radiusPx);
  gradient.addColorStop(0,    hexToRgba(props.color, props.opacity * 0.75));
  gradient.addColorStop(0.3,  hexToRgba(props.color, props.opacity * 0.85));
  gradient.addColorStop(0.6,  hexToRgba(props.color, props.opacity * 0.95));
  gradient.addColorStop(1,    hexToRgba(props.color, props.opacity));
  c.fillStyle = gradient;
  c.fillRect(0, 0, width, height);
};

/**
 * Render one frame of the fog overlay.
 *
 * Delegates the fill to `drawFlat` or `drawGradient` based on `fogMode`, then
 * switches to `destination-out` composite mode and punches out each explored
 * cell so those regions appear transparent (revealing the map tiles underneath).
 */
const draw = () => {
  if (!ctx.value || !canvas.value || !props.map) return;

  const c = ctx.value;
  const width = canvas.value.width;
  const height = canvas.value.height;

  c.clearRect(0, 0, width, height);
  c.save();

  if (props.fogMode === 'gradient') {
    drawGradient(c, width, height);
  } else {
    drawFlat(c, width, height);
  }

  c.globalCompositeOperation = 'destination-out';

  props.exploredCells.forEach((cell) => {
    drawS2Cell(c, cell, true);
  });

  c.restore();
};

/**
 * Start the `requestAnimationFrame` render loop.
 *
 * Stores the frame handle in `animationFrame` so it can be cancelled on
 * unmount. The loop redraws every frame so the fog stays aligned with the
 * map as the user pans or zooms.
 */
const animate = () => {
  draw();
  animationFrame.value = requestAnimationFrame(animate);
};

watch(() => [props.exploredCells, props.opacity, props.color, props.map, props.playerPosition, props.fogRadiusKm, props.fogMode], () => {
  draw();
}, { deep: true });

onMounted(() => {
  if (!canvas.value) return;
  
  ctx.value = canvas.value.getContext('2d');
  if (!ctx.value) return;
  
  resizeCanvas();
  
  window.addEventListener('resize', resizeCanvas);
  
  animate();
});

onUnmounted(() => {
  if (animationFrame.value) {
    cancelAnimationFrame(animationFrame.value);
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
