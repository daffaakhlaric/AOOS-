import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { MetaInterestRepository } from "./infrastructure/meta-interest.repository.js";
import { MetaInterestsController } from "./meta-interests.controller.js";
import { MetaInterestsService } from "./meta-interests.service.js";

/**
 * `modules/meta-interests` (AAOS-SIMULASI-TARGETING) — mirrors `SimulationModule`/
 * `CreativePackagesModule`'s wiring exactly: a Supabase-backed repository built from the shared
 * `SUPABASE_CLIENT`, with `META_ADS_CONNECTOR`/`AAOS_API_CONFIG` injected from `AppModule.forRoot`'s
 * global provider set (one composed Meta connector for the whole app, not a second one).
 *
 * `MetaInterestRepository` is exported so `SimulationModule` can read the real stored candidate
 * interests during its TAMARA stage without composing a second repository over the same table.
 */
@Module({
  controllers: [MetaInterestsController],
  providers: [
    MetaInterestsService,
    ApiKeyGuard,
    {
      provide: MetaInterestRepository,
      useFactory: (client: SupabaseClientLike): MetaInterestRepository =>
        new MetaInterestRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [MetaInterestRepository],
})
export class MetaInterestsModule {}
