import apiClient from "./apiClient";
import type {
  Asset,
  MaintenanceTicket,
  MutationRequest,
  ProcurementRequest,
  StockOpnameRecord,
  DocumentRecord,
  ActivityLog,
  UserRecord,
  RoomRecord,
} from "../components/DataStore";

// ─── Generic paginated response shape from NestJS ─────────────────────────────
export interface PagedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface QueryParams {
  page?: number;
  limit?: number;
  search?: string;
  jenis?: string;
  kondisi?: string;
  status?: string;
  unit?: string;
  gedung?: string;
  lantai?: string;
  ruangan?: string;
  pic?: string;
  tahun?: string;
}

// ─── Assets ───────────────────────────────────────────────────────────────────
export const assetApi = {
  list: (params?: QueryParams) =>
    apiClient.get<PagedResponse<Asset>>("/assets", { params }),
  get: (id: string) =>
    apiClient.get<Asset>(`/assets/${id}`),
  create: (payload: Partial<Asset>) =>
    apiClient.post<Asset>("/assets", payload),
  update: (id: string, payload: Partial<Asset>) =>
    apiClient.patch<Asset>(`/assets/${id}`, payload),
  remove: (id: string) =>
    apiClient.delete(`/assets/${id}`),
  importExcel: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return apiClient.post<{ imported: number }>("/assets/import", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  bulkImport: (rows: Record<string, string>[]) =>
    apiClient.post<{ imported: number }>("/assets/bulk", rows),
  exportExcel: (params?: QueryParams) =>
    apiClient.get("/assets/export", { params, responseType: "blob" }),
};

// ─── Maintenance / Perbaikan ──────────────────────────────────────────────────
export const maintenanceApi = {
  list: (params?: QueryParams) =>
    apiClient.get<PagedResponse<MaintenanceTicket>>("/maintenance", { params }),
  get: (id: string) =>
    apiClient.get<MaintenanceTicket>(`/maintenance/${id}`),
  create: (payload: Partial<MaintenanceTicket>) =>
    apiClient.post<MaintenanceTicket>("/maintenance", payload),
  update: (id: string, payload: Partial<MaintenanceTicket>) =>
    apiClient.patch<MaintenanceTicket>(`/maintenance/${id}`, payload),
  remove: (id: string) =>
    apiClient.delete(`/maintenance/${id}`),
};

// ─── Mutasi ────────────────────────────────────────────────────────────────────
export const mutasiApi = {
  list: (params?: QueryParams) =>
    apiClient.get<PagedResponse<MutationRequest>>("/mutasi", { params }),
  get: (id: string) =>
    apiClient.get<MutationRequest>(`/mutasi/${id}`),
  create: (payload: Partial<MutationRequest>) =>
    apiClient.post<MutationRequest>("/mutasi", payload),
  update: (id: string, payload: Partial<MutationRequest>) =>
    apiClient.patch<MutationRequest>(`/mutasi/${id}`, payload),
  approve: (id: string) =>
    apiClient.post(`/mutasi/${id}/approve`),
  reject: (id: string, catatan: string) =>
    apiClient.post(`/mutasi/${id}/reject`, { catatan }),
};

// ─── Pengadaan ─────────────────────────────────────────────────────────────────
export const pengadaanApi = {
  list: (params?: QueryParams) =>
    apiClient.get<PagedResponse<ProcurementRequest>>("/pengadaan", { params }),
  get: (id: string) =>
    apiClient.get<ProcurementRequest>(`/pengadaan/${id}`),
  create: (payload: Partial<ProcurementRequest>) =>
    apiClient.post<ProcurementRequest>("/pengadaan", payload),
  update: (id: string, payload: Partial<ProcurementRequest>) =>
    apiClient.patch<ProcurementRequest>(`/pengadaan/${id}`, payload),
  approve: (id: string) =>
    apiClient.post(`/pengadaan/${id}/approve`),
  reject: (id: string, catatan: string) =>
    apiClient.post(`/pengadaan/${id}/reject`, { catatan }),
};

// ─── Stock Opname ──────────────────────────────────────────────────────────────
export const opnameApi = {
  listSesi: (params?: QueryParams) =>
    apiClient.get("/opname/sesi", { params }),
  getSesi: (id: string) =>
    apiClient.get(`/opname/sesi/${id}`),
  createSesi: (payload: Record<string, unknown>) =>
    apiClient.post("/opname/sesi", payload),
  listRecords: (sesiId: string, params?: QueryParams) =>
    apiClient.get<PagedResponse<StockOpnameRecord>>(`/opname/sesi/${sesiId}/records`, { params }),
  verifyRecord: (id: string, payload: Partial<StockOpnameRecord>) =>
    apiClient.patch<StockOpnameRecord>(`/opname/records/${id}`, payload),
};

// ─── Dokumen ───────────────────────────────────────────────────────────────────
export const dokumenApi = {
  list: (params?: QueryParams) =>
    apiClient.get<PagedResponse<DocumentRecord>>("/dokumen", { params }),
  upload: (file: File, meta: Partial<DocumentRecord>) => {
    const form = new FormData();
    form.append("file", file);
    form.append("meta", JSON.stringify(meta));
    return apiClient.post<DocumentRecord>("/dokumen/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  remove: (id: string) =>
    apiClient.delete(`/dokumen/${id}`),
  getDownloadUrl: (id: string) =>
    apiClient.get<{ url: string }>(`/dokumen/${id}/url`),
};

// ─── Aktivitas ─────────────────────────────────────────────────────────────────
export const aktivitasApi = {
  list: (params?: QueryParams) =>
    apiClient.get<PagedResponse<ActivityLog>>("/aktivitas", { params }),
  exportExcel: (params?: QueryParams) =>
    apiClient.get("/aktivitas/export", { params, responseType: "blob" }),
};

// ─── PIC / Pengguna ────────────────────────────────────────────────────────────
export const userApi = {
  list: (params?: QueryParams) =>
    apiClient.get<PagedResponse<UserRecord>>("/users", { params }),
  get: (id: string) =>
    apiClient.get<UserRecord>(`/users/${id}`),
  create: (payload: Partial<UserRecord>) =>
    apiClient.post<UserRecord>("/users", payload),
  update: (id: string, payload: Partial<UserRecord>) =>
    apiClient.patch<UserRecord>(`/users/${id}`, payload),
  remove: (id: string) =>
    apiClient.delete(`/users/${id}`),
  sendEmailNotification: (id: string, subject: string, body: string) =>
    apiClient.post(`/users/${id}/notify`, { subject, body }),
};

// ─── Ruangan ───────────────────────────────────────────────────────────────────
export const ruanganApi = {
  list: (params?: QueryParams) =>
    apiClient.get<PagedResponse<RoomRecord>>("/ruangan", { params }),
  get: (id: string) =>
    apiClient.get<RoomRecord>(`/ruangan/${id}`),
};
