import type { Logger } from "@aos/logger";
import { createLogger } from "@aos/logger";
import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Observable } from "rxjs";
import { catchError, tap, throwError } from "rxjs";

import { resolveCorrelationId } from "../common/correlation.js";

/**
 * Real structured request/response logging via `@aos/logger`'s `createLogger` (Pino) — one log
 * line per request on success (`tap`) and one on failure (`catchError`, re-throwing afterwards so
 * `AaosExceptionFilter` still runs), carrying method/path/statusCode/durationMs/correlationId.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger({ serviceName: "aaos-api" });
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const response = context.switchToHttp().getResponse<FastifyReply>();
    const correlationId = resolveCorrelationId(request);
    const { method, url } = request;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.info(
          {
            method,
            path: url,
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt,
            correlationId,
          },
          "aaos-api: request completed",
        );
      }),
      catchError((error: unknown) => {
        this.logger.error(
          {
            method,
            path: url,
            durationMs: Date.now() - startedAt,
            correlationId,
            error: error instanceof Error ? error.message : String(error),
          },
          "aaos-api: request failed",
        );
        return throwError(() => error);
      }),
    );
  }
}
