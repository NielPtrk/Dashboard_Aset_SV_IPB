import axios from "axios";

// ─── Environment config ────────────────────────────────────────────────────────
// In production, set VITE_API_URL to the NestJS backend URL.
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
    ? `${window.location.origin}/api`
    : "http://localhost:3001/api");

// ─── Axios instance ────────────────────────────────────────────────────────────
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 minutes to allow large 20k+ row Excel imports
  headers: { "Content-Type": "application/json" },
});

// ─── Auth token helper (NEVER silent login with default mock credentials) ───────
export async function ensureAuthToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("access_token");
  if (!token || localStorage.getItem("user_logged_out") === "true") {
    return null;
  }
  return token;
}

// ─── JWT request interceptor ──────────────────────────────────────────────────
apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token && localStorage.getItem("user_logged_out") !== "true") {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ─── Response interceptor — handle 401 & session expiry ────────────────────────
let isRefreshing = false;
let refreshSubscribers: ((token: string | null) => void)[] = [];

function onTokenRefreshed(newToken: string | null) {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config as typeof err.config & { _retry?: boolean };
    const status = err.response?.status;

    // Check if error is 401 Unauthorized
    if (status === 401 && !original._retry && !original.url?.includes("/auth/login") && !original.url?.includes("/auth/refresh")) {
      original._retry = true;
      const refreshToken = typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;

      if (refreshToken && typeof window !== "undefined" && localStorage.getItem("user_logged_out") !== "true") {
        if (!isRefreshing) {
          isRefreshing = true;
          try {
            const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
              refresh_token: refreshToken,
            });
            const newToken = data.access_token;
            localStorage.setItem("access_token", newToken);
            isRefreshing = false;
            onTokenRefreshed(newToken);
            original.headers.Authorization = `Bearer ${newToken}`;
            return apiClient(original);
          } catch {
            isRefreshing = false;
            onTokenRefreshed(null);
            // Token refresh failed completely — session expired
            handleSessionExpired();
            return Promise.reject(err);
          }
        } else {
          // Queue request until active refresh finishes
          return new Promise((resolve, reject) => {
            refreshSubscribers.push((token) => {
              if (token) {
                original.headers.Authorization = `Bearer ${token}`;
                resolve(apiClient(original));
              } else {
                reject(err);
              }
            });
          });
        }
      }

      // No refresh token available — session expired
      handleSessionExpired();
    }

    return Promise.reject(err);
  },
);

function handleSessionExpired() {
  if (typeof window === "undefined") return;
  // Clear stored auth tokens and user data
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("current_user");
  localStorage.removeItem("user_profile");
  localStorage.setItem("user_logged_out", "true");

  // Broadcast session expired event to UI
  window.dispatchEvent(
    new CustomEvent("auth:session_expired", {
      detail: { message: "Sesi Anda telah berakhir, silakan masuk kembali." },
    }),
  );
  window.dispatchEvent(new CustomEvent("auth:unauthorized"));
}

export default apiClient;
