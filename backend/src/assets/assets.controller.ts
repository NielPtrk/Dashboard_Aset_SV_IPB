import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, Res, StreamableFile, Req,
  ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import type { Response, Request } from "express";
import { AssetsService, type AssetQueryParams } from "./assets.service";
import type { Asset } from "./asset.entity";

import { Roles } from "../auth/decorators/roles.decorator";

import * as XLSX from "xlsx";

@ApiTags("assets")
@ApiBearerAuth()
@Roles("Admin Sistem", "Admin Pusat")
@Controller("assets")
export class AssetsController {
  constructor(private readonly service: AssetsService) {}

  @Get()
  @Roles("Admin Sistem", "Admin Pusat", "Pimpinan", "Pekerja Stock Opname")
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "jenis_aset", required: false })
  @ApiQuery({ name: "kondisi", required: false })
  findAll(@Query() query: AssetQueryParams) {
    return this.service.findAll(query);
  }

  @Get("export")
  @Roles("Admin Sistem", "Admin Pusat", "Pimpinan", "Pekerja Stock Opname")
  async exportExcel(@Query() query: AssetQueryParams, @Res({ passthrough: true }) res: Response) {
    const buffer = await this.service.exportToExcel(query);
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="aset-export-${Date.now()}.xlsx"`,
    });
    return new StreamableFile(buffer);
  }

  @Post("export-room-assets")
  @Roles("Admin Sistem", "Admin Pusat", "Pimpinan", "Pekerja Stock Opname")
  async exportRoomAssets(
    @Body() body: { rows: Record<string, unknown>[]; filename?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Aset_Ruangan");
    const buffer = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
    const cleanFilename = (body?.filename || `Aset_Ruangan_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, "_");
    res.set({
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${cleanFilename}.xlsx"`,
    });
    return new StreamableFile(buffer);
  }

  @Get("overview-summary")
  @Roles("Admin Sistem", "Admin Pusat", "Pimpinan", "Pekerja Stock Opname")
  getOverviewSummary() {
    return this.service.getOverviewSummary();
  }

  @Get("room-assets")
  @Roles("Admin Sistem", "Admin Pusat", "Pimpinan", "Pekerja Stock Opname")
  getRoomAssets(
    @Query("roomId") roomId?: string,
    @Query("namaRuangan") namaRuangan?: string,
    @Query("search") search?: string,
    @Query("page") page = 1,
    @Query("limit") limit = 10,
  ) {
    return this.service.getRoomAssets({
      roomId,
      namaRuangan,
      search,
      page: Number(page) || 1,
      limit: Number(limit) || 10,
    });
  }

  @Get(":id")
  @Roles("Admin Sistem", "Admin Pusat", "Pimpinan", "Pekerja Stock Opname")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: Partial<Asset>) {
    return this.service.create(body);
  }

  @Post("import")
  @UseInterceptors(FileInterceptor("file"))
  async importExcel(@UploadedFile() file: Express.Multer.File) {
    const count = await this.service.importFromExcel(file.buffer);
    return { imported: count, message: `${count} aset berhasil diimpor.` };
  }

  @Post("bulk")
  async bulkImport(@Req() req: Request) {
    const count = await this.service.bulkImport(req.body);
    return { imported: count, message: `${count} aset berhasil diimpor.` };
  }

  @Patch(":id")
  @Roles("Admin Sistem", "Admin Pusat", "Pekerja Stock Opname")
  update(@Param("id") id: string, @Body() body: Partial<Asset>, @Req() req: any) {
    if (req.user?.role === "Pekerja Stock Opname") {
      const locKeys = ["nama_ruangan", "id_ruangan", "gedung", "nama_gedung", "ruangan", "lokasi"];
      const hasLocationChange = locKeys.some(k => (body as any)[k] !== undefined);
      if (hasLocationChange) {
        throw new ForbiddenException("Pekerja Stock Opname tidak diperbolehkan memindahkan aset secara langsung. Silakan ajukan mutasi.");
      }
    }
    return this.service.update(id, body);
  }

  @Delete("by-category/:jenis")
  async removeByCategory(@Param("jenis") jenis: string) {
    const deleted = await this.service.deleteByJenis(jenis);
    return { deleted, message: `${deleted} aset kategori ${jenis} telah dihapus.` };
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
