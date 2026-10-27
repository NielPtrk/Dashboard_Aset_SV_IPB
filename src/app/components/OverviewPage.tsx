import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Layers,
  Building,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Search,
  X,
  Filter,
  Info,
  Package,
  ExternalLink,
  Lock,
  LogIn
} from "lucide-react";
import { useDataStore, type RuanganData, type Asset } from "./DataStore";
import { SEED_RUANGAN } from "./ruanganSeed";
import { buildAssetRoomMap } from "./assetRoomMatcher";
import { useApp } from "./AppContext";

// ── Formatting Helpers ────────────────────────────────────────────────────────
const fmtRupiahCompact = (n: number) => {
  if (!n || isNaN(n)) return "Rp 0";
  if (n >= 1_000_000_000_000) {
    return `Rp ${(n / 1_000_000_000_000).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} T`;
  }
  if (n >= 1_000_000_000) {
    return `Rp ${(n / 1_000_000_000).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} M`;
  }
  if (n >= 1_000_000) {
    return `Rp ${(n / 1_000_000).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} jt`;
  }
  if (n >= 1_000) {
    return `Rp ${(n / 1_000).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} rb`;
  }
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
};

const fmtRupiahFull = (n: number) => {
  if (!n || isNaN(n)) return "Rp 0";
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
};

