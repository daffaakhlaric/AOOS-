import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { LlmModule } from "../llm/llm.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { SosmedPublishingService } from "./application/sosmed-publishing.service.js";
import { ScheduledPostRepository } from "./infrastructure/scheduled-post.repository.js";
import { SosmedController } from "./sosmed.controller.js";

/**
 * `modules/sosmed` (AAOS-SOSMED-AUTOMATION Phase 1-2) — new module for Tamara's organic social
 * media automation. `LlmModule` is imported (not re-provided) so `SosmedController` injects the
 * SAME real `LlmService` `LlmController`'s `/api/v1/llm/*` endpoints use — one Tamara
 * implementation, same precedent `SimulationModule` already establishes.
 *
 * `ScheduledPostRepository` is provided here (built from the shared `SUPABASE_CLIENT`, same
 * pattern as `LookalikeModule`'s `MetaAudienceRepository`) even though no controller endpoint uses
 * it yet — it is the stable foundation a later phase's Content Studio/Post Manager endpoints build
 * on. No `sosmed_accounts` repository is provided (coordinator note #2 — no OAuth flow exists yet
 * to populate it safely).
 *
 * `SosmedPublishingService` (Phase 2) is provided here for the same reason, wrapping
 * `@aos/meta-organic-connector`'s real Meta Graph API publishing client — also not yet wired to a
 * controller endpoint, since every real publish endpoint needs a per-tenant access-token lookup
 * that doesn't safely exist until Phase 4's OAuth flow. See `SosmedPublishingService`'s docstring.
 */
@Module({
  imports: [LlmModule],
  controllers: [SosmedController],
  providers: [
    ApiKeyGuard,
    SosmedPublishingService,
    {
      provide: ScheduledPostRepository,
      useFactory: (client: SupabaseClientLike): ScheduledPostRepository =>
        new ScheduledPostRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
})
export class SosmedModule {}
