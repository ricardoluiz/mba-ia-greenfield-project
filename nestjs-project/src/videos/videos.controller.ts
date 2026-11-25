import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Headers,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { CreateUploadDto } from './dto/create-upload.dto';
import { VideosService } from './videos.service';
import { ApiErrorEnvelope } from '../common/openapi/api-error-envelope.dto';

@ApiTags('videos')
@Controller('videos')
export class VideosController {
  constructor(private readonly videos: VideosService) {}

  @ApiBearerAuth('access-token')
  @Post('uploads')
  @ApiOperation({
    summary: 'Initiate video upload',
    description: 'Creates a draft video and returns a presigned S3 PUT URL.',
  })
  @ApiResponse({
    status: 201,
    description: 'Draft and presigned upload URL created',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication required',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden',
    type: ApiErrorEnvelope,
  })
  createUpload(@CurrentUser() user: JwtPayload, @Body() dto: CreateUploadDto) {
    return this.videos.createUpload(user.sub, dto);
  }

  @ApiBearerAuth('access-token')
  @Post(':slug/complete')
  @ApiOperation({
    summary: 'Complete video upload',
    description:
      'Verifies the uploaded object and enqueues asynchronous processing.',
  })
  @ApiResponse({
    status: 201,
    description: 'Upload completed and processing queued',
  })
  @ApiResponse({
    status: 404,
    description: 'Video or uploaded object not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 413,
    description: 'Video exceeds 10GB',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: ApiErrorEnvelope,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden',
    type: ApiErrorEnvelope,
  })
  complete(@CurrentUser() user: JwtPayload, @Param('slug') slug: string) {
    return this.videos.completeUpload(user.sub, slug);
  }

  @ApiBearerAuth('access-token')
  @Get(':slug/status')
  @ApiOperation({
    summary: 'Get video status',
    description:
      'Returns processing status and metadata for a channel-owned video.',
  })
  @ApiResponse({ status: 200, description: 'Video status returned' })
  @ApiResponse({
    status: 403,
    description: 'Video belongs to another channel',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  status(@CurrentUser() user: JwtPayload, @Param('slug') slug: string) {
    return this.videos.status(user.sub, slug);
  }

  @Public()
  @Get(':slug/stream')
  @ApiOperation({
    summary: 'Stream ready video',
    description: 'Streams a ready video and supports HTTP Range requests.',
  })
  @ApiResponse({ status: 206, description: 'Partial video content returned' })
  @ApiResponse({
    status: 416,
    description: 'Requested byte range is not satisfiable',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 409,
    description: 'Video is not ready',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  stream(
    @Param('slug') slug: string,
    @Headers('range') range: string | undefined,
    @Res() response: Response,
  ) {
    return this.videos.stream(slug, range, response);
  }

  @ApiBearerAuth('access-token')
  @Get(':slug/download')
  @ApiOperation({
    summary: 'Download ready video',
    description:
      'Streams a channel-owned ready video with attachment disposition.',
  })
  @ApiResponse({ status: 200, description: 'Video attachment returned' })
  @ApiResponse({
    status: 403,
    description: 'Video belongs to another channel',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  @ApiResponse({
    status: 409,
    description: 'Video is not ready',
    schema: { $ref: getSchemaPath(ApiErrorEnvelope) },
  })
  download(
    @CurrentUser() user: JwtPayload,
    @Param('slug') slug: string,
    @Res() response: Response,
  ) {
    return this.videos.download(user.sub, slug, response);
  }
}
