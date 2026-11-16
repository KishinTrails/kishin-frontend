import { mount, RouterLinkStub } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';

const state = vi.hoisted(() => ({
  startTracking: vi.fn(),
  stopTracking: vi.fn(async () => undefined),
}));

const isTracking = ref(false);
const lastPosition = ref<{ latitude: number, longitude: number, accuracy: number, timestamp: number } | null>(null);
const error = ref<string | null>(null);
const loginExpiresSoon = ref(false);

vi.mock('@/composables/useTrailTracker', () => ({
  useTrailTracker: () => ({
    isTracking, lastPosition, error, loginExpiresSoon,
    startTracking: state.startTracking, stopTracking: state.stopTracking,
  }),
}));

import GpsTracker from './GpsTracker.vue';

const NOW = 1_800_000_000_000;

const mountTracker = () => mount(GpsTracker, { global: { stubs: { 'router-link': RouterLinkStub } } });

describe('GpsTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
    isTracking.value = false;
    lastPosition.value = null;
    error.value = null;
    loginExpiresSoon.value = false;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not start by itself, and says Off', () => {
    const wrapper = mountTracker();
    expect(state.startTracking).not.toHaveBeenCalled();
    expect(wrapper.find('.tracking-state').text()).toBe('Off');
    expect(wrapper.find('.center').attributes('disabled')).toBeDefined();
  });

  it('starts from the Start button', async () => {
    const wrapper = mountTracker();
    await wrapper.find('.start').trigger('click');
    expect(state.startTracking).toHaveBeenCalledTimes(1);
  });

  it('shows the accuracy, the age of the fix and the coordinates while tracking', async () => {
    isTracking.value = true;
    lastPosition.value = { latitude: 48.855421, longitude: 2.345939, accuracy: 4.24, timestamp: NOW - 12_000 };
    const wrapper = mountTracker();
    expect(wrapper.find('.tracking-state').text()).toBe('On');
    expect(wrapper.find('.fix').text()).toBe('± 4.2 m · 12 s ago');
    expect(wrapper.find('.coords').text()).toBe('48.855421, 2.345939');
    vi.advanceTimersByTime(60_000);
    await wrapper.vm.$nextTick();
    expect(wrapper.find('.fix').text()).toBe('± 4.2 m · 1 min ago');
    await wrapper.find('.stop').trigger('click');
    expect(state.stopTracking).toHaveBeenCalled();
  });

  it('waits for the first fix after starting', () => {
    isTracking.value = true;
    expect(mountTracker().find('.fix').text()).toBe('Waiting for the first fix…');
  });

  it('emits center with the last fix', async () => {
    lastPosition.value = { latitude: 48.855421, longitude: 2.345939, accuracy: 5, timestamp: NOW };
    const wrapper = mountTracker();
    await wrapper.find('.center').trigger('click');
    expect(wrapper.emitted('center')).toEqual([[lastPosition.value]]);
  });

  it('offers to log in again when the login expires soon', () => {
    error.value = 'Your login expires within 24 hours. Log in again before tracking.';
    loginExpiresSoon.value = true;
    const wrapper = mountTracker();
    expect(wrapper.find('.gps-error').text()).toContain('Log in again');
  });

  it('stops tracking when unmounted', () => {
    mountTracker().unmount();
    expect(state.stopTracking).toHaveBeenCalled();
  });
});
