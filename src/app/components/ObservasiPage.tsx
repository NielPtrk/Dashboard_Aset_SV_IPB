import React, { useState, useMemo, useEffect, useRef } from "react";
import { useDataStore, type ObservasiItem, type RuanganData } from "./DataStore";
import { SEED_RUANGAN } from "./ruanganSeed";
import { exportToExcel, importFromExcel, exportDBRExcel, importExcelMatrix } from "./excelUtils";
import {
  ClipboardList, Search, Download, Upload, Plus, Trash2, Save,
  CheckCircle2, AlertCircle, Building, MapPin, Calendar, Copy,
  Check, ArrowRight, RefreshCw, Filter, Layers, FileSpreadsheet,
  Info, Eye, Sparkles, X, ChevronRight, ChevronDown
} from "lucide-react";

const SUMBER_DANA_OPTIONS = [
  "DM",
  "DMKS",
  "BPPTN-NOP",
  "BPIF",
  "HIBAH",
  "BPPTN-OP",
  "PNBP",
  "Tidak Diketahui",
];

const KONDISI_OPTIONS = ["Baik", "Rusak Ringan", "Rusak Berat"];

const SATUAN_OPTIONS = ["unit", "buah", "set", "paket", "lembar", "lusin", "unit/box"];

const PENGUASAAN_OPTIONS = ["Milik Sendiri", "Pinjam", "Sewa", "Hak Pakai", "Lainnya"];

const YEAR_OPTIONS = [2026, 2025, 2024, 2023, 2022];

type ObservasiTableRow = {
  id?: string;
  tempId: string;
  noUrut: number;
  kodeBarang: string;
  namaBarang: string;
  nup: string;
  merekType: string;
  tahunPerolehan: string;
  hargaSatuan: number | string;
  volume: number | string;
  satuan: string;
  jumlahHarga: number;
  sumberDana: string;
  kondisi: string;
  penguasaan: string;
  keterangan: string;
};

