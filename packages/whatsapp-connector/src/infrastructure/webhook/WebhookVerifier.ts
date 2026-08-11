import { createHmac, timingSafeEqual } from "node:crypto";

import { err, ok, type Result } from "@aos/common";

import { SignatureVerificationError, TokenVerificationError } from "../../domain/errors/index.js";

const SIGNATURE_PREFIX = "sha256=";

/**
 * Verifies inbound Meta WhatsApp webhook requests: the `X-Hub-Signature-256` HMAC on message
 * payloads, and the `hub.verify_token` GET handshake used when first subscribing the webhook
 * URL. Reuses the exact real HMAC-SHA256 + `crypto.timingSafeEqual` pattern already proven in
 * `@aos/meta-ads-connector`'s `WebhookVerifier` — not reinvented, mirrored, adjusted for this
 * package's own `webhookAppSecret` config field.
 */
export class WebhookVerifier {
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
