import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { WebhookVerifier } from "../../../src/infrastructure/webhook/WebhookVerifier.js";
import { unwrap, unwrapErr } from "../../helpers/result.js";

const APP_SECRET = "test-app-secret-123";
const BODY = JSON.stringify({ object: "page", entry: [{ id: "1", changes: [] }] });

function realSignature(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

describe("WebhookVerifier.verifySignature", () => {
  const verifier = new WebhookVerifier();

  it("accepts a real HMAC-SHA256 signature computed independently over the same body+secret", () => {
    const signature = realSignature(BODY, APP_SECRET);
    expect(verifier.verifySignature(BODY, signature, APP_SECRET).ok).toBe(true);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const signature = realSignature(BODY, "wrong-secret");
    expect(unwrapErr(verifier.verifySignature(BODY, signature, APP_SECRET)).message).toMatch(
      /does not match/,
    );
  });

  it("rejects a signature computed over a different body (tampered payload)", () => {
    const signature = realSignature(BODY, APP_SECRET);
    const tamperedBody = JSON.stringify({ object: "page", entry: [] });
    expect(verifier.verifySignature(tamperedBody, signature, APP_SECRET).ok).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(unwrapErr(verifier.verifySignature(BODY, undefined, APP_SECRET)).message).toMatch(
      /Missing or malformed/,
    );
  });

  it("rejects a signature header without the 'sha256=' prefix", () => {
    const raw = createHmac("sha256", APP_SECRET).update(BODY, "utf8").digest("hex");
    expect(verifier.verifySignature(BODY, raw, APP_SECRET).ok).toBe(false);
  });

  it("rejects a malformed (non-hex) signature", () => {
    expect(verifier.verifySignature(BODY, "sha256=not-hex-zzz", APP_SECRET).ok).toBe(false);
  });

  it("rejects a syntactically valid hex signature of the wrong length", () => {
    expect(verifier.verifySignature(BODY, "sha256=abcd", APP_SECRET).ok).toBe(false);
  });

  it("rejects an odd-length hex string", () => {
    expect(verifier.verifySignature(BODY, "sha256=abc", APP_SECRET).ok).toBe(false);
  });
});

describe("WebhookVerifier.verifyHandshake", () => {
  const verifier = new WebhookVerifier();
  const TOKEN = "configured-verify-token";

  it("accepts a valid subscribe handshake and returns the challenge", () => {
    const result = verifier.verifyHandshake("subscribe", TOKEN, "challenge-abc", TOKEN);
    expect(unwrap(result)).toBe("challenge-abc");
  });

  it("rejects a mode other than 'subscribe'", () => {
    expect(unwrapErr(verifier.verifyHandshake("unsubscribe", TOKEN, "c", TOKEN)).message).toMatch(
      /hub.mode/,
    );
  });

  it("rejects an undefined mode", () => {
    expect(verifier.verifyHandshake(undefined, TOKEN, "c", TOKEN).ok).toBe(false);
  });

  it("rejects a mismatched verify_token", () => {
    expect(
      unwrapErr(verifier.verifyHandshake("subscribe", "wrong-token", "c", TOKEN)).message,
    ).toMatch(/verify_token/);
  });

  it("rejects an undefined verify_token", () => {
    expect(verifier.verifyHandshake("subscribe", undefined, "c", TOKEN).ok).toBe(false);
  });

  it("rejects a missing challenge", () => {
    expect(
      unwrapErr(verifier.verifyHandshake("subscribe", TOKEN, undefined, TOKEN)).message,
    ).toMatch(/hub.challenge/);
  });
});
