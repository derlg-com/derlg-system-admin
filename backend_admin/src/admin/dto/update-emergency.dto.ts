import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { emergency_alert_status } from '@prisma/client';

export class UpdateEmergencyDto {
  @IsEnum(emergency_alert_status)
  @IsOptional()
  status?: emergency_alert_status;

  @IsUUID()
  @IsOptional()
  acknowledged_by?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
