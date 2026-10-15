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
  ObservasiService,
  type ObservasiQueryParams,
  type BulkSaveObservasiDto,
} from "./observasi.service";
import type { ObservasiItem } from "./observasi-item.entity";

import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("observasi")
@ApiBearerAuth()
@Roles("Admin Sistem", "Admin Pusat", "Pekerja Stock Opname")
@Controller("observasi")
export class ObservasiController {
  constructor(private readonly service: ObservasiService) {}

  @Get()
  @ApiQuery({ name: "tahun", required: false })
  @ApiQuery({ name: "ruanganId", required: false })
  @ApiQuery({ name: "kampus", required: false })
  @ApiQuery({ name: "namaGedung", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "limit", required: false })
  findAll(@Query() query: ObservasiQueryParams) {
    return this.service.findAll(query);
  }

  @Get("summary")
  @ApiQuery({ name: "tahun", required: false })
  getSummary(@Query("tahun") tahun: number) {
    return this.service.getSummary(tahun || new Date().getFullYear());
  }

  @Get("room/:ruanganId")
  @ApiQuery({ name: "tahun", required: false })
  findByRoom(
    @Param("ruanganId") ruanganId: string,
    @Query("tahun") tahun?: number,
  ) {
    return this.service.findByRoom(ruanganId, tahun);
  }

  @Post("room/:ruanganId/bulk")
  bulkSave(
    @Param("ruanganId") ruanganId: string,
    @Body() body: BulkSaveObservasiDto,
  ) {
    return this.service.bulkSave({ ...body, ruanganId });
  }

  @Post()
  create(@Body() body: Partial<ObservasiItem>) {
    return this.service.create(body);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() body: Partial<ObservasiItem>) {
    return this.service.update(id, body);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.service.remove(id);
  }

  @Delete("room/:ruanganId")
  @ApiQuery({ name: "tahun", required: true })
  removeByRoom(
    @Param("ruanganId") ruanganId: string,
    @Query("tahun") tahun: number,
  ) {
    return this.service.removeByRoom(ruanganId, tahun);
  }
}
