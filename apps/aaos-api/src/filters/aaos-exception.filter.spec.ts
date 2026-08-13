import { BranchNotFoundError } from "@aos/branch-manager";
import { NotFoundError, ValidationError } from "@aos/errors";
import type { Logger } from "@aos/logger";
import {
  ApiServerError,
  AuthError,
  ConnectorConfigError,
  PayloadParseError,
  PermissionError,
  RateLimitError,
} from "@aos/meta-ads-connector";
import { InvalidObjectiveError, ObjectiveNotFoundError } from "@aos/objective-engine";
import type { ArgumentsHost } from "@nestjs/common";
import {
  HttpException,
  HttpStatus,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { buildFakeReply, buildFakeRequest } from "../test-support/nest-mocks.js";

import { AaosExceptionFilter } from "./aaos-exception.filter.js";

function buildHost(
  request = buildFakeRequest(),
  reply = buildFakeReply(),
): {
  host: ArgumentsHost;
  reply: ReturnType<typeof buildFakeReply>;
} {
  const host = {
    switchToHttp: () => ({
      getRequest: <T>() => request as unknown as T,
      getResponse: <T>() => reply as unknown as T,
    }),
  } as unknown as ArgumentsHost;
  return { host, reply };
}

function buildFakeLogger(): Logger {
  return {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  } as unknown as Logger;
}

describe("AaosExceptionFilter", () => {
  it("maps AuthError to 401", () => {
    const filter = new AaosExceptionFilter(buildFakeLogger());
    const { host, reply } = buildHost();
    filter.catch(new AuthError("bad token"), host);
    expect(reply.statusCode).toBe(401);
    expect(reply.body[0]).toMatchObject({
      statusCode: 401,
      error: "AuthError",
      message: "bad token",
    });
  });

  it("maps PermissionError to 403", () => {
    const filter = new AaosExceptionFilter(buildFakeLogger());
    const { host, reply } = buildHost();
    filter.catch(new PermissionError("missing permission"), host);
    expect(reply.statusCode).toBe(403);
    expect(reply.body[0]).toMatchObject({ error: "PermissionError" });
  });

  it("maps @aos/errors NotFoundError to 404", () => {
    const filter = new AaosExceptionFilter(buildFakeLogger());
    const { host, reply } = buildHost();
    filter.catch(new NotFoundError("not found"), host);
    expect(reply.statusCode).toBe(404);
    expect(reply.body[0]).toMatchObject({ error: "NotFoundError" });
  });

  it("maps @aos/errors ValidationError to 422", () => {
    const filter = new AaosExceptionFilter(buildFakeLogger());
    const { host, reply } = buildHost();
    filter.catch(new ValidationError("bad input"), host);
    expect(reply.statusCode).toBe(422);
    expect(reply.body[0]).toMatchObject({ error: "ValidationError" });
  });

  it("maps RateLimitError to 429", () => {
    const filter = new AaosExceptionFilter(buildFakeLogger());
    const { host, reply } = buildHost();
    filter.catch(new RateLimitError("too many requests", 60_000), host);
    expect(reply.statusCode).toBe(429);
    expect(reply.body[0]).toMatchObject({ error: "RateLimitError" });
  });

  it("maps ApiServerError to 502", () => {
    const filter = new AaosExceptionFilter(buildFakeLogger());
    const { host, reply } = buildHost();
    filter.catch(new ApiServerError("upstream failure"), host);
    expect(reply.statusCode).toBe(502);
    expect(reply.body[0]).toMatchObject({ error: "ApiServerError" });
  });

  it("maps ConnectorConfigError to 500", () => {
    const filter = new AaosExceptionFilter(buildFakeLogger());
    const { host, reply } = buildHost();
    filter.catch(new ConnectorConfigError("bad config"), host);
    expect(reply.statusCode).toBe(500);
    expect(reply.body[0]).toMatchObject({ error: "ConnectorConfigError" });
  });

  it("maps a WebhookError subclass to 422 with its own class name", () => {
    const filter = new AaosExceptionFilter(buildFakeLogger());
    const { host, reply } = buildHost();
    filter.catch(new PayloadParseError("malformed payload"), host);
    expect(reply.statusCode).toBe(422);
    expect(reply.body[0]).toMatchObject({ error: "PayloadParseError" });
  });

  it("maps a Nest HttpException using its own status and string response", () => {
    const filter = new AaosExceptionFilter(buildFakeLogger());
    const { host, reply } = buildHost();
    filter.catch(new HttpException("nope", HttpStatus.FORBIDDEN), host);
    expect(reply.statusCode).toBe(403);
    expect(reply.body[0]).toMatchObject({ message: "nope" });
  });

  it("maps a Nest HttpException with an object response and array message", () => {
    const filter = new AaosExceptionFilter(buildFakeLogger());
    const { host, reply } = buildHost();
    filter.catch(
      new UnprocessableEntityException(["field a is required", "field b is required"]),
      host,
    );
    expect(reply.statusCode).toBe(422);
    expect(reply.body[0]).toMatchObject({
      message: "field a is required; field b is required",
    });
  });

  it("maps a Nest HttpException with an object response and no message field to the exception's own message", () => {
    class CustomHttpException extends HttpException {
      constructor() {
        super({ statusCode: 404, custom: true }, HttpStatus.NOT_FOUND);
      }
    }
    const filter = new AaosExceptionFilter(buildFakeLogger());
    const { host, reply } = buildHost();
    const exception = new CustomHttpException();
    filter.catch(exception, host);
    expect(reply.statusCode).toBe(404);
    expect(reply.body[0]).toMatchObject({ message: exception.message });
  });

  it("falls back to a NotFoundException's constructor name and 404 status", () => {
    const filter = new AaosExceptionFilter(buildFakeLogger());
    const { host, reply } = buildHost();
    filter.catch(new NotFoundException("missing route"), host);
    expect(reply.statusCode).toBe(404);
    expect(reply.body[0]).toMatchObject({ error: "NotFoundException" });
  });

  it("maps a generic Error to 500 using its constructor name", () => {
    class SomeBug extends Error {}
    const filter = new AaosExceptionFilter(buildFakeLogger());
    const { host, reply } = buildHost();
    filter.catch(new SomeBug("boom"), host);
    expect(reply.statusCode).toBe(500);
    expect(reply.body[0]).toMatchObject({ error: "SomeBug", message: "boom" });
  });

  it("maps a non-Error thrown value to a generic 500 UnknownError", () => {
    const filter = new AaosExceptionFilter(buildFakeLogger());
    const { host, reply } = buildHost();
    filter.catch("just a string", host);
    expect(reply.statusCode).toBe(500);
    expect(reply.body[0]).toMatchObject({ error: "UnknownError" });
  });

  it("uses the incoming x-correlation-id header when present", () => {
    const filter = new AaosExceptionFilter(buildFakeLogger());
    const request = buildFakeRequest({ headers: { "x-correlation-id": "req-abc" } });
    const { host, reply } = buildHost(request);
    filter.catch(new AuthError("bad token"), host);
    expect(reply.body[0]).toMatchObject({ correlationId: "req-abc" });
  });

  it("generates a correlation id when none is present", () => {
    const filter = new AaosExceptionFilter(buildFakeLogger());
    const { host, reply } = buildHost();
    filter.catch(new AuthError("bad token"), host);
    const body = reply.body[0] as { correlationId: string };
    expect(body.correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("includes an ISO timestamp in the response body", () => {
    const filter = new AaosExceptionFilter(buildFakeLogger());
    const { host, reply } = buildHost();
    filter.catch(new AuthError("bad token"), host);
    const body = reply.body[0] as { timestamp: string };
    expect(() => new Date(body.timestamp).toISOString()).not.toThrow();
  });

  it("logs a warning with statusCode/error/message/correlationId/path", () => {
    const logger = buildFakeLogger();
    const filter = new AaosExceptionFilter(logger);
    const { host } = buildHost();
    filter.catch(new AuthError("bad token"), host);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, error: "AuthError" }),
      "aaos-api: request failed",
    );
  });

  it("constructs its own default logger when none is supplied", () => {
    const filter = new AaosExceptionFilter();
    const { host, reply } = buildHost();
    expect(() => filter.catch(new AuthError("bad token"), host)).not.toThrow();
    expect(reply.statusCode).toBe(401);
  });

  it("carries RateLimitError's retryAfterMs field on the underlying error but not into the response body", () => {
    const filter = new AaosExceptionFilter(buildFakeLogger());
    const { host, reply } = buildHost();
    const error = new RateLimitError("rate limited", 5000);
    filter.catch(error, host);
    expect(error.retryAfterMs).toBe(5000);
    expect(reply.body[0]).not.toHaveProperty("retryAfterMs");
  });

  it("maps @aos/objective-engine's ObjectiveNotFoundError (an AosError not covered by an explicit instanceof branch) to 404 via its ErrorCode.NOT_FOUND", () => {
    const filter = new AaosExceptionFilter(buildFakeLogger());
    const { host, reply } = buildHost();
    filter.catch(new ObjectiveNotFoundError("no such objective"), host);
    expect(reply.statusCode).toBe(404);
    expect(reply.body[0]).toMatchObject({
      statusCode: 404,
      error: "ObjectiveNotFoundError",
      message: "no such objective",
    });
  });

  it("maps @aos/objective-engine's InvalidObjectiveError to 422 via its ErrorCode.VALIDATION_ERROR", () => {
    const filter = new AaosExceptionFilter(buildFakeLogger());
    const { host, reply } = buildHost();
    filter.catch(new InvalidObjectiveError("bad input"), host);
    expect(reply.statusCode).toBe(422);
  });

  it("maps @aos/branch-manager's BranchNotFoundError to 404 via its ErrorCode.NOT_FOUND", () => {
    const filter = new AaosExceptionFilter(buildFakeLogger());
    const { host, reply } = buildHost();
    filter.catch(new BranchNotFoundError("no such branch"), host);
    expect(reply.statusCode).toBe(404);
    expect(reply.body[0]).toMatchObject({ error: "BranchNotFoundError" });
  });

  it("uses the response body's timestamp as a fresh Date each call, not a cached value", () => {
    const filter = new AaosExceptionFilter(buildFakeLogger());
    const { host: host1, reply: reply1 } = buildHost();
    const { host: host2, reply: reply2 } = buildHost();
    filter.catch(new AuthError("first"), host1);
    filter.catch(new AuthError("second"), host2);
    expect((reply1.body[0] as { timestamp: string }).timestamp).toBeTruthy();
    expect((reply2.body[0] as { timestamp: string }).timestamp).toBeTruthy();
  });
});
