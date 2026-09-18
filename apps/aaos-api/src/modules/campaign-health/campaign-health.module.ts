import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { MetricSnapshotModule } from "../metric-snapshot/metric-snapshot.module.js";

import { CampaignHealthController } from "./campaign-health.controller.js";
import { CampaignHealthService } from "./campaign-health.service.js";
import { CampaignAssessmentRepository } from "./infrastructure/campaign-assessment.repository.js";

/**
 * `modules/campaign-health` (EYVRA — SAMANTHA V2 Phase 3 + Phase 6). Imports `MetricSnapshotModule`
 * to reuse its already-exported `MetricSnapshotService`. Phase 6 additionally builds
 * `CampaignAssessmentRepository` from the shared `SUPABASE_CLIENT` via `useFactory`, same "each
 * module composes its own instance of a shared repository class over one shared connection" pattern
 * `GrowthObjectivesModule`/`MetricSnapshotModule` already establish — this module previously had
 * zero I/O of its own beyond what `MetricSnapshotModule` provided; Phase 6 is the first time it
 * gains a real repository/table of its own (`samantha_campaign_assessments`).
 */
@Module({
  imports: [MetricSnapshotModule],
  controllers: [CampaignHealthController],
  providers: [
    CampaignHealthService,
    ApiKeyGuard,
    {
      provide: CampaignAssessmentRepository,
      useFactory: (client: SupabaseClientLike): CampaignAssessmentRepository =>
        new CampaignAssessmentRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [CampaignHealthService],
})
export class CampaignHealthModule {}
