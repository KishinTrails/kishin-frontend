<script setup lang="ts">
/**
 * ActivityGrid.vue — The days with activities as a grid of 52 weeks by 7 days, Monday first,
 * laid out by `utils/activityGrid.ts`. A day is coloured by its distance or its moving time
 * (switch above the grid), in four steps taken from the year's own distribution. Hover shows
 * one tooltip for the cell under the pointer, and the table twin lists the days with
 * activities, so nothing depends on colour or on a pointer.
 *
 * The tooltip is a sibling of the scrolling element: inside it, the top rows' tooltips would be
 * cut off by the scroll container.
 * Does not own: fetching the days or choosing the date range.
 */
import { computed, ref } from 'vue';
import type { DailyActivities } from '@/services/athleteService';
import { buildGrid, longDate, monthLabels, summarise } from '@/utils/activityGrid';
import { formatDuration } from '@/utils/athleteFormat';

const props = defineProps<{
  days: DailyActivities[]
  today: string
}>();

const view = ref<'grid' | 'table'>('grid');
const metric = ref<'distance' | 'time'>('distance');

const byDate = computed(() => new Map(props.days.map((day) => [day.date, day])));

const grid = computed(() =>
  buildGrid(
    props.days.map((day) => ({
      date: day.date,
      value: metric.value === 'distance' ? day.distance_km : day.moving_sec / 60,
    })),
    props.today,
  ),
);
const labels = computed(() => monthLabels(grid.value.columns));
const summary = computed(() => summarise(grid.value));

const formatMetric = (value: number): string =>
  metric.value === 'distance' ? `${value.toFixed(1)} km` : formatDuration(value * 60);

const caption = computed(() =>
  summary.value.activeDays > 0
    ? `${formatMetric(summary.value.total)} on ${summary.value.activeDays} days in the last year`
    : 'No activity in the last year',
);

const spoken = computed(() => {
  const { busiest } = summary.value;
  const busiestSentence = busiest
    ? ` The largest day was ${longDate(busiest.date)}, with ${formatMetric(busiest.value)}.`
    : '';
  return `Activities: ${caption.value}.${busiestSentence}`;
});

