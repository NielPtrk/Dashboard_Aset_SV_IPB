import React, { useState, useEffect } from "react";
import { X, Save, AlertCircle } from "lucide-react";

// ── Form Data Interface ───────────────────────────────────────────────────────
export interface AsetFormData {
  // ── Identitas & Kode (manual) ──
  Nama_Barang:  string;
  Id_aset?:     string;   // ID_ASET / NUP
  nup?:         string;   // NUP mirror
  KodeGl:       string;   // Kode GL Buku Besar — WAJIB manual
  KodeBarang:   string;   // Kode Inventaris
  KodeAkun:     string;   // Kode Akun
  KodeRKAT:     string;   // Kode RKAT (manual/opsional)
  Dokumen:      string;   // No. Dokumen Pengadaan
  Referensi:    string;   // No. Referensi
  MerkType:     string;
  Spesifikasi:  string;
  Nama_unit:    string;
  TahunBuku:    string;
  // ── Keuangan & Pengadaan ──
  Tgl_pengadaan: string;
  TglPerolehan:  string;
  HargaSatuan:   string;
  SumberDana:    string;
  Masa_manfaat:  string;
  // ── Lokasi & Kondisi ──
  Nama_ruangan:  string;
  Pengguna:      string;
  Kondisi:       string;
  Trx_status:    string;
  Keterangan:    string;
  // ── Kendaraan (AL only) ──
  NoPolisi?:     string;
  JenisAngkutan?:string;
  Model?:        string;
  NoRangka?:     string;
  NoMesin?:      string;
  NoBpkb?:       string;
  TglPembuatan?: string;
  TglStnk?:      string;
  Pajak?:        string;
  Bmi_bmn?:      string;
  // ── Tag & PIC ──
  kode_tag_aset?: string;
  nama_pic?:      string;
  unit_pic?:      string;
  kontak_pic?:    string;
  // ── Lokasi Detail ──
  nama_gedung?:             string;
  lantai_level?:            string;
  kode_ruangan?:            string;
  nama_ruangan_standar?:    string;
  kategori_ruangan?:        string;
  luas_ruangan_m2?:         string;
  kapasitas_orang_ruangan?: string;
  latitude?:                string;
  longitude?:               string;
  referensi_denah?:         string;
  status_kejelasan_lokasi?: string;
  status_penggunaan_aset?:  string;
  // ── Opname ──
  tanggal_opname_terakhir?:       string;
  status_opname_terakhir?:        string;
  kondisi_fisik_opname_terakhir?: string;
  status_lokasi_opname_terakhir?: string;
  diverifikasi_oleh_terakhir?:    string;
  catatan_opname_terakhir?:       string;
  // ── Maintenance ──
  tanggal_maintenance_terakhir?:  string;
  jenis_maintenance_terakhir?:    string;
  kategori_kerusakan_terakhir?:   string;
  tingkat_kerusakan_terakhir?:    string;
  biaya_maintenance_terakhir?:    string;
  total_frekuensi_maintenance?:   string;
  total_biaya_maintenance?:       string;
  downtime_terakhir_jam?:         string;
  rata_rata_waktu_perbaikan_jam?: string;
  jadwal_maintenance_berikutnya?: string;
  // ── Mutasi ──
  tanggal_mutasi_terakhir?: string;
  status_mutasi_terakhir?:  string;
  catatan_mutasi_terakhir?: string;
}

