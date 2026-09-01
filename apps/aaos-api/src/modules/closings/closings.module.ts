import { Module } from "@nestjs/common";

import { AgentRunsModule } from "../agent-runs/agent-runs.module.js";
import { AiJudgeModule } from "../ai-judge/ai-judge.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { ClosingsController } from "./closings.controller.js";
import { ClosingsService } from "./closings.service.js";

@Module({
  imports: [AgentRunsModule, AiJudgeModule],
  controllers: [ClosingsController],
  providers: [ClosingsService, ApiKeyGuard],
})
export class ClosingsModule {}
