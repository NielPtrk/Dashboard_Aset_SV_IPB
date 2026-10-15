import { Injectable, OnModuleInit, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Ruangan } from "./ruangan.entity";
import * as path from "path";
import * as fs from "fs";

// ── Kampus & Gedung Canonical Parsing ─────────────────────────────────────────

export function parseGedungDanKampus(
  gedungRaw: string,
  alamatRaw: string,
): { kampus: string; namaGedung: string } {
  const g = (gedungRaw || "").trim().toLowerCase();
  const a = (alamatRaw || "").trim().toLowerCase();

  // 1. 4 baris tanpa Gedung (ID 8385, 8387, 8392, 8393) -> "Belum Dikategorikan"
  if (!g) {
    return {
      kampus: "Belum Dikategorikan",
      namaGedung: "Belum Dikategorikan",
    };
  }

  // 2. GH Lingkungan -> Kampus Cilibende (1)
  if (g.includes("gh lingkungan")) {
    return {
      kampus: "Kampus Cilibende",
      namaGedung: "Laboratorium GH Lingkungan Sekolah Vokasi",
    };
  }

  // 3. Cilibende -> Kampus Cilibende (161)
  if (g.includes("cilibende")) {
    return {
      kampus: "Kampus Cilibende",
      namaGedung: "Gedung Sekolah Vokasi",
    };
  }

  // 4. Biokimia -> Kampus Gunung Gede (38)
  if (g.includes("biokimia")) {
    return {
      kampus: "Kampus Gunung Gede",
      namaGedung: "Gedung Biokimia SV",
    };
  }

  // 5. Lab.Perikanan / perikanan -> Kampus Gunung Gede (1)
  if (g.includes("lab.perikanan") || g.includes("perikanan")) {
    return {
      kampus: "Kampus Gunung Gede",
      namaGedung: "Lab.Perikanan",
    };
  }

  // 6. Lab Lingkungan (Pajajaran) -> Kampus Pajajaran (3)
  if (g.includes("lab lingkungan")) {
    return {
      kampus: "Kampus Pajajaran",
      namaGedung: "Lab Lingkungan Sekolah Vokasi IPB",
    };
  }

  // 7. Klinik Hewan (Pajajaran) -> Kampus Pajajaran (1)
  if (g.includes("klinik hewan")) {
    return {
      kampus: "Kampus Pajajaran",
      namaGedung: "Klinik Hewan Pendidikan Sekolah Vokasi IPB",
    };
  }

  // 8. Gedung IPB Gunung Gede (mislabelled in Excel as IPB Baranangsiang but address Pajajaran) -> Kampus Pajajaran (1)
  if (g.includes("(ipb baranangsiang)") && a.includes("pajajaran")) {
    return {
      kampus: "Kampus Pajajaran",
      namaGedung: "Gedung IPB Gunung Gede",
    };
  }

  // 9. Baranangsiang (24)
  if (g.includes("baranangsiang") || g.includes("( bs )") || g.includes("(bs)")) {
    return {
      kampus: "Kampus Baranangsiang",
      namaGedung: "Kampus Baranangsiang (BS)",
    };
  }

  // 10. Asrama Felicia -> Kampus / Lokasi Lainnya (1)
  if (g.includes("felicia")) {
    return {
      kampus: "Kampus / Lokasi Lainnya",
      namaGedung: "Gedung Asrama Felicia",
    };
  }

  // 11. Asrama Sukasari -> Kampus / Lokasi Lainnya (1)
  if (g.includes("sukasari")) {
    return {
      kampus: "Kampus / Lokasi Lainnya",
      namaGedung: "Gedung Asrama Sukasari",
    };
  }

  // 12. Creative House -> Kampus / Lokasi Lainnya (1)
  if (g.includes("creative house")) {
    return {
      kampus: "Kampus / Lokasi Lainnya",
      namaGedung: "Gedung Creative House SV IPB",
    };
  }

  // 13. Kampus Gunung Gede (label IPB Pajajaran) -> Kampus Pajajaran (19)
  if (g.includes("gunung gede") || g.includes("pajajaran")) {
    return {
      kampus: "Kampus Pajajaran",
      namaGedung: "Kampus Gunung Gede",
    };
  }

  return {
    kampus: "Kampus Pajajaran",
    namaGedung: "Kampus Gunung Gede",
  };
}

