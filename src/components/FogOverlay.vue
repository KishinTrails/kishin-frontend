<template>
  <canvas
    ref="canvas"
    class="fog-overlay"
  />
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { tokenToCell, cellToVertices } from '@/utils/s2Utils';
import { hexToRgba } from '@/utils/color';
import type { Map as MaplibreMap } from 'maplibre-gl';

interface Props {
  map?: MaplibreMap;
  exploredCells?: string[];
  opacity?: number;
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

const resizeCanvas = () => {
  if (!canvas.value) return;
  canvas.value.width = window.innerWidth;
  canvas.value.height = window.innerHeight;
};

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
