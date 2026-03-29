<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="map-container">
        <div ref="mapContainer" class="map"></div>
        <canvas ref="rectsCanvas" class="rects-overlay"></canvas>
        
        <div class="controls">
          <h3>📦 Bounding Boxes</h3>
          
          <div class="input-group">
            <label>Bounding Box (south, west, north, east)</label>
            <input 
              type="text" 
              v-model="bboxInput" 
              placeholder="(45.767,2.961,45.775,2.971)"
              @keyup.enter="addBoundingBox"
            />
          </div>
          
          <div class="input-group">
            <label>Color</label>
            <select v-model="selectedColor">
              <option value="#e74c3c">Red</option>
              <option value="#3498db">Blue</option>
              <option value="#27ae60">Green</option>
              <option value="#f39c12">Orange</option>
              <option value="#9b59b6">Purple</option>
              <option value="#1abc9c">Teal</option>
            </select>
          </div>
          
          <button class="add-btn" @click="addBoundingBox">Add Rectangle</button>
          <button class="clear-btn" @click="clearBoundingBoxes" v-if="boundingBoxes.length > 0">Clear All</button>
          
          <div class="stats" v-if="boundingBoxes.length > 0">
            <div class="stat-item">Rectangles: {{ boundingBoxes.length }}</div>
          </div>
          
          <div class="rect-list" v-if="boundingBoxes.length > 0">
            <div class="rect-item" v-for="(box, index) in boundingBoxes" :key="index">
              <span class="rect-color" :style="{ backgroundColor: box.color }"></span>
              <span class="rect-coords">{{ box.south.toFixed(3) }}, {{ box.west.toFixed(3) }}, {{ box.north.toFixed(3) }}, {{ box.east.toFixed(3) }}</span>
              <button class="remove-btn" @click="removeBoundingBox(index)">×</button>
            </div>
          </div>
          
          <div class="h3-section">
            <h4>🔷 H3 Cells</h4>
            
            <div class="input-group">
              <label>H3 Cell ID</label>
              <input 
                type="text" 
                v-model="h3Input" 
                placeholder="8a1f96069aeffff"
                @keyup.enter="addH3Cell"
              />
            </div>
            
            <div class="input-group">
              <label>Color</label>
              <select v-model="selectedH3Color">
                <option value="#9b59b6">Purple</option>
                <option value="#e74c3c">Red</option>
                <option value="#3498db">Blue</option>
                <option value="#f39c12">Orange</option>
                <option value="#27ae60">Green</option>
                <option value="#1abc9c">Teal</option>
              </select>
            </div>
            
            <button class="add-btn add-btn-h3" @click="addH3Cell">Add H3 Cell</button>
            <button class="clear-btn clear-btn-h3" @click="clearH3Cells" v-if="h3Cells.length > 0">Clear All</button>
            
            <div class="stats" v-if="h3Cells.length > 0">
              <div class="stat-item">H3 Cells: {{ h3Cells.length }}</div>
            </div>
            
            <div class="rect-list" v-if="h3Cells.length > 0">
              <div class="rect-item" v-for="(cell, index) in h3Cells" :key="index">
                <span class="rect-color" :style="{ backgroundColor: cell.color }"></span>
                <span class="rect-coords">{{ cell.cellId }}</span>
                <button class="remove-btn" @click="removeH3Cell(index)">×</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
/**
 * RectanglePage - Debug page for visualizing bounding boxes and H3 cells.
 * Allows users to add geographic bounding boxes or H3 cell IDs and see them rendered on a map.
 */

import { ref, onMounted, onUnmounted } from 'vue';
import { IonPage, IonContent } from '@ionic/vue';
import maplibregl from 'maplibre-gl';
import * as h3 from 'h3-js';
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * Represents a geographic bounding box.
 */
interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
  color: string;
}

/**
 * Represents an H3 cell to display on the map.
 */
interface H3Cell {
  cellId: string;
  color: string;
}

const mapContainer = ref<HTMLElement | null>(null);
const rectsCanvas = ref<HTMLCanvasElement | null>(null);
const map = ref<maplibregl.Map>();
const rectsCtx = ref<CanvasRenderingContext2D | null>(null);

const bboxInput = ref('');
const h3Input = ref('');
const selectedColor = ref('#e74c3c');
const selectedH3Color = ref('#9b59b6');

