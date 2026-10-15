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

  async validate(payload: { sub: string; email: string; role?: string }) {
    // Always query database live record to immediately detect role changes, revocation, or deactivation
    const user = await this.usersService.findById(payload.sub).catch(() => null);
    if (!user) {
      throw new UnauthorizedException("Akun tidak ditemukan.");
    }

    if (!user.aktif || user.status === "nonaktif" || user.status === "ditolak") {
      throw new UnauthorizedException("Akun Anda tidak aktif atau dinonaktifkan.");
    }

    if (user.status === "menunggu_verifikasi" || user.status === "menunggu_persetujuan") {
      throw new UnauthorizedException("Akun Anda belum aktif (menunggu verifikasi atau persetujuan admin).");
    }

    // Return the up-to-date user properties attached to req.user
    return {
      userId: user.id,
      id: user.id,
      email: user.email,
      nama: user.nama,
      role: user.role, // Live role from database!
      unit: user.unit,
      status: user.status,
    };
  }
}
