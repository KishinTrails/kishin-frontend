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
}

const props = withDefaults(defineProps<Props>(), {
  map: undefined,
  exploredCells: () => [],
  opacity: 0.85,
  color: '#1a1a1a',
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
 * Render one frame of the fog overlay.
 *
 * Fills the entire canvas with the fog colour, then switches to
 * `destination-out` composite mode and punches out each explored cell so
 * those regions appear transparent (revealing the map tiles underneath).
 */
const draw = () => {
  if (!ctx.value || !canvas.value || !props.map) return;

  const c = ctx.value;
  const width = canvas.value.width;
  const height = canvas.value.height;

  c.clearRect(0, 0, width, height);
  c.save();

  c.fillStyle = hexToRgba(props.color, props.opacity);
  c.fillRect(0, 0, width, height);

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

watch(() => [props.exploredCells, props.opacity, props.color, props.map], () => {
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
