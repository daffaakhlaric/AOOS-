import { z } from "zod";

import type { CampaignStrategyResponseDto } from "../../llm/dto/campaign-strategy.dto.js";
import type { CompetitorPageRow } from "../infrastructure/competitor-page.repository.js";
import type { IntelligenceSignalsRow } from "../infrastructure/intelligence-signals.repository.js";

// ---------------------------------------------------------------------------------------------
// `GET /api/v1/intelligence/signals`, `POST /api/v1/intelligence/refresh`
// ---------------------------------------------------------------------------------------------

export interface IntelligenceSignalsResponseDto {
  readonly id: string;
  readonly branchId: string | null;
  readonly seasonal: unknown;
  readonly trends: unknown;
  readonly competitor: unknown;
  readonly inventory: unknown;
  readonly leadProfile: unknown;
  readonly closing: unknown;
  /** AAOS-META-MCP-BONUS-TOOLS (Tool 4) — real `EmqReport`-backed CAPI health, or an honest `available:false` shape. See `IntelligenceService.buildCapiHealthContext`. */
  readonly capiHealth: unknown;
  /** AAOS-META-MCP-BONUS-TOOLS (Tool 1) — real `FREQUENCY_HIGH` anomalies only, or an honest `available:false` shape. See `IntelligenceService.buildAnomalyContext`. */
  readonly anomalies: unknown;
  readonly campaignStrategy: CampaignStrategyResponseDto | undefined;
  readonly digestText: string | null;
  readonly generatedAt: string;
}

export function toIntelligenceSignalsResponseDto(
  row: IntelligenceSignalsRow,
): IntelligenceSignalsResponseDto {
  return {
    id: row.id,
    branchId: row.branch_id,
    seasonal: row.seasonal_data,
    trends: row.trends_data,
    competitor: row.competitor_data,
    inventory: row.inventory_data,
    leadProfile: row.lead_profile_data,
    closing: row.closing_data,
    capiHealth: row.capi_health_data,
    anomalies: row.anomaly_data,
    campaignStrategy: row.campaign_strategy as CampaignStrategyResponseDto | undefined,
    digestText: row.digest_text,
    generatedAt: row.generated_at,
  };
}

// ---------------------------------------------------------------------------------------------
// `GET/POST /api/v1/competitors`, `DELETE /api/v1/competitors/:id`
// ---------------------------------------------------------------------------------------------

const IntelVerticalSchema = z.enum(["AUTOMOTIVE", "PROPERTY"]);

/** `POST /api/v1/competitors` body — real, tenant-managed `competitor_pages` config, no hardcoded page IDs anywhere. */
export const CreateCompetitorPageBodySchema = z.object({
  name: z.string().min(1),
  pageId: z.string().min(1),
  vertical: IntelVerticalSchema,
  active: z.boolean().default(true),
});
export type CreateCompetitorPageBodyDto = z.infer<typeof CreateCompetitorPageBodySchema>;

export interface CompetitorPageResponseDto {
  readonly id: string;
  readonly name: string;
  readonly pageId: string;
  readonly vertical: string;
  readonly active: boolean;
  readonly createdAt: string;
}

export function toCompetitorPageResponseDto(row: CompetitorPageRow): CompetitorPageResponseDto {
  return {
    id: row.id,
    name: row.name,
    pageId: row.page_id,
    vertical: row.vertical,
    active: row.active,
    createdAt: row.created_at,
  };
}
