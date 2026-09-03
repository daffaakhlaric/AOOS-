import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { AgentConfigModule } from "../agent-config/agent-config.module.js";
import { AgentRunsModule } from "../agent-runs/agent-runs.module.js";
import { JudgeResultRepository } from "../ai-judge/infrastructure/judge-result.repository.js";
import { JudgeMemoryModule } from "../judge-memory/judge-memory.module.js";
import { LlmModule } from "../llm/llm.module.js";

import { SandboxService } from "./sandbox.service.js";

/**
 * `modules/sandbox` (AAOS Self-Improving, Phase SI-4) — deliberately a SMALL, STANDALONE module,
 * mirroring `modules/overview`'s own real precedent for this exact repository class:
 * `JudgeResultRepository` is composed here from the shared `SUPABASE_CLIENT`, the SAME "each
 * consumer composes its own instance of a shared repository class over one shared connection"
 * pattern `AiJudgeModule`/`OverviewModule` already establish for it (not re-exported by
 * `AiJudgeModule`, which has no controller of its own to expose it through).
 *
 * Imports `AgentRunsModule`/`LlmModule`/`AgentConfigModule`/`JudgeMemoryModule` (none re-provided) so
 * `SandboxService` injects the SAME real `AgentRunsService`/`LlmService`/`AgentConfigService`/
 * `JudgeMemoryService` every other real consumer already uses — one real baseline-run lookup, one
 * real LLM integration, one real config resolver, one real curated-memory builder, never a second
 * copy of any of them.
 *
 * WIRED, AAOS Self-Improving Phase SI-5: `LearningModule` now imports this module so
 * `LearningService.persistProposal` can call `SandboxService.testImprovement` as a real, narrow
 * safety net before auto-applying a `PROMPT_UPDATE` item (see `SandboxService`'s own class doc for
 * exactly what this does and does not gate). No circular-import risk: this module's own imports
 * (`AgentRunsModule`/`LlmModule`/`AgentConfigModule`/`JudgeMemoryModule`) never import
 * `LearningModule` back — `JudgeMemoryModule` in particular deliberately composes its own
 * repositories rather than importing `LearningModule`/`AiJudgeModule` for exactly this reason (see
 * `JudgeMemoryService`'s own class doc).
 */
@Module({
  imports: [AgentRunsModule, LlmModule, AgentConfigModule, JudgeMemoryModule],
  providers: [
    SandboxService,
    {
      provide: JudgeResultRepository,
      useFactory: (client: SupabaseClientLike): JudgeResultRepository =>
        new JudgeResultRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [SandboxService],
})
export class SandboxModule {}
