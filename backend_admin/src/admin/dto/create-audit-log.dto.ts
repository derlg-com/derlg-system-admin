import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsUUID,
  IsObject,
} from 'class-validator';
import { audit_event_type } from '@prisma/client';

export class CreateAuditLogDto {
  @IsEnum(audit_event_type)
  @IsNotEmpty()
  event_type: audit_event_type;

  @IsString()
  @IsNotEmpty()
  entity_type: string;

  @IsUUID()
  @IsOptional()
  entity_id?: string;

  @IsString()
  @IsOptional()
  ip_address?: string;

  @IsString()
  @IsOptional()
  user_agent?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
