import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./athleteService', () => ({
  fetchActivities: vi.fn(),
  fetchDailyActivities: vi.fn(),
}));

import * as service from './athleteService';
import type { ActivitySummary, DailyActivities } from './athleteService';
import { fetchNeighbours } from './activityNeighbours';

const mocked = vi.mocked(service);

const activity = (id: string, start: string): ActivitySummary => ({
  activity_id: id, name: `Foo ${id}`, sport: 'running', sub_sport: null, start_time: start, stop_time: null,
  elapsed_sec: null, moving_sec: null, distance_km: null, ascent_m: null, descent_m: null, avg_hr: null, max_hr: null,
  calories: null, avg_speed_kmh: null, training_effect: null, anaerobic_training_effect: null,
});

const day = (date: string): DailyActivities =>
  ({ date, count: 1, distance_km: 5, moving_sec: 1800, elapsed_sec: 1900, ascent_m: 10 });

describe('fetchNeighbours', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 2, 20, 12));
  });
  afterEach(() => vi.useRealTimers());

  it('takes both neighbours from the same day when it has them', async () => {
    mocked.fetchActivities.mockResolvedValueOnce([
      activity('3', '2026-03-03T18:00:00'), activity('2', '2026-03-03T12:00:00'), activity('1', '2026-03-03T07:00:00'),
    ]);
    const result = await fetchNeighbours('2', '2026-03-03T12:00:00');
    expect(result.previous?.activity_id).toBe('1');
    expect(result.next?.activity_id).toBe('3');
    expect(mocked.fetchActivities).toHaveBeenCalledTimes(1);
    expect(mocked.fetchActivities).toHaveBeenCalledWith({ start: '2026-03-03', end: '2026-03-03', limit: 100 });
  });

  it('looks before and after the day when it holds only this activity', async () => {
    mocked.fetchActivities.mockImplementation(async (query = {}) => {
      if (query.start === '2026-03-03') return [activity('2', '2026-03-03T12:00:00')];
      if (query.end === '2026-03-02') return [activity('1', '2026-02-27T07:00:00')];
      if (query.start === '2026-03-10') return [activity('4', '2026-03-10T18:00:00'), activity('3', '2026-03-10T07:00:00')];
      return [];
    });
    mocked.fetchDailyActivities.mockResolvedValue([day('2026-03-10'), day('2026-03-15')]);
    const result = await fetchNeighbours('2', '2026-03-03T12:00:00');
    expect(result.previous?.activity_id).toBe('1');
    expect(result.next?.activity_id).toBe('3');
    expect(mocked.fetchActivities).toHaveBeenCalledWith({ end: '2026-03-02', limit: 1 });
    expect(mocked.fetchDailyActivities).toHaveBeenCalledWith('2026-03-04', '2026-03-20');
  });

  it('gives no neighbours at the ends of the history', async () => {
    mocked.fetchActivities.mockImplementation(async (query = {}) =>
      (query.start === '2026-03-03' ? [activity('2', '2026-03-03T12:00:00')] : []));
    mocked.fetchDailyActivities.mockResolvedValue([]);
    expect(await fetchNeighbours('2', '2026-03-03T12:00:00')).toEqual({ previous: null, next: null });
  });

  it('does not look after today', async () => {
    mocked.fetchActivities.mockImplementation(async (query = {}) =>
      (query.start === '2026-03-20' ? [activity('9', '2026-03-20T07:00:00')] : []));
    const result = await fetchNeighbours('9', '2026-03-20T07:00:00');
    expect(result.next).toBeNull();
    expect(mocked.fetchDailyActivities).not.toHaveBeenCalled();
  });

  it('gives no neighbours without a start time', async () => {
    expect(await fetchNeighbours('9', null)).toEqual({ previous: null, next: null });
    expect(mocked.fetchActivities).not.toHaveBeenCalled();
  });
});
