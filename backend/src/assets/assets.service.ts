import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository, Like, FindOptionsWhere } from "typeorm";
import { Asset } from "./asset.entity";
import * as XLSX from "xlsx";

export interface AssetQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  jenis_aset?: string;
  kondisi?: string;
  unit?: string;
  gedung?: string;
  lantai?: string;
  ruangan?: string;
  tahun?: string;
}

/**
 * Normalize a raw Excel cell value:
 * - null / undefined / empty string  → null  (stored as SQL NULL)
 * - number                           → the number itself (preserves decimals)
 * - anything else                    → trimmed string
 * We intentionally do NOT replace nulls with '-'.
 */
function normalizeCell(val: unknown): string | number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return val;          // keep full precision
  const s = String(val).trim();
  if (s === "" || s === "None" || s === "null") return null;
  // Try to re-cast strings that look like pure numbers (xlsx raw:true returns numbers,
  // but raw:false gives strings — we cast them back here)
  const n = Number(s);
  if (!isNaN(n) && s !== "") return n;
  return s;
}

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Asset)
    private readonly repo: Repository<Asset>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(params: AssetQueryParams = {}) {
    const { page = 1, limit = 50, search, jenis_aset, kondisi, unit, gedung, lantai, ruangan } = params;

    const where: FindOptionsWhere<Asset>[] = [];
    const base: FindOptionsWhere<Asset> = {};

    if (jenis_aset && jenis_aset !== "semua") base.jenis_aset = jenis_aset as Asset["jenis_aset"];
    if (kondisi && kondisi !== "semua") base.kondisi = kondisi;
    if (unit && unit !== "semua") base.nama_unit = unit;
    if (gedung && gedung !== "semua") base.gedung = gedung;
    if (lantai && lantai !== "semua") base.lantai = lantai;
    if (ruangan && ruangan !== "semua") base.nama_ruangan = ruangan;

    if (search) {
      where.push({ ...base, nama_barang: Like(`%${search}%`) });
      where.push({ ...base, kode_tag_aset: Like(`%${search}%`) });
    } else {
      where.push(base);
    }

    const [data, total] = await this.repo.findAndCount({
      where: where.length > 0 ? where : undefined,
      skip: (page - 1) * limit,
      take: limit,
      // Primary sort: original Excel row order; secondary: insertion time
      order: { row_order: "ASC", created_at: "ASC" },
    });

    return { data, total, page, limit };
  }

  async getOverviewSummary() {
    const rawTotal = await this.repo
      .createQueryBuilder("a")
      .select("COUNT(*)", "count")
      .addSelect("SUM(COALESCE(a.harga_perolehan, 0))", "total_val")
      .getRawOne();

    const totalAssets = parseInt(rawTotal?.count ?? "0", 10);
    const totalAcquisitionValue = parseFloat(rawTotal?.total_val ?? "0");

    const roomAggregates = await this.repo
      .createQueryBuilder("a")
      .select("a.id_ruangan", "id_ruangan")
      .addSelect("a.nama_ruangan", "nama_ruangan")
      .addSelect("a.gedung", "gedung")
      .addSelect("COUNT(*)", "asset_count")
      .addSelect("SUM(COALESCE(a.harga_perolehan, 0))", "total_value")
      .groupBy("a.id_ruangan")
      .addGroupBy("a.nama_ruangan")
      .addGroupBy("a.gedung")
      .getRawMany();

    return {
      totalAssets,
      totalAcquisitionValue,
      roomAggregates,
    };
  }

  async getRoomAssets(params: {
    roomId?: string;
    namaRuangan?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { roomId, namaRuangan, search, page = 1, limit = 10 } = params;
    const qb = this.repo.createQueryBuilder("a");

    if (roomId) {
      qb.andWhere("(a.id_ruangan = :roomId OR a.extra_fields->>'Id_ruangan' = :roomId)", { roomId });
    } else if (namaRuangan) {
      qb.andWhere("LOWER(a.nama_ruangan) = LOWER(:namaRuangan)", { namaRuangan });
    }

    if (search) {
      qb.andWhere(
        "(LOWER(a.nama_barang) LIKE LOWER(:search) OR LOWER(a.kode_tag_aset) LIKE LOWER(:search))",
        { search: `%${search}%` }
      );
    }

    qb.orderBy("a.row_order", "ASC")
      .addOrderBy("a.created_at", "ASC")
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Asset> {
    const asset = await this.repo.findOne({ where: { id } });
    if (!asset) throw new NotFoundException(`Aset dengan id ${id} tidak ditemukan.`);
    return asset;
  }

  async create(payload: Partial<Asset>): Promise<Asset> {
    const asset = this.repo.create(payload);
    return this.repo.save(asset);
  }

  async update(id: string, payload: Partial<Asset>): Promise<Asset> {
    await this.findOne(id);
    await this.repo.update(id, payload);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }

  async importFromExcel(buffer: Buffer): Promise<number> {
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { raw: true, defval: null });

    const assets = rows.map((row, idx) =>
      this.repo.create({
        kode_tag_aset: String(row["Id"] ?? row["KodeBarang"] ?? row["kode_tag_aset"] ?? "").trim() ||
          `IMP-FILE-${idx}-${Math.random().toString(36).slice(2, 8)}`,
        nama_barang: String(row["Nama_Barang"] ?? row["nama_barang"] ?? ""),
        jenis_aset: (String(row["TipeAset"] ?? row["jenis_aset"] ?? "PM")) as Asset["jenis_aset"],
        merk_type: String(row["MerkType"] ?? ""),
        spesifikasi: String(row["Spesifikasi"] ?? ""),
        tgl_perolehan: row["TglPerolehan"] ? String(row["TglPerolehan"]) : null,
        harga_perolehan: Number(row["HargaSatuan"] ?? 0) || 0,
        sumber_dana: String(row["SumberDana"] ?? ""),
        kondisi: String(row["Kondisi"] ?? "Baik"),
        nama_ruangan: String(row["Nama_ruangan"] ?? ""),
        nama_unit: String(row["Nama_unit"] ?? ""),
        pengguna: String(row["Pengguna"] ?? ""),
        row_order: idx,
        extra_fields: Object.fromEntries(
          Object.entries(row).map(([k, v]) => [k, normalizeCell(v)])
        ),
      }),
    );

    let savedCount = 0;
    const chunkSize = 500;
    for (let i = 0; i < assets.length; i += chunkSize) {
      const chunk = assets.slice(i, i + chunkSize);
      await this.repo.save(chunk);
      savedCount += chunk.length;
    }

    return savedCount;
  }

  /**
   * Upsert-based bulk import from frontend-parsed JSON.
   *
   * Key:      kode_tag_aset = Excel [Id] column (globally unique per row in source).
   * Ordering: row_order     = original Excel row index (passed from frontend).
   *
   * Uploading the same file twice will UPSERT — no duplicates ever created.
   * Null cells are stored as SQL NULL (not as '-').
   * Numeric cells keep full precision (stored in JSONB as JSON numbers).
   */
  async bulkImport(rows: Record<string, unknown>[]): Promise<number> {
    if (!rows || rows.length === 0) return 0;

    const chunkSize = 500;
    let savedCount = 0;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);

      const values = chunk.map((row, localIdx) => {
        const globalIdx = i + localIdx;

        // Build a clean extra_fields object: nulls stay null, numbers stay numbers
        const cleanFields: Record<string, string | number | null> = {};
        for (const [k, v] of Object.entries(row)) {
          cleanFields[k] = normalizeCell(v);
        }

        const idVal = String(row["Id"] ?? row["id"] ?? "").trim();

        return {
          kode_tag_aset: idVal ||
            `${row["KodeBarang"] ?? "IMP"}-${globalIdx}-${Math.random().toString(36).slice(2, 8)}`,
          nama_barang:     String(row["Nama_Barang"] ?? row["nama_barang"] ?? ""),
          jenis_aset:      (String(row["TipeAset"] ?? row["jenis_aset"] ?? "PM")) as Asset["jenis_aset"],
          merk_type:       normalizeCell(row["MerkType"]) as string ?? "",
          spesifikasi:     normalizeCell(row["Spesifikasi"]) as string ?? "",
          tgl_perolehan:   row["TglPerolehan"] ? String(row["TglPerolehan"]) : null,
          harga_perolehan: Number(row["HargaSatuan"] ?? 0) || 0,
          sumber_dana:     String(row["SumberDana"] ?? ""),
          kondisi:         String(row["Kondisi"] ?? "Baik"),
          nama_ruangan:    String(row["Nama_ruangan"] ?? ""),
          nama_unit:       String(row["Nama_unit"] ?? ""),
          pengguna:        String(row["Pengguna"] ?? ""),
          row_order:       globalIdx,          // ← preserve Excel row order
          extra_fields:    cleanFields,        // ← null-safe, number-safe
        };
      });

      await this.dataSource
        .createQueryBuilder()
        .insert()
        .into(Asset)
        .values(values as any)
        .orUpdate(
          [
            "nama_barang", "jenis_aset", "merk_type", "spesifikasi", "tgl_perolehan",
            "harga_perolehan", "sumber_dana", "kondisi", "nama_ruangan", "nama_unit",
            "pengguna", "extra_fields", "row_order", "updated_at",
          ],
          ["kode_tag_aset"],
        )
        .execute();

      savedCount += chunk.length;
    }

    return savedCount;
  }

  /**
   * Efficiently delete ALL assets in a category using a single DELETE query.
   * Much faster than row-by-row deletion for large datasets (20k+ rows).
   */
  async deleteByJenis(jenis_aset: string): Promise<number> {
    const result = await this.dataSource
      .createQueryBuilder()
      .delete()
      .from(Asset)
      .where("jenis_aset = :jenis", { jenis: jenis_aset })
      .execute();
    return result.affected ?? 0;
  }

  async exportToExcel(params: AssetQueryParams = {}): Promise<Buffer> {
    const { data } = await this.findAll({ ...params, limit: 99999 });

    // For export: expand extra_fields so all original Excel columns are present
    const rows = data.map((a) => ({
      ...(a.extra_fields ?? {}),
      // Override with any structured fields that may have been enriched
      Kondisi:    a.kondisi,
      Nama_unit:  a.nama_unit,
      Pengguna:   a.pengguna,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Aset");
    return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  }
}
