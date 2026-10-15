import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from "typeorm";

@Entity("observasi_item")
@Index(["ruanganId"])
@Index(["tahun"])
@Index(["kampus"])
@Index(["namaGedung"])
export class ObservasiItem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ nullable: true })
  ruanganId: string; // Foreign key / matching master room id

  @Column({ nullable: true })
  kampus: string; // e.g. "Kampus Cilibende"

  @Column({ nullable: true })
  namaGedung: string;

  @Column({ nullable: true })
  kodeRuangan: string;

  @Column({ nullable: true })
  namaRuangan: string;

  @Column({ type: "int", default: 2026 })
  tahun: number; // Periode Tahun Observasi

  @Column({ default: "Sekolah Vokasi (SV)" })
  unitKerja: string;

  @Column({ type: "int", default: 1 })
  noUrut: number;

  @Column({ nullable: true })
  kodeBarang: string;

  @Column()
  namaBarang: string;

  @Column({ nullable: true })
  nup: string;

  @Column({ nullable: true })
  merekType: string;

  @Column({ nullable: true })
  tahunPerolehan: string;

  @Column({ type: "decimal", precision: 15, scale: 2, default: 0 })
  hargaSatuan: number;

  @Column({ type: "int", default: 1 })
  volume: number;

  @Column({ default: "unit" })
  satuan: string;

  @Column({ type: "decimal", precision: 15, scale: 2, default: 0 })
  jumlahHarga: number;

  @Column({ default: "Tidak Diketahui" })
  sumberDana: string;

  @Column({ default: "Baik" })
  kondisi: string; // Baik / Rusak Ringan / Rusak Berat

  @Column({ nullable: true })
  penguasaan: string;

  @Column({ nullable: true })
  keterangan: string;

  @Column({ default: "Petugas Lapangan" })
  petugas: string;

  @Column({ default: "Tersimpan" })
  status: string; // Draft / Tersimpan / Selesai

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
