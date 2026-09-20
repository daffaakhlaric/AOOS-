import { EventCategory, type IPublisher } from "@aos/event-bus";

/**
 * EYVRA SAMANTHA V2 Phase 47 (PROMPT 39 — Events). Wraps the real, already-wired `@aos/event-bus`
 * `IPublisher` for the `campaign.*` events from PROMPT 39's named taxonomy that map onto THIS
 * module's own real decision points inside `CampaignCreationService.createCampaign`:
 * `campaign.creation.requested`, `campaign.blueprint.created`, `campaign.preflight.passed`,
 * `campaign.preflight.failed`, `campaign.created`.
 *
 * NAMING: mirrors `@aos/meta-ads-connector`'s `MetaAdsConnectorEvents` / `@aos/objective-engine`'s
 * `ObjectiveEngineEvents` / `@aos/meta-ads-agent`'s `MetaAdsAgentEvents` — all three already publish
 * their own spec-named events under an `aaos.<domain>.<verb>` type string rather than the raw spec's
 * bare dotted name (e.g. spec `growth.objective.created` -> real `aaos.objective.created`). This
 * file follows that SAME established convention for consistency, rather than introducing a second,
 * un-prefixed naming scheme alongside the three already-audited ones.
 *
 * SCOPE / WHERE THIS IS CALLED FROM: only `CampaignCreationService.createCampaign`'s own real flow —
 * never the shared, private `buildBlueprintAndPreflight` helper (also reused by this module's three
 * read-only `GET` routes: `getBlueprint`/`getPreflight`/`getListingReadiness`'s siblings). Those
 * routes stay 100% zero-side-effect, exactly as this module's own class doc already establishes —
 * this file adds no publish call anywhere read-only.
 *
 * FAILURE HANDLING: pure additive event emission, never gates or changes any existing
 * `CampaignCreationResponseDto`. A publish failure is awaited and propagates directly, mirroring
 * `MetaAdsConnectorEvents.publishNewCampaignCreated`'s own real call site in
 * `CreateCampaign.ts` (awaited directly, no best-effort swallow) — the same discipline already
 * audited into that call site, not a new one invented here.
 *
 * ZERO META MUTATION: this class only ever talks to the internal `@aos/event-bus` `IPublisher` — it
 * never calls Meta, never persists anything outside the event store, and is safe to call from every
 * outcome branch (`BLOCKED`/`CREATED`/etc.) of `createCampaign`.
 */
export class CampaignCreationEvents {
  constructor(
    private readonly publisher: IPublisher,
    private readonly source: string = "aaos-api/campaign-creation",
  ) {}

  /** `aaos.campaign.creation.requested` — emitted once per real `createCampaign` call, before preflight is (re-)evaluated. */
  async publishCreationRequested(payload: CampaignCreationRequestedPayload): Promise<void> {
    await this.publish(
      "aaos.campaign.creation.requested",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  /** `aaos.campaign.blueprint.created` — emitted once per real `createCampaign` call, right after the server-side blueprint is (re-)built. */
  async publishBlueprintCreated(payload: CampaignBlueprintCreatedPayload): Promise<void> {
    await this.publish(
      "aaos.campaign.blueprint.created",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  /** `aaos.campaign.preflight.passed` — emitted when the server-recomputed preflight is `ready`. */
  async publishPreflightPassed(payload: CampaignPreflightPassedPayload): Promise<void> {
    await this.publish(
      "aaos.campaign.preflight.passed",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  /** `aaos.campaign.preflight.failed` — emitted for the real `BLOCKED` outcome (preflight not `ready`). */
  async publishPreflightFailed(payload: CampaignPreflightFailedPayload): Promise<void> {
    await this.publish(
      "aaos.campaign.preflight.failed",
      payload,
      payload.tenantId,
      payload.correlationId,
    );
  }

  /** `aaos.campaign.created` — emitted ONLY for a real `CREATED` `createCampaign` outcome (never for `SIMULATED`/`PARTIAL_FAILURE`/`FAILED`/`DUPLICATE`/`CONFLICT`). */
  async publishCampaignCreated(payload: CampaignCreatedPayload): Promise<void> {
    await this.publish("aaos.campaign.created", payload, payload.tenantId, payload.correlationId);
  }

  private async publish<T>(
    type: string,
    payload: T,
    tenantId: string,
    correlationId: string,
  ): Promise<void> {
    await this.publisher.publish({
      type,
      category: EventCategory.DOMAIN,
      payload,
      source: this.source,
      producer: "aaos-api",
      tenantId,
      correlationId,
      // Envelope `version` must be a full SemVer string — distinct from each payload's own
      // spec-mandated `version: "1.0"` business field, same documented distinction
      // `MetaAdsConnectorEvents.publish`/`ObjectiveEngineEvents.publish` already draw.
      version: "1.0.0",
    });
  }
}

/** Shared fields every event in this file carries. */
interface CampaignCreationEventBase {
  readonly tenantId: string;
  readonly correlationId: string;
  readonly growthObjectiveId: string;
  readonly listingId: string;
  readonly occurredAt: Date;
  readonly version: "1.0";
}

export type CampaignCreationRequestedPayload = CampaignCreationEventBase;

export type CampaignBlueprintCreatedPayload = CampaignCreationEventBase;

export type CampaignPreflightPassedPayload = CampaignCreationEventBase;

/** `blockingErrors` — the real `CampaignPreflightResult.blockingErrors` this outcome was computed from, never fabricated/summarized. */
export interface CampaignPreflightFailedPayload extends CampaignCreationEventBase {
  readonly blockingErrors: readonly string[];
}

/** `creationRequestId`/`blueprintId` — the same real idempotency-ledger ids `CampaignCreationResponseDto` already returns for this outcome. */
export interface CampaignCreatedPayload extends CampaignCreationEventBase {
  readonly creationRequestId: string;
  readonly blueprintId: string;
  readonly metaCampaignId: string;
  readonly metaAdSetId: string;
}
