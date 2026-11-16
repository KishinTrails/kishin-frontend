<script setup lang="ts">
/**
 * TrainingCard.vue — One training of a plan week and its completion.
 * A run shows its target and, once done, the Garmin activity and RPE that completed it. "Done…"
 * opens a form, as wide as the row of cards, listing the week's unlinked running activities as
 * choices and an RPE slider (1–10, unset until moved). A tick item (cross-training, leg day,
 * yoga) is one button: a tap anywhere on the card ticks or unticks it.
 * A done training gets a tinted card and a round seal (済 in the ukiyo-e theme, ✓ in the standard
 * one), stamped with a short animation when it becomes done while the card is shown.
 * Server refusals (for example a run too short) are shown as returned, under the card and in a
 * toast; every saved change shows a toast too (`services/feedbackService.ts`).
 * Does not own: reloading the plan; it emits `changed` after every successful change.
 */
import { computed, ref, watch } from 'vue';
import type { ActivitySummary } from '@/services/athleteService';
import {
  completeTraining,
  fetchCandidates,
  PlanApiError,
  uncompleteTraining,
  type PlanTraining,
} from '@/services/planService';
import { notify } from '@/services/feedbackService';
import { formatDateTime, formatDuration } from '@/utils/athleteFormat';
import { rpeWord, trainingLabel } from '@/utils/planProgress';

const props = defineProps<{
  training: PlanTraining
}>();

const emit = defineEmits<{
  (event: 'changed'): void
}>();

/** Where the slider sits before it is moved; the value only counts once it is moved. */
const RPE_START = 5;

const formOpen = ref(false);
const candidates = ref<ActivitySummary[]>([]);
const candidatesLoaded = ref(false);
const selectedActivity = ref('');
const rpe = ref<number | null>(null);
const busy = ref(false);
const error = ref('');
const stamped = ref(false);

const done = computed(() => props.training.completion !== null);
const label = computed(() => trainingLabel(props.training.type));

// The seal is stamped when the training becomes done, not when a done card first appears.
watch(done, (isDone, wasDone) => {
  stamped.value = isDone && !wasDone;
});

const target = computed(() => {
  const parts: string[] = [];
  if (props.training.target_distance_km) parts.push(`${props.training.target_distance_km} km`);
  if (props.training.target_duration_sec) parts.push(`${Math.round(props.training.target_duration_sec / 60)} min`);
  const segment = props.training.segments[0];
  if (segment && segment.rpe_min !== null && segment.rpe_max !== null) parts.push(`RPE ${segment.rpe_min}–${segment.rpe_max}`);
  return parts.join(' · ');
});

/**
 * First line of a candidate: when, and its name.
 *
 * @param activity - The activity
 * @returns Date and time, then the name or the sport
 */
const candidateTitle = (activity: ActivitySummary): string =>
  [formatDateTime(activity.start_time), activity.name ?? activity.sport ?? ''].filter(Boolean).join(' · ');

/**
 * Second line of a candidate: distance and moving time.
 *
 * @param activity - The activity
 * @returns For example `12.40 km · 1:08:20`
 */
const candidateFigures = (activity: ActivitySummary): string =>
  [
    activity.distance_km === null ? '' : `${activity.distance_km.toFixed(2)} km`,
    formatDuration(activity.moving_sec),
  ].filter(Boolean).join(' · ');

/**
 * Runs a request, keeping the error text the server gave.
 *
 * @param action - The request
 * @param saved - Toast shown when it succeeds; none when omitted. A failure always shows a toast.
 * @returns True when it succeeded
 */
async function run(action: () => Promise<unknown>, saved?: string): Promise<boolean> {
  busy.value = true;
  error.value = '';
  try {
    await action();
    if (saved) void notify(saved);
    return true;
  } catch (caught) {
    error.value = caught instanceof PlanApiError ? caught.detail : 'The request failed.';
    void notify(error.value, 'error');
    return false;
  } finally {
    busy.value = false;
  }
}

/** Opens the completion form of a run and loads its candidates. */
async function openForm(): Promise<void> {
  formOpen.value = true;
  candidatesLoaded.value = false;
  selectedActivity.value = '';
  rpe.value = null;
  await run(async () => {
    candidates.value = await fetchCandidates(props.training.id);
  });
  candidatesLoaded.value = true;
}

/**
 * Takes the slider's value once the user moves it.
 *
 * @param event - The `input` event of the range input
 */
function onRpeInput(event: Event): void {
  rpe.value = Number((event.target as HTMLInputElement).value);
}

/** Sends the run's completion. */
async function submitRun(): Promise<void> {
  if (!selectedActivity.value || rpe.value === null) return;
  const ok = await run(
    () => completeTraining(props.training.id, { activity_id: selectedActivity.value, rpe: rpe.value! }),
    `${label.value} done.`,
  );
  if (ok) {
    formOpen.value = false;
    emit('changed');
  }
}

