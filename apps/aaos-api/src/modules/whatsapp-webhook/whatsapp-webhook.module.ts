import { WebhookVerifier } from "@aos/whatsapp-connector";
import { Module } from "@nestjs/common";

import { WHATSAPP_WEBHOOK_VERIFIER } from "../../di-tokens.js";

import { WhatsAppSignatureGuard } from "./guards/whatsapp-signature.guard.js";
import { WhatsAppWebhookController } from "./whatsapp-webhook.controller.js";
import { WhatsAppWebhookService } from "./whatsapp-webhook.service.js";

@Module({
  controllers: [WhatsAppWebhookController],
  providers: [
    WhatsAppWebhookService,
    WhatsAppSignatureGuard,
    {
      provide: WHATSAPP_WEBHOOK_VERIFIER,
      useFactory: (): WebhookVerifier => new WebhookVerifier(),
    },
  ],
})
export class WhatsAppWebhookModule {}
