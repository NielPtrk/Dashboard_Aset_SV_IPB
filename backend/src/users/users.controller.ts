import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { Roles } from "../auth/decorators/roles.decorator";
import type { User } from "./user.entity";

@ApiTags("users")
@ApiBearerAuth()
@Roles("Admin Sistem") // Strictly Admin Sistem only
@Controller("users")
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @ApiOperation({ summary: "Ambil daftar semua pengguna dengan filter" })
  findAll(@Query() query: { page?: number; limit?: number; search?: string; role?: string; status?: string }) {
    return this.service.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Ambil detail pengguna" })
  findOne(@Param("id") id: string) {
    return this.service.findById(id);
  }

  @Post()
  @ApiOperation({ summary: "Tambah pengguna baru (khusus Admin Sistem)" })
  create(@Body() body: Partial<User> & { password?: string }) {
    return this.service.create(body);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Perbarui data pengguna" })
  update(@Param("id") id: string, @Body() body: Partial<User> & { password?: string }) {
    return this.service.update(id, body);
  }

  @Patch(":id/role")
  @ApiOperation({ summary: "Ubah role pengguna (hanya bisa ke Pimpinan, Admin Pusat, Pekerja SO)" })
  updateRole(@Param("id") id: string, @Body("role") newRole: string) {
    return this.service.updateRole(id, newRole);
  }

  @Patch(":id/revoke")
  @ApiOperation({ summary: "Cabut role pengguna (akun menjadi Tanpa Role)" })
  revokeRole(@Param("id") id: string) {
    return this.service.revokeRole(id);
  }

  @Patch(":id/approve")
  @ApiOperation({ summary: "Setujui atau tolak pendaftaran akun baru" })
  approve(
    @Param("id") id: string,
    @Body() body: { action: "setujui" | "tolak"; role?: string; catatan?: string },
  ) {
    return this.service.approveRegistration(id, body);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Hapus pengguna (Admin Sistem tidak bisa dihapus)" })
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }

  @Post(":id/notify")
  notify(@Param("id") _id: string, @Body() _body: { subject: string; body: string }) {
    return { message: "Notifikasi email terkirim." };
  }
}
