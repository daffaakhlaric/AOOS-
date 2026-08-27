import type { SupabaseClientLike } from "@aos/lead-store";
import { WebhookVerifier } from "@aos/meta-ads-connector";
import { Module } from "@nestjs/common";

import { SUPABASE_CLIENT, WEBHOOK_VERIFIER } from "../../di-tokens.js";
import { AdTenantIndexRepository } from "../meta-ads/infrastructure/ad-tenant-index.repository.js";

import { WebhookSignatureGuard } from "./guards/webhook-signature.guard.js";
import { WebhookController } from "./webhook.controller.js";
import { WebhookService } from "./webhook.service.js";

/**
 * AAOS-MULTI-TENANT-PHASE1C addition: `AdTenantIndexRepository` built here (not injected from
 * `AppModule.forRoot`, which composes no `AdTenantIndexRepository` of its own) from the shared
 * `SUPABASE_CLIENT`, same "each module composes its own instance of a shared repository class
 * over one shared connection" pattern `WhatsAppWebhookModule` already establishes for
 * `WabaConfigRepository`. Used by `WebhookService` for the real `findTenantByAdMetaId` tenant-
 * resolution lookup.
 */
@Module({
  controllers: [WebhookController],
  providers: [
    WebhookService,
    WebhookSignatureGuard,
    { provide: WEBHOOK_VERIFIER, useFactory: (): WebhookVerifier => new WebhookVerifier() },
    {
      provide: AdTenantIndexRepository,
      useFactory: (client: SupabaseClientLike): AdTenantIndexRepository =>
        new AdTenantIndexRepository(client),
      inject: [SUPABASE_CLIENT],
    },
  ],
})
export class WebhookModule {}
