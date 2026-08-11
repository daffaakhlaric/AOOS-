import type { Logger } from "@aos/logger";
import { describe, expect, it, vi } from "vitest";

import {
  buildFakeCallHandler,
  buildFakeExecutionContext,
  buildFakeReply,
  buildFakeRequest,
  buildThrowingCallHandler,
} from "../test-support/nest-mocks.js";

import { LoggingInterceptor } from "./logging.interceptor.js";

function buildFakeLogger(): Logger {
  return { info: vi.fn(), error: vi.fn(), warn: vi.fn() } as unknown as Logger;
}

describe("LoggingInterceptor", () => {
  it("logs a completion line with method/path/statusCode/correlationId on success", async () => {
    const logger = buildFakeLogger();
    const interceptor = new LoggingInterceptor(logger);
    const reply = buildFakeReply();
    reply.status(200);
    const request = buildFakeRequest({ method: "GET", url: "/health" });
    const context = buildFakeExecutionContext(request, reply as never);

    const result$ = interceptor.intercept(context, buildFakeCallHandler({ status: "ok" }));
    await new Promise<void>((resolve) => {
      result$.subscribe({ next: () => resolve() });
    });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ method: "GET", path: "/health", statusCode: 200 }),
      "aaos-api: request completed",
    );
  });

  it("logs an error line and re-throws on failure", async () => {
    const logger = buildFakeLogger();
    const interceptor = new LoggingInterceptor(logger);
    const request = buildFakeRequest({ method: "POST", url: "/api/v1/verdicts" });
    const context = buildFakeExecutionContext(request);

    const result$ = interceptor.intercept(context, buildThrowingCallHandler(new Error("boom")));
    await expect(
      new Promise((_resolve, reject) => {
        result$.subscribe({ error: reject });
      }),
    ).rejects.toThrow("boom");

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ method: "POST", path: "/api/v1/verdicts", error: "boom" }),
      "aaos-api: request failed",
    );
  });

  it("stringifies a non-Error thrown value in the error log", async () => {
    const logger = buildFakeLogger();
    const interceptor = new LoggingInterceptor(logger);
    const request = buildFakeRequest();
    const context = buildFakeExecutionContext(request);

    const result$ = interceptor.intercept(
      context,
      buildThrowingCallHandler("plain string failure"),
    );
    await expect(
      new Promise((_resolve, reject) => {
        result$.subscribe({ error: reject });
      }),
    ).rejects.toBe("plain string failure");

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ error: "plain string failure" }),
      "aaos-api: request failed",
    );
  });

  it("constructs its own default logger when none is supplied", () => {
    expect(() => new LoggingInterceptor()).not.toThrow();
  });
});
