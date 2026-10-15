import React, { useState, useRef, useEffect } from "react";
import { AppProvider, useApp } from "./components/AppContext";
import { DataStoreProvider, useDataStore } from "./components/DataStore";
import type { TableDensity, AppLanguage } from "./components/AppContext";
import { authService } from "./services/authService";
import { ensureAuthToken } from "./services/apiClient";
import { AuthModal, type AuthMode } from "./components/AuthModal";
import { MutasiPage } from "./components/MutasiPage";
import { PerbaikanPage } from "./components/PerbaikanPage";
import { PengadaanPage } from "./components/PengadaanPage";
import { StockOpnamePage } from "./components/StockOpnamePage";
import { ObservasiPage } from "./components/ObservasiPage";
import { DokumenPage } from "./components/DokumenPage";
import { PenggunaPage } from "./components/PenggunaPage";
import { AktivitasPage } from "./components/AktivitasPage";
import { OverviewPage } from "./components/OverviewPage";
import { AsetDataTable } from "./components/AsetDataTable";
import { EksekutifPage, DashSubPageFull } from "./components/DashboardPages";
import { PICPage } from "./components/PICPage";
import asistenAiLogo from "../imports/Asisten_AI_Aset_SV_IPB.png";
import svIpbLogo from "../imports/Aset_IPB_Logo.png";
import {
  Database, MapPin, Users, ArrowLeftRight, Wrench, ClipboardList,
  ShoppingCart, FileText, BarChart2, ScrollText, Settings,
  ChevronDown, ChevronRight, Bell, Search, Sparkles, Filter,
  Download, Info, LayoutDashboard, Calendar, User, LogOut, LogIn,
  Camera, Shield, BellRing, Smartphone, Lock, MessageSquare,
  Plus, X, Send, Bot, Clock, Layers, Menu,
  HelpCircle, Share2, ChevronsUpDown, Headset
} from "lucide-react";

// ── Palette ───────────────────────────────────────────────────────────────────
const P       = "#111827";
const P_MID   = "#9CA3AF";
const P_LIGHT = "#E5E7EB";
const P_XLIGHT= "#F3F4F6";
const P_DARK  = "#1F2937";
const ORANGE  = "#111827";
const GREEN   = "#22C55E";
const RED     = "#EF4444";
const G100    = "#F3F4F6";
const G200    = "#E5E7EB";
const G400    = "#9CA3AF";
const G800    = "#111827";
const G900    = "#1F2937";


// ── Generic Avatar (dummy user silhouette) ────────────────────────────────────
function GenericAvatar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={className}>
      <circle cx="50" cy="50" r="50" fill="#E5E7EB" />
      <circle cx="50" cy="37" r="18" fill="#9CA3AF" />
      <ellipse cx="50" cy="87" rx="30" ry="24" fill="#9CA3AF" />
    </svg>
  );
}

// ── Logo ──────────────────────────────────────────────────────────────────────
function Logo({ className }: { className?: string }) {
  return (
    <div className={className || "w-14 h-14 shrink-0 flex items-center justify-center -ml-1"}>
      <img src={svIpbLogo} alt="Manajemen Aset" className="w-full h-full object-contain" />
    </div>
  );
}

// ── NavItem ─────────────────────────────────────────────────────────────────
type IC = React.ComponentType<{ size?: number; className?: string }>;

