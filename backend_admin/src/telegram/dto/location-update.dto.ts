import { IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class LocationUpdateDto {
  @IsString()
  @IsNotEmpty()
  telegram_id: string;

  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @IsNumber()
  @IsNotEmpty()
  longitude: number;
}
