import { UnavailableError } from "@aos/errors";
import { AdAccountId, Branch, Funnel, HOUSING_SPECIAL_AD_CATEGORY } from "@aos/meta-ads-connector";
import { Inject, Injectable } from "@nestjs/common";

import type { AaosApiConfig } from "../../config/aaos-api.config.js";
import { AAOS_API_CONFIG, META_ADS_CONNECTOR_REGISTRY } from "../../di-tokens.js";
import { ActivityLogger } from "../activity-log/activity-logger.service.js";
import { ListingsService } from "../listings/listings.service.js";
import { LocationResolverService } from "../location-resolver/location-resolver.service.js";
import type { MetaAdsConnectorRegistry } from "../meta-ads/infrastructure/meta-ads-connector-registry.js";
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
  constructor(
    @Inject(AAOS_API_CONFIG) private readonly config: AaosApiConfig,
    @Inject(META_ADS_CONNECTOR_REGISTRY)
    private readonly connectorRegistry: MetaAdsConnectorRegistry,
    private readonly modeGuard: ModeGuardService,
    private readonly activityLogger: ActivityLogger,
    private readonly listings: ListingsService,
    private readonly locationResolver: LocationResolverService,
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
  async createPropertyCampaign(
    tenantId: string,
    body: CreatePropertyCampaignBodyDto,
    correlationId: string,
  ): Promise<CreatePropertyCampaignResponseDto> {
    const listing = await this.listings.getById(tenantId, body.listingId);

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
          return {
            ...executed.value,
            simulated: false,
            resolvedCities: resolvedLocation.cities,
            matchedCities: propertyTargeting.matchedCities,
            unresolvedCities: propertyTargeting.unresolvedCities,
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
      return result;
    } catch (error) {
      await this.activityLogger.fail(activityId, error);
      throw error;
    }
  }
}
