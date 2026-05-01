import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';
import { JwtStrategy } from './common/jwt.strategy';
import { PrismaModule } from './prisma/prisma.module';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
  ],
  controllers: [ProductController, CategoryController],
  providers: [ProductService, CategoryService, JwtStrategy],
})
export class ProductModule {}
