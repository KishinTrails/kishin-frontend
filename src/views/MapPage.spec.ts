import { mount } from '@vue/test-utils'
import { describe, expect, test, vi, beforeEach } from 'vitest'
import MapPage from './MapPage.vue'
import * as h3 from 'h3-js'

vi.mock('maplibregl', () => ({
  default: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    addControl: vi.fn(),
    project: vi.fn().mockReturnValue({ x: 100, y: 100 }),
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

describe('MapPage.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders map container and cells canvas', () => {
    const wrapper = mount(MapPage)
    
    expect(wrapper.find('.map-container').exists()).toBe(true)
    expect(wrapper.find('.map').exists()).toBe(true)
    expect(wrapper.find('.cells-overlay').exists()).toBe(true)
    expect(wrapper.find('canvas.cells-overlay').exists()).toBe(true)
  })

  test('renders controls', () => {
    const wrapper = mount(MapPage)
    
    expect(wrapper.find('.controls').exists()).toBe(true)
    expect(wrapper.text()).toContain('Trail Map')
  })

  test('renders legend', () => {
    const wrapper = mount(MapPage)
    
    expect(wrapper.find('.legend').exists()).toBe(true)
    expect(wrapper.text()).toContain('Legend')
    expect(wrapper.text()).toContain('Peak')
    expect(wrapper.text()).toContain('Natural')
    expect(wrapper.text()).toContain('Industrial')
  })

  test('renders cells count stat', () => {
    const wrapper = mount(MapPage)
    
    expect(wrapper.text()).toContain('Cells:')
  })

  test('has hardcoded H3 cells defined', () => {
    const wrapper = mount(MapPage) as any
    const vm = wrapper.vm
    
    expect(vm.h3Cells).toBeDefined()
    expect(Array.isArray(vm.h3Cells)).toBe(true)
    expect(vm.h3Cells.length).toBeGreaterThan(0)
  })

  test('visible cells array exists', () => {
    const wrapper = mount(MapPage) as any
    const vm = wrapper.vm
    
    expect(vm.visibleCells).toBeDefined()
    expect(Array.isArray(vm.visibleCells)).toBe(true)
  })

  test('cellTypes map exists with valid types', () => {
    const wrapper = mount(MapPage) as any
    const vm = wrapper.vm
    
    expect(vm.cellTypes).toBeDefined()
    expect(vm.cellTypes instanceof Map).toBe(true)
    
    const validTypes = ['peak', 'natural', 'industrial']
    vm.cellTypes.forEach((type: string) => {
      expect(validTypes).toContain(type)
    })
  })

  test('cellTypes has entries for hardcoded cells', () => {
    const wrapper = mount(MapPage) as any
    const vm = wrapper.vm
    
    let matchedCount = 0
    vm.h3Cells.forEach((cell: string) => {
      if (vm.cellTypes.has(cell)) {
        matchedCount++
      }
    })
    expect(matchedCount).toBeGreaterThan(0)
  })

  test('processH3Cells returns only resolution 10 cells', () => {
    const wrapper = mount(MapPage) as any
    const vm = wrapper.vm
    
    const baseCell = '8a1fb4644077fff'
    const mixedResCells = [
      '871fb4670ffffff',
      '881fb47597fffff',
      h3.cellToParent(baseCell, 9),
      baseCell,
    ]
    
    vm.h3Cells = mixedResCells
    vm.processH3Cells()
    
    expect(vm.visibleCells.length).toBeGreaterThan(0)
    
    vm.visibleCells.forEach((cell: string) => {
      expect(h3.getResolution(cell)).toBe(10)
    })
  })

  test('processH3Cells deduplicates cells', () => {
    const wrapper = mount(MapPage) as any
    const vm = wrapper.vm
    
    const baseCell = '8a1fb4644077fff'
    const mixedResCells = [
      '871fb4670ffffff',
      '881fb47597fffff',
      h3.cellToParent(baseCell, 9),
      baseCell,
    ]
    
    vm.h3Cells = mixedResCells
    vm.processH3Cells()
    
    const uniqueCells = new Set(vm.visibleCells)
    expect(vm.visibleCells.length).toBe(uniqueCells.size)
  })

  test('typeImages object has all required types', () => {
    const wrapper = mount(MapPage) as any
    const vm = wrapper.vm
    
    expect(vm.typeImages).toBeDefined()
    expect(vm.typeImages.peak).toBeDefined()
    expect(vm.typeImages.natural).toBeDefined()
    expect(vm.typeImages.industrial).toBeDefined()
  })

  test('hardcoded cells are valid H3 indexes', () => {
    const wrapper = mount(MapPage) as any
    const vm = wrapper.vm
    
    vm.h3Cells.forEach((cell: string) => {
      const boundary = h3.cellToBoundary(cell)
      expect(boundary.length).toBeGreaterThan(0)
    })
  })
})