const ALAMAT_NORMALIZATION: Record<string, string> = {
  "Kampus Cilibende":
    "Jl. Lodaya II, RT.02/RW.06, Babakan, Kecamatan Bogor Tengah, Kota Bogor, Jawa Barat 16128",
  "Kampus Gunung Gede":
    "Jl. Kumbang No.14, RT.02/RW.06, Babakan, Kecamatan Bogor Tengah, Kota Bogor, Jawa Barat 16128",
  "Kampus Pajajaran":
    "Jl. Raya Pajajaran No.15, RT.03/RW.04, Babakan, Kecamatan Bogor Tengah, Kota Bogor, Jawa Barat 16128",
  "Kampus Baranangsiang":
    "Jl. Malabar, RT.05/RW.02, Tegallega, Baranangsiang, Kecamatan Bogor Tengah, Kota Bogor, Jawa Barat 16128",
  "Kampus / Lokasi Lainnya":
    "Kota Bogor, Jawa Barat",
};

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface RuanganQueryParams {
  kampus?: string;
  namaGedung?: string;
  kategori?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class RuanganService implements OnModuleInit {
  constructor(
    @InjectRepository(Ruangan)
    private readonly repo: Repository<Ruangan>,
  ) {}

  async onModuleInit() {
    try {
      const count = await this.repo.count();
      if (count === 0) {
        console.log("[RuanganService] Table 'ruangan' is empty. Seeding from Excel...");
        const result = await this.importFromExcel();
        console.log(
          `[RuanganService] Seed completed: ${result.imported} imported, ${result.skipped} skipped.`,
        );
      }
    } catch (err) {
      console.error("[RuanganService] Failed to auto-seed ruangan from Excel:", err);
    }
  }

  async findAll(params: RuanganQueryParams = {}) {
    const { kampus, namaGedung, kategori, search, page = 1, limit = 300 } = params;

    const qb = this.repo.createQueryBuilder("r");

    if (kampus && kampus !== "Semua") {
      qb.andWhere("r.kampus = :kampus", { kampus });
    }
    if (namaGedung && namaGedung !== "Semua") {
      qb.andWhere("r.namaGedung = :namaGedung", { namaGedung });
    }
    if (kategori && kategori !== "Semua") {
      qb.andWhere("r.kategori = :kategori", { kategori });
    }
    if (search && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        "(LOWER(r.namaRuangan) LIKE :q OR LOWER(r.kodeRuangan) LIKE :q OR LOWER(r.namaGedung) LIKE :q)",
        { q },
      );
    }

    qb.orderBy("r.namaGedung", "ASC")
      .addOrderBy("r.level", "ASC")
      .addOrderBy("r.namaRuangan", "ASC");

    if (limit > 0) {
      qb.skip((page - 1) * limit).take(limit);
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Ruangan | null> {
    return this.repo.findOne({ where: { id } });
  }

  async create(dto: Partial<Ruangan>): Promise<Ruangan> {
    const entity = this.repo.create({
      sourceId: dto.sourceId ?? null,
      kampus: dto.kampus || "Kampus Cilibende",
      namaGedung: dto.namaGedung || "Gedung Baru",
      gedungRaw: dto.gedungRaw || dto.namaGedung || null,
      level: Number(dto.level) || 1,
      alamat: dto.alamat || ALAMAT_NORMALIZATION[dto.kampus || ""] || null,
      kodeRuangan: dto.kodeRuangan || null,
      namaRuangan: dto.namaRuangan || "Ruangan Baru",
      kategori: dto.kategori || "Lainnya",
      luas: Number(dto.luas) || 0,
      kapasitas: Number(dto.kapasitas) || 0,
      unitPengguna: dto.unitPengguna || null,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: Partial<Ruangan>): Promise<Ruangan> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Ruangan with ID ${id} not found`);
    }
    Object.assign(existing, {
      ...dto,
      luas: dto.luas !== undefined ? Number(dto.luas) : existing.luas,
      kapasitas: dto.kapasitas !== undefined ? Number(dto.kapasitas) : existing.kapasitas,
      level: dto.level !== undefined ? Number(dto.level) : existing.level,
    });
    return this.repo.save(existing);
  }

  async remove(id: string): Promise<{ success: boolean; id: string }> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Ruangan with ID ${id} not found`);
    }
    await this.repo.remove(existing);
    return { success: true, id };
  }

  async removeGedung(namaGedung: string, kampus?: string): Promise<{ success: boolean; deletedCount: number }> {
    const qb = this.repo.createQueryBuilder().delete().from(Ruangan).where("namaGedung = :namaGedung", { namaGedung });
    if (kampus) {
      qb.andWhere("kampus = :kampus", { kampus });
    }
    const result = await qb.execute();
    return { success: true, deletedCount: result.affected ?? 0 };
  }

  /** Returns list of distinct kampus names */
  async getKampusList(): Promise<string[]> {
    const rows = await this.repo
      .createQueryBuilder("r")
      .select("DISTINCT r.kampus", "kampus")
      .orderBy("r.kampus", "ASC")
      .getRawMany();
    return rows.map((r) => r.kampus);
  }

  /** Returns stats aggregated per kampus */
  async getStats() {
    const kampusList = await this.getKampusList();

    const stats = await Promise.all(
      kampusList.map(async (kampus) => {
        const ruangan = await this.repo.count({ where: { kampus } });
        const gedung = await this.repo
          .createQueryBuilder("r")
          .select("COUNT(DISTINCT r.namaGedung)", "cnt")
          .where("r.kampus = :kampus", { kampus })
          .getRawOne();
        const luasResult = await this.repo
          .createQueryBuilder("r")
          .select("SUM(r.luas)", "total")
          .where("r.kampus = :kampus", { kampus })
          .getRawOne();

        return {
          kampus,
          totalGedung: parseInt(gedung?.cnt ?? "0", 10),
          totalRuangan: ruangan,
          totalLuas: parseFloat(luasResult?.total ?? "0"),
        };
      }),
    );

    const overallGedung = await this.repo
      .createQueryBuilder("r")
      .select("COUNT(DISTINCT r.namaGedung)", "cnt")
      .getRawOne();

    const overallLuas = await this.repo
      .createQueryBuilder("r")
      .select("SUM(r.luas)", "total")
      .getRawOne();

    const overall = {
      totalGedung: parseInt(overallGedung?.cnt ?? "0", 10),
      totalRuangan: await this.repo.count(),
      totalLuas: parseFloat(overallLuas?.total ?? "0"),
    };

    return { overall, byKampus: stats };
  }

  /** Import data from Excel file — idempotent (clears existing rows first) */
  async importFromExcel(): Promise<{ imported: number; skipped: number }> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const XLSX = require("xlsx");

    const possiblePaths = [
      path.join(process.cwd(), "src", "storage", "data_Excel", "Manajemen Ruangan Sekolah Vokasi.xlsx"),
      path.join(__dirname, "..", "..", "src", "storage", "data_Excel", "Manajemen Ruangan Sekolah Vokasi.xlsx"),
      path.join(__dirname, "..", "storage", "data_Excel", "Manajemen Ruangan Sekolah Vokasi.xlsx"),
      path.join(process.cwd(), "backend", "src", "storage", "data_Excel", "Manajemen Ruangan Sekolah Vokasi.xlsx"),
    ];
    const excelPath = possiblePaths.find((p) => fs.existsSync(p));
    if (!excelPath) {
      throw new Error(`Excel file not found at any of: ${possiblePaths.join(", ")}`);
    }

    const wb = XLSX.readFile(excelPath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

    // Clear existing rows
    await this.repo.clear();

    let imported = 0;
    let skipped = 0;

    for (const row of rows) {
      const namaRuangan = String(row["namaRuangan"] || "").trim();
      if (!namaRuangan) {
        skipped++;
        continue;
      }

      const gedungRaw = String(row["Gedung"] || "").trim();
      const alamatRaw = String(row["alamat"] || "").trim();
      const { kampus, namaGedung } = parseGedungDanKampus(gedungRaw, alamatRaw);
      const alamat = ALAMAT_NORMALIZATION[kampus] || alamatRaw;

      let luas = parseFloat(String(row["luas (m2)"] || "0").replace(",", ".")) || 0;
      if (luas === 0) {
        if (gedungRaw.toLowerCase().includes("felicia") || namaRuangan.toLowerCase().includes("felicia")) {
          luas = 450.0;
        } else if (gedungRaw.toLowerCase().includes("sukasari") || namaRuangan.toLowerCase().includes("sukasari")) {
          luas = 400.0;
        } else if (gedungRaw.toLowerCase().includes("creative house") || namaRuangan.toLowerCase().includes("creative house")) {
          luas = 282.87;
        }
      }

      const entity = this.repo.create({
        sourceId: typeof row["ID"] === "number" ? row["ID"] : parseInt(String(row["ID"]), 10) || null,
        kampus,
        namaGedung,
        gedungRaw: gedungRaw || null,
        level: typeof row["level"] === "number" ? row["level"] : parseInt(String(row["level"]), 10) || 1,
        alamat: alamat || null,
        kodeRuangan: String(row["kodeRuangan"] || "").trim() || null,
        namaRuangan,
        kategori: String(row["kategori"] || "").trim() || null,
        luas,
        kapasitas: typeof row["kapasitas"] === "number" ? row["kapasitas"] : parseInt(String(row["kapasitas"]), 10) || 0,
        unitPengguna: String(row["Keterangan"] || "").trim() || null,
      });

      await this.repo.save(entity);
      imported++;
    }

    return { imported, skipped };
  }
}
