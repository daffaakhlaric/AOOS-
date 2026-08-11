import { getTracer } from "@aos/telemetry";
import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { Observable } from "rxjs";
import { catchError, tap, throwError } from "rxjs";

import { resolveCorrelationId } from "../common/correlation.js";

/**
 * Real OpenTelemetry span per request via `@aos/telemetry`'s `getTracer`, mirroring the same
 * `tracer.startActiveSpan(name, (span) => { ... })` pattern `@aos/meta-ads-connector`'s use cases
 * use — the callback here returns the intercepted `Observable` itself (OpenTelemetry's
 * `startActiveSpan` is generic over the callback's return type), so the span's lifetime brackets
 * the whole request/response cycle, not just this interceptor's synchronous body.
 */
@Injectable()
export class TracingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const correlationId = resolveCorrelationId(request);
    const tracer = getTracer("aaos-api");

    return tracer.startActiveSpan(`${request.method} ${request.url}`, (span) => {
      span.setAttribute("http.method", request.method);
      span.setAttribute("http.url", request.url);
      span.setAttribute("correlation_id", correlationId);

      return next.handle().pipe(
        tap(() => {
          span.end();
        }),
        catchError((error: unknown) => {
          if (error instanceof Error) {
            span.recordException(error);
          }
          span.end();
          return throwError(() => error);
        }),
      );
    });
  }
}
