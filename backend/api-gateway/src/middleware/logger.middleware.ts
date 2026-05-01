import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('user-agent') ?? '';
    const start = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const ms = Date.now() - start;
      const contentLength = res.get('content-length') ?? '-';

      // Colour-code status in dev: green 2xx, yellow 3xx/4xx, red 5xx
      const statusLabel =
        statusCode >= 500 ? `\x1b[31m${statusCode}\x1b[0m` :
        statusCode >= 400 ? `\x1b[33m${statusCode}\x1b[0m` :
        statusCode >= 300 ? `\x1b[36m${statusCode}\x1b[0m` :
                            `\x1b[32m${statusCode}\x1b[0m`;

      this.logger.log(
        `${method} ${originalUrl} ${statusLabel} ${contentLength}b +${ms}ms — ${ip} ${userAgent}`,
      );
    });

    next();
  }
}
