<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import * as h3 from 'h3-js';
import maplibregl from 'maplibre-gl';
import type { Map as MaplibreMap } from 'maplibre-gl';

interface Props {
  map?: MaplibreMap;
  selectedCells?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  map: undefined,
  selectedCells: () => []
});

const emit = defineEmits<{
  selectedCellsChange: [cells: string[]];
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);

const selectedCellsSet = ref<Set<string>>(new Set());

// Left-click drag state
const isDragging = ref(false);
const dragStart = ref<{ x: number; y: number } | null>(null);
const dragEnd = ref<{ x: number; y: number } | null>(null);
const wasDrag = ref(false);

const CLICK_THRESHOLD = 5;

// How many pixels to pan per arrow key press
const ARROW_PAN_PX = 100;

// ─── Helpers ────────────────────────────────────────────────────────────────

const updateSelectedCellsSet = () => {
  selectedCellsSet.value = new Set(props.selectedCells);
};

const getCellsInScreenRectangle = (
  start: { x: number; y: number },
  end: { x: number; y: number }
): string[] => {
  if (!props.map) return [];

  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);

  const nw = props.map.unproject([minX, minY]);
  const se = props.map.unproject([maxX, maxY]);

  const polygon: [number, number][] = [
    [nw.lat, nw.lng],
    [se.lat, nw.lng],
    [se.lat, se.lng],
    [nw.lat, se.lng],
    [nw.lat, nw.lng],
  ];

  return h3.polygonToCells(polygon, 10);
};

const toggleCells = (cells: string[]) => {
  cells.forEach(cell => {
    if (selectedCellsSet.value.has(cell)) {
      selectedCellsSet.value.delete(cell);
    } else {
      selectedCellsSet.value.add(cell);
    }
  });
  emit('selectedCellsChange', Array.from(selectedCellsSet.value));
};

// ─── Arrow-key pan ───────────────────────────────────────────────────────────

const handleKeyDown = (e: KeyboardEvent) => {
  if (!props.map) return;

  // Don't steal arrow keys from inputs/textareas
  const tag = (e.target as HTMLElement).tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  const panMap = (dx: number, dy: number) => {
    e.preventDefault();
    props.map!.panBy([dx, dy], { animate: true });
  };

  switch (e.key) {
    case 'ArrowUp':    return panMap(0, -ARROW_PAN_PX);
    case 'ArrowDown':  return panMap(0,  ARROW_PAN_PX);
    case 'ArrowLeft':  return panMap(-ARROW_PAN_PX, 0);
    case 'ArrowRight': return panMap( ARROW_PAN_PX, 0);
  }
};

// ─── Wheel: forward to MapLibre canvas for zoom ──────────────────────────────

const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  props.map?.getCanvas().dispatchEvent(new WheelEvent('wheel', e));
};

// ─── Mouse: left-click selection ─────────────────────────────────────────────

const handleMouseDown = (e: MouseEvent) => {
  if (e.button !== 0) return;

  isDragging.value = true;
  wasDrag.value = false;
  dragStart.value = { x: e.clientX, y: e.clientY };
  dragEnd.value = { x: e.clientX, y: e.clientY };
};

const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging.value || !dragStart.value) return;

  dragEnd.value = { x: e.clientX, y: e.clientY };

  if (!wasDrag.value) {
    const dx = e.clientX - dragStart.value.x;
    const dy = e.clientY - dragStart.value.y;
    if (Math.sqrt(dx * dx + dy * dy) > CLICK_THRESHOLD) {
      wasDrag.value = true;
    }
  }

  draw();
};

