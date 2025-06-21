import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, body } = req;
    const startTime = Date.now();

    // Log the request
    this.logger.log(
      `Incoming Request - ${method} ${originalUrl}\n` +
      `Body: ${JSON.stringify(body, null, 2)}`,
    );

    // Capture the original res.end to intercept the response
    const originalEnd = res.end;
    let responseBody = '';

    // Override res.end to capture the response body
    res.end = function (chunk, ...args) {
      if (chunk) {
        responseBody = chunk.toString();
      }
      
      // Log response time and status
      const responseTime = Date.now() - startTime;
      Logger.log(
        `Response - ${method} ${originalUrl}\n` +
        `Status: ${res.statusCode}\n` +
        `Time: ${responseTime}ms\n` +
        `Body: ${responseBody}`,
        'HTTP',
      );

      // Call the original end function
      return originalEnd.call(this, chunk, ...args);
    };

    next();
  }
} 