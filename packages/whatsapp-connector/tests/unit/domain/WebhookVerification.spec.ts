import { describe, expect, it } from "vitest";

import { WebhookVerification } from "../../../src/domain/entities/WebhookVerification.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

describe("WebhookVerification", () => {
  it("creates from a subscribe handshake", () => {
    const verifiedAt = new Date("2026-01-01T00:00:00.000Z");
    const verification = unwrap(
      WebhookVerification.create({ mode: "subscribe", challenge: "abc123", verifiedAt }),
    );
    expect(verification.mode).toBe("subscribe");
    expect(verification.challenge).toBe("abc123");
    expect(verification.verifiedAt).toEqual(verifiedAt);
  });

  it("rejects a mode other than subscribe", () => {
    const error = unwrapErr(
      WebhookVerification.create({
        mode: "unsubscribe",
        challenge: "abc",
        verifiedAt: new Date(),
      }),
    );
    expect(error.message).toContain("mode");
  });

  it("rejects an empty challenge", () => {
    const error = unwrapErr(
      WebhookVerification.create({ mode: "subscribe", challenge: "", verifiedAt: new Date() }),
    );
    expect(error.message).toContain("challenge");
  });
});
