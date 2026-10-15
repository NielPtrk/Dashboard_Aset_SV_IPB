import React, { useState, useMemo } from "react";
import { useDataStore, type MutationRequest, type Asset } from "./DataStore";
import { exportToExcel } from "./excelUtils";
import {
  ArrowLeftRight, MapPin, Users, Building, User, Search,
  Download, Plus, X, Clock, CheckCircle2, XCircle, Eye,
  Calendar, FileText, ArrowRight, AlertCircle, Send, Check, Upload,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
type MutasiJenis  = "Pindah Gedung" | "Pindah Ruangan" | "Ganti PIC" | "Antar Unit";
type MutasiStatus = "Menunggu" | "Disetujui" | "Ditolak";

interface DokumenItem { nama: string; ukuran: string; }
interface TimelineItem { tanggal: string; status: string; oleh: string; catatan?: string; }

interface AsetMaster {
  kode: string; nama: string; tipe: string;
  gedung: string; ruangan: string; pic: string; unit: string;
}

interface MutasiRecord {
  id: string;
  aset: { kode: string; nama: string; tipe: string };
  jenis: MutasiJenis;
  asal:   { gedung: string; ruangan: string; pic: string; unit: string };
  tujuan: { gedung: string; ruangan: string; pic: string; unit: string };
  tanggal: string;
  tglAjuan: string;
  status: MutasiStatus;
  catatan: string;
  pengaju: string;
  dokumen: DokumenItem[];
  timeline: TimelineItem[];
  catatanApprover?: string;
}

// ── Conversion: store request → local rich record ──────────────────────────────
function mutasiToRecord(m: MutationRequest, asset?: Asset): MutasiRecord {
  const pStatus: MutasiStatus =
    m.status === "Selesai" || m.status === "Disetujui"
      ? "Disetujui"
      : m.status === "Ditolak"
      ? "Ditolak"
      : "Menunggu";

  const jenis: MutasiJenis = (m.jenis as MutasiJenis) || "Pindah Ruangan";
  const tgl = m.tanggal || m.tgl_ajuan || new Date().toISOString().split("T")[0];
  const pengaju = m.pengaju || "Admin Sistem";
  const approver = m.approver || "Approver Sistem";

  const asalGedung = m.dari_gedung || asset?.nama_gedung || asset?.gedung || "Kampus Cilibende";
  const asalRuangan = m.dari_ruangan || asset?.Nama_ruangan || asset?.nama_ruangan || "-";
  const asalPic = m.dari_pic || asset?.nama_pic || asset?.Pengguna || asset?.pengguna || "-";
  const asalUnit = m.dari_unit || asset?.Nama_unit || asset?.nama_unit || "Sekolah Vokasi (SV)";

  const tujuanGedung = m.ke_gedung || asalGedung;
  const tujuanRuangan = m.ke_ruangan || asalRuangan;
  const tujuanPic = m.ke_pic || asalPic;
  const tujuanUnit = m.ke_unit || asalUnit;

  return {
    id: m.nomor_mutasi || m.id,
    aset: {
      kode: asset?.kode_tag_aset || asset?.id || m.asset_id,
      nama: asset?.Nama_Barang || asset?.nama_barang || m.asset_id,
      tipe: asset?.TipeAset || asset?.jenis_aset || "-",
    },
    jenis,
    asal: { gedung: asalGedung, ruangan: asalRuangan, pic: asalPic, unit: asalUnit },
    tujuan: { gedung: tujuanGedung, ruangan: tujuanRuangan, pic: tujuanPic, unit: tujuanUnit },
    tanggal: tgl,
    tglAjuan: m.tgl_ajuan || tgl,
    status: pStatus,
    catatan: m.catatan || "",
    pengaju,
    dokumen: (m.dokumen as DokumenItem[]) || [],
    timeline: [
      { tanggal: m.tgl_ajuan || tgl, status: "Diajukan", oleh: pengaju, catatan: m.catatan },
      ...(pStatus === "Disetujui"
        ? [
            {
              tanggal: m.tanggal_approval ? String(m.tanggal_approval).split("T")[0] : tgl,
              status: "Disetujui",
              oleh: approver,
              catatan: m.catatan_approver,
            },
          ]
        : []),
      ...(pStatus === "Ditolak"
        ? [
            {
              tanggal: m.tanggal_approval ? String(m.tanggal_approval).split("T")[0] : tgl,
              status: "Ditolak",
              oleh: approver,
              catatan: m.catatan_approver,
            },
          ]
        : []),
    ],
    catatanApprover: m.catatan_approver,
  };
}

function assetToAsetMaster(a: Asset): AsetMaster {
  const locUpper = (a.Nama_ruangan || a.nama_ruangan || "").toUpperCase();
  const campus = a.nama_gedung || a.gedung || (
    locUpper.includes("GUNUNG GEDE") || locUpper.includes("GG") || locUpper.includes("BS AGB")
      ? "Kampus Gunung Gede"
      : "Kampus Cilibende"
  );
  const assetCode = a.kode_tag_aset || a.id || a.Id || "-";
  return {
    kode: assetCode,
    nama: a.Nama_Barang || a.nama_barang || assetCode,
    tipe: a.TipeAset || a.jenis_aset || "-",
    gedung: campus,
    ruangan: a.Nama_ruangan || a.nama_ruangan_standar || a.nama_ruangan || "-",
    pic: a.nama_pic || a.Pengguna || a.pengguna || "-",
    unit: a.Nama_unit || a.nama_unit || "Sekolah Vokasi (SV)",
  };
}

// ── Master Data Dinamis ───────────────────────────────────────────────────────
const GEDUNG_LIST = [
  "Kampus Cilibende",
  "Kampus Gunung Gede",
  "Kampus Pajajaran",
  "Kampus Baranangsiang",
  "Kampus / Lokasi Lainnya",
  "Belum Dikategorikan",
];
const UNIT_DEFAULT = "Sekolah Vokasi (SV)";


// ── Helpers ───────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: MutasiStatus }) {
  const cfg = {
    Menunggu:  { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", icon: <Clock size={11} /> },
    Disetujui: { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200",  icon: <CheckCircle2 size={11} /> },
    Ditolak:   { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200",    icon: <XCircle size={11} /> },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.icon} {status}
    </span>
  );
}

function JenisBadge({ jenis }: { jenis: MutasiJenis }) {
  const cfg: Record<MutasiJenis, { bg: string; text: string; icon: React.ReactNode }> = {
    "Pindah Gedung":  { bg: "bg-blue-50",   text: "text-blue-700",   icon: <Building size={11} /> },
    "Pindah Ruangan": { bg: "bg-purple-50",  text: "text-purple-700", icon: <MapPin size={11} /> },
    "Ganti PIC":      { bg: "bg-gray-100",   text: "text-gray-700",   icon: <User size={11} /> },
    "Antar Unit":     { bg: "bg-orange-50",  text: "text-orange-700", icon: <Users size={11} /> },
  };
  const c = cfg[jenis];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${c.bg} ${c.text}`}>
      {c.icon} {jenis}
    </span>
  );
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────
function DetailDrawer({ record, onClose, onStatusChange }: {
  record: MutasiRecord;
  onClose: () => void;
  onStatusChange: (id: string, status: MutasiStatus, catatan?: string) => void;
}) {
  const [confirmAction, setConfirmAction] = useState<"Disetujui" | "Ditolak" | null>(null);
  const [catatanInput, setCatatanInput] = useState("");

  const handleConfirm = () => {
    if (!confirmAction) return;
    onStatusChange(record.id, confirmAction, catatanInput);
    onClose();
  };

  const tlDot = (item: TimelineItem, isLast: boolean) => {
    if (!isLast) return "bg-[#111827]";
    if (record.status === "Disetujui") return "bg-green-500";
    if (record.status === "Ditolak")   return "bg-red-500";
    return "bg-yellow-500";
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full z-50 w-[520px] bg-white shadow-2xl flex flex-col">

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
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md shrink-0 mt-0.5 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Jenis + meta */}
          <div className="flex items-center gap-2 flex-wrap">
            <JenisBadge jenis={record.jenis} />
            <span className="text-xs text-gray-400">Diajukan {record.tglAjuan} oleh {record.pengaju}</span>
          </div>

          {/* Perpindahan */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2.5">Perpindahan</p>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
              {/* Asal */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-[10px] font-semibold uppercase text-gray-400 mb-2">Lokasi / PIC Asal</p>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-1.5">
                    <Building size={12} className="text-gray-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-gray-700">{record.asal.gedung}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <MapPin size={12} className="text-gray-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-gray-700">{record.asal.ruangan}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <User size={12} className="text-gray-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-gray-700">{record.asal.pic}</span>
                  </div>
                  {record.jenis === "Antar Unit" && (
                    <div className="flex items-start gap-1.5">
                      <Users size={12} className="text-gray-400 shrink-0 mt-0.5" />
                      <span className="text-xs text-gray-700">{record.asal.unit}</span>
                    </div>
                  )}
                </div>
              </div>
              {/* Arrow */}
              <div className="mt-8 flex items-center justify-center">
                <div className="w-7 h-7 rounded-full bg-[#111827] flex items-center justify-center">
                  <ArrowRight size={12} className="text-white" />
                </div>
              </div>
              {/* Tujuan */}
              <div className="bg-[#111827]/5 border border-[#111827]/10 rounded-lg p-3">
                <p className="text-[10px] font-semibold uppercase text-gray-400 mb-2">Lokasi / PIC Baru</p>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-1.5">
                    <Building size={12} className="text-[#111827]/60 shrink-0 mt-0.5" />
                    <span className="text-xs font-medium text-gray-900">{record.tujuan.gedung}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <MapPin size={12} className="text-[#111827]/60 shrink-0 mt-0.5" />
                    <span className="text-xs font-medium text-gray-900">{record.tujuan.ruangan}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <User size={12} className="text-[#111827]/60 shrink-0 mt-0.5" />
                    <span className="text-xs font-medium text-gray-900">{record.tujuan.pic}</span>
                  </div>
                  {record.jenis === "Antar Unit" && (
                    <div className="flex items-start gap-1.5">
                      <Users size={12} className="text-[#111827]/60 shrink-0 mt-0.5" />
                      <span className="text-xs font-medium text-gray-900">{record.tujuan.unit}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Alasan Mutasi */}
          {record.catatan && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Alasan Mutasi</p>
              <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100 leading-relaxed">{record.catatan}</p>
            </div>
          )}

          {/* Dokumen Pendukung */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Dokumen Pendukung</p>
            {record.dokumen.length === 0 ? (
              <p className="text-xs text-gray-400 italic py-1">Tidak ada dokumen terlampir</p>
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

          {/* Timeline Persetujuan */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">Timeline Persetujuan</p>
            <div>
              {record.timeline.map((item, i) => {
                const isLast = i === record.timeline.length - 1;
                const dot = tlDot(item, isLast);
                return (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 ${dot}`}>
                        {isLast && record.status === "Disetujui" ? <Check size={10} className="text-white" />
                          : isLast && record.status === "Ditolak" ? <X size={10} className="text-white" />
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

          {/* Catatan Approver */}
          {record.catatanApprover && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Catatan Approver</p>
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                <p className="text-sm text-blue-800 leading-relaxed">{record.catatanApprover}</p>
              </div>
            </div>
          )}

          {/* Approve / Reject actions */}
          {record.status === "Menunggu" && !confirmAction && (
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button
                onClick={() => setConfirmAction("Ditolak")}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-red-200 text-red-600 rounded-[8px] text-sm font-medium hover:bg-red-50 transition-colors"
              >
                <XCircle size={15} /> Tolak
              </button>
              <button
                onClick={() => setConfirmAction("Disetujui")}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#111827] text-white rounded-[8px] text-sm font-medium hover:bg-[#1F2937] transition-colors"
              >
                <CheckCircle2 size={15} /> Setujui
              </button>
            </div>
          )}

          {confirmAction && (
            <div className={`rounded-lg p-4 border ${confirmAction === "Disetujui" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <p className={`text-sm font-semibold mb-2 ${confirmAction === "Disetujui" ? "text-green-800" : "text-red-800"}`}>
                {confirmAction === "Disetujui" ? "Konfirmasi Persetujuan" : "Konfirmasi Penolakan"}
              </p>
              <textarea
                value={catatanInput}
                onChange={e => setCatatanInput(e.target.value)}
                placeholder={confirmAction === "Disetujui" ? "Catatan persetujuan (opsional)..." : "Alasan penolakan (wajib)..."}
                className="w-full p-3 text-sm border border-gray-200 rounded-lg resize-none outline-none bg-white mb-3"
                rows={2}
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmAction(null)} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900">Batal</button>
                <button
                  onClick={handleConfirm}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-[8px] text-xs font-semibold text-white transition-colors ${confirmAction === "Disetujui" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                >
                  <Check size={13} /> Konfirmasi
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function NewMutasiModal({ onClose, onSubmit }: {
  onClose: () => void;
  onSubmit: (record: Omit<MutasiRecord, "id">) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedAset, setSelectedAset] = useState<AsetMaster | null>(null);
  const [jenisQuery, setJenisQuery] = useState<MutasiJenis | "">("");
  const [asetSearch, setAsetSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(25);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [form, setForm] = useState({
    tujuanGedung: "", tujuanRuangan: "", tujuanPIC: "", tujuanUnit: "",
    tanggal: new Date().toISOString().split("T")[0],
    catatan: "",
  });

  const store = useDataStore();
  const gedungList = useMemo<string[]>(() => GEDUNG_LIST, []);

  // Efficient room map built directly from store.ruangan (256 master rooms)
  const ruanganMap = useMemo<Record<string, string[]>>(() => {
    const map: Record<string, Set<string>> = {};
    GEDUNG_LIST.forEach(g => { map[g] = new Set<string>(); });

    (store.ruangan || []).forEach((r) => {
      const campus = r.kampus || "Kampus Cilibende";
      if (!map[campus]) map[campus] = new Set<string>();
      if (r.namaRuangan) {
        map[campus].add(r.namaRuangan);
      }
    });

    const result: Record<string, string[]> = {};
    for (const [k, set] of Object.entries(map)) {
      result[k] = Array.from(set).sort();
    }
    return result;
  }, [store.ruangan]);

  // Fast on-demand PIC list for Step 3
  const picList = useMemo<{ nama: string; jabatan: string }[]>(() => {
    if (step !== 3 || jenisQuery !== "Ganti PIC") return [];
    const map = new Map<string, string>();
    (store.users || []).forEach(u => map.set(u.nama, u.role));
    
    // Quick sample from assets without blocking
    const assets = store.assets || [];
    const limit = Math.min(assets.length, 3000);
    for (let i = 0; i < limit; i++) {
      const p = (assets[i].nama_pic || assets[i].Pengguna || assets[i].pengguna || "").trim();
      if (p && p !== "-" && !map.has(p)) {
        map.set(p, "Penanggung Jawab Aset");
      }
    }

    return Array.from(map.entries())
      .filter(([nama]) => nama && nama.trim() !== "" && nama !== "-")
      .map(([nama, jabatan]) => ({ nama, jabatan }));
  }, [step, jenisQuery, store.assets, store.users]);

  // Fast on-demand Unit list for Step 3
  const unitList = useMemo<string[]>(() => {
    if (step !== 3 || jenisQuery !== "Antar Unit") return [UNIT_DEFAULT];
    const set = new Set<string>();
    set.add(UNIT_DEFAULT);
    const assets = store.assets || [];
    const limit = Math.min(assets.length, 3000);
    for (let i = 0; i < limit; i++) {
      const u = (assets[i].Nama_unit || assets[i].nama_unit || "").trim();
      if (u && u !== "-") set.add(u);
    }
    return Array.from(set).sort();
  }, [step, jenisQuery, store.assets]);

  // Reset visibleCount when search query changes
  React.useEffect(() => {
    setVisibleCount(25);
  }, [asetSearch]);

  // Fast search with capped results to avoid rendering 21,000 DOM nodes
  const matchingAssets = useMemo(() => {
    const q = (asetSearch || "").trim().toLowerCase();
    const assets = store.assets || [];
    if (!q) {
      // Return first 100 items by default for instant rendering
      return assets.slice(0, 100).map(assetToAsetMaster);
    }
    const results: AsetMaster[] = [];
    for (let i = 0; i < assets.length; i++) {
      const a = assets[i];
      const nama = String(a.Nama_Barang || a.nama_barang || "");
      const kode = String(a.kode_tag_aset || a.id || a.Id || "");
      const nup = String(a.Id_aset || a.id_aset || a.nup || a.NUP || "");
      const pic = String(a.Pengguna || a.nama_pic || "");
      const room = String(a.Nama_ruangan || a.nama_ruangan || "");

      if (
        nama.toLowerCase().includes(q) ||
        kode.toLowerCase().includes(q) ||
        nup.toLowerCase().includes(q) ||
        pic.toLowerCase().includes(q) ||
        room.toLowerCase().includes(q)
      ) {
        results.push(assetToAsetMaster(a));
        if (results.length >= 200) break; // Cap search at 200 items for instant response
      }
    }
    return results;
  }, [store.assets, asetSearch]);

  const visibleAset = useMemo(() => {
    return matchingAssets.slice(0, visibleCount);
  }, [matchingAssets, visibleCount]);

  const availableRuangan = form.tujuanGedung ? (ruanganMap[form.tujuanGedung] || []) : [];

  const canProceed = () => {
    if (step === 1) return !!selectedAset;
    if (step === 2) return !!jenisQuery;
    if (step === 3) {
      if (jenisQuery === "Ganti PIC")  return !!form.tujuanPIC  && !!form.tanggal;
      if (jenisQuery === "Antar Unit") return !!form.tujuanUnit && !!form.tanggal;
      return !!form.tujuanGedung && !!form.tujuanRuangan && !!form.tanggal;
    }
    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles(prev => [...prev, ...files.map(f => f.name)]);
    e.target.value = "";
  };

  const handleSubmit = () => {
    if (!selectedAset || !jenisQuery) return;
    const today = new Date().toISOString().split("T")[0];
    const pengajuName = store.currentUser?.nama || "Admin Sistem";
    onSubmit({
      aset: { kode: selectedAset.kode, nama: selectedAset.nama, tipe: selectedAset.tipe },
      jenis: jenisQuery as MutasiJenis,
      asal: { gedung: selectedAset.gedung, ruangan: selectedAset.ruangan, pic: selectedAset.pic, unit: selectedAset.unit },
      tujuan: {
        gedung:  jenisQuery === "Ganti PIC" || jenisQuery === "Antar Unit" ? selectedAset.gedung  : (form.tujuanGedung || selectedAset.gedung),
        ruangan: jenisQuery === "Ganti PIC" || jenisQuery === "Antar Unit" ? selectedAset.ruangan : form.tujuanRuangan,
        pic:     jenisQuery === "Ganti PIC" ? form.tujuanPIC : selectedAset.pic,
        unit:    jenisQuery === "Antar Unit" ? form.tujuanUnit : selectedAset.unit,
      },
      tanggal:   form.tanggal || today,
      tglAjuan:  today,
      status:    "Menunggu",
      catatan:   form.catatan,
      pengaju:   pengajuName,
      dokumen:   uploadedFiles.map(f => ({ nama: f, ukuran: "PDF · Lampiran" })),
      timeline:  [
        { tanggal: today, status: "Diajukan",        oleh: pengajuName, catatan: form.catatan || "Pengajuan mutasi baru" },
        { tanggal: today, status: "Menunggu Review", oleh: "Sistem" },
      ],
    });
  };

  const stepLabels = ["Pilih Aset", "Jenis Mutasi", "Detail & Dokumen", "Konfirmasi"];
  const jenisOptions: { jenis: MutasiJenis; icon: React.ElementType; desc: string }[] = [
    { jenis: "Pindah Gedung",  icon: Building, desc: "Pindahkan aset ke gedung atau kampus lain" },
    { jenis: "Pindah Ruangan", icon: MapPin,   desc: "Pindahkan aset ke ruangan lain dalam gedung yang sama atau berbeda" },
    { jenis: "Ganti PIC",      icon: User,     desc: "Ubah penanggung jawab (Person In Charge) aset" },
    { jenis: "Antar Unit",     icon: Users,    desc: "Alihkan pengelolaan aset ke unit / bagian kerja berbeda" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-[12px] shadow-2xl w-full max-w-xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Ajukan Mutasi Aset</h2>
            <p className="text-xs text-gray-500 mt-0.5">Langkah {step} dari 4</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-4">
          <div className="flex items-center">
            {stepLabels.map((label, i) => {
              const n = i + 1;
              const isDone = n < step;
              const isCurrent = n === step;
              return (
                <React.Fragment key={n}>
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      isDone || isCurrent ? "bg-[#111827] text-white" : "bg-gray-100 text-gray-400"
                    }`}>
                      {isDone ? <Check size={13} /> : n}
                    </div>
                    <span className={`text-[9px] font-medium mt-1 ${isCurrent ? "text-[#111827]" : isDone ? "text-gray-500" : "text-gray-400"}`}>
                      {label}
                    </span>
                  </div>
                  {i < stepLabels.length - 1 && (
                    <div className={`flex-1 h-[2px] mb-4 mx-1 transition-colors ${n < step ? "bg-[#111827]" : "bg-gray-200"}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Step content */}
        <div className="px-6 py-5 min-h-[300px] max-h-[460px] overflow-y-auto">

          {/* Step 1: Pilih Aset */}
          {step === 1 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-[8px] px-3 h-9">
                <Search size={14} className="text-gray-400" />
                <input
                  value={asetSearch}
                  onChange={e => setAsetSearch(e.target.value)}
                  placeholder="Cari kode atau nama aset..."
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                {matchingAssets.length === 0 ? (
                  <div className="py-8 text-center text-gray-400">
                    <AlertCircle size={24} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-xs font-medium">Tidak ada aset ditemukan</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Coba cari dengan nama, kode, NUP, atau PIC lain</p>
                  </div>
                ) : (
                  <>
                    {visibleAset.map(aset => (
                      <div
                        key={aset.kode}
                        onClick={() => setSelectedAset(aset)}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedAset?.kode === aset.kode ? "border-[#111827] bg-gray-50 shadow-sm" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${selectedAset?.kode === aset.kode ? "bg-[#111827]" : "bg-gray-100"}`}>
                          <ArrowLeftRight size={14} className={selectedAset?.kode === aset.kode ? "text-white" : "text-gray-500"} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-gray-900 truncate">{aset.nama}</p>
                            <span className="text-[10px] font-mono text-gray-400 ml-2 shrink-0">{aset.kode}</span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">{aset.tipe}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="flex items-center gap-1 text-[11px] text-gray-500"><Building size={10} /> {aset.gedung}</span>
                            <span className="flex items-center gap-1 text-[11px] text-gray-500"><MapPin size={10} /> {aset.ruangan}</span>
                          </div>
                        </div>
                        {selectedAset?.kode === aset.kode && (
                          <div className="w-4 h-4 rounded-full bg-[#111827] flex items-center justify-center shrink-0 mt-1">
                            <Check size={10} className="text-white" />
                          </div>
                        )}
                      </div>
                    ))}

                    {visibleCount < matchingAssets.length && (
                      <div className="pt-2 text-center">
                        <button
                          type="button"
                          onClick={() => setVisibleCount(prev => prev + 25)}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors border border-blue-200"
                        >
                          Tampilkan lebih banyak ({matchingAssets.length - visibleCount} lagi)
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Jenis Mutasi */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">
                Pilih jenis mutasi untuk <span className="font-semibold text-gray-900">{selectedAset?.nama}</span>
              </p>
              {jenisOptions.map(({ jenis, icon: Icon, desc }) => (
                <div
                  key={jenis}
                  onClick={() => { setJenisQuery(jenis); setForm(f => ({ ...f, tujuanGedung: "", tujuanRuangan: "", tujuanPIC: "", tujuanUnit: "" })); }}
                  className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all ${
                    jenisQuery === jenis ? "border-[#111827] bg-gray-50 shadow-sm" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${jenisQuery === jenis ? "bg-[#111827]" : "bg-gray-100"}`}>
                    <Icon size={18} className={jenisQuery === jenis ? "text-white" : "text-gray-500"} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">{jenis}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                  {jenisQuery === jenis && (
                    <div className="w-5 h-5 rounded-full bg-[#111827] flex items-center justify-center shrink-0 mt-1">
                      <Check size={11} className="text-white" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Step 3: Detail + Dokumen */}
          {step === 3 && selectedAset && (
            <div className="space-y-4">
              {/* Kondisi saat ini */}
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Kondisi Saat Ini</p>
                <div className="grid grid-cols-3 gap-2">
                  <div><p className="text-[10px] text-gray-400">Gedung</p><p className="text-xs font-semibold text-gray-800">{selectedAset.gedung}</p></div>
                  <div><p className="text-[10px] text-gray-400">Ruangan</p><p className="text-xs font-semibold text-gray-800">{selectedAset.ruangan}</p></div>
                  <div><p className="text-[10px] text-gray-400">PIC</p><p className="text-xs font-semibold text-gray-800">{selectedAset.pic}</p></div>
                </div>
              </div>

              <div className="space-y-3">
                {/* Pindah Gedung / Ruangan */}
                {(jenisQuery === "Pindah Gedung" || jenisQuery === "Pindah Ruangan") && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Gedung Tujuan</label>
                      <select
                        className="w-full h-10 px-3 bg-white border border-gray-300 rounded-[8px] text-sm text-gray-800 focus:ring-2 focus:ring-[#111827] focus:border-[#111827] outline-none"
                        value={form.tujuanGedung}
                        onChange={e => setForm(f => ({ ...f, tujuanGedung: e.target.value, tujuanRuangan: "" }))}
                      >
                        <option value="">-- Pilih Gedung --</option>
                        {gedungList.filter(g => jenisQuery === "Pindah Gedung" ? g !== selectedAset.gedung : true).map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">Ruangan Tujuan</label>
                      <select
                        className="w-full h-10 px-3 bg-white border border-gray-300 rounded-[8px] text-sm text-gray-800 focus:ring-2 focus:ring-[#111827] focus:border-[#111827] outline-none disabled:bg-gray-50 disabled:text-gray-400"
                        value={form.tujuanRuangan}
                        onChange={e => setForm(f => ({ ...f, tujuanRuangan: e.target.value }))}
                        disabled={!form.tujuanGedung}
                      >
                        <option value="">-- Pilih Ruangan --</option>
                        {availableRuangan.filter(r => !(form.tujuanGedung === selectedAset.gedung && r === selectedAset.ruangan)).length === 0 ? (
                          <option disabled value="">Belum ada data ruangan terdaftar</option>
                        ) : (
                          availableRuangan.filter(r => !(form.tujuanGedung === selectedAset.gedung && r === selectedAset.ruangan)).map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))
                        )}
                      </select>
                    </div>
                  </>
                )}

                {/* Ganti PIC */}
                {jenisQuery === "Ganti PIC" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Penanggung Jawab Baru (PIC)</label>
                    <select
                      className="w-full h-10 px-3 bg-white border border-gray-300 rounded-[8px] text-sm text-gray-800 focus:ring-2 focus:ring-[#111827] focus:border-[#111827] outline-none"
                      value={form.tujuanPIC}
                      onChange={e => setForm(f => ({ ...f, tujuanPIC: e.target.value }))}
                    >
                      <option value="">-- Pilih PIC Baru --</option>
                      {picList.filter(p => p.nama !== selectedAset.pic).length === 0 ? (
                        <option disabled value="">Belum ada data PIC terdaftar</option>
                      ) : (
                        picList.filter(p => p.nama !== selectedAset.pic).map(p => (
                          <option key={p.nama} value={p.nama}>{p.nama} — {p.jabatan}</option>
                        ))
                      )}
                    </select>
                  </div>
                )}

                {/* Antar Unit */}
                {jenisQuery === "Antar Unit" && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Unit Tujuan</label>
                    <select
                      className="w-full h-10 px-3 bg-white border border-gray-300 rounded-[8px] text-sm text-gray-800 focus:ring-2 focus:ring-[#111827] focus:border-[#111827] outline-none"
                      value={form.tujuanUnit}
                      onChange={e => setForm(f => ({ ...f, tujuanUnit: e.target.value }))}
                    >
                      <option value="">-- Pilih Unit Tujuan --</option>
                      {unitList.filter(u => u !== selectedAset.unit).length === 0 ? (
                        <option disabled value="">Belum ada unit tujuan lain terdaftar</option>
                      ) : (
                        unitList.filter(u => u !== selectedAset.unit).map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))
                      )}
                    </select>
                  </div>
                )}

                {/* Tanggal */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Tanggal Mutasi</label>
                  <div className="relative">
                    <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="date"
                      value={form.tanggal}
                      onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))}
                      className="w-full h-10 pl-9 pr-3 bg-white border border-gray-300 rounded-[8px] text-sm text-gray-800 focus:ring-2 focus:ring-[#111827] focus:border-[#111827] outline-none"
                    />
                  </div>
                </div>

                {/* Alasan */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Keterangan / Alasan</label>
                  <textarea
                    value={form.catatan}
                    onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))}
                    rows={3}
                    placeholder="Jelaskan alasan mutasi ini..."
                    className="w-full p-3 bg-white border border-gray-300 rounded-[8px] text-sm text-gray-800 focus:ring-2 focus:ring-[#111827] focus:border-[#111827] outline-none resize-none"
                  />
                </div>

                {/* Upload Dokumen */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Dokumen Pendukung <span className="text-gray-400 font-normal">(opsional)</span>
                  </label>
                  <label className="flex flex-col items-center justify-center gap-1.5 h-20 border-2 border-dashed border-gray-300 rounded-[8px] cursor-pointer hover:border-[#111827] hover:bg-gray-50 transition-colors group">
                    <Upload size={18} className="text-gray-400 group-hover:text-[#111827] transition-colors" />
                    <span className="text-xs text-gray-500 group-hover:text-gray-700">Klik untuk upload dokumen</span>
                    <input type="file" className="hidden" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleFileChange} />
                  </label>
                  {uploadedFiles.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {uploadedFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md">
                          <FileText size={13} className="text-red-500 shrink-0" />
                          <span className="text-xs text-gray-700 flex-1 truncate">{f}</span>
                          <button
                            onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Konfirmasi */}
          {step === 4 && selectedAset && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                <CheckCircle2 size={18} className="text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-green-800">Siap diajukan</p>
                  <p className="text-xs text-green-700 mt-0.5">Periksa kembali detail mutasi sebelum mengirimkan pengajuan.</p>
                </div>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {([
                  { label: "Aset",         value: `${selectedAset.nama} (${selectedAset.kode})` },
                  { label: "Jenis Mutasi", value: jenisQuery },
                  { label: "Gedung Asal",  value: selectedAset.gedung },
                  { label: "Ruangan Asal", value: selectedAset.ruangan },
                  { label: "PIC Asal",     value: selectedAset.pic },
                  jenisQuery === "Ganti PIC"  ? { label: "PIC Baru",     value: form.tujuanPIC }
                  : jenisQuery === "Antar Unit" ? { label: "Unit Tujuan",  value: form.tujuanUnit }
                  : { label: "Gedung Tujuan", value: form.tujuanGedung },
                  (jenisQuery !== "Ganti PIC" && jenisQuery !== "Antar Unit")
                    ? { label: "Ruangan Tujuan", value: form.tujuanRuangan }
                    : null,
                  { label: "Tanggal",      value: form.tanggal },
                  { label: "Keterangan",   value: form.catatan || "—" },
                  uploadedFiles.length > 0 ? { label: "Dokumen", value: `${uploadedFiles.length} file terlampir` } : null,
                ].filter(Boolean) as { label: string; value: string }[]).map((item, i) => (
                  <div key={i} className={`flex items-start gap-3 px-4 py-3 ${i % 2 === 0 ? "bg-gray-50" : "bg-white"}`}>
                    <span className="text-xs text-gray-500 w-36 shrink-0">{item.label}</span>
                    <span className="text-xs font-semibold text-gray-800">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
          <button
            onClick={() => step > 1 ? setStep(s => (s - 1) as 1 | 2 | 3 | 4) : onClose()}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            {step === 1 ? "Batal" : "← Kembali"}
          </button>
          {step < 4 ? (
            <button
              onClick={() => setStep(s => (s + 1) as 1 | 2 | 3 | 4)}
              disabled={!canProceed()}
              className="px-5 py-2 bg-[#111827] text-white rounded-[8px] text-sm font-semibold hover:bg-[#1F2937] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Lanjut →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 px-5 py-2 bg-[#111827] text-white rounded-[8px] text-sm font-semibold hover:bg-[#1F2937] transition-colors"
            >
              <Send size={14} /> Ajukan Mutasi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function MutasiPage({ topBar }: { topBar: React.ReactNode }) {
  const store = useDataStore();
  const [showNew, setShowNew]           = useState(false);
  const [drawerRecord, setDrawerRecord] = useState<MutasiRecord | null>(null);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("Semua");
  const [jenisFilter, setJenisFilter]   = useState<string>("Semua");

  const data = useMemo<MutasiRecord[]>(() => {
    if ((store.mutationRequests || []).length === 0) return [];
    const assetMap = new Map<string, Asset>();
    const assets = store.assets || [];
    for (let i = 0; i < assets.length; i++) {
      const a = assets[i];
      if (a.id) assetMap.set(String(a.id).trim().toLowerCase(), a);
      if (a.kode_tag_aset) assetMap.set(String(a.kode_tag_aset).trim().toLowerCase(), a);
      if (a.db_id) assetMap.set(String(a.db_id).trim().toLowerCase(), a);
      if (a.Id) assetMap.set(String(a.Id).trim().toLowerCase(), a);
      if (a.KodeBarang) assetMap.set(String(a.KodeBarang).trim().toLowerCase(), a);
    }
    return store.mutationRequests.map(m => {
      const targetId = String(m.asset_id || "").trim().toLowerCase();
      const matchedAsset = assetMap.get(targetId);
      return mutasiToRecord(m, matchedAsset);
    });
  }, [store.mutationRequests, store.assets]);

  const counts = {
    total:     data.length,
    menunggu:  data.filter(d => d.status === "Menunggu").length,
    disetujui: data.filter(d => d.status === "Disetujui").length,
    ditolak:   data.filter(d => d.status === "Ditolak").length,
  };

  const filtered = useMemo(() => data.filter(d => {
    const q = (search || "").trim().toLowerCase();
    const matchSearch = !q ||
      String(d.id || "").toLowerCase().includes(q) ||
      String(d.aset?.nama || "").toLowerCase().includes(q) ||
      String(d.aset?.kode || "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "Semua" || d.status === statusFilter;
    const matchJenis  = jenisFilter  === "Semua" || d.jenis  === jenisFilter;
    return matchSearch && matchStatus && matchJenis;
  }), [data, search, statusFilter, jenisFilter]);

  const handleSubmit = async (record: Omit<MutasiRecord, "id">) => {
    try {
      const payload = {
        asset_id: record.aset.kode,
        jenis: record.jenis,
        tanggal: record.tanggal,
        tgl_ajuan: record.tglAjuan,
        dari_gedung: record.asal.gedung,
        ke_gedung: record.tujuan.gedung,
        dari_ruangan: record.asal.ruangan,
        ke_ruangan: record.tujuan.ruangan,
        dari_pic: record.asal.pic,
        ke_pic: record.tujuan.pic,
        dari_unit: record.asal.unit,
        ke_unit: record.tujuan.unit,
        catatan: record.catatan,
        pengaju: store.currentUser?.nama || record.pengaju,
        dokumen: record.dokumen,
      };
      await store.createMutation(payload, { user: store.currentUser?.nama });
      setShowNew(false);
    } catch (err) {
      console.error("Gagal mengajukan mutasi:", err);
    }
  };

  const handleStatusChange = async (id: string, status: MutasiStatus, catatan?: string) => {
    try {
      if (status === "Disetujui") {
        await store.approveMutation(id, { user: store.currentUser?.nama, catatan });
      } else if (status === "Ditolak") {
        await store.rejectMutation(id, { user: store.currentUser?.nama, catatan });
      }
      if (drawerRecord?.id === id) {
        setDrawerRecord(prev =>
          prev
            ? {
                ...prev,
                status,
                catatanApprover: catatan || prev.catatanApprover,
                timeline: [
                  ...prev.timeline,
                  {
                    tanggal: new Date().toISOString().split("T")[0],
                    status,
                    oleh: store.currentUser?.nama || "Admin Sistem",
                    catatan,
                  },
                ],
              }
            : null,
        );
      }
    } catch (err) {
      console.error("Gagal mengubah status mutasi:", err);
    }
  };

  const statCards = [
    { label: "Total Mutasi",         value: counts.total,     dot: "bg-[#111827]" },
    { label: "Menunggu Persetujuan", value: counts.menunggu,  dot: "bg-yellow-500" },
    { label: "Disetujui",            value: counts.disetujui, dot: "bg-green-500" },
    { label: "Ditolak",              value: counts.ditolak,   dot: "bg-red-500" },
  ];

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 min-w-0">
      {topBar}

      <div className="px-8 py-6 space-y-5">
        {/* Title + CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Mutasi Aset</h1>
            <p className="text-sm text-gray-500 mt-0.5">Kelola pemindahan lokasi, gedung, dan penanggung jawab aset.</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 h-10 px-5 bg-[#111827] text-white rounded-[8px] text-sm font-semibold hover:bg-[#1F2937] transition-colors shrink-0 shadow-sm"
          >
            <Plus size={16} /> Ajukan Mutasi
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          {statCards.map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500">{s.label}</span>
                <div className={`w-2 h-2 rounded-full ${s.dot}`} />
              </div>
              <p className="text-3xl font-bold text-gray-900">{s.value}</p>
              <p className="text-[11px] text-gray-400 mt-1">pengajuan tercatat</p>
            </div>
          ))}
        </div>

        {/* Table card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          {/* Toolbar */}
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-[8px] px-3 h-9 w-full sm:w-72">
              <Search size={14} className="text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Cari ID atau nama aset..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent text-sm outline-none flex-1 placeholder:text-gray-400"
              />
              {search && (
                <button onClick={() => setSearch("")}>
                  <X size={13} className="text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Status tabs */}
              <div className="flex bg-gray-100 rounded-[8px] p-0.5 gap-0.5">
                {["Semua", "Menunggu", "Disetujui", "Ditolak"].map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1 text-xs font-semibold rounded-[6px] transition-colors ${statusFilter === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                  >
                    {s}
                    {s !== "Semua" && (
                      <span className={`ml-1 text-[10px] font-bold ${statusFilter === s ? "text-gray-600" : "text-gray-400"}`}>
                        ({s === "Menunggu" ? counts.menunggu : s === "Disetujui" ? counts.disetujui : counts.ditolak})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Jenis filter */}
              <select
                value={jenisFilter}
                onChange={e => setJenisFilter(e.target.value)}
                className="h-8 px-3 bg-white border border-gray-200 rounded-[8px] text-xs font-medium text-gray-700 outline-none focus:border-gray-400 cursor-pointer"
              >
                <option value="Semua">Semua Jenis</option>
                <option value="Pindah Ruangan">Pindah Ruangan</option>
                <option value="Pindah Gedung">Pindah Gedung</option>
                <option value="Ganti PIC">Ganti PIC</option>
                <option value="Antar Unit">Antar Unit</option>
              </select>

              <button
                onClick={() => exportToExcel(filtered.map(d => ({
                  "ID": d.id, "Kode Aset": d.aset.kode, "Nama Aset": d.aset.nama,
                  "Jenis Mutasi": d.jenis, "Status": d.status,
                  "Unit Asal": d.asal.unit, "Gedung Asal": d.asal.gedung,
                  "Ruangan Asal": d.asal.ruangan, "PIC Asal": d.asal.pic,
                  "Unit Tujuan": d.tujuan.unit, "Gedung Tujuan": d.tujuan.gedung,
                  "Tanggal": d.tanggal, "Pengaju": d.pengaju, "Catatan": d.catatan,
                })), `mutasi-${new Date().toISOString().slice(0,10)}`, "Mutasi")}
                className="flex items-center gap-1.5 h-8 px-3 bg-white border border-gray-200 rounded-[8px] text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                <Download size={13} /> Export
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["ID Mutasi", "Aset", "Jenis", "Asal → Tujuan", "Tgl Pengajuan", "Status", "Aksi"].map(h => (
                    <th key={h} className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <AlertCircle size={28} className="text-gray-300" />
                        <p className="text-sm font-medium">Tidak ada data mutasi</p>
                        <p className="text-xs">Coba ubah filter atau ajukan mutasi baru</p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50/50 transition-colors group">
                    {/* ID */}
                    <td className="px-5 py-4">
                      <span className="text-xs font-mono font-semibold text-[#111827]">{d.id}</span>
                    </td>

                    {/* Aset */}
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-gray-900">{d.aset.nama}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{d.aset.kode} · {d.aset.tipe}</p>
                    </td>

                    {/* Jenis */}
                    <td className="px-5 py-4">
                      <JenisBadge jenis={d.jenis} />
                    </td>

                    {/* Asal → Tujuan */}
                    <td className="px-5 py-4">
                      {d.jenis === "Ganti PIC" ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 max-w-[90px] truncate">{d.asal.pic}</span>
                          <ArrowRight size={12} className="text-gray-400 shrink-0" />
                          <span className="text-xs font-semibold text-gray-800 max-w-[90px] truncate">{d.tujuan.pic}</span>
                        </div>
                      ) : d.jenis === "Antar Unit" ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 max-w-[90px] truncate">{d.asal.unit}</span>
                          <ArrowRight size={12} className="text-gray-400 shrink-0" />
                          <span className="text-xs font-semibold text-gray-800 max-w-[90px] truncate">{d.tujuan.unit}</span>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 truncate max-w-[90px]">
                              {d.asal.gedung === d.tujuan.gedung ? d.asal.ruangan : d.asal.gedung}
                            </span>
                            <ArrowRight size={12} className="text-gray-400 shrink-0" />
                            <span className="text-xs font-semibold text-gray-800 truncate max-w-[90px]">
                              {d.asal.gedung === d.tujuan.gedung ? d.tujuan.ruangan : d.tujuan.gedung}
                            </span>
                          </div>
                          {d.jenis === "Pindah Gedung" && (
                            <p className="text-[11px] text-gray-400 mt-0.5">{d.tujuan.ruangan}</p>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Tanggal */}
                    <td className="px-5 py-4 text-xs text-gray-600">{d.tglAjuan}</td>

                    {/* Status */}
                    <td className="px-5 py-4"><StatusBadge status={d.status} /></td>

                    {/* Aksi */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setDrawerRecord(d)}
                          className="p-1.5 text-gray-400 hover:text-[#111827] hover:bg-gray-100 rounded-md transition-colors"
                          title="Lihat Detail"
                        >
                          <Eye size={15} />
                        </button>
                        {d.status === "Menunggu" && (
                          <>
                            <button
                              onClick={() => handleStatusChange(d.id, "Disetujui")}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                              title="Setujui"
                            >
                              <CheckCircle2 size={15} />
                            </button>
                            <button
                              onClick={() => handleStatusChange(d.id, "Ditolak")}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Tolak"
                            >
                              <XCircle size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
            <p className="text-xs text-gray-500">
              Menampilkan <span className="font-semibold text-gray-700">{filtered.length}</span> dari <span className="font-semibold text-gray-700">{data.length}</span> pengajuan mutasi
            </p>
            <div className="flex items-center gap-1">
              <button className="px-3 py-1 text-xs font-medium text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">← Prev</button>
              <button className="px-3 py-1 text-xs font-medium bg-[#111827] text-white rounded-md">1</button>
              <button className="px-3 py-1 text-xs font-medium text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">Next →</button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals & Drawer */}
      {showNew       && <NewMutasiModal onClose={() => setShowNew(false)} onSubmit={handleSubmit} />}
      {drawerRecord  && <DetailDrawer  record={drawerRecord} onClose={() => setDrawerRecord(null)} onStatusChange={handleStatusChange} />}
    </main>
  );
}
