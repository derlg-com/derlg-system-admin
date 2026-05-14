import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class AssignmentActionDto {
  @IsString()
  @IsNotEmpty()
  telegram_id: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
