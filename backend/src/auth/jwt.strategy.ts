import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "../users/users.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    cfg: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: cfg.get("JWT_SECRET", "fallback_secret_change_in_prod"),
    });
  }

  async validate(payload: { sub: string; email?: string; username?: string; role?: string; token_version?: number }) {
    // Always query database live record to immediately detect role changes, revocation, or deactivation
    const user = await this.usersService.findById(payload.sub).catch(() => null);
    if (!user) {
      throw new UnauthorizedException("Akun tidak ditemukan.");
    }

    if (!user.aktif || user.status === "nonaktif" || user.status === "ditolak") {
      throw new UnauthorizedException("Akun Anda telah dinonaktifkan. Silakan hubungi Admin Sistem.");
    }

    // Invalidate old session tokens if token_version was incremented
    if (
      payload.token_version !== undefined &&
      user.token_version !== undefined &&
      payload.token_version !== user.token_version
    ) {
      throw new UnauthorizedException("Sesi Anda telah berakhir karena kredensial atau peran akun diperbarui. Silakan masuk kembali.");
    }

    // Return the up-to-date user properties attached to req.user
    return {
      userId: user.id,
      id: user.id,
      username: user.username || user.nama,
      nama: user.username || user.nama,
      role: user.role, // Live role from database!
      unit: user.unit,
      jabatan: user.jabatan,
      status: user.status,
      must_change_password: user.must_change_password,
    };
  }
}
