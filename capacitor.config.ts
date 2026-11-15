import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
    appId: "io.kishintrails.app",
    appName: "Kishin Trails",
    webDir: "dist",
    server: {
        androidScheme: "https",
    },
    plugins: {
        CapacitorHttp: {
            enabled: true, // patches fetch() to use native HTTP
        },
    },
};

export default config;
