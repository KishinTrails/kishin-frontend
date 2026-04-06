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

// Settings we can change from outside
interface Props {
  map?: MaplibreMap;
  opacity?: number;
  scale?: number;
  filterTiles?: boolean;
  threshold?: number;
}

// Default settings: half visible, medium detail
const props = withDefaults(defineProps<Props>(), {
  map: undefined,
  opacity: 0.5,
  scale: 10,
  filterTiles: false,
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

// This is a list of random numbers that never changes
// Think of it like a secret recipe that makes the same pattern every time
const p = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
const permutation = [...p, ...p];

// This makes sharp corners smooth, like rounding the edges of a block
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

// This mixes two numbers together, like blending two paint colors
// If t is 0, you get all of 'a'. If t is 1, you get all of 'b'. If t is 0.5, you get half and half
const lerp = (a: number, b: number, t: number) => a + t * (b - a);

// This picks one of four directions based on a number
// Like rolling a 4-sided die to choose which way an arrow points
const grad = (hash: number, x: number, y: number) => {
  const h = hash & 3;
  return ((h & 1) === 0 ? x : -x) + ((h & 2) === 0 ? y : -y);
};

// This is the magic function that makes smooth random numbers!
// It creates a bumpy landscape where nearby points have similar values
// That's why the clouds look smooth and natural, not jumpy and random
const perlin = (x: number, y: number) => {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  x -= Math.floor(x); y -= Math.floor(y);
  const u = fade(x); const v = fade(y);
  const A = permutation[X] + Y, B = permutation[X+1] + Y;
  return lerp(lerp(grad(permutation[A], x, y), grad(permutation[B], x-1, y), u),
              lerp(grad(permutation[A+1], x, y-1), grad(permutation[B+1], x-1, y-1), u), v);
};

// This gets the noise value for a spot on the map
// It layers 3 different sizes of bumps on top of each other
// Like making a cake with big, medium, and small layers
// This makes the pattern look rich and interesting, not boring and repetitive
const getNoiseValue = (x: number, y: number, scale: number) => {
  let v = 0, amp = 1, freq = scale * 500;
  for (let i = 0; i < 3; i++) {
    v += perlin(x * freq, y * freq) * amp;
    amp *= 0.5; freq *= 2;
  }
  return (v + 1) / 2;
};

// This finds the maximum noise value in an H3 cell
// For now, it only samples the center point (fast!)
// We can make it sample more points later if needed
const getMaxNoiseInCell = (cell: string): number => {
  // Get the center of the H3 cell
  const center = h3.cellToLatLng(cell);
  const lat = center[0];
  const lng = center[1];
  
  // Convert to Mercator coordinates (the special 0-1 system)
  const merc = maplibregl.MercatorCoordinate.fromLngLat({ lng, lat });
  
  // Get the noise value at this point
  return getNoiseValue(merc.x, merc.y, props.scale);
};

// This figures out which H3 cells are visible on the map right now
// and which ones have noise > threshold (active cells)
const updateActiveCells = () => {
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
  
  // Find which cells are active (max noise > threshold)
  const newActiveCells = new Set<string>();
  
  for (const cell of cells) {
    const maxNoise = getMaxNoiseInCell(cell);
    if (maxNoise > props.threshold) {
      newActiveCells.add(cell);
    }
  }
  
  // Save the active cells
  activeCells.value = newActiveCells;
  
  // Tell the parent how many active cells we have
  emit('activeCellsChange', newActiveCells.size);
};

// This makes the canvas smaller so it runs faster
// 0.25 means it's only 1/4 the size of your screen
// Like drawing a small picture instead of a big one - faster but a bit blurry
const RES = 0.25; 

// Check if a point is inside an active H3 cell
const isActiveCell = (worldX: number, worldY: number): boolean => {
  if (!props.map || activeCells.value.size === 0) return false;
  
  // We need to convert from Mercator back to lat/lng
  // Use the map's unproject method with screen coordinates
  // First, convert world coordinates to screen coordinates
  const bounds = props.map.getBounds();
  const nw = bounds.getNorthWest();
  const se = bounds.getSouthEast();
  
  const nwM = maplibregl.MercatorCoordinate.fromLngLat(nw);
  const seM = maplibregl.MercatorCoordinate.fromLngLat(se);
  
  const spanX = seM.x - nwM.x;
  const spanY = seM.y - nwM.y;
  
  // Convert worldX/Y back to screen x/y
  const screenX = ((worldX - nwM.x) / spanX) * window.innerWidth;
  const screenY = ((worldY - nwM.y) / spanY) * window.innerHeight;
  
  // Use map.unproject to get lat/lng from screen coordinates
  const lngLat = props.map.unproject([screenX, screenY]);
  
  // Find which H3 cell this point is in
  const cell = h3.latLngToCell(lngLat.lat, lngLat.lng, 10);
  
  // Check if that cell is active
  return activeCells.value.has(cell);
};

// This draws the whole pattern on the canvas
const draw = () => {
  if (!ctx.value || !canvas.value || !props.map) return;
  
  const m = props.map;
  const { width, height } = canvas.value;
  const c = ctx.value;
  
  const imageData = c.createImageData(width, height);
  const data = imageData.data;

  // Find out what part of the Earth we're looking at
  // nw = northwest corner (top-left), se = southeast corner (bottom-right)
  const nw = m.unproject([0, 0]);
  const se = m.unproject([window.innerWidth, window.innerHeight]);
  
  // Convert to a special coordinate system that's always 0 to 1
  // This makes the math easier and more stable
  const nwM = maplibregl.MercatorCoordinate.fromLngLat(nw);
  const seM = maplibregl.MercatorCoordinate.fromLngLat(se);
  
  const spanX = seM.x - nwM.x;
  const spanY = seM.y - nwM.y;

  // Update which cells are active (recalculates on every map move)
  if (props.filterTiles) {
    updateActiveCells();
  }

  // Go through every pixel and give it a color
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Figure out where this pixel is on the Earth
      // We use math to spread the pixels evenly between the corners
      const worldX = nwM.x + (x / width) * spanX;
      const worldY = nwM.y + (y / height) * spanY;
      
      // Get the noise value for this spot - this is the magic part!
      // Same spot on Earth = same noise value, forever!
      const n = getNoiseValue(worldX, worldY, props.scale);
      
      const i = (y * width + x) * 4;
      
      // If filter tiles is on, only draw in active cells
      if (props.filterTiles) {
        if (!isActiveCell(worldX, worldY)) {
          // Skip this pixel - not in an active cell
          data[i] = 0;
          data[i+1] = 0;
          data[i+2] = 0;
          data[i+3] = 0; // Fully transparent
          continue;
        }
        
        // Draw in red for active cells
        data[i] = 255;     // Red
        data[i+1] = 0;     // Green
        data[i+2] = 0;     // Blue
        data[i+3] = 128;   // Alpha (50% = 128/255)
      } else {
        // Normal mode: gray noise
        // Turn the noise value (0 to 1) into transparency (0 to 255)
        // opacity controls how dark it gets
        const alpha = Math.floor(n * props.opacity * 255);
        
        // Set the color to black with that transparency
        data[i] = 0; data[i+1] = 0; data[i+2] = 0; data[i+3] = alpha;
      }
    }
  }
  c.putImageData(imageData, 0, 0);
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

// When opacity, scale, filterTiles, or threshold changes, redraw the picture
watch(() => [props.opacity, props.scale, props.filterTiles, props.threshold], () => {
  // Clear active cells when filter is turned off
  if (!props.filterTiles) {
    activeCells.value.clear();
    emit('activeCellsChange', 0);
  }
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
  <canvas ref="canvas" class="perlin-noise-overlay" />
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
