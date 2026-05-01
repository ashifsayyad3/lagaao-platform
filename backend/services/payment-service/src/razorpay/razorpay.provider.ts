import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';

export const RAZORPAY_CLIENT = 'RAZORPAY_CLIENT';

export const RazorpayProvider: Provider = {
  provide: RAZORPAY_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Razorpay => {
    return new Razorpay({
      key_id:     config.getOrThrow<string>('RAZORPAY_KEY_ID'),
      key_secret: config.getOrThrow<string>('RAZORPAY_KEY_SECRET'),
    });
  },
};
