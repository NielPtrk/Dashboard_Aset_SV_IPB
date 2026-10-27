import React, { useState, useMemo } from "react";
import { useDataStore, type DocumentRecord as StoreDoc, type Asset, type MaintenanceTicket, type MutationRequest, type ProcurementRequest, type StockOpnameRecord } from "./DataStore";
import { exportToExcel } from "./excelUtils";
import {
  Search, Download, Plus, X,
  Eye, Trash2, Edit2, LayoutGrid, LayoutList,
  File, FileSpreadsheet, FileText,
  User, Layers, ShoppingCart, Wrench, ClipboardList, ArrowLeftRight,
  Check, AlertCircle, Upload, Clock, CheckCircle, AlertTriangle,
  Shield, BookOpen, Scale,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type JenisDok = "Pengadaan" | "BAP" | "Maintenance" | "Mutasi" | "Opname" | "Regulasi" | "Referensi";
type KategoriAset = "PM" | "ATB" | "ATL" | "AL" | "-";
type StatusKelengkapan = "Lengkap" | "Belum Lengkap" | "Arsip";
type DokFormat = "PDF" | "DOCX" | "XLSX" | "JPG" | "PNG";

interface RiwayatUpload {
  tgl: string;
  oleh: string;
  versi: string;
  catatan?: string;
}

interface DokRecord {
  id: string;
  namaDok: string;
  nomorRef: string;
  jenis: JenisDok;
  kategoriAset: KategoriAset;
  asetTerkait: string | null;
  transaksiTerkait: string | null;
  unit: string;
  tglUpload: string;
  uploadedBy: string;
  format: DokFormat;
  ukuran: string;
  deskripsi: string;
  statusKelengkapan: StatusKelengkapan;
  tags: string[];
  riwayatUpload: RiwayatUpload[];
  terverifikasi: boolean;
  verifikasiOleh?: string;
  tglVerifikasi?: string;
}

// ─── Conversion: store document → local rich record ───────────────────────────
interface EnrichmentCtx {
  assets: Asset[];
  maintenanceTickets: MaintenanceTicket[];
  mutationRequests: MutationRequest[];
  procurementRequests: ProcurementRequest[];
  stockOpnameRecords: StockOpnameRecord[];
}

function inferFormatFromUrl(url?: string): DokFormat {
  if (!url) return "PDF";
  const u = url.toLowerCase();
  if (u.endsWith(".xlsx") || u.endsWith(".xls")) return "XLSX";
  if (u.endsWith(".docx") || u.endsWith(".doc")) return "DOCX";
  if (u.endsWith(".jpg") || u.endsWith(".jpeg")) return "JPG";
  if (u.endsWith(".png")) return "PNG";
  return "PDF";
}

function storeDocToDokRecord(d: StoreDoc, ctx: EnrichmentCtx): DokRecord {
  const jenisMap: Partial<Record<StoreDoc["jenis"], JenisDok>> = {
    Pengadaan: "Pengadaan", Perbaikan: "Maintenance",
    Mutasi: "Mutasi",  Opname: "Opname",
    Aset: "Referensi", Lainnya: "Referensi",
  };

  // Enrich from asset
  let unit = "-";
  let kategoriAset: KategoriAset = "-";
  let assetName = "";
  if (d.asset_id) {
    const a = ctx.assets.find((x) => x.id === d.asset_id || x.Id === d.asset_id);
    if (a) {
      unit = a.Nama_unit || a.nama_unit || a.Nama_ruangan || unit;
      assetName = a.Nama_Barang || a.nama_barang || "";
      const tipe = (a.TipeAset || a.id?.split("-")[0] || "").toUpperCase();
      if (tipe === "PM" || tipe === "ATB" || tipe === "ATL" || tipe === "AL") {
        kategoriAset = tipe as KategoriAset;
      }
    }
  }

  // Enrich from transaction
  let txnLabel = "";
  if (d.transaction_id) {
    const t = d.transaction_id;
    const mt = ctx.maintenanceTickets.find((x) => x.id === t);
    const mu = !mt ? ctx.mutationRequests.find((x) => x.id === t) : undefined;
    const pg = !mt && !mu ? ctx.procurementRequests.find((x) => x.id === t) : undefined;
    const so = !mt && !mu && !pg ? ctx.stockOpnameRecords.find((x) => x.id === t) : undefined;
    if (mt) {
      txnLabel = `Tiket Perbaikan ${mt.jenis} (${mt.kategori_kerusakan})`;
      if (!d.asset_id) {
        const a = ctx.assets.find((x) => x.id === mt.asset_id || x.Id === mt.asset_id);
        if (a) unit = a.Nama_unit || unit;
      }
    } else if (mu) {
      txnLabel = `Mutasi ${mu.dari_ruangan} → ${mu.ke_ruangan}`;
    } else if (pg) {
      txnLabel = `Pengadaan ${pg.nama_barang}`;
    } else if (so) {
      txnLabel = `Opname ${so.kode_tag}`;
    }
  }

  const tgl = d.tanggal || new Date().toISOString().slice(0, 10);
  const namaDok = d.nama || (assetName ? `${d.jenis} - ${assetName}` : d.id);
  const deskripsi = [d.nama, assetName && `Aset: ${assetName}`, txnLabel].filter(Boolean).join(" — ") || d.nama;

  return {
    id: d.id,
    namaDok,
    nomorRef: d.transaction_id || d.id,
    jenis: jenisMap[d.jenis] ?? "Referensi",
    kategoriAset,
    asetTerkait: d.asset_id || null,
    transaksiTerkait: d.transaction_id || null,
    unit,
    tglUpload: tgl,
    uploadedBy: d.diunggah_oleh,
    format: inferFormatFromUrl(d.url),
    ukuran: "-",
    deskripsi,
    statusKelengkapan: "Lengkap",
    tags: [d.jenis],
    riwayatUpload: [{ tgl, oleh: d.diunggah_oleh, versi: "v1.0" }],
    terverifikasi: false,
  };
}


// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  } catch { return s; }
}

