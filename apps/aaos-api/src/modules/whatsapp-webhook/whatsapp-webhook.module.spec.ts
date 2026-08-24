import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { WHATSAPP_WEBHOOK_VERIFIER } from "../../di-tokens.js";
import { WabaConfigRepository } from "../settings/infrastructure/waba-config.repository.js";

import { WhatsAppSignatureGuard } from "./guards/whatsapp-signature.guard.js";
import { WhatsAppWebhookController } from "./whatsapp-webhook.controller.js";
import { WhatsAppWebhookModule } from "./whatsapp-webhook.module.js";
import { WhatsAppWebhookService } from "./whatsapp-webhook.service.js";

describe("WhatsAppWebhookModule", () => {
  it("registers WhatsAppWebhookController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", WhatsAppWebhookModule) as unknown[];
    expect(metadata).toEqual([WhatsAppWebhookController]);
  });

  it("registers WhatsAppWebhookService, WhatsAppSignatureGuard, a WHATSAPP_WEBHOOK_VERIFIER factory, and a WabaConfigRepository factory as providers", () => {
    const metadata = Reflect.getMetadata("providers", WhatsAppWebhookModule) as unknown[];
    expect(metadata).toHaveLength(4);
    expect(metadata).toContain(WhatsAppWebhookService);
    expect(metadata).toContain(WhatsAppSignatureGuard);
    expect(metadata).toContainEqual(
      expect.objectContaining({ provide: WHATSAPP_WEBHOOK_VERIFIER }),
    );
    expect(metadata).toContainEqual(expect.objectContaining({ provide: WabaConfigRepository }));
  });
});
