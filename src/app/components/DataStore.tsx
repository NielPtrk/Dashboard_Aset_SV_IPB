import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import apiClient from "../services/apiClient";
import { onEvent, connectSocket, disconnectSocket } from "../services/socketService";
import { SEED_RUANGAN } from "./ruanganSeed";

// ─────────────────────────────────────────────────────────────────────────────
// Types — single source of truth shapes.
// ─────────────────────────────────────────────────────────────────────────────

export type JenisAset = "PM" | "ATB" | "ATL" | "AL";

// Asset uses the existing Row shape from AsetDataTable — every extended field
// in the brief (kode_tag_aset, nama_pic, ..., catatan_mutasi_terakhir) is
// already present.
export type Asset = Record<string, string>;

export type StatusOpname =
  | "Terverifikasi"
  | "Belum Dicek"
  | "Selisih"
  | "Tidak Ditemukan"
  | "Perlu Verifikasi";

export type StatusMaintenance =
  | "Scheduled"
  | "Due Soon"
  | "Overdue"
  | "Dalam Proses"
  | "Selesai";

export type StatusMutasi =
  | "Draft"
  | "Menunggu Persetujuan"
  | "Disetujui"
  | "Ditolak"
  | "Selesai";

export type StatusPengadaan =
  | "Draft"
  | "Menunggu Persetujuan"
  | "Disetujui"
  | "Dalam Pengadaan"
  | "Selesai"
  | "Ditolak";

export type StatusKondisi =
  | "Baik"
  | "Perlu Monitoring"
  | "Rusak Ringan"
  | "Rusak Berat"
  | "Prioritas Penggantian";

export type DataQuality = "Lengkap" | "Perlu Verifikasi" | "Tidak Lengkap" | "Konflik Data";

export interface MaintenanceTicket {
  id: string;
  asset_id: string;
  tanggal: string;
  jenis: "Preventif" | "Korektif" | "Inspeksi";
  kategori_kerusakan: string;
  tingkat_kerusakan: "Ringan" | "Sedang" | "Berat" | "Kritis";
  biaya: number;
  downtime_jam: number;
  status: StatusMaintenance;
  catatan?: string;
  jadwal_berikutnya?: string;
}

export interface MutationRequest {
  id: string;
  nomor_mutasi?: string;
  asset_id: string;
  kode_aset?: string;
  nama_aset?: string;
  nup?: string;
  jenis?: string;
  tanggal: string;
  tgl_ajuan?: string;
  status: StatusMutasi;
  dari_gedung?: string;
  ke_gedung?: string;
  dari_ruangan: string;
  ke_ruangan: string;
  dari_pic: string;
  ke_pic: string;
  dari_unit?: string;
  ke_unit?: string;
  catatan?: string;
  pengaju?: string;
  approver?: string;
  catatan_approver?: string;
  tanggal_approval?: string;
  dokumen?: Array<{ nama: string; ukuran: string; url?: string }>;
  foto_bukti?: string;
  sumber?: "so" | "manual";
}

export interface ProcurementRequest {
  id: string;
  tanggal: string;
  nama_barang: string;
  jenis_aset: JenisAset;
  jumlah: number;
  estimasi_biaya: number;
  alasan: string;
  status: StatusPengadaan;
  asset_id_baru?: string; // when received, populated
}

export interface StockOpnameRecord {
  id: string;
  asset_id: string;
  kode_tag: string;
  tanggal: string;
  status_opname: string;
  kondisi_fisik: string;
  status_lokasi: string;
  diverifikasi_oleh: string;
  catatan?: string;
}

export interface DocumentRecord {
  id: string;
  nama: string;
  jenis: "Pengadaan" | "Perbaikan" | "Mutasi" | "Opname" | "Aset" | "Lainnya";
  asset_id?: string;
  transaction_id?: string;
  url: string;
  diunggah_oleh: string;
  tanggal: string;
}

export interface ActivityFieldDiff {
  field: string;
  label: string;
  oldVal: any;
  newVal: any;
}

export interface ActivityItemDetail {
  id?: string;
  kode?: string;
  nama?: string;
  kategori?: string;
  ruangan?: string;
  kondisi?: string;
  nilai?: string | number;
  volume?: number | string;
  satuan?: string;
  nup?: string;
  merek?: string;
  old_value?: any;
  new_value?: any;
  diffs?: ActivityFieldDiff[];
  snapshot?: Record<string, any>;
  keterangan?: string;
}

export interface ActivityLog {
  id: number;
  waktu: string; // HH:mm:ss
  tgl: string;   // yyyy-mm-dd
  pengguna: string;
  role: string;
  menu: string;
  aksi: string;
  target_type: string;
  target_id: string;
  field_changed?: string;
  old_value?: string;
  new_value?: string;
  diffs?: ActivityFieldDiff[];
  status: "Berhasil" | "Gagal" | "Berisiko";
  jenis: "login" | "logout" | "tambah" | "update" | "hapus" | "dokumen" | "mutasi" | "perbaikan" | "pengadaan" | "opname" | "sistem" | "gagal";
  ip?: string;
  device?: string;
  file_name?: string;
  items_count?: number;
  items_detail?: ActivityItemDetail[];
}

export type UserRole = "Admin Sistem" | "Pimpinan" | "Admin Pusat" | "Pekerja Stock Opname" | "Tanpa Role";
export type UserAccountStatus = "aktif" | "menunggu_verifikasi" | "menunggu_persetujuan" | "ditolak" | "nonaktif";

export interface UserRecord {
  id: string;
  username?: string;
  nama: string;
  role: UserRole;
  unit: string;
  email?: string;
  aktif: boolean;
  status: UserAccountStatus;
  nip?: string;
  jabatan?: string;
  harapan_role?: string;
  catatan_admin?: string;
  lastLogin?: string;
  must_change_password?: boolean;
}

export interface RuanganData {
  id: string;
  sourceId?: number | null;
  kampus: string;
  namaGedung: string;
  gedungRaw?: string | null;
  level: number;
  alamat?: string | null;
  kodeRuangan?: string | null;
  namaRuangan: string;
  kategori?: string | null;
  luas: number;
  kapasitas: number;
  unitPengguna?: string | null;
}

export interface ObservasiItem {
  id: string;
  ruanganId: string;
  kampus?: string;
  namaGedung?: string;
  kodeRuangan?: string;
  namaRuangan?: string;
  tahun: number;
  unitKerja?: string;
  noUrut: number;
  kodeBarang?: string;
  namaBarang: string;
  nup?: string;
  merekType?: string;
  tahunPerolehan?: string;
  hargaSatuan: number;
  volume: number;
  satuan?: string;
  jumlahHarga: number;
  sumberDana?: string;
  kondisi?: string;
  penguasaan?: string;
  keterangan?: string;
  petugas?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RoomRecord {
  kode_ruangan: string;
  nama_ruangan: string;
  nama_gedung: string;
  lantai_level: string;
  kategori: string;
  luas_m2: number;
  kapasitas: number;
}

export interface Filters {
  search: string;
  tahun: string;     // "semua" | "2024" | ...
  unit: string;
  kampus: string;
  gedung: string;
  lantai: string;
  ruangan: string;
  kategori: string; // kategori_ruangan etc
  jenis: string;    // PM/ATB/ATL/AL or "semua"
  kondisi: string;
  statusOpname: string;
  statusMaintenance: string;
  pic: string;
}

export const DEFAULT_FILTERS: Filters = {
  search: "",
  tahun: "semua",
  unit: "semua",
  kampus: "semua",
  gedung: "semua",
  lantai: "semua",
  ruangan: "semua",
  kategori: "semua",
  jenis: "semua",
  kondisi: "semua",
  statusOpname: "semua",
  statusMaintenance: "semua",
  pic: "semua",
};

// ─────────────────────────────────────────────────────────────────────────────
// Seed data factory (extracted from former AsetDataTable.tsx).
// ─────────────────────────────────────────────────────────────────────────────

const TODAY = "2026-06-01";
const GEDUNG_LIST = ["Gedung A", "Gedung B", "Gedung C", "Lab Terpadu", "Gedung Administrasi"];
const KAT_RUANGAN_LIST = ["Ruang Kelas", "Lab Komputer", "Ruang Kerja", "Ruang Rapat", "Lab Sains"];

const fmtRp = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

export function makeAsset(
  id: string,
  nama: string,
  merk: string,
  spec: string,
  kode: string,
  tglPerolehan: string,
  harga: number,
  sumber: string,
  kondisi: string,
  ruangan: string,
  pj: string,
  masaTahun: number,
  unit = "Sekolah Vokasi",
  tahun = "2023",
  extra: Partial<Asset> = {},
): Asset {
  const start = new Date(tglPerolehan);
  const end = new Date(TODAY);
  const months = Math.max(
    0,
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()),
  );
  const deprMonth = masaTahun > 0 ? Math.round(harga / (masaTahun * 12)) : 0;
  const totalDepr = Math.min(harga, deprMonth * months);
  const nilaiBook = Math.max(0, harga - totalDepr);
  const sisaMonths = Math.max(0, masaTahun * 12 - months);
  const seq = id.replace(/[^0-9]/g, "").padStart(4, "0").slice(-4);
  const trxStatus =
    kondisi === "Rusak Berat" ? "Dihapus" : kondisi === "Rusak Ringan" ? "Perbaikan" : "Aktif";
  const seqInt = parseInt(seq) || 1;
  const gedung = GEDUNG_LIST[(seqInt - 1) % GEDUNG_LIST.length];
  const lantaiN = ((seqInt - 1) % 3) + 1;
  const katR = KAT_RUANGAN_LIST[(seqInt - 1) % KAT_RUANGAN_LIST.length];
  const phone = `0852${String(200000000 + seqInt).slice(0, 8)}`;

  return {
    id,
    KodeGl: `132${seq.slice(-3)}`,
    Nama_unit: unit,
    Id: seq,
    Id_aset: `${10000 + parseInt(seq)}`,
    nup: `${10000 + parseInt(seq)}`,
    Trx_id_unit: "U01",
    Trx_tgl_update: TODAY,
    Trx_status: trxStatus,
    Cek: "Yes",
    Cek_unit: "Yes",
    TahunBuku: tahun,
    KodeAkun: "532111",
    KodeRKAT: `R${(parseInt(seq) % 9) + 1}`,
    Dokumen: `DOK-${id}`,
    Referensi: `REF-${id}`,
    Id_upload_bap: `BAP${100 + parseInt(seq)}`,
    Tgl_pengadaan: tglPerolehan,
    Tgl_transaksi: tglPerolehan,
    Spesifikasi: spec,
    MerkType: merk,
    TglPerolehan: tglPerolehan,
    HargaSatuan: fmtRp(harga),
    KodeBarang: kode,
    SumberDana: sumber,
    Kondisi: kondisi,
    Keterangan: "-",
    Export_tgl: TODAY,
    Export_user: "Admin",
    IsAdmin: "True",
    Id_ruangan: `R${100 + parseInt(seq)}`,
    Pengguna: pj,
    Id_iplan_aset: `IP${seq}`,
    Iplan_dokumen: "-",
    Url_thumb: "-",
    Id_unit: "U01",
    Tgl_update: TODAY,
    Nama_Barang: nama,
    Id_upload: `UPL${100 + parseInt(seq)}`,
    Url: "-",
    Kode: `K${seq}`,
    Nama_ruangan: ruangan,
    TipeAset: id.split("-")[0],
    Penyusutan_per_bulan: fmtRp(deprMonth),
    HargaDiterima: fmtRp(harga),
    Umur_tahun: Math.floor(months / 12).toString(),
    Umur_bulan: (months % 12).toString(),
    Masa_manfaat: `${masaTahun} Tahun`,
    Sisa_masa_manfaat: `${Math.floor(sisaMonths / 12)} Th ${sisaMonths % 12} Bln`,
    Jml_penyusutan: fmtRp(totalDepr),
    Akumulasi: fmtRp(totalDepr),
    NilaiBuku: fmtRp(nilaiBook),
    // numeric mirrors used by selectors (avoid re-parsing display strings)
    _harga_perolehan: String(harga),
    _nilai_buku: String(nilaiBook),
    _akumulasi_penyusutan: String(totalDepr),
    _penyusutan_per_bulan: String(deprMonth),
    _sisa_masa_manfaat_bulan: String(sisaMonths),
    _masa_manfaat_bulan: String(masaTahun * 12),
    Verifikasi_status: trxStatus === "Aktif" ? "Verified" : "Pending",
    NoPolisi: "-",
    JenisAngkutan: "-",
    Model: merk,
    NoRangka: "-",
    NoMesin: "-",
    NoBpkb: "-",
    TglPembuatan: "-",
    TglStnk: "-",
    Pajak: "-",
    Bmi_bmn: "-",
    Url_stnk: "-",
    Url_bpkb: "-",
    Url_status_penetapan: "-",
    Total_perbaikan: fmtRp(0),
    kode_tag_aset: `TAG-SV-${seq}`,
    nama_pic: pj,
    unit_pic: unit,
    kontak_pic: phone,
    tanggal_opname_terakhir: "2025-12-15",
    status_opname_terakhir: "Ditemukan",
    kondisi_fisik_opname_terakhir: kondisi,
    status_lokasi_opname_terakhir: "Sesuai",
    diverifikasi_oleh_terakhir: "Tim Opname 2025",
    catatan_opname_terakhir: "-",
    nama_gedung: gedung,
    lantai_level: `Lantai ${lantaiN}`,
    kode_ruangan: `KR-${seq}`,
    nama_ruangan_standar: ruangan,
    kategori_ruangan: katR,
    luas_ruangan_m2: String(20 + seqInt * 5),
    kapasitas_orang_ruangan: String(8 + seqInt * 2),
    latitude: "-6.5597",
    longitude: "106.8040",
    referensi_denah: `DENAH/${gedung.replace(/ /g, "-")}/L${lantaiN}`,
    status_kejelasan_lokasi: "Jelas",
    status_penggunaan_aset: kondisi === "Rusak Berat" ? "Tidak Digunakan" : "Digunakan",
    tanggal_maintenance_terakhir: kondisi !== "Baik" ? "2025-09-01" : "2026-01-15",
    jenis_maintenance_terakhir: "Preventif",
    kategori_kerusakan_terakhir:
      kondisi === "Rusak Ringan" ? "Mekanis" : kondisi === "Rusak Berat" ? "Struktural" : "-",
    tingkat_kerusakan_terakhir:
      kondisi === "Rusak Ringan" ? "Ringan" : kondisi === "Rusak Berat" ? "Berat" : "-",
    biaya_maintenance_terakhir: kondisi !== "Baik" ? fmtRp(250000 * seqInt) : fmtRp(0),
    total_frekuensi_maintenance: String(seqInt % 5),
    total_biaya_maintenance: fmtRp(250000 * seqInt * (seqInt % 5 || 1)),
    _total_biaya_maintenance: String(250000 * seqInt * (seqInt % 5 || 1)),
    downtime_terakhir_jam: kondisi !== "Baik" ? String(seqInt * 4) : "0",
    rata_rata_waktu_perbaikan_jam: kondisi !== "Baik" ? String(seqInt * 2) : "0",
    jadwal_maintenance_berikutnya: seqInt % 7 === 0 ? "2026-03-01" : "2026-12-01",
    tanggal_mutasi_terakhir: "-",
    status_mutasi_terakhir: "-",
    catatan_mutasi_terakhir: "-",
    ...extra,
  };
}

