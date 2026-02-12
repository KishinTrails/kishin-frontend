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
{ lat: 45.68866353482008, lng: 2.9987939167767763, name: '' },
{ lat: 45.68844627588987, lng: 2.999117039144039, name: '' },
{ lat: 45.68820680491626, lng: 2.999348547309637, name: '' },
{ lat: 45.68794151768088, lng: 2.9995083063840866, name: '' },
{ lat: 45.68764538504183, lng: 2.999691031873226, name: '' },
{ lat: 45.68736073561013, lng: 2.999826315790415, name: '' },
{ lat: 45.68704859353602, lng: 2.9999315924942493, name: '' },
{ lat: 45.68675204180181, lng: 2.9999516252428293, name: '' },
{ lat: 45.68647208623588, lng: 2.999864788725972, name: '' },
{ lat: 45.68622331134975, lng: 2.9996717534959316, name: '' },
{ lat: 45.68592248484492, lng: 2.9995182808488607, name: '' },
{ lat: 45.68565359339118, lng: 2.9994291812181473, name: '' },
{ lat: 45.68536676466465, lng: 2.999324658885598, name: '' },
{ lat: 45.68508052267134, lng: 2.999280821532011, name: '' },
{ lat: 45.684806602075696, lng: 2.9992073122411966, name: '' },
{ lat: 45.684518683701754, lng: 2.9991823341697454, name: '' },
{ lat: 45.684267058968544, lng: 2.999011343345046, name: '' },
{ lat: 45.68424476310611, lng: 2.9986206628382206, name: '' },
{ lat: 45.68454693071544, lng: 2.9984139651060104, name: '' },
{ lat: 45.68485060706735, lng: 2.9984330758452415, name: '' },
{ lat: 45.68511111661792, lng: 2.998558385297656, name: '' },
{ lat: 45.685462821274996, lng: 2.998443301767111, name: '' },
{ lat: 45.68571863695979, lng: 2.9982793517410755, name: '' },
{ lat: 45.68599498830736, lng: 2.9981041699647903, name: '' },
{ lat: 45.68623689003289, lng: 2.99783150665462, name: '' },
{ lat: 45.686442498117685, lng: 2.9975575022399426, name: '' },
{ lat: 45.68631559610367, lng: 2.9972069710493088, name: '' },
{ lat: 45.686282739043236, lng: 2.9967806674540043, name: '' },
{ lat: 45.68607813678682, lng: 2.9964286275207996, name: '' },
{ lat: 45.685816537588835, lng: 2.996178762987256, name: '' },
{ lat: 45.68553783930838, lng: 2.996174404397607, name: '' },
{ lat: 45.68527397699654, lng: 2.9963084310293198, name: '' },
{ lat: 45.68514238111675, lng: 2.9959609173238277, name: '' },
{ lat: 45.68501480855048, lng: 2.99557501450181, name: '' },
{ lat: 45.68471138365567, lng: 2.9955778643488884, name: '' },
{ lat: 45.684439139440656, lng: 2.9957677144557238, name: '' },
{ lat: 45.684207044541836, lng: 2.9960028268396854, name: '' },
{ lat: 45.68398576229811, lng: 2.9957101307809353, name: '' },
{ lat: 45.684030102565885, lng: 2.995312660932541, name: '' },
{ lat: 45.68389976397157, lng: 2.994969841092825, name: '' },
{ lat: 45.68376456387341, lng: 2.994550745934248, name: '' },
{ lat: 45.68373489193618, lng: 2.9940807726234198, name: '' },
{ lat: 45.683671440929174, lng: 2.993633011355996, name: '' },
{ lat: 45.683767748996615, lng: 2.9932273272424936, name: '' },
{ lat: 45.68398769013584, lng: 2.9928680788725615, name: '' },
{ lat: 45.684218779206276, lng: 2.9925868660211563, name: '' },
{ lat: 45.6843972299248, lng: 2.9922021366655827, name: '' },
{ lat: 45.68456721492112, lng: 2.9918157309293747, name: '' },
{ lat: 45.68480827845633, lng: 2.991620684042573, name: '' },
{ lat: 45.6851501762867, lng: 2.9916155710816383, name: '' },
{ lat: 45.6851517688483, lng: 2.992061236873269, name: '' },
{ lat: 45.685149505734444, lng: 2.9924793262034655, name: '' },
{ lat: 45.685129472985864, lng: 2.9929602798074484, name: '' },
{ lat: 45.685196947306395, lng: 2.9933808837085962, name: '' },
{ lat: 45.685356790199876, lng: 2.9937047604471445, name: '' },
{ lat: 45.68555862642825, lng: 2.993990834802389, name: '' },
{ lat: 45.68572249263525, lng: 2.994310772046447, name: '' },
{ lat: 45.686030611395836, lng: 2.99448536708951, name: '' },
{ lat: 45.68630545400083, lng: 2.9944499116390944, name: '' },
{ lat: 45.686659002676606, lng: 2.9943679366260767, name: '' },
{ lat: 45.68693778477609, lng: 2.994268862530589, name: '' },
{ lat: 45.68728035315871, lng: 2.994066523388028, name: '' },
{ lat: 45.6875488255173, lng: 2.993989074602723, name: '' },
{ lat: 45.68786071613431, lng: 2.9940390307456255, name: '' },
{ lat: 45.68815911188722, lng: 2.9940375220030546, name: '' },
{ lat: 45.68847645074129, lng: 2.9939500987529755, name: '' },
{ lat: 45.68874768912792, lng: 2.9939847998321056, name: '' },
{ lat: 45.689049186185, lng: 2.9939618334174156, name: '' },
{ lat: 45.68924641236663, lng: 2.9936541337519884, name: '' },
{ lat: 45.68947121500969, lng: 2.9934164229780436, name: '' },
{ lat: 45.689746057614684, lng: 2.9934211168438196, name: '' },
{ lat: 45.689902463927865, lng: 2.993744323030114, name: '' },
{ lat: 45.689839934930205, lng: 2.9941878095269203, name: '' },
{ lat: 45.689746057614684, lng: 2.9946522507816553, name: '' },
{ lat: 45.69004747085273, lng: 2.994949808344245, name: '' },
{ lat: 45.69020848721266, lng: 2.995286090299487, name: '' },
{ lat: 45.690422812476754, lng: 2.9955755174160004, name: '' },
{ lat: 45.690701426938176, lng: 2.995779952034354, name: '' },
{ lat: 45.690898820757866, lng: 2.996158814057708, name: '' },
{ lat: 45.69094332866371, lng: 2.9965406097471714, name: '' },
{ lat: 45.69099973887205, lng: 2.9970233235508204, name: '' },
{ lat: 45.69081609137356, lng: 2.997364467009902, name: '' },
{ lat: 45.6905463617295, lng: 2.9976243060082197, name: '' },
{ lat: 45.69029934704304, lng: 2.9978959634900093, name: '' },
{ lat: 45.690139001235366, lng: 2.9982166551053524, name: '' },
{ lat: 45.68983188830316, lng: 2.9984007216989994, name: '' },
{ lat: 45.689548160880804, lng: 2.9984866362065077, name: '' },
{ lat: 45.68927432410419, lng: 2.998513290658593, name: '' },
{ lat: 45.68898556753993, lng: 2.998586967587471, name: '' },
{ lat: 45.68872950039804, lng: 2.998816045001149, name: '' },
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
