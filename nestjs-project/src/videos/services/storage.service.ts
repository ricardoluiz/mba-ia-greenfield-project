import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import storageConfig from '../../config/storage.config';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly publicClient: S3Client;

  constructor(
    @Inject(storageConfig.KEY)
    private readonly config: ConfigType<typeof storageConfig>,
  ) {
    const clientOptions = {
      region: config.region,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: config.forcePathStyle,
    };
    this.client = new S3Client({ ...clientOptions, endpoint: config.endpoint });
    this.publicClient = new S3Client({
      ...clientOptions,
      endpoint: config.publicEndpoint,
    });
  }

  async ensureBucket(): Promise<void> {
    await this.client
      .send(new CreateBucketCommand({ Bucket: this.config.bucket }))
      .catch((error: unknown) => {
        const name = (error as { name?: string }).name;
        if (
          name !== 'BucketAlreadyOwnedByYou' &&
          name !== 'BucketAlreadyExists'
        )
          throw error;
      });
  }

  async presignedPut(key: string, mimeType: string): Promise<string> {
    return getSignedUrl(
      this.publicClient,
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        ContentType: mimeType,
      }),
      { expiresIn: this.config.uploadExpiresSeconds },
    );
  }

  async head(key: string): Promise<{ size: number; mimeType?: string }> {
    const result = await this.client.send(
      new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
    return { size: result.ContentLength ?? 0, mimeType: result.ContentType };
  }

  async get(
    key: string,
    range?: string,
  ): Promise<{
    body: unknown;
    contentLength?: number;
    contentType?: string;
    acceptRanges: string;
    contentRange?: string;
  }> {
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Range: range,
      }),
    );
    return {
      body: result.Body,
      contentLength: result.ContentLength,
      contentType: result.ContentType,
      acceptRanges: 'bytes',
      contentRange: result.ContentRange,
    };
  }
}
