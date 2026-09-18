import { CampaignObjective } from "@aos/meta-ads-connector";

import type {
  AreaStrategy,
  GrowthObjectiveResponseDto,
} from "../../growth-objectives/dto/growth-objective.dto.js";
import type { ListingResponseDto } from "../../listings/dto/listing.dto.js";

import type { ListingReadinessResult } from "./listing-readiness.js";

/**
 * EYVRA — SAMANTHA V2 Phase 25 (PROMPT 32 — Campaign Blueprint). Pure, deterministic "what a new
 * campaign for this Growth Objective + Listing SHOULD look like" — a PLAN, never an execution (no
 * Meta API call anywhere in this file, no I/O at all). Built entirely from real, already-computed
 * data this codebase actually has:
 *   - `GrowthObjectiveResponseDto` (Phase 1A/7/8) — real `metric`/`areaStrategy`/`automationMode`,
 *     and (when `/analyze` has already run) the real `forecast.reverseFunnel.estimatedMediaSpendIdr`
 *     this file derives a projected daily budget from.
 *   - `ListingResponseDto` (`modules/listings`) — real `waNumber`/`city`/`province`/`kecamatan`/
 *     `photos`.
 *   - `ListingReadinessResult` (this phase's own `listing-readiness.ts`) — folded into `warnings`
 *     so a blueprint built for a not-ready listing stays honest about it, never silently proceeds.
 *
 * HONEST DEGRADE: every field the raw spec's PROMPT 32 JSON template imagines but this codebase has
 * no real data source for (bid strategy, placements, tracking, launch/monitoring plan detail,
 * concept count, Kai brief linkage) is either omitted, an honest empty value (`[]`/`{}`), or `null`
 * — never a fabricated default. `warnings` makes every gap caller-visible.
 *
 * NOT PERSISTED: this phase is stateless by design — no new Supabase table, no `blueprintId`
 * generated here (a domain function must stay deterministic; a real id would need `crypto.randomUUID()`,
 * which the calling service — not this pure function — is responsible for if a future phase needs
 * one). PROMPT 36 (Safe Campaign Creation) is the first phase that would actually persist/execute
 * anything derived from a blueprint.
 */

const CAMPAIGN_BUYING_TYPE = "AUCTION";
const CAMPAIGN_INITIAL_STATUS = "PAUSED";
/** Same real Meta optimization goal `GoLiveService`'s own `OPTIMIZATION_GOAL_LEAD_GENERATION` constant already uses for its real WhatsApp lead campaigns — kept as a separate literal here (not imported) since `go-live.service.ts` does not export it, but the VALUE is intentionally identical, not a parallel invented one. */
const OPTIMIZATION_GOAL_LEAD_GENERATION = "LEAD_GENERATION";

export type CampaignGoal = "GENERATE_HOT_LEADS";

/** `growthObjective.metric` -> PROMPT 31's `goal` vocabulary. Exhaustive switch — a future second real `GrowthObjectiveMetric` value will fail to compile here until this mapping is extended, same discipline `campaign-health.ts`'s severity switches already follow. */
function mapMetricToGoal(metric: GrowthObjectiveResponseDto["metric"]): CampaignGoal {
  switch (metric) {
    case "HOT_LEADS":
      return "GENERATE_HOT_LEADS";
  }
}

export interface CampaignBlueprintGeo {
  readonly city?: string;
  readonly province?: string;
  readonly kecamatan?: string;
}

export interface CampaignBlueprintCampaign {
  readonly name: string;
  readonly objective: CampaignObjective;
  readonly buyingType: typeof CAMPAIGN_BUYING_TYPE;
  readonly initialStatus: typeof CAMPAIGN_INITIAL_STATUS;
}

export interface CampaignBlueprintAdSet {
  readonly name: string;
  /** Projected daily budget in IDR — `undefined` when the objective hasn't been analyzed yet (no `forecast`) or `daysRemaining` wasn't provided; see `warnings` for why. */
  readonly dailyBudgetIdr?: number;
  readonly optimizationGoal: typeof OPTIMIZATION_GOAL_LEAD_GENERATION;
  /** Reused directly from `growthObjective.areaStrategy` — never re-decided here. */
  readonly audienceStrategy: AreaStrategy;
  readonly geo: CampaignBlueprintGeo;
  /** Always `[]` — no real placement-selection logic exists in this codebase yet. */
  readonly placements: readonly string[];
}

export interface CampaignBlueprintCreativeStrategy {
  /** `["IMAGE"]` when the listing has real usable photos, `[]` otherwise. Never includes `"VIDEO"`/`"CAROUSEL"` — no real video field exists on a listing today (see `listing-readiness.ts`'s header doc). */
  readonly formats: readonly "IMAGE"[];
  /** Always `null` — Kai brief linkage is deferred to a later phase, never fabricated. */
  readonly kaiBriefId: null;
}

