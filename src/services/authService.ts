/**
 * Authentication service for the Kishin frontend.
 * Handles login/logout, JWT token storage, and authentication state.
 */

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

/**
 * Log out the current user by removing the JWT token from localStorage.
 */
export function logout(): void {
    localStorage.removeItem(TOKEN_KEY);
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
 * Check if a user is currently authenticated.
 *
 * @returns True if a valid token exists in localStorage, false otherwise.
 */
export function isAuthenticated(): boolean {
    return !!getToken();
}
