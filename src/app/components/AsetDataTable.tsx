import React, { useState, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  Plus, Filter, Download, Upload, ArrowUpDown, X, Search,
  ChevronLeft, ChevronRight, Edit2, Trash2, QrCode,
} from "lucide-react";
import { useApp } from "./AppContext";
import apiClient from "../services/apiClient";
import { AsetModal } from "./AsetModal";
import type { AsetFormData } from "./AsetModal";
import { useDataStore, type JenisAset } from "./DataStore";
import { BarcodeModal } from "./BarcodeScanner";
import { ExcelUploadModal } from "./ExcelUploadModal";

// ── Column definitions — persis sesuai struktur Excel sumber per kategori ─────

// PM: Peralatan & Mesin — urutan kolom dari Peralatan_dan_Mesin.xlsx (51 kolom lengkap)
const PM_COLS = [
  "No","KodeGl","Nama_unit","Id","Id_aset","Trx_id_unit","Trx_tgl_update","Trx_status",
  "Cek","Cek_unit","TahunBuku","KodeAkun","KodeRKAT","Dokumen","Referensi",
  "Id_upload_bap","Tgl_pengadaan","Tgl_transaksi","Spesifikasi","MerkType",
  "TglPerolehan","HargaSatuan","KodeBarang","SumberDana","Kondisi","Keterangan",
  "Export_tgl","Export_user","IsAdmin","Id_ruangan","Pengguna","Id_iplan_aset",
  "Iplan_dokumen","Url_thumb","Id_unit","Tgl_update","Nama_Barang","Id_upload",
  "Url","Kode","Nama_ruangan","TipeAset","Penyusutan_per_bulan","HargaDiterima",
  "Umur_tahun","Umur_bulan","Masa_manfaat","Sisa_masa_manfaat","Jml_penyusutan",
  "Akumulasi","NilaiBuku","Verifikasi_status",
];

// ATB: Aset Tak Berwujud — urutan kolom dari Aset_Tak_Berwujud.xlsx
const ATB_COLS = [
  "No","KodeGl","Nama_unit","Id","Id_aset","Trx_id_unit","Trx_tgl_update","Trx_status",
  "Cek","Cek_unit","TahunBuku","KodeAkun","KodeRKAT","Dokumen","Referensi",
  "Tgl_transaksi","Tgl_pengadaan","Id_upload_bap","KodeBarang","Spesifikasi","MerkType",
  "TglPerolehan","HargaSatuan","SumberDana","Kondisi","Id_ruangan","IsAdmin",
  "Export_tgl","Export_user","Keterangan","Pengguna","Id_iplan_aset","Iplan_dokumen",
  "Url_thumb","Id_unit","Tgl_update","Nama_Barang","Id_upload","Url",
  "Penyusutan_per_bulan","HargaDiterima","Umur_tahun","Umur_bulan","Masa_manfaat",
  "Sisa_masa_manfaat","Jml_penyusutan","Akumulasi","NilaiBuku","Verifikasi_status",
];

// ATL: Aset Tetap Lainnya — urutan kolom dari Aset_Tetap_Lainnya.xlsx
const ATL_COLS = [
  "No","KodeGl","Nama_unit","Id","Id_aset","Trx_id_unit","Trx_tgl_update","Trx_status",
  "Cek","Cek_unit","TahunBuku","KodeAkun","KodeRKAT","Dokumen","Referensi",
  "Tgl_transaksi","Tgl_pengadaan","Id_upload_bap","KodeBarang","Spesifikasi","MerkType",
  "TglPerolehan","HargaSatuan","SumberDana","Kondisi","Id_ruangan","Pengguna",
  "IsAdmin","Export_tgl","Export_user","Keterangan","Id_iplan_aset","Iplan_dokumen",
  "Url_thumb","Id_unit","Tgl_update","Nama_Barang","Id_upload","Url","Kode",
  "Nama_ruangan","Penyusutan_per_bulan","HargaDiterima","Umur_tahun","Umur_bulan",
  "Masa_manfaat","Sisa_masa_manfaat","Jml_penyusutan","Akumulasi","NilaiBuku",
  "Verifikasi_status",
];

// AL: Alat Angkutan — urutan kolom dari Alat_Angkutan.xlsx (ada kolom kendaraan tambahan)
const AL_COLS = [
  "No","KodeGl","Nama_unit","Id","Id_aset","Trx_id_unit","Trx_tgl_update","Trx_status",
  "Cek","Cek_unit","TahunBuku","KodeAkun","KodeRKAT","Dokumen","Referensi",
  "Tgl_transaksi","Tgl_pengadaan","Id_upload_bap","KodeBarang","NoPolisi",
  "JenisAngkutan","Model","Spesifikasi","MerkType","NoRangka","NoMesin","NoBpkb",
  "TglPembuatan","TglPerolehan","HargaSatuan","SumberDana","Bmi_bmn","Kondisi",
  "Keterangan","TglStnk","Pajak","IsAdmin","Id_ruangan","Pengguna","Id_iplan_aset",
  "Iplan_dokumen","Url_thumb","Id_unit","Tgl_update","Nama_Barang","Id_upload",
  "Url","Url_stnk","Url_bpkb","Url_status_penetapan","Penyusutan_per_bulan",
  "HargaDiterima","Umur_tahun","Umur_bulan","Masa_manfaat","Sisa_masa_manfaat",
  "Jml_penyusutan","Akumulasi","NilaiBuku","Total_perbaikan","Verifikasi_status",
];

