import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
} from 'class-validator';

export class ExportRequestDto {
  @IsEnum(['csv', 'json'])
  @IsOptional()
  format?: 'csv' | 'json';

  @IsString()
  @IsOptional()
  metric?: string;

  @IsDateString()
  @IsOptional()
  start_date?: string;

  @IsDateString()
  @IsOptional()
  end_date?: string;
}
