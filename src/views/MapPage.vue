<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="map-container">
        <div ref="mapContainer" class="map"></div>
        <canvas ref="cellsCanvas" class="cells-overlay"></canvas>
        
        <div class="controls">
          <h3>🗺️ Trail Map</h3>
          
          <div class="stats">
            <div class="stat-item">Rendered Cells: {{ visibleCells.length }}</div>
          </div>
        </div>

        <div class="legend">
          <h4>Legend</h4>
          <div class="legend-item">
            <span class="legend-color peak"></span>
            <span>Peak</span>
          </div>
          <div class="legend-item">
            <span class="legend-color natural"></span>
            <span>Natural</span>
          </div>
          <div class="legend-item">
            <span class="legend-color industrial"></span>
            <span>Industrial</span>
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

type CellType = 'peak' | 'natural' | 'industrial';

const mapContainer = ref<HTMLElement | null>(null);
const cellsCanvas = ref<HTMLCanvasElement | null>(null);
const map = ref<maplibregl.Map>();
const cellsCtx = ref<CanvasRenderingContext2D | null>(null);

const peakImage = ref<HTMLImageElement | null>(null);
const naturalImage = ref<HTMLImageElement | null>(null);
const industrialImage = ref<HTMLImageElement | null>(null);

const h3Cells = ref<string[]>([
    '8a1f96069aeffff',
    '8a1f96a9a6affff',
    '8a1f96069a07fff',
    '8a1f96334daffff',
    '8a1f96a9a79ffff',
    '8a1f96069a1ffff',
    '8a1f96334da7fff',
    '8a1f96069b5ffff',
    '8a1f96069b6ffff',
    '8a1f96069ae7fff',
    '8a1f96a9a617fff',
    '8a1f96a9a68ffff',
    '8a1f96a9a78ffff',
    '8a1f96a9a637fff',
    '8a1f96a9a787fff',
    '8a1f96334d37fff',
    '8a1f96069b4ffff',
    '8a1f96a9a797fff',
    '8a1f96334d27fff',
    '8a1f96334d07fff',
    '8a1f96069a2ffff',
    '8a1f96069a0ffff',
    '8a1f96334d17fff',
    '891f96069a7ffff',
]);

const cellTypes = ref<Map<string, CellType>>(new Map([
  ['8a1f96069aeffff', 'peak'],
  ['8a1f96a9a6affff', 'natural'],
  ['8a1f96069a07fff', 'industrial'],
  ['8a1f96334daffff', 'peak'],
  ['8a1f96a9a79ffff', 'natural'],
  ['8a1f96069a1ffff', 'peak'],
  ['8a1f96334da7fff', 'natural'],
  ['8a1f96069b5ffff', 'industrial'],
  ['8a1f96069b6ffff', 'peak'],
  ['8a1f96069ae7fff', 'natural'],
  ['8a1f96a9a617fff', 'peak'],
  ['8a1f96a9a68ffff', 'natural'],
  ['8a1f96a9a78ffff', 'peak'],
  ['8a1f96a9a637fff', 'natural'],
  ['8a1f96a9a787fff', 'industrial'],
  ['8a1f96334d37fff', 'peak'],
  ['8a1f96069b4ffff', 'natural'],
  ['8a1f96a9a797fff', 'peak'],
  ['8a1f96334d27fff', 'natural'],
  ['8a1f96334d07fff', 'industrial'],
  ['8a1f96069a2ffff', 'peak'],
  ['8a1f96069a0ffff', 'natural'],
  ['8a1f96334d17fff', 'peak'],
  ['891f96069a7ffff', 'natural'],
]));

const visibleCells = ref<string[]>([]);

const typeImages: Record<CellType, HTMLImageElement | null> = {
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
    processH3Cells();
  }, 100);
});

const loadImages = () => {
  const loadImage = (src: string): HTMLImageElement => {
    const img = new Image();
    img.src = src;
    return img;
  };

  peakImage.value = loadImage('/tori.png');
  naturalImage.value = loadImage('/lumber.png');
  industrialImage.value = loadImage('/factory.png');

  typeImages.peak = peakImage.value;
  typeImages.natural = naturalImage.value;
  typeImages.industrial = industrialImage.value;
};

onUnmounted(() => {
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
    zoom: 13
  });

  map.value.addControl(new maplibregl.NavigationControl(), 'top-right');

  map.value.on('move', drawCells);
  map.value.on('zoom', drawCells);
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

const processH3Cells = () => {
  const uncompacted = h3.uncompactCells(h3Cells.value, 10);
  visibleCells.value = Array.from(new Set(uncompacted));
};

const setupEventListeners = () => {
  window.addEventListener('resize', () => {
    resizeCellsCanvas();
    if (map.value) {
      map.value.resize();
    }
  });
};

const drawCells = () => {
  if (!cellsCtx.value || !cellsCanvas.value || !map.value) return;

  const ctx = cellsCtx.value;
  const width = cellsCanvas.value.width;
  const height = cellsCanvas.value.height;

  ctx.clearRect(0, 0, width, height);
  
  visibleCells.value.forEach(cell => {
    const type = cellTypes.value.get(cell) || 'natural';
    const img = typeImages[type];
    drawH3CellImage(ctx, cell, img);
  });
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

.legend {
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  z-index: 2;
}

.legend h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #333;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
  color: #666;
}

.legend-item:last-child {
  margin-bottom: 0;
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid rgba(0,0,0,0.2);
}

.legend-color.peak {
  background-color: #e74c3c;
}

.legend-color.natural {
  background-color: #27ae60;
}

.legend-color.industrial {
  background-color: #7f8c8d;
}

ion-content {
  --background: transparent;
}

@supports (padding: max(0px)) {
  .controls {
    top: max(20px, env(safe-area-inset-top));
    left: max(20px, env(safe-area-inset-left));
  }
  .legend {
    bottom: max(20px, env(safe-area-inset-bottom));
    left: max(20px, env(safe-area-inset-left));
  }
}
</style>
