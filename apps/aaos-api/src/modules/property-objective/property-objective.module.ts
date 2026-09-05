import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { MetaAdsModule } from "../meta-ads/meta-ads.module.js";

import { PropertyObjectiveController } from "./property-objective.controller.js";
import { PropertyObjectiveRepository } from "./property-objective.repository.js";
import { PropertyObjectiveService } from "./property-objective.service.js";

/**
 * `modules/property-objective` (Phase O1) — additive: registered in `app.module.ts` alongside the
 * existing `ObjectiveModule`, never modifying it. Imports `MetaAdsModule` (exported `MetaAdsService`,
 * AAOS Overview Monitor Phase O1's own export) so `PropertyObjectiveService.getBudgetSuggestion` can
 * inject the SAME real `pullCampaigns` `MetaAdsController`/`OverviewService` already use — never a
 * second, parallel Meta pull path. `PropertyObjectiveRepository` is composed here from the shared
 * `SUPABASE_CLIENT`, same "each module composes its own instance of a shared repository class over
 * one shared connection" pattern `PendingActionsModule`/`OverviewModule` already establish.
 */
@Module({
  imports: [MetaAdsModule],
  controllers: [PropertyObjectiveController],
  providers: [
    PropertyObjectiveService,
    ApiKeyGuard,
    {
      provide: PropertyObjectiveRepository,
      useFactory: (client: SupabaseClientLike): PropertyObjectiveRepository =>
        new PropertyObjectiveRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  // AAOS LOOP UPGRADE, Sprint 6 Prompt 15 — exported so `SchedulerModule` can inject the SAME real
  // `PropertyObjectiveService` for `runPropertyCampaignTriggerCheck`'s business-context-aware
  // reasoning text (see that method's own doc) — never a second, parallel objective read path.
  exports: [PropertyObjectiveService],
})
export class PropertyObjectiveModule {}
