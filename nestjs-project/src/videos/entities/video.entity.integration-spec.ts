import { randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { Channel } from '../../channels/entities/channel.entity';
import { User } from '../../users/entities/user.entity';
import { Video, VideoStatus } from './video.entity';

describe('Video entity (integration)', () => {
  let dataSource: DataSource;
  let channelRepository: Repository<Channel>;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST || 'db',
      port: Number(process.env.DB_PORT || 5432),
      username: process.env.DB_USERNAME || 'streamtube',
      password: process.env.DB_PASSWORD || 'streamtube',
      database: process.env.DB_NAME || 'streamtube',
      entities: [User, Channel, Video],
      synchronize: false,
    });
    await dataSource.initialize();
    channelRepository = dataSource.getRepository(Channel);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM "videos"');
    await dataSource.query('DELETE FROM "channels"');
    await dataSource.query('DELETE FROM "users"');
  });

  it('persists a draft linked to a channel and enforces unique slug', async () => {
    const user = await dataSource.getRepository(User).save(
      dataSource.getRepository(User).create({
        email: 'video@example.com',
        password: 'hash',
        is_confirmed: true,
      }),
    );
    const channel = await channelRepository.save(
      channelRepository.create({
        name: 'Video Channel',
        nickname: 'video_channel',
        user_id: user.id,
      }),
    );
    const slug = randomUUID();
    const videos = dataSource.getRepository(Video);

    await videos.save(
      videos.create({
        title: 'Test video',
        slug,
        channel_id: channel.id,
        source_key: `channels/${channel.id}/${slug}/source`,
        mime_type: 'video/mp4',
        status: VideoStatus.DRAFT,
        size_bytes: '0',
        metadata: {},
      }),
    );

    const found = await videos.findOneBy({ slug });
    expect(found?.status).toBe(VideoStatus.DRAFT);

    await expect(
      videos.save(
        videos.create({
          title: 'Duplicate',
          slug,
          channel_id: channel.id,
          source_key: 'duplicate',
          mime_type: 'video/mp4',
          status: VideoStatus.DRAFT,
          size_bytes: '0',
          metadata: {},
        }),
      ),
    ).rejects.toBeDefined();
  });
});
