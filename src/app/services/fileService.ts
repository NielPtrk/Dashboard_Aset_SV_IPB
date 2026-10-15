import apiClient from "./apiClient";

// ─── MinIO-backed file service via NestJS proxy ───────────────────────────────
// The NestJS backend handles MinIO credentials and pre-signed URL generation.
// Frontend only interacts with NestJS endpoints — never directly with MinIO.

export interface UploadedFile {
  id: string;
  originalName: string;
  storedName: string;
  bucket: string;
  size: number;
  mimeType: string;
  url: string;        // Pre-signed MinIO download URL (short-lived)
  createdAt: string;
}

export const fileService = {
  // Upload a single file — returns the stored object metadata
  async upload(
    file: File,
    bucket: "documents" | "avatars" | "exports" = "documents",
    metadata?: Record<string, string>,
  ): Promise<UploadedFile> {
    const form = new FormData();
    form.append("file", file);
    form.append("bucket", bucket);
    if (metadata) {
      form.append("metadata", JSON.stringify(metadata));
    }
    const { data } = await apiClient.post<UploadedFile>("/storage/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  // Request a fresh pre-signed download URL for an existing object
  async getPresignedUrl(storedName: string, bucket = "documents"): Promise<string> {
    const { data } = await apiClient.get<{ url: string }>("/storage/url", {
      params: { storedName, bucket },
    });
    return data.url;
  },

  // Delete an object from MinIO via NestJS
  async remove(storedName: string, bucket = "documents"): Promise<void> {
    await apiClient.delete("/storage/object", {
      params: { storedName, bucket },
    });
  },

  // List files in a bucket (optionally filtered by prefix)
  async list(bucket = "documents", prefix?: string): Promise<UploadedFile[]> {
    const { data } = await apiClient.get<UploadedFile[]>("/storage/list", {
      params: { bucket, prefix },
    });
    return data;
  },
};

export default fileService;
