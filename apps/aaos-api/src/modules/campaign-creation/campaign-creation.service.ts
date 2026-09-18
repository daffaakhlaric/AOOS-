import { Injectable } from "@nestjs/common";

import { GrowthObjectivesService } from "../growth-objectives/growth-objectives.service.js";
import { ListingsService } from "../listings/listings.service.js";

import { buildCampaignBlueprint } from "./domain/campaign-blueprint.js";
import { assessCampaignPreflight } from "./domain/campaign-preflight.js";
import { assessListingReadiness } from "./domain/listing-readiness.js";
import type {
  CampaignBlueprintResponseDto,
  CampaignPreflightResponseDto,
  ListingReadinessResponseDto,
} from "./dto/campaign-creation.dto.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * `modules/campaign-creation` — EYVRA SAMANTHA V2 Phase 25 (PROMPT 32/33/35). Orchestrates the
 * three pure domain functions this phase adds over already-real data from `ListingsService` and
 * `GrowthObjectivesService` — never mutates anything, never calls Meta. 100% planning/assessment,
 * same discipline this whole session's `campaign-health`/`growth-objectives` read-model services
 * already follow.
 */
@Injectable()
export class CampaignCreationService {
  constructor(
    private readonly listings: ListingsService,
    private readonly growthObjectives: GrowthObjectivesService,
  ) {}

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

    return { growthObjectiveId, listingId, blueprint };
  }

  async getPreflight(
    tenantId: string,
    growthObjectiveId: string,
    listingId: string,
  ): Promise<CampaignPreflightResponseDto> {
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

    return { growthObjectiveId, listingId, preflight };
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
