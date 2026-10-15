import { Controller, Post, UseInterceptors, UploadedFile, Get } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { GuidelinesService } from './guidelines.service';
import { ApiTags } from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('guidelines')
@Roles("Admin Sistem", "Pimpinan", "Admin Pusat", "Pekerja Stock Opname")
@Controller('guidelines')
export class GuidelinesController {
  constructor(private readonly guidelinesService: GuidelinesService) {}

  @Get()
  findAll() {
    return this.guidelinesService.findAll();
  }

  @Roles("Admin Sistem")
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { success: false, message: 'File tidak ditemukan' };
    }
    const count = await this.guidelinesService.importFromExcel(file.buffer);
    return { success: true, imported: count, message: `${count} pedoman/guideline berhasil diimpor.` };
  }
}
