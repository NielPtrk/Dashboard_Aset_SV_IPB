import { Injectable, NotFoundException, BadRequestException, ForbiddenException, OnModuleInit, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Like, In } from "typeorm";
import * as bcrypt from "bcryptjs";
import { User } from "./user.entity";
import { NotificationsService } from "../notifications/notifications.service";

export const BAKU_ROLES = ["Admin Sistem", "Pimpinan", "Admin Pusat", "Pekerja Stock Opname"] as const;
export type BakuRole = typeof BAKU_ROLES[number];

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    try {
      // 1. Purge the 4 dummy users from the database if they exist
      const dummyEmails = [
        "rina@ipb.ac.id", "budi@ipb.ac.id", "anita@ipb.ac.id", "rudi@ipb.ac.id",
        "rina.m@apps.ipb.ac.id", "budis@apps.ipb.ac.id", "anita.w@apps.ipb.ac.id", "rudih@ipb.ac.id"
      ];
      await this.repo.delete({ email: In(dummyEmails) });

      // Promote any pending verification registrations to menunggu_persetujuan
      await this.repo.createQueryBuilder()
        .update()
        .set({ status: "menunggu_persetujuan" })
        .where("status = :s", { s: "menunggu_verifikasi" })
        .execute();

      // 2. Ensure the primary Admin Sistem (Othniel Patrick Limbong) exists and is protected.
      // Cari dengan email lama ATAU email baru (setelah reset script), atau berdasarkan role Admin Sistem.
      const canonicalEmail = "othnielpatrick@apps.ipb.ac.id"; // email baru (tanpa titik)
      const legacyEmail    = "othniel.patrick@apps.ipb.ac.id"; // email lama (dengan titik)

      let admin = await this.repo.findOne({ where: { email: canonicalEmail } });
      if (!admin) {
        admin = await this.repo.findOne({ where: { email: legacyEmail } });
      }
      if (!admin) {
        // Fallback: cari berdasarkan role Admin Sistem
        admin = await this.repo.findOne({ where: { role: "Admin Sistem" } });
      }

      if (!admin) {
        // Akun belum ada sama sekali → buat dengan email kanonik & password default
        const hash = await bcrypt.hash("admin123", 10);
        admin = this.repo.create({
          nama: "Othniel Patrick Limbong",
          email: canonicalEmail,
          password_hash: hash,
          role: "Admin Sistem",
          unit: "Sekolah Vokasi (SV)",
          status: "aktif",
          aktif: true,
        });
        await this.repo.save(admin);
        this.logger.log(`Akun Admin Sistem utama (${canonicalEmail}) berhasil diinisialisasi.`);
      } else {
        // Akun ditemukan → pastikan properti kanonik benar (JANGAN timpa password_hash)
        let needsSave = false;
        if (admin.email !== canonicalEmail) {
          admin.email = canonicalEmail;
          needsSave = true;
          this.logger.log(`Email Admin Sistem diperbarui dari ${legacyEmail} ke ${canonicalEmail}.`);
        }
        if (admin.role !== "Admin Sistem") { admin.role = "Admin Sistem"; needsSave = true; }
        if (admin.unit !== "Sekolah Vokasi (SV)") { admin.unit = "Sekolah Vokasi (SV)"; needsSave = true; }
        if (!admin.aktif) { admin.aktif = true; needsSave = true; }
        if (admin.status !== "aktif") { admin.status = "aktif"; needsSave = true; }
        if (needsSave) {
          await this.repo.save(admin);
          this.logger.log(`Akun Admin Sistem utama (${canonicalEmail}) disinkronkan.`);
        }
      }
    } catch (err) {
      this.logger.warn(`Inisialisasi user seed dilewati: ${(err as Error).message}`);
    }
  }

  async findAll(params: { page?: number; limit?: number; search?: string; role?: string; status?: string } = {}) {
    const { page = 1, limit = 50, search, role, status } = params;
    const where: any = {};

    if (search) {
      where.nama = Like(`%${search}%`);
    }
    if (role && role !== "Semua") {
      where.role = role;
    }
    if (status && status !== "Semua") {
      if (status === "menunggu_persetujuan") {
        where.status = In(["menunggu_persetujuan", "menunggu_verifikasi"]);
      } else {
        where.status = status;
      }
    }

    const [data, total] = await this.repo.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: "DESC" },
    });

    return { data, total, page, limit };
  }

  async findById(id: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User dengan ID ${id} tidak ditemukan.`);
    return user;
  }

  async findByEmail(email: string): Promise<User & { password_hash: string }> {
    return this.repo
      .createQueryBuilder("u")
      .addSelect("u.password_hash")
      .where("u.email = :email", { email: email.toLowerCase().trim() })
      .getOne() as Promise<User & { password_hash: string }>;
  }

  async findByVerificationToken(token: string): Promise<User | null> {
    return this.repo.findOne({ where: { verification_token: token } });
  }

  async findByResetToken(token: string): Promise<User | null> {
    return this.repo.findOne({ where: { reset_password_token: token } });
  }

  async create(payload: Partial<User> & { password?: string }): Promise<User> {
    // Admin Sistem CANNOT be created or assigned through API/Registration
    if (payload.role === "Admin Sistem") {
      throw new BadRequestException("Role Admin Sistem hanya ada 1 untuk akun utama dan tidak dapat diberikan kepada akun lain.");
    }

    const email = payload.email?.toLowerCase().trim();
    if (!email) throw new BadRequestException("Email wajib diisi.");

    const existing = await this.repo.findOne({ where: { email } });
    if (existing) throw new BadRequestException("Email sudah terdaftar dalam sistem.");

    const { password, ...rest } = payload;
    const hash = password ? await bcrypt.hash(password, 10) : "";
    const user = this.repo.create({
      status: rest.status || "aktif",
      aktif: rest.aktif !== undefined ? rest.aktif : true,
      ...rest,
      email,
      unit: rest.unit || "Sekolah Vokasi (SV)",
      role: rest.role || "Tanpa Role",
      password_hash: hash,
    });
    return this.repo.save(user);
  }

  async update(id: string, payload: Partial<User> & { password?: string }): Promise<User> {
    const user = await this.findById(id);

    // Protection: Admin Sistem role cannot be altered via generic update
    if (user.role === "Admin Sistem" && payload.role && payload.role !== "Admin Sistem") {
      throw new ForbiddenException("Role Admin Sistem dilindungi dari perubahan (anti-terkunci).");
    }

    if (payload.role === "Admin Sistem" && user.email !== "othnielpatrick@apps.ipb.ac.id" && user.email !== "othniel.patrick@apps.ipb.ac.id") {
      throw new BadRequestException("Role Admin Sistem tidak dapat diberikan kepada akun lain.");
    }

    const { password, ...rest } = payload;
    if (password) {
      (rest as User & { password_hash: string }).password_hash = await bcrypt.hash(password, 10);
    }
    await this.repo.update(id, rest);
    return this.findById(id);
  }

  async updateRole(id: string, newRole: string): Promise<User> {
    const user = await this.findById(id);

    // Anti-lockout: Admin Sistem cannot be demoted or changed
    if (user.role === "Admin Sistem" || user.email === "othnielpatrick@apps.ipb.ac.id" || user.email === "othniel.patrick@apps.ipb.ac.id") {
      throw new ForbiddenException("Akun Admin Sistem dilindungi dan tidak dapat diubah rolenya (anti-terkunci).");
    }

    // Role Admin Sistem cannot be assigned to anyone else
    if (newRole === "Admin Sistem") {
      throw new BadRequestException("Role Admin Sistem tidak dapat diberikan kepada akun lain.");
    }

    const validRoles = ["Pimpinan", "Admin Pusat", "Pekerja Stock Opname", "Tanpa Role"];
    if (!validRoles.includes(newRole)) {
      throw new BadRequestException(`Role tidak valid. Pilihan role: Pimpinan, Admin Pusat, Pekerja Stock Opname.`);
    }

    user.role = newRole;
    await this.repo.save(user);
    this.logger.log(`Role user ${user.nama} (${user.email}) diubah menjadi ${newRole}`);
    return user;
  }

  async revokeRole(id: string): Promise<User> {
    const user = await this.findById(id);

    // Anti-lockout: Admin Sistem cannot have role revoked
    if (user.role === "Admin Sistem" || user.email === "othnielpatrick@apps.ipb.ac.id" || user.email === "othniel.patrick@apps.ipb.ac.id") {
      throw new ForbiddenException("Role Admin Sistem tidak dapat dicabut (anti-terkunci).");
    }

    user.role = "Tanpa Role";
    await this.repo.save(user);
    this.logger.log(`Role user ${user.nama} (${user.email}) telah dicabut (menjadi Tanpa Role)`);
    return user;
  }

  async approveRegistration(id: string, dto: { action: "setujui" | "tolak"; role?: string; catatan?: string }): Promise<User> {
    const user = await this.findById(id);

    if (dto.action === "setujui") {
      if (!dto.role) {
        throw new BadRequestException("Pilih role untuk user yang disetujui.");
      }
      if (dto.role === "Admin Sistem") {
        throw new BadRequestException("Role Admin Sistem tidak dapat diberikan.");
      }
      const validRoles = ["Pimpinan", "Admin Pusat", "Pekerja Stock Opname"];
      if (!validRoles.includes(dto.role)) {
        throw new BadRequestException(`Role tidak valid. Pilih antara: ${validRoles.join(", ")}`);
      }

      user.status = "aktif";
      user.aktif = true;
      user.role = dto.role;
      user.catatan_admin = dto.catatan || null;
      await this.repo.save(user);

      // Send approval notification email
      await this.notifications.sendApprovalEmail(user.email, user.nama, true, dto.role, dto.catatan);
      this.logger.log(`Pendaftaran ${user.nama} (${user.email}) disetujui dengan role ${dto.role}`);
    } else {
      user.status = "ditolak";
      user.aktif = false;
      user.role = "Tanpa Role";
      user.catatan_admin = dto.catatan || null;
      await this.repo.save(user);

      // Send rejection notification email
      await this.notifications.sendApprovalEmail(user.email, user.nama, false, undefined, dto.catatan);
      this.logger.log(`Pendaftaran ${user.nama} (${user.email}) ditolak.`);
    }

    return user;
  }

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);

    // Anti-lockout: Admin Sistem cannot be deleted
    if (user.role === "Admin Sistem" || user.email === "othnielpatrick@apps.ipb.ac.id" || user.email === "othniel.patrick@apps.ipb.ac.id") {
      throw new ForbiddenException("Akun Admin Sistem dilindungi dan tidak dapat dihapus.");
    }

    await this.repo.delete(id);
    this.logger.log(`User ${user.nama} (${user.email}) dihapus.`);
  }

  async saveRaw(user: User): Promise<User> {
    return this.repo.save(user);
  }
}
