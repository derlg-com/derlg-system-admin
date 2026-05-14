import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsInt,
  IsNumber,
  IsArray,
  IsEnum,
  Min,
  Length,
} from 'class-validator';
import { vehicle_type, pricing_model } from '@prisma/client';

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  name: string;

  @IsEnum(vehicle_type)
  vehicle_type: vehicle_type;

  @IsString()
  @IsOptional()
  license_plate?: string;

  @IsInt()
  @Min(1)
  capacity: number;

  @IsEnum(pricing_model)
  pricing_model: pricing_model;

  @IsNumber()
  @Min(0)
  price_usd: number;

  @IsString()
  @IsNotEmpty()
  province: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];
}
