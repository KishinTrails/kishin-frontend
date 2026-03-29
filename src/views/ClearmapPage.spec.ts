import { mount } from '@vue/test-utils'
import { describe, expect, test, vi, beforeEach } from 'vitest'
import ClearmapPage from './ClearmapPage.vue'
import * as h3 from 'h3-js'

vi.mock('maplibregl', () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    addControl: vi.fn(),
    project: vi.fn().mockReturnValue({ x: 100, y: 100 }),
    getBounds: vi.fn().mockReturnValue({
      getSouthWest: vi.fn().mockReturnValue({ lat: 45.75, lng: 3.09 }),
      getNorthEast: vi.fn().mockReturnValue({ lat: 45.76, lng: 3.11 })
    }),
    getZoom: vi.fn().mockReturnValue(16),
    resize: vi.fn(),
    remove: vi.fn()
  })),
  NavigationControl: vi.fn()
}))

vi.mock('@ionic/vue', () => ({
  IonPage: {
    name: 'IonPage',
    template: '<div><slot /></div>'
  },
  IonContent: {
    name: 'IonContent',
    template: '<div><slot /></div>'
  }
}))

vi.mock('@/services/poiService', () => ({
  fetchCellTypes: vi.fn().mockResolvedValue(new Map())
}))

vi.mock('@/services/cacheService', () => ({
  getCellTypeFromCache: vi.fn().mockReturnValue(null)
}))

describe('ClearmapPage.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders map container and cells canvas', () => {
    const wrapper = mount(ClearmapPage)
    
    expect(wrapper.find('.map-container').exists()).toBe(true)
    expect(wrapper.find('.map').exists()).toBe(true)
    expect(wrapper.find('.cells-overlay').exists()).toBe(true)
    expect(wrapper.find('canvas.cells-overlay').exists()).toBe(true)
  })

  test('renders controls', () => {
    const wrapper = mount(ClearmapPage)
    
    expect(wrapper.find('.controls').exists()).toBe(true)
    expect(wrapper.text()).toContain('Trail Map')
  })

  test('renders stats', () => {
    const wrapper = mount(ClearmapPage)
    
    expect(wrapper.text()).toContain('Rendered Cells')
    expect(wrapper.text()).toContain('Pending Calls')
    expect(wrapper.text()).toContain('Cache Hits')
    expect(wrapper.text()).toContain('Cache Misses')
  })

  test('visible cells array exists', () => {
    const wrapper = mount(ClearmapPage) as any
    const vm = wrapper.vm
    
    expect(vm.visibleCells).toBeDefined()
    expect(Array.isArray(vm.visibleCells)).toBe(true)
  })

  test('cellTypes map exists', () => {
    const wrapper = mount(ClearmapPage) as any
    const vm = wrapper.vm
    
    expect(vm.cellTypes).toBeDefined()
    expect(vm.cellTypes instanceof Map).toBe(true)
  })

  test('typeImages object has all required types', () => {
    const wrapper = mount(ClearmapPage) as any
    const vm = wrapper.vm
    
    expect(vm.typeImages).toBeDefined()
    expect(vm.typeImages.peak).toBeDefined()
    expect(vm.typeImages.natural).toBeDefined()
    expect(vm.typeImages.industrial).toBeDefined()
  })

  test('H3_RESOLUTION constant is defined', () => {
    const wrapper = mount(ClearmapPage) as any
    const vm = wrapper.vm
    
    expect(vm.H3_RESOLUTION).toBe(10)
  })

  test('remainingCalls and cache stats exist', () => {
    const wrapper = mount(ClearmapPage) as any
    const vm = wrapper.vm
    
    expect(vm.remainingCalls).toBeDefined()
    expect(vm.cacheHits).toBeDefined()
    expect(vm.cacheMisses).toBeDefined()
  })
})