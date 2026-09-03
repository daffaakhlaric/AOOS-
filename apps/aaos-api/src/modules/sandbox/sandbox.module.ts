import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { AgentConfigModule } from "../agent-config/agent-config.module.js";
import { AgentRunsModule } from "../agent-runs/agent-runs.module.js";
import { JudgeResultRepository } from "../ai-judge/infrastructure/judge-result.repository.js";
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
 * Imports `AgentRunsModule`/`LlmModule`/`AgentConfigModule` (none re-provided) so `SandboxService`
 * injects the SAME real `AgentRunsService`/`LlmService`/`AgentConfigService` every other real
 * consumer already uses — one real baseline-run lookup, one real LLM integration, one real config
 * resolver, never a second copy of any of them.
 *
 * NOT imported by `AppModule` in this phase — a deliberate, documented scope decision (see
 * `SandboxService`'s own class doc): nothing in this codebase calls `SandboxService.testImprovement`
 * yet (PROMPT_UPDATE auto-apply-behind-sandbox is left for Phase SI-5). Registering this module
 * under `AppModule` today would wire a real NestJS module with zero real callers — dead weight in
 * the running app's DI graph for no honest benefit; Vitest unit tests exercise `SandboxService`
 * directly (`new SandboxService(...)`, same convention this whole codebase's specs already use),
 * so this module's own composition is still exercised by `sandbox.module.spec.ts`. Phase SI-5 wires
 * this module in wherever its real sandbox-gated auto-apply caller lives.
 */
@Module({
  imports: [AgentRunsModule, LlmModule, AgentConfigModule],
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