// ── Contextual config per sub-menu ───────────────────────────────────────────
const FORM_CTX = {
  pm: {
    namaLabel:     "Nama Peralatan / Mesin",
    namaPH:        "Contoh: Laptop Dell Inspiron 15, Proyektor Epson EB-X51",
    merkLabel:     "Merek / Tipe",
    merkPH:        "Contoh: Dell Inspiron 3511, Epson EB-X51",
    specLabel:     "Spesifikasi Teknis",
    specPH:        "Contoh: Intel i5-1135G7, 8GB RAM, 512GB SSD, USB 3.0",
    kodeBarangLabel:"Kode Inventaris",
    kodeBarangPH:  "Contoh: B001, PM-INV-001",
    lokasiLabel:   "Lokasi / Ruangan",
    lokasiPH:      "Contoh: Lab Komputer A, Ruang Dosen 201",
    penggunaLabel: "Penanggung Jawab",
    penggunaPH:    "Contoh: Budi Santoso, Dr. Andi Pratama",
    docLabel:      "No. Dokumen BAP/Pengadaan",
    docPH:         "Contoh: DOK-PM-001, BAP-2023-001",
    refLabel:      "No. Referensi",
    refPH:         "Contoh: REF-PM-001",
  },
  atb: {
    namaLabel:     "Nama Aset / Lisensi Software",
    namaPH:        "Contoh: Microsoft 365 Business, AutoCAD 2025, Turnitin",
    merkLabel:     "Vendor / Publisher",
    merkPH:        "Contoh: Microsoft, Autodesk, Adobe, IBM, Turnitin LLC",
    specLabel:     "Spesifikasi / Cakupan Lisensi",
    specPH:        "Contoh: 50 Users, Annual License, Cloud-based, SaaS",
    kodeBarangLabel:"Kode Aset Tak Berwujud",
    kodeBarangPH:  "Contoh: SW001, ATB-LIC-001",
    lokasiLabel:   "Unit / Lokasi Server / Jaringan",
    lokasiPH:      "Contoh: Jaringan Kampus, Server Room, Lab Komputer",
    penggunaLabel: "Admin / Penanggung Jawab IT",
    penggunaPH:    "Contoh: Admin IT, Kepala Lab Komputer",
    docLabel:      "No. Dokumen Lisensi / Kontrak",
    docPH:         "Contoh: LIC-2025-001, KONTRAK-SW-001",
    refLabel:      "No. Referensi Vendor",
    refPH:         "Contoh: MSFT-ORDER-001, ADOBE-REF-2025",
  },
  atl: {
    namaLabel:     "Nama Aset Tetap Lainnya",
    namaPH:        "Contoh: Meja Kerja Direktur, Genset Perkins 20KVA",
    merkLabel:     "Merek / Tipe",
    merkPH:        "Contoh: Informa Executive, Perkins 20P, Herman Miller",
    specLabel:     "Spesifikasi / Dimensi",
    specPH:        "Contoh: 180×90×75cm, Kayu Jati Solid, Warna Coklat Tua",
    kodeBarangLabel:"Kode Inventaris",
    kodeBarangPH:  "Contoh: F001, ATL-INV-001",
    lokasiLabel:   "Lokasi / Ruangan",
    lokasiPH:      "Contoh: Ruang Direktur, Ruang Rapat Besar",
    penggunaLabel: "Penanggung Jawab",
    penggunaPH:    "Contoh: Sekretaris, Kepala TU, Staff Umum",
    docLabel:      "No. Dokumen BAP/Pengadaan",
    docPH:         "Contoh: DOK-ATL-001, BAP-2021-005",
    refLabel:      "No. Referensi",
    refPH:         "Contoh: REF-ATL-001",
  },
  al: {
    namaLabel:     "Nama Kendaraan",
    namaPH:        "Contoh: Toyota Avanza E 1.3L MT, Honda Beat CBS-ISS",
    merkLabel:     "Merek / Model Kendaraan",
    merkPH:        "Contoh: Toyota Avanza, Honda Beat, Daihatsu Xenia",
    specLabel:     "Spesifikasi Kendaraan",
    specPH:        "Contoh: 1.3L 5MT, Silver Metallic, 7 Seat, Bensin",
    kodeBarangLabel:"Kode Inventaris Kendaraan",
    kodeBarangPH:  "Contoh: KBM001, AL-INV-001",
    lokasiLabel:   "Pool / Lokasi Parkir",
    lokasiPH:      "Contoh: Pool Kendaraan, Garasi Utama Kampus",
    penggunaLabel: "Pengemudi / Penanggung Jawab",
    penggunaPH:    "Contoh: Pengemudi Dinas, Kurir Surat, Security",
    docLabel:      "No. Dokumen BAP/Pengadaan",
    docPH:         "Contoh: DOK-AL-001, BAP-KBM-2022",
    refLabel:      "No. Referensi",
    refPH:         "Contoh: REF-KBM-001",
  },
} as const;

