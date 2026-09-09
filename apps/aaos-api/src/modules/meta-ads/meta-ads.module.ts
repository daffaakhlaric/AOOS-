import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ActivityLogModule } from "../activity-log/activity-log.module.js";
import { LlmModule } from "../llm/llm.module.js";
import { MetaSyncModule } from "../meta-sync/meta-sync.module.js";
import { ModeGuardModule } from "../mode-guard/mode-guard.module.js";

import { ApiKeyGuard } from "./guards/api-key.guard.js";
import { AdTenantIndexRepository } from "./infrastructure/ad-tenant-index.repository.js";
import { MetaAdsController } from "./meta-ads.controller.js";
import { MetaAdsService } from "./meta-ads.service.js";

/**
 * AAOS-MULTI-TENANT-PHASE1C addition: `AdTenantIndexRepository` built here (not injected from
 * `AppModule.forRoot`, which composes no repository of its own) from the shared `SUPABASE_CLIENT`
 * — same "each module composes its own instance of a shared repository class over one shared
 * connection" pattern `SchedulerModule`/`IntelligenceModule`/`AbTestingModule` each establish for
 * their own repositories.
 */
/** `MetaAdsService` is exported (AAOS Overview Monitor Phase O1) so `OverviewModule` can inject the SAME real `pullCampaigns`/`getHeatmap` this module's own controller already uses — never a second, parallel Meta pull path. */
@Module({
  imports: [
    ModeGuardModule,
    ActivityLogModule,
    LlmModule,
    // EYVRA-META-OAUTH-WHATSAPP-SETUP Sprint 4 — real, best-effort `MetaSyncService.syncCampaign`
    // hook after `executeVerdict` (a real campaign/adset/ad UPDATE action). See `MetaAdsService`'s
    // own doc for the call site.
    MetaSyncModule,
  ],
  controllers: [MetaAdsController],
  providers: [
    MetaAdsService,
    ApiKeyGuard,
    {
      provide: AdTenantIndexRepository,
      useFactory: (client: SupabaseClientLike): AdTenantIndexRepository =>
        new AdTenantIndexRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [MetaAdsService],
})
export class MetaAdsModule {}
