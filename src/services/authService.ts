/**
 * Authentication service for the Kishin frontend.
 * Handles login/logout, JWT token storage, and authentication state.
 */

import { clearCache } from "./cacheService";

const TOKEN_KEY = "kishin_token";

const API_BASE = `${import.meta.env.VITE_API_BASE}/auth`;

/**
 * Response from the login API endpoint.
 */
export interface LoginResponse {
    access_token: string;
    token_type: string;
}

/**
 * Authenticate user with username and password.
 * Stores the JWT token in localStorage upon successful login.
 *
 * @param username - User's username
 * @param password - User's password
 * @throws Error if login fails (invalid credentials, network error)
 */
export async function login(username: string, password: string): Promise<void> {
    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Login failed" }));
        throw new Error(error.detail || "Login failed");
    }

    const data: LoginResponse = await response.json();
    localStorage.setItem(TOKEN_KEY, data.access_token);
}

/** Called after a 401 from the API; the router sets it to go to the login page. */
let unauthorizedHandler: () => void = () => {};

/**
 * Sets what happens after the API refuses the token (a 401), once the token is deleted.
 *
 * @param handler - Called with no argument, such as a navigation to /login
 */
export function setUnauthorizedHandler(handler: () => void): void {
    unauthorizedHandler = handler;
}

/**
 * Deletes the token and calls the unauthorized handler when the API answered 401.
 * The API refuses a token after it expires, after a password change and after a
 * SECRET_KEY rotation; without this the app would keep a token it cannot use.
 * Not for `/auth/login`, whose 401 means a wrong username or password.
 *
 * @param response - A response from a protected API route
 * @returns True when the response was a 401
 */
export function handleUnauthorized(response: Response): boolean {
    if (response.status !== 401) return false;
    logout();
    unauthorizedHandler();
    return true;
}

/**
 * Log out the current user by removing the JWT token and clearing the POI cache.
 */
export function logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    clearCache();
}

/**
 * Retrieve the JWT token from localStorage.
 *
 * @returns The JWT token string, or null if not found.
 */
export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

/**
 * The expiry of a JWT, read from its payload without checking the signature.
 * The server checks the signature; the app only needs to know when to ask for
 * a new login.
 *
 * @param token - The JWT
 * @returns Milliseconds since 1970-01-01, or null when the token has no readable `exp`
 */
export function tokenExpiry(token: string): number | null {
    const payload = token.split(".")[1];
    if (!payload) return null;
    try {
        const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
        const claims = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
        return typeof claims.exp === "number" ? claims.exp * 1000 : null;
    } catch {
        return null;
    }
}

/**
 * Whether the stored token expires within the given time, or has no readable expiry.
 *
 * @param milliseconds - How far ahead to look
 * @returns True when there is no token, it has no readable `exp`, or `exp` is within that time
 */
export function tokenExpiresWithin(milliseconds: number): boolean {
    const token = getToken();
    const expiry = token ? tokenExpiry(token) : null;
    return expiry === null || expiry - Date.now() <= milliseconds;
}

/**
 * Check if a user is currently authenticated.
 *
 * @returns True if a token exists in localStorage and has not expired, false otherwise.
 */
export function isAuthenticated(): boolean {
    return !tokenExpiresWithin(0);
}
