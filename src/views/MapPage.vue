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
          v-if="showFog && filterByExplored"
          :map="map"
          :explored-cells="visibleExplored"
          :opacity="FOG_OPACITY"
          :color="FOG_COLOR"
          :player-position="fogCenter"
          :fog-radius-km="FOG_RADIUS_KM"
          :fog-mode="fogMode"
        />
        <PoiOverlay
          v-if="showPoi"
          :map="map"
          :cell-types="cellTypes"
          :visible-cells="filterByExplored ? visibleExplored : visibleCells"
        />
        <TileSelectOverlay
          v-if="showTileSelect"
          :map="map"
          :selected-cells="selectedCells"
          :tile-groups="tileGroups"
          :active-group-index="activeGroupIndex"
          @toggle-cell="toggleCellInGroup"
          @clear-all-cells="clearAllGroupCells"
        />
        <GpsTracker style="position: absolute; bottom: 20px; right: 20px; z-index: 2;" />

        <button
          v-if="!showControls"
          class="controls-toggle"
          :class="controlsTheme"
          @click="showControls = true"
        >
          ☰
        </button>

        <div
          v-show="showControls"
          class="controls"
          :class="controlsTheme"
        >
          <div class="controls-header">
            <h3>Kishin Trails</h3>
            <button
              class="controls-close"
              @click="showControls = false"
            >
              ✕
            </button>
          </div>

          <div class="map-style-select">
            <select v-model="mapStyle">
              <option value="standard">
                Standard
              </option>
              <option value="ukiyo-e">
                Ukiyo-e
              </option>
              <option value="ukiyo-toner">
                Ukiyo Toner
              </option>
            </select>
          </div>

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
                :disabled="!filterByExplored"
              >
              <span>Fog Overlay</span>
            </label>
            <div
              v-if="showFog && filterByExplored"
              class="fog-mode-radios"
            >
              <label class="toggle-item">
                <input
                  v-model="fogMode"
                  type="radio"
                  value="flat"
                >
                <span>Flat</span>
              </label>
              <label class="toggle-item">
                <input
                  v-model="fogMode"
                  type="radio"
                  value="gradient"
                >
                <span>Gradient</span>
              </label>
            </div>
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
            <div class="input-group">
              <label>
                <span>Load Config</span>
                <input
                  type="file"
                  accept=".json"
                  @change="loadPerlinConfig"
                >
              </label>
            </div>
            <div
              v-if="tileGroups.length > 0"
              class="tile-groups-list"
            >
              <div class="group-header">
                Groups
              </div>
              <div
                v-for="(group, index) in tileGroups"
                :key="index"
                class="tile-group-item"
              >
                <input
                  :id="'group-' + index"
                  v-model="activeGroupIndex"
                  type="radio"
                  :value="index"
                >
                <label :for="'group-' + index">
                  <span
                    class="group-color"
                    :style="{ backgroundColor: group.color }"
                  />
                  <span class="group-name">{{ group.condition.comment }}</span>
                  <span class="group-type">({{ group.condition.type }})</span>
                </label>
              </div>
            </div>
            <div class="button-group">
              <button
                class="btn-clear"
                @click="clearAllGroupCells"
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
          </div>

          <button
            class="btn-logout"
            @click="handleLogout"
          >
            Logout
          </button>
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

import { ref, shallowRef, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { IonPage, IonContent } from '@ionic/vue';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { ukiyoEStyle } from '@/styles/ukiyoE';
import { ukiyoeTonerStyle, addTonerPatterns } from '@/styles/ukiyoeToner';
import FogOverlay from '@/components/FogOverlay.vue';
import PoiOverlay from '@/components/PoiOverlay.vue';
import PerlinNoiseOverlay from '@/components/PerlinNoiseOverlay.vue';
import TileSelectOverlay from '@/components/TileSelectOverlay.vue';
import { useTrailMap } from '@/composables/useTrailMap';
import { useTrailTracker } from '@/composables/useTrailTracker';
import { logout } from '@/services/authService';
import { saveMapStyle, loadMapStyle, styleToThemeClass } from '@/services/mapStyleService';
import GpsTracker from '@/components/GpsTracker.vue';
import { randomColor } from '@/utils/color';
import { cellFromLatLng, cellToToken } from '@/utils/s2Utils';
import type { PerlinConfig, TileGroup } from '@/types/perlinConfig';

const FOG_OPACITY = 0.90;
const FOG_COLOR = '#1a1a1a';
const FOG_RADIUS_KM = 1.25;

const STANDARD_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 20 }],
};

