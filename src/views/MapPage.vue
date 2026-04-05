<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="map-container">
        <div
          ref="mapContainer"
          class="map"
        />
        <FogOverlay
          :map="map"
          :explored-cells="visibleExplored"
          :opacity="FOG_OPACITY"
          :color="FOG_COLOR"
        />
        <PoiOverlay
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
import { useTrailMap } from '@/composables/useTrailMap';

const FOG_OPACITY = 0.85;
const FOG_COLOR = '#1a1a1a';

const MAP_CENTER: [number, number] = [3.1009225078676246, 45.75259789465471];
const MAP_ZOOM = 16;

const mapContainer = ref<HTMLElement | null>(null);
const map = shallowRef<maplibregl.Map | undefined>(undefined);

const {
  visitedCells,
  visibleExplored,
  visibleFog,
  cellTypes,
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
