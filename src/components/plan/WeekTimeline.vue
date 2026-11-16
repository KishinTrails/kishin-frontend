<script setup lang="ts">
/**
 * WeekTimeline.vue — Every week of the plan as one clickable row: number, Monday's date, phase
 * (a tag coloured per phase), long-run target, a progress bar of the done trainings and n/m.
 * The current week and the selected week (the one the page shows in detail) are highlighted. A
 * past week with trainings not done has its bar and count in a muted warning colour.
 * Choosing a row emits `select`.
 * Does not own: completing trainings (see `TrainingCard.vue`).
 */
import type { PlanWeek } from '@/services/planService';
import { longDate } from '@/utils/activityGrid';
import { longRunTarget, phaseLabel } from '@/utils/planProgress';

defineProps<{
  weeks: PlanWeek[]
  currentWeek: number
  selectedWeek: number
  /** ISO day; weeks ending before it are past. */
  today: string
}>();

defineEmits<{
  (event: 'select', weekNumber: number): void
}>();

/** Phase names with a colour of their own; any other phase gets the neutral tag. */
const PHASES = new Set(['BASE', 'BUILD', 'PEAK', 'TAPER', 'RECOVERY', 'RACE']);

/**
 * `5 Jan` for a week's Monday.
 *
 * @param day - ISO day string
 * @returns Day and month
 */
const shortDate = (day: string): string => longDate(day).split(' ').slice(1, 3).join(' ');

/**
 * The CSS class of a phase's tag.
 *
 * @param phase - The phase
 * @returns `phase-base`, or `phase-other` for a phase without a colour of its own
 */
const phaseClass = (phase: string): string => (PHASES.has(phase) ? `phase-${phase.toLowerCase()}` : 'phase-other');

/**
 * The done count of a week.
 *
 * @param week - The week
 * @returns Trainings done
 */
const doneCount = (week: PlanWeek): number => week.trainings.filter((training) => training.completion).length;
</script>

<template>
  <section class="week-timeline">
    <h2>Weeks</h2>
    <ol>
      <li
        v-for="week in weeks"
        :key="week.week_number"
      >
        <button
          type="button"
          class="week-row"
          :class="{
            current: week.week_number === currentWeek,
            selected: week.week_number === selectedWeek,
            missed: week.end < today && doneCount(week) < week.trainings.length,
          }"
          :aria-pressed="week.week_number === selectedWeek"
          @click="$emit('select', week.week_number)"
        >
          <span class="number">{{ week.week_number }}</span>
          <span class="date">{{ shortDate(week.start) }}</span>
          <span
            class="phase"
            :class="phaseClass(week.phase)"
          >{{ phaseLabel(week.phase) }}</span>
          <span class="long-run">{{ longRunTarget(week) === null ? '–' : `${longRunTarget(week)} km` }}</span>
          <span
            class="bar"
            aria-hidden="true"
          >
            <span
              class="bar-fill"
              :style="{ width: week.trainings.length ? `${(100 * doneCount(week)) / week.trainings.length}%` : '0' }"
            />
          </span>
          <span class="count">{{ doneCount(week) }}/{{ week.trainings.length }}</span>
        </button>
      </li>
    </ol>
  </section>
</template>

<style scoped>
h2 {
  margin: 0 0 6px;
  font-size: 1rem;
  color: var(--c-text);
}

ol {
  margin: 0;
  padding: 0;
  list-style: none;
}

.week-row {
  display: grid;
  grid-template-columns: 2.6em 4.2em 6.5em 4em 1fr 2.8em;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-bottom-color: var(--c-border);
  border-radius: 0;
  background: none;
  color: var(--c-text);
  font: inherit;
  font-size: 0.9rem;
  text-align: left;
  cursor: pointer;
}

.week-row:hover {
  background: color-mix(in srgb, var(--c-accent) 6%, transparent);
}

.week-row.current {
  background: color-mix(in srgb, var(--c-accent) 12%, transparent);
}

.week-row.selected {
  border-color: var(--c-accent);
  border-radius: 6px;
}

.number {
  font-weight: 700;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.current .number::before {
  content: '▸ ';
  color: var(--c-accent);
}

.date,
.long-run {
  color: var(--c-muted);
  font-variant-numeric: tabular-nums;
}

.long-run {
  text-align: right;
}

.phase {
  --phase: var(--c-muted);
  justify-self: start;
  padding: 1px 8px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--phase) 18%, transparent);
  color: color-mix(in srgb, var(--phase) 80%, var(--c-text));
  font-size: 0.75rem;
  font-weight: 600;
}

.phase-base { --phase: #4A7A5A; }
.phase-build { --phase: #4A6B8A; }
.phase-peak { --phase: #8B3A1E; }
.phase-taper { --phase: #8B6914; }
.phase-recovery { --phase: #6B5A8A; }
.phase-race { --phase: #B5442C; }

.bar {
  height: 6px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--c-empty);
}

.bar-fill {
  display: block;
  height: 100%;
  border-radius: 3px;
  background: var(--c-accent);
  transition: width 0.3s ease;
}

.count {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.missed .bar-fill {
  background: color-mix(in srgb, var(--c-accent-2) 60%, var(--c-muted));
}

.missed .count {
  color: color-mix(in srgb, var(--c-accent-2) 70%, var(--c-muted));
}

@media (max-width: 640px) {
  .week-row {
    grid-template-columns: 2.6em 4em 5.5em 1fr 2.8em;
    gap: 8px;
  }

  .long-run {
    display: none;
  }
}
</style>