const PERLIN_SCALE = ref(200);
const PERLIN_THRESHOLD = ref(0.75);
const PERLIN_OCTAVES = ref(3);
const PERLIN_AMPLITUDE_DECAY = ref(0.5);
const PERLIN_ACTIVE_CELLS = ref(0);

const MAP_CENTER: [number, number] = [3.1009225078676246, 45.75259789465471];
const MAP_ZOOM = 16;

const mapContainer = ref<HTMLElement | null>(null);
const map = shallowRef<maplibregl.Map | undefined>(undefined);
const marker = shallowRef<maplibregl.Marker | undefined>(undefined);

const fogCenter = computed(() =>
  lastPosition.value
    ? { lat: lastPosition.value.latitude, lng: lastPosition.value.longitude }
    : { lat: MAP_CENTER[1], lng: MAP_CENTER[0] }
);

const STYLE_MAP = {
  'standard':    STANDARD_STYLE,
  'ukiyo-e':     ukiyoEStyle,
  'ukiyo-toner': ukiyoeTonerStyle,
} as const;

const showFog = ref(true);
const fogMode = ref<'flat' | 'gradient'>('flat');
const mapStyle = ref(loadMapStyle());
const showControls = ref(window.innerWidth >= 768);
const showPoi = ref(true);
const showPerlin = ref(false);
const showTileSelect = ref(false);
const selectedCells = ref<string[]>([]);
const tileGroups = ref<TileGroup[]>([]);
const activeGroupIndex = ref(0);
const cellToGroup = ref<Map<string, number>>(new Map());

const {
  visitedCells,
  visibleCells,
  visibleExplored,
  cellTypes,
  filterByExplored,
  loadExploredTiles,
  updateVisibleCells,
  debouncedUpdate,
  fetchCellTypes,
  fetchCellTypeForNewExplored,
} = useTrailMap();

/**
 * True when any active feature needs full viewport S2 cell enumeration.
 * Add new modes that require cellsFromBounds here.
 */
const needsEnumeration = computed(() =>
  !filterByExplored.value && (showPoi.value || showTileSelect.value)
);

const { lastPosition } = useTrailTracker();

const controlsTheme = computed(() => styleToThemeClass(mapStyle.value));

const router = useRouter();

watch(lastPosition, (pos) => {
  if (!map.value) return;

  if (!pos) {
    marker.value?.remove();
    marker.value = undefined;
    return;
  }

  const el = document.createElement('div');
  el.className = 'location-marker';
  el.style.width = '20px';
  el.style.height = '20px';
  el.style.backgroundColor = '#4285F4';
  el.style.border = '3px solid white';
  el.style.borderRadius = '50%';
  el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
  el.style.cursor = 'pointer';

  if (marker.value) {
    marker.value.setLngLat([pos.longitude, pos.latitude]);
  } else {
    marker.value = new maplibregl.Marker({ element: el })
      .setLngLat([pos.longitude, pos.latitude])
      .addTo(map.value);
  }

  const cell = cellFromLatLng(pos.latitude, pos.longitude);
  const token = cellToToken(cell);
  visitedCells.value.add(token);
  fetchCellTypeForNewExplored(token);
});

watch(mapStyle, (style) => {
  saveMapStyle(style);
  if (!map.value) return;
  map.value.setStyle(STYLE_MAP[style]);
});

watch(needsEnumeration, () => {
  if (!map.value) return;
  updateVisibleCells(map.value.getBounds(), needsEnumeration.value);
  fetchCellTypes();
});

const handleLogout = () => {
  logout();
  router.replace('/login');
};

let resizeListener: (() => void) | null = null;

onMounted(async () => {
  await loadExploredTiles();
  initMap();
});

onUnmounted(() => {
  if (resizeListener) window.removeEventListener('resize', resizeListener);
  marker.value?.remove();
  map.value?.remove();
});

/**
 * Initialize the MapLibre map instance with OSM tiles.
 */
const initMap = (): void => {
  if (!mapContainer.value) return;

  map.value = new maplibregl.Map({
    container: mapContainer.value,
    style: STYLE_MAP[mapStyle.value],
    center: MAP_CENTER,
    zoom: MAP_ZOOM,
  });

  map.value.addControl(new maplibregl.NavigationControl(), 'top-right');

  // Sync visible cells immediately once the map is ready
  map.value.on('load', () => {
    updateVisibleCells(map.value!.getBounds(), needsEnumeration.value);
    fetchCellTypes();
  });

  // Add custom pattern images on demand — fires when a layer references an image
  // not found in the current sprite, guaranteeing MapLibre retries the render.
  map.value.on('styleimagemissing', (e: { id: string }) => {
    if (e.id === 'building-stripe') addTonerPatterns(map.value!);
  });

  // Debounce updates during pan/zoom to limit API calls
  map.value.on('moveend', () => {
    debouncedUpdate(map.value!.getBounds(), needsEnumeration.value);
  });

  resizeListener = () => map.value?.resize();
  window.addEventListener('resize', resizeListener);
};

