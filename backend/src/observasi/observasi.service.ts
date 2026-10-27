import { Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { ObservasiItem } from "./observasi-item.entity";

export interface ObservasiQueryParams {
  tahun?: number;
  ruanganId?: string;
  kampus?: string;
  namaGedung?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface BulkSaveObservasiDto {
  ruanganId: string;
  tahun: number;
  kampus?: string;
  namaGedung?: string;
  kodeRuangan?: string;
  namaRuangan?: string;
  unitKerja?: string;
  petugas?: string;
  items: Array<{
    id?: string;
    noUrut?: number;
    kodeBarang?: string;
    namaBarang: string;
    nup?: string;
    merekType?: string;
    tahunPerolehan?: string;
    hargaSatuan?: number;
    volume?: number;
    satuan?: string;
    jumlahHarga?: number;
    sumberDana?: string;
    kondisi?: string;
    penguasaan?: string;
    keterangan?: string;
  }>;
}

@Injectable()
export class ObservasiService implements OnModuleInit {
  constructor(
    @InjectRepository(ObservasiItem)
    private readonly repo: Repository<ObservasiItem>,
    private readonly dataSource: DataSource,
  ) {}

  async onModuleInit() {
    try {
      const dummyKodes = [
        "3.05.01.05.001", "3.05.01.05.002", "3.05.01.05.003",
        "3.05.02.01.008", "3.05.02.04.004", "3.05.02.04.005",
        "3.05.01.04.010", "3.05.02.06.002", "3.05.02.06.003",
        "3.05.02.01.015", "3.05.01.05.020", "3.05.02.05.001",
        "3.05.01.04.015", "3.05.02.01.022", "3.05.01.05.030"
      ];
      await this.repo.createQueryBuilder()
        .delete()
        .from(ObservasiItem)
        .where("petugas = :petugas", { petugas: "Petugas Lapangan" })
        .andWhere(
          "(kodeBarang IN (:...dummyKodes) OR namaBarang ILIKE '%Meja Dosen Kayu Jati%' OR namaBarang ILIKE '%Kursi Ergonomis Staff%' OR namaBarang ILIKE '%Kursi Kerja Dosen Hidrolik%' OR namaBarang ILIKE '%Kursi Kuliah Mahasiswa Chitose%')",
          { dummyKodes }
        )
        .execute();
    } catch (err) {
      console.warn("[ObservasiService] Dummy cleanup check:", err);
    }
  }

  async findAll(query: ObservasiQueryParams) {
    const qb = this.repo.createQueryBuilder("item");

    if (query.tahun) {
      qb.andWhere("item.tahun = :tahun", { tahun: Number(query.tahun) });
    }

    if (query.ruanganId) {
      qb.andWhere("item.ruanganId = :ruanganId", { ruanganId: query.ruanganId });
    }

    if (query.kampus && query.kampus !== "Semua") {
      qb.andWhere("item.kampus = :kampus", { kampus: query.kampus });
    }

    if (query.namaGedung && query.namaGedung !== "Semua") {
      qb.andWhere("item.namaGedung = :namaGedung", { namaGedung: query.namaGedung });
    }

    if (query.search) {
      qb.andWhere(
        "(item.namaBarang ILIKE :search OR item.kodeBarang ILIKE :search OR item.nup ILIKE :search OR item.merekType ILIKE :search OR item.namaRuangan ILIKE :search)",
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy("item.ruanganId", "ASC")
      .addOrderBy("item.noUrut", "ASC");

    if (query.limit) {
      const page = query.page || 1;
      const limit = query.limit || 50;
      qb.skip((page - 1) * limit).take(limit);
      const [data, total] = await qb.getManyAndCount();
      return { data, total, page, limit };
    }

    const data = await qb.getMany();
    return { data, total: data.length };
  }

  async findByRoom(ruanganId: string, tahun?: number) {
    const qb = this.repo.createQueryBuilder("item")
      .where("item.ruanganId = :ruanganId", { ruanganId });

    if (tahun) {
      qb.andWhere("item.tahun = :tahun", { tahun: Number(tahun) });
    }

    qb.orderBy("item.noUrut", "ASC");
    const data = await qb.getMany();
    return { data, total: data.length };
  }

  async getSummary(tahun: number) {
    const selectedYear = Number(tahun) || new Date().getFullYear();
    const raw = await this.repo
      .createQueryBuilder("item")
      .select("item.ruanganId", "ruanganId")
      .addSelect("item.namaRuangan", "namaRuangan")
      .addSelect("item.kodeRuangan", "kodeRuangan")
      .addSelect("item.namaGedung", "namaGedung")
      .addSelect("item.kampus", "kampus")
      .addSelect("COUNT(item.id)", "itemCount")
      .addSelect("SUM(item.jumlahHarga)", "totalNilai")
      .where("item.tahun = :tahun", { tahun: selectedYear })
      .groupBy("item.ruanganId")
      .addGroupBy("item.namaRuangan")
      .addGroupBy("item.kodeRuangan")
      .addGroupBy("item.namaGedung")
      .addGroupBy("item.kampus")
      .getRawMany();

    const totalObservedRooms = raw.length;
    const totalItems = raw.reduce((sum, r) => sum + Number(r.itemCount || 0), 0);
    const totalNilai = raw.reduce((sum, r) => sum + Number(r.totalNilai || 0), 0);

    return {
      tahun: selectedYear,
      totalObservedRooms,
      totalItems,
      totalNilai,
      rooms: raw,
    };
  }

  async bulkSave(dto: BulkSaveObservasiDto, user?: any) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const isPekerjaSO = user?.role === "Pekerja Stock Opname";

    try {
      if (isPekerjaSO) {
        // For Pekerja Stock Opname: NEVER delete missing rows!
        // Only insert new items or update existing items.
        const existingItems = await queryRunner.manager.find(ObservasiItem, {
          where: { ruanganId: dto.ruanganId, tahun: Number(dto.tahun) },
        });

        const saved: ObservasiItem[] = [];
        for (let idx = 0; idx < (dto.items || []).length; idx++) {
          const item = dto.items[idx];
          const vol = Number(item.volume) || 1;
          const harga = Number(item.hargaSatuan) || 0;
          const total = item.jumlahHarga !== undefined ? Number(item.jumlahHarga) : harga * vol;

          // Find match by id or by (kodeBarang + nup) or namaBarang
          let match = item.id
            ? existingItems.find(e => e.id === item.id)
            : existingItems.find(e => e.kodeBarang && item.kodeBarang && e.kodeBarang === item.kodeBarang && e.nup === item.nup);

          if (match) {
            match.namaBarang = item.namaBarang || match.namaBarang;
            match.kodeBarang = item.kodeBarang || match.kodeBarang;
            match.nup = item.nup || match.nup;
            match.merekType = item.merekType || match.merekType;
            match.tahunPerolehan = item.tahunPerolehan || match.tahunPerolehan;
            match.hargaSatuan = harga;
            match.volume = vol;
            match.satuan = item.satuan || match.satuan;
            match.jumlahHarga = total;
            match.sumberDana = item.sumberDana || match.sumberDana;
            match.kondisi = item.kondisi || match.kondisi;
            match.penguasaan = item.penguasaan || match.penguasaan;
            match.keterangan = item.keterangan || match.keterangan;
            const res = await queryRunner.manager.save(ObservasiItem, match);
            saved.push(res);
          } else {
            const entity = new ObservasiItem();
            entity.ruanganId = dto.ruanganId;
            entity.tahun = Number(dto.tahun);
            entity.kampus = dto.kampus || "";
            entity.namaGedung = dto.namaGedung || "";
            entity.kodeRuangan = dto.kodeRuangan || "";
            entity.namaRuangan = dto.namaRuangan || "";
            entity.unitKerja = dto.unitKerja || "Sekolah Vokasi (SV)";
            entity.petugas = dto.petugas || user?.nama || "Petugas Lapangan";
            entity.noUrut = item.noUrut || existingItems.length + saved.length + 1;
            entity.kodeBarang = item.kodeBarang || "";
            entity.namaBarang = item.namaBarang;
            entity.nup = item.nup || "";
            entity.merekType = item.merekType || "";
            entity.tahunPerolehan = item.tahunPerolehan || "";
            entity.hargaSatuan = harga;
            entity.volume = vol;
            entity.satuan = item.satuan || "unit";
            entity.jumlahHarga = total;
            entity.sumberDana = item.sumberDana || "Tidak Diketahui";
            entity.kondisi = item.kondisi || "Baik";
            entity.penguasaan = item.penguasaan || "Milik Sendiri";
            entity.keterangan = item.keterangan || "";
            entity.status = "Tersimpan";
            const res = await queryRunner.manager.save(ObservasiItem, entity);
            saved.push(res);
          }
        }

        await queryRunner.commitTransaction();
        return { success: true, count: saved.length, data: saved };
      }

      // 1. Delete existing items for this room and year (Admin Pusat and Admin Sistem only)
      await queryRunner.manager.delete(ObservasiItem, {
        ruanganId: dto.ruanganId,
        tahun: Number(dto.tahun),
      });

      // 2. Insert new items
      const newEntities = (dto.items || []).map((item, idx) => {
        const vol = Number(item.volume) || 1;
        const harga = Number(item.hargaSatuan) || 0;
        const total = item.jumlahHarga !== undefined ? Number(item.jumlahHarga) : harga * vol;

        const entity = new ObservasiItem();
        entity.ruanganId = dto.ruanganId;
        entity.tahun = Number(dto.tahun);
        entity.kampus = dto.kampus || "";
        entity.namaGedung = dto.namaGedung || "";
        entity.kodeRuangan = dto.kodeRuangan || "";
        entity.namaRuangan = dto.namaRuangan || "";
        entity.unitKerja = dto.unitKerja || "Sekolah Vokasi (SV)";
        entity.petugas = dto.petugas || "Petugas Lapangan";
        entity.noUrut = item.noUrut || idx + 1;
        entity.kodeBarang = item.kodeBarang || "";
        entity.namaBarang = item.namaBarang;
        entity.nup = item.nup || "";
        entity.merekType = item.merekType || "";
        entity.tahunPerolehan = item.tahunPerolehan || "";
        entity.hargaSatuan = harga;
        entity.volume = vol;
        entity.satuan = item.satuan || "unit";
        entity.jumlahHarga = total;
        entity.sumberDana = item.sumberDana || "Tidak Diketahui";
        entity.kondisi = item.kondisi || "Baik";
        entity.penguasaan = item.penguasaan || "Milik Sendiri";
        entity.keterangan = item.keterangan || "";
        entity.status = "Tersimpan";
        return entity;
      });

      let saved: ObservasiItem[] = [];
      if (newEntities.length > 0) {
        saved = await queryRunner.manager.save(ObservasiItem, newEntities);
      }

      await queryRunner.commitTransaction();
      return { success: true, count: saved.length, data: saved };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async create(body: Partial<ObservasiItem>) {
    const vol = Number(body.volume) || 1;
    const harga = Number(body.hargaSatuan) || 0;
    const total = body.jumlahHarga !== undefined ? Number(body.jumlahHarga) : harga * vol;

    const item = this.repo.create({
      ...body,
      volume: vol,
      hargaSatuan: harga,
      jumlahHarga: total,
    });
    return this.repo.save(item);
  }

  async update(id: string, body: Partial<ObservasiItem>) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`ObservasiItem with ID ${id} not found`);

    if (body.hargaSatuan !== undefined || body.volume !== undefined) {
      const vol = body.volume !== undefined ? Number(body.volume) : item.volume;
      const harga = body.hargaSatuan !== undefined ? Number(body.hargaSatuan) : item.hargaSatuan;
      body.jumlahHarga = harga * vol;
    }

    Object.assign(item, body);
    return this.repo.save(item);
  }

  async remove(id: string) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`ObservasiItem with ID ${id} not found`);
    return this.repo.remove(item);
  }

  async removeByRoom(ruanganId: string, tahun: number) {
    await this.repo.delete({
      ruanganId,
      tahun: Number(tahun),
    });
    return { success: true, message: `Observation for room ${ruanganId} in ${tahun} deleted.` };
  }
}
