import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  nama: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password_hash: string;

  @Column({ default: "Tanpa Role" })
  role: string;

  @Column({ default: "Sekolah Vokasi (SV)", nullable: true })
  unit: string;

  @Column({ nullable: true })
  no_telp: string;

  @Column({ default: true })
  aktif: boolean;

  @Column({ default: "menunggu_verifikasi" })
  status: string; // 'menunggu_verifikasi' | 'menunggu_persetujuan' | 'aktif' | 'ditolak' | 'nonaktif'

  @Column({ nullable: true })
  harapan_role: string;

  @Column({ nullable: true })
  catatan_admin: string;

  @Column({ nullable: true })
  verification_token: string;

  @Column({ nullable: true })
  reset_password_token: string;

  @Column({ nullable: true })
  reset_password_expires: Date;

  @Column({ nullable: true })
  avatar_url: string;

  @Column({ nullable: true })
  last_login: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
