import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateDriverDto } from './create-driver.dto';
import { DriverStatus } from '@prisma/client';

export class UpdateDriverDto extends PartialType(CreateDriverDto) {
  @IsEnum(DriverStatus)
  @IsOptional()
  status?: DriverStatus;
}