function NavItem({ icon: Icon, label, active, badge, onClick }: {
  icon: IC; label: string; active?: boolean; badge?: string; onClick?: () => void;
}) {
  return (
    <div onClick={onClick} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
      active ? "bg-gray-100" : "hover:bg-gray-50"
    }`}>
      <Icon size={15} className={active ? "text-gray-700" : "text-gray-400"} />
      <span className={`text-sm flex-1 ${active ? "font-semibold text-gray-800" : "text-gray-500"}`}>
        {label}
      </span>
      {badge && (
        <span className="text-[9px] font-bold bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
          {badge}
        </span>
      )}
    </div>
  );
}

// ── User Profile Menu ────────────────────────────────────────────────────────
function UserProfileMenu({
  setPage,
  onOpenAuth,
}: {
  setPage: (p: string) => void;
  onOpenAuth: (mode?: AuthMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const { userProfile, showToast } = useApp();
  const { currentUser } = useDataStore();

  const displayName = currentUser?.nama || userProfile?.nama || "Pengguna";
  const displayEmail = currentUser?.email || userProfile?.email || "user@apps.ipb.ac.id";
  const displayRole = currentUser?.role || userProfile?.jabatan || "Administrator";
  const truncatedName = displayName.length > 13 ? `${displayName.slice(0, 10)}...` : displayName;

  const handleLogout = async () => {
    setOpen(false);
    await authService.logout();
    showToast("Anda telah keluar dari sesi sistem", "info");
    onOpenAuth("login");
  };

  return (
    <div className="relative">
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-full bg-white border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.08)] rounded-xl z-50 overflow-hidden py-1.5 animate-in fade-in zoom-in-95 duration-100">
            <div className="px-3 py-2.5 border-b border-gray-100 mb-1 bg-gray-50/50">
              <p className="text-sm font-bold text-gray-900 truncate">{displayName}</p>
              <p className="text-[10px] text-gray-500 mt-0.5 truncate">{displayRole} • {displayEmail}</p>
            </div>
            
            <button 
              onClick={() => { setPage("profile"); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-left transition-colors"
            >
              <User size={14} className="text-gray-500" />
              <span className="text-xs text-gray-700 font-medium">Profil Saya</span>
            </button>

            <button 
              onClick={() => { setOpen(false); onOpenAuth("login"); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50 text-left transition-colors"
            >
              <LogIn size={14} className="text-blue-600" />
              <span className="text-xs text-blue-700 font-medium">Ganti Akun / Masuk</span>
            </button>
            
            <div className="my-1 border-t border-gray-100" />
            
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-red-50 text-left transition-colors group"
            >
              <LogOut size={14} className="text-red-500 group-hover:text-red-600" />
              <span className="text-xs text-red-600 font-medium">Keluar</span>
            </button>
          </div>
        </>
      )}

      <div
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        onClick={() => setOpen(!open)}
        className={`w-full h-[43px] flex items-center gap-[12px] pl-[3.5px] pr-[10px] rounded-[8px] cursor-pointer transition-all border border-[#EFEFEF] shadow-[0_2px_8px_rgba(0,0,0,0.04)] ${
          open ? "bg-[#F3F4F6]" : "bg-[#FAFAFA] hover:bg-[#F3F4F6]"
        }`}
      >
        <div className="w-[36px] h-[36px] bg-white rounded-full shrink-0 overflow-hidden">
          {userProfile?.avatar_url ? (
            <img src={userProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <GenericAvatar className="w-full h-full" />
          )}
        </div>
        <span className="flex-1 text-[16px] font-semibold text-[#061A33] min-w-0 truncate tracking-tight">
          {truncatedName}
        </span>
        <div className="w-[25px] h-[25px] rounded-full bg-white flex items-center justify-center shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A0A4AA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m7 15 5 5 5-5" style={{ transform: isPressed ? 'translateY(3px)' : 'translateY(0)', transition: 'transform 0.15s ease-out' }} />
            <path d="m7 9 5-5 5 5" style={{ transform: isPressed ? 'translateY(-3px)' : 'translateY(0)', transition: 'transform 0.15s ease-out' }} />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────���────────────────����────────────
function Sidebar({
  page,
  setPage,
  onOpenAuth,
}: {
  page: string;
  setPage: (p: string) => void;
  onOpenAuth: (mode?: AuthMode) => void;
}) {
  const [dashboardOpen, setDashboardOpen] = useState(true);
  const [dataAsetOpen, setDataAsetOpen] = useState(true);
  const [lokasiOpen, setLokasiOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { currentUser } = useDataStore();

  const role = currentUser?.role || "Admin Sistem";
  const isPekerja = role === "Pekerja Stock Opname";

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-gray-100 flex flex-col py-5 px-4 overflow-y-auto">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-2 mb-3">
        <Logo />
        <div>
          <div className="text-base font-bold text-gray-900 leading-tight">Aset SV IPB</div>
          <div className="text-[11.5px] text-gray-400 mt-0.5 leading-tight">Manajemen Aset</div>
        </div>
      </div>

      {/* User profile — top of sidebar, matches reference layout */}
      <UserProfileMenu setPage={setPage} onOpenAuth={onOpenAuth} />

      <div className="my-3 border-t border-gray-100" />

      {/* DATA MASTER */}
      <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 px-3 mb-1.5">Master Data</p>

      {/* Ringkasan */}
      <NavItem icon={Layers} label="Overview" active={page === "ringkasan"} onClick={() => setPage("ringkasan")} />

      {/* Dashboard — expandable */}
      <div>
        <div
          onClick={() => { setDashboardOpen((v) => !v); setPage("dash-analitik"); }}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${["dashboard", "dash-analitik", "dash-keuangan", "dash-kondisi", "dash-monitoring", "dash-pengadaan", "dash-maintenance"].includes(page) ? "bg-gray-100" : "hover:bg-gray-50"}`}
        >
          <LayoutDashboard size={15} className="text-gray-700 shrink-0" />
          <span className="text-sm font-semibold text-gray-800 flex-1">Dashboard</span>
          {dashboardOpen
            ? <ChevronDown size={13} className="text-gray-400 shrink-0" />
            : <ChevronRight size={13} className="text-gray-400 shrink-0" />
          }
        </div>
        {dashboardOpen && (
          <div className="ml-6 mt-0.5 mb-1 flex flex-col gap-0.5 border-l border-gray-200 pl-3">
            {[
              { id: "dash-analitik",   label: "Analitik"    },
              { id: "dash-keuangan",   label: "Keuangan"    },
              { id: "dash-kondisi",    label: "Kondisi"     },
              { id: "dash-monitoring", label: "Pertumbuhan Aset" },
              { id: "dash-pengadaan",  label: "Pengadaan"   },
              { id: "dash-maintenance",label: "Maintenance" },
            ].map(({ id, label }) => (
              <div key={id} onClick={() => setPage(id)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${page === id ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${page === id ? "bg-gray-600" : "border border-gray-400"}`} />
                <span className={`text-xs ${page === id ? "text-gray-800 font-medium" : "text-gray-500"}`}>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Data Aset — expandable */}
      <div>
        <div
          onClick={() => { setDataAsetOpen((v) => !v); setPage("data-aset"); }}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${page === "data-aset" || ["pm","atb","atl","al"].includes(page) ? "bg-gray-100" : "hover:bg-gray-50"}`}
        >
          <Database size={15} className="text-gray-700 shrink-0" />
          <span className="text-sm font-semibold text-gray-800 flex-1">Data Aset</span>
          {dataAsetOpen
            ? <ChevronDown size={13} className="text-gray-400 shrink-0" />
            : <ChevronRight size={13} className="text-gray-400 shrink-0" />
          }
        </div>
        {dataAsetOpen && (
          <div className="ml-6 mt-0.5 mb-1 flex flex-col gap-0.5 border-l border-gray-200 pl-3">
            {([
              { label: "Peralatan & Mesin (PM)",   key: "pm"  },
              { label: "Aset Tak Berwujud (ATB)",  key: "atb" },
              { label: "Aset Tetap Lainnya (ATL)", key: "atl" },
              { label: "Alat Angkutan (AL)",        key: "al"  },
            ] as { label: string; key: string }[]).map(({ label, key }) => (
              <div key={key} onClick={() => setPage(key)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${page === key ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${page === key ? "bg-gray-600" : "border border-gray-400"}`} />
                <span className={`text-xs ${page === key ? "text-gray-800 font-medium" : "text-gray-500"}`}>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lokasi & Ruangan — expandable */}
      <div>
        <div
          onClick={() => { setLokasiOpen((v) => !v); setPage("kampus-cilibende"); }}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${page === "lokasi" || ["kampus-cilibende", "kampus-gunung-gede", "kampus-pajajaran", "kampus-baranangsiang", "kampus-lainnya", "kampus-belum-dikategorikan"].includes(page) ? "bg-gray-100" : "hover:bg-gray-50"}`}
        >
          <MapPin size={15} className="text-gray-700 shrink-0" />
          <span className="text-sm font-semibold text-gray-800 flex-1">Lokasi & Ruangan</span>
          {lokasiOpen
            ? <ChevronDown size={13} className="text-gray-400 shrink-0" />
            : <ChevronRight size={13} className="text-gray-400 shrink-0" />
          }
        </div>
        {lokasiOpen && (
          <div className="ml-6 mt-0.5 mb-1 flex flex-col gap-0.5 border-l border-gray-200 pl-3">
            {([
              { label: "Kampus Cilibende",          key: "kampus-cilibende"      },
              { label: "Kampus Gunung Gede",        key: "kampus-gunung-gede"    },
              { label: "Kampus Pajajaran",          key: "kampus-pajajaran"      },
              { label: "Kampus Baranangsiang",     key: "kampus-baranangsiang"  },
              { label: "Kampus / Lokasi Lainnya",   key: "kampus-lainnya"        },
              { label: "Belum Dikategorikan",        key: "kampus-belum-dikategorikan" },
            ] as { label: string; key: string }[]).map(({ label, key }) => (
              <div key={key} onClick={() => setPage(key)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${page === key ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${page === key ? (key === "kampus-belum-dikategorikan" ? "bg-amber-500" : "bg-gray-600") : (key === "kampus-belum-dikategorikan" ? "border border-amber-400" : "border border-gray-400")}`} />
                <span className={`text-xs ${page === key ? (key === "kampus-belum-dikategorikan" ? "text-amber-700 font-medium" : "text-gray-800 font-medium") : "text-gray-500"}`}>{label}</span>
                {key === "kampus-belum-dikategorikan" && (
                  <HelpCircle size={11} className="text-amber-400 shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <NavItem icon={Users}  label="Penanggung Jawab" active={page === "pic"}    onClick={() => setPage("pic")} />

      <div className="my-3 border-t border-gray-100" />

      {/* TRANSAKSI */}
      <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 px-3 mb-1.5">Transaksi</p>
      {!isPekerja && (
        <NavItem icon={ArrowLeftRight} label="Mutasi Aset" active={page === "mutasi"} onClick={() => setPage("mutasi")} />
      )}
      {!isPekerja && (
        <NavItem icon={Wrench} label="Perbaikan" active={page === "maintenance"} onClick={() => setPage("maintenance")} />
      )}
      <NavItem icon={ClipboardList}  label="Stock Opname"      active={page === "stock"}       onClick={() => setPage("stock")} />
      <NavItem icon={Search}         label="Observasi Ruangan" active={page === "observasi"}   onClick={() => setPage("observasi")} />
      {!isPekerja && (
        <NavItem icon={ShoppingCart} label="Pengadaan" active={page === "pengadaan"} onClick={() => setPage("pengadaan")} />
      )}

      {/* DOKUMENTASI & PELAPORAN */}
      {!isPekerja && (
        <>
          <div className="my-3 border-t border-gray-100" />
          <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 px-3 mb-1.5">Dokumentasi & Pelaporan</p>
          <NavItem icon={FileText}   label="Dokumen"   active={page === "dokumen"}   onClick={() => setPage("dokumen")} />
          <NavItem icon={ScrollText} label="Aktivitas" active={page === "aktivitas"} onClick={() => setPage("aktivitas")} />
        </>
      )}

      {/* SISTEM */}
      {!isPekerja && (
        <>
          <div className="my-3 border-t border-gray-100" />
          <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 px-3 mb-1.5">Sistem</p>
          <NavItem icon={Users} label="Pengguna" active={page === "pengguna"} onClick={() => setPage("pengguna")} />
        </>
      )}

      <div className="flex-1" />

      <div className="-mx-4 mt-6 flex flex-col mb-4">
        <div>
          <div 
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="flex items-center h-[44px] pl-[32px] pr-[12px] cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <Settings size={18} strokeWidth={1.7} className="text-[#242424] shrink-0" />
            <span className="ml-[8px] text-sm font-medium text-[#242424] flex-1 tracking-tight">Settings</span>
            <ChevronRight 
              size={16} 
              strokeWidth={1.7} 
              className={`text-[#1F1F1F] shrink-0 transition-transform duration-200 ${settingsOpen ? "rotate-90" : ""}`} 
            />
          </div>
          <div className={`overflow-hidden transition-all duration-200 ${settingsOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
            <div className="flex flex-col py-1">
              <div 
                onClick={() => setPage("pengaturan")} 
                className={`pl-[58px] py-2 text-sm cursor-pointer ${page === "pengaturan" ? "text-[#111827] font-medium" : "text-gray-500 hover:text-gray-800"}`}
              >
                Umum
              </div>
              <div 
                onClick={() => setPage("preferensi")}
                className={`pl-[58px] py-2 text-sm cursor-pointer ${page === "preferensi" ? "text-[#111827] font-medium" : "text-gray-500 hover:text-gray-800"}`}
              >
                Preferensi
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-1">
          <div 
            onClick={() => setHelpOpen(!helpOpen)}
            className="flex items-center h-[44px] pl-[32px] pr-[12px] cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <Headset size={18} strokeWidth={1.7} className="text-[#242424] shrink-0" />
            <span className="ml-[8px] text-sm font-medium text-[#242424] flex-1 tracking-tight">Help Center</span>
            <ChevronRight 
              size={16} 
              strokeWidth={1.7} 
              className={`text-[#1F1F1F] shrink-0 transition-transform duration-200 ${helpOpen ? "rotate-90" : ""}`} 
            />
          </div>
          <div className={`overflow-hidden transition-all duration-200 ${helpOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
            <div className="flex flex-col py-1">
              <div 
                onClick={() => setPage("panduan-pengguna")}
                className={`pl-[58px] py-2 text-sm cursor-pointer ${page === "panduan-pengguna" ? "text-[#111827] font-medium" : "text-gray-500 hover:text-gray-800"}`}
              >
                Panduan Pengguna
              </div>
              <div 
                onClick={() => setPage("hubungi-dukungan")}
                className={`pl-[58px] py-2 text-sm cursor-pointer ${page === "hubungi-dukungan" ? "text-[#111827] font-medium" : "text-gray-500 hover:text-gray-800"}`}
              >
                Hubungi Dukungan
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}



// ── Share Modal ───────────────────────────────────────────────────────────────
function ShareModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const { showToast } = useApp();
  const shareUrl = "https://aset.sv.ipb.ac.id/dashboard";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      showToast("Tautan berhasil disalin ke clipboard!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast("Gagal menyalin tautan.", "error");
    }
  };

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[420px] bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-gray-700" />
            <span className="text-sm font-bold text-gray-900">Bagikan Halaman</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Tautan Halaman</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-600 truncate font-mono select-all">
                {shareUrl}
              </div>
              <button
                onClick={handleCopy}
                className={`shrink-0 px-4 py-2.5 rounded-lg text-xs font-semibold transition-all ${copied ? "bg-green-500 text-white" : "bg-gray-900 text-white hover:bg-black"}`}
              >
                {copied ? "✓ Disalin" : "Salin"}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Bagikan Via</label>
            <div className="flex gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent("Lihat dashboard Aset SV IPB: " + shareUrl)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-100 transition-colors"
              >
                <MessageSquare size={14} /> WhatsApp
              </a>
              <a
                href={`mailto:?subject=Dashboard Aset SV IPB&body=Akses dashboard di: ${shareUrl}`}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors"
              >
                <Send size={14} /> Email
              </a>
            </div>
          </div>
          <p className="text-[10px] text-gray-400 text-center">Hanya pengguna dengan akun terdaftar yang dapat mengakses halaman ini.</p>
        </div>
      </div>
    </>
  );
}

// ── AI Panel ─────────────────────────────────────────────────────────────────
function AIPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { userProfile } = useApp();
  const userName = userProfile?.nama ? userProfile.nama.split(" ")[0] : "Pengguna";
  const [view, setView] = useState<"chat" | "history">("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    { id: 1, role: "ai", text: `Halo ${userName}! Saya AI Assistant Aset SV IPB. Ada yang bisa saya bantu terkait manajemen aset hari ini?` }
  ]);

  const [history, setHistory] = useState([
    { id: "h1", title: "Analisis penyusutan aset IT", date: "Hari ini" },
    { id: "h2", title: "Cara export data mutasi", date: "Kemarin" },
    { id: "h3", title: "Draft email laporan stok", date: "3 hari yang lalu" },
  ]);

  const handleSend = () => {
    if (!input.trim()) return;
    const newMsg = { id: Date.now(), role: "user", text: input };
    setMessages([...messages, newMsg]);
    setInput("");

    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: "ai",
        text: "Saya mengerti. Mari saya bantu analisis data tersebut. Berdasarkan data sistem, penyusutan rata-rata bulan ini adalah 4.2%."
      }]);
    }, 800);
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-gray-900/20 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
      <div className="fixed top-0 right-0 h-screen w-[400px] bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView(view === "chat" ? "history" : "chat")}
              className={`p-1.5 rounded-md transition-colors ${view === "history" ? "bg-purple-100 text-purple-600" : "text-gray-500 hover:bg-gray-200"}`}
              title="Riwayat Percakapan"
            >
              <Clock size={16} />
            </button>
            <button
              onClick={() => { setView("chat"); setMessages([{ id: 1, role: "ai", text: `Halo ${userName}! Ada hal baru yang ingin didiskusikan hari ini?` }]); }}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-200 transition-colors"
              title="Percakapan Baru"
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="text-sm font-bold text-gray-800 flex items-center gap-2">
            <img src={asistenAiLogo} alt="AI Logo" className="w-7 h-7 object-contain" />
            Asisten AI
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-gray-500 hover:bg-gray-200 transition-colors" title="Tutup">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
          {view === "history" ? (
            <div className="absolute inset-0 overflow-y-auto bg-gray-50/50 p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Riwayat Pencarian</h3>
              <div className="space-y-2">
                {history.map(item => (
                  <button key={item.id} onClick={() => setView("chat")} className="w-full text-left p-3 rounded-xl bg-white border border-gray-200 hover:border-purple-300 hover:shadow-sm transition-all group">
                    <div className="text-sm font-medium text-gray-800 truncate mb-1 group-hover:text-purple-600">{item.title}</div>
                    <div className="text-[10px] text-gray-400">{item.date}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col bg-white">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(m => (
                  <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                    {m.role === "user" ? (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-gray-900 text-white font-medium">
                        S
                      </div>
                    ) : (
                      <div className="w-10 h-10 flex items-center justify-center shrink-0">
                        <img src={asistenAiLogo} alt="AI" className="w-10 h-10 object-contain" />
                      </div>
                    )}
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-gray-900 text-white rounded-tr-sm" : "bg-gray-100 text-gray-800 rounded-tl-sm"}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="p-4 bg-white border-t border-gray-100">
                <div className="relative flex items-end gap-2 bg-gray-50 border border-gray-200 rounded-xl p-1.5 focus-within:ring-1 focus-within:ring-purple-500 focus-within:border-purple-500 transition-all">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder="Tanyakan sesuatu ke AI..."
                    className="flex-1 max-h-32 min-h-[40px] bg-transparent resize-none outline-none text-sm text-gray-700 py-2.5 px-3 placeholder:text-gray-400"
                    rows={1}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-white transition-colors mb-1 mr-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: ORANGE }}
                  >
                    <Send size={14} />
                  </button>
                </div>
                <div className="text-[10px] text-center text-gray-400 mt-2">
                  Asisten AI dapat membuat kesalahan. Periksa kembali info penting.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ���─ Top Bar (shared) ──────────────────────────────────────────────────────────
function TopBar({ title, breadcrumbs }: { title?: string; breadcrumbs?: string[] }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [notifViewAll, setNotifViewAll] = useState(false);
  const { notifications, markAllRead, markRead, unreadCount } = useApp();

  return (
    <>
      <div className="sticky top-0 z-10 bg-[#FFFFFF] border-b border-[#ECECEC] flex items-center px-8 h-[72px]">
        {/* LEFT: page breadcrumb */}
        <div className="flex items-center shrink-0 gap-2.5" style={{ minWidth: "250px" }}>
          <img src={svIpbLogo} alt="IPB Logo" className="w-7 h-7 object-contain" />
          
          {breadcrumbs ? (
            <div className="flex items-center gap-2.5">
              {(Array.isArray(breadcrumbs) ? breadcrumbs : [breadcrumbs]).map((crumb, idx) => (
                <React.Fragment key={idx}>
                  <ChevronRight size={16} strokeWidth={2} className="text-[#8A8A8A]" />
                  <h1 className={`text-[15px] tracking-tight ${idx === breadcrumbs.length - 1 ? 'font-semibold text-[#171717]' : 'font-medium text-[#6F737A]'}`}>
                    {crumb}
                  </h1>
                </React.Fragment>
              ))}
            </div>
          ) : title && (
            <>
              <ChevronRight size={16} strokeWidth={2} className="text-[#8A8A8A]" />
              <h1 className="text-[16px] font-semibold text-[#171717] tracking-tight">{title}</h1>
            </>
          )}
        </div>

        {/* CENTER: flexible space */}
        <div className="flex-1" />

        {/* RIGHT: action buttons */}
        <div className="flex items-center justify-end gap-[10px] shrink-0 relative pr-4">
          <div className="flex items-center gap-2 bg-[#FFFFFF] border border-[#E5E5E5] rounded-[8px] px-3 h-[38px] w-64">
            <Search size={16} strokeWidth={1.7} className="text-[#6F737A] shrink-0" />
            <input className="text-[15px] text-[#171717] bg-transparent outline-none flex-1 min-w-0 placeholder:text-[#8A8A8A]"
              placeholder="Search..." />
            <div className="flex items-center justify-center bg-[#F6F6F6] border border-[#E7E7E7] rounded-[6px] w-[32px] h-[22px] shrink-0">
              <span className="text-[12px] font-medium text-[#777777]">⌘K</span>
            </div>
          </div>
          <button
            onClick={() => setShowAI(true)}
            className="flex items-center gap-1.5 h-[38px] pl-3 pr-4 rounded-[8px] border border-[#6B7280] bg-[#FFFFFF] transition-colors hover:bg-gray-100"
            title="Tanya AI"
          >
            <img src={asistenAiLogo} alt="AI Logo" className="w-7 h-7 object-contain" />
            <span className="text-[14px] font-medium text-[#6B7280]">Tanya AI</span>
          </button>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-[38px] h-[38px] rounded-[8px] border border-[#6B7280] bg-[#FFFFFF] flex items-center justify-center hover:bg-gray-50 transition-colors relative"
            title="Notifikasi"
          >
            <Bell size={18} strokeWidth={1.7} className="text-[#6B7280]" />
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1">{unreadCount}</span>}
          </button>
          <button
            onClick={() => setShowShare(true)}
            className="w-[38px] h-[38px] rounded-[8px] border border-[#6B7280] bg-[#FFFFFF] flex items-center justify-center hover:bg-gray-50 transition-colors"
            title="Bagikan"
          >
            <Share2 size={18} strokeWidth={1.7} className="text-[#6B7280]" />
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => { setShowNotifications(false); setNotifViewAll(false); }} />
              <div className="absolute top-full right-0 mt-2 w-[340px] bg-white border border-gray-200 shadow-lg rounded-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900">Notifikasi</span>
                    {unreadCount > 0 && (
                      <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{unreadCount} baru</span>
                    )}
                  </div>
                  <button
                    onClick={markAllRead}
                    disabled={unreadCount === 0}
                    className={`text-[11px] font-medium transition-colors ${unreadCount > 0 ? "hover:underline cursor-pointer" : "text-gray-400 cursor-default"}`}
                    style={{ color: unreadCount > 0 ? P : undefined }}
                  >
                    Tandai semua dibaca
                  </button>
                </div>
                <div className={`overflow-y-auto transition-all duration-200 ${notifViewAll ? "max-h-[460px]" : "max-h-[300px]"}`}>
                  {(notifViewAll ? notifications : notifications.slice(0, 3)).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      className={`p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors ${n.unread ? "bg-purple-50/30" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.unread ? "bg-purple-500" : "bg-transparent border border-gray-300"}`}></div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${n.unread ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>{n.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                          <p className="text-[10px] text-gray-400 mt-1.5 font-medium">{n.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-gray-100 bg-gray-50/50 text-center">
                  <button
                    onClick={() => setNotifViewAll((v) => !v)}
                    className="text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    {notifViewAll ? "↑ Ciutkan" : `Lihat Semua (${notifications.length})`}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <AIPanel open={showAI} onClose={() => setShowAI(false)} />
      <ShareModal open={showShare} onClose={() => setShowShare(false)} />
    </>
  );
}

// ── Pages ─────────────────────────────────────────────────────────────────────

function ProfilePage({ breadcrumbs }: { breadcrumbs: string[] }) {
  const { userProfile, updateUserProfile, isProfileLoading, showToast } = useApp();
  const [profileImgUrl, setProfileImgUrl] = useState<string | null>(userProfile?.avatar_url || null);
  const [isBannerOpen, setIsBannerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Controlled form state initialized from userProfile
  const [formData, setFormData] = useState({
    nama: userProfile?.nama || "",
    email: userProfile?.email || "",
    no_telp: userProfile?.no_telp || "",
    jabatan: userProfile?.jabatan || "Administrator",
    lokasi: userProfile?.lokasi || "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Synchronize formData if userProfile changes
  useEffect(() => {
    if (userProfile) {
      setFormData({
        nama: userProfile.nama || "",
        email: userProfile.email || "",
        no_telp: userProfile.no_telp || "",
        jabatan: userProfile.jabatan || "Administrator",
        lokasi: userProfile.lokasi || "",
      });
      setProfileImgUrl(userProfile.avatar_url || null);
      setIsDirty(false);
    }
  }, [userProfile]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    
    // Nama validation: min 3 chars
    if (!formData.nama.trim()) {
      errs.nama = "Nama lengkap wajib diisi.";
    } else if (formData.nama.trim().length < 3) {
      errs.nama = "Nama lengkap minimal 3 karakter.";
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      errs.email = "Alamat email wajib diisi.";
    } else if (!emailRegex.test(formData.email.trim())) {
      errs.email = "Format alamat email tidak valid.";
    }

    // Telepon validation (Indonesian phone format or general valid phone)
    const phoneRegex = /^(\+62|62|0)8[0-9]{8,12}$/;
    const cleanPhone = formData.no_telp.replace(/[\s-]/g, "");
    if (!formData.no_telp.trim()) {
      errs.no_telp = "Nomor telepon wajib diisi.";
    } else if (!phoneRegex.test(cleanPhone)) {
      errs.no_telp = "Format nomor telepon tidak valid (contoh: 081234567890 atau +6281234567890).";
    }

    // Lokasi validation: max 100 chars
    if (formData.lokasi && formData.lokasi.length > 100) {
      errs.lokasi = "Lokasi maksimal 100 karakter.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      showToast("Mohon perbaiki kesalahan input pada form.", "error");
      return;
    }

    try {
      await updateUserProfile({
        nama: formData.nama.trim(),
        email: formData.email.trim(),
        no_telp: formData.no_telp.trim(),
        lokasi: formData.lokasi.trim(),
      });
      setIsDirty(false);
      showToast("Profil berhasil diperbarui!");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Gagal memperbarui profil. Silakan coba lagi.";
      showToast(msg, "error");
    }
  };

  const handleCancel = () => {
    setFormData({
      nama: userProfile?.nama || "",
      email: userProfile?.email || "",
      no_telp: userProfile?.no_telp || "",
      jabatan: userProfile?.jabatan || "Administrator",
      lokasi: userProfile?.lokasi || "",
    });
    setProfileImgUrl(userProfile?.avatar_url || null);
    setErrors({});
    setIsDirty(false);
    showToast("Perubahan dibatalkan.", "info");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      setProfileImgUrl(url);
      setIsDirty(true);
      showToast("Foto profil diperbarui sementara.");
    }
  };

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 min-w-0">
      <TopBar breadcrumbs={breadcrumbs} />
      <div className="px-8 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Profil Saya</h1>
            <p className="text-xs text-gray-500 mt-0.5">Kelola data profil akun dan informasi kontak Anda</p>
          </div>
          {isDirty && (
            <span className="text-xs px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full font-medium animate-pulse">
              Ada perubahan yang belum disimpan
            </span>
          )}
        </div>
        
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Banner */}
          <div
            className="h-32 relative overflow-hidden bg-[#D1D5DB] cursor-pointer group"
            onClick={() => setIsBannerOpen(true)}
          >
            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
              <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-semibold text-gray-800 flex items-center gap-2 shadow-sm">
                <Search size={16} />
                Lihat Banner
              </div>
            </div>
          </div>
          
          <div className="px-6 pb-6 relative">
            {/* Avatar */}
            <div className="absolute -top-12 left-6 z-20">
              <div
                className="w-24 h-24 rounded-full border-4 border-white bg-white shadow-sm relative group cursor-pointer overflow-hidden"
                onClick={() => fileInputRef.current?.click()}
                title="Klik untuk ubah foto profil"
              >
                {profileImgUrl
                  ? <img src={profileImgUrl} alt="Profile" className="w-full h-full object-cover" />
                  : <GenericAvatar className="w-full h-full" />
                }
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera size={20} className="text-white" />
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileChange} 
                />
              </div>
            </div>
            
            {/* Header info */}
            <div className="ml-28 pl-4 pt-3 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{formData.nama || "Nama Pengguna"}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{formData.jabatan} • {formData.email}</p>
              </div>
              <div className="flex gap-2">
                 <button 
                   type="button"
                   onClick={handleCancel}
                   disabled={isProfileLoading}
                   className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                 >
                   Batal
                 </button>
                 <button 
                   type="button"
                   onClick={handleSave} 
                   disabled={isProfileLoading}
                   className="px-4 py-2 text-white text-xs font-semibold rounded-lg transition-colors hover:opacity-90 flex items-center gap-2 disabled:opacity-50" 
                   style={{ backgroundColor: P }}
                 >
                   {isProfileLoading ? (
                     <>
                       <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                       <span>Menyimpan...</span>
                     </>
                   ) : (
                     "Simpan Perubahan"
                   )}
                 </button>
              </div>
            </div>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
               {/* Kolom Informasi Pribadi */}
               <div className="space-y-4">
                 <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">Informasi Pribadi</h3>
                 
                 <div>
                   <label className="block text-xs font-medium text-gray-700 mb-1.5">
                     Nama Lengkap <span className="text-red-500">*</span>
                   </label>
                   <input 
                     type="text" 
                     value={formData.nama} 
                     onChange={(e) => handleChange("nama", e.target.value)}
                     placeholder="Masukkan nama lengkap"
                     className={`w-full text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 ${
                       errors.nama ? "border-red-400 focus:ring-red-400 bg-red-50/20" : "border-gray-200"
                     }`} 
                     style={!errors.nama ? { '--tw-ring-color': P } as React.CSSProperties : undefined} 
                   />
                   {errors.nama && (
                     <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
                       <span>⚠️</span> {errors.nama}
                     </p>
                   )}
                 </div>
                 
                 <div>
                   <label className="block text-xs font-medium text-gray-700 mb-1.5">
                     Alamat Email <span className="text-red-500">*</span>
                   </label>
                   <input 
                     type="email" 
                     value={formData.email} 
                     onChange={(e) => handleChange("email", e.target.value)}
                     placeholder="nama@apps.ipb.ac.id"
                     className={`w-full text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 ${
                       errors.email ? "border-red-400 focus:ring-red-400 bg-red-50/20" : "border-gray-200"
                     }`} 
                     style={!errors.email ? { '--tw-ring-color': P } as React.CSSProperties : undefined} 
                   />
                   {errors.email && (
                     <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
                       <span>⚠️</span> {errors.email}
                     </p>
                   )}
                 </div>
                 
                 <div>
                   <label className="block text-xs font-medium text-gray-700 mb-1.5">
                     Nomor Telepon <span className="text-red-500">*</span>
                   </label>
                   <input 
                     type="tel" 
                     value={formData.no_telp} 
                     onChange={(e) => handleChange("no_telp", e.target.value)}
                     placeholder="Contoh: 081234567890"
                     className={`w-full text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 ${
                       errors.no_telp ? "border-red-400 focus:ring-red-400 bg-red-50/20" : "border-gray-200"
                     }`} 
                     style={!errors.no_telp ? { '--tw-ring-color': P } as React.CSSProperties : undefined} 
                   />
                   {errors.no_telp && (
                     <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1">
                       <span>⚠️</span> {errors.no_telp}
                     </p>
                   )}
                 </div>
               </div>

               {/* Kolom Jabatan & Lokasi */}
               <div className="space-y-4">
                 <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">Jabatan & Lokasi</h3>
                 
                 <div>
                   <div className="flex items-center justify-between mb-1.5">
                     <label className="block text-xs font-medium text-gray-700">Jabatan</label>
                     <span className="text-[10px] text-gray-400 italic">Read-only (Dikelola Administrator)</span>
                   </div>
                   <select 
                     className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed outline-none" 
                     disabled
                     value={formData.jabatan}
                   >
                     <option value="Administrator">Administrator</option>
                     <option value="Operator Aset">Operator Aset</option>
                     <option value="Verifikator">Verifikator</option>
                   </select>
                   <p className="text-[11px] text-gray-400 mt-1">Jabatan ditentukan secara terpusat oleh sistem.</p>
                 </div>
                 
                 <div>
                   <label className="block text-xs font-medium text-gray-700 mb-1.5">Lokasi Kerja</label>
                   <input 
                     type="text" 
                     value={formData.lokasi} 
                     onChange={(e) => handleChange("lokasi", e.target.value)}
                     placeholder="Contoh: Rektorat IPB, Lt. 3"
                     maxLength={100}
                     className={`w-full text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 ${
                       errors.lokasi ? "border-red-400 focus:ring-red-400 bg-red-50/20" : "border-gray-200"
                     }`} 
                     style={!errors.lokasi ? { '--tw-ring-color': P } as React.CSSProperties : undefined} 
                   />
                   <div className="flex justify-between items-center mt-1">
                     {errors.lokasi ? (
                       <p className="text-[11px] text-red-500 flex items-center gap-1">
                         <span>⚠️</span> {errors.lokasi}
                       </p>
                     ) : <span />}
                     <span className="text-[10px] text-gray-400">{formData.lokasi.length}/100 karakter</span>
                   </div>
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Banner Modal */}
      {isBannerOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8 animate-in fade-in duration-200" 
          onClick={() => setIsBannerOpen(false)}
        >
          <div 
            className="relative max-w-5xl w-full flex flex-col items-center animate-in zoom-in-95 duration-300" 
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setIsBannerOpen(false)} 
              className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors"
            >
              <X size={28} />
            </button>
            <div
              className="w-full relative rounded-xl overflow-hidden shadow-2xl bg-[#D1D5DB]"
              style={{ aspectRatio: "6.5 / 1" }}
            >
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SettingsPage({ breadcrumbs }: { breadcrumbs: string[] }) {
  const [tab, setTab] = useState("general");
  const [toggles, setToggles] = useState([true, true, true, false]);
  const { language, setLanguage, showToast } = useApp();
  
  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 min-w-0">
      <TopBar breadcrumbs={breadcrumbs} />
      <div className="px-8 py-6 space-y-6">
        <h1 className="text-xl font-bold text-gray-900">Pengaturan Akun</h1>
        
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex overflow-hidden min-h-[500px]">
          {/* Sidebar */}
          <div className="w-64 bg-gray-50/50 border-r border-gray-100 p-4 shrink-0">
            <nav className="space-y-1">
              {[
                { id: "general", label: "Umum", icon: Settings },
                { id: "security", label: "Keamanan & Kata Sandi", icon: Shield },
                { id: "notifications", label: "Notifikasi", icon: BellRing },
                { id: "devices", label: "Perangkat Aktif", icon: Smartphone },
              ].map(t => (
                <button 
                  key={t.id} 
                  onClick={() => setTab(t.id)} 
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${tab === t.id ? "font-semibold" : "text-gray-600 hover:bg-gray-100"}`}
                  style={tab === t.id ? { backgroundColor: P_XLIGHT, color: P_DARK } : {}}
                >
                  <t.icon size={16} style={{ color: tab === t.id ? P : undefined }} className={tab !== t.id ? "text-gray-400" : ""} />
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
          
          {/* Content */}
          <div className="flex-1 p-8">
            {tab === "general" && (
               <div className="space-y-6 animate-in fade-in duration-300">
                 <div>
                   <h2 className="text-lg font-bold text-gray-900">Pengaturan Umum</h2>
                   <p className="text-xs text-gray-500 mt-1">Kelola preferensi akun dan pengaturan bahasa Anda.</p>
                 </div>
                 
                 <div className="space-y-4">
                   <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                     <div>
                       <div className="text-sm font-medium text-gray-900">Bahasa</div>
                       <div className="text-xs text-gray-500 mt-0.5">Pilih bahasa yang Anda inginkan untuk dasbor.</div>
                     </div>
                     <select
                       value={language}
                       onChange={(e) => setLanguage(e.target.value as AppLanguage)}
                       className="text-sm px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-1"
                       style={{ "--tw-ring-color": P } as React.CSSProperties}
                     >
                       <option value="en">Inggris (AS)</option>
                       <option value="id">Bahasa Indonesia</option>
                     </select>
                   </div>
                   
                   <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                     <div>
                       <div className="text-sm font-medium text-gray-900">Zona Waktu</div>
                       <div className="text-xs text-gray-500 mt-0.5">Atur zona waktu lokal Anda untuk tanggal dan waktu.</div>
                     </div>
                     <select className="text-sm px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-1" style={{ '--tw-ring-color': P } as React.CSSProperties}>
                       <option>(GMT+07:00) Waktu Indonesia Barat</option>
                       <option>(GMT+08:00) Waktu Indonesia Tengah</option>
                     </select>
                   </div>
                 </div>
                 
                 <div className="pt-4 flex justify-end">
                   <button onClick={() => showToast(`Pengaturan umum berhasil disimpan! Bahasa: ${language === "id" ? "Bahasa Indonesia" : "Inggris (AS)"}`)} className="px-4 py-2 text-white text-sm font-semibold rounded-lg transition-colors hover:opacity-90" style={{ backgroundColor: P }}>Simpan Preferensi</button>
                 </div>
               </div>
            )}
            
            {tab === "security" && (
               <div className="space-y-6 animate-in fade-in duration-300">
                 <div>
                   <h2 className="text-lg font-bold text-gray-900">Keamanan & Kata Sandi</h2>
                   <p className="text-xs text-gray-500 mt-1">Kelola kata sandi Anda dan amankan akun Anda.</p>
                 </div>
                 
                 <div className="space-y-4">
                   <div className="border border-gray-200 rounded-xl p-5">
                     <h3 className="text-sm font-semibold text-gray-900 mb-4">Ubah Kata Sandi</h3>
                     <div className="space-y-3 max-w-sm">
                       <div>
                         <label className="block text-xs font-medium text-gray-700 mb-1.5">Kata Sandi Saat Ini</label>
                         <input type="password" placeholder="••••••••" className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1" style={{ '--tw-ring-color': P } as React.CSSProperties} />
                       </div>
                       <div>
                         <label className="block text-xs font-medium text-gray-700 mb-1.5">Kata Sandi Baru</label>
                         <input type="password" placeholder="••••••••" className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1" style={{ '--tw-ring-color': P } as React.CSSProperties} />
                       </div>
                       <div className="pt-2">
                         <button onClick={() => showToast("Kata sandi berhasil diperbarui!")} className="px-4 py-2 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-black transition-colors">Perbarui Kata Sandi</button>
                       </div>
                     </div>
                   </div>
                 </div>
               </div>
            )}
            
            {tab === "notifications" && (
               <div className="space-y-6 animate-in fade-in duration-300">
                 <div>
                   <h2 className="text-lg font-bold text-gray-900">Notifikasi</h2>
                   <p className="text-xs text-gray-500 mt-1">Pilih cara Anda menerima peringatan dan pembaruan.</p>
                 </div>
                 
                 <div className="space-y-4">
                   {[
                     { title: "Mutasi Aset", desc: "Dapatkan pemberitahuan saat aset mengubah lokasi atau kepemilikan." },
                     { title: "Peringatan Pemeliharaan", desc: "Terima peringatan untuk pemeliharaan dan perbaikan terjadwal." },
                     { title: "Laporan Stock Opname", desc: "Ringkasan mingguan penyelesaian stock opname." },
                     { title: "Pembaruan Sistem", desc: "Berita tentang pembaruan produk dan fitur." },
                   ].map((item, i) => (
                     <div key={i} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                       <div>
                         <div className="text-sm font-medium text-gray-900">{item.title}</div>
                         <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                       </div>
                       <label className="relative inline-flex items-center cursor-pointer">
                         <input type="checkbox" className="sr-only peer" checked={toggles[i]} onChange={() => { const t = [...toggles]; t[i] = !t[i]; setToggles(t); }} />
                         <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all" style={toggles[i] ? { backgroundColor: P } : {}}></div>
                       </label>
                     </div>
                   ))}
                 </div>
               </div>
            )}
            
            {tab === "devices" && (
               <div className="space-y-6 animate-in fade-in duration-300">
                 <div>
                   <h2 className="text-lg font-bold text-gray-900">Perangkat Aktif</h2>
                   <p className="text-xs text-gray-500 mt-1">Anda saat ini masuk ke perangkat ini.</p>
                 </div>
                 
                 <div className="space-y-3">
                   <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                     <div className="flex items-center gap-3">
                       <Smartphone size={20} className="text-gray-400" />
                       <div>
                         <div className="text-sm font-medium text-gray-900">MacBook Pro - Chrome</div>
                         <div className="text-xs text-gray-500 mt-0.5">Bogor, Indonesia • Aktif sekarang</div>
                       </div>
                     </div>
                     <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded uppercase tracking-wider">Saat Ini</span>
                   </div>
                   
                   <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl">
                     <div className="flex items-center gap-3">
                       <Smartphone size={20} className="text-gray-400" />
                       <div>
                         <div className="text-sm font-medium text-gray-900">iPhone 13 - Safari</div>
                         <div className="text-xs text-gray-500 mt-0.5">Jakarta, Indonesia • Terakhir aktif 2 jam yang lalu</div>
                       </div>
                     </div>
                     <button className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors">Cabut</button>
                   </div>
                 </div>
               </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}


const DASH_SUBPAGES: Record<string, { title: string; tabs: string[] }> = {
  "dash-analitik":   { title: "Analitik",   tabs: ["Pola Kerusakan Aset", "Prediksi Perbaikan Aset", "Pengelolaan Aset", "Persebaran Aset", "Perencanaan Pengadaan Aset", "Rekapitulasi"] },
  "dash-keuangan":   { title: "Keuangan",   tabs: ["Valuasi Aset", "Biaya Aset per Ruangan/Gedung"] },
  "dash-kondisi":    { title: "Kondisi",    tabs: ["Kualitas Aset", "Kelayakan Aset", "Umur Ekonomis", "Prioritas Penggantian"] },
  "dash-monitoring": { title: "Pertumbuhan Aset", tabs: ["Pertumbuhan Aset", "Distribusi Aset", "Komposisi Aset", "Aset per Ruangan"] },
  "dash-pengadaan":  { title: "Pengadaan",  tabs: ["Ringkasan Pengadaan", "Statistik Pengadaan", "History Pengadaan"] },
  "dash-maintenance":{ title: "Maintenance",tabs: ["Ringkasan Perbaikan", "Biaya Perbaikan", "History Perbaikan"] },
  "lokasi":               { title: "Kampus Cilibende",          tabs: ["Ringkasan", "Aset per Ruangan", "Denah / Floorplan"] },
  "kampus-cilibende":     { title: "Kampus Cilibende",          tabs: ["Ringkasan", "Aset per Ruangan", "Denah / Floorplan"] },
  "kampus-gunung-gede":   { title: "Kampus Gunung Gede",        tabs: ["Ringkasan", "Aset per Ruangan", "Denah / Floorplan"] },
  "kampus-pajajaran":     { title: "Kampus Pajajaran",          tabs: ["Ringkasan", "Aset per Ruangan", "Denah / Floorplan"] },
  "kampus-baranangsiang": { title: "Kampus Baranangsiang",     tabs: ["Ringkasan", "Aset per Ruangan", "Denah / Floorplan"] },
  "kampus-lainnya":       { title: "Kampus / Lokasi Lainnya",   tabs: ["Ringkasan", "Aset per Ruangan", "Denah / Floorplan"] },
  "kampus-belum-dikategorikan": { title: "Belum Dikategorikan", tabs: ["Ringkasan", "Aset per Ruangan", "Denah / Floorplan"] },
};

// ── Main Content ──────────────────────────────────────────────────────────────
function MainContent({ page }: { page: string }) {
  const { theme, setTheme, tableDensity, setTableDensity, showToast, userProfile } = useApp();

  const PAGE_TITLES: Record<string, string> = {
    pengguna:             "Pengguna",
    aktivitas:            "Aktivitas",
    dokumen:              "Dokumen",
    pengadaan:            "Pengadaan",
    stock:                "Stock Opname",
    maintenance:          "Perbaikan",
    mutasi:               "Mutasi Aset",
    lokasi:               "Lokasi & Ruangan",
    "kampus-cilibende":    "Kampus Cilibende",
    "kampus-gunung-gede":  "Kampus Gunung Gede",
    "kampus-pajajaran":    "Kampus Pajajaran",
    "kampus-baranangsiang":"Kampus Baranangsiang",
    "kampus-lainnya":      "Kampus / Lokasi Lainnya",
    "kampus-belum-dikategorikan": "Belum Dikategorikan",
    "data-aset":       "Data Aset",
    pm:                "Peralatan & Mesin (PM)",
    atb:               "Aset Tak Berwujud (ATB)",
    atl:               "Aset Tetap Lainnya (ATL)",
    al:                "Alat Angkutan (AL)",
    "dash-analitik":   "Analitik",
    "dash-keuangan":   "Keuangan",
    "dash-kondisi":    "Kondisi",
    "dash-monitoring": "Pertumbuhan Aset",
    "dash-pengadaan":  "Pengadaan",
    "dash-maintenance":"Maintenance",
    observasi:         "Observasi Ruangan",
  };

  let currentBreadcrumbs: string[] = [];
  if (page === "dashboard") currentBreadcrumbs = ["Dashboard", "Analitik"];
  else if (page === "dash-analitik")   currentBreadcrumbs = ["Dashboard", "Analitik"];
  else if (page === "dash-keuangan")   currentBreadcrumbs = ["Dashboard", "Keuangan"];
  else if (page === "dash-kondisi")    currentBreadcrumbs = ["Dashboard", "Kondisi"];
  else if (page === "dash-monitoring") currentBreadcrumbs = ["Dashboard", "Pertumbuhan Aset"];
  else if (page === "dash-pengadaan")  currentBreadcrumbs = ["Dashboard", "Pengadaan"];
  else if (page === "dash-maintenance")currentBreadcrumbs = ["Dashboard", "Maintenance"];
  else if (page.startsWith("kampus-")) currentBreadcrumbs = ["Lokasi & Ruangan", PAGE_TITLES[page]];
  else if (["pm", "atb", "atl", "al"].includes(page)) currentBreadcrumbs = ["Data Aset", PAGE_TITLES[page]];
  else if (page === "profile") currentBreadcrumbs = ["Profil Saya"];
  else if (page === "pengaturan") currentBreadcrumbs = ["Pengaturan", "Umum"];
  else if (page === "preferensi") currentBreadcrumbs = ["Pengaturan", "Preferensi"];
  else if (page === "panduan-pengguna") currentBreadcrumbs = ["Help Center", "Panduan Pengguna"];
  else if (page === "hubungi-dukungan") currentBreadcrumbs = ["Help Center", "Hubungi Dukungan"];
  else if (page === "pic") currentBreadcrumbs = ["Penanggung Jawab"];
  else if (page === "ringkasan") currentBreadcrumbs = ["Overview"];
  else if (page === "mutasi") currentBreadcrumbs = ["Transaksi", "Mutasi Aset"];
  else if (page === "maintenance") currentBreadcrumbs = ["Transaksi", "Perbaikan"];
  else if (page === "pengadaan")  currentBreadcrumbs = ["Transaksi", "Pengadaan"];
  else if (page === "stock")      currentBreadcrumbs = ["Transaksi", "Stock Opname"];
  else if (page === "observasi")  currentBreadcrumbs = ["Transaksi", "Observasi Ruangan"];
  else if (page === "dokumen")    currentBreadcrumbs = ["Dokumentasi & Pelaporan", "Dokumen"];
  else if (page === "aktivitas")  currentBreadcrumbs = ["Dokumentasi & Pelaporan", "Aktivitas"];
  else if (page === "pengguna")   currentBreadcrumbs = ["Sistem", "Pengguna"];
  else if (PAGE_TITLES[page]) currentBreadcrumbs = [PAGE_TITLES[page]];
  else currentBreadcrumbs = [page];

  if (page === "ringkasan") {
    return <OverviewPage topBar={<TopBar breadcrumbs={currentBreadcrumbs} />} />;
  }

  if (page === "profile") {
    return <ProfilePage breadcrumbs={currentBreadcrumbs} />;
  }

  if (page === "pengaturan") {
    return <SettingsPage breadcrumbs={currentBreadcrumbs} />;
  }

  if (["pm", "atb", "atl", "al"].includes(page)) {
    return (
      <main className="flex-1 overflow-hidden bg-gray-50 min-w-0 flex flex-col">
        <TopBar breadcrumbs={currentBreadcrumbs} />
        <div className="px-8 py-6 flex-1 overflow-hidden">
          <AsetDataTable key={page} title={PAGE_TITLES[page]} pageId={page} />
        </div>
      </main>
    );
  }

  if (page === "mutasi") {
    return <MutasiPage topBar={<TopBar breadcrumbs={currentBreadcrumbs} />} />;
  }

  if (page === "maintenance") {
    return <PerbaikanPage topBar={<TopBar breadcrumbs={currentBreadcrumbs} />} />;
  }

  if (page === "pengadaan") {
    return <PengadaanPage topBar={<TopBar breadcrumbs={currentBreadcrumbs} />} />;
  }

  if (page === "stock") {
    return <StockOpnamePage topBar={<TopBar breadcrumbs={currentBreadcrumbs} />} />;
  }

  if (page === "observasi") {
    return <ObservasiPage topBar={<TopBar breadcrumbs={currentBreadcrumbs} />} />;
  }

  if (page === "pengguna") {
    return <PenggunaPage topBar={<TopBar breadcrumbs={currentBreadcrumbs} />} />;
  }

  if (page === "aktivitas") {
    return <AktivitasPage topBar={<TopBar breadcrumbs={currentBreadcrumbs} />} />;
  }

  if (page === "dokumen") {
    return <DokumenPage topBar={<TopBar breadcrumbs={currentBreadcrumbs} />} />;
  }

  if (DASH_SUBPAGES[page]) {
    const { title, tabs } = DASH_SUBPAGES[page];
    return <DashSubPageFull page={page} title={title} tabs={tabs} topBar={<TopBar breadcrumbs={currentBreadcrumbs} />} />;
  }

  if (PAGE_TITLES[page]) {
    return (
      <main className="flex-1 overflow-y-auto bg-gray-50 min-w-0">
        <TopBar breadcrumbs={currentBreadcrumbs} />
        <div className="px-8 py-6">
          <h1 className="text-xl font-bold text-gray-900">{PAGE_TITLES[page]}</h1>
        </div>
      </main>
    );
  }

  if (page === "pic") {
    return <PICPage topBar={<TopBar breadcrumbs={currentBreadcrumbs} />} />;
  }

  if (page === "preferensi") {
    return (
      <main className="flex-1 overflow-y-auto bg-gray-50 min-w-0">
        <TopBar breadcrumbs={currentBreadcrumbs} />
        <div className="px-8 py-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-[#022B5F] mb-1">Preferensi</h1>
            <p className="text-sm text-gray-500">Sesuaikan pengalaman penggunaan dashboard dan notifikasi Aset SV IPB Anda.</p>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
              <LayoutDashboard size={18} className="text-[#014285]" />
              <h2 className="text-base font-semibold text-[#022B5F]">Tampilan & Antarmuka</h2>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#022B5F]">Tema Visual</p>
                  <p className="text-xs text-gray-500 mt-0.5">Pilih tema warna terang atau gelap untuk dashboard.</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => { setTheme("light"); showToast("Tema terang diaktifkan!", "info"); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${theme === "light" ? "bg-white shadow-sm text-[#022B5F]" : "text-gray-500 hover:text-gray-700"}`}
                  >☀️ Terang</button>
                  <button
                    onClick={() => { setTheme("dark"); showToast("Tema gelap diaktifkan!", "info"); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${theme === "dark" ? "bg-white shadow-sm text-[#022B5F]" : "text-gray-500 hover:text-gray-700"}`}
                  >🌙 Gelap</button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#022B5F]">Kerapatan Data Tabel</p>
                  <p className="text-xs text-gray-500 mt-0.5">Tentukan kerapatan baris untuk tampilan data tabel aset.</p>
                </div>
                <select
                  value={tableDensity}
                  onChange={(e) => setTableDensity(e.target.value as TableDensity)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-[#022B5F] font-medium outline-none focus:ring-1 focus:ring-[#014285]"
                >
                  <option value="normal">Normal</option>
                  <option value="compact">Rapat (Compact)</option>
                  <option value="spacious">Longgar (Spacious)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
              <Bell size={18} className="text-[#014285]" />
              <h2 className="text-base font-semibold text-[#022B5F]">Pengaturan Notifikasi</h2>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#022B5F]">Ringkasan Mingguan</p>
                  <p className="text-xs text-gray-500 mt-0.5">Terima email laporan status dan mutasi aset setiap Senin pagi.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-10 h-5.5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-[#014285]"></div>
                </label>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#022B5F]">Peringatan Pemeliharaan Aset</p>
                  <p className="text-xs text-gray-500 mt-0.5">Notifikasi instan saat ada aset yang mendekati jadwal perawatan.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-10 h-5.5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-[#014285]"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#022B5F]">Pembaruan Sistem IPB</p>
                  <p className="text-xs text-gray-500 mt-0.5">Berita terkait fitur baru dan pembaruan sistem manajemen aset.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-10 h-5.5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-[#014285]"></div>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => showToast("Preferensi berhasil disimpan!")}
              className="px-5 py-2.5 text-white text-sm font-semibold rounded-lg transition-all shadow-sm hover:shadow bg-[#014285] hover:bg-[#022B5F]"
            >
              Simpan Perubahan
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (page === "panduan-pengguna") {
    return (
      <main className="flex-1 overflow-y-auto bg-gray-50 min-w-0">
        <TopBar breadcrumbs={currentBreadcrumbs} />
        <div className="px-8 py-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-[#022B5F] mb-1">Panduan Pengguna</h1>
            <p className="text-sm text-gray-500">Pelajari cara menggunakan setiap fitur di aplikasi Manajemen Aset SV IPB secara optimal.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-[#014285] transition-all hover:shadow-md cursor-pointer group">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-5 text-[#014285] group-hover:bg-[#014285] group-hover:text-white transition-colors">
                <Database size={22} strokeWidth={1.5} />
              </div>
              <h3 className="text-base font-bold text-[#022B5F] mb-2">Pengelolaan Data Aset</h3>
              <p className="text-sm text-gray-500 leading-relaxed">Cara komprehensif untuk menambah, mengedit, dan menghapus data peralatan, mesin, dan aset lainnya di sistem IPB.</p>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-[#014285] transition-all hover:shadow-md cursor-pointer group">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-5 text-[#014285] group-hover:bg-[#014285] group-hover:text-white transition-colors">
                <ArrowLeftRight size={22} strokeWidth={1.5} />
              </div>
              <h3 className="text-base font-bold text-[#022B5F] mb-2">Mutasi & Pemindahan</h3>
              <p className="text-sm text-gray-500 leading-relaxed">Prosedur pemindahan lokasi aset antar ruangan atau perubahan penanggung jawab beserta pencatatan BAST.</p>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-[#014285] transition-all hover:shadow-md cursor-pointer group">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-5 text-[#014285] group-hover:bg-[#014285] group-hover:text-white transition-colors">
                <Wrench size={22} strokeWidth={1.5} />
              </div>
              <h3 className="text-base font-bold text-[#022B5F] mb-2">Pencatatan Maintenance</h3>
              <p className="text-sm text-gray-500 leading-relaxed">Panduan mencatat riwayat perbaikan kerusakan, suku cadang yang diganti, serta penjadwalan perawatan rutin.</p>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-[#014285] transition-all hover:shadow-md cursor-pointer group">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-5 text-[#014285] group-hover:bg-[#014285] group-hover:text-white transition-colors">
                <ClipboardList size={22} strokeWidth={1.5} />
              </div>
              <h3 className="text-base font-bold text-[#022B5F] mb-2">Proses Stock Opname</h3>
              <p className="text-sm text-gray-500 leading-relaxed">Langkah-langkah melakukan stock opname akhir tahun secara sistematis dan pencocokan data fisik dengan sistem.</p>
            </div>
          </div>
          
          <div className="bg-[#022B5F] rounded-xl p-8 mt-6 flex flex-col sm:flex-row items-center justify-between text-white shadow-lg relative overflow-hidden">
            <div className="absolute right-0 top-0 opacity-10 pointer-events-none translate-x-1/4 -translate-y-1/4">
              <svg width="200" height="200" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="relative z-10 text-center sm:text-left mb-6 sm:mb-0">
              <h3 className="text-lg font-bold mb-1">Unduh Buku Panduan Lengkap</h3>
              <p className="text-sm text-blue-100 max-w-lg">Dapatkan panduan komprehensif seluruh fitur dalam satu dokumen PDF (Versi 2.1, Ukuran 2.4 MB)</p>
            </div>
            <button className="relative z-10 flex items-center gap-2 bg-white text-[#022B5F] px-5 py-2.5 rounded-lg text-sm hover:bg-gray-50 transition-colors font-bold shadow-md">
              <Download size={18} strokeWidth={2} /> Unduh PDF
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (page === "hubungi-dukungan") {
    return (
      <main className="flex-1 overflow-y-auto bg-gray-50 min-w-0">
        <TopBar breadcrumbs={currentBreadcrumbs} />
        <div className="px-8 py-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-[#022B5F] mb-1">Hubungi Dukungan</h1>
            <p className="text-sm text-gray-500">Butuh bantuan teknis atau menemukan kendala sistem? Tim support kami siap membantu Anda.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center text-center hover:shadow-md transition-shadow">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mb-4 text-[#014285]">
                <Headset size={26} strokeWidth={1.5} />
              </div>
              <h3 className="text-base font-bold text-[#022B5F] mb-1">Layanan Helpdesk</h3>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">Senin - Jumat<br />(08:00 - 16:00 WIB)</p>
              <p className="text-sm font-bold text-[#014285] bg-blue-50 px-4 py-1.5 rounded-full">Ext. 1234</p>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center text-center hover:shadow-md transition-shadow">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-4 text-green-600">
                <MessageSquare size={26} strokeWidth={1.5} />
              </div>
              <h3 className="text-base font-bold text-[#022B5F] mb-1">WhatsApp</h3>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">Fast response untuk kendala urgent & mendesak</p>
              <p className="text-sm font-bold text-green-600 bg-green-50 px-4 py-1.5 rounded-full">+62 811-2233-4455</p>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col items-center text-center hover:shadow-md transition-shadow">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4 text-[#111827]">
                <Bot size={26} strokeWidth={1.5} />
              </div>
              <h3 className="text-base font-bold text-[#022B5F] mb-1">Email IT Support</h3>
              <p className="text-xs text-gray-500 mb-4 leading-relaxed">Laporan kendala detail dengan lampiran screenshot</p>
              <p className="text-sm font-bold text-[#111827] bg-gray-100 px-4 py-1.5 rounded-full">it.sv@apps.ipb.ac.id</p>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
            <h2 className="text-lg font-bold text-[#022B5F] mb-5 border-b border-gray-100 pb-3">Kirim Pesan Langsung (Tiket)</h2>
            <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-[#022B5F] mb-2">Nama Lengkap</label>
                  <input type="text" value={userProfile?.nama || "Pengguna"} readOnly className="w-full text-sm border border-gray-200 rounded-lg px-4 py-2.5 bg-gray-50 text-gray-500 outline-none cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#022B5F] mb-2">Kategori Kendala</label>
                  <select className="w-full text-sm border border-gray-200 rounded-lg px-4 py-2.5 bg-white text-[#022B5F] outline-none focus:border-[#014285] focus:ring-1 focus:ring-[#014285]">
                    <option>Sistem Error / Bug (Aplikasi crash)</option>
                    <option>Permintaan Fitur Baru / Perubahan</option>
                    <option>Kendala Login & Akses Pengguna</option>
                    <option>Pertanyaan Umum & Panduan Penggunaan</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#022B5F] mb-2">Detail Pesan & Kronologi</label>
                <textarea rows={5} placeholder="Jelaskan langkah-langkah terjadinya kendala secara detail..." className="w-full text-sm border border-gray-200 rounded-lg px-4 py-3 bg-white text-gray-800 outline-none focus:border-[#014285] focus:ring-1 focus:ring-[#014285] resize-none"></textarea>
              </div>
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-gray-400">Tim kami biasanya merespons dalam 1x24 jam kerja.</p>
                <button type="submit" className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-lg transition-all shadow-sm hover:shadow bg-[#014285] hover:bg-[#022B5F]">
                  <Send size={16} /> Buat Tiket Dukungan
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    );
  }

  if (page === "dashboard") return <DashSubPageFull page="dash-analitik" title="Analitik Sistem" tabs={["Prediksi", "Siklus Hidup", "Pengadaan"]} topBar={<TopBar breadcrumbs={currentBreadcrumbs} />} />;
}

// ── Toast Container ───────────────────────────────────────────────────────────
function ToastContainer() {
  const { toasts } = useApp();
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-white text-sm font-medium shadow-xl animate-in slide-in-from-bottom-2 duration-300 pointer-events-auto min-w-[260px] ${
            t.type === "success" ? "bg-green-500" : t.type === "error" ? "bg-red-500" : "bg-blue-500"
          }`}
        >
          <span className="text-base shrink-0">
            {t.type === "success" ? "✓" : t.type === "error" ? "✗" : "ℹ"}
          </span>
          <span className="flex-1">{t.message}</span>
        </div>
      ))}
    </div>
  );
}

// ── Error Boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Unhandled React UI Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200 max-w-md w-full">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">
              !
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Terjadi Kesalahan Tampilan</h2>
            <p className="text-xs text-gray-500 mb-4 break-words">
              {this.state.error?.message || "Terjadi kesalahan tidak terduga saat memuat komponen UI."}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="w-full py-2 px-4 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-gray-800 transition-colors"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── App ───────────────────────────────────────────────────────────────────────
function AppContent() {
  const [page, setPage] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthMode>("login");

  // Check URL query parameters for verify_token or reset_token
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("verify_token") || params.get("reset_token")) {
        setAuthModalOpen(true);
      }
    }
  }, []);

  // Listen for unauthorized events to show login modal
  useEffect(() => {
    const handleUnauthorized = () => {
      setAuthModalMode("login");
      setAuthModalOpen(true);
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  // Ensure session token is initialized on startup if not explicitly logged out
  useEffect(() => {
    ensureAuthToken();
  }, []);

  const handleOpenAuth = (mode: AuthMode = "login") => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden relative font-sans">
      {/* SIDEBAR DESKTOP: Sembunyi di mobile (hidden), tampil di desktop (md:flex), lebar tetap w-64 */}
      <div className="hidden md:flex flex-shrink-0 w-64 border-r border-gray-100 bg-white h-full">
        <Sidebar page={page} setPage={setPage} onOpenAuth={handleOpenAuth} />
      </div>

      {/* MOBILE DRAWER: Backdrop & Sidebar saat tombol Menu diklik di layar kecil */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs md:hidden flex animate-in fade-in duration-200"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div 
            className="w-72 max-w-[85vw] h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Logo className="w-8 h-8 shrink-0 flex items-center justify-center" />
                <span className="text-xs font-bold text-gray-900">Aset SV IPB</span>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Sidebar 
                page={page} 
                setPage={(p) => {
                  setPage(p);
                  setMobileMenuOpen(false);
                }} 
                onOpenAuth={handleOpenAuth}
              />
            </div>
          </div>
        </div>
      )}

      {/* KONTEN UTAMA: flex-1 agar mengambil sisa ruang, min-w-0 agar tidak overflow */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden w-full bg-slate-50">
        {/* Header Khusus Mobile untuk Hamburger Menu pembuka sidebar */}
        <div className="md:hidden flex-shrink-0 px-4 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
          >
            <Menu size={16} /> <span>Menu</span>
          </button>
          <div className="flex items-center gap-1.5">
            <Logo className="w-6 h-6 shrink-0 flex items-center justify-center" />
            <span className="text-xs font-black text-slate-800">Aset SV IPB</span>
          </div>
        </div>

        {/* Kontainer Render Halaman */}
        <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden w-full">
          <MainContent page={page} />
        </main>
      </div>

      <ToastContainer />
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <DataStoreProvider>
          <AppContent />
        </DataStoreProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}