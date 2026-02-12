<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="map-container">
        <div ref="mapContainer" class="map"></div>
        <canvas ref="fogCanvas" class="fog-overlay"></canvas>
        
        <div class="controls">
          <h3>🗺️ Fog of War</h3>
          
          <!-- Mode Tabs -->
          <div class="mode-tabs">
            <button 
              class="tab-button" 
              :class="{ active: isDevMode }"
              @click="toggleMode"
            >
              🔧 Dev Playground
            </button>
            <button 
              class="tab-button" 
              :class="{ active: !isDevMode }"
              @click="toggleMode"
            >
              🔒 Locked Production
            </button>
          </div>

          <!-- Development Mode Content -->
          <div v-if="isDevMode" class="tab-content">
            <div class="control-group">
              <label>Active Viewports ({{ gpsCoordinates.length }})</label>
              <div class="gps-list">
                <div v-for="(coord, index) in gpsCoordinates" :key="index" class="gps-item">
                  📍 {{ coord.name }} ({{ coord.lat.toFixed(2) }}, {{ coord.lng.toFixed(2) }})
                </div>
              </div>
            </div>
            
            <div class="control-group">
              <label>View Distance (Base)</label>
              <ion-range 
                v-model="baseCircleRadius" 
                :min="50" 
                :max="400" 
                :step="10"
                :pin="true"
                @ionChange="updateCircleRadius"
              ></ion-range>
              <div class="value-display">{{ baseCircleRadius }}px (actual: {{ Math.round(circleRadius) }}px)</div>
            </div>

            <div class="control-group">
              <label>Current Zoom Level</label>
              <div class="value-display zoom-display">{{ currentZoom.toFixed(2) }}</div>
            </div>

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

            <div class="control-group">
              <label>Edge Blur</label>
              <ion-range 
                v-model="edgeBlur" 
                :min="0" 
                :max="100" 
                :step="5"
                :pin="true"
              ></ion-range>
              <div class="value-display">{{ edgeBlur }}px</div>
            </div>

            <div class="control-group">
              <label>🔍 Debug Options</label>
              <div class="debug-options">
                <label class="checkbox-label">
                  <input type="checkbox" v-model="showCircleOutlines">
                  <span>Show circle outlines (red)</span>
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" v-model="showCenterDots">
                  <span>Show center dots</span>
                </label>
              </div>
            </div>
          </div>

          <!-- Locked Production Mode Content -->
          <div v-else class="tab-content locked-content">
            <div class="locked-info">
              <p><strong>🔒 Production Mode Active</strong></p>
              <p>All settings are locked to production values.</p>
            </div>

            <div class="control-group">
              <label>Active Viewports</label>
              <div class="gps-list">
                <div v-for="(coord, index) in gpsCoordinates" :key="index" class="gps-item">
                  📍 {{ coord.name }} ({{ coord.lat.toFixed(2) }}, {{ coord.lng.toFixed(2) }})
                </div>
              </div>
            </div>

            <div class="settings-readonly">
              <h4>Current Settings:</h4>
              <div class="setting-item">
                <span class="setting-label">Base Radius:</span>
                <span class="setting-value">{{ baseCircleRadius }}px</span>
              </div>
              <div class="setting-item">
                <span class="setting-label">Fog Opacity:</span>
                <span class="setting-value">{{ (fogOpacity * 100).toFixed(0) }}%</span>
              </div>
              <div class="setting-item">
                <span class="setting-label">Edge Blur:</span>
                <span class="setting-value">{{ edgeBlur }}px</span>
              </div>
              <div class="setting-item">
                <span class="setting-label">Fog Color:</span>
                <span class="setting-value">{{ fogColor }}</span>
              </div>
              <div class="setting-item">
                <span class="setting-label">Zoom Level:</span>
                <span class="setting-value">{{ currentZoom.toFixed(2) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted } from 'vue';
import { IonPage, IonContent, IonRange, IonButton } from '@ionic/vue';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// =============================================================================
// PRODUCTION SETTINGS - These values are used when in LOCKED mode
// =============================================================================
const PRODUCTION_SETTINGS = {
  baseCircleRadius: 200,
  fogOpacity: 0.85,
  fogColor: '#1a1a1a',
  edgeBlur: 20,
  gpsCoordinates: [
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
{ lat: 48.85542074268142, lng: 2.345938844267552, name: '' },
  ]
};
// =============================================================================

// Refs
const mapContainer = ref<HTMLElement | null>(null);
const fogCanvas = ref<HTMLCanvasElement | null>(null);
const map = shallowRef<maplibregl.Map | null>(null);
const fogCtx = shallowRef<CanvasRenderingContext2D | null>(null);

// Mode toggle (true = development playground, false = locked production)
const isDevMode = ref(true);

// Debug options (only available in dev mode)
const showCircleOutlines = ref(false);
const showCenterDots = ref(false);

// State (editable in dev mode, locked in production mode)
const baseCircleRadius = ref(PRODUCTION_SETTINGS.baseCircleRadius);
const circleRadius = ref(250); // Calculated dynamically
const fogOpacity = ref(PRODUCTION_SETTINGS.fogOpacity);
const fogColor = ref(PRODUCTION_SETTINGS.fogColor);
const edgeBlur = ref(PRODUCTION_SETTINGS.edgeBlur);
const animationFrame = ref<number | null>(null);
const currentZoom = ref(4);

// GPS coordinates for viewports
const gpsCoordinates = ref([...PRODUCTION_SETTINGS.gpsCoordinates]);

// Store screen positions for each GPS coordinate
const viewportPositions = ref<Array<{ x: number; y: number; name: string }>>([]);

onMounted(() => {
  // Wait for DOM to be ready
  setTimeout(() => {
    initMap();
    initFogCanvas();
    setupEventListeners();
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
          maxzoom: 19
        }
      ]
    },
    center: [2.3522, 48.8566], // Paris
    zoom: 4
  });

  // Add navigation controls
  map.value.addControl(new maplibregl.NavigationControl(), 'top-right');

  // Update circle radius when zoom changes
  map.value.on('zoom', updateCircleRadius);
  
  // Update viewport positions when map moves or zooms
  map.value.on('move', updateViewportPositions);
  map.value.on('zoom', updateViewportPositions);
  
  // Initial radius calculation and positions
  map.value.on('load', () => {
    updateCircleRadius();
    updateViewportPositions();
  });
};

