import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("guidelines")
export class Guideline {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ nullable: true })
  kategori: string;

  @Column({ nullable: true })
  akun: string;

  @Column({ nullable: true })
  psak: string;

  @Column({ nullable: true })
  kk: string;

  @Column({ nullable: true })
  pt: string;

  @Column({ nullable: true })
  divisi: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
