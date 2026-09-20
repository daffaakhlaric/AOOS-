import { randomUUID } from "node:crypto";

import type { IPublisher } from "@aos/event-bus";
import { AdAccountId, AdDestinationType, AdStatus, rupiahToCents } from "@aos/meta-ads-connector";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { EVENT_PUBLISHER, META_ADS_CONNECTOR_REGISTRY } from "../../di-tokens.js";
import { ActivityLogger } from "../activity-log/activity-logger.service.js";
import { CampaignAssessmentRepository } from "../campaign-health/infrastructure/campaign-assessment.repository.js";
import { GrowthObjectivesService } from "../growth-objectives/growth-objectives.service.js";
import { GrowthObjectiveCampaignsRepository } from "../growth-objectives/infrastructure/growth-objective-campaigns.repository.js";
import type { ListingResponseDto } from "../listings/dto/listing.dto.js";
import { ListingsService } from "../listings/listings.service.js";
import type {
  MetaAdsConnectorContext,
  MetaAdsConnectorRegistry,
} from "../meta-ads/infrastructure/meta-ads-connector-registry.js";
import { ModeGuardService } from "../mode-guard/mode-guard.service.js";

import { buildCampaignBlueprint } from "./domain/campaign-blueprint.js";
import type { CampaignBlueprint } from "./domain/campaign-blueprint.js";
import { CampaignCreationEvents } from "./domain/campaign-creation-events.js";
import { assessCampaignPreflight } from "./domain/campaign-preflight.js";
import { assessListingReadiness } from "./domain/listing-readiness.js";
import { planPortfolioAllocation } from "./domain/portfolio-plan.js";
import { summarizeStrategyMemory } from "./domain/strategy-memory.js";
import type { StrategyMemoryCandidate, StrategyMemoryResult } from "./domain/strategy-memory.js";
import type {
  CampaignBlueprintResponseDto,
  CampaignCreationResponseDto,
  CampaignPreflightResponseDto,
  ListingReadinessResponseDto,
  PortfolioPlanResponseDto,
  StrategyMemoryResponseDto,
} from "./dto/campaign-creation.dto.js";
import { CampaignCreationRepository } from "./infrastructure/campaign-creation.repository.js";
import type { StoredCampaignCreationRequest } from "./infrastructure/campaign-creation.repository.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Same real Meta billing event `GoLiveService`'s own `BILLING_EVENT_IMPRESSIONS` constant already uses for every AAOS-created ad set — kept as a separate literal here (not imported — neither `go-live.service.ts` nor `campaign-blueprint.ts` exports it) but the VALUE is intentionally identical, not a parallel invented one. */
const BILLING_EVENT_IMPRESSIONS = "IMPRESSIONS";

/** Outcome of the real (or DEV-simulated) Meta creation attempt — internal to this service, never exposed directly. */
type MetaCreationOutcome =
  | { readonly kind: "SIMULATED" }
  | { readonly kind: "CREATED"; readonly campaignId: string; readonly adSetId: string }
  | {
      readonly kind: "PARTIAL_FAILURE";
      readonly campaignId: string;
      readonly errorMessage: string;
    }
  | { readonly kind: "FAILED"; readonly errorMessage: string };

