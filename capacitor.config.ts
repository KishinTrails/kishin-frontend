import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
    appId: "io.ionic.starter",
    appName: "kishin-frontend",
    webDir: "dist",
    server: {
        androidScheme: "https",
        // Important: allow cleartext traffic for map tiles
        cleartext: true,
    },
    android: {
        allowMixedContent: true,
    },
};

export default config;