const fmtPercent = (p: number) => {
  if (!p || isNaN(p) || p <= 0) return "0,0%";
  return `${p.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
};

const parseVal = (v: any): number => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  const num = parseFloat(String(v).replace(/[^0-9.-]+/g, ""));
  return isNaN(num) ? 0 : num;
};

// ── Canonical Campuses Definition ─────────────────────────────────────────────
const CANONICAL_CAMPUSES = [
  "Kampus Cilibende",
  "Kampus Gunung Gede",
  "Kampus Pajajaran",
  "Kampus Baranangsiang",
  "Kampus / Lokasi Lainnya",
  "Belum Dikategorikan",
] as const;

type CampusName = typeof CANONICAL_CAMPUSES[number];

const CAMPUS_SHORT_LABELS: Record<CampusName, string> = {
  "Kampus Cilibende": "Cilibende",
  "Kampus Gunung Gede": "Gunung Gede",
  "Kampus Pajajaran": "Pajajaran",
  "Kampus Baranangsiang": "Baranangsiang",
  "Kampus / Lokasi Lainnya": "Lokasi lainnya",
  "Belum Dikategorikan": "Belum dikategorikan",
};

const CAMPUS_BAR_COLORS: Record<CampusName, string> = {
  "Kampus Cilibende": "#1D63ED",
  "Kampus Gunung Gede": "#38BDF8",
  "Kampus Pajajaran": "#818CF8",
  "Kampus Baranangsiang": "#93C5FD",
  "Kampus / Lokasi Lainnya": "#CBD5E1",
  "Belum Dikategorikan": "#DBEAFE",
};

// ── Types for Internal Drill-Down Hierarchy ───────────────────────────────────
interface AggregatedRoom {
  id: string;
  sourceId?: number | null;
  kodeRuangan: string;
  namaRuangan: string;
  namaGedung: string;
  kampus: string;
  lantai: string;
  kategori: string;
  luas: number;
  kapasitas: number;
  unitPengguna: string;
  assets: Asset[];
  totalValue: number;
  bmnCount: number;
  obsCount: number;
  kategoriBreakdown: {
    PM: { count: number; value: number };
    ATB: { count: number; value: number };
    ATL: { count: number; value: number };
    AL: { count: number; value: number };
  };
}

interface AggregatedBuilding {
  namaGedung: string;
  kampus: string;
  rooms: AggregatedRoom[];
  totalAssets: number;
  totalValue: number;
  totalRuangan: number;
}

interface AggregatedCampus {
  name: CampusName;
  description?: string;
  buildings: AggregatedBuilding[];
  totalAssets: number;
  totalValue: number;
  totalGedung: number;
  totalRuangan: number;
  percentageValue: number;
  percentageAssets: number;
}

export function OverviewPage({
  topBar,
  onOpenAuth,
}: {
  topBar: React.ReactNode;
  onOpenAuth?: (mode?: any) => void;
}) {
  const store = useDataStore();
  const { userProfile } = useApp();

  // Selected navigation levels:
  // selectedCampus === null -> Level 1 (Kampus table)
  // selectedCampus !== null && selectedBuilding === null -> Level 2 (Gedung list)
  // selectedCampus !== null && selectedBuilding !== null -> Level 3 (Ruangan list)
  const [selectedCampus, setSelectedCampus] = useState<CampusName | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);

  // Campus dropdown toggle
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Active room detail modal/drawer (Level 4)
  const [detailRoom, setDetailRoom] = useState<AggregatedRoom | null>(null);

  // Room list search & category filter state (Level 3)
  const [roomSearchQuery, setRoomSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Semua");
  const [roomPage, setRoomPage] = useState<number>(1);
  const roomPageSize = 10;

  // Reset category filter & room page when navigating back or switching buildings/campuses
  useEffect(() => {
    setSelectedCategory("Semua");
    setRoomSearchQuery("");
    setRoomPage(1);
  }, [selectedBuilding, selectedCampus]);

  // Sync latest rooms from server on mount
  useEffect(() => {
    store.fetchRuangan?.();
  }, []);

  // Detail Drawer asset list search & pagination
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [assetPage, setAssetPage] = useState(1);
  const pageSize = 10;

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Reset pagination when detail room or search query changes
  useEffect(() => {
    setAssetPage(1);
    setAssetSearchQuery("");
  }, [detailRoom]);

  // Master rooms reference from store or SEED
  const masterRooms: RuanganData[] = useMemo(() => {
    return store.ruangan && store.ruangan.length > 0 ? store.ruangan : SEED_RUANGAN;
  }, [store.ruangan]);

  // Unified canonical asset-room matching
  const { assetRoomMap } = useMemo(() => {
    return buildAssetRoomMap(store.assets, masterRooms);
  }, [store.assets, masterRooms]);

  // Total Official Acquisition Value & Asset Count (Strict sum from store.assets)
  const totalAssetsCount = store.assets.length;
  const totalAcquisitionVal = useMemo(() => {
    return store.computeTotalAcquisitionValue();
  }, [store]);

  // Category composition for Card 2
  const categoryStats = useMemo(() => {
    const counts = { PM: 0, ATB: 0, ATL: 0, AL: 0 };
    store.assets.forEach(a => {
      const k = (a.TipeAset || a.jenis_aset || "PM").toUpperCase() as keyof typeof counts;
      if (counts[k] !== undefined) counts[k]++;
      else counts.PM++;
    });
    return counts;
  }, [store.assets]);

  // ── Hierarchical Data Aggregation ──────────────────────────────────────────
  // Guarantees: sum(campus.totalValue) === totalAcquisitionVal
  //            sum(campus.totalAssets) === totalAssetsCount
  const campusAggregates: AggregatedCampus[] = useMemo(() => {
    // 1. Map all master rooms into AggregatedRoom structure
    const roomMap = new Map<string, AggregatedRoom>();

    masterRooms.forEach(mr => {
      let campusName: CampusName = "Belum Dikategorikan";
      const rawK = mr.kampus?.trim() || "";
      if (rawK === "Kampus Cilibende") campusName = "Kampus Cilibende";
      else if (rawK === "Kampus Gunung Gede") campusName = "Kampus Gunung Gede";
      else if (rawK === "Kampus Pajajaran") campusName = "Kampus Pajajaran";
      else if (rawK === "Kampus Baranangsiang") campusName = "Kampus Baranangsiang";
      else if (rawK.includes("Lainnya")) campusName = "Kampus / Lokasi Lainnya";

      const rId = String(mr.id);
      roomMap.set(rId, {
        id: rId,
        sourceId: mr.sourceId,
        kodeRuangan: mr.kodeRuangan || `R-${mr.id}`,
        namaRuangan: mr.namaRuangan || "Ruangan Tanpa Nama",
        namaGedung: mr.namaGedung || "Gedung Tanpa Nama",
        kampus: campusName,
        lantai: String(mr.level || 1),
        kategori: mr.kategori || "Umum",
        luas: mr.luas || 0,
        kapasitas: mr.kapasitas || 0,
        unitPengguna: mr.unitPengguna || mr.alamat || "Sekolah Vokasi (SV)",
        assets: [],
        totalValue: 0,
        bmnCount: 0,
        obsCount: 0,
        kategoriBreakdown: {
          PM: { count: 0, value: 0 },
          ATB: { count: 0, value: 0 },
          ATL: { count: 0, value: 0 },
          AL: { count: 0, value: 0 },
        },
      });
    });

    // Special catch-all room for unmapped assets
    const unassignedRoomId = "unassigned-bucket";
    const unassignedRoom: AggregatedRoom = {
      id: unassignedRoomId,
      kodeRuangan: "UNASSIGNED",
      namaRuangan: "Aset Belum Ditempatkan ke Ruangan Master",
      namaGedung: "Belum Ditentukan",
      kampus: "Belum Dikategorikan",
      lantai: "-",
      kategori: "Penyimpanan / Transit",
      luas: 0,
      kapasitas: 0,
      unitPengguna: "Sekolah Vokasi (SV)",
      assets: [],
      totalValue: 0,
      bmnCount: 0,
      obsCount: 0,
      kategoriBreakdown: {
        PM: { count: 0, value: 0 },
        ATB: { count: 0, value: 0 },
        ATL: { count: 0, value: 0 },
        AL: { count: 0, value: 0 },
      },
    };

    // 2. Distribute every asset into its room
    store.assets.forEach(a => {
      const key = String(a.id || a.kode_tag_aset || "");
      const matchedMaster = assetRoomMap.get(key);
      const val = parseVal(a._harga_perolehan || a.harga_perolehan || a._nilai_buku || a.nilai_buku || "0");
      const catKey = (a.TipeAset || a.jenis_aset || "PM").toUpperCase() as "PM" | "ATB" | "ATL" | "AL";
      const validCat = ["PM", "ATB", "ATL", "AL"].includes(catKey) ? catKey : "PM";

      let targetRoom: AggregatedRoom | undefined;
      if (matchedMaster) {
        targetRoom = roomMap.get(String(matchedMaster.id));
      }

      if (!targetRoom) {
        targetRoom = unassignedRoom;
      }

      targetRoom.assets.push(a);
      targetRoom.bmnCount++;
      targetRoom.totalValue += val;
      targetRoom.kategoriBreakdown[validCat].count++;
      targetRoom.kategoriBreakdown[validCat].value += val;
    });

    // 3. Count Observasi items per room (strictly separated, never added to official totalValue)
    const observasiList = store.observasiItems || [];
    observasiList.forEach(obs => {
      const obsRoomId = String(obs.ruanganId || "");
      const targetRoom = roomMap.get(obsRoomId);
      if (targetRoom) {
        targetRoom.obsCount++;
      } else {
        unassignedRoom.obsCount++;
      }
    });

    // 4. Group into Campuses -> Buildings -> Rooms
    const allRooms = Array.from(roomMap.values());
    if (unassignedRoom.bmnCount > 0 || unassignedRoom.obsCount > 0) {
      allRooms.push(unassignedRoom);
    }

    const campusBuckets: Record<CampusName, Map<string, AggregatedRoom[]>> = {
      "Kampus Cilibende": new Map(),
      "Kampus Gunung Gede": new Map(),
      "Kampus Pajajaran": new Map(),
      "Kampus Baranangsiang": new Map(),
      "Kampus / Lokasi Lainnya": new Map(),
      "Belum Dikategorikan": new Map(),
    };

    allRooms.forEach(room => {
      const camp = (campusBuckets[room.kampus as CampusName] ? room.kampus : "Belum Dikategorikan") as CampusName;
      const bldgMap = campusBuckets[camp];
      const gName = room.namaGedung || "Gedung Tanpa Nama";
      if (!bldgMap.has(gName)) {
        bldgMap.set(gName, []);
      }
      bldgMap.get(gName)!.push(room);
    });

    // 5. Finalize structured AggregatedCampus array
    return CANONICAL_CAMPUSES.map(cName => {
      const bldgMap = campusBuckets[cName];
      const buildings: AggregatedBuilding[] = [];
      let cTotalAssets = 0;
      let cTotalValue = 0;
      let cTotalRuangan = 0;

      bldgMap.forEach((roomsInGedung, gName) => {
        const bAssets = roomsInGedung.reduce((acc, r) => acc + r.bmnCount, 0);
        const bValue = roomsInGedung.reduce((acc, r) => acc + r.totalValue, 0);
        const bRoomsCount = roomsInGedung.length;

        cTotalAssets += bAssets;
        cTotalValue += bValue;
        cTotalRuangan += bRoomsCount;

        buildings.push({
          namaGedung: gName,
          kampus: cName,
          rooms: roomsInGedung,
          totalAssets: bAssets,
          totalValue: bValue,
          totalRuangan: bRoomsCount,
        });
      });

      // Sort buildings by value descending
      buildings.sort((a, b) => b.totalValue - a.totalValue);

      const percentageValue = totalAcquisitionVal > 0 ? (cTotalValue / totalAcquisitionVal) * 100 : 0;
      const percentageAssets = totalAssetsCount > 0 ? (cTotalAssets / totalAssetsCount) * 100 : 0;

      // Extract dynamic description ONLY if present in data (do not hardcode)
      const dynamicDesc = masterRooms.find(r => r.kampus === cName && (r as any).deskripsiKampus)?.deskripsiKampus as string | undefined;

      return {
        name: cName,
        description: dynamicDesc,
        buildings,
        totalAssets: cTotalAssets,
        totalValue: cTotalValue,
        totalGedung: buildings.length,
        totalRuangan: cTotalRuangan,
        percentageValue,
        percentageAssets,
      };
    });
  }, [masterRooms, store.assets, assetRoomMap, store.observasiItems, totalAcquisitionVal, totalAssetsCount]);

  // Selected Campus & Building objects
  const activeCampusObj = useMemo(() => {
    if (!selectedCampus) return null;
    return campusAggregates.find(c => c.name === selectedCampus) || null;
  }, [campusAggregates, selectedCampus]);

  const activeBuildingObj = useMemo(() => {
    if (!activeCampusObj || !selectedBuilding) return null;
    return activeCampusObj.buildings.find(b => b.namaGedung === selectedBuilding) || null;
  }, [activeCampusObj, selectedBuilding]);

  // Category options dynamically sourced from masterRooms (same source as Lokasi & Ruangan)
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    const BASELINE_CATEGORIES = [
      "Gudang",
      "Kamar Mandi/Toilet",
      "Mushola",
      "Ruang Arsip",
      "Ruang Dosen",
      "Ruang Kuliah",
      "Ruang Laboratorium Kering",
      "Ruang Panel/R. Server",
      "Ruang Pantry/Dapur",
      "Ruang Pimpinan (Dekan/Wadek/Sekretaris/Kepala/Kadep dst..)",
      "Ruang Rapat",
      "Ruang Sekretariat",
      "Ruang Studio Mini/Video Confrence",
      "Ruang Tamu",
    ];
    BASELINE_CATEGORIES.forEach(c => set.add(c));
    masterRooms.forEach(r => {
      if (r.kategori && r.kategori.trim()) {
        set.add(r.kategori.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [masterRooms]);

  // Filtered & sorted rooms for Level 3
  const filteredRooms = useMemo(() => {
    if (!activeBuildingObj) return [];
    let list = [...activeBuildingObj.rooms];

    // Filter by category
    if (selectedCategory && selectedCategory !== "Semua") {
      list = list.filter(r => r.kategori === selectedCategory);
    }

    // Filter by search query
    if (roomSearchQuery.trim()) {
      const q = roomSearchQuery.toLowerCase().trim();
      list = list.filter(r =>
        r.namaRuangan.toLowerCase().includes(q) ||
        r.kodeRuangan.toLowerCase().includes(q) ||
        r.kategori.toLowerCase().includes(q)
      );
    }

    // Default sorting: Nilai Aset Tertinggi (highest acquisition value first)
    list.sort((a, b) => b.totalValue - a.totalValue);

    return list;
  }, [activeBuildingObj, selectedCategory, roomSearchQuery]);

  const totalRoomPages = Math.ceil(filteredRooms.length / roomPageSize) || 1;
  const paginatedRooms = useMemo(() => {
    const start = (roomPage - 1) * roomPageSize;
    return filteredRooms.slice(start, start + roomPageSize);
  }, [filteredRooms, roomPage, roomPageSize]);

  // Reset page if out of bounds
  useEffect(() => {
    if (roomPage > totalRoomPages) {
      setRoomPage(1);
    }
  }, [totalRoomPages, roomPage]);

  // Filtered assets inside detail drawer (Level 4)
  const detailRoomFilteredAssets = useMemo(() => {
    if (!detailRoom) return [];
    let list = detailRoom.assets;
    if (assetSearchQuery.trim()) {
      const q = assetSearchQuery.toLowerCase().trim();
      list = list.filter(a =>
        (a.Nama_Barang || a.nama_barang || "").toLowerCase().includes(q) ||
        (a.kode_tag_aset || a.id || "").toLowerCase().includes(q) ||
        (String((a as any).nup || (a as any).NUP || "")).toLowerCase().includes(q)
      );
    }
    return list;
  }, [detailRoom, assetSearchQuery]);

  const totalAssetPages = Math.max(1, Math.ceil(detailRoomFilteredAssets.length / pageSize));
  const pagedDetailAssets = useMemo(() => {
    const start = (assetPage - 1) * pageSize;
    return detailRoomFilteredAssets.slice(start, start + pageSize);
  }, [detailRoomFilteredAssets, assetPage, pageSize]);

  // Observasi items for detail room
  const detailRoomObsItems = useMemo(() => {
    if (!detailRoom) return [];
    return (store.observasiItems || []).filter(o =>
      String(o.ruanganId) === String(detailRoom.id) ||
      (o.namaRuangan && detailRoom.namaRuangan && o.namaRuangan.trim().toLowerCase() === detailRoom.namaRuangan.trim().toLowerCase())
    );
  }, [detailRoom, store.observasiItems]);

  // Header dynamic greeting & name
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Selamat pagi" : hour < 15 ? "Selamat siang" : hour < 18 ? "Selamat sore" : "Selamat malam";
  const user = store.currentUser || (userProfile?.nama ? userProfile : null);
  const rawUserName = user?.nama;
  const formattedGreeting = rawUserName
    ? `${greeting}, ${rawUserName.endsWith(".") ? rawUserName : `${rawUserName}.`}`
    : greeting;

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }, []);

  // ── GUEST MODE: Show generic greeting and locked state without data ──────────
  if (!store.currentUser) {
    return (
      <main className="flex-1 overflow-y-auto bg-slate-50 min-w-0 font-sans">
        {topBar}

        <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-7 min-w-0 max-w-7xl mx-auto">
          {/* Header with generic greeting without name */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[11px] sm:text-xs font-bold tracking-wider uppercase text-slate-400">
                EXECUTIVE ASSET OVERVIEW / SEKOLAH VOKASI IPB
              </p>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
                Overview aset
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                {formattedGreeting}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto shrink-0">
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200/90 text-xs font-medium text-slate-600 shadow-2xs">
                <Calendar size={14} className="text-slate-400 shrink-0" />
                <span>{formattedDate}</span>
              </div>
            </div>
          </div>

          {/* Locked State Container — zero data, zero tables, zero API calls */}
          <div className="w-full bg-white border border-slate-200/80 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-8 sm:p-12 flex flex-col items-center text-center my-6">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-800 mb-5 border border-slate-200/60 shadow-xs">
              <Lock size={32} strokeWidth={2.2} className="text-[#061A33]" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-2">
              Akses Terbatas
            </h2>
            <p className="text-sm font-medium text-slate-600 mb-2">
              Silakan masuk untuk mengakses fitur ini
            </p>
            <p className="text-xs text-slate-400 max-w-md mb-8 leading-relaxed">
              Data inventaris, rekapitulasi nilai perolehan aset, dan pemetaan kampus hanya dapat diakses oleh civitas akademika Sekolah Vokasi IPB yang telah terverifikasi.
            </p>
            <button
              onClick={() => onOpenAuth?.("login")}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#061A33] hover:bg-[#022B5F] text-white text-sm font-semibold transition-all shadow-sm hover:shadow cursor-pointer active:scale-[0.99]"
            >
              <LogIn size={16} />
              <span>Masuk</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50 min-w-0">
      {topBar}

      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-7 min-w-0 max-w-7xl mx-auto">

        {/* ── 1. HEADER (Figma Aligned) ───────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] sm:text-xs font-bold tracking-wider uppercase text-slate-400">
              EXECUTIVE ASSET OVERVIEW / SEKOLAH VOKASI IPB
            </p>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
              Overview aset
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              {formattedGreeting}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto shrink-0">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200/90 text-xs font-medium text-slate-600 shadow-2xs">
              <Calendar size={14} className="text-slate-400 shrink-0" />
              <span>{formattedDate}</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200/80 text-xs font-semibold text-emerald-700 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>Data Realtime Terkini</span>
            </div>
          </div>
        </div>

        {/* ── 2. DUA KARTU UTAMA (HERO KPI CARDS) ──────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">

          {/* Kartu 1: Total Nilai Perolehan (Biru Besar) */}
          <div className="bg-[#1D63ED] rounded-2xl p-6 sm:p-7 text-white shadow-sm flex flex-col justify-between relative overflow-hidden transition-all duration-200 hover:shadow-md">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-100">
                    METRIK FINANSIAL RESMI
                  </span>
                  <h2 className="text-sm font-medium text-white/95 mt-0.5">
                    Total Nilai Perolehan
                  </h2>
                </div>
                <ArrowUpRight size={20} className="text-white/80 shrink-0" />
              </div>

              <div className="mt-5 sm:mt-6">
                <div
                  className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-none"
                  title={fmtRupiahFull(totalAcquisitionVal)}
                >
                  {fmtRupiahCompact(totalAcquisitionVal)}
                </div>
                <div className="text-xs sm:text-sm font-mono text-blue-100/90 mt-2 font-medium">
                  {fmtRupiahFull(totalAcquisitionVal)}
                </div>
                <p className="text-xs text-blue-100/80 mt-3 font-normal leading-relaxed">
                  Akumulasi nilai perolehan aset resmi untuk kelompok PM, ATB, ATL dan AL.
                </p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-blue-400/30 flex items-center justify-between text-xs text-white">
              <div className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 size={15} className="text-blue-200 shrink-0" />
                <span>Nilai Resmi Buku BMN</span>
              </div>
              <span className="font-mono text-blue-100">100% Tercakup</span>
            </div>
          </div>

          {/* Kartu 2: Total Data Aset (Putih) */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-xs flex flex-col justify-between transition-all duration-200 hover:shadow-md">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    POPULASI INVENTARIS
                  </span>
                  <h2 className="text-sm font-medium text-slate-600 mt-0.5">
                    Total Data Aset
                  </h2>
                </div>
                <div className="text-blue-600 p-1">
                  <Layers size={22} />
                </div>
              </div>

              <div className="mt-5 sm:mt-6">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-none">
                    {totalAssetsCount.toLocaleString("id-ID")}
                  </span>
                  <span className="text-sm sm:text-base font-normal text-slate-500">
                    Unit Aset
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-3 font-normal leading-relaxed">
                  Aset resmi terdaftar, termasuk sarana, prasarana, mesin, dan kendaraan.
                </p>
              </div>
            </div>

            <div>
              <div className="border-t border-slate-100 my-4 sm:my-5" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    PM
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-blue-600 mt-1 block">
                    {categoryStats.PM.toLocaleString("id-ID")}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    ATB
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-blue-600 mt-1 block">
                    {categoryStats.ATB.toLocaleString("id-ID")}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    ATL
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-blue-600 mt-1 block">
                    {categoryStats.ATL.toLocaleString("id-ID")}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    AL
                  </span>
                  <span className="text-lg sm:text-xl font-bold text-blue-600 mt-1 block">
                    {categoryStats.AL.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ── 3. BAGIAN LOKASI & RUANGAN ───────────────────────────────────────── */}
        <section className="space-y-4">

          {/* Section Header */}
          <div className="pt-2">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Lokasi & Ruangan
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Telusuri sebaran aset dan nilai perolehan per kampus, gedung, hingga inventaris ruangan.
            </p>
          </div>

          {/* Card: Distribusi Nilai Aset per Kampus */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
                DISTRIBUSI NILAI ASET PER KAMPUS
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                Berdasarkan nilai perolehan resmi
              </span>
            </div>

            {/* Segmented Progress Bar */}
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
              {campusAggregates.map(c => {
                if (c.percentageValue <= 0) return null;
                return (
                  <div
                    key={c.name}
                    style={{
                      width: `${Math.max(c.percentageValue, 0.8)}%`,
                      backgroundColor: CAMPUS_BAR_COLORS[c.name] || "#CBD5E1",
                    }}
                    className="h-full transition-all duration-300 hover:opacity-85 cursor-pointer"
                    title={`${c.name}: ${fmtRupiahCompact(c.totalValue)} (${fmtPercent(c.percentageValue)})`}
                    onClick={() => {
                      setSelectedCampus(c.name);
                      setSelectedBuilding(null);
                    }}
                  />
                );
              })}
            </div>

            {/* Legend Items */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
              {campusAggregates.map(c => (
                <div
                  key={c.name}
                  onClick={() => {
                    setSelectedCampus(c.name);
                    setSelectedBuilding(null);
                  }}
                  className="cursor-pointer group p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: CAMPUS_BAR_COLORS[c.name] || "#94A3B8" }}
                    />
                    <span className="truncate">{CAMPUS_SHORT_LABELS[c.name] || c.name}</span>
                  </div>
                  <div className="text-sm font-bold text-slate-800 mt-1 pl-3.5">
                    {fmtPercent(c.percentageValue)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Filter Bar: Dropdown "Semua Kampus (n)" */}
          <div className="flex items-center justify-between relative pt-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(prev => !prev)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1D63ED] hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer min-h-[44px]"
              >
                <Building size={16} />
                <span>{selectedCampus ? selectedCampus : `Semua Kampus (${campusAggregates.length})`}</span>
                <ChevronDown size={15} className={`transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div
                  ref={dropdownRef}
                  className="absolute left-0 top-full mt-1.5 w-64 bg-white rounded-xl border border-slate-200 shadow-xl z-30 py-1.5 animate-in fade-in duration-150"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCampus(null);
                      setSelectedBuilding(null);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-xs sm:text-sm font-medium flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                      selectedCampus === null ? "text-[#1D63ED] font-bold bg-blue-50/60" : "text-slate-700"
                    }`}
                  >
                    <span>Semua Kampus ({campusAggregates.length})</span>
                    {selectedCampus === null && <CheckCircle2 size={14} className="text-[#1D63ED]" />}
                  </button>
                  <div className="border-t border-slate-100 my-1" />
                  {campusAggregates.map(c => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => {
                        setSelectedCampus(c.name);
                        setSelectedBuilding(null);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-xs sm:text-sm font-medium flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                        selectedCampus === c.name ? "text-[#1D63ED] font-bold bg-blue-50/60" : "text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: CAMPUS_BAR_COLORS[c.name] || "#94A3B8" }}
                        />
                        <span className="truncate">{c.name}</span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono shrink-0 ml-2">
                        {c.totalGedung} Gedung
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              Pilih kampus untuk melihat gedung
            </span>
          </div>

          {/* ── LEVEL 1: TABEL KAMPUS / LOKASI (Figma Aligned) ────────────────── */}
          {selectedCampus === null && (
            <div className="space-y-4">
              {/* Desktop & Tablet Table */}
              <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <th className="py-4 px-6">KAMPUS / LOKASI</th>
                        <th className="py-4 px-6">NILAI PEROLEHAN</th>
                        <th className="py-4 px-6">UNIT ASET</th>
                        <th className="py-4 px-6">GEDUNG / RUANG</th>
                        <th className="py-4 px-6 text-right">EKSPLORASI</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {campusAggregates.map((campus, idx) => {
                        const numStr = String(idx + 1).padStart(2, "0");
                        return (
                          <tr key={campus.name} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-5 px-6">
                              <div className="flex items-start gap-4">
                                <span className="text-xs font-mono font-bold text-slate-400 pt-0.5">{numStr}</span>
                                <div>
                                  <h3 className="text-sm font-bold text-slate-900">{campus.name}</h3>
                                  {campus.description && (
                                    <p className="text-xs text-slate-500 mt-1 max-w-xs">{campus.description}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="py-5 px-6">
                              <div className="text-sm sm:text-base font-bold text-slate-900" title={fmtRupiahFull(campus.totalValue)}>
                                {fmtRupiahCompact(campus.totalValue)}
                              </div>
                              <div className="text-xs font-mono text-slate-400 mt-0.5">
                                {fmtRupiahFull(campus.totalValue)}
                              </div>
                              <div className="text-xs font-mono font-medium text-blue-600 mt-0.5">
                                {fmtPercent(campus.percentageValue)} dari total nilai
                              </div>
                            </td>
                            <td className="py-5 px-6">
                              <span className="text-sm sm:text-base font-bold text-slate-900">
                                {campus.totalAssets.toLocaleString("id-ID")}
                              </span>
                            </td>
                            <td className="py-5 px-6">
                              <div className="text-xs font-bold text-slate-800">
                                {campus.totalGedung} Gedung
                              </div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                {campus.totalRuangan} Ruangan
                              </div>
                            </td>
                            <td className="py-5 px-6 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedCampus(campus.name);
                                  setSelectedBuilding(null);
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200/90 hover:border-blue-300 bg-white hover:bg-blue-50/50 text-blue-600 text-xs font-semibold shadow-2xs transition-all cursor-pointer min-h-[44px]"
                              >
                                <span>Telusuri {campus.totalGedung} Gedung</span>
                                <ChevronRight size={13} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Card List */}
              <div className="md:hidden space-y-3.5">
                {campusAggregates.map((campus, idx) => {
                  const numStr = String(idx + 1).padStart(2, "0");
                  return (
                    <div key={campus.name} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <span className="text-xs font-mono font-bold text-slate-400 pt-0.5">{numStr}</span>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">{campus.name}</h3>
                            {campus.description && (
                              <p className="text-xs text-slate-500 mt-0.5">{campus.description}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-xs font-mono font-semibold text-blue-600 shrink-0">
                          {fmtPercent(campus.percentageValue)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 py-2 border-y border-slate-100 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium block">NILAI PEROLEHAN</span>
                          <span className="font-bold text-slate-900 text-sm block mt-0.5">{fmtRupiahCompact(campus.totalValue)}</span>
                          <span className="text-[10px] font-mono text-slate-400 block">{fmtRupiahFull(campus.totalValue)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium block">UNIT ASET / RUANG</span>
                          <span className="font-bold text-slate-900 text-sm block mt-0.5">{campus.totalAssets.toLocaleString("id-ID")} unit</span>
                          <span className="text-[10px] text-slate-500 block">{campus.totalGedung} Gedung · {campus.totalRuangan} Ruang</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCampus(campus.name);
                          setSelectedBuilding(null);
                        }}
                        className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 text-blue-600 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
                      >
                        <span>Telusuri {campus.totalGedung} Gedung</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── LEVEL 2: GEDUNG LIST ──────────────────────────────────────────── */}
          {selectedCampus !== null && selectedBuilding === null && activeCampusObj && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Breadcrumb Navigation Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setSelectedCampus(null)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1"
                  >
                    <span>Semua Kampus ({campusAggregates.length})</span>
                  </button>
                  <ChevronRight size={14} className="text-slate-300" />
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                    {activeCampusObj.name}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedCampus(null)}
                  className="self-start sm:self-center px-3.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer min-h-[40px]"
                >
                  <ArrowLeft size={13} />
                  <span>Kembali ke Semua Kampus</span>
                </button>
              </div>

              {/* Desktop Table of Buildings */}
              <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-4 px-6">GEDUNG</th>
                      <th className="py-4 px-6">NILAI PEROLEHAN</th>
                      <th className="py-4 px-6">UNIT ASET</th>
                      <th className="py-4 px-6">TOTAL RUANGAN</th>
                      <th className="py-4 px-6 text-right">EKSPLORASI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeCampusObj.buildings.map((bldg, idx) => {
                      const numStr = String(idx + 1).padStart(2, "0");
                      return (
                        <tr key={bldg.namaGedung} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-5 px-6">
                            <div className="flex items-start gap-4">
                              <span className="text-xs font-mono font-bold text-slate-400 pt-0.5">{numStr}</span>
                              <div>
                                <h4 className="text-sm font-bold text-slate-900">{bldg.namaGedung}</h4>
                                <p className="text-xs text-slate-400 mt-0.5">{activeCampusObj.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-5 px-6">
                            <div className="text-sm sm:text-base font-bold text-slate-900" title={fmtRupiahFull(bldg.totalValue)}>
                              {fmtRupiahCompact(bldg.totalValue)}
                            </div>
                            <div className="text-xs font-mono text-slate-400 mt-0.5">
                              {fmtRupiahFull(bldg.totalValue)}
                            </div>
                          </td>
                          <td className="py-5 px-6">
                            <span className="text-sm sm:text-base font-bold text-slate-900">
                              {bldg.totalAssets.toLocaleString("id-ID")}
                            </span>
                          </td>
                          <td className="py-5 px-6">
                            <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-full">
                              {bldg.totalRuangan} Ruangan
                            </span>
                          </td>
                          <td className="py-5 px-6 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBuilding(bldg.namaGedung);
                                setRoomSearchQuery("");
                              }}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200/90 hover:border-blue-300 bg-white hover:bg-blue-50/50 text-blue-600 text-xs font-semibold shadow-2xs transition-all cursor-pointer min-h-[44px]"
                            >
                              <span>Telusuri {bldg.totalRuangan} Ruangan</span>
                              <ChevronRight size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List of Buildings */}
              <div className="md:hidden space-y-3.5">
                {activeCampusObj.buildings.map((bldg, idx) => {
                  const numStr = String(idx + 1).padStart(2, "0");
                  return (
                    <div key={bldg.namaGedung} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <span className="text-xs font-mono font-bold text-slate-400 pt-0.5">{numStr}</span>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">{bldg.namaGedung}</h4>
                            <p className="text-xs text-slate-400">{activeCampusObj.name}</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
                          {bldg.totalRuangan} Ruang
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 py-2 border-y border-slate-100 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium block">NILAI PEROLEHAN</span>
                          <span className="font-bold text-slate-900 text-sm block mt-0.5">{fmtRupiahCompact(bldg.totalValue)}</span>
                          <span className="text-[10px] font-mono text-slate-400 block">{fmtRupiahFull(bldg.totalValue)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium block">UNIT ASET</span>
                          <span className="font-bold text-slate-900 text-sm block mt-0.5">{bldg.totalAssets.toLocaleString("id-ID")} unit</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBuilding(bldg.namaGedung);
                          setRoomSearchQuery("");
                        }}
                        className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 text-blue-600 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
                      >
                        <span>Telusuri {bldg.totalRuangan} Ruangan</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── LEVEL 3: RUANGAN LIST ─────────────────────────────────────────── */}
          {selectedCampus !== null && selectedBuilding !== null && activeBuildingObj && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Breadcrumb Navigation Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCampus(null);
                      setSelectedBuilding(null);
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    Semua Kampus
                  </button>
                  <ChevronRight size={14} className="text-slate-300" />
                  <button
                    type="button"
                    onClick={() => setSelectedBuilding(null)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    {activeCampusObj?.name}
                  </button>
                  <ChevronRight size={14} className="text-slate-300" />
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                    {activeBuildingObj.namaGedung}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedBuilding(null)}
                  className="self-start sm:self-center px-3.5 py-1.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition-colors flex items-center gap-1.5 cursor-pointer min-h-[40px]"
                >
                  <ArrowLeft size={13} />
                  <span>Kembali ke Daftar Gedung</span>
                </button>
              </div>

              {/* Search & Sort Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="relative flex-1 max-w-md">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama ruangan, kode ruangan, kategori..."
                    value={roomSearchQuery}
                    onChange={e => setRoomSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-8 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1D63ED] focus:bg-white font-medium text-slate-800 placeholder:text-slate-400 min-h-[44px]"
                  />
                  {roomSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setRoomSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <Filter size={14} className="text-slate-400 shrink-0" />
                  <span className="text-xs font-semibold text-slate-600 shrink-0">Kategori:</span>
                  <select
                    value={selectedCategory}
                    onChange={e => {
                      setSelectedCategory(e.target.value);
                      setRoomPage(1);
                    }}
                    className="w-full sm:w-auto max-w-full sm:max-w-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#1D63ED] cursor-pointer min-h-[44px] truncate"
                  >
                    <option value="Semua">Semua Kategori</option>
                    {categoryOptions.map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Rooms View */}
              {filteredRooms.length === 0 ? (
                <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-10 text-center space-y-2">
                  <Building size={32} className="text-slate-300 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-700">
                    {selectedCategory !== "Semua"
                      ? "Tidak ada ruangan dengan kategori ini"
                      : "Tidak ada ruangan yang cocok"}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {selectedCategory !== "Semua"
                      ? `Tidak ditemukan ruangan dengan kategori "${selectedCategory}" di gedung ini.`
                      : roomSearchQuery
                        ? `Tidak ditemukan ruangan dengan kata kunci "${roomSearchQuery}".`
                        : "Belum ada ruangan yang tercatat di gedung ini."}
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                          <th className="py-4 px-6">KODE & NAMA RUANGAN</th>
                          <th className="py-4 px-6">LANTAI / KATEGORI</th>
                          <th className="py-4 px-6">NILAI PEROLEHAN</th>
                          <th className="py-4 px-6">UNIT ASET</th>
                          <th className="py-4 px-6 text-right">AKSI</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedRooms.map(room => {
                          const hasAssets = room.bmnCount > 0;
                          return (
                            <tr key={room.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-4 px-6">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                      {room.kodeRuangan}
                                    </span>
                                    {room.obsCount > 0 && (
                                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                                        +{room.obsCount} Observasi
                                      </span>
                                    )}
                                  </div>
                                  <h5 className="text-sm font-bold text-slate-900">{room.namaRuangan}</h5>
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                <div className="text-xs font-semibold text-slate-700">
                                  {room.lantai === "B1" ? "Basement" : `Lantai ${room.lantai}`}
                                </div>
                                <div className="text-xs text-slate-400 mt-0.5">{room.kategori}</div>
                              </td>
                              <td className="py-4 px-6">
                                <div className="text-sm font-bold text-slate-900" title={fmtRupiahFull(room.totalValue)}>
                                  {hasAssets ? fmtRupiahCompact(room.totalValue) : "Rp 0"}
                                </div>
                                <div className="text-xs font-mono text-slate-400 mt-0.5">
                                  {fmtRupiahFull(room.totalValue)}
                                </div>
                              </td>
                              <td className="py-4 px-6">
                                {/* unit aset */}
                                {hasAssets ? (
                                    <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                                      {room.bmnCount.toLocaleString("id-ID")} Unit Aset
                                    </span>
                                  ) : (
                                    <span className="text-xs text-slate-400 italic">
                                      Belum ada aset
                                    </span>
                                  )
                                }
                              </td>
                              <td className="py-4 px-6 text-right">
                                <button
                                  type="button"
                                  onClick={() => setDetailRoom(room)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200/90 hover:border-blue-300 bg-white hover:bg-blue-50/50 text-blue-600 text-xs font-semibold shadow-2xs transition-all cursor-pointer min-h-[44px]"
                                >
                                  <span>Detail Ruangan</span>
                                  <ChevronRight size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden space-y-3.5">
                    {paginatedRooms.map(room => {
                      const hasAssets = room.bmnCount > 0;
                      return (
                        <div key={room.id} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  {room.kodeRuangan}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                                  {room.lantai === "B1" ? "Basement" : `Lantai ${room.lantai}`}
                                </span>
                                {room.obsCount > 0 && (
                                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                                    +{room.obsCount} Obs
                                  </span>
                                )}
                              </div>
                              <h5 className="text-sm font-bold text-slate-900 mt-1">{room.namaRuangan}</h5>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 py-2 border-y border-slate-100 text-xs">
                            <div>
                              <span className="text-[10px] text-slate-400 font-medium block">NILAI PEROLEHAN</span>
                              <span className="font-bold text-slate-900 text-sm block mt-0.5">
                                {hasAssets ? fmtRupiahCompact(room.totalValue) : "Rp 0"}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 block">{fmtRupiahFull(room.totalValue)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 font-medium block">UNIT ASET</span>
                              <span className="font-bold text-slate-900 text-sm block mt-0.5">
                                {room.bmnCount.toLocaleString("id-ID")} unit
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setDetailRoom(room)}
                            className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 text-blue-600 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
                          >
                            <span>Detail Ruangan</span>
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination Controls */}
                  {filteredRooms.length > roomPageSize && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 px-2 text-xs text-slate-500">
                      <div>
                        Menampilkan {((roomPage - 1) * roomPageSize) + 1} - {Math.min(roomPage * roomPageSize, filteredRooms.length)} dari {filteredRooms.length} ruangan
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={roomPage === 1}
                          onClick={() => setRoomPage(p => Math.max(1, p - 1))}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer min-h-[36px]"
                        >
                          Sebelumnya
                        </button>
                        <div className="px-3 py-1.5 font-bold text-slate-800">
                          Hal {roomPage} dari {totalRoomPages}
                        </div>
                        <button
                          type="button"
                          disabled={roomPage >= totalRoomPages}
                          onClick={() => setRoomPage(p => Math.min(totalRoomPages, p + 1))}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer min-h-[36px]"
                        >
                          Selanjutnya
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

        </section>

        {/* ── 4. FOOTER (Figma Aligned) ────────────────────────────────────────── */}
        <footer className="pt-6 pb-8 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <span className="font-semibold uppercase tracking-wider">
            SEKOLAH VOKASI IPB UNIVERSITY
          </span>
          <span>
            Sumber nilai: Buku BMN · 4 kategori aset
          </span>
        </footer>

      </div>

      {/* ── 5. LEVEL 4: DETAIL RUANGAN (SLIDE-OVER / BOTTOM SHEET) ─────────────── */}
      {detailRoom && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop blur */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
            onClick={() => setDetailRoom(null)}
          />

          <div className="fixed inset-y-0 right-0 max-w-xl w-full bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-200 sm:rounded-l-2xl">

            {/* Drawer Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/70 flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-800 px-2 py-0.5 rounded">
                    {detailRoom.kodeRuangan}
                  </span>
                  <span className="text-[10px] font-bold bg-blue-100 text-[#1D63ED] px-2 py-0.5 rounded-full">
                    {detailRoom.kategori}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                    {detailRoom.lantai === "B1" ? "Basement" : `Lantai ${detailRoom.lantai}`}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug">
                  {detailRoom.namaRuangan}
                </h3>
                <p className="text-xs text-slate-500 font-medium truncate">
                  {detailRoom.namaGedung} · {detailRoom.kampus}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDetailRoom(null)}
                className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/80 rounded-xl transition-colors cursor-pointer shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Tutup Detail Ruangan"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

              {/* Highlight Box: Total Nilai Aset Ruangan */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/50 border border-blue-200/90 shadow-xs space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900">
                  Total Nilai Aset Resmi di Ruangan Ini
                </span>
                <div className="text-2xl sm:text-3xl font-black text-[#1D63ED] tracking-tight">
                  {detailRoom.bmnCount > 0 ? fmtRupiahFull(detailRoom.totalValue) : "Rp 0"}
                </div>
                <div className="flex items-center justify-between text-xs text-blue-900/80 pt-1 font-semibold">
                  <span>Populasi Resmi: {detailRoom.bmnCount} Unit Aset BMN</span>
                  <span className="font-mono">{fmtRupiahCompact(detailRoom.totalValue)}</span>
                </div>
              </div>

              {/* Room Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Luas Ruangan</span>
                  <span className="font-bold text-slate-800">{detailRoom.luas > 0 ? `${detailRoom.luas} m²` : "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">Kapasitas</span>
                  <span className="font-bold text-slate-800">{detailRoom.kapasitas > 0 ? `${detailRoom.kapasitas} orang` : "-"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-400 font-bold block">Unit Pengguna</span>
                  <span className="font-bold text-slate-800 truncate block" title={detailRoom.unitPengguna}>
                    {detailRoom.unitPengguna || "Sekolah Vokasi (SV)"}
                  </span>
                </div>
              </div>

              {/* Rincian Per Kategori Aset */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Rincian Aset Berdasarkan Kategori
                </h4>

                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { key: "PM", title: "Peralatan & Mesin", data: detailRoom.kategoriBreakdown.PM, color: "text-blue-700 bg-blue-50 border-blue-200" },
                    { key: "ATB", title: "Aset Tak Berwujud", data: detailRoom.kategoriBreakdown.ATB, color: "text-indigo-700 bg-indigo-50 border-indigo-200" },
                    { key: "ATL", title: "Aset Tetap Lainnya", data: detailRoom.kategoriBreakdown.ATL, color: "text-purple-700 bg-purple-50 border-purple-200" },
                    { key: "AL", title: "Alat Angkutan", data: detailRoom.kategoriBreakdown.AL, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                  ].map(cat => (
                    <div key={cat.key} className={`p-3 rounded-xl border ${cat.color} space-y-1`}>
                      <div className="flex items-center justify-between text-[11px] font-extrabold">
                        <span>{cat.key} ({cat.data.count})</span>
                        <span className="text-[10px] font-normal">{cat.title}</span>
                      </div>
                      <div className="text-xs font-black text-slate-900">
                        {fmtRupiahCompact(cat.data.value)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Info Temuan Observasi (STRICTLY SEPARATED, NEVER ADDED TO OFFICIAL VALUE) */}
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-2">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                  <Info size={14} className="text-amber-600 shrink-0" />
                  <span>Temuan Observasi Lapangan: {detailRoomObsItems.length} Item</span>
                </div>
                <p className="text-[11px] text-amber-900/80 leading-relaxed font-medium">
                  Nilai dari hasil observasi lapangan dipisahkan sebagai catatan audit fisik ruangan dan <strong>tidak digabungkan</strong> ke dalam nilai perolehan resmi BMN.
                </p>
                {detailRoomObsItems.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-28 overflow-y-auto pr-1">
                    {detailRoomObsItems.map((obs, idx) => (
                      <div key={obs.id || idx} className="flex items-center justify-between text-[11px] bg-white p-1.5 rounded border border-amber-200/60">
                        <span className="font-semibold text-slate-800 truncate pr-2">{obs.namaBarang}</span>
                        <span className="font-bold text-amber-700 shrink-0 text-[10px]">
                          {obs.kondisi || "Baik"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Daftar Aset di Ruangan Ini (Search & Paginated) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Daftar Aset di Ruangan Ini ({detailRoom.bmnCount})
                  </h4>
                  {detailRoomFilteredAssets.length > 0 && (
                    <span className="text-[11px] text-slate-400 font-medium">
                      Hal {assetPage} dari {totalAssetPages}
                    </span>
                  )}
                </div>

                {/* Filter search input */}
                {detailRoom.bmnCount > 0 && (
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari nama barang atau kode tag..."
                      value={assetSearchQuery}
                      onChange={e => {
                        setAssetSearchQuery(e.target.value);
                        setAssetPage(1);
                      }}
                      className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1D63ED] font-medium text-slate-800 min-h-[44px]"
                    />
                  </div>
                )}

                {detailRoom.bmnCount === 0 ? (
                  <div className="p-8 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 text-center space-y-1.5">
                    <Package size={24} className="text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">Belum ada aset di ruangan ini</p>
                    <p className="text-[11px] text-slate-400">
                      Ruangan ini telah terdaftar di sistem master ruangan, namun belum ada aset BMN yang dialokasikan.
                    </p>
                  </div>
                ) : detailRoomFilteredAssets.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                    Tidak ada aset yang cocok dengan pencarian "{assetSearchQuery}".
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 font-black uppercase">
                            <th className="px-3 py-2 w-8 text-center">No</th>
                            <th className="px-3 py-2">Nama Barang & Kode</th>
                            <th className="px-3 py-2 text-center">Kondisi</th>
                            <th className="px-3 py-2 text-right">Nilai</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {pagedDetailAssets.map((asset, idx) => {
                            const rowIdx = (assetPage - 1) * pageSize + idx + 1;
                            const assetVal = parseVal(asset._harga_perolehan || asset.harga_perolehan || asset._nilai_buku || asset.nilai_buku || "0");
                            const cond = asset.Kondisi || asset.kondisi || "Baik";
                            const isRusak = cond.toLowerCase().includes("rusak");
                            return (
                              <tr key={asset.id || idx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-3 py-2.5 text-center font-mono text-[11px] text-slate-400">{rowIdx}</td>
                                <td className="px-3 py-2.5">
                                  <div className="font-extrabold text-slate-800 line-clamp-1" title={asset.Nama_Barang || asset.nama_barang}>
                                    {asset.Nama_Barang || asset.nama_barang}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
                                    <span>{asset.kode_tag_aset || asset.id}</span>
                                    {((asset as any).nup || (asset as any).NUP) && (
                                      <span>· NUP: {(asset as any).nup || (asset as any).NUP}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    isRusak ? "bg-rose-100 text-rose-800 border border-rose-200" : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  }`}>
                                    {cond}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900" title={fmtRupiahFull(assetVal)}>
                                  {fmtRupiahCompact(assetVal)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalAssetPages > 1 && (
                      <div className="flex items-center justify-between pt-2">
                        <button
                          type="button"
                          disabled={assetPage <= 1}
                          onClick={() => setAssetPage(p => Math.max(1, p - 1))}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 min-h-[36px]"
                        >
                          <ChevronLeft size={13} />
                          <span>Sebelumnya</span>
                        </button>

                        <span className="text-[11px] font-semibold text-slate-500">
                          {assetPage} / {totalAssetPages}
                        </span>

                        <button
                          type="button"
                          disabled={assetPage >= totalAssetPages}
                          onClick={() => setAssetPage(p => Math.min(totalAssetPages, p + 1))}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 min-h-[36px]"
                        >
                          <span>Selanjutnya</span>
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Drawer Footer (Read-Only notice & actions) */}
            <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
              <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                <CheckCircle2 size={13} className="text-emerald-600" /> Mode Peninjauan (Read-Only)
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDetailRoom(null);
                    window.dispatchEvent(new CustomEvent("app:navigate", { detail: { page: "lokasi" } }));
                  }}
                  className="px-3 py-2 text-xs font-bold text-[#1D63ED] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1 min-h-[44px]"
                >
                  <span>Buka di Lokasi & Ruangan</span>
                  <ExternalLink size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => setDetailRoom(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer min-h-[44px]"
                >
                  Tutup
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </main>
  );
}
