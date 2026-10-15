import apiClient from "./apiClient";

export interface LoginPayload {
  email: string;
  password: string;
  turnstileToken?: string; // Cloudflare Turnstile verification token
}

export interface RegisterPayload {
  nama: string;
  email: string;
  password: string;
  unit?: string;
  harapan_role?: string;
  turnstileToken?: string;
}

export interface UpdateProfilePayload {
  nama?: string;
  email?: string;
  no_telp?: string;
  lokasi?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    nama: string;
    email: string;
    role: string;
    unit?: string;
    status?: string;
  };
}

export const authService = {
  async login(payload: LoginPayload): Promise<AuthTokens> {
    const { data } = await apiClient.post<AuthTokens>("/auth/login", payload);
    localStorage.removeItem("user_logged_out");
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    localStorage.setItem("current_user", JSON.stringify(data.user));
    return data;
  },

  async register(payload: RegisterPayload): Promise<{ message: string; email: string; verification_token?: string }> {
    const { data } = await apiClient.post<{ message: string; email: string; verification_token?: string }>(
      "/auth/register",
      payload,
    );
    return data;
  },

  async verifyEmail(token: string): Promise<{ message: string; email?: string }> {
    const { data } = await apiClient.get<{ message: string; email?: string }>("/auth/verify-email", {
      params: { token },
    });
    return data;
  },

  async forgotPassword(payload: { email: string; turnstileToken?: string }): Promise<{ message: string }> {
    const { data } = await apiClient.post<{ message: string }>("/auth/forgot-password", payload);
    return data;
  },

  async resetPassword(payload: { token: string; password: string }): Promise<{ message: string }> {
    const { data } = await apiClient.post<{ message: string }>("/auth/reset-password", payload);
    return data;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post("/auth/logout");
    } finally {
      localStorage.setItem("user_logged_out", "true");
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("current_user");
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
