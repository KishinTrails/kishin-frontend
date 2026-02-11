<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div class="map-container">
        <div ref="mapContainer" class="map"></div>
        <canvas ref="fogCanvas" class="fog-overlay"></canvas>
        
        <div class="controls">
          <h3>🗺️ Fog of War</h3>
          
          <div class="control-group">
            <label>Mode</label>
            <ion-button 
              expand="block" 
              @click="followTouch = !followTouch"
              :color="followTouch ? 'primary' : 'secondary'"
            >
              {{ followTouch ? '👆 Touch Mode' : '📍 GPS Mode' }}
            </ion-button>
          </div>

          <div v-if="!followTouch" class="control-group">
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
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { IonPage, IonContent, IonRange, IonButton } from '@ionic/vue';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Refs
const mapContainer = ref<HTMLElement | null>(null);
const fogCanvas = ref<HTMLCanvasElement | null>(null);
const map = ref<maplibregl.Map | null>(null);
const fogCtx = ref<CanvasRenderingContext2D | null>(null);

// State
const baseCircleRadius = ref(150); // Base radius at zoom level 1
const circleRadius = ref(150); // Actual calculated radius
const fogOpacity = ref(0.85);
const fogColor = ref('#1a1a1a');
const edgeBlur = ref(30);
const followTouch = ref(false); // Disabled by default when using GPS coordinates
const touchX = ref(0);
const touchY = ref(0);
const animationFrame = ref<number | null>(null);
const currentZoom = ref(4);

// GPS coordinates for viewports (add your coordinates here)
const gpsCoordinates = ref([
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
]);

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
  
  // Initialize touch position to center
  touchX.value = window.innerWidth / 2;
  touchY.value = window.innerHeight / 2;
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

const setupEventListeners = () => {
  // Touch events for mobile
  const handleTouch = (e: TouchEvent) => {
    if (followTouch.value && e.touches.length > 0) {
      // Prevent default to avoid scrolling
      e.preventDefault();
      touchX.value = e.touches[0].clientX;
      touchY.value = e.touches[0].clientY;
    }
  };

  window.addEventListener('touchstart', handleTouch, { passive: false });
  window.addEventListener('touchmove', handleTouch, { passive: false });

  // Mouse events for desktop testing
  window.addEventListener('mousemove', (e: MouseEvent) => {
    if (followTouch.value) {
      touchX.value = e.clientX;
      touchY.value = e.clientY;
    }
  });

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

  // Draw a circle for each viewport position
  if (followTouch.value) {
    // If following touch, draw single circle at touch position
    const gradient = ctx.createRadialGradient(
      touchX.value, touchY.value, innerRadius,
      touchX.value, touchY.value, outerRadius
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.arc(touchX.value, touchY.value, outerRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  } else {
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
  }

  ctx.restore();
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
  margin: 0 0 10px 0;
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
