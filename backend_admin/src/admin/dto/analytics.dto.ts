import { IsOptional, IsString, IsEnum } from 'class-validator';

export class RevenueAnalyticsDto {
  @IsString()
  @IsOptional()
  start_date?: string;

  @IsString()
  @IsOptional()
  end_date?: string;
}

export class BookingStatisticsDto {
  @IsString()
  @IsOptional()
  status?: string;
}

export class DriverPerformanceDto {
  @IsString()
  @IsOptional()
  driver_id?: string;
}

export class ExportDataDto {
  @IsString()
  format: string;

  @IsString()
  @IsOptional()
  metric?: string;

  @IsString()
  @IsOptional()
  start_date?: string;

  @IsString()
  @IsOptional()
  end_date?: string;
}
