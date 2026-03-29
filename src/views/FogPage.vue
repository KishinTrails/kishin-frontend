<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="map-container">
        <div ref="mapContainer" class="map"></div>
        <canvas ref="fogCanvas" class="fog-overlay"></canvas>
        
        <div class="controls">
          <h3>🗺️ Fog of War</h3>
          
          <div class="control-group">
            <label>Fog Opacity</label>
            <ion-range 
              v-model="fogOpacity" 
              :min="0" 
              :max="1" 
              :step="0.05"
              :pin="true"
            ></ion-range>
            <div class="value-display">{{ (fogOpacity * 100).toFixed(0) }}%</div>
          </div>

          <div class="stats">
            <div class="stat-item">Visible Cells: {{ visibleCells.length }}</div>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
/**
 * FogPage - Debug page demonstrating fog-of-war rendering.
 * Displays a canvas overlay with fog that reveals H3 cells.
 */

import { ref, onMounted, onUnmounted } from 'vue';
import { IonPage, IonContent, IonRange } from '@ionic/vue';
import maplibregl from 'maplibre-gl';
import * as h3 from 'h3-js';
import 'maplibre-gl/dist/maplibre-gl.css';

const mapContainer = ref<HTMLElement | null>(null);
const fogCanvas = ref<HTMLCanvasElement | null>(null);
const map = ref<maplibregl.Map>();
const fogCtx = ref<CanvasRenderingContext2D | null>(null);

const fogOpacity = ref(0.85);
const fogColor = ref('#1a1a1a');
const animationFrame = ref<number | null>(null);

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

const visibleCells = ref<string[]>([]);

onMounted(() => {
  setTimeout(() => {
    initMap();
    initFogCanvas();
    setupEventListeners();
    processH3Cells();
    animate();
  }, 100);
});

onUnmounted(() => {
  if (animationFrame.value) {
    cancelAnimationFrame(animationFrame.value);
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
    zoom: 13
  });

  map.value.addControl(new maplibregl.NavigationControl(), 'top-right');

  map.value.on('move', drawFog);
  map.value.on('zoom', drawFog);
};

/**
 * Initialize the canvas overlay for fog rendering.
 */
const initFogCanvas = () => {
  if (!fogCanvas.value) return;
  
  fogCtx.value = fogCanvas.value.getContext('2d');
  resizeFogCanvas();
};

/**
 * Resize the fog canvas to match the window dimensions.
 */
const resizeFogCanvas = () => {
  if (!fogCanvas.value) return;
  
  fogCanvas.value.width = window.innerWidth;
  fogCanvas.value.height = window.innerHeight;
};

/**
 * Uncompact the H3 cells to resolution 10 and remove duplicates.
 */
const processH3Cells = () => {
  const uncompacted = h3.uncompactCells(h3Cells.value, 10);
  visibleCells.value = Array.from(new Set(uncompacted));
};

/**
 * Set up window resize listener to handle canvas and map resizing.
 */
const setupEventListeners = () => {
  window.addEventListener('resize', () => {
    resizeFogCanvas();
    if (map.value) {
      map.value.resize();
    }
  });
};

/**
 * Render the fog of war overlay on the canvas.
 * Fills the screen with semi-transparent color, then cuts out the visible H3 cells.
 */
const drawFog = () => {
  if (!fogCtx.value || !fogCanvas.value || !map.value) return;

  const ctx = fogCtx.value;
  const width = fogCanvas.value.width;
  const height = fogCanvas.value.height;

  ctx.clearRect(0, 0, width, height);
  ctx.save();

  ctx.fillStyle = hexToRgba(fogColor.value, fogOpacity.value);
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = 'destination-out';
  
  visibleCells.value.forEach(cell => {
    drawH3Cell(ctx, cell, true);
  });

  ctx.restore();
};

/**
 * Draw an H3 cell boundary on the canvas.
 * Used for creating "cutouts" in the fog layer.
 * 
 * @param ctx - Canvas rendering context
 * @param h3Index - H3 cell identifier
 * @param fill - If true, fill the cell area (for fog cutout)
 */
const drawH3Cell = (ctx: CanvasRenderingContext2D, h3Index: string, fill: boolean = false) => {
  if (!map.value) return;
  
  const boundary = h3.cellToBoundary(h3Index);
  
  if (boundary.length === 0) return;
  
  ctx.beginPath();
  
  boundary.forEach((coord: number[], i: number) => {
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
 * Animation loop that continuously redraws the fog layer.
 */
const animate = () => {
  drawFog();
  animationFrame.value = requestAnimationFrame(animate);
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

.fog-overlay {
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

.control-group {
  margin-bottom: 16px;
}

.control-group label {
  display: block;
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
}

.value-display {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
  text-align: center;
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
