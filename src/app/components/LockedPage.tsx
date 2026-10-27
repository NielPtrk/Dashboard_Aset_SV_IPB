import React from "react";
import { Lock, LogIn, ShieldAlert, ArrowRight } from "lucide-react";
import type { AuthMode } from "./AuthModal";

interface LockedPageProps {
  title?: string;
  breadcrumbs?: string[];
  topBar?: React.ReactNode;
  onOpenAuth: (mode?: AuthMode) => void;
  greeting?: string;
}

export function LockedPage({
  title,
  breadcrumbs,
  topBar,
  onOpenAuth,
  greeting,
}: LockedPageProps) {
  return (
    <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto bg-slate-50/60 font-sans">
      {topBar}

      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 max-w-2xl mx-auto w-full text-center">
        {/* Optional general greeting banner without user details */}
        {greeting && (
          <div className="mb-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
            <span>{greeting}</span>
          </div>
        )}

        {/* Locked Card */}
        <div className="w-full bg-white border border-slate-200/80 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-8 sm:p-10 flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
          {/* Padlock Icon Container */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-2xl bg-slate-100/80 border border-slate-200/60 flex items-center justify-center text-slate-800 shadow-xs">
              <Lock size={36} strokeWidth={2.2} className="text-[#061A33]" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <ShieldAlert size={13} strokeWidth={2.5} />
            </div>
          </div>

          {/* Heading */}
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-2">
            {title ? `${title} Terkunci` : "Akses Terbatas"}
          </h2>

          {/* Prompt message */}
          <p className="text-sm sm:text-[15px] font-medium text-slate-600 mb-2">
            Silakan masuk untuk mengakses fitur ini
          </p>
          <p className="text-xs text-slate-400 max-w-md mb-8 leading-relaxed">
            Data inventaris, riwayat transaksi, dan modul operasional hanya dapat diakses oleh akun civitas akademika Sekolah Vokasi IPB yang telah terautentikasi.
          </p>

          {/* CTA Buttons */}
          <div className="w-full max-w-xs flex flex-col gap-2.5">
            <button
              id="locked-page-login-btn"
              onClick={() => onOpenAuth("login")}
              className="w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-[#061A33] hover:bg-[#022B5F] text-white text-sm font-semibold transition-all shadow-sm hover:shadow cursor-pointer active:scale-[0.99]"
            >
              <LogIn size={16} />
              <span>Masuk</span>
              <ArrowRight size={14} className="opacity-70 ml-0.5" />
            </button>

            <button
              onClick={() => onOpenAuth("register")}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer border border-slate-200"
            >
              <span>Belum punya akun? Daftar</span>
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <p className="mt-8 text-[11px] text-slate-400">
          Sistem Manajemen Aset • Sekolah Vokasi Institut Pertanian Bogor
        </p>
      </div>
    </main>
  );
}

export default LockedPage;
