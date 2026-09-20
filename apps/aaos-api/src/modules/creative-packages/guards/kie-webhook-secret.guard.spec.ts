import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { buildTestConfig } from "../../../test-support/fixtures.js";
import { buildFakeExecutionContext, buildFakeRequest } from "../../../test-support/nest-mocks.js";

import { KieWebhookSecretGuard } from "./kie-webhook-secret.guard.js";

describe("KieWebhookSecretGuard", () => {
  it("allows a request with the correct ?secret= query parameter", () => {
    const guard = new KieWebhookSecretGuard(
      buildTestConfig({ KIE_WEBHOOK_SECRET: "test-kie-secret" }),
    );
    const context = buildFakeExecutionContext(
      buildFakeRequest({ query: { secret: "test-kie-secret" } }),
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it("throws UnauthorizedException when KIE_WEBHOOK_SECRET is not configured on this deployment (no real callback could ever have been issued)", () => {
    const guard = new KieWebhookSecretGuard(buildTestConfig({ KIE_WEBHOOK_SECRET: "" }));
    const context = buildFakeExecutionContext(buildFakeRequest({ query: { secret: "anything" } }));
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when the ?secret= query parameter is missing", () => {
    const guard = new KieWebhookSecretGuard(
      buildTestConfig({ KIE_WEBHOOK_SECRET: "test-kie-secret" }),
    );
    const context = buildFakeExecutionContext(buildFakeRequest({ query: {} }));
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when the query parameter is an empty string", () => {
    const guard = new KieWebhookSecretGuard(
      buildTestConfig({ KIE_WEBHOOK_SECRET: "test-kie-secret" }),
    );
    const context = buildFakeExecutionContext(buildFakeRequest({ query: { secret: "" } }));
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when the secret has the wrong length", () => {
    const guard = new KieWebhookSecretGuard(
      buildTestConfig({ KIE_WEBHOOK_SECRET: "test-kie-secret" }),
    );
    const context = buildFakeExecutionContext(buildFakeRequest({ query: { secret: "short" } }));
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when the secret has the same length but wrong value (exercises the timingSafeEqual mismatch branch, not the length short-circuit)", () => {
    const guard = new KieWebhookSecretGuard(
      buildTestConfig({ KIE_WEBHOOK_SECRET: "test-kie-secret" }),
    );
    const context = buildFakeExecutionContext(
      buildFakeRequest({ query: { secret: "test-kie-secrex" } }),
    );
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when the query parameter is provided as an array", () => {
    const guard = new KieWebhookSecretGuard(
      buildTestConfig({ KIE_WEBHOOK_SECRET: "test-kie-secret" }),
    );
    const context = buildFakeExecutionContext(buildFakeRequest({ query: { secret: ["a", "b"] } }));
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException when the request has no query object at all", () => {
    const guard = new KieWebhookSecretGuard(
      buildTestConfig({ KIE_WEBHOOK_SECRET: "test-kie-secret" }),
    );
    const request = buildFakeRequest();
    // `buildFakeRequest` doesn't default `query` — mirror a real Fastify request that somehow has
    // no query object, rather than relying on Fastify always populating it.
    Reflect.deleteProperty(request, "query");
    const context = buildFakeExecutionContext(request);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
