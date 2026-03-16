import { createRouter, createWebHistory } from "@ionic/vue-router";
import { RouteRecordRaw } from "vue-router";
import FogPage from "../views/FogPage.vue";
import MapPage from "../views/MapPage.vue";
import RectanglePage from "../views/RectanglePage.vue";
import LoginPage from "../views/LoginPage.vue";
import { isAuthenticated, logout } from "@/services/authService";

const routes: Array<RouteRecordRaw> = [
    {
        path: "/",
        redirect: "/fog",
    },
    {
        path: "/login",
        name: "Login",
        component: LoginPage,
    },
    {
        path: "/logout",
        name: "Logout",
        redirect: () => {
            logout();
            return "/login";
        },
    },
    {
        path: "/fog",
        name: "Fog",
        component: FogPage,
        meta: { requiresAuth: true },
    },
    {
        path: "/map",
        name: "Map",
        component: MapPage,
        meta: { requiresAuth: true },
    },
    {
        path: "/rectangles",
        name: "Rectangles",
        component: RectanglePage,
        meta: { requiresAuth: true },
    },
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
});

router.beforeEach((to, from, next) => {
    const requiresAuth = to.meta.requiresAuth;
    const isAuth = isAuthenticated();

    if (requiresAuth && !isAuth) {
        next('/login');
    } else if (to.path === '/login' && isAuth) {
        next('/fog');
    } else {
        next();
    }
});

export default router;
