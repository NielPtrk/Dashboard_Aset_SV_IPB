import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  OnModuleInit,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import * as bcrypt from "bcryptjs";
import { User } from "./user.entity";
import { NotificationsService } from "../notifications/notifications.service";

export const BAKU_ROLES = [
  "Admin Sistem",
  "Pimpinan",
  "Admin Pusat",
  "Pekerja Stock Opname",
] as const;
export type BakuRole = (typeof BAKU_ROLES)[number];

export function normalizeUsername(str: string): string {
  if (!str || typeof str !== "string") return "";
  return str.trim().replace(/\s+/g, " ");
}

export function validateUsernameFormat(username: string): { valid: boolean; message?: string } {
  const norm = normalizeUsername(username);
  if (norm.length < 3 || norm.length > 100) {
    return { valid: false, message: "Username harus memiliki panjang antara 3 hingga 100 karakter." };
  }
  // Allow letters, numbers, spaces, and punctuation: . , - ' _ ( )
  const allowedRegex = /^[\p{L}\p{N}\s.,'_\-()]+$/u;
  if (!allowedRegex.test(norm)) {
    return { valid: false, message: "Username hanya boleh memuat huruf, angka, spasi, dan tanda baca gelar (. , - ' _ ( ))." };
  }
  if (/<[a-z][\s\S]*>/i.test(norm) || /[<>{}\\]/.test(norm)) {
    return { valid: false, message: "Username memuat karakter berbahaya yang tidak diizinkan." };
  }
  return { valid: true };
}

export function validatePasswordFormat(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < 8) {
    return { valid: false, message: "Kata sandi minimal 8 karakter." };
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (!hasLetter || !hasNumber) {
    return { valid: false, message: "Kata sandi wajib memuat kombinasi huruf dan angka." };
  }
  return { valid: true };
}

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
      // 1. Purge dummy test emails if any exist
      const dummyEmails = [
        "rina@ipb.ac.id", "budi@ipb.ac.id", "anita@ipb.ac.id", "rudi@ipb.ac.id",
        "rina.m@apps.ipb.ac.id", "budis@apps.ipb.ac.id", "anita.w@apps.ipb.ac.id", "rudih@ipb.ac.id"
      ];
      await this.repo.delete({ email: In(dummyEmails) });

      // 2. Synchronize existing accounts: populate username from nama and migrate pending/rejected statuses
      const allUsers = await this.repo.find();
      for (const u of allUsers) {
        let needsSave = false;
        if (!u.username && u.nama) {
          u.username = normalizeUsername(u.nama);
          needsSave = true;
        }
        if (u.status === "menunggu_verifikasi" || u.status === "menunggu_persetujuan" || u.status === "ditolak") {
          u.status = "nonaktif";
          u.aktif = false;
          needsSave = true;
        }
        if (u.token_version === undefined || u.token_version === null) {
          u.token_version = 1;
          needsSave = true;
        }
        if (needsSave) {
          await this.repo.save(u);
        }
      }

      // 3. Ensure primary Admin Sistem account exists with username 'Admin Sistem'
      // Must select password_hash to check if it's missing (legacy Google OAuth accounts have no password)
      let admin = await this.repo
        .createQueryBuilder("u")
        .addSelect("u.password_hash")
        .where("u.username = :username", { username: "Admin Sistem" })
        .getOne();
      if (!admin) {
        admin = await this.repo
          .createQueryBuilder("u")
          .addSelect("u.password_hash")
          .where("u.role = :role", { role: "Admin Sistem" })
          .getOne();
      }

      const defaultAdminPassword = process.env.ADMIN_INIT_PASSWORD || "Admin123";
      const forceReset = process.env.ADMIN_FORCE_RESET_PASSWORD === "true";

      if (!admin) {
        // Initial setup: no Admin Sistem exists at all
        const hash = await bcrypt.hash(defaultAdminPassword, 10);
        admin = this.repo.create({
          username: "Admin Sistem",
          nama: "Admin Sistem",
          password_hash: hash,
          role: "Admin Sistem",
          unit: "Sekolah Vokasi (SV)",
          jabatan: "Admin Sistem",
          status: "aktif",
          aktif: true,
          must_change_password: false,
          token_version: 1,
        });
        await this.repo.save(admin);
        this.logger.log(`[INIT] Akun Admin Sistem baru dibuat. Username: 'Admin Sistem', Password: '${defaultAdminPassword}'`);
      } else {
        // Sync metadata fields
        let needsSave = false;
        if (admin.username !== "Admin Sistem") { admin.username = "Admin Sistem"; needsSave = true; }
        if (admin.nama !== "Admin Sistem") { admin.nama = "Admin Sistem"; needsSave = true; }
        if (admin.role !== "Admin Sistem") { admin.role = "Admin Sistem"; needsSave = true; }
        if (!admin.aktif) { admin.aktif = true; needsSave = true; }
        if (admin.status !== "aktif") { admin.status = "aktif"; needsSave = true; }

        // CRITICAL: Set password via direct SQL to bypass TypeORM select:false issues
        // Triggered when: (a) no password_hash exists (legacy OAuth), OR (b) ADMIN_FORCE_RESET_PASSWORD=true
        const needsPasswordReset = !admin.password_hash || forceReset;
        if (needsPasswordReset) {
          const hash = await bcrypt.hash(defaultAdminPassword, 10);
          // Use raw query to guarantee password_hash is written regardless of ORM state
          await this.repo.query(
            `UPDATE users SET password_hash = $1, must_change_password = false, token_version = COALESCE(token_version, 1) + 1 WHERE id = $2`,
            [hash, admin.id],
          );
          this.logger.log(`[INIT] Admin Sistem password di-reset via SQL langsung. Password: '${defaultAdminPassword}' (forceReset=${forceReset})`);
        }

        if (needsSave) {
          await this.repo.save(admin);
          this.logger.log("[INIT] Akun Admin Sistem metadata disinkronkan.");
        }
      }
    } catch (err) {
      this.logger.warn(`Inisialisasi user seed dilewati: ${(err as Error).message}`);
    }
  }

  async findAll(params: { page?: number; limit?: number; search?: string; role?: string; status?: string } = {}) {
    const { page = 1, limit = 50, search, role, status } = params;
    const qb = this.repo.createQueryBuilder("u");

    if (search) {
      qb.andWhere(
        "(LOWER(u.username) LIKE LOWER(:s) OR LOWER(u.nama) LIKE LOWER(:s) OR LOWER(u.unit) LIKE LOWER(:s) OR LOWER(u.jabatan) LIKE LOWER(:s))",
        { s: `%${search}%` },
      );
    }
    if (role && role !== "Semua" && role !== "Semua Role") {
      qb.andWhere("u.role = :role", { role });
    }
    if (status && status !== "Semua" && status !== "Semua Status") {
      qb.andWhere("u.status = :status", { status });
    }

    qb.orderBy("u.created_at", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findById(id: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User dengan ID ${id} tidak ditemukan.`);
    return user;
  }

  async findByIdWithPassword(id: string): Promise<User & { password_hash: string }> {
    const user = await this.repo
      .createQueryBuilder("u")
      .addSelect("u.password_hash")
      .where("u.id = :id", { id })
      .getOne();
    if (!user) throw new NotFoundException(`User dengan ID ${id} tidak ditemukan.`);
    return user as User & { password_hash: string };
  }

  async findByUsername(rawUsername: string): Promise<(User & { password_hash: string }) | null> {
    const norm = normalizeUsername(rawUsername);
    if (!norm) return null;

    return this.repo
      .createQueryBuilder("u")
      .addSelect("u.password_hash")
      .where("LOWER(TRIM(REGEXP_REPLACE(COALESCE(u.username, u.nama), '\\s+', ' ', 'g'))) = LOWER(:username)", {
        username: norm,
      })
      .getOne() as Promise<(User & { password_hash: string }) | null>;
  }

  async create(payload: {
    username: string;
    password?: string;
    role: string;
    unit: string;
    jabatan?: string;
  }): Promise<User> {
    if (payload.role === "Admin Sistem") {
      throw new BadRequestException("Role Admin Sistem hanya untuk akun utama dan tidak dapat diberikan kepada akun lain.");
    }

    const normUsername = normalizeUsername(payload.username);
    const uVal = validateUsernameFormat(normUsername);
    if (!uVal.valid) {
      throw new BadRequestException(uVal.message);
    }

    // Check duplicate username (case-insensitive & collapsed whitespace)
    const existing = await this.findByUsername(normUsername);
    if (existing) {
      throw new BadRequestException("Username sudah terdaftar dalam sistem.");
    }

    const password = payload.password || "";
    const pVal = validatePasswordFormat(password);
    if (!pVal.valid) {
      throw new BadRequestException(pVal.message);
    }

    const hash = await bcrypt.hash(password, 10);
    const user = this.repo.create({
      username: normUsername,
      nama: normUsername, // Username sekaligus nama yang tampil di seluruh sistem
      jabatan: payload.jabatan ? payload.jabatan.trim() : null,
      role: payload.role || "Pekerja Stock Opname",
      unit: payload.unit || "Sekolah Vokasi",
      status: "aktif",
      aktif: true,
      must_change_password: false,
      token_version: 1,
      password_hash: hash,
    });
    return this.repo.save(user);
  }

  async update(id: string, payload: Partial<User> & { password?: string }): Promise<User> {
    const user = await this.findById(id);

    // Anti-lockout: Admin Sistem main account protection
    const isMainAdmin = user.id === "U-001" || user.username === "Admin Sistem" || user.role === "Admin Sistem";

    if (isMainAdmin && payload.role && payload.role !== "Admin Sistem") {
      throw new ForbiddenException("Role Admin Sistem dilindungi dari perubahan (anti-lockout).");
    }

    if (isMainAdmin && (payload.status === "nonaktif" || payload.aktif === false)) {
      throw new ForbiddenException("Akun Admin Sistem utama tidak dapat dinonaktifkan (anti-lockout).");
    }

    if (payload.role === "Admin Sistem" && !isMainAdmin) {
      throw new BadRequestException("Role Admin Sistem tidak dapat diberikan kepada akun lain.");
    }

    let tokenNeedsIncrement = false;

    // Username update
    if (payload.username && payload.username !== user.username) {
      const normUsername = normalizeUsername(payload.username);
      const uVal = validateUsernameFormat(normUsername);
      if (!uVal.valid) {
        throw new BadRequestException(uVal.message);
      }

      const existing = await this.findByUsername(normUsername);
      if (existing && existing.id !== id) {
        throw new BadRequestException("Username sudah terdaftar dalam sistem.");
      }

      user.username = normUsername;
      user.nama = normUsername; // Keep synchronized
      tokenNeedsIncrement = true;
    }

    if (payload.role && payload.role !== user.role) {
      user.role = payload.role;
      tokenNeedsIncrement = true;
    }

    if (payload.status && payload.status !== user.status) {
      user.status = payload.status;
      user.aktif = payload.status === "aktif";
      tokenNeedsIncrement = true;
    }

    if (payload.aktif !== undefined && payload.aktif !== user.aktif) {
      user.aktif = payload.aktif;
      user.status = payload.aktif ? "aktif" : "nonaktif";
      tokenNeedsIncrement = true;
    }

    if (payload.unit !== undefined) {
      user.unit = payload.unit;
    }

    if (payload.jabatan !== undefined) {
      user.jabatan = payload.jabatan;
    }

    if (payload.password) {
      const pVal = validatePasswordFormat(payload.password);
      if (!pVal.valid) {
        throw new BadRequestException(pVal.message);
      }
      user.password_hash = await bcrypt.hash(payload.password, 10);
      user.must_change_password = !isMainAdmin;
      tokenNeedsIncrement = true;
    }

    if (tokenNeedsIncrement) {
      user.token_version = (user.token_version || 1) + 1;
    }

    await this.repo.save(user);
    return this.findById(id);
  }

  async resetPassword(
    id: string,
    temporaryPassword?: string,
  ): Promise<{ message: string; username: string; password: string }> {
    const user = await this.findById(id);

    const isMainAdmin = user.id === "U-001" || user.username === "Admin Sistem" || user.role === "Admin Sistem";

    const newPassword =
      temporaryPassword && temporaryPassword.trim().length >= 8
        ? temporaryPassword.trim()
        : this.generateRandomPassword();

    const pVal = validatePasswordFormat(newPassword);
    if (!pVal.valid) {
      throw new BadRequestException(pVal.message);
    }

    user.password_hash = await bcrypt.hash(newPassword, 10);
    user.must_change_password = false;
    user.token_version = (user.token_version || 1) + 1; // Invalidate old session tokens
    await this.repo.save(user);

    this.logger.log(`Password akun ${user.username || user.nama} berhasil direset oleh Admin Sistem.`);

    return {
      message: "Kata sandi berhasil diatur ulang.",
      username: user.username || user.nama,
      password: newPassword,
    };
  }

  private generateRandomPassword(): string {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const digits = "0123456789";
    let pwd = "";
    for (let i = 0; i < 6; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    for (let i = 0; i < 3; i++) {
      pwd += digits.charAt(Math.floor(Math.random() * digits.length));
    }
    return pwd;
  }

  async updateRole(id: string, newRole: string): Promise<User> {
    const user = await this.findById(id);

    const isMainAdmin = user.id === "U-001" || user.username === "Admin Sistem" || user.role === "Admin Sistem";
    if (isMainAdmin) {
      throw new ForbiddenException("Akun Admin Sistem dilindungi dan tidak dapat diubah rolenya (anti-lockout).");
    }

    if (newRole === "Admin Sistem") {
      throw new BadRequestException("Role Admin Sistem tidak dapat diberikan kepada akun lain.");
    }

    const validRoles = ["Pimpinan", "Admin Pusat", "Pekerja Stock Opname", "Tanpa Role"];
    if (!validRoles.includes(newRole)) {
      throw new BadRequestException("Role tidak valid. Pilihan role: Pimpinan, Admin Pusat, Pekerja Stock Opname.");
    }

    user.role = newRole;
    user.token_version = (user.token_version || 1) + 1;
    await this.repo.save(user);
    this.logger.log(`Role user ${user.username || user.nama} diubah menjadi ${newRole}`);
    return user;
  }

  async revokeRole(id: string): Promise<User> {
    const user = await this.findById(id);

    const isMainAdmin = user.id === "U-001" || user.username === "Admin Sistem" || user.role === "Admin Sistem";
    if (isMainAdmin) {
      throw new ForbiddenException("Role Admin Sistem tidak dapat dicabut (anti-lockout).");
    }

    user.role = "Tanpa Role";
    user.token_version = (user.token_version || 1) + 1;
    await this.repo.save(user);
    this.logger.log(`Role user ${user.username || user.nama} telah dicabut (menjadi Tanpa Role)`);
    return user;
  }

  async approveRegistration(
    id: string,
    _dto: { action: "setujui" | "tolak"; role?: string; catatan?: string },
  ): Promise<User> {
    throw new BadRequestException("Pendaftaran mandiri dinonaktifkan. Akun hanya dibuat langsung oleh Admin Sistem.");
  }

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);

    const isMainAdmin = user.id === "U-001" || user.username === "Admin Sistem" || user.role === "Admin Sistem";
    if (isMainAdmin) {
      throw new ForbiddenException("Akun Admin Sistem dilindungi dan tidak dapat dihapus.");
    }

    await this.repo.delete(id);
    this.logger.log(`User ${user.username || user.nama} dihapus.`);
  }

  async saveRaw(user: User): Promise<User> {
    return this.repo.save(user);
  }
}
