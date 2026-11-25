import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { Repository } from 'typeorm';
import { Channel } from '../channels/entities/channel.entity';
import queueConfig from '../config/queue.config';
import storageConfig from '../config/storage.config';
import { CreateUploadDto } from './dto/create-upload.dto';
import { Video, VideoStatus } from './entities/video.entity';
import {
  InvalidRangeException,
  VideoNotFoundException,
  VideoNotOwnerException,
  VideoNotReadyException,
  VideoUploadNotFoundException,
  VideoUploadTooLargeException,
} from './exceptions/video.exceptions';
import { StorageService } from './services/storage.service';
import { parseByteRange } from './range.util';

@Injectable()
export class VideosService {
  constructor(
    @InjectRepository(Video) private readonly videos: Repository<Video>,
    @InjectRepository(Channel) private readonly channels: Repository<Channel>,
    @Inject(storageConfig.KEY)
    private readonly storageOptions: ConfigType<typeof storageConfig>,
    @Inject(queueConfig.KEY)
    private readonly queueOptions: ConfigType<typeof queueConfig>,
    @InjectQueue('video-processing') private readonly queue: Queue,
    private readonly storage: StorageService,
  ) {}

  async createUpload(
    userId: string,
    dto: CreateUploadDto,
  ): Promise<{
    video_id: string;
    slug: string;
    upload_url: string;
    source_key: string;
    expires_in: number;
  }> {
    const channel = await this.channels.findOne({ where: { user_id: userId } });
    if (!channel) throw new VideoNotFoundException();
    const slug = randomUUID();
    const sourceKey = `channels/${channel.id}/videos/${slug}/source`;
    const video = await this.videos.save(
      this.videos.create({
        channel_id: channel.id,
        title: dto.title,
        slug,
        status: VideoStatus.DRAFT,
        source_key: sourceKey,
        mime_type: dto.mime_type,
        size_bytes: '0',
        metadata: {},
      }),
    );
    const uploadUrl = await this.storage.presignedPut(sourceKey, dto.mime_type);
    return {
      video_id: video.id,
      slug,
      upload_url: uploadUrl,
      source_key: sourceKey,
      expires_in: this.storageOptions.uploadExpiresSeconds,
    };
  }

  async completeUpload(
    userId: string,
    slug: string,
  ): Promise<{ status: VideoStatus }> {
    const video = await this.findOwnedByUser(userId, slug);
    if (video.status !== VideoStatus.DRAFT) return { status: video.status };
    const head = await this.storage.head(video.source_key).catch(() => {
      throw new VideoUploadNotFoundException();
    });
    if (head.size > this.storageOptions.maxUploadBytes)
      throw new VideoUploadTooLargeException();
    video.status = VideoStatus.PROCESSING;
    video.size_bytes = String(head.size);
    await this.videos.save(video);
    await this.queue.add(
      'process-video',
      { videoId: video.id, sourceKey: video.source_key, slug: video.slug },
      {
        jobId: video.id,
        attempts: this.queueOptions.attempts,
        backoff: {
          type: 'exponential',
          delay: this.queueOptions.backoffDelayMs,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
    return { status: video.status };
  }

  async status(userId: string, slug: string): Promise<Video> {
    return this.findOwnedByUser(userId, slug);
  }

  async stream(
    slug: string,
    range: string | undefined,
    response: Response,
  ): Promise<void> {
    const video = await this.findPublicReady(slug);
    const head = await this.storage.head(video.source_key);
    let start = 0;
    let end = head.size - 1;
    try {
      const parsed = parseByteRange(range, head.size);
      if (parsed) {
        start = parsed.start;
        end = parsed.end;
      }
    } catch {
      throw new InvalidRangeException();
    }
    const object = await this.storage.get(
      video.source_key,
      range ? `bytes=${start}-${end}` : undefined,
    );
    response.status(range ? 206 : 200);
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Type', video.mime_type);
    if (range)
      response.setHeader('Content-Range', `bytes ${start}-${end}/${head.size}`);
    response.setHeader('Content-Length', String(end - start + 1));
    if (
      object.body &&
      typeof (object.body as { pipe?: unknown }).pipe === 'function'
    ) {
      (object.body as NodeJS.ReadableStream).pipe(response);
    } else {
      response.end();
    }
  }

  async download(
    userId: string,
    slug: string,
    response: Response,
  ): Promise<void> {
    const video = await this.findOwnedByUser(userId, slug);
    if (video.status !== VideoStatus.READY) throw new VideoNotReadyException();
    const object = await this.storage.get(video.source_key);
    response.status(200);
    response.setHeader('Content-Type', video.mime_type);
    response.setHeader('Content-Disposition', `attachment; filename="${slug}"`);
    if (
      object.body &&
      typeof (object.body as { pipe?: unknown }).pipe === 'function'
    ) {
      (object.body as NodeJS.ReadableStream).pipe(response);
    } else {
      response.end();
    }
  }

  private async findOwnedByUser(userId: string, slug: string): Promise<Video> {
    const channel = await this.channels.findOne({ where: { user_id: userId } });
    const video = await this.videos.findOne({ where: { slug } });
    if (!video) throw new VideoNotFoundException();
    if (!channel || video.channel_id !== channel.id)
      throw new VideoNotOwnerException();
    return video;
  }

  private async findPublicReady(slug: string): Promise<Video> {
    const video = await this.videos.findOne({ where: { slug } });
    if (!video) throw new VideoNotFoundException();
    if (video.status !== VideoStatus.READY) throw new VideoNotReadyException();
    return video;
  }
}
