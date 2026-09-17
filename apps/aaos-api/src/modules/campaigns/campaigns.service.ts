import { UnavailableError } from "@aos/errors";
import {
  AdAccountId,
  Branch,
  Funnel,
  HOUSING_SPECIAL_AD_CATEGORY,
  type CreateAdCreativeSpec,
} from "@aos/meta-ads-connector";
import { Inject, Injectable, Logger } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, META_ADS_CONNECTOR_REGISTRY } from "../../di-tokens.js";
import { ActivityLogger } from "../activity-log/activity-logger.service.js";
import { CreativePackagesService } from "../creative-packages/creative-packages.service.js";
import type { StoredCreativePackage } from "../creative-packages/domain/creative-package.js";
import { ListingsService } from "../listings/listings.service.js";
import { MAX_VARIANT_COUNT } from "../llm/dto/ad-copy-variants.dto.js";
import { LocationResolverService } from "../location-resolver/location-resolver.service.js";
import type {
  MetaAdsConnectorContext,
  MetaAdsConnectorRegistry,
} from "../meta-ads/infrastructure/meta-ads-connector-registry.js";
import { MetaSyncService } from "../meta-sync/meta-sync.service.js";
import { ModeGuardService } from "../mode-guard/mode-guard.service.js";

import { resolvePropertyTargeting } from "./domain/property-targeting.builder.js";
import type {
  CreateCampaignBodyDto,
  CreateCampaignResponseDto,
} from "./dto/create-campaign.dto.js";
import type {
  CreatePropertyCampaignBodyDto,
  CreatePropertyCampaignResponseDto,
} from "./dto/create-property-campaign.dto.js";
import type {
  RestructureCampaignRequest,
  RestructureCampaignResponseDto,
} from "./dto/restructure-campaign.dto.js";

/**
 * Wires `CreateCampaign` from `@aos/meta-ads-connector` (AAOS-W1D-S3 Fix 3), translating between
 * this app's HTTP DTO and the connector's domain types — same composition/error-translation
 * pattern as `modules/meta-ads/meta-ads.service.ts` (re-throws the raw `@aos/errors`/connector
 * error instance on `Result.err(...)`, never a Nest `HttpException`, so `AaosExceptionFilter` is
 * the single place deciding the resulting HTTP status).
 *
 * AAOS-MULTI-TENANT-PHASE1B (Phase 3): resolves the caller's tenant's own `MetaAdsConnector`
 * (accessToken + ad-account-ids) from `MetaAdsConnectorRegistry` rather than the single static
 * connector — `config.AAOS_TENANT_ID` today (this app has no per-request tenant context on this
 * endpoint yet), same "static default until request-scoped tenant exists" approach every other
 * converted consumer in this phase uses. `ConnectorNotConfiguredError` is re-thrown as-is
 * (`AaosExceptionFilter` already maps it to a real HTTP status via its `UnavailableError` base).
 */