/**
 * `modules/campaign-creation` — EYVRA SAMANTHA V2 Phase 25 (PROMPT 32/33/35) + Phase 26 (PROMPT
 * 36/37). Phase 25's three methods stay 100% read-only planning/assessment — never mutate
 * anything, never call Meta.
 *
 * `createCampaign` (Phase 26, PROMPT 36 — Safe Campaign Creation / PROMPT 37 — Idempotency) is the
 * first real Meta-mutating path in this module. Deliberately narrower than the module's own
 * read-only trio's completeness: it creates a real, PAUSED Campaign + AdSet ONLY — see this
 * method's own doc for why real ad/creative creation is explicitly out of scope for this phase.
 *
 * SAFETY DISCIPLINE (same as every other real Meta-mutating call site in this app —
 * `CampaignsService`/`GoLiveService`):
 *  1. Preflight is ALWAYS re-derived server-side from real, freshly-fetched data — a caller can
 *     never skip straight to creation by claiming "it's ready" client-side.
 *  2. `ModeGuardService.executeOrSimulate` gates the ENTIRE real Meta call — a DEV-mode tenant
 *     makes ZERO real Meta HTTP calls, ever.
 *  3. Every created object is `PAUSED` — this service NEVER activates anything (no
 *     `activateCampaign`/`activateAd` call exists anywhere in this file).
 *  4. Idempotency (`CampaignCreationRepository`) — one real campaign per
 *     `(tenantId, growthObjectiveId, listingId)` triple, ever, enforced by a real DB unique
 *     constraint plus an explicit compare-and-swap, not a best-effort in-memory check.
 *  5. Partial Meta failure (campaign created, ad set creation failed) is reported honestly as
 *     `PARTIAL_FAILURE` with the real `metaCampaignId` — never silently reported as full success,
 *     never silently dropped.
 *
 * REUSE, NOT DUPLICATION: talks to Meta via `connector.client.createCampaign`/`.createAdSet`
 * directly — the SAME low-level `IMetaAdsClient` `GoLiveService.execute` already calls — rather
 * than through `@aos/meta-ads-connector`'s higher-level `CreateCampaign` use case
 * (`CampaignsService.createCampaign`/`.createPropertyCampaign`'s own real call path). This is a
 * deliberate, audited choice, not a second parallel Meta integration: `CreateCampaign.execute`
 * returns only `Result<{campaignId, adSetId}, MetaApiError>` — on an ad-set failure AFTER the
 * campaign was already created, the real `campaignId` that WAS created is not part of its `err(...)`
 * value (confirmed by direct read of `CreateCampaign.ts` — it only logs it internally), so a caller
 * through that use case cannot honestly persist a `PARTIAL_FAILURE`'s real id. `GoLiveService`
 * hits this exact same honesty requirement and, for the exact same reason, also calls
 * `connector.client.createCampaign`/`.createAdSet` directly rather than going through the
 * `CreateCampaign` use case — this method mirrors that established, audited pattern exactly (same
 * client, same low-level methods, only `status: PAUSED` instead of `GoLiveService`'s `ACTIVE`).
 *
 * Phase 47 (PROMPT 39 — Events) addition: `createCampaign` also publishes `aaos.campaign.*` domain
 * events via `CampaignCreationEvents` at each of its own real decision points — see that class's own
 * doc for the full naming/scope rationale. Purely additive, zero effect on any existing return value
 * or on the three read-only `GET` routes above.
 */
@Injectable()
export class CampaignCreationService {
  private readonly logger = new Logger(CampaignCreationService.name);
  /** EYVRA SAMANTHA V2 Phase 47 (PROMPT 39 — Events) — see `CampaignCreationEvents`'s own doc for scope/naming. */
  private readonly events: CampaignCreationEvents;

  constructor(
    private readonly listings: ListingsService,
    private readonly growthObjectives: GrowthObjectivesService,
    private readonly repository: CampaignCreationRepository,
    @Inject(META_ADS_CONNECTOR_REGISTRY)
    private readonly connectorRegistry: MetaAdsConnectorRegistry,
    private readonly modeGuard: ModeGuardService,
    private readonly activityLogger: ActivityLogger,
    private readonly growthObjectiveCampaigns: GrowthObjectiveCampaignsRepository,
    private readonly campaignAssessments: CampaignAssessmentRepository,
    @Inject(EVENT_PUBLISHER) eventPublisher: IPublisher,
  ) {
    this.events = new CampaignCreationEvents(eventPublisher);
  }

  async getListingReadiness(
    tenantId: string,
    listingId: string,
  ): Promise<ListingReadinessResponseDto> {
    const listing = await this.listings.getById(tenantId, listingId);
    return { listingId, readiness: assessListingReadiness(listing) };
  }

