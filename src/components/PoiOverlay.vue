<script setup lang="ts">
/**
 * POI overlay component — manages MapLibre GeoJSON source and layers for
 * point-of-interest icons on explored S2 cells.
 *
 * Renders entirely inside MapLibre's WebGL pipeline; this component has no DOM
 * element of its own. It does not own GPS tracking, cell exploration state, or
 * tile fetching — those live in useTrailMap / GpsTracker.
 */
import { watch, onUnmounted } from 'vue';
import type { Map as MaplibreMap, GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection, Feature, Polygon } from 'geojson';
import { tokenToCell, cellToVertices, isValidToken } from '@/utils/s2Utils';

/** Valid POI cell type categories. Matches the types defined in useTrailMap.ts. */
type CellTypeKey = 'peak' | 'natural' | 'industrial';

interface Props {
  /** MapLibre GL map instance used for source/layer management. */
  map?: MaplibreMap;
  /** Map from S2 cell token to its POI type. */
  cellTypes: Map<string, CellTypeKey>;
  /** S2 cell tokens that are currently within the viewport. */
  visibleCells: string[];
}

const props = defineProps<Props>();

const SOURCE_ID    = 'poi-cells';
const SYM_LAYER_ID = 'poi-icons';

const IMAGE_DEFS: Array<{ id: CellTypeKey; url: string }> = [
  { id: 'peak',       url: '/tori.png'    },
  { id: 'natural',    url: '/nature.png'  },
  { id: 'industrial', url: '/factory.png' },
];

/** Cached lat/lng vertices per cell token — S2 geometry never changes. */
const vertexCache = new Map<string, Array<{ lat: number; lng: number }>>();

/**
 * Builds a GeoJSON FeatureCollection of S2 cell polygons for all visible POI cells.
 *
 * @param visibleCells - S2 cell tokens currently in the viewport.
 * @param cellTypes    - Map from token to POI type.
 * @param cache        - Mutable vertex cache shared across calls.
 * @returns GeoJSON FeatureCollection with one Polygon feature per POI cell.
 */
function buildGeoJSON(
  visibleCells: string[],
  cellTypes: Map<string, CellTypeKey>,
  cache: Map<string, Array<{ lat: number; lng: number }>>,
): FeatureCollection<Polygon> {
  const features: Feature<Polygon>[] = [];

  for (const token of visibleCells) {
    const type = cellTypes.get(token);
    if (!type) continue;

    let verts = cache.get(token);
    if (!verts) {
      if (!isValidToken(token)) continue;
      try {
        verts = cellToVertices(tokenToCell(token));
        cache.set(token, verts);
      } catch {
        continue;
      }
    }

    // GeoJSON polygon rings must close: repeat the first vertex at the end.
    const ring = [...verts.map(v => [v.lng, v.lat] as [number, number])];
    ring.push(ring[0]);

    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: { cellType: type },
    });
  }

  return { type: 'FeatureCollection', features };
}

/**
 * Loads all three POI icon PNGs into MapLibre's image atlas.
 *
 * Must resolve before the symbol layer is added, otherwise MapLibre silently
 * skips icon rendering. The double `hasImage` guard makes this safe to call
 * multiple times (e.g. on style reloads).
 *
 * @param map - The MapLibre map instance.
 */
async function loadImages(map: MaplibreMap): Promise<void> {
  await Promise.all(
    IMAGE_DEFS.map(async ({ id, url }) => {
      if (map.hasImage(id)) return;
      const res = await map.loadImage(url);
      if (!map.hasImage(id)) map.addImage(id, res.data);
    }),
  );
}

/**
 * Pushes the current GeoJSON data to the MapLibre source.
 *
 * @param map - The MapLibre map instance.
 */
function updateSource(map: MaplibreMap): void {
  const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
  src?.setData(buildGeoJSON(props.visibleCells, props.cellTypes, vertexCache));
}

/**
 * Registers the GeoJSON source and symbol layer on the map.
 *
 * Idempotent: each resource is only added if absent, so this can be called
 * safely on style reloads without double-registration errors.
 *
 * @param map - The MapLibre map instance.
 */
async function setupLayers(map: MaplibreMap): Promise<void> {
  await loadImages(map);

  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  if (!map.getLayer(SYM_LAYER_ID)) {
    map.addLayer({
      id: SYM_LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      layout: {
        'symbol-placement': 'point',
        'icon-image': ['get', 'cellType'],
        'icon-allow-overlap': true,
        'icon-anchor': 'center',
        // Replicates the canvas formula: imgSize = 14 * 2^(zoom - 13).
        // icon-size is a multiplier of native image size (526 px).
        // At zoom 13: 14/526 ≈ 0.0266; doubles every zoom level (base 2).
        'icon-size': [
          'interpolate', ['exponential', 2], ['zoom'],
          13, 14 / 526,
          17, (14 / 526) * 16,
        ],
      },
    });
  }

  updateSource(map);
}

/**
 * Removes all POI layers, source, and registered images from the map.
 * Layers must be removed before their source per MapLibre's constraint.
 *
 * @param map - The MapLibre map instance.
 */
function teardown(map: MaplibreMap): void {
  map.off('styledata', onStyleData);
  if (map.getLayer(SYM_LAYER_ID)) map.removeLayer(SYM_LAYER_ID);
  if (map.getSource(SOURCE_ID))   map.removeSource(SOURCE_ID);
  IMAGE_DEFS.forEach(({ id }) => { if (map.hasImage(id)) map.removeImage(id); });
}

// `setStyle()` in MapPage.vue clears all sources, layers, and custom images.
// Re-register everything when the new style finishes loading.
const onStyleData = (): void => { if (props.map) setupLayers(props.map); };

watch(
  () => props.map,
  async (map, oldMap) => {
    if (oldMap) teardown(oldMap);
    if (!map) return;
    map.on('styledata', onStyleData);
    await setupLayers(map);
  },
  { immediate: true },
);

watch(
  () => [props.visibleCells, props.cellTypes] as const,
  () => { if (props.map) updateSource(props.map); },
  { deep: true },
);

onUnmounted(() => { if (props.map) teardown(props.map); });
</script>
