import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from "typeorm";

@Entity("assets")
@Index(["jenis_aset"])
@Index(["kondisi"])
@Index(["id_ruangan"])
@Index(["nama_barang"])
export class Asset {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ unique: true })
  kode_tag_aset: string;

  @Column()
  nama_barang: string;

  @Column({ type: "varchar", length: 10 })
  jenis_aset: "PM" | "ATB" | "ATL" | "AL";

  @Column({ nullable: true })
  merk_type: string;

  @Column({ nullable: true })
  spesifikasi: string;

  @Column({ type: "date", nullable: true })
  tgl_perolehan: string;

  @Column({ type: "numeric", default: 0 })
  harga_perolehan: number;

  @Column({ nullable: true })
  sumber_dana: string;

  @Column({ default: "Baik" })
  kondisi: string;

  @Column({ nullable: true })
  id_ruangan: string;

  @Column({ nullable: true })
  nama_ruangan: string;

  @Column({ nullable: true })
  gedung: string;

  @Column({ nullable: true })
  lantai: string;

  @Column({ nullable: true })
  nama_unit: string;

  @Column({ nullable: true })
  pengguna: string;

  @Column({ type: "numeric", default: 0 })
  masa_manfaat_tahun: number;

  @Column({ type: "numeric", default: 0 })
  sisa_masa_manfaat_bulan: number;

  @Column({ type: "numeric", default: 0 })
  nilai_buku: number;

  @Column({ type: "numeric", default: 0 })
  akumulasi_penyusutan: number;

  @Column({ type: "numeric", default: 0 })
  penyusutan_per_bulan: number;

  @Column({ default: "Aktif" })
  trx_status: string;

  @Column({ default: "Verified" })
  verifikasi_status: string;

  @Column({ type: "jsonb", nullable: true })
  extra_fields: Record<string, any>;

  @Column({ type: "integer", nullable: true, default: null })
  row_order: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