/** The days of the grid with an activity, newest first: the table twin's rows. */
const tableDays = computed(() =>
  grid.value.columns
    .flat()
    .filter((cell) => !cell.future && cell.value > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((cell) => byDate.value.get(cell.date)!)
    .filter(Boolean),
);

/** The names beside the rows: every other row, so they do not crowd each other. */
const WEEKDAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

const hovered = ref<string | null>(null);
const hoveredDay = computed(() => (hovered.value ? byDate.value.get(hovered.value) : undefined));
const tipPosition = ref({ left: 0, top: 0 });
const stage = ref<HTMLElement | null>(null);

/** Half a tooltip's width, kept clear of the stage's edges so it is not cut off. */
const TIP_MARGIN = 80;

const onPointerOver = (event: PointerEvent) => {
  const cell = (event.target as HTMLElement).closest('[data-date]');
  if (!cell || !stage.value) {
    hovered.value = null;
    return;
  }
  hovered.value = cell.getAttribute('data-date');
  const stageBox = stage.value.getBoundingClientRect();
  const cellBox = cell.getBoundingClientRect();
  const centre = cellBox.left - stageBox.left + cellBox.width / 2;
  tipPosition.value = {
    left: Math.min(Math.max(centre, TIP_MARGIN), Math.max(TIP_MARGIN, stageBox.width - TIP_MARGIN)),
    top: cellBox.top - stageBox.top,
  };
};

const onPointerLeave = () => {
  hovered.value = null;
};
</script>

<template>
  <section class="activity-grid">
    <header>
      <h2>Activity calendar</h2>
      <div class="buttons">
        <button
          type="button"
          :aria-pressed="metric === 'distance'"
          @click="metric = 'distance'"
        >
          Distance
        </button>
        <button
          type="button"
          :aria-pressed="metric === 'time'"
          @click="metric = 'time'"
        >
          Time
        </button>
        <button
          class="view-toggle"
          type="button"
          :aria-pressed="view === 'table'"
          @click="view = view === 'grid' ? 'table' : 'grid'"
        >
          {{ view === 'grid' ? 'Table' : 'Grid' }}
        </button>
      </div>
    </header>
    <p class="caption">
      {{ caption }}
    </p>

    <div
      v-if="view === 'grid'"
      ref="stage"
      class="stage"
    >
      <div class="scroller">
        <div class="chart">
          <div
            class="months"
            aria-hidden="true"
          >
            <span
              v-for="(label, index) in labels"
              :key="index"
              class="month"
            >{{ label ?? '' }}</span>
          </div>
          <div
            class="weekdays"
            aria-hidden="true"
          >
            <span
              v-for="(name, row) in WEEKDAY_LABELS"
              :key="row"
            >{{ name }}</span>
          </div>
          <div
            class="grid"
            role="img"
            :aria-label="spoken"
            @pointerover="onPointerOver"
            @pointerleave="onPointerLeave"
          >
            <div
              v-for="(column, week) in grid.columns"
              :key="week"
              class="column"
            >
              <template
                v-for="cell in column"
                :key="cell.date"
              >
                <span
                  v-if="!cell.future"
                  class="cell"
                  :class="`level-${cell.level}`"
                  :data-date="cell.date"
                  aria-hidden="true"
                />
              </template>
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="hovered"
        class="tip"
        role="tooltip"
        :style="{ left: `${tipPosition.left}px`, top: `${tipPosition.top}px` }"
      >
        <template v-if="hoveredDay">
          <strong>{{ hoveredDay.distance_km.toFixed(1) }} km · {{ formatDuration(hoveredDay.moving_sec) }}</strong>
          <span>{{ hoveredDay.count }} {{ hoveredDay.count === 1 ? 'activity' : 'activities' }}</span>
        </template>
        <span v-else>No activity</span>
        <span>{{ longDate(hovered) }}</span>
      </div>
    </div>

    <table
      v-else
      class="table"
    >
      <thead>
        <tr>
          <th scope="col">
            Date
          </th>
          <th
            scope="col"
            class="number"
          >
            Activities
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
            Moving time
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="day in tableDays"
          :key="day.date"
        >
          <th scope="row">
            {{ longDate(day.date) }}
          </th>
          <td class="number">
            {{ day.count }}
          </td>
          <td class="number">
            {{ day.distance_km.toFixed(1) }} km
          </td>
          <td class="number">
            {{ formatDuration(day.moving_sec) }}
          </td>
        </tr>
      </tbody>
    </table>
    <p
      v-if="view === 'table' && tableDays.length === 0"
      class="empty"
    >
      No activity.
    </p>
  </section>
</template>

<style scoped>
header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

h2 {
  margin: 0;
  font-size: 1rem;
  color: var(--c-text);
}

.buttons {
  display: flex;
  gap: 6px;
}

button {
  padding: 2px 8px;
  background: none;
  color: var(--c-muted);
  border: 1px solid var(--c-border);
  border-radius: 4px;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

button[aria-pressed='true'] {
  color: var(--c-text);
  border-color: var(--c-text);
}

.caption {
  margin: 4px 0 8px;
  color: var(--c-muted);
  font-size: 0.85rem;
}

.stage {
  position: relative;
}

.scroller {
  overflow-x: auto;
}

/* The month names, the weekday names and the grid share one two-by-two layout, so a name
   sits over its weeks and beside its rows whatever the width. */
.chart {
  display: grid;
  grid-template-columns: 2.5rem auto;
  width: fit-content;
  row-gap: 4px;
  font-size: 0.75rem;
  color: var(--c-muted);
}

.months {
  grid-column: 2;
  display: flex;
  gap: 3px;
}

/* One 10px slot per column; a name is wider than its slot and overflows into the empty ones. */
.month {
  flex: none;
  width: 10px;
  white-space: nowrap;
}

.weekdays {
  grid-column: 1;
  display: grid;
  grid-template-rows: repeat(7, 10px);
  gap: 3px;
}

.weekdays span {
  line-height: 10px;
}

.grid {
  grid-column: 2;
  display: flex;
  gap: 3px;
}

.column {
  display: grid;
  grid-template-rows: repeat(7, 10px);
  gap: 3px;
  width: 10px;
}

.cell {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: var(--c-empty);
}

.cell.level-1 {
  background: color-mix(in srgb, var(--c-accent) 25%, var(--c-card-bg));
}

.cell.level-2 {
  background: color-mix(in srgb, var(--c-accent) 50%, var(--c-card-bg));
}

.cell.level-3 {
  background: color-mix(in srgb, var(--c-accent) 75%, var(--c-card-bg));
}

.cell.level-4 {
  background: var(--c-accent);
}

.tip {
  position: absolute;
  transform: translate(-50%, calc(-100% - 6px));
  z-index: 1;
  display: flex;
  flex-direction: column;
  padding: 6px 10px;
  background: var(--c-card-bg);
  border: 1px solid var(--c-border);
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  font-size: 0.85rem;
  white-space: nowrap;
  pointer-events: none;
}

.tip strong {
  color: var(--c-text);
}

.tip span {
  color: var(--c-muted);
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.table th,
.table td {
  padding: 4px 8px;
  border-bottom: 1px solid var(--c-border);
  color: var(--c-text);
  text-align: left;
  font-weight: normal;
}

.table thead th {
  color: var(--c-muted);
  font-size: 0.85rem;
}

.table .number {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.empty {
  color: var(--c-muted);
}
</style>
