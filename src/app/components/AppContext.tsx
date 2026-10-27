import React, { useState, useCallback, useRef, useEffect } from "react";
import authService from "../services/authService";
import type { UpdateProfilePayload } from "../services/authService";

// ─────────────────────────────────────────────────────────────────────────────
// User Profile — global shape exposed to all components
// ─────────────────────────────────────────────────────────────────────────────
export interface UserProfile {
  id: string;
  nama: string;
  email: string;
  no_telp: string;
  jabatan: string;
  lokasi: string;
  avatar_url: string | null;
}

export interface AppNotification {
  id: number;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  actionPage?: string;
  actionType?: string;
}

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  { id: 1, title: "Persetujuan Mutasi Aset", message: "Mutasi aset untuk Laptop Asus ROG membutuhkan persetujuan Anda.", time: "5 mnt yang lalu", unread: true, actionPage: "mutasi" },
  { id: 2, title: "Jadwal Perbaikan", message: "Perbaikan AC Ruang Server dijadwalkan besok pagi pukul 08.00.", time: "1 jam yang lalu", unread: true },
  { id: 3, title: "Laporan Stock Opname", message: "Stock opname bulan ini telah selesai 80%. Segera tuntaskan sisa verifikasi.", time: "3 jam yang lalu", unread: false },
  { id: 4, title: "Aset Baru Ditambahkan", message: "Printer Canon PIXMA IX6870 telah berhasil didaftarkan ke dalam sistem.", time: "Hari ini, 09:15", unread: true },
  { id: 5, title: "Masa Manfaat Aset Habis", message: "15 aset telah mencapai masa manfaat habis dan perlu segera ditindaklanjuti.", time: "Kemarin, 14:30", unread: false },
];

export type TableDensity = "normal" | "compact" | "spacious";
export type AppLanguage = "id" | "en";
export type AppTheme = "light" | "dark";

export interface ToastData {
  id: number;
  message: string;
  type: "success" | "info" | "error";
}

interface AppContextType {
  theme: AppTheme;
  setTheme: (v: AppTheme) => void;
  tableDensity: TableDensity;
  setTableDensity: (v: TableDensity) => void;
  language: AppLanguage;
  setLanguage: (v: AppLanguage) => void;
  notifications: AppNotification[];
  addNotification: (notif: { title: string; message: string; actionPage?: string; actionType?: string }) => void;
  markAllRead: () => void;
  markRead: (id: number) => void;
  unreadCount: number;
  toasts: ToastData[];
  showToast: (msg: string, type?: "success" | "info" | "error") => void;
  userProfile: UserProfile | null;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
  updateUserProfile: (payload: UpdateProfilePayload) => Promise<boolean>;
  isProfileLoading: boolean;
}

export const AppContext = React.createContext<AppContextType>({
  theme: "light",
  setTheme: () => {},
  tableDensity: "normal",
  setTableDensity: () => {},
  language: "id",
  setLanguage: () => {},
  notifications: INITIAL_NOTIFICATIONS,
  addNotification: () => {},
  markAllRead: () => {},
  markRead: () => {},
  unreadCount: 3,
  toasts: [],
  showToast: () => {},
  userProfile: null,
  setUserProfile: () => {},
  updateUserProfile: async () => false,
  isProfileLoading: false,
});

export function useApp() {
  return React.useContext(AppContext);
}

const DARK_CSS_ID = "app-dark-mode-css";
const DENSITY_CSS_ID = "app-density-css";

