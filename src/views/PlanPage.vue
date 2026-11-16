<template>
  <AppShell
    title="Plan"
    section="plan"
    refreshable
    @refresh="(done) => reload().finally(done)"
  >
    <p
      v-if="error"
      class="card error"
    >
      {{ error }}
    </p>
    <template v-else-if="!plan">
      <section class="card">
        <SkeletonBlock :lines="3" />
      </section>
      <section class="card">
        <SkeletonBlock height="160px" />
      </section>
    </template>

    <template v-else>
      <section class="card summary">
        <h1>{{ plan.name }}</h1>
        <p class="subtitle">
          {{ weekStatus }} · from {{ longDate(plan.start_date) }}
        </p>
        <p
          v-if="!plan.health_available"
          class="notice"
        >
          Garmin data is unavailable: recorded runs are not shown, and runs cannot be marked done.
        </p>
        <div
          v-if="overall"
          class="overall"
        >
          <div
            class="overall-bar"
            role="progressbar"
            :aria-valuenow="overall.done"
            aria-valuemin="0"
            :aria-valuemax="overall.planned"
            aria-label="Trainings done"
          >
            <span :style="{ width: overall.planned ? `${(100 * overall.done) / overall.planned}%` : '0' }" />
          </div>
          <span class="overall-count">{{ overall.done }}/{{ overall.planned }} done</span>
        </div>
        <div class="rings">
          <ProgressRing
            v-for="count in perType"
            :key="count.label"
            :label="count.label"
            :done="count.done"
            :planned="count.planned"
          />
        </div>
        <p class="stats-note">
          {{ countsNote }}
        </p>
      </section>

      <section
        v-if="selected"
        class="card week-card"
        @touchstart.passive="onTouchStart"
        @touchend="onTouchEnd"
      >
        <div class="week-nav">
          <button
            type="button"
            class="nav-arrow"
            aria-label="Previous week"
            :disabled="selectedWeek <= 1"
            @click="selectedWeek -= 1"
          >
            ‹
          </button>
          <div class="week-nav-title">
            <h2>Week {{ selected.week_number }} · {{ phaseLabel(selected.phase) }}</h2>
            <span class="dates">{{ weekRange(selected.start, selected.end) }}</span>
          </div>
          <button
            type="button"
            class="nav-arrow"
            aria-label="Next week"
            :disabled="selectedWeek >= plan.week_count"
            @click="selectedWeek += 1"
          >
            ›
          </button>
        </div>
        <div class="week-info">
          <p
            v-if="left"
            class="today-line"
          >
            <strong>Today, {{ todayLabel }}</strong> · {{ leftText }}
          </p>
          <button
            v-else-if="selectedWeek !== clampedCurrent"
            type="button"
            class="today-button"
            @click="selectedWeek = clampedCurrent"
          >
            Back to this week
          </button>
          <p
            v-if="selected.running"
            class="garmin"
          >
            Garmin: {{ selected.running.run_count }} runs, {{ selected.running.run_km.toFixed(1) }} km
          </p>
        </div>
        <div class="trainings">
          <TrainingCard
            v-for="training in selected.trainings"
            :key="training.id"
            :training="training"
            @changed="reload"
          />
        </div>
      </section>

      <section
        v-if="chart"
        class="card"
      >
        <div
          class="tabs"
          role="tablist"
        >
          <button
            v-for="tab in CHART_TABS"
            :key="tab.metric"
            type="button"
            role="tab"
            :aria-selected="chartMetric === tab.metric"
            :class="{ active: chartMetric === tab.metric }"
            @click="chartMetric = tab.metric"
          >
            {{ tab.label }}
          </button>
        </div>
        <LineChart
          :title="activeTab.title"
          :x="chart.weeks"
          :series="[
            { name: 'Planned', values: chart.series[chartMetric].planned, dashed: true },
            { name: 'Garmin', values: chart.series[chartMetric].recorded },
          ]"
          :format-x="(value) => `Week ${Math.round(value)}`"
          :format-y="activeTab.format"
        />
        <p
          v-if="chartMetric !== 'longest'"
          class="stats-note"
        >
          {{ activeTab.note }}
        </p>
      </section>

      <section class="card">
        <WeekTimeline
          :weeks="plan.weeks"
          :current-week="plan.current_week"
          :selected-week="selectedWeek"
          :today="today"
          @select="selectedWeek = $event"
        />
      </section>
    </template>
  </AppShell>
