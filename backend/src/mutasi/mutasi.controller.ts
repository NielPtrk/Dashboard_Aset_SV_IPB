import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import {
  MutasiService,
  type MutasiQueryParams,
  type CreateMutasiDto,
  type UpdateStatusDto,
} from "./mutasi.service";
import type { Mutasi } from "./mutasi.entity";

import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("mutasi")
@ApiBearerAuth()
@Roles("Admin Sistem", "Admin Pusat", "Pekerja Stock Opname")
@Controller("mutasi")
export class MutasiController {
  constructor(private readonly service: MutasiService) {}

  @Get()
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "jenis", required: false })
  @ApiQuery({ name: "asset_id", required: false })
  findAll(@Query() query: MutasiQueryParams, @Req() req: any) {
    return this.service.findAll(query, req.user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @Req() req: any) {
    return this.service.findOne(id, req.user);
  }

  @Roles("Admin Sistem", "Admin Pusat", "Pekerja Stock Opname")
  @Post()
  create(@Body() body: CreateMutasiDto, @Req() req: any) {
    // Ensure pengaju is filled from user session if not set
    if (!body.pengaju && req.user?.nama) {
      body.pengaju = req.user.nama;
    }
    return this.service.create(body);
  }

  @Roles("Admin Sistem", "Admin Pusat")
  @Patch(":id/approve")
  approve(@Param("id") id: string, @Body() body: UpdateStatusDto, @Req() req: any) {
    if (!body.approver && req.user?.nama) {
      body.approver = req.user.nama;
    }
    return this.service.approve(id, body);
  }

  @Roles("Admin Sistem", "Admin Pusat")
  @Patch(":id/reject")
  reject(@Param("id") id: string, @Body() body: UpdateStatusDto, @Req() req: any) {
    if (!body.approver && req.user?.nama) {
      body.approver = req.user.nama;
    }
    return this.service.reject(id, body);
  }

  @Roles("Admin Sistem", "Admin Pusat")
  @Patch(":id")
  update(@Param("id") id: string, @Body() body: Partial<Mutasi>) {
    return this.service.update(id, body);
  }

  @Roles("Admin Sistem", "Admin Pusat")
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
