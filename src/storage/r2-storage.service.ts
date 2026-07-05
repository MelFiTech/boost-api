import {
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface R2UploadInput {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
  cacheControl?: string;
}

@Injectable()
export class R2StorageService implements OnModuleInit {
  private readonly logger = new Logger(R2StorageService.name);
  private client: S3Client | null = null;
  private bucket = '';
  private publicBaseUrl = '';

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');
    const endpoint = this.config.get<string>('R2_ENDPOINT');
    this.bucket = this.config.get<string>('R2_BUCKET_NAME') || 'boostlab';
    this.publicBaseUrl = (this.config.get<string>('R2_PUBLIC_URL') || '').replace(/\/$/, '');

    if (!accessKeyId || !secretAccessKey || !endpoint) {
      this.logger.warn('R2 storage is not fully configured — uploads disabled');
      return;
    }

    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  isConfigured(): boolean {
    return !!this.client;
  }

  getPublicUrl(key: string): string {
    const normalizedKey = key.replace(/^\/+/, '');
    if (!this.publicBaseUrl) {
      throw new Error('R2_PUBLIC_URL is not configured');
    }
    return `${this.publicBaseUrl}/${normalizedKey}`;
  }

  async verifyBucketAccess(): Promise<boolean> {
    if (!this.client) return false;

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`R2 bucket "${this.bucket}" is reachable`);
      return true;
    } catch (error) {
      this.logger.error(`R2 bucket check failed: ${error.message}`);
      return false;
    }
  }

  async upload(input: R2UploadInput): Promise<string> {
    if (!this.client) {
      throw new Error('R2 storage is not configured');
    }

    const key = input.key.replace(/^\/+/, '');
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: input.cacheControl || 'public, max-age=31536000, immutable',
      }),
    );

    return this.getPublicUrl(key);
  }

  async delete(key: string): Promise<void> {
    if (!this.client) {
      throw new Error('R2 storage is not configured');
    }

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key.replace(/^\/+/, ''),
      }),
    );
  }
}
