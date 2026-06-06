import { mount, VueWrapper } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import FogOverlay from '@/components/FogOverlay.vue';
import { MockCanvasRenderingContext2D } from '@/__mocks__/canvas';

vi.mock('@/utils/s2Utils', () => {
  const degreeVertices = [
    { lat: 45.75, lng: 3.1  },
    { lat: 45.76, lng: 3.1  },
    { lat: 45.76, lng: 3.11 },
    { lat: 45.75, lng: 3.11 },
  ];
  return {
    tokenToCell:    vi.fn().mockImplementation((token: string) => token),
    cellToVertices: vi.fn().mockImplementation(() => degreeVertices),
  };
});

vi.mock('@/utils/color', () => ({
  hexToRgba: vi.fn((hex: string, alpha: number) => `rgba(${hex}, ${alpha})`),
}));

// ─── Mock map factory ──────────────────────────────────────────────────────────

const makeMap = (): any => {
  const listeners = new Map<string, Array<() => void>>();
  const sources   = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers: string[] = [];

  return {
    project: vi.fn((coord: [number, number]) => ({ x: coord[0] * 1000, y: coord[1] * 1000 })),

    on:  vi.fn((ev: string, cb: () => void) => {
      if (!listeners.has(ev)) listeners.set(ev, []);
      listeners.get(ev)!.push(cb);
    }),
    off: vi.fn((ev: string, cb: () => void) => {
      const list = listeners.get(ev);
      if (list) listeners.set(ev, list.filter(f => f !== cb));
    }),
    /** Test helper: fire all listeners for an event. */
    emit: (ev: string) => listeners.get(ev)?.forEach(cb => cb()),

    addSource:    vi.fn((id: string) => sources.set(id, { setData: vi.fn() })),
    getSource:    vi.fn((id: string) => sources.get(id)),
    removeSource: vi.fn((id: string) => sources.delete(id)),

    addLayer:         vi.fn((l: { id: string }) => layers.push(l.id)),
    getLayer:         vi.fn((id: string) => (layers.includes(id) ? {} : undefined)),
    removeLayer:      vi.fn((id: string) => layers.splice(layers.indexOf(id), 1)),
    setPaintProperty: vi.fn(),
  };
};


// ─── Suite ─────────────────────────────────────────────────────────────────────

