import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AdminOrderController, OrderController } from './order.controller';
import { OrderService } from './order.service';
import { JwtStrategy } from './common/jwt.strategy';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [OrderController, AdminOrderController],
  providers: [OrderService, JwtStrategy],
})
export class OrderModule {}
