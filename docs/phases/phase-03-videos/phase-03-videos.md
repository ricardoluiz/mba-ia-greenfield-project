---
kind: phase
name: phase-03-videos
status: completed
sources_mtime:
  docs/phases/phase-03-videos/context.md: "2026-11-24T16:45:00-03:00"
  docs/phases/phase-03-videos/validation.md: "2026-11-24T16:45:00-03:00"
  docs/phases/phase-03-videos/library-refs.md: "2026-11-24T16:45:00-03:00"
---

# Phase 03 — Upload e Processamento de Vídeos

## Objective
Deliver video upload to 10GB without passing bytes through the API, automatic background processing, unique URLs, Range streaming and download.

## Step Implementations

### SI-03.1 — Video Data Model and Migration
**Description:** Create the Video entity and migration linked to Channel.
**Technical actions:**
- Create `src/videos/entities/video.entity.ts` with UUID, channel relation, title, unique slug, status enum, storage keys, mime type, size, duration, metadata JSON, thumbnail key, processing error and timestamps.
- Create migration `src/database/migrations/*-CreateVideos.ts`.
- Export the entity through `VideosModule`.
**Tests:** entity integration tests and migration test.
**Dependencies:** none
**Acceptance criteria:** channel relationship, unique slug/key constraints and migration up/down pass.

### SI-03.2 — Storage, Queue and Configuration
**Description:** Configure MinIO, Redis and BullMQ plus typed environment variables.
**Technical actions:**
- Add MinIO, Redis and worker services to Compose.
- Create storage and queue config namespaces.
- Install AWS SDK v3 and BullMQ packages.
- Add a storage bucket bootstrap for `streamtube-videos`.
**Tests:** module compilation and storage integration tests.
**Dependencies:** SI-03.1
**Acceptance criteria:** Compose services are healthy and storage/queue clients connect using service names.

### SI-03.3 — Presigned Upload API
**Description:** Pre-register drafts and issue short-lived PUT URLs.
**Technical actions:**
- Add create-upload DTO/controller/service.
- Resolve the authenticated user's Channel and create a draft Video.
- Generate UUID keys and PUT presigned URLs capped at 10GB and restricted MIME.
- Add upload completion endpoint that verifies object existence and queues processing.
**Tests:** unit, integration and E2E tests.
**Dependencies:** SI-03.1, SI-03.2
**Acceptance criteria:** API never streams the file, draft exists first, completion changes status and publishes one job.

### SI-03.4 — Worker and Processing
**Description:** Implement a separate FFprobe/FFmpeg worker container.
**Technical actions:**
- Add BullMQ worker entrypoint and image/Dockerfile.
- Download source into ephemeral temp storage.
- Extract duration and metadata with ffprobe JSON.
- Generate thumbnail at 1 second or 10% and upload it to storage.
- Set ready or error status, persisting processing_error only on failure.
- Retry with backoff and idempotency by video UUID/job ID.
**Tests:** worker unit/integration tests with real FFmpeg fixture.
**Dependencies:** SI-03.2, SI-03.3
**Acceptance criteria:** status transitions work, metadata/thumbnail persist and failure is terminal.

### SI-03.5 — Streaming, Download and Status API
**Description:** Expose Range streaming and a download route.
**Technical actions:**
- Implement range parsing and 206/416 responses.
- Stream ready video objects from MinIO/S3.
- Implement attachment download by slug.
- Add status/find/list owner endpoints as defined by the plan.
**Tests:** E2E/HTTP range tests and integration storage tests.
**Dependencies:** SI-03.3, SI-03.4
**Acceptance criteria:** 206 includes Range/Content-Range, 416 for invalid range, anonymous/public ready stream works and download is attachment.

## Technical Specifications

### Data Model

**Video**: `id uuid`, `channel_id uuid`, `title varchar(120)`, `slug uuid unique`, `status enum(draft,processing,ready,error)`, `source_key varchar`, `thumbnail_key varchar nullable`, `mime_type varchar`, `size_bytes bigint`, `duration_seconds numeric nullable`, `metadata jsonb`, `processing_error text nullable`, `created_at`, `updated_at`.

### API Contracts

- `POST /videos/uploads` protected: creates draft and presigned PUT URL. Response includes `video_id`, `slug`, `upload_url`, `source_key`, `expires_in`.
- `POST /videos/:slug/complete` protected/owner: verifies upload and enqueues processing.
- `GET /videos/:slug/status` owner: returns status and processing fields.
- `GET /videos/:slug/stream` public only for ready: supports HTTP Range.
- `GET /videos/:slug/download` owner or public according to visibility (MVP owner-protected): attachment download.

### Authorization Matrix

| Operation | Anonymous | Authenticated owner | Other authenticated |
|---|---|---|---|
| Create/upload/complete/status | denied | allowed | denied |
| Stream ready video | allowed | allowed | allowed |
| Download | denied | allowed | denied |

### Error Catalog

- `VIDEO_NOT_FOUND` 404
- `VIDEO_NOT_OWNER` 403
- `VIDEO_NOT_READY` 409
- `VIDEO_UPLOAD_NOT_FOUND` 404
- `VIDEO_UPLOAD_TOO_LARGE` 413
- `INVALID_RANGE` 416
- `VIDEO_PROCESSING_FAILED` 422

### Events/Messages

Queue: `video-processing`.
Payload: `{ videoId, sourceKey, slug, attempt }`.
Retry: 3 attempts, exponential backoff from 10 seconds.
States: `draft -> processing -> ready | error`; job completion is idempotent.

## Dependency Map

SI-03.1 → SI-03.2 → SI-03.3 → SI-03.4 → SI-03.5

## Deliverables

- Docker Compose services for MinIO, Redis and worker
- Migration and entity
- Presigned 10GB upload flow
- Real BullMQ job and FFmpeg worker
- Range streaming and download
- Unit, integration and E2E tests
- Full test/tsc/lint pass
