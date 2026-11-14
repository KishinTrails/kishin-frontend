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
          <h1>Athlete</h1>
        </header>

        <section class="card">
          <p
            v-if="daily.error"
            class="error"
          >
            {{ daily.error }}
          </p>
          <p
            v-else-if="daily.loading"
            class="loading"
          >
            Loading activities…
          </p>
          <ActivityGrid
            v-else
            :days="daily.rows"
            :today="today"
          />
        </section>

        <div
          v-if="!daily.loading && !daily.error"
          class="two-columns"
        >
          <section class="card">
            <BarChart
              title="Distance per week"
              :bars="weeklyDistance"
              :format="(value) => `${value.toFixed(0)} km`"
            />
          </section>
          <section class="card">
            <BarChart
              title="Moving time per week"
              :bars="weeklyTime"
              :format="formatHours"
            />
          </section>
        </div>

        <section class="card">
          <h2 class="section-title">
            Body measurements
          </h2>
          <p
            v-if="measures.error"
            class="error"
          >
            {{ measures.error }}
          </p>
          <p
            v-else-if="measures.loading"
            class="loading"
          >
            Loading measurements…
          </p>
          <div
            v-else
            class="three-columns"
          >
            <LineChart
              title="Fat ratio"
              :x="measureDays"
              :series="[
                { name: 'Fat ratio', values: measures.rows.map((row) => row.fat_ratio_pct) },
                { name: 'Moving average', values: measures.rows.map((row) => row.fat_ratio_ema), dashed: true },
              ]"
              :format-x="formatDayNumber"
              :format-y="(value) => `${value.toFixed(1)} %`"
            />
            <LineChart
              title="Muscle mass"
              :x="measureDays"
              :series="[
                { name: 'Muscle mass', values: measures.rows.map((row) => row.muscle_mass_kg) },
                { name: 'Moving average', values: measures.rows.map((row) => row.muscle_mass_ema), dashed: true },
              ]"
              :format-x="formatDayNumber"
              :format-y="(value) => `${value.toFixed(1)} kg`"
            />
            <LineChart
              title="Weight"
              :x="measureDays"
              :series="[{ name: 'Weight', values: measures.rows.map((row) => row.weight_kg) }]"
              :format-x="formatDayNumber"
              :format-y="(value) => `${value.toFixed(1)} kg`"
            />
          </div>
        </section>

        <section class="card">
          <p
            v-if="activities.error"
            class="error"
          >
            {{ activities.error }}
          </p>
          <ActivityList
            v-else
            :activities="activities.rows"
            :has-more="activities.hasMore"
            :loading="activities.loading"
            @load-more="loadActivities"
          />
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
/**
 * AthletePage.vue — Overview of the athlete data: the activity calendar, distance and moving
 * time per week, the body measurements and the list of activities.
 * Each block loads on its own and shows its own error.
 * Does not own: the activity detail (see `ActivityPage.vue`) or any write to the data.
 */
import { computed, onMounted, reactive } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import '@/theme/athlete.css';
import ActivityGrid from '@/components/athlete/ActivityGrid.vue';
import ActivityList from '@/components/athlete/ActivityList.vue';
import BarChart from '@/components/athlete/BarChart.vue';
import LineChart from '@/components/athlete/LineChart.vue';
import {
  AthleteApiError,
  fetchActivities,
  fetchDailyActivities,
  fetchMeasures,
  type ActivitySummary,
  type DailyActivities,
  type MeasureDay,
} from '@/services/athleteService';
import { loadMapStyle, styleToThemeClass } from '@/services/mapStyleService';
import { addDays, longDate, todayIso } from '@/utils/activityGrid';
import { weeklyTotals } from '@/utils/weeklyTotals';

const PAGE_SIZE = 20;
const DAY_MS = 86_400_000;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const theme = styleToThemeClass(loadMapStyle());
const today = todayIso();

const daily = reactive({ rows: [] as DailyActivities[], loading: true, error: '' });
const measures = reactive({ rows: [] as MeasureDay[], loading: true, error: '' });
const activities = reactive({ rows: [] as ActivitySummary[], loading: false, hasMore: true, error: '' });

/**
 * The text shown for a failed request.
 *
 * @param error - What the request threw
 * @returns A sentence for the page
 */
const errorText = (error: unknown): string =>
  error instanceof AthleteApiError && error.status === 503
    ? 'Health data is not configured on the server.'
    : 'Could not load the data.';

const weeks = computed(() => weeklyTotals(daily.rows, today));

/**
 * `1 Mar` for a week's Monday.
 *
 * @param week - ISO day of the Monday
 * @returns Day and month
 */
const weekLabel = (week: string): string => {
  const [, m, d] = week.split('-').map(Number);
  return `${d} ${MONTH_NAMES[m! - 1]}`;
};

const weeklyDistance = computed(() =>
  weeks.value.map((week) => ({ key: week.week, label: weekLabel(week.week), value: week.distance_km })),
);
const weeklyTime = computed(() =>
  weeks.value.map((week) => ({ key: week.week, label: weekLabel(week.week), value: week.moving_sec / 3600 })),
);

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

/** The measurement days as day numbers (days since 1970-01-01), the x axis of the charts. */
const measureDays = computed(() =>
  measures.rows.map((row) => {
    const [y, m, d] = row.date.split('-').map(Number);
    return Date.UTC(y!, m! - 1, d!) / DAY_MS;
  }),
);

/**
 * A day number as a date.
 *
 * @param dayNumber - Days since 1970-01-01
 * @returns For example `Tue 3 Mar 2026`
 */
const formatDayNumber = (dayNumber: number): string =>
  longDate(addDays('1970-01-01', Math.round(dayNumber)));

/** Loads the next page of activities. */
async function loadActivities(): Promise<void> {
  activities.loading = true;
  try {
    const page = await fetchActivities({ limit: PAGE_SIZE, offset: activities.rows.length });
    activities.rows.push(...page);
    activities.hasMore = page.length === PAGE_SIZE;
  } catch (error) {
    activities.error = errorText(error);
  } finally {
    activities.loading = false;
  }
}

onMounted(async () => {
  const dailyLoad = fetchDailyActivities(addDays(today, -400), today)
    .then((rows) => { daily.rows = rows; })
    .catch((error) => { daily.error = errorText(error); })
    .finally(() => { daily.loading = false; });
  const measuresLoad = fetchMeasures(addDays(today, -364), today)
    .then((rows) => { measures.rows = rows; })
    .catch((error) => { measures.error = errorText(error); })
    .finally(() => { measures.loading = false; });
  await Promise.all([dailyLoad, measuresLoad, loadActivities()]);
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
  align-items: baseline;
  gap: 16px;
  max-width: 1100px;
  margin: 0 auto 12px;
}

.page-header h1 {
  margin: 0;
  font-size: 1.4rem;
  color: var(--c-card-bg);
}

.theme-standard .page-header h1 {
  color: var(--c-text);
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

.section-title {
  margin: 0 0 8px;
  font-size: 1rem;
}

.two-columns,
.three-columns {
  display: grid;
  gap: 16px;
}

.two-columns {
  max-width: 1100px;
  margin: 0 auto;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

.two-columns .card {
  margin: 0 0 16px;
}

.three-columns {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.error {
  color: var(--c-accent-2);
}

.loading {
  color: var(--c-muted);
}
</style>
