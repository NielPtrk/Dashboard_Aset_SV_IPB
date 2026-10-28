import { Injectable, UnauthorizedException, BadRequestException, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import axios from "axios";
import { UsersService, normalizeUsername, validatePasswordFormat } from "../users/users.service";
import { NotificationsService } from "../notifications/notifications.service";
import { LoginDto } from "./dto/login.dto";
import { ChangePasswordDto } from "./dto/register.dto";

interface LoginAttemptRecord {
  attempts: number;
  lockedUntil: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  // Rate limiting / lock map keyed by lowercase normalized username
  private readonly loginAttempts = new Map<string, LoginAttemptRecord>();

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async login(dto: LoginDto) {
    // 1. Verify Cloudflare Turnstile token
    if (dto.turnstileToken) {
      await this.verifyTurnstile(dto.turnstileToken);
    }

    const username = normalizeUsername(dto.username);
    const lockKey = username.toLowerCase();

    // Check rate limit / temporary lockout (5 failed attempts = 15 minute lock)
    const attemptRecord = this.loginAttempts.get(lockKey);
    if (attemptRecord && attemptRecord.lockedUntil > Date.now()) {
      const remainingMinutes = Math.ceil((attemptRecord.lockedUntil - Date.now()) / 60000);
      throw new UnauthorizedException(
        `Terlalu banyak percobaan masuk yang gagal. Akun dikunci sementara demi keamanan. Silakan coba lagi dalam ${remainingMinutes} menit.`,
      );
    }

    const user = await this.users.findByUsername(username);

    // Uniform error message for non-existent user or invalid password to avoid username enumeration
    if (!user) {
      this.recordFailedAttempt(lockKey);
      throw new UnauthorizedException("Username atau kata sandi salah.");
    }

    // Check account status
    if (user.status === "nonaktif" || !user.aktif) {
      throw new UnauthorizedException("Akun Anda berstatus nonaktif. Silakan hubungi Admin Sistem.");
    }

    if (user.role === "Tanpa Role") {
      throw new UnauthorizedException("Akses dicabut, hubungi Admin Sistem.");
    }

    if (!user.password_hash) {
      this.recordFailedAttempt(lockKey);
      throw new UnauthorizedException("Username atau kata sandi salah.");
    }

    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) {
      this.recordFailedAttempt(lockKey);
      throw new UnauthorizedException("Username atau kata sandi salah.");
    }

    // Successful login: reset failed login attempts
    this.loginAttempts.delete(lockKey);

    try {
      user.last_login = new Date();
      await this.users.saveRaw(user);
    } catch (saveErr) {
      this.logger.warn(`Gagal memperbarui last_login: ${(saveErr as Error).message}`);
    }

    return this.generateTokens(user);
  }

  private recordFailedAttempt(lockKey: string) {
    const now = Date.now();
    const existing = this.loginAttempts.get(lockKey);
    const attempts = (existing && existing.lockedUntil <= now ? 0 : existing?.attempts || 0) + 1;
    let lockedUntil = 0;

    if (attempts >= 5) {
      // 15 minutes lockout
      lockedUntil = now + 15 * 60 * 1000;
      this.logger.warn(`Username [${lockKey}] dikunci sementara selama 15 menit setelah 5x gagal login.`);
    }

    this.loginAttempts.set(lockKey, { attempts, lockedUntil });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.users.findByIdWithPassword(userId);

    const validOld = await bcrypt.compare(dto.old_password, user.password_hash);
    if (!validOld) {
      throw new BadRequestException("Kata sandi lama tidak sesuai.");
    }

    const pVal = validatePasswordFormat(dto.new_password);
    if (!pVal.valid) {
      throw new BadRequestException(pVal.message);
    }

    const hash = await bcrypt.hash(dto.new_password, 10);
    user.password_hash = hash;
    user.must_change_password = false;
    user.token_version = (user.token_version || 1) + 1; // Invalidate other older sessions
    await this.users.saveRaw(user);

    this.logger.log(`User ${user.username || user.nama} berhasil memperbarui kata sandi.`);

    return {
      message: "Kata sandi berhasil diperbarui.",
      ...this.generateTokens(user),
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.cfg.get("JWT_REFRESH_SECRET", "fallback_refresh_secret"),
      });
      const user = await this.users.findById(payload.sub);
      if (!user || !user.aktif || user.status !== "aktif" || user.role === "Tanpa Role") {
        throw new UnauthorizedException();
      }
      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException("Refresh token tidak valid atau sudah kedaluwarsa.");
    }
  }

  private generateTokens(user: {
    id: string;
    username?: string;
    nama: string;
    role: string;
    unit?: string;
    jabatan?: string;
    status?: string;
    must_change_password?: boolean;
    token_version?: number;
  }) {
    const username = user.username || user.nama;
    const payload = {
      sub: user.id,
      username,
      nama: username,
      role: user.role,
      token_version: user.token_version || 1,
    };

    const access_token = this.jwt.sign(payload);
    const refresh_token = this.jwt.sign(payload, {
      secret: this.cfg.get("JWT_REFRESH_SECRET", "fallback_refresh_secret"),
      expiresIn: this.cfg.get("JWT_REFRESH_EXPIRES_IN", "7d"),
    });

    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        username,
        nama: username, // Consistent display name across the entire app
        role: user.role,
        unit: user.unit,
        jabatan: user.jabatan,
        status: user.status,
        must_change_password: !!user.must_change_password,
      },
    };
  }

  private async verifyTurnstile(token: string): Promise<void> {
    const secret = this.cfg.get("TURNSTILE_SECRET_KEY") || "1x0000000000000000000000000000000AA";
    if (
      token === "dummy-turnstile-token" ||
      token === "turnstile-dev-token-bypass" ||
      token.startsWith("1x0000") ||
      secret.startsWith("1x0000")
    ) {
      return;
    }

    try {
      const res = await axios.post(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        new URLSearchParams({ secret, response: token }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 5000 },
      );
      if (!res.data.success) {
        throw new UnauthorizedException("Verifikasi Cloudflare Turnstile gagal. Silakan coba lagi.");
      }
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.warn(`Pemeriksaan Turnstile terlewati karena kendala jaringan: ${err.message}`);
    }
  }
}
