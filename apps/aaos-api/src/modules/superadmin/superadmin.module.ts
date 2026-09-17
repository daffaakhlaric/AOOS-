import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { CampaignsModule } from "../campaigns/campaigns.module.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";
import { WabaConfigRepository } from "../settings/infrastructure/waba-config.repository.js";

import { SystemWebhookConfigRepository } from "./infrastructure/system-webhook-config.repository.js";
import { TenantRepository } from "./infrastructure/tenant.repository.js";
import { SuperadminController } from "./superadmin.controller.js";
import { SuperadminService } from "./superadmin.service.js";

/**
 * `modules/superadmin` (AAOS-MULTI-TENANT-SUPERADMIN-PROPERTY Phase 1) — mirrors `SalesModule`'s
 * wiring: `TenantRepository`/`WabaConfigRepository` built from the shared `SUPABASE_CLIENT`,
 * `SUPABASE_AUTH_ADMIN`/`AAOS_API_CONFIG` injected from `AppModule.forRoot`'s global provider set
 * (one Supabase Auth Admin client for the whole app, not a second one).
 *
 * `WabaConfigRepository` is provided here (not imported from `SettingsModule`) to avoid a
 * circular module dependency — both modules need it, so each composes its own instance from the
 * SAME shared `SUPABASE_CLIENT`, exactly like `SalesHumanRepository`/other per-feature
 * repositories already do; this is a stateless query object over one shared connection, not a
 * second data store.
 */
@Module({
  imports: [
    // Campaign->Listing Mapping backfill — real `CampaignsService.backfillListingLinks` trigger
    // for pre-existing campaigns, exposed on this controller since it's a privileged, tenant-scoped
    // maintenance action (same `ApiKeyGuard` perimeter every endpoint here already sits behind).
    CampaignsModule,
  ],
  controllers: [SuperadminController],
  providers: [
    SuperadminService,
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
    // AAOS-SETTINGS-WEBHOOK-CONFIG (Part C) — the real `GET/PUT /api/v1/superadmin/webhook-config`
    // endpoints' persistence, same "each consumer composes its own instance of a shared repository
    // class over one shared connection" pattern as `TenantRepository`/`WabaConfigRepository` above.
    // Deliberately NOT `WebhookSecretsService` itself — that lives in its own small, standalone
    // `modules/webhook-config/` (see its own class doc) precisely so `WebhookModule`/
    // `WhatsAppWebhookModule` never need to import THIS module to reach it.
    {
      provide: SystemWebhookConfigRepository,
      useFactory: (client: SupabaseClientLike): SystemWebhookConfigRepository =>
        new SystemWebhookConfigRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [TenantRepository],
})
export class SuperadminModule {}
