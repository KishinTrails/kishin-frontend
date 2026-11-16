<script setup lang="ts">
/**
 * AppShell.vue — The frame of every page except the map and the login: a top bar with the logo,
 * the page tabs (Map, Athlete, Plan) and a logout link, an optional breadcrumb under it, and the
 * page's content. Below 640px wide the tabs move to a bar at the bottom of the screen and the top
 * bar shows the page title. Sets `.app-page` and the theme class of the map style on its root,
 * so the tokens of `theme/pages.css` apply to the page.
 * Slots: default (the page, inside `.page`), `subnav` (a row under the top bar, for sub-tabs).
 * With `refreshable`, pulling the content down on a touch screen emits `refresh` with a function
 * the page calls once its data is loaded again, which hides the spinner.
 * Does not own: loading data, or the map page's own panel.
 */
import {
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  type RefresherCustomEvent,
} from '@ionic/vue';
import { calendarOutline, logOutOutline, mapOutline, walkOutline } from 'ionicons/icons';
import '@/theme/pages.css';
import { loadMapStyle, styleToThemeClass } from '@/services/mapStyleService';

/** The sections a page can belong to; the matching tab is highlighted. */
export type Section = 'map' | 'athlete' | 'plan';

/** One step of the breadcrumb; the last one has no link. */
export interface Crumb {
  label: string
  to?: string
}

defineProps<{
  /** The page's name, shown in the top bar on a phone. */
  title: string
  /** The tab to highlight. */
  section: Section
  /** Where the page sits under its section; no breadcrumb when absent. */
  crumbs?: Crumb[]
  /** Whether pulling the content down reloads the page's data. */
  refreshable?: boolean
}>();

const emit = defineEmits<{
  (event: 'refresh', done: () => void): void
}>();

/**
 * Passes a pull to refresh to the page.
 *
 * @param event - The `ionRefresh` event; its target is the refresher to complete
 */
function onRefresh(event: RefresherCustomEvent): void {
  const refresher = event.target;
  emit('refresh', () => void refresher.complete());
}

const TABS: { section: Section, label: string, to: string, icon: string }[] = [
  { section: 'map', label: 'Map', to: '/map', icon: mapOutline },
  { section: 'athlete', label: 'Athlete', to: '/athlete', icon: walkOutline },
  { section: 'plan', label: 'Plan', to: '/plan', icon: calendarOutline },
];

const theme = styleToThemeClass(loadMapStyle());
</script>

<template>
  <ion-page
    class="app-page"
    :class="theme"
  >
    <ion-header class="ion-no-border">
      <nav
        class="app-bar"
        aria-label="Pages"
      >
        <router-link
          to="/map"
          class="brand"
        >
          <img
            src="/logo-128.png"
            alt=""
            width="36"
            height="36"
          >
          <span class="brand-name">Kishin Trails</span>
        </router-link>
        <span class="page-title">{{ title }}</span>
        <div class="tabs">
          <router-link
            v-for="tab in TABS"
            :key="tab.section"
            :to="tab.to"
            class="tab"
            :class="{ active: tab.section === section }"
            :aria-current="tab.section === section ? 'page' : undefined"
          >
            {{ tab.label }}
          </router-link>
        </div>
        <router-link
          to="/logout"
          class="logout"
          aria-label="Log out"
          title="Log out"
        >
          <ion-icon
            :icon="logOutOutline"
            aria-hidden="true"
          />
        </router-link>
      </nav>
      <slot name="subnav" />
      <nav
        v-if="crumbs && crumbs.length"
        class="crumbs"
        aria-label="Breadcrumb"
      >
        <template
          v-for="(crumb, index) in crumbs"
          :key="index"
        >
          <span
            v-if="index > 0"
            class="separator"
            aria-hidden="true"
          >›</span>
          <router-link
            v-if="crumb.to"
            :to="crumb.to"
          >
            {{ crumb.label }}
          </router-link>
          <span
            v-else
            aria-current="page"
          >{{ crumb.label }}</span>
        </template>
      </nav>
    </ion-header>

    <ion-content>
      <ion-refresher
        v-if="refreshable"
        slot="fixed"
        @ion-refresh="onRefresh"
      >
        <ion-refresher-content />
      </ion-refresher>
      <div class="page">
        <slot />
      </div>
    </ion-content>

    <ion-footer class="ion-no-border bottom-tabs">
      <nav aria-label="Pages">
        <router-link
          v-for="tab in TABS"
          :key="tab.section"
          :to="tab.to"
          class="bottom-tab"
          :class="{ active: tab.section === section }"
          :aria-current="tab.section === section ? 'page' : undefined"
        >
          <ion-icon
            :icon="tab.icon"
            aria-hidden="true"
          />
          <span>{{ tab.label }}</span>
        </router-link>
      </nav>
    </ion-footer>
  </ion-page>
</template>

<style scoped>
.app-bar {
  display: flex;
  align-items: center;
  gap: 24px;
  height: 56px;
  padding: 0 16px;
  padding-top: env(safe-area-inset-top);
  box-sizing: content-box;
  background: var(--c-bar-bg);
  border-bottom: 1px solid var(--c-bar-border);
  color: var(--c-bar-text);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--c-bar-text);
  text-decoration: none;
}

.brand-name {
  font-size: 1.2rem;
  font-weight: 700;
  white-space: nowrap;
}

.page-title {
  display: none;
  flex: 1;
  overflow: hidden;
  font-size: 1.1rem;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.tabs {
  display: flex;
  flex: 1;
  align-self: stretch;
  gap: 4px;
}

.tab {
  display: flex;
  align-items: center;
  padding: 0 14px;
  border-bottom: 3px solid transparent;
  border-top: 3px solid transparent;
  color: var(--c-bar-muted);
  font-weight: 500;
  text-decoration: none;
  transition: color 0.15s, border-color 0.15s;
}

.tab:hover {
  color: var(--c-bar-text);
}

.tab.active {
  border-bottom-color: var(--c-bar-active);
  color: var(--c-bar-text);
}

.logout {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: var(--c-bar-muted);
  font-size: 1.4rem;
}

.logout:hover {
  color: var(--c-bar-text);
  background: color-mix(in srgb, var(--c-bar-text) 10%, transparent);
}

.crumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  padding: 8px 16px;
  background: var(--c-page-bg);
  color: var(--c-bar-muted);
  font-size: 0.9rem;
}

.theme-standard .crumbs {
  color: var(--c-muted);
}

.crumbs a {
  color: var(--c-bar-active);
  text-decoration: none;
}

.crumbs a:hover {
  text-decoration: underline;
}

.crumbs [aria-current] {
  overflow: hidden;
  color: var(--c-bar-text);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.theme-standard .crumbs [aria-current] {
  color: var(--c-text);
}

.bottom-tabs {
  display: none;
}

.bottom-tabs nav {
  display: flex;
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--c-bar-bg);
  border-top: 1px solid var(--c-bar-border);
}

.bottom-tab {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 0 6px;
  border-top: 3px solid transparent;
  color: var(--c-bar-muted);
  font-size: 0.75rem;
  text-decoration: none;
}

.bottom-tab ion-icon {
  font-size: 1.4rem;
}

.bottom-tab.active {
  border-top-color: var(--c-bar-active);
  color: var(--c-bar-text);
}

@media (max-width: 640px) {
  .app-bar {
    gap: 12px;
  }

  .brand-name,
  .tabs {
    display: none;
  }

  .page-title {
    display: block;
  }

  .bottom-tabs {
    display: block;
  }
}
</style>
