import { err, ok, type Result } from "@aos/common";
import type { Logger } from "@aos/logger";

import type { ILeadWebhookParser } from "../../contracts/ILeadWebhookParser.js";
import type { Lead } from "../../domain/entities/Lead.js";
import { PayloadParseError, type WebhookError } from "../../domain/errors/index.js";
import type { MetaAdsConnectorEvents } from "../../domain/events/MetaAdsConnectorEvents.js";
import type { WebhookVerifier } from "../../infrastructure/webhook/WebhookVerifier.js";
import type { AdResolver } from "../../mappers/LeadMapper.js";
import { mapLeads } from "../../mappers/LeadMapper.js";

import type { Tracer } from "./PullCampaignData.js";

export interface ProcessLeadWebhookInput {
  readonly rawBody: string;
  /** `X-Hub-Signature-256` header value. */
  readonly signature: string | undefined;
  readonly webhookAppSecret: string;
  readonly tenantId: string;
  readonly correlationId: string;
}

/**
 * Processes an inbound Meta lead webhook, per the spec's "ProcessLeadWebhook" step sequence:
 * verify signature → parse+validate payload → extract leads → map to domain `Lead`s (resolving
 * `ad_id` via the injected `AdResolver`, typically backed by `AdAccountRegistry`) → emit
 * `LeadReceived` per lead → return the parsed leads.
 */
export class ProcessLeadWebhook {
  constructor(
    private readonly verifier: WebhookVerifier,
    private readonly parser: ILeadWebhookParser,
    private readonly resolveAd: AdResolver,
    private readonly events: MetaAdsConnectorEvents,
    private readonly logger: Logger,
    private readonly tracer: Tracer,
  ) {}

  async execute(
    input: ProcessLeadWebhookInput,
  ): Promise<Result<ReadonlyArray<Lead>, WebhookError>> {
    return this.tracer.startActiveSpan(
      "meta-ads-connector.process-lead-webhook",
      async (span: { end: () => void }) => {
        try {
          const signatureResult = this.verifier.verifySignature(
            input.rawBody,
            input.signature,
            input.webhookAppSecret,
          );
          if (!signatureResult.ok) {
            this.logger.warn(
              { error: signatureResult.error.message },
              "meta-ads-connector: webhook signature verification failed",
            );
            return err(signatureResult.error);
          }

          const parseResult = this.parser.parse(input.rawBody);
          if (!parseResult.ok) {
            this.logger.warn(
              { error: parseResult.error.message },
              "meta-ads-connector: webhook payload failed validation",
            );
            return err(parseResult.error);
          }

          const mappedResult = mapLeads(parseResult.value, this.resolveAd);
          if (!mappedResult.ok) {
            this.logger.warn(
              { error: mappedResult.error.message },
              "meta-ads-connector: webhook lead mapping failed",
            );
            return err(
              new PayloadParseError(mappedResult.error.message, { cause: mappedResult.error }),
            );
          }

          for (const lead of mappedResult.value) {
            await this.events.publishLeadReceived({
              leadId: lead.id.toString(),
              adId: lead.adId.toString(),
              adSetId: lead.adSetId.toString(),
              campaignId: lead.campaignId.toString(),
              adAccountId: lead.adAccountId.toString(),
              type: lead.type,
              source: lead.source,
              tenantId: input.tenantId,
              correlationId: input.correlationId,
              occurredAt: lead.receivedAt,
              version: "1.0",
            });
          }

          this.logger.info(
            { leadCount: mappedResult.value.length },
            "meta-ads-connector: webhook processed",
          );
          return ok(mappedResult.value);
        } finally {
          span.end();
        }
      },
    );
  }
}
