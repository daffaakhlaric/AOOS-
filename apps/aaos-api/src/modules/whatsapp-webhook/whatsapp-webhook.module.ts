import type { SupabaseClientLike } from "@aos/lead-store";
import { WebhookVerifier } from "@aos/whatsapp-connector";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT, WHATSAPP_WEBHOOK_VERIFIER } from "../../di-tokens.js";
import { WabaConfigRepository } from "../settings/infrastructure/waba-config.repository.js";

import { WhatsAppSignatureGuard } from "./guards/whatsapp-signature.guard.js";
import { WhatsAppWebhookController } from "./whatsapp-webhook.controller.js";
import { WhatsAppWebhookService } from "./whatsapp-webhook.service.js";

/**
 * AAOS-MULTI-TENANT-PHASE1B (Phase 2) addition: `WabaConfigRepository` built here (not injected
 * from `AppModule.forRoot`, which composes no `WabaConfigRepository` of its own) from the shared
 * `SUPABASE_CLIENT` — same "each module composes its own instance of a shared repository class
 * over one shared connection" pattern `SettingsModule`/`RecyclingModule` already establish. Used
 * by `WhatsAppWebhookService` for the real `findByPhoneNumberId` tenant-resolution lookup.
 */
@Module({
  controllers: [WhatsAppWebhookController],
  providers: [
    WhatsAppWebhookService,
    WhatsAppSignatureGuard,
    {
      provide: WHATSAPP_WEBHOOK_VERIFIER,
      useFactory: (): WebhookVerifier => new WebhookVerifier(),
    },
    {
      provide: WabaConfigRepository,
      useFactory: (client: SupabaseClientLike): WabaConfigRepository =>
        new WabaConfigRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
})
export class WhatsAppWebhookModule {}
