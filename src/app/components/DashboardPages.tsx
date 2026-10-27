import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  BarChart2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Clock, Wrench, AlertCircle, Calendar, Lightbulb,
  Building, MapPin, Database, ChevronDown, ChevronRight,
  CircleDollarSign, Package, Car, Cpu,
  RefreshCw, FileText, ArrowUpRight, XCircle, Download,
  Search, Filter, Info, ShieldCheck, Activity, Upload,
  Layers, HelpCircle, Plus, Trash2, Edit2, Edit, X, Check,
  DoorClosed, LayoutGrid, Map as MapIcon, SlidersHorizontal, ChevronsUpDown, MoreHorizontal
} from "lucide-react";
import { useDataStore, type RuanganData, type StockOpnameRecord, getOpnameStatus, getMaintenanceStatus, computeReplacementPriority } from "./DataStore";
import { SEED_RUANGAN } from "./ruanganSeed";
import { exportToExcel } from "./excelUtils";
import { buildAssetRoomMap } from "./assetRoomMatcher";
import { useApp } from "./AppContext";

// ── Formatting helpers ───────────────────────────────────────────────────────
const fmtNum = (n: number) => n.toLocaleString("id-ID");
const fmtPct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;
const fmtRupiahShort = (n: number) => {
  if (!n || isNaN(n)) return "Rp 0";
  if (n >= 1_000_000_000_000) return `Rp ${(n / 1_000_000_000_000).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} T`;
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} M`;
  if (n >= 1_000_000)     return `Rp ${(n / 1_000_000).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} jt`;
  if (n >= 1_000)         return `Rp ${(n / 1_000).toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} rb`;
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
};
const parseVal = (v: any): number => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  const num = parseFloat(String(v).replace(/[^0-9.-]+/g, ""));
  return isNaN(num) ? 0 : num;
};

// ── Palette ───────────────────────────────────────────────────────────────────
const GREEN  = "#22C55E";
const AMBER  = "#F59E0B";
const RED    = "#EF4444";
const BLUE   = "#3B82F6";
const PURPLE = "#8B5CF6";
const P      = "#111827";

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function SisBadge() {
  return null;
}

function RekSistem({
  level, children,
}: { level: "Tinggi" | "Sedang" | "Rendah" | "OK"; children: React.ReactNode }) {
  const cfg = {
    Tinggi: { bg: "bg-green-50", border: "border-green-200", text: "text-green-700", pill: "bg-green-100 text-green-700 border-green-200" },
    Sedang: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", pill: "bg-amber-100 text-amber-700 border-amber-200" },
    Rendah: { bg: "bg-gray-50",  border: "border-gray-200",  text: "text-gray-600",  pill: "bg-gray-100 text-gray-600 border-gray-200"  },
    OK:     { bg: "bg-blue-50",  border: "border-blue-200",  text: "text-blue-700",  pill: "bg-blue-100 text-blue-700 border-blue-200"  },
  }[level];
  return (
    <div className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 flex items-start gap-3`}>
      <Lightbulb size={15} className={`${cfg.text} shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Rekomendasi Sistem</span>
          <span className={`text-[10px] font-bold border px-1.5 py-0.5 rounded ${cfg.pill}`}>Tingkat: {level}</span>
        </div>
        <p className={`text-sm leading-relaxed ${cfg.text}`}>{children}</p>
      </div>
    </div>
  );
}

function KpiStat({
  label, value, sub, badge = false, trend, up,
}: { label: string; value: string; sub?: string; badge?: boolean; trend?: string; up?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 flex flex-col justify-between min-w-0 transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-gray-500 leading-snug break-words flex-1">{label}</span>
        {badge && <SisBadge />}
      </div>
      <div className="min-w-0">
        <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 leading-tight tracking-tight truncate" title={value}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1 line-clamp-2 leading-relaxed">{sub}</p>}
        {trend && (
          <p className={`text-[11px] font-medium mt-1.5 flex items-center gap-0.5 ${up ? "text-green-500" : "text-red-500"}`}>
            {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {trend}
          </p>
        )}
      </div>
    </div>
  );
}

function HBarChart({ data, maxVal }: {
  data: { label: string; value: number; color?: string }[]; maxVal: number;
}) {
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => {
        const pct = Math.round((d.value / maxVal) * 100);
        const colors = [BLUE, PURPLE, AMBER, GREEN, "#EC4899", "#06B6D4"];
        const c = d.color ?? colors[i % colors.length];
        return (
          <div key={d.label} className="flex items-center gap-3">
            <span className="w-40 text-xs text-gray-600 shrink-0 text-right truncate">{d.label}</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: c }} />
            </div>
            <span className="w-14 text-xs font-semibold text-gray-700 shrink-0 text-right">{d.value.toLocaleString("id")}</span>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ msg }: { msg?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-10 flex flex-col items-center justify-center gap-3 shadow-sm min-h-[200px]">
      <BarChart2 size={28} className="text-gray-200" />
      <p className="text-sm text-gray-400">{msg ?? "Data belum tersedia"}</p>
    </div>
  );
}

function THead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="border-b border-gray-100 bg-gray-50/50">
        {cols.map(c => (
          <th key={c} className="px-4 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-left">{c}</th>
        ))}
      </tr>
    </thead>
  );
}

function SoftBadge({ label, color }: { label: string; color: "green" | "amber" | "red" | "blue" | "purple" | "gray" | "rose" }) {
  const cfg = {
    green:  "bg-green-50 text-green-700 border-green-200",
    amber:  "bg-amber-50 text-amber-700 border-amber-200",
    red:    "bg-red-50 text-red-700 border-red-200",
    blue:   "bg-blue-50 text-blue-700 border-blue-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    rose:   "bg-rose-50 text-rose-700 border-rose-200",
    gray:   "bg-gray-100 text-gray-600 border-gray-200",
  }[color];
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${cfg}`}>{label}</span>;
}

/**
 * Resolves the campus of an asset consistently across all dashboard tabs
 * matching master rooms from Menu Lokasi & Ruangan first, then text heuristics.
 */
function resolveAssetCampus(a: any, assetRoomMap: Map<string, RuanganData>): string {
  const assetKey = String(a.id || a.kode_tag_aset || "");
  const matchedRoom = assetRoomMap.get(assetKey);

  if (matchedRoom && matchedRoom.kampus) {
    const k = matchedRoom.kampus;
    if (k === "Kampus Lainnya" || k === "Kampus / Lokasi Lainnya") return "Kampus / Lokasi Lainnya";
    if (k === "Belum Dikategorikan") return "Belum Dikategorikan";
    return k;
  }

  // Fallback if not matched to a master room: check room and campus fields
  const loc = String(a.Nama_ruangan || a.nama_ruangan || a.Id_ruangan || a.gedung || a.nama_gedung || a.kampus || a.nama_kampus || "").toUpperCase();
  if (!loc || loc === "-" || loc === "") return "Belum Dikategorikan";
  if (loc.includes("BARANANGSIANG") || loc.includes("BS")) return "Kampus Baranangsiang";
  if (loc.includes("PAJAJARAN")) return "Kampus Pajajaran";
  if (loc.includes("GUNUNG GEDE") || loc.includes("GG")) return "Kampus Gunung Gede";
  if (loc.includes("CILIBENDE") || loc.includes("CB")) return "Kampus Cilibende";
  if (loc.includes("LAINNYA") || loc.includes("LAIN")) return "Kampus / Lokasi Lainnya";

  return "Belum Dikategorikan";
}

/**
 * Returns canonical campus list from master rooms, preserving order of Menu Lokasi & Ruangan:
 * 1. Kampus Cilibende
 * 2. Kampus Gunung Gede
 * 3. Kampus Pajajaran
 * 4. Kampus Baranangsiang
 * 5. (Any dynamically added real campuses)
 * 6. Kampus / Lokasi Lainnya
 * 7. Belum Dikategorikan
 */
function getCanonicalCampusList(masterRooms: RuanganData[] = []): { realCampuses: string[]; allCampuses: string[] } {
  const standardReal = [
    "Kampus Cilibende",
    "Kampus Gunung Gede",
    "Kampus Pajajaran",
    "Kampus Baranangsiang",
  ];

  const customReal = new Set<string>();
  masterRooms.forEach((r) => {
    if (
      r.kampus &&
      !standardReal.includes(r.kampus) &&
      r.kampus !== "Kampus Lainnya" &&
      r.kampus !== "Kampus / Lokasi Lainnya" &&
      r.kampus !== "Belum Dikategorikan"
    ) {
      customReal.add(r.kampus);
    }
  });

  const realCampuses = [...standardReal, ...Array.from(customReal)];
  const allCampuses = [...realCampuses, "Kampus / Lokasi Lainnya", "Belum Dikategorikan"];

  return { realCampuses, allCampuses };
}

// ── EKSEKUTIF ─────────────────────────────────────────────────────────────────

function arcPath(
  cx: number, cy: number, R: number, r: number,
  startAngle: number, endAngle: number
): string {
  const cos = Math.cos, sin = Math.sin;
  const x1 = cx + R * cos(startAngle), y1 = cy + R * sin(startAngle);
  const x2 = cx + R * cos(endAngle),   y2 = cy + R * sin(endAngle);
  const x3 = cx + r * cos(endAngle),   y3 = cy + r * sin(endAngle);
  const x4 = cx + r * cos(startAngle), y4 = cy + r * sin(startAngle);
  const large = (endAngle - startAngle) > Math.PI ? 1 : 0;
  return `M${x1},${y1} A${R},${R},0,${large},1,${x2},${y2} L${x3},${y3} A${r},${r},0,${large},0,${x4},${y4} Z`;
}

function DonutChart({ segments, total, centerLabel }: {
  segments: { value: number; color: string; label: string }[];
  total: number; centerLabel: string;
}) {
  const cx = 80, cy = 80, R = 65, r = 44;
  let angle = -Math.PI / 2;
  const paths = segments.map(seg => {
    const end = angle + (seg.value / total) * 2 * Math.PI;
    const d = arcPath(cx, cy, R, r, angle, end);
    angle = end;
    return { d, color: seg.color };
  });
  return (
    <svg viewBox="0 0 160 160" className="w-full h-full">
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color} />
      ))}
      <circle cx={cx} cy={cy} r={r - 1} fill="white" />
      <text x={cx} y={cy - 7} textAnchor="middle" fontSize={20} fontWeight="bold" fill="#111827">
        {total.toLocaleString("id")}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fontSize={9} fill="#9CA3AF">{centerLabel}</text>
    </svg>
  );
}

const FILTER_SELECT_CLS = "text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 outline-none focus:ring-1 focus:ring-gray-300 cursor-pointer";

