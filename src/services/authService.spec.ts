import { describe, it, expect, beforeEach, vi } from "vitest";
import { login, logout, getToken, isAuthenticated, tokenExpiry, tokenExpiresWithin } from "./authService";

/**
 * An unsigned JWT with the given claims; only the payload is read by the app.
 *
 * @param claims - The payload
 * @returns header.payload.signature
 */
function jwt(claims: Record<string, unknown>): string {
    const encode = (value: object) =>
        btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}.signature`;
}

const HOUR_MS = 3_600_000;
const inHours = (hours: number) => Math.floor((Date.now() + hours * HOUR_MS) / 1000);

describe("authService", () => {
    let mockFetch: ReturnType<typeof vi.fn>;
    let mockLocalStorage: {
        getItem: ReturnType<typeof vi.fn>;
        setItem: ReturnType<typeof vi.fn>;
        removeItem: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        // Setup mock localStorage
        mockLocalStorage = {
            getItem: vi.fn().mockReturnValue(null),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        };
        vi.stubGlobal("localStorage", mockLocalStorage);

        // Setup mock fetch
        mockFetch = vi.fn();
        vi.stubGlobal("fetch", mockFetch);
    });

    describe("login", () => {
        it("should store token in localStorage on successful login", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ access_token: "mock-token-123", token_type: "bearer" }),
            });

            await login("testuser", "password123");

            expect(mockLocalStorage.setItem).toHaveBeenCalledWith("kishin_token", "mock-token-123");
        });

        it("should throw error on failed login (401)", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: async () => ({ detail: "Invalid credentials" }),
            });

            await expect(login("testuser", "wrongpassword")).rejects.toThrow("Invalid credentials");
        });

        it('should throw "Login failed" when error.detail is falsy', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => ({ detail: "" }),
            });

            await expect(login("testuser", "password")).rejects.toThrow("Login failed");
        });

        it("should propagate network errors as-is", async () => {
            mockFetch.mockRejectedValueOnce(new Error("Network error"));

            await expect(login("testuser", "password")).rejects.toThrow("Network error");
        });

        it('should fallback to "Login failed" on invalid JSON response', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 400,
                json: async () => {
                    throw new Error("Invalid JSON");
                },
            });

            await expect(login("testuser", "password")).rejects.toThrow("Login failed");
        });

        it("should send correct request body", async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ access_token: "token", token_type: "bearer" }),
            });

            await login("myuser", "mypassword");

            const [url, options] = mockFetch.mock.calls[0];
            expect(url).toContain("/auth/login");
            expect(options).toEqual(
                expect.objectContaining({
                    method: "POST",
                    headers: expect.objectContaining({
                        "Content-Type": "application/x-www-form-urlencoded",
                    }),
                }),
            );
        });
    });

    describe("logout", () => {
        it("should remove token from localStorage", () => {
            logout();

            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("kishin_token");
        });

        it("should call removeItem with correct key", () => {
            logout();

            expect(mockLocalStorage.removeItem).toHaveBeenCalledWith("kishin_token");
        });
    });

    describe("getToken", () => {
        it("should return token string when token exists", () => {
            mockLocalStorage.getItem.mockReturnValue("existing-token");

            const result = getToken();

            expect(result).toBe("existing-token");
        });

        it("should return null when no token exists", () => {
            mockLocalStorage.getItem.mockReturnValue(null);

            const result = getToken();

            expect(result).toBeNull();
        });

        it("should call localStorage.getItem with correct key", () => {
            getToken();

            expect(mockLocalStorage.getItem).toHaveBeenCalledWith("kishin_token");
        });
    });

    describe("isAuthenticated", () => {
        it("should return true when the token has not expired", () => {
            mockLocalStorage.getItem.mockReturnValue(jwt({ sub: "foo", exp: inHours(1) }));

            expect(isAuthenticated()).toBe(true);
        });

        it("should return false when the token has expired", () => {
            mockLocalStorage.getItem.mockReturnValue(jwt({ sub: "foo", exp: inHours(-1) }));

            expect(isAuthenticated()).toBe(false);
        });

        it("should return false when the token is not a JWT", () => {
            mockLocalStorage.getItem.mockReturnValue("some-token");

            expect(isAuthenticated()).toBe(false);
        });

        it("should return false when no token exists", () => {
            mockLocalStorage.getItem.mockReturnValue(null);

            const result = isAuthenticated();

            expect(result).toBe(false);
        });

        it("should return false when token is empty string", () => {
            mockLocalStorage.getItem.mockReturnValue("");

            const result = isAuthenticated();

            expect(result).toBe(false);
        });
    });

    describe("tokenExpiry", () => {
        it("should read exp in milliseconds", () => {
            expect(tokenExpiry(jwt({ exp: 1_800_000_000 }))).toBe(1_800_000_000_000);
        });

        it("should return null without exp", () => {
            expect(tokenExpiry(jwt({ sub: "foo" }))).toBeNull();
        });

        it("should return null for an unreadable payload", () => {
            expect(tokenExpiry("a.%%%.c")).toBeNull();
        });
    });

    describe("tokenExpiresWithin", () => {
        it("should be true when exp is within the time", () => {
            mockLocalStorage.getItem.mockReturnValue(jwt({ exp: inHours(23) }));

            expect(tokenExpiresWithin(24 * HOUR_MS)).toBe(true);
        });

        it("should be false when exp is later", () => {
            mockLocalStorage.getItem.mockReturnValue(jwt({ exp: inHours(25) }));

            expect(tokenExpiresWithin(24 * HOUR_MS)).toBe(false);
        });

        it("should be true without a token", () => {
            expect(tokenExpiresWithin(24 * HOUR_MS)).toBe(true);
        });
    });
});
