import type { Result } from "@aos/common";
import type {
  TokenVerificationError,
  WebhookVerifier,
  WhatsAppConnector,
} from "@aos/whatsapp-connector";
import { Inject, Injectable } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, WHATSAPP_CONNECTOR, WHATSAPP_WEBHOOK_VERIFIER } from "../../di-tokens.js";

/**
 * Wires `ProcessIncomingWebhook` (`POST`) and `WebhookVerifier.verifyHandshake` (`GET`) from
 * `@aos/whatsapp-connector`, mirroring `WebhookService`'s (Meta) structure exactly — except
 * `processIncomingWebhookAsync` deliberately never throws and returns `void`: per this package's
 * "Critical: Always Return 200" rule, the controller has already responded `{ received: true }`
 * by the time this resolves (or fails) — `ProcessIncomingWebhook` itself already logs every
 * failure mode internally, so there is nothing further for this method to do with a `Result.err`.
 */
@Injectable()
export class WhatsAppWebhookService {
  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(WHATSAPP_CONNECTOR) private readonly connector: WhatsAppConnector,
    @Inject(WHATSAPP_WEBHOOK_VERIFIER) private readonly verifier: WebhookVerifier,
  ) {}

  verifyHandshake(
    mode: string | undefined,
    token: string | undefined,
    challenge: string | undefined,
  ): Result<string, TokenVerificationError> {
    return this.verifier.verifyHandshake(
      mode,
      token,
      challenge,
      this.config.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
    );
  }

  async processIncomingWebhookAsync(
    rawBody: string,
    signature: string | undefined,
    correlationId: string,
  ): Promise<void> {
    await this.connector.processIncomingWebhook.execute({
      rawBody,
      signature,
      webhookAppSecret: this.config.WHATSAPP_WEBHOOK_APP_SECRET,
      tenantId: this.config.AAOS_TENANT_ID,
      correlationId,
    });
  }
}
