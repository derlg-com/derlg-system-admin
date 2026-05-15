import {
  IsString,
  IsOptional,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { DriverStatus } from '@prisma/client';

export class DriverStatusWebhookDto {
  @IsString()
  @IsNotEmpty()
  telegram_id: string;

  @IsString()
  @IsOptional()
  vehicle_id?: string;

  @IsString()
  @IsNotEmpty()
  driver_name: string;

  @IsEnum(DriverStatus)
  @IsNotEmpty()
  status: DriverStatus;
}
