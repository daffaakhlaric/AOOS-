import { Module } from "@nestjs/common";

import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { MetricSnapshotModule } from "../metric-snapshot/metric-snapshot.module.js";

import { CampaignHealthController } from "./campaign-health.controller.js";
import { CampaignHealthService } from "./campaign-health.service.js";

/**
 * `modules/campaign-health` (EYVRA — SAMANTHA V2 Phase 3). Imports `MetricSnapshotModule` to reuse
 * its already-exported `MetricSnapshotService` — this module has zero I/O of its own (no new
 * repository, no new `SUPABASE_CLIENT` factory) beyond what `MetricSnapshotModule` already
 * provides, unlike `MetricSnapshotModule`/`CreativeMemoryModule` which each compose their own
 * repository.
 */
@Module({
  imports: [MetricSnapshotModule],
  controllers: [CampaignHealthController],
  providers: [CampaignHealthService, ApiKeyGuard],
  exports: [CampaignHealthService],
})
export class CampaignHealthModule {}
