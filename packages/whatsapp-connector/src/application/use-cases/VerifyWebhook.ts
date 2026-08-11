import type { Result } from "@aos/common";

import type { TokenVerificationError } from "../../domain/errors/index.js";
import type { WebhookVerifier } from "../../infrastructure/webhook/WebhookVerifier.js";

export interface VerifyWebhookInput {
  readonly mode: string | undefined;
  readonly token: string | undefined;
  readonly challenge: string | undefined;
  readonly configuredVerifyToken: string;
}

/** `GET /webhooks/whatsapp` handshake — thin wrapper around `WebhookVerifier.verifyHandshake`, kept as its own use case (spec: "VerifyWebhook.ts ← GET hub.verify_token challenge") for a stable public API surface independent of the verifier's own shape. */
export class VerifyWebhook {
  constructor(private readonly verifier: WebhookVerifier) {}

  execute(input: VerifyWebhookInput): Result<string, TokenVerificationError> {
    return this.verifier.verifyHandshake(
      input.mode,
      input.token,
      input.challenge,
      input.configuredVerifyToken,
    );
  }
}
