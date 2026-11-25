---
kind: phase
name: phase-03-videos
sources_mtime:
  docs/decisions/technical-decisions-phase-03-videos.md: "2026-11-24T16:45:00-03:00"
---

# Library References — Phase 03

- BullMQ 5.x / NestJS BullMQ 11.x: https://docs.bullmq.io/guide/nestjs
- AWS SDK for JavaScript v3 S3: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/
- AWS SDK presigned requests: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/modules/_aws_sdk_s3_request_presigner.html
- MinIO S3 compatibility: https://min.io/docs/minio/linux/reference/minio-mc.html
- FFmpeg: https://ffmpeg.org/documentation.html
- ffprobe JSON output: https://ffmpeg.org/ffprobe.html
- Redis: https://redis.io/docs/latest/
- Docker Compose healthchecks: https://docs.docker.com/reference/compose-file/services/

Pinned versions observed in `nestjs-project/package.json`/lockfile: AWS SDK 3.1176.0, BullMQ 5.81.6, NestJS BullMQ 11.0.5 and ioredis 5.11.1. FFmpeg/ffprobe are provided in the worker container, to be pinned by the final base/image build.

Versions are pinned by phase decision and must be verified against package manifests before installation.
