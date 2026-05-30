<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import maplibregl from 'maplibre-gl';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { cellToToken, tokenToCell, cellFromLatLng, cellToVertices } from '@/utils/s2Utils';
import { hexToRgba } from '@/utils/color';
import type { TileGroup } from '@/types/perlinConfig';

interface Props {
  map?: MaplibreMap;
  selectedCells?: string[];
  tileGroups?: TileGroup[];
  activeGroupIndex?: number;
}

const props = withDefaults(defineProps<Props>(), {
  map: undefined,
  selectedCells: () => [],
  tileGroups: () => [],
  activeGroupIndex: 0
});

const emit = defineEmits<{
  toggleCell: [cell: string];
  clearAllCells: [];
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
const ctx = ref<CanvasRenderingContext2D | null>(null);

/** Mirrors props.selectedCells as a Set for O(1) lookup during drawing and hit-testing. */
const selectedCellsSet = ref<Set<string>>(new Set());

/** The S2 token of the cell currently under the cursor, or null if none. */
const hoveredCell = ref<string | null>(null);

/** Screen position of the tooltip anchor, tracking the cursor. */
const tooltipPosition = ref<{ x: number; y: number } | null>(null);

/**
 * Mouse position at the time of mousedown.
 * Used to distinguish a click (small delta) from a drag (large delta).
 * Intentionally NOT updated during mousemove so the delta always measures
 * total displacement from where the button was pressed.
 */
const mouseDownPos = ref<{ x: number; y: number } | null>(null);

/**
 * Whether the current gesture has exceeded CLICK_THRESHOLD and should be
 * treated as a pan rather than a click.
 */
const isDragging = ref(false);

/**
 * Minimum pixel displacement from mousedown before a gesture is classified
 * as a drag. Below this threshold the mouseup is treated as a click.
 */
const CLICK_THRESHOLD = 5;

/** Sync the local Set mirror whenever the selectedCells prop changes. */
const updateSelectedCellsSet = () => {
  selectedCellsSet.value = new Set(props.selectedCells);
};

/**
 * Find the TileGroup that owns the given cell token, if any.
 * Returns undefined when the cell is selected but not assigned to a group.
 */
const findGroupForCell = (cell: string): TileGroup | undefined => {
  return props.tileGroups.find(g => g.condition.cells.includes(cell));
};

/**
 * Resolve the fill and stroke colours for a selected cell.
 * Uses the group colour when the cell belongs to a TileGroup,
 * falling back to a default blue palette.
 */
const getCellColor = (cell: string): { fill: string; stroke: string } => {
  const group = findGroupForCell(cell);
  if (group) {
    return {
      fill: hexToRgba(group.color, 0.4),
      stroke: group.color
    };
  }
  return {
    fill: 'rgba(52, 152, 219, 0.4)',
    stroke: 'rgba(52, 152, 219, 1)'
  };
};

/**
 * Return the S2 token of the selected cell at the given screen position,
 * or null if the position does not hit any selected cell.
 *
 * Only selected cells are considered — unselected cells are transparent
 * to hover and tooltip logic.
 */
const findCellAtPosition = (x: number, y: number): string | null => {
  if (!props.map) return null;
  const coords = props.map.unproject([x, y]);
  const cell = cellToToken(cellFromLatLng(coords.lat, coords.lng));
  if (selectedCellsSet.value.has(cell)) {
    return cell;
  }
  return null;
};

/**
 * Forward wheel events to the underlying map canvas so zoom behaviour
 * is preserved even though this overlay captures pointer events.
 */
const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  props.map?.getCanvas().dispatchEvent(new WheelEvent('wheel', e));
};

/**
 * Record the cursor position at mousedown.
 * Dragging and click classification are both derived from this origin —
 * it is never updated during the gesture so the total displacement is
 * always available at mouseup.
 */
const handleMouseDown = (e: MouseEvent) => {
  if (e.button !== 0) return;
  mouseDownPos.value = { x: e.clientX, y: e.clientY };
  isDragging.value = false;

  // Forward to the map canvas so maplibre can take over pan handling.
  props.map?.getCanvas().dispatchEvent(new MouseEvent('mousedown', e));
};

/**
 * Handle cursor movement during a gesture.
 *
 * Once the cursor has moved more than CLICK_THRESHOLD pixels from the
 * mousedown origin the gesture is promoted to a drag and map panning is
 * delegated entirely to maplibre via forwarded events. Below the threshold
 * no panning occurs so accidental micro-movements do not disrupt clicks.
 *
 * Hover detection and tooltip update run on every move regardless of
 * drag state so the UI stays responsive.
 */