  async getBlueprint(
    tenantId: string,
    growthObjectiveId: string,
    listingId: string,
  ): Promise<CampaignBlueprintResponseDto> {
    const { blueprint } = await this.buildBlueprintAndPreflight(
      tenantId,
      growthObjectiveId,
      listingId,
    );
    return { growthObjectiveId, listingId, blueprint };
  }

  async getPreflight(
    tenantId: string,
    growthObjectiveId: string,
    listingId: string,
  ): Promise<CampaignPreflightResponseDto> {
    const { preflight } = await this.buildBlueprintAndPreflight(
      tenantId,
      growthObjectiveId,
      listingId,
    );
    return { growthObjectiveId, listingId, preflight };
  }

  /**
   * `GET /api/v1/campaign-creation/growth-objectives/:growthObjectiveId/portfolio-plan` — EYVRA
   * SAMANTHA V2 Phase 32 (raw spec's Portfolio Planner / Listing Allocation Engine). 100% read-only
   * — zero mutation, zero Meta API call, same discipline this module's other three `GET` routes
   * already establish.
   *
   * REAL CANDIDATE RESOLUTION, same real signal `GrowthObjectivesService.pacing` already keys off
   * for its own `MATCHED_CAMPAIGNS`-vs-`ACCOUNT_WIDE` split:
   *  - `growthObjective.focusListingIds` non-empty -> candidates are exactly those listings (a
   *    tenant's explicit, real choice) that still exist. A `focusListingId` that no longer resolves
   *    to a real listing (deleted since the objective was created) is silently excluded from the
   *    candidate set and surfaced honestly via `warnings` — never thrown, never fabricated.
   *  - `focusListingIds` empty (`areaStrategy: "SAMANTHA"`, no specific focus) -> EVERY real listing
   *    this tenant has is a candidate; `assessListingReadiness` (reused, not reimplemented) is what
   *    actually filters out the ones that aren't ready to advertise.
   *
   * For each real candidate, resolves real existing-campaign linkage via
   * `GrowthObjectiveCampaignsRepository.findCampaignIdsForListings` (REUSED, one real call per
   * candidate listing — same public method `pacing()` already calls, just scoped to one listing at
   * a time here since that repository's return shape has no per-listing breakdown to reuse in bulk;
   * see that repository's own doc for why no `.in()` bulk path exists on the shared Supabase port).
   * The pure allocation math itself lives entirely in `planPortfolioAllocation` — this method only
   * does the real I/O and hands it already-fetched real data.
   */
  async getPortfolioPlan(
    tenantId: string,
    growthObjectiveId: string,
  ): Promise<PortfolioPlanResponseDto> {
    const growthObjective = await this.growthObjectives.getById(tenantId, growthObjectiveId);
    const { candidateListings, warnings: candidacyWarnings } = await this.resolveCandidateListings(
      tenantId,
      growthObjective.focusListingIds,
    );

    const matchedCampaignIdsByListingId = new Map<string, readonly string[]>();
    await Promise.all(
      candidateListings.map(async (listing) => {
        const matchedCampaignIds = await this.growthObjectiveCampaigns.findCampaignIdsForListings(
          tenantId,
          [listing.id],
        );
        matchedCampaignIdsByListingId.set(listing.id, matchedCampaignIds);
      }),
    );

    // Stable, reproducible order for `planPortfolioAllocation`'s remainder distribution — see that
    // function's own doc.
    const sortedCandidates = [...candidateListings].sort((a, b) => a.id.localeCompare(b.id));

    const plan = planPortfolioAllocation({
      growthObjective,
      candidateListings: sortedCandidates,
      matchedCampaignIdsByListingId,
    });

    return {
      growthObjectiveId,
      plan: { ...plan, warnings: [...candidacyWarnings, ...plan.warnings] },
    };
  }

