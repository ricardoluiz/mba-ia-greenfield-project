import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVideos1780000000000 implements MigrationInterface {
  name = 'CreateVideos1780000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "video_status_enum" AS ENUM('draft', 'processing', 'ready', 'error')`,
    );
    await queryRunner.query(
      `CREATE TABLE "videos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(120) NOT NULL, "slug" uuid NOT NULL, "status" "video_status_enum" NOT NULL DEFAULT 'draft', "channel_id" uuid NOT NULL, "source_key" character varying(512) NOT NULL, "thumbnail_key" character varying(512), "mime_type" character varying(255) NOT NULL, "size_bytes" bigint NOT NULL DEFAULT '0', "duration_seconds" numeric(10,3), "metadata" jsonb NOT NULL DEFAULT '{}', "processing_error" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_videos_id" PRIMARY KEY ("id"), CONSTRAINT "UQ_videos_slug" UNIQUE ("slug"), CONSTRAINT "FK_videos_channel" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_videos_slug" ON "videos" ("slug")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_videos_channel_status" ON "videos" ("channel_id", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "videos"`);
    await queryRunner.query(`DROP TYPE "video_status_enum"`);
  }
}
