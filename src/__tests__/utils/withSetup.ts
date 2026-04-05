import { createApp, defineComponent } from "vue";

/**
 * withSetup — runs a composable inside a real Vue app instance.
 *
 * This is necessary because composables that use lifecycle hooks (onMounted,
 * onUnmounted, etc.) must be called inside a component setup context.
 * Without this wrapper, vitest would throw:
 *   "onUnmounted is called when there is no active component instance."
 *
 * Usage:
 *   const { result, unmount } = withSetup(useTrailMap);
 *   expect(result.visitedCells.value.size).toBe(0);
 *   unmount(); // triggers onUnmounted hooks
 *
 * @param composable - The composable function to test.
 * @returns { result, unmount } where result is the composable's return value.
 */
export function withSetup<T>(composable: () => T): { result: T; unmount: () => void } {
    let result!: T;

    const app = createApp(
        defineComponent({
            setup() {
                result = composable();
                // Suppress Vue's "Component is missing template" warning
                return () => null;
            },
        }),
    );

    const root = document.createElement("div");
    app.mount(root);

    return {
        result,
        unmount: () => app.unmount(),
    };
}