const GENERIC_COLS = [
  "No","Kode Aset","Nama Aset","Merek/Tipe","Spesifikasi","Tahun Perolehan",
  "Sumber Dana","Kondisi","Lokasi","Penanggung Jawab","Nilai Perolehan",
  "Nilai Buku","Masa Manfaat","Status",
];


// ── Data factory ──────────────────────────────────────────────────────────────
type Row = Record<string, string>;

// ── Row ↔ Form converters ─────────────────────────────────────────────────────
function rowToForm(row: Row): Partial<AsetFormData> {
  const nupVal = (row.Id_aset || row.id_aset || row.ID_ASET || row.nup || row.NUP || "").toString().trim();
  return {
    Nama_Barang:   row.Nama_Barang   || "",
    Id_aset:       nupVal,
    nup:           nupVal,
    MerkType:      row.MerkType      || "",
    Spesifikasi:   row.Spesifikasi   || "",
    KodeBarang:    row.KodeBarang    || "",
    KodeGl:        row.KodeGl        || "",
    KodeAkun:      row.KodeAkun      || "532111",
    KodeRKAT:      row.KodeRKAT      || "",
    Dokumen:       row.Dokumen       || "",
    Referensi:     row.Referensi     || "",
    Nama_unit:     row.Nama_unit     || "Sekolah Vokasi",
    TahunBuku:     row.TahunBuku     || "",
    Tgl_pengadaan: row.Tgl_pengadaan || "",
    TglPerolehan:  row.TglPerolehan  || "",
    HargaSatuan:   row.HargaSatuan   || "",
    SumberDana:    row.SumberDana    || "BOPTN",
    Masa_manfaat:  row.Masa_manfaat  || "4 Tahun",
    Nama_ruangan:  row.Nama_ruangan  || "",
    Pengguna:      row.Pengguna      || "",
    Kondisi:       row.Kondisi       || "Baik",
    Trx_status:    row.Trx_status    || "Aktif",
    Keterangan:    row.Keterangan    || "-",
    // Vehicle
    NoPolisi:      row.NoPolisi  || "",
    JenisAngkutan: row.JenisAngkutan || "",
    Model:         row.Model     || "",
    NoRangka:      row.NoRangka  || "",
    NoMesin:       row.NoMesin   || "",
    NoBpkb:        row.NoBpkb    || "",
    TglPembuatan:  (row.TglPembuatan !== "-" ? row.TglPembuatan : "") || "",
    TglStnk:       (row.TglStnk !== "-" ? row.TglStnk : "") || "",
    Pajak:         row.Pajak     || "",
    Bmi_bmn:       row.Bmi_bmn   || "",
    // Tag & PIC
    kode_tag_aset: row.kode_tag_aset || "",
    nama_pic:      row.nama_pic      || "",
    unit_pic:      row.unit_pic      || "",
    kontak_pic:    row.kontak_pic    || "",
    // Lokasi Detail
    nama_gedung:              row.nama_gedung              || "",
    lantai_level:             row.lantai_level             || "",
    kode_ruangan:             row.kode_ruangan             || "",
    nama_ruangan_standar:     row.nama_ruangan_standar     || "",
    kategori_ruangan:         row.kategori_ruangan         || "",
    luas_ruangan_m2:          row.luas_ruangan_m2          || "",
    kapasitas_orang_ruangan:  row.kapasitas_orang_ruangan  || "",
    latitude:                 row.latitude                 || "",
    longitude:                row.longitude                || "",
    referensi_denah:          row.referensi_denah          || "",
    status_kejelasan_lokasi:  row.status_kejelasan_lokasi  || "Jelas",
    status_penggunaan_aset:   row.status_penggunaan_aset   || "Digunakan",
    // Opname
    tanggal_opname_terakhir:        (row.tanggal_opname_terakhir !== "-" ? row.tanggal_opname_terakhir : "") || "",
    status_opname_terakhir:         row.status_opname_terakhir         || "",
    kondisi_fisik_opname_terakhir:  row.kondisi_fisik_opname_terakhir  || "",
    status_lokasi_opname_terakhir:  row.status_lokasi_opname_terakhir  || "",
    diverifikasi_oleh_terakhir:     row.diverifikasi_oleh_terakhir     || "",
    catatan_opname_terakhir:        row.catatan_opname_terakhir        || "",
    // Maintenance
    tanggal_maintenance_terakhir:   (row.tanggal_maintenance_terakhir !== "-" ? row.tanggal_maintenance_terakhir : "") || "",
    jenis_maintenance_terakhir:     row.jenis_maintenance_terakhir     || "",
    kategori_kerusakan_terakhir:    row.kategori_kerusakan_terakhir    || "",
    tingkat_kerusakan_terakhir:     row.tingkat_kerusakan_terakhir     || "",
    biaya_maintenance_terakhir:     row.biaya_maintenance_terakhir     || "",
    total_frekuensi_maintenance:    row.total_frekuensi_maintenance    || "",
    total_biaya_maintenance:        row.total_biaya_maintenance        || "",
    downtime_terakhir_jam:          row.downtime_terakhir_jam          || "",
    rata_rata_waktu_perbaikan_jam:  row.rata_rata_waktu_perbaikan_jam  || "",
    jadwal_maintenance_berikutnya:  (row.jadwal_maintenance_berikutnya !== "-" ? row.jadwal_maintenance_berikutnya : "") || "",
    // Mutasi
    tanggal_mutasi_terakhir: (row.tanggal_mutasi_terakhir !== "-" ? row.tanggal_mutasi_terakhir : "") || "",
    status_mutasi_terakhir:  row.status_mutasi_terakhir  || "",
    catatan_mutasi_terakhir: row.catatan_mutasi_terakhir || "",
  };
}

