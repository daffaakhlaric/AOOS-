import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { TenantRepository } from "../superadmin/infrastructure/tenant.repository.js";

import { ModeGuardService } from "./mode-guard.service.js";

/**
 * `modules/mode-guard` (AAOS-PROPERTY-DEVLIVE-ACTIVITYLOG Phase A) — deliberately a SMALL,
 * STANDALONE module, mirroring `modules/webhook-config`'s `WebhookSecretsService` precedent
 * (see that module's class doc): `ModeGuardService`'s real consumers (`MetaAdsModule`,
 * `CampaignsModule`) must never need to import `SuperadminModule` just to reach a mode check —
 * that would be a real circular-import risk this codebase has no precedent for (`SuperadminModule`
 * itself composes far more than a tenant's `mode` column). `TenantRepository` is built here from
 * the shared `SUPABASE_CLIENT`, the same "each module composes its own instance of a shared
 * repository class over one shared connection" pattern `SettingsModule`/`SuperadminModule` each
 * already establish — not a second Supabase connection.
 */
@Module({
  providers: [
    ModeGuardService,
    {
      provide: TenantRepository,
      useFactory: (client: SupabaseClientLike): TenantRepository => new TenantRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [ModeGuardService],
})
export class ModeGuardModule {}
