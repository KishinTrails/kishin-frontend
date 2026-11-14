<script setup lang="ts">
/**
 * BarChart.vue — One series of bars in SVG, such as weekly distance. Each bar carries a
 * `<title>` with its label and value, so hovering shows it; the table twin lists the same
 * values without colour or pointer.
 * Does not own: computing the values (see `utils/weeklyTotals.ts`) or their units.
 */
import { computed, ref } from 'vue';
import { linearScale, niceTicks } from '@/utils/chartScale';

/** One bar: `label` names it on the axis and in the table. */
export interface Bar {
  key: string
  label: string
  value: number
}

const props = defineProps<{
  title: string
  bars: Bar[]
  /** Formats a value for the ticks, the tooltips and the table. */
  format: (value: number) => string
  /** Show the label of every n-th bar under the axis; defaults to 4. */
  labelEvery?: number
}>();

const view = ref<'chart' | 'table'>('chart');

const WIDTH = 640;
const HEIGHT = 180;
const MARGIN = { top: 10, right: 8, bottom: 22, left: 48 };

const ticks = computed(() => niceTicks(0, Math.max(0, ...props.bars.map((bar) => bar.value))));
const y = computed(() => linearScale([0, ticks.value[ticks.value.length - 1] ?? 1], [HEIGHT - MARGIN.bottom, MARGIN.top]));
const slot = computed(() => (WIDTH - MARGIN.left - MARGIN.right) / Math.max(1, props.bars.length));
const every = computed(() => props.labelEvery ?? 4);

const total = computed(() => props.bars.reduce((sum, bar) => sum + bar.value, 0));
</script>

<template>
  <section class="bar-chart">
    <header>
      <h2>{{ title }}</h2>
      <button
        type="button"
        :aria-pressed="view === 'table'"
        @click="view = view === 'chart' ? 'table' : 'chart'"
      >
        {{ view === 'chart' ? 'Table' : 'Chart' }}
      </button>
    </header>

    <svg
      v-if="view === 'chart'"
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      role="img"
      :aria-label="`${title}: ${format(total)} in total over ${bars.length} bars`"
    >
      <g class="ticks">
        <template
          v-for="tick in ticks"
          :key="tick"
        >
          <line
            :x1="MARGIN.left"
            :x2="WIDTH - MARGIN.right"
            :y1="y(tick)"
            :y2="y(tick)"
          />
          <text
            :x="MARGIN.left - 6"
            :y="y(tick)"
            text-anchor="end"
            dominant-baseline="middle"
          >{{ format(tick) }}</text>
        </template>
      </g>
      <g class="bars">
        <rect
          v-for="(bar, index) in bars"
          :key="bar.key"
          :x="MARGIN.left + index * slot + slot * 0.1"
          :y="y(bar.value)"
          :width="slot * 0.8"
          :height="Math.max(0, y(0) - y(bar.value))"
        >
          <title>{{ bar.label }}: {{ format(bar.value) }}</title>
        </rect>
      </g>
      <g class="labels">
        <template
          v-for="(bar, index) in bars"
          :key="bar.key"
        >
          <text
            v-if="index % every === 0"
            :x="MARGIN.left + index * slot"
            :y="HEIGHT - 6"
          >{{ bar.label }}</text>
        </template>
      </g>
    </svg>

    <table
      v-else
      class="table"
    >
      <tbody>
        <tr
          v-for="bar in bars"
          :key="bar.key"
        >
          <th scope="row">
            {{ bar.label }}
          </th>
          <td class="number">
            {{ format(bar.value) }}
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

h2 {
  margin: 0 0 6px;
  font-size: 1rem;
  color: var(--c-text);
}

button {
  padding: 2px 8px;
  background: none;
  color: var(--c-muted);
  border: 1px solid var(--c-border);
  border-radius: 4px;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

svg {
  width: 100%;
  height: auto;
  display: block;
}

.ticks line {
  stroke: var(--c-border);
  stroke-width: 1;
}

text {
  fill: var(--c-muted);
  font-size: 11px;
}

.bars rect {
  fill: var(--c-accent);
}

.bars rect:hover {
  fill: var(--c-accent-2);
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.table th,
.table td {
  padding: 3px 8px;
  border-bottom: 1px solid var(--c-border);
  color: var(--c-text);
  text-align: left;
  font-weight: normal;
}

.table .number {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
