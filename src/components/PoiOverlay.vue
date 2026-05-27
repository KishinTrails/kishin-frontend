<template>
  <canvas
    ref="canvas"
    class="poi-overlay"
  />
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { tokenToCell, cellToVertices } from '@/utils/s2Utils';
import type { Map as MaplibreMap } from 'maplibre-gl';

/**
 * Valid POI cell type categories.
 * Matches the types defined in useTrailMap.ts
 */
type CellTypeKey = 'peak' | 'natural' | 'industrial';

interface Props {
  /** Maplibre map instance */
  map?: MaplibreMap;
  /** Map of S2 tokens to their specific POI type */
  cellTypes: Map<string, CellTypeKey>;
  /** List of currently visible S2 cell tokens */
  visibleCells: string[];
}

const props = defineProps<Props>();

const canvas = ref<HTMLCanvasElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);
const animationFrame = ref<number | null>(null);

const typeImages: Record<CellTypeKey, HTMLImageElement | null> = {
  peak: null,
  natural: null,
  industrial: null
};

const resizeCanvas = () => {
  if (!canvas.value) return;
  canvas.value.width = window.innerWidth;
  canvas.value.height = window.innerHeight;
};

  /**
   * Draws an icon at the center of an S2 cell.
   */
  const drawS2CellImage = (c: CanvasRenderingContext2D, token: string, img: HTMLImageElement | null) => {
  if (!props.map || !img || typeof props.map.project !== 'function') return;
  
  let vertices: Array<{ lat: number; lng: number }>;

  try {
    // Convert S2 token to vertices via the utility
    vertices = cellToVertices(tokenToCell(token));
  } catch (err) {
    return;
  }

  // Calculate the centroid of the S2 cell for icon placement
  const centerLat = vertices.reduce((sum, v) => sum + v.lat, 0) / vertices.length;
  const centerLng = vertices.reduce((sum, v) => sum + v.lng, 0) / vertices.length;
  
  const point = props.map.project([centerLng, centerLat]);
  
  // Dynamic sizing based on zoom level
  const zoom = props.map.getZoom();
  const baseZoom = 13;
  const baseSize = 12;
  const imgSize = baseSize * Math.pow(2, zoom - baseZoom);
  
  // Culling: Don't draw if the center is off-screen
  if (point.x < -imgSize / 2 || point.x > canvas.value!.width + imgSize / 2 || 
      point.y < -imgSize / 2 || point.y > canvas.value!.height + imgSize / 2) {
    return;
  }
  
  // Draw cell boundary for debug/visual clarity
  c.beginPath();
  vertices.forEach((v, i) => {
    const p = props.map!.project([v.lng, v.lat]);
    if (i === 0) c.moveTo(p.x, p.y);
    else c.lineTo(p.x, p.y);
  });
  c.closePath();
  c.strokeStyle = 'rgba(153, 153, 153, 0.5)';
  c.lineWidth = 1;
  c.stroke();

  c.drawImage(img, point.x - imgSize / 2, point.y - imgSize / 2, imgSize, imgSize);
};

const draw = () => {
  if (!ctx.value || !canvas.value || !props.map) return;

  const c = ctx.value;
  c.clearRect(0, 0, canvas.value.width, canvas.value.height);

  for (const cell of props.visibleCells) {
    const type = props.cellTypes.get(cell);
    if (!type) continue;
    const img = typeImages[type];
    drawS2CellImage(c, cell, img);
  }
};

const loadImage = (src: string): HTMLImageElement => {
  const img = new Image();
  img.src = src;
  return img;
};

const animate = () => {
  draw();
  animationFrame.value = requestAnimationFrame(animate);
};

watch(() => [props.visibleCells, props.cellTypes], () => {
  draw();
}, { deep: true });

onMounted(() => {
  if (!canvas.value) return;
  
  ctx.value = canvas.value.getContext('2d');
  if (!ctx.value) return;
  
  resizeCanvas();
  
  // Initialize images
  typeImages.peak = loadImage('/tori.png');
  typeImages.natural = loadImage('/nature.png');
  typeImages.industrial = loadImage('/factory.png');
  
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
.poi-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2; /* Sits above the FogOverlay (z-index: 1) */
}
</style>
