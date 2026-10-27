import React, { useState, useEffect } from "react";
import { authService } from "../services/authService";
import { useDataStore, type UserRole } from "./DataStore";
import { useApp } from "./AppContext";
import { TurnstileWidget } from "./TurnstileWidget";
import {
  Lock, Mail, User, CheckCircle2,
  AlertCircle, ArrowRight, ArrowLeft, X, Eye, EyeOff, RefreshCw,
  ChevronDown, Info
} from "lucide-react";

export type AuthMode = "login" | "register" | "forgot" | "reset" | "verify_success";

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  initialMode?: AuthMode;
  initialToken?: string;
  sessionExpiredMsg?: string | null;
  onSuccess?: () => void;
}

export function AuthModal({
  isOpen,
  onClose,
  initialMode = "login",
  initialToken,
  sessionExpiredMsg,
  onSuccess,
}: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [token, setToken] = useState<string>(initialToken || "");
  const { setCurrentUser } = useDataStore();
  const { showToast, setUserProfile } = useApp();

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nama, setNama] = useState("");
  const [unit, setUnit] = useState("Sekolah Vokasi");
  const [harapanRole, setHarapanRole] = useState<UserRole>("Pekerja Stock Opname");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & error states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
    if (initialToken) setToken(initialToken);
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [initialMode, initialToken, isOpen]);

  // Handle URL tokens on mount if verify or reset
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get("verify_token");
    const resetToken = params.get("reset_token");

    if (verifyToken) {
      setMode("login");
      setLoading(true);
      authService
        .verifyEmail(verifyToken)
        .then((res) => {
          setSuccessMsg(
            res.message ||
              "Email Anda telah berhasil diverifikasi! Permintaan kini menunggu persetujuan Admin Sistem.",
          );
          showToast("Email berhasil diverifikasi", "success");
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch((err) => {
          setErrorMsg(err.response?.data?.message || "Token verifikasi tidak valid atau telah kedaluwarsa.");
        })
        .finally(() => setLoading(false));
    } else if (resetToken) {
      setMode("reset");
      setToken(resetToken);
    }
  }, [showToast]);

  if (!isOpen) return null;

  // ── Login Handler ──────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await authService.login({
        email: email.trim(),
        password,
        turnstileToken: turnstileToken || "turnstile-dev-token-bypass",
      });

      // Update DataStore state
      const user = res.user;
      setCurrentUser({
        id: user.id,
        nama: user.nama,
        email: user.email,
        role: user.role as UserRole,
        unit: user.unit || "Pusat",
        aktif: true,
        status: "aktif",
      });

      // Update AppContext Profile
      setUserProfile((prev) => ({
        ...prev,
        id: user.id,
        nama: user.nama,
        email: user.email,
        jabatan: user.role,
        lokasi: user.unit || "Kampus SV IPB",
      }));

      showToast(`Selamat datang, ${user.nama}!`, "success");
      onSuccess?.();
      onClose?.();
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        "Gagal masuk. Pastikan email dan kata sandi Anda benar.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Register Handler ───────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (password.length < 6) {
      setErrorMsg("Kata sandi minimal 6 karakter.");
      return;
    }

    setLoading(true);
    try {
      const res = await authService.register({
        nama: nama.trim(),
        email: email.trim(),
        password,
        unit,
        harapan_role: harapanRole,
        turnstileToken: turnstileToken || "turnstile-dev-token-bypass",
      });

      setSuccessMsg(
        res.message ||
          "Pendaftaran berhasil! Tautan verifikasi telah dikirimkan ke email Anda. Silakan verifikasi email Anda sebelum akun dapat disetujui.",
      );
      setMode("verify_success");
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        "Pendaftaran gagal. Periksa kembali informasi yang dimasukkan.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password Handler ────────────────────────────────────────────────
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await authService.forgotPassword({
        email: email.trim(),
        turnstileToken: turnstileToken || "turnstile-dev-token-bypass",
      });
      setSuccessMsg(
        res.message ||
          "Jika email terdaftar, tautan penyetelan ulang kata sandi telah dikirim ke email Anda.",
      );
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Gagal memproses permohonan.");
    } finally {
      setLoading(false);
    }
  };

  // ── Reset Password Handler ─────────────────────────────────────────────────
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (password.length < 6) {
      setErrorMsg("Kata sandi baru minimal 6 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Konfirmasi kata sandi tidak cocok.");
      return;
    }

    setLoading(true);
    try {
      const res = await authService.resetPassword({
        token,
        password,
      });
      setSuccessMsg(res.message || "Kata sandi berhasil diperbarui! Silakan masuk.");
      setMode("login");
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Gagal menyetel ulang kata sandi.");
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

        {/* Segmented Control Tabs (Masuk / Daftar Akun) */}
        {(mode === "login" || mode === "register") && (
          <div className="mt-6 bg-[#F1F5F9] p-1.5 rounded-2xl flex items-center">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2.5 text-center text-sm transition-all duration-150 cursor-pointer ${
                mode === "login"
                  ? "bg-white text-[#0A56A4] font-bold rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                  : "text-[#64748B] font-semibold hover:text-[#1E293B]"
              }`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-2.5 text-center text-sm transition-all duration-150 cursor-pointer ${
                mode === "register"
                  ? "bg-white text-[#0A56A4] font-bold rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                  : "text-[#64748B] font-semibold hover:text-[#1E293B]"
              }`}
            >
              Daftar Akun
            </button>
          </div>
        )}

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

        {/* ── MODE: LOGIN ── */}
        {mode === "login" && (
          <div className="mt-6">
            <div>
              <h2 className="text-[26px] font-bold text-[#0F172A] tracking-tight">
                Masuk
              </h2>
              <p className="text-sm text-[#64748B] mt-1">
                Gunakan akun IPB untuk mengakses dashboard aset.
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
              {/* Email Input */}
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  Email Akun IPB
                </label>
                <div className="relative flex items-center">
                  <Mail size={18} className="absolute left-3.5 text-[#94A3B8] pointer-events-none" />
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@apps.ipb.ac.id"
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
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setErrorMsg(null);
                    }}
                    className="text-xs font-semibold text-[#0A56A4] hover:underline cursor-pointer"
                  >
                    Lupa sandi?
                  </button>
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

              {/* Bottom switch link */}
              <p className="text-center text-xs text-[#64748B] pt-2">
                Belum memiliki akun?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="font-bold text-[#0A56A4] hover:underline cursor-pointer"
                >
                  Daftar Akun
                </button>
              </p>
            </form>
          </div>
        )}

        {/* ── MODE: REGISTER ── */}
        {mode === "register" && (
          <div className="mt-6">
            <div>
              <h2 className="text-[26px] font-bold text-[#0F172A] tracking-tight">
                Daftar Akun
              </h2>
              <p className="text-sm text-[#64748B] mt-1">
                Lengkapi data untuk mengajukan akses dashboard.
              </p>
            </div>

            <form onSubmit={handleRegister} className="mt-6 space-y-4">
              {/* Nama Lengkap & Gelar */}
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  Nama Lengkap &amp; Gelar *
                </label>
                <div className="relative flex items-center">
                  <User size={18} className="absolute left-3.5 text-[#94A3B8] pointer-events-none" />
                  <input
                    required
                    type="text"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    placeholder="Contoh: Dr. Budi Santoso, M.Si"
                    className="w-full h-[46px] pl-10 pr-4 text-sm bg-white border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#0A56A4] focus:ring-1 focus:ring-[#0A56A4] transition-all"
                  />
                </div>
              </div>

              {/* Email Resmi IPB */}
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  Email Resmi IPB *
                </label>
                <div className="relative flex items-center">
                  <Mail size={18} className="absolute left-3.5 text-[#94A3B8] pointer-events-none" />
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@apps.ipb.ac.id"
                    className="w-full h-[46px] pl-10 pr-4 text-sm bg-white border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#0A56A4] focus:ring-1 focus:ring-[#0A56A4] transition-all"
                  />
                </div>
              </div>

              {/* Kata Sandi */}
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  Kata Sandi (Min. 6 Karakter) *
                </label>
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

              {/* Unit Kerja & Harapan Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    Unit Kerja *
                  </label>
                  <div className="relative flex items-center">
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full h-[46px] pl-3.5 pr-8 text-sm bg-white border border-[#E2E8F0] rounded-xl text-[#0F172A] outline-none focus:border-[#0A56A4] focus:ring-1 focus:ring-[#0A56A4] appearance-none cursor-pointer transition-all"
                    >
                      <option value="Sekolah Vokasi">Sekolah Vokasi</option>
                      <option value="Kampus Cilibende">Kampus Cilibende</option>
                      <option value="Kampus Gunung Gede">Kampus Gunung Gede</option>
                      <option value="Pusat">Pusat</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-3 text-[#64748B] pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                    Harapan Role *
                  </label>
                  <div className="relative flex items-center">
                    <select
                      value={harapanRole}
                      onChange={(e) => setHarapanRole(e.target.value as UserRole)}
                      className="w-full h-[46px] pl-3.5 pr-8 text-sm bg-white border border-[#E2E8F0] rounded-xl text-[#0F172A] outline-none focus:border-[#0A56A4] focus:ring-1 focus:ring-[#0A56A4] appearance-none cursor-pointer transition-all"
                    >
                      <option value="Pekerja Stock Opname">Pekerja Stock Opname</option>
                      <option value="Admin Pusat">Admin Pusat</option>
                      <option value="Pimpinan">Pimpinan</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-3 text-[#64748B] pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Memerlukan Persetujuan Admin Info Box */}
              <div className="bg-[#F0F7FF] border border-[#D8E8FC] rounded-xl p-3.5 flex items-start gap-3">
                <Info size={18} className="text-[#0A56A4] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-[#0A56A4]">
                    Memerlukan persetujuan admin
                  </p>
                  <p className="text-xs text-[#64748B] mt-0.5 leading-relaxed">
                    Pendaftaran akan ditinjau oleh admin. Akun dapat digunakan setelah disetujui.
                  </p>
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
                    <span>Mendaftarkan Akun...</span>
                  </>
                ) : (
                  <>
                    <span>Daftar Akun</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              {/* Bottom switch link */}
              <p className="text-center text-xs text-[#64748B] pt-2">
                Sudah memiliki akun?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="font-bold text-[#0A56A4] hover:underline cursor-pointer"
                >
                  Masuk
                </button>
              </p>
            </form>
          </div>
        )}

        {/* ── MODE: FORGOT PASSWORD ── */}
        {mode === "forgot" && (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setErrorMsg(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#0A56A4] font-semibold mb-3 transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Kembali ke Halaman Masuk</span>
            </button>

            <div>
              <h2 className="text-[26px] font-bold text-[#0F172A] tracking-tight">
                Lupa Kata Sandi
              </h2>
              <p className="text-sm text-[#64748B] mt-1">
                Masukkan email akun IPB terdaftar untuk menerima tautan pemulihan kata sandi.
              </p>
            </div>

            <form onSubmit={handleForgot} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  Email Akun IPB
                </label>
                <div className="relative flex items-center">
                  <Mail size={18} className="absolute left-3.5 text-[#94A3B8] pointer-events-none" />
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@apps.ipb.ac.id"
                    className="w-full h-[46px] pl-10 pr-4 text-sm bg-white border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#0A56A4] focus:ring-1 focus:ring-[#0A56A4] transition-all"
                  />
                </div>
              </div>

              <TurnstileWidget onVerify={(tok) => setTurnstileToken(tok)} />

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[48px] bg-[#0A56A4] hover:bg-[#084889] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Mengirim Tautan...</span>
                  </>
                ) : (
                  <>
                    <span>Kirim Tautan Reset</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ── MODE: RESET PASSWORD ── */}
        {mode === "reset" && (
          <div className="mt-6">
            <div>
              <h2 className="text-[26px] font-bold text-[#0F172A] tracking-tight">
                Setel Ulang Kata Sandi
              </h2>
              <p className="text-sm text-[#64748B] mt-1">
                Silakan tentukan kata sandi baru untuk akun Anda.
              </p>
            </div>

            <form onSubmit={handleReset} className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  Kata Sandi Baru (Min. 6 Karakter) *
                </label>
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
                    className="absolute right-3.5 text-[#94A3B8] hover:text-[#64748B] transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#0F172A] mb-1.5">
                  Ulangi Kata Sandi Baru *
                </label>
                <div className="relative flex items-center">
                  <Lock size={18} className="absolute left-3.5 text-[#94A3B8] pointer-events-none" />
                  <input
                    required
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-[46px] pl-10 pr-10 text-sm bg-white border border-[#E2E8F0] rounded-xl text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#0A56A4] focus:ring-1 focus:ring-[#0A56A4] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 text-[#94A3B8] hover:text-[#64748B] transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[48px] bg-[#0A56A4] hover:bg-[#084889] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Menyimpan Sandi...</span>
                  </>
                ) : (
                  <>
                    <span>Perbarui Kata Sandi</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ── MODE: VERIFY SUCCESS ── */}
        {mode === "verify_success" && (
          <div className="mt-8 text-center py-4 space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#E0EFFE] text-[#0A56A4] flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#0F172A]">
                Pendaftaran Berhasil Diajukan
              </h3>
              <p className="text-sm text-[#64748B] mt-2 leading-relaxed">
                Permohonan akses akun untuk <span className="font-bold text-[#0F172A]">{email}</span> ({harapanRole}) telah diteruskan ke Admin Sistem.
              </p>
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-2">
                Akun saat ini menunggu persetujuan dan penetapan role oleh Admin Sistem. Setelah disetujui, Anda dapat langsung masuk ke sistem.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setMode("login")}
                className="w-full h-[46px] bg-[#0A56A4] hover:bg-[#084889] text-white text-sm font-bold rounded-xl transition-colors cursor-pointer"
              >
                Kembali ke Halaman Masuk
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
