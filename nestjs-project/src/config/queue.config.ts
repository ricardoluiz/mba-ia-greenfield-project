import { registerAs } from '@nestjs/config';

export default registerAs('queue', () => ({
  redisHost: process.env.REDIS_HOST || 'redis',
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),
  redisPassword: process.env.REDIS_PASSWORD || undefined,
  videoQueueName: process.env.VIDEO_QUEUE_NAME || 'video-processing',
  attempts: parseInt(process.env.VIDEO_QUEUE_ATTEMPTS || '3', 10),
  backoffDelayMs: parseInt(process.env.VIDEO_QUEUE_BACKOFF_MS || '10000', 10),
}));