const validateSelection = () => {
  const output = {
    conditions: tileGroups.value.map(({ condition }) => ({
      comment: condition.comment,
      type: condition.type,
      min: condition.min,
      max: condition.max,
      cells: condition.cells
    }))
  };
  console.log(JSON.stringify(output, null, 2));
};

const loadPerlinConfig = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const text = await file.text();
  const config: PerlinConfig = JSON.parse(text);
  tileGroups.value = config.conditions.map(c => ({
    condition: { ...c, cells: [...c.cells] },
    color: randomColor()
  }));
  activeGroupIndex.value = 0;
  cellToGroup.value = new Map(
    tileGroups.value.flatMap((group, groupIndex) =>
      group.condition.cells.map(cell => [cell, groupIndex] as [string, number])
    )
  );
  selectedCells.value = tileGroups.value.flatMap(g => g.condition.cells);
};

const toggleCellInGroup = (cell: string) => {
  if (cellToGroup.value.has(cell) && cellToGroup.value.get(cell) !== activeGroupIndex.value) {
    const oldGroupIndex = cellToGroup.value.get(cell)!;
    tileGroups.value[oldGroupIndex].condition.cells =
      tileGroups.value[oldGroupIndex].condition.cells.filter(c => c !== cell);
  }

  const groupCells = tileGroups.value[activeGroupIndex.value].condition.cells;
  if (groupCells.includes(cell)) {
    tileGroups.value[activeGroupIndex.value].condition.cells =
      groupCells.filter(c => c !== cell);
    cellToGroup.value.delete(cell);
  } else {
    tileGroups.value[activeGroupIndex.value].condition.cells.push(cell);
    cellToGroup.value.set(cell, activeGroupIndex.value);
  }

  selectedCells.value = tileGroups.value.flatMap(g => g.condition.cells);
};

const clearAllGroupCells = () => {
  tileGroups.value.forEach((group) => {
    group.condition.cells.forEach(cell => {
      cellToGroup.value.delete(cell);
    });
    group.condition.cells = [];
  });
  selectedCells.value = [];
};
</script>

<style scoped>
/* ── Theme tokens ────────────────────────────────────────────────────────────
   Defined on .controls so all descendant rules can inherit via var().        */
.theme-standard {
  --c-bg:               white;
  --c-bg-input:         white;
  --c-bg-list:          #f8f8f8;
  --c-panel-border:     transparent;
  --c-divider:          #eee;
  --c-input-border:     #ccc;
  --c-box-shadow:       0 2px 10px rgba(0, 0, 0, 0.3);
  --c-text:             #333;
  --c-text-sub:         #555;
  --c-text-muted:       #666;
  --c-text-btn:         white;
  --c-accent:           #3498db;
  --c-btn-validate:     #27ae60;
  --c-btn-validate-h:   #219a52;
  --c-btn-clear:        #e74c3c;
  --c-btn-clear-h:      #c0392b;
  --c-btn-logout:       #95a5a6;
  --c-btn-logout-h:     #7f8c8d;
}

/* ukiyo-e palette: washi paper / sumi ink / prussian blue / ochre / parchment */
.theme-ukiyo {
  --c-bg:               #E8D5A3;
  --c-bg-input:         #F0E4BB;
  --c-bg-list:          #DEC98E;
  --c-panel-border:     #B4A07A;
  --c-divider:          #B4A07A;
  --c-input-border:     #B4A07A;
  --c-box-shadow:       0 3px 14px rgba(26, 43, 77, 0.22);
  --c-text:             #1A2B4D;
  --c-text-sub:         #1A2B4D;
  --c-text-muted:       #6B5A3E;
  --c-text-btn:         #E8D5A3;
  --c-accent:           #4A6B8A;
  --c-btn-validate:     #4A6B8A;
  --c-btn-validate-h:   #3A5570;
  --c-btn-clear:        #8B6914;
  --c-btn-clear-h:      #6B4F10;
  --c-btn-logout:       #6B5A3E;
  --c-btn-logout-h:     #4E4230;
}

/* ── Map layout ────────────────────────────────────────────────────────────── */
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

