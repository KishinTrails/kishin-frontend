<!--
  Perlin Noise Overlay
  
  This draws a cloudy pattern on the map that stays stuck to the ground.
  When you move the map, the pattern moves with it - like it's painted on the Earth!
  
  Filter Tiles Feature:
  - When enabled, H3 cells with max noise > threshold are drawn in red
  - Other cells show no noise at all
  - Shows a counter of active cells
-->
<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import * as h3 from 'h3-js';
import maplibregl from 'maplibre-gl';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { fetchNoiseForCells } from '../services/noiseService';

interface Props {
  map?: MaplibreMap;
  scale?: number;
  threshold?: number;
}

const props = withDefaults(defineProps<Props>(), {
  map: undefined,
  scale: 10,
  threshold: 0.5
});

// Tell the parent component how many active cells we have
const emit = defineEmits<{
  activeCellsChange: [count: number];
}>();

// The canvas is our drawing paper
const canvas = ref<HTMLCanvasElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);

// Track which H3 cells are active (noise > threshold)
const activeCells = ref<Set<string>>(new Set());

// This figures out which H3 cells are visible on the map right now
// and which ones have noise > threshold (active cells)
const updateActiveCells = async () => {
  if (!props.map) return;
  
  // Get the visible area of the map
  const bounds = props.map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  
  // Make a rectangle polygon from the bounds
  const polygon: [number, number][] = [
    [sw.lat, sw.lng],
    [ne.lat, sw.lng],
    [ne.lat, ne.lng],
    [sw.lat, ne.lng],
    [sw.lat, sw.lng],
  ];
  
  // Get all H3 cells in this area (resolution 10 = small cells)
  const cells = h3.polygonToCells(polygon, 10);
  
  // Fetch noise values from API
  const noiseMap = await fetchNoiseForCells(cells, props.scale);
  
  // Find which cells are active (noise > threshold)
  const newActiveCells = new Set<string>();
  
  for (const [cell, noise] of noiseMap.entries()) {
    if (noise > props.threshold) {
      newActiveCells.add(cell);
    }
  }
  
  // Save the active cells
  activeCells.value = newActiveCells;
  
  // Tell the parent how many active cells we have
  emit('activeCellsChange', newActiveCells.size);
};

const RES = 0.25;

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

  for (const cell of activeCells.value) {
    const boundary = h3.cellToBoundary(cell);
    if (!boundary) continue;

    let firstPoint = true;
    
    for (const [lat, lng] of boundary) {
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

// This makes the canvas the right size when the window changes
const resize = () => {
  if (!canvas.value) return;
  canvas.value.width = Math.floor(window.innerWidth * RES);
  canvas.value.height = Math.floor(window.innerHeight * RES);
  draw();
};

// When the map changes, start listening to its moves and draw
watch(() => props.map, (m, old) => {
  if (old) old.off('move', draw);
  if (m) { 
    m.on('move', draw); 
    draw(); 
  }
}, { immediate: true });

watch(() => [props.scale, props.threshold], () => {
  draw();
});

// When the component starts, set everything up
onMounted(() => {
  ctx.value = canvas.value!.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
});

// When the component goes away, clean up so we don't waste memory
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
