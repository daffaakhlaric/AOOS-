import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { AgentRunsModule } from "../agent-runs/agent-runs.module.js";
import { LlmModule } from "../llm/llm.module.js";

import { AiJudgeService } from "./ai-judge.service.js";
import { JudgeResultRepository } from "./infrastructure/judge-result.repository.js";

/**
 * `modules/ai-judge` (AAOS-AI-JUDGE-SELF-IMPROVING, Phase J2) — imports `AgentRunsModule` (not
 * re-provided) so `AiJudgeService` can inject the SAME real `AgentRunsService` J1's 3 real call
 * sites already use to insert `agent_runs` rows, and `LlmModule` (not re-provided) so it can inject
 * the SAME real `LlmService` every other module already shares — one composed LLM integration for
 * the whole app, never a second one. `JudgeResultRepository` is composed here from the shared
 * `SUPABASE_CLIENT`, the SAME "each module composes its own instance of a shared repository class
 * over one shared connection" pattern `AgentRunsModule`/`ActivityLogModule` already establish. No
 * controller — `judge_results` has no real read caller yet (J3/dashboard territory), only a real
 * write path via `AiJudgeService.judgeRun`.
 */
@Module({
  imports: [AgentRunsModule, LlmModule],
  providers: [
    AiJudgeService,
    {
      provide: JudgeResultRepository,
      useFactory: (client: SupabaseClientLike): JudgeResultRepository =>
        new JudgeResultRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [AiJudgeService],
})
export class AiJudgeModule {}
