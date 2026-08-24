import { fromBranch } from "@aos/branch-manager";
import type { BaseEventShape, IEventBroker } from "@aos/event-bus";
import type { ILeadRepository } from "@aos/lead-store";
import type { MessageReceived } from "@aos/whatsapp-connector";
import { Inject, Injectable, Logger, Optional, type OnModuleInit } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import {
  AAOS_API_CONFIG,
  EVENT_BROKER,
  LEAD_STORE_LEAD_REPOSITORY,
  WHATSAPP_CONNECTOR_REGISTRY,
} from "../../di-tokens.js";
import type { WhatsAppConnectorRegistry } from "../whatsapp/infrastructure/whatsapp-connector-registry.js";

import { BroadcastLogRepository } from "./infrastructure/broadcast-log.repository.js";

const MESSAGE_RECEIVED_TOPIC = "aaos.whatsapp.message.received";

/** Spec's `buildReEngagementGreeting` copy. Always AUTOMOTIVE-flavored — this app's `AaosApiConfig` carries no per-tenant vertical field to branch on (unlike `packages/sales-agent`'s Simulasi-only PROPERTY composition), so a real PROPERTY-flavored greeting is out of scope until that wiring exists. */
function buildReEngagementGreeting(leadName: string | undefined): string {
  const name = leadName ?? "Kak";
  return `Halo ${name}! Senang bisa ngobrol lagi \u{1F60A} Ada yang bisa saya bantu soal mobil?`;
}

/**
 * Reply-detection hook (AAOS-LEAD-RECYCLING-BROADCAST, coordinator note section 9) — the ONLY
 * real subscriber `aaos-api` has to `@aos/whatsapp-connector`'s `aaos.whatsapp.message.received`
 * event (confirmed via direct read of `ProcessIncomingWebhook.ts`: it publishes this event for
 * every inbound message and does nothing else with it — no lead-store persistence, no
 * conversation-engine wiring exists anywhere in production for a real reply to be re-qualified
 * against). Per the user's explicit decision: detection + honest logging + ONE greeting message
 * only — this class NEVER resets a conversation, NEVER changes `leads.score`/`status`/
 * `temperature`, and NEVER claims automatic re-qualification.
 *
 * Subscribes via the real `@aos/event-bus` `EventBroker.subscribe` (the same shared `IPublisher`
 * instance `app.module.ts` already composes for every other package, exposed here through the
 * `EVENT_BROKER` token as its full `IEventBroker` — publisher + subscriber — façade).
 */
@Injectable()
export class RecyclingReplyListener implements OnModuleInit {
  private readonly logger = new Logger(RecyclingReplyListener.name);

  constructor(
    @Inject(EVENT_BROKER) private readonly eventBroker: IEventBroker,
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(LEAD_STORE_LEAD_REPOSITORY) private readonly leadRepository: ILeadRepository,
    @Inject(WHATSAPP_CONNECTOR_REGISTRY)
    private readonly whatsAppConnectorRegistry: WhatsAppConnectorRegistry,
    private readonly logRepository: BroadcastLogRepository,
    // `@Optional()` — same real DI-resolution gotcha as `RecyclingService.now`, see its doc.
    @Optional() private readonly now: () => Date = () => new Date(),
  ) {}

  onModuleInit(): void {
    this.eventBroker.subscribe({
      criteria: { topic: MESSAGE_RECEIVED_TOPIC },
      handler: (event) => this.handleMessageReceived(event),
    });
  }

  async handleMessageReceived(event: BaseEventShape): Promise<void> {
    if (event.type !== MESSAGE_RECEIVED_TOPIC) {
      return;
    }
    const payload = event.payload as MessageReceived;
    if (payload.tenantId !== this.config.AAOS_TENANT_ID) {
      return;
    }
    const branchId = fromBranch(payload.branch);
    if (branchId === undefined) {
      return;
    }

    const leadResult = await this.leadRepository.findByPhoneAndBranch(
      payload.from,
      branchId,
      payload.tenantId,
    );
    if (!leadResult.ok) {
      this.logger.warn(
        `RecyclingReplyListener: findByPhoneAndBranch failed: ${leadResult.error.message}`,
      );
      return;
    }
    const lead = leadResult.value;
    if (lead === undefined || lead.broadcastCount === 0 || lead.recyclingArchived) {
      return; // not a recycling-pool lead — nothing to detect a reply against
    }

    const logs = await this.logRepository.listByLead(lead.id.toString());
    const unrepliedLog = logs.find((log) => !log.replied);
    if (unrepliedLog === undefined) {
      return; // already-acknowledged reply, or no broadcast row to attach this reply to
    }

    const at = this.now();
    await this.logRepository.markReplied(unrepliedLog.id, at.toISOString());
    this.logger.log(
      `RecyclingReplyListener: lead ${lead.id.toString()} replied after broadcast ${unrepliedLog.id} — sending one greeting, NOT re-qualifying`,
    );

    const greeting = buildReEngagementGreeting(lead.leadName);
    const connectorResult = await this.whatsAppConnectorRegistry.resolve(
      this.config.AAOS_TENANT_ID,
    );
    if (!connectorResult.ok) {
      this.logger.warn(
        `RecyclingReplyListener: no connector configured for tenant ${this.config.AAOS_TENANT_ID}, re-engagement greeting not sent for lead ${lead.id.toString()}: ${connectorResult.error.message}`,
      );
      return;
    }

    const sendResult = await connectorResult.value.sendTextMessage.execute({
      branch: payload.branch,
      to: payload.from,
      body: greeting,
      tenantId: this.config.AAOS_TENANT_ID,
      correlationId: event.correlationId,
    });
    if (!sendResult.ok) {
      this.logger.warn(
        `RecyclingReplyListener: re-engagement greeting send failed for lead ${lead.id.toString()}: ${sendResult.error.message}`,
      );
    }
  }
}
