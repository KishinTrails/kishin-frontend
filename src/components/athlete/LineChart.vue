<script setup lang="ts">
/**
 * LineChart.vue — One or two series against a shared x axis, in SVG. A null value breaks the
 * line. The second series can be dashed, for a moving average. Moving the pointer over the
 * chart shows the values at the nearest x. `invert` puts small values at the top, for paces.
 * Does not own: choosing the x axis (distance, time or days) or converting units.
 */
import { computed, ref } from 'vue';
import { extent, linearScale, niceTicks } from '@/utils/chartScale';

/** One series; `values` has one entry per x. */
export interface Series {
  name: string
  values: (number | null)[]
  dashed?: boolean
}

const props = defineProps<{
  title: string
  x: (number | null)[]
  series: Series[]
  formatX: (value: number) => string
  formatY: (value: number) => string
  invert?: boolean
}>();

const WIDTH = 640;
const HEIGHT = 200;
const MARGIN = { top: 10, right: 10, bottom: 24, left: 56 };

const xExtent = computed(() => extent(props.x));
const yValues = computed(() => props.series.flatMap((series) => series.values));
const yExtent = computed(() => extent(yValues.value));
const hasData = computed(() => xExtent.value !== null && yExtent.value !== null);

const yTicks = computed(() => (yExtent.value ? niceTicks(yExtent.value[0], yExtent.value[1]) : []));
const xTicks = computed(() => (xExtent.value ? niceTicks(xExtent.value[0], xExtent.value[1], 5) : []));

const xScale = computed(() => {
  const domain = xExtent.value ?? [0, 1];
  return linearScale(domain, [MARGIN.left, WIDTH - MARGIN.right]);
});
const yScale = computed(() => {
  const domain: [number, number] = yTicks.value.length
    ? [yTicks.value[0]!, yTicks.value[yTicks.value.length - 1]!]
    : [0, 1];
  const range: [number, number] = props.invert
    ? [MARGIN.top, HEIGHT - MARGIN.bottom]
    : [HEIGHT - MARGIN.bottom, MARGIN.top];
  return linearScale(domain, range);
});

/** The x ticks that fall inside the data, so labels do not sit outside the plot. */
const visibleXTicks = computed(() =>
  xTicks.value.filter((tick) => xExtent.value && tick >= xExtent.value[0] && tick <= xExtent.value[1]),
);

/**
 * SVG path of one series: `M` at the start of each run of values, `L` inside it.
 *
 * @param values - One value per x
 * @returns The `d` attribute
 */
const path = (values: (number | null)[]): string => {
  let d = '';
  let drawing = false;
  values.forEach((value, index) => {
    const xValue = props.x[index];
    if (value === null || value === undefined || xValue === null || xValue === undefined) {
      drawing = false;
      return;
    }
    d += `${drawing ? 'L' : 'M'}${xScale.value(xValue).toFixed(1)},${yScale.value(value).toFixed(1)}`;
    drawing = true;
  });
  return d;
};

const paths = computed(() => props.series.map((series) => ({ ...series, d: path(series.values) })));

const svg = ref<SVGSVGElement | null>(null);
const hoverIndex = ref<number | null>(null);

const onPointerMove = (event: PointerEvent) => {
  if (!svg.value || !xExtent.value) return;
  const box = svg.value.getBoundingClientRect();
  if (box.width === 0) return;
  const svgX = ((event.clientX - box.left) / box.width) * WIDTH;
  let best: number | null = null;
  let bestDistance = Infinity;
  props.x.forEach((xValue, index) => {
    if (xValue === null || xValue === undefined) return;
    const distance = Math.abs(xScale.value(xValue) - svgX);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  hoverIndex.value = best;
};

const hover = computed(() => {
  const index = hoverIndex.value;
  if (index === null) return null;
  const xValue = props.x[index];
  if (xValue === null || xValue === undefined) return null;
  return {
    left: xScale.value(xValue),
    x: props.formatX(xValue),
    values: props.series.map((series) => {
      const value = series.values[index];
      return { name: series.name, text: value === null || value === undefined ? '–' : props.formatY(value) };
    }),
  };
});

const spoken = computed(() => {
  if (!yExtent.value) return `${props.title}: no data`;
  return `${props.title}: from ${props.formatY(yExtent.value[0])} to ${props.formatY(yExtent.value[1])}`;
});
</script>

<template>
  <section class="line-chart">
    <h2>{{ title }}</h2>
    <p
      v-if="!hasData"
      class="empty"
    >
      No data.
    </p>
    <div
      v-else
      class="stage"
    >
      <svg
        ref="svg"
        :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
        role="img"
        :aria-label="spoken"
        @pointermove="onPointerMove"
        @pointerleave="hoverIndex = null"
      >
        <g class="ticks">
          <template
            v-for="tick in yTicks"
            :key="`y${tick}`"
          >
            <line
              :x1="MARGIN.left"
              :x2="WIDTH - MARGIN.right"
              :y1="yScale(tick)"
              :y2="yScale(tick)"
            />
            <text
              :x="MARGIN.left - 6"
              :y="yScale(tick)"
              text-anchor="end"
              dominant-baseline="middle"
            >{{ formatY(tick) }}</text>
          </template>
          <text
            v-for="tick in visibleXTicks"
            :key="`x${tick}`"
            :x="xScale(tick)"
            :y="HEIGHT - 6"
            text-anchor="middle"
          >{{ formatX(tick) }}</text>
        </g>
        <path
          v-for="(item, index) in paths"
          :key="item.name"
          :d="item.d"
          class="line"
          :class="[`series-${index}`, { dashed: item.dashed }]"
        />
        <line
          v-if="hover"
          class="cursor"
          :x1="hover.left"
          :x2="hover.left"
          :y1="MARGIN.top"
          :y2="HEIGHT - MARGIN.bottom"
        />
      </svg>
      <p
        class="readout"
        aria-live="polite"
      >
        <template v-if="hover">
          <span>{{ hover.x }}</span>
          <span
            v-for="(value, index) in hover.values"
            :key="value.name"
            :class="`series-${index}`"
          >{{ value.name }}: {{ value.text }}</span>
        </template>
        <template v-else>
          <span
            v-for="(item, index) in series"
            :key="item.name"
            :class="`series-${index}`"
          >{{ item.name }}</span>
        </template>
      </p>
    </div>
  </section>
</template>

<style scoped>
h2 {
  margin: 0 0 6px;
  font-size: 1rem;
  color: var(--c-text);
}

svg {
  width: 100%;
  height: auto;
  display: block;
  touch-action: pan-y;
}

.ticks line {
  stroke: var(--c-border);
  stroke-width: 1;
}

text {
  fill: var(--c-muted);
  font-size: 11px;
}

.line {
  fill: none;
  stroke-width: 1.5;
  stroke-linejoin: round;
}

.line.series-0 {
  stroke: var(--c-accent);
}

.line.series-1 {
  stroke: var(--c-accent-2);
}

.line.dashed {
  stroke-dasharray: 5 3;
}

.cursor {
  stroke: var(--c-muted);
  stroke-width: 1;
}

.readout {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 4px 0 0;
  font-size: 0.85rem;
  color: var(--c-muted);
  min-height: 1.2em;
}

.readout .series-0 {
  color: var(--c-accent);
}

.readout .series-1 {
  color: var(--c-accent-2);
}

.empty {
  color: var(--c-muted);
}
</style>