</template>

<script setup lang="ts">
/**
 * PlanPage.vue — Progression of the active training plan, top to bottom:
 * - summary: name, week status, a bar of all trainings done and one ring per training type;
 * - the selected week (the current week by default) with arrows to the previous and next week
 *   (or a horizontal swipe on a touch screen), what is left to do today when it is the current
 *   week, and its trainings with their completion forms;
 * - a chart of each week's planned and Garmin running (tabs: distance, moving time, longest run);
 * - the list of all weeks.
 * Does not own: importing plans (`kishin plan import` on the server) or Willpower.
 */
import { computed, onMounted, ref } from 'vue';
import AppShell from '@/components/AppShell.vue';
import LineChart from '@/components/athlete/LineChart.vue';
import ProgressRing from '@/components/plan/ProgressRing.vue';
import SkeletonBlock from '@/components/SkeletonBlock.vue';
import TrainingCard from '@/components/plan/TrainingCard.vue';
import WeekTimeline from '@/components/plan/WeekTimeline.vue';
import { fetchPlan, PlanApiError, type PlanProgress } from '@/services/planService';
import { longDate, todayIso } from '@/utils/activityGrid';
import {
  completionCounts,
  phaseLabel,
  trainingLabel,
  weekLeft,
  weeklySeries,
  weekRange,
  type WeeklyMetric,
} from '@/utils/planProgress';

/** A horizontal swipe at least this long, in pixels, changes the week. */
const SWIPE_PX = 60;

/**
 * Hours as `h:mm`.
 *
 * @param hours - Hours, fractional
 * @returns For example `2:30 h`
 */
const formatHours = (hours: number): string => {
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')} h`;
};

/** The chart tabs, in display order. */
const CHART_TABS: { metric: WeeklyMetric, label: string, title: string, format: (value: number) => string, note: string }[] = [
  {
    metric: 'distance',
    label: 'Distance',
    title: 'Running distance per week',
    format: (value) => `${value.toFixed(1)} km`,
    note: 'Planned: the sum of the distance targets of the week\'s runs. Runs with only a duration target are not counted.',
  },
  {
    metric: 'time',
    label: 'Time',
    title: 'Running moving time per week',
    format: formatHours,
    note: 'Planned: the sum of the duration targets of the week\'s runs. Runs with only a distance target are not counted.',
  },
  {
    metric: 'longest',
    label: 'Longest run',
    title: 'Longest run per week',
    format: (value) => `${value.toFixed(1)} km`,
    note: '',
  },
];

const plan = ref<PlanProgress | null>(null);
const error = ref('');
const selectedWeek = ref(1);
const chartMetric = ref<WeeklyMetric>('distance');
const activeTab = computed(() => CHART_TABS.find((tab) => tab.metric === chartMetric.value)!);

/** The current week limited to the plan's weeks. */
const clampedCurrent = computed(() =>
  plan.value ? Math.min(Math.max(plan.value.current_week, 1), plan.value.week_count) : 1,
);

const selected = computed(() => plan.value?.weeks.find((week) => week.week_number === selectedWeek.value));

const weekStatus = computed(() => {
  const value = plan.value;
  if (!value) return '';
  if (value.current_week < 1) return `Starts in ${1 - value.current_week} week(s)`;
  if (value.current_week > value.week_count) return `Ended (${value.week_count} weeks)`;
  return `Week ${value.current_week} of ${value.week_count}`;
});

const counts = computed(() => (plan.value ? completionCounts(plan.value, plan.value.current_week) : []));
const overall = computed(() => counts.value[0]);
const perType = computed(() => counts.value.slice(1));

const today = todayIso();
/** For example `Mon 16 Nov`. */
const todayLabel = longDate(today).split(' ').slice(0, 3).join(' ');

/** What is left of the selected week today; null unless it is the week of today. */
const left = computed(() => (selected.value ? weekLeft(selected.value, today) : null));

