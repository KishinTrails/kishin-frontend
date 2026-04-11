<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="map-container">
        <div
          ref="mapContainer"
          class="map"
        />
        <PerlinNoiseOverlay
          v-if="showPerlin"
          :map="map"
          :scale="PERLIN_SCALE"
          :threshold="PERLIN_THRESHOLD"
          :octaves="PERLIN_OCTAVES"
          :amplitude-decay="PERLIN_AMPLITUDE_DECAY"
          @active-cells-change="PERLIN_ACTIVE_CELLS = $event"
        />
        <FogOverlay
          v-if="showFog"
          :map="map"
          :explored-cells="visibleExplored"
          :opacity="FOG_OPACITY"
          :color="FOG_COLOR"
        />
        <PoiOverlay
          v-if="showPoi"
          :map="map"
          :cell-types="cellTypes"
          :visible-cells="visibleExplored"
        />
        <TileSelectOverlay
          v-if="showTileSelect"
          :map="map"
          :selected-cells="selectedCells"
          @selected-cells-change="selectedCells = $event"
        />

        <div class="controls">
          <h3>🗺️ Trail Map</h3>

          <div class="toggles">
            <label class="toggle-item">
              <input
                v-model="showPerlin"
                type="checkbox"
              >
              <span>Perlin Noise</span>
            </label>
            <label class="toggle-item">
              <input
                v-model="showFog"
                type="checkbox"
              >
              <span>Fog Overlay</span>
            </label>
            <label class="toggle-item">
              <input
                v-model="showPoi"
                type="checkbox"
              >
              <span>POI Overlay</span>
            </label>
            <label class="toggle-item">
              <input
                v-model="filterByExplored"
                type="checkbox"
              >
              <span>Explore Mode</span>
            </label>
            <label class="toggle-item">
              <input
                v-model="showTileSelect"
                type="checkbox"
              >
              <span>Tile Selection</span>
            </label>
          </div>

          <div
            v-if="showPerlin"
            class="perlin-controls"
          >
            <h4>Perlin Noise Settings</h4>

            <div class="input-group">
              <label>
                <span>Scale</span>
                <input
                  v-model.number="PERLIN_SCALE"
                  type="number"
                  min="100"
                  max="300"
                  step="1"
                >
              </label>
            </div>

            <div class="input-group">
              <label>
                <span>Octaves</span>
                <input
                  v-model.number="PERLIN_OCTAVES"
                  type="number"
                  min="1"
                  max="10"
                  step="1"
                >
              </label>
            </div>

            <div class="input-group">
              <label>
                <span>Amplitude Decay</span>
                <input
                  v-model.number="PERLIN_AMPLITUDE_DECAY"
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                >
              </label>
            </div>

            <div class="input-group">
              <label>
                <span>Threshold</span>
                <input
                  v-model.number="PERLIN_THRESHOLD"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                >
              </label>
              <div class="stat-item">
                Active cells: {{ PERLIN_ACTIVE_CELLS }}
              </div>
            </div>
          </div>

          <div
            v-if="showTileSelect"
            class="tile-select-controls"
          >
            <div class="stat-item">
              Selected: {{ selectedCells.length }} cells
            </div>
            <div class="button-group">
              <button
                class="btn-clear"
                @click="selectedCells = []"
              >
                Clear Selection
              </button>
              <button
                class="btn-validate"
                @click="validateSelection"
              >
                Validate Selection
              </button>
            </div>
          </div>

          <div class="stats">
            <div class="stat-item">
              Explored: {{ visitedCells.size }}
            </div>
            <div class="stat-item">
              Visible Explored: {{ visibleExplored.length }}
            </div>
            <div class="stat-item">
              Visible Fog: {{ visibleFog.length }}
            </div>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
/**
 * MapPage - Main trail map view with fog-of-war and POI markers.
 *
 * Responsible only for:
 * - Mounting the MapLibre map instance
 * - Wiring map events → composable actions
 * - Passing reactive state down to overlay components as props
 *
 * All business logic lives in trailMap().
 */

