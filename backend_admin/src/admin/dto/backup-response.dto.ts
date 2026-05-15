import { IsString, IsOptional, IsUUID } from 'class-validator';

export class BackupResponseDto {
  @IsUUID()
  id: string;

  @IsString()
  backup_file_url: string;

  @IsUUID()
  created_by_admin_id: string;

  @IsString()
  @IsOptional()
  backup_size_bytes?: string;

  @IsString()
  created_at: Date;
}