  /**
   * Real candidate-listing resolution shared doc — see `getPortfolioPlan`'s own header comment for
   * the full rule. `focusListingIds` non-empty resolves each id against the tenant's REAL listings
   * (never assumes an id is still valid); empty resolves to every real listing this tenant has.
   */
  private async resolveCandidateListings(
    tenantId: string,
    focusListingIds: readonly string[],
  ): Promise<{
    readonly candidateListings: readonly ListingResponseDto[];
    readonly warnings: readonly string[];
  }> {
    const allListings = (await this.listings.list(tenantId, {})).listings;
    if (focusListingIds.length === 0) {
      return { candidateListings: allListings, warnings: [] };
    }

    const byId = new Map(allListings.map((listing) => [listing.id, listing] as const));
    const candidateListings: ListingResponseDto[] = [];
    const missingIds: string[] = [];
    for (const id of focusListingIds) {
      const listing = byId.get(id);
      if (listing === undefined) {
        missingIds.push(id);
      } else {
        candidateListings.push(listing);
      }
    }

    const warnings =
      missingIds.length > 0
        ? [
            `${String(missingIds.length)} focus listing pada growth objective ini sudah tidak ditemukan (kemungkinan terhapus): ${missingIds.join(", ")}.`,
          ]
        : [];
    return { candidateListings, warnings };
  }

  /**
   * `GET /api/v1/campaign-creation/growth-objectives/:growthObjectiveId/listings/:listingId/strategy-memory`
   * — EYVRA SAMANTHA V2 Phase 33 (PROMPT 34 — Historical Strategy Memory). 100% read-only — zero
   * mutation, zero Meta API call. See `domain/strategy-memory.ts`'s own header doc for the full
   * honest audit/scope of what this does and does not answer.
   *
   * Real I/O, all bounded to this one tenant (never a cross-tenant query):
   *  1. The target listing + growth objective (already-real `getById` calls this class already
   *     makes elsewhere).
   *  2. Every real `campaign_creation_requests` row for this tenant that resulted in a real Meta
   *     object (`CampaignCreationRepository.listCreatedForTenant` — Phase 33 addition).
   *  3. Every one of THIS tenant's real listings (`ListingsService.list`, already-reused pattern
   *     from `resolveCandidateListings`) — to resolve each historical request's real
   *     propertyType/price/area at the time of THIS query (not a fabricated snapshot from when the
   *     campaign was created).
   *  4. Every one of this tenant's real growth objectives (`GrowthObjectivesService.list`) — to
   *     resolve each historical request's real objective `metric`.
   *  5. The LATEST real, persisted assessment per `meta_campaign_id`
   *     (`CampaignAssessmentRepository.listLatestPerCampaign` — Phase 33 addition) — the real
   *     outcome signal.
   *
   * A historical request whose listing was since deleted, whose growth objective was since
   * deleted, or that has never once been assessed-and-recorded (`POST
   * /campaign-health/:campaignId/assess`) is honestly EXCLUDED from the candidate set — never
   * fabricated. All pure matching/aggregation happens in `summarizeStrategyMemory`.
   */
  async getStrategyMemory(
    tenantId: string,
    growthObjectiveId: string,
    listingId: string,
  ): Promise<StrategyMemoryResponseDto> {
    const [
      growthObjective,
      listing,
      historicalRequests,
      allListings,
      allObjectives,
      latestAssessments,
    ] = await Promise.all([
      this.growthObjectives.getById(tenantId, growthObjectiveId),
      this.listings.getById(tenantId, listingId),
      this.repository.listCreatedForTenant(tenantId),
      this.listings.list(tenantId, {}),
      this.growthObjectives.list(tenantId),
      this.campaignAssessments.listLatestPerCampaign(tenantId),
    ]);

    const listingsById = new Map(allListings.listings.map((l) => [l.id, l] as const));
    const objectiveMetricById = new Map(
      allObjectives.objectives.map((o) => [o.id, o.metric as string] as const),
    );

    const candidates: StrategyMemoryCandidate[] = [];
    for (const request of historicalRequests) {
      if (request.metaCampaignId === undefined) {
        continue;
      }
      const candidateListing = listingsById.get(request.listingId);
      const objectiveMetric = objectiveMetricById.get(request.growthObjectiveId);
      const assessment = latestAssessments.get(request.metaCampaignId);
      if (
        candidateListing === undefined ||
        objectiveMetric === undefined ||
        assessment === undefined
      ) {
        continue;
      }
      candidates.push({
        listingId: candidateListing.id,
        metaCampaignId: request.metaCampaignId,
        propertyType: candidateListing.propertyType,
        price: candidateListing.price,
        city: candidateListing.city,
        province: candidateListing.province,
        objectiveMetric,
        overallStatus: assessment.health.overallStatus,
        costEfficiencyScore: assessment.health.costEfficiency.score,
        assessedAt: assessment.assessedAt,
      });
    }

    const memory: StrategyMemoryResult = summarizeStrategyMemory(
      {
        propertyType: listing.propertyType,
        price: listing.price,
        city: listing.city,
        province: listing.province,
        objectiveMetric: growthObjective.metric,
      },
      candidates,
    );

    return { growthObjectiveId, listingId, memory };
  }

