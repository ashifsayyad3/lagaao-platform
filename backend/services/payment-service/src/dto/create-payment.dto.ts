import { IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

// Methods that initiate a Razorpay checkout session
const RAZORPAY_METHODS = [
  PaymentMethod.RAZORPAY_UPI,
  PaymentMethod.RAZORPAY_CARD,
  PaymentMethod.RAZORPAY_NETBANKING,
  PaymentMethod.RAZORPAY_WALLET,
  PaymentMethod.COD,
] as const;

export class CreatePaymentDto {
  /** lagaao internal order UUID */
  @IsNotEmpty()
  @IsUUID('4', { message: 'orderId must be a valid UUID' })
  orderId: string;

  @IsOptional()
  @IsEnum(RAZORPAY_METHODS, {
    message: `method must be one of: ${RAZORPAY_METHODS.join(', ')}`,
  })
  method?: PaymentMethod = PaymentMethod.RAZORPAY_UPI;
}