export interface CampaignBlueprint {
  readonly tenantId: string;
  readonly growthObjectiveId: string;
  readonly listingId: string;
  readonly goal: CampaignGoal;
  /** `"WHATSAPP"` — the only destination this codebase has a real, implemented ad-creation path for (see `GoLiveService`). `undefined` when the listing has no real WhatsApp number. */
  readonly destination?: "WHATSAPP";
  readonly campaign: CampaignBlueprintCampaign;
  readonly adSet: CampaignBlueprintAdSet;
  readonly creativeStrategy: CampaignBlueprintCreativeStrategy;
  /** Every honest gap found while building this blueprint — missing budget projection, missing geo, missing photos, missing WhatsApp number, and any real `ListingReadinessResult.blockingIssues`. Indonesian, specific. */
  readonly warnings: readonly string[];
}

export interface CampaignBlueprintInput {
  readonly tenantId: string;
  readonly growthObjective: GrowthObjectiveResponseDto;
  readonly listing: ListingResponseDto;
  readonly listingReadiness: ListingReadinessResult;
  /** Real days remaining until `growthObjective.endDate`, already clamped to `>= 0` by the caller (same computation `GrowthObjectivesService.analyze` performs) — this function stays pure and never reads the wall clock itself. `undefined` when the caller couldn't/didn't compute one. */
  readonly daysRemaining?: number;
}

function buildGeo(listing: ListingResponseDto): CampaignBlueprintGeo {
  return {
    ...(listing.city !== undefined ? { city: listing.city } : {}),
    ...(listing.province !== undefined ? { province: listing.province } : {}),
    ...(listing.kecamatan !== undefined ? { kecamatan: listing.kecamatan } : {}),
  };
}

function buildCampaignName(growthObjectiveId: string, listing: ListingResponseDto): string {
  const shortTitle = listing.title.slice(0, 30).trim();
  return `Samantha-${listing.propertyType}-${shortTitle}-${growthObjectiveId.slice(0, 8)}`;
}

export function buildCampaignBlueprint(input: CampaignBlueprintInput): CampaignBlueprint {
  const { tenantId, growthObjective, listing, listingReadiness, daysRemaining } = input;
  const warnings: string[] = [...listingReadiness.blockingIssues];

  const hasWhatsapp = listing.waNumber !== undefined && listing.waNumber.length > 0;
  if (!hasWhatsapp) {
    warnings.push(
      "Tidak ada nomor WhatsApp pada listing ini — destination belum bisa ditentukan (satu-satunya destination yang punya jalur pembuatan ad nyata di codebase ini).",
    );
  }

  const geo = buildGeo(listing);
  if (Object.keys(geo).length === 0) {
    warnings.push(
      "Listing belum punya kota/provinsi/kecamatan — geo targeting blueprint ini kosong.",
    );
  }

  const formats: readonly "IMAGE"[] = listing.photos.length > 0 ? ["IMAGE"] : [];
  if (formats.length === 0) {
    warnings.push(
      "Listing belum punya foto usable — creative strategy blueprint ini tidak menyertakan format apapun.",
    );
  }

  let dailyBudgetIdr: number | undefined;
  const estimatedMediaSpend = growthObjective.forecast?.reverseFunnel.estimatedMediaSpendIdr;
  if (estimatedMediaSpend === undefined) {
    warnings.push(
      "Growth objective belum dianalisa (POST /growth-objectives/:id/analyze) — budget harian belum bisa diproyeksikan.",
    );
  } else if (daysRemaining === undefined || daysRemaining <= 0) {
    warnings.push(
      "Sisa hari objective ini belum diketahui atau sudah 0 — budget harian belum bisa diproyeksikan dari estimasi media spend.",
    );
  } else {
    dailyBudgetIdr = Math.round(estimatedMediaSpend.expected / daysRemaining);
  }

  return {
    tenantId,
    growthObjectiveId: growthObjective.id,
    listingId: listing.id,
    goal: mapMetricToGoal(growthObjective.metric),
    ...(hasWhatsapp ? { destination: "WHATSAPP" as const } : {}),
    campaign: {
      name: buildCampaignName(growthObjective.id, listing),
      objective: CampaignObjective.OUTCOME_LEADS,
      buyingType: CAMPAIGN_BUYING_TYPE,
      initialStatus: CAMPAIGN_INITIAL_STATUS,
    },
    adSet: {
      name: `${buildCampaignName(growthObjective.id, listing)}-adset`,
      ...(dailyBudgetIdr !== undefined ? { dailyBudgetIdr } : {}),
      optimizationGoal: OPTIMIZATION_GOAL_LEAD_GENERATION,
      audienceStrategy: growthObjective.areaStrategy,
      geo,
      placements: [],
    },
    creativeStrategy: {
      formats,
      kaiBriefId: null,
    },
    warnings,
  };
}
