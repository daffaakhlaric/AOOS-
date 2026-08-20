import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { WabaConfigRepository } from "../settings/infrastructure/waba-config.repository.js";
import { SimulationRepository } from "../simulation/infrastructure/simulation.repository.js";

import { GoLiveController } from "./go-live.controller.js";
import { GoLiveService } from "./go-live.service.js";

/**
 * `modules/go-live` (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 4). Builds its OWN
 * `SimulationRepository`/`WabaConfigRepository` instances over the shared `SUPABASE_CLIENT` —
 * same "each module composes its own instance of a shared repository class over one shared
 * connection" pattern `SimulationModule`/`SettingsModule` already establish, not a second
 * connection and not a cross-module DI import (avoids a circular dependency between this module
 * and `SimulationModule`/`SettingsModule`). `META_ADS_CONNECTOR`/`AAOS_API_CONFIG` come from
 * `AppModule.forRoot`'s global provider set.
 */
@Module({
  controllers: [GoLiveController],
  providers: [
    GoLiveService,
    ApiKeyGuard,
    {
      provide: SimulationRepository,
      useFactory: (client: SupabaseClientLike): SimulationRepository =>
        new SimulationRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: WabaConfigRepository,
      useFactory: (client: SupabaseClientLike): WabaConfigRepository =>
        new WabaConfigRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
})
export class GoLiveModule {}
