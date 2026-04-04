<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="map-container">
        <div
          ref="mapContainer"
          class="map"
        />
        <canvas
          ref="cellsCanvas"
          class="cells-overlay"
        />
        
        <div class="controls">
          <h3>🗺️ Trail Map</h3>
          
          <div class="stats">
            <div class="stat-item">
              Rendered Cells: {{ visibleCells.length }}
            </div>
            <div class="stat-item">
              Pending Calls: {{ remainingCalls }}
            </div>
            <div class="stat-item">
              Cache Hits: {{ cacheHits }}
            </div>
            <div class="stat-item">
              Cache Misses: {{ cacheMisses }}
            </div>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
/**
 * ClearmapPage - Debug page for displaying H3 cells with POI markers on a map.
 * Shows rendered cells, cache statistics, and cell type information.
 */

import { ref, onMounted, onUnmounted } from 'vue';
import { IonPage, IonContent } from '@ionic/vue';
import maplibregl from 'maplibre-gl';
import * as h3 from 'h3-js';
import 'maplibre-gl/dist/maplibre-gl.css';
import { fetchCellTypes as fetchCellTypesFromService, CellType } from '@/services/poiService';
import { getCellTypeFromCache } from '@/services/cacheService';

const H3_RESOLUTION = 10;

const mapContainer = ref<HTMLElement | null>(null);
const cellsCanvas = ref<HTMLCanvasElement | null>(null);
const map = ref<maplibregl.Map>();
const cellsCtx = ref<CanvasRenderingContext2D | null>(null);

const peakImage = ref<HTMLImageElement | null>(null);
const naturalImage = ref<HTMLImageElement | null>(null);
const industrialImage = ref<HTMLImageElement | null>(null);

const cellTypes = ref<Map<string, Exclude<CellType, 'none'>>>(new Map());

const visibleCells = ref<string[]>([]);
const remainingCalls = ref(0);
const cacheHits = ref(0);
const cacheMisses = ref(0);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let abortController: AbortController | null = null;

const typeImages: Record<Exclude<CellType, 'none'>, HTMLImageElement | null> = {
  peak: null,
  natural: null,
  industrial: null
};

onMounted(() => {
  loadImages();
  setTimeout(() => {
    initMap();
    initCellsCanvas();
    setupEventListeners();
    updateVisibleCells();
  }, 100);
});

/**
 * Load marker images for POI types (peak, natural, industrial).
 */
const loadImages = () => {
  const loadImage = (src: string): HTMLImageElement => {
    const img = new Image();
    img.src = src;
    return img;
  };

  peakImage.value = loadImage('/tori.png');
  naturalImage.value = loadImage('/nature.png');
  industrialImage.value = loadImage('/factory.png');

  typeImages.peak = peakImage.value;
  typeImages.natural = naturalImage.value;
  typeImages.industrial = industrialImage.value;
};

onUnmounted(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  if (map.value) {
    map.value.remove();
  }
});

/**
 * Initialize the MapLibre map instance with OSM tiles.
 */
const initMap = () => {
  if (!mapContainer.value) return;

  map.value = new maplibregl.Map({
    container: mapContainer.value,
    style: {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors'
        }
      },
      layers: [
        {
          id: 'osm',
          type: 'raster',
          source: 'osm',
          minzoom: 0,
          maxzoom: 20
        }
      ]
    },
    center: [3.1009225078676246, 45.75259789465471] as [number, number],
    zoom: 16
  });

  map.value.addControl(new maplibregl.NavigationControl(), 'top-right');

  map.value.on('move', () => {
    debouncedUpdate();
    drawCells();
  });
  map.value.on('zoom', () => {
    debouncedUpdate();
    drawCells();
  });
};

/**
 * Initialize the canvas overlay for drawing H3 cell markers.
 */
const initCellsCanvas = () => {
  if (!cellsCanvas.value) return;
  
  cellsCtx.value = cellsCanvas.value.getContext('2d');
  resizeCellsCanvas();
};

/**
 * Resize the canvas overlay to match the window dimensions.
 */
const resizeCellsCanvas = () => {
  if (!cellsCanvas.value) return;
  
  cellsCanvas.value.width = window.innerWidth;
  cellsCanvas.value.height = window.innerHeight;
};

/**
 * Compute all H3 cells at the current resolution that fall within the map bounds.
 * 
 * @returns Array of H3 cell identifiers visible in the current map viewport.
 */
