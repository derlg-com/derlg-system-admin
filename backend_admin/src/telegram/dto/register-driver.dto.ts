import { IsString, IsNotEmpty } from 'class-validator';

export class RegisterDriverDto {
  @IsString()
  @IsNotEmpty()
  telegram_id: string;

  @IsString()
  @IsNotEmpty()
  driver_id: string;

  @IsString()
  @IsNotEmpty()
  pin: string;
}