export const INITIAL_PM: Asset[] = [
  makeAsset("PM-001","Laptop Lenovo ThinkPad X1 Carbon","Lenovo ThinkPad X1","Intel i7-1165G7 16GB 512GB SSD","B001","2023-01-10",18500000,"BOPTN","Baik","Ruang Dosen A","Andi Pratama",4,"Teknik Informatika"),
  makeAsset("PM-002","Printer Epson L3150","Epson L3150","Print/Scan/Copy Color Ink Tank","B002","2022-06-15",3500000,"Mandiri","Baik","Ruang Admin","Budi Santoso",4,"Administrasi Umum"),
  makeAsset("PM-003","Server Dell PowerEdge T40","Dell PowerEdge T40","Xeon E-2224G 16GB ECC 1TB","B003","2021-03-20",25000000,"BOPTN","Rusak Ringan","Ruang Server","Andi Pratama",5,"Teknik Informatika"),
  makeAsset("PM-004","Proyektor Epson EB-X51","Epson EB-X51","3600 Lumens XGA HDMI","B004","2022-08-10",7500000,"BOPTN","Baik","Ruang Kelas 101","Citra Dewi",5,"Teknik Informatika"),
  makeAsset("PM-005","AC LG Dualcool 2 PK","LG LPNQ18GV3A","2 PK Inverter 18000 BTU","B005","2021-12-01",8500000,"Mandiri","Rusak Ringan","Lab Komputer","Dewi Rahayu",10,"Lab Komputer"),
  makeAsset("PM-006","Scanner Canon DR-C240","Canon DR-C240","ADF 60ppm USB3 A4 Flatbed","B006","2023-03-15",12000000,"BOPTN","Baik","Ruang Admin","Budi Santoso",4,"Administrasi Umum"),
  makeAsset("PM-007","UPS APC Back-UPS 1500VA","APC BX1500M-MS","1500VA 865W Auto-Shutdown","B007","2022-01-20",4500000,"Mandiri","Baik","Ruang Server","Andi Pratama",5,"Teknik Informatika"),
  makeAsset("PM-008","Monitor LG 27 inch 4K","LG 27UK850-W","27\" 4K UHD IPS HDR400 USB-C","B008","2023-07-05",6500000,"BOPTN","Baik","Ruang Dosen B","Eko Susanto",4,"Teknik Informatika"),
  makeAsset("PM-009","Oscilloscope Digital Rigol","Rigol DS1054Z","4CH 50MHz 1GSa/s 12Mpts","B009","2022-11-10",15000000,"Hibah","Baik","Lab Elektronika","Farid Hasan",5,"Lab Fisika"),
  makeAsset("PM-010","Kursi Ergonomis Herman Miller","Herman Miller Aeron","Size B Fully Adjustable","B010","2023-05-20",9800000,"BOPTN","Baik","Ruang Dosen A","Andi Pratama",5,"Teknik Informatika"),
  makeAsset("PM-011","Mesin Fotokopi Canon IR2625","Canon iR2625","25ppm A3/A4 Duplex Network","B011","2021-08-30",45000000,"BOPTN","Rusak Ringan","Ruang TU","Galih Saputra",8,"Administrasi Umum"),
  makeAsset("PM-012","Kamera DSLR Canon EOS 800D","Canon EOS 800D","24.2MP APS-C Wi-Fi Kit","B012","2022-04-12",8200000,"Mandiri","Baik","Lab Multimedia","Hendra Wijaya",4,"Ekowisata"),
  makeAsset("PM-013","Whiteboard 240x120 Magnetic","Sakana Premium Plus","240x120cm Magnetic","B013","2020-09-15",850000,"Mandiri","Baik","Ruang Kelas 201","Indah Permata",8,"Agribisnis",
    "2020", { status_kejelasan_lokasi: "Perlu Verifikasi", nama_pic: "" } as any),
  makeAsset("PM-014","Laptop ASUS VivoBook 15","ASUS VivoBook K513","Intel i5-1135G7 8GB 512GB","B014","2024-01-08",11500000,"BOPTN","Baik","Lab Komputer","Joko Widodo",4,"Lab Komputer"),
  makeAsset("PM-015","TV LED Samsung 65 inch","Samsung QA65Q60B","65\" QLED 4K Smart TV","B015","2023-10-25",12000000,"BOPTN","Baik","Ruang Rapat Besar","Kartika Sari",5,"Administrasi Umum"),
];

export const INITIAL_ATB: Asset[] = [
  makeAsset("ATB-001","Lisensi Microsoft 365 Business","Microsoft","Microsoft 365 Business Premium 50 User","SW001","2025-04-01",45000000,"BOPTN","Baik","Jaringan Kampus","Admin IT",1,"Teknik Informatika","2025"),
  makeAsset("ATB-002","Lisensi AutoCAD 2025","Autodesk","AutoCAD 2025 1 Seat Perpetual","SW002","2025-01-15",28000000,"BOPTN","Baik","Lab CAD","Irwan Fauzy",3,"Teknik Informatika","2025"),
  makeAsset("ATB-003","Lisensi SPSS Statistics 29","IBM","SPSS Statistics 29 Academic 5 User","SW003","2024-07-20",18000000,"BOPTN","Baik","Lab Statistik","Lena Marlina",3,"Agribisnis","2024"),
  makeAsset("ATB-004","Adobe Creative Cloud Teams","Adobe","Creative Cloud All Apps 10 User","SW004","2025-03-10",24000000,"Mandiri","Baik","Lab Multimedia","Hendra Wijaya",1,"Ekowisata","2025"),
  makeAsset("ATB-005","Antivirus Kaspersky Endpoint","Kaspersky Lab","Endpoint Security for Business 50PC","SW005","2024-06-01",8500000,"BOPTN","Baik","Jaringan Kampus","Admin IT",1,"Teknik Informatika","2024"),
  makeAsset("ATB-006","Turnitin Institutional License","Turnitin LLC","Institutional License 500/yr","SW006","2025-01-01",32000000,"BOPTN","Baik","Perpustakaan","Mira Agustina",1,"Administrasi Umum","2025"),
  makeAsset("ATB-007","Software ERP Accounting","Accurate Online","Accurate Online Professional 5 User","SW007","2023-08-15",12000000,"Mandiri","Baik","Ruang Keuangan","Nanda Saputri",4,"Administrasi Umum","2023"),
  makeAsset("ATB-008","Platform LMS Moodle Premium","Moodle HQ","Moodle Premium Hosting 500 User","SW008","2024-09-01",15000000,"BOPTN","Rusak Ringan","Server Room","Admin IT",2,"Teknik Informatika","2024"),
];

export const INITIAL_ATL: Asset[] = [
  makeAsset("ATL-001","Meja Kerja Direktur","Informa Executive","180x90x75cm Kayu Jati","F001","2021-04-10",8500000,"Mandiri","Baik","Ruang Direktur","Sekretaris",10,"Administrasi Umum","2021"),
  makeAsset("ATL-002","Lemari Arsip Besi 4 Laci","Brother Metal","Filing Cabinet 4 Drawer","F002","2022-02-20",3200000,"Mandiri","Baik","Ruang TU","Staff TU",8,"Administrasi Umum","2022"),
  makeAsset("ATL-003","Filling Cabinet Lateral","Bisley Multidrawer","10 Laci A4 Metal","F003","2020-11-05",5600000,"BOPTN","Rusak Ringan","Ruang Arsip","Kepala TU",8,"Administrasi Umum","2020"),
  makeAsset("ATL-004","Meja Rapat Oval 12 Kursi","Olymplast Meeting Table","300x120cm Oval","F004","2021-07-15",15000000,"BOPTN","Baik","Ruang Rapat","Staff Umum",10,"Administrasi Umum","2021"),
  makeAsset("ATL-005","Genset Perkins 20KVA","Perkins 20P","Diesel Generator 20KVA","F005","2020-03-28",85000000,"BOPTN","Baik","Ruang Genset","Teknisi",10,"Administrasi Umum","2020"),
  makeAsset("ATL-006","Rak Server Open Frame 42U","APC NetShelter SX","42U 600mm x 1070mm","F006","2022-09-12",18000000,"BOPTN","Baik","Ruang Server","Admin IT",10,"Teknik Informatika","2022"),
  makeAsset("ATL-007","Partisi Kantor Full Panel","Cubicle System","Panel H=1500mm L=3600mm","F007","2021-01-20",12500000,"Mandiri","Baik","Ruang Kerja Open","Staff Umum",8,"Administrasi Umum","2021"),
  makeAsset("ATL-008","Kulkas Kantor 2 Pintu","Sharp SJ-ID320","2 Pintu 275L No Frost","F008","2023-06-30",4200000,"Mandiri","Baik","Pantry Kantor","Staff Umum",8,"Administrasi Umum","2023"),
];

export const INITIAL_AL: Asset[] = [
  makeAsset("AL-001","Toyota Avanza E 1.3L MT","Toyota Avanza","1.3L 5MT 7 Seat","KBM001","2022-03-10",280000000,"BOPTN","Baik","Pool Kendaraan","Pengemudi Dinas",8,"Administrasi Umum","2022",
    { NoPolisi: "F 1234 BC", JenisAngkutan: "Minibus", Model: "Toyota Avanza E", NoRangka: "MHKM5EA3JJK123456", NoMesin: "3SZE1234567", NoBpkb: "BK12345678", TglPembuatan: "2022-01-15", TglStnk: "2027-03-10", Pajak: "Dibayar", Bmi_bmn: "BMN" }),
  makeAsset("AL-002","Honda Beat CBS-ISS 2021","Honda Beat","110cc CBS-ISS FI","SPM001","2021-06-20",17500000,"Mandiri","Baik","Pool Kendaraan","Kurir Surat",8,"Administrasi Umum","2021",
    { NoPolisi: "F 5678 CD", JenisAngkutan: "Sepeda Motor", Model: "Honda Beat CBS-ISS", NoRangka: "MH1JFP117MK100001", NoMesin: "JFP1E1100001", NoBpkb: "BK87654321", TglPembuatan: "2021-04-10", TglStnk: "2026-06-20", Pajak: "Dibayar", Bmi_bmn: "BMN" }),
  makeAsset("AL-003","Toyota Innova Reborn G 2.0","Toyota Innova","2.0L G AT 7 Seat","KBM002","2023-05-15",425000000,"BOPTN","Baik","Pool Kendaraan","Pengemudi Pimpinan",8,"Administrasi Umum","2023",
    { NoPolisi: "F 9012 EF", JenisAngkutan: "Minibus", Model: "Toyota Innova Reborn", NoRangka: "MHFXW8EM1P1234567", NoMesin: "2GD1234567", NoBpkb: "BK11223344", TglPembuatan: "2023-03-01", TglStnk: "2028-05-15", Pajak: "Dibayar", Bmi_bmn: "BMN" }),
  makeAsset("AL-004","Daihatsu Xenia 1.3 R DLX","Daihatsu Xenia","1.3L R DLX MT 7 Seat","KBM003","2021-09-08",225000000,"Mandiri","Rusak Ringan","Pool Kendaraan","Pengemudi Dinas",8,"Administrasi Umum","2021",
    { NoPolisi: "F 3456 GH", JenisAngkutan: "Minibus", Model: "Daihatsu Xenia 1.3", NoRangka: "MHKV5EA3MJK234567", NoMesin: "3SZ234567", NoBpkb: "BK55667788", TglPembuatan: "2021-07-20", TglStnk: "2026-09-08", Pajak: "Dibayar", Bmi_bmn: "BMN" }),
  makeAsset("AL-005","Motor Viar Karya 200","Viar Karya 200","200cc Roda Tiga","R3-001","2022-11-25",28000000,"BOPTN","Baik","Gudang Logistik","Staff Logistik",8,"Administrasi Umum","2022",
    { NoPolisi: "F 7890 IJ", JenisAngkutan: "Roda Tiga", Model: "Viar Karya 200", NoRangka: "MH8KA200NCK300001", NoMesin: "KA200300001", NoBpkb: "BK99001122", TglPembuatan: "2022-09-10", TglStnk: "2027-11-25", Pajak: "Dibayar", Bmi_bmn: "BMN" }),
  makeAsset("AL-006","Sepeda Listrik United TX7","United TX7","Sepeda Listrik 350W","SPD-001","2024-02-14",8500000,"Mandiri","Baik","Area Kampus","Security",5,"Administrasi Umum","2024",
    { NoPolisi: "-", JenisAngkutan: "Sepeda Listrik", Model: "United TX7", NoRangka: "TX7240001", NoMesin: "-", NoBpkb: "-", TglPembuatan: "2024-01-10", TglStnk: "-", Pajak: "-", Bmi_bmn: "Mandiri" }),
];

const GENERATED_ASSET_BLUEPRINTS: Record<JenisAset, Array<{ nama: string; merk: string; spec: string; kode: string; masa: number; baseHarga: number }>> = {
  PM: [
    { nama: "Laptop Operasional", merk: "Lenovo ThinkPad E14", spec: "Intel i5 16GB 512GB SSD", kode: "NB", masa: 4, baseHarga: 14250000 },
    { nama: "Printer Layanan", merk: "Epson EcoTank L4260", spec: "Print Scan Copy WiFi Duplex", kode: "PRN", masa: 4, baseHarga: 4850000 },
    { nama: "Proyektor Kelas", merk: "Epson EB-E500", spec: "XGA 3600 Lumens HDMI", kode: "PRJ", masa: 5, baseHarga: 7200000 },
    { nama: "Access Point", merk: "Ubiquiti UniFi U6+", spec: "WiFi 6 Dual Band PoE", kode: "NET", masa: 5, baseHarga: 2350000 },
  ],
  ATB: [
    { nama: "Lisensi Produktivitas", merk: "Microsoft 365", spec: "Business Standard Annual", kode: "SW", masa: 1, baseHarga: 2150000 },
    { nama: "Lisensi Desain", merk: "Adobe Creative Cloud", spec: "All Apps Education Annual", kode: "SWD", masa: 1, baseHarga: 7850000 },
    { nama: "Sistem Informasi", merk: "Aset SV Module", spec: "Subscription Modul Inventaris", kode: "APP", masa: 3, baseHarga: 18500000 },
    { nama: "Antivirus Endpoint", merk: "ESET Endpoint", spec: "Endpoint Security Annual", kode: "SEC", masa: 1, baseHarga: 875000 },
  ],
  ATL: [
    { nama: "Meja Kerja Staff", merk: "Olympic Office", spec: "120x60cm engineered wood", kode: "FUR", masa: 8, baseHarga: 1850000 },
    { nama: "Kursi Ergonomis", merk: "Savello Vergo", spec: "Mesh back adjustable armrest", kode: "CHR", masa: 5, baseHarga: 1650000 },
    { nama: "Lemari Arsip", merk: "Brother Metal", spec: "Filing cabinet 4 drawer", kode: "CAB", masa: 8, baseHarga: 3250000 },
    { nama: "Whiteboard Kelas", merk: "Sakura", spec: "Magnetic porcelain 240x120cm", kode: "WBD", masa: 5, baseHarga: 1450000 },
  ],
  AL: [
    { nama: "Sepeda Motor Operasional", merk: "Honda Vario 160", spec: "160cc CBS ISS", kode: "MTR", masa: 8, baseHarga: 28500000 },
    { nama: "Kendaraan Angkut Ringan", merk: "Daihatsu Gran Max", spec: "1.5L Pick Up AC PS", kode: "CAR", masa: 8, baseHarga: 168000000 },
    { nama: "Mobil Operasional", merk: "Toyota Avanza", spec: "1.5G CVT 7 Seat", kode: "CAR", masa: 8, baseHarga: 258000000 },
    { nama: "Mobil Listrik Kampus", merk: "Wuling Air EV", spec: "Long Range Campus Mobility", kode: "EV", masa: 8, baseHarga: 295000000 },
  ],
};

function generateAccumulatedAssets(): Asset[] {
  const units = ["Teknik Informatika", "Administrasi Umum", "Lab Komputer", "Program Vokasi", "Pusat Layanan Akademik", "Keuangan dan SDM", "UPT Bahasa", "Laboratorium Terpadu"];
  const rooms = ["Ruang Dosen A", "Ruang Admin", "Lab Komputer", "Ruang Kelas 101", "Gudang Aset", "Ruang Rapat", "Pool Kendaraan", "Studio Multimedia"];
  const pics = ["Andi Pratama", "Budi Santoso", "Citra Dewi", "Dewi Rahayu", "Joko Widodo", "Rina Maharani", "Anita Wijaya", "Irwan Fauzy"];
  const funds = ["BOPTN", "Mandiri", "Hibah", "PNBP"];
  const conditions = ["Baik", "Baik", "Baik", "Perlu Monitoring", "Rusak Ringan", "Rusak Berat"];
  const years = ["2021", "2022", "2023", "2024", "2025", "2026"];
  const out: Asset[] = [];

  (["PM", "ATB", "ATL", "AL"] as JenisAset[]).forEach((jenis) => {
    const offset = jenis === "PM" ? INITIAL_PM.length : jenis === "ATB" ? INITIAL_ATB.length : jenis === "ATL" ? INITIAL_ATL.length : INITIAL_AL.length;
    for (let i = 1; i <= 50; i += 1) {
      const blueprint = GENERATED_ASSET_BLUEPRINTS[jenis][(i - 1) % GENERATED_ASSET_BLUEPRINTS[jenis].length];
      const seq = offset + i;
      const globalSeq = jenis === "PM" ? 1000 + i : jenis === "ATB" ? 2000 + i : jenis === "ATL" ? 3000 + i : 4000 + i;
      const tahun = years[(i - 1) % years.length];
      const month = String(((i - 1) % 12) + 1).padStart(2, "0");
      const day = String(((i * 7) % 27) + 1).padStart(2, "0");
      const kondisi = conditions[(i + (jenis === "AL" ? 2 : 0)) % conditions.length];
      const harga = blueprint.baseHarga + (i % 10) * Math.round(blueprint.baseHarga * 0.035);
      const id = `${jenis}-${String(seq).padStart(3, "0")}`;
      out.push(makeAsset(
        id,
        `${blueprint.nama} ${String(i).padStart(2, "0")}`,
        blueprint.merk,
        blueprint.spec,
        `${blueprint.kode}${String(globalSeq).padStart(4, "0")}`,
        `${tahun}-${month}-${day}`,
        harga,
        funds[(i - 1) % funds.length],
        kondisi,
        rooms[(i - 1) % rooms.length],
        pics[(i - 1) % pics.length],
        blueprint.masa,
        units[(i - 1) % units.length],
        tahun,
        {
          Dokumen: `DOK-AKUM-${jenis}-${String(i).padStart(3, "0")}`,
          Referensi: `AKUM/${jenis}/${tahun}/${String(i).padStart(3, "0")}`,
          tanggal_opname_terakhir: i % 9 === 0 ? "-" : `2026-${month}-${day}`,
          status_opname_terakhir: i % 13 === 0 ? "Tidak Ditemukan" : i % 9 === 0 ? "Belum Dicek" : "Ditemukan",
          status_lokasi_opname_terakhir: i % 11 === 0 ? "Tidak Sesuai" : "Sesuai",
          status_kejelasan_lokasi: i % 11 === 0 ? "Perlu Verifikasi" : "Jelas",
          status_penggunaan_aset: kondisi === "Rusak Berat" || i % 17 === 0 ? "Tidak Digunakan" : "Digunakan",
          NoPolisi: jenis === "AL" ? `F ${7000 + i} SV` : "-",
          JenisAngkutan: jenis === "AL" ? (blueprint.kode === "MTR" ? "Sepeda Motor" : "Mobil") : "-",
          Model: blueprint.merk,
        },
      ));
    }
  });
  return out;
}

