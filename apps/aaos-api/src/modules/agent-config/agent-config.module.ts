import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";

import { AgentConfigService } from "./agent-config.service.js";
import { ConfigApplierService } from "./config-applier.service.js";
import { AgentConfigRepository } from "./infrastructure/agent-config.repository.js";

/**
 * `modules/agent-config` (AAOS Self-Improving, Phase SI-1) — deliberately a SMALL, STANDALONE
 * module, mirroring `modules/prompt-override`'s `PromptOverrideModule` precedent (see that
 * module's own class doc): `AgentConfigService`'s real consumers (`SchedulerModule`/
 * `LearningModule`) must never need to import a bigger module just to reach it.
 * `AgentConfigRepository` is built here from the shared `SUPABASE_CLIENT`, the same "each module
 * composes its own instance of a shared repository class over one shared connection" pattern
 * `PromptOverrideModule`/`ModeGuardModule` each already establish — not a second Supabase
 * connection.
 *
 * `ConfigApplierService` is provided (and exported) here rather than in `modules/learning` — it
 * depends only on `AgentConfigService` (this module) and `KNOWN_CONFIG_KEYS` (a plain value import
 * from `modules/llm`, not a NestJS module dependency), so it belongs with the config layer it
 * writes to, the same way `PromptOverrideService.applyApproved` (the CONFIG_UPDATE apply path's
 * real PROMPT_UPDATE sibling) lives in `modules/prompt-override`, not `modules/learning`.
 */
@Module({
  providers: [
    AgentConfigService,
    ConfigApplierService,
    {
      provide: AgentConfigRepository,
      useFactory: (client: SupabaseClientLike): AgentConfigRepository =>
        new AgentConfigRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [AgentConfigService, ConfigApplierService],
})
export class AgentConfigModule {}