  /**
   * `POST /api/v1/campaign-creation/growth-objectives/:growthObjectiveId/listings/:listingId/create`
   * — EYVRA SAMANTHA V2 Phase 26 (PROMPT 36 + 37). See this class's own header doc for the full
   * safety discipline and the honest scope-down (Campaign + AdSet only, no ads/creatives yet).
   *
   * SCOPE-DOWN, STATED HONESTLY: the raw PROMPT 36 flow also names "CREATE CREATIVES → CREATE ADS
   * PAUSED". Building that here would mean either (a) duplicating
   * `CampaignsService.publishPropertyAds`'s real upload-asset + per-variant `createAd` logic — a
   * second, independent implementation of the exact same real Meta operation, which this whole
   * session's "reuse, never duplicate" discipline explicitly rules out — or (b) extracting/exporting
   * that currently-PRIVATE method from `CampaignsService`, the single highest-real-money-risk
   * existing file in this codebase, which this phase's own instructions require treating with
   * extreme, minimal-touch caution. Given the choice, this phase stops at a real, safe, idempotent,
   * PAUSED Campaign + AdSet — ad/creative creation is deferred to a future, separately-reviewed
   * phase that can safely extend (not duplicate) `CampaignsService`'s existing ad-publish path.
   */
  async createCampaign(
    tenantId: string,
    growthObjectiveId: string,
    listingId: string,
    correlationId: string,
  ): Promise<CampaignCreationResponseDto> {
    const eventBase = {
      tenantId,
      correlationId,
      growthObjectiveId,
      listingId,
      occurredAt: new Date(),
      version: "1.0" as const,
    };
    await this.events.publishCreationRequested(eventBase);

    const { blueprint, preflight } = await this.buildBlueprintAndPreflight(
      tenantId,
      growthObjectiveId,
      listingId,
    );
    await this.events.publishBlueprintCreated(eventBase);

    if (!preflight.ready) {
      await this.events.publishPreflightFailed({
        ...eventBase,
        blockingErrors: preflight.blockingErrors,
      });
      return {
        growthObjectiveId,
        listingId,
        status: "BLOCKED",
        message: "Preflight belum lolos — campaign TIDAK dibuat di Meta.",
        preflight,
      };
    }
    await this.events.publishPreflightPassed(eventBase);

    const existing = await this.repository.findByKey(tenantId, growthObjectiveId, listingId);
    const dedup = evaluateExisting(existing, growthObjectiveId, listingId);
    if (dedup !== undefined) {
      return dedup;
    }

    const creationRequestId = randomUUID();
    const blueprintId = randomUUID();

    const claimed =
      existing === undefined
        ? await this.repository.claim({
            tenantId,
            growthObjectiveId,
            listingId,
            creationRequestId,
            blueprintId,
          })
        : await this.repository.reclaim(existing.id, existing.status, {
            creationRequestId,
            blueprintId,
          });

    if (claimed === undefined) {
      // Lost a real race against a concurrent request — re-read and report the current, honest
      // state rather than guessing or retrying in a loop.
      const raced = await this.repository.findByKey(tenantId, growthObjectiveId, listingId);
      const racedDedup = evaluateExisting(raced, growthObjectiveId, listingId);
      if (racedDedup !== undefined) {
        return racedDedup;
      }
      return {
        growthObjectiveId,
        listingId,
        status: "CONFLICT",
        message:
          "Permintaan pembuatan campaign lain sedang berjalan untuk growth objective + listing ini — coba lagi sesaat lagi.",
      };
    }

    return this.executeClaimed(tenantId, claimed, blueprint, correlationId);
  }

