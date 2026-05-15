import { PartialType } from '@nestjs/mapped-types';
import { CreateDiscountCodeDto } from './create-discount.dto';

export class UpdateDiscountCodeDto extends PartialType(CreateDiscountCodeDto) {}