/** Ticks or unticks a tick item. */
async function toggleTick(): Promise<void> {
  const wasDone = done.value;
  const ok = await run(
    () => (wasDone ? uncompleteTraining(props.training.id) : completeTraining(props.training.id)),
    wasDone ? `${label.value} unticked.` : `${label.value} ticked.`,
  );
  if (ok) emit('changed');
}

/** Removes a run's completion. */
async function undo(): Promise<void> {
  if (await run(() => uncompleteTraining(props.training.id), `${label.value} marked not done.`)) emit('changed');
}
</script>

<template>
  <article
    class="training-card"
    :class="{ done, open: formOpen, tick: training.is_tick }"
  >
    <span
      v-if="done"
      class="seal"
      :class="{ stamped }"
      aria-hidden="true"
    >
      <span class="seal-kanji">済</span>
      <span class="seal-check">✓</span>
    </span>

    <button
      v-if="training.is_tick"
      type="button"
      class="tick-toggle"
      :aria-pressed="done"
      :disabled="busy"
      @click="toggleTick"
    >
      <span
        class="check"
        aria-hidden="true"
      >✓</span>
      <span class="name">{{ trainingLabel(training.type) }}</span>
      <span class="tick-hint">{{ done ? 'Done · tap to undo' : 'Tap when done' }}</span>
    </button>

    <template v-else>
      <header>
        <span class="name">{{ trainingLabel(training.type) }}</span>
        <span
          v-if="target"
          class="target"
        >{{ target }}</span>
      </header>

      <div
        v-if="training.completion"
        class="completion"
      >
        <p v-if="training.completion.activity">
          {{ training.completion.activity.name ?? training.completion.activity.activity_id }}
          <span v-if="training.completion.activity.start_time"> · {{ formatDateTime(training.completion.activity.start_time) }}</span>
        </p>
        <p class="figures">
          <template v-if="training.completion.activity">
            <span v-if="training.completion.activity.distance_km !== null">{{ training.completion.activity.distance_km.toFixed(2) }} km</span>
            <span v-if="training.completion.activity.moving_sec !== null">{{ formatDuration(training.completion.activity.moving_sec) }}</span>
          </template>
          <span v-if="training.completion.rpe !== null">RPE {{ training.completion.rpe }}</span>
        </p>
        <button
          type="button"
          class="link-button"
          :disabled="busy"
          @click="undo"
        >
          Undo
        </button>
      </div>

      <button
        v-else-if="!formOpen"
        type="button"
        class="primary-button"
        @click="openForm"
      >
        Done…
      </button>

      <form
        v-else
        @submit.prevent="submitRun"
      >
        <fieldset class="candidates">
          <legend>Which run?</legend>
          <p
            v-if="!candidatesLoaded"
            class="hint"
          >
            Loading this week's runs…
          </p>
          <p
            v-else-if="!candidates.length"
            class="hint"
          >
            No running activity this week.
          </p>
          <label
            v-for="activity in candidates"
            :key="activity.activity_id"
            class="candidate"
            :class="{ selected: selectedActivity === activity.activity_id }"
          >
            <input
              v-model="selectedActivity"
              type="radio"
              :name="`candidate-${training.id}`"
              :value="activity.activity_id"
            >
            <span class="candidate-title">{{ candidateTitle(activity) }}</span>
            <span class="candidate-figures">{{ candidateFigures(activity) }}</span>
          </label>
        </fieldset>

        <label class="rpe">
          <span class="rpe-label">How hard was it? (RPE)</span>
          <input
            type="range"
            min="1"
            max="10"
            step="1"
            :value="rpe ?? RPE_START"
            :class="{ unset: rpe === null }"
            :aria-valuetext="rpe === null ? 'Not set' : `${rpe}, ${rpeWord(rpe)}`"
            @input="onRpeInput"
          >
          <output>{{ rpe === null ? 'Move the slider' : `RPE ${rpe} · ${rpeWord(rpe)}` }}</output>
        </label>

        <div class="form-buttons">
          <button
            type="button"
            class="link-button"
            @click="formOpen = false"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="primary-button"
            :disabled="busy || !selectedActivity || rpe === null"
          >
            Save
          </button>
        </div>
      </form>
    </template>

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
  position: relative;
  padding: 10px 12px;
  border: 1px solid var(--c-border);
  border-radius: 8px;
  transition: background-color 0.2s, border-color 0.2s;
}

.training-card.open {
  grid-column: 1 / -1;
}

.training-card.done {
  border-color: var(--c-accent);
  background: color-mix(in srgb, var(--c-accent) 12%, transparent);
}

header {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-right: 44px;
}

.name {
  font-weight: 700;
  color: var(--c-text);
}

.target {
  color: var(--c-muted);
  font-size: 0.85rem;
}

