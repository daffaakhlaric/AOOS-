import { createHmac } from "node:crypto";

import { WebhookVerifier } from "@aos/whatsapp-connector";
import { describe, expect, it } from "vitest";

import { buildTestConfig } from "../../../test-support/fixtures.js";
import { buildFakeExecutionContext, buildFakeRequest } from "../../../test-support/nest-mocks.js";

import { WhatsAppSignatureGuard } from "./whatsapp-signature.guard.js";

function sign(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

describe("WhatsAppSignatureGuard", () => {
  it("allows a request with a valid X-Hub-Signature-256", () => {
    const config = buildTestConfig();
    const guard = new WhatsAppSignatureGuard(config, new WebhookVerifier());
    const rawBody = Buffer.from(
      JSON.stringify({ object: "whatsapp_business_account", entry: [] }),
      "utf8",
    );
    const signature = sign(rawBody.toString("utf8"), config.WHATSAPP_WEBHOOK_APP_SECRET);
    const context = buildFakeExecutionContext(
      buildFakeRequest({ headers: { "x-hub-signature-256": signature }, rawBody }),
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it("still allows the request through even with a MISSING signature header — per the always-200 rule this guard never blocks", () => {
    const config = buildTestConfig();
    const guard = new WhatsAppSignatureGuard(config, new WebhookVerifier());
    const rawBody = Buffer.from("{}", "utf8");
    const context = buildFakeExecutionContext(buildFakeRequest({ rawBody }));
    expect(guard.canActivate(context)).toBe(true);
  });

  it("still allows the request through even with a MISMATCHED signature — per the always-200 rule this guard never blocks", () => {
    const config = buildTestConfig();
    const guard = new WhatsAppSignatureGuard(config, new WebhookVerifier());
    const rawBody = Buffer.from("{}", "utf8");
    const context = buildFakeExecutionContext(
      buildFakeRequest({
        headers: { "x-hub-signature-256": "sha256=deadbeef" },
        rawBody,
      }),
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it("treats an array-valued signature header as absent and still allows the request through", () => {
    const config = buildTestConfig();
    const guard = new WhatsAppSignatureGuard(config, new WebhookVerifier());
    const rawBody = Buffer.from("{}", "utf8");
    const context = buildFakeExecutionContext(
      buildFakeRequest({ headers: { "x-hub-signature-256": ["a", "b"] }, rawBody }),
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it("treats a missing rawBody as an empty string", () => {
    const config = buildTestConfig();
    const guard = new WhatsAppSignatureGuard(config, new WebhookVerifier());
    const signature = sign("", config.WHATSAPP_WEBHOOK_APP_SECRET);
    const context = buildFakeExecutionContext(
      buildFakeRequest({ headers: { "x-hub-signature-256": signature } }),
    );
    expect(guard.canActivate(context)).toBe(true);
  });
});
