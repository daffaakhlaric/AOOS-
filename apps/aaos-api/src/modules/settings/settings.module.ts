import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import { WabaConfigRepository } from "./infrastructure/waba-config.repository.js";
import { SettingsController } from "./settings.controller.js";
import { SettingsService } from "./settings.service.js";

/**
 * `modules/settings` (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 1) — the tenant Settings page's
 * backend. `TenantRepository`/`WabaConfigRepository` built from the shared `SUPABASE_CLIENT`, same
 * "each module composes its own instance of a shared repository class over one shared connection"
 * pattern `SuperadminModule` already establishes (see that module's doc for why this isn't a
 * circular-dependency risk). `META_ADS_CONNECTOR`/`AAOS_API_CONFIG` injected from
 * `AppModule.forRoot`'s global provider set.
 */
@Module({
  controllers: [SettingsController],
  providers: [
    SettingsService,
    ApiKeyGuard,
    {
      provide: TenantRepository,
      useFactory: (client: SupabaseClientLike): TenantRepository => new TenantRepository(client),
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
export class SettingsModule {}
