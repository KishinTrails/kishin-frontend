import { describe, it, expect, beforeEach, vi } from "vitest";
import { login, logout, getToken, isAuthenticated } from "./authService";

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
        it("should return true when token exists", () => {
            mockLocalStorage.getItem.mockReturnValue("some-token");

            const result = isAuthenticated();

            expect(result).toBe(true);
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
});

