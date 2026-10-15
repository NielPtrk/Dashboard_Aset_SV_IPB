import {
  Controller, Post, Get, Delete, Query, UploadedFile,
  UseInterceptors, UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { StorageService } from "./storage.service";
import { randomUUID } from "crypto";
import * as path from "path";

import { Roles } from "../auth/decorators/roles.decorator";

@ApiTags("storage")
@ApiBearerAuth()
@Roles("Admin Sistem", "Admin Pusat", "Pekerja Stock Opname")
@Controller("storage")
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post("upload")
  @UseInterceptors(FileInterceptor("file"))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Query("bucket") bucket = "documents",
  ) {
    const ext = path.extname(file.originalname);
    const storedName = `${randomUUID()}${ext}`;
    await this.storage.upload(bucket, storedName, file.buffer, file.size, file.mimetype, {
      originalName: file.originalname,
    });
    const url = await this.storage.getPresignedUrl(bucket, storedName);
    return {
      id: storedName,
      originalName: file.originalname,
      storedName,
      bucket,
      size: file.size,
      mimeType: file.mimetype,
      url,
      createdAt: new Date().toISOString(),
    };
  }

  @Get("url")
  async getUrl(
    @Query("storedName") storedName: string,
    @Query("bucket") bucket = "documents",
  ) {
    const url = await this.storage.getPresignedUrl(bucket, storedName);
    return { url };
  }

  @Delete("object")
  async remove(
    @Query("storedName") storedName: string,
    @Query("bucket") bucket = "documents",
  ) {
    await this.storage.remove(bucket, storedName);
    return { message: "File berhasil dihapus." };
  }

  @Get("list")
  async list(
    @Query("bucket") bucket = "documents",
    @Query("prefix") prefix = "",
  ) {
    return this.storage.listObjects(bucket, prefix);
  }
}
