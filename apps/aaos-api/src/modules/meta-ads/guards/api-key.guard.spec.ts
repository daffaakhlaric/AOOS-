import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { buildTestConfig } from "../../../test-support/fixtures.js";
import { buildFakeExecutionContext, buildFakeRequest } from "../../../test-support/nest-mocks.js";

import { ApiKeyGuard } from "./api-key.guard.js";

describe("ApiKeyGuard", () => {
  it("allows a request with the correct x-api-key header", () => {
    const guard = new ApiKeyGuard(buildTestConfig());
    const context = buildFakeExecutionContext(
      buildFakeRequest({ headers: { "x-api-key": "test-api-key" } }),
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it("throws UnauthorizedException when the header is missing", () => {
    const guard = new ApiKeyGuard(buildTestConfig());
    const context = buildFakeExecutionContext(buildFakeRequest());
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when the header is an empty string", () => {
    const guard = new ApiKeyGuard(buildTestConfig());
    const context = buildFakeExecutionContext(buildFakeRequest({ headers: { "x-api-key": "" } }));
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when the key has the wrong length", () => {
    const guard = new ApiKeyGuard(buildTestConfig());
    const context = buildFakeExecutionContext(
      buildFakeRequest({ headers: { "x-api-key": "short" } }),
    );
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when the key has the same length but wrong value", () => {
    const guard = new ApiKeyGuard(buildTestConfig());
    // Same length as "test-api-key" (12 chars) so this exercises the timingSafeEqual mismatch
    // branch specifically, not the length-mismatch short-circuit.
    const context = buildFakeExecutionContext(
      buildFakeRequest({ headers: { "x-api-key": "test-api-kex" } }),
    );
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when the header is provided as an array", () => {
    const guard = new ApiKeyGuard(buildTestConfig());
    const context = buildFakeExecutionContext(
      buildFakeRequest({ headers: { "x-api-key": ["a", "b"] } }),
    );
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