function fmtColor(f: DokFormat): string {
  if (f === "PDF")  return "#EF4444";
  if (f === "XLSX") return "#22C55E";
  if (f === "DOCX") return "#3B82F6";
  return "#F59E0B";
}

function FmtIcon({ format, size = 18 }: { format: DokFormat; size?: number }) {
  if (format === "XLSX") return <FileSpreadsheet size={size} />;
  if (format === "DOCX") return <FileText size={size} />;
  return <File size={size} />;
}

const JENIS_CFG: Record<JenisDok, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  Pengadaan:  { color: "#F59E0B", bg: "#FEF3C7", icon: ShoppingCart,    label: "Pengadaan"  },
  BAP:        { color: "#8B5CF6", bg: "#EDE9FE", icon: FileText,         label: "BAP"        },
  Maintenance:{ color: "#EF4444", bg: "#FEE2E2", icon: Wrench,           label: "Maintenance"},
  Mutasi:     { color: "#3B82F6", bg: "#DBEAFE", icon: ArrowLeftRight,   label: "Mutasi"     },
  Opname:     { color: "#06B6D4", bg: "#CFFAFE", icon: ClipboardList,    label: "Opname"     },
  Regulasi:   { color: "#6366F1", bg: "#E0E7FF", icon: Scale,            label: "Regulasi"   },
  Referensi:  { color: "#10B981", bg: "#D1FAE5", icon: BookOpen,         label: "Referensi"  },
};

