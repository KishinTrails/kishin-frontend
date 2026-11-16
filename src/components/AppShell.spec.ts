import { mount, RouterLinkStub } from '@vue/test-utils';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/services/mapStyleService', () => ({
  loadMapStyle: () => 'ukiyo-e',
  styleToThemeClass: () => 'theme-ukiyo',
}));

import { IonRefresher } from '@ionic/vue';
import AppShell, { type Crumb, type Section } from './AppShell.vue';

const stubs = {
  IonPage: { template: '<div class="ion-page-stub"><slot /></div>' },
  IonHeader: { template: '<header><slot /></header>' },
  IonContent: { template: '<main><slot /></main>' },
  IonFooter: { template: '<footer><slot /></footer>' },
  IonIcon: { template: '<i />' },
  'router-link': RouterLinkStub,
};

const mountShell = (props: { title: string, section: Section, crumbs?: Crumb[] }) =>
  mount(AppShell, { props, slots: { default: '<p class="content">Foo</p>' }, global: { stubs } });

describe('AppShell', () => {
  it('sets the theme class and shows the page content', () => {
    const wrapper = mountShell({ title: 'Plan', section: 'plan' });
    expect(wrapper.find('.ion-page-stub').classes()).toEqual(expect.arrayContaining(['app-page', 'theme-ukiyo']));
    expect(wrapper.find('.page .content').text()).toBe('Foo');
    expect(wrapper.find('.page-title').text()).toBe('Plan');
  });

  it('highlights the tab of the section, in the top bar and the bottom bar', () => {
    const wrapper = mountShell({ title: 'Plan', section: 'plan' });
    const active = wrapper.findAll('.active');
    expect(active.map((tab) => tab.text())).toEqual(['Plan', 'Plan']);
    expect(active.every((tab) => tab.attributes('aria-current') === 'page')).toBe(true);
    const targets = wrapper.findAllComponents(RouterLinkStub).map((link) => link.props('to'));
    expect(targets).toEqual(expect.arrayContaining(['/map', '/athlete', '/plan', '/logout']));
  });

  it('shows the breadcrumb, with a link on every step but the last', () => {
    const wrapper = mountShell({
      title: 'Activity',
      section: 'athlete',
      crumbs: [{ label: 'Athlete', to: '/athlete' }, { label: 'Example Title' }],
    });
    const crumbs = wrapper.find('.crumbs');
    expect(crumbs.find('.separator').text()).toBe('›');
    expect(crumbs.findAll('a').map((link) => link.text())).toEqual(['Athlete']);
    expect(crumbs.find('[aria-current="page"]').text()).toBe('Example Title');
  });

  it('emits refresh with a function that completes the refresher', async () => {
    const complete = vi.fn(async () => undefined);
    const wrapper = mount(AppShell, {
      props: { title: 'Plan', section: 'plan', refreshable: true },
      global: { stubs: { ...stubs, IonRefresher: { template: '<div class="refresher"><slot /></div>' }, IonRefresherContent: true } },
    });
    const refresher = wrapper.findComponent(IonRefresher);
    expect(refresher.exists()).toBe(true);
    refresher.vm.$emit('ionRefresh', { target: { complete } });
    const [[done]] = wrapper.emitted('refresh') as [[() => void]];
    done();
    expect(complete).toHaveBeenCalled();
  });

  it('has no refresher unless refreshable', () => {
    const wrapper = mount(AppShell, {
      props: { title: 'Plan', section: 'plan' },
      global: { stubs: { ...stubs, IonRefresher: { template: '<div class="refresher" />' } } },
    });
    expect(wrapper.find('.refresher').exists()).toBe(false);
  });

  it('has no breadcrumb without crumbs', () => {
    expect(mountShell({ title: 'Plan', section: 'plan' }).find('.crumbs').exists()).toBe(false);
  });
});
