import { IsString, IsEnum, IsNotEmpty } from 'class-validator';
import { DriverStatus } from '@prisma/client';

export class StatusUpdateDto {
  @IsString()
  @IsNotEmpty()
  telegram_id: string;

  @IsEnum(DriverStatus)
  @IsNotEmpty()
  status: DriverStatus;
}
