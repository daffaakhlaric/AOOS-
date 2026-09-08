import type { SupabaseClientLike } from "@aos/lead-store";
import { GoogleTrendsService } from "@aos/meta-ads-agent";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { CompetitorPageRepository } from "../intelligence/infrastructure/competitor-page.repository.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import { MarketSignalsRepository } from "./infrastructure/market-signals.repository.js";
import { MarketIntelligenceController } from "./market-intelligence.controller.js";
import { MarketIntelligenceService } from "./market-intelligence.service.js";

/**
 * `modules/market-intelligence` (AAOS LOOP UPGRADE, Sprint 7 Prompt 18) — mirrors
 * `IntelligenceModule`'s own wiring exactly: Supabase-backed repositories built from the shared
 * `SUPABASE_CLIENT`, `AAOS_API_CONFIG` injected from `AppModule.forRoot`'s global provider set.
 *
 * `TenantRepository`/`CompetitorPageRepository` are each composed as their OWN instance here (not
 * imported cross-module) — same "each module builds its own instance of a shared repository class
 * over one shared connection" precedent `IntelligenceModule`'s own doc establishes for
 * `TenantRepository`/`ListingRepository`. `CompetitorPageRepository`'s CLASS is imported from
 * `modules/intelligence` (a plain, non-Nest-decorated repository class, same as `ListingRepository`
 * being imported cross-module elsewhere) — reused rather than duplicated, since `competitor_pages`
 * is a single real table owned by that module, not re-forked here.
 *
 * `GoogleTrendsService` is a real, plain `@aos/meta-ads-agent` class (not Nest-decorated) —
 * provided here via `useFactory`, same pattern `IntelligenceModule` already uses. Deliberately a
 * SEPARATE instance from `IntelligenceModule`'s own `GoogleTrendsService` provider (each Nest
 * module gets its own DI container scope) — this means the two modules' circuit breakers are
 * independent; an honest, minor scope note, not a functional problem (both wrap the SAME real
 * external Google Trends endpoint with the SAME real degrade discipline).
 *
 * `MarketIntelligenceService` is exported so `SchedulerModule` can inject it for the
 * `MARKET_INTELLIGENCE_REFRESH` Kalender handler.
 */
@Module({
  controllers: [MarketIntelligenceController],
  providers: [
    MarketIntelligenceService,
    ApiKeyGuard,
    {
      provide: TenantRepository,
      useFactory: (client: SupabaseClientLike): TenantRepository => new TenantRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: CompetitorPageRepository,
      useFactory: (client: SupabaseClientLike): CompetitorPageRepository =>
        new CompetitorPageRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: MarketSignalsRepository,
      useFactory: (client: SupabaseClientLike): MarketSignalsRepository =>
        new MarketSignalsRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: GoogleTrendsService,
      useFactory: (): GoogleTrendsService => new GoogleTrendsService(),
    },
  ],
  exports: [MarketIntelligenceService],
})
export class MarketIntelligenceModule {}
