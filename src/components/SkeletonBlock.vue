<script setup lang="ts">
/**
 * SkeletonBlock.vue — A grey placeholder shaped like the content that is loading, with a slow
 * shimmer (none when the system asks for reduced motion). `lines` draws that many text lines
 * instead of one block. Announced to screen readers as "Loading".
 * Does not own: deciding when data is loading.
 */
withDefaults(defineProps<{
  /** Height of the block, CSS length; ignored with `lines`. */
  height?: string
  /** Draw this many text lines, the last one shorter. */
  lines?: number
}>(), {
  height: '120px',
  lines: 0,
});
</script>

<template>
  <div
    class="skeleton"
    role="status"
    aria-label="Loading"
  >
    <template v-if="lines">
      <span
        v-for="line in lines"
        :key="line"
        class="bone line"
        :style="{ width: line === lines && lines > 1 ? '60%' : '100%' }"
      />
    </template>
    <span
      v-else
      class="bone"
      :style="{ height }"
    />
  </div>
</template>

<style scoped>
.skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bone {
  display: block;
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    var(--c-empty) 0%,
    color-mix(in srgb, var(--c-empty) 55%, var(--c-card-bg)) 50%,
    var(--c-empty) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

.line {
  height: 0.9em;
}

@keyframes shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .bone {
    animation: none;
  }
}
</style>
