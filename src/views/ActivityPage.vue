<template>
  <AppShell
    title="Activity"
    section="athlete"
    :crumbs="crumbs"
  >
    <p
      v-if="error"
      class="card error"
    >
      {{ error }}
    </p>
    <section
      v-else-if="!detail"
      class="card"
    >
      <SkeletonBlock :lines="2" />
      <div class="headline skeleton-tiles">
        <SkeletonBlock
          v-for="index in 4"
          :key="index"
          height="58px"
        />
      </div>
    </section>

    <template v-else>
      <nav
        class="neighbours"
        aria-label="Other activities"
      >
        <router-link
          v-if="neighbours.previous"
          :to="`/athlete/activities/${neighbours.previous.activity_id}`"
          class="neighbour previous"
        >
          <span class="neighbour-direction">‹ Previous</span>
          <span class="neighbour-name">{{ neighbourText(neighbours.previous) }}</span>
        </router-link>
        <span v-else />
        <router-link
          v-if="neighbours.next"
          :to="`/athlete/activities/${neighbours.next.activity_id}`"
          class="neighbour next"
        >
          <span class="neighbour-direction">Next ›</span>
          <span class="neighbour-name">{{ neighbourText(neighbours.next) }}</span>
        </router-link>
      </nav>

      <section class="card">
        <h1>{{ title }}</h1>
        <p class="subtitle">
          {{ formatDateTime(detail.start_time) }}
          <span v-if="detail.name && detail.sport"> · {{ [detail.sport, detail.sub_sport].filter(Boolean).join(' / ') }}</span>
        </p>
        <dl class="headline">
          <div
            v-for="item in headline"
            :key="item.label"
            class="tile"
          >
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
      </section>

      <section
        v-if="track && track.bbox"
        class="card"
      >
        <ActivityMap :track="track" />
      </section>

      <section
        v-if="records && recordX"
        class="card"
      >
        <div class="two-columns">
          <LineChart
            title="Altitude"
            :x="recordX.values"
            :series="[{ name: 'Altitude', values: records.altitude_m }]"
            :format-x="recordX.format"
            :format-y="(value) => `${Math.round(value)} m`"
          />
          <LineChart
            title="Heart rate"
            :x="recordX.values"
            :series="[{ name: 'Heart rate', values: records.hr }]"
            :format-x="recordX.format"
            :format-y="(value) => `${Math.round(value)} bpm`"
          />
          <LineChart
            title="Pace"
            :x="recordX.values"
            :series="[{ name: 'Pace', values: recordPace }]"
            :format-x="recordX.format"
            :format-y="formatPace"
            invert
          />
          <LineChart
            title="Cadence"
            :x="recordX.values"
            :series="[{ name: 'Cadence', values: records.cadence }]"
            :format-x="recordX.format"
            :format-y="(value) => `${Math.round(value)}`"
          />
        </div>
      </section>

      <div class="two-columns wide">
        <section class="card">
          <HrZones :zones="detail.hr_zones" />
        </section>
        <section
          v-if="runningFields.length"
          class="card"
        >
          <h2>Running details</h2>
          <dl class="fields">
            <div
              v-for="item in runningFields"
              :key="item.label"
            >
              <dt>{{ item.label }}</dt>
              <dd>{{ item.value }}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section
        v-if="detail.laps.length"
        class="card"
      >
        <LapTable :laps="detail.laps" />
      </section>

      <section class="card">
        <h2>All fields</h2>
        <dl class="fields">
          <div
            v-for="item in otherFields"
            :key="item.label"
          >
            <dt>{{ item.label }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
      </section>
    </template>
  </AppShell>
</template>

<script setup lang="ts">
/**
 * ActivityPage.vue — One activity with everything the API has on it: summary, map of the GPS
 * track, record charts (altitude, heart rate, pace, cadence), heart rate zones, running details,
 * laps and the remaining fields. Fields without a value are left out. Links lead to the
 * activities just before and after it by start time.
 * Does not own: the list of activities (see `AthleteActivitiesPage.vue`) or any write to the data.
 */
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import AppShell, { type Crumb } from '@/components/AppShell.vue';
import ActivityMap from '@/components/athlete/ActivityMap.vue';
import HrZones from '@/components/athlete/HrZones.vue';
import LapTable from '@/components/athlete/LapTable.vue';
import LineChart from '@/components/athlete/LineChart.vue';
import SkeletonBlock from '@/components/SkeletonBlock.vue';
import {
  AthleteApiError,
  fetchActivity,
  fetchRecords,
  fetchTrack,
  type ActivityDetail,
  type Records,
  type ActivitySummary,
  type Track,
} from '@/services/athleteService';
import { fetchNeighbours, type Neighbours } from '@/services/activityNeighbours';
import {
  formatDateTime,
  formatDuration,
  formatKm,
  formatPace,
  formatValue,
  paceFromSpeed,
} from '@/utils/athleteFormat';

/** Below this speed the watch is taken as stopped, and no pace is drawn. */
const MIN_SPEED_KMH = 2;

const route = useRoute();

const detail = ref<ActivityDetail | null>(null);
const track = ref<Track | null>(null);
const records = ref<Records | null>(null);
const error = ref('');
const neighbours = ref<Neighbours>({ previous: null, next: null });

/**
 * Text of a previous / next link.
 *
 * @param activity - The other activity
 * @returns Its name (or sport) and start time
 */
const neighbourText = (activity: ActivitySummary): string =>
  [activity.name ?? activity.sport ?? activity.activity_id, formatDateTime(activity.start_time)].join(' · ');

const title = computed(() => {
  const activity = detail.value;
  if (!activity) return '';
  return activity.name || [activity.sport, activity.sub_sport].filter(Boolean).join(' / ') || activity.activity_id;
});

/** Athlete › the activity's name and date, once it is loaded. */
const crumbs = computed<Crumb[]>(() => [
  { label: 'Athlete', to: '/athlete' },
  { label: 'Activities', to: '/athlete/activities' },
  { label: detail.value ? `${title.value} · ${formatDateTime(detail.value.start_time)}` : 'Activity' },
]);

/** One labelled value of a definition list. */
interface Field {
  label: string
  value: string
}

/**
 * Keeps the fields that have a value.
 *
 * @param fields - Label and raw value pairs; the formatter runs only for a non-null value
 * @returns The fields to show
 */
const present = (fields: [string, unknown, (value: any) => string][]): Field[] =>
  fields
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([label, value, format]) => ({ label, value: format(value) }));

