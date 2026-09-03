import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { JudgeResultRepository } from "../ai-judge/infrastructure/judge-result.repository.js";
import { LearningProposalRepository } from "../learning/infrastructure/learning-proposal.repository.js";

import { JudgeMemoryService } from "./judge-memory.service.js";

/**
 * `modules/judge-memory` (AAOS Self-Improving, Phase SI-5) — deliberately a SMALL, STANDALONE
 * module, composing its OWN `JudgeResultRepository`/`LearningProposalRepository` instances over the
 * shared `SUPABASE_CLIENT` (the SAME "each module composes its own instance of a shared repository
 * class over one shared connection" pattern `SandboxModule` already establishes for
 * `JudgeResultRepository` specifically) rather than importing `AiJudgeModule`/`LearningModule` — see
 * `JudgeMemoryService`'s own class doc for the real circular-import risk this avoids
 * (`AiJudgeModule` -> `LearningModule` -> `SandboxModule`, and this phase now wires `SandboxModule`
 * to need judge memory too).
 *
 * Imported by `AiJudgeModule` (replacing that service's own inline memory-building) and by
 * `SandboxModule` (replacing its own inline, duplicated `buildMemory` — see each service's own
 * updated doc) — one real, shared curated-memory builder, never two copies of the same aggregation
 * logic.
 */
@Module({
  providers: [
    JudgeMemoryService,
    {
      provide: JudgeResultRepository,
      useFactory: (client: SupabaseClientLike): JudgeResultRepository =>
        new JudgeResultRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: LearningProposalRepository,
      useFactory: (client: SupabaseClientLike): LearningProposalRepository =>
        new LearningProposalRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [JudgeMemoryService],
})
export class JudgeMemoryModule {}
