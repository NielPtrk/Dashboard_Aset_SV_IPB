import { Controller, Post, Body, Get, Query, Request } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto, ForgotPasswordDto, ResetPasswordDto } from "./dto/register.dto";
import { Public } from "./decorators/roles.decorator";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @ApiOperation({ summary: "Masuk dengan email, kata sandi, dan Cloudflare Turnstile token" })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post("register")
  @ApiOperation({ summary: "Daftar akun baru dengan verifikasi Turnstile dan email konfirmasi" })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Get("verify-email")
  @ApiOperation({ summary: "Verifikasi email akun baru dengan token" })
  verifyEmail(@Query("token") token: string) {
    return this.authService.verifyEmail(token);
  }

  @Public()
  @Post("forgot-password")
  @ApiOperation({ summary: "Kirim tautan reset password ke email" })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post("reset-password")
  @ApiOperation({ summary: "Atur ulang kata sandi dengan token baru" })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post("refresh")
  @ApiOperation({ summary: "Segarkan token akses JWT" })
  refresh(@Body("refresh_token") token: string) {
    return this.authService.refresh(token);
  }

  @Public()
  @Get("turnstile-config")
  @ApiOperation({ summary: "Konfigurasi publik Cloudflare Turnstile" })
  getTurnstileConfig() {
    return {
      siteKey: process.env.TURNSTILE_SITE_KEY || "1x00000000000000000000AA",
    };
  }

  @ApiBearerAuth()
  @Get("profile")
  @ApiOperation({ summary: "Ambil data profil pengguna yang sedang login" })
  profile(@Request() req: { user: unknown }) {
    return req.user;
  }

  @ApiBearerAuth()
  @Post("logout")
  @ApiOperation({ summary: "Keluar dari sistem" })
  logout() {
    return { message: "Berhasil keluar dari sistem." };
  }
}
