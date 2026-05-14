import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsBoolean,
  IsUUID,
  Min,
  Length,
} from 'class-validator';

export class CreateGuideDto {
  @IsUUID()
  @IsNotEmpty()
  user_id: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  languages?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  specialties?: string[];

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  province: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  provinces?: string[];

  @IsNumber()
  @Min(0)
  price_per_day_usd: number;

  @IsString()
  @IsOptional()
  avatar_url?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];

  @IsBoolean()
  @IsOptional()
  is_verified?: boolean;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
