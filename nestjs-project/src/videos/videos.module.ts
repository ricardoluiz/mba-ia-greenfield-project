import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { ConfigType } from '@nestjs/config';
import queueConfig from '../config/queue.config';
import { ChannelsModule } from '../channels/channels.module';
import { Video } from './entities/video.entity';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { StorageService } from './services/storage.service';

@Module({
  imports: [
    ChannelsModule,
    TypeOrmModule.forFeature([Video]),
    BullModule.forRootAsync({
      inject: [queueConfig.KEY],
      useFactory: (config: ConfigType<typeof queueConfig>) => ({
        connection: {
          host: config.redisHost,
          port: config.redisPort,
          password: config.redisPassword,
        },
      }),
    }),
    BullModule.registerQueueAsync({
      name: 'video-processing',
      inject: [queueConfig.KEY],
      useFactory: (config: ConfigType<typeof queueConfig>) => ({
        name: config.videoQueueName,
      }),
    }),
  ],
  controllers: [VideosController],
  providers: [VideosService, StorageService],
  exports: [VideosService, StorageService],
})
export class VideosModule implements OnModuleInit {
  constructor(private readonly storage: StorageService) {}
  async onModuleInit(): Promise<void> {
    await this.storage.ensureBucket();
  }
}