function formToRow(form: AsetFormData, id: string): Row {
  const rawHarga  = form.HargaSatuan.replace(/[^0-9]/g,"");
  const harga     = parseInt(rawHarga) || 0;
  const masaStr   = form.Masa_manfaat.replace(/\D.*/,"");
  const masaTahun = parseInt(masaStr) || 4;
  const TODAY     = "2026-06-01";
  const fmt       = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

  let months = 0;
  if (form.TglPerolehan) {
    const s = new Date(form.TglPerolehan);
    const e = new Date(TODAY);
    months = Math.max(0, (e.getFullYear()-s.getFullYear())*12 + (e.getMonth()-s.getMonth()));
  }
  const deprMonth = masaTahun > 0 ? Math.round(harga/(masaTahun*12)) : 0;
  const totalDepr = Math.min(harga, deprMonth*months);
  const nilaiBook = Math.max(0, harga - totalDepr);
  const sisaM     = Math.max(0, masaTahun*12 - months);
  const seq       = id.replace(/[^0-9]/g,"").padStart(4,"0").slice(-4);
  const nupVal    = (form.Id_aset || form.nup || "").toString().trim() || "-";

  return {
    id,
    KodeGl:         form.KodeGl     || `132${seq.slice(-3)}`,
    Nama_unit:      form.Nama_unit,
    Id:             seq,
    Id_aset:        nupVal,
    nup:            nupVal,
    Trx_id_unit:    "U01",
    Trx_tgl_update: TODAY,
    Trx_status:     form.Trx_status,
    Cek: "Yes", Cek_unit: "Yes",
    TahunBuku:  form.TahunBuku,
    KodeAkun:   form.KodeAkun,
    KodeRKAT:   form.KodeRKAT || `R${(parseInt(seq)%9)+1}`,
    Dokumen:    form.Dokumen   || `DOK-${id}`,
    Referensi:  form.Referensi || `REF-${id}`,
    Id_upload_bap: `BAP${100+parseInt(seq)}`,
    Tgl_pengadaan:  form.Tgl_pengadaan,
    Tgl_transaksi:  form.Tgl_pengadaan || TODAY,
    Spesifikasi:    form.Spesifikasi,
    MerkType:       form.MerkType,
    TglPerolehan:   form.TglPerolehan,
    HargaSatuan:    harga > 0 ? fmt(harga) : form.HargaSatuan,
    KodeBarang:     form.KodeBarang,
    SumberDana:     form.SumberDana,
    Kondisi:        form.Kondisi,
    Keterangan:     form.Keterangan || "-",
    Export_tgl: TODAY, Export_user: "Admin", IsAdmin: "True",
    Id_ruangan:  `R${100+parseInt(seq)}`,
    Pengguna:    form.Pengguna,
    Id_iplan_aset: `IP${seq}`, Iplan_dokumen: "-", Url_thumb: "-", Id_unit: "U01",
    Tgl_update:  TODAY,
    Nama_Barang: form.Nama_Barang,
    Id_upload:   `UPL${100+parseInt(seq)}`,
    Url: "-", Kode: `K${seq}`, Nama_ruangan: form.Nama_ruangan,
    TipeAset: id.split("-")[0],
    Penyusutan_per_bulan: fmt(deprMonth),
    HargaDiterima: fmt(harga),
    Umur_tahun: Math.floor(months/12).toString(),
    Umur_bulan: (months%12).toString(),
    Masa_manfaat: form.Masa_manfaat,
    Sisa_masa_manfaat: `${Math.floor(sisaM/12)} Th ${sisaM%12} Bln`,
    Jml_penyusutan: fmt(totalDepr),
    Akumulasi: fmt(totalDepr),
    NilaiBuku: fmt(nilaiBook),
    Verifikasi_status: form.Trx_status === "Aktif" ? "Verified" : "Pending",
    // Vehicle
    NoPolisi:      form.NoPolisi      || "-",
    JenisAngkutan: form.JenisAngkutan || "-",
    Model:         form.Model         || form.MerkType,
    NoRangka:      form.NoRangka      || "-",
    NoMesin:       form.NoMesin       || "-",
    NoBpkb:        form.NoBpkb        || "-",
    TglPembuatan:  form.TglPembuatan  || "-",
    TglStnk:       form.TglStnk       || "-",
    Pajak:         form.Pajak         || "-",
    Bmi_bmn:       form.Bmi_bmn       || "-",
    Url_stnk: "-", Url_bpkb: "-", Url_status_penetapan: "-",
    Total_perbaikan: fmt(0),
    // Tag & PIC
    kode_tag_aset: form.kode_tag_aset || `TAG-SV-${seq}`,
    nama_pic:      form.nama_pic      || form.Pengguna,
    unit_pic:      form.unit_pic      || form.Nama_unit,
    kontak_pic:    form.kontak_pic    || "-",
    // Lokasi Detail
    nama_gedung:             form.nama_gedung             || "-",
    lantai_level:            form.lantai_level            || "-",
    kode_ruangan:            form.kode_ruangan            || `KR-${seq}`,
    nama_ruangan_standar:    form.nama_ruangan_standar    || form.Nama_ruangan,
    kategori_ruangan:        form.kategori_ruangan        || "-",
    luas_ruangan_m2:         form.luas_ruangan_m2         || "-",
    kapasitas_orang_ruangan: form.kapasitas_orang_ruangan || "-",
    latitude:                form.latitude                || "-",
    longitude:               form.longitude               || "-",
    referensi_denah:         form.referensi_denah         || "-",
    status_kejelasan_lokasi: form.status_kejelasan_lokasi || "Jelas",
    status_penggunaan_aset:  form.status_penggunaan_aset  || "Digunakan",
    // Opname
    tanggal_opname_terakhir:       form.tanggal_opname_terakhir       || "-",
    status_opname_terakhir:        form.status_opname_terakhir        || "-",
    kondisi_fisik_opname_terakhir: form.kondisi_fisik_opname_terakhir || form.Kondisi,
    status_lokasi_opname_terakhir: form.status_lokasi_opname_terakhir || "-",
    diverifikasi_oleh_terakhir:    form.diverifikasi_oleh_terakhir    || "-",
    catatan_opname_terakhir:       form.catatan_opname_terakhir       || "-",
    // Maintenance
    tanggal_maintenance_terakhir:  form.tanggal_maintenance_terakhir  || "-",
    jenis_maintenance_terakhir:    form.jenis_maintenance_terakhir    || "-",
    kategori_kerusakan_terakhir:   form.kategori_kerusakan_terakhir   || "-",
    tingkat_kerusakan_terakhir:    form.tingkat_kerusakan_terakhir    || "-",
    biaya_maintenance_terakhir:    form.biaya_maintenance_terakhir    || fmt(0),
    total_frekuensi_maintenance:   form.total_frekuensi_maintenance   || "0",
    total_biaya_maintenance:       form.total_biaya_maintenance       || fmt(0),
    downtime_terakhir_jam:         form.downtime_terakhir_jam         || "0",
    rata_rata_waktu_perbaikan_jam: form.rata_rata_waktu_perbaikan_jam || "0",
    jadwal_maintenance_berikutnya: form.jadwal_maintenance_berikutnya || "-",
    // Mutasi
    tanggal_mutasi_terakhir: form.tanggal_mutasi_terakhir || "-",
    status_mutasi_terakhir:  form.status_mutasi_terakhir  || "-",
    catatan_mutasi_terakhir: form.catatan_mutasi_terakhir || "-",
  };
}