describe('FogOverlay', () => {
  let mockMap: any;
  let mockContext: MockCanvasRenderingContext2D;
  let wrapper: VueWrapper<any>;

  beforeEach(() => {
    mockMap     = makeMap();
    mockContext = new MockCanvasRenderingContext2D();

    (HTMLCanvasElement.prototype.getContext as any) = (type: string) =>
      type === '2d' ? mockContext : null;

    Object.defineProperty(HTMLElement.prototype, 'clientWidth',  { configurable: true, value: 1920 });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 1080 });
  });

  afterEach(async () => {
    await wrapper?.unmount();
    vi.clearAllMocks();
    vi.restoreAllMocks();
    mockContext.clearHistory();
  });

  // ── Rendering ─────────────────────────────────────────────────────────────

  describe('Rendering', () => {
    it('renders canvas element in gradient mode', () => {
      wrapper = mount(FogOverlay, { props: { map: mockMap, exploredCells: [], fogMode: 'gradient' } });
      expect(wrapper.find('canvas.fog-overlay').exists()).toBe(true);
    });

    it('canvas is hidden (v-show) in flat mode', () => {
      wrapper = mount(FogOverlay, { props: { map: mockMap, exploredCells: [], fogMode: 'flat' } });
      const canvas = wrapper.find('canvas').element as HTMLElement;
      expect(canvas.style.display).toBe('none');
    });

    it('applies default props', () => {
      wrapper = mount(FogOverlay, { props: { map: mockMap, exploredCells: [] } });
      expect(wrapper.props('opacity')).toBe(1);
      expect(wrapper.props('color')).toBe('#1a1a1a');
    });

    it('accepts custom opacity', () => {
      wrapper = mount(FogOverlay, { props: { map: mockMap, exploredCells: [], opacity: 0.5 } });
      expect(wrapper.props('opacity')).toBe(0.5);
    });

    it('accepts custom color', () => {
      wrapper = mount(FogOverlay, { props: { map: mockMap, exploredCells: [], color: '#ff0000' } });
      expect(wrapper.props('color')).toBe('#ff0000');
    });

    it('exposes draw method', () => {
      wrapper = mount(FogOverlay, { props: { map: mockMap, exploredCells: [] } });
      expect(typeof wrapper.vm.draw).toBe('function');
    });
  });

  // ── Canvas Initialization (gradient mode) ─────────────────────────────────

  describe('Canvas Initialization', () => {
    it('gets 2d context on mount', async () => {
      const getContextSpy = vi.fn().mockReturnValue(mockContext);
      HTMLCanvasElement.prototype.getContext = getContextSpy;

      wrapper = mount(FogOverlay, { props: { map: mockMap, exploredCells: [], fogMode: 'gradient' } });
      await wrapper.vm.$nextTick();

      expect(getContextSpy).toHaveBeenCalledWith('2d');
    });

    it('resizes canvas to client dimensions on mount', async () => {
      wrapper = mount(FogOverlay, { props: { map: mockMap, exploredCells: [], fogMode: 'gradient' } });
      await wrapper.vm.$nextTick();

      const canvas = wrapper.find('canvas').element as HTMLCanvasElement;
      expect(canvas.width).toBe(1920);
      expect(canvas.height).toBe(1080);
    });

    it('adds resize event listener on mount', async () => {
      const spy = vi.spyOn(window, 'addEventListener');
      wrapper = mount(FogOverlay, { props: { map: mockMap, exploredCells: [], fogMode: 'gradient' } });
      await wrapper.vm.$nextTick();

      expect(spy).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('removes resize event listener on unmount', async () => {
      const spy = vi.spyOn(window, 'removeEventListener');
      wrapper = mount(FogOverlay, { props: { map: mockMap, exploredCells: [], fogMode: 'gradient' } });
      await wrapper.vm.$nextTick();
      await wrapper.unmount();

      expect(spy).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    it('updates canvas dimensions on window resize', async () => {
      wrapper = mount(FogOverlay, { props: { map: mockMap, exploredCells: [], fogMode: 'gradient' } });
      await wrapper.vm.$nextTick();

      Object.defineProperty(HTMLElement.prototype, 'clientWidth',  { configurable: true, value: 1280 });
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 720  });
      window.dispatchEvent(new Event('resize'));
      await wrapper.vm.$nextTick();

      const canvas = wrapper.find('canvas').element as HTMLCanvasElement;
      expect(canvas.width).toBe(1280);
      expect(canvas.height).toBe(720);
    });

    it('registers render event listener on map in gradient mode', async () => {
      wrapper = mount(FogOverlay, { props: { map: mockMap, exploredCells: [], fogMode: 'gradient' } });
      await wrapper.vm.$nextTick();

      expect(mockMap.on).toHaveBeenCalledWith('render', expect.any(Function));
    });

    it('deregisters render event listener on unmount', async () => {
      wrapper = mount(FogOverlay, { props: { map: mockMap, exploredCells: [], fogMode: 'gradient' } });
      await wrapper.vm.$nextTick();
      await wrapper.unmount();

      expect(mockMap.off).toHaveBeenCalledWith('render', expect.any(Function));
    });
  });

  // ── Drawing Operations (gradient mode) ────────────────────────────────────

  describe('Drawing Operations', () => {
    it('clears canvas when drawing', async () => {
      wrapper = mount(FogOverlay, { props: { map: mockMap, exploredCells: [], fogMode: 'gradient' } });
      await wrapper.vm.$nextTick();

      wrapper.vm.draw();

      expect(mockContext.getCallsByMethod('clearRect').length).toBeGreaterThan(0);
    });

    it('fills canvas with background color', async () => {
      wrapper = mount(FogOverlay, {
        props: { map: mockMap, exploredCells: [], color: '#1a1a1a', opacity: 0.85, fogMode: 'gradient' },
      });
      await wrapper.vm.$nextTick();

      wrapper.vm.draw();

      const calls = mockContext.getCallsByMethod('fillRect');
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0].args).toEqual([0, 0, 1920, 1080]);
    });

    it('sets fillStyle with hexToRgba conversion', async () => {
      const { hexToRgba } = await import('@/utils/color');
      wrapper = mount(FogOverlay, {
        props: { map: mockMap, exploredCells: [], color: '#1a1a1a', opacity: 0.85, fogMode: 'gradient' },
      });
      await wrapper.vm.$nextTick();

      wrapper.vm.draw();

      expect(hexToRgba).toHaveBeenCalledWith('#1a1a1a', expect.any(Number));
    });

    it('uses destination-out composite operation when explored cells are present', async () => {
      wrapper = mount(FogOverlay, {
        props: { map: mockMap, exploredCells: ['test-cell'], fogMode: 'gradient' },
      });
      await wrapper.vm.$nextTick();

      wrapper.vm.draw();

      expect(mockContext.globalCompositeOperation).toBe('destination-out');
    });

    it('saves and restores context state', async () => {
      wrapper = mount(FogOverlay, { props: { map: mockMap, exploredCells: [], fogMode: 'gradient' } });
      await wrapper.vm.$nextTick();

      wrapper.vm.draw();

      expect(mockContext.getCallsByMethod('save').length).toBeGreaterThan(0);
      expect(mockContext.getCallsByMethod('restore').length).toBeGreaterThan(0);
    });
  });

  // ── S2 Cell Drawing (gradient mode) ───────────────────────────────────────

  describe('S2 Cell Drawing', () => {
    it('draws S2 cells from exploredCells prop', async () => {
      wrapper = mount(FogOverlay, {
        props: { map: mockMap, exploredCells: ['4789459f'], fogMode: 'gradient' },
      });
      await wrapper.vm.$nextTick();

      wrapper.vm.draw();

      expect(mockContext.getCallsByMethod('beginPath').length).toBeGreaterThan(0);
    });

    it('closes path after drawing cell boundary', async () => {
      wrapper = mount(FogOverlay, {
        props: { map: mockMap, exploredCells: ['test-cell'], fogMode: 'gradient' },
      });
      await wrapper.vm.$nextTick();

      wrapper.vm.draw();

      expect(mockContext.getCallsByMethod('closePath').length).toBeGreaterThan(0);
    });

    it('fills cell with black color', async () => {
      wrapper = mount(FogOverlay, {
        props: { map: mockMap, exploredCells: ['test-cell'], fogMode: 'gradient' },
      });
      await wrapper.vm.$nextTick();

      wrapper.vm.draw();

      expect(mockContext.getCallsByMethod('fill').length).toBeGreaterThan(0);
    });

    it('skips invalid cells that throw on construction', async () => {
      const { cellToVertices } = await import('@/utils/s2Utils');
      vi.mocked(cellToVertices).mockImplementationOnce(() => { throw new Error('invalid cell'); });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      wrapper = mount(FogOverlay, {
        props: { map: mockMap, exploredCells: ['invalid'], fogMode: 'gradient' },
      });
      await wrapper.vm.$nextTick();

      wrapper.vm.draw();

      expect(warnSpy).toHaveBeenCalledWith('[FogOverlay] Invalid S2 cell token: invalid');
      warnSpy.mockRestore();
    });

    it('draws multiple cells', async () => {
      wrapper = mount(FogOverlay, {
        props: { map: mockMap, exploredCells: ['cell-1', 'cell-2'], fogMode: 'gradient' },
      });
      await wrapper.vm.$nextTick();

      wrapper.vm.draw();

      expect(mockContext.getCallsByMethod('beginPath').length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Reactivity ────────────────────────────────────────────────────────────

  describe('Reactivity', () => {
    it('redraws when exploredCells prop changes', async () => {
      wrapper = mount(FogOverlay, {
        props: { map: mockMap, exploredCells: [], fogMode: 'gradient' },
      });
      await wrapper.vm.$nextTick();
      mockContext.clearHistory();

      await wrapper.setProps({ exploredCells: ['new-cell'] });
      await wrapper.vm.$nextTick();

      expect(mockContext.getCallsByMethod('clearRect').length).toBeGreaterThan(0);
    });

    it('redraws when opacity changes', async () => {
      wrapper = mount(FogOverlay, {
        props: { map: mockMap, exploredCells: [], opacity: 0.5, fogMode: 'gradient' },
      });
      await wrapper.vm.$nextTick();
      mockContext.clearHistory();

      await wrapper.setProps({ opacity: 0.75 });
      await wrapper.vm.$nextTick();

      expect(mockContext.getCallsByMethod('fillRect').length).toBeGreaterThan(0);
    });

    it('redraws when color changes', async () => {
      wrapper = mount(FogOverlay, {
        props: { map: mockMap, exploredCells: [], color: '#000000', fogMode: 'gradient' },
      });
      await wrapper.vm.$nextTick();
      mockContext.clearHistory();

      await wrapper.setProps({ color: '#ffffff' });
      await wrapper.vm.$nextTick();

      expect(mockContext.getCallsByMethod('fillRect').length).toBeGreaterThan(0);
    });

    it('redraws when map changes', async () => {
      wrapper = mount(FogOverlay, {
        props: { map: mockMap, exploredCells: [], fogMode: 'gradient' },
      });
      await wrapper.vm.$nextTick();
      mockContext.clearHistory();

      const newMap = makeMap();
      await wrapper.setProps({ map: newMap });
      await wrapper.vm.$nextTick();

      // New map is registered; emit render to verify the draw callback is wired up.
      newMap.emit('render');
      expect(mockContext.getCallsByMethod('fillRect').length).toBeGreaterThan(0);
    });
  });

  // ── Manual Draw Method ────────────────────────────────────────────────────

  describe('Manual Draw Method', () => {
    it('clears and redraws when called manually', async () => {
      wrapper = mount(FogOverlay, { props: { map: mockMap, exploredCells: [], fogMode: 'gradient' } });
      await wrapper.vm.$nextTick();
      mockContext.clearHistory();

      wrapper.vm.draw();

      expect(mockContext.getCallsByMethod('clearRect').length).toBe(1);
    });

    it('does nothing without map', async () => {
      wrapper = mount(FogOverlay, {
        props: { map: undefined, exploredCells: ['test-cell'], fogMode: 'gradient' },
      });
      await wrapper.vm.$nextTick();

      wrapper.vm.draw();

      expect(mockContext.getCallsByMethod('clearRect').length).toBe(0);
    });

    it('does nothing without context', async () => {
      HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);
      wrapper = mount(FogOverlay, {
        props: { map: mockMap, exploredCells: ['test-cell'], fogMode: 'gradient' },
      });
      await wrapper.vm.$nextTick();
      mockContext.clearHistory();

      wrapper.vm.draw();

      expect(mockContext.getCallsByMethod('clearRect').length).toBe(0);
    });

    it('does nothing in flat mode', async () => {
      wrapper = mount(FogOverlay, {
        props: { map: mockMap, exploredCells: ['test-cell'], fogMode: 'flat' },
      });
      await wrapper.vm.$nextTick();
      await new Promise(r => setTimeout(r, 0));
      mockContext.clearHistory();

      wrapper.vm.draw();

      expect(mockContext.getCallsByMethod('clearRect').length).toBe(0);
    });
  });

  // ── Flat mode: MapLibre layers ────────────────────────────────────────────

  describe('Flat mode', () => {
    it('adds fog-mask source in flat mode', async () => {
      wrapper = mount(FogOverlay, { props: { map: mockMap, exploredCells: [], fogMode: 'flat' } });
      await new Promise(r => setTimeout(r, 0));

      expect(mockMap.addSource).toHaveBeenCalledWith('fog-mask', expect.objectContaining({ type: 'geojson' }));
    });

    it('adds fog-flat-fill fill layer in flat mode', async () => {
      wrapper = mount(FogOverlay, { props: { map: mockMap, exploredCells: [], fogMode: 'flat' } });
      await new Promise(r => setTimeout(r, 0));

      expect(mockMap.addLayer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'fog-flat-fill', type: 'fill', source: 'fog-mask' }),
      );
    });

    it('does NOT register render listener in flat mode', async () => {
      wrapper = mount(FogOverlay, { props: { map: mockMap, exploredCells: [], fogMode: 'flat' } });
      await new Promise(r => setTimeout(r, 0));

      const renderCalls = mockMap.on.mock.calls.filter((c: any[]) => c[0] === 'render');
      expect(renderCalls).toHaveLength(0);
    });

    it('updates source data when exploredCells changes in flat mode', async () => {
      wrapper = mount(FogOverlay, { props: { map: mockMap, exploredCells: [], fogMode: 'flat' } });
      await new Promise(r => setTimeout(r, 0));

      const source = mockMap.getSource('fog-mask')!;
      const callsBefore = source.setData.mock.calls.length;

      await wrapper.setProps({ exploredCells: ['cell-1'] });
      await wrapper.vm.$nextTick();

      expect(source.setData.mock.calls.length).toBeGreaterThan(callsBefore);
    });

    it('calls setPaintProperty when opacity changes in flat mode', async () => {
      wrapper = mount(FogOverlay, {
        props: { map: mockMap, exploredCells: [], fogMode: 'flat', opacity: 0.9 },
      });
      await new Promise(r => setTimeout(r, 0));

      await wrapper.setProps({ opacity: 0.5 });
      await wrapper.vm.$nextTick();

      expect(mockMap.setPaintProperty).toHaveBeenCalledWith('fog-flat-fill', 'fill-opacity', 0.5);
    });

    it('calls setPaintProperty when color changes in flat mode', async () => {
      wrapper = mount(FogOverlay, {
        props: { map: mockMap, exploredCells: [], fogMode: 'flat', color: '#1a1a1a' },
      });
      await new Promise(r => setTimeout(r, 0));

      await wrapper.setProps({ color: '#ff0000' });
      await wrapper.vm.$nextTick();

      expect(mockMap.setPaintProperty).toHaveBeenCalledWith('fog-flat-fill', 'fill-color', '#ff0000');
    });

    it('removes layer and source on unmount in flat mode', async () => {
      wrapper = mount(FogOverlay, { props: { map: mockMap, exploredCells: [], fogMode: 'flat' } });
      await new Promise(r => setTimeout(r, 0));
      await wrapper.unmount();

      expect(mockMap.removeLayer).toHaveBeenCalledWith('fog-flat-fill');
      expect(mockMap.removeSource).toHaveBeenCalledWith('fog-mask');
    });
  });
});