const leftText = computed(() => {
  const value = left.value;
  if (!value) return '';
  if (!value.trainings.length) return 'everything is done this week.';
  const days = value.days === 1 ? 'last day' : `${value.days} days left`;
  return `${days}: ${value.trainings.map((training) => trainingLabel(training.type)).join(', ')}`;
});

let touchStart: { x: number, y: number } | null = null;

/**
 * Remembers where a touch began on the week card.
 *
 * @param event - The `touchstart` event
 */
function onTouchStart(event: TouchEvent): void {
  const touch = event.changedTouches[0];
  touchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
}

/**
 * Goes to the previous or next week after a mostly horizontal swipe of `SWIPE_PX` or more.
 *
 * @param event - The `touchend` event
 */
function onTouchEnd(event: TouchEvent): void {
  const touch = event.changedTouches[0];
  if (!touchStart || !touch || !plan.value) return;
  const dx = touch.clientX - touchStart.x;
  const dy = touch.clientY - touchStart.y;
  touchStart = null;
  if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < 2 * Math.abs(dy)) return;
  const next = selectedWeek.value + (dx < 0 ? 1 : -1);
  if (next >= 1 && next <= plan.value.week_count) selectedWeek.value = next;
}
const countsNote = computed(() =>
  plan.value && plan.value.current_week < plan.value.week_count
    ? 'Counted up to the current week.'
    : 'Counted over the whole plan.',
);

const chart = computed(() => (plan.value ? weeklySeries(plan.value, plan.value.current_week) : null));

/** Loads the plan again, keeping the selected week. */
async function reload(): Promise<void> {
  error.value = '';
  try {
    plan.value = await fetchPlan();
  } catch (caught) {
    error.value =
      caught instanceof PlanApiError && caught.status === 404
        ? 'No active plan. Import one on the server with `kishin plan import`.'
        : 'Could not load the plan.';
  }
}

onMounted(async () => {
  await reload();
  selectedWeek.value = clampedCurrent.value;
});
</script>

<style scoped>
h1 {
  margin: 0;
  font-size: 1.4rem;
}

h2 {
  margin: 0;
  font-size: 1.1rem;
}

.subtitle {
  margin: 4px 0 10px;
  color: var(--c-muted);
}

.notice {
  color: var(--c-accent-2);
}

/* Summary */
.overall {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 12px 0;
}

.overall-bar {
  flex: 1;
  height: 10px;
  overflow: hidden;
  border-radius: 5px;
  background: var(--c-empty);
}

.overall-bar span {
  display: block;
  height: 100%;
  border-radius: 5px;
  background: var(--c-accent);
  transition: width 0.4s ease;
}

.overall-count {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.rings {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 4px;
}

/* Week card */
.week-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.week-nav-title {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.dates {
  color: var(--c-muted);
  font-size: 0.85rem;
}

.nav-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0 0 3px;
  border: 1px solid var(--c-border);
  border-radius: 50%;
  background: none;
  color: var(--c-text);
  font: inherit;
  font-size: 1.6rem;
  line-height: 1;
  cursor: pointer;
}

.nav-arrow:hover:not(:disabled) {
  border-color: var(--c-accent);
}

.nav-arrow:disabled {
  opacity: 0.3;
  cursor: default;
}

.week-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin: 10px 0 12px;
  text-align: center;
}

.week-info p {
  margin: 0;
}

.today-line {
  color: var(--c-text);
}

.today-button {
  padding: 4px 12px;
  border: 1px solid var(--c-accent);
  border-radius: 14px;
  background: none;
  color: var(--c-text);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.garmin {
  color: var(--c-muted);
  font-size: 0.85rem;
}

.stats-note {
  margin: 6px 0 0;
  color: var(--c-muted);
  font-size: 0.8rem;
}

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}

.tabs button {
  padding: 4px 12px;
  border: 1px solid var(--c-card-border);
  border-radius: 4px;
  background: transparent;
  color: var(--c-text);
  cursor: pointer;
}

.tabs button.active {
  background: var(--c-accent);
  border-color: var(--c-accent);
  color: var(--c-card-bg);
}

.trainings {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}
</style>
