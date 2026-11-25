import { Channel } from '../../channels/entities/channel.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum VideoStatus {
  DRAFT = 'draft',
  PROCESSING = 'processing',
  READY = 'ready',
  ERROR = 'error',
}

@Entity('videos')
export class Video {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'uuid', unique: true })
  @Index()
  slug: string;

  @Column({ type: 'enum', enum: VideoStatus, default: VideoStatus.DRAFT })
  status: VideoStatus;

  @Column({ type: 'uuid' })
  channel_id: string;

  @ManyToOne(() => Channel)
  @JoinColumn({ name: 'channel_id' })
  channel: Channel;

  @Column({ type: 'varchar', length: 512 })
  source_key: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  thumbnail_key: string | null;

  @Column({ type: 'varchar', length: 255 })
  mime_type: string;

  @Column({ type: 'bigint', default: 0 })
  size_bytes: string;

  @Column({ type: 'numeric', precision: 10, scale: 3, nullable: true })
  duration_seconds: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  processing_error: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
