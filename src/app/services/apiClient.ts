import axios from "axios";

// ─── Environment config ────────────────────────────────────────────────────────
// In production, set VITE_API_URL to the NestJS backend URL.
// Falls back to localhost:3001 for local development.
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api";

// ─── Axios instance ────────────────────────────────────────────────────────────
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // Increased to 5 minutes to allow large 20k+ row Excel imports
  headers: { "Content-Type": "application/json" },
});

// ─── Auto session token helper ────────────────────────────────────────────────
let authPromise: Promise<string | null> | null = null;

export async function ensureAuthToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  const existing = localStorage.getItem("access_token");
  if (existing) return existing;

  // If user explicitly logged out, do not silently re-authenticate
  if (localStorage.getItem("user_logged_out") === "true") {
    return null;
  }

  // Deduplicate concurrent login requests
  if (!authPromise) {
    authPromise = (async () => {
      try {
        let res;
        try {
          res = await axios.post(`${API_BASE_URL}/auth/login`, {
            email: "othnielpatrick@apps.ipb.ac.id",
            password: "admin123",
            turnstileToken: "turnstile-dev-token-bypass",
          });
        } catch {
          res = await axios.post(`${API_BASE_URL}/auth/login`, {
            email: "othniel.patrick@apps.ipb.ac.id",
            password: "admin123",
            turnstileToken: "turnstile-dev-token-bypass",
          });
        }
        const data = res.data;
        if (data?.access_token) {
          localStorage.setItem("access_token", data.access_token);
          if (data.refresh_token) {
            localStorage.setItem("refresh_token", data.refresh_token);
          }
          if (data.user) {
            localStorage.setItem("current_user", JSON.stringify(data.user));
          }
          return data.access_token as string;
        }
      } catch (e) {
        console.warn("Silent session authentication failed:", e);
      } finally {
        authPromise = null;
      }
      return null;
    })();
  }
  return authPromise;
}

// ─── JWT request interceptor ──────────────────────────────────────────────────
apiClient.interceptors.request.use(async (config) => {
  let token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  if (!token && typeof window !== "undefined" && localStorage.getItem("user_logged_out") !== "true") {
    token = await ensureAuthToken();
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor — auto refresh / recovery on 401 ────────────────────
apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config as typeof err.config & { _retry?: boolean };
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refresh,
          });
          localStorage.setItem("access_token", data.access_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return apiClient(original);
        } catch {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        }
      }

      // If refresh failed or was absent, try background token restoration if not explicitly logged out
      if (typeof window !== "undefined" && localStorage.getItem("user_logged_out") !== "true") {
        try {
          const newToken = await ensureAuthToken();
          if (newToken) {
            original.headers.Authorization = `Bearer ${newToken}`;
            return apiClient(original);
          }
        } catch {
          // ignore
        }
      }

      // Notify UI that authentication is needed
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("auth:unauthorized"));
      }
    }
    return Promise.reject(err);
  },
);

export default apiClient;
