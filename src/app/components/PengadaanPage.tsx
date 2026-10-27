import React, { useState, useMemo } from "react";
import { useDataStore } from "./DataStore";
import { exportToExcel } from "./excelUtils";
import {
  ShoppingCart, Search, Download, ChevronDown,
  CircleDollarSign, Cpu, Car, Layers, FileText,
  Check, Database, Calendar, Filter, Building,
} from "lucide-react";

// ── Formatting Helpers ────────────────────────────────────────────────────────
const fmtNum = (n: number) => n.toLocaleString("id-ID");

const fmtRp = (n: number) => {
  if (isNaN(n) || n === 0) return "Rp 0";
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(2).replace(".", ",")} M`;
  if (n >= 1_000_000)     return `Rp ${(n / 1_000_000).toFixed(1).replace(".", ",")} jt`;
  return "Rp " + new Intl.NumberFormat("id-ID").format(n);
};

const parseVal = (v: any): number => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  const num = parseFloat(String(v).replace(/[^0-9.-]+/g, ""));
  return isNaN(num) ? 0 : num;
};

function KategoriBadge({ kategori }: { kategori: string }) {
  const cfg: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    PM:  { bg: "bg-purple-50", text: "text-purple-700", icon: <Cpu size={10} /> },
    ATB: { bg: "bg-sky-50",    text: "text-sky-700",    icon: <FileText size={10} /> },
    ATL: { bg: "bg-teal-50",   text: "text-teal-700",   icon: <Layers size={10} /> },
    AL:  { bg: "bg-indigo-50", text: "text-indigo-700", icon: <Car size={10} /> },
  };
  const c = cfg[kategori] || { bg: "bg-gray-50", text: "text-gray-700", icon: <Package size={10} /> };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${c.bg} ${c.text}`}>
      {c.icon} {kategori}
    </span>
  );
}

