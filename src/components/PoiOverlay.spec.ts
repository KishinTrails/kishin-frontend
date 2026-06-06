import { mount, VueWrapper } from '@vue/test-utils';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PoiOverlay from '@/components/PoiOverlay.vue';

type CellTypeKey = 'peak' | 'natural' | 'industrial';

// ─── Mock map factory ─────────────────────────────────────────────────────────

const makeMap = () => {
  const images = new Map<string, unknown>();
  const sources = new Map<string, { setData: ReturnType<typeof vi.fn> }>();
  const layers: string[] = [];
  const listeners = new Map<string, Array<() => void>>();

  return {
    loadImage: vi.fn().mockResolvedValue({ data: {} }),
    addImage:  vi.fn((id: string, data: unknown) => images.set(id, data)),
    hasImage:  vi.fn((id: string) => images.has(id)),
    removeImage: vi.fn((id: string) => images.delete(id)),

    addSource:    vi.fn((id: string) => sources.set(id, { setData: vi.fn() })),
    getSource:    vi.fn((id: string) => sources.get(id)),
    removeSource: vi.fn((id: string) => sources.delete(id)),

    addLayer:    vi.fn((l: { id: string }) => layers.push(l.id)),
    getLayer:    vi.fn((id: string) => (layers.includes(id) ? {} : undefined)),
    removeLayer: vi.fn((id: string) => layers.splice(layers.indexOf(id), 1)),

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
  };
};

type MockMap = ReturnType<typeof makeMap>;

// ─── Mount helper ─────────────────────────────────────────────────────────────

