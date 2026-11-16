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
      running: { run_count: 2, run_km: 18, run_moving_sec: 6000, longest_run_km: 12 },
      trainings: [training(1, 'EXPLORATORY_LONG_RUN', true, 12), training(2, 'YOGA', false)],
    },
    {
      week_number: 2, phase: 'PEAK', start: '2026-01-12', end: '2026-01-18',
      running: { run_count: 0, run_km: 0, run_moving_sec: 0, longest_run_km: null },
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
    expect(wrapper.find('h2').text()).toBe('Week 2 · Peak');
    expect(wrapper.find('.week-nav .dates').text()).toBe('12–18 Jan');
    expect(wrapper.findAll('.card-stub').map((card) => card.text())).toEqual(['EXPLORATORY_LONG_RUN', 'YOGA']);
    expect(wrapper.find('.overall-count').text()).toBe('2/4 done');
    expect(wrapper.findAll('.progress-ring figcaption').map((ring) => ring.text())).toEqual(['Long run', 'Yoga']);
    expect(wrapper.find('.line-chart').exists()).toBe(true);
    expect(wrapper.findAll('.week-timeline .week-row')).toHaveLength(2);
  });

  it('moves between weeks with the arrows, and back to this week', async () => {
    mocked.fetchPlan.mockResolvedValue(plan(2));
    const wrapper = mount(PlanPage, { global: { stubs } });
    await flushPromises();
    const [previous, next] = wrapper.findAll('.nav-arrow');
    expect(next!.attributes('disabled')).toBeDefined();
    await previous!.trigger('click');
    expect(wrapper.find('h2').text()).toBe('Week 1 · Base');
    expect(previous!.attributes('disabled')).toBeDefined();
    await wrapper.find('.today-button').trigger('click');
    expect(wrapper.find('h2').text()).toBe('Week 2 · Peak');
  });

  it('changes the week with a horizontal swipe, not a vertical one', async () => {
    mocked.fetchPlan.mockResolvedValue(plan(2));
    const wrapper = mount(PlanPage, { global: { stubs } });
    await flushPromises();
    const card = wrapper.find('.week-card');
    const swipe = async (dx: number, dy: number) => {
      await card.trigger('touchstart', { changedTouches: [{ clientX: 200, clientY: 200 }] });
      await card.trigger('touchend', { changedTouches: [{ clientX: 200 + dx, clientY: 200 + dy }] });
    };
    await swipe(30, 120);
    expect(wrapper.find('h2').text()).toBe('Week 2 · Peak');
    await swipe(100, 10);
    expect(wrapper.find('h2').text()).toBe('Week 1 · Base');
    await swipe(-100, 10);
    expect(wrapper.find('h2').text()).toBe('Week 2 · Peak');
  });

  it('says what is left today in the current week', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 0, 16, 12));
    try {
      mocked.fetchPlan.mockResolvedValue(plan(2));
      const wrapper = mount(PlanPage, { global: { stubs } });
      await flushPromises();
      expect(wrapper.find('.today-line').text()).toBe('Today, Fri 16 Jan · 3 days left: Long run');
    } finally {
      vi.useRealTimers();
    }
  });

  it('switches the chart between distance, time and longest run', async () => {
    mocked.fetchPlan.mockResolvedValue(plan(2));
    const wrapper = mount(PlanPage, { global: { stubs } });
    await flushPromises();
    const tabs = wrapper.findAll('[role="tab"]');
    expect(tabs.map((tab) => tab.text())).toEqual(['Distance', 'Time', 'Longest run']);
    expect(wrapper.find('.line-chart').text()).toContain('Running distance per week');
    await tabs[1]!.trigger('click');
    expect(wrapper.find('.line-chart').text()).toContain('Running moving time per week');
    expect(tabs[1]!.attributes('aria-selected')).toBe('true');
    await tabs[2]!.trigger('click');
    expect(wrapper.find('.line-chart').text()).toContain('Longest run per week');
  });

  it('opens another week from the timeline', async () => {
    mocked.fetchPlan.mockResolvedValue(plan(2));
    const wrapper = mount(PlanPage, { global: { stubs } });
    await flushPromises();
    await wrapper.findAll('.week-timeline .week-row')[0]!.trigger('click');
    expect(wrapper.find('h2').text()).toBe('Week 1 · Base');
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
