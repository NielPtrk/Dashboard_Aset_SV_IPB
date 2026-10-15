import React, { useState, useMemo } from "react";
import {
  Database, CheckCircle2, AlertTriangle, MapPin, Users,
  ChevronRight, Download, RefreshCw, Eye, Lightbulb,
  TrendingUp, FileText, Wrench, ArrowLeftRight, ClipboardList,
  AlertCircle, Info, BarChart2, CircleDollarSign, Clock, CheckSquare, XSquare, Building
} from "lucide-react";
import { useDataStore, getDataQuality, getOpnameStatus, getMaintenanceStatus } from "./DataStore";
import { useApp } from "./AppContext";

const fmtRupiahShort = (n: number) => {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1).replace(".", ",")} M`;
  if (n >= 1_000_000)     return `Rp ${(n / 1_000_000).toFixed(1).replace(".", ",")} jt`;
  if (n >= 1_000)         return `Rp ${(n / 1_000).toFixed(0)} rb`;
  return `Rp ${n}`;
};

const fmtRupiahFull = (n: number) => {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);
};

const P = "#111827";
const GREEN = "#22C55E";
const RED = "#EF4444";
const AMBER = "#F59E0B";

const COND_COLORS: Record<string, string> = {
  "Baik": GREEN,
  "Perlu Monitoring": "#84CC16", 
  "Rusak Ringan": AMBER,
  "Rusak Berat": RED,
  "Prioritas Penggantian": "#B91C1C",
  "Belum Dicek": "#9CA3AF"
};

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, iconColor, iconBg }: {
  label: string; value: string; sub: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  iconColor: string; iconBg: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg }}>
          <Icon size={15} style={{ color: iconColor }} />
        </div>
      </div>
      <div>
        <p className="text-[26px] font-bold text-gray-900 leading-tight">{value}</p>
        <p className="text-xs text-gray-400 mt-1">{sub}</p>
      </div>
    </div>
  );
}

// ── Progress Row ─────────────────────────────────────────────────────────────
function ProgressRow({ label, pct, count, total }: { label: string; pct: number; count: number; total: number }) {
  const color = pct >= 80 ? GREEN : pct >= 50 ? AMBER : RED;
  const statusLabel = pct >= 80 ? "Baik" : pct >= 50 ? "Perlu Perhatian" : "Kritis";
  const statusBg = pct >= 80 ? "#DCFCE7" : pct >= 50 ? "#FEF3C7" : "#FEE2E2";
  const statusColor = pct >= 80 ? "#16A34A" : pct >= 50 ? "#D97706" : "#DC2626";
  return (
    <div className="flex items-center gap-4">
      <div className="w-44 shrink-0">
        <span className="text-xs text-gray-700 font-medium">{label}</span>
      </div>
      <div className="flex-1">
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </div>
      <div className="w-10 text-right shrink-0">
        <span className="text-xs font-semibold text-gray-700">{pct}%</span>
      </div>
      <div className="w-24 shrink-0 text-right">
        <span className="text-[10px] text-gray-400">{count.toLocaleString("id-ID")}/{total.toLocaleString("id-ID")}</span>
      </div>
      <div className="w-28 shrink-0 flex justify-end">
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: statusBg, color: statusColor }}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

// ── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: "Lengkap" | "Perlu Verifikasi" | "Belum Tersedia" | "Sebagian" }) {
  const styles: Record<string, { bg: string; color: string }> = {
    "Lengkap":          { bg: "#DCFCE7", color: "#16A34A" },
    "Perlu Verifikasi": { bg: "#FEF3C7", color: "#D97706" },
    "Belum Tersedia":   { bg: "#FEE2E2", color: "#DC2626" },
    "Sebagian":         { bg: "#EDE9FE", color: "#7C3AED" },
  };
  const s = styles[status] ?? { bg: "#F3F4F6", color: "#6B7280" };
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.bg, color: s.color }}>
      {status}
    </span>
  );
}

function pctStatus(pct: number): "Lengkap" | "Perlu Verifikasi" | "Belum Tersedia" | "Sebagian" {
  if (pct >= 85) return "Lengkap";
  if (pct >= 60) return "Perlu Verifikasi";
  if (pct >= 35) return "Sebagian";
  return "Belum Tersedia";
}

export function OverviewPage({ topBar }: { topBar: React.ReactNode }) {
  const store = useDataStore();
  const { userProfile } = useApp();
  const [expandRekomen, setExpandRekomen] = useState(false);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Selamat pagi" : hour < 17 ? "Selamat siang" : "Selamat malam";
  const userFirstName = userProfile?.nama ? userProfile.nama.split(" ")[0] : "Pengguna";

  const assets = store.assets;
  const total = assets.length;

  const lengkap   = useMemo(() => assets.filter(a => getDataQuality(a) === "Lengkap").length, [assets]);
  const perluVerif = useMemo(() => assets.filter(a => getDataQuality(a) === "Perlu Verifikasi").length, [assets]);
  const noLokasi  = useMemo(() => store.computeAssetsWithoutClearLocation(), [store]);
  const noPIC     = useMemo(() => store.computeAssetsWithoutPIC(), [store]);

  const verifiedCount = store.computeStockOpnameProgress().done;

  const kondisiList = useMemo(() => {
    const counts: Record<string, number> = {};
    assets.forEach(a => {
      const k = (a.Kondisi || a.kondisi || "").trim();
      const cat = k === "" || k === "-" ? "Belum Dicek" : k;
      counts[cat] = (counts[cat] || 0) + 1;
    });
    
    return Object.entries(counts)
      .map(([label, count]) => ({
        label,
        count,
        pct: total ? (count / total) * 100 : 0,
        color: COND_COLORS[label] || COND_COLORS["Belum Dicek"]
      }))
      .sort((a, b) => b.count - a.count);
  }, [assets, total]);

  const identitasPct  = total ? Math.round(assets.filter(a => a.Nama_Barang && a.Nama_Barang !== "-").length / total * 100) : 0;
  const keuanganPct   = total ? Math.round(assets.filter(a => a._nilai_buku && a.TglPerolehan && a.TglPerolehan !== "-").length / total * 100) : 0;
  const lokasiPct     = total ? Math.round(assets.filter(a => a.nama_gedung && a.nama_gedung !== "-").length / total * 100) : 0;
  const picPct        = total ? Math.round(assets.filter(a => a.nama_pic && a.nama_pic !== "-").length / total * 100) : 0;
  const opnamePct     = total ? Math.round(assets.filter(a => a.tanggal_opname_terakhir && a.tanggal_opname_terakhir !== "-").length / total * 100) : 0;
  const maintPct      = total ? Math.round(assets.filter(a => a.tanggal_maintenance_terakhir && a.tanggal_maintenance_terakhir !== "-").length / total * 100) : 0;

  const pmCount  = useMemo(() => store.getAssetsByJenis("PM").length, [store]);
  const atbCount = useMemo(() => store.getAssetsByJenis("ATB").length, [store]);
  const atlCount = useMemo(() => store.getAssetsByJenis("ATL").length, [store]);
  const alCount  = useMemo(() => store.getAssetsByJenis("AL").length, [store]);

  const recentActivities = useMemo(() =>
    store.activityLogs.slice(0, 5).map(log => ({
      id: log.target_id || log.id.toString(),
      name: log.pengguna,
      action: log.aksi,
      time: log.waktu,
      color: log.status === "Berhasil" ? GREEN : log.status === "Berisiko" ? AMBER : RED,
    })),
    [store.activityLogs],
  );

  const overdueCount = store.computeMaintenanceOverdue();

  const rekomendasi = useMemo(() => {
    const recs = [];
    const belumVerif = store.computeStockOpnameProgress().total - store.computeStockOpnameProgress().done;
    if (belumVerif > 0) recs.push({ icon: ClipboardList, color: "#22C55E", bg: "#DCFCE7", text: `${belumVerif} aset belum pernah diverifikasi — disarankan mulai proses Stock Opname.`, tag: "Opname" });
    
    const rusakCount = assets.filter(a => (a.Kondisi || a.kondisi)?.includes("Rusak")).length;
    if (rusakCount > 0) recs.push({ icon: AlertCircle, color: RED, bg: "#FEE2E2", text: `${rusakCount} aset dilaporkan dalam kondisi rusak. Segera jadwalkan perbaikan atau penghapusan.`, tag: "Kondisi" });
    
    if (noLokasi > 0) recs.push({ icon: MapPin, color: "#F59E0B", bg: "#FEF3C7", text: `Lengkapi data lokasi untuk ${noLokasi} aset tanpa koordinat gedung yang jelas.`, tag: "Lokasi" });
    if (noPIC > 0) recs.push({ icon: Users, color: "#3B82F6", bg: "#EFF6FF", text: `Verifikasi dan tetapkan PIC untuk ${noPIC} aset yang belum memiliki penanggung jawab.`, tag: "PIC" });
    
    if (overdueCount > 0) recs.push({ icon: Wrench, color: "#8B5CF6", bg: "#EDE9FE", text: `${overdueCount} aset memiliki jadwal maintenance yang sudah terlewat. Segera jadwalkan perbaikan.`, tag: "Maintenance" });
    
    if (recs.length === 0) recs.push({ icon: CheckCircle2, color: GREEN, bg: "#DCFCE7", text: "Semua data aset dalam kondisi baik. Tidak ada tindakan mendesak diperlukan.", tag: "OK" });
    return recs;
  }, [assets, noLokasi, noPIC, overdueCount, store]);

  const totalAcqVal  = useMemo(() => store.computeTotalAcquisitionValue(), [store]);

  const breakdownGedung = useMemo(() => {
    const map = new Map<string, number>();
    store.assets.forEach(a => {
      const g = (a.nama_gedung || a.gedung || "").trim();
      const loc = g === "" || g === "-" ? "Belum Ada Lokasi" : g;
      map.set(loc, (map.get(loc) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a,b) => b[1] - a[1]).slice(0, 5);
  }, [store.assets]);

  const maintItems = useMemo(() => {
    return store.maintenanceTickets.map(t => {
      const asset = store.getAssetById(t.asset_id);
      return {
        id: t.id,
        assetName: asset?.Nama_Barang || asset?.nama_barang || t.asset_id,
        gedung: asset?.nama_gedung || asset?.gedung || "-",
        ruangan: asset?.Nama_ruangan || asset?.nama_ruangan || "-",
        durasi: t.downtime_jam,
        status: t.status,
        biaya: t.biaya
      };
    }).sort((a,b) => b.durasi - a.durasi).slice(0, 6);
  }, [store.maintenanceTickets, store]);

  const topBiayaAset = useMemo(() => {
    return store.assets
      .map(a => ({
        id: a.id,
        nama: a.Nama_Barang || a.nama_barang || "Aset Tanpa Nama",
        ruangan: a.Nama_ruangan || a.nama_ruangan || "-",
        biaya: parseInt(a._total_biaya_maintenance || "0") || 0
      }))
      .filter(a => a.biaya > 0)
      .sort((a, b) => b.biaya - a.biaya)
      .slice(0, 5);
  }, [store.assets]);

  const datasetRows = useMemo(() => [
    { jenis: "Peralatan & Mesin",     icon: Database,     sumber: "DataStore (PM)",  jumlah: pmCount,  pct: identitasPct, updated: "Live" },
    { jenis: "Aset Tak Berwujud",     icon: FileText,     sumber: "DataStore (ATB)", jumlah: atbCount, pct: keuanganPct,  updated: "Live" },
    { jenis: "Aset Tetap Lainnya",    icon: Database,     sumber: "DataStore (ATL)", jumlah: atlCount, pct: lokasiPct,    updated: "Live" },
    { jenis: "Alat Angkutan",         icon: Database,     sumber: "DataStore (AL)",  jumlah: alCount,  pct: opnamePct,    updated: "Live" },
    { jenis: "Lokasi & Ruangan",      icon: MapPin,       sumber: "Kolom Tambahan",  jumlah: total,    pct: lokasiPct,    updated: "Live" },
    { jenis: "Penanggung Jawab (PIC)",icon: Users,        sumber: "Kolom Tambahan",  jumlah: total,    pct: picPct,       updated: "Live" },
    { jenis: "Riwayat Maintenance",   icon: Wrench,       sumber: "Kolom Tambahan",  jumlah: total,    pct: maintPct,     updated: "Live" },
    { jenis: "Stock Opname",          icon: ClipboardList,sumber: "Kolom Tambahan",  jumlah: total,    pct: opnamePct,    updated: "Live" },
  ].map(r => ({ ...r, status: pctStatus(r.pct) as "Lengkap" | "Perlu Verifikasi" | "Belum Tersedia" | "Sebagian" })),
    [pmCount, atbCount, atlCount, alCount, total, identitasPct, keuanganPct, lokasiPct, picPct, maintPct, opnamePct],
  );

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 min-w-0">
      {topBar}
      <div className="px-8 py-7 space-y-6">

        {/* ── Header ── */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">{greeting}, {userFirstName}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Ringkasan kesiapan data sistem aset Sekolah Vokasi IPB —{" "}
            {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-6 gap-4">
          <KpiCard
            label="Total Nilai Perolehan"
            value={fmtRupiahFull(totalAcqVal)}
            sub="Akumulasi nilai perolehan seluruh aset (PM + ATB + ATL + AL)"
            icon={CircleDollarSign}
            iconColor="#3B82F6"
            iconBg="#EFF6FF"
          />
          <KpiCard
            label="Total Data Aset"
            value={total.toLocaleString("id-ID")}
            sub={`${verifiedCount.toLocaleString("id-ID")} dari ${total.toLocaleString("id-ID")} aset terverifikasi`}
            icon={Database}
            iconColor="#111827"
            iconBg="#F3F4F6"
          />
          <KpiCard
            label="Data Lengkap"
            value={lengkap.toLocaleString("id-ID")}
            sub={`${total ? Math.round(lengkap / total * 100) : 0}% dari total`}
            icon={CheckCircle2}
            iconColor="#16A34A"
            iconBg="#DCFCE7"
          />
          <KpiCard
            label="Perlu Verifikasi"
            value={perluVerif.toLocaleString("id-ID")}
            sub={`${total ? Math.round(perluVerif / total * 100) : 0}% dari total`}
            icon={AlertTriangle}
            iconColor="#D97706"
            iconBg="#FEF3C7"
          />
          <KpiCard
            label="Tanpa Lokasi"
            value={noLokasi.toLocaleString("id-ID")}
            sub={`${total ? Math.round(noLokasi / total * 100) : 0}% belum memiliki lokasi`}
            icon={MapPin}
            iconColor="#EF4444"
            iconBg="#FEE2E2"
          />
          <KpiCard
            label="Tanpa PIC"
            value={noPIC.toLocaleString("id-ID")}
            sub={`${total ? Math.round(noPIC / total * 100) : 0}% belum ada penanggung jawab`}
            icon={Users}
            iconColor="#7C3AED"
            iconBg="#EDE9FE"
          />
        </div>

        {/* ── Kesiapan Data Sistem + Distribusi Kondisi Aset ── */}
        <div className="grid grid-cols-5 gap-5">
          {/* Kesiapan Data — 3 cols */}
          <div className="col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart2 size={16} className="text-gray-500" />
                <p className="text-sm font-semibold text-gray-800">Kesiapan Data Sistem</p>
              </div>
              <span className="text-[10px] font-semibold text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full">Dihitung Sistem</span>
            </div>
            <div className="space-y-3.5">
              <ProgressRow label="Identitas Aset"       pct={identitasPct}  count={Math.round(identitasPct/100*total)}  total={total} />
              <ProgressRow label="Kelengkapan Keuangan" pct={keuanganPct}   count={Math.round(keuanganPct/100*total)}   total={total} />
              <ProgressRow label="Lokasi & Ruangan"     pct={lokasiPct}     count={Math.round(lokasiPct/100*total)}     total={total} />
              <ProgressRow label="Penanggung Jawab"     pct={picPct}        count={Math.round(picPct/100*total)}        total={total} />
              <ProgressRow label="Stock Opname"         pct={opnamePct}     count={Math.round(opnamePct/100*total)}     total={total} />
              <ProgressRow label="Riwayat Maintenance"  pct={maintPct}      count={Math.round(maintPct/100*total)}      total={total} />
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-1.5 text-[10px] text-gray-400">
              <Info size={11} />
              Persentase dihitung otomatis berdasarkan kelengkapan kolom wajib di setiap dimensi data.
            </div>
          </div>

          {/* Distribusi Kondisi Aset — 2 cols */}
          <div className="col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col">
            <p className="text-sm font-semibold text-gray-800 mb-4">Distribusi Kondisi Aset</p>
            <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
              {kondisiList.map(c => (
                <div key={c.label} className="h-full" style={{ width: `${c.pct}%`, backgroundColor: c.color }} />
              ))}
            </div>
            <div className="flex flex-col gap-2 mt-4 flex-1 overflow-y-auto max-h-[160px] pr-2">
              {kondisiList.map(l => (
                <div key={l.label} className="flex items-center gap-2.5 py-1 border-b border-gray-50 last:border-0">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                  <span className="text-xs text-gray-500 flex-1 truncate">{l.label}</span>
                  <span className="text-xs font-semibold text-gray-700">{l.count.toLocaleString("id-ID")}</span>
                  <span className="text-[10px] text-gray-400 w-10 text-right">{Math.round(l.pct)}%</span>
                </div>
              ))}
            </div>
            <div className="flex-1" />
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-[10px] text-gray-400">Total {total.toLocaleString("id-ID")} aset terdaftar — live dari DataStore</p>
            </div>
          </div>
        </div>

        {/* ── Table Status Dataset ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Database size={15} className="text-gray-500" />
              <p className="text-sm font-semibold text-gray-800">Status Dataset</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                <RefreshCw size={12} /> Refresh
              </button>
              <button className="flex items-center gap-1.5 text-xs text-white bg-gray-900 px-3 py-1.5 rounded-lg hover:bg-black transition-colors">
                <Download size={12} /> Export
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Jenis Data</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Sumber Data</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Jumlah Record</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Kelengkapan</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Terakhir Diperbarui</th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {datasetRows.map((row, i) => {
                  const barColor = row.pct >= 80 ? GREEN : row.pct >= 50 ? AMBER : RED;
                  return (
                    <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                            <row.icon size={13} className="text-gray-500" />
                          </div>
                          <span className="text-sm font-medium text-gray-800">{row.jenis}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-gray-500">{row.sumber}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-sm font-semibold text-gray-700">{row.jumlah.toLocaleString("id-ID")}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2 min-w-[100px]">
                          <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${row.pct}%`, backgroundColor: barColor }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-600 w-8 shrink-0">{row.pct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-gray-500">{row.updated}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors">
                          <Eye size={13} /> Lihat
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Bottom Row: Rekomendasi + Aktivitas Terbaru ── */}
        <div className="grid grid-cols-5 gap-5">
          {/* Rekomendasi Sistem — 3 cols */}
          <div className="col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Lightbulb size={15} className="text-amber-500" />
                <p className="text-sm font-semibold text-gray-800">Rekomendasi Sistem</p>
              </div>
              <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Rekomendasi Sistem</span>
            </div>
            <div className="space-y-2.5">
              {(expandRekomen ? rekomendasi : rekomendasi.slice(0, 3)).map((r, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: r.bg }}>
                    <r.icon size={13} style={{ color: r.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 leading-relaxed">{r.text}</p>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: r.bg, color: r.color }}>
                    {r.tag}
                  </span>
                </div>
              ))}
            </div>
            {rekomendasi.length > 3 && (
              <button
                onClick={() => setExpandRekomen(v => !v)}
                className="mt-3 w-full text-xs text-gray-500 hover:text-gray-800 transition-colors py-2 border border-dashed border-gray-200 rounded-lg"
              >
                {expandRekomen ? "↑ Ciutkan" : `Lihat ${rekomendasi.length - 3} rekomendasi lainnya`}
              </button>
            )}
          </div>

          {/* Aktivitas Terbaru — 2 cols */}
          <div className="col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-gray-800">Aktivitas Terbaru</p>
              <button className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors">Lihat semua</button>
            </div>
            <div className="space-y-1">
              {recentActivities.map((a, idx) => (
                <div key={idx} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: a.color + "1A" }}>
                    <Database size={12} style={{ color: a.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{a.name}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{a.action}</p>
                  </div>
                  <div className="text-[10px] text-gray-400 shrink-0">{a.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Status Maintenance & Perbaikan ── */}
        <div className="grid grid-cols-3 gap-5">
          {/* Maintenance Overdue & Breakdown */}
          <div className="col-span-2 space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Wrench size={16} className="text-gray-500" />
                  <p className="text-sm font-semibold text-gray-800">Status Perbaikan & Maintenance Overdue</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">{overdueCount} Overdue</span>
                </div>
              </div>
              
              <div className="flex gap-6 mb-4">
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Histori Durasi Perbaikan</p>
                  <div className="space-y-2">
                    {maintItems.length === 0 ? (
                      <div className="py-6 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                        <Wrench size={24} className="mx-auto text-gray-300 mb-2" />
                        <p className="text-xs text-gray-500">Belum ada data maintenance.</p>
                      </div>
                    ) : maintItems.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg border border-gray-50 hover:bg-gray-50 transition-colors">
                        {item.status === "Selesai" ? (
                          <CheckSquare size={16} className="text-green-500 shrink-0" />
                        ) : (
                          <XSquare size={16} className="text-amber-500 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{item.assetName}</p>
                          <p className="text-[10px] text-gray-500 truncate">{item.gedung} - {item.ruangan}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-gray-700 flex items-center gap-1"><Clock size={11} className="text-gray-400" /> {item.durasi} Jam</p>
                          <p className="text-[10px] font-medium" style={{ color: item.status === "Selesai" ? "#16A34A" : "#D97706" }}>
                            {item.status === "Selesai" ? "Sudah Diperbaiki" : "Belum Diperbaiki"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="w-1/3 shrink-0 border-l border-gray-100 pl-6">
                  <p className="text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wide">Breakdown Per Gedung</p>
                  <div className="space-y-3">
                    {breakdownGedung.map(([gedung, count]) => (
                      <div key={gedung} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Building size={12} className="text-gray-400" />
                          <span className="text-xs text-gray-600 truncate max-w-[100px]" title={gedung}>{gedung}</span>
                        </div>
                        <span className="text-xs font-bold text-gray-800">{count} Item</span>
                      </div>
                    ))}
                  </div>
                  {breakdownGedung.length === 0 && (
                    <p className="text-xs text-gray-400 italic">Tidak ada antrian perbaikan</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Top Biaya Maintenance */}
          <div className="col-span-1 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-gray-500" />
              <p className="text-sm font-semibold text-gray-800">Top Biaya Maintenance</p>
            </div>
            <div className="space-y-3">
              {topBiayaAset.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                  <TrendingUp size={24} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-xs text-gray-500">Belum ada data maintenance.</p>
                </div>
              ) : topBiayaAset.map((a, i) => (
                <div key={a.id} className="p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs font-medium text-gray-800 line-clamp-2 leading-snug">{a.nama}</p>
                    <span className="text-[10px] font-bold text-gray-400 mt-0.5 shrink-0">#{i + 1}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1">
                      <MapPin size={11} className="text-gray-400" />
                      <span className="text-[10px] text-gray-500 truncate max-w-[90px]">{a.ruangan}</span>
                    </div>
                    <span className="text-xs font-bold text-red-600">{fmtRupiahShort(a.biaya)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
