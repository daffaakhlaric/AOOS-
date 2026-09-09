import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import { MetaSyncRepository } from "./infrastructure/meta-sync.repository.js";
import { MetaSyncCronService } from "./meta-sync-cron.service.js";
import { MetaSyncService } from "./meta-sync.service.js";

/**
 * `modules/meta-sync` (EYVRA-META-OAUTH-WHATSAPP-SETUP Sprint 4). No controller — this module is
 * pure background sync (`MetaSyncCronService`'s two real `@Cron` sweeps) plus the exported
 * `MetaSyncService` real callers (`CampaignsModule`, `MetaAdsModule`) inject directly for their own
 * best-effort realtime hook after a real campaign create/update action. `MetaSyncService` itself
 * resolves `MetaAdsConnectorRegistry` via the SAME global `META_ADS_CONNECTOR_REGISTRY` token
 * `app.module.ts`'s composition root already provides (`global: true`, per `AppModule.forRoot`) —
 * not re-composed here, so there is only ever the one real registry instance/cache in the process,
 * same discipline `MetaOAuthModule`/`CampaignsModule` already follow for that token.
 *
 * `TenantRepository`/`SUPABASE_CLIENT`-backed `MetaSyncRepository` are both built module-locally
 * from the shared `SUPABASE_CLIENT` global token — same "each module composes its own instance of a
 * shared repository class over one shared connection" pattern `MetaOAuthModule`/`SettingsModule`
 * already establish, never a second Supabase connection.
 */
@Module({
  providers: [
    MetaSyncService,
    MetaSyncCronService,
    {
      provide: TenantRepository,
      useFactory: (client: SupabaseClientLike): TenantRepository => new TenantRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: MetaSyncRepository,
      useFactory: (client: SupabaseClientLike): MetaSyncRepository =>
        new MetaSyncRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [MetaSyncService],
})
export class MetaSyncModule {}
