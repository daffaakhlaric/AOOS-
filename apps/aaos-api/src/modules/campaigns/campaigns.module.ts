import { Module } from "@nestjs/common";

import { ActivityLogModule } from "../activity-log/activity-log.module.js";
import { ListingsModule } from "../listings/listings.module.js";
import { LocationResolverModule } from "../location-resolver/location-resolver.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { ModeGuardModule } from "../mode-guard/mode-guard.module.js";

import { CampaignsController } from "./campaigns.controller.js";
import { CampaignsService } from "./campaigns.service.js";

/**
 * AAOS EPIC S, Phase S4 — imports `ListingsModule`/`LocationResolverModule` (both `exports:`
 * their real service already, not re-provided) so `CampaignsService.createPropertyCampaign` can
 * inject the SAME real `ListingsService.getById`/`LocationResolverService.resolve` every other
 * PROPERTY-aware module in this session reuses — never a second listing lookup or a second
 * location-resolution path.
 */
@Module({
  imports: [ModeGuardModule, ActivityLogModule, ListingsModule, LocationResolverModule],
  controllers: [CampaignsController],
  providers: [CampaignsService, ApiKeyGuard],
})
export class CampaignsModule {}
