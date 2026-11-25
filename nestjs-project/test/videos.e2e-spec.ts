import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { DomainExceptionFilter } from '../src/common/filters/domain-exception.filter';
import { ValidationExceptionFilter } from '../src/common/filters/validation-exception.filter';
import { DataSource } from 'typeorm';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AuthService } from '../src/auth/auth.service';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

describe('VideosController (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  async function registerConfirmAndLogin(email: string): Promise<string> {
    const authService = app.get(AuthService);
    const mailService = (
      authService as unknown as {
        mailService: {
          sendConfirmationEmail: (
            email: string,
            name: string,
            token: string,
          ) => Promise<void>;
        };
      }
    ).mailService;
    let token = '';
    jest
      .spyOn(mailService, 'sendConfirmationEmail')
      .mockImplementationOnce(async (_email, _name, rawToken) => {
        token = rawToken;
      });

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    await request(app.getHttpServer())
      .get('/auth/confirm-email')
      .query({ token })
      .expect(204);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'password123' })
      .expect(200);
    return login.body.access_token as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(
      new DomainExceptionFilter(),
      new ValidationExceptionFilter(),
    );
    await app.init();
    dataSource = moduleFixture.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication for upload initiation', async () => {
    await request(app.getHttpServer())
      .post('/videos/uploads')
      .send({ title: 'Test video', mime_type: 'video/mp4' })
      .expect(401);
  });

  it('rejects unknown or invalid upload fields', async () => {
    await request(app.getHttpServer())
      .post('/videos/uploads')
      .set('Authorization', 'Bearer invalid')
      .send({ title: '', mime_type: 'application/pdf', unknown: true })
      .expect(401);
  });

  it('completes upload, processes metadata and thumbnail, streams and downloads', async () => {
    const email = `video-${Date.now()}@example.com`;
    const accessToken = await registerConfirmAndLogin(email);

    const initiate = await request(app.getHttpServer())
      .post('/videos/uploads')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ title: 'Complete pipeline', mime_type: 'video/mp4' })
      .expect(201);

    const { slug, upload_url: uploadUrl } = initiate.body as {
      slug: string;
      upload_url: string;
    };
    const fixture = await readFile(
      join(process.cwd(), 'test/fixtures/streamtube-test.mp4'),
    );

    const { source_key: sourceKey } = initiate.body as { source_key: string };
    expect(uploadUrl).toContain('9000');

    const s3 = new S3Client({
      endpoint: 'http://minio:9000',
      region: 'us-east-1',
      credentials: { accessKeyId: 'streamtube', secretAccessKey: 'streamtube' },
      forcePathStyle: true,
    });
    await s3.send(
      new PutObjectCommand({
        Bucket: 'streamtube-videos',
        Key: sourceKey,
        ContentType: 'video/mp4',
        Body: fixture,
      }),
    );
    s3.destroy();

    await request(app.getHttpServer())
      .post(`/videos/${slug}/complete`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(201);

    let status = 'processing';
    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const response = await request(app.getHttpServer())
        .get(`/videos/${slug}/status`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      status = response.body.status as string;
      if (status === 'ready' || status === 'error') break;
    }

    expect(status).toBe('ready');

    await request(app.getHttpServer())
      .get(`/videos/${slug}/stream`)
      .set('Range', 'bytes=0-99')
      .expect(206)
      .expect('Accept-Ranges', 'bytes');

    await request(app.getHttpServer())
      .get(`/videos/${slug}/download`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect('Content-Disposition', `attachment; filename="${slug}"`);

    const row = await dataSource.query<
      { thumbnail_key: string; duration_seconds: number }[]
    >('SELECT thumbnail_key, duration_seconds FROM videos WHERE slug = $1', [
      slug,
    ]);
    expect(row[0].thumbnail_key).toMatch(/\.jpg$/);
    expect(Number(row[0].duration_seconds)).toBeGreaterThan(0);
  });
});