  private async buildBlueprintAndPreflight(
    tenantId: string,
    growthObjectiveId: string,
    listingId: string,
  ): Promise<{
    readonly blueprint: CampaignBlueprint;
    readonly preflight: ReturnType<typeof assessCampaignPreflight>;
  }> {
    const [growthObjective, listing] = await Promise.all([
      this.growthObjectives.getById(tenantId, growthObjectiveId),
      this.listings.getById(tenantId, listingId),
    ]);
    const listingReadiness = assessListingReadiness(listing);
    const daysRemaining = daysRemainingUntil(growthObjective.endDate, new Date());

    const blueprint = buildCampaignBlueprint({
      tenantId,
      growthObjective,
      listing,
      listingReadiness,
      daysRemaining,
    });

    const preflight = assessCampaignPreflight({
      listingReadiness,
      blueprint,
      feasibility: growthObjective.forecast?.feasibility,
    });

    return { blueprint, preflight };
  }

  private async executeClaimed(
    tenantId: string,
    claimed: StoredCampaignCreationRequest,
    blueprint: CampaignBlueprint,
    correlationId: string,
  ): Promise<CampaignCreationResponseDto> {
    const { growthObjectiveId, listingId, creationRequestId, blueprintId } = claimed;

    const mode = await this.modeGuard.resolveMode(tenantId);
    const activityId = await this.activityLogger.start({
      tenantId,
      agent: "SAMANTHA",
      actionType: "AUTONOMOUS_CAMPAIGN_CREATION",
      mode,
      loopId: correlationId,
      input: { growthObjectiveId, listingId, creationRequestId, blueprintId },
    });

    let outcome: MetaCreationOutcome;
    try {
      outcome = await this.modeGuard.executeOrSimulate<MetaCreationOutcome>(
        tenantId,
        () => this.createOnMeta(tenantId, blueprint, correlationId),
        () => Promise.resolve({ kind: "SIMULATED" }),
      );
    } catch (caught) {
      // Only a connector-resolution failure (thrown, not `Result`-wrapped) can land here — every
      // real Meta HTTP call inside `createOnMeta` is caught internally and returned as a `FAILED`/
      // `PARTIAL_FAILURE` outcome, never thrown. See `createOnMeta`'s own doc.
      const message = caught instanceof Error ? caught.message : String(caught);
      await this.repository.markFailed(claimed.id, message);
      await this.activityLogger.fail(activityId, caught);
      throw caught;
    }

    switch (outcome.kind) {
      case "SIMULATED": {
        await this.repository.markSimulated(claimed.id);
        await this.activityLogger.complete(activityId, {
          status: "SIMULATED",
          devPreview: { growthObjectiveId, listingId },
        });
        return {
          growthObjectiveId,
          listingId,
          status: "SIMULATED",
          message:
            "Tenant dalam mode DEV — TIDAK ada panggilan Meta nyata yang dilakukan. Campaign belum dibuat.",
          creationRequestId,
          blueprintId,
        };
      }
      case "CREATED": {
        await this.repository.markCreated(claimed.id, outcome.campaignId, outcome.adSetId);
        await this.activityLogger.complete(activityId, {
          status: "SUCCESS",
          output: { campaignId: outcome.campaignId, adSetId: outcome.adSetId },
        });
        await this.events.publishCampaignCreated({
          tenantId,
          correlationId,
          growthObjectiveId,
          listingId,
          occurredAt: new Date(),
          version: "1.0",
          creationRequestId,
          blueprintId,
          metaCampaignId: outcome.campaignId,
          metaAdSetId: outcome.adSetId,
        });
        return {
          growthObjectiveId,
          listingId,
          status: "CREATED",
          message: `Campaign + AdSet berhasil dibuat di Meta (status PAUSED). campaignId=${outcome.campaignId}, adSetId=${outcome.adSetId}.`,
          creationRequestId,
          blueprintId,
          metaCampaignId: outcome.campaignId,
          metaAdSetId: outcome.adSetId,
        };
      }
      case "PARTIAL_FAILURE": {
        await this.repository.markPartialFailure(
          claimed.id,
          outcome.campaignId,
          outcome.errorMessage,
        );
        await this.activityLogger.fail(
          activityId,
          new Error(
            `Partial failure: campaign ${outcome.campaignId} created, ad set failed: ${outcome.errorMessage}`,
          ),
        );
        return {
          growthObjectiveId,
          listingId,
          status: "PARTIAL_FAILURE",
          message: `Campaign berhasil dibuat (PAUSED, campaignId=${outcome.campaignId}) TAPI pembuatan AdSet gagal: ${outcome.errorMessage}. Campaign nyata ada di Meta dalam keadaan PAUSED — tidak dicoba ulang otomatis pada fase ini.`,
          creationRequestId,
          blueprintId,
          metaCampaignId: outcome.campaignId,
        };
      }
      case "FAILED": {
        await this.repository.markFailed(claimed.id, outcome.errorMessage);
        await this.activityLogger.fail(activityId, new Error(outcome.errorMessage));
        return {
          growthObjectiveId,
          listingId,
          status: "FAILED",
          message: `Pembuatan campaign gagal, tidak ada objek yang dibuat di Meta: ${outcome.errorMessage}`,
          creationRequestId,
          blueprintId,
        };
      }
    }
  }

