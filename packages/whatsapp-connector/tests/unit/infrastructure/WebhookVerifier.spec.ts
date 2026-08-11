import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  SignatureVerificationError,
  TokenVerificationError,
} from "../../../src/domain/errors/index.js";
import { WebhookVerifier } from "../../../src/infrastructure/webhook/WebhookVerifier.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const APP_SECRET = "test-app-secret";

function sign(rawBody: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

describe("WebhookVerifier.verifySignature", () => {
  it("accepts a real computed HMAC-SHA256 signature", () => {
    const rawBody = JSON.stringify({ hello: "world" });
    const signature = sign(rawBody, APP_SECRET);
    const verifier = new WebhookVerifier();
    const result = verifier.verifySignature(rawBody, signature, APP_SECRET);
    expect(result.ok).toBe(true);
  });

  it("rejects a missing signature header", () => {
    const verifier = new WebhookVerifier();
    const error = unwrapErr(verifier.verifySignature("{}", undefined, APP_SECRET));
    expect(error).toBeInstanceOf(SignatureVerificationError);
  });

  it("rejects a malformed signature header (missing sha256= prefix)", () => {
    const verifier = new WebhookVerifier();
    const error = unwrapErr(verifier.verifySignature("{}", "deadbeef", APP_SECRET));
    expect(error).toBeInstanceOf(SignatureVerificationError);
  });

  it("rejects a non-hex signature value", () => {
    const verifier = new WebhookVerifier();
    const error = unwrapErr(verifier.verifySignature("{}", "sha256=zzz", APP_SECRET));
    expect(error).toBeInstanceOf(SignatureVerificationError);
  });

  it("rejects a signature of the wrong length", () => {
    const verifier = new WebhookVerifier();
    const error = unwrapErr(verifier.verifySignature("{}", "sha256=ab", APP_SECRET));
    expect(error).toBeInstanceOf(SignatureVerificationError);
  });

  it("rejects a well-formed but incorrect signature", () => {
    const rawBody = JSON.stringify({ hello: "world" });
    const wrongSignature = sign(rawBody, "wrong-secret");
    const verifier = new WebhookVerifier();
    const error = unwrapErr(verifier.verifySignature(rawBody, wrongSignature, APP_SECRET));
    expect(error).toBeInstanceOf(SignatureVerificationError);
  });

  it("rejects when the body was tampered with after signing", () => {
    const original = JSON.stringify({ hello: "world" });
    const signature = sign(original, APP_SECRET);
    const tampered = JSON.stringify({ hello: "world!" });
    const verifier = new WebhookVerifier();
    const error = unwrapErr(verifier.verifySignature(tampered, signature, APP_SECRET));
    expect(error).toBeInstanceOf(SignatureVerificationError);
  });
});

describe("WebhookVerifier.verifyHandshake", () => {
  it("returns the challenge on a correct verify_token", () => {
    const verifier = new WebhookVerifier();
    const challenge = unwrap(
      verifier.verifyHandshake("subscribe", "correct-token", "challenge-123", "correct-token"),
    );
    expect(challenge).toBe("challenge-123");
  });

  it("rejects when hub.mode is not subscribe", () => {
    const verifier = new WebhookVerifier();
    const error = unwrapErr(
      verifier.verifyHandshake("unsubscribe", "correct-token", "challenge-123", "correct-token"),
    );
    expect(error).toBeInstanceOf(TokenVerificationError);
  });

  it("rejects a wrong verify_token", () => {
    const verifier = new WebhookVerifier();
    const error = unwrapErr(
      verifier.verifyHandshake("subscribe", "wrong-token", "challenge-123", "correct-token"),
    );
    expect(error).toBeInstanceOf(TokenVerificationError);
  });

  it("rejects a missing verify_token", () => {
    const verifier = new WebhookVerifier();
    const error = unwrapErr(
      verifier.verifyHandshake("subscribe", undefined, "challenge-123", "correct-token"),
    );
    expect(error).toBeInstanceOf(TokenVerificationError);
  });

  it("rejects a missing challenge", () => {
    const verifier = new WebhookVerifier();
    const error = unwrapErr(
      verifier.verifyHandshake("subscribe", "correct-token", undefined, "correct-token"),
    );
    expect(error).toBeInstanceOf(TokenVerificationError);
  });
});
