import React, { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { useDataStore } from "./DataStore";
import { ensureAuthToken } from "../services/apiClient";
import {
  Upload, Download, X, CheckCircle2, FileSpreadsheet, Loader2,
} from "lucide-react";

// ── Template column headers per category ─────────────────────────────────────
const TEMPLATE_COLS: Record<string, string[]> = {
  PM: [
    "KodeGl","Nama_unit","Id","Id_aset","Trx_id_unit","Trx_tgl_update","Trx_status",
    "Cek","Cek_unit","TahunBuku","KodeAkun","KodeRKAT","Dokumen","Referensi",
    "Id_upload_bap","Tgl_pengadaan","Tgl_transaksi","Spesifikasi","MerkType",
    "TglPerolehan","HargaSatuan","KodeBarang","SumberDana","Kondisi","Keterangan",
    "Export_tgl","Export_user","IsAdmin","Id_ruangan","Pengguna","Id_iplan_aset",
    "Iplan_dokumen","Url_thumb","Id_unit","Tgl_update","Nama_Barang","Id_upload",
    "Url","Kode","Nama_ruangan","TipeAset","Penyusutan_per_bulan","HargaDiterima",
    "Umur_tahun","Umur_bulan","Masa_manfaat","Sisa_masa_manfaat","Jml_penyusutan",
    "Akumulasi","NilaiBuku","Verifikasi_status",
  ],
  ATB: [
    "KodeGl","Nama_unit","Id","Id_aset","Trx_id_unit","Trx_tgl_update","Trx_status",
    "Cek","Cek_unit","TahunBuku","KodeAkun","KodeRKAT","Dokumen","Referensi",
    "Tgl_transaksi","Tgl_pengadaan","Id_upload_bap","KodeBarang","Spesifikasi","MerkType",
    "TglPerolehan","HargaSatuan","SumberDana","Kondisi","Id_ruangan","IsAdmin",
    "Export_tgl","Export_user","Keterangan","Pengguna","Id_iplan_aset","Iplan_dokumen",
    "Url_thumb","Id_unit","Tgl_update","Nama_Barang","Id_upload","Url",
    "Penyusutan_per_bulan","HargaDiterima","Umur_tahun","Umur_bulan","Masa_manfaat",
    "Sisa_masa_manfaat","Jml_penyusutan","Akumulasi","NilaiBuku","Verifikasi_status",
  ],
  ATL: [
    "KodeGl","Nama_unit","Id","Id_aset","Trx_id_unit","Trx_tgl_update","Trx_status",
    "Cek","Cek_unit","TahunBuku","KodeAkun","KodeRKAT","Dokumen","Referensi",
    "Tgl_transaksi","Tgl_pengadaan","Id_upload_bap","KodeBarang","Spesifikasi","MerkType",
    "TglPerolehan","HargaSatuan","SumberDana","Kondisi","Id_ruangan","Pengguna",
    "IsAdmin","Export_tgl","Export_user","Keterangan","Id_iplan_aset","Iplan_dokumen",
    "Url_thumb","Id_unit","Tgl_update","Nama_Barang","Id_upload","Url","Kode",
    "Nama_ruangan","Penyusutan_per_bulan","HargaDiterima","Umur_tahun","Umur_bulan",
    "Masa_manfaat","Sisa_masa_manfaat","Jml_penyusutan","Akumulasi","NilaiBuku",
    "Verifikasi_status",
  ],
  AL: [
    "KodeGl","Nama_unit","Id","Id_aset","Trx_id_unit","Trx_tgl_update","Trx_status",
    "Cek","Cek_unit","TahunBuku","KodeAkun","KodeRKAT","Dokumen","Referensi",
    "Tgl_transaksi","Tgl_pengadaan","Id_upload_bap","KodeBarang","NoPolisi",
    "JenisAngkutan","Model","Spesifikasi","MerkType","NoRangka","NoMesin","NoBpkb",
    "TglPembuatan","TglPerolehan","HargaSatuan","SumberDana","Bmi_bmn","Kondisi",
    "Keterangan","TglStnk","Pajak","IsAdmin","Id_ruangan","Pengguna","Id_iplan_aset",
    "Iplan_dokumen","Url_thumb","Id_unit","Tgl_update","Nama_Barang","Id_upload",
    "Url","Url_stnk","Url_bpkb","Url_status_penetapan","Penyusutan_per_bulan",
    "HargaDiterima","Umur_tahun","Umur_bulan","Masa_manfaat","Sisa_masa_manfaat",
    "Jml_penyusutan","Akumulasi","NilaiBuku","Total_perbaikan","Verifikasi_status",
  ],
};

const CHUNK_SIZE = 500; // rows processed per tick to avoid UI blocking

const LABEL: Record<string, string> = {
  PM: "Peralatan & Mesin",
  ATB: "Aset Tak Berwujud",
  ATL: "Aset Tetap Lainnya",
  AL: "Alat Angkutan",
};

interface Props {
  open: boolean;
  onClose: () => void;
  category: "PM" | "ATB" | "ATL" | "AL";
  existingIds: Set<string>;
  onImport: (rows: Record<string, any>[]) => Promise<void> | void;
  /** Called once before importing to wipe all existing rows of this category */
  onClearCategory?: (category: string) => Promise<void>;
}

type Phase = "idle" | "importing" | "done";

export function ExcelUploadModal({ open, onClose, category, onImport, onClearCategory }: Props) {
  const store = useDataStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);   // 0–100
  const [totalRows, setTotalRows] = useState(0);
  const [doneRows, setDoneRows] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // ── Template download ──────────────────────────────────────────────────────
  const downloadTemplate = () => {
    const cols = TEMPLATE_COLS[category];
    const exampleRow = cols.map(() => "");
    const ws = XLSX.utils.aoa_to_sheet([cols, exampleRow]);
    ws["!cols"] = cols.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Template_${category}`);
    XLSX.writeFile(wb, `template-${category.toLowerCase()}.xlsx`);
  };

  // ── Process file — chunked insert, no validation blocking ─────────────────
  const processFile = useCallback(async (file: File) => {
    // Ensure active session before processing large files
    const token = await ensureAuthToken();
    if (!token && !localStorage.getItem("access_token")) {
      alert("Sesi Anda belum terautentikasi atau telah berakhir. Silakan masuk terlebih dahulu.");
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
      return;
    }

    setFileName(file.name);
    setPhase("importing");
    setProgress(0);
    setDoneRows(0);

    // Read file
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array", raw: false, cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];

    // Parse all rows preserving original types:
    // raw:true  → numbers stay as JS numbers (no truncation/string coercion)
    // defval:null → empty cells become null (stored as SQL NULL, not '-')
    const allRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      raw: true,
      defval: null,
    });

    if (!allRows.length) {
      setPhase("idle");
      alert("File tidak mengandung data.");
      return;
    }

    const total = allRows.length;
    setTotalRows(total);

    // Ask user: replace existing data or append?
    const shouldReplace = onClearCategory
      ? window.confirm(
          `File berisi ${total.toLocaleString()} baris.\n\n` +
          `Pilih:\n` +
          `• OK  → Hapus data ${LABEL[category]} yang ada lalu upload ulang (aman, tidak dobel).\n` +
          `• Cancel → Tambahkan saja data baru tanpa menghapus data lama.`
        )
      : false;

    if (shouldReplace && onClearCategory) {
      try {
        await onClearCategory(category);
      } catch (e: any) {
        alert(`Gagal membersihkan data lama: ${e.message}`);
        setPhase("idle");
        return;
      }
    }

    // Chunked processing: yield to UI between chunks
    let inserted = 0;
    try {
      for (let start = 0; start < total; start += CHUNK_SIZE) {
        const chunk = allRows.slice(start, start + CHUNK_SIZE);
        // Await so backend insertion is complete for this chunk
        await onImport(chunk as Record<string, any>[]);
        inserted += chunk.length;
        const pct = Math.round((inserted / total) * 100);
        setProgress(pct);
        setDoneRows(inserted);
        // Yield to event loop so progress bar renders smoothly
        await new Promise(r => setTimeout(r, 0));
      }
      setPhase("done");

      // Cap snapshot to 100 items to avoid exceeding localStorage quota on large 20k+ datasets
      const itemsDetail = allRows.slice(0, 100).map((r: any, idx: number) => ({
        id: String(r["Id"] ?? r["id"] ?? r["KodeBarang"] ?? r["kode_barang"] ?? `ITEM-${idx + 1}`),
        kode: String(r["KodeBarang"] ?? r["kode_barang"] ?? r["Kode"] ?? r["Id"] ?? r["id"] ?? `ITEM-${idx + 1}`),
        nama: String(r["NamaBarang"] ?? r["nama_barang"] ?? r["Nama_Barang"] ?? r["Nama"] ?? "-"),
        kategori: LABEL[category] || category,
        ruangan: String(r["NamaRuangan"] ?? r["Nama_ruangan"] ?? r["Ruangan"] ?? "-"),
        kondisi: String(r["Kondisi"] ?? r["kondisi"] ?? "Baik"),
        nilai: r["NilaiBuku"] ?? r["_nilai_buku"] ?? r["HargaPerolehan"] ?? r["HargaSatuan"] ?? 0,
        nup: String(r["Id_aset"] ?? r["id_aset"] ?? r["ID_ASET"] ?? r["NUP"] ?? r["nup"] ?? r["no_nup"] ?? r["NoNup"] ?? "-"),
        merek: String(r["MerkType"] ?? r["Model"] ?? r["Merk"] ?? r["Merek"] ?? r["merek"] ?? r["merk"] ?? "-"),
        snapshot: r,
      }));

      // Log successful upload to Menu Aktivitas
      store.appendActivity({
        pengguna: store.currentUser.nama,
        role: store.currentUser.role,
        menu: "Data Aset",
        aksi: `Upload Excel ${inserted.toLocaleString("id-ID")} baris ke ${LABEL[category] || category} (${category})${file.name ? ` — File: ${file.name}` : ""}`,
        target_type: "Kategori",
        target_id: category,
        file_name: file.name,
        items_count: inserted,
        items_detail: itemsDetail,
        status: "Berhasil",
        jenis: "tambah",
      });

      // Show count summary
      alert(`✅ Upload selesai!\n${inserted.toLocaleString()} dari ${total.toLocaleString()} baris berhasil disimpan ke database.`);
    } catch (err: any) {
      const rawMsg = err?.message || "Kesalahan proses file";
      let displayMsg = rawMsg;
      if (rawMsg.toLowerCase().includes("unauthorized") || rawMsg.includes("401")) {
        displayMsg = "Sesi autentikasi telah berakhir atau belum masuk. Silakan masuk kembali.";
        window.dispatchEvent(new CustomEvent("auth:unauthorized"));
      } else if (rawMsg.toLowerCase().includes("forbidden") || rawMsg.includes("403")) {
        displayMsg = "Akses ditolak: Akun Anda tidak memiliki hak akses untuk mengunggah dataset aset. Hanya Admin Sistem dan Admin Pusat yang diperbolehkan.";
      }

      store.appendActivity({
        pengguna: store.currentUser.nama,
        role: store.currentUser.role,
        menu: "Data Aset",
        aksi: `Gagal upload Excel ke ${LABEL[category] || category} (${category}) — ${displayMsg}`,
        target_type: "Kategori",
        target_id: category,
        status: "Gagal",
        jenis: "gagal",
      });
      alert(`Upload gagal: ${displayMsg}`);
      setPhase("idle");
    }
  }, [onImport, onClearCategory, category, store]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  };

  const reset = () => {
    setPhase("idle");
    setFileName("");
    setProgress(0);
    setTotalRows(0);
    setDoneRows(0);
  };

  const handleClose = () => { reset(); onClose(); };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={phase === "importing" ? undefined : handleClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <FileSpreadsheet size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Upload Excel — {LABEL[category]}</h2>
              <p className="text-xs text-gray-500 mt-0.5">Import semua data dari file Excel (.xlsx / .xls)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadTemplate}
              disabled={phase === "importing"}
              className="flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              <Download size={13} /> Template {category}
            </button>
            <button
              onClick={handleClose}
              disabled={phase === "importing"}
              className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center disabled:opacity-40"
            >
              <X size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">

          {/* ── IDLE — Drop zone ── */}
          {phase === "idle" && (
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-3 cursor-pointer transition-all ${
                isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-blue-50/30"
              }`}
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? "bg-blue-100" : "bg-gray-100"}`}>
                <Upload size={28} className={isDragging ? "text-blue-500" : "text-gray-400"} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">Seret file Excel ke sini, atau klik untuk memilih</p>
                <p className="text-xs text-gray-500 mt-1">Format: .xlsx / .xls · Semua data akan diimport langsung</p>
              </div>
            </div>
          )}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileChange} />

          {/* ── IMPORTING — Progress ── */}
          {phase === "importing" && (
            <div className="space-y-5 py-4">
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <Loader2 size={28} className="text-blue-600 animate-spin" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-900">Mengimport data...</p>
                  <p className="text-xs text-gray-500 mt-1 truncate max-w-xs">{fileName}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{doneRows.toLocaleString("id-ID")} / {totalRows.toLocaleString("id-ID")} baris</span>
                  <span className="font-semibold text-blue-600">{progress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-150"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <p className="text-center text-[11px] text-gray-400">
                Jangan tutup halaman ini sampai proses selesai.
              </p>
            </div>
          )}

          {/* ── DONE ── */}
          {phase === "done" && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 size={32} className="text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Import Selesai!</h3>
                <p className="text-sm text-gray-500 mt-1">
                  <span className="font-semibold text-green-600">
                    {totalRows.toLocaleString("id-ID")} baris
                  </span>{" "}
                  data berhasil diimport ke sistem.
                </p>
                <p className="text-xs text-gray-400 mt-1 truncate max-w-xs mx-auto">{fileName}</p>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={reset}
                  className="text-xs border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Upload File Lain
                </button>
                <button
                  onClick={handleClose}
                  className="text-xs bg-gray-900 text-white px-5 py-2 rounded-lg hover:bg-black transition-colors font-semibold"
                >
                  Selesai
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
