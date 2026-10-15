import React, { useState, useMemo } from "react";
import { useDataStore } from "./DataStore";
import { exportToExcel } from "./excelUtils";
import {
  Search, Download, Plus, X, Edit2, Trash2,
  Building, User, Database, Mail, Phone,
  AlertCircle, CheckCircle2, ChevronRight,
  Clock, FileText, ArrowLeftRight,
} from "lucide-react";

// ── Palette ───────────────────────────────────────────────────────────────────
const GREEN  = "#22C55E";
const AMBER  = "#F59E0B";
const RED    = "#EF4444";
const BLUE   = "#3B82F6";

// ── Types ─────────────────────────────────────────────────────────────────────
interface DrawerAsset {
  kode: string;
  nama: string;
  kondisi: "Baik" | "Cukup" | "Rusak Ringan" | "Rusak Berat";
  statusPenggunaan: "Aktif" | "Idle" | "Dipinjam";
  ruangan: string;
  picId: string;
}

interface PICRecord {
  id: string;
  nama: string;
  nip: string;
  jabatan: string;
  unit: string;
  kampus: string;
  email: string;
  telp: string;
  totalAset: number;
  asetAktif: number;
  asetRusak: number;
  asetIdle: number;
  asetBermasalah: number;
  status: "Aktif" | "Non-Aktif";
  tanggalMulai: string;
}

interface RiwayatPICRow {
  id: string;
  kodeAset: string;
  namaAset: string;
  picLama: string;
  picBaru: string;
  tanggal: string;
  alasan: string;
  petugas: string;
}

const KAMPUS_LIST = ["Semua Kampus", "Kampus Cilibende", "Kampus Gunung Gede", "Kampus Baranangsiang", "Kampus Sukabumi"];
const TABS = ["Daftar PIC", "PIC Belum Lengkap", "Riwayat Penanggung Jawab"] as const;

const SEL_CLS = "text-xs border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 outline-none focus:ring-1 focus:ring-gray-300 cursor-pointer";
const kondisiColor = (k: string) => k === "Baik" ? "green" : k === "Cukup" ? "blue" : k === "Rusak Ringan" ? "amber" : "red";
const initials = (nama: string) => nama.replace(/^(Prof\.|Dr\.)?\s*/, "").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