const SEED_ASSETS: Asset[] = [...INITIAL_PM, ...INITIAL_ATB, ...INITIAL_ATL, ...INITIAL_AL, ...generateAccumulatedAssets()];
const SEED_ASSET_COUNT = SEED_ASSETS.length;

const SEED_USERS: UserRecord[] = [
  {
    id: "U-001",
    username: "Admin Sistem",
    nama: "Admin Sistem",
    role: "Admin Sistem",
    unit: "Sekolah Vokasi (SV)",
    aktif: true,
    status: "aktif",
    jabatan: "Admin Sistem",
    lastLogin: "Hari ini",
  },
];

const SEED_MAINTENANCE: MaintenanceTicket[] = [];

const SEED_MUTASI: MutationRequest[] = [];

const SEED_PROCUREMENT: ProcurementRequest[] = [
  { id: "PGD-2026-001", tanggal: "2026-04-10", nama_barang: "Laptop Lenovo ThinkPad E14", jenis_aset: "PM", jumlah: 5, estimasi_biaya: 75000000, alasan: "Penggantian aset PM-003 yang sering rusak.", status: "Disetujui" },
  { id: "PGD-2026-002", tanggal: "2026-05-05", nama_barang: "Lisensi Microsoft 365 Tambahan", jenis_aset: "ATB", jumlah: 1, estimasi_biaya: 12000000, alasan: "Ekspansi kebutuhan staff baru.", status: "Menunggu Persetujuan" },
];

const SEED_OPNAME: StockOpnameRecord[] = SEED_ASSETS.slice(0, 8).map((a, i) => ({
  id: `SO-2025-${String(i + 1).padStart(3, "0")}`,
  asset_id: a.id,
  kode_tag: a.kode_tag_aset,
  tanggal: "2025-12-15",
  status_opname: "Terverifikasi",
  kondisi_fisik: a.Kondisi,
  status_lokasi: "Sesuai",
  diverifikasi_oleh: "Tim Opname 2025",
}));

const SEED_DOCUMENTS: DocumentRecord[] = [
  { id: "DOC-001", nama: "BAP Pengadaan 2026", jenis: "Pengadaan", transaction_id: "PGD-2026-001", url: "#", diunggah_oleh: "Othniel Patrick Limbong", tanggal: "2026-04-10" },
  { id: "DOC-002", nama: "Faktur Servis PM-003", jenis: "Perbaikan", asset_id: "PM-003", transaction_id: "PRB-2026-001", url: "#", diunggah_oleh: "Othniel Patrick Limbong", tanggal: "2025-09-01" },
];

const SEED_ROOMS: RoomRecord[] = (() => {
  const seen = new Set<string>();
  const out: RoomRecord[] = [];
  for (const a of SEED_ASSETS) {
    if (seen.has(a.kode_ruangan)) continue;
    seen.add(a.kode_ruangan);
    out.push({
      kode_ruangan: a.kode_ruangan,
      nama_ruangan: a.nama_ruangan_standar || a.Nama_ruangan,
      nama_gedung: a.nama_gedung,
      lantai_level: a.lantai_level,
      kategori: a.kategori_ruangan,
      luas_m2: parseInt(a.luas_ruangan_m2) || 0,
      kapasitas: parseInt(a.kapasitas_orang_ruangan) || 0,
    });
  }
  return out;
})();

const SEED_ACTIVITY: ActivityLog[] = [
  {
    id: 1,
    waktu: "08:15:30",
    tgl: new Date().toISOString().slice(0, 10),
    pengguna: "Othniel Patrick Limbong",
    role: "Admin Sistem",
    menu: "Sistem",
    aksi: "Login ke sistem Dashboard Aset SV IPB",
    target_type: "Sistem",
    target_id: "-",
    status: "Berhasil",
    jenis: "login",
    ip: "10.0.1.45",
    device: "Chrome (Windows)",
  },
  {
    id: 2,
    waktu: "08:45:12",
    tgl: new Date().toISOString().slice(0, 10),
    pengguna: "Othniel Patrick Limbong",
    role: "Admin Sistem",
    menu: "Data Aset",
    aksi: "Menambahkan aset PM-014 (ASUS VivoBook 14X OLED K3405)",
    target_type: "Asset",
    target_id: "PM-014",
    status: "Berhasil",
    jenis: "tambah",
    ip: "10.0.1.67",
    device: "Firefox (Windows)",
    items_count: 1,
    items_detail: [
      {
        id: "PM-014",
        kode: "PM-014",
        nama: "ASUS VivoBook 14X OLED K3405",
        kategori: "Peralatan & Mesin (PM)",
        ruangan: "Lab Komputer 01 (Gedung SV)",
        kondisi: "Baik",
        nilai: 14500000,
        nup: "1",
        merek: "ASUS",
        snapshot: {
          id: "PM-014",
          Nama_Barang: "ASUS VivoBook 14X OLED K3405",
          Nama_ruangan: "Lab Komputer 01 (Gedung SV)",
          Kondisi: "Baik",
          _nilai_buku: "14500000",
          _harga_perolehan: "14500000",
          TglPerolehan: "2026-02-15",
          Pengguna: "Dr. Ir. Aceng Hidayat, M.T.",
        },
      },
    ],
  },
  {
    id: 3,
    waktu: "09:30:15",
    tgl: new Date().toISOString().slice(0, 10),
    pengguna: "Othniel Patrick Limbong",
    role: "Admin Sistem",
    menu: "Data Aset",
    aksi: "Upload Excel 3 baris ke Peralatan & Mesin (PM) — File: template-pm.xlsx",
    target_type: "Kategori",
    target_id: "PM",
    file_name: "template-pm.xlsx",
    status: "Berhasil",
    jenis: "tambah",
    ip: "10.0.1.45",
    device: "Chrome (Windows)",
    items_count: 3,
    items_detail: [
      {
        id: "PM-001",
        kode: "3020102001",
        nama: "PC Workstation Dell Precision 3660",
        kategori: "Peralatan & Mesin (PM)",
        ruangan: "Lab Multimedia Gedung SV",
        kondisi: "Baik",
        nilai: 28500000,
        nup: "001",
        merek: "Dell Precision",
      },
      {
        id: "PM-002",
        kode: "3020102002",
        nama: "Proyektor Laser Epson EB-L520U",
        kategori: "Peralatan & Mesin (PM)",
        ruangan: "Auditorium Delta",
        kondisi: "Baik",
        nilai: 18200000,
        nup: "002",
        merek: "Epson",
      },
      {
        id: "PM-003",
        kode: "3020102003",
        nama: "Mini Bus Operasional Kampus",
        kategori: "Alat Angkutan (AL)",
        ruangan: "Pool Kendaraan Kampus",
        kondisi: "Baik",
        nilai: 320000000,
        nup: "003",
        merek: "Toyota HiAce",
      },
    ],
  },
  {
    id: 4,
    waktu: "10:05:40",
    tgl: new Date().toISOString().slice(0, 10),
    pengguna: "Othniel Patrick Limbong",
    role: "Admin Sistem",
    menu: "Data Aset",
    aksi: "Memperbarui aset PM-002 (PC Desktop Dell OptiPlex 7080) — Perubahan kondisi fisik",
    target_type: "Asset",
    target_id: "PM-002",
    field_changed: "Kondisi, Lokasi / Ruangan",
    old_value: "Kondisi: Baik; Ruangan: Lab Komputer A",
    new_value: "Kondisi: Rusak Ringan; Ruangan: Ruang Perbaikan",
    diffs: [
      { field: "Kondisi", label: "Kondisi Fisik", oldVal: "Baik", newVal: "Rusak Ringan" },
      { field: "Nama_ruangan", label: "Lokasi Ruangan", oldVal: "Lab Komputer A", newVal: "Ruang Perbaikan Gedung SV" },
    ],
    items_count: 1,
    items_detail: [
      {
        id: "PM-002",
        kode: "PM-002",
        nama: "PC Desktop Dell OptiPlex 7080 MT",
        kategori: "Peralatan & Mesin (PM)",
        ruangan: "Ruang Perbaikan Gedung SV",
        kondisi: "Rusak Ringan",
        nilai: 18500000,
        diffs: [
          { field: "Kondisi", label: "Kondisi Fisik", oldVal: "Baik", newVal: "Rusak Ringan" },
          { field: "Nama_ruangan", label: "Lokasi Ruangan", oldVal: "Lab Komputer A", newVal: "Ruang Perbaikan Gedung SV" },
        ],
        snapshot: {
          id: "PM-002",
          Nama_Barang: "PC Desktop Dell OptiPlex 7080 MT",
          Nama_ruangan: "Ruang Perbaikan Gedung SV",
          Kondisi: "Rusak Ringan",
          _nilai_buku: "18500000",
        },
      },
    ],
    status: "Berhasil",
    jenis: "update",
    ip: "10.0.1.92",
    device: "Chrome (Windows)",
  },
];

const ACTIVITY_STORAGE_KEY = "sv_ipb_activity_logs_v1";

function getClientDeviceInfo(): { ip: string; device: string } {
  let device = "Desktop (Web)";
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent || "";
    if (/mobile/i.test(ua)) device = "Mobile Web";
    else if (/tablet|ipad/i.test(ua)) device = "Tablet Web";
    else if (/windows/i.test(ua)) device = "Chrome (Windows)";
    else if (/macintosh|mac os x/i.test(ua)) device = "Safari (macOS)";
    else if (/linux/i.test(ua)) device = "Chrome (Linux)";
  }
  return {
    ip: "127.0.0.1",
    device,
  };
}

function loadStoredActivityLogs(): ActivityLog[] {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(ACTIVITY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Replace legacy "Salgado Ginting" log entries with active profile name
          return parsed.map((item: ActivityLog) => {
            if (item.pengguna === "Salgado Ginting") {
              return { ...item, pengguna: "Othniel Patrick Limbong" };
            }
            return item;
          });
        }
      }
    }
  } catch {
    // ignore
  }
  return SEED_ACTIVITY;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status / quality rules — single source of truth for badge logic.
// ─────────────────────────────────────────────────────────────────────────────

function n(s: string | undefined): number {
  if (!s) return 0;
  const v = parseInt(String(s).replace(/[^0-9-]/g, ""));
  return isNaN(v) ? 0 : v;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (isNaN(da) || isNaN(db)) return 0;
  return Math.round((db - da) / (1000 * 60 * 60 * 24));
}

export function getOpnameStatus(a: Asset): StatusOpname {
  if (!a.tanggal_opname_terakhir || a.tanggal_opname_terakhir === "-") return "Belum Dicek";
  if (a.status_opname_terakhir === "Hilang" || a.status_opname_terakhir === "Tidak Ditemukan") return "Tidak Ditemukan";
  if (a.status_lokasi_opname_terakhir === "Tidak Sesuai" || a.status_lokasi_opname_terakhir === "Berbeda") return "Selisih";
  if (a.status_kejelasan_lokasi === "Tidak Jelas" || a.status_kejelasan_lokasi === "Perlu Verifikasi") return "Perlu Verifikasi";
  if (a.status_opname_terakhir === "Ditemukan" || a.status_opname_terakhir === "Terverifikasi") return "Terverifikasi";
  return "Perlu Verifikasi";
}

export function getMaintenanceStatus(a: Asset): StatusMaintenance {
  if (!a.jadwal_maintenance_berikutnya || a.jadwal_maintenance_berikutnya === "-") return "Scheduled";
  const diff = daysBetween(TODAY, a.jadwal_maintenance_berikutnya);
  if (diff < 0) return "Overdue";
  if (diff <= 30) return "Due Soon";
  return "Scheduled";
}

export function getKondisiSistem(a: Asset): StatusKondisi {
  const sisaBulan = n(a._sisa_masa_manfaat_bulan);
  const totalFreq = n(a.total_frekuensi_maintenance);
  const totalBiaya = n(a._total_biaya_maintenance);
  const tingkat = a.tingkat_kerusakan_terakhir;
  const kondisi = a.Kondisi;

  if (tingkat === "Berat" || tingkat === "Kritis" || kondisi === "Rusak Berat") {
    if (sisaBulan <= 0 && totalBiaya > 5000000) return "Prioritas Penggantian";
    return "Rusak Berat";
  }
  if (kondisi === "Rusak Ringan" || tingkat === "Ringan") return "Rusak Ringan";
  if (sisaBulan <= 12 || totalFreq >= 3) return "Perlu Monitoring";
  return "Baik";
}

export function getDataQuality(a: Asset): DataQuality {
  // Konflik
  if (a.status_opname_terakhir === "Hilang" && a.status_penggunaan_aset === "Digunakan") return "Konflik Data";
  if (a.kondisi_fisik_opname_terakhir === "Rusak Berat" && a.Kondisi === "Baik") return "Konflik Data";
  if (a.status_lokasi_opname_terakhir === "Tidak Sesuai" && a.status_kejelasan_lokasi === "Jelas") return "Konflik Data";
  if (n(a._total_biaya_maintenance) < n(a.biaya_maintenance_terakhir)) return "Konflik Data";
  if (a.latitude && !a.longitude) return "Konflik Data";

  // Tidak Lengkap
  const required = [a.id, a.Nama_Barang, a.Nama_unit, a._nilai_buku, a.TglPerolehan];
  if (required.some((v) => !v || v === "-")) return "Tidak Lengkap";

  // Perlu Verifikasi
  if (
    !a.nama_pic ||
    a.status_kejelasan_lokasi === "Tidak Jelas" ||
    a.status_kejelasan_lokasi === "Perlu Verifikasi" ||
    !a.tanggal_opname_terakhir ||
    a.tanggal_opname_terakhir === "-" ||
    getMaintenanceStatus(a) === "Overdue"
  ) return "Perlu Verifikasi";

  return "Lengkap";
}

export function computeConditionScore(a: Asset): number {
  // 0–100, higher = better
  let score = 100;
  if (a.Kondisi === "Rusak Ringan") score -= 25;
  if (a.Kondisi === "Rusak Berat") score -= 60;
  if (a.kondisi_fisik_opname_terakhir === "Rusak Ringan") score -= 5;
  if (a.kondisi_fisik_opname_terakhir === "Rusak Berat") score -= 15;
  const sisaBulan = n(a._sisa_masa_manfaat_bulan);
  const masaBulan = n(a._masa_manfaat_bulan) || 1;
  const sisaPct = sisaBulan / masaBulan;
  if (sisaPct < 0.25) score -= 15;
  if (sisaPct <= 0) score -= 20;
  score -= Math.min(20, n(a.total_frekuensi_maintenance) * 4);
  score -= Math.min(15, Math.floor(n(a._total_biaya_maintenance) / 5_000_000) * 3);
  if (a.tingkat_kerusakan_terakhir === "Berat") score -= 15;
  if (a.tingkat_kerusakan_terakhir === "Kritis") score -= 25;
  score -= Math.min(10, Math.floor(n(a.downtime_terakhir_jam) / 24) * 5);
  return Math.max(0, Math.min(100, score));
}