import { ref, shallowRef, onMounted, onUnmounted } from 'vue';
import { IonPage, IonContent } from '@ionic/vue';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import FogOverlay from '@/components/FogOverlay.vue';
import PoiOverlay from '@/components/PoiOverlay.vue';
import PerlinNoiseOverlay from '@/components/PerlinNoiseOverlay.vue';
import TileSelectOverlay from '@/components/TileSelectOverlay.vue';
import { useTrailMap } from '@/composables/useTrailMap';

const FOG_OPACITY = 0.85;
const FOG_COLOR = '#1a1a1a';

const PERLIN_SCALE = ref(200);
const PERLIN_THRESHOLD = ref(0.75);
const PERLIN_OCTAVES = ref(3);
const PERLIN_AMPLITUDE_DECAY = ref(0.5);
const PERLIN_ACTIVE_CELLS = ref(0);

const MAP_CENTER: [number, number] = [3.1009225078676246, 45.75259789465471];
const MAP_ZOOM = 16;

const mapContainer = ref<HTMLElement | null>(null);
const map = shallowRef<maplibregl.Map | undefined>(undefined);

const showFog = ref(true);
const showPoi = ref(true);
const showPerlin = ref(false);
const showTileSelect = ref(false);
const selectedCells = ref<string[]>([]);

const {
  visitedCells,
  visibleExplored,
  visibleFog,
  cellTypes,
  filterByExplored,
  loadExploredTiles,
  updateVisibleCells,
  debouncedUpdate,
  fetchCellTypes,
} = useTrailMap();

let resizeListener: (() => void) | null = null;

onMounted(async () => {
  await loadExploredTiles();
  initMap();
});

onUnmounted(() => {
  if (resizeListener) window.removeEventListener('resize', resizeListener);
  map.value?.remove();
});

/**
 * Initialize the MapLibre map instance with OSM tiles.
 */
const initMap = (): void => {
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
          attribution: '© OpenStreetMap contributors',
        },
      },
      layers: [
        {
          id: 'osm',
          type: 'raster',
          source: 'osm',
          minzoom: 0,
          maxzoom: 20
        }
      ],
    },
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
  });

  map.value.addControl(new maplibregl.NavigationControl(), 'top-right');

  // Sync visible cells immediately once the map is ready
  map.value.on('load', () => {
    updateVisibleCells(map.value!.getBounds());
    fetchCellTypes();
  });

  // Debounce updates during pan/zoom to limit API calls
  map.value.on('moveend', () => {
    debouncedUpdate(map.value!.getBounds());
  });

  resizeListener = () => map.value?.resize();
  window.addEventListener('resize', resizeListener);
};

const validateSelection = () => {
  console.log(JSON.stringify({ cells: selectedCells.value }, null, 2));
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

.controls {
  position: absolute;
  top: 20px;
  left: 20px;
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  z-index: 2;
  max-width: 300px;
}

.controls h3 {
  margin: 0 0 15px 0;
  font-size: 16px;
  color: #333;
}

.toggles {
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}

.toggle-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #555;
  cursor: pointer;
  padding: 4px 0;
}

.toggle-item input[type="checkbox"] {
  cursor: pointer;
}

.perlin-controls {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

.perlin-controls h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #444;
}

.input-group {
  margin-bottom: 12px;
}

.input-group label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #666;
}

.input-group input[type="number"] {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 12px;
}

.input-group .toggle-item {
  margin: 0;
  padding: 0;
}

.tile-select-controls {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #eee;
}

.button-group {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.button-group button {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-clear {
  background-color: #e74c3c;
  color: white;
}

.btn-clear:hover {
  background-color: #c0392b;
}

.btn-validate {
  background-color: #27ae60;
  color: white;
}

.btn-validate:hover {
  background-color: #219a52;
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
