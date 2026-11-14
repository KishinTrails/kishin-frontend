import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import ActivityGrid from './ActivityGrid.vue';
import BarChart from './BarChart.vue';
import LineChart from './LineChart.vue';
import HrZones from './HrZones.vue';
import LapTable from './LapTable.vue';

const day = (date: string, distance_km: number, moving_sec: number) => ({
  date, count: 1, distance_km, moving_sec, elapsed_sec: moving_sec, ascent_m: 0,
});

describe('ActivityGrid', () => {
  const days = [day('2026-03-02', 5, 1800), day('2026-03-03', 12, 4200)];

  it('draws the days up to today and summarises them', () => {
    const wrapper = mount(ActivityGrid, { props: { days, today: '2026-03-04' } });
    expect(wrapper.findAll('.cell')).toHaveLength(51 * 7 + 3);
    expect(wrapper.find('.caption').text()).toBe('17.0 km on 2 days in the last year');
    expect(wrapper.find('[data-date="2026-03-03"]').classes()).toContain('level-3');
    expect(wrapper.find('[data-date="2026-03-02"]').classes()).toContain('level-1');
  });

  it('switches to moving time', async () => {
    const wrapper = mount(ActivityGrid, { props: { days, today: '2026-03-04' } });
    await wrapper.findAll('button')[1]!.trigger('click');
    expect(wrapper.find('.caption').text()).toBe('1:40:00 on 2 days in the last year');
  });

  it('lists the days in the table twin, newest first', async () => {
    const wrapper = mount(ActivityGrid, { props: { days, today: '2026-03-04' } });
    await wrapper.find('.view-toggle').trigger('click');
    const rows = wrapper.findAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.text()).toContain('Tue 3 Mar 2026');
    expect(rows[0]!.text()).toContain('12.0 km');
  });
});

describe('BarChart', () => {
  const bars = [
    { key: 'a', label: 'Week A', value: 10 },
    { key: 'b', label: 'Week B', value: 0 },
    { key: 'c', label: 'Week C', value: 25 },
  ];

  it('draws one bar per value with its title', () => {
    const wrapper = mount(BarChart, { props: { title: 'Distance', bars, format: (v: number) => `${v} km` } });
    const rects = wrapper.findAll('rect');
    expect(rects).toHaveLength(3);
    expect(rects[2]!.find('title').text()).toBe('Week C: 25 km');
    expect(Number(rects[1]!.attributes('height'))).toBe(0);
    expect(wrapper.find('svg').attributes('aria-label')).toBe('Distance: 35 km in total over 3 bars');
  });

  it('shows the table twin', async () => {
    const wrapper = mount(BarChart, { props: { title: 'Distance', bars, format: (v: number) => `${v} km` } });
    await wrapper.find('button').trigger('click');
    expect(wrapper.findAll('tbody tr').map((row) => row.text())).toEqual(['Week A10 km', 'Week B0 km', 'Week C25 km']);
  });
});

describe('LineChart', () => {
  const props = {
    title: 'Heart rate',
    x: [0, 1, 2, 3, 4],
    series: [
      { name: 'HR', values: [100, 110, null, 130, 140] },
      { name: 'Average', values: [100, 105, 110, 115, 120], dashed: true },
    ],
    formatX: (v: number) => `${v} km`,
    formatY: (v: number) => `${v} bpm`,
  };

  it('breaks the line at a null value', () => {
    const wrapper = mount(LineChart, { props });
    const d = wrapper.findAll('path.line')[0]!.attributes('d')!;
    expect(d.match(/M/g)).toHaveLength(2);
    expect(d.match(/L/g)).toHaveLength(2);
    expect(wrapper.findAll('path.line')[1]!.classes()).toContain('dashed');
  });

  it('says when there is no data', () => {
    const wrapper = mount(LineChart, { props: { ...props, series: [{ name: 'HR', values: [null, null, null, null, null] }] } });
    expect(wrapper.find('.empty').exists()).toBe(true);
  });

  it('puts small values at the top when inverted', () => {
    const wrapper = mount(LineChart, {
      props: { ...props, invert: true, series: [{ name: 'Pace', values: [300, 300, 300, 300, 400] }] },
    });
    const points = wrapper.find('path.line').attributes('d')!.split(/[ML]/).filter(Boolean).map((p) => Number(p.split(',')[1]));
    expect(points[0]!).toBeLessThan(points[4]!);
  });
});

describe('HrZones and LapTable', () => {
  it('sizes zones by their share of the time', () => {
    const wrapper = mount(HrZones, {
      props: { zones: [{ zone: 1, hr: 100, time_sec: 300 }, { zone: 2, hr: 120, time_sec: 900 }] },
    });
    const bars = wrapper.findAll('.bar');
    expect(bars[0]!.attributes('style')).toContain('width: 25.0%');
    expect(wrapper.text()).toContain('≥ 120 bpm');
  });

  it('lists the laps with their pace', () => {
    const lap = {
      lap: 1, start_time: null, stop_time: null, elapsed_sec: 960, moving_sec: 930, distance_km: 3,
      avg_speed_kmh: 12, max_speed_kmh: null, avg_hr: 140, max_hr: 150, avg_cadence: 85, max_cadence: null,
      ascent_m: 12.4, descent_m: null, calories: null, avg_temperature_c: null, hr_zones: [],
    };
    const wrapper = mount(LapTable, { props: { laps: [lap] } });
    expect(wrapper.find('tbody tr').text()).toContain('5:00 /km');
    expect(wrapper.find('tbody tr').text()).toContain('12 m');
  });
});
