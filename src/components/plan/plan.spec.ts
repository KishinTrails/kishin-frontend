import { flushPromises, mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/planService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/planService')>();
  return { ...original, fetchCandidates: vi.fn(), completeTraining: vi.fn(), uncompleteTraining: vi.fn() };
});

vi.mock('@/services/feedbackService', () => ({ notify: vi.fn() }));

import * as service from '@/services/planService';
import * as feedback from '@/services/feedbackService';
import type { PlanTraining, PlanWeek } from '@/services/planService';
import TrainingCard from './TrainingCard.vue';
import WeekTimeline from './WeekTimeline.vue';

const mocked = vi.mocked(service);
const notified = vi.mocked(feedback.notify);

const run = (done = false): PlanTraining => ({
  id: 1, position: 1, type: 'EXPLORATORY_LONG_RUN', is_tick: false, target_distance_km: 13, target_duration_sec: null,
  segments: [{ position: 1, type: 'EASY', duration_sec: null, distance_km: 13, rpe_min: 3, rpe_max: 5, pace_min_km: null }],
  completion: done
    ? {
      completed_at: '2026-01-05T18:00:00', rpe: 4,
      activity: { activity_id: '1002', name: 'Example Long Run', start_time: '2026-01-04T09:00:00', distance_km: 14, moving_sec: 5700 },
    }
    : null,
});

const tick = (done = false): PlanTraining => ({
  id: 3, position: 3, type: 'LEG_DAY', is_tick: true, target_distance_km: null, target_duration_sec: null,
  segments: [], completion: done ? { completed_at: '2026-01-05T18:00:00', rpe: null, activity: null } : null,
});

const candidate = {
  activity_id: '1002', name: 'Example Long Run', sport: 'running', sub_sport: 'generic', start_time: '2026-01-04T09:00:00',
  stop_time: null, elapsed_sec: 6000, moving_sec: 5700, distance_km: 14, ascent_m: 300, descent_m: null, avg_hr: 140,
  max_hr: null, calories: null, avg_speed_kmh: 8.8, training_effect: null, anaerobic_training_effect: null,
};

