import { flushPromises, mount, RouterLinkStub } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/athleteService', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/services/athleteService')>();
  return {
    ...original,
    fetchActivities: vi.fn(),
    fetchDailyActivities: vi.fn(),
    fetchMeasures: vi.fn(),
    fetchActivity: vi.fn(),
    fetchTrack: vi.fn(),
    fetchRecords: vi.fn(),
  };
});

vi.mock('@/services/mapStyleService', () => ({
  loadMapStyle: () => 'standard',
  styleToThemeClass: () => 'theme-standard',
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: '1001' } }),
}));

import * as service from '@/services/athleteService';
import AthletePage from './AthletePage.vue';
import ActivityPage from './ActivityPage.vue';

const mocked = vi.mocked(service);

const stubs = {
  'ion-page': { template: '<div><slot /></div>' },
  'ion-content': { template: '<div><slot /></div>' },
  IonPage: { template: '<div><slot /></div>' },
  IonContent: { template: '<div><slot /></div>' },
  'router-link': RouterLinkStub,
  ActivityMap: { template: '<div class="map-stub" />', props: ['track'] },
};

const summary = (id: string, name: string | null) => ({
  activity_id: id, name, sport: 'running', sub_sport: 'generic', start_time: '2026-03-03T07:00:00',
  stop_time: null, elapsed_sec: 1900, moving_sec: 1800, distance_km: 6, ascent_m: 40, descent_m: 35,
  avg_hr: 140, max_hr: 160, calories: 400, avg_speed_kmh: 12, training_effect: 2.5, anaerobic_training_effect: 0.5,
});

describe('AthletePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.fetchDailyActivities.mockResolvedValue([
      { date: '2026-03-03', count: 1, distance_km: 6, moving_sec: 1800, elapsed_sec: 1900, ascent_m: 40 },
    ]);
    mocked.fetchMeasures.mockResolvedValue([
      {
        date: '2026-03-03', weight_kg: 70, fat_ratio_pct: 20, fat_ratio_ema: 20.5, muscle_mass_kg: 35,
        muscle_mass_ema: 35, fat_mass_kg: null, fat_free_mass_kg: null, bone_mass_kg: null, hydration_kg: null,
      },
    ]);
    mocked.fetchActivities.mockResolvedValue([summary('1001', 'Example Run'), summary('1002', null)]);
  });

  it('shows the grid, the weekly charts, the measures and the activities', async () => {
    const wrapper = mount(AthletePage, { global: { stubs } });
    await flushPromises();
    expect(wrapper.find('.activity-grid').exists()).toBe(true);
    expect(wrapper.findAll('.bar-chart')).toHaveLength(2);
    expect(wrapper.findAll('.line-chart')).toHaveLength(3);
    const links = wrapper.findAllComponents(RouterLinkStub).filter((link) => String(link.props('to')).includes('/activities/'));
    expect(links.map((link) => link.text())).toEqual(['Example Run', 'running / generic']);
    expect(mocked.fetchActivities).toHaveBeenCalledWith({ limit: 20, offset: 0 });
  });

  it('says when the health database is not configured', async () => {
    mocked.fetchDailyActivities.mockRejectedValue(new service.AthleteApiError(503, '/activities/daily'));
    const wrapper = mount(AthletePage, { global: { stubs } });
    await flushPromises();
    expect(wrapper.text()).toContain('Health data is not configured on the server.');
  });

  it('hides "Load more" after a short page', async () => {
    const wrapper = mount(AthletePage, { global: { stubs } });
    await flushPromises();
    expect(wrapper.find('.activity-list button').exists()).toBe(false);
  });
});

describe('ActivityPage', () => {
  const detail = {
    ...summary('1001', 'Example Run'),
    description: null, type: 'uncategorized', lap_count: 1, device_serial_number: null, self_eval_feel: null,
    self_eval_effort: 'Moderate', training_load: null, cycles: null, avg_cadence: 85, max_cadence: 90,
    max_speed_kmh: 15, avg_rr: null, max_rr: null, avg_temperature_c: 20, min_temperature_c: null,
    max_temperature_c: null, start_lat: null, start_lon: null, stop_lat: null, stop_lon: null,
    hr_zones_method: 'max_heart_rate',
    hr_zones: [{ zone: 1, hr: 100, time_sec: 600 }, { zone: 2, hr: 120, time_sec: 1200 }],
    running: {
      steps: 5000, avg_pace_sec_per_km: 300, avg_moving_pace_sec_per_km: null, max_pace_sec_per_km: null,
      avg_steps_per_min: 170, max_steps_per_min: null, avg_step_length_mm: 1200, avg_vertical_ratio_pct: null,
      avg_vertical_oscillation_mm: null, avg_ground_contact_time_ms: 250, vo2_max: null,
    },
    laps: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocked.fetchActivity.mockResolvedValue(detail);
    mocked.fetchTrack.mockResolvedValue({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [[2.35, 48.85], [2.36, 48.86]] },
      properties: { activity_id: '1001', points: 2 },
      bbox: [2.35, 48.85, 2.36, 48.86],
    });
    mocked.fetchRecords.mockResolvedValue({
      activity_id: '1001', timestamp: [null, null], elapsed_sec: [0, 10], distance_km: [0, 0.03],
      altitude_m: [100, 101], hr: [130, 131], speed_kmh: [10.8, 1], cadence: [85, 86], temperature_c: [20, 20],
      lat: [48.85, 48.86], lon: [2.35, 2.36],
    });
  });

  it('shows the summary, map, charts, zones and fields, leaving out empty fields', async () => {
    const wrapper = mount(ActivityPage, { global: { stubs } });
    await flushPromises();
    expect(mocked.fetchActivity).toHaveBeenCalledWith('1001');
    expect(wrapper.find('h1').text()).toBe('Example Run');
    expect(wrapper.find('.headline').text()).toContain('6.00 km');
    expect(wrapper.find('.map-stub').exists()).toBe(true);
    expect(wrapper.findAll('.line-chart')).toHaveLength(4);
    expect(wrapper.text()).toContain('Step length');
    expect(wrapper.text()).toContain('1.20 m');
    expect(wrapper.text()).toContain('Effort (Garmin)');
    expect(wrapper.text()).not.toContain('Feel (Garmin)');
  });

  it('leaves the map out for a track without positions', async () => {
    mocked.fetchTrack.mockResolvedValue({
      type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: { activity_id: '1001', points: 0 }, bbox: null,
    });
    const wrapper = mount(ActivityPage, { global: { stubs } });
    await flushPromises();
    expect(wrapper.find('.map-stub').exists()).toBe(false);
  });

  it('says when the activity does not exist', async () => {
    mocked.fetchActivity.mockRejectedValue(new service.AthleteApiError(404, '/activities/1001'));
    const wrapper = mount(ActivityPage, { global: { stubs } });
    await flushPromises();
    expect(wrapper.text()).toContain('This activity does not exist.');
  });
});
