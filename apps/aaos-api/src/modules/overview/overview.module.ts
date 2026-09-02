import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ActivityLogModule } from "../activity-log/activity-log.module.js";
import { JudgeResultRepository } from "../ai-judge/infrastructure/judge-result.repository.js";
import { LeadsModule } from "../leads/leads.module.js";
import { LlmModule } from "../llm/llm.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { MetaAdsModule } from "../meta-ads/meta-ads.module.js";
import { ObjectiveModule } from "../objective/objective.module.js";
import { RecyclingModule } from "../recycling/recycling.module.js";

import { OverviewController } from "./overview.controller.js";
import { OverviewService } from "./overview.service.js";

/**
 * `modules/overview` (AAOS Overview Monitor Phase O1) — imports every module whose real service
 * this new aggregate reuses IN-PROCESS (`LeadsModule`/`MetaAdsModule`/`ObjectiveModule`/
 * `RecyclingModule`/`ActivityLogModule`/`LlmModule`, each already exporting the exact service this
 * module needs — see each of their own doc comments for the newly-added `exports: [...]` this
 * phase required), never a second, parallel implementation of any of them. `JudgeResultRepository`
 * is composed here from the shared `SUPABASE_CLIENT`, the SAME "each consumer composes its own
 * instance of a shared repository class over one shared connection" pattern `AiJudgeModule` already
 * establishes for this exact repository class (not re-exported by `AiJudgeModule`, which has no
 * controller of its own to expose it through — building a second instance here over the same
 * shared client is the honest, established precedent, not a duplicated dependency).
 */
@Module({
  imports: [
    LeadsModule,
    MetaAdsModule,
    ObjectiveModule,
    RecyclingModule,
    ActivityLogModule,
    LlmModule,
  ],
  controllers: [OverviewController],
  providers: [
    OverviewService,
    ApiKeyGuard,
    {
      provide: JudgeResultRepository,
      useFactory: (client: SupabaseClientLike): JudgeResultRepository =>
        new JudgeResultRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
})
export class OverviewModule {}
