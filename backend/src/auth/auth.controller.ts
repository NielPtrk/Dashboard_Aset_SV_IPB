import { Controller, Post, Body, Get, Query, Request, BadRequestException } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from "./dto/register.dto";
import { Public } from "./decorators/roles.decorator";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @ApiOperation({ summary: "Masuk dengan username, kata sandi, dan Cloudflare Turnstile token" })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post("register")
  @ApiOperation({ summary: "Endpoint registrasi mandiri (dinonaktifkan)" })
  register(@Body() _dto: RegisterDto) {
    throw new BadRequestException("Pendaftaran mandiri telah dinonaktifkan. Akun hanya dibuat oleh Admin Sistem.");
  }

  @Public()
  @Get("verify-email")
  @ApiOperation({ summary: "Endpoint verifikasi email (dinonaktifkan)" })
  verifyEmail(@Query("token") _token: string) {
    throw new BadRequestException("Verifikasi email tidak digunakan.");
  }

  @Public()
  @Post("forgot-password")
  @ApiOperation({ summary: "Endpoint lupa kata sandi via email (dinonaktifkan)" })
  forgotPassword(@Body() _dto: ForgotPasswordDto) {
    throw new BadRequestException("Pemulihan kata sandi melalui email dinonaktifkan. Hubungi Admin Sistem.");
  }

  @Public()
  @Post("reset-password")
  @ApiOperation({ summary: "Endpoint reset kata sandi via token (dinonaktifkan)" })
  resetPassword(@Body() _dto: ResetPasswordDto) {
    throw new BadRequestException("Atur ulang kata sandi melalui token dinonaktifkan. Hubungi Admin Sistem.");
  }

  @ApiBearerAuth()
  @Post("change-password")
  @ApiOperation({ summary: "Ubah kata sandi pengguna (wajib memasukkan kata sandi lama)" })
  changePassword(@Request() req: { user: { id: string } }, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.id, dto);
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
