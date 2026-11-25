import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUploadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title: string;

  @IsString()
  @IsIn(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'])
  mime_type: string;
}
