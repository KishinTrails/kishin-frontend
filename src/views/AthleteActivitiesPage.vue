<template>
  <AppShell
    title="Activities"
    section="athlete"
    refreshable
    @refresh="(done) => reload().finally(done)"
  >
    <template #subnav>
      <AthleteTabs active="activities" />
    </template>

    <section class="card">
      <p
        v-if="activities.error"
        class="error"
      >
        {{ activities.error }}
      </p>
      <SkeletonBlock
        v-else-if="activities.loading && !activities.rows.length"
        :lines="8"
      />
      <ActivityList
        v-else
        :activities="activities.rows"
        :has-more="activities.hasMore"
        :loading="activities.loading"
        @load-more="loadActivities"
      />
    </section>
  </AppShell>
</template>

<script setup lang="ts">
/**
 * AthleteActivitiesPage.vue — The Activities tab of the athlete pages (`/athlete/activities`):
 * the Garmin activities, newest first, loaded `PAGE_SIZE` at a time. Pulling down reloads the
 * first page.
 * Does not own: the activity detail (`ActivityPage.vue`) or any write to the data.
 */
import { onMounted, reactive } from 'vue';
import AppShell from '@/components/AppShell.vue';
import ActivityList from '@/components/athlete/ActivityList.vue';
import AthleteTabs from '@/components/athlete/AthleteTabs.vue';
import SkeletonBlock from '@/components/SkeletonBlock.vue';
import { athleteErrorText, fetchActivities, type ActivitySummary } from '@/services/athleteService';

const PAGE_SIZE = 20;

const activities = reactive({ rows: [] as ActivitySummary[], loading: true, hasMore: true, error: '' });

/** Loads the next page of activities. */
async function loadActivities(): Promise<void> {
  activities.loading = true;
  try {
    const page = await fetchActivities({ limit: PAGE_SIZE, offset: activities.rows.length });
    activities.rows.push(...page);
    activities.hasMore = page.length === PAGE_SIZE;
  } catch (error) {
    activities.error = athleteErrorText(error);
  } finally {
    activities.loading = false;
  }
}

/** Starts again from the newest activity. */
async function reload(): Promise<void> {
  activities.rows = [];
  activities.hasMore = true;
  activities.error = '';
  await loadActivities();
}

onMounted(loadActivities);
</script>