export function PengadaanPage({ topBar }: { topBar: React.ReactNode }) {
  const store = useDataStore();
  const allAssets = store.assets || [];

  const [search, setSearch]           = useState("");
  const [katFilter, setKatFilter]     = useState<string>("");
  const [sumberFilter, setSumberFilter] = useState<string>("");
  const [page, setPage]               = useState(1);
  const pageSize = 15;

  // Process real procurement records from assets
  const records = useMemo(() => {
    return allAssets.map((a, i) => {
      const price = parseVal(a.HargaSatuan || a.harga_satuan || a.harga_perolehan || a._harga_perolehan);
      const tgl = String(a.Tgl_pengadaan || a.Tgl_transaksi || a.TahunBuku || a.tgl_pengadaan || a.tgl_perolehan || "—");
      const sumber = String(a.SumberDana || a.sumber_dana || a.sumberDana || "Belum Diisi").trim();
      const kat = String(a.TipeAset || a.jenis_aset || "PM");
      const doc = String(a.Dokumen || a.Referensi || a.dokumen || "—");
      const room = String(a.Nama_ruangan || a.Id_ruangan || a.nama_ruangan || "—");

      return {
        id: String(a.KodeBarang || a.Id_aset || a.id || a.Id || `AST-${i + 1}`),
        nama: String(a.Nama_Barang || a.nama_barang || a.nama || "Aset Tanpa Nama"),
        kategori: kat,
        tglPengadaan: tgl,
        sumberDana: sumber,
        hargaSatuan: price,
        dokumenRef: doc,
        ruangan: room,
      };
    });
  }, [allAssets]);

  // Unique SumberDana list
  const sumberDanaList = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => { if (r.sumberDana) set.add(r.sumberDana); });
    return Array.from(set).sort();
  }, [records]);

  // Aggregate Metrics
  const stats = useMemo(() => {
    const totalUnits = records.length;
    const totalNilai = records.reduce((s, r) => s + r.hargaSatuan, 0);
    const avgNilai   = totalUnits > 0 ? totalNilai / totalUnits : 0;

    const pmCount  = records.filter(r => r.kategori === "PM").length;
    const atbCount = records.filter(r => r.kategori === "ATB").length;
    const atlCount = records.filter(r => r.kategori === "ATL").length;
    const alCount  = records.filter(r => r.kategori === "AL").length;

    // Top Sumber Dana
    const sMap = new Map<string, number>();
    records.forEach(r => {
      sMap.set(r.sumberDana, (sMap.get(r.sumberDana) || 0) + 1);
    });
    const sortedS = Array.from(sMap.entries()).sort((a, b) => b[1] - a[1]);
    const topSumber = sortedS[0] ? { name: sortedS[0][0], count: sortedS[0][1] } : { name: "—", count: 0 };

    return {
      totalUnits,
      totalNilai,
      avgNilai,
      topSumber,
      pmCount,
      atbCount,
      atlCount,
      alCount,
    };
  }, [records]);

  // Filtered dataset
  const filtered = useMemo(() => {
    const q = (search || "").trim().toLowerCase();
    return records.filter(r => {
      if (katFilter && r.kategori !== katFilter) return false;
      if (sumberFilter && r.sumberDana !== sumberFilter) return false;
      if (q) {
        const matchName = String(r.nama || "").toLowerCase().includes(q);
        const matchId   = String(r.id || "").toLowerCase().includes(q);
        const matchS    = String(r.sumberDana || "").toLowerCase().includes(q);
        const matchDoc  = String(r.dokumenRef || "").toLowerCase().includes(q);
        const matchRoom = String(r.ruangan || "").toLowerCase().includes(q);
        if (!matchName && !matchId && !matchS && !matchDoc && !matchRoom) return false;
      }
      return true;
    });
  }, [records, katFilter, sumberFilter, search]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated  = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const handleExport = () => {
    const exportData = filtered.map(r => ({
      "Kode / ID Aset": r.id,
      "Nama Barang": r.nama,
      "Kategori": r.kategori,
      "Tanggal / Tahun Pengadaan": r.tglPengadaan,
      "Sumber Dana": r.sumberDana,
      "Harga Satuan (Rp)": r.hargaSatuan,
      "Dokumen / Referensi": r.dokumenRef,
      "Lokasi Ruangan": r.ruangan,
    }));
    exportToExcel(exportData, `Data-Pengadaan-Aset-${new Date().toISOString().slice(0, 10)}`, "Pengadaan Aset");
  };

  const CAT_CARDS = [
    { kat: "PM",  label: "Peralatan & Mesin",  count: stats.pmCount,  icon: <Cpu size={16} className="text-purple-600" />, bg: "bg-purple-50", text: "text-purple-700" },
    { kat: "ATB", label: "Aset Tak Berwujud",  count: stats.atbCount, icon: <FileText size={16} className="text-sky-600" />, bg: "bg-sky-50",   text: "text-sky-700" },
    { kat: "ATL", label: "Aset Tetap Lainnya", count: stats.atlCount, icon: <Layers size={16} className="text-teal-600" />, bg: "bg-teal-50",  text: "text-teal-700" },
    { kat: "AL",  label: "Alat Angkutan",      count: stats.alCount,  icon: <Car size={16} className="text-indigo-600" />, bg: "bg-indigo-50", text: "text-indigo-700" },
  ];

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50 min-w-0">
      {topBar}
      <div className="px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-5 min-w-0">
        {/* Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111827]">Data Pengadaan Aset</h1>
            <p className="text-sm text-gray-500 mt-0.5">Ringkasan & riwayat pengadaan aset BMN/BMD SV IPB berdasarkan database real.</p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#111827] rounded-lg hover:bg-gray-800 transition-colors shadow-sm"
          >
            <Download size={16} /> Export Data Pengadaan
          </button>
        </div>

        {/* 4 KPI summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <ShoppingCart size={18} className="text-gray-700" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{fmtNum(stats.totalUnits)}</p>
              <p className="text-xs text-gray-500 leading-tight">Total Aset Terdaftar</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
              <CircleDollarSign size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-green-700">{fmtRp(stats.totalNilai)}</p>
              <p className="text-xs text-gray-500 leading-tight">Nilai Total Perolehan</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Calendar size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-blue-700">{fmtRp(stats.avgNilai)}</p>
              <p className="text-xs text-gray-500 leading-tight">Rata-rata Nilai / Unit</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <Database size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-xl font-bold text-amber-700">{stats.topSumber.name}</p>
              <p className="text-xs text-gray-500 leading-tight">Sumber Dana Utama ({fmtNum(stats.topSumber.count)} unit)</p>
            </div>
          </div>
        </div>

        {/* Category cards breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CAT_CARDS.map(c => {
            const pct = stats.totalUnits > 0 ? ((c.count / stats.totalUnits) * 100).toFixed(1) : "0.0";
            const isSelected = katFilter === c.kat;
            return (
              <button
                key={c.kat}
                onClick={() => {
                  setKatFilter(prev => prev === c.kat ? "" : c.kat);
                  setPage(1);
                }}
                className={`bg-white border rounded-xl p-3 flex flex-col gap-1 shadow-sm transition-all text-left ${isSelected ? "border-[#111827] ring-1 ring-[#111827]" : "border-gray-200 hover:border-gray-300"}`}
              >
                <div className="flex items-center justify-between">
                  <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center`}>{c.icon}</div>
                  {isSelected && <Check size={14} className="text-gray-800" />}
                </div>
                <p className={`text-lg font-bold ${c.text} mt-1`}>{fmtNum(c.count)}</p>
                <p className="text-[11px] text-gray-500 font-medium leading-tight">{c.label}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{pct}% dari total aset</p>
              </button>
            );
          })}
        </div>

        {/* Table Container */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* Filter Bar */}
          <div className="px-5 py-3 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Cari kode aset, nama barang, dokumen..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <select
                  value={sumberFilter}
                  onChange={e => { setSumberFilter(e.target.value); setPage(1); }}
                  className="text-xs border border-gray-200 rounded-lg pl-3 pr-8 py-2 bg-white outline-none focus:ring-1 focus:ring-gray-400 appearance-none cursor-pointer"
                >
                  <option value="">Semua Sumber Dana</option>
                  {sumberDanaList.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              {(katFilter || sumberFilter || search) && (
                <button
                  onClick={() => { setKatFilter(""); setSumberFilter(""); setSearch(""); setPage(1); }}
                  className="text-xs text-red-600 hover:underline px-2 py-1"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  {["Kode / ID Aset", "Nama Barang", "Kategori", "Tgl / Thn Pengadaan", "Sumber Dana", "Harga Satuan (Rp)", "Dokumen / Ref", "Status"].map(h => (
                    <th key={h} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <ShoppingCart size={32} strokeWidth={1} />
                        <p className="text-sm font-medium">Tidak ada data pengadaan aset</p>
                        <p className="text-xs">Coba sesuaikan kata kunci pencarian atau filter pilihan Anda</p>
                      </div>
                    </td>
                  </tr>
                ) : paginated.map((r, i) => (
                  <tr key={r.id + "-" + i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono font-semibold text-gray-600">{r.id}</td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <p className="text-xs font-semibold text-gray-800 truncate">{r.nama}</p>
                      <p className="text-[10px] text-gray-400 truncate">Ruangan: {r.ruangan}</p>
                    </td>
                    <td className="px-4 py-3"><KategoriBadge kategori={r.kategori} /></td>
                    <td className="px-4 py-3 text-xs text-gray-600">{r.tglPengadaan}</td>
                    <td className="px-4 py-3 text-xs font-medium text-gray-700">{r.sumberDana}</td>
                    <td className="px-4 py-3 text-xs font-bold text-gray-900">{fmtRp(r.hargaSatuan)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[140px] truncate">{r.dokumenRef}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded">
                        <Check size={10} /> Terdaftar
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Menampilkan <span className="font-semibold text-gray-700">{paginated.length}</span> dari <span className="font-semibold text-gray-700">{filtered.length}</span> data pengadaan terdaftar
            </p>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 text-xs font-medium text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <span className="text-xs font-medium text-gray-700 px-2">
                Halaman {page} dari {totalPages}
              </span>
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
      </div>
    </main>
  );
}
