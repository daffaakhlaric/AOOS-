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
 *
 * AAOS-MULTI-TENANT-PHASE1B (Phase 3) — DELIBERATELY NOT rewired onto `MetaAdsConnectorRegistry`,
 * unlike every other real `META_ADS_CONNECTOR` consumer in this phase. Investigated in full before
 * deciding (mirroring Phase 2's own care for the WhatsApp webhook, per the coordinator note's
 * explicit instruction not to rush a wrong default into a webhook handler):
 *
 * - Signature verification here is genuinely global (`WEBHOOK_VERIFIER`/`META_WEBHOOK_APP_SECRET`,
 *   one Meta App receiving every tenant's lead-webhook traffic under one shared secret) — same
 *   correct, deliberately-NOT-per-tenant shape the coordinator note's finding #4 already
 *   established for WhatsApp's webhook. Nothing to change there.
 * - UNLIKE WhatsApp's webhook, this payload carries NO usable per-request tenant signal before
 *   processing: WhatsApp's `phone_number_id` is a direct, ownership-scoped field a `waba_configs`
 *   lookup resolves BEFORE any Meta call. Meta's lead-webhook payload's only ad-scoped identifier
 *   is a raw `ad_id`, which `ProcessLeadWebhook`'s `mapLeads` resolves via the injected `AdResolver`
 *   — confirmed by direct read of `MetaAdsConnectorFactory.create` that `resolveAd` is a CLOSURE
 *   over ONE connector instance's own `AdAccountRegistry`, populated only by that SAME connector's
 *   own `PullCampaignData` syncs. There is no existing "given a raw ad_id, which tenant does it
 *   belong to" index this app can consult BEFORE choosing a connector — building one (a real
 *   ad_id-to-tenant mapping table, or querying every tenant's `AdAccountRegistry` in turn) is a
 *   genuine new capability, not a mechanical per-tenant-registry swap like every other consumer in
 *   this phase.
 * - `tenantId` here is used only to STAMP the emitted `LeadReceived` event (`input.tenantId` in
 *   `ProcessLeadWebhook.execute`) — it never selects which credentials/registry entry serve the
 *   request, so swapping it for a registry-resolved connector would not by itself produce correct
 *   per-tenant attribution; it would just add a second, currently-meaningless lookup.
 *
 * Kept on the static `META_ADS_CONNECTOR` (unchanged behavior — no regression, exactly today's
 * `dss-motor`-only correctness) rather than guessing at a tenant via `config.AAOS_TENANT_ID` here,
 * which would be a silent, dishonest "per-tenant" label on a codepath that still only ever
 * resolves the one seeded tenant. Real multi-tenant Meta lead-webhook routing is DEFERRED —
 * flagged here, not silently left as an unlabeled gap.
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
