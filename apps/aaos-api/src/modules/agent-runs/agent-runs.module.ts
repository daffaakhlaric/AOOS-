import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";

import { AgentRunsService } from "./agent-runs.service.js";
import { AgentRunRepository } from "./infrastructure/agent-run.repository.js";

/**
 * `modules/agent-runs` (AAOS-AI-JUDGE-SELF-IMPROVING, Phase J1) — deliberately a SMALL, STANDALONE
 * module, mirroring `modules/activity-log`'s own composition exactly: `AgentRunRepository` is
 * built here from the shared `SUPABASE_CLIENT`, the SAME "each module composes its own instance of
 * a shared repository class over one shared connection" pattern `ActivityLogModule` establishes.
 * No controller — this table has no real read caller yet (Phase J2/J3 territory), only a real
 * write path.
 */
@Module({
  providers: [
    AgentRunsService,
    {
      provide: AgentRunRepository,
      useFactory: (client: SupabaseClientLike): AgentRunRepository =>
        new AgentRunRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [AgentRunsService],
})
export class AgentRunsModule {}
