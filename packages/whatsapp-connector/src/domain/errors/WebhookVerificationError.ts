import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { WhatsAppConnectorError } from "./WhatsAppConnectorError.js";

/**
 * Base class for every webhook ingestion failure — all map to `ErrorCode.VALIDATION_ERROR` since
 * they are all "this inbound request/handshake cannot be trusted/parsed" states. Named
 * `WebhookVerificationError` per the spec's own top-level "Error Hierarchy" listing (`WebhookError`
 * subclasses live inside it in the diagram, but the diagram's own base node is spelled
 * `WebhookError` there — this file keeps that base name as `WebhookError` for the export surface,
 * see `index.ts`, while the filename documents its verification-and-parsing scope).
 */
export class WebhookError extends WhatsAppConnectorError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(ErrorCode.VALIDATION_ERROR, message, options);
  }
}

/** The `X-Hub-Signature-256` HMAC did not match the computed digest. */
export class SignatureVerificationError extends WebhookError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(message, options);
  }
}

/** The `hub.verify_token` query parameter on the GET verification handshake did not match the configured token. */
export class TokenVerificationError extends WebhookError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(message, options);
  }
}

/** The webhook body failed Zod schema validation (malformed/unexpected JSON shape). */
export class PayloadParseError extends WebhookError {
  constructor(message: string, options: AosErrorOptions = {}) {
    super(message, options);
  }
}
