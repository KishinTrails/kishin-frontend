<script setup lang="ts">
/**
 * HrZones.vue — Time spent in each heart rate zone, as horizontal bars sized by the share of
 * the total, with the zone's threshold and the time written beside each bar.
 * Does not own: how Garmin sets the thresholds (`hr_zones_method`).
 */
import { computed } from 'vue';
import type { HrZone } from '@/services/athleteService';
import { formatDuration } from '@/utils/athleteFormat';

const props = defineProps<{
  zones: HrZone[]
}>();

const total = computed(() => props.zones.reduce((sum, zone) => sum + (zone.time_sec ?? 0), 0));

const rows = computed(() =>
  props.zones.map((zone) => ({
    ...zone,
    share: total.value > 0 ? (zone.time_sec ?? 0) / total.value : 0,
  })),
);
</script>

<template>
  <section class="hr-zones">
    <h2>Heart rate zones</h2>
    <p
      v-if="total === 0"
      class="empty"
    >
      No heart rate zone time.
    </p>
    <table v-else>
      <tbody>
        <tr
          v-for="zone in rows"
          :key="zone.zone"
        >
          <th scope="row">
            Zone {{ zone.zone }}
            <span
              v-if="zone.hr !== null"
              class="threshold"
            >≥ {{ zone.hr }} bpm</span>
          </th>
          <td class="bar-cell">
            <span
              class="bar"
              :style="{ width: `${(zone.share * 100).toFixed(1)}%` }"
            />
          </td>
          <td class="number">
            {{ formatDuration(zone.time_sec) }}
          </td>
          <td class="number">
            {{ Math.round(zone.share * 100) }}%
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
h2 {
  margin: 0 0 6px;
  font-size: 1rem;
  color: var(--c-text);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

th,
td {
  padding: 3px 6px;
  color: var(--c-text);
  text-align: left;
  font-weight: normal;
  white-space: nowrap;
}

.threshold {
  color: var(--c-muted);
  font-size: 0.8rem;
}

.bar-cell {
  width: 100%;
}

.bar {
  display: block;
  height: 10px;
  background: var(--c-accent);
  border-radius: 2px;
}

.number {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.empty {
  color: var(--c-muted);
}
</style>
