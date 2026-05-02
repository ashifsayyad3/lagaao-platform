import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,   // preserves exact bytes for Razorpay webhook HMAC
    logger: ['log', 'warn', 'error'],
  });

  const config      = app.get(ConfigService);
  const port        = config.get<number>('API_GATEWAY_PORT', 4000);
  const frontendUrl = config.get<string>('FRONTEND_URL', 'http://localhost:3000');
  const nodeEnv     = config.get<string>('NODE_ENV', 'development');

  // Read actual service URLs from env (set in .env)
  const authUrl    = config.get<string>('AUTH_SERVICE_URL',    'http://localhost:3001');
  const productUrl = config.get<string>('PRODUCT_SERVICE_URL', 'http://localhost:3002');
  const cartUrl    = config.get<string>('CART_SERVICE_URL',    'http://localhost:3003');
  const orderUrl   = config.get<string>('ORDER_SERVICE_URL',   'http://localhost:3004');
  const paymentUrl = config.get<string>('PAYMENT_SERVICE_URL', 'http://localhost:3005');

  // ── Security headers ───────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: nodeEnv === 'production' ? undefined : false,
    }),
  );

  // ── Compression ────────────────────────────────────────────────────────────
  app.use(compression());

  // ── CORS ───────────────────────────────────────────────────────────────────
  const extraOrigins = config.get<string>('CORS_ORIGINS', '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: [frontendUrl, ...extraOrigins],
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
    maxAge: 86400,
  });

  // ── Global validation pipe ─────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // ── Swagger docs (dev only) ────────────────────────────────────────────────
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('lagaao.com API Gateway')
      .setDescription(
        'All routes are prefixed with `/api`.\n\n' +
        'Authenticate: `POST /api/auth/login` → copy the `accessToken` → ' +
        'click **Authorize** above and paste it.',
      )
      .setVersion('1.0.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
        'JWT',
      )
      .addTag('Auth',     'POST /api/auth/register · POST /api/auth/login · GET /api/auth/profile')
      .addTag('Products', 'GET /api/products · GET /api/products/:slug · GET /api/categories')
      .addTag('Cart',     'GET /api/cart · POST /api/cart/items · PUT /api/cart/items/:id')
      .addTag('Orders',   'POST /api/orders · GET /api/orders · GET /api/orders/:id')
      .addTag('Payment',  'POST /api/payment/create-order · POST /api/payment/verify')
      .addTag('Health',   'GET /health · GET /health/services')
      .addServer(`http://localhost:${port}`, 'Local development')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
      },
      customSiteTitle: 'lagaao API Docs',
    });
  }

  await app.listen(port);

  // ── Startup banner ─────────────────────────────────────────────────────────
  const line  = '─'.repeat(54);
  const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
  const cyan  = (s: string) => `\x1b[36m${s}\x1b[0m`;
  const bold  = (s: string) => `\x1b[1m${s}\x1b[0m`;
  const dim   = (s: string) => `\x1b[2m${s}\x1b[0m`;

  console.log('');
  console.log(bold(`  ┌${line}┐`));
  console.log(bold(`  │`) + `  🌿  ${bold('lagaao.com')} API Gateway                        ` + bold(`│`));
  console.log(bold(`  ├${line}┤`));
  console.log(bold(`  │`) + `  ${green('●')} Gateway   ${bold(`http://localhost:${port}`)}                ` + bold(`│`));
  console.log(bold(`  │`) + `  ${green('●')} Swagger   ${cyan(`http://localhost:${port}/api/docs`)}       ` + bold(`│`));
  console.log(bold(`  │`) + `  ${green('●')} Health    ${cyan(`http://localhost:${port}/health`)}         ` + bold(`│`));
  console.log(bold(`  ├${line}┤`));
  console.log(bold(`  │`) + `  ${bold('Proxied routes:')}                                   ` + bold(`│`));
  console.log(bold(`  │`) + `  ${dim('/api/auth/*')}       →  ${authUrl}          ` + bold(`│`));
  console.log(bold(`  │`) + `  ${dim('/api/products/*')}   →  ${productUrl}       ` + bold(`│`));
  console.log(bold(`  │`) + `  ${dim('/api/categories/*')} →  ${productUrl}       ` + bold(`│`));
  console.log(bold(`  │`) + `  ${dim('/api/cart/*')}       →  ${cartUrl}          ` + bold(`│`));
  console.log(bold(`  │`) + `  ${dim('/api/orders/*')}     →  ${orderUrl}         ` + bold(`│`));
  console.log(bold(`  │`) + `  ${dim('/api/payment/*')}    →  ${paymentUrl}       ` + bold(`│`));
  console.log(bold(`  ├${line}┤`));
  console.log(bold(`  │`) + `  Environment : ${nodeEnv.padEnd(37)}` + bold(`│`));
  console.log(bold(`  │`) + `  Frontend    : ${frontendUrl.padEnd(37)}` + bold(`│`));
  console.log(bold(`  └${line}┘`));
  console.log('');
}

void bootstrap();
