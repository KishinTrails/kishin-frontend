<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="map-container">
        <div ref="mapContainer" class="map"></div>
        <canvas ref="cellsCanvas" class="cells-overlay"></canvas>
        
        <div class="controls">
          <h3>🗺️ Trail Map</h3>
          
          <div class="stats">
            <div class="stat-item">Explored: {{ visitedCells.size }}</div>
            <div class="stat-item">Visible Explored: {{ visibleExplored.length }}</div>
            <div class="stat-item">Visible Fog: {{ visibleFog.length }}</div>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { IonPage, IonContent } from '@ionic/vue';
import maplibregl from 'maplibre-gl';
import * as h3 from 'h3-js';
import 'maplibre-gl/dist/maplibre-gl.css';
import { fetchCellTypes as fetchCellTypesFromService } from '@/services/poiService';
import { getCellTypeFromCache } from '@/services/cacheService';
import { fetchExploredTiles } from '@/services/trailsService';

type CellTypeKey = 'peak' | 'natural' | 'industrial';

const H3_RESOLUTION = 10;

const mapContainer = ref<HTMLElement | null>(null);
const cellsCanvas = ref<HTMLCanvasElement | null>(null);
const map = ref<maplibregl.Map>();
const cellsCtx = ref<CanvasRenderingContext2D | null>(null);

const peakImage = ref<HTMLImageElement | null>(null);
const naturalImage = ref<HTMLImageElement | null>(null);
const industrialImage = ref<HTMLImageElement | null>(null);

const cellTypes = ref<Map<string, CellTypeKey | null>>(new Map());
const visitedCells = ref<Set<string>>(new Set());

const visibleCells = ref<string[]>([]);
const visibleExplored = ref<string[]>([]);
const visibleFog = ref<string[]>([]);

const fogOpacity = ref(0.85);
const fogColor = ref('#1a1a1a');

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let abortController: AbortController | null = null;

const typeImages: Record<CellTypeKey, HTMLImageElement | null> = {
  peak: null,
  natural: null,
  industrial: null
};

onMounted(async () => {
  await loadExploredTiles();
  loadImages();
  setTimeout(() => {
    initMap();
    initCellsCanvas();
    setupEventListeners();
    updateVisibleCells();
  }, 100);
});

const loadExploredTiles = async () => {
  try {
    const explored = await fetchExploredTiles();
    visitedCells.value = new Set(explored);
  } catch (err) {
    console.error('Failed to load explored tiles:', err);
  }
};

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

const initCellsCanvas = () => {
  if (!cellsCanvas.value) return;
  
  cellsCtx.value = cellsCanvas.value.getContext('2d');
  resizeCellsCanvas();
};

const resizeCellsCanvas = () => {
  if (!cellsCanvas.value) return;
  
  cellsCanvas.value.width = window.innerWidth;
  cellsCanvas.value.height = window.innerHeight;
};

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

const updateVisibleCells = () => {
  if (!map.value) return;

  const cells = computeCellsFromBounds();
  visibleCells.value = cells;
  
  const explored: string[] = [];
  const fog: string[] = [];

  for (const cell of cells) {
    if (visitedCells.value.has(cell)) {
      explored.push(cell);
    } else {
      fog.push(cell);
    }
  }

  visibleExplored.value = explored;
  visibleFog.value = fog;
  
  fetchCellTypes();
};

const debouncedUpdate = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    updateVisibleCells();
  }, 500);
};

const setupEventListeners = () => {
  window.addEventListener('resize', () => {
    resizeCellsCanvas();
    if (map.value) {
      map.value.resize();
    }
  });
};

const fetchCellTypes = async () => {
  abortController?.abort();
  abortController = new AbortController();

  const cellsToFetch: string[] = [];

  for (const cell of visibleExplored.value) {
    if (cellTypes.value.has(cell)) continue;
    
    const cached = getCellTypeFromCache(cell);
    if (cached !== null && cached !== 'none') {
      cellTypes.value.set(cell, cached as CellTypeKey);
    } else {
      cellsToFetch.push(cell);
    }
  }

  if (cellsToFetch.length > 0) {
    const results = await fetchCellTypesFromService(cellsToFetch, abortController.signal);
    for (const [cell, type] of results) {
      if (type !== 'none') {
        cellTypes.value.set(cell, type as CellTypeKey);
      }
    }
    drawCells();
  }
};

const drawCells = () => {
  if (!cellsCtx.value || !cellsCanvas.value || !map.value) return;

  const ctx = cellsCtx.value;
  const width = cellsCanvas.value.width;
  const height = cellsCanvas.value.height;

  ctx.clearRect(0, 0, width, height);
  
  drawFogLayer();
  drawPoiMarkers();
};

const drawFogLayer = () => {
  if (!cellsCtx.value || !cellsCanvas.value || !map.value || visibleFog.value.length === 0) return;

  const ctx = cellsCtx.value;
  const width = cellsCanvas.value.width;
  const height = cellsCanvas.value.height;

  ctx.save();
  
  ctx.fillStyle = hexToRgba(fogColor.value, fogOpacity.value);
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = 'destination-out';
  
  for (const cell of visibleExplored.value) {
    drawH3Cell(ctx, cell, true);
  }

  ctx.restore();
};

const drawPoiMarkers = () => {
  if (!cellsCtx.value || !map.value) return;

  for (const cell of visibleExplored.value) {
    const type = cellTypes.value.get(cell);
    if (!type) continue;
    const img = typeImages[type as CellTypeKey];
    drawH3CellImage(cellsCtx.value, cell, img);
  }
};

const drawH3Cell = (ctx: CanvasRenderingContext2D, h3Index: string, fill: boolean = false) => {
  if (!map.value) return;
  
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
  
  if (fill) {
    ctx.fillStyle = 'rgba(0, 0, 0, 1)';
    ctx.fill();
  }
};

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

const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
