import type { SupabaseClientLike } from "@aos/lead-store";
import { GoogleTrendsService, SeasonalCalendarService } from "@aos/meta-ads-agent";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ListingRepository } from "../listings/infrastructure/listing.repository.js";
import { LlmModule } from "../llm/llm.module.js";
import { MarketIntelligenceModule } from "../market-intelligence/market-intelligence.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { AdTenantIndexRepository } from "../meta-ads/infrastructure/ad-tenant-index.repository.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import { CompetitorPageRepository } from "./infrastructure/competitor-page.repository.js";
import { IntelligenceSignalsRepository } from "./infrastructure/intelligence-signals.repository.js";
import { IntelligenceController } from "./intelligence.controller.js";
import { IntelligenceService } from "./intelligence.service.js";

/**
 * `modules/intelligence` (AAOS-SAMANTHA-INTELLIGENCE-LAYER Phase 4) — mirrors
 * `SchedulerModule`/`ListingsModule`'s wiring: Supabase-backed repositories built from the shared
 * `SUPABASE_CLIENT`, with `AAOS_API_CONFIG`/`LEAD_STORE`/`LEAD_STORE_CLOSING_REPOSITORY` injected
 * from `AppModule.forRoot`'s global provider set.
 *
 * `TenantRepository`/`ListingRepository` are each composed as their OWN instance here (not
 * imported cross-module), same "each module builds its own instance of a shared repository class
 * over one shared connection" precedent `ListingsModule`'s own doc already establishes for
 * `TenantRepository` vs. `SuperadminModule`.
 *
 * `SeasonalCalendarService`/`GoogleTrendsService` are real, plain `@aos/meta-ads-agent` classes
 * (not Nest-decorated) — provided here via `useFactory` so `IntelligenceService` can inject them
 * like any other provider, same pattern `LlmModule` already uses for `OpenAiClient`/rate
 * limiter/cache.
 *
 * `LlmModule` is imported (not re-provided) so `IntelligenceService` can inject the SAME real
 * `LlmService` every other Samantha feature in this app already uses for
 * `LlmService.campaignStrategy` — one Samantha LLM implementation, not two.
 *
 * `MarketIntelligenceModule` is imported (not re-provided), AAOS LOOP UPGRADE Sprint 7 Prompt 18 —
 * so `IntelligenceService.refresh` can read the SAME real, already-composed
 * `MarketIntelligenceService`'s latest persisted `market_signals` row and thread it into
 * `LlmService.campaignStrategy`'s context as real, additive `marketSignals` (see
 * `IntelligenceService.buildMarketSignalsContext`'s own doc) — never a second, parallel
 * aggregation.
 *
 * `IntelligenceService` is exported so `SchedulerModule` can inject it for the
 * `SAMANTHA_INTELLIGENCE_REFRESH` Kalender handler, and `DAILY_DIGEST`'s own extension, without a
 * second, parallel composition.
 */
@Module({
  imports: [LlmModule, MarketIntelligenceModule],
  controllers: [IntelligenceController],
  providers: [
    IntelligenceService,
    ApiKeyGuard,
    {
      provide: TenantRepository,
      useFactory: (client: SupabaseClientLike): TenantRepository => new TenantRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: ListingRepository,
      useFactory: (client: SupabaseClientLike): ListingRepository => new ListingRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: IntelligenceSignalsRepository,
      useFactory: (client: SupabaseClientLike): IntelligenceSignalsRepository =>
        new IntelligenceSignalsRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: CompetitorPageRepository,
      useFactory: (client: SupabaseClientLike): CompetitorPageRepository =>
        new CompetitorPageRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: SeasonalCalendarService,
      useFactory: (): SeasonalCalendarService => new SeasonalCalendarService(),
    },
    {
      provide: GoogleTrendsService,
      useFactory: (): GoogleTrendsService => new GoogleTrendsService(),
    },
    {
      provide: AdTenantIndexRepository,
      useFactory: (client: SupabaseClientLike): AdTenantIndexRepository =>
        new AdTenantIndexRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [IntelligenceService],
})
export class IntelligenceModule {}
