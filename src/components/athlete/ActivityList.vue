<script setup lang="ts">
/**
 * ActivityList.vue — Activities as a table, newest first: date, name, distance, moving time,
 * pace and average heart rate. Each name links to the activity's page. A button asks the page
 * for the next activities.
 * Does not own: fetching or paging; the page passes the rows and handles `load-more`.
 */
import type { ActivitySummary } from '@/services/athleteService';
import { formatDateTime, formatDuration, formatPace, paceFromSpeed } from '@/utils/athleteFormat';

defineProps<{
  activities: ActivitySummary[]
  hasMore: boolean
  loading?: boolean
}>();

defineEmits<{
  (event: 'load-more'): void
}>();

/**
 * The name to show: Garmin's name, or the sport when Garmin has none.
 *
 * @param activity - The activity
 * @returns A non-empty label
 */
const label = (activity: ActivitySummary): string =>
  activity.name || [activity.sport, activity.sub_sport].filter(Boolean).join(' / ') || activity.activity_id;
</script>

<template>
  <section class="activity-list">
    <h2>Activities</h2>
    <div class="scroller">
      <table>
        <thead>
          <tr>
            <th scope="col">
              Date
            </th>
            <th scope="col">
              Activity
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
              HR
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="activity in activities"
            :key="activity.activity_id"
          >
            <td>{{ formatDateTime(activity.start_time) }}</td>
            <th scope="row">
              <router-link :to="`/athlete/activities/${activity.activity_id}`">
                {{ label(activity) }}
              </router-link>
            </th>
            <td class="number">
              {{ activity.distance_km === null ? '–' : `${activity.distance_km.toFixed(2)} km` }}
            </td>
            <td class="number">
              {{ formatDuration(activity.moving_sec) }}
            </td>
            <td class="number">
              {{ formatPace(paceFromSpeed(activity.avg_speed_kmh)) }}
            </td>
            <td class="number">
              {{ activity.avg_hr ?? '–' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p
      v-if="activities.length === 0 && !loading"
      class="empty"
    >
      No activity.
    </p>
    <button
      v-if="hasMore"
      type="button"
      :disabled="loading"
      @click="$emit('load-more')"
    >
      {{ loading ? 'Loading…' : 'Load more' }}
    </button>
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

a {
  color: var(--c-link);
}

button {
  margin-top: 8px;
  padding: 4px 12px;
  background: none;
  color: var(--c-text);
  border: 1px solid var(--c-border);
  border-radius: 4px;
  font: inherit;
  cursor: pointer;
}

.empty {
  color: var(--c-muted);
}
</style>