const handleMouseMove = (e: MouseEvent) => {
  if (mouseDownPos.value) {
    const dx = Math.abs(e.clientX - mouseDownPos.value.x);
    const dy = Math.abs(e.clientY - mouseDownPos.value.y);

    if (!isDragging.value && (dx > CLICK_THRESHOLD || dy > CLICK_THRESHOLD)) {
      isDragging.value = true;
    }

    if (isDragging.value) {
      // Delegate panning to maplibre by forwarding the raw event.
      props.map?.getCanvas().dispatchEvent(new MouseEvent('mousemove', e));
    }
  }

  hoveredCell.value = findCellAtPosition(e.clientX, e.clientY);
  tooltipPosition.value = hoveredCell.value ? { x: e.clientX, y: e.clientY } : null;
  draw();
};

/**
 * Conclude the current gesture on mouseup.
 *
 * If the total displacement stayed within CLICK_THRESHOLD the gesture is
 * classified as a click and toggleCell is emitted for the cell under the
 * cursor. Drags are silently concluded — panning was already handled by
 * maplibre during mousemove.
 *
 * The mouseup event is always forwarded to the map canvas so maplibre can
 * clean up its own drag state regardless of how we classify the gesture.
 */
const handleMouseUp = (e: MouseEvent) => {
  if (e.button !== 0 || !mouseDownPos.value) return;

  props.map?.getCanvas().dispatchEvent(new MouseEvent('mouseup', e));

  if (!isDragging.value && props.map) {
    const coords = props.map.unproject([e.clientX, e.clientY]);
    const cell = cellToToken(cellFromLatLng(coords.lat, coords.lng));
    if (cell) emit('toggleCell', cell);
  }

  mouseDownPos.value = null;
  isDragging.value = false;
  draw();
};

/**
 * Reset gesture and hover state when the cursor leaves the overlay.
 * The map canvas receives a mouseup so maplibre does not get stuck in
 * a drag state if the cursor exits the overlay during a pan.
 */
const handleMouseLeave = () => {
  if (mouseDownPos.value) {
    props.map?.getCanvas().dispatchEvent(new MouseEvent('mouseup', {}));
  }
  mouseDownPos.value = null;
  isDragging.value = false;
  hoveredCell.value = null;
  tooltipPosition.value = null;
  draw();
};

/**
 * Render selected cells and the hover tooltip onto the canvas.
 *
 * Uses Mercator coordinates for screen projection to stay consistent with
 * maplibre's own rendering pipeline. Each selected cell is drawn with its
 * group colour (or the default blue) as a filled + stroked polygon.
 */
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

  for (const cell of selectedCellsSet.value) {
    const vertices = cellToVertices(tokenToCell(cell));
    if (!vertices || vertices.length === 0) continue;

    const colors = getCellColor(cell);
    c.fillStyle = colors.fill;
    c.strokeStyle = colors.stroke;
    c.lineWidth = 2;

    c.beginPath();
    vertices.forEach((coord, i) => {
      const mercator = maplibregl.MercatorCoordinate.fromLngLat({ lng: coord.lng, lat: coord.lat });
      const screenX = ((mercator.x - nwM.x) / spanX) * window.innerWidth;
      const screenY = ((mercator.y - nwM.y) / spanY) * window.innerHeight;
      if (i === 0) c.moveTo(screenX, screenY);
      else c.lineTo(screenX, screenY);
    });
    c.closePath();
    c.fill();
    c.stroke();
  }

  if (hoveredCell.value && tooltipPosition.value) {
    const group = findGroupForCell(hoveredCell.value);
    const label = group?.condition.comment || hoveredCell.value;

    c.font = '12px sans-serif';
    const textWidth = c.measureText(label).width;
    const padding = 6;
    const tooltipWidth = textWidth + padding * 2;
    const tooltipHeight = 20;

    let tooltipX = tooltipPosition.value.x + 10;
    let tooltipY = tooltipPosition.value.y - tooltipHeight - 5;

    if (tooltipX + tooltipWidth > window.innerWidth) {
      tooltipX = tooltipPosition.value.x - tooltipWidth - 10;
    }
    if (tooltipY < 0) {
      tooltipY = tooltipPosition.value.y + 10;
    }

    c.fillStyle = 'rgba(0, 0, 0, 0.85)';
    c.beginPath();
    c.roundRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight, 4);
    c.fill();

    c.fillStyle = 'white';
    c.fillText(label, tooltipX + padding, tooltipY + 14);
  }
};

/** Resize the canvas to fill the viewport and redraw. */
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
  canvas.value!.addEventListener('wheel', handleWheel, { passive: false });
});

onUnmounted(() => {
  props.map?.off('move', draw);
  window.removeEventListener('resize', resize);
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
  cursor: grab;
}

.tile-select-overlay:active {
  cursor: grabbing;
}
</style>
