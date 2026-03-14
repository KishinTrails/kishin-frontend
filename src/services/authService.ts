const TOKEN_KEY = 'kishin_token';

const API_BASE = '/auth';

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export async function login(username: string, password: string): Promise<void> {
  const formData = new URLSearchParams();
  formData.append('username', username);
  formData.append('password', password);

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

export function logout(): void {
    localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
    return !!getToken();
}
