import { DomainException } from '../../common/exceptions/domain.exception';

export class VideoNotFoundException extends DomainException {
  constructor() {
    super('VIDEO_NOT_FOUND', 404, 'Video not found');
  }
}
export class VideoNotOwnerException extends DomainException {
  constructor() {
    super('VIDEO_NOT_OWNER', 403, 'Video belongs to another channel');
  }
}
export class VideoNotReadyException extends DomainException {
  constructor() {
    super('VIDEO_NOT_READY', 409, 'Video is not ready');
  }
}
export class VideoUploadNotFoundException extends DomainException {
  constructor() {
    super('VIDEO_UPLOAD_NOT_FOUND', 404, 'Uploaded object not found');
  }
}
export class VideoUploadTooLargeException extends DomainException {
  constructor() {
    super('VIDEO_UPLOAD_TOO_LARGE', 413, 'Video exceeds 10GB');
  }
}
export class InvalidRangeException extends DomainException {
  constructor() {
    super('INVALID_RANGE', 416, 'Requested byte range is not satisfiable');
  }
}