// ── Badge helpers ─────────────────────────────────────────────────────────────
function KondisiBadge({ val }: { val: string }) {
  const cls =
    val === "Baik"         ? "bg-green-100 text-green-700"  :
    val === "Rusak Ringan" ? "bg-yellow-100 text-yellow-700":
    val === "Rusak Berat"  ? "bg-red-100 text-red-700"      :
                             "bg-gray-100 text-gray-600";
  return <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${cls}`}>{val||"-"}</span>;
}

function StatusBadge({ val }: { val: string }) {
  const cls =
    ["Aktif","Verified","Ditemukan","Sesuai","Jelas","Digunakan","Selesai"].includes(val)  ? "bg-green-100 text-green-700"  :
    ["Perbaikan","Pending","Preventif","Proses","Belum Dicek"].includes(val)               ? "bg-yellow-100 text-yellow-700":
    ["Dihapus","Tidak Ditemukan","Tidak Digunakan","Tidak Sesuai"].includes(val)           ? "bg-red-100 text-red-700"      :
    ["Dipinjam","Korektif"].includes(val)                                                  ? "bg-blue-100 text-blue-700"   :
    "bg-gray-100 text-gray-600";
  return <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${cls}`}>{val||"-"}</span>;
}

const BADGE_KONDISI = new Set(["Kondisi","kondisi_fisik_opname_terakhir"]);
const BADGE_STATUS  = new Set([
  "Trx_status","Verifikasi_status","status_opname_terakhir","status_lokasi_opname_terakhir",
  "status_kejelasan_lokasi","status_penggunaan_aset","jenis_maintenance_terakhir","status_mutasi_terakhir",
]);

