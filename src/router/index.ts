import { createRouter, createWebHistory } from "@ionic/vue-router";
import { RouteRecordRaw } from "vue-router";
import FogPage from "../views/FogPage.vue";

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
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
});

export default router;