const handleMouseUp = (e: MouseEvent) => {
  if (e.button !== 0 || !isDragging.value || !dragStart.value || !dragEnd.value) return;

  if (wasDrag.value) {
    // Rectangle selection
    const cells = getCellsInScreenRectangle(dragStart.value, dragEnd.value);
    if (cells.length > 0) toggleCells(cells);
  } else {
    // Single-cell click toggle
    if (props.map) {
      const coords = props.map.unproject([e.clientX, e.clientY]);
      const cell = h3.latLngToCell(coords.lat, coords.lng, 10);
      if (cell) toggleCells([cell]);
    }
  }

  isDragging.value = false;
  wasDrag.value = false;
  dragStart.value = null;
  dragEnd.value = null;
  draw();
};

const handleMouseLeave = () => {
  if (!isDragging.value) return;
  // Cancel drag if cursor leaves the canvas
  isDragging.value = false;
  wasDrag.value = false;
  dragStart.value = null;
  dragEnd.value = null;
  draw();
};

// ─── Draw ────────────────────────────────────────────────────────────────────

const draw = () => {
  if (!ctx.value || !canvas.value || !props.map) return;

  const c = ctx.value;
  const { width, height } = canvas.value;

  c.clearRect(0, 0, width, height);

  const nw = props.map.unproject([0, 0]);
  const se = props.map.unproject([window.innerWidth, window.innerHeight]);

  const nwM = maplibregl.MercatorCoordinate.fromLngLat(nw);
  const seM = maplibregl.MercatorCoordinate.fromLngLat(se);

  const spanX = seM.x - nwM.x;
  const spanY = seM.y - nwM.y;

  if (selectedCellsSet.value.size > 0) {
    c.fillStyle = 'rgba(52, 152, 219, 0.4)';
    c.strokeStyle = 'rgba(52, 152, 219, 1)';
    c.lineWidth = 2;

    for (const cell of selectedCellsSet.value) {
      const boundary = h3.cellToBoundary(cell);
      if (!boundary || boundary.length === 0) continue;

      c.beginPath();
      boundary.forEach((coord: number[], i: number) => {
        const mercator = maplibregl.MercatorCoordinate.fromLngLat({ lng: coord[1], lat: coord[0] });
        const screenX = ((mercator.x - nwM.x) / spanX) * window.innerWidth;
        const screenY = ((mercator.y - nwM.y) / spanY) * window.innerHeight;
        if (i === 0) c.moveTo(screenX, screenY);
        else c.lineTo(screenX, screenY);
      });
      c.closePath();
      c.fill();
      c.stroke();
    }
  }

  if (isDragging.value && wasDrag.value && dragStart.value && dragEnd.value) {
    c.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    c.lineWidth = 2;
    c.setLineDash([5, 5]);
    c.beginPath();
    c.rect(
      dragStart.value.x,
      dragStart.value.y,
      dragEnd.value.x - dragStart.value.x,
      dragEnd.value.y - dragStart.value.y
    );
    c.stroke();
    c.setLineDash([]);
  }
};

// ─── Lifecycle ───────────────────────────────────────────────────────────────

const resize = () => {
  if (!canvas.value) return;
  canvas.value.width = window.innerWidth;
  canvas.value.height = window.innerHeight;
  draw();
};

watch(() => props.map, (m, old) => {
  if (old) old.off('move', draw);
  if (m) {
    m.on('move', draw);
    draw();
  }
}, { immediate: true });

watch(() => props.selectedCells, () => {
  updateSelectedCellsSet();
  draw();
}, { deep: true });

onMounted(() => {
  ctx.value = canvas.value!.getContext('2d');
  updateSelectedCellsSet();
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', handleKeyDown);
  // non-passive so preventDefault() can suppress the page from scrolling
  canvas.value!.addEventListener('wheel', handleWheel, { passive: false });
});

onUnmounted(() => {
  props.map?.off('move', draw);
  window.removeEventListener('resize', resize);
  window.removeEventListener('keydown', handleKeyDown);
  canvas.value?.removeEventListener('wheel', handleWheel);
});
</script>

<template>
  <canvas
    ref="canvas"
    class="tile-select-overlay"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseLeave"
  />
</template>

<style scoped>
.tile-select-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  cursor: crosshair;
}
</style>
