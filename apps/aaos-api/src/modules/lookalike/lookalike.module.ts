import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { MetaAudienceRepository } from "./infrastructure/meta-audience.repository.js";
import { LookalikeController } from "./lookalike.controller.js";
import { LookalikeService } from "./lookalike.service.js";

/**
 * `modules/lookalike` (AAOS-ABTESTING-LOOKALIKE Part 2) — mirrors `AbTestingModule`'s wiring: 1
 * Supabase-backed repository built from the shared `SUPABASE_CLIENT`, with
 * `AAOS_API_CONFIG`/`META_ADS_CONNECTOR`/`LEAD_STORE` injected from `AppModule.forRoot`'s global
 * provider set.
 *
 * `LookalikeService` is exported so `SchedulerModule` can inject it for the `LOOKALIKE_SYNC`
 * Kalender handler, the same pattern `AbTestingModule` already establishes for `AB_TEST_CHECK`.
 */
@Module({
  controllers: [LookalikeController],
  providers: [
    LookalikeService,
    ApiKeyGuard,
    {
      provide: MetaAudienceRepository,
      useFactory: (client: SupabaseClientLike): MetaAudienceRepository =>
        new MetaAudienceRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [LookalikeService],
})
export class LookalikeModule {}
