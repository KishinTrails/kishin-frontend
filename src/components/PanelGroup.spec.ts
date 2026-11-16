import { mount } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PanelGroup from './PanelGroup.vue';

const KEY = 'kishin_panel_groups';

const mountGroup = (id = 'foo') =>
  mount(PanelGroup, { props: { id, title: 'Foo' }, slots: { default: '<p class="body">Bar</p>' } });

/**
 * Folds or unfolds the group as a click on its header would.
 *
 * @param wrapper - The mounted group
 * @param open - The new state
 */
async function setOpen(wrapper: ReturnType<typeof mountGroup>, open: boolean): Promise<void> {
  const details = wrapper.find('details').element as HTMLDetailsElement;
  details.open = open;
  await wrapper.find('details').trigger('toggle');
}

describe('PanelGroup', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('is open by default and shows its title and controls', () => {
    const wrapper = mountGroup();
    expect(wrapper.find('details').attributes('open')).toBeDefined();
    expect(wrapper.find('summary').text()).toBe('Foo');
    expect(wrapper.find('.body').text()).toBe('Bar');
  });

  it('keeps the state of each group in localStorage', async () => {
    localStorage.setItem(KEY, JSON.stringify({ bar: true }));
    const wrapper = mountGroup('foo');
    await setOpen(wrapper, false);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ bar: true, foo: false });
  });

  it('opens closed when it was closed before', () => {
    localStorage.setItem(KEY, JSON.stringify({ foo: false }));
    expect(mountGroup('foo').find('details').attributes('open')).toBeUndefined();
  });

  it('opens, and still folds, when localStorage throws', async () => {
    const blocked = () => { throw new Error('blocked'); };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    const wrapper = mountGroup();
    expect(wrapper.find('details').attributes('open')).toBeDefined();
    await setOpen(wrapper, false);
    expect(wrapper.find('details').attributes('open')).toBeUndefined();
  });

  it('starts closed on a narrow window and keeps nothing there', async () => {
    localStorage.setItem(KEY, JSON.stringify({ foo: true }));
    vi.stubGlobal('innerWidth', 390);
    const wrapper = mountGroup('foo');
    expect(wrapper.find('details').attributes('open')).toBeUndefined();
    await setOpen(wrapper, true);
    expect(wrapper.find('details').attributes('open')).toBeDefined();
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ foo: true });
    await setOpen(wrapper, false);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ foo: true });
  });

  it('ignores a stored value that is not an object', () => {
    localStorage.setItem(KEY, '"foo"');
    expect(mountGroup().find('details').attributes('open')).toBeDefined();
  });
});