  /**
   * The ONE real Meta-mutating step in this file. Never throws for a real Meta API failure — every
   * failure mode is captured and returned as a `FAILED`/`PARTIAL_FAILURE` `MetaCreationOutcome` so
   * the caller can persist the honest state. Only a connector-resolution failure
   * (`MetaAdsConnectorRegistry.resolve` returning an `err`) or an `AdAccountId.create` validation
   * failure propagates as a thrown error — both are pre-Meta-call configuration problems, not a
   * partial real-world Meta state, same distinction `GoLiveService.execute`'s own guard section
   * draws.
   */
  private async createOnMeta(
    tenantId: string,
    blueprint: CampaignBlueprint,
    _correlationId: string,
  ): Promise<MetaCreationOutcome> {
    const connectorResult = await this.connectorRegistry.resolve(tenantId);
    if (!connectorResult.ok) {
      throw connectorResult.error;
    }
    const connector: MetaAdsConnectorContext = connectorResult.value;

    const rawAdAccountId = connector.adAccountIds[0];
    if (rawAdAccountId === undefined) {
      throw new Error(`No Meta ad account is configured for tenant "${tenantId}"`);
    }
    const adAccountIdResult = AdAccountId.create(rawAdAccountId);
    if (!adAccountIdResult.ok) {
      throw adAccountIdResult.error;
    }
    const adAccountId = adAccountIdResult.value.toString();
    const accessToken = connector.accessToken;

    // Preflight (already asserted `ready` by the caller) guarantees `blueprint.adSet.dailyBudgetIdr`
    // is defined — defensively re-checked here rather than trusted blindly, per this session's
    // "never trust, always re-verify before a real mutation" discipline.
    if (blueprint.adSet.dailyBudgetIdr === undefined) {
      return {
        kind: "FAILED",
        errorMessage:
          "Blueprint tidak punya proyeksi budget harian yang valid — dibatalkan sebelum memanggil Meta.",
      };
    }

    const campaignResult = await connector.client.createCampaign(
      adAccountId,
      {
        name: blueprint.campaign.name,
        objective: blueprint.campaign.objective,
        specialAdCategories: [],
        status: AdStatus.PAUSED,
      },
      accessToken,
    );
    if (!campaignResult.ok) {
      this.logger.warn(
        `CampaignCreationService.createOnMeta(${tenantId}): campaign creation failed — ${campaignResult.error.message}`,
      );
      return { kind: "FAILED", errorMessage: campaignResult.error.message };
    }
    const campaignId = campaignResult.value.id;

    const adSetResult = await connector.client.createAdSet(
      adAccountId,
      {
        campaignId,
        name: blueprint.adSet.name,
        destinationType: AdDestinationType.WHATSAPP,
        optimizationGoal: blueprint.adSet.optimizationGoal,
        billingEvent: BILLING_EVENT_IMPRESSIONS,
        dailyBudgetCents: rupiahToCents(blueprint.adSet.dailyBudgetIdr),
        status: AdStatus.PAUSED,
      },
      accessToken,
    );
    if (!adSetResult.ok) {
      this.logger.warn(
        `CampaignCreationService.createOnMeta(${tenantId}): campaign ${campaignId} created but ad set creation failed — ${adSetResult.error.message}`,
      );
      return { kind: "PARTIAL_FAILURE", campaignId, errorMessage: adSetResult.error.message };
    }

    this.logger.log(
      `CampaignCreationService.createOnMeta(${tenantId}): campaign ${campaignId} + ad set ${adSetResult.value.id} created (PAUSED).`,
    );
    return { kind: "CREATED", campaignId, adSetId: adSetResult.value.id };
  }
}

