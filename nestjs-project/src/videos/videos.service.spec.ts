import { VideoStatus } from './entities/video.entity';

describe('Video status lifecycle', () => {
  it('contains all persisted states', () => {
    expect(VideoStatus.DRAFT).toBe('draft');
    expect(VideoStatus.PROCESSING).toBe('processing');
    expect(VideoStatus.READY).toBe('ready');
    expect(VideoStatus.ERROR).toBe('error');
  });
});