const mountOverlay = async (props: {
  map?: MockMap;
  cellTypes: Map<string, CellTypeKey>;
  visibleCells: string[];
}) => {
  const wrapper = mount(PoiOverlay, { props: props as any });
  await wrapper.vm.$nextTick();
  // Flush micro-tasks so async setupLayers / loadImages resolves.
  await new Promise(r => setTimeout(r, 0));
  return wrapper;
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('PoiOverlay', () => {
  let mockMap: MockMap;
  let wrapper: VueWrapper<any>;

  beforeEach(() => { mockMap = makeMap(); });

  afterEach(async () => {
    await wrapper?.unmount();
    vi.clearAllMocks();
  });

  // ── Template ──────────────────────────────────────────────────────────────

  describe('Template', () => {
    it('renders no DOM element', async () => {
      wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });
      expect(wrapper.find('canvas').exists()).toBe(false);
    });

    it('does not expose a draw method', async () => {
      wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });
      expect((wrapper.vm as any).draw).toBeUndefined();
    });
  });

  // ── Source and layer registration ─────────────────────────────────────────

  describe('Layer setup', () => {
    it('adds the poi-cells GeoJSON source when map is provided', async () => {
      wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });
      expect(mockMap.addSource).toHaveBeenCalledWith('poi-cells', expect.objectContaining({ type: 'geojson' }));
    });

    it('adds the poi-icons symbol layer', async () => {
      wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });
      expect(mockMap.addLayer).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'poi-icons', type: 'symbol', source: 'poi-cells' }),
      );
    });

    it('does not add source or layers when map is undefined', async () => {
      wrapper = await mountOverlay({ map: undefined, cellTypes: new Map(), visibleCells: [] });
      expect(mockMap.addSource).not.toHaveBeenCalled();
      expect(mockMap.addLayer).not.toHaveBeenCalled();
    });
  });

  // ── Image loading ─────────────────────────────────────────────────────────

  describe('Image loading', () => {
    it('calls loadImage for all three icon URLs', async () => {
      wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });
      expect(mockMap.loadImage).toHaveBeenCalledWith('/tori.png');
      expect(mockMap.loadImage).toHaveBeenCalledWith('/nature.png');
      expect(mockMap.loadImage).toHaveBeenCalledWith('/factory.png');
    });

    it('registers images with the correct ids', async () => {
      wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });
      expect(mockMap.addImage).toHaveBeenCalledWith('peak', expect.anything());
      expect(mockMap.addImage).toHaveBeenCalledWith('natural', expect.anything());
      expect(mockMap.addImage).toHaveBeenCalledWith('industrial', expect.anything());
    });

    it('skips loadImage for already-registered images', async () => {
      mockMap.hasImage.mockImplementation((id: string) => id === 'peak');
      wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });
      const urls = mockMap.loadImage.mock.calls.map((c: any[]) => c[0]);
      expect(urls).not.toContain('/tori.png');
      expect(urls).toContain('/nature.png');
      expect(urls).toContain('/factory.png');
    });
  });

  // ── GeoJSON data ──────────────────────────────────────────────────────────

  describe('GeoJSON source data', () => {
    it('calls setData with a FeatureCollection containing one feature per POI cell', async () => {
      const cellTypes = new Map<string, CellTypeKey>([['1', 'peak'], ['2', 'natural']]);
      wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: ['1', '2'] });

      const source = mockMap.getSource('poi-cells');
      const call = source!.setData.mock.calls[source!.setData.mock.calls.length - 1]![0];
      expect(call.type).toBe('FeatureCollection');
      expect(call.features).toHaveLength(2);
    });

    it('sets the cellType property on each feature', async () => {
      const cellTypes = new Map<string, CellTypeKey>([['1', 'peak']]);
      wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: ['1'] });

      const source = mockMap.getSource('poi-cells');
      const call = source!.setData.mock.calls[source!.setData.mock.calls.length - 1]![0];
      expect(call.features[0].properties.cellType).toBe('peak');
    });

    it('produces Polygon geometry', async () => {
      const cellTypes = new Map<string, CellTypeKey>([['1', 'peak']]);
      wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: ['1'] });

      const source = mockMap.getSource('poi-cells');
      const call = source!.setData.mock.calls[source!.setData.mock.calls.length - 1]![0];
      expect(call.features[0].geometry.type).toBe('Polygon');
    });

    it('closes the polygon ring (first === last coordinate)', async () => {
      const cellTypes = new Map<string, CellTypeKey>([['1', 'peak']]);
      wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: ['1'] });

      const source = mockMap.getSource('poi-cells');
      const ring: number[][] = source!.setData.mock.calls[source!.setData.mock.calls.length - 1]![0].features[0].geometry.coordinates[0];
      expect(ring.at(-1)).toEqual(ring[0]);
    });

    it('uses [lng, lat] coordinate order', async () => {
      const cellTypes = new Map<string, CellTypeKey>([['1', 'peak']]);
      wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: ['1'] });

      const source = mockMap.getSource('poi-cells');
      const ring: number[][] = source!.setData.mock.calls[source!.setData.mock.calls.length - 1]![0].features[0].geometry.coordinates[0];
      // Longitude is the first element; for reasonable coordinates lng is in [-180, 180]
      // and lat in [-90, 90]. Cell token "1" is a valid S2 token near the equator.
      ring.slice(0, -1).forEach(coord => {
        expect(coord).toHaveLength(2);
        expect(Math.abs(coord[0])).toBeLessThanOrEqual(180); // lng
        expect(Math.abs(coord[1])).toBeLessThanOrEqual(90);  // lat
      });
    });

    it('skips cells absent from cellTypes', async () => {
      wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: ['1'] });

      const source = mockMap.getSource('poi-cells');
      const call = source!.setData.mock.calls[source!.setData.mock.calls.length - 1]![0];
      expect(call.features).toHaveLength(0);
    });

    it('skips cells with invalid S2 tokens', async () => {
      const cellTypes = new Map<string, CellTypeKey>([['not-a-valid-token', 'peak']]);
      wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: ['not-a-valid-token'] });

      const source = mockMap.getSource('poi-cells');
      const call = source!.setData.mock.calls[source!.setData.mock.calls.length - 1]![0];
      expect(call.features).toHaveLength(0);
    });

    it('only includes visibleCells, not all entries in cellTypes', async () => {
      const cellTypes = new Map<string, CellTypeKey>([['1', 'peak'], ['2', 'natural']]);
      wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: ['1'] });

      const source = mockMap.getSource('poi-cells');
      const call = source!.setData.mock.calls[source!.setData.mock.calls.length - 1]![0];
      expect(call.features).toHaveLength(1);
    });
  });

  // ── Reactivity ────────────────────────────────────────────────────────────

  describe('Reactivity', () => {
    it('calls setData when visibleCells changes', async () => {
      const cellTypes = new Map<string, CellTypeKey>([['1', 'peak']]);
      wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: [] });

      const source = mockMap.getSource('poi-cells');
      const callsBefore = source!.setData.mock.calls.length;

      await wrapper.setProps({ visibleCells: ['1'] });
      await wrapper.vm.$nextTick();

      expect(source!.setData.mock.calls.length).toBeGreaterThan(callsBefore);
      const latest = source!.setData.mock.calls[source!.setData.mock.calls.length - 1]![0];
      expect(latest.features).toHaveLength(1);
    });

    it('calls setData with empty features when visibleCells becomes empty', async () => {
      const cellTypes = new Map<string, CellTypeKey>([['1', 'peak']]);
      wrapper = await mountOverlay({ map: mockMap, cellTypes, visibleCells: ['1'] });

      await wrapper.setProps({ visibleCells: [] });
      await wrapper.vm.$nextTick();

      const source = mockMap.getSource('poi-cells');
      const latest = source!.setData.mock.calls[source!.setData.mock.calls.length - 1]![0];
      expect(latest.features).toHaveLength(0);
    });
  });

  // ── Style reload ──────────────────────────────────────────────────────────

  describe('Style reload', () => {
    it('re-registers source and layers after styledata event', async () => {
      wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });

      // Simulate setStyle() clearing everything
      mockMap.getSource.mockReturnValue(undefined);
      mockMap.getLayer.mockReturnValue(undefined);
      mockMap.hasImage.mockReturnValue(false);
      mockMap.addSource.mockClear();
      mockMap.addLayer.mockClear();
      mockMap.loadImage.mockClear();

      mockMap.emit('styledata');
      await new Promise(r => setTimeout(r, 0));

      expect(mockMap.addSource).toHaveBeenCalledWith('poi-cells', expect.anything());
      expect(mockMap.addLayer).toHaveBeenCalledTimes(1);
      expect(mockMap.loadImage).toHaveBeenCalledTimes(3);
    });

    it('listens to styledata event on map arrival', async () => {
      wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });
      expect(mockMap.on).toHaveBeenCalledWith('styledata', expect.any(Function));
    });
  });

  // ── Teardown ──────────────────────────────────────────────────────────────

  describe('Teardown', () => {
    it('removes layers and source on unmount', async () => {
      wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });
      await wrapper.unmount();

      expect(mockMap.removeLayer).toHaveBeenCalledWith('poi-icons');
      expect(mockMap.removeSource).toHaveBeenCalledWith('poi-cells');
    });

    it('removes registered images on unmount', async () => {
      wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });
      await wrapper.unmount();

      expect(mockMap.removeImage).toHaveBeenCalledWith('peak');
      expect(mockMap.removeImage).toHaveBeenCalledWith('natural');
      expect(mockMap.removeImage).toHaveBeenCalledWith('industrial');
    });

    it('deregisters the styledata listener on unmount', async () => {
      wrapper = await mountOverlay({ map: mockMap, cellTypes: new Map(), visibleCells: [] });
      await wrapper.unmount();

      expect(mockMap.off).toHaveBeenCalledWith('styledata', expect.any(Function));
    });
  });
});
