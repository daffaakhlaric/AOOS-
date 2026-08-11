import { ErrorCode } from "@aos/common";
import type { AosErrorOptions } from "@aos/errors";

import { MetaAdsConnectorError } from "./MetaAdsConnectorError.js";

/** Base class for every webhook ingestion failure — all map to `ErrorCode.VALIDATION_ERROR` since they are all "this inbound request cannot be trusted/parsed" states. */
export class WebhookError extends MetaAdsConnectorError {
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

/** The `hub.verify_token` query parameter on the webhook GET verification handshake did not match the configured token. */
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
