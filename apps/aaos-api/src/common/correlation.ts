import { randomUUID } from "node:crypto";

import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

export const CORRELATION_ID_HEADER = "x-correlation-id";

interface RequestWithCorrelationId extends FastifyRequest {
  correlationId?: string;
}

/**
 * Resolves this request's correlation id end-to-end: reuse the caller's `x-correlation-id`
 * header when present, otherwise reuse whatever was already generated earlier in THIS request's
 * lifecycle (cached on the request object so every layer that calls this — `LoggingInterceptor`,
 * `TracingInterceptor`, `AaosExceptionFilter`, and the `@CorrelationId()` controller param
 * decorator — agrees on the same id), otherwise generate a fresh one via `crypto.randomUUID()`.
 */
export function resolveCorrelationId(request: FastifyRequest): string {
  const headerValue = request.headers[CORRELATION_ID_HEADER];
  if (typeof headerValue === "string" && headerValue.length > 0) {
    (request as RequestWithCorrelationId).correlationId = headerValue;
    return headerValue;
  }
  const cached = (request as RequestWithCorrelationId).correlationId;
  if (cached !== undefined) {
    return cached;
  }
  const generated = randomUUID();
  (request as RequestWithCorrelationId).correlationId = generated;
  return generated;
}

/** The raw param-decorator factory, exported separately (Nest convention) so it's directly unit-testable without going through Nest's decorator/metadata machinery. */
export function correlationIdFactory(_data: unknown, ctx: ExecutionContext): string {
  const request = ctx.switchToHttp().getRequest<FastifyRequest>();
  return resolveCorrelationId(request);
}

/** Controller param decorator: `getCampaigns(@CorrelationId() correlationId: string)`. */
export const CorrelationId = createParamDecorator(correlationIdFactory);
