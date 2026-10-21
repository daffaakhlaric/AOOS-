import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { buildTestConfig } from "../../../test-support/fixtures.js";
import { buildFakeExecutionContext, buildFakeRequest } from "../../../test-support/nest-mocks.js";

import { ApiKeyGuard } from "./api-key.guard.js";

describe("ApiKeyGuard", () => {
  it("rejects an API key without authenticated user identity", async () => {
    const guard = new ApiKeyGuard(buildTestConfig());
    const context = buildFakeExecutionContext(
      buildFakeRequest({ headers: { "x-api-key": "test-api-key" } }),
    );
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when the header is missing", async () => {
    const guard = new ApiKeyGuard(buildTestConfig());
    const context = buildFakeExecutionContext(buildFakeRequest());
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when the header is an empty string", async () => {
    const guard = new ApiKeyGuard(buildTestConfig());
    const context = buildFakeExecutionContext(buildFakeRequest({ headers: { "x-api-key": "" } }));
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when the key has the wrong length", async () => {
    const guard = new ApiKeyGuard(buildTestConfig());
    const context = buildFakeExecutionContext(
      buildFakeRequest({ headers: { "x-api-key": "short" } }),
    );
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when the key has the same length but wrong value", async () => {
    const guard = new ApiKeyGuard(buildTestConfig());
    // Same length as "test-api-key" (12 chars) so this exercises the timingSafeEqual mismatch
    // branch specifically, not the length-mismatch short-circuit.
    const context = buildFakeExecutionContext(
      buildFakeRequest({ headers: { "x-api-key": "test-api-kex" } }),
    );
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when the header is provided as an array", async () => {
    const guard = new ApiKeyGuard(buildTestConfig());
    const context = buildFakeExecutionContext(
      buildFakeRequest({ headers: { "x-api-key": ["a", "b"] } }),
    );
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
