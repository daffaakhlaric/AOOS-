import { Module } from "@nestjs/common";

import { CampaignHealthModule } from "../campaign-health/campaign-health.module.js";
import { CreativeMemoryModule } from "../creative-memory/creative-memory.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { OpportunitiesController } from "./opportunities.controller.js";
import { OpportunitiesService } from "./opportunities.service.js";

/**
 * `modules/opportunities` (EYVRA — SAMANTHA V2 Phase 9, Opportunity Engine). Imports
 * `CampaignHealthModule`/`CreativeMemoryModule` to reuse their already-exported
 * `CampaignHealthService`/`CreativeMemoryService` — zero I/O/repository of its own, same
 * "imports a module to reuse its exported service" pattern `CampaignHealthModule` itself
 * establishes for `MetricSnapshotModule`.
 */
@Module({
  imports: [CampaignHealthModule, CreativeMemoryModule],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService, ApiKeyGuard],
  exports: [OpportunitiesService],
})
export class OpportunitiesModule {}
