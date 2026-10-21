import { Module } from "@nestjs/common";

import { ActivityLogModule } from "../activity-log/activity-log.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { ModeGuardModule } from "../mode-guard/mode-guard.module.js";

import { GrowthPolicyController } from "./growth-policy.controller.js";
import { GrowthPolicyService } from "./growth-policy.service.js";
@Module({
  imports: [ActivityLogModule, ModeGuardModule],
  controllers: [GrowthPolicyController],
  providers: [GrowthPolicyService, ApiKeyGuard],
  exports: [GrowthPolicyService],
})
export class GrowthPolicyModule {}