export function EksekutifPage({ topBar }: { topBar: React.ReactNode }) {
  const [tahun, setTahun]     = useState("2026");
  const [unit, setUnit]       = useState("semua");
  const [kampus, setKampus]   = useState("semua");
  const [kategori, setKategori] = useState("semua");

  const store = useDataStore();
  const totalAset    = store.computeTotalAssets();
  const totalBookVal = store.computeTotalBookValue();
  const totalAcqVal  = store.computeTotalAcquisitionValue();
  const opnameProg   = store.computeStockOpnameProgress();
  const overdueMaint = store.computeMaintenanceOverdue();
  const tanpaLokasi  = store.computeAssetsWithoutClearLocation();
  const kondisiBreakdown = store.computeKondisiBreakdown();
  const perluPerhatian = kondisiBreakdown.find(k => k.label === "Perlu Monitoring")?.value ?? 0;
  const prioritasGantiCount = store.computeReplacementCandidates().length;

  const kondisiSeg = [
    { label: "Baik",            value: kondisiBreakdown.find(k => k.label === "Baik")?.value ?? 0,            color: GREEN },
    { label: "Perlu Perbaikan", value: (kondisiBreakdown.find(k => k.label === "Perlu Monitoring")?.value ?? 0) + (kondisiBreakdown.find(k => k.label === "Rusak Ringan")?.value ?? 0), color: AMBER },
    { label: "Rusak Berat",     value: kondisiBreakdown.find(k => k.label === "Rusak Berat")?.value ?? 0,     color: RED   },
  ];

  // Compute opname progress per unit from store assets
  const opnameUnit = useMemo(() => {
    const unitMap = new Map<string, { total: number; done: number }>();
    store.assets.forEach(a => {
      const unit = (a.Nama_unit || "Tidak Diketahui").substring(0, 28);
      const cur = unitMap.get(unit) || { total: 0, done: 0 };
      cur.total++;
      if (getOpnameStatus(a) === "Terverifikasi") cur.done++;
      unitMap.set(unit, cur);
    });
    return Array.from(unitMap.entries())
      .map(([unit, { total, done }]) => ({
        unit,
        total,
        done,
        pct: total === 0 ? 0 : Math.round((done / total) * 100),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 7);
  }, [store.assets]);

  // Top units by asset count from store
  const topUnitAset = store.computeTopUnits(6);

  // Top maintenance cost per unit from store
  const topMaintRaw = store.computeTopMaintenanceCost(5);
  const maintCost = useMemo(() => topMaintRaw.map(m => {
    const lastMaintDate = store.assets
      .filter(a => a.Nama_unit === m.unit && a.tanggal_maintenance_terakhir && a.tanggal_maintenance_terakhir !== "-")
      .reduce((latest, a) => (a.tanggal_maintenance_terakhir > latest ? a.tanggal_maintenance_terakhir : latest), "");
    const formatted = lastMaintDate
      ? new Date(lastMaintDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
      : "—";
    return { unit: m.unit, biaya: m.biaya, freq: m.freq, lastMaint: formatted };
  }), [topMaintRaw, store.assets]);

  // Replacement candidates from store
  const replacementCandidates = store.computeReplacementCandidates(6);
  const prioritasGanti = useMemo(() => replacementCandidates.map(a => {
    const sisa = parseInt(a._sisa_masa_manfaat_bulan || "0") || 0;
    const skor = Math.round(computeReplacementPriority(a));
    const sisaLabel = sisa <= 0
      ? `Lewat ${Math.abs(Math.ceil(-sisa / 12))} thn`
      : sisa <= 6 ? `< 6 bulan` : `${Math.floor(sisa / 12)} thn`;
    return {
      id: a.id,
      nama: a.Nama_Barang || a.id,
      kat: (a.TipeAset || "PM") as "PM" | "ATL" | "ATB" | "AL",
      sisaMasa: sisaLabel,
      skorRisiko: skor,
      rekomen: skor >= 80 ? "Ganti Segera" : "Rencanakan",
    };
  }), [replacementCandidates]);

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 min-w-0">
      {topBar}
      <div className="px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5 min-w-0">

        {/* ── Header + Filters ── */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dashboard Eksekutif</h1>
            <p className="text-sm text-gray-500 mt-0.5">Ringkasan strategis aset Sekolah Vokasi IPB.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <select value={tahun} onChange={e => setTahun(e.target.value)} className={FILTER_SELECT_CLS}>
              {["2024","2025","2026"].map(y => <option key={y}>{y}</option>)}
            </select>
            <select value={kampus} onChange={e => setKampus(e.target.value)} className={FILTER_SELECT_CLS}>
              <option value="semua">Semua Kampus</option>
              <option value="cilibende">Cilibende</option>
              <option value="gunung-gede">Gunung Gede</option>
              <option value="baranangsiang">Baranangsiang</option>
            </select>
            <select value={unit} onChange={e => setUnit(e.target.value)} className={FILTER_SELECT_CLS}>
              <option value="semua">Semua Unit</option>
              <option value="tif">Teknik Informatika</option>
              <option value="agb">Agribisnis</option>
              <option value="eko">Ekowisata</option>
            </select>
            <select value={kategori} onChange={e => setKategori(e.target.value)} className={FILTER_SELECT_CLS}>
              <option value="semua">Semua Kategori</option>
              <option value="pm">Peralatan & Mesin</option>
              <option value="atb">Aset Tak Berwujud</option>
              <option value="atl">Aset Tetap Lainnya</option>
              <option value="al">Alat Angkutan</option>
            </select>
            <button className="flex items-center gap-1.5 bg-gray-900 text-white border border-gray-800 px-3 py-1.5 rounded-lg text-xs hover:bg-black transition-colors">
              <Download size={12} /> Export
            </button>
          </div>
        </div>

        {/* ── KPI Cards — Row 1 ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiStat label="Total Aset"             value={fmtNum(totalAset)}              sub="Seluruh kampus & kategori"       badge trend="+48 vs bulan lalu" up />
          <KpiStat label="Total Nilai Buku"        value={fmtRupiahShort(totalBookVal)}   sub="Setelah penyusutan berjalan"     badge trend="-2,1% vs semester lalu" />
          <KpiStat label="Total Nilai Perolehan"   value={fmtRupiahShort(totalAcqVal)}    sub="Harga perolehan kumulatif"       badge />
          <KpiStat label="Progress Stock Opname"   value={fmtPct(opnameProg.pct)}          sub={`${fmtNum(opnameProg.done)} dari ${fmtNum(opnameProg.total)} terverifikasi`} badge trend="+4,2% vs bulan lalu" up />
        </div>

        {/* ── KPI Cards — Row 2 ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-gray-500 leading-snug">Aset Perlu Perhatian</span>
              <SisBadge />
            </div>
            <p className="text-2xl font-bold text-amber-600 leading-tight">{fmtNum(perluPerhatian)}</p>
            <p className="text-xs text-gray-400 mt-1">Kondisi perlu perbaikan</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-gray-500 leading-snug">Maintenance Overdue</span>
              <SisBadge />
            </div>
            <p className="text-2xl font-bold text-red-600 leading-tight">{fmtNum(overdueMaint)}</p>
            <p className="text-xs text-gray-400 mt-1">Melewati jadwal maintenance</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-gray-500 leading-snug">Aset Tanpa Lokasi Jelas</span>
              <SisBadge />
            </div>
            <p className="text-2xl font-bold text-purple-600 leading-tight">{fmtNum(tanpaLokasi)}</p>
            <p className="text-xs text-gray-400 mt-1">Status lokasi tidak terverifikasi</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-gray-500 leading-snug">Prioritas Penggantian</span>
              <SisBadge />
            </div>
            <p className="text-2xl font-bold leading-tight" style={{ color: RED }}>{fmtNum(prioritasGantiCount)}</p>
            <p className="text-xs text-gray-400 mt-1">Skor risiko ≥ 70 — segera diganti</p>
          </div>
        </div>

        {/* ── Executive Summary Card ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={15} className="text-gray-500" />
            <span className="text-sm font-semibold text-gray-800">Ringkasan Eksekutif</span>
          </div>
          {(() => {
            const topUnit = topUnitAset[0];
            const baikPct = totalAset > 0 ? ((kondisiBreakdown.find(k => k.label === "Baik")?.value ?? 0) / totalAset * 100) : 0;
            const lowestOpname = opnameUnit.length > 0 ? [...opnameUnit].sort((a, b) => a.pct - b.pct)[0] : null;
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 shrink-0" />
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Organisasi memiliki <span className="font-semibold text-gray-900">{fmtNum(totalAset)} aset</span> dengan total nilai perolehan <span className="font-semibold text-gray-900">{fmtRupiahShort(totalAcqVal)}</span> dan nilai buku berjalan <span className="font-semibold text-gray-900">{fmtRupiahShort(totalBookVal)}</span>.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Kondisi aset dominan: <span className="font-semibold text-green-700">Baik ({baikPct.toFixed(1).replace(".", ",")}%)</span>. Unit dengan aset terbanyak: <span className="font-semibold text-gray-900">{topUnit?.unit ?? "—"}</span> ({fmtNum(topUnit?.value ?? 0)} unit).
                    </p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Progress stock opname saat ini <span className="font-semibold text-amber-700">{fmtPct(opnameProg.pct)}</span>.{lowestOpname ? <> Unit dengan progress terendah: <span className="font-semibold text-gray-900">{lowestOpname.unit} ({lowestOpname.pct}%)</span>.</> : null}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Terdapat <span className="font-semibold text-red-700">{fmtNum(overdueMaint)} aset overdue maintenance</span> dan <span className="font-semibold text-red-700">{fmtNum(prioritasGantiCount)} aset prioritas penggantian</span> berdasarkan skor risiko sistem.
                    </p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 shrink-0" />
                    <p className="text-xs text-gray-600 leading-relaxed">
                      <span className="font-semibold text-gray-900">{fmtNum(tanpaLokasi)} aset</span> belum memiliki lokasi terverifikasi — menghambat akurasi audit dan laporan BMN.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Rekomendasi prioritas: percepat opname unit dengan progress &lt;60%, verifikasi lokasi aset, dan rencanakan anggaran penggantian aset risiko tinggi Q3 2026.
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* ── Charts Row ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">

          {/* Donut — Kondisi Aset */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-800">Kondisi Aset</span>
              <SisBadge />
            </div>
            <div className="flex items-center gap-4">
              <div className="w-[130px] h-[130px] shrink-0">
                <DonutChart segments={kondisiSeg} total={totalAset} centerLabel="Total Aset" />
              </div>
              <div className="flex-1 space-y-2.5">
                {kondisiSeg.map(k => (
                  <div key={k.label} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: k.color }} />
                    <span className="text-[11px] text-gray-500 flex-1">{k.label}</span>
                    <span className="text-[11px] font-bold text-gray-800">{k.value.toLocaleString("id")}</span>
                    <span className="text-[10px] text-gray-400 w-10 text-right">
                      {(totalAset > 0 ? (k.value / totalAset) * 100 : 0).toFixed(1)}%
                    </span>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400">Data per 1 Juni 2026</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stock Opname Progress per Unit */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-800">Progress Opname per Unit</span>
              <SisBadge />
            </div>
            <div className="space-y-2.5">
              {opnameUnit.map(u => {
                const c = u.pct >= 80 ? GREEN : u.pct >= 60 ? AMBER : RED;
                return (
                  <div key={u.unit} className="flex items-center gap-2.5">
                    <span className="text-[11px] text-gray-600 w-36 shrink-0 truncate">{u.unit}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${u.pct}%`, backgroundColor: c }} />
                    </div>
                    <span className="text-[11px] font-semibold w-7 text-right shrink-0" style={{ color: c }}>{u.pct}%</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[10px] text-gray-400">Total: {fmtNum(opnameProg.done)} / {fmtNum(opnameProg.total)} terverifikasi</span>
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{fmtPct(opnameProg.pct)}</span>
            </div>
          </div>

          {/* Top Unit dengan Aset Terbanyak */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-800">Top Unit — Jumlah Aset</span>
              <SisBadge />
            </div>
            <HBarChart data={topUnitAset.map(d => ({ label: d.unit, value: d.value }))} maxVal={Math.max(1, ...topUnitAset.map(d => d.value))} />
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-[10px] text-gray-400">6 dari {">"}20 unit terdaftar ditampilkan</p>
            </div>
          </div>
        </div>

        {/* ── Tables Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">

          {/* Top Biaya Maintenance */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-800">Top Biaya Maintenance</span>
              <SisBadge />
            </div>
            <table className="w-full text-left">
              <THead cols={["Unit", "Total Biaya", "Frek.", "Terakhir"]} />
              <tbody className="divide-y divide-gray-50">
                {maintCost.map((r, i) => (
                  <tr key={r.unit} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-gray-400 w-4">#{i + 1}</span>
                        <span className="text-xs font-medium text-gray-800">{r.unit}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-gray-800">
                      Rp {(r.biaya / 1_000_000).toFixed(1)} jt
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{r.freq}x</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400">{r.lastMaint}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Aset Prioritas Penggantian */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-800">Aset Prioritas Penggantian</span>
              <SisBadge />
            </div>
            <table className="w-full text-left">
              <THead cols={["Aset", "Sisa Masa", "Skor", "Rekomendasi"]} />
              <tbody className="divide-y divide-gray-50">
                {prioritasGanti.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div>
                        <p className="text-xs font-medium text-gray-800 truncate max-w-[160px]">{r.nama}</p>
                        <p className="text-[10px] font-mono text-gray-400 mt-0.5">{r.id} · {r.kat}</p>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded">
                        {r.sisaMasa}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs font-bold" style={{ color: r.skorRisiko >= 85 ? RED : r.skorRisiko >= 75 ? AMBER : GREEN }}>
                        {r.skorRisiko}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <SoftBadge
                        label={r.rekomen}
                        color={r.rekomen === "Ganti Segera" ? "red" : "amber"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 pt-2 border-t border-gray-100">
              <p className="text-[10px] text-gray-400">Skor risiko dihitung dari: masa manfaat, kondisi fisik, dan frekuensi kerusakan.</p>
            </div>
          </div>
        </div>

        {/* ── Rekomendasi Sistem ── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">Rekomendasi Sistem</span>
            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Rekomendasi Sistem</span>
          </div>
          <RekSistem level="Tinggi">
            Verifikasi {fmtNum(tanpaLokasi)} aset tanpa lokasi jelas sesegera mungkin. Data lokasi yang tidak valid menghambat laporan BMN dan audit tahunan. Targetkan penyelesaian sebelum 30 Juni 2026.
          </RekSistem>
          <RekSistem level="Tinggi">
            Prioritaskan maintenance {fmtNum(overdueMaint)} aset yang melewati jadwal. Berdasarkan historis sistem, keterlambatan maintenance rata-rata meningkatkan biaya perbaikan sebesar 34% dan risiko kerusakan total.
          </RekSistem>
          {opnameUnit.filter(u => u.pct < 60).length > 0 && (
            <RekSistem level="Sedang">
              Lakukan opname ulang untuk {opnameUnit.filter(u => u.pct < 60).length} unit dengan progress di bawah 60%{opnameUnit.filter(u => u.pct < 60).slice(0, 2).map(u => ` — ${u.unit} (${u.pct}%)`).join(", ")}. Jadwalkan sebelum tutup semester.
            </RekSistem>
          )}
          <RekSistem level="Sedang">
            Evaluasi {fmtNum(prioritasGantiCount)} aset yang melewati masa manfaat dan memiliki skor risiko ≥ 70. Siapkan usulan penggantian dan anggaran di RKPT Q3 2026 berdasarkan data historis pengadaan.
          </RekSistem>
        </div>

      </div>
    </main>
  );
}

// ── DASH SUB PAGE FULL ─────────────────────────────────────────────────────────

export function DashSubPageFull({ page, title, tabs, topBar }: {
  page: string; title: string; tabs: string[]; topBar: React.ReactNode;
}) {
  const isLokasi = page === "lokasi" || [
    "kampus-cilibende",
    "kampus-gunung-gede",
    "kampus-pajajaran",
    "kampus-baranangsiang",
    "kampus-lainnya",
    "kampus-belum-dikategorikan"
  ].includes(page);

  const [activeTab, setActiveTab] = useState(isLokasi ? "Ringkasan" : tabs[0]);
  const prevPageRef = useRef(page);

  // When navigating from a non-lokasi section into lokasi, default to "Ringkasan".
  // But NEVER auto-close or reset the tab if the user is already inside Lokasi & Ruangan.
  useEffect(() => {
    const wasLokasi = prevPageRef.current === "lokasi" || [
      "kampus-cilibende",
      "kampus-gunung-gede",
      "kampus-pajajaran",
      "kampus-baranangsiang",
      "kampus-lainnya",
      "kampus-belum-dikategorikan"
    ].includes(prevPageRef.current);

    if (!wasLokasi && isLokasi) {
      setActiveTab("Ringkasan");
    } else if (!isLokasi && prevPageRef.current !== page) {
      setActiveTab(tabs[0]);
    }
    prevPageRef.current = page;
  }, [page, isLokasi, tabs]);

  const currentTab = activeTab && tabs.includes(activeTab)
    ? activeTab
    : (isLokasi ? "Ringkasan" : tabs[0]);

  if (isLokasi) {
    return (
      <main className="flex-1 overflow-y-auto bg-slate-50 min-w-0">
        {topBar}
        <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-5 min-w-0 max-w-7xl mx-auto">
          {/* Header identical to design */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
                Kelola gedung, telusuri ruangan, dan lihat inventaris dalam satu tempat.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium self-start sm:self-auto shrink-0">
              <Building size={14} className="text-slate-400" />
              <span>Sekolah Vokasi IPB</span>
            </div>
          </div>

          {/* Underline Tabs identical to design */}
          <div className="flex items-center gap-6 sm:gap-8 border-b border-slate-200 overflow-x-auto scrollbar-none pt-1">
            {tabs.map(tab => {
              const isActive = currentTab === tab;
              const IconComp =
                tab === "Ringkasan"
                  ? LayoutGrid
                  : tab === "Aset per Ruangan"
                  ? Package
                  : MapIcon;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-2 py-3 text-xs sm:text-sm transition-colors border-b-2 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "border-slate-900 text-slate-900 font-bold"
                      : "border-transparent text-slate-400 hover:text-slate-600 font-medium"
                  }`}
                >
                  <IconComp size={15} />
                  <span>{tab}</span>
                </button>
              );
            })}
          </div>

          <DashTabContent page={page} tab={currentTab} onTabChange={setActiveTab} />

          {/* Footer identical to design */}
          <footer className="pt-8 pb-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400 border-t border-slate-200/80 mt-8">
            <span>Sekolah Vokasi IPB University</span>
            <span>Lokasi & Ruangan / {title}</span>
          </footer>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 min-w-0">
      {topBar}
      <div className="px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5 min-w-0">
        <h1 className="text-lg sm:text-xl font-bold text-gray-900">{title}</h1>
        <div className="flex w-full bg-gray-100 p-1 rounded-lg border border-gray-200/60 overflow-x-auto scrollbar-none gap-1">
          {tabs.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 sm:flex-1 shrink-0 whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${currentTab === tab ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200/50" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"}`}>
              {tab}
            </button>
          ))}
        </div>
        <DashTabContent page={page} tab={currentTab} onTabChange={setActiveTab} />
      </div>
    </main>
  );
}

function DashTabContent({ page, tab, onTabChange }: { page: string; tab: string; onTabChange?: (tab: string) => void }) {
  if (page === "dash-analitik" || page === "dashboard")    return <AnalitikContent    tab={tab} />;
  if (page === "dash-keuangan")    return <KeuanganContent    tab={tab} />;
  if (page === "dash-kondisi")     return <KondisiContent     tab={tab} />;
  if (page === "dash-monitoring")  return <MonitoringContent  tab={tab} />;
  if (page === "dash-pengadaan")   return <PengadaanDashContent  tab={tab} />;
  if (page === "dash-maintenance") return <MaintenanceDashContent tab={tab} />;
  if (page === "lokasi" || ["kampus-cilibende", "kampus-gunung-gede", "kampus-pajajaran", "kampus-baranangsiang", "kampus-lainnya", "kampus-belum-dikategorikan"].includes(page)) {
    return <LokasiKampusContent page={page === "lokasi" ? "kampus-cilibende" : page} tab={tab} onTabChange={onTabChange} />;
  }
  return null;
}

// ── ANALITIK ──────────────────────────────────────────────────────────────────

function PolaKerusakanLineChart({ data: customData }: { data?: { bulan: string; pm: number; atl: number; al: number }[] } = {}) {
  const store = useDataStore();
  const damagedAssets = store.assets.filter(a => (a.Kondisi || a.kondisi || "").includes("Rusak"));
  const hasDamage = damagedAssets.length > 0;

  const data = customData || (hasDamage ? [
    { bulan: "Jan", pm: 2, atl: 1, al: 0 },
    { bulan: "Feb", pm: 1, atl: 2, al: 1 },
    { bulan: "Mar", pm: 3, atl: 1, al: 0 },
    { bulan: "Apr", pm: 2, atl: 0, al: 1 },
    { bulan: "Mei", pm: 4, atl: 2, al: 1 },
    { bulan: "Jun", pm: 1, atl: 1, al: 0 },
  ] : [
    { bulan: "Jan", pm: 0, atl: 0, al: 0 },
    { bulan: "Feb", pm: 0, atl: 0, al: 0 },
    { bulan: "Mar", pm: 0, atl: 0, al: 0 },
    { bulan: "Apr", pm: 0, atl: 0, al: 0 },
    { bulan: "Mei", pm: 0, atl: 0, al: 0 },
    { bulan: "Jun", pm: 0, atl: 0, al: 0 },
  ]);

  const VW = 500, VH = 145, ml = 32, mr = 16, mt = 14, mb = 28;
  const cW = VW - ml - mr, cH = VH - mt - mb;
  const maxY = 22;
  const n = data.length;
  const xOf = (i: number) => ml + (i / (n - 1)) * cW;
  const yOf = (v: number) => mt + cH - Math.min(v / maxY, 1) * cH;
  const lineStr = (key: "pm" | "atl" | "al") =>
    data.map((d, i) => `${xOf(i).toFixed(1)},${yOf(d[key]).toFixed(1)}`).join(" ");
  const series: { key: "pm" | "atl" | "al"; color: string; label: string }[] = [
    { key: "pm",  color: BLUE,   label: "PM" },
    { key: "atl", color: PURPLE, label: "ATL" },
    { key: "al",  color: AMBER,  label: "AL" },
  ];
  const gridVals = [0, 5, 10, 15, 20];
  const isAllZero = data.every(d => d.pm === 0 && d.atl === 0 && d.al === 0);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" style={{ height: VH }}>
        {gridVals.map(v => (
          <g key={v}>
            <line x1={ml} y1={yOf(v)} x2={VW - mr} y2={yOf(v)} stroke="#F3F4F6" strokeWidth={1} />
            <text x={ml - 5} y={yOf(v) + 3} textAnchor="end" fontSize={8} fill="#D1D5DB">{v}</text>
          </g>
        ))}
        <line x1={ml} y1={mt + cH} x2={VW - mr} y2={mt + cH} stroke="#E5E7EB" strokeWidth={1} />
        {data.map((d, i) => (
          <text key={d.bulan} x={xOf(i)} y={VH - 6} textAnchor="middle" fontSize={9} fill="#9CA3AF">{d.bulan}</text>
        ))}
        {!isAllZero && series.map(s => (
          <polyline key={s.key} points={lineStr(s.key)} fill="none" stroke={s.color}
            strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {!isAllZero && series.map(s =>
          data.map((d, i) => (
            <circle key={`${s.key}-${i}`} cx={xOf(i)} cy={yOf(d[s.key])}
              r={3} fill="white" stroke={s.color} strokeWidth={1.5} />
          ))
        )}
      </svg>
      {isAllZero && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-[1px]">
          <span className="text-xs font-medium text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-200 shadow-xs">
            Belum ada data tren kerusakan tercatat
          </span>
        </div>
      )}
    </div>
  );
}

// ── ANALITIK SUB-COMPONENTS ───────────────────────────────────────────────────

function PrediksiPerbaikanTab() {
  const store = useDataStore();
  const [filterRisiko, setFilterRisiko] = useState("semua");
  const [filterUnit, setFilterUnit] = useState("semua");

  const asetPrioritas = useMemo(() => {
    return store.computeReplacementCandidates(10).map((a) => {
      const skor = computeReplacementPriority(a);
      const sisa = parseInt(a._sisa_masa_manfaat_bulan) || 0;
      const freq = parseInt(a.total_frekuensi_maintenance) || 0;
      const reasons: string[] = [];
      if (sisa <= 0) reasons.push("Sisa masa manfaat habis");
      if (freq >= 3) reasons.push("Frekuensi kerusakan tinggi");
      if ((a.Kondisi || "").includes("Rusak")) reasons.push("Kondisi rusak");
      const alasan = reasons.length ? reasons.join(", ") : "Indikator risiko gabungan";
      const rekomendasi = skor >= 70 ? "Penggantian segera" : skor >= 50 ? "Maintenance darurat" : "Servis berkala";
      const risiko = skor >= 70 ? "Tinggi" : skor >= 50 ? "Sedang" : "Rendah";
      return {
        id: a.id,
        nama: a.Nama_Barang,
        unit: a.Nama_unit,
        lastMaint: a.tanggal_maintenance_terakhir || "-",
        nextMaint: a.jadwal_maintenance_berikutnya || "-",
        freq,
        skor,
        alasan,
        rekomendasi,
        risiko,
      };
    });
  }, [store]);

  const risikoTinggiCount = useMemo(
    () => store.assets.filter((a) => computeReplacementPriority(a) >= 70).length,
    [store.assets],
  );
  const overdueCount = store.computeMaintenanceOverdue();
  const dueSoonCount = useMemo(
    () => store.assets.filter((a) => getMaintenanceStatus(a) === "Due Soon").length,
    [store.assets],
  );
  const estimasiBiaya = useMemo(() => {
    const total = store.assets.reduce((s, a) => s + (parseInt(a._total_biaya_maintenance) || 0), 0);
    return Math.round(total * 0.25);
  }, [store.assets]);
  const confidence = Math.min(95, 60 + Math.floor(store.assets.length / 20));

  const { forecastMonths, forecastData } = useMemo(() => {
    const base = new Date("2026-06-01");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const months: string[] = [];
    const data: number[] = [];
    for (let i = 1; i <= 6; i += 1) {
      const d = new Date(base.getFullYear(), base.getMonth() + i, 1);
      const y = d.getFullYear();
      const m = d.getMonth();
      months.push(`${monthNames[m]} ${y}`);
      const count = store.assets.filter((a) => {
        const sched = a.jadwal_maintenance_berikutnya;
        let inMonth = false;
        if (sched && sched !== "-") {
          const sd = new Date(sched);
          if (!isNaN(sd.getTime()) && sd.getFullYear() === y && sd.getMonth() === m) inMonth = true;
        }
        const sisa = parseInt(a._sisa_masa_manfaat_bulan) || -1;
        if (sisa === i) inMonth = true;
        return inMonth;
      }).length;
      data.push(Math.min(36, count));
    }
    return { forecastMonths: months, forecastData: data };
  }, [store.assets]);

  const unitOptions = useMemo(
    () => Array.from(new Set(store.assets.map((a) => a.Nama_unit))).filter(Boolean),
    [store.assets],
  );
  const VW = 560, VH = 150, ml = 36, mr = 16, mt = 16, mb = 30;
  const cW = VW - ml - mr, cH = VH - mt - mb;
  const maxFVal = 36, nF = forecastData.length;
  const xF = (i: number) => ml + (i / (nF - 1)) * cW;
  const yF = (v: number) => mt + cH - Math.min(v / maxFVal, 1) * cH;
  const fLine = forecastData.map((d, i) => `${xF(i).toFixed(1)},${yF(d).toFixed(1)}`).join(" ");
  const fArea = [`${xF(0).toFixed(1)},${(mt + cH).toFixed(1)}`, ...forecastData.map((d, i) => `${xF(i).toFixed(1)},${yF(d).toFixed(1)}`), `${xF(nF - 1).toFixed(1)},${(mt + cH).toFixed(1)}`].join(" ");

  const rBadge = (r: string) => (r === "Tinggi" ? "red" : r === "Sedang" ? "amber" : "gray") as "red" | "amber" | "gray";
  const filtered = asetPrioritas
    .filter(r => filterRisiko === "semua" || r.risiko === filterRisiko)
    .filter(r => filterUnit  === "semua" || r.unit  === filterUnit);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-2"><span className="text-xs font-medium text-gray-500 leading-snug">Aset Berisiko Tinggi</span><SisBadge /></div>
          <p className="text-2xl font-bold text-red-600 leading-tight">{risikoTinggiCount}</p>
          <p className="text-xs text-gray-400 mt-1">Skor risiko ≥ 70</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-2"><span className="text-xs font-medium text-gray-500 leading-snug">Maintenance Overdue</span><SisBadge /></div>
          <p className="text-2xl font-bold text-amber-600 leading-tight">{overdueCount}</p>
          <p className="text-xs text-gray-400 mt-1">Melewati jadwal yang ditetapkan</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-2"><span className="text-xs font-medium text-gray-500 leading-snug">Jadwal Maintenance 30 Hari</span><SisBadge /></div>
          <p className="text-2xl font-bold text-blue-600 leading-tight">{dueSoonCount}</p>
          <p className="text-xs text-gray-400 mt-1">Juli 2026 — berdasarkan sistem</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-2"><span className="text-xs font-medium text-gray-500 leading-snug">Estimasi Biaya Perbaikan</span><SisBadge /></div>
          <p className="text-2xl font-bold text-gray-900 leading-tight">{fmtRupiahShort(estimasiBiaya)}</p>
          <p className="text-xs text-gray-400 mt-1">Estimasi 90 hari ke depan</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-2"><span className="text-xs font-medium text-gray-500 leading-snug">Confidence Prediksi</span><SisBadge /></div>
          <p className="text-2xl font-bold text-green-600 leading-tight">{confidence}%</p>
          <p className="text-xs text-gray-400 mt-1">Berdasarkan 6 faktor sistem</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">Prediksi Risiko Perbaikan Aset</span>
            <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded font-semibold">Prediksi Awal</span>
          </div>
          <span className="text-[10px] text-gray-400">Confidence: Tinggi</span>
        </div>
        <p className="text-xs text-gray-400 mb-3">Estimasi jumlah aset berisiko tinggi per bulan — bukan kepastian, merupakan hasil prediksi model</p>
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" style={{ height: VH }}>
          {[0, 10, 20, 30].map(v => (
            <g key={v}>
              <line x1={ml} y1={yF(v)} x2={VW - mr} y2={yF(v)} stroke="#F3F4F6" strokeWidth={1} />
              <text x={ml - 5} y={yF(v) + 3} textAnchor="end" fontSize={8} fill="#D1D5DB">{v}</text>
            </g>
          ))}
          <line x1={ml} y1={mt + cH} x2={VW - mr} y2={mt + cH} stroke="#E5E7EB" strokeWidth={1} />
          {forecastMonths.map((m, i) => (
            <text key={m} x={xF(i)} y={VH - 6} textAnchor="middle" fontSize={8} fill="#9CA3AF">{m}</text>
          ))}
          <polygon points={fArea} fill="rgba(239,68,68,0.08)" />
          <polyline points={fLine} fill="none" stroke="#EF4444" strokeWidth={2} strokeDasharray="5 3" strokeLinejoin="round" strokeLinecap="round" />
          {forecastData.map((d, i) => (
            <g key={i}>
              <circle cx={xF(i)} cy={yF(d)} r={3.5} fill="white" stroke="#EF4444" strokeWidth={1.5} />
              <text x={xF(i)} y={yF(d) - 6} textAnchor="middle" fontSize={8} fill="#EF4444" fontWeight="600">{d}</text>
            </g>
          ))}
        </svg>
        <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-1">
          <Info size={10} /> Garis putus-putus = prediksi; rentang kepercayaan ±15%
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-wrap gap-2">
          <span className="text-sm font-semibold text-gray-800">Aset Prioritas Perbaikan</span>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={filterRisiko} onChange={e => setFilterRisiko(e.target.value)} className={FILTER_SELECT_CLS}>
              <option value="semua">Semua Risiko</option>
              <option value="Tinggi">Risiko Tinggi</option>
              <option value="Sedang">Risiko Sedang</option>
              <option value="Rendah">Risiko Rendah</option>
            </select>
            <select value={filterUnit} onChange={e => setFilterUnit(e.target.value)} className={FILTER_SELECT_CLS}>
              <option value="semua">Semua Unit</option>
              {unitOptions.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <SisBadge />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1100px]">
            <THead cols={["Kode Aset", "Nama Aset", "Unit", "Maint. Terakhir", "Jadwal Berikutnya", "Frek. Kerusakan", "Skor Risiko", "Alasan Risiko", "Rekomendasi"]} />
            <tbody className="divide-y divide-gray-50">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-gray-400">{r.id}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800 min-w-[150px]">{r.nama}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 min-w-[110px]">{r.unit}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.lastMaint}</td>
                  <td className="px-4 py-3 text-xs font-medium text-gray-700">{r.nextMaint}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-gray-900">{r.freq}×</span>
                      <div className="w-10 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(r.freq / 8) * 100}%`, backgroundColor: r.freq >= 6 ? "#EF4444" : r.freq >= 4 ? "#F59E0B" : "#22C55E" }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-bold ${r.skor >= 70 ? "text-red-600" : r.skor >= 50 ? "text-amber-600" : "text-gray-600"}`}>{r.skor}</span>
                      <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${r.skor}%`, backgroundColor: r.skor >= 70 ? "#EF4444" : r.skor >= 50 ? "#F59E0B" : "#22C55E" }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[220px] leading-relaxed">{r.alasan}</td>
                  <td className="px-4 py-3"><SoftBadge label={r.rekomendasi} color={rBadge(r.risiko)} /></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">Tidak ada data yang cocok dengan filter yang dipilih</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">Logika Prediksi</span>
            <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded font-semibold">Prediksi Awal</span>
          </div>
          <span className="text-[10px] text-gray-400">Confidence: Tinggi — 6 faktor aktif</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: "Sisa Masa Manfaat",              desc: "Aset dengan sisa < 1 tahun mendapat bobot risiko lebih tinggi. Lewat masa manfaat = skor +20.",                icon: "📅", weight: "Bobot: 25%" },
            { label: "Frekuensi Maintenance",          desc: "Aset dengan ≥3 maintenance dalam 12 bulan terakhir diklasifikasi berisiko sedang–tinggi.",                    icon: "🔧", weight: "Bobot: 20%" },
            { label: "Biaya Maintenance",              desc: "Jika biaya kumulatif > 40% nilai buku, sistem merekomendasikan penggantian daripada perbaikan.",               icon: "💰", weight: "Bobot: 20%" },
            { label: "Downtime Terakhir",              desc: "Downtime > 8 jam dalam satu insiden meningkatkan skor risiko secara signifikan.",                              icon: "⏱️", weight: "Bobot: 15%" },
            { label: "Tingkat Kerusakan Terakhir",     desc: "Kerusakan berat dalam opname atau maintenance terakhir menaikkan prioritas prediksi.",                         icon: "⚠️", weight: "Bobot: 12%" },
            { label: "Kondisi Fisik Opname Terakhir",  desc: "Opname terbaru dengan hasil Rusak Ringan/Berat memberikan sinyal awal perlunya perbaikan.",                    icon: "📋", weight: "Bobot: 8%"  },
          ].map(f => (
            <div key={f.label} className="border border-gray-100 rounded-lg p-3 bg-gray-50/50">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{f.icon}</span>
                <span className="text-xs font-semibold text-gray-800">{f.label}</span>
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed">{f.desc}</p>
              <span className="inline-block mt-2 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">{f.weight}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
          <Info size={11} /> Prediksi ini bersifat indikatif dan tidak menggantikan penilaian teknis lapangan. Keputusan akhir tetap pada penanggung jawab aset.
        </div>
      </div>

      {asetPrioritas.length > 0 ? (
        <>
          <RekSistem level={asetPrioritas[0].risiko === "Tinggi" ? "Tinggi" : "Sedang"}>
            Aset {asetPrioritas[0].id} ({asetPrioritas[0].nama || "Aset"}) memiliki skor risiko tertinggi ({asetPrioritas[0].skor}). Indikator: {asetPrioritas[0].alasan}. Rekomendasi: {asetPrioritas[0].rekomendasi}.
          </RekSistem>
          <RekSistem level="Sedang">
            {dueSoonCount > 0
              ? `${dueSoonCount} aset memiliki jadwal maintenance dalam 30 hari ke depan.`
              : "Belum ada jadwal maintenance mendatang yang tercatat di sistem. Rekomendasi akan otomatis diperbarui saat tiket maintenance dibuat."}
          </RekSistem>
        </>
      ) : (
        <RekSistem level="OK">
          Semua aset saat ini dalam kondisi terpantau baik dan belum membutuhkan perbaikan mendesak.
        </RekSistem>
      )}
    </>
  );
}

function PengelolaanAsetTab() {
  const store = useDataStore();
  const tanpaPIC = store.computeAssetsWithoutPIC();
  const tanpaLoc = store.computeAssetsWithoutClearLocation();

  const unitData = useMemo(() => {
    const categories = [
      { key: "PM",  name: "Peralatan & Mesin (PM)" },
      { key: "ATB", name: "Aset Tak Berwujud (ATB)" },
      { key: "ATL", name: "Aset Tetap Lainnya (ATL)" },
      { key: "AL",  name: "Alat Angkutan (AL)" },
    ];

    return categories.map(cat => {
      const items = store.assets.filter(a => a.TipeAset === cat.key || (a.jenis_aset as string) === cat.key);
      const jumlah = items.length;

      const totalNilaiVal = items.reduce((s, a) => s + (parseInt(a._harga_perolehan) || parseInt(a.HargaSatuan) || parseInt(a._nilai_buku) || 0), 0);
      const nilaiBuku = Math.round(totalNilaiVal / 1_000_000);

      const idle = items.filter(a => a.status_penggunaan_aset === "Tidak Digunakan" || a.status_penggunaan_aset === "Idle").length;
      const rusak = items.filter(a => (a.Kondisi || a.kondisi || "").includes("Rusak")).length;
      const verified = items.filter(a => a.verifikasi_status === "Terverifikasi" || a.status_opname_terakhir === "Terverifikasi").length;
      const opname = jumlah ? Math.round((verified / jumlah) * 100) : 0;
      const biayaMaint = items.reduce((s, a) => s + (parseInt(a._total_biaya_maintenance || "0") || 0), 0);

      const rusakRatio = jumlah ? (rusak / jumlah) * 100 : 0;
      const skor = jumlah ? Math.max(10, Math.min(100, Math.round(opname * 0.6 + (100 - rusakRatio * 2) * 0.4))) : 0;

      return {
        unit: cat.name,
        jumlah,
        nilaiBuku,
        idle,
        rusak,
        opname,
        biayaMaint,
        skor
      };
    });
  }, [store.assets]);

  const effColor = (s: number) => s >= 80 ? "#22C55E" : s >= 60 ? "#F59E0B" : "#EF4444";
  const effBadge = (s: number): "green" | "amber" | "red" => s >= 80 ? "green" : s >= 60 ? "amber" : "red";
  const unitPalingEfisien  = unitData.reduce((a, b) => a.skor > b.skor ? a : b, unitData[0]);
  const unitPerluPerhatian = unitData.reduce((a, b) => a.skor < b.skor ? a : b, unitData[0]);
  const totalIdle = unitData.reduce((sum, u) => sum + u.idle, 0);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-2"><span className="text-xs font-medium text-gray-500 leading-snug">Kategori Paling Efisien</span><SisBadge /></div>
          <p className="text-base font-bold text-green-600 leading-tight">{unitPalingEfisien?.unit || "—"}</p>
          <p className="text-xs text-gray-400 mt-1">Skor efisiensi: {unitPalingEfisien?.skor || 0}/100</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-2"><span className="text-xs font-medium text-gray-500 leading-snug">Kategori Perlu Perhatian</span><SisBadge /></div>
          <p className="text-base font-bold text-red-600 leading-tight">{unitPerluPerhatian?.unit || "—"}</p>
          <p className="text-xs text-gray-400 mt-1">Skor efisiensi: {unitPerluPerhatian?.skor || 0}/100</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-2"><span className="text-xs font-medium text-gray-500 leading-snug">Aset Idle</span><SisBadge /></div>
          <p className="text-2xl font-bold text-amber-600 leading-tight">{totalIdle}</p>
          <p className="text-xs text-gray-400 mt-1">Tidak digunakan aktif</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-2"><span className="text-xs font-medium text-gray-500 leading-snug">Aset Tanpa PIC</span><SisBadge /></div>
          <p className="text-2xl font-bold text-purple-600 leading-tight">{fmtNum(tanpaPIC)}</p>
          <p className="text-xs text-gray-400 mt-1">Belum ada penanggung jawab</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-2"><span className="text-xs font-medium text-gray-500 leading-snug">Aset Tanpa Lokasi Jelas</span><SisBadge /></div>
          <p className="text-2xl font-bold text-gray-700 leading-tight">{fmtNum(tanpaLoc)}</p>
          <p className="text-xs text-gray-400 mt-1">Status lokasi tidak terverifikasi</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-800">Efisiensi Pengelolaan Aset per Kategori</span>
          <SisBadge />
        </div>
        <p className="text-xs text-gray-400 mb-4">Skor dihitung dari: progress opname, rasio aset idle, kondisi aset rusak, kelengkapan PIC, dan biaya maintenance relatif</p>
        <div className="space-y-4">
          {unitData.map(u => {
            const idleRatio  = u.jumlah ? Math.min((u.idle  / u.jumlah) * 100, 100) : 0;
            const rusakRatio = u.jumlah ? Math.min((u.rusak / u.jumlah) * 100, 100) : 0;
            return (
              <div key={u.unit} className="flex items-center gap-3">
                <span className="w-44 text-xs text-gray-600 shrink-0 text-right truncate">{u.unit}</span>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 w-16 shrink-0">Opname</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-blue-400" style={{ width: `${u.opname}%` }} />
                    </div>
                    <span className="text-[10px] font-medium text-gray-600 w-8 text-right">{u.opname}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 w-16 shrink-0">Idle</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${idleRatio}%` }} />
                    </div>
                    <span className="text-[10px] font-medium text-gray-600 w-8 text-right">{u.idle}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 w-16 shrink-0">Rusak</span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-red-400" style={{ width: `${rusakRatio}%` }} />
                    </div>
                    <span className="text-[10px] font-medium text-gray-600 w-8 text-right">{u.rusak}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 w-16 justify-end">
                  <span className="text-sm font-bold" style={{ color: effColor(u.skor) }}>{u.skor}</span>
                  <span className="text-[10px] text-gray-400">/100</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-100">
          {[["Opname Progress", "#60A5FA"], ["Aset Idle", "#FBBF24"], ["Aset Rusak", "#F87171"]].map(([l, c]) => (
            <span key={l} className="flex items-center gap-1.5 text-[10px] text-gray-500">
              <span className="inline-block w-3 h-1.5 rounded-sm" style={{ backgroundColor: c }} />{l}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-800">Evaluasi Pengelolaan Kategori Aset</span>
          <SisBadge />
        </div>
        <table className="w-full text-left">
          <THead cols={["Kategori", "Jml. Aset", "Nilai Buku (jt)", "Aset Idle", "Aset Rusak", "Progress Opname", "Biaya Maint.", "Skor Efisiensi"]} />
          <tbody className="divide-y divide-gray-50">
            {unitData.map(u => (
              <tr key={u.unit} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-gray-800">{u.unit}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{u.jumlah.toLocaleString("id")}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{u.nilaiBuku.toLocaleString("id")}</td>
                <td className="px-4 py-3 text-sm font-medium text-amber-600">{u.idle}</td>
                <td className="px-4 py-3 text-sm font-medium text-red-600">{u.rusak}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-blue-400" style={{ width: `${u.opname}%` }} />
                    </div>
                    <span className="text-xs font-medium text-gray-700">{u.opname}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{u.biayaMaint > 0 ? `Rp ${(u.biayaMaint / 1_000_000).toFixed(1)} jt` : "—"}</td>
                <td className="px-4 py-3"><SoftBadge label={`${u.skor}/100`} color={effBadge(u.skor)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-800">Insight & Rekomendasi Sistem</p>
        <RekSistem level="Tinggi">
          Kategori {unitPerluPerhatian?.unit || "Aset"} memiliki skor efisiensi terendah ({unitPerluPerhatian?.skor || 0}/100) dengan progress opname {unitPerluPerhatian?.opname || 0}%. Disarankan verifikasi opname fisik lanjutan.
        </RekSistem>
        <RekSistem level="Sedang">
          Terdapat {totalIdle} aset idle terdeteksi. Pertimbangkan redistribusi internal sebelum mengajukan pengadaan aset baru.
        </RekSistem>
        <RekSistem level="Sedang">
          {tanpaPIC} aset belum memiliki penanggung jawab (PIC) terdaftar dan {tanpaLoc} aset belum memiliiki lokasi gedung/ruangan yang jelas.
        </RekSistem>
      </div>
    </>
  );
}

function PersebaranAsetTab() {
  const store = useDataStore();
  const [filterKampus,   setFilterKampus]   = useState("semua");
  const [filterGedung,   setFilterGedung]   = useState("semua");
  const [filterLantai,   setFilterLantai]   = useState("semua");
  const [filterUnit,     setFilterUnit]     = useState("semua");
  const [filterKategori, setFilterKategori] = useState("semua");

  const { gedungList, lantaiList, heatmap, maxHeat, ruanganData, totalGedung, totalRuangan, ruanganTerisi, tanpaLoc, maxRoomVal, maxRoomName } = useMemo(() => {
    const gSet = new Set<string>();
    const lSet = new Set<string>();
    const roomMap = new Map<string, { gedung: string; lantai: string; kode: string; nama: string; jumlah: number; nilai: number; verified: number }>();

    store.assets.forEach(a => {
      const g = (a.nama_gedung || a.gedung || "").trim() || "Gedung SV";
      const l = (a.lantai || "").trim() || "Lantai 1";
      const rNama = (a.Nama_ruangan || a.nama_ruangan || "").trim() || "Belum Ada Ruangan";
      const rKode = a.id_ruangan || a.kode_ruangan || rNama;

      gSet.add(g);
      lSet.add(l);

      const key = `${g}||${l}||${rNama}`;
      const cur = roomMap.get(key) || { gedung: g, lantai: l, kode: rKode, nama: rNama, jumlah: 0, nilai: 0, verified: 0 };
      cur.jumlah += 1;
      cur.nilai += (parseInt(a._harga_perolehan) || parseInt(a.HargaSatuan) || parseInt(a._nilai_buku) || 0);
      if (a.verifikasi_status === "Terverifikasi" || a.status_opname_terakhir === "Terverifikasi") {
        cur.verified += 1;
      }
      roomMap.set(key, cur);
    });

    const gList = Array.from(gSet).sort();
    const lList = Array.from(lSet).sort();
    if (gList.length === 0) gList.push("Gedung Utama");
    if (lList.length === 0) lList.push("Lantai 1");

    const heat: Record<string, Record<string, number>> = {};
    let maxH = 0;

    gList.forEach(g => {
      heat[g] = {};
      lList.forEach(l => {
        let count = 0;
        roomMap.forEach(r => {
          if (r.gedung === g && r.lantai === l) count += r.jumlah;
        });
        heat[g][l] = count;
        if (count > maxH) maxH = count;
      });
    });

    const rData = Array.from(roomMap.values()).map(r => ({
      gedung: r.gedung,
      lantai: r.lantai,
      kode: r.kode,
      nama: r.nama,
      jumlah: r.jumlah,
      nilai: r.nilai,
      status: r.verified === r.jumlah && r.jumlah > 0 ? "Terverifikasi" : r.verified > 0 ? "Sebagian" : "Belum Terverifikasi"
    }));

    let maxVal = 0;
    let maxName = "-";
    rData.forEach(r => {
      if (r.nilai > maxVal) {
        maxVal = r.nilai;
        maxName = `${r.nama} (${r.kode})`;
      }
    });

    return {
      gedungList: gList,
      lantaiList: lList,
      heatmap: heat,
      maxHeat: Math.max(maxH, 1),
      ruanganData: rData,
      totalGedung: gList.filter(g => g !== "Belum Ada Gedung").length || 1,
      totalRuangan: rData.length,
      ruanganTerisi: rData.filter(r => r.jumlah > 0).length,
      tanpaLoc: store.computeAssetsWithoutClearLocation(),
      maxRoomVal: maxVal,
      maxRoomName: maxName
    };
  }, [store.assets]);

  const heatColor = (v: number) => {
    if (v === 0) return "#F9FAFB";
    const t = v / maxHeat;
    const r = Math.round(219 - t * 160);
    const g = Math.round(234 - t * 166);
    const b = Math.round(254 - t * 186);
    return `rgb(${r},${g},${b})`;
  };

  const sBadge = (s: string): "green" | "amber" | "red" => s === "Terverifikasi" ? "green" : s === "Sebagian" ? "amber" : "red";
  const filtered = ruanganData
    .filter(r => filterGedung === "semua" || r.gedung === filterGedung)
    .filter(r => filterLantai === "semua" || r.lantai === filterLantai);

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-gray-400 shrink-0" />
        <span className="text-xs font-medium text-gray-500 mr-1">Filter:</span>
        <select value={filterKampus}   onChange={e => setFilterKampus(e.target.value)}   className={FILTER_SELECT_CLS}>
          <option value="semua">Semua Kampus</option>
          <option value="cilibende">Cilibende</option>
          <option value="gunung-gede">Gunung Gede</option>
        </select>
        <select value={filterGedung}   onChange={e => setFilterGedung(e.target.value)}   className={FILTER_SELECT_CLS}>
          <option value="semua">Semua Gedung</option>
          {gedungList.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={filterLantai}   onChange={e => setFilterLantai(e.target.value)}   className={FILTER_SELECT_CLS}>
          <option value="semua">Semua Lantai</option>
          {lantaiList.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filterUnit}     onChange={e => setFilterUnit(e.target.value)}     className={FILTER_SELECT_CLS}>
          <option value="semua">Semua Unit</option>
          <option value="sv">Sekolah Vokasi (SV)</option>
        </select>
        <select value={filterKategori} onChange={e => setFilterKategori(e.target.value)} className={FILTER_SELECT_CLS}>
          <option value="semua">Semua Kategori</option>
          <option value="pm">PM</option>
          <option value="atl">ATL</option>
          <option value="atb">ATB</option>
          <option value="al">AL</option>
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-2"><span className="text-xs font-medium text-gray-500 leading-snug">Total Gedung</span><SisBadge /></div>
          <p className="text-2xl font-bold text-gray-900 leading-tight">{totalGedung}</p>
          <p className="text-xs text-gray-400 mt-1">Gedung terdaftar</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-2"><span className="text-xs font-medium text-gray-500 leading-snug">Total Ruangan</span><SisBadge /></div>
          <p className="text-2xl font-bold text-gray-900 leading-tight">{totalRuangan}</p>
          <p className="text-xs text-gray-400 mt-1">Terdata dalam sistem</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-2"><span className="text-xs font-medium text-gray-500 leading-snug">Ruangan Terisi Aset</span><SisBadge /></div>
          <p className="text-2xl font-bold text-green-600 leading-tight">{ruanganTerisi}</p>
          <p className="text-xs text-gray-400 mt-1">{totalRuangan ? ((ruanganTerisi / totalRuangan) * 100).toFixed(1) : 0}% dari total ruangan</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-2"><span className="text-xs font-medium text-gray-500 leading-snug">Aset Tanpa Lokasi Jelas</span><SisBadge /></div>
          <p className="text-2xl font-bold text-amber-600 leading-tight">{fmtNum(tanpaLoc)}</p>
          <p className="text-xs text-gray-400 mt-1">Status lokasi belum diverifikasi</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-2"><span className="text-xs font-medium text-gray-500 leading-snug">Nilai Aset Ruangan Tertinggi</span><SisBadge /></div>
          <p className="text-2xl font-bold text-gray-900 leading-tight">{maxRoomVal > 0 ? fmtRupiahShort(maxRoomVal) : "—"}</p>
          <p className="text-xs text-gray-400 mt-1 truncate">{maxRoomName}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-gray-800">Sebaran Aset per Gedung dan Lantai</span>
          <SisBadge />
        </div>
        <div className="overflow-x-auto">
          <table className="border-separate w-full" style={{ borderSpacing: 4 }}>
            <thead>
              <tr>
                <th className="text-[10px] font-semibold text-gray-400 text-left pr-3 pb-1 whitespace-nowrap">Gedung / Lantai</th>
                {lantaiList.map(l => (
                  <th key={l} className="text-[10px] font-semibold text-gray-400 text-center pb-1 px-2">{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gedungList.map(g => (
                <tr key={g}>
                  <td className="text-xs font-medium text-gray-600 pr-3 py-1 whitespace-nowrap">{g}</td>
                  {lantaiList.map(l => {
                    const val = heatmap[g]?.[l] ?? 0;
                    return (
                      <td key={l} className="rounded-lg text-center py-2.5" style={{ backgroundColor: heatColor(val), minWidth: 72 }}>
                        <span className={`text-xs font-bold ${val > 60 ? "text-blue-900" : val > 0 ? "text-blue-700" : "text-gray-300"}`}>
                          {val > 0 ? val : "—"}
                        </span>
                        {val > 0 && <div className={`text-[9px] ${val > 60 ? "text-blue-800 opacity-70" : "text-blue-600 opacity-60"}`}>aset</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
          <span className="text-[10px] text-gray-400">Intensitas warna:</span>
          <div className="flex items-center gap-1">
            {[0, 25, 50, 75, 100].map(v => (
              <div key={v} className="w-8 h-3 rounded" style={{ backgroundColor: heatColor(Math.round(v / 100 * maxHeat)) }} />
            ))}
          </div>
          <span className="text-[10px] text-gray-400">0 ← jumlah aset → {maxHeat}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-gray-800">Peta GIS Persebaran Aset</span>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">Data Koordinat Belum Lengkap</span>
        </div>
        <div className="rounded-xl bg-gray-50 border border-dashed border-gray-300 flex flex-col items-center justify-center py-10 gap-3">
          <MapPin size={32} className="text-gray-300" />
          <div className="text-center max-w-md">
            <p className="text-sm font-medium text-gray-500">GIS membutuhkan data latitude dan longitude.</p>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">Saat ini sistem menampilkan heatmap berbasis ruangan. Untuk mengaktifkan peta GIS, lengkapi kolom <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">latitude</code> dan <code className="bg-gray-100 px-1 py-0.5 rounded text-[11px]">longitude</code> pada data aset.</p>
          </div>
          <button className="px-4 py-2 bg-white border border-gray-200 text-xs font-semibold text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
            Lihat Panduan Pengisian Koordinat
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-800">Aset per Ruangan</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">Menampilkan {filtered.length} dari {ruanganData.length} ruangan</span>
            <SisBadge />
          </div>
        </div>
        <table className="w-full text-left">
          <THead cols={["Gedung", "Lantai", "Kode Ruangan", "Nama Ruangan", "Jumlah Aset", "Nilai Buku", "Status Kejelasan Lokasi"]} />
          <tbody className="divide-y divide-gray-50">
            {filtered.map(r => (
              <tr key={`${r.gedung}-${r.kode}`} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-gray-800">{r.gedung}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{r.lantai}</td>
                <td className="px-4 py-3 text-xs font-mono text-gray-400">{r.kode}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{r.nama}</td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900">{r.jumlah}</td>
                <td className="px-4 py-3 text-xs text-gray-600">Rp {(r.nilai / 1_000_000).toFixed(0)} jt</td>
                <td className="px-4 py-3"><SoftBadge label={r.status} color={sBadge(r.status)} /></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">Belum ada data ruangan yang terdaftar</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PerencanaanPengadaanTab() {
  const store = useDataStore();
  const procurementAssets = useMemo(() => store.computeProcurementNeed(), [store]);

  const rekData = useMemo(() => {
    const map = new Map<string, { unit: string; kat: string; qty: number; biaya: number; reasons: Set<string>; maxSkor: number }>();
    for (const a of procurementAssets) {
      const key = `${a.Nama_unit}||${a.TipeAset}`;
      const cur = map.get(key) || { unit: a.Nama_unit, kat: a.TipeAset, qty: 0, biaya: 0, reasons: new Set<string>(), maxSkor: 0 };
      cur.qty += 1;
      cur.biaya += parseInt(a._harga_perolehan) || parseInt(a._nilai_buku) || 0;
      const skor = computeReplacementPriority(a);
      if (skor > cur.maxSkor) cur.maxSkor = skor;
      const sisa = parseInt(a._sisa_masa_manfaat_bulan) || 0;
      const freq = parseInt(a.total_frekuensi_maintenance) || 0;
      if (sisa <= 0) cur.reasons.add("masa manfaat habis");
      if (freq >= 3) cur.reasons.add("frekuensi kerusakan tinggi");
      if ((a.Kondisi || "").includes("Rusak")) cur.reasons.add("kondisi rusak");
      map.set(key, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.maxSkor - a.maxSkor)
      .map((v) => {
        const prio = v.maxSkor >= 70 ? "Tinggi" : v.maxSkor >= 50 ? "Sedang" : "Rendah";
        const rek = prio === "Tinggi" ? "Pengadaan segera" : prio === "Sedang" ? "Anggaran semester depan" : "Masuk RKPT berikutnya";
        const alasan = v.reasons.size ? `Indikator: ${Array.from(v.reasons).join(", ")}` : "Skor risiko gabungan tinggi";
        return { unit: v.unit, kat: v.kat, qty: v.qty, alasan, est: fmtRupiahShort(v.biaya), prio, rek };
      });
  }, [procurementAssets]);

  const totalEstimasiPengadaan = useMemo(
    () => procurementAssets.reduce((s, a) => s + (parseInt(a._harga_perolehan) || parseInt(a._nilai_buku) || 0), 0),
    [procurementAssets],
  );
  const prioritasPenggantianCount = useMemo(
    () => store.assets.filter((a) => computeReplacementPriority(a) >= 70).length,
    [store.assets],
  );
  const unitButuhAsetCount = useMemo(
    () => new Set(procurementAssets.map((a) => a.Nama_unit)).size,
    [procurementAssets],
  );
  const idleAssets = useMemo(
    () => store.assets.filter((a) => a.status_penggunaan_aset === "Tidak Digunakan" || a.status_penggunaan_aset === "Idle"),
    [store.assets],
  );
  const ruanganKurangCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of store.assets) {
      if (!a.kode_ruangan) continue;
      counts.set(a.kode_ruangan, (counts.get(a.kode_ruangan) || 0) + 1);
    }
    let n = 0;
    counts.forEach((v) => { if (v < 5) n += 1; });
    return n;
  }, [store.assets]);

  const redistData = (() => {
    const needUnits = Array.from(new Set(procurementAssets.map(a => a.Nama_unit)));
    const idleSorted = [...idleAssets].sort((a, b) => (parseInt(b._nilai_buku) || 0) - (parseInt(a._nilai_buku) || 0));
    return idleSorted.slice(0, 5).map((a, i) => {
      const tujuan = needUnits[i % Math.max(1, needUnits.length)] || "Unit lain";
      const months = Math.max(1, Math.round(((new Date("2026-06-01").getTime() - new Date(a.tanggal_maintenance_terakhir && a.tanggal_maintenance_terakhir !== "-" ? a.tanggal_maintenance_terakhir : "2025-06-01").getTime()) / (1000 * 60 * 60 * 24 * 30))));
      const hematN = parseInt(a._nilai_buku) || 0;
      return {
        id: a.id,
        nama: a.Nama_Barang || a.id,
        asal: a.Nama_unit || "-",
        tujuan,
        idle: `${months} bln idle`,
        hemat: fmtRupiahShort(hematN),
      };
    });
  })();

  const procurementByQuarter = (() => {
    const year = new Date().getFullYear();
    const counts = [0, 0, 0, 0];
    for (const p of store.procurementRequests) {
      const d = new Date(p.tanggal);
      if (isNaN(d.getTime()) || d.getFullYear() !== year) continue;
      const q = Math.floor(d.getMonth() / 3);
      counts[q] += 1;
    }
    return counts;
  })();
  const quarters  = [`Q1 ${new Date().getFullYear()}`, `Q2 ${new Date().getFullYear()}`, `Q3 ${new Date().getFullYear()}`, `Q4 ${new Date().getFullYear()}`, `Q1 ${new Date().getFullYear() + 1}`, `Q2 ${new Date().getFullYear() + 1}`];
  const qData     = [...procurementByQuarter, 0, 0];
  const VW = 560, VH = 150, ml = 42, mr = 16, mt = 16, mb = 30;
  const cW = VW - ml - mr, cH = VH - mt - mb;
  const maxQ = 350;
  const bW = (cW / quarters.length) - 8;
  const xBar = (i: number) => ml + (i / quarters.length) * cW + 4;
  const yBar = (v: number) => mt + cH - Math.min(v / maxQ, 1) * cH;
  const barColors = ["#EF4444", "#F59E0B", "#3B82F6", "#3B82F6", "#3B82F6", "#3B82F6"];

  const pBadge = (p: string): "red" | "amber" | "gray" => p === "Tinggi" ? "red" : p === "Sedang" ? "amber" : "gray";
  const kBadge = (k: string): "blue" | "green" | "amber" | "purple" => k === "PM" ? "blue" : k === "AL" ? "green" : k === "ATB" ? "amber" : "purple";

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-2"><span className="text-xs font-medium text-gray-500 leading-snug">Aset Prioritas Penggantian</span><SisBadge /></div>
          <p className="text-2xl font-bold text-red-600 leading-tight">{prioritasPenggantianCount}</p>
          <p className="text-xs text-gray-400 mt-1">Skor risiko ≥ 70</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-2"><span className="text-xs font-medium text-gray-500 leading-snug">Ruangan Kekurangan Aset</span><SisBadge /></div>
          <p className="text-2xl font-bold text-amber-600 leading-tight">{ruanganKurangCount}</p>
          <p className="text-xs text-gray-400 mt-1">Di bawah kapasitas minimal</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-2"><span className="text-xs font-medium text-gray-500 leading-snug">Estimasi Kebutuhan Anggaran</span><SisBadge /></div>
          <p className="text-2xl font-bold text-gray-900 leading-tight">{fmtRupiahShort(totalEstimasiPengadaan)}</p>
          <p className="text-xs text-gray-400 mt-1">Semua prioritas — rekomendasi awal</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-2"><span className="text-xs font-medium text-gray-500 leading-snug">Rekomendasi Redistribusi</span><SisBadge /></div>
          <p className="text-2xl font-bold text-blue-600 leading-tight">{idleAssets.length}</p>
          <p className="text-xs text-gray-400 mt-1">Aset idle yang dapat dipindah</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-start justify-between gap-2 mb-2"><span className="text-xs font-medium text-gray-500 leading-snug">Unit Membutuhkan Aset Baru</span><SisBadge /></div>
          <p className="text-2xl font-bold text-purple-600 leading-tight">{unitButuhAsetCount}</p>
          <p className="text-xs text-gray-400 mt-1">Berdasarkan analisis sistem</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">Prediksi Kebutuhan Pengadaan</span>
            <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded font-semibold">Rekomendasi Sistem</span>
          </div>
          <SisBadge />
        </div>
        <p className="text-xs text-gray-400 mb-3">Estimasi anggaran pengadaan per kuartal berdasarkan kondisi aset, masa manfaat, dan kebutuhan ruangan — bukan keputusan final</p>
        <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" style={{ height: VH }}>
          {[0, 100, 200, 300].map(v => (
            <g key={v}>
              <line x1={ml} y1={yBar(v)} x2={VW - mr} y2={yBar(v)} stroke="#F3F4F6" strokeWidth={1} />
              <text x={ml - 5} y={yBar(v) + 3} textAnchor="end" fontSize={8} fill="#D1D5DB">{v}</text>
            </g>
          ))}
          <line x1={ml} y1={mt + cH} x2={VW - mr} y2={mt + cH} stroke="#E5E7EB" strokeWidth={1} />
          {quarters.map((q, i) => {
            const v = qData[i];
            const x = xBar(i);
            const bh = Math.min(v / maxQ, 1) * cH;
            const y = mt + cH - bh;
            return (
              <g key={q}>
                <rect x={x} y={y} width={bW} height={bh} fill={barColors[i]} fillOpacity={0.75} rx={2} />
                <text x={x + bW / 2} y={y - 4} textAnchor="middle" fontSize={8} fill={barColors[i]} fontWeight="600">{v}</text>
                <text x={x + bW / 2} y={VH - 6} textAnchor="middle" fontSize={8} fill="#9CA3AF">{q}</text>
              </g>
            );
          })}
        </svg>
        <div className="flex items-center gap-4 mt-2 pt-2 border-t border-gray-100 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-red-400" /> Paling Mendesak</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-amber-400" /> Mendesak</span>
          <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-blue-400" /> Jangka Menengah</span>
          <span className="ml-auto">Satuan: Rp juta</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">Rekomendasi Pengadaan</span>
            <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded font-semibold">Rekomendasi Sistem</span>
          </div>
          <SisBadge />
        </div>
        <table className="w-full text-left">
          <THead cols={["Unit", "Kategori Aset", "Jml. Kebutuhan", "Alasan Sistem", "Estimasi Anggaran", "Prioritas", "Rekomendasi"]} />
          <tbody className="divide-y divide-gray-50">
            {rekData.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 text-sm font-medium text-gray-800">{r.unit}</td>
                <td className="px-4 py-3"><SoftBadge label={r.kat} color={kBadge(r.kat)} /></td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900 text-center">{r.qty}</td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] leading-relaxed">{r.alasan}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-800">{r.est}</td>
                <td className="px-4 py-3"><SoftBadge label={r.prio} color={pBadge(r.prio)} /></td>
                <td className="px-4 py-3 text-xs text-gray-600">{r.rek}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-gray-800">Redistribusi Sebelum Pengadaan</span>
          <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded font-semibold">Rekomendasi Sistem</span>
        </div>
        <p className="text-xs text-gray-500 mb-4">Daftar aset idle yang dapat dipindahkan ke unit yang membutuhkan — pertimbangkan redistribusi ini sebelum mengajukan pengadaan baru.</p>
        <table className="w-full text-left">
          <THead cols={["Kode Aset", "Nama Aset", "Unit Asal", "Unit Tujuan", "Status Idle", "Potensi Penghematan"]} />
          <tbody className="divide-y divide-gray-50">
            {redistData.map(r => (
              <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 text-xs font-mono text-gray-400">{r.id}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-800">{r.nama}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{r.asal}</td>
                <td className="px-4 py-3">
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">{r.tujuan}</span>
                </td>
                <td className="px-4 py-3"><SoftBadge label={r.idle} color="amber" /></td>
                <td className="px-4 py-3 text-xs font-semibold text-green-600">{r.hemat}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex items-center justify-between pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">Total potensi penghematan dari redistribusi: <span className="font-bold text-green-600">Rp 35 jt</span></p>
          <span className="text-[10px] text-gray-400">Verifikasi kondisi fisik aset sebelum redistribusi dilakukan</span>
        </div>
      </div>

      <RekSistem level="Tinggi">Laptop pengganti (Lab Komputer, 8 unit) dan server rack (Teknik Informatika, 2 unit) merupakan kebutuhan paling mendesak dengan total estimasi Rp 141 jt. Direkomendasikan untuk dimasukkan ke RKPT 2026 tahap dua sebelum akhir Juli 2026. Confidence: Tinggi.</RekSistem>
      <RekSistem level="Sedang">Sebelum mengajukan pengadaan baru, pertimbangkan redistribusi 52 aset idle yang teridentifikasi. Potensi penghematan estimasi Rp 35–120 jt tergantung kondisi fisik aset. Confidence: Sedang.</RekSistem>
    </>
  );
}

function AnalitikContent({ tab }: { tab: string }) {
  const store = useDataStore();
  if (tab === "Pola Kerusakan Aset") {
    const damagedAssets = store.assets.filter(a => (a.Kondisi || a.kondisi || "").includes("Rusak"));
    const totalKerusakan = damagedAssets.length;
    const seringRusakCount = damagedAssets.filter(a => (parseInt(a.total_frekuensi_maintenance) || 0) >= 3).length;
    const totalBiayaKerusakan = store.maintenanceTickets.reduce((s, t) => s + (t.biaya || 0), 0);

    const kategoriData = totalKerusakan > 0 ? [
      { label: "Elektrikal",             value: Math.round(totalKerusakan * 0.4), color: BLUE   },
      { label: "Mekanik",                value: Math.round(totalKerusakan * 0.3), color: PURPLE },
      { label: "Keausan Normal",         value: Math.round(totalKerusakan * 0.2), color: GREEN  },
      { label: "Fisik / Benturan",       value: Math.round(totalKerusakan * 0.1), color: AMBER  },
    ] : [
      { label: "Elektrikal",             value: 0, color: BLUE   },
      { label: "Mekanik",                value: 0, color: PURPLE },
      { label: "Keausan Normal",         value: 0, color: GREEN  },
      { label: "Fisik / Benturan",       value: 0, color: AMBER  },
    ];

    const topAset = damagedAssets.map(a => ({
      id: a.id,
      nama: a.Nama_Barang || a.id,
      kat: a.TipeAset || "PM",
      unit: a.Nama_unit || "SV",
      freq: parseInt(a.total_frekuensi_maintenance) || 1,
      tingkat: (a.Kondisi || "").includes("Berat") ? "Berat" : "Sedang",
      biaya: parseInt(a._total_biaya_maintenance) || 0,
      risiko: computeReplacementPriority(a) >= 70 ? "Tinggi" : "Sedang"
    }));

    const risCfg  = (r: string) => r === "Tinggi" ? "red"   : r === "Sedang" ? "amber" : "gray"  as const;
    const tingCfg = (t: string) => t === "Berat"  ? "red"   : t === "Sedang" ? "amber" : "green" as const;
    const katCfg  = (k: string) => k === "PM"     ? "blue"  : k === "AL"     ? "green" : "purple" as const;

    return (
      <>
        {/* ── 5 KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          <KpiStat label="Total Kerusakan Tercatat"  value={fmtNum(totalKerusakan)}   sub={totalKerusakan > 0 ? "Aset terdeteksi rusak" : "Belum ada kerusakan"} badge />
          <KpiStat label="Aset Sering Rusak (≥3×)"   value={fmtNum(seringRusakCount)}  sub="Frekuensi kerusakan tinggi"  badge />
          <KpiStat label="Kerusakan Bulan Ini"        value="0"                        sub="Bulan berjalan"               badge />
          <KpiStat label="Rata-rata Downtime"          value="0 jam"                    sub="Per kejadian kerusakan"       badge />
          <KpiStat label="Total Biaya Kerusakan"       value={fmtRupiahShort(totalBiayaKerusakan)} sub="Total kumulatif"  badge />
        </div>

        {/* ── Charts Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Line chart */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-800">Tren Kerusakan Aset per Bulan</span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3 text-[11px] text-gray-500">
                  {([["PM", BLUE], ["ATL", PURPLE], ["AL", AMBER]] as [string, string][]).map(([l, c]) => (
                    <span key={l} className="flex items-center gap-1.5">
                      <span className="inline-block rounded-sm" style={{ width: 14, height: 2, backgroundColor: c }} />
                      {l}
                    </span>
                  ))}
                </div>
                <SisBadge />
              </div>
            </div>
            <PolaKerusakanLineChart />
            <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-400">
              <Info size={10} /> Baseline dari data opname & maintenance
            </div>
          </div>

          {/* Horizontal bar: kategori kerusakan */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-800">Kategori Kerusakan Terbanyak</span>
              <SisBadge />
            </div>
            <HBarChart data={kategoriData} maxVal={Math.max(...kategoriData.map(d => d.value), 1)} />
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1 text-[10px] text-gray-400">
              <Info size={10} /> Baseline dari data opname & maintenance &bull; Satuan: jumlah kejadian
            </div>
          </div>
        </div>

        {/* ── Top Aset Sering Rusak ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Top Aset Sering Rusak</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400">Diurutkan berdasarkan frekuensi kerusakan tertinggi</span>
              <SisBadge />
            </div>
          </div>
          <table className="w-full text-left">
            <THead cols={["Kode Aset", "Nama Aset", "Kat.", "Unit", "Frekuensi", "Tingkat Terakhir", "Total Biaya", "Status Risiko"]} />
            <tbody className="divide-y divide-gray-50">
              {topAset.map(r => (
                <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-gray-400">{r.id}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800 max-w-[160px]">
                    <span className="truncate block">{r.nama}</span>
                  </td>
                  <td className="px-4 py-3">
                    <SoftBadge label={r.kat} color={katCfg(r.kat)} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.unit}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900 w-5">{r.freq}×</span>
                      <div className="w-14 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{
                          width: `${(r.freq / 8) * 100}%`,
                          backgroundColor: r.freq >= 6 ? RED : r.freq >= 4 ? AMBER : GREEN,
                        }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <SoftBadge label={r.tingkat} color={tingCfg(r.tingkat)} />
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-gray-700">
                    {r.biaya > 0 ? `Rp ${(r.biaya / 1_000_000).toFixed(1)} jt` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <SoftBadge label={r.risiko} color={risCfg(r.risiko)} />
                  </td>
                </tr>
              ))}
              {topAset.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">
                    Belum ada data kerusakan aset yang tercatat di sistem. Data akan terisi otomatis saat verifikasi Stock Opname / Maintenance mencatat aset rusak.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Insight Sistem ── */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-800">Insight Sistem</p>
          {totalKerusakan > 0 ? (
            <>
              <RekSistem level="Tinggi">
                Terdapat {totalKerusakan} aset yang terdeteksi dalam kondisi rusak. Segera lakukan verifikasi fisik dan usulan pemeliharaan.
              </RekSistem>
              <RekSistem level="Sedang">
                Disarankan melakukan pemeliharaan berkala untuk mencegah penumpukan aset rusak di masa mendatang.
              </RekSistem>
            </>
          ) : (
            <RekSistem level="OK">
              Belum ada data kerusakan aset yang dilaporkan. Sistem akan merekam pola kerusakan secara otomatis ketika verifikasi Stock Opname menandai aset rusak atau tiket maintenance dibuat.
            </RekSistem>
          )}
        </div>
      </>
    );
  }

  if (tab === "Prediksi Perbaikan Aset")    return <PrediksiPerbaikanTab />;
  if (tab === "Pengelolaan Aset")            return <PengelolaanAsetTab />;
  if (tab === "Persebaran Aset")             return <PersebaranAsetTab />;
  if (tab === "Perencanaan Pengadaan Aset")  return <PerencanaanPengadaanTab />;

  // Rekapitulasi
  const rekapAssets = store.assets;
  const byType = (type: string) => rekapAssets.filter(a => a.TipeAset === type);
  const kondisiOf = (assets: typeof rekapAssets, cond: string) => assets.filter(a => (a.Kondisi || "").includes(cond)).length;
  const rekapRows = [
    {
      label: "Total Aset",
      pm: byType("PM").length, atb: byType("ATB").length, atl: byType("ATL").length, al: byType("AL").length,
    },
    {
      label: "Kondisi Baik",
      pm: kondisiOf(byType("PM"), "Baik"), atb: kondisiOf(byType("ATB"), "Baik"), atl: kondisiOf(byType("ATL"), "Baik"), al: kondisiOf(byType("AL"), "Baik"),
    },
    {
      label: "Perlu Perbaikan",
      pm: kondisiOf(byType("PM"), "Rusak Ringan"), atb: kondisiOf(byType("ATB"), "Rusak Ringan"), atl: kondisiOf(byType("ATL"), "Rusak Ringan"), al: kondisiOf(byType("AL"), "Rusak Ringan"),
    },
    {
      label: "Rusak Berat",
      pm: kondisiOf(byType("PM"), "Rusak Berat"), atb: kondisiOf(byType("ATB"), "Rusak Berat"), atl: kondisiOf(byType("ATL"), "Rusak Berat"), al: kondisiOf(byType("AL"), "Rusak Berat"),
    },
    {
      label: "Melewati Masa Manfaat",
      pm: byType("PM").filter(a => (parseInt(a._sisa_masa_manfaat_bulan || "0") || 0) <= 0).length,
      atb: byType("ATB").filter(a => (parseInt(a._sisa_masa_manfaat_bulan || "0") || 0) <= 0).length,
      atl: byType("ATL").filter(a => (parseInt(a._sisa_masa_manfaat_bulan || "0") || 0) <= 0).length,
      al: byType("AL").filter(a => (parseInt(a._sisa_masa_manfaat_bulan || "0") || 0) <= 0).length,
    },
  ];
  const totalAsetRekap = rekapAssets.length;
  const opnameProgRekap = store.computeStockOpnameProgress();
  const bermasalah = rekapAssets.filter(a => {
    const k = a.Kondisi || "";
    return k.includes("Rusak") || a.status_penggunaan_aset === "Tidak Digunakan";
  }).length;
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiStat label="Total Aset"               value={fmtNum(totalAsetRekap)}             sub="PM+ATB+ATL+AL"                                                   badge />
        <KpiStat label="Sudah Diopname"           value={fmtNum(opnameProgRekap.done)}       sub={`${fmtPct(opnameProgRekap.pct)} dari total`}                    badge />
        <KpiStat label="Belum Diverifikasi"       value={fmtNum(opnameProgRekap.total - opnameProgRekap.done)} sub="Perlu verifikasi"                              badge />
        <KpiStat label="Aset Bermasalah"          value={fmtNum(bermasalah)}                 sub="Perlu tindak lanjut"                                             badge />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-gray-800">Rekapitulasi Kondisi per Kategori</span>
          <SisBadge />
        </div>
        <table className="w-full text-left">
          <THead cols={["Keterangan", "PM", "ATB", "ATL", "AL", "Total"]} />
          <tbody className="divide-y divide-gray-50">
            {rekapRows.map(r => (
              <tr key={r.label} className={`hover:bg-gray-50/50 ${r.label === "Total Aset" ? "font-semibold" : ""}`}>
                <td className="px-4 py-3 text-sm text-gray-800">{r.label}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{r.pm}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{r.atb}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{r.atl}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{r.al}</td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900">{r.pm + r.atb + r.atl + r.al}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── KEUANGAN ──────────────────────────────────────────────────────────────────

function KeuanganContent({ tab }: { tab: string }) {
  const storeKeu = useDataStore();
  const totalAsetKeu = storeKeu.computeTotalAssets();
  const realTotalPerolehan = storeKeu.computeTotalAcquisitionValue();
  const realTotalBuku = storeKeu.computeTotalBookValue();

  // Compute per-category values dynamically from store.assets
  const nilaiKat = useMemo(() => {
    const CATS: { key: string; label: string }[] = [
      { key: "PM",  label: "Peralatan & Mesin (PM)" },
      { key: "ATL", label: "Aset Tetap Lainnya (ATL)" },
      { key: "ATB", label: "Aset Tak Berwujud (ATB)" },
      { key: "AL",  label: "Alat Angkutan (AL)" },
    ];
    return CATS.map(({ key, label }) => {
      const items = storeKeu.assets.filter(a => a.TipeAset === key);
      const perolehan = Math.round(items.reduce((s, a) => s + (parseInt(a._harga_perolehan || "0") || 0), 0) / 1_000_000);
      const susut     = Math.round(items.reduce((s, a) => s + (parseInt(a._akumulasi_penyusutan || "0") || 0), 0) / 1_000_000);
      const buku      = Math.round(items.reduce((s, a) => s + (parseInt(a._nilai_buku || "0") || 0), 0) / 1_000_000);
      const pct       = perolehan > 0 ? Math.round((buku / perolehan) * 1000) / 10 : 0;
      return { kat: label, perolehan, susut, buku, pct };
    });
  }, [storeKeu.assets]);

  const totalPerolehan = nilaiKat.reduce((a, v) => a + v.perolehan, 0);
  const totalSusut     = nilaiKat.reduce((a, v) => a + v.susut, 0);
  const totalBuku      = nilaiKat.reduce((a, v) => a + v.buku, 0);

  // Real SumberDana grouping from store.assets
  const sumberDanaData = useMemo(() => {
    const map: Record<string, number> = {};
    storeKeu.assets.forEach(a => {
      const sd = (a.SumberDana || "").trim();
      if (!sd || sd === "-") return;
      const val = parseInt(a._harga_perolehan || "0") || 0;
      map[sd] = (map[sd] || 0) + val;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .map(([label, total]) => ({ label, value: Math.round(total / 1_000_000) }));
  }, [storeKeu.assets]);

  // Biaya Aset per Ruangan/Gedung (dynamic from store.assets)
  const roomData = useMemo(() => {
    const roomMap: Record<string, { nama: string; jmlAset: number; perolehan: number; buku: number }> = {};
    storeKeu.assets.forEach(a => {
      const room = String(a.Nama_ruangan || a.Id_ruangan || "").trim() || "Lokasi Belum Teridentifikasi";
      if (!roomMap[room]) {
        roomMap[room] = { nama: room, jmlAset: 0, perolehan: 0, buku: 0 };
      }
      roomMap[room].jmlAset += 1;
      roomMap[room].perolehan += (parseInt(a._harga_perolehan || "0") || 0);
      roomMap[room].buku += (parseInt(a._nilai_buku || "0") || 0);
    });
    return Object.values(roomMap).sort((a, b) => b.perolehan - a.perolehan);
  }, [storeKeu.assets]);

  if (tab === "Valuasi Aset") {
    // Real TahunBuku trend
    const trendByYear: Record<string, number> = {};
    storeKeu.assets.forEach(a => {
      const thn = (a.TahunBuku || "").toString().trim();
      if (!thn || thn === "-" || thn.length !== 4) return;
      trendByYear[thn] = (trendByYear[thn] || 0) + (parseInt(a._harga_perolehan || "0") || 0);
    });
    const trendTahunan = Object.entries(trendByYear)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([thn, total]) => ({ thn, nilai: Math.round(total / 1_000_000) }))
      .slice(-8);
    const hasTrend = trendTahunan.length >= 2;
    const maxNilai = Math.max(...trendTahunan.map(d => d.nilai), 1);
    const nT = trendTahunan.length;
    const pts = trendTahunan.map((d, i) => {
      const x = 40 + i * (nT > 1 ? 440 / (nT - 1) : 0);
      const y = 80 - (d.nilai / maxNilai) * 60;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiStat label="Total Nilai Perolehan" value={fmtRupiahShort(realTotalPerolehan)} sub="Semua kategori aset" badge />
          <KpiStat label="Nilai Buku Saat Ini"   value={fmtRupiahShort(realTotalBuku)}     sub={`${realTotalPerolehan > 0 ? ((realTotalBuku/realTotalPerolehan)*100).toFixed(1) : "0"}% dari perolehan`} badge />
          <KpiStat label="Rata-rata Nilai/Aset"  value={totalAsetKeu > 0 ? fmtRupiahShort(Math.round(realTotalPerolehan / totalAsetKeu)) : "—"} sub={`Berdasarkan ${fmtNum(totalAsetKeu)} aset`} badge />
          <KpiStat label="Aset Bernilai > 100 jt" value={fmtNum(storeKeu.assets.filter(a => (parseInt(a._harga_perolehan || "0") || 0) >= 100_000_000).length)} sub="Perlu revaluasi periodik" badge />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-800">Nilai Perolehan berdasarkan Tahun Buku (Rp juta)</span>
              <SisBadge />
            </div>
            {hasTrend ? (
              <svg viewBox="0 0 520 110" className="w-full" style={{ height: 110 }}>
                <polyline points={pts} fill="none" stroke={BLUE} strokeWidth={2} />
                {trendTahunan.map((d, i) => {
                  const x = 40 + i * (nT > 1 ? 440 / (nT - 1) : 0);
                  const y = 80 - (d.nilai / maxNilai) * 60;
                  return (
                    <g key={d.thn}>
                      <circle cx={x} cy={y} r={3} fill={BLUE} />
                      <text x={x} y={100} textAnchor="middle" fontSize={9} fill="#9CA3AF">{d.thn}</text>
                      <text x={x} y={y - 7} textAnchor="middle" fontSize={8} fill="#6B7280">{(d.nilai/1000).toFixed(1)}M</text>
                    </g>
                  );
                })}
              </svg>
            ) : (
              <div className="h-28 flex items-center justify-center text-sm text-gray-400">Belum cukup data TahunBuku</div>
            )}
            <p className="text-xs text-gray-400 mt-2">Dikelompokkan berdasarkan TahunBuku aset</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-800">Sumber Dana Pengadaan (Rp juta)</span>
              <SisBadge />
            </div>
            {sumberDanaData.length > 0 ? (
              <HBarChart data={sumberDanaData} maxVal={Math.max(...sumberDanaData.map(d => d.value), 1)} />
            ) : (
              <div className="h-24 flex items-center justify-center text-sm text-gray-400">Belum ada data SumberDana tercatat</div>
            )}
            <p className="text-xs text-gray-400 mt-3">{sumberDanaData.length > 0 ? `${sumberDanaData.length} kategori sumber dana • data real` : "Kolom SumberDana belum terisi di data aset"}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-800">Nilai Aset per Kategori (Rp juta)</span>
            <SisBadge />
          </div>
          <table className="w-full text-left">
            <THead cols={["Kategori", "Nilai Perolehan", "Akum. Penyusutan", "Nilai Buku", "% Nilai Buku"]} />
            <tbody className="divide-y divide-gray-50">
              {nilaiKat.map(r => (
                <tr key={r.kat} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 text-xs text-gray-700">{r.kat}</td>
                  <td className="px-4 py-2.5 text-xs font-medium text-gray-900">{r.perolehan.toLocaleString("id")}</td>
                  <td className="px-4 py-2.5 text-xs text-red-600">({r.susut.toLocaleString("id")})</td>
                  <td className="px-4 py-2.5 text-xs font-bold text-green-700">{r.buku.toLocaleString("id")}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-600">{r.pct}%</td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                <td className="px-4 py-2.5 text-xs text-gray-900">Total</td>
                <td className="px-4 py-2.5 text-xs text-gray-900">{totalPerolehan.toLocaleString("id")}</td>
                <td className="px-4 py-2.5 text-xs text-red-600">({totalSusut.toLocaleString("id")})</td>
                <td className="px-4 py-2.5 text-xs text-green-700">{totalBuku.toLocaleString("id")}</td>
                <td className="px-4 py-2.5 text-xs text-gray-600">{((totalBuku/totalPerolehan)*100).toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <RekSistem level="Sedang">Nilai buku aset sebesar Rp {(totalBuku/1000).toFixed(1)} M ({((totalBuku/totalPerolehan)*100).toFixed(1)}% dari nilai perolehan). Disarankan melakukan revaluasi aset sesuai PSAP untuk memperbarui nilai wajar dalam laporan keuangan semester II 2026.</RekSistem>
      </>
    );
  }

  const topRoom = roomData[0] || { nama: "-", perolehan: 0, jmlAset: 0 };
  const totalRoomsCount = roomData.length;
  const avgPerRoom = totalRoomsCount > 0 ? Math.round(realTotalPerolehan / totalRoomsCount) : 0;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <KpiStat label="Ruangan Nilai Tertinggi" value={topRoom.nama.length > 18 ? topRoom.nama.slice(0, 18) + "..." : topRoom.nama} sub={fmtRupiahShort(topRoom.perolehan)} badge />
        <KpiStat label="Total Ruangan Terdaftar" value={fmtNum(totalRoomsCount)} sub="Berdasarkan data lokasi" badge />
        <KpiStat label="Rata-rata Nilai / Ruangan" value={fmtRupiahShort(avgPerRoom)} sub="Semua ruangan" badge />
        <KpiStat label="Biaya Maintenance Total" value="—" sub="Modul maintenance belum aktif" badge />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-gray-800">Biaya & Nilai Aset per Ruangan / Gedung</span>
          <SisBadge />
        </div>
        <table className="w-full text-left">
          <THead cols={["Ruangan / Lokasi", "Jumlah Aset", "Nilai Perolehan (Rp)", "Nilai Buku (Rp)", "Biaya Maintenance", "Total Nilai (Rp)"]} />
          <tbody className="divide-y divide-gray-50">
            {roomData.map(r => (
              <tr key={r.nama} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 text-sm font-medium text-gray-800">{r.nama}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{r.jmlAset.toLocaleString("id")}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.perolehan > 0 ? `Rp ${r.perolehan.toLocaleString("id")}` : "Rp 0"}</td>
                <td className="px-4 py-3 text-sm text-green-700">{r.buku > 0 ? `Rp ${r.buku.toLocaleString("id")}` : "Rp 0"}</td>
                <td className="px-4 py-3 text-xs text-gray-400 italic">—</td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900">{fmtRupiahShort(r.perolehan)}</td>
              </tr>
            ))}
            {roomData.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  Belum ada data ruangan / lokasi yang terdaftar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <RekSistem level="Sedang">
        {totalRoomsCount > 0
          ? `Nilai aset terdistribusi di ${totalRoomsCount} lokasi/ruangan. Ruangan ${topRoom.nama} memiliki total nilai perolehan tertinggi sebesar ${fmtRupiahShort(topRoom.perolehan)}. Kolom biaya maintenance saat ini menampilkan status belum ada data hingga modul maintenance terhubung.`
          : `Belum ada data lokasi aset yang terdaftar di database. Sistem akan menghitung nilai per ruangan secara otomatis setelah data lokasi diisi.`}
      </RekSistem>
    </>
  );
}

// ── KONDISI ───────────────────────────────────────────────────────────────────

function KondisiContent({ tab }: { tab: string }) {
  const store = useDataStore();
  const allAssets = store.assets;
  const storeRuangan = store.ruangan;

  const masterRooms: RuanganData[] = useMemo(() => {
    return (storeRuangan && storeRuangan.length > 0) ? storeRuangan : SEED_RUANGAN;
  }, [storeRuangan]);

  const { assetRoomMap } = useMemo(() => {
    return buildAssetRoomMap(allAssets, masterRooms);
  }, [allAssets, masterRooms]);

  const { realCampuses, allCampuses } = useMemo(() => {
    return getCanonicalCampusList(masterRooms);
  }, [masterRooms]);

  const campusAssetsMap = useMemo(() => {
    const map = new Map<string, typeof allAssets>();
    allCampuses.forEach(c => map.set(c, []));
    allAssets.forEach(a => {
      const cName = resolveAssetCampus(a, assetRoomMap);
      if (!map.has(cName)) map.set(cName, []);
      map.get(cName)!.push(a);
    });
    return map;
  }, [allAssets, allCampuses, assetRoomMap]);

  const normKondisi = (k?: string): "Baik" | "Cukup" | "Rusak Ringan" | "Rusak Berat" => {
    const s = (k || "").trim().toUpperCase();
    if (s === "RB" || s.includes("RUSAK BERAT")) return "Rusak Berat";
    if (s === "RR" || s.includes("RUSAK RINGAN") || s.includes("PERLU PERBAIKAN")) return "Rusak Ringan";
    if (s === "C" || s.includes("CUKUP") || s.includes("MONITORING")) return "Cukup";
    return "Baik";
  };

  const getKampus = (a: any) => resolveAssetCampus(a, assetRoomMap);

  if (tab === "Umur Ekonomis") {
    const histCounts = { "0–2 thn": 0, "3–5 thn": 0, "6–8 thn": 0, "9–10 thn": 0, "11–15 thn": 0, "> 15 thn": 0 };
    let totalAgeYears = 0;
    let validAgeCount = 0;
    let expiredCount = 0;
    let nearExpiredCount = 0;
    let optimalCount = 0;

    allAssets.forEach(a => {
      const age = parseInt(a.Umur_tahun || "0") || 0;
      const sisaBulan = parseInt(a._sisa_masa_manfaat_bulan || "0") || 0;
      if (age > 0) {
        totalAgeYears += age;
        validAgeCount++;
      }

      if (age <= 2) histCounts["0–2 thn"]++;
      else if (age <= 5) histCounts["3–5 thn"]++;
      else if (age <= 8) histCounts["6–8 thn"]++;
      else if (age <= 10) histCounts["9–10 thn"]++;
      else if (age <= 15) histCounts["11–15 thn"]++;
      else histCounts["> 15 thn"]++;

      if (sisaBulan <= 0) expiredCount++;
      else if (sisaBulan <= 24) nearExpiredCount++;

      if (age >= 3 && age <= 8) optimalCount++;
    });

    const histData = Object.entries(histCounts).map(([range, count]) => ({ range, count }));
    const maxCount = Math.max(...histData.map(d => d.count), 1);
    const avgAge = validAgeCount > 0 ? (totalAgeYears / validAgeCount).toFixed(1) : "0.0";
    const totalAssetsCount = allAssets.length;
    const pctOptimal = totalAssetsCount > 0 ? ((optimalCount / totalAssetsCount) * 100).toFixed(1) : "0.0";

    const asetExpired = allAssets
      .filter(a => (parseInt(a._sisa_masa_manfaat_bulan || "0") || 0) <= 0 || (parseInt(a.Umur_tahun || "0") > (parseInt(a._masa_manfaat_bulan || "0") / 12)))
      .slice(0, 10)
      .map(a => {
        const age = parseInt(a.Umur_tahun || "0") || 0;
        const mmMonths = parseInt(a._masa_manfaat_bulan || "0") || 120;
        const thnBeli = a.TahunBuku || a.TglPerolehan?.slice(-4) || "—";
        return {
          id: a.id || a.KodeBarang || "-",
          nama: a.Nama_Barang || "Aset",
          kat: a.TipeAset || "PM",
          thnBeli,
          masaManfaat: Math.round(mmMonths / 12),
          umurAktual: age,
          status: "Melewati Masa Manfaat",
        };
      });

    return (
      <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <KpiStat label="Aset Melewati Masa Manfaat" value={fmtNum(expiredCount)} sub={`${totalAssetsCount > 0 ? ((expiredCount/totalAssetsCount)*100).toFixed(1) : 0}% dari total aset`} badge />
          <KpiStat label="Mendekati Akhir Masa Manfaat" value={fmtNum(nearExpiredCount)} sub="Sisa usia ≤ 2 tahun" badge />
          <KpiStat label="Rata-rata Umur Aset" value={`${avgAge} thn`} sub="Berdasarkan data Umur_tahun" badge />
          <KpiStat label="Aset Usia Optimal (3–8 thn)" value={fmtNum(optimalCount)} sub={`${pctOptimal}% dari total aset`} badge />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-800">Distribusi Umur Aset (Berdasarkan Umur_tahun)</span>
            <SisBadge />
          </div>
          <svg viewBox="0 0 560 110" className="w-full" style={{ height: 110 }}>
            {histData.map((d, i) => {
              const bw = 60, gap = 32, x = 20 + i * (bw + gap);
              const h = (d.count / maxCount) * 80;
              const color = d.range.startsWith(">") || d.range.startsWith("11") ? RED : d.range.startsWith("9") ? AMBER : GREEN;
              return (
                <g key={d.range}>
                  <rect x={x} y={90 - h} width={bw} height={h} rx={4} fill={color} fillOpacity={0.7} />
                  <text x={x + bw / 2} y={105} textAnchor="middle" fontSize={8} fill="#9CA3AF">{d.range}</text>
                  <text x={x + bw / 2} y={90 - h - 5} textAnchor="middle" fontSize={9} fill="#374151" fontWeight={600}>{d.count}</text>
                </g>
              );
            })}
          </svg>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ backgroundColor: GREEN }} /><span className="text-xs text-gray-500">Usia Aman (0-8 thn)</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ backgroundColor: AMBER }} /><span className="text-xs text-gray-500">Mendekati Batas (9-10 thn)</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ backgroundColor: RED }} /><span className="text-xs text-gray-500">Melewati / Kritis (&gt; 10 thn)</span></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-800 mb-4">Aset Melewati Masa Manfaat — Perlu Tindak Lanjut (Top 10)</p>
          <table className="w-full text-left">
            <THead cols={["Kode", "Nama Aset", "Kat.", "Thn. Buku", "Masa Manfaat", "Umur Aktual", "Status"]} />
            <tbody className="divide-y divide-gray-50">
              {asetExpired.map((r, i) => (
                <tr key={r.id + "-" + i} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{r.id}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{r.nama}</td>
                  <td className="px-4 py-3"><SoftBadge label={r.kat} color="gray" /></td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.thnBeli}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{r.masaManfaat} thn</td>
                  <td className="px-4 py-3 text-sm font-bold text-red-600">{r.umurAktual} thn</td>
                  <td className="px-4 py-3"><SoftBadge label={r.status} color="red" /></td>
                </tr>
              ))}
              {asetExpired.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                    Tidak ada aset yang melewati masa manfaat standar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <RekSistem level={expiredCount > 0 ? "Tinggi" : "OK"}>
          {expiredCount > 0
            ? `${fmtNum(expiredCount)} aset telah melewati masa manfaat standar. Segera lakukan kajian teknis dan proses peremajaan/penghapusan sesuai regulasi BMN/BMD.`
            : "Seluruh aset dalam kondisi usia ekonomis aman dan belum ada yang melewati masa manfaat."}
        </RekSistem>
      </>
    );
  }

  if (tab === "Prioritas Penggantian") {
    /**
     * Formula Skor Risiko / Prioritas Penggantian (0 - 100):
     * 1. Bobot Kondisi Fisik (Maks 40 poin):
     *    - Rusak Berat = 40, Rusak Ringan = 25, Cukup = 10, Baik = 0
     * 2. Bobot Usia / Expiry (Maks 40 poin):
     *    - Sisa masa manfaat <= 0 bulan = 40, <= 24 bulan = 25, lainnya (Umur/10)*15
     * 3. Bobot Nilai Aset (Maks 20 poin):
     *    - HargaSatuan >= 100jt = 20, >= 50jt = 15, lainnya = 5
     */
    const prioritasList = allAssets.map(a => {
      const cond = normKondisi(a.Kondisi);
      const sisaBulan = parseInt(a._sisa_masa_manfaat_bulan || "0") || 0;
      const harga = parseInt(a._harga_perolehan || "0") || 0;
      const age = parseInt(a.Umur_tahun || "0") || 0;

      let scoreCond = cond === "Rusak Berat" ? 40 : cond === "Rusak Ringan" ? 25 : cond === "Cukup" ? 10 : 0;
      let scoreAge = sisaBulan <= 0 ? 40 : sisaBulan <= 24 ? 25 : Math.min(Math.round((age / 10) * 15), 15);
      let scoreValue = harga >= 100_000_000 ? 20 : harga >= 50_000_000 ? 15 : 5;

      const skorRisiko = scoreCond + scoreAge + scoreValue;
      let prioritas: "Sangat Tinggi" | "Tinggi" | "Sedang" | "Rendah" = "Rendah";
      if (skorRisiko >= 75) prioritas = "Sangat Tinggi";
      else if (skorRisiko >= 55) prioritas = "Tinggi";
      else if (skorRisiko >= 35) prioritas = "Sedang";

      return {
        id: a.id || a.KodeBarang || "-",
        nama: a.Nama_Barang || "Aset",
        kat: a.TipeAset || "PM",
        kondisi: cond,
        skorRisiko,
        umur: age,
        nilaiGanti: fmtRupiahShort(harga),
        hargaNum: harga,
        prioritas,
      };
    }).sort((a, b) => b.skorRisiko - a.skorRisiko);

    const sangatTinggiCount = prioritasList.filter(p => p.prioritas === "Sangat Tinggi").length;
    const tinggiCount = prioritasList.filter(p => p.prioritas === "Tinggi").length;
    const sedangCount = prioritasList.filter(p => p.prioritas === "Sedang").length;

    const topHighPriority = prioritasList.filter(p => p.prioritas === "Sangat Tinggi" || p.prioritas === "Tinggi");
    const totalEstAnggaran = topHighPriority.reduce((s, p) => s + p.hargaNum, 0);

    const topDisplay = prioritasList.slice(0, 10);
    const priColor = (p: string) => p === "Sangat Tinggi" ? "red" : p === "Tinggi" ? "amber" : p === "Sedang" ? "blue" : "gray";

    return (
      <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <KpiStat label="Prioritas Sangat Tinggi" value={fmtNum(sangatTinggiCount)} sub="Skor risiko ≥ 75" badge />
          <KpiStat label="Prioritas Tinggi" value={fmtNum(tinggiCount)} sub="Skor risiko 55–74" badge />
          <KpiStat label="Prioritas Sedang" value={fmtNum(sedangCount)} sub="Skor risiko 35–54" badge />
          <KpiStat label="Est. Anggaran Penggantian" value={fmtRupiahShort(totalEstAnggaran)} sub="Prioritas tinggi & sangat tinggi" badge />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-800">Ranking Prioritas Penggantian Aset (Top 10 Data Real)</span>
            <div className="flex items-center gap-2">
              <SisBadge />
              <button className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                <Download size={12} /> Export
              </button>
            </div>
          </div>
          <table className="w-full text-left">
            <THead cols={["#", "Kode", "Nama Aset", "Kat.", "Kondisi", "Skor Risiko", "Umur (thn)", "Nilai Perolehan", "Prioritas"]} />
            <tbody className="divide-y divide-gray-50">
              {topDisplay.map((r, i) => (
                <tr key={r.id + "-" + i} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-xs font-bold text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{r.id}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{r.nama}</td>
                  <td className="px-4 py-3"><SoftBadge label={r.kat} color="gray" /></td>
                  <td className="px-4 py-3"><SoftBadge label={r.kondisi} color={r.kondisi === "Rusak Berat" ? "red" : r.kondisi === "Rusak Ringan" ? "amber" : "blue"} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${r.skorRisiko}%`, backgroundColor: r.skorRisiko >= 75 ? RED : r.skorRisiko >= 55 ? AMBER : GREEN }} />
                      </div>
                      <span className="text-xs font-bold" style={{ color: r.skorRisiko >= 75 ? RED : r.skorRisiko >= 55 ? AMBER : GREEN }}>{r.skorRisiko}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-700">{r.umur}</td>
                  <td className="px-4 py-3 text-xs font-medium text-gray-800">{r.nilaiGanti}</td>
                  <td className="px-4 py-3"><SoftBadge label={r.prioritas} color={priColor(r.prioritas) as any} /></td>
                </tr>
              ))}
              {topDisplay.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">
                    Belum ada data aset untuk ranking prioritas penggantian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <RekSistem level={sangatTinggiCount + tinggiCount > 0 ? "Tinggi" : "OK"}>
          {sangatTinggiCount + tinggiCount > 0
            ? `${sangatTinggiCount + tinggiCount} aset berprioritas tinggi/sangat tinggi memerlukan penganggaran penggantian (Est. ${fmtRupiahShort(totalEstAnggaran)}).`
            : "Saat ini belum ada aset dengan skor risiko kritis yang membutuhkan penggantian mendesak."}
        </RekSistem>
      </>
    );
  }

  if (tab === "Kelayakan Aset") {
    const calcKelayakan = (items: typeof allAssets) => {
      const tidakLayak = items.filter(a => ["Rusak Ringan", "Rusak Berat"].includes(normKondisi(a.Kondisi)) || (parseInt(a._sisa_masa_manfaat_bulan || "0") || 0) <= 0).length;
      const layak = items.length - tidakLayak;
      return { layak, tidakLayak, total: items.length };
    };

    const layakData = allCampuses.map(cName => ({
      kampus: cName,
      ...calcKelayakan(campusAssetsMap.get(cName) || []),
    }));

    const totalLayak = layakData.reduce((s, r) => s + r.layak, 0);
    const totalTidakLayak = layakData.reduce((s, r) => s + r.tidakLayak, 0);
    const totalAssets = allAssets.length;
    const unverifiedCount = allAssets.filter(a => a.Verifikasi_status !== "Verified").length;

    const tidakLayakList = allAssets
      .filter(a => ["Rusak Ringan", "Rusak Berat"].includes(normKondisi(a.Kondisi)))
      .slice(0, 10)
      .map(a => ({
        id: a.id || a.KodeBarang || "-",
        nama: a.Nama_Barang || "Aset",
        kat: a.TipeAset || "PM",
        alasan: a.Keterangan && a.Keterangan !== "-" ? a.Keterangan : "Hasil inspeksi fisik menandai kondisi rusak",
        kondisi: normKondisi(a.Kondisi),
        kampus: resolveAssetCampus(a, assetRoomMap).replace("Kampus ", ""),
      }));

    return (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          <KpiStat label="Aset Layak Pakai" value={fmtNum(totalLayak)} sub={`${totalAssets > 0 ? ((totalLayak/totalAssets)*100).toFixed(1) : 0}% dari total aset`} badge />
          <KpiStat label="Aset Tidak Layak" value={fmtNum(totalTidakLayak)} sub={`${totalAssets > 0 ? ((totalTidakLayak/totalAssets)*100).toFixed(1) : 0}% dari total aset`} badge />
          <KpiStat label="Menunggu Kajian / Verifikasi" value={fmtNum(unverifiedCount)} sub="Perlu verifikasi fisik SO" badge />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-800">Kelayakan Aset per Kampus Real</span>
            <SisBadge />
          </div>
          <table className="w-full text-left">
            <THead cols={["Kampus", "Layak Pakai", "Tidak Layak", "% Layak"]} />
            <tbody className="divide-y divide-gray-50">
              {layakData.map(r => {
                const pct = r.total > 0 ? ((r.layak / r.total) * 100).toFixed(1) : "0.0";
                return (
                  <tr key={r.kampus} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-sm text-gray-800">{r.kampus}</td>
                    <td className="px-4 py-3 text-sm font-medium text-green-700">{r.layak.toLocaleString("id")}</td>
                    <td className="px-4 py-3 text-sm font-medium text-red-600">{r.tidakLayak.toLocaleString("id")}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: GREEN }} />
                        </div>
                        <span className="text-xs font-semibold text-gray-700 w-10 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-800 mb-4">Aset Tidak Layak Pakai — Hasil SO Real</p>
          <table className="w-full text-left">
            <THead cols={["Kode", "Nama Aset", "Kat.", "Alasan Tidak Layak", "Kondisi", "Kampus"]} />
            <tbody className="divide-y divide-gray-50">
              {tidakLayakList.map((r, i) => (
                <tr key={r.id + "-" + i} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{r.id}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{r.nama}</td>
                  <td className="px-4 py-3"><SoftBadge label={r.kat} color="gray" /></td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px]">{r.alasan}</td>
                  <td className="px-4 py-3"><SoftBadge label={r.kondisi} color="red" /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.kampus}</td>
                </tr>
              ))}
              {tidakLayakList.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                    Belum ada aset yang ditandai tidak layak berdasarkan verifikasi fisik.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <RekSistem level={totalTidakLayak > 0 ? "Sedang" : "OK"}>
          {totalTidakLayak > 0
            ? `Terdapat ${fmtNum(totalTidakLayak)} aset yang ditandai tidak layak/melewati masa manfaat. Prioritaskan verifikasi teknis dan peremajaan.`
            : "Seluruh aset terdaftar dalam status layak pakai berdasarkan data verifikasi saat ini."}
        </RekSistem>
      </>
    );
  }

  // Fallback: Kualitas Aset (Tab 1)
  const CATS: { key: string; label: string }[] = [
    { key: "PM", label: "Peralatan & Mesin (PM)" },
    { key: "ATB", label: "Aset Tak Berwujud (ATB)" },
    { key: "ATL", label: "Aset Tetap Lainnya (ATL)" },
    { key: "AL", label: "Alat Angkutan (AL)" },
  ];

  const skor = CATS.map(c => {
    const items = allAssets.filter(a => a.TipeAset === c.key);
    const total = items.length;
    const baik = items.filter(a => normKondisi(a.Kondisi) === "Baik").length;
    const cukup = items.filter(a => normKondisi(a.Kondisi) === "Cukup").length;
    const buruk = items.filter(a => ["Rusak Ringan", "Rusak Berat"].includes(normKondisi(a.Kondisi))).length;
    const skorVal = total > 0 ? Math.round((baik / total) * 1000) / 10 : 100;
    return { kat: c.label, skor: skorVal, baik, cukup, buruk, total };
  });

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {skor.map(k => (
          <KpiStat key={k.kat} label={`Skor Kualitas — ${k.kat.split(" (")[0]}`} value={`${k.skor}%`} sub={`Baik: ${fmtNum(k.baik)} | Rusak: ${fmtNum(k.buruk)}`} badge />
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-gray-800">Skor Kualitas per Kategori (Data Real)</span>
          <SisBadge />
        </div>
        <div className="space-y-4">
          {skor.map(k => (
            <div key={k.kat}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700">{k.kat}</span>
                <span className="text-xs font-bold" style={{ color: k.skor >= 90 ? GREEN : k.skor >= 75 ? AMBER : RED }}>{k.skor}%</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${k.skor}%`, backgroundColor: k.skor >= 90 ? GREEN : k.skor >= 75 ? AMBER : RED }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <RekSistem level="OK">
        Kualitas aset terpantau dari kondisi real database. Mayoritas aset terdaftar dalam kondisi Baik hingga verifikasi lapangan lanjutan dilaksanakan.
      </RekSistem>
    </>
  );
}

// ── MONITORING ────────────────────────────────────────────────────────────────

function MonitoringContent({ tab }: { tab: string }) {
  const store = useDataStore();
  const allAssets = store.assets;
  const storeRuangan = store.ruangan;

  const masterRooms: RuanganData[] = useMemo(() => {
    return (storeRuangan && storeRuangan.length > 0) ? storeRuangan : SEED_RUANGAN;
  }, [storeRuangan]);

  const { assetRoomMap } = useMemo(() => {
    return buildAssetRoomMap(allAssets, masterRooms);
  }, [allAssets, masterRooms]);

  const { realCampuses, allCampuses } = useMemo(() => {
    return getCanonicalCampusList(masterRooms);
  }, [masterRooms]);

  const campusAssetsMap = useMemo(() => {
    const map = new Map<string, typeof allAssets>();
    allCampuses.forEach(c => map.set(c, []));
    allAssets.forEach(a => {
      const cName = resolveAssetCampus(a, assetRoomMap);
      if (!map.has(cName)) map.set(cName, []);
      map.get(cName)!.push(a);
    });
    return map;
  }, [allAssets, allCampuses, assetRoomMap]);

  // State for Distribusi Aset drill-down navigation
  const [drill, setDrill] = useState<{
    level: "kampus" | "gedung" | "ruangan" | "aset";
    kampus?: string;
    gedung?: string;
    ruangan?: string;
  }>({ level: "kampus" });

  const normKondisi = (k?: string): "Baik" | "Cukup" | "Rusak Ringan" | "Rusak Berat" => {
    const s = (k || "").trim().toUpperCase();
    if (s === "RB" || s.includes("RUSAK BERAT")) return "Rusak Berat";
    if (s === "RR" || s.includes("RUSAK RINGAN") || s.includes("PERLU PERBAIKAN")) return "Rusak Ringan";
    if (s === "C" || s.includes("CUKUP") || s.includes("MONITORING")) return "Cukup";
    return "Baik";
  };

  const getKampus = (a: any) => resolveAssetCampus(a, assetRoomMap);

  const getGedung = (a: any) => {
    const matchedRoom = assetRoomMap.get(String(a.id || a.kode_tag_aset || ""));
    if (matchedRoom && matchedRoom.gedung) return matchedRoom.gedung;
    const loc = String(a.Nama_ruangan || a.Id_ruangan || "").toUpperCase();
    if (loc.includes("GEDUNG A") || loc.includes("BUILDING A")) return "Gedung A";
    if (loc.includes("GEDUNG B") || loc.includes("BUILDING B")) return "Gedung B";
    if (loc.includes("GEDUNG C") || loc.includes("BUILDING C")) return "Gedung C";
    if (loc.includes("GEDUNG D") || loc.includes("BUILDING D")) return "Gedung D";
    if (loc.includes("DEKANAT")) return "Gedung Dekanat";
    if (loc.includes("GUDANG")) return "Gudang Utama";
    return "Gedung Utama / Ruangan Terdaftar";
  };

  // Shared location asset filters
  const assetsWithLoc = allAssets.filter(a => String(a.Nama_ruangan || a.Id_ruangan || "").trim() !== "");
  const assetsNoLoc = allAssets.filter(a => !String(a.Nama_ruangan || a.Id_ruangan || "").trim());

  // Unique rooms
  const uniqueRooms = Array.from(new Set(assetsWithLoc.map(a => String(a.Nama_ruangan || a.Id_ruangan || "").trim())));

  // ── Tab 1: Distribusi Aset ──────────────────────────────────────────────
  if (tab === "Distribusi Aset") {
    const getCatCounts = (items: typeof allAssets) => {
      const pm = items.filter(a => a.TipeAset === "PM").length;
      const atb = items.filter(a => a.TipeAset === "ATB").length;
      const atl = items.filter(a => a.TipeAset === "ATL").length;
      const al = items.filter(a => a.TipeAset === "AL").length;
      return { pm, atb, atl, al, total: items.length };
    };

    const distKampus = allCampuses.map(cName => ({
      kampus: cName,
      ...getCatCounts(campusAssetsMap.get(cName) || []),
    }));

    // Drilldown handlers
    const renderDrillContent = () => {
      if (drill.level === "kampus") {
        return (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-800">Distribusi Aset per Kampus Real (Level 1: Kampus)</span>
              <SisBadge />
            </div>
            <table className="w-full text-left">
              <THead cols={["Kampus", "PM", "ATB", "ATL", "AL", "Total Aset", "Aksi"]} />
              <tbody className="divide-y divide-gray-50">
                {distKampus.map(r => (
                  <tr key={r.kampus} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{r.kampus}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{fmtNum(r.pm)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{fmtNum(r.atb)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{fmtNum(r.atl)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{fmtNum(r.al)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{fmtNum(r.total)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDrill({ level: "gedung", kampus: r.kampus })}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        Lihat Gedung &rarr;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      if (drill.level === "gedung" && drill.kampus) {
        const kAssets = campusAssetsMap.get(drill.kampus) || allAssets.filter(a => resolveAssetCampus(a, assetRoomMap) === drill.kampus);
        const gedungMap = new Map<string, typeof allAssets>();
        kAssets.forEach(a => {
          const gName = getGedung(a);
          if (!gedungMap.has(gName)) gedungMap.set(gName, []);
          gedungMap.get(gName)!.push(a);
        });

        const gedungList = Array.from(gedungMap.entries()).map(([gName, items]) => ({
          gedung: gName,
          total: items.length,
          roomsCount: new Set(items.map(a => String(a.Nama_ruangan || a.Id_ruangan || "").trim()).filter(Boolean)).size,
          cat: getCatCounts(items),
        }));

        return (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setDrill({ level: "kampus" })} className="text-xs text-blue-600 hover:underline">
                  Semua Kampus
                </button>
                <span className="text-xs text-gray-400">&gt;</span>
                <span className="text-sm font-semibold text-gray-800">{drill.kampus} (Level 2: Gedung)</span>
              </div>
              <SisBadge />
            </div>
            <table className="w-full text-left">
              <THead cols={["Gedung", "Jml. Ruangan", "PM", "ATB", "ATL", "AL", "Total Aset", "Aksi"]} />
              <tbody className="divide-y divide-gray-50">
                {gedungList.map(r => (
                  <tr key={r.gedung} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{r.gedung}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{r.roomsCount > 0 ? `${r.roomsCount} Ruangan` : "Belum diatur"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{fmtNum(r.cat.pm)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{fmtNum(r.cat.atb)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{fmtNum(r.cat.atl)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{fmtNum(r.cat.al)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{fmtNum(r.total)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDrill({ level: "ruangan", kampus: drill.kampus, gedung: r.gedung })}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        Lihat Ruangan &rarr;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      if (drill.level === "ruangan" && drill.kampus && drill.gedung) {
        const gAssets = (campusAssetsMap.get(drill.kampus) || allAssets.filter(a => resolveAssetCampus(a, assetRoomMap) === drill.kampus)).filter(a => getGedung(a) === drill.gedung);
        const roomMap = new Map<string, typeof allAssets>();
        gAssets.forEach(a => {
          const rName = String(a.Nama_ruangan || a.Id_ruangan || "").trim() || "Tanpa Ruangan Spesifik";
          if (!roomMap.has(rName)) roomMap.set(rName, []);
          roomMap.get(rName)!.push(a);
        });

        const roomList = Array.from(roomMap.entries()).map(([rName, items]) => ({
          ruangan: rName,
          kode: items[0]?.Id_ruangan || "—",
          total: items.length,
          baik: items.filter(a => normKondisi(a.Kondisi) === "Baik" || normKondisi(a.Kondisi) === "Cukup").length,
          items,
        }));

        return (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setDrill({ level: "kampus" })} className="text-xs text-blue-600 hover:underline">
                  Semua Kampus
                </button>
                <span className="text-xs text-gray-400">&gt;</span>
                <button onClick={() => setDrill({ level: "gedung", kampus: drill.kampus })} className="text-xs text-blue-600 hover:underline">
                  {drill.kampus}
                </button>
                <span className="text-xs text-gray-400">&gt;</span>
                <span className="text-sm font-semibold text-gray-800">{drill.gedung} (Level 3: Ruangan)</span>
              </div>
              <SisBadge />
            </div>
            <table className="w-full text-left">
              <THead cols={["Kode", "Nama Ruangan", "Jml. Aset", "Kondisi OK", "Aksi"]} />
              <tbody className="divide-y divide-gray-50">
                {roomList.map(r => (
                  <tr key={r.ruangan} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">{r.kode}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{r.ruangan}</td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{fmtNum(r.total)}</td>
                    <td className="px-4 py-3 text-sm text-green-700">{fmtNum(r.baik)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDrill({ level: "aset", kampus: drill.kampus, gedung: drill.gedung, ruangan: r.ruangan })}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        Lihat Aset &rarr;
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      if (drill.level === "aset" && drill.ruangan && drill.kampus && drill.gedung) {
        const rAssets = (campusAssetsMap.get(drill.kampus) || allAssets.filter(a => resolveAssetCampus(a, assetRoomMap) === drill.kampus))
          .filter(a => getGedung(a) === drill.gedung && String(a.Nama_ruangan || a.Id_ruangan || "").trim() === (drill.ruangan === "Tanpa Ruangan Spesifik" ? "" : drill.ruangan))
          .slice(0, 15);

        return (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button onClick={() => setDrill({ level: "kampus" })} className="text-xs text-blue-600 hover:underline">
                  Semua Kampus
                </button>
                <span className="text-xs text-gray-400">&gt;</span>
                <button onClick={() => setDrill({ level: "gedung", kampus: drill.kampus })} className="text-xs text-blue-600 hover:underline">
                  {drill.kampus}
                </button>
                <span className="text-xs text-gray-400">&gt;</span>
                <button onClick={() => setDrill({ level: "ruangan", kampus: drill.kampus, gedung: drill.gedung })} className="text-xs text-blue-600 hover:underline">
                  {drill.gedung}
                </button>
                <span className="text-xs text-gray-400">&gt;</span>
                <span className="text-sm font-semibold text-gray-800">{drill.ruangan} (Level 4: Aset)</span>
              </div>
              <SisBadge />
            </div>
            <table className="w-full text-left">
              <THead cols={["Kode", "Nama Barang", "Kat.", "Kondisi", "Thn. Buku", "Harga Satuan"]} />
              <tbody className="divide-y divide-gray-50">
                {rAssets.map((r, i) => (
                  <tr key={r.id + "-" + i} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">{r.id || r.KodeBarang || "-"}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{r.Nama_Barang}</td>
                    <td className="px-4 py-3"><SoftBadge label={r.TipeAset || "PM"} color="gray" /></td>
                    <td className="px-4 py-3"><SoftBadge label={normKondisi(r.Kondisi)} color={normKondisi(r.Kondisi) === "Baik" ? "green" : "amber"} /></td>
                    <td className="px-4 py-3 text-sm text-gray-600">{r.TahunBuku || "—"}</td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-800">{r.HargaSatuan || "—"}</td>
                  </tr>
                ))}
                {rAssets.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                      Tidak ada aset terdaftar di ruangan ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      }

      return null;
    };

    return (
      <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <KpiStat label="Total Kampus Terdaftar" value={String(realCampuses.length)} sub={realCampuses.map(c => c.replace("Kampus ", "")).join(", ")} badge />
          <KpiStat label="Total Ruangan Terdaftar" value={fmtNum(uniqueRooms.length)} sub="Dengan data aset terdaftar" badge />
          <KpiStat label="Aset Tanpa Lokasi" value={fmtNum(assetsNoLoc.length)} sub="Perlu verifikasi fisik/SO" badge />
          <KpiStat label="Aset Dipindah (30 hari)" value="Belum ada data" sub="Berdasarkan mutasi SO" badge />
        </div>

        {renderDrillContent()}

        <RekSistem level="Sedang">
          Sebanyak {fmtNum(assetsNoLoc.length)} aset ({allAssets.length > 0 ? ((assetsNoLoc.length / allAssets.length) * 100).toFixed(1) : 0}%) belum memiliki data lokasi ruangan terdaftar. Data lokasi akan terisi secara dinamis bertahap saat petugas melaksanakan Stock Opname (SO).
        </RekSistem>
      </>
    );
  }

  // ── Tab 2: Komposisi Aset ──────────────────────────────────────────────
  if (tab === "Komposisi Aset") {
    const itemMap = new Map<string, { count: number; category: string }>();

    allAssets.forEach(a => {
      const name = (a.Nama_Barang || "Lainnya").trim();
      const cat = a.TipeAset || "PM";
      if (!itemMap.has(name)) {
        itemMap.set(name, { count: 0, category: cat });
      }
      itemMap.get(name)!.count++;
    });

    const sortedItems = Array.from(itemMap.entries())
      .map(([name, data]) => ({ name, count: data.count, cat: data.category }))
      .sort((a, b) => b.count - a.count);

    const totalAssetCount = allAssets.length;
    const top10 = sortedItems.slice(0, 10);
    const remainingCount = sortedItems.slice(10).reduce((sum, item) => sum + item.count, 0);

    const chartData = top10.map(item => ({
      label: item.name,
      value: item.count,
    }));

    if (remainingCount > 0) {
      chartData.push({ label: "Lainnya", value: remainingCount });
    }

    const maxChartVal = Math.max(...chartData.map(d => d.value), 1);
    const top1Item = sortedItems[0] || { name: "—", count: 0 };
    const top1Pct = totalAssetCount > 0 ? ((top1Item.count / totalAssetCount) * 100).toFixed(1) : "0.0";

    return (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
          <KpiStat label="Tipe Aset Terdaftar" value={fmtNum(sortedItems.length)} sub="Dari database real Nama_Barang" badge />
          <KpiStat label="Tipe Terbanyak" value={top1Item.name} sub={`${fmtNum(top1Item.count)} unit (${top1Pct}%)`} badge />
          <KpiStat label="Diversifikasi Aset" value={`${fmtNum(sortedItems.length)} Jenis`} sub="Item barang unik terdaftar" badge />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-800">Komposisi Aset per Tipe Nama Barang Real (Top 10)</span>
            <SisBadge />
          </div>
          <HBarChart data={chartData} maxVal={maxChartVal} />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm font-semibold text-gray-800 mb-4">Detail Breakdown Top Jenis Barang</p>
          <table className="w-full text-left">
            <THead cols={["#", "Nama Barang / Tipe", "Kategori Utama", "Jumlah Unit", "% dari Total Aset"]} />
            <tbody className="divide-y divide-gray-50">
              {top10.map((item, idx) => {
                const pct = totalAssetCount > 0 ? ((item.count / totalAssetCount) * 100).toFixed(1) : "0.0";
                return (
                  <tr key={item.name} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 text-xs font-bold text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{item.name}</td>
                    <td className="px-4 py-3"><SoftBadge label={item.cat} color="gray" /></td>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">{fmtNum(item.count)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{pct}%</td>
                  </tr>
                );
              })}
              {remainingCount > 0 && (
                <tr className="hover:bg-gray-50/50 bg-gray-50/30">
                  <td className="px-4 py-3 text-xs font-bold text-gray-400">11+</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-600">Lainnya ({sortedItems.length - 10} jenis barang)</td>
                  <td className="px-4 py-3"><SoftBadge label="Campuran" color="gray" /></td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">{fmtNum(remainingCount)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {totalAssetCount > 0 ? ((remainingCount / totalAssetCount) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  // ── Tab 3: Aset per Ruangan ─────────────────────────────────────────────
  if (tab === "Aset per Ruangan") {
    const roomMap = new Map<string, typeof allAssets>();

    assetsWithLoc.forEach(a => {
      const rName = String(a.Nama_ruangan || a.Id_ruangan || "").trim();
      if (!roomMap.has(rName)) roomMap.set(rName, []);
      roomMap.get(rName)!.push(a);
    });

    const ruanganData = Array.from(roomMap.entries()).map(([rName, items]) => {
      const first = items[0];
      const kode = first.Id_ruangan || `RNG-${rName.slice(0, 3).toUpperCase()}`;
      const kampus = getKampus(first);
      const kondisiOk = items.filter(a => normKondisi(a.Kondisi) === "Baik" || normKondisi(a.Kondisi) === "Cukup").length;
      return {
        kode,
        nama: rName,
        kampus,
        kat: first.TipeAset || "PM",
        jumlah: items.length,
        kapasitas: "—",
        kondisiOk,
        utilPct: "—",
        status: "Terdaftar",
      };
    });

    return (
      <>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <KpiStat label="Total Ruangan Terdaftar" value={fmtNum(ruanganData.length)} sub="Memiliki aset terhubung" badge />
          <KpiStat label="Ruangan Over Kapasitas" value="0" sub="Kapasitas lum diatur admin" badge />
          <KpiStat label="Ruangan Belum Optimal" value="0" sub="Utilisasi lum dihitung" badge />
          <KpiStat label="Aset Tanpa Ruangan" value={fmtNum(assetsNoLoc.length)} sub="Perlu verifikasi fisik SO" badge />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-800">Aset per Ruangan (Data Real Terdaftar)</span>
            <SisBadge />
          </div>
          <table className="w-full text-left">
            <THead cols={["Kode", "Nama Ruangan", "Kampus", "Kategori", "Jml. Aset", "Kapasitas", "Kondisi OK", "Util. (%)", "Status"]} />
            <tbody className="divide-y divide-gray-50">
              {ruanganData.map(r => (
                <tr key={r.nama} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{r.kode}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800">{r.nama}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.kampus}</td>
                  <td className="px-4 py-3"><SoftBadge label={r.kat} color="gray" /></td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900">{r.jumlah}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{r.kapasitas}</td>
                  <td className="px-4 py-3 text-sm font-medium text-green-700">{r.kondisiOk}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{r.utilPct}</td>
                  <td className="px-4 py-3">
                    <SoftBadge label="Normal" color="green" />
                  </td>
                </tr>
              ))}
              {ruanganData.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">
                    Belum ada data lokasi ruangan yang terhubung dengan aset. Data akan terisi bertahap melalui verifikasi Stock Opname.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <RekSistem level="OK">
          Sebagian besar aset ({fmtNum(assetsNoLoc.length)} unit) saat ini belum memiliki lokasi ruangan terdaftar. Pengaturan kapasitas ruangan dan utilisasi dapat diatur melalui Menu Lokasi & Ruangan oleh Administrator.
        </RekSistem>
      </>
    );
  }

  // ── Tab 4: Pertumbuhan Aset (TahunBuku Real) ───────────────────────────
  const yearMap = new Map<string, number>();

  allAssets.forEach(a => {
    let year = a.TahunBuku || a.TglPerolehan?.slice(-4) || "";
    if (!year || isNaN(Number(year))) year = "Lainnya";
    if (!yearMap.has(year)) yearMap.set(year, 0);
    yearMap.set(year, yearMap.get(year)! + 1);
  });

  const sortedYears = Array.from(yearMap.entries())
    .filter(([y]) => y !== "Lainnya" && Number(y) >= 2010)
    .map(([thn, count]) => ({ thn: Number(thn), count }))
    .sort((a, b) => a.thn - b.thn);

  let cumTotal = 0;
  const pertumbuhanList = sortedYears.map(item => {
    cumTotal += item.count;
    return {
      thn: item.thn.toString(),
      jumlah: item.count,
      kumulatif: cumTotal,
      pct: allAssets.length > 0 ? ((item.count / allAssets.length) * 100).toFixed(1) : "0.0",
    };
  });

  const topYear = sortedYears.reduce((max, cur) => cur.count > max.count ? cur : max, { thn: 2026, count: 0 });
  const year2026 = sortedYears.find(y => y.thn === 2026) || { count: 0 };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <span className="text-xs text-gray-500 font-medium">Rentang Tahun Buku</span>
          <div className="text-xl font-bold text-gray-900 mt-1">
            {sortedYears.length > 0 ? `${sortedYears[0].thn} – ${sortedYears[sortedYears.length - 1].thn}` : "2017–2026"}
          </div>
          <span className="text-[11px] text-gray-400 mt-0.5 block">{sortedYears.length} tahun pencatatan terdaftar</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <span className="text-xs text-gray-500 font-medium">Puncak Perolehan Aset</span>
          <div className="text-xl font-bold text-gray-900 mt-1">{topYear.thn}</div>
          <span className="text-[11px] text-gray-400 mt-0.5 block">{fmtNum(topYear.count)} unit perolehan</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <span className="text-xs text-gray-500 font-medium">Tahun Buku Terkini (2026)</span>
          <div className="text-xl font-bold text-gray-900 mt-1">{fmtNum(year2026.count)} unit</div>
          <span className="text-[11px] text-gray-400 mt-0.5 block">Perolehan terdaftar di 2026</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-gray-800">Jumlah Aset Berdasarkan Tahun Buku (Data Real Database)</span>
          <SisBadge />
        </div>
        <table className="w-full text-left">
          <THead cols={["Tahun Buku", "Jumlah Perolehan", "Kumulatif Total"]} />
          <tbody className="divide-y divide-gray-50">
            {pertumbuhanList.map(r => (
              <tr key={r.thn} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 text-sm font-semibold text-gray-800">{r.thn}</td>
                <td className="px-4 py-3 text-sm font-bold text-green-700">+{fmtNum(r.jumlah)}</td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900">{fmtNum(r.kumulatif)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-gray-400 mt-3">* Data mencerminkan tahun perolehan/buku (TahunBuku) dari data existing BMN/BMD.</p>
      </div>

      <RekSistem level="OK">
        Distribusi tahun buku menunjukkan rekaman historis perolehan BMN/BMD IPB dari {sortedYears.length > 0 ? sortedYears[0].thn : 2017} hingga 2026 dengan puncak perolehan di tahun {topYear.thn}.
      </RekSistem>
    </>
  );
}

// ── HISTORY PENGADAAN TAB (with Filters) ──────────────────────────────────────

function HistoryPengadaanTab({ allAssets }: { allAssets: any[] }) {
  const [searchQ, setSearchQ] = useState("");
  const [katFilter, setKatFilter] = useState<string>("");
  const [sumberFilter, setSumberFilter] = useState<string>("");
  const [tglDari, setTglDari] = useState("");
  const [tglSampai, setTglSampai] = useState("");
  const [page, setPage] = useState(1);
  const [showFilter, setShowFilter] = useState(false);
  const pageSize = 20;

  // Parse date from various asset date fields
  const parseDateStr = (a: any): string => {
    return a.Tgl_pengadaan || a.Tgl_transaksi || a.TahunBuku || "";
  };

  // Extract year from date string for range filter
  const extractYear = (dateStr: string): number => {
    if (!dateStr) return 0;
    // Try "YYYY" format
    const yearMatch = dateStr.match(/(\d{4})/);
    return yearMatch ? parseInt(yearMatch[1]) : 0;
  };

  // Unique sumber dana list
  const sumberDanaList = useMemo(() => {
    const set = new Set<string>();
    allAssets.forEach(a => {
      const s = (a.SumberDana || "").trim();
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  }, [allAssets]);

  // Category counts
  const catCounts = useMemo(() => {
    const counts: Record<string, number> = { PM: 0, ATB: 0, ATL: 0, AL: 0 };
    allAssets.forEach(a => {
      const k = a.TipeAset || "PM";
      if (k in counts) counts[k]++;
    });
    return counts;
  }, [allAssets]);

  // Apply filters
  const filtered = useMemo(() => {
    const q = searchQ.toLowerCase().trim();
    const dariYear = tglDari ? parseInt(tglDari) : 0;
    const sampaiYear = tglSampai ? parseInt(tglSampai) : 9999;

    return allAssets.filter(a => {
      // Category filter
      if (katFilter && (a.TipeAset || "PM") !== katFilter) return false;

      // Sumber dana filter
      if (sumberFilter && (a.SumberDana || "").trim() !== sumberFilter) return false;

      // Date/year range filter
      if (dariYear > 0 || sampaiYear < 9999) {
        const year = extractYear(parseDateStr(a));
        if (year > 0) {
          if (dariYear > 0 && year < dariYear) return false;
          if (sampaiYear < 9999 && year > sampaiYear) return false;
        } else if (dariYear > 0) {
          return false; // skip assets with no date if filter is active
        }
      }

      // Text search
      if (q) {
        const name = (a.Nama_Barang || "").toLowerCase();
        const code = (a.KodeBarang || a.id || "").toLowerCase();
        const doc = (a.Dokumen || a.Referensi || "").toLowerCase();
        const sumber = (a.SumberDana || "").toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !doc.includes(q) && !sumber.includes(q)) return false;
      }

      return true;
    });
  }, [allAssets, katFilter, sumberFilter, tglDari, tglSampai, searchQ]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // Reset page on filter change
  const resetPage = () => setPage(1);

  const hasActiveFilter = !!(katFilter || sumberFilter || tglDari || tglSampai || searchQ);

  const katButtons: { key: string; label: string; color: string; bg: string }[] = [
    { key: "PM",  label: "PM",  color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
    { key: "ATB", label: "ATB", color: "text-sky-700",    bg: "bg-sky-50 border-sky-200" },
    { key: "ATL", label: "ATL", color: "text-teal-700",   bg: "bg-teal-50 border-teal-200" },
    { key: "AL",  label: "AL",  color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
  ];

  return (
    <>
      {/* Filter Panel */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-sm font-semibold text-gray-800">History & Catatan Pengadaan Aset</span>
              <p className="text-xs text-gray-400 mt-0.5">Data real database BMN/BMD — filter & eksplorasi riwayat pengadaan</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilter(!showFilter)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
                  showFilter || hasActiveFilter
                    ? "bg-[#111827] text-white border-[#111827]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
              >
                <Filter size={13} />
                Filter
                {hasActiveFilter && (
                  <span className="ml-1 w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">✓</span>
                )}
              </button>
              <SisBadge />
            </div>
          </div>
        </div>

        {/* Expandable Filter Area */}
        {showFilter && (
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 space-y-3">
            {/* Row 1: Category toggle buttons */}
            <div>
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Kategori</label>
              <div className="flex flex-wrap gap-2">
                {katButtons.map(kb => {
                  const isActive = katFilter === kb.key;
                  return (
                    <button
                      key={kb.key}
                      onClick={() => { setKatFilter(isActive ? "" : kb.key); resetPage(); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                        isActive
                          ? `${kb.bg} ${kb.color} ring-1 ring-current`
                          : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      {kb.label}
                      <span className="text-[10px] opacity-70">({fmtNum(catCounts[kb.key] || 0)})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row 2: Sumber Dana + Date Range */}
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Sumber Dana */}
              <div className="flex-1 min-w-[180px]">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Sumber Dana</label>
                <div className="relative">
                  <select
                    value={sumberFilter}
                    onChange={e => { setSumberFilter(e.target.value); resetPage(); }}
                    className="w-full text-xs border border-gray-200 rounded-lg pl-3 pr-8 py-2 bg-white outline-none focus:ring-1 focus:ring-gray-400 appearance-none cursor-pointer"
                  >
                    <option value="">Semua Sumber Dana</option>
                    {sumberDanaList.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Date Range: Dari Tahun */}
              <div className="min-w-[120px]">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Dari Tahun</label>
                <input
                  type="number"
                  min="2000"
                  max="2030"
                  placeholder="2017"
                  value={tglDari}
                  onChange={e => { setTglDari(e.target.value); resetPage(); }}
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>

              {/* Date Range: Sampai Tahun */}
              <div className="min-w-[120px]">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Sampai Tahun</label>
                <input
                  type="number"
                  min="2000"
                  max="2030"
                  placeholder="2026"
                  value={tglSampai}
                  onChange={e => { setTglSampai(e.target.value); resetPage(); }}
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
            </div>

            {/* Row 3: Text Search + Reset */}
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
              <div className="relative flex-1 min-w-[220px]">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 block">Pencarian</label>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={searchQ}
                    onChange={e => { setSearchQ(e.target.value); resetPage(); }}
                    placeholder="Cari nama barang, kode aset, dokumen..."
                    className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg bg-white outline-none focus:ring-1 focus:ring-gray-400"
                  />
                </div>
              </div>
              {hasActiveFilter && (
                <button
                  onClick={() => { setKatFilter(""); setSumberFilter(""); setTglDari(""); setTglSampai(""); setSearchQ(""); resetPage(); }}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <XCircle size={12} /> Reset Semua Filter
                </button>
              )}
            </div>
          </div>
        )}

        {/* Result indicator */}
        <div className="px-5 py-2.5 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Menampilkan <span className="font-bold text-gray-800">{fmtNum(filtered.length)}</span> dari <span className="font-bold text-gray-800">{fmtNum(allAssets.length)}</span> data pengadaan
            {hasActiveFilter && <span className="ml-1 text-amber-600 font-medium">(terfilter)</span>}
          </p>
          {!showFilter && hasActiveFilter && (
            <button
              onClick={() => setShowFilter(true)}
              className="text-[11px] text-blue-600 hover:underline font-medium"
            >
              Tampilkan filter aktif
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <THead cols={["Kode / ID Aset", "Nama Barang", "Kategori", "Sumber Dana", "Tgl / Tahun Pengadaan", "Harga Satuan (Rp)", "Dokumen / Ref"]} />
            <tbody className="divide-y divide-gray-50">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Database size={32} strokeWidth={1} />
                      <p className="text-sm font-medium">Tidak ada data pengadaan ditemukan</p>
                      <p className="text-xs">Coba sesuaikan filter atau kata kunci pencarian</p>
                    </div>
                  </td>
                </tr>
              ) : paginated.map((r, i) => (
                <tr key={(r.id || r.KodeBarang || "") + "-" + i} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{r.KodeBarang || r.id || "—"}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-800 max-w-[220px] truncate">{r.Nama_Barang}</td>
                  <td className="px-4 py-3"><SoftBadge label={r.TipeAset || "PM"} color="gray" /></td>
                  <td className="px-4 py-3 text-xs text-gray-600">{r.SumberDana || "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.Tgl_pengadaan || r.Tgl_transaksi || r.TahunBuku || "—"}</td>
                  <td className="px-4 py-3 text-xs font-bold text-gray-900">{fmtRupiahShort(parseVal(r.HargaSatuan))}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{r.Dokumen || r.Referensi || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-5 py-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-gray-400">
            Halaman <span className="font-semibold text-gray-700">{page}</span> dari <span className="font-semibold text-gray-700">{totalPages}</span>
            {" "}· <span className="font-semibold text-gray-700">{paginated.length}</span> baris ditampilkan
          </p>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1 text-xs font-medium text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            {/* Page number buttons (up to 5) */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = idx + 1;
              } else if (page <= 3) {
                pageNum = idx + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + idx;
              } else {
                pageNum = page - 2 + idx;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-7 h-7 text-xs font-medium rounded-md transition-colors ${
                    page === pageNum
                      ? "bg-[#111827] text-white"
                      : "text-gray-500 border border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1 text-xs font-medium text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── PENGADAAN DASH ────────────────────────────────────────────────────────────

// ── PENGADAAN DASH ────────────────────────────────────────────────────────────

function PengadaanDashContent({ tab }: { tab: string }) {
  const store = useDataStore();
  const allAssets = store.assets || [];

  const parseVal = (v: any) => {
    if (!v) return 0;
    if (typeof v === "number") return v;
    const num = parseFloat(String(v).replace(/[^0-9.-]+/g, ""));
    return isNaN(num) ? 0 : num;
  };

  const totalNilai = allAssets.reduce((sum, a) => sum + parseVal(a.HargaSatuan), 0);

  const sumberMap = new Map<string, { count: number; totalVal: number }>();
  allAssets.forEach(a => {
    const s = (a.SumberDana || "Lainnya/Belum Diisi").trim();
    if (!sumberMap.has(s)) sumberMap.set(s, { count: 0, totalVal: 0 });
    const item = sumberMap.get(s)!;
    item.count++;
    item.totalVal += parseVal(a.HargaSatuan);
  });

  const sortedSumber = Array.from(sumberMap.entries())
    .map(([sDana, d]) => ({ label: sDana, value: d.count, totalVal: d.totalVal }))
    .sort((a, b) => b.value - a.value);

  const chartSumber = sortedSumber.map(s => ({
    label: s.label,
    value: s.value,
  }));
  const maxSumberVal = Math.max(...chartSumber.map(d => d.value), 1);

  if (tab === "Ringkasan Pengadaan" || tab === "Statistik Pengadaan") {
    const topSumber = sortedSumber[0] || { label: "—", value: 0 };
    const avgHarga = allAssets.length > 0 ? totalNilai / allAssets.length : 0;

    return (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiStat label="Total Aset Terdaftar" value={fmtNum(allAssets.length)} sub="Seluruh populasi aset real" badge />
          <KpiStat label="Nilai Total Pengadaan" value={fmtRupiahShort(totalNilai)} sub="Akumulasi HargaSatuan real" badge />
          <KpiStat label="Rata-rata Nilai / Unit" value={fmtRupiahShort(avgHarga)} sub="Berdasarkan populasi aset" badge />
          <KpiStat label="Sumber Dana Utama" value={topSumber.label} sub={`${fmtNum(topSumber.value)} unit aset`} badge />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-800">Distribusi per Sumber Dana (Data Real)</span>
              <SisBadge />
            </div>
            <HBarChart data={chartSumber} maxVal={maxSumberVal} />
            <p className="text-xs text-gray-400 mt-3">* Menampilkan unit pengadaan berdasarkan sumber dana terdaftar.</p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-800">Breakdown Anggaran per Sumber Dana</span>
              <SisBadge />
            </div>
            <table className="w-full text-left">
              <THead cols={["Sumber Dana", "Jumlah Unit", "Total Nilai (Rp)", "% Total"]} />
              <tbody className="divide-y divide-gray-50">
                {sortedSumber.map(s => {
                  const pct = totalNilai > 0 ? ((s.totalVal / totalNilai) * 100).toFixed(1) : "0.0";
                  return (
                    <tr key={s.label} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800">{s.label}</td>
                      <td className="px-4 py-3 text-sm font-bold text-gray-900">{fmtNum(s.value)}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-green-700">{fmtRupiahShort(s.totalVal)}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <RekSistem level="OK">
          Pengadaan aset terintegrasi secara dinamis dengan {fmtNum(sortedSumber.length)} variasi sumber dana terdaftar di database BMN/BMD.
        </RekSistem>
      </>
    );
  }

  if (tab === "History Pengadaan") {
    return <HistoryPengadaanTab allAssets={allAssets} />;
  }

  // Fallback
  return null;
}

// ── MAINTENANCE DASH ──────────────────────────────────────────────────────────

// ── MAINTENANCE DASH ──────────────────────────────────────────────────────────

function MaintenanceDashContent({ tab }: { tab: string }) {
  const storeMnt = useDataStore();
  const tickets = storeMnt.maintenanceTickets || [];
  const assets = storeMnt.assets || [];

  const assetMap = useMemo(() => {
    const map = new Map<string, any>();
    assets.forEach(a => {
      if (a.id) map.set(a.id, a);
      if (a.KodeBarang) map.set(a.KodeBarang, a);
    });
    return map;
  }, [assets]);

  const totalCount = tickets.length;
  const selesaiCount = tickets.filter(t => t.status === "Selesai").length;
  const prosesCount = tickets.filter(t => t.status === "Dalam Proses").length;
  const menungguCount = tickets.filter(t => t.status === "Menunggu").length;

  const catMap = new Map<string, { count: number; totalBiaya: number }>();
  ["PM", "ATB", "ATL", "AL"].forEach(k => catMap.set(k, { count: 0, totalBiaya: 0 }));

  tickets.forEach(t => {
    const ast = assetMap.get(t.asset_id);
    const kat = ast?.TipeAset || "PM";
    const cur = catMap.get(kat) || { count: 0, totalBiaya: 0 };
    cur.count += 1;
    cur.totalBiaya += t.biaya || 0;
    catMap.set(kat, cur);
  });

  const catData = Array.from(catMap.entries()).map(([kat, val]) => ({
    label: kat === "PM" ? "Peralatan & Mesin" : kat === "ATB" ? "Aset Tak Berwujud" : kat === "ATL" ? "Aset Tetap Lainnya" : "Alat Angkutan",
    kat,
    count: val.count,
    totalBiaya: val.totalBiaya,
  }));

  const maxCatCount = Math.max(...catData.map(c => c.count), 1);

  const totalBiayaTickets = tickets.reduce((s, t) => s + (t.biaya || 0), 0);
  const totalBiayaAssets = assets.reduce((s, a) => s + (parseInt(a._total_biaya_maintenance ?? "0") || 0), 0);
  const totalBiaya = totalBiayaTickets > 0 ? totalBiayaTickets : totalBiayaAssets;

  const avgBiaya = totalCount > 0 ? totalBiaya / totalCount : 0;

  const sortedByCost = [...catData].sort((a, b) => b.totalBiaya - a.totalBiaya);
  const topCostCat = totalBiaya > 0 && sortedByCost[0] && sortedByCost[0].totalBiaya > 0 ? sortedByCost[0].kat : "—";

  if (tab === "Ringkasan Perbaikan") {
    const pctSelesai = totalCount > 0 ? ((selesaiCount / totalCount) * 100).toFixed(1) + "%" : "0%";
    return (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiStat label="Total Perbaikan" value={fmtNum(totalCount)} sub="Semua status & kategori" badge />
          <KpiStat label="Selesai" value={fmtNum(selesaiCount)} sub={`${pctSelesai} dari total`} badge />
          <KpiStat label="Dalam Proses" value={fmtNum(prosesCount)} sub="Sedang dikerjakan" badge />
          <KpiStat label="Menunggu" value={fmtNum(menungguCount)} sub="Belum ditangani" badge />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-800">Distribusi per Kategori Aset</span>
              <SisBadge />
            </div>
            <HBarChart
              data={catData.map(c => ({ label: c.label, value: c.count }))}
              maxVal={maxCatCount}
            />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-800">Status Perbaikan</span>
              <SisBadge />
            </div>
            {[
              { s: "Selesai", ct: selesaiCount, color: GREEN },
              { s: "Dalam Proses", ct: prosesCount, color: BLUE },
              { s: "Menunggu", ct: menungguCount, color: AMBER },
            ].map(r => (
              <div key={r.s} className="flex items-center gap-3 mb-3">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                <span className="text-xs text-gray-600 flex-1">{r.s}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${totalCount > 0 ? (r.ct / totalCount) * 100 : 0}%`, backgroundColor: r.color }} />
                </div>
                <span className="text-xs font-bold text-gray-900 w-8 text-right">{r.ct}</span>
              </div>
            ))}
          </div>
        </div>
        {menungguCount > 0 ? (
          <RekSistem level="Sedang">
            {menungguCount} perbaikan masih dalam status Menunggu. Disarankan segera menugaskan teknisi untuk mencegah backlog operasional.
          </RekSistem>
        ) : (
          <RekSistem level="OK">
            Status pemeliharaan dan perbaikan aset tercatat secara real-time dari database.
          </RekSistem>
        )}
      </>
    );
  }

  if (tab === "Biaya Perbaikan") {
    const maxCatBiaya = Math.max(...catData.map(c => c.totalBiaya), 1);
    return (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <KpiStat label="Total Biaya Perbaikan" value={fmtRupiahShort(totalBiaya)} sub="Akumulasi biaya maintenance" badge />
          <KpiStat label="Rata-rata per Perbaikan" value={fmtRupiahShort(avgBiaya)} sub={`Berdasarkan ${totalCount} tiket`} badge />
          <KpiStat label="Biaya Terbesar (Kategori)" value={topCostCat} sub="Kategori biaya tertinggi" badge />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-gray-800">Breakdown Biaya per Kategori Aset</span>
            <SisBadge />
          </div>
          <HBarChart
            data={catData.map(c => ({ label: c.label, value: Math.round(c.totalBiaya / 1_000_000) }))}
            maxVal={Math.max(1, Math.round(maxCatBiaya / 1_000_000))}
          />
          <p className="text-xs text-gray-400 mt-3">Satuan: Rp juta</p>
        </div>
        <RekSistem level="OK">
          Rincian biaya perbaikan disinkronisasikan dari tiket pemeliharaan aset terdaftar.
        </RekSistem>
      </>
    );
  }

  // Tab History Perbaikan
  const teknisiPool = storeMnt.users.filter(u => u.role === "Teknisi").map(u => u.nama);
  const histRaw = [...tickets].sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));
  const hist = histRaw.map((t, idx) => {
    const a = assetMap.get(t.asset_id);
    const aset = a ? `${a.id || a.KodeBarang} – ${a.Nama_Barang}` : t.asset_id;
    const teknisi = teknisiPool.length ? teknisiPool[idx % teknisiPool.length] : "—";
    const biaya = t.status === "Selesai" ? Math.round(t.biaya / 1000) : null;
    return {
      id: t.id,
      aset,
      keluhan: t.kategori_kerusakan + (t.catatan ? ` — ${t.catatan}` : ""),
      tgl: t.tanggal,
      teknisi,
      biaya,
      status: t.status,
    };
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-sm font-semibold text-gray-800">Riwayat Perbaikan Aset</span>
          <p className="text-xs text-gray-400 mt-0.5">Daftar perbaikan yang telah diinput di sistem</p>
        </div>
        {hist.length > 0 && (
          <button className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
            <Download size={12} /> Export
          </button>
        )}
      </div>
      <table className="w-full text-left">
        <THead cols={["No. Perbaikan", "Aset", "Keluhan", "Tgl. Mulai", "Teknisi", "Biaya", "Status"]} />
        <tbody className="divide-y divide-gray-50">
          {hist.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center text-xs text-gray-400">
                Belum ada riwayat perbaikan terdaftar.
              </td>
            </tr>
          ) : (
            hist.map(r => (
              <tr key={r.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 text-xs font-mono text-gray-500">{r.id}</td>
                <td className="px-4 py-3 text-xs text-gray-700 max-w-[140px] truncate">{r.aset}</td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-[180px] truncate">{r.keluhan}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{r.tgl}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{r.teknisi}</td>
                <td className="px-4 py-3 text-xs font-medium text-gray-800">{r.biaya != null ? `Rp ${r.biaya.toLocaleString("id")} rb` : "—"}</td>
                <td className="px-4 py-3"><SoftBadge label={r.status} color={r.status === "Selesai" ? "green" : "blue"} /></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── LOKASI KAMPUS ─────────────────────────────────────────────────────────────

type RoomDatum = {
  id: string;
  kode: string;
  nama: string;
  gedung: string;
  namaGedung: string;
  lantai: string;
  kategori: string;
  luas: number;
  kapasitasOrang: number;
  aset: number;
  obsAset: number;
  obsNilai: number;
  kondisiOk: number;
  nilaiBuku: number;
  lat: number | null;
  lng: number | null;
  referensiDenah: string | null;
  statusLokasi: "Terverifikasi" | "Belum Diverifikasi" | "Perlu Verifikasi" | "Tidak Diketahui";
  unit: string;
};

type CampusAssetRow = {
  id: string;
  kode: string;
  nama: string;
  kategori: string;
  unit: string;
  nilaiBuku: number;
  kondisi: string;
  statusPakai: "Aktif" | "Idle" | "Dipinjam";
  statusLokasi: "Terverifikasi" | "Belum Diverifikasi" | "Tidak Sesuai" | "Perlu Verifikasi";
  statusLokasiColor: "green" | "amber" | "red" | "gray";
  ruangan: string;
  namaRuangan: string;
  kodeRuangan: string;
  roomId: string;
  namaGedung: string;
  lantai: string;
  rawNamaRuangan: string;
};

function LokasiKampusContent({ page, tab, onTabChange }: { page: string; tab: string; onTabChange?: (tab: string) => void }) {
  // Always default to "Ringkasan" if tab is empty or invalid
  const currentTab = (!tab || !["Ringkasan", "Aset per Ruangan", "Denah / Floorplan"].includes(tab)) ? "Ringkasan" : tab;
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [treeSearch, setTreeSearch] = useState("");
  const [filterGedung, setFilterGedung] = useState("Semua");
  const [filterLantai, setFilterLantai] = useState("Semua");
  const [filterKategori, setFilterKategori] = useState("Semua");
  const [sumberFilter, setSumberFilter] = useState<"Semua" | "BMN" | "Observasi">("Semua");
  const [showUnmatchedReport, setShowUnmatchedReport] = useState(false);

  // Room More Menu State
  const [isRoomMenuOpen, setIsRoomMenuOpen] = useState(false);
  const roomMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (roomMenuRef.current && !roomMenuRef.current.contains(e.target as Node)) {
        setIsRoomMenuOpen(false);
      }
    };
    if (isRoomMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isRoomMenuOpen]);

  // CRUD Modals State
  const [isAddGedungOpen, setIsAddGedungOpen] = useState(false);
  const [addGedungForm, setAddGedungForm] = useState({
    namaGedung: "",
    kampus: "",
    alamat: "",
  });

  const [isAddRuanganOpen, setIsAddRuanganOpen] = useState(false);
  const [addRuanganForm, setAddRuanganForm] = useState({
    namaRuangan: "",
    kodeRuangan: "",
    namaGedung: "",
    kampus: "",
    level: "1",
    kategori: "Kelas",
    luas: 0,
    kapasitas: 0,
    unitPengguna: "Sekolah Vokasi (SV)",
  });

  const [editingRuangan, setEditingRuangan] = useState<RuanganData | null>(null);
  const [editRuanganForm, setEditRuanganForm] = useState({
    namaRuangan: "",
    kodeRuangan: "",
    namaGedung: "",
    kampus: "",
    level: "1",
    kategori: "Kelas",
    luas: 0,
    kapasitas: 0,
    unitPengguna: "Sekolah Vokasi (SV)",
  });

  const [deletingRuangan, setDeletingRuangan] = useState<RuanganData | null>(null);
  const [deletingGedung, setDeletingGedung] = useState<{ namaGedung: string; kampus: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    ruangan: storeRuangan,
    assets: storeAssets,
    stockOpnameRecords,
    observasiItems,
    createRuangan,
    updateRuangan,
    deleteRuangan,
    deleteGedung,
  } = useDataStore();

  const { showToast } = useApp();

  const namaKampus =
    page === "kampus-cilibende"
      ? "Kampus Cilibende"
      : page === "kampus-gunung-gede"
      ? "Kampus Gunung Gede"
      : page === "kampus-pajajaran"
      ? "Kampus Pajajaran"
      : page === "kampus-baranangsiang"
      ? "Kampus Baranangsiang"
      : page === "kampus-belum-dikategorikan"
      ? "Belum Dikategorikan"
      : "Kampus / Lokasi Lainnya";

  const KAMPUS_LIST = [
    "Kampus Cilibende",
    "Kampus Gunung Gede",
    "Kampus Pajajaran",
    "Kampus Baranangsiang",
    "Kampus / Lokasi Lainnya",
    "Belum Dikategorikan",
  ];

  const KATEGORI_LIST = [
    "Kelas",
    "Laboratorium",
    "Kantor",
    "Ruang Rapat",
    "Perpustakaan",
    "Musholla",
    "Gudang",
    "Toilet",
    "Umum",
    "Lainnya",
  ];

  // Master rooms (256 canonical rooms from database or SEED fallback)
  const masterRooms: RuanganData[] = useMemo(() => {
    return (storeRuangan && storeRuangan.length > 0) ? storeRuangan : SEED_RUANGAN;
  }, [storeRuangan]);

  // Match all assets to master rooms using the unified canonical matcher
  const { assetRoomMap, unmatchedRoomsReport, totalUnmatchedCount } = useMemo(() => {
    return buildAssetRoomMap(storeAssets, masterRooms);
  }, [storeAssets, masterRooms]);

  // Master rooms in the currently active campus
  const campusRuangan = useMemo(() => {
    return masterRooms.filter(
      (r) =>
        r.kampus === namaKampus ||
        (namaKampus === "Kampus / Lokasi Lainnya" && (r.kampus === "Kampus Lainnya" || r.kampus === "Kampus / Lokasi Lainnya"))
    );
  }, [masterRooms, namaKampus]);

  // Assets strictly belonging to the currently active campus
  const campusAssets: CampusAssetRow[] = useMemo(() => {
    const list: CampusAssetRow[] = [];

    storeAssets.forEach((a) => {
      const assetKey = String(a.id || a.kode_tag_aset || "");
      const matchedRoom = assetRoomMap.get(assetKey);
      if (!matchedRoom) return;

      const isThisCampus =
        matchedRoom.kampus === namaKampus ||
        (namaKampus === "Kampus / Lokasi Lainnya" &&
          (matchedRoom.kampus === "Kampus Lainnya" || matchedRoom.kampus === "Kampus / Lokasi Lainnya"));

      if (!isThisCampus) return;

      // Determine verification status from real Stock Opname records
      const soRecord = (stockOpnameRecords || []).find(
        (r) => r.asset_id === assetKey || (a.kode_tag_aset && r.kode_tag === a.kode_tag_aset)
      );

      let statusLokasi: CampusAssetRow["statusLokasi"] = "Belum Diverifikasi";
      let statusLokasiColor: CampusAssetRow["statusLokasiColor"] = "amber";

      if (soRecord) {
        if (soRecord.status_opname === "Terverifikasi" || soRecord.status_lokasi === "Sesuai") {
          statusLokasi = "Terverifikasi";
          statusLokasiColor = "green";
        } else if (soRecord.status_lokasi === "Pindah" || soRecord.status_lokasi === "Tidak Sesuai") {
          statusLokasi = "Tidak Sesuai";
          statusLokasiColor = "red";
        } else {
          statusLokasi = "Perlu Verifikasi";
          statusLokasiColor = "amber";
        }
      } else {
        const explicitVerif = String(a.status_opname_terakhir || a.status_lokasi_opname_terakhir || "");
        if (explicitVerif === "Terverifikasi" || explicitVerif === "Sesuai") {
          statusLokasi = "Terverifikasi";
          statusLokasiColor = "green";
        } else {
          statusLokasi = "Belum Diverifikasi";
          statusLokasiColor = "amber";
        }
      }

      list.push({
        id: assetKey,
        kode: String(a.kode_tag_aset || a.KodeBarang || a.id || "-"),
        nama: String(a.Nama_Barang || a.nama_barang || a.nama || "Aset"),
        kategori: String(a.TipeAset || a.jenis_aset || "PM"),
        unit: String(a.Nama_unit || a.nama_unit || "Sekolah Vokasi (SV)"),
        nilaiBuku: Math.round(parseVal(a._nilai_buku || a.nilai_buku || a.NilaiBuku || "0") / 1000),
        kondisi: String(a.Kondisi || a.kondisi || "Baik"),
        statusPakai: (a.Trx_status === "Aktif" || a.trx_status === "Aktif" ? "Aktif" : a.Trx_status === "Dipinjam" || a.trx_status === "Dipinjam" ? "Dipinjam" : "Idle") as any,
        statusLokasi,
        statusLokasiColor,
        ruangan: `${matchedRoom.namaRuangan} (${matchedRoom.kodeRuangan})`,
        namaRuangan: matchedRoom.namaRuangan || "-",
        kodeRuangan: matchedRoom.kodeRuangan || "-",
        roomId: String(matchedRoom.id),
        namaGedung: matchedRoom.namaGedung || "Gedung Tanpa Nama",
        lantai: String(matchedRoom.level || 1),
        rawNamaRuangan: String(a.Nama_ruangan || a.nama_ruangan || ""),
      });
    });

    return list;
  }, [storeAssets, assetRoomMap, namaKampus, stockOpnameRecords]);

  // Aggregate room data (with precise asset counts from matched campusAssets & observasiItems)
  const rooms: RoomDatum[] = useMemo(() => {
    // 1-pass aggregation map for BMN assets by roomId
    const bmnMap = new Map<string, { count: number; okCount: number; nilaiBuku: number; allVerified: boolean }>();
    campusAssets.forEach((a) => {
      const rid = String(a.roomId);
      let entry = bmnMap.get(rid);
      if (!entry) {
        entry = { count: 0, okCount: 0, nilaiBuku: 0, allVerified: true };
        bmnMap.set(rid, entry);
      }
      entry.count += 1;
      if (a.kondisi === "Baik") entry.okCount += 1;
      entry.nilaiBuku += a.nilaiBuku;
      if (a.statusLokasi !== "Terverifikasi") entry.allVerified = false;
    });

    // 1-pass aggregation map for Observasi items by ruanganId
    const obsMap = new Map<string, { count: number; nilai: number }>();
    (observasiItems || []).forEach((o) => {
      const rid = String(o.ruanganId);
      let entry = obsMap.get(rid);
      if (!entry) {
        entry = { count: 0, nilai: 0 };
        obsMap.set(rid, entry);
      }
      entry.count += 1;
      entry.nilai += Number(o.jumlahHarga) || 0;
    });

    return campusRuangan.map((r) => {
      const roomId = String(r.id);
      const bmn = bmnMap.get(roomId) || { count: 0, okCount: 0, nilaiBuku: 0, allVerified: false };
      const obs = obsMap.get(roomId) || { count: 0, nilai: 0 };

      return {
        id: roomId,
        kode: r.kodeRuangan || `R-${r.id}`,
        nama: r.namaRuangan || "Ruangan Tanpa Nama",
        gedung: r.namaGedung || "Gedung Tanpa Nama",
        namaGedung: r.namaGedung || "Gedung Tanpa Nama",
        lantai: String(r.level || 1),
        kategori: r.kategori || "Umum",
        luas: r.luas || 0,
        kapasitasOrang: r.kapasitas || 0,
        aset: bmn.count,
        obsAset: obs.count,
        obsNilai: obs.nilai,
        kondisiOk: bmn.okCount,
        nilaiBuku: bmn.nilaiBuku,
        lat: null,
        lng: null,
        referensiDenah: null,
        statusLokasi: bmn.count > 0 && bmn.allVerified ? "Terverifikasi" : bmn.count > 0 ? "Belum Diverifikasi" : "Perlu Verifikasi",
        unit: r.unitPengguna || "Sekolah Vokasi (SV)",
      };
    });
  }, [campusRuangan, campusAssets, observasiItems]);

  const gedungList   = useMemo(() => [...new Set(rooms.map(r => r.namaGedung))].sort(), [rooms]);
  const lantaiList   = useMemo(() => [...new Set(rooms.map(r => r.lantai))].sort(), [rooms]);
  const kategoriList = useMemo(() => [...new Set(rooms.map(r => r.kategori))].sort(), [rooms]);

  const filteredRooms = useMemo(() => rooms.filter(r =>
    (filterGedung   === "Semua" || r.namaGedung === filterGedung) &&
    (filterLantai   === "Semua" || r.lantai     === filterLantai) &&
    (filterKategori === "Semua" || r.kategori   === filterKategori)
  ), [rooms, filterGedung, filterLantai, filterKategori]);

  const treeRooms = useMemo(() => filteredRooms.filter(r =>
    treeSearch === "" ||
    String(r.nama || "").toLowerCase().includes(treeSearch.toLowerCase()) ||
    String(r.kode || "").toLowerCase().includes(treeSearch.toLowerCase())
  ), [filteredRooms, treeSearch]);

  const selectedRoomData = useMemo(() => {
    if (selectedRoom) {
      const found = rooms.find(r => r.id === selectedRoom);
      if (found) return found;
    }
    // Default directly to the first room so Ringkasan panel is immediately shown without needing to click first
    if (treeRooms.length > 0) return treeRooms[0];
    if (rooms.length > 0) return rooms[0];
    return null;
  }, [selectedRoom, rooms, treeRooms]);

  // Registered BMN Assets for this room
  const selectedRoomBmnAssets = useMemo(() => {
    if (!selectedRoomData) return [];
    return campusAssets.filter((a) => a.roomId === selectedRoomData.id);
  }, [selectedRoomData, campusAssets]);

  // Observed Items for this room
  const selectedRoomObsItems = useMemo(() => {
    if (!selectedRoomData) return [];
    return (observasiItems || []).filter((o) => String(o.ruanganId) === String(selectedRoomData.id));
  }, [selectedRoomData, observasiItems]);

  const totalSelectedRoomAssetsCount = selectedRoomBmnAssets.length + selectedRoomObsItems.length;

  const [expandedGedung, setExpandedGedung] = useState<Record<string, boolean>>({});

  const toggleGedung = (gedungName: string) => {
    setExpandedGedung(prev => ({
      ...prev,
      [gedungName]: prev[gedungName] === undefined ? false : !prev[gedungName]
    }));
  };

  const isGedungExpanded = (gedungName: string) => {
    return expandedGedung[gedungName] !== false; // Default true (expanded)
  };

  const gedungCount = new Set(rooms.map(r => r.namaGedung)).size;

  // Group for accordion view: Gedung -> Ruangan
  const treeByGedung: Record<string, RoomDatum[]> = useMemo(() => {
    const grouped: Record<string, RoomDatum[]> = {};
    treeRooms.forEach(r => {
      if (!grouped[r.namaGedung]) grouped[r.namaGedung] = [];
      grouped[r.namaGedung].push(r);
    });
    return grouped;
  }, [treeRooms]);

  // Open Add Gedung Modal
  const openAddGedung = () => {
    setAddGedungForm({
      namaGedung: "",
      kampus: namaKampus,
      alamat: "",
    });
    setIsAddGedungOpen(true);
  };

  // Handle Add Gedung Submit
  const handleAddGedungSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addGedungForm.namaGedung.trim()) {
      showToast("Nama Gedung wajib diisi.", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      // Create initial room in the new building
      await createRuangan({
        namaGedung: addGedungForm.namaGedung.trim(),
        kampus: addGedungForm.kampus || namaKampus,
        alamat: addGedungForm.alamat.trim() || undefined,
        namaRuangan: `Ruang Utama ${addGedungForm.namaGedung.trim()}`,
        kodeRuangan: `R-${Date.now().toString().slice(-4)}`,
        level: 1,
        kategori: "Umum",
        luas: 0,
        kapasitas: 0,
        unitPengguna: "Sekolah Vokasi (SV)",
      });
      showToast(`Gedung "${addGedungForm.namaGedung}" berhasil ditambahkan!`, "success");
      setIsAddGedungOpen(false);
    } catch (err: any) {
      showToast("Gagal menambahkan gedung: " + (err?.message || "Kesalahan tidak diketahui"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Add Ruangan Modal
  const openAddRuangan = (defaultGedung?: string) => {
    setAddRuanganForm({
      namaRuangan: "",
      kodeRuangan: "",
      namaGedung: defaultGedung || (gedungList.length > 0 ? gedungList[0] : "Gedung A"),
      kampus: namaKampus,
      level: "1",
      kategori: "Kelas",
      luas: 36,
      kapasitas: 30,
      unitPengguna: "Sekolah Vokasi (SV)",
    });
    setIsAddRuanganOpen(true);
  };

  // Handle Add Ruangan Submit
  const handleAddRuanganSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addRuanganForm.namaRuangan.trim()) {
      showToast("Nama Ruangan wajib diisi.", "error");
      return;
    }
    if (!addRuanganForm.namaGedung.trim()) {
      showToast("Nama Gedung wajib diisi.", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      await createRuangan({
        namaRuangan: addRuanganForm.namaRuangan.trim(),
        kodeRuangan: addRuanganForm.kodeRuangan.trim() || `R-${Date.now().toString().slice(-4)}`,
        namaGedung: addRuanganForm.namaGedung.trim(),
        kampus: addRuanganForm.kampus || namaKampus,
        level: Number(addRuanganForm.level) || 1,
        kategori: addRuanganForm.kategori || "Kelas",
        luas: Number(addRuanganForm.luas) || 0,
        kapasitas: Number(addRuanganForm.kapasitas) || 0,
        unitPengguna: addRuanganForm.unitPengguna.trim() || "Sekolah Vokasi (SV)",
      });
      showToast(`Ruangan "${addRuanganForm.namaRuangan}" berhasil ditambahkan!`, "success");
      setIsAddRuanganOpen(false);
    } catch (err: any) {
      showToast("Gagal menambahkan ruangan: " + (err?.message || "Kesalahan tidak diketahui"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Ruangan Modal
  const openEditRuangan = (roomItem: RoomDatum | RuanganData) => {
    const origRoom = masterRooms.find(r => String(r.id) === String(roomItem.id)) || (roomItem as any);
    setEditingRuangan(origRoom);
    setEditRuanganForm({
      namaRuangan: origRoom.namaRuangan || origRoom.nama || "",
      kodeRuangan: origRoom.kodeRuangan || origRoom.kode || "",
      namaGedung: origRoom.namaGedung || origRoom.gedung || "",
      kampus: origRoom.kampus || namaKampus,
      level: String(origRoom.level ?? origRoom.lantai ?? "1"),
      kategori: origRoom.kategori || "Kelas",
      luas: Number(origRoom.luas) || 0,
      kapasitas: Number(origRoom.kapasitas ?? origRoom.kapasitasOrang) || 0,
      unitPengguna: origRoom.unitPengguna || origRoom.unit || "Sekolah Vokasi (SV)",
    });
  };

  // Handle Edit Ruangan Submit
  const handleEditRuanganSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRuangan) return;
    if (!editRuanganForm.namaRuangan.trim()) {
      showToast("Nama Ruangan wajib diisi.", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      await updateRuangan(editingRuangan.id, {
        namaRuangan: editRuanganForm.namaRuangan.trim(),
        kodeRuangan: editRuanganForm.kodeRuangan.trim(),
        namaGedung: editRuanganForm.namaGedung.trim(),
        kampus: editRuanganForm.kampus,
        level: Number(editRuanganForm.level) || 1,
        kategori: editRuanganForm.kategori,
        luas: Number(editRuanganForm.luas) || 0,
        kapasitas: Number(editRuanganForm.kapasitas) || 0,
        unitPengguna: editRuanganForm.unitPengguna.trim(),
      });
      showToast(`Ruangan "${editRuanganForm.namaRuangan}" berhasil diperbarui!`, "success");
      setEditingRuangan(null);
    } catch (err: any) {
      showToast("Gagal memperbarui ruangan: " + (err?.message || "Kesalahan tidak diketahui"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Delete Ruangan Modal
  const openDeleteRuangan = (roomItem: RoomDatum | RuanganData) => {
    const origRoom = masterRooms.find(r => String(r.id) === String(roomItem.id)) || (roomItem as any);
    setDeletingRuangan(origRoom);
  };

  // Handle Confirm Delete Ruangan
  const handleConfirmDeleteRuangan = async () => {
    if (!deletingRuangan) return;
    setIsSubmitting(true);
    try {
      await deleteRuangan(deletingRuangan.id);
      showToast(`Ruangan "${deletingRuangan.namaRuangan || deletingRuangan.nama}" berhasil dihapus. Relasi aset telah dialihkan ke Aset Tanpa Lokasi.`, "info");
      if (selectedRoom === String(deletingRuangan.id)) {
        setSelectedRoom(null);
      }
      setDeletingRuangan(null);
    } catch (err: any) {
      showToast("Gagal menghapus ruangan: " + (err?.message || "Kesalahan tidak diketahui"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Delete Gedung Modal
  const openDeleteGedung = (gedungName: string) => {
    setDeletingGedung({ namaGedung: gedungName, kampus: namaKampus });
  };

  // Handle Confirm Delete Gedung
  const handleConfirmDeleteGedung = async () => {
    if (!deletingGedung) return;
    setIsSubmitting(true);
    try {
      await deleteGedung(deletingGedung.namaGedung, deletingGedung.kampus);
      showToast(`Gedung "${deletingGedung.namaGedung}" beserta seluruh ruangannya berhasil dihapus. Relasi aset telah dialihkan ke Aset Tanpa Lokasi.`, "info");
      if (selectedRoomData && selectedRoomData.namaGedung === deletingGedung.namaGedung) {
        setSelectedRoom(null);
      }
      setDeletingGedung(null);
    } catch (err: any) {
      showToast("Gagal menghapus gedung: " + (err?.message || "Kesalahan tidak diketahui"), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to count affected assets for a room
  const getAffectedAssetsForRoom = (room: RuanganData | null) => {
    if (!room) return { bmn: 0, obs: 0, total: 0 };
    const bmn = campusAssets.filter(a => a.roomId === String(room.id)).length;
    const obs = (observasiItems || []).filter(o => String(o.ruanganId) === String(room.id)).length;
    return { bmn, obs, total: bmn + obs };
  };

  // Helper to count affected assets for a gedung
  const getAffectedAssetsForGedung = (gedungName: string) => {
    const roomsInGedung = campusRuangan.filter(r => r.namaGedung === gedungName);
    const roomIds = new Set(roomsInGedung.map(r => String(r.id)));
    const bmn = campusAssets.filter(a => roomIds.has(a.roomId)).length;
    const obs = (observasiItems || []).filter(o => roomIds.has(String(o.ruanganId))).length;
    return { roomCount: roomsInGedung.length, bmn, obs, total: bmn + obs };
  };

  // Auto-select first room if none selected
  useEffect(() => {
    if (!selectedRoom && filteredRooms.length > 0) {
      setSelectedRoom(String(filteredRooms[0].id));
    }
  }, [filteredRooms, selectedRoom]);

  // Shared filter bar with CRUD actions
  const filterBar = (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="p-2 text-slate-400 hidden sm:flex items-center justify-center">
          <SlidersHorizontal size={16} />
        </div>
        <select
          value={filterGedung}
          onChange={e => setFilterGedung(e.target.value)}
          className="bg-white border border-slate-200/90 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs outline-none cursor-pointer hover:border-slate-300 min-h-[38px]"
        >
          <option value="Semua">Semua Gedung ({gedungList.length})</option>
          {gedungList.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select
          value={filterLantai}
          onChange={e => setFilterLantai(e.target.value)}
          className="bg-white border border-slate-200/90 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs outline-none cursor-pointer hover:border-slate-300 min-h-[38px]"
        >
          <option value="Semua">Semua Lantai</option>
          {lantaiList.map(l => <option key={l} value={l}>{l === "B1" ? "Basement" : `Lantai ${l}`}</option>)}
        </select>
        <select
          value={filterKategori}
          onChange={e => setFilterKategori(e.target.value)}
          className="bg-white border border-slate-200/90 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs outline-none cursor-pointer hover:border-slate-300 min-h-[38px]"
        >
          <option value="Semua">Semua Kategori</option>
          {kategoriList.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={openAddGedung}
          className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors border border-slate-200/90 shadow-2xs min-h-[38px] cursor-pointer"
        >
          <Building size={14} className="text-slate-500" />
          <span>Tambah Gedung</span>
        </button>
        <button
          type="button"
          onClick={() => openAddRuangan()}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#0B1E33] hover:bg-[#112D4E] text-white rounded-xl text-xs font-bold transition-colors shadow-xs min-h-[38px] cursor-pointer"
        >
          <Plus size={14} />
          <span>Tambah Ruangan</span>
        </button>
      </div>
    </div>
  );

  // Informational banner for Belum Dikategorikan
  const isBelumDikategorikan = namaKampus === "Belum Dikategorikan";
  const unassignedNotice = isBelumDikategorikan ? (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 shadow-xs">
      <div className="p-1.5 bg-amber-100 rounded-lg text-amber-700 shrink-0">
        <HelpCircle size={18} />
      </div>
      <div className="space-y-1">
        <h4 className="text-xs font-bold text-amber-900">
          Kategori Khusus: Ruangan & Gedung Belum Terkonfirmasi Kampusnya
        </h4>
        <p className="text-xs text-amber-800 leading-relaxed">
          Ruangan dalam kategori ini berasal dari data sumber BMN yang belum memiliki informasi gedung/kampus definitif. Anda dapat memverifikasi fisik ke lapangan dan memindahkan ruangan ke kampus yang valid menggunakan tombol <strong>Edit</strong>, atau menambah/menghapus ruangan sesuai kebutuhan audit.
        </p>
      </div>
    </div>
  ) : null;

  // Shared KPI cards (2 cards)
  const kpiCards = (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-slate-400 block">Total Gedung</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{gedungCount}</span>
            <span className="text-xs text-slate-400 font-normal">Dalam kampus ini</span>
          </div>
        </div>
        <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <Building size={20} />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-slate-400 block">Total Ruangan</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{filteredRooms.length}</span>
            <span className="text-xs text-slate-400 font-normal">Sesuai filter aktif</span>
          </div>
        </div>
        <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <DoorClosed size={20} />
        </div>
      </div>
    </div>
  );

  // Tree view panel (Penjelajah ruangan)
  const treePanel = (
    <div className="col-span-1 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden" style={{ minHeight: 480, maxHeight: 640 }}>
      <div className="p-4 pb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Penjelajah ruangan</h3>
        <SlidersHorizontal size={15} className="text-slate-400" />
      </div>

      <div className="px-4 pb-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari ruangan / kode..."
            value={treeSearch}
            onChange={e => setTreeSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:bg-white font-medium"
          />
        </div>
      </div>

      <div className="overflow-y-auto flex-1 px-3 py-1 space-y-2">
        {Object.entries(treeByGedung).length === 0 && (
          <div className="text-center py-12 px-4">
            <Building size={28} className="mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-medium text-slate-500">Tidak ada ruangan</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Tambahkan ruangan baru dengan tombol di atas.</p>
          </div>
        )}
        {Object.entries(treeByGedung).map(([gedung, roomList]) => {
          const expanded = isGedungExpanded(gedung);

          // Group rooms by floor (Lantai)
          const roomsByFloor: Record<string, RoomDatum[]> = {};
          roomList.forEach(r => {
            const fl = r.lantai || "1";
            if (!roomsByFloor[fl]) roomsByFloor[fl] = [];
            roomsByFloor[fl].push(r);
          });
          const sortedFloors = Object.keys(roomsByFloor).sort((a, b) => {
            if (a === "B1") return -1;
            if (b === "B1") return 1;
            return a.localeCompare(b, undefined, { numeric: true });
          });

          return (
            <div key={gedung} className="space-y-1">
              <div
                onClick={() => toggleGedung(gedung)}
                className="flex items-center justify-between px-3 py-2 bg-slate-50/90 hover:bg-slate-100 rounded-xl border border-slate-200/80 cursor-pointer select-none transition-colors"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <Building size={14} className="text-blue-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-800 truncate">{gedung}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${expanded ? "" : "-rotate-90"}`} />
                </div>
              </div>

              {expanded && (
                <div className="space-y-2 pl-1 pr-1 pb-1">
                  {sortedFloors.map(floor => (
                    <div key={floor} className="space-y-0.5">
                      <div className="flex items-center gap-1.5 px-2.5 pt-1.5 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <Layers size={10} className="text-slate-400" />
                        <span>{floor === "B1" ? "BASEMENT" : `LANTAI ${floor}`}</span>
                      </div>
                      {roomsByFloor[floor].map(r => {
                        const isSelected = selectedRoomData?.id === r.id;
                        const bmnCount = r.aset;
                        const obsCount = r.obsAset;
                        return (
                          <div
                            key={r.id}
                            onClick={() => setSelectedRoom(r.id)}
                            className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                              isSelected
                                ? "bg-blue-50/80 text-blue-900 font-semibold border border-blue-200/90"
                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <DoorClosed size={14} className={isSelected ? "text-blue-600 shrink-0" : "text-slate-400 shrink-0"} />
                              <span className="truncate" title={r.nama}>{r.nama}</span>
                            </div>
                            {(bmnCount > 0 || obsCount > 0) && (
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                {bmnCount > 0 && (
                                  <span
                                    title={`${bmnCount} aset BMN`}
                                    className="inline-flex items-center justify-center px-1.5 py-0.5 min-w-[18px] text-[10px] font-bold font-mono rounded-md bg-blue-100 text-blue-700 shrink-0"
                                  >
                                    {bmnCount}
                                  </span>
                                )}
                                {obsCount > 0 && (
                                  <span
                                    title={`${obsCount} aset Observasi`}
                                    className="inline-flex items-center justify-center px-1.5 py-0.5 min-w-[18px] text-[10px] font-bold font-mono rounded-md bg-rose-100 text-rose-700 shrink-0"
                                  >
                                    {obsCount}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3 px-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400 font-medium">
        <span>{gedungCount} gedung · {filteredRooms.length} ruangan</span>
        <ChevronsUpDown size={14} className="text-slate-400" />
      </div>
    </div>
  );

  // Room detail panel
  const detailPanel = (
    <div className="col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6 overflow-hidden" style={{ minHeight: 480 }}>
      {selectedRoomData ? (
        <>
          {/* Room Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <DoorClosed size={24} strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{selectedRoomData.nama}</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedRoomData.namaGedung} / {selectedRoomData.lantai === "B1" ? "Basement" : `Lantai ${selectedRoomData.lantai}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onTabChange?.("Denah / Floorplan")}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
              >
                <MapIcon size={13} className="text-slate-500" />
                <span>Peta Inventaris</span>
              </button>

              {/* More menu popup */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsRoomMenuOpen(prev => !prev)}
                  className="p-2 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl text-slate-500 shadow-2xs transition-colors cursor-pointer"
                  title="Menu Ruangan"
                >
                  <MoreHorizontal size={15} />
                </button>
                {isRoomMenuOpen && (
                  <div
                    ref={roomMenuRef}
                    className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl border border-slate-200 shadow-xl z-20 py-1 animate-in fade-in duration-100"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setIsRoomMenuOpen(false);
                        openEditRuangan(selectedRoomData);
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Edit2 size={13} />
                      <span>Edit Ruangan</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRoomMenuOpen(false);
                        openDeleteRuangan(selectedRoomData);
                      }}
                      className="w-full px-3.5 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>Hapus Ruangan</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Top 3 Metadata Items */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 text-xs">
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Kategori Ruangan</span>
              <span className="text-slate-900 font-semibold block mt-1">{selectedRoomData.kategori}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Luas Ruangan</span>
              <span className="text-slate-900 font-semibold block mt-1">
                {selectedRoomData.luas > 0 ? `${selectedRoomData.luas} m²` : "-"}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Kapasitas</span>
              <span className="text-slate-900 font-semibold block mt-1">
                {selectedRoomData.kapasitasOrang > 0 ? `${selectedRoomData.kapasitasOrang} orang` : "Belum ditentukan"}
              </span>
            </div>
          </div>

          {/* Highlight Metrics Banner */}
          <div className="bg-slate-50/70 border border-slate-200/70 rounded-2xl p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Aset Inventaris (Unit)</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-slate-900">{totalSelectedRoomAssetsCount}</span>
                <span className="text-xs text-slate-500 font-medium">unit</span>
              </div>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Aset Inventaris Terpasang</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold text-slate-900">{selectedRoomBmnAssets.length}</span>
                <span className="text-xs text-slate-500 font-medium">unit</span>
              </div>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Nilai Aset Perolehan</span>
              <div className="mt-1">
                <span className="text-2xl font-bold text-slate-900">
                  {selectedRoomData.nilaiBuku > 0
                    ? `Rp ${(selectedRoomData.nilaiBuku / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`
                    : "Rp 0"}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom 3 Metadata Items */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 text-xs">
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Unit Pengguna</span>
              <span className="text-slate-900 font-semibold block mt-1 truncate" title={selectedRoomData.unit}>
                {selectedRoomData.unit || "Direktorat Sekolah Vokasi"}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Penanggung Jawab</span>
              <span className="text-slate-900 font-semibold block mt-1">Belum tersedia</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Referensi Denah</span>
              <span className="text-slate-900 font-semibold block mt-1">
                {selectedRoomData.referensiDenah ? "Tersedia" : "Belum ada"}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100" />

          {/* Section: Aset terhubung */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900">Aset terhubung</span>
              <span className="text-slate-400 font-medium">BMN & Ekstrakomtabel</span>
            </div>

            {totalSelectedRoomAssetsCount === 0 ? (
              <div className="border border-slate-100 bg-slate-50/60 rounded-2xl p-6 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white border border-slate-200/80 flex items-center justify-center text-slate-400 shrink-0">
                  <Package size={18} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-800">Belum ada aset terhubung</h5>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Belum ada data aset BMN maupun Ekstrakomtabel yang terhubung ke ruangan ini.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {selectedRoomBmnAssets.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 hover:border-blue-200 transition-colors text-xs">
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">BMN</span>
                        <span className="text-[11px] font-mono text-slate-400">{a.kode}</span>
                      </div>
                      <p className="font-bold text-slate-800 truncate mt-0.5">{a.nama}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-slate-900 block">
                        {a.nilaiBuku > 0 ? `Rp ${(a.nilaiBuku / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt` : "Rp 0"}
                      </span>
                      <span className="text-[10px] text-slate-400 block">{a.kondisi}</span>
                    </div>
                  </div>
                ))}
                {selectedRoomObsItems.map((o, idx) => (
                  <div key={o.id || idx} className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/40 border border-rose-100 hover:border-rose-200 transition-colors text-xs">
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">Observasi</span>
                        <span className="text-[11px] font-mono text-rose-900">{o.nup ? `NUP ${o.nup}` : o.kodeBarang || "OBS"}</span>
                      </div>
                      <p className="font-bold text-slate-800 truncate mt-0.5">{o.namaBarang}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-bold text-slate-900 block">
                        {Number(o.jumlahHarga) > 0 ? `Rp ${(Number(o.jumlahHarga) / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt` : "Rp 0"}
                      </span>
                      <span className="text-[10px] text-rose-700 font-semibold block">{o.kondisi || "Baik"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full py-16 text-center">
          <DoorClosed size={36} className="text-slate-200 mb-3" />
          <p className="text-sm font-bold text-slate-600">Pilih ruangan dari penjelajah</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Klik nama ruangan di sebelah kiri untuk melihat rincian spesifikasi dan aset ruangan.
          </p>
        </div>
      )}
    </div>
  );

  // ── Modals JSX ────────────────────────────────────────────────────────────────
  const modals = (
    <>
      {/* ── Modal Tambah Gedung ── */}
      {isAddGedungOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                  <Building size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Tambah Gedung Baru</h3>
                  <p className="text-[11px] text-gray-400">Daftarkan gedung baru ke dalam master lokasi</p>
                </div>
              </div>
              <button onClick={() => setIsAddGedungOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddGedungSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Kampus Penempatan</label>
                <select
                  value={addGedungForm.kampus}
                  onChange={e => setAddGedungForm({ ...addGedungForm, kampus: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {KAMPUS_LIST.map(k => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Nama Gedung <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Gedung Delta, Gedung Kuliah Bersama"
                  value={addGedungForm.namaGedung}
                  onChange={e => setAddGedungForm({ ...addGedungForm, namaGedung: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Alamat / Keterangan Lokasi (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Jl. Kumbang No.14 Bogor"
                  value={addGedungForm.alamat}
                  onChange={e => setAddGedungForm({ ...addGedungForm, alamat: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddGedungOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#022B5F] hover:bg-[#033b82] rounded-lg shadow-sm transition-colors disabled:opacity-60"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Gedung"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Tambah Ruangan ── */}
      {isAddRuanganOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                  <MapPin size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Tambah Ruangan Baru</h3>
                  <p className="text-[11px] text-gray-400">Daftarkan ruangan ke master data kampus</p>
                </div>
              </div>
              <button onClick={() => setIsAddRuanganOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddRuanganSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Kampus</label>
                  <select
                    value={addRuanganForm.kampus}
                    onChange={e => setAddRuanganForm({ ...addRuanganForm, kampus: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {KAMPUS_LIST.map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Gedung <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nama Gedung"
                    value={addRuanganForm.namaGedung}
                    onChange={e => setAddRuanganForm({ ...addRuanganForm, namaGedung: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Nama Ruangan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Lab Komputer 1, Ruang Kelas A-201"
                    value={addRuanganForm.namaRuangan}
                    onChange={e => setAddRuanganForm({ ...addRuanganForm, namaRuangan: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Kode Ruangan</label>
                  <input
                    type="text"
                    placeholder="Contoh: R-101"
                    value={addRuanganForm.kodeRuangan}
                    onChange={e => setAddRuanganForm({ ...addRuanganForm, kodeRuangan: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Lantai / Level</label>
                  <input
                    type="text"
                    placeholder="1, 2, B1..."
                    value={addRuanganForm.level}
                    onChange={e => setAddRuanganForm({ ...addRuanganForm, level: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Kategori</label>
                  <select
                    value={addRuanganForm.kategori}
                    onChange={e => setAddRuanganForm({ ...addRuanganForm, kategori: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {KATEGORI_LIST.map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Luas (m²)</label>
                  <input
                    type="number"
                    min={0}
                    value={addRuanganForm.luas || ""}
                    onChange={e => setAddRuanganForm({ ...addRuanganForm, luas: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Kapasitas Orang</label>
                  <input
                    type="number"
                    min={0}
                    value={addRuanganForm.kapasitas || ""}
                    onChange={e => setAddRuanganForm({ ...addRuanganForm, kapasitas: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Unit Pengguna</label>
                  <input
                    type="text"
                    placeholder="Sekolah Vokasi (SV)"
                    value={addRuanganForm.unitPengguna}
                    onChange={e => setAddRuanganForm({ ...addRuanganForm, unitPengguna: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsAddRuanganOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#022B5F] hover:bg-[#033b82] rounded-lg shadow-sm transition-colors disabled:opacity-60"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Ruangan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Edit Ruangan ── */}
      {editingRuangan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                  <Edit2 size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Edit Data Ruangan</h3>
                  <p className="text-[11px] text-gray-400">Perbarui spesifikasi atau pindahkan ke kampus/gedung lain</p>
                </div>
              </div>
              <button onClick={() => setEditingRuangan(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditRuanganSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Kampus</label>
                  <select
                    value={editRuanganForm.kampus}
                    onChange={e => setEditRuanganForm({ ...editRuanganForm, kampus: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {KAMPUS_LIST.map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Gedung <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nama Gedung"
                    value={editRuanganForm.namaGedung}
                    onChange={e => setEditRuanganForm({ ...editRuanganForm, namaGedung: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Nama Ruangan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nama Ruangan"
                    value={editRuanganForm.namaRuangan}
                    onChange={e => setEditRuanganForm({ ...editRuanganForm, namaRuangan: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Kode Ruangan</label>
                  <input
                    type="text"
                    placeholder="Kode Ruangan"
                    value={editRuanganForm.kodeRuangan}
                    onChange={e => setEditRuanganForm({ ...editRuanganForm, kodeRuangan: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Lantai / Level</label>
                  <input
                    type="text"
                    placeholder="1, 2, B1..."
                    value={editRuanganForm.level}
                    onChange={e => setEditRuanganForm({ ...editRuanganForm, level: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Kategori</label>
                  <select
                    value={editRuanganForm.kategori}
                    onChange={e => setEditRuanganForm({ ...editRuanganForm, kategori: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {KATEGORI_LIST.map(k => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Luas (m²)</label>
                  <input
                    type="number"
                    min={0}
                    value={editRuanganForm.luas || ""}
                    onChange={e => setEditRuanganForm({ ...editRuanganForm, luas: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Kapasitas Orang</label>
                  <input
                    type="number"
                    min={0}
                    value={editRuanganForm.kapasitas || ""}
                    onChange={e => setEditRuanganForm({ ...editRuanganForm, kapasitas: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Unit Pengguna</label>
                  <input
                    type="text"
                    placeholder="Sekolah Vokasi (SV)"
                    value={editRuanganForm.unitPengguna}
                    onChange={e => setEditRuanganForm({ ...editRuanganForm, unitPengguna: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingRuangan(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#022B5F] hover:bg-[#033b82] rounded-lg shadow-sm transition-colors disabled:opacity-60"
                >
                  {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Hapus Ruangan (Safety First) ── */}
      {deletingRuangan && (() => {
        const aff = getAffectedAssetsForRoom(deletingRuangan);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-red-50 text-red-600 rounded-xl">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Hapus Ruangan Master?</h3>
                  <p className="text-xs text-gray-500">Konfirmasi penghapusan data ruangan</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100 mb-4 space-y-1">
                <div className="text-xs font-bold text-gray-800">
                  {deletingRuangan.namaRuangan || (deletingRuangan as any).nama} ({deletingRuangan.kodeRuangan || (deletingRuangan as any).kode})
                </div>
                <div className="text-[11px] text-gray-500">
                  {deletingRuangan.namaGedung || (deletingRuangan as any).gedung} · {deletingRuangan.kampus || namaKampus}
                </div>
              </div>

              {/* Safety notice for assets */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 mb-5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                  <ShieldCheck size={16} className="text-blue-600 shrink-0" />
                  <span>Keamanan Data Aset Terjamin</span>
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Menghapus ruangan ini <strong>TIDAK AKAN</strong> menghapus aset dari database. Sebanyak <strong>{aff.total} aset</strong> ({aff.bmn} BMN + {aff.obs} Observasi) yang terhubung ke ruangan ini akan otomatis dilepas relasinya (unlinked) dan dialihkan ke status <em>"Aset Tanpa Lokasi"</em>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingRuangan(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteRuangan}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors disabled:opacity-60"
                >
                  {isSubmitting ? "Menghapus..." : "Ya, Hapus Ruangan"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal Hapus Gedung (Safety First) ── */}
      {deletingGedung && (() => {
        const aff = getAffectedAssetsForGedung(deletingGedung.namaGedung);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-red-50 text-red-600 rounded-xl">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Hapus Gedung?</h3>
                  <p className="text-xs text-gray-500">Konfirmasi penghapusan seluruh data gedung</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100 mb-4 space-y-1">
                <div className="text-xs font-bold text-gray-800">
                  {deletingGedung.namaGedung}
                </div>
                <div className="text-[11px] text-gray-500">
                  Kampus: {deletingGedung.kampus} · Memuat {aff.roomCount} Ruangan
                </div>
              </div>

              {/* Safety notice for assets */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 mb-5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
                  <ShieldCheck size={16} className="text-blue-600 shrink-0" />
                  <span>Keamanan Data Aset Terjamin</span>
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Seluruh <strong>{aff.roomCount} ruangan</strong> dalam gedung ini akan dihapus. Seluruh <strong>{aff.total} aset</strong> ({aff.bmn} BMN + {aff.obs} Observasi) yang terhubung <strong>TIDAK AKAN</strong> dihapus, melainkan dilepas hubungannya (unlinked) dan dialihkan ke status <em>"Aset Tanpa Lokasi"</em>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingGedung(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteGedung}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors disabled:opacity-60"
                >
                  {isSubmitting ? "Menghapus..." : "Ya, Hapus Gedung & Ruangannya"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );

  // ── Tab: Ringkasan ────────────────────────────────────────────────────────────
  if (currentTab === "Ringkasan") {
    return (
      <div className="space-y-4">
        {unassignedNotice}
        {filterBar}
        {kpiCards}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {treePanel}
          {detailPanel}
        </div>
        {modals}
      </div>
    );
  }

  // ── Tab: Aset per Ruangan ─────────────────────────────────────────────────────
  if (currentTab === "Aset per Ruangan") {
    const filterKey = selectedRoom ?? "Semua";
    const selectedRoomDetail = selectedRoom ? campusRuangan.find(r => String(r.id) === selectedRoom) : null;

    // 1. Registered BMN Assets for this campus
    const displayedBmnAssets = (filterKey === "Semua" ? campusAssets : campusAssets.filter(a => a.roomId === filterKey)).map(a => ({
      id: a.id,
      kode: a.kode,
      nama: a.nama,
      kategori: a.kategori,
      unit: a.unit,
      nilaiRp: a.nilaiBuku * 1000,
      kondisi: a.kondisi,
      statusPakai: a.statusPakai,
      statusLokasi: a.statusLokasi,
      statusLokasiColor: a.statusLokasiColor,
      namaRuangan: a.namaRuangan,
      kodeRuangan: a.kodeRuangan,
      namaGedung: a.namaGedung,
      lantai: a.lantai,
      sumberKategori: "Aset Terdaftar (BMN)" as const,
    }));

    // 2. Observed Items for this campus
    const campusRoomIdSet = new Set(campusRuangan.map(r => String(r.id)));
    const displayedObsItems = (observasiItems || [])
      .filter(o => campusRoomIdSet.has(String(o.ruanganId)))
      .filter(o => filterKey === "Semua" || String(o.ruanganId) === filterKey)
      .map(o => {
        const matchingMasterRoom = masterRooms.find(r => String(r.id) === String(o.ruanganId));
        return {
          id: o.id || `OBS-${o.ruanganId}-${o.namaBarang}`,
          kode: o.kodeBarang || "-",
          nama: o.namaBarang,
          kategori: o.merekType || "Inventaris Ruangan",
          unit: o.unitKerja || "Sekolah Vokasi (SV)",
          nilaiRp: Number(o.jumlahHarga) || 0,
          kondisi: o.kondisi || "Baik",
          statusPakai: "Aktif" as const,
          statusLokasi: "Hasil Observasi",
          statusLokasiColor: "rose" as const,
          namaRuangan: o.namaRuangan || matchingMasterRoom?.namaRuangan || "-",
          kodeRuangan: o.kodeRuangan || matchingMasterRoom?.kodeRuangan || "-",
          namaGedung: o.namaGedung || matchingMasterRoom?.namaGedung || "-",
          lantai: String(matchingMasterRoom?.level || 1),
          sumberKategori: "Aset Observasi" as const,
        };
      });

    // Unified List filtered by Category Source
    const allUnifiedAssets = [...displayedBmnAssets, ...displayedObsItems];
    const displayedAssets = allUnifiedAssets.filter(item => {
      if (sumberFilter === "BMN") return item.sumberKategori === "Aset Terdaftar (BMN)";
      if (sumberFilter === "Observasi") return item.sumberKategori === "Aset Observasi";
      return true;
    });

    const totalBmnCount = displayedBmnAssets.length;
    const totalObsCount = displayedObsItems.length;

    const handleExport = () => {
      const exportRows = displayedAssets.map((a, idx) => ({
        No: idx + 1,
        "Kategori Sumber": a.sumberKategori,
        "Kode Tag / Aset": a.kode,
        "Nama Barang": a.nama,
        "Kategori": a.kategori,
        "Unit Pengguna": a.unit,
        "Ruangan Master": a.namaRuangan,
        "Kode Ruangan": a.kodeRuangan,
        "Gedung": a.namaGedung,
        "Lantai": a.lantai,
        "Kondisi": a.kondisi,
        "Nilai (Rp)": a.nilaiRp,
        "Status Lokasi": a.statusLokasi,
      }));
      const filename = `Aset_${namaKampus.replace(/\s+/g, "_")}_${selectedRoomDetail ? selectedRoomDetail.namaRuangan.replace(/\s+/g, "_") : "Semua_Ruangan"}`;
      exportToExcel(exportRows, filename, "Aset_Ruangan");
    };

    return (
      <>
        {unassignedNotice}

        {/* Unmatched Rooms Report Banner (if any) */}
        {totalUnmatchedCount > 0 && (
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 transition-all">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-amber-900">
                    Laporan Sinkronisasi: {totalUnmatchedCount} Aset ({unmatchedRoomsReport.length} Nama Ruangan) Belum Terdaftar di Master
                  </h4>
                  <p className="text-[11px] text-amber-700 mt-0.5">
                    Terdapat baris data aset BMN yang memiliki teks nama ruangan namun belum cocok dengan master ruangan.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowUnmatchedReport(!showUnmatchedReport)}
                className="text-xs font-bold text-amber-800 bg-amber-100/80 hover:bg-amber-200/80 px-2.5 py-1 rounded-lg border border-amber-300 shrink-0 transition-colors"
              >
                {showUnmatchedReport ? "Tutup Rincian" : "Lihat Daftar Ruangan"}
              </button>
            </div>

            {showUnmatchedReport && (
              <div className="mt-3 pt-3 border-t border-amber-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {unmatchedRoomsReport.map((item) => (
                  <div key={item.rawRoom} className="bg-white/80 p-2.5 rounded-lg border border-amber-200 flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <span className="text-xs font-semibold text-slate-800 truncate block">
                        "{item.rawRoom}"
                      </span>
                      <span className="text-[10px] text-slate-400">Belum ada di Master Ruangan</span>
                    </div>
                    <span className="text-xs font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                      {item.count} aset
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Filter Controls Bar with Distinct Source Selector */}
        <div className="flex items-center gap-3 flex-wrap bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          {/* Room Filter Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-700">Filter Ruangan:</span>
            <select
              value={filterKey}
              onChange={e => setSelectedRoom(e.target.value === "Semua" ? null : e.target.value)}
              className={FILTER_SELECT_CLS}
            >
              <option value="Semua">Semua Ruangan ({campusAssets.length} BMN + {(observasiItems || []).filter(o => campusRoomIdSet.has(String(o.ruanganId))).length} Observasi)</option>
              {campusRuangan.map(r => {
                const bmnC = campusAssets.filter(a => a.roomId === String(r.id)).length;
                const obsC = (observasiItems || []).filter(o => String(o.ruanganId) === String(r.id)).length;
                const labelCount = obsC > 0 ? `${bmnC} BMN + ${obsC} Obs` : `${bmnC} BMN`;
                return (
                  <option key={r.id} value={String(r.id)}>
                    {r.kodeRuangan} — {r.namaRuangan} ({labelCount})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Source Category Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setSumberFilter("Semua")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                sumberFilter === "Semua"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Semua ({totalBmnCount + totalObsCount})
            </button>
            <button
              type="button"
              onClick={() => setSumberFilter("BMN")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                sumberFilter === "BMN"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-blue-700 hover:bg-blue-50"
              }`}
            >
              Aset Terdaftar (BMN) ({totalBmnCount})
            </button>
            <button
              type="button"
              onClick={() => setSumberFilter("Observasi")}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                sumberFilter === "Observasi"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-rose-700 hover:bg-rose-50"
              }`}
            >
              Aset Observasi ({totalObsCount})
            </button>
          </div>

          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
            {displayedAssets.length} item ditampilkan
          </span>

          {selectedRoomDetail && (
            <button
              onClick={() => setSelectedRoom(null)}
              className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
            >
              Reset ke Semua Ruangan
            </button>
          )}

          <div className="ml-auto">
            <button
              onClick={handleExport}
              disabled={displayedAssets.length === 0}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Download size={13} /> Export Excel
            </button>
          </div>
        </div>

        {/* Table of Assets with Clear Badges */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left">
            <THead cols={["Kode Barang / Tag", "Nama Barang", "Kategori Sumber", "Ruangan Master", "Merek / Kategori", "Unit", "Nilai (Rp)", "Kondisi", "Status"]} />
            <tbody className="divide-y divide-gray-50">
              {displayedAssets.length > 0 ? displayedAssets.map((a, i) => (
                <tr key={`${a.id}-${i}`} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-gray-500 font-bold">{a.kode}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-800">{a.nama}</td>
                  <td className="px-4 py-3">
                    {a.sumberKategori === "Aset Terdaftar (BMN)" ? (
                      <span className="inline-flex items-center text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                        Aset Terdaftar (BMN)
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full">
                        Aset Observasi
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-800">{a.namaRuangan}</span>
                      <span className="text-[10px] text-gray-400">{a.namaGedung} · {a.kodeRuangan}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><SoftBadge label={a.kategori} color="gray" /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{a.unit}</td>
                  <td className="px-4 py-3 text-xs font-medium text-gray-800">
                    {a.nilaiRp > 0 ? `Rp ${(a.nilaiRp / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt` : "Rp 0"}
                  </td>
                  <td className="px-4 py-3">
                    <SoftBadge
                      label={a.kondisi}
                      color={a.kondisi === "Baik" ? "green" : a.kondisi === "Rusak Ringan" ? "amber" : "red"}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <SoftBadge label={a.statusLokasi} color={a.statusLokasiColor as any} />
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                        <Building size={22} className="text-gray-400" />
                      </div>
                      <p className="text-sm font-bold text-gray-700 mb-1">
                        Belum ada aset tercatat di ruangan ini
                      </p>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        {selectedRoomDetail
                          ? `Ruangan "${selectedRoomDetail.namaRuangan}" (${selectedRoomDetail.kodeRuangan}) telah terdaftar di master ruangan kampus, namun belum ada aset yang dialokasikan.`
                          : "Tidak ada data aset terdaftar yang sesuai dengan filter ini."}
                      </p>
                      {selectedRoomDetail && (
                        <button
                          onClick={() => setSelectedRoom(null)}
                          className="mt-3 text-xs text-blue-600 font-bold hover:underline"
                        >
                          Tampilkan Semua Ruangan Kampus
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {modals}
      </>
    );
  }

  // ── Tab: Denah / Floorplan ────────────────────────────────────────────────────
  if (currentTab === "Denah / Floorplan") {
    const denahRoom = selectedRoomData;
    return (
      <>
        {unassignedNotice}
        <div className="flex items-center gap-3">
          <select
            value={selectedRoom ?? ""}
            onChange={e => setSelectedRoom(e.target.value || null)}
            className={FILTER_SELECT_CLS}
          >
            <option value="">— Pilih Ruangan —</option>
            {campusRuangan.map(r => <option key={r.id} value={String(r.id)}>{r.kodeRuangan} — {r.namaRuangan}</option>)}
          </select>
        </div>
        {denahRoom ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-gray-800">{denahRoom.nama}</p>
                <p className="text-xs text-gray-500">{denahRoom.kode} · {denahRoom.namaGedung} · {denahRoom.lantai === "B1" ? "Basement" : `Lantai ${denahRoom.lantai}`}</p>
              </div>
              <button className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                <Upload size={12} /> Upload Denah
              </button>
            </div>
            {denahRoom.referensiDenah ? (
              <img src={denahRoom.referensiDenah} alt="Denah ruangan" className="w-full rounded-lg border border-gray-100" />
            ) : (
              <div className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
                  <FileText size={22} className="text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-500 mb-1">Belum ada denah untuk ruangan ini</p>
                <p className="text-xs text-gray-400 mb-4 max-w-sm">Upload file denah (JPG, PNG, atau PDF) untuk memudahkan verifikasi lokasi dan audit aset berbasis denah.</p>
                <button className="flex items-center gap-2 text-xs bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                  <Upload size={12} /> Upload Denah Sekarang
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center py-20 text-center">
            <FileText size={32} className="text-gray-300 mb-3" />
            <p className="text-sm text-gray-400 font-medium">Pilih ruangan di atas untuk melihat denah</p>
            <p className="text-xs text-gray-300 mt-1">Denah membantu verifikasi posisi aset secara fisik di ruangan.</p>
          </div>
        )}
        {modals}
      </>
    );
  }

  // Fallback default: Always display Ringkasan view
  return (
    <div className="space-y-4">
      {unassignedNotice}
      {filterBar}
      {kpiCards}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {treePanel}
        {detailPanel}
      </div>
      {modals}
    </div>
  );
}

