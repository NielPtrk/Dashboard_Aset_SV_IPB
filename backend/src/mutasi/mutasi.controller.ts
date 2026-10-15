import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
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
@Roles("Admin Sistem", "Pekerja Stock Opname")
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
  findAll(@Query() query: MutasiQueryParams) {
    return this.service.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: CreateMutasiDto) {
    return this.service.create(body);
  }

  @Patch(":id/approve")
  approve(@Param("id") id: string, @Body() body: UpdateStatusDto) {
    return this.service.approve(id, body);
  }

  @Patch(":id/reject")
  reject(@Param("id") id: string, @Body() body: UpdateStatusDto) {
    return this.service.reject(id, body);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: Partial<Mutasi>) {
    return this.service.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }
}
