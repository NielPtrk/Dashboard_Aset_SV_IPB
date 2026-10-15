import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { exportToExcel } from "./excelUtils";
import {
  useDataStore,
  type ActivityLog as StoreActivityLog,
  type ActivityItemDetail,
  type ActivityFieldDiff,
  type Asset,
  type ObservasiItem,
} from "./DataStore";
import {
  Search, Download, LogIn, LogOut, Plus,
  Edit3, Trash2, FileText, ArrowLeftRight, Wrench, ShoppingCart, ClipboardList,
  AlertTriangle, XCircle, CheckCircle, Activity, Shield, Filter,
  ChevronDown, Monitor, Database, Eye, X, ChevronLeft, ChevronRight,
  Copy, Check, Layers, FileSpreadsheet, ArrowRight, Tag, Calendar, User, Info,
  MapPin, Building2, RefreshCw, Link2, CheckSquare, Square, Sparkles, CheckCheck
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type AktRole = "Admin Sistem" | "Operator Aset" | "Pengelola Pengadaan" | "Teknisi" | "Pimpinan" | "Auditor" | string;
type AktMenu = "Data Aset" | "Observasi Ruangan" | "Opname" | "Stock Opname" | "Mutasi" | "Perbaikan" | "Pengadaan" | "Dokumen" | "Lokasi & Ruangan" | "Pengguna" | "Sistem" | "Dashboard" | "PIC" | "Aktivitas" | "Sinkronisasi" | string;
type AktJenis = "login" | "logout" | "tambah" | "update" | "hapus" | "dokumen" | "mutasi" | "perbaikan" | "pengadaan" | "opname" | "sistem" | "gagal";
type AktStatus = "Berhasil" | "Gagal" | "Berisiko";
type ValidasiStatus = "Valid" | "Ditinjau" | "Ditolak";

interface AuditRecord {
  id: number;
  waktu: string;
  tgl: string;
  pengguna: string;
  role: AktRole;
  aset: string;
  kodeAset: string;
  field: string;
  nilaiLama: string;
  nilaiBaru: string;
  alasan: string;
  statusValidasi: ValidasiStatus;
  rawLog: StoreActivityLog;
}

export interface ItemChangeRecord {
  id: string;
  logId: number;
  waktu: string;
  tgl: string;
  kodeBarang: string;
  namaBarang: string;
  kategori: string;
  ruangan: string;
  kondisi: string;
  nilai: string | number;
  nup?: string;
  merek?: string;
  volume?: number | string;
  satuan?: string;
  jenisPerubahan: "Tambah" | "Edit" | "Hapus";
  detailPerubahan: string;
  diffs?: ActivityFieldDiff[];
  oldValue?: string;
  newValue?: string;
  pengguna: string;
  role: string;
  ip: string;
  device: string;
  status: AktStatus;
  sourceLog: StoreActivityLog;
  itemDetail?: ActivityItemDetail;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  } catch { return s; }
}

function fmtRupiah(v: any): string {
  if (v === null || v === undefined || v === "" || v === "-") return "Rp 0";
  const num = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  if (isNaN(num) || num === 0) return "Rp 0";
  return `Rp ${Math.round(num).toLocaleString("id-ID")}`;
}

const JENIS_CFG: Record<AktJenis, { color: string; bg: string; label: string }> = {
  login:      { color: "#3B82F6", bg: "#DBEAFE", label: "Login"      },
  logout:     { color: "#6B7280", bg: "#F3F4F6", label: "Logout"     },
  tambah:     { color: "#16A34A", bg: "#DCFCE7", label: "Tambah"     },
  update:     { color: "#D97706", bg: "#FEF3C7", label: "Update"     },
  hapus:      { color: "#DC2626", bg: "#FEE2E2", label: "Hapus"      },
  dokumen:    { color: "#7C3AED", bg: "#EDE9FE", label: "Dokumen"    },
  mutasi:     { color: "#4F46E5", bg: "#E0E7FF", label: "Mutasi"     },
  perbaikan:  { color: "#EA580C", bg: "#FFEDD5", label: "Perbaikan"  },
  pengadaan:  { color: "#0D9488", bg: "#CCFBF1", label: "Pengadaan"  },
  opname:     { color: "#0891B2", bg: "#CFFAFE", label: "Opname"     },
  sistem:     { color: "#374151", bg: "#E5E7EB", label: "Sistem"     },
  gagal:      { color: "#DC2626", bg: "#FEE2E2", label: "Gagal"      },
};

