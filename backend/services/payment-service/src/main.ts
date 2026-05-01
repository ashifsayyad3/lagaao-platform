import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true is required so the webhook handler can recompute the HMAC
  // over the exact bytes Razorpay signed — any JSON.parse/re-stringify would
  // mutate whitespace and break the signature check.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  const config = app.get(ConfigService);
  const port = config.get<number>('PAYMENT_SERVICE_PORT', 4005);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: config.get<string>('NEXT_PUBLIC_SITE_URL', 'http://localhost:3000'),
    credentials: true,
  });

  await app.listen(port);
  console.log(`Payment service running on http://localhost:${port}`);
}

void bootstrap();
