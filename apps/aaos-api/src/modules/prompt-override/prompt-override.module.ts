import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";

import { PromptOverrideRepository } from "./infrastructure/prompt-override.repository.js";
import { PromptOverrideService } from "./prompt-override.service.js";

/**
 * `modules/prompt-override` (AAOS Self-Learning AI, Phase A) — deliberately a SMALL, STANDALONE
 * module, mirroring `modules/mode-guard`'s `ModeGuardModule` precedent (see that module's class
 * doc): `PromptOverrideService`'s real consumer (`LlmModule`) must never need to import a bigger
 * module just to reach it. `PromptOverrideRepository` is built here from the shared
 * `SUPABASE_CLIENT`, the same "each module composes its own instance of a shared repository class
 * over one shared connection" pattern `ModeGuardModule`/`SettingsModule` each already establish —
 * not a second Supabase connection.
 */
@Module({
  providers: [
    PromptOverrideService,
    {
      provide: PromptOverrideRepository,
      useFactory: (client: SupabaseClientLike): PromptOverrideRepository =>
        new PromptOverrideRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [PromptOverrideService],
})
export class PromptOverrideModule {}
