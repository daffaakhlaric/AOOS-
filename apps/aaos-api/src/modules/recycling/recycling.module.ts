import type { SupabaseClientLike } from "@aos/lead-store";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT } from "../../di-tokens.js";
import { ApiKeyGuard } from "../meta-ads/guards/api-key.guard.js";

import { BroadcastLogRepository } from "./infrastructure/broadcast-log.repository.js";
import { BroadcastTemplateRepository } from "./infrastructure/broadcast-template.repository.js";
import { RecyclingSettingsRepository } from "./infrastructure/recycling-settings.repository.js";
import { RecyclingReplyListener } from "./recycling-reply-listener.js";
import { RecyclingController } from "./recycling.controller.js";
import { RecyclingService } from "./recycling.service.js";

/**
 * `modules/recycling` (AAOS-LEAD-RECYCLING-BROADCAST) — mirrors `SchedulerModule`/
 * `SuperadminModule`'s wiring: 3 Supabase-backed repositories built from the shared
 * `SUPABASE_CLIENT`, with `AAOS_API_CONFIG`/`LEAD_STORE`/`LEAD_STORE_LEAD_REPOSITORY`/
 * `WHATSAPP_CONNECTOR_REGISTRY`/`EVENT_BROKER` injected from `AppModule.forRoot`'s global provider
 * set (AAOS-MULTI-TENANT-PHASE1B Phase 2 — replaces the old static `WHATSAPP_CONNECTOR` injection
 * with the real per-tenant registry; see `WhatsAppConnectorRegistry`'s own class doc).
 *
 * `RecyclingService` is exported so `SchedulerModule` can inject it for the `RECYCLING_RUN`
 * Kalender handler (coordinator note section 7) without a second, parallel `@Cron`.
 *
 * `RecyclingReplyListener` is registered as a provider only (never a controller) — it subscribes
 * itself to the real event bus in its own `onModuleInit` (coordinator note section 9).
 */
@Module({
  controllers: [RecyclingController],
  providers: [
    RecyclingService,
    RecyclingReplyListener,
    ApiKeyGuard,
    {
      provide: BroadcastTemplateRepository,
      useFactory: (client: SupabaseClientLike): BroadcastTemplateRepository =>
        new BroadcastTemplateRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: BroadcastLogRepository,
      useFactory: (client: SupabaseClientLike): BroadcastLogRepository =>
        new BroadcastLogRepository(client),
      inject: [SUPABASE_CLIENT],
    },
    {
      provide: RecyclingSettingsRepository,
      useFactory: (client: SupabaseClientLike): RecyclingSettingsRepository =>
        new RecyclingSettingsRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
  exports: [RecyclingService],
})
export class RecyclingModule {}
