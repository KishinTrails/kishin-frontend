<template>
  <AppShell
    title="Body"
    section="athlete"
    refreshable
    @refresh="(done) => load().finally(done)"
  >
    <template #subnav>
      <AthleteTabs active="body" />
    </template>

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
      <div
        v-else-if="measures.loading"
        class="three-columns"
      >
        <SkeletonBlock
          v-for="index in 3"
          :key="index"
          height="200px"
        />
      </div>
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
  </AppShell>
</template>

<script setup lang="ts">
/**
 * AthleteBodyPage.vue — The Body tab of the athlete pages (`/athlete/body`): fat ratio, muscle
 * mass and weight from the Withings measurements of the last year, with their moving averages.
 * Does not own: the activities (`AthletePage.vue`, `AthleteActivitiesPage.vue`) or any write to the data.
 */
import { computed, onMounted, reactive } from 'vue';
import AppShell from '@/components/AppShell.vue';
import AthleteTabs from '@/components/athlete/AthleteTabs.vue';
import LineChart from '@/components/athlete/LineChart.vue';
import SkeletonBlock from '@/components/SkeletonBlock.vue';
import { athleteErrorText, fetchMeasures, type MeasureDay } from '@/services/athleteService';
import { addDays, longDate, todayIso } from '@/utils/activityGrid';

const DAY_MS = 86_400_000;

const today = todayIso();

const measures = reactive({ rows: [] as MeasureDay[], loading: true, error: '' });

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

/** Loads the measurements of the last year. */
async function load(): Promise<void> {
  measures.error = '';
  try {
    measures.rows = await fetchMeasures(addDays(today, -364), today);
  } catch (error) {
    measures.error = athleteErrorText(error);
  } finally {
    measures.loading = false;
  }
}

onMounted(load);
</script>

<style scoped>
.section-title {
  margin: 0 0 8px;
  font-size: 1rem;
}

.three-columns {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}
</style>
