import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Like, FindOptionsWhere, ILike } from "typeorm";
import { Mutasi } from "./mutasi.entity";
import { Asset } from "../assets/asset.entity";
import { AppGateway } from "../gateway/app.gateway";

export interface MutasiQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  jenis?: string;
  asset_id?: string;
}

export interface CreateMutasiDto {
  id?: string;
  nomor_mutasi?: string;
  asset_id: string;
  kode_aset?: string;
  nama_aset?: string;
  nup?: string;
  foto_bukti?: string;
  jenis?: string;
  tanggal: string;
  tgl_ajuan?: string;
  status?: string;
  dari_gedung?: string;
  ke_gedung?: string;
  dari_ruangan?: string;
  ke_ruangan?: string;
  dari_pic?: string;
  ke_pic?: string;
  dari_unit?: string;
  ke_unit?: string;
  catatan?: string;
  pengaju?: string;
  dokumen?: Array<{ nama: string; ukuran: string; url?: string }>;
}

export interface UpdateStatusDto {
  approver?: string;
  catatan?: string;
}

@Injectable()
export class MutasiService {
  constructor(
    @InjectRepository(Mutasi)
    private readonly mutasiRepo: Repository<Mutasi>,
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
    private readonly gateway: AppGateway,
  ) {}

  async findAll(params: MutasiQueryParams = {}, user?: any) {
    const { page = 1, limit = 50, search, status, jenis, asset_id } = params;

    const queryBuilder = this.mutasiRepo.createQueryBuilder("m");

    // Pekerja Stock Opname can only see their own submissions
    if (user?.role === "Pekerja Stock Opname") {
      queryBuilder.andWhere("m.pengaju = :myPengaju", { myPengaju: user.nama });
    }

    if (status && status !== "Semua") {
      if (status === "Menunggu" || status === "Menunggu Persetujuan") {
        queryBuilder.andWhere("(m.status = 'Menunggu' OR m.status = 'Menunggu Persetujuan')");
      } else {
        queryBuilder.andWhere("m.status = :status", { status });
      }
    }

    if (jenis && jenis !== "Semua") {
      queryBuilder.andWhere("m.jenis = :jenis", { jenis });
    }

    if (asset_id) {
      queryBuilder.andWhere("m.asset_id = :asset_id", { asset_id });
    }

    if (search && search.trim()) {
      const q = `%${search.trim().toLowerCase()}%`;
      queryBuilder.andWhere(
        "(LOWER(m.nomor_mutasi) LIKE :q OR LOWER(m.asset_id) LIKE :q OR LOWER(m.catatan) LIKE :q OR LOWER(m.pengaju) LIKE :q)",
        { q },
      );
    }

    queryBuilder.orderBy("m.created_at", "DESC");

    if (limit > 0 && limit <= 10000) {
      queryBuilder.skip((page - 1) * limit).take(limit);
    }

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 1,
    };
  }

  private isUuid(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  async findOne(id: string, user?: any): Promise<Mutasi> {
    const whereCondition = this.isUuid(id)
      ? [{ id }, { nomor_mutasi: id }]
      : { nomor_mutasi: id };

    const mutasi = await this.mutasiRepo.findOne({
      where: whereCondition,
    });
    if (!mutasi) {
      throw new NotFoundException(`Data mutasi dengan ID "${id}" tidak ditemukan.`);
    }

    if (user?.role === "Pekerja Stock Opname" && mutasi.pengaju && mutasi.pengaju !== user.nama) {
      throw new ForbiddenException("Anda hanya dapat mengakses pengajuan mutasi milik sendiri.");
    }

    return mutasi;
  }

  private async generateNomorMutasi(): Promise<string> {
    const currentYear = new Date().getFullYear();
    const prefix = `MT-${currentYear}-`;

    const latest = await this.mutasiRepo
      .createQueryBuilder("m")
      .where("m.nomor_mutasi LIKE :prefix", { prefix: `${prefix}%` })
      .orderBy("m.nomor_mutasi", "DESC")
      .getOne();

    let seq = 1;
    if (latest && latest.nomor_mutasi) {
      const parts = latest.nomor_mutasi.split("-");
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) {
        seq = lastSeq + 1;
      }
    }

    return `${prefix}${String(seq).padStart(3, "0")}`;
  }

  async create(dto: CreateMutasiDto): Promise<Mutasi> {
    const nomor_mutasi = dto.nomor_mutasi || (await this.generateNomorMutasi());
    const today = new Date().toISOString().split("T")[0];

    const entity = this.mutasiRepo.create({
      ...dto,
      nomor_mutasi,
      tanggal: dto.tanggal || today,
      tgl_ajuan: dto.tgl_ajuan || dto.tanggal || today,
      status: dto.status || "Menunggu Persetujuan",
      jenis: dto.jenis || "Pindah Ruangan",
      dokumen: dto.dokumen || [],
    });

    const saved = await this.mutasiRepo.save(entity);

    try {
      this.gateway.emit("mutasi:status_changed", saved);
    } catch {
      // Gateway logging optional
    }

    return saved;
  }

  async approve(id: string, dto: UpdateStatusDto = {}): Promise<{ mutasi: Mutasi; asset?: Asset; message: string }> {
    const mutasi = await this.findOne(id);

    if (mutasi.status === "Disetujui" || mutasi.status === "Ditolak") {
      const processedBy = mutasi.approver || "Admin lain";
      const processedAt = mutasi.tanggal_approval
        ? new Date(mutasi.tanggal_approval).toLocaleString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "sebelumnya";
      throw new ConflictException(`Pengajuan ini sudah diproses (${mutasi.status}) oleh ${processedBy} pada ${processedAt}`);
    }

    mutasi.status = "Disetujui";
    if (dto.approver) mutasi.approver = dto.approver;
    if (dto.catatan) mutasi.catatan_approver = dto.catatan;
    mutasi.tanggal_approval = new Date();

    const savedMutasi = await this.mutasiRepo.save(mutasi);

    // Update target asset location and PIC in database
    let updatedAsset: Asset | undefined;
    const targetAsset = await this.assetRepo.findOne({
      where: this.isUuid(mutasi.asset_id)
        ? [{ id: mutasi.asset_id }, { kode_tag_aset: mutasi.asset_id }]
        : { kode_tag_aset: mutasi.asset_id },
    });

    if (targetAsset) {
      if (mutasi.ke_ruangan) targetAsset.nama_ruangan = mutasi.ke_ruangan;
      if (mutasi.ke_gedung) targetAsset.gedung = mutasi.ke_gedung;
      if (mutasi.ke_pic) targetAsset.pengguna = mutasi.ke_pic;
      if (mutasi.ke_unit) targetAsset.nama_unit = mutasi.ke_unit;

      const extra = targetAsset.extra_fields || {};
      targetAsset.extra_fields = {
        ...extra,
        ...(mutasi.ke_ruangan ? { Nama_ruangan: mutasi.ke_ruangan, nama_ruangan_standar: mutasi.ke_ruangan } : {}),
        ...(mutasi.ke_gedung ? { nama_gedung: mutasi.ke_gedung, gedung: mutasi.ke_gedung } : {}),
        ...(mutasi.ke_pic ? { nama_pic: mutasi.ke_pic, Pengguna: mutasi.ke_pic } : {}),
        ...(mutasi.ke_unit ? { Nama_unit: mutasi.ke_unit } : {}),
        tanggal_mutasi_terakhir: mutasi.tanggal,
        status_mutasi_terakhir: "Disetujui",
        catatan_mutasi_terakhir: dto.catatan || mutasi.catatan || "-",
        nomor_mutasi_terakhir: mutasi.nomor_mutasi,
      };

      updatedAsset = await this.assetRepo.save(targetAsset);

      try {
        this.gateway.emit("asset:updated", updatedAsset);
      } catch {}
    }

    try {
      this.gateway.emit("mutasi:status_changed", savedMutasi);
    } catch {}

    return {
      mutasi: savedMutasi,
      asset: updatedAsset,
      message: `Mutasi ${savedMutasi.nomor_mutasi} berhasil disetujui. Lokasi dan PIC aset telah diperbarui.`,
    };
  }

  async reject(id: string, dto: UpdateStatusDto = {}): Promise<{ mutasi: Mutasi; message: string }> {
    const mutasi = await this.findOne(id);

    if (mutasi.status === "Disetujui" || mutasi.status === "Ditolak") {
      const processedBy = mutasi.approver || "Admin lain";
      const processedAt = mutasi.tanggal_approval
        ? new Date(mutasi.tanggal_approval).toLocaleString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "sebelumnya";
      throw new ConflictException(`Pengajuan ini sudah diproses (${mutasi.status}) oleh ${processedBy} pada ${processedAt}`);
    }

    const trimmedAlasan = (dto.catatan || "").trim();
    if (!trimmedAlasan || trimmedAlasan.length < 10) {
      throw new BadRequestException("Alasan penolakan mutasi wajib diisi minimal 10 karakter.");
    }
    if (trimmedAlasan.length > 500) {
      throw new BadRequestException("Alasan penolakan mutasi maksimal 500 karakter.");
    }

    mutasi.status = "Ditolak";
    if (dto.approver) mutasi.approver = dto.approver;
    mutasi.catatan_approver = trimmedAlasan;
    mutasi.tanggal_approval = new Date();

    const savedMutasi = await this.mutasiRepo.save(mutasi);

    try {
      this.gateway.emit("mutasi:status_changed", savedMutasi);
    } catch {}

    return {
      mutasi: savedMutasi,
      message: `Mutasi ${savedMutasi.nomor_mutasi} telah ditolak.`,
    };
  }

  async update(id: string, partial: Partial<Mutasi>): Promise<Mutasi> {
    const mutasi = await this.findOne(id);
    Object.assign(mutasi, partial);
    return this.mutasiRepo.save(mutasi);
  }

  async remove(id: string): Promise<{ deleted: boolean; message: string }> {
    const mutasi = await this.findOne(id);
    const saved = { ...mutasi };
    await this.mutasiRepo.remove(mutasi);
    try {
      this.gateway.emit("mutasi:status_changed", { ...saved, status: "Dihapus", deleted: true });
    } catch {}
    return { deleted: true, message: `Mutasi ${saved.nomor_mutasi} telah dihapus.` };
  }
}
