/// <reference types="vitest" />

import vue from "@vitejs/plugin-vue";
import path from "path";
import { defineConfig, loadEnv, type Plugin } from "vite";

/** Map tile and style servers the map pages load from. */
const MAP_HOSTS = ["https://tiles.openfreemap.org", "https://tile.openstreetmap.org"];

/**
 * The Content Security Policy of a production build.
 *
 * - Scripts come from the app only. MapLibre starts its worker from a `blob:` URL.
 * - Styles allow inline: Ionic and MapLibre set `style` attributes.
 * - Requests go to the app, the API and the map servers only.
 *
 * @param apiBase - `VITE_API_BASE`, whose origin the app sends its requests to
 * @returns The policy, one directive after another
 */
export function contentSecurityPolicy(apiBase: string): string {
    const api = apiBase ? new URL(apiBase).origin : "";
    return [
        "default-src 'self'",
        "script-src 'self'",
        "worker-src 'self' blob:",
        "child-src blob:",
        "style-src 'self' 'unsafe-inline'",
        `img-src 'self' data: blob: ${MAP_HOSTS.join(" ")}`,
        ["connect-src 'self'", api, ...MAP_HOSTS].filter(Boolean).join(" "),
        "font-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'none'",
    ].join("; ");
}

/**
 * Adds the policy to `index.html` in a production build, after the charset tag. The dev
 * server is left without it: Vite's client needs inline scripts and a websocket.
 *
 * On Android, Capacitor inserts its own inline script at the start of `<head>` when it serves
 * the page. A policy given in a `<meta>` tag applies only to what follows the tag, so that
 * script still runs.
 *
 * @param apiBase - `VITE_API_BASE` of the build
 * @returns The Vite plugin
 */
function contentSecurityPolicyPlugin(apiBase: string): Plugin {
    return {
        name: "kishin-content-security-policy",
        apply: "build",
        transformIndexHtml(html) {
            const tag = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy(apiBase)}" />`;
            return html.replace('<meta charset="utf-8" />', `<meta charset="utf-8" />\n    ${tag}`);
        },
    };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "VITE_");
    return {
        plugins: [vue(), contentSecurityPolicyPlugin(env.VITE_API_BASE ?? "")],
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
        build: {
            target: "es2020",
        },
        test: {
            globals: true,
            environment: "jsdom",
            setupFiles: ["./src/setupTests.ts"],
        },
    };
});
