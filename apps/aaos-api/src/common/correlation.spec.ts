import { describe, expect, it } from "vitest";

import { buildFakeExecutionContext, buildFakeRequest } from "../test-support/nest-mocks.js";

import {
  CORRELATION_ID_HEADER,
  correlationIdFactory,
  resolveCorrelationId,
} from "./correlation.js";

describe("resolveCorrelationId", () => {
  it("reuses the caller's x-correlation-id header when present", () => {
    const request = buildFakeRequest({ headers: { [CORRELATION_ID_HEADER]: "caller-id-123" } });
    expect(resolveCorrelationId(request)).toBe("caller-id-123");
  });

  it("generates a fresh id when no header is present", () => {
    const request = buildFakeRequest();
    const id = resolveCorrelationId(request);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("caches the generated id across repeated calls on the same request", () => {
    const request = buildFakeRequest();
    const first = resolveCorrelationId(request);
    const second = resolveCorrelationId(request);
    expect(second).toBe(first);
  });

  it("ignores a non-string header value and generates a fresh id", () => {
    const request = buildFakeRequest({ headers: { [CORRELATION_ID_HEADER]: ["a", "b"] } });
    const id = resolveCorrelationId(request);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("ignores an empty-string header value and generates a fresh id", () => {
    const request = buildFakeRequest({ headers: { [CORRELATION_ID_HEADER]: "" } });
    const id = resolveCorrelationId(request);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("a caller-supplied header always wins even if a value was already cached", () => {
    const request = buildFakeRequest();
    const generated = resolveCorrelationId(request);
    (request.headers as Record<string, string>)[CORRELATION_ID_HEADER] = "later-header-value";
    expect(resolveCorrelationId(request)).toBe("later-header-value");
    expect(resolveCorrelationId(request)).not.toBe(generated);
  });
});

describe("CorrelationId param decorator", () => {
  it("extracts the resolved correlation id from the execution context's request", () => {
    const request = buildFakeRequest({ headers: { [CORRELATION_ID_HEADER]: "decorator-id" } });
    const context = buildFakeExecutionContext(request);
    expect(correlationIdFactory(undefined, context)).toBe("decorator-id");
  });

  it("generates a fresh id via the decorator when the request carries none", () => {
    const request = buildFakeRequest();
    const context = buildFakeExecutionContext(request);
    expect(correlationIdFactory("ignored-data", context)).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("CORRELATION_ID_HEADER", () => {
  it("is the lowercase x-correlation-id header name", () => {
    expect(CORRELATION_ID_HEADER).toBe("x-correlation-id");
  });
});
