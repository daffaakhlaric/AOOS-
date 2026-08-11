import { createHmac } from "node:crypto";

import { WebhookVerifier } from "@aos/meta-ads-connector";
import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { buildTestConfig } from "../../../test-support/fixtures.js";
import { buildFakeExecutionContext, buildFakeRequest } from "../../../test-support/nest-mocks.js";

import { WebhookSignatureGuard } from "./webhook-signature.guard.js";

function sign(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

describe("WebhookSignatureGuard", () => {
  it("allows a request with a valid X-Hub-Signature-256", () => {
    const config = buildTestConfig();
    const guard = new WebhookSignatureGuard(config, new WebhookVerifier());
    const rawBody = Buffer.from(JSON.stringify({ object: "page", entry: [] }), "utf8");
    const signature = sign(rawBody.toString("utf8"), config.META_WEBHOOK_APP_SECRET);
    const context = buildFakeExecutionContext(
      buildFakeRequest({ headers: { "x-hub-signature-256": signature }, rawBody }),
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it("throws UnauthorizedException for a missing signature header", () => {
    const config = buildTestConfig();
    const guard = new WebhookSignatureGuard(config, new WebhookVerifier());
    const rawBody = Buffer.from("{}", "utf8");
    const context = buildFakeExecutionContext(buildFakeRequest({ rawBody }));
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException for a mismatched signature", () => {
    const config = buildTestConfig();
    const guard = new WebhookSignatureGuard(config, new WebhookVerifier());
    const rawBody = Buffer.from("{}", "utf8");
    const context = buildFakeExecutionContext(
      buildFakeRequest({
        headers: { "x-hub-signature-256": "sha256=deadbeef" },
        rawBody,
      }),
    );
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("treats an array-valued signature header as absent and rejects", () => {
    const config = buildTestConfig();
    const guard = new WebhookSignatureGuard(config, new WebhookVerifier());
    const rawBody = Buffer.from("{}", "utf8");
    const context = buildFakeExecutionContext(
      buildFakeRequest({ headers: { "x-hub-signature-256": ["a", "b"] }, rawBody }),
    );
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("treats a missing rawBody as an empty string", () => {
    const config = buildTestConfig();
    const guard = new WebhookSignatureGuard(config, new WebhookVerifier());
    const signature = sign("", config.META_WEBHOOK_APP_SECRET);
    const context = buildFakeExecutionContext(
      buildFakeRequest({ headers: { "x-hub-signature-256": signature } }),
    );
    expect(guard.canActivate(context)).toBe(true);
  });
});