const initFogCanvas = () => {
  if (!fogCanvas.value) return;
  
  fogCtx.value = fogCanvas.value.getContext('2d');
  resizeFogCanvas();
};

const resizeFogCanvas = () => {
  if (!fogCanvas.value) return;
  
  fogCanvas.value.width = window.innerWidth;
  fogCanvas.value.height = window.innerHeight;
};

const updateCircleRadius = () => {
  if (!map.value) return;
  
  const zoom = map.value.getZoom();
  currentZoom.value = zoom;
  
  // Calculate radius based on zoom level
  // The circle covers the same geographic area regardless of zoom
  // Formula: radius increases with zoom level (higher zoom = more pixels for same geographic area)
  // We use zoom level 10 as reference point
  const referenceZoom = 17;
  const zoomDifference = zoom - referenceZoom;
  
  // At zoom 10, use baseCircleRadius
  // Each zoom level doubles the radius (higher zoom = bigger circle in pixels)
  circleRadius.value = baseCircleRadius.value * Math.pow(2, zoomDifference);
};

const updateViewportPositions = () => {
  if (!map.value) return;
  
  // Convert each GPS coordinate to screen position
  viewportPositions.value = gpsCoordinates.value.map(coord => {
    const point = map.value!.project([coord.lng, coord.lat]);
    return {
      x: point.x,
      y: point.y,
      name: coord.name
    };
  });
};

const applyProductionSettings = () => {
  // Apply all production settings when switching to locked mode
  baseCircleRadius.value = PRODUCTION_SETTINGS.baseCircleRadius;
  fogOpacity.value = PRODUCTION_SETTINGS.fogOpacity;
  fogColor.value = PRODUCTION_SETTINGS.fogColor;
  edgeBlur.value = PRODUCTION_SETTINGS.edgeBlur;
  gpsCoordinates.value = [...PRODUCTION_SETTINGS.gpsCoordinates];
  
  // Recalculate everything
  updateCircleRadius();
  updateViewportPositions();
};

