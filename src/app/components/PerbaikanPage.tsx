import React, { useState, useMemo } from "react";
import { useDataStore, type MaintenanceTicket, type Asset } from "./DataStore";
import { exportToExcel } from "./excelUtils";
import {
  Wrench, Search, Download, Plus, X, ChevronDown, Clock,
  CheckCircle2, XCircle, Eye, Calendar, MapPin, User, Building,
  AlertTriangle, Check, FileText, Cpu, Car, Layers,
  ClipboardList, PlayCircle, StopCircle, RefreshCw, Upload,
  CalendarCheck, Timer, ArrowRight,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type PerbaikanKategori   = "PM" | "ATL" | "AL";
type PerbaikanStatus     = "Menunggu" | "Dalam Proses" | "Selesai" | "Dibatalkan";
type PerbaikanPrioritas  = "Rendah" | "Sedang" | "Tinggi" | "Kritis";
type TingkatKerusakan    = "Ringan" | "Sedang" | "Berat" | "Kritis";

interface DokumenItem    { nama: string; ukuran: string; }
interface TimelineItem   { tanggal: string; status: string; oleh: string; catatan?: string; }

interface AsetPerbaikan {
  kode: string; nama: string; tipe: string;
  kategori: PerbaikanKategori;
  gedung: string; ruangan: string; pic: string;
}

interface PerbaikanRecord {
  id: string;
  aset: { kode: string; nama: string; tipe: string; kategori: PerbaikanKategori };
  keluhan: string;
  kategoriKerusakan: string;
  tingkatKerusakan: TingkatKerusakan;
  prioritas: PerbaikanPrioritas;
  status: PerbaikanStatus;
  teknisi: string;
  gedung: string; ruangan: string; pic: string;
  tglAjuan: string;
  tglMulai: string | null;
  tglSelesai: string | null;
  biayaEstimasi: number | null;
  biayaRealisasi: number | null;
  downtime: number | null;
  catatan: string;
  pengaju: string;
  dokumen: DokumenItem[];
  jadwalBerikutnya: string | null;
  tglMaintenanceTerakhir: string | null;
  jenisMaintenanceTerakhir: string | null;
  totalFrekuensiMaintenance: number;
  totalBiayaMaintenance: number;
  rataRataWaktuPerbaikan: number | null;
  timeline: TimelineItem[];
}

// ── Conversion: store ticket → local rich record ──────────────────────────────
function ticketToRecord(t: MaintenanceTicket, asset?: Asset): PerbaikanRecord {
  const kat = (["PM", "ATL", "AL"] as string[]).includes(asset?.TipeAset ?? "")
    ? (asset!.TipeAset as PerbaikanKategori)
    : "PM";
  const isSel = t.status === "Selesai";
  const isProses = t.status === "Dalam Proses";
  const pStatus: PerbaikanStatus = isSel ? "Selesai" : isProses ? "Dalam Proses" : "Menunggu";
  const prio: PerbaikanPrioritas = t.tingkat_kerusakan === "Kritis" ? "Kritis"
    : t.tingkat_kerusakan === "Berat" ? "Tinggi"
    : t.tingkat_kerusakan === "Sedang" ? "Sedang"
    : "Rendah";
  return {
    id: t.id,
    aset: { kode: asset?.id || t.asset_id, nama: asset?.Nama_Barang || t.asset_id, tipe: asset?.TipeAset || "-", kategori: kat },
    keluhan: t.catatan || `Perbaikan ${t.jenis} – ${t.kategori_kerusakan}`,
    kategoriKerusakan: t.kategori_kerusakan,
    tingkatKerusakan: t.tingkat_kerusakan,
    prioritas: prio,
    status: pStatus,
    teknisi: "Budi Hartono",
    gedung: asset?.nama_gedung || "-",
    ruangan: asset?.Nama_ruangan || asset?.nama_ruangan_standar || "-",
    pic: asset?.nama_pic || "-",
    tglAjuan: t.tanggal,
    tglMulai: isProses || isSel ? t.tanggal : null,
    tglSelesai: isSel ? t.tanggal : null,
    biayaEstimasi: t.biaya,
    biayaRealisasi: isSel ? t.biaya : null,
    downtime: t.downtime_jam * 60,
    catatan: t.catatan || "",
    pengaju: "Othniel Patrick Limbong",
    dokumen: [],
    jadwalBerikutnya: t.jadwal_berikutnya || null,
    tglMaintenanceTerakhir: null,
    jenisMaintenanceTerakhir: t.jenis,
    totalFrekuensiMaintenance: 1,
    totalBiayaMaintenance: t.biaya,
    rataRataWaktuPerbaikan: isSel ? t.downtime_jam : null,
    timeline: [
      { tanggal: t.tanggal, status: "Diajukan", oleh: "Othniel Patrick Limbong", catatan: t.catatan },
      ...(isProses || isSel ? [{ tanggal: t.tanggal, status: "Mulai Proses", oleh: "Budi Hartono" }] : []),
      ...(isSel ? [{ tanggal: t.tanggal, status: "Selesai", oleh: "Budi Hartono", catatan: t.catatan }] : []),
    ],
  };
}

function assetToAsetPerbaikan(a: Asset): AsetPerbaikan {
  const kat = (["PM", "ATL", "AL"] as string[]).includes(a.TipeAset ?? "")
    ? (a.TipeAset as PerbaikanKategori)
    : "PM";
  return {
    kode: a.id,
    nama: a.Nama_Barang || a.id,
    tipe: a.TipeAset || "-",
    kategori: kat,
    gedung: a.nama_gedung || "-",
    ruangan: a.Nama_ruangan || a.nama_ruangan_standar || "-",
    pic: a.nama_pic || "-",
  };
}

// ── Master data (static lists kept for form dropdowns) ─────────────────────────
const TEKNISI_LIST = [
  { nama: "Budi Hartono",     spesialis: "Teknisi IT / Elektronik" },
  { nama: "Ahmad Fauzi",      spesialis: "Teknisi Mekanik" },
  { nama: "Dedi Kurniawan",   spesialis: "Teknisi Listrik & HVAC" },
  { nama: "Reni Susanti",     spesialis: "Teknisi Umum" },
  { nama: "PT. Servis Prima", spesialis: "Vendor Eksternal" },
  { nama: "CV. Mitra Teknik", spesialis: "Vendor Kendaraan" },
];

const KATEGORI_KERUSAKAN_LIST = [
  "Hardware / Komponen",
  "Software / Sistem",
  "Mekanikal",
  "Elektrikal / Kelistrikan",
  "Struktural / Fisik",
  "HVAC / Pendingin",
  "Kendaraan",
  "Lainnya",
];


// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(v: number) {
  return new Intl.NumberFormat("id-ID").format(v);
}

