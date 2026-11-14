<script setup lang="ts">
/**
 * TrainingCard.vue — One training of a plan week and its completion. A run shows its target and,
 * once done, the Garmin activity and RPE that completed it; "Done" opens a form listing the
 * week's unlinked running activities and an RPE choice. A tick item (cross-training, leg day,
 * yoga) is a checkbox. Server refusals (for example a run too short) are shown as returned.
 * Does not own: reloading the plan; it emits `changed` after every successful change.
 */
import { computed, ref } from 'vue';
import type { ActivitySummary } from '@/services/athleteService';
import {
  completeTraining,
  fetchCandidates,
  PlanApiError,
  uncompleteTraining,
  type PlanTraining,
} from '@/services/planService';
import { formatDateTime, formatDuration } from '@/utils/athleteFormat';
import { trainingLabel } from '@/utils/planProgress';

const props = defineProps<{
  training: PlanTraining
}>();

const emit = defineEmits<{
  (event: 'changed'): void
}>();

const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const formOpen = ref(false);
const candidates = ref<ActivitySummary[]>([]);
const selectedActivity = ref('');
const rpe = ref<number | null>(null);
const busy = ref(false);
const error = ref('');

const target = computed(() => {
  const parts: string[] = [];
  if (props.training.target_distance_km) parts.push(`${props.training.target_distance_km} km`);
  if (props.training.target_duration_sec) parts.push(`${Math.round(props.training.target_duration_sec / 60)} min`);
  const segment = props.training.segments[0];
  if (segment && segment.rpe_min !== null && segment.rpe_max !== null) parts.push(`RPE ${segment.rpe_min}–${segment.rpe_max}`);
  return parts.join(' · ');
});

/**
 * Text of one candidate in the list.
 *
 * @param activity - The activity
 * @returns Date, name, distance and moving time
 */
const candidateText = (activity: ActivitySummary): string =>
  [
    formatDateTime(activity.start_time),
    activity.name ?? activity.sport ?? '',
    activity.distance_km === null ? '' : `${activity.distance_km.toFixed(2)} km`,
    formatDuration(activity.moving_sec),
  ].filter(Boolean).join(' · ');

/**
 * Runs a request, keeping the error text the server gave.
 *
 * @param action - The request
 */
async function run(action: () => Promise<unknown>): Promise<boolean> {
  busy.value = true;
  error.value = '';
  try {
    await action();
    return true;
  } catch (caught) {
    error.value = caught instanceof PlanApiError ? caught.detail : 'The request failed.';
    return false;
  } finally {
    busy.value = false;
  }
}

/** Opens the completion form of a run and loads its candidates. */
async function openForm(): Promise<void> {
  formOpen.value = true;
  selectedActivity.value = '';
  rpe.value = null;
  await run(async () => {
    candidates.value = await fetchCandidates(props.training.id);
  });
}

/** Sends the run's completion. */
async function submitRun(): Promise<void> {
  if (!selectedActivity.value || rpe.value === null) return;
  const ok = await run(() => completeTraining(props.training.id, { activity_id: selectedActivity.value, rpe: rpe.value! }));
  if (ok) {
    formOpen.value = false;
    emit('changed');
  }
}

/** Ticks or unticks a tick item. */
async function toggleTick(): Promise<void> {
  const ok = await run(() =>
    props.training.completion ? uncompleteTraining(props.training.id) : completeTraining(props.training.id),
  );
  if (ok) emit('changed');
}

/** Removes a run's completion. */
async function undo(): Promise<void> {
  if (await run(() => uncompleteTraining(props.training.id))) emit('changed');
}
</script>

<template>
  <article
    class="training-card"
    :class="{ done: training.completion }"
  >
    <header>
      <label
        v-if="training.is_tick"
        class="tick"
      >
        <input
          type="checkbox"
          :checked="training.completion !== null"
          :disabled="busy"
          @change="toggleTick"
        >
        <span class="name">{{ trainingLabel(training.type) }}</span>
      </label>
      <template v-else>
        <span
          class="status"
          :aria-label="training.completion ? 'Done' : 'Not done'"
        >{{ training.completion ? '✓' : '○' }}</span>
        <span class="name">{{ trainingLabel(training.type) }}</span>
      </template>
      <span
        v-if="target"
        class="target"
      >{{ target }}</span>
    </header>

    <div
      v-if="!training.is_tick && training.completion"
      class="completion"
    >
      <p v-if="training.completion.activity">
        {{ training.completion.activity.name ?? training.completion.activity.activity_id }}
        <span v-if="training.completion.activity.start_time"> · {{ formatDateTime(training.completion.activity.start_time) }}</span>
        <span v-if="training.completion.activity.distance_km !== null"> · {{ training.completion.activity.distance_km.toFixed(2) }} km</span>
        <span v-if="training.completion.activity.moving_sec !== null"> · {{ formatDuration(training.completion.activity.moving_sec) }}</span>
      </p>
      <p v-if="training.completion.rpe !== null">
        RPE {{ training.completion.rpe }}
      </p>
      <button
        type="button"
        :disabled="busy"
        @click="undo"
      >
        Undo
      </button>
    </div>

    <div
      v-else-if="!training.is_tick"
      class="form"
    >
      <button
        v-if="!formOpen"
        type="button"
        @click="openForm"
      >
        Done…
      </button>
      <form
        v-else
        @submit.prevent="submitRun"
      >
        <label>
          Activity
          <select
            v-model="selectedActivity"
            required
          >
            <option
              value=""
              disabled
            >
              {{ candidates.length ? 'Choose the activity' : 'No running activity this week' }}
            </option>
            <option
              v-for="activity in candidates"
              :key="activity.activity_id"
              :value="activity.activity_id"
            >
              {{ candidateText(activity) }}
            </option>
          </select>
        </label>
        <label>
          RPE
          <select
            v-model.number="rpe"
            required
          >
            <option
              :value="null"
              disabled
            >
              –
            </option>
            <option
              v-for="value in RPE_VALUES"
              :key="value"
              :value="value"
            >
              {{ value }}
            </option>
          </select>
        </label>
        <button
          type="submit"
          :disabled="busy || !selectedActivity || rpe === null"
        >
          Save
        </button>
        <button
          type="button"
          @click="formOpen = false"
        >
          Cancel
        </button>
      </form>
    </div>

    <p
      v-if="error"
      class="error"
      role="alert"
    >
      {{ error }}
    </p>
  </article>
</template>

<style scoped>
.training-card {
  padding: 8px 10px;
  border: 1px solid var(--c-border);
  border-radius: 6px;
}

.training-card.done {
  border-color: var(--c-accent);
}

header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}

.name {
  font-weight: bold;
  color: var(--c-text);
}

.status {
  color: var(--c-accent);
}

.target {
  color: var(--c-muted);
  font-size: 0.85rem;
}

.tick {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.completion p {
  margin: 4px 0;
  color: var(--c-text);
  font-size: 0.9rem;
}

form {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 8px;
  margin-top: 6px;
}

label {
  display: flex;
  flex-direction: column;
  font-size: 0.85rem;
  color: var(--c-muted);
}

select {
  max-width: 100%;
  font: inherit;
}

button {
  margin-top: 4px;
  padding: 3px 10px;
  background: none;
  color: var(--c-text);
  border: 1px solid var(--c-border);
  border-radius: 4px;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.error {
  margin: 6px 0 0;
  color: var(--c-accent-2);
  font-size: 0.85rem;
}

@media (max-width: 640px) {
  button,
  select {
    min-height: 40px;
  }
}
</style>