const toggleMode = () => {
  isDevMode.value = !isDevMode.value;
  
  // When switching to locked mode, apply production settings
  if (!isDevMode.value) {
    applyProductionSettings();
  }
};

const setupEventListeners = () => {
  // Handle window resize (orientation changes on mobile)
  window.addEventListener('resize', () => {
    resizeFogCanvas();
    if (map.value) {
      map.value.resize();
    }
  });
};

const drawFog = () => {
  if (!fogCtx.value || !fogCanvas.value) return;

  const ctx = fogCtx.value;
  const width = fogCanvas.value.width;
  const height = fogCanvas.value.height;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Create fog layer with circular cutout
  ctx.save();

  // Fill entire canvas with fog
  ctx.fillStyle = hexToRgba(fogColor.value, fogOpacity.value);
  ctx.fillRect(0, 0, width, height);

  // Use composite operation to cut out the visible circles
  ctx.globalCompositeOperation = 'destination-out';

  // Ensure we have a valid radius
  const radius = Math.max(1, circleRadius.value);
  const blur = Math.min(edgeBlur.value, radius * 0.9);
  const innerRadius = Math.max(0, radius - blur);
  const outerRadius = radius;

  // Draw circles at GPS-based viewport positions
  viewportPositions.value.forEach(pos => {
    const gradient = ctx.createRadialGradient(
      pos.x, pos.y, innerRadius,
      pos.x, pos.y, outerRadius
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, outerRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  });

  ctx.restore();

  // Draw debug visualizations (after restoring context)
  if (isDevMode.value && (showCircleOutlines.value || showCenterDots.value)) {
    ctx.save();
    
    viewportPositions.value.forEach(pos => {
      // Draw red circle outline
      if (showCircleOutlines.value) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, outerRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Draw center dot
      if (showCenterDots.value) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = 'red';
        ctx.fill();
        
        // Draw a small cross for precision
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pos.x - 10, pos.y);
        ctx.lineTo(pos.x + 10, pos.y);
        ctx.moveTo(pos.x, pos.y - 10);
        ctx.lineTo(pos.x, pos.y + 10);
        ctx.stroke();
      }
    });
    
    ctx.restore();
  }
};

const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

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

.mode-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 15px;
}

.tab-button {
  flex: 1;
  padding: 10px 12px;
  border: 2px solid #ddd;
  background: white;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-button:hover {
  border-color: #007bff;
  background: #f8f9fa;
}

.tab-button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.tab-content {
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.locked-info {
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 15px;
}

.locked-info p {
  margin: 0;
  font-size: 13px;
  color: #856404;
}

.locked-info p:first-child {
  font-weight: 600;
  margin-bottom: 4px;
}

.settings-readonly {
  background: #f8f9fa;
  border-radius: 6px;
  padding: 12px;
  margin-top: 15px;
}

.settings-readonly h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #333;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid #e0e0e0;
  font-size: 13px;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-label {
  color: #666;
  font-weight: 500;
}

.setting-value {
  color: #007bff;
  font-weight: 600;
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

.zoom-display {
  font-weight: bold;
  color: #007bff;
  font-size: 14px;
}

.gps-list {
  max-height: 150px;
  overflow-y: auto;
  background: #f5f5f5;
  border-radius: 4px;
  padding: 8px;
}

.gps-item {
  font-size: 12px;
  padding: 4px;
  color: #333;
  border-bottom: 1px solid #e0e0e0;
}

.gps-item:last-child {
  border-bottom: none;
}

.debug-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.checkbox-label span {
  user-select: none;
}

/* Ensure proper rendering on mobile */
ion-content {
  --background: transparent;
}

/* Fix for iOS safe areas */
@supports (padding: max(0px)) {
  .controls {
    top: max(20px, env(safe-area-inset-top));
    left: max(20px, env(safe-area-inset-left));
  }
}
</style>
