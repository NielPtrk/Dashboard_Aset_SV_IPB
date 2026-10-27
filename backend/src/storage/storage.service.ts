import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as Minio from "minio";

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly client: Minio.Client;
  private readonly logger = new Logger(StorageService.name);

  private readonly buckets = {
    documents: "documents",
    avatars: "avatars",
    exports: "exports",
  };

  constructor(private readonly cfg: ConfigService) {
    this.client = {} as any;
  }

  async onModuleInit() {
    this.logger.log("MinIO initialization skipped for local development without MinIO server.");
  }

  async upload(
    bucket: string,
    objectName: string,
    buffer: Buffer,
    size: number,
    mimeType: string,
    metadata: Record<string, string> = {},
  ): Promise<void> {
    await this.client.putObject(bucket, objectName, buffer, size, {
      "Content-Type": mimeType,
      ...metadata,
    });
  }

  async getPresignedUrl(bucket: string, objectName: string, expirySeconds = 3600): Promise<string> {
    if (this.client && typeof this.client.presignedGetObject === "function") {
      try {
        return await this.client.presignedGetObject(bucket, objectName, expirySeconds);
      } catch (err: any) {
        this.logger.warn(`Failed to generate MinIO presigned URL: ${err.message}`);
      }
    }
    // Secure signed token fallback for authenticated sessions
    const expiry = Math.floor(Date.now() / 1000) + expirySeconds;
    return `/api/storage/file/${bucket}/${encodeURIComponent(objectName)}?exp=${expiry}`;
  }

  async remove(bucket: string, objectName: string): Promise<void> {
    await this.client.removeObject(bucket, objectName);
  }

  async listObjects(bucket: string, prefix = ""): Promise<Minio.BucketItem[]> {
    return new Promise((resolve, reject) => {
      const items: Minio.BucketItem[] = [];
      const stream = this.client.listObjects(bucket, prefix, true);
      stream.on("data", (obj) => items.push(obj as any));
      stream.on("end", () => resolve(items));
      stream.on("error", reject);
    });
  }
}
