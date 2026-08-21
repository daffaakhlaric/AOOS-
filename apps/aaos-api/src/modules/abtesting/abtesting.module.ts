import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { CreativePackagesModule } from "../creative-packages/creative-packages.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { AbTestingController } from "./abtesting.controller.js";
import { AbTestingService } from "./abtesting.service.js";
import { AbTestVariantRepository } from "./infrastructure/ab-test-variant.repository.js";
import { AbTestRepository } from "./infrastructure/ab-test.repository.js";

/**
 * `modules/abtesting` (AAOS-ABTESTING-LOOKALIKE) — mirrors `RecyclingModule`/`SchedulerModule`'s
 * wiring: 2 Supabase-backed repositories built from the shared `SUPABASE_CLIENT`, with
 * `AAOS_API_CONFIG`/`META_ADS_CONNECTOR` injected from `AppModule.forRoot`'s global provider set.
 *
 * `CreativePackagesModule` is imported (not re-provided) so `AbTestingService` can inject the SAME
 * real `CreativePackagesService`/Kai pipeline `CreativePackagesController` already uses — one
 * creative-generation implementation, not two (coordinator note section 2).
 *
 * `AbTestingService` is exported so `SchedulerModule` can inject it for the `AB_TEST_CHECK`
 * Kalender handler, the same pattern `RecyclingModule` already establishes for `RECYCLING_RUN`.
 */
@Module({
  imports: [CreativePackagesModule],
  controllers: [AbTestingController],
  providers: [
    AbTestingService,
    ApiKeyGuard,
    {
      provide: AbTestRepository,
      useFactory: (client: SupabaseClientLike): AbTestRepository => new AbTestRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: AbTestVariantRepository,
      useFactory: (client: SupabaseClientLike): AbTestVariantRepository =>
        new AbTestVariantRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [AbTestingService],
})
export class AbTestingModule {}
