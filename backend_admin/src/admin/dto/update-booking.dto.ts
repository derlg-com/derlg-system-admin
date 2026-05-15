import {
  IsDateString,
  IsOptional,
  IsInt,
  Min,
  IsString,
  IsEnum,
} from 'class-validator';
import { booking_status } from '@prisma/client';

export class UpdateBookingDto {
  @IsDateString()
  @IsOptional()
  start_date?: string;

  @IsDateString()
  @IsOptional()
  end_date?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  passenger_count?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  room_count?: number;

  @IsEnum(booking_status)
  @IsOptional()
  status?: booking_status;

  @IsString()
  @IsOptional()
  cancel_reason?: string;
}
