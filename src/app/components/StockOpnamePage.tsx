import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import { useDataStore, type Asset, type RuanganData } from "./DataStore";
import { SEED_RUANGAN } from "./ruanganSeed";
import { exportToExcel, importFromExcel } from "./excelUtils";
import { buildAssetRoomMap, getAssetsForRoom, getAssetsForBuilding, getAssetsForCampus } from "./assetRoomMatcher";
import {
  ClipboardList, Search, Download, X, CheckCircle2, AlertTriangle,
  Check, MapPin, Camera, Building, Upload, Calendar,
  ArrowRightLeft, Users, Play, ArrowLeft, ArrowRight, Layers, Home, QrCode, FileText,
  ChevronDown, ChevronRight, HelpCircle, MapPinOff, Filter, Info, ChevronLeft,
  ChevronsLeft, ChevronsRight, RefreshCw, Eye, Save, CheckSquare, Clock, RotateCcw, LogOut
} from "lucide-react";

type SOTab = "Daftar Aset" | "Ruangan" | "Perpindahan" | "Laporan" | "Pengaturan";

export interface IncompleteClosedRoom {
  roomId: string;
  roomName: string;
  gedung: string;
  kampus: string;
  verifiedCount: number;
  totalCount: number;
  unverifiedCount: number;
  catatan: string;
  closedAt: string;
  closedBy: string;
}

const INCOMPLETE_ROOMS_STORAGE_KEY = "so_incomplete_closed_rooms_v1";