const text = (value: unknown): string => String(value);

const headline = computed<Field[]>(() => {
  const activity = detail.value;
  if (!activity) return [];
  return present([
    ['Distance', activity.distance_km, formatKm],
    ['Moving time', activity.moving_sec, formatDuration],
    ['Pace', paceFromSpeed(activity.avg_speed_kmh), formatPace],
    ['Ascent', activity.ascent_m, (value) => formatValue(value, 'm')],
    ['Avg HR', activity.avg_hr, (value) => formatValue(value, 'bpm')],
    ['Calories', activity.calories, (value) => formatValue(value, 'kcal')],
  ]);
});

const runningFields = computed<Field[]>(() => {
  const running = detail.value?.running;
  if (!running) return [];
  return present([
    ['Steps', running.steps, text],
    ['Average pace', running.avg_pace_sec_per_km, formatPace],
    ['Average moving pace', running.avg_moving_pace_sec_per_km, formatPace],
    ['Best pace', running.max_pace_sec_per_km, formatPace],
    ['Average cadence', running.avg_steps_per_min, (value) => formatValue(value, 'spm')],
    ['Max cadence', running.max_steps_per_min, (value) => formatValue(value, 'spm')],
    ['Step length', running.avg_step_length_mm, (value) => formatValue(value / 1000, 'm', 2)],
    ['Vertical oscillation', running.avg_vertical_oscillation_mm, (value) => formatValue(value / 10, 'cm', 1)],
    ['Vertical ratio', running.avg_vertical_ratio_pct, (value) => formatValue(value, '%', 1)],
    ['Ground contact time', running.avg_ground_contact_time_ms, (value) => formatValue(value, 'ms')],
    ['VO2 max', running.vo2_max, (value) => formatValue(value, '', 1)],
  ]);
});

const otherFields = computed<Field[]>(() => {
  const activity = detail.value;
  if (!activity) return [];
  return present([
    ['Start', activity.start_time, formatDateTime],
    ['End', activity.stop_time, formatDateTime],
    ['Elapsed time', activity.elapsed_sec, formatDuration],
    ['Average speed', activity.avg_speed_kmh, (value) => formatValue(value, 'km/h', 1)],
    ['Max speed', activity.max_speed_kmh, (value) => formatValue(value, 'km/h', 1)],
    ['Descent', activity.descent_m, (value) => formatValue(value, 'm')],
    ['Max HR', activity.max_hr, (value) => formatValue(value, 'bpm')],
    ['Average cadence', activity.avg_cadence, text],
    ['Max cadence', activity.max_cadence, text],
    ['Aerobic training effect', activity.training_effect, (value) => formatValue(value, '', 1)],
    ['Anaerobic training effect', activity.anaerobic_training_effect, (value) => formatValue(value, '', 1)],
    ['Training load', activity.training_load, (value) => formatValue(value, '', 0)],
    ['Feel (Garmin)', activity.self_eval_feel, text],
    ['Effort (Garmin)', activity.self_eval_effort, text],
    ['Average respiration', activity.avg_rr, (value) => formatValue(value, 'brpm', 1)],
    ['Max respiration', activity.max_rr, (value) => formatValue(value, 'brpm', 1)],
    ['Average temperature', activity.avg_temperature_c, (value) => formatValue(value, '°C', 1)],
    ['Min temperature', activity.min_temperature_c, (value) => formatValue(value, '°C', 1)],
    ['Max temperature', activity.max_temperature_c, (value) => formatValue(value, '°C', 1)],
    ['Cycles', activity.cycles, (value) => formatValue(value)],
    ['Laps', activity.lap_count, text],
    ['Type', activity.type, text],
    ['Heart rate zones method', activity.hr_zones_method, text],
    ['Description', activity.description, text],
    ['Activity id', activity.activity_id, text],
  ]);
});