function fmtJuta(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2).replace(".", ",")} jt`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)} rb`;
  return fmt(v);
}

function StatusBadge({ status }: { status: PerbaikanStatus }) {
  const cfg = {
    Menunggu:     { bg: "bg-yellow-50",  text: "text-yellow-700", border: "border-yellow-200", icon: <Clock size={11} /> },
    "Dalam Proses": { bg: "bg-blue-50",  text: "text-blue-700",   border: "border-blue-200",   icon: <RefreshCw size={11} /> },
    Selesai:      { bg: "bg-green-50",   text: "text-green-700",  border: "border-green-200",  icon: <CheckCircle2 size={11} /> },
    Dibatalkan:   { bg: "bg-red-50",     text: "text-red-700",    border: "border-red-200",    icon: <XCircle size={11} /> },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.icon} {status}
    </span>
  );
}

function PrioritasBadge({ prioritas }: { prioritas: PerbaikanPrioritas }) {
  const cfg = {
    Rendah: { bg: "bg-gray-100",  text: "text-gray-600" },
    Sedang: { bg: "bg-blue-50",   text: "text-blue-700" },
    Tinggi: { bg: "bg-orange-50", text: "text-orange-700" },
    Kritis: { bg: "bg-red-50",    text: "text-red-700" },
  }[prioritas];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${cfg.bg} ${cfg.text}`}>
      {prioritas === "Kritis" && <AlertTriangle size={10} />}
      {prioritas}
    </span>
  );
}

function KategoriBadge({ kategori }: { kategori: PerbaikanKategori }) {
  const cfg = {
    PM:  { bg: "bg-purple-50", text: "text-purple-700", icon: <Cpu size={10} /> },
    ATL: { bg: "bg-teal-50",   text: "text-teal-700",   icon: <Layers size={10} /> },
    AL:  { bg: "bg-indigo-50", text: "text-indigo-700", icon: <Car size={10} /> },
  }[kategori];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
      {cfg.icon} {kategori}
    </span>
  );
}

function TingkatBadge({ tingkat }: { tingkat: TingkatKerusakan }) {
  const cfg = {
    Ringan: { bg: "bg-green-50",  text: "text-green-700" },
    Sedang: { bg: "bg-yellow-50", text: "text-yellow-700" },
    Berat:  { bg: "bg-orange-50", text: "text-orange-700" },
    Kritis: { bg: "bg-red-50",    text: "text-red-700" },
  }[tingkat];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
      {tingkat}
    </span>
  );
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────
function DetailDrawer({ record, onClose, onStatusChange }: {
  record: PerbaikanRecord;
  onClose: () => void;
  onStatusChange: (id: string, status: PerbaikanStatus, catatan?: string) => void;
}) {
  const [confirmAction, setConfirmAction] = useState<PerbaikanStatus | null>(null);
  const [catatanInput, setCatatanInput]   = useState("");
  const [biayaInput, setBiayaInput]       = useState("");

  const handleConfirm = () => {
    if (!confirmAction) return;
    onStatusChange(record.id, confirmAction, catatanInput);
    onClose();
  };

  const tlDotBg = (i: number, isLast: boolean) => {
    if (!isLast) return "bg-[#111827]";
    if (record.status === "Selesai")    return "bg-green-500";
    if (record.status === "Dibatalkan") return "bg-red-500";
    if (record.status === "Dalam Proses") return "bg-blue-500";
    return "bg-yellow-500";
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full z-50 w-full max-w-[560px] bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs font-mono font-semibold text-gray-400">{record.id}</span>
              <StatusBadge status={record.status} />
            </div>
            <p className="text-base font-bold text-gray-900 truncate">{record.aset.nama}</p>
            <p className="text-xs text-gray-500 mt-0.5">{record.aset.kode} · {record.aset.tipe}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md shrink-0 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap">
            <KategoriBadge kategori={record.aset.kategori} />
            <TingkatBadge tingkat={record.tingkatKerusakan} />
            <PrioritasBadge prioritas={record.prioritas} />
            <span className="text-xs text-gray-400 ml-auto">Diajukan oleh {record.pengaju}</span>
          </div>

          {/* Keluhan */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Keluhan / Kerusakan</p>
            <p className="text-sm text-gray-800 bg-yellow-50 border border-yellow-100 rounded-lg px-4 py-3 leading-relaxed">{record.keluhan}</p>
          </div>

          {/* Kategori & Tingkat kerusakan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
              <p className="text-[10px] font-semibold uppercase text-gray-400 mb-1.5">Kategori Kerusakan</p>
              <p className="text-xs font-semibold text-gray-800">{record.kategoriKerusakan}</p>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
              <p className="text-[10px] font-semibold uppercase text-gray-400 mb-1.5">Tingkat Kerusakan</p>
              <TingkatBadge tingkat={record.tingkatKerusakan} />
            </div>
          </div>

          {/* Lokasi + Penanganan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase text-gray-400 mb-1">Lokasi Aset</p>
              <div className="flex items-center gap-1.5"><Building size={12} className="text-gray-400 shrink-0" /><span className="text-xs text-gray-700">{record.gedung}</span></div>
              <div className="flex items-center gap-1.5"><MapPin size={12} className="text-gray-400 shrink-0" /><span className="text-xs text-gray-700">{record.ruangan}</span></div>
              <div className="flex items-center gap-1.5"><User size={12} className="text-gray-400 shrink-0" /><span className="text-xs text-gray-700">PIC: {record.pic}</span></div>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase text-gray-400 mb-1">Teknisi / Vendor</p>
              <div className="flex items-center gap-1.5"><Wrench size={12} className="text-gray-400 shrink-0" /><span className="text-xs font-medium text-gray-800">{record.teknisi}</span></div>
              <div className="flex items-center gap-1.5"><Calendar size={12} className="text-gray-400 shrink-0" /><span className="text-xs text-gray-700">Mulai: {record.tglMulai ?? "—"}</span></div>
              {record.tglSelesai && <div className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-green-500 shrink-0" /><span className="text-xs text-gray-700">Selesai: {record.tglSelesai}</span></div>}
            </div>
          </div>

          {/* Biaya */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
              <p className="text-[10px] font-semibold uppercase text-gray-400 mb-1">Estimasi Biaya</p>
              <p className="text-sm font-bold text-gray-800">{record.biayaEstimasi !== null ? `Rp ${fmt(record.biayaEstimasi)}` : "—"}</p>
            </div>
            <div className={`border rounded-lg p-3 ${record.biayaRealisasi !== null ? "bg-green-50 border-green-100" : "bg-gray-50 border-gray-100"}`}>
              <p className="text-[10px] font-semibold uppercase text-gray-400 mb-1">Biaya Realisasi</p>
              <p className={`text-sm font-bold ${record.biayaRealisasi !== null ? "text-green-700" : "text-gray-400"}`}>
                {record.biayaRealisasi !== null ? `Rp ${fmt(record.biayaRealisasi)}` : "Belum ada"}
              </p>
            </div>
          </div>

          {/* Downtime + Jadwal berikutnya */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
              <p className="text-[10px] font-semibold uppercase text-gray-400 mb-1">Downtime</p>
              <div className="flex items-center gap-1.5">
                <Timer size={14} className="text-gray-400" />
                <p className="text-sm font-bold text-gray-800">{record.downtime !== null ? `${record.downtime} jam` : "—"}</p>
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
              <p className="text-[10px] font-semibold uppercase text-gray-400 mb-1">Jadwal Maintenance Berikutnya</p>
              <div className="flex items-center gap-1.5">
                <CalendarCheck size={14} className="text-gray-400" />
                <p className="text-xs font-semibold text-gray-800">{record.jadwalBerikutnya ?? "Belum dijadwalkan"}</p>
              </div>
            </div>
          </div>

          {/* Riwayat Maintenance Summary */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Riwayat Maintenance</p>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <p className="text-[10px] text-gray-400">Maintenance Terakhir</p>
                <p className="text-xs font-semibold text-gray-800">{record.tglMaintenanceTerakhir ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Jenis Terakhir</p>
                <p className="text-xs font-semibold text-gray-800">{record.jenisMaintenanceTerakhir ?? "—"}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Total Frekuensi</p>
                <p className="text-xs font-semibold text-gray-800">{record.totalFrekuensiMaintenance}x</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-400">Total Biaya Maintenance</p>
                <p className="text-xs font-semibold text-gray-800">Rp {fmt(record.totalBiayaMaintenance)}</p>
              </div>
              {record.rataRataWaktuPerbaikan !== null && (
                <div className="col-span-2">
                  <p className="text-[10px] text-gray-400">Rata-rata Waktu Perbaikan</p>
                  <p className="text-xs font-semibold text-gray-800">{record.rataRataWaktuPerbaikan} jam</p>
                </div>
              )}
            </div>
          </div>

          {/* Dokumen & Foto */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Foto / Dokumen</p>
            {record.dokumen.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Tidak ada dokumen terlampir</p>
            ) : (
              <div className="space-y-2">
                {record.dokumen.map((dok, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                      <FileText size={14} className="text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{dok.nama}</p>
                      <p className="text-[10px] text-gray-400">{dok.ukuran}</p>
                    </div>
                    <Download size={13} className="text-gray-400 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Timeline */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Timeline Status</p>
            <div>
              {record.timeline.map((item, i) => {
                const isLast = i === record.timeline.length - 1;
                const dot = tlDotBg(i, isLast);
                return (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 ${dot}`}>
                        {isLast && record.status === "Selesai"    ? <Check size={10} className="text-white" />
                          : isLast && record.status === "Dibatalkan" ? <X size={10} className="text-white" />
                          : <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                      {!isLast && <div className="w-px flex-1 bg-gray-200 my-1" style={{ minHeight: "16px" }} />}
                    </div>
                    <div className={`flex-1 min-w-0 ${isLast ? "pb-0" : "pb-4"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-900">{item.status}</p>
                        <span className="text-[10px] text-gray-400 shrink-0">{item.tanggal}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">oleh {item.oleh}</p>
                      {item.catatan && (
                        <p className="text-[11px] text-gray-600 mt-1.5 bg-gray-50 rounded px-2.5 py-1.5 border border-gray-100 leading-relaxed">{item.catatan}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Catatan */}
          {record.catatan && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Catatan</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">{record.catatan}</p>
            </div>
          )}

          {/* Actions */}
          {(record.status === "Menunggu" || record.status === "Dalam Proses") && !confirmAction && (
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              {record.status === "Menunggu" && (
                <button
                  onClick={() => setConfirmAction("Dalam Proses")}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-[#111827] rounded-[8px] hover:bg-gray-800 transition-colors"
                >
                  <PlayCircle size={15} /> Mulai Proses
                </button>
              )}
              {record.status === "Dalam Proses" && (
                <button
                  onClick={() => setConfirmAction("Selesai")}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-[8px] hover:bg-green-700 transition-colors"
                >
                  <CheckCircle2 size={15} /> Tandai Selesai
                </button>
              )}
              <button
                onClick={() => setConfirmAction("Dibatalkan")}
                className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-600 border border-red-200 rounded-[8px] hover:bg-red-50 transition-colors"
              >
                <StopCircle size={15} /> Batalkan
              </button>
            </div>
          )}

          {confirmAction && (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
              <p className="text-sm font-semibold text-gray-800">
                {confirmAction === "Dalam Proses" && "Konfirmasi: Mulai Proses Perbaikan"}
                {confirmAction === "Selesai" && "Konfirmasi: Perbaikan Selesai"}
                {confirmAction === "Dibatalkan" && "Konfirmasi: Batalkan Perbaikan"}
              </p>
              {confirmAction === "Selesai" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Biaya Realisasi (Rp)</label>
                  <input
                    type="number" value={biayaInput} onChange={e => setBiayaInput(e.target.value)}
                    placeholder="0"
                    className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Catatan</label>
                <textarea rows={2} value={catatanInput} onChange={e => setCatatanInput(e.target.value)}
                  placeholder="Tambahkan catatan..." className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleConfirm}
                  className={`flex-1 py-2 text-sm font-semibold text-white rounded-lg transition-colors ${
                    confirmAction === "Dibatalkan" ? "bg-red-600 hover:bg-red-700" : confirmAction === "Selesai" ? "bg-green-600 hover:bg-green-700" : "bg-[#111827] hover:bg-gray-800"
                  }`}>
                  Konfirmasi
                </button>
                <button onClick={() => setConfirmAction(null)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── New Perbaikan Modal (4-step wizard) ───────────────────────────────────────
function NewPerbaikanModal({ onClose, onSubmit }: {
  onClose: () => void;
  onSubmit: (data: Omit<PerbaikanRecord, "id">) => void;
}) {
  const [step, setStep] = useState(1);
  // Step 1
  const [selectedAset, setSelectedAset] = useState<AsetPerbaikan | null>(null);
  const [asetSearch, setAsetSearch] = useState("");
  const [katFilter, setKatFilter] = useState<PerbaikanKategori | "">("");
  // Step 2
  const [keluhan, setKeluhan] = useState("");
  const [kategoriKerusakan, setKategoriKerusakan] = useState("");
  const [tingkatKerusakan, setTingkatKerusakan] = useState<TingkatKerusakan>("Sedang");
  const [prioritas, setPrioritas] = useState<PerbaikanPrioritas>("Sedang");
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  // Step 3
  const [teknisi, setTeknisi] = useState("");
  const [biayaEstimasi, setBiayaEstimasi] = useState("");
  const [tglMulai, setTglMulai] = useState("");
  const [catatan, setCatatan] = useState("");

  const store = useDataStore();
  const asetList = useMemo<AsetPerbaikan[]>(
    () => store.assets.filter(a => (["PM","ATL","AL"] as string[]).includes(a.TipeAset ?? "")).map(assetToAsetPerbaikan),
    [store.assets],
  );

  const filteredAset = useMemo(() => {
    const q = asetSearch.toLowerCase();
    return asetList.filter(a =>
      (!katFilter || a.kategori === katFilter) &&
      (!q || a.nama.toLowerCase().includes(q) || a.kode.toLowerCase().includes(q))
    );
  }, [asetSearch, katFilter, asetList]);

  const canNext = step === 1 ? !!selectedAset
    : step === 2 ? keluhan.trim().length > 0 && !!kategoriKerusakan
    : step === 3 ? !!teknisi
    : true;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(prev => [...prev, ...files.map(f => f.name)]);
    e.target.value = "";
  };

  const handleSubmit = () => {
    if (!selectedAset) return;
    const today = new Date().toISOString().slice(0, 10);
    onSubmit({
      aset: { kode: selectedAset.kode, nama: selectedAset.nama, tipe: selectedAset.tipe, kategori: selectedAset.kategori },
      keluhan, kategoriKerusakan, tingkatKerusakan, prioritas,
      status: "Menunggu",
      teknisi, gedung: selectedAset.gedung, ruangan: selectedAset.ruangan, pic: selectedAset.pic,
      tglAjuan: today, tglMulai: tglMulai || null, tglSelesai: null,
      biayaEstimasi: biayaEstimasi ? parseInt(biayaEstimasi, 10) : null,
      biayaRealisasi: null, downtime: null, catatan,
      pengaju: "Othniel Patrick Limbong",
      dokumen: uploadedFiles.map(f => ({ nama: f, ukuran: "—" })),
      jadwalBerikutnya: null, tglMaintenanceTerakhir: null, jenisMaintenanceTerakhir: null,
      totalFrekuensiMaintenance: 0, totalBiayaMaintenance: 0, rataRataWaktuPerbaikan: null,
      timeline: [{ tanggal: today, status: "Diajukan", oleh: "Othniel Patrick Limbong", catatan: keluhan }],
    });
    onClose();
  };

  const STEP_LABELS = ["Pilih Aset", "Detail Kerusakan", "Penanganan & Biaya", "Konfirmasi"];

  const PRIORITAS_COLORS: Record<PerbaikanPrioritas, { idle: string; active: string }> = {
    Rendah: { idle: "border-gray-300 bg-gray-50 text-gray-700",      active: "border-gray-500 bg-gray-100 ring-1 ring-gray-400" },
    Sedang: { idle: "border-blue-300 bg-blue-50 text-blue-700",      active: "border-blue-500 bg-blue-100 ring-1 ring-blue-400" },
    Tinggi: { idle: "border-orange-300 bg-orange-50 text-orange-700",active: "border-orange-500 bg-orange-100 ring-1 ring-orange-400" },
    Kritis: { idle: "border-red-300 bg-red-50 text-red-700",         active: "border-red-500 bg-red-100 ring-1 ring-red-400" },
  };

  const TINGKAT_COLORS: Record<TingkatKerusakan, { idle: string; active: string }> = {
    Ringan: { idle: "border-green-300 bg-green-50 text-green-700",   active: "border-green-500 bg-green-100 ring-1 ring-green-400" },
    Sedang: { idle: "border-yellow-300 bg-yellow-50 text-yellow-700",active: "border-yellow-500 bg-yellow-100 ring-1 ring-yellow-400" },
    Berat:  { idle: "border-orange-300 bg-orange-50 text-orange-700",active: "border-orange-500 bg-orange-100 ring-1 ring-orange-400" },
    Kritis: { idle: "border-red-300 bg-red-50 text-red-700",         active: "border-red-500 bg-red-100 ring-1 ring-red-400" },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-[12px] shadow-2xl w-full max-w-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Buat Tiket Perbaikan</h2>
            <p className="text-xs text-gray-500 mt-0.5">Langkah {step} dari 4 — {STEP_LABELS[step - 1]}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center px-6 pt-4 gap-1">
          {STEP_LABELS.map((label, i) => {
            const idx = i + 1;
            const active = idx === step;
            const done   = idx < step;
            return (
              <React.Fragment key={label}>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${done || active ? "bg-[#111827] text-white" : "bg-gray-200 text-gray-500"}`}>
                    {done ? <Check size={12} /> : idx}
                  </div>
                  <span className={`text-[9px] font-medium ${active ? "text-gray-900" : "text-gray-400"}`}>{label}</span>
                </div>
                {i < STEP_LABELS.length - 1 && <div className={`flex-1 h-[1px] mb-4 ${idx < step ? "bg-[#111827]" : "bg-gray-200"}`} />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[58vh] overflow-y-auto">

          {/* Step 1: Pilih Aset */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={asetSearch} onChange={e => setAsetSearch(e.target.value)}
                    placeholder="Cari nama atau kode aset..."
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400" />
                </div>
                <select value={katFilter} onChange={e => setKatFilter(e.target.value as PerbaikanKategori | "")}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-1 focus:ring-gray-400">
                  <option value="">Semua</option>
                  <option value="PM">PM</option>
                  <option value="ATL">ATL</option>
                  <option value="AL">AL</option>
                </select>
              </div>
              <div className="space-y-2 max-h-[36vh] overflow-y-auto pr-1">
                {filteredAset.map(aset => (
                  <div key={aset.kode} onClick={() => setSelectedAset(aset)}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedAset?.kode === aset.kode ? "border-[#111827] bg-gray-50 shadow-sm" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      aset.kategori === "PM" ? "bg-purple-100" : aset.kategori === "ATL" ? "bg-teal-100" : "bg-indigo-100"
                    }`}>
                      {aset.kategori === "PM"  && <Cpu size={16} className="text-purple-700" />}
                      {aset.kategori === "ATL" && <Layers size={16} className="text-teal-700" />}
                      {aset.kategori === "AL"  && <Car size={16} className="text-indigo-700" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{aset.nama}</p>
                        <KategoriBadge kategori={aset.kategori} />
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{aset.kode} · {aset.ruangan}</p>
                    </div>
                    {selectedAset?.kode === aset.kode && (
                      <div className="w-5 h-5 rounded-full bg-[#111827] flex items-center justify-center shrink-0">
                        <Check size={11} className="text-white" />
                      </div>
                    )}
                  </div>
                ))}
                {filteredAset.length === 0 && <div className="text-center py-8 text-sm text-gray-400">Tidak ada aset ditemukan</div>}
              </div>
            </div>
          )}

          {/* Step 2: Detail Kerusakan */}
          {step === 2 && selectedAset && (
            <div className="space-y-4">
              {/* Asset preview */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  selectedAset.kategori === "PM" ? "bg-purple-100" : selectedAset.kategori === "ATL" ? "bg-teal-100" : "bg-indigo-100"
                }`}>
                  {selectedAset.kategori === "PM"  && <Cpu size={14} className="text-purple-700" />}
                  {selectedAset.kategori === "ATL" && <Layers size={14} className="text-teal-700" />}
                  {selectedAset.kategori === "AL"  && <Car size={14} className="text-indigo-700" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{selectedAset.nama}</p>
                  <p className="text-xs text-gray-500">{selectedAset.kode} · {selectedAset.ruangan}</p>
                </div>
              </div>

              {/* Keluhan */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Deskripsi Keluhan <span className="text-red-500">*</span></label>
                <textarea rows={3} value={keluhan} onChange={e => setKeluhan(e.target.value)}
                  placeholder="Jelaskan kerusakan atau masalah yang dialami aset..."
                  className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none" />
              </div>

              {/* Kategori Kerusakan */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Kategori Kerusakan <span className="text-red-500">*</span></label>
                <select value={kategoriKerusakan} onChange={e => setKategoriKerusakan(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-1 focus:ring-gray-400">
                  <option value="">-- Pilih kategori --</option>
                  {KATEGORI_KERUSAKAN_LIST.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>

              {/* Tingkat Kerusakan */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Tingkat Kerusakan</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["Ringan", "Sedang", "Berat", "Kritis"] as TingkatKerusakan[]).map(t => (
                    <button key={t} onClick={() => setTingkatKerusakan(t)}
                      className={`py-2 text-xs font-semibold rounded-lg border transition-all ${tingkatKerusakan === t ? TINGKAT_COLORS[t].active : TINGKAT_COLORS[t].idle}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prioritas */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">Tingkat Prioritas</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["Rendah", "Sedang", "Tinggi", "Kritis"] as PerbaikanPrioritas[]).map(p => (
                    <button key={p} onClick={() => setPrioritas(p)}
                      className={`py-2 text-xs font-semibold rounded-lg border transition-all ${prioritas === p ? PRIORITAS_COLORS[p].active : PRIORITAS_COLORS[p].idle}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload Foto/Dokumen */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Foto / Dokumen <span className="text-gray-400 font-normal">(opsional)</span>
                </label>
                <label className="flex flex-col items-center justify-center gap-1.5 h-16 border-2 border-dashed border-gray-300 rounded-[8px] cursor-pointer hover:border-[#111827] hover:bg-gray-50 transition-colors group">
                  <Upload size={16} className="text-gray-400 group-hover:text-[#111827] transition-colors" />
                  <span className="text-xs text-gray-500 group-hover:text-gray-700">Klik untuk upload foto atau dokumen</span>
                  <input type="file" className="hidden" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleFileChange} />
                </label>
                {uploadedFiles.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {uploadedFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md">
                        <FileText size={13} className="text-red-500 shrink-0" />
                        <span className="text-xs text-gray-700 flex-1 truncate">{f}</span>
                        <button onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Penanganan & Biaya */}
          {step === 3 && selectedAset && (
            <div className="space-y-4">
              {/* Teknisi */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Teknisi / Vendor <span className="text-red-500">*</span></label>
                <select value={teknisi} onChange={e => setTeknisi(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-1 focus:ring-gray-400">
                  <option value="">-- Pilih teknisi --</option>
                  {TEKNISI_LIST.map(t => <option key={t.nama} value={t.nama}>{t.nama} — {t.spesialis}</option>)}
                </select>
              </div>

              {/* Estimasi Biaya */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Estimasi Biaya (Rp)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 font-medium">Rp</span>
                  <input type="number" value={biayaEstimasi} onChange={e => setBiayaEstimasi(e.target.value)}
                    placeholder="0"
                    className="w-full text-sm pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400" />
                </div>
              </div>

              {/* Tanggal mulai */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Rencana Tanggal Mulai</label>
                <div className="relative">
                  <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="date" value={tglMulai} onChange={e => setTglMulai(e.target.value)}
                    className="w-full text-sm pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400" />
                </div>
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Catatan Tambahan</label>
                <textarea rows={3} value={catatan} onChange={e => setCatatan(e.target.value)}
                  placeholder="Informasi tambahan (opsional)..."
                  className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 resize-none" />
              </div>
            </div>
          )}

          {/* Step 4: Konfirmasi */}
          {step === 4 && selectedAset && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                <CheckCircle2 size={18} className="text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-green-800">Siap disimpan</p>
                  <p className="text-xs text-green-700 mt-0.5">Periksa kembali detail tiket sebelum menyimpan.</p>
                </div>
              </div>
              <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                {([
                  { label: "Aset",              value: `${selectedAset.nama} (${selectedAset.kode})` },
                  { label: "Kategori",          value: selectedAset.tipe },
                  { label: "Lokasi",            value: `${selectedAset.gedung} — ${selectedAset.ruangan}` },
                  { label: "Keluhan",           value: keluhan },
                  { label: "Kategori Kerusakan",value: kategoriKerusakan },
                  { label: "Tingkat Kerusakan", value: tingkatKerusakan },
                  { label: "Prioritas",         value: prioritas },
                  { label: "Teknisi",           value: teknisi },
                  { label: "Estimasi Biaya",    value: biayaEstimasi ? `Rp ${fmt(parseInt(biayaEstimasi, 10))}` : "—" },
                  { label: "Tgl Mulai",         value: tglMulai || "—" },
                  uploadedFiles.length > 0 ? { label: "Dokumen", value: `${uploadedFiles.length} file terlampir` } : null,
                  { label: "Catatan",           value: catatan || "—" },
                ].filter(Boolean) as { label: string; value: string }[]).map(({ label, value }, i) => (
                  <div key={label} className={`flex gap-3 px-4 py-2.5 ${i % 2 === 0 ? "bg-gray-50" : "bg-white"}`}>
                    <span className="text-xs text-gray-500 w-36 shrink-0">{label}</span>
                    <span className="text-xs font-semibold text-gray-800 flex-1">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-between bg-gray-50/50">
          <button onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            {step === 1 ? "Batal" : "← Kembali"}
          </button>
          <button disabled={!canNext} onClick={() => step < 4 ? setStep(s => s + 1) : handleSubmit()}
            className={`px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors ${canNext ? "bg-[#111827] hover:bg-gray-800" : "bg-gray-300 cursor-not-allowed"}`}>
            {step < 4 ? "Lanjut →" : "Simpan Tiket"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function PerbaikanPage({ topBar }: { topBar: React.ReactNode }) {
  const store = useDataStore();
  const [localOverlay, setLocalOverlay] = useState<Record<string, Partial<PerbaikanRecord>>>({});
  const [localNewTickets, setLocalNewTickets] = useState<PerbaikanRecord[]>([]);
  const records = useMemo<PerbaikanRecord[]>(() => {
    const fromStore = store.maintenanceTickets.map(t => {
      const base = ticketToRecord(t, store.assets.find(a => a.id === t.asset_id));
      const overlay = localOverlay[t.id];
      return overlay ? { ...base, ...overlay } : base;
    });
    return [...localNewTickets, ...fromStore];
  }, [store.maintenanceTickets, store.assets, localOverlay, localNewTickets]);
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState<PerbaikanStatus | "Semua">("Semua");
  const [katFilter, setKatFilter]       = useState<PerbaikanKategori | "">("");
  const [prioritasFilter, setPrioritasFilter] = useState<PerbaikanPrioritas | "">("");
  const [showNew, setShowNew]         = useState(false);
  const [drawerId, setDrawerId]       = useState<string | null>(null);
  const [hoverId, setHoverId]         = useState<string | null>(null);

  const drawerRecord = drawerId ? records.find(r => r.id === drawerId) ?? null : null;

  const TODAY = new Date("2026-06-01");
  const daysSince = (dateStr: string) =>
    Math.floor((TODAY.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));

  const counts = useMemo(() => {
    const overdue = records.filter(r => {
      if (r.status === "Menunggu")     return daysSince(r.tglAjuan) > 3;
      if (r.status === "Dalam Proses" && r.tglMulai) return daysSince(r.tglMulai) > 7;
      return false;
    }).length;
    const totalEstimasi = records.reduce((s, r) => s + (r.biayaEstimasi ?? 0), 0);
    return {
      total:        records.length,
      menunggu:     records.filter(r => r.status === "Menunggu").length,
      dalamProses:  records.filter(r => r.status === "Dalam Proses").length,
      selesai:      records.filter(r => r.status === "Selesai").length,
      dibatalkan:   records.filter(r => r.status === "Dibatalkan").length,
      overdue, totalEstimasi,
      pm:  records.filter(r => r.aset.kategori === "PM").length,
      atl: records.filter(r => r.aset.kategori === "ATL").length,
      al:  records.filter(r => r.aset.kategori === "AL").length,
    };
  }, [records]);

  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    return records.filter(r => {
      if (statusFilter !== "Semua" && r.status !== statusFilter) return false;
      if (katFilter && r.aset.kategori !== katFilter) return false;
      if (prioritasFilter && r.prioritas !== prioritasFilter) return false;
      if (q) {
        const matchNama = String(r.aset?.nama || "").toLowerCase().includes(q);
        const matchKode = String(r.aset?.kode || "").toLowerCase().includes(q);
        const matchTeknisi = String(r.teknisi || "").toLowerCase().includes(q);
        const matchId = String(r.id || "").toLowerCase().includes(q);
        if (!matchNama && !matchKode && !matchTeknisi && !matchId) return false;
      }
      return true;
    });
  }, [records, statusFilter, katFilter, prioritasFilter, search]);

  const handleStatusChange = (id: string, status: PerbaikanStatus, catatan?: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const newEntry: TimelineItem = {
      tanggal: today,
      status:  status === "Dalam Proses" ? "Mulai Proses" : status,
      oleh:    store.currentUser?.nama || "Othniel Patrick Limbong",
      catatan: catatan?.trim() || undefined,
    };
    const rec = records.find(r => r.id === id);
    if (status === "Selesai" && rec) {
      const ticket = store.maintenanceTickets.find(t => t.id === id);
      if (ticket) store.completeMaintenance(ticket);
    }
    const isLocalNew = localNewTickets.some(r => r.id === id);
    if (isLocalNew) {
      setLocalNewTickets(prev => prev.map(r => {
        if (r.id !== id) return r;
        return {
          ...r, status,
          tglMulai:   status === "Dalam Proses" ? today : r.tglMulai,
          tglSelesai: status === "Selesai"       ? today : r.tglSelesai,
          catatan:    catatan?.trim() ? catatan : r.catatan,
          timeline:   [...r.timeline, newEntry],
        };
      }));
    } else {
      setLocalOverlay(prev => {
        const base = rec ?? prev[id];
        const prevOverlay = prev[id] || {};
        const prevTimeline = (prevOverlay.timeline ?? base?.timeline) || [];
        return {
          ...prev,
          [id]: {
            ...prevOverlay,
            status,
            tglMulai:   status === "Dalam Proses" ? today : (prevOverlay.tglMulai   ?? base?.tglMulai   ?? null),
            tglSelesai: status === "Selesai"       ? today : (prevOverlay.tglSelesai ?? base?.tglSelesai ?? null),
            catatan:    catatan?.trim() ? catatan : (prevOverlay.catatan ?? base?.catatan ?? ""),
            timeline:   [...prevTimeline, newEntry],
          },
        };
      });
    }
    if (status !== "Selesai" && rec) {
      store.appendActivity({
        pengguna: store.currentUser?.nama || "Othniel Patrick Limbong",
        role: store.currentUser?.role || "Admin Sistem",
        menu: "Perbaikan",
        aksi: `Status tiket ${id} diubah menjadi ${status}`,
        target_type: "Ticket",
        target_id: id,
        status: "Berhasil",
        jenis: "perbaikan",
      });
    }
  };

  const handleSubmit = (data: Omit<PerbaikanRecord, "id">) => {
    const last  = records.filter(r => r.id.startsWith("PRB-2026-")).length;
    const newId = `PRB-2026-${String(last + 1).padStart(3, "0")}`;
    store.appendActivity({
      pengguna: store.currentUser?.nama || "Othniel Patrick Limbong",
      role: store.currentUser?.role || "Admin Sistem",
      menu: "Perbaikan",
      aksi: `Tiket perbaikan ${newId} – ${data.aset.nama} dibuat`,
      target_type: "Ticket",
      target_id: data.aset.kode,
      status: "Berhasil",
      jenis: "perbaikan",
    });
    const existingAsset = store.assets.find(a => a.id === data.aset.kode);
    if (existingAsset) {
      const shouldDowngrade = data.tingkatKerusakan === "Sedang" || data.tingkatKerusakan === "Berat" || data.tingkatKerusakan === "Kritis";
      store.upsertAsset(
        {
          ...existingAsset,
          tanggal_maintenance_terakhir: data.tglAjuan,
          Kondisi: shouldDowngrade ? "Rusak Ringan" : existingAsset.Kondisi,
        },
        { reason: "Tiket perbaikan baru" },
      );
    }
    setLocalNewTickets(prev => [{ id: newId, ...data }, ...prev]);
  };

  const STAT_CARDS = [
    { label: "Total Tiket",    value: counts.total,       sub: "semua kategori",     icon: <ClipboardList size={18} className="text-gray-600" />,  bg: "bg-gray-50" },
    { label: "Menunggu",       value: counts.menunggu,    sub: "belum ditangani",    icon: <Clock size={18} className="text-yellow-600" />,         bg: "bg-yellow-50" },
    { label: "Dalam Proses",   value: counts.dalamProses, sub: "sedang dikerjakan",  icon: <RefreshCw size={18} className="text-blue-600" />,       bg: "bg-blue-50" },
    { label: "Selesai",        value: counts.selesai,     sub: "berhasil diperbaiki",icon: <CheckCircle2 size={18} className="text-green-600" />,   bg: "bg-green-50" },
  ];

  const STAT_CARDS2 = [
    { label: "Dibatalkan",     value: counts.dibatalkan,  sub: "tidak dilanjutkan",  icon: <XCircle size={18} className="text-red-500" />,          bg: "bg-red-50" },
    { label: "Overdue",        value: counts.overdue,     sub: "> SLA waktu respon", icon: <AlertTriangle size={18} className="text-orange-600" />, bg: "bg-orange-50" },
    { label: "Total Estimasi", value: `Rp ${fmtJuta(counts.totalEstimasi)}`, sub: "estimasi biaya perbaikan", icon: <FileText size={18} className="text-purple-600" />, bg: "bg-purple-50", isText: true },
  ];

  const CAT_CARDS = [
    { label: "Peralatan & Mesin",  count: counts.pm,  kat: "PM"  as PerbaikanKategori, icon: <Cpu size={16} className="text-purple-600" />, bg: "bg-purple-50", text: "text-purple-700" },
    { label: "Aset Tetap Lainnya", count: counts.atl, kat: "ATL" as PerbaikanKategori, icon: <Layers size={16} className="text-teal-600" />, bg: "bg-teal-50",   text: "text-teal-700" },
    { label: "Alat Angkutan",      count: counts.al,  kat: "AL"  as PerbaikanKategori, icon: <Car size={16} className="text-indigo-600" />, bg: "bg-indigo-50", text: "text-indigo-700" },
  ];

  const STATUS_TABS: Array<PerbaikanStatus | "Semua"> = ["Semua", "Menunggu", "Dalam Proses", "Selesai", "Dibatalkan"];

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 min-w-0">
      {topBar}

      <div className="px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 min-w-0">
        {/* Title + CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Perbaikan Aset</h1>
            <p className="text-sm text-gray-500 mt-0.5">Monitor dan kelola proses perbaikan aset PM, ATL, dan AL.</p>
          </div>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#111827] rounded-lg hover:bg-gray-800 transition-colors shadow-sm">
            <Plus size={16} /> Buat Tiket Perbaikan
          </button>
        </div>

        {/* KPI Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {STAT_CARDS.map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 shadow-sm min-w-0">
              <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>{s.icon}</div>
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold text-gray-900 truncate">{s.value}</p>
                <p className="text-xs text-gray-500 leading-tight truncate">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* KPI Row 2 (tambahan) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {STAT_CARDS2.map(s => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 shadow-sm min-w-0">
              <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>{s.icon}</div>
              <div className="min-w-0 flex-1">
                {"isText" in s
                  ? <p className="text-base font-bold text-gray-900 truncate" title={s.value}>{s.value}</p>
                  : <p className="text-xl font-bold text-gray-900 truncate">{s.value}</p>
                }
                <p className="text-xs text-gray-500 leading-tight truncate">{s.label}</p>
                <p className="text-[10px] text-gray-400 truncate">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Kategori breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {CAT_CARDS.map(c => (
            <button key={c.kat} onClick={() => setKatFilter(prev => prev === c.kat ? "" : c.kat)}
              className={`bg-white border rounded-xl p-4 flex items-center gap-3 shadow-sm transition-all text-left ${
                katFilter === c.kat ? "border-[#111827] ring-1 ring-[#111827]" : "border-gray-200 hover:border-gray-300"
              }`}>
              <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center shrink-0`}>{c.icon}</div>
              <div>
                <p className={`text-lg font-bold ${c.text}`}>{c.count}</p>
                <p className="text-xs text-gray-500 leading-tight">{c.label}</p>
              </div>
              {katFilter === c.kat && <Check size={14} className="ml-auto text-gray-700" />}
            </button>
          ))}
        </div>

        {/* Table card */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* Filter bar */}
          <div className="px-5 py-3 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1 min-w-0">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cari ID, nama aset, teknisi..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400" />
            </div>
            <div className="relative shrink-0">
              <select value={prioritasFilter} onChange={e => setPrioritasFilter(e.target.value as PerbaikanPrioritas | "")}
                className="text-sm border border-gray-200 rounded-lg pl-3 pr-8 py-2 bg-white outline-none focus:ring-1 focus:ring-gray-400 appearance-none cursor-pointer">
                <option value="">Semua Prioritas</option>
                {(["Kritis", "Tinggi", "Sedang", "Rendah"] as PerbaikanPrioritas[]).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <button
              onClick={() => exportToExcel(filtered.map(r => ({
                "ID": r.id, "Kode Aset": r.aset.kode, "Nama Aset": r.aset.nama,
                "Kategori": r.aset.kategori, "Keluhan": r.keluhan,
                "Prioritas": r.prioritas, "Status": r.status, "Teknisi": r.teknisi,
                "Gedung": r.gedung, "Ruangan": r.ruangan, "PIC": r.pic,
                "Tgl Ajuan": r.tglAjuan, "Tgl Selesai": r.tglSelesai ?? "",
                "Biaya Estimasi": r.biayaEstimasi ?? 0, "Biaya Realisasi": r.biayaRealisasi ?? 0,
              })), `perbaikan-${new Date().toISOString().slice(0,10)}`, "Perbaikan")}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shrink-0">
              <Download size={14} /> Export
            </button>
          </div>

          {/* Status tabs */}
          <div className="flex items-center gap-1 px-5 pt-3 border-b border-gray-100 overflow-x-auto">
            {STATUS_TABS.map(tab => {
              const count = tab === "Semua" ? counts.total : tab === "Menunggu" ? counts.menunggu
                : tab === "Dalam Proses" ? counts.dalamProses : tab === "Selesai" ? counts.selesai : counts.dibatalkan;
              return (
                <button key={tab} onClick={() => setStatusFilter(tab)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                    statusFilter === tab ? "border-[#111827] text-[#111827]" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}>
                  {tab}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    statusFilter === tab ? "bg-[#111827] text-white" : "bg-gray-100 text-gray-500"
                  }`}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {["ID Tiket", "Aset", "Keluhan", "Prioritas", "Teknisi / Vendor", "Tgl Ajuan", "Status", "Aksi"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <Wrench size={32} strokeWidth={1} />
                        <p className="text-sm font-medium">Tidak ada data perbaikan</p>
                        <p className="text-xs">Coba ubah filter atau buat tiket baru</p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(r => (
                  <tr key={r.id} onMouseEnter={() => setHoverId(r.id)} onMouseLeave={() => setHoverId(null)}
                    className="hover:bg-gray-50 transition-colors">

                    <td className="px-4 py-3">
                      <span className="text-xs font-mono font-semibold text-gray-700">{r.id}</span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <KategoriBadge kategori={r.aset.kategori} />
                        <div>
                          <p className="text-xs font-semibold text-gray-800 max-w-[120px] truncate">{r.aset.nama}</p>
                          <p className="text-[10px] text-gray-400">{r.aset.kode}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 max-w-[160px]">
                      <p className="text-xs text-gray-600 truncate" title={r.keluhan}>{r.keluhan}</p>
                    </td>

                    <td className="px-4 py-3"><PrioritasBadge prioritas={r.prioritas} /></td>

                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-700 max-w-[110px] truncate">{r.teknisi}</p>
                    </td>

                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-500">{r.tglAjuan}</p>
                    </td>

                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>

                    <td className="px-4 py-3">
                      <div className={`flex items-center gap-1 transition-opacity ${hoverId === r.id ? "opacity-100" : "opacity-0"}`}>
                        <button onClick={() => setDrawerId(r.id)} title="Detail"
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                          <Eye size={14} />
                        </button>
                        {r.status === "Menunggu" && (
                          <button onClick={() => handleStatusChange(r.id, "Dalam Proses")} title="Mulai Proses"
                            className="p-1.5 text-blue-400 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors">
                            <PlayCircle size={14} />
                          </button>
                        )}
                        {r.status === "Dalam Proses" && (
                          <button onClick={() => handleStatusChange(r.id, "Selesai")} title="Tandai Selesai"
                            className="p-1.5 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-md transition-colors">
                            <CheckCircle2 size={14} />
                          </button>
                        )}
                        {(r.status === "Menunggu" || r.status === "Dalam Proses") && (
                          <button onClick={() => handleStatusChange(r.id, "Dibatalkan")} title="Batalkan"
                            className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors">
                            <XCircle size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Menampilkan <span className="font-semibold text-gray-700">{filtered.length}</span> dari <span className="font-semibold text-gray-700">{records.length}</span> tiket
            </p>
            <div className="flex items-center gap-1.5">
              <button className="px-3 py-1 text-xs font-medium text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">← Prev</button>
              <button className="px-3 py-1 text-xs font-medium bg-[#111827] text-white rounded-md">1</button>
              <button className="px-3 py-1 text-xs font-medium text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">Next →</button>
            </div>
          </div>
        </div>
      </div>

      {showNew       && <NewPerbaikanModal onClose={() => setShowNew(false)} onSubmit={handleSubmit} />}
      {drawerRecord  && <DetailDrawer record={drawerRecord} onClose={() => setDrawerId(null)} onStatusChange={handleStatusChange} />}
    </main>
  );
}
