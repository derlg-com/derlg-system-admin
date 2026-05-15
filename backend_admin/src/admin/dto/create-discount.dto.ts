import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsInt,
  IsOptional,
  IsEnum,
  IsBoolean,
  Min,
  Length,
  IsDateString,
} from 'class-validator';
import { discount_type, booking_type } from '@prisma/client';

export class CreateDiscountCodeDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  code: string;

  @IsEnum(discount_type)
  discount_type: discount_type;

  @IsNumber()
  @Min(0)
  value: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  max_uses?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  min_booking_usd?: number;

  @IsDateString()
  valid_from: string;

  @IsDateString()
  valid_until: string;

  @IsEnum(booking_type)
  @IsOptional()
  booking_type?: booking_type;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
