import { createHmac, timingSafeEqual } from "node:crypto";

import { err, ok, type Result } from "@aos/common";

import { SignatureVerificationError, TokenVerificationError } from "../../domain/errors/index.js";

const SIGNATURE_PREFIX = "sha256=";

/**
 * Verifies inbound Meta webhook requests: the `X-Hub-Signature-256` HMAC on lead payloads, and
 * the `hub.verify_token` GET handshake used when first subscribing the webhook URL.
 */
export class WebhookVerifier {
  /**
   * Real HMAC-SHA256 verification: `HMAC-SHA256(rawBody, appSecret)` compared against the
   * `sha256=...` digest in the `X-Hub-Signature-256` header, using `crypto.timingSafeEqual`
   * (never `===`) to avoid leaking timing information about how many leading bytes matched.
   */
  verifySignature(
    rawBody: string,
    signatureHeader: string | undefined,
    appSecret: string,
  ): Result<void, SignatureVerificationError> {
    if (signatureHeader === undefined || !signatureHeader.startsWith(SIGNATURE_PREFIX)) {
      return err(
        new SignatureVerificationError(
          'Missing or malformed X-Hub-Signature-256 header (expected "sha256=<hex>")',
        ),
      );
    }
    const providedHex = signatureHeader.slice(SIGNATURE_PREFIX.length);
    const expectedHex = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

    const providedBuffer = safeHexToBuffer(providedHex);
    const expectedBuffer = Buffer.from(expectedHex, "hex");

    if (providedBuffer === undefined || providedBuffer.length !== expectedBuffer.length) {
      return err(
        new SignatureVerificationError("X-Hub-Signature-256 does not match the computed HMAC"),
      );
    }
    if (!timingSafeEqual(providedBuffer, expectedBuffer)) {
      return err(
        new SignatureVerificationError("X-Hub-Signature-256 does not match the computed HMAC"),
      );
    }
    return ok(undefined);
  }

  /**
   * Validates the `GET /webhooks/meta?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`
   * handshake Meta performs when a webhook subscription URL is first configured. Returns the
   * challenge string to echo back on success.
   */
  verifyHandshake(
    mode: string | undefined,
    token: string | undefined,
    challenge: string | undefined,
    configuredVerifyToken: string,
  ): Result<string, TokenVerificationError> {
    if (mode !== "subscribe") {
      return err(
        new TokenVerificationError(`hub.mode must be "subscribe", received: ${String(mode)}`),
      );
    }
    if (token === undefined || token !== configuredVerifyToken) {
      return err(
        new TokenVerificationError("hub.verify_token does not match the configured verify token"),
      );
    }
    if (challenge === undefined) {
      return err(new TokenVerificationError("hub.challenge is required"));
    }
    return ok(challenge);
  }
}

function safeHexToBuffer(hex: string): Buffer | undefined {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    return undefined;
  }
  return Buffer.from(hex, "hex");
}
