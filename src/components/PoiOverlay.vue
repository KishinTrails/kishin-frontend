<template>
  <canvas
    ref="canvas"
    class="poi-overlay"
  />
</template>

<script setup lang="ts">
/**
 * POI overlay component that renders point-of-interest icons on explored S2 cells.
 *
 * Draws directly onto a canvas positioned above the map, using Mercator
 * coordinate projection to keep icons aligned with the map as the user pans
 * or zooms. Icons are type-specific images (peak / natural / industrial) sized
 * dynamically based on the current zoom level.
 */
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { tokenToCell, cellToVertices, isValidToken } from '@/utils/s2Utils';
import type { Map as MaplibreMap } from 'maplibre-gl';

/**
 * Valid POI cell type categories.
 * Matches the types defined in useTrailMap.ts.
 */
type CellTypeKey = 'peak' | 'natural' | 'industrial';

interface Props {
  /** MapLibre GL map instance used for coordinate projection. */
  map?: MaplibreMap;
  /** Map from S2 cell token to its POI type. */
  cellTypes: Map<string, CellTypeKey>;
  /** S2 cell tokens that are currently within the viewport. */
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

/** Resize the backing canvas to match its CSS-rendered size exactly. */
const resizeCanvas = () => {
  if (!canvas.value) return;
  canvas.value.width = canvas.value.clientWidth;
  canvas.value.height = canvas.value.clientHeight;
};

  /**
   * Draws an icon at the center of an S2 cell.
   */
  const drawS2CellImage = (c: CanvasRenderingContext2D, token: string, img: HTMLImageElement | null) => {
  if (!props.map || !img || typeof props.map.project !== 'function') return;
  if (!isValidToken(token)) return;

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
  const baseSize = 14;
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

  // Preserve the image's natural aspect ratio — imgSize is the longer dimension.
  const aspect = img.naturalWidth && img.naturalHeight
    ? img.naturalWidth / img.naturalHeight
    : 1;
  const drawW = aspect >= 1 ? imgSize : imgSize * aspect;
  const drawH = aspect >= 1 ? imgSize / aspect : imgSize;
  c.drawImage(img, point.x - drawW / 2, point.y - drawH / 2, drawW, drawH);
};

/**
 * Render one frame of the POI overlay.
 *
 * Clears the canvas and redraws an icon for every visible cell that has a
 * known POI type. Cells without a type in `cellTypes` are skipped silently.
 */
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

/**
 * Create an `HTMLImageElement` and begin loading the given source URL.
 *
 * The element is stored in `typeImages` so subsequent draw calls can use it
 * once the browser has decoded the image asynchronously.
 *
 * @param src - URL of the icon image to load.
 * @returns   The (potentially still loading) image element.
 */
const loadImage = (src: string): HTMLImageElement => {
  const img = new Image();
  img.src = src;
  return img;
};

/**
 * Start the `requestAnimationFrame` render loop.
 *
 * Keeps icons aligned with the map during pans and zooms without requiring
 * explicit map event subscriptions.
 */
const animate = () => {
  draw();
  animationFrame.value = requestAnimationFrame(animate);
};

watch(() => [props.visibleCells, props.cellTypes], () => {
  draw();
}, { deep: true });
watch(() => props.map, (map) => { if (map) resizeCanvas(); });

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
