<template>
  <div class="gps-tracker">
    <div class="gps-header">
      <span
        class="gps-icon"
        :class="{ active: isTracking }"
      >⊕</span>
      <span class="gps-title">GPS Tracker</span>
    </div>

    <div class="gps-status">
      <span
        class="status-dot"
        :class="statusClass"
      />
      <span>{{ statusLabel }}</span>
    </div>

    <div
      v-if="lastPosition"
      class="gps-coords"
    >
      <div class="coord">
        <span class="coord-label">LAT</span>
        <span class="coord-value">{{ lastPosition.latitude.toFixed(6) }}</span>
      </div>
      <div class="coord">
        <span class="coord-label">LON</span>
        <span class="coord-value">{{ lastPosition.longitude.toFixed(6) }}</span>
      </div>
      <div class="coord">
        <span class="coord-label">ACC</span>
        <span class="coord-value">± {{ lastPosition.accuracy.toFixed(1) }}m</span>
      </div>
    </div>

    <div
      v-if="error"
      class="gps-error"
    >
      {{ error }}
    </div>

    <div class="gps-controls">
      <button
        v-if="!isTracking"
        @click="startTracking"
      >
        Start
      </button>
      <button
        v-else
        class="stop"
        @click="stopTracking"
      >
        Stop
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * GpsTracker — display component only.
 *
 * All state and logic live in useTrailTracker(). This component is
 * responsible solely for rendering and forwarding user interactions.
 *
 * Tracking starts automatically on mount and stops on unmount, which
 * matches the lifecycle of the map page.
 */
import { onMounted, onUnmounted } from 'vue';
import { useTrailTracker } from '@/composables/useTrailTracker';

const {
    isTracking,
    lastPosition,
    error,
    statusLabel,
    statusClass,
    startTracking,
    stopTracking,
} = useTrailTracker();

onMounted(startTracking);
onUnmounted(stopTracking);
</script>
