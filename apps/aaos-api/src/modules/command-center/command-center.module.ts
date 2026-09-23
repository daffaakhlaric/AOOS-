import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { AbTestVariantRepository } from "../abtesting/infrastructure/ab-test-variant.repository.js";
import { CampaignHealthModule } from "../campaign-health/campaign-health.module.js";
import { CreativeMemoryModule } from "../creative-memory/creative-memory.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { MetaAdsModule } from "../meta-ads/meta-ads.module.js";

import { CommandCenterController } from "./command-center.controller.js";
import { CommandCenterService } from "./command-center.service.js";

/**
 * `modules/command-center` (EYVRA Samantha V2 Command Center real-data-wiring fix). Imports
 * `MetaAdsModule`/`CampaignHealthModule`/`CreativeMemoryModule` to reuse their already-exported
 * `MetaAdsService`/`CampaignHealthService`/`CreativeMemoryService` — zero I/O/repository of its
 * own, same "imports a module to reuse its exported service(s)" pattern `OpportunitiesModule`
 * already establishes for 2 of these same 3 modules.
 */
@Module({
  imports: [MetaAdsModule, CampaignHealthModule, CreativeMemoryModule],
  controllers: [CommandCenterController],
  providers: [
    CommandCenterService,
    ApiKeyGuard,
    /**
     * AAOS Command Center creative thumbnails — `AbTestVariantRepository` composed here from the
     * shared `SUPABASE_CLIENT` rather than importing the whole `AbTestingModule` (which would pull
     * in `CreativePackagesModule`/the Kai generation pipeline just to read one low-volume table).
     * Same "each module composes its own instance of a shared repository class over one shared
     * connection" pattern `AbTestingModule` itself already uses for `AdTenantIndexRepository`, and
     * `CreativeMemoryModule` for `CreativeMemoryRepository`. READ-ONLY here — this module only ever
     * calls `listByTenant`.
     */
    {
      provide: AbTestVariantRepository,
      useFactory: (client: SupabaseClientLike): AbTestVariantRepository =>
        new AbTestVariantRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [CommandCenterService],
})
export class CommandCenterModule {}
