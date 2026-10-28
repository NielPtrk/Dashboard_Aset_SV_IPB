import apiClient from "./apiClient";

export interface LoginPayload {
  username: string;
  password: string;
  turnstileToken?: string; // Cloudflare Turnstile verification token
}

export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
}

export interface UpdateProfilePayload {
  nama?: string;
  username?: string;
  no_telp?: string;
  lokasi?: string;
  jabatan?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    username: string;
    nama: string;
    role: string;
    unit?: string;
    jabatan?: string;
    status?: string;
    must_change_password?: boolean;
  };
}

export const authService = {
  async login(payload: LoginPayload): Promise<AuthTokens> {
    const { data } = await apiClient.post<AuthTokens>("/auth/login", {
      username: payload.username.trim().replace(/\s+/g, " "),
      password: payload.password,
      turnstileToken: payload.turnstileToken,
    });
    localStorage.removeItem("user_logged_out");
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    localStorage.setItem("current_user", JSON.stringify(data.user));
    return data;
  },

  async changePassword(oldOrPayload: ChangePasswordPayload | string, newPassword?: string): Promise<{ message: string; access_token?: string; refresh_token?: string; user?: any }> {
    const payload: ChangePasswordPayload = typeof oldOrPayload === "string"
      ? { old_password: oldOrPayload, new_password: newPassword || "" }
      : oldOrPayload;
    const { data } = await apiClient.post<{ message: string; access_token?: string; refresh_token?: string; user?: any }>("/auth/change-password", payload);
    if (data.access_token) {
      localStorage.setItem("access_token", data.access_token);
    }
    if (data.refresh_token) {
      localStorage.setItem("refresh_token", data.refresh_token);
    }
    if (data.user) {
      localStorage.setItem("current_user", JSON.stringify(data.user));
    }
    return data;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post("/auth/logout").catch(() => {});
    } finally {
      localStorage.setItem("user_logged_out", "true");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("current_user");
      localStorage.removeItem("user_profile");
      try {
        sessionStorage.clear();
      } catch {
        // ignore
      }
      // Clear cookie if any
      if (typeof document !== "undefined") {
        document.cookie = "access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        document.cookie = "sidebar_state=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:logout"));
      }
    }
  },

  async refreshToken(): Promise<string> {
    const refresh = localStorage.getItem("refresh_token");
    const { data } = await apiClient.post<{ access_token: string }>("/auth/refresh", {
      refresh_token: refresh,
    });
    localStorage.setItem("access_token", data.access_token);
    return data.access_token;
  },

  async getProfile() {
    const { data } = await apiClient.get("/auth/profile");
    return data;
  },

  async updateProfile(userId: string, payload: UpdateProfilePayload) {
    const { data } = await apiClient.patch(`/users/${userId}`, payload);
    return data;
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem("access_token");
  },

  getAccessToken(): string | null {
    return localStorage.getItem("access_token");
  },

  getCurrentUserFromStorage() {
    try {
      const saved = localStorage.getItem("current_user");
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return null;
  },
};

export default authService;
