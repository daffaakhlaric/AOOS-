import { Module } from "@nestjs/common";

import { ActivityLogModule } from "../activity-log/activity-log.module.js";
import { CreativePackagesModule } from "../creative-packages/creative-packages.module.js";
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
 *
 * AAOS-SAMANTHA-LLM-AD-COPY: `CreativePackagesModule` added so `CampaignsService.
 * createPropertyCampaign` can inject the real `CreativePackagesService` (to read a matched
 * package's Kai/Kie-AI-generated media + LLM copy variants for the real multi-ad publish). No
 * circular-import risk: `CreativePackagesModule` imports `ListingsModule`/`ModeGuardModule`/
 * `ActivityLogModule`/`AgentRunsModule`/`AiJudgeModule`/`AuditLogModule`/`LlmModule` — none of
 * which import `CampaignsModule` (verified directly).
 */
@Module({
  imports: [
    ModeGuardModule,
    ActivityLogModule,
    ListingsModule,
    LocationResolverModule,
    CreativePackagesModule,
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService, ApiKeyGuard],
  // AAOS EPIC S, Phase S5 — SchedulerModule imports this module to inject the SAME real
  // CampaignsService.createPropertyCampaign CampaignsController already uses for the manual
  // POST /api/v1/campaigns/property endpoint, rather than composing a second, independent way to
  // create a real Meta PROPERTY campaign.
  exports: [CampaignsService],
})
export class CampaignsModule {}