function StatusBadge({ status }: { status: AktStatus }) {
  const cfg = {
    Berhasil: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Gagal:    "bg-rose-50 text-rose-700 border-rose-200",
    Berisiko: "bg-amber-50 text-amber-700 border-amber-200",
  }[status] || "bg-gray-50 text-gray-700 border-gray-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg}`}>
      {status === "Berhasil" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />}
      {status === "Gagal" && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1" />}
      {status === "Berisiko" && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1" />}
      {status}
    </span>
  );
}

function JenisBadge({ jenis }: { jenis: AktJenis }) {
  const cfg = JENIS_CFG[jenis] || { color: "#6B7280", bg: "#F3F4F6", label: jenis };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function ValidasiBadge({ status }: { status: ValidasiStatus }) {
  const cfg = {
    Valid:    "bg-emerald-100 text-emerald-700",
    Ditinjau: "bg-amber-100 text-amber-700",
    Ditolak:  "bg-rose-100 text-rose-700",
  }[status];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg}`}>{status}</span>;
}

const ROLE_LIST  = ["Semua Role", "Admin Sistem", "Operator Aset", "Pengelola Pengadaan", "Teknisi", "Pimpinan", "Auditor"];
const MENU_LIST  = ["Semua Menu", "Data Aset", "Observasi Ruangan", "Sinkronisasi", "Opname", "Mutasi", "Perbaikan", "Pengadaan", "Dokumen", "Lokasi & Ruangan", "Pengguna", "Sistem", "Dashboard", "PIC", "Aktivitas"];
const JENIS_LIST = ["Semua Jenis", "Login", "Logout", "Tambah", "Update", "Hapus", "Mutasi", "Perbaikan", "Pengadaan", "Opname", "Dokumen", "Gagal"];

// ── Detail Modal for Any Activity Log ─────────────────────────────────────────
function ActivityDetailModal({
  log,
  onClose,
}: {
  log: StoreActivityLog | null;
  onClose: () => void;
}) {
  const [modalSearch, setModalSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!log) return null;

  const items = log.items_detail || [];
  const hasItems = items.length > 0;
  const isBulk = items.length > 1;
  const isSingle = items.length === 1;
  const singleItem = isSingle ? items[0] : null;

  // Search in items
  const filteredItems = items.filter((item) => {
    if (!modalSearch.trim()) return true;
    const q = modalSearch.toLowerCase();
    return (
      (item.kode || "").toLowerCase().includes(q) ||
      (item.nama || "").toLowerCase().includes(q) ||
      (item.ruangan || "").toLowerCase().includes(q) ||
      (item.merek || "").toLowerCase().includes(q) ||
      (item.kondisi || "").toLowerCase().includes(q) ||
      (item.nup || "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const pagedItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const exportCurrentBatch = () => {
    exportToExcel(
      items.map((it, idx) => ({
        "No": idx + 1,
        "Kode Barang": it.kode || it.id || "-",
        "Nama Barang": it.nama || "-",
        "Kategori": it.kategori || log.menu || "-",
        "Ruangan": it.ruangan || "-",
        "NUP": it.nup || "-",
        "Merek/Type": it.merek || "-",
        "Volume": it.volume || 1,
        "Satuan": it.satuan || "Unit",
        "Kondisi": it.kondisi || "Baik",
        "Nilai": it.nilai || 0,
        "Keterangan": it.keterangan || "-",
      })),
      `activity-${log.id}-items-${log.tgl}`,
      "Detail Items"
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
              {log.jenis === "tambah" && <Plus size={20} />}
              {log.jenis === "update" && <Edit3 size={20} />}
              {log.jenis === "hapus" && <Trash2 size={20} />}
              {log.jenis === "login" && <LogIn size={20} />}
              {log.jenis === "logout" && <LogOut size={20} />}
              {log.jenis === "dokumen" && <FileText size={20} />}
              {log.jenis === "opname" && <ClipboardList size={20} />}
              {!["tambah", "update", "hapus", "login", "logout", "dokumen", "opname"].includes(log.jenis) && <Activity size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                  LOG #{log.id}
                </span>
                <JenisBadge jenis={log.jenis} />
                <StatusBadge status={log.status} />
                <span className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded">
                  {log.menu}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-1 leading-snug">
                {log.aksi}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Metadata Summary Banner */}
        <div className="px-6 py-3 bg-white border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Waktu Eksekusi</span>
            <span className="font-mono font-medium text-slate-800">{log.waktu}</span>
            <span className="text-slate-400 block text-[10px]">{fmtDate(log.tgl)}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Pengguna / Role</span>
            <span className="font-semibold text-slate-800 block truncate">{log.pengguna}</span>
            <span className="text-slate-500 text-[10px]">{log.role}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">IP & Perangkat</span>
            <span className="font-mono text-slate-800 block">{log.ip || "127.0.0.1"}</span>
            <span className="text-slate-500 text-[10px] truncate block">{log.device || "Chrome (Windows)"}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Target / File</span>
            {log.file_name ? (
              <span className="font-semibold text-blue-700 flex items-center gap-1 truncate" title={log.file_name}>
                <FileSpreadsheet size={12} className="shrink-0" />
                {log.file_name}
              </span>
            ) : (
              <span className="font-mono text-slate-700">{log.target_id || "-"}</span>
            )}
            <span className="text-slate-400 text-[10px]">{log.target_type || "Sistem"}</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50">

          {/* CASE A: Bulk Items / Excel Upload Table */}
          {isBulk && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="bg-blue-50 text-blue-800 border border-blue-200 px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                    <Layers size={14} />
                    Total {items.length} Barang Terlibat
                  </div>
                  <span className="text-xs text-slate-500">
                    Daftar seluruh item yang diproses dalam aksi ini
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={modalSearch}
                      onChange={(e) => { setModalSearch(e.target.value); setPage(1); }}
                      placeholder="Cari item di batch ini..."
                      className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 w-48"
                    />
                  </div>
                  <button
                    onClick={exportCurrentBatch}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm"
                  >
                    <Download size={13} /> Unduh Excel
                  </button>
                </div>
              </div>

              {/* Items Table with pagination */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto max-h-[380px]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/80 sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 text-[11px] font-bold text-slate-600 uppercase">No</th>
                        <th className="py-2.5 px-3 text-[11px] font-bold text-slate-600 uppercase">Kode Barang</th>
                        <th className="py-2.5 px-3 text-[11px] font-bold text-slate-600 uppercase">Nama Barang</th>
                        <th className="py-2.5 px-3 text-[11px] font-bold text-slate-600 uppercase">NUP</th>
                        <th className="py-2.5 px-3 text-[11px] font-bold text-slate-600 uppercase">Merek</th>
                        <th className="py-2.5 px-3 text-[11px] font-bold text-slate-600 uppercase">Ruangan / Lokasi</th>
                        <th className="py-2.5 px-3 text-[11px] font-bold text-slate-600 uppercase">Kondisi</th>
                        <th className="py-2.5 px-3 text-[11px] font-bold text-slate-600 uppercase text-right">Nilai / Vol</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pagedItems.map((item, idx) => {
                        const globalIdx = (page - 1) * pageSize + idx + 1;
                        return (
                          <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                            <td className="py-2.5 px-3 text-slate-400 font-mono">{globalIdx}</td>
                            <td className="py-2.5 px-3">
                              <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                                {item.kode || item.id || "-"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-800">
                              {item.nama || "-"}
                              {item.keterangan && (
                                <span className="block text-[10px] text-slate-400 mt-0.5 italic">{item.keterangan}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                              {(() => {
                                const rawNup = item.nup && item.nup !== "-"
                                  ? item.nup
                                  : (item as any).snapshot?.Id_aset || (item as any).snapshot?.NUP || (item as any).snapshot?.id_aset || (item as any).snapshot?.no_nup || "-";
                                const cleanNup = String(rawNup ?? "").trim();
                                return cleanNup && cleanNup !== "-" && cleanNup !== "null" && cleanNup !== "undefined" ? (
                                  <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {cleanNup}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                );
                              })()}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">
                              {(() => {
                                const rawMerek = item.merek && item.merek !== "-"
                                  ? item.merek
                                  : (item as any).snapshot?.MerkType || (item as any).snapshot?.Model || (item as any).snapshot?.Merk || (item as any).snapshot?.Merek || (item as any).snapshot?.merek || "-";
                                const cleanMerek = String(rawMerek ?? "").trim();
                                return cleanMerek && cleanMerek !== "-" && cleanMerek !== "null" && cleanMerek !== "undefined" ? (
                                  <span className="font-medium text-slate-800">{cleanMerek}</span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                );
                              })()}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 max-w-[180px] truncate" title={item.ruangan}>
                              {item.ruangan || "-"}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                                item.kondisi === "Baik" ? "bg-green-100 text-green-700" :
                                item.kondisi === "Rusak Ringan" ? "bg-amber-100 text-amber-700" :
                                item.kondisi === "Rusak Berat" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                              }`}>
                                {item.kondisi || "Baik"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-medium text-slate-800">
                              {item.volume ? `${item.volume} ${item.satuan || "Unit"}` : fmtRupiah(item.nilai)}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredItems.length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400">
                            Tidak ada item yang sesuai dengan pencarian.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <span>Menampilkan {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, filteredItems.length)} dari {filteredItems.length} item</span>
                    <select
                      value={pageSize}
                      onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                      className="bg-white border border-slate-200 rounded px-2 py-1 text-xs outline-none"
                    >
                      <option value={10}>10 / hal</option>
                      <option value={25}>25 / hal</option>
                      <option value={50}>50 / hal</option>
                      <option value={100}>100 / hal</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-1.5 rounded border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-100"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="px-2 font-medium text-slate-700">Hal {page} / {totalPages}</span>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="p-1.5 rounded border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-100"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CASE B: Single Edit Item with Nilai Sebelum vs Sesudah Diff */}
          {(log.jenis === "update" || (log.diffs && log.diffs.length > 0)) && (
            <div className="space-y-4">
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-xs mb-1">
                  <Edit3 size={15} />
                  Perubahan Kolom (Sebelum vs Sesudah)
                </div>
                <p className="text-xs text-amber-700">
                  Berikut adalah daftar rincian kolom dan nilai yang mengalami perubahan pada aksi ini:
                </p>
              </div>

              {/* Diff Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 text-[11px] font-bold text-slate-600 uppercase">Field / Atribut</th>
                      <th className="py-2.5 px-4 text-[11px] font-bold text-slate-600 uppercase">Nilai Sebelum</th>
                      <th className="py-2.5 px-2 text-center text-slate-400">→</th>
                      <th className="py-2.5 px-4 text-[11px] font-bold text-slate-600 uppercase">Nilai Sesudah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {log.diffs && log.diffs.length > 0 ? (
                      log.diffs.map((d, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-semibold text-slate-700">
                            {d.label || d.field}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block px-2.5 py-1 rounded bg-rose-50 text-rose-700 font-medium line-through text-xs">
                              {d.oldVal || "—"}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center text-slate-400 font-bold">
                            →
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200">
                              {d.newVal || "—"}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          {log.field_changed || "Data Atribut"}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2.5 py-1 rounded bg-rose-50 text-rose-700 font-medium line-through text-xs">
                            {log.old_value || "—"}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-center text-slate-400 font-bold">
                          →
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200">
                            {log.new_value || "—"}
                          </span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CASE C: Single Item Detail Snapshot (Tambah, Edit, Hapus) */}
          {singleItem && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Tag size={14} className="text-blue-600" />
                  Rincian Informasi Item: {singleItem.nama || singleItem.kode}
                </span>
                {singleItem.kode && (
                  <button
                    onClick={() => copyToClipboard(singleItem.kode || "", "single-code")}
                    className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    {copiedId === "single-code" ? <Check size={12} /> : <Copy size={12} />}
                    {copiedId === "single-code" ? "Tersalin" : "Salin Kode"}
                  </button>
                )}
              </div>

              {log.jenis === "hapus" && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-800">
                  <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Item Telah Dihapus dari Database Utama:</span>
                    <p className="mt-0.5 text-rose-700 text-[11px]">
                      Snapshot data terakhir sebelum penghapusan diarsipkan di bawah ini untuk transparansi dan audit trail.
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Kode Barang / Tag</span>
                  <span className="font-mono font-bold text-blue-700 text-sm">{singleItem.kode || singleItem.id || "-"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Nama Barang</span>
                  <span className="font-semibold text-slate-800 text-sm">{singleItem.nama || "-"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Kategori</span>
                  <span className="font-medium text-slate-700">{singleItem.kategori || log.menu || "-"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Lokasi / Ruangan</span>
                  <span className="font-medium text-slate-800">{singleItem.ruangan || "-"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Kondisi Terkini</span>
                  <span className="font-semibold text-slate-800">{singleItem.kondisi || "Baik"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Nilai Perolehan / Buku</span>
                  <span className="font-mono font-bold text-emerald-700">{fmtRupiah(singleItem.nilai)}</span>
                </div>
                {singleItem.merek && (
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Merek / Type</span>
                    <span className="text-slate-700">{singleItem.merek}</span>
                  </div>
                )}
                {singleItem.nup && (
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">NUP</span>
                    <span className="font-mono text-slate-700">{singleItem.nup}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CASE D: General / System Activity when no items_detail */}
          {!hasItems && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Info size={14} className="text-slate-500" />
                Informasi Aktivitas Sistem
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Target Operasi</span>
                  <span className="font-semibold text-slate-800">{log.target_type || "Sistem"} ({log.target_id || "-"})</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Status Eksekusi</span>
                  <span className="font-semibold text-slate-800">{log.status}</span>
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg text-xs">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-1">Deskripsi Lengkap</span>
                <p className="text-slate-700 leading-relaxed">{log.aksi}</p>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Audit Trail Dashboard Aset SV IPB • Dicatat Otomatis
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition-colors shadow-sm"
          >
            Tutup Detail
          </button>
        </div>

      </div>
    </div>
  );
}

// ── Activity Log Tab ──────────────────────────────────────────────────────────
function mapStoreLog(s: StoreActivityLog): StoreActivityLog {
  return s;
}

function ActivityLogTab() {
  const store = useDataStore();
  const [selectedLog, setSelectedLog] = useState<StoreActivityLog | null>(null);

  const USER_LIST = useMemo(
    () => ["Semua Pengguna", ...Array.from(new Set(store.activityLogs.map(a => a.pengguna))).sort()],
    [store.activityLogs]
  );
  const [search, setSearch]         = useState("");
  const [roleFilter, setRoleFilter] = useState("Semua Role");
  const [menuFilter, setMenuFilter] = useState("Semua Menu");
  const [userFilter, setUserFilter] = useState("Semua Pengguna");
  const [jenisFilter, setJenisFilter] = useState("Semua Jenis");

  const filtered = useMemo(() => store.activityLogs.filter(a => {
    const q = search.toLowerCase();
    const matchQ = (a.aksi || "").toLowerCase().includes(q) || (a.pengguna || "").toLowerCase().includes(q) || (a.target_id || "").toLowerCase().includes(q);
    const matchR = roleFilter === "Semua Role" || a.role === roleFilter;
    const matchM = menuFilter === "Semua Menu" || a.menu === menuFilter;
    const matchU = userFilter === "Semua Pengguna" || a.pengguna === userFilter;
    const matchJ = jenisFilter === "Semua Jenis" || JENIS_CFG[a.jenis]?.label === jenisFilter;
    return matchQ && matchR && matchM && matchU && matchJ;
  }), [store.activityLogs, search, roleFilter, menuFilter, userFilter, jenisFilter]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari aktivitas, kode target, atau pengguna..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-gray-300" />
        </div>
        {[
          { val: userFilter, set: setUserFilter, opts: USER_LIST },
          { val: roleFilter, set: setRoleFilter, opts: ROLE_LIST },
          { val: menuFilter, set: setMenuFilter, opts: MENU_LIST },
          { val: jenisFilter, set: setJenisFilter, opts: JENIS_LIST },
        ].map((f, i) => (
          <select key={i} value={f.val} onChange={e => f.set(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 outline-none">
            {f.opts.map(o => <option key={o}>{o}</option>)}
          </select>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">{filtered.length} aktivitas ditemukan (Klik baris atau tombol detail untuk rincian barang)</p>
        <button
          onClick={() => exportToExcel(filtered.map(a => ({
            "Tanggal": a.tgl, "Waktu": a.waktu, "Pengguna": a.pengguna,
            "Role": a.role, "Menu": a.menu, "Aktivitas": a.aksi,
            "Jenis": a.jenis, "Status": a.status, "IP": a.ip, "Device": a.device,
            "Jumlah Item": a.items_detail ? a.items_detail.length : a.items_count || 1,
          })), `activity-log-${new Date().toISOString().slice(0,10)}`, "Log")}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 bg-white shadow-sm transition-colors">
          <Download size={12} /> Export Excel
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 960 }}>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70">
                {["Waktu", "Pengguna", "Role", "Menu", "Aktivitas", "Detail Item", "Status", "IP / Device", "Aksi"].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const itemCount = a.items_detail ? a.items_detail.length : a.items_count || 0;
                return (
                  <tr
                    key={a.id}
                    onClick={() => setSelectedLog(a)}
                    className={`border-b border-gray-50 hover:bg-blue-50/40 cursor-pointer transition-colors ${
                      a.status === "Gagal" || a.status === "Berisiko" ? "bg-red-50/20" : ""
                    }`}
                  >
                    <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
                      <div className="font-mono">{a.waktu}</div>
                      <div className="text-[10px] text-gray-400">{fmtDate(a.tgl)}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm font-medium text-gray-800 whitespace-nowrap">{a.pengguna}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded whitespace-nowrap">{a.role}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs text-gray-600 whitespace-nowrap font-medium">{a.menu}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <JenisBadge jenis={a.jenis} />
                        <span className="text-xs text-gray-700 max-w-[240px] truncate" title={a.aksi}>{a.aksi}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {itemCount > 1 ? (
                        <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold">
                          <Layers size={11} /> {itemCount} Item
                        </span>
                      ) : itemCount === 1 ? (
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-semibold">
                          1 Item
                        </span>
                      ) : a.diffs && a.diffs.length > 0 ? (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                          {a.diffs.length} Kolom
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4"><StatusBadge status={a.status} /></td>
                    <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
                      <div className="font-mono text-[10px]">{a.ip || "127.0.0.1"}</div>
                      <div className="text-[10px] text-gray-400 truncate max-w-[100px]">{a.device || "Chrome"}</div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => { e.stopPropagation(); setSelectedLog(a); }}>
                      <button
                        className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-100/60 transition-colors flex items-center gap-1 text-xs font-semibold"
                        title="Buka detail item"
                      >
                        <Eye size={14} /> Detail
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <Activity size={28} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Tidak ada aktivitas yang sesuai filter.</p>
          </div>
        )}
      </div>

      {/* Drill-down Modal */}
      <ActivityDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
}

// ── Audit Table Tab ───────────────────────────────────────────────────────────
type StoreAsset = { id: string; Nama_Barang?: string };

function mapStoreLogToAudit(s: StoreActivityLog, assets: StoreAsset[]): AuditRecord {
  const asset = assets.find(a => a.id === s.target_id);
  return {
    id: s.id,
    waktu: s.waktu,
    tgl: s.tgl,
    pengguna: s.pengguna,
    role: (s.role as AktRole) || "Operator Aset",
    aset: asset?.Nama_Barang || s.target_id || "—",
    kodeAset: s.target_id || s.target_type || "—",
    field: s.field_changed || s.aksi,
    nilaiLama: s.old_value || "—",
    nilaiBaru: s.new_value || "—",
    alasan: s.aksi,
    statusValidasi: "Valid",
    rawLog: s,
  };
}

function AuditTableTab() {
  const store = useDataStore();
  const [search, setSearch] = useState("");
  const [validasiFilter, setValidasiFilter] = useState("Semua");
  const [selectedLog, setSelectedLog] = useState<StoreActivityLog | null>(null);

  const combined = useMemo<AuditRecord[]>(() => {
    return store.activityLogs
      .filter(l => ["tambah","update","hapus","mutasi","perbaikan","pengadaan","opname","dokumen"].includes(l.jenis))
      .map(l => mapStoreLogToAudit(l, store.assets))
      .sort((a, b) => `${b.tgl}${b.waktu}`.localeCompare(`${a.tgl}${a.waktu}`));
  }, [store.activityLogs, store.assets]);

  const filtered = useMemo(() => combined.filter(a => {
    const q = search.toLowerCase();
    const matchQ = a.aset.toLowerCase().includes(q) || a.kodeAset.toLowerCase().includes(q) ||
      a.pengguna.toLowerCase().includes(q) || a.field.toLowerCase().includes(q);
    const matchV = validasiFilter === "Semua" || a.statusValidasi === validasiFilter;
    return matchQ && matchV;
  }), [combined, search, validasiFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari aset, field yang diubah, atau pengguna..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-gray-300" />
        </div>
        <select value={validasiFilter} onChange={e => setValidasiFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 outline-none">
          <option value="Semua">Semua Status Validasi</option>
          <option>Valid</option><option>Ditinjau</option><option>Ditolak</option>
        </select>
        <button
          onClick={() => exportToExcel(filtered.map(a => ({
            "Tanggal": a.tgl, "Waktu": a.waktu, "Pengguna": a.pengguna, "Role": a.role,
            "Aset": a.aset, "Kode Aset": a.kodeAset, "Field Diubah": a.field,
            "Nilai Lama": a.nilaiLama, "Nilai Baru": a.nilaiBaru,
            "Alasan": a.alasan, "Status Validasi": a.statusValidasi,
          })), `audit-trail-${new Date().toISOString().slice(0,10)}`, "Audit")}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 bg-white shadow-sm transition-colors">
          <Download size={14} /> Export Excel
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
        <Shield size={16} className="text-amber-600 shrink-0" />
        <p className="text-xs text-amber-800">
          <span className="font-semibold">Audit Trail</span> — Perubahan data dicatat otomatis oleh sistem. Klik baris manapun untuk melihat detail snapshot data dan nilai sebelum vs sesudah.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 1000 }}>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70">
                {["Waktu", "Pengguna", "Aset", "Field Diubah", "Nilai Lama", "Nilai Baru", "Alasan", "Status", "Aksi"].map(h => (
                  <th key={h} className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => setSelectedLog(a.rawLog)}
                  className={`border-b border-gray-50 hover:bg-blue-50/40 cursor-pointer transition-colors ${
                    a.statusValidasi === "Ditinjau" ? "bg-amber-50/30" : ""
                  }`}
                >
                  <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
                    <div className="font-mono text-[11px]">{a.waktu}</div>
                    <div className="text-[10px] text-gray-400">{fmtDate(a.tgl)}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-xs font-medium text-gray-800 whitespace-nowrap">{a.pengguna}</div>
                    <div className="text-[10px] text-gray-400">{a.role}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-xs font-medium text-gray-800 max-w-[150px] truncate">{a.aset}</div>
                    <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">{a.kodeAset}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">{a.field}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded line-through whitespace-nowrap max-w-[120px] truncate block">{a.nilaiLama || "—"}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded font-medium whitespace-nowrap max-w-[120px] truncate block">{a.nilaiBaru}</span>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-600 max-w-[180px]">
                    <span className="truncate block" title={a.alasan}>{a.alasan}</span>
                  </td>
                  <td className="py-3 px-4"><ValidasiBadge status={a.statusValidasi} /></td>
                  <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => { e.stopPropagation(); setSelectedLog(a.rawLog); }}>
                    <button className="p-1 text-blue-600 hover:text-blue-800 text-xs font-semibold flex items-center gap-1">
                      <Eye size={13} /> Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <Database size={28} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Tidak ada audit record yang sesuai filter.</p>
          </div>
        )}
      </div>

      <ActivityDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
}

// ── Perubahan Data Aset Tab (ITEM-LEVEL CHANGELOG) ────────────────────────────
function PerubahanAsetTab() {
  const store = useDataStore();
  const [search, setSearch] = useState("");
  const [kategoriFilter, setKategoriFilter] = useState("Semua Kategori");
  const [jenisFilter, setJenisFilter] = useState("Semua Jenis");
  const [rentangFilter, setRentangFilter] = useState("Semua Waktu");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [selectedLog, setSelectedLog] = useState<StoreActivityLog | null>(null);

  // Unfold / Flatten all activity logs into ItemChangeRecord level
  const itemChanges = useMemo<ItemChangeRecord[]>(() => {
    const list: ItemChangeRecord[] = [];

    for (const log of store.activityLogs) {
      const isRelevant =
        log.menu === "Data Aset" ||
        log.menu === "Observasi Ruangan" ||
        log.menu === "Sinkronisasi" ||
        log.target_type === "Asset" ||
        log.target_type === "Kategori" ||
        log.target_type === "Ruangan" ||
        ["tambah", "update", "hapus"].includes(log.jenis);

      if (!isRelevant) continue;

      const jenisLabel: "Tambah" | "Edit" | "Hapus" =
        log.jenis === "tambah" ? "Tambah" :
        log.jenis === "hapus" ? "Hapus" : "Edit";

      if (log.items_detail && log.items_detail.length > 0) {
        // Multiple or detailed items unfolded
        log.items_detail.forEach((it, idx) => {
          let detailDesc = "";
          if (it.diffs && it.diffs.length > 0) {
            detailDesc = it.diffs.map(d => `${d.label}: ${d.oldVal} → ${d.newVal}`).join("; ");
          } else if (jenisLabel === "Tambah") {
            detailDesc = `Item baru dimasukkan (Kondisi: ${it.kondisi || "Baik"}${it.ruangan ? `, Lokasi: ${it.ruangan}` : ""})`;
          } else if (jenisLabel === "Hapus") {
            detailDesc = `Item dihapus dari inventaris (Snapshot diarsipkan)`;
          } else {
            detailDesc = log.field_changed ? `${log.field_changed}: ${log.old_value || "—"} → ${log.new_value || "—"}` : log.aksi;
          }

          list.push({
            id: `${log.id}-${it.id || it.kode || idx}`,
            logId: log.id,
            waktu: log.waktu,
            tgl: log.tgl,
            kodeBarang: it.kode || it.id || log.target_id || "-",
            namaBarang: it.nama || (it.snapshot as any)?.Nama_Barang || (it.snapshot as any)?.nama_barang || "-",
            kategori: it.kategori || log.menu || "Data Aset",
            ruangan: it.ruangan || (it.snapshot as any)?.Nama_ruangan || "-",
            kondisi: it.kondisi || (it.snapshot as any)?.Kondisi || "Baik",
            nilai: it.nilai || (it.snapshot as any)?._nilai_buku || (it.snapshot as any)?._harga_perolehan || 0,
            nup: it.nup,
            merek: it.merek,
            volume: it.volume,
            satuan: it.satuan,
            jenisPerubahan: jenisLabel,
            detailPerubahan: detailDesc,
            diffs: it.diffs || log.diffs,
            oldValue: it.old_value || log.old_value,
            newValue: it.new_value || log.new_value,
            pengguna: log.pengguna,
            role: log.role,
            ip: log.ip || "127.0.0.1",
            device: log.device || "Chrome",
            status: log.status,
            sourceLog: log,
            itemDetail: it,
          });
        });
      } else {
        // Single log without explicit items_detail
        const matchedAsset = store.assets.find(a => a.id === log.target_id);
        const itemKode = log.target_id && log.target_id !== "BULK" && log.target_id !== "-" ? log.target_id : "-";
        const itemNama = matchedAsset?.Nama_Barang || log.aksi;
        const itemKategori = matchedAsset?.TipeAset || log.menu || "Data Aset";
        const itemRuangan = matchedAsset?.Nama_ruangan || "-";
        const itemKondisi = matchedAsset?.Kondisi || "Baik";
        const itemNilai = matchedAsset?._nilai_buku || matchedAsset?._harga_perolehan || 0;

        let detailDesc = "";
        if (log.diffs && log.diffs.length > 0) {
          detailDesc = log.diffs.map(d => `${d.label}: ${d.oldVal} → ${d.newVal}`).join("; ");
        } else if (log.field_changed) {
          detailDesc = `${log.field_changed}: ${log.old_value || "—"} → ${log.new_value || "—"}`;
        } else {
          detailDesc = log.aksi;
        }

        list.push({
          id: `${log.id}-single`,
          logId: log.id,
          waktu: log.waktu,
          tgl: log.tgl,
          kodeBarang: itemKode,
          namaBarang: itemNama,
          kategori: itemKategori,
          ruangan: itemRuangan,
          kondisi: itemKondisi,
          nilai: itemNilai,
          jenisPerubahan: jenisLabel,
          detailPerubahan: detailDesc,
          diffs: log.diffs,
          oldValue: log.old_value,
          newValue: log.new_value,
          pengguna: log.pengguna,
          role: log.role,
          ip: log.ip || "127.0.0.1",
          device: log.device || "Chrome",
          status: log.status,
          sourceLog: log,
        });
      }
    }

    return list.sort((a, b) => `${b.tgl}${b.waktu}`.localeCompare(`${a.tgl}${a.waktu}`));
  }, [store.activityLogs, store.assets]);

  // Filtering
  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const d7Ago = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const d30Ago = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    return itemChanges.filter((item) => {
      const q = search.toLowerCase();
      const matchQ =
        item.kodeBarang.toLowerCase().includes(q) ||
        item.namaBarang.toLowerCase().includes(q) ||
        item.ruangan.toLowerCase().includes(q) ||
        item.pengguna.toLowerCase().includes(q) ||
        item.detailPerubahan.toLowerCase().includes(q);

      const matchKat =
        kategoriFilter === "Semua Kategori" ? true :
        kategoriFilter === "Peralatan & Mesin (PM)" ? item.kategori.includes("PM") || item.kategori.includes("Peralatan") :
        kategoriFilter === "Aset Tak Berwujud (ATB)" ? item.kategori.includes("ATB") || item.kategori.includes("Tak Berwujud") :
        kategoriFilter === "Aset Tetap Lainnya (ATL)" ? item.kategori.includes("ATL") || item.kategori.includes("Tetap Lainnya") :
        kategoriFilter === "Alat Angkutan (AL)" ? item.kategori.includes("AL") || item.kategori.includes("Angkutan") :
        kategoriFilter === "Observasi Ruangan" ? item.kategori.includes("Observasi") :
        item.kategori.toLowerCase().includes(kategoriFilter.toLowerCase());

      const matchJenis =
        jenisFilter === "Semua Jenis" ||
        (jenisFilter === "Tambah" && item.jenisPerubahan === "Tambah") ||
        (jenisFilter === "Edit" && item.jenisPerubahan === "Edit") ||
        (jenisFilter === "Hapus" && item.jenisPerubahan === "Hapus");

      const matchRentang =
        rentangFilter === "Semua Waktu" ? true :
        rentangFilter === "Hari Ini" ? item.tgl === today :
        rentangFilter === "7 Hari Terakhir" ? item.tgl >= d7Ago :
        rentangFilter === "30 Hari Terakhir" ? item.tgl >= d30Ago : true;

      return matchQ && matchKat && matchJenis && matchRentang;
    });
  }, [itemChanges, search, kategoriFilter, jenisFilter, rentangFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedList = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Summary Metrics
  const metrics = useMemo(() => {
    return {
      total: filtered.length,
      tambah: filtered.filter(i => i.jenisPerubahan === "Tambah").length,
      edit: filtered.filter(i => i.jenisPerubahan === "Edit").length,
      hapus: filtered.filter(i => i.jenisPerubahan === "Hapus").length,
    };
  }, [filtered]);

  const handleExport = () => {
    exportToExcel(
      filtered.map((it, idx) => ({
        "No": idx + 1,
        "Tanggal": it.tgl,
        "Waktu": it.waktu,
        "Kode Barang": it.kodeBarang,
        "Nama Barang": it.namaBarang,
        "Kategori": it.kategori,
        "Ruangan / Lokasi": it.ruangan,
        "Jenis Perubahan": it.jenisPerubahan,
        "Detail Perubahan": it.detailPerubahan,
        "Nilai Lama": it.oldValue || "-",
        "Nilai Baru": it.newValue || "-",
        "Kondisi": it.kondisi || "Baik",
        "Nilai Aset": it.nilai || 0,
        "Pengguna": it.pengguna,
        "Role": it.role,
        "IP Address": it.ip,
      })),
      `perubahan-aset-item-level-${new Date().toISOString().slice(0, 10)}`,
      "Perubahan Aset"
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-medium">Total Item Berubah</span>
            <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700"><Database size={16} /></span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{metrics.total}</p>
          <span className="text-[10px] text-slate-400">Level baris per-item</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-medium">Penambahan Item</span>
            <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700"><Plus size={16} /></span>
          </div>
          <p className="text-2xl font-bold text-emerald-700">{metrics.tambah}</p>
          <span className="text-[10px] text-slate-400">Upload Excel & Tambah manual</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-medium">Pembaruan Nilai/Kondisi</span>
            <span className="p-1.5 rounded-lg bg-amber-100 text-amber-700"><Edit3 size={16} /></span>
          </div>
          <p className="text-2xl font-bold text-amber-700">{metrics.edit}</p>
          <span className="text-[10px] text-slate-400">Edit data & perubahan status</span>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 font-medium">Penghapusan Item</span>
            <span className="p-1.5 rounded-lg bg-rose-100 text-rose-700"><Trash2 size={16} /></span>
          </div>
          <p className="text-2xl font-bold text-rose-700">{metrics.hapus}</p>
          <span className="text-[10px] text-slate-400">Snapshot tetap tersimpan</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cari Kode Barang, Nama Barang, Ruangan, Pengguna..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={kategoriFilter}
          onChange={e => { setKategoriFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 outline-none"
        >
          <option>Semua Kategori</option>
          <option>Peralatan & Mesin (PM)</option>
          <option>Aset Tak Berwujud (ATB)</option>
          <option>Aset Tetap Lainnya (ATL)</option>
          <option>Alat Angkutan (AL)</option>
          <option>Observasi Ruangan</option>
        </select>
        <select
          value={jenisFilter}
          onChange={e => { setJenisFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 outline-none"
        >
          <option>Semua Jenis</option>
          <option value="Tambah">Tambah Data</option>
          <option value="Edit">Edit / Update</option>
          <option value="Hapus">Hapus Data</option>
        </select>
        <select
          value={rentangFilter}
          onChange={e => { setRentangFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 outline-none"
        >
          <option>Semua Waktu</option>
          <option>Hari Ini</option>
          <option>7 Hari Terakhir</option>
          <option>30 Hari Terakhir</option>
        </select>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
        >
          <Download size={14} /> Export Perubahan (.xlsx)
        </button>
      </div>

      {/* Item-Level Changelog Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: 1060 }}>
            <thead>
              <tr className="border-b border-gray-200 bg-slate-50/80">
                <th className="py-3 px-4 text-left text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">Waktu</th>
                <th className="py-3 px-4 text-left text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">Kode Barang</th>
                <th className="py-3 px-4 text-left text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">Nama Barang</th>
                <th className="py-3 px-4 text-left text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">Kategori</th>
                <th className="py-3 px-4 text-left text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">Jenis</th>
                <th className="py-3 px-4 text-left text-[11px] font-bold text-slate-600 uppercase">Detail Perubahan / Nilai</th>
                <th className="py-3 px-4 text-left text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">Pengguna</th>
                <th className="py-3 px-4 text-right text-[11px] font-bold text-slate-600 uppercase whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedList.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedLog(item.sourceLog)}
                  className="hover:bg-blue-50/40 cursor-pointer transition-colors text-xs"
                >
                  <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                    <div className="font-mono font-medium">{item.waktu}</div>
                    <div className="text-[10px] text-slate-400">{fmtDate(item.tgl)}</div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                      {item.kodeBarang}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-800 max-w-[220px] truncate" title={item.namaBarang}>
                      {item.namaBarang}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate max-w-[220px]">
                      {item.ruangan !== "-" ? item.ruangan : ""}
                    </div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                      {item.kategori}
                    </span>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {item.jenisPerubahan === "Tambah" && (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">
                        <Plus size={10} /> Tambah
                      </span>
                    )}
                    {item.jenisPerubahan === "Edit" && (
                      <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold">
                        <Edit3 size={10} /> Edit
                      </span>
                    )}
                    {item.jenisPerubahan === "Hapus" && (
                      <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded text-[10px] font-bold">
                        <Trash2 size={10} /> Hapus
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {item.jenisPerubahan === "Edit" ? (
                      <div className="text-xs text-slate-700 bg-amber-50/50 p-1.5 rounded border border-amber-100 max-w-[320px]">
                        <span className="font-medium text-amber-900 line-clamp-2">{item.detailPerubahan}</span>
                      </div>
                    ) : item.jenisPerubahan === "Hapus" ? (
                      <span className="text-xs text-rose-700 font-medium bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                        Item dihapus (Snapshot diarsipkan)
                      </span>
                    ) : (
                      <span className="text-xs text-slate-700 max-w-[300px] truncate block" title={item.detailPerubahan}>
                        {item.detailPerubahan}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="font-medium text-slate-800">{item.pengguna}</div>
                    <div className="text-[10px] text-slate-400">{item.role}</div>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => { e.stopPropagation(); setSelectedLog(item.sourceLog); }}>
                    <button
                      className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-100/60 transition-colors inline-flex items-center gap-1 text-xs font-semibold"
                      title="Lihat snapshot lengkap"
                    >
                      <Eye size={13} /> Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="py-14 text-center">
            <Database size={32} className="text-slate-200 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-500">Tidak ada perubahan data aset yang sesuai dengan filter.</p>
            <p className="text-xs text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau pilihan filter kategori.</p>
          </div>
        )}

        {/* Pagination Bar */}
        {filtered.length > 0 && (
          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span>Menampilkan {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, filtered.length)} dari {filtered.length} total perubahan</span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="bg-white border border-slate-200 rounded px-2 py-1 text-xs outline-none"
              >
                <option value={10}>10 baris</option>
                <option value={15}>15 baris</option>
                <option value={25}>25 baris</option>
                <option value={50}>50 baris</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-100"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 font-medium text-slate-700">Halaman {page} dari {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-100"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      <ActivityDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
}

// ── Sinkronisasi Tab (MATCHING OBSERVASI KE DATA RESMI BMN) ─────────────────────

// Debounce hook
function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// Constants
const PAGE_SIZE = 50;

// Memoized BMN Card
const BmnCard = React.memo(function BmnCard({
  asset,
  isSelected,
  onSelect,
}: {
  asset: Asset;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const nupVal = (
    asset.Id_aset ||
    asset.id_aset ||
    asset.nup ||
    asset.NUP ||
    asset.no_nup ||
    asset.No_NUP ||
    asset.nomor_nup ||
    (asset.extra_fields as any)?.Id_aset ||
    (asset.extra_fields as any)?.id_aset ||
    (asset.extra_fields as any)?.nup ||
    (asset.extra_fields as any)?.NUP ||
    ""
  ).toString().trim();
  const displayNup = nupVal && nupVal !== "-" ? nupVal : "-";

  return (
    <div
      onClick={onSelect}
      className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
        isSelected
          ? "bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20 shadow-md"
          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-sm"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-blue-600">
          {isSelected ? (
            <CheckSquare size={18} className="text-blue-600" />
          ) : (
            <Square size={18} className="text-slate-300 hover:text-slate-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono font-bold text-xs text-blue-800 bg-blue-100/70 px-2 py-0.5 rounded">
              NUP: {displayNup}
            </span>
            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
              {asset.TipeAset || asset.jenis_aset || "PM"}
            </span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
              asset.Kondisi === "Baik" ? "bg-green-100 text-green-700" :
              asset.Kondisi === "Rusak Ringan" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
            }`}>
              {asset.Kondisi || "Baik"}
            </span>
          </div>

          <h4 className="text-xs font-bold text-slate-900 line-clamp-1 mb-1" title={asset.Nama_Barang}>
            {asset.Nama_Barang}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-600">
            <div className="flex items-center gap-1 text-slate-700 truncate" title={asset.Nama_ruangan}>
              <Building2 size={12} className="text-slate-400 shrink-0" />
              <span className="truncate font-medium">{asset.Nama_ruangan || "-"}</span>
            </div>
            <div className="text-slate-500 truncate" title={asset.Pengguna}>
              PIC: {asset.Pengguna || "-"}
            </div>
          </div>

          <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            <span>Perolehan: {asset.TglPerolehan || "-"}</span>
            <span className="font-mono font-semibold text-slate-700">
              {fmtRupiah(asset._nilai_buku || asset._harga_perolehan)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

// Memoized Obs Card
const ObsCard = React.memo(function ObsCard({
  obs,
  isSelected,
  onSelect,
}: {
  obs: ObservasiItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const nupVal = (obs.nup || "").toString().trim();
  const displayNup = nupVal && nupVal !== "-" ? nupVal : "-";

  return (
    <div
      onClick={onSelect}
      className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
        isSelected
          ? "bg-amber-50/80 border-amber-500 ring-2 ring-amber-500/20 shadow-md"
          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 shadow-sm"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-amber-600">
          {isSelected ? (
            <CheckSquare size={18} className="text-amber-600" />
          ) : (
            <Square size={18} className="text-slate-300 hover:text-slate-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-mono font-bold text-xs text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded">
              NUP: {displayNup}
            </span>
            <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
              Vol: {obs.volume || 1} {obs.satuan || "Unit"}
            </span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
              obs.kondisi === "Baik" ? "bg-green-100 text-green-700" :
              obs.kondisi === "Rusak Ringan" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
            }`}>
              {obs.kondisi || "Baik"}
            </span>
          </div>

          <h4 className="text-xs font-bold text-slate-900 line-clamp-1 mb-1" title={obs.namaBarang}>
            {obs.namaBarang}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px] text-slate-600">
            <div className="flex items-center gap-1 text-slate-700 truncate" title={obs.namaRuangan}>
              <Building2 size={12} className="text-slate-400 shrink-0" />
              <span className="truncate font-medium">{obs.namaRuangan || obs.ruanganId}</span>
            </div>
            <div className="text-slate-500 truncate" title={obs.merekType}>
              Merk: {obs.merekType || "-"}
            </div>
          </div>

          <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            <span>Tahun: {obs.tahun || obs.tahunPerolehan || "2026"}</span>
            <span>Petugas: {obs.petugas || "Operator"}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

function SinkronisasiTab() {
  const store = useDataStore();

  // Filter states
  const [selectedCampus, setSelectedCampus] = useState("Semua Kampus");
  const [selectedGedung, setSelectedGedung] = useState("Semua Gedung");
  const [selectedRuangan, setSelectedRuangan] = useState("Semua Ruangan");

  const [searchBmnRaw, setSearchBmnRaw] = useState("");
  const [categoryBmn, setCategoryBmn] = useState("Semua Kategori");

  const [searchObsRaw, setSearchObsRaw] = useState("");
  const [kondisiObs, setKondisiObs] = useState("Semua Kondisi");

  // Debounced search values (300ms)
  const searchBmn = useDebounce(searchBmnRaw, 300);
  const searchObs = useDebounce(searchObsRaw, 300);

  // Progressive rendering: how many items to show
  const [bmnVisibleCount, setBmnVisibleCount] = useState(PAGE_SIZE);
  const [obsVisibleCount, setObsVisibleCount] = useState(PAGE_SIZE);
  const bmnScrollRef = useRef<HTMLDivElement>(null);
  const obsScrollRef = useRef<HTMLDivElement>(null);

  // Selection states (1 from Left, 1 from Right)
  const [selectedBmnId, setSelectedBmnId] = useState<string | null>(null);
  const [selectedObsId, setSelectedObsId] = useState<string | null>(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  // Dynamic building and room list for location filter
  const gedungOptions = useMemo(() => {
    const list = store.getGedungList(selectedCampus === "Semua Kampus" ? undefined : selectedCampus);
    return ["Semua Gedung", ...list];
  }, [store, selectedCampus]);

  const ruanganOptions = useMemo(() => {
    const list = store.getRuanganList(selectedGedung === "Semua Gedung" ? undefined : selectedGedung);
    return ["Semua Ruangan", ...Array.from(new Set(list.map(r => r.namaRuangan))).sort()];
  }, [store, selectedGedung]);

  // Reset dependent filters when campus/gedung changes
  const handleCampusChange = (c: string) => {
    setSelectedCampus(c);
    setSelectedGedung("Semua Gedung");
    setSelectedRuangan("Semua Ruangan");
  };

  const handleGedungChange = (g: string) => {
    setSelectedGedung(g);
    setSelectedRuangan("Semua Ruangan");
  };

  // Reset visible counts when filters change
  useEffect(() => {
    setBmnVisibleCount(PAGE_SIZE);
  }, [searchBmn, categoryBmn, selectedCampus, selectedGedung, selectedRuangan]);

  useEffect(() => {
    setObsVisibleCount(PAGE_SIZE);
  }, [searchObs, kondisiObs, selectedCampus, selectedGedung, selectedRuangan]);

  // Left Panel: Filtered BMN Assets
  const filteredBmnAssets = useMemo(() => {
    return store.assets.filter((asset) => {
      const q = searchBmn.toLowerCase();
      const nup = (
        asset.Id_aset ||
        asset.id_aset ||
        asset.nup ||
        asset.NUP ||
        asset.no_nup ||
        asset.No_NUP ||
        asset.nomor_nup ||
        (asset.extra_fields as any)?.Id_aset ||
        (asset.extra_fields as any)?.id_aset ||
        (asset.extra_fields as any)?.nup ||
        (asset.extra_fields as any)?.NUP ||
        ""
      ).toString().toLowerCase();

      const matchQ =
        !q ||
        (asset.id || "").toLowerCase().includes(q) ||
        (asset.kode_tag_aset || "").toLowerCase().includes(q) ||
        (asset.Nama_Barang || "").toLowerCase().includes(q) ||
        (asset.Nama_ruangan || "").toLowerCase().includes(q) ||
        (asset.Pengguna || "").toLowerCase().includes(q) ||
        nup.includes(q);

      const matchCat =
        categoryBmn === "Semua Kategori" ||
        (categoryBmn === "PM" && (asset.TipeAset === "PM" || asset.jenis_aset === "PM")) ||
        (categoryBmn === "ATB" && (asset.TipeAset === "ATB" || asset.jenis_aset === "ATB")) ||
        (categoryBmn === "ATL" && (asset.TipeAset === "ATL" || asset.jenis_aset === "ATL")) ||
        (categoryBmn === "AL" && (asset.TipeAset === "AL" || asset.TipeAset === "ALAT_ANGKUTAN" || asset.jenis_aset === "AL"));

      const matchCampus =
        selectedCampus === "Semua Kampus" ||
        (asset.kampus && asset.kampus.toLowerCase().includes(selectedCampus.toLowerCase())) ||
        (asset.Nama_unit && asset.Nama_unit.toLowerCase().includes(selectedCampus.toLowerCase()));

      const matchGedung =
        selectedGedung === "Semua Gedung" ||
        (asset.nama_gedung && asset.nama_gedung.toLowerCase().includes(selectedGedung.toLowerCase()));

      const matchRuangan =
        selectedRuangan === "Semua Ruangan" ||
        (asset.Nama_ruangan && asset.Nama_ruangan.toLowerCase().includes(selectedRuangan.toLowerCase())) ||
        (asset.nama_ruangan_standar && asset.nama_ruangan_standar.toLowerCase().includes(selectedRuangan.toLowerCase()));

      return matchQ && matchCat && matchCampus && matchGedung && matchRuangan;
    });
  }, [store.assets, searchBmn, categoryBmn, selectedCampus, selectedGedung, selectedRuangan]);

  // Right Panel: Filtered Observasi Items
  const filteredObservasiItems = useMemo(() => {
    return store.observasiItems.filter((item) => {
      const q = searchObs.toLowerCase();
      const matchQ =
        !q ||
        (item.namaBarang || "").toLowerCase().includes(q) ||
        (item.kodeBarang || "").toLowerCase().includes(q) ||
        (item.nup || "").toLowerCase().includes(q) ||
        (item.namaRuangan || "").toLowerCase().includes(q) ||
        (item.merekType || "").toLowerCase().includes(q) ||
        (item.petugas || "").toLowerCase().includes(q);

      const matchKondisi =
        kondisiObs === "Semua Kondisi" ||
        (item.kondisi && item.kondisi.toLowerCase() === kondisiObs.toLowerCase());

      const matchCampus =
        selectedCampus === "Semua Kampus" ||
        (item.kampus && item.kampus.toLowerCase().includes(selectedCampus.toLowerCase()));

      const matchGedung =
        selectedGedung === "Semua Gedung" ||
        (item.namaGedung && item.namaGedung.toLowerCase().includes(selectedGedung.toLowerCase()));

      const matchRuangan =
        selectedRuangan === "Semua Ruangan" ||
        (item.namaRuangan && item.namaRuangan.toLowerCase().includes(selectedRuangan.toLowerCase())) ||
        (item.kodeRuangan && item.kodeRuangan.toLowerCase().includes(selectedRuangan.toLowerCase()));

      return matchQ && matchKondisi && matchCampus && matchGedung && matchRuangan;
    });
  }, [store.observasiItems, searchObs, kondisiObs, selectedCampus, selectedGedung, selectedRuangan]);

  // Sliced visible items (progressive rendering)
  const visibleBmnAssets = useMemo(() => filteredBmnAssets.slice(0, bmnVisibleCount), [filteredBmnAssets, bmnVisibleCount]);
  const visibleObsItems = useMemo(() => filteredObservasiItems.slice(0, obsVisibleCount), [filteredObservasiItems, obsVisibleCount]);

  const selectedBmn = useMemo(() => {
    return store.assets.find(a => a.id === selectedBmnId) || null;
  }, [store.assets, selectedBmnId]);

  const selectedObs = useMemo(() => {
    return store.observasiItems.find(o => String(o.id) === String(selectedObsId)) || null;
  }, [store.observasiItems, selectedObsId]);

  // Location mismatch check
  const isLocationMismatch = useMemo(() => {
    if (!selectedBmn || !selectedObs) return false;
    const bmnRoom = (selectedBmn.Nama_ruangan || selectedBmn.nama_ruangan_standar || "").trim().toLowerCase();
    const obsRoom = (selectedObs.namaRuangan || "").trim().toLowerCase();
    if (!bmnRoom || !obsRoom) return false;
    return bmnRoom !== obsRoom;
  }, [selectedBmn, selectedObs]);

  // Infinite scroll handlers
  const handleBmnScroll = useCallback(() => {
    const el = bmnScrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      setBmnVisibleCount(prev => {
        if (prev >= filteredBmnAssets.length) return prev;
        return Math.min(prev + PAGE_SIZE, filteredBmnAssets.length);
      });
    }
  }, [filteredBmnAssets.length]);

  const handleObsScroll = useCallback(() => {
    const el = obsScrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      setObsVisibleCount(prev => {
        if (prev >= filteredObservasiItems.length) return prev;
        return Math.min(prev + PAGE_SIZE, filteredObservasiItems.length);
      });
    }
  }, [filteredObservasiItems.length]);

  const handleExecuteSync = async () => {
    if (!selectedObsId || !selectedBmnId) return;
    try {
      await store.syncObservasiWithBmn(selectedObsId, selectedBmnId);
      const bmnName = selectedBmn?.Nama_Barang || selectedBmnId;
      const obsName = selectedObs?.namaBarang || selectedObsId;
      setSyncSuccessMsg(`Berhasil menyinkronkan data temuan "${obsName}" ke data resmi BMN "${bmnName}" (${selectedBmnId})!`);
      setSelectedBmnId(null);
      setSelectedObsId(null);
      setShowConfirmModal(false);
      setTimeout(() => setSyncSuccessMsg(null), 6000);
    } catch (err: any) {
      alert(`Gagal menyinkronkan data: ${err.message || "Terjadi kesalahan"}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Info & Guide Banner */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 border border-blue-200/80 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20 mt-0.5">
              <ArrowLeftRight size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Sinkronisasi & Rekonsiliasi Data Observasi ke BMN Resmi
                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Anti-Duplikasi
                </span>
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-3xl">
                Gunakan menu ini untuk mencocokkan item hasil <strong>Observasi Lapangan</strong> dengan <strong>Data Resmi BMN</strong> yang baru didaftarkan/diunggah. Setelah dicocokkan, catatan observasi lapangan akan dihapus agar tidak dihitung ganda, sementara data resmi BMN dipertahankan.
              </p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-3 shrink-0 bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-xl p-2.5 shadow-sm text-xs">
            <div className="text-center px-3 border-r border-slate-200">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Aset Resmi BMN</span>
              <span className="font-bold text-slate-800 text-sm">{filteredBmnAssets.length}</span>
            </div>
            <div className="text-center px-3">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Aset Observasi</span>
              <span className="font-bold text-blue-700 text-sm">{filteredObservasiItems.length}</span>
            </div>
          </div>
        </div>

        {/* Location Filter Shared Bar */}
        <div className="mt-4 pt-4 border-t border-blue-200/60 flex items-center gap-2.5 flex-wrap text-xs">
          <span className="font-bold text-slate-700 flex items-center gap-1.5 mr-1 text-xs">
            <MapPin size={14} className="text-blue-600" />
            Filter Lokasi Bersama:
          </span>

          <select
            value={selectedCampus}
            onChange={(e) => handleCampusChange(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 rounded-lg px-3 py-1.5 outline-none font-medium focus:ring-1 focus:ring-blue-500 shadow-sm"
          >
            <option>Semua Kampus</option>
            <option>Kampus Cilibende</option>
            <option>Kampus Baranangsiang</option>
            <option>Kampus Gunung Gede</option>
          </select>

          <select
            value={selectedGedung}
            onChange={(e) => handleGedungChange(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 rounded-lg px-3 py-1.5 outline-none font-medium focus:ring-1 focus:ring-blue-500 shadow-sm"
          >
            {gedungOptions.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <select
            value={selectedRuangan}
            onChange={(e) => setSelectedRuangan(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 rounded-lg px-3 py-1.5 outline-none font-medium focus:ring-1 focus:ring-blue-500 shadow-sm"
          >
            {ruanganOptions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {(selectedCampus !== "Semua Kampus" || selectedGedung !== "Semua Gedung" || selectedRuangan !== "Semua Ruangan") && (
            <button
              onClick={() => {
                setSelectedCampus("Semua Kampus");
                setSelectedGedung("Semua Gedung");
                setSelectedRuangan("Semua Ruangan");
              }}
              className="text-xs text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 rounded hover:bg-rose-50 transition-colors"
            >
              Reset Filter Lokasi
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Alert */}
      {syncSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-emerald-800 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-600 shrink-0" />
            <span className="font-semibold">{syncSuccessMsg}</span>
          </div>
          <button onClick={() => setSyncSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-900 font-bold p-1">
            <X size={14} />
          </button>
        </div>
      )}

      {/* 2-Panel Side-by-Side Matching Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* PANEL KIRI: Data Baru dari Sistem IPB (BMN Resmi) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[580px]">
          {/* Panel Header */}
          <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                BMN
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Data Baru dari Sistem IPB (BMN Resmi)
                </h3>
                <span className="text-[11px] text-slate-500">
                  Data resmi terdaftar di Sistem Inventaris
                </span>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {filteredBmnAssets.length} Aset
            </span>
          </div>

          {/* Panel Sub-Filter Toolbar */}
          <div className="p-3.5 border-b border-slate-100 bg-white grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchBmnRaw}
                onChange={(e) => setSearchBmnRaw(e.target.value)}
                placeholder="Cari NUP, Nama, PIC..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
              />
            </div>
            <select
              value={categoryBmn}
              onChange={(e) => setCategoryBmn(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 outline-none"
            >
              <option>Semua Kategori</option>
              <option value="PM">Peralatan & Mesin (PM)</option>
              <option value="ATB">Aset Tak Berwujud (ATB)</option>
              <option value="ATL">Aset Tetap Lainnya (ATL)</option>
              <option value="AL">Alat Angkutan (AL)</option>
            </select>
          </div>

          {/* Panel Items List — Progressive Rendering */}
          <div
            ref={bmnScrollRef}
            onScroll={handleBmnScroll}
            className="flex-1 overflow-y-auto p-3.5 space-y-2.5 max-h-[500px]"
          >
            {visibleBmnAssets.map((asset) => (
              <BmnCard
                key={asset.id}
                asset={asset}
                isSelected={selectedBmnId === asset.id}
                onSelect={() => setSelectedBmnId(prev => prev === asset.id ? null : asset.id)}
              />
            ))}

            {/* Load more indicator */}
            {bmnVisibleCount < filteredBmnAssets.length && (
              <div className="py-3 text-center">
                <button
                  onClick={() => setBmnVisibleCount(prev => Math.min(prev + PAGE_SIZE, filteredBmnAssets.length))}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors border border-blue-200"
                >
                  Tampilkan lebih banyak ({Math.min(PAGE_SIZE, filteredBmnAssets.length - bmnVisibleCount)} berikutnya dari {filteredBmnAssets.length - bmnVisibleCount} tersisa)
                </button>
              </div>
            )}

            {filteredBmnAssets.length === 0 && (
              <div className="py-14 text-center">
                <Database size={28} className="text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-500">Tidak ada data aset BMN yang sesuai filter.</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Coba sesuaikan kata kunci atau filter lokasi.</p>
              </div>
            )}
          </div>
        </div>

        {/* PANEL KANAN: Data dari Observasi Ruangan (Temuan Lapangan) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[580px]">
          {/* Panel Header */}
          <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                OBS
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Data dari Observasi Ruangan
                </h3>
                <span className="text-[11px] text-slate-500">
                  Temuan fisik lapangan yang belum dicocokkan
                </span>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              {filteredObservasiItems.length} Item
            </span>
          </div>

          {/* Panel Sub-Filter Toolbar */}
          <div className="p-3.5 border-b border-slate-100 bg-white grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchObsRaw}
                onChange={(e) => setSearchObsRaw(e.target.value)}
                placeholder="Cari Barang, NUP, Merk..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white"
              />
            </div>
            <select
              value={kondisiObs}
              onChange={(e) => setKondisiObs(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 outline-none"
            >
              <option>Semua Kondisi</option>
              <option value="Baik">Baik</option>
              <option value="Rusak Ringan">Rusak Ringan</option>
              <option value="Rusak Berat">Rusak Berat</option>
            </select>
          </div>

          {/* Panel Items List — Progressive Rendering */}
          <div
            ref={obsScrollRef}
            onScroll={handleObsScroll}
            className="flex-1 overflow-y-auto p-3.5 space-y-2.5 max-h-[500px]"
          >
            {visibleObsItems.map((obs) => (
              <ObsCard
                key={obs.id}
                obs={obs}
                isSelected={selectedObsId === String(obs.id)}
                onSelect={() => setSelectedObsId(prev => prev === String(obs.id) ? null : String(obs.id))}
              />
            ))}

            {/* Load more indicator */}
            {obsVisibleCount < filteredObservasiItems.length && (
              <div className="py-3 text-center">
                <button
                  onClick={() => setObsVisibleCount(prev => Math.min(prev + PAGE_SIZE, filteredObservasiItems.length))}
                  className="text-xs font-semibold text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-4 py-2 rounded-lg transition-colors border border-amber-200"
                >
                  Tampilkan lebih banyak ({Math.min(PAGE_SIZE, filteredObservasiItems.length - obsVisibleCount)} berikutnya dari {filteredObservasiItems.length - obsVisibleCount} tersisa)
                </button>
              </div>
            )}

            {filteredObservasiItems.length === 0 && (
              <div className="py-14 text-center">
                <ClipboardList size={28} className="text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-500">Tidak ada item observasi lapangan yang sesuai filter.</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Semua data observasi di lokasi ini mungkin sudah disinkronkan.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Floating / Sticky Matching Action Bar */}
      <div className="sticky bottom-4 z-20 bg-slate-900 text-white rounded-2xl shadow-2xl p-4 border border-slate-800 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/40 text-blue-400 flex items-center justify-center shrink-0">
            <Sparkles size={18} />
          </div>

          <div className="flex-1 min-w-0">
            {selectedBmn && selectedObs ? (
              <div className="text-xs space-y-0.5">
                <div className="flex items-center gap-1.5 text-slate-300 truncate">
                  <span className="text-blue-400 font-bold truncate">[{selectedBmn.id}] {selectedBmn.Nama_Barang}</span>
                  <span className="text-slate-500 font-bold">⇄</span>
                  <span className="text-amber-400 font-bold truncate">{selectedObs.namaBarang}</span>
                </div>
                {isLocationMismatch ? (
                  <p className="text-[11px] text-amber-400 font-semibold flex items-center gap-1">
                    <AlertTriangle size={12} />
                    Peringatan: Lokasi ruangan berbeda (BMN: "{selectedBmn.Nama_ruangan}" vs Obs: "{selectedObs.namaRuangan}")
                  </p>
                ) : (
                  <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle size={12} />
                    Lokasi ruangan cocok: "{selectedBmn.Nama_ruangan}"
                  </p>
                )}
              </div>
            ) : selectedBmn ? (
              <p className="text-xs text-slate-300">
                Aset BMN terpilih: <span className="font-bold text-blue-400">[{selectedBmn.id}] {selectedBmn.Nama_Barang}</span>. Silakan pilih 1 item dari panel kanan Observasi.
              </p>
            ) : selectedObs ? (
              <p className="text-xs text-slate-300">
                Item Observasi terpilih: <span className="font-bold text-amber-400">{selectedObs.namaBarang}</span>. Silakan pilih 1 item dari panel kiri BMN Resmi.
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                Pilih <strong>1 item Data Resmi BMN</strong> (kiri) dan <strong>1 item Observasi Lapangan</strong> (kanan) untuk memulai pencocokan.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {(selectedBmnId || selectedObsId) && (
            <button
              onClick={() => {
                setSelectedBmnId(null);
                setSelectedObsId(null);
              }}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Batal Pilih
            </button>
          )}

          <button
            disabled={!selectedBmn || !selectedObs}
            onClick={() => setShowConfirmModal(true)}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-all"
          >
            <ArrowLeftRight size={14} />
            Match & Sinkronkan
          </button>
        </div>
      </div>

      {/* Confirmation Matching Dialog */}
      {showConfirmModal && selectedBmn && selectedObs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <ArrowLeftRight size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Konfirmasi Sinkronisasi & Rekonsiliasi Aset
                  </h3>
                  <span className="text-[11px] text-slate-500">
                    Pencocokan data lapangan dengan catatan resmi BMN
                  </span>
                </div>
              </div>
              <button onClick={() => setShowConfirmModal(false)} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-blue-50/70 rounded-xl p-4 border border-blue-200/60">
                  <span className="text-[10px] font-black uppercase text-blue-800">Data Resmi BMN (Target)</span>
                  <h4 className="text-sm font-bold text-slate-900 mt-1 line-clamp-2">{selectedBmn.Nama_Barang}</h4>
                  <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                    <p><strong>NUP:</strong> {(selectedBmn.Id_aset || selectedBmn.id_aset || selectedBmn.nup || selectedBmn.NUP || selectedBmn.no_nup || (selectedBmn.extra_fields as any)?.Id_aset || (selectedBmn.extra_fields as any)?.nup || "-").toString().trim() || "-"}</p>
                    <p><strong>Tipe:</strong> {selectedBmn.TipeAset || selectedBmn.jenis_aset}</p>
                    <p><strong>Lokasi:</strong> {selectedBmn.Nama_ruangan || "-"}</p>
                    <p><strong>PIC:</strong> {selectedBmn.Pengguna || "-"}</p>
                    <p><strong>Nilai:</strong> {fmtRupiah(selectedBmn._nilai_buku || selectedBmn._harga_perolehan)}</p>
                  </div>
                </div>
                <div className="bg-amber-50/70 rounded-xl p-4 border border-amber-200/60">
                  <span className="text-[10px] font-black uppercase text-amber-800">Data Observasi Lapangan (Akan Dihapus)</span>
                  <h4 className="text-sm font-bold text-slate-900 mt-1 line-clamp-2">{selectedObs.namaBarang}</h4>
                  <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                    <p><strong>NUP:</strong> {(selectedObs.nup || "-").toString().trim() || "-"}</p>
                    <p><strong>Merk:</strong> {selectedObs.merekType || "-"}</p>
                    <p><strong>Lokasi:</strong> {selectedObs.namaRuangan || "-"}</p>
                    <p><strong>Petugas:</strong> {selectedObs.petugas || "-"}</p>
                    <p><strong>Kondisi:</strong> {selectedObs.kondisi || "Baik"}</p>
                  </div>
                </div>
              </div>

              {isLocationMismatch && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Peringatan Lokasi Berbeda:</span> Data BMN tercatat di ruangan
                    "{selectedBmn.Nama_ruangan}", sementara data observasi berada di ruangan
                    "{selectedObs.namaRuangan}". Jika yakin ini adalah barang yang sama, Anda tetap bisa melanjutkan sinkronisasi.
                  </div>
                </div>
              )}

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-slate-700 space-y-1.5">
                <span className="font-bold text-slate-800 block">Dampak Sinkronisasi:</span>
                <ul className="list-disc list-inside space-y-1 text-slate-600 ml-1">
                  <li>Data observasi "{selectedObs.namaBarang}" akan <strong className="text-red-700">dihapus permanen</strong> dari daftar observasi.</li>
                  <li>Data resmi BMN "{selectedBmn.Nama_Barang}" (<code className="bg-slate-200 px-1 rounded">{selectedBmn.id}</code>) <strong className="text-green-700">dipertahankan</strong> sebagai catatan resmi.</li>
                  <li>Penghitungan total aset akan disesuaikan (tidak lagi dihitung ganda).</li>
                </ul>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 transition-colors border border-slate-200"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteSync}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition-all"
              >
                <CheckCheck size={14} />
                Ya, Match & Sinkronkan
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type AktTab = "log" | "audit" | "perubahan" | "sinkronisasi";

export function AktivitasPage({ topBar }: { topBar?: React.ReactNode }) {
  const store = useDataStore();
  const [activeTab, setActiveTab] = useState<AktTab>("log");

  const kpi = useMemo(() => {
    const allLogs = store.activityLogs;
    const today = new Date().toISOString().slice(0, 10);
    return {
      hariIni:    allLogs.filter(a => a.tgl === today).length,
      perubahan:  allLogs.filter(a => ["tambah", "update", "hapus"].includes(a.jenis)).length,
      login:      allLogs.filter(a => a.jenis === "login").length,
      berisiko:   allLogs.filter(a => a.status === "Berisiko").length,
      gagal:      allLogs.filter(a => a.status === "Gagal").length,
    };
  }, [store.activityLogs]);

  const kpiCards = [
    { label: "Total Aktivitas Hari Ini", value: kpi.hariIni,   sub: fmtDate(new Date().toISOString().slice(0, 10)), color: "#111827", Icon: Activity       },
    { label: "Perubahan Data Aset",      value: kpi.perubahan, sub: "tambah, edit, hapus",    color: "#F59E0B", Icon: Edit3          },
    { label: "Login Pengguna",           value: kpi.login,     sub: "sesi tercatat",           color: "#3B82F6", Icon: LogIn          },
    { label: "Aktivitas Berisiko",       value: kpi.berisiko,  sub: "perlu tindak lanjut",     color: "#EF4444", Icon: AlertTriangle  },
    { label: "Gagal Validasi",           value: kpi.gagal,     sub: "audit perlu ditinjau",    color: "#8B5CF6", Icon: XCircle        },
  ];

  const tabs: { id: AktTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: "log",          label: "Activity Log",        icon: Activity       },
    { id: "audit",        label: "Audit Trail",          icon: Shield         },
    { id: "perubahan",    label: "Perubahan Data Aset",  icon: Database       },
    { id: "sinkronisasi", label: "Sinkronisasi",         icon: ArrowLeftRight },
  ];

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 min-w-0">
      {topBar}
      <div className="px-8 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Aktivitas</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Log aktivitas pengguna, audit trail, perubahan data aset, dan sinkronisasi observasi ke data resmi BMN.
            </p>
          </div>
          <button
            onClick={() => {
              const allLogs = store.activityLogs;
              exportToExcel(allLogs.map(a => ({
                "Tanggal": a.tgl, "Waktu": a.waktu, "Pengguna": a.pengguna,
                "Role": a.role, "Menu": a.menu, "Aktivitas": a.aksi,
                "Jenis": a.jenis, "Status": a.status, "IP": a.ip, "Device": a.device,
                "Jumlah Item": a.items_detail ? a.items_detail.length : a.items_count || 1,
              })), `activity-log-${new Date().toISOString().slice(0,10)}`, "Log Aktivitas");
            }}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm transition-colors">
            <Download size={14} /> Unduh Log
          </button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-5 gap-4">
          {kpiCards.map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500">{s.label}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: s.color + "15", color: s.color }}>
                  <s.Icon size={18} />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all flex-1 justify-center ${
                  activeTab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>
                <Icon size={13} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === "log"          && <ActivityLogTab />}
        {activeTab === "audit"        && <AuditTableTab />}
        {activeTab === "perubahan"    && <PerubahanAsetTab />}
        {activeTab === "sinkronisasi" && <SinkronisasiTab />}
      </div>
    </main>
  );
}
