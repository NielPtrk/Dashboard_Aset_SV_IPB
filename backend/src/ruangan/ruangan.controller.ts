import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  NotFoundException,
} from "@nestjs/common";
import { RuanganService, RuanganQueryParams } from "./ruangan.service";
import { Ruangan } from "./ruangan.entity";

import { Roles } from "../auth/decorators/roles.decorator";

@Roles("Admin Sistem", "Admin Pusat", "Pekerja Stock Opname")
@Controller("ruangan")
export class RuanganController {
  constructor(private readonly ruanganService: RuanganService) {}

  @Get()
  async findAll(@Query() query: RuanganQueryParams) {
    return this.ruanganService.findAll(query);
  }

  @Get("stats")
  async getStats() {
    return this.ruanganService.getStats();
  }

  @Get("kampus-list")
  async getKampusList() {
    return this.ruanganService.getKampusList();
  }

  @Roles("Admin Sistem", "Admin Pusat")
  @Post("import")
  async importExcel() {
    return this.ruanganService.importFromExcel();
  }

  @Roles("Admin Sistem", "Admin Pusat")
  @Post()
  async create(@Body() body: Partial<Ruangan>) {
    return this.ruanganService.create(body);
  }

  @Roles("Admin Sistem", "Admin Pusat")
  @Patch(":id")
  async update(@Param("id") id: string, @Body() body: Partial<Ruangan>) {
    return this.ruanganService.update(id, body);
  }

  @Roles("Admin Sistem", "Admin Pusat")
  @Delete("gedung/:namaGedung")
  async removeGedung(
    @Param("namaGedung") namaGedung: string,
    @Query("kampus") kampus?: string,
  ) {
    return this.ruanganService.removeGedung(namaGedung, kampus);
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    const item = await this.ruanganService.findOne(id);
    if (!item) {
      throw new NotFoundException(`Ruangan with ID ${id} not found`);
    }
    return item;
  }

  @Roles("Admin Sistem", "Admin Pusat")
  @Delete(":id")
  async remove(@Param("id") id: string) {
    return this.ruanganService.remove(id);
  }
}
