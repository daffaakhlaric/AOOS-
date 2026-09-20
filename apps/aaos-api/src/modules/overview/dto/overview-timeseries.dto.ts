import { z } from "zod";

/** `GET /api/v1/overview/timeseries` query — `days` bounds how far back to look, same `z.coerce.number().int().min(...).max(...).default(...)` convention `CampaignHistoryQuerySchema` already establishes. Default 30 (the Command Center chart's own real default window); capped at 90 to keep the underlying `overview_daily_snapshots` read bounded, well past this chart's real intended use. */
export const OverviewTimeseriesQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});
export type OverviewTimeseriesQueryDto = z.infer<typeof OverviewTimeseriesQuerySchema>;

/**
 * One real, already-persisted `overview_daily_snapshots` day for this tenant — see
 * `OverviewSnapshotRepository`'s own doc. `totalSpend`/`totalLeads` are the SAME real definitions
 * `OverviewCampaignsSummaryDto.totalSpend`/the Command Center KPI strip's own `totalLeads`
 * (`hot + warm + cold`) already use elsewhere on this page — never a second, differently-defined
 * number, and never a fabricated "CPQL" series (this codebase has no real backing data for that,
 * per `CommandCenterClient.tsx`'s own doc).
 */
export interface OverviewTimeseriesPointDto {
  readonly date: string;
  readonly totalSpend: number;
  readonly totalLeads: number;
}

/**
 * `GET /api/v1/overview/timeseries` response — Command Center "Performance Overview" chart (EYVRA
 * SAMANTHA V2 + KAI V2 Phase 56). `points` is ordered oldest-to-newest, exactly the shape a
 * Tremor `LineChart` needs. An empty (or fewer-than-2-point) array is a real, honest result — never
 * fabricated — for a tenant `OverviewSnapshotCronService` hasn't swept enough real days for yet; the
 * frontend's own honest-degrade rule (fewer than 2 points -> empty state) lives in
 * `CommandCenterClient.tsx`, not here.
 */
export interface OverviewTimeseriesResponseDto {
  readonly tenantId: string;
  readonly points: readonly OverviewTimeseriesPointDto[];
}
