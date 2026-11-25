import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  endpoint: process.env.S3_ENDPOINT || 'http://minio:9000',
  publicEndpoint: process.env.S3_PUBLIC_ENDPOINT || 'http://localhost:9000',
  region: process.env.S3_REGION || 'us-east-1',
  accessKey: process.env.S3_ACCESS_KEY || 'streamtube',
  secretKey: process.env.S3_SECRET_KEY || 'streamtube',
  bucket: process.env.S3_BUCKET || 'streamtube-videos',
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  uploadExpiresSeconds: parseInt(
    process.env.S3_UPLOAD_EXPIRES_SECONDS || '3600',
    10,
  ),
  downloadExpiresSeconds: parseInt(
    process.env.S3_DOWNLOAD_EXPIRES_SECONDS || '3600',
    10,
  ),
  maxUploadBytes: parseInt(
    process.env.S3_MAX_UPLOAD_BYTES || '10737418240',
    10,
  ),
}));
