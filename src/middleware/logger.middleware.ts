import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

function shouldOmitResponseBody(url: string): boolean {
  return /\/admin\/emails\/preview(?:\/|$)/.test(url);
}

function formatResponseBody(url: string, body: string): string {
  if (shouldOmitResponseBody(url)) {
    return '[omitted: email HTML preview]';
  }

  if (body.length > 2000) {
    return `[omitted: ${body.length} chars]`;
  }

  return body;
}

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, body } = req;
    const startTime = Date.now();
    const requestBody =
      method === 'GET' && (!body || Object.keys(body).length === 0)
        ? ''
        : `\nBody: ${JSON.stringify(body, null, 2)}`;

    this.logger.log(`Incoming Request - ${method} ${originalUrl}${requestBody}`);

    const originalEnd = res.end;
    let responseBody = '';

    res.end = function (chunk, ...args) {
      if (chunk) {
        responseBody = chunk.toString();
      }

      const responseTime = Date.now() - startTime;
      Logger.log(
        `Response - ${method} ${originalUrl}\n` +
          `Status: ${res.statusCode}\n` +
          `Time: ${responseTime}ms\n` +
          `Body: ${formatResponseBody(originalUrl, responseBody)}`,
        'HTTP',
      );

      return originalEnd.call(this, chunk, ...args);
    };

    next();
  }
} 