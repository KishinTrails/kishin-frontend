<script setup lang="ts">
/**
 * AthleteTabs.vue — The row of sub-tabs under the top bar on the athlete pages: Overview
 * (`/athlete`), Body (`/athlete/body`) and Activities (`/athlete/activities`). The active one is
 * underlined. Placed in AppShell's `subnav` slot.
 * Does not own: the pages' data.
 */

/** The athlete sub-pages. */
export type AthleteTab = 'overview' | 'body' | 'activities';

defineProps<{
  active: AthleteTab
}>();

const TABS: { tab: AthleteTab, label: string, to: string }[] = [
  { tab: 'overview', label: 'Overview', to: '/athlete' },
  { tab: 'body', label: 'Body', to: '/athlete/body' },
  { tab: 'activities', label: 'Activities', to: '/athlete/activities' },
];
</script>

<template>
  <nav
    class="athlete-tabs"
    aria-label="Athlete"
  >
    <router-link
      v-for="item in TABS"
      :key="item.tab"
      :to="item.to"
      class="athlete-tab"
      :class="{ active: item.tab === active }"
      :aria-current="item.tab === active ? 'page' : undefined"
    >
      {{ item.label }}
    </router-link>
  </nav>
</template>

<style scoped>
.athlete-tabs {
  display: flex;
  justify-content: center;
  gap: 4px;
  padding: 0 16px;
  overflow-x: auto;
  background: var(--c-bar-bg);
  border-bottom: 1px solid var(--c-bar-border);
}

.athlete-tab {
  padding: 10px 14px 8px;
  border-bottom: 3px solid transparent;
  color: var(--c-bar-muted);
  font-size: 0.9rem;
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
}

.athlete-tab:hover {
  color: var(--c-bar-text);
}

.athlete-tab.active {
  border-bottom-color: var(--c-bar-active);
  color: var(--c-bar-text);
}
</style>
