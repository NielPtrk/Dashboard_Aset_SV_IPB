import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  nama: string;

  @Column({ unique: true, nullable: true })
  username: string;

  @Column({ nullable: true })
  email: string;

  @Column({ select: false, nullable: true })
  password_hash: string | null;

  @Column({ default: "Tanpa Role" })
  role: string;

  @Column({ default: "Sekolah Vokasi (SV)", nullable: true })
  unit: string;

  @Column({ nullable: true })
  jabatan: string;

  @Column({ nullable: true })
  no_telp: string;

  @Column({ default: true })
  aktif: boolean;

  @Column({ default: "aktif" })
  status: string; // 'aktif' | 'nonaktif'

  @Column({ default: false })
  must_change_password: boolean;

  @Column({ default: 1 })
  token_version: number;

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