/** The x axis of the record charts: distance when the records have it, minutes otherwise. */
const recordX = computed(() => {
  const series = records.value;
  if (!series || series.hr.length === 0) return null;
  if (series.distance_km.some((value) => value !== null)) {
    return { values: series.distance_km, format: (value: number) => `${value.toFixed(1)} km` };
  }
  return {
    values: series.elapsed_sec.map((value) => (value === null ? null : value / 60)),
    format: (value: number) => formatDuration(value * 60),
  };
});

const recordPace = computed(() =>
  (records.value?.speed_kmh ?? []).map((speed) =>
    speed !== null && speed >= MIN_SPEED_KMH ? 3600 / speed : null,
  ),
);

/** The id of the activity shown, so a change of the route's id loads the new one. */
let loadedId: string | null = null;

/**
 * Loads an activity, then its track, records and neighbours.
 *
 * @param id - The activity id
 */
async function load(id: string): Promise<void> {
  loadedId = id;
  detail.value = null;
  track.value = null;
  records.value = null;
  error.value = '';
  neighbours.value = { previous: null, next: null };
  try {
    detail.value = await fetchActivity(id);
  } catch (caught) {
    error.value =
      caught instanceof AthleteApiError && caught.status === 404
        ? 'This activity does not exist.'
        : caught instanceof AthleteApiError && caught.status === 503
          ? 'Health data is not configured on the server.'
          : 'Could not load the activity.';
    return;
  }
  const [trackResult, recordsResult, neighboursResult] = await Promise.allSettled([
    fetchTrack(id),
    fetchRecords(id),
    fetchNeighbours(id, detail.value.start_time),
  ]);
  if (loadedId !== id) return;
  if (trackResult.status === 'fulfilled') track.value = trackResult.value;
  if (recordsResult.status === 'fulfilled') records.value = recordsResult.value;
  if (neighboursResult.status === 'fulfilled') neighbours.value = neighboursResult.value;
}

// Ionic may keep this page and change only the id when a previous / next link is followed. The
// route also changes when another page opens; only an Activity route with a new id loads.
watch(
  () => [route.name, route.params.id],
  () => {
    const id = route.params.id;
    if (route.name === 'Activity' && typeof id === 'string' && id !== loadedId) {
      void load(id);
    }
  },
  { immediate: true },
);
</script>

<style scoped>
h1 {
  margin: 0;
  font-size: 1.4rem;
}

h2 {
  margin: 0 0 6px;
  font-size: 1rem;
}

.subtitle {
  margin: 4px 0 12px;
  color: var(--c-muted);
}

.headline {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
  margin: 0;
}

.skeleton-tiles {
  margin-top: 14px;
}

.tile {
  padding: 10px 12px;
  border: 1px solid var(--c-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--c-accent) 6%, transparent);
}

.headline dt {
  color: var(--c-muted);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.headline dd {
  margin: 2px 0 0;
  font-size: 1.3rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.neighbours {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  max-width: 1100px;
  margin: 0 auto 12px;
}

.neighbour {
  display: flex;
  flex-direction: column;
  max-width: 48%;
  padding: 6px 12px;
  border: 1px solid var(--c-card-border);
  border-radius: 8px;
  background: var(--c-card-bg);
  color: var(--c-text);
  text-decoration: none;
}

.neighbour:hover {
  border-color: var(--c-accent);
}

.neighbour.next {
  align-items: flex-end;
  text-align: right;
}

.neighbour-direction {
  color: var(--c-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

.neighbour-name {
  overflow: hidden;
  font-size: 0.85rem;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.two-columns {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
}

.two-columns.wide {
  max-width: 1100px;
  margin: 0 auto;
}

.two-columns.wide .card {
  margin: 0 0 16px;
}

.fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 6px 16px;
  margin: 0;
}

.fields div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid var(--c-border);
  padding: 3px 0;
}

.fields dt {
  color: var(--c-muted);
}

.fields dd {
  margin: 0;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
