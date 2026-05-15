import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { verification_status } from '@prisma/client';

export class ReviewStudentVerificationDto {
  @IsEnum(verification_status)
  @IsNotEmpty()
  status: verification_status;

  @IsString()
  @IsOptional()
  review_notes?: string;
}
