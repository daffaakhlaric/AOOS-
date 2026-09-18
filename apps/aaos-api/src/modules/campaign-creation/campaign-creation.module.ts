import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ActivityLogModule } from "../activity-log/activity-log.module.js";
import { GrowthObjectivesModule } from "../growth-objectives/growth-objectives.module.js";
import { ListingsModule } from "../listings/listings.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { ModeGuardModule } from "../mode-guard/mode-guard.module.js";

import { CampaignCreationController } from "./campaign-creation.controller.js";
import { CampaignCreationService } from "./campaign-creation.service.js";
import { CampaignCreationRepository } from "./infrastructure/campaign-creation.repository.js";

/**
 * `modules/campaign-creation` (EYVRA — SAMANTHA V2 Phase 25, PROMPT 32/33/35 + Phase 26, PROMPT
 * 36/37). Imports `ListingsModule`/`GrowthObjectivesModule` purely to reuse their already-exported
 * real `ListingsService.getById`/`GrowthObjectivesService.getById` (unchanged since Phase 25).
 *
 * Phase 26 additions: `CampaignCreationRepository` (built from the shared `SUPABASE_CLIENT`, same
 * "each module composes its own instance of a shared repository class over one shared connection"
 * pattern `SimulationModule`/`GrowthObjectivesModule` already establish) persists the real
 * idempotency ledger (`058_campaign_creation_requests.sql`). `ModeGuardModule`/`ActivityLogModule`
 * are imported for the SAME real DEV/LIVE gate + audit-trail discipline every other real
 * Meta-mutating module (`CampaignsModule`) already uses — both are documented "small, standalone"
 * modules specifically so a consumer like this one never risks a circular import.
 * `META_ADS_CONNECTOR_REGISTRY`/`AAOS_API_CONFIG` are NOT provided here — both come from
 * `AppModule.forRoot`'s global provider set, same as `GoLiveModule`/`CampaignsModule`. Checked for
 * circularity before wiring: neither `listings`/`growth-objectives`/`mode-guard`/`activity-log`
 * imports anything from this module.
 */
@Module({
  imports: [ListingsModule, GrowthObjectivesModule, ModeGuardModule, ActivityLogModule],
  controllers: [CampaignCreationController],
  providers: [
    CampaignCreationService,
    ApiKeyGuard,
    {
      provide: CampaignCreationRepository,
      useFactory: (client: SupabaseClientLike): CampaignCreationRepository =>
        new CampaignCreationRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [CampaignCreationService],
})
export class CampaignCreationModule {}
