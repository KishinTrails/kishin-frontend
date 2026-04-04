<template>
  <canvas ref="canvas" class="fog-overlay"></canvas>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import * as h3 from 'h3-js';
import { hexToRgba } from '@/utils/color';

interface Props {
  map?: maplibregl.Map;
  exploredCells: string[];
  opacity?: number;
  color?: string;
}

const props = withDefaults(defineProps<Props>(), {
  map: undefined,
  exploredCells: () => [],
  opacity: 0.85,
  color: '#1a1a1a'
});

const canvas = ref<HTMLCanvasElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);
const animationFrame = ref<number | null>(null);

const resizeCanvas = () => {
  if (!canvas.value) return;
  canvas.value.width = window.innerWidth;
  canvas.value.height = window.innerHeight;
};

const drawH3Cell = (c: CanvasRenderingContext2D, h3Index: string, fill: boolean = false) => {
  if (!props.map) return;
  
  const boundary = h3.cellToBoundary(h3Index);
  if (boundary.length === 0) return;
  
  c.beginPath();
  
  boundary.forEach((coord: number[], i: number) => {
    const point = props.map!.project([coord[1], coord[0]]);
    
    if (i === 0) {
      c.moveTo(point.x, point.y);
    } else {
      c.lineTo(point.x, point.y);
    }
  });
  
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
  
  props.exploredCells.forEach(cell => {
    drawH3Cell(c, cell, true);
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
