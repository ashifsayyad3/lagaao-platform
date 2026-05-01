import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // rawBody needed for Razorpay webhook proxying (preserves exact bytes)
    rawBody: true,
    logger: ['log', 'warn', 'error', 'debug'],
  });

  const config = app.get(ConfigService);
  const port        = config.get<number>('API_GATEWAY_PORT', 4000);
  const frontendUrl = config.get<string>('FRONTEND_URL', 'http://localhost:3000');
  const nodeEnv     = config.get<string>('NODE_ENV', 'development');

  // ── Security headers ───────────────────────────────────────────────────────
  app.use(
    helmet({
      // Allow Swagger UI inline scripts in development
      contentSecurityPolicy: nodeEnv === 'production' ? undefined : false,
    }),
  );

  // ── Compression ────────────────────────────────────────────────────────────
  app.use(compression());

  // ── CORS ───────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: [
      frontendUrl,
      // Allow additional origins from env (comma-separated)
      ...config.get<string>('CORS_ORIGINS', '').split(',').filter(Boolean),
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'x-razorpay-signature',
    ],
    exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
    credentials: true,
    maxAge: 86400,   // pre-flight cache: 24 h
  });

  // ── Global validation pipe ─────────────────────────────────────────────────
  // The gateway itself only validates /health query params.
  // Downstream DTO validation happens in each microservice.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,   // pass unknown fields through to services
      transform: true,
    }),
  );

  // ── Swagger API docs ───────────────────────────────────────────────────────
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('lagaao.com API')
      .setDescription(
        'Unified API gateway for the lagaao.com e-commerce platform.\n\n' +
        'All routes are prefixed with `/api`. Authenticate with a JWT Bearer token ' +
        'obtained from `POST /api/auth/login`.',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'JWT',
      )
      .addTag('Auth',     'Registration, login, profile')
      .addTag('Products', 'Product catalogue and categories')
      .addTag('Cart',     'Shopping cart management')
      .addTag('Orders',   'Order placement and tracking')
      .addTag('Payment',  'Razorpay payment flow')
      .addTag('Admin',    'Admin-only management endpoints')
      .addTag('Health',   'Gateway and service liveness probes')
      .addServer(`http://localhost:${port}`, 'Local development')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
      },
      customSiteTitle: 'lagaao.com API Docs',
    });

    console.log(`Swagger docs → http://localhost:${port}/api/docs`);
  }

  await app.listen(port);
  console.log(`\nAPI Gateway running on http://localhost:${port}`);
  console.log(`Environment : ${nodeEnv}`);
  console.log(`Frontend    : ${frontendUrl}`);
  console.log('\nRoutes proxied:');
  console.log(`  /api/auth/*            → http://localhost:4001`);
  console.log(`  /api/products/*        → http://localhost:4002`);
  console.log(`  /api/categories/*      → http://localhost:4002`);
  console.log(`  /api/cart/*            → http://localhost:4003`);
  console.log(`  /api/orders/*          → http://localhost:4004`);
  console.log(`  /api/admin/orders/*    → http://localhost:4004`);
  console.log(`  /api/payment/*         → http://localhost:4005`);
  console.log(`  /api/admin/payments/*  → http://localhost:4005`);
}

void bootstrap();
