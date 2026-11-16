<script setup lang="ts">
/**
 * ProgressRing.vue — One done/planned count drawn as a ring filled in proportion, with n/m in
 * its centre and the label under it. A full ring uses the accent colour.
 * Does not own: computing the counts (see `completionCounts` in `utils/planProgress.ts`).
 */
import { computed } from 'vue';

const props = defineProps<{
  label: string
  done: number
  planned: number
}>();

const RADIUS = 15;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const fraction = computed(() => (props.planned > 0 ? Math.min(props.done / props.planned, 1) : 0));
</script>

<template>
  <figure
    class="progress-ring"
    :class="{ full: fraction === 1 }"
  >
    <svg
      viewBox="0 0 40 40"
      width="56"
      height="56"
      role="img"
      :aria-label="`${label}: ${done} of ${planned} done`"
    >
      <circle
        class="track"
        cx="20"
        cy="20"
        :r="RADIUS"
      />
      <circle
        v-if="fraction > 0"
        class="value"
        cx="20"
        cy="20"
        :r="RADIUS"
        :stroke-dasharray="CIRCUMFERENCE"
        :stroke-dashoffset="CIRCUMFERENCE * (1 - fraction)"
      />
      <text
        x="20"
        y="20"
        dominant-baseline="central"
        text-anchor="middle"
      >{{ done }}/{{ planned }}</text>
    </svg>
    <figcaption>{{ label }}</figcaption>
  </figure>
</template>

<style scoped>
.progress-ring {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 76px;
  margin: 0;
}

circle {
  fill: none;
  stroke-width: 4;
}

.track {
  stroke: var(--c-empty);
}

.value {
  stroke: color-mix(in srgb, var(--c-accent) 70%, var(--c-muted));
  stroke-linecap: round;
  transform: rotate(-90deg);
  transform-origin: center;
  transition: stroke-dashoffset 0.4s ease;
}

.full .value {
  stroke: var(--c-accent);
}

text {
  fill: var(--c-text);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
}

figcaption {
  color: var(--c-muted);
  font-size: 0.75rem;
  line-height: 1.2;
  text-align: center;
}
</style>
