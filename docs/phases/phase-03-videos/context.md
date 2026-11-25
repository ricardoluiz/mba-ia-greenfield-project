---
kind: phase
name: phase-03-videos
sources_mtime:
  docs/project-plan.md: "2026-11-24T16:35:00-03:00"
  docs/decisions/technical-decisions-phase-03-videos.md: "2026-11-24T16:45:00-03:00"
  docs/decisions/technical-decisions-phase-02-auth.md: "2026-11-24T16:35:00-03:00"
---

# Phase 03 — Upload e Processamento de Vídeos — Context

## Scope

**Phase name:** Fase 03 — Upload e Processamento de Vídeos

**Affected subprojects:** `nestjs-project/`

**Capabilities:**
- Serviço de armazenamento de arquivos (vídeos e thumbnails)
- Serviço de processamento em segundo plano (filas)
- Upload de até 10GB sem impacto na API
- Pré-cadastro automático como rascunho
- Extração automática de duração e metadados
- Geração automática de thumbnail
- URL única por vídeo
- Streaming com Range
- Download do vídeo

**Out of scope:** interface Next.js, comentário, likes, inscrição, edição/publicação de metadados e listagens públicas.

**Deliverables:** módulo de vídeos com upload presignado, fila BullMQ/Redis, worker FFmpeg, MinIO, streaming/download e migration.

**Sequencing:** depende da Fase 02 para usuários/canais e autenticação JWT.

## Decisions Index

| Ref | Source | Scope | Topic | Status | Decision | Libraries |
|---|---|---|---|---|---|---|
| phase-03-videos/TD-01 | technical-decisions-phase-03-videos.md | Backend | Queue | decided | A — BullMQ with Redis | bullmq, @nestjs/bullmq, ioredis |
| phase-03-videos/TD-02 | technical-decisions-phase-03-videos.md | Backend | Upload | decided | A — S3 presigned PUT | @aws-sdk/client-s3, @aws-sdk/s3-request-presigner |
| phase-03-videos/TD-03 | technical-decisions-phase-03-videos.md | Backend | Worker | decided | A — separate FFmpeg/ffprobe worker | FFmpeg/ffprobe |
| phase-03-videos/TD-04 | technical-decisions-phase-03-videos.md | Backend | Delivery | decided | A — API Range + attachment download | — |
| phase-03-videos/TD-05 | technical-decisions-phase-03-videos.md | Backend | Public URL | decided | A — UUID v4 | — |
| phase-03-videos/TD-06 | technical-decisions-phase-03-videos.md | Backend | Status lifecycle | decided | A — draft/processing/ready/error | — |

## Capability Coverage

| Capability | Covered by |
|---|---|
| Object storage | TD-02 |
| Processing queue | TD-01 |
| Upload 10GB | TD-02 |
| Draft on upload start | TD-02, TD-06 |
| Duration metadata | TD-03 |
| Thumbnail | TD-03 |
| Unique URL | TD-05 |
| Streaming | TD-04 |
| Download | TD-04 |

## Decisions Detail

### phase-03-videos/TD-01
**Recommendation:** Option A — BullMQ with Redis is the best balance for NestJS integration, retries and Docker operation.
**Libraries:** `bullmq@^5.x`, `@nestjs/bullmq@^11.x`, `ioredis@^5.x`

### phase-03-videos/TD-02
**Recommendation:** Option A — S3 presigned PUT keeps 10GB uploads outside the API process.
**Libraries:** `@aws-sdk/client-s3@^3.x`, `@aws-sdk/s3-request-presigner@^3.x`

### phase-03-videos/TD-03
**Recommendation:** Option A — dedicated worker container runs ffprobe and FFmpeg outside the API.
**Libraries:** FFmpeg/ffprobe via container image

### phase-03-videos/TD-04
**Recommendation:** Option A — API streams Range 206 in MVP and downloads with attachment disposition.
**Libraries:** —

### phase-03-videos/TD-05
**Recommendation:** Option A — persisted UUID v4 public slug avoids collisions.
**Libraries:** —

### phase-03-videos/TD-06
**Recommendation:** Option A — explicit draft → processing → ready/error lifecycle.
**Libraries:** —

## Inherited Decisions Detail

### phase-02-auth/TD-02
**Recommendation:** Custom JWT guard with `@nestjs/jwt` is the inherited authentication mechanism.
**Libraries:** `@nestjs/jwt@^11.0.0`

### phase-02-auth/TD-06
**Recommendation:** class-validator and class-transformer are the inherited request validation libraries.
**Libraries:** `class-validator@^0.14.x`, `class-transformer@^0.5.x`

## Inherited Conventions

- JWT guard is global; protected video routes require no extra local guard.
- Domain exceptions are transported by the global domain exception filter.
- TypeORM entities use UUID primary keys, explicit table names and migrations.
- Docker communication uses Compose service names, never localhost.

## Testing Requirements

Unit tests cover state transitions and utility logic. Integration tests use PostgreSQL, Redis and MinIO from Compose. E2E tests use Supertest and real HTTP contracts. FFprobe/thumbnail output is exercised by a real fixture and worker container.
