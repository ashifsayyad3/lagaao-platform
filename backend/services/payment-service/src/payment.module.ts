import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AdminPaymentController, PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { JwtStrategy } from './common/jwt.strategy';
import { PrismaModule } from './prisma/prisma.module';
import { RazorpayProvider } from './razorpay/razorpay.provider';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [PaymentController, AdminPaymentController],
  providers: [PaymentService, JwtStrategy, RazorpayProvider],
})
export class PaymentModule {}
