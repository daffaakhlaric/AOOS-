import { Module } from "@nestjs/common";

import { ActivityLogModule } from "../activity-log/activity-log.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { ModeGuardModule } from "../mode-guard/mode-guard.module.js";

import { CampaignsController } from "./campaigns.controller.js";
import { CampaignsService } from "./campaigns.service.js";

@Module({
  imports: [ModeGuardModule, ActivityLogModule],
  controllers: [CampaignsController],
  providers: [CampaignsService, ApiKeyGuard],
})
export class CampaignsModule {}
