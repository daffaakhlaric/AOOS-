import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { AbTestingModule } from "../abtesting/abtesting.module.js";
import { ActivityLogModule } from "../activity-log/activity-log.module.js";
import { AgentConfigModule } from "../agent-config/agent-config.module.js";
import { AgentRunsModule } from "../agent-runs/agent-runs.module.js";
import { AiJudgeModule } from "../ai-judge/ai-judge.module.js";
import { CampaignsModule } from "../campaigns/campaigns.module.js";
import { IntelligenceModule } from "../intelligence/intelligence.module.js";
import { ListingsModule } from "../listings/listings.module.js";
import { LlmModule } from "../llm/llm.module.js";
import { LookalikeModule } from "../lookalike/lookalike.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { AdTenantIndexRepository } from "../meta-ads/infrastructure/ad-tenant-index.repository.js";
import { ModeGuardModule } from "../mode-guard/mode-guard.module.js";
import { PendingActionsModule } from "../pending-actions/pending-actions.module.js";
import { RecyclingModule } from "../recycling/recycling.module.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import { CalendarEventRepository } from "./infrastructure/calendar-event.repository.js";
import { SchedulerController } from "./scheduler.controller.js";
import { SchedulerService } from "./scheduler.service.js";

/**
 * `modules/scheduler` (AAOS-KALENDER-AKTIVITAS) — mirrors `SimulationModule`/`ScraperModule`'s
 * wiring exactly: a Supabase-backed repository built from the shared `SUPABASE_CLIENT`, with
 * `META_ADS_CONNECTOR`/`MOBIX_SCRAPER_SERVICE`/`OBJECTIVE_ENGINE`/`LEAD_STORE`/`EVENT_PUBLISHER`/
 * `AAOS_API_CONFIG` injected from `AppModule.forRoot`'s global provider set — one composed
 * integration for the whole app, never a second one.
 *
 * `LlmModule` is imported (not re-provided) so `SchedulerService` can inject the SAME real
 * `LlmService` `LlmController`/`SimulationService` already use for `SAMANTHA_ANALYZE` — one
 * Samantha implementation, not two.
 *
 * `RecyclingModule` is imported (not re-provided) the same way, so `SchedulerService` can inject
 * the SAME real `RecyclingService` `RecyclingController` already uses for `RECYCLING_RUN`
 * (AAOS-LEAD-RECYCLING-BROADCAST, coordinator note section 7) — one recycling implementation, not
 * two.
 *
 * `AbTestingModule` is imported the same way, so `SchedulerService` can inject the SAME real
 * `AbTestingService` `AbTestingController` already uses for `AB_TEST_CHECK`
 * (AAOS-ABTESTING-LOOKALIKE Part 1, coordinator note section 5).
 *
 * `LookalikeModule` is imported the same way, so `SchedulerService` can inject the SAME real
 * `LookalikeService` `LookalikeController` already uses for `LOOKALIKE_SYNC`
 * (AAOS-ABTESTING-LOOKALIKE Part 2, coordinator note section 5).
 *
 * `IntelligenceModule` is imported the same way, so `SchedulerService` can inject the SAME real
 * `IntelligenceService` `IntelligenceController` already uses for `SAMANTHA_INTELLIGENCE_REFRESH`
 * (AAOS-SAMANTHA-INTELLIGENCE-LAYER Phase 4, coordinator note section 7), and for the Daily Digest
 * extension.
 *
 * `@nestjs/schedule`'s `ScheduleModule.forRoot()` is registered once, in `app.module.ts`'s
 * `AppModule.forRoot` imports (the composition root every cron-using module ultimately sits
 * under) — not here, to avoid double-registering the scheduler registry if a future module also
 * needs `@Cron`.
 *
 * `TenantRepository` (`docs/PROMPT-AAOS-SCHEDULER-MULTITENANT.md`) is composed the SAME way
 * `SettingsModule`/`SimulationModule`/`IntelligenceModule` already do — its own instance built
 * from the shared `SUPABASE_CLIENT`, not a second connection — so `checkAndRunDueEvents` can list
 * every real tenant instead of reading one static `AAOS_TENANT_ID` default.
 *
 * `CampaignsModule` is imported (not re-provided) the same way, so `SchedulerService` can inject
 * the SAME real `CampaignsService.createPropertyCampaign` `CampaignsController` already uses for
 * the manual `POST /api/v1/campaigns/property` endpoint (AAOS EPIC S, Phase S5) — a real PROPERTY
 * campaign-trigger fires this exact same, single, `ModeGuardService.executeOrSimulate`-gated real
 * creation path, never a second one. `LocationResolverModule` is no longer imported directly here:
 * `createPropertyCampaign` already resolves the target location itself, so this module has no
 * remaining direct `LocationResolverService` consumer of its own (`CampaignsModule` still imports
 * it for its own use).
 */
@Module({
  imports: [
    LlmModule,
    RecyclingModule,
    AbTestingModule,
    LookalikeModule,
    IntelligenceModule,
    ListingsModule,
    ModeGuardModule,
    ActivityLogModule,
    CampaignsModule,
    AgentRunsModule,
    AiJudgeModule,
    // AAOS-OPERATING-MODE-APPROVAL-GATE — so SchedulerService can inject the exported
    // PendingActionsService for its own real enqueue() write path when a tenant's
    // operating_mode is APPROVAL (see that module's own doc).
    PendingActionsModule,
    // AAOS Self-Improving (Phase SI-1) — so SchedulerService can inject the real
    // AgentConfigService for `pause_cpl_multiplier` (see runPropertyCampaignTriggerCheck's own doc).
    AgentConfigModule,
  ],
  controllers: [SchedulerController],
  providers: [
    SchedulerService,
    ApiKeyGuard,
    {
      provide: CalendarEventRepository,
      useFactory: (client: SupabaseClientLike): CalendarEventRepository =>
        new CalendarEventRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: AdTenantIndexRepository,
      useFactory: (client: SupabaseClientLike): AdTenantIndexRepository =>
        new AdTenantIndexRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: TenantRepository,
      useFactory: (client: SupabaseClientLike): TenantRepository => new TenantRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
})
export class SchedulerModule {}