const boundingBoxes = ref<BoundingBox[]>([]);
const h3Cells = ref<H3Cell[]>([]);

const RECT_COLORS = ['#e74c3c', '#3498db', '#27ae60', '#f39c12', '#9b59b6', '#1abc9c'];
const H3_COLORS = ['#9b59b6', '#e74c3c', '#3498db', '#f39c12', '#27ae60', '#1abc9c'];

let colorIndex = 0;
let h3ColorIndex = 0;

onMounted(() => {
  setTimeout(() => {
    initMap();
    initRectsCanvas();
    setupEventListeners();
  }, 100);
});

onUnmounted(() => {
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
    zoom: 13
  });

  map.value.addControl(new maplibregl.NavigationControl(), 'top-right');

  map.value.on('move', drawRectangles);
  map.value.on('zoom', drawRectangles);
};

/**
 * Initialize the canvas overlay for drawing rectangles and H3 cells.
 */
const initRectsCanvas = () => {
  if (!rectsCanvas.value) return;
  
  rectsCtx.value = rectsCanvas.value.getContext('2d');
  resizeRectsCanvas();
};

/**
 * Resize the canvas overlay to match the window dimensions.
 */
const resizeRectsCanvas = () => {
  if (!rectsCanvas.value) return;
  
  rectsCanvas.value.width = window.innerWidth;
  rectsCanvas.value.height = window.innerHeight;
};

/**
 * Set up window resize listener to handle canvas and map resizing.
 */
const setupEventListeners = () => {
  window.addEventListener('resize', () => {
    resizeRectsCanvas();
    if (map.value) {
      map.value.resize();
    }
    drawRectangles();
  });
};

/**
 * Parse and add a bounding box from user input.
 */
const addBoundingBox = () => {
  const parsed = parseBboxInput(bboxInput.value);
  if (!parsed) return;
  
  const { south, west, north, east } = parsed;
  
  boundingBoxes.value.push({
    south,
    west,
    north,
    east,
    color: selectedColor.value
  });
  
  bboxInput.value = '';
  
  colorIndex = (colorIndex + 1) % RECT_COLORS.length;
  selectedColor.value = RECT_COLORS[colorIndex];
  
  drawRectangles();
};

/**
 * Parse a bounding box string in format "(south, west, north, east)".
 * 
 * @param input - User input string
 * @returns Parsed bounding box or null if invalid
 */
const parseBboxInput = (input: string): { south: number; west: number; north: number; east: number } | null => {
  const trimmed = input.trim();
  const match = trimmed.match(/^\(?\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)?$/);
  
  if (!match) return null;
  
  const south = parseFloat(match[1]);
  const west = parseFloat(match[2]);
  const north = parseFloat(match[3]);
  const east = parseFloat(match[4]);
  
  if (isNaN(south) || isNaN(west) || isNaN(north) || isNaN(east)) return null;
  if (south >= north || west >= east) return null;
  
  return { south, west, north, east };
};

/**
 * Remove a bounding box from the list by index.
 * 
 * @param index - Index of the bounding box to remove
 */
const removeBoundingBox = (index: number) => {
  boundingBoxes.value.splice(index, 1);
  drawRectangles();
};

/**
 * Clear all bounding boxes from the list.
 */
const clearBoundingBoxes = () => {
  boundingBoxes.value = [];
  colorIndex = 0;
  selectedColor.value = RECT_COLORS[colorIndex];
  drawRectangles();
};

/**
 * Add an H3 cell to display on the map.
 */
const addH3Cell = () => {
  const cellId = h3Input.value.trim().toLowerCase();
  if (!cellId) return;
  
  if (!/^[0-9a-f]{15,16}$/.test(cellId)) return;
  
  h3Cells.value.push({
    cellId,
    color: selectedH3Color.value
  });
  
  h3Input.value = '';
  
  h3ColorIndex = (h3ColorIndex + 1) % H3_COLORS.length;
  selectedH3Color.value = H3_COLORS[h3ColorIndex];
  
  drawRectangles();
};

/**
 * Remove an H3 cell from the list by index.
 * 
 * @param index - Index of the H3 cell to remove
 */
const removeH3Cell = (index: number) => {
  h3Cells.value.splice(index, 1);
  drawRectangles();
};