/* Seal */
.seal {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 2px solid var(--c-seal);
  border-radius: 50%;
  color: var(--c-seal);
  font-weight: 700;
  transform: rotate(-12deg);
  --c-seal: var(--c-accent);
}

.theme-ukiyo .seal {
  --c-seal: #B5442C;
  background: color-mix(in srgb, #B5442C 10%, transparent);
  font-size: 1.1rem;
}

.seal-kanji,
.theme-ukiyo .seal-check {
  display: none;
}

/* The kanji alone is drawn in a Japanese serif (mincho) font, as a carved seal; Latin text never is. */
.theme-ukiyo .seal-kanji {
  display: inline;
  font-family: "Noto Serif CJK JP", "Source Han Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif;
}

.seal.stamped {
  animation: stamp 0.35s ease-out;
}

@keyframes stamp {
  0% { opacity: 0; transform: scale(2.2) rotate(-12deg); }
  70% { opacity: 1; transform: scale(0.9) rotate(-12deg); }
  100% { transform: scale(1) rotate(-12deg); }
}

@media (prefers-reduced-motion: reduce) {
  .seal.stamped {
    animation: none;
  }
}

/* Tick items */
.training-card.tick {
  padding: 0;
}

.tick-toggle {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  align-items: center;
  column-gap: 12px;
  width: 100%;
  padding: 10px 52px 10px 12px;
  border: none;
  border-radius: 8px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.tick-toggle:hover {
  background: color-mix(in srgb, var(--c-accent) 6%, transparent);
}

.tick-toggle:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: -2px;
}

.check {
  grid-row: 1 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 2px solid var(--c-border);
  border-radius: 50%;
  color: transparent;
  font-weight: 700;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
}

.done .check {
  border-color: var(--c-accent);
  background: var(--c-accent);
  color: var(--c-card-bg);
}

.tick-hint {
  color: var(--c-muted);
  font-size: 0.8rem;
}

/* Completed run */
.completion {
  margin-top: 6px;
}

.completion p {
  margin: 2px 0;
  color: var(--c-text);
  font-size: 0.9rem;
}

.figures {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-variant-numeric: tabular-nums;
}

/* Buttons */
button {
  font: inherit;
}

.primary-button {
  margin-top: 8px;
  padding: 6px 14px;
  border: 1px solid var(--c-accent);
  border-radius: 6px;
  background: var(--c-accent);
  color: var(--c-card-bg);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.primary-button:disabled {
  opacity: 0.45;
  cursor: default;
}

.link-button {
  padding: 4px 6px;
  border: none;
  background: none;
  color: var(--c-muted);
  font-size: 0.85rem;
  text-decoration: underline;
  cursor: pointer;
}

.link-button:hover {
  color: var(--c-text);
}

/* Completion form */
form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 10px;
}

.candidates {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: none;
}

legend,
.rpe-label {
  margin-bottom: 4px;
  padding: 0;
  color: var(--c-muted);
  font-size: 0.85rem;
  font-weight: 600;
}

.hint {
  margin: 0;
  color: var(--c-muted);
  font-size: 0.9rem;
}

.candidate {
  display: grid;
  grid-template-columns: auto 1fr;
  column-gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--c-border);
  border-radius: 6px;
  color: var(--c-text);
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}

.candidate:hover {
  border-color: var(--c-accent);
}

.candidate.selected {
  border: 2px solid var(--c-accent);
  padding: 7px 9px;
  background: color-mix(in srgb, var(--c-accent) 10%, transparent);
}

.candidate input {
  grid-row: 1 / 3;
  align-self: center;
  margin: 0;
  accent-color: var(--c-accent);
}

.candidate-title {
  overflow-wrap: anywhere;
  font-weight: 600;
}

.candidate-figures {
  color: var(--c-muted);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}

.rpe {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  column-gap: 12px;
}

.rpe-label {
  grid-column: 1 / -1;
}

.rpe input {
  width: 100%;
  height: 8px;
  margin: 0;
  border-radius: 4px;
  background: linear-gradient(to right, var(--c-accent), var(--c-accent-2));
  appearance: none;
  cursor: pointer;
}

.rpe input::-webkit-slider-thumb {
  width: 22px;
  height: 22px;
  border: 3px solid var(--c-text);
  border-radius: 50%;
  background: var(--c-card-bg);
  appearance: none;
}

.rpe input::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border: 3px solid var(--c-text);
  border-radius: 50%;
  background: var(--c-card-bg);
}

.rpe input.unset {
  opacity: 0.45;
}

.rpe output {
  min-width: 9em;
  color: var(--c-text);
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}

.form-buttons {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

.form-buttons .primary-button {
  margin-top: 0;
}

.error {
  margin: 6px 0 0;
  color: var(--c-accent-2);
  font-size: 0.85rem;
}

@media (max-width: 640px) {
  .primary-button,
  .tick-toggle {
    min-height: 44px;
  }
}
</style>
