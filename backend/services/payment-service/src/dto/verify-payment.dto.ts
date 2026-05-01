import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyPaymentDto {
  /** Razorpay order ID — order_xxxxxxxxxx */
  @IsNotEmpty()
  @IsString()
  razorpayOrderId: string;

  /** Razorpay payment ID — pay_xxxxxxxxxx */
  @IsNotEmpty()
  @IsString()
  razorpayPaymentId: string;

  /** HMAC-SHA256 signature from Razorpay checkout */
  @IsNotEmpty()
  @IsString()
  razorpaySignature: string;
}