const DARK_MODE_CSS = `
  [data-theme="dark"] { background-color: #111827; color-scheme: dark; }
  [data-theme="dark"] .bg-white { background-color: #1F2937 !important; }
  [data-theme="dark"] .bg-gray-50 { background-color: #111827 !important; }
  [data-theme="dark"] .bg-gray-100 { background-color: #374151 !important; }
  [data-theme="dark"] .bg-gray-200 { background-color: #4B5563 !important; }
  [data-theme="dark"] .text-gray-900 { color: #F9FAFB !important; }
  [data-theme="dark"] .text-gray-800 { color: #E5E7EB !important; }
  [data-theme="dark"] .text-gray-700 { color: #D1D5DB !important; }
  [data-theme="dark"] .text-gray-600 { color: #9CA3AF !important; }
  [data-theme="dark"] .text-gray-500 { color: #9CA3AF !important; }
  [data-theme="dark"] .text-gray-400 { color: #6B7280 !important; }
  [data-theme="dark"] .border-gray-200 { border-color: #374151 !important; }
  [data-theme="dark"] .border-gray-100 { border-color: #1F2937 !important; }
  [data-theme="dark"] .shadow-sm { box-shadow: 0 1px 3px rgba(0,0,0,0.5) !important; }
  [data-theme="dark"] .shadow-lg { box-shadow: 0 10px 30px rgba(0,0,0,0.6) !important; }
  [data-theme="dark"] .shadow-2xl { box-shadow: 0 25px 50px rgba(0,0,0,0.8) !important; }
  [data-theme="dark"] input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="range"]) { background-color: #374151 !important; border-color: #4B5563 !important; color: #E5E7EB !important; }
  [data-theme="dark"] select { background-color: #374151 !important; border-color: #4B5563 !important; color: #E5E7EB !important; }
  [data-theme="dark"] textarea { background-color: #374151 !important; border-color: #4B5563 !important; color: #E5E7EB !important; }
  [data-theme="dark"] aside { background-color: #111827 !important; border-color: #1F2937 !important; }
  [data-theme="dark"] .sticky.top-0 { background-color: #111827 !important; border-color: #374151 !important; }
  [data-theme="dark"] .bg-purple-50 { background-color: rgba(88,28,135,0.2) !important; }
  [data-theme="dark"] .bg-blue-50 { background-color: rgba(29,78,216,0.15) !important; }
  [data-theme="dark"] .bg-green-50 { background-color: rgba(22,101,52,0.15) !important; }
  [data-theme="dark"] .bg-red-50 { background-color: rgba(127,29,29,0.15) !important; }
  [data-theme="dark"] .hover\\:bg-gray-50:hover { background-color: #374151 !important; }
  [data-theme="dark"] .hover\\:bg-gray-100:hover { background-color: #4B5563 !important; }
  [data-theme="dark"] .hover\\:bg-red-50:hover { background-color: rgba(127,29,29,0.2) !important; }
  [data-theme="dark"] .text-\\[\\#171717\\] { color: #F9FAFB !important; }
  [data-theme="dark"] .text-\\[\\#061A33\\] { color: #E5E7EB !important; }
  [data-theme="dark"] .text-\\[\\#242424\\] { color: #E5E7EB !important; }
  [data-theme="dark"] .text-\\[\\#1F1F1F\\] { color: #D1D5DB !important; }
  [data-theme="dark"] .text-\\[\\#6F737A\\] { color: #9CA3AF !important; }
  [data-theme="dark"] .text-\\[\\#8A8A8A\\] { color: #6B7280 !important; }
  [data-theme="dark"] .border-\\[\\#ECECEC\\] { border-color: #374151 !important; }
  [data-theme="dark"] .border-\\[\\#E5E5E5\\] { border-color: #374151 !important; }
  [data-theme="dark"] .border-\\[\\#EFEFEF\\] { border-color: #374151 !important; }
  [data-theme="dark"] .bg-\\[\\#FFFFFF\\] { background-color: #1F2937 !important; }
  [data-theme="dark"] .bg-\\[\\#FAFAFA\\] { background-color: #1F2937 !important; }
  [data-theme="dark"] .bg-\\[\\#F6F6F6\\] { background-color: #374151 !important; }
  [data-theme="dark"] .bg-\\[\\#F3F4F6\\] { background-color: #374151 !important; }
  [data-theme="dark"] .hover\\:bg-\\[\\#F3F4F6\\]:hover { background-color: #374151 !important; }
  [data-theme="dark"] .text-\\[\\#777777\\] { color: #9CA3AF !important; }
  [data-theme="dark"] .bg-gray-900 { background-color: #F9FAFB !important; }
  [data-theme="dark"] .bg-gray-900.text-white { background-color: #1F2937 !important; }
  [data-theme="dark"] table th { background-color: #111827 !important; }
  [data-theme="dark"] .bg-gray-50\\/50 { background-color: rgba(17,24,39,0.5) !important; }
`;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>("light");
  const [tableDensity, setTableDensityState] = useState<TableDensity>("normal");
  const [language, setLanguageState] = useState<AppLanguage>("id");
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const toastTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  // ── User Profile State ─────────────────────────────────────────────────────
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    // Only restore from localStorage if a valid token exists
    if (typeof localStorage !== "undefined") {
      const hasToken = !!localStorage.getItem("access_token");
      const isLoggedOut = localStorage.getItem("user_logged_out") === "true";
      if (hasToken && !isLoggedOut) {
        const saved = localStorage.getItem("user_profile");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.nama) {
              return parsed;
            }
          } catch { /* fallback */ }
        }
      }
    }
    return null;
  });
  const [isProfileLoading, setIsProfileLoading] = useState(false);

  // Sync profile reset on logout or session expiry
  useEffect(() => {
    const handleLogout = () => {
      setUserProfile(null);
    };
    window.addEventListener("auth:logout", handleLogout);
    window.addEventListener("auth:session_expired", handleLogout);
    return () => {
      window.removeEventListener("auth:logout", handleLogout);
      window.removeEventListener("auth:session_expired", handleLogout);
    };
  }, []);

  // Persist profile changes to localStorage only if authenticated
  useEffect(() => {
    if (userProfile && localStorage.getItem("access_token")) {
      localStorage.setItem("user_profile", JSON.stringify(userProfile));
    } else {
      localStorage.removeItem("user_profile");
    }
  }, [userProfile]);

  // Update profile: update local state & localStorage, and attempt backend sync
  const updateUserProfile = useCallback(async (payload: UpdateProfilePayload): Promise<boolean> => {
    if (!userProfile) return false;
    setIsProfileLoading(true);
    try {
      const updatedProfile: UserProfile = {
        ...userProfile,
        ...(payload.nama !== undefined && { nama: payload.nama.trim() }),
        ...(payload.email !== undefined && { email: payload.email.trim() }),
        ...(payload.no_telp !== undefined && { no_telp: payload.no_telp.trim() }),
        ...(payload.lokasi !== undefined && { lokasi: payload.lokasi.trim() }),
      };

      // 1. Immediately persist to state & localStorage
      setUserProfile(updatedProfile);
      localStorage.setItem("user_profile", JSON.stringify(updatedProfile));

      // 2. Attempt backend API sync if token exists
      if (authService.getAccessToken()) {
        try {
          const apiResult = await authService.updateProfile(userProfile.id, payload);
          if (apiResult?.avatar_url) {
            setUserProfile((prev) => prev ? ({ ...prev, avatar_url: apiResult.avatar_url }) : null);
          }
        } catch (apiErr) {
          console.warn("Backend profile sync skipped:", apiErr);
        }
      }

      return true;
    } finally {
      setIsProfileLoading(false);
    }
  }, [userProfile]);

  const unreadCount = notifications.filter((n) => n.unread).length;

  const setTheme = useCallback((v: AppTheme) => {
    setThemeState(v);
  }, []);

  const setTableDensity = useCallback((v: TableDensity) => {
    setTableDensityState(v);
  }, []);

  const setLanguage = useCallback((v: AppLanguage) => {
    setLanguageState(v);
  }, []);

  const addNotification = useCallback((notif: { title: string; message: string; actionPage?: string; actionType?: string }) => {
    setNotifications((prev) => [
      {
        id: Date.now(),
        title: notif.title,
        message: notif.message,
        time: "Baru saja",
        unread: true,
        actionPage: notif.actionPage,
        actionType: notif.actionType,
      },
      ...prev,
    ]);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  }, []);

  const markRead = useCallback((id: number) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, unread: false } : n)));
  }, []);

  const showToast = useCallback((message: string, type: "success" | "info" | "error" = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      toastTimers.current.delete(id);
    }, 3500);
    toastTimers.current.set(id, timer);
  }, []);

  // Dark mode CSS injection
  useEffect(() => {
    let el = document.getElementById(DARK_CSS_ID) as HTMLStyleElement | null;
    if (theme === "dark") {
      if (!el) {
        el = document.createElement("style");
        el.id = DARK_CSS_ID;
        document.head.appendChild(el);
      }
      el.textContent = DARK_MODE_CSS;
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      el?.remove();
      document.documentElement.removeAttribute("data-theme");
    }
    return () => {};
  }, [theme]);

  // Table density CSS injection
  useEffect(() => {
    let el = document.getElementById(DENSITY_CSS_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = DENSITY_CSS_ID;
      document.head.appendChild(el);
    }
    const py = tableDensity === "compact" ? "4px" : tableDensity === "spacious" ? "20px" : "12px";
    const px = tableDensity === "compact" ? "10px" : "16px";
    el.textContent = `.density-table td { padding-top: ${py} !important; padding-bottom: ${py} !important; padding-left: ${px} !important; padding-right: ${px} !important; } .density-table th { padding-top: ${py} !important; padding-bottom: ${py} !important; }`;
  }, [tableDensity]);

  useEffect(() => {
    return () => {
      toastTimers.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return (
    <AppContext.Provider
      value={{
        theme,
        setTheme,
        tableDensity,
        setTableDensity,
        language,
        setLanguage,
        notifications,
        addNotification,
        markAllRead,
        markRead,
        unreadCount,
        toasts,
        showToast,
        userProfile,
        setUserProfile,
        updateUserProfile,
        isProfileLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
