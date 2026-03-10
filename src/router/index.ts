import { createRouter, createWebHistory } from "@ionic/vue-router";
import { RouteRecordRaw } from "vue-router";
import FogPage from "../views/FogPage.vue";
import MapPage from "../views/MapPage.vue";

const routes: Array<RouteRecordRaw> = [
    {
        path: "/",
        redirect: "/fog",
    },
    {
        path: "/fog",
        name: "Fog",
        component: FogPage,
    },
    {
        path: "/map",
        name: "Map",
        component: MapPage,
    },
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
});

export default router;
