import type { Result } from "@aos/common";
import type {
  MetaAdsConnector,
  TokenVerificationError,
  WebhookVerifier,
} from "@aos/meta-ads-connector";
import { Inject, Injectable } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, META_ADS_CONNECTOR, WEBHOOK_VERIFIER } from "../../di-tokens.js";

export interface WebhookReceivedResponse {
  readonly received: true;
}

/**
 * Wires `ProcessLeadWebhook` (`POST`) and `WebhookVerifier.verifyHandshake` (`GET`) from
 * `@aos/meta-ads-connector`. `verifyHandshake` returns its `Result` as-is — per the README's
 * documented HTTP-layer pattern, the `GET` handshake's failure response (`403` + the verifier's
 * own message, echoed as plain text) is a Meta-subscription-protocol detail distinct from this
 * app's general `@aos/errors`/connector error-to-HTTP-status table, so `WebhookController`
 * handles both branches directly rather than throwing into `AaosExceptionFilter`.
 */
@Injectable()
export class WebhookService {
  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(META_ADS_CONNECTOR) private readonly connector: MetaAdsConnector,
    @Inject(WEBHOOK_VERIFIER) private readonly verifier: WebhookVerifier,
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
      this.config.META_WEBHOOK_VERIFY_TOKEN,
    );
  }

  async processLeadWebhook(
    rawBody: string,
    signature: string | undefined,
    correlationId: string,
  ): Promise<WebhookReceivedResponse> {
    const result = await this.connector.processLeadWebhook.execute({
      rawBody,
      signature,
      webhookAppSecret: this.config.META_WEBHOOK_APP_SECRET,
      tenantId: this.config.AAOS_TENANT_ID,
      correlationId,
    });
    if (!result.ok) {
      throw result.error;
    }
    return { received: true };
  }
}
