import "reflect-metadata";

import { describe, expect, it } from "vitest";

import { WEBHOOK_VERIFIER } from "../../di-tokens.js";

import { WebhookSignatureGuard } from "./guards/webhook-signature.guard.js";
import { WebhookController } from "./webhook.controller.js";
import { WebhookModule } from "./webhook.module.js";
import { WebhookService } from "./webhook.service.js";

describe("WebhookModule", () => {
  it("registers WebhookController as its controller", () => {
    const metadata = Reflect.getMetadata("controllers", WebhookModule) as unknown[];
    expect(metadata).toEqual([WebhookController]);
  });

  it("registers WebhookService, WebhookSignatureGuard, a WEBHOOK_VERIFIER factory, and an AdTenantIndexRepository factory as providers", () => {
    const metadata = Reflect.getMetadata("providers", WebhookModule) as unknown[];
    expect(metadata).toHaveLength(4);
    expect(metadata).toContain(WebhookService);
    expect(metadata).toContain(WebhookSignatureGuard);
    expect(metadata).toContainEqual(expect.objectContaining({ provide: WEBHOOK_VERIFIER }));
  });
});
