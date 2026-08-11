import { describe, expect, it } from "vitest";

import { WhatsAppConnectorFactory } from "../../src/factories/WhatsAppConnectorFactory.js";
import { makeConfig } from "../fixtures/waFixtures.js";
import { createFakePublisher } from "../helpers/publisher.js";
import { unwrap, unwrapErr } from "../helpers/result.js";

describe("VerifyWebhook (via the composed factory)", () => {
  it("correct verify_token -> returns challenge", () => {
    const connector = WhatsAppConnectorFactory.create({
      config: makeConfig({ webhookVerifyToken: "correct-token" }),
      publisher: createFakePublisher(),
    });
    const challenge = unwrap(
      connector.verifyWebhook.execute({
        mode: "subscribe",
        token: "correct-token",
        challenge: "meta-challenge-123",
        configuredVerifyToken: "correct-token",
      }),
    );
    expect(challenge).toBe("meta-challenge-123");
  });

  it("wrong verify_token -> TokenVerificationError", () => {
    const connector = WhatsAppConnectorFactory.create({
      config: makeConfig({ webhookVerifyToken: "correct-token" }),
      publisher: createFakePublisher(),
    });
    const error = unwrapErr(
      connector.verifyWebhook.execute({
        mode: "subscribe",
        token: "wrong-token",
        challenge: "meta-challenge-123",
        configuredVerifyToken: "correct-token",
      }),
    );
    expect(error.message).toContain("verify_token");
  });
});