export function computeReplacementPriority(a: Asset): number {
  // 0–100, higher = should replace sooner
  let s = 0;
  const sisaBulan = n(a._sisa_masa_manfaat_bulan);
  if (sisaBulan <= 0) s += 35;
  else if (sisaBulan <= 6) s += 25;
  else if (sisaBulan <= 12) s += 12;

  if (a.Kondisi === "Rusak Berat") s += 25;
  else if (a.Kondisi === "Rusak Ringan") s += 10;

  s += Math.min(20, n(a.total_frekuensi_maintenance) * 5);
  s += Math.min(15, Math.floor(n(a._total_biaya_maintenance) / 2_500_000) * 3);
  if (n(a.downtime_terakhir_jam) >= 24) s += 5;

  // unecnomical: nilai buku ≤ 5% harga perolehan
  if (n(a._harga_perolehan) > 0 && n(a._nilai_buku) / n(a._harga_perolehan) < 0.05) s += 5;
  return Math.min(100, s);
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

export interface NavigationIntent {
  page: string;
  payload?: Record<string, unknown>;
}

interface DataStoreContextType {
  // collections
  assets: Asset[];
  maintenanceTickets: MaintenanceTicket[];
  mutationRequests: MutationRequest[];
  procurementRequests: ProcurementRequest[];
  stockOpnameRecords: StockOpnameRecord[];
  documents: DocumentRecord[];
  activityLogs: ActivityLog[];
  users: UserRecord[];
  rooms: RoomRecord[];
  ruangan: RuanganData[];
  observasiItems: ObservasiItem[];
  fetchMutasi: () => Promise<void>;
  fetchRuangan: () => Promise<void>;
  fetchObservasi: (tahun?: number) => Promise<void>;
  getGedungList: (kampus?: string) => string[];
  getRuanganList: (gedung?: string) => RuanganData[];
  createRuangan: (payload: Partial<RuanganData>, opts?: { user?: string }) => Promise<RuanganData>;
  updateRuangan: (id: string, payload: Partial<RuanganData>, opts?: { user?: string }) => Promise<RuanganData>;
  deleteRuangan: (id: string, opts?: { user?: string }) => Promise<void>;
  deleteGedung: (namaGedung: string, kampus?: string, opts?: { user?: string }) => Promise<void>;
  saveRoomObservasi: (
    ruanganId: string,
    tahun: number,
    payload: {
      kampus?: string;
      namaGedung?: string;
      kodeRuangan?: string;
      namaRuangan?: string;
      unitKerja?: string;
      petugas?: string;
      items: Partial<ObservasiItem>[];
      isUpload?: boolean;
    },
  ) => Promise<ObservasiItem[]>;
  deleteRoomObservasi: (ruanganId: string, tahun: number, opts?: { user?: string; namaRuangan?: string; namaGedung?: string; kampus?: string }) => Promise<void>;
  syncObservasiWithBmn: (observasiItemId: string, bmnAssetId: string, opts?: { user?: string }) => Promise<void>;
  getObservasiForRoom: (ruanganId: string, tahun?: number) => ObservasiItem[];
  getObservasiSummary: (tahun?: number) => {
    totalRuangan: number;
    sudahDiobservasi: number;
    belumDiobservasi: number;
    totalItem: number;
    totalNilai: number;
    pct: number;
  };

  // selection + filters
  selectedAssetId: string | null;
  setSelectedAssetId: (id: string | null) => void;
  filters: Filters;
  setFilters: (next: Partial<Filters>) => void;
  resetFilters: () => void;

  // navigation intent — pages read this to react to cross-module clicks
  pendingNav: NavigationIntent | null;
  navigateTo: (page: string, payload?: Record<string, unknown>) => void;
  consumePendingNav: () => NavigationIntent | null;

  // selectors
  getAssetById: (id: string) => Asset | undefined;
  getAssetByTag: (tag: string) => Asset | undefined;
  getAssetsByJenis: (jenis: JenisAset) => Asset[];
  getAssetsByUnit: (unit: string) => Asset[];
  getAssetsByRoom: (kodeRuangan: string) => Asset[];
  getAssetsByPIC: (pic: string) => Asset[];
  filteredAssets: Asset[];

  // computed metrics
  computeTotalAssets: () => number;
  computeTotalBookValue: () => number;
  computeTotalAcquisitionValue: () => number;
  computeTotalDepreciation: () => number;
  computeStockOpnameProgress: () => { done: number; total: number; pct: number };
  computeMissingAssets: () => number;
  computeUnverifiedAssets: () => number;
  computeAssetsWithoutClearLocation: () => number;
  computeAssetsWithoutPIC: () => number;
  computeMaintenanceOverdue: () => number;
  computeTopUnits: (limit?: number) => { unit: string; value: number }[];
  computeTopMaintenanceCost: (limit?: number) => { unit: string; biaya: number; freq: number }[];
  computeKondisiBreakdown: () => { label: StatusKondisi; value: number }[];

  computeProcurementNeed: () => Asset[];
  computeReplacementCandidates: (limit?: number) => Asset[];

  currentUser: UserRecord | null;
  setCurrentUser: (u: UserRecord | null) => void;
  clearSession: () => void;
  addUser: (payload: { username: string; password?: string; role?: UserRole; unit?: string; jabatan?: string }) => Promise<UserRecord>;
  updateUser: (id: string, updates: Partial<UserRecord>) => Promise<UserRecord>;
  updateUserRole: (id: string, newRole: UserRole) => Promise<UserRecord>;
  revokeUserRole: (id: string) => Promise<UserRecord>;
  approveUser: (id: string, action: "setujui" | "tolak", role?: UserRole, catatan?: string) => Promise<UserRecord>;
  resetUserPassword: (id: string, temporaryPassword?: string) => Promise<{ message: string; username: string; password: string }>;
  deleteUser: (id: string) => Promise<void>;
  fetchUsers: () => Promise<void>;

  // mutations (record activity automatically)
  upsertAsset: (a: Asset, opts?: { reason?: string; user?: string }) => void;
  insertBulkAssets: (assets: Asset[], opts?: { user?: string; categoryLabel?: string; fileName?: string; skipLog?: boolean }) => Promise<void>;
  deleteAsset: (id: string, opts?: { user?: string }) => void;
  recordStockOpname: (asset_id: string, partial: Partial<Asset>, opts?: { user?: string; skipLog?: boolean }) => void;
  revertStockOpname: (asset_id: string, opts?: { user?: string; skipLog?: boolean }) => void;
  completeMaintenance: (ticket: MaintenanceTicket, opts?: { user?: string }) => void;
  createMutation: (payload: Partial<MutationRequest>, opts?: { user?: string }) => Promise<MutationRequest | undefined>;
  approveMutation: (id: string, opts?: { user?: string; catatan?: string }) => Promise<void>;
  rejectMutation: (id: string, opts?: { user?: string; catatan?: string }) => Promise<void>;
  cancelMutation: (id: string, opts?: { user?: string }) => Promise<void>;
  completeProcurement: (id: string, newAsset?: Asset, opts?: { user?: string }) => void;
  uploadDocument: (doc: DocumentRecord, opts?: { user?: string }) => void;
  appendActivity: (log: Omit<ActivityLog, "id" | "waktu" | "tgl">) => void;
}

const DataStoreContext = createContext<DataStoreContextType | null>(null);

export function useDataStore(): DataStoreContextType {
  const ctx = useContext(DataStoreContext);
  if (!ctx) throw new Error("useDataStore must be used within DataStoreProvider");
  return ctx;
}

function nowParts() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    waktu: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
    tgl: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
  };
}

const USERS_STORAGE_KEY = "sv_ipb_users_v2";