/**
 * Clear all H3 cells from the list.
 */
const clearH3Cells = () => {
  h3Cells.value = [];
  h3ColorIndex = 0;
  selectedH3Color.value = H3_COLORS[h3ColorIndex];
  drawRectangles();
};

/**
 * Draw all bounding boxes and H3 cells on the canvas overlay.
 */
const drawRectangles = () => {
  if (!rectsCtx.value || !rectsCanvas.value || !map.value) return;

  const ctx = rectsCtx.value;
  const width = rectsCanvas.value.width;
  const height = rectsCanvas.value.height;

  ctx.clearRect(0, 0, width, height);
  
  boundingBoxes.value.forEach(box => {
    drawBoundingBox(ctx, box);
  });
  
  h3Cells.value.forEach(cell => {
    drawH3Cell(ctx, cell);
  });
};

/**
 * Draw a bounding box on the canvas.
 * 
 * @param ctx - Canvas rendering context
 * @param box - Bounding box to draw
 */
const drawBoundingBox = (ctx: CanvasRenderingContext2D, box: BoundingBox) => {
  if (!map.value) return;
  
  const tl = map.value.project([box.west, box.north]);
  const tr = map.value.project([box.east, box.north]);
  const br = map.value.project([box.east, box.south]);
  const bl = map.value.project([box.west, box.south]);
  
  ctx.beginPath();
  ctx.moveTo(tl.x, tl.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(bl.x, bl.y);
  ctx.closePath();
  
  ctx.fillStyle = hexToRgba(box.color, 0.3);
  ctx.fill();
  
  ctx.strokeStyle = box.color;
  ctx.lineWidth = 2;
  ctx.stroke();
};

/**
 * Convert a hex color string to RGBA format.
 * 
 * @param hex - Hex color string (e.g., "#1a1a1a")
 * @param alpha - Alpha value (0-1)
 * @returns RGBA color string
 */
const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Draw an H3 cell boundary on the canvas.
 * 
 * @param ctx - Canvas rendering context
 * @param cell - H3 cell to draw
 */
const drawH3Cell = (ctx: CanvasRenderingContext2D, cell: H3Cell) => {
  if (!map.value) return;
  
  const polygons = h3.cellsToMultiPolygon([cell.cellId]);
  
  if (!polygons || polygons.length === 0) return;
  
  polygons.forEach(polygon => {
    const outerRing = polygon[0];
    
    ctx.beginPath();
    
    outerRing.forEach((coord, i) => {
      const point = map.value!.project([coord[1], coord[0]]);
      
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    
    ctx.closePath();
    
    ctx.fillStyle = hexToRgba(cell.color, 0.3);
    ctx.fill();
    
    ctx.strokeStyle = cell.color;
    ctx.lineWidth = 2;
    ctx.stroke();
  });
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

.rects-overlay {
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
  max-height: calc(100vh - 100px);
  overflow-y: auto;
}

.controls h3 {
  margin: 0 0 15px 0;
  font-size: 16px;
  color: #333;
}

.input-group {
  margin-bottom: 10px;
}

.input-group label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.input-group input,
.input-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.add-btn {
  width: 100%;
  padding: 10px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  margin-top: 5px;
}

.add-btn:hover {
  background: #2980b9;
}

.clear-btn {
  width: 100%;
  padding: 10px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  margin-top: 8px;
}

.clear-btn:hover {
  background: #c0392b;
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

.rect-list {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

.rect-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 11px;
  color: #666;
}

.rect-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
}

.rect-coords {
  flex: 1;
  word-break: break-all;
}

.remove-btn {
  background: none;
  border: none;
  color: #e74c3c;
  cursor: pointer;
  font-size: 16px;
  padding: 0 4px;
}

.h3-section {
  margin-top: 20px;
  padding-top: 15px;
  border-top: 2px solid #9b59b6;
}

.h3-section h4 {
  margin: 0 0 15px 0;
  font-size: 14px;
  color: #9b59b6;
}

.add-btn-h3 {
  background: #9b59b6;
}

.add-btn-h3:hover {
  background: #8e44ad;
}

.clear-btn-h3 {
  background: #9b59b6;
}

.clear-btn-h3:hover {
  background: #8e44ad;
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
