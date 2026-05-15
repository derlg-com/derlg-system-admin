import { IsString, IsOptional, IsObject, IsNotEmpty } from 'class-validator';

export class BroadcastMessageDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsOptional()
  image_url?: string;

  @IsObject()
  @IsOptional()
  target_filter?: Record<string, any>;
}