function loadStoredUsers(): UserRecord[] {
  try {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem(USERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const dummyEmails = [
            "rina@ipb.ac.id", "budi@ipb.ac.id", "anita@ipb.ac.id", "rudi@ipb.ac.id",
            "rina.m@apps.ipb.ac.id", "budis@apps.ipb.ac.id", "anita.w@apps.ipb.ac.id", "rudih@ipb.ac.id"
          ];
          const dummyNames = ["Rina Maharani", "Budi Santoso", "Anita Wijaya", "Dr. Rudi Hartono"];
          const cleaned = parsed.filter(
            (u: any) => !dummyEmails.includes(u.email?.toLowerCase?.()) && !dummyNames.includes(u.nama)
          );
          if (cleaned.length > 0) {
            const hasAdmin = cleaned.some(
              (u: any) =>
                u.username === "Admin Sistem" ||
                u.role === "Admin Sistem"
            );
            if (!hasAdmin) cleaned.unshift(SEED_USERS[0]);
            return cleaned;
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return SEED_USERS;
}

function getInitialCurrentUser(): UserRecord | null {
  if (typeof localStorage !== "undefined") {
    const hasToken = !!localStorage.getItem("access_token");
    const isLoggedOut = localStorage.getItem("user_logged_out") === "true";
    if (hasToken && !isLoggedOut) {
      try {
        const saved = localStorage.getItem("current_user");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && (parsed.username || parsed.nama)) {
            const displayName = parsed.username || parsed.nama;
            return {
              id: parsed.id || "U-001",
              username: displayName,
              nama: displayName,
              role: (parsed.role as UserRole) || "Admin Sistem",
              unit: parsed.unit || "Sekolah Vokasi (SV)",
              jabatan: parsed.jabatan,
              aktif: parsed.aktif ?? true,
              status: parsed.status || "aktif",
              must_change_password: !!parsed.must_change_password,
            };
          }
        }
      } catch {
        // ignore
      }
    }
  }
  return null;
}

const CURRENT_USER = { nama: "Pengguna", role: "Admin Sistem" as UserRole };

export function DataStoreProvider({ children }: { children: React.ReactNode }) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [maintenanceTickets, setMaintenanceTickets] = useState<MaintenanceTicket[]>([]);
  const [mutationRequests, setMutationRequests] = useState<MutationRequest[]>([]);
  const [procurementRequests, setProcurementRequests] = useState<ProcurementRequest[]>([]);
  const [stockOpnameRecords, setStockOpnameRecords] = useState<StockOpnameRecord[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => loadStoredActivityLogs());
  const [users, setUsers] = useState<UserRecord[]>(() => loadStoredUsers());
  const [currentUser, setCurrentUserState] = useState<UserRecord | null>(() => getInitialCurrentUser());
  const [rooms] = useState<RoomRecord[]>(SEED_ROOMS);
  const [ruangan, setRuangan] = useState<RuanganData[]>(SEED_RUANGAN);
  const [observasiItems, setObservasiItems] = useState<ObservasiItem[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<Filters>(DEFAULT_FILTERS);
  const [pendingNav, setPendingNav] = useState<NavigationIntent | null>(null);

  const setCurrentUser = useCallback((u: UserRecord | null) => {
    setCurrentUserState(u);
    if (u) {
      localStorage.setItem("current_user", JSON.stringify(u));
    } else {
      localStorage.removeItem("current_user");
    }
  }, []);

  const clearSession = useCallback(() => {
    setCurrentUserState(null);
    setAssets([]);
    setMaintenanceTickets([]);
    setMutationRequests([]);
    setProcurementRequests([]);
    setStockOpnameRecords([]);
    setDocuments([]);
    setObservasiItems([]);
  }, []);

  useEffect(() => {
    const handleAuthReset = () => {
      clearSession();
    };
    window.addEventListener("auth:logout", handleAuthReset);
    window.addEventListener("auth:session_expired", handleAuthReset);
    return () => {
      window.removeEventListener("auth:logout", handleAuthReset);
      window.removeEventListener("auth:session_expired", handleAuthReset);
    };
  }, [clearSession]);

  const fetchUsers = useCallback(async () => {
    if (!localStorage.getItem("access_token")) return;
    try {
      const res = await apiClient.get<{ data: any[]; total: number }>("/users", { params: { limit: 500 } });
      if (Array.isArray(res.data?.data)) {
        const dummyEmails = [
          "rina@ipb.ac.id", "budi@ipb.ac.id", "anita@ipb.ac.id", "rudi@ipb.ac.id",
          "rina.m@apps.ipb.ac.id", "budis@apps.ipb.ac.id", "anita.w@apps.ipb.ac.id", "rudih@ipb.ac.id"
        ];
        const cleaned: UserRecord[] = res.data.data
          .filter((u: any) => !dummyEmails.includes(u.email?.toLowerCase?.() ?? ""))
          .map((u: any) => {
            const displayName = u.username || u.nama || "Pengguna";
            return {
              id: String(u.id),
              username: displayName,
              nama: displayName,
              email: u.email || "",
              role: (u.role || "Tanpa Role") as UserRole,
              unit: u.unit || "Sekolah Vokasi (SV)",
              aktif: Boolean(u.aktif),
              status: (u.status || "aktif") as UserAccountStatus,
              nip: u.nip || "",
              jabatan: u.jabatan || "",
              harapan_role: u.harapan_role || "",
              catatan_admin: u.catatan_admin || "",
              lastLogin: u.last_login ? new Date(u.last_login).toLocaleString("id-ID") : (u.lastLogin || "—"),
              must_change_password: Boolean(u.must_change_password),
            };
          });

        setUsers((prev) => {
          const backendIds = new Set(cleaned.map((u) => u.id));
          const localOnly = prev.filter((u) => !backendIds.has(u.id));
          const merged = [...cleaned, ...localOnly];
          const hasAdmin = merged.some(
            (u) =>
              u.username === "Admin Sistem" ||
              u.role === "Admin Sistem"
          );
          if (!hasAdmin) merged.unshift(SEED_USERS[0]);
          return merged;
        });
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(cleaned));
      }
    } catch {
      // ignore — offline, fallback to localStorage
    }
  }, []);

  const addUser = useCallback(async (payload: { username: string; password?: string; role?: UserRole; unit?: string; jabatan?: string }): Promise<UserRecord> => {
    const normUsername = payload.username.trim().replace(/\s+/g, " ");
    const newUser: UserRecord = {
      id: `U-${Date.now()}`,
      username: normUsername,
      nama: normUsername,
      role: payload.role || "Pekerja Stock Opname",
      unit: payload.unit || "Sekolah Vokasi (SV)",
      aktif: true,
      status: "aktif",
      jabatan: payload.jabatan,
      must_change_password: false,
    };
    try {
      const res = await apiClient.post<any>("/users", {
        username: normUsername,
        nama: normUsername,
        role: newUser.role,
        unit: newUser.unit,
        jabatan: newUser.jabatan,
        password: payload.password,
      });
      if (res.data) {
        newUser.id = String(res.data.id || newUser.id);
        newUser.username = res.data.username || newUser.username;
        newUser.nama = res.data.nama || newUser.nama;
      }
    } catch (err: any) {
      if (err.response?.data?.message) {
        throw new Error(err.response.data.message);
      }
      throw err;
    }
    setUsers((prev) => {
      const updated = [...prev, newUser];
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    return newUser;
  }, []);

  const updateUser = useCallback(async (id: string, updates: Partial<UserRecord>): Promise<UserRecord> => {
    let merged: UserRecord | undefined;
    if (updates.username && !updates.nama) {
      updates.nama = updates.username;
    }
    setUsers((prev) => {
      const updated = prev.map((u) => {
        if (u.id !== id) return u;
        merged = { ...u, ...updates };
        return merged;
      });
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    try {
      await apiClient.patch(`/users/${id}`, updates);
    } catch (err: any) {
      if (err.response?.data?.message) {
        throw new Error(err.response.data.message);
      }
      throw err;
    }
    return merged!;
  }, []);

  const updateUserRole = useCallback(async (id: string, newRole: UserRole): Promise<UserRecord> => {
    let merged: UserRecord | undefined;
    setUsers((prev) => {
      const updated = prev.map((u) => {
        if (u.id !== id) return u;
        if (u.username === "Admin Sistem" || u.role === "Admin Sistem") return u; // anti-lockout
        merged = { ...u, role: newRole };
        return merged;
      });
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    try {
      await apiClient.patch(`/users/${id}/role`, { role: newRole });
    } catch (err: any) {
      if (err.response?.data?.message) {
        throw new Error(err.response.data.message);
      }
      throw err;
    }
    return merged!;
  }, []);

  const revokeUserRole = useCallback(async (id: string): Promise<UserRecord> => {
    return updateUserRole(id, "Tanpa Role");
  }, [updateUserRole]);

  const approveUser = useCallback(async (id: string, action: "setujui" | "tolak", role?: UserRole, catatan?: string): Promise<UserRecord> => {
    let merged: UserRecord | undefined;
    setUsers((prev) => {
      const updated = prev.map((u) => {
        if (u.id !== id) return u;
        if (action === "setujui") {
          merged = { ...u, status: "aktif", aktif: true, role: role || u.role, catatan_admin: catatan };
        } else {
          merged = { ...u, status: "ditolak", aktif: false, role: "Tanpa Role", catatan_admin: catatan };
        }
        return merged;
      });
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    try {
      await apiClient.patch(`/users/${id}/approve`, { action, role, catatan });
    } catch {
      // ignore
    }
    return merged!;
  }, []);

  const resetUserPassword = useCallback(async (id: string, temporaryPassword?: string): Promise<{ message: string; username: string; password: string }> => {
    const res = await apiClient.patch<{ message: string; username: string; password: string }>(`/users/${id}/reset-password`, {
      password: temporaryPassword,
    });
    return res.data;
  }, []);

  const deleteUser = useCallback(async (id: string): Promise<void> => {
    setUsers((prev) => {
      const updated = prev.filter(
        (u) =>
          u.id !== id &&
          u.username !== "Admin Sistem" &&
          u.role !== "Admin Sistem"
      );
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    try {
      await apiClient.delete(`/users/${id}`);
    } catch (err: any) {
      if (err.response?.data?.message) {
        throw new Error(err.response.data.message);
      }
      throw err;
    }
  }, []);
  const fetchRuangan = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: RuanganData[] }>("/ruangan", { params: { limit: 99999 } });
      if (Array.isArray(res.data?.data)) {
        setRuangan(res.data.data);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchObservasi = useCallback(async (tahun?: number) => {
    try {
      const res = await apiClient.get<{ data: ObservasiItem[] }>("/observasi", {
        params: { limit: 99999, ...(tahun ? { tahun } : {}) },
      });
      if (Array.isArray(res.data?.data)) {
        setObservasiItems(res.data.data);
      }
    } catch {
      // ignore
    }
  }, []);

  const appendActivity = useCallback((log: Omit<ActivityLog, "id" | "waktu" | "tgl"> & { id?: number; waktu?: string; tgl?: string }) => {
    const t = nowParts();
    const dev = getClientDeviceInfo();
    const newEntry: ActivityLog = {
      id: log.id || Date.now() + Math.floor(Math.random() * 1000),
      waktu: log.waktu || t.waktu,
      tgl: log.tgl || t.tgl,
      pengguna: log.pengguna || CURRENT_USER.nama,
      role: log.role || CURRENT_USER.role,
      status: log.status || "Berhasil",
      jenis: log.jenis || "tambah",
      ip: log.ip || dev.ip,
      device: log.device || dev.device,
      target_type: log.target_type || "-",
      target_id: log.target_id || "-",
      ...log,
    };
    setActivityLogs((prev) => {
      const updated = [newEntry, ...prev];
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(updated.slice(0, 1000)));
        }
      } catch (err) {
        console.warn("Failed to persist activity log to localStorage:", err);
      }
      return updated;
    });

    apiClient.post("/aktivitas", newEntry).catch(() => {
      // Offline fallback
    });
  }, []);

  const getGedungList = useCallback(
    (kampus?: string) => {
      const filtered = kampus && kampus !== "Semua" ? ruangan.filter((r) => r.kampus === kampus) : ruangan;
      const set = new Set(filtered.map((r) => r.namaGedung));
      return Array.from(set).sort();
    },
    [ruangan],
  );

  const createRuangan = useCallback(
    async (payload: Partial<RuanganData>, opts?: { user?: string }) => {
      const user = opts?.user || CURRENT_USER.nama;
      try {
        const res = await apiClient.post<RuanganData>("/ruangan", payload);
        const created = res.data;
        setRuangan((prev) => {
          const exists = prev.some((r) => r.id === created.id);
          return exists ? prev.map((r) => (r.id === created.id ? created : r)) : [...prev, created];
        });
        appendActivity({
          pengguna: user,
          role: "Admin Sistem",
          menu: "Lokasi & Ruangan",
          aksi: `Menambahkan ruangan ${created.namaRuangan} di ${created.namaGedung} (${created.kampus})`,
          target_type: "Ruangan",
          target_id: String(created.id),
          status: "Berhasil",
          jenis: "tambah",
        });
        return created;
      } catch {
        // Fallback local creation
        const newId = `R-LOCAL-${Date.now()}`;
        const created: RuanganData = {
          id: newId,
          sourceId: Date.now() % 100000,
          kampus: payload.kampus || "Belum Dikategorikan",
          namaGedung: payload.namaGedung || "Gedung Baru",
          gedungRaw: payload.gedungRaw || payload.namaGedung || "Gedung Baru",
          level: Number(payload.level) || 1,
          alamat: payload.alamat || "",
          kodeRuangan: payload.kodeRuangan || "",
          namaRuangan: payload.namaRuangan || "Ruangan Baru",
          kategori: payload.kategori || "Lainnya",
          luas: Number(payload.luas) || 0,
          kapasitas: Number(payload.kapasitas) || 0,
          unitPengguna: payload.unitPengguna || "",
        };
        setRuangan((prev) => [...prev, created]);
        appendActivity({
          pengguna: user,
          role: "Admin Sistem",
          menu: "Lokasi & Ruangan",
          aksi: `Menambahkan ruangan ${created.namaRuangan} di ${created.namaGedung} (${created.kampus})`,
          target_type: "Ruangan",
          target_id: newId,
          status: "Berhasil",
          jenis: "tambah",
        });
        return created;
      }
    },
    [appendActivity],
  );

  const updateRuangan = useCallback(
    async (id: string, payload: Partial<RuanganData>, opts?: { user?: string }) => {
      const user = opts?.user || CURRENT_USER.nama;
      try {
        const res = await apiClient.patch<RuanganData>(`/ruangan/${id}`, payload);
        const updated = res.data;
        setRuangan((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
        appendActivity({
          pengguna: user,
          role: "Admin Sistem",
          menu: "Lokasi & Ruangan",
          aksi: `Memperbarui data ruangan ${updated.namaRuangan || id}`,
          target_type: "Ruangan",
          target_id: id,
          status: "Berhasil",
          jenis: "edit",
        });
        return updated;
      } catch {
        let updatedItem: RuanganData | undefined;
        setRuangan((prev) =>
          prev.map((r) => {
            if (r.id === id) {
              updatedItem = { ...r, ...payload };
              return updatedItem;
            }
            return r;
          }),
        );
        appendActivity({
          pengguna: user,
          role: "Admin Sistem",
          menu: "Lokasi & Ruangan",
          aksi: `Memperbarui data ruangan ${payload.namaRuangan || id}`,
          target_type: "Ruangan",
          target_id: id,
          status: "Berhasil",
          jenis: "edit",
        });
        return updatedItem || (payload as RuanganData);
      }
    },
    [appendActivity],
  );

  const deleteRuangan = useCallback(
    async (id: string, opts?: { user?: string }) => {
      const user = opts?.user || CURRENT_USER.nama;
      const target = ruangan.find((r) => r.id === id);
      const roomName = target ? target.namaRuangan : id;
      const targetSourceId = target?.sourceId ? String(target.sourceId) : "";
      const normTarget = target?.namaRuangan ? target.namaRuangan.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^r(uang)?/g, "").trim() : "";

      // Safe unbind of linked assets -> move to "Aset Tanpa Lokasi"
      let unlinkedCount = 0;
      setAssets((prevAssets) =>
        prevAssets.map((a) => {
          const aId = String(a.Id_ruangan || a.id_ruangan || "").trim().toLowerCase();
          const aName = String(a.Nama_ruangan || a.nama_ruangan || "").trim();
          const aNorm = aName.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^r(uang)?/g, "").trim();

          const isMatch =
            (id && aId === id.toLowerCase()) ||
            (targetSourceId && aId === targetSourceId.toLowerCase()) ||
            (target && aName.toLowerCase() === target.namaRuangan.toLowerCase()) ||
            (normTarget && aNorm === normTarget);

          if (isMatch) {
            unlinkedCount++;
            return {
              ...a,
              Id_ruangan: "",
              id_ruangan: "",
              Nama_ruangan: "",
              nama_ruangan: "",
              nama_ruangan_standar: "",
              kode_ruangan: "",
              nama_gedung: "",
              gedung: "",
            };
          }
          return a;
        }),
      );

      try {
        await apiClient.delete(`/ruangan/${id}`);
      } catch {
        // ignore
      }

      setRuangan((prev) => prev.filter((r) => r.id !== id));

      appendActivity({
        pengguna: user,
        role: "Admin Sistem",
        menu: "Lokasi & Ruangan",
        aksi: `Menghapus ruangan ${roomName} (${target?.namaGedung || "Gedung"}) - ${unlinkedCount} aset dialihkan ke Aset Tanpa Lokasi`,
        target_type: "Ruangan",
        target_id: id,
        status: "Berhasil",
        jenis: "hapus",
      });
    },
    [ruangan, appendActivity],
  );

  const deleteGedung = useCallback(
    async (namaGedung: string, kampus?: string, opts?: { user?: string }) => {
      const user = opts?.user || CURRENT_USER.nama;
      const roomsToDelete = ruangan.filter(
        (r) => r.namaGedung === namaGedung && (!kampus || r.kampus === kampus),
      );
      const roomIds = new Set(roomsToDelete.map((r) => r.id.toLowerCase()));
      const sourceIds = new Set(roomsToDelete.filter((r) => r.sourceId).map((r) => String(r.sourceId).toLowerCase()));
      const roomNames = new Set(roomsToDelete.map((r) => r.namaRuangan.toLowerCase().trim()));

      // Safe unbind of linked assets -> move to "Aset Tanpa Lokasi"
      let unlinkedCount = 0;
      setAssets((prevAssets) =>
        prevAssets.map((a) => {
          const aId = String(a.Id_ruangan || a.id_ruangan || "").trim().toLowerCase();
          const aName = String(a.Nama_ruangan || a.nama_ruangan || "").trim().toLowerCase();
          const aGedung = String(a.nama_gedung || a.gedung || "").trim().toLowerCase();

          const isMatch =
            (aId && (roomIds.has(aId) || sourceIds.has(aId))) ||
            (aName && roomNames.has(aName)) ||
            (aGedung && aGedung === namaGedung.toLowerCase());

          if (isMatch) {
            unlinkedCount++;
            return {
              ...a,
              Id_ruangan: "",
              id_ruangan: "",
              Nama_ruangan: "",
              nama_ruangan: "",
              nama_ruangan_standar: "",
              kode_ruangan: "",
              nama_gedung: "",
              gedung: "",
            };
          }
          return a;
        }),
      );

      try {
        await apiClient.delete(`/ruangan/gedung/${encodeURIComponent(namaGedung)}`, {
          params: kampus ? { kampus } : {},
        });
      } catch {
        // ignore
      }

      setRuangan((prev) =>
        prev.filter((r) => !(r.namaGedung === namaGedung && (!kampus || r.kampus === kampus))),
      );

      appendActivity({
        pengguna: user,
        role: "Admin Sistem",
        menu: "Lokasi & Ruangan",
        aksi: `Menghapus gedung ${namaGedung} (${roomsToDelete.length} ruangan) - ${unlinkedCount} aset dialihkan ke Aset Tanpa Lokasi`,
        target_type: "Gedung",
        target_id: namaGedung,
        status: "Berhasil",
        jenis: "hapus",
      });
    },
    [ruangan, appendActivity],
  );

  const getRuanganList = useCallback(
    (gedung?: string) => {
      if (!gedung || gedung === "Semua") return ruangan;
      return ruangan.filter((r) => r.namaGedung === gedung);
    },
    [ruangan],
  );

  // Seed Fallback has been removed.

  // ── API bridge — silently hydrate from NestJS when backend is reachable ─────
  // ONLY runs when an authenticated user session exists.
  useEffect(() => {
    if (!currentUser || !localStorage.getItem("access_token")) {
      return;
    }
    let cancelled = false;
    async function hydrate() {
      try {
        const [
          assetsRes,
          maintenanceRes,
          mutasiRes,
          pengadaanRes,
          opnameRes,
          dokumenRes,
          aktivitasRes,
          ruanganRes,
          observasiRes,
        ] = await Promise.all([
          apiClient.get<{ data: Asset[] }>("/assets", { params: { limit: 99999 } }).catch(() => ({ data: { data: [] } })),
          apiClient.get<{ data: MaintenanceTicket[] }>("/maintenance", { params: { limit: 99999 } }).catch(() => ({ data: { data: [] } })),
          apiClient.get<{ data: MutationRequest[] }>("/mutasi", { params: { limit: 99999 } }).catch(() => ({ data: { data: [] } })),
          apiClient.get<{ data: ProcurementRequest[] }>("/pengadaan", { params: { limit: 99999 } }).catch(() => ({ data: { data: [] } })),
          apiClient.get<{ data: StockOpnameRecord[] }>("/opname/records", { params: { limit: 99999 } }).catch(() => ({ data: { data: [] } })),
          apiClient.get<{ data: DocumentRecord[] }>("/dokumen", { params: { limit: 99999 } }).catch(() => ({ data: { data: [] } })),
          apiClient.get<{ data: ActivityLog[] }>("/aktivitas", { params: { limit: 99999 } }).catch(() => ({ data: { data: [] } })),
          apiClient.get<{ data: RuanganData[] }>("/ruangan", { params: { limit: 99999 } }).catch(() => ({ data: { data: [] } })),
          apiClient.get<{ data: ObservasiItem[] }>("/observasi", { params: { limit: 99999 } }).catch(() => ({ data: { data: [] } })),
        ]);
        if (cancelled) return;
        if (Array.isArray(assetsRes.data?.data)) {
          const parseRp = (v: any): string => {
            if (v === null || v === undefined) return "0";
            if (typeof v === "number") return String(Math.round(v));
            
            let s = String(v).trim();
            // Handle standard float from DB
            if (/^-?\d+(\.\d+)?$/.test(s)) {
              return String(Math.round(parseFloat(s)));
            }
            
            // Remove Rp, space, currency symbols
            s = s.replace(/Rp/gi, "").replace(/\s/g, "");

            // Handle ID/US comma-dot swaps
            if (s.includes(",") && s.includes(".")) {
               const lastComma = s.lastIndexOf(",");
               const lastDot = s.lastIndexOf(".");
               if (lastComma > lastDot) {
                  s = s.replace(/\./g, "").replace(",", "."); // ID
               } else {
                  s = s.replace(/,/g, ""); // US
               }
            } else if (s.includes(",")) {
               const parts = s.split(",");
               if (parts.length === 2 && parts[1].length <= 2) {
                 s = s.replace(",", "."); // ID decimal
               } else {
                 s = s.replace(/,/g, ""); // US thousands
               }
            } else if (s.includes(".")) {
               const parts = s.split(".");
               if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
                 s = s.replace(/\./g, ""); // ID thousands
               }
               // else leave dot for parseFloat
            }
            
            const parsed = parseFloat(s.replace(/[^0-9.-]/g, ""));
            if (isNaN(parsed)) return "0";
            return String(Math.round(parsed));
          };
          const flattened = assetsRes.data.data.map((a: any) => {
            const extra = a.extra_fields || {};
            // Resolve Nilai Buku from multiple possible field names
            const nilaiBukuRaw = extra._nilai_buku || a._nilai_buku || extra.NilaiBuku || a.NilaiBuku || extra.nilai_buku || a.nilai_buku || a.nilai_buku_akhir || extra.NilaiBuku_Akhir || a.NilaiBuku_Akhir || "0";
            // Resolve Harga Perolehan from multiple possible field names
            const hargaPerolehanRaw = extra._harga_perolehan || a._harga_perolehan || extra.HargaSatuan || a.HargaSatuan || extra.harga_satuan || a.harga_satuan || extra.harga_perolehan || a.harga_perolehan || "0";
            
            let rawKondisi = (extra.Kondisi || a.kondisi || a.Kondisi || "").trim();
            if (rawKondisi.toUpperCase() === "B") rawKondisi = "Baik";
            if (rawKondisi.toUpperCase() === "RR") rawKondisi = "Rusak Ringan";
            if (rawKondisi.toUpperCase() === "RB") rawKondisi = "Rusak Berat";

            const dbUuid = String(a.id || "");
            const assetCode = String(extra.Id ?? extra.id ?? a.kode_tag_aset ?? a.id ?? "");
            const nupVal = String(extra.Id_aset || extra.id_aset || extra.ID_ASET || extra.nup || extra.NUP || a.nup || a.NUP || "");
            return {
              ...a,
              ...extra,
              id: assetCode,
              Id: extra.Id || extra.id || assetCode,
              Id_aset: nupVal,
              nup: nupVal,
              db_id: dbUuid,
              kode_tag_aset: a.kode_tag_aset || assetCode,
              Kondisi: rawKondisi,
              Nama_Barang: extra.Nama_Barang || a.nama_barang || "",
              Nama_unit: extra.Nama_unit || a.nama_unit || "",
              Nama_ruangan: extra.Nama_ruangan || a.nama_ruangan || "",
              Pengguna: extra.Pengguna || a.pengguna || extra.nama_pic || a.nama_pic || "",
              TglPerolehan: extra.TglPerolehan || a.tgl_perolehan || "",
              TipeAset: extra.TipeAset || a.jenis_aset || "PM",
              _nilai_buku: parseRp(nilaiBukuRaw),
              _harga_perolehan: parseRp(hargaPerolehanRaw),
            };
          });
          setAssets(flattened);
        }
        if (Array.isArray(maintenanceRes.data?.data)) setMaintenanceTickets(maintenanceRes.data.data);
        if (Array.isArray(mutasiRes.data?.data)) {
          setMutationRequests(
            mutasiRes.data.data.map((m: any) => ({
              ...m,
              id: m.nomor_mutasi || m.id,
              nomor_mutasi: m.nomor_mutasi || m.id,
            }))
          );
        }
        if (Array.isArray(pengadaanRes.data?.data)) setProcurementRequests(pengadaanRes.data.data);
        if (Array.isArray(opnameRes.data?.data)) setStockOpnameRecords(opnameRes.data.data);
        if (Array.isArray(dokumenRes.data?.data)) setDocuments(dokumenRes.data.data);
        // Only overwrite local activity logs if the API returned real data.
        // When backend is offline the .catch() returns an empty array which
        // would wipe out all localStorage-persisted logs on every hydrate().
        if (Array.isArray(aktivitasRes.data?.data) && aktivitasRes.data.data.length > 0) {
          // Merge: API logs take priority, then append any local-only logs
          const apiLogs: ActivityLog[] = aktivitasRes.data.data;
          const apiIds = new Set(apiLogs.map((l: ActivityLog) => l.id));
          const localLogs = loadStoredActivityLogs();
          const localOnly = localLogs.filter((l) => !apiIds.has(l.id));
          const merged = [...apiLogs, ...localOnly];
          setActivityLogs(merged);
          // Persist merged set so next offline load has everything
          try {
            localStorage.setItem(ACTIVITY_STORAGE_KEY, JSON.stringify(merged.slice(0, 1000)));
          } catch { /* ignore */ }
        }
        // else: keep the localStorage-loaded logs already in state
        if (Array.isArray(ruanganRes.data?.data) && ruanganRes.data.data.length > 0) {
          setRuangan(ruanganRes.data.data);
        }
        if (Array.isArray(observasiRes.data?.data)) {
          setObservasiItems(observasiRes.data.data);
        }
        await fetchUsers();
      } catch {
        // Backend offline — local seed data remains active. No action needed.
      }
    }
    hydrate();
    return () => { cancelled = true; };
  }, [currentUser, fetchUsers]);

  // ── Socket.IO — apply real-time mutations ONLY when authenticated ───────────
  useEffect(() => {
    if (!currentUser || !localStorage.getItem("access_token")) {
      disconnectSocket();
      return;
    }
    connectSocket();
    const offs = [
      onEvent<Asset>("asset:created", (a) => setAssets((p) => [...p, a])),
      onEvent<Asset>("asset:updated", (a) =>
        setAssets((p) => p.map((x) => (x.id === a.id ? a : x)))),
      onEvent<{ id: string }>("asset:deleted", ({ id }) =>
        setAssets((p) => p.filter((x) => x.id !== id))),
      onEvent<MutationRequest & { deleted?: boolean }>("mutasi:status_changed", (m: any) => {
        const id = m.nomor_mutasi || m.id;
        if (m.deleted || m.status === "Dihapus") {
          setMutationRequests((p) => p.filter((x) => x.id !== id && x.nomor_mutasi !== id));
          return;
        }
        const normalized: MutationRequest = { ...m, id, nomor_mutasi: id };
        setMutationRequests((p) => {
          const exists = p.some((x) => x.id === id || (x.nomor_mutasi && x.nomor_mutasi === id));
          if (exists) {
            return p.map((x) => (x.id === id || x.nomor_mutasi === id ? { ...x, ...normalized } : x));
          }
          return [normalized, ...p];
        });
      }),
      onEvent<ProcurementRequest>("pengadaan:status_changed", (pr) =>
        setProcurementRequests((p) => p.map((x) => (x.id === pr.id ? pr : x)))),
      onEvent<MaintenanceTicket>("maintenance:status_changed", (t) =>
        setMaintenanceTickets((p) => p.map((x) => (x.id === t.id ? t : x)))),
      onEvent<StockOpnameRecord>("opname:record_verified", (r) =>
        setStockOpnameRecords((p) => p.map((x) => (x.id === r.id ? r : x)))),
    ];
    return () => {
      offs.forEach((off) => off());
      disconnectSocket();
    };
  }, [currentUser]);

  const setFilters = useCallback((next: Partial<Filters>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
  }, []);
  const resetFilters = useCallback(() => setFiltersState(DEFAULT_FILTERS), []);

  const navigateTo = useCallback((page: string, payload?: Record<string, unknown>) => {
    setPendingNav({ page, payload });
  }, []);

  const consumePendingNav = useCallback(() => {
    const v = pendingNav;
    setPendingNav(null);
    return v;
  }, [pendingNav]);

  // ── Selectors ───────────────────────────────────────────────────────────────
  const getAssetById = useCallback((id: string) => assets.find((a) => a.id === id), [assets]);
  const getAssetByTag = useCallback(
    (tag: string) => assets.find((a) => a.kode_tag_aset === tag),
    [assets],
  );
  const getAssetsByJenis = useCallback(
    (jenis: JenisAset) => assets.filter((a) => a.TipeAset === jenis),
    [assets],
  );
  const getAssetsByUnit = useCallback(
    (unit: string) => assets.filter((a) => a.Nama_unit === unit),
    [assets],
  );
  const getAssetsByRoom = useCallback(
    (kodeRuangan: string) => assets.filter((a) => a.kode_ruangan === kodeRuangan),
    [assets],
  );
  const getAssetsByPIC = useCallback(
    (pic: string) => assets.filter((a) => a.nama_pic === pic),
    [assets],
  );

  // global filter application
  const filteredAssets = useMemo(() => {
    const f = filters;
    return assets.filter((a) => {
      if (f.search) {
        const q = f.search.toLowerCase();
        if (!Object.values(a).some((v) => String(v).toLowerCase().includes(q))) return false;
      }
      if (f.jenis !== "semua" && a.TipeAset !== f.jenis) return false;
      if (f.tahun !== "semua" && a.TahunBuku !== f.tahun) return false;
      if (f.unit !== "semua" && a.Nama_unit !== f.unit) return false;
      if (f.gedung !== "semua" && a.nama_gedung !== f.gedung) return false;
      if (f.lantai !== "semua" && a.lantai_level !== f.lantai) return false;
      if (f.ruangan !== "semua" && a.kode_ruangan !== f.ruangan) return false;
      if (f.kategori !== "semua" && a.kategori_ruangan !== f.kategori) return false;
      if (f.kondisi !== "semua" && a.Kondisi !== f.kondisi) return false;
      if (f.pic !== "semua" && a.nama_pic !== f.pic) return false;
      if (f.statusOpname !== "semua" && getOpnameStatus(a) !== f.statusOpname) return false;
      if (f.statusMaintenance !== "semua" && getMaintenanceStatus(a) !== f.statusMaintenance) return false;
      return true;
    });
  }, [assets, filters]);

  // ── Computed metrics ────────────────────────────────────────────────────────
  const computeTotalAssets = useCallback(() => filteredAssets.length, [filteredAssets]);
  const computeTotalBookValue = useCallback(
    () => filteredAssets.reduce((s, a) => s + n(a._nilai_buku), 0),
    [filteredAssets],
  );
  const computeTotalAcquisitionValue = useCallback(
    () => filteredAssets.reduce((s, a) => s + n(a._harga_perolehan), 0),
    [filteredAssets],
  );
  const computeTotalDepreciation = useCallback(
    () => filteredAssets.reduce((s, a) => s + n(a._akumulasi_penyusutan), 0),
    [filteredAssets],
  );
  const computeStockOpnameProgress = useCallback(() => {
    const total = filteredAssets.length;
    const done = filteredAssets.filter((a) => getOpnameStatus(a) === "Terverifikasi").length;
    return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
  }, [filteredAssets]);
  const computeMissingAssets = useCallback(
    () => filteredAssets.filter((a) => getOpnameStatus(a) === "Tidak Ditemukan").length,
    [filteredAssets],
  );
  const computeUnverifiedAssets = useCallback(
    () =>
      filteredAssets.filter((a) => {
        const s = getOpnameStatus(a);
        return s === "Belum Dicek" || s === "Perlu Verifikasi";
      }).length,
    [filteredAssets],
  );
  const computeAssetsWithoutClearLocation = useCallback(
    () =>
      filteredAssets.filter(
        (a) =>
          !a.status_kejelasan_lokasi ||
          a.status_kejelasan_lokasi === "Tidak Jelas" ||
          a.status_kejelasan_lokasi === "Perlu Verifikasi",
      ).length,
    [filteredAssets],
  );
  const computeAssetsWithoutPIC = useCallback(
    () => filteredAssets.filter((a) => !a.nama_pic || a.nama_pic === "-").length,
    [filteredAssets],
  );
  const computeMaintenanceOverdue = useCallback(
    () => filteredAssets.filter((a) => getMaintenanceStatus(a) === "Overdue").length,
    [filteredAssets],
  );
  const computeTopUnits = useCallback(
    (limit = 6) => {
      const map = new Map<string, number>();
      for (const a of filteredAssets) map.set(a.Nama_unit, (map.get(a.Nama_unit) || 0) + 1);
      return Array.from(map.entries())
        .map(([unit, value]) => ({ unit, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);
    },
    [filteredAssets],
  );
  const computeTopMaintenanceCost = useCallback(
    (limit = 5) => {
      const map = new Map<string, { biaya: number; freq: number }>();
      for (const a of filteredAssets) {
        const cur = map.get(a.Nama_unit) || { biaya: 0, freq: 0 };
        cur.biaya += n(a._total_biaya_maintenance);
        cur.freq += n(a.total_frekuensi_maintenance);
        map.set(a.Nama_unit, cur);
      }
      return Array.from(map.entries())
        .map(([unit, v]) => ({ unit, biaya: v.biaya, freq: v.freq }))
        .sort((a, b) => b.biaya - a.biaya)
        .slice(0, limit);
    },
    [filteredAssets],
  );
  const computeKondisiBreakdown = useCallback(() => {
    const counts: Record<string, number> = {};
    for (const a of filteredAssets) {
      const k = getKondisiSistem(a);
      counts[k] = (counts[k] || 0) + 1;
    }
    const order: StatusKondisi[] = ["Baik", "Perlu Monitoring", "Rusak Ringan", "Rusak Berat", "Prioritas Penggantian"];
    return order.map((label) => ({ label, value: counts[label] || 0 }));
  }, [filteredAssets]);

  const computeProcurementNeed = useCallback(
    () =>
      filteredAssets.filter((a) => {
        const sisa = n(a._sisa_masa_manfaat_bulan);
        return (
          a.Kondisi === "Rusak Berat" ||
          (sisa <= 0 && n(a.total_frekuensi_maintenance) >= 3) ||
          computeReplacementPriority(a) >= 70
        );
      }),
    [filteredAssets],
  );
  const computeReplacementCandidates = useCallback(
    (limit = 10) =>
      [...filteredAssets]
        .map((a) => ({ a, score: computeReplacementPriority(a) }))
        .sort((x, y) => y.score - x.score)
        .slice(0, limit)
        .map((x) => x.a),
    [filteredAssets],
  );

  // ── Mutations ───────────────────────────────────────────────────────────────
  const upsertAsset = useCallback(
    (a: Asset, opts?: { reason?: string; user?: string; diffs?: ActivityFieldDiff[]; items_detail?: ActivityItemDetail[] }) => {
      setAssets((prev) => {
        const idx = prev.findIndex((x) => x.id === a.id);
        if (idx === -1) {
          const itemDetail: ActivityItemDetail = {
            id: a.id,
            kode: a.id || a.kode_tag_aset,
            nama: a.Nama_Barang,
            kategori: a.TipeAset || "PM",
            ruangan: a.Nama_ruangan,
            kondisi: a.Kondisi || "Baik",
            nilai: a._nilai_buku || a._harga_perolehan || 0,
            nup: (a as any).NUP || (a as any).nup || "-",
            merek: (a as any).Merk || (a as any).merek || "-",
            snapshot: a,
          };
          appendActivity({
            pengguna: opts?.user || CURRENT_USER.nama,
            role: CURRENT_USER.role,
            menu: "Data Aset",
            aksi: `Menambahkan aset ${a.id} (${a.Nama_Barang})`,
            target_type: "Asset",
            target_id: a.id,
            items_count: 1,
            items_detail: opts?.items_detail || [itemDetail],
            status: "Berhasil",
            jenis: "tambah",
          });
          return [...prev, a];
        }

        const oldAsset = prev[idx];
        const changedFields: ActivityFieldDiff[] = [];
        const checkKeys: { key: string; label: string }[] = [
          { key: "Kondisi", label: "Kondisi Fisik" },
          { key: "Nama_ruangan", label: "Lokasi Ruangan" },
          { key: "Pengguna", label: "Penanggung Jawab / Pengguna" },
          { key: "Nama_Barang", label: "Nama Barang" },
          { key: "Nama_unit", label: "Unit Kerja" },
          { key: "Merk", label: "Merk / Type" },
          { key: "NUP", label: "NUP" },
          { key: "TglPerolehan", label: "Tanggal Perolehan" },
          { key: "status_penggunaan_aset", label: "Status Penggunaan" },
          { key: "_nilai_buku", label: "Nilai Buku" },
          { key: "_harga_perolehan", label: "Harga Perolehan" },
        ];

        checkKeys.forEach(({ key, label }) => {
          const oldVal = (oldAsset as any)[key] ?? "-";
          const newVal = (a as any)[key] ?? "-";
          if (String(oldVal).trim() !== String(newVal).trim() && (oldVal !== "-" || newVal !== "-")) {
            changedFields.push({ field: key, label, oldVal: String(oldVal), newVal: String(newVal) });
          }
        });

        const activeDiffs = opts?.diffs && opts.diffs.length > 0 ? opts.diffs : changedFields;
        const diffSummary = activeDiffs.length > 0 ? activeDiffs.map(d => `${d.label}: ${d.oldVal} → ${d.newVal}`).join("; ") : opts?.reason || "Perubahan atribut aset";

        const itemDetail: ActivityItemDetail = {
          id: a.id,
          kode: a.id || a.kode_tag_aset,
          nama: a.Nama_Barang || oldAsset.Nama_Barang,
          kategori: a.TipeAset || oldAsset.TipeAset || "PM",
          ruangan: a.Nama_ruangan || oldAsset.Nama_ruangan,
          kondisi: a.Kondisi || oldAsset.Kondisi,
          nilai: a._nilai_buku || a._harga_perolehan || oldAsset._nilai_buku,
          diffs: activeDiffs,
          old_value: activeDiffs.map(d => `${d.label}: ${d.oldVal}`).join(", "),
          new_value: activeDiffs.map(d => `${d.label}: ${d.newVal}`).join(", "),
          snapshot: { ...oldAsset, ...a },
        };

        appendActivity({
          pengguna: opts?.user || CURRENT_USER.nama,
          role: CURRENT_USER.role,
          menu: "Data Aset",
          aksi: `Memperbarui aset ${a.id} (${a.Nama_Barang || oldAsset.Nama_Barang})${opts?.reason ? ` — ${opts.reason}` : activeDiffs.length > 0 ? ` — ${activeDiffs[0].label}` : ""}`,
          target_type: "Asset",
          target_id: a.id,
          field_changed: activeDiffs.map(d => d.label).join(", ") || opts?.reason || "Data Aset",
          old_value: activeDiffs.map(d => `${d.label}: ${d.oldVal}`).join("; ") || "-",
          new_value: activeDiffs.map(d => `${d.label}: ${d.newVal}`).join("; ") || "-",
          diffs: activeDiffs,
          items_count: 1,
          items_detail: opts?.items_detail || [itemDetail],
          status: "Berhasil",
          jenis: "update",
        });
        const copy = [...prev];
        copy[idx] = { ...prev[idx], ...a };
        return copy;
      });
    },
    [appendActivity],
  );

  const insertBulkAssets = useCallback(
    async (newAssets: Asset[], opts?: { user?: string; categoryLabel?: string; fileName?: string; skipLog?: boolean }) => {
      try {
        await apiClient.post("/assets/bulk", newAssets);
      } catch (err: any) {
        console.error("Bulk import failed to reach backend:", err);
        if (err.response) {
          const status = err.response.status;
          if (status === 401) {
            throw new Error("Sesi Anda belum terautentikasi atau telah kedaluwarsa. Silakan masuk kembali.");
          }
          if (status === 403) {
            throw new Error("Akses ditolak: Anda tidak memiliki izin untuk mengimpor aset (hanya Admin Sistem dan Admin Pusat yang diperbolehkan).");
          }
          const serverMsg = err.response?.data?.message || err.message;
          throw new Error(`Backend Error: ${serverMsg}`);
        }
        throw err;
      }

      setAssets((prev) => {
        const existingIds = new Set(prev.map((asset) => asset.id));
        const filtered = newAssets.filter(a => !existingIds.has(a.id));
        return [...prev, ...filtered];
      });

      if (!opts?.skipLog) {
        const cat = opts?.categoryLabel || "Data Aset";
        // Cap items_detail snapshot to 100 to prevent exceeding localStorage quota on 20k+ rows
        const itemsDetail: ActivityItemDetail[] = newAssets.slice(0, 100).map((a, idx) => ({
          id: a.id || `ITEM-${idx + 1}`,
          kode: a.id || (a as any).KodeBarang || a.kode_tag_aset || "-",
          nama: a.Nama_Barang || (a as any).NamaBarang || "-",
          kategori: cat,
          ruangan: a.Nama_ruangan || (a as any).NamaRuangan || "-",
          kondisi: a.Kondisi || (a as any).kondisi || "Baik",
          nilai: a._nilai_buku || a._harga_perolehan || (a as any).NilaiBuku || (a as any).HargaPerolehan || 0,
          nup: (a as any).NUP || (a as any).nup || (a as any).Id_aset || (a as any).id_aset || (a as any).no_nup || "-",
          merek: (a as any).MerkType || (a as any).Model || (a as any).Merk || (a as any).merek || (a as any).Merek || "-",
          snapshot: a,
        }));

        appendActivity({
          pengguna: opts?.user || CURRENT_USER.nama,
          role: CURRENT_USER.role,
          menu: "Data Aset",
          aksi: `Upload Excel ${newAssets.length.toLocaleString("id-ID")} baris ke ${cat}${opts?.fileName ? ` — File: ${opts.fileName}` : ""}`,
          target_type: "Asset",
          target_id: "BULK",
          file_name: opts?.fileName,
          items_count: newAssets.length,
          items_detail: itemsDetail,
          status: "Berhasil",
          jenis: "tambah",
        });
      }
    },
    [appendActivity],
  );

  const deleteAsset = useCallback(
    (id: string, opts?: { user?: string }) => {
      let targetAsset: Asset | undefined;
      setAssets((prev) => {
        targetAsset = prev.find((a) => a.id === id);
        return prev.filter((a) => a.id !== id);
      });
      const itemDetail: ActivityItemDetail | undefined = targetAsset ? {
        id: targetAsset.id,
        kode: targetAsset.id || targetAsset.kode_tag_aset,
        nama: targetAsset.Nama_Barang,
        kategori: targetAsset.TipeAset || "PM",
        ruangan: targetAsset.Nama_ruangan,
        kondisi: targetAsset.Kondisi,
        nilai: targetAsset._nilai_buku || targetAsset._harga_perolehan,
        nup: (targetAsset as any).NUP || (targetAsset as any).nup || "-",
        merek: (targetAsset as any).Merk || (targetAsset as any).merek || "-",
        snapshot: targetAsset,
      } : undefined;

      appendActivity({
        pengguna: opts?.user || CURRENT_USER.nama,
        role: CURRENT_USER.role,
        menu: "Data Aset",
        aksi: `Menghapus aset ${id}${targetAsset?.Nama_Barang ? ` (${targetAsset.Nama_Barang})` : ""}`,
        target_type: "Asset",
        target_id: id,
        items_count: 1,
        items_detail: itemDetail ? [itemDetail] : undefined,
        status: "Berisiko",
        jenis: "hapus",
      });
    },
    [appendActivity],
  );

  const deleteAssetsByJenis = useCallback(
    (jenis: string) => {
      const normalizedJenis =
        jenis === "PM" ? "Peralatan & Mesin"
        : jenis === "ATB" ? "Aset Tak Berwujud"
        : jenis === "ATL" ? "Aset Tetap Lainnya"
        : jenis === "ALAT_ANGKUTAN" ? "Alat Angkutan"
        : jenis;

      const codeJenis =
        jenis === "Peralatan & Mesin" ? "PM"
        : jenis === "Aset Tak Berwujud" ? "ATB"
        : jenis === "Aset Tetap Lainnya" ? "ATL"
        : jenis === "Alat Angkutan" ? "ALAT_ANGKUTAN"
        : jenis;

      setAssets((prev) =>
        prev.filter((a) => {
          const itemJenis = (a as any).jenis_aset || (a as any).TipeAset || (a as any).jenis;
          return itemJenis !== jenis && itemJenis !== normalizedJenis && itemJenis !== codeJenis;
        })
      );
    },
    [],
  );

  const recordStockOpname = useCallback(
    (asset_id: string, partial: Partial<Asset>, opts?: { user?: string; skipLog?: boolean }) => {
      const user = opts?.user || CURRENT_USER.nama;
      const t = nowParts();

      const currentAsset = assets.find(a => a.id === asset_id);
      const existingExtra = currentAsset?.extra_fields || {};

      const updatedExtra = {
        ...existingExtra,
        tanggal_opname_terakhir: t.tgl,
        diverifikasi_oleh_terakhir: user,
        status_opname_terakhir: partial.status_opname_terakhir || "Terverifikasi",
        kondisi_fisik_opname_terakhir: partial.kondisi_fisik_opname_terakhir || partial.Kondisi || partial.kondisi || "Baik",
        status_lokasi_opname_terakhir: partial.status_lokasi_opname_terakhir || "Sesuai",
        catatan_opname_terakhir: partial.catatan_opname_terakhir || "",
      };

      apiClient.patch(`/assets/${asset_id}`, {
        kondisi: partial.Kondisi || partial.kondisi || "Baik",
        verifikasi_status: "Terverifikasi",
        nama_ruangan: partial.Nama_ruangan || partial.nama_ruangan || currentAsset?.nama_ruangan,
        id_ruangan: partial.Id_ruangan || partial.id_ruangan || currentAsset?.id_ruangan,
        kode_ruangan: partial.kode_ruangan || currentAsset?.kode_ruangan,
        nama_gedung: partial.Gedung || partial.nama_gedung || currentAsset?.nama_gedung,
        extra_fields: updatedExtra
      }).catch(err => {
        console.error("Failed to sync stock opname to backend database:", err);
      });

      setAssets((prev) =>
        prev.map((a) =>
          a.id === asset_id
            ? {
                ...a,
                tanggal_opname_terakhir: t.tgl,
                diverifikasi_oleh_terakhir: user,
                ...partial,
                extra_fields: updatedExtra
              }
            : a,
        ),
      );

      setStockOpnameRecords((prev) => [
        ...prev.filter(r => r.asset_id !== asset_id && r.kode_tag !== (partial.kode_tag_aset || currentAsset?.kode_tag_aset || asset_id)),
        {
          id: `SO-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          asset_id,
          kode_tag: partial.kode_tag_aset || currentAsset?.kode_tag_aset || asset_id,
          tanggal: t.tgl,
          status_opname: partial.status_opname_terakhir || "Terverifikasi",
          kondisi_fisik: partial.kondisi_fisik_opname_terakhir || partial.Kondisi || partial.kondisi || "Baik",
          status_lokasi: partial.status_lokasi_opname_terakhir || "Sesuai",
          diverifikasi_oleh: user,
        },
      ]);

      if (!opts?.skipLog) {
        appendActivity({
          pengguna: user,
          role: CURRENT_USER.role,
          menu: "Opname",
          aksi: `Verifikasi SO aset ${partial.kode_tag_aset || currentAsset?.kode_tag_aset || asset_id} (${currentAsset?.Nama_Barang || currentAsset?.nama_barang || "Aset"}) — Kondisi: ${partial.kondisi_fisik_opname_terakhir || partial.Kondisi || partial.kondisi || "Baik"}, Lokasi: ${partial.status_lokasi_opname_terakhir || "Sesuai"}`,
          target_type: "Asset",
          target_id: asset_id,
          status: "Berhasil",
          jenis: "opname",
        });
      }
    },
    [assets, appendActivity],
  );

  const revertStockOpname = useCallback(
    (asset_id: string, opts?: { user?: string; skipLog?: boolean }) => {
      const user = opts?.user || CURRENT_USER.nama;
      const currentAsset = assets.find(a => a.id === asset_id);
      const existingExtra = currentAsset?.extra_fields || {};

      const updatedExtra = {
        ...existingExtra,
        tanggal_opname_terakhir: "-",
        diverifikasi_oleh_terakhir: "-",
        status_opname_terakhir: "Belum Dicek",
        kondisi_fisik_opname_terakhir: "-",
        status_lokasi_opname_terakhir: "-",
        catatan_opname_terakhir: "",
      };

      apiClient.patch(`/assets/${asset_id}`, {
        verifikasi_status: "Belum Dicek",
        extra_fields: updatedExtra,
      }).catch(err => {
        console.error("Failed to sync revert stock opname to backend database:", err);
      });

      setAssets((prev) =>
        prev.map((a) =>
          a.id === asset_id
            ? {
                ...a,
                tanggal_opname_terakhir: "-",
                diverifikasi_oleh_terakhir: "-",
                status_opname_terakhir: "Belum Dicek",
                extra_fields: updatedExtra,
              }
            : a,
        ),
      );

      setStockOpnameRecords((prev) =>
        prev.filter((r) => r.asset_id !== asset_id && r.kode_tag !== (currentAsset?.kode_tag_aset || asset_id))
      );

      if (!opts?.skipLog) {
        appendActivity({
          pengguna: user,
          role: CURRENT_USER.role,
          menu: "Opname",
          aksi: `Hapus jawaban SO aset ${currentAsset?.kode_tag_aset || asset_id} (${currentAsset?.Nama_Barang || currentAsset?.nama_barang || "Aset"}) — Status kembali ke Belum Terverifikasi`,
          target_type: "Asset",
          target_id: asset_id,
          status: "Berhasil",
          jenis: "opname",
        });
      }
    },
    [assets, appendActivity],
  );

  const completeMaintenance = useCallback(
    (ticket: MaintenanceTicket, opts?: { user?: string }) => {
      setMaintenanceTickets((prev) => {
        const idx = prev.findIndex((t) => t.id === ticket.id);
        if (idx === -1) return [...prev, { ...ticket, status: "Selesai" }];
        const copy = [...prev];
        copy[idx] = { ...ticket, status: "Selesai" };
        return copy;
      });
      setAssets((prev) =>
        prev.map((a) => {
          if (a.id !== ticket.asset_id) return a;
          const totalFreq = n(a.total_frekuensi_maintenance) + 1;
          const totalBiaya = n(a._total_biaya_maintenance) + ticket.biaya;
          const avg = n(a.rata_rata_waktu_perbaikan_jam);
          return {
            ...a,
            tanggal_maintenance_terakhir: ticket.tanggal,
            jenis_maintenance_terakhir: ticket.jenis,
            kategori_kerusakan_terakhir: ticket.kategori_kerusakan,
            tingkat_kerusakan_terakhir: ticket.tingkat_kerusakan,
            biaya_maintenance_terakhir: fmtRp(ticket.biaya),
            total_frekuensi_maintenance: String(totalFreq),
            total_biaya_maintenance: fmtRp(totalBiaya),
            _total_biaya_maintenance: String(totalBiaya),
            downtime_terakhir_jam: String(ticket.downtime_jam),
            rata_rata_waktu_perbaikan_jam: String(Math.round((avg + ticket.downtime_jam) / 2)),
            jadwal_maintenance_berikutnya: ticket.jadwal_berikutnya || a.jadwal_maintenance_berikutnya,
          };
        }),
      );
      appendActivity({
        pengguna: opts?.user || CURRENT_USER.nama,
        role: "Teknisi",
        menu: "Perbaikan",
        aksi: `Selesaikan tiket ${ticket.id} untuk aset ${ticket.asset_id}`,
        target_type: "Asset",
        target_id: ticket.asset_id,
        status: "Berhasil",
        jenis: "perbaikan",
      });
    },
    [appendActivity],
  );

  const createMutation = useCallback(
    async (payload: Partial<MutationRequest>, opts?: { user?: string }) => {
      const user = opts?.user || CURRENT_USER.nama;
      try {
        const { data } = await apiClient.post<any>("/mutasi", {
          ...payload,
          pengaju: payload.pengaju || user,
        });
        const formatted: MutationRequest = {
          ...data,
          id: data.nomor_mutasi || data.id,
          nomor_mutasi: data.nomor_mutasi || data.id,
        };
        setMutationRequests((prev) => [formatted, ...prev.filter((x) => x.id !== formatted.id)]);
        appendActivity({
          pengguna: user,
          role: CURRENT_USER.role,
          menu: "Mutasi",
          aksi: `Pengajuan mutasi ${formatted.id} – aset ${formatted.asset_id} diajukan`,
          target_type: "Asset",
          target_id: formatted.asset_id,
          status: "Berhasil",
          jenis: "mutasi",
        });
        return formatted;
      } catch (err) {
        console.error("Failed to create mutation via API:", err);
        throw err;
      }
    },
    [appendActivity],
  );

  const fetchMutasi = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: MutationRequest[] }>("/mutasi", { params: { limit: 99999 } });
      if (Array.isArray(res.data?.data)) {
        setMutationRequests(
          res.data.data.map((m: any) => ({
            ...m,
            id: m.nomor_mutasi || m.id,
            nomor_mutasi: m.nomor_mutasi || m.id,
          }))
        );
      }
    } catch (err) {
      console.error("Gagal mengambil data mutasi segar dari server:", err);
    }
  }, []);

  const approveMutation = useCallback(
    async (id: string, opts?: { user?: string; catatan?: string }) => {
      const user = opts?.user || currentUser?.nama || CURRENT_USER.nama;
      let target: MutationRequest | undefined;

      // Authoritative API call to backend — will throw on 409 Conflict or 400 error
      const { data } = await apiClient.patch<{ mutasi: any; asset?: any; message: string }>(
        `/mutasi/${id}/approve`,
        { approver: user, catatan: opts?.catatan },
      );

      if (data?.mutasi) {
        target = {
          ...data.mutasi,
          id: data.mutasi.nomor_mutasi || data.mutasi.id,
          nomor_mutasi: data.mutasi.nomor_mutasi || data.mutasi.id,
          status: "Disetujui",
          approver: data.mutasi.approver || user,
          catatan_approver: data.mutasi.catatan_approver || opts?.catatan,
          tanggal_approval: data.mutasi.tanggal_approval || new Date().toISOString(),
        };
      }

      if (data?.asset) {
        setAssets((prev) =>
          prev.map((a) =>
            a.id === data.asset.id || a.kode_tag_aset === data.asset.kode_tag_aset
              ? { ...a, ...data.asset }
              : a,
          ),
        );
      }

      setMutationRequests((prev) =>
        prev.map((m) => {
          if (m.id === id || m.nomor_mutasi === id) {
            target = {
              ...m,
              ...(target || {}),
              status: "Disetujui",
              approver: user,
              catatan_approver: opts?.catatan || m.catatan_approver,
              tanggal_approval: target?.tanggal_approval || new Date().toISOString(),
            };
            return target;
          }
          return m;
        }),
      );

      if (target) {
        setAssets((prev) =>
          prev.map((a) =>
            a.id === target!.asset_id || a.kode_tag_aset === target!.asset_id
              ? {
                  ...a,
                  Nama_ruangan: target!.ke_ruangan || a.Nama_ruangan,
                  nama_ruangan_standar: target!.ke_ruangan || a.nama_ruangan_standar,
                  nama_gedung: target!.ke_gedung || a.nama_gedung,
                  gedung: target!.ke_gedung || a.gedung,
                  nama_pic: target!.ke_pic || a.nama_pic,
                  Pengguna: target!.ke_pic || a.Pengguna,
                  Nama_unit: target!.ke_unit || a.Nama_unit,
                  tanggal_mutasi_terakhir: target!.tanggal,
                  status_mutasi_terakhir: "Disetujui",
                  catatan_mutasi_terakhir: opts?.catatan || target!.catatan || "-",
                }
              : a,
          ),
        );
        const diffDesc = `${target.dari_ruangan || "Asal"} → ${target.ke_ruangan || "Tujuan"}`;
        appendActivity({
          pengguna: user,
          role: currentUser?.role || CURRENT_USER.role,
          menu: "Mutasi",
          aksi: `Menyetujui mutasi ${id} (aset ${target.asset_id}) — Lokasi baru: ${diffDesc}`,
          target_type: "Asset",
          target_id: target.asset_id,
          field_changed: "Lokasi Ruangan",
          old_value: target.dari_ruangan,
          new_value: target.ke_ruangan,
          diffs: [
            {
              field: "nama_ruangan",
              label: "Lokasi Ruangan",
              oldVal: `${target.dari_gedung ? target.dari_gedung + " - " : ""}${target.dari_ruangan}`,
              newVal: `${target.ke_gedung ? target.ke_gedung + " - " : ""}${target.ke_ruangan}`,
            },
          ],
          items_detail: [
            {
              id: target.asset_id,
              kode: target.kode_aset || target.asset_id,
              nama: target.nama_aset || target.asset_id,
              ruangan: target.ke_ruangan,
              diffs: [
                {
                  field: "nama_ruangan",
                  label: "Lokasi Ruangan",
                  oldVal: `${target.dari_gedung ? target.dari_gedung + " - " : ""}${target.dari_ruangan}`,
                  newVal: `${target.ke_gedung ? target.ke_gedung + " - " : ""}${target.ke_ruangan}`,
                },
              ],
            },
          ],
          status: "Berhasil",
          jenis: "update",
        });
      }
    },
    [appendActivity, currentUser?.nama, currentUser?.role],
  );

  const rejectMutation = useCallback(
    async (id: string, opts?: { user?: string; catatan?: string }) => {
      const user = opts?.user || currentUser?.nama || CURRENT_USER.nama;
      let target: MutationRequest | undefined;

      // Authoritative API call to backend — will throw on 409 Conflict or 400 error
      const { data } = await apiClient.patch<{ mutasi: any; message: string }>(
        `/mutasi/${id}/reject`,
        { approver: user, catatan: opts?.catatan },
      );

      if (data?.mutasi) {
        target = {
          ...data.mutasi,
          id: data.mutasi.nomor_mutasi || data.mutasi.id,
          nomor_mutasi: data.mutasi.nomor_mutasi || data.mutasi.id,
          status: "Ditolak",
          approver: data.mutasi.approver || user,
          catatan_approver: data.mutasi.catatan_approver || opts?.catatan,
          tanggal_approval: data.mutasi.tanggal_approval || new Date().toISOString(),
        };
      }

      setMutationRequests((prev) =>
        prev.map((m) => {
          if (m.id === id || m.nomor_mutasi === id) {
            target = {
              ...m,
              ...(target || {}),
              status: "Ditolak",
              approver: user,
              catatan_approver: opts?.catatan || m.catatan_approver,
              tanggal_approval: target?.tanggal_approval || new Date().toISOString(),
            };
            return target;
          }
          return m;
        }),
      );

      if (target) {
        appendActivity({
          pengguna: user,
          role: currentUser?.role || CURRENT_USER.role,
          menu: "Mutasi",
          aksi: `Menolak mutasi ${id} (aset ${target.asset_id})${opts?.catatan ? ` — Alasan: ${opts.catatan}` : ""}`,
          target_type: "Asset",
          target_id: target.asset_id,
          status: "Berhasil",
          jenis: "mutasi",
        });
      }
    },
    [appendActivity, currentUser?.nama, currentUser?.role],
  );

  const cancelMutation = useCallback(
    async (id: string, opts?: { user?: string }) => {
      const user = opts?.user || currentUser?.nama || CURRENT_USER.nama;
      let target: MutationRequest | undefined = mutationRequests.find(
        (m) => m.id === id || m.nomor_mutasi === id,
      );

      try {
        await apiClient.delete(`/mutasi/${id}`);
      } catch (err) {
        console.warn("Backend delete mutation failed, falling back to local update", err);
      }

      setMutationRequests((prev) => prev.filter((m) => m.id !== id && m.nomor_mutasi !== id));

      if (target) {
        appendActivity({
          pengguna: user,
          role: currentUser?.role || CURRENT_USER.role,
          menu: "Mutasi",
          aksi: `Membatalkan pengajuan mutasi ${id} (aset ${target.asset_id})`,
          target_type: "Asset",
          target_id: target.asset_id,
          status: "Berhasil",
          jenis: "mutasi",
        });
      }
    },
    [appendActivity, currentUser?.nama, currentUser?.role, mutationRequests],
  );

  const completeProcurement = useCallback(
    (id: string, newAsset?: Asset, opts?: { user?: string }) => {
      setProcurementRequests((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, status: "Selesai", asset_id_baru: newAsset?.id || p.asset_id_baru } : p,
        ),
      );
      if (newAsset) setAssets((prev) => [...prev, newAsset]);
      appendActivity({
        pengguna: opts?.user || CURRENT_USER.nama,
        role: "Pengelola Pengadaan",
        menu: "Pengadaan",
        aksi: `Pengadaan ${id} selesai${newAsset ? ` — aset baru ${newAsset.id}` : ""}`,
        target_type: "Procurement",
        target_id: id,
        status: "Berhasil",
        jenis: "pengadaan",
      });
    },
    [appendActivity],
  );

  const uploadDocument = useCallback(
    (doc: DocumentRecord, opts?: { user?: string }) => {
      setDocuments((prev) => [...prev, doc]);
      appendActivity({
        pengguna: opts?.user || CURRENT_USER.nama,
        role: CURRENT_USER.role,
        menu: "Dokumen",
        aksi: `Mengunggah dokumen ${doc.nama}`,
        target_type: "Document",
        target_id: doc.id,
        status: "Berhasil",
        jenis: "dokumen",
      });
    },
    [appendActivity],
  );

  const saveRoomObservasi = useCallback(
    async (
      ruanganId: string,
      tahun: number,
      payload: {
        kampus?: string;
        namaGedung?: string;
        kodeRuangan?: string;
        namaRuangan?: string;
        unitKerja?: string;
        petugas?: string;
        items: Partial<ObservasiItem>[];
        isUpload?: boolean;
      },
    ) => {
      const yearNum = Number(tahun) || new Date().getFullYear();
      const user = payload.petugas || CURRENT_USER.nama;
      const roomDesc = `${payload.namaRuangan || ruanganId}${payload.namaGedung ? ` (${payload.namaGedung}${payload.kampus ? `, ${payload.kampus}` : ""})` : ""}`;

      try {
        const res = await apiClient.post<{ data: ObservasiItem[] }>(`/observasi/room/${ruanganId}/bulk`, {
          ...payload,
          tahun: yearNum,
        });
        const saved = Array.isArray(res.data?.data) ? res.data.data : [];
        setObservasiItems((prev) => {
          if (currentUser?.role === "Pekerja Stock Opname") {
            const savedMap = new Set(saved.map((s) => s.id || `${s.kodeBarang}_${s.nup}`));
            const filtered = prev.filter(
              (it) =>
                !(
                  it.ruanganId === ruanganId &&
                  Number(it.tahun) === yearNum &&
                  savedMap.has(it.id || `${it.kodeBarang}_${it.nup}`)
                ),
            );
            return [...filtered, ...saved];
          }
          const filtered = prev.filter((it) => !(it.ruanganId === ruanganId && Number(it.tahun) === yearNum));
          return [...filtered, ...saved];
        });
        const itemsDetail: ActivityItemDetail[] = saved.map((item, idx) => ({
          id: item.id || `OBS-${ruanganId}-${idx + 1}`,
          kode: item.kodeBarang || item.nup || `OBS-${idx + 1}`,
          nama: item.namaBarang || "-",
          kategori: "Observasi Ruangan",
          ruangan: roomDesc,
          kondisi: item.kondisi || "Baik",
          volume: item.volume || 1,
          satuan: item.satuan || "Unit",
          nup: item.nup || "-",
          merek: item.merekType || "-",
          nilai: item.jumlahHarga || item.hargaSatuan || 0,
          keterangan: item.keterangan || "",
          snapshot: item,
        }));

        appendActivity({
          pengguna: user,
          role: "Operator Aset",
          menu: "Observasi Ruangan",
          aksi: payload.isUpload
            ? `Upload Excel DBR (${saved.length} barang) — ${roomDesc} (Periode ${yearNum})`
            : `Simpan data observasi (${saved.length} barang) — ${roomDesc} (Periode ${yearNum})`,
          target_type: "Ruangan",
          target_id: ruanganId,
          items_count: saved.length,
          items_detail: itemsDetail,
          status: "Berhasil",
          jenis: payload.isUpload ? "tambah" : "update",
        });
        return saved;
      } catch {
        // Local state fallback
        const fallbackSaved: ObservasiItem[] = payload.items.map((item, idx) => {
          const vol = Number(item.volume) || 1;
          const harga = Number(item.hargaSatuan) || 0;
          return {
            id: item.id || `OBS-${ruanganId}-${Date.now()}-${idx}`,
            ruanganId,
            tahun: yearNum,
            kampus: payload.kampus,
            namaGedung: payload.namaGedung,
            kodeRuangan: payload.kodeRuangan,
            namaRuangan: payload.namaRuangan,
            unitKerja: payload.unitKerja || "Sekolah Vokasi (SV)",
            petugas: user,
            noUrut: item.noUrut || idx + 1,
            kodeBarang: item.kodeBarang !== undefined ? String(item.kodeBarang) : "",
            namaBarang: item.namaBarang !== undefined ? String(item.namaBarang) : "",
            nup: item.nup !== undefined ? String(item.nup) : "",
            merekType: item.merekType !== undefined ? String(item.merekType) : "",
            tahunPerolehan: item.tahunPerolehan !== undefined ? String(item.tahunPerolehan) : "",
            hargaSatuan: harga,
            volume: vol,
            satuan: item.satuan !== undefined ? String(item.satuan) : "",
            jumlahHarga: item.jumlahHarga !== undefined ? Number(item.jumlahHarga) : harga * vol,
            sumberDana: item.sumberDana !== undefined ? String(item.sumberDana) : "",
            kondisi: item.kondisi !== undefined ? String(item.kondisi) : "Baik",
            penguasaan: item.penguasaan !== undefined ? String(item.penguasaan) : "",
            keterangan: item.keterangan !== undefined ? String(item.keterangan) : "",
            status: "Tersimpan",
          };
        });
        setObservasiItems((prev) => {
          const filtered = prev.filter((it) => !(it.ruanganId === ruanganId && Number(it.tahun) === yearNum));
          return [...filtered, ...fallbackSaved];
        });

        const itemsDetail: ActivityItemDetail[] = fallbackSaved.map((item, idx) => ({
          id: item.id || `OBS-${ruanganId}-${idx + 1}`,
          kode: item.kodeBarang || item.nup || `OBS-${idx + 1}`,
          nama: item.namaBarang || "-",
          kategori: "Observasi Ruangan",
          ruangan: roomDesc,
          kondisi: item.kondisi || "Baik",
          volume: item.volume || 1,
          satuan: item.satuan || "Unit",
          nup: item.nup || "-",
          merek: item.merekType || "-",
          nilai: item.jumlahHarga || item.hargaSatuan || 0,
          keterangan: item.keterangan || "",
          snapshot: item,
        }));

        appendActivity({
          pengguna: user,
          role: "Operator Aset",
          menu: "Observasi Ruangan",
          aksi: payload.isUpload
            ? `Upload Excel DBR (${fallbackSaved.length} barang) — ${roomDesc} (Periode ${yearNum})`
            : `Simpan data observasi (${fallbackSaved.length} barang) — ${roomDesc} (Periode ${yearNum})`,
          target_type: "Ruangan",
          target_id: ruanganId,
          items_count: fallbackSaved.length,
          items_detail: itemsDetail,
          status: "Berhasil",
          jenis: payload.isUpload ? "tambah" : "update",
        });
        return fallbackSaved;
      }
    },
    [appendActivity],
  );

  const deleteRoomObservasi = useCallback(
    async (ruanganId: string, tahun: number, opts?: { user?: string; namaRuangan?: string; namaGedung?: string; kampus?: string }) => {
      const yearNum = Number(tahun) || new Date().getFullYear();
      const user = opts?.user || CURRENT_USER.nama;
      const roomDesc = `${opts?.namaRuangan || ruanganId}${opts?.namaGedung ? ` (${opts.namaGedung}${opts.kampus ? `, ${opts.kampus}` : ""})` : ""}`;
      try {
        await apiClient.delete(`/observasi/room/${ruanganId}`, { params: { tahun: yearNum } });
      } catch {
        // ignore
      }
      let deletedItems: ObservasiItem[] = [];
      setObservasiItems((prev) => {
        deletedItems = prev.filter((it) => it.ruanganId === ruanganId && Number(it.tahun) === yearNum);
        return prev.filter((it) => !(it.ruanganId === ruanganId && Number(it.tahun) === yearNum));
      });
      const itemsDetail: ActivityItemDetail[] = deletedItems.map((item, idx) => ({
        id: item.id || `OBS-${ruanganId}-${idx + 1}`,
        kode: item.kodeBarang || item.nup || `OBS-${idx + 1}`,
        nama: item.namaBarang || "-",
        kategori: "Observasi Ruangan",
        ruangan: roomDesc,
        kondisi: item.kondisi || "Baik",
        volume: item.volume || 1,
        satuan: item.satuan || "Unit",
        nup: item.nup || "-",
        merek: item.merekType || "-",
        nilai: item.jumlahHarga || item.hargaSatuan || 0,
        snapshot: item,
      }));

      appendActivity({
        pengguna: user,
        role: "Operator Aset",
        menu: "Observasi Ruangan",
        aksi: `Menghapus seluruh data observasi — ${roomDesc} (Periode ${yearNum})`,
        target_type: "Ruangan",
        target_id: ruanganId,
        items_count: deletedItems.length,
        items_detail: itemsDetail.length > 0 ? itemsDetail : undefined,
        status: "Berhasil",
        jenis: "hapus",
      });
    },
    [appendActivity],
  );

  const getObservasiForRoom = useCallback(
    (ruanganId: string, tahun?: number) => {
      return observasiItems.filter((it) => {
        const matchRoom = it.ruanganId === ruanganId;
        const matchYear = !tahun || Number(it.tahun) === Number(tahun);
        return matchRoom && matchYear;
      });
    },
    [observasiItems],
  );

  const getObservasiSummary = useCallback(
    (tahun?: number) => {
      const selectedYear = Number(tahun) || new Date().getFullYear();
      const itemsInYear = observasiItems.filter((it) => Number(it.tahun) === selectedYear);
      const observedRoomIds = new Set(itemsInYear.map((it) => it.ruanganId));
      const totalRuangan = ruangan && ruangan.length > 0 ? ruangan.length : SEED_RUANGAN.length;
      const sudahDiobservasi = observedRoomIds.size;
      const belumDiobservasi = Math.max(0, totalRuangan - sudahDiobservasi);
      const totalItem = itemsInYear.length;
      const totalNilai = itemsInYear.reduce((acc, it) => acc + (Number(it.jumlahHarga) || 0), 0);
      const pct = totalRuangan > 0 ? Math.round((sudahDiobservasi / totalRuangan) * 100) : 0;
      return { totalRuangan, sudahDiobservasi, belumDiobservasi, totalItem, totalNilai, pct };
    },
    [observasiItems, ruangan],
  );

  const syncObservasiWithBmn = useCallback(
    async (observasiItemId: string, bmnAssetId: string, opts?: { user?: string }) => {
      const user = opts?.user || CURRENT_USER.nama;
      let matchedObs: ObservasiItem | undefined;
      let matchedBmn: Asset | undefined;

      matchedObs = observasiItems.find(it => String(it.id) === String(observasiItemId));
      matchedBmn = assets.find(a => String(a.id) === String(bmnAssetId));

      try {
        await apiClient.delete(`/observasi/item/${observasiItemId}`);
      } catch {
        // Offline / local state fallback
      }

      setObservasiItems((prev) => prev.filter(it => String(it.id) !== String(observasiItemId)));

      const bmnName = matchedBmn?.Nama_Barang || bmnAssetId;
      const obsName = matchedObs?.namaBarang || observasiItemId;
      const bmnRoom = matchedBmn?.Nama_ruangan || "-";
      const obsRoom = matchedObs?.namaRuangan || matchedObs?.ruanganId || "-";

      const itemsDetail: ActivityItemDetail[] = [
        {
          id: matchedBmn?.id || bmnAssetId,
          kode: matchedBmn?.id || matchedBmn?.kode_tag_aset || bmnAssetId,
          nama: bmnName,
          kategori: matchedBmn?.TipeAset || "BMN Resmi",
          ruangan: bmnRoom,
          kondisi: matchedBmn?.Kondisi || "Baik",
          nilai: matchedBmn?._nilai_buku || matchedBmn?._harga_perolehan || 0,
          snapshot: matchedBmn,
          keterangan: `Aset resmi BMN terdaftar (Target Sinkronisasi)`,
        },
        {
          id: matchedObs?.id || observasiItemId,
          kode: matchedObs?.kodeBarang || matchedObs?.nup || `OBS-${observasiItemId}`,
          nama: obsName,
          kategori: "Observasi Ruangan",
          ruangan: obsRoom,
          kondisi: matchedObs?.kondisi || "Baik",
          volume: matchedObs?.volume || 1,
          satuan: matchedObs?.satuan || "Unit",
          nilai: matchedObs?.jumlahHarga || matchedObs?.hargaSatuan || 0,
          snapshot: matchedObs,
          keterangan: `Data temuan lapangan berhasil dicocokkan ke aset resmi BMN (${bmnAssetId}) dan dihapus dari observasi lapangan.`,
        },
      ];

      appendActivity({
        pengguna: user,
        role: "Operator Aset",
        menu: "Sinkronisasi",
        aksi: `Sinkronisasi data observasi "${obsName}" (${obsRoom}) → Aset resmi BMN ${bmnAssetId} (${bmnName})`,
        target_type: "Asset",
        target_id: bmnAssetId,
        items_count: 2,
        items_detail: itemsDetail,
        status: "Berhasil",
        jenis: "update",
      });
    },
    [observasiItems, assets, appendActivity],
  );

  const value: DataStoreContextType = {
    assets,
    maintenanceTickets,
    mutationRequests,
    procurementRequests,
    stockOpnameRecords,
    documents,
    activityLogs,
    users,
    rooms,
    ruangan,
    observasiItems,
    fetchRuangan,
    fetchObservasi,
    getGedungList,
    getRuanganList,
    createRuangan,
    updateRuangan,
    deleteRuangan,
    deleteGedung,
    saveRoomObservasi,
    deleteRoomObservasi,
    syncObservasiWithBmn,
    getObservasiForRoom,
    getObservasiSummary,
    selectedAssetId,
    setSelectedAssetId,
    filters,
    setFilters,
    resetFilters,
    pendingNav,
    navigateTo,
    consumePendingNav,
    getAssetById,
    getAssetByTag,
    getAssetsByJenis,
    getAssetsByUnit,
    getAssetsByRoom,
    getAssetsByPIC,
    filteredAssets,
    computeTotalAssets,
    computeTotalBookValue,
    computeTotalAcquisitionValue,
    computeTotalDepreciation,
    computeStockOpnameProgress,
    computeMissingAssets,
    computeUnverifiedAssets,
    computeAssetsWithoutClearLocation,
    computeAssetsWithoutPIC,
    computeMaintenanceOverdue,
    computeTopUnits,
    computeTopMaintenanceCost,
    computeKondisiBreakdown,

    computeProcurementNeed,
    computeReplacementCandidates,
    currentUser,
    setCurrentUser,
    clearSession,
    fetchUsers,
    addUser,
    updateUser,
    updateUserRole,
    revokeUserRole,
    approveUser,
    resetUserPassword,
    deleteUser,
    upsertAsset,
    insertBulkAssets,
    deleteAsset,
    deleteAssetsByJenis,
    recordStockOpname,
    revertStockOpname,
    completeMaintenance,
    fetchMutasi,
    createMutation,
    approveMutation,
    rejectMutation,
    cancelMutation,
    completeProcurement,
    uploadDocument,
    appendActivity,
  };

  return <DataStoreContext.Provider value={value}>{children}</DataStoreContext.Provider>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge color helpers — rule-based, exposed for any page to consume.
// ─────────────────────────────────────────────────────────────────────────────

export function badgeColorFor(status: string): "green" | "yellow" | "blue" | "red" | "gray" {
  if (
    ["Baik", "Aktif", "Selesai", "Terverifikasi", "Disetujui", "Verified", "Lengkap", "Sesuai", "Digunakan", "Jelas"].includes(
      status,
    )
  )
    return "green";
  if (["Menunggu Persetujuan", "Due Soon", "Perlu Verifikasi", "Perlu Monitoring", "Pending", "Rusak Ringan"].includes(status))
    return "yellow";
  if (["Dalam Proses", "Scheduled", "Dalam Pengadaan", "Korektif", "Dipinjam"].includes(status)) return "blue";
  if (
    [
      "Rusak Berat",
      "Overdue",
      "Ditolak",
      "Tidak Ditemukan",
      "Selisih",
      "Konflik Data",
      "Prioritas Penggantian",
      "Dihapus",
      "Tidak Sesuai",
      "Tidak Digunakan",
      "Gagal",
    ].includes(status)
  )
    return "red";
  return "gray";
}

export function badgeClass(status: string): string {
  const c = badgeColorFor(status);
  return {
    green: "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-700",
    blue: "bg-blue-100 text-blue-700",
    red: "bg-red-100 text-red-700",
    gray: "bg-gray-100 text-gray-600",
  }[c];
}
