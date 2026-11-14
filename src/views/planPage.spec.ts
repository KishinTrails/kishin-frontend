import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/planService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/planService')>();
  return { ...original, fetchPlan: vi.fn() };
});

vi.mock('@/services/mapStyleService', () => ({
  loadMapStyle: () => 'standard',
  styleToThemeClass: () => 'theme-standard',
}));

import * as service from '@/services/planService';
import type { PlanProgress, PlanTraining } from '@/services/planService';
import PlanPage from './PlanPage.vue';

const mocked = vi.mocked(service);

const stubs = {
  IonPage: { template: '<div><slot /></div>' },
  IonContent: { template: '<div><slot /></div>' },
  'router-link': RouterLinkStub,
  TrainingCard: { template: '<div class="card-stub">{{ training.type }}</div>', props: ['training'] },
};

const training = (id: number, type: string, done: boolean, km: number | null = null): PlanTraining => ({
  id, position: id, type, is_tick: type === 'YOGA', target_distance_km: km, target_duration_sec: null, segments: [],
  completion: done ? { completed_at: '2026-01-05T18:00:00', rpe: null, activity: null } : null,
});

const plan = (current_week: number): PlanProgress => ({
  plan_id: 1, name: 'Example Plan', goal_type: null, target_fat_ratio: null, target_muscle_mass_kg: null,
  start_date: '2026-01-05', current_week, week_count: 2, health_available: true,
  weeks: [
    {
      week_number: 1, phase: 'BASE', start: '2026-01-05', end: '2026-01-11',
      running: { run_count: 2, run_km: 18, longest_run_km: 12 },
      trainings: [training(1, 'EXPLORATORY_LONG_RUN', true, 12), training(2, 'YOGA', false)],
    },
    {
      week_number: 2, phase: 'PEAK', start: '2026-01-12', end: '2026-01-18',
      running: { run_count: 0, run_km: 0, longest_run_km: null },
      trainings: [training(3, 'EXPLORATORY_LONG_RUN', false, 15), training(4, 'YOGA', true)],
    },
  ],
});

describe('PlanPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the current week, the counts, the chart and the timeline', async () => {
    mocked.fetchPlan.mockResolvedValue(plan(2));
    const wrapper = mount(PlanPage, { global: { stubs } });
    await flushPromises();
    expect(wrapper.find('h1').text()).toBe('Example Plan');
    expect(wrapper.find('.subtitle').text()).toContain('Week 2 of 2');
    expect(wrapper.find('h2').text()).toContain('Week 2 · PEAK');
    expect(wrapper.findAll('.card-stub').map((card) => card.text())).toEqual(['EXPLORATORY_LONG_RUN', 'YOGA']);
    expect(wrapper.find('.stats').text()).toContain('All trainings2/4');
    expect(wrapper.find('.line-chart').exists()).toBe(true);
    expect(wrapper.findAll('.week-timeline tbody tr')).toHaveLength(2);
  });

  it('opens another week from the timeline', async () => {
    mocked.fetchPlan.mockResolvedValue(plan(2));
    const wrapper = mount(PlanPage, { global: { stubs } });
    await flushPromises();
    await wrapper.findAll('.week-timeline tbody button')[0]!.trigger('click');
    expect(wrapper.find('h2').text()).toContain('Week 1 · BASE');
  });

  it('selects week 1 before the plan starts', async () => {
    mocked.fetchPlan.mockResolvedValue(plan(-1));
    const wrapper = mount(PlanPage, { global: { stubs } });
    await flushPromises();
    expect(wrapper.find('.subtitle').text()).toContain('Starts in 2 week(s)');
    expect(wrapper.find('h2').text()).toContain('Week 1');
  });

  it('explains how to import a plan when there is none', async () => {
    mocked.fetchPlan.mockRejectedValue(new service.PlanApiError(404, 'No active plan.'));
    const wrapper = mount(PlanPage, { global: { stubs } });
    await flushPromises();
    expect(wrapper.text()).toContain('kishin plan import');
  });
});
