/**
 * Vue Router configuration for Kishin frontend.
 *
 * Defines application routes with authentication protection for protected routes.
 * Uses Ionic Vue Router with history mode.
 */

import { createRouter, createWebHistory } from "@ionic/vue-router";
import { RouteRecordRaw } from "vue-router";
import MapPage from "../views/MapPage.vue";
import LoginPage from "../views/LoginPage.vue";
import AthletePage from "../views/AthletePage.vue";
import AthleteActivitiesPage from "../views/AthleteActivitiesPage.vue";
import AthleteBodyPage from "../views/AthleteBodyPage.vue";
import ActivityPage from "../views/ActivityPage.vue";
import PlanPage from "../views/PlanPage.vue";
import { isAuthenticated, logout, setUnauthorizedHandler } from "@/services/authService";

/**
 * Application route definitions.
 * Routes marked with `requiresAuth: true` redirect unauthenticated users to /login.
 * Authenticated users accessing /login are redirected to /map.
 */
const routes: Array<RouteRecordRaw> = [
    {
        path: "/",
        redirect: "/map",
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
        path: "/map",
        name: "Map",
        component: MapPage,
        meta: { requiresAuth: true },
    },
    {
        path: "/athlete",
        name: "Athlete",
        component: AthletePage,
        meta: { requiresAuth: true },
    },
    {
        path: "/athlete/body",
        name: "AthleteBody",
        component: AthleteBodyPage,
        meta: { requiresAuth: true },
    },
    {
        path: "/athlete/activities",
        name: "AthleteActivities",
        component: AthleteActivitiesPage,
        meta: { requiresAuth: true },
    },
    {
        path: "/athlete/activities/:id",
        name: "Activity",
        component: ActivityPage,
        meta: { requiresAuth: true },
    },
    {
        path: "/plan",
        name: "Plan",
        component: PlanPage,
        meta: { requiresAuth: true },
    },
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
});

/**
 * Navigation guard that enforces authentication on protected routes.
 * - Redirects unauthenticated users to /login when accessing protected routes
 * - Redirects authenticated users away from /login to /map
 */
router.beforeEach((to, from, next) => {
    const requiresAuth = to.meta.requiresAuth;
    const isAuth = isAuthenticated();

    if (requiresAuth && !isAuth) {
        next("/login");
    } else if (to.path === "/login" && isAuth) {
        next("/map");
    } else {
        next();
    }
});

// Ionic hides the page left behind with aria-hidden. The link clicked to leave it still has the
// focus, and a browser refuses to hide a focused element; taking the focus off fixes both.
router.afterEach(() => {
    (document.activeElement as HTMLElement | null)?.blur();
});

// When the API refuses the token, authService deletes it and the app returns to the login page.
setUnauthorizedHandler(() => {
    void router.replace("/login");
});

export default router;