describe('TrainingCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a run target', () => {
    const wrapper = mount(TrainingCard, { props: { training: run() } });
    expect(wrapper.find('.name').text()).toBe('Long run');
    expect(wrapper.find('.target').text()).toBe('13 km · RPE 3–5');
  });

  it('completes a run with a candidate and an RPE', async () => {
    mocked.fetchCandidates.mockResolvedValue([candidate]);
    mocked.completeTraining.mockResolvedValue(run(true));
    const wrapper = mount(TrainingCard, { props: { training: run() } });
    await wrapper.find('.primary-button').trigger('click');
    await flushPromises();
    expect(wrapper.classes()).toContain('open');
    const choice = wrapper.find('.candidate');
    expect(choice.find('.candidate-title').text()).toContain('Example Long Run');
    expect(choice.find('.candidate-figures').text()).toBe('14.00 km · 1:35:00');
    await choice.find('input[type=radio]').setValue();
    expect(choice.classes()).toContain('selected');
    await wrapper.find('input[type=range]').setValue('4');
    expect(wrapper.find('output').text()).toBe('RPE 4 · easy');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(mocked.completeTraining).toHaveBeenCalledWith(1, { activity_id: '1002', rpe: 4 });
    expect(wrapper.emitted('changed')).toHaveLength(1);
    expect(notified).toHaveBeenCalledWith('Long run done.');
  });

  it('keeps Save disabled until the RPE slider is moved', async () => {
    mocked.fetchCandidates.mockResolvedValue([candidate]);
    const wrapper = mount(TrainingCard, { props: { training: run() } });
    await wrapper.find('.primary-button').trigger('click');
    await flushPromises();
    await wrapper.find('input[type=radio]').setValue();
    const save = wrapper.find('button[type=submit]');
    expect(save.attributes('disabled')).toBeDefined();
    expect(wrapper.find('output').text()).toBe('Move the slider');
    await wrapper.find('input[type=range]').setValue('5');
    expect(save.attributes('disabled')).toBeUndefined();
  });

  it('says when the week has no running activity', async () => {
    mocked.fetchCandidates.mockResolvedValue([]);
    const wrapper = mount(TrainingCard, { props: { training: run() } });
    await wrapper.find('.primary-button').trigger('click');
    await flushPromises();
    expect(wrapper.find('.candidates').text()).toContain('No running activity this week.');
  });

  it('shows the reason the server refused', async () => {
    mocked.fetchCandidates.mockResolvedValue([candidate]);
    mocked.completeTraining.mockRejectedValue(new service.PlanApiError(422, 'At least 11.70 km is needed.'));
    const wrapper = mount(TrainingCard, { props: { training: run() } });
    await wrapper.find('.primary-button').trigger('click');
    await flushPromises();
    await wrapper.find('input[type=radio]').setValue();
    await wrapper.find('input[type=range]').setValue('4');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.find('.error').text()).toBe('At least 11.70 km is needed.');
    expect(notified).toHaveBeenCalledWith('At least 11.70 km is needed.', 'error');
    expect(wrapper.emitted('changed')).toBeUndefined();
  });

  it('shows a completed run with its seal and undoes it', async () => {
    mocked.uncompleteTraining.mockResolvedValue();
    const wrapper = mount(TrainingCard, { props: { training: run(true) } });
    expect(wrapper.classes()).toContain('done');
    expect(wrapper.find('.seal').exists()).toBe(true);
    expect(wrapper.find('.seal').classes()).not.toContain('stamped');
    expect(wrapper.find('.completion').text()).toContain('Example Long Run');
    expect(wrapper.find('.completion').text()).toContain('RPE 4');
    await wrapper.find('.completion button').trigger('click');
    await flushPromises();
    expect(mocked.uncompleteTraining).toHaveBeenCalledWith(1);
    expect(wrapper.emitted('changed')).toHaveLength(1);
  });

  it('stamps the seal when the training becomes done', async () => {
    const wrapper = mount(TrainingCard, { props: { training: tick() } });
    expect(wrapper.find('.seal').exists()).toBe(false);
    await wrapper.setProps({ training: tick(true) });
    expect(wrapper.find('.seal').classes()).toContain('stamped');
  });

  it('ticks and unticks a tick item with a tap on the card', async () => {
    mocked.completeTraining.mockResolvedValue(tick(true));
    mocked.uncompleteTraining.mockResolvedValue();
    const unticked = mount(TrainingCard, { props: { training: tick() } });
    expect(unticked.find('.tick-toggle').attributes('aria-pressed')).toBe('false');
    await unticked.find('.tick-toggle').trigger('click');
    await flushPromises();
    expect(mocked.completeTraining).toHaveBeenCalledWith(3);
    expect(unticked.emitted('changed')).toHaveLength(1);
    expect(notified).toHaveBeenLastCalledWith('Leg day ticked.');

    const ticked = mount(TrainingCard, { props: { training: tick(true) } });
    expect(ticked.find('.tick-toggle').attributes('aria-pressed')).toBe('true');
    await ticked.find('.tick-toggle').trigger('click');
    await flushPromises();
    expect(mocked.uncompleteTraining).toHaveBeenCalledWith(3);
    expect(notified).toHaveBeenLastCalledWith('Leg day unticked.');
  });
});

describe('WeekTimeline', () => {
  const weeks: PlanWeek[] = [
    { week_number: 1, phase: 'BASE', start: '2026-01-05', end: '2026-01-11', running: null, trainings: [run(true), tick()] },
    { week_number: 2, phase: 'RECOVERY', start: '2026-01-12', end: '2026-01-18', running: null, trainings: [] },
  ];

  it('marks the current week and its progress, and emits the chosen week', async () => {
    const wrapper = mount(WeekTimeline, { props: { weeks, currentWeek: 1, selectedWeek: 1, today: '2026-01-07' } });
    const rows = wrapper.findAll('.week-row');
    expect(rows[0]!.classes()).toEqual(expect.arrayContaining(['current', 'selected']));
    expect(rows[0]!.text()).toContain('5 Jan');
    expect(rows[0]!.find('.phase').text()).toBe('Base');
    expect(rows[0]!.find('.phase').classes()).toContain('phase-base');
    expect(rows[0]!.find('.long-run').text()).toBe('13 km');
    expect(rows[0]!.find('.count').text()).toBe('1/2');
    expect(rows[0]!.find('.bar-fill').attributes('style')).toContain('width: 50%');
    expect(rows[0]!.classes()).not.toContain('missed');
    await rows[1]!.trigger('click');
    expect(wrapper.emitted('select')).toEqual([[2]]);
  });

  it('marks a past week with trainings not done', () => {
    const wrapper = mount(WeekTimeline, { props: { weeks, currentWeek: 2, selectedWeek: 2, today: '2026-01-12' } });
    const rows = wrapper.findAll('.week-row');
    expect(rows[0]!.classes()).toContain('missed');
    expect(rows[1]!.classes()).not.toContain('missed');
    expect(rows[1]!.find('.phase').classes()).toContain('phase-recovery');
  });
});