/**
 * Real days remaining until `endDateIso` (a `YYYY-MM-DD` date-only string), clamped to `>= 0` —
 * same date-only comparison `GrowthObjectivesService.analyze` already performs before calling
 * `assessFeasibility`, duplicated here (not imported — that computation is a private inline
 * expression, not an exported helper) rather than reaching into that service's internals.
 */
function daysRemainingUntil(endDateIso: string, now: Date): number {
  const todayDateOnly = now.toISOString().slice(0, 10);
  return Math.max(
    0,
    Math.round(
      (new Date(`${endDateIso}T00:00:00.000Z`).getTime() -
        new Date(`${todayDateOnly}T00:00:00.000Z`).getTime()) /
        MS_PER_DAY,
    ),
  );
}

/**
 * Honest idempotency-dedup decision over an already-read `StoredCampaignCreationRequest` — pure,
 * no I/O, easy to exercise both from the primary path and the post-race re-check. Returns
 * `undefined` when `existing` is reclaimable (`FAILED`/`SIMULATED`) or absent — the caller should
 * proceed to claim/reclaim.
 */
function evaluateExisting(
  existing: StoredCampaignCreationRequest | undefined,
  growthObjectiveId: string,
  listingId: string,
): CampaignCreationResponseDto | undefined {
  if (existing === undefined) {
    return undefined;
  }
  if (existing.status === "CREATED" || existing.status === "PARTIAL_FAILURE") {
    return {
      growthObjectiveId,
      listingId,
      status: "DUPLICATE",
      message:
        existing.status === "CREATED"
          ? `Campaign untuk growth objective + listing ini SUDAH pernah dibuat di Meta — tidak ada panggilan Meta baru yang dilakukan. campaignId=${existing.metaCampaignId ?? "?"}, adSetId=${existing.metaAdSetId ?? "?"}.`
          : `Campaign untuk growth objective + listing ini SUDAH pernah dibuat sebagian di Meta (campaignId=${existing.metaCampaignId ?? "?"}, AdSet gagal sebelumnya) — tidak ada panggilan Meta baru yang dilakukan.`,
      creationRequestId: existing.creationRequestId,
      blueprintId: existing.blueprintId,
      ...(existing.metaCampaignId !== undefined ? { metaCampaignId: existing.metaCampaignId } : {}),
      ...(existing.metaAdSetId !== undefined ? { metaAdSetId: existing.metaAdSetId } : {}),
    };
  }
  if (existing.status === "PENDING") {
    return {
      growthObjectiveId,
      listingId,
      status: "CONFLICT",
      message:
        "Permintaan pembuatan campaign lain sedang berjalan (atau sebelumnya terhenti) untuk growth objective + listing ini — coba lagi sesaat lagi.",
    };
  }
  // FAILED / SIMULATED — reclaimable, let the caller proceed.
  return undefined;
}
