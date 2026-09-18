import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { HotLeadDefinitionsModule } from "../hot-lead-definitions/hot-lead-definitions.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { MetricSnapshotModule } from "../metric-snapshot/metric-snapshot.module.js";

import { GrowthObjectivesController } from "./growth-objectives.controller.js";
import { GrowthObjectivesService } from "./growth-objectives.service.js";
import { GrowthMetricsRepository } from "./infrastructure/growth-metrics.repository.js";
import { GrowthObjectiveCampaignsRepository } from "./infrastructure/growth-objective-campaigns.repository.js";
import { GrowthObjectiveRepository } from "./infrastructure/growth-objective.repository.js";

/**
 * `modules/growth-objectives` (EYVRA — SAMANTHA V2, Phase 1 Part A/B). Builds
 * `GrowthObjectiveRepository`/`GrowthMetricsRepository` from the shared `SUPABASE_CLIENT` via
 * `useFactory`, same "each module composes its own instance of a shared repository class over one
 * shared connection" pattern `SuperadminModule`'s `TenantRepository` provider establishes.
 *
 * Phase 1 Part B's `analyze()` needs `HotLeadDefinitionsService` (to load the tenant's Hot Lead
 * definition) and `MetricSnapshotService` (for the CPL benchmark) — both modules are imported here.
 * Checked for circularity before wiring: neither `hot-lead-definitions` nor `metric-snapshot`
 * imports anything from `growth-objectives` anywhere in their own module/service/controller files —
 * both are safe, one-directional dependencies.
 *
 * Phase 7's `pacing()` reuses the SAME already-imported `MetricSnapshotModule` (its two new
 * `getCampaignSpendForRange`/`getAccountSpendForRange` methods, no new module import needed) plus a
 * new `GrowthObjectiveCampaignsRepository`, wired via `useFactory` over the same shared
 * `SUPABASE_CLIENT`, same pattern as `GrowthMetricsRepository` right above it.
 */
@Module({
  imports: [HotLeadDefinitionsModule, MetricSnapshotModule],
  controllers: [GrowthObjectivesController],
  providers: [
    GrowthObjectivesService,
    ApiKeyGuard,
    {
      provide: GrowthObjectiveRepository,
      useFactory: (client: SupabaseClientLike): GrowthObjectiveRepository =>
        new GrowthObjectiveRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: GrowthMetricsRepository,
      useFactory: (client: SupabaseClientLike): GrowthMetricsRepository =>
        new GrowthMetricsRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: GrowthObjectiveCampaignsRepository,
      useFactory: (client: SupabaseClientLike): GrowthObjectiveCampaignsRepository =>
        new GrowthObjectiveCampaignsRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [GrowthObjectivesService],
})
export class GrowthObjectivesModule {}