function JenisBadge({ jenis }: { jenis: JenisDok }) {
  const cfg = JENIS_CFG[jenis];
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}>
      <Icon size={9} />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: StatusKelengkapan }) {
  const cfg = {
    Lengkap:       "bg-green-100 text-green-700",
    "Belum Lengkap": "bg-amber-100 text-amber-700",
    Arsip:         "bg-gray-100 text-gray-500",
  }[status];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg}`}>{status}</span>;
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────
function DetailDrawer({ doc, onClose, onVerify }: { doc: DokRecord; onClose: () => void; onVerify: (id: string) => void }) {
  const jCfg = JENIS_CFG[doc.jenis];
  const JIcon = jCfg.icon;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full z-50 w-full sm:w-[480px] max-w-full bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <JenisBadge jenis={doc.jenis} />
              <StatusBadge status={doc.statusKelengkapan} />
            </div>
            <p className="text-sm font-bold text-gray-900 leading-snug">{doc.namaDok}</p>
            <p className="text-[11px] text-gray-400 font-mono mt-0.5">{doc.nomorRef}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Preview */}
          <div className="flex items-center justify-center h-24 bg-gray-50 rounded-xl border border-gray-100 relative overflow-hidden">
            <div className="flex flex-col items-center gap-2" style={{ color: fmtColor(doc.format) }}>
              <FmtIcon format={doc.format} size={36} />
              <span className="text-xs text-gray-400">{doc.format} · {doc.ukuran}</span>
            </div>
            {doc.terverifikasi && (
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                <Shield size={9} /> Terverifikasi
              </div>
            )}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
            {[
              { label: "ID Dokumen",   value: doc.id },
              { label: "Format",       value: <span className="text-xs font-bold" style={{ color: fmtColor(doc.format) }}>{doc.format}</span> },
              { label: "Ukuran File",  value: doc.ukuran },
              { label: "Unit",         value: doc.unit },
              { label: "Tgl Upload",   value: fmtDate(doc.tglUpload) },
              { label: "Upload Oleh",  value: doc.uploadedBy },
            ].map((row) => (
              <div key={row.label}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{row.label}</p>
                {typeof row.value === "string"
                  ? <p className="text-xs font-medium text-gray-800">{row.value}</p>
                  : row.value}
              </div>
            ))}
          </div>

          {/* Deskripsi */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Deskripsi</p>
            <p className="text-xs text-gray-600 leading-relaxed">{doc.deskripsi}</p>
          </div>

          {/* Referensi Transaksi + Aset */}
          {(doc.asetTerkait || doc.transaksiTerkait) && (
            <div className="border border-blue-100 bg-blue-50/40 rounded-xl p-4 space-y-2">
              <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">Referensi Transaksi & Aset</p>
              {doc.asetTerkait && (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-500 w-28 shrink-0">Kode Aset Terkait</span>
                  <span className="text-xs font-bold font-mono bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{doc.asetTerkait}</span>
                </div>
              )}
              {doc.transaksiTerkait && (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-500 w-28 shrink-0">No. Transaksi</span>
                  <span className="text-xs font-bold font-mono bg-purple-100 text-purple-700 px-2 py-0.5 rounded">{doc.transaksiTerkait}</span>
                </div>
              )}
            </div>
          )}

          {/* Riwayat Upload */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Riwayat Upload</p>
            <div className="relative border-l-2 border-gray-100 ml-2 space-y-3">
              {doc.riwayatUpload.map((r, i) => (
                <div key={i} className="relative pl-5">
                  <div className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-white border-2 border-gray-300" />
                  <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] font-semibold text-gray-700">{r.versi}</span>
                      <span className="text-[10px] text-gray-400">{fmtDate(r.tgl)}</span>
                    </div>
                    <span className="text-[10px] text-gray-500">{r.oleh}</span>
                    {r.catatan && <p className="text-[10px] text-gray-400 mt-0.5 italic">{r.catatan}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Verifikasi Dokumen */}
          <div className={`rounded-xl p-4 border ${doc.terverifikasi ? "bg-green-50 border-green-100" : "bg-amber-50 border-amber-100"}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${doc.terverifikasi ? "text-green-600" : "text-amber-600"}`}>
              Verifikasi Dokumen
            </p>
            {doc.terverifikasi ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-green-700">
                  <CheckCircle size={13} /> Dokumen telah diverifikasi
                </div>
                <p className="text-[10px] text-green-600">Oleh {doc.verifikasiOleh} pada {doc.tglVerifikasi && fmtDate(doc.tglVerifikasi)}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-amber-700">
                  <AlertTriangle size={13} /> Belum diverifikasi
                </div>
                <button
                  onClick={() => onVerify(doc.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors">
                  <Shield size={12} /> Verifikasi Sekarang
                </button>
              </div>
            )}
          </div>

          {/* Tags */}
          {doc.tags.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Tag</p>
              <div className="flex flex-wrap gap-1.5">
                {doc.tags.map((t) => (
                  <span key={t} className="text-[10px] bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={() => {
              const content = [
                `Nama Dokumen: ${doc.namaDok}`,
                `Nomor Referensi: ${doc.nomorRef}`,
                `Jenis: ${doc.jenis}`,
                `Unit: ${doc.unit}`,
                `Format: ${doc.format}`,
                `Status: ${doc.statusKelengkapan}`,
                `Diupload oleh: ${doc.uploadedBy}`,
                `Tanggal: ${doc.tglUpload}`,
                `Deskripsi: ${doc.deskripsi}`,
                `Aset Terkait: ${doc.asetTerkait || "-"}`,
                `Transaksi Terkait: ${doc.transaksiTerkait || "-"}`,
              ].join("\n");
              const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = `${doc.nomorRef}.txt`; a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-black transition-colors">
            <Download size={14} /> Unduh Dokumen
          </button>
          <button className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
            <Edit2 size={14} />
          </button>
          <button className="px-4 py-2.5 border border-red-100 text-red-400 rounded-xl hover:bg-red-50 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────
function UploadModal({ onClose, onSubmit, assetOptions, transactionOptions, unitOptions }: {
  onClose: () => void;
  onSubmit: (doc: DokRecord) => void;
  assetOptions: { id: string; nama: string }[];
  transactionOptions: { id: string; label: string }[];
  unitOptions: string[];
}) {
  const [step, setStep]       = useState(1);
  const [jenis, setJenis]     = useState("");
  const [judul, setJudul]     = useState("");
  const [nomor, setNomor]     = useState("");
  const [format, setFormat]   = useState("");
  const [fileName, setFileName] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [asetTerkait, setAsetTerkait] = useState("");
  const [transaksi, setTransaksi] = useState("");
  const [unit, setUnit]       = useState("");
  const [status, setStatus]   = useState("Lengkap");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const STEPS = ["Pilih File & Jenis", "Info Tambahan", "Konfirmasi"];
  const ok1 = jenis && judul && nomor && format;
  const ok2 = deskripsi.length >= 10 && unit;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFileName(file.name);
  };

  const handleSubmit = () => {
    const today = new Date().toISOString().slice(0, 10);
    const newDoc: DokRecord = {
      id: `DOK-${Date.now()}`,
      namaDok: judul,
      nomorRef: nomor,
      jenis: jenis as JenisDok,
      kategoriAset: "-",
      asetTerkait: asetTerkait || null,
      transaksiTerkait: transaksi || null,
      unit,
      tglUpload: today,
      uploadedBy: "Othniel Patrick Limbong",
      format: format as DokFormat,
      ukuran: fileName ? "< 25 MB" : "-",
      deskripsi,
      statusKelengkapan: status as StatusKelengkapan,
      tags: [jenis],
      riwayatUpload: [{ tgl: today, oleh: "Othniel Patrick Limbong", versi: "v1.0", catatan: "Upload pertama" }],
      terverifikasi: false,
    };
    onSubmit(newDoc);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Upload Dokumen Baru</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16} /></button>
        </div>

        {/* Steps */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2">
          {STEPS.map((s, i) => {
            const n = i + 1;
            const done = step > n;
            const active = step === n;
            return (
              <React.Fragment key={s}>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${done || active ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400"}`}>
                    {done ? <Check size={12} /> : n}
                  </div>
                  <span className={`text-xs ${active ? "font-semibold text-gray-800" : "text-gray-400"}`}>{s}</span>
                </div>
                {i < STEPS.length - 1 && <div className="flex-1 h-px bg-gray-200" />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="p-6 space-y-4 overflow-y-auto" style={{ maxHeight: "55vh" }}>
          {step === 1 && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Jenis Dokumen *</label>
                <select value={jenis} onChange={(e) => setJenis(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white outline-none">
                  <option value="">-- Pilih Jenis --</option>
                  <option>Pengadaan</option><option>BAP</option><option>Maintenance</option>
                  <option>Mutasi</option><option>Opname</option><option>Regulasi</option><option>Referensi</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nama Dokumen *</label>
                <input value={judul} onChange={(e) => setJudul(e.target.value)}
                  placeholder="Masukkan nama dokumen..."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nomor Referensi *</label>
                <input value={nomor} onChange={(e) => setNomor(e.target.value)}
                  placeholder="Contoh: BAST-2026-001"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 outline-none font-mono" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Format File *</label>
                <select value={format} onChange={(e) => setFormat(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white outline-none">
                  <option value="">-- Pilih Format --</option>
                  <option>PDF</option><option>DOCX</option><option>XLSX</option><option>JPG</option><option>PNG</option>
                </select>
              </div>
              <input ref={fileInputRef} type="file" accept=".pdf,.docx,.xlsx,.jpg,.png" className="hidden" onChange={handleFileChange} />
              <div onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-all">
                {fileName
                  ? <div className="flex items-center justify-center gap-2 text-sm font-medium text-gray-700"><File size={16} /> {fileName}</div>
                  : <>
                      <Upload size={22} className="text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">Klik untuk memilih file</p>
                      <p className="text-[11px] text-gray-300 mt-1">PDF, DOCX, XLSX, JPG, PNG maks. 25 MB</p>
                    </>
                }
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Unit *</label>
                <select value={unit} onChange={(e) => setUnit(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white outline-none">
                  <option value="">-- Pilih Unit --</option>
                  {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Deskripsi *</label>
                <textarea value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} rows={3}
                  placeholder="Jelaskan isi dan tujuan dokumen..."
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 outline-none resize-none" />
                <p className="text-[11px] text-gray-400 mt-1">{deskripsi.length} karakter (min. 10)</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Kode Aset Terkait</label>
                <input value={asetTerkait} onChange={(e) => setAsetTerkait(e.target.value)}
                  placeholder="Contoh: PM-001"
                  list="dok-aset-options"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 outline-none font-mono" />
                <datalist id="dok-aset-options">
                  {assetOptions.map((a) => <option key={a.id} value={a.id}>{a.nama}</option>)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">No. Transaksi Terkait</label>
                <input value={transaksi} onChange={(e) => setTransaksi(e.target.value)}
                  placeholder="Contoh: PGD-2026-001"
                  list="dok-trx-options"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 outline-none font-mono" />
                <datalist id="dok-trx-options">
                  {transactionOptions.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Status Kelengkapan</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 bg-white outline-none">
                  <option>Lengkap</option><option>Belum Lengkap</option><option>Arsip</option>
                </select>
              </div>
            </>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4">
                <div style={{ color: fmtColor(format as DokFormat || "PDF") }}>
                  <FmtIcon format={format as DokFormat || "PDF"} size={28} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{judul || "—"}</p>
                  <p className="text-xs text-gray-400 font-mono">{nomor || "—"}</p>
                </div>
              </div>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                {[
                  { label: "Jenis",   val: jenis || "—" },
                  { label: "Format",  val: format || "—" },
                  { label: "Unit",    val: unit || "—" },
                  { label: "Status",  val: status },
                  { label: "Aset",    val: asetTerkait || "—" },
                ].map((row, i) => (
                  <div key={row.label} className={`flex items-center py-2.5 px-4 ${i > 0 ? "border-t border-gray-50" : ""}`}>
                    <span className="text-xs text-gray-500 w-28 shrink-0">{row.label}</span>
                    <span className="text-xs font-medium text-gray-800">{row.val}</span>
                  </div>
                ))}
              </div>
              {deskripsi && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Deskripsi</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{deskripsi}</p>
                </div>
              )}
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center gap-3">
                <AlertCircle size={16} className="text-blue-500 shrink-0" />
                <p className="text-xs text-blue-700">Dokumen akan tersimpan dan dapat diakses oleh seluruh pengguna yang berwenang.</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <button onClick={step === 1 ? onClose : () => setStep((s) => s - 1)}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            {step === 1 ? "Batal" : "Kembali"}
          </button>
          {step < 3 ? (
            <button onClick={() => setStep((s) => s + 1)}
              disabled={step === 1 ? !ok1 : !ok2}
              className="px-5 py-2 text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed">
              Lanjut
            </button>
          ) : (
            <button onClick={handleSubmit}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-black">
              <Check size={14} /> Upload Dokumen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const ALL_JENIS: (JenisDok | "Semua")[] = ["Semua", "Pengadaan", "BAP", "Maintenance", "Mutasi", "Opname", "Regulasi", "Referensi"];

export function DokumenPage({ topBar }: { topBar: React.ReactNode }) {
  const store = useDataStore();
  const [activeTab, setActiveTab]         = useState<JenisDok | "Semua">("Semua");
  const [view, setView]                   = useState<"list" | "card">("list");
  const [search, setSearch]               = useState("");
  const [filterKategori, setFilterKategori] = useState("Semua");
  const [filterUnit, setFilterUnit]       = useState("Semua Unit");
  const [filterTahun, setFilterTahun]     = useState("Semua Tahun");
  const [filterStatus, setFilterStatus]   = useState("Semua");
  const [openDocId, setOpenDocId]         = useState<string | null>(null);
  const [showUpload, setShowUpload]       = useState(false);
  // Optimistic in-session additions (safety net before store sync renders)
  const [localNewDocs, setLocalNewDocs]   = useState<DokRecord[]>([]);
  // Verification overlay keyed by doc id (verification is page-local since
  // store.DocumentRecord has no verified fields)
  const [verifications, setVerifications] = useState<Record<string, { verifikasiOleh: string; tglVerifikasi: string }>>({});

  const ctx: EnrichmentCtx = useMemo(() => ({
    assets: store.assets,
    maintenanceTickets: store.maintenanceTickets,
    mutationRequests: store.mutationRequests,
    procurementRequests: store.procurementRequests,
    stockOpnameRecords: store.stockOpnameRecords,
  }), [store.assets, store.maintenanceTickets, store.mutationRequests, store.procurementRequests, store.stockOpnameRecords]);

  const records: DokRecord[] = useMemo(() => {
    const fromStore = store.documents.map((d) => storeDocToDokRecord(d, ctx));
    const storeIds = new Set(fromStore.map((d) => d.id));
    const merged = [...fromStore, ...localNewDocs.filter((d) => !storeIds.has(d.id))];
    return merged.map((d) => {
      const v = verifications[d.id];
      return v ? { ...d, terverifikasi: true, verifikasiOleh: v.verifikasiOleh, tglVerifikasi: v.tglVerifikasi } : d;
    });
  }, [store.documents, localNewDocs, verifications, ctx]);

  const kpiData = useMemo(() => ({
    total:      records.length,
    pengadaan:  records.filter((d) => d.jenis === "Pengadaan").length,
    bap:        records.filter((d) => d.jenis === "BAP").length,
    maintenance:records.filter((d) => d.jenis === "Maintenance").length,
    belumLengkap: records.filter((d) => d.statusKelengkapan === "Belum Lengkap").length,
  }), [records]);

  // Dynamic option lists derived from store
  const unitOptions = useMemo(() => {
    const set = new Set<string>();
    store.assets.forEach((a) => { const u = a.Nama_unit || a.nama_unit; if (u) set.add(u); });
    records.forEach((r) => { if (r.unit && r.unit !== "-") set.add(r.unit); });
    return ["Semua Unit", ...Array.from(set).sort()];
  }, [store.assets, records]);

  const tahunOptions = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => { const y = r.tglUpload.slice(0, 4); if (y) set.add(y); });
    return ["Semua Tahun", ...Array.from(set).sort((a, b) => b.localeCompare(a))];
  }, [records]);

  const assetOptions = useMemo(
    () => store.assets.map((a) => ({ id: (a.id || a.Id) as string, nama: a.Nama_Barang || a.nama_barang || "" })).filter((x) => x.id),
    [store.assets],
  );
  const transactionOptions = useMemo(() => [
    ...store.procurementRequests.map((t) => ({ id: t.id, label: `${t.id} — ${t.nama_barang}` })),
    ...store.maintenanceTickets.map((t) => ({ id: t.id, label: `${t.id} — Perbaikan ${t.kategori_kerusakan}` })),
    ...store.mutationRequests.map((t) => ({ id: t.id, label: `${t.id} — Mutasi ${t.dari_ruangan} → ${t.ke_ruangan}` })),
    ...store.stockOpnameRecords.map((t) => ({ id: t.id, label: `${t.id} — Opname ${t.kode_tag}` })),
  ], [store.procurementRequests, store.maintenanceTickets, store.mutationRequests, store.stockOpnameRecords]);

  const filtered = useMemo(() => {
    let list = records.slice();
    if (activeTab !== "Semua") list = list.filter((d) => d.jenis === activeTab);
    if (filterKategori !== "Semua") list = list.filter((d) => d.kategoriAset === filterKategori);
    if (filterUnit !== "Semua Unit") list = list.filter((d) => d.unit === filterUnit);
    if (filterTahun !== "Semua Tahun") list = list.filter((d) => d.tglUpload.startsWith(filterTahun));
    if (filterStatus !== "Semua") list = list.filter((d) => d.statusKelengkapan === filterStatus);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((d) =>
        d.namaDok.toLowerCase().includes(q) ||
        d.nomorRef.toLowerCase().includes(q) ||
        (d.asetTerkait || "").toLowerCase().includes(q) ||
        d.unit.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => b.tglUpload.localeCompare(a.tglUpload));
  }, [records, activeTab, filterKategori, filterUnit, filterTahun, filterStatus, search]);

  const selectedDoc = openDocId ? records.find((d) => d.id === openDocId) : undefined;

  const handleVerify = (id: string) => {
    const doc = records.find(d => d.id === id);
    if (doc) {
      store.appendActivity({
        pengguna: store.currentUser?.nama || "Othniel Patrick Limbong",
        role: store.currentUser?.role || "Admin Sistem",
        menu: "Dokumen",
        aksi: `Dokumen ${doc.namaDok} diverifikasi`,
        target_type: "Document",
        target_id: id,
        status: "Berhasil",
        jenis: "dokumen",
      });
    }
    setVerifications((prev) => ({
      ...prev,
      [id]: { verifikasiOleh: store.currentUser?.nama || "Othniel Patrick Limbong", tglVerifikasi: "2026-06-01" },
    }));
  };

  const kpiCards = [
    { label: "Total Dokumen",      value: kpiData.total,       sub: `${records.filter(d => d.terverifikasi).length} terverifikasi`, color: "#111827", Icon: Layers       },
    { label: "Dokumen Pengadaan",  value: kpiData.pengadaan,   sub: "BAST, BKK, SPK, PPJ",    color: "#F59E0B", Icon: ShoppingCart  },
    { label: "Dokumen BAP",        value: kpiData.bap,         sub: "Berita acara pemeriksaan",color: "#8B5CF6", Icon: FileText      },
    { label: "Dokumen Maintenance",value: kpiData.maintenance, sub: "BKK, invoice, lap. teknis",color: "#EF4444", Icon: Wrench       },
    { label: "Belum Lengkap",      value: kpiData.belumLengkap,sub: "Perlu dilengkapi segera",  color: "#F59E0B", Icon: AlertTriangle },
  ];

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 min-w-0">
      {topBar}
      <div className="px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5 min-w-0">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Dokumen</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Kelola seluruh dokumen aset: pengadaan, BAP, maintenance, mutasi, opname, regulasi, dan referensi.
            </p>
          </div>
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-black transition-colors shadow-sm self-start sm:self-auto cursor-pointer">
            <Plus size={15} /> Upload Dokumen
          </button>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          {kpiCards.map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 min-w-0 transition-all hover:shadow-md flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-xs font-medium text-gray-500 break-words flex-1 leading-snug">{s.label}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: s.color + "15", color: s.color }}>
                  <s.Icon size={16} />
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold text-gray-900 truncate" title={s.value}>{s.value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 truncate">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200 overflow-x-auto">
          {ALL_JENIS.map((tab) => {
            const count = tab === "Semua" ? records.length : records.filter((d) => d.jenis === tab).length;
            const jCfg = tab !== "Semua" ? JENIS_CFG[tab] : null;
            const JIcon = jCfg ? jCfg.icon : Layers;
            return (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-1 justify-center whitespace-nowrap ${
                  activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}>
                <JIcon size={12} />
                <span>{tab}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === tab ? "bg-gray-100 text-gray-700" : "bg-gray-200/50 text-gray-400"
                }`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, nomor referensi, kode aset..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400" />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            )}
          </div>
          <select value={filterKategori} onChange={(e) => setFilterKategori(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 outline-none">
            <option value="Semua">Semua Kategori</option>
            <option value="PM">Peralatan & Mesin (PM)</option>
            <option value="ATB">Aset Tak Berwujud (ATB)</option>
            <option value="ATL">Aset Tetap Lainnya (ATL)</option>
            <option value="AL">Alat Angkutan (AL)</option>
            <option value="-">Tidak Spesifik</option>
          </select>
          <select value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 outline-none">
            {unitOptions.map((u) => <option key={u}>{u}</option>)}
          </select>
          <select value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 outline-none">
            {tahunOptions.map((t) => <option key={t}>{t}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 outline-none">
            <option value="Semua">Semua Status</option>
            <option value="Lengkap">Lengkap</option>
            <option value="Belum Lengkap">Belum Lengkap</option>
            <option value="Arsip">Arsip</option>
          </select>
          <button
            onClick={() => exportToExcel(filtered.map(d => ({
              "ID": d.id, "Nama Dokumen": d.namaDok, "Nomor Ref": d.nomorRef,
              "Jenis": d.jenis, "Kategori Aset": d.kategoriAset, "Unit": d.unit,
              "Format": d.format, "Ukuran": d.ukuran, "Status": d.statusKelengkapan,
              "Tgl Upload": d.tglUpload, "Upload Oleh": d.uploadedBy,
              "Aset Terkait": d.asetTerkait ?? "", "Transaksi Terkait": d.transaksiTerkait ?? "",
              "Terverifikasi": d.terverifikasi ? "Ya" : "Tidak",
            })), `dokumen-${new Date().toISOString().slice(0,10)}`, "Dokumen")}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Download size={14} /> Export
          </button>
          <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5">
            <button onClick={() => setView("list")}
              className={`p-1.5 rounded transition-colors ${view === "list" ? "bg-gray-100 text-gray-800" : "text-gray-400 hover:text-gray-600"}`}>
              <LayoutList size={15} />
            </button>
            <button onClick={() => setView("card")}
              className={`p-1.5 rounded transition-colors ${view === "card" ? "bg-gray-100 text-gray-800" : "text-gray-400 hover:text-gray-600"}`}>
              <LayoutGrid size={15} />
            </button>
          </div>
        </div>

        <p className="text-xs text-gray-400 -mt-2">
          Menampilkan <span className="font-semibold text-gray-600">{filtered.length}</span> dokumen
        </p>

        {/* Table view */}
        {view === "list" && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">ID Dokumen</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Nama Dokumen</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Jenis</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Aset Terkait</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Unit</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Tgl Upload</th>
                  <th className="text-left py-3 px-4 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                  <th className="py-3 px-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => (
                  <tr key={doc.id} onClick={() => setOpenDocId(doc.id)}
                    className={`border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${doc.statusKelengkapan === "Belum Lengkap" ? "bg-amber-50/30" : ""}`}>
                    <td className="py-3 px-4">
                      <span className="text-[11px] font-mono font-medium text-gray-500">{doc.id}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: fmtColor(doc.format) + "18", color: fmtColor(doc.format) }}>
                          <FmtIcon format={doc.format} size={15} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate" style={{ maxWidth: 200 }}>{doc.namaDok}</p>
                          <p className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">{doc.nomorRef}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4"><JenisBadge jenis={doc.jenis} /></td>
                    <td className="py-3 px-4">
                      {doc.asetTerkait
                        ? <span className="text-[10px] font-bold font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{doc.asetTerkait}</span>
                        : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-600 whitespace-nowrap">{doc.unit}</td>
                    <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">{fmtDate(doc.tglUpload)}</td>
                    <td className="py-3 px-4"><StatusBadge status={doc.statusKelengkapan} /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => setOpenDocId(doc.id)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                          <Eye size={13} />
                        </button>
                        <button className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
                          <Download size={13} />
                        </button>
                        <button className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-16 text-center">
                <File size={32} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-400">Tidak ada dokumen ditemukan.</p>
                <p className="text-xs text-gray-300 mt-1">Coba ubah filter atau kata kunci pencarian.</p>
              </div>
            )}
          </div>
        )}

        {/* Card view */}
        {view === "card" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {filtered.map((doc) => (
              <div key={doc.id} onClick={() => setOpenDocId(doc.id)}
                className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all flex flex-col ${doc.statusKelengkapan === "Belum Lengkap" ? "border-amber-200" : ""}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: fmtColor(doc.format) + "18", color: fmtColor(doc.format) }}>
                    <FmtIcon format={doc.format} size={20} />
                  </div>
                  <StatusBadge status={doc.statusKelengkapan} />
                </div>
                <p className="text-xs font-mono text-gray-400 mb-1">{doc.id}</p>
                <p className="text-sm font-semibold text-gray-800 leading-snug mb-2 flex-1 line-clamp-2">{doc.namaDok}</p>
                <div className="flex items-center gap-1.5 mb-2">
                  <JenisBadge jenis={doc.jenis} />
                  {doc.asetTerkait && (
                    <span className="text-[10px] font-bold font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{doc.asetTerkait}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-400 border-t border-gray-50 pt-2 mt-1">
                  <Clock size={10} className="shrink-0" />
                  <span className="truncate">{fmtDate(doc.tglUpload)}</span>
                  <span className="ml-auto shrink-0 truncate">{doc.unit}</span>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-4 py-16 text-center">
                <File size={32} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-400">Tidak ada dokumen ditemukan.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedDoc && <DetailDrawer doc={selectedDoc} onClose={() => setOpenDocId(null)} onVerify={handleVerify} />}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSubmit={(doc) => {
            const jenisStore: StoreDoc["jenis"] =
              doc.jenis === "Maintenance" ? "Perbaikan" :
              doc.jenis === "Pengadaan"   ? "Pengadaan"  :
              doc.jenis === "Mutasi"      ? "Mutasi"     :
              doc.jenis === "Opname"      ? "Opname"     :
              doc.jenis === "Referensi"   ? "Aset"       : "Lainnya";
            store.uploadDocument({
              id: doc.id,
              nama: doc.namaDok,
              jenis: jenisStore,
              asset_id: doc.asetTerkait || undefined,
              transaction_id: doc.transaksiTerkait || undefined,
              url: "#",
              diunggah_oleh: doc.uploadedBy,
              tanggal: doc.tglUpload,
            });
            // Optimistic fallback — derivation from store.documents will normally pick this up
            setLocalNewDocs((prev) => [doc, ...prev]);
          }}
          assetOptions={assetOptions}
          transactionOptions={transactionOptions}
          unitOptions={unitOptions.filter((u) => u !== "Semua Unit")}
        />
      )}
    </main>
  );
}