export function ObservasiPage({ topBar }: { topBar?: React.ReactNode }) {
  const store = useDataStore();
  const currentYear = new Date().getFullYear();

  // Role permissions
  const userRole = store.currentUser?.role;
  const isPekerjaSO = userRole === "Pekerja Stock Opname";
  const isPimpinan = userRole === "Pimpinan";
  const canDelete = !isPekerjaSO && !isPimpinan;
  const canEdit = !isPimpinan;

  // State: filters & selection
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedKampus, setSelectedKampus] = useState<string>("Semua");
  const [selectedGedung, setSelectedGedung] = useState<string>("Semua");
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");

  // Tab View: "Form Observasi" | "Monitoring Progres"
  const [activeView, setActiveView] = useState<"form" | "monitoring">("form");

  // Form rows state
  const [rows, setRows] = useState<ObservasiTableRow[]>([]);
  const [isSaved, setIsSaved] = useState<boolean>(true);
  const [saveLoading, setSaveLoading] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Monitoring search & filters
  const [monSearch, setMonSearch] = useState<string>("");
  const [monStatusFilter, setMonStatusFilter] = useState<"Semua" | "Sudah" | "Belum">("Semua");
  const [monKampusFilter, setMonKampusFilter] = useState<string>("Semua");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Master rooms list (256 canonical master rooms)
  const masterRooms: RuanganData[] = useMemo(() => {
    return store.ruangan && store.ruangan.length > 0 ? store.ruangan : SEED_RUANGAN;
  }, [store.ruangan]);

  // Kampus list
  const kampusList = useMemo(() => {
    const set = new Set(masterRooms.map((r) => r.kampus).filter(Boolean));
    return Array.from(set).sort();
  }, [masterRooms]);

  // Gedung list (filtered by selected Kampus)
  const gedungList = useMemo(() => {
    const filtered = selectedKampus === "Semua" ? masterRooms : masterRooms.filter((r) => r.kampus === selectedKampus);
    const set = new Set(filtered.map((r) => r.namaGedung).filter(Boolean));
    return Array.from(set).sort();
  }, [masterRooms, selectedKampus]);

  // Ruangan list (filtered by selected Kampus & Gedung)
  const ruanganList = useMemo(() => {
    return masterRooms.filter((r) => {
      const matchKampus = selectedKampus === "Semua" || r.kampus === selectedKampus;
      const matchGedung = selectedGedung === "Semua" || r.namaGedung === selectedGedung;
      return matchKampus && matchGedung;
    });
  }, [masterRooms, selectedKampus, selectedGedung]);

  // Currently selected room object
  const selectedRoom = useMemo(() => {
    if (!selectedRoomId) return null;
    return masterRooms.find((r) => String(r.id) === String(selectedRoomId)) || null;
  }, [masterRooms, selectedRoomId]);

  // Automatically select first room if none selected and filtered list is available
  useEffect(() => {
    if (ruanganList.length > 0 && (!selectedRoomId || !ruanganList.some((r) => String(r.id) === String(selectedRoomId)))) {
      setSelectedRoomId(String(ruanganList[0].id));
    }
  }, [ruanganList, selectedRoomId]);

  // Load existing observation data when selected room or year changes
  useEffect(() => {
    if (!selectedRoomId) {
      setRows([]);
      setIsSaved(true);
      return;
    }

    const existing = store.getObservasiForRoom(selectedRoomId, selectedYear);
    if (existing && existing.length > 0) {
      const mapped: ObservasiTableRow[] = existing.map((it, idx) => ({
        id: it.id,
        tempId: it.id || `row-${idx}-${Date.now()}`,
        noUrut: it.noUrut || idx + 1,
        kodeBarang: it.kodeBarang || "",
        namaBarang: it.namaBarang || "",
        nup: it.nup || "",
        merekType: it.merekType || "",
        tahunPerolehan: it.tahunPerolehan || "",
        hargaSatuan: it.hargaSatuan || 0,
        volume: it.volume || 1,
        satuan: it.satuan || "unit",
        jumlahHarga: (Number(it.hargaSatuan) || 0) * (Number(it.volume) || 1),
        sumberDana: it.sumberDana || "Tidak Diketahui",
        kondisi: it.kondisi || "Baik",
        penguasaan: it.penguasaan || "Milik Sendiri",
        keterangan: it.keterangan || "",
      }));
      setRows(mapped);
      setIsSaved(true);
    } else {
      // Empty table initially
      setRows([]);
      setIsSaved(true);
    }
  }, [selectedRoomId, selectedYear, store.observasiItems]);

  // Quick summary of observation status for selected year
  const summary = useMemo(() => {
    return store.getObservasiSummary(selectedYear);
  }, [store, selectedYear]);

  // Upload Excel modal states
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<"replace" | "append">(isPekerjaSO ? "append" : "replace");

  useEffect(() => {
    if (isPekerjaSO) {
      setImportMode("append");
    }
  }, [isPekerjaSO]);

  const [parsedPreviewRows, setParsedPreviewRows] = useState<ObservasiTableRow[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Helper to show transient feedback messages
  const showFeedback = (text: string, type: "success" | "error" | "info" = "success") => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // ── Download Template Excel (DBR Reference Format) ───────────────────────────
  const handleDownloadTemplate = () => {
    const cleanRoom = (selectedRoom?.namaRuangan || "Ruangan").replace(/[/\\?%*:|"<>]/g, "_");
    const filename = `Template_Observasi_Ruangan_${cleanRoom}_${selectedYear}`;

    exportDBRExcel(
      {
        year: selectedYear,
        unitKerja: "Sekolah Vokasi",
        departemen: "",
        kodeRuang: selectedRoom?.kodeRuangan || "",
        namaRuang: selectedRoom?.namaRuangan || "Ruang Kelas",
      },
      [
        {
          no: 1,
          kodeBarang: "3.05.01.05.001",
          namaBarang: "Kursi Kuliah Chitose",
          nup: "0001",
          merekType: "Chitose Cosmo",
          tahunPerolehan: String(selectedYear),
          hargaSatuan: 450000,
          volume: 30,
          satuan: "unit",
          jumlahHarga: 13500000,
          sumberDana: "DM",
          kondisi: "Baik",
          penguasaan: "Milik Sendiri",
          keterangan: "Kondisi terawat baik di ruangan",
        },
        {
          no: 2,
          kodeBarang: "3.05.02.01.002",
          namaBarang: "Proyektor Epson",
          nup: "0002",
          merekType: "Epson EB-X51",
          tahunPerolehan: String(selectedYear),
          hargaSatuan: 6500000,
          volume: 1,
          satuan: "unit",
          jumlahHarga: 6500000,
          sumberDana: "BPIF",
          kondisi: "Baik",
          penguasaan: "Milik Sendiri",
          keterangan: "Terpasang di plafon",
        },
      ],
      filename,
      "Sheet 1"
    );
    showFeedback("Template Excel format resmi (DBR) berhasil diunduh!", "success");
  };

  // ── Process Excel Matrix / Data (DBR Format & Flat Header Tolerant) ───────────
  const processExcelMatrixOrData = (matrix: any[][]): ObservasiTableRow[] => {
    const cleanKey = (k: any) =>
      String(k || "")
        .toLowerCase()
        .replace(/[\s\r\n_\-./()]/g, "");

    const cleanNumber = (val: any): number | null => {
      if (val === null || val === undefined || val === "") return null;
      if (typeof val === "number") return isNaN(val) ? null : val;
      const str = String(val).trim();
      if (str === "") return null;
      let normalized = str.replace(/[^0-9.,-]/g, "");
      if (normalized.includes(".") && normalized.includes(",")) {
        normalized = normalized.replace(/\./g, "").replace(",", ".");
      } else if (normalized.includes(".") && !normalized.includes(",")) {
        const parts = normalized.split(".");
        if (parts.length > 1 && parts[parts.length - 1].length === 3) {
          normalized = normalized.replace(/\./g, "");
        }
      } else if (normalized.includes(",") && !normalized.includes(".")) {
        const parts = normalized.split(",");
        if (parts.length > 1 && parts[parts.length - 1].length === 3) {
          normalized = normalized.replace(/,/g, "");
        } else {
          normalized = normalized.replace(",", ".");
        }
      }
      const num = parseFloat(normalized);
      return isNaN(num) ? null : num;
    };

    const isSignatureRow = (row: any[]): boolean => {
      const text = row.map((c) => String(c || "").toLowerCase()).join(" ");
      const sigKeywords = [
        "kepala bagian",
        "tata usaha",
        "penanggungjawab",
        "penanggung jawab",
        "nip.",
        "nip ",
        "mengetahui",
        ".....",
        "dekan",
        "wakil dekan",
        "tanda tangan",
        "pembantu pengelola",
      ];
      return sigKeywords.some((kw) => text.includes(kw));
    };

    const isCheckmark = (val: any): boolean => {
      if (val === null || val === undefined) return false;
      if (typeof val === "boolean") return val;
      const str = String(val).trim().toLowerCase();
      return (
        ["✓", "v", "x", "1", "true", "ya", "y", "ok", "v "].includes(str) ||
        (str.length > 0 && str !== "0" && str !== "false" && str !== "tidak")
      );
    };

    const results: ObservasiTableRow[] = [];
    if (!Array.isArray(matrix) || matrix.length === 0) return results;

    // 1. Detect Header Row
    let headerRowIdx = -1;
    for (let r = 0; r < Math.min(matrix.length, 30); r++) {
      const row = matrix[r] || [];
      const rowText = row.map((c: any) => String(c || "").toLowerCase()).join(" ");
      if (
        rowText.includes("nama barang") ||
        rowText.includes("kode barang") ||
        rowText.includes("identitas barang") ||
        (rowText.includes("kode") && rowText.includes("nup"))
      ) {
        headerRowIdx = r;
        break;
      }
    }

    if (headerRowIdx >= 0) {
      // DBR multi-row header format detected
      let dataStartRow = headerRowIdx + 1;
      if (headerRowIdx + 1 < matrix.length) {
        const subRow = matrix[headerRowIdx + 1] || [];
        const subText = subRow.map((c: any) => String(c || "").toLowerCase()).join(" ");
        if (
          subText.includes("merek") ||
          subText.includes("tahun") ||
          subText.includes("rr") ||
          subText.includes("rb") ||
          subText.includes("b")
        ) {
          dataStartRow = headerRowIdx + 2;
        }
      }

      // Dynamic column mapping based on headers (with fallback to default DBR indices)
      let colNo = 0,
        colKode = 1,
        colNama = 2,
        colNup = 3;
      let colMerek = 4,
        colTahun = 5,
        colHarga = 6,
        colVol = 7;
      let colSatuan = 8,
        colJml = 9,
        colSumber = 10;
      let colB = 11,
        colRR = 12,
        colRB = 13,
        colPenguasaan = 14,
        colKet = 15;

      const h1 = matrix[headerRowIdx] || [];
      const h2 = headerRowIdx + 1 < matrix.length ? matrix[headerRowIdx + 1] : [];
      const maxCols = Math.max(h1.length, h2.length);

      for (let c = 0; c < maxCols; c++) {
        const k1 = cleanKey(h1[c]);
        const k2 = cleanKey(h2[c]);
        const combined = `${k1} ${k2}`.trim();

        if (combined.includes("kodebarang") || combined.includes("kodeaset")) colKode = c;
        else if (combined.includes("namabarang") || combined.includes("deskripsi")) colNama = c;
        else if (combined.includes("nup")) colNup = c;
        else if (combined.includes("merek") || combined.includes("type") || combined.includes("tipe")) colMerek = c;
        else if (combined.includes("tahun")) colTahun = c;
        else if (combined.includes("hargasatuan") || (combined.includes("harga") && !combined.includes("jumlah"))) colHarga = c;
        else if (combined.includes("vol") || combined.includes("volume") || combined.includes("qty")) colVol = c;
        else if (combined.includes("satuan") && !combined.includes("hargasatuan")) colSatuan = c;
        else if (combined.includes("jumlahharga") || combined.includes("totalharga")) colJml = c;
        else if (combined.includes("sumberdana") || combined.includes("dana")) colSumber = c;
        else if (k2 === "b" || combined.includes("kondisib") || combined === "b") colB = c;
        else if (k2 === "rr" || combined.includes("rusakringan") || combined === "rr") colRR = c;
        else if (k2 === "rb" || combined.includes("rusakberat") || combined === "rb") colRB = c;
        else if (combined.includes("penguasaan") || combined.includes("kepemilikan")) colPenguasaan = c;
        else if (combined.includes("keterangan") || combined.includes("ket") || combined.includes("namaruangan")) colKet = c;
      }

      for (let r = dataStartRow; r < matrix.length; r++) {
        const row = matrix[r] || [];
        if (isSignatureRow(row)) continue;

        const rawKode = String(row[colKode] || "").trim();
        const rawNama = String(row[colNama] || "").trim();
        const rawNup = String(row[colNup] || "").trim();
        const rawMerek = String(row[colMerek] || "").trim();
        const rawTahun = String(row[colTahun] || "").trim();
        const rawHarga = row[colHarga];
        const rawVol = row[colVol];
        const rawSatuan = String(row[colSatuan] || "").trim();
        const rawJml = row[colJml];
        const rawSumber = String(row[colSumber] || "").trim();
        const rawB = row[colB];
        const rawRR = row[colRR];
        const rawRB = row[colRB];
        const rawPenguasaan = String(row[colPenguasaan] || "").trim();
        const rawKet = String(row[colKet] || "").trim();

        // Skip completely empty rows
        const hasContent = Boolean(
          rawNama || rawKode || rawMerek || rawNup || rawVol || rawHarga || rawKet || rawSumber
        );
        if (!hasContent) continue;

        const hargaNum = cleanNumber(rawHarga);
        const volNum = cleanNumber(rawVol);
        const finalHarga = hargaNum !== null ? hargaNum : (rawHarga ? String(rawHarga).trim() : "");
        const finalVol = volNum !== null ? volNum : (rawVol ? String(rawVol).trim() : "");

        let finalJumlah: number = 0;
        const jmlNum = cleanNumber(rawJml);
        if (jmlNum !== null && jmlNum > 0) {
          finalJumlah = jmlNum;
        } else if (typeof finalHarga === "number" && typeof finalVol === "number") {
          finalJumlah = finalHarga * finalVol;
        }

        let kondisi = "Baik";
        if (isCheckmark(rawRB)) {
          kondisi = "Rusak Berat";
        } else if (isCheckmark(rawRR)) {
          kondisi = "Rusak Ringan";
        } else if (isCheckmark(rawB)) {
          kondisi = "Baik";
        }

        const idx = results.length;
        results.push({
          tempId: `imp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          noUrut: idx + 1,
          kodeBarang: rawKode,
          namaBarang: rawNama,
          nup: rawNup,
          merekType: rawMerek,
          tahunPerolehan: rawTahun,
          hargaSatuan: finalHarga,
          volume: finalVol,
          satuan: rawSatuan,
          jumlahHarga: finalJumlah,
          sumberDana: rawSumber,
          kondisi,
          penguasaan: rawPenguasaan,
          keterangan: rawKet,
        });
      }
    } else {
      // Fallback: flat row array / json table
      const headerRow = matrix[0] || [];
      for (let r = 1; r < matrix.length; r++) {
        const row = matrix[r] || [];
        if (isSignatureRow(row)) continue;

        const lookup: Record<string, any> = {};
        headerRow.forEach((h: any, colIdx: number) => {
          lookup[cleanKey(h)] = row[colIdx];
        });

        const getVal = (aliases: string[]): string => {
          for (const alias of aliases) {
            const normAlias = cleanKey(alias);
            if (lookup[normAlias] !== undefined && lookup[normAlias] !== null) {
              const v = String(lookup[normAlias]).trim();
              if (v !== "") return v;
            }
          }
          return "";
        };

        const rawKode = getVal(["kode barang", "kode_barang", "kodebarang", "kode", "kode aset"]);
        const rawNama = getVal(["nama barang", "nama_barang", "namabarang", "nama", "deskripsi barang", "deskripsi", "barang", "item"]);
        const rawNup = getVal(["nup", "no nup", "no. nup", "nonup"]);
        const rawMerek = getVal(["merek / type", "merek/type", "merek type", "merek", "type", "tipe", "merk"]);
        const rawTahun = getVal(["tahun perolehan", "tahun_perolehan", "tahun", "tahun beli"]);
        const rawHarga = getVal(["harga satuan (rp)", "harga satuan", "harga", "harga_satuan"]);
        const rawVol = getVal(["vol", "volume", "qty", "jumlah"]);
        const rawSatuan = getVal(["satuan", "unit"]);
        const rawSumberDana = getVal(["sumber dana", "sumber_dana", "asal dana"]);
        const rawKondisi = getVal(["kondisi barang", "kondisi", "status kondisi"]);
        const rawPenguasaan = getVal(["penguasaan", "status penguasaan", "kepemilikan"]);
        const rawKet = getVal(["keterangan", "ket", "catatan"]);

        const hasContent = Boolean(
          rawKode || rawNama || rawNup || rawMerek || rawTahun || rawHarga || rawVol || rawSatuan || rawSumberDana || rawKondisi || rawKet
        );
        if (!hasContent) continue;

        const hargaNum = cleanNumber(rawHarga);
        const volNum = cleanNumber(rawVol);
        const finalHarga = hargaNum !== null ? hargaNum : (rawHarga ? rawHarga : "");
        const finalVol = volNum !== null ? volNum : (rawVol ? rawVol : "");

        let finalJumlah = 0;
        if (hargaNum !== null && volNum !== null) {
          finalJumlah = hargaNum * volNum;
        }

        let finalKondisi = rawKondisi || "Baik";
        const kLower = rawKondisi.toLowerCase();
        if (kLower.includes("rusak berat") || kLower === "rb") {
          finalKondisi = "Rusak Berat";
        } else if (kLower.includes("rusak ringan") || kLower === "rr") {
          finalKondisi = "Rusak Ringan";
        } else if (kLower.includes("baik") || kLower === "b") {
          finalKondisi = "Baik";
        }

        const idx = results.length;
        results.push({
          tempId: `imp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          noUrut: idx + 1,
          kodeBarang: rawKode,
          namaBarang: rawNama,
          nup: rawNup,
          merekType: rawMerek,
          tahunPerolehan: rawTahun,
          hargaSatuan: finalHarga,
          volume: finalVol,
          satuan: rawSatuan,
          jumlahHarga: finalJumlah,
          sumberDana: rawSumberDana,
          kondisi: finalKondisi,
          penguasaan: rawPenguasaan,
          keterangan: rawKet,
        });
      }
    }

    return results;
  };

  const handleFileUpload = async (file: File) => {
    try {
      const { matrix } = await importExcelMatrix(file);
      if (!Array.isArray(matrix) || matrix.length === 0) {
        showFeedback("File Excel kosong atau tidak memiliki baris data.", "error");
        return;
      }

      const imported = processExcelMatrixOrData(matrix);
      if (imported.length === 0) {
        showFeedback("Tidak ada baris data barang yang ditemukan dalam file Excel.", "error");
        return;
      }

      setParsedPreviewRows(imported);
      setUploadedFileName(file.name);
      setIsUploadModalOpen(true);
      showFeedback(`File "${file.name}" berhasil dibaca: ${imported.length} baris barang siap diterapkan.`, "info");
    } catch (err: any) {
      showFeedback(err?.message || "Gagal membaca file Excel. Pastikan format file .xlsx atau .xls valid.", "error");
    }
  };

  const handleApplyImportedRows = async () => {
    if (parsedPreviewRows.length === 0) return;
    if (!selectedRoom) {
      showFeedback("Silakan pilih ruangan terlebih dahulu.", "error");
      return;
    }

    const importedCount = parsedPreviewRows.length;
    let finalRows: ObservasiTableRow[] = [];

    if (!isPekerjaSO && importMode === "replace") {
      finalRows = parsedPreviewRows.map((r, i) => ({ ...r, noUrut: i + 1 }));
    } else {
      const startIdx = rows.length;
      finalRows = [...rows, ...parsedPreviewRows.map((r, i) => ({ ...r, noUrut: startIdx + i + 1 }))];
    }

    // 1. Immediately update table state so UI reflects it right away
    setRows(finalRows);
    setIsSaved(true);
    setIsUploadModalOpen(false);

    // 2. Persist to DataStore / database for the selected room & year
    const payloadItems = finalRows.map((r, i) => {
      const harga = typeof r.hargaSatuan === "number" ? r.hargaSatuan : Number(r.hargaSatuan) || 0;
      const vol = typeof r.volume === "number" ? r.volume : Number(r.volume) || (r.volume === "" ? 0 : 1);
      const jml = typeof r.jumlahHarga === "number" ? r.jumlahHarga : Number(r.jumlahHarga) || (harga * vol);
      return {
        noUrut: i + 1,
        kodeBarang: String(r.kodeBarang || "").trim(),
        namaBarang: String(r.namaBarang || "").trim(),
        nup: String(r.nup || "").trim(),
        merekType: String(r.merekType || "").trim(),
        tahunPerolehan: String(r.tahunPerolehan || "").trim(),
        hargaSatuan: harga,
        volume: vol,
        satuan: String(r.satuan || "").trim(),
        jumlahHarga: jml,
        sumberDana: String(r.sumberDana || "").trim(),
        kondisi: String(r.kondisi || "Baik").trim(),
        penguasaan: String(r.penguasaan || "").trim(),
        keterangan: String(r.keterangan || "").trim(),
      };
    });

    try {
      await store.saveRoomObservasi(selectedRoom.id, selectedYear, {
        kampus: selectedRoom.kampus,
        namaGedung: selectedRoom.namaGedung,
        kodeRuangan: selectedRoom.kodeRuangan || "",
        namaRuangan: selectedRoom.namaRuangan,
        unitKerja: "Sekolah Vokasi (SV)",
        petugas: store.currentUser?.nama || "Staff",
        items: payloadItems,
        isUpload: true,
      });
    } catch (err) {
      console.warn("Save room observasi warning:", err);
    }

    showFeedback(`${importedCount} baris berhasil ditambahkan ke ruangan ini.`, "success");
    setParsedPreviewRows([]);
    setUploadedFileName("");
  };

  // ── Row Manipulations ────────────────────────────────────────────────────────
  const handleAddRow = () => {
    const newRow: ObservasiTableRow = {
      tempId: `new-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      noUrut: rows.length + 1,
      kodeBarang: "",
      namaBarang: "",
      nup: "",
      merekType: "",
      tahunPerolehan: String(selectedYear),
      hargaSatuan: "",
      volume: 1,
      satuan: "unit",
      jumlahHarga: "",
      sumberDana: "",
      kondisi: "Baik",
      penguasaan: "Milik Sendiri",
      keterangan: "",
    };
    setRows((prev) => [...prev, newRow]);
    setIsSaved(false);
  };

  const handleDuplicateRow = (idx: number) => {
    const target = rows[idx];
    if (!target) return;
    const duplicated: ObservasiTableRow = {
      ...target,
      id: undefined,
      tempId: `dup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      noUrut: rows.length + 1,
    };
    const updated = [...rows];
    updated.splice(idx + 1, 0, duplicated);
    const reordered = updated.map((r, i) => ({ ...r, noUrut: i + 1 }));
    setRows(reordered);
    setIsSaved(false);
    showFeedback("Baris berhasil diduplikasi", "info");
  };

  const handleDeleteRow = (idx: number) => {
    const updated = rows.filter((_, i) => i !== idx).map((r, i) => ({ ...r, noUrut: i + 1 }));
    setRows(updated);
    setIsSaved(false);
  };

  const handleRowChange = (idx: number, field: keyof ObservasiTableRow, value: any) => {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[idx], [field]: value };

      // Auto calculate jumlahHarga = hargaSatuan * volume
      if (field === "hargaSatuan" || field === "volume") {
        const hVal = field === "hargaSatuan" ? value : row.hargaSatuan;
        const vVal = field === "volume" ? value : row.volume;
        
        const hNum = typeof hVal === "number" ? hVal : (hVal !== "" && !isNaN(Number(hVal)) ? Number(hVal) : null);
        const vNum = typeof vVal === "number" ? vVal : (vVal !== "" && !isNaN(Number(vVal)) ? Number(vVal) : null);
        
        if (hNum !== null && vNum !== null) {
          row.jumlahHarga = hNum * vNum;
        } else {
          row.jumlahHarga = "";
        }
      }

      next[idx] = row;
      return next;
    });
    setIsSaved(false);
  };

  // ── Save action ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedRoom) {
      showFeedback("Silakan pilih ruangan terlebih dahulu.", "error");
      return;
    }

    setSaveLoading(true);
    try {
      const payloadItems = rows.map((r, i) => {
        const harga = typeof r.hargaSatuan === "number" ? r.hargaSatuan : Number(r.hargaSatuan) || 0;
        const vol = typeof r.volume === "number" ? r.volume : Number(r.volume) || (r.volume === "" ? 0 : 1);
        const jml = typeof r.jumlahHarga === "number" ? r.jumlahHarga : Number(r.jumlahHarga) || (harga * vol);
        return {
          noUrut: i + 1,
          kodeBarang: String(r.kodeBarang || "").trim(),
          namaBarang: String(r.namaBarang || "").trim(),
          nup: String(r.nup || "").trim(),
          merekType: String(r.merekType || "").trim(),
          tahunPerolehan: String(r.tahunPerolehan || "").trim(),
          hargaSatuan: harga,
          volume: vol,
          satuan: String(r.satuan || "").trim(),
          jumlahHarga: jml,
          sumberDana: String(r.sumberDana || "").trim(),
          kondisi: String(r.kondisi || "Baik").trim(),
          penguasaan: String(r.penguasaan || "").trim(),
          keterangan: String(r.keterangan || "").trim(),
        };
      });

      await store.saveRoomObservasi(selectedRoom.id, selectedYear, {
        kampus: selectedRoom.kampus,
        namaGedung: selectedRoom.namaGedung,
        kodeRuangan: selectedRoom.kodeRuangan || "",
        namaRuangan: selectedRoom.namaRuangan,
        unitKerja: "Sekolah Vokasi (SV)",
        petugas: store.currentUser?.nama || "Staff",
        items: payloadItems,
      });

      setIsSaved(true);
      showFeedback(`Data observasi ${selectedRoom.namaRuangan} (${rows.length} barang) berhasil disimpan ke sistem!`, "success");
    } catch (err: any) {
      showFeedback(err?.message || "Gagal menyimpan data observasi", "error");
    } finally {
      setSaveLoading(false);
    }
  };

  // ── Excel Export (matching DAFTAR_BARANG_RUANG reference format) ─────────────
  const handleExportExcel = () => {
    if (!selectedRoom) return;

    const exportRows = rows.map((r, idx) => ({
      no: idx + 1,
      kodeBarang: r.kodeBarang || "",
      namaBarang: r.namaBarang,
      nup: r.nup || "",
      merekType: r.merekType || "",
      tahunPerolehan: r.tahunPerolehan || "",
      hargaSatuan: r.hargaSatuan,
      volume: r.volume,
      satuan: r.satuan || "",
      jumlahHarga: r.jumlahHarga,
      sumberDana: r.sumberDana || "",
      kondisi: r.kondisi || "Baik",
      penguasaan: r.penguasaan || "",
      keterangan: r.keterangan || "",
    }));

    const cleanRoomName = (selectedRoom.namaRuangan || "Ruangan").replace(/[/\\?%*:|"<>]/g, "_");
    const filename = `DAFTAR_BARANG_RUANG_${cleanRoomName}_${selectedYear}`;

    exportDBRExcel(
      {
        year: selectedYear,
        unitKerja: "Sekolah Vokasi",
        departemen: "",
        kodeRuang: selectedRoom.kodeRuangan || "",
        namaRuang: selectedRoom.namaRuangan || "Ruangan",
      },
      exportRows,
      filename,
      "Sheet 1"
    );
    showFeedback(`File Excel "${filename}.xlsx" berhasil diekspor!`, "success");
  };



  // Calculations for summary card & table totals
  const totalVolume = useMemo(() => rows.reduce((acc, r) => acc + (Number(r.volume) || 0), 0), [rows]);
  const totalNilai = useMemo(() => rows.reduce((acc, r) => acc + (Number(r.jumlahHarga) || 0), 0), [rows]);

  // Master rooms with observation status for Monitoring View
  const monitoringData = useMemo(() => {
    return masterRooms.map((r) => {
      const roomObs = store.getObservasiForRoom(String(r.id), selectedYear);
      const isObserved = roomObs && roomObs.length > 0;
      const itemCount = roomObs.length;
      const totalHarga = roomObs.reduce((sum, item) => sum + (Number(item.jumlahHarga) || 0), 0);
      return {
        ...r,
        isObserved,
        itemCount,
        totalHarga,
        items: roomObs,
      };
    });
  }, [masterRooms, store.observasiItems, selectedYear]);

  // Filtered monitoring data
  const filteredMonitoringData = useMemo(() => {
    return monitoringData.filter((r) => {
      const matchSearch =
        monSearch === "" ||
        r.namaRuangan.toLowerCase().includes(monSearch.toLowerCase()) ||
        (r.kodeRuangan && r.kodeRuangan.toLowerCase().includes(monSearch.toLowerCase())) ||
        r.namaGedung.toLowerCase().includes(monSearch.toLowerCase());

      const matchStatus =
        monStatusFilter === "Semua" ||
        (monStatusFilter === "Sudah" && r.isObserved) ||
        (monStatusFilter === "Belum" && !r.isObserved);

      const matchKampus = monKampusFilter === "Semua" || r.kampus === monKampusFilter;

      return matchSearch && matchStatus && matchKampus;
    });
  }, [monitoringData, monSearch, monStatusFilter, monKampusFilter]);

  const selectRoomFromMonitoring = (roomId: string, kampus: string, gedung: string) => {
    setSelectedKampus(kampus);
    setSelectedGedung(gedung);
    setSelectedRoomId(roomId);
    setActiveView("form");
  };

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50 min-w-0 font-sans">
      {topBar}

      <div className="px-3 sm:px-6 py-4 sm:py-6 max-w-7xl mx-auto space-y-6 min-w-0">
        {/* Header Title & Breadcrumb Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#014285] border border-blue-200">
                Kategori Transaksi
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-medium text-slate-500">Pencatatan Lapangan</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <ClipboardList className="text-[#014285]" size={26} />
              Observasi Ruangan
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Pencatatan fisik inventaris langsung di ruangan sebagai data temuan lapangan, terpisah dari proses Stock Opname BMN.
            </p>
          </div>

          {/* Year Selector & View Switcher */}
          <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-inner">
              <Calendar size={15} className="text-slate-500" />
              <span className="text-xs font-semibold text-slate-600">Tahun:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="text-xs font-bold text-[#014285] bg-transparent outline-none cursor-pointer"
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Pill View Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveView("form")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeView === "form"
                    ? "bg-white text-[#014285] shadow-sm border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Form Observasi
              </button>
              <button
                type="button"
                onClick={() => setActiveView("monitoring")}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeView === "monitoring"
                    ? "bg-white text-[#014285] shadow-sm border border-slate-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Monitoring & Progres ({summary.sudahDiobservasi}/{summary.totalRuangan})
              </button>
            </div>
          </div>
        </div>

        {/* Feedback Alert Toast/Banner */}
        {feedbackMsg && (
          <div
            className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
              feedbackMsg.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : feedbackMsg.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {feedbackMsg.type === "success" ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="text-slate-400 hover:text-slate-700 p-1"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Ruangan Master</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{summary.totalRuangan}</span>
              <span className="text-xs text-slate-400 font-medium">Ruangan SV</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1">Single source of truth</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Sudah Diobservasi</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600">{summary.sudahDiobservasi}</span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                {summary.pct}%
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1">Tahun {selectedYear}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Belum Diobservasi</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-600">{summary.belumDiobservasi}</span>
              <span className="text-xs text-slate-400 font-medium">Ruangan</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1">Perlu pengecekan fisik</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-[#014285] uppercase tracking-wider">Total Item Terdata</span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#014285]">{summary.totalItem}</span>
              <span className="text-xs text-slate-400 font-medium">Barang</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1">
              Est. Nilai: Rp {(summary.totalNilai / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} Jt
            </span>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────────────────
            VIEW 1: FORM OBSERVASI RUANGAN
        ───────────────────────────────────────────────────────────────────────────── */}
        {activeView === "form" && (
          <div className="space-y-6">
            {/* Cascading Navigation Selector Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-800">
                <MapPin size={15} className="text-[#014285]" />
                Pilih Cakupan Ruangan Master:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Kampus */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Kampus</label>
                  <select
                    value={selectedKampus}
                    onChange={(e) => {
                      setSelectedKampus(e.target.value);
                      setSelectedGedung("Semua");
                    }}
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#014285]/20 focus:border-[#014285]"
                  >
                    <option value="Semua">Semua Kampus ({kampusList.length})</option>
                    {kampusList.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Gedung */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Gedung</label>
                  <select
                    value={selectedGedung}
                    onChange={(e) => setSelectedGedung(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#014285]/20 focus:border-[#014285]"
                  >
                    <option value="Semua">Semua Gedung ({gedungList.length})</option>
                    {gedungList.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Ruangan */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Ruangan Master</label>
                  <select
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-[#014285] outline-none focus:bg-white focus:ring-2 focus:ring-[#014285]/20 focus:border-[#014285]"
                  >
                    {ruanganList.map((r) => {
                      const isDone = store.getObservasiForRoom(String(r.id), selectedYear).length > 0;
                      return (
                        <option key={r.id} value={String(r.id)}>
                          {r.kodeRuangan ? `[${r.kodeRuangan}] ` : ""}{r.namaRuangan} {isDone ? "✓ (Ada Data)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>

            {/* Room Information & Form Header Card */}
            {selectedRoom && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Header Information (Read-only Auto Filled) */}
                <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded">
                          {selectedRoom.kodeRuangan || "KODE-R"}
                        </span>
                        <h2 className="text-lg font-black text-slate-900">{selectedRoom.namaRuangan}</h2>
                        {rows.length > 0 ? (
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 size={12} /> {rows.length} Barang Tercatat
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-amber-700 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                            Belum Ada Data
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                        <span>{selectedRoom.namaGedung}</span>
                        <span>•</span>
                        <span>{selectedRoom.kampus}</span>
                        <span>•</span>
                        <span>Lantai {selectedRoom.level}</span>
                        {selectedRoom.luas > 0 && (
                          <>
                            <span>•</span>
                            <span>{selectedRoom.luas} m²</span>
                          </>
                        )}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept=".xlsx,.xls,.csv"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                          e.target.value = "";
                        }}
                        className="hidden"
                      />

                      {/* Download Template Excel */}
                      <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 shadow-sm transition-colors"
                        title="Unduh format template Excel standar observasi ruangan"
                      >
                        <FileSpreadsheet size={14} className="text-emerald-600" />
                        Download Template
                      </button>

                      {/* Export Excel */}
                      <button
                        type="button"
                        onClick={handleExportExcel}
                        disabled={rows.length === 0}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 shadow-sm transition-colors disabled:opacity-40"
                        title="Ekspor daftar barang ruangan ini ke format Excel resmi"
                      >
                        <Download size={14} />
                        Export Excel
                      </button>

                      {/* Read-only badge for Pimpinan */}
                      {!canEdit && (
                        <span className="px-3 py-2 text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded-xl">
                          Hanya Lihat (Pimpinan)
                        </span>
                      )}

                      {canEdit && (
                        <>
                          {/* Upload Excel Modal Trigger */}
                          <button
                            type="button"
                            onClick={() => setIsUploadModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 shadow-sm transition-colors"
                            title="Upload file Excel untuk mengisi tabel observasi secara massal"
                          >
                            <Upload size={14} className="text-blue-600" />
                            Upload Excel
                          </button>

                          {/* Tambah Barang Manual */}
                          <button
                            type="button"
                            onClick={handleAddRow}
                            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#014285] hover:bg-[#022B5F] rounded-xl shadow-sm transition-all"
                          >
                            <Plus size={15} />
                            Tambah Barang
                          </button>

                          {/* Simpan Data */}
                          <button
                            type="button"
                            onClick={handleSave}
                            disabled={saveLoading}
                            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-xl shadow-sm transition-all ${
                              isSaved
                                ? "bg-emerald-600 hover:bg-emerald-700"
                                : "bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-300"
                            }`}
                          >
                            {saveLoading ? (
                              <RefreshCw size={14} className="animate-spin" />
                            ) : (
                              <Save size={14} />
                            )}
                            {isSaved ? "Simpan Perubahan" : "Simpan (Ada Perubahan)"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Header Meta Badges Box */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white p-3 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Unit Kerja</span>
                      <span className="font-bold text-slate-800">Sekolah Vokasi (SV)</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Kode Ruang</span>
                      <span className="font-mono font-bold text-slate-800">{selectedRoom.kodeRuangan || "-"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Nama Ruangan</span>
                      <span className="font-bold text-slate-800 truncate block">{selectedRoom.namaRuangan || "-"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Total Barang</span>
                      <span className="font-bold text-[#014285]">{rows.length} Item ({totalVolume} unit)</span>
                    </div>
                  </div>
                </div>

                {/* Table Scroll Container */}
                <div className="overflow-x-auto max-h-[600px]">
                      <table className="w-full text-left border-collapse min-w-[1400px]">
                        <thead className="bg-slate-50 text-slate-500 font-semibold text-[11px] uppercase tracking-wider sticky top-0 z-10 border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-3 w-10 text-center">No</th>
                            <th className="py-3 px-3 min-w-[130px]">Kode Barang</th>
                            <th className="py-3 px-3 min-w-[180px]">Nama Barang</th>
                            <th className="py-3 px-3 min-w-[100px]">NUP</th>
                            <th className="py-3 px-3 min-w-[140px]">Merek / Type</th>
                            <th className="py-3 px-3 w-24">Tahun</th>
                            <th className="py-3 px-3 min-w-[130px]">Harga Satuan (Rp)</th>
                            <th className="py-3 px-3 w-20">Vol</th>
                            <th className="py-3 px-3 w-24">Satuan</th>
                            <th className="py-3 px-3 min-w-[140px]">Jumlah Harga (Rp)</th>
                            <th className="py-3 px-3 min-w-[130px]">Sumber Dana</th>
                            <th className="py-3 px-3 min-w-[120px]">Kondisi</th>
                            <th className="py-3 px-3 min-w-[120px]">Penguasaan</th>
                            <th className="py-3 px-3 min-w-[150px]">Keterangan</th>
                            <th className="py-3 px-3 w-20 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                          {rows.length === 0 ? (
                            <tr>
                              <td colSpan={15} className="py-12 px-4 text-center">
                                <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                                  <div className="w-12 h-12 bg-blue-50 text-[#014285] rounded-full flex items-center justify-center mb-3">
                                    <ClipboardList size={22} />
                                  </div>
                                  <p className="text-sm font-bold text-slate-800">
                                    Belum ada baris barang di ruangan ini
                                  </p>
                                  <p className="text-xs text-slate-500 mt-1 mb-4">
                                    Tambahkan barang secara manual atau impor data langsung dari file spreadsheet Excel.
                                  </p>
                                  <div className="flex items-center gap-2.5 flex-wrap justify-center">
                                    <button
                                      type="button"
                                      onClick={handleAddRow}
                                      className="flex items-center gap-1.5 px-4 py-2 bg-[#014285] hover:bg-[#022B5F] text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                                    >
                                      <Plus size={15} /> Tambah Barang Manual
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setIsUploadModalOpen(true)}
                                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all shadow-sm"
                                    >
                                      <Upload size={15} /> Upload File Excel
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            rows.map((row, idx) => (
                              <tr key={row.tempId || idx} className="hover:bg-blue-50/30 transition-colors">
                                {/* No */}
                                <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                                  {row.noUrut}
                                </td>

                                {/* Kode Barang */}
                                <td className="py-2.5 px-2">
                                  <input
                                    type="text"
                                    placeholder="Contoh: 3.05.01.05.001"
                                    value={row.kodeBarang}
                                    onChange={(e) => handleRowChange(idx, "kodeBarang", e.target.value)}
                                    className="w-full text-xs font-mono border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-[#014285] focus:ring-1 focus:ring-[#014285]"
                                  />
                                </td>

                                {/* Nama Barang */}
                                <td className="py-2.5 px-2">
                                  <input
                                    type="text"
                                    placeholder="Nama barang..."
                                    value={row.namaBarang}
                                    onChange={(e) => handleRowChange(idx, "namaBarang", e.target.value)}
                                    className="w-full text-xs font-semibold text-slate-900 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-[#014285] focus:ring-1 focus:ring-[#014285]"
                                  />
                                </td>

                                {/* NUP */}
                                <td className="py-2.5 px-2">
                                  <input
                                    type="text"
                                    placeholder="1"
                                    value={row.nup}
                                    onChange={(e) => handleRowChange(idx, "nup", e.target.value)}
                                    className="w-full text-xs font-mono border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-[#014285]"
                                  />
                                </td>

                                {/* Merek / Type */}
                                <td className="py-2.5 px-2">
                                  <input
                                    type="text"
                                    placeholder="Contoh: Asus / Lenovo"
                                    value={row.merekType}
                                    onChange={(e) => handleRowChange(idx, "merekType", e.target.value)}
                                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-[#014285]"
                                  />
                                </td>

                                {/* Tahun Perolehan */}
                                <td className="py-2.5 px-2">
                                  <input
                                    type="text"
                                    placeholder="2023"
                                    value={row.tahunPerolehan}
                                    onChange={(e) => handleRowChange(idx, "tahunPerolehan", e.target.value)}
                                    className="w-full text-xs font-mono border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-[#014285]"
                                  />
                                </td>

                                {/* Harga Satuan */}
                                <td className="py-2.5 px-2">
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={row.hargaSatuan === 0 || row.hargaSatuan === "" ? "" : row.hargaSatuan}
                                    onChange={(e) => handleRowChange(idx, "hargaSatuan", e.target.value)}
                                    className="w-full text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-[#014285]"
                                  />
                                </td>

                                {/* Volume */}
                                <td className="py-2.5 px-2">
                                  <input
                                    type="number"
                                    min="0"
                                    placeholder="1"
                                    value={row.volume === "" ? "" : row.volume}
                                    onChange={(e) => handleRowChange(idx, "volume", e.target.value)}
                                    className="w-full text-xs font-bold text-center border border-slate-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:border-[#014285]"
                                  />
                                </td>

                                {/* Satuan */}
                                <td className="py-2.5 px-2">
                                  <input
                                    type="text"
                                    list="satuan-options"
                                    placeholder="unit"
                                    value={row.satuan}
                                    onChange={(e) => handleRowChange(idx, "satuan", e.target.value)}
                                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-[#014285]"
                                  />
                                  <datalist id="satuan-options">
                                    {SATUAN_OPTIONS.map((s) => (
                                      <option key={s} value={s} />
                                    ))}
                                  </datalist>
                                </td>

                                {/* Jumlah Harga (Calculated - Read Only) */}
                                <td className="py-2.5 px-3 font-semibold text-slate-800 bg-slate-50/50 rounded">
                                  {row.jumlahHarga !== "" && row.jumlahHarga !== undefined && row.jumlahHarga !== null && !isNaN(Number(row.jumlahHarga)) && Number(row.jumlahHarga) > 0
                                    ? `Rp ${Number(row.jumlahHarga).toLocaleString("id-ID")}`
                                    : "-"}
                                </td>

                                {/* Sumber Dana */}
                                <td className="py-2.5 px-2">
                                  <select
                                    value={row.sumberDana}
                                    onChange={(e) => handleRowChange(idx, "sumberDana", e.target.value)}
                                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:border-[#014285]"
                                  >
                                    <option value="">-- Pilih --</option>
                                    {SUMBER_DANA_OPTIONS.map((sd) => (
                                      <option key={sd} value={sd}>
                                        {sd}
                                      </option>
                                    ))}
                                    {row.sumberDana && !SUMBER_DANA_OPTIONS.includes(row.sumberDana) && (
                                      <option value={row.sumberDana}>{row.sumberDana}</option>
                                    )}
                                  </select>
                                </td>

                                {/* Kondisi Barang */}
                                <td className="py-2.5 px-2">
                                  <select
                                    value={row.kondisi}
                                    onChange={(e) => handleRowChange(idx, "kondisi", e.target.value)}
                                    className={`w-full text-xs font-semibold border rounded-lg px-2 py-1.5 outline-none ${
                                      row.kondisi === "Baik"
                                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                        : row.kondisi === "Rusak Ringan"
                                        ? "bg-amber-50 text-amber-800 border-amber-200"
                                        : "bg-rose-50 text-rose-800 border-rose-200"
                                    }`}
                                  >
                                    {KONDISI_OPTIONS.map((k) => (
                                      <option key={k} value={k}>
                                        {k}
                                      </option>
                                    ))}
                                  </select>
                                </td>

                                {/* Penguasaan */}
                                <td className="py-2.5 px-2">
                                  <input
                                    type="text"
                                    list="penguasaan-options"
                                    placeholder="Milik Sendiri"
                                    value={row.penguasaan}
                                    onChange={(e) => handleRowChange(idx, "penguasaan", e.target.value)}
                                    className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:border-[#014285]"
                                  />
                                  <datalist id="penguasaan-options">
                                    {PENGUASAAN_OPTIONS.map((p) => (
                                      <option key={p} value={p} />
                                    ))}
                                  </datalist>
                                </td>

                                {/* Keterangan */}
                                <td className="py-2.5 px-2">
                                  <input
                                    type="text"
                                    placeholder="Catatan tambahan..."
                                    value={row.keterangan}
                                    onChange={(e) => handleRowChange(idx, "keterangan", e.target.value)}
                                    className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white outline-none focus:border-[#014285]"
                                  />
                                </td>

                            {/* Actions */}
                            <td className="py-2.5 px-2 text-center">
                              {canEdit ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleDuplicateRow(idx)}
                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Duplikasi baris"
                                  >
                                    <Copy size={13} />
                                  </button>
                                  {canDelete && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRow(idx)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                      title="Hapus baris"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer & Summary Bar */}
                {rows.length > 0 && (
                  <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={handleAddRow}
                          className="flex items-center gap-1.5 px-3 py-1.5 font-bold text-[#014285] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                          <Plus size={14} /> Tambah Baris Baru
                        </button>
                      )}
                      <span className="text-slate-500 font-medium">
                        Total: <strong>{rows.length}</strong> jenis barang ({totalVolume} total unit)
                      </span>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block font-medium">Estimasi Nilai Hasil Observasi</span>
                        <span className="text-sm font-black text-slate-900">
                          Rp {totalNilai.toLocaleString("id-ID")}
                        </span>
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={saveLoading}
                          className="px-4 py-2 bg-[#014285] hover:bg-[#022B5F] text-white font-bold rounded-xl shadow-sm transition-all"
                        >
                          Simpan Observasi Ruangan
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────────────────
            VIEW 2: MONITORING & PROGRES RUANGAN
        ───────────────────────────────────────────────────────────────────────────── */}
        {activeView === "monitoring" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Progres Observasi Ruangan (Tahun {selectedYear})</h2>
                <p className="text-xs text-slate-500">
                  Pantau kelengkapan hasil observasi fisik inventaris di seluruh 256 master ruangan Sekolah Vokasi.
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari ruangan / kode..."
                    value={monSearch}
                    onChange={(e) => setMonSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:bg-white focus:border-[#014285]"
                  />
                </div>

                <select
                  value={monKampusFilter}
                  onChange={(e) => setMonKampusFilter(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 outline-none"
                >
                  <option value="Semua">Semua Kampus</option>
                  {kampusList.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>

                <select
                  value={monStatusFilter}
                  onChange={(e) => setMonStatusFilter(e.target.value as any)}
                  className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 outline-none"
                >
                  <option value="Semua">Semua Status</option>
                  <option value="Sudah">Sudah Diobservasi</option>
                  <option value="Belum">Belum Diobservasi</option>
                </select>
              </div>
            </div>

            {/* Monitoring Rooms Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Kode Ruang</th>
                    <th className="py-2.5 px-3">Nama Ruangan</th>
                    <th className="py-2.5 px-3">Gedung / Kampus</th>
                    <th className="py-2.5 px-3">Lantai</th>
                    <th className="py-2.5 px-3 text-center">Status Observasi ({selectedYear})</th>
                    <th className="py-2.5 px-3 text-right">Jumlah Barang</th>
                    <th className="py-2.5 px-3 text-right">Estimasi Nilai (Rp)</th>
                    <th className="py-2.5 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredMonitoringData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Tidak ada ruangan yang cocok dengan filter aktif
                      </td>
                    </tr>
                  ) : (
                    filteredMonitoringData.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-600">
                          {r.kodeRuangan || "-"}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {r.namaRuangan}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {r.namaGedung} · <span className="text-[10px] text-slate-400">{r.kampus}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          Lantai {r.level}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {r.isObserved ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                              <Check size={11} /> Sudah ({r.itemCount} item)
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                              Belum Diobservasi
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                          {r.isObserved ? `${r.itemCount} barang` : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-slate-800">
                          {r.isObserved && r.totalHarga > 0
                            ? `Rp ${r.totalHarga.toLocaleString("id-ID")}`
                            : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => selectRoomFromMonitoring(String(r.id), r.kampus, r.namaGedung)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#014285] hover:text-[#022B5F] bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            Buka Form <ArrowRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* ── Modal Upload Excel ── */}
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 text-[#014285] rounded-xl">
                    <Upload size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Upload Excel Observasi Ruangan</h3>
                    <p className="text-xs text-slate-500">
                      Impor data inventaris ruangan langsung dari file spreadsheet (.xlsx, .xls, .csv)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setParsedPreviewRows([]);
                    setUploadedFileName("");
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body (Scrollable) */}
              <div className="overflow-y-auto flex-1 space-y-4 pr-1">
                {/* Download Template Banner */}
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <FileSpreadsheet size={18} className="text-emerald-700 shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-emerald-900">Belum punya template format kolom?</p>
                      <p className="text-[11px] text-emerald-700">Gunakan template resmi agar nama kolom sesuai dengan sistem.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
                    className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-lg border border-emerald-300 flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Download size={13} />
                    Download Template (.xlsx)
                  </button>
                </div>

                {/* Drag and Drop Zone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                    isDragging
                      ? "border-blue-500 bg-blue-50/50 scale-[0.99]"
                      : uploadedFileName
                      ? "border-emerald-400 bg-emerald-50/30"
                      : "border-slate-300 hover:border-blue-400 hover:bg-slate-50/60"
                  }`}
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 text-[#014285] flex items-center justify-center mb-2">
                    <Upload size={22} />
                  </div>
                  {uploadedFileName ? (
                    <div>
                      <p className="text-xs font-bold text-emerald-800 flex items-center justify-center gap-1.5">
                        <CheckCircle2 size={14} className="text-emerald-600" />
                        File Terpilih: <span className="underline">{uploadedFileName}</span>
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">Klik atau seret file baru untuk mengganti</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-bold text-slate-700">Tarik & Letakkan file Excel Anda di sini</p>
                      <p className="text-[11px] text-slate-400 mt-1">atau klik untuk memilih file dari komputer (.xlsx, .xls, .csv)</p>
                    </div>
                  )}
                </div>

                {/* Preview Table & Mode Option */}
                {parsedPreviewRows.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-xs font-bold text-slate-800">
                          Pratinjau Data: {parsedPreviewRows.length} Barang Ditemukan
                        </span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Total Estimasi: Rp{" "}
                          {parsedPreviewRows
                            .reduce((s, r) => s + (Number(r.jumlahHarga) || 0), 0)
                            .toLocaleString("id-ID")}
                        </p>
                      </div>

                      {/* Import Mode Radio */}
                      <div className="flex items-center gap-2">
                        {!isPekerjaSO && (
                          <label
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                              importMode === "replace"
                                ? "bg-white text-[#014285] border border-blue-200 shadow-xs"
                                : "text-slate-600 hover:bg-slate-200/60"
                            }`}
                          >
                            <input
                              type="radio"
                              name="importMode"
                              checked={importMode === "replace"}
                              onChange={() => setImportMode("replace")}
                              className="text-[#014285]"
                            />
                            Timpa data lama (Ganti Semua)
                          </label>
                        )}
                        <label
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                            importMode === "append" || isPekerjaSO
                              ? "bg-white text-[#014285] border border-blue-200 shadow-xs"
                              : "text-slate-600 hover:bg-slate-200/60"
                          }`}
                        >
                          <input
                            type="radio"
                            name="importMode"
                            checked={importMode === "append" || isPekerjaSO}
                            onChange={() => setImportMode("append")}
                            className="text-[#014285]"
                            disabled={isPekerjaSO}
                          />
                          Tambahkan ke data yang ada
                        </label>
                      </div>
                    </div>

                    {/* Preview Table */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-2.5 w-10 text-center">No</th>
                            <th className="py-2 px-2.5">Nama Barang</th>
                            <th className="py-2 px-2.5">Merek / Type</th>
                            <th className="py-2 px-2.5 text-center">Vol</th>
                            <th className="py-2 px-2.5 text-right">Harga Satuan (Rp)</th>
                            <th className="py-2 px-2.5 text-right">Jumlah (Rp)</th>
                            <th className="py-2 px-2.5 text-center">Kondisi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parsedPreviewRows.slice(0, 10).map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="py-1.5 px-2.5 text-center text-slate-400 font-mono">{i + 1}</td>
                              <td className="py-1.5 px-2.5 font-semibold text-slate-800">{r.namaBarang}</td>
                              <td className="py-1.5 px-2.5 text-slate-500">{r.merekType || "-"}</td>
                              <td className="py-1.5 px-2.5 text-center font-bold text-slate-700">{r.volume} {r.satuan}</td>
                              <td className="py-1.5 px-2.5 text-right text-slate-600">
                                Rp {Number(r.hargaSatuan).toLocaleString("id-ID")}
                              </td>
                              <td className="py-1.5 px-2.5 text-right font-bold text-[#014285]">
                                Rp {Number(r.jumlahHarga).toLocaleString("id-ID")}
                              </td>
                              <td className="py-1.5 px-2.5 text-center">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  r.kondisi === "Baik"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}>
                                  {r.kondisi}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {parsedPreviewRows.length > 10 && (
                      <p className="text-[11px] text-slate-400 text-center italic">
                        + {parsedPreviewRows.length - 10} baris barang lainnya akan dimasukkan.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
                <span className="text-[11px] text-slate-400">
                  Target Ruangan: <strong className="text-slate-700">{selectedRoom?.namaRuangan || "Pilih Ruangan"}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUploadModalOpen(false);
                      setParsedPreviewRows([]);
                      setUploadedFileName("");
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyImportedRows}
                    disabled={parsedPreviewRows.length === 0}
                    className="px-5 py-2 text-xs font-bold text-white bg-[#014285] hover:bg-[#022B5F] rounded-xl shadow-sm transition-all disabled:opacity-40"
                  >
                    Terapkan ke Tabel Observasi ({parsedPreviewRows.length} Barang)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
