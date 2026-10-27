import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("mutations")
@Index(["asset_id"])
@Index(["status"])
@Index(["jenis"])
export class Mutasi {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  nomor_mutasi: string;

  @Column()
  asset_id: string;

  @Column({ nullable: true })
  kode_aset: string;

  @Column({ nullable: true })
  nama_aset: string;

  @Column({ nullable: true })
  nup: string;

  @Column({ type: "text", nullable: true })
  foto_bukti: string;

  @Column({ default: "Pindah Ruangan" })
  jenis: string; // "Pindah Gedung" | "Pindah Ruangan" | "Ganti PIC" | "Antar Unit"

  @Column({ type: "date" })
  tanggal: string;

  @Column({ type: "date", nullable: true })
  tgl_ajuan: string;

  @Column({ default: "Menunggu" })
  status: string; // "Menunggu" | "Disetujui" | "Ditolak"

  @Column({ nullable: true })
  dari_gedung: string;

  @Column({ nullable: true })
  ke_gedung: string;

  @Column({ nullable: true })
  dari_ruangan: string;

  @Column({ nullable: true })
  ke_ruangan: string;

  @Column({ nullable: true })
  dari_pic: string;

  @Column({ nullable: true })
  ke_pic: string;

  @Column({ nullable: true })
  dari_unit: string;

  @Column({ nullable: true })
  ke_unit: string;

  @Column({ type: "text", nullable: true })
  catatan: string;

  @Column({ nullable: true })
  pengaju: string;

  @Column({ nullable: true })
  approver: string;

  @Column({ type: "text", nullable: true })
  catatan_approver: string;

  @Column({ type: "timestamp", nullable: true })
  tanggal_approval: Date;

  @Column({ type: "jsonb", nullable: true, default: () => "'[]'" })
  dokumen: Array<{ nama: string; ukuran: string; url?: string }>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
