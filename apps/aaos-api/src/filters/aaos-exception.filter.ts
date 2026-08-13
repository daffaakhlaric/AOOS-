import { ErrorCode } from "@aos/common";
import { AosError, NotFoundError, ValidationError } from "@aos/errors";
import type { Logger } from "@aos/logger";
import { createLogger } from "@aos/logger";
import {
  ApiServerError,
  AuthError,
  ConnectorConfigError,
  PermissionError,
  RateLimitError,
  WebhookError,
} from "@aos/meta-ads-connector";
import { Catch, HttpException, HttpStatus } from "@nestjs/common";
import type { ArgumentsHost, ExceptionFilter } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

import { resolveCorrelationId } from "../common/correlation.js";

export interface AaosErrorResponseBody {
  readonly statusCode: number;
  readonly error: string;
  readonly message: string;
  readonly correlationId: string;
  readonly timestamp: string;
}

/**
 * Maps `@aos/errors` / `@aos/meta-ads-connector` domain errors to HTTP status codes exactly per
 * the spec's table, and NestJS-level thrown errors (guard rejections, pipe validation failures,
 * unexpected bugs) to a consistent `{ statusCode, error, message, correlationId, timestamp }`
 * shape. This is the ONE consistent pattern this app uses for turning a `Result.err(...)` from a
 * connector use case into an HTTP response: services/controllers re-throw the raw `@aos/errors` /
 * connector error instance (see `modules/meta-ads/meta-ads.service.ts`), and this filter is the
 * single place that decides the resulting status code — no controller ever computes an HTTP
 * status itself.
 *
 * Order of `instanceof` checks matters where a subclass relationship exists (e.g. `AuthError`,
 * `PermissionError`, `RateLimitError`, and `ApiServerError` all extend `MetaApiError` — but none
 * of them extend each other, so check order among siblings is irrelevant; only "more specific
 * before more generic" matters, and there is no such pair here since `ApiServerError` is checked
 * last among the `MetaApiError` family only as a matter of matching the spec's table order).
 *
 * `WebhookError` (and its subclasses `SignatureVerificationError` / `TokenVerificationError` /
 * `PayloadParseError`) is not in the spec's literal table — the spec's own E2E requirement ("POST
 * /webhooks/meta invalid signature -> 401") is satisfied by `WebhookSignatureGuard` throwing a
 * NestJS `UnauthorizedException` directly, never reaching this filter's domain-error branch. A
 * `WebhookError` that DOES reach this filter (e.g. a malformed payload that fails
 * `ProcessLeadWebhook`'s Zod validation step, downstream of a already-passed signature check) is
 * mapped to 422, consistent with `WebhookError.code === ErrorCode.VALIDATION_ERROR` and with the
 * spec's `ValidationError -> 422` row for the same underlying error code.
 */
@Catch()
export class AaosExceptionFilter implements ExceptionFilter {
  private readonly logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger({ serviceName: "aaos-api" });
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const correlationId = resolveCorrelationId(request);
    const { statusCode, error, message } = classify(exception);

    this.logger.warn(
      { statusCode, error, message, correlationId, path: request.url },
      "aaos-api: request failed",
    );

    const body: AaosErrorResponseBody = {
      statusCode,
      error,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
    };

    void response.status(statusCode).send(body);
  }
}

function classify(exception: unknown): { statusCode: number; error: string; message: string } {
  if (exception instanceof AuthError) {
    return { statusCode: HttpStatus.UNAUTHORIZED, error: "AuthError", message: exception.message };
  }
  if (exception instanceof PermissionError) {
    return {
      statusCode: HttpStatus.FORBIDDEN,
      error: "PermissionError",
      message: exception.message,
    };
  }
  if (exception instanceof NotFoundError) {
    return {
      statusCode: HttpStatus.NOT_FOUND,
      error: "NotFoundError",
      message: exception.message,
    };
  }
  if (exception instanceof RateLimitError) {
    return {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      error: "RateLimitError",
      message: exception.message,
    };
  }
  if (exception instanceof ApiServerError) {
    return {
      statusCode: HttpStatus.BAD_GATEWAY,
      error: "ApiServerError",
      message: exception.message,
    };
  }
  if (exception instanceof ConnectorConfigError) {
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: "ConnectorConfigError",
      message: exception.message,
    };
  }
  if (exception instanceof WebhookError) {
    return {
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      error: exception.constructor.name,
      message: exception.message,
    };
  }
  if (exception instanceof ValidationError) {
    return {
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      error: "ValidationError",
      message: exception.message,
    };
  }
  /*
   * AAOS-W4A addition: `@aos/objective-engine`'s `ObjectiveNotFoundError`/`InvalidObjectiveError`
   * and `@aos/branch-manager`'s `BranchNotFoundError`/`SalesHumanNotFoundError`/
   * `BranchConfigError`/`AssignmentError`/`NoAvailableSalesError` all extend `AosError` directly
   * (not the specific `NotFoundError`/`ValidationError` subclasses above), each carrying its own
   * `ErrorCode`. Rather than growing the explicit `instanceof` list above per new package (which
   * would need updating for every future domain package's error hierarchy), any remaining
   * `AosError` is classified generically by its `.code` — the same `ErrorCode` values
   * `NotFoundError`/`ValidationError`/etc. above already use.
   */
  if (exception instanceof AosError) {
    return classifyByErrorCode(exception);
  }
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const responseBody = exception.getResponse();
    const message =
      typeof responseBody === "string"
        ? responseBody
        : extractHttpExceptionMessage(responseBody, exception.message);
    return { statusCode: status, error: exception.constructor.name, message };
  }
  if (exception instanceof Error) {
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: exception.constructor.name,
      message: exception.message,
    };
  }
  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    error: "UnknownError",
    message: "An unexpected error occurred",
  };
}

/** Maps a generic `AosError`'s `.code` to an HTTP status, for domain errors this filter has no dedicated `instanceof` branch for. See the AAOS-W4A comment above `classify`'s `AosError` check. */
function classifyByErrorCode(exception: AosError): {
  statusCode: number;
  error: string;
  message: string;
} {
  const error = exception.constructor.name;
  const message = exception.message;
  switch (exception.code) {
    case ErrorCode.NOT_FOUND:
      return { statusCode: HttpStatus.NOT_FOUND, error, message };
    case ErrorCode.VALIDATION_ERROR:
      return { statusCode: HttpStatus.UNPROCESSABLE_ENTITY, error, message };
    case ErrorCode.UNAUTHORIZED:
      return { statusCode: HttpStatus.UNAUTHORIZED, error, message };
    case ErrorCode.FORBIDDEN:
      return { statusCode: HttpStatus.FORBIDDEN, error, message };
    case ErrorCode.CONFLICT:
      return { statusCode: HttpStatus.CONFLICT, error, message };
    case ErrorCode.TIMEOUT:
      return { statusCode: HttpStatus.GATEWAY_TIMEOUT, error, message };
    case ErrorCode.RATE_LIMITED:
      return { statusCode: HttpStatus.TOO_MANY_REQUESTS, error, message };
    case ErrorCode.UNAVAILABLE:
      return { statusCode: HttpStatus.SERVICE_UNAVAILABLE, error, message };
    case ErrorCode.INTERNAL:
    default:
      return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, error, message };
  }
}

function extractHttpExceptionMessage(body: object, fallback: string): string {
  if ("message" in body) {
    const raw = (body as { message: unknown }).message;
    if (typeof raw === "string") {
      return raw;
    }
    if (Array.isArray(raw)) {
      return raw.join("; ");
    }
  }
  return fallback;
}