type PageId = keyof typeof FORM_CTX;

// ── Empty defaults ────────────────────────────────────────────────────────────
const EMPTY: AsetFormData = {
  Nama_Barang:  "",
  Id_aset:      "",
  nup:          "",
  KodeGl:       "",
  KodeBarang:   "",
  KodeAkun:     "532111",
  KodeRKAT:     "",
  Dokumen:      "",
  Referensi:    "",
  MerkType:     "",
  Spesifikasi:  "",
  Nama_unit:    "Sekolah Vokasi",
  TahunBuku:    new Date().getFullYear().toString(),
  Tgl_pengadaan:"",
  TglPerolehan: "",
  HargaSatuan:  "",
  SumberDana:   "BOPTN",
  Masa_manfaat: "4 Tahun",
  Nama_ruangan: "",
  Pengguna:     "",
  Kondisi:      "Baik",
  Trx_status:   "Aktif",
  Keterangan:   "-",
  // Vehicle
  NoPolisi: "", JenisAngkutan: "Minibus", Model: "", NoRangka: "", NoMesin: "",
  NoBpkb: "", TglPembuatan: "", TglStnk: "", Pajak: "Dibayar", Bmi_bmn: "BMN",
  // Tag & PIC
  kode_tag_aset: "", nama_pic: "", unit_pic: "Sekolah Vokasi", kontak_pic: "",
  // Lokasi Detail
  nama_gedung: "", lantai_level: "", kode_ruangan: "", nama_ruangan_standar: "",
  kategori_ruangan: "Ruang Kerja", luas_ruangan_m2: "", kapasitas_orang_ruangan: "",
  latitude: "", longitude: "", referensi_denah: "",
  status_kejelasan_lokasi: "Jelas", status_penggunaan_aset: "Digunakan",
  // Opname
  tanggal_opname_terakhir: "", status_opname_terakhir: "Ditemukan",
  kondisi_fisik_opname_terakhir: "Baik", status_lokasi_opname_terakhir: "Sesuai",
  diverifikasi_oleh_terakhir: "", catatan_opname_terakhir: "",
  // Maintenance
  tanggal_maintenance_terakhir: "", jenis_maintenance_terakhir: "Preventif",
  kategori_kerusakan_terakhir: "-", tingkat_kerusakan_terakhir: "-",
  biaya_maintenance_terakhir: "", total_frekuensi_maintenance: "0",
  total_biaya_maintenance: "", downtime_terakhir_jam: "0",
  rata_rata_waktu_perbaikan_jam: "0", jadwal_maintenance_berikutnya: "",
  // Mutasi
  tanggal_mutasi_terakhir: "", status_mutasi_terakhir: "-", catatan_mutasi_terakhir: "",
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  open:          boolean;
  onClose:       () => void;
  initialData?:  Partial<AsetFormData>;
  onSave:        (data: AsetFormData) => void;
  mode:          "add" | "edit";
  assetType:     string;
  pageId?:       string;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function AsetModal({ open, onClose, initialData, onSave, mode, assetType, pageId }: Props) {
  const [form,   setForm]   = useState<AsetFormData>({ ...EMPTY });
  const [errors, setErrors] = useState<Partial<Record<keyof AsetFormData, string>>>({});

  const isAL = pageId === "al";
  const ctx  = FORM_CTX[(pageId as PageId) in FORM_CTX ? (pageId as PageId) : "pm"];

  useEffect(() => {
    if (open) {
      setForm(initialData ? { ...EMPTY, ...initialData } : { ...EMPTY });
      setErrors({});
    }
  }, [open, initialData]);

  const set = (k: keyof AsetFormData, v: string) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: undefined }));
  };

  const validate = () => {
    const e: Partial<Record<keyof AsetFormData, string>> = {};
    if (!form.Nama_Barang.trim())  e.Nama_Barang  = "Wajib diisi";
    if (!form.KodeGl.trim())       e.KodeGl       = "Wajib diisi — masukkan kode GL secara manual";
    if (!form.KodeBarang.trim())   e.KodeBarang   = "Wajib diisi";
    if (!form.TglPerolehan)        e.TglPerolehan = "Wajib diisi";
    if (!form.HargaSatuan.trim())  e.HargaSatuan  = "Wajib diisi";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  if (!open) return null;

  // ── Reusable field wrappers ──
  const Inp = ({
    label, field, type="text", req=false, placeholder="", note="",
  }: {
    label: string; field: keyof AsetFormData; type?: string;
    req?: boolean; placeholder?: string; note?: string;
  }) => (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5 leading-tight">
        {label}
        {req && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={(form[field] as string) ?? ""}
        onChange={e => set(field, e.target.value)}
        placeholder={placeholder}
        className={`w-full text-xs px-3 py-2 border rounded-lg outline-none focus:ring-1 focus:ring-[#6B7280] focus:border-[#6B7280] transition-colors ${
          errors[field] ? "border-red-400 bg-red-50/60" : "border-gray-200 bg-white"
        }`}
      />
      {errors[field] && (
        <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
          <AlertCircle size={9} /> {errors[field]}
        </p>
      )}
      {note && !errors[field] && <p className="text-[10px] text-gray-400 mt-1">{note}</p>}
    </div>
  );

  const Sel = ({
    label, field, options, req=false,
  }: {
    label: string; field: keyof AsetFormData; options: string[]; req?: boolean;
  }) => (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">{label}{req && <span className="text-red-500 ml-0.5">*</span>}</label>
      <select
        value={(form[field] as string) ?? ""}
        onChange={e => set(field, e.target.value)}
        className="w-full text-xs px-3 py-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-[#6B7280] bg-white"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  const SectionHead = ({ num, label, sub }: { num: number; label: string; sub?: string }) => (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-5 h-5 rounded bg-[#6B7280] text-white flex items-center justify-center text-[9px] font-black shrink-0">{num}</span>
      <div>
        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none">{label}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  const Divider = () => <div className="h-px bg-gray-100 my-6" />;

  let sectionNum = 1;
  const S = () => sectionNum++;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-gray-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed top-0 right-0 h-screen w-full sm:w-[580px] max-w-full bg-white shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {mode === "add" ? "Tambah" : "Edit"} — {assetType}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {mode === "add"
                ? "Isi seluruh informasi aset. Field bertanda * wajib diisi."
                : "Perbarui informasi aset yang dipilih."}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-0">

          {/* ═══════════════════════════════════════════════════════
              SEKSI 1 — Identitas & Kode Aset
              Semua field ini DIISI MANUAL oleh pengguna
          ═══════════════════════════════════════════════════════ */}
          <SectionHead num={S()} label="Identitas & Kode Aset" sub="Semua kode diisi manual — ID sistem akan di-generate otomatis" />

          {/* Nama Barang — full width, paling atas */}
          <Inp label={ctx.namaLabel} field="Nama_Barang" req placeholder={ctx.namaPH} />

          <div className="mt-3" />

          {/* KodeGl — baris sendiri, sangat penting */}
          <div className="rounded-lg border border-[#6B7280]/30 bg-[#6B7280]/5 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#6B7280]" />
              <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Kode GL — Wajib Diisi Manual</span>
            </div>
            <Inp
              label="Kode GL (General Ledger / Buku Besar)"
              field="KodeGl"
              req
              placeholder="Contoh: 132111, 133001, 134002"
              note="Kode akun buku besar sesuai Bagan Akun Standar (BAS) institusi"
            />
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Inp label={ctx.kodeBarangLabel} field="KodeBarang" req placeholder={ctx.kodeBarangPH} />
            <Inp label="ID_ASET / NUP" field="Id_aset" placeholder="Contoh: 94907" note="Nomor Urut Pendaftaran dari sistem BMN" />
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Inp label="Kode Akun" field="KodeAkun" placeholder="Contoh: 532111" />
            <Inp label="Kode RKAT" field="KodeRKAT" placeholder="Contoh: R1, R5, RKAT-2024" note="Kode Rencana Kerja Anggaran Tahunan" />
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Inp label="Tahun Buku" field="TahunBuku" placeholder="Contoh: 2024" />
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Inp label={ctx.docLabel} field="Dokumen" placeholder={ctx.docPH} />
            <Inp label={ctx.refLabel} field="Referensi" placeholder={ctx.refPH} />
          </div>

          <div className="mt-3">
            <Inp label="Unit / Departemen" field="Nama_unit" placeholder="Contoh: Sekolah Vokasi, Departemen Teknik" />
          </div>

          <Divider />

          {/* ═══════════════════════════════════════════════════════
              SEKSI 2 — Detail Barang
          ═══════════════════════════════════════════════════════ */}
          <SectionHead num={S()} label="Detail Barang / Aset" />

          <Inp label={ctx.merkLabel} field="MerkType" placeholder={ctx.merkPH} />
          <div className="mt-3">
            <Inp label={ctx.specLabel} field="Spesifikasi" placeholder={ctx.specPH} />
          </div>

          <Divider />

          {/* ═══════════════════════════════════════════════════════
              SEKSI 3 — Keuangan & Pengadaan
          ═══════════════════════════════════════════════════════ */}
          <SectionHead num={S()} label="Keuangan & Pengadaan" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Inp label="Tgl. Pengadaan / Pembelian" field="Tgl_pengadaan" type="date" />
            <Inp label="Tgl. Perolehan (Resmi)" field="TglPerolehan" type="date" req />
          </div>
          <div className="mt-3">
            <Inp
              label="Harga Satuan (Rp)"
              field="HargaSatuan"
              req
              placeholder="Contoh: 15000000 (tanpa titik/koma)"
              note="Masukkan angka saja. Penyusutan akan dihitung otomatis."
            />
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Sel label="Sumber Dana" field="SumberDana"
              options={["BOPTN","Mandiri","Hibah","APBN","APBD","Pinjaman","Dana Masyarakat"]} />
            <Sel label="Masa Manfaat (Tahun)" field="Masa_manfaat"
              options={["1 Tahun","2 Tahun","3 Tahun","4 Tahun","5 Tahun","8 Tahun","10 Tahun","20 Tahun","50 Tahun"]} />
          </div>

          <Divider />

          {/* ═══════════════════════════════════════════════════════
              SEKSI 4 — Data Kendaraan (AL only)
          ═══════════════════════════════════════════════════════ */}
          {isAL && (
            <>
              <SectionHead num={S()} label="Data Kendaraan" sub="Informasi spesifik kendaraan — STNK, BPKB, dan nomor kendaraan" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Inp label="No. Polisi" field="NoPolisi" placeholder="Contoh: F 1234 BC" />
                <Sel label="Jenis Angkutan" field="JenisAngkutan"
                  options={["Minibus","Sedan","MPV","SUV","Truk","Bus","Pickup","Sepeda Motor","Roda Tiga","Sepeda Listrik","Ambulan","Lainnya"]} />
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Inp label="Model Kendaraan" field="Model" placeholder="Contoh: Toyota Avanza E 1.3 MT" />
                <Sel label="BMI / BMN" field="Bmi_bmn" options={["BMN","Mandiri","Hibah","-"]} />
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Inp label="No. Rangka" field="NoRangka" placeholder="Contoh: MHKM5EA3JJK123456" />
                <Inp label="No. Mesin" field="NoMesin" placeholder="Contoh: 3SZE1234567" />
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Inp label="No. BPKB" field="NoBpkb" placeholder="Contoh: BK12345678" />
                <Inp label="Tgl. Pembuatan Kendaraan" field="TglPembuatan" type="date" />
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Inp label="Tgl. Berlaku STNK" field="TglStnk" type="date" />
                <Sel label="Status Pajak" field="Pajak" options={["Dibayar","Belum Dibayar","Dibebaskan","-"]} />
              </div>

              <Divider />
            </>
          )}

          {/* ═══════════════════════════════════════════════════════
              SEKSI 5 — Lokasi & Kondisi
          ═══════════════════════════════════════════════════════ */}
          <SectionHead num={S()} label="Lokasi & Kondisi Aset" />

          <Inp label={ctx.lokasiLabel} field="Nama_ruangan" placeholder={ctx.lokasiPH} />
          <div className="mt-3">
            <Inp label={ctx.penggunaLabel} field="Pengguna" placeholder={ctx.penggunaPH} />
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Sel label="Kondisi Fisik" field="Kondisi"
              options={["Baik","Rusak Ringan","Rusak Berat","Hilang"]} req />
            <Sel label="Status Aset" field="Trx_status"
              options={["Aktif","Perbaikan","Dihapus","Dipinjam"]} req />
          </div>
          <div className="mt-3">
            <Inp label="Keterangan / Catatan" field="Keterangan" placeholder="Catatan tambahan mengenai aset ini (opsional)" />
          </div>

          <Divider />

          {/* ═══════════════════════════════════════════════════════
              SEKSI 6 — Tag Aset & PIC
          ═══════════════════════════════════════════════════════ */}
          <SectionHead num={S()} label="Tag Aset & Penanggung Jawab (PIC)" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Inp label="Kode Tag Aset" field="kode_tag_aset" placeholder="Contoh: TAG-SV-0001" note="Kode barcode / QR label fisik aset" />
            <Inp label="Nama PIC" field="nama_pic" placeholder={ctx.penggunaPH} />
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Inp label="Unit PIC" field="unit_pic" placeholder="Contoh: Sekolah Vokasi" />
            <Inp label="Kontak PIC" field="kontak_pic" placeholder="Contoh: 08521234567" />
          </div>

          <Divider />

          {/* ═══════════════════════════════════════════════════════
              SEKSI 7 — Detail Lokasi / Denah
          ═══════════════════════════════════════════════════════ */}
          <SectionHead num={S()} label="Detail Lokasi & Denah" sub="Informasi gedung, ruangan, dan koordinat geografis" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Inp label="Nama Gedung" field="nama_gedung" placeholder="Contoh: Gedung A, Lab Terpadu" />
            <Inp label="Lantai / Level" field="lantai_level" placeholder="Contoh: Lantai 2, Basement" />
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Inp label="Kode Ruangan" field="kode_ruangan" placeholder="Contoh: KR-0001, A-201" />
            <Inp label="Nama Ruangan Standar" field="nama_ruangan_standar" placeholder={ctx.lokasiPH} />
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Sel label="Kategori Ruangan" field="kategori_ruangan"
              options={["Ruang Kelas","Lab Komputer","Lab Sains","Ruang Kerja","Ruang Rapat","Perpustakaan","Gudang","Server Room","Pantry","Area Parkir","Pool Kendaraan","Lainnya"]} />
            <Inp label="Luas Ruangan (m²)" field="luas_ruangan_m2" placeholder="Contoh: 60" />
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Inp label="Kapasitas Orang" field="kapasitas_orang_ruangan" placeholder="Contoh: 30" />
            <Inp label="Referensi Denah" field="referensi_denah" placeholder="Contoh: DENAH/GedA/L2" />
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Inp label="Latitude" field="latitude" placeholder="Contoh: -6.5597" />
            <Inp label="Longitude" field="longitude" placeholder="Contoh: 106.8040" />
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Sel label="Status Kejelasan Lokasi" field="status_kejelasan_lokasi" options={["Jelas","Tidak Jelas"]} />
            <Sel label="Status Penggunaan Aset" field="status_penggunaan_aset" options={["Digunakan","Tidak Digunakan","Dipinjam","Hilang"]} />
          </div>

          <Divider />

          {/* ═══════════════════════════════════════════════════════
              SEKSI 8 — Stock Opname Terakhir
          ═══════════════════════════════════════════════════════ */}
          <SectionHead num={S()} label="Stock Opname Terakhir" sub="Data hasil opname fisik aset terakhir yang dilakukan" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Inp label="Tanggal Opname" field="tanggal_opname_terakhir" type="date" />
            <Sel label="Status Temuan" field="status_opname_terakhir" options={["Ditemukan","Tidak Ditemukan","Belum Dicek"]} />
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Sel label="Kondisi Fisik (Saat Opname)" field="kondisi_fisik_opname_terakhir" options={["Baik","Rusak Ringan","Rusak Berat","Hilang"]} />
            <Sel label="Status Lokasi (Saat Opname)" field="status_lokasi_opname_terakhir" options={["Sesuai","Tidak Sesuai","Belum Dicek"]} />
          </div>
          <div className="mt-3">
            <Inp label="Diverifikasi Oleh" field="diverifikasi_oleh_terakhir" placeholder="Contoh: Tim Opname 2025, Kepala Unit" />
          </div>
          <div className="mt-3">
            <Inp label="Catatan Hasil Opname" field="catatan_opname_terakhir" placeholder="Catatan temuan saat opname (opsional)" />
          </div>

          <Divider />

          {/* ═══════════════════════════════════════════════════════
              SEKSI 9 — Maintenance / Perbaikan
          ═══════════════════════════════════════════════════════ */}
          <SectionHead num={S()} label="Maintenance / Perbaikan" sub="Riwayat dan jadwal perawatan / perbaikan aset" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Inp label="Tgl. Maintenance Terakhir" field="tanggal_maintenance_terakhir" type="date" />
            <Sel label="Jenis Maintenance" field="jenis_maintenance_terakhir" options={["Preventif","Korektif","Penggantian Komponen","Kalibrasi","Overhaul","-"]} />
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Sel label="Kategori Kerusakan" field="kategori_kerusakan_terakhir" options={["Mekanis","Elektrikal","Struktural","Perangkat Lunak","Estetika","Lainnya","-"]} />
            <Sel label="Tingkat Kerusakan" field="tingkat_kerusakan_terakhir" options={["Ringan","Sedang","Berat","-"]} />
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Inp label="Biaya Maintenance Terakhir (Rp)" field="biaya_maintenance_terakhir" placeholder="Contoh: 500000" />
            <Inp label="Total Frekuensi Maintenance" field="total_frekuensi_maintenance" placeholder="Contoh: 3" />
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Inp label="Total Biaya Maintenance (Rp)" field="total_biaya_maintenance" placeholder="Contoh: 1500000" />
            <Inp label="Downtime Terakhir (Jam)" field="downtime_terakhir_jam" placeholder="Contoh: 8" />
          </div>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Inp label="Rata-rata Waktu Perbaikan (Jam)" field="rata_rata_waktu_perbaikan_jam" placeholder="Contoh: 4" />
            <Inp label="Jadwal Maintenance Berikutnya" field="jadwal_maintenance_berikutnya" type="date" />
          </div>

          <Divider />

          {/* ═══════════════════════════════════════════════════════
              SEKSI 10 — Mutasi Aset
          ═══════════════════════════════════════════════════════ */}
          <SectionHead num={S()} label="Mutasi Aset" sub="Riwayat perpindahan / mutasi aset terakhir" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Inp label="Tanggal Mutasi Terakhir" field="tanggal_mutasi_terakhir" type="date" />
            <Sel label="Status Mutasi" field="status_mutasi_terakhir" options={["Selesai","Proses","-"]} />
          </div>
          <div className="mt-3">
            <Inp label="Catatan Mutasi" field="catatan_mutasi_terakhir" placeholder="Contoh: Dipindahkan dari Ruang A ke Ruang B (opsional)" />
          </div>

          {/* Spacer bawah */}
          <div className="h-4" />
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between shrink-0">
          <div className="text-xs text-gray-400">
            {Object.keys(errors).length > 0 && (
              <span className="text-red-500 flex items-center gap-1">
                <AlertCircle size={11} /> {Object.keys(errors).length} field belum diisi dengan benar
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              onClick={() => { if (validate()) onSave(form); }}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg transition-all hover:opacity-90 shadow-sm"
              style={{ backgroundColor: "#6B7280" }}
            >
              <Save size={14} />
              {mode === "add" ? "Simpan Data" : "Perbarui Data"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
