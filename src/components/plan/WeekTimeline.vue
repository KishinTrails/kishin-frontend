<script setup lang="ts">
/**
 * WeekTimeline.vue — Every week of the plan as one row: dates, phase, long-run target, one mark
 * per training (✓ done, ○ not done) and the done count. The current week is highlighted; the
 * selected week is the one shown in detail by the page. Choosing a row emits `select`.
 * Does not own: completing trainings (see `TrainingCard.vue`).
 */
import type { PlanWeek } from '@/services/planService';
import { longDate } from '@/utils/activityGrid';
import { longRunTarget, trainingLabel } from '@/utils/planProgress';

defineProps<{
  weeks: PlanWeek[]
  currentWeek: number
  selectedWeek: number
}>();

defineEmits<{
  (event: 'select', weekNumber: number): void
}>();

/**
 * `5 Jan` for a week's Monday.
 *
 * @param day - ISO day string
 * @returns Day and month
 */
const shortDate = (day: string): string => longDate(day).split(' ').slice(1, 3).join(' ');
</script>

<template>
  <section class="week-timeline">
    <h2>Weeks</h2>
    <div class="scroller">
      <table>
        <thead>
          <tr>
            <th scope="col">
              Week
            </th>
            <th scope="col">
              From
            </th>
            <th scope="col">
              Phase
            </th>
            <th
              scope="col"
              class="number"
            >
              Long run
            </th>
            <th scope="col">
              Trainings
            </th>
            <th
              scope="col"
              class="number"
            >
              Done
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="week in weeks"
            :key="week.week_number"
            :class="{ current: week.week_number === currentWeek, selected: week.week_number === selectedWeek }"
          >
            <th scope="row">
              <button
                type="button"
                :aria-pressed="week.week_number === selectedWeek"
                @click="$emit('select', week.week_number)"
              >
                {{ week.week_number }}
              </button>
            </th>
            <td>{{ shortDate(week.start) }}</td>
            <td>{{ week.phase }}</td>
            <td class="number">
              {{ longRunTarget(week) === null ? '–' : `${longRunTarget(week)} km` }}
            </td>
            <td class="marks">
              <span
                v-for="training in week.trainings"
                :key="training.id"
                :class="{ done: training.completion }"
                :title="`${trainingLabel(training.type)}: ${training.completion ? 'done' : 'not done'}`"
              >{{ training.completion ? '✓' : '○' }}</span>
            </td>
            <td class="number">
              {{ week.trainings.filter((training) => training.completion).length }}/{{ week.trainings.length }}
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

tr.current {
  background: color-mix(in srgb, var(--c-accent) 12%, transparent);
}

tr.selected th button {
  font-weight: bold;
  border-color: var(--c-text);
}

button {
  min-width: 2.2em;
  padding: 1px 6px;
  background: none;
  color: var(--c-text);
  border: 1px solid var(--c-border);
  border-radius: 4px;
  font: inherit;
  cursor: pointer;
}

.marks span {
  margin-right: 3px;
  color: var(--c-muted);
}

.marks span.done {
  color: var(--c-accent);
}
</style>
