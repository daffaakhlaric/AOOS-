import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { KieWebhookSecretGuard } from "./guards/kie-webhook-secret.guard.js";
import { KieWebhookController } from "./kie-webhook.controller.js";
import type { KieWebhookService } from "./kie-webhook.service.js";

function buildFakeService(): KieWebhookService {
  return {
    handleCallback: vi.fn(() => ({ received: true as const, handled: true })),
  } as unknown as KieWebhookService;
}

describe("KieWebhookController", () => {
  describe("POST /api/v1/creative-packages/webhooks/kie", () => {
    it("delegates to KieWebhookService.handleCallback with the validated body and correlation id", () => {
      const service = buildFakeService();
      const controller = new KieWebhookController(service);
      const body = { data: { taskId: "task_1" } };

      const result = controller.receive(body, "corr-1");

      expect(service.handleCallback).toHaveBeenCalledWith(body, "corr-1");
      expect(result).toEqual({ received: true, handled: true });
    });

    it("guards the receive handler with KieWebhookSecretGuard", () => {
      const guards = Reflect.getMetadata("__guards__", KieWebhookController) as unknown[];
      expect(guards).toContain(KieWebhookSecretGuard);
    });
  });
});
