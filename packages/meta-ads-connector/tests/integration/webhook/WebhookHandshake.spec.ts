import { describe, expect, it } from "vitest";

import { parseMetaAdsConnectorConfig } from "../../../src/config/MetaAdsConnectorConfig.js";
import { WebhookVerifier } from "../../../src/infrastructure/webhook/WebhookVerifier.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

/** Exercises the `GET /webhooks/meta?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`
 * handshake (spec "Webhook — Lead Entry Point") end-to-end: a real parsed `MetaAdsConnectorConfig`
 * feeding its `webhookVerifyToken` into a real `WebhookVerifier`, exactly as `apps/aaos-api` would
 * wire an HTTP GET route handler. */
describe("Webhook subscription handshake (config + WebhookVerifier composed)", () => {
  const config = unwrap(
    parseMetaAdsConnectorConfig({
      apiVersion: "v21.0",
      baseUrl: "https://graph.facebook.com",
      accessToken: "token",
      adAccountIds: ["act_1"],
      webhookVerifyToken: "my-verify-token",
      webhookAppSecret: "secret",
      tenantId: "tenant-1",
    }),
  );
  const verifier = new WebhookVerifier();

  it("echoes back hub.challenge when hub.verify_token matches the configured token", () => {
    const challenge = unwrap(
      verifier.verifyHandshake(
        "subscribe",
        config.webhookVerifyToken,
        "challenge-xyz",
        config.webhookVerifyToken,
      ),
    );
    expect(challenge).toBe("challenge-xyz");
  });

  it("rejects the handshake when hub.verify_token does not match the configured token", () => {
    expect(
      unwrapErr(
        verifier.verifyHandshake(
          "subscribe",
          "someone-elses-token",
          "challenge-xyz",
          config.webhookVerifyToken,
        ),
      ).message,
    ).toMatch(/verify_token/);
  });
});
