import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/jwt-auth.guard';

interface ServiceStatus {
  name: string;
  url: string;
  status: 'up' | 'down' | 'unknown';
  latencyMs?: number;
}

@Controller('health')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  /** GET /health — liveness probe for load balancers / Docker healthcheck */
  @Public()
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'api-gateway',
      version: process.env.npm_package_version ?? '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };
  }

  /** GET /health/services — reachability check for all upstream services */
  @Public()
  @Get('services')
  async checkServices(): Promise<{ gateway: string; services: ServiceStatus[] }> {
    const services = [
      { name: 'auth-service',    url: this.config.get('AUTH_SERVICE_URL',    'http://localhost:4001') },
      { name: 'product-service', url: this.config.get('PRODUCT_SERVICE_URL', 'http://localhost:4002') },
      { name: 'cart-service',    url: this.config.get('CART_SERVICE_URL',    'http://localhost:4003') },
      { name: 'order-service',   url: this.config.get('ORDER_SERVICE_URL',   'http://localhost:4004') },
      { name: 'payment-service', url: this.config.get('PAYMENT_SERVICE_URL', 'http://localhost:4005') },
    ];

    const results = await Promise.allSettled(
      services.map(async (svc): Promise<ServiceStatus> => {
        const start = Date.now();
        try {
          const res = await fetch(`${svc.url}/health`, {
            signal: AbortSignal.timeout(3000),
          });
          return {
            name: svc.name,
            url: svc.url,
            status: res.ok ? 'up' : 'down',
            latencyMs: Date.now() - start,
          };
        } catch {
          return { name: svc.name, url: svc.url, status: 'down', latencyMs: Date.now() - start };
        }
      }),
    );

    return {
      gateway: 'up',
      services: results.map((r) => (r.status === 'fulfilled' ? r.value : { name: 'unknown', url: '', status: 'down' })),
    };
  }
}
