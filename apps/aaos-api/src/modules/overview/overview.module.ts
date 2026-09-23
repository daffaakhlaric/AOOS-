import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ActivityLogModule } from "../activity-log/activity-log.module.js";
import { JudgeResultRepository } from "../ai-judge/infrastructure/judge-result.repository.js";
import { LeadsModule } from "../leads/leads.module.js";
import { LlmModule } from "../llm/llm.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { MetaAdsModule } from "../meta-ads/meta-ads.module.js";
import { MetaSyncModule } from "../meta-sync/meta-sync.module.js";
import { ObjectiveModule } from "../objective/objective.module.js";
import { RecyclingModule } from "../recycling/recycling.module.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import { OverviewSnapshotRepository } from "./infrastructure/overview-snapshot.repository.js";
import { OverviewSnapshotCronService } from "./overview-snapshot-cron.service.js";
import { OverviewController } from "./overview.controller.js";
import { OverviewService } from "./overview.service.js";

/**
 * `modules/overview` (AAOS Overview Monitor Phase O1) — imports every module whose real service
 * this new aggregate reuses IN-PROCESS (`LeadsModule`/`MetaAdsModule`/`ObjectiveModule`/
 * `RecyclingModule`/`ActivityLogModule`/`LlmModule`, each already exporting the exact service this
 * module needs — see each of their own doc comments for the newly-added `exports: [...]` this
 * phase required), never a second, parallel implementation of any of them. `JudgeResultRepository`
 * is composed here from the shared `SUPABASE_CLIENT`, the SAME "each consumer composes its own
 * instance of a shared repository class over one shared connection" pattern `AiJudgeModule` already
 * establishes for this exact repository class (not re-exported by `AiJudgeModule`, which has no
 * controller of its own to expose it through — building a second instance here over the same
 * shared client is the honest, established precedent, not a duplicated dependency).
 *
 * EYVRA SAMANTHA V2 + KAI V2 Phase 56 addition — `OverviewSnapshotCronService` (daily
 * `overview_daily_snapshots` writer, `GET /api/v1/overview/timeseries`'s real backing data) plus
 * its own `OverviewSnapshotRepository`/`TenantRepository` (module-local Supabase-backed instances
 * over the SAME shared `SUPABASE_CLIENT`, mirroring `MetaSyncModule`'s own established pattern for
 * this exact "sweep every real tenant" shape — see that module's own doc).
 */
@Module({
  imports: [
    LeadsModule,
    MetaAdsModule,
    MetaSyncModule,
    ObjectiveModule,
    RecyclingModule,
    ActivityLogModule,
    LlmModule,
  ],
  controllers: [OverviewController],
  providers: [
    OverviewService,
    OverviewSnapshotCronService,
    ApiKeyGuard,
    {
      provide: JudgeResultRepository,
      useFactory: (client: SupabaseClientLike): JudgeResultRepository =>
        new JudgeResultRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: OverviewSnapshotRepository,
      useFactory: (client: SupabaseClientLike): OverviewSnapshotRepository =>
        new OverviewSnapshotRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    // `OverviewSnapshotCronService`'s own tenant sweep needs the SAME real `TenantRepository` class
    // `MetaSyncModule` already composes for the identical "sweep every real tenant" shape — built
    // module-locally here (over the SAME shared `SUPABASE_CLIENT`), never a second Supabase
    // connection, mirroring `MetaSyncModule`'s own doc for this exact pattern.
    {
      provide: TenantRepository,
      useFactory: (client: SupabaseClientLike): TenantRepository => new TenantRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
})
export class OverviewModule {}
