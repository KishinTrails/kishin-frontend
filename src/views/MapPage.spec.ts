import { mount } from '@vue/test-utils'
import { describe, expect, test, vi, beforeEach } from 'vitest'
import MapPage from './MapPage.vue'

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

vi.mock('@/services/trailsService', () => ({
  fetchExploredTiles: vi.fn().mockResolvedValue(['cell1', 'cell2', 'cell3'])
}))

vi.mock('@/services/poiService', () => ({
  fetchCellTypes: vi.fn().mockResolvedValue(new Map())
}))

vi.mock('@/services/cacheService', () => ({
  getCellTypeFromCache: vi.fn().mockReturnValue(null)
}))

vi.mock('h3-js', () => ({
  polygonToCells: vi.fn().mockReturnValue(['cell1', 'cell2', 'cell3']),
  cellToBoundary: vi.fn().mockReturnValue([[45.75, 3.09], [45.76, 3.09], [45.76, 3.11], [45.75, 3.11]]),
  getResolution: vi.fn().mockReturnValue(10),
  uncompactCells: vi.fn().mockReturnValue(['cell1', 'cell2', 'cell3']),
  cellToChildren: vi.fn().mockReturnValue([])
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

  test('renders controls with stats', () => {
    const wrapper = mount(MapPage)
    
    expect(wrapper.find('.controls').exists()).toBe(true)
    expect(wrapper.text()).toContain('Trail Map')
    expect(wrapper.text()).toContain('Explored:')
    expect(wrapper.text()).toContain('Visible Explored:')
    expect(wrapper.text()).toContain('Visible Fog:')
  })

  test('visibleCells array exists', () => {
    const wrapper = mount(MapPage) as any
    const vm = wrapper.vm
    
    expect(vm.visibleCells).toBeDefined()
    expect(Array.isArray(vm.visibleCells)).toBe(true)
  })

  test('visitedCells Set exists', () => {
    const wrapper = mount(MapPage) as any
    const vm = wrapper.vm
    
    expect(vm.visitedCells).toBeDefined()
    expect(vm.visitedCells instanceof Set).toBe(true)
  })

  test('cellTypes map exists', () => {
    const wrapper = mount(MapPage) as any
    const vm = wrapper.vm
    
    expect(vm.cellTypes).toBeDefined()
    expect(vm.cellTypes instanceof Map).toBe(true)
  })

  test('fogOpacity defaults to 0.85', () => {
    const wrapper = mount(MapPage) as any
    const vm = wrapper.vm
    
    expect(vm.fogOpacity).toBe(0.85)
  })

  test('fogColor defaults to dark', () => {
    const wrapper = mount(MapPage) as any
    const vm = wrapper.vm
    
    expect(vm.fogColor).toBe('#1a1a1a')
  })

  test('H3_RESOLUTION constant is defined', () => {
    const wrapper = mount(MapPage) as any
    const vm = wrapper.vm
    
    expect(vm.H3_RESOLUTION).toBe(10)
  })

  test('typeImages object has all required types', () => {
    const wrapper = mount(MapPage) as any
    const vm = wrapper.vm
    
    expect(vm.typeImages).toBeDefined()
    expect(vm.typeImages.peak).toBeDefined()
    expect(vm.typeImages.natural).toBeDefined()
    expect(vm.typeImages.industrial).toBeDefined()
  })

  test('visibleExplored and visibleFog arrays exist', () => {
    const wrapper = mount(MapPage) as any
    const vm = wrapper.vm
    
    expect(vm.visibleExplored).toBeDefined()
    expect(Array.isArray(vm.visibleExplored)).toBe(true)
    expect(vm.visibleFog).toBeDefined()
    expect(Array.isArray(vm.visibleFog)).toBe(true)
  })

  test('updateVisibleCells correctly splits cells into explored and fog', async () => {
    const wrapper = mount(MapPage) as any
    const vm = wrapper.vm
    
    // Set some visited cells
    vm.visitedCells = new Set(['cell1'])
    
    // Mock the map so updateVisibleCells doesn't return early
    vm.map = {
      getBounds: vi.fn().mockReturnValue({
        getSouthWest: () => ({ lat: 45.75, lng: 3.09 }),
        getNorthEast: () => ({ lat: 45.76, lng: 3.11 })
      })
    }
    
    // Call the method
    vm.updateVisibleCells()
    
    // cell1 should be explored, cell2 and cell3 should be fog
    expect(vm.visibleExplored).toContain('cell1')
    expect(vm.visibleFog).toContain('cell2')
    expect(vm.visibleFog).toContain('cell3')
  })

  test('loadExploredTiles fetches from API and populates visitedCells', async () => {
    const { fetchExploredTiles } = await import('@/services/trailsService')
    
    const wrapper = mount(MapPage) as any
    const vm = wrapper.vm
    
    // Call the method
    await vm.loadExploredTiles()
    
    // Should have called the mock API
    expect(fetchExploredTiles).toHaveBeenCalled()
    
    // visitedCells should be populated
    expect(vm.visitedCells.has('cell1')).toBe(true)
    expect(vm.visitedCells.has('cell2')).toBe(true)
    expect(vm.visitedCells.has('cell3')).toBe(true)
  })

  test('fetchCellTypes skips API call when all cells are cached', async () => {
    const { getCellTypeFromCache } = await import('@/services/cacheService')
    const { fetchCellTypes } = await import('@/services/poiService')
    
    const wrapper = mount(MapPage) as any
    const vm = wrapper.vm
    
    // All cells are cached
    vm.visibleExplored = ['cell1', 'cell2']
    vm.cellTypes = new Map()
    getCellTypeFromCache.mockReturnValue('peak')
    
    await vm.fetchCellTypes()
    
    // Should NOT call the API
    expect(fetchCellTypes).not.toHaveBeenCalled()
  })

  test('fetchCellTypes only fetches uncached cells from API', async () => {
    const { getCellTypeFromCache } = await import('@/services/cacheService')
    const { fetchCellTypes } = await import('@/services/poiService')
    
    const wrapper = mount(MapPage) as any
    const vm = wrapper.vm
    
    // First cell cached, second not
    vm.visibleExplored = ['cell1', 'cell2']
    vm.cellTypes = new Map()
    getCellTypeFromCache
      .mockReturnValueOnce('peak')  // cell1 cached
      .mockReturnValueOnce(null)     // cell2 not cached
    
    await vm.fetchCellTypes()
    
    // Should call API only for cell2
    expect(fetchCellTypes).toHaveBeenCalledWith(['cell2'], expect.any(AbortSignal))
  })

  test('fetchCellTypes handles empty cell list', async () => {
    const { fetchCellTypes } = await import('@/services/poiService')
    
    const wrapper = mount(MapPage) as any
    const vm = wrapper.vm
    
    vm.visibleExplored = []
    vm.cellTypes = new Map()
    
    await vm.fetchCellTypes()
    
    // Should NOT call API with empty list
    expect(fetchCellTypes).not.toHaveBeenCalled()
  })

  test('updateVisibleCells returns early when map is not initialized', () => {
    const wrapper = mount(MapPage) as any
    const vm = wrapper.vm
    
    vm.map = null
    
    // Should not throw
    expect(() => vm.updateVisibleCells()).not.toThrow()
  })

  test('fetchCellTypes caches non-none types from API', async () => {
    const { fetchCellTypes } = await import('@/services/poiService')
    const { getCellTypeFromCache } = await import('@/services/cacheService')
    
    const wrapper = mount(MapPage) as any
    const vm = wrapper.vm
    
    // Reset state - ensure no cells are pre-cached
    vm.cellTypes = new Map()
    vm.visibleExplored = ['cell1', 'cell2']
    
    // Make cache return null so cells need fetching
    const mockGetCache = getCellTypeFromCache as ReturnType<typeof vi.fn>
    mockGetCache.mockReturnValue(null)
    
    // Mock the API to return cells with types
    const mockFetch = fetchCellTypes as ReturnType<typeof vi.fn>
    mockFetch.mockResolvedValueOnce(new Map([
      ['cell1', 'peak'],
      ['cell2', 'natural']
    ]))
    
    await vm.fetchCellTypes()
    
    // Should cache both cell types from API
    expect(vm.cellTypes.get('cell1')).toBe('peak')
    expect(vm.cellTypes.get('cell2')).toBe('natural')
  })
})