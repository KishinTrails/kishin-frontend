<template>
  <ion-page>
    <ion-content :fullscreen="true">
      <div
        class="athlete"
        :class="theme"
      >
        <header class="page-header">
          <router-link
            to="/map"
            class="back"
          >
            ← Map
          </router-link>
          <router-link
            to="/athlete"
            class="back"
          >
            Athlete data
          </router-link>
        </header>

        <p
          v-if="error"
          class="card error"
        >
          {{ error }}
        </p>
        <p
          v-else-if="!plan"
          class="card loading"
        >
          Loading the plan…
        </p>

        <template v-else>
          <section class="card">
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
            <dl class="stats">
              <div
                v-for="count in counts"
                :key="count.label"
              >
                <dt>{{ count.label }}</dt>
                <dd>{{ count.done }}/{{ count.planned }}</dd>
              </div>
            </dl>
            <p class="stats-note">
              {{ countsNote }}
            </p>
          </section>

          <section
            v-if="selected"
            class="card"
          >
            <h2>
              Week {{ selected.week_number }} · {{ selected.phase }}
              <span class="dates">{{ longDate(selected.start) }} – {{ longDate(selected.end) }}</span>
            </h2>
            <p
              v-if="selected.running"
              class="subtitle"
            >
              Garmin: {{ selected.running.run_count }} runs, {{ selected.running.run_km.toFixed(1) }} km
            </p>
            <div class="trainings">
              <TrainingCard
                v-for="training in selected.trainings"
                :key="training.id"
                :training="training"
                @changed="reload"
              />
            </div>
          </section>

          <section class="card">
            <LineChart
              title="Long run per week"
              :x="series.weeks"
              :series="[
                { name: 'Planned', values: series.planned, dashed: true },
                { name: 'Longest Garmin run', values: series.longest },
              ]"
              :format-x="(value) => `Week ${Math.round(value)}`"
              :format-y="(value) => `${value.toFixed(1)} km`"
            />
          </section>

          <section class="card">
            <WeekTimeline
              :weeks="plan.weeks"
              :current-week="plan.current_week"
              :selected-week="selectedWeek"
              @select="selectedWeek = $event"
            />
          </section>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
/**
 * PlanPage.vue — Progression of the active training plan: completion counts, the selected week's
 * trainings (the current week by default) with their completion forms, the planned long run
 * against the longest Garmin run of each week, and the timeline of all weeks.
 * Does not own: importing plans (`kishin plan import` on the server) or Willpower.
 */
import { computed, onMounted, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import '@/theme/athlete.css';
import LineChart from '@/components/athlete/LineChart.vue';
import TrainingCard from '@/components/plan/TrainingCard.vue';
import WeekTimeline from '@/components/plan/WeekTimeline.vue';
import { loadMapStyle, styleToThemeClass } from '@/services/mapStyleService';
import { fetchPlan, PlanApiError, type PlanProgress } from '@/services/planService';
import { longDate } from '@/utils/activityGrid';
import { completionCounts, longRunSeries } from '@/utils/planProgress';

const theme = styleToThemeClass(loadMapStyle());

const plan = ref<PlanProgress | null>(null);
const error = ref('');
const selectedWeek = ref(1);

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
const countsNote = computed(() =>
  plan.value && plan.value.current_week < plan.value.week_count
    ? 'Counted up to the current week.'
    : 'Counted over the whole plan.',
);

const series = computed(() =>
  plan.value ? longRunSeries(plan.value, plan.value.current_week) : { weeks: [], planned: [], longest: [] },
);

/** Loads the plan again, keeping the selected week. */
async function reload(): Promise<void> {
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
.athlete {
  min-height: 100%;
  padding: 16px;
  background: var(--c-page-bg);
  color: var(--c-text);
}

.page-header {
  display: flex;
  gap: 16px;
  max-width: 1100px;
  margin: 0 auto 12px;
}

.back {
  color: var(--c-link);
}

.theme-ukiyo .back {
  color: var(--c-card-bg);
}

.card {
  max-width: 1100px;
  margin: 0 auto 16px;
  padding: 14px 16px;
  background: var(--c-card-bg);
  border: 1px solid var(--c-card-border);
  border-radius: 8px;
}

h1 {
  margin: 0;
  font-size: 1.4rem;
}

h2 {
  margin: 0 0 6px;
  font-size: 1rem;
}

.dates {
  margin-left: 8px;
  color: var(--c-muted);
  font-weight: normal;
  font-size: 0.85rem;
}

.subtitle {
  margin: 4px 0 10px;
  color: var(--c-muted);
}

.notice {
  color: var(--c-accent-2);
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 28px;
  margin: 0;
}

.stats dt {
  color: var(--c-muted);
  font-size: 0.8rem;
}

.stats dd {
  margin: 0;
  font-size: 1.2rem;
  font-variant-numeric: tabular-nums;
}

.stats-note {
  margin: 6px 0 0;
  color: var(--c-muted);
  font-size: 0.8rem;
}

.trainings {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}

.error {
  color: var(--c-accent-2);
}

.loading {
  color: var(--c-muted);
}
</style>
