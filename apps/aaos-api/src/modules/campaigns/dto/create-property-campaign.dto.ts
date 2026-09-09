import { z } from "zod";

/**
 * `POST /api/v1/campaigns/property` body (AAOS EPIC S, Phase S4). Deliberately a SEPARATE schema
 * from `CreateCampaignBodySchema`, not a discriminated union of it — same reasoning K1's
 * `PropertyCreatePackageBodySchema` already documents (`create-property-package.dto.ts`'s own
 * docstring) and Finding 2's real recon: `CreateCampaignBodySchema.branch: z.nativeEnum(Branch)`
 * structurally blocks PROPERTY (there is no PROPERTY equivalent of the AUTOMOTIVE `Branch` enum —
 * `listings.branch_id` is free `TEXT`), and a `z.discriminatedUnion` would force the existing
 * AUTOMOTIVE endpoint's callers to start sending a `vertical`/`kind` literal they never send
 * today, for no real benefit.
 *
 * `listingId` is the real, tenant-scoped `listings.id` this campaign is generated from — resolved
 * via `ListingsService.getById` (real 404 for missing/cross-tenant). `adAccountId` is deliberately
 * ABSENT here (unlike `CreateCampaignBodySchema`): this endpoint uses the tenant's first
 * configured Meta ad account (`MetaAdsConnector.adAccountIds[0]`) — a real, documented scope
 * decision (`CampaignsService.createPropertyCampaign`'s own doc), not an oversight; a manager
 * picking among multiple ad accounts for a PROPERTY campaign is not something any real UI needs
 * yet.
 */
export const CreatePropertyCampaignBodySchema = z.object({
  listingId: z.string().trim().min(1),
  /** Optional whole-IDR daily budget override — defaults to `CreateCampaign`'s `DEFAULT_DAILY_BUDGET_IDR` when omitted, same as the AUTOMOTIVE endpoint. */
  dailyBudgetIDR: z.number().int().positive().optional(),
});

export type CreatePropertyCampaignBodyDto = z.infer<typeof CreatePropertyCampaignBodySchema>;

/** One real, matched Meta location for this campaign's `targeting.geo_locations.cities[]` — surfaced in the response so a human reviewer can see exactly which real Meta place each free-text `LocationResolverService` city resolved to. */
export interface MatchedPropertyCity {
  /** The free-text city name `LocationResolverService` produced (`ResolvedLocation.cities[]` entry). */
  readonly query: string;
  /** The real Meta location `key` used in `targeting.geo_locations.cities[].key`. */
  readonly key: string;
  /** Meta's own real display name for the matched location. */
  readonly name: string;
}

/**
 * `POST /api/v1/campaigns/property` response body — same "always PAUSED, `simulated` honestly
 * reflects DEV/LIVE, never a fabricated id" discipline as `CreateCampaignResponseDto`.
 *
 * `resolvedCities` is always present — the real, free-text `ResolvedLocation.cities` this
 * campaign's targeting was built from, regardless of mode. `matchedCities`/`unresolvedCities` are
 * present ONLY for a real LIVE creation (`simulated: false`): DEV mode never calls
 * `SearchAdLocations` (no real Meta location key exists to report), so surfacing empty/fabricated
 * arrays there would misrepresent what DEV mode actually did — `note` carries that explanation
 * instead.
 */
export interface CreatePropertyCampaignResponseDto {
  readonly campaignId?: string;
  readonly adSetId?: string;
  readonly simulated: boolean;
  readonly resolvedCities: readonly string[];
  readonly matchedCities?: readonly MatchedPropertyCity[];
  readonly unresolvedCities?: readonly string[];
  readonly note?: string;
  /**
   * AAOS-SAMANTHA-LLM-AD-COPY — real Meta ad ids created for a matched `creative_packages` row's
   * `copyVariants` (up to 3, one real ad per variant, same AdSet — see `CampaignsService.
   * createPropertyCampaign`'s own doc). Present only for a real LIVE creation (`simulated: false`)
   * that was called with a `creativePackageId` AND actually created at least one real ad — absent
   * (never an empty array) for the manual endpoint (no `creativePackageId`), DEV mode, or a
   * best-effort publish that created zero ads (see `publishPropertyAds`'s own real, honest degrade
   * conditions).
   */
  readonly adIds?: readonly string[];
}
