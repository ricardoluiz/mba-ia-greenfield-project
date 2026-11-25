import { Worker, type Job } from 'bullmq';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Client as PgClient } from 'pg';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface VideoJob {
  videoId: string;
  sourceKey: string;
  slug: string;
}

const redis = { host: process.env.REDIS_HOST || 'redis', port: parseInt(process.env.REDIS_PORT || '6379', 10) };
const s3 = new S3Client({ endpoint: process.env.S3_ENDPOINT || 'http://minio:9000', region: 'us-east-1', credentials: { accessKeyId: process.env.S3_ACCESS_KEY || 'streamtube', secretAccessKey: process.env.S3_SECRET_KEY || 'streamtube' }, forcePathStyle: true });
const bucket = process.env.S3_BUCKET || 'streamtube-videos';

async function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || `${command} exited ${code}`)));
  });
}

async function db(): Promise<PgClient> {
  const client = new PgClient({ host: process.env.DB_HOST || 'db', port: parseInt(process.env.DB_PORT || '5432', 10), user: process.env.DB_USERNAME || 'streamtube', password: process.env.DB_PASSWORD || 'streamtube', database: process.env.DB_NAME || 'streamtube' });
  await client.connect();
  return client;
}

const worker = new Worker<VideoJob>('video-processing', async (job: Job<VideoJob>) => {
  const dir = await mkdtemp(join(tmpdir(), 'streamtube-'));
  const source = join(dir, 'source.mp4');
  const thumbnail = join(dir, 'thumbnail.jpg');
  const dbClient = await db();
  try {
    await dbClient.query(`UPDATE videos SET status = 'processing', processing_error = NULL, updated_at = NOW() WHERE id = $1`, [job.data.videoId]);
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: job.data.sourceKey }));
    const stream = object.Body as unknown as NodeJS.ReadableStream;
    const writeStream = createWriteStream(source);
    await pipeline(stream, writeStream);

    const probeText = await run('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', source]);
    const probe = JSON.parse(probeText) as Record<string, unknown>;
    const format = probe.format as { duration?: string } | undefined;
    await run('ffmpeg', ['-v', 'error', '-ss', '1', '-i', source, '-frames:v', '1', '-y', thumbnail]);

    const thumbnailKey = `channels/thumbnails/${job.data.slug}.jpg`;
    const thumbnailBytes = await readFile(thumbnail);
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: thumbnailKey, Body: thumbnailBytes, ContentType: 'image/jpeg' }));

    await dbClient.query(`UPDATE videos SET status = 'ready', thumbnail_key = $1, duration_seconds = $2, metadata = $3, processing_error = NULL, updated_at = NOW() WHERE id = $4`, [thumbnailKey, format?.duration ? Number(format.duration) : null, JSON.stringify(probe), job.data.videoId]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown processing error';
    const attempts = job.opts.attempts ?? 3;
    if (job.attemptsMade >= attempts - 1) {
      await dbClient.query(`UPDATE videos SET status = 'error', processing_error = $1, updated_at = NOW() WHERE id = $2`, [message, job.data.videoId]);
    }
    throw error;
  } finally {
    await dbClient.end();
    await rm(dir, { recursive: true, force: true });
  }
}, { connection: redis, concurrency: 1 });

worker.on('failed', (job, error) => console.error('video job failed', job?.id, error.message));
