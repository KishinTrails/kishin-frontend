<template>
  <AppShell
    title="Athlete"
    section="athlete"
    refreshable
    @refresh="(done) => load().finally(done)"
  >
    <template #subnav>
      <AthleteTabs active="overview" />
    </template>

    <section class="card">
      <p
        v-if="daily.error"
        class="error"
      >
        {{ daily.error }}
      </p>
      <SkeletonBlock
        v-else-if="daily.loading"
        height="150px"
      />
      <ActivityGrid
        v-else
        :days="daily.rows"
        :today="today"
      />
    </section>

    <div
      v-if="daily.loading"
      class="two-columns"
    >
      <section
        v-for="index in 2"
        :key="index"
        class="card"
      >
        <SkeletonBlock height="200px" />
      </section>
    </div>
    <div
      v-else-if="!daily.error"
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
  </AppShell>
</template>

<script setup lang="ts">
/**
 * AthletePage.vue — The Overview tab of the athlete pages (`/athlete`): the activity calendar of
 * the last year, and distance and moving time per week.
 * Does not own: the body measurements (`AthleteBodyPage.vue`), the list of activities
 * (`AthleteActivitiesPage.vue`), the activity detail (`ActivityPage.vue`) or any write to the data.
 */
import { computed, onMounted, reactive } from 'vue';
import AppShell from '@/components/AppShell.vue';
import ActivityGrid from '@/components/athlete/ActivityGrid.vue';
import AthleteTabs from '@/components/athlete/AthleteTabs.vue';
import BarChart from '@/components/athlete/BarChart.vue';
import SkeletonBlock from '@/components/SkeletonBlock.vue';
import { athleteErrorText, fetchDailyActivities, type DailyActivities } from '@/services/athleteService';
import { addDays, todayIso } from '@/utils/activityGrid';
import { weeklyTotals } from '@/utils/weeklyTotals';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const today = todayIso();

const daily = reactive({ rows: [] as DailyActivities[], loading: true, error: '' });

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

/** Loads the days of the last 400 days (the grid's year and the weeks around it). */
async function load(): Promise<void> {
  daily.error = '';
  try {
    daily.rows = await fetchDailyActivities(addDays(today, -400), today);
  } catch (error) {
    daily.error = athleteErrorText(error);
  } finally {
    daily.loading = false;
  }
}

onMounted(load);
</script>

<style scoped>
.two-columns {
  display: grid;
  gap: 16px;
  max-width: 1100px;
  margin: 0 auto;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}

.two-columns .card {
  margin: 0 0 16px;
}
</style>
