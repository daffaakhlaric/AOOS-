import { describe, expect, it } from "vitest";

import { VerifyWebhook } from "../../../src/application/use-cases/VerifyWebhook.js";
import { WebhookVerifier } from "../../../src/infrastructure/webhook/WebhookVerifier.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("VerifyWebhook", () => {
  it("returns the challenge on a correct verify_token", () => {
    const useCase = new VerifyWebhook(new WebhookVerifier());
    const challenge = unwrap(
      useCase.execute({
        mode: "subscribe",
        token: "correct-token",
        challenge: "abc",
        configuredVerifyToken: "correct-token",
      }),
    );
    expect(challenge).toBe("abc");
  });

  it("returns TokenVerificationError on a wrong verify_token", () => {
    const useCase = new VerifyWebhook(new WebhookVerifier());
    const error = unwrapErr(
      useCase.execute({
        mode: "subscribe",
        token: "wrong-token",
        challenge: "abc",
        configuredVerifyToken: "correct-token",
      }),
    );
    expect(error.message).toContain("verify_token");
  });
});
