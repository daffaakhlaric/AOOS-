import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";

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
@Module({
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
})
export class MetaAdsModule {}
