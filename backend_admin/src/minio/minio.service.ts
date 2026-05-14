import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as Minio from 'minio';

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private client: Minio.Client;
  private bucket: string;

  onModuleInit() {
    const config = {
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'derlgadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'derlgadmin123',
    };
    this.logger.debug(`MinIO config: ${JSON.stringify({ ...config, secretKey: '***' })}`);
    this.client = new Minio.Client(config);

    this.bucket = process.env.MINIO_BUCKET || 'derlg-storage';
    this.logger.log(`MinIO client configured for ${config.endPoint}:${config.port}`);
  }

  getClient(): Minio.Client {
    return this.client;
  }

  async healthCheck(): Promise<{ status: string; buckets: string[]; error?: string }> {
    try {
      const buckets = await this.client.listBuckets();
      return {
        status: 'ok',
        buckets: buckets.map((b) => b.name),
      };
    } catch (error) {
      this.logger.error('MinIO health check failed:', error.message);
      return {
        status: 'error',
        buckets: [],
        error: error.message,
      };
    }
  }

  async ensureBucket(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, 'us-east-1');
        this.logger.log(`Bucket '${this.bucket}' created`);
      }
    } catch (error) {
      this.logger.error('Failed to ensure bucket:', error.message);
      throw error;
    }
  }

  getBucketName(): string {
    return this.bucket;
  }
}
