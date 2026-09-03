import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { AgentConfigModule } from "../agent-config/agent-config.module.js";
import { LlmModule } from "../llm/llm.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { PromptOverrideModule } from "../prompt-override/prompt-override.module.js";
import { SimulationRepository } from "../simulation/infrastructure/simulation.repository.js";

import { LearningProposalRepository } from "./infrastructure/learning-proposal.repository.js";
import { LearningDecisionService } from "./learning-decision.service.js";
import { LearningController } from "./learning.controller.js";
import { LearningService } from "./learning.service.js";

/**
 * `modules/learning` (AAOS Self-Learning AI, Phase B). Builds its OWN `SimulationRepository`
 * instance over the shared `SUPABASE_CLIENT` — same "each module composes its own instance of a
 * shared repository class over one shared connection" pattern `GoLiveModule` already establishes
 * for the exact same class (see that module's own doc: avoids a circular dependency between this
 * module and `SimulationModule`, which is the real IMPORTER of this module — `SimulationModule`
 * needs to inject `LearningService`, so `LearningModule` cannot import `SimulationModule` back).
 *
 * `LlmModule`/`PromptOverrideModule` are imported (not re-provided) so `LearningService` and
 * (Phase C) `LearningDecisionService` inject the SAME real `LlmService`/`PromptOverrideService`
 * every other real consumer uses — one Samantha implementation and one prompt-override
 * resolver/writer, not a second copy of either (coordinator note precedent: "call the real thing,
 * never reimplement it").
 *
 * Phase C additions: `LearningController` (`api/v1/learning*`, the human-approval gate's real
 * HTTP surface) and `LearningDecisionService` (its real Approve/Reject/Rollback logic —
 * `ApiKeyGuard` is provided here for the SAME "each module composes its own copy of a shared
 * stateless guard class" reasoning `GoLiveModule` already documents for the identical guard).
 */
@Module({
  imports: [
    LlmModule,
    PromptOverrideModule,
    // AAOS Self-Improving (Phase SI-1, extended Phase SI-2) — so LearningService can inject the
    // SAME real AgentConfigService/ConfigApplierService/AgentLogicService/LogicApplierService
    // `SchedulerModule`'s consumer uses — one real config/logic resolver/auto-applier, not a second
    // copy of any of them.
    AgentConfigModule,
  ],
  controllers: [LearningController],
  providers: [
    LearningService,
    LearningDecisionService,
    ApiKeyGuard,
    {
      provide: SimulationRepository,
      useFactory: (client: SupabaseClientLike): SimulationRepository =>
        new SimulationRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: LearningProposalRepository,
      useFactory: (client: SupabaseClientLike): LearningProposalRepository =>
        new LearningProposalRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  // `SimulationModule` (Phase B's real caller) injects `LearningService` from
  // `SimulationService.runPipeline`'s real terminal-state point — see that module's own doc.
  exports: [LearningService],
})
export class LearningModule {}
