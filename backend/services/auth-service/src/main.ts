import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);
  const port = config.get<number>('AUTH_SERVICE_PORT', 4001);

  // Global validation pipe — strips unknown fields, enables class-transformer
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
  console.log(`Auth service running on http://localhost:${port}`);
}

void bootstrap();