function SoftBadge({ label, color }: { label: string; color: "green"|"amber"|"red"|"blue"|"gray"|"purple" }) {
  const styles: Record<string, string> = {
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red:   "bg-red-50 text-red-700 border-red-200",
    blue:  "bg-blue-50 text-blue-700 border-blue-200",
    gray:  "bg-gray-100 text-gray-600 border-gray-200",
    purple:"bg-purple-50 text-purple-700 border-purple-200",
  };
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${styles[color]}`}>{label}</span>;
}

function KpiCard({ label, value, sub, badge }: { label: string; value: string; sub: string; badge?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        {badge && (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded whitespace-nowrap">
            <Database size={9} /> Sistem
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

// ── Add / Edit Modal ───────────────────────────────────────────────────────────
function PICModal({ open, onClose, initialData, onSave }: {
  open: boolean; onClose: () => void;
  initialData?: Partial<PICRecord>;
  onSave: (d: Partial<PICRecord>) => void;
}) {
  const isEdit = !!initialData?.id;
  const [form, setForm] = useState<Partial<PICRecord>>(initialData ?? {
    nama: "", nip: "", jabatan: "", unit: "", kampus: "Kampus Cilibende",
    email: "", telp: "", status: "Aktif",
  });
  const inp = (field: keyof PICRecord) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [field]: e.target.value }));
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-gray-900/20 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-[480px] bg-white shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <span className="text-sm font-semibold text-gray-800">{isEdit ? "Edit Penanggung Jawab" : "Tambah Penanggung Jawab"}</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {([
              { label: "Nama Lengkap",  field: "nama",    ph: "cth. Budi Santoso" },
              { label: "NIP",           field: "nip",     ph: "cth. 198702152010011003" },
              { label: "Jabatan",       field: "jabatan", ph: "cth. Staff IT" },
              { label: "Unit / Bagian", field: "unit",    ph: "cth. Bagian TI" },
              { label: "Email",         field: "email",   ph: "cth. budi@apps.ipb.ac.id" },
              { label: "No. Telepon",   field: "telp",    ph: "cth. 0812-3456-7890" },
            ] as { label: string; field: keyof PICRecord; ph: string }[]).map(({ label, field, ph }) => (
              <div key={field}>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
                <input value={(form[field] as string) ?? ""} onChange={inp(field)} placeholder={ph}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-gray-400 bg-white" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Kampus</label>
              <select value={form.kampus ?? ""} onChange={inp("kampus")}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-gray-400 bg-white">
                {KAMPUS_LIST.filter(k => k !== "Semua Kampus").map(k => <option key={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Status</label>
              <select value={form.status ?? "Aktif"} onChange={inp("status")}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-gray-400 bg-white">
                <option>Aktif</option><option>Non-Aktif</option>
              </select>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Batal</button>
          <button onClick={() => { onSave(form); onClose(); }} className="px-4 py-2 text-xs font-semibold text-white bg-gray-900 rounded-lg hover:bg-black">
            {isEdit ? "Simpan Perubahan" : "Tambah PIC"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Detail Drawer ──────────────────────────────────────────────────────────────
function PICDrawer({ pic, assets, riwayat, onClose, onEdit }: {
  pic: PICRecord; assets: DrawerAsset[]; riwayat: RiwayatPICRow[];
  onClose: () => void; onEdit: () => void;
}) {
  const picAssets   = assets.filter(a => a.picId === pic.id || a.picId === pic.nama);
  const perhatian   = picAssets.filter(a => a.kondisi === "Rusak Berat" || a.kondisi === "Rusak Ringan" || a.statusPenggunaan === "Idle");
  const picRiwayat  = riwayat.filter(r => r.picBaru === pic.nama || r.picLama === pic.nama);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-gray-900/20 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-[520px] bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
          <span className="text-sm font-semibold text-gray-800">Detail Penanggung Jawab</span>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg hover:bg-gray-50">
              <Edit2 size={12} /> Edit
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 transition-colors"><X size={16} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Profile */}
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center text-white font-bold shrink-0">
                {initials(pic.nama)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-bold text-gray-900">{pic.nama}</p>
                    <p className="text-xs text-gray-500">{pic.jabatan}</p>
                    <p className="text-[11px] font-mono text-gray-400 mt-0.5">NIP: {pic.nip}</p>
                  </div>
                  <SoftBadge label={pic.status} color={pic.status === "Aktif" ? "green" : "gray"} />
                </div>
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Building size={12} className="text-gray-400 shrink-0" />
                    <span>{pic.unit} · {pic.kampus}</span>
                  </div>
                  {pic.email && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Mail size={12} className="text-gray-400 shrink-0" />
                      <span>{pic.email}</span>
                    </div>
                  )}
                  {pic.telp && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Phone size={12} className="text-gray-400 shrink-0" />
                      <span>{pic.telp}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock size={12} className="text-gray-400 shrink-0" />
                    <span>PIC sejak {pic.tanggalMulai}</span>
                  </div>
                </div>
              </div>
            </div>
            {/* Asset summary */}
            <div className="grid grid-cols-4 gap-2 mt-4">
              {[
                { label: "Total", val: pic.totalAset, color: "#374151" },
                { label: "Aktif", val: pic.asetAktif, color: GREEN },
                { label: "Rusak", val: pic.asetRusak, color: RED },
                { label: "Idle",  val: pic.asetIdle,  color: AMBER },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-lg p-2.5 text-center">
                  <p className="text-lg font-bold" style={{ color: s.color }}>{s.val}</p>
                  <p className="text-[10px] text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Aset list */}
          {picAssets.length > 0 && (
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-700 mb-3">Daftar Aset ({picAssets.length} unit)</p>
              <div className="space-y-2">
                {picAssets.slice(0, 6).map(a => (
                  <div key={a.kode} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-[10px] font-mono text-gray-400">{a.kode}</p>
                      <p className="text-xs font-medium text-gray-800">{a.nama}</p>
                      <p className="text-[10px] text-gray-400">{a.ruangan}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5 shrink-0">
                      <SoftBadge label={a.kondisi} color={kondisiColor(a.kondisi) as "green"|"amber"|"red"|"blue"} />
                      <SoftBadge label={a.statusPenggunaan} color={a.statusPenggunaan === "Aktif" ? "green" : a.statusPenggunaan === "Idle" ? "amber" : "blue"} />
                    </div>
                  </div>
                ))}
                {picAssets.length > 6 && (
                  <p className="text-[11px] text-gray-400 pt-1">+ {picAssets.length - 6} aset lainnya</p>
                )}
              </div>
            </div>
          )}

          {/* Aset perlu perhatian */}
          {perhatian.length > 0 && (
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-1.5 mb-3">
                <AlertCircle size={13} className="text-amber-500" />
                <p className="text-xs font-semibold text-gray-700">Aset Perlu Perhatian ({perhatian.length})</p>
              </div>
              <div className="space-y-1.5">
                {perhatian.map(a => (
                  <div key={a.kode} className="flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{a.nama}</p>
                      <p className="text-[10px] text-gray-500">{a.kode} · {a.ruangan}</p>
                    </div>
                    <SoftBadge label={a.kondisi !== "Baik" ? a.kondisi : a.statusPenggunaan} color={a.kondisi === "Rusak Berat" ? "red" : "amber"} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Riwayat */}
          {picRiwayat.length > 0 && (
            <div className="px-6 py-4">
              <div className="flex items-center gap-1.5 mb-3">
                <ArrowLeftRight size={13} className="text-gray-400" />
                <p className="text-xs font-semibold text-gray-700">Riwayat Mutasi Aset</p>
              </div>
              <div className="space-y-2">
                {picRiwayat.map(r => (
                  <div key={r.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-medium text-gray-800">{r.namaAset}</p>
                      <span className="text-[10px] text-gray-400 shrink-0">{r.tanggal}</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mb-1">{r.kodeAset} · {r.alasan}</p>
                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                      <span className="font-medium text-gray-600">{r.picLama}</span>
                      <ChevronRight size={10} />
                      <span className="font-medium text-gray-600">{r.picBaru}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {picAssets.length === 0 && perhatian.length === 0 && picRiwayat.length === 0 && (
            <div className="px-6 py-10 text-center">
              <User size={28} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Belum ada data aset atau riwayat untuk PIC ini.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export function PICPage({ topBar }: { topBar?: React.ReactNode }) {
  const store = useDataStore();
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>("Daftar PIC");
  const [search, setSearch]     = useState("");
  const [filterKampus, setFilterKampus] = useState("Semua Kampus");
  const [filterUnit, setFilterUnit]     = useState("Semua Unit");
  const [filterStatus, setFilterStatus] = useState("Semua Status");
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow]   = useState<PICRecord | undefined>();
  const [drawerPIC, setDrawerPIC] = useState<PICRecord | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // CRUD overlay state
  const [localEdits, setLocalEdits] = useState<Record<string, PICRecord>>({});
  const [addedPICs, setAddedPICs]   = useState<PICRecord[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // Compute PIC list purely from store assets + store users (no mock data)
  const computedPICData = useMemo<PICRecord[]>(() => {
    const picMap = new Map<string, PICRecord>();
    store.assets.forEach(asset => {
      const picNama = asset.nama_pic;
      if (!picNama || picNama === "-" || picNama.trim() === "") return;
      const isRusak = (asset.Kondisi || "").includes("Rusak");
      const isIdle  = asset.status_penggunaan_aset === "Tidak Digunakan" || asset.status_penggunaan_aset === "Idle";
      const existing = picMap.get(picNama);
      if (existing) {
        existing.totalAset++;
        if (!isRusak && !isIdle) existing.asetAktif++;
        if (isRusak) existing.asetRusak++;
        if (isIdle)  existing.asetIdle++;
        if (isRusak || isIdle) existing.asetBermasalah++;
      } else {
        const storeUser = store.users.find(u => u.nama === picNama);
        picMap.set(picNama, {
          id: storeUser?.id || `PIC-${String(picMap.size + 1).padStart(3, "0")}`,
          nama: picNama,
          nip: storeUser?.nip || "",
          jabatan: storeUser?.jabatan || storeUser?.role || "",
          unit: storeUser?.unit || asset.Nama_unit || "",
          kampus: asset.nama_kampus || "Kampus Cilibende",
          email: storeUser?.email || "",
          telp: "",
          totalAset: 1,
          asetAktif: (!isRusak && !isIdle) ? 1 : 0,
          asetRusak: isRusak ? 1 : 0,
          asetIdle:  isIdle  ? 1 : 0,
          asetBermasalah: (isRusak || isIdle) ? 1 : 0,
          status: storeUser ? (storeUser.aktif ? "Aktif" : "Non-Aktif") : "Aktif",
          tanggalMulai: "",
        });
      }
    });
    return Array.from(picMap.values()).sort((a, b) => b.totalAset - a.totalAset);
  }, [store.assets, store.users]);

  // Final data = computed + CRUD overlay
  const data = useMemo<PICRecord[]>(() => {
    const base = computedPICData
      .filter(p => !deletedIds.has(p.id))
      .map(p => localEdits[p.id] ? localEdits[p.id] : p);
    return [...base, ...addedPICs.filter(p => !deletedIds.has(p.id))];
  }, [computedPICData, localEdits, addedPICs, deletedIds]);

  const unitList = useMemo(() => ["Semua Unit", ...Array.from(new Set(data.map(r => r.unit))).sort()], [data]);

  const filtered = useMemo(() => data.filter(r => {
    const q = search.toLowerCase();
    return (
      (r.nama.toLowerCase().includes(q) || r.jabatan.toLowerCase().includes(q) || r.unit.toLowerCase().includes(q) || r.nip.includes(q)) &&
      (filterKampus === "Semua Kampus" || r.kampus === filterKampus) &&
      (filterUnit   === "Semua Unit"   || r.unit   === filterUnit) &&
      (filterStatus === "Semua Status" || r.status  === filterStatus)
    );
  }), [data, search, filterKampus, filterUnit, filterStatus]);

  const toggleSelect = (id: string) =>
    setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleAdd  = () => { setEditRow(undefined); setModalOpen(true); };
  const handleEdit = () => {
    if (selected.size !== 1) return;
    const row = data.find(r => r.id === Array.from(selected)[0]);
    if (row) { setEditRow(row); setModalOpen(true); }
  };
  const handleDelete  = () => { if (selected.size > 0) setShowDeleteConfirm(true); };
  const confirmDelete = () => {
    setDeletedIds(p => { const n = new Set(p); selected.forEach(id => n.add(id)); return n; });
    setSelected(new Set());
    setShowDeleteConfirm(false);
  };
  const handleSave = (form: Partial<PICRecord>) => {
    if (editRow) {
      const isAdded = addedPICs.some(p => p.id === editRow.id);
      if (isAdded) {
        setAddedPICs(p => p.map(r => r.id === editRow.id ? { ...r, ...form } : r));
      } else {
        setLocalEdits(p => ({ ...p, [editRow.id]: { ...editRow, ...form } as PICRecord }));
      }
    } else {
      const newId = `PIC-ADD-${String(addedPICs.length + 1).padStart(3, "0")}`;
      setAddedPICs(p => [...p, {
        id: newId, nama: form.nama ?? "", nip: form.nip ?? "", jabatan: form.jabatan ?? "",
        unit: form.unit ?? "", kampus: form.kampus ?? "Kampus Cilibende",
        email: form.email ?? "", telp: form.telp ?? "",
        totalAset: 0, asetAktif: 0, asetRusak: 0, asetIdle: 0, asetBermasalah: 0,
        status: (form.status as "Aktif" | "Non-Aktif") ?? "Aktif",
        tanggalMulai: new Date().toISOString().slice(0, 10),
      }]);
    }
  };

  // KPI derived values
  const totalAset        = store.assets.length;
  const asetTanpaPIC     = store.computeAssetsWithoutPIC();
  const bermasalahTotal  = data.reduce((a, r) => a + r.asetBermasalah, 0);
  const topPIC           = [...data].sort((a, b) => b.totalAset - a.totalAset)[0];

  // Store-derived riwayat from mutation requests
  const storeRiwayat = useMemo<RiwayatPICRow[]>(
    () => store.mutationRequests.map((m, i) => {
      const asset = store.assets.find(a => a.id === m.asset_id);
      return {
        id: `RWY-ST-${String(i + 1).padStart(3, "0")}`,
        kodeAset: m.asset_id,
        namaAset: asset?.Nama_Barang || m.asset_id,
        picLama: m.dari_pic,
        picBaru: m.ke_pic,
        tanggal: m.tanggal,
        alasan: m.catatan || "Mutasi aset",
        petugas: "Admin Sistem",
      };
    }),
    [store.mutationRequests, store.assets],
  );
  const combinedRiwayat = useMemo<RiwayatPICRow[]>(
    () => [...storeRiwayat].sort((a, b) => b.tanggal.localeCompare(a.tanggal)),
    [storeRiwayat],
  );

  // PIC belum lengkap
  const picBelumLengkap = data.filter(r => r.totalAset === 0 || !r.email || !r.telp);

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 min-w-0">
      {topBar}
      <div className="px-8 py-6 space-y-5">
        <h1 className="text-xl font-bold text-gray-900">Penanggung Jawab Aset</h1>

        {/* KPI cards */}
        <div className="grid grid-cols-5 gap-4">
          <KpiCard label="Total PIC Terdaftar"      value={data.length.toString()}                sub="Dari seluruh kampus"         badge />
          <KpiCard label="Aset Sudah Ada PIC"        value={totalAset.toLocaleString("id")}       sub="Aset terkelola aktif"        badge />
          <KpiCard label="Aset Tanpa PIC"            value={asetTanpaPIC.toLocaleString("id")}    sub="Perlu penugasan PIC"         badge />
          <KpiCard label="PIC Aset Terbanyak"        value={topPIC?.nama.split(" ").slice(0,2).join(" ") ?? "—"} sub={`${topPIC?.totalAset ?? 0} aset dikelola`} />
          <KpiCard label="Aset Bermasalah (Total)"   value={bermasalahTotal.toString()}            sub="Perlu tindak lanjut PIC"    badge />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100 px-2 pt-2 gap-0">
            {TABS.map(t => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-colors border-b-2 -mb-px mr-0.5 ${
                  activeTab === t
                    ? "border-gray-900 text-gray-900 bg-white"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                {t}
                {t === "PIC Belum Lengkap" && picBelumLengkap.length > 0 && (
                  <span className="ml-1.5 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                    {picBelumLengkap.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Tab: Daftar PIC ── */}
          {activeTab === "Daftar PIC" && (
            <>
              {/* Toolbar */}
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2 flex-wrap">
                <button onClick={handleAdd}
                  className="flex items-center gap-1.5 bg-gray-900 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-black transition-colors">
                  <Plus size={13} /> Tambah PIC
                </button>
                <button onClick={handleEdit} disabled={selected.size !== 1}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${selected.size === 1 ? "bg-white border-gray-300 text-gray-700 hover:bg-gray-50" : "bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed"}`}>
                  <Edit2 size={13} /> Edit
                </button>
                <button onClick={handleDelete} disabled={selected.size === 0}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${selected.size > 0 ? "bg-white border-red-300 text-red-600 hover:bg-red-50" : "bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed"}`}>
                  <Trash2 size={13} /> {selected.size > 1 ? `Hapus (${selected.size})` : "Hapus"}
                </button>
                <div className="flex-1" />
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Cari nama, jabatan, NIP..." value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-gray-300 w-52 bg-gray-50" />
                </div>
                <select value={filterKampus} onChange={e => setFilterKampus(e.target.value)} className={SEL_CLS}>
                  {KAMPUS_LIST.map(k => <option key={k}>{k}</option>)}
                </select>
                <select value={filterUnit} onChange={e => setFilterUnit(e.target.value)} className={SEL_CLS}>
                  {unitList.map(u => <option key={u}>{u}</option>)}
                </select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={SEL_CLS}>
                  {["Semua Status", "Aktif", "Non-Aktif"].map(s => <option key={s}>{s}</option>)}
                </select>
                <button
                  onClick={() => exportToExcel(filtered.map(r => ({
                    "ID": r.id, "Nama": r.nama, "NIP": r.nip, "Jabatan": r.jabatan,
                    "Unit": r.unit, "Kampus": r.kampus, "Email": r.email,
                    "Telepon": r.telp, "Status": r.status,
                    "Total Aset": r.totalAset, "Mulai Bertugas": r.tanggalMulai,
                  })), `pic-${new Date().toISOString().slice(0,10)}`, "Data PIC")}
                  className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50">
                  <Download size={13} /> Export
                </button>
              </div>

              {showDeleteConfirm && (
                <div className="px-5 py-3 bg-red-50 border-b border-red-200 flex items-center gap-3">
                  <AlertCircle size={15} className="text-red-500 shrink-0" />
                  <span className="text-sm text-red-700 flex-1">Hapus <strong>{selected.size}</strong> data PIC? Tindakan ini tidak dapat dibatalkan.</span>
                  <button onClick={confirmDelete} className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700">Ya, Hapus</button>
                  <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1.5 border border-red-300 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100">Batal</button>
                </div>
              )}

              {selected.size > 0 && !showDeleteConfirm && (
                <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-gray-600" />
                  <span className="text-xs text-gray-600"><strong>{selected.size}</strong> PIC dipilih</span>
                  <button onClick={() => setSelected(new Set())} className="text-xs text-gray-500 hover:text-gray-700 ml-auto">Batalkan</button>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="px-4 py-3 w-8" />
                      {["Nama PIC", "Unit", "Kontak", "Jml. Aset", "Aset Aktif", "Aset Rusak", "Aset Idle", "Aksi"].map(h => (
                        <th key={h} className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(r => {
                      const isSel = selected.has(r.id);
                      return (
                        <tr key={r.id} onClick={() => toggleSelect(r.id)}
                          className={`cursor-pointer transition-colors ${isSel ? "bg-gray-50 border-l-2 border-l-gray-400" : "hover:bg-gray-50/50"}`}>
                          <td className="px-4 py-3">
                            <input type="checkbox" checked={isSel} onChange={() => toggleSelect(r.id)}
                              onClick={e => e.stopPropagation()} className="accent-gray-700 w-3.5 h-3.5" />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                {initials(r.nama)}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{r.nama}</p>
                                <p className="text-[11px] text-gray-400">{r.jabatan}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-medium text-gray-700">{r.unit}</p>
                            <p className="text-[11px] text-gray-400">{r.kampus}</p>
                          </td>
                          <td className="px-4 py-3">
                            {r.email ? <p className="text-xs text-gray-600">{r.email}</p> : <span className="text-xs text-gray-300">—</span>}
                            {r.telp ? <p className="text-[11px] text-gray-400">{r.telp}</p> : null}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-900">{r.totalAset}</td>
                          <td className="px-4 py-3 text-sm font-medium text-green-700">{r.asetAktif}</td>
                          <td className="px-4 py-3">
                            {r.asetRusak > 0
                              ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border bg-red-50 text-red-700 border-red-200"><AlertCircle size={10} />{r.asetRusak}</span>
                              : <span className="text-xs text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {r.asetIdle > 0
                              ? <span className="text-xs font-semibold text-amber-700">{r.asetIdle}</span>
                              : <span className="text-xs text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => setDrawerPIC(r)}
                              className="flex items-center gap-1 text-xs text-gray-600 border border-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                              Detail <ChevronRight size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr><td colSpan={9} className="py-12 text-center text-sm text-gray-400">Tidak ada PIC yang cocok dengan filter.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">Menampilkan {filtered.length} dari {data.length} PIC</span>
              </div>
            </>
          )}

          {/* ── Tab: PIC Belum Lengkap ── */}
          {activeTab === "PIC Belum Lengkap" && (
            <>
              <div className="px-5 py-4 border-b border-gray-100 bg-amber-50">
                <div className="flex items-start gap-2 text-xs text-amber-800">
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                  <span>PIC di bawah ini belum memiliki aset yang ditugaskan atau data kontak yang lengkap. Segera lakukan verifikasi dan penugasan aset agar pengelolaan aset terdistribusi merata.</span>
                </div>
              </div>
              <div className="px-5 py-3 border-b border-gray-100 flex gap-4">
                {[
                  { label: "Tanpa Aset",          count: data.filter(r => r.totalAset === 0).length,                 color: RED   },
                  { label: "Email Kosong",         count: data.filter(r => !r.email).length,                          color: AMBER },
                  { label: "No. Telepon Kosong",   count: data.filter(r => !r.telp).length,                           color: AMBER },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                    <span className="text-xs text-gray-600">{s.label}:</span>
                    <span className="text-xs font-bold text-gray-900">{s.count}</span>
                  </div>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      {["ID", "Nama PIC", "Jabatan / Unit", "Kampus", "Email", "Telepon", "Jml. Aset", "Masalah"].map(h => (
                        <th key={h} className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {picBelumLengkap.map(r => {
                      const masalah: string[] = [];
                      if (r.totalAset === 0) masalah.push("Tanpa Aset");
                      if (!r.email)           masalah.push("Email Kosong");
                      if (!r.telp)            masalah.push("Telp Kosong");
                      return (
                        <tr key={r.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 text-xs font-mono text-gray-400">{r.id}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-gray-900 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                                {initials(r.nama)}
                              </div>
                              <p className="text-sm font-semibold text-gray-900">{r.nama}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-medium text-gray-700">{r.jabatan}</p>
                            <p className="text-[11px] text-gray-400">{r.unit}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{r.kampus}</td>
                          <td className="px-4 py-3">
                            {r.email ? <span className="text-xs text-gray-600">{r.email}</span> : <SoftBadge label="Kosong" color="amber" />}
                          </td>
                          <td className="px-4 py-3">
                            {r.telp ? <span className="text-xs text-gray-600">{r.telp}</span> : <SoftBadge label="Kosong" color="amber" />}
                          </td>
                          <td className="px-4 py-3">
                            {r.totalAset === 0
                              ? <SoftBadge label="0 aset" color="red" />
                              : <span className="text-sm font-bold text-gray-900">{r.totalAset}</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {masalah.map(m => <SoftBadge key={m} label={m} color="amber" />)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {picBelumLengkap.length === 0 && (
                      <tr><td colSpan={8} className="py-12 text-center text-sm text-gray-400">Semua PIC sudah lengkap datanya.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">{picBelumLengkap.length} PIC memerlukan tindak lanjut</span>
              </div>
            </>
          )}

          {/* ── Tab: Riwayat Penanggung Jawab ── */}
          {activeTab === "Riwayat Penanggung Jawab" && (
            <>
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Cari aset atau PIC..."
                    className="pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-gray-300 w-52 bg-gray-50" />
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-gray-400">{combinedRiwayat.length} riwayat perubahan</span>
                  <button
                    onClick={() => exportToExcel(combinedRiwayat.map(r => ({
                      "Kode Aset": r.kodeAset, "Nama Aset": r.namaAset,
                      "PIC Lama": r.picLama, "PIC Baru": r.picBaru,
                      "Tanggal": r.tanggal, "Alasan": r.alasan, "Petugas": r.petugas,
                    })), `riwayat-pic-${new Date().toISOString().slice(0,10)}`, "Riwayat PIC")}
                    className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50">
                    <Download size={13} /> Export
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      {["No.", "Kode Aset", "Nama Aset", "PIC Lama", "PIC Baru", "Tanggal", "Alasan", "Petugas"].map(h => (
                        <th key={h} className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {combinedRiwayat.map((r, i) => (
                      <tr key={r.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-500">{r.kodeAset}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-800 max-w-[180px]">{r.namaAset}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center text-[9px] font-bold text-white">{r.picLama[0]}</div>
                            <span className="text-xs text-gray-600">{r.picLama}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center text-[9px] font-bold text-white">{r.picBaru[0]}</div>
                            <span className="text-xs font-semibold text-gray-800">{r.picBaru}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{r.tanggal}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px]">{r.alasan}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{r.petugas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">Data riwayat perubahan PIC aset sistem</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modals / Drawers */}
      <PICModal open={modalOpen} onClose={() => setModalOpen(false)} initialData={editRow} onSave={handleSave} />
      {drawerPIC && (
        <PICDrawer
          pic={drawerPIC}
          assets={store.assets.map(a => ({
            kode: a.id,
            nama: a.Nama_Barang || a.id,
            kondisi: (["Baik","Cukup","Rusak Ringan","Rusak Berat"].includes(a.Kondisi ?? "") ? a.Kondisi : "Baik") as "Baik"|"Cukup"|"Rusak Ringan"|"Rusak Berat",
            statusPenggunaan: "Aktif" as "Aktif"|"Idle"|"Dipinjam",
            ruangan: `${a.Nama_ruangan || a.nama_ruangan_standar || "-"}`,
            picId: a.nama_pic || "",
          }))}
          riwayat={combinedRiwayat}
          onClose={() => setDrawerPIC(null)}
          onEdit={() => { setEditRow(drawerPIC); setModalOpen(true); setDrawerPIC(null); }}
        />
      )}
    </main>
  );
}
