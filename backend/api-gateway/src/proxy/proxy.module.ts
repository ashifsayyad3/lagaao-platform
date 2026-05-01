import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';
import { SERVICE_ROUTES } from './proxy.config';

/**
 * ProxyModule wires http-proxy-middleware routes for every downstream service.
 *
 * Each upstream receives three enrichment headers:
 *   X-User-Id    — JWT sub claim (present on authenticated requests)
 *   X-User-Email — JWT email claim
 *   X-User-Role  — JWT role claim
 *
 * Downstream services can trust these headers because the gateway has already
 * validated the JWT before proxying. They MUST NOT be accepted from the
 * public internet directly.
 */
@Module({})
export class ProxyModule implements NestModule {
  constructor(private readonly config: ConfigService) {}

  configure(consumer: MiddlewareConsumer): void {
    for (const route of SERVICE_ROUTES) {
      const proxyMiddleware = createProxyMiddleware({
        target: this.resolveTarget(route.prefix),
        changeOrigin: true,
        // Strip /api prefix so downstream services receive the path they expect.
        // e.g. /api/auth/login → /auth/login
        pathRewrite: { [`^/api`]: '' },
        // Re-serialise the body that NestJS already parsed (body-parser).
        on: {
          proxyReq: (proxyReq, req: Request) => {
            fixRequestBody(proxyReq, req);

            // Forward decoded JWT claims as trusted headers
            const user = (req as Request & { user?: { sub: string; email: string; role: string } }).user;
            if (user) {
              proxyReq.setHeader('X-User-Id',    user.sub);
              proxyReq.setHeader('X-User-Email', user.email);
              proxyReq.setHeader('X-User-Role',  user.role);
            }

            // Propagate real client IP
            const clientIp = req.ip ?? req.socket.remoteAddress ?? '';
            proxyReq.setHeader('X-Forwarded-For', clientIp);
            proxyReq.setHeader('X-Gateway', 'lagaao-api-gateway');
          },
          error: (err: Error, _req: Request, res: Response) => {
            const status = 502;
            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(
              JSON.stringify({
                statusCode: status,
                error: 'Bad Gateway',
                message: `Upstream service unavailable: ${err.message}`,
                timestamp: new Date().toISOString(),
              }),
            );
          },
        },
      });

      consumer
        .apply(proxyMiddleware)
        .forRoutes({ path: `${route.prefix}*`, method: RequestMethod.ALL });
    }
  }

  /**
   * Resolves the target URL from environment variables at runtime so that
   * individual service URLs can be overridden in production (e.g. Docker).
   */
  private resolveTarget(prefix: string): string {
    const envMap: Record<string, string> = {
      '/api/auth':           this.config.get('AUTH_SERVICE_URL',    'http://localhost:4001'),
      '/api/products':       this.config.get('PRODUCT_SERVICE_URL', 'http://localhost:4002'),
      '/api/categories':     this.config.get('PRODUCT_SERVICE_URL', 'http://localhost:4002'),
      '/api/cart':           this.config.get('CART_SERVICE_URL',    'http://localhost:4003'),
      '/api/orders':         this.config.get('ORDER_SERVICE_URL',   'http://localhost:4004'),
      '/api/admin/orders':   this.config.get('ORDER_SERVICE_URL',   'http://localhost:4004'),
      '/api/payment':        this.config.get('PAYMENT_SERVICE_URL', 'http://localhost:4005'),
      '/api/admin/payments': this.config.get('PAYMENT_SERVICE_URL', 'http://localhost:4005'),
    };
    return envMap[prefix] ?? 'http://localhost:4000';
  }
}
