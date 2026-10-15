import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Guideline } from './guideline.entity';
import * as XLSX from 'xlsx';

@Injectable()
export class GuidelinesService {
  constructor(
    @InjectRepository(Guideline)
    private readonly repo: Repository<Guideline>,
  ) {}

  async findAll() {
    return this.repo.find({ order: { created_at: "DESC" } });
  }

  async importFromExcel(buffer: Buffer): Promise<number> {
    const wb = XLSX.read(buffer, { type: "buffer" });
    let totalImported = 0;

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any>(ws);

      const guidelines = rows.map((row) =>
        this.repo.create({
          kategori: row["Kategori"] ?? "",
          akun: row["Akun"] ?? "",
          psak: row["PSAK"] ?? "",
          kk: row["KK"] ?? "",
          pt: row["PT"] ?? "",
          divisi: row["Divisi Pemegang SL"] ?? row["Divisi"] ?? "",
        })
      );
      
      const saved = await this.repo.save(guidelines);
      totalImported += saved.length;
    }

    return totalImported;
  }
}
