import { Module } from "@nestjs/common";

import { GrowthObjectivesModule } from "../growth-objectives/growth-objectives.module.js";
import { ListingsModule } from "../listings/listings.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { CampaignCreationController } from "./campaign-creation.controller.js";
import { CampaignCreationService } from "./campaign-creation.service.js";

/**
 * `modules/campaign-creation` (EYVRA — SAMANTHA V2 Phase 25, PROMPT 32/33/35). Imports
 * `ListingsModule` and `GrowthObjectivesModule` purely to reuse their already-exported real
 * `ListingsService.getById`/`GrowthObjectivesService.getById` — no new repository, no new Supabase
 * table, this phase is entirely stateless (see `campaign-blueprint.ts`'s header doc). Checked for
 * circularity before wiring: neither `listings` nor `growth-objectives` imports anything from this
 * module.
 */
@Module({
  imports: [ListingsModule, GrowthObjectivesModule],
  controllers: [CampaignCreationController],
  providers: [CampaignCreationService, ApiKeyGuard],
  exports: [CampaignCreationService],
})
export class CampaignCreationModule {}
