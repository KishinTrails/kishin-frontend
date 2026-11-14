<script setup lang="ts">
/**
 * LapTable.vue — The laps of one activity: distance, moving time, pace, heart rate, cadence and
 * ascent per lap.
 * Does not own: anything about the activity outside its laps.
 */
import type { Lap } from '@/services/athleteService';
import { formatDuration, formatPace, paceFromSpeed } from '@/utils/athleteFormat';

defineProps<{
  laps: Lap[]
}>();
</script>

<template>
  <section class="lap-table">
    <h2>Laps</h2>
    <div class="scroller">
      <table>
        <thead>
          <tr>
            <th scope="col">
              Lap
            </th>
            <th
              scope="col"
              class="number"
            >
              Distance
            </th>
            <th
              scope="col"
              class="number"
            >
              Moving
            </th>
            <th
              scope="col"
              class="number"
            >
              Pace
            </th>
            <th
              scope="col"
              class="number"
            >
              Avg HR
            </th>
            <th
              scope="col"
              class="number"
            >
              Max HR
            </th>
            <th
              scope="col"
              class="number"
            >
              Cadence
            </th>
            <th
              scope="col"
              class="number"
            >
              Ascent
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="lap in laps"
            :key="lap.lap"
          >
            <th scope="row">
              {{ lap.lap }}
            </th>
            <td class="number">
              {{ lap.distance_km === null ? '–' : `${lap.distance_km.toFixed(2)} km` }}
            </td>
            <td class="number">
              {{ formatDuration(lap.moving_sec) }}
            </td>
            <td class="number">
              {{ formatPace(paceFromSpeed(lap.avg_speed_kmh)) }}
            </td>
            <td class="number">
              {{ lap.avg_hr ?? '–' }}
            </td>
            <td class="number">
              {{ lap.max_hr ?? '–' }}
            </td>
            <td class="number">
              {{ lap.avg_cadence ?? '–' }}
            </td>
            <td class="number">
              {{ lap.ascent_m === null ? '–' : `${Math.round(lap.ascent_m)} m` }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
h2 {
  margin: 0 0 6px;
  font-size: 1rem;
  color: var(--c-text);
}

.scroller {
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

th,
td {
  padding: 4px 8px;
  border-bottom: 1px solid var(--c-border);
  color: var(--c-text);
  text-align: left;
  font-weight: normal;
  white-space: nowrap;
}

thead th {
  color: var(--c-muted);
  font-size: 0.85rem;
}

.number {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
