import { WebhookVerifier } from "@aos/meta-ads-connector";
import { Module } from "@nestjs/common";

import { WEBHOOK_VERIFIER } from "../../di-tokens.js";

import { WebhookSignatureGuard } from "./guards/webhook-signature.guard.js";
import { WebhookController } from "./webhook.controller.js";
import { WebhookService } from "./webhook.service.js";

@Module({
  controllers: [WebhookController],
  providers: [
    WebhookService,
    WebhookSignatureGuard,
    { provide: WEBHOOK_VERIFIER, useFactory: (): WebhookVerifier => new WebhookVerifier() },
  ],
})
export class WebhookModule {}
