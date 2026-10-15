import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from "typeorm";

@Entity("ruangan")
@Index(["kampus"])
@Index(["namaGedung"])
@Index(["kategori"])
export class Ruangan {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "int", nullable: true })
  sourceId: number; // Original ID from Excel

  @Column()
  kampus: string; // e.g. "Kampus Cilibende" | "Kampus Gunung Gede" | "Kampus Baranangsiang" | "Lainnya"

  @Column()
  namaGedung: string; // Clean building name without campus label

  @Column({ nullable: true })
  gedungRaw: string; // Original raw value from "Gedung" column

  @Column({ type: "int", default: 1 })
  level: number; // Floor/lantai number

  @Column({ nullable: true })
  alamat: string;

  @Column({ nullable: true })
  kodeRuangan: string;

  @Column()
  namaRuangan: string;

  @Column({ nullable: true })
  kategori: string;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  luas: number;

  @Column({ type: "int", default: 0 })
  kapasitas: number;

  @Column({ nullable: true })
  unitPengguna: string; // From "Keterangan" column

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
