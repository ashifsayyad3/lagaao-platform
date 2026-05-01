import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateOrderDto {
  @IsUUID('4', { message: 'addressId must be a valid UUID' })
  addressId: string;

  @IsOptional()
  @IsUUID('4', { message: 'couponId must be a valid UUID' })
  couponId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
