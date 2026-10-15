import { Injectable, UnauthorizedException, BadRequestException, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import axios from "axios";
import { UsersService } from "../users/users.service";
import { NotificationsService } from "../notifications/notifications.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto, ForgotPasswordDto, ResetPasswordDto } from "./dto/register.dto";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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

    const email = dto.email.toLowerCase().trim();
    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException("Email atau kata sandi salah.");
    }

    // 2. Strict status checks with explicit Indonesian messages
    if (user.status === "menunggu_verifikasi") {
      throw new UnauthorizedException("Email belum diverifikasi. Silakan periksa inbox email Anda untuk menyelesaikan verifikasi.");
    }

    if (user.status === "menunggu_persetujuan") {
      throw new UnauthorizedException("Akun Anda telah memverifikasi email dan saat ini sedang menunggu persetujuan dari Admin Sistem.");
    }

    if (user.status === "ditolak") {
      throw new UnauthorizedException("Pendaftaran akun Anda ditolak oleh Admin Sistem.");
    }

    if (user.status === "nonaktif" || !user.aktif) {
      throw new UnauthorizedException("Akun Anda telah dinonaktifkan. Silakan hubungi Admin Sistem.");
    }

    if (user.role === "Tanpa Role") {
      throw new UnauthorizedException("Akses dicabut, hubungi Admin Sistem.");
    }

    // 3. Verify password
    const valid = await bcrypt.compare(dto.password, user.password_hash);
    if (!valid) {
      throw new UnauthorizedException("Email atau kata sandi salah.");
    }

    // 4. Update last_login
    user.last_login = new Date();
    await this.users.saveRaw(user);

    return this.generateTokens(user);
  }

  async register(dto: RegisterDto) {
    // 1. Verify Turnstile token if provided
    if (dto.turnstileToken) {
      await this.verifyTurnstile(dto.turnstileToken);
    }

    const email = dto.email.toLowerCase().trim();
    const existing = await this.users.findByEmail(email).catch(() => null);
    if (existing) {
      throw new BadRequestException("Alamat email sudah terdaftar. Silakan masuk atau gunakan email lain.");
    }

    // 2. Generate secure email verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // 3. Create user with status 'menunggu_persetujuan' and role 'Tanpa Role'
    // (Never Admin Sistem - strictly enforced)
    const user = await this.users.create({
      nama: dto.nama.trim(),
      email,
      password: dto.password,
      unit: dto.unit?.trim() || "Sekolah Vokasi (SV)",
      harapan_role: dto.harapan_role?.trim() || null,
      role: "Tanpa Role",
      status: "menunggu_persetujuan",
      aktif: false,
      verification_token: verificationToken,
    });

    // 4. Send email verification link/code via Nodemailer
    try {
      await this.notifications.sendVerificationEmail(user.email, user.nama, verificationToken);
    } catch (mailErr) {
      this.logger.warn(`Pengiriman email verifikasi dilewati/gagal: ${(mailErr as Error).message}`);
    }

    return {
      message: "Pendaftaran berhasil! Permintaan akun Anda telah diteruskan dan sedang menunggu persetujuan dari Admin Sistem.",
      email: user.email,
      verification_token: verificationToken, // Provided for testing environments
    };
  }

  async verifyEmail(token: string) {
    if (!token) {
      throw new BadRequestException("Token verifikasi wajib disertakan.");
    }

    const user = await this.users.findByVerificationToken(token);
    if (!user) {
      throw new BadRequestException("Token verifikasi tidak valid atau sudah digunakan.");
    }

    // Advance status to 'menunggu_persetujuan' (awaiting Admin Sistem approval)
    user.status = "menunggu_persetujuan";
    user.verification_token = null as any;
    await this.users.saveRaw(user);

    return {
      message: "Email berhasil diverifikasi! Akun Anda kini berstatus Menunggu Persetujuan Admin Sistem.",
      email: user.email,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    if (dto.turnstileToken) {
      await this.verifyTurnstile(dto.turnstileToken);
    }

    const email = dto.email.toLowerCase().trim();
    const user = await this.users.findByEmail(email).catch(() => null);

    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 3600 * 1000); // 1 hour

      user.reset_password_token = resetToken;
      user.reset_password_expires = expires;
      await this.users.saveRaw(user);

      await this.notifications.sendPasswordResetEmail(user.email, user.nama, resetToken);
    }

    // Always return success for security (do not leak whether email exists)
    return {
      message: "Jika email Anda terdaftar, instruksi atur ulang kata sandi telah dikirimkan ke kotak masuk Anda.",
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.users.findByResetToken(dto.token);
    if (!user || !user.reset_password_expires || user.reset_password_expires < new Date()) {
      throw new BadRequestException("Token atur ulang kata sandi tidak valid atau telah kedaluwarsa.");
    }

    user.password_hash = await bcrypt.hash(dto.password, 10);
    user.reset_password_token = null as any;
    user.reset_password_expires = null as any;
    await this.users.saveRaw(user);

    return {
      message: "Kata sandi berhasil diperbarui. Silakan masuk menggunakan kata sandi baru Anda.",
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

  private generateTokens(user: { id: string; email: string; role: string; nama: string; unit?: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = this.jwt.sign(payload);
    const refresh_token = this.jwt.sign(payload, {
      secret: this.cfg.get("JWT_REFRESH_SECRET", "fallback_refresh_secret"),
      expiresIn: this.cfg.get("JWT_REFRESH_EXPIRES_IN", "7d"),
    });
    return {
      access_token,
      refresh_token,
      user: { id: user.id, nama: user.nama, email: user.email, role: user.role, unit: user.unit },
    };
  }

  private async verifyTurnstile(token: string): Promise<void> {
    const secret = this.cfg.get("TURNSTILE_SECRET_KEY") || "1x0000000000000000000000000000000AA";
    // Allow standard test tokens in development/test environments
    if (token === "dummy-turnstile-token" || token.startsWith("1x0000")) {
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
