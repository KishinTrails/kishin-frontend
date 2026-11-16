<script setup lang="ts">
/**
 * GpsTracker.vue — The "Tracking" group of the map panel, for the Android app: the state of the
 * native tracking service in the group's title ("● On" / "Off"), and in the group the accuracy
 * and age of the last fix, its coordinates, Start / Stop, and "Center on me", which emits
 * `center` with the last position. Tracking starts only from Start; it stops when the map page
 * is unmounted.
 * Does not own: tracking itself (`composables/useTrailTracker.ts`), moving the map (MapPage),
 * or whether the group exists (MapPage shows it only where `trackingAvailable` is true).
 */
import { computed, onUnmounted, ref, watch } from 'vue';
import PanelGroup from '@/components/PanelGroup.vue';
import { useTrailTracker } from '@/composables/useTrailTracker';
import type { TrailTrackerPosition } from '@/plugins/trailTrackerPlugin';
import { fixAge } from '@/utils/fixAge';

/** How often the age of the last fix is refreshed while tracking, in milliseconds. */
const CLOCK_MS = 5_000;

const emit = defineEmits<{
  (event: 'center', position: TrailTrackerPosition): void
}>();

const {
  isTracking,
  lastPosition,
  error,
  loginExpiresSoon,
  startTracking,
  stopTracking,
} = useTrailTracker();

const now = ref(Date.now());
let clock: ReturnType<typeof setInterval> | null = null;

// The age of the fix only changes while fixes arrive, so the clock runs only while tracking.
watch(isTracking, (tracking) => {
  if (clock) clearInterval(clock);
  clock = tracking ? setInterval(() => { now.value = Date.now(); }, CLOCK_MS) : null;
  now.value = Date.now();
}, { immediate: true });

const fixLine = computed(() => {
  const position = lastPosition.value;
  if (!position) return isTracking.value ? 'Waiting for the first fix…' : '';
  return `± ${position.accuracy.toFixed(1)} m · ${fixAge(position.timestamp, now.value)}`;
});

/** Moves the map to the last fix. */
function center(): void {
  if (lastPosition.value) emit('center', { ...lastPosition.value });
}

onUnmounted(() => {
  if (clock) clearInterval(clock);
  void stopTracking();
});
</script>

<template>
  <PanelGroup
    id="tracking"
    title="Tracking"
  >
    <template #badge>
      <span
        class="tracking-state"
        :class="{ on: isTracking }"
      >
        <span
          class="dot"
          aria-hidden="true"
        />
        {{ isTracking ? 'On' : 'Off' }}
      </span>
    </template>

    <div class="gps-tracker">
      <p
        v-if="fixLine"
        class="fix"
      >
        {{ fixLine }}
      </p>
      <p
        v-if="lastPosition"
        class="coords"
      >
        {{ lastPosition.latitude.toFixed(6) }}, {{ lastPosition.longitude.toFixed(6) }}
      </p>
      <p
        v-if="error"
        class="gps-error"
        role="alert"
      >
        {{ error }}
        <router-link
          v-if="loginExpiresSoon"
          to="/logout"
        >
          Log in again
        </router-link>
      </p>
      <div class="gps-buttons">
        <button
          v-if="!isTracking"
          type="button"
          class="start"
          @click="startTracking"
        >
          Start
        </button>
        <button
          v-else
          type="button"
          class="stop"
          @click="stopTracking"
        >
          Stop
        </button>
        <button
          type="button"
          class="center"
          :disabled="!lastPosition"
          @click="center"
        >
          Center on me
        </button>
      </div>
    </div>
  </PanelGroup>
</template>

<style scoped>
.tracking-state {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--c-text-muted);
}

.tracking-state.on {
  color: var(--c-text);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c-input-border);
}

.on .dot {
  background: #2e9e4f;
  box-shadow: 0 0 0 3px rgba(46, 158, 79, 0.25);
}

.gps-tracker p {
  margin: 0 0 6px;
  font-size: 13px;
  color: var(--c-text-sub);
}

.coords {
  font-family: ui-monospace, 'DejaVu Sans Mono', monospace;
  font-size: 12px !important;
  color: var(--c-text-muted) !important;
}

.gps-error {
  color: var(--c-btn-clear) !important;
}

.gps-error a {
  margin-left: 4px;
  color: inherit;
}

.gps-buttons {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}

.gps-buttons button {
  flex: 1;
  padding: 7px 10px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.start {
  background: var(--c-btn-validate);
  color: var(--c-text-btn);
}

.stop {
  background: var(--c-btn-clear);
  color: var(--c-text-btn);
}

.center {
  border: 1px solid var(--c-input-border) !important;
  background: var(--c-bg-input);
  color: var(--c-text);
}

.center:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