// ── Main Component ────────────────────────────────────────────────────────────
export function AsetDataTable({ title, pageId }: { title: string; pageId?: string }) {
  const { showToast } = useApp();
  const store = useDataStore();
  const jenisKey: JenisAset | null =
    pageId === "pm" ? "PM" : pageId === "atb" ? "ATB" : pageId === "atl" ? "ATL" : pageId === "al" ? "AL" : null;

  const isPM  = pageId === "pm";
  const isATB = pageId === "atb";
  const isATL = pageId === "atl";
  const isAL  = pageId === "al";

  const cols        = isPM ? PM_COLS : isATB ? ATB_COLS : isATL ? ATL_COLS : isAL ? AL_COLS : GENERIC_COLS;
  const assetPrefix = isPM ? "PM"    : isATB ? "ATB"    : isATL ? "ATL"    : isAL ? "AL"    : "A";

  // data sourced directly from store
  const data = useMemo(
    () => jenisKey ? store.getAssetsByJenis(jenisKey) : store.assets,
    [jenisKey, store.getAssetsByJenis, store.assets],
  );

  // ── State ──
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({ search: "", kondisi: "Semua", sumber: "Semua", status: "Semua", penggunaan: "Semua" });
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [barcodeRow, setBarcodeRow] = useState<Row | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const existingKodes = useMemo(
    () => new Set(data.map(r => (r.KodeBarang ?? "")).filter(Boolean)),
    [data],
  );

  // ── Filter & Sort ──
  const processed = useMemo(() => {
    let rows = [...data];
    if (filters.search) {
      const q = filters.search.toLowerCase();
      rows = rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
    }
    if (filters.kondisi   !== "Semua") rows = rows.filter(r => r.Kondisi === filters.kondisi);
    if (filters.sumber    !== "Semua") rows = rows.filter(r => r.SumberDana === filters.sumber);
    if (filters.status    !== "Semua") rows = rows.filter(r => r.Trx_status === filters.status);
    if (filters.penggunaan!== "Semua") rows = rows.filter(r => r.status_penggunaan_aset === filters.penggunaan);
    if (sortCol) {
      rows.sort((a,b) => {
        const va = String(a[sortCol]||""), vb = String(b[sortCol]||"");
        const na = parseFloat(va.replace(/[^0-9.-]/g,"")), nb = parseFloat(vb.replace(/[^0-9.-]/g,""));
        if (!isNaN(na)&&!isNaN(nb)) return sortDir==="asc" ? na-nb : nb-na;
        return sortDir==="asc" ? va.localeCompare(vb,"id") : vb.localeCompare(va,"id");
      });
    }
    return rows;
  }, [data, filters, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(processed.length/rowsPerPage));
  const paged      = processed.slice((currentPage-1)*rowsPerPage, currentPage*rowsPerPage);
  const activeFilters =
    (filters.kondisi    !== "Semua" ? 1 : 0) +
    (filters.sumber     !== "Semua" ? 1 : 0) +
    (filters.status     !== "Semua" ? 1 : 0) +
    (filters.penggunaan !== "Semua" ? 1 : 0);

  // ── Handlers ──
  const handleSort = (col: string) => {
    if (col === "No") return;
    if (sortCol === col) setSortDir(d => d==="asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
    setCurrentPage(1);
  };

  const toggleSelect = (id: string) => setSelected(p => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleSelectAll = () => {
    if (selected.size === paged.length && paged.length > 0) setSelected(new Set());
    else setSelected(new Set(paged.map(r => r.id)));
  };

  // Tambah
  const handleAdd = () => { setEditRow(null); setModalOpen(true); };

  // Edit (pilih 1 baris dulu)
  const handleEditSelected = () => {
    if (selected.size !== 1) return;
    const id = Array.from(selected)[0];
    const row = data.find(r => r.id === id);
    if (row) { setEditRow(row); setModalOpen(true); }
  };

  // Delete (pilih 1+ baris dulu)
  const handleDeleteSelected = () => {
    if (selected.size === 0) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    const count = selected.size;
    Array.from(selected).forEach(id => store.deleteAsset(id));
    setSelected(new Set());
    setShowDeleteConfirm(false);
    showToast(count === 1 ? "Data aset berhasil dihapus." : `${count} data aset berhasil dihapus.`, "info");
  };

  const handleSave = (formData: AsetFormData) => {
    if (editRow) {
      store.upsertAsset({ ...editRow, ...formToRow(formData, editRow.id) });
      showToast("Data aset berhasil diperbarui!");
    } else {
      const newId = `${assetPrefix}-${String(data.length + 1).padStart(3, "0")}`;
      store.upsertAsset(formToRow(formData, newId));
      showToast("Data aset baru berhasil ditambahkan!");
    }
    setModalOpen(false);
    setEditRow(null);
  };

  // ── Export Excel ──
  const handleExport = () => {
    const exportCols = cols.filter(c => c !== "No");
    const sheetData  = [exportCols, ...processed.map(row => exportCols.map(c => row[c]||"-"))];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws["!cols"]   = exportCols.map(col => ({ wch: Math.min(Math.max(col.length, ...processed.map(r=>String(r[col]||"-").length))+2, 40) }));
    ws["!freeze"] = { xSplit:0, ySplit:1 };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0,31));
    XLSX.writeFile(wb, `aset-${pageId||"data"}-${new Date().toISOString().split("T")[0]}.xlsx`);
    showToast(`${processed.length} data berhasil diekspor ke Excel!`);
  };

  const handleUploadImport = async (rows: Record<string, any>[]) => {
    const newRows: Row[] = rows.map((r) => {
      const nupVal = (r["Id_aset"] ?? r["id_aset"] ?? r["ID_ASET"] ?? r["NUP"] ?? r["nup"] ?? r["no_nup"] ?? "").toString().trim();
      return {
        ...r,
        // Use Excel's own Id as the stable frontend key; fall back to KodeBarang
        id: String(r["Id"] ?? r["id"] ?? "").trim() || r["KodeBarang"] || `${assetPrefix}-${Math.random().toString(36).slice(2,9)}`,
        Id_aset: nupVal,
        nup: nupVal,
        TipeAset: assetPrefix,
      };
    });
    await store.insertBulkAssets(newRows, { skipLog: true });
  };

  const handleClearCategory = async (category: string) => {
    try {
      await apiClient.delete(`/assets/by-category/${category}`);
    } catch (e: any) {
      console.warn("Backend API clear category unavailable or failed:", e?.message);
    }
    // Remove from local React state too
    store.deleteAssetsByJenis(category);
  };

  const handleDeleteAll = async () => {
    const label = jenisKey === "PM" ? "Peralatan & Mesin"
      : jenisKey === "ATB" ? "Aset Tak Berwujud"
      : jenisKey === "ATL" ? "Aset Tetap Lainnya"
      : "Alat Angkutan";
    const totalData = data.length;
    const confirmed = window.confirm(
      `⚠️ HAPUS SEMUA DATA ${label.toUpperCase()}\n\n` +
      `Anda yakin ingin menghapus SEMUA ${totalData.toLocaleString()} data ${label}?\n\n` +
      `Tindakan ini TIDAK DAPAT DIBATALKAN dan data akan hilang permanen dari database.\n\n` +
      `Klik OK untuk melanjutkan, Cancel untuk membatalkan.`
    );
    if (!confirmed) return;
    try {
      const res = await apiClient.delete(`/assets/by-category/${jenisKey}`);
      const deleted = (res.data as any).deleted ?? totalData;
      store.deleteAssetsByJenis(jenisKey!);
      alert(`✅ Berhasil menghapus ${deleted.toLocaleString()} data ${label} dari database.`);
    } catch (e: any) {
      alert(`Gagal menghapus: ${e.response?.data?.message ?? e.message}`);
    }
  };

  const setFilter = (key: keyof typeof filters, val: string) => { setFilters(p => ({...p,[key]:val})); setCurrentPage(1); };
  const clearFilters = () => { setFilters({search:"",kondisi:"Semua",sumber:"Semua",status:"Semua",penggunaan:"Semua"}); setCurrentPage(1); };

  // ── Render ──
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-[calc(100vh-140px)] density-table">

      {/* ── Header / Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0 gap-3">
        {/* Left */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-800 shrink-0">{title}</span>
          <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-3 h-8 w-52">
            <Search size={13} className="text-gray-400 shrink-0" />
            <input
              className="flex-1 bg-transparent text-xs outline-none text-gray-700 placeholder:text-gray-400"
              placeholder="Cari semua kolom..."
              value={filters.search}
              onChange={e => setFilter("search", e.target.value)}
            />
            {filters.search && <button onClick={() => setFilter("search","")}><X size={11} className="text-gray-400 hover:text-gray-700" /></button>}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Tampilkan entri */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Tampilkan</span>
            <select
              value={rowsPerPage}
              onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="bg-gray-50 border border-gray-200 rounded text-xs text-gray-700 px-2 py-1 focus:outline-none cursor-pointer"
            >
              {[10,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <span className="text-xs text-gray-500">entri</span>
          </div>

          <div className="w-px h-4 bg-gray-200" />

          {/* Tambah Data */}
          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 bg-[#6B7280] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#4B5563] transition-colors shadow-sm"
          >
            <Plus size={12} /> Tambah Data
          </button>

          {/* Edit Data — aktif hanya jika 1 baris dipilih */}
          <button
            onClick={handleEditSelected}
            disabled={selected.size !== 1}
            title={selected.size !== 1 ? "Pilih tepat 1 baris untuk mengedit" : "Edit data yang dipilih"}
            className={`flex items-center gap-1.5 border px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm ${
              selected.size === 1
                ? "bg-white border-[#6B7280] text-[#6B7280] hover:bg-gray-50 cursor-pointer"
                : "bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed"
            }`}
          >
            <Edit2 size={12} /> Edit Data
          </button>

          {/* Hapus Data — aktif jika 1+ baris dipilih */}
          <button
            onClick={handleDeleteSelected}
            disabled={selected.size === 0}
            title={selected.size === 0 ? "Pilih minimal 1 baris untuk menghapus" : `Hapus ${selected.size} data yang dipilih`}
            className={`flex items-center gap-1.5 border px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm ${
              selected.size > 0
                ? "bg-white border-red-300 text-red-600 hover:bg-red-50 cursor-pointer"
                : "bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed"
            }`}
          >
            <Trash2 size={12} />
            {selected.size > 1 ? `Hapus (${selected.size})` : "Hapus Data"}
          </button>

          {/* Generate Barcode */}
          <button
            onClick={() => {
              if (selected.size !== 1) return;
              const id = Array.from(selected)[0];
              const row = data.find(r => r.id === id);
              if (row) setBarcodeRow(row);
            }}
            disabled={selected.size !== 1}
            title={selected.size !== 1 ? "Pilih tepat 1 baris untuk generate barcode" : "Generate barcode aset"}
            className={`flex items-center gap-1.5 border px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm ${
              selected.size === 1
                ? "bg-white border-blue-300 text-blue-600 hover:bg-blue-50 cursor-pointer"
                : "bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed"
            }`}
          >
            <QrCode size={12} /> Barcode
          </button>

          <div className="w-px h-4 bg-gray-200" />

          {/* Filter */}
          <button
            onClick={() => setFilterOpen(v => !v)}
            className={`flex items-center gap-1.5 border px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm ${
              filterOpen || activeFilters > 0
                ? "bg-[#6B7280] text-white border-[#6B7280]"
                : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Filter size={12} /> Filter {activeFilters > 0 && `(${activeFilters})`}
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 bg-white border border-gray-200 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Download size={12} /> Export Excel
          </button>

          {/* Import */}
          <button
            onClick={() => setUploadOpen(true)}
            className="flex items-center gap-1.5 bg-blue-600 text-white border border-blue-600 px-3 py-1.5 rounded-lg text-xs hover:bg-blue-700 transition-colors shadow-sm font-semibold"
          >
            <Upload size={12} /> Upload Excel
          </button>

          {/* Hapus Semua Data */}
          {jenisKey && (
            <button
              onClick={handleDeleteAll}
              title={`Hapus SEMUA data ${jenisKey} dari database secara permanen`}
              className="flex items-center gap-1.5 bg-red-600 text-white border border-red-600 px-3 py-1.5 rounded-lg text-xs hover:bg-red-700 transition-colors shadow-sm font-semibold"
            >
              <Trash2 size={12} /> Hapus Semua
            </button>
          )}
        </div>
      </div>

      {/* ── Filter Panel ── */}
      {filterOpen && (
        <div className="px-5 py-2.5 border-b border-gray-100 bg-gray-50/30 flex items-center gap-3 flex-wrap shrink-0">
          <span className="text-xs font-semibold text-[#6B7280]">Filter:</span>
          {[
            { label:"Kondisi",           key:"kondisi"    as const, opts:["Semua","Baik","Rusak Ringan","Rusak Berat","Hilang"] },
            { label:"Sumber Dana",       key:"sumber"     as const, opts:["Semua","BOPTN","Mandiri","Hibah","APBN","APBD"] },
            { label:"Status Aset",       key:"status"     as const, opts:["Semua","Aktif","Perbaikan","Dihapus","Dipinjam"] },
            { label:"Status Penggunaan", key:"penggunaan" as const, opts:["Semua","Digunakan","Tidak Digunakan","Dipinjam","Hilang"] },
          ].map(f => (
            <div key={f.key} className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">{f.label}:</span>
              <select
                value={filters[f.key]}
                onChange={e => setFilter(f.key, e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none focus:ring-1 focus:ring-[#6B7280]"
              >
                {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
          {(activeFilters > 0 || filters.search) && (
            <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1 ml-1">
              <X size={11} /> Hapus Filter
            </button>
          )}
          <span className="text-xs text-gray-400 ml-auto">
            Menampilkan <span className="font-semibold text-gray-700">{processed.length}</span> dari <span className="font-semibold text-gray-700">{data.length}</span> data
          </span>
        </div>
      )}

      {/* ── Selection Info Bar ── */}
      {selected.size > 0 && !showDeleteConfirm && (
        <div className="px-5 py-2 border-b border-[#6B7280]/20 bg-[#6B7280]/5 flex items-center gap-3 shrink-0">
          <div className="w-1.5 h-1.5 rounded-full bg-[#6B7280]" />
          <span className="text-xs font-semibold text-[#6B7280]">{selected.size} data dipilih</span>
          {selected.size === 1 && (
            <span className="text-xs text-gray-500">— klik <strong>Edit Data</strong> untuk mengedit, atau <strong>Hapus Data</strong> untuk menghapus</span>
          )}
          {selected.size > 1 && (
            <span className="text-xs text-gray-500">— klik <strong>Hapus ({selected.size})</strong> untuk menghapus semua yang dipilih</span>
          )}
          <button
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 font-medium"
          >
            <X size={10} /> Batal pilih
          </button>
        </div>
      )}

      {/* ── Delete Confirm Bar ── */}
      {showDeleteConfirm && (
        <div className="px-5 py-3 border-b border-red-100 bg-red-50 flex items-center gap-3 shrink-0">
          <Trash2 size={15} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700 flex-1 font-medium">
            {selected.size === 1
              ? "Yakin ingin menghapus 1 data ini? Tindakan tidak dapat dibatalkan."
              : `Yakin ingin menghapus ${selected.size} data yang dipilih? Tindakan tidak dapat dibatalkan.`}
          </p>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="text-xs font-medium text-gray-600 px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            onClick={confirmDelete}
            className="text-xs font-semibold text-white px-3 py-1.5 bg-red-500 rounded-lg hover:bg-red-600"
          >
            Ya, Hapus
          </button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-auto flex-1">
        <table className="w-full text-left whitespace-nowrap">
          <thead className="sticky top-0 bg-white z-10">
            <tr className="border-b-2 border-gray-200">
              <th className="py-3 px-4 w-10 bg-white">
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 accent-[#6B7280] cursor-pointer rounded"
                  checked={paged.length > 0 && selected.size === paged.length}
                  ref={el => { if (el) el.indeterminate = selected.size > 0 && selected.size < paged.length; }}
                  onChange={toggleSelectAll}
                />
              </th>
              {cols.map((h,i) => (
                <th
                  key={i}
                  onClick={() => handleSort(h)}
                  className={`py-3 px-4 bg-white font-semibold text-[11px] text-gray-500 uppercase tracking-wide ${
                    h !== "No" ? "cursor-pointer hover:text-[#6B7280] hover:bg-gray-50 select-none transition-colors" : ""
                  }`}
                >
                  <div className="flex items-center gap-1">
                    {h}
                    {h !== "No" && (
                      sortCol === h
                        ? <span className="text-[#6B7280]">{sortDir === "asc" ? "↑" : "↓"}</span>
                        : <ArrowUpDown size={10} className="text-gray-300 shrink-0" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={cols.length+1} className="py-20 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Search size={28} className="text-gray-200" />
                    <p className="text-sm font-medium text-gray-400">Tidak ada data yang sesuai</p>
                    <p className="text-xs text-gray-400">Coba ubah filter atau kata kunci pencarian</p>
                    {(activeFilters > 0 || filters.search) && (
                      <button onClick={clearFilters} className="mt-2 text-xs text-[#6B7280] hover:underline font-medium">Hapus semua filter</button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paged.map((row,i) => (
                <tr
                  key={row.id}
                  onClick={() => toggleSelect(row.id)}
                  className={`border-b border-gray-100 hover:bg-gray-50/70 transition-colors cursor-pointer ${
                    selected.has(row.id) ? "bg-[#6B7280]/5 border-l-2 border-l-[#6B7280]" : ""
                  }`}
                >
                  <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleSelect(row.id)}
                      className="w-3.5 h-3.5 accent-[#6B7280] cursor-pointer rounded"
                    />
                  </td>
                  {cols.map((c,idx) => {
                    if (c === "No") return (
                      <td key={idx} className="py-3 px-4 text-xs text-gray-400 font-mono">
                        {(currentPage-1)*rowsPerPage + i + 1}
                      </td>
                    );
                    if (BADGE_KONDISI.has(c)) return (
                      <td key={idx} className="py-3 px-4"><KondisiBadge val={row[c]||"-"} /></td>
                    );
                    if (BADGE_STATUS.has(c)) return (
                      <td key={idx} className="py-3 px-4"><StatusBadge val={row[c]||"-"} /></td>
                    );
                    return (
                      <td key={idx} className="py-3 px-4 text-xs text-gray-600 max-w-[180px] truncate">
                        {String(row[c]||"-")}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between shrink-0">
        <div className="text-xs text-gray-500">
          {processed.length > 0
            ? <> Menampilkan{" "}
                <span className="font-semibold text-gray-700">{(currentPage-1)*rowsPerPage+1}</span>
                {" "}–{" "}
                <span className="font-semibold text-gray-700">{Math.min(currentPage*rowsPerPage, processed.length)}</span>
                {" "}dari{" "}
                <span className="font-semibold text-gray-700">{processed.length}</span> data
              </>
            : "Tidak ada data"
          }
          {data.length !== processed.length && <span className="text-gray-400"> (dari {data.length} total)</span>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentPage(1)} disabled={currentPage===1}
            className="w-7 h-7 flex items-center justify-center rounded-md text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-mono">«</button>
          <button onClick={() => setCurrentPage(p => Math.max(1,p-1))} disabled={currentPage===1}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">
            <ChevronLeft size={14} />
          </button>
          {(() => {
            const pages: number[] = [];
            if (totalPages <= 5) { for (let p=1;p<=totalPages;p++) pages.push(p); }
            else if (currentPage <= 3) pages.push(1,2,3,4,5);
            else if (currentPage >= totalPages-2) { for (let p=totalPages-4;p<=totalPages;p++) pages.push(p); }
            else { for (let p=currentPage-2;p<=currentPage+2;p++) pages.push(p); }
            return pages.map(p => (
              <button key={p} onClick={() => setCurrentPage(p)}
                className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-medium transition-colors ${
                  currentPage===p ? "bg-[#6B7280] text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"
                }`}>{p}</button>
            ));
          })()}
          <button onClick={() => setCurrentPage(p => Math.min(totalPages,p+1))} disabled={currentPage===totalPages}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">
            <ChevronRight size={14} />
          </button>
          <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage===totalPages}
            className="w-7 h-7 flex items-center justify-center rounded-md text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed font-mono">»</button>
        </div>
      </div>

      {/* ── Modal ── */}
      <AsetModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditRow(null); }}
        mode={editRow ? "edit" : "add"}
        initialData={editRow ? rowToForm(editRow) : undefined}
        onSave={handleSave}
        assetType={title}
        pageId={pageId}
      />
      {barcodeRow && (
        <BarcodeModal
          assetCode={barcodeRow.id}
          assetName={String(barcodeRow.Nama_Barang || barcodeRow.id)}
          onClose={() => setBarcodeRow(null)}
        />
      )}
      {jenisKey && (
        <ExcelUploadModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          category={jenisKey}
          existingIds={existingKodes}
          onImport={handleUploadImport}
          onClearCategory={handleClearCategory}
        />
      )}
    </div>
  );
}
