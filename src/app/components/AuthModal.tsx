import React, { useState, useEffect } from "react";
import { authService } from "../services/authService";
import { useDataStore, type UserRole } from "./DataStore";
import { useApp } from "./AppContext";
import { TurnstileWidget } from "./TurnstileWidget";
import {
  Lock, User, CheckCircle2,
  AlertCircle, ArrowRight, X, Eye, EyeOff, RefreshCw
} from "lucide-react";

export type AuthMode = "login" | "must_change_password";

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  initialMode?: AuthMode;
  sessionExpiredMsg?: string | null;
  onSuccess?: () => void;
}

export function AuthModal({
  isOpen,
  onClose,
  initialMode = "login",
  sessionExpiredMsg,
  onSuccess,
}: AuthModalProps) {
  const { setCurrentUser, appendActivity } = useDataStore();
  const { showToast, setUserProfile } = useApp();

  // Form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Status & error states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  // ── Login Handler ──────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    const normUser = username.trim().replace(/\s+/g, " ");

    try {
      const res = await authService.login({
        username: normUser,
        password,
        turnstileToken: turnstileToken || "turnstile-dev-token-bypass",
      });

      const user = res.user;

      // Update DataStore state langsung masuk ke dashboard
      setCurrentUser({
        id: user.id,
        username: user.username || user.nama,
        nama: user.username || user.nama,
        role: user.role as UserRole,
        unit: user.unit || "Pusat",
        jabatan: user.jabatan,
        aktif: true,
        status: "aktif",
      });

      // Update AppContext Profile
      setUserProfile((prev) => ({
        ...prev,
        id: user.id,
        nama: user.username || user.nama,
        jabatan: user.role,
        lokasi: user.unit || "Kampus SV IPB",
      }));

      // Log successful login
      appendActivity({
        pengguna: user.username || user.nama,
        role: user.role,
        menu: "Pengguna",
        aksi: "Login ke sistem",
        target_type: "User",
        target_id: user.id,
        status: "Berhasil",
        jenis: "login",
      });

      showToast(`Selamat datang, ${user.username || user.nama}!`, "success");
      onSuccess?.();
      onClose?.();
    } catch (err: any) {
      let msg = "Terjadi kesalahan saat masuk. Silakan coba lagi.";
      if (err.response?.data?.message) {
        msg = err.response.data.message;
      } else if (err.response?.status === 401) {
        msg = "Username atau kata sandi salah.";
      } else if (err.response?.status === 405 || err.response?.status === 404) {
        msg = `Koneksi ke backend gagal (HTTP ${err.response.status}). Endpoint backend belum terhubung dengan benar.`;
      } else if (err.response?.status >= 500) {
        msg = `Server backend mengalami gangguan (HTTP ${err.response.status}).`;
      } else if (err.message === "Network Error") {
        msg = "Tidak dapat terhubung ke server backend (Network Error).";
      }
      setErrorMsg(msg);

      // Log failed login attempt
      appendActivity({
        pengguna: normUser || "Tamu",
        role: "Tanpa Role",
        menu: "Pengguna",
        aksi: `Percobaan login gagal — ${msg}`,
        target_type: "User",
        target_id: normUser || "AUTH",
        status: "Gagal",
        jenis: "gagal",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-[28px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.12)] w-full max-w-[460px] p-8 border border-slate-200/80 relative my-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button (X) */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="absolute top-7 right-7 p-1 text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        )}

        {/* Top Header */}
        <div>
          <span className="text-[11px] font-bold tracking-wider text-[#0A56A4] uppercase block">
            SEKOLAH VOKASI · IPB UNIVERSITY
          </span>
          <h1 className="text-[19px] font-bold text-[#0F172A] leading-tight mt-1">
            Dashboard Aset SV IPB
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Sistem Informasi Pengelolaan &amp; Inventarisasi Aset
          </p>
        </div>

        {/* Feedback Messages (Error / Success) */}
        {errorMsg && (
          <div className="mt-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs animate-in fade-in">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1 leading-relaxed font-medium">{errorMsg}</div>
          </div>
        )}
        {successMsg && (
          <div className="mt-5 flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs animate-in fade-in">
            <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
            <div className="flex-1 leading-relaxed font-medium">{successMsg}</div>
          </div>
        )}

        {/* ── LOGIN FORM ── */}
        <div className="mt-6">
          <div>
            <h2 className="text-[26px] font-bold text-[#0F172A] tracking-tight">
              Masuk
            </h2>
            <p className="text-sm text-[#64748B] mt-1">
              Masukkan username dan kata sandi dari Admin Sistem.
            </p>
          </div>

          {sessionExpiredMsg && (
            <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold block text-amber-950 mb-0.5">Sesi Anda Telah Berakhir</span>
                {sessionExpiredMsg}
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            {/* Username Input */}
            <div>
              <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                Username
              </label>
              <div className="relative flex items-center">
                <User size={18} className="absolute left-3.5 text-[#94A3B8] pointer-events-none" />
                <input
                  required
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username, contoh: Budi Santoso"
                  className="w-full h-[46px] pl-10 pr-4 text-sm bg-white border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#0A56A4] focus:ring-1 focus:ring-[#0A56A4] transition-all"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-[#0F172A]">
                  Kata Sandi
                </label>
                <span className="text-[11px] text-[#64748B]">
                  Lupa kata sandi? Hubungi Admin Sistem
                </span>
              </div>
              <div className="relative flex items-center">
                <Lock size={18} className="absolute left-3.5 text-[#94A3B8] pointer-events-none" />
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-[46px] pl-10 pr-10 text-sm bg-white border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#0A56A4] focus:ring-1 focus:ring-[#0A56A4] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  className="absolute right-3.5 text-[#94A3B8] hover:text-[#64748B] transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Cloudflare Turnstile */}
            <TurnstileWidget onVerify={(tok) => setTurnstileToken(tok)} />

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-[48px] bg-[#0A56A4] hover:bg-[#084889] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Memproses Masuk...</span>
                </>
              ) : (
                <>
                  <span>Masuk</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Non-link informational text */}
            <p className="text-center text-xs text-[#64748B] pt-2">
              Akun dibuat oleh Admin Sistem.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
