<script setup lang="ts">
/**
 * ActivityMap.vue — The GPS track of one activity on a MapLibre map, in the map style the
 * player chose on the main map, zoomed to the track's bounding box.
 * Does not own: fetching the track, or deciding whether to show a map for a track without
 * positions (the page leaves the component out then).
 */
import { onMounted, onUnmounted, ref, shallowRef } from 'vue';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Track } from '@/services/athleteService';
import { loadMapStyle } from '@/services/mapStyleService';
import { STYLE_MAP } from '@/styles/mapStyles';
import { addTonerPatterns } from '@/styles/ukiyoeToner';

const props = defineProps<{
  track: Track
}>();

const container = ref<HTMLElement | null>(null);
const map = shallowRef<maplibregl.Map | null>(null);

const SOURCE = 'activity-track';
const TRACK_COLOUR = '#c62828';

onMounted(() => {
  if (!container.value || !props.track.bbox) return;
  const [west, south, east, north] = props.track.bbox;

  map.value = new maplibregl.Map({
    container: container.value,
    style: STYLE_MAP[loadMapStyle()],
    bounds: [[west, south], [east, north]],
    fitBoundsOptions: { padding: 30 },
  });
  map.value.addControl(new maplibregl.NavigationControl({ showCompass: false }));

  map.value.on('styleimagemissing', (event: { id: string }) => {
    if (event.id === 'building-stripe' && map.value) addTonerPatterns(map.value);
  });

  map.value.on('load', () => {
    if (!map.value) return;
    map.value.addSource(SOURCE, {
      type: 'geojson',
      data: { type: 'Feature', geometry: props.track.geometry, properties: props.track.properties },
    });
    map.value.addLayer({
      id: SOURCE,
      type: 'line',
      source: SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': TRACK_COLOUR, 'line-width': 3 },
    });
  });
});

onUnmounted(() => {
  map.value?.remove();
  map.value = null;
});
</script>

<template>
  <div
    ref="container"
    class="activity-map"
    role="img"
    :aria-label="`Map of the GPS track, ${track.properties.points} points`"
  />
</template>

<style scoped>
.activity-map {
  width: 100%;
  height: 320px;
  border-radius: 6px;
  overflow: hidden;
}
</style>