/* ── Controls panel ────────────────────────────────────────────────────────── */
.controls {
  position: absolute;
  top: 20px;
  left: 20px;
  background: var(--c-bg);
  padding: 15px;
  border-radius: 6px;
  border: 1px solid var(--c-panel-border);
  box-shadow: var(--c-box-shadow);
  z-index: 2;
  max-width: 300px;
  transition: background-color 0.3s, border-color 0.3s, box-shadow 0.3s;
}

.controls-toggle {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 2;
  width: 40px;
  height: 40px;
  border: 1px solid var(--c-panel-border);
  border-radius: 6px;
  background: var(--c-bg);
  color: var(--c-text);
  box-shadow: var(--c-box-shadow);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.3s, border-color 0.3s;
}

.controls-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 15px;
}

.controls-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--c-text);
}

.controls-close {
  background: none;
  border: none;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  color: var(--c-text-muted);
  padding: 2px 5px;
  border-radius: 3px;
}

.controls-close:hover {
  color: var(--c-text);
  background: var(--c-divider);
}

.toggles {
  margin-bottom: 15px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--c-divider);
}

.map-style-select {
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--c-divider);
}

.map-style-select select {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--c-input-border);
  border-radius: 4px;
  font-size: 13px;
  color: var(--c-text);
  background: var(--c-bg-input);
  cursor: pointer;
}

.fog-mode-radios {
  padding-left: 20px;
}

.toggle-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--c-text-sub);
  cursor: pointer;
  padding: 4px 0;
}

.toggle-item input[type="checkbox"],
.toggle-item input[type="radio"] {
  cursor: pointer;
  accent-color: var(--c-accent);
}

.perlin-controls {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid var(--c-divider);
}

.perlin-controls h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: var(--c-text);
}

.input-group {
  margin-bottom: 12px;
}

.input-group label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--c-text-muted);
}

.input-group input[type="number"] {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--c-input-border);
  border-radius: 4px;
  font-size: 12px;
  background: var(--c-bg-input);
  color: var(--c-text);
}

.input-group input[type="file"] {
  width: 100%;
  padding: 4px 0;
  font-size: 12px;
  color: var(--c-text-sub);
}

.input-group .toggle-item {
  margin: 0;
  padding: 0;
}

.tile-select-controls {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid var(--c-divider);
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
  background-color: var(--c-btn-clear);
  color: var(--c-text-btn);
}

.btn-clear:hover {
  background-color: var(--c-btn-clear-h);
}

.btn-validate {
  background-color: var(--c-btn-validate);
  color: var(--c-text-btn);
}

.btn-validate:hover {
  background-color: var(--c-btn-validate-h);
}

.tile-groups-list {
  margin: 12px 0;
  padding: 10px;
  background: var(--c-bg-list);
  border: 1px solid var(--c-divider);
  border-radius: 4px;
}

.group-header {
  font-size: 12px;
  font-weight: 600;
  color: var(--c-text);
  margin-bottom: 8px;
}

.theme-ukiyo .group-header {
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.tile-group-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.tile-group-item label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 12px;
  color: var(--c-text-sub);
  flex: 1;
}

.tile-group-item input[type="checkbox"] {
  cursor: pointer;
  accent-color: var(--c-accent);
}

.group-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
}

.group-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-type {
  font-size: 10px;
  color: var(--c-text-muted);
  margin-left: 4px;
  flex-shrink: 0;
}

.btn-select-groups {
  width: 100%;
  padding: 6px 8px;
  margin-top: 8px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  background-color: var(--c-accent);
  color: var(--c-text-btn);
  transition: background-color 0.2s;
}

.btn-select-groups:hover {
  background-color: var(--c-btn-validate-h);
}

.btn-logout {
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
  background-color: var(--c-btn-logout);
  color: var(--c-text-btn);
  margin-top: 15px;
}

.btn-logout:hover {
  background-color: var(--c-btn-logout-h);
}

.stats {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid var(--c-divider);
}

.stat-item {
  font-size: 12px;
  color: var(--c-text-muted);
  padding: 4px 0;
}

ion-content {
  --background: transparent;
}

.location-marker {
  animation: location-pulse 2s ease-in-out infinite;
}

@keyframes location-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(66, 133, 244, 0.4), 0 2px 6px rgba(0,0,0,0.3); }
  50% { box-shadow: 0 0 0 10px rgba(66, 133, 244, 0), 0 2px 6px rgba(0,0,0,0.3); }
}

@supports (padding: max(0px)) {
  .controls,
  .controls-toggle {
    top: max(20px, env(safe-area-inset-top));
    left: max(20px, env(safe-area-inset-left));
  }
}
</style>
