<script setup lang="ts">
/**
 * PanelGroup.vue — One foldable group of the map panel: a header with the group's title and the
 * group's controls under it.
 * - Wide window: open by default. Whether each group is open is kept in localStorage under
 *   `kishin_panel_groups`, so it survives a reload; when localStorage cannot be read or
 *   written, the group opens and the choice is not kept.
 * - Narrow window (see `utils/screen.ts`): closed when the page opens, and localStorage is not
 *   read or written, so the wide-window state is kept apart.
 * Does not own: the controls themselves (default slot) or their styles.
 */
import { ref } from 'vue';
import { isNarrowScreen } from '@/utils/screen';

const STORAGE_KEY = 'kishin_panel_groups';

const props = defineProps<{
  /** Key of the group in the stored state. */
  id: string
  title: string
}>();

/**
 * The stored open/closed state of every group.
 *
 * @returns Group id → open; empty when nothing is stored or it cannot be read
 */
function readState(): Record<string, boolean> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

const narrow = isNarrowScreen();
const open = ref(narrow ? false : readState()[props.id] ?? true);

/**
 * Keeps the state after the user folds or unfolds the group (on a wide window only).
 *
 * @param event - The `toggle` event of the `<details>` element
 */
function onToggle(event: Event): void {
  open.value = (event.target as HTMLDetailsElement).open;
  if (narrow) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readState(), [props.id]: open.value }));
  } catch {
    // Storage is blocked (private window, previews): the group still folds, the choice is not kept.
  }
}
</script>

<template>
  <details
    class="panel-group"
    :open="open"
    @toggle="onToggle"
  >
    <summary>{{ title }}</summary>
    <div class="panel-group-body">
      <slot />
    </div>
  </details>
</template>

<style scoped>
.panel-group {
  border-top: 1px solid var(--c-divider);
}

summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 0;
  color: var(--c-text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  list-style: none;
  cursor: pointer;
  user-select: none;
}

summary::-webkit-details-marker {
  display: none;
}

summary::after {
  content: '';
  width: 6px;
  height: 6px;
  margin-right: 4px;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(45deg);
  transition: transform 0.15s;
}

.panel-group:not([open]) summary::after {
  transform: rotate(-45deg);
}

summary:hover {
  color: var(--c-text);
}

.panel-group-body {
  padding-bottom: 12px;
}
</style>