@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(META_ADS_CONNECTOR_REGISTRY)
    private readonly connectorRegistry: MetaAdsConnectorRegistry,
    private readonly modeGuard: ModeGuardService,
    private readonly activityLogger: ActivityLogger,
    private readonly listings: ListingsService,
    private readonly locationResolver: LocationResolverService,
    /**
     * AAOS-SAMANTHA-LLM-AD-COPY — the real, tenant-scoped `CreativePackagesService.
     * getForCampaignPublish` lookup used to fetch the matched `creative_packages` row's real
     * Kai/Kie-AI-generated media + `copyVariants` when publishing multiple real Meta ads (see
     * `createPropertyCampaign`'s own doc for the full real multi-ad-publish mechanism).
     */
    private readonly creativePackages: CreativePackagesService,
    /**
     * EYVRA-META-OAUTH-WHATSAPP-SETUP Sprint 4 — real, best-effort realtime sync hook. Called
     * (never awaited-to-block, never allowed to fail the real campaign action) right after a real
     * LIVE campaign create succeeds in both `createCampaign` and `createPropertyCampaign` below —
     * see `MetaSyncService.syncCampaign`'s own doc for why it never throws.
     */
    private readonly metaSync: MetaSyncService,
  ) {}

  /**
   * The other real Meta-mutating call site `ModeGuardService` gates (AAOS-PROPERTY-DEVLIVE-
   * ACTIVITYLOG Phase A point 3): `connector.createCampaign.execute` really creates a (PAUSED)
   * campaign+adset on Meta. DEV mode's `simulateFn` never touches Meta and returns an honest
   * `{ simulated: true }` with no ids — see `CreateCampaignResponseDto`'s doc for why fabricating
   * ids would be worse.
   *
   * AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase B: the second of the 2 real `ActivityLogger` call
   * sites — same real `mode`-from-`ModeGuardService`/`status`-from-`result.simulated` discipline
   * `MetaAdsService.executeVerdict` establishes.
   */
  async createCampaign(
    body: CreateCampaignBodyDto,
    correlationId: string,
  ): Promise<CreateCampaignResponseDto> {
    const adAccountIdResult = AdAccountId.create(body.adAccountId);
    if (!adAccountIdResult.ok) {
      throw adAccountIdResult.error;
    }

    const connectorResult = await this.connectorRegistry.resolve(this.config.AAOS_TENANT_ID);
    if (!connectorResult.ok) {
      throw connectorResult.error;
    }
    const connector = connectorResult.value;

    const mode = await this.modeGuard.resolveMode(this.config.AAOS_TENANT_ID);
    const activityId = await this.activityLogger.start({
      tenantId: this.config.AAOS_TENANT_ID,
      agent: "SAMANTHA",
      actionType: "CREATE_CAMPAIGN",
      mode,
      loopId: correlationId,
      input: {
        adAccountId: body.adAccountId,
        name: body.name,
        branch: body.branch,
        funnel: body.funnel,
        dailyBudgetIDR: body.dailyBudgetIDR,
      },
    });

    try {
      const result = await this.modeGuard.executeOrSimulate<CreateCampaignResponseDto>(
        this.config.AAOS_TENANT_ID,
        async () => {
          const executed = await connector.createCampaign.execute({
            adAccountId: adAccountIdResult.value,
            name: body.name,
            branch: body.branch,
            funnel: body.funnel,
            accessToken: connector.accessToken,
            tenantId: this.config.AAOS_TENANT_ID,
            correlationId,
            dailyBudgetIDR: body.dailyBudgetIDR,
          });
          if (!executed.ok) {
            throw executed.error;
          }
          return { ...executed.value, simulated: false };
        },
        () => Promise.resolve({ simulated: true }),
      );

      await this.activityLogger.complete(activityId, {
        status: result.simulated ? "SIMULATED" : "SUCCESS",
        ...(result.simulated ? { devPreview: result } : { output: result }),
      });

      // EYVRA-META-OAUTH-WHATSAPP-SETUP Sprint 4 — real, best-effort realtime sync. Only for a
      // real LIVE creation (a DEV `simulated` result has no real `campaignId` — nothing to sync).
      // Deliberately NOT awaited: `MetaSyncService.syncCampaign` never throws (see its own doc),
      // and this campaign-creation response must never wait on an extra real Meta round trip.
      if (!result.simulated && result.campaignId !== undefined) {
        void this.metaSync.syncCampaign(this.config.AAOS_TENANT_ID, result.campaignId);
      }

      return result;
    } catch (error) {
      await this.activityLogger.fail(activityId, error);
      throw error;
    }
  }

  /**
   * `POST /api/v1/campaigns/property` (AAOS EPIC S, Phase S4) — the real, honest wiring point
   * this whole epic exists to build: takes a real, tenant-scoped `Listing`
   * (`ListingsService.getById` — real 404 for missing/cross-tenant, per this session's
   * tenant-isolation discipline) and, when LIVE, actually creates a real Meta campaign+ad set with
   * real HOUSING targeting.
   *
   * "Is a new connector-level use case needed?" decision (S3): NO — `CreateCampaign.execute` is
   * reused AS-IS. Once S1 landed, the only real logic that differs between an AUTOMOTIVE and a
   * PROPERTY campaign is `specialAdCategories`/`targeting` (both already additive/optional on
   * `CreateCampaignInput`) — the campaign+adset creation SEQUENCE itself (create campaign, create
   * adset, publish `NewCampaignCreated`, log) is identical, and duplicating that sequence in a new
   * connector-level use case would be exactly the "second, independent way to create a real Meta
   * campaign" this codebase's own discipline (see `SchedulerService.recordCampaignTriggerDecision`
   * 's docstring) explicitly rules out — doubly so on the highest-real-money-risk phase of this
   * whole epic. `branch: Branch.UMUM`/`funnel: Funnel.CTWA` are passed as the closest honest fit
   * for `CreateCampaignInput`'s two AUTOMOTIVE-typed required fields: neither is ever sent to Meta
   * (`client.createCampaign`/`createAdSet` never read them — confirmed directly in
   * `CreateCampaign.ts`), both only tag the emitted `NewCampaignCreated` event (which has no real
   * consumer in this codebase today, confirmed directly), and `Funnel.CTWA` is in fact ACCURATE
   * (every AAOS-created campaign, PROPERTY included, really is a CTWA/WhatsApp-destination
   * campaign) — only `Branch.UMUM` ("unclassified/nationwide") is a judgment call, chosen over any
   * specific AUTOMOTIVE branch precisely because it does NOT claim a false geography.
   *
   * MANDATORY DEV/LIVE gate (`ModeGuardService.executeOrSimulate`): the ENTIRE real-Meta-touching
   * pipeline — `SearchAdLocations` (real geo-search reads) AND `CreateCampaign.execute` (real
   * campaign/adset writes) — lives inside `executeFn` only. DEV's `simulateFn` never calls
   * `resolvePropertyTargeting` at all, so DEV mode makes ZERO real Meta HTTP calls of any kind for
   * this endpoint, not just skipping the final mutating write — the strictest reading of "DEV must
   * NEVER call real Meta". `LocationResolverService.resolve` (LLM-or-fallback, no Meta calls) runs
   * unconditionally before the gate, same as `SchedulerService.buildCampaignTriggerOutput`'s own
   * precedent, since both DEV's preview and LIVE's real campaign need the same real resolved
   * cities.
   *
   * "Every city fails to resolve" real decision: `resolvePropertyTargeting` (LIVE-only — see its
   * own docstring) throws a real `ValidationError` rather than building a campaign with empty geo
   * targeting — that error propagates out of `executeFn`, fails the activity, and rejects this
   * call. DEV mode can never hit this path (it never calls `SearchAdLocations`), so a DEV preview
   * always succeeds regardless of whether the real cities would have resolved.
   */
  /**
   * AAOS-SAMANTHA-LLM-AD-COPY — `creativePackageId` is an optional, internal-only 4th parameter
   * (deliberately NOT added to `CreatePropertyCampaignBodyDto`/the HTTP body — the manual
   * `POST /api/v1/campaigns/property` endpoint keeps behaving exactly as before: campaign+adset
   * only, zero ads, byte-for-byte unchanged). Only `SchedulerService.runCampaignPublishCheck`
   * (Sprint 8c's real auto-publish flow) passes it — it already resolves the matched `pkg` for a
   * listing before calling this method, so it is threaded straight through rather than making this
   * method re-derive the same match a second, possibly-drifting way.
   *
   * When present, AFTER the real AdSet is created (inside the SAME `executeFn` the campaign/adset
   * creation already runs in — see `ModeGuardService.executeOrSimulate`'s doc: DEV's `simulateFn`
   * never enters `executeFn` at all, so DEV mode makes ZERO real Meta `createAd`/upload calls
   * either, matching this method's own pre-existing `createCampaign` DEV/LIVE discipline exactly),
   * the matched package's `copyVariants` (up to 3) are each published as a real, separate Meta Ad
   * in the SAME AdSet — real Meta-native A/B testing (multiple ads sharing one AdSet's budget, not
   * 3x spend). Every ad reuses the SAME uploaded video/image asset (Kai/Kie-AI-generated); only the
   * copy text differs per ad. Best-effort per ad (see `publishPropertyAds`'s own doc) — one failing
   * `createAd` call never fails the whole campaign-creation call.
   */
  async createPropertyCampaign(
    tenantId: string,
    body: CreatePropertyCampaignBodyDto,
    correlationId: string,
    creativePackageId?: string,
  ): Promise<CreatePropertyCampaignResponseDto> {
    const listing = await this.listings.getById(tenantId, body.listingId);
    const creativePackage =
      creativePackageId !== undefined
        ? await this.creativePackages.getForCampaignPublish(tenantId, creativePackageId)
        : undefined;

    const connectorResult = await this.connectorRegistry.resolve(tenantId);
    if (!connectorResult.ok) {
      throw connectorResult.error;
    }
    const connector = connectorResult.value;

    const rawAdAccountId = connector.adAccountIds[0];
    if (rawAdAccountId === undefined) {
      throw new UnavailableError(
        `No Meta ad account is configured for tenant "${tenantId}" — cannot create a PROPERTY campaign.`,
      );
    }
    const adAccountIdResult = AdAccountId.create(rawAdAccountId);
    if (!adAccountIdResult.ok) {
      throw adAccountIdResult.error;
    }

    const resolvedLocation = await this.locationResolver.resolve(tenantId, {
      listingTitle: listing.title,
      propertyType: listing.propertyType,
      price: listing.price,
      ...(listing.city !== undefined ? { city: listing.city } : {}),
      ...(listing.province !== undefined ? { province: listing.province } : {}),
      ...(listing.address !== undefined ? { address: listing.address } : {}),
      ...(listing.branchId !== undefined ? { branchId: listing.branchId } : {}),
    });

    const mode = await this.modeGuard.resolveMode(tenantId);
    const activityId = await this.activityLogger.start({
      tenantId,
      agent: "SAMANTHA",
      actionType: "CREATE_PROPERTY_CAMPAIGN",
      mode,
      loopId: correlationId,
      input: {
        listingId: listing.id,
        listingTitle: listing.title,
        resolvedCities: resolvedLocation.cities,
        dailyBudgetIDR: body.dailyBudgetIDR,
      },
    });

    try {
      const result = await this.modeGuard.executeOrSimulate<CreatePropertyCampaignResponseDto>(
        tenantId,
        async () => {
          const propertyTargeting = await resolvePropertyTargeting(
            connector.searchAdLocations,
            resolvedLocation,
            connector.accessToken,
          );
          const executed = await connector.createCampaign.execute({
            adAccountId: adAccountIdResult.value,
            name: `PROPERTY-${listing.title}`,
            branch: Branch.UMUM,
            funnel: Funnel.CTWA,
            accessToken: connector.accessToken,
            tenantId,
            correlationId,
            dailyBudgetIDR: body.dailyBudgetIDR,
            specialAdCategories: [HOUSING_SPECIAL_AD_CATEGORY],
            targeting: propertyTargeting.targeting,
          });
          if (!executed.ok) {
            throw executed.error;
          }

          // AAOS-SAMANTHA-LLM-AD-COPY — real, best-effort multi-ad publish. Only attempted when a
          // matched creative package was supplied (see this method's own doc) — the manual
          // endpoint (no `creativePackageId`) is completely unaffected.
          const adIds =
            creativePackage !== undefined
              ? await this.publishPropertyAds(
                  connector,
                  adAccountIdResult.value,
                  executed.value.adSetId,
                  listing.waNumber,
                  creativePackage,
                  connector.accessToken,
                )
              : [];

          // Kai Creative Engine Sprint 5 (foundation) — real, best-effort persistence of the ids
          // `publishPropertyAds` just created, so this package's angle/format can eventually be
          // joined back to real Meta ad performance (see `recordPublishedMetaAdIds`'s own doc). Only
          // attempted when a real publish was attempted (`creativePackage !== undefined`) — never
          // writes anything for the manual, package-less endpoint. Best-effort, same "never let a
          // side-effect write break the real campaign-creation result" discipline this method's own
          // `publishPropertyAds` call already establishes for its own per-ad failures.
          if (creativePackage !== undefined) {
            try {
              await this.creativePackages.recordPublishedMetaAdIds(
                tenantId,
                creativePackage.id,
                adIds,
              );
            } catch (caught) {
              this.logger.warn(
                `CampaignsService.createPropertyCampaign(${creativePackage.id}): recordPublishedMetaAdIds failed, continuing: ${caught instanceof Error ? caught.message : String(caught)}`,
              );
            }
          }

          return {
            ...executed.value,
            simulated: false,
            resolvedCities: resolvedLocation.cities,
            matchedCities: propertyTargeting.matchedCities,
            unresolvedCities: propertyTargeting.unresolvedCities,
            ...(adIds.length > 0 ? { adIds } : {}),
          };
        },
        () =>
          Promise.resolve({
            simulated: true,
            resolvedCities: resolvedLocation.cities,
            note:
              "DEV mode — real Meta geo-search and campaign creation were not performed; " +
              "resolvedCities are LocationResolverService's free-text output, not real Meta " +
              "location keys.",
          }),
      );

      await this.activityLogger.complete(activityId, {
        status: result.simulated ? "SIMULATED" : "SUCCESS",
        ...(result.simulated ? { devPreview: result } : { output: result }),
      });

      // EYVRA-META-OAUTH-WHATSAPP-SETUP Sprint 4 — same real, best-effort, non-blocking realtime
      // sync hook as `createCampaign` above. This is also the ONE real call site
      // `SchedulerService.runCampaignPublishCheck`'s own auto-publish flow goes through (it calls
      // this same method), so no separate hook is needed there.
      if (!result.simulated && result.campaignId !== undefined) {
        const campaignId = result.campaignId;
        void this.metaSync
          .syncCampaign(tenantId, campaignId)
          // Campaign->Listing Mapping — chained AFTER `syncCampaign` (not a parallel `void`) so
          // the real `meta_campaigns` row it upserts already exists by the time this UPDATE runs.
          // Real LIVE-only: DEV/simulated mode has no real Meta campaign id to link to (see the
          // `!result.simulated` guard above), never a fabricated link for a preview. Best-effort —
          // a failure here never fails the real campaign-creation call itself.
          .then(() => this.metaSync.linkCampaignListing(tenantId, campaignId, body.listingId))
          .catch((caught: unknown) => {
            this.logger.warn(
              `CampaignsService.createPropertyCampaign(${campaignId}): linkCampaignListing failed, continuing: ${caught instanceof Error ? caught.message : String(caught)}`,
            );
          });
      }

      return result;
    } catch (error) {
      await this.activityLogger.fail(activityId, error);
      throw error;
    }
  }

  /**
   * AAOS-SAMANTHA-LLM-AD-COPY — real, best-effort multi-ad publish: one real Meta Ad per
   * `creativePackage.copyVariants` entry, all in the SAME real `adSetId` just created by
   * `createPropertyCampaign` — real Meta-native multi-ad testing (multiple ads sharing one AdSet's
   * budget, never Nx spend). Every ad reuses the SAME uploaded video/image asset; only the copy
   * text (`primaryText`/`headline`→ad name/`description`) differs per ad.
   *
   * BULK-PUBLISH WIDENING (user-requested scope: "Publish otomatis creative dalam jumlah besar
   * (8-25) langsung ke Meta"): originally hard-capped at exactly 3 (the old fixed A/B/C
   * `copyVariants` shape). Now capped at `MAX_VARIANT_COUNT` (25, `ad-copy-variants.dto.ts`'s own
   * real, documented upper bound) purely as a defensive ceiling — the actual real count published
   * is however many `copyVariants` the caller's `generateProperty({ requestedVariantCount })` call
   * actually produced (which itself can honestly be fewer than requested, or still just 3 for any
   * package generated before this widening, or via the deterministic fallback). Never re-inflates a
   * short real list to hit 25 — this is a ceiling, not a target.
   *
   * REAL, HONEST LIMITS:
   * - Requires `AaosApiConfig.META_PAGE_ID` to be configured (same real requirement
   *   `GoLiveService.execute` already has for any real ad creation) — empty/unset degrades to
   *   real, logged "0 ads created", never a fabricated ad.
   * - Requires a real `https://wa.me/<number>` destination for an IMAGE creative's `link_data.link`
   *   — sourced from the listing's own real `waNumber` (same real field `PropertyCreativeBrief`
   *   already threads through to Kai's prompt), never a placeholder. Missing `waNumber` degrades to
   *   real, logged "0 ads created" for an IMAGE-only package (a VIDEO package's `video_data` does
   *   not need this field, so it can still proceed).
   * - A VIDEO creative needs a real thumbnail image URL (Meta's own requirement) — uses the
   *   package's first `imageUrls` entry when present; a video-only package with zero images
   *   degrades to real, logged "0 ads created" rather than fabricating a thumbnail URL.
   * - The shared video/image asset is uploaded to Meta ONCE (`uploadCreativeAsset.execute`) and
   *   reused across all `createAd` calls — an upload failure is a real, hard stop for this package
   *   (no ad can be created without it), but NEVER fails `createPropertyCampaign` itself: the real
   *   campaign+adset this method's caller already created stays valid regardless.
   * - Each `createAd` call is independently best-effort: a failure logs a warning and the loop
   *   continues to the next variant — one bad ad never blocks the rest of the batch.
   */
  private async publishPropertyAds(
    connector: MetaAdsConnectorContext,
    adAccountId: AdAccountId,
    adSetId: string,
    waNumber: string | undefined,
    creativePackage: StoredCreativePackage,
    accessToken: string,
  ): Promise<readonly string[]> {
    const pageId = this.config.META_PAGE_ID;
    if (pageId.length === 0) {
      this.logger.warn(
        `CampaignsService.publishPropertyAds(${creativePackage.id}): META_PAGE_ID is not configured — skipping real ad creation.`,
      );
      return [];
    }
    const variants = creativePackage.copyVariants.slice(0, MAX_VARIANT_COUNT);
    if (variants.length === 0) {
      this.logger.warn(
        `CampaignsService.publishPropertyAds(${creativePackage.id}): package has no copyVariants — skipping real ad creation.`,
      );
      return [];
    }

    const firstImageUrl = creativePackage.imageUrls[0];
    const hasVideo = creativePackage.videoUrl !== undefined;

    let baseCreative:
      | { readonly kind: "VIDEO"; readonly videoId: string; readonly thumbnailUrl: string }
      | { readonly kind: "IMAGE"; readonly imageHash: string; readonly linkUrl: string }
      | undefined;
    try {
      if (hasVideo) {
        if (firstImageUrl === undefined) {
          this.logger.warn(
            `CampaignsService.publishPropertyAds(${creativePackage.id}): video package has no image to use as a real Meta thumbnail — skipping real ad creation.`,
          );
          return [];
        }
        const uploaded = await connector.uploadCreativeAsset.execute({
          adAccountId,
          assetType: "VIDEO",
          hostedUrl: creativePackage.videoUrl as string,
          accessToken,
        });
        if (!uploaded.ok) {
          throw uploaded.error;
        }
        baseCreative = {
          kind: "VIDEO",
          videoId: uploaded.value.assetId,
          thumbnailUrl: firstImageUrl,
        };
      } else {
        if (firstImageUrl === undefined) {
          this.logger.warn(
            `CampaignsService.publishPropertyAds(${creativePackage.id}): package has no image/video asset — skipping real ad creation.`,
          );
          return [];
        }
        if (waNumber === undefined || waNumber.length === 0) {
          this.logger.warn(
            `CampaignsService.publishPropertyAds(${creativePackage.id}): listing has no real waNumber — cannot build a real WhatsApp link, skipping real ad creation.`,
          );
          return [];
        }
        const uploaded = await connector.uploadCreativeAsset.execute({
          adAccountId,
          assetType: "IMAGE",
          hostedUrl: firstImageUrl,
          accessToken,
        });
        if (!uploaded.ok) {
          throw uploaded.error;
        }
        baseCreative = {
          kind: "IMAGE",
          imageHash: uploaded.value.assetId,
          linkUrl: `https://wa.me/${waNumber.replace(/[^\d]/g, "")}`,
        };
      }
    } catch (caught) {
      this.logger.warn(
        `CampaignsService.publishPropertyAds(${creativePackage.id}): uploading the shared creative asset failed — skipping real ad creation: ${caught instanceof Error ? caught.message : String(caught)}`,
      );
      return [];
    }

    const adIds: string[] = [];
    for (const variant of variants) {
      try {
        const creative: CreateAdCreativeSpec =
          baseCreative.kind === "VIDEO"
            ? {
                kind: "VIDEO",
                videoId: baseCreative.videoId,
                thumbnailUrl: baseCreative.thumbnailUrl,
                message: variant.primaryText,
                callToActionType: "WHATSAPP_MESSAGE",
                ...(variant.description !== undefined ? { description: variant.description } : {}),
              }
            : {
                kind: "IMAGE",
                imageHash: baseCreative.imageHash,
                linkUrl: baseCreative.linkUrl,
                message: variant.primaryText,
                callToActionType: "WHATSAPP_MESSAGE",
                ...(variant.description !== undefined ? { description: variant.description } : {}),
              };
        const created = await connector.createAd.execute({
          adAccountId,
          adSetId,
          name: `${creativePackage.title} · ${variant.variantLabel}`,
          pageId,
          creative,
          accessToken,
        });
        if (!created.ok) {
          throw created.error;
        }
        adIds.push(created.value.adId);
      } catch (caught) {
        this.logger.warn(
          `CampaignsService.publishPropertyAds(${creativePackage.id}): createAd failed for variant "${variant.variantLabel}", continuing with the remaining variants: ${caught instanceof Error ? caught.message : String(caught)}`,
        );
      }
    }
    return adIds;
  }

  /**
   * `restructureCampaign` (Samantha Andromeda-Aware Campaign System, Sprint 1) — the real
   * DEV-simulate/LIVE-execute gate around `RestructureCampaign` (`@aos/meta-ads-connector`),
   * mirroring `createPropertyCampaign`'s own `modeGuard.executeOrSimulate` shape exactly.
   *
   * SAFETY: this method has exactly ONE real caller anywhere in this codebase —
   * `PendingActionsService.approve()`'s `RESTRUCTURE_CAMPAIGN` branch (a human's real Approve
   * click on an already-enqueued `pending_agent_actions` row). It is NEVER called from
   * `SchedulerService`/any detection path directly — see `RestructureCampaign`'s own class doc and
   * `pending-actions.service.spec.ts`'s "SAFETY DEFAULT" test for the explicit proof.
   *
   * DEV mode makes ZERO real Meta calls (`simulateFn` never touches `connector`) and returns an
   * honest `{ simulated: true }` with no paused-ad-set ids — same "never fabricate an id" discipline
   * `createPropertyCampaign`'s own DEV path establishes. LIVE mode calls the real
   * `connector.restructureCampaign.execute`, which is itself internally best-effort per ad set (see
   * that class's own doc) — a partial failure (some ad sets paused, others not) is reported
   * honestly via `pausedAdSetIds`/`failedAdSetIds`, never silently swallowed into a fabricated
   * all-success result.
   */
  async restructureCampaign(
    tenantId: string,
    request: RestructureCampaignRequest,
    correlationId: string,
  ): Promise<RestructureCampaignResponseDto> {
    const connectorResult = await this.connectorRegistry.resolve(tenantId);
    if (!connectorResult.ok) {
      throw connectorResult.error;
    }
    const connector = connectorResult.value;

    const mode = await this.modeGuard.resolveMode(tenantId);
    const activityId = await this.activityLogger.start({
      tenantId,
      agent: "SAMANTHA",
      actionType: "RESTRUCTURE_CAMPAIGN",
      mode,
      loopId: correlationId,
      input: {
        campaignId: request.campaignId,
        proposedKeepAdSetId: request.proposedKeepAdSetId,
        proposedPauseAdSetIds: request.proposedPauseAdSetIds,
      },
    });

    try {
      const result = await this.modeGuard.executeOrSimulate<RestructureCampaignResponseDto>(
        tenantId,
        async () => {
          const executed = await connector.restructureCampaign.execute({
            campaignId: request.campaignId,
            adSetIdsToPause: request.proposedPauseAdSetIds,
            accessToken: connector.accessToken,
          });
          return {
            campaignId: request.campaignId,
            simulated: false,
            pausedAdSetIds: executed.pausedAdSets
              .filter((paused) => paused.ok)
              .map((paused) => paused.adSetId),
            failedAdSetIds: executed.pausedAdSets
              .filter((paused) => !paused.ok)
              .map((paused) => paused.adSetId),
          };
        },
        () =>
          Promise.resolve({
            campaignId: request.campaignId,
            simulated: true,
            note:
              "DEV mode — real Meta ad-set pause / budget consolidation was not performed; no " +
              "ad set was actually touched on Meta.",
          }),
      );

      await this.activityLogger.complete(activityId, {
        status: result.simulated ? "SIMULATED" : "SUCCESS",
        ...(result.simulated ? { devPreview: result } : { output: result }),
      });

      return result;
    } catch (error) {
      await this.activityLogger.fail(activityId, error);
      throw error;
    }
  }
}
