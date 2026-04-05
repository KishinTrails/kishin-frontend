<template>
  <canvas
    ref="canvas"
    class="poi-overlay"
  />
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import * as h3 from 'h3-js';
import maplibregl from 'maplibre-gl';

type CellTypeKey = 'peak' | 'natural' | 'industrial';

interface Props {
  map?: maplibregl.Map;
  cellTypes: Map<string, CellTypeKey>;
  visibleCells: string[];
}

const props = defineProps<Props>();

const canvas = ref<HTMLCanvasElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);
const animationFrame = ref<number | null>(null);

const peakImage = ref<HTMLImageElement | null>(null);
const naturalImage = ref<HTMLImageElement | null>(null);
const industrialImage = ref<HTMLImageElement | null>(null);

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

const drawH3CellImage = (c: CanvasRenderingContext2D, h3Index: string, img: HTMLImageElement | null) => {
  if (!props.map || !img || typeof props.map.project !== 'function') return;
  
  const boundary = h3.cellToBoundary(h3Index);
  
  if (boundary.length === 0) return;
  
  c.beginPath();
  
  boundary.forEach((coord, i) => {
    const point = props.map!.project([coord[1], coord[0]]);
    
    if (i === 0) {
      c.moveTo(point.x, point.y);
    } else {
      c.lineTo(point.x, point.y);
    }
  });

  c.closePath();
  
  const centerLat = boundary.reduce((sum, coord) => sum + coord[0], 0) / boundary.length;
  const centerLng = boundary.reduce((sum, coord) => sum + coord[1], 0) / boundary.length;
  
  const point = props.map.project([centerLng, centerLat]);
  
  const zoom = props.map.getZoom();
  const baseZoom = 13;
  const baseSize = 12;
  const imgSize = baseSize * Math.pow(2, zoom - baseZoom);
  
  // Check if point is within visible bounds (with padding for image size)
  if (point.x < -imgSize / 2 || point.x > canvas.value!.width + imgSize / 2 || 
      point.y < -imgSize / 2 || point.y > canvas.value!.height + imgSize / 2) {
    return;
  }
  
  c.strokeStyle = '#999999';
  c.lineWidth = 1;
  c.stroke();

  c.drawImage(img, point.x - imgSize / 2, point.y - imgSize / 2, imgSize, imgSize);
};

const draw = () => {
  if (!ctx.value || !canvas.value || !props.map) return;

  const c = ctx.value;
  const width = canvas.value.width;
  const height = canvas.value.height;

  c.clearRect(0, 0, width, height);

  for (const cell of props.visibleCells) {
    const type = props.cellTypes.get(cell);
    if (!type) continue;
    const img = typeImages[type];
    drawH3CellImage(c, cell, img);
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

watch(() => props.visibleCells, () => {
  draw();
}, { deep: true });

onMounted(() => {
  if (!canvas.value) return;
  
  ctx.value = canvas.value.getContext('2d');
  if (!ctx.value) return;
  
  resizeCanvas();
  
  peakImage.value = loadImage('/tori.png');
  naturalImage.value = loadImage('/nature.png');
  industrialImage.value = loadImage('/factory.png');
  
  typeImages.peak = peakImage.value;
  typeImages.natural = naturalImage.value;
  typeImages.industrial = industrialImage.value;
  
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
  z-index: 2;
}
</style>
