<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="map-container">
        <div
          ref="mapContainer"
          class="map"
        />
        <FogOverlay
          ref="fogOverlay"
          :map="map"
          :explored-cells="visibleExplored"
          :opacity="fogOpacity"
          color="#1a1a1a"
        />
        <PoiOverlay
          ref="poiOverlay"
          :map="map"
          :cell-types="cellTypes"
          :visible-cells="visibleExplored"
        />
        
        <div class="controls">
          <h3>🗺️ Trail Map</h3>
          
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
 * Shows explored cells with markers, unexplored cells with fog overlay.
 */

import { ref, onMounted, onUnmounted } from 'vue';
import { IonPage, IonContent } from '@ionic/vue';
import maplibregl from 'maplibre-gl';
import * as h3 from 'h3-js';
import 'maplibre-gl/dist/maplibre-gl.css';
import FogOverlay from '@/components/FogOverlay.vue';
import PoiOverlay from '@/components/PoiOverlay.vue';
import { fetchCellTypes as fetchCellTypesFromService } from '@/services/poiService';
import { getCellTypeFromCache } from '@/services/cacheService';
import { fetchExploredTiles } from '@/services/trailsService';

type CellTypeKey = 'peak' | 'natural' | 'industrial';

const H3_RESOLUTION = 10;

const mapContainer = ref<HTMLElement | null>(null);
const map = ref<maplibregl.Map>();
const fogOverlay = ref<InstanceType<typeof FogOverlay> | null>(null);
const poiOverlay = ref<InstanceType<typeof PoiOverlay> | null>(null);

const cellTypes = ref<Map<string, CellTypeKey>>(new Map());
const visitedCells = ref<Set<string>>(new Set());

const visibleCells = ref<string[]>([]);
const visibleExplored = ref<string[]>([]);
const visibleFog = ref<string[]>([]);

const fogOpacity = ref(0.85);
const fogColor = ref('#1a1a1a');

const isMounted = ref(true);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let abortController: AbortController | null = null;

onMounted(async () => {
  await loadExploredTiles();
  setTimeout(() => {
    if (!isMounted.value) return;
    initMap();
    setupEventListeners();
    updateVisibleCells();
  }, 100);
});

/**
 * Load the user's explored tiles from the API.
 */
const loadExploredTiles = async () => {
  try {
    const explored = await fetchExploredTiles();
    visitedCells.value = new Set(explored);
  } catch (err) {
    console.error('Failed to load explored tiles:', err);
  }
};

onUnmounted(() => {
  isMounted.value = false;
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
    draw();
  });
  map.value.on('zoom', () => {
    debouncedUpdate();
    draw();
  });
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
 * Update the lists of visible explored and fog cells based on map bounds.
 */
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
 * Set up window resize listener to handle map resizing.
 */
const setupEventListeners = () => {
  window.addEventListener('resize', () => {
    if (map.value) {
      map.value.resize();
    }
  });
};

/**
 * Fetch cell types for explored cells from the API.
 */
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
    draw();
  }
};

/**
 * Draw the fog layer and POI markers.
 * Calls FogOverlay.draw() for fog, then PoiOverlay.draw() for markers.
 */
const draw = () => {
  fogOverlay.value?.draw();
  poiOverlay.value?.draw();
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