const computeCellsFromBounds = (): string[] => {
  if (!map.value) return [];

  const bounds = map.value.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();

  const polygon: [number, number][] = [
    [sw.lat, sw.lng],
    [ne.lat, sw.lng],
    [ne.lat, ne.lng],
    [sw.lat, ne.lng],
    [sw.lat, sw.lng],
  ];

  return h3.polygonToCells(polygon, H3_RESOLUTION);
};

/**
 * Update the list of visible cells and fetch their types from the API.
 */
const updateVisibleCells = () => {
  if (!map.value) return;

  const cells = computeCellsFromBounds();
  visibleCells.value = cells;
  fetchCellTypes();
  drawCells();
};

/**
 * Debounced version of updateVisibleCells to reduce API calls during map interaction.
 */
const debouncedUpdate = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    updateVisibleCells();
  }, 500);
};

/**
 * Set up window resize listener to handle canvas and map resizing.
 */
const setupEventListeners = () => {
  window.addEventListener('resize', () => {
    resizeCellsCanvas();
    if (map.value) {
      map.value.resize();
    }
  });
};

/**
 * Fetch cell types for visible cells from the API, using cache when available.
 * Updates cache hit/miss statistics.
 */
const fetchCellTypes = async () => {
  abortController?.abort();
  abortController = new AbortController();

  // First, sync cells from localStorage cache to in-memory map
  for (const cell of visibleCells.value) {
    const cachedFromLocalStorage = getCellTypeFromCache(cell);
    if (cachedFromLocalStorage !== null && cachedFromLocalStorage !== 'none') {
      cellTypes.value.set(cell, cachedFromLocalStorage as Exclude<CellType, 'none'>);
      cacheHits.value++;
    }
  }

  // Now determine which cells need to be fetched (not in any cache)
  const cellsToFetch = visibleCells.value.filter(
    cell => cellTypes.value.get(cell) === undefined
  );
  cacheMisses.value = cellsToFetch.length;
  remainingCalls.value = cellsToFetch.length;

  if (cellsToFetch.length > 0) {
    const results = await fetchCellTypesFromService(cellsToFetch, abortController.signal);
    for (const [cell, type] of results) {
      if (type !== 'none') {
        cellTypes.value.set(cell, type);
      }
    }
  }
  remainingCalls.value = 0;
};

/**
 * Draw all visible cells with their POI markers on the canvas overlay.
 */
const drawCells = () => {
  if (!cellsCtx.value || !cellsCanvas.value || !map.value) return;

  const ctx = cellsCtx.value;
  const width = cellsCanvas.value.width;
  const height = cellsCanvas.value.height;

  ctx.clearRect(0, 0, width, height);
  
  visibleCells.value.forEach(cell => {
    const type = cellTypes.value.get(cell);
    if (!type) return;
    const img = typeImages[type];
    drawH3CellImage(ctx, cell, img);
  });
};

/**
 * Draw an H3 cell boundary with a POI marker image at its center.
 * 
 * @param ctx - Canvas rendering context
 * @param h3Index - H3 cell identifier
 * @param img - Marker image to draw at cell center
 */
const drawH3CellImage = (ctx: CanvasRenderingContext2D, h3Index: string, img: HTMLImageElement | null) => {
  if (!map.value || !img) return;
  
  const boundary = h3.cellToBoundary(h3Index);
  
  if (boundary.length === 0) return;
  
  ctx.beginPath();
  
  boundary.forEach((coord, i) => {
    const point = map.value!.project([coord[1], coord[0]]);
    
    if (i === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  
  ctx.closePath();
  ctx.strokeStyle = '#999999';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  const centerLat = boundary.reduce((sum, coord) => sum + coord[0], 0) / boundary.length;
  const centerLng = boundary.reduce((sum, coord) => sum + coord[1], 0) / boundary.length;
  
  const point = map.value.project([centerLng, centerLat]);
  
  const zoom = map.value.getZoom();
  const baseZoom = 13;
  const baseSize = 12;
  const imgSize = baseSize * Math.pow(2, zoom - baseZoom);
  ctx.drawImage(img, point.x - imgSize / 2, point.y - imgSize / 2, imgSize, imgSize);
};
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.map {
  width: 100%;
  height: 100%;
}

.cells-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.controls {
  position: absolute;
  top: 20px;
  left: 20px;
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  z-index: 2;
  max-width: 300px;
}

.controls h3 {
  margin: 0 0 15px 0;
  font-size: 16px;
  color: #333;
}

.stats {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

.stat-item {
  font-size: 12px;
  color: #666;
  padding: 4px 0;
}

ion-content {
  --background: transparent;
}

@supports (padding: max(0px)) {
  .controls {
    top: max(20px, env(safe-area-inset-top));
    left: max(20px, env(safe-area-inset-left));
  }
}
</style>
