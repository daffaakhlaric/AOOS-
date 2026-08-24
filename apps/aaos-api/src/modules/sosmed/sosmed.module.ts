import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { LlmModule } from "../llm/llm.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { SalesHumanRepository } from "../sales/infrastructure/sales-human.repository.js";

import { PendingAccessTokenStore } from "./application/pending-access-token-store.js";
import { SosmedOAuthService } from "./application/sosmed-oauth.service.js";
import { SosmedPostsService } from "./application/sosmed-posts.service.js";
import { SosmedPublishingService } from "./application/sosmed-publishing.service.js";
import { ScheduledPostRepository } from "./infrastructure/scheduled-post.repository.js";
import { SosmedAccountRepository } from "./infrastructure/sosmed-account.repository.js";
import { SosmedConnectTokenRepository } from "./infrastructure/sosmed-connect-token.repository.js";
import { OAuthStateStore } from "./oauth/oauth-state-store.js";
import { SosmedOAuthController } from "./sosmed-oauth.controller.js";
import { SosmedSchedulerService } from "./sosmed-scheduler.service.js";
import { SosmedController } from "./sosmed.controller.js";

/**
 * `modules/sosmed` (AAOS-SOSMED-AUTOMATION Phase 1-3) — new module for Tamara's organic social
 * media automation. `LlmModule` is imported (not re-provided) so `SosmedController` injects the
 * SAME real `LlmService` `LlmController`'s `/api/v1/llm/*` endpoints use — one Tamara
 * implementation, same precedent `SimulationModule` already establishes.
 *
 * `ScheduledPostRepository` is provided here (built from the shared `SUPABASE_CLIENT`, same
 * pattern as `LookalikeModule`'s `MetaAudienceRepository`) — Phase 1 built it unwired, Phase 3
 * wires it into `SosmedPostsService`/`SosmedSchedulerService`. No `sosmed_accounts` repository is
 * provided (coordinator note #2 — no OAuth flow exists yet to populate it safely).
 *
 * `SosmedPublishingService` (Phase 2) wraps `@aos/meta-organic-connector`'s real Meta Graph API
 * publishing client. `SosmedPostsService`/`SosmedSchedulerService` (Phase 3) are the first real
 * callers — `PendingAccessTokenStore` is the in-process-only credential hand-off between them (see
 * its own docstring for why it deliberately never touches Supabase).
 *
 * Phase 4 adds `SosmedOAuthController`/`SosmedOAuthService` — the real OAuth flows (official
 * account + sales personal-account connect-link) and the FIRST real reads/writes of
 * `sosmed_accounts`. `SosmedAccountRepository`/`SosmedConnectTokenRepository` are built from the
 * SAME shared `SUPABASE_CLIENT` every other repository in this app uses (no second connection).
 * `SalesHumanRepository` is built here too, a second stateless instance wrapping the same shared
 * client — mirrors how other modules build their own repository instances rather than importing
 * `SalesModule` back (which would be circular; `SalesModule` does not export it).
 */
@Module({
  imports: [LlmModule],
  controllers: [SosmedController, SosmedOAuthController],
  providers: [
    ApiKeyGuard,
    SosmedPublishingService,
    SosmedPostsService,
    SosmedSchedulerService,
    SosmedOAuthService,
    PendingAccessTokenStore,
    OAuthStateStore,
    {
      provide: ScheduledPostRepository,
      useFactory: (client: SupabaseClientLike): ScheduledPostRepository =>
        new ScheduledPostRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: SosmedAccountRepository,
      useFactory: (client: SupabaseClientLike): SosmedAccountRepository =>
        new SosmedAccountRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: SosmedConnectTokenRepository,
      useFactory: (client: SupabaseClientLike): SosmedConnectTokenRepository =>
        new SosmedConnectTokenRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: SalesHumanRepository,
      useFactory: (client: SupabaseClientLike): SalesHumanRepository =>
        new SalesHumanRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
})
export class SosmedModule {}