function loadIncompleteRoomsFromStorage(): Record<string, IncompleteClosedRoom> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(INCOMPLETE_ROOMS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveIncompleteRoomsToStorage(data: Record<string, IncompleteClosedRoom>) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(INCOMPLETE_ROOMS_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export interface ReportAssetRow {
  id: string;
  sourceKey: string;
  sumberData: "BMN" | "Observasi";
  kodeBarang: string;
  nup: string;
  namaBarang: string;
  kampus: string;
  namaGedung: string;
  namaRuangan: string;
  ruanganId?: string;
  isVerified: boolean;
  statusSO: "Sudah di-SO" | "Belum di-SO";
  statusSOText?: string;
  kondisi: string;
  lokasiSesuai: string;
  tglSO: string;
  petugasSO: string;
  catatanSO: string;
  nilaiRp: number;
}

export function StockOpnamePage({ topBar }: { topBar?: React.ReactNode }) {
  const store = useDataStore();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [activeTab, setActiveTab] = useState<SOTab>("Daftar Aset");

  // Sub-navigation tab layer: only appears when in an active SO session (workflowStep !== 'dashboard')
  const [activeSubTab, setActiveSubTab] = useState<"Stock Opname" | "Daftar Aset">("Stock Opname");

  // Filters for the "Daftar Aset" Reference Tab (256 Master Rooms)
  const [refCampusFilter, setRefCampusFilter] = useState<string>("Semua");
  const [refBuildingFilter, setRefBuildingFilter] = useState<string>("Semua");
  const [refSearch, setRefSearch] = useState<string>("");
  const [refStatusFilter, setRefStatusFilter] = useState<"Semua" | "Perlu SO" | "Selesai SO" | "Kosong">("Semua");

  // Workflow steps for the "Daftar Aset" tab
  // - dashboard: Overall statistics, Layered Accordion Progress, and the "Mulai SO" CTA
  // - select_scope: Choose work scope (SO Per Gedung, SO Per Ruangan, SO Per Kategori, Scan)
  // - gedung_list: List of 13 master buildings
  // - ruangan_list: List of 256 master rooms + Bucket Ruangan Lainnya
  // - kategori_list: List of asset categories
  // - session: One-by-one SO session
  // - rekap: Summary and confirmation of session edits
  const [workflowStep, setWorkflowStep] = useState<
    "dashboard" | "select_scope" | "gedung_list" | "ruangan_list" | "kategori_list" | "session" | "rekap"
  >("dashboard");

  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [roomFilterSearch, setRoomFilterSearch] = useState<string>("");

  // Accordion expansion states for Layered Progress (Kampus -> Gedung -> Ruangan)
  const [expandedCampuses, setExpandedCampuses] = useState<Record<string, boolean>>({
    "Kampus Cilibende": false,
  });
  const [expandedBuildings, setExpandedBuildings] = useState<Record<string, boolean>>({});

  const toggleCampusExpand = (campus: string) => {
    setExpandedCampuses(prev => ({ ...prev, [campus]: !prev[campus] }));
  };

  const toggleBuildingExpand = (gedung: string) => {
    setExpandedBuildings(prev => ({ ...prev, [gedung]: !prev[gedung] }));
  };

  // SO Session State
  const [sessionAssets, setSessionAssets] = useState<Asset[]>([]);
  const [sessionTargetRoom, setSessionTargetRoom] = useState<RuanganData | null>(null);
  const [currentSessionIndex, setCurrentSessionIndex] = useState<number>(0);
  const [sessionScopeTitle, setSessionScopeTitle] = useState<string>("");

  // Temporary session drafts before saving permanently
  const [sessionDrafts, setSessionDrafts] = useState<Record<string, {
    kondisi: string;
    catatan: string;
    lokasiSesuai: boolean | null;
    lokasiBaru?: string;
    assignedRoomId?: string;
    assignedRoomName?: string;
    assignedGedung?: string;
    assignedKodeRuangan?: string;
    photo?: string;
    saved?: boolean;
  }>>({});

  // Quick Action / Mass SO Modal State
  const [massVerifyRoom, setMassVerifyRoom] = useState<string | null>(null);
  const [massVerifyAssets, setMassVerifyAssets] = useState<Asset[]>([]);
  const [massExcludedIds, setMassExcludedIds] = useState<Set<string>>(new Set());
  const [massProofPhoto, setMassProofPhoto] = useState<string>("");

  // Barcode Scan / Quick Search State
  const [barcodeSearchQ, setBarcodeSearchQ] = useState("");
  const [barcodeMatchAsset, setBarcodeMatchAsset] = useState<Asset | null>(null);

  // Incomplete room closure state (Ruangan Selesai Tidak Lengkap)
  const [incompleteRooms, setIncompleteRooms] = useState<Record<string, IncompleteClosedRoom>>(loadIncompleteRoomsFromStorage);
  const [incompleteModalRoom, setIncompleteModalRoom] = useState<{ room: RuanganData | null; verified: number; total: number; unverified: number } | null>(null);
  const [incompleteCatatan, setIncompleteCatatan] = useState<string>("");

  // Lightweight Toast Notification State
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(prev => (prev === msg ? null : prev));
    }, 3000);
  }, []);

  // Handle browser/mobile back button navigation safely
  useEffect(() => {
    if (workflowStep === "session" || workflowStep === "rekap") {
      window.history.pushState({ so_step: workflowStep }, "");
      const handlePop = () => {
        setWorkflowStep("dashboard");
        showToast("Progres sesi SO tersimpan");
      };
      window.addEventListener("popstate", handlePop);
      return () => {
        window.removeEventListener("popstate", handlePop);
      };
    }
  }, [workflowStep, showToast]);

  // MOCK Assignments for Pengaturan Tab
  const [assignments, setAssignments] = useState<Record<string, string>>({
    "Gedung Sekolah Vokasi": "Petugas 1",
    "Gedung Biokimia SV": "Petugas 2",
    "Kampus Baranangsiang (BS)": "Petugas 3",
  });

  // Master rooms list from store or SEED_RUANGAN fallback (exact 256 canonical master rooms)
  const masterRooms: RuanganData[] = useMemo(() => {
    return (store.ruangan && store.ruangan.length > 0) ? store.ruangan : SEED_RUANGAN;
  }, [store.ruangan]);

  // Master buildings list (13 canonical buildings from masterRooms)
  const masterBuildings = useMemo(() => {
    const set = new Set(masterRooms.map(r => r.namaGedung).filter(Boolean));
    return Array.from(set).sort();
  }, [masterRooms]);

  // 5 Canonical Master Campuses
  const masterCampuses = useMemo(() => {
    const set = new Set(masterRooms.map(r => r.kampus).filter(Boolean));
    const list = Array.from(set);
    const canonicalOrder = [
      "Kampus Cilibende",
      "Kampus Gunung Gede",
      "Kampus Pajajaran",
      "Kampus Baranangsiang",
      "Kampus / Lokasi Lainnya",
      "Kampus Lainnya",
      "Belum Dikategorikan",
    ];
    return list.sort((a, b) => {
      const iA = canonicalOrder.indexOf(a);
      const iB = canonicalOrder.indexOf(b);
      if (iA !== -1 && iB !== -1) return iA - iB;
      if (iA !== -1) return -1;
      if (iB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [masterRooms]);

  // Map each asset ID to its matched master room using the canonical unified matcher
  const { assetRoomMap } = useMemo(() => {
    return buildAssetRoomMap(store.assets, masterRooms);
  }, [masterRooms, store.assets]);

  // Calculate statistics for the current selected year
  const soRecordsThisYear = useMemo(() => {
    return store.stockOpnameRecords.filter(r => r.tanggal.startsWith(String(selectedYear)));
  }, [store.stockOpnameRecords, selectedYear]);

  const items = useMemo(() => {
    return store.assets.map(a => {
      const record = soRecordsThisYear.find(r => r.asset_id === a.id || r.kode_tag === a.kode_tag_aset);
      return {
        ...a,
        isVerified: !!record,
        record: record,
      };
    });
  }, [store.assets, soRecordsThisYear]);

  // Overall Stats
  const totalCount = items.length;
  const verifiedCount = items.filter(i => i.isVerified).length;
  const unverifiedCount = totalCount - verifiedCount;

  const verifiedBaikCount = useMemo(() => {
    return soRecordsThisYear.filter(r => r.kondisi_fisik === "Baik").length;
  }, [soRecordsThisYear]);

  const verifiedRusakCount = useMemo(() => {
    return soRecordsThisYear.filter(r => r.kondisi_fisik?.includes("Rusak")).length;
  }, [soRecordsThisYear]);

  // Unlinked Assets / Bucket Ruangan Lainnya
  const unlinkedAssets = useMemo(() => {
    return items.filter(i => !assetRoomMap.has(i.id));
  }, [items, assetRoomMap]);

  const assetsWithoutLocationCount = unlinkedAssets.length;
  const verifiedUnlinkedCount = useMemo(() => {
    return unlinkedAssets.filter(i => i.isVerified).length;
  }, [unlinkedAssets]);
  const pctUnlinked = assetsWithoutLocationCount ? Math.round((verifiedUnlinkedCount / assetsWithoutLocationCount) * 100) : 0;

  const progressPct = totalCount ? Math.round((verifiedCount / totalCount) * 100) : 0;
  const pctBaik = totalCount ? Math.round((verifiedBaikCount / totalCount) * 100) : 0;
  const pctRusak = totalCount ? Math.round((verifiedRusakCount / totalCount) * 100) : 0;

  // ── Unified Dataset for Laporan Tab (BMN + Observasi) ──────────────────────
  const reportRows: ReportAssetRow[] = useMemo(() => {
    // 1. BMN Assets
    const bmnRows: ReportAssetRow[] = store.assets.map((a) => {
      const matchedRoom = assetRoomMap.get(a.id);
      const rec = soRecordsThisYear.find(r => r.asset_id === a.id || r.kode_tag === a.kode_tag_aset);
      const isVerified = !!rec;
      const campus = a.kampus || matchedRoom?.kampus || "Kampus SV IPB";
      const gedung = matchedRoom?.namaGedung || a.nama_gedung || a.Gedung || "Belum Ada Gedung";
      const room = matchedRoom?.namaRuangan || a.Nama_ruangan || a.nama_ruangan_standar || "Belum Ada Ruangan";

      const rIdKey = matchedRoom?.id ? String(matchedRoom.id) : (a.Id_ruangan ? String(a.Id_ruangan) : "");
      const rNameKey = matchedRoom?.namaRuangan || a.Nama_ruangan || a.nama_ruangan_standar || "";
      const incompleteRecord = !isVerified ? (incompleteRooms[rIdKey] || incompleteRooms[rNameKey]) : undefined;

      return {
        id: a.id,
        sourceKey: `bmn-${a.id}`,
        sumberData: "BMN",
        kodeBarang: a.id || a.kode_tag_aset || "-",
        nup: a.nup || a.NUP || "-",
        namaBarang: a.Nama_Barang || a.nama_barang || "Tanpa Nama",
        kampus: campus,
        namaGedung: gedung,
        namaRuangan: room,
        ruanganId: matchedRoom?.id || a.Id_ruangan || a.id_ruangan,
        isVerified,
        statusSO: isVerified ? "Sudah di-SO" : "Belum di-SO",
        statusSOText: incompleteRecord ? "Belum Terverifikasi (ruangan ditutup tidak lengkap)" : undefined,
        kondisi: rec ? (rec.kondisi_fisik || a.Kondisi || "Baik") : (a.Kondisi || a.kondisi || "Baik"),
        lokasiSesuai: rec ? (rec.status_lokasi || "Sesuai") : "-",
        tglSO: rec ? (rec.tanggal || "-") : "-",
        petugasSO: rec ? (rec.diverifikasi_oleh || "-") : "-",
        catatanSO: rec ? (rec.catatan || "-") : (incompleteRecord?.catatan ? `Ruangan ditutup tidak lengkap: ${incompleteRecord.catatan}` : "-"),
        nilaiRp: Number(a._nilai_buku || a._harga_perolehan || 0),
      };
    });

    // 2. Observasi Items
    const obsRows: ReportAssetRow[] = (store.observasiItems || []).map((o, idx) => {
      const matchedRoom = masterRooms.find(r => String(r.id) === String(o.ruanganId));
      const rec = soRecordsThisYear.find(r =>
        r.asset_id === String(o.id) ||
        r.asset_id === o.id ||
        (o.kodeBarang && r.kode_tag === o.kodeBarang) ||
        (o.nup && r.kode_tag === o.nup)
      );
      const isVerified = !!rec || o.statusSO === "Sudah SO";
      const campus = o.kampus || matchedRoom?.kampus || "Kampus SV IPB";
      const gedung = o.namaGedung || matchedRoom?.namaGedung || "Belum Ada Gedung";
      const room = o.namaRuangan || matchedRoom?.namaRuangan || "Belum Ada Ruangan";

      const rIdKey = o.ruanganId ? String(o.ruanganId) : (matchedRoom?.id ? String(matchedRoom.id) : "");
      const rNameKey = o.namaRuangan || matchedRoom?.namaRuangan || "";
      const incompleteRecord = !isVerified ? (incompleteRooms[rIdKey] || incompleteRooms[rNameKey]) : undefined;

      return {
        id: String(o.id || `obs-${o.ruanganId}-${idx + 1}`),
        sourceKey: `obs-${o.id || idx}`,
        sumberData: "Observasi",
        kodeBarang: o.kodeBarang || `OBS-${o.noUrut || idx + 1}`,
        nup: o.nup || "-",
        namaBarang: o.namaBarang || "Item Observasi",
        kampus: campus,
        namaGedung: gedung,
        namaRuangan: room,
        ruanganId: o.ruanganId || matchedRoom?.id,
        isVerified,
        statusSO: isVerified ? "Sudah di-SO" : "Belum di-SO",
        statusSOText: incompleteRecord ? "Belum Terverifikasi (ruangan ditutup tidak lengkap)" : undefined,
        kondisi: rec ? (rec.kondisi_fisik || o.kondisi || "Baik") : (o.kondisi || "Baik"),
        lokasiSesuai: rec ? (rec.status_lokasi || "Sesuai") : "-",
        tglSO: rec ? (rec.tanggal || "-") : "-",
        petugasSO: rec ? (rec.diverifikasi_oleh || "-") : "-",
        catatanSO: rec ? (rec.catatan || "-") : (incompleteRecord?.catatan ? `Ruangan ditutup tidak lengkap: ${incompleteRecord.catatan}` : "-"),
        nilaiRp: Number(o.jumlahHarga || o.hargaSatuan || 0),
      };
    });

    return [...bmnRows, ...obsRows];
  }, [store.assets, store.observasiItems, assetRoomMap, masterRooms, soRecordsThisYear, incompleteRooms]);

  // Summary Metrics for Laporan Cards
  const reportStats = useMemo(() => {
    const totalTarget = reportRows.length;
    const sudahSO = reportRows.filter(r => r.isVerified).length;
    const belumSO = totalTarget - sudahSO;
    const progressPct = totalTarget > 0 ? Math.round((sudahSO / totalTarget) * 100) : 0;

    const verifiedRows = reportRows.filter(r => r.isVerified);
    const baikCount = verifiedRows.filter(r => r.kondisi === "Baik").length;
    const rusakCount = verifiedRows.filter(r => r.kondisi.includes("Rusak")).length;

    // BMN breakdown
    const bmnRows = reportRows.filter(r => r.sumberData === "BMN");
    const bmnTotal = bmnRows.length;
    const bmnSudah = bmnRows.filter(r => r.isVerified).length;
    const bmnBelum = bmnTotal - bmnSudah;
    const bmnPct = bmnTotal > 0 ? Math.round((bmnSudah / bmnTotal) * 100) : 0;
    const bmnBaik = bmnRows.filter(r => r.isVerified && r.kondisi === "Baik").length;
    const bmnRusak = bmnRows.filter(r => r.isVerified && r.kondisi.includes("Rusak")).length;

    // Observasi breakdown
    const obsRows = reportRows.filter(r => r.sumberData === "Observasi");
    const obsTotal = obsRows.length;
    const obsSudah = obsRows.filter(r => r.isVerified).length;
    const obsBelum = obsTotal - obsSudah;
    const obsPct = obsTotal > 0 ? Math.round((obsSudah / obsTotal) * 100) : 0;
    const obsBaik = obsRows.filter(r => r.isVerified && r.kondisi === "Baik").length;
    const obsRusak = obsRows.filter(r => r.isVerified && r.kondisi.includes("Rusak")).length;

    return {
      totalTarget,
      sudahSO,
      belumSO,
      progressPct,
      baikCount,
      rusakCount,
      bmn: { total: bmnTotal, sudah: bmnSudah, belum: bmnBelum, pct: bmnPct, baik: bmnBaik, rusak: bmnRusak },
      obs: { total: obsTotal, sudah: obsSudah, belum: obsBelum, pct: obsPct, baik: obsBaik, rusak: obsRusak },
    };
  }, [reportRows]);

  // Laporan Filters
  const [reportFilterCampus, setReportFilterCampus] = useState<string>("Semua");
  const [reportFilterGedung, setReportFilterGedung] = useState<string>("Semua");
  const [reportFilterRuangan, setReportFilterRuangan] = useState<string>("Semua");
  const [reportFilterSumber, setReportFilterSumber] = useState<"Semua" | "BMN" | "Observasi">("Semua");
  const [reportFilterStatusSO, setReportFilterStatusSO] = useState<"Semua" | "Sudah di-SO" | "Belum di-SO">("Semua");
  const [reportFilterKondisi, setReportFilterKondisi] = useState<"Semua" | "Baik" | "Rusak Ringan" | "Rusak Berat">("Semua");
  const [reportSearchRaw, setReportSearchRaw] = useState<string>("");
  const reportSearch = useDebounce(reportSearchRaw, 300);

  // Pagination for Laporan
  const [reportPage, setReportPage] = useState<number>(1);
  const [reportPageSize, setReportPageSize] = useState<number>(25);
  const [isExportingReport, setIsExportingReport] = useState<boolean>(false);

  // Reset pagination when filters change
  useEffect(() => {
    setReportPage(1);
  }, [reportFilterCampus, reportFilterGedung, reportFilterRuangan, reportFilterSumber, reportFilterStatusSO, reportFilterKondisi, reportSearch]);

  // Dynamic Building & Room filter options
  const reportGedungOptions = useMemo(() => {
    if (reportFilterCampus === "Semua") {
      return ["Semua", ...masterBuildings];
    }
    const filtered = masterRooms.filter(r =>
      r.kampus.toLowerCase().includes(reportFilterCampus.toLowerCase()) ||
      (reportFilterCampus.includes("Lainnya") && (r.kampus === "Kampus Lainnya" || r.kampus === "Kampus / Lokasi Lainnya"))
    );
    const set = new Set(filtered.map(r => r.namaGedung).filter(Boolean));
    return ["Semua", ...Array.from(set).sort()];
  }, [reportFilterCampus, masterBuildings, masterRooms]);

  const reportRuanganOptions = useMemo(() => {
    let filtered = masterRooms;
    if (reportFilterCampus !== "Semua") {
      filtered = filtered.filter(r =>
        r.kampus.toLowerCase().includes(reportFilterCampus.toLowerCase()) ||
        (reportFilterCampus.includes("Lainnya") && (r.kampus === "Kampus Lainnya" || r.kampus === "Kampus / Lokasi Lainnya"))
      );
    }
    if (reportFilterGedung !== "Semua") {
      filtered = filtered.filter(r => r.namaGedung === reportFilterGedung);
    }
    const set = new Set(filtered.map(r => r.namaRuangan).filter(Boolean));
    return ["Semua", ...Array.from(set).sort()];
  }, [reportFilterCampus, reportFilterGedung, masterRooms]);

  const handleReportCampusChange = (c: string) => {
    setReportFilterCampus(c);
    setReportFilterGedung("Semua");
    setReportFilterRuangan("Semua");
  };

  const handleReportGedungChange = (g: string) => {
    setReportFilterGedung(g);
    setReportFilterRuangan("Semua");
  };

  const activeReportFilterCount = useMemo(() => {
    let c = 0;
    if (reportFilterCampus !== "Semua") c++;
    if (reportFilterGedung !== "Semua") c++;
    if (reportFilterRuangan !== "Semua") c++;
    if (reportFilterSumber !== "Semua") c++;
    if (reportFilterStatusSO !== "Semua") c++;
    if (reportFilterKondisi !== "Semua") c++;
    if (reportSearchRaw.trim()) c++;
    return c;
  }, [reportFilterCampus, reportFilterGedung, reportFilterRuangan, reportFilterSumber, reportFilterStatusSO, reportFilterKondisi, reportSearchRaw]);

  const handleResetReportFilters = () => {
    setReportFilterCampus("Semua");
    setReportFilterGedung("Semua");
    setReportFilterRuangan("Semua");
    setReportFilterSumber("Semua");
    setReportFilterStatusSO("Semua");
    setReportFilterKondisi("Semua");
    setReportSearchRaw("");
    setReportPage(1);
  };

  // Filtered rows
  const filteredReportRows = useMemo(() => {
    return reportRows.filter(row => {
      if (reportFilterCampus !== "Semua") {
        const matchCampus = row.kampus.toLowerCase().includes(reportFilterCampus.toLowerCase()) ||
          (reportFilterCampus.includes("Lainnya") && row.kampus.includes("Lainnya"));
        if (!matchCampus) return false;
      }
      if (reportFilterGedung !== "Semua" && row.namaGedung !== reportFilterGedung) {
        return false;
      }
      if (reportFilterRuangan !== "Semua" && row.namaRuangan !== reportFilterRuangan) {
        return false;
      }
      if (reportFilterSumber !== "Semua" && row.sumberData !== reportFilterSumber) {
        return false;
      }
      if (reportFilterStatusSO !== "Semua" && row.statusSO !== reportFilterStatusSO) {
        return false;
      }
      if (reportFilterKondisi !== "Semua") {
        if (reportFilterKondisi === "Baik" && row.kondisi !== "Baik") return false;
        if (reportFilterKondisi === "Rusak Ringan" && !row.kondisi.toLowerCase().includes("ringan")) return false;
        if (reportFilterKondisi === "Rusak Berat" && !row.kondisi.toLowerCase().includes("berat")) return false;
      }
      if (reportSearch.trim()) {
        const q = reportSearch.trim().toLowerCase();
        const matchText =
          String(row.namaBarang || "").toLowerCase().includes(q) ||
          String(row.kodeBarang || "").toLowerCase().includes(q) ||
          String(row.nup || "").toLowerCase().includes(q) ||
          String(row.namaRuangan || "").toLowerCase().includes(q) ||
          String(row.namaGedung || "").toLowerCase().includes(q) ||
          String(row.petugasSO || "").toLowerCase().includes(q) ||
          String(row.catatanSO || "").toLowerCase().includes(q);
        if (!matchText) return false;
      }
      return true;
    });
  }, [reportRows, reportFilterCampus, reportFilterGedung, reportFilterRuangan, reportFilterSumber, reportFilterStatusSO, reportFilterKondisi, reportSearch]);

  const totalReportPages = Math.ceil(filteredReportRows.length / reportPageSize) || 1;
  const safeReportPage = Math.min(Math.max(1, reportPage), totalReportPages);
  const pagedReportRows = useMemo(() => {
    const start = (safeReportPage - 1) * reportPageSize;
    return filteredReportRows.slice(start, start + reportPageSize);
  }, [filteredReportRows, safeReportPage, reportPageSize]);

  // Export Laporan to Multi-sheet Excel
  const handleExportReportExcel = async () => {
    setIsExportingReport(true);
    try {
      // 1. Data Sheet
      const dataRows = filteredReportRows.map((r, idx) => ({
        "No": idx + 1,
        "Sumber Data": r.sumberData,
        "Kode Barang / Tag": r.kodeBarang,
        "NUP": r.nup === "-" ? "" : r.nup,
        "Nama Barang": r.namaBarang,
        "Kampus": r.kampus,
        "Gedung": r.namaGedung,
        "Ruangan": r.namaRuangan,
        "Status SO": r.statusSO,
        "Hasil Kondisi Fisik": r.kondisi,
        "Hasil Cek Lokasi": r.lokasiSesuai,
        "Tanggal SO": r.tglSO === "-" ? "" : r.tglSO,
        "Petugas SO": r.petugasSO === "-" ? "" : r.petugasSO,
        "Catatan SO": r.catatanSO === "-" ? "" : r.catatanSO,
      }));

      // 2. Summary Sheet
      const summaryData: any[][] = [
        ["LAPORAN HASIL AUDIT STOCK OPNAME"],
        ["SEKOLAH VOKASI - INSTITUT PERTANIAN BOGOR"],
        [`Tahun Periode Audit: ${selectedYear}`],
        [`Waktu Unduh: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} ${new Date().toLocaleTimeString("id-ID")}`],
        [`Petugas / User: ${store.currentUser?.nama || "Admin Sistem"}`],
        [""],
        ["1. RINGKASAN AKUMULASI GLOBAL"],
        ["Indikator", "Jumlah Aset", "Persentase (%)"],
        ["Total Target Aset SO", reportStats.totalTarget, "100%"],
        ["Sudah di-SO", reportStats.sudahSO, `${reportStats.progressPct}%`],
        ["Belum di-SO", reportStats.belumSO, `${100 - reportStats.progressPct}%`],
        ["Hasil Kondisi Ter-SO: Baik", reportStats.baikCount, reportStats.sudahSO ? `${Math.round((reportStats.baikCount / reportStats.sudahSO) * 100)}%` : "0%"],
        ["Hasil Kondisi Ter-SO: Rusak", reportStats.rusakCount, reportStats.sudahSO ? `${Math.round((reportStats.rusakCount / reportStats.sudahSO) * 100)}%` : "0%"],
        [""],
        ["2. BREAKDOWN PEMBEDA SUMBER DATA"],
        ["Sumber Data", "Total Target", "Sudah di-SO", "Belum di-SO", "Progres (%)", "Ter-SO Baik", "Ter-SO Rusak"],
        [
          "Aset Terdaftar (BMN Resmi)",
          reportStats.bmn.total,
          reportStats.bmn.sudah,
          reportStats.bmn.belum,
          `${reportStats.bmn.pct}%`,
          reportStats.bmn.baik,
          reportStats.bmn.rusak
        ],
        [
          "Aset Observasi (Temuan Lapangan)",
          reportStats.obs.total,
          reportStats.obs.sudah,
          reportStats.obs.belum,
          `${reportStats.obs.pct}%`,
          reportStats.obs.baik,
          reportStats.obs.rusak
        ],
        [""],
        ["3. FILTER AKTIF SAAT EKSPOR"],
        ["Filter Kampus", reportFilterCampus],
        ["Filter Gedung", reportFilterGedung],
        ["Filter Ruangan", reportFilterRuangan],
        ["Filter Sumber Data", reportFilterSumber],
        ["Filter Status SO", reportFilterStatusSO],
        ["Filter Kondisi", reportFilterKondisi],
        ["Kata Kunci Pencarian", reportSearchRaw || "-"],
        ["Total Baris Terekspor", filteredReportRows.length],
      ];

      const wb = XLSX.utils.book_new();
      const wsData = XLSX.utils.json_to_sheet(dataRows);
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);

      wsData["!cols"] = [
        { wch: 6 },
        { wch: 14 },
        { wch: 20 },
        { wch: 12 },
        { wch: 36 },
        { wch: 22 },
        { wch: 24 },
        { wch: 28 },
        { wch: 15 },
        { wch: 18 },
        { wch: 16 },
        { wch: 14 },
        { wch: 20 },
        { wch: 30 },
      ];

      wsSummary["!cols"] = [
        { wch: 35 },
        { wch: 20 },
        { wch: 20 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
      ];

      XLSX.utils.book_append_sheet(wb, wsData, `Data SO ${selectedYear}`);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan Eksekutif");

      XLSX.writeFile(wb, `Laporan_Hasil_Stock_Opname_${selectedYear}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      alert("Terjadi kesalahan saat mengekspor laporan.");
    } finally {
      setIsExportingReport(false);
    }
  };

  // Excel handlers
  const handleExport = () => {
    exportToExcel(
      items.map(i => {
        const m = assetRoomMap.get(i.id);
        return {
          "Kode Aset": i.id,
          "Kode Tag": i.kode_tag_aset,
          "Nama Barang": i.Nama_Barang || i.nama_barang,
          "Gedung": m?.namaGedung || i.nama_gedung || i.Gedung || "Belum Ada Gedung",
          "Ruangan": m?.namaRuangan || i.Nama_ruangan || i.nama_ruangan_standar || "Belum Ada Lokasi",
          "Kondisi Saat Ini": i.Kondisi || i.kondisi,
          "Status SO": i.isVerified ? "Ter-SO" : "Belum di-SO",
          "Tgl SO": i.record?.tanggal || "-",
          "Petugas SO": i.record?.diverifikasi_oleh || "-",
          "Catatan": i.record?.catatan || "-",
        };
      }),
      `Data_SO_${selectedYear}`,
      "Stock Opname"
    );
  };

  // ── Reference Data for Sub-tab "Daftar Aset" (256 Master Rooms & Asset Counts) ──
  const refRoomData = useMemo(() => {
    return masterRooms.map((r, idx) => {
      const assetsInRoom = getAssetsForRoom(items, assetRoomMap, r.id);
      const obsInRoom = (store.observasiItems || []).filter(o => String(o.ruanganId) === String(r.id));
      const totalBmnAset = assetsInRoom.length;
      const obsCount = obsInRoom.length;
      const totalAset = totalBmnAset;
      const verifiedAset = assetsInRoom.filter(i => i.isVerified).length;
      const unverifiedAset = totalAset - verifiedAset;
      const pct = totalAset ? Math.round((verifiedAset / totalAset) * 100) : 0;

      return {
        no: idx + 1,
        id: r.id,
        kodeRuangan: r.kodeRuangan || `R-${r.id}`,
        namaRuangan: r.namaRuangan || "Ruangan Tanpa Nama",
        namaGedung: r.namaGedung || "Belum Ada Gedung",
        kampus: r.kampus || "Kampus SV IPB",
        kategori: r.kategori || "Umum",
        unitPengguna: r.unitPengguna || "Sekolah Vokasi (SV)",
        totalAset,
        totalBmnAset,
        obsCount,
        verifiedAset,
        unverifiedAset,
        pct,
      };
    });
  }, [masterRooms, items, assetRoomMap, store.observasiItems]);

  const filteredRefRooms = useMemo(() => {
    return refRoomData.filter((r) => {
      if (refCampusFilter !== "Semua") {
        const matchCampus = r.kampus === refCampusFilter || (refCampusFilter.includes("Lainnya") && (r.kampus === "Kampus Lainnya" || r.kampus === "Kampus / Lokasi Lainnya"));
        if (!matchCampus) return false;
      }
      if (refBuildingFilter !== "Semua" && r.namaGedung !== refBuildingFilter) {
        return false;
      }
      if (refStatusFilter === "Perlu SO" && r.unverifiedAset === 0) {
        return false;
      }
      if (refStatusFilter === "Selesai SO" && (r.totalAset === 0 || r.unverifiedAset > 0)) {
        return false;
      }
      if (refStatusFilter === "Kosong" && r.totalAset > 0) {
        return false;
      }
      if (refSearch.trim()) {
        const q = refSearch.toLowerCase();
        const matchName = r.namaRuangan.toLowerCase().includes(q);
        const matchKode = r.kodeRuangan.toLowerCase().includes(q);
        const matchGedung = r.namaGedung.toLowerCase().includes(q);
        if (!matchName && !matchKode && !matchGedung) return false;
      }
      return true;
    });
  }, [refRoomData, refCampusFilter, refBuildingFilter, refStatusFilter, refSearch]);

  const refTotalAset = useMemo(() => refRoomData.reduce((acc, r) => acc + r.totalAset, 0), [refRoomData]);
  const refTotalUnverified = useMemo(() => refRoomData.reduce((acc, r) => acc + r.unverifiedAset, 0), [refRoomData]);
  const refTotalVerified = useMemo(() => refRoomData.reduce((acc, r) => acc + r.verifiedAset, 0), [refRoomData]);
  const refEmptyRoomsCount = useMemo(() => refRoomData.filter(r => r.totalAset === 0).length, [refRoomData]);

  const handleExportRef = () => {
    exportToExcel(
      filteredRefRooms.map((r, idx) => ({
        No: idx + 1,
        "Kode Ruangan": r.kodeRuangan,
        "Nama Ruangan": r.namaRuangan,
        "Gedung": r.namaGedung,
        "Kampus": r.kampus,
        "Kategori": r.kategori,
        "Unit Pengguna": r.unitPengguna,
        "Total Aset Tercatat": r.totalAset,
        [`Belum di-SO (${selectedYear})`]: r.unverifiedAset,
        [`Sudah di-SO (${selectedYear})`]: r.verifiedAset,
        "Progres SO (%)": `${r.pct}%`,
      })),
      `Referensi_Aset_Ruangan_SO_${selectedYear}`,
      "Referensi_Ruangan"
    );
  };

  const importRef = useRef<HTMLInputElement>(null);
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await importFromExcel(file);
      rows.forEach(row => {
        const id = String(row["Kode Aset"] || "");
        if (!id) return;
        const asset = store.assets.find(a => a.id === id);
        if (!asset) return;

        const alreadyVerified = store.stockOpnameRecords.some(r => r.asset_id === id && r.tanggal.startsWith(String(selectedYear)));

        if (!alreadyVerified) {
          const kondisi = String(row["Kondisi Fisik"] || row["Kondisi Saat Ini"] || "Baik");
          let normKondisi = kondisi;
          if (normKondisi.toUpperCase() === "B") normKondisi = "Baik";
          else if (normKondisi.toUpperCase() === "RR") normKondisi = "Rusak Ringan";
          else if (normKondisi.toUpperCase() === "RB") normKondisi = "Rusak Berat";

          store.recordStockOpname(id, {
            status_opname_terakhir: "Terverifikasi",
            kondisi_fisik_opname_terakhir: normKondisi,
            status_lokasi_opname_terakhir: "Sesuai",
            catatan_opname_terakhir: String(row["Catatan"] || ""),
            Kondisi: normKondisi,
            kondisi: normKondisi,
          }, { skipLog: true });
        }
      });
      store.appendActivity({
        pengguna: store.currentUser.nama,
        role: store.currentUser.role,
        menu: "Opname",
        aksi: `Upload Excel SO — ${rows.length} data validasi diimport ke sistem SO`,
        target_type: "SO",
        target_id: "EXCEL_SO",
        status: "Berhasil",
        jenis: "opname",
      });
      alert("Data berhasil diimport dan divalidasi ke sistem SO.");
    } catch {
      alert("Gagal mengimport data Excel.");
    }
    e.target.value = "";
  };

  // ── Unified Room SO Status Calculator ────────────────────────────────────────
  const getRoomSOStatus = useCallback((room: RuanganData | null, roomAssets: Asset[], obsAssets: any[] = []) => {
    const roomId = room ? String(room.id) : "UNLINKED";
    const roomName = room ? room.namaRuangan : "Ruangan Lainnya";
    const total = (roomAssets?.length || 0) + (obsAssets?.length || 0);
    const verifiedBMN = (roomAssets || []).filter(i => i.isVerified).length;
    const verifiedObs = (obsAssets || []).filter(o => o.statusSO === "Sudah SO" || soRecordsThisYear.some(rec => rec.asset_id === String(o.id))).length;
    const verified = verifiedBMN + verifiedObs;
    const pct = total ? Math.round((verified / total) * 100) : 0;

    const incompleteRecord = incompleteRooms[roomId] || incompleteRooms[roomName];
    const isClosedIncomplete = !!incompleteRecord && verified < total;

    if (total === 0) {
      return {
        status: "Kosong",
        badgeLabel: "Kosong",
        badgeClass: "bg-slate-100 text-slate-500 border border-slate-200",
        btnLabel: "Mulai SO",
        total: 0,
        verified: 0,
        pct: 0,
        isClosedIncomplete: false,
        incompleteRecord: null,
      };
    }

    if (verified >= total && total > 0) {
      return {
        status: "Selesai",
        badgeLabel: "Selesai (100%)",
        badgeClass: "bg-emerald-100 text-emerald-800 border border-emerald-300 font-black",
        btnLabel: "Lihat / Edit SO",
        total,
        verified,
        pct: 100,
        isClosedIncomplete: false,
        incompleteRecord: null,
      };
    }

    if (isClosedIncomplete) {
      return {
        status: "Selesai (Tidak Lengkap)",
        badgeLabel: `Selesai (Tidak Lengkap) · ${pct}%`,
        badgeClass: "bg-amber-100 text-amber-900 border border-amber-300 font-black",
        btnLabel: "Lanjutkan SO",
        total,
        verified,
        pct,
        isClosedIncomplete: true,
        incompleteRecord,
      };
    }

    if (verified > 0) {
      return {
        status: "Sedang Berjalan",
        badgeLabel: `Sedang Berjalan (${verified}/${total})`,
        badgeClass: "bg-blue-100 text-blue-800 border border-blue-300 font-black",
        btnLabel: "Lanjutkan SO",
        total,
        verified,
        pct,
        isClosedIncomplete: false,
        incompleteRecord: null,
      };
    }

    return {
      status: "Belum Mulai",
      badgeLabel: "Belum Mulai",
      badgeClass: "bg-slate-100 text-slate-600 border border-slate-200",
      btnLabel: "Mulai SO",
      total,
      verified: 0,
      pct: 0,
      isClosedIncomplete: false,
      incompleteRecord: null,
    };
  }, [incompleteRooms, soRecordsThisYear]);

  // Active Unfinished Room for Dashboard Banner
  const activeUnfinishedRoom = useMemo(() => {
    for (const r of masterRooms) {
      const bmn = getAssetsForRoom(items, assetRoomMap, r.id);
      const obs = (store.observasiItems || []).filter(o => String(o.ruanganId) === String(r.id));
      const st = getRoomSOStatus(r, bmn, obs);
      if (st.status === "Sedang Berjalan" || st.status === "Selesai (Tidak Lengkap)") {
        return { room: r, verified: st.verified, total: st.total, pct: st.pct, status: st.status };
      }
    }
    return null;
  }, [masterRooms, items, assetRoomMap, store.observasiItems, getRoomSOStatus]);

  // Instant save asset verification function (saves directly to server & state when choices are complete)
  const saveAssetVerification = useCallback((asset: Asset, draft: any) => {
    if (!asset || !draft) return;
    if (!draft.kondisi || draft.lokasiSesuai === null || draft.lokasiSesuai === undefined) return;
    
    const isRusak = draft.kondisi.includes("Rusak");
    if (isRusak && !draft.catatan?.trim()) return;
    if (!draft.lokasiSesuai && !draft.assignedRoomId && !draft.lokasiBaru?.trim()) return;

    const isObs = (asset as any).isObservasi === "true" || (asset as any).isObservasi === true || String(asset.id).startsWith("obs-") || String(asset.id).startsWith("OBS-");
    const hasNewRoom = !draft.lokasiSesuai && !!draft.assignedRoomId;
    const k = draft.kondisi;
    const locStatus = draft.lokasiSesuai ? "Sesuai" : "Berbeda";
    const cat = draft.catatan || (k.includes("Rusak") ? "SO Kondisi Rusak" : "SO Lapangan");

    store.recordStockOpname(asset.id, {
      status_opname_terakhir: "Terverifikasi",
      kondisi_fisik_opname_terakhir: k,
      status_lokasi_opname_terakhir: locStatus,
      catatan_opname_terakhir: cat,
      Kondisi: k,
      kondisi: k,
      ...(hasNewRoom ? {
        Id_ruangan: draft.assignedRoomId,
        id_ruangan: draft.assignedRoomId,
        Nama_ruangan: draft.assignedRoomName,
        nama_ruangan_standar: draft.assignedRoomName,
        Gedung: draft.assignedGedung,
        nama_gedung: draft.assignedGedung,
        kode_ruangan: draft.assignedKodeRuangan,
      } : {}),
    }, { skipLog: true });

    setSessionDrafts(prev => ({
      ...prev,
      [asset.id]: {
        ...draft,
        saved: true,
      }
    }));

    // If room reaches 100% verified, automatically clear any incomplete closure record
    if (sessionTargetRoom) {
      const rId = String(sessionTargetRoom.id);
      const bmnInRoom = getAssetsForRoom(items, assetRoomMap, sessionTargetRoom.id);
      const obsInRoom = (store.observasiItems || []).filter(o => String(o.ruanganId) === String(sessionTargetRoom.id));
      const allInRoom = [...bmnInRoom, ...obsInRoom];
      const isAllDone = allInRoom.every(a => a.id === asset.id || a.isVerified);
      if (isAllDone) {
        setIncompleteRooms(prev => {
          if (!prev[rId] && !prev[sessionTargetRoom.namaRuangan]) return prev;
          const next = { ...prev };
          delete next[rId];
          delete next[sessionTargetRoom.namaRuangan];
          saveIncompleteRoomsToStorage(next);
          return next;
        });
      }
    }
  }, [store, items, assetRoomMap, sessionTargetRoom]);

  // Revert/reset asset verification handler ("Hapus Jawaban")
  const handleResetAnswer = useCallback((asset: Asset) => {
    if (!asset) return;
    setSessionDrafts(prev => {
      const next = { ...prev };
      delete next[asset.id];
      return next;
    });

    store.revertStockOpname(asset.id);
    showToast("Jawaban aset berhasil dikosongkan");
  }, [store, showToast]);

  // Handle incomplete room closure confirmation
  const handleConfirmIncompleteClosure = () => {
    if (!incompleteModalRoom) return;
    const { room, verified, total, unverified } = incompleteModalRoom;
    const roomId = room ? String(room.id) : "UNLINKED";
    const roomName = room ? room.namaRuangan : "Ruangan Lainnya";
    const gedung = room ? room.namaGedung : "Belum Ditentukan";
    const kampus = room ? room.kampus : "SV IPB";
    const catatan = incompleteCatatan.trim() || `${unverified} aset tidak ditemukan di ruangan saat pemeriksaan fisik`;

    const record: IncompleteClosedRoom = {
      roomId,
      roomName,
      gedung,
      kampus,
      verifiedCount: verified,
      totalCount: total,
      unverifiedCount: unverified,
      catatan,
      closedAt: new Date().toISOString().slice(0, 10),
      closedBy: store.currentUser?.nama || "Petugas SO",
    };

    const next = { ...incompleteRooms, [roomId]: record, [roomName]: record };
    setIncompleteRooms(next);
    saveIncompleteRoomsToStorage(next);

    // Append Activity Log for Menu Aktivitas
    store.appendActivity({
      pengguna: store.currentUser.nama,
      role: store.currentUser.role,
      menu: "Opname",
      aksi: `Penutupan ruangan SO tidak lengkap — ${roomName} (${gedung}, ${kampus}), ${verified} dari ${total} aset terverifikasi (${unverified} belum ditemukan) — Catatan: ${catatan}`,
      target_type: "Ruangan",
      target_id: roomId,
      status: "Berhasil",
      jenis: "opname",
    });

    setIncompleteModalRoom(null);
    setIncompleteCatatan("");
    if (workflowStep === "session") {
      setWorkflowStep("dashboard");
    }
    showToast(`Ruangan ${roomName} ditandai Selesai (Tidak Lengkap)`);
  };

  // Initialize SO Session for a Room (combines BMN assets + Observasi assets, jumps to first unverified)
  const startRoomSession = (room: RuanganData) => {
    const bmnAssets = getAssetsForRoom(items, assetRoomMap, room.id);
    const obsInRoom = (store.observasiItems || []).filter(o => String(o.ruanganId) === String(room.id));

    // Convert obs items into Asset shape for SO verification
    const obsAssets: Asset[] = obsInRoom.map((o, idx) => ({
      id: o.id || `obs-${room.id}-${o.noUrut || idx + 1}`,
      kode_tag_aset: o.nup ? `NUP-${o.nup}` : (o.kodeBarang || `OBS-${o.noUrut || idx + 1}`),
      Nama_Barang: o.namaBarang,
      nama_barang: o.namaBarang,
      merekType: o.merekType || "",
      Merek_Tipe: o.merekType || "",
      tahunPerolehan: o.tahunPerolehan || "",
      Tahun_Perolehan: o.tahunPerolehan || "",
      Kondisi: o.kondisi || "Baik",
      kondisi: o.kondisi || "Baik",
      Gedung: room.namaGedung,
      nama_gedung: room.namaGedung,
      Nama_ruangan: room.namaRuangan,
      nama_ruangan_standar: room.namaRuangan,
      Id_ruangan: String(room.id),
      id_ruangan: String(room.id),
      kode_ruangan: room.kodeRuangan || "",
      sumber_dana: o.sumberDana || "",
      volume: String(o.volume || 1),
      harga_satuan: String(o.hargaSatuan || 0),
      jumlah_harga: String(o.jumlahHarga || 0),
      isObservasi: "true",
    }));

    const allRoomAssets = [...bmnAssets, ...obsAssets];
    if (allRoomAssets.length === 0) {
      alert("Tidak ada aset terdaftar maupun hasil observasi di ruangan ini.");
      return;
    }

    // Populate initial drafts ONLY from existing verified records
    const initialDrafts: typeof sessionDrafts = {};
    allRoomAssets.forEach(a => {
      const rec = soRecordsThisYear.find(r => r.asset_id === a.id || r.kode_tag === a.kode_tag_aset);
      if (rec) {
        initialDrafts[a.id] = {
          kondisi: rec.kondisi_fisik || "Baik",
          catatan: rec.catatan || "",
          lokasiSesuai: rec.status_lokasi === "Sesuai",
          lokasiBaru: "",
          assignedRoomId: String(room.id),
          assignedRoomName: room.namaRuangan,
          assignedGedung: room.namaGedung,
          assignedKodeRuangan: room.kodeRuangan || "",
          saved: true,
        };
      }
    });

    // Find first unverified asset
    const firstUnverifiedIdx = allRoomAssets.findIndex(a => {
      const rec = soRecordsThisYear.find(r => r.asset_id === a.id || r.kode_tag === a.kode_tag_aset);
      const isObs = String(a.id).startsWith("obs-") || (a as any).isObservasi === "true";
      return isObs ? (a as any).statusSO !== "Sudah SO" && !rec : !rec && !a.isVerified;
    });

    const targetIdx = firstUnverifiedIdx !== -1 ? firstUnverifiedIdx : 0;

    setSessionTargetRoom(room);
    setSessionAssets(allRoomAssets);
    setCurrentSessionIndex(targetIdx);
    setSessionDrafts(prev => ({ ...initialDrafts, ...prev }));
    setSessionScopeTitle(`SO Ruangan: ${room.namaRuangan}`);
    setActiveSubTab("Stock Opname");
    setWorkflowStep("session");
  };

  // Initialize SO Session
  const startSession = (selectedAssets: Asset[], titleInfo: { building?: string; room?: string; category?: string; isUnlinked?: boolean; targetRoom?: RuanganData }) => {
    if (selectedAssets.length === 0) {
      alert("Tidak ada aset untuk dilakukan SO dalam cakupan ini.");
      return;
    }

    const initialDrafts: typeof sessionDrafts = {};
    selectedAssets.forEach(a => {
      const rec = soRecordsThisYear.find(r => r.asset_id === a.id || r.kode_tag === a.kode_tag_aset);
      if (rec) {
        initialDrafts[a.id] = {
          kondisi: rec.kondisi_fisik || "Baik",
          catatan: rec.catatan || "",
          lokasiSesuai: rec.status_lokasi === "Sesuai",
          lokasiBaru: "",
          assignedRoomId: a.Id_ruangan || "",
          assignedRoomName: a.Nama_ruangan || "",
          assignedGedung: a.Gedung || "",
          assignedKodeRuangan: a.kode_ruangan || "",
          saved: true,
        };
      }
    });

    const firstUnverifiedIdx = selectedAssets.findIndex(a => {
      const rec = soRecordsThisYear.find(r => r.asset_id === a.id || r.kode_tag === a.kode_tag_aset);
      return !rec && !a.isVerified;
    });

    const targetIdx = firstUnverifiedIdx !== -1 ? firstUnverifiedIdx : 0;

    setSessionTargetRoom(titleInfo.targetRoom || null);
    setSessionAssets(selectedAssets);
    setCurrentSessionIndex(targetIdx);
    setSessionDrafts(prev => ({ ...initialDrafts, ...prev }));

    let title = "Sesi SO";
    if (titleInfo.isUnlinked) title = "SO Ruangan Lainnya / Aset Tanpa Ruangan";
    else if (titleInfo.room) title = `SO Ruangan: ${titleInfo.room}`;
    else if (titleInfo.building) title = `SO Gedung: ${titleInfo.building}`;
    else if (titleInfo.category) title = `SO Kategori: ${titleInfo.category}`;
    setSessionScopeTitle(title);

    setActiveSubTab("Stock Opname");
    setWorkflowStep("session");
  };

  // Mass action handlers
  const handleOpenMassVerify = (roomName: string, assetsInRoom: Asset[]) => {
    setMassVerifyRoom(roomName);
    setMassVerifyAssets(assetsInRoom);
    setMassExcludedIds(new Set());
    setMassProofPhoto("");
  };

  const handleConfirmMassVerify = () => {
    if (!massProofPhoto) {
      alert("Wajib mengunggah minimal 1 foto bukti fisik sebelum melakukan SO massal.");
      return;
    }

    const verifiedAssets = massVerifyAssets.filter(a => !massExcludedIds.has(a.id));
    if (verifiedAssets.length === 0) {
      alert("Semua aset dikecualikan. Tidak ada data untuk di-SO.");
      return;
    }

    verifiedAssets.forEach(asset => {
      store.recordStockOpname(asset.id, {
        status_opname_terakhir: "Terverifikasi",
        kondisi_fisik_opname_terakhir: "Baik",
        status_lokasi_opname_terakhir: "Sesuai",
        catatan_opname_terakhir: "SO Massal - Baik",
        Kondisi: "Baik",
        kondisi: "Baik",
      }, { skipLog: true });
    });

    store.appendActivity({
      pengguna: store.currentUser.nama,
      role: store.currentUser.role,
      menu: "Opname",
      aksi: `SO Massal — ${massVerifyRoom || "Ruangan"}, ${verifiedAssets.length} aset diverifikasi Baik`,
      target_type: "Ruangan",
      target_id: massVerifyRoom || "MASS_SO",
      status: "Berhasil",
      jenis: "opname",
    });

    alert(`Berhasil menyelesaikan SO ${verifiedAssets.length} aset sebagai Baik.`);
    setMassVerifyRoom(null);
  };

  // Search Asset for SO
  const handleBarcodeSearch = () => {
    const q = barcodeSearchQ.trim();
    if (!q) return;
    const match = store.assets.find(a => a.id === q || a.kode_tag_aset === q);
    if (match) {
      setBarcodeMatchAsset(match);
    } else {
      alert("Aset tidak ditemukan. Silakan periksa kembali kode.");
      setBarcodeMatchAsset(null);
    }
  };

  return (
    <div className="flex flex-col flex-1 w-full h-full bg-slate-50 overflow-hidden font-sans">
      {/* Top Breadcrumb/Bar */}
      {topBar}

      {/* Main Header */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <ClipboardList className="text-blue-600 shrink-0" size={24} /> Stock Opname Aset
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Sistem Audit Fisik Periodik & Pendataan Lokasi Aset SV IPB</p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
              <Calendar size={16} className="text-slate-600 shrink-0" />
              <span className="text-xs font-bold text-slate-700">Tahun Audit:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent text-xs font-extrabold text-blue-600 outline-none cursor-pointer"
              >
                {[...Array(6)].map((_, i) => {
                  const y = currentYear - i + 1;
                  return <option key={y} value={y}>{y}</option>;
                })}
              </select>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-4 sm:gap-6 mt-4 border-b border-slate-200 overflow-x-auto no-scrollbar">
          {(["Daftar Aset", "Ruangan", "Perpindahan", "Laporan", "Pengaturan"] as SOTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setWorkflowStep("dashboard");
                setActiveSubTab("Stock Opname");
              }}
              className={`pb-3 text-xs font-extrabold tracking-wider uppercase border-b-2 whitespace-nowrap transition-all ${activeTab === tab
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-400 hover:text-slate-700"
                }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Scroll Container */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 bg-slate-50">

        {/* ==================== TAB 1: DAFTAR ASET / WIZARD FLOW ==================== */}
        {activeTab === "Daftar Aset" && (
          <div className="w-full mx-auto space-y-5 sm:space-y-6">

            {/* STEP: DASHBOARD LANDING PAGE */}
            {workflowStep === "dashboard" && (
              <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-200">
                {/* Visual Header Banner */}
                <div className="relative rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 p-5 sm:p-7 md:p-8 text-white shadow-lg overflow-hidden">
                  <div className="absolute right-0 top-0 opacity-10 translate-x-10 -translate-y-10 scale-150 pointer-events-none">
                    <ClipboardList size={240} />
                  </div>
                  <div className="relative z-10 max-w-3xl">
                    <span className="inline-block bg-blue-500/30 text-blue-200 text-[10px] sm:text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full border border-blue-400/30">
                      Modul Stock Opname
                    </span>
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-black mt-3 leading-tight">
                      Mulai Audit & SO Aset Tahunan
                    </h2>
                    <p className="text-xs sm:text-sm text-blue-200/90 mt-2 font-medium leading-relaxed max-w-2xl">
                      Periksa kesesuaian fisik, rekam kondisi terkini (Baik/Rusak), ambil foto bukti lapangan, dan tentukan lokasi ruangan secara langsung.
                    </p>
                    <div className="mt-5 sm:mt-6 flex flex-wrap items-center gap-2.5 sm:gap-3">
                      <button
                        onClick={() => setWorkflowStep("select_scope")}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase px-5 sm:px-6 py-3 rounded-xl transition-all shadow-md flex items-center gap-2 transform active:scale-95 cursor-pointer w-full sm:w-auto justify-center"
                      >
                        <Play size={14} fill="currentColor" /> Mulai SO
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab("Laporan");
                          setWorkflowStep("dashboard");
                        }}
                        className="bg-blue-500/80 hover:bg-blue-500 text-white font-bold text-xs uppercase px-4 py-3 rounded-xl transition-all border border-blue-400/40 flex items-center gap-2 justify-center w-full sm:w-auto cursor-pointer shadow-sm"
                      >
                        <FileText size={14} /> Buka Tab Laporan
                      </button>
                      <button
                        onClick={() => importRef.current?.click()}
                        className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase px-4 py-3 rounded-xl transition-all border border-white/20 flex items-center gap-2 justify-center w-full sm:w-auto cursor-pointer"
                      >
                        <Upload size={14} /> Import Excel
                      </button>
                      <button
                        onClick={handleExportReportExcel}
                        disabled={isExportingReport}
                        className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase px-4 py-3 rounded-xl transition-all border border-white/20 flex items-center gap-2 justify-center w-full sm:w-auto cursor-pointer disabled:opacity-50"
                      >
                        {isExportingReport ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                        Export Laporan SO
                      </button>
                      <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
                    </div>
                  </div>
                </div>

                {/* Active Session Continuation Banner */}
                {activeUnfinishedRoom && (
                  <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border border-blue-200 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-in fade-in">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                        <Clock size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-black text-blue-950">Anda memiliki sesi SO yang belum selesai</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            activeUnfinishedRoom.status.includes("Tidak Lengkap")
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : "bg-blue-100 text-blue-900 border border-blue-200"
                          }`}>
                            {activeUnfinishedRoom.verified}/{activeUnfinishedRoom.total} Aset ({activeUnfinishedRoom.pct}%)
                          </span>
                        </div>
                        <p className="text-xs text-blue-700 font-semibold mt-0.5">
                          {activeUnfinishedRoom.room.namaGedung} — {activeUnfinishedRoom.room.namaRuangan} ({activeUnfinishedRoom.room.kampus})
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => startRoomSession(activeUnfinishedRoom.room)}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                    >
                      <Play size={13} fill="currentColor" /> Lanjutkan Sesi SO
                    </button>
                  </div>
                )}

                {/* Progress bar bertingkat Global */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-800">Progres Akumulasi Audit SO ({selectedYear})</h3>
                      <p className="text-xs text-slate-400 font-medium">Persentase data ter-SO dan kondisi fisik di lapangan</p>
                    </div>
                    <div className="sm:text-right flex items-baseline sm:block gap-2">
                      <span className="text-xl sm:text-2xl font-black text-blue-600">{progressPct}%</span>
                      <span className="text-xs font-bold text-slate-400"> ({verifiedCount.toLocaleString("id-ID")} / {totalCount.toLocaleString("id-ID")} Aset)</span>
                    </div>
                  </div>

                  {/* Multi-layered progress bar */}
                  <div className="w-full bg-slate-100 rounded-full h-3.5 sm:h-4 overflow-hidden flex shadow-inner">
                    <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${pctBaik}%` }} title={`Ter-SO Baik: ${pctBaik}%`} />
                    <div className="bg-rose-500 h-full transition-all duration-500" style={{ width: `${pctRusak}%` }} title={`Ter-SO Rusak: ${pctRusak}%`} />
                    <div className="bg-slate-300 h-full transition-all duration-500 flex-1" title={`Belum di-SO: ${Math.max(0, 100 - pctBaik - pctRusak)}%`} />
                  </div>

                  <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs font-semibold text-slate-500 pt-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-3 h-3 bg-emerald-500 rounded-full shrink-0"></span>
                      <span className="truncate">Ter-SO Baik ({pctBaik}%)</span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-3 h-3 bg-rose-500 rounded-full shrink-0"></span>
                      <span className="truncate">Ter-SO Rusak ({pctRusak}%)</span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-3 h-3 bg-slate-300 rounded-full shrink-0"></span>
                      <span className="truncate">Belum di-SO ({Math.max(0, 100 - pctBaik - pctRusak)}%)</span>
                    </div>
                  </div>
                </div>

                {/* ==================== PROGRESS ACCORDION 3 LEVEL (KAMPUS → GEDUNG → RUANGAN) ==================== */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-800 flex items-center gap-2">
                        <Building className="text-indigo-600 shrink-0" size={18} /> Breakdown Progres SO Berlapis
                      </h3>
                      <p className="text-xs text-slate-400 font-medium">Struktur hirarki Kampus → Gedung → Ruangan Master (13 Gedung & 256 Ruangan)</p>
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg self-start sm:self-auto">
                      5 Kampus Master
                    </span>
                  </div>

                  {/* 1. Baris Khusus: Aset Tanpa Lokasi (Bucket Ruangan Lainnya) */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 sm:p-4 transition-all hover:bg-amber-50/70">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                          <MapPinOff size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-black text-slate-900">Aset Tanpa Lokasi (Bucket "Ruangan Lainnya")</h4>
                            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
                              Wajib Assign Lokasi
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                            Aset yang belum memiliki referensi gedung/ruangan master terdaftar
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:w-80 shrink-0">
                        <div className="flex-1 w-full space-y-1">
                          <div className="flex justify-between text-[11px] font-bold text-slate-600">
                            <span>{pctUnlinked}% Selesai</span>
                            <span>{verifiedUnlinkedCount.toLocaleString("id-ID")} / {assetsWithoutLocationCount.toLocaleString("id-ID")} Aset</span>
                          </div>
                          <div className="w-full bg-amber-200/50 rounded-full h-2 overflow-hidden shadow-inner">
                            <div className="bg-amber-500 h-full transition-all duration-300" style={{ width: `${pctUnlinked}%` }} />
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedBuilding(null);
                            setWorkflowStep("ruangan_list");
                          }}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[11px] rounded-lg shadow-sm transition-all whitespace-nowrap cursor-pointer shrink-0"
                        >
                          SO Ruangan Lainnya →
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 2. Accordion 5 Kampus Master */}
                  <div className="space-y-2.5 pt-1">
                    {masterCampuses.map((campus) => {
                      const isExpanded = !!expandedCampuses[campus];
                      const roomsInCampus = masterRooms.filter(r => r.kampus === campus || (campus.includes("Lainnya") && (r.kampus === "Kampus Lainnya" || r.kampus === "Kampus / Lokasi Lainnya")));
                      const buildingsInCampus = Array.from(new Set(roomsInCampus.map(r => r.namaGedung).filter(Boolean))).sort();

                      const campusAssets = getAssetsForCampus(items, assetRoomMap, campus);

                      const totalCampusAssets = campusAssets.length;
                      const verifiedCampusAssets = campusAssets.filter(i => i.isVerified).length;
                      const pctCampus = totalCampusAssets ? Math.round((verifiedCampusAssets / totalCampusAssets) * 100) : 0;
                      const colorCampus = pctCampus < 30 ? "bg-rose-500" : pctCampus < 70 ? "bg-amber-500" : "bg-emerald-500";

                      return (
                        <div key={campus} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm transition-all">
                          {/* LEVEL 1: CAMPUS HEADER */}
                          <div
                            onClick={() => toggleCampusExpand(campus)}
                            className="p-3.5 sm:p-4 bg-slate-50/80 hover:bg-slate-100/70 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <button className="p-1 text-slate-500 hover:text-slate-800 rounded transition-colors">
                                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              </button>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-xs sm:text-sm font-black text-slate-900">{campus}</h4>
                                  <span className="text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full">
                                    {buildingsInCampus.length} Gedung · {roomsInCampus.length} Ruangan
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 md:w-72 shrink-0 ml-8 md:ml-0">
                              <div className="flex-1 space-y-1">
                                <div className="flex justify-between text-[11px] font-bold text-slate-600">
                                  <span>{pctCampus}% Selesai</span>
                                  <span>{verifiedCampusAssets.toLocaleString("id-ID")} / {totalCampusAssets.toLocaleString("id-ID")} Aset</span>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden shadow-inner">
                                  <div className={`h-full ${colorCampus} transition-all duration-300`} style={{ width: `${pctCampus}%` }} />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* LEVEL 2 & 3: EXPANDED BUILDINGS & ROOMS */}
                          {isExpanded && (
                            <div className="p-3 sm:p-4 bg-white border-t border-slate-100 space-y-3 pl-6 sm:pl-8 animate-in fade-in duration-150">
                              {buildingsInCampus.length === 0 ? (
                                <p className="text-xs text-slate-400 font-medium italic">Tidak ada gedung master pada kampus ini.</p>
                              ) : (
                                buildingsInCampus.map((gedung) => {
                                  const isGedungExpanded = !!expandedBuildings[gedung];
                                  const roomsInGedung = roomsInCampus.filter(r => r.namaGedung === gedung);
                                  const assetsInGedung = getAssetsForBuilding(items, assetRoomMap, gedung);
                                  const totalGedungAssets = assetsInGedung.length;
                                  const verifiedGedungAssets = assetsInGedung.filter(i => i.isVerified).length;
                                  const pctGedung = totalGedungAssets ? Math.round((verifiedGedungAssets / totalGedungAssets) * 100) : 0;
                                  const colorGedung = pctGedung < 30 ? "bg-rose-500" : pctGedung < 70 ? "bg-amber-500" : "bg-emerald-500";

                                  return (
                                    <div key={gedung} className="rounded-lg border border-slate-200 bg-slate-50/50 overflow-hidden">
                                      {/* LEVEL 2: GEDUNG HEADER */}
                                      <div
                                        onClick={() => toggleBuildingExpand(gedung)}
                                        className="p-3 hover:bg-slate-100/80 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-2.5 transition-colors"
                                      >
                                        <div className="flex items-center gap-2.5">
                                          <button className="p-0.5 text-slate-400 hover:text-slate-700">
                                            {isGedungExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                          </button>
                                          <Building size={14} className="text-blue-600 shrink-0" />
                                          <span className="text-xs font-black text-slate-800">{gedung}</span>
                                          <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                                            {roomsInGedung.length} Ruangan
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-3 md:w-64 shrink-0 ml-6 md:ml-0">
                                          <div className="flex-1 space-y-1">
                                            <div className="flex justify-between text-[10px] font-bold text-slate-500">
                                              <span>{pctGedung}%</span>
                                              <span>{verifiedGedungAssets.toLocaleString("id-ID")} / {totalGedungAssets.toLocaleString("id-ID")}</span>
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                              <div className={`h-full ${colorGedung} transition-all duration-300`} style={{ width: `${pctGedung}%` }} />
                                            </div>
                                          </div>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedBuilding(gedung);
                                              setWorkflowStep("ruangan_list");
                                            }}
                                            className="text-[10px] font-black text-blue-600 hover:text-blue-700 hover:underline shrink-0"
                                          >
                                            Buka →
                                          </button>
                                        </div>
                                      </div>

                                      {/* LEVEL 3: RUANGAN ITEMS */}
                                      {isGedungExpanded && (
                                        <div className="p-2.5 bg-white border-t border-slate-100 space-y-1.5 pl-6 sm:pl-8 divide-y divide-slate-100">
                                          {roomsInGedung.map((room) => {
                                            const assetsInRoom = getAssetsForRoom(items, assetRoomMap, room.id);
                                            const obsInRoom = (store.observasiItems || []).filter(o => String(o.ruanganId) === String(room.id));
                                            const statusObj = getRoomSOStatus(room, assetsInRoom, obsInRoom);
                                            const colorRoom = statusObj.pct < 30 ? "bg-rose-500" : statusObj.pct < 70 ? "bg-amber-500" : "bg-emerald-500";

                                            return (
                                              <div key={room.kodeRuangan || room.id} className="pt-2 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                                  <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded shrink-0">
                                                    {room.kodeRuangan || `R-${room.id}`}
                                                  </span>
                                                  <span className="text-xs font-bold text-slate-700 truncate">{room.namaRuangan}</span>
                                                  {obsInRoom.length > 0 && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.2 bg-rose-50 text-rose-700 rounded border border-rose-200 shrink-0">
                                                      +{obsInRoom.length} Obs
                                                    </span>
                                                  )}
                                                  <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${statusObj.badgeClass}`}>
                                                    {statusObj.badgeLabel}
                                                  </span>
                                                </div>

                                                <div className="flex items-center gap-3 sm:w-64 shrink-0">
                                                  <div className="flex-1 space-y-0.5">
                                                    <div className="flex justify-between text-[9px] font-bold text-slate-400">
                                                      <span>{statusObj.pct}%</span>
                                                      <span>{statusObj.verified}/{statusObj.total} Aset</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                                                      <div className={`h-full ${colorRoom}`} style={{ width: `${statusObj.pct}%` }} />
                                                    </div>
                                                  </div>
                                                  <button
                                                    onClick={() => startRoomSession(room)}
                                                    disabled={statusObj.total === 0}
                                                    className={`px-2.5 py-1 font-extrabold text-[10px] rounded transition-all disabled:opacity-30 cursor-pointer shrink-0 ${
                                                      statusObj.status === "Sedang Berjalan" || statusObj.status === "Selesai (Tidak Lengkap)"
                                                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                                                        : "bg-blue-50 hover:bg-blue-100 text-blue-700"
                                                    }`}
                                                  >
                                                    {statusObj.btnLabel}
                                                  </button>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Grid Status Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="w-10 sm:w-12 h-10 sm:h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                      <CheckCircle2 size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">Kondisi Baik</p>
                      <h4 className="text-lg sm:text-xl font-black text-slate-900 truncate">{verifiedBaikCount.toLocaleString("id-ID")}</h4>
                    </div>
                  </div>
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="w-10 sm:w-12 h-10 sm:h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600 shrink-0">
                      <AlertTriangle size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">Kondisi Rusak</p>
                      <h4 className="text-lg sm:text-xl font-black text-slate-900 truncate">{verifiedRusakCount.toLocaleString("id-ID")}</h4>
                    </div>
                  </div>
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="w-10 sm:w-12 h-10 sm:h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 shrink-0">
                      <ClipboardList size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">Belum di-SO</p>
                      <h4 className="text-lg sm:text-xl font-black text-slate-900 truncate">{unverifiedCount.toLocaleString("id-ID")}</h4>
                    </div>
                  </div>
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="w-10 sm:w-12 h-10 sm:h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
                      <MapPin size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider truncate">Belum Ada Lokasi</p>
                      <h4 className="text-lg sm:text-xl font-black text-slate-900 truncate">{assetsWithoutLocationCount.toLocaleString("id-ID")}</h4>
                    </div>
                  </div>
                </div>

                {/* Direct Search Bar */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-black text-slate-800 mb-2.5">Pencarian Cepat Aset Spesifik</h3>
                  <div className="relative w-full">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Cari berdasarkan Nama Aset, Kode ID, atau No Tag..."
                      className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-blue-500 transition-all font-medium"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const val = (e.target as HTMLInputElement).value;
                          const filtered = items.filter(i =>
                            (i.Nama_Barang || i.nama_barang || "").toLowerCase().includes(val.toLowerCase()) ||
                            (i.kode_tag_aset || "").toLowerCase().includes(val.toLowerCase()) ||
                            (i.id || "").toLowerCase().includes(val.toLowerCase())
                          );
                          startSession(filtered, {});
                        }
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 font-medium">Tekan [Enter] untuk memulai SO cepat dari daftar pencarian tersebut.</p>
                </div>
              </div>
            )}

            {/* STEP: SELECT SCOPE (CAKUPAN KERJA SO) */}
            {workflowStep === "select_scope" && (
              <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setWorkflowStep("dashboard")}
                    className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition-all cursor-pointer"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Pilih Cakupan SO</h2>
                    <p className="text-xs text-slate-400 font-medium">Batasi ruang lingkup kerja SO agar lebih teratur dan terstruktur</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {/* Card 1: SO Per Gedung */}
                  <button
                    onClick={() => {
                      setSelectedBuilding(null);
                      setWorkflowStep("gedung_list");
                    }}
                    className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 hover:border-blue-500 text-left shadow-sm hover:shadow-md transition-all group flex flex-col sm:flex-row gap-4 cursor-pointer"
                  >
                    <div className="w-12 sm:w-14 h-12 sm:h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                      <Building size={26} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-base mb-1 group-hover:text-blue-600 transition-all">SO Per Gedung</h3>
                      <p className="text-xs text-slate-400 font-medium leading-relaxed">
                        Lakukan pemeriksaan berdasarkan 13 Gedung Master Lokasi SV IPB (Cilibende, Gunung Gede, Pajajaran, Baranangsiang, dll).
                      </p>
                    </div>
                  </button>

                  {/* Card 2: SO Per Ruangan */}
                  <button
                    onClick={() => {
                      setSelectedRoom(null);
                      setSelectedBuilding(null);
                      setWorkflowStep("ruangan_list");
                    }}
                    className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 hover:border-blue-500 text-left shadow-sm hover:shadow-md transition-all group flex flex-col sm:flex-row gap-4 cursor-pointer"
                  >
                    <div className="w-12 sm:w-14 h-12 sm:h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all shrink-0">
                      <Home size={26} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-base mb-1 group-hover:text-emerald-600 transition-all">SO Per Ruangan</h3>
                      <p className="text-xs text-slate-400 font-medium leading-relaxed">
                        Fokus pada 256 Ruangan Master terstruktur serta Bucket "Ruangan Lainnya" untuk aset tanpa lokasi.
                      </p>
                    </div>
                  </button>

                  {/* Card 3: SO Per Kategori */}
                  <button
                    onClick={() => {
                      setSelectedCategory(null);
                      setWorkflowStep("kategori_list");
                    }}
                    className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 hover:border-blue-500 text-left shadow-sm hover:shadow-md transition-all group flex flex-col sm:flex-row gap-4 cursor-pointer"
                  >
                    <div className="w-12 sm:w-14 h-12 sm:h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0">
                      <Layers size={26} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-base mb-1 group-hover:text-indigo-600 transition-all">SO Per Kategori</h3>
                      <p className="text-xs text-slate-400 font-medium leading-relaxed">
                        Filter aset berdasarkan kategori jenis barang (Peralatan & Mesin, Aset Tak Berwujud, Aset Tetap Lainnya, Alat Angkutan).
                      </p>
                    </div>
                  </button>

                  {/* Card 4: Scan Barcode / Cari ID */}
                  <button
                    onClick={() => {
                      setBarcodeSearchQ("");
                      setBarcodeMatchAsset(null);
                      setWorkflowStep("select_scope");
                      const el = document.getElementById("barcode-scanner-box");
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 hover:border-blue-500 text-left shadow-sm hover:shadow-md transition-all group flex flex-col sm:flex-row gap-4 cursor-pointer"
                  >
                    <div className="w-12 sm:w-14 h-12 sm:h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all shrink-0">
                      <QrCode size={26} />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-base mb-1 group-hover:text-amber-600 transition-all">Scan Barcode / Cari ID</h3>
                      <p className="text-xs text-slate-400 font-medium leading-relaxed">
                        Scan kode QR/barcode fisik aset di lapangan untuk langsung melompat ke form SO aset terkait secara instan.
                      </p>
                    </div>
                  </button>
                </div>

                {/* Inline Barcode Search Area */}
                <div id="barcode-scanner-box" className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                    <QrCode size={18} className="text-amber-500 shrink-0" /> SO Cepat via Scan Barcode
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-2 max-w-md">
                    <input
                      type="text"
                      placeholder="Masukkan Kode Aset / No Tag..."
                      value={barcodeSearchQ}
                      onChange={(e) => setBarcodeSearchQ(e.target.value)}
                      className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all font-medium"
                    />
                    <button
                      onClick={handleBarcodeSearch}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase px-5 py-2.5 rounded-xl transition-all cursor-pointer"
                    >
                      Cari
                    </button>
                  </div>

                  {barcodeMatchAsset && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in slide-in-from-top-2">
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-sm">{barcodeMatchAsset.Nama_Barang || barcodeMatchAsset.nama_barang}</h4>
                        <p className="text-[10px] font-bold text-slate-400 font-mono mt-0.5">{barcodeMatchAsset.kode_tag_aset || barcodeMatchAsset.id}</p>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <MapPin size={12} className="shrink-0 text-slate-400" />
                          <span>
                            {assetRoomMap.get(barcodeMatchAsset.id)?.namaGedung || barcodeMatchAsset.nama_gedung || barcodeMatchAsset.Gedung || "Lokasi belum diisi"}
                            {" · "}
                            {assetRoomMap.get(barcodeMatchAsset.id)?.namaRuangan || barcodeMatchAsset.Nama_ruangan || barcodeMatchAsset.nama_ruangan_standar || "-"}
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={() => startSession([barcodeMatchAsset], {})}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase px-4 py-2.5 rounded-lg transition-all cursor-pointer self-start sm:self-auto"
                      >
                        Mulai SO
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP: GEDUNG LIST (13 MASTER BUILDINGS - WITH IMMEDIATE ASSET COUNTS) */}
            {workflowStep === "gedung_list" && (
              <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setWorkflowStep("select_scope")}
                    className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition-all cursor-pointer"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">SO Per Gedung (13 Gedung Master)</h2>
                    <p className="text-xs text-slate-400 font-medium">Monitoring progres audit fisik per gedung induk Sekolah Vokasi IPB</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {masterBuildings.map((gedung) => {
                    const roomsInGedung = masterRooms.filter(r => r.namaGedung === gedung);
                    const assetsInGedung = getAssetsForBuilding(items, assetRoomMap, gedung);
                    const totalGedung = assetsInGedung.length;
                    const verifiedGedung = assetsInGedung.filter(i => i.isVerified).length;
                    const pctGedung = totalGedung ? Math.round((verifiedGedung / totalGedung) * 100) : 0;
                    const campusName = roomsInGedung[0]?.kampus || "Kampus SV IPB";

                    const colorClass = pctGedung < 30 ? "bg-rose-500" : pctGedung < 70 ? "bg-amber-500" : "bg-emerald-500";
                    const borderColorClass = pctGedung < 30 ? "border-rose-100 bg-rose-50/10" : pctGedung < 70 ? "border-amber-100 bg-amber-50/10" : "border-emerald-100 bg-emerald-50/10";

                    return (
                      <div
                        key={gedung}
                        className={`bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all ${borderColorClass}`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                              <Building size={12} className="shrink-0" /> Gedung Master
                            </span>
                            <span className="text-[10px] font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                              {roomsInGedung.length} Ruangan
                            </span>
                          </div>

                          {/* Prominent Asset Count Badge from Level 1 */}
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-extrabold text-slate-800 text-sm leading-snug line-clamp-2">{gedung}</h3>
                            <span className="shrink-0 px-2.5 py-1 bg-blue-100 text-blue-800 font-black text-xs rounded-lg shadow-xs">
                              {totalGedung.toLocaleString("id-ID")} Aset
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-400 font-bold mt-1">{campusName}</p>
                          <p className="text-xs text-slate-600 font-extrabold mt-3">{verifiedGedung.toLocaleString("id-ID")} / {totalGedung.toLocaleString("id-ID")} Aset Ter-SO</p>
                        </div>

                        <div className="mt-4 space-y-2">
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden shadow-inner">
                            <div className={`h-full ${colorClass} transition-all duration-500`} style={{ width: `${pctGedung}%` }} />
                          </div>
                          <div className="flex justify-between items-center pt-2">
                            <span className="text-xs font-black text-slate-700">{pctGedung}% Selesai</span>
                            <button
                              onClick={() => {
                                setSelectedBuilding(gedung);
                                setWorkflowStep("ruangan_list");
                              }}
                              className="text-blue-600 hover:text-blue-700 font-extrabold text-xs flex items-center gap-1 cursor-pointer"
                            >
                              Lihat Ruangan <ArrowRight size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP: RUANGAN LIST (256 MASTER ROOMS + TOP BUCKET "RUANGAN LAINNYA") */}
            {workflowStep === "ruangan_list" && (
              <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        if (selectedBuilding) {
                          setWorkflowStep("gedung_list");
                        } else {
                          setWorkflowStep("select_scope");
                        }
                      }}
                      className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition-all cursor-pointer"
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <div>
                      <h2 className="text-lg font-black text-slate-900">
                        {selectedBuilding ? `Ruangan di ${selectedBuilding}` : "SO Per Ruangan (256 Ruangan Master + Ruangan Lainnya)"}
                      </h2>
                      <p className="text-xs text-slate-400 font-medium">Pilih ruangan target pemeriksaan fisik aset</p>
                    </div>
                  </div>

                  {/* Search and Filters */}
                  <div className="flex items-center gap-2 self-stretch sm:self-auto">
                    <div className="relative flex-1 sm:w-64">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Cari nama/kode ruangan..."
                        value={roomFilterSearch}
                        onChange={(e) => setRoomFilterSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-medium"
                      />
                    </div>
                    {selectedBuilding && (
                      <button
                        onClick={() => setSelectedBuilding(null)}
                        className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Semua Gedung
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {(() => {
                    const displayMasterRooms = selectedBuilding
                      ? masterRooms.filter(r => r.namaGedung === selectedBuilding)
                      : masterRooms;

                    const filteredMasterRooms = displayMasterRooms.filter(r => {
                      if (!roomFilterSearch.trim()) return true;
                      const q = roomFilterSearch.toLowerCase();
                      return (
                        r.namaRuangan.toLowerCase().includes(q) ||
                        (r.kodeRuangan && r.kodeRuangan.toLowerCase().includes(q)) ||
                        r.namaGedung.toLowerCase().includes(q)
                      );
                    });

                    // Room cards data
                    const roomCards = filteredMasterRooms.map((r) => {
                      const assetsInRoom = getAssetsForRoom(items, assetRoomMap, r.id);
                      const obsInRoom = (store.observasiItems || []).filter(o => String(o.ruanganId) === String(r.id));
                      const totalBmn = assetsInRoom.length;
                      const totalObs = obsInRoom.length;
                      const totalRoom = totalBmn + totalObs;
                      const verifiedRoom = assetsInRoom.filter(i => i.isVerified).length;
                      const pctRoom = totalRoom ? Math.round((verifiedRoom / totalRoom) * 100) : 0;

                      return {
                        roomData: r,
                        total: totalRoom,
                        totalBmn,
                        obsCount: totalObs,
                        verified: verifiedRoom,
                        pct: pctRoom,
                        name: r.namaRuangan,
                        gedung: r.namaGedung,
                        kampus: r.kampus,
                        kode: r.kodeRuangan || `R-${r.id}`,
                        assets: assetsInRoom,
                        obsAssets: obsInRoom,
                        isVirtual: false,
                      };
                    });

                    // ⚠️ ENTRY KHUSUS PALING ATAS: BUCKET "RUANGAN LAINNYA" (Aset Tanpa Ruangan)
                    const showUnlinkedBucket = (!selectedBuilding || selectedBuilding === "Semua") && (
                      !roomFilterSearch.trim() ||
                      "ruangan lainnya".includes(roomFilterSearch.toLowerCase()) ||
                      "tanpa ruangan".includes(roomFilterSearch.toLowerCase()) ||
                      "belum ada lokasi".includes(roomFilterSearch.toLowerCase())
                    );

                    const unlinkedCard = showUnlinkedBucket ? {
                      roomData: null as any,
                      total: unlinkedAssets.length,
                      totalBmn: unlinkedAssets.length,
                      obsCount: 0,
                      verified: verifiedUnlinkedCount,
                      pct: pctUnlinked,
                      name: "Ruangan Lainnya",
                      subName: "Aset Tanpa Ruangan / Belum Ada Lokasi",
                      gedung: "Lokasi Master Belum Ditentukan",
                      kampus: "Semua Kampus",
                      kode: "UNLINKED",
                      assets: unlinkedAssets,
                      obsAssets: [],
                      isVirtual: true,
                    } : null;

                    // Combine cards: unlinkedCard ALWAYS at index 0 (top of the list)
                    const allCardsToRender = unlinkedCard ? [unlinkedCard, ...roomCards] : roomCards;

                    return allCardsToRender.map((card, idx) => {
                      const statusObj = getRoomSOStatus(card.roomData, card.assets, card.obsAssets);
                      const colorClass = statusObj.pct < 30 ? "bg-rose-500" : statusObj.pct < 70 ? "bg-amber-500" : "bg-emerald-500";
                      const cardStyle = card.isVirtual
                        ? "border-amber-300 bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-white shadow-md ring-2 ring-amber-400/30"
                        : "border-slate-200 bg-white shadow-sm";

                      return (
                        <div key={card.kode + idx} className={`p-4 sm:p-5 rounded-2xl border flex flex-col justify-between hover:shadow-md transition-all ${cardStyle}`}>
                          <div>
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${card.isVirtual
                                    ? 'bg-amber-500 text-white shadow-xs'
                                    : 'bg-blue-50 text-blue-700 border border-blue-100'
                                    }`}>
                                    {card.isVirtual ? "Aset Tanpa Ruangan" : card.kampus}
                                  </span>
                                  {!card.isVirtual && (
                                    <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                      {card.kode}
                                    </span>
                                  )}
                                  {/* Badge Status SO Ruangan */}
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${statusObj.badgeClass}`}>
                                    {statusObj.badgeLabel}
                                  </span>
                                </div>

                                <div className="flex items-start justify-between gap-2 mt-2">
                                  <h3 className={`font-extrabold text-sm line-clamp-2 ${card.isVirtual ? 'text-amber-950 font-black' : 'text-slate-800'}`}>
                                    {card.name}
                                  </h3>
                                  {/* Immediate Item Count Badge on Level 1 */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className={`text-xs font-black px-2 py-0.5 rounded-md ${card.isVirtual
                                      ? 'bg-amber-200/80 text-amber-900 border border-amber-300'
                                      : 'bg-blue-50 text-blue-700 border border-blue-100'
                                      }`}>
                                      {card.totalBmn.toLocaleString("id-ID")} BMN
                                    </span>
                                    {card.obsCount > 0 && (
                                      <span className="text-xs font-black px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                                        +{card.obsCount} Obs
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {card.isVirtual && (
                                  <p className="text-[11px] font-bold text-amber-800 mt-0.5">
                                    {card.subName}
                                  </p>
                                )}

                                <p className="text-[11px] text-slate-500 font-bold mt-1.5 flex items-center gap-1">
                                  <Building size={11} className="shrink-0 text-slate-400" />
                                  <span className="truncate">{card.gedung}</span>
                                </p>
                              </div>
                            </div>

                            <p className="text-xs text-slate-500 font-bold mt-3">
                              {statusObj.verified.toLocaleString("id-ID")} / {statusObj.total.toLocaleString("id-ID")} Aset Ter-SO
                            </p>
                          </div>

                          <div className="mt-4 space-y-3">
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-full ${colorClass} transition-all`} style={{ width: `${statusObj.pct}%` }} />
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                              {!card.isVirtual && statusObj.verified > 0 && statusObj.verified < statusObj.total && (
                                <button
                                  onClick={() => setIncompleteModalRoom({
                                    room: card.roomData,
                                    verified: statusObj.verified,
                                    total: statusObj.total,
                                    unverified: statusObj.total - statusObj.verified
                                  })}
                                  className="text-amber-700 hover:text-amber-900 font-extrabold text-[11px] flex items-center gap-1 cursor-pointer bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg border border-amber-200"
                                >
                                  <CheckSquare size={12} /> Tandai Selesai
                                </button>
                              )}
                              {!card.isVirtual && statusObj.verified === 0 && (
                                <button
                                  onClick={() => handleOpenMassVerify(card.name, card.assets)}
                                  disabled={card.assets.length === 0}
                                  className="text-emerald-600 hover:text-emerald-700 font-extrabold text-xs flex items-center gap-1 cursor-pointer disabled:opacity-40"
                                >
                                  Tandai Semua Baik
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (card.isVirtual) {
                                    startSession(card.assets, {
                                      room: card.name,
                                      building: card.gedung,
                                      isUnlinked: true
                                    });
                                  } else {
                                    startRoomSession(card.roomData);
                                  }
                                }}
                                disabled={card.total === 0}
                                className={`font-extrabold text-xs px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40 ml-auto ${card.isVirtual
                                  ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
                                  : statusObj.status === "Sedang Berjalan" || statusObj.status === "Selesai (Tidak Lengkap)"
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                                    : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                  }`}
                              >
                                {card.isVirtual ? (statusObj.verified > 0 ? "Lanjutkan SO & Assign" : "Mulai SO & Assign Lokasi") : statusObj.btnLabel} <ArrowRight size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* STEP: KATEGORI LIST */}
            {workflowStep === "kategori_list" && (
              <div className="space-y-5 sm:space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setWorkflowStep("select_scope")}
                    className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition-all cursor-pointer"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">SO Per Kategori Aset</h2>
                    <p className="text-xs text-slate-400 font-medium">Filter SO berdasarkan kelompok kategori aset utama</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {[
                    { key: "PM", title: "Peralatan & Mesin", bg: "bg-blue-50/50 hover:border-blue-500" },
                    { key: "ATB", title: "Aset Tak Berwujud", bg: "bg-purple-50/50 hover:border-purple-500" },
                    { key: "ATL", title: "Aset Tetap Lainnya", bg: "bg-indigo-50/50 hover:border-indigo-500" },
                    { key: "AL", title: "Alat Angkutan", bg: "bg-emerald-50/50 hover:border-emerald-500" }
                  ].map((cat) => {
                    const catAssets = items.filter(i => i.jenis_aset === cat.key || i.TipeAset === cat.key);
                    const totalCat = catAssets.length;
                    const verifiedCat = catAssets.filter(i => i.isVerified).length;
                    const pctCat = totalCat ? Math.round((verifiedCat / totalCat) * 100) : 0;

                    return (
                      <div
                        key={cat.key}
                        className={`bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all ${cat.bg}`}
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <h3 className="font-extrabold text-slate-800 text-base mb-1">{cat.title}</h3>
                            <span className="px-2.5 py-1 bg-blue-100 text-blue-800 font-black text-xs rounded-lg">
                              {totalCat.toLocaleString("id-ID")} Aset
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-bold mt-1">{verifiedCat.toLocaleString("id-ID")} / {totalCat.toLocaleString("id-ID")} Aset Ter-SO ({pctCat}%)</p>
                        </div>

                        <div className="mt-6 flex justify-between items-center border-t border-slate-100 pt-3">
                          <div className="w-2/3 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-blue-600 h-full transition-all" style={{ width: `${pctCat}%` }} />
                          </div>
                          <button
                            onClick={() => startSession(catAssets, { category: cat.title })}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer"
                          >
                            Pilih
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP: SESSION (ONE ASSET PER SCREEN - MOBILE FIRST + ASSIGN LOKASI) */}
            {workflowStep === "session" && sessionAssets.length > 0 && (
              <div className="w-full max-w-xl mx-auto space-y-5 sm:space-y-6 animate-in fade-in duration-200 px-1 sm:px-0">

                {/* Sub-navigation Pill-Tab Layer (Stock Opname | Daftar Aset) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    {/* Clear Back Button to return safely to room list */}
                    <button
                      type="button"
                      onClick={() => {
                        const activeAsset = sessionAssets[currentSessionIndex];
                        const draft = sessionDrafts[activeAsset?.id];
                        if (activeAsset && draft && (draft.kondisi || draft.lokasiSesuai !== null)) {
                          saveAssetVerification(activeAsset, draft);
                        }
                        setWorkflowStep("dashboard");
                        showToast("Kembali ke daftar ruangan");
                      }}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                      title="Kembali ke Daftar Ruangan"
                    >
                      <ArrowLeft size={14} /> Kembali
                    </button>

                    <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                      <button
                        type="button"
                        onClick={() => setActiveSubTab("Stock Opname")}
                        className={`px-3 sm:px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                          activeSubTab === "Stock Opname"
                            ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/60"
                            : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                        }`}
                      >
                        <ClipboardList size={14} className={activeSubTab === "Stock Opname" ? "text-blue-600" : "text-slate-400"} />
                        Stock Opname
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSubTab("Daftar Aset")}
                        className={`px-3 sm:px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                          activeSubTab === "Daftar Aset"
                            ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/60"
                            : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                        }`}
                      >
                        <Layers size={14} className={activeSubTab === "Daftar Aset" ? "text-blue-600" : "text-slate-400"} />
                        Daftar Aset
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {/* Keluar dari Sesi: Exits directly without dialog or extra save step */}
                    <button
                      type="button"
                      onClick={() => {
                        const activeAsset = sessionAssets[currentSessionIndex];
                        const draft = sessionDrafts[activeAsset?.id];
                        if (activeAsset && draft && (draft.kondisi || draft.lokasiSesuai !== null)) {
                          saveAssetVerification(activeAsset, draft);
                        }
                        setWorkflowStep("dashboard");
                        showToast("Keluar dari sesi SO");
                      }}
                      className="text-xs font-black text-slate-600 hover:text-rose-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
                      title="Keluar dari Sesi SO"
                    >
                      <LogOut size={14} /> Keluar dari Sesi
                    </button>
                  </div>
                </div>

                {/* SUB-VIEW 1: FORM VERIFIKASI PER ASET (STOCK OPNAME) */}
                {activeSubTab === "Stock Opname" && (
                  <div className="space-y-5 sm:space-y-6">
                    {/* Header status */}
                    {(() => {
                      const verifiedInSession = sessionAssets.filter(a => {
                        return a.isVerified || (sessionDrafts[a.id] && sessionDrafts[a.id].saved) || soRecordsThisYear.some(r => String(r.asset_id) === String(a.id));
                      }).length;
                      const sessionProgressPercent = sessionAssets.length > 0 ? Math.round((verifiedInSession / sessionAssets.length) * 100) : 0;
                      return (
                        <>
                          <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                            <span>
                              Progres SO: <strong className="text-blue-700">{verifiedInSession}/{sessionAssets.length} ({sessionProgressPercent}%)</strong>
                            </span>
                            <span className="bg-slate-100 text-slate-700 text-[11px] font-bold px-3 py-1 rounded-full border border-slate-200">
                              Aset {currentSessionIndex + 1} dari {sessionAssets.length}
                            </span>
                          </div>

                          {/* Progress bar inside session */}
                          <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden shadow-inner">
                            <div
                              className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                              style={{ width: `${sessionProgressPercent}%` }}
                            />
                          </div>
                        </>
                      );
                    })()}

                    {/* Active Asset Card */}
                {(() => {
                  const activeAsset = sessionAssets[currentSessionIndex];
                  const isObservasiAsset = !!(
                    (activeAsset as any)?.isObservasi === "true" ||
                    (activeAsset as any)?.isObservasi === true ||
                    String(activeAsset.id).startsWith("obs-") ||
                    String(activeAsset.id).startsWith("OBS-")
                  );

                  let matchedMasterRoom = assetRoomMap.get(activeAsset.id);
                  if (!matchedMasterRoom && isObservasiAsset) {
                    const obsRoomId = (activeAsset as any).Id_ruangan || (activeAsset as any).id_ruangan || (activeAsset as any).ruanganId;
                    matchedMasterRoom = masterRooms.find(r => String(r.id) === String(obsRoomId)) ||
                                        masterRooms.find(r => activeAsset.Nama_ruangan && r.namaRuangan.trim().toLowerCase() === activeAsset.Nama_ruangan.trim().toLowerCase()) ||
                                        (sessionTargetRoom || null);
                  }

                  const isInitiallyUnlinked = !isObservasiAsset && !matchedMasterRoom;

                  const existingDraft = sessionDrafts[activeAsset.id];
                  const draft = existingDraft || {
                    kondisi: "",
                    catatan: "",
                    lokasiSesuai: null,
                    lokasiBaru: "",
                    assignedRoomId: matchedMasterRoom?.id ? String(matchedMasterRoom.id) : "",
                    assignedRoomName: matchedMasterRoom?.namaRuangan || activeAsset.Nama_ruangan || "",
                    assignedGedung: matchedMasterRoom?.namaGedung || activeAsset.nama_gedung || activeAsset.Gedung || "",
                    assignedKodeRuangan: matchedMasterRoom?.kodeRuangan || activeAsset.kode_ruangan || ""
                  };

                  const hasAnswer = Boolean(
                    draft.kondisi ||
                    draft.lokasiSesuai !== null ||
                    draft.catatan ||
                    draft.photo ||
                    draft.saved ||
                    activeAsset.isVerified ||
                    soRecordsThisYear.some(r => String(r.asset_id) === String(activeAsset.id))
                  );

                  return (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden flex flex-col">

                      {/* Photo Placeholder / Photo Camera Input */}
                      <div className="bg-slate-100 h-44 sm:h-52 relative flex items-center justify-center border-b border-slate-200">
                        {draft.photo ? (
                          <div className="w-full h-full relative group">
                            <img src={draft.photo} alt="Preview" className="w-full h-full object-cover" />
                            <button
                              onClick={() => {
                                setSessionDrafts(prev => ({
                                  ...prev,
                                  [activeAsset.id]: { ...draft, photo: "" }
                                }));
                              }}
                              className="absolute top-2 right-2 p-2 bg-black/60 text-white rounded-full hover:bg-black/80 transition-all cursor-pointer"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <label className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-slate-200/50 transition-colors">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-md text-slate-400">
                              <Camera size={22} />
                            </div>
                            <span className="text-xs font-black text-slate-600">Ambil Foto Fisik Aset</span>
                            <span className="text-[10px] text-slate-400 font-bold">Kamera HP atau File</span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const url = URL.createObjectURL(file);
                                  setSessionDrafts(prev => ({
                                    ...prev,
                                    [activeAsset.id]: { ...draft, photo: url }
                                  }));
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>

                      {/* Info & Fields Panel */}
                      <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="bg-slate-100 text-slate-600 font-mono text-[9px] font-black px-2 py-0.5 rounded border border-slate-200">
                              {activeAsset.kode_tag_aset || activeAsset.id}
                            </span>
                            {isObservasiAsset ? (
                              <span className="bg-rose-100 text-rose-800 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-rose-200">
                                Observasi Ruangan
                              </span>
                            ) : isInitiallyUnlinked ? (
                              <span className="bg-amber-100 text-amber-900 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-amber-200">
                                Belum Ada Lokasi
                              </span>
                            ) : (
                              <span className="bg-blue-100 text-blue-800 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-blue-200">
                                Aset BMN
                              </span>
                            )}
                            {(activeAsset.isVerified || (sessionDrafts[activeAsset.id] && sessionDrafts[activeAsset.id].saved) || soRecordsThisYear.some(r => String(r.asset_id) === String(activeAsset.id))) && (
                              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                <Check size={10} /> Terverifikasi
                              </span>
                            )}
                          </div>
                          <h3 className="font-extrabold text-slate-800 text-base mt-2 leading-tight">
                            {activeAsset.Nama_Barang || activeAsset.nama_barang}
                          </h3>
                          <p className="text-xs text-slate-500 font-bold mt-1">
                            Gedung/Ruang: {matchedMasterRoom?.namaGedung || activeAsset.nama_gedung || activeAsset.Gedung || "Belum Ada Gedung"} / {matchedMasterRoom?.namaRuangan || activeAsset.Nama_ruangan || activeAsset.nama_ruangan_standar || "Belum Ada Lokasi"}
                          </p>

                          {/* Contextual Room Info Card for Auditor */}
                          {matchedMasterRoom && (() => {
                            const assetsInThisRoom = getAssetsForRoom(items, assetRoomMap, matchedMasterRoom.id);
                            const obsInThisRoom = (store.observasiItems || []).filter(o => String(o.ruanganId) === String(matchedMasterRoom.id));
                            return (
                              <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <Building size={13} className="text-[#014285] shrink-0" />
                                    <span className="text-xs font-bold text-slate-800 truncate">
                                      {matchedMasterRoom.namaGedung} · {matchedMasterRoom.namaRuangan}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0 text-[10px] font-bold">
                                    <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                                      {assetsInThisRoom.length} BMN
                                    </span>
                                    {obsInThisRoom.length > 0 && (
                                      <span className="bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded">
                                        +{obsInThisRoom.length} Obs
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <details className="text-xs text-slate-600 cursor-pointer group">
                                  <summary className="font-semibold text-[11px] text-[#014285] hover:underline flex items-center justify-between list-none">
                                    <span>Lihat Daftar Aset di Ruangan Ini ({assetsInThisRoom.length + obsInThisRoom.length} item)</span>
                                    <ChevronDown size={12} className="group-open:rotate-180 transition-transform text-slate-400" />
                                  </summary>
                                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto pr-1">
                                    {assetsInThisRoom.map(a => (
                                      <div key={a.id} className={`flex items-center gap-2 p-1.5 rounded-md text-[11px] ${a.id === activeAsset.id ? "bg-blue-100/70 font-bold text-blue-900 border border-blue-300" : "bg-white border border-slate-100"}`}>
                                        <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1 py-0.2 rounded shrink-0">BMN</span>
                                        <span className="font-mono text-slate-400 text-[10px] w-14 truncate">{a.kode_tag_aset || a.id}</span>
                                        <span className="flex-1 truncate">{a.Nama_Barang || a.nama_barang}</span>
                                        <span className="text-[10px] text-slate-400 shrink-0">{a.Kondisi || a.kondisi || "Baik"}</span>
                                      </div>
                                    ))}
                                    {obsInThisRoom.map((o, oi) => (
                                      <div key={o.id || oi} className="flex items-center gap-2 p-1.5 rounded-md text-[11px] bg-white border border-slate-100">
                                        <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-1 py-0.2 rounded shrink-0">Obs</span>
                                        <span className="font-mono text-rose-900 text-[10px] w-14 truncate">{o.nup ? `NUP ${o.nup}` : o.kodeBarang || "OBS"}</span>
                                        <span className="flex-1 truncate">{o.namaBarang}</span>
                                        <span className="text-[10px] text-rose-700 font-semibold shrink-0">{o.kondisi || "Baik"}</span>
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Condition Buttons */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-black text-slate-600 uppercase tracking-wider">Kondisi Fisik Aset</label>
                            {hasAnswer && (
                              <button
                                type="button"
                                onClick={() => handleResetAnswer(activeAsset)}
                                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 flex items-center gap-1 transition-colors cursor-pointer"
                                title="Kosongkan jawaban untuk aset ini"
                              >
                                <RotateCcw size={11} /> Hapus Jawaban
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                const nextDraft = { ...draft, kondisi: "Baik" };
                                setSessionDrafts(prev => ({
                                  ...prev,
                                  [activeAsset.id]: nextDraft
                                }));
                                if (nextDraft.lokasiSesuai !== null) {
                                  saveAssetVerification(activeAsset, nextDraft);
                                }
                              }}
                              className={`py-3 sm:py-3.5 px-4 rounded-xl border text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                draft.kondisi === "Baik"
                                  ? "bg-emerald-500 text-white border-emerald-500 shadow-md"
                                  : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300"
                              }`}
                            >
                              <CheckCircle2 size={16} /> Baik
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const nextDraft = { ...draft, kondisi: draft.kondisi && draft.kondisi.includes("Rusak") ? draft.kondisi : "Rusak Ringan" };
                                setSessionDrafts(prev => ({
                                  ...prev,
                                  [activeAsset.id]: nextDraft
                                }));
                                if (nextDraft.catatan.trim() && nextDraft.lokasiSesuai !== null) {
                                  saveAssetVerification(activeAsset, nextDraft);
                                }
                              }}
                              className={`py-3 sm:py-3.5 px-4 rounded-xl border text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                draft.kondisi && draft.kondisi.includes("Rusak")
                                  ? "bg-rose-500 text-white border-rose-500 shadow-md"
                                  : "bg-white text-slate-600 border-slate-200 hover:border-rose-300"
                              }`}
                            >
                              <AlertTriangle size={16} /> Rusak
                            </button>
                          </div>
                        </div>

                        {/* Sub-choices & mandatory notes for Damaged assets */}
                        {draft.kondisi.includes("Rusak") && (
                          <div className="space-y-3 bg-rose-50/50 p-4 rounded-xl border border-rose-100 animate-in fade-in duration-200">
                            <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1">Pilih Tingkat Kerusakan</label>
                              <div className="flex gap-2">
                                {["Rusak Ringan", "Rusak Berat"].map(lvl => (
                                  <button
                                    key={lvl}
                                    onClick={() => {
                                      setSessionDrafts(prev => ({
                                        ...prev,
                                        [activeAsset.id]: { ...draft, kondisi: lvl }
                                      }));
                                    }}
                                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase border transition-all cursor-pointer ${draft.kondisi === lvl
                                      ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                                      : "bg-white text-slate-500 border-slate-200 hover:border-rose-400"
                                      }`}
                                  >
                                    {lvl}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-slate-600 mb-1">Catatan Kerusakan <span className="text-rose-500">*</span></label>
                              <textarea
                                placeholder="Jelaskan jenis atau detail bagian kerusakan..."
                                value={draft.catatan}
                                onChange={(e) => {
                                  setSessionDrafts(prev => ({
                                    ...prev,
                                    [activeAsset.id]: { ...draft, catatan: e.target.value }
                                  }));
                                }}
                                className="w-full p-2.5 text-xs bg-white border border-rose-200 rounded-lg outline-none focus:border-rose-500 min-h-[50px] font-medium"
                              />
                            </div>
                          </div>
                        )}

                        {/* ==================== LOCATION & ASSIGN LOKASI ==================== */}
                        <div className="space-y-2">
                          {isObservasiAsset ? (
                            /* Observasi assets: already have room from Observasi Ruangan, show read-only info */
                            <>
                              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider">
                                Lokasi Aset (dari Observasi Ruangan)
                              </label>
                              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                                <div className="flex items-center gap-2">
                                  <Building size={14} className="text-rose-600 shrink-0" />
                                  <span className="text-xs font-bold text-rose-900">
                                    {matchedMasterRoom?.namaGedung || draft.assignedGedung || activeAsset.nama_gedung || activeAsset.Gedung || "—"}
                                    {" · "}
                                    {matchedMasterRoom?.namaRuangan || draft.assignedRoomName || activeAsset.Nama_ruangan || activeAsset.nama_ruangan_standar || "—"}
                                  </span>
                                </div>
                                <p className="text-[10px] text-rose-700 font-semibold">
                                  Lokasi otomatis dari data Observasi Ruangan. Tidak perlu assign ulang.
                                </p>
                              </div>

                              {/* Still allow location check (Sesuai/Berbeda) for observasi */}
                              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mt-3">
                                Cek Lokasi Aset (SO)
                              </label>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextDraft = {
                                      ...draft,
                                      lokasiSesuai: true,
                                      lokasiBaru: "",
                                      assignedRoomId: matchedMasterRoom?.id ? String(matchedMasterRoom.id) : draft.assignedRoomId,
                                      assignedRoomName: matchedMasterRoom?.namaRuangan || draft.assignedRoomName,
                                      assignedGedung: matchedMasterRoom?.namaGedung || draft.assignedGedung,
                                      assignedKodeRuangan: matchedMasterRoom?.kodeRuangan || draft.assignedKodeRuangan
                                    };
                                    setSessionDrafts(prev => ({
                                      ...prev,
                                      [activeAsset.id]: nextDraft
                                    }));
                                    if (nextDraft.kondisi && (!nextDraft.kondisi.includes("Rusak") || nextDraft.catatan.trim())) {
                                      saveAssetVerification(activeAsset, nextDraft);
                                    }
                                  }}
                                  className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                    draft.lokasiSesuai === true ? "bg-emerald-50 text-emerald-700 border-emerald-500 shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                  }`}
                                >
                                  {draft.lokasiSesuai === true && <Check size={14} />} Lokasi Sesuai
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextDraft = { ...draft, lokasiSesuai: false };
                                    setSessionDrafts(prev => ({
                                      ...prev,
                                      [activeAsset.id]: nextDraft
                                    }));
                                  }}
                                  className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                    draft.lokasiSesuai === false ? "bg-amber-50 text-amber-700 border-amber-500 shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                  }`}
                                >
                                  {draft.lokasiSesuai === false && <AlertTriangle size={14} />} Lokasi Berbeda
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider">
                                {isInitiallyUnlinked ? "Assign Lokasi Ruangan Master (Wajib)" : "Cek Lokasi Aset (SO)"}
                              </label>

                              {!isInitiallyUnlinked ? (
                                <>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextDraft = {
                                          ...draft,
                                          lokasiSesuai: true,
                                          lokasiBaru: "",
                                          assignedRoomId: matchedMasterRoom?.id ? String(matchedMasterRoom.id) : "",
                                          assignedRoomName: matchedMasterRoom?.namaRuangan || "",
                                          assignedGedung: matchedMasterRoom?.namaGedung || "",
                                          assignedKodeRuangan: matchedMasterRoom?.kodeRuangan || ""
                                        };
                                        setSessionDrafts(prev => ({
                                          ...prev,
                                          [activeAsset.id]: nextDraft
                                        }));
                                        if (nextDraft.kondisi && (!nextDraft.kondisi.includes("Rusak") || nextDraft.catatan.trim())) {
                                          saveAssetVerification(activeAsset, nextDraft);
                                        }
                                      }}
                                      className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                        draft.lokasiSesuai === true ? "bg-emerald-50 text-emerald-700 border-emerald-500 shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                      }`}
                                    >
                                      {draft.lokasiSesuai === true && <Check size={14} />} Lokasi Sesuai
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextDraft = { ...draft, lokasiSesuai: false };
                                        setSessionDrafts(prev => ({
                                          ...prev,
                                          [activeAsset.id]: nextDraft
                                        }));
                                      }}
                                      className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                                        draft.lokasiSesuai === false ? "bg-amber-50 text-amber-700 border-amber-500 shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                      }`}
                                    >
                                      {draft.lokasiSesuai === false && <AlertTriangle size={14} />} Lokasi Berbeda / Pindah
                                    </button>
                                  </div>

                                  {draft.lokasiSesuai === false && (
                                    <div className="pt-2 p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2 animate-in fade-in slide-in-from-top-2">
                                      <label className="block text-[10px] font-black text-amber-900 uppercase">
                                        Pilih Ruangan Master Baru (256 Ruangan Master) <span className="text-rose-500">*</span>
                                      </label>
                                      <select
                                        value={draft.assignedRoomId || ""}
                                        onChange={(e) => {
                                          const selId = e.target.value;
                                          const targetRoom = masterRooms.find(r => String(r.id) === selId || r.kodeRuangan === selId);
                                          if (targetRoom) {
                                            const nextDraft = {
                                              ...draft,
                                              lokasiSesuai: false,
                                              lokasiBaru: `${targetRoom.namaGedung} - ${targetRoom.namaRuangan}`,
                                              assignedRoomId: String(targetRoom.id),
                                              assignedRoomName: targetRoom.namaRuangan,
                                              assignedGedung: targetRoom.namaGedung,
                                              assignedKodeRuangan: targetRoom.kodeRuangan
                                            };
                                            setSessionDrafts(prev => ({
                                              ...prev,
                                              [activeAsset.id]: nextDraft
                                            }));
                                            if (nextDraft.kondisi && (!nextDraft.kondisi.includes("Rusak") || nextDraft.catatan.trim())) {
                                              saveAssetVerification(activeAsset, nextDraft);
                                            }
                                          }
                                        }}
                                        className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:border-blue-500 font-semibold text-slate-800 cursor-pointer shadow-xs"
                                      >
                                        <option value="">-- Pilih Ruangan Master Target --</option>
                                        {masterCampuses.map(campus => {
                                          const roomsInC = masterRooms.filter(r => r.kampus === campus || (campus.includes("Lainnya") && (r.kampus === "Kampus Lainnya" || r.kampus === "Kampus / Lokasi Lainnya")));
                                          if (roomsInC.length === 0) return null;
                                          return (
                                            <optgroup key={campus} label={campus}>
                                              {roomsInC.map(r => (
                                                <option key={r.kodeRuangan || r.id} value={String(r.id)}>
                                                  [{r.namaGedung}] {r.namaRuangan} ({r.kodeRuangan || `R-${r.id}`})
                                                </option>
                                              ))}
                                            </optgroup>
                                          );
                                        })}
                                      </select>
                                      {draft.assignedRoomName && (
                                        <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                                          ✓ Lokasi baru: <span className="underline">{draft.assignedGedung} — {draft.assignedRoomName}</span>
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </>
                              ) : (
                                /* Wajib Assign Lokasi untuk Aset Tanpa Ruangan (Bucket Ruangan Lainnya) */
                                <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2.5 animate-in fade-in">
                                  <p className="text-xs font-bold text-amber-900">
                                    Aset ini belum memiliki ruangan master. Petugas <strong>wajib menentukan ruangan</strong> untuk aset ini dari daftar Master Ruangan.
                                  </p>
                                  <select
                                    value={draft.assignedRoomId || ""}
                                    onChange={(e) => {
                                      const selId = e.target.value;
                                      const targetRoom = masterRooms.find(r => String(r.id) === selId || r.kodeRuangan === selId);
                                      if (targetRoom) {
                                        const nextDraft = {
                                          ...draft,
                                          lokasiSesuai: false,
                                          lokasiBaru: `${targetRoom.namaGedung} - ${targetRoom.namaRuangan}`,
                                          assignedRoomId: String(targetRoom.id),
                                          assignedRoomName: targetRoom.namaRuangan,
                                          assignedGedung: targetRoom.namaGedung,
                                          assignedKodeRuangan: targetRoom.kodeRuangan
                                        };
                                        setSessionDrafts(prev => ({
                                          ...prev,
                                          [activeAsset.id]: nextDraft
                                        }));
                                        if (nextDraft.kondisi && (!nextDraft.kondisi.includes("Rusak") || nextDraft.catatan.trim())) {
                                          saveAssetVerification(activeAsset, nextDraft);
                                        }
                                      }
                                    }}
                                    className="w-full p-2.5 text-xs bg-white border border-amber-300 rounded-lg outline-none focus:border-blue-500 font-semibold text-slate-800 cursor-pointer shadow-xs"
                                  >
                                    <option value="">-- Pilih Ruangan Master untuk Aset Ini --</option>
                                    {masterCampuses.map(campus => {
                                      const roomsInC = masterRooms.filter(r => r.kampus === campus || (campus.includes("Lainnya") && (r.kampus === "Kampus Lainnya" || r.kampus === "Kampus / Lokasi Lainnya")));
                                      if (roomsInC.length === 0) return null;
                                      return (
                                        <optgroup key={campus} label={campus}>
                                          {roomsInC.map(r => (
                                            <option key={r.kodeRuangan || r.id} value={String(r.id)}>
                                              [{r.namaGedung}] {r.namaRuangan} ({r.kodeRuangan || `R-${r.id}`})
                                            </option>
                                          ))}
                                        </optgroup>
                                      );
                                    })}
                                  </select>

                                  {draft.assignedRoomName ? (
                                    <p className="text-[11px] font-bold text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                                      ✓ Ditugaskan ke: <span className="underline">{draft.assignedGedung} — {draft.assignedRoomName}</span>
                                    </p>
                                  ) : (
                                    <p className="text-[10px] text-rose-600 font-bold">
                                      * Pilihan lokasi ruangan master diperlukan sebelum melanjutkan.
                                    </p>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>

                      </div>

                      {/* Footer Actions */}
                      <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="button"
                          disabled={currentSessionIndex === 0}
                          onClick={() => {
                            setCurrentSessionIndex(prev => Math.max(0, prev - 1));
                          }}
                          className="px-4 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-extrabold text-slate-500 flex items-center gap-1 transition-all disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                        >
                          <ArrowLeft size={14} /> Sebelumnya
                        </button>

                        {/* Single Tandai Selesai button in footer */}
                        <button
                          type="button"
                          onClick={() => {
                            const verifiedCount = sessionAssets.filter(a => a.isVerified || (sessionDrafts[a.id] && sessionDrafts[a.id].saved) || soRecordsThisYear.some(r => String(r.asset_id) === String(a.id))).length;
                            setIncompleteModalRoom({
                              room: sessionTargetRoom,
                              verified: verifiedCount,
                              total: sessionAssets.length,
                              unverified: sessionAssets.length - verifiedCount,
                            });
                          }}
                          className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                          title="Tandai Ruangan Selesai (Bisa untuk ruangan tidak lengkap)"
                        >
                          <CheckSquare size={14} className="text-amber-700" /> Tandai Selesai
                        </button>

                        {currentSessionIndex < sessionAssets.length - 1 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentSessionIndex(prev => prev + 1);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-6 py-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                          >
                            Lanjut <ArrowRight size={14} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setWorkflowStep("rekap");
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6 py-2.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                          >
                            Selesai & Rekap <Check size={14} />
                          </button>
                        )}
                      </div>

                    </div>
                  );
                })()}

                  </div>
                )}

                {/* SUB-VIEW 2: KONTEKSTUAL DAFTAR ASET RUANGAN (1 RUANGAN SAJA) */}
                {activeSubTab === "Daftar Aset" && (() => {
                  const activeAsset = sessionAssets[currentSessionIndex];
                  const isObsAsset = !!(
                    activeAsset &&
                    ((activeAsset as any).isObservasi === "true" ||
                      (activeAsset as any).isObservasi === true ||
                      String(activeAsset.id).startsWith("obs-") ||
                      String(activeAsset.id).startsWith("OBS-"))
                  );

                  let targetRoom: RuanganData | null = sessionTargetRoom;
                  if (!targetRoom && activeAsset) {
                    if (isObsAsset) {
                      const obsRoomId = (activeAsset as any).Id_ruangan || (activeAsset as any).id_ruangan || (activeAsset as any).ruanganId;
                      targetRoom = masterRooms.find(r => String(r.id) === String(obsRoomId)) ||
                                   masterRooms.find(r => activeAsset.Nama_ruangan && r.namaRuangan.trim().toLowerCase() === activeAsset.Nama_ruangan.trim().toLowerCase()) ||
                                   null;
                    } else {
                      targetRoom = assetRoomMap.get(activeAsset.id) ||
                                   masterRooms.find(r => activeAsset.Nama_ruangan && r.namaRuangan.trim().toLowerCase() === activeAsset.Nama_ruangan.trim().toLowerCase()) ||
                                   null;
                    }
                  }

                  let roomBmnItems: Asset[] = [];
                  let roomObsItems: any[] = [];

                  if (targetRoom) {
                    roomBmnItems = getAssetsForRoom(items, assetRoomMap, targetRoom.id);
                    roomObsItems = (store.observasiItems || []).filter(o => String(o.ruanganId) === String(targetRoom.id));
                  } else if (activeAsset?.Nama_ruangan && activeAsset.Nama_ruangan !== "Belum Ada Lokasi") {
                    const roomName = activeAsset.Nama_ruangan.trim().toLowerCase();
                    roomBmnItems = items.filter(i => (i.Nama_ruangan || i.nama_ruangan_standar || "").trim().toLowerCase() === roomName);
                    roomObsItems = (store.observasiItems || []).filter(o => (o.namaRuangan || "").trim().toLowerCase() === roomName);
                  } else {
                    roomBmnItems = sessionAssets.filter(a => !(a as any).isObservasi);
                    roomObsItems = sessionAssets.filter(a => !!(a as any).isObservasi);
                  }

                  const totalRoomItems = roomBmnItems.length + roomObsItems.length;

                  return (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-5 sm:p-6 animate-in fade-in duration-150">
                      {/* Room Info Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-[10px] font-black">
                              {targetRoom?.kodeRuangan || "RUANGAN"}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              {targetRoom?.namaGedung || "-"} · {targetRoom?.kampus || "SV IPB"}
                            </span>
                          </div>
                          <h3 className="text-base sm:text-lg font-black text-slate-900 mt-1">
                            {targetRoom?.namaRuangan || sessionScopeTitle || "Ruangan Sesi SO"}
                          </h3>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">
                            Daftar referensi seluruh barang yang tercatat dan terverifikasi di ruangan ini
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-black px-3 py-1.5 rounded-xl">
                            {roomBmnItems.length} BMN
                          </span>
                          {roomObsItems.length > 0 && (
                            <span className="bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black px-3 py-1.5 rounded-xl">
                              +{roomObsItems.length} Obs
                            </span>
                          )}
                          <span className="bg-slate-100 text-slate-700 text-xs font-black px-3 py-1.5 rounded-xl">
                            Total: {totalRoomItems} Barang
                          </span>
                        </div>
                      </div>

                      {/* Table of items for this specific room */}
                      {totalRoomItems === 0 ? (
                        <div className="py-12 text-center text-slate-400 space-y-2">
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                            <Layers size={22} />
                          </div>
                          <p className="text-sm font-extrabold text-slate-700">Belum ada data referensi aset untuk ruangan ini</p>
                          <p className="text-xs text-slate-400 max-w-sm mx-auto">
                            Ruangan ini belum memiliki data aset BMN maupun data hasil observasi lapangan.
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-xl border border-slate-100">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-slate-200 text-[10px] text-slate-400 font-black uppercase tracking-wider bg-slate-50">
                                <th className="px-3.5 py-2.5 w-10 text-center">No</th>
                                <th className="px-3.5 py-2.5">Nama Barang / Aset</th>
                                <th className="px-3.5 py-2.5">Kode / Tag</th>
                                <th className="px-3.5 py-2.5 text-center">Sumber Data</th>
                                <th className="px-3.5 py-2.5 text-center">Kondisi</th>
                                <th className="px-3.5 py-2.5 text-center">Status SO</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white font-medium">
                              {/* Render BMN Items */}
                              {roomBmnItems.map((item, idx) => {
                                const isCurrent = activeAsset?.id === item.id;
                                const isVerified = item.isVerified || !!sessionDrafts[item.id];
                                const draft = sessionDrafts[item.id];
                                const currentKondisi = draft?.kondisi || item.Kondisi || item.kondisi || "Baik";

                                return (
                                  <tr
                                    key={item.id}
                                    className={`transition-colors ${isCurrent ? "bg-blue-50/80 font-bold" : "hover:bg-slate-50"}`}
                                  >
                                    <td className="px-3.5 py-2.5 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                                    <td className="px-3.5 py-2.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-extrabold text-slate-800">{item.Nama_Barang || item.nama_barang}</span>
                                        {isCurrent && (
                                          <span className="text-[9px] bg-blue-600 text-white font-black px-1.5 py-0.5 rounded">
                                            Sedang Diperiksa
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-600">{item.kode_tag_aset || item.id}</td>
                                    <td className="px-3.5 py-2.5 text-center">
                                      <span className="inline-block bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-blue-200">
                                        BMN
                                      </span>
                                    </td>
                                    <td className="px-3.5 py-2.5 text-center">
                                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        currentKondisi === "Baik" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                      }`}>
                                        {currentKondisi}
                                      </span>
                                    </td>
                                    <td className="px-3.5 py-2.5 text-center">
                                      {isVerified ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                          <CheckCircle2 size={11} /> Terverifikasi
                                        </span>
                                      ) : (
                                        <span className="inline-block text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                          Belum SO
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}

                              {/* Render Observasi Items */}
                              {roomObsItems.map((obs, idx) => {
                                const obsId = obs.id;
                                const isCurrent = activeAsset?.id === obsId;
                                const isVerified = obs.statusSO === "Sudah SO" || !!sessionDrafts[obsId];
                                const draft = sessionDrafts[obsId];
                                const currentKondisi = draft?.kondisi || obs.kondisi || "Baik";

                                return (
                                  <tr
                                    key={obs.id}
                                    className={`transition-colors ${isCurrent ? "bg-rose-50/80 font-bold" : "hover:bg-slate-50"}`}
                                  >
                                    <td className="px-3.5 py-2.5 text-center text-slate-400 font-mono text-[11px]">{roomBmnItems.length + idx + 1}</td>
                                    <td className="px-3.5 py-2.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-extrabold text-slate-800">{obs.namaBarang}</span>
                                        {obs.merkModel && <span className="text-[10px] text-slate-400 font-medium">({obs.merkModel})</span>}
                                        {isCurrent && (
                                          <span className="text-[9px] bg-rose-600 text-white font-black px-1.5 py-0.5 rounded">
                                            Sedang Diperiksa
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-600">{obs.kodeBarang || obs.nup || "-"}</td>
                                    <td className="px-3.5 py-2.5 text-center">
                                      <span className="inline-block bg-rose-100 text-rose-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-rose-200">
                                        Observasi
                                      </span>
                                    </td>
                                    <td className="px-3.5 py-2.5 text-center">
                                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        currentKondisi === "Baik" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                      }`}>
                                        {currentKondisi}
                                      </span>
                                    </td>
                                    <td className="px-3.5 py-2.5 text-center">
                                      {isVerified ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                          <CheckCircle2 size={11} /> Terverifikasi
                                        </span>
                                      ) : (
                                        <span className="inline-block text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                          Belum SO
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })()}

              </div>
            )}

            {/* STEP: REKAP & FINAL SUBMIT */}
            {workflowStep === "rekap" && (
              <div className="w-full max-w-4xl mx-auto space-y-5 sm:space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setWorkflowStep("session")}
                    className="p-2 hover:bg-slate-200 rounded-lg text-slate-600 transition-all cursor-pointer"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Rekap Sesi SO</h2>
                    <p className="text-xs text-slate-400 font-medium">Tinjau seluruh data SO sebelum disimpan secara permanen ke database</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-xs font-black text-slate-600">Daftar Rekap Aset Sesi Ini</span>
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                      {Object.keys(sessionDrafts).length} Diperiksa
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-[50vh] overflow-y-auto">
                    {sessionAssets.map((asset) => {
                      const draft = sessionDrafts[asset.id];
                      return (
                        <div key={asset.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                          <div>
                            <span className="font-mono font-bold text-slate-400">{asset.kode_tag_aset || asset.id}</span>
                            <h4 className="font-extrabold text-slate-800 text-sm mt-0.5">{asset.Nama_Barang || asset.nama_barang}</h4>
                            <p className="text-[10px] text-slate-400 font-bold">Kondisi Awal: {asset.Kondisi || asset.kondisi || "Baik"}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {draft ? (
                              <>
                                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${draft.kondisi === "Baik" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                  }`}>
                                  {draft.kondisi}
                                </span>
                                {draft.assignedRoomName && (
                                  <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded text-[10px] font-black uppercase">
                                    Lokasi: {draft.assignedGedung} - {draft.assignedRoomName}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-[10px] font-bold">
                                Sesuai Default
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 p-5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex gap-3">
                    <CheckCircle2 className="text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-black text-blue-900 text-sm">Simpan Hasil SO</h4>
                      <p className="text-xs text-blue-700/80 mt-1 font-semibold leading-relaxed">
                        Data akan disimpan langsung ke database utama. Aset yang di-assign lokasi baru otomatis akan masuk ke ruangan master terkait.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 w-full md:w-auto">
                    <button
                      onClick={() => setWorkflowStep("session")}
                      className="flex-1 md:flex-initial px-4 py-2 bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
                    >
                      Koreksi Lagi
                    </button>
                    <button
                      onClick={() => {
                        let baikCount = 0;
                        let rusakCount = 0;

                        // 1. Process drafts
                        Object.entries(sessionDrafts).forEach(([id, payload]) => {
                          const hasNewRoom = !!payload.assignedRoomId;
                          if (payload.kondisi === "Baik") baikCount++;
                          else rusakCount++;

                          store.recordStockOpname(id, {
                            status_opname_terakhir: "Terverifikasi",
                            kondisi_fisik_opname_terakhir: payload.kondisi,
                            status_lokasi_opname_terakhir: payload.lokasiSesuai ? "Sesuai" : "Berbeda",
                            catatan_opname_terakhir: payload.catatan || "SO Lapangan",
                            Kondisi: payload.kondisi,
                            kondisi: payload.kondisi,
                            ...(hasNewRoom ? {
                              Id_ruangan: payload.assignedRoomId,
                              id_ruangan: payload.assignedRoomId,
                              Nama_ruangan: payload.assignedRoomName,
                              nama_ruangan_standar: payload.assignedRoomName,
                              Gedung: payload.assignedGedung,
                              nama_gedung: payload.assignedGedung,
                              kode_ruangan: payload.assignedKodeRuangan
                            } : {})
                          }, { skipLog: true });
                        });

                        // 2. Process remaining assets in session that used default status
                        sessionAssets.forEach((asset) => {
                          if (!sessionDrafts[asset.id]) {
                            const k = asset.Kondisi || asset.kondisi || "Baik";
                            if (k === "Baik") baikCount++;
                            else rusakCount++;

                            store.recordStockOpname(asset.id, {
                              status_opname_terakhir: "Terverifikasi",
                              kondisi_fisik_opname_terakhir: k,
                              status_lokasi_opname_terakhir: "Sesuai",
                              catatan_opname_terakhir: "SO Lapangan (Sesuai)",
                              Kondisi: k,
                              kondisi: k,
                            }, { skipLog: true });
                          }
                        });

                        const totalVerified = sessionAssets.length;
                        const roomDesc = sessionTargetRoom
                          ? `${sessionTargetRoom.namaRuangan} (${sessionTargetRoom.namaGedung}${sessionTargetRoom.kampus ? `, ${sessionTargetRoom.kampus}` : ""})`
                          : sessionScopeTitle || "Sesi SO";
                        const assignedPetugas = sessionTargetRoom?.namaGedung && assignments[sessionTargetRoom.namaGedung]
                          ? ` [Petugas: ${assignments[sessionTargetRoom.namaGedung]}]`
                          : "";

                        // 3. Log complete SO session to Menu Aktivitas
                        store.appendActivity({
                          pengguna: store.currentUser.nama,
                          role: store.currentUser.role,
                          menu: "Opname",
                          aksi: `SO selesai — ${roomDesc}, ${totalVerified} aset (${baikCount} Baik, ${rusakCount} Rusak)${assignedPetugas}`,
                          target_type: "Ruangan",
                          target_id: sessionTargetRoom?.id || "SESSION",
                          status: "Berhasil",
                          jenis: "opname",
                        });

                        alert("Sesi SO berhasil disimpan permanen. Data master lokasi telah diperbarui.");
                        setWorkflowStep("dashboard");
                        setActiveSubTab("Stock Opname");
                      }}
                      className="flex-1 md:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2 rounded-xl transition-all shadow-md cursor-pointer"
                    >
                      Simpan & Kunci Data SO
                    </button>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

        {/* ==================== TAB 2: RUANGAN LIST (256 MASTER ROOMS) ==================== */}
        {activeTab === "Ruangan" && (
          <div className="w-full mx-auto space-y-5 sm:space-y-6">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-800 mb-1">Pemeriksaan & Progres Ruangan Master (256 Ruangan)</h2>
                <p className="text-xs text-slate-400 font-medium">Validasi status SO aset secara berkala pada masing-masing ruangan master kampus</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedBuilding || "Semua"}
                  onChange={(e) => setSelectedBuilding(e.target.value === "Semua" ? null : e.target.value)}
                  className="px-3 py-2 text-xs border border-slate-200 rounded-xl outline-none font-bold text-slate-700 bg-white shadow-sm w-full sm:w-auto cursor-pointer"
                >
                  <option value="Semua">Semua Gedung ({masterBuildings.length})</option>
                  {masterBuildings.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {(selectedBuilding ? masterRooms.filter(r => r.namaGedung === selectedBuilding) : masterRooms).map((r) => {
                const assetsInRoom = getAssetsForRoom(items, assetRoomMap, r.id);
                const obsInRoom = (store.observasiItems || []).filter(o => String(o.ruanganId) === String(r.id));
                const statusObj = getRoomSOStatus(r, assetsInRoom, obsInRoom);
                const colorClass = statusObj.pct < 30 ? 'bg-rose-500' : statusObj.pct < 70 ? 'bg-amber-500' : 'bg-emerald-500';

                return (
                  <div key={r.kodeRuangan || r.id} className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">{r.kodeRuangan || `R-${r.id}`}</span>
                        <span className="text-blue-600 font-semibold">{r.kampus}</span>
                      </div>

                      <div className="flex items-start justify-between gap-2 mt-1">
                        <h3 className="font-extrabold text-slate-800 text-sm line-clamp-1">{r.namaRuangan}</h3>
                        <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full ${statusObj.badgeClass}`}>
                          {statusObj.badgeLabel}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-400 font-bold mt-0.5 flex items-center gap-1">
                        <Building size={11} className="shrink-0" />
                        <span className="truncate">{r.namaGedung}</span>
                      </p>

                      <div className="flex items-center justify-between text-xs mt-3 mb-1 font-semibold text-slate-600">
                        <span>{statusObj.pct}% Selesai</span>
                        <span>{statusObj.verified.toLocaleString("id-ID")}/{statusObj.total.toLocaleString("id-ID")} Aset</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-1.5 rounded-full transition-all ${colorClass}`} style={{ width: `${statusObj.pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== TAB 3: PERPINDAHAN HISTORY ==================== */}
        {activeTab === "Perpindahan" && (
          <div className="w-full mx-auto space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black text-slate-800">Histori Perpindahan Lokasi Terdeteksi (SO {selectedYear})</h2>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">Daftar aset yang berpindah ruangan atau berbeda dari data master awal</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] text-slate-400 font-black uppercase tracking-wider bg-white">
                      <th className="px-6 py-4">Aset</th>
                      <th className="px-6 py-4">Status Lokasi</th>
                      <th className="px-6 py-4">Catatan / Lokasi Baru</th>
                      <th className="px-6 py-4">Petugas SO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {soRecordsThisYear.filter(r => r.status_lokasi === "Berbeda").length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-16 text-center text-xs font-bold text-slate-400">
                          Belum ada aset yang terdeteksi berpindah lokasi.
                        </td>
                      </tr>
                    ) : soRecordsThisYear.filter(r => r.status_lokasi === "Berbeda").map(r => {
                      const ast = store.assets.find(a => a.id === r.asset_id);
                      return (
                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="text-sm font-extrabold text-slate-800">{ast?.Nama_Barang || ast?.nama_barang || "Unknown"}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{r.kode_tag}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-black uppercase px-2.5 py-1 rounded-full">
                              <ArrowRightLeft size={10} /> Berbeda
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold text-slate-600">{r.catatan || "-"}</td>
                          <td className="px-6 py-4">
                            <p className="text-xs font-bold text-slate-800">{r.diverifikasi_oleh}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{r.tanggal}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 4: LAPORAN HASIL STOCK OPNAME ==================== */}
        {activeTab === "Laporan" && (
          <div className="w-full mx-auto space-y-6 animate-in fade-in duration-200">
            {/* Header & Export Action */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0 shadow-sm">
                  <FileText size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-black text-slate-900">
                      Laporan Hasil Audit Stock Opname
                    </h2>
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-blue-200">
                      Tahun {selectedYear}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed max-w-3xl">
                    Rekapitulasi seluruh aset yang <strong>Sudah</strong> dan <strong>Belum di-SO</strong> pada tahun audit {selectedYear}, lengkap dengan pembeda jelas antara <strong>Data Resmi BMN</strong> dan <strong>Observasi Lapangan</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
                <button
                  onClick={handleExportReportExcel}
                  disabled={isExportingReport || filteredReportRows.length === 0}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                >
                  {isExportingReport ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Membuat Excel...</span>
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      <span>Export Excel ({filteredReportRows.length.toLocaleString("id-ID")} Aset)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Top Summary Cards (4 Cards Grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Akumulasi Global Target */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Total Target SO</span>
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <Layers size={16} />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-900">{reportStats.totalTarget.toLocaleString("id-ID")}</span>
                    <span className="text-xs font-bold text-blue-600">({reportStats.progressPct}% Ter-SO)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                    {reportStats.sudahSO.toLocaleString("id-ID")} Ter-SO • {reportStats.belumSO.toLocaleString("id-ID")} Belum
                  </p>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex shadow-inner">
                  <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${reportStats.progressPct}%` }} title={`Ter-SO: ${reportStats.progressPct}%`} />
                  <div className="bg-slate-300 h-full transition-all duration-500 flex-1" title={`Belum: ${100 - reportStats.progressPct}%`} />
                </div>
              </div>

              {/* Card 2: Kondisi Fisik Ter-SO */}
              <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Kondisi Hasil SO</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 size={16} />
                  </div>
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-emerald-600">{reportStats.baikCount.toLocaleString("id-ID")}</span>
                    <span className="text-xs font-bold text-slate-400">Baik ({reportStats.sudahSO ? Math.round((reportStats.baikCount / reportStats.sudahSO) * 100) : 0}%)</span>
                  </div>
                  <p className="text-[11px] text-rose-600 font-bold mt-0.5">
                    {reportStats.rusakCount.toLocaleString("id-ID")} Aset Rusak ({reportStats.sudahSO ? Math.round((reportStats.rusakCount / reportStats.sudahSO) * 100) : 0}%)
                  </p>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex shadow-inner">
                  <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${reportStats.sudahSO ? (reportStats.baikCount / reportStats.sudahSO) * 100 : 0}%` }} />
                  <div className="bg-rose-500 h-full transition-all duration-500" style={{ width: `${reportStats.sudahSO ? (reportStats.rusakCount / reportStats.sudahSO) * 100 : 0}%` }} />
                </div>
              </div>

              {/* Card 3: Breakdown Aset Terdaftar (BMN Resmi) */}
              <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/40 p-4 sm:p-5 rounded-2xl border border-blue-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-600 text-white shadow-xs">BMN</span>
                    <span className="text-xs font-extrabold text-blue-900">Resmi Terdaftar</span>
                  </div>
                  <span className="text-xs font-black text-blue-700">{reportStats.bmn.pct}%</span>
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-slate-900">{reportStats.bmn.sudah.toLocaleString("id-ID")}</span>
                    <span className="text-xs font-bold text-slate-500">/ {reportStats.bmn.total.toLocaleString("id-ID")} Aset</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mt-1">
                    <span className="text-emerald-700 font-bold">{reportStats.bmn.baik} Baik</span>
                    <span className="text-rose-700 font-bold">{reportStats.bmn.rusak} Rusak</span>
                    <span className="text-slate-500">{reportStats.bmn.belum} Belum</span>
                  </div>
                </div>
                <div className="w-full bg-blue-200/60 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-blue-600 h-full transition-all duration-500" style={{ width: `${reportStats.bmn.pct}%` }} />
                </div>
              </div>

              {/* Card 4: Breakdown Aset Observasi Ruangan */}
              <div className="bg-gradient-to-br from-rose-50/70 to-amber-50/40 p-4 sm:p-5 rounded-2xl border border-rose-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-xs">Observasi</span>
                    <span className="text-xs font-extrabold text-rose-900">Temuan Lapangan</span>
                  </div>
                  <span className="text-xs font-black text-rose-700">{reportStats.obs.pct}%</span>
                </div>
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-black text-slate-900">{reportStats.obs.sudah.toLocaleString("id-ID")}</span>
                    <span className="text-xs font-bold text-slate-500">/ {reportStats.obs.total.toLocaleString("id-ID")} Aset</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 mt-1">
                    <span className="text-emerald-700 font-bold">{reportStats.obs.baik} Baik</span>
                    <span className="text-rose-700 font-bold">{reportStats.obs.rusak} Rusak</span>
                    <span className="text-slate-500">{reportStats.obs.belum} Belum</span>
                  </div>
                </div>
                <div className="w-full bg-rose-200/60 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-rose-600 h-full transition-all duration-500" style={{ width: `${reportStats.obs.pct}%` }} />
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Filter size={16} className="text-blue-600" />
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">Filter & Pencarian Laporan</h3>
                  {activeReportFilterCount > 0 && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-black rounded-full">
                      {activeReportFilterCount} Filter Aktif
                    </span>
                  )}
                </div>

                {activeReportFilterCount > 0 && (
                  <button
                    onClick={handleResetReportFilters}
                    className="text-xs font-bold text-rose-600 hover:text-rose-800 self-start sm:self-auto hover:underline cursor-pointer"
                  >
                    Reset Semua Filter
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                {/* Search Input */}
                <div className="relative sm:col-span-2 lg:col-span-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={reportSearchRaw}
                    onChange={(e) => setReportSearchRaw(e.target.value)}
                    placeholder="Cari Nama, Kode, NUP, PIC..."
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white text-xs font-medium text-slate-800"
                  />
                  {reportSearchRaw && (
                    <button
                      onClick={() => setReportSearchRaw("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Filter Sumber Data */}
                <div>
                  <select
                    value={reportFilterSumber}
                    onChange={(e) => setReportFilterSumber(e.target.value as any)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-slate-700 cursor-pointer"
                  >
                    <option value="Semua">Semua Sumber Data</option>
                    <option value="BMN">BMN (Data Aset Resmi)</option>
                    <option value="Observasi">Observasi (Temuan Lapangan)</option>
                  </select>
                </div>

                {/* Filter Status SO */}
                <div>
                  <select
                    value={reportFilterStatusSO}
                    onChange={(e) => setReportFilterStatusSO(e.target.value as any)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-slate-700 cursor-pointer"
                  >
                    <option value="Semua">Semua Status SO</option>
                    <option value="Sudah di-SO">Sudah di-SO ({reportStats.sudahSO})</option>
                    <option value="Belum di-SO">Belum di-SO ({reportStats.belumSO})</option>
                  </select>
                </div>

                {/* Filter Kondisi */}
                <div>
                  <select
                    value={reportFilterKondisi}
                    onChange={(e) => setReportFilterKondisi(e.target.value as any)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-slate-700 cursor-pointer"
                  >
                    <option value="Semua">Semua Kondisi Fisik</option>
                    <option value="Baik">Kondisi Baik</option>
                    <option value="Rusak Ringan">Kondisi Rusak Ringan</option>
                    <option value="Rusak Berat">Kondisi Rusak Berat</option>
                  </select>
                </div>

                {/* Filter Kampus */}
                <div>
                  <select
                    value={reportFilterCampus}
                    onChange={(e) => handleReportCampusChange(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-slate-700 cursor-pointer"
                  >
                    <option value="Semua">Semua Kampus</option>
                    {masterCampuses.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Filter Gedung */}
                <div>
                  <select
                    value={reportFilterGedung}
                    onChange={(e) => handleReportGedungChange(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-slate-700 cursor-pointer"
                  >
                    {reportGedungOptions.map((g) => (
                      <option key={g} value={g}>{g === "Semua" ? "Semua Gedung" : g}</option>
                    ))}
                  </select>
                </div>

                {/* Filter Ruangan */}
                <div>
                  <select
                    value={reportFilterRuangan}
                    onChange={(e) => setReportFilterRuangan(e.target.value)}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-blue-500 font-semibold text-slate-700 cursor-pointer"
                  >
                    {reportRuanganOptions.map((r) => (
                      <option key={r} value={r}>{r === "Semua" ? "Semua Ruangan" : r}</option>
                    ))}
                  </select>
                </div>

                {/* Page size selector */}
                <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] font-bold text-slate-500">Tampilkan / Hal:</span>
                  <select
                    value={reportPageSize}
                    onChange={(e) => {
                      setReportPageSize(Number(e.target.value));
                      setReportPage(1);
                    }}
                    className="bg-transparent font-black text-blue-600 outline-none cursor-pointer"
                  >
                    <option value={25}>25 baris</option>
                    <option value={50}>50 baris</option>
                    <option value={100}>100 baris</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              {/* Table Info Bar */}
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-xs font-semibold text-slate-600 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span>
                    Menampilkan <strong>{filteredReportRows.length > 0 ? (safeReportPage - 1) * reportPageSize + 1 : 0}</strong> - <strong>{Math.min(safeReportPage * reportPageSize, filteredReportRows.length)}</strong> dari <strong>{filteredReportRows.length.toLocaleString("id-ID")}</strong> aset
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-bold">
                  <span className="flex items-center gap-1.5 text-blue-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
                    BMN: {filteredReportRows.filter(r => r.sumberData === "BMN").length.toLocaleString("id-ID")}
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block"></span>
                    Observasi: {filteredReportRows.filter(r => r.sumberData === "Observasi").length.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              {/* Table Data */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] text-slate-400 font-black uppercase tracking-wider bg-white">
                      <th className="px-4 py-3.5 text-center w-12">No</th>
                      <th className="px-4 py-3.5">Sumber Data</th>
                      <th className="px-4 py-3.5">Kode & NUP</th>
                      <th className="px-4 py-3.5">Nama Barang</th>
                      <th className="px-4 py-3.5">Lokasi Master</th>
                      <th className="px-4 py-3.5 text-center">Status SO</th>
                      <th className="px-4 py-3.5 text-center">Kondisi</th>
                      <th className="px-4 py-3.5 text-center">Cek Lokasi</th>
                      <th className="px-4 py-3.5">Petugas & Tanggal</th>
                      <th className="px-4 py-3.5">Catatan SO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {pagedReportRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-16 text-center">
                          <ClipboardList size={36} className="text-slate-300 mx-auto mb-2" />
                          <p className="text-xs font-bold text-slate-500">Tidak ada aset yang sesuai dengan filter.</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Silakan sesuaikan filter atau reset kata kunci pencarian.</p>
                        </td>
                      </tr>
                    ) : (
                      pagedReportRows.map((row, idx) => {
                        const globalIndex = (safeReportPage - 1) * reportPageSize + idx + 1;
                        const isBmn = row.sumberData === "BMN";

                        return (
                          <tr key={row.sourceKey} className="hover:bg-slate-50/80 transition-colors">
                            {/* No */}
                            <td className="px-4 py-3 text-center font-mono text-[11px] text-slate-400 font-bold">
                              {globalIndex}
                            </td>

                            {/* Sumber Data */}
                            <td className="px-4 py-3">
                              {isBmn ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                                  BMN
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                  Observasi
                                </span>
                              )}
                            </td>

                            {/* Kode & NUP */}
                            <td className="px-4 py-3">
                              <p className="font-mono font-bold text-slate-800 text-[11px]">{row.kodeBarang}</p>
                              {row.nup !== "-" && (
                                <p className="text-[10px] font-mono text-slate-400">NUP: {row.nup}</p>
                              )}
                            </td>

                            {/* Nama Barang */}
                            <td className="px-4 py-3">
                              <p className="font-extrabold text-slate-900 line-clamp-2 max-w-xs" title={row.namaBarang}>
                                {row.namaBarang}
                              </p>
                            </td>

                            {/* Lokasi */}
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-800 text-xs truncate max-w-[200px]" title={row.namaRuangan}>
                                {row.namaRuangan}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate flex items-center gap-1 mt-0.5">
                                <Building size={10} className="shrink-0" />
                                <span>{row.namaGedung} • {row.kampus}</span>
                              </p>
                            </td>

                            {/* Status SO */}
                            <td className="px-4 py-3 text-center">
                              {row.isVerified ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Check size={11} /> Sudah di-SO
                                </span>
                              ) : row.statusSOText ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-900 border border-amber-300">
                                  <AlertTriangle size={11} /> {row.statusSOText}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                  Belum di-SO
                                </span>
                              )}
                            </td>

                            {/* Kondisi */}
                            <td className="px-4 py-3 text-center">
                              {row.isVerified ? (
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                  row.kondisi === "Baik" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                }`}>
                                  {row.kondisi}
                                </span>
                              ) : (
                                <span className="text-slate-300 font-mono">-</span>
                              )}
                            </td>

                            {/* Cek Lokasi */}
                            <td className="px-4 py-3 text-center">
                              {row.isVerified ? (
                                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                  row.lokasiSesuai === "Berbeda"
                                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                                    : "bg-slate-100 text-slate-600"
                                }`}>
                                  {row.lokasiSesuai}
                                </span>
                              ) : (
                                <span className="text-slate-300 font-mono">-</span>
                              )}
                            </td>

                            {/* Tanggal & Petugas */}
                            <td className="px-4 py-3">
                              {row.isVerified ? (
                                <div>
                                  <p className="font-bold text-slate-800">{row.petugasSO}</p>
                                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{row.tglSO}</p>
                                </div>
                              ) : (
                                <span className="text-slate-300 font-mono">-</span>
                              )}
                            </td>

                            {/* Catatan SO */}
                            <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={row.catatanSO}>
                              {row.catatanSO}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-500 font-medium">
                  Halaman <strong>{safeReportPage}</strong> dari <strong>{totalReportPages}</strong> (Total <strong>{filteredReportRows.length.toLocaleString("id-ID")}</strong> aset)
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setReportPage(1)}
                    disabled={safeReportPage <= 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition-colors"
                    title="Halaman Pertama"
                  >
                    <ChevronsLeft size={16} />
                  </button>
                  <button
                    onClick={() => setReportPage(prev => Math.max(1, prev - 1))}
                    disabled={safeReportPage <= 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition-colors"
                    title="Sebelumnya"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {/* Page number buttons */}
                  {(() => {
                    const pages: number[] = [];
                    const start = Math.max(1, safeReportPage - 2);
                    const end = Math.min(totalReportPages, safeReportPage + 2);
                    for (let p = start; p <= end; p++) pages.push(p);

                    return pages.map(p => (
                      <button
                        key={p}
                        onClick={() => setReportPage(p)}
                        className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          p === safeReportPage
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {p}
                      </button>
                    ));
                  })()}

                  <button
                    onClick={() => setReportPage(prev => Math.min(totalReportPages, prev + 1))}
                    disabled={safeReportPage >= totalReportPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition-colors"
                    title="Berikutnya"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button
                    onClick={() => setReportPage(totalReportPages)}
                    disabled={safeReportPage >= totalReportPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white cursor-pointer transition-colors"
                    title="Halaman Terakhir"
                  >
                    <ChevronsRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 5: PENGATURAN / PENUGASAN ==================== */}
        {activeTab === "Pengaturan" && (
          <div className="w-full mx-auto space-y-6">
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                  <Users size={20} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-800">Penugasan Petugas SO per Gedung Master ({masterBuildings.length} Gedung)</h2>
                  <p className="text-xs text-slate-400 font-medium">Tunjuk petugas penanggung jawab Stock Opname untuk tiap lokasi gedung kampus</p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                {masterBuildings.map(g => {
                  const assetsInGedungCount = getAssetsForBuilding(items, assetRoomMap, g).length;

                  return (
                    <div key={g} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl gap-3">
                      <div>
                        <p className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                          <Building size={14} className="text-blue-600 shrink-0" />
                          {g}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5 ml-5">Total Aset Terhubung: {assetsInGedungCount.toLocaleString("id-ID")} Aset</p>
                      </div>
                      <select
                        value={assignments[g] || ""}
                        onChange={(e) => setAssignments(prev => ({ ...prev, [g]: e.target.value }))}
                        className="px-3 py-2 text-xs border border-slate-200 rounded-lg outline-none w-full sm:w-48 font-semibold text-slate-700 bg-white cursor-pointer"
                      >
                        <option value="">-- Belum Ditugaskan --</option>
                        <option value="Petugas 1">Petugas 1</option>
                        <option value="Petugas 2">Petugas 2</option>
                        <option value="Petugas 3">Petugas 3</option>
                        <option value="Admin SO">Admin SO</option>
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ==================== MODAL: TANDAI SEMUA BAIK (QUICK SO ACTION) ==================== */}
      {massVerifyRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-950 text-base">Tandai Semua Baik (SO Cepat)</h3>
                <p className="text-[11px] text-slate-400 font-medium">SO cepat untuk seluruh aset di ruangan</p>
              </div>
              <button
                onClick={() => setMassVerifyRoom(null)}
                className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl">
                <p className="text-xs font-semibold text-emerald-800">
                  Anda akan menandai semua aset di ruangan <span className="font-black underline">{massVerifyRoom}</span> sebagai <span className="font-black uppercase">Baik</span>.
                </p>
              </div>

              {/* Exclusion checklist */}
              <div className="space-y-2">
                <label className="block text-xs font-black text-slate-600 uppercase tracking-wider">Kecualikan Aset Tertentu</label>
                <p className="text-[10px] text-slate-400 mb-2">Hilangkan centang jika aset tersebut sedang rusak/tidak di tempat</p>
                <div className="space-y-2 border border-slate-100 rounded-xl p-3 max-h-40 overflow-y-auto divide-y divide-slate-100">
                  {massVerifyAssets.map((asset) => {
                    const isChecked = !massExcludedIds.has(asset.id);
                    return (
                      <label key={asset.id} className="flex items-start gap-3 py-2 cursor-pointer text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setMassExcludedIds(prev => {
                              const copy = new Set(prev);
                              if (copy.has(asset.id)) {
                                copy.delete(asset.id);
                              } else {
                                copy.add(asset.id);
                              }
                              return copy;
                            });
                          }}
                          className="mt-0.5 rounded border-slate-200 focus:ring-emerald-500 h-4 w-4 text-emerald-600 cursor-pointer"
                        />
                        <div>
                          <p className="font-extrabold text-slate-800">{asset.Nama_Barang || asset.nama_barang}</p>
                          <p className="text-[9px] text-slate-400 font-mono font-bold">{asset.id}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Proof Photo Upload */}
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-black text-slate-600 uppercase tracking-wider">Foto Bukti Fisik Ruangan <span className="text-rose-500">* Wajib</span></label>
                {massProofPhoto ? (
                  <div className="relative w-full h-32 rounded-xl overflow-hidden border border-slate-200">
                    <img src={massProofPhoto} alt="Bukti massal" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setMassProofPhoto("")}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition-all cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="border border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors hover:bg-slate-50">
                    <Camera size={20} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-600">Unggah Foto Ruangan</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setMassProofPhoto(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => setMassVerifyRoom(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-extrabold text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                disabled={!massProofPhoto}
                onClick={handleConfirmMassVerify}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase text-white shadow-sm transition-all ${massProofPhoto ? "bg-emerald-600 hover:bg-emerald-700 cursor-pointer" : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
              >
                Simpan Massal SO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL KONFIRMASI SELESAI (TIDAK LENGKAP) ==================== */}
      {incompleteModalRoom && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden space-y-4 p-6 animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Tandai Ruangan Selesai (Tidak Lengkap)</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    {incompleteModalRoom.room?.namaRuangan || "Ruangan Sesi SO"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIncompleteModalRoom(null)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between font-bold text-amber-900">
                <span>Ringkasan Verifikasi:</span>
                <span>{incompleteModalRoom.verified} dari {incompleteModalRoom.total} Aset Terverifikasi</span>
              </div>
              <div className="flex justify-between text-amber-800">
                <span>Belum Terverifikasi / Belum Ditemukan:</span>
                <span className="font-extrabold text-rose-700">{incompleteModalRoom.unverified} Aset</span>
              </div>
              <p className="text-[11px] text-amber-700 font-medium pt-1 border-t border-amber-200/80">
                Aset yang belum diverifikasi tidak dianggap rusak atau hilang, melainkan ditandai <em>"Belum Terverifikasi (ruangan ditutup tidak lengkap)"</em>. Ruangan dapat dibuka kembali kapan saja lewat tombol Lanjutkan SO.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Catatan / Alasan Penutupan Ruangan <span className="text-slate-400 font-normal">(opsional)</span>:
              </label>
              <textarea
                rows={3}
                placeholder="Contoh: 4 aset tidak ditemukan di ruangan saat pemeriksaan fisik..."
                value={incompleteCatatan}
                onChange={(e) => setIncompleteCatatan(e.target.value)}
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-medium text-slate-800"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIncompleteModalRoom(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmIncompleteClosure}
                className="px-4 py-2 text-xs font-black text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <CheckSquare size={14} /> Tandai Selesai (Tidak Lengkap)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== FLOATING TOAST NOTIFICATION ==================== */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2.5 text-xs font-bold animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

    </div>
  );
}
