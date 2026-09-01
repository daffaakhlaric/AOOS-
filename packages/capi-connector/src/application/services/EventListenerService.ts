import type { BaseEventShape, ISubscriptionManager } from "@aos/event-bus";
import type {
  ClosingRecorded,
  GetLead,
  IClosingRepository,
  LeadBecameHot,
  LeadCreated,
  ScoreUpdated,
} from "@aos/lead-store";
import type { Logger } from "@aos/logger";

import type { CapiEventService } from "./CapiEventService.js";

/** Real topic strings, verified against `@aos/lead-store`'s publish-side (`LeadStoreEvents`) — NOT the spec's pseudocode strings (coordinator note #2). */
const TOPIC_LEAD_CREATED = "aaos.lead-store.lead.created";
const TOPIC_LEAD_BECAME_HOT = "aaos.lead-store.lead.became-hot";
const TOPIC_SCORE_UPDATED = "aaos.lead-store.lead.score-updated";
const TOPIC_CLOSING_RECORDED = "aaos.lead-store.closing.recorded";

/** `ScoreUpdated.scoreAfter` must cross this threshold (from below) to fire `InitiateCheckout` — coordinator note #3. */
const INITIATE_CHECKOUT_SCORE_THRESHOLD = 30;

/** A day-wide window is enough to disambiguate `ClosingRecorded.closingId` against `IClosingRepository.findByFilter`'s date-range-only filter (coordinator note #4) — closings are created synchronously with the event that reports them, so `occurredAt`'s own UTC day always contains the matching row. */
function dayWindow(occurredAt: Date): { fromDate: Date; toDate: Date } {
  const fromDate = new Date(
    Date.UTC(occurredAt.getUTCFullYear(), occurredAt.getUTCMonth(), occurredAt.getUTCDate()),
  );
  const toDate = new Date(fromDate.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { fromDate, toDate };
}

/**
 * Bridges `@aos/event-bus` domain events to Meta CAPI sends via `CapiEventService`. This is the
 * first AAOS package to ever subscribe (rather than only publish) to the event bus — it injects
 * the real `ISubscriptionManager` (not `IPublisher`) and calls `.subscribe({ criteria: { topic },
 * handler })` once per event of interest, per coordinator note #1.
 */
export class EventListenerService {
  private readonly subscriptionIds: string[] = [];

  constructor(
    private readonly subscriptionManager: ISubscriptionManager,
    private readonly getLead: GetLead,
    private readonly closingRepository: IClosingRepository,
    private readonly capiEventService: CapiEventService,
    private readonly logger: Logger,
    private readonly tenantId: string,
  ) {}

  /** Subscribes to all 4 topics this connector cares about. Idempotent-ish: calling twice without `stop()` in between just adds duplicate subscriptions (matches every other AAOS long-lived service's `start()` contract — no dedicated guard, per the spec's own `start(): void` signature). */
  start(): void {
    this.subscriptionIds.push(
      this.subscriptionManager.subscribe({
        criteria: { topic: TOPIC_LEAD_CREATED },
        handler: (event) => this.onLeadCreated(event),
      }),
      this.subscriptionManager.subscribe({
        criteria: { topic: TOPIC_LEAD_BECAME_HOT },
        handler: (event) => this.onLeadBecameHot(event),
      }),
      this.subscriptionManager.subscribe({
        criteria: { topic: TOPIC_SCORE_UPDATED },
        handler: (event) => this.onScoreUpdated(event),
      }),
      this.subscriptionManager.subscribe({
        criteria: { topic: TOPIC_CLOSING_RECORDED },
        handler: (event) => this.onClosingRecorded(event),
      }),
    );
  }

  /** Symmetrical shutdown — the spec's pseudocode never defines this, but a production listener needs a clean unsubscribe path (every other long-lived AAOS service has one). */
  stop(): void {
    for (const id of this.subscriptionIds.splice(0)) {
      this.subscriptionManager.unsubscribe(id);
    }
  }

  private async onLeadCreated(event: BaseEventShape): Promise<void> {
    const payload = event.payload as LeadCreated;
    const result = await this.capiEventService.sendContact({
      phone: payload.leadPhone,
      adId: payload.adId,
      campaignId: payload.campaignId,
      occurredAt: payload.occurredAt,
      tenantId: this.tenantId,
      correlationId: event.correlationId,
    });
    if (!result.ok) {
      this.logger.error(
        { err: result.error, leadId: payload.leadId },
        "capi-connector: sendContact failed",
      );
    }
  }

  private async onLeadBecameHot(event: BaseEventShape): Promise<void> {
    const payload = event.payload as LeadBecameHot;
    const leadResult = await this.getLead.execute(payload.leadId, this.tenantId);
    if (!leadResult.ok) {
      this.logger.error(
        { err: leadResult.error, leadId: payload.leadId },
        "capi-connector: GetLead failed for LeadBecameHot",
      );
      return;
    }
    const lead = leadResult.value;
    const result = await this.capiEventService.sendAddToWishlist({
      phone: lead.leadPhone.toString(),
      adId: lead.adId,
      campaignId: lead.campaignId,
      occurredAt: payload.occurredAt,
      tenantId: this.tenantId,
      correlationId: event.correlationId,
    });
    if (!result.ok) {
      this.logger.error(
        { err: result.error, leadId: payload.leadId },
        "capi-connector: sendAddToWishlist failed",
      );
    }
  }

  /** `ScoreUpdated` fires on every score change, not just the threshold crossing — coordinator note #3 requires this guard so a lead already past 30 doesn't re-fire InitiateCheckout on every later scoring event. */
  private async onScoreUpdated(event: BaseEventShape): Promise<void> {
    const payload = event.payload as ScoreUpdated;
    if (!(
      payload.scoreAfter >= INITIATE_CHECKOUT_SCORE_THRESHOLD &&
      payload.scoreBefore < INITIATE_CHECKOUT_SCORE_THRESHOLD
    )) {
      return;
    }
    const leadResult = await this.getLead.execute(payload.leadId, this.tenantId);
    if (!leadResult.ok) {
      this.logger.error(
        { err: leadResult.error, leadId: payload.leadId },
        "capi-connector: GetLead failed for ScoreUpdated",
      );
      return;
    }
    const lead = leadResult.value;
    const result = await this.capiEventService.sendInitiateCheckout({
      phone: lead.leadPhone.toString(),
      adId: lead.adId,
      campaignId: lead.campaignId,
      occurredAt: payload.occurredAt,
      tenantId: this.tenantId,
      correlationId: event.correlationId,
    });
    if (!result.ok) {
      this.logger.error(
        { err: result.error, leadId: payload.leadId },
        "capi-connector: sendInitiateCheckout failed",
      );
    }
  }

  /**
   * `ClosingRecorded` carries neither `leadPhone` nor `unitId`/`unitPrice` (coordinator note #4)
   * — both are recovered here: phone via `GetLead`, unit fields via `IClosingRepository
   * .findByFilter` narrowed to `event.occurredAt`'s UTC day (+ `campaignId`/`adId` when present),
   * matching the row whose `.id` equals `event.closingId`. `CANCELLED` is an explicit no-op
   * (coordinator note #5) — a cancelled closing is not a conversion.
   */
  private async onClosingRecorded(event: BaseEventShape): Promise<void> {
    const payload = event.payload as ClosingRecorded;

    if (payload.closingType === "CANCELLED") {
      this.logger.debug(
        { closingId: payload.closingId },
        "capi-connector: CANCELLED closing, no CAPI event sent",
      );
      return;
    }
    if (payload.closingType !== "TEST_DRIVE" && payload.closingType !== "SPK") {
      this.logger.warn(
        { closingId: payload.closingId, closingType: payload.closingType },
        "capi-connector: unknown closingType, no CAPI event sent",
      );
      return;
    }

    const leadResult = await this.getLead.execute(payload.leadId, this.tenantId);
    if (!leadResult.ok) {
      this.logger.error(
        { err: leadResult.error, leadId: payload.leadId },
        "capi-connector: GetLead failed for ClosingRecorded",
      );
      return;
    }
    const phone = leadResult.value.leadPhone.toString();

    const { fromDate, toDate } = dayWindow(payload.occurredAt);
    const closingsResult = await this.closingRepository.findByFilter({
      campaignId: payload.campaignId,
      adId: payload.adId,
      fromDate,
      toDate,
    });
    if (!closingsResult.ok) {
      this.logger.error(
        { err: closingsResult.error, closingId: payload.closingId },
        "capi-connector: IClosingRepository.findByFilter failed for ClosingRecorded",
      );
      return;
    }
    const closing = closingsResult.value.find(
      (candidate) => candidate.id.toString() === payload.closingId,
    );
    if (closing === undefined) {
      this.logger.error(
        { closingId: payload.closingId },
        "capi-connector: could not resolve Closing for ClosingRecorded (not found in date window)",
      );
      return;
    }

    if (payload.closingType === "TEST_DRIVE") {
      const result = await this.capiEventService.sendLead({
        phone,
        unitId: closing.unitId,
        occurredAt: payload.occurredAt,
        tenantId: this.tenantId,
        correlationId: event.correlationId,
      });
      if (!result.ok) {
        this.logger.error(
          { err: result.error, closingId: payload.closingId },
          "capi-connector: sendLead failed",
        );
      }
      return;
    }

    const result = await this.capiEventService.sendPurchase({
      phone,
      unitId: closing.unitId,
      unitPrice: closing.unitPrice ?? 0,
      occurredAt: payload.occurredAt,
      tenantId: this.tenantId,
      correlationId: event.correlationId,
    });
    if (!result.ok) {
      this.logger.error(
        { err: result.error, closingId: payload.closingId },
        "capi-connector: sendPurchase failed",
      );
    }
  }
}